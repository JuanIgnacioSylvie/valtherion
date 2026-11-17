/**
 * Extrae ciudad densa alineada al damero del Glade.
 * Prioridad: estructuras sobre el plano (no timeline).
 *
 * Uso: pnpm datos:extract
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PLANO = path.resolve("public/plano");
const DATOS = path.resolve("public/datos");

const EPOCAS = [
  { año: 1867, titulo: "Plano de Carlos Glade", corto: "Glade 1867" },
  { año: 1888, titulo: "Latzina", corto: "1888" },
  { año: 1895, titulo: "Municipalidad", corto: "1895" },
  { año: 1905, titulo: "Ludwig", corto: "1905" },
  { año: 1910, titulo: "Centenario", corto: "1910" },
  { año: 1921, titulo: "Diagonales", corto: "1921" },
  { año: 1940, titulo: "Ciudad moderna", corto: "1940" },
];

type Techo = { x: number; y: number; w: number; d: number; h: number; seed: number; et: number };
type Arbol = { x: number; y: number; r: number; seed: number };

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function hash(x: number, y: number, s = 1) {
  const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function findStreetPeaks(profile: Float32Array, minSep: number, maxRel: number): number[] {
  const n = profile.length;
  const sm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    let c = 0;
    for (let k = -2; k <= 2; k++) {
      const j = i + k;
      if (j < 0 || j >= n) continue;
      s += profile[j];
      c++;
    }
    sm[i] = s / c;
  }
  let mean = 0;
  for (let i = 0; i < n; i++) mean += sm[i];
  mean /= n;
  const thr = mean * maxRel;
  const peaks: number[] = [];
  for (let i = 2; i < n - 2; i++) {
    if (sm[i] > thr) continue;
    if (sm[i] <= sm[i - 1] && sm[i] <= sm[i + 1]) {
      if (!peaks.length || i - peaks[peaks.length - 1] >= minSep) peaks.push(i);
      else if (sm[i] < sm[peaks[peaks.length - 1]]) peaks[peaks.length - 1] = i;
    }
  }
  return peaks;
}

async function loadWorkImage() {
  const ciudad = JSON.parse(await readFile(path.join(DATOS, "ciudad.json"), "utf8")) as {
    plano: { ancho: number; alto: number };
  };
  const fullW = ciudad.plano.ancho;
  const fullH = ciudad.plano.alto;
  let src = path.join(PLANO, "medio.webp");
  if (!(await exists(src))) {
    src = (await exists(path.join(PLANO, "source.jpg")))
      ? path.join(PLANO, "source.jpg")
      : path.join(PLANO, "_raw.jpg");
  }
  const { data, info } = await sharp(src, { limitInputPixels: false, failOn: "none" })
    .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  console.log(`trabajo ${info.width}×${info.height} ← ${path.basename(src)}`);
  return { gray: data, w: info.width, h: info.height, fullW, fullH };
}

function extractCity(
  gray: Buffer,
  w: number,
  h: number,
  fullW: number,
  fullH: number,
  plaza: [number, number],
) {
  const sx = fullW / w;
  const sy = fullH / h;
  const [cxFull, cyFull] = plaza;
  const cx = cxFull / sx;
  const cy = cyFull / sy;

  const x0 = Math.round(w * 0.055);
  const y0 = Math.round(h * 0.07);
  const x1 = Math.round(w * 0.955);
  const y1 = Math.round(h * 0.78);

  const samples: number[] = [];
  for (let y = y0; y < y1; y += 3)
    for (let x = x0; x < x1; x += 3) samples.push(gray[y * w + x]);
  samples.sort((a, b) => a - b);
  const paper = samples[Math.floor(samples.length * 0.75)] ?? 200;
  const inkCut = paper * 0.88;

  const ink = new Float32Array(w * h);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * w + x;
      ink[i] = Math.max(0, Math.min(1, (inkCut - gray[i]) / Math.max(40, inkCut * 0.55)));
    }
  }

  const band = Math.round(Math.min(w, h) * 0.22);
  const colInk = new Float32Array(w);
  const colN = new Float32Array(w);
  const rowInk = new Float32Array(h);
  const rowN = new Float32Array(h);
  const yA = Math.max(y0, Math.round(cy - band));
  const yB = Math.min(y1, Math.round(cy + band));
  const xA = Math.max(x0, Math.round(cx - band));
  const xB = Math.min(x1, Math.round(cx + band));

  for (let y = yA; y < yB; y++) {
    for (let x = x0; x < x1; x++) {
      colInk[x] += ink[y * w + x];
      colN[x]++;
    }
  }
  for (let y = y0; y < y1; y++) {
    for (let x = xA; x < xB; x++) {
      rowInk[y] += ink[y * w + x];
      rowN[y]++;
    }
  }
  for (let x = 0; x < w; x++) colInk[x] = colN[x] ? colInk[x] / colN[x] : 1;
  for (let y = 0; y < h; y++) rowInk[y] = rowN[y] ? rowInk[y] / rowN[y] : 1;

  const blockPx = Math.round(160 / sx);
  const minSep = Math.max(8, Math.round(blockPx * 0.55));
  let vStreets = findStreetPeaks(colInk, minSep, 0.72).filter((x) => x >= x0 && x < x1);
  let hStreets = findStreetPeaks(rowInk, minSep, 0.72).filter((y) => y >= y0 && y < y1);

  if (vStreets.length < 8) {
    vStreets = [];
    for (let x = Math.round(cx); x > x0; x -= blockPx) vStreets.push(x);
    for (let x = Math.round(cx) + blockPx; x < x1; x += blockPx) vStreets.push(x);
    vStreets.sort((a, b) => a - b);
  }
  if (hStreets.length < 8) {
    hStreets = [];
    for (let y = Math.round(cy); y > y0; y -= blockPx) hStreets.push(y);
    for (let y = Math.round(cy) + blockPx; y < y1; y += blockPx) hStreets.push(y);
    hStreets.sort((a, b) => a - b);
  }
  if (vStreets[0] > x0 + 4) vStreets.unshift(x0);
  if (vStreets[vStreets.length - 1] < x1 - 4) vStreets.push(x1);
  if (hStreets[0] > y0 + 4) hStreets.unshift(y0);
  if (hStreets[hStreets.length - 1] < y1 - 4) hStreets.push(y1);

  console.log(`calles V=${vStreets.length} H=${hStreets.length}`);

  const densAt = (x0b: number, y0b: number, x1b: number, y1b: number) => {
    let s = 0;
    let n = 0;
    for (let y = y0b; y < y1b; y += 2) {
      for (let x = x0b; x < x1b; x += 2) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        s += ink[y * w + x];
        n++;
      }
    }
    return n ? s / n : 0;
  };

  const techos: Techo[] = [];
  const arboles: Arbol[] = [];
  let manzanas = 0;
  const streetPad = Math.max(2, Math.round(minSep * 0.08));

  for (let iy = 0; iy < hStreets.length - 1; iy++) {
    for (let ix = 0; ix < vStreets.length - 1; ix++) {
      const bx0 = vStreets[ix] + streetPad;
      const bx1 = vStreets[ix + 1] - streetPad;
      const by0 = hStreets[iy] + streetPad;
      const by1 = hStreets[iy + 1] - streetPad;
      const bw = bx1 - bx0;
      const bh = by1 - by0;
      if (bw < minSep * 0.45 || bh < minSep * 0.45) continue;

      const dens = densAt(bx0, by0, bx1, by1);
      if (dens < 0.05) {
        // plazas / vacíos → árboles
        const n = 3 + Math.floor(hash(ix, iy, 1) * 8);
        for (let t = 0; t < n; t++) {
          if (hash(ix + t, iy, 2) > 0.55) continue;
          arboles.push({
            x: (bx0 + 3 + hash(ix + t, iy, 3) * (bw - 6)) * sx,
            y: (by0 + 3 + hash(iy + t, ix, 4) * (bh - 6)) * sy,
            r: 4 + hash(t, ix, 5) * 7,
            seed: hash(ix, iy + t, 6),
          });
        }
        continue;
      }
      if (dens < 0.09 && hash(ix, iy, 7) > 0.5) continue;

      // Manzanas absurdas (calles mal detectadas) → saltar
      const maxBlock = blockPx * 3.5;
      if (bw > maxBlock || bh > maxBlock) continue;

      manzanas++;
      // Lote típico ~12–25 m ≈ 18–37 px full → en work
      const lot = Math.max(6, Math.round(28 / sx));
      const parcelsX = Math.max(1, Math.min(8, Math.round(bw / lot)));
      const parcelsY = Math.max(1, Math.min(8, Math.round(bh / lot)));
      const pw = bw / parcelsX;
      const ph = bh / parcelsY;
      // tope duro de footprint en px full (~35 m)
      const maxFoot = 52;

      for (let py = 0; py < parcelsY; py++) {
        for (let px = 0; px < parcelsX; px++) {
          const p0x = Math.round(bx0 + px * pw);
          const p0y = Math.round(by0 + py * ph);
          const p1x = Math.round(bx0 + (px + 1) * pw);
          const p1y = Math.round(by0 + (py + 1) * ph);
          const pd = densAt(p0x, p0y, p1x, p1y);

          const isInner =
            parcelsX > 2 &&
            parcelsY > 2 &&
            px > 0 &&
            px < parcelsX - 1 &&
            py > 0 &&
            py < parcelsY - 1;
          if (isInner && pd < 0.22) {
            if (hash(px, py, 8) > 0.4) {
              arboles.push({
                x: ((p0x + p1x) / 2) * sx,
                y: ((p0y + p1y) / 2) * sy,
                r: 2.5 + hash(px, py, 9) * 4,
                seed: hash(px, py, 10),
              });
            }
            continue;
          }
          if (pd < 0.06) continue;
          if (pd < 0.1 && hash(px, py, 11) > 0.45) continue;

          const gap = 0.08 + hash(px, py, 12) * 0.08;
          let ww = (p1x - p0x) * (1 - gap * 2) * (0.82 + hash(px, py, 13) * 0.14);
          let dd = (p1y - p0y) * (1 - gap * 2) * (0.82 + hash(py, px, 14) * 0.14);
          const wx = p0x + Math.max(0, p1x - p0x - ww) * (0.3 + hash(px, py, 15) * 0.4);
          const wy = p0y + Math.max(0, p1y - p0y - dd) * (0.3 + hash(py, px, 16) * 0.4);

          let fw = Math.max(8, ww * sx);
          let fd = Math.max(8, dd * sy);
          // evitar “tablas” / manzanas enteras como un solo techo
          if (fw > maxFoot) fw = maxFoot * (0.7 + hash(px, py, 19) * 0.25);
          if (fd > maxFoot) fd = maxFoot * (0.7 + hash(py, px, 20) * 0.25);
          if (fw / fd > 3.2) fw = fd * 2.4;
          if (fd / fw > 3.2) fd = fw * 2.4;

          const fx = (wx + ww / 2) * sx;
          const fy = (wy + dd / 2) * sy;
          const dist = Math.hypot((fx - cxFull) / fullW, (fy - cyFull) / fullH);

          const hBase = pd > 0.35 ? 6.5 : pd > 0.2 ? 4.8 : 3.4;
          const hCenter = dist < 0.07 ? 5.5 : dist < 0.14 ? 3 : dist < 0.22 ? 1.2 : 0;
          const h = hBase + hCenter + hash(fx, fy, 17) * 3.5;

          techos.push({
            x: fx,
            y: fy,
            w: fw,
            d: fd,
            h,
            seed: hash(fx * 0.01, fy * 0.01, 18),
            et: 0,
          });
        }
      }
    }
  }

  const MAX_T = 22000;
  const MAX_A = 12000;
  if (techos.length > MAX_T) {
    techos.sort((a, b) => b.h - a.h);
    techos.length = MAX_T;
  }
  if (arboles.length > MAX_A) arboles.length = MAX_A;

  console.log(`manzanas ${manzanas} · techos ${techos.length} · árboles ${arboles.length}`);
  return { techos, arboles, manzanas };
}

async function bakeOverlays(
  fullW: number,
  fullH: number,
  plaza: [number, number],
  metro: number,
  techos: Techo[],
  grayWork: Float32Array,
  workW: number,
  workH: number,
) {
  const W = 1536;
  const H = Math.round((fullH / fullW) * W);
  const sx = W / fullW;
  const sy = H / fullH;
  const [cx, cy] = plaza;
  const suelo = Buffer.alloc(W * H * 3);
  const calles = Buffer.alloc(W * H * 3);
  const crece = Buffer.alloc(W * H * 3);
  const des = Buffer.alloc(W * H * 3);
  const rel = Buffer.alloc(W * H);

  const set = (buf: Buffer, x: number, y: number, ch: number, v: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3 + ch;
    buf[i] = Math.max(buf[i], v);
  };

  // tinta → suelo: R río, G patio/verde, B edificado (desde el grabado)
  const paper = (() => {
    let s = 0;
    const n = Math.min(grayWork.length, 200_000);
    for (let i = 0; i < n; i += 17) s += grayWork[i]!;
    return s / (n / 17);
  })();
  const inkCut = paper * 0.88;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = (x / W) * workW;
      const fy = (y / H) * workH;
      const ix = Math.min(workW - 1, Math.max(0, Math.floor(fx)));
      const iy = Math.min(workH - 1, Math.max(0, Math.floor(fy)));
      const g = grayWork[iy * workW + ix]!;
      const ink = Math.max(0, Math.min(1, (inkCut - g) / Math.max(40, inkCut * 0.55)));
      const i = (y * W + x) * 3;
      // edificado = hatch denso
      suelo[i + 2] = Math.round(ink * 220);
      // patio = tinta media (fondos rayados suaves)
      suelo[i + 1] = Math.round(Math.max(0, 0.55 - Math.abs(ink - 0.28)) * 255);
      // río / costa este (Glade: E → +y)
      const ny = y / H;
      if (ny > 0.78) suelo[i] = Math.round(Math.min(255, (ny - 0.78) / 0.22 * 220));
      rel[y * W + x] = Math.max(0, Math.min(255, (1 - ny * 1.25) * 170 + 35));
    }
  }

  for (const t of techos) {
    const x = Math.round(t.x * sx);
    const y = Math.round(t.y * sy);
    const rw = Math.max(1, Math.round((t.w * sx) / 2));
    const rd = Math.max(1, Math.round((t.d * sy) / 2));
    for (let dy = -rd; dy <= rd; dy++) {
      for (let dx = -rw; dx <= rw; dx++) {
        set(suelo, x + dx, y + dy, 2, 210);
        set(crece, x + dx, y + dy, 0, 255);
        set(crece, x + dx, y + dy, 2, 220);
      }
    }
  }

  // calles: franjas entre manzanas + empedrado centro (R) / liso (G) / máscara (B)
  const step = Math.round((110 / metro) * sx);
  for (let x = Math.round(W * 0.08); x < W * 0.92; x += step) {
    for (let y = Math.round(H * 0.08); y < H * 0.78; y++) {
      set(calles, x, y, 2, 200);
      set(calles, x, y, 0, 200);
    }
  }
  for (let y = Math.round(H * 0.08); y < H * 0.78; y += step) {
    for (let x = Math.round(W * 0.08); x < W * 0.92; x++) {
      set(calles, x, y, 2, 200);
      set(calles, x, y, 0, 200);
    }
  }

  // plaza = patio verde
  {
    const px = Math.round(cx * sx);
    const py = Math.round(cy * sy);
    for (let dy = -48; dy <= 48; dy++) {
      for (let dx = -48; dx <= 48; dx++) {
        if (dx * dx + dy * dy < 48 * 48) set(suelo, px + dx, py + dy, 1, 210);
      }
    }
  }

  await sharp(suelo, { raw: { width: W, height: H, channels: 3 } })
    .blur(0.6)
    .webp({ quality: 84 })
    .toFile(path.join(PLANO, "suelo.webp"));
  await sharp(calles, { raw: { width: W, height: H, channels: 3 } })
    .blur(0.4)
    .webp({ quality: 84 })
    .toFile(path.join(PLANO, "calles.webp"));
  await sharp(crece, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality: 82 })
    .toFile(path.join(PLANO, "crece.webp"));
  await sharp(des, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality: 82 })
    .toFile(path.join(PLANO, "despeje.webp"));
  await sharp(rel, { raw: { width: W, height: H, channels: 1 } })
    .webp({ quality: 80 })
    .toFile(path.join(PLANO, "relieve.webp"));
}

async function main() {
  await mkdir(DATOS, { recursive: true });
  const ciudadPath = path.join(DATOS, "ciudad.json");
  if (!(await exists(ciudadPath))) throw new Error("Falta ciudad.json");

  const ciudad = JSON.parse(await readFile(ciudadPath, "utf8")) as {
    plano: {
      ancho: number;
      alto: number;
      metro: number;
      plaza: [number, number];
      marco?: number[];
    };
    [k: string]: unknown;
  };

  const { gray, w, h, fullW, fullH } = await loadWorkImage();
  const plaza = ciudad.plano.plaza;
  const { techos, arboles, manzanas } = extractCity(gray, w, h, fullW, fullH, plaza);

  const techoBuf = Buffer.alloc(techos.length * 7 * 4);
  techos.forEach((t, i) => {
    const o = i * 28;
    techoBuf.writeFloatLE(t.x, o);
    techoBuf.writeFloatLE(t.y, o + 4);
    techoBuf.writeFloatLE(t.w, o + 8);
    techoBuf.writeFloatLE(t.d, o + 12);
    techoBuf.writeFloatLE(t.h, o + 16);
    techoBuf.writeFloatLE(t.seed, o + 20);
    techoBuf.writeFloatLE(t.et, o + 24);
  });
  await writeFile(path.join(DATOS, "techos.pak"), techoBuf);

  const arbBuf = Buffer.alloc(arboles.length * 16);
  arboles.forEach((a, i) => {
    const o = i * 16;
    arbBuf.writeFloatLE(a.x, o);
    arbBuf.writeFloatLE(a.y, o + 4);
    arbBuf.writeFloatLE(a.r, o + 8);
    arbBuf.writeFloatLE(a.seed, o + 12);
  });
  await writeFile(path.join(DATOS, "arboles.pak"), arbBuf);

  Object.assign(ciudad, {
    manzanas,
    techos: techos.length,
    arboles: arboles.length,
    muros: techos.length * 4,
    etapas: EPOCAS.length - 1,
    synthetic: false,
    extracted: true,
    damero: true,
    vectorParcels: false,
    nombre: "Buenos Aires — Glade 1867",
    fuente: "Gallica BnF ark:/12148/btv1b53098699s",
  });
  await writeFile(ciudadPath, JSON.stringify(ciudad, null, 2));
  await writeFile(path.join(DATOS, "epocas.json"), JSON.stringify({ epocas: EPOCAS }, null, 2));

  // Hitos estructurales (coords Glade: N→+x, E→+y)
  const [cx, cy] = plaza;
  const m = ciudad.plano.metro;
  const p = (e: number, n: number) => ({ x: cx + n / m, y: cy + e / m });
  const hitos = [
    { nombre: "Plaza de la Victoria", ...p(0, 0), nivel: 1, nota: "Hoy Plaza de Mayo.", kind: "plaza" },
    { nombre: "Cabildo", ...p(-40, -100), nivel: 1, nota: "Fachada a la plaza.", kind: "cabildo" },
    { nombre: "Catedral", ...p(50, 100), nivel: 1, nota: "Torre a la vista.", kind: "catedral" },
    { nombre: "Casa Rosada", ...p(280, 40), nivel: 1, nota: "Sobre el Fuerte.", kind: "rosada" },
    { nombre: "Recova", ...p(-60, 0), nivel: 2, nota: "Galería.", kind: "recova" },
    { nombre: "Obelisco", ...p(-1600, 900), nivel: 1, nota: "1936.", kind: "obelisco", desde: 1867 },
    { nombre: "Congreso", ...p(-2800, -200), nivel: 1, nota: "Palacio.", kind: "congreso", desde: 1867 },
    { nombre: "Teatro Colón", ...p(-1500, 1100), nivel: 2, nota: "Ex Estación del Parque.", kind: "teatro", desde: 1867 },
    { nombre: "Puerto Madero", ...p(1600, 200), nivel: 2, nota: "Tierra ganada.", kind: "puerto", desde: 1867 },
  ];
  // No pisar hoy.json con lat si existe de OSM — fusionar kind
  const hoyPath = path.join(DATOS, "hoy.json");
  let keep = false;
  if (await exists(hoyPath)) {
    try {
      const prev = JSON.parse(await readFile(hoyPath, "utf8")) as Array<{ lat?: number; nombre: string }>;
      keep = prev.some((h) => typeof h.lat === "number");
      if (keep) {
        // enriquecer con kind por nombre
        for (const h of prev) {
          const m2 = hitos.find((x) => h.nombre.includes(x.nombre.split(" ")[0]) || x.nombre.includes(h.nombre.split(" ")[0]));
          if (m2) (h as { kind?: string }).kind = m2.kind;
        }
        await writeFile(hoyPath, JSON.stringify(prev, null, 2));
      }
    } catch {
      keep = false;
    }
  }
  if (!keep) await writeFile(hoyPath, JSON.stringify(hitos, null, 2));

  console.log("Bake overlays (suelo/calles desde tinta)…");
  await bakeOverlays(fullW, fullH, plaza, ciudad.plano.metro, techos, gray, w, h);
  console.log("OK → ciudad densa sobre Glade");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
