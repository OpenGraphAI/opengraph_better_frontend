// Mounts the product film in a page's hero. The build specimen inside the
// figure stays visible until the film is ready, and again if it fails.
import "./films.css";
import { SCENES } from "./registry.js";

// Looping motion longer than five seconds needs a way to stop it (WCAG 2.2.2).
function addPauseButton(figure, film) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "film-toggle";
  button.setAttribute("aria-pressed", "false");
  button.textContent = "Pause";
  button.addEventListener("click", () => {
    const paused = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(paused));
    button.textContent = paused ? "Play" : "Pause";
    film.setPaused(paused);
  });
  figure.append(button);
}

async function mount(figure, createFilm) {
  const load = SCENES[figure.dataset.film];
  const stage = figure.querySelector(".film-stage");
  if (!load || !stage) return;
  try {
    const { default: scene } = await load();
    figure.classList.add("is-live", "is-loading"); // the stage must be laid out before the scene measures text
    const film = createFilm(stage, scene);
    addPauseButton(figure, film);
    // No Pause button for a film that has not started: it waits for its photos.
    film.ready.then(() => figure.classList.remove("is-loading"));
  } catch (error) {
    figure.classList.remove("is-live", "is-loading");
    stage.replaceChildren();
    reportError(error);
  }
}

export async function initialiseFilms() {
  const figures = [...document.querySelectorAll(".page-film[data-film]")];
  if (!figures.length) return;
  // Node positions are read from laid-out text, so the fonts must be in first.
  // The Claude panel's face is not on the page yet, so load it by name.
  try {
    await document.fonts?.load('16px "Anthropic Sans"');
    await document.fonts?.ready;
  } catch {
    // A missing font only shifts text slightly; the film still plays.
  }
  const { createFilm } = await import("./engine.js");
  await Promise.all(figures.map((figure) => mount(figure, createFilm)));
}
