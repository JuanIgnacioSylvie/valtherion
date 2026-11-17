import type { Epoca } from "../epocas/Epocas";
import type { Modo } from "../modos/Modos";

export type HudHandlers = {
  onYear: (index: number) => void;
  onPlay: () => void;
  onModo: (m: Modo) => void;
  onHoy: () => void;
  onColor: () => void;
  onCity: () => void;
  onBuscar: (q: string) => void;
};

export type Hud = {
  root: HTMLElement;
  setYearLabel: (y: number, label: string) => void;
  setStatus: (msg: string | null) => void;
  setEpocas: (epocas: Epoca[], index: number) => void;
  setModo: (m: Modo) => void;
  setFlags: (f: { hoy: boolean; color: boolean; city: boolean; playing: boolean }) => void;
  setBuscarMsg: (html: string | null) => void;
};

export function createHud(parent: HTMLElement, handlers: HudHandlers): Hud {
  const root = document.createElement("div");
  root.id = "hud";
  root.innerHTML = `
    <form id="buscar" role="search">
      <input type="search" placeholder="Buscá una dirección de hoy: Corrientes 1234" autocomplete="off" />
      <button type="submit" class="ir">Buscar</button>
    </form>
    <div id="buscar-msg"></div>
    <div class="anio" id="hud-anio">1867</div>
    <div class="anio-sub" id="hud-anio-sub"></div>
    <div id="timeline"></div>
    <div class="titulo">
      <h1>Buenos Aires — Glade <span id="hud-titulo-anio">1867</span></h1>
      <p id="hud-blurb">Plano de Carlos Glade (1867) — la tinta del grabado levanta la ciudad 3D.</p>
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

  root.querySelectorAll("#modos button").forEach((b) => {
    b.addEventListener("click", () => {
      handlers.onModo((b as HTMLElement).dataset.modo as Modo);
    });
  });

  return {
    root,
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

export function createIntro(onEnter: () => void) {
  const el = document.createElement("div");
  el.id = "intro";
  el.className = "ver";
  el.innerHTML = `
    <div class="texto">
      <h2>Buenos Aires — plano de Carlos Glade, 1867</h2>
      <p>Un plano hi-res generado por nosotros (ciudad inventada), manzana por manzana, y la ciudad que se levanta encima.</p>
      <h3>Qué estás viendo</h3>
      <p>Misma arquitectura que baires.mormon.garden: tinta → volúmenes 3D, timeline, overlay de “hoy”, búsqueda USIG/Nominatim anclada a coords reales, modos caminar/avión/auto.</p>
      <h3>Controles</h3>
      <p class="como">Arrastrá para mover · rueda para zoom · botón derecho para girar · Space ciudad · H hoy · C color · WASD en caminar/avión/auto.</p>
      <button type="button" class="entrar">Ver la ciudad</button>
    </div>
  `;
  document.body.appendChild(el);
  const close = () => {
    el.classList.remove("ver");
    onEnter();
    setTimeout(() => el.remove(), 600);
  };
  el.querySelector(".entrar")!.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });
  el.addEventListener("pointerdown", (e) => {
    if (e.target === el) close();
  });
  addEventListener(
    "keydown",
    (e) => {
      if (!el.isConnected || !el.classList.contains("ver")) return;
      if (e.code === "Enter" || e.code === "Space" || e.code === "Escape") {
        e.preventDefault();
        close();
      }
    },
    { once: true },
  );
}
