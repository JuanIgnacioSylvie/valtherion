/**
 * Genera una ciudad histórica inventada al completo:
 * modelo → plano hi-res (tinta) → LOD → packs 3D → overlays → hitos/épocas/geo
 *
 * Uso: pnpm city:generate
 */
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { buildCityModel, hash, type CityModel } from "./lib/city-model.ts";

const OUT_PLANO = path.resolve("public/plano");
const OUT_DATOS = path.resolve("public/datos");
const TILE = 3072;
const STRIP = 256;

const EPOCAS = [
  { año: 1867, titulo: "Plano fundacional", corto: "Fundación 1867" },
  { año: 1888, titulo: "Primer ensanche", corto: "Ensanche 1888", obras: "Quintas que pasan a manzana." },
  { año: 1895, titulo: "Avenida cívica", corto: "Avenida 1895", obras: "Se abre la avenida norte–sur." },
  { año: 1905, titulo: "Densificación", corto: "1905" },
  { año: 1910, titulo: "Centenario", corto: "Centenario 1910", obras: "Plaza del Congreso y teatro nuevo." },
  { año: 1921, titulo: "Puerto y diagonales", corto: "1921", obras: "Tierra ganada al río." },
  { año: 1940, titulo: "Ciudad moderna", corto: "1940", obras: "Obelisco y ensanches." },
];

function inkPixel(buf: Buffer, W: number, H: number, x: number, y: number, a: number) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  const k = 1 - Math.min(1, a) * 0.62;
  buf[i] = Math.max(28, buf[i] * k);
  buf[i + 1] = Math.max(22, buf[i + 1] * k);
  buf[i + 2] = Math.max(16, buf[i + 2] * k);
}

function fillPaper(buf: Buffer, W: number, y0: number, h: number, seed: number) {
  for (let ly = 0; ly < h; ly++) {
    const y = y0 + ly;
    for (let x = 0; x < W; x++) {
      const i = (ly * W + x) * 3;
      const n =
        hash(x * 0.015, y * 0.015, seed) * 16 +
        hash(x * 0.08, y * 0.08, seed + 1) * 10 +
        hash(x * 0.3, y * 0.3, seed + 2) * 4;
      buf[i] = 236 - n;
      buf[i + 1] = 222 - n * 0.92;
      buf[i + 2] = 188 - n * 0.72;
    }
  }
}

function strokeRect(
  buf: Buffer,
  W: number,
  H: number,
  x: number,
  y: number,
  w: number,
  d: number,
  a = 0.95,
) {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const x1 = Math.round(x + w);
  const y1 = Math.round(y + d);
  for (let xi = x0; xi <= x1; xi++) {
    inkPixel(buf, W, H, xi, y0, a);
    inkPixel(buf, W, H, xi, y1, a);
  }
  for (let yi = y0; yi <= y1; yi++) {
    inkPixel(buf, W, H, x0, yi, a);
    inkPixel(buf, W, H, x1, yi, a);
  }
}

function hatchBuilding(
  buf: Buffer,
  W: number,
  H: number,
  x: number,
  y: number,
  w: number,
  d: number,
  seed: number,
) {
  strokeRect(buf, W, H, x, y, w, d, 0.9);
  const x0 = Math.round(x) + 1;
  const y0 = Math.round(y) + 1;
  const x1 = Math.round(x + w) - 1;
  const y1 = Math.round(y + d) - 1;
  const step = 2 + Math.floor(hash(x, y, seed) * 2);
  for (let yy = y0; yy < y1; yy += step) {
    for (let xx = x0; xx < x1; xx++) {
      if (hash(xx, yy, seed) > 0.35) inkPixel(buf, W, H, xx, yy, 0.28);
    }
  }
}

