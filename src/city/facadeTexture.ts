import * as THREE from "three";

/** Textura procedural: muro blanco + ventanas/puerta/zócalo (se multiplica por instanceColor). */
export function makeFacadeTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  // muro base (blanco → toma color de instancia)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  // zócalo
  ctx.fillStyle = "#c8c8c8";
  ctx.fillRect(0, size * 0.86, size, size * 0.14);

  // cornisa
  ctx.fillStyle = "#ececec";
  ctx.fillRect(0, 0, size, size * 0.08);

  const cols = 3;
  const rows = 3;
  const padX = size * 0.08;
  const padY = size * 0.12;
  const cellW = (size - padX * 2) / cols;
  const cellH = (size * 0.78 - padY) / rows;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = padX + col * cellW + cellW * 0.18;
      const y = padY + row * cellH + cellH * 0.2;
      const w = cellW * 0.64;
      const h = cellH * 0.55;
      // marco
      ctx.fillStyle = "#9a9a9a";
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      // vidrio
      ctx.fillStyle = "#5a6e7a";
      ctx.fillRect(x, y, w, h);
      // cruce
      ctx.fillStyle = "#b0b0b0";
      ctx.fillRect(x + w * 0.45, y, 2, h);
      ctx.fillRect(x, y + h * 0.45, w, 2);
    }
  }

  // puerta planta baja
  const dw = size * 0.16;
  const dh = size * 0.22;
  const dx = size * 0.5 - dw * 0.5;
  const dy = size * 0.78;
  ctx.fillStyle = "#6a4a35";
  ctx.fillRect(dx, dy, dw, dh);
  ctx.fillStyle = "#3a2818";
  ctx.fillRect(dx + dw * 0.15, dy + dh * 0.15, dw * 0.7, dh * 0.7);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function makeRoofTileTexture(): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1;
  for (let y = 0; y < size; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
    for (let x = (y / 8) % 2 === 0 ? 0 : 8; x < size; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 8);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}
