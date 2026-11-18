import * as THREE from "three";
import type { PlanoMeta } from "../../plano/types";
import type { CityUniforms } from "../CityUniforms";
import { LandmarkKit, Pinta, Tono, YEARS } from "../LandmarkKit";

export type PuEntry = {
  root: THREE.Object3D;
  desde: number;
  hasta: number;
  name: string;
};

type Ctx = { meta: PlanoMeta; shared: CityUniforms };

function kit(ctx: Ctx) {
  return new LandmarkKit(ctx.meta, ctx.shared);
}

function push(out: PuEntry[], k: LandmarkKit, name: string) {
  const { desde, hasta } = k.yearRange();
  const root = k.build();
  if (root.children.length) out.push({ root, desde, hasta, name });
}

/** Piezas urbanísticas del original (pu): plazas, avenidas, puerto, subte, retiro… */
export function buildPuPieces(ctx: Ctx): PuEntry[] {
  const out: PuEntry[] = [];
  plazaDeMayo(ctx, out);
  plazaCongreso(ctx, out);
  plazaSanMartin(ctx, out);
  plazaLavalle(ctx, out);
  plazaConstitucion(ctx, out);
  plazaOnce(ctx, out);
  avenidaDeMayo(ctx, out);
  nueveDeJulio(ctx, out);
  diagonalNorte(ctx, out);
  puerto(ctx, out);
  puertoMadero(ctx, out);
  puertoNuevo(ctx, out);
  retiro(ctx, out);
  playasRetiro(ctx, out);
  viejos1867(ctx, out);
  modernos(ctx, out);
  subteA(ctx, out);
  obeliscoEntorno(ctx, out);
  return out;
}

/** Plaza de Mayo / Victoria — pirámide, pavimento, canteros por época. */
function plazaDeMayo(ctx: Ctx, out: PuEntry[]) {
  // 1867–1888: Plaza de la Victoria — sin tapete full (deja ver el grabado en tinta)
  {
    const k = kit(ctx);
    k.epoca(0, 1);
    k.lugar(10344, 9484, 1, 0);
    k.piramide(4.2, 12.5, 0, 0.1, 0, k.PIEDRA, 4);
    k.caja(6.5, 0.7, 6.5, 0, 0.1, 0, k.PIEDRA, { tono: Tono.CREMA });
    k.cantero(k.ovalo(0, 0, 9, 9, 20), { alto: 0.4, cordon: 0.35, claro: 0.55 });
    // caminos cruzados (sí se leen en tinta; claro < 1 = gris)
    k.tapete(
      [
        [-3.5, -58],
        [3.5, -58],
        [3.5, 58],
        [-3.5, 58],
      ],
      Pinta.BALDOSA,
      { claro: 0.72, alto: 0.1, y: 0.02 },
    );
    k.tapete(
      [
        [-58, -3.5],
        [58, -3.5],
        [58, 3.5],
        [-58, 3.5],
      ],
      Pinta.BALDOSA,
      { claro: 0.72, alto: 0.1, y: 0.02 },
    );
    // canteros de esquina
    for (const [x, z] of [
      [-32, -32],
      [32, -32],
      [-32, 32],
      [32, 32],
    ] as [number, number][]) {
      k.cantero(k.ovalo(x, z, 10, 10, 14), { alto: 0.35, cordon: 0.28, claro: 0.5 });
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      k.arbol(Math.cos(a) * 38, Math.sin(a) * 38, 2.2);
    }
    for (const [x, z] of [
      [-40, -40],
      [40, -40],
      [-40, 40],
      [40, 40],
    ] as [number, number][]) {
      k.cilindro(0.12, 4.8, x, 0.1, z, k.TINTA, 6, 0.1, {});
      k.caja(0.4, 0.3, 0.4, x, 4.9, z, k.PINTADO, { pinta: [Pinta.NEGRO, 0.25] });
    }
    push(out, k, "plazaVictoria");
  }
  // 1888-1921: unidas — sin losa full (el grabado queda a la vista en tinta)
  {
    const k = kit(ctx);
    k.epoca(1, 5);
    k.lugar(10340, 9560, 1, 0);
    k.piramide(4.2, 12.5, 0, 0.1, -35, k.PIEDRA, 4);
    k.caja(6.5, 0.7, 6.5, 0, 0.1, -35, k.PIEDRA, { tono: Tono.CREMA });
    k.cantero(k.ovalo(0, 20, 22, 14, 24), { alto: 0.45, cordon: 0.4, tono: Pinta.CESPED, claro: 0.55 });
    k.cantero(k.ovalo(0, -55, 18, 12, 20), { alto: 0.4, cordon: 0.35, claro: 0.55 });
    k.tapete(k.recto(8, 200, 0, -20), Pinta.BALDOSA, { claro: 0.7, alto: 0.1, y: 0.02 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      k.arbol(Math.cos(a) * 55, Math.sin(a) * 80, 2.4);
    }
    push(out, k, "plazaMayo1888");
  }
  // 1921+: reforma
  {
    const k = kit(ctx);
    k.epoca(5);
    k.lugar(10344, 9645, 1, 0);
    k.piramide(4.2, 12.5, 0, 0.1, -40, k.PIEDRA, 4);
    k.cantero(k.ovalo(0, 10, 28, 16, 24), { alto: 0.5, cordon: 0.45, tono: Pinta.CESPED, claro: 0.55 });
    k.cilindro(6, 0.6, 0, 0.1, 55, k.PIEDRA, 16, 6, { tono: Tono.CREMA });
    k.tapete(k.ovalo(0, 55, 5.2, 5.2, 16), Pinta.AGUA, { y: 0.55, alto: 0.35, claro: 0.45 });
    k.tapete(k.recto(10, 220, 0, -10), Pinta.BALDOSA, { claro: 0.7, alto: 0.1, y: 0.02 });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      k.arbol(Math.cos(a) * 60, Math.sin(a) * 90, 2.6);
    }
    push(out, k, "plazaMayo1921");
  }
}

