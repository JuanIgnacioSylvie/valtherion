import * as THREE from "three";
import type { PlanoMeta } from "../../plano/types";
import type { CityUniforms } from "../CityUniforms";
import { LandmarkKit, Pinta, type PutOpts } from "../LandmarkKit";

type Ctx = { meta: PlanoMeta; shared: CityUniforms };

type PuEntry = {
  root: THREE.Object3D;
  desde: number;
  hasta: number;
  name: string;
};

export type BarcoTipo =
  | "carga"
  | "pasaje"
  | "velero"
  | "ruedas"
  | "remolcador"
  | "chata"
  | "bote";

export type BarcoOpts = {
  tipo?: BarcoTipo;
  L?: number;
  B?: number;
  alto?: number;
  casco?: PutOpts;
  chimenea?: PutOpts;
  ruedas?: boolean;
  vela?: boolean;
  popa?: boolean;
  puentes?: boolean;
  chimeneas?: number[];
};

function pinta(id: number, claro: number): PutOpts {
  return { pinta: [id, claro] };
}

const CASCO = pinta(Pinta.NEGRO, 0.2);
const BLANCO = pinta(Pinta.BLANCO, 0.97);
const ROJO = pinta(Pinta.ROJO, 0.35);
const LONA = pinta(Pinta.LONA, 0.9);
const MADERA = pinta(Pinta.MADERA, 0.55);
const OCRE = pinta(Pinta.OCRE, 0.7);

/** Silueta de casco en planta (local X largo, Z manga). */
function hullRing(L: number, B: number): [number, number][] {
  return [
    [-L / 2, -B * 0.28],
    [-L * 0.46, -B * 0.45],
    [-L * 0.3, -B / 2],
    [L * 0.25, -B / 2],
    [L * 0.4, -B * 0.33],
    [L / 2, 0],
    [L * 0.4, B * 0.33],
    [L * 0.25, B / 2],
    [-L * 0.3, B / 2],
    [-L * 0.46, B * 0.45],
    [-L / 2, B * 0.28],
  ];
}

