import type { Epoca } from "../epocas/Epocas";
import type { Modo } from "../modos/Modos";

/** Atajos de nivel 1 — se reemplazan al cargar hoy.json. */
export const REFERENCIAS: { nombre: string; x: number; y: number }[] = [
  { nombre: "Plaza Mayor", x: 6144, y: 4480 },
  { nombre: "Alcázar Real", x: 5923, y: 4377 },
  { nombre: "Catedral de Aurion", x: 6390, y: 4411 },
  { nombre: "Puerto Real", x: 6267, y: 6171 },
];

export type HudHandlers = {
  onYear: (index: number) => void;
  onPlay: () => void;
  onModo: (m: Modo) => void;
  onHoy: () => void;
  onColor: () => void;
  onCity: () => void;
  onBuscar: (q: string) => void;
  onReferencia: (nombre: string, x: number, y: number) => void;
  onInfo: () => void;
};

export type Hud = {
  root: HTMLElement;
  setYearLabel: (y: number, label: string) => void;
  setStatus: (msg: string | null) => void;
  setEpocas: (epocas: Epoca[], index: number) => void;
  setModo: (m: Modo) => void;
  setFlags: (f: { hoy: boolean; color: boolean; city: boolean; playing: boolean }) => void;
  setBuscarMsg: (html: string | null) => void;
  /** Actualiza el panel de referencias (nivel 1) según el año. */
  setReferencias: (refs: { nombre: string; x: number; y: number }[]) => void;
};

export function createHud(parent: HTMLElement, handlers: HudHandlers): Hud {
  const root = document.createElement("div");
  root.id = "hud";
  root.innerHTML = `
    <form id="buscar" role="search">
      <input type="search" placeholder="Buscá un lugar: Plaza Mayor, Puerto…" autocomplete="off" />
      <button type="submit" class="ir">Buscar</button>
    </form>
    <div id="buscar-msg"></div>
    <div id="refs-wrap">
      <div id="referencias" aria-label="Referencias del plano"></div>
      <button type="button" id="btn-info" title="Qué es esto y cómo se maneja">Información</button>
    </div>
    <div class="anio" id="hud-anio">1867</div>
    <div class="anio-sub" id="hud-anio-sub"></div>
    <div id="timeline"></div>
    <div class="titulo">
      <h1>Aurion — Capital <span id="hud-titulo-anio">1867</span></h1>
      <p id="hud-blurb">Maqueta de la capital del reino: plaza, casco murado y puerto con flota.</p>
    </div>
    <div class="modos" id="modos">
      <button type="button" data-modo="mapa" class="on">Mapa</button>
      <button type="button" data-modo="caminar">Caminar</button>
      <button type="button" data-modo="avion">Avión</button>
      <button type="button" data-modo="auto">Auto</button>
    </div>
    <div class="toggles">
      <button type="button" id="btn-city" title="Espacio">Ciudad</button>
      <button type="button" id="btn-hoy" title="H">Hoy</button>
      <button type="button" id="btn-color" title="C">Color</button>
    </div>
    <div class="hints">arrastrá · rueda · derecho: girar · WASD en modos · espacio ciudad · H hoy · C color</div>
  `;
  parent.appendChild(root);

  const refs = root.querySelector("#referencias")!;
  const paintRefs = (list: { nombre: string; x: number; y: number }[]) => {
    refs.replaceChildren();
    for (const r of list) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = r.nombre;
      b.addEventListener("click", () => handlers.onReferencia(r.nombre, r.x, r.y));
      refs.appendChild(b);
    }
  };
  paintRefs(REFERENCIAS);

  const status = document.createElement("div");
  status.id = "status";
  status.hidden = true;
  parent.appendChild(status);

  const anio = root.querySelector("#hud-anio") as HTMLElement;
  const anioSub = root.querySelector("#hud-anio-sub") as HTMLElement;
  const tituloAnio = root.querySelector("#hud-titulo-anio") as HTMLElement;
  const blurb = root.querySelector("#hud-blurb") as HTMLElement;
  const timeline = root.querySelector("#timeline") as HTMLElement;
  const buscarMsg = root.querySelector("#buscar-msg") as HTMLElement;
  const form = root.querySelector("#buscar") as HTMLFormElement;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = (form.querySelector("input") as HTMLInputElement).value;
    handlers.onBuscar(q);
  });

  root.querySelector("#btn-city")!.addEventListener("click", () => handlers.onCity());
  root.querySelector("#btn-hoy")!.addEventListener("click", () => handlers.onHoy());
  root.querySelector("#btn-color")!.addEventListener("click", () => handlers.onColor());
  root.querySelector("#btn-info")!.addEventListener("click", () => handlers.onInfo());

  root.querySelectorAll("#modos button").forEach((b) => {
    b.addEventListener("click", () => {
      handlers.onModo((b as HTMLElement).dataset.modo as Modo);
    });
  });

  return {
    root,
    setReferencias(list) {
      paintRefs(list.length ? list : REFERENCIAS);
    },
    setYearLabel(y, label) {
      anio.textContent = String(y);
      tituloAnio.textContent = String(y);
      anioSub.textContent = label;
    },
    setStatus(msg) {
      if (!msg) {
        status.hidden = true;
        status.textContent = "";
        return;
      }
      status.hidden = false;
      status.textContent = msg;
    },
    setEpocas(epocas, index) {
      timeline.innerHTML = "";
      epocas.forEach((ep, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = String(ep.año);
        b.className = i === index ? "on" : "";
        b.title = ep.corto;
        b.addEventListener("click", () => handlers.onYear(i));
        timeline.appendChild(b);
      });
      const play = document.createElement("button");
      play.type = "button";
      play.id = "btn-play";
      play.textContent = "▶";
      play.title = "Recorrer años";
      play.addEventListener("click", () => handlers.onPlay());
      timeline.appendChild(play);
      blurb.textContent =
        epocas[index]?.obras ||
        epocas[index]?.titulo ||
        "El plano de Carlos Glade — reconstrucción interactiva.";
    },
    setModo(m) {
      root.querySelectorAll("#modos button").forEach((b) => {
        b.classList.toggle("on", (b as HTMLElement).dataset.modo === m);
      });
    },
    setFlags(f) {
      root.querySelector("#btn-city")!.classList.toggle("on", f.city);
      root.querySelector("#btn-hoy")!.classList.toggle("on", f.hoy);
      root.querySelector("#btn-color")!.classList.toggle("on", f.color);
      const play = root.querySelector("#btn-play");
      if (play) play.textContent = f.playing ? "❚❚" : "▶";
    },
    setBuscarMsg(html) {
      buscarMsg.innerHTML = html ?? "";
      buscarMsg.classList.toggle("ver", !!html);
    },
  };
}

