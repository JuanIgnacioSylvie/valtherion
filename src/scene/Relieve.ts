import * as THREE from "three";
import { hojaSizeMeters, pxToWorld } from "../plano/coords";
import type { PlanoMeta } from "../plano/types";

/** Terreno con displacement suave desde relieve.webp */
export class RelieveMesh {
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshStandardMaterial;
  amount = 0;

  constructor(meta: PlanoMeta) {
    const { w, h } = hojaSizeMeters(meta);
    const [ox, oz] = pxToWorld(meta, meta.ancho / 2, meta.alto / 2);
    const geo = new THREE.PlaneGeometry(w, h, 128, 90);
    geo.rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshStandardMaterial({
      color: "#cbb892",
      roughness: 1,
      displacementScale: 0,
      transparent: true,
      opacity: 0,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.set(ox, -0.5, oz);
    this.mesh.visible = false;
  }

  async load() {
    try {
      const tex = await new Promise<THREE.Texture>((res, rej) =>
        new THREE.TextureLoader().load("/plano/relieve.webp", res, undefined, rej),
      );
      tex.colorSpace = THREE.NoColorSpace;
      this.mat.displacementMap = tex;
      this.mat.needsUpdate = true;
    } catch {
      /* */
    }
  }

  setAmount(a: number) {
    this.amount = a;
    this.mat.displacementScale = a * 45;
    this.mat.opacity = a * 0.35;
    this.mesh.visible = a > 0.02;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.displacementMap?.dispose();
    this.mat.dispose();
  }
}
