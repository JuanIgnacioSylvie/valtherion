import * as THREE from "three";
import { CityMeshes } from "../city/CityMeshes";
import { CityUniforms } from "../city/CityUniforms";
import { LandmarkMeshes } from "../city/LandmarkMeshes";
import { PatiosMeshes } from "../city/Patios";
import { EpocasController } from "../epocas/Epocas";
import { buscarDireccion } from "../geo/buscar";
import { loadGeo, type GeoModel } from "../geo/transform";
import { HitosLayer } from "../hitos/Hitos";
import { CallesLabels } from "../hoy/CallesLabels";
import { HoyOverlay } from "../hoy/HoyOverlay";
import { Modos, type Modo } from "../modos/Modos";
import { PlanoMesh } from "../plano/PlanoMesh";
import { pxToWorld } from "../plano/coords";
import { GLADE_REF, type LaminasMeta, type PlanoMeta } from "../plano/types";
import { createMapControls } from "../scene/controls";
import { InkPass } from "../scene/InkPass";
import { RelieveMesh } from "../scene/Relieve";
import { createHud, createIntro, type Hud, type IntroApi } from "../ui/hud";

export class App {
  private host: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: ReturnType<typeof createMapControls>;
  private plano: PlanoMesh | null = null;
  private city: CityMeshes | null = null;
  private cityU: CityUniforms | null = null;
  private landmarks: LandmarkMeshes | null = null;
  private patios: PatiosMeshes | null = null;
  private hoy: HoyOverlay | null = null;
  private calles: CallesLabels | null = null;
  private relieve: RelieveMesh | null = null;
  private hitos: HitosLayer | null = null;
  private modos: Modos;
  private epocas = new EpocasController();
  private geo: GeoModel | null = null;
  private hud: Hud;
  private intro: IntroApi | null = null;
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
  private sunDir = new THREE.Vector3(0.52, 0.62, 0.5).normalize();

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(host.clientWidth, host.clientHeight);
    this.renderer.setClearColor(0x1d1a17, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);
    this.inkPass = new InkPass(this.renderer);

    this.camera = new THREE.PerspectiveCamera(
      30,
      host.clientWidth / Math.max(1, host.clientHeight),
      5,
      40000,
    );
    this.camera.position.set(0, 9000, 0);

    this.controls = createMapControls(this.camera, this.renderer.domElement, {
      far: 9000,
      bounds: [-7000, -7000, 7000, 7000],
    });
    this.controls.jump({ x: 0, z: 0, dist: 9000, yaw: 0, pitch: Math.PI / 2 });

