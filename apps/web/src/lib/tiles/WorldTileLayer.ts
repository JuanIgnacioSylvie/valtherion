import { Container, Sprite, Texture } from "pixi.js";
import {
  TILE_LEVEL_MAX,
  levelForZoom,
  tileBounds,
  tileKey,
  visibleTiles,
} from "./tileMath";
import { TileRasterizer } from "./TileRasterizer";

type CacheEntry = {
  sprite: Sprite;
  level: number;
  x: number;
  y: number;
  lastUsed: number;
};

const CACHE_MAX = 96;

/**
 * Capa de pirámide de tiles del mundi.
 * Raster on-demand (GPU) → cada nivel tiene píxeles propios = sin estirar el JPG.
 */
export class WorldTileLayer {
  readonly root = new Container();
  private ras: TileRasterizer;
  private worldW: number;
  private worldH: number;
  private cache = new Map<string, CacheEntry>();
  private loading = new Set<string>();
  private currentLevel = 0;
  private destroyed = false;

  private constructor(ras: TileRasterizer, worldW: number, worldH: number) {
    this.ras = ras;
    this.worldW = worldW;
    this.worldH = worldH;
    this.root.eventMode = "none";
  }

  static async create(
    worldW: number,
    worldH: number,
    paintUrl: string,
  ): Promise<WorldTileLayer | null> {
    const ras = TileRasterizer.create();
    if (!ras) return null;
    ras.setWorldSize(worldW, worldH);
    await ras.loadPaint(paintUrl);
    return new WorldTileLayer(ras, worldW, worldH);
  }

  /**
   * Actualiza tiles visibles.
   * stageOffset/zoom = stage.position / stage.scale de Pixi (px CSS).
   * viewW/viewH = tamaño del viewport CSS.
   */
  sync(stageOffsetX: number, stageOffsetY: number, zoom: number, viewW: number, viewH: number) {
    if (this.destroyed || zoom <= 0) return;
    const level = Math.min(TILE_LEVEL_MAX, levelForZoom(zoom, this.worldW));
    this.currentLevel = level;

    const left = -stageOffsetX / zoom;
    const top = -stageOffsetY / zoom;
    const right = left + viewW / zoom;
    const bottom = top + viewH / zoom;

    const needed = visibleTiles(
      this.worldW,
      this.worldH,
      level,
      { left, top, right, bottom },
      1,
    );
    const neededKeys = new Set(needed.map((t) => tileKey(level, t.x, t.y)));
    const now = performance.now();

    for (const { x, y } of needed) {
      const key = tileKey(level, x, y);
      const hit = this.cache.get(key);
      if (hit) {
        hit.lastUsed = now;
        hit.sprite.visible = true;
        continue;
      }
      if (this.loading.has(key)) continue;
      this.loading.add(key);
      const b = tileBounds(this.worldW, level, x, y);
      void this.ras.enqueue(b.wx, b.wy, b.ww).then((bmp) => {
        this.loading.delete(key);
        if (this.destroyed || !bmp) {
          bmp?.close();
          return;
        }
        // Si el nivel ya cambió, igual cacheamos por si vuelve.
        const texture = Texture.from(bmp);
        const sprite = new Sprite(texture);
        sprite.x = b.wx;
        sprite.y = b.wy;
        sprite.width = b.ww;
        sprite.height = b.wh;
        sprite.visible = this.currentLevel === level;
        this.root.addChild(sprite);
        this.cache.set(key, { sprite, level, x, y, lastUsed: performance.now() });
        this.evict();
      });
    }

    // Ocultar tiles de otros niveles / fuera de vista
    for (const [key, entry] of this.cache) {
      const show = entry.level === level && neededKeys.has(key);
      entry.sprite.visible = show;
      if (show) entry.lastUsed = now;
    }
  }

  private evict() {
    if (this.cache.size <= CACHE_MAX) return;
    const entries = [...this.cache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const drop = entries.slice(0, Math.max(0, this.cache.size - CACHE_MAX));
    for (const [key, entry] of drop) {
      if (entry.sprite.visible) continue;
      this.root.removeChild(entry.sprite);
      entry.sprite.texture.destroy(true);
      entry.sprite.destroy();
      this.cache.delete(key);
    }
  }

  destroy() {
    this.destroyed = true;
    for (const entry of this.cache.values()) {
      entry.sprite.texture.destroy(true);
      entry.sprite.destroy();
    }
    this.cache.clear();
    this.ras.destroy();
    this.root.destroy({ children: true });
  }
}
