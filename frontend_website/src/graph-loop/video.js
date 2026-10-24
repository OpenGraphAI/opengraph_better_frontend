import "./graph-loop.css";

// Phones get a 4:5 cut of the loop, composed for a narrow screen. Keep this in
// step with the matching breakpoint in graph-loop.css.
const PORTRAIT_QUERY = "(max-width: 600px)";

// The landing page plays the rendered scene without downloading a 3D engine.
// The loop is muted, ambient, and the page's main illustration, so it plays
// even when the visitor prefers reduced motion; scroll effects still honour it.
document.querySelectorAll("[data-graph-video]").forEach((video) => {
  const source = video.querySelector("source");
  const portrait = window.matchMedia(PORTRAIT_QUERY);
  const connection = navigator.connection;
  let visible = false;
  let loaded = false;
  let variant = null;

  const variantSrc = () => (variant === "portrait" ? video.dataset.srcPortrait : video.dataset.src);

  const loadVideo = () => {
    if (loaded || !source) return;
    source.src = variantSrc();
    video.load();
    loaded = true;
  };

  // iOS Low Power Mode and some Android battery savers refuse muted autoplay
  // until the visitor interacts, so retry on the first tap or key press.
  const gestureEvents = ["touchend", "click", "keydown"];
  let waitingForGesture = false;
  const resumeOnGesture = () => {
    waitingForGesture = false;
    gestureEvents.forEach((type) => document.removeEventListener(type, resumeOnGesture, true));
    sync();
  };
  const retryOnGesture = () => {
    if (waitingForGesture) return;
    waitingForGesture = true;
    gestureEvents.forEach((type) => document.addEventListener(type, resumeOnGesture, { capture: true, passive: true }));
  };

  function sync() {
    if (!visible || document.hidden || connection?.saveData) {
      video.pause();
      return;
    }
    loadVideo();
    // Mobile browsers only autoplay inline video that is muted as a property, not just an attribute.
    video.muted = true;
    video.playsInline = true;
    // Until playback is allowed, the poster stays visible.
    video.play().catch((error) => {
      if (error?.name === "NotAllowedError") retryOnGesture();
    });
  }

  // Pick the cut for the current screen; rotating a phone swaps it.
  const applyVariant = () => {
    const next = portrait.matches && video.dataset.srcPortrait ? "portrait" : "wide";
    if (next === variant) return;
    variant = next;
    video.poster = (next === "portrait" ? video.dataset.posterPortrait : video.dataset.poster) ?? "";
    if (!loaded) return;
    loaded = false;
    loadVideo();
    sync();
  };
  applyVariant();
  portrait.addEventListener("change", applyVariant);

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadVideo, { timeout: 2000 });
  } else {
    window.setTimeout(loadVideo, 1200);
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }, { threshold: 0.01 }).observe(video);
  document.addEventListener("visibilitychange", sync);
  connection?.addEventListener("change", sync);
});
