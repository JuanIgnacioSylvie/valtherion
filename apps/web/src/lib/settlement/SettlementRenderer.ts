import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { SettlementDto } from "@valtherion/contracts";

function parseColor(hex: string): number {
  const h = hex.replace("#", "");
  return Number.parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
}

function fillPoly(
  g: Graphics,
  pts: Array<[number, number]>,
  fill: number,
  alpha = 1,
  stroke?: number,
  sw = 0.8,
) {
  if (pts.length < 3) return;
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fill({ color: fill, alpha });
  if (stroke != null) g.stroke({ width: sw, color: stroke, alpha: 0.95 });
}

/**
 * Asentamiento desde datos — estilo mapa de ciudad D&D (techos, sombras, tinta).
 * Vectorial: no pixela a ningún zoom.
 */
export function buildSettlementView(data: SettlementDto): Container {
  const root = new Container();
  root.eventMode = "none";

  // Suelo + grano sutil
  const ground = new Graphics();
  ground.rect(0, 0, data.width, data.height).fill({ color: parseColor(data.groundColor), alpha: 1 });
  root.addChild(ground);
  const grit = new Graphics();
  for (let i = 0; i < 180; i++) {
    const x = (i * 47) % data.width;
    const y = (i * 89) % data.height;
    grit.circle(x, y, 0.35 + (i % 3) * 0.15).fill({
      color: i % 2 ? 0x2a2420 : 0x4a4238,
      alpha: 0.18,
    });
  }
  root.addChild(grit);

  if (data.walls) {
    for (const w of data.walls) {
      const g = new Graphics();
      fillPoly(g, w.polygon, parseColor(w.color), 1, w.stroke ? parseColor(w.stroke) : 0x1a1612, 1.1);
      root.addChild(g);
    }
  }

  if (data.water) {
    for (const w of data.water) {
      const g = new Graphics();
      fillPoly(g, w.polygon, parseColor(w.color), 1, w.stroke ? parseColor(w.stroke) : 0x1a252e, 0.7);
      // ripples
      const xs = w.polygon.map((p) => p[0]);
      const ys = w.polygon.map((p) => p[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      for (let t = 0; t < 5; t++) {
        const x0 = minX + ((maxX - minX) * (t + 1)) / 6;
        const y0 = minY + ((maxY - minY) * (t + 1)) / 6;
        g.moveTo(x0 - 3, y0);
        g.lineTo(x0 + 3, y0 + 1.5);
      }
      g.stroke({ width: 0.4, color: 0x6a8a9a, alpha: 0.35 });
      root.addChild(g);
    }
  }

  if (data.parks) {
    for (const p of data.parks) {
      const g = new Graphics();
      fillPoly(g, p.polygon, parseColor(p.color), 1, p.stroke ? parseColor(p.stroke) : undefined, 0.5);
      root.addChild(g);
    }
  }

  const roadsG = new Graphics();
  for (const road of data.roads) {
    if (road.points.length < 2) continue;
    roadsG.moveTo(road.points[0][0], road.points[0][1]);
    for (let i = 1; i < road.points.length; i++) {
      roadsG.lineTo(road.points[i][0], road.points[i][1]);
    }
    roadsG.stroke({
      width: road.width + 1.2,
      color: 0x2a2420,
      alpha: 0.55,
      join: "round",
      cap: "round",
    });
  }
  for (const road of data.roads) {
    if (road.points.length < 2) continue;
    roadsG.moveTo(road.points[0][0], road.points[0][1]);
    for (let i = 1; i < road.points.length; i++) {
      roadsG.lineTo(road.points[i][0], road.points[i][1]);
    }
    roadsG.stroke({
      width: road.width,
      color: parseColor(road.color ?? "#6a5e52"),
      alpha: 1,
      join: "round",
      cap: "round",
    });
  }
  root.addChild(roadsG);

  if (data.bridges) {
    for (const b of data.bridges) {
      const g = new Graphics();
      fillPoly(g, b.polygon, parseColor(b.color), 1, b.stroke ? parseColor(b.stroke) : 0x2a2420, 0.8);
      root.addChild(g);
    }
  }

  const sorted = [...data.buildings].sort((a, b) => {
    const ay = a.polygon.reduce((s, p) => s + p[1], 0) / a.polygon.length;
    const by = b.polygon.reduce((s, p) => s + p[1], 0) / b.polygon.length;
    return ay - by;
  });

  const shadows = new Graphics();
  for (const b of sorted) {
    const h = b.height ?? 2.5;
    const shadowPts = b.polygon.map(([x, y]) => [x + h * 0.5, y + h * 0.5] as [number, number]);
    if (shadowPts.length < 3) continue;
    shadows.moveTo(shadowPts[0][0], shadowPts[0][1]);
    for (let i = 1; i < shadowPts.length; i++) shadows.lineTo(shadowPts[i][0], shadowPts[i][1]);
    shadows.closePath();
    shadows.fill({ color: 0x0a0806, alpha: 0.32 });
  }
  root.addChild(shadows);

  const roofs = new Graphics();
  for (const b of sorted) {
    if (b.polygon.length < 3) continue;
    roofs.moveTo(b.polygon[0][0], b.polygon[0][1]);
    for (let i = 1; i < b.polygon.length; i++) roofs.lineTo(b.polygon[i][0], b.polygon[i][1]);
    roofs.closePath();
    roofs.fill({ color: parseColor(b.roofColor), alpha: 1 });
    roofs.stroke({ width: 0.65, color: parseColor(b.wallColor ?? "#2a2420"), alpha: 0.95 });
  }
  root.addChild(roofs);

  // Cresta del techo + chimenea
  const detail = new Graphics();
  for (const b of sorted) {
    if (b.polygon.length < 4) continue;
    const xs = b.polygon.map((p) => p[0]);
    const ys = b.polygon.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    detail.moveTo(cx, minY + 0.6);
    detail.lineTo(cx, maxY - 0.6);
    if ((b.kind === "house" || b.kind === "warehouse") && maxX - minX > 5) {
      detail.rect(cx + (maxX - minX) * 0.22, minY + 0.8, 1.1, 1.4);
    }
  }
  detail.stroke({ width: 0.4, color: 0x1a1210, alpha: 0.4 });
  detail.fill({ color: 0x3a3028, alpha: 0.85 });
  root.addChild(detail);

  if (data.trees) {
    const treesG = new Graphics();
    for (const t of data.trees) {
      treesG.circle(t.x + 0.6, t.y + 0.6, t.r).fill({ color: 0x0a0806, alpha: 0.25 });
      treesG.circle(t.x, t.y, t.r).fill({ color: parseColor(t.color ?? "#2a4a28"), alpha: 1 });
      treesG.circle(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.35).fill({
        color: 0x5a8a48,
        alpha: 0.35,
      });
      treesG.circle(t.x, t.y, t.r).stroke({ width: 0.35, color: 0x1a1210, alpha: 0.5 });
    }
    root.addChild(treesG);
  }

  const labelStyle = new TextStyle({
    fill: "#f4efe4",
    fontSize: 6.5,
    fontFamily: "Georgia, serif",
    fontWeight: "bold",
    stroke: { color: "#1a120c", width: 2.5 },
  });
  for (const b of sorted) {
    if (!b.label) continue;
    const cx = b.polygon.reduce((s, p) => s + p[0], 0) / b.polygon.length;
    const cy = b.polygon.reduce((s, p) => s + p[1], 0) / b.polygon.length;
    const t = new Text({ text: b.label, style: labelStyle });
    t.anchor.set(0.5, 0.5);
    t.position.set(cx, cy - 1);
    root.addChild(t);
  }

  // Marco tinta de la escena
  const frame = new Graphics();
  frame.rect(0.5, 0.5, data.width - 1, data.height - 1).stroke({ width: 1.2, color: 0x1a120c, alpha: 0.55 });
  root.addChild(frame);

  return root;
}
