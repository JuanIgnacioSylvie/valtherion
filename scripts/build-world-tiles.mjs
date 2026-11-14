/**
 * Baker DZI / Zomboid — UNA imagen fuente → pirámide de tiles.
 *
 * No procedural. No segundo sistema.
 * Nivel máximo = resolución nativa del paint (recortes 512, sin upscale).
 * Niveles bajos = downsample ½ del nivel superior (cadena DZI clásica).
 *
 * Coords de archivo: tiles en espacio imagen (px del paint).
 * El viewer mapea imagen → mundo con scale world/paint.
 *
 * pnpm tiles:build
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const WORLD_W = 1920;
const WORLD_H = 911;
const TILE_PX = 512;
const CONCURRENCY = 6;
const MASTER_PATH = path.join(root, "apps/web/public/worlds/valtherion/map-master.jpg");
const PAINT_PATH = path.join(root, "apps/web/public/worlds/valtherion/map-dnd-v4.jpg");
const SOURCE_PATH = fs.existsSync(MASTER_PATH) ? MASTER_PATH : PAINT_PATH;
const OUT_DIR = path.join(root, "apps/web/public/worlds/valtherion/tiles");

function levelDimensions(srcW, srcH, maxLevel, z) {
  const scale = 2 ** (maxLevel - z);
  return {
    w: Math.max(1, Math.ceil(srcW / scale)),
    h: Math.max(1, Math.ceil(srcH / scale)),
  };
}

function maxLevelFor(srcW, srcH) {
  // Menor z-max tal que un tile 512 cubra el eje mayor a 1:1 o menos
  const m = Math.max(srcW, srcH);
  return Math.max(0, Math.ceil(Math.log2(m / TILE_PX)));
}

async function bakeLevelFromImage(imagePathOrBuf, imgW, imgH, z, outLevelDir) {
  const cols = Math.ceil(imgW / TILE_PX);
  const rows = Math.ceil(imgH / TILE_PX);
  fs.mkdirSync(outLevelDir, { recursive: true });

  const jobs = [];
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      jobs.push({ tx, ty });
    }
  }

  let done = 0;
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async ({ tx, ty }) => {
        const left = tx * TILE_PX;
        const top = ty * TILE_PX;
        const ew = Math.min(TILE_PX, imgW - left);
        const eh = Math.min(TILE_PX, imgH - top);
        // Bordes DZI: tile puede ser < 512 (como OpenSeadragon) — sin pad ni upscale
        await sharp(imagePathOrBuf)
          .extract({ left, top, width: ew, height: eh })
          .webp({ quality: 85, effort: 4 })
          .toFile(path.join(outLevelDir, `${tx}_${ty}.webp`));
      }),
    );
    done += batch.length;
  }
  return { cols, rows, tiles: done };
}

async function main() {
  if (!fs.existsSync(SOURCE_PATH)) {
    console.error("Missing source:", SOURCE_PATH);
    process.exit(1);
  }

  const meta = await sharp(SOURCE_PATH).metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  const maxLevel = maxLevelFor(srcW, srcH);

  console.log(`Source ${path.basename(SOURCE_PATH)} ${srcW}×${srcH}  DZI maxLevel=${maxLevel}  tile=${TILE_PX}`);
  if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Generar de arriba hacia abajo: primero imagen a cada resolución, luego tilea
  const levels = [];
  let total = 0;

  for (let z = maxLevel; z >= 0; z--) {
    const { w, h } = levelDimensions(srcW, srcH, maxLevel, z);
    console.log(`Level ${z}: raster ${w}×${h}`);

    let rasterPath = SOURCE_PATH;
    let tmp;
    if (z !== maxLevel) {
      tmp = path.join(OUT_DIR, `_raster_${z}.jpg`);
      await sharp(SOURCE_PATH)
        .resize(w, h, { fit: "fill", kernel: sharp.kernel.lanczos3 })
        .jpeg({ quality: 90 })
        .toFile(tmp);
      rasterPath = tmp;
    }

    const levelDir = path.join(OUT_DIR, String(z));
    const { cols, rows, tiles } = await bakeLevelFromImage(rasterPath, w, h, z, levelDir);
    total += tiles;
    levels.push({ z, cols, rows, imageWidth: w, imageHeight: h });
    console.log(`  → ${cols}×${rows} tiles`);

    if (tmp && fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }

  levels.sort((a, b) => a.z - b.z);

  // zoom Pixi absoluto donde 1 px pantalla ≈ 1 px del paint
  const nativeZoom = srcW / WORLD_W;

  const manifest = {
    version: 3,
    model: "dzi-single-source",
    worldWidth: WORLD_W,
    worldHeight: WORLD_H,
    imageWidth: srcW,
    imageHeight: srcH,
    tileSize: TILE_PX,
    minLevel: 0,
    maxLevel,
    format: "webp",
    urlTemplate: "/worlds/valtherion/tiles/{z}/{x}_{y}.webp",
    /** zoom Pixi (px/u mundo) donde 1 px pantalla ≈ 1 px del paint */
    nativeZoom,
    source: { file: path.basename(SOURCE_PATH), width: srcW, height: srcH },
    levels,
    builtAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(OUT_DIR, "tiles.json"), JSON.stringify(manifest, null, 2));
  console.log(`OK ${total} tiles  nativeZoom=${nativeZoom.toFixed(4)}  (1:1 con el paint)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