    // Luz como el original: sol blanco π, ambiente π·sl, dirección ol.
    // uFlat = ol.y + sl normaliza el sombreado rayado de fachadas.
    const ol = new THREE.Vector3(0.52, 0.62, 0.5).normalize();
    const sl = 0.34;
    this.amb = new THREE.AmbientLight(0xffffff, Math.PI * sl);
    this.sun = new THREE.DirectionalLight(0xffffff, Math.PI);
    this.sun.position.copy(ol).multiplyScalar(2000);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -4e-4;
    this.sun.shadow.normalBias = 0.6;
    this.sun.shadow.radius = 2.5;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 8000;
    this.sun.shadow.camera.left = -2000;
    this.sun.shadow.camera.right = 2000;
    this.sun.shadow.camera.top = 2000;
    this.sun.shadow.camera.bottom = -2000;
    this.hemi = new THREE.HemisphereLight(0xc8e0ff, 0x8a6a40, 0);
    this.sunDir.copy(ol);
    this.scene.add(this.amb, this.sun, this.sun.target, this.hemi);

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
      onReferencia: (_nombre, x, y) => {
        const [wx, wz] = pxToWorld(this.meta, x, y);
        this.flyTo(wx, wz, 520);
      },
      onInfo: () => this.intro?.open(),
    });

    addEventListener("resize", this.onResize);
    addEventListener("keydown", this.onKey);
  }

  async start() {
    if (!new URLSearchParams(location.search).has("nointro")) {
      this.intro = createIntro();
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
    this.cityU = new CityUniforms(meta);
    if (this.plano) this.cityU.bindPlanoUniforms(this.plano.material.uniforms);

    this.city = await CityMeshes.load(meta);
    if (this.city && this.cityU) {
      this.city.bindShared(this.cityU);
      this.city.setColorMode(0);
      this.scene.add(this.city.group);
    }

    this.landmarks = await LandmarkMeshes.load(meta, 0);
    if (this.landmarks && this.cityU) {
      this.landmarks.bindShared(this.cityU);
      this.scene.add(this.landmarks.group);
    }

    this.patios = await PatiosMeshes.load(meta);
    if (this.patios) this.scene.add(this.patios.group);

    this.hoy = new HoyOverlay(meta);
    await this.hoy.load();
    this.scene.add(this.hoy.mesh);

    this.calles = new CallesLabels(meta);
    await this.calles.load();

    this.relieve = new RelieveMesh(meta);
    await this.relieve.load();
    this.scene.add(this.relieve.mesh);

    this.hitos = new HitosLayer(meta);
    this.hitos.onGo = (x, z) => this.flyTo(x, z);
    await this.hitos.load();

    await this.epocas.load();
    this.patios?.setColorMode(0);
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
    const year = ep?.año ?? 1867;
    this.hud.setEpocas(this.epocas.epocas, this.epocas.index);
    this.hud.setYearLabel(year, ep?.corto ?? "");
    this.hitos?.setYear(year);
    this.landmarks?.setYear(year);
    this.hud.setReferencias(this.hitos?.refsForYear(year) ?? []);
    this.hud.setFlags(this.flags());
  }

  private applyEpocaToCity() {
    const etapas = Math.max(1, this.epocas.epocas.length - 1);
    this.plano?.setEpoca(this.epocas.k, etapas);
    this.cityU?.setEpoca(this.epocas.k, etapas);
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
    this.patios?.setColorMode(this.colorMode ? 1 : 0);
    this.plano?.setColor(this.colorMode ? 1 : 0);
    // el original mantiene la misma luz blanca; el color lo pone el shader
    this.renderer.setClearColor(this.colorMode ? 0xe6dfd0 : 0x1d1a17, 1);
    this.amb.color.set(0xffffff);
    this.amb.intensity = Math.PI * 0.34;
    this.sun.color.set(0xffffff);
    this.sun.intensity = Math.PI;
    this.hemi.intensity = 0;
    if (this.city) {
      this.city.front = this.front;
      this.city.rebuild(this.cityMode ? 1 : this.city.visibleLift);
    }
    this.hud.setFlags(this.flags());
  }

  private flyTo(x: number, z: number, dist = 420) {
    this.setModo("mapa");
    this.controls.flyTo({ x, z, dist, yaw: this.controls.goal.yaw }, 2.2);
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

    if (this.cityU) {
      this.cityU.setFront(this.front * (this.cityMode ? 1 : 0.001));
      this.cityU.setColor(this.plano?.getColor() ?? (this.colorMode ? 1 : 0));
      this.cityU.setEpoca(this.epocas.k, Math.max(1, this.epocas.epocas.length - 1));
      this.cityU.setHoy(this.hoyMode ? 1 : 0);
      // original: calidad “simple” → 5200 m (matas lejos / afuera del frente)
      this.cityU.setMatas(this.colorMode && this.cityMode ? 5200 : 0);
      if (this.plano) this.cityU.bindPlanoUniforms(this.plano.material.uniforms);
      if (this.relieve) {
        // Original: tRelieve en metros × uRelieve factor (~0..2). No multiplicar por maxH.
        this.cityU.setRelieve(this.relieve.heightTex, this.relieve.amount);
      }
    }

    if (this.city) {
      const lift = THREE.MathUtils.damp(this.city.visibleLift, targetLift, 3.2, dt);
      this.city.front = this.front;
      this.city.epocaK = this.epocas.k;
      this.city.rebuild(lift);
      this.landmarks?.setLift(lift);
      if (this.patios) {
        if (this.relieve) {
          const rel = this.relieve;
          const amt = rel.amount;
          this.patios.heightAt = (x, z) => rel.heightAt(x, z) * amt;
        } else {
          this.patios.heightAt = null;
        }
        this.patios.setLift(this.relieve?.amount ?? lift);
      }
    }

    if (this.hoy) {
      const a = THREE.MathUtils.damp(this.hoy.amount, this.hoyMode ? 1 : 0, 5, dt);
      this.hoy.setAmount(a);
      this.calles?.setAmount(a);
    }

    // relieve visual del terreno; en el shader uRelieve es factor suave (el original default es 0)
    if (this.relieve) {
      const want = this.cityMode ? 0.2 : 0;
      const a = THREE.MathUtils.damp(this.relieve.amount, want, 3, dt);
      this.relieve.setAmount(a);
    }

    this.calles?.update(this.camera, this.controls, this.hoyMode);

    const colorT = this.colorMode ? 1 : 0;
    if (this.plano) {
      const c = THREE.MathUtils.damp(this.plano.getColor(), colorT, 5, dt);
      this.plano.setColor(c);
      this.inkPass.setColor(c);
      this.plano.setEpoca(this.epocas.k, Math.max(1, this.epocas.epocas.length - 1));
    } else {
      this.inkPass.setColor(colorT);
    }

    // sombra del sol sigue el target (como el original)
    {
      const dist = this.controls.goal.dist;
      const u = Math.min(3600, Math.max(420, dist * 0.95));
      const map = this.sun.shadow.mapSize.x || 2048;
      const snap = ((2 * u) / map) * 16;
      const tx = Math.round(this.controls.target.x / snap) * snap;
      const tz = Math.round(this.controls.target.z / snap) * snap;
      this.sun.target.position.set(tx, 0, tz);
      this.sun.position.set(tx, 0, tz).addScaledVector(this.sunDir, u * 3 + 400);
      const sc = this.sun.shadow.camera;
      if (sc.right !== u) {
        sc.left = sc.bottom = -u;
        sc.right = sc.top = u;
        sc.near = 10;
        sc.far = u * 6 + 800;
        sc.updateProjectionMatrix();
      }
      this.sun.target.updateMatrixWorld();
      this.sun.castShadow = this.cityMode;
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