function plazaCongreso(ctx: Ctx, out: PuEntry[]) {
  const k = kit(ctx);
  k.epoca(3); // ~1910
  k.lugar(10329, 7160, 1, 0);
  k.tapete(k.recto(180, 220), Pinta.BALDOSA, { claro: 0.8, alto: 0.1 });
  k.cantero(k.ovalo(0, 0, 35, 50, 28), { alto: 0.5, cordon: 0.45 });
  k.cantero(k.ovalo(0, -70, 22, 18, 20), { alto: 0.4, cordon: 0.35, tono: Pinta.CESPED });
  // monumento Dos Congresos (simplificado)
  k.caja(14, 8, 14, 0, 0.1, 0, k.PIEDRA, { tono: Tono.CREMA, floors: 1, H: 8 });
  k.cilindro(3.5, 12, 0, 8, 0, k.PIEDRA, 12, 2.5, { tono: Tono.CREMA });
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    k.arbol(Math.cos(a) * 70, Math.sin(a) * 85, 2.8);
  }
  push(out, k, "plazaCongreso");
}

function plazaSanMartin(ctx: Ctx, out: PuEntry[]) {
  const k = kit(ctx);
  k.epoca(1);
  k.lugar(12512, 9112, 0.62, -0.78);
  k.tapete(k.recto(160, 140), Pinta.BALDOSA, { claro: 0.78, alto: 0.1 });
  k.cantero(k.ovalo(0, 0, 45, 38, 24), { alto: 0.55, cordon: 0.4 });
  // monumento
  k.caja(8, 2, 8, 0, 0.1, 0, k.PIEDRA, { tono: Tono.CREMA });
  k.cilindro(1.2, 10, 0, 2, 0, k.PIEDRA, 8, 0.9, { tono: Tono.CREMA });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    k.arbol(Math.cos(a) * 55, Math.sin(a) * 48, 3.2);
  }
  push(out, k, "plazaSanMartin");
}

function plazaLavalle(ctx: Ctx, out: PuEntry[]) {
  const k = kit(ctx);
  k.epoca(1);
  k.lugar(11660, 7996, 1, 0);
  k.tapete(k.recto(120, 100), Pinta.BALDOSA, { claro: 0.8, alto: 0.1 });
  k.cantero(k.ovalo(0, 0, 32, 28, 20), { alto: 0.45, cordon: 0.35 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    k.arbol(Math.cos(a) * 42, Math.sin(a) * 36, 2.5);
  }
  push(out, k, "plazaLavalle");
}

function plazaConstitucion(ctx: Ctx, out: PuEntry[]) {
  const k = kit(ctx);
  k.epoca(1);
  k.lugar(7512, 8112, 0.05, -1);
  k.tapete(k.recto(200, 160), Pinta.BALDOSA, { claro: 0.75, alto: 0.1 });
  k.cantero(k.ovalo(0, 0, 50, 40, 24), { alto: 0.5, cordon: 0.4 });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    k.arbol(Math.cos(a) * 70, Math.sin(a) * 55, 2.8);
  }
  push(out, k, "plazaConstitucion");
}

