import * as THREE from "three";
import { hojaSizeMeters, pxToWorld } from "./coords";
import type { LaminasMeta, PlanoMeta } from "./types";

const VS = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FS = /* glsl */ `
precision highp float;
uniform sampler2D tBase;
uniform sampler2D tFine[4];
uniform sampler2D tSuelo;
uniform sampler2D tCalles;
uniform sampler2D tCrece;
uniform sampler2D tDespeje;
uniform vec4 uFine[4];
uniform float uFineOn[4];
uniform vec3 uPaper;
uniform vec3 uInk;
uniform float uLift;
uniform float uColor;
uniform float uEpocaK;
uniform float uEtapas;
varying vec2 vUv;
varying vec3 vWorld;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

/** 0 = tinta, 1 = papel. Afila bordes del grabado de cerca. */
float tinta(vec2 uv) {
  float g = texture2D(tBase, uv).r;
  float gf = g;
  float hay = 0.0;
  #define FINO(i) { \
    vec2 f = (uv - uFine[i].xy) / max(uFine[i].zw, vec2(1e-6)); \
    if (uFineOn[i] > 0.5 && f.x >= 0.0 && f.y >= 0.0 && f.x < 1.0 && f.y < 1.0) { \
      gf = texture2D(tFine[i], f).r; \
      hay = 1.0; \
    } \
  }
  FINO(0) FINO(1) FINO(2) FINO(3)
  float raw = mix(g, gf, hay);
  float a = 0.14 + hay * 0.06;
  float sharp = smoothstep(0.52 - a, 0.52 + a, raw);
  return mix(raw, sharp, 0.72 + 0.18 * hay);
}

float llego(float v, float k) {
  float u = (uEtapas + 0.5 - k) / max(uEtapas, 1.0);
  float m = 0.14 / max(uEtapas, 1.0);
  return smoothstep(u - m, u + m, v);
}

void main() {
  vec2 uv = vUv;
  float papel = tinta(uv);
  float grain = hash21(uv * vec2(1400.0, 980.0));
  vec3 paper = uPaper * (0.98 + grain * 0.03);
  vec3 inkCol = uInk;
  vec3 col = mix(inkCol, paper, papel);

  if (uEpocaK > 0.01) {
    vec3 c = texture2D(tCrece, uv).rgb;
    vec3 d = texture2D(tDespeje, uv).rgb;
    float urb = llego(c.r, uEpocaK);
    float ens = llego(c.g, uEpocaK);
    float dem = max(llego(d.r, uEpocaK), llego(d.b, uEpocaK));
    if (uv.y > 0.72) {
      float fill = max(urb, ens) * smoothstep(0.72, 0.88, uv.y);
      col = mix(col, mix(paper, vec3(0.82, 0.74, 0.58), 0.4), fill * 0.65);
    }
    col = mix(col, mix(paper, vec3(0.88, 0.82, 0.68), 0.25), ens * (1.0 - papel) * 0.35);
    if (dem > 0.15) {
      col = mix(col, paper, dem * 0.7);
      col = mix(col, mix(paper, inkCol, 0.15), dem * 0.15);
    }
  }

  if (uColor > 0.01) {
    vec3 s = texture2D(tSuelo, uv).rgb;
    vec3 cs = texture2D(tCalles, uv).rgb;
    vec2 xz = vWorld.xz;
    float n1 = hash21(xz * 0.045);
    float n2 = hash21(xz * 0.3 + 2.0);
    float nf = hash21(xz * 1.9 + 3.0);
    // tierra apisonada en ciudad; pasto en afueras (como sueloColor del original)
    vec3 tierra = mix(vec3(0.6, 0.5, 0.375), vec3(0.75, 0.655, 0.5), n1) * (0.94 + 0.12 * nf);
    vec3 pasto = mix(vec3(0.36, 0.43, 0.2), vec3(0.6, 0.57, 0.31), n1) * (0.9 + 0.2 * nf);
    float rio = smoothstep(0.25, 0.55, s.r);
    float verd = smoothstep(0.3, 0.7, s.g);
    float edi = smoothstep(0.35, 0.75, s.b) * (1.0 - uLift * 0.85);
    float rioNow = rio * (1.0 - llego(texture2D(tCrece, uv).r, uEpocaK) * 0.85);
    float urbano = smoothstep(0.12, 0.4, s.b);
    vec3 ccol = mix(pasto, tierra, max(urbano, edi));
    // patios / pulmones: tierra + matas (cerca se apagan con uLift)
    vec3 fondo = mix(vec3(0.55, 0.46, 0.32), vec3(0.63, 0.54, 0.38), n2) * (0.88 + 0.2 * nf);
    fondo = mix(fondo, mix(vec3(0.4, 0.44, 0.2), vec3(0.5, 0.52, 0.26), nf), 0.5 * smoothstep(0.5, 0.78, n1 * 0.65 + n2 * 0.35));
    float mata = smoothstep(0.5, 0.62, n1 * 0.6 + n2 * 0.4) * mix(1.0, 0.15, uLift);
    fondo = mix(fondo, mix(vec3(0.17, 0.25, 0.11), vec3(0.3, 0.38, 0.16), nf), mata);
    ccol = mix(ccol, fondo, verd);
    // azoteas acostadas
    ccol = mix(ccol, vec3(0.66, 0.43, 0.33) * (0.9 + 0.2 * n1), edi * (1.0 - uLift) * 0.85);
    // calles
    float calz = smoothstep(0.2, 0.6, cs.b);
    float pav = max(llego(cs.r, uEpocaK), llego(cs.g, uEpocaK)) * calz;
    vec3 bruto = mix(vec3(0.47, 0.42, 0.35), vec3(0.67, 0.62, 0.53), nf);
    vec3 asfalto = mix(vec3(0.33, 0.33, 0.34), vec3(0.4, 0.34, 0.28), n1);
    ccol = mix(ccol, mix(bruto, asfalto, llego(cs.g, uEpocaK)), pav * 0.92);
    // río marrón-gris (no azul chicle)
    float ola = hash21(xz * vec2(0.018, 0.07));
    vec3 agua = mix(vec3(0.37, 0.35, 0.3), vec3(0.57, 0.54, 0.46), ola) * mix(0.93, 1.0, papel);
    ccol = mix(ccol, agua, rioNow);
    // la tinta del grabado queda como trazos debajo del color
    ccol *= mix(mix(0.52, 0.88, verd), 1.0, papel);
    ccol = mix(mix(inkCol, ccol, 0.72), ccol, papel);
    col = mix(col, ccol, uColor);
  }

  col *= mix(1.0, 0.92, uLift * 0.7 * (1.0 - uColor));
  gl_FragColor = vec4(col, 1.0);
}
`;

