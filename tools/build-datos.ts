/**
 * Genera todos los datos runtime a partir del plano (placeholder o real):
 * ciudad (techos/muros/árboles), overlay hoy, crece/despeje, hitos, épocas.
 *
 * Uso: pnpm datos:build
 */
import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve("public");
const DATOS = path.join(ROOT, "datos");
const PLANO = path.join(ROOT, "plano");

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

type Plano = { ancho: number; alto: number; metro: number; plaza: [number, number] };

type Techo = {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  seed: number;
  /** 0 = 1867; 1..6 = épocas posteriores */
  et: number;
};

const EPOCAS = [
  { año: 1867, titulo: "Plano de Carlos Glade", corto: "Glade 1867" },
  {
    año: 1888,
    titulo: "Plano de Latzina",
    corto: "Latzina 1888",
    obras: "La ciudad se espacia hacia el oeste.",
  },
  {
    año: 1895,
    titulo: "Plano de la Municipalidad",
    corto: "Municipalidad 1895",
    obras: "Avenida de Mayo y tierra ganada al río.",
  },
  { año: 1905, titulo: "Plano de Pablo Ludwig", corto: "Ludwig 1905" },
  {
    año: 1910,
    titulo: "Ludwig — Exposición del Centenario",
    corto: "Ludwig 1910",
    obras: "Plaza del Congreso.",
  },
  {
    año: 1921,
    titulo: "Cannizzaro / Ludwig",
    corto: "Cannizzaro 1921",
    obras: "Diagonales y Puerto Nuevo.",
  },
  {
    año: 1940,
    titulo: "Peuser + obras hasta 1940",
    corto: "Peuser 1936 / 1940",
    obras: "9 de Julio, Obelisco, ensanches.",
  },
];

async function loadPlano(): Promise<Plano> {
  const j = JSON.parse(await readFile(path.join(DATOS, "ciudad.json"), "utf8")) as {
    plano: Plano;
  };
  return j.plano;
}

/** Manzanas / techos alineados al placeholder (o grilla genérica sobre cualquier hoja). */
function synthesizeCity(plano: Plano): {
  techos: Techo[];
  arboles: { x: number; y: number; r: number; seed: number }[];
  manzanas: number;
} {
  const { ancho: W, alto: H, plaza } = plano;
  const [cx, cy] = plaza;
  const block = Math.max(28, Math.round(W / 108));
  const techos: Techo[] = [];
  const arboles: { x: number; y: number; r: number; seed: number }[] = [];
  let manzanas = 0;

  for (let gy = Math.round(H * 0.05); gy < H * 0.78; gy += block) {
    for (let gx = Math.round(W * 0.05); gx < W * 0.95; gx += block) {
      const dx = (gx - cx) / W;
      const dy = (gy - cy) / H;
      const dist = Math.hypot(dx * 1.4, dy);
      if (dist > 0.42 && hash(gx, gy) > 0.35) continue;
      if (dist > 0.28 && hash(gx + 3, gy) > 0.55) continue;

      manzanas++;
      const bw = block - 10;
      const bh = block - 10;
      const dens = dist < 0.12 ? 0.85 : dist < 0.22 ? 0.55 : 0.28;
      const cellsX = 2 + Math.floor(hash(gx, gy) * 2);
      const cellsY = 2 + Math.floor(hash(gy, gx) * 2);
      const cw = bw / cellsX;
      const ch = bh / cellsY;

      for (let iy = 0; iy < cellsY; iy++) {
        for (let ix = 0; ix < cellsX; ix++) {
          if (hash(gx + ix * 17, gy + iy * 13) > dens) continue;
          const w = cw * (0.55 + hash(ix, iy) * 0.4);
          const d = ch * (0.55 + hash(iy, ix) * 0.4);
          const x = gx + ix * cw + cw * 0.5;
          const y = gy + iy * ch + ch * 0.5;
          const h = 4 + hash(x, y) * (dist < 0.15 ? 10 : 5);
          let et = 0;
          if (dist > 0.18 && hash(x * 0.1, y) > 0.55) et = 1 + Math.floor(hash(y, x) * 5);
          techos.push({
            x,
            y,
            w,
            d,
            h,
            seed: hash(x, y),
            et,
          });
        }
      }

      // árboles en patios / bordes
      if (dist < 0.35 && hash(gx, gy + 9) > 0.4) {
        const n = 1 + Math.floor(hash(gy, gx) * 3);
        for (let i = 0; i < n; i++) {
          arboles.push({
            x: gx + 6 + hash(gx + i, gy) * (bw - 12),
            y: gy + 6 + hash(gy + i, gx) * (bh - 12),
            r: 2.5 + hash(i, gx) * 3,
            seed: hash(gx + i, gy),
          });
        }
      }
    }
  }

  return { techos, arboles, manzanas };
}

