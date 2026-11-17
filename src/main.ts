import "./style.css";
import { App } from "./app/App";

const host = document.querySelector<HTMLElement>("#app");
if (!host) throw new Error("#app missing");

const app = new App(host);
void app.start();
(window as unknown as { __baires: App }).__baires = app;

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.dispose());
}
