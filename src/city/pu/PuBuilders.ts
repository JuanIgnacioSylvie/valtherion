import * as THREE from "three";
import type { PlanoMeta } from "../../plano/types";
import type { CityUniforms } from "../CityUniforms";
import { LandmarkKit, Pinta, Tono } from "../LandmarkKit";
import { placeBarco } from "./Barcos";

export type PuEntry = {
  root: THREE.Object3D;
  desde: number;
  hasta: number;
  name: string;
};

type Hito = { nombre: string; x: number; y: number; kind?: string };

type Ctx = {
  meta: PlanoMeta;
  shared: CityUniforms;
  hitos?: Hito[];
  wallRx?: number;
  wallRy?: number;
};

/** Ángulos de las puertas (0 = este, π/2 = sur/puerto, −π/2 = norte). */
const GATE_N = -Math.PI / 2;
const GATE_E = 0;
const GATE_W = Math.PI;
const GATE_HALF = 0.042; // ~24 m de vano a radio ~575 m
const HARBOR_HALF = 0.72;

function kit(ctx: Ctx) {
  return new LandmarkKit(ctx.meta, ctx.shared);
}

function push(out: PuEntry[], k: LandmarkKit, name: string) {
  const { desde, hasta } = k.yearRange();
  const root = k.build();
  if (root.children.length) out.push({ root, desde, hasta, name });
}

function findHito(ctx: Ctx, kind: string): Hito | undefined {
  return ctx.hitos?.find((h) => (h.kind ?? "").toLowerCase() === kind);
}

/** Piezas urbanísticas de Aurion: plaza, calles, muralla, puerto. */
export function buildPuPieces(ctx: Ctx): PuEntry[] {
  const out: PuEntry[] = [];
  plazaMayor(ctx, out);
  callesPrincipales(ctx, out);
  murallaRing(ctx, out);
  puertoReal(ctx, out);
  return out;
}

/** Plaza Mayor — escala ciudad grande (no metrópoli). */
function plazaMayor(ctx: Ctx, out: PuEntry[]) {
  const [px, py] = ctx.meta.plaza;
  const k = kit(ctx);
  k.epoca(0);
  k.lugar(px, py, 1, 0);

  k.tapete(k.recto(92, 74), Pinta.GRANZA, { claro: 0.55, alto: 0.1, y: 0.01 });
  k.tapete(k.recto(10, 74), Pinta.ADOQUIN, { claro: 0.58, alto: 0.12, y: 0.03 });
  k.tapete(k.recto(92, 10), Pinta.ADOQUIN, { claro: 0.58, alto: 0.12, y: 0.03 });

  for (const [x, z] of [
    [-28, -22],
    [28, -22],
    [-28, 22],
    [28, 22],
  ] as [number, number][]) {
    k.cantero(k.ovalo(x, z, 9, 7, 12), {
      alto: 0.4,
      cordon: 0.3,
      tono: Pinta.CESPED,
      claro: 0.48,
    });
  }

  k.caja(2.2, 0.6, 2.2, 0, 0.1, 0, k.PIEDRA, { tono: Tono.SILLAR });
  k.cilindro(0.45, 6.5, 0, 0.7, 0, k.PIEDRA, 8, 0.4, { tono: Tono.SILLAR });
  k.caja(2.8, 0.35, 0.45, 0, 5.4, 0, k.PIEDRA, { tono: Tono.SILLAR });

  for (const [x, z] of [
    [-36, -28],
    [36, -28],
    [-36, 28],
    [36, 28],
    [0, -34],
    [0, 34],
  ] as [number, number][]) {
    k.cilindro(0.14, 4.6, x, 0.1, z, k.TINTA, 6, 0.12, {});
    k.caja(0.55, 0.45, 0.55, x, 4.7, z, k.PINTADO, { pinta: [Pinta.BRONCE, 0.45] });
  }

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    k.arbol(Math.cos(a) * 38, Math.sin(a) * 30, 2.2);
  }

  push(out, k, "plazaMayor");
}

