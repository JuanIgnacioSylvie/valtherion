/** Tipologías del original (src/ciudad.js → Dl / Al). */
export const Estilo = {
  COLONIAL: 0,
  ITALIANA: 1,
  FRANCESA: 2,
  COMERCIO: 3,
  RACIONAL: 4,
  GALPON: 5,
  CHAPA: 6,
  ORILLA: 7,
  RANCHO: 8,
} as const;

export type EstiloId = (typeof Estilo)[keyof typeof Estilo];

/** Aurion usa paleta medieval (techos a dos aguas + piedra/ladrillo). */
let mode: "baires" | "medieval" = "medieval";

export function setEstiloMode(m: "baires" | "medieval") {
  mode = m;
}

export function getEstiloMode() {
  return mode;
}

function smooth01(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / Math.max(1e-6, e1 - e0)));
  return t * t * (3 - 2 * t);
}

function hash01(n: number) {
  const x = Math.sin(((n | 0) ^ 2127912215) * 2654435761) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Estilo según posición en mundo (m desde la plaza), etapa y pisos.
 * Port de Al(e,t,n,r,i) del original — o mezcla medieval para Aurion.
 */
export function estiloDe(
  wx: number,
  wz: number,
  etapa: number,
  pisos: number,
  seedU: number,
): EstiloId {
  if (mode === "medieval") return estiloMedieval(wx, wz, etapa, pisos, seedU);
  return estiloBaires(wx, wz, etapa, pisos, seedU);
}

/**
 * Aurion medieval:
 * - mayoría a dos aguas (galpón / orilla / rancho / chapa)
 * - algunos techos planos (colonial / racional → madera o paja)
 * - cerca de la plaza: más opulento (piedra/teja, algún comercio)
 */
function estiloMedieval(
  wx: number,
  wz: number,
  _etapa: number,
  pisos: number,
  seedU: number,
): EstiloId {
  const a = Estilo;
  const s = hash01(seedU * 3 + 2);
  const o = hash01(seedU * 3 + 1);
  const v = hash01(seedU * 3 + 7);
  const dist = Math.hypot(wx, wz);

  // barrio cívico / opulento junto a la plaza
  if (dist < 160) {
    if (v < 0.1) return a.ITALIANA; // fachada con molduras
    if (v < 0.2 && pisos < 3) return a.RACIONAL; // techo plano de madera
    if (pisos >= 3) return a.GALPON;
    return s < 0.75 ? a.GALPON : a.ORILLA;
  }

  // casco intramuros
  if (dist < 700) {
    // ~18% techos planos (madera / paja)
    if (o < 0.18 && pisos <= 2) return v < 0.55 ? a.COLONIAL : a.RACIONAL;
    if (v < 0.07) return a.ITALIANA;
    if (pisos >= 3) return a.GALPON;
    if (s < 0.42) return a.GALPON;
    if (s < 0.62) return a.ORILLA;
    if (s < 0.78) return a.CHAPA; // pizarra / madera
    return a.RANCHO; // paja
  }

  // arrabales / costa
  if (o < 0.22 && pisos < 2) return a.COLONIAL; // plano pobre
  if (o > 0.55 && pisos < 2) return a.RANCHO;
  if (s < 0.3) return a.ORILLA;
  if (s < 0.55) return a.CHAPA;
  if (s < 0.82) return a.RANCHO;
  return a.GALPON;
}

function estiloBaires(
  wx: number,
  wz: number,
  etapa: number,
  pisos: number,
  seedU: number,
): EstiloId {
  const a = Estilo;
  const o = hash01(seedU * 3 + 1);
  const s = hash01(seedU * 3 + 2);
  const c = hash01(seedU * 3 + 3);
  const l = Math.hypot(wx, wz);
  const u = 1 - smooth01(600, 1100, Math.hypot(wx + 3050, wz - 1250));
  const d = smooth01(1000, 1500, wx) * smooth01(-3300, -2700, wz) * (1 - smooth01(600, 1000, wz));
  const f = 1 - smooth01(600, 1300, Math.hypot(wx - 550, wz + 450));
  const p = Math.max(
    smooth01(380, 560, wz) * (1 - smooth01(2300, 2800, Math.abs(wx))),
    0.55 * smooth01(-2300, -2900, wx) * (1 - smooth01(300, 700, wz)),
  );
  if (u > o && pisos < 3) return etapa === 0 || s < 0.75 ? a.CHAPA : a.ITALIANA;
  if (etapa === 0) {
    if (p > o && pisos < 2) return a.GALPON;
    if (pisos >= 2) return a.ITALIANA;
    return smooth01(3000, 4500, l) > s ? a.RANCHO : a.COLONIAL;
  }
  if (p > o && pisos < 4) return a.GALPON;
  const m = smooth01(2300, 3700, l);
  if (etapa >= 6) {
    if (pisos >= 4) {
      if (s < 0.72) return a.RACIONAL;
      if (s < 0.86) return a.FRANCESA;
      return a.COMERCIO;
    }
    if (m > o) return a.ORILLA;
    if (s < 0.45) return a.RACIONAL;
    if (s < 0.75) return a.ITALIANA;
    return a.COMERCIO;
  }
  if (etapa >= 3) {
    if (pisos >= 3) {
      if (s < 0.4 + 0.45 * d) return a.FRANCESA;
      if (f > c) return a.COMERCIO;
      return a.ITALIANA;
    }
    if (m > o) return a.ORILLA;
    if (pisos === 2 && f * 0.7 > c) return a.COMERCIO;
    if (s < 0.2 + 0.3 * d) return a.FRANCESA;
    return a.ITALIANA;
  }
  if (m > o) return a.ORILLA;
  if (pisos >= 3) return d * 0.5 > s ? a.FRANCESA : a.ITALIANA;
  if (pisos === 2 && f * 0.4 > c) return a.COMERCIO;
  return a.ITALIANA;
}
