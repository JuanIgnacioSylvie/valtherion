import * as THREE from "three";
import type { MesaControls } from "../scene/MesaControls";

export type Modo = "mapa" | "caminar" | "avion" | "auto";

type Keys = Record<string, boolean>;

/**
 * Modos de exploración. Mapa = MesaControls; el resto toma la cámara.
 */
export class Modos {
  modo: Modo = "mapa";
  private keys: Keys = {};
  private yaw = 0;
  private pitch = 0.15;
  private vehicle = new THREE.Group();
  private body: THREE.Mesh;
  private speed = 0;

  private camera: THREE.PerspectiveCamera;
  private controls: MesaControls;

  constructor(
    camera: THREE.PerspectiveCamera,
    controls: MesaControls,
    scene: THREE.Scene,
  ) {
    this.camera = camera;
    this.controls = controls;
    const mat = new THREE.MeshStandardMaterial({ color: "#3a2a1c", roughness: 0.8 });
    this.body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 4.2), mat);
    this.body.position.y = 0.7;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.9, 2.0),
      new THREE.MeshStandardMaterial({ color: "#6a5040" }),
    );
    cabin.position.set(0, 1.4, -0.3);
    this.vehicle.add(this.body, cabin);
    this.vehicle.visible = false;
    scene.add(this.vehicle);

    addEventListener("keydown", this.onDown);
    addEventListener("keyup", this.onUp);
  }

  private onDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
  };
  private onUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  setModo(m: Modo) {
    this.modo = m;
    const play = m !== "mapa";
    this.controls.enabled = !play;
    this.vehicle.visible = m === "auto";
    if (m === "caminar" || m === "avion" || m === "auto") {
      const t = this.controls.target;
      this.vehicle.position.set(t.x, 0, t.z);
      this.yaw = Math.atan2(
        this.camera.position.x - t.x,
        this.camera.position.z - t.z,
      );
      if (m === "caminar") {
        this.camera.position.set(t.x, 1.7, t.z);
        this.pitch = 0.05;
      } else if (m === "avion") {
        this.camera.position.set(t.x, 280, t.z + 40);
        this.pitch = 0.55;
      } else {
        this.camera.position.set(t.x, 3.5, t.z + 8);
        this.pitch = 0.12;
      }
    }
  }

  update(dt: number) {
    if (this.modo === "mapa") return;

    const turn =
      (this.keys["ArrowLeft"] || this.keys["KeyA"] ? 1 : 0) -
      (this.keys["ArrowRight"] || this.keys["KeyD"] ? 1 : 0);
    const fwd =
      (this.keys["ArrowUp"] || this.keys["KeyW"] ? 1 : 0) -
      (this.keys["ArrowDown"] || this.keys["KeyS"] ? 1 : 0);

    this.yaw += turn * dt * (this.modo === "avion" ? 1.1 : 1.8);

    if (this.modo === "caminar") {
      const sp = 22 * dt * fwd;
      this.camera.position.x += Math.sin(this.yaw) * sp;
      this.camera.position.z += Math.cos(this.yaw) * sp;
      this.camera.position.y = 1.7;
      const look = new THREE.Vector3(
        this.camera.position.x + Math.sin(this.yaw),
        1.7 - this.pitch,
        this.camera.position.z + Math.cos(this.yaw),
      );
      this.camera.lookAt(look);
      this.controls.target.copy(this.camera.position);
    } else if (this.modo === "avion") {
      const sp = 120 * dt * (fwd === 0 ? 0.35 : fwd > 0 ? 1 : -0.4);
      this.camera.position.x += Math.sin(this.yaw) * sp;
      this.camera.position.z += Math.cos(this.yaw) * sp;
      if (this.keys["KeyR"]) this.camera.position.y += 60 * dt;
      if (this.keys["KeyF"]) this.camera.position.y -= 60 * dt;
      this.camera.position.y = THREE.MathUtils.clamp(this.camera.position.y, 40, 2500);
      const look = new THREE.Vector3(
        this.camera.position.x + Math.sin(this.yaw) * 20,
        this.camera.position.y - 12,
        this.camera.position.z + Math.cos(this.yaw) * 20,
      );
      this.camera.lookAt(look);
      this.controls.target.set(this.camera.position.x, 0, this.camera.position.z);
    } else if (this.modo === "auto") {
      const accel = fwd * 28;
      this.speed = THREE.MathUtils.damp(this.speed, accel, 3, dt);
      this.vehicle.rotation.y = this.yaw;
      this.vehicle.position.x += Math.sin(this.yaw) * this.speed * dt;
      this.vehicle.position.z += Math.cos(this.yaw) * this.speed * dt;
      const back = 9;
      this.camera.position.set(
        this.vehicle.position.x - Math.sin(this.yaw) * back,
        4.2,
        this.vehicle.position.z - Math.cos(this.yaw) * back,
      );
      this.camera.lookAt(
        this.vehicle.position.x,
        1.2,
        this.vehicle.position.z,
      );
      this.controls.target.copy(this.vehicle.position);
    }
  }

  dispose() {
    removeEventListener("keydown", this.onDown);
    removeEventListener("keyup", this.onUp);
    this.body.geometry.dispose();
    (this.body.material as THREE.Material).dispose();
  }
}
