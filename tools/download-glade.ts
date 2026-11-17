/**
 * Baja el plano Glade 1867 desde Gallica.
 * Preferí IIIF full (18919×13272). Cloudflare suele bloquear fetch de Node:
 * si falla, abrí el ARK en el browser, guardá
 *   https://gallica.bnf.fr/iiif/ark:/12148/btv1b53098699s/f1/full/full/0/native.jpg
 * como public/plano/_raw.jpg y corré pnpm plano:from-raw && pnpm plano:tile.
 *
 * Uso: pnpm plano:fetch
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT_DIR = path.resolve("public/plano");
const RAW = path.join(OUT_DIR, "_raw.jpg");
const SOURCE = path.join(OUT_DIR, "source.webp");
const CHICO = path.join(OUT_DIR, "chico.webp");
const PRIMERO = path.join(OUT_DIR, "primero.webp");

/** Fuentes posibles (Gallica suele ir detrás de Cloudflare → 403 desde CI/bots). */
const SOURCES = [
  "https://gallica.bnf.fr/iiif/ark:/12148/btv1b53098699s/f1/full/full/0/native.jpg",
  "https://gallica.bnf.fr/ark:/12148/btv1b53098699s/f1.highres",
  "https://gallica.bnf.fr/iiif/ark:/12148/btv1b53098699s/f1/full/8000,/0/native.jpg",
  "https://gallica.bnf.fr/ark:/12148/btv1b53098699s/f1.medres",
];

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: "https://gallica.bnf.fr/",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  let buf: Buffer | null = null;
  for (const url of SOURCES) {
    try {
      console.log("Probando", url);
      buf = await fetchBuffer(url);
      break;
    } catch (e) {
      console.warn(String(e));
    }
  }
  if (!buf) {
    console.error(`
Gallica bloqueó la descarga automática (Cloudflare).

Opción A — placeholder para desarrollar:
  pnpm plano:placeholder
  pnpm plano:tile
  pnpm dev

Opción B — escaneo real (dominio público):
  1. Abrí https://gallica.bnf.fr/ark:/12148/btv1b53098699s
     o BNE https://bdh-rd.bne.es/viewer.vm?id=0000040933
  2. Guardá la imagen en public/plano/_raw.jpg
  3. pnpm plano:from-raw && pnpm plano:tile && pnpm dev
`);
    process.exit(2);
  }
  console.log("Descarga OK");
  await writeFile(RAW, buf);
  console.log(`raw: ${(buf.byteLength / 1e6).toFixed(2)} MB → ${RAW}`);

  const img = sharp(buf, { failOn: "none" }).rotate(); // respeta EXIF
  const meta = await img.metadata();
  console.log(`tamaño: ${meta.width}×${meta.height}`);

  await img.webp({ quality: 82, effort: 4 }).toFile(SOURCE);
  console.log("source.webp ok");

  // Preview rápido para boot (≈2k de lado mayor)
  const maxSide = 2048;
  await sharp(SOURCE)
    .resize({
      width: meta.width && meta.height && meta.width >= meta.height ? maxSide : undefined,
      height: meta.width && meta.height && meta.height > meta.width ? maxSide : undefined,
      fit: "inside",
      withoutEnlargement: true,
    })
    .grayscale()
    .webp({ quality: 78, effort: 4 })
    .toFile(CHICO);

  await sharp(CHICO)
    .resize(1024, 1024, { fit: "inside" })
    .webp({ quality: 70 })
    .toFile(PRIMERO);

  // Meta mínima para la app (metros/plaza se calibran en Fase 3)
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;
  const laminas = {
    ancho: w,
    alto: h,
    tesela: 1024,
    cols: Math.ceil(w / 1024),
    rows: Math.ceil(h / 1024),
  };
  await writeFile(path.join(OUT_DIR, "laminas.json"), JSON.stringify(laminas));

  const ciudad = {
    plano: {
      ancho: w,
      alto: h,
      // Escala aprox. del original: 0.675 m/px a ~19k; reescalamos al medres.
      metro: 0.675 * (18919 / w),
      plaza: [Math.round(w * (10335 / 18919)), Math.round(h * (9485 / 13272))],
    },
  };
  await mkdir(path.resolve("public/datos"), { recursive: true });
  await writeFile(path.resolve("public/datos/ciudad.json"), JSON.stringify(ciudad, null, 2));

  console.log("Listo. Corré: pnpm plano:tile && pnpm dev");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
