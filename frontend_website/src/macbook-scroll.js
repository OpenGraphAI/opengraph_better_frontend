import { createTimeline } from "animejs";

export function initialiseMacbookScroll() {
  const figure = document.querySelector("[data-macbook]");
  if (!figure) return;
  const screen = figure.querySelector(".claude-code-showcase");
  const keyboard = figure.querySelector("[data-macbook-keyboard]");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const rows = [
    ["esc", "◌", "◌", "◌", "◌", "◌", "◌", "◌", "◌", "◌", "◌", "◌", "◌", "◎"],
    ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "−", "=", "delete"],
    ["tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\"],
    ["caps", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "return"],
    ["shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "shift"],
    ["fn", "control", "option", "⌘", "space", "⌘", "option", "←", "↕", "→"],
  ];
  keyboard.replaceChildren(...rows.map((keys) => {
    const row = document.createElement("div");
    row.className = "macbook-key-row";
    for (const label of keys) {
      const key = document.createElement("span");
      key.textContent = label === "space" ? "" : label;
      key.style.setProperty("--key-width", label === "space" ? "5" : label.length > 2 ? "1.6" : "1");
      row.append(key);
    }
    return row;
  }));

  let timeline;
  let frame = 0;
  let progress = 0;
  let previousTime = 0;
  const clamp = (value) => Math.max(0, Math.min(1, value));
  const targetProgress = () => {
    const top = figure.getBoundingClientRect().top;
    return clamp((window.innerHeight * 0.92 - top) / (window.innerHeight * 0.7));
  };

  function render(time) {
    frame = 0;
    const target = targetProgress();
    const elapsed = Math.min(64, previousTime ? time - previousTime : 16);
    previousTime = time;
    progress += (target - progress) * (1 - Math.exp(-elapsed / 85));
    const settled = Math.abs(target - progress) < 0.0005;
    if (settled) progress = target;
    timeline.seek(progress * timeline.duration);
    if (!settled) frame = requestAnimationFrame(render);
    else previousTime = 0;
  }

  function queueRender() {
    if (!timeline || frame || document.hidden) return;
    frame = requestAnimationFrame(render);
  }

  function configureMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    timeline?.revert();
    timeline = null;
    if (motion.matches) return;
    timeline = createTimeline({ autoplay: false })
      .add(figure.querySelector(".macbook-device"), {
        rotateY: [-28, -16], rotateZ: [-5, 2],
        translateY: [48, 0], scale: [0.86, 0.98],
        duration: 1000, ease: "inOutCubic",
      }, 0)
      .add(figure.querySelector(".macbook-lid"), {
        rotateX: [-62, -8], duration: 850, ease: "outCubic",
      }, 80)
      .add(figure.querySelector(".macbook-reflection"), {
        opacity: [0.7, 0], translateX: ["-24%", "35%"],
        duration: 780, ease: "inOutQuad",
      }, 100)
      .add(figure.querySelector(".macbook-shadow"), {
        scaleX: [0.7, 1], opacity: [0.3, 1], duration: 1000, ease: "inOutQuad",
      }, 0);
    progress = targetProgress();
    timeline.seek(progress * timeline.duration);
  }

  // Keep the full desktop workspace visible at every device size. Resizing the
  // iframe viewport itself would trigger the demo's mobile layout inside a laptop.
  const resizeObserver = new ResizeObserver(() => {
    screen.style.setProperty("--screen-scale", String(screen.clientWidth / 1440));
    screen.classList.add("is-scaled");
    queueRender();
  });
  resizeObserver.observe(screen);
  configureMotion();
  window.addEventListener("scroll", queueRender, { passive: true });
  window.addEventListener("resize", queueRender, { passive: true });
  document.addEventListener("visibilitychange", queueRender);
  motion.addEventListener("change", configureMotion);

  if (import.meta.hot) import.meta.hot.dispose(() => {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    timeline?.revert();
    window.removeEventListener("scroll", queueRender);
    window.removeEventListener("resize", queueRender);
    document.removeEventListener("visibilitychange", queueRender);
    motion.removeEventListener("change", configureMotion);
  });
}