function drawStrip(model: CityModel, y0: number, h: number): Buffer {
  const { W, H, blocks, buildings, trees, plaza, marco, coastY, seed } = model;
  const buf = Buffer.alloc(W * h * 3);
  fillPaper(buf, W, y0, h, seed);

  // remap ink to strip-local Y
  const local = Buffer.alloc(W * h * 3);
  // We'll draw into a virtual full-frame by offsetting - actually easier to use wrapper
  const ink = (x: number, y: number, a: number) => {
    const ly = y - y0;
    if (ly < 0 || ly >= h) return;
    inkPixel(buf, W, h, x, ly, a);
  };
  const stroke = (x: number, y: number, w: number, d: number, a = 0.95) => {
    const x0r = Math.round(x);
    const y0r = Math.round(y);
    const x1 = Math.round(x + w);
    const y1 = Math.round(y + d);
    for (let xi = x0r; xi <= x1; xi++) {
      ink(xi, y0r, a);
      ink(xi, y1, a);
    }
    for (let yi = y0r; yi <= y1; yi++) {
      ink(x0r, yi, a);
      ink(x1, yi, a);
    }
  };

  void local;
  void strokeRect;
  void hatchBuilding;

  // marco
  if (y0 <= marco[1] && y0 + h >= marco[1]) {
    for (let x = marco[0]; x < marco[2]; x++) for (let t = 0; t < 3; t++) ink(x, marco[1] + t, 1);
  }
  if (y0 <= marco[3] && y0 + h >= marco[3]) {
    for (let x = marco[0]; x < marco[2]; x++) for (let t = 0; t < 3; t++) ink(x, marco[3] - t, 1);
  }
  for (let y = Math.max(y0, marco[1]); y < Math.min(y0 + h, marco[3]); y++) {
    for (let t = 0; t < 3; t++) {
      ink(marco[0] + t, y, 1);
      ink(marco[2] - t, y, 1);
    }
  }

  // manzanas
  for (const b of blocks) {
    if (b.y + b.d < y0 - 2 || b.y > y0 + h + 2) continue;
    stroke(b.x, b.y, b.w, b.d, b.urban ? 0.92 : 0.55);
  }

  // edificios (solo et 0 en el grabado “1867”; los demás aparecen en timeline 3D)
  for (const b of buildings) {
    if (b.et > 0) continue;
    if (b.y + b.d < y0 - 2 || b.y > y0 + h + 2) continue;
    stroke(b.x, b.y, b.w, b.d, 0.88);
    const x0r = Math.round(b.x) + 1;
    const y0r = Math.round(b.y) + 1;
    const x1 = Math.round(b.x + b.w) - 1;
    const y1 = Math.round(b.y + b.d) - 1;
    const step = 2 + Math.floor(hash(b.x, b.y, 40) * 2);
    for (let yy = y0r; yy < y1; yy += step) {
      if (yy < y0 || yy >= y0 + h) continue;
      for (let xx = x0r; xx < x1; xx++) {
        if (hash(xx, yy, 41) > 0.4) ink(xx, yy, 0.3);
      }
    }
  }

  // árboles como circulitos
  for (const t of trees) {
    if (t.y < y0 - 10 || t.y > y0 + h + 10) continue;
    const r = Math.max(2, t.r * 0.55);
    for (let yy = -r; yy <= r; yy++) {
      for (let xx = -r; xx <= r; xx++) {
        if (xx * xx + yy * yy <= r * r) ink(Math.round(t.x + xx), Math.round(t.y + yy), 0.45);
      }
    }
  }

  // costa + oleaje
  for (let x = marco[0]; x < marco[2]; x++) {
    const cy = Math.round(coastY(x));
    if (cy >= y0 && cy < y0 + h) {
      ink(x, cy, 1);
      ink(x, cy + 1, 0.7);
    }
    for (let y = Math.max(y0, cy + 2); y < Math.min(y0 + h, H - 40); y++) {
      if (hash(x, y, 50) > 0.55) ink(x, y, 0.12 + ((y - cy) / H) * 0.15);
    }
  }

  // plaza (vacío claro + borde)
  const [cx, cy] = plaza;
  const pw = W * 0.028;
  const ph = H * 0.022;
  if (cy + ph >= y0 && cy - ph <= y0 + h) {
    for (let y = Math.round(cy - ph); y < cy + ph; y++) {
      if (y < y0 || y >= y0 + h) continue;
      for (let x = Math.round(cx - pw); x < cx + pw; x++) {
        const ly = y - y0;
        const i = (ly * W + x) * 3;
        buf[i] = Math.min(245, buf[i] + 14);
        buf[i + 1] = Math.min(232, buf[i + 1] + 12);
        buf[i + 2] = Math.min(200, buf[i + 2] + 10);
      }
    }
    stroke(cx - pw, cy - ph, pw * 2, ph * 2, 1);
  }

  // rosa de los vientos simple (esquina)
  const rx = Math.round(W * 0.88);
  const ry = Math.round(H * 0.88);
  if (ry >= y0 && ry < y0 + h) {
    for (let a = 0; a < 360; a += 2) {
      const rad = (a * Math.PI) / 180;
      ink(rx + Math.cos(rad) * 40, ry + Math.sin(rad) * 40, 0.8);
    }
    for (let i = -50; i <= 50; i++) {
      ink(rx + i, ry, 0.9);
      ink(rx, ry + i, 0.9);
    }
  }

  return buf;
}

