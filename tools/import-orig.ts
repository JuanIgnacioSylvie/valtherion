/**
 * Importa assets del original baires.mormon.garden → public/
 * ciudad.pak / crece.pak / overlays / marcas
 */
import { mkdir, copyFile, writeFile, readFile } from "fs/promises";
import fs from "fs";
import path from "path";
import { gunzipSync } from "zlib";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIG = path.join(ROOT, "public", "orig");
const DATOS = path.join(ROOT, "public", "datos");
const PLANO = path.join(ROOT, "public", "plano");

type Types = Record<string, Float32ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor>;

function loadPak(file: string, types: Types) {
  const pak = gunzipSync(fs.readFileSync(file));
  const dv = new DataView(pak.buffer, pak.byteOffset, pak.byteLength);
  const hdrLen = dv.getUint32(0, true);
  const hdr = JSON.parse(Buffer.from(pak.subarray(4, 4 + hdrLen)).toString("utf8")) as {
    partes: { nombre: string; bytes: number; registro: number }[];
  };
  const out: Record<string, Float32Array | Uint16Array | Uint32Array> = {};
  let s = 4 + hdrLen;
  for (const { nombre, bytes, registro } of hdr.partes) {
    const a = pak.subarray(s, s + bytes);
    const c = new Uint8Array(bytes);
    const l = bytes / registro;
    for (let e = 0; e < registro; e++) {
      const t = e * l;
      for (let n = 0; n < l; n++) c[n * registro + e] = a[t + n]!;
    }
    const Ctor = types[nombre];
    if (!Ctor) throw new Error(`tipo desconocido ${nombre}`);
    out[nombre] = new Ctor(c.buffer);
    s += bytes;
  }
  return out;
}

/** bilineal dentro de la manzana (coords grilla → metros mundo) */
function mzPoint(
  mz: Float32Array,
  mi: number,
  gu: number,
  gv: number,
  plaza: [number, number],
  metro: number,
  out: { x: number; z: number },
) {
  const c = mi * 10;
  const gw = mz[c + 8]!;
  const gh = mz[c + 9]!;
  const l = gu / gw;
  const u = gv / gh;
  const d = (1 - l) * (1 - u);
  const f = l * (1 - u);
  const p = l * u;
  const m = (1 - l) * u;
  out.x = (d * mz[c]! + f * mz[c + 2]! + p * mz[c + 4]! + m * mz[c + 6]! - plaza[0]) * metro;
  out.z = (d * mz[c + 1]! + f * mz[c + 3]! + p * mz[c + 5]! + m * mz[c + 7]! - plaza[1]) * metro;
}

