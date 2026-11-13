/**
 * Reescribe pins/escenas del seed según geografía del lore Valtherion
 * (3 continentes + 3 islas en triángulo). Olvida Zytzayna.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const seedPath = path.join(root, "content/worlds/valtherion/seed.json");
const publicSeed = path.join(root, "apps/web/public/worlds/valtherion/seed.json");

const W = 1920;
const H = 911;

/** Anchors del lore (coords mundi). */
const GEO = {
  korthaven: { x: 290, y: 440 }, // oeste (elipse 250x380)
  aurion: { x: 960, y: 790 }, // sur (elipse 330x115)
  lexmara: { x: 1630, y: 440 }, // este (elipse 250x380)
  marInterior: { x: 960, y: 405 },
  nimrael: { x: 960, y: 215 }, // vertice N del triangulo equilatero (lado ~340)
  drakonys: { x: 790, y: 509 }, // SO
  selvareth: { x: 1130, y: 509 }, // SE
};

const kingdoms = [
  { id: 1, name: "Sangrevasto", full: "Reino de Sangrevasto", at: "korthaven", dx: -30, dy: 120 },
  { id: 2, name: "Ceniza", full: "Ceniza", at: "korthaven", dx: 60, dy: -60 },
  { id: 3, name: "Umbravalle", full: "Umbravalle", at: "korthaven", dx: -20, dy: -150 },
  { id: 4, name: "Olvido", full: "Olvido", at: "aurion", dx: -130, dy: 5 },
  { id: 5, name: "Concordia", full: "Concordia", at: "aurion", dx: 0, dy: 10 },
  { id: 6, name: "Frontera", full: "Frontera", at: "aurion", dx: 130, dy: -5 },
  { id: 7, name: "Solmarest", full: "Solmarest", at: "lexmara", dx: -40, dy: 110 },
  { id: 8, name: "Aurelion", full: "Aurelion", at: "lexmara", dx: 60, dy: -60 },
  { id: 9, name: "Lexford", full: "Lexford", at: "lexmara", dx: -50, dy: -140 },
  { id: 10, name: "Nimrael", full: "Nimrael", at: "nimrael", dx: 0, dy: 0 },
  { id: 11, name: "Drakonys", full: "Drakonys", at: "drakonys", dx: 0, dy: 0 },
  { id: 12, name: "Selvareth", full: "Selvareth", at: "selvareth", dx: 0, dy: 0 },
];

const capitals = [
  { id: 1, name: "Cenizabrava", kingdom: 1, at: "korthaven", dx: -10, dy: 150 },
  { id: 5, name: "Brassara", kingdom: 2, at: "korthaven", dx: 90, dy: -30 },
  { id: 8, name: "Nigromar", kingdom: 3, at: "korthaven", dx: -70, dy: -110 },
  { id: 10, name: "Ruinas de Lumineth", kingdom: 4, at: "aurion", dx: -110, dy: 15 },
  { id: 13, name: "Mesas de la Paz", kingdom: 5, at: "aurion", dx: 10, dy: 30 },
  { id: 16, name: "Vigilia del Alba", kingdom: 6, at: "aurion", dx: 115, dy: -15 },
  { id: 18, name: "Solmarest", kingdom: 7, at: "lexmara", dx: -30, dy: 150 },
  { id: 22, name: "Heliopolis", kingdom: 8, at: "lexmara", dx: 80, dy: -30 },
  { id: 25, name: "Lexford", kingdom: 9, at: "lexmara", dx: -60, dy: -120 },
  { id: 28, name: "Alfheimar", kingdom: 10, at: "nimrael", dx: 10, dy: 15 },
  { id: 30, name: "Drakonys", kingdom: 11, at: "drakonys", dx: -10, dy: 10 },
  { id: 32, name: "Selvareth", kingdom: 12, at: "selvareth", dx: 15, dy: -5 },
];

function pos(at, dx = 0, dy = 0) {
  const g = GEO[at];
  return { x: g.x + dx, y: g.y + dy };
}

const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));

seed.world = {
  ...seed.world,
  id: "valtherion",
  name: "Valtherion",
  description: "El mundo tripartito — Korthaven, Aurion, Lexmara y las tres islas del Mar Interior.",
  width: W,
  height: H,
  mapImage: "/worlds/valtherion/map-dnd-v4.jpg",
  rulePackId: "dnd-2024",
};

const pins = [];
const lore = [...(seed.loreNodes || [])];

function upsertLore(node) {
  const i = lore.findIndex((n) => n.id === node.id);
  if (i >= 0) lore[i] = { ...lore[i], ...node };
  else lore.push(node);
}

upsertLore({
  id: "world-valtherion",
  title: "Valtherion",
  tags: ["world", "history"],
  dmOnly: false,
  body: `VALTHERION — EL MUNDO TRIPARTITO

Geografía: tres continentes ([[place-korthaven|Korthaven]] al oeste, [[place-aurion|Aurion]] al sur, [[place-lexmara|Lexmara]] al este) y tres grandes islas — [[place-nimrael|Nimrael]], [[place-drakonys|Drakonys]] y [[place-selvareth|Selvareth]] — cuyos centros forman un triángulo equilátero perfecto en el [[place-mar-interior|Mar Interior]].

Hoy: el caos reina en [[place-korthaven|Korthaven]]. La legalidad y el orden dominan [[place-lexmara|Lexmara]]. [[place-aurion|Aurion]], al sur, guarda ruinas y secretos de la Era Élfica.`,
});

