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
import type { MapSceneDto, PinDto } from "@valtherion/contracts";
import { visiblePinsForZoom } from "@valtherion/domain";
import { useAtlasStore } from "@/store/atlasStore";
import { TerrainRenderer } from "@/lib/terrain/TerrainRenderer";

/** Zoom relativo máximo del mundi procedural (detalle infinito; el límite es de escala/UX). */
const ZOOM_REL_MAX_WORLD = 48;
/** Holgura sobre el zoom “nativo” de una escena-imagen (1 = llena el viewport). */
const SCENE_ZOOM_SLACK = 1.15;

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
    const maybe = app as unknown as { _cancelResize?: unknown; resizeTo?: unknown };
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
  const scenes = useAtlasStore((s) => s.scenes);
  const showGrid = useAtlasStore((s) => s.showGrid);

  const pinsRef = useRef(pins);
  const scenesRef = useRef(scenes);
  const showGridRef = useRef(showGrid);
  pinsRef.current = pins;
  scenesRef.current = scenes;
  showGridRef.current = showGrid;

  useEffect(() => {
    if (!hostRef.current || !world) return;
    const host = hostRef.current;
    let cancelled = false;
    let app: Application | null = null;
    let terrain: TerrainRenderer | null = null;
    let cleanupListeners: (() => void) | null = null;

    const worldW = world.width;
    const worldH = world.height;
    const { setZoom, openLore, selectPin, setActiveSceneIds, requestFocusScene } =
      useAtlasStore.getState();

    (async () => {
      const instance = new Application();
      await instance.init({
        backgroundAlpha: 0,
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

      // Capa 0: mundi procedural en GPU (detalle infinito). Capa 1: Pixi (pins, escenas, grilla).
      terrain = TerrainRenderer.create();
      const layers: HTMLElement[] = [];
      if (terrain) {
        terrain.canvas.style.position = "absolute";
        terrain.canvas.style.left = "0";
        terrain.canvas.style.top = "0";
        layers.push(terrain.canvas);
      }
      app.canvas.style.position = "absolute";
      app.canvas.style.left = "0";
      app.canvas.style.top = "0";
      layers.push(app.canvas);
      host.replaceChildren(...layers);
      terrain?.resize(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1));

      const stage = new Container();
      stage.eventMode = "static";
      stage.hitArea = new Rectangle(-worldW * 20, -worldH * 20, worldW * 41, worldH * 41);
      app.stage.addChild(stage);

      const mapLayer = new Container();
      const scenesLayer = new Container();
      const gridLayer = new Graphics();
      const pinsLayer = new Container();
      stage.addChild(mapLayer, scenesLayer, gridLayer, pinsLayer);

      // Fallback sin WebGL2: imagen estática (se pixela al hacer zoom).
      if (!terrain) {
        try {
          const texture = await Assets.load(`${world.mapImage}?v=biomes2`);
          if (cancelled) return;
          const sprite = new Sprite(texture);
          sprite.width = worldW;
          sprite.height = worldH;
          mapLayer.addChild(sprite);
        } catch {
          if (cancelled) return;
          mapLayer.addChild(new Graphics().rect(0, 0, worldW, worldH).fill(0x1a2744));
        }
      }

      const labelStyle = new TextStyle({
        fill: "#e8dcc8",
        fontSize: 13,
        fontFamily: "Georgia, serif",
        stroke: { color: "#0c1218", width: 3 },
      });

      let fitZoom = 1;
      let zoom = 1;
      const sceneSprites = new Map<string, Sprite>();
      const sceneLoading = new Set<string>();

      function syncTerrain() {
        terrain?.schedule(stage.position.x, stage.position.y, zoom);
      }

      function zoomRelative() {
        return fitZoom > 0 ? zoom / fitZoom : 1;
      }

      function redrawGrid() {
        gridLayer.clear();
        if (!showGridRef.current || zoomRelative() < 8) return;
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
        const zRel = zoomRelative();
        const visible = visiblePinsForZoom(pinsRef.current, zRel).filter((p) => {
          // Ocultar pin de ciudad si su escena HD ya está activa encima.
          const covered = scenesRef.current.some(
            (s) =>
              s.pinId === p.id &&
              zRel >= s.minZoomRelative &&
              zRel <= s.maxZoomRelative &&
              sceneSprites.has(s.id),
          );
          return !covered;
        });
        for (const pin of visible) {
          pinsLayer.addChild(
            makePin(pin, labelStyle, zoom, (p) => {
              selectPin(p.id);
              if (p.loreNodeId) openLore(p.loreNodeId, p.id);
              const scene = scenesRef.current.find((s) => s.pinId === p.id);
              if (scene) requestFocusScene(scene.id);
            }),
          );
        }
      }

      async function syncScenes() {
        if (cancelled || !app) return;
        const zRel = zoomRelative();
        const active: string[] = [];

        for (const scene of scenesRef.current) {
          const shouldShow = zRel >= scene.minZoomRelative && zRel <= scene.maxZoomRelative;
          let sprite = sceneSprites.get(scene.id);

          if (shouldShow) {
            active.push(scene.id);
            if (!sprite && !sceneLoading.has(scene.id)) {
              sceneLoading.add(scene.id);
              try {
                const texture = await Assets.load(`${scene.mapImage}?v=2`);
                if (cancelled) return;
                sprite = new Sprite(texture);
                sprite.x = scene.x;
                sprite.y = scene.y;
                sprite.width = scene.width;
                sprite.height = scene.height;
                sprite.alpha = 0;
                scenesLayer.addChild(sprite);
                sceneSprites.set(scene.id, sprite);
              } catch (err) {
                console.error("Scene load failed", scene.id, err);
              } finally {
                sceneLoading.delete(scene.id);
              }
            }
            sprite = sceneSprites.get(scene.id);
            if (sprite) {
              sprite.alpha = 1;
              sprite.visible = true;
            }
          } else if (sprite) {
            sprite.visible = false;
            sprite.alpha = 0;
          }
        }

        setActiveSceneIds(active);
        redrawPins();
      }

      function fitToWorld() {
        if (!app) return;
        const sx = app.screen.width / worldW;
        const sy = app.screen.height / worldH;
        fitZoom = Math.min(sx, sy);
        zoom = fitZoom;
        stage.scale.set(zoom);
        stage.position.set(
          (app.screen.width - worldW * zoom) / 2,
          (app.screen.height - worldH * zoom) / 2,
        );
        setZoom(zoom, fitZoom);
        syncTerrain();
        void syncScenes();
        redrawGrid();
      }

      /** Zoom absoluto donde la escena llena ~92% del lado menor del viewport. */
      function nativeSceneZoom(scene: MapSceneDto) {
        if (!app) return fitZoom;
        const zx = (app.screen.width * 0.92) / scene.width;
        const zy = (app.screen.height * 0.92) / scene.height;
        return Math.min(zx, zy);
      }

      /** Tope de zoom bajo el cursor: el mundi es infinito; una escena-imagen no se estira. */
      function maxZoomAt(wx: number, wy: number) {
        const zRel = zoomRelative();
        const under = scenesRef.current.filter(
          (s) =>
            zRel >= s.minZoomRelative &&
            zRel <= s.maxZoomRelative &&
            wx >= s.x &&
            wx <= s.x + s.width &&
            wy >= s.y &&
            wy <= s.y + s.height,
        );
        if (under.length === 0) return fitZoom * ZOOM_REL_MAX_WORLD;
        return Math.max(...under.map((s) => nativeSceneZoom(s) * SCENE_ZOOM_SLACK));
      }

      function focusScene(scene: MapSceneDto) {
        if (!app) return;
        zoom = nativeSceneZoom(scene);
        stage.scale.set(zoom);
        const cx = scene.x + scene.width / 2;
        const cy = scene.y + scene.height / 2;
        stage.position.set(app.screen.width / 2 - cx * zoom, app.screen.height / 2 - cy * zoom);
        setZoom(zoom, fitZoom);
        syncTerrain();
        void syncScenes();
        redrawGrid();
      }

      fitToWorld();

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
        syncTerrain();
      });

      const onWheel = (ev: WheelEvent) => {
        if (!app) return;
        ev.preventDefault();
        const oldZoom = zoom;
        const factor = ev.deltaY < 0 ? 1.12 : 0.89;
        const rect = app.canvas.getBoundingClientRect();
        const mx = ev.clientX - rect.left;
        const my = ev.clientY - rect.top;
        const wx = (mx - stage.position.x) / oldZoom;
        const wy = (my - stage.position.y) / oldZoom;
        let next = zoom * factor;
        if (factor > 1) next = Math.min(next, Math.max(maxZoomAt(wx, wy), zoom));
        next = Math.max(fitZoom, next);
        zoom = next;
        stage.scale.set(zoom);
        stage.position.set(mx - wx * zoom, my - wy * zoom);
        setZoom(zoom, fitZoom);
        syncTerrain();
        void syncScenes();
        redrawGrid();
      };
      app.canvas.addEventListener("wheel", onWheel, { passive: false });

      const ro = new ResizeObserver(() => {
        if (!app || cancelled) return;
        const w = Math.max(host.clientWidth, 1);
        const h = Math.max(host.clientHeight, 1);
        app.renderer.resize(w, h);
        terrain?.resize(w, h);
        if (Math.abs(zoomRelative() - 1) < 0.05) {
          fitToWorld();
        } else {
          syncTerrain();
          void syncScenes();
          redrawGrid();
        }
      });
      ro.observe(host);

      const unsub = useAtlasStore.subscribe((state, prev) => {
        if (state.showGrid !== prev.showGrid) redrawGrid();
        if (state.pins !== prev.pins || state.scenes !== prev.scenes) {
          scenesRef.current = state.scenes;
          pinsRef.current = state.pins;
          void syncScenes();
        }
        if (state.focusSceneId && state.focusSceneId !== prev.focusSceneId) {
          const scene = state.scenes.find((s) => s.id === state.focusSceneId);
          if (scene) {
            focusScene(scene);
            requestFocusScene(null);
          }
        }
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
      terrain?.destroy();
      terrain = null;
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