/** Casco por franjas (como el original): costados + tapa. */
function hullShell(
  ring: [number, number][],
  y0: number,
  y1: number,
  top = false,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const n = ring.length;
  let area = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = ring[i]!;
    const [x1, z1] = ring[(i + 1) % n]!;
    area += x0 * z1 - x1 * z0;
    cx += x0 / n;
    cz += z0 / n;
  }
  for (let i = 0; i < n; i++) {
    let a = ring[i]!;
    let b = ring[(i + 1) % n]!;
    if (area < 0) [a, b] = [b, a];
    if (top) {
      pos.push(cx, y1, cz, b[0], y1, b[1], a[0], y1, a[1]);
    } else {
      pos.push(a[0], y0, a[1], a[0], y1, a[1], b[0], y1, b[1]);
      pos.push(a[0], y0, a[1], b[0], y1, b[1], b[0], y0, b[1]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

function boom(
  g: LandmarkKit,
  x: number,
  y: number,
  z: number,
  len: number,
  ang: number,
  axis: "x" | "z" = "x",
  thick = 0.22,
) {
  const geo = new THREE.BoxGeometry(thick, len, thick).translate(0, len / 2, 0);
  if (axis === "x") geo.rotateZ(-ang);
  else geo.rotateX(ang);
  geo.translate(x, y, z);
  g.put(geo, g.TINTA, {});
}

/**
 * Coloca un barco en coords de plano, orientado por (ux,uz).
 * Geometría portada del builder del original (velero/bote/carga/pasaje/…).
 */
export function placeBarco(
  g: LandmarkKit,
  px: number,
  py: number,
  ux: number,
  uz: number,
  opts: BarcoOpts = {},
) {
  const h = Math.hypot(ux, uz) || 1;
  g.lugar(px, py, ux / h, uz / h);
  const tipo = opts.tipo ?? "carga";
  const L = opts.L ?? 92;
  const B = opts.B ?? L * 0.135;
  const alto = opts.alto ?? L * 0.045 + 1.6;
  const casco = opts.casco ?? CASCO;
  const chimenea = opts.chimenea ?? CASCO;
  const ring = hullRing(L, B);
  const waterline = Math.min(0.9, alto * 0.25);

  g.put(hullShell(ring, 0, waterline), g.PINTADO, tipo === "bote" ? casco : ROJO);
  g.put(hullShell(ring, waterline, alto), g.PINTADO, casco);
  g.put(hullShell(ring, 0, alto, true), g.PINTADO, pinta(Pinta.MADERA, 0.86));

  const mast = (x: number, hMast: number, r = 0.26) =>
    g.cilindro(r, hMast, x, alto, 0, g.TINTA, 4, r * 0.4, {});

  if (tipo === "carga" || tipo === "pasaje") {
    g.prisma(
      [
        [L * 0.3, -B * 0.44],
        [L * 0.4, -B * 0.33],
        [L / 2, 0],
        [L * 0.4, B * 0.33],
        [L * 0.3, B * 0.44],
      ],
      1.5,
      alto,
      g.PINTADO,
      casco,
    );
    g.prisma(
      [
        [-L / 2, -B * 0.28],
        [-L * 0.46, -B * 0.45],
        [-L * 0.37, -B / 2],
        [-L * 0.37, B / 2],
        [-L * 0.46, B * 0.45],
        [-L / 2, B * 0.28],
      ],
      1.3,
      alto,
      g.PINTADO,
      casco,
    );
    const pasaje = tipo === "pasaje";
    const superL = L * (pasaje ? 0.52 : 0.2);
    const superX = pasaje ? -L * 0.02 : opts.popa ? -L * 0.3 : -L * 0.03;
    g.caja(superL, 2.5, B * 0.84, superX, alto, 0, g.PINTADO, BLANCO);
    g.caja(
      superL * (pasaje ? 0.86 : 0.5),
      2.3,
      B * 0.64,
      superX + (pasaje ? 0 : superL * 0.2),
      alto + 2.5,
      0,
      g.PINTADO,
      BLANCO,
    );
    if (opts.puentes) {
      g.caja(superL * 0.7, 2.3, B * 0.56, superX, alto + 4.8, 0, g.PINTADO, BLANCO);
    }
    const stackXs = opts.chimeneas ?? (pasaje ? [-0.09, 0.07] : [opts.popa ? -0.33 : -0.06]);
    const stackY = alto + (pasaje ? 4.8 : 2.5) + (opts.puentes ? 2.3 : 0);
    for (const t of stackXs) {
      const r = B * (pasaje ? 0.13 : 0.11);
      const hStack = pasaje ? 9.5 : 7.5;
      g.cilindro(r, hStack, L * t, stackY, 0, g.PINTADO, 7, r, chimenea);
      if (chimenea !== CASCO) {
        g.cilindro(r * 1.04, 1.4, L * t, stackY + hStack, 0, g.PINTADO, 7, r * 1.04, CASCO);
      }
    }
    for (const side of [-1, 1] as const) {
      const mx = opts.popa
        ? side < 0
          ? -L * 0.12
          : L * 0.2
        : side * L * (pasaje ? 0.36 : 0.26);
      mast(mx, L * 0.24 + 4);
      if (!pasaje) {
        boom(g, mx, alto + 1.2, 0, L * 0.13, 0.95);
        boom(g, mx, alto + 1.2, 0, L * 0.13, -0.95);
        g.caja(L * 0.1, 0.8, B * 0.46, mx - side * L * 0.1, alto, 0, g.PINTADO, LONA);
      }
    }
  } else if (tipo === "velero" || tipo === "ruedas") {
    const velero = tipo === "velero";
    boom(g, L * 0.46, alto + 0.3, 0, L * 0.24, 1.25, "x", 0.3);
    if (velero) {
      const top = hullShell(ring, alto * 0.62, alto * 0.78);
      top.scale(1.012, 1, 1.03);
      g.put(top, g.PINTADO, BLANCO);
    }
    (
      [
        [0.27, 0.5],
        [-0.02, 0.56],
        [-0.3, 0.42],
      ] as [number, number][]
    ).forEach(([t, n], i) => {
      if (!velero && i === 1) return;
      const hMast = L * n * (velero ? 1 : 0.7);
      mast(L * t, hMast, 0.4);
      for (let k = 0; k < (velero && i < 2 ? 3 : 1); k++) {
        g.caja(
          0.45,
          0.45,
          B * (1.75 - k * 0.42),
          L * t,
          alto + hMast * (0.3 + k * 0.26),
          0,
          g.PINTADO,
          LONA,
        );
      }
      if (velero && i === 2) boom(g, L * t, alto + hMast * 0.5, 0, L * 0.16, 2, "x", 0.26);
    });
    g.caja(L * 0.12, 1.9, B * 0.5, -L * 0.3, alto, 0, g.PINTADO, BLANCO);
    if (opts.ruedas || tipo === "ruedas") {
      for (const side of [-1, 1] as const) {
        const wheel = new THREE.CylinderGeometry(
          3.3,
          3.3,
          2,
          9,
          1,
          false,
          -Math.PI / 2,
          Math.PI,
        );
        wheel.rotateX(-Math.PI / 2);
        wheel.translate(-L * 0.02, alto - 1.1, side * (B / 2 + 1));
        g.put(wheel, g.PINTADO, BLANCO);
      }
      g.cilindro(0.8, 9, -L * 0.02, alto, 0, g.PINTADO, 6, 0.8, CASCO);
      g.caja(L * 0.22, 2, B * 0.6, L * 0.02, alto, 0, g.PINTADO, BLANCO);
    }
  } else if (tipo === "remolcador") {
    g.caja(L * 0.36, 2.2, B * 0.62, L * 0.04, alto, 0, g.PINTADO, BLANCO);
    g.cilindro(0.7, 5, -L * 0.06, alto + 1.6, 0, g.PINTADO, 6, 0.7, chimenea);
    mast(L * 0.26, 8, 0.16);
  } else if (tipo === "chata") {
    g.caja(L * 0.66, 1.3, B * 0.7, 0, alto, 0, g.PINTADO, LONA);
  } else if (tipo === "bote") {
    if (opts.vela !== false) {
      g.caja(0.14, 5.4, 0.14, L * 0.12, alto * 0.5, 0, g.TINTA, {});
      const sail = new THREE.BufferGeometry();
      const a = [-L * 0.3, alto + 0.6, 0.06];
      const b = [L * 0.2, alto + 0.6, 0.06];
      const c = [L * 0.14, alto + 5.2, 0.06];
      const d = [-L * 0.22, alto + 4.2, 0.06];
      sail.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d, ...a, ...c, ...b, ...a, ...d, ...c], 3),
      );
      sail.computeVertexNormals();
      g.put(sail, g.PINTADO, LONA);
    } else {
      for (const t of [-0.2, 0.15]) {
        g.caja(0.5, 0.9, 0.5, L * t, alto * 0.6, 0, g.PINTADO, t < 0 ? CASCO : ROJO);
      }
    }
  }
}

