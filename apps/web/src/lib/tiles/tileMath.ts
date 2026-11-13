/** Pirámide tipo slippy-map sobre el mundi (coords de mundo). */

export const TILE_PX = 512;
/** Nivel máximo de tiles mundi (2^8 = 256 tiles de lado → ~7.5 u/tile en W=1920). */
export const TILE_LEVEL_MAX = 8;

export function tileWorldSize(worldW: number, level: number): number {
  return worldW / 2 ** Math.max(0, level);
}

/**
 * Nivel cuya resolución de tile ≈ 1 px de tile por px de pantalla.
 * zoom = px pantalla / unidad de mundo.
 */
export function levelForZoom(zoom: number, worldW: number): number {
  if (zoom <= 0 || worldW <= 0) return 0;
  const raw = Math.log2((worldW * zoom) / TILE_PX);
  return Math.max(0, Math.min(TILE_LEVEL_MAX, Math.round(raw)));
}

export function tileCountX(worldW: number, level: number): number {
  return Math.max(1, Math.ceil(worldW / tileWorldSize(worldW, level)));
}

export function tileCountY(worldW: number, worldH: number, level: number): number {
  return Math.max(1, Math.ceil(worldH / tileWorldSize(worldW, level)));
}

export function tileKey(level: number, x: number, y: number): string {
  return `${level}/${x}_${y}`;
}

export function tileBounds(
  worldW: number,
  level: number,
  x: number,
  y: number,
): { wx: number; wy: number; ww: number; wh: number } {
  const s = tileWorldSize(worldW, level);
  return { wx: x * s, wy: y * s, ww: s, wh: s };
}

/** Tiles visibles para un viewport en coords de mundo. */
export function visibleTiles(
  worldW: number,
  worldH: number,
  level: number,
  view: { left: number; top: number; right: number; bottom: number },
  pad = 1,
): Array<{ x: number; y: number }> {
  const s = tileWorldSize(worldW, level);
  const maxX = tileCountX(worldW, level) - 1;
  const maxY = tileCountY(worldW, worldH, level) - 1;
  const x0 = Math.max(0, Math.floor(view.left / s) - pad);
  const y0 = Math.max(0, Math.floor(view.top / s) - pad);
  const x1 = Math.min(maxX, Math.floor(view.right / s) + pad);
  const y1 = Math.min(maxY, Math.floor(view.bottom / s) + pad);
  const out: Array<{ x: number; y: number }> = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      out.push({ x, y });
    }
  }
  return out;
}
