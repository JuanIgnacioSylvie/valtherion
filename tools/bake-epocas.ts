/**
 * Alinea planos históricos (Latzina 1888, Ludwig ~1900) al Glade y
 * actualiza crece.webp / despeje con máscaras de ensanche reales.
 *
 * Requiere: public/plano/_latzina1888.jpg, _ludwig1900.jpg (Wikimedia)
 * Uso: pnpm epocas:bake
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { refinePlaza } from "./lib/hatch-parcels.ts";

const PLANO = path.resolve("public/plano");
const DATOS = path.resolve("public/datos");

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadGray(file: string, maxW: number) {
  const { data, info } = await sharp(file, { failOn: "none", limitInputPixels: false })
    .resize({ width: maxW, height: maxW, fit: "inside", withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { gray: data, w: info.width, h: info.height };
}

function toInk(gray: Buffer, w: number, h: number) {
  const samples: number[] = [];
  for (let i = 0; i < gray.length; i += 17) samples.push(gray[i]);
  samples.sort((a, b) => a - b);
  const paper = samples[Math.floor(samples.length * 0.75)] ?? 200;
  const cut = paper * 0.88;
  const ink = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    ink[i] = Math.max(0, Math.min(1, (cut - gray[i]) / Math.max(40, cut * 0.55)));
  }
  return ink;
}

/** Urban bbox: región con tinta media alta. */
function urbanBBox(ink: Float32Array, w: number, h: number, thr = 0.12) {
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  const cell = 8;
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      let s = 0;
      let n = 0;
      for (let dy = 0; dy < cell && y + dy < h; dy++) {
        for (let dx = 0; dx < cell && x + dx < w; dx++) {
          s += ink[(y + dy) * w + (x + dx)];
          n++;
        }
      }
      if (s / n > thr) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + cell > maxX) maxX = x + cell;
        if (y + cell > maxY) maxY = y + cell;
      }
    }
  }
  if (maxX <= minX) return { minX: 0, minY: 0, maxX: w, maxY: h };
  return { minX, minY, maxX, maxY };
}

/**
 * Remuestrea inkSrc al frame Glade alineando plazas + escala de bbox urbano.
 * Asume misma orientación (N a la derecha) o prueba rotación 0.
 */
function warpToGlade(
  inkSrc: Float32Array,
  sw: number,
  sh: number,
  plazaSrc: [number, number],
  bboxSrc: { minX: number; minY: number; maxX: number; maxY: number },
  gw: number,
  gh: number,
  plazaG: [number, number],
  bboxG: { minX: number; minY: number; maxX: number; maxY: number },
): Float32Array {
  const out = new Float32Array(gw * gh);
  const srcW = bboxSrc.maxX - bboxSrc.minX;
  const srcH = bboxSrc.maxY - bboxSrc.minY;
  const dstW = bboxG.maxX - bboxG.minX;
  const dstH = bboxG.maxY - bboxG.minY;
  const scale = 0.5 * (dstW / srcW + dstH / srcH);

  // map: glade pixel → src pixel via plaza anchor
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const dx = (x - plazaG[0]) / scale;
      const dy = (y - plazaG[1]) / scale;
      const sx = plazaSrc[0] + dx;
      const sy = plazaSrc[1] + dy;
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) continue;
      const x0 = sx | 0;
      const y0 = sy | 0;
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = y0 * sw + x0;
      const v =
        inkSrc[i00] * (1 - fx) * (1 - fy) +
        inkSrc[i00 + 1] * fx * (1 - fy) +
        inkSrc[i00 + sw] * (1 - fx) * fy +
        inkSrc[i00 + sw + 1] * fx * fy;
      out[y * gw + x] = v;
    }
  }
  return out;
}

