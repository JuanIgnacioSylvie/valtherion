"use client";

import { create } from "zustand";
import type { LoreNodeDto, MapSceneDto, PinDto, WorldDto } from "@valtherion/contracts";

export interface LoreStackItem {
  nodeId: string;
  originPinId?: string;
}

interface AtlasState {
  world: WorldDto | null;
  pins: PinDto[];
  scenes: MapSceneDto[];
  loreById: Record<string, LoreNodeDto>;
  /** Escala Pixi absoluta (stage.scale). */
  zoom: number;
  /** Zoom donde el mundi entra justo en pantalla (= mapamundi / zoom 0). */
  fitZoom: number;
  /** zoom / fitZoom; 1 = mundi completo. */
  zoomRelative: number;
  showGrid: boolean;
  /** Umbral en zoom relativo para habilitar grilla. */
  gridMinZoomRelative: number;
  sideTab: "layers" | "lore" | "rules" | "session";
  loreStack: LoreStackItem[];
  selectedPinId: string | null;
  /** Pedido de cámara: encuadrar una escena (consumido por AtlasCanvas). */
  focusSceneId: string | null;
  activeSceneIds: string[];
  setBundle: (
    world: WorldDto,
    pins: PinDto[],
    lore: LoreNodeDto[],
    scenes?: MapSceneDto[],
  ) => void;
  setZoom: (zoom: number, fitZoom?: number) => void;
  setShowGrid: (v: boolean) => void;
  setSideTab: (tab: AtlasState["sideTab"]) => void;
  setActiveSceneIds: (ids: string[]) => void;
  requestFocusScene: (sceneId: string | null) => void;
  openLore: (nodeId: string, originPinId?: string) => void;
  openLoreLink: (nodeId: string) => void;
  closeTopLore: () => void;
  closeAllLore: () => void;
  selectPin: (pinId: string | null) => void;
}

export const useAtlasStore = create<AtlasState>((set, get) => ({
  world: null,
  pins: [],
  scenes: [],
  loreById: {},
  zoom: 1,
  fitZoom: 1,
  zoomRelative: 1,
  showGrid: false,
  gridMinZoomRelative: 8,
  sideTab: "layers",
  loreStack: [],
  selectedPinId: null,
  focusSceneId: null,
  activeSceneIds: [],

  setBundle: (world, pins, lore, scenes = []) =>
    set({
      world,
      pins,
      scenes,
      loreById: Object.fromEntries(lore.map((n) => [n.id, n])),
    }),

  setZoom: (zoom, fitZoomArg) => {
    const fitZoom = fitZoomArg ?? get().fitZoom ?? 1;
    const zoomRelative = fitZoom > 0 ? zoom / fitZoom : 1;
    set({
      zoom,
      fitZoom,
      zoomRelative,
      showGrid: zoomRelative < get().gridMinZoomRelative ? false : get().showGrid,
    });
  },

  setShowGrid: (v) => {
    if (v && get().zoomRelative < get().gridMinZoomRelative) return;
    set({ showGrid: v });
  },

  setSideTab: (sideTab) => set({ sideTab }),
  setActiveSceneIds: (activeSceneIds) => set({ activeSceneIds }),
  requestFocusScene: (focusSceneId) => set({ focusSceneId }),

  openLore: (nodeId, originPinId) =>
    set({
      loreStack: [{ nodeId, originPinId }],
      sideTab: "lore",
      selectedPinId: originPinId ?? get().selectedPinId,
    }),

  openLoreLink: (nodeId) => {
    const stack = get().loreStack;
    set({ loreStack: [...stack, { nodeId }], sideTab: "lore" });
  },

  closeTopLore: () => {
    const stack = get().loreStack.slice(0, -1);
    set({ loreStack: stack });
  },

  closeAllLore: () => set({ loreStack: [], selectedPinId: null }),

  selectPin: (selectedPinId) => set({ selectedPinId }),
}));