/** Calle Real: adoquines N→plaza→puerto + cruces E/O hacia las puertas laterales. */
function callesPrincipales(ctx: Ctx, out: PuEntry[]) {
  const [cx, cy] = ctx.meta.plaza;
  const m = ctx.meta.metro;
  const rx = (ctx.wallRx ?? ctx.meta.ancho * 0.3) * m;
  const ry = (ctx.wallRy ?? ctx.meta.alto * 0.34) * m;
  const k = kit(ctx);
  k.epoca(0);
  k.lugar(cx, cy, 1, 0);

  // avenida N–S (puerta norte → plaza → puerto)
  // tapete: shape Y → −Z mundo, así que shapeY = −worldZ
  const worldN = -ry - 12; // atraviesa la Puerta del Norte
  const worldS = ry * 0.62;
  const shapeN = -worldN;
  const shapeS = -worldS;
  const avenueLen = Math.abs(shapeN - shapeS);
  const avenueMid = (shapeN + shapeS) * 0.5;
  k.tapete(k.recto(14, avenueLen, 0, avenueMid), Pinta.ADOQUIN, {
    claro: 0.52,
    alto: 0.14,
    y: 0.04,
  });
  k.tapete(k.recto(1.2, avenueLen, -7.2, avenueMid), Pinta.GRANZA, {
    claro: 0.45,
    alto: 0.1,
    y: 0.02,
  });
  k.tapete(k.recto(1.2, avenueLen, 7.2, avenueMid), Pinta.GRANZA, {
    claro: 0.45,
    alto: 0.1,
    y: 0.02,
  });

  // cruces E–O (shapeY = −worldZ)
  const crossW = rx * 0.92;
  k.tapete(k.recto(crossW, 11, 0, 0), Pinta.ADOQUIN, { claro: 0.5, alto: 0.13, y: 0.035 });
  k.tapete(k.recto(crossW * 0.55, 9, 0, 120), Pinta.ADOQUIN, {
    claro: 0.48,
    alto: 0.12,
    y: 0.03,
  });
  k.tapete(k.recto(crossW * 0.45, 9, 0, -140), Pinta.ADOQUIN, {
    claro: 0.48,
    alto: 0.12,
    y: 0.03,
  });

  push(out, k, "callesPrincipales");
}

/** Punto del óvalo de muralla en metros mundo (wobble por ángulo). */
function wallPoint(a: number, rx: number, ry: number): [number, number] {
  const wobble = 1 + 0.035 * Math.sin(a * 3 + 1.2) + 0.02 * Math.cos(a * 5);
  return [Math.cos(a) * rx * wobble, Math.sin(a) * ry * wobble];
}

function angDist(a: number, center: number) {
  let d = a - center;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Hueco sur (puerto) o puertas N/E/O. */
function inWallGap(a: number) {
  if (Math.abs(angDist(a, Math.PI / 2)) < HARBOR_HALF) return true;
  if (Math.abs(angDist(a, GATE_N)) < GATE_HALF) return true;
  if (Math.abs(angDist(a, GATE_E)) < GATE_HALF) return true;
  if (Math.abs(angDist(a, GATE_W)) < GATE_HALF) return true;
  return false;
}

/**
 * Muralla continua — un poco más alta que Four Winds (~24–26 ft),
 * con torres de vigilancia y tres puertas (N/E/O) + boca de puerto.
 */
function murallaRing(ctx: Ctx, out: PuEntry[]) {
  const [cx, cy] = ctx.meta.plaza;
  const m = ctx.meta.metro;
  const rx = (ctx.wallRx ?? ctx.meta.ancho * 0.3) * m;
  const ry = (ctx.wallRy ?? ctx.meta.alto * 0.34) * m;
  const thick = 3.6;
  const height = 8.4;
  const walk = 0.55;
  const k = kit(ctx);
  k.epoca(0);
  k.lugar(cx, cy, 1, 0);

  const segs = 112;
  type Seg = { i: number; a0: number; a1: number; x0: number; z0: number; x1: number; z1: number };
  const segsBuilt: Seg[] = [];

  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const am = (a0 + a1) * 0.5;
    if (inWallGap(am)) continue;
    const [x0, z0] = wallPoint(a0, rx, ry);
    const [x1, z1] = wallPoint(a1, rx, ry);
    segsBuilt.push({ i, a0, a1, x0, z0, x1, z1 });
  }

  for (const s of segsBuilt) {
    const mx = (s.x0 + s.x1) * 0.5;
    const mz = (s.z0 + s.z1) * 0.5;
    const dx = s.x1 - s.x0;
    const dz = s.z1 - s.z0;
    const len = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);

    const curtain = new THREE.BoxGeometry(thick, height, len + 0.4);
    curtain.rotateY(yaw);
    curtain.translate(mx, height / 2, mz);
    k.put(curtain, k.SILLAR, { tono: Tono.SILLAR, floors: 1, H: height });

    const walkway = new THREE.BoxGeometry(thick * 0.92, walk, len + 0.4);
    walkway.rotateY(yaw);
    walkway.translate(mx, height + walk / 2, mz);
    k.put(walkway, k.SILLAR, { tono: Tono.SILLAR, H: height + walk });

    const step = 7.5;
    const nMerlon = Math.max(1, Math.floor(len / step));
    for (let mi = 0; mi < nMerlon; mi++) {
      const t = (mi + 0.5) / nMerlon;
      const bx = s.x0 + dx * t;
      const bz = s.z0 + dz * t;
      const merlon = new THREE.BoxGeometry(thick * 0.85, 1.7, 2.1);
      merlon.rotateY(yaw);
      merlon.translate(bx, height + walk + 0.85, bz);
      k.put(merlon, k.SILLAR, { tono: Tono.SILLAR, H: height + walk + 1.7 });
    }

    // torre de vigilancia cada ~8 segmentos
    if (s.i % 8 === 0) {
      putTower(k, mx, mz, height + 4.5, 6.4);
    }
  }

  // torres en bocas del puerto
  for (const sign of [-1, 1] as const) {
    const a = Math.PI / 2 + sign * HARBOR_HALF;
    const [tx, tz] = wallPoint(a, rx, ry);
    putTower(k, tx, tz, height + 5, 7.5);
  }

  // puertas N / E / O (torres + arco abierto, sin plano que tape el vano)
  for (const gate of [GATE_N, GATE_E, GATE_W]) {
    putGate(k, gate, rx, ry, height, thick);
  }

  push(out, k, "muralla");
}

