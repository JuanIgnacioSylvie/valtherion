"use client";

import { X, ChevronLeft } from "lucide-react";
import { LORE_LINK_RE } from "@valtherion/contracts";
import { useAtlasStore } from "@/store/atlasStore";
import { cn } from "@/lib/utils";

function RichBody({ body }: { body: string }) {
  const openLoreLink = useAtlasStore((s) => s.openLoreLink);
  const parts: React.ReactNode[] = [];
  const re = new RegExp(LORE_LINK_RE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(body))) {
    if (m.index > last) {
      parts.push(<span key={key++}>{body.slice(last, m.index)}</span>);
    }
    const id = m[1].trim();
    const label = (m[2] || m[1]).trim();
    parts.push(
      <button
        key={key++}
        type="button"
        onClick={() => openLoreLink(id)}
        className="font-medium text-brass underline decoration-brass/60 underline-offset-2 transition hover:text-parchment hover:decoration-parchment"
      >
        {label}
      </button>,
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push(<span key={key++}>{body.slice(last)}</span>);

  return (
    <div className="whitespace-pre-wrap font-body text-sm leading-relaxed text-parchment/90">
      {parts}
    </div>
  );
}

export function LoreStack() {
  const loreStack = useAtlasStore((s) => s.loreStack);
  const loreById = useAtlasStore((s) => s.loreById);
  const closeTopLore = useAtlasStore((s) => s.closeTopLore);
  const closeAllLore = useAtlasStore((s) => s.closeAllLore);

  if (!loreStack.length) return null;

  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-start gap-3 p-4 md:left-[22rem]">
      {loreStack.map((item, idx) => {
        const node = loreById[item.nodeId];
        const isTop = idx === loreStack.length - 1;
        return (
          <article
            key={`${item.nodeId}-${idx}`}
            className={cn(
              "pointer-events-auto w-[min(22rem,calc(100vw-2rem))] rounded-sm border border-brass/30 bg-deep/95 shadow-lore backdrop-blur-md",
              !isTop && "opacity-70",
            )}
            style={{ marginTop: idx * 12 }}
          >
            <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
              {isTop && loreStack.length > 1 && (
                <button
                  type="button"
                  onClick={closeTopLore}
                  className="rounded p-1 text-mist hover:bg-white/5 hover:text-parchment"
                  title="Volver"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <h2 className="flex-1 font-display text-lg text-brass">
                {node?.title ?? "Desconocido"}
              </h2>
              <button
                type="button"
                onClick={isTop ? closeTopLore : closeAllLore}
                className="rounded p-1 text-mist hover:bg-white/5 hover:text-parchment"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="max-h-[50vh] overflow-y-auto px-3 py-3">
              {node ? (
                <RichBody body={node.body} />
              ) : (
                <p className="text-sm text-mist">No hay entrada para `{item.nodeId}`.</p>
              )}
            </div>
            {node?.tags?.length ? (
              <footer className="flex flex-wrap gap-1 border-t border-white/10 px-3 py-2">
                {node.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-sm bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-mist"
                  >
                    {t}
                  </span>
                ))}
              </footer>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