async function writePlano(model: CityModel) {
  const { W, H } = model;
  console.log(`Render plano ${W}×${H} en franjas de ${STRIP}…`);
  const strips: { input: Buffer; raw: { width: number; height: number; channels: 3 }; top: number }[] =
    [];

  // sharp overlay composition: write temp strip webps then composite
  const tmp = path.join(OUT_PLANO, "_strips");
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });

  const files: { input: string; top: number; left: number }[] = [];
  let si = 0;
  for (let y0 = 0; y0 < H; y0 += STRIP) {
    const h = Math.min(STRIP, H - y0);
    const raw = drawStrip(model, y0, h);
    const fp = path.join(tmp, `s${si}.webp`);
    await sharp(raw, { raw: { width: W, height: h, channels: 3 } })
      .webp({ quality: 90, effort: 3 })
      .toFile(fp);
    files.push({ input: fp, top: y0, left: 0 });
    si++;
    if (si % 8 === 0) process.stdout.write(`  ${Math.round((y0 / H) * 100)}%\r`);
  }
  console.log("\nComponiendo source.webp…");

  // base paper then composites — create blank and composite strips
  const base = await sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: 236, g: 222, b: 188 },
    },
  })
    .composite(files)
    .webp({ quality: 86, effort: 4 })
    .toFile(path.join(OUT_PLANO, "source.webp"));

  void base;
  void strips;
  await rm(tmp, { recursive: true, force: true });

  // LOD
  console.log("LOD chico / medio / primero…");
  await sharp(path.join(OUT_PLANO, "source.webp"))
    .resize(2048, 2048, { fit: "inside" })
    .grayscale()
    .webp({ quality: 80 })
    .toFile(path.join(OUT_PLANO, "chico.webp"));

  await sharp(path.join(OUT_PLANO, "source.webp"))
    .grayscale()
    .webp({ quality: 82, effort: 4 })
    .toFile(path.join(OUT_PLANO, "medio.webp"));

  await sharp(path.join(OUT_PLANO, "chico.webp"))
    .resize(1024, 1024, { fit: "inside" })
    .webp({ quality: 72 })
    .toFile(path.join(OUT_PLANO, "primero.webp"));
}

async function writeTiles(model: CityModel) {
  const { W, H } = model;
  const cols = Math.ceil(W / TILE);
  const rows = Math.ceil(H / TILE);
  const dir = path.join(OUT_PLANO, "tiles");
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  console.log(`Teselas ${TILE} → ${cols}×${rows}`);

  const src = path.join(OUT_PLANO, "source.webp");
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const left = col * TILE;
      const top = row * TILE;
      const width = Math.min(TILE, W - left);
      const height = Math.min(TILE, H - top);
      await sharp(src)
        .extract({ left, top, width, height })
        .grayscale()
        .webp({ quality: 84, effort: 3 })
        .toFile(path.join(dir, `${col}_${row}.webp`));
    }
    process.stdout.write(`  fila ${row + 1}/${rows}\r`);
  }
  console.log("");
  await writeFile(
    path.join(OUT_PLANO, "laminas.json"),
    JSON.stringify({ ancho: W, alto: H, tesela: TILE, cols, rows }),
  );
}

