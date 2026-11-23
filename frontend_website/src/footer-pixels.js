/**
 * Footer pixel field: the footer's background, a faint grid of white pixels
 * that swells and brightens around the cursor, leaves a fading trail behind
 * it, and sends a ring out on a click or tap that is not on a link.
 *
 * It sits behind the footer's text, so pixels near the wordmark, the link
 * columns and the base line stay dimmer and react less; the text always reads
 * first.
 *
 * Every cell eases toward its target brightness each frame (fast on the way
 * up, slow on the way down), and the cursor itself is smoothed, so motion stays
 * fluid at any pointer speed. The loop only runs while something is still
 * moving and the field is on screen; at rest the canvas is a static image.
 */

const PITCH = 11; // CSS px between pixel centres
const BASE_SIZE = 1.5; // CSS px, resting pixel
const PEAK_SIZE = 4.5; // CSS px, pixel right under the cursor
const BASE_ALPHA = 0.08;
const PEAK_ALPHA = 0.55; // brightest a pixel gets, so the field never outshines the links
const TEXT_DIM = 0.35; // strength left for pixels sitting behind text
const TEXT_FADE = 36; // CSS px over which pixels recover full strength away from text
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
  const footer = canvas?.closest("footer");
  if (!canvas || !context || !footer) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let dpr = 1;
  let columns = 0;
  let rows = 0;
  let offsetX = 0;
  let offsetY = 0;
  let levels = new Float32Array(0);
  let strength = new Float32Array(0); // per pixel: 1 in open space, TEXT_DIM behind text
  let baseLayer = null;

  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, inside: false, primed: false };
  const rings = [];
  let visible = false;
  let frame = 0;
  let lastTime = 0;

  // Pixels behind the footer's text keep only part of their strength, easing
  // back to full over TEXT_FADE so no hard-edged dim box appears around a block.
  function measureStrength() {
    const origin = canvas.getBoundingClientRect();
    const blocks = [...footer.querySelectorAll("a, p, span, h3, li > b")]
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({ left: rect.left - origin.left, right: rect.right - origin.left, top: rect.top - origin.top, bottom: rect.bottom - origin.top }));
    strength = new Float32Array(columns * rows);
    for (let row = 0; row < rows; row += 1) {
      const y = offsetY + row * PITCH;
      for (let column = 0; column < columns; column += 1) {
        const x = offsetX + column * PITCH;
        let nearest = Infinity;
        for (const block of blocks) {
          const dx = Math.max(block.left - x, 0, x - block.right);
          const dy = Math.max(block.top - y, 0, y - block.bottom);
          nearest = Math.min(nearest, Math.hypot(dx, dy));
        }
        const t = Math.min(1, nearest / TEXT_FADE);
        strength[row * columns + column] = TEXT_DIM + (1 - TEXT_DIM) * t * t * (3 - 2 * t);
      }
    }
  }

  // The resting grid never changes between resizes, so it is drawn once and blitted.
  function buildBaseLayer() {
    baseLayer = document.createElement("canvas");
    baseLayer.width = canvas.width;
    baseLayer.height = canvas.height;
    const base = baseLayer.getContext("2d");
    base.fillStyle = "#fff";
    const size = Math.max(1, Math.round(BASE_SIZE * dpr));
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const cx = (offsetX + column * PITCH) * dpr;
        const cy = (offsetY + row * PITCH) * dpr;
        base.globalAlpha = BASE_ALPHA * strength[row * columns + column];
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
    measureStrength();
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
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(baseLayer, 0, 0);
    context.fillStyle = "#fff";
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        const level = levels[index];
        if (level < 0.01) continue;
        const weight = strength[index];
        const size = Math.max(1, Math.round((BASE_SIZE + (PEAK_SIZE - BASE_SIZE) * level * weight) * dpr));
        const cx = (offsetX + column * PITCH) * dpr;
        const cy = (offsetY + row * PITCH) * dpr;
        context.globalAlpha = (BASE_ALPHA + (PEAK_ALPHA - BASE_ALPHA) * level) * weight;
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

  // The canvas sits behind the footer's content, so the footer listens for it.
  footer.addEventListener("pointermove", (event) => {
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

  footer.addEventListener("pointerleave", () => {
    pointer.inside = false;
    pointer.primed = false;
    schedule();
  });

  footer.addEventListener("pointerdown", (event) => {
    if (event.target.closest("a, button")) return;
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
  // Web fonts change where the text sits, and so which pixels stay dim.
  document.fonts?.ready.then(resize);

  reducedMotion.addEventListener("change", () => {
    levels.fill(0);
    rings.length = 0;
    draw();
  });
}