for (const [id, title, body] of [
  ["place-korthaven", "Korthaven", "Continente occidental. Tierras convulsas; el caos y la guerra aún late bajo la ceniza."],
  ["place-aurion", "Aurion", "Continente meridional de ruinas y secretos de la Era Élfica."],
  ["place-lexmara", "Lexmara", "Continente oriental de leyes, órdenes y ciudades ordenadas."],
  ["place-nimrael", "Nimrael", "Isla del norte del triángulo en el Mar Interior."],
  ["place-drakonys", "Drakonys", "Isla volcánica del triángulo; hogar de dragones y fuego antiguo."],
  ["place-selvareth", "Selvareth", "Isla selvática del triángulo oriental."],
  ["place-mar-interior", "Mar Interior", "Mar cerrado entre los tres continentes; en su centro el triángulo de islas sagradas."],
]) {
  upsertLore({ id, title, body, tags: ["place"], dmOnly: false });
}

// Continentes / océano pins
for (const [id, label, at, kind, importance] of [
  ["pin-korthaven", "Korthaven", "korthaven", "landmass", 5],
  ["pin-aurion", "Aurion", "aurion", "landmass", 5],
  ["pin-lexmara", "Lexmara", "lexmara", "landmass", 5],
  ["pin-mar-interior", "Mar Interior", "marInterior", "ocean", 5],
]) {
  const p = pos(at);
  pins.push({
    id,
    kind,
    label,
    x: p.x,
    y: p.y,
    minZoom: 1,
    maxZoom: 3.5,
    loreNodeId: id.replace("pin-", "place-"),
    color: kind === "ocean" ? "#4a90c8" : "#6a994e",
    importance,
  });
}

for (const k of kingdoms) {
  const p = pos(k.at, k.dx, k.dy);
  const loreId = `state-${k.id}`;
  const placeId =
    k.at === "korthaven" || k.at === "aurion" || k.at === "lexmara"
      ? `place-${k.at}`
      : `place-${k.at}`;
  const placeLabel =
    k.at === "korthaven"
      ? "Korthaven"
      : k.at === "aurion"
        ? "Aurion"
        : k.at === "lexmara"
          ? "Lexmara"
          : k.at[0].toUpperCase() + k.at.slice(1);
  upsertLore({
    id: loreId,
    title: k.full,
    body: `Reino de **${k.name}** en [[${placeId}|${placeLabel}]]. Ver [[world-valtherion|Valtherion]].`,
    tags: ["state", "kingdom"],
    dmOnly: false,
  });
  pins.push({
    id: `pin-state-${k.id}`,
    kind: "kingdom",
    label: k.name,
    x: p.x,
    y: p.y,
    minZoom: 1,
    maxZoom: 5,
    loreNodeId: loreId,
    color: null,
    importance: 5,
  });
}

for (const c of capitals) {
  const p = pos(c.at, c.dx, c.dy);
  const loreId = `burg-${c.id}`;
  upsertLore({
    id: loreId,
    title: c.name,
    body: `**Capital.** Pertenece a [[state-${c.kingdom}|reino]].${
      c.name === "Cenizabrava"
        ? "\n\n**Mapa HD:** usá Escenas HD → Cenizabrava (zoom de escena nativo) para ver techos."
        : ""
    }`,
    tags: ["burg", "capital"],
    dmOnly: false,
  });
  pins.push({
    id: `pin-burg-${c.id}`,
    kind: "capital",
    label: c.name,
    x: p.x,
    y: p.y,
    minZoom: 1.5,
    maxZoom: 48,
    loreNodeId: loreId,
    color: null,
    importance: 4,
  });
}

const ceniza = capitals.find((c) => c.name === "Cenizabrava");
const cenizaPos = pos(ceniza.at, ceniza.dx, ceniza.dy);
const citySize = 220;

seed.pins = pins;
seed.loreNodes = lore;
seed.scenes = [
  {
    id: "scene-cenizabrava",
    label: "Cenizabrava",
    kind: "settlement",
    x: cenizaPos.x - citySize / 2,
    y: cenizaPos.y - citySize / 2,
    width: citySize,
    height: citySize,
    mapImage: null,
    settlementUrl: "/worlds/valtherion/settlements/cenizabrava.json",
    minZoomRelative: 3,
    maxZoomRelative: 120,
    pinId: "pin-burg-1",
    loreNodeId: "burg-1",
  },
];
seed.meta = {
  ...(seed.meta || {}),
  geography: "lore-valtherion-tripartite-v2",
  note: "Zytzayna descartado; layout según texto del mundo tripartito.",
  updatedAt: new Date().toISOString(),
};

fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2));
fs.writeFileSync(publicSeed, JSON.stringify(seed, null, 2));
console.log("OK pins", pins.length, "scenes", seed.scenes.length, "lore", lore.length);
