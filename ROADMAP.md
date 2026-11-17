# Baires Garden — roadmap

Réplica de [baires.mormon.garden](https://baires.mormon.garden/) sobre el **Glade real** (Gallica).

## Foco

**Estructuras y assets sobre el mapa** (no el timeline histórico).

## Qué hay hoy

| Pieza | Estado |
|-------|--------|
| Plano Glade 1867 | 18919×13272 + LOD + teselas |
| Ciudad 3D | **ciudad.pak** (~52k techos · ~145k muros · ~36k árboles) |
| Overlays color | suelo/calles 2k + crece/despeje del original |
| Hitos | 157 marcas con épocas + meshes Cabildo/Catedral/Rosada/… |
| Overlay Hoy | OSM Overpass |
| Georref / buscador | Afín N→derecha + USIG |

```bash
pnpm datos:import-orig   # trae ciudad.pak / overlays / marcas del original
pnpm bootstrap           # from-raw + tile + extract + hoy:osm
pnpm dev
```

## Siguiente (assets)

1. Tipologías (colonial/italiana/…) y detalles de fachada del original.
2. crece.pak por época (muros/techos que nacen con el timeline).
3. Fotos / fichas en hitos; colisión al caminar.
