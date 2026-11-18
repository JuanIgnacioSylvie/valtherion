import type { Epoca } from "../epocas/Epocas";
import type { Modo } from "../modos/Modos";

const WIKI_GLADE =
  "https://commons.wikimedia.org/wiki/File:Plano_topografico_de_la_Ciudad_de_Buenos_Aires_y_de_todo_su_Municipio_incluyendo_parte_de_los_partidos_de_Belgrano,_San_Jose_de_Flores_y_Barracas_al_Sur_-_levantado_por_el_Departamento_Topografico,_construido_y_dibuj..._-_btv1b53098699s.jpg";

/** Atajos de nivel 1 (referencias) — siempre visibles, como en baires.mormon.garden. */
export const REFERENCIAS: { nombre: string; x: number; y: number }[] = [
  { nombre: "Plaza de la Victoria", x: 10344, y: 9484 },
  { nombre: "Plaza del Parque", x: 11590, y: 8003 },
  { nombre: "Mercado Constitución", x: 7512, y: 8112 },
  { nombre: "Mercado 11 de Septiembre", x: 10512, y: 4862 },
  { nombre: "La Recoleta", x: 13929, y: 7047 },
  { nombre: "La Boca", x: 5850, y: 11250 },
  { nombre: "Arroyo Maldonado", x: 16450, y: 3070 },
  { nombre: "Arroyo Maciel", x: 3050, y: 11900 },
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
      <input type="search" placeholder="Buscá una dirección de hoy: Corrientes 1234" autocomplete="off" />
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
            <h2>Buenos Aires, de 1867 a 1940</h2>
            <p class="bajada">Un plano de hace más de siglo y medio, levantado manzana por manzana, y la ciudad que creció encima.</p>
          </div>
          <a class="autor" href="https://baires.mormon.garden/" target="_blank" rel="noopener" title="Referencia: baires.mormon.garden">
            <img src="/autor.webp" alt="" width="44" height="44" />
            <span><i>Réplica de</i><b>baires.mormon.garden</b></span>
          </a>
        </div>
        <div class="cols">
          <div>
            <h3>Qué estás viendo</h3>
            <p>El plano topográfico de la ciudad, obra de Carlos Glade, que el Departamento Topográfico de la provincia publicó en 1867, tendido sobre una mesa. De ese dibujo sale la ciudad que se levanta: las manzanas, lo edificado y los patios, las casillas, las quintas y los árboles están donde el plano los pone.</p>
            <p>Lo que el plano no dice —dónde termina una casa y empieza la otra, cuántos pisos tenía, cómo era su frente— está completado con las costumbres de la época, y los edificios principales, con fotos tomadas tres años antes.</p>
            <h3>Y los años que siguen</h3>
            <p>La ciudad no se queda en 1867. Abajo, la línea de tiempo la lleva a <b>1888, 1895, 1905, 1910, 1921 y 1940</b> (el ▶ los recorre solo). Sobre el mismo plano se levantan las casas que traen los planos de cada año, el río retrocede cuando se hace el puerto, se abren la Avenida de Mayo, las diagonales y la 9 de Julio, y las calles pasan de la tierra al adoquín y al asfalto.</p>
            <p>Cada año trae sus edificios y sus plazas, hechos a partir de fotos de entonces. Los que tienen etiqueta se pueden tocar. Y se la puede recorrer por adentro: <b>a pie</b>, <b>en avión</b> o <b>manejando</b>, con los botones de abajo.</p>
          </div>
          <div>
            <h3>La ciudad en 1867</h3>
            <p>Tenía unos 180.000 habitantes. Era presidente Bartolomé Mitre y el país estaba en guerra con el Paraguay. Casi todas las casas eran bajas, de azotea y patios: lo más alto eran las torres de las iglesias.</p>
            <p>El río llegaba al pie de la barranca, por donde hoy corren Paseo Colón y Leandro N. Alem. No había puerto: los barcos fondeaban lejos de la costa y se bajaba a tierra por el muelle de pasajeros o por el de la Aduana Nueva. La Plaza de Mayo eran dos, la de la Victoria y la 25 de Mayo, separadas por la Recova Vieja.</p>
            <p>El ferrocarril tenía diez años y salía de la Estación del Parque, donde hoy está el Teatro Colón; las calles del centro se alumbraban a gas.</p>
            <h3>Y la ciudad de hoy</h3>
            <ul>
              <li>«Hoy» estampa en rojo, sobre el plano, las calles, las vías y la costa actuales, de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, © sus colaboradores, licencia ODbL.</li>
              <li>Arriba a la izquierda podés buscar una dirección actual. La búsqueda usa USIG y Nominatim.</li>
            </ul>
          </div>
          <div>
            <h3>De dónde salen los datos</h3>
            <ul>
              <li><a href="${WIKI_GLADE}" target="_blank" rel="noopener"><i>Plano topográfico de la Ciudad de Buenos Aires y de todo su Municipio</i></a>, de Carlos Glade, Departamento Topográfico, 1867. Ejemplar de la Bibliothèque nationale de France, vía Wikimedia Commons; dominio público. <em>Es la única fuente de la forma de la ciudad: calles, manzanas, construcciones y arboledas se leen de ahí.</em></li>
              <li>Los planos de Latzina (1888), de la Municipalidad (1895), de Pablo Ludwig (1905 y 1910), de Cannizzaro (1921) y de Peuser (1936), calzados sobre el de 1867. <em>De ahí sale lo que la ciudad creció en cada año.</em></li>
              <li><i>Recuerdos de Buenos Ayres</i>, fotografías de Esteban Gonnet, 1864. <em>Para modelar el Cabildo, la Recova, el primer Teatro Colón y la Aduana.</em></li>
              <li><i>Buenos-Ayres a vista de pájaro</i>, litografía de J. Dulin. <em>Como referencia del aspecto general y las alturas.</em></li>
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
