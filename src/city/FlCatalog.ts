import * as THREE from "three";
import { pxToWorld } from "../plano/coords";
import type { PlanoMeta } from "../plano/types";
import { makeCityMaterial, seedConTono, Tono } from "./CityMaterial";
import type { CityUniforms } from "./CityUniforms";

export type FlBuilding = {
  key: string;
  nombre: string;
  año: number;
  x: number;
  y: number;
  ux: number;
  uy: number;
  largo: number;
  ancho: number;
  height: number;
  tono: number;
  planta: [number, number][][];
};

export type FlEntry = {
  root: THREE.Object3D;
  desde: number;
  hasta: number;
  key: string;
};

/** Carga el catálogo Fl (~40 plantas con extrusión). */
export async function loadFlCatalog(): Promise<FlBuilding[]> {
  const list = (await fetch("/datos/fl.json").then((r) => r.json())) as FlBuilding[];
  return list.filter((b) => b.planta?.length);
}

/**
 * Extruíe cada planta Fl en un mesh con aInfo/aAncla (anclado al relieve).
 * Congreso lleva cúpula; torres usan altura del catálogo.
 */
export function buildFlMeshes(
  meta: PlanoMeta,
  shared: CityUniforms,
  buildings: FlBuilding[],
): FlEntry[] {
  const mat = makeCityMaterial(shared, { manto: 1 });
  const out: FlEntry[] = [];

  for (const b of buildings) {
    const g = new THREE.Group();
    g.name = b.key;
    const seed = seedConTono(b.tono);
    let cx = 0;
    let cz = 0;
    let nPts = 0;

    for (const ring of b.planta) {
      if (!ring || ring.length < 3) continue;
      const pts = ring.map(([px, py]) => {
        const [x, z] = pxToWorld(meta, px, py);
        return new THREE.Vector2(x, z);
      });
      let rcx = 0;
      let rcz = 0;
      for (const p of pts) {
        rcx += p.x;
        rcz += p.y;
      }
      rcx /= pts.length;
      rcz /= pts.length;
      cx += rcx;
      cz += rcz;
      nPts++;

      const shape = new THREE.Shape();
      shape.moveTo(pts[0]!.x - rcx, pts[0]!.y - rcz);
      for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i]!.x - rcx, pts[i]!.y - rcz);
      shape.closePath();

      const H = Math.max(8, b.height);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      stampAttrs(geo, seed, H, rcx, rcz, b.año);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(rcx, 0, rcz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    }

    if (!g.children.length) continue;
    if (nPts) {
      cx /= nPts;
      cz /= nPts;
    }

    // Cúpula Congreso / Aguas
    if (b.key === "congreso" || b.key === "aguas") {
      const R = b.key === "congreso" ? 14 : 8;
      const dome = new THREE.SphereGeometry(R, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
      const [dx, dz] =
        b.key === "congreso" ? pxToWorld(meta, 10330, 6820) : pxToWorld(meta, b.x, b.y);
      dome.translate(dx, b.height + 2, dz);
      stampAttrs(dome, seedConTono(Tono.LADRILLO), R, dx, dz, b.año);
      g.add(new THREE.Mesh(dome, mat));
    }

    // Torre Barolo / Kavanagh: remate
    if (b.key === "barolo" || b.key === "kavanagh") {
      const [tx, tz] = pxToWorld(meta, b.x, b.y);
      const tip = new THREE.ConeGeometry(b.key === "kavanagh" ? 4 : 6, 18, 4);
      tip.translate(tx, b.height + 4, tz);
      stampAttrs(tip, seed, 18, tx, tz, b.año);
      g.add(new THREE.Mesh(tip, mat));
    }

    out.push({ root: g, desde: b.año, hasta: 9999, key: b.key });
  }

  return out;
}

function stampAttrs(
  geo: THREE.BufferGeometry,
  seed: number,
  H: number,
  ax: number,
  az: number,
  año: number,
) {
  const n = geo.getAttribute("position").count;
  const info = new Float32Array(n * 4);
  const wall = new Float32Array(n * 4);
  const ancla = new Float32Array(n * 3);
  const estilo = new Float32Array(n);
  const dist = Math.hypot(ax, az) + año * 0.01;
  for (let i = 0; i < n; i++) {
    info[i * 4] = seed;
    info[i * 4 + 1] = 14;
    info[i * 4 + 2] = H;
    info[i * 4 + 3] = dist;
    wall[i * 4 + 2] = 24;
    wall[i * 4 + 3] = H;
    ancla[i * 3] = ax;
    ancla[i * 3 + 1] = az;
    ancla[i * 3 + 2] = 1;
  }
  geo.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
  geo.setAttribute("aWall", new THREE.BufferAttribute(wall, 4));
  geo.setAttribute("aAncla", new THREE.BufferAttribute(ancla, 3));
  geo.setAttribute("aEstilo", new THREE.BufferAttribute(estilo, 1));
}
