# Valtherion

Atlas jugable + mesa de rol para el mundo **Valtherion**.  
Pantalla principal: mapa tipo Figma (pan/zoom). Lore tipo Baldur’s Gate. Reglas multi-sistema (D&D 2024 primero).

Ver visión completa: [`docs/VISION.md`](docs/VISION.md).

## Stack

- **Web** (`apps/web`): Next.js 14 · PixiJS · Zustand · Tailwind — puerto **3001**
- **API** (`apps/server`): Fastify · Socket.IO — puerto **4100**
- **DB**: Postgres 16 (Docker en puerto **5433**) + Prisma

## Setup

```bash
# Requisitos: Node 20+, pnpm, Docker
pnpm setup
# o paso a paso:
pnpm install
pnpm world:extract   # lee ../roldninja/maps/Valtherion.json
pnpm db:up
pnpm db:generate && pnpm db:push && pnpm db:seed
pnpm dev
```

- Web: http://localhost:3001  
- API: http://localhost:4100/health  

Usuarios seed: `dm` / `changeme`, `jugador1` / `changeme`

## Workspace

Proyecto **separado** de Roldninja (`../roldninja`). Comparte origen de datos del mapa y reglas, no el código de la mesa anterior.
