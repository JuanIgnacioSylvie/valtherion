/** Metadatos de la hoja del plano (px y metros). */
export type PlanoMeta = {
  /** Ancho del escaneo en píxeles. */
  ancho: number;
  /** Alto del escaneo en píxeles. */
  alto: number;
  /** Metros por píxel del escaneo. */
  metro: number;
  /** Píxel de referencia (Plaza de la Victoria ≈ Plaza de Mayo). */
  plaza: [number, number];
  /** Guarda interior [x0,y0,x1,y1] en px (opcional). */
  marco?: [number, number, number, number];
};

export type LaminasMeta = {
  ancho: number;
  alto: number;
  tesela: number;
  cols: number;
  rows: number;
};

/** Meta de referencia del original (hasta tener extract propio). */
export const GLADE_REF: PlanoMeta = {
  ancho: 18919,
  alto: 13272,
  metro: 0.675,
  plaza: [10335, 9485],
  marco: [1300, 1250, 18180, 12510],
};
