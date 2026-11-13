import { TERRAIN_FRAG, TERRAIN_VERT } from "./terrainShader";

/** Dibuja el mundi procedural en un canvas WebGL2 detrás del canvas de Pixi. */
export class TerrainRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private uRes: WebGLUniformLocation | null;
  private uOffset: WebGLUniformLocation | null;
  private uZoom: WebGLUniformLocation | null;
  /** px de backing store por px CSS */
  private scale = 1;
  private raf = 0;

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
    return new TerrainRenderer(canvas, gl, program, vao);
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

  /** offset/zoom en px CSS (mismo espacio que stage.position / stage.scale de Pixi). */
  draw(offsetX: number, offsetY: number, zoom: number) {
    const { gl } = this;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.uOffset, offsetX * this.scale, offsetY * this.scale);
    gl.uniform1f(this.uZoom, zoom * this.scale);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Agrupa múltiples cambios de cámara en un solo draw por frame. */
  schedule(offsetX: number, offsetY: number, zoom: number) {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.draw(offsetX, offsetY, zoom));
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    const { gl } = this;
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.canvas.remove();
  }
}
