import type { CompendiumEntry } from "@valtherion/contracts";

/** Núcleo abierto / resumen de referencia (D&D 2024 style). Extender con SRD y contenido propio. */
export const COMPENDIUM: CompendiumEntry[] = [
  {
    id: "core-ability-checks",
    category: "checks",
    title: "Pruebas de característica",
    summary: "d20 + modificador (+ competencia si aplica) vs CD.",
    body: `Tirá un **d20**, sumá el modificador de la característica y, si sos competente, el **bono de competencia**.

El DM fija una **CD**. Con ventaja tirás 2d20 y usás el mayor; con desventaja, el menor.

Enlaces: [[core-advantage|Ventaja y desventaja]], [[core-proficiency|Competencia]].`,
    tags: ["core"],
  },
  {
    id: "core-advantage",
    category: "checks",
    title: "Ventaja y desventaja",
    summary: "Dos d20; mayor o menor.",
    body: `**Ventaja:** tirás dos d20 y te quedás con el más alto.
**Desventaja:** tirás dos d20 y te quedás con el más bajo.
Si tenés ambos a la vez, se cancelan.`,
    tags: ["core"],
  },
  {
    id: "core-proficiency",
    category: "checks",
    title: "Bono de competencia",
    summary: "Escala con el nivel del personaje.",
    body: `El bono de competencia se suma a ataques, pruebas y salvaciones en las que seas competente.

Referencia típica 2024: nivel 1–4 → +2; 5–8 → +3; 9–12 → +4; 13–16 → +5; 17–20 → +6.`,
    tags: ["core"],
  },
  {
    id: "core-combat-actions",
    category: "combat",
    title: "Acciones en combate",
    summary: "Acción, acción adicional, reacción, movimiento.",
    body: `En tu turno podés: **moverte**, usar una **acción**, y a veces una **acción adicional**. Fuera de tu turno podés usar una **reacción**.

Ataques, Dash, Desengancharse, Esquivar, Ayudar, Esconderse, Preparar, Buscar, Usar objeto son acciones comunes.

Ver [[core-initiative|Iniciativa]].`,
    tags: ["combat"],
  },
  {
    id: "core-initiative",
    category: "combat",
    title: "Iniciativa",
    summary: "d20 + Desteridad.",
    body: `Al empezar el combate, cada combatiente tira **d20 + modificador de Destreza**. El orden de turnos va de mayor a menor.`,
    tags: ["combat"],
  },
  {
    id: "core-conditions",
    category: "conditions",
    title: "Condiciones (resumen)",
    summary: "Estados que modifican lo que podés hacer.",
    body: `Condiciones frecuentes: **Incapacitado**, **Derribado**, **Asustado**, **Envenenado**, **Restringido**, **Cegado**, **Ensordecido**, **Invisible**, **Paralizado**, **Petrificado**, **Aturdido**, **Inconsciente**.

El detalle completo vive en el pack de reglas ampliado / SRD.`,
    tags: ["conditions"],
  },
  {
    id: "core-rest",
    category: "misc",
    title: "Descansos",
    summary: "Corto y largo.",
    body: `**Descanso corto:** al menos 1 hora. Podés gastar Dados de Golpe.
**Descanso largo:** al menos 8 horas. Recuperás PG, Dados de Golpe (mitad), y recursos diarios.`,
    tags: ["core"],
  },
];
