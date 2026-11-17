import { latLonToPx, type GeoModel } from "./transform";
import type { PlanoMeta } from "../plano/types";

export type Hallazgo = {
  estado: "hallada" | "fuera" | "nada" | "error";
  nombre?: string;
  lat?: number;
  lon?: number;
  px?: number;
  py?: number;
  nota?: string;
};

async function usig(q: string) {
  const url =
    "https://servicios.usig.buenosaires.gob.ar/normalizar/?" +
    new URLSearchParams({ direccion: q, geocodificar: "true", maxOptions: "6" });
  const j = await fetch(url).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });
  return ((j.direccionesNormalizadas ?? []) as Array<{
    coordenadas?: { x: string; y: string };
    direccion?: string;
    nombre_calle?: string;
    altura?: number;
    cod_partido?: string;
  }>)
    .filter((d) => d.coordenadas && isFinite(+d.coordenadas.x) && isFinite(+d.coordenadas.y))
    .map((d) => ({
      lat: +d.coordenadas!.y,
      lon: +d.coordenadas!.x,
      nombre: d.direccion ?? `${d.nombre_calle ?? ""} ${d.altura ?? ""}`.trim(),
      caba: d.cod_partido === "caba",
    }));
}

async function nominatim(q: string) {
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q,
      format: "jsonv2",
      limit: "5",
      countrycodes: "ar",
      viewbox: "-58.75,-34.35,-58.15,-34.85",
      bounded: "1",
      "accept-language": "es",
    });
  const j = (await fetch(url, {
    headers: { Accept: "application/json" },
  }).then((r) => r.json())) as Array<{ lat: string; lon: string; display_name: string; name?: string }>;
  return (Array.isArray(j) ? j : []).map((d) => ({
    lat: +d.lat,
    lon: +d.lon,
    nombre: d.name || d.display_name.split(",")[0],
    caba: true,
  }));
}

export async function buscarDireccion(
  q: string,
  geo: GeoModel,
  meta: PlanoMeta,
): Promise<Hallazgo> {
  const query = q.trim().slice(0, 120);
  if (!query) return { estado: "nada" };

  let hits: { lat: number; lon: number; nombre: string; caba: boolean }[] = [];
  try {
    hits = await usig(query);
  } catch {
    /* fallback */
  }
  if (!hits.length) {
    try {
      hits = await nominatim(query);
    } catch {
      return { estado: "error", nota: "No pude consultar el buscador." };
    }
  }
  if (!hits.length) return { estado: "nada" };

  const withPx = hits.map((h) => ({ ...h, p: latLonToPx(geo, h.lat, h.lon) }));
  const inFrame = (p: [number, number]) =>
    p[0] > 0 && p[1] > 0 && p[0] < meta.ancho && p[1] < meta.alto;

  const pick =
    withPx.find((h) => h.caba && inFrame(h.p)) ??
    withPx.find((h) => inFrame(h.p)) ??
    withPx[0];

  const [px, py] = pick.p;
  if (!inFrame(pick.p)) {
    return {
      estado: "fuera",
      nombre: pick.nombre,
      lat: pick.lat,
      lon: pick.lon,
      px,
      py,
      nota: "Queda fuera del plano de 1867.",
    };
  }
  return {
    estado: "hallada",
    nombre: pick.nombre,
    lat: pick.lat,
    lon: pick.lon,
    px,
    py,
      nota: "Proyectada al Glade 1867 (georref afín).",
  };
}
