# Valtherion — Art direction

## Decisiones

- **Geografía base:** lore del **mundo tripartito** (NO Zytzayna).
  - Oeste: continente **Korthaven** (caos)
  - Sur: continente **Aurion** (ruinas)
  - Este: continente **Lexmara** (orden)
  - Centro: **Mar Interior** con triángulo equilátero de islas **Nimrael** (N), **Drakonys** (SO), **Selvareth** (SE)
- **Fase mundi:** vacío de política — biomas/geografía; pins de lugares encima.
- **Estilo:** cartografía fantasy tipo D&D / Inkarnate.

## Escalas / LOD

| LOD | Asset | Notas |
|-----|-------|-------|
| Mundi | `map-master.jpg` (DZI tiles) | paint + parches HD; zoom hasta 1:1 del master |
| Ciudad | parche Cenizabrava en master | mismos tiles; overlay vector opcional |
| Interior | TBD | pisos |

## Fuentes

- Estilo: `content/art-refs/dnd-style/*`
- Generados: `content/art-refs/generated/` (`*-hd.jpg`, world v5)
- Bake: `pnpm map:build` → `map-master.jpg` + `tiles/`
- Geo base: `map-dnd-v4.jpg` (alineado al seed)

## Descartado

- Silueta / refs de **Zytzayna** (confusión). No usar como base geográfica.
