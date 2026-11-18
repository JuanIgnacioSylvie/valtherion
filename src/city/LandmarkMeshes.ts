import * as THREE from "three";
import type { PlanoMeta } from "../plano/types";
import { Tono } from "./CityMaterial";
import type { CityUniforms } from "./CityUniforms";
import { buildFlMeshes, loadFlCatalog, type FlBuilding } from "./FlCatalog";
import { LandmarkKit } from "./LandmarkKit";
import { buildPuPieces } from "./pu/PuBuilders";

type HitoJson = {
  nombre: string;
  x: number;
  y: number;
  kind?: string;
  desde?: number;
  hasta?: number;
};

type Entry = {
  root: THREE.Object3D;
  desde: number;
  hasta: number;
};

/**
 * Hitos con shader PIEDRA/TINTA/SILLAR + catálogo Fl + builders pu.
 */
export class LandmarkMeshes {
  readonly group = new THREE.Group();
  private entries: Entry[] = [];
  private year = 1867;
  private lift = 0;
  private shared: CityUniforms | null = null;
  private meta: PlanoMeta;
  private hitos: HitoJson[];
  private fl: FlBuilding[];

  static async load(meta: PlanoMeta, _colorMode = 0): Promise<LandmarkMeshes | null> {
    try {
      const [list, fl] = await Promise.all([
        fetch("/datos/hoy.json").then((r) => r.json()) as Promise<HitoJson[]>,
        loadFlCatalog().catch(() => [] as FlBuilding[]),
      ]);
      return new LandmarkMeshes(meta, list, fl);
    } catch {
      return null;
    }
  }

  constructor(meta: PlanoMeta, hitos: HitoJson[], fl: FlBuilding[] = []) {
    this.meta = meta;
    this.hitos = hitos;
    this.fl = fl;
    this.group.visible = false;
  }

