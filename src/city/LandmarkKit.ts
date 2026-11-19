import * as THREE from "three";
import { pxToWorld } from "../plano/coords";
import type { PlanoMeta } from "../plano/types";
import { makeCityMaterial, seedConTono, Tono } from "./CityMaterial";
import type { CityUniforms } from "./CityUniforms";

export type PutOpts = {
  tono?: number;
  floors?: number;
  H?: number;
  /** [pintaId, claro] — materiales de suelo/plaza (CESPED, ADOQUIN…) */
  pinta?: [number, number];
  claro?: number;
  y?: number;
};

/** Paleta PINTA del original (mu). */
export const Pinta = {
  MADERA: 0,
  VERDE: 1,
  BRONCE: 2,
  ROJO: 3,
  OCRE: 4,
  LONA: 5,
  BALASTO: 6,
  CESPED: 7,
  AGUA: 8,
  BALDOSA: 9,
  GRANZA: 10,
  ADOQUIN: 11,
  FLORES: 12,
  ASFALTO: 13,
  CHAPA: 14,
  NEGRO: 15,
  BLANCO: 16,
  LADRILLO: 17,
  PATINA: 18,
  COBRE: 19,
} as const;

const YEARS = [1867, 1888, 1895, 1905, 1910, 1921, 1940];

/**
 * Kit de construcción de hitos / piezas pu (lugar/caja/tapete/prisma…).
 */
export class LandmarkKit {
  readonly group = new THREE.Group();
  private meta: PlanoMeta;
  private pos: number[] = [];
  private nor: number[] = [];
  private info: number[] = [];
  private wall: number[] = [];
  private ancla: number[] = [];
  private estilo: number[] = [];
  private idx: number[] = [];
  ox = 0;
  oz = 0;
  ax = 0;
  az = 0;
  private ux = 1;
  private uz = 0;
  private epocaFrom = 0;
  private epocaTo = 8;
  private mesh: THREE.Mesh | null = null;
  private mat: THREE.MeshStandardMaterial;

  readonly PIEDRA: "PIEDRA" = "PIEDRA";
  readonly TINTA: "TINTA" = "TINTA";
  readonly SILLAR: "SILLAR" = "SILLAR";
  readonly CASA: "CASA" = "CASA";
  readonly PIZARRA: "PIZARRA" = "PIZARRA";
  readonly PINTADO: "PINTADO" = "PINTADO";
  readonly FOLLAJE: "FOLLAJE" = "FOLLAJE";
  readonly PINTA = { ...Pinta, ...{ CREMA: Tono.CREMA, ROSA: Tono.ROSA, GRIS: Tono.GRIS, SILLAR_TONO: Tono.SILLAR } };
  readonly BLANCO = Tono.BLANCO;
  readonly CREMA = Tono.CREMA;
  readonly ROSA = Tono.ROSA;
  readonly GRIS = Tono.GRIS;
  readonly LADRILLO = Tono.LADRILLO;
  readonly SILLAR_TONO = Tono.SILLAR;

  constructor(meta: PlanoMeta, shared: CityUniforms) {
    this.meta = meta;
    this.mat = makeCityMaterial(shared, { manto: 1 });
  }

  /** Índice de etapa en la que “llegó” un año (primera época ≥ año). */
  etapaDe(año: number) {
    for (let i = 0; i < YEARS.length; i++) {
      if ((YEARS[i] ?? 9999) >= año) return i;
    }
    return YEARS.length - 1;
  }

  yearRange(): { desde: number; hasta: number } {
    const desde = YEARS[this.epocaFrom] ?? 1867;
    const hasta =
      this.epocaTo >= YEARS.length || this.epocaTo <= this.epocaFrom
        ? 9999
        : (YEARS[this.epocaTo] ?? 9999);
    return { desde, hasta };
  }

  m(v: number) {
    return v;
  }