/** Overlay “hoy”: avenidas + costa + tierra ganada (procedural). */
async function bakeHoy(plano: Plano) {
  const W = 2048;
  const H = Math.round((plano.alto / plano.ancho) * W);
  const sx = W / plano.ancho;
  const sy = H / plano.alto;
  const [cx, cy] = plano.plaza;

  // cerca: R = líneas calles; lejos: R líneas mayores, G tierra ganada
  const cerca = Buffer.alloc(W * H, 0);
  const lejosR = Buffer.alloc(W * H, 0);
  const lejosG = Buffer.alloc(W * H, 0);

  const set = (buf: Buffer, x: number, y: number, v: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    buf[i] = Math.max(buf[i], v);
  };

  const line = (buf: Buffer, x0: number, y0: number, x1: number, y1: number, w = 1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) set(buf, x + dx, y + dy, 255);
    }
  };

  // grilla de calles actuales (desfasada del plano histórico)
  const step = Math.round(38 * sx);
  for (let x = Math.round(W * 0.08); x < W * 0.92; x += step) {
    line(cerca, x, Math.round(H * 0.08), x, Math.round(H * 0.78), 0);
    if (x % (step * 4) < 2) line(lejosR, x, Math.round(H * 0.08), x, Math.round(H * 0.78), 1);
  }
  for (let y = Math.round(H * 0.08); y < H * 0.78; y += step) {
    line(cerca, Math.round(W * 0.08), y, Math.round(W * 0.92), y, 0);
    if (y % (step * 4) < 2) line(lejosR, Math.round(W * 0.08), y, Math.round(W * 0.92), y, 1);
  }

  // Av. de Mayo / 9 de Julio stubs
  line(cerca, Math.round(cx * sx), Math.round(H * 0.2), Math.round(cx * sx), Math.round(cy * sy), 1);
  line(lejosR, Math.round(cx * sx), Math.round(H * 0.2), Math.round(cx * sx), Math.round(cy * sy), 2);
  line(
    cerca,
    Math.round(W * 0.48),
    Math.round(cy * sy),
    Math.round(W * 0.62),
    Math.round(cy * sy),
    1,
  );
  line(
    lejosR,
    Math.round(W * 0.48),
    Math.round(cy * sy),
    Math.round(W * 0.62),
    Math.round(cy * sy),
    2,
  );

  // tierra ganada al río (sur/este del plano)
  for (let y = Math.round(H * 0.78); y < H * 0.95; y++) {
    for (let x = Math.round(W * 0.15); x < W * 0.85; x++) {
      const wave = Math.sin(x * 0.02) * 10;
      if (y > H * 0.82 + wave) set(lejosG, x, y, 200);
    }
  }
  // costa
  for (let x = Math.round(W * 0.12); x < W * 0.88; x++) {
    const y = Math.round(H * 0.82 + Math.sin(x * 0.02) * 10);
    set(lejosR, x, y, 255);
    set(cerca, x, y, 255);
  }

  const cercaRgb = Buffer.alloc(W * H * 3);
  const lejosRgb = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    cercaRgb[i * 3] = cerca[i];
    lejosRgb[i * 3] = lejosR[i];
    lejosRgb[i * 3 + 1] = lejosG[i];
  }

  await sharp(cercaRgb, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality: 80 })
    .toFile(path.join(PLANO, "hoy-cerca.webp"));
  await sharp(lejosRgb, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality: 80 })
    .toFile(path.join(PLANO, "hoy-lejos.webp"));
}

