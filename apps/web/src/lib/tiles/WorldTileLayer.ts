import { Container, Sprite, Texture } from "pixi.js";

export type TilesManifest = {
  version: number;
  model?: string;
  worldWidth: number;
  worldHeight: number;
  imageWidth: number;
  imageHeight: number;
  tileSize: number;
  minLevel: number;
  maxLevel: number;
  format: string;
  urlTemplate: string;
  /** Zoom Pixi absoluto (px pantalla / u mundo) ≈ 1:1 con el paint */
  nativeZoom: number;
  levels: Array<{ z: number; cols: number; rows: number; imageWidth: number; imageHeight: number }>;
};

type CacheEntry = {
  sprite: Sprite;
  level: number;
  x: number;
  y: number;
  lastUsed: number;
};

const CACHE_MAX = 100;
const LOAD_CONCURRENCY = 4;

async function loadTileTexture(url: string): Promise<Texture> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tile HTTP ${res.status}: ${url}`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("2d context unavailable");
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return Texture.from(canvas);
}

/**
 * Viewer DZI (Zomboid): una pirámide desde una imagen.
 * Tiles en espacio imagen → colocados en coords de mundo.
 */
export class WorldTileLayer {
  readonly root = new Container();
  readonly manifest: TilesManifest;
  private worldW: number;
  private worldH: number;
  private cache = new Map<string, CacheEntry>();
  private loading = new Set<string>();
  private queue: string[] = [];
  private inFlight = 0;
  private currentLevel = 0;
  private loadGen = 0;
  private destroyed = false;
  coverage = 0;
  private levelInfo: Map<number, { cols: number; rows: number; imageWidth: number; imageHeight: number }>;

  private constructor(worldW: number, worldH: number, manifest: TilesManifest) {
    this.worldW = worldW;
    this.worldH = worldH;
    this.manifest = manifest;
    this.levelInfo = new Map(manifest.levels.map((l) => [l.z, l]));
    this.root.eventMode = "none";
    this.root.sortableChildren = true;
  }

  static async create(worldW: number, worldH: number): Promise<WorldTileLayer | null> {
    try {
      const res = await fetch(`/worlds/valtherion/tiles/tiles.json?t=${Date.now()}`);
      if (!res.ok) {
        console.error("tiles.json missing — run: pnpm map:build");
        return null;
      }
      const manifest = (await res.json()) as TilesManifest;
      if (manifest.version < 3 || !manifest.imageWidth || !manifest.levels?.length) {
        console.error("tiles.json outdated — run: pnpm map:build", manifest);
        return null;
      }
      return new WorldTileLayer(worldW, worldH, manifest);
    } catch (e) {
      console.error("WorldTileLayer create failed", e);
      return null;
    }
  }

  get level() {
    return this.currentLevel;
  }

  get maxLevel() {
    return this.manifest.maxLevel;
  }

  /** Zoom Pixi absoluto tope mundi (1 px pantalla ≈ 1 px paint). */
  get nativeZoom() {
    return this.manifest.nativeZoom;
  }

  private url(z: number, x: number, y: number) {
    return this.manifest.urlTemplate
      .replace("{z}", String(z))
      .replace("{x}", String(x))
      .replace("{y}", String(y));
  }

  private key(z: number, x: number, y: number) {
    return `${z}/${x}_${y}`;
  }

  /** Nivel DZI según zoom actual (con histéresis para no oscilar). */
  private levelForZoom(zoom: number): number {
    const { maxLevel, nativeZoom, minLevel } = this.manifest;
    if (zoom <= 0 || nativeZoom <= 0) return minLevel;
    // z = maxLevel - log2(nativeZoom / zoom)
    const raw = maxLevel - Math.log2(Math.max(nativeZoom / zoom, 1e-6));
    const rounded = Math.max(minLevel, Math.min(maxLevel, Math.round(raw)));
    // Quedarse en el nivel actual si el raw está cerca (±0.35)
    if (
      Math.abs(raw - this.currentLevel) < 0.35 &&
      this.currentLevel >= minLevel &&
      this.currentLevel <= maxLevel
    ) {
      return this.currentLevel;
    }
    return rounded;
  }

  /** Bounds en mundo de un tile DZI. */
  private tileWorldBounds(z: number, tx: number, ty: number) {
    const info = this.levelInfo.get(z)!;
    const { imageWidth: srcW, imageHeight: srcH, tileSize: T } = this.manifest;
    const scale = 2 ** (this.manifest.maxLevel - z); // source-px per level-px
    const imgX0 = tx * T * scale;
    const imgY0 = ty * T * scale;
    const imgX1 = Math.min(srcW, (tx + 1) * T * scale);
    const imgY1 = Math.min(srcH, (ty + 1) * T * scale);
    return {
      wx: (imgX0 / srcW) * this.worldW,
      wy: (imgY0 / srcH) * this.worldH,
      ww: ((imgX1 - imgX0) / srcW) * this.worldW,
      wh: ((imgY1 - imgY0) / srcH) * this.worldH,
      cols: info.cols,
      rows: info.rows,
    };
  }

  private visibleTileIndices(
    z: number,
    view: { left: number; top: number; right: number; bottom: number },
    pad: number,
  ) {
    const info = this.levelInfo.get(z);
    if (!info) return [] as Array<{ x: number; y: number }>;
    const { imageWidth: srcW, imageHeight: srcH, tileSize: T } = this.manifest;
    const scale = 2 ** (this.manifest.maxLevel - z);

    const imgL = (view.left / this.worldW) * srcW;
    const imgT = (view.top / this.worldH) * srcH;
    const imgR = (view.right / this.worldW) * srcW;
    const imgB = (view.bottom / this.worldH) * srcH;

    const x0 = Math.max(0, Math.floor(imgL / (T * scale)) - pad);
    const y0 = Math.max(0, Math.floor(imgT / (T * scale)) - pad);
    const x1 = Math.min(info.cols - 1, Math.floor(imgR / (T * scale)) + pad);
    const y1 = Math.min(info.rows - 1, Math.floor(imgB / (T * scale)) + pad);

    const out: Array<{ x: number; y: number }> = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) out.push({ x, y });
    }
    return out;
  }

  private enqueue(key: string, level: number, x: number, y: number) {
    if (this.loading.has(key) || this.cache.has(key)) return;
    this.loading.add(key);
    this.queue.push(JSON.stringify({ key, level, x, y, gen: this.loadGen }));
  }

  private pump() {
    while (this.inFlight < LOAD_CONCURRENCY && this.queue.length > 0 && !this.destroyed) {
      const raw = this.queue.shift();
      if (!raw) break;
      const { key, level, x, y, gen } = JSON.parse(raw) as {
        key: string;
        level: number;
        x: number;
        y: number;
        gen: number;
      };
      if (gen !== this.loadGen || this.cache.has(key)) {
        this.loading.delete(key);
        continue;
      }
      this.inFlight++;
      const b = this.tileWorldBounds(level, x, y);
      const src = this.url(level, x, y);
      const genAtStart = this.loadGen;
      void loadTileTexture(src)
        .then((texture) => {
          if (this.destroyed || genAtStart !== this.loadGen || this.cache.has(key)) {
            texture.destroy(true);
            return;
          }
          const sprite = new Sprite(texture);
          sprite.x = b.wx;
          sprite.y = b.wy;
          sprite.width = b.ww;
          sprite.height = b.wh;
          sprite.zIndex = level;
          sprite.visible = level === this.currentLevel;
          this.root.addChild(sprite);
          this.cache.set(key, { sprite, level, x, y, lastUsed: performance.now() });
          this.evict();
        })
        .catch((err) => console.warn(err))
        .finally(() => {
          this.inFlight--;
          this.loading.delete(key);
          this.pump();
        });
    }
  }

  sync(stageOffsetX: number, stageOffsetY: number, zoom: number, viewW: number, viewH: number) {
    if (this.destroyed || zoom <= 0) return;

    const level = this.levelForZoom(zoom);
    if (level !== this.currentLevel) {
      // Nueva generación: descartar cola vieja (tiles de otro nivel/vista).
      this.loadGen++;
      this.queue.length = 0;
      this.loading.clear();
    }
    this.currentLevel = level;

    const left = -stageOffsetX / zoom;
    const top = -stageOffsetY / zoom;
    const view = {
      left,
      top,
      right: left + viewW / zoom,
      bottom: top + viewH / zoom,
    };

    const needed = this.visibleTileIndices(level, view, 1);
    const neededKeys = new Set(needed.map((t) => this.key(level, t.x, t.y)));
    const now = performance.now();

    // Cola = solo lo visible ahora (nada de tiles de otra vista/nivel).
    this.queue.length = 0;
    let ready = 0;
    for (const { x, y } of needed) {
      const k = this.key(level, x, y);
      const hit = this.cache.get(k);
      if (hit) {
        hit.lastUsed = now;
        hit.sprite.visible = true;
        ready++;
        continue;
      }
      if (!this.loading.has(k)) {
        this.enqueue(k, level, x, y);
      } else {
        // Ya en vuelo / pendiente: reinsertar en cola sin tocar loading
        this.queue.push(JSON.stringify({ key: k, level, x, y, gen: this.loadGen }));
      }
    }
    this.pump();

    this.coverage = needed.length === 0 ? 1 : ready / needed.length;

    const showParent = this.coverage < 0.95 && level > this.manifest.minLevel;
    const parentLevel = level - 1;

    for (const [k, entry] of this.cache) {
      let show = false;
      if (entry.level === level) {
        show = neededKeys.has(k);
      } else if (showParent && entry.level === parentLevel) {
        const b = this.tileWorldBounds(entry.level, entry.x, entry.y);
        show = !(
          b.wx + b.ww < view.left ||
          b.wx > view.right ||
          b.wy + b.wh < view.top ||
          b.wy > view.bottom
        );
      }
      entry.sprite.visible = show;
      entry.sprite.zIndex = entry.level;
      if (show) entry.lastUsed = now;
    }

  }

  private evict() {
    if (this.cache.size <= CACHE_MAX) return;
    const entries = [...this.cache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [key, entry] of entries) {
      if (this.cache.size <= CACHE_MAX) break;
      if (entry.sprite.visible) continue;
      this.root.removeChild(entry.sprite);
      entry.sprite.destroy({ texture: true, textureSource: true });
      this.cache.delete(key);
    }
  }

  destroy() {
    this.destroyed = true;
    this.queue.length = 0;
    for (const entry of this.cache.values()) {
      entry.sprite.destroy({ texture: true, textureSource: true });
    }
    this.cache.clear();
    this.root.destroy({ children: true });
  }
}
