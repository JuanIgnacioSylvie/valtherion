import fs from "node:fs";

const p = process.argv[2] || "C:/Users/juans/Desktop/Zytzayna (1).map";
const raw = fs.readFileSync(p, "utf8");

console.log("bytes", Buffer.byteLength(raw));
console.log("crlfRows", raw.split("\r\n").length, "lfLines", raw.split("\n").length);

const svgStart = raw.indexOf("<svg");
const svgEnd = raw.indexOf("</svg>");
console.log("svgStart", svgStart, "svgEnd", svgEnd, "svgLen", svgEnd > 0 ? svgEnd - svgStart + 6 : -1);

if (svgStart >= 0 && svgEnd > svgStart) {
  const svg = raw.slice(svgStart, svgEnd + 6);
  const open = svg.match(/<svg[^>]*>/)?.[0] ?? "";
  console.log("svgOpen", open.slice(0, 250));
  console.log("paths", (svg.match(/<path/g) || []).length);
  console.log("polygons", (svg.match(/<polygon/g) || []).length);
  console.log("circles", (svg.match(/<circle/g) || []).length);
  const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]).slice(0, 40);
  console.log("ids", ids);
}

const fullNames = raw.match(/"fullName":"[^"]+"/g) || [];
console.log("fullName count", fullNames.length, fullNames.slice(0, 20));

const names = [...raw.matchAll(/"name":"([^"]+)"/g)].map((m) => m[1]);
console.log("name samples", names.slice(0, 40));

// Try modern row layout if SVG is one row
const rows = raw.includes("\r\n") ? raw.split("\r\n") : raw.split("\n");
for (let i = 0; i < Math.min(rows.length, 40); i++) {
  const r = rows[i];
  if (!r) continue;
  if (r.startsWith("[") || r.startsWith("{") || r.startsWith("<svg") || i < 6) {
    console.log(`row[${i}] len=${r.length} head=${r.slice(0, 90).replace(/\s+/g, " ")}`);
  }
}
