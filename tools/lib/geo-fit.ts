/** Ajuste afín lat/lon → px del Glade (norte a la derecha de la hoja). */

export type Gcp = { nombre: string; lat: number; lon: number; px: number; py: number };

export type GeoModel = {
  origen: { lat: number; lon: number };
  mLat: number;
  mLon: number;
  A: number[];
  B: number[];
  nota?: string;
  gcps?: Array<{ nombre: string; lat: number; lon: number; px: number; py: number; err?: number }>;
};

export function metersPerDegree(lat: number) {
  const mLat = 111132.92 - 559.82 * Math.cos((2 * lat * Math.PI) / 180);
  const mLon = (111412.84 * Math.cos((lat * Math.PI) / 180)) - 93.5 * Math.cos((3 * lat * Math.PI) / 180);
  return { mLat, mLon };
}

export function latLonToLocal(
  origen: { lat: number; lon: number },
  mLat: number,
  mLon: number,
  lat: number,
  lon: number,
): [number, number] {
  return [(lon - origen.lon) * mLon, (lat - origen.lat) * mLat];
}

/** px = A·[1, e/1000, n/1000] (igual que runtime). */
export function localToPx(A: number[], B: number[], e: number, n: number): [number, number] {
  const b = [1, e / 1000, n / 1000];
  let x = 0;
  let y = 0;
  for (let i = 0; i < 3; i++) {
    x += (A[i] ?? 0) * (b[i] ?? 0);
    y += (B[i] ?? 0) * (b[i] ?? 0);
  }
  return [x, y];
}

/** Mínimos cuadrados 3×3: X = M β. */
function solve3(M: number[][], rhs: number[]): number[] {
  const a = M.map((row, i) => [...row, rhs[i]]);
  const n = 3;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    [a[col], a[piv]] = [a[piv], a[col]];
    const div = a[col][col] || 1e-12;
    for (let c = col; c <= n; c++) a[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col];
      for (let c = col; c <= n; c++) a[r][c] -= f * a[col][c];
    }
  }
  return a.map((row) => row[n]);
}

/**
 * Ajusta A,B con GCPs. Origen = primer GCP (Plaza).
 * Glade: norte → +px, este → +py (N a la derecha de la hoja).
 */
export function fitGeo(gcps: Gcp[]): GeoModel {
  if (gcps.length < 3) throw new Error("Hacen falta ≥3 GCPs");
  const origen = { lat: gcps[0].lat, lon: gcps[0].lon };
  const { mLat, mLon } = metersPerDegree(origen.lat);

  // Normal equations
  const MtM = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const MtX = [0, 0, 0];
  const MtY = [0, 0, 0];

  for (const g of gcps) {
    const [e, n] = latLonToLocal(origen, mLat, mLon, g.lat, g.lon);
    const row = [1, e / 1000, n / 1000];
    for (let i = 0; i < 3; i++) {
      MtX[i] += row[i] * g.px;
      MtY[i] += row[i] * g.py;
      for (let j = 0; j < 3; j++) MtM[i][j] += row[i] * row[j];
    }
  }

  const A = solve3(MtM, MtX);
  const B = solve3(MtM, MtY);

  const annotated = gcps.map((g) => {
    const [e, n] = latLonToLocal(origen, mLat, mLon, g.lat, g.lon);
    const [px, py] = localToPx(A, B, e, n);
    const err = Math.hypot(px - g.px, py - g.py);
    return { ...g, err: Math.round(err * 10) / 10 };
  });

  return {
    origen,
    mLat,
    mLon,
    A,
    B,
    nota: "Afín Glade 1867 (N a la derecha). GCPs Plaza/Congreso/Obelisco/costa.",
    gcps: annotated,
  };
}

/** Seed GCPs: px de escala 0.675 m/px + orientación N→derecha, E→abajo. */
export function seedGcps(plaza: [number, number], metro: number): Gcp[] {
  const [cx, cy] = plaza;
  const origen = { lat: -34.60833, lon: -58.37194 };
  const { mLat, mLon } = metersPerDegree(origen.lat);

  const places: Array<{ nombre: string; lat: number; lon: number }> = [
    { nombre: "Plaza de Mayo", lat: -34.60833, lon: -58.37194 },
    { nombre: "Congreso", lat: -34.6098, lon: -58.3925 },
    { nombre: "Obelisco", lat: -34.6037, lon: -58.3816 },
    { nombre: "Teatro Colón", lat: -34.6011, lon: -58.3832 },
    { nombre: "Constitución", lat: -34.6277, lon: -58.3812 },
    { nombre: "Retiro", lat: -34.5912, lon: -58.3742 },
    { nombre: "Casa Rosada (este plaza)", lat: -34.6081, lon: -58.3704 },
    { nombre: "Cabildo (oeste plaza)", lat: -34.6085, lon: -58.3736 },
    // costa 1867 aprox. frente al fuerte / aduana
    { nombre: "Costa 1867 (Alameda)", lat: -34.6085, lon: -58.3668 },
    { nombre: "Once", lat: -34.6095, lon: -58.407 },
  ];

  return places.map((p) => {
    const [e, n] = latLonToLocal(origen, mLat, mLon, p.lat, p.lon);
    // N → +px, E → +py
    return {
      nombre: p.nombre,
      lat: p.lat,
      lon: p.lon,
      px: cx + n / metro,
      py: cy + e / metro,
    };
  });
}

export function bboxLatLon(
  geo: GeoModel,
  ancho: number,
  alto: number,
  margin = 0.06,
): { south: number; west: number; north: number; east: number } {
  // Invertir afín en esquinas del marco útil
  const corners: [number, number][] = [
    [ancho * margin, alto * margin],
    [ancho * (1 - margin), alto * margin],
    [ancho * margin, alto * (1 - margin)],
    [ancho * (1 - margin), alto * 0.82],
  ];
  const inv = invertAffine(geo.A, geo.B);
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const [px, py] of corners) {
    const [e, n] = inv(px, py);
    const lat = geo.origen.lat + n / geo.mLat;
    const lon = geo.origen.lon + e / geo.mLon;
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lon);
    east = Math.max(east, lon);
  }
  return { south, west, north, east };
}

function invertAffine(A: number[], B: number[]) {
  // [e/1000, n/1000] = M^{-1} ([px,py] - [A0,B0])
  const a11 = A[1];
  const a12 = A[2];
  const a21 = B[1];
  const a22 = B[2];
  const det = a11 * a22 - a12 * a21 || 1e-12;
  return (px: number, py: number): [number, number] => {
    const dx = px - A[0];
    const dy = py - B[0];
    const ek = (a22 * dx - a12 * dy) / det;
    const nk = (-a21 * dx + a11 * dy) / det;
    return [ek * 1000, nk * 1000];
  };
}
