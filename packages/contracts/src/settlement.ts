/** Asentamiento renderizado desde datos (LOD 2–3). Coords locales 0..width / 0..height. */

export interface SettlementBuildingDto {
  id: string;
  /** Polígono del footprint (techo), coords locales de la escena. */
  polygon: Array<[number, number]>;
  roofColor: string;
  wallColor?: string;
  /** Altura visual para sombra (px locales). */
  height?: number;
  label?: string;
  kind?: "house" | "keep" | "temple" | "market" | "tower" | "warehouse";
}

export interface SettlementPathDto {
  id: string;
  points: Array<[number, number]>;
  width: number;
  color?: string;
}

export interface SettlementPolyDto {
  id: string;
  polygon: Array<[number, number]>;
  color: string;
  stroke?: string;
}

export interface SettlementTreeDto {
  id: string;
  x: number;
  y: number;
  r: number;
  color?: string;
}

export interface SettlementDto {
  id: string;
  label: string;
  width: number;
  height: number;
  /** Color del suelo base. */
  groundColor: string;
  walls?: SettlementPolyDto[];
  water?: SettlementPolyDto[];
  parks?: SettlementPolyDto[];
  bridges?: SettlementPolyDto[];
  roads: SettlementPathDto[];
  buildings: SettlementBuildingDto[];
  trees?: SettlementTreeDto[];
}

export type { SettlementDto as default };
