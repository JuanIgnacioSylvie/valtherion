# Baires Garden

Réplica de la arquitectura de [baires.mormon.garden](https://baires.mormon.garden/) sobre el **plano real de Carlos Glade (1867)** (Gallica BnF, 18919×13272).

## Stack

Vite · TypeScript · Three.js · Sharp (tooling)

## Setup

```bash
pnpm install
pnpm plano:from-raw   # requiere public/plano/_raw.jpg (escaneo Gallica)
pnpm plano:tile
pnpm datos:extract    # techos/árboles desde la tinta del Glade
pnpm hoy:osm          # georref + overlay OSM (calles/vías/costa)
pnpm epocas:bake      # Latzina 1888 + Ludwig 1900 → crece/despeje
pnpm dev
```

Abrí http://localhost:5173

Fuente del plano: [Gallica ark:/12148/btv1b53098699s](https://gallica.bnf.fr/ark:/12148/btv1b53098699s) (IIIF full). Si `pnpm plano:fetch` falla por Cloudflare, bajá el JPEG a mano a `_raw.jpg`. Overlay “Hoy”: © OpenStreetMap.

Alternativa procedural: `pnpm bootstrap` (ciudad sintética).

Ver [ROADMAP.md](ROADMAP.md).

## Controles (Fase 1)

- Arrastrar: pan
- Rueda: zoom
- Botón derecho: órbita / inclinación
- Space: plano ⇄ ciudad (stub hasta Fase 2)
