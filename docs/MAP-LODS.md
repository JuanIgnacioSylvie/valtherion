# Mapa multi-nivel (visión tipo Project Zomboid)

## El problema

Una sola imagen (aunque sea 4K/8K) **siempre** pixeliza si zoomeás lo suficiente como para ver techos de casas.  
[Project Zomboid Map](https://projectzomboidmap.com/) no estira un JPG: cambia de **capa de detalle** (tiles + pisos).

## Arquitectura Valtherion

El atlas es un **lienzo continuo en coords del mundo**, pero el contenido visible cambia por **LOD (level of detail)**:

| LOD | Zoom relativo* | Qué se ve | Assets |
|-----|----------------|-----------|--------|
| 0 Mundi | 1× (encuadre completo) | biomas, costas, montañas | 1 mapa mundi HD / tiles mundi |
| 1 Región | ~2–6× | bosques/ríos nítidos, siluetas de asentamientos | tiles regionales o overlays |
| 2 Asentamiento | ~8–25× | ciudad/pueblo con techos definidos | mapa de ciudad anclado a bbox (refs Sondawoode/Brindol) |
| 3 Calle / táctico | ~30–80× | calles, edificios, grilla | battle map / district tiles |
| 4 Interior | “entrar” + piso | planta del edificio, techos off | floor plans por nivel (Z0, Z1…) |

\*Zoom relativo `1` = mundi entero en pantalla (no se puede salir más afuera).

## Cómo se implementa (fases)

1. [x] Mundi raster + pins; zoom mínimo = fit mundi.
2. [x] **Demo escenas ancladas:** `Cenizabrava` — zoom nativo (llena viewport); tope anti-pixel.
2b. [x] **Geografía lore Valtherion** (tripartito); Zytzayna descartado.
3. [ ] **Tiles mundi:** cortar el mundi en pirámide (512px) para pan suave a LOD0–1.
4. [ ] Más ciudades ancladas + fade según viewport.
5. [ ] **Pisos:** `Building { floors: [{z, image, roofImage}] }` + UI “quitar techos” / subir-bajar nivel (como Zomboid: Shift+scroll).
6. [ ] **Autoría:** editor DM coloca escenas/edificios sobre el mundi.

### Probar la demo

1. Abrí el atlas.
2. En **Capas → Escenas HD**, clic en **Cenizabrava** (o zoomeá el oeste del mapa ≥450%).
3. Debería aparecer el badge `LOD ciudad: scene-cenizabrava` y el mapa de techos.

## Qué NO hacer

- Una imagen de 100000×50000 del planeta entero (impensable de generar, servir y pintar).
- Estirar el JPG actual a zoom 50× esperando ver casas.

## Relación con el arte

- Refs de **atlas** → LOD 0–1  
- Refs de **ciudad/pueblo** → LOD 2  
- Refs de **battle map / interior** → LOD 3–4  

El mundi vacío de biomas es solo LOD 0.

## Análisis de Project Zomboid Map (verificado por red, nov 2026)

Inspeccionado `projectzomboidmap.com` con el navegador:

- Formato **Deep Zoom Image (DZI)**: `https://tiles.projectzomboidmap.com/maps/<build>/base/layer0.dzi` + `layer0_files/{nivel}/{x}_{y}.jpg`.
- **Tile 1024×1024 px**, JPG, sin overlap. Niveles 10–18+ visibles al navegar.
- Imagen completa: **2.314.368 × 1.019.040 px (~2,36 gigapíxeles)**.
- Pie de página: *"Rendered with pzmap2d"* → los tiles se **renderizan desde los datos del juego** (tiles de terreno/edificios reales a escala nativa), por piso (`layer0`, `layer1`, …). No es una foto estirada.
- Viewer propio (bundle `index-*.js`, 5 canvas), deep links `#XxYxZoom`, pisos con `,`/`.` o Shift+scroll.

**Conclusión:** el zoom profundo viene de tener **datos + renderer**, no de una imagen. Una ilustración IA (~1–2 MP) jamás da ese detalle.

## Cómo lo aplicamos en Valtherion

| Capa | Técnica | Estado |
|------|---------|--------|
| Mundi (LOD 0–2) | **Renderer procedural en GPU** (`apps/web/src/lib/terrain`): por cada pixel de pantalla evalúa el mundo (continentes del lore + ruido fractal con LOD por tamaño de píxel, hillshade, árboles y montañas como estampas). Resolución infinita, 0 bytes de tiles. Zoom hasta 4800%. | ✅ |
| Ciudades (LOD 3) | Renderer **desde datos** (edificios, calles, techos) — mismo principio que pzmap2d; o pirámide DZI horneada por ciudad | ⏳ siguiente |
| Interiores / pisos | Datos `Building.floors[]` + render por piso, techos on/off | ⏳ |
| Escenas-imagen (Cenizabrava) | Solo como placeholder; tope de zoom a su resolución nativa | demo |

Geografía (coordenadas en unidades de mundo 1920×911) vive en `terrainShader.ts` (constantes `C_*`/`R_*`) y debe coincidir con `scripts/rebuild-valtherion-geo-seed.mjs` (`GEO`).