function carroDesembarco(g: LandmarkKit, px: number, py: number, ux: number, uz: number, i: number) {
  const h = Math.hypot(ux, uz) || 1;
  g.lugar(px, py, ux / h, uz / h);
  g.caja(3.3, 0.9, 1.7, 0, 1.5, 0, g.PINTADO, MADERA);
  g.caja(3.5, 0.12, 1.9, 0, 1.4, 0, g.TINTA, {});
  for (const side of [-1, 1] as const) {
    const wheel = new THREE.CylinderGeometry(1.45, 1.45, 0.14, 9);
    wheel.rotateX(Math.PI / 2);
    wheel.translate(-0.3, 1.45, side * 1.05);
    g.put(wheel, g.PINTADO, pinta(Pinta.MADERA, 0.3));
    const dark = side * (i % 2 ? 1 : -1) > 0;
    g.caja(2.1, 1.05, 0.6, 3.5, 0.6, side * 0.5, g.PINTADO, dark ? CASCO : pinta(Pinta.MADERA, 0.4));
    g.caja(0.5, 0.8, 0.4, 4.6, 1.4, side * 0.5, g.PINTADO, dark ? CASCO : pinta(Pinta.MADERA, 0.4));
  }
  (
    [
      [-0.9, BLANCO],
      [0, CASCO],
      [0.9, i % 2 ? ROJO : OCRE],
    ] as [number, PutOpts][]
  ).forEach(([x, mat]) => g.caja(0.5, 1, 0.5, x, 2.4, x * 0.3, g.PINTADO, mat));
}

