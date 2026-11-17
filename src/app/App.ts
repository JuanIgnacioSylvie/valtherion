import * as THREE from "three";
import { CityMeshes } from "../city/CityMeshes";
import { LandmarkMeshes } from "../city/LandmarkMeshes";
import { EpocasController } from "../epocas/Epocas";
import { buscarDireccion } from "../geo/buscar";
import { loadGeo, type GeoModel } from "../geo/transform";
import { HitosLayer } from "../hitos/Hitos";
import { HoyOverlay } from "../hoy/HoyOverlay";
import { Modos, type Modo } from "../modos/Modos";
import { PlanoMesh } from "../plano/PlanoMesh";
import { pxToWorld } from "../plano/coords";
import { GLADE_REF, type LaminasMeta, type PlanoMeta } from "../plano/types";
import { createMapControls } from "../scene/controls";
import { InkPass } from "../scene/InkPass";
import { RelieveMesh } from "../scene/Relieve";
import { createHud, createIntro, type Hud } from "../ui/hud";

export class App {
  private host: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: ReturnType<typeof createMapControls>;
  private plano: PlanoMesh | null = null;
  private city: CityMeshes | null = null;
  private landmarks: LandmarkMeshes | null = null;
  private hoy: HoyOverlay | null = null;
  private relieve: RelieveMesh | null = null;
  private hitos: HitosLayer | null = null;
  private modos: Modos;
  private epocas = new EpocasController();
  private geo: GeoModel | null = null;
  private hud: Hud;
  private clock = new THREE.Clock();
  private cityMode = false;
  private hoyMode = false;
  private colorMode = false;
  private disposed = false;
  private fineTimer = 0;
  private front = 0;
  private meta: PlanoMeta = GLADE_REF;
  private marca: THREE.Mesh | null = null;
  private amb: THREE.AmbientLight;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private inkPass: InkPass;

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(host.clientWidth, host.clientHeight);
    this.renderer.setClearColor(0x1a1612, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);
    this.inkPass = new InkPass(this.renderer);

    this.camera = new THREE.PerspectiveCamera(
      42,
      host.clientWidth / Math.max(1, host.clientHeight),
      0.5,
      60000,
    );
    this.camera.position.set(0, 9000, 0);

    this.controls = createMapControls(this.camera, this.renderer.domElement, {
      far: 9000,
      bounds: [-7000, -7000, 7000, 7000],
    });
    this.controls.jump({ x: 0, z: 0, dist: 9000, yaw: 0, pitch: Math.PI / 2 });

    this.amb = new THREE.AmbientLight(0xfff2dd, 0.9);
    this.sun = new THREE.DirectionalLight(0xffe6c0, 0.65);
    this.sun.position.set(400, 800, 200);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.00015;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.camera.near = 20;
    this.sun.shadow.camera.far = 8000;
    this.sun.shadow.camera.left = -3500;
    this.sun.shadow.camera.right = 3500;
    this.sun.shadow.camera.top = 3500;
    this.sun.shadow.camera.bottom = -3500;
    this.hemi = new THREE.HemisphereLight(0xc8e0ff, 0x8a6a40, 0);
    this.scene.add(this.amb, this.sun, this.hemi);

    this.modos = new Modos(this.camera, this.controls, this.scene);

    this.hud = createHud(document.body, {
      onYear: (i) => {
        this.epocas.setIndex(i);
        this.syncEpocaUi();
        this.applyEpocaToCity();
      },
      onPlay: () => {
        this.epocas.togglePlay();
        this.hud.setFlags(this.flags());
      },
      onModo: (m) => this.setModo(m),
      onHoy: () => this.toggleHoy(),
      onColor: () => this.toggleColor(),
      onCity: () => this.toggleCity(),
      onBuscar: (q) => void this.onBuscar(q),
    });

