import * as THREE from "three";

/**
 * Contornos a tinta + grano de papel (como baires.mormon.garden).
 * Depth-laplacian → líneas; en color se aflojan.
 */
export class InkPass {
  private renderer: THREE.WebGLRenderer;
  private rt: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private size = new THREE.Vector2();
  private color = 0;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    const depth = new THREE.DepthTexture(1, 1);
    depth.format = THREE.DepthFormat;
    depth.type = THREE.UnsignedIntType;

    this.rt = new THREE.WebGLRenderTarget(1, 1, {
      depthTexture: depth,
      depthBuffer: true,
      stencilBuffer: false,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        uSize: { value: new THREE.Vector2(1, 1) },
        uNear: { value: 0.5 },
        uFar: { value: 60000 },
        uPix: { value: 0.001 },
        uLine: { value: 1 },
        uColor: { value: 0 },
        uInk: { value: new THREE.Color("#2e2820") },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tColor;
        uniform sampler2D tDepth;
        uniform vec2 uSize;
        uniform float uNear;
        uniform float uFar;
        uniform float uPix;
        uniform float uLine;
        uniform float uColor;
        uniform vec3 uInk;
        varying vec2 vUv;

        float h21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
            mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        void main() {
          vec2 t = vec2(uLine) / uSize;
          float c = texture2D(tDepth, vUv).r;
          float l = texture2D(tDepth, vUv - vec2(t.x, 0.0)).r;
          float r = texture2D(tDepth, vUv + vec2(t.x, 0.0)).r;
          float u = texture2D(tDepth, vUv + vec2(0.0, t.y)).r;
          float b = texture2D(tDepth, vUv - vec2(0.0, t.y)).r;

          // depth → metros (perspective, buffer [0..1])
          float k = (uFar - uNear) / (uNear * uFar);
          float z = 1.0 / max(1.0 / uNear - c * k, 1e-6);
          float lap = max(abs(l + r - 2.0 * c), abs(u + b - 2.0 * c));
          // umbral más alto: evita “deshacer” techos/muros densos en ruido de tinta
          float thr = mix(0.0024, 0.00055, clamp(z / 2500.0, 0.0, 1.0)) * uLine;
          float edge = smoothstep(thr, thr * 4.0, lap);
          edge *= clamp(1.15 - (z / 7000.0), 0.0, 1.0) * step(c, 0.9995);

          vec3 col = texture2D(tColor, vUv).rgb;
          // trazos a tinta; en color se aflojan
          col = mix(col, mix(uInk, col * 0.62, uColor), edge * mix(0.58, 0.22, uColor));
          // bruma lejana en color
          col = mix(col, vec3(0.82, 0.8, 0.74), uColor * step(c, 0.9995) * 0.45 * (1.0 - exp(-z / 9000.0)));

          // grano de papel
          vec2 p = gl_FragCoord.xy;
          float g = vnoise(p * 0.9) * 0.5 + vnoise(p * 0.23) * 0.3 + vnoise(p * vec2(0.03, 0.4)) * 0.2;
          col *= mix(0.96, 0.985, uColor) + mix(0.06, 0.025, uColor) * g;

          vec2 q = vUv - 0.5;
          q.x *= uSize.x / uSize.y * 0.8;
          col *= 1.0 - 0.14 * smoothstep(0.45, 1.1, length(q));

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.resize();
  }

  setColor(c: number) {
    this.color = THREE.MathUtils.clamp(c, 0, 1);
    this.mat.uniforms.uColor.value = this.color;
  }

  resize() {
    this.renderer.getDrawingBufferSize(this.size);
    const w = Math.max(1, Math.floor(this.size.x));
    const h = Math.max(1, Math.floor(this.size.y));
    this.rt.setSize(w, h);
    this.mat.uniforms.uSize.value.set(w, h);
    this.mat.uniforms.tColor.value = this.rt.texture;
    this.mat.uniforms.tDepth.value = this.rt.depthTexture;
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    const u = this.mat.uniforms;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uPix.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / this.size.y;
    u.uLine.value = Math.max(1, this.size.y / 1000);

    this.renderer.setRenderTarget(this.rt);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.cam);
  }

  dispose() {
    this.rt.dispose();
    this.mat.dispose();
    this.quad.geometry.dispose();
  }
}
