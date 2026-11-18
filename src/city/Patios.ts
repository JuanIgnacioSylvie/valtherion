import * as THREE from "three";
import { pxToWorld } from "../plano/coords";
import type { PlanoMeta } from "../plano/types";

/**
 * Patios del original (patios.pak): aljibes / manchas de patio.
 * Solo se ven en color (como el original: dist negativa → alzado con uColor).
 * En tinta no se dibujan — el “pasto” malo eran estos cubos verdes.
 */
export class PatiosMeshes {
  readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private dummy = new THREE.Object3D();
  visibleLift = 0;
  private colorOn = 0;

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

      const dummy = layer.dummy;
      let shown = 0;
      for (let i = 0; i < n; i++) {
        const r = radio[i] ?? 4;
        if (r < 3) continue;
        const [wx, wz] = pxToWorld(meta, x[i]!, y[i]!);
        // discos chatos de tierra/patio (no “césped” alto)
        const side = Math.min(10, Math.max(1.6, r * 0.28));
        const h = 0.08;
        dummy.position.set(wx, h * 0.5 + 0.02, wz);
        dummy.scale.set(side, h, side);
        dummy.rotation.set(0, ((suerte[i] ?? 0) / 255) * Math.PI, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(shown, dummy.matrix);
        const t = (suerte[i] ?? 0) / 255;
        // tierra / patio seco
        mesh.setColorAt(shown, new THREE.Color(0.52 + t * 0.08, 0.44 + t * 0.06, 0.3));
        shown++;
      }
      mesh.count = shown;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      return layer;
    } catch (e) {
      console.warn("patios.pak no cargó", e);
      return null;
    }
  }

  setColorMode(c: number) {
    this.colorOn = c;
    this.syncVisible();
  }

  setLift(lift: number) {
    this.visibleLift = lift;
    this.syncVisible();
  }

  private syncVisible() {
    // solo con ciudad levantada + color (como el original)
    this.group.visible = this.visibleLift > 0.05 && this.colorOn > 0.35;
  }

  dispose() {
    this.mesh?.geometry.dispose();
    (this.mesh?.material as THREE.Material | undefined)?.dispose();
    this.group.clear();
  }
}