export type PlanoMeshOptions = {
  meta: PlanoMeta;
  laminas?: LaminasMeta | null;
  baseUrl?: string;
};

export class PlanoMesh {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly meta: PlanoMeta;
  material: THREE.ShaderMaterial;
  private laminas: LaminasMeta | null;
  private baseUrl: string;
  private fineKeys: (string | null)[] = [null, null, null, null];
  private loader = new THREE.TextureLoader();
  private lift = 0;

  constructor(opts: PlanoMeshOptions) {
    this.meta = opts.meta;
    this.laminas = opts.laminas ?? null;
    this.baseUrl = opts.baseUrl ?? "/plano";

    const { w, h } = hojaSizeMeters(this.meta);
    const [ox, oz] = pxToWorld(this.meta, this.meta.ancho / 2, this.meta.alto / 2);

    const geo = new THREE.PlaneGeometry(w, h, 1, 1);
    geo.rotateX(-Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: FS,
      uniforms: {
        tBase: { value: null },
        tFine: { value: [null, null, null, null] },
        tSuelo: { value: null },
        tCalles: { value: null },
        tCrece: { value: null },
        tDespeje: { value: null },
        uFine: {
          value: [
            new THREE.Vector4(0, 0, 1, 1),
            new THREE.Vector4(0, 0, 1, 1),
            new THREE.Vector4(0, 0, 1, 1),
            new THREE.Vector4(0, 0, 1, 1),
          ],
        },
        uFineOn: { value: [0, 0, 0, 0] },
        uPaper: { value: new THREE.Color("#f7eedb") },
        uInk: { value: new THREE.Color("#2e2620") },
        uLift: { value: 0 },
        uColor: { value: 0 },
        uEpocaK: { value: 0 },
        uEtapas: { value: 6 },
      },
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.set(ox, 0, oz);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  async loadBase(prefer: "chico" | "medio" | "primero" = "chico"): Promise<void> {
    // Preferir medio-4k del original cuando pedimos detalle.
    const candidates =
      prefer === "medio"
        ? ["medio-4k.webp", "medio.webp", "chico.webp", "primero.webp", "source.webp"]
        : prefer === "primero"
          ? ["primero.webp", "chico.webp", "medio.webp", "source.webp"]
          : ["chico.webp", "medio.webp", "primero.webp", "source.webp"];

    let lastErr: unknown;
    for (const name of candidates) {
      try {
        const tex = await this.loadTex(`${this.baseUrl}/${name}`);
        tex.colorSpace = THREE.NoColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        this.material.uniforms.tBase.value = tex;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!this.material.uniforms.tBase.value) {
      throw lastErr instanceof Error ? lastErr : new Error("No hay textura de plano");
    }

    // Overlays: preferir 2k del original (crece/despeje/suelo/calles)
    for (const [key, files] of [
      ["tSuelo", ["suelo-2k.webp", "suelo.webp"]],
      ["tCalles", ["calles-2k.webp", "calles.webp"]],
      ["tCrece", ["crece-2k.webp", "crece.webp"]],
      ["tDespeje", ["despeje-2k.webp", "despeje.webp"]],
    ] as const) {
      for (const file of files) {
        try {
          const tex = await this.loadTex(`${this.baseUrl}/${file}`);
          tex.colorSpace = THREE.NoColorSpace;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          this.material.uniforms[key].value = tex;
          break;
        } catch {
          /* try next */
        }
      }
    }
    this.material.needsUpdate = true;
  }

  setLift(t: number) {
    this.lift = THREE.MathUtils.clamp(t, 0, 1);
    this.material.uniforms.uLift.value = this.lift;
  }

  getLift() {
    return this.lift;
  }

  setColor(c: number) {
    this.material.uniforms.uColor.value = THREE.MathUtils.clamp(c, 0, 1);
  }

  getColor() {
    return this.material.uniforms.uColor.value as number;
  }

  setEpoca(k: number, etapas = 6) {
    this.material.uniforms.uEpocaK.value = k;
    this.material.uniforms.uEtapas.value = etapas;
  }

  async updateFineTiles(worldX: number, worldZ: number, zoomPxPerScreen: number) {
    if (!this.laminas || zoomPxPerScreen < 1.15) {
      this.clearFine();
      return;
    }

    const px = worldX / this.meta.metro + this.meta.plaza[0];
    const py = worldZ / this.meta.metro + this.meta.plaza[1];
    const { tesela, cols, rows, ancho, alto } = this.laminas;
    const col = Math.min(cols - 1, Math.max(0, Math.floor(px / tesela)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(py / tesela)));

    const wanted: { col: number; row: number }[] = [];
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const c = Math.min(cols - 1, col + dx);
        const r = Math.min(rows - 1, row + dy);
        if (!wanted.some((w) => w.col === c && w.row === r)) wanted.push({ col: c, row: r });
      }
    }

    // Naming del original: plano/f/{col}-{row}.webp (tesela 3072, 7×5).
    const nextKeys = wanted.map((w) => `${w.col}-${w.row}`);
    const keep = new Set(nextKeys);

    for (let i = 0; i < 4; i++) {
      const key = this.fineKeys[i];
      if (key && !keep.has(key)) {
        this.fineKeys[i] = null;
        this.material.uniforms.uFineOn.value[i] = 0;
        const old = this.material.uniforms.tFine.value[i];
        if (old) {
          old.dispose();
          this.material.uniforms.tFine.value[i] = null;
        }
      }
    }

    for (const w of wanted) {
      const key = `${w.col}-${w.row}`;
      if (this.fineKeys.includes(key)) continue;
      let slot = this.fineKeys.findIndex((k) => k === null);
      if (slot < 0) continue;

      try {
        const tex = await this.loadTex(`${this.baseUrl}/f/${key}.webp`);
        tex.colorSpace = THREE.NoColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;

        const x0 = (w.col * tesela) / ancho;
        const y0 = (w.row * tesela) / alto;
        const tw = Math.min(tesela, ancho - w.col * tesela) / ancho;
        const th = Math.min(tesela, alto - w.row * tesela) / alto;
        const uy0 = 1 - y0 - th;
        this.material.uniforms.tFine.value[slot] = tex;
        this.material.uniforms.uFine.value[slot].set(x0, uy0, tw, th);
        this.material.uniforms.uFineOn.value[slot] = 1;
        this.fineKeys[slot] = key;
      } catch {
        /* missing tile */
      }
    }
  }

  private clearFine() {
    for (let i = 0; i < 4; i++) {
      if (!this.fineKeys[i]) continue;
      this.fineKeys[i] = null;
      this.material.uniforms.uFineOn.value[i] = 0;
      const t = this.material.uniforms.tFine.value[i];
      if (t) {
        t.dispose();
        this.material.uniforms.tFine.value[i] = null;
      }
    }
  }

  private loadTex(url: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      this.loader.load(url, resolve, undefined, reject);
    });
  }

  dispose() {
    this.clearFine();
    for (const k of ["tBase", "tSuelo", "tCalles", "tCrece", "tDespeje"] as const) {
      const t = this.material.uniforms[k].value as THREE.Texture | null;
      t?.dispose();
    }
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
