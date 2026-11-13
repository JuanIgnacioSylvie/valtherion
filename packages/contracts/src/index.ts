export type PinKind =
  | "kingdom"
  | "province"
  | "capital"
  | "settlement"
  | "ocean"
  | "landmass"
  | "poi"
  | "scene";

export interface WorldDto {
  id: string;
  name: string;
  description: string | null;
  width: number;
  height: number;
  mapImage: string;
  rulePackId: string;
}

export interface PinDto {
  id: string;
  kind: PinKind;
  label: string;
  x: number;
  y: number;
  minZoom: number;
  maxZoom: number;
  loreNodeId: string | null;
  color: string | null;
  importance: number;
}

export interface LoreNodeDto {
  id: string;
  title: string;
  body: string;
  tags: string[];
  dmOnly: boolean;
}

/** Escena HD anclada al mundi (ciudad, dungeon, etc.). Coordenadas en espacio del mundo. */
export interface MapSceneDto {
  id: string;
  label: string;
  kind: "settlement" | "district" | "interior" | "region";
  /** Bounding box en coords del mundi. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Placeholder raster (opcional si hay settlementId). */
  mapImage?: string | null;
  /**
   * Asentamiento vectorial (LOD 2–3). URL a SettlementDto JSON.
   * Si está, el atlas dibuja edificios/calles desde datos (sin pixelar).
   */
  settlementUrl?: string | null;
  /** Zoom relativo (1 = mapamundi) a partir del cual se muestra. */
  minZoomRelative: number;
  maxZoomRelative: number;
  pinId?: string | null;
  loreNodeId?: string | null;
}

export type {
  SettlementDto,
  SettlementBuildingDto,
  SettlementPathDto,
  SettlementPolyDto,
} from "./settlement";
export type { SettlementDto as Settlement } from "./settlement";

export interface WorldBundleDto {
  world: WorldDto;
  pins: PinDto[];
  loreNodes: LoreNodeDto[];
  scenes?: MapSceneDto[];
}

export interface RulePackMeta {
  id: string;
  name: string;
  version: string;
  description: string;
}

export interface CompendiumEntry {
  id: string;
  category: string;
  title: string;
  summary: string;
  body: string;
  tags?: string[];
}

export interface UserDto {
  id: string;
  username: string;
  displayName: string;
}

export interface CampaignDto {
  id: string;
  name: string;
  description: string | null;
  worldId: string;
  rulePackId: string;
  isDM: boolean;
}

/** Wiki-style links in lore: [[node-id]] or [[node-id|label]] */
export const LORE_LINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
