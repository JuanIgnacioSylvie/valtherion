/**
 * Parte source.webp (o chico.webp) en teselas WebP + laminas.json
 *
 * Uso: pnpm plano:tile
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PLANO = path.resolve("public/plano");
const TILE = 1024;

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const candidates = ["source.jpg", "_raw.jpg", "source.webp", "chico.webp"];
  let source = "";
  for (const c of candidates) {
    const p = path.join(PLANO, c);
    if (await exists(p)) {
      source = p;
      break;
    }
  }

  if (!source) {
    throw new Error("No hay public/plano/source.jpg|_raw.jpg|source.webp — corré pnpm plano:from-raw");
  }

  const img = sharp(source, { failOn: "none", limitInputPixels: false });
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) throw new Error("imagen sin dimensiones");

  const cols = Math.ceil(w / TILE);
  const rows = Math.ceil(h / TILE);
  const tilesDir = path.join(PLANO, "tiles");
  await mkdir(tilesDir, { recursive: true });

  console.log(`Tileando ${path.basename(source)} ${w}×${h} → ${cols}×${rows} (@${TILE})`);

  // Medio solo si cabe en WebP; si no, from-raw ya dejó uno reescalado
  if (w <= 16383 && h <= 16383) {
    await sharp(source, { limitInputPixels: false })
      .grayscale()
      .webp({ quality: 80, effort: 4 })
      .toFile(path.join(PLANO, "medio.webp"));
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const left = col * TILE;
      const top = row * TILE;
      const width = Math.min(TILE, w - left);
      const height = Math.min(TILE, h - top);
      const out = path.join(tilesDir, `${col}_${row}.webp`);
      await sharp(source, { limitInputPixels: false })
        .extract({ left, top, width, height })
        .grayscale()
        .webp({ quality: 82, effort: 3 })
        .toFile(out);
    }
    process.stdout.write(`  fila ${row + 1}/${rows}\r`);
  }
  console.log(`\n${cols * rows} tiles → ${tilesDir}`);

  const laminas = { ancho: w, alto: h, tesela: TILE, cols, rows };
  await writeFile(path.join(PLANO, "laminas.json"), JSON.stringify(laminas));
  console.log("laminas.json actualizado");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