  bindShared(shared: CityUniforms) {
    this.shared = shared;
    while (this.group.children.length) this.group.remove(this.group.children[0]!);
    this.entries = [];
    this.buildAll();
    this.group.renderOrder = 3;
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.renderOrder = 3;
        const m = o.material as THREE.MeshStandardMaterial;
        if (m) {
          m.polygonOffset = true;
          m.polygonOffsetFactor = -2;
          m.polygonOffsetUnits = -2;
          m.needsUpdate = true;
        }
      }
    });
    this.setYear(this.year);
  }

  private buildAll() {
    if (!this.shared) return;
    const shared = this.shared;

    for (const e of buildPuPieces({ meta: this.meta, shared })) {
      this.entries.push({ root: e.root, desde: e.desde, hasta: e.hasta });
      this.group.add(e.root);
    }

    this.addCabildo(shared, 1867, 1888, "colonial");
    this.addCabildo(shared, 1888, 1895, "benoit");
    this.addCabildo(shared, 1895, 1940, "sinTorre");
    this.addCabildo(shared, 1940, 9999, "restaurado");

    // Catedral
    {
      const kit = new LandmarkKit(this.meta, shared);
      kit.lugar(10497, 9445);
      kit.caja(48, 18, 28, 0, 0, 0, kit.PIEDRA, { tono: Tono.CREMA, floors: 3, H: 18 });
      kit.caja(52, 2.2, 32, 0, 18, 0, kit.PIEDRA, { tono: Tono.CREMA });
      for (let i = -5; i <= 5; i++) {
        kit.cilindro(0.9, 14, i * 3.6, 0, 15, kit.PIEDRA, 8, 0.85, { tono: Tono.BLANCO });
      }
      kit.caja(42, 2.4, 4, 0, 14, 15, kit.PIEDRA, { tono: Tono.CREMA });
      const tri = new THREE.ConeGeometry(12, 6, 3);
      tri.rotateY(Math.PI / 6);
      tri.translate(0, 20, 14);
      kit.put(tri, kit.PIEDRA, { tono: Tono.CREMA });
      this.entries.push({ root: kit.build(), desde: 1867, hasta: 9999 });
      this.group.add(kit.group);
    }

    // Recova — eras (divide Plaza Victoria / 25 de Mayo hasta 1884/88)
    {
      const kit = new LandmarkKit(this.meta, shared);
      kit.epoca(0, 1);
      kit.lugar(10336, 9594);
      kit.caja(72, 7.5, 11, 0, 0, 0, kit.PIEDRA, { tono: Tono.SILLAR, floors: 1, H: 7.5 });
      kit.arqueria(-36, 36, 13, 0, 7.5, 2.1, 5.4, Tono.SILLAR, 11, 1.4);
      kit.caja(74, 0.5, 12, 0, 7.5, 0, kit.PIEDRA, { tono: Tono.SILLAR });
      // faroles / remates
      for (const x of [-30, -10, 10, 30]) {
        kit.cilindro(0.35, 2.2, x, 7.5, 0, kit.PIEDRA, 6, 0.3, { tono: Tono.CREMA });
      }
      this.entries.push({ root: kit.build(), desde: 1867, hasta: 1888 });
      this.group.add(kit.group);
    }
    // Recova residual / Mercado hasta demolición plena ~1894
    {
      const kit = new LandmarkKit(this.meta, shared);
      kit.epoca(1, 2);
      kit.lugar(10336, 9594);
      kit.caja(40, 6.5, 10, 0, 0, 0, kit.PIEDRA, { tono: Tono.SILLAR, floors: 1, H: 6.5 });
      kit.arqueria(-20, 20, 7, 0, 6.5, 2.0, 4.8, Tono.SILLAR, 10, 1.2);
      this.entries.push({ root: kit.build(), desde: 1888, hasta: 1895 });
      this.group.add(kit.group);
    }

    // Aduana Taylor (hemiciclo)
    {
      const kit = new LandmarkKit(this.meta, shared);
      kit.lugar(10337, 9960);
      const shape = new THREE.Shape();
      shape.absarc(0, 0, 22, 0, Math.PI, false);
      shape.lineTo(-22, 0);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 14, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      kit.put(geo, kit.PIEDRA, { tono: Tono.SILLAR, H: 14, floors: 2 });
      this.entries.push({ root: kit.build(), desde: 1867, hasta: 1895 });
      this.group.add(kit.group);
    }

    // Obelisco
    {
      const kit = new LandmarkKit(this.meta, shared);
      kit.lugar(11195, 8373);
      kit.caja(12, 2.2, 12, 0, 0, 0, kit.PIEDRA, { tono: Tono.BLANCO });
      const shaft = new THREE.CylinderGeometry(2.0, 3.4, 67.5, 4);
      shaft.translate(0, 33.75, 0);
      kit.put(shaft, kit.PIEDRA, { tono: Tono.BLANCO, H: 67, floors: 0 });
      this.entries.push({ root: kit.build(), desde: 1940, hasta: 9999 });
      this.group.add(kit.group);
    }

    // Catálogo Fl (~40 edificios con planta)
    const skipFl = new Set(["retiro"]); // estación a mano en pu
    for (const e of buildFlMeshes(this.meta, shared, this.fl.filter((b) => !skipFl.has(b.key)))) {
      this.entries.push({ root: e.root, desde: e.desde, hasta: e.hasta });
      this.group.add(e.root);
    }

    // Fuerte / gobierno pre-Rosada
    {
      const kit = new LandmarkKit(this.meta, shared);
      kit.lugar(10334, 9830);
      kit.caja(42, 14, 28, 0, 0, 0, kit.PIEDRA, { tono: Tono.ROSA, floors: 2, H: 14 });
      kit.caja(16, 10, 16, 0, 14, 0, kit.PIEDRA, { tono: Tono.ROSA });
      this.entries.push({ root: kit.build(), desde: 1867, hasta: 1898 });
      this.group.add(kit.group);
    }

    // Teatro Colón plaza (viejo, pre-1908)
    for (const h of this.hitos) {
      if ((h.kind ?? guessKind(h.nombre)) !== "teatro") continue;
      if ((h.desde ?? 1867) >= 1908) continue;
      const kit = new LandmarkKit(this.meta, shared);
      kit.lugar(h.x, h.y);
      kit.caja(36, 18, 28, 0, 0, 0, kit.PIEDRA, { tono: Tono.CREMA, floors: 3, H: 18 });
      kit.cilindro(5, 14, 0, 9, -8, kit.PIEDRA, 10, 5, { tono: Tono.CREMA });
      this.entries.push({
        root: kit.build(),
        desde: h.desde ?? 1867,
        hasta: Math.min(h.hasta ?? 1908, 1908),
      });
      this.group.add(kit.group);
    }
  }

  private addCabildo(
    shared: CityUniforms,
    desde: number,
    hasta: number,
    variant: "colonial" | "benoit" | "sinTorre" | "restaurado",
  ) {
    const kit = new LandmarkKit(this.meta, shared);
    kit.lugar(10294, 9358);
    const W = 94;
    const D = 15.5;
    const H = 11.2;
    const archH = 5.6;
    const f = 10.4;
    const tono = variant === "restaurado" || variant === "sinTorre" ? Tono.SILLAR : Tono.BLANCO;

    const arches = variant === "colonial" || variant === "benoit" ? 11 : 5;
    const x0 =
      variant === "sinTorre" || variant === "restaurado" ? -f / 2 - ((W - f) / 10) * 5 : -W / 2 + 5.2;
    const x1 =
      variant === "sinTorre" || variant === "restaurado"
        ? f / 2 + ((W - f) / 10) * 2
        : W / 2 - 5.2;

    if (variant === "colonial" || variant === "benoit") {
      kit.caja(W, H, D, 0, 0, D / 2 - 0.2, kit.PIEDRA, { tono, floors: 2, H });
      kit.arqueria(-W / 2 + 5.2, W / 2 - 5.2, 11, 0, archH + 0.2, 3.5, 4.5, tono, D, 1.5);
      kit.caja(W + 1.2, 0.55, D + 1.6, 0, H, D / 2, kit.PIEDRA, { tono });
    } else {
      const span = f + ((W - f) / 10) * 5 + ((W - f) / 10) * 2;
      kit.caja(span, H, D, (x0 + x1) / 2, 0, D / 2 - 0.2, kit.SILLAR, { tono, floors: 2, H });
      kit.arqueria(x0, x1, arches, 0, archH + 0.2, 3.4, 4.6, tono, D, 1.5);
      kit.caja(span + 0.6, 0.55, D + 1.2, (x0 + x1) / 2, H, D / 2, kit.SILLAR, { tono });
    }

    if (variant !== "sinTorre") {
      const towerH = variant === "benoit" ? 28 : 22;
      const tw = variant === "restaurado" ? 9 : 10.5;
      const tz = variant === "restaurado" ? 11.6 : D / 2;
      kit.caja(tw, towerH, tw, 0, H, tz, variant === "restaurado" ? kit.SILLAR : kit.PIEDRA, {
        tono,
        floors: 4,
        H: H + towerH,
      });
      kit.caja(tw + 1.2, 0.6, tw + 1.2, 0, H + towerH, tz, kit.PIEDRA, { tono });
      kit.cilindro(tw * 0.28, 3.2, 0, H + towerH, tz, kit.PIEDRA, 8, tw * 0.28, { tono });
      const dome = new THREE.SphereGeometry(tw * 0.32, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      dome.translate(0, H + towerH + 3.2, tz);
      kit.put(dome, kit.PIEDRA, { tono });
      kit.cilindro(0.12, 3.5, 0, H + towerH + 4.5, tz, kit.TINTA, 6, 0.12, {});
    }

    this.entries.push({ root: kit.build(), desde, hasta });
    this.group.add(kit.group);
  }

  setYear(year: number) {
    this.year = year;
    for (const e of this.entries) {
      e.root.visible = year >= e.desde && year < e.hasta && this.lift > 0.05;
    }
  }

  setLift(t: number) {
    this.lift = t;
    this.group.visible = t > 0.05;
    this.group.scale.set(1, Math.max(0.05, t), 1);
    this.setYear(this.year);
  }

  setColorMode(c: number) {
    this.shared?.setColor(c);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mat = o.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  }
}

function guessKind(nombre: string): string | null {
  const n = nombre.toLowerCase();
  if (n.includes("cabildo")) return "cabildo";
  if (n.includes("catedral")) return "catedral";
  if (n.includes("teatro") || n.includes("colón") || n.includes("colon")) return "teatro";
  return null;
}
