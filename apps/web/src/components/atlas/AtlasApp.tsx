"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { WorldBundleDto } from "@valtherion/contracts";
import { useAtlasStore } from "@/store/atlasStore";
import { SideRail } from "@/components/shell/SideRail";
import { LoreStack } from "@/components/lore/LoreBox";
import { API_URL } from "@/lib/utils";

const AtlasCanvas = dynamic(
  () => import("@/components/atlas/AtlasCanvas").then((m) => m.AtlasCanvas),
  { ssr: false },
);

export function AtlasApp() {
  const setBundle = useAtlasStore((s) => s.setBundle);
  const world = useAtlasStore((s) => s.world);
  const zoomRelative = useAtlasStore((s) => s.zoomRelative);
  const activeSceneIds = useAtlasStore((s) => s.activeSceneIds);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let seq = 0;

    async function apply(data: WorldBundleDto, token: number) {
      if (!alive || token !== seq) return;
      const prevScenes = useAtlasStore.getState().scenes;
      const scenes =
        data.scenes && data.scenes.length > 0 ? data.scenes : prevScenes.length > 0 ? prevScenes : [];
      setBundle(data.world, data.pins, data.loreNodes, scenes);
      setLoading(false);
      setError(null);
    }

    async function load() {
      const token = ++seq;
      setLoading(true);
      setError(null);

      try {
        const local = await fetch(`/worlds/valtherion/seed.json?t=${Date.now()}`);
        if (local.ok) {
          await apply((await local.json()) as WorldBundleDto, token);
        }
      } catch {
        /* API fallback */
      }

      try {
        const res = await fetch(`${API_URL}/worlds/valtherion`);
        if (!res.ok) throw new Error(`API ${res.status}`);
        await apply((await res.json()) as WorldBundleDto, token);
      } catch (e) {
        if (!alive || token !== seq) return;
        if (!useAtlasStore.getState().world) {
          setError(e instanceof Error ? e.message : "No se pudo cargar el mundo");
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [setBundle]);

  return (
    <div className="relative h-full w-full bg-ink">
      <SideRail />
      <div className="absolute inset-0 left-0 md:left-[22rem]">
        {loading && !world && (
          <div className="flex h-full items-center justify-center text-mist">Cargando atlas…</div>
        )}
        {error && !world && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-brass">No se pudo cargar Valtherion</p>
            <p className="max-w-md text-sm text-mist">{error}</p>
          </div>
        )}
        {world && <AtlasCanvas />}
        <LoreStack />
        <div className="pointer-events-none absolute bottom-3 right-3 space-y-1 text-right">
          {activeSceneIds.length > 0 && (
            <div className="rounded-sm border border-brass/40 bg-ink/80 px-2 py-1 text-xs text-brass">
              LOD ciudad: {activeSceneIds.join(", ")}
            </div>
          )}
          <div className="rounded-sm border border-white/10 bg-ink/70 px-2 py-1 text-xs text-mist">
            zoom {(zoomRelative * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  );
}
