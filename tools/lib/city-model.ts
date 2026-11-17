/** Modelo procedural de una ciudad histórica inventada (misma data → plano + 3D). */

export type Building = {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  seed: number;
  et: number;
};

export type Tree = { x: number; y: number; r: number; seed: number };

export type Block = {
  x: number;
  y: number;
  w: number;
  d: number;
  urban: boolean;
};

export type Landmark = {
  nombre: string;
  x: number;
  y: number;
  nivel: number;
  nota: string;
  desde?: number;
  rio?: boolean;
};

export type CityModel = {
  W: number;
  H: number;
  metro: number;
  plaza: [number, number];
  marco: [number, number, number, number];
  blocks: Block[];
  buildings: Building[];
  trees: Tree[];
  landmarks: Landmark[];
  /** costa: y = f(x) en px */
  coastY: (x: number) => number;
  seed: number;
};

export function hash(x: number, y: number, s = 1) {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

export function buildCityModel(opts?: {
  /** Ancho del escaneo. Default ~ mitad Glade por velocidad; aún hi-res. */
  W?: number;
  H?: number;
  seed?: number;
}): CityModel {
  // Proporción Glade 18919×13272; usamos 12288×8616 (~2/3) = hi-res usable
  const W = opts?.W ?? 12288;
  const H = opts?.H ?? 8616;
  const seed = opts?.seed ?? 1867;
  // Escala mundo ≈ Glade: ~12.8 km de ancho
  const metro = (18919 * 0.675) / W;
  const plaza: [number, number] = [Math.round(W * 0.546), Math.round(H * 0.715)];
  const marco: [number, number, number, number] = [
    Math.round(W * 0.068),
    Math.round(H * 0.094),
    Math.round(W * 0.96),
    Math.round(H * 0.943),
  ];

  const coastY = (x: number) => {
    const t = x / W;
    return (
      H * 0.78 +
      Math.sin(t * 18 + seed) * H * 0.012 +
      Math.sin(t * 41) * H * 0.006 +
      Math.sin(t * 7) * H * 0.02
    );
  };

  const block = Math.max(36, Math.round(W / 140));
  const blocks: Block[] = [];
  const buildings: Building[] = [];
  const trees: Tree[] = [];

  const [cx, cy] = plaza;
  const margin = Math.round(W * 0.07);

  for (let gy = margin; gy < H * 0.76; gy += block) {
    for (let gx = margin; gx < W - margin; gx += block) {
      const dx = (gx + block / 2 - cx) / W;
      const dy = (gy + block / 2 - cy) / H;
      const dist = Math.hypot(dx * 1.35, dy);
      const jitter = (hash(gx, gy, seed) - 0.5) * block * 0.12;
      const bx = gx + jitter;
      const by = gy + (hash(gy, gx, seed) - 0.5) * block * 0.08;
      const bw = block - 8 - hash(gx + 1, gy, seed) * 4;
      const bd = block - 8 - hash(gx, gy + 1, seed) * 4;

      // campo / quintas en afueras
      if (dist > 0.48) continue;
      if (dist > 0.34 && hash(gx, gy, seed + 2) > 0.45) continue;
      if (by + bd > coastY(bx + bw / 2) - 20) continue;

      const urban = dist < 0.26 || hash(gx, gy, seed + 3) > 0.35;
      blocks.push({ x: bx, y: by, w: bw, d: bd, urban });

      if (!urban) {
        // quinta: un caserón + árboles
        if (hash(bx, by, seed) > 0.4) {
          const w = bw * (0.25 + hash(bx, by, 4) * 0.2);
          const d = bd * (0.2 + hash(by, bx, 5) * 0.2);
          buildings.push({
            x: bx + bw * 0.3,
            y: by + bd * 0.3,
            w,
            d,
            h: 5 + hash(bx, by, 6) * 4,
            seed: hash(bx, by, 7),
            et: hash(bx, by, 8) > 0.7 ? 1 + Math.floor(hash(by, bx, 9) * 4) : 0,
          });
        }
        for (let i = 0; i < 4 + Math.floor(hash(bx, by, 10) * 6); i++) {
          trees.push({
            x: bx + 8 + hash(bx + i, by, 11) * (bw - 16),
            y: by + 8 + hash(by + i, bx, 12) * (bd - 16),
            r: 3 + hash(i, bx, 13) * 5,
            seed: hash(i, by, 14),
          });
        }
        continue;
      }

      // manzana urbana: parcelas
      const dens = dist < 0.1 ? 0.92 : dist < 0.18 ? 0.72 : 0.48;
      const cellsX = 2 + Math.floor(hash(gx, gy, 20) * 3);
      const cellsY = 2 + Math.floor(hash(gy, gx, 21) * 3);
      const cw = (bw - 4) / cellsX;
      const ch = (bd - 4) / cellsY;
      const pad = 1.5;

      for (let iy = 0; iy < cellsY; iy++) {
        for (let ix = 0; ix < cellsX; ix++) {
          if (hash(gx + ix * 19, gy + iy * 17, seed) > dens) continue;
          const w = cw * (0.62 + hash(ix, iy + gx, 22) * 0.32) - pad;
          const d = ch * (0.62 + hash(iy, ix + gy, 23) * 0.32) - pad;
          const x = bx + 2 + ix * cw + (cw - w) * 0.5;
          const y = by + 2 + iy * ch + (ch - d) * 0.5;
          let et = 0;
          if (dist > 0.16 && hash(x, y, 24) > 0.5) et = 1 + Math.floor(hash(y, x, 25) * 5);
          if (dist > 0.28 && hash(x, y, 26) > 0.35) et = 2 + Math.floor(hash(y, x, 27) * 4);
          buildings.push({
            x,
            y,
            w: Math.max(4, w),
            d: Math.max(4, d),
            h: 4 + hash(x, y, 28) * (dist < 0.12 ? 12 : dist < 0.2 ? 8 : 5),
            seed: hash(x, y, 29),
            et,
          });
        }
      }

      // árboles de patio
      const nTree = Math.floor(hash(gx, gy, 30) * (dist < 0.2 ? 5 : 2));
      for (let i = 0; i < nTree; i++) {
        trees.push({
          x: bx + 6 + hash(gx + i, gy, 31) * (bw - 12),
          y: by + 6 + hash(gy + i, gx, 32) * (bd - 12),
          r: 2.5 + hash(i, gx, 33) * 4,
          seed: hash(i, gy, 34),
        });
      }
    }
  }

  // avenida norte-sur que nace en 1895 (despeje): marcar edificios cercanos a demolición vía et alta + landmark
  const avX = cx;
  for (const b of buildings) {
    if (Math.abs(b.x + b.w / 2 - avX) < 14 && b.y < cy - 40) {
      // sobreviven pocos; el resto “se demuele” en etapa 2 visualmente vía despeje bake
    }
  }

  const landmarks: Landmark[] = [
    { nombre: "Plaza Mayor", x: cx, y: cy, nivel: 1, nota: "El corazón del plano." },
    { nombre: "Cabildo", x: cx - W * 0.012, y: cy - H * 0.004, nivel: 1, nota: "Fachada a la plaza." },
    { nombre: "Catedral", x: cx + W * 0.014, y: cy - H * 0.003, nivel: 1, nota: "Torre a la vista." },
    { nombre: "Mercado", x: cx - W * 0.04, y: cy - H * 0.08, nivel: 2, nota: "Puestos y carretas." },
    {
      nombre: "Estación del Parque",
      x: cx + W * 0.06,
      y: cy - H * 0.09,
      nivel: 2,
      nota: "Cabecera del ferrocarril.",
    },
    {
      nombre: "Aduana",
      x: cx + W * 0.02,
      y: cy + H * 0.035,
      nivel: 2,
      nota: "Junto a la barranca.",
    },
    {
      nombre: "Obelisco",
      x: cx + W * 0.04,
      y: cy - H * 0.11,
      nivel: 1,
      nota: "Obra de 1936.",
      desde: 1940,
    },
    {
      nombre: "Congreso",
      x: cx - W * 0.005,
      y: cy - H * 0.2,
      nivel: 1,
      nota: "Desde el Centenario.",
      desde: 1910,
    },
    {
      nombre: "Puerto Nuevo",
      x: cx + W * 0.01,
      y: cy + H * 0.09,
      nivel: 1,
      nota: "Tierra ganada al río.",
      rio: true,
      desde: 1921,
    },
    {
      nombre: "Teatro",
      x: cx + W * 0.055,
      y: cy - H * 0.085,
      nivel: 2,
      nota: "Sobre la vieja estación.",
      desde: 1910,
    },
  ];

  return {
    W,
    H,
    metro,
    plaza,
    marco,
    blocks,
    buildings,
    trees,
    landmarks,
    coastY,
    seed,
  };
}
