import * as THREE from "three";
import type { PlanoMeta } from "../plano/types";

function blankTex(color = 0xffffff) {
  const data = new Uint8Array([
    (color >> 16) & 255,
    (color >> 8) & 255,
    color & 255,
    255,
  ]);
  const t = new THREE.DataTexture(data, 1, 1);
  t.needsUpdate = true;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/**
 * Uniforms compartidos del shader de ciudad/hitos (como el U del original).
 * Se sincronizan desde el plano, la época y el relieve.
 */
export class CityUniforms {
  readonly U: Record<string, THREE.IUniform>;
  private blank = blankTex(0x808080);
  private blankInk = blankTex(0x404040);

  constructor(meta: PlanoMeta) {
    const ancho = meta.ancho ?? 1;
    const alto = meta.alto ?? 1;
    const marco = meta.marco ?? [0, 0, ancho, alto];
    this.U = {
      tMedio: { value: this.blankInk },
      tFino: { value: [this.blank, this.blank, this.blank, this.blank] },
      uFino: {
        value: [
          new THREE.Vector4(),
          new THREE.Vector4(),
          new THREE.Vector4(),
          new THREE.Vector4(),
        ],
      },
      uFinoOn: { value: [0, 0, 0, 0] },
      uMedioRes: { value: 4 },
      // píxeles del plano (como el original)
      uHoja: { value: new THREE.Vector2(ancho, alto) },
      uPlaza: { value: new THREE.Vector2(meta.plaza[0], meta.plaza[1]) },
      uMetro: { value: meta.metro },
      uFront: { value: 0 },
      // original: ol.y + sl con ol=normalize(.52,.62,.5), sl=.34
      uFlat: { value: 0.9917 },
      uPaper: { value: new THREE.Color("#f7eedb") },
      uInk: { value: new THREE.Color("#2e2620") },
      uSombra: { value: new THREE.Color(0.6, 0.57, 0.6) },
      uColor: { value: 0 },
      tCrece: { value: this.blank },
      tDespeje: { value: this.blank },
      uEpocaK: { value: 0 },
      uEtapas: { value: 6 },
      tRelieve: { value: this.blank },
      uRelieve: { value: 0 },
      tHoyCerca: { value: this.blank },
      tHoyLejos: { value: this.blank },
      uHoy: { value: 0 },
      uHoyRes: { value: 4 },
      uRojo: { value: new THREE.Color("#a03220") },
      tSuelo: { value: this.blank },
      tCalles: { value: this.blank },
      uMarco: {
        value: new THREE.Vector4(
          marco[0] / ancho,
          1 - marco[3] / alto,
          marco[2] / ancho,
          1 - marco[1] / alto,
        ),
      },
      // distancia (m) a partir de la cual se pintan “matas” en pulmones;
      // 0 = apagado. El original usa ~3200–5200 según calidad.
      uMatas: { value: 0 },
      uSobre: { value: new THREE.Vector4(0, 0, 0, 0) },
      uSobreQue: { value: new THREE.Vector4(0, 0, 0, 0) },
      uManto: { value: 0 },
    };
  }

  /** Engancha texturas del PlanoMesh (mismas que el grabado). */
  bindPlanoUniforms(u: { [key: string]: THREE.IUniform }) {
    if (u.tBase?.value) this.U.tMedio!.value = u.tBase.value;
    if (u.tFine?.value) this.U.tFino!.value = u.tFine.value;
    if (u.uFine?.value) this.U.uFino!.value = u.uFine.value;
    if (u.uFineOn?.value) this.U.uFinoOn!.value = u.uFineOn.value;
    if (u.tCrece?.value) this.U.tCrece!.value = u.tCrece.value;
    if (u.tDespeje?.value) this.U.tDespeje!.value = u.tDespeje.value;
    if (u.tSuelo?.value) this.U.tSuelo!.value = u.tSuelo.value;
    if (u.tCalles?.value) this.U.tCalles!.value = u.tCalles.value;
    if (u.uPaper?.value) (this.U.uPaper!.value as THREE.Color).copy(u.uPaper.value);
    if (u.uInk?.value) (this.U.uInk!.value as THREE.Color).copy(u.uInk.value);
  }

  setFront(v: number) {
    this.U.uFront!.value = v;
  }
  setColor(v: number) {
    this.U.uColor!.value = v;
  }
  setEpoca(k: number, etapas = 6) {
    this.U.uEpocaK!.value = k;
    this.U.uEtapas!.value = etapas;
  }
  setRelieve(tex: THREE.Texture | null, amount: number) {
    if (tex) this.U.tRelieve!.value = tex;
    this.U.uRelieve!.value = amount;
  }
  setHoy(on: number) {
    this.U.uHoy!.value = on;
  }
  /** Umbral de matas pintadas en pulmones (metros de cámara). 0 = off. */
  setMatas(meters: number) {
    this.U.uMatas!.value = meters;
  }
}
