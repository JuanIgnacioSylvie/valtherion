import * as THREE from "three";
import type { PlanoMeta } from "../plano/types";
import { Tono } from "./CityMaterial";
import type { CityUniforms } from "./CityUniforms";
import { LandmarkKit, Pinta } from "./LandmarkKit";
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
 * Hitos de Aurion — piedra, almenas, madera y techos empinados.
 */
export class LandmarkMeshes {
  readonly group = new THREE.Group();
  private entries: Entry[] = [];
  private year = 1867;
  private lift = 0;
  private shared: CityUniforms | null = null;
  private meta: PlanoMeta;
  private hitos: HitoJson[];

  static async load(meta: PlanoMeta, _colorMode = 0): Promise<LandmarkMeshes | null> {
    try {
      const list = (await fetch("/datos/hoy.json").then((r) => r.json())) as HitoJson[];
      return new LandmarkMeshes(meta, list);
    } catch {
      return null;
    }
  }

  constructor(meta: PlanoMeta, hitos: HitoJson[]) {
    this.meta = meta;
    this.hitos = hitos;
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

  private find(kind: string): HitoJson | undefined {
    return this.hitos.find((h) => (h.kind ?? "").toLowerCase() === kind);
  }

  private buildAll() {
    if (!this.shared) return;
    const shared = this.shared;

    for (const e of buildPuPieces({
      meta: this.meta,
      shared,
      hitos: this.hitos,
      wallRx: this.meta.ancho * 0.3,
      wallRy: this.meta.alto * 0.34,
    })) {
      this.entries.push({ root: e.root, desde: e.desde, hasta: e.hasta });
      this.group.add(e.root);
    }

    this.addAlcazar(shared);
    this.addCatedral(shared);
    this.addMercado(shared);
    this.addPuertaNorte(shared);
  }

  private addAlcazar(shared: CityUniforms) {
    const h = this.find("alcazar");
    const [px, py] = h ? [h.x, h.y] : [this.meta.plaza[0] - 80, this.meta.plaza[1] - 40];
    const kit = new LandmarkKit(this.meta, shared);
    kit.lugar(px, py);

    // Lord's Keep a escala ciudad grande
    kit.caja(48, 4, 2, 0, 0, 20, kit.PIEDRA, { tono: Tono.SILLAR, H: 4 });
    kit.caja(48, 4, 2, 0, 0, -20, kit.PIEDRA, { tono: Tono.SILLAR, H: 4 });
    kit.caja(2, 4, 40, -24, 0, 0, kit.PIEDRA, { tono: Tono.SILLAR, H: 4 });
    kit.caja(2, 4, 40, 24, 0, 0, kit.PIEDRA, { tono: Tono.SILLAR, H: 4 });

    kit.caja(34, 11, 22, 0, 0, 0, kit.PIEDRA, { tono: Tono.SILLAR, floors: 2, H: 11 });
    kit.caja(38, 4, 12, 0, 11, -6, kit.PINTADO, { pinta: [Pinta.LADRILLO, 0.4], H: 15 });
    kit.caja(38, 4, 12, 0, 11, 6, kit.PINTADO, { pinta: [Pinta.LADRILLO, 0.4], H: 15 });

    kit.caja(12, 22, 12, -16, 0, -8, kit.PIEDRA, { tono: Tono.SILLAR, floors: 4, H: 22 });
    kit.caja(13.5, 1.1, 13.5, -16, 22, -8, kit.PIEDRA, { tono: Tono.SILLAR });
    for (const [dx, dz] of [
      [-4.5, -4.5],
      [4.5, -4.5],
      [-4.5, 4.5],
      [4.5, 4.5],
      [0, -5.2],
      [0, 5.2],
      [-5.2, 0],
      [5.2, 0],
    ] as [number, number][]) {
      kit.caja(1.8, 2.2, 1.8, -16 + dx, 23.1, -8 + dz, kit.PIEDRA, { tono: Tono.SILLAR });
    }

    kit.caja(8, 14, 8, 15, 0, 8, kit.PIEDRA, { tono: Tono.SILLAR, floors: 2, H: 14 });
    kit.caja(9.2, 0.9, 9.2, 15, 14, 8, kit.PIEDRA, { tono: Tono.SILLAR });

    kit.caja(9, 7, 4, 0, 0, 18, kit.PIEDRA, { tono: Tono.SILLAR, floors: 1, H: 7 });
    kit.arqueria(-3.5, 3.5, 1, 0, 5.5, 2.6, 4.5, Tono.SILLAR, 3.2, 1.1);
    kit.caja(6, 0.3, 10, 0, 1, 24, kit.PINTADO, { pinta: [Pinta.MADERA, 0.45], H: 1.3 });

    this.entries.push({ root: kit.build(), desde: 1867, hasta: 9999 });
    this.group.add(kit.group);
  }

  private addCatedral(shared: CityUniforms) {
    const h = this.find("catedral");
    const [px, py] = h ? [h.x, h.y] : [this.meta.plaza[0] + 90, this.meta.plaza[1] - 30];
    const kit = new LandmarkKit(this.meta, shared);
    kit.lugar(px, py);

    kit.caja(18, 12, 48, 0, 0, 0, kit.PIEDRA, { tono: Tono.SILLAR, floors: 2, H: 12 });
    kit.caja(34, 10, 14, 0, 0, -2, kit.PIEDRA, { tono: Tono.SILLAR, floors: 2, H: 10 });
    kit.cilindro(8, 10, 0, 0, -26, kit.PIEDRA, 10, 6.5, { tono: Tono.SILLAR, floors: 2, H: 10 });

    kit.caja(22, 3.2, 26, 0, 12, 8, kit.PINTADO, { pinta: [Pinta.NEGRO, 0.35], H: 15.2 });
    kit.caja(22, 3.2, 26, 0, 12, -8, kit.PINTADO, { pinta: [Pinta.NEGRO, 0.35], H: 15.2 });
    kit.caja(38, 2.6, 9, 0, 10, -2, kit.PINTADO, { pinta: [Pinta.NEGRO, 0.32], H: 12.6 });

    for (const z of [-16, -4, 8, 18]) {
      kit.caja(3, 9, 3.5, -11, 0, z, kit.PIEDRA, { tono: Tono.SILLAR, H: 9 });
      kit.caja(3, 9, 3.5, 11, 0, z, kit.PIEDRA, { tono: Tono.SILLAR, H: 9 });
    }

    kit.caja(10, 26, 10, -12, 0, 22, kit.PIEDRA, { tono: Tono.SILLAR, floors: 4, H: 26 });
    kit.caja(11.5, 1.2, 11.5, -12, 26, 22, kit.PIEDRA, { tono: Tono.SILLAR });
    const spire = new THREE.ConeGeometry(6, 14, 4);
    spire.translate(-12, 33, 22);
    kit.put(spire, kit.PINTADO, { pinta: [Pinta.NEGRO, 0.3], H: 40 });

    kit.arqueria(-6, 6, 3, 0, 7, 2, 5.2, Tono.SILLAR, 6, 1.2);

    this.entries.push({ root: kit.build(), desde: 1867, hasta: 9999 });
    this.group.add(kit.group);
  }

  private addMercado(shared: CityUniforms) {
    const h = this.find("mercado");
    const [px, py] = h ? [h.x, h.y] : [this.meta.plaza[0] - 150, this.meta.plaza[1] + 40];
    const kit = new LandmarkKit(this.meta, shared);
    kit.lugar(px, py);

    for (const x of [-18, -6, 6, 18]) {
      for (const z of [-7, 7]) {
        kit.cilindro(0.45, 5.5, x, 0, z, kit.PINTADO, 6, 0.4, { pinta: [Pinta.MADERA, 0.4] });
      }
    }
    kit.caja(46, 1, 18, 0, 5.5, 0, kit.PINTADO, { pinta: [Pinta.MADERA, 0.5], H: 6.5 });
    kit.caja(48, 2.4, 10, 0, 6.5, -4, kit.PINTADO, { pinta: [Pinta.LADRILLO, 0.42], H: 8.9 });
    kit.caja(48, 2.4, 10, 0, 6.5, 4, kit.PINTADO, { pinta: [Pinta.LADRILLO, 0.42], H: 8.9 });

    for (let i = -2; i <= 2; i++) {
      kit.caja(5.5, 2, 4, i * 7.5, 0.1, 14, kit.PINTADO, { pinta: [Pinta.LONA, 0.7], H: 2.1 });
      kit.caja(0.18, 2.6, 0.18, i * 7.5 - 2, 0, 14, kit.PINTADO, { pinta: [Pinta.MADERA, 0.35] });
      kit.caja(0.18, 2.6, 0.18, i * 7.5 + 2, 0, 14, kit.PINTADO, { pinta: [Pinta.MADERA, 0.35] });
    }

    this.entries.push({ root: kit.build(), desde: 1867, hasta: 9999 });
    this.group.add(kit.group);
  }

  private addPuertaNorte(shared: CityUniforms) {
    const h = this.find("puerta");
    if (!h) return;
    const kit = new LandmarkKit(this.meta, shared);
    kit.lugar(h.x, h.y);

    // arco entre las torres de la muralla (las torres las pone PuBuilders)
    kit.caja(10, 3.2, 6, 0, 7.2, 0, kit.SILLAR, { tono: Tono.SILLAR, H: 10.4 });
    kit.arqueria(-5, 5, 1, 0, 7.2, 2.8, 6.2, Tono.SILLAR, 5.2, 1.2);
    kit.caja(14, 0.5, 7, 0, 10.4, 0, kit.SILLAR, { tono: Tono.SILLAR, H: 10.9 });

    this.entries.push({ root: kit.build(), desde: 1867, hasta: 9999 });
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
