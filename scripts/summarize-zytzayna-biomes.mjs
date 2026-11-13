import fs from "node:fs";

const raw = fs.readFileSync("C:/Users/juans/Desktop/Zytzayna (1).map", "utf8");
const rows = raw.split("\r\n");
const biomesRow = rows[3] || "";
const [colors, , names] = biomesRow.split("|");
const biomeNames = (names || "").split(",");
console.log("biomes", biomeNames.filter(Boolean));

const packBiome = (rows[16] || "").split(",").map(Number);
const packState = (rows[25] || "").split(",").map(Number);
const heights = (rows[7] || "").split(",").map(Number);

// pack cells don't have x,y in row format easily — use burgs for spatial hints
const burgs = JSON.parse(rows[15] || "[]").filter((b) => b && b.i);
const features = JSON.parse(rows[12] || "[]").filter((f) => f && typeof f === "object");

const W = 1920;
const H = 937;
function zone(x, y) {
  const col = x < W / 3 ? "west" : x < (2 * W) / 3 ? "center" : "east";
  const row = y < H / 3 ? "north" : y < (2 * H) / 3 ? "mid" : "south";
  return `${row}-${col}`;
}

const counts = {};
for (const b of burgs) {
  const z = zone(b.x, b.y);
  counts[z] = (counts[z] || 0) + 1;
}
console.log("burg density by zone", counts);
console.log(
  "features",
  features.map((f) => ({ i: f.i, type: f.type, group: f.group, land: f.land, cells: f.cells })),
);

const hStats = {
  min: Math.min(...heights.filter((n) => !Number.isNaN(n))),
  max: Math.max(...heights.filter((n) => !Number.isNaN(n))),
  oceanish: heights.filter((h) => h < 20).length,
  low: heights.filter((h) => h >= 20 && h < 40).length,
  mid: heights.filter((h) => h >= 40 && h < 60).length,
  high: heights.filter((h) => h >= 60).length,
};
console.log("heightCells", hStats);
console.log("packBiome sample counts");
const bc = {};
for (const b of packBiome) bc[b] = (bc[b] || 0) + 1;
console.log(bc);
