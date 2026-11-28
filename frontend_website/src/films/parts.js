// Building blocks for product films. Everything is placed in world pixels;
// the camera in engine.js decides what is on screen.
import { EASE, OUT } from "./engine.js";

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
export const esc = (text) => String(text).replace(/[&<>"]/g, (char) => ESCAPES[char]);

export function el(tag, className, html = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}

export function place(node, { x, y, w, h }) {
  Object.assign(node.style, { left: `${x}px`, top: `${y}px` });
  if (w !== undefined) node.style.width = `${w}px`;
  if (h !== undefined) node.style.height = `${h}px`;
  return node;
}

/** Position of `node` inside `world`, in world pixels (before any camera transform). */
export function posIn(world, node) {
  let x = 0;
  let y = 0;
  for (let current = node; current && current !== world; current = current.offsetParent) {
    x += current.offsetLeft;
    y += current.offsetTop;
  }
  return { x, y, w: node.offsetWidth, h: node.offsetHeight };
}

/** A paper app window with the build command typed into its title bar. */
export function appWindow(parent, { x, y, w, h, command }) {
  const win = place(el("div", "film-win"), { x, y, w, h });
  const bar = el("div", "film-bar");
  const cmd = el("span", "film-clip", esc(command));
  const pill = el("div", "film-cmd", "<b>$</b>");
  pill.append(cmd);
  bar.append(pill);
  win.append(bar);
  parent.append(win);
  return { el: win, cmd, chars: command.length };
}

/** A photo, optionally cropped: crop is the visible part of the image in 0–1 units. */
export function photo(parent, { x, y, w, h, src, aspect, crop = { x: 0, y: 0, w: 1 }, name }) {
  const frame = place(el("figure", "film-photo"), { x, y, w, h });
  const width = w / crop.w;
  const height = width * aspect;
  const img = el("img", "film-shot");
  Object.assign(img, { src, alt: "", decoding: "async" });
  Object.assign(img.style, { width: `${width}px`, height: `${height}px`, left: `${-crop.x * width}px`, top: `${-crop.y * height}px` });
  frame.append(img);
  if (name) frame.append(el("figcaption", "film-name", esc(name)));
  parent.append(frame);
  return { el: frame, shot: img, ...overlays(frame) };
}

/** Detection boxes in a photo's own pixels; `place` moves a label below or inside. */
export function boxes(frame, list) {
  return list.map((box) => {
    const node = place(el("span", `film-box ${box.place ?? ""}`, `<b>${esc(box.label)}</b>`), box);
    frame.append(node);
    return { ...box, el: node };
  });
}

/** Nodes as pills and edges as drawn lines, in the parent's coordinate space. */
export function graph(parent, { width, height, nodes, edges }) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "film-edges");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  Object.assign(svg.style, { width: `${width}px`, height: `${height}px` });
  parent.append(svg);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const drawn = edges.map(({ from, to, label }) => {
    const a = byId.get(from);
    const b = byId.get(to);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    Object.entries({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, pathLength: 1 }).forEach(([key, value]) => line.setAttribute(key, value));
    svg.append(line);
    if (!label) return { line };
    const rel = place(el("span", "film-rel", esc(label)), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    parent.append(rel);
    return { line, rel };
  });
  const pills = new Map(nodes.map((node) => {
    const pill = place(el("span", `film-node${node.hub ? " is-hub" : ""}`, esc(node.label)), node);
    parent.append(pill);
    return [node.id, pill];
  }));
  return { nodes: pills, edges: drawn };
}

// ── Beats shared by every film ────────────────────────────────────────────────

/** Fly a node in from a world point (usually the box or text it was read from). */
export function flyNode(ctx, pill, from, t) {
  const to = { x: parseFloat(pill.style.left), y: parseFloat(pill.style.top) };
  const start = `translate(${from.x - to.x}px, ${from.y - to.y}px) scale(.6)`;
  ctx.track(pill, [
    [0, { opacity: 0, transform: start }], [t, { opacity: 0, transform: start }],
    [t + 0.1, { opacity: 1, transform: start, easing: EASE }], [t + 0.8, { opacity: 1, transform: "none" }],
    [ctx.end, { opacity: 1, transform: "none" }], [ctx.end + 0.4, { opacity: 0, transform: "none" }],
  ]);
}

/** Draw each edge in turn, then drop its relation label onto it. */
export function drawEdges(ctx, edges, t0, gap = 0.3) {
  edges.forEach(({ line, rel }, index) => {
    const t = t0 + index * gap;
    ctx.track(line, [
      [0, { strokeDashoffset: 1 }], [t, { strokeDashoffset: 1, easing: EASE }], [t + 0.5, { strokeDashoffset: 0 }],
      [ctx.end, { strokeDashoffset: 0 }], [ctx.end + 0.4, { strokeDashoffset: 1 }],
    ]);
    if (rel) ctx.track(rel, ctx.show(t + 0.35, { transform: "translateY(6px)" }));
  });
}

/** Soften `nodes` while the camera looks elsewhere. */
export function defocus(ctx, nodes, t0, t1) {
  nodes.forEach((node) => ctx.track(node, [
    [0, { filter: "blur(0px)", opacity: 1 }], [t0, { filter: "blur(0px)", opacity: 1, easing: EASE }],
    [t0 + 0.6, { filter: "blur(6px)", opacity: 0.5 }], [t1, { filter: "blur(6px)", opacity: 0.5, easing: EASE }],
    [t1 + 0.7, { filter: "blur(0px)", opacity: 1 }],
  ]));
}

/** Mark a source as cited: a ring settles on it and a light sweeps across. */
export function cite(ctx, { ring, sweep }, t) {
  ctx.track(ring, ctx.show(t));
  ctx.track(sweep, [
    [0, { opacity: 0, transform: "translateX(0) skewX(-18deg)" }],
    [t, { opacity: 1, transform: "translateX(0) skewX(-18deg)", easing: "ease-in-out" }],
    [t + 0.8, { opacity: 1, transform: "translateX(400%) skewX(-18deg)" }],
    [t + 0.81, { opacity: 0, transform: "translateX(400%) skewX(-18deg)" }],
  ]);
}

/** Fade a source back while the cited ones light up (through its veil, so its own entrance is untouched). */
export function dim(ctx, { veil }, t) {
  ctx.track(veil, [[0, { opacity: 0 }], [t, { opacity: 0, easing: OUT }], [t + 0.5, { opacity: 0.6 }], [ctx.end, { opacity: 0.6 }], [ctx.end + 0.4, { opacity: 0 }]]);
}

/** The overlays every source carries: a sweep and a ring for citing, a veil for dimming. */
function overlays(node) {
  const sweep = el("span", "film-sweep");
  const ring = el("span", "film-ring");
  const veil = el("span", "film-veil");
  node.append(veil, sweep, ring);
  return { sweep, ring, veil };
}

/** Boxes snap on one after another, then clear before the next beat. */
export function snapBoxes(ctx, list, t0, until) {
  list.forEach((box, index) => ctx.track(box.el, ctx.show(t0 + index * 0.15, { transform: "scale(1.2)" }, until)));
}

// ── Documents and sheets ──────────────────────────────────────────────────────

/** A document page. Wrap a passage in [[double brackets]] to make it a mark. */
export function doc(parent, { x, y, w, h, name, title, lines }) {
  const page = place(el("article", "film-doc"), { x, y, w, h });
  const body = el("div", "film-doc-body"); // blurred on its own, so the page's entrance is untouched
  body.append(el("p", "film-doc-name", esc(name)));
  if (title) body.append(el("h3", "film-doc-title", esc(title)));
  lines.forEach((line) => {
    const html = esc(line).replace(/\[\[(.+?)\]\]/g, '<mark class="film-mark">$1</mark>');
    body.append(el("p", "film-doc-line", html));
  });
  page.append(body);
  const marks = [...body.querySelectorAll(".film-mark")];
  parent.append(page);
  return { el: page, body, marks, ...overlays(page) };
}

/** Run a highlighter over a mark. */
export function highlight(ctx, mark, t, until = ctx.end) {
  ctx.track(mark, [
    [0, { backgroundSize: "0% 100%" }], [t, { backgroundSize: "0% 100%", easing: EASE }],
    [t + 0.6, { backgroundSize: "100% 100%" }], [until, { backgroundSize: "100% 100%" }], [until + 0.4, { backgroundSize: "0% 100%" }],
  ]);
}

/** A spreadsheet tab: a header row, then data rows. */
export function sheet(parent, { x, y, w, h, name, columns, rows }) {
  const win = place(el("div", "film-sheet"), { x, y, w, h });
  win.append(el("p", "film-sheet-name", esc(name)));
  const table = el("div", "film-grid");
  table.style.gridTemplateColumns = `repeat(${columns.length}, auto)`;
  columns.forEach((column) => table.append(el("span", "film-cell is-head", esc(column))));
  const cells = rows.map((row) => row.map((value) => {
    const cell = el("span", "film-cell", esc(value));
    table.append(cell);
    return cell;
  }));
  win.append(table);
  parent.append(win);
  return { el: win, body: table, cells, ...overlays(win) };
}

/** Light a cell (or several) as evidence. */
export function glow(ctx, cells, t, until = ctx.end) {
  const off = { backgroundColor: "rgba(36,87,214,0)", color: "#111317" };
  const on = { backgroundColor: "rgba(36,87,214,.14)", color: "#2457d6" };
  cells.forEach((cell, index) => ctx.track(cell, [
    [0, off], [t + index * 0.08, { ...off, easing: OUT }], [t + index * 0.08 + 0.4, on], [until, on], [until + 0.4, off],
  ]));
}
