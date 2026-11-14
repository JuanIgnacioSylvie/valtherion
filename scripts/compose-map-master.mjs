/**
 * Compone master HD único (Zomboid/DZI).
 * SCALE alto + parches de detalle (Cenizabrava = 4 cuadrantes cosidos).
 *
 * pnpm map:compose && pnpm tiles:build
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pub = path.join(root, "apps/web/public/worlds/valtherion");
const gen = path.join(root, "content/art-refs/generated");

const WORLD_W = 1920;
const WORLD_H = 911;
/** 12× → ciudad 220u ≈ 2640 px (desde stitch 3072); mundi ~23k */
const SCALE = 12;
const MASTER_W = WORLD_W * SCALE;
const MASTER_H = WORLD_H * SCALE;

const BASE = path.join(pub, "map-dnd-v4.jpg");
const OUT = path.join(pub, "map-master.jpg");
const OUT_META = path.join(pub, "map-master.json");
const CITY_STITCH = path.join(gen, "cenizabrava-city-stitched.jpg");

async function stitchCenizabrava() {
  const quads = [
    ["ceniza-quad-nw.jpg", 0, 0],
    ["ceniza-quad-ne.jpg", 1, 0],
    ["ceniza-quad-sw.jpg", 0, 1],
    ["ceniza-quad-se.jpg", 1, 1],
  ];
  for (const [name] of quads) {
    if (!fs.existsSync(path.join(gen, name))) {
      console.warn("missing quad", name, "— fallback city hd");
      return path.join(gen, "cenizabrava-city-hd-topdown.jpg");
    }
  }

  // Collage con overlap + crossfade para disimular costuras entre quads IA
  const Q = 1600;
  const overlap = 160;
  const step = Q - overlap;
  const outW = step + Q;
  const outH = step + Q;
  const canvas = Buffer.alloc(outW * outH * 4, 0);

  for (const [name, cx, cy] of quads) {
    const { data, info } = await sharp(path.join(gen, name))
      .resize(Q, Q, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ox = cx * step;
    const oy = cy * step;
    for (let y = 0; y < Q; y++) {
      for (let x = 0; x < Q; x++) {
        const edgeX = Math.min(x, Q - 1 - x);
        const edgeY = Math.min(y, Q - 1 - y);
        // Solo fade en bordes interiores del collage
        let a = 1;
        if (cx === 0 && x > Q - overlap) a = Math.min(a, (Q - x) / overlap);
        if (cx === 1 && x < overlap) a = Math.min(a, x / overlap);
        if (cy === 0 && y > Q - overlap) a = Math.min(a, (Q - y) / overlap);
        if (cy === 1 && y < overlap) a = Math.min(a, y / overlap);
        a = Math.max(0, Math.min(1, a));
        const si = (y * Q + x) * info.channels;
        const dx = ox + x;
        const dy = oy + y;
        if (dx < 0 || dy < 0 || dx >= outW || dy >= outH) continue;
        const di = (dy * outW + dx) * 4;
        const srcA = (data[si + 3] ?? 255) / 255;
        const wa = a * srcA;
        const inv = 1 - wa;
        canvas[di] = Math.round(data[si] * wa + canvas[di] * inv);
        canvas[di + 1] = Math.round(data[si + 1] * wa + canvas[di + 1] * inv);
        canvas[di + 2] = Math.round(data[si + 2] * wa + canvas[di + 2] * inv);
        canvas[di + 3] = Math.min(255, canvas[di + 3] + Math.round(255 * wa));
      }
    }
  }

  await sharp(canvas, { raw: { width: outW, height: outH, channels: 4 } })
    .removeAlpha()
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(CITY_STITCH);

  console.log(`  stitched city ${outW}×${outH} (overlap ${overlap}) → ${path.basename(CITY_STITCH)}`);
  return CITY_STITCH;
}

async function featheredPatch(file, dw, dh, featherPx) {
  const resized = await sharp(file)
    .resize(dw, dh, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const f = Math.max(1, Math.min(featherPx, Math.floor(Math.min(dw, dh) / 5)));
  const out = Buffer.alloc(dw * dh * 4);

  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const i = (y * dw + x) * info.channels;
      const o = (y * dw + x) * 4;
      const edge = Math.min(x, y, dw - 1 - x, dh - 1 - y);
      const a = edge >= f ? 1 : edge / f;
      out[o] = data[i];
      out[o + 1] = data[i + 1];
      out[o + 2] = data[i + 2];
      out[o + 3] = Math.round(255 * a);
    }
  }

  return sharp(out, { raw: { width: dw, height: dh, channels: 4 } }).png().toBuffer();
}

async function main() {
  console.log(`Master ${MASTER_W}×${MASTER_H} (scale ${SCALE}×)`);

  const cityFile = await stitchCenizabrava();
  const selvaFile = fs.existsSync(path.join(gen, "selvareth-canopy-hd2.jpg"))
    ? path.join(gen, "selvareth-canopy-hd2.jpg")
    : path.join(gen, "selvareth-region-hd.jpg");

  const PATCHES = [
    {
      id: "korthaven-ashlands",
      file: path.join(gen, "korthaven-ashlands-hd.jpg"),
      x: 40,
      y: 360,
      w: 480,
      h: 360,
      feather: 56,
    },
    {
      id: "selvareth",
      file: selvaFile,
      x: 980,
      y: 360,
      w: 320,
      h: 320,
      feather: 48,
    },
    {
      id: "cenizabrava",
      file: cityFile,
      x: 170,
      y: 480,
      w: 220,
      h: 220,
      feather: 20,
    },
  ];

  // Base a escala (lanczos). En disco usamos JPEG por tamaño.
  console.log("  resizing base…");
  const baseBuf = await sharp(BASE)
    .resize(MASTER_W, MASTER_H, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  const composites = [];
  const applied = [];

  for (const p of PATCHES) {
    if (!fs.existsSync(p.file)) {
      console.warn("skip missing", p.id);
      continue;
    }
    const dx = Math.round(p.x * SCALE);
    const dy = Math.round(p.y * SCALE);
    const dw = Math.round(p.w * SCALE);
    const dh = Math.round(p.h * SCALE);
    const feather = Math.round((p.feather ?? 32) * (SCALE / 8));
    console.log(`  patch ${p.id} → ${dw}×${dh} @ (${dx},${dy})`);
    const input = await featheredPatch(p.file, dw, dh, feather);
    composites.push({ input, left: dx, top: dy });
    applied.push({
      ...p,
      file: path.basename(p.file),
      px: { x: dx, y: dy, w: dw, h: dh },
    });
  }

  console.log("  compositing…");
  await sharp(baseBuf)
    .composite(composites)
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(OUT);

  const meta = {
    worldWidth: WORLD_W,
    worldHeight: WORLD_H,
    scale: SCALE,
    masterWidth: MASTER_W,
    masterHeight: MASTER_H,
    base: path.basename(BASE),
    patches: applied,
    builtAt: new Date().toISOString(),
  };
  fs.writeFileSync(OUT_META, JSON.stringify(meta, null, 2));

  const st = fs.statSync(OUT);
  console.log(`OK ${OUT} (${(st.size / 1024 / 1024).toFixed(1)} MB) nativeZoom=${SCALE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
