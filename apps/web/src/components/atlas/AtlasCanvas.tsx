"use client";

import { useEffect, useRef } from "react";
import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  FederatedPointerEvent,
} from "pixi.js";
import type { PinDto } from "@valtherion/contracts";
import { visiblePinsForZoom } from "@valtherion/domain";
import { useAtlasStore } from "@/store/atlasStore";

const ZOOM_MIN = 0.12;
const ZOOM_MAX = 8;
const PIN_COLORS: Record<string, number> = {
  kingdom: 0xc4a35a,
  province: 0x8fa3b5,
  capital: 0xe8dcc8,
  settlement: 0x9aa7b5,
  ocean: 0x4a90c8,
  landmass: 0x6a994e,
  poi: 0xd4a373,
  scene: 0xc1121f,
};

function safeDestroyApp(app: Application | null) {
  if (!app) return;
  try {
    // Pixi v8 + resizeTo rompe a veces en Strict Mode (_cancelResize).
    const maybe = app as Application & { _cancelResize?: unknown; resizeTo?: unknown };
    if (typeof maybe._cancelResize === "function") {
      (maybe._cancelResize as () => void)();
    }
    maybe.resizeTo = undefined;
    app.destroy({ removeView: true }, true);
  } catch {
    try {
      app.canvas?.remove();
    } catch {
      /* ignore */
    }
  }
}

