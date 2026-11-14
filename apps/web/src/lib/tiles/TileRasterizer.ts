import { TERRAIN_FRAG, TERRAIN_VERT } from "@/lib/terrain/terrainShader";
import { TILE_PX } from "./tileMath";

type Job = {
  key: string;
  level: number;
  wx: number;
  wy: number;
  ww: number;
  resolve: (bmp: ImageBitmap | null) => void;
  cancelled: boolean;
};

/**
 * Rasteriza un tile de la pirámide (como pzmap2d → DZI).
 * Regla simple:
 *  - nivel ≤ 2: puede usar el mapa pintado (overview)
 *  - nivel ≥ 3: solo procedural (el tile TRAE el detalle; no se estira un JPG)
 */
export class TileRasterizer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private paintTex: WebGLTexture | null = null;
  private copy2d: HTMLCanvasElement;
  private uRes: WebGLUniformLocation | null;
  private uOffset: WebGLUniformLocation | null;
  private uZoom: WebGLUniformLocation | null;
  private uWorld: WebGLUniformLocation | null;
  private uHasPaint: WebGLUniformLocation | null;
  private worldW = 1920;
  private worldH = 911;
  private busy = false;
  private queue: Job[] = [];
  preferredLevel = 0;
  /** Niveles que pueden muestrear el paint. */
  static readonly PAINT_MAX_LEVEL = 2;

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
    this.copy2d = document.createElement("canvas");
    this.copy2d.width = TILE_PX;
    this.copy2d.height = TILE_PX;
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

  enqueue(key: string, level: number, wx: number, wy: number, ww: number): Promise<ImageBitmap | null> {
    return new Promise((resolve) => {
      const existing = this.queue.find((j) => j.key === key && !j.cancelled);
      if (existing) {
        const prev = existing.resolve;
        existing.resolve = (b) => {
          prev(b);
          resolve(b);
        };
        return;
      }
      this.queue.push({ key, level, wx, wy, ww, resolve, cancelled: false });
      this.queue.sort(
        (a, b) => Math.abs(a.level - this.preferredLevel) - Math.abs(b.level - this.preferredLevel),
      );
      void this.pump();
    });
  }

  cancelOtherLevels(level: number) {
    this.preferredLevel = level;
    for (const j of this.queue) {
      if (j.level !== level) {
        j.cancelled = true;
        j.resolve(null);
      }
    }
    this.queue = this.queue.filter((j) => !j.cancelled);
  }

  private async pump() {
    if (this.busy) return;
    this.busy = true;
    while (this.queue.length) {
      const job = this.queue.shift()!;
      if (job.cancelled) continue;
      if (job.level !== this.preferredLevel) {
        job.resolve(null);
        continue;
      }
      try {
        job.resolve(await this.draw(job.level, job.wx, job.wy, job.ww));
      } catch (e) {
        console.warn("tile raster error", e);
        job.resolve(null);
      }
      // Hasta 2 tiles por frame para no congelar el UI
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    this.busy = false;
  }

  private async draw(level: number, wx: number, wy: number, ww: number): Promise<ImageBitmap | null> {
    const { gl, canvas } = this;
    const zoom = TILE_PX / ww;
    const offsetX = -wx * zoom;
    const offsetY = -wy * zoom;
    const usePaint = !!this.paintTex && level <= TileRasterizer.PAINT_MAX_LEVEL;

    gl.viewport(0, 0, TILE_PX, TILE_PX);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    if (this.paintTex) gl.bindTexture(gl.TEXTURE_2D, this.paintTex);
    gl.uniform2f(this.uRes, TILE_PX, TILE_PX);
    gl.uniform2f(this.uOffset, offsetX, offsetY);
    gl.uniform1f(this.uZoom, zoom);
    gl.uniform2f(this.uWorld, this.worldW, this.worldH);
    gl.uniform1f(this.uHasPaint, usePaint ? 1 : 0);
    gl.clearColor(0.12, 0.18, 0.28, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();

    const ctx = this.copy2d.getContext("2d")!;
    ctx.clearRect(0, 0, TILE_PX, TILE_PX);
    ctx.drawImage(canvas, 0, 0);
    return createImageBitmap(this.copy2d);
  }

  destroy() {
    this.queue.forEach((j) => {
      j.cancelled = true;
      j.resolve(null);
    });
    this.queue = [];
    const { gl } = this;
    if (this.paintTex) gl.deleteTexture(this.paintTex);
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