    addEventListener("resize", this.onResize);
    addEventListener("keydown", this.onKey);
  }

  async start() {
    if (!new URLSearchParams(location.search).has("nointro")) {
      createIntro(() => {
        /* entered */
      });
    }

    this.hud.setStatus("Cargando…");

    const meta = await this.loadJson<PlanoMeta>("/datos/ciudad.json")
      .then((j) => ("plano" in j ? (j as { plano: PlanoMeta }).plano : (j as PlanoMeta)))
      .catch(() => GLADE_REF);
    this.meta = meta;

    const laminas = await this.loadJson<LaminasMeta>("/plano/laminas.json").catch(() => null);

    this.plano = new PlanoMesh({ meta, laminas });
    this.scene.add(this.plano.group);

    try {
      await this.plano.loadBase("medio");
    } catch {
      this.hud.setStatus("Falta el plano — pnpm plano:placeholder");
      this.addPaperFallback(meta);
    }

    this.hud.setStatus("Levantando la ciudad…");
    this.city = await CityMeshes.load(meta);
    if (this.city) {
      this.city.setColorMode(0);
      this.scene.add(this.city.group);
    }

    this.landmarks = await LandmarkMeshes.load(meta, 0);
    if (this.landmarks) this.scene.add(this.landmarks.group);

    this.hoy = new HoyOverlay(meta);
    await this.hoy.load();
    this.scene.add(this.hoy.mesh);

    this.relieve = new RelieveMesh(meta);
    await this.relieve.load();
    this.scene.add(this.relieve.mesh);

    this.hitos = new HitosLayer(meta);
    this.hitos.onGo = (x, z) => this.flyTo(x, z);
    await this.hitos.load();

    await this.epocas.load();
    this.syncEpocaUi();

    try {
      this.geo = await loadGeo();
    } catch {
      this.geo = null;
    }

    this.hud.setStatus(null);

    // auto-levantar al entrar; la mesa acerca sola con el scroll
    this.cityMode = true;
    this.front = 3500;
    this.controls.flyTo({ x: 30, z: 80, dist: 520, yaw: 0.35 }, 2.8);
    this.hud.setFlags(this.flags());
    this.loop();
  }

  private flags() {
    return {
      hoy: this.hoyMode,
      color: this.colorMode,
      city: this.cityMode,
      playing: this.epocas.playing,
    };
  }

  private syncEpocaUi() {
    const ep = this.epocas.current;
    this.hud.setEpocas(this.epocas.epocas, this.epocas.index);
    this.hud.setYearLabel(ep?.año ?? 1867, ep?.corto ?? "");
    this.hitos?.setYear(ep?.año ?? 1867);
    this.hud.setFlags(this.flags());
  }

  private applyEpocaToCity() {
    this.plano?.setEpoca(this.epocas.k, Math.max(1, this.epocas.epocas.length - 1));
    if (!this.city) return;
    this.city.epocaK = this.epocas.k;
    this.city.front = this.front;
    this.city.rebuild(this.city.visibleLift || (this.cityMode ? 1 : 0));
  }

  private setModo(m: Modo) {
    this.modos.setModo(m);
    this.hud.setModo(m);
  }

  private toggleCity() {
    this.cityMode = !this.cityMode;
    if (this.cityMode) {
      if (this.front < 2500) this.front = 2500;
      // acercar si está muy arriba
      if (this.controls.goal.dist > 1400) {
        this.controls.flyTo(
          { x: this.controls.target.x, z: this.controls.target.z, dist: 520 },
          1.6,
        );
      }
    }
    this.hud.setFlags(this.flags());
  }

  private toggleHoy() {
    this.hoyMode = !this.hoyMode;
    this.hud.setFlags(this.flags());
  }

  private toggleColor() {
    this.colorMode = !this.colorMode;
    this.city?.setColorMode(this.colorMode ? 1 : 0);
    this.landmarks?.setColorMode(this.colorMode ? 1 : 0);
    this.relieve?.setAmount(this.colorMode ? 1 : 0);
    this.plano?.setColor(this.colorMode ? 1 : 0);
    // luz de día vs luz de mesa/tinta
    if (this.colorMode) {
      this.renderer.setClearColor(0x87a0b4, 1);
      this.amb.color.set(0xfff6e8);
      this.amb.intensity = 0.78;
      this.sun.color.set(0xffe2b0);
      this.sun.intensity = 0.95;
      this.hemi.intensity = 0.4;
    } else {
      this.renderer.setClearColor(0x1a1612, 1);
      this.amb.color.set(0xfff2dd);
      this.amb.intensity = 1.05;
      this.sun.color.set(0xffe6c0);
      this.sun.intensity = 0.55;
      this.hemi.intensity = 0;
    }
    if (this.city) {
      this.city.front = this.front;
      this.city.rebuild(this.cityMode ? 1 : this.city.visibleLift);
    }
    this.hud.setFlags(this.flags());
  }

  private flyTo(x: number, z: number) {
    this.setModo("mapa");
    this.controls.flyTo({ x, z, dist: 420, yaw: this.controls.goal.yaw }, 2.2);
  }

  private async onBuscar(q: string) {
    if (!this.geo) {
      this.hud.setBuscarMsg("Sin modelo de georreferencia.");
      return;
    }
    this.hud.setBuscarMsg("Buscando…");
    const h = await buscarDireccion(q, this.geo, this.meta);
    if (h.estado === "hallada" && h.px != null && h.py != null) {
      const [x, z] = pxToWorld(this.meta, h.px, h.py);
      this.flyTo(x, z);
      this.placeMarca(x, z);
      this.hud.setBuscarMsg(
        `<b>${escapeHtml(h.nombre ?? "")}</b><br>${escapeHtml(h.nota ?? "")}`,
      );
      this.hoyMode = true;
    } else if (h.estado === "fuera") {
      this.hud.setBuscarMsg(
        `<b>${escapeHtml(h.nombre ?? "")}</b><br>${escapeHtml(h.nota ?? "")}`,
      );
    } else if (h.estado === "error") {
      this.hud.setBuscarMsg(h.nota ?? "Error de búsqueda.");
    } else {
      this.hud.setBuscarMsg(
        `No encontré «${escapeHtml(q)}».<small>Probá calle y altura o una esquina.</small>`,
      );
    }
  }

  private placeMarca(x: number, z: number) {
    if (!this.marca) {
      const g = new THREE.SphereGeometry(4, 16, 12);
      const m = new THREE.MeshBasicMaterial({ color: 0xa03220 });
      this.marca = new THREE.Mesh(g, m);
      this.scene.add(this.marca);
    }
    this.marca.position.set(x, 8, z);
    this.marca.visible = true;
  }

  private addPaperFallback(meta: PlanoMeta) {
    const g = new THREE.PlaneGeometry(meta.ancho * meta.metro, meta.alto * meta.metro);
    g.rotateX(-Math.PI / 2);
    this.scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xf3e6cc })));
  }

  private loop = () => {
    if (this.disposed) return;
    requestAnimationFrame(this.loop);
    const dt = this.clock.getDelta();

    this.epocas.update(dt);
    if (this.epocas.playing) {
      this.syncEpocaUi();
      this.applyEpocaToCity();
    }

    if (this.modos.modo === "mapa") this.controls.update(dt);
    this.modos.update(dt);

    const targetLift = this.cityMode ? 1 : 0;
    if (this.cityMode) {
      this.front = Math.min(14000, this.front + dt * 1800);
    }

    if (this.plano) {
      const lift = THREE.MathUtils.damp(this.plano.getLift(), targetLift, 4, dt);
      this.plano.setLift(lift);

      this.fineTimer -= dt;
      if (this.fineTimer <= 0) {
        this.fineTimer = 0.35;
        const t = this.controls.target;
        const dist = this.camera.position.distanceTo(t);
        const zoom = (this.plano.meta.metro * 900) / Math.max(40, dist);
        void this.plano.updateFineTiles(t.x, t.z, zoom);
      }
    }

    if (this.city) {
      const lift = THREE.MathUtils.damp(this.city.visibleLift, targetLift, 3.2, dt);
      this.city.front = this.front;
      this.city.epocaK = this.epocas.k;
      this.city.rebuild(lift);
      this.landmarks?.setLift(lift);
    }

    if (this.hoy) {
      const a = THREE.MathUtils.damp(this.hoy.amount, this.hoyMode ? 1 : 0, 5, dt);
      this.hoy.setAmount(a);
    }

    const colorT = this.colorMode ? 1 : 0;
    if (this.plano) {
      const c = THREE.MathUtils.damp(this.plano.getColor(), colorT, 5, dt);
      this.plano.setColor(c);
      this.inkPass.setColor(c);
      this.plano.setEpoca(this.epocas.k, Math.max(1, this.epocas.epocas.length - 1));
    } else {
      this.inkPass.setColor(colorT);
    }

    this.hitos?.update(this.camera, this.renderer);
    this.inkPass.render(this.scene, this.camera);
  };

  private onResize = () => {
    const w = this.host.clientWidth;
    const h = Math.max(1, this.host.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.inkPass.resize();
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === "Space" && !e.repeat) {
      e.preventDefault();
      this.toggleCity();
    } else if (e.code === "KeyH" && !e.repeat) {
      this.toggleHoy();
    } else if (e.code === "KeyC" && !e.repeat) {
      this.toggleColor();
    } else if (e.code === "Escape") {
      this.setModo("mapa");
    }
  };

  private async loadJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  }

  /** Debug / QA */
  debug() {
    return {
      cityMode: this.cityMode,
      colorMode: this.colorMode,
      front: this.front,
      hasCity: !!this.city,
      lift: this.city?.visibleLift ?? null,
      epocaK: this.epocas.k,
      cam: this.camera.position.toArray(),
      clear: this.renderer.getClearColor(new THREE.Color()).getHexString(),
    };
  }

  /** Forzar modo color (QA). */
  forceColor(on = true) {
    if (this.colorMode !== on) this.toggleColor();
    else if (on) {
      this.city?.setColorMode(1);
      this.landmarks?.setColorMode(1);
      this.plano?.setColor(1);
    }
  }

  dispose() {
    this.disposed = true;
    removeEventListener("resize", this.onResize);
    removeEventListener("keydown", this.onKey);
    this.plano?.dispose();
    this.city?.dispose();
    this.hoy?.dispose();
    this.relieve?.dispose();
    this.hitos?.dispose();
    this.inkPass.dispose();
    this.modos.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}