function push(out: PuEntry[], k: LandmarkKit, name: string) {
  const { desde, hasta } = k.yearRange();
  const root = k.build();
  if (root.children.length) out.push({ root, desde, hasta, name });
}

/** Flota de 1867–1895: rada (veleros/ruedas), botes al muelle, carros de desembarco. */
export function buildRada1867(ctx: Ctx, out: PuEntry[]) {
  const k = new LandmarkKit(ctx.meta, ctx.shared);
  k.epoca(0, 2);

  let rnd = 0.4217;
  const rand = () => {
    rnd = (rnd * 9301 + 0.2113) % 1;
    return rnd;
  };
  const dir = (t: number): [number, number] => [-0.42 + t * 0.1, -0.9];

  const veleros: [number, number, number][] = [
    [9050, 11950, 60],
    [9700, 11800, 52],
    [10250, 12050, 64],
    [10700, 11720, 56],
    [11150, 11980, 60],
    [11650, 11660, 50],
    [12050, 11900, 58],
    [9350, 11460, 44],
    [10050, 11330, 40],
    [11300, 11300, 46],
    [12300, 11420, 48],
    [8600, 11600, 50],
    [9900, 11080, 34],
    [10750, 11150, 36],
    [11000, 11420, 42],
    [11800, 11180, 34],
    [9200, 11150, 38],
    [10450, 11560, 48],
  ];
  veleros.forEach(([px, py, L], i) => {
    const [ux, uz] = dir(rand() - 0.5);
    placeBarco(k, px, py, ux, uz, {
      tipo: "velero",
      L,
      B: L * 0.17,
      alto: L * 0.06 + 1,
      casco: i % 4 === 2 ? pinta(Pinta.VERDE, 0.2) : CASCO,
    });
  });

  (
    [
      [10480, 10990, 62],
      [11500, 10960, 56],
      [9500, 10900, 50],
    ] as [number, number, number][]
  ).forEach(([px, py, L]) => {
    const [ux, uz] = dir(rand() - 0.5);
    placeBarco(k, px, py, ux, uz, {
      tipo: "ruedas",
      L,
      B: L * 0.13,
      alto: 3.4,
      ruedas: true,
    });
  });

  (
    [
      [10900, 10580, 1, 0.3],
      [10985, 10620, -0.6, 1],
      [11040, 10520, 0.2, 1],
      [10850, 10700, 1, 1],
      [10960, 10760, -1, 0.4],
      [11100, 10680, 0.5, -1],
      [10760, 10560, 1, -0.2],
      [10990, 10880, 0.3, 1],
      [10380, 10830, 1, 0.5],
      [10300, 10760, -1, 0.6],
      [10560, 10700, 0.8, 1],
      [11250, 10500, -0.7, 1],
    ] as [number, number, number, number][]
  ).forEach(([px, py, ux, uz], i) => {
    placeBarco(k, px, py, ux, uz, {
      tipo: "bote",
      L: 9.5,
      B: 2.7,
      alto: 1,
      casco: i % 3 ? pinta(Pinta.MADERA, 0.6) : BLANCO,
      vela: i % 4 !== 3,
    });
  });

  (
    [
      [10560, 10075, 0.1, 1],
      [10610, 10120, -0.2, 1],
      [10700, 10060, 0.2, -1],
      [10760, 10140, 0, 1],
      [10820, 10080, 0.3, 1],
      [10470, 10110, -0.1, -1],
      [11040, 10060, 0.1, 1],
      [11110, 10110, -0.3, 1],
      [11190, 10050, 0.2, -1],
      [10650, 10200, 0, 1],
    ] as [number, number, number, number][]
  ).forEach(([px, py, ux, uz], i) => carroDesembarco(k, px, py, ux, uz, i));

  push(out, k, "rada1867");
}

