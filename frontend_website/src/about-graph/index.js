/**
 * About-section pixel field: the background of the section's heading band
 * (down to the divider above "Open by design"), a dot grid that spans the full
 * width of the screen, with a small knowledge graph grown out of it
 * in the open space beside the heading. Nodes are chunky pixel blocks and edges
 * dotted lines, in the same pixel language as the heading and the footer field.
 *
 * A few walkers traverse the graph the way an agent follows relationships:
 * each runs along an edge in the signal colour, flares the node it reaches,
 * pauses, then takes another edge. Anywhere in the section, the cursor lifts
 * the pixels around it. Lit cells ease back to rest, leaving a fading trail.
 *
 * Dots behind the section's text and form stay dim so the copy always reads
 * first, and the field fades out toward the section's top and bottom so it
 * blends into its neighbours.
 *
 * Decorative only (the canvas is aria-hidden). The loop runs only while the
 * field is on screen; with reduced motion the graph is a still image.
 */

import { EDGES, KIND_EDGE, KIND_EMPTY, KIND_NODE, NODES, buildGrid } from "./layout.js";

const PITCH = 10; // CSS px between cell centres
const DOT_SIZE = 1.5; // empty cell
const EDGE_SIZE = 3;
const NODE_GAP = 2; // CSS px left between neighbouring node cells
const DOT_ALPHA = 0.12;
const EDGE_ALPHA = 0.3;
const NODE_ALPHA = 0.88;
const LIT_SIZE = 6; // edge or empty cell at full brightness
const TEXT_DIM = 0.3; // strength left for dots sitting behind text
const TEXT_FADE = 32; // CSS px over which dots recover full strength away from text
const EDGE_FADE_ROWS = 8; // rows over which the field fades in from the section's top and bottom
const HOVER_RADIUS = 110; // CSS px
const HOVER_LIFT = 0.55; // how far the cursor lifts a cell toward its lit size
const WALKERS = 3;
const WALK_SPEED = 0.02; // cells per ms
const PAUSE_MIN = 260; // ms resting on a node before the next edge
const PAUSE_SPREAD = 520;
const RISE = 0.3; // per-frame easing toward a brighter hover target (at 60fps)
const FALL = 0.045; // per-frame easing back to rest, which draws the trail
const SETTLED = 0.002;
const TEXT_SELECTOR = "h2, h3, p, li, a, button, label, input, textarea, select, .about-contact";

const easeRate = (rate, dt) => 1 - Math.pow(1 - rate, dt / (1000 / 60));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const smooth = (t) => t * t * (3 - 2 * t);

function readColours() {
  const style = getComputedStyle(document.documentElement);
  const ink = style.getPropertyValue("--ground-ink-rgb").trim() || "17 19 23";
  const signal = style.getPropertyValue("--signal").trim() || "#2457d6";
  return { ink: `rgb(${ink.replace(/\s+/g, ", ")})`, signal };
}

function restingLook(kind) {
  if (kind === KIND_NODE) return { size: PITCH - NODE_GAP, alpha: NODE_ALPHA, litSize: PITCH - NODE_GAP };
  if (kind === KIND_EDGE) return { size: EDGE_SIZE, alpha: EDGE_ALPHA, litSize: LIT_SIZE };
  return { size: DOT_SIZE, alpha: DOT_ALPHA, litSize: LIT_SIZE };
}

/** Choose the next edge out of `node`, avoiding a U-turn when there is another way. */
function nextEdge(grid, node, cameFrom) {
  const options = grid.adjacency[node].filter((edge) => edge !== cameFrom);
  return pick(options.length ? options : grid.adjacency[node]);
}

function spawnWalker(grid, now) {
  const node = Math.floor(Math.random() * NODES.length);
  return {
    edge: nextEdge(grid, node, -1),
    from: node,
    progress: 0,
    litUpTo: 0,
    restUntil: now + Math.random() * PAUSE_SPREAD * 2,
  };
}

/** Rects of the section's text, relative to the canvas, for dimming the dots behind them. */
function textBlocks(section, origin) {
  return [...section.querySelectorAll(TEXT_SELECTOR)]
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      left: rect.left - origin.left,
      right: rect.right - origin.left,
      top: rect.top - origin.top,
      bottom: rect.bottom - origin.top,
    }));
}

/**
 * Where the graph may grow, in canvas px: the open column the anchor holds in
 * the layout, stretched out to the screen's right edge so the graph bleeds
 * off the page instead of sitting in a box.
 */
