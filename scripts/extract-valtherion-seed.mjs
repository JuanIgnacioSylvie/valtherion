/**
 * Extrae pins + lore + SVG de fondo desde maps/Valtherion.json de roldninja.
 * Uso: node scripts/extract-valtherion-seed.mjs [path-al-json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src =
  process.argv[2] ||
  path.resolve(root, "../roldninja/maps/Valtherion.json");
const outDir = path.join(root, "content/worlds/valtherion");
const publicDir = path.join(root, "apps/web/public/worlds/valtherion");

if (!fs.existsSync(src)) {
  console.error("No se encontró Valtherion.json en", src);
  process.exit(1);
}

const map = JSON.parse(fs.readFileSync(src, "utf8"));
const { info, pack, notes = [], biomesData } = map;
const W = info.width || 1920;
const H = info.height || 911;

const biomeColors = {
  0: "#1a2744",
  1: "#c2b280",
  2: "#a3c76d",
  3: "#6a994e",
  4: "#386641",
  5: "#bc6c25",
  6: "#adb5bd",
  7: "#e9ecef",
  8: "#40916c",
  9: "#52b788",
  10: "#74c69d",
  11: "#95d5b2",
  12: "#d8f3dc",
};

function linkifyLegend(text) {
  // Convierte nombres propios frecuentes en links potenciales [[Nombre]]
  return text;
}

const loreNodes = [];
const pins = [];

function addLore({ id, title, body, tags = [], dmOnly = false }) {
  loreNodes.push({ id, title, body, tags, dmOnly });
  return id;
}

// Mundo
addLore({
  id: "world-valtherion",
  title: "Valtherion",
  body:
    notes.find((n) => n.id === "world-history")?.legend ||
    "Valtherion — el mundo tripartito. Tres continentes y tres islas sagradas en el Mar Interior.",
  tags: ["world", "history"],
});

for (const n of notes) {
  if (!n?.id || n.id === "world-history") continue;
  addLore({
    id: `note-${n.id}`,
    title: n.name || n.id,
    body: linkifyLegend(n.legend || ""),
    tags: ["note"],
  });
}

// Features (océanos, islas/continentes)
for (const f of pack.features || []) {
  if (!f || typeof f !== "object" || !f.i) continue;
  const cells = (pack.cells || []).filter((c) => c && c.f === f.i);
  if (!cells.length) continue;
  const x = cells.reduce((s, c) => s + c.p[0], 0) / cells.length;
  const y = cells.reduce((s, c) => s + c.p[1], 0) / cells.length;
  const loreId = addLore({
    id: `feature-${f.i}`,
    title: f.group === "continent" ? `Continente / isla #${f.i}` : f.type,
    body: `Tipo: **${f.type}**. ${f.land ? "Tierra" : "Agua"}${f.group ? ` · grupo \`${f.group}\`` : ""}. Área aprox. ${Math.round(f.area || 0)}.`,
    tags: ["feature", f.type],
  });
  const isMajor = f.type === "ocean" || f.group === "continent" || (f.cells || 0) > 400;
  pins.push({
    id: `pin-feature-${f.i}`,
    kind: f.land ? "landmass" : "ocean",
    label: f.group === "continent" ? `Tierra ${f.i}` : f.type === "ocean" ? "Océano" : f.type,
    x,
    y,
    minZoom: 0,
    maxZoom: isMajor ? 1.2 : 2.5,
    loreNodeId: loreId,
    importance: isMajor ? 5 : 2,
  });
}

// Estados / reinos
for (const s of pack.states || []) {
  if (!s || !s.i || !s.name) continue;
  const capital = (pack.burgs || []).find((b) => b && b.i === s.capital);
  const cells = (pack.cells || []).filter((c) => c && c.state === s.i);
  const x = capital?.x ?? (cells.length ? cells.reduce((a, c) => a + c.p[0], 0) / cells.length : W / 2);
  const y = capital?.y ?? (cells.length ? cells.reduce((a, c) => a + c.p[1], 0) / cells.length : H / 2);

  const neighbors = (s.diplomacy || [])
    .map((rel, idx) => {
      const other = pack.states[idx];
      if (!other?.name || rel === "x" || !rel) return null;
      return `- [[state-${other.i}|${other.name}]]: ${rel}`;
    })
    .filter(Boolean)
    .join("\n");

  const loreId = addLore({
    id: `state-${s.i}`,
    title: s.fullName || s.name,
    body: [
      `**${s.formName || s.form || "Reino"}** de tipo ${s.type || "—"}.`,
      capital ? `Capital: [[burg-${capital.i}|${capital.name}]].` : "",
      s.color ? `Color heráldico: \`${s.color}\`.` : "",
      neighbors ? `\n### Diplomacia\n${neighbors}` : "",
      `\nVer también: [[world-valtherion|Valtherion]].`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    tags: ["state", "kingdom"],
  });

  pins.push({
    id: `pin-state-${s.i}`,
    kind: "kingdom",
    label: s.name,
    x,
    y,
    minZoom: 0,
    maxZoom: 2.2,
    loreNodeId: loreId,
    color: s.color,
    importance: 5,
  });
}

// Provincias
for (const p of pack.provinces || []) {
  if (!p || !p.i || !p.name) continue;
  const cells = (pack.cells || []).filter((c) => c && c.province === p.i);
  if (!cells.length) continue;
  const x = cells.reduce((s, c) => s + c.p[0], 0) / cells.length;
  const y = cells.reduce((s, c) => s + c.p[1], 0) / cells.length;
  const state = pack.states?.[p.state];
  const loreId = addLore({
    id: `province-${p.i}`,
    title: p.fullName || p.name,
    body: [
      state ? `Provincia de [[state-${state.i}|${state.name}]].` : "Provincia.",
      p.formName ? `Forma: ${p.formName}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    tags: ["province"],
  });
  pins.push({
    id: `pin-province-${p.i}`,
    kind: "province",
    label: p.name,
    x,
    y,
    minZoom: 0.55,
    maxZoom: 4,
    loreNodeId: loreId,
    importance: 3,
  });
}

// Burgs / ciudades
for (const b of pack.burgs || []) {
  if (!b || !b.i || !b.name || b.removed) continue;
  const state = pack.states?.[b.state];
  const loreId = addLore({
    id: `burg-${b.i}`,
    title: b.name,
    body: [
      b.capital ? "**Capital.**" : "**Asentamiento.**",
      state ? `Pertenece a [[state-${state.i}|${state.fullName || state.name}]].` : "",
      `Población relativa: ${b.population ?? "—"}.`,
      b.port ? "Puerto activo." : "",
      b.citadel || b.walls || b.temple || b.plaza
        ? `Estructuras: ${[
            b.citadel && "ciudadela",
            b.walls && "murallas",
            b.temple && "templo",
            b.plaza && "plaza",
          ]
            .filter(Boolean)
            .join(", ")}.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    tags: ["burg", b.capital ? "capital" : "settlement"],
  });
  pins.push({
    id: `pin-burg-${b.i}`,
    kind: b.capital ? "capital" : "settlement",
    label: b.name,
    x: b.x,
    y: b.y,
    minZoom: b.capital ? 0.35 : 0.85,
    maxZoom: 8,
    loreNodeId: loreId,
    importance: b.capital ? 4 : 2,
  });
}

// Enrich feature labels with continent names from world lore if possible
const continentHints = [
  { match: /korthaven/i, label: "Korthaven" },
  { match: /aurion/i, label: "Aurion" },
  { match: /lexmara/i, label: "Lexmara" },
  { match: /nimrael/i, label: "Nimrael" },
  { match: /drakonys/i, label: "Drakonys" },
  { match: /selvareth/i, label: "Selvareth" },
];

// Rename island/state pins that match known names
for (const pin of pins) {
  if (pin.kind !== "kingdom") continue;
  for (const h of continentHints) {
    if (h.match.test(pin.label)) {
      // keep kingdom name; continents are separate lore
    }
  }
}

// Named landmass lore from world text
for (const name of ["Korthaven", "Aurion", "Lexmara", "Nimrael", "Drakonys", "Selvareth", "Mar Interior"]) {
  if (!loreNodes.some((n) => n.id === `place-${name.toLowerCase().replace(/\s+/g, "-")}`)) {
    addLore({
      id: `place-${name.toLowerCase().replace(/\s+/g, "-")}`,
      title: name,
      body: `Lugar notable de [[world-valtherion|Valtherion]]. Ampliar lore desde el editor DM.`,
      tags: ["place", "stub"],
    });
  }
}

// Update world body with wiki links
const world = loreNodes.find((n) => n.id === "world-valtherion");
if (world) {
  world.body = world.body
    .replace(/Korthaven/g, "[[place-korthaven|Korthaven]]")
    .replace(/Aurion/g, "[[place-aurion|Aurion]]")
    .replace(/Lexmara/g, "[[place-lexmara|Lexmara]]")
    .replace(/Nimrael/g, "[[place-nimrael|Nimrael]]")
    .replace(/Drakonys/g, "[[place-drakonys|Drakonys]]")
    .replace(/Selvareth/g, "[[place-selvareth|Selvareth]]")
    .replace(/Mar Interior/g, "[[place-mar-interior|Mar Interior]]");
}

// SVG background from cells
const land = (pack.cells || []).filter((c) => c && c.h >= 20);
const water = (pack.cells || []).filter((c) => c && c.h < 20);
const stateColor = Object.fromEntries(
  (pack.states || []).filter((s) => s?.i).map((s) => [s.i, s.color || "#666"]),
);

let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n`;
svg += `<rect width="100%" height="100%" fill="#0b1628"/>\n`;
for (const c of water) {
  svg += `<circle cx="${c.p[0].toFixed(1)}" cy="${c.p[1].toFixed(1)}" r="7" fill="#1b3a5a" opacity="0.85"/>\n`;
}
for (const c of land) {
  const fill = stateColor[c.state] || biomeColors[c.biome] || "#4a5d3a";
  svg += `<circle cx="${c.p[0].toFixed(1)}" cy="${c.p[1].toFixed(1)}" r="6.5" fill="${fill}" opacity="0.92"/>\n`;
}
svg += `</svg>\n`;

const seed = {
  world: {
    id: "valtherion",
    name: "Valtherion",
    width: W,
    height: H,
    mapImage: "/worlds/valtherion/map.svg",
    rulePackId: "dnd-2024",
    description: "El mundo tripartito — Era del Hombre.",
  },
  pins,
  loreNodes,
  meta: {
    extractedAt: new Date().toISOString(),
    source: "roldninja/maps/Valtherion.json",
    azgaarVersion: info.version,
    seed: info.seed,
    counts: {
      pins: pins.length,
      loreNodes: loreNodes.length,
      states: (pack.states || []).filter((s) => s?.i).length,
      burgs: (pack.burgs || []).filter((b) => b?.i && !b.removed).length,
    },
  },
};

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "seed.json"), JSON.stringify(seed, null, 2));
fs.writeFileSync(path.join(publicDir, "map.svg"), svg);
fs.writeFileSync(path.join(publicDir, "seed.json"), JSON.stringify(seed, null, 2));
// Copia compacta del mapa original (referencia; no se sirve al cliente por defecto)
fs.copyFileSync(src, path.join(outDir, "Valtherion.source.json"));

console.log("Seed escrito:", path.join(outDir, "seed.json"));
console.log(seed.meta.counts);
