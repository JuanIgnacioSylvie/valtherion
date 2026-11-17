/** Parcelas a partir de componentes conexos de hatch dentro de una manzana. */

export type HatchParcel = {
  x: number; // centro
  y: number;
  w: number;
  d: number;
  dens: number;
};

function hash(x: number, y: number, s = 1) {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

type Blob = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
  inkSum: number;
};

/** Etiqueta componentes en máscara local (mw×mh). */
function labelLocal(
  mask: Uint8Array,
  ink: Float32Array,
  mw: number,
  mh: number,
  minArea: number,
): Blob[] {
  const labels = new Int32Array(mw * mh);
  const blobs: Blob[] = [];
  const stack: number[] = [];

  for (let i = 0; i < mw * mh; i++) {
    if (!mask[i] || labels[i]) continue;
    const id = blobs.length + 1;
    let minX = mw;
    let minY = mh;
    let maxX = 0;
    let maxY = 0;
    let area = 0;
    let inkSum = 0;
    stack.length = 0;
    stack.push(i);
    labels[i] = id;

    while (stack.length) {
      const p = stack.pop()!;
      const x = p % mw;
      const y = (p / mw) | 0;
      area++;
      inkSum += ink[p];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      for (const q of [p - 1, p + 1, p - mw, p + mw]) {
        if (q < 0 || q >= mw * mh) continue;
        if (Math.abs((q % mw) - x) > 1) continue;
        if (!mask[q] || labels[q]) continue;
        labels[q] = id;
        stack.push(q);
      }
    }
    if (area >= minArea) blobs.push({ minX, minY, maxX, maxY, area, inkSum });
  }
  return blobs;
}

/** Busca cortes (baja tinta) internos para partir un blob grande. */
function splitBlob(
  inkLocal: Float32Array,
  mw: number,
  mh: number,
  b: Blob,
  minSep: number,
): Array<{ minX: number; minY: number; maxX: number; maxY: number }> {
  const bw = b.maxX - b.minX + 1;
  const bh = b.maxY - b.minY + 1;
  if (bw < minSep * 2 && bh < minSep * 2) {
    return [{ minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY }];
  }

  // perfiles locales
  const col = new Float32Array(bw);
  const row = new Float32Array(bh);
  const colN = new Float32Array(bw);
  const rowN = new Float32Array(bh);
  for (let y = b.minY; y <= b.maxY; y++) {
    for (let x = b.minX; x <= b.maxX; x++) {
      const v = inkLocal[y * mw + x];
      col[x - b.minX] += v;
      colN[x - b.minX]++;
      row[y - b.minY] += v;
      rowN[y - b.minY]++;
    }
  }
  for (let i = 0; i < bw; i++) col[i] = colN[i] ? col[i] / colN[i] : 0;
  for (let i = 0; i < bh; i++) row[i] = rowN[i] ? row[i] / rowN[i] : 0;

  const findCuts = (prof: Float32Array, len: number) => {
    const cuts: number[] = [];
    const margin = Math.max(2, Math.floor(minSep * 0.35));
    let mean = 0;
    for (let i = 0; i < len; i++) mean += prof[i];
    mean /= len;
    const thr = mean * 0.55;
    for (let i = margin; i < len - margin; i++) {
      if (prof[i] > thr) continue;
      if (prof[i] <= prof[i - 1] && prof[i] <= prof[i + 1]) {
        if (!cuts.length || i - cuts[cuts.length - 1] >= minSep) cuts.push(i);
      }
    }
    return cuts;
  };

  const vCuts = findCuts(col, bw).map((c) => b.minX + c);
  const hCuts = findCuts(row, bh).map((c) => b.minY + c);

  if (!vCuts.length && !hCuts.length) {
    // forzar grilla 2×2 si es muy grande
    if (bw * bh > minSep * minSep * 6) {
      const mx = (b.minX + b.maxX) >> 1;
      const my = (b.minY + b.maxY) >> 1;
      return [
        { minX: b.minX, minY: b.minY, maxX: mx - 1, maxY: my - 1 },
        { minX: mx + 1, minY: b.minY, maxX: b.maxX, maxY: my - 1 },
        { minX: b.minX, minY: my + 1, maxX: mx - 1, maxY: b.maxY },
        { minX: mx + 1, minY: my + 1, maxX: b.maxX, maxY: b.maxY },
      ];
    }
    return [{ minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY }];
  }

  const xs = [b.minX, ...vCuts, b.maxX + 1];
  const ys = [b.minY, ...hCuts, b.maxY + 1];
  const out: Array<{ minX: number; minY: number; maxX: number; maxY: number }> = [];
  for (let iy = 0; iy < ys.length - 1; iy++) {
    for (let ix = 0; ix < xs.length - 1; ix++) {
      const minX = xs[ix];
      const maxX = xs[ix + 1] - 1;
      const minY = ys[iy];
      const maxY = ys[iy + 1] - 1;
      if (maxX - minX < 2 || maxY - minY < 2) continue;
      out.push({ minX, minY, maxX, maxY });
    }
  }
  return out.length ? out : [{ minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY }];
}

/**
 * Extrae parcelas del hatch dentro de [bx0,by0)–(bx1,by1) en coords del ink full.
 * ink: Float32 del mapa completo w×h.
 */
