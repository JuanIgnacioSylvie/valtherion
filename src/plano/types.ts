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

/** Fallback si no carga ciudad.json — Aurion ciudad grande ~4096×3072. */
export const GLADE_REF: PlanoMeta = {
  ancho: 4096,
  alto: 3072,
  metro: 1350 / (2 * 4096 * 0.3),
  plaza: [2048, 1475],
  marco: [164, 154, 3932, 2950],
};
