/**
 * Georref fina + overlay “Hoy” desde OpenStreetMap (Overpass).
 * Escribe public/datos/geo.json y public/plano/hoy-{cerca,lejos}.webp
 *
 * Uso: pnpm hoy:osm
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  bboxLatLon,
  fitGeo,
  latLonToLocal,
  localToPx,
  seedGcps,
  type GeoModel,
} from "./lib/geo-fit.ts";

const PLANO = path.resolve("public/plano");
const DATOS = path.resolve("public/datos");
const OVERPASS = "https://overpass-api.de/api/interpreter";

type Way = { type: string; tags?: Record<string, string>; geometry?: Array<{ lat: number; lon: number }> };

async function main() {
  await mkdir(PLANO, { recursive: true });
  await mkdir(DATOS, { recursive: true });

  const ciudad = JSON.parse(await readFile(path.join(DATOS, "ciudad.json"), "utf8")) as {
    plano: { ancho: number; alto: number; metro: number; plaza: [number, number] };
  };
  const { ancho, alto, metro, plaza } = ciudad.plano;

  const gcps = seedGcps(plaza, metro);
  const geo = fitGeo(gcps);
  console.log("GCPs error (px):");
  for (const g of geo.gcps ?? []) {
    console.log(`  ${g.nombre}: ${g.err}px`);
  }
  await writeFile(path.join(DATOS, "geo.json"), JSON.stringify(geo, null, 2));
  console.log("geo.json OK");

  const box = bboxLatLon(geo, ancho, alto);
  console.log(
    `bbox ${box.south.toFixed(4)}…${box.north.toFixed(4)}S · ${box.west.toFixed(4)}…${box.east.toFixed(4)}W`,
  );

  console.log("Overpass…");
  const ways = await fetchOsm(box);
  console.log(`${ways.length} ways`);

  const W = 2048;
  const H = Math.round((alto / ancho) * W);
  const sx = W / ancho;
  const sy = H / alto;

  const cerca = Buffer.alloc(W * H * 3);
  const lejos = Buffer.alloc(W * H * 3);

  const set = (buf: Buffer, x: number, y: number, ch: number, v: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3 + ch;
    buf[i] = Math.max(buf[i], v);
  };

  const stroke = (
    buf: Buffer,
    pts: Array<[number, number]>,
    thick: number,
    ch: number,
    v: number,
  ) => {
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let s = 0; s <= n; s++) {
        const t = s / n;
        const x = Math.round(x0 + (x1 - x0) * t);
        const y = Math.round(y0 + (y1 - y0) * t);
        for (let dy = -thick; dy <= thick; dy++) {
          for (let dx = -thick; dx <= thick; dx++) {
            if (dx * dx + dy * dy <= thick * thick + 1) set(buf, x + dx, y + dy, ch, v);
          }
        }
      }
    }
  };

  const project = (lat: number, lon: number): [number, number] | null => {
    const [e, n] = latLonToLocal(geo.origen, geo.mLat, geo.mLon, lat, lon);
    const [px, py] = localToPx(geo.A, geo.B, e, n);
    if (px < -200 || py < -200 || px > ancho + 200 || py > alto + 200) return null;
    return [px * sx, py * sy];
  };

  let nStreet = 0;
  let nRail = 0;
  let nCoast = 0;

  for (const w of ways) {
    const geom = w.geometry;
    if (!geom || geom.length < 2) continue;
    const pts: Array<[number, number]> = [];
    for (const g of geom) {
      const p = project(g.lat, g.lon);
      if (p) pts.push(p);
    }
    if (pts.length < 2) continue;

    const tags = w.tags ?? {};
    const hw = tags.highway ?? "";
    const rail = tags.railway ?? "";
    const natural = tags.natural ?? "";

    if (natural === "coastline" || tags.waterway === "river" || tags.water === "river") {
      stroke(lejos, pts, 2, 0, 255);
      stroke(cerca, pts, 1, 0, 200);
      nCoast++;
      continue;
    }
    if (rail === "rail" || rail === "subway" || rail === "light_rail") {
      stroke(lejos, pts, 1, 0, 220);
      stroke(cerca, pts, 0, 0, 180);
      nRail++;
      continue;
    }
    if (!hw) continue;

    const major = /motorway|trunk|primary|secondary/.test(hw);
    const mid = /tertiary|residential|unclassified|living_street/.test(hw);
    if (major) {
      stroke(lejos, pts, 2, 0, 255);
      stroke(cerca, pts, 1, 0, 255);
      nStreet++;
    } else if (mid) {
      stroke(cerca, pts, 0, 0, 200);
      nStreet++;
    }
  }

  // Tierra ganada: este de la costa 1867 (Alameda ~ lon -58.3668) hasta lon actual
  // En el plano: +py = este → py > costa1867
  const costa1867 = gcps.find((g) => g.nombre.includes("Costa"));
  const coastPy = costa1867?.py ?? plaza[1] + 400;
  const coastY = Math.round(coastPy * sy);
  for (let y = Math.max(0, coastY); y < H; y++) {
    for (let x = Math.round(W * 0.12); x < W * 0.88; x++) {
      // solo bajo la franja “mar” del grabado (sur de la hoja ≈ este geográfico)
      const wave = Math.sin(x * 0.03) * 6;
      if (y > coastY + wave) {
        const i = (y * W + x) * 3 + 1;
        lejos[i] = Math.max(lejos[i], 160);
      }
    }
  }

  await sharp(cerca, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality: 84 })
    .toFile(path.join(PLANO, "hoy-cerca.webp"));
  await sharp(lejos, { raw: { width: W, height: H, channels: 3 } })
    .webp({ quality: 84 })
    .toFile(path.join(PLANO, "hoy-lejos.webp"));

  console.log(`calles≈${nStreet} · vías≈${nRail} · costa≈${nCoast}`);
  console.log(`hoy-cerca/lejos ${W}×${H}`);

  // Hitos modernos en px georreferenciados
  const hitos = [
    { nombre: "Plaza de la Victoria", lat: -34.60833, lon: -58.37194, nivel: 1, nota: "Hoy Plaza de Mayo." },
    { nombre: "Cabildo", lat: -34.6085, lon: -58.3736, nivel: 1, nota: "Fachada a la plaza." },
    { nombre: "Catedral", lat: -34.6076, lon: -58.3733, nivel: 1, nota: "Torre a la vista." },
    { nombre: "Casa Rosada", lat: -34.6081, lon: -58.3704, nivel: 2, nota: "Sobre el Fuerte." },
    { nombre: "Obelisco", lat: -34.6037, lon: -58.3816, nivel: 1, nota: "Obra de 1936.", desde: 1940 },
    { nombre: "Congreso", lat: -34.6098, lon: -58.3925, nivel: 1, nota: "Desde el Centenario.", desde: 1910 },
    { nombre: "Teatro Colón", lat: -34.6011, lon: -58.3832, nivel: 2, nota: "Estación del Parque en 1867.", desde: 1910 },
    {
      nombre: "Puerto Madero",
      lat: -34.611,
      lon: -58.362,
      nivel: 1,
      rio: true,
      nota: "Tierra ganada al río.",
      desde: 1921,
    },
  ].map((h) => {
    const [e, n] = latLonToLocal(geo.origen, geo.mLat, geo.mLon, h.lat, h.lon);
    const [x, y] = localToPx(geo.A, geo.B, e, n);
    return { ...h, x, y, mx: e, mz: -n };
  });
  await writeFile(path.join(DATOS, "hoy.json"), JSON.stringify(hitos, null, 2));
  console.log("hoy.json (hitos) OK");
}

async function fetchOsm(box: { south: number; west: number; north: number; east: number }): Promise<Way[]> {
  const { south, west, north, east } = box;
  const q = `
[out:json][timeout:90];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)$"](${south},${west},${north},${east});
  way["railway"~"^(rail|light_rail)$"](${south},${west},${north},${east});
  way["natural"="coastline"](${south},${west},${north},${east});
  way["waterway"="river"](${south},${west},${north},${east});
);
out geom;
`;
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "baires-garden/0.1 (local rebuild; contact: local)",
    },
    body: `data=${encodeURIComponent(q)}`,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Overpass HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { elements?: Way[] };
  return j.elements ?? [];
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
