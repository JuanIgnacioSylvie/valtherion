"use client";

import { create } from "zustand";
import type { LoreNodeDto, PinDto, WorldDto } from "@valtherion/contracts";

export interface LoreStackItem {
  nodeId: string;
  originPinId?: string;
}

interface AtlasState {
  world: WorldDto | null;
  pins: PinDto[];
  loreById: Record<string, LoreNodeDto>;
  zoom: number;
  showGrid: boolean;
  gridMinZoom: number;
  sideTab: "layers" | "lore" | "rules" | "session";
  loreStack: LoreStackItem[];
  selectedPinId: string | null;
  setBundle: (world: WorldDto, pins: PinDto[], lore: LoreNodeDto[]) => void;
  setZoom: (zoom: number) => void;
  setShowGrid: (v: boolean) => void;
  setSideTab: (tab: AtlasState["sideTab"]) => void;
  openLore: (nodeId: string, originPinId?: string) => void;
  openLoreLink: (nodeId: string) => void;
  closeTopLore: () => void;
  closeAllLore: () => void;
  selectPin: (pinId: string | null) => void;
}

export const useAtlasStore = create<AtlasState>((set, get) => ({
  world: null,
  pins: [],
  loreById: {},
  zoom: 0.35,
  showGrid: false,
  gridMinZoom: 2.2,
  sideTab: "layers",
  loreStack: [],
  selectedPinId: null,

  setBundle: (world, pins, lore) =>
    set({
      world,
      pins,
      loreById: Object.fromEntries(lore.map((n) => [n.id, n])),
    }),

  setZoom: (zoom) => {
    const showGrid = get().showGrid && zoom >= get().gridMinZoom;
    set({ zoom, showGrid });
  },

  setShowGrid: (v) => {
    if (v && get().zoom < get().gridMinZoom) return;
    set({ showGrid: v });
  },

  setSideTab: (sideTab) => set({ sideTab }),

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