/** Barcos en diques de Puerto Madero (1895+) — aproximación alineada al original. */
export function buildDiquesBarcos(ctx: Ctx, out: PuEntry[]) {
  const fleet: BarcoOpts[] = [
    { L: 92 },
    { L: 104, chimenea: ROJO },
    { L: 78, chimenea: OCRE },
    { L: 98, chimenea: pinta(Pinta.BLANCO, 0.9) },
    { L: 86 },
    { L: 110, chimenea: OCRE },
  ];

  const diques: { desde: number; q: [number, number][] }[] = [
    {
      desde: 2,
      q: [
        [7788, 10459],
        [8622, 10442],
        [8624, 10674],
        [7813, 10693],
      ],
    },
    {
      desde: 2,
      q: [
        [8752, 10439],
        [9593, 10418],
        [9594, 10652],
        [8753, 10672],
      ],
    },
    {
      desde: 2,
      q: [
        [9718, 10415],
        [10727, 10396],
        [10730, 10631],
        [9720, 10649],
      ],
    },
    {
      desde: 3,
      q: [
        [10843, 10395],
        [11755, 10385],
        [11758, 10617],
        [10846, 10629],
      ],
    },
  ];

  diques.forEach((d, di) => {
    const k = new LandmarkKit(ctx.meta, ctx.shared);
    k.epoca(d.desde);
    const [a, b, , d0] = d.q;
    const px = (a![0] + b![0] + d.q[2]![0] + d0![0]) / 4;
    const py = (a![1] + b![1] + d.q[2]![1] + d0![1]) / 4;
    const ux = b![0] - a![0];
    const uz = b![1] - a![1];
    const len = Math.hypot(ux, uz) || 1;
    const fx = ux / len;
    const fz = uz / len;
    const nShip = Math.max(2, Math.round(len / 150));
    for (let i = 0; i < nShip; i++) {
      const t = (i + 0.5) / nShip;
      const x = a![0] + (b![0] - a![0]) * t;
      const y = a![1] + (b![1] - a![1]) * t;
      // interior del dique (hacia el sur del borde norte)
      const inward = 40;
      const rx = -fz;
      const rz = fx;
      const side = i % 2 ? 1 : -1;
      const opts = { ...fleet[(di * 2 + i) % fleet.length]! };
      if ((i + di) % 4 === 1 && d.desde === 2) {
        placeBarco(k, x + rx * inward * side, y + rz * inward * side, fx * side, fz * side, {
          tipo: "velero",
          L: 58,
          B: 10,
          alto: 4.6,
        });
      } else if ((i + di) % 3 === 0) {
        placeBarco(k, x + rx * (inward - 8) * side, y + rz * (inward - 8) * side, fx * side, fz * side, {
          tipo: "chata",
          L: 30,
          B: 7.5,
          alto: 1.9,
        });
        placeBarco(k, x + rx * (inward + 10) * side, y + rz * (inward + 10) * side, -fx * side, -fz * side, {
          tipo: "chata",
          L: 26,
          B: 7,
          alto: 1.9,
          casco: pinta(Pinta.ROJO, 0.3),
        });
      } else {
        placeBarco(k, x + rx * inward * side, y + rz * inward * side, fx * side, fz * side, {
          tipo: i % 2 ? "pasaje" : "carga",
          ...opts,
        });
      }
    }
    placeBarco(k, px, py, fx, fz, {
      tipo: "remolcador",
      L: 24,
      B: 6,
      alto: 2.3,
      chimenea: di % 2 ? OCRE : ROJO,
    });
    push(out, k, `diqueBarcos${di + 1}`);
  });
}
