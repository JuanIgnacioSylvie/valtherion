import type { PlanoMeta } from "./types";

/** Píxel del plano → metros mundo (origen en la plaza, +X este, +Z sur). */
export function pxToWorld(meta: PlanoMeta, px: number, py: number): [number, number] {
  const x = (px - meta.plaza[0]) * meta.metro;
  const z = (py - meta.plaza[1]) * meta.metro;
  return [x, z];
}

/** Metros mundo → píxel del plano. */
export function worldToPx(meta: PlanoMeta, x: number, z: number): [number, number] {
  const px = x / meta.metro + meta.plaza[0];
  const py = z / meta.metro + meta.plaza[1];
  return [px, py];
}

export function hojaSizeMeters(meta: PlanoMeta): { w: number; h: number } {
  return { w: meta.ancho * meta.metro, h: meta.alto * meta.metro };
}
