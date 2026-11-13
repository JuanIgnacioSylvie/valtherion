import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WorldBundleDto } from "@valtherion/contracts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadWorldSeed(id: string): WorldBundleDto | null {
  const candidates = [
    path.resolve(__dirname, `../../../content/worlds/${id}/seed.json`),
    path.resolve(__dirname, `../../../apps/web/public/worlds/${id}/seed.json`),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as WorldBundleDto;
    if (raw?.world?.id === id) return raw;
  }
  return null;
}