  /**
   * Ancla local. ux,uz = orientación forward (opcional).
   */
  lugar(px: number, py: number, ux = 1, uz = 0) {
    const [x, z] = pxToWorld(this.meta, px, py);
    this.ox = x;
    this.oz = z;
    this.ax = x;
    this.az = z;
    const len = Math.hypot(ux, uz) || 1;
    this.ux = ux / len;
    this.uz = uz / len;
    return this;
  }

  /** World local (+forward*ux, +right). */
  local(fwd: number, right = 0): [number, number] {
    const rx = -this.uz;
    const rz = this.ux;
    return [fwd * this.ux + right * rx, fwd * this.uz + right * rz];
  }

  epoca(from = 0, to = 8) {
    this.epocaFrom = from;
    this.epocaTo = to;
  }

  private seedFor(matKind: string, tono: number = Tono.SILLAR) {
    if (matKind === "TINTA") return seedConTono(Tono.GRIS, 0.2);
    if (matKind === "PIZARRA") return seedConTono(Tono.GRIS, 0.55);
    if (matKind === "CASA") return seedConTono(Tono.CREMA, 0.4);
    if (matKind === "FOLLAJE") return seedConTono(Tono.LADRILLO, 0.2);
    if (matKind === "PINTADO") return seedConTono(tono > 5 ? Tono.GRIS : tono, 0.5);
    return seedConTono(tono, 0.37);
  }

  private kindFor(matKind: string, floors: number, pinta?: number) {
    // kind = floor(aInfo.y/10): 1 muro tipológico (vanos) · 3 techo · 5 árbol ·
    // 8 pizarra/sillar macizo (sin ventanas) · 9 pintado (PINTA)
    if (matKind === "FOLLAJE") return 50;
    if (pinta != null || matKind === "PINTADO") return 90 + Math.max(1, floors);
    if (matKind === "TINTA") return 10 + Math.max(1, floors);
    // cortinas / torres: piedra lisa, sin paños de casa
    if (matKind === "PIZARRA" || matKind === "SILLAR") return 80 + Math.max(1, floors);
    return 10 + Math.max(1, floors);
  }

  caja(
    sx: number,
    sy: number,
    sz: number,
    x: number,
    y: number,
    z: number,
    matKind: string = this.PIEDRA,
    opts: PutOpts = {},
  ) {
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    geo.translate(x, y + sy / 2, z);
    this.put(geo, matKind, opts);
  }

  cilindro(
    r: number,
    h: number,
    x: number,
    y: number,
    z: number,
    matKind: string = this.PIEDRA,
    seg = 8,
    rTop = r,
    opts: PutOpts = {},
  ) {
    const geo = new THREE.CylinderGeometry(rTop, r, h, seg);
    geo.translate(x, y + h / 2, z);
    this.put(geo, matKind, opts);
  }

  piramide(r: number, h: number, x: number, y: number, z: number, matKind: string, seg = 4) {
    const geo = new THREE.ConeGeometry(r, h, seg);
    geo.translate(x, y + h / 2, z);
    this.put(geo, matKind, {});
  }