async function writePacks(model: CityModel) {
  const { buildings, trees, W, H, metro, plaza, marco, blocks } = model;
  const techoBuf = Buffer.alloc(buildings.length * 7 * 4);
  buildings.forEach((t, i) => {
    const o = i * 28;
    techoBuf.writeFloatLE(t.x + t.w / 2, o);
    techoBuf.writeFloatLE(t.y + t.d / 2, o + 4);
    techoBuf.writeFloatLE(t.w, o + 8);
    techoBuf.writeFloatLE(t.d, o + 12);
    techoBuf.writeFloatLE(t.h, o + 16);
    techoBuf.writeFloatLE(t.seed, o + 20);
    techoBuf.writeFloatLE(t.et, o + 24);
  });
  await writeFile(path.join(OUT_DATOS, "techos.pak"), techoBuf);

  const arbBuf = Buffer.alloc(trees.length * 16);
  trees.forEach((a, i) => {
    const o = i * 16;
    arbBuf.writeFloatLE(a.x, o);
    arbBuf.writeFloatLE(a.y, o + 4);
    arbBuf.writeFloatLE(a.r, o + 8);
    arbBuf.writeFloatLE(a.seed, o + 12);
  });
  await writeFile(path.join(OUT_DATOS, "arboles.pak"), arbBuf);

  const ciudad = {
    plano: { ancho: W, alto: H, metro, plaza, marco },
    manzanas: blocks.length,
    techos: buildings.length,
    arboles: trees.length,
    muros: buildings.length * 4,
    etapas: EPOCAS.length - 1,
    synthetic: true,
    nombre: "Ciudad del Plano",
  };
  await writeFile(path.join(OUT_DATOS, "ciudad.json"), JSON.stringify(ciudad, null, 2));
  await writeFile(path.join(OUT_DATOS, "epocas.json"), JSON.stringify({ epocas: EPOCAS }, null, 2));
  await writeFile(path.join(OUT_DATOS, "hoy.json"), JSON.stringify(model.landmarks, null, 2));

  const geo = {
    origen: { lat: -34.6083, lon: -58.3722 },
    mLat: 110940,
    mLon: 111320 * Math.cos((-34.6083 * Math.PI) / 180),
    A: [plaza[0], -80 * (W / 18919), 980 * (W / 18919)],
    B: [plaza[1], 980 * (H / 13272), 70 * (H / 13272)],
    nota: "Georref aproximada (ciudad sintética anclada a Plaza de Mayo).",
  };
  await writeFile(path.join(OUT_DATOS, "geo.json"), JSON.stringify(geo, null, 2));
}

