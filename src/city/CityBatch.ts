import * as THREE from "three";
import { pxToWorld } from "../plano/coords";
import type { PlanoMeta } from "../plano/types";
import { estiloDe } from "./estilo";

/**
 * Geometría ciudad unificada al estilo jl:
 * un BufferGeometry batcheado de quads (techos + muros), no InstancedMesh de cajas.
 * Cada pieza lleva aInfo / aWall / aAncla / aEstilo por vértice.
 */

function encodeDist(dist: number, nace: number, muere: number) {
  const et = (nace | 0) + 8 * (muere >= 255 ? 0 : muere | 0);
  return dist + et * 20000;
}

export type CityBatchResult = {
  geo: THREE.BufferGeometry;
  count: number;
};

type Acc = {
  pos: number[];
  nor: number[];
  info: number[];
  wall: number[];
  ancla: number[];
  estilo: number[];
  idx: number[];
};

function pushQuad(
  a: Acc,
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  n: [number, number, number],
  info: [number, number, number, number],
  wallUV: [number, number, number, number][],
  ancla: [number, number, number],
  est: number,
) {
  const base = a.pos.length / 3;
  const pts = [p0, p1, p2, p3];
  for (let i = 0; i < 4; i++) {
    const p = pts[i]!;
    const w = wallUV[i]!;
    a.pos.push(p[0], p[1], p[2]);
    a.nor.push(n[0], n[1], n[2]);
    a.info.push(info[0], info[1], info[2], info[3]);
    a.wall.push(w[0], w[1], w[2], w[3]);
    a.ancla.push(ancla[0], ancla[1], ancla[2]);
    a.estilo.push(est);
  }
  a.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/**
 * Construye techos (azoteas + pendientes) y muros como quads mundiales batcheados.
 */
export function buildCityBatch(
  meta: PlanoMeta,
  techos: Float32Array,
  muros: Float32Array,
  techoStride: number,
  deathTechos: Uint8Array,
  deathMuros: Uint8Array,
): CityBatchResult {
  const a: Acc = { pos: [], nor: [], info: [], wall: [], ancla: [], estilo: [], idx: [] };
  const metro = meta.metro;

  // --- techos ---
  const nT = techos.length / techoStride;
  for (let i = 0; i < nT; i++) {
    const o = i * techoStride;
    const px = techos[o]!;
    const py = techos[o + 1]!;
    let w = techos[o + 2]! * metro;
    let d = techos[o + 3]! * metro;
    const hMax = techos[o + 4]!;
    let yaw = 0;
    let seed = 0.5;
    let et = 0;
    if (techoStride === 8) {
      yaw = techos[o + 5]!;
      seed = techos[o + 6]!;
      et = techos[o + 7]!;
    } else {
      seed = techos[o + 5]!;
      et = techos[o + 6]!;
    }
    w = Math.max(0.8, w);
    d = Math.max(0.8, d);
    const [x, z] = pxToWorld(meta, px, py);
    const dist = Math.hypot(x, z);
    const death = deathTechos[i] ?? 255;
    const floors = Math.max(1, Math.floor((hMax - 0.8) / 3.3 + 0.5));
    const est = estiloDe(x, z, et | 0, floors, seed * 65535);
    const pitched = est >= 5;
    const roofY = Math.max(2.6, hMax);
    const roofH = pitched ? Math.max(1.1, Math.min(4.5, hMax * 0.18)) : 0.28;
    const distEnc = encodeDist(dist, et, death);
    const info: [number, number, number, number] = [seed, 30 + floors, hMax, distEnc];
    const ancla: [number, number, number] = [x, z, 1];

    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const hw = w / 2;
    const hd = d / 2;
    const corner = (lx: number, lz: number): [number, number] => [
      x + lx * c - lz * s,
      z + lx * s + lz * c,
    ];
    const [x0, z0] = corner(-hw, -hd);
    const [x1, z1] = corner(hw, -hd);
    const [x2, z2] = corner(hw, hd);
    const [x3, z3] = corner(-hw, hd);

    if (pitched) {
      // techo a dos aguas: cresta en el centro
      const ridge = roofY + roofH;
      const [rx0, rz0] = corner(0, -hd);
      const [rx1, rz1] = corner(0, hd);
      pushQuad(
        a,
        [x0, roofY, z0],
        [rx0, ridge, rz0],
        [rx1, ridge, rz1],
        [x3, roofY, z3],
        [-c, 0.35, -s],
        info,
        wallUVs(w, d),
        ancla,
        est,
      );
      pushQuad(
        a,
        [rx0, ridge, rz0],
        [x1, roofY, z1],
        [x2, roofY, z2],
        [rx1, ridge, rz1],
        [c, 0.35, s],
        info,
        wallUVs(w, d),
        ancla,
        est,
      );
    } else {
      pushQuad(
        a,
        [x0, roofY, z0],
        [x1, roofY, z1],
        [x2, roofY, z2],
        [x3, roofY, z3],
        [0, 1, 0],
        info,
        wallUVs(w, d),
        ancla,
        est,
      );
    }
  }

  // --- muros ---
  const nM = muros.length / 8;
  for (let i = 0; i < nM; i++) {
    const o = i * 8;
    const px = muros[o]!;
    const py = muros[o + 1]!;
    const len = Math.max(0.35, muros[o + 2]!);
    const height = Math.max(0.4, muros[o + 3]!);
    const y0 = muros[o + 4]!;
    const yaw = muros[o + 5]!;
    const seed = muros[o + 6]!;
    const et = muros[o + 7]!;
    const [x, z] = pxToWorld(meta, px, py);
    const dist = Math.hypot(x, z);
    const death = deathMuros[i] ?? 255;
    const floors = Math.max(1, Math.floor((height - 0.8) / 3.3 + 0.5));
    const est = estiloDe(x, z, et | 0, floors, seed * 65535);
    const distEnc = encodeDist(dist, et, death);
    const info: [number, number, number, number] = [seed, 10 + floors, height, distEnc];
    const ancla: [number, number, number] = [x, z, 1];

    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const hl = len / 2;
    // muro vertical: a lo largo de yaw, normal perpendicular
    const ax = -s * hl;
    const az = c * hl;
    const nx = c;
    const nz = s;
    const y1 = y0 + height;
    pushQuad(
      a,
      [x - ax, y0, z - az],
      [x + ax, y0, z + az],
      [x + ax, y1, z + az],
      [x - ax, y1, z - az],
      [nx, 0, nz],
      info,
      [
        [0, y0, len, height],
        [len, y0, len, height],
        [len, y1, len, height],
        [0, y1, len, height],
      ],
      ancla,
      est,
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(a.pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(a.nor, 3));
  geo.setAttribute("aInfo", new THREE.Float32BufferAttribute(a.info, 4));
  geo.setAttribute("aWall", new THREE.Float32BufferAttribute(a.wall, 4));
  geo.setAttribute("aAncla", new THREE.Float32BufferAttribute(a.ancla, 3));
  geo.setAttribute("aEstilo", new THREE.Float32BufferAttribute(a.estilo, 1));
  geo.setIndex(a.idx);
  geo.computeBoundingSphere();

  return { geo, count: a.idx.length / 6 };
}

function wallUVs(w: number, d: number): [number, number, number, number][] {
  return [
    [0, 0, w, d],
    [w, 0, w, d],
    [w, d, w, d],
    [0, d, w, d],
  ];
}
