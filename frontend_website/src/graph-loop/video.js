import "./graph-loop.css";

// Phones get a 4:5 cut of the loop, composed for a narrow screen. Keep this in
// step with the matching breakpoint in graph-loop.css.
const PORTRAIT_QUERY = "(max-width: 600px)";
// The 2880-wide cut goes only to wide figures on high-DPI screens. The width
// floor keeps a phone turned sideways (a dense screen, but a narrow figure) on
// the 1440 cut.
const SHARP_MIN_WIDTH = 960;
const SHARP_MIN_PIXELS = 1600;
// Start fetching once the figure is this close to scrolling into view.
const PRELOAD_MARGIN = "200px 0px";

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

  const sources = { portrait: video.dataset.srcPortrait, sharp: video.dataset.srcSharp, wide: video.dataset.src };
  const variantSrc = () => sources[variant] ?? sources.wide;

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
  const pickVariant = () => {
    if (portrait.matches && sources.portrait) return "portrait";
    const width = video.getBoundingClientRect().width;
    const sharp = width >= SHARP_MIN_WIDTH && width * (window.devicePixelRatio || 1) > SHARP_MIN_PIXELS;
    return sharp && sources.sharp ? "sharp" : "wide";
  };
  const applyVariant = () => {
    const next = pickVariant();
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
  // A window that grows wide, or moves to a high-DPI screen, upgrades to the
  // sharp cut. It never steps back down, so resizing cannot thrash the video.
  new ResizeObserver(() => {
    if (variant === "wide" && pickVariant() === "sharp") applyVariant();
  }).observe(video);

  // Visitors who never scroll this far never download the video.
  const preload = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    preload.disconnect();
    loadVideo();
  }, { rootMargin: PRELOAD_MARGIN });
  preload.observe(video);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }, { threshold: 0.01 }).observe(video);
  document.addEventListener("visibilitychange", sync);
  connection?.addEventListener("change", sync);
});
