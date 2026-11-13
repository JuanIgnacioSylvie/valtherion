import { TERRAIN_FRAG, TERRAIN_VERT } from "./terrainShader";

/** Dibuja el mundi (híbrido pintado + procedural) en un canvas WebGL2 detrás de Pixi. */
export class TerrainRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private uRes: WebGLUniformLocation | null;
  private uOffset: WebGLUniformLocation | null;
  private uZoom: WebGLUniformLocation | null;
  private uWorld: WebGLUniformLocation | null;
  private uHasPaint: WebGLUniformLocation | null;
  private paintTex: WebGLTexture | null = null;
  private scale = 1;
  private raf = 0;
  private worldW = 1920;
  private worldH = 911;

  private constructor(
    canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    vao: WebGLVertexArrayObject,
  ) {
    this.canvas = canvas;
    this.gl = gl;
    this.program = program;
    this.vao = vao;
    this.uRes = gl.getUniformLocation(program, "uRes");
    this.uOffset = gl.getUniformLocation(program, "uOffset");
    this.uZoom = gl.getUniformLocation(program, "uZoom");
    this.uWorld = gl.getUniformLocation(program, "uWorld");
    this.uHasPaint = gl.getUniformLocation(program, "uHasPaint");
  }

  static create(): TerrainRenderer | null {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!gl) return null;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error("Terrain shader error:", gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, TERRAIN_VERT);
    const fs = compile(gl.FRAGMENT_SHADER, TERRAIN_FRAG);
    if (!vs || !fs) return null;

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Terrain link error:", gl.getProgramInfoLog(program));
      return null;
    }

    const vao = gl.createVertexArray()!;
    const renderer = new TerrainRenderer(canvas, gl, program, vao);

    // Sampler fijo en unidad 0
    gl.useProgram(program);
    const uPaint = gl.getUniformLocation(program, "uPaint");
    if (uPaint) gl.uniform1i(uPaint, 0);

    return renderer;
  }

  setWorldSize(w: number, h: number) {
    this.worldW = w;
    this.worldH = h;
  }

  /** Carga el mapa pintado D&D para el zoom bajo. */
  async loadPaint(url: string): Promise<boolean> {
    const { gl } = this;
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = "anonymous";
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error(`paint load failed: ${url}`));
        el.src = url;
      });
      if (this.paintTex) gl.deleteTexture(this.paintTex);
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      this.paintTex = tex;
      return true;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }

  resize(cssW: number, cssH: number, maxPixels = 3_200_000) {
    let s = Math.min(window.devicePixelRatio || 1, 2);
    const px = cssW * cssH * s * s;
    if (px > maxPixels) s = Math.sqrt(maxPixels / (cssW * cssH));
    this.scale = s;
    this.canvas.width = Math.max(1, Math.round(cssW * s));
    this.canvas.height = Math.max(1, Math.round(cssH * s));
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
  }

  draw(offsetX: number, offsetY: number, zoom: number) {
    const { gl } = this;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    if (this.paintTex) gl.bindTexture(gl.TEXTURE_2D, this.paintTex);
    gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.uOffset, offsetX * this.scale, offsetY * this.scale);
    gl.uniform1f(this.uZoom, zoom * this.scale);
    gl.uniform2f(this.uWorld, this.worldW, this.worldH);
    gl.uniform1f(this.uHasPaint, this.paintTex ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  schedule(offsetX: number, offsetY: number, zoom: number) {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.draw(offsetX, offsetY, zoom));
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    const { gl } = this;
    if (this.paintTex) gl.deleteTexture(this.paintTex);
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.canvas.remove();
  }
}
