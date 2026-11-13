# Valtherion — Visión del producto

> Documento vivo. Cualquier sesión de Cursor puede retomar desde aquí.

## Qué es

Web app de **rol de mesa centrada en un mundo propio** (Valtherion). La pantalla principal es un **atlas navegable tipo Figma** (pan/zoom infinito). No es un fork de Roldninja: es un producto hermano que reutiliza datos (mapa Azgaar, reglas D&D 2024) con UX distinta.

Analogías: Roll20 (mesa) + Baldur’s Gate (lore boxes) + Figma (canvas) + Azgaar (geografía).

## Pilares

1. **Atlas-first** — el mapa mundi es el home; zoom revela capas de pins.
2. **Lore encadenado** — boxes con `[[links]]` que abren otras boxes (estilo BG).
3. **Multi-sistema** — `RulePack` pluggable; primero `dnd-2024`.
4. **Mesa sobre el mundo** — grilla/tokens solo a partir de cierto zoom / escenas tácticas.
5. **Autoría DM** — editar pins, lore, capas, spoilers por rol.

## UX del mapa

| Zoom | Contenido | Pins | Grilla |
|------|-----------|------|--------|
| 0–0.4 | Mundi | reinos, océanos, continentes | no |
| 0.4–1.0 | Región | provincias, capitales | no |
| 1.0–3.0 | Local | burgs, POIs | opcional |
| escena táctica | combate | tokens | sí |

Layout: canvas full-bleed + rail lateral (capas / sesión / reglas / journal).

## Stack

- Monorepo pnpm + Turborepo
- `apps/web` — Next.js 14, Tailwind, PixiJS, Zustand
- `apps/server` — Fastify, Socket.IO, Zod
- `packages/db` — PostgreSQL + Prisma
- `packages/rules-dnd2024` — pack de reglas (extensible)
- `content/worlds/valtherion` — seed del mundo

Puerto DB Docker: **5433** (para no chocar con Roldninja en 5432).  
API: **4100**. Web: **3001**.

## Modelo

- `World` → pins, lore graph, capas
- `Pin` → coords, `minZoom`/`maxZoom`, `loreNodeId`, visibilidad
- `LoreNode` → markdown con `[[id|label]]`, tags, `dmOnly`
- `Campaign` → `rulePackId`, miembros, escenas
- `Scene` → tablero táctico anclado a un pin/zoom
- `SessionState` — cámara sync, combate, fog (fase 2)

## Fases

### MVP (actual scaffold)
- [x] Repo separado + visión (`c:\Users\juans\Projects\valtherion`)
- [x] Seed Valtherion (pins/lore/SVG) desde Roldninja — 50 pins / 69 lore nodes
- [x] Atlas pan/zoom + pins por zoom + lore boxes (`[[links]]`)
- [x] API Fastify (:4100) + Prisma/Postgres (:5433) + seed DB
- [x] Pack reglas D&D 2024 (esqueleto + compendium mínimo + rolls)
- [x] Fallback: si la DB está caida, `/worlds/:id` lee `content/.../seed.json`
- [ ] Mapa artístico HD (export Azgaar / tiles)
- [ ] Auth real + partidas multiplayer
- [ ] Editor DM de pins/lore
- [ ] Escena táctica con tokens sobre el atlas

### v1 — Mesa
- Tokens, iniciativa, dados, chat realtime
- Hoja básica D&D 2024
- Toggle grilla en zoom táctico
- Sync de cámara opcional (seguir al DM)

### v2 — Mundo profundo
- Editor DM de pins/lore
- Fog of war
- Capas (político / magia / travel)
- Journal de campaña
- Segundo rule pack

### v3 — Paridad Roll20 + mundo
- Escenas ligadas al atlas (“entrar al lugar”)
- Handouts, permisos finos, assets
- Mobile spectator

## Origen Roldninja

Extraído / referenciado:

- `maps/Valtherion.json` → `content/worlds/valtherion/seed.json` + `map.svg`
- Ideas de dominio (dados, iniciativa, hoja)
- Estructura de compendium D&D (adaptada; respetar SRD/OGL)

No se copia el AppShell de widgets ni el VTT Konva como shell principal.

## Continuidad entre sesiones

1. Abrir este repo (`valtherion`).
2. Leer este archivo + `README.md`.
3. Continuar el chat “Valtherion atlas / mesa” en el historial de Cursor, o empezar uno nuevo citando `docs/VISION.md`.
