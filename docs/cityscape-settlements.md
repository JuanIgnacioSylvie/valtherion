# Ciudades Valtherion — guía Cityscape / Entornos Urbanos

Fuente: **D&D 3.5 Cityscape** (ed. castellana *Entornos Urbanos*, Ari Marmell & C.A. Suleiman; Devir). Complementa **DMG 3.5 Tabla 5-2**.

## Tamaños de asentamiento (adultos)

| Tier | Español | Población | GP limit | Distritos ~ |
|------|---------|-----------|----------|-------------|
| Thorp | Aldea mínima | 20–80 | 40 | — |
| Hamlet | Aldea | 81–400 | 100 | — |
| Village | Pueblo | 401–900 | 200 | — |
| Small town | Villa pequeña | 901–2.000 | 800 | — |
| Large town | Villa grande | 2.001–5.000 | 3.000 | — |
| Small city | Ciudad pequeña | 5.001–12.000 | 15.000 | ~20 |
| **Large city** | **Ciudad grande** | **12.001–25.000** | **40.000** | **~40** |
| Metropolis | Metrópoli | 25.001+ | 100.000 | ~80 |

Aurion es **ciudad grande** humana amurallada (~18.400 adultos, LN, ~82% humano).

## Qué define una ciudad (Cityscape cap. 1)

1. **Población** (tabla DMG; se puede escalar el mundo entero ×k).
2. **Distritos** con función propia (cívico, templo, mercado, residencial, muelle…).
3. **Fortificaciones** (muralla, puertas, guarnición).
4. **Gobierno / alineamiento** y poder (nobleza, gremios, culto, monstruoso…).
5. **Rasgo dominante**: capital, puerto, militar, comercial, etc.

### Tipos de muestra del libro (para futuras ciudades)

| Ciudad | Tipo | Tier | Notas de diseño |
|--------|------|------|-----------------|
| Blackwall | Militar | Large city | Calles rectas, guarnición, defensa |
| Four Winds | Hub comercial | Large city | Muralla 20×10 ft, muchas puertas |
| Dragonport | Puerto | Large city | Wharf, almacenes, crimen en callejones |
| Sutulak | Esclavista | Small city | Muralla atípica, NE |
| Kaddastrei | Capital | Metropolis-ish | Muralla en capas, distrito embajadas |
| Cliffside | Evolucionada | Small city | Terreno forzado |

Aurion mezcla **capital** (alcázar + catedral + plaza) y **puerto** (Dragonport: dársena, warehouse, fishers' wharf).

## Murallas (Defensive Fortifications)

- Ciudad grande típica: **una cortina** ~6–7 m alto × ~3 m ancho (Four Winds: 20 ft × 10 ft).
- Capitales grandes: anillos / foso (Kaddastrei).
- El puerto **abre** la cortina al sur (no cerrar el óvalo sobre el agua).
- Puertas en avenidas principales (N / E / W).

## Distritos a representar en maqueta

Prioridad visual para Aurion y futuras:

1. Civic / Plaza  
2. Lord's Keep (alcázar)  
3. Temple  
4. Marketplace  
5. Average + Wealthy residential  
6. Garrison / gates  
7. Warehouse  
8. Fisher's Wharf / Waterfront  
9. Guildhall / Inn (opcional en 3D)  

Un distrito = barrio o complejo (~300–600 personas de media). No hace falta modelar los ~40: basta anclar los clave.

## Escala física de la maqueta

| Tier | Diámetro muralla (orientativo) | Lienzo |
|------|--------------------------------|--------|
| Small city | ~0.8–1.1 km | ~1.5 km |
| **Large city** | **~1.2–1.5 km** | **~2.0–2.3 km** |
| Metropolis | 2 km+ | 3 km+ |

Aurion: muro Ø **1.35 km**, hoja **4096×3072** px (~2.2×1.7 km).

## Calles (Cityscape)

- Callejón 1.5–3 m · Calle 4.5–6 m · Avenida ~7.5 m  
- Adoquín en cívico / mercado; tierra o adoquín roto en arrabales.

## Checklist al crear una ciudad nueva

1. Elegir **tier** + población + GP limit + alineamiento.  
2. Elegir **tipo** (militar / puerto / capital / comercio…).  
3. Listar 6–12 **distritos** visibles.  
4. Definir **muralla** (sí/no, alto, huecos de puertas/puerto).  
5. Fijar **metro** y diámetro de casco antes de generar manzanas.  
6. Anclar hitos en `hoy.json` (`kind`: plaza, alcazar, catedral, puerto…).  
7. Regenerar con `pnpm city:generate`.

## Archivos del repo

- `tools/lib/city-model.ts` — geometría + `settlement`  
- `public/datos/city-meta.json` / `ciudad.json` — metadatos runtime  
- `src/city/pu/PuBuilders.ts` — plaza, muralla, puerto  
- Este doc — contrato de diseño para agentes y humanos