function plazaOnce(ctx: Ctx, out: PuEntry[]) {
  {
    const k = kit(ctx);
    k.epoca(1, 6);
    k.lugar(10512, 4862, 1, 0);
    k.tapete(k.recto(160, 140), Pinta.BALDOSA, { claro: 0.76, alto: 0.1 });
    k.cantero(k.ovalo(0, 0, 40, 35, 22), { alto: 0.45, cordon: 0.35 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      k.arbol(Math.cos(a) * 55, Math.sin(a) * 48, 2.6);
    }
    push(out, k, "plazaOnce");
  }
  {
    const k = kit(ctx);
    k.epoca(6);
    k.lugar(10503, 4940, 1, 0);
    k.tapete(k.recto(170, 150), Pinta.BALDOSA, { claro: 0.78, alto: 0.1 });
    k.cantero(k.ovalo(0, 0, 42, 36, 22), { alto: 0.5, cordon: 0.4 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      k.arbol(Math.cos(a) * 58, Math.sin(a) * 50, 2.7);
    }
    push(out, k, "plazaOnce1940");
  }
}

/** Avenida de Mayo: calzada + veredas + ornamento (bancos, faroles, palmeras) desde 1895. */
function avenidaDeMayo(ctx: Ctx, out: PuEntry[]) {
  // 1895–1921: adoquín + faroles gas
  {
    const k = kit(ctx);
    k.epoca(2, 5);
    k.lugar(10317, 8694, 0, -1);
    const L = 1650;
    const half = L / 2;
    k.tapete(k.recto(22, L), Pinta.ADOQUIN, { claro: 0.55, alto: 0.14 });
    k.tapete(
      [
        [-18, -half],
        [-12, -half],
        [-12, half],
        [-18, half],
      ],
      Pinta.BALDOSA,
      { claro: 0.8, alto: 0.12 },
    );
    k.tapete(
      [
        [12, -half],
        [18, -half],
        [18, half],
        [12, half],
      ],
      Pinta.BALDOSA,
      { claro: 0.8, alto: 0.12 },
    );
    for (let s = -half + 30; s < half - 30; s += 28) {
      k.arbol(-15, s, 2.4);
      k.arbol(15, s, 2.4);
    }
    for (let s = -half + 40; s < half - 40; s += 55) {
      for (const side of [-10, 10]) {
        k.cilindro(0.14, 6.2, side, 0, s, k.TINTA, 6, 0.12, {});
        k.caja(0.55, 0.4, 0.55, side, 6.2, s, k.PINTADO, { pinta: [Pinta.NEGRO, 0.3] });
        k.cilindro(0.22, 0.35, side, 6.5, s, k.PINTADO, 6, 0.18, { pinta: [Pinta.BRONCE, 0.55] });
      }
    }
    // bancos
    for (let s = -half + 70; s < half - 70; s += 90) {
      for (const side of [-14, 14]) {
        k.caja(2.4, 0.45, 0.55, side, 0.15, s, k.PINTADO, { pinta: [Pinta.MADERA, 0.55] });
        k.caja(2.4, 0.55, 0.12, side, 0.55, s - 0.22, k.PINTADO, { pinta: [Pinta.MADERA, 0.5] });
      }
    }
    // kioscos / quioscos
    for (const s of [-400, 0, 380]) {
      k.caja(3.2, 2.8, 2.4, 0, 0.1, s, k.PINTADO, { pinta: [Pinta.VERDE, 0.45], H: 2.9 });
      k.caja(3.6, 0.35, 2.8, 0, 2.9, s, k.PINTADO, { pinta: [Pinta.CHAPA, 0.6] });
    }
    push(out, k, "avenidaDeMayo1895");
  }
  // 1921+: asfalto + palmeras + ornamento
  {
    const k = kit(ctx);
    k.epoca(5);
    k.lugar(10317, 8694, 0, -1);
    const L = 1650;
    const half = L / 2;
    k.tapete(k.recto(24, L), Pinta.ASFALTO, { claro: 0.38, alto: 0.14 });
    k.tapete(
      [
        [-20, -half],
        [-13, -half],
        [-13, half],
        [-20, half],
      ],
      Pinta.BALDOSA,
      { claro: 0.82, alto: 0.12 },
    );
    k.tapete(
      [
        [13, -half],
        [20, -half],
        [20, half],
        [13, half],
      ],
      Pinta.BALDOSA,
      { claro: 0.82, alto: 0.12 },
    );
    for (let s = -half + 35; s < half - 35; s += 32) {
      // palmeras (tronco alto + corona)
      for (const side of [-16, 16]) {
        k.cilindro(0.28, 7.5, side, 0, s, k.PINTADO, 6, 0.22, { pinta: [Pinta.MADERA, 0.55] });
        const crown = new THREE.ConeGeometry(2.2, 3.2, 7);
        crown.translate(side, 8.2, s);
        k.put(crown, k.FOLLAJE, { pinta: [Pinta.CESPED, 0.7], H: 10 });
      }
    }
    for (let s = -half + 50; s < half - 50; s += 48) {
      for (const side of [-11, 11]) {
        k.cilindro(0.16, 7, side, 0, s, k.TINTA, 6, 0.14, {});
        k.caja(0.7, 0.45, 0.7, side, 7, s, k.PINTADO, { pinta: [Pinta.NEGRO, 0.25] });
      }
    }
    // medianeras ornamentales / jardineras
    for (let s = -half + 80; s < half - 80; s += 120) {
      k.cantero(k.recto(3.5, 8, 0, s), { alto: 0.4, cordon: 0.25, tono: Pinta.FLORES });
    }
    push(out, k, "avenidaDeMayo1921");
  }
}

/** 9 de Julio (1940): avenida ancha + canteros centrales. */
function nueveDeJulio(ctx: Ctx, out: PuEntry[]) {
  const k = kit(ctx);
  k.epoca(6);
  k.lugar(11195, 8373, 0, 1);
  const L = 900;
  const half = L / 2;
  k.tapete(k.recto(70, L), Pinta.ASFALTO, { claro: 0.4, alto: 0.12 });
  // cantero central
  k.cantero(
    [
      [-8, -half + 40],
      [8, -half + 40],
      [8, half - 40],
      [-8, half - 40],
    ],
    { alto: 0.35, cordon: 0.3, tono: Pinta.CESPED },
  );
  for (let s = -half + 50; s < half - 50; s += 32) {
    k.arbol(-28, s, 2.8);
    k.arbol(28, s, 2.8);
    if (Math.abs(s) > 80) k.arbol(0, s, 2.2); // en cantero, lejos del Obelisco
  }
  // veredas
  k.tapete(
    [
      [-38, -half],
      [-32, -half],
      [-32, half],
      [-38, half],
    ],
    Pinta.BALDOSA,
    { claro: 0.82, alto: 0.1 },
  );
  k.tapete(
    [
      [32, -half],
      [38, -half],
      [38, half],
      [32, half],
    ],
    Pinta.BALDOSA,
    { claro: 0.82, alto: 0.1 },
  );
  push(out, k, "nueveDeJulio");
}

/** Diagonal Norte (Roque Sáenz Peña), desde ~1913 — con ornamento. */
function diagonalNorte(ctx: Ctx, out: PuEntry[]) {
  const k = kit(ctx);
  k.epoca(4);
  k.lugar(10480, 9000, 0.55, -0.83);
  const L = 1100;
  const half = L / 2;
  k.tapete(k.recto(30, L), Pinta.ADOQUIN, { claro: 0.48, alto: 0.12 });
  k.tapete(
    [
      [-18, -half],
      [-13, -half],
      [-13, half],
      [-18, half],
    ],
    Pinta.BALDOSA,
    { claro: 0.82, alto: 0.1 },
  );
  k.tapete(
    [
      [13, -half],
      [18, -half],
      [18, half],
      [13, half],
    ],
    Pinta.BALDOSA,
    { claro: 0.82, alto: 0.1 },
  );
  // cantero central triangular / isletas
  for (let s = -half + 80; s < half - 80; s += 140) {
    k.cantero(
      [
        [-3, s - 18],
        [3, s - 18],
        [0, s + 18],
      ],
      { alto: 0.35, cordon: 0.28, tono: Pinta.CESPED },
    );
  }
  for (let s = -half + 40; s < half - 40; s += 28) {
    k.arbol(-15, s, 2.3);
    k.arbol(15, s, 2.3);
  }
  // faroles art déco
  for (let s = -half + 55; s < half - 55; s += 42) {
    for (const side of [-11, 11]) {
      k.cilindro(0.15, 6.5, side, 0, s, k.TINTA, 6, 0.12, {});
      k.caja(0.8, 0.25, 0.8, side, 6.5, s, k.PINTADO, { pinta: [Pinta.BRONCE, 0.5] });
      k.caja(0.35, 0.55, 0.35, side, 6.75, s, k.PINTADO, { pinta: [Pinta.BLANCO, 0.9] });
    }
  }
  // bancos + basureros
  for (let s = -half + 100; s < half - 100; s += 110) {
    k.caja(2.2, 0.4, 0.5, -16, 0.15, s, k.PINTADO, { pinta: [Pinta.MADERA, 0.5] });
    k.cilindro(0.35, 0.9, 16, 0, s, k.PINTADO, 8, 0.3, { pinta: [Pinta.NEGRO, 0.3] });
  }
  push(out, k, "diagonalNorte");
}

/** Puerto / Dársena Sur — muelles y agua (1867→). */
function puerto(ctx: Ctx, out: PuEntry[]) {
  {
    const k = kit(ctx);
    k.epoca(0, 2);
    k.lugar(10940, 10250, 0.2, 1);
    // agua: en tinta, claro medio (gris río); no tapar el grabado con blanco
    k.tapete(k.recto(280, 400), Pinta.AGUA, { claro: 0.42, alto: 0.08, y: -0.4 });
    // Muelle de pasajeros — tablones, claro bajo = madera oscura en tinta
    k.caja(40, 1.2, 180, 0, 0, 0, k.PINTADO, { pinta: [Pinta.MADERA, 0.48], H: 1.2 });
    // tablones / juntas
    for (let z = -80; z <= 80; z += 12) {
      k.caja(38, 0.08, 0.35, 0, 1.2, z, k.PINTADO, { pinta: [Pinta.NEGRO, 0.22], H: 1.3 });
    }
    // pilotes
    for (const z of [-70, -30, 10, 50, 80]) {
      for (const x of [-18, 18]) {
        k.cilindro(0.45, 3.2, x, -1.8, z, k.PINTADO, 6, 0.4, { pinta: [Pinta.MADERA, 0.4] });
      }
    }
    // casilla / embarcadero
    k.caja(12, 4, 12, 0, 1.2, -60, k.PIEDRA, { tono: Tono.CREMA, floors: 1, H: 5 });
    k.caja(14, 0.4, 14, 0, 5.2, -60, k.PINTADO, { pinta: [Pinta.CHAPA, 0.55], H: 5.6 });
    barco(k, 25, 0.2, -40, 55, "carga");
    barco(k, 30, 0.2, 20, 70, "pasaje");
    barco(k, 22, 0.2, 80, 48, "carga");
    push(out, k, "puerto1867");
  }
  {
    const k = kit(ctx);
    k.epoca(2);
    k.lugar(11000, 10350, 0.15, 1);
    k.tapete(k.recto(360, 500), Pinta.AGUA, { claro: 0.42, alto: 0.08, y: -0.5 });
    for (const x of [-80, 0, 80]) {
      k.caja(18, 1.4, 220, x, 0, 40, k.PINTADO, { pinta: [Pinta.MADERA, 0.5], H: 1.4 });
    }
    k.caja(120, 8, 40, 0, 0, -80, k.PIEDRA, { tono: Tono.CREMA, floors: 2, H: 8 });
    barco(k, 50, 0.2, 0, 95, "carga");
    barco(k, -40, 0.2, 100, 80, "pasaje");
    barco(k, 60, 0.2, 180, 65, "carga");
    push(out, k, "puerto1895");
  }
}

/** Puerto Madero — docks (1895+). */
function puertoMadero(ctx: Ctx, out: PuEntry[]) {
  const k = kit(ctx);
  k.epoca(2);
  k.lugar(10329, 10550, 1, 0);
  k.tapete(k.recto(200, 600), Pinta.AGUA, { claro: 0.4, alto: 0.08, y: -0.45 });
  // docks este/oeste
  for (const x of [-70, 70]) {
    k.caja(24, 1.5, 520, x, 0, 0, k.PINTADO, { pinta: [Pinta.MADERA, 0.48], H: 1.5 });
    for (let z = -220; z <= 220; z += 55) {
      k.caja(20, 9, 28, x, 1.5, z, k.PIEDRA, { tono: Tono.LADRILLO, floors: 2, H: 10 });
    }
  }
  push(out, k, "puertoMadero");
}

/** Bocas del Subte A (1913) a lo largo de Av. de Mayo. */
function subteA(ctx: Ctx, out: PuEntry[]) {
  const k = kit(ctx);
  k.epoca(k.etapaDe(1913));
  // estaciones aprox. en px Y del plano (Av. de Mayo)
  const bocas: [number, number][] = [
    [10317, 9264],
    [10317, 8711],
    [10317, 8165],
    [10317, 7614],
    [10276, 9589], // Plaza de Mayo
  ];
  for (const [px, py] of bocas) {
    k.lugar(px, py, 0, -1);
    // boca: prisma bajo + baranda + cartel
    k.prisma(
      [
        [-1.3, -1.3],
        [4.5, -1.3],
        [4.5, 1.3],
        [-1.3, 1.3],
      ],
      0.85,
      -0.5,
      k.PIEDRA,
      { tono: Tono.GRIS, H: 0.4 },
    );
    k.tapete(
      [
        [0.2, -1.1],
        [4.2, -1.1],
        [4.2, 1.1],
        [0.2, 1.1],
      ],
      Pinta.ADOQUIN,
      { y: 0.12, claro: 0.55, alto: 0.08 },
    );
    k.tapete(
      [
        [2.2, -1.1],
        [4.2, -1.1],
        [4.2, 1.1],
        [2.2, 1.1],
      ],
      Pinta.NEGRO,
      { y: 0.14, claro: 0.2, alto: 0.06 },
    );
    // barandas
    for (const side of [-1.2, 1.2]) {
      k.caja(0.12, 1.1, 2.4, 2.2, 0.35, side, k.TINTA, {});
    }
    // cartel
    const shape = new THREE.Shape();
    shape.moveTo(-0.9, 0);
    shape.lineTo(1.1, 0);
    shape.lineTo(1.1, 0.9);
    shape.lineTo(0, 1.25);
    shape.lineTo(-0.9, 0.9);
    shape.closePath();
    const sign = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
    sign.translate(0, 3.2, 0);
    k.put(sign, k.TINTA, { H: 4.5 });
    k.caja(0.15, 3.2, 0.15, 0, 0.35, 0, k.TINTA, {});
  }
  push(out, k, "subteA");
}

/** Entorno del Obelisco en 9 de Julio (1940). */
function obeliscoEntorno(ctx: Ctx, out: PuEntry[]) {
  const k = kit(ctx);
  k.epoca(6);
  k.lugar(11195, 8373, 1, 0);
  k.tapete(k.ovalo(0, 0, 28, 28, 24), Pinta.BALDOSA, { claro: 0.85, alto: 0.12 });
  k.cantero(k.ovalo(0, 0, 18, 18, 20), { alto: 0.3, cordon: 0.25, tono: Pinta.CESPED });
  push(out, k, "obeliscoEntorno");
}

/** Estación Retiro — naves a mano (Mitre / Belgrano / San Martín). */
function retiro(ctx: Ctx, out: PuEntry[]) {
  // nave principal Mitre (~1915)
  {
    const k = kit(ctx);
    k.epoca(k.etapaDe(1915));
    k.lugar(12962, 9571, 0.62, -0.785);
    // andén / plaza frente
    k.tapete(k.recto(180, 90), Pinta.BALDOSA, { claro: 0.78, alto: 0.12 });
    // cuerpo principal
    k.caja(120, 18, 42, 0, 0, 0, k.PIEDRA, { tono: Tono.CREMA, floors: 3, H: 18 });
    k.caja(124, 2.5, 46, 0, 18, 0, k.PIEDRA, { tono: Tono.CREMA });
    // torre reloj
    k.caja(14, 28, 14, -40, 18, 0, k.PIEDRA, { tono: Tono.CREMA, floors: 5, H: 46 });
    k.caja(16, 1.2, 16, -40, 46, 0, k.PIEDRA, { tono: Tono.CREMA });
    k.cilindro(1.8, 4, -40, 47, 0, k.TINTA, 8, 1.5, {});
    // arquería fachada
    k.arqueria(-55, 55, 9, 0, 10, 3.2, 5.5, Tono.CREMA, 8, 1.2);
    // naves laterales / tinglados
    for (const x of [-70, 70]) {
      k.caja(28, 12, 160, x, 0, 40, k.PINTADO, { pinta: [Pinta.CHAPA, 0.55], H: 12 });
      k.caja(30, 1.5, 164, x, 12, 40, k.PINTADO, { pinta: [Pinta.CHAPA, 0.45] });
    }
    // vías
    for (let i = -4; i <= 4; i++) {
      k.tapete(
        [
          [-8, 30 + i * 8],
          [90, 30 + i * 8],
          [90, 32 + i * 8],
          [-8, 32 + i * 8],
        ],
        Pinta.BALASTO,
        { claro: 0.55, alto: 0.1 },
      );
    }
    push(out, k, "retiroMitre");
  }
  // Belgrano / San Martín (más chicas, ~1912–20)
  {
    const k = kit(ctx);
    k.epoca(k.etapaDe(1912));
    k.lugar(12571, 9256, 0.58, -0.816);
    k.caja(70, 14, 32, 0, 0, 0, k.PIEDRA, { tono: Tono.LADRILLO, floors: 2, H: 14 });
    k.caja(74, 1.8, 36, 0, 14, 0, k.PIEDRA, { tono: Tono.LADRILLO });
    k.caja(18, 10, 80, 40, 0, 30, k.PINTADO, { pinta: [Pinta.CHAPA, 0.5], H: 10 });
    push(out, k, "retiroBelgrano");
  }
}

/** Playas de Retiro — balasto, vías, tinglados y playas de maniobra (1921+). */
function playasRetiro(ctx: Ctx, out: PuEntry[]) {
  {
    const k = kit(ctx);
    k.epoca(5);
    k.lugar(13950, 8950, 0.71, -0.705);
    // playa de vías
    k.tapete(k.recto(900, 220), Pinta.BALASTO, { claro: 0.58, alto: 0.1 });
    for (let i = -8; i <= 8; i++) {
      k.tapete(
        [
          [-420, i * 10 - 0.4],
          [420, i * 10 - 0.4],
          [420, i * 10 + 0.4],
          [-420, i * 10 + 0.4],
        ],
        Pinta.NEGRO,
        { claro: 0.2, alto: 0.06, y: 0.08 },
      );
    }
    // tinglados / galpones
    for (const z of [-70, 70]) {
      k.caja(220, 9, 28, -100, 0, z, k.PINTADO, { pinta: [Pinta.CHAPA, 0.55], H: 9 });
      k.caja(180, 9, 28, 180, 0, z, k.PINTADO, { pinta: [Pinta.LADRILLO, 0.55], H: 9 });
    }
    // locomotoras / vagones simplificados
    for (const x of [-200, -50, 120, 280]) {
      k.caja(28, 3.5, 3.2, x, 0.2, 0, k.PINTADO, { pinta: [Pinta.NEGRO, 0.25], H: 3.5 });
      k.caja(8, 3.8, 3.0, x - 12, 0.2, 0, k.PINTADO, { pinta: [Pinta.NEGRO, 0.3], H: 4 });
      k.cilindro(0.9, 2.5, x - 14, 3.8, 0, k.TINTA, 6, 0.7, {});
    }
    push(out, k, "playasRetiro1921");
  }
  {
    const k = kit(ctx);
    k.epoca(6);
    k.lugar(13950, 8950, 0.71, -0.705);
    k.tapete(k.recto(1000, 260), Pinta.BALASTO, { claro: 0.52, alto: 0.1 });
    for (let i = -10; i <= 10; i++) {
      k.tapete(
        [
          [-480, i * 9 - 0.35],
          [480, i * 9 - 0.35],
          [480, i * 9 + 0.35],
          [-480, i * 9 + 0.35],
        ],
        Pinta.NEGRO,
        { claro: 0.18, alto: 0.05, y: 0.08 },
      );
    }
    // depósitos modernos
    for (const [x, z] of [
      [-300, -90],
      [0, 95],
      [320, -80],
    ] as [number, number][]) {
      k.caja(90, 11, 36, x, 0, z, k.PINTADO, { pinta: [Pinta.CHAPA, 0.5], H: 11 });
    }
    push(out, k, "playasRetiro1940");
  }
}

/** Puerto Nuevo — dársenas, muelles, barcos de carga/pasajeros (1921+). */
function puertoNuevo(ctx: Ctx, out: PuEntry[]) {
  const k = kit(ctx);
  k.epoca(5);
  k.lugar(12595, 10169, 0.4, 0.917);
  // agua
  k.tapete(k.recto(520, 700), Pinta.AGUA, { claro: 0.4, alto: 0.08, y: -0.55 });
  // muelles / espigones
  for (const z of [-220, -80, 60, 200]) {
    k.caja(40, 1.6, 180, 0, 0, z, k.PINTADO, { pinta: [Pinta.MADERA, 0.5], H: 1.6 });
    k.caja(28, 8, 24, -10, 1.6, z - 40, k.PIEDRA, { tono: Tono.LADRILLO, floors: 2, H: 9 });
  }
  // rompeolas
  k.caja(12, 3.5, 620, 180, 0, 0, k.PIEDRA, { tono: Tono.SILLAR, H: 3.5 });
  // barcos
  barco(k, -40, 0.2, -160, 90, "carga");
  barco(k, 30, 0.2, -20, 110, "pasaje");
  barco(k, -20, 0.2, 140, 80, "carga");
  barco(k, 50, 0.2, 260, 70, "carga");
  // grúas
  for (const z of [-200, 0, 180]) {
    k.cilindro(1.2, 22, 20, 1.6, z, k.TINTA, 6, 1.0, {});
    k.caja(28, 0.6, 0.6, 34, 22, z, k.TINTA, {});
    k.caja(0.5, 8, 0.5, 48, 14, z, k.TINTA, {});
  }
  push(out, k, "puertoNuevo");
}

function barco(
  k: LandmarkKit,
  x: number,
  y: number,
  z: number,
  L: number,
  tipo: "carga" | "pasaje",
) {
  const B = L * 0.14;
  const H = L * 0.05 + 1.8;
  // casco
  k.prisma(
    [
      [-L / 2, -B * 0.3],
      [-L * 0.4, -B / 2],
      [L * 0.35, -B / 2],
      [L / 2, 0],
      [L * 0.35, B / 2],
      [-L * 0.4, B / 2],
      [-L / 2, B * 0.3],
    ].map(([a, b]) => [x + a, z + b] as [number, number]),
    H,
    y,
    k.PINTADO,
    { pinta: [Pinta.NEGRO, 0.2], H: y + H },
  );
  // cubierta / superestructura
  const superH = tipo === "pasaje" ? H * 1.4 : H * 0.9;
  k.caja(L * 0.55, superH, B * 0.7, x - L * 0.05, y + H, z, k.PINTADO, {
    pinta: [Pinta.BLANCO, 0.92],
    H: y + H + superH,
  });
  // chimenea
  k.cilindro(1.1, H * 1.6, x + L * 0.1, y + H + superH, z, k.PINTADO, 8, 0.9, {
    pinta: [tipo === "pasaje" ? Pinta.ROJO : Pinta.NEGRO, 0.35],
  });
  // mástil
  k.cilindro(0.25, H * 2.2, x - L * 0.25, y + H, z, k.TINTA, 5, 0.2, {});
}

/** Casas / conventillos / bajo 1867 en el casco. */
function viejos1867(ctx: Ctx, out: PuEntry[]) {
  const k = kit(ctx);
  k.epoca(0, 1);
  const spots: [number, number, number, number, number][] = [
    // px, py, w, d, h
    [7146, 8188, 28, 18, 8],
    [7056, 8134, 22, 14, 7],
    [7057, 8217, 24, 16, 9],
    [10200, 9711, 32, 20, 10],
    [11614, 8200, 26, 16, 8],
    [11615, 8217, 20, 14, 7],
    [12543, 9087, 30, 18, 9],
    [9800, 9200, 18, 12, 6],
    [9950, 9050, 22, 14, 7],
    [10100, 8900, 24, 15, 8],
  ];
  for (const [px, py, w, d, h] of spots) {
    k.lugar(px, py, 1, 0);
    k.caja(w, h, d, 0, 0, 0, k.CASA, { tono: Tono.CREMA, floors: Math.max(1, Math.round(h / 3.2)), H: h });
    // techo a dos aguas simplificado
    const roof = new THREE.ConeGeometry(Math.max(w, d) * 0.55, h * 0.35, 4);
    roof.rotateY(Math.PI / 4);
    roof.translate(0, h + h * 0.15, 0);
    k.put(roof, k.PIZARRA, { H: h + 3 });
  }
  push(out, k, "viejos1867");
}

/** Edificios modernos / torres racionalistas (1914+). */
function modernos(ctx: Ctx, out: PuEntry[]) {
  {
    const k = kit(ctx);
    k.epoca(k.etapaDe(1914));
    // torres/rascacielos tempranos fuera del catálogo Fl
    const towers: [number, number, number, number, number, number][] = [
      // px, py, w, d, h, tono
      [5247, 11329, 22, 22, 48, Tono.GRIS],
      [11100, 8200, 18, 18, 55, Tono.CREMA],
      [10850, 8500, 20, 16, 42, Tono.GRIS],
      [11400, 7800, 16, 16, 38, Tono.CREMA],
    ];
    for (const [px, py, w, d, h, tono] of towers) {
      k.lugar(px, py, 1, 0);
      k.caja(w, h, d, 0, 0, 0, k.PIEDRA, { tono, floors: Math.round(h / 3.3), H: h });
      k.caja(w + 1, 0.8, d + 1, 0, h, 0, k.PIEDRA, { tono });
      // remate
      k.caja(w * 0.45, 4, d * 0.45, 0, h + 0.8, 0, k.PIEDRA, { tono });
    }
    push(out, k, "modernos");
  }
}

export { YEARS };
