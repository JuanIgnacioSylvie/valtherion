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

  update(camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    const { width, height } = renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector3();
    for (const it of this.items) {
      const since = it.h.desde ?? 1867;
      const until = it.h.hasta ?? 9999;
      const show = this.year >= since && this.year < until;
      if (!show) {
        it.el.style.display = "none";
        continue;
      }
      v.copy(it.world);
      v.project(camera);
      if (v.z > 1) {
        it.el.style.display = "none";
        continue;
      }
      const sx = (v.x * 0.5 + 0.5) * width;
      const sy = (-v.y * 0.5 + 0.5) * height;
      it.el.style.display = "block";
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
