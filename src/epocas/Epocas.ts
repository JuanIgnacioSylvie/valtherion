export type Epoca = {
  año: number;
  titulo: string;
  corto: string;
  obras?: string;
};

export class EpocasController {
  epocas: Epoca[] = [];
  /** 0 = 1867 … N */
  index = 0;
  /** interpolado para shaders / filtrado */
  k = 0;
  playing = false;
  private acc = 0;

  async load() {
    try {
      const j = await fetch("/datos/epocas.json").then((r) => r.json());
      this.epocas = j.epocas ?? [];
    } catch {
      this.epocas = [{ año: 1867, titulo: "Glade", corto: "1867" }];
    }
  }

  get current() {
    return this.epocas[this.index] ?? this.epocas[0];
  }

  setIndex(i: number) {
    this.index = THREE_CLAMP(i, 0, Math.max(0, this.epocas.length - 1));
    this.k = this.index;
  }

  togglePlay() {
    this.playing = !this.playing;
  }

  update(dt: number) {
    if (!this.playing || this.epocas.length < 2) return;
    this.acc += dt;
    if (this.acc > 2.2) {
      this.acc = 0;
      if (this.index >= this.epocas.length - 1) {
        this.index = 0;
        this.playing = false;
      } else {
        this.index++;
      }
    }
    this.k = THREE_CLAMP(
      THREE_DAMP(this.k, this.index, 2.5, dt),
      0,
      this.epocas.length - 1,
    );
  }
}

function THREE_CLAMP(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}
function THREE_DAMP(cur: number, tar: number, lambda: number, dt: number) {
  return THREE_CLAMP(cur + (tar - cur) * (1 - Math.exp(-lambda * dt)), -1e9, 1e9);
}
