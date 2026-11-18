import * as THREE from "three";
import { pxToWorld } from "../plano/coords";
import type { PlanoMeta } from "../plano/types";

type PatioRec = { x: number; z: number; side: number; h: number; rot: number; t: number };

/**
 * Patios del original (patios.pak): discos bajos de tierra/patio.
 * Solo en color + ciudad levantada. Anclados al relieve para que no floten.
 */
export class PatiosMeshes {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private dummy = new THREE.Object3D();
  private recs: PatioRec[] = [];
  visibleLift = 0;
  private colorOn = 0;
  heightAt: ((x: number, z: number) => number) | null = null;
  private lastAmount = -1;

  constructor(_meta: PlanoMeta) {
    this.group.visible = false;
  }

  static async load(meta: PlanoMeta): Promise<PatiosMeshes | null> {
    const layer = new PatiosMeshes(meta);
    try {
      const res = await fetch("/datos/patios.pak");
      if (!res.ok) throw new Error(String(res.status));
      const gz = await res.arrayBuffer();
      const stream = new Response(gz).body!.pipeThrough(new DecompressionStream("gzip"));
      const raw = new Uint8Array(await new Response(stream).arrayBuffer());
      const n = new DataView(raw.buffer, raw.byteOffset, raw.byteLength).getUint32(0, true);
      const body = raw.subarray(4);
      const x = new Uint16Array(n);
      const y = new Uint16Array(n);
      for (let i = 0; i < n; i++) {
        x[i] = body[i]! | (body[n + i]! << 8);
        y[i] = body[2 * n + i]! | (body[3 * n + i]! << 8);
      }
      const radio = body.subarray(4 * n, 5 * n);
      const suerte = body.subarray(5 * n, 6 * n);

      const geo = new THREE.CylinderGeometry(1, 1, 1, 8);
      geo.translate(0, 0.5, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.96,
        metalness: 0,
        flatShading: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.renderOrder = -1;
      mesh.count = 0;
      layer.mesh = mesh;
      layer.group.add(mesh);

      const recs: PatioRec[] = [];
      for (let i = 0; i < n; i++) {
        const r = radio[i] ?? 4;
        if (r < 3) continue;
        const [wx, wz] = pxToWorld(meta, x[i]!, y[i]!);
        const side = Math.min(10, Math.max(1.6, r * 0.28));
        const h = 0.06;
        const t = (suerte[i] ?? 0) / 255;
        recs.push({
          x: wx,
          z: wz,
          side,
          h,
          rot: ((suerte[i] ?? 0) / 255) * Math.PI,
          t,
        });
      }
      layer.recs = recs;
      layer.applyMatrices(true);
      return layer;
    } catch (e) {
      console.warn("patios.pak no cargó", e);
      return null;
    }
  }

  private applyMatrices(forceColors = false) {
    const mesh = this.mesh;
    if (!mesh) return;
    const dummy = this.dummy;
    for (let i = 0; i < this.recs.length; i++) {
      const r = this.recs[i]!;
      const ground = this.heightAt ? this.heightAt(r.x, r.z) : 0;
      dummy.position.set(r.x, ground, r.z);
      dummy.scale.set(r.side, r.h, r.side);
      dummy.rotation.set(0, r.rot, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (forceColors) {
        mesh.setColorAt(i, new THREE.Color(0.52 + r.t * 0.08, 0.44 + r.t * 0.06, 0.3));
      }
    }
    mesh.count = this.recs.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (forceColors && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  setColorMode(c: number) {
    this.colorOn = c;
    this.syncVisible();
  }

  setLift(lift: number) {
    this.visibleLift = lift;
    // re-anclar cuando cambia el relieve
    const key = this.heightAt ? lift : 0;
    if (Math.abs(key - this.lastAmount) > 0.002) {
      this.lastAmount = key;
      this.applyMatrices();
    }
    this.syncVisible();
  }

  private syncVisible() {
    this.group.visible = this.visibleLift > 0.05 && this.colorOn > 0.35;
  }

  dispose() {
    this.mesh?.geometry.dispose();
    (this.mesh?.material as THREE.Material | undefined)?.dispose();
    this.group.clear();
  }
}