async function main() {
  await mkdir(PLANO, { recursive: true });
  const ciudad = JSON.parse(await readFile(path.join(DATOS, "ciudad.json"), "utf8")) as {
    plano: { ancho: number; alto: number; metro: number; plaza: [number, number] };
  };
  const { ancho: fullW, alto: fullH, plaza } = ciudad.plano;

  const gladePath = (await exists(path.join(PLANO, "medio.webp")))
    ? path.join(PLANO, "medio.webp")
    : path.join(PLANO, "source.jpg");

  const WORK = 2048;
  const glade = await loadGray(gladePath, WORK);
  const gInk = toInk(glade.gray, glade.w, glade.h);
  const gScaleX = glade.w / fullW;
  const gScaleY = glade.h / fullH;
  const gPlaza: [number, number] = [plaza[0] * gScaleX, plaza[1] * gScaleY];
  const gPlazaR = refinePlaza(gInk, glade.w, glade.h, gPlaza[0], gPlaza[1], 70);
  const gBBox = urbanBBox(gInk, glade.w, glade.h);
  console.log(`Glade ${glade.w}×${glade.h} plaza ${gPlazaR.map((v) => v.toFixed(0)).join(",")}`);

  const maps: Array<{ file: string; et: number; name: string }> = [];
  if (await exists(path.join(PLANO, "_latzina1888.jpg"))) {
    maps.push({ file: path.join(PLANO, "_latzina1888.jpg"), et: 1, name: "Latzina 1888" });
  }
  if (await exists(path.join(PLANO, "_ludwig1900.jpg"))) {
    maps.push({ file: path.join(PLANO, "_ludwig1900.jpg"), et: 3, name: "Ludwig 1900" });
  }
  if (!maps.length) {
    console.warn("No hay _latzina1888.jpg / _ludwig1900.jpg — solo bake procedural");
  }

  const warped: Array<{ ink: Float32Array; et: number; name: string }> = [];
  for (const m of maps) {
    const src = await loadGray(m.file, WORK);
    const ink = toInk(src.gray, src.w, src.h);
    const bbox = urbanBBox(ink, src.w, src.h);
    // plaza ≈ centro del bbox urbano (Latzina/Ludwig a menudo N≠derecha; probar centro)
    let plazaS: [number, number] = [
      (bbox.minX + bbox.maxX) / 2,
      (bbox.minY + bbox.maxY) / 2,
    ];
    plazaS = refinePlaza(ink, src.w, src.h, plazaS[0], plazaS[1], 90);
    const wInk = warpToGlade(
      ink,
      src.w,
      src.h,
      plazaS,
      bbox,
      glade.w,
      glade.h,
      gPlazaR,
      gBBox,
    );
    warped.push({ ink: wInk, et: m.et, name: m.name });
    console.log(`${m.name}: bbox ${bbox.maxX - bbox.minX}×${bbox.maxY - bbox.minY} → warp OK`);
  }

  // Bake crece a resolución de trabajo, luego upscale a 1536
  const W = 1536;
  const H = Math.round((fullH / fullW) * W);
  const sx = W / fullW;
  const sy = H / fullH;
  const rgb = Buffer.alloc(W * H * 3);
  const des = Buffer.alloc(W * H * 3);

  // base: tinta Glade = etapa 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const gx = Math.min(glade.w - 1, Math.floor((x / W) * glade.w));
      const gy = Math.min(glade.h - 1, Math.floor((y / H) * glade.h));
      const g = gInk[gy * glade.w + gx];
      const i = (y * W + x) * 3;
      if (g > 0.14) {
        rgb[i] = 255; // R urbano 1867
        rgb[i + 2] = Math.round(Math.min(255, g * 255));
      }
    }
  }

  // Diff históricos: tinta en mapa nuevo donde Glade era papel → ensanche
  for (const m of warped) {
    const etapas = 6;
    const v = Math.round(255 * ((etapas + 0.5 - m.et) / etapas));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const gx = Math.min(glade.w - 1, Math.floor((x / W) * glade.w));
        const gy = Math.min(glade.h - 1, Math.floor((y / H) * glade.h));
        const hist = m.ink[gy * glade.w + gx];
        const base = gInk[gy * glade.w + gx];
        if (hist > 0.18 && base < 0.1) {
          const i = (y * W + x) * 3;
          rgb[i] = Math.max(rgb[i], v); // llega en época m.et
          rgb[i + 1] = Math.max(rgb[i + 1], v); // G ensanche
          rgb[i + 2] = Math.max(rgb[i + 2], Math.round(hist * 200));
        }
      }
    }
    console.log(`diff ${m.name} → etapa ${m.et}`);
  }

  // Tierra ganada + avenidas (mismo criterio que extract)
  const [cx, cy] = plaza;
  const metro = ciudad.plano.metro;
  const coastY = Math.round((cy + 450 / metro) * sy);
  for (let y = coastY; y < H * 0.95; y++) {
    for (let x = Math.round(W * 0.15); x < W * 0.85; x++) {
      const i = (y * W + x) * 3;
      const v = Math.round(90 + ((y - coastY) / (H * 0.12)) * 80);
      rgb[i] = Math.max(rgb[i], Math.min(200, v));
      rgb[i + 1] = Math.max(rgb[i + 1], Math.min(180, v));
    }
  }
  // Av de Mayo / 9 de Julio despeje
  const stroke = (x0: number, y0: number, x1: number, y1: number, thick: number, v: number) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      for (let dy = -thick; dy <= thick; dy++) {
        for (let dx = -thick; dx <= thick; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = (yy * W + xx) * 3;
          des[j] = Math.max(des[j], v);
        }
      }
    }
  };
  stroke(Math.round(cx * sx), Math.round(cy * sy), Math.round(cx * sx), Math.round((cy - 2800 / metro) * sy), 3, 220);
  const ox = cx + 900 / metro;
  const oy = cy - 1600 / metro;
  stroke(Math.round(ox * sx), Math.round((oy - 1200 / metro) * sy), Math.round(ox * sx), Math.round((oy + 800 / metro) * sy), 5, 200);

  await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality: 84 })
    .toFile(path.join(PLANO, "crece.webp"));
  await sharp(des, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality: 84 })
    .toFile(path.join(PLANO, "despeje.webp"));

  // Previews alineados (para debug / futuro blend de placa)
  for (const m of warped) {
    const prev = Buffer.alloc(glade.w * glade.h);
    for (let i = 0; i < m.ink.length; i++) prev[i] = Math.round((1 - m.ink[i]) * 255);
    const name = m.name.includes("Latzina") ? "epoca-1888.webp" : "epoca-1900.webp";
    await sharp(prev, { raw: { width: glade.w, height: glade.h, channels: 1 } })
      .webp({ quality: 80 })
      .toFile(path.join(PLANO, name));
  }

  const epocas = JSON.parse(await readFile(path.join(DATOS, "epocas.json"), "utf8"));
  epocas.fuentes = {
    "1867": "Gallica Glade",
    "1888": maps.some((m) => m.et === 1) ? "Latzina (Wikimedia/Gallica)" : null,
    "1900": maps.some((m) => m.et === 3) ? "Ludwig (Wikimedia/Gallica)" : null,
  };
  await writeFile(path.join(DATOS, "epocas.json"), JSON.stringify(epocas, null, 2));

  console.log("OK → crece/despeje + epoca-*.webp");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
