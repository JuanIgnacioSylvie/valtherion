import * as THREE from "three";
import { hojaSizeMeters, pxToWorld } from "../plano/coords";
import type { PlanoMeta } from "../plano/types";

const VS = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FS = /* glsl */ `
precision highp float;
uniform sampler2D tCerca;
uniform sampler2D tLejos;
uniform float uHoy;
uniform vec3 uRojo;
varying vec2 vUv;

void main() {
  if (uHoy <= 0.001) discard;
  vec3 L = texture2D(tLejos, vUv).rgb;
  float c = texture2D(tCerca, vUv).r;
  float linea = max(c, L.r);
  float tierra = L.g;
  float a = uHoy * max(linea * 0.9, tierra * 0.35);
  if (a < 0.02) discard;
  vec3 col = uRojo;
  // rayado suave en tierra ganada
  if (tierra > 0.2 && linea < 0.4) {
    float r = step(0.5, fract((vUv.x + vUv.y) * 80.0));
    a *= 0.25 + 0.55 * r;
  }
  gl_FragColor = vec4(col, a);
}
`;

export class HoyOverlay {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  amount = 0;

  constructor(meta: PlanoMeta) {
    const { w, h } = hojaSizeMeters(meta);
    const [ox, oz] = pxToWorld(meta, meta.ancho / 2, meta.alto / 2);
    const geo = new THREE.PlaneGeometry(w, h);
    geo.rotateX(-Math.PI / 2);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthWrite: false,
      uniforms: {
        tCerca: { value: null },
        tLejos: { value: null },
        uHoy: { value: 0 },
        uRojo: { value: new THREE.Color("#a03220") },
      },
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.position.set(ox, 0.4, oz);
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  async load() {
    const loader = new THREE.TextureLoader();
    const load = (url: string) =>
      new Promise<THREE.Texture>((res, rej) => loader.load(url, res, undefined, rej));
    try {
      const [cerca, lejos] = await Promise.all([
        load("/plano/hoy-cerca.webp"),
        load("/plano/hoy-lejos.webp"),
      ]);
      for (const t of [cerca, lejos]) {
        t.colorSpace = THREE.NoColorSpace;
        t.magFilter = THREE.LinearFilter;
        t.minFilter = THREE.LinearFilter;
      }
      this.mat.uniforms.tCerca.value = cerca;
      this.mat.uniforms.tLejos.value = lejos;
    } catch {
      /* sin overlay */
    }
  }

  setAmount(a: number) {
    this.amount = THREE.MathUtils.clamp(a, 0, 1);
    this.mat.uniforms.uHoy.value = this.amount;
    this.mesh.visible = this.amount > 0.01;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