export function AtlasCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const world = useAtlasStore((s) => s.world);
  const pins = useAtlasStore((s) => s.pins);
  const showGrid = useAtlasStore((s) => s.showGrid);

  const pinsRef = useRef(pins);
  const showGridRef = useRef(showGrid);
  pinsRef.current = pins;
  showGridRef.current = showGrid;

  useEffect(() => {
    if (!hostRef.current || !world) return;
    const host = hostRef.current;
    let cancelled = false;
    let app: Application | null = null;
    let cleanupListeners: (() => void) | null = null;

    const worldW = world.width;
    const worldH = world.height;
    const { setZoom, openLore, selectPin } = useAtlasStore.getState();

    (async () => {
      const instance = new Application();
      await instance.init({
        background: 0x0b1628,
        width: Math.max(host.clientWidth, 1),
        height: Math.max(host.clientHeight, 1),
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });

      if (cancelled) {
        safeDestroyApp(instance);
        return;
      }

      app = instance;
      host.replaceChildren(app.canvas);

      const stage = new Container();
      stage.eventMode = "static";
      stage.hitArea = new Rectangle(-worldW, -worldH, worldW * 3, worldH * 3);
      app.stage.addChild(stage);

      const mapLayer = new Container();
      const gridLayer = new Graphics();
      const pinsLayer = new Container();
      stage.addChild(mapLayer, gridLayer, pinsLayer);

      try {
        const texture = await Assets.load(world.mapImage);
        if (cancelled) return;
        const sprite = new Sprite(texture);
        sprite.width = worldW;
        sprite.height = worldH;
        mapLayer.addChild(sprite);
      } catch {
        if (cancelled) return;
        const fallback = new Graphics().rect(0, 0, worldW, worldH).fill(0x1a2744);
        mapLayer.addChild(fallback);
      }

      const labelStyle = new TextStyle({
        fill: "#e8dcc8",
        fontSize: 13,
        fontFamily: "Georgia, serif",
        stroke: { color: "#0c1218", width: 3 },
      });

      let zoom = 0.35;

      function redrawGrid() {
        gridLayer.clear();
        if (!showGridRef.current || zoom < 2.2) return;
        const step = 40;
        gridLayer.setStrokeStyle({ width: 1 / zoom, color: 0xffffff, alpha: 0.12 });
        for (let x = 0; x <= worldW; x += step) {
          gridLayer.moveTo(x, 0).lineTo(x, worldH);
        }
        for (let y = 0; y <= worldH; y += step) {
          gridLayer.moveTo(0, y).lineTo(worldW, y);
        }
        gridLayer.stroke();
      }

      function redrawPins() {
        pinsLayer.removeChildren();
        const visible = visiblePinsForZoom(pinsRef.current, zoom);
        for (const pin of visible) {
          pinsLayer.addChild(
            makePin(pin, labelStyle, zoom, (p) => {
              selectPin(p.id);
              if (p.loreNodeId) openLore(p.loreNodeId, p.id);
            }),
          );
        }
      }

      function fit() {
        if (!app) return;
        const sx = app.screen.width / worldW;
        const sy = app.screen.height / worldH;
        zoom = Math.min(sx, sy) * 0.92;
        stage.scale.set(zoom);
        stage.position.set(
          (app.screen.width - worldW * zoom) / 2,
          (app.screen.height - worldH * zoom) / 2,
        );
        setZoom(zoom);
        redrawPins();
        redrawGrid();
      }

      fit();

      let dragging = false;
      let lastX = 0;
      let lastY = 0;

      stage.on("pointerdown", (e: FederatedPointerEvent) => {
        dragging = true;
        lastX = e.global.x;
        lastY = e.global.y;
      });
      stage.on("pointerup", () => {
        dragging = false;
      });
      stage.on("pointerupoutside", () => {
        dragging = false;
      });
      stage.on("pointermove", (e: FederatedPointerEvent) => {
        if (!dragging) return;
        stage.position.x += e.global.x - lastX;
        stage.position.y += e.global.y - lastY;
        lastX = e.global.x;
        lastY = e.global.y;
      });

      const onWheel = (ev: WheelEvent) => {
        if (!app) return;
        ev.preventDefault();
        const oldZoom = zoom;
        const factor = ev.deltaY < 0 ? 1.1 : 0.9;
        zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * factor));
        const rect = app.canvas.getBoundingClientRect();
        const mx = ev.clientX - rect.left;
        const my = ev.clientY - rect.top;
        const wx = (mx - stage.position.x) / oldZoom;
        const wy = (my - stage.position.y) / oldZoom;
        stage.scale.set(zoom);
        stage.position.set(mx - wx * zoom, my - wy * zoom);
        setZoom(zoom);
        redrawPins();
        redrawGrid();
      };
      app.canvas.addEventListener("wheel", onWheel, { passive: false });

      const ro = new ResizeObserver(() => {
        if (!app || cancelled) return;
        const w = Math.max(host.clientWidth, 1);
        const h = Math.max(host.clientHeight, 1);
        app.renderer.resize(w, h);
        redrawPins();
        redrawGrid();
      });
      ro.observe(host);

      const unsub = useAtlasStore.subscribe((state, prev) => {
        if (state.showGrid !== prev.showGrid) redrawGrid();
        if (state.pins !== prev.pins) redrawPins();
      });

      cleanupListeners = () => {
        unsub();
        ro.disconnect();
        app?.canvas.removeEventListener("wheel", onWheel);
      };
    })().catch((err) => {
      console.error("Atlas init failed", err);
    });

    return () => {
      cancelled = true;
      cleanupListeners?.();
      safeDestroyApp(app);
      app = null;
      host.replaceChildren();
    };
  }, [world]);

  return <div ref={hostRef} className="absolute inset-0 touch-none" />;
}

function makePin(
  pin: PinDto,
  labelStyle: TextStyle,
  zoom: number,
  onClick: (p: PinDto) => void,
) {
  const root = new Container();
  root.position.set(pin.x, pin.y);
  root.eventMode = "static";
  root.cursor = "pointer";

  const color = PIN_COLORS[pin.kind] ?? 0xc4a35a;
  const r = Math.max(3, (pin.importance >= 4 ? 7 : 5) / Math.sqrt(Math.max(zoom, 0.2)));
  const dot = new Graphics().circle(0, 0, r).fill({ color, alpha: 0.95 });
  dot.stroke({ width: 1 / zoom, color: 0x0c1218, alpha: 0.8 });
  root.addChild(dot);

  const showLabel = pin.importance >= 3 || zoom > 0.7;
  if (showLabel) {
    const label = new Text({ text: pin.label, style: labelStyle });
    label.scale.set(1 / Math.max(zoom, 0.35));
    label.position.set(8 / zoom, -6 / zoom);
    root.addChild(label);
  }

  root.on("pointertap", (e) => {
    e.stopPropagation();
    onClick(pin);
  });

  return root;
}
