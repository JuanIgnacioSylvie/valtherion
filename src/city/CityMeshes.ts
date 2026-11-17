import * as THREE from "three";
import { pxToWorld } from "../plano/coords";
import type { PlanoMeta } from "../plano/types";
import { makeFacadeTexture, makeRoofTileTexture } from "./facadeTexture";

export type CityStats = { techos: number; arboles: number; manzanas: number; muros?: number };

const _c = new THREE.Color();
const _c2 = new THREE.Color();

function hash01(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function wallColor(seed: number, colorMode: number, out: THREE.Color) {
  if (colorMode < 0.5) {
    const v = 0.62 + hash01(seed * 3.1) * 0.14;
    return out.setRGB(v * 1.02, v * 0.96, v * 0.88);
  }
  const t = hash01(seed * 5.7);
  if (t < 0.4) out.setRGB(0.93, 0.87, 0.74);
  else if (t < 0.7) out.setRGB(0.9, 0.78, 0.62);
  else if (t < 0.88) out.setRGB(0.82, 0.6, 0.46);
  else out.setRGB(0.8, 0.84, 0.76);
  out.offsetHSL(0, (hash01(seed + 1) - 0.5) * 0.05, (hash01(seed + 2) - 0.5) * 0.06);
  return out;
}

function roofColor(seed: number, colorMode: number, _pitched: boolean, out: THREE.Color) {
  if (colorMode < 0.5) {
    // tinta: azotea oscura del grabado
    const v = 0.32 + hash01(seed * 2.2) * 0.1;
    return out.setRGB(v * 1.05, v * 0.9, v * 0.78);
  }
  // baldosa colorada / cal, como el shader del original
  const t = hash01(seed * 9.1);
  if (t > 0.72) out.setRGB(0.74, 0.53, 0.42);
  else if (t > 0.35) out.setRGB(0.58, 0.33, 0.25);
  else out.setRGB(0.69, 0.67, 0.62); // cal
  out.offsetHSL((hash01(seed + 3) - 0.5) * 0.02, 0.03, (hash01(seed + 4) - 0.5) * 0.04);
  return out;
}

function trunkColor(seed: number, out: THREE.Color) {
  out.setRGB(0.35, 0.24, 0.16);
  out.offsetHSL(0, 0, (hash01(seed) - 0.5) * 0.1);
  return out;
}

function crownColor(seed: number, out: THREE.Color) {
  const t = hash01(seed * 4.4);
  if (t < 0.33) out.setRGB(0.28, 0.48, 0.2);
  else if (t < 0.66) out.setRGB(0.22, 0.4, 0.18);
  else out.setRGB(0.38, 0.52, 0.22);
  out.offsetHSL((hash01(seed + 8) - 0.5) * 0.05, 0.08, (hash01(seed + 9) - 0.5) * 0.1);
  return out;
}

function makePitchRoofGeo() {
  const geo = new THREE.BufferGeometry();
  const hw = 0.5;
  const hd = 0.5;
  const hh = 1;
  const verts = new Float32Array([
    -hw, 0, hd, hw, 0, hd, 0, hh, hd,
    hw, 0, -hd, -hw, 0, -hd, 0, hh, -hd,
    hw, 0, hd, hw, 0, -hd, 0, hh, -hd,
    hw, 0, hd, 0, hh, -hd, 0, hh, hd,
    -hw, 0, -hd, -hw, 0, hd, 0, hh, hd,
    -hw, 0, -hd, 0, hh, hd, 0, hh, -hd,
    -hw, 0, -hd, hw, 0, -hd, hw, 0, hd,
    -hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
  ]);
  geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  const uvs = new Float32Array((verts.length / 3) * 2);
  for (let i = 0; i < uvs.length; i += 6) {
    uvs[i] = 0;
    uvs[i + 1] = 0;
    uvs[i + 2] = 1;
    uvs[i + 3] = 0;
    uvs[i + 4] = 0.5;
    uvs[i + 5] = 1;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

function waveAt(front: number, dist: number, seed: number, lift: number) {
  const wave = THREE.MathUtils.clamp((front - dist - seed * 140) / 300, 0, 1);
  if (wave <= 0) return 0;
  return (1 + 2.2 * (wave - 1) ** 3 + 1.2 * (wave - 1) ** 2) * lift;
}

/**
 * Ciudad: muros (fachadas del pak) + techos + árboles.
 * muros.pak: Float32[px,py,len,height,y0,yaw,seed,et]
 * techos.pak: Float32[px,py,w,d,h,yaw,seed,et] — w/d en px plano, h en metros
 */
export class CityMeshes {
  readonly group = new THREE.Group();
  private roofsFlat: THREE.InstancedMesh;
  private roofsPitch: THREE.InstancedMesh;
  private cornices: THREE.InstancedMesh;
  private trunks: THREE.InstancedMesh;
  private crowns: THREE.InstancedMesh;
  private crowns2: THREE.InstancedMesh;
  private meta: PlanoMeta;
  private techos: Float32Array;
  /** 8 = [px,py,w,d,h,yaw,seed,et]; 7 = legacy sin yaw */
  private techoStride: 7 | 8;
  private muros: Float32Array;
  private arboles: Float32Array;
  private dummy = new THREE.Object3D();
  private roofMat: THREE.MeshStandardMaterial;
  private wallMat: THREE.MeshStandardMaterial;
  private corniceMat: THREE.MeshStandardMaterial;
  private trunkMat: THREE.MeshStandardMaterial;
  private crownMat: THREE.MeshStandardMaterial;
  private walls: THREE.InstancedMesh;
  private facadeTex: THREE.CanvasTexture;
  private roofTex: THREE.CanvasTexture;
  private lastKey = "";
  front = 0;
  epocaK = 0;
  colorMode = 0;
  visibleLift = 0;

  constructor(
    meta: PlanoMeta,
    techos: Float32Array,
    muros: Float32Array,
    arboles: Float32Array,
    _stats: CityStats,
  ) {
    this.meta = meta;
    this.techos = techos;
    this.muros = muros;
    this.arboles = arboles;
    // preferir stride 8 si el buffer cuadra; si no, legacy 7
    this.techoStride = techos.length % 8 === 0 ? 8 : 7;

    this.facadeTex = makeFacadeTexture();
    this.roofTex = makeRoofTileTexture();

    this.roofMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.roofTex,
      roughness: 0.86,
      metalness: 0.02,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.facadeTex,
      roughness: 0.92,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.corniceMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      flatShading: true,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    });
    this.trunkMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      flatShading: true,
    });
    this.crownMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      flatShading: true,
    });

    const nT = techos.length / this.techoStride;
    const nM = Math.max(1, muros.length / 8);
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);

    this.walls = new THREE.InstancedMesh(box, this.wallMat, nM);
    this.roofsFlat = new THREE.InstancedMesh(box, this.roofMat, nT);
    this.roofsPitch = new THREE.InstancedMesh(makePitchRoofGeo(), this.roofMat.clone(), nT);
    (this.roofsPitch.material as THREE.MeshStandardMaterial).map = this.roofTex;
    this.cornices = new THREE.InstancedMesh(box, this.corniceMat, nT);

    for (const m of [this.walls, this.roofsFlat, this.roofsPitch, this.cornices]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = false;
      m.receiveShadow = false;
      m.frustumCulled = false;
    }
    this.walls.count = nM;
    this.roofsFlat.count = nT;
    this.roofsPitch.count = nT;
    this.cornices.count = nT;

    const na = arboles.length / 4;
    this.trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.28, 0.42, 1, 6),
      this.trunkMat,
      na,
    );
    this.crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), this.crownMat, na);
    this.crowns2 = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.7, 0),
      this.crownMat.clone(),
      na,
    );
    for (const m of [this.trunks, this.crowns, this.crowns2]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = na;
      m.frustumCulled = false;
    }

    this.group.add(
      this.walls,
      this.cornices,
      this.roofsFlat,
      this.roofsPitch,
      this.trunks,
      this.crowns,
      this.crowns2,
    );
    this.group.visible = false;

    this.applyPalette();
    this.rebuild(1);
  }

  static async load(meta: PlanoMeta): Promise<CityMeshes | null> {
    try {
      const [ciudad, techosAb, arbAb] = await Promise.all([
        fetch("/datos/ciudad.json").then((r) => r.json()),
        fetch("/datos/techos.pak").then((r) => r.arrayBuffer()),
        fetch("/datos/arboles.pak").then((r) => r.arrayBuffer()),
      ]);
      let muros = new Float32Array(0);
      try {
        const mAb = await fetch("/datos/muros.pak").then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.arrayBuffer();
        });
        muros = new Float32Array(mAb);
      } catch {
        /* optional */
      }
      return new CityMeshes(
        meta,
        new Float32Array(techosAb),
        muros,
        new Float32Array(arbAb),
        {
          techos: ciudad.techos ?? 0,
          arboles: ciudad.arboles ?? 0,
          manzanas: ciudad.manzanas ?? 0,
          muros: ciudad.muros ?? muros.length / 8,
        },
      );
    } catch {
      return null;
    }
  }

  setColorMode(c: number) {
    this.colorMode = c;
    this.applyPalette();
    this.lastKey = "";
    this.rebuild(this.visibleLift || 0.001);
  }

  private applyPalette() {
    this.roofMat.color.set(0xffffff);
    (this.roofsPitch.material as THREE.MeshStandardMaterial).color.set(0xffffff);
    this.wallMat.color.set(0xffffff);
    this.corniceMat.color.set(0xffffff);
    this.trunkMat.color.set(0xffffff);
    this.crownMat.color.set(0xffffff);
    (this.crowns2.material as THREE.MeshStandardMaterial).color.set(0xffffff);
    const inkish = this.colorMode < 0.5;
    // azotea / muros lisos: el atlas de tejas se estira feo en lotes largos
    this.wallMat.map = null;
    this.corniceMat.map = null;
    this.roofMat.map = null;
    (this.roofsPitch.material as THREE.MeshStandardMaterial).map = null;
    this.wallMat.needsUpdate = true;
    this.corniceMat.needsUpdate = true;
    this.roofMat.needsUpdate = true;
    (this.roofsPitch.material as THREE.MeshStandardMaterial).needsUpdate = true;
    this.crownMat.emissive.set(inkish ? 0x000000 : 0x0a1206);
    this.crownMat.emissiveIntensity = inkish ? 0 : 0.08;
  }

  rebuild(lift: number) {
    const key = `${lift.toFixed(3)}|${this.front.toFixed(0)}|${this.epocaK.toFixed(2)}|${this.colorMode.toFixed(2)}`;
    if (key === this.lastKey && this.group.visible === lift > 0.01) return;
    this.lastKey = key;

    this.visibleLift = lift;
    this.group.visible = lift > 0.01;
    const metro = this.meta.metro;
    const colorOn = this.colorMode;

    this.rebuildRoofs(lift, metro, colorOn);
    this.rebuildMuros(lift, colorOn);
    this.walls.visible = this.muros.length >= 8;
    this.cornices.visible = true;
    this.rebuildTrees(lift, metro, colorOn);
  }

  private rebuildRoofs(lift: number, metro: number, colorOn: number) {
    const stride = this.techoStride;
    const n = this.techos.length / stride;

    for (let i = 0; i < n; i++) {
      const o = i * stride;
      const px = this.techos[o]!;
      const py = this.techos[o + 1]!;
      let w = this.techos[o + 2]! * metro;
      let d = this.techos[o + 3]! * metro;
      const hMax = this.techos[o + 4]!; // metros
      let yaw = 0;
      let seed: number;
      let et: number;
      if (stride === 8) {
        yaw = this.techos[o + 5]!;
        seed = this.techos[o + 6]!;
        et = this.techos[o + 7]!;
      } else {
        seed = this.techos[o + 5]!;
        et = this.techos[o + 6]!;
      }

      if (et > this.epocaK + 0.05) {
        this.hideRoof(i);
        continue;
      }
      if (!isFinite(w) || !isFinite(d) || w < 0.4 || d < 0.4 || hMax < 0.5) {
        this.hideRoof(i);
        continue;
      }
      // tope suave — no aplastar lotes largos del damero
      if (w > 55) w = 55;
      if (d > 55) d = 55;

      const [x, z] = pxToWorld(this.meta, px, py);
      const s = waveAt(this.front, Math.hypot(x, z), seed, lift);
      const h = hMax * s;
      if (h < 0.08) {
        this.hideRoof(i);
        continue;
      }

      // azotea baja (como el original): sin dos aguas sueltos
      const pitched = false;

      wallColor(seed, colorOn, _c);
      this.cornices.setColorAt(i, _c);
      roofColor(seed, colorOn, pitched, _c);
      this.roofsFlat.setColorAt(i, _c);
      this.roofsPitch.setColorAt(i, _c);

      // relleno inset + azotea fina al alto de los muros
      const inset = 0.4;
      const bw = Math.max(0.55, w - inset * 2);
      const bd = Math.max(0.55, d - inset * 2);
      const roofY = Math.max(0.5, h);
      const bodyH = Math.max(0.35, roofY - 0.05);
      this.dummy.position.set(x, 0, z);
      this.dummy.rotation.set(0, yaw, 0);
      this.dummy.scale.set(bw, bodyH, bd);
      this.dummy.updateMatrix();
      this.cornices.setMatrixAt(i, this.dummy.matrix);

      const rh = colorOn > 0.5 ? 0.28 : 0.18;
      this.dummy.position.set(x, roofY, z);
      this.dummy.rotation.set(0, yaw, 0);
      this.dummy.scale.set(w * 0.995, rh, d * 0.995);
      this.dummy.updateMatrix();
      this.roofsFlat.setMatrixAt(i, this.dummy.matrix);
      this.hideMesh(this.roofsPitch, i);
    }

    for (const m of [this.roofsFlat, this.roofsPitch, this.cornices]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  private rebuildMuros(lift: number, colorOn: number) {
    const n = this.muros.length / 8;
    if (n < 1) return;
    // thick en X local; largo en Z — yaw alinea Z con el muro
    const thick = colorOn > 0.5 ? 0.55 : 0.48;

    for (let i = 0; i < n; i++) {
      const o = i * 8;
      const px = this.muros[o]!;
      const py = this.muros[o + 1]!;
      const len = this.muros[o + 2]!;
      const height = this.muros[o + 3]!;
      const y0 = this.muros[o + 4]!;
      const yaw = this.muros[o + 5]!;
      const seed = this.muros[o + 6]!;
      const et = this.muros[o + 7]!;

      if (et > this.epocaK + 0.05 || len < 0.3 || height < 0.3) {
        this.hideMesh(this.walls, i);
        continue;
      }

      const [x, z] = pxToWorld(this.meta, px, py);
      const s = waveAt(this.front, Math.hypot(x, z), seed, lift);
      if (s < 0.04) {
        this.hideMesh(this.walls, i);
        continue;
      }

      const h = height * s;
      const yBase = y0 * s;
      wallColor(seed, colorOn, _c);
      this.walls.setColorAt(i, _c);

      this.dummy.quaternion.identity();
      this.dummy.position.set(x, yBase, z);
      this.dummy.rotation.set(0, yaw, 0);
      // X=espesor, Y=alto, Z=largo (yaw = atan2(dx,dz) alinea Z con el muro)
      this.dummy.scale.set(thick, Math.max(0.25, h), len);
      this.dummy.updateMatrix();
      this.walls.setMatrixAt(i, this.dummy.matrix);
    }

    this.walls.instanceMatrix.needsUpdate = true;
    if (this.walls.instanceColor) this.walls.instanceColor.needsUpdate = true;
  }

  private rebuildTrees(lift: number, metro: number, colorOn: number) {
    const na = this.arboles.length / 4;
    for (let i = 0; i < na; i++) {
      const o = i * 4;
      const [x, z] = pxToWorld(this.meta, this.arboles[o]!, this.arboles[o + 1]!);
      const r = this.arboles[o + 2]! * metro * (colorOn > 0.5 ? 1.15 : 1);
      const seed = this.arboles[o + 3]!;
      const dist = Math.hypot(x, z);
      const wave =
        THREE.MathUtils.clamp((this.front - dist - seed * 80) / 250, 0, 1) * lift;
      const c = colorOn > 0.2 ? wave : wave * 0.15;
      if (c < 0.04) {
        this.hideMesh(this.trunks, i);
        this.hideMesh(this.crowns, i);
        this.hideMesh(this.crowns2, i);
        continue;
      }

      trunkColor(seed, _c);
      if (colorOn < 0.5) _c.multiplyScalar(0.45);
      this.trunks.setColorAt(i, _c);
      crownColor(seed, _c2);
      if (colorOn < 0.5) _c2.setRGB(0.2, 0.18, 0.14);
      this.crowns.setColorAt(i, _c2);
      crownColor(seed + 0.37, _c);
      if (colorOn < 0.5) _c.setRGB(0.18, 0.16, 0.12);
      this.crowns2.setColorAt(i, _c);

      const th = (colorOn > 0.5 ? 3.4 : 2.2) * c;
      this.dummy.quaternion.identity();
      this.dummy.position.set(x, th * 0.5, z);
      this.dummy.scale.set(c, th, c);
      this.dummy.rotation.set(0, seed * 6.2, 0);
      this.dummy.updateMatrix();
      this.trunks.setMatrixAt(i, this.dummy.matrix);

      const cr = r * c;
      this.dummy.position.set(x, th + cr * 0.55, z);
      this.dummy.scale.set(cr, cr * 0.95, cr);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.crowns.setMatrixAt(i, this.dummy.matrix);

      this.dummy.position.set(x + cr * 0.25, th + cr * 0.85, z - cr * 0.15);
      this.dummy.scale.set(cr * 0.65, cr * 0.6, cr * 0.65);
      this.dummy.updateMatrix();
      this.crowns2.setMatrixAt(i, this.dummy.matrix);
    }
    for (const m of [this.trunks, this.crowns, this.crowns2]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  private hideMesh(mesh: THREE.InstancedMesh, i: number) {
    this.dummy.scale.set(0, 0, 0);
    this.dummy.position.set(0, 0, 0);
    this.dummy.quaternion.identity();
    this.dummy.updateMatrix();
    mesh.setMatrixAt(i, this.dummy.matrix);
  }

  private hideRoof(i: number) {
    this.hideMesh(this.roofsFlat, i);
    this.hideMesh(this.roofsPitch, i);
    this.hideMesh(this.cornices, i);
  }

  dispose() {
    this.facadeTex.dispose();
    this.roofTex.dispose();
    for (const m of [
      this.walls,
      this.roofsFlat,
      this.roofsPitch,
      this.cornices,
      this.trunks,
      this.crowns,
      this.crowns2,
    ]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}
