import * as THREE from "three";
import { pxToWorld } from "../plano/coords";
import type { PlanoMeta } from "../plano/types";

const FONT_NORMAL = 'italic 12.5px "Newsreader", Georgia, serif';
const FONT_AV = '600 13px "Newsreader", Georgia, serif';
const GRID = 300;
const MAX_DIST = 3600;
const CLOSE_DIST = 1500;
const MAX_LABELS = 90;

type Seg = {
  x: number;
  z: number;
  dx: number;
  dz: number;
  name: string;
  half: number;
  av: boolean;
};

/**
 * Nombres de calles (calles.bin + calles.json) dibujados al acercarte, como el original.
 */
export class CallesLabels {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private segs: Seg[] = [];
  private grid = new Map<string, number[]>();
  private meta: PlanoMeta;
  private measureCache = new Map<string, number>();
  amount = 0;

  constructor(meta: PlanoMeta) {
    this.meta = meta;
    this.canvas = document.createElement("canvas");
    this.canvas.id = "calles";
    this.canvas.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;";
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;
  }

  async load() {
    try {
      const [bin, names] = await Promise.all([
        fetch("/datos/calles.bin").then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.arrayBuffer();
        }),
        fetch("/datos/calles.json").then((r) => r.json()) as Promise<string[]>,
      ]);
      const u = new Uint16Array(bin);
      const n = u.length / 6;
      this.segs = [];
      this.grid.clear();
      for (let i = 0; i < n; i++) {
        const o = i * 6;
        const [x, z] = pxToWorld(this.meta, u[o]!, u[o + 1]!);
        const ang = (u[o + 2]! / 65536) * Math.PI;
        const name = names[u[o + 3]!] ?? "";
        if (!name) continue;
        const half = u[o + 4]! / 2;
        const av = !!u[o + 5]!;
        const idx = this.segs.length;
        this.segs.push({
          x,
          z,
          dx: Math.cos(ang),
          dz: Math.sin(ang),
          name,
          half,
          av,
        });
        const key = `${Math.floor(x / GRID)},${Math.floor(z / GRID)}`;
        let bucket = this.grid.get(key);
        if (!bucket) {
          bucket = [];
          this.grid.set(key, bucket);
        }
        bucket.push(idx);
      }
    } catch (e) {
      console.warn("calles.bin/json no cargó", e);
    }
  }

  setAmount(a: number) {
    this.amount = a;
    if (a <= 0.01) this.clear();
  }

  update(
    camera: THREE.Camera,
    controls: { target: THREE.Vector3; goal: { dist: number; x: number; z: number } },
    hoyOn: boolean,
  ) {
    if (!hoyOn || this.amount <= 0.01 || this.segs.length === 0) {
      this.clear();
      return;
    }
    const dist = controls.goal.dist;
    if (dist > MAX_DIST) {
      this.clear();
      return;
    }

    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }

    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cx = controls.goal.x;
    const cz = controls.goal.z;
    const radius = Math.min(2400, dist * 1.4 + 150);
    const candidates: number[] = [];
    for (let gz = Math.floor((cz - radius) / GRID); gz <= Math.floor((cz + radius) / GRID); gz++) {
      for (let gx = Math.floor((cx - radius) / GRID); gx <= Math.floor((cx + radius) / GRID); gx++) {
        const bucket = this.grid.get(`${gx},${gz}`);
        if (!bucket) continue;
        for (const i of bucket) {
          const s = this.segs[i]!;
          if (s.av || dist < CLOSE_DIST) candidates.push(i);
        }
      }
    }

    const v = new THREE.Vector3();
    const project = (x: number, z: number): [number, number] | null => {
      v.set(x, 0.5, z).project(camera);
      if (v.z >= 1) return null;
      return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h];
    };

    const placed: { name: string; x: number; y: number }[] = [];
    let drawn = 0;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#8f2a1a";
    ctx.strokeStyle = "#f4ead3";
    ctx.lineWidth = 3;
    ctx.globalAlpha = Math.min(1, this.amount);

    for (const i of candidates) {
      if (drawn >= MAX_LABELS) break;
      const s = this.segs[i]!;
      const p0 = project(s.x, s.z);
      if (!p0) continue;
      const p1 = project(s.x + s.dx * 20, s.z + s.dz * 20);
      if (!p1) continue;
      const scale = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 20;
      if (scale < (s.av ? 0.2 : 0.4)) continue;

      const font = s.av ? FONT_AV : FONT_NORMAL;
      const tw = this.measure(s.name, font);
      if (tw > s.half * 2 * scale * (s.av ? 3.4 : 1.3)) continue;

      let [sx, sy] = p0;
      const along = (cx - s.x) * s.dx + (cz - s.z) * s.dz;
      const maxAlong = s.half - tw / (2 * scale) - 12;
      if (maxAlong > 4 && Math.abs(along) > 1) {
        const t = Math.max(-maxAlong, Math.min(maxAlong, along));
        const p = project(s.x + s.dx * t, s.z + s.dz * t);
        if (!p) continue;
        [sx, sy] = p;
      }
      if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;

      let ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      if (ang > Math.PI / 2) ang -= Math.PI;
      else if (ang <= -Math.PI / 2) ang += Math.PI;

      const minD = s.av ? 400 : 300;
      if (placed.some((p) => p.name === s.name && Math.hypot(p.x - sx, p.y - sy) < minD)) {
        continue;
      }
      placed.push({ name: s.name, x: sx, y: sy });

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.font = font;
      ctx.strokeText(s.name, 0, 0);
      ctx.fillText(s.name, 0, 0);
      ctx.restore();
      drawn++;
    }
    ctx.globalAlpha = 1;
  }

  private measure(text: string, font: string) {
    const key = font + "|" + text;
    let w = this.measureCache.get(key);
    if (w == null) {
      this.ctx.font = font;
      w = this.ctx.measureText(text).width;
      this.measureCache.set(key, w);
    }
    return w;
  }

  private clear() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  dispose() {
    this.canvas.remove();
  }
}
