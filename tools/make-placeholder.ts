/**
 * Genera un plano placeholder (papel + trama urbana inventada) para desarrollar
 * sin el escaneo. Reemplazá con el Glade real vía:
 *   1) bajá el JPG de Gallica/BNE a public/plano/_raw.jpg
 *   2) pnpm plano:from-raw
 *   3) pnpm plano:tile
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const W = 4096;
const H = 2867; // ~ misma proporción que 18919×13272
const OUT = path.resolve("public/plano");

function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const rgba = Buffer.alloc(W * H * 3);

  // Papel base
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const n = hash(x * 0.02, y * 0.02) * 18 + hash(x * 0.1, y * 0.1) * 8;
      rgba[i] = 232 - n;
      rgba[i + 1] = 216 - n * 0.9;
      rgba[i + 2] = 180 - n * 0.7;
    }
  }

  const ink = (x: number, y: number, a = 1) => {
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return;
    const i = (y * W + x) * 3;
    const k = 1 - 0.55 * a;
    rgba[i] = Math.max(30, rgba[i] * k);
    rgba[i + 1] = Math.max(24, rgba[i + 1] * k);
    rgba[i + 2] = Math.max(18, rgba[i + 2] * k);
  };

  // Marco
  for (let x = 80; x < W - 80; x++) {
    for (let t = 0; t < 3; t++) {
      ink(x, 80 + t, 1);
      ink(x, H - 80 - t, 1);
    }
  }
  for (let y = 80; y < H - 80; y++) {
    for (let t = 0; t < 3; t++) {
      ink(80 + t, y, 1);
      ink(W - 80 - t, y, 1);
    }
  }

  // “Ciudad”: grilla rotada ~ ligeramente, densa al centro (plaza)
  const cx = Math.round(W * 0.546);
  const cy = Math.round(H * 0.715);
  const block = 38;

  for (let gy = 120; gy < H - 120; gy += block) {
    for (let gx = 120; gx < W - 120; gx += block) {
      const dx = (gx - cx) / W;
      const dy = (gy - cy) / H;
      const dist = Math.hypot(dx * 1.4, dy);
      if (dist > 0.42 && hash(gx, gy) > 0.35) continue;
      if (dist > 0.28 && hash(gx + 3, gy) > 0.55) continue;

      // manzana
      const bw = block - 10;
      const bh = block - 10;
      for (let x = gx; x < gx + bw; x++) {
        ink(x, gy, 0.85);
        ink(x, gy + bh, 0.85);
      }
      for (let y = gy; y < gy + bh; y++) {
        ink(gx, y, 0.85);
        ink(gx + bw, y, 0.85);
      }

      // “edificios” / rayado interior cerca del centro
      if (dist < 0.22) {
        for (let y = gy + 4; y < gy + bh - 4; y += 3) {
          for (let x = gx + 4; x < gx + bw - 4; x++) {
            if (hash(x, y) > 0.4) ink(x, y, 0.35);
          }
        }
      }
    }
  }

  // Costa / río al “este” del plano (abajo en nuestro placeholder)
  for (let x = 100; x < W - 100; x++) {
    const wave = Math.sin(x * 0.01) * 18 + Math.sin(x * 0.03) * 8;
    const y0 = Math.round(H * 0.82 + wave);
    for (let y = y0; y < H - 100; y++) {
      if (hash(x, y) > 0.25) ink(x, y, 0.15 + ((y - y0) / (H - y0)) * 0.2);
    }
    for (let t = 0; t < 2; t++) ink(x, y0 + t, 0.9);
  }

  // Plaza
  for (let y = cy - 28; y < cy + 28; y++) {
    for (let x = cx - 40; x < cx + 40; x++) {
      if (Math.abs(x - cx) < 38 && Math.abs(y - cy) < 26) {
        // dejar más claro (plaza)
        const i = (y * W + x) * 3;
        rgba[i] = Math.min(245, rgba[i] + 12);
        rgba[i + 1] = Math.min(230, rgba[i + 1] + 10);
        rgba[i + 2] = Math.min(200, rgba[i + 2] + 8);
      }
    }
  }

  const raw = await sharp(rgba, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality: 82 })
    .toBuffer();

  await writeFile(path.join(OUT, "source.webp"), raw);
  await sharp(raw).resize(2048, 2048, { fit: "inside" }).webp({ quality: 78 }).toFile(path.join(OUT, "chico.webp"));
  await sharp(raw).resize(1024, 1024, { fit: "inside" }).webp({ quality: 70 }).toFile(path.join(OUT, "primero.webp"));

  const laminas = { ancho: W, alto: H, tesela: 1024, cols: Math.ceil(W / 1024), rows: Math.ceil(H / 1024) };
  await writeFile(path.join(OUT, "laminas.json"), JSON.stringify(laminas));

  await mkdir(path.resolve("public/datos"), { recursive: true });
  await writeFile(
    path.resolve("public/datos/ciudad.json"),
    JSON.stringify(
      {
        plano: {
          ancho: W,
          alto: H,
          metro: 0.675 * (18919 / W),
          plaza: [cx, cy],
        },
        placeholder: true,
      },
      null,
      2,
    ),
  );

  console.log(`Placeholder ${W}×${H} → public/plano/{source,chico,primero}.webp`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
