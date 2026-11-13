"use client";

import { Layers, BookOpen, Dices, Users } from "lucide-react";
import { useAtlasStore } from "@/store/atlasStore";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/utils";
import type { CompendiumEntry, RulePackMeta } from "@valtherion/contracts";

const tabs = [
  { id: "layers" as const, label: "Capas", icon: Layers },
  { id: "lore" as const, label: "Lore", icon: BookOpen },
  { id: "rules" as const, label: "Reglas", icon: Dices },
  { id: "session" as const, label: "Sesión", icon: Users },
];

export function SideRail() {
  const sideTab = useAtlasStore((s) => s.sideTab);
  const setSideTab = useAtlasStore((s) => s.setSideTab);
  const world = useAtlasStore((s) => s.world);
  const pins = useAtlasStore((s) => s.pins);
  const zoomRelative = useAtlasStore((s) => s.zoomRelative);
  const showGrid = useAtlasStore((s) => s.showGrid);
  const setShowGrid = useAtlasStore((s) => s.setShowGrid);
  const gridMinZoomRelative = useAtlasStore((s) => s.gridMinZoomRelative);
  const openLore = useAtlasStore((s) => s.openLore);
  const loreById = useAtlasStore((s) => s.loreById);
  const scenes = useAtlasStore((s) => s.scenes);
  const activeSceneIds = useAtlasStore((s) => s.activeSceneIds);
  const requestFocusScene = useAtlasStore((s) => s.requestFocusScene);

  const [rules, setRules] = useState<{ meta: RulePackMeta; compendium: CompendiumEntry[] } | null>(
    null,
  );

  useEffect(() => {
    void fetch(`${API_URL}/rules/dnd-2024`)
      .then((r) => r.json())
      .then(setRules)
      .catch(() => setRules(null));
  }, []);

  const kindCounts = pins.reduce<Record<string, number>>((acc, p) => {
    acc[p.kind] = (acc[p.kind] || 0) + 1;
    return acc;
  }, {});

  return (
    <aside className="absolute inset-y-0 left-0 z-30 flex w-[min(22rem,100%)] flex-col border-r border-white/10 bg-ink/90 backdrop-blur-md">
      <div className="border-b border-white/10 px-4 py-4">
        <p className="font-display text-2xl tracking-wide text-brass">Valtherion</p>
        <p className="mt-1 text-xs text-mist">Atlas · {world?.name ?? "…"}</p>
      </div>

      <nav className="flex border-b border-white/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSideTab(t.id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 px-1 py-2 text-[10px] uppercase tracking-wider",
              sideTab === t.id ? "bg-white/5 text-brass" : "text-mist hover:text-parchment",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm text-parchment/90">
        {sideTab === "layers" && (
          <div className="space-y-4">
            <p className="text-mist">
              Zoom: {(zoomRelative * 100).toFixed(0)}%
              <span className="text-mist/70"> (100% = mapamundi)</span>
            </p>
            <label
              className={cn(
                "flex items-center justify-between gap-2 rounded-sm border border-white/10 px-3 py-2",
                zoomRelative < gridMinZoomRelative && "opacity-40",
              )}
            >
              <span>Mostrar grilla</span>
              <input
                type="checkbox"
                checked={showGrid}
                disabled={zoomRelative < gridMinZoomRelative}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
            </label>
            {zoomRelative < gridMinZoomRelative && (
              <p className="text-xs text-mist">
                La grilla se habilita desde {(gridMinZoomRelative * 100).toFixed(0)}% relativo.
              </p>
            )}
            <p className="text-xs text-mist/80">
              Mundi: tiles GPU on-demand. Ciudades: datos vectoriales (Cenizabrava). Ver{" "}
              <code className="text-brass/80">docs/MAP-LODS.md</code>.
            </p>
            <div>
              <h3 className="mb-2 font-display text-brass">Escenas HD (LOD)</h3>
              {scenes.length === 0 ? (
                <p className="text-xs text-mist">Todavía no hay ciudades ancladas.</p>
              ) : (
                <ul className="space-y-2">
                  {scenes.map((s) => {
                    const active = activeSceneIds.includes(s.id);
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => requestFocusScene(s.id)}
                          className={cn(
                            "w-full rounded-sm border px-2 py-2 text-left text-xs transition",
                            active
                              ? "border-brass/50 bg-brass/10 text-brass"
                              : "border-white/10 hover:border-brass/30 hover:bg-white/5",
                          )}
                        >
                          <span className="block font-medium">{s.label}</span>
                          <span className="text-mist">
                            desde {(s.minZoomRelative * 100).toFixed(0)}% · clic para ir
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 font-display text-brass">Pins cargados</h3>
              <ul className="space-y-1 text-xs">
                {Object.entries(kindCounts).map(([k, n]) => (
                  <li key={k} className="flex justify-between border-b border-white/5 py-1">
                    <span className="capitalize">{k}</span>
                    <span className="text-mist">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-mist">
              Arrastrá el mapa · rueda para zoom · clic en un pin para lore. En Escenas HD → Cenizabrava
              para ver la ciudad HD a zoom nativo.
            </p>
          </div>
        )}

        {sideTab === "lore" && (
          <div className="space-y-2">
            <h3 className="font-display text-brass">Índice</h3>
            {Object.values(loreById)
              .slice()
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openLore(n.id)}
                  className="block w-full rounded-sm border border-transparent px-2 py-1.5 text-left hover:border-brass/30 hover:bg-white/5"
                >
                  {n.title}
                </button>
              ))}
          </div>
        )}

        {sideTab === "rules" && (
          <div className="space-y-3">
            <h3 className="font-display text-brass">{rules?.meta.name ?? "D&D 2024"}</h3>
            <p className="text-xs text-mist">{rules?.meta.description}</p>
            <ul className="space-y-2">
              {(rules?.compendium ?? []).map((e) => (
                <li key={e.id} className="rounded-sm border border-white/10 bg-panel/60 p-2">
                  <p className="font-medium text-parchment">{e.title}</p>
                  <p className="text-xs text-mist">{e.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {sideTab === "session" && (
          <div className="space-y-3">
            <h3 className="font-display text-brass">Sesión</h3>
            <p className="text-xs text-mist">
              Auth, tokens, iniciativa y sync realtime entran en v1. El socket ya está cableado en
              la API (`camera:update`).
            </p>
            <div className="rounded-sm border border-dashed border-brass/40 p-3 text-xs text-mist">
              Próximo: unirse a campaña · dados · hoja · escena táctica anclada a un pin.
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