function hash01(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function guessKind(nombre: string): string | undefined {
  const n = nombre.toLowerCase();
  if (n.includes("cabildo")) return "cabildo";
  if (n.includes("catedral")) return "catedral";
  if (n.includes("rosada") || n.includes("casa de gobierno")) return "rosada";
  if (n.includes("obelisco")) return "obelisco";
  if (n.includes("congreso")) return "congreso";
  if (n.includes("colón") || n.includes("colon") || n.includes("teatro")) return "teatro";
  if (n.includes("recova")) return "recova";
  if (n.includes("plaza")) return "plaza";
  if (n.includes("puerto") || n.includes("dique") || n.includes("muelle")) return "puerto";
  return undefined;
}

async function main() {
  await mkdir(DATOS, { recursive: true });
  await mkdir(PLANO, { recursive: true });

  const ciudadMeta = JSON.parse(
    await readFile(path.join(ORIG, "datos", "ciudad.json"), "utf8"),
  ) as {
    plano: {
      ancho: number;
      alto: number;
      metro: number;
      plaza: [number, number];
      marco?: number[];
      interior?: number[];
    };
    manzanas: number;
    techos: number;
    muros: number;
    arboles: number;
    lotes: number;
    iglesias: unknown[];
  };

  // copiar paks crudos
  for (const f of ["ciudad.pak", "crece.pak", "ciudad.json"]) {
    const src = path.join(ORIG, "datos", f);
    if (fs.existsSync(src)) await copyFile(src, path.join(DATOS, f));
  }
  for (const f of [
    "suelo.webp",
    "suelo-2k.webp",
    "calles.webp",
    "calles-2k.webp",
    "crece.webp",
    "despeje.webp",
    "hoy-cerca.webp",
    "hoy-lejos.webp",
    "medio.webp",
    "chico.webp",
    "primero.webp",
  ]) {
    const src = path.join(ORIG, "plano", f);
    if (fs.existsSync(src)) await copyFile(src, path.join(PLANO, f));
  }

  const city = loadPak(path.join(ORIG, "datos", "ciudad.pak"), {
    manzanas: Float32Array,
    techos: Uint16Array,
    muros: Uint16Array,
    arboles: Float32Array,
  });

  const mz = city.manzanas as Float32Array;
  const techosU = city.techos as Uint16Array;
  const murosU = city.muros as Uint16Array;
  const arbolesF = city.arboles as Float32Array;
  const plaza = ciudadMeta.plano.plaza;
  const metro = ciudadMeta.plano.metro;
  const nT = techosU.length / 8;
  const nM = murosU.length / 8;
  const nA = arbolesF.length / 3;

  // techos: Float32[px,py,w_px,d_px,h_m,yaw,seed,et]
  const techosOut = new Float32Array(nT * 8);
  const p0 = { x: 0, z: 0 };
  const p1 = { x: 0, z: 0 };
  const p2 = { x: 0, z: 0 };
  const p3 = { x: 0, z: 0 };
  let skipped = 0;

  for (let i = 0; i < nT; i++) {
    const r = i * 8;
    const mi = techosU[r]!;
    if (mi >= mz.length / 10) {
      skipped++;
      continue;
    }
    const u0 = techosU[r + 1]!;
    const v0 = techosU[r + 2]!;
    const u1 = techosU[r + 3]!;
    const v1 = techosU[r + 4]!;
    const hRaw = techosU[r + 5]!;
    const seedU = techosU[r + 6]!;

    mzPoint(mz, mi, u0, v0, plaza, metro, p0);
    mzPoint(mz, mi, u1, v0, plaza, metro, p1);
    mzPoint(mz, mi, u1, v1, plaza, metro, p2);
    mzPoint(mz, mi, u0, v1, plaza, metro, p3);

    const cx = (p0.x + p1.x + p2.x + p3.x) / 4;
    const cz = (p0.z + p1.z + p2.z + p3.z) / 4;
    const eWx = p1.x - p0.x;
    const eWz = p1.z - p0.z;
    const eDx = p3.x - p0.x;
    const eDz = p3.z - p0.z;
    let wM = Math.hypot(eWx, eWz);
    let dM = Math.hypot(eDx, eDz);
    if (wM < 0.8) wM = 0.8;
    if (dM < 0.8) dM = 0.8;
    if (wM > 55) wM = 55;
    if (dM > 55) dM = 55;
    // yaw alinea el eje local Z del box con el borde v (profundidad) del lote
    // (scale = w,h,d → X=ancho u, Z=prof v), igual convención que muros
    const yaw = Math.atan2(eDx, eDz);

    const px = plaza[0] + cx / metro;
    const py = plaza[1] + cz / metro;
    // altura del techo en metros (como el original: campo/10)
    const h = Math.max(2.4, hRaw / 10);

    const o = i * 8;
    techosOut[o] = px;
    techosOut[o + 1] = py;
    techosOut[o + 2] = wM / metro;
    techosOut[o + 3] = dM / metro;
    techosOut[o + 4] = h;
    techosOut[o + 5] = yaw;
    techosOut[o + 6] = seedU / 65535;
    techosOut[o + 7] = 0;
  }

  // muros: Float32[px,py,len_m,height_m,y0_m,yaw,seed,et]
  const murosOut = new Float32Array(nM * 8);
  const N = { x: 0, z: 0 };
  const P = { x: 0, z: 0 };
  let muroOk = 0;
  for (let i = 0; i < nM; i++) {
    const t = i * 8;
    const mi = murosU[t]!;
    if (mi >= mz.length / 10) continue;
    const packed = murosU[t + 1]!;
    const side = packed & 3;
    const d = murosU[t + 2]!;
    const a0 = murosU[t + 3]!;
    const a1 = murosU[t + 4]!;
    const y0 = murosU[t + 5]! / 10;
    const y1 = murosU[t + 6]! / 10;
    const seed = murosU[t + 7]! / 65535;
    let height = y1 - y0;
    if (height < 0.4) height = 0.4;
    if (height > 40) height = 40;

    if (side === 0 || side === 2) {
      mzPoint(mz, mi, a0, d, plaza, metro, N);
      mzPoint(mz, mi, a1, d, plaza, metro, P);
    } else {
      mzPoint(mz, mi, d, a0, plaza, metro, N);
      mzPoint(mz, mi, d, a1, plaza, metro, P);
    }
    const dx = P.x - N.x;
    const dz = P.z - N.z;
    let len = Math.hypot(dx, dz);
    if (len < 0.35) continue;
    if (len > 60) len = 60;
    const cx = (N.x + P.x) / 2;
    const cz = (N.z + P.z) / 2;
    // yaw: alinea el eje local Z del box con (dx,dz)
    // (scale será thick, height, len)
    const yaw = Math.atan2(dx, dz);
    const o = muroOk * 8;
    murosOut[o] = plaza[0] + cx / metro;
    murosOut[o + 1] = plaza[1] + cz / metro;
    murosOut[o + 2] = len;
    murosOut[o + 3] = height;
    murosOut[o + 4] = Math.max(0, y0);
    murosOut[o + 5] = yaw;
    murosOut[o + 6] = seed;
    murosOut[o + 7] = 0;
    muroOk++;
  }
  const murosTrim = murosOut.subarray(0, muroOk * 8);

  const arbolesOut = new Float32Array(nA * 4);
  for (let i = 0; i < nA; i++) {
    const o = i * 3;
    const oo = i * 4;
    arbolesOut[oo] = arbolesF[o]!;
    arbolesOut[oo + 1] = arbolesF[o + 1]!;
    arbolesOut[oo + 2] = arbolesF[o + 2]!;
    arbolesOut[oo + 3] = hash01(i * 17.3 + arbolesF[o]! * 0.01);
  }

  await writeFile(path.join(DATOS, "techos.pak"), Buffer.from(techosOut.buffer));
  await writeFile(
    path.join(DATOS, "muros.pak"),
    Buffer.from(murosTrim.buffer, murosTrim.byteOffset, murosTrim.byteLength),
  );
  await writeFile(path.join(DATOS, "arboles.pak"), Buffer.from(arbolesOut.buffer));

  // marcas → hoy.json (época index → año)
  const YEARS = [1867, 1888, 1895, 1905, 1910, 1921, 1940];
  const marcasPath = path.join(ORIG, "datos", "marcas.json");
  let hoy: Array<Record<string, unknown>> = [];
  if (fs.existsSync(marcasPath)) {
    const marcas = JSON.parse(await readFile(marcasPath, "utf8")) as Array<
      [string, number, number, number, number, string, Record<string, number>?]
    >;
    for (const m of marcas) {
      const [nombre, x, y, , nivel, nota, flags] = m;
      const desdeI = flags?.desde ?? 0;
      const hastaI = flags?.hasta;
      hoy.push({
        nombre,
        x,
        y,
        nivel: nivel ?? 1,
        nota: nota ?? "",
        kind: guessKind(nombre),
        desde: YEARS[desdeI] ?? 1867,
        ...(hastaI != null ? { hasta: YEARS[hastaI] ?? YEARS[YEARS.length - 1] } : {}),
      });
    }
  }

  // asegurar hitos estructurales con kind
  const ensure = [
    { nombre: "Cabildo", kind: "cabildo" },
    { nombre: "Catedral", kind: "catedral" },
    { nombre: "Casa Rosada", kind: "rosada", match: /rosada|casa de gobierno/i },
    { nombre: "Congreso", kind: "congreso", match: /congreso/i },
    { nombre: "Teatro Colón", kind: "teatro", match: /col[oó]n|teatro/i },
    { nombre: "Obelisco", kind: "obelisco" },
  ];
  for (const e of ensure) {
    const hit = hoy.find((h) =>
      e.match ? e.match.test(String(h.nombre)) : String(h.nombre).includes(e.nombre),
    );
    if (hit) hit.kind = e.kind;
  }

  await writeFile(path.join(DATOS, "hoy.json"), JSON.stringify(hoy, null, 2));

  const ciudadLocal = {
    ...ciudadMeta,
    techos: nT,
    arboles: nA,
    muros: muroOk,
    manzanas: ciudadMeta.manzanas,
    lotes: ciudadMeta.lotes,
    etapas: 6,
    synthetic: false,
    extracted: false,
    importedOrig: true,
    nombre: "Buenos Aires — Glade 1867",
    fuente: "baires.mormon.garden ciudad.pak + Gallica Glade",
  };
  await writeFile(path.join(DATOS, "ciudad.json"), JSON.stringify(ciudadLocal, null, 2));

  // epocas mínimas si faltan
  const epPath = path.join(DATOS, "epocas.json");
  if (!fs.existsSync(epPath)) {
    await writeFile(
      epPath,
      JSON.stringify({
        epocas: [
          { año: 1867, titulo: "Glade", corto: "1867" },
          { año: 1888, titulo: "Latzina", corto: "1888" },
          { año: 1895, titulo: "Municipal", corto: "1895" },
          { año: 1905, titulo: "Ludwig", corto: "1905" },
          { año: 1910, titulo: "Ludwig", corto: "1910" },
          { año: 1921, titulo: "Cannizzaro", corto: "1921" },
          { año: 1940, titulo: "Peuser", corto: "1940" },
        ],
      }),
      "utf8",
    );
  }

  console.log({
    techos: nT,
    muros: muroOk,
    arboles: nA,
    skipped,
    hoy: hoy.length,
    manzanas: ciudadMeta.manzanas,
    overlays: [
      "suelo",
      "calles",
      "crece",
      "despeje",
      "suelo-2k",
      "calles-2k",
      "hoy-cerca",
      "hoy-lejos",
      "medio",
      "chico",
      "primero",
    ],
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
