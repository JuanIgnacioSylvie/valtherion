/**
 * Modelo procedural de Aurion — ciudad grande humana amurallada (D&D 3.5 Cityscape /
 * Entornos Urbanos). Escala DMG Tabla 5-2: Large City 12.001–25.000 adultos.
 *
 * Distritos base (Cityscape cap. 1): cívico, torre del señor, templo, mercado,
 * residencial medio/alto, guarnición/puertas, almacenes, muelle de pescadores.
 */

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
  kind?: string;
  desde?: number;
  hasta?: number;
  rio?: boolean;
};

/** Metadatos Cityscape / DMG para Aurion y futuras ciudades. */
export type SettlementMeta = {
  /** thorp | hamlet | village | small_town | large_town | small_city | large_city | metropolis */
  tier: "large_city";
  /** Adultos (DMG Tabla 5-2). */
  population: number;
  gpLimit: number;
  alignment: string;
  /** % humano dominante (Cityscape: human-dominated culture). */
  humanPct: number;
  walled: boolean;
  /** Diámetro aprox. de muralla en metros. */
  wallDiameterM: number;
  wallHeightM: number;
  wallThickM: number;
  districtsTarget: number;
  source: string;
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
  coastY: (x: number) => number;
  harborY: (x: number) => number;
  wallRx: number;
  wallRy: number;
  seed: number;
  nombre: string;
  settlement: SettlementMeta;
};

