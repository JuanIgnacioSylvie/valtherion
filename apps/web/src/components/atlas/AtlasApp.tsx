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
  const zoom = useAtlasStore((s) => s.zoom);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/worlds/valtherion`);
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = (await res.json()) as WorldBundleDto;
        if (!cancelled) setBundle(data.world, data.pins, data.loreNodes);
      } catch {
        try {
          const res = await fetch("/worlds/valtherion/seed.json");
          if (!res.ok) throw new Error("Sin seed local");
          const data = (await res.json()) as WorldBundleDto;
          if (!cancelled) setBundle(data.world, data.pins, data.loreNodes);
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : "No se pudo cargar el mundo");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [setBundle]);

  return (
    <div className="relative h-full w-full bg-ink">
      <SideRail />
      <div className="absolute inset-0 left-0 md:left-[22rem]">
        {loading && (
          <div className="flex h-full items-center justify-center text-mist">Cargando atlas…</div>
        )}
        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-brass">No se pudo cargar Valtherion</p>
            <p className="max-w-md text-sm text-mist">
              {error}. Corré `pnpm world:extract`, `pnpm db:seed` y la API en :4100.
            </p>
          </div>
        )}
        {!loading && !error && world && <AtlasCanvas />}
        <LoreStack />
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-sm border border-white/10 bg-ink/70 px-2 py-1 text-xs text-mist">
          zoom {(zoom * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
