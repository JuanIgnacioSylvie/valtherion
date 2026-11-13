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

export interface WorldBundleDto {
  world: WorldDto;
  pins: PinDto[];
  loreNodes: LoreNodeDto[];
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
