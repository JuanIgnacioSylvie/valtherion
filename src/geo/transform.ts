export type GeoModel = {
  origen: { lat: number; lon: number };
  mLat: number;
  mLon: number;
  A: number[];
  B: number[];
};

/** lat/lon → metros locales (E, N) respecto al origen. */
export function latLonToLocal(geo: GeoModel, lat: number, lon: number): [number, number] {
  const e = (lon - geo.origen.lon) * geo.mLon;
  const n = (lat - geo.origen.lat) * geo.mLat;
  return [e, n];
}

/** metros locales (E,N en km-scaled como el original: /1000 en bases) → px plano. */
export function localToPx(geo: GeoModel, e: number, n: number): [number, number] {
  const bases = [1, e / 1000, n / 1000];
  let x = 0;
  let y = 0;
  for (let i = 0; i < geo.A.length; i++) {
    x += geo.A[i] * (bases[i] ?? 0);
    y += geo.B[i] * (bases[i] ?? 0);
  }
  return [x, y];
}

export function latLonToPx(geo: GeoModel, lat: number, lon: number): [number, number] {
  return localToPx(geo, ...latLonToLocal(geo, lat, lon));
}

export async function loadGeo(): Promise<GeoModel> {
  const r = await fetch("/datos/geo.json");
  if (!r.ok) throw new Error("geo.json");
  return r.json();
}
