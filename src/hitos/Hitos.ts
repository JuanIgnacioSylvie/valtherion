import * as THREE from "three";
import { pxToWorld } from "../plano/coords";
import type { PlanoMeta } from "../plano/types";

export type Hito = {
  nombre: string;
  x: number;
  y: number;
  nivel?: number;
  nota?: string;
  rio?: boolean;
  desde?: number;
  hasta?: number;
};

export class HitosLayer {
  readonly root = document.createElement("div");
  private items: { el: HTMLElement; h: Hito; world: THREE.Vector3 }[] = [];
  private meta: PlanoMeta;
  year = 1867;
  onGo?: (x: number, z: number) => void;

  constructor(meta: PlanoMeta) {
    this.meta = meta;
    this.root.id = "hitos";
    document.body.appendChild(this.root);
  }

  async load() {
    try {
      const list = (await fetch("/datos/hoy.json").then((r) => r.json())) as Hito[];
      for (const h of list) {
        const [x, z] = pxToWorld(this.meta, h.x, h.y);
        const el = document.createElement("button");
        el.type = "button";
        el.className = "hito";
        el.innerHTML = `<span class="punto"></span><span class="tag"><b>${escapeHtml(h.nombre)}</b>${
          h.nota ? `<i>${escapeHtml(h.nota)}</i>` : ""
        }</span>`;
        el.addEventListener("click", () => this.onGo?.(x, z));
        this.root.appendChild(el);
        this.items.push({ el, h, world: new THREE.Vector3(x, 0, z) });
      }
    } catch {
      /* */
    }
  }

  setYear(y: number) {
    this.year = y;
  }

  /** Referencias (nivel 1) vigentes para el año — para el panel lateral. */
  refsForYear(year = this.year): Hito[] {
    return this.items
      .map((it) => it.h)
      .filter((h) => (h.nivel ?? 2) === 1 && year >= (h.desde ?? 1867) && year < (h.hasta ?? 9999));
  }

  update(camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    const { width, height } = renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    const boxes: [number, number, number, number][] = [];

    const ordered = [
      ...this.items.filter((it) => (it.h.nivel ?? 2) === 1),
      ...this.items.filter((it) => (it.h.nivel ?? 2) !== 1),
    ];

    for (const it of ordered) {
      const since = it.h.desde ?? 1867;
      const until = it.h.hasta ?? 9999;
      const inYear = this.year >= since && this.year < until;
      const nivel = it.h.nivel ?? 2;
      // distancia cámara → hito (no |cam| al origen)
      const dist = camPos.distanceTo(it.world);
      const nearOk =
        nivel === 1
          ? dist < 14000
          : dist < (nivel === 2 ? 2200 : 900);
      if (!inYear || !nearOk) {
        it.el.style.display = "none";
        continue;
      }
      v.copy(it.world);
      v.y = 6;
      v.project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.08 || Math.abs(v.y) > 1.08) {
        it.el.style.display = "none";
        continue;
      }
      const sx = (v.x * 0.5 + 0.5) * width;
      const sy = (-v.y * 0.5 + 0.5) * height;
      const isRef = nivel === 1;
      const pad = 6;
      const w = isRef ? 120 : 170;
      const h = isRef ? 28 : 48;
      const box: [number, number, number, number] = [
        sx - w / 2 - pad,
        sy - 36 - h - pad,
        sx + w / 2 + pad,
        sy + pad,
      ];
      const overlap = boxes.some(
        (b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1],
      );
      // refs también se ocultan si se pisan (salvo el primero)
      if (overlap) {
        it.el.style.display = "none";
        continue;
      }
      boxes.push(box);
      it.el.style.display = "block";
      it.el.classList.toggle("ref", isRef);
      // anclar el punto rojo al mundo; el tag cuelga abajo-derecha
      it.el.style.transform = `translate(${sx}px, ${sy}px)`;
    }
  }

  dispose() {
    this.root.remove();
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}
