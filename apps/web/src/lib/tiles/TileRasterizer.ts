import { TERRAIN_FRAG, TERRAIN_VERT } from "@/lib/terrain/terrainShader";
import { TILE_PX } from "./tileMath";

/**
 * Rasteriza un tile del mundi a TILE_PX² con el shader del atlas.
 * Cada nivel de la pirámide se genera a resolución nativa (no se estira un JPG).
 */
export class TileRasterizer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private paintTex: WebGLTexture | null = null;
  private uRes: WebGLUniformLocation | null;
  private uOffset: WebGLUniformLocation | null;
  private uZoom: WebGLUniformLocation | null;
  private uWorld: WebGLUniformLocation | null;
  private uHasPaint: WebGLUniformLocation | null;
  private worldW = 1920;
  private worldH = 911;
  private busy = false;
  private queue: Array<{
    wx: number;
    wy: number;
    ww: number;
    resolve: (bmp: ImageBitmap | null) => void;
  }> = [];

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

  static create(): TileRasterizer | null {
    const canvas = document.createElement("canvas");
    canvas.width = TILE_PX;
    canvas.height = TILE_PX;
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) return null;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error("TileRasterizer shader:", gl.getShaderInfoLog(sh));
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
      console.error("TileRasterizer link:", gl.getProgramInfoLog(program));
      return null;
    }
    const vao = gl.createVertexArray()!;
    const r = new TileRasterizer(canvas, gl, program, vao);
    gl.useProgram(program);
    const uPaint = gl.getUniformLocation(program, "uPaint");
    if (uPaint) gl.uniform1i(uPaint, 0);
    return r;
  }

  setWorldSize(w: number, h: number) {
    this.worldW = w;
    this.worldH = h;
  }

  async loadPaint(url: string): Promise<boolean> {
    const { gl } = this;
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = "anonymous";
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error(url));
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
    } catch (e) {
      console.warn("TileRasterizer paint failed", e);
      return false;
    }
  }

  /** Encola raster de un cuadrado de mundo → ImageBitmap TILE_PX². */
  enqueue(wx: number, wy: number, ww: number): Promise<ImageBitmap | null> {
    return new Promise((resolve) => {
      this.queue.push({ wx, wy, ww, resolve });
      void this.pump();
    });
  }

  private async pump() {
    if (this.busy) return;
    this.busy = true;
    while (this.queue.length) {
      const job = this.queue.shift()!;
      try {
        job.resolve(await this.draw(job.wx, job.wy, job.ww));
      } catch (e) {
        console.warn("tile raster error", e);
        job.resolve(null);
      }
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    this.busy = false;
  }

  private async draw(wx: number, wy: number, ww: number): Promise<ImageBitmap | null> {
    const { gl, canvas } = this;
    const zoom = TILE_PX / ww;
    const offsetX = -wx * zoom;
    const offsetY = -wy * zoom;
    gl.viewport(0, 0, TILE_PX, TILE_PX);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    if (this.paintTex) gl.bindTexture(gl.TEXTURE_2D, this.paintTex);
    gl.uniform2f(this.uRes, TILE_PX, TILE_PX);
    gl.uniform2f(this.uOffset, offsetX, offsetY);
    gl.uniform1f(this.uZoom, zoom);
    gl.uniform2f(this.uWorld, this.worldW, this.worldH);
    gl.uniform1f(this.uHasPaint, this.paintTex ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    try {
      return await createImageBitmap(canvas);
    } catch {
      return null;
    }
  }

  destroy() {
    this.queue.forEach((j) => j.resolve(null));
    this.queue = [];
    const { gl } = this;
    if (this.paintTex) gl.deleteTexture(this.paintTex);
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
