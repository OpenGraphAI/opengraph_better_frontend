// A product film: one oversized "world" of UI that a virtual camera moves over.
// Every motion is a Web Animations track on one shared loop, keyed in seconds,
// so a scene reads like an edit decision list. Off screen or in a background
// tab the film pauses; with reduced motion it holds on its poster frame.

export const EASE = "cubic-bezier(.65,0,.35,1)";
export const OUT = "cubic-bezier(.22,1,.36,1)";
const SETTLE_S = 0.5;
const LEAVE_S = 0.4;
const VISIBLE_SHARE = 0.2;

/**
 * @param {HTMLElement} stage  element the film fills
 * @param {object} scene  { duration, end, poster, world: {w, h}, shots, camera, tilt?, build(ctx) }
 */
export function createFilm(stage, scene) {
  const { duration, end, world: size } = scene;
  const anims = [];
  let cameraAnims = [];

  const world = document.createElement("div");
  world.className = "film-world";
  world.style.width = `${size.w}px`;
  world.style.height = `${size.h}px`;
  const rig = document.createElement("div");
  rig.className = "film-rig";
  rig.append(world);
  stage.append(rig);

  /** One looping track; `keys` are [seconds, keyframe] pairs. */
  function track(el, keys, list = anims) {
    const frames = keys.map(([t, props]) => ({ offset: t / duration, ...props }));
    if (frames[0].offset > 0) frames.unshift({ ...frames[0], offset: 0 });
    if (frames.at(-1).offset < 1) frames.push({ ...frames.at(-1), offset: 1, easing: "linear" });
    const anim = el.animate(frames, { duration: duration * 1000, iterations: Infinity, fill: "both" });
    list.push(anim);
    return anim;
  }

  /** Arrive at t0 from `from`, hold until t1, then leave with everything else. */
  const show = (t0, from = {}, t1 = end) => {
    const rest = { opacity: 1, transform: "none", filter: "none" };
    return [
      [0, { opacity: 0, transform: "none", filter: "none", ...from }],
      [t0, { opacity: 0, transform: "none", filter: "none", ...from, easing: OUT }],
      [t0 + SETTLE_S, rest], [t1, rest],
      [Math.min(t1 + LEAVE_S, duration), { ...rest, opacity: 0 }],
    ];
  };

  /** Reveal text left to right in `chars` steps between t0 and t1. */
  const typing = (t0, t1, chars) => [
    [0, { clipPath: "inset(0 100% 0 0)" }],
    [t0, { clipPath: "inset(0 100% 0 0)", easing: `steps(${chars})` }],
    [t1, { clipPath: "inset(0 0% 0 0)" }],
  ];

  function cam(name, pad) {
    const { width, height } = stage.getBoundingClientRect();
    const [x, y, w, h] = scene.shots[name];
    const s = Math.min(width / w, height / h) * pad;
    return { transform: `translate(${width / 2 - (x + w / 2) * s}px, ${height / 2 - (y + h / 2) * s}px) scale(${s})` };
  }

  // The camera depends on the stage size, so it is rebuilt on resize.
  function buildCamera() {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return; // hidden stage: keep the last good camera
    const at = anims[0]?.currentTime ?? 0;
    const playing = anims[0]?.playState === "running";
    cameraAnims.forEach((anim) => anim.cancel());
    cameraAnims = [];
    track(world, scene.camera.map(([t, name, pad]) => [t, { ...cam(name, pad), easing: EASE }]), cameraAnims);
    const tilt = scene.tilt ?? [[0, 0, 0]];
    track(rig, tilt.map(([t, x, y]) => [t, { transform: `rotateX(${x}deg) rotateY(${y}deg)`, easing: EASE }]), cameraAnims);
    cameraAnims.forEach((anim) => {
      anim.currentTime = at;
      if (!playing) anim.pause();
    });
  }

  scene.build({ world, track, show, typing, end, duration });
  buildCamera();

  const all = () => [...anims, ...cameraAnims];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let visible = false;
  let userPaused = false;

  function sync() {
    if (reducedMotion.matches) {
      all().forEach((anim) => {
        anim.pause();
        anim.currentTime = scene.poster * 1000;
      });
      return;
    }
    const run = visible && !document.hidden && !userPaused;
    all().forEach((anim) => (run ? anim.play() : anim.pause()));
  }

  all().forEach((anim) => anim.pause());
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }, { threshold: VISIBLE_SHARE }).observe(stage);
  document.addEventListener("visibilitychange", sync);
  reducedMotion.addEventListener("change", sync);
  new ResizeObserver(() => {
    buildCamera();
    sync();
  }).observe(stage);
  sync();

  return {
    /** The viewer's own pause, kept until they press play again. */
    setPaused(paused) {
      userPaused = paused;
      sync();
    },
  };
}
