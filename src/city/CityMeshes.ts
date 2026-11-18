import * as THREE from "three";
import { loadCreceGeometry } from "../datos/creceDecode";
import { pxToWorld } from "../plano/coords";
import type { PlanoMeta } from "../plano/types";
import { makeCityDepthMaterial, makeCityMaterial } from "./CityMaterial";
import type { CityUniforms } from "./CityUniforms";
import { estiloDe } from "./estilo";

export type CityStats = { techos: number; arboles: number; manzanas: number; muros?: number };

function encodeDist(dist: number, nace: number, muere: number) {
  const et = (nace | 0) + 8 * (muere >= 255 ? 0 : muere | 0);
  return dist + et * 20000;
}

function ensureInstAttrs(mesh: THREE.InstancedMesh, n: number) {
  const g = mesh.geometry;
  const mk = (name: string, item: number, fill = 0) => {
    let attr = g.getAttribute(name) as THREE.InstancedBufferAttribute | undefined;
    if (!attr || attr.count !== n) {
      attr = new THREE.InstancedBufferAttribute(new Float32Array(n * item), item);
      g.setAttribute(name, attr);
    } else if (fill) attr.array.fill(fill);
    return attr;
  };
  return {
    aInfo: mk("aInfo", 4),
    aWall: mk("aWall", 4),
    aAncla: mk("aAncla", 3),
    aEstilo: mk("aEstilo", 1),
  };
}

/**
 * Ciudad: muros + techos con el shader del original (tinta del plano + tipologías).
 * techos.pak: Float32[px,py,w,d,h,yaw,seed,et]
 * muros.pak: Float32[px,py,len,height,y0,yaw,seed,et]
 */
