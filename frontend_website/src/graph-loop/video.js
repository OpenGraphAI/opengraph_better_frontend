import "./graph-loop.css";

// The landing page plays the rendered scene without downloading a 3D engine.
document.querySelectorAll("[data-graph-video]").forEach((video) => {
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const connection = navigator.connection;
  let visible = false;
  let loaded = false;
  const sync = () => {
    if (!visible || document.hidden || motion.matches || connection?.saveData) {
      video.pause();
      return;
    }
    if (!loaded) {
      video.querySelectorAll("source[data-src]").forEach((source) => {
        source.src = source.dataset.src;
      });
      video.load();
      loaded = true;
    }
    // Browsers that block autoplay retain the poster.
    video.play().catch(() => {});
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }, { threshold: 0.01 }).observe(video);
  document.addEventListener("visibilitychange", sync);
  motion.addEventListener("change", sync);
  connection?.addEventListener("change", sync);
});