export function parcelsFromHatch(
  ink: Float32Array,
  w: number,
  h: number,
  bx0: number,
  by0: number,
  bx1: number,
  by1: number,
  opts?: { thr?: number; minArea?: number; minSep?: number },
): { parcels: HatchParcel[]; patioTrees: Array<{ x: number; y: number; r: number; seed: number }> } {
  const thr = opts?.thr ?? 0.16;
  const minArea = opts?.minArea ?? 8;
  const minSep = opts?.minSep ?? 6;
  const mw = bx1 - bx0;
  const mh = by1 - by0;
  if (mw < 4 || mh < 4) return { parcels: [], patioTrees: [] };

  const mask = new Uint8Array(mw * mh);
  const inkL = new Float32Array(mw * mh);
  let dark = 0;
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const v = ink[(by0 + y) * w + (bx0 + x)] ?? 0;
      inkL[y * mw + x] = v;
      if (v > thr) {
        mask[y * mw + x] = 1;
        dark++;
      }
    }
  }

  // Cerrar huecos chicos del hatch (dilate 1 + erode 1 simplificado)
  const dil = new Uint8Array(mw * mh);
  for (let y = 1; y < mh - 1; y++) {
    for (let x = 1; x < mw - 1; x++) {
      const i = y * mw + x;
      dil[i] =
        mask[i] ||
        mask[i - 1] ||
        mask[i + 1] ||
        mask[i - mw] ||
        mask[i + mw]
          ? 1
          : 0;
    }
  }
  for (let y = 1; y < mh - 1; y++) {
    for (let x = 1; x < mw - 1; x++) {
      const i = y * mw + x;
      mask[i] =
        dil[i] && dil[i - 1] && dil[i + 1] && dil[i - mw] && dil[i + mw] ? 1 : dil[i] && inkL[i] > thr * 0.7 ? 1 : 0;
    }
  }

  const blobs = labelLocal(mask, inkL, mw, mh, minArea);
  const parcels: HatchParcel[] = [];
  const patioTrees: Array<{ x: number; y: number; r: number; seed: number }> = [];
  const blockArea = mw * mh;

  // Patios: celdas claras rodeadas de hatch
  if (dark / blockArea > 0.12) {
    for (let y = 2; y < mh - 2; y += 2) {
      for (let x = 2; x < mw - 2; x += 2) {
        if (inkL[y * mw + x] > thr * 0.7) continue;
        let near = 0;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) if (mask[(y + dy) * mw + (x + dx)]) near++;
        if (near < 8) continue;
        if (hash(bx0 + x, by0 + y, 9) > 0.35) continue;
        patioTrees.push({
          x: bx0 + x,
          y: by0 + y,
          r: 2.5 + hash(x, y, 10) * 3.5,
          seed: hash(x, y, 11),
        });
      }
    }
  }

  for (const b of blobs) {
    const area = b.area;
    const dens = b.inkSum / Math.max(1, area);
    const parts =
      area > blockArea * 0.35 || (b.maxX - b.minX) * (b.maxY - b.minY) > blockArea * 0.5
        ? splitBlob(inkL, mw, mh, b, minSep)
        : [{ minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY }];

    for (const p of parts) {
      // densidad del recorte
      let s = 0;
      let n = 0;
      for (let y = p.minY; y <= p.maxY; y++) {
        for (let x = p.minX; x <= p.maxX; x++) {
          s += inkL[y * mw + x];
          n++;
        }
      }
      const pd = n ? s / n : 0;
      if (pd < thr * 0.55) continue;

      const pad = 0.08 + hash(p.minX, p.minY, 3) * 0.06;
      let ww = (p.maxX - p.minX + 1) * (1 - pad * 2);
      let dd = (p.maxY - p.minY + 1) * (1 - pad * 2);
      ww *= 0.88 + hash(p.minX, p.maxY, 4) * 0.12;
      dd *= 0.88 + hash(p.maxX, p.minY, 5) * 0.12;
      if (ww < 3 || dd < 3) continue;

      const cx = bx0 + (p.minX + p.maxX + 1) / 2;
      const cy = by0 + (p.minY + p.maxY + 1) / 2;
      parcels.push({ x: cx, y: cy, w: ww, d: dd, dens: pd });
    }
  }

  return { parcels, patioTrees };
}

/** Refina la plaza: ventana de baja tinta cerca de la estimación. */
export function refinePlaza(
  ink: Float32Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  win = 80,
): [number, number] {
  const half = Math.round(win / 2);
  let best = Infinity;
  let bx = cx;
  let by = cy;
  const step = 4;
  for (let y = Math.max(0, cy - win); y < Math.min(h - half, cy + win); y += step) {
    for (let x = Math.max(0, cx - win); x < Math.min(w - half, cx + win); x += step) {
      let s = 0;
      let n = 0;
      for (let dy = 0; dy < half; dy += 2) {
        for (let dx = 0; dx < half; dx += 2) {
          s += ink[(y + dy) * w + (x + dx)];
          n++;
        }
      }
      const m = s / n;
      // preferir huecos grandes y centrados
      const dist = Math.hypot(x + half / 2 - cx, y + half / 2 - cy);
      const score = m + dist * 0.0008;
      if (score < best) {
        best = score;
        bx = x + half / 2;
        by = y + half / 2;
      }
    }
  }
  return [bx, by];
}