function graphRegion(anchor, origin) {
  const rect = anchor.getBoundingClientRect();
  return {
    left: rect.left - origin.left,
    top: rect.top - origin.top,
    right: Math.max(rect.right - origin.left, origin.width - PITCH * 2),
    bottom: rect.bottom - origin.top,
  };
}

export function initialiseAboutGraph() {
  const canvas = document.querySelector("[data-about-field]");
  const context = canvas?.getContext("2d");
  const section = canvas?.closest("section");
  const anchor = section?.querySelector("[data-about-graph-anchor]");
  // The field covers only the heading band: it stops at the divider above .about-body.
  const stop = section?.querySelector(".about-body");
  if (!canvas || !context || !section || !anchor || !stop) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let colours = readColours();
  let grid = null;
  let dpr = 1;
  let strength = new Float32Array(0); // per cell: text dimming x top/bottom fade
  let lit = new Float32Array(0); // signal-coloured trail, 0..1
  let hover = new Float32Array(0); // cursor lift, 0..1
  let baseLayer = null;
  let walkers = [];
  const pointer = { x: 0, y: 0, inside: false };
  let visible = false;
  let frame = 0;
  let lastTime = 0;

  const cellX = (column) => grid.offsetX + column * PITCH;
  const cellY = (row) => grid.offsetY + row * PITCH;

  function measureStrength(origin) {
    const blocks = textBlocks(section, origin);
    strength = new Float32Array(grid.columns * grid.rows);
    for (let row = 0; row < grid.rows; row += 1) {
      const y = cellY(row);
      const inset = Math.min(row, grid.rows - 1 - row);
      const edgeFade = smooth(Math.min(1, inset / EDGE_FADE_ROWS));
      for (let column = 0; column < grid.columns; column += 1) {
        const x = cellX(column);
        let nearest = Infinity;
        for (const block of blocks) {
          const dx = Math.max(block.left - x, 0, x - block.right);
          const dy = Math.max(block.top - y, 0, y - block.bottom);
          nearest = Math.min(nearest, Math.hypot(dx, dy));
        }
        const text = TEXT_DIM + (1 - TEXT_DIM) * smooth(Math.min(1, nearest / TEXT_FADE));
        strength[row * grid.columns + column] = text * edgeFade;
      }
    }
  }

  function square(target, cx, cy, size) {
    const px = Math.max(1, Math.round(size * dpr));
    target.fillRect(Math.round(cx * dpr - px / 2), Math.round(cy * dpr - px / 2), px, px);
  }

  // The resting dot field only changes on resize or a palette flip, so it is
  // drawn once and blitted; each frame then paints only the graph and the
  // cells the cursor or a walker has woken.
  function buildBaseLayer() {
    baseLayer = document.createElement("canvas");
    baseLayer.width = canvas.width;
    baseLayer.height = canvas.height;
    const base = baseLayer.getContext("2d");
    base.fillStyle = colours.ink;
    for (let row = 0; row < grid.rows; row += 1) {
      for (let column = 0; column < grid.columns; column += 1) {
        const index = row * grid.columns + column;
        if (grid.kinds[index] !== KIND_EMPTY) continue;
        base.globalAlpha = DOT_ALPHA * strength[index];
        square(base, cellX(column), cellY(row), DOT_SIZE);
      }
    }
  }

  function fitToBand() {
    const height = stop.getBoundingClientRect().top - section.getBoundingClientRect().top;
    section.style.setProperty("--about-field-height", `${Math.max(0, Math.round(height))}px`);
  }

  function resize() {
    fitToBand();
    const origin = canvas.getBoundingClientRect();
    if (origin.width < PITCH || origin.height < PITCH) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(origin.width * dpr);
    canvas.height = Math.round(origin.height * dpr);
    grid = buildGrid(origin.width, origin.height, PITCH, graphRegion(anchor, origin));
    lit = new Float32Array(grid.columns * grid.rows);
    hover = new Float32Array(grid.columns * grid.rows);
    measureStrength(origin);
    buildBaseLayer();
    const now = performance.now();
    walkers = Array.from({ length: WALKERS }, () => spawnWalker(grid, now));
    draw();
    schedule();
  }

  function drawCell(index, column, row) {
    const kind = grid.kinds[index];
    const look = restingLook(kind);
    const weight = kind === KIND_EMPTY ? strength[index] : 1;
    const lift = hover[index] * HOVER_LIFT * weight;
    const cx = cellX(column);
    const cy = cellY(row);
    context.fillStyle = colours.ink;
    context.globalAlpha = (look.alpha + (1 - look.alpha) * lift * 0.6) * weight;
    square(context, cx, cy, look.size + (look.litSize - look.size) * lift);
    if (lit[index] < 0.02) return;
    context.fillStyle = colours.signal;
    context.globalAlpha = lit[index];
    square(context, cx, cy, look.size + (look.litSize - look.size) * lit[index]);
  }

  function draw() {
    if (!grid || !baseLayer) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(baseLayer, 0, 0);
    for (let row = 0; row < grid.rows; row += 1) {
      for (let column = 0; column < grid.columns; column += 1) {
        const index = row * grid.columns + column;
        const resting = grid.kinds[index] === KIND_EMPTY && hover[index] === 0 && lit[index] === 0;
        if (!resting) drawCell(index, column, row);
      }
    }
    context.globalAlpha = 1;
  }

  // Light only the cells the walker newly passed, so the trail fades behind it.
  function advanceWalker(walker, dt, now) {
    if (now < walker.restUntil) return;
    const path = grid.edgePaths[walker.edge];
    const [start, end] = EDGES[walker.edge];
    const forward = walker.from === start;
    walker.progress += WALK_SPEED * dt;
    const reached = Math.min(path.length, Math.floor(walker.progress));
    for (let step = walker.litUpTo; step < reached; step += 1) {
      lit[path[forward ? step : path.length - 1 - step]] = 1;
    }
    walker.litUpTo = reached;
    if (walker.progress < path.length) return;

    const arrived = forward ? end : start;
    for (const cell of grid.nodeCells[arrived]) lit[cell] = 1;
    walker.from = arrived;
    walker.edge = nextEdge(grid, arrived, walker.edge);
    walker.progress = 0;
    walker.litUpTo = 0;
    walker.restUntil = now + PAUSE_MIN + Math.random() * PAUSE_SPREAD;
  }

  function hoverTarget(column, row) {
    if (!pointer.inside) return 0;
    const dx = cellX(column) - pointer.x;
    const dy = cellY(row) - pointer.y;
    if (Math.abs(dx) > HOVER_RADIUS || Math.abs(dy) > HOVER_RADIUS) return 0;
    return smooth(Math.max(0, 1 - Math.hypot(dx, dy) / HOVER_RADIUS));
  }

  // Ease every cell toward its target; reports whether anything is still moving.
  function easeCells(dt) {
    const rise = easeRate(RISE, dt);
    const fall = easeRate(FALL, dt);
    let moving = pointer.inside;
    for (let row = 0; row < grid.rows; row += 1) {
      for (let column = 0; column < grid.columns; column += 1) {
        const index = row * grid.columns + column;
        const target = hoverTarget(column, row);
        const current = hover[index];
        if (target === 0 && current === 0 && lit[index] === 0) continue;
        const next = current + (target - current) * (target > current ? rise : fall);
        hover[index] = next < SETTLED ? 0 : next;
        const fading = lit[index] * (1 - fall);
        lit[index] = fading < SETTLED ? 0 : fading;
        if (hover[index] > 0 || lit[index] > 0) moving = true;
      }
    }
    return moving;
  }

  function step(now) {
    frame = 0;
    if (!grid) return;
    const dt = Math.min(64, lastTime ? now - lastTime : 1000 / 60);
    lastTime = now;
    const moving = easeCells(dt);
    const walking = !reducedMotion.matches;
    if (walking) for (const walker of walkers) advanceWalker(walker, dt, now);
    draw();
    if (visible && (walking || moving)) schedule();
    else lastTime = 0;
  }

  function schedule() {
    if (!frame && visible && grid) frame = requestAnimationFrame(step);
  }

  // The canvas sits behind the section's content, so the section listens for it.
  section.addEventListener("pointermove", (event) => {
    const origin = canvas.getBoundingClientRect();
    pointer.x = event.clientX - origin.left;
    pointer.y = event.clientY - origin.top;
    pointer.inside = true;
    schedule();
  });

  section.addEventListener("pointerleave", () => {
    pointer.inside = false;
    schedule();
  });

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  }).observe(canvas);

  // Watch the section (its layout sets the band's height) and the canvas itself,
  // so anything else that resizes the canvas (a stylesheet swap, a media query)
  // re-measures too and the drawing never gets stretched. Setting the same
  // height again does not fire the observer, so this cannot loop.
  const sizes = new ResizeObserver(resize);
  sizes.observe(section);
  sizes.observe(canvas);
  // Web fonts move the text, and with it the anchor and the dimmed dots.
  document.fonts?.ready.then(resize);

  // A palette flip is one data-theme attribute; repaint in the new colours.
  new MutationObserver(() => {
    colours = readColours();
    if (!grid) return;
    buildBaseLayer();
    draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  reducedMotion.addEventListener("change", () => {
    lit.fill(0);
    draw();
    schedule();
  });
}