export class CityMeshes {
  readonly group = new THREE.Group();
  private roofsFlat: THREE.InstancedMesh;
  private roofsPitch: THREE.InstancedMesh;
  private trunks: THREE.InstancedMesh;
  private crowns: THREE.InstancedMesh;
  private crowns2: THREE.InstancedMesh;
  private walls: THREE.InstancedMesh;
  private meta: PlanoMeta;
  private techos: Float32Array;
  private techoStride: 7 | 8;
  private muros: Float32Array;
  private arboles: Float32Array;
  private deathTechos: Uint8Array;
  private deathMuros: Uint8Array;
  private dummy = new THREE.Object3D();
  private roofMat: THREE.MeshStandardMaterial;
  private wallMat: THREE.MeshStandardMaterial;
  private trunkMat: THREE.MeshStandardMaterial;
  private crownMat: THREE.MeshStandardMaterial;
  private shared: CityUniforms | null = null;
  private baked = false;
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
    deathTechos?: Uint8Array,
    deathMuros?: Uint8Array,
  ) {
    this.meta = meta;
    this.techos = techos;
    this.muros = muros;
    this.arboles = arboles;
    this.techoStride = techos.length % 8 === 0 ? 8 : 7;
    const nT = techos.length / this.techoStride;
    const nM = Math.max(1, muros.length / 8);
    this.deathTechos = deathTechos ?? new Uint8Array(nT).fill(255);
    this.deathMuros = deathMuros ?? new Uint8Array(nM).fill(255);

    // placeholders hasta bindShared
    this.roofMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
    this.wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
    this.trunkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    this.crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });

    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);

    this.walls = new THREE.InstancedMesh(box, this.wallMat, nM);
    this.roofsFlat = new THREE.InstancedMesh(box.clone(), this.roofMat, nT);
    this.roofsPitch = new THREE.InstancedMesh(makePitchRoofGeo(), this.roofMat.clone(), nT);

    for (const m of [this.walls, this.roofsFlat, this.roofsPitch]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
    this.walls.count = nM;
    this.roofsFlat.count = nT;
    this.roofsPitch.count = 0;

    // Tronco/copa con pivote en el suelo (y=0); el shader suma relieve vía aAncla.
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 1, 6);
    trunkGeo.translate(0, 0.5, 0);
    const crownGeo = new THREE.IcosahedronGeometry(1, 0);
    crownGeo.translate(0, 1.15, 0);
    const crown2Geo = new THREE.IcosahedronGeometry(0.72, 0);
    crown2Geo.translate(0.35, 1.45, 0.1);

    const na = Math.max(1, arboles.length / 4);
    this.trunks = new THREE.InstancedMesh(trunkGeo, this.trunkMat, na);
    this.crowns = new THREE.InstancedMesh(crownGeo, this.crownMat, na);
    this.crowns2 = new THREE.InstancedMesh(crown2Geo, this.crownMat.clone(), na);
    for (const m of [this.trunks, this.crowns, this.crowns2]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }

    this.group.add(this.walls, this.roofsFlat, this.roofsPitch, this.trunks, this.crowns, this.crowns2);
    this.group.visible = false;
  }

  /** Engancha el shader del original (tinta + tipologías). */
  bindShared(shared: CityUniforms) {
    this.shared = shared;
    this.roofMat.dispose();
    this.wallMat.dispose();
    this.trunkMat.dispose();
    this.crownMat.dispose();
    this.roofMat = makeCityMaterial(shared, { manto: 3 });
    this.wallMat = makeCityMaterial(shared, { manto: 3 });
    this.trunkMat = makeCityMaterial(shared, { manto: 3 });
    this.crownMat = makeCityMaterial(shared, { manto: 3 });
    const depth = makeCityDepthMaterial(shared);
    this.walls.material = this.wallMat;
    this.roofsFlat.material = this.roofMat;
    this.roofsPitch.material = this.roofMat;
    this.trunks.material = this.trunkMat;
    this.crowns.material = this.crownMat;
    this.crowns2.material = this.crownMat;
    for (const m of [this.walls, this.roofsFlat, this.roofsPitch, this.trunks, this.crowns, this.crowns2]) {
      m.customDepthMaterial = depth;
    }
    this.baked = false;
    this.bake();
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

      let techos = new Float32Array(techosAb);
      const nBaseT = techos.length / (techos.length % 8 === 0 ? 8 : 7);
      const nBaseM = muros.length / 8;
      const deathT = new Uint8Array(nBaseT).fill(255);
      const deathM = new Uint8Array(nBaseM).fill(255);

      const crece = await loadCreceGeometry(meta);
      if (crece) {
        for (let i = 0; i + 1 < crece.mueT.length; i += 2) {
          const idx = crece.mueT[i]!;
          const et = crece.mueT[i + 1]!;
          if (idx < deathT.length) deathT[idx] = et;
        }
        for (let i = 0; i + 1 < crece.mueM.length; i += 2) {
          const idx = crece.mueM[i]!;
          const et = crece.mueM[i + 1]!;
          if (idx < deathM.length) deathM[idx] = et;
        }
        const mergedT = new Float32Array(techos.length + crece.techos.length);
        mergedT.set(techos);
        mergedT.set(crece.techos, techos.length);
        techos = mergedT;
        const mergedM = new Float32Array(muros.length + crece.muros.length);
        mergedM.set(muros);
        mergedM.set(crece.muros, muros.length);
        muros = mergedM;
        const deathT2 = new Uint8Array(techos.length / 8).fill(255);
        deathT2.set(deathT);
        const deathM2 = new Uint8Array(muros.length / 8).fill(255);
        deathM2.set(deathM);
        return new CityMeshes(
          meta,
          techos,
          muros,
          new Float32Array(arbAb),
          {
            techos: (ciudad.techos ?? 0) + crece.techos.length / 8,
            arboles: ciudad.arboles ?? 0,
            manzanas: ciudad.manzanas ?? 0,
            muros: (ciudad.muros ?? nBaseM) + crece.muros.length / 8,
          },
          deathT2,
          deathM2,
        );
      }

      return new CityMeshes(
        meta,
        techos,
        muros,
        new Float32Array(arbAb),
        {
          techos: ciudad.techos ?? 0,
          arboles: ciudad.arboles ?? 0,
          manzanas: ciudad.manzanas ?? 0,
          muros: ciudad.muros ?? muros.length / 8,
        },
        deathT,
        deathM,
      );
    } catch {
      return null;
    }
  }

  setColorMode(c: number) {
    this.colorMode = c;
    this.shared?.setColor(c);
  }

  /** Matrices + aInfo/aWall/aEstilo una vez; el shader hace alzado/tinta. */
  bake() {
    const metro = this.meta.metro;
    this.bakeRoofs(metro);
    this.bakeMuros();
    this.bakeTrees(metro);
    this.baked = true;
  }

  rebuild(lift: number) {
    this.visibleLift = lift;
    this.group.visible = lift > 0.01;
    // muros/techos/árboles: alzado + relieve van en el shader (uFront / tRelieve)
    if (!this.baked) this.bake();
  }

  private bakeRoofs(metro: number) {
    const stride = this.techoStride;
    const n = this.techos.length / stride;
    const attrs = ensureInstAttrs(this.roofsFlat, n);
    const pitchAttrs = ensureInstAttrs(this.roofsPitch, n);
    let nPitch = 0;

    for (let i = 0; i < n; i++) {
      const o = i * stride;
      const px = this.techos[o]!;
      const py = this.techos[o + 1]!;
      let w = this.techos[o + 2]! * metro;
      let d = this.techos[o + 3]! * metro;
      const hMax = this.techos[o + 4]!;
      let yaw = 0;
      let seed = 0.5;
      let et = 0;
      if (stride === 8) {
        yaw = this.techos[o + 5]!;
        seed = this.techos[o + 6]!;
        et = this.techos[o + 7]!;
      } else {
        seed = this.techos[o + 5]!;
        et = this.techos[o + 6]!;
      }
      const [x, z] = pxToWorld(this.meta, px, py);
      const dist = Math.hypot(x, z);
      const death = this.deathTechos[i] ?? 255;
      const floors = Math.max(1, Math.floor((hMax - 0.8) / 3.3 + 0.5));
      const est = estiloDe(x, z, et | 0, floors, seed * 65535);
      const pitched = est >= 5;

      this.dummy.position.set(x, 0, z);
      this.dummy.rotation.set(0, yaw, 0);
      this.dummy.scale.set(Math.max(0.8, w), Math.max(2.2, hMax * 0.08), Math.max(0.8, d));
      // azotea: placa fina arriba del volumen de muros (hMax es altura de techo)
      this.dummy.position.y = Math.max(2.4, hMax) - 0.15;
      this.dummy.scale.set(Math.max(0.8, w), pitched ? Math.max(1.2, hMax * 0.22) : 0.35, Math.max(0.8, d));
      this.dummy.updateMatrix();

      const infoY = 30 + floors; // kind 3 = techo
      const aW = [0, 0, Math.max(0.8, w), Math.max(0.8, d)] as const;
      const distEnc = encodeDist(dist, et, death);

      if (pitched) {
        this.roofsPitch.setMatrixAt(nPitch, this.dummy.matrix);
        setAttr4(pitchAttrs.aInfo, nPitch, seed, infoY, hMax, distEnc);
        setAttr4(pitchAttrs.aWall, nPitch, aW[0], aW[1], aW[2], aW[3]);
        setAttr3(pitchAttrs.aAncla, nPitch, 0, 0, 0);
        pitchAttrs.aEstilo.setX(nPitch, est);
        // ocultar flat
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.roofsFlat.setMatrixAt(i, this.dummy.matrix);
        setAttr4(attrs.aInfo, i, seed, infoY, hMax, distEnc);
        setAttr4(attrs.aWall, i, aW[0], aW[1], aW[2], aW[3]);
        setAttr3(attrs.aAncla, i, 0, 0, 0);
        attrs.aEstilo.setX(i, est);
        nPitch++;
      } else {
        this.roofsFlat.setMatrixAt(i, this.dummy.matrix);
        setAttr4(attrs.aInfo, i, seed, infoY, hMax, distEnc);
        setAttr4(attrs.aWall, i, aW[0], aW[1], aW[2], aW[3]);
        setAttr3(attrs.aAncla, i, 0, 0, 0);
        attrs.aEstilo.setX(i, est);
      }
    }
    this.roofsFlat.instanceMatrix.needsUpdate = true;
    this.roofsPitch.count = nPitch;
    this.roofsPitch.instanceMatrix.needsUpdate = true;
    markAttrs(attrs);
    markAttrs(pitchAttrs);
  }

  private bakeMuros() {
    const n = this.muros.length / 8;
    if (n < 1) {
      this.walls.count = 0;
      return;
    }
    const attrs = ensureInstAttrs(this.walls, n);
    const thick = 0.5;
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
      const [x, z] = pxToWorld(this.meta, px, py);
      const dist = Math.hypot(x, z);
      const death = this.deathMuros[i] ?? 255;
      const floors = Math.max(1, Math.floor((height - 0.8) / 3.3 + 0.5));
      const est = estiloDe(x, z, et | 0, floors, seed * 65535);

      this.dummy.position.set(x, y0, z);
      this.dummy.rotation.set(0, yaw, 0);
      this.dummy.scale.set(thick, Math.max(0.4, height), Math.max(0.35, len));
      this.dummy.updateMatrix();
      this.walls.setMatrixAt(i, this.dummy.matrix);

      // kind 1 = muro tipológico (fachada con vanos en el shader)
      setAttr4(attrs.aInfo, i, seed, 10 + floors, height, encodeDist(dist, et, death));
      setAttr4(attrs.aWall, i, 0, 0, Math.max(0.35, len), Math.max(0.4, height));
      setAttr3(attrs.aAncla, i, 0, 0, 0);
      attrs.aEstilo.setX(i, est);
    }
    this.walls.count = n;
    this.walls.instanceMatrix.needsUpdate = true;
    markAttrs(attrs);
  }

  private bakeTrees(metro: number) {
    const na = this.arboles.length / 4;
    const trunkA = ensureInstAttrs(this.trunks, na);
    const crownA = ensureInstAttrs(this.crowns, na);
    const crown2A = ensureInstAttrs(this.crowns2, na);
    // y=0 + aAncla: el vertex shader suma altura(relieve). Sin heightAt en JS.
    for (let i = 0; i < na; i++) {
      const o = i * 4;
      const px = this.arboles[o]!;
      const py = this.arboles[o + 1]!;
      const rPx = this.arboles[o + 2]!;
      const seed = this.arboles[o + 3]!;
      const [x, z] = pxToWorld(this.meta, px, py);
      const dist = Math.hypot(x, z);
      const r = Math.max(0.8, rPx * metro);
      const th = 2.6 + seed * 1.4;

      this.dummy.position.set(x, 0, z);
      this.dummy.rotation.set(0, seed * 6.2, 0);
      this.dummy.scale.set(r * 0.18, th, r * 0.18);
      this.dummy.updateMatrix();
      this.trunks.setMatrixAt(i, this.dummy.matrix);

      this.dummy.scale.set(r, r, r);
      this.dummy.updateMatrix();
      this.crowns.setMatrixAt(i, this.dummy.matrix);

      this.dummy.rotation.set(0, seed * 6.2 + 1.1, 0);
      this.dummy.scale.set(r * 0.72, r * 0.65, r * 0.72);
      this.dummy.updateMatrix();
      this.crowns2.setMatrixAt(i, this.dummy.matrix);

      // kind 70 = tronco oscuro · kind 50 = follaje. Alzado por uFront; relieve por aAncla.
      setAttr4(trunkA.aInfo, i, seed, 70, th, dist);
      setAttr4(trunkA.aWall, i, 0, 0, th, th);
      setAttr3(trunkA.aAncla, i, x, z, 1);
      trunkA.aEstilo.setX(i, 0);

      setAttr4(crownA.aInfo, i, seed, 50, r * 2, dist);
      setAttr4(crownA.aWall, i, 0, 0, 7 /* césped */, 0.7);
      setAttr3(crownA.aAncla, i, x, z, 1);
      crownA.aEstilo.setX(i, 0);

      setAttr4(crown2A.aInfo, i, seed + 0.17, 50, r * 1.6, dist);
      setAttr4(crown2A.aWall, i, 0, 0, 7, 0.7);
      setAttr3(crown2A.aAncla, i, x, z, 1);
      crown2A.aEstilo.setX(i, 0);
    }
    this.trunks.count = na;
    this.crowns.count = na;
    this.crowns2.count = na;
    this.trunks.instanceMatrix.needsUpdate = true;
    this.crowns.instanceMatrix.needsUpdate = true;
    this.crowns2.instanceMatrix.needsUpdate = true;
    markAttrs(trunkA);
    markAttrs(crownA);
    markAttrs(crown2A);
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

function setAttr4(a: THREE.InstancedBufferAttribute, i: number, x: number, y: number, z: number, w: number) {
  a.setXYZW(i, x, y, z, w);
}
function setAttr3(a: THREE.InstancedBufferAttribute, i: number, x: number, y: number, z: number) {
  a.setXYZ(i, x, y, z);
}
function markAttrs(a: {
  aInfo: THREE.InstancedBufferAttribute;
  aWall: THREE.InstancedBufferAttribute;
  aAncla: THREE.InstancedBufferAttribute;
  aEstilo: THREE.InstancedBufferAttribute;
}) {
  a.aInfo.needsUpdate = true;
  a.aWall.needsUpdate = true;
  a.aAncla.needsUpdate = true;
  a.aEstilo.needsUpdate = true;
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
  geo.computeVertexNormals();
  return geo;
}