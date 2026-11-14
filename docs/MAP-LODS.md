# Mapa (modelo Project Zomboid / DZI)

## Una sola regla

Una fuente → bake → pirámide `{z}/{x}_{y}` → el viewer solo carga tiles.

```bash
pnpm map:build   # compose master HD + tiles:build
```

| | |
|--|--|
| Master | `map-master.jpg` (~15k×7k) = paint + parches HD |
| Parches | Korthaven ashlands, Selvareth, Cenizabrava (refs D&D) |
| Tiles | DZI 512 WebP, niveles 0…maxLevel |
| Zoom mundi | hasta `nativeZoom` (1 px ≈ 1 px del master) |

## Arte

Generado desde `content/art-refs/dnd-style/*` → `content/art-refs/generated/*` → compose.

| Asset | Rol |
|-------|-----|
| `map-dnd-v4.jpg` | Base geográfica (pins/GEO) |
| `*-hd.jpg` | Detalle regional / ciudad |
| `map-master.jpg` | Fuente única del bake |

## Ciudades

Cenizabrava está **en el master** (mismo DZI). El overlay vectorial sigue para interacción; no es un segundo mundi.
