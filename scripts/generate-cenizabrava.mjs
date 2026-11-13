/**
 * Cenizabrava — asentamiento vectorial (estilo atlas ciudad D&D / Sondawoode).
 * Muro, río de ceniza, keep, templo, mercado, casas sin solaparse, árboles, puentes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "apps/web/public/worlds/valtherion/settlements");
const outFile = path.join(outDir, "cenizabrava.json");

const W = 220;
const H = 220;
const rnd = (() => {
  let a = 0xce12ab;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

function rect(x, y, w, h, rot = 0) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pts = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return pts.map(([px, py]) => [cx + px * c - py * s, cy + px * s + py * c]);
}

function polyBounds(poly) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function overlaps(a, b, pad = 1.2) {
  const A = polyBounds(a);
  const B = polyBounds(b);
  return !(
    A.maxX + pad < B.minX ||
    B.maxX + pad < A.minX ||
    A.maxY + pad < B.minY ||
    B.maxY + pad < A.minY
  );
}

function inWall(x, y) {
  const nx = (x - W / 2) / 82;
  const ny = (y - H / 2) / 82;
  return nx * nx + ny * ny < 1;
}

function nearRiver(x, y) {
  // línea approx (20,30)->(195,200)
  const t = ((x - 20) + (y - 30)) / 2;
  const rx = 20 + t * 0.9;
  const ry = 30 + t * 0.9;
  return Math.hypot(x - rx, y - ry) < 9;
}

function nearRoad(x, y) {
  return Math.abs(x - 110) < 5.5 || Math.abs(y - 110) < 5;
}

const ROOF = {
  house: ["#9a3f2e", "#b04a32", "#7a3224", "#a84830", "#8b3a2a"],
  keep: ["#5a5550", "#4a4540", "#6a6560"],
  temple: ["#6a5880", "#5c4a6e"],
  market: ["#d4b45a", "#c4a35a"],
  tower: ["#5a5854", "#484640"],
  warehouse: ["#7a6a52", "#6a5a48"],
};

const buildings = [];
const trees = [];
let bid = 0;

function addBuilding(poly, kind, label) {
  for (const b of buildings) {
    if (overlaps(poly, b.polygon)) return false;
  }
  const roofs = ROOF[kind] || ROOF.house;
  buildings.push({
    id: `b${bid++}`,
    polygon: poly.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]),
    roofColor: roofs[Math.floor(rnd() * roofs.length)],
    wallColor: "#2a2420",
    height: kind === "keep" ? 5.5 : kind === "tower" ? 4.2 : kind === "temple" ? 4 : 2 + rnd() * 1.4,
    kind,
    label,
  });
  return true;
}

// Muro
const wallPts = [];
for (let i = 0; i < 56; i++) {
  const a = (i / 56) * Math.PI * 2;
  const r = 92 + Math.sin(a * 3) * 3.5 + Math.cos(a * 5) * 2.5;
  wallPts.push([W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r]);
}
const wallInner = wallPts.map(([x, y]) => {
  const dx = x - W / 2;
  const dy = y - H / 2;
  const len = Math.hypot(dx, dy) || 1;
  return [W / 2 + (dx / len) * (len - 4.5), H / 2 + (dy / len) * (len - 4.5)];
});

// Río
const river = [
  [18, 28],
  [50, 58],
  [85, 90],
  [110, 112],
  [140, 140],
  [170, 168],
  [200, 198],
];
const riverPoly = [];
for (let i = 0; i < river.length; i++) {
  const [x, y] = river[i];
  const prev = river[Math.max(0, i - 1)];
  const next = river[Math.min(river.length - 1, i + 1)];
  const tx = next[0] - prev[0];
  const ty = next[1] - prev[1];
  const len = Math.hypot(tx, ty) || 1;
  const nx = (-ty / len) * 4.8;
  const ny = (tx / len) * 4.8;
  riverPoly.push([x + nx, y + ny]);
}
for (let i = river.length - 1; i >= 0; i--) {
  const [x, y] = river[i];
  const prev = river[Math.max(0, i - 1)];
  const next = river[Math.min(river.length - 1, i + 1)];
  const tx = next[0] - prev[0];
  const ty = next[1] - prev[1];
  const len = Math.hypot(tx, ty) || 1;
  const nx = (-ty / len) * 4.8;
  const ny = (tx / len) * 4.8;
  riverPoly.push([x - nx, y - ny]);
}

const roads = [
  {
    id: "road-ns",
    points: [
      [110, 22],
      [110, 70],
      [110, 110],
      [110, 155],
      [110, 198],
    ],
    width: 6.5,
    color: "#6a5e52",
  },
  {
    id: "road-ew",
    points: [
      [28, 110],
      [70, 110],
      [110, 110],
      [155, 110],
      [192, 110],
    ],
    width: 6,
    color: "#6a5e52",
  },
  {
    id: "road-market",
    points: [
      [110, 110],
      [135, 92],
      [158, 78],
    ],
    width: 4.5,
    color: "#6a5e52",
  },
  {
    id: "road-keep",
    points: [
      [110, 110],
      [92, 135],
      [72, 160],
    ],
    width: 5,
    color: "#6a5e52",
  },
];

// Landmarks
addBuilding(rect(58, 158, 26, 20, -0.12), "keep", "Ciudadela de Ceniza");
addBuilding(rect(50, 150, 9, 9, 0.1), "tower");
addBuilding(rect(80, 150, 8, 8, -0.08), "tower");
addBuilding(rect(99, 36, 22, 16, 0.04), "temple", "Santuario del Ember");
addBuilding(rect(150, 68, 20, 14, -0.18), "market", "Mercado de Brasas");

for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2 + 0.18;
  const r = 89;
  addBuilding(rect(W / 2 + Math.cos(a) * r - 4.5, H / 2 + Math.sin(a) * r - 4.5, 9, 9, a), "tower");
}

const districts = [
  { x0: 42, y0: 48, x1: 95, y1: 95 },
  { x0: 122, y0: 42, x1: 172, y1: 68 },
  { x0: 128, y0: 100, x1: 178, y1: 150 },
  { x0: 42, y0: 118, x1: 98, y1: 148 },
  { x0: 128, y0: 158, x1: 172, y1: 182 },
  { x0: 55, y0: 70, x1: 95, y1: 100 },
];

for (const d of districts) {
  let placed = 0;
  for (let attempt = 0; attempt < 120 && placed < 18; attempt++) {
    const bw = 5 + rnd() * 6.5;
    const bh = 4.5 + rnd() * 5.5;
    const x = d.x0 + rnd() * Math.max(1, d.x1 - d.x0 - bw);
    const y = d.y0 + rnd() * Math.max(1, d.y1 - d.y0 - bh);
    const cx = x + bw / 2;
    const cy = y + bh / 2;
    if (!inWall(cx, cy) || nearRiver(cx, cy) || nearRoad(cx, cy)) continue;
    if (addBuilding(rect(x, y, bw, bh, (rnd() - 0.5) * 0.28), rnd() > 0.85 ? "warehouse" : "house")) {
      placed++;
    }
  }
}

// Árboles en plazas / borde río
for (let i = 0; i < 40; i++) {
  const x = 30 + rnd() * 160;
  const y = 30 + rnd() * 160;
  if (!inWall(x, y)) continue;
  if (nearRoad(x, y)) continue;
  let hit = false;
  for (const b of buildings) {
    if (overlaps([[x, y], [x + 3, y], [x + 3, y + 3], [x, y + 3]], b.polygon, 0.5)) {
      hit = true;
      break;
    }
  }
  if (hit) continue;
  trees.push({
    id: `t${i}`,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    r: 1.6 + rnd() * 1.4,
    color: rnd() > 0.5 ? "#2a4a28" : "#1e3a1c",
  });
}

const settlement = {
  id: "settlement-cenizabrava",
  label: "Cenizabrava",
  width: W,
  height: H,
  groundColor: "#3e3830",
  walls: [
    {
      id: "wall-outer",
      polygon: wallPts.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]),
      color: "#5a5550",
      stroke: "#1a1612",
    },
    {
      id: "wall-yard",
      polygon: wallInner.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]),
      color: "#3e3830",
      stroke: "#2a2620",
    },
  ],
  water: [
    {
      id: "ash-river",
      polygon: riverPoly.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]),
      color: "#2c3a44",
      stroke: "#1a252e",
    },
  ],
  parks: [
    {
      id: "plaza",
      polygon: [
        [102, 102],
        [118, 102],
        [118, 118],
        [102, 118],
      ],
      color: "#4a4238",
      stroke: "#2a2420",
    },
  ],
  bridges: [
    {
      id: "bridge-ns",
      polygon: [
        [106, 104],
        [114, 104],
        [114, 120],
        [106, 120],
      ],
      color: "#6a5e52",
      stroke: "#2a2420",
    },
  ],
  roads,
  buildings,
  trees,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(settlement, null, 2));
console.log("OK buildings", buildings.length, "trees", trees.length, "→", outFile);
