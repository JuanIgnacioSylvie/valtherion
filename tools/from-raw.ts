/**
 * Convierte public/plano/_raw.jpg|.png|.tif (escaneo Gallica/BNE/CNIG) en
 * LOD + overlays. WebP no soporta >16383 px de lado → source queda en JPEG.
 *
 * Uso: pnpm plano:from-raw
 */
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = path.resolve("public/plano");
const DATOS = path.resolve("public/datos");
const CANDIDATES = ["_raw.jpg", "_raw.jpeg", "_raw.png", "_raw.tif", "_raw.tiff", "raw.jpg"];
const GLADE_W = 18919;
const GLADE_H = 13272;
/** Límite práctico WebP / GPU para LOD intermedio */
const MEDIO_MAX = 8192;

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  let rawPath: string | null = null;
  for (const c of CANDIDATES) {
    const p = path.join(OUT, c);
    if (await exists(p)) {
      rawPath = p;
      break;
    }
  }
  if (!rawPath) {
    throw new Error(
      "Poné el escaneo en public/plano/_raw.jpg (Gallica/BNE, dominio público) y reintentá.",
    );
  }

  console.log("Procesando", rawPath);
  const meta = await sharp(rawPath, { failOn: "none", limitInputPixels: false }).metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;
  console.log(`${w}×${h}`);

  // Source full-res como JPEG (WebP no aguanta el ancho Gallica)
  const sourceJpg = path.join(OUT, "source.jpg");
  if (path.resolve(rawPath) !== path.resolve(sourceJpg)) {
    await copyFile(rawPath, sourceJpg);
  }
  console.log("source.jpg ok");

  const medioW = Math.min(w, MEDIO_MAX);
  await sharp(rawPath, { limitInputPixels: false })
    .resize({ width: medioW, height: MEDIO_MAX, fit: "inside", withoutEnlargement: true })
    .grayscale()
    .webp({ quality: 82, effort: 4 })
    .toFile(path.join(OUT, "medio.webp"));
  console.log("medio.webp ok");

  await sharp(path.join(OUT, "medio.webp"))
    .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(path.join(OUT, "chico.webp"));
  await sharp(path.join(OUT, "chico.webp"))
    .resize(1024, 1024, { fit: "inside" })
    .webp({ quality: 70 })
    .toFile(path.join(OUT, "primero.webp"));
  console.log("chico/primero ok");

  // Overlays alineados al medio (UV)
  const overlaySrc = path.join(OUT, "medio.webp");
  const { data, info } = await sharp(overlaySrc)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const suelo = Buffer.alloc(info.width * info.height * 3);
  const calles = Buffer.alloc(info.width * info.height * 3);
  const relieve = Buffer.alloc(info.width * info.height);
  for (let i = 0, p = 0; i < info.width * info.height; i++, p += 4) {
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
    const ink = 1 - lum;
    const rio = lum < 0.42 && b > r + 8 ? Math.min(255, ink * 220) : lum < 0.35 ? ink * 80 : 0;
    const verd = g > r + 5 && g > b ? Math.min(255, (g - r) * 3) : 0;
    const edi = ink > 0.35 ? Math.min(255, ink * 200) : 0;
    suelo[i * 3] = rio;
    suelo[i * 3 + 1] = verd;
    suelo[i * 3 + 2] = edi;
    const street = ink > 0.55 && ink < 0.85 ? 200 : 0;
    calles[i * 3] = street;
    calles[i * 3 + 1] = street * 0.85;
    calles[i * 3 + 2] = street * 0.7;
    relieve[i] = Math.round(lum * 180 + 40);
  }
  await sharp(suelo, { raw: { width: info.width, height: info.height, channels: 3 } })
    .webp({ quality: 80 })
    .toFile(path.join(OUT, "suelo.webp"));
  await sharp(calles, { raw: { width: info.width, height: info.height, channels: 3 } })
    .webp({ quality: 80 })
    .toFile(path.join(OUT, "calles.webp"));
  await sharp(relieve, { raw: { width: info.width, height: info.height, channels: 1 } })
    .webp({ quality: 80 })
    .toFile(path.join(OUT, "relieve.webp"));
  console.log("overlays ok");

  const TILE = 1024;
  const laminas = {
    ancho: w,
    alto: h,
    tesela: TILE,
    cols: Math.ceil(w / TILE),
    rows: Math.ceil(h / TILE),
  };
  await writeFile(path.join(OUT, "laminas.json"), JSON.stringify(laminas));

  await mkdir(DATOS, { recursive: true });
  const ciudadPath = path.join(DATOS, "ciudad.json");
  let ciudad: Record<string, unknown> = {};
  if (await exists(ciudadPath)) {
    ciudad = JSON.parse(await readFile(ciudadPath, "utf8")) as Record<string, unknown>;
  }
  const prevPlano = (ciudad.plano ?? {}) as Record<string, number | number[]>;
  const prevW = typeof prevPlano.ancho === "number" ? prevPlano.ancho : w;
  const prevH = typeof prevPlano.alto === "number" ? prevPlano.alto : h;

  ciudad.plano = {
    ancho: w,
    alto: h,
    metro: 0.675 * (GLADE_W / w),
    plaza: [Math.round(w * (10335 / GLADE_W)), Math.round(h * (9485 / GLADE_H))],
    marco: [0, 0, w - 1, h - 1],
  };
  ciudad.nombre = "Buenos Aires — Glade 1867";
  ciudad.fuente = "Gallica BnF ark:/12148/btv1b53098699s";
  ciudad.synthetic = false;
  await writeFile(ciudadPath, JSON.stringify(ciudad, null, 2));

  if (prevW !== w || prevH !== h) {
    await scalePak(path.join(DATOS, "techos.pak"), prevW, prevH, w, h, 7, [0, 1, 2, 3]);
    await scalePak(path.join(DATOS, "arboles.pak"), prevW, prevH, w, h, 4, [0, 1]);
    console.log(`packs reescalados ${prevW}×${prevH} → ${w}×${h}`);
  }

  const geoPath = path.join(DATOS, "geo.json");
  if (await exists(geoPath)) {
    const geo = JSON.parse(await readFile(geoPath, "utf8")) as {
      A: number[];
      B: number[];
      nota?: string;
    };
    const sx = w / prevW;
    const sy = h / prevH;
    geo.A = [Math.round((geo.A[0] ?? 0) * sx), geo.A[1], geo.A[2]];
    geo.B = [Math.round((geo.B[0] ?? 0) * sy), geo.B[1], geo.B[2]];
    geo.nota =
      "Georref aproximada sobre Glade 1867 (Gallica). Calibrar con USIG/OSM.";
    await writeFile(geoPath, JSON.stringify(geo, null, 2));
  }

  console.log("OK → corré pnpm plano:tile");
}

async function scalePak(
  file: string,
  prevW: number,
  prevH: number,
  w: number,
  h: number,
  stride: number,
  xyIdx: number[],
) {
  if (!(await exists(file))) return;
  const buf = Buffer.from(await readFile(file));
  const f = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const sx = w / prevW;
  const sy = h / prevH;
  for (let i = 0; i + stride <= f.length; i += stride) {
    for (const k of xyIdx) {
      if (k === 0 || k === 2) f[i + k] *= sx;
      else if (k === 1 || k === 3) f[i + k] *= sy;
    }
  }
  await writeFile(file, Buffer.from(f.buffer, f.byteOffset, f.byteLength));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
