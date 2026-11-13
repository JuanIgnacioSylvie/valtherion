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
 * Rasteriza tiles 512². La cola prioriza el nivel actual y descarta jobs viejos.
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
  private queue: Job[] = [];
  /** Nivel de cámara actual: los jobs de otros niveles se saltan. */
  preferredLevel = 0;

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

  enqueue(
    key: string,
    level: number,
    wx: number,
    wy: number,
    ww: number,
  ): Promise<ImageBitmap | null> {
    return new Promise((resolve) => {
      // Si ya hay un job igual, no duplicar
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
      // Priorizar nivel preferido
      this.queue.sort((a, b) => {
        const da = Math.abs(a.level - this.preferredLevel);
        const db = Math.abs(b.level - this.preferredLevel);
        return da - db;
      });
      void this.pump();
    });
  }

  /** Cancela jobs que no sean del nivel actual (evita cola eterna al zoomear). */
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
      // Saltar si ya no es el nivel preferido
      if (job.level !== this.preferredLevel) {
        job.resolve(null);
        continue;
      }
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

  private copy2d: HTMLCanvasElement | null = null;

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
    // Tiles de nivel alto: nunca muestrear el JPG (zoom = TILE_PX/ww).
    gl.uniform1f(this.uHasPaint, this.paintTex && zoom < 1.75 ? 1 : 0);
    gl.clearColor(0.1, 0.15, 0.2, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish(); // forzar GPU antes del readback
    try {
      // Copia 2D: createImageBitmap directo desde WebGL a veces no resuelve.
      if (!this.copy2d) {
        this.copy2d = document.createElement("canvas");
        this.copy2d.width = TILE_PX;
        this.copy2d.height = TILE_PX;
      }
      const ctx = this.copy2d.getContext("2d")!;
      ctx.clearRect(0, 0, TILE_PX, TILE_PX);
      ctx.drawImage(canvas, 0, 0);
      return await createImageBitmap(this.copy2d);
    } catch (e) {
      console.warn("tile bitmap failed", e);
      return null;
    }
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