/** Texturas de crecimiento: R urbanizado, G fondos, B edificado (valor = etapa). */
async function bakeCrece(plano: Plano, techos: Techo[]) {
  const W = 1024;
  const H = Math.round((plano.alto / plano.ancho) * W);
  const sx = W / plano.ancho;
  const sy = H / plano.alto;
  const rgb = Buffer.alloc(W * H * 3);
  const des = Buffer.alloc(W * H * 3);
  const calles = Buffer.alloc(W * H * 3);

  const paint = (buf: Buffer, px: number, py: number, ch: number, v: number, r = 2) => {
    const x = Math.round(px * sx);
    const y = Math.round(py * sy);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const i = (yy * W + xx) * 3 + ch;
        buf[i] = Math.max(buf[i], v);
      }
    }
  };

  for (const t of techos) {
    // etapa → brillo: 1867=255 … última más baja (como el original)
    const etapas = 6;
    const v = Math.round(255 * ((etapas + 0.5 - t.et) / etapas));
    paint(rgb, t.x, t.y, 2, v, Math.max(1, Math.round((t.w * sx) / 2)));
    paint(rgb, t.x, t.y, 0, t.et === 0 ? 255 : v, Math.max(2, Math.round((t.w * sx) / 1.5)));
    if (t.et > 0) paint(rgb, t.x, t.y, 1, v, Math.max(2, Math.round((t.w * sx) / 1.2)));
  }

  // avenida despejada (centro vertical)
  for (let y = Math.round(H * 0.2); y < H * 0.75; y++) {
    for (let x = Math.round(plano.plaza[0] * sx) - 3; x <= Math.round(plano.plaza[0] * sx) + 3; x++) {
      if (x < 0 || x >= W) continue;
      const i = (y * W + x) * 3;
      des[i] = 200; // demolido
      des[i + 2] = y > H * 0.4 ? 180 : 0; // calzada
      calles[i] = 200;
      calles[i + 2] = 220;
    }
  }

  await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality: 80 })
    .toFile(path.join(PLANO, "crece.webp"));
  await sharp(des, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality: 80 })
    .toFile(path.join(PLANO, "despeje.webp"));
  await sharp(calles, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality: 80 })
    .toFile(path.join(PLANO, "calles.webp"));

  // relieve simple (barranca hacia la costa)
  const rel = Buffer.alloc(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ny = y / H;
      const h = Math.max(0, 1 - ny * 1.35) * 180 + Math.sin(x * 0.04) * 8;
      rel[y * W + x] = Math.max(0, Math.min(255, h));
    }
  }
  await sharp(rel, { raw: { width: W, height: H, channels: 1 } })
    .webp({ quality: 80 })
    .toFile(path.join(PLANO, "relieve.webp"));

  // suelo color: R río, G patio, B edificado
  const suelo = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      if (y > H * 0.82) suelo[i] = 200;
      suelo[i + 1] = rgb[(y * W + x) * 3 + 1] > 40 ? 160 : 0;
      suelo[i + 2] = rgb[(y * W + x) * 3 + 2];
    }
  }
  await sharp(suelo, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality: 80 })
    .toFile(path.join(PLANO, "suelo.webp"));
}