export type IntroApi = { open: () => void; close: () => void };

export function createIntro(onEnter?: () => void): IntroApi {
  const el = document.createElement("div");
  el.id = "intro";
  el.className = "ver";
  el.innerHTML = `
    <div class="hoja">
      <div class="texto">
        <div class="cabeza">
          <div>
            <h2>Aurion, capital del reino</h2>
            <p class="bajada">Una maqueta sobre la mesa: el plano en tinta levanta el casco murado, la plaza y el puerto.</p>
          </div>
        </div>
        <div class="cols">
          <div>
            <h3>Qué estás viendo</h3>
            <p>El mismo motor que usábamos para Buenos Aires —mesa, tinta, lift, kit de piezas— pero con el contenido de <b>Aurion</b>: manzanas en anillos irregulares, casas bajas, y hitos hechos a mano.</p>
            <p>Tocá <b>Ciudad</b> (o espacio) para levantar la maqueta. Abajo, la línea de tiempo recorre etapas del lore (murallas, puerto, catedral…).</p>
          </div>
          <div>
            <h3>La capital</h3>
            <p>En el centro, la <b>Plaza Mayor</b> con el Alcázar y la Catedral. Al sur, el <b>Puerto Real</b>: muelles de madera, aduana y una flota de veleros grandes y botes chicos.</p>
            <p>La forma no copia Buenos Aires: el casco es ovalado, las calles parten en radios desde la plaza y la bahía muerde la muralla hacia el mar.</p>
          </div>
          <div>
            <h3>Cómo se maneja</h3>
            <ul>
              <li>Arrastrá para moverte, rueda para acercar, botón derecho para girar.</li>
              <li>Modos <b>caminar</b>, <b>avión</b> y <b>auto</b> para recorrer por dentro.</li>
              <li>Los nombres de la izquierda saltan a cada hito.</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="pie">
        <span class="como">Arrastrá para moverte, acercate con la rueda y tocá un nombre para ir.</span>
        <button type="button" class="entrar">Ver la ciudad</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  let open = true;
  const api: IntroApi = {
    open() {
      open = true;
      el.classList.add("ver");
      (el.querySelector(".texto") as HTMLElement).scrollTop = 0;
      (el.querySelector(".entrar") as HTMLButtonElement).focus({ preventScroll: true });
    },
    close() {
      if (!open) return;
      open = false;
      el.classList.remove("ver");
      onEnter?.();
    },
  };

  if (matchMedia("(pointer: coarse)").matches) {
    const como = el.querySelector(".como");
    if (como) {
      como.textContent =
        "Un dedo mueve el plano; dos dedos lo acercan, lo giran y lo inclinan. Tocá un nombre para ir.";
    }
  }

  el.querySelector(".entrar")!.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    api.close();
  });
  el.addEventListener("pointerdown", (e) => {
    if (e.target === el) api.close();
  });
  addEventListener("keydown", (e) => {
    if (!open || !el.classList.contains("ver")) return;
    if (e.code === "Enter" || e.code === "Space" || e.code === "Escape") {
      e.preventDefault();
      api.close();
    }
  });

  return api;
}
