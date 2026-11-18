import type { PlanoMeta } from "../plano/types";
import { loadPakGzip } from "./pak";

export type CreceGeometry = {
  techos: Float32Array;
  muros: Float32Array;
  /** muerte de techos base: pares [idx, etapa] */
  mueT: Uint32Array;
  /** muerte de muros base: pares [idx, etapa] */
  mueM: Uint32Array;
};

type Pt = { x: number; z: number };

function mzPoint(
  mz: Float32Array,
  mi: number,
  gu: number,
  gv: number,
  plaza: [number, number],
  metro: number,
  out: Pt,
) {
  const c = mi * 10;
  const gw = mz[c + 8]!;
  const gh = mz[c + 9]!;
  const l = gu / gw;
  const u = gv / gh;
  const d = (1 - l) * (1 - u);
  const f = l * (1 - u);
  const p = l * u;
  const m = (1 - l) * u;
  out.x = (d * mz[c]! + f * mz[c + 2]! + p * mz[c + 4]! + m * mz[c + 6]! - plaza[0]) * metro;
  out.z = (d * mz[c + 1]! + f * mz[c + 3]! + p * mz[c + 5]! + m * mz[c + 7]! - plaza[1]) * metro;
}

/**
 * Decodifica crece.pak → Float32 compatibles con CityMeshes.
 * etapa de aparición = (campo7 >> 8) & 15  (como jl() del original con a=true).
 */
export async function loadCreceGeometry(meta: PlanoMeta): Promise<CreceGeometry | null> {
  try {
    const pak = await loadPakGzip("/datos/crece.pak", {
      manzanas: Float32Array,
      techos: Uint16Array,
      muros: Uint16Array,
      mueT: Uint32Array,
      mueM: Uint32Array,
    });
    const mz = pak.manzanas as Float32Array;
    const techosU = pak.techos as Uint16Array;
    const murosU = pak.muros as Uint16Array;
    const plaza = meta.plaza;
    const metro = meta.metro;
    const nT = techosU.length / 8;
    const nM = murosU.length / 8;

    const techos = new Float32Array(nT * 8);
    const p0: Pt = { x: 0, z: 0 };
    const p1: Pt = { x: 0, z: 0 };
    const p2: Pt = { x: 0, z: 0 };
    const p3: Pt = { x: 0, z: 0 };
    /** manzana+seed → etapa (los muros del original se atan al techo por seed) */
    const etBySeed = new Map<number, number>();
    let tOk = 0;

    for (let i = 0; i < nT; i++) {
      const r = i * 8;
      const mi = techosU[r]!;
      if (mi >= mz.length / 10) continue;
      const u0 = techosU[r + 1]!;
      const v0 = techosU[r + 2]!;
      const u1 = techosU[r + 3]!;
      const v1 = techosU[r + 4]!;
      const hRaw = techosU[r + 5]!;
      const seedU = techosU[r + 6]!;
      const flags = techosU[r + 7]!;
      const et = (flags >> 8) & 15;

      mzPoint(mz, mi, u0, v0, plaza, metro, p0);
      mzPoint(mz, mi, u1, v0, plaza, metro, p1);
      mzPoint(mz, mi, u1, v1, plaza, metro, p2);
      mzPoint(mz, mi, u0, v1, plaza, metro, p3);

      const cx = (p0.x + p1.x + p2.x + p3.x) / 4;
      const cz = (p0.z + p1.z + p2.z + p3.z) / 4;
      const eWx = p1.x - p0.x;
      const eWz = p1.z - p0.z;
      const eDx = p3.x - p0.x;
      const eDz = p3.z - p0.z;
      let wM = Math.hypot(eWx, eWz);
      let dM = Math.hypot(eDx, eDz);
      if (wM < 0.8) wM = 0.8;
      if (dM < 0.8) dM = 0.8;
      if (wM > 55) wM = 55;
      if (dM > 55) dM = 55;
      const yaw = Math.atan2(eDx, eDz);
      const o = tOk * 8;
      techos[o] = plaza[0] + cx / metro;
      techos[o + 1] = plaza[1] + cz / metro;
      techos[o + 2] = wM / metro;
      techos[o + 3] = dM / metro;
      techos[o + 4] = Math.max(2.4, hRaw / 10);
      techos[o + 5] = yaw;
      techos[o + 6] = seedU / 65535;
      techos[o + 7] = et;
      etBySeed.set(mi * 65536 + seedU, et);
      tOk++;
    }

    const muros = new Float32Array(nM * 8);
    const N: Pt = { x: 0, z: 0 };
    const P: Pt = { x: 0, z: 0 };
    let mOk = 0;
    for (let i = 0; i < nM; i++) {
      const t = i * 8;
      const mi = murosU[t]!;
      if (mi >= mz.length / 10) continue;
      const packed = murosU[t + 1]!;
      const side = packed & 3;
      const d = murosU[t + 2]!;
      const a0 = murosU[t + 3]!;
      const a1 = murosU[t + 4]!;
      const y0 = murosU[t + 5]! / 10;
      const y1 = murosU[t + 6]! / 10;
      const seedU = murosU[t + 7]!;
      const seed = seedU / 65535;
      const et = etBySeed.get(mi * 65536 + seedU) ?? 1;

      let height = y1 - y0;
      if (height < 0.4) height = 0.4;
      if (height > 40) height = 40;

      if (side === 0 || side === 2) {
        mzPoint(mz, mi, a0, d, plaza, metro, N);
        mzPoint(mz, mi, a1, d, plaza, metro, P);
      } else {
        mzPoint(mz, mi, d, a0, plaza, metro, N);
        mzPoint(mz, mi, d, a1, plaza, metro, P);
      }
      const dx = P.x - N.x;
      const dz = P.z - N.z;
      let len = Math.hypot(dx, dz);
      if (len < 0.35) continue;
      if (len > 60) len = 60;
      const cx = (N.x + P.x) / 2;
      const cz = (N.z + P.z) / 2;
      const yaw = Math.atan2(dx, dz);
      const o = mOk * 8;
      muros[o] = plaza[0] + cx / metro;
      muros[o + 1] = plaza[1] + cz / metro;
      muros[o + 2] = len;
      muros[o + 3] = height;
      muros[o + 4] = Math.max(0, y0);
      muros[o + 5] = yaw;
      muros[o + 6] = seed;
      muros[o + 7] = et;
      mOk++;
    }

    return {
      techos: techos.subarray(0, tOk * 8),
      muros: muros.subarray(0, mOk * 8),
      mueT: pak.mueT as Uint32Array,
      mueM: pak.mueM as Uint32Array,
    };
  } catch (e) {
    console.warn("crece.pak no cargó", e);
    return null;
  }
}