function hitos(plano: Plano) {
  const [cx, cy] = plano.plaza;
  const m = plano.metro;
  return [
    { nombre: "Plaza de la Victoria", x: cx, y: cy, nivel: 1, nota: "Hoy Plaza de Mayo." },
    { nombre: "Cabildo", x: cx - 80, y: cy - 20, nivel: 1, nota: "Fachada colonial." },
    { nombre: "Catedral", x: cx + 90, y: cy - 10, nivel: 1, nota: "" },
    { nombre: "Obelisco", x: cx + 800, y: cy - 1100, nivel: 1, rio: false, nota: "Desde 1936.", desde: 1940 },
    { nombre: "Congreso", x: cx - 20, y: cy - 2600, nivel: 1, nota: "Desde 1906.", desde: 1910 },
    { nombre: "Teatro Colón", x: cx + 1200, y: cy - 1200, nivel: 2, nota: "Estación del Parque en 1867.", desde: 1910 },
    { nombre: "Puerto Madero", x: cx, y: cy + 1400, nivel: 1, rio: true, nota: "En 1867 era río.", desde: 1921 },
    { nombre: "Casa Rosada", x: cx + 40, y: cy + 320, nivel: 2, nota: "Sobre el Fuerte." },
  ].map((h) => ({
    ...h,
    // coords ya en px; metros solo para debug
    mx: (h.x - cx) * m,
    mz: (h.y - cy) * m,
  }));
}

async function main() {
  await mkdir(DATOS, { recursive: true });
  await mkdir(PLANO, { recursive: true });

  if (!(await exists(path.join(DATOS, "ciudad.json")))) {
    throw new Error("Falta public/datos/ciudad.json — corré pnpm plano:placeholder primero");
  }

  const plano = await loadPlano();
  console.log(`Plano ${plano.ancho}×${plano.alto}, metro=${plano.metro.toFixed(3)}`);

  const { techos, arboles, manzanas } = synthesizeCity(plano);
  console.log(`${manzanas} manzanas · ${techos.length} techos · ${arboles.length} árboles`);

  // Compact binary: Float32 [x,y,w,d,h,seed,et] per techo
  const techoBuf = Buffer.alloc(techos.length * 7 * 4);
  techos.forEach((t, i) => {
    const o = i * 7 * 4;
    techoBuf.writeFloatLE(t.x, o);
    techoBuf.writeFloatLE(t.y, o + 4);
    techoBuf.writeFloatLE(t.w, o + 8);
    techoBuf.writeFloatLE(t.d, o + 12);
    techoBuf.writeFloatLE(t.h, o + 16);
    techoBuf.writeFloatLE(t.seed, o + 20);
    techoBuf.writeFloatLE(t.et, o + 24);
  });
  await writeFile(path.join(DATOS, "techos.pak"), techoBuf);

  const arbBuf = Buffer.alloc(arboles.length * 4 * 4);
  arboles.forEach((a, i) => {
    const o = i * 16;
    arbBuf.writeFloatLE(a.x, o);
    arbBuf.writeFloatLE(a.y, o + 4);
    arbBuf.writeFloatLE(a.r, o + 8);
    arbBuf.writeFloatLE(a.seed, o + 12);
  });
  await writeFile(path.join(DATOS, "arboles.pak"), arbBuf);

  const ciudad = {
    plano,
    manzanas,
    techos: techos.length,
    arboles: arboles.length,
    muros: techos.length * 4,
    etapas: EPOCAS.length - 1,
  };
  await writeFile(path.join(DATOS, "ciudad.json"), JSON.stringify(ciudad, null, 2));
  await writeFile(path.join(DATOS, "epocas.json"), JSON.stringify({ epocas: EPOCAS }, null, 2));
  await writeFile(path.join(DATOS, "hoy.json"), JSON.stringify(hitos(plano), null, 2));

  // Georref seed (Plaza de Mayo ≈ Victoria)
  const geo = {
    origen: { lat: -34.6083, lon: -58.3722 },
    // metros por grado aprox
    mLat: 110940,
    mLon: 111320 * Math.cos((-34.6083 * Math.PI) / 180),
    // px = plaza + R * localEN (grado 1 + correcciones mínimas)
    A: [plano.plaza[0], -121.97 * (plano.ancho / 18919), 1468.63 * (plano.ancho / 18919)],
    B: [plano.plaza[1], 1459.72 * (plano.alto / 13272), 108.77 * (plano.alto / 13272)],
  };
  await writeFile(path.join(DATOS, "geo.json"), JSON.stringify(geo, null, 2));

  console.log("Bake overlays…");
  await bakeHoy(plano);
  await bakeCrece(plano, techos);
  console.log("OK → public/datos + public/plano/{hoy,crece,despeje,calles,relieve,suelo}");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
