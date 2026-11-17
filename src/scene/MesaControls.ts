import * as THREE from "three";

export type MesaGoal = {
  x: number;
  z: number;
  dist: number;
  yaw: number;
  pitch: number;
};

/**
 * Cámara tipo mesa del original: rueda acerca al cursor, drag izq pan,
 * derecho/shift gira, pitch automático según distancia.
 */
export class MesaControls {
  readonly goal: MesaGoal;
  readonly now: MesaGoal;
  /** Punto mirado en el plano (compat App/Modos). */
  readonly target = new THREE.Vector3();
  autoPitch = true;
  enabled = true;

  private camera: THREE.PerspectiveCamera;
  private dom: HTMLElement;
  private bounds: [number, number, number, number];
  private far: number;
  private pointers = new Map<number, { x: number; y: number }>();
  private panHit: THREE.Vector3 | null = null;
  private rotating = false;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private hit = new THREE.Vector3();
  private inertia: { vx: number; vz: number } | null = null;
  private panTrail: { t: number; x: number; z: number }[] = [];
  private fly: { from: MesaGoal; to: MesaGoal; t: number; secs: number } | null =
    null;
  private keys = new Set<string>();
  private onContext: (e: Event) => void;
  private onDown: (e: PointerEvent) => void;
  private onMove: (e: PointerEvent) => void;
  private onUp: (e: PointerEvent) => void;
  private onWheel: (e: WheelEvent) => void;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onBlur: () => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    dom: HTMLElement,
    opts?: { bounds?: [number, number, number, number]; far?: number },
  ) {
    this.camera = camera;
    this.dom = dom;
    this.far = opts?.far ?? 9000;
    this.bounds = opts?.bounds ?? [-6000, -6000, 6000, 6000];
    this.goal = { x: 0, z: 0, dist: this.far, yaw: 0, pitch: Math.PI / 2 };
    this.now = { ...this.goal };
    this.target.set(0, 0, 0);

    this.onContext = (e) => e.preventDefault();
    this.onDown = (e) => this.pointerDown(e);
    this.onMove = (e) => this.pointerMove(e);
    this.onUp = (e) => this.pointerUp(e);
    this.onWheel = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.inertia = null;
      const k = Math.exp(
        this.clamp(e.deltaY, -240, 240) * (e.ctrlKey ? 0.008 : 0.0016),
      );
      this.zoomAt(k, e.clientX, e.clientY);
    };
    this.onKeyDown = (e) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      this.keys.add(e.code);
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onBlur = () => this.keys.clear();

    dom.addEventListener("contextmenu", this.onContext);
    dom.addEventListener("pointerdown", this.onDown);
    dom.addEventListener("pointermove", this.onMove);
    dom.addEventListener("pointerup", this.onUp);
    dom.addEventListener("pointercancel", this.onUp);
    dom.addEventListener("wheel", this.onWheel, { passive: false });
    addEventListener("keydown", this.onKeyDown);
    addEventListener("keyup", this.onKeyUp);
    addEventListener("blur", this.onBlur);

    this.apply(this.now);
  }

  /** Compat OrbitControls-ish API usada por App/Modos */
  get object() {
    return this.camera;
  }

  update(dt = 1 / 60) {
    // sync target → goal (App/Modos escriben target)
    if (
      Math.abs(this.target.x - this.goal.x) > 1e-4 ||
      Math.abs(this.target.z - this.goal.z) > 1e-4
    ) {
      this.goal.x = this.target.x;
      this.goal.z = this.target.z;
      this.clampGoal();
    }

    if (!this.enabled) {
      this.apply(this.now);
      return;
    }

    if (this.fly) {
      this.fly.t += dt / this.fly.secs;
      const u = Math.min(1, this.fly.t);
      const e = u * u * (3 - 2 * u);
      this.goal.x = this.fly.from.x + (this.fly.to.x - this.fly.from.x) * e;
      this.goal.z = this.fly.from.z + (this.fly.to.z - this.fly.from.z) * e;
      this.goal.dist =
        this.fly.from.dist + (this.fly.to.dist - this.fly.from.dist) * e;
      this.goal.yaw =
        this.fly.from.yaw + (this.fly.to.yaw - this.fly.from.yaw) * e;
      this.goal.pitch =
        this.fly.from.pitch + (this.fly.to.pitch - this.fly.from.pitch) * e;
      if (u >= 1) this.fly = null;
      this.clampGoal();
    }

    const sp = this.goal.dist * 0.55 * dt;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) this.goal.z -= sp;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) this.goal.z += sp;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) this.goal.x -= sp;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) this.goal.x += sp;
    if (this.keys.size) this.clampGoal();

    if (this.inertia && !this.pointers.size) {
      this.goal.x += this.inertia.vx * dt;
      this.goal.z += this.inertia.vz * dt;
      this.inertia.vx *= Math.exp(-dt * 4.2);
      this.inertia.vz *= Math.exp(-dt * 4.2);
      if (Math.hypot(this.inertia.vx, this.inertia.vz) < this.goal.dist * 0.02) {
        this.inertia = null;
      }
      this.clampGoal();
    }

    const k = 1 - Math.exp(-dt * 10);
    this.now.x += (this.goal.x - this.now.x) * k;
    this.now.z += (this.goal.z - this.now.z) * k;
    this.now.dist += (this.goal.dist - this.now.dist) * k;
    this.now.yaw += (this.goal.yaw - this.now.yaw) * k;
    this.now.pitch += (this.goal.pitch - this.now.pitch) * k;
    this.target.set(this.goal.x, 0, this.goal.z);
    this.apply(this.now);
  }

  flyTo(partial: Partial<MesaGoal>, secs = 2.4) {
    this.inertia = null;
    const to = { ...this.goal, ...partial };
    if (partial.pitch != null) this.autoPitch = false;
    else if (this.autoPitch && partial.dist != null) {
      to.pitch = this.pitchForDist(to.dist);
    }
    this.fly = { from: { ...this.goal }, to, t: 0, secs };
  }

  jump(partial: Partial<MesaGoal>) {
    this.inertia = null;
    this.fly = null;
    Object.assign(this.goal, partial);
    this.clampGoal();
    Object.assign(this.now, this.goal);
    this.apply(this.now);
  }

  dispose() {
    this.dom.removeEventListener("contextmenu", this.onContext);
    this.dom.removeEventListener("pointerdown", this.onDown);
    this.dom.removeEventListener("pointermove", this.onMove);
    this.dom.removeEventListener("pointerup", this.onUp);
    this.dom.removeEventListener("pointercancel", this.onUp);
    this.dom.removeEventListener("wheel", this.onWheel);
    removeEventListener("keydown", this.onKeyDown);
    removeEventListener("keyup", this.onKeyUp);
    removeEventListener("blur", this.onBlur);
  }

  private pitchForDist(dist: number) {
    const t = this.clamp(
      (Math.log(dist) - Math.log(700)) / (Math.log(6500) - Math.log(700)),
      0,
      1,
    );
    const s = t * t * (3 - 2 * t);
    return 0.5 + (Math.PI / 2 - 0.5) * s;
  }

  private apply(g: MesaGoal) {
    const cos = Math.cos(g.pitch);
    const sin = Math.sin(g.pitch);
    this.camera.position.set(
      g.x + Math.sin(g.yaw) * cos * g.dist,
      sin * g.dist,
      g.z + Math.cos(g.yaw) * cos * g.dist,
    );
    this.camera.up.set(-Math.sin(g.yaw) * sin, cos, -Math.cos(g.yaw) * sin);
    this.camera.lookAt(g.x, 0, g.z);
    this.camera.near = Math.max(2, g.dist * 0.04);
    this.camera.far = g.dist * 5 + 16000;
    this.camera.updateProjectionMatrix();
  }

  private clampGoal() {
    this.goal.dist = this.clamp(this.goal.dist, 170, this.far * 1.25);
    this.goal.pitch = this.clamp(this.goal.pitch, 0.16, Math.PI / 2);
    this.goal.x = this.clamp(this.goal.x, this.bounds[0], this.bounds[2]);
    this.goal.z = this.clamp(this.goal.z, this.bounds[1], this.bounds[3]);
    this.target.set(this.goal.x, 0, this.goal.z);
  }

  private zoomAt(factor: number, clientX: number, clientY: number) {
    const before = this.hitGround(this.goal, clientX, clientY);
    this.goal.dist = this.clamp(this.goal.dist * factor, 170, this.far * 1.25);
    if (this.autoPitch) this.goal.pitch = this.pitchForDist(this.goal.dist);
    const after = this.hitGround(this.goal, clientX, clientY);
    if (before && after) {
      this.goal.x += before.x - after.x;
      this.goal.z += before.z - after.z;
    }
    this.clampGoal();
  }

  private hitGround(g: MesaGoal, clientX: number, clientY: number) {
    this.apply(g);
    const rect = this.dom.getBoundingClientRect();
    this.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (this.raycaster.ray.intersectPlane(this.ground, this.hit)) {
      return this.hit.clone();
    }
    return null;
  }

  private pointerDown(e: PointerEvent) {
    if (!this.enabled) return;
    this.dom.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.inertia = null;
    this.fly = null;
    if (this.pointers.size === 1) {
      this.rotating = e.button === 2 || e.shiftKey || e.ctrlKey;
      this.panHit = this.rotating
        ? null
        : this.hitGround(this.goal, e.clientX, e.clientY);
      this.panTrail = [];
    } else {
      this.panHit = null;
      this.rotating = false;
    }
  }

  private pointerMove(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    if (!p || !this.enabled) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;

    if (this.pointers.size !== 1) return;

    if (this.rotating) {
      this.goal.yaw -= dx * 0.005;
      this.goal.pitch += dy * 0.004;
      this.autoPitch = false;
      this.clampGoal();
      return;
    }

    if (this.panHit) {
      const nowHit = this.hitGround(this.goal, e.clientX, e.clientY);
      if (nowHit) {
        this.goal.x += this.panHit.x - nowHit.x;
        this.goal.z += this.panHit.z - nowHit.z;
        this.clampGoal();
        const t = performance.now();
        this.panTrail.push({ t, x: this.goal.x, z: this.goal.z });
        if (this.panTrail.length > 6) this.panTrail.shift();
      }
    }
  }

  private pointerUp(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      if (this.panTrail.length >= 2) {
        const a = this.panTrail[0]!;
        const b = this.panTrail[this.panTrail.length - 1]!;
        const dt = (b.t - a.t) / 1000;
        if (dt > 0.025 && dt < 0.35) {
          const vx = (b.x - a.x) / dt;
          const vz = (b.z - a.z) / dt;
          if (Math.hypot(vx, vz) > this.goal.dist * 0.18) {
            this.inertia = { vx, vz };
          }
        }
      }
      this.panHit = null;
      this.rotating = false;
      this.panTrail = [];
    }
  }

  private clamp(v: number, a: number, b: number) {
    return Math.min(b, Math.max(a, v));
  }
}