export function hash(x: number, y: number, s = 1) {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Huella orgánica de muralla: óvalo irregular + mordida del puerto al sur. */
function insideWalls(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  harborGap = false,
): boolean {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  const ang = Math.atan2(dy, dx);
  // hueco sur para dársena (Cityscape: puertas/muelles perforan la cortina)
  if (harborGap && ang > 0.55 && ang < Math.PI - 0.55 && dy > 0.35) {
    const gap = 1.12 + 0.08 * Math.sin(ang * 2);
    if (dx * dx + dy * dy < gap * gap) return false;
  }
  const wobble =
    1 +
    0.07 * Math.sin(ang * 3 + seed) +
    0.045 * Math.sin(ang * 7 + seed * 0.3) +
    0.035 * Math.cos(ang * 5);
  return dx * dx + dy * dy < wobble * wobble;
}

/**
 * Aurion — ciudad grande (~18k), humana, amurallada, con puerto.
 * Lienzo ~2.2×1.7 km; muralla ~1.35 km de diámetro (Comparable a Four Winds / Dragonport).
 */
export function buildCityModel(opts?: {
  W?: number;
  H?: number;
  seed?: number;
}): CityModel {
  // hoja compacta (antes 12288×8616 ≈ metrópoli BA)
  const W = opts?.W ?? 4096;
  const H = opts?.H ?? 3072;
  const seed = opts?.seed ?? 4217;

  const wallDiameterM = 1350;
  const wallRx = W * 0.3;
  const wallRy = H * 0.34;
  const metro = wallDiameterM / (2 * wallRx);

  const settlement: SettlementMeta = {
    tier: "large_city",
    population: 18420,
    gpLimit: 40000,
    alignment: "LN",
    humanPct: 82,
    walled: true,
    wallDiameterM,
    wallHeightM: 8.4, // ~27 ft — cortina + adarve
    wallThickM: 3.6, // ~12 ft
    districtsTarget: 40,
    source: "D&D 3.5 Cityscape / Entornos Urbanos + DMG Tabla 5-2",
  };

  // Plaza al centro del casco (ligero norte para dejar bahía al sur)
  const plaza: [number, number] = [Math.round(W * 0.5), Math.round(H * 0.48)];
  const marco: [number, number, number, number] = [
    Math.round(W * 0.04),
    Math.round(H * 0.05),
    Math.round(W * 0.96),
    Math.round(H * 0.96),
  ];

  const [cx, cy] = plaza;

  // Costa al sur con bahía frente al casco
  const coastY = (x: number) => {
    const t = (x - cx) / W;
    const bay = Math.exp(-Math.pow((x - cx) / (W * 0.1), 2));
    return (
      H * 0.72 +
      Math.sin(t * 14 + seed) * H * 0.008 +
      Math.sin(t * 37) * H * 0.004 -
      bay * H * 0.048
    );
  };

  const harborY = (x: number) => coastY(x) - H * 0.01;

  const blocks: Block[] = [];
  const buildings: Building[] = [];
  const trees: Tree[] = [];

  /** Calle Real N–S + cruces E–O: dejar libre de casas. */
  const onAvenue = (bx: number, by: number) => {
    const dx = Math.abs(bx - cx);
    const dy = by - cy;
    // avenida principal (~14 m ≈ 14/metro px)
    const aveHalf = Math.max(10, 9 / metro);
    if (dx < aveHalf && dy > -wallRy * 0.98 && dy < wallRy * 0.62) return true;
    // cruces E–O
    if (Math.abs(dy) < aveHalf * 0.85 && dx < wallRx * 0.95) return true;
    if (Math.abs(dy + wallRy * 0.22) < aveHalf * 0.7 && dx < wallRx * 0.55) return true;
    if (Math.abs(dy - wallRy * 0.26) < aveHalf * 0.7 && dx < wallRx * 0.45) return true;
    return false;
  };

  /** Huecos de puertas (N/E/O) sin manzanas pegadas. */
  const nearGate = (bx: number, by: number) => {
    const gates: [number, number][] = [
      [cx, cy - wallRy],
      [cx + wallRx, cy],
      [cx - wallRx, cy],
    ];
    for (const [gx, gy] of gates) {
      if (Math.hypot(bx - gx, by - gy) < 55) return true;
    }
    return false;
  };

  // Manzanas radiales compactas (5 anillos: casco denso, no metrópoli)
  const rings = 5;
  const rays = 28;
  const plazaClear = Math.min(W, H) * 0.042;

  for (let ring = 1; ring <= rings; ring++) {
    const r0 = plazaClear + (ring - 1) * (wallRx / rings) * (0.88 + hash(ring, seed, 1) * 0.12);
    const r1 = plazaClear + ring * (wallRx / rings) * (0.9 + hash(ring, seed, 2) * 0.1);
    const nRay = rays + ring;
    for (let i = 0; i < nRay; i++) {
      if (hash(ring, i, seed + 9) > 0.86) continue;
      const a0 = (i / nRay) * Math.PI * 2 + hash(ring, i, seed) * 0.12;
      const a1 = ((i + 1) / nRay) * Math.PI * 2 + hash(ring, i + 1, seed) * 0.12;
      const am = (a0 + a1) * 0.5 + (hash(i, ring, 55) - 0.5) * 0.1;
      const southBias = 0.86 + 0.28 * Math.max(0, Math.sin(am));
      const rm = ((r0 + r1) * 0.5 + (hash(i, ring, 56) - 0.5) * (r1 - r0) * 0.3) * southBias;
      const stretch = wallRy / wallRx;
      const bx = cx + Math.cos(am) * rm * (0.94 + hash(am, ring, 57) * 0.12);
      const by = cy + Math.sin(am) * rm * stretch;
      if (!insideWalls(bx, by, cx, cy, wallRx * 1.02, wallRy * 1.05, seed)) continue;
      if (by > coastY(bx) - 28) continue;
      if (onAvenue(bx, by) || nearGate(bx, by)) continue;

      const chord = Math.abs(a1 - a0) * rm;
      const depth = (r1 - r0) * (0.72 + hash(i, ring, seed) * 0.2);
      const bw = Math.max(16, chord * 0.78);
      const bd = Math.max(14, depth * (0.55 + hash(ring, i, 3) * 0.35));
      const jx = (hash(i, ring, 4) - 0.5) * bw * 0.12;
      const jy = (hash(ring, i, 5) - 0.5) * bd * 0.12;
      const x = bx - bw / 2 + jx;
      const y = by - bd / 2 + jy;
      const dist = Math.hypot((bx - cx) / wallRx, (by - cy) / wallRy);
      const urban = dist < 0.92;
      blocks.push({ x, y, w: bw, d: bd, urban });

      if (!urban) {
        if (hash(bx, by, seed) > 0.4) {
          buildings.push({
            x: x + bw * 0.25,
            y: y + bd * 0.25,
            w: bw * 0.32,
            d: bd * 0.28,
            h: 3.6 + hash(bx, by, 6) * 2.4,
            seed: hash(bx, by, 7),
            et: 0,
          });
        }
        for (let t = 0; t < 2 + Math.floor(hash(bx, by, 10) * 3); t++) {
          trees.push({
            x: x + 3 + hash(bx + t, by, 11) * (bw - 6),
            y: y + 3 + hash(by + t, bx, 12) * (bd - 6),
            r: 2.5 + hash(t, bx, 13) * 3,
            seed: hash(t, by, 14),
          });
        }
        continue;
      }

      // barrio opulento cerca de la plaza: parcelas mayores y más altas
      const opulent = dist < 0.18;
      const dens = opulent ? 0.92 : dist < 0.28 ? 0.9 : dist < 0.45 ? 0.84 : 0.72;
      const target = opulent
        ? Math.max(18, Math.min(bw, bd, 34))
        : Math.max(14, Math.min(bw, bd, 28));
      const cellsX = Math.max(1, Math.round(bw / target));
      const cellsY = Math.max(1, Math.round(bd / target));
      const cw = (bw - 3) / cellsX;
      const ch = (bd - 3) / cellsY;
      for (let iy = 0; iy < cellsY; iy++) {
        for (let ix = 0; ix < cellsX; ix++) {
          if (hash(i + ix * 19, ring + iy * 17, seed) > dens) continue;
          const fill = (opulent ? 0.68 : 0.56) + hash(ix, iy + i, 22) * 0.24;
          const m = Math.min(cw, ch) * fill;
          // variedad: ~12% casas alargadas / angostas; resto estándar
          const odd = hash(ix + 3, iy + ring, 41);
          let w = Math.max(6, Math.min(opulent ? 28 : 22, m * (0.9 + hash(ix, ring, 23) * 0.22)));
          let d = Math.max(6, Math.min(opulent ? 26 : 22, m * (0.9 + hash(iy, i, 24) * 0.22)));
          if (odd > 0.88) {
            w *= 1.35;
            d *= 0.72;
          } else if (odd > 0.78) {
            w *= 0.7;
            d *= 1.4;
          } else if (odd > 0.7 && opulent) {
            // mansión casi cuadrada
            const side = Math.max(w, d) * 1.15;
            w = side;
            d = side * 0.92;
          }
          const px = x + 1.5 + ix * cw + Math.max(1.2, (cw - w) * 0.5);
          const py = y + 1.5 + iy * ch + Math.max(1.2, (ch - d) * 0.5);
          if (onAvenue(px + w / 2, py + d / 2)) continue;
          const hBase = opulent ? 5.2 : 3.5;
          const hSpan = opulent ? 5.5 : dist < 0.38 ? 3.2 : 2.2;
          const h =
            hBase +
            hash(px, py, 28) * hSpan +
            (opulent && hash(px, py, 29) > 0.72 ? 3.2 : 0) +
            (dist < 0.09 && hash(px, py, 29) > 0.84 ? 2.2 : 0);
          let et = 0;
          if (dist > 0.55 && hash(px, py, 26) > 0.55) et = 1 + Math.floor(hash(py, px, 27) * 3);
          buildings.push({
            x: px,
            y: py,
            w,
            d,
            h,
            seed: hash(px, py, 30),
            et,
          });
          // ala secundaria ocasional (casa en L)
          if (odd > 0.93 && opulent) {
            const wing = Math.min(w, d) * 0.55;
            buildings.push({
              x: px + w * 0.55,
              y: py + d * 0.15,
              w: wing,
              d: d * 0.7,
              h: h * 0.85,
              seed: hash(px + 1, py, 31),
              et,
            });
          }
        }
      }

      const nTree = Math.floor(hash(i, ring, 31) * (dist < 0.3 ? 3 : 1.5));
      for (let t = 0; t < nTree; t++) {
        trees.push({
          x: x + 3 + hash(i + t, ring, 32) * (bw - 6),
          y: y + 3 + hash(ring + t, i, 33) * (bd - 6),
          r: 2 + hash(t, i, 34) * 3,
          seed: hash(t, ring, 35),
        });
      }
    }
  }

  // Árboles de la plaza
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    trees.push({
      x: cx + Math.cos(a) * plazaClear * 0.7,
      y: cy + Math.sin(a) * plazaClear * 0.55,
      r: 3.2 + hash(i, seed, 40) * 2.4,
      seed: hash(i, seed, 41),
    });
  }

  // Franja del puerto: warehouse + fishers' wharf (Cityscape)
  const portX = cx;
  const portY = Math.round(coastY(portX) - 8);
  for (let i = -8; i <= 8; i++) {
    const x = portX + i * 32 + (hash(i, seed, 60) - 0.5) * 8;
    const y = coastY(x) - 42 - hash(i, seed, 61) * 28;
    if (hash(i, seed, 62) < 0.18) continue;
    if (!insideWalls(x, y, cx, cy, wallRx * 1.08, wallRy * 1.1, seed)) continue;
    const w = 12 + hash(i, seed, 63) * 16;
    const d = 9 + hash(i, seed, 64) * 12;
    buildings.push({
      x: x - w / 2,
      y: y - d / 2,
      w,
      d,
      h: 3.8 + hash(i, seed, 65) * 4.5,
      seed: hash(i, seed, 66),
      et: 0,
    });
    blocks.push({ x: x - w / 2 - 3, y: y - d / 2 - 3, w: w + 6, d: d + 6, urban: true });
  }

  const landmarks: Landmark[] = [
    {
      nombre: "Plaza Mayor",
      x: cx,
      y: cy,
      nivel: 1,
      nota: "Distrito cívico: mercado, pregón y justicia.",
      kind: "plaza",
    },
    {
      nombre: "Alcázar Real",
      x: Math.round(cx - W * 0.028),
      y: Math.round(cy - H * 0.02),
      nivel: 1,
      nota: "Torre del señor / keep (Cityscape: Lord's Keep).",
      kind: "alcazar",
    },
    {
      nombre: "Catedral de Aurion",
      x: Math.round(cx + W * 0.032),
      y: Math.round(cy - H * 0.014),
      nivel: 1,
      nota: "Distrito de templo.",
      kind: "catedral",
    },
    {
      nombre: "Mercado Cubierto",
      x: Math.round(cx - W * 0.045),
      y: Math.round(cy + H * 0.016),
      nivel: 2,
      nota: "Marketplace: granos y especias del Mar Interior.",
      kind: "mercado",
    },
    {
      nombre: "Puerta del Norte",
      x: Math.round(cx),
      y: Math.round(cy - wallRy),
      nivel: 2,
      nota: "Guarnición y Calle Real hacia Lexmara.",
      kind: "puerta",
    },
    {
      nombre: "Puerta del Este",
      x: Math.round(cx + wallRx),
      y: Math.round(cy),
      nivel: 2,
      nota: "Salida de caravanas.",
      kind: "puerta_este",
    },
    {
      nombre: "Puerta del Oeste",
      x: Math.round(cx - wallRx),
      y: Math.round(cy),
      nivel: 2,
      nota: "Camino a las aldeas del interior.",
      kind: "puerta_oeste",
    },
    {
      nombre: "Muralla",
      x: Math.round(cx + wallRx * 0.78),
      y: Math.round(cy - wallRy * 0.2),
      nivel: 2,
      nota: `Cortina ~${settlement.wallHeightM} m / ${settlement.wallThickM} m (Four Winds).`,
      kind: "muralla",
    },
    {
      nombre: "Puerto Real",
      x: Math.round(portX),
      y: Math.round(portY),
      nivel: 1,
      nota: "Fisher's Wharf / Waterfront + dársena (Dragonport).",
      kind: "puerto",
      rio: true,
    },
    {
      nombre: "Muelle Largo",
      x: Math.round(portX + 55),
      y: Math.round(coastY(portX + 55) + 18),
      nivel: 2,
      nota: "Embarque de mercantes.",
      kind: "muelle",
      rio: true,
    },
    {
      nombre: "Astillero",
      x: Math.round(portX - 90),
      y: Math.round(coastY(portX - 90) - 20),
      nivel: 2,
      nota: "Warehouse / astillero de ribera.",
      kind: "astillero",
      rio: true,
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
    harborY,
    wallRx,
    wallRy,
    seed,
    nombre: "Aurion — Capital",
    settlement,
  };
}
