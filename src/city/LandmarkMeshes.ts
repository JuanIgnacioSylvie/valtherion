import * as THREE from "three";
import { pxToWorld } from "../plano/coords";
import type { PlanoMeta } from "../plano/types";

type HitoJson = {
  nombre: string;
  x: number;
  y: number;
  kind?: string;
  desde?: number;
  hasta?: number;
};

type LandmarkMat = THREE.MeshStandardMaterial & { userData: { baseHex: number } };

/**
 * Volúmenes distintivos de hitos (assets simples, leíbles a escala de ciudad).
 */
export class LandmarkMeshes {
  readonly group = new THREE.Group();
  private mats: LandmarkMat[] = [];

  static async load(meta: PlanoMeta, colorMode = 0): Promise<LandmarkMeshes | null> {
    try {
      const list = (await fetch("/datos/hoy.json").then((r) => r.json())) as HitoJson[];
      return new LandmarkMeshes(meta, list, colorMode);
    } catch {
      return null;
    }
  }

  constructor(meta: PlanoMeta, hitos: HitoJson[], colorMode: number) {
    const used = new Set<string>();
    // un mesh por kind; preferir la versión de 1867 (desde ausente o ≤1867)
    const sorted = [...hitos].sort(
      (a, b) => (a.desde ?? 1867) - (b.desde ?? 1867),
    );
    for (const h of sorted) {
      const kind = h.kind ?? guessKind(h.nombre);
      if (!kind || kind === "plaza" || kind === "puerto") continue;
      if (used.has(kind)) continue;
      used.add(kind);
      const [x, z] = pxToWorld(meta, h.x, h.y);
      const mesh = buildLandmark(kind);
      if (!mesh) continue;
      mesh.position.set(x, 0, z);
      mesh.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.material) this.mats.push(o.material as LandmarkMat);
        }
      });
      this.group.add(mesh);
    }
    this.setColorMode(colorMode);
    this.group.visible = false;
  }

  setLift(t: number) {
    this.group.visible = t > 0.05;
    this.group.scale.set(1, Math.max(0.05, t), 1);
  }

  setColorMode(c: number) {
    const ink = c < 0.5;
    for (const m of this.mats) {
      if (ink) {
        m.color.set(0x3a322a);
        m.roughness = 0.95;
      } else {
        m.color.set(m.userData.baseHex ?? 0xd4c4a8);
        m.roughness = 0.85;
      }
      m.needsUpdate = true;
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mat = o.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  }
}

function guessKind(nombre: string): string | null {
  const n = nombre.toLowerCase();
  if (n.includes("cabildo")) return "cabildo";
  if (n.includes("catedral")) return "catedral";
  if (n.includes("rosada") || n.includes("fuerte")) return "rosada";
  if (n.includes("obelisco")) return "obelisco";
  if (n.includes("congreso")) return "congreso";
  if (n.includes("colón") || n.includes("colon") || n.includes("teatro")) return "teatro";
  if (n.includes("recova")) return "recova";
  return null;
}

function mat(hex: number): LandmarkMat {
  const m = new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.88,
    metalness: 0.02,
    flatShading: true,
  }) as LandmarkMat;
  m.userData.baseHex = hex;
  return m;
}

function buildLandmark(kind: string): THREE.Group | null {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, y = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.y = y;
    g.add(mesh);
  };

  switch (kind) {
    case "cabildo":
      add(new THREE.BoxGeometry(28, 14, 18), mat(0xd4c4a8), 7);
      add(new THREE.BoxGeometry(10, 22, 10), mat(0xc8b89a), 18);
      add(new THREE.BoxGeometry(32, 2, 22), mat(0xb0a090), 14.5);
      break;
    case "catedral":
      add(new THREE.BoxGeometry(36, 16, 22), mat(0xe8e0d0), 8);
      add(new THREE.BoxGeometry(12, 36, 12), mat(0xddd5c5), 26);
      {
        const tri = new THREE.ConeGeometry(9, 14, 4);
        add(tri, mat(0xd0c8b8), 38);
      }
      break;
    case "rosada":
      add(new THREE.BoxGeometry(48, 18, 24), mat(0xd47878), 9);
      add(new THREE.BoxGeometry(16, 28, 16), mat(0xc86868), 20);
      add(new THREE.BoxGeometry(52, 2.5, 28), mat(0xb85858), 18.5);
      break;
    case "obelisco": {
      const shaft = new THREE.CylinderGeometry(2.2, 3.2, 68, 4);
      add(shaft, mat(0xece6dc), 34);
      add(new THREE.BoxGeometry(10, 2, 10), mat(0xd8d2c8), 1);
      break;
    }
    case "congreso":
      add(new THREE.BoxGeometry(55, 16, 35), mat(0xe5dcc8), 8);
      {
        const dome = new THREE.SphereGeometry(14, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
        add(dome, mat(0xc9a227), 22);
      }
      add(new THREE.CylinderGeometry(4, 4, 10, 8), mat(0xd4c4a0), 28);
      break;
    case "teatro":
      add(new THREE.BoxGeometry(40, 20, 30), mat(0xc4a882), 10);
      add(new THREE.BoxGeometry(44, 3, 34), mat(0xa88860), 21);
      add(new THREE.CylinderGeometry(6, 6, 18, 10), mat(0xb89870), 18);
      break;
    case "recova":
      add(new THREE.BoxGeometry(60, 8, 12), mat(0xd0c4b0), 4);
      for (let i = -2; i <= 2; i++) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 4), mat(0xc0b4a0));
        col.position.set(i * 12, 5, 0);
        g.add(col);
      }
      break;
    default:
      return null;
  }
  return g;
}