function putTower(k: LandmarkKit, tx: number, tz: number, th: number, size = 7.2) {
  k.caja(size, th, size, tx, 0, tz, k.SILLAR, { tono: Tono.SILLAR, floors: 1, H: th });
  k.caja(size + 1, 0.85, size + 1, tx, th, tz, k.SILLAR, { tono: Tono.SILLAR, H: th + 0.85 });
  const o = size * 0.35;
  for (const [ox, oz] of [
    [-o, -o],
    [o, -o],
    [-o, o],
    [o, o],
  ] as [number, number][]) {
    k.caja(1.5, 1.5, 1.5, tx + ox, th + 0.85, tz + oz, k.SILLAR, {
      tono: Tono.SILLAR,
      H: th + 2.4,
    });
  }
}

/** Puerta: dos torres en los extremos del vano + dintel/arco sin relleno. */
function putGate(
  k: LandmarkKit,
  ang: number,
  rx: number,
  ry: number,
  wallH: number,
  thick: number,
) {
  const [xL, zL] = wallPoint(ang - GATE_HALF, rx, ry);
  const [xR, zR] = wallPoint(ang + GATE_HALF, rx, ry);
  const [xM, zM] = wallPoint(ang, rx, ry);
  const dx = xR - xL;
  const dz = zR - zL;
  const span = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const th = wallH + 4.2;

  putTower(k, xL, zL, th, 6.8);
  putTower(k, xR, zR, th, 6.8);

  // stubs tangentes: desde cada torre hacia afuera del vano (une con la cortina)
  const txLen = Math.hypot(dx, dz) || 1;
  const tdx = dx / txLen;
  const tdz = dz / txLen;
  const stubLen = 16;
  for (const [tx, tz, dir] of [
    [xL, zL, -1],
    [xR, zR, 1],
  ] as [number, number, number][]) {
    const mx = tx + tdx * dir * (stubLen * 0.5);
    const mz = tz + tdz * dir * (stubLen * 0.5);
    const stub = new THREE.BoxGeometry(thick, wallH, stubLen);
    stub.rotateY(yaw);
    stub.translate(mx, wallH / 2, mz);
    k.put(stub, k.SILLAR, { tono: Tono.SILLAR, floors: 1, H: wallH });
  }

  // dintel sobre el vano (hueco libre debajo)
  const lintelH = 2.4;
  const archTop = wallH + 0.6;
  const lintel = new THREE.BoxGeometry(thick + 1.2, lintelH, span * 0.92);
  lintel.rotateY(yaw);
  lintel.translate(xM, archTop + lintelH / 2, zM);
  k.put(lintel, k.SILLAR, { tono: Tono.SILLAR, H: archTop + lintelH });

  // almenas del dintel
  for (const t of [0.25, 0.5, 0.75]) {
    const bx = xL + dx * t;
    const bz = zL + dz * t;
    const mer = new THREE.BoxGeometry(thick * 0.7, 1.4, 1.8);
    mer.rotateY(yaw);
    mer.translate(bx, archTop + lintelH + 0.7, bz);
    k.put(mer, k.SILLAR, { tono: Tono.SILLAR, H: archTop + lintelH + 1.4 });
  }

  // umbral de piedra
  const sill = new THREE.BoxGeometry(thick + 2.5, 0.35, span * 0.95);
  sill.rotateY(yaw);
  sill.translate(xM, 0.18, zM);
  k.put(sill, k.SILLAR, { tono: Tono.SILLAR, H: 0.35 });
}