  /** Plano horizontal de suelo/plaza (baldosa, césped, adoquín…). */
  tapete(
    ring: [number, number][],
    pintaId: number,
    opts: { y?: number; claro?: number; alto?: number } = {},
  ) {
    if (ring.length < 3) return;
    const shape = new THREE.Shape();
    shape.moveTo(ring[0]![0], ring[0]![1]);
    for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i]![0], ring[i]![1]);
    shape.closePath();
    const h = opts.alto ?? 0.12;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, opts.y ?? 0, 0);
    this.put(geo, this.PINTADO, { pinta: [pintaId, opts.claro ?? 0.7], H: h, floors: 1 });
  }

  /** Rectángulo axis-aligned en local. */
  recto(w: number, d: number, cx = 0, cz = 0): [number, number][] {
    const hw = w / 2;
    const hd = d / 2;
    return [
      [cx - hw, cz - hd],
      [cx + hw, cz - hd],
      [cx + hw, cz + hd],
      [cx - hw, cz + hd],
    ];
  }

  ovalo(cx: number, cz: number, rx: number, rz: number, n = 16): [number, number][] {
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return [cx + Math.cos(a) * rx, cz + Math.sin(a) * rz] as [number, number];
    });
  }

  /** Cantero: tierra/césped bajo con cordón (alto chico para que no “flote”). */
  cantero(
    ring: [number, number][],
    opts: { alto?: number; cordon?: number; tono?: number; claro?: number } = {},
  ) {
    const alto = Math.min(opts.alto ?? 0.22, 0.28);
    // default: granza/tierra de patio; CESPED solo si lo piden explícito
    this.tapete(ring, opts.tono ?? Pinta.GRANZA, {
      y: 0.01,
      alto,
      claro: opts.claro ?? 0.62,
    });
    if (opts.cordon && opts.cordon > 0) {
      // cordón simplificado: caja perimetral baja
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i]!;
        const b = ring[(i + 1) % ring.length]!;
        const mx = (a[0] + b[0]) / 2;
        const mz = (a[1] + b[1]) / 2;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
        const geo = new THREE.BoxGeometry(opts.cordon, alto + 0.08, len);
        geo.rotateY(yaw);
        geo.translate(mx, (alto + 0.08) / 2, mz);
        this.put(geo, this.PIEDRA, { tono: Tono.CREMA, H: alto });
      }
    }
  }

  /** Prisma extruido desde anillo xz. */
  prisma(
    ring: [number, number][],
    h: number,
    y0: number,
    matKind: string = this.PIEDRA,
    opts: PutOpts = {},
  ) {
    if (ring.length < 3) return;
    const shape = new THREE.Shape();
    shape.moveTo(ring[0]![0], ring[0]![1]);
    for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i]![0], ring[i]![1]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, y0, 0);
    this.put(geo, matKind, { ...opts, H: y0 + h });
  }

  arbol(x: number, z: number, r = 1.5) {
    // ancla en el pie del árbol (no en el hito) para que el relieve no lo deje flotando
    const prevAx = this.ax;
    const prevAz = this.az;
    this.ax = this.ox + x;
    this.az = this.oz + z;
    this.cilindro(r * 0.12, r * 1.1, x, 0, z, this.PINTADO, 6, r * 0.1, {
      pinta: [Pinta.MADERA, 0.5],
    });
    const crown = new THREE.IcosahedronGeometry(r * 0.85, 0);
    crown.translate(x, r * 1.35, z);
    this.put(crown, this.FOLLAJE, { pinta: [Pinta.CESPED, 0.7], H: r * 2 });
    this.ax = prevAx;
    this.az = prevAz;
  }

  vano(w: number, h: number, x: number, y: number, z: number, face: string) {
    // hueco simbólico: plano TINTA
    const geo = new THREE.PlaneGeometry(w, h);
    if (face === "+z") geo.translate(x, y + h / 2, z);
    else if (face === "-z") {
      geo.rotateY(Math.PI);
      geo.translate(x, y + h / 2, z);
    } else if (face === "+x") {
      geo.rotateY(-Math.PI / 2);
      geo.translate(x, y + h / 2, z);
    } else {
      geo.rotateY(Math.PI / 2);
      geo.translate(x, y + h / 2, z);
    }
    this.put(geo, this.TINTA, { H: y + h });
  }

  fila(
    n: number,
    x0: number,
    x1: number,
    w: number,
    h: number,
    y: number,
    z: number,
    face: string,
  ) {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * t;
      this.vano(w, h, x, y, z, face);
    }
  }

  pilares(
    n: number,
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    h: number,
    r: number,
    y0 = 0,
  ) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      this.cilindro(r, h, x, y0, z, this.PIEDRA, 8, r * 0.92, { tono: Tono.CREMA, H: y0 + h });
    }
  }

  /** Arquería frontal. */
  arqueria(
    x0: number,
    x1: number,
    arches: number,
    y0: number,
    wallH: number,
    pillarW: number,
    archR: number,
    tono: number,
    depth = 15.5,
    thick = 1.5,
  ) {
    const shape = new THREE.Shape();
    const span = x1 - x0;
    const step = span / arches;
    shape.moveTo(x0, 0);
    for (let i = 0; i < arches; i++) {
      const cx = x0 + (i + 0.5) * step;
      shape.lineTo(cx - pillarW / 2, 0);
      shape.lineTo(cx - pillarW / 2, archR - pillarW / 2);
      shape.absarc(cx, archR - pillarW / 2, pillarW / 2, Math.PI, 0, true);
      shape.lineTo(cx + pillarW / 2, 0);
    }
    shape.lineTo(x1, 0);
    shape.lineTo(x1, wallH);
    shape.lineTo(x0, wallH);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thick,
      bevelEnabled: false,
      curveSegments: 4,
    });
    geo.translate(0, y0, depth / 2 - thick);
    this.put(geo, this.PIEDRA, { tono, H: y0 + wallH });
    const plane = new THREE.PlaneGeometry(span - 0.3, archR);
    plane.translate((x0 + x1) / 2, y0 + archR / 2, depth / 2 - thick + 0.05);
    this.put(plane, this.TINTA, { tono: Tono.GRIS });
  }

  put(geo: THREE.BufferGeometry, matKind: string, opts: PutOpts = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    const nor = g.getAttribute("normal") as THREE.BufferAttribute;
    const pintaId = opts.pinta?.[0];
    const tono = opts.tono ?? (pintaId != null ? Tono.GRIS : Tono.SILLAR);
    const floors = opts.floors ?? Math.max(1, Math.round((opts.H ?? 8) / 3.3));
    const seed = this.seedFor(matKind, tono);
    const kind = this.kindFor(matKind, floors, pintaId);
    const { desde: _d } = this.yearRange();
    void _d;
    const dist =
      Math.hypot(this.ox, this.oz) +
      (this.epocaFrom + 8 * (this.epocaTo >= 8 ? 0 : this.epocaTo)) * 20000;

    // PINTA: aWall.z = id material, aWall.w = claro (0..1) — en tinta el shader usa .w
    // como mezcla tinta/papel. Sin esto, .w quedaba en H y los tapetes salían blancos/rotos.
    const claro = opts.pinta?.[1] ?? opts.claro ?? 0.7;
    const wallZ = pintaId != null ? pintaId : Math.max(4, opts.H ?? 8);
    const wallW = pintaId != null ? claro : Math.max(4, opts.H ?? 8);

    const base = this.pos.length / 3;
    for (let i = 0; i < pos.count; i++) {
      this.pos.push(pos.getX(i) + this.ox, pos.getY(i), pos.getZ(i) + this.oz);
      this.nor.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      this.info.push(seed, kind, opts.H ?? pos.getY(i) + 1, dist);
      this.wall.push(Math.abs(pos.getX(i)), Math.abs(pos.getY(i)), wallZ, wallW);
      this.ancla.push(this.ax, this.az, 1);
      this.estilo.push(0);
    }
    for (let i = 0; i < pos.count; i += 3) {
      this.idx.push(base + i, base + i + 1, base + i + 2);
    }
    g.dispose();
  }

  build(): THREE.Group {
    if (!this.pos.length) {
      this.group.visible = false;
      return this.group;
    }
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute("aInfo", new THREE.Float32BufferAttribute(this.info, 4));
    geo.setAttribute("aWall", new THREE.Float32BufferAttribute(this.wall, 4));
    geo.setAttribute("aAncla", new THREE.Float32BufferAttribute(this.ancla, 3));
    geo.setAttribute("aEstilo", new THREE.Float32BufferAttribute(this.estilo, 1));
    if (this.idx.length) geo.setIndex(this.idx);
    geo.computeBoundingSphere();
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    return this.group;
  }

  /** Reinicia buffers para reutilizar el kit en otra pieza/época. */
  resetBuffers() {
    this.pos = [];
    this.nor = [];
    this.info = [];
    this.wall = [];
    this.ancla = [];
    this.estilo = [];
    this.idx = [];
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
  }
}

export { Tono, seedConTono, YEARS };
