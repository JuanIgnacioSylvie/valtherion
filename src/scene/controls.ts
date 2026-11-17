import type * as THREE from "three";
import { MesaControls } from "./MesaControls";

/** Controles de mapa: mesa (rueda al cursor, pan, órbita), como el original. */
export function createMapControls(
  camera: THREE.PerspectiveCamera,
  dom: HTMLElement,
  opts?: { bounds?: [number, number, number, number]; far?: number },
): MesaControls {
  return new MesaControls(camera, dom, opts);
}

export type { MesaControls };
export type MapControls = MesaControls;
