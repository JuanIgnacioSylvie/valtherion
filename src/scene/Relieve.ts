import * as THREE from "three";
import { hojaSizeMeters, pxToWorld } from "../plano/coords";
import type { PlanoMeta } from "../plano/types";

/**
 * Terreno desde relieve.bin del original:
 * Uint16[0]=W, [1]=H, luego W*H alturas en decímetros (/10 → metros).
 * Fallback a relieve.webp si el bin falta.
 */
export class RelieveMesh {
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshStandardMaterial;
  private heights: Float32Array | null = null;
  private gridW = 0;
  private gridH = 0;
  amount = 0;
  /**
   * Textura del shader (tRelieve): alturas en metros (como el original),
   * no normalizada. uRelieve es un factor 0..~2.
   */
  heightTex: THREE.Texture | null = null;
  /** Escala metros del relieve (max altura) — solo para el mesh de terreno. */
  maxH = 25;
  private meta: PlanoMeta;

  constructor(meta: PlanoMeta) {
    this.meta = meta;
    const { w, h } = hojaSizeMeters(meta);
    const [ox, oz] = pxToWorld(meta, meta.ancho / 2, meta.alto / 2);
    const geo = new THREE.PlaneGeometry(w, h, 160, 112);
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
      const res = await fetch("/datos/relieve.bin");
      if (!res.ok) throw new Error(String(res.status));
      const u16 = new Uint16Array(await res.arrayBuffer());
      const W = u16[0]!;
      const H = u16[1]!;
      const heights = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) heights[i] = u16[2 + i]! / 10;
      this.heights = heights;
      this.gridW = W;
      this.gridH = H;

      let maxH = 1;
      for (let i = 0; i < heights.length; i++) if (heights[i]! > maxH) maxH = heights[i]!;

      // Mesh de terreno: mapa normalizado 0..1 × displacementScale
      const norm = new Float32Array(W * H);
      for (let i = 0; i < heights.length; i++) norm[i] = heights[i]! / maxH;
      const dispTex = new THREE.DataTexture(norm, W, H, THREE.RedFormat, THREE.FloatType);
      dispTex.magFilter = dispTex.minFilter = THREE.LinearFilter;
      dispTex.wrapS = dispTex.wrapT = THREE.ClampToEdgeWrapping;
      dispTex.needsUpdate = true;
      dispTex.colorSpace = THREE.NoColorSpace;

      // Shader ciudad: metros crudos (como ad() del original)
      const meters = new Float32Array(heights);
      const shaderTex = new THREE.DataTexture(meters, W, H, THREE.RedFormat, THREE.FloatType);
      shaderTex.magFilter = shaderTex.minFilter = THREE.LinearFilter;
      shaderTex.wrapS = shaderTex.wrapT = THREE.ClampToEdgeWrapping;
      shaderTex.needsUpdate = true;
      shaderTex.colorSpace = THREE.NoColorSpace;

      this.mat.displacementMap = dispTex;
      this.mat.displacementBias = 0;
      this.mat.userData.maxH = maxH;
      this.heightTex = shaderTex;
      this.maxH = maxH;
      this.mat.needsUpdate = true;
      return;
    } catch {
      /* fallback webp */
    }
    try {
      const tex = await new Promise<THREE.Texture>((res, rej) =>
        new THREE.TextureLoader().load("/plano/relieve.webp", res, undefined, rej),
      );
      tex.colorSpace = THREE.NoColorSpace;
      this.mat.displacementMap = tex;
      this.mat.userData.maxH = 45;
      this.heightTex = tex;
      this.maxH = 45;
      this.mat.needsUpdate = true;
    } catch {
      /* */
    }
  }

  /** Altura en metros mundo (x,z) para colisión / caminar. */
  heightAt(worldX: number, worldZ: number): number {
    if (!this.heights || !this.gridW) return 0;
    const metro = this.meta.metro;
    const [px0, py0] = this.meta.plaza;
    const px = worldX / metro + px0;
    const py = worldZ / metro + py0;
    const u = (px / this.meta.ancho) * this.gridW - 0.5;
    const v = (py / this.meta.alto) * this.gridH - 0.5;
    const x0 = Math.min(this.gridW - 2, Math.max(0, Math.floor(u)));
    const y0 = Math.min(this.gridH - 2, Math.max(0, Math.floor(v)));
    const tx = Math.min(1, Math.max(0, u - x0));
    const ty = Math.min(1, Math.max(0, v - y0));
    const h = this.heights;
    const i = y0 * this.gridW + x0;
    return (
      h[i]! * (1 - tx) * (1 - ty) +
      h[i + 1]! * tx * (1 - ty) +
      h[i + this.gridW]! * (1 - tx) * ty +
      h[i + this.gridW + 1]! * tx * ty
    );
  }

  setAmount(a: number) {
    this.amount = a;
    const maxH = (this.mat.userData.maxH as number) || 25;
    this.mat.displacementScale = a * maxH;
    this.mat.opacity = a * 0.35;
    this.mesh.visible = a > 0.02;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.displacementMap?.dispose();
    this.mat.dispose();
  }
}
