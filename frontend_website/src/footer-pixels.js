/**
 * Footer pixel field: a grid of white pixels on black that swells and brightens
 * around the cursor, leaves a fading trail behind it, and sends a ring out on
 * click or tap.
 *
 * Every cell eases toward its target brightness each frame (fast on the way
 * up, slow on the way down), and the cursor itself is smoothed, so motion stays
 * fluid at any pointer speed. The loop only runs while something is still
 * moving and the field is on screen; at rest the canvas is a static image.
 */

const PITCH = 11; // CSS px between pixel centres
const BASE_SIZE = 1.6; // CSS px, resting pixel
const PEAK_SIZE = 6.5; // CSS px, pixel right under the cursor
const BASE_ALPHA = 0.16;
const RADIUS = 120; // CSS px of cursor influence
const RISE = 0.28; // per-frame easing toward a brighter target (at 60fps)
const FALL = 0.05; // per-frame easing back to rest, which draws the trail
const POINTER_EASE = 0.22;
const RING_SPEED = 0.55; // CSS px per ms
const RING_WIDTH = 26;
const RING_LIFETIME = 1400; // ms
const MAX_RINGS = 4;
const SETTLED = 0.002;

const easeRate = (rate, dt) => 1 - Math.pow(1 - rate, dt / (1000 / 60));

export function initialiseFooterPixels() {
  const canvas = document.querySelector("[data-footer-pixels]");
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let dpr = 1;
  let columns = 0;
  let rows = 0;
  let offsetX = 0;
  let offsetY = 0;
  let levels = new Float32Array(0);
  let baseLayer = null;

  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, inside: false, primed: false };
  const rings = [];
  let visible = false;
  let frame = 0;
  let lastTime = 0;

  // The resting grid never changes between resizes, so it is drawn once and blitted.
  function buildBaseLayer() {
    baseLayer = document.createElement("canvas");
    baseLayer.width = canvas.width;
    baseLayer.height = canvas.height;
    const base = baseLayer.getContext("2d");
    base.fillStyle = "#000";
    base.fillRect(0, 0, baseLayer.width, baseLayer.height);
    base.fillStyle = `rgba(255, 255, 255, ${BASE_ALPHA})`;
    const size = Math.max(1, Math.round(BASE_SIZE * dpr));
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const cx = (offsetX + column * PITCH) * dpr;
        const cy = (offsetY + row * PITCH) * dpr;
        base.fillRect(Math.round(cx - size / 2), Math.round(cy - size / 2), size, size);
      }
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    columns = Math.max(1, Math.floor(rect.width / PITCH));
    rows = Math.max(1, Math.floor(rect.height / PITCH));
    // Centre the grid so the margins on every side match.
    offsetX = (rect.width - (columns - 1) * PITCH) / 2;
    offsetY = (rect.height - (rows - 1) * PITCH) / 2;
    levels = new Float32Array(columns * rows);
    buildBaseLayer();
    draw();
  }

  function influenceAt(x, y, now) {
    let value = 0;
    if (pointer.inside) {
      const distance = Math.hypot(x - pointer.x, y - pointer.y);
      if (distance < RADIUS) {
        const falloff = 1 - distance / RADIUS;
        value = falloff * falloff * (3 - 2 * falloff);
      }
    }
    for (const ring of rings) {
      const age = now - ring.start;
      const band = (Math.hypot(x - ring.x, y - ring.y) - age * RING_SPEED) / RING_WIDTH;
      value = Math.max(value, Math.exp(-band * band) * (1 - age / RING_LIFETIME) * 0.9);
    }
    return value;
  }

  function draw() {
    if (!baseLayer) return;
    context.drawImage(baseLayer, 0, 0);
    context.fillStyle = "#fff";
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const level = levels[row * columns + column];
        if (level < 0.01) continue;
        const size = Math.max(1, Math.round((BASE_SIZE + (PEAK_SIZE - BASE_SIZE) * level) * dpr));
        const cx = (offsetX + column * PITCH) * dpr;
        const cy = (offsetY + row * PITCH) * dpr;
        context.globalAlpha = BASE_ALPHA + (1 - BASE_ALPHA) * level;
        context.fillRect(Math.round(cx - size / 2), Math.round(cy - size / 2), size, size);
      }
    }
    context.globalAlpha = 1;
  }

  function step(now) {
    frame = 0;
    const dt = Math.min(64, lastTime ? now - lastTime : 1000 / 60);
    lastTime = now;

    const follow = easeRate(POINTER_EASE, dt);
    pointer.x += (pointer.targetX - pointer.x) * follow;
    pointer.y += (pointer.targetY - pointer.y) * follow;
    for (let index = rings.length - 1; index >= 0; index -= 1) {
      if (now - rings[index].start > RING_LIFETIME) rings.splice(index, 1);
    }

    const rise = easeRate(RISE, dt);
    const fall = easeRate(FALL, dt);
    let moving = pointer.inside || rings.length > 0;
    for (let row = 0; row < rows; row += 1) {
      const y = offsetY + row * PITCH;
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        const target = influenceAt(offsetX + column * PITCH, y, now);
        const level = levels[index];
        const next = level + (target - level) * (target > level ? rise : fall);
        levels[index] = next < SETTLED ? 0 : next;
        if (levels[index] > 0) moving = true;
      }
    }

    draw();
    if (moving && visible) schedule();
    else lastTime = 0;
  }

  function schedule() {
    if (!frame && visible && !reducedMotion.matches) frame = requestAnimationFrame(step);
  }

  function localPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener("pointermove", (event) => {
    const { x, y } = localPoint(event);
    pointer.targetX = x;
    pointer.targetY = y;
    // Entering snaps the smoothed cursor in place so it never sweeps in from a corner.
    if (!pointer.primed) {
      pointer.x = x;
      pointer.y = y;
      pointer.primed = true;
    }
    pointer.inside = true;
    schedule();
  });

  canvas.addEventListener("pointerleave", () => {
    pointer.inside = false;
    pointer.primed = false;
    schedule();
  });

  canvas.addEventListener("pointerdown", (event) => {
    const { x, y } = localPoint(event);
    rings.push({ x, y, start: performance.now() });
    if (rings.length > MAX_RINGS) rings.shift();
    schedule();
  });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  }).observe(canvas);

  new ResizeObserver(resize).observe(canvas);

  reducedMotion.addEventListener("change", () => {
    levels.fill(0);
    rings.length = 0;
    draw();
  });
}