async function bakeOverlays(model: CityModel) {
  const { W, H, plaza, metro, buildings, coastY, marco } = model;
  const ow = 2048;
  const oh = Math.round((H / W) * ow);
  const sx = ow / W;
  const sy = oh / H;
  const [cx, cy] = plaza;

  const cerca = Buffer.alloc(ow * oh * 3);
  const lejos = Buffer.alloc(ow * oh * 3);
  const crece = Buffer.alloc(1024 * Math.round((H / W) * 1024) * 3);
  const cw = 1024;
  const ch = Math.round((H / W) * 1024);
  const csx = cw / W;
  const csy = ch / H;
  const creceBuf = Buffer.alloc(cw * ch * 3);
  const desBuf = Buffer.alloc(cw * ch * 3);
  const callesBuf = Buffer.alloc(cw * ch * 3);
  const sueloBuf = Buffer.alloc(cw * ch * 3);
  const relBuf = Buffer.alloc(cw * ch);

  const set3 = (buf: Buffer, w: number, x: number, y: number, r: number, g = 0, b = 0) => {
    if (x < 0 || y < 0 || x >= w || y >= buf.length / (w * 3)) return;
    const i = (y * w + x) * 3;
    buf[i] = Math.max(buf[i], r);
    buf[i + 1] = Math.max(buf[i + 1], g);
    buf[i + 2] = Math.max(buf[i + 2], b);
  };

  const line = (
    buf: Buffer,
    w: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    thick: number,
    r: number,
    g = 0,
    b = 0,
  ) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      for (let dy = -thick; dy <= thick; dy++)
        for (let dx = -thick; dx <= thick; dx++) set3(buf, w, x + dx, y + dy, r, g, b);
    }
  };

  // calles “hoy” desfasadas
  const step = Math.round(40 * sx);
  for (let x = Math.round(ow * 0.08); x < ow * 0.92; x += step) {
    line(cerca, ow, x, Math.round(oh * 0.1), x, Math.round(oh * 0.76), 0, 255);
    if (x % (step * 3) < 2) line(lejos, ow, x, Math.round(oh * 0.1), x, Math.round(oh * 0.76), 1, 255);
  }
  for (let y = Math.round(oh * 0.1); y < oh * 0.76; y += step) {
    line(cerca, ow, Math.round(ow * 0.08), y, Math.round(ow * 0.92), y, 0, 255);
    if (y % (step * 3) < 2) line(lejos, ow, Math.round(ow * 0.08), y, Math.round(ow * 0.92), y, 1, 255);
  }
  // avenida cívica + costa
  line(cerca, ow, Math.round(cx * sx), Math.round(oh * 0.18), Math.round(cx * sx), Math.round(cy * sy), 1, 255);
  line(lejos, ow, Math.round(cx * sx), Math.round(oh * 0.18), Math.round(cx * sx), Math.round(cy * sy), 2, 255);

  for (let x = Math.round(marco[0] * sx); x < marco[2] * sx; x++) {
    const y = Math.round(coastY(x / sx) * sy);
    set3(cerca, ow, x, y, 255);
    set3(lejos, ow, x, y, 255);
    for (let yy = y + 2; yy < oh * 0.95; yy++) {
      if ((x + yy) % 3 === 0) set3(lejos, ow, x, yy, 0, 180, 0);
    }
  }

  // crece
  for (const b of buildings) {
    const etapas = 6;
    const v = Math.round(255 * ((etapas + 0.5 - b.et) / etapas));
    const x = Math.round((b.x + b.w / 2) * csx);
    const y = Math.round((b.y + b.d / 2) * csy);
    const rad = Math.max(1, Math.round((b.w * csx) / 2));
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        set3(creceBuf, cw, x + dx, y + dy, b.et === 0 ? 255 : v, b.et > 0 ? v : 40, v);
        set3(sueloBuf, cw, x + dx, y + dy, 0, 0, v);
      }
    }
  }

  // despeje avenida
  for (let y = Math.round(ch * 0.2); y < cy * csy; y++) {
    for (let x = Math.round(cx * csx) - 4; x <= Math.round(cx * csx) + 4; x++) {
      set3(desBuf, cw, x, y, 220, 0, y > ch * 0.35 ? 200 : 0);
      set3(callesBuf, cw, x, y, 200, 100, 220);
    }
  }

  // relieve barranca
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const ny = y / ch;
      relBuf[y * cw + x] = Math.max(0, Math.min(255, (1 - ny * 1.3) * 170 + Math.sin(x * 0.05) * 10));
      if (y > coastY(x / csx) * csy) set3(sueloBuf, cw, x, y, 200, 0, 0);
    }
  }

  await sharp(cerca, { raw: { width: ow, height: oh, channels: 3 } })
    .webp({ quality: 82 })
    .toFile(path.join(OUT_PLANO, "hoy-cerca.webp"));
  await sharp(lejos, { raw: { width: ow, height: oh, channels: 3 } })
    .webp({ quality: 82 })
    .toFile(path.join(OUT_PLANO, "hoy-lejos.webp"));
  await sharp(creceBuf, { raw: { width: cw, height: ch, channels: 3 } })
    .webp({ quality: 82 })
    .toFile(path.join(OUT_PLANO, "crece.webp"));
  await sharp(desBuf, { raw: { width: cw, height: ch, channels: 3 } })
    .webp({ quality: 82 })
    .toFile(path.join(OUT_PLANO, "despeje.webp"));
  await sharp(callesBuf, { raw: { width: cw, height: ch, channels: 3 } })
    .webp({ quality: 82 })
    .toFile(path.join(OUT_PLANO, "calles.webp"));
  await sharp(sueloBuf, { raw: { width: cw, height: ch, channels: 3 } })
    .webp({ quality: 82 })
    .toFile(path.join(OUT_PLANO, "suelo.webp"));
  await sharp(relBuf, { raw: { width: cw, height: ch, channels: 1 } })
    .webp({ quality: 82 })
    .toFile(path.join(OUT_PLANO, "relieve.webp"));

  void metro;
  void crece;
}

async function main() {
  await mkdir(OUT_PLANO, { recursive: true });
  await mkdir(OUT_DATOS, { recursive: true });

  const model = buildCityModel();
  console.log(
    `Ciudad: ${model.blocks.length} manzanas · ${model.buildings.length} techos · ${model.trees.length} árboles`,
  );
  console.log(`Hoja ${model.W}×${model.H} · ${model.metro.toFixed(3)} m/px`);

  await writePlano(model);
  await writeTiles(model);
  await writePacks(model);
  console.log("Overlays…");
  await bakeOverlays(model);

  // meta para el runtime
  await writeFile(
    path.join(OUT_DATOS, "city-meta.json"),
    JSON.stringify(
      {
        nombre: "Ciudad del Plano",
        W: model.W,
        H: model.H,
        metro: model.metro,
        plaza: model.plaza,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  console.log("OK. pnpm dev");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