/**
 * Puerto Real — dársena orgánica (sin caja celeste), muelles y flota.
 */
function puertoReal(ctx: Ctx, out: PuEntry[]) {
  const [cx, cy] = ctx.meta.plaza;
  const hPuerto = findHito(ctx, "puerto");
  const portX = hPuerto?.x ?? cx;
  const portY = hPuerto?.y ?? cy + ctx.meta.alto * 0.18;

  {
    const k = kit(ctx);
    k.epoca(0);
    k.lugar(portX, portY, 0, 1);

    // orilla de grava (el mar lo pinta el suelo del plano — sin malla AGUA que armaba el cuadrado celeste)
    const shore = bayRing(0, -28, 150, 36, 24);
    k.tapetePlano(shore, Pinta.GRANZA, { claro: 0.4, y: -0.12 });

    // muelles hacia el sur (+Z caja)
    k.caja(14, 1.2, 95, 0, 0, 48, k.PINTADO, { pinta: [Pinta.MADERA, 0.48], H: 1.2 });
    for (let z = 8; z <= 90; z += 12) {
      k.caja(13, 0.08, 0.35, 0, 1.2, z, k.PINTADO, { pinta: [Pinta.NEGRO, 0.22], H: 1.3 });
    }
    for (const z of [20, 50, 80]) {
      for (const x of [-5.5, 5.5]) {
        k.cilindro(0.4, 2.8, x, -1.5, z, k.PINTADO, 6, 0.35, { pinta: [Pinta.MADERA, 0.4] });
      }
    }

    k.caja(11, 1.1, 55, -42, 0, 40, k.PINTADO, { pinta: [Pinta.MADERA, 0.5], H: 1.1 });
    k.caja(12, 1.15, 70, 44, 0, 35, k.PINTADO, { pinta: [Pinta.MADERA, 0.46], H: 1.15 });

    // aduana / almacén en tierra (norte, −Z)
    k.caja(28, 8, 14, -22, 0.2, -28, k.PIEDRA, { tono: Tono.SILLAR, floors: 2, H: 8.2 });
    k.caja(30, 2.2, 9, -22, 8.2, -24, k.PINTADO, { pinta: [Pinta.LADRILLO, 0.4], H: 10.4 });
    k.caja(30, 2.2, 9, -22, 8.2, -32, k.PINTADO, { pinta: [Pinta.LADRILLO, 0.4], H: 10.4 });

    k.caja(22, 6, 12, 36, 0.2, -22, k.PINTADO, { pinta: [Pinta.MADERA, 0.48], floors: 1, H: 6.2 });
    k.caja(24, 2, 8, 36, 6.2, -18, k.PINTADO, { pinta: [Pinta.LADRILLO, 0.42], H: 8.2 });
    k.caja(24, 2, 8, 36, 6.2, -26, k.PINTADO, { pinta: [Pinta.LADRILLO, 0.42], H: 8.2 });

    push(out, k, "puertoMuelles");
  }

  {
    const k = kit(ctx);
    k.epoca(0);

    placeBarco(k, portX + 22, portY + 195, 0.12, 1, { tipo: "velero", L: 36 });
    placeBarco(k, portX - 48, portY + 175, -0.18, 1, { tipo: "velero", L: 42 });
    placeBarco(k, portX + 72, portY + 160, 0.32, 0.95, { tipo: "velero", L: 30 });

    placeBarco(k, portX + 38, portY + 125, 0.08, 1, { tipo: "velero", L: 22 });
    placeBarco(k, portX - 28, portY + 210, -0.22, 1, { tipo: "velero", L: 24 });

    placeBarco(k, portX - 14, portY + 105, 0.95, 0.2, { tipo: "bote", L: 9 });
    placeBarco(k, portX + 52, portY + 100, 0.9, 0.25, { tipo: "bote", L: 8 });
    placeBarco(k, portX - 78, portY + 140, 0.15, 1, { tipo: "chata", L: 16 });
    placeBarco(k, portX + 88, portY + 185, -0.35, 0.95, { tipo: "bote", L: 7 });
    placeBarco(k, portX + 6, portY + 148, 0.98, 0.12, { tipo: "bote", L: 10, vela: true });

    push(out, k, "puertoFlota");
  }
}

/** Anillo de bahía irregular en coords de Shape (Y → −Z mundo). */
function bayRing(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n = 24,
): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const wob =
      1 +
      0.12 * Math.sin(a * 2.3 + 0.4) +
      0.08 * Math.cos(a * 4.1) +
      0.05 * Math.sin(a * 7);
    return [cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob] as [number, number];
  });
}
