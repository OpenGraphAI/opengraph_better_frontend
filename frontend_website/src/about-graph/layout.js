/**
 * Geometry for the pixel graph beside "The open context layer" heading.
 *
 * The graph is fixed: a handful of nodes placed in unit coordinates and the
 * edges between them. buildGrid() rasterises it onto a square-cell grid of a
 * given size, so the canvas code only has to light cells, never do geometry.
 * Kept free of the DOM so it runs under `node --test`.
 */

// u, v in 0..1 across the drawable area; r is the node's radius in cells.
export const NODES = [
  { u: 0.06, v: 0.18, r: 2 },
  { u: 0.42, v: 0.04, r: 1 },
  { u: 0.86, v: 0.16, r: 2 },
  { u: 0.3, v: 0.52, r: 3 },
  { u: 0.7, v: 0.6, r: 2 },
  { u: 0.02, v: 0.9, r: 1 },
  { u: 0.46, v: 0.96, r: 2 },
  { u: 0.96, v: 0.94, r: 1 },
];

export const EDGES = [
  [0, 1],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 4],
  [3, 4],
  [3, 5],
  [3, 6],
  [4, 6],
  [4, 7],
  [5, 6],
];

export const KIND_EMPTY = 0;
export const KIND_EDGE = 1;
export const KIND_NODE = 2;

// Small grids drop every node one size so they still clear each other.
const COMPACT_CELLS = 30;

/** Bresenham line from (x0, y0) to (x1, y1), both ends included, 8-connected. */
export function lineCells(x0, y0, x1, y1) {
  const cells = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    cells.push([x, y]);
    if (x === x1 && y === y1) return cells;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y += sy;
    }
  }
}

/** The region, in px, converted to the inclusive range of cells fully inside it. */
function regionCells(region, grid) {
  const { columns, rows, offsetX, offsetY, pitch } = grid;
  const clamp = (value, max) => Math.min(max, Math.max(0, value));
  return {
    left: clamp(Math.ceil((region.left - offsetX) / pitch), columns - 1),
    right: clamp(Math.floor((region.right - offsetX) / pitch), columns - 1),
    top: clamp(Math.ceil((region.top - offsetY) / pitch), rows - 1),
    bottom: clamp(Math.floor((region.bottom - offsetY) / pitch), rows - 1),
  };
}

function placeNodes(cells) {
  const spanX = cells.right - cells.left;
  const spanY = cells.bottom - cells.top;
  const compact = Math.min(spanX, spanY) < COMPACT_CELLS;
  const radii = NODES.map(({ r }) => (compact ? Math.max(1, r - 1) : r));
  const pad = Math.max(...radii);
  return NODES.map(({ u, v }, index) => ({
    column: Math.round(cells.left + pad + u * (spanX - 2 * pad)),
    row: Math.round(cells.top + pad + v * (spanY - 2 * pad)),
    radius: radii[index],
  }));
}

// A filled disc of cells, squared off the way a pixel font draws a dot.
function discCells({ column, row, radius }, columns) {
  const cells = [];
  const limit = radius * radius + radius;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy <= limit) cells.push((row + dy) * columns + column + dx);
    }
  }
  return cells;
}

/**
 * Rasterise the graph onto a grid of `pitch`-sized cells filling width x height.
 * The grid always covers the whole area; the graph itself is fitted inside
 * `region` (px, { left, top, right, bottom }), which defaults to the whole area
 * less one cell of margin.
 * Returns the grid shape, a per-cell kind, each node's cells, each edge's cells
 * ordered from its first node to its second, and the edges touching each node.
 */
export function buildGrid(width, height, pitch, region = null) {
  const columns = Math.max(1, Math.floor(width / pitch));
  const rows = Math.max(1, Math.floor(height / pitch));
  const offsetX = (width - (columns - 1) * pitch) / 2;
  const offsetY = (height - (rows - 1) * pitch) / 2;

  const area = region ?? { left: pitch, top: pitch, right: width - pitch, bottom: height - pitch };
  const placed = placeNodes(regionCells(area, { columns, rows, offsetX, offsetY, pitch }));
  const nodeCells = placed.map((node) => discCells(node, columns));
  const edgePaths = EDGES.map(([a, b]) => {
    const own = new Set([...nodeCells[a], ...nodeCells[b]]);
    return lineCells(placed[a].column, placed[a].row, placed[b].column, placed[b].row)
      .map(([x, y]) => y * columns + x)
      .filter((cell) => !own.has(cell));
  });

  const kinds = new Uint8Array(columns * rows);
  for (const cell of edgePaths.flat()) kinds[cell] = KIND_EDGE;
  for (const cell of nodeCells.flat()) kinds[cell] = KIND_NODE;

  const adjacency = NODES.map(() => []);
  EDGES.forEach(([a, b], index) => {
    adjacency[a].push(index);
    adjacency[b].push(index);
  });

  return { columns, rows, offsetX, offsetY, pitch, kinds, nodeCells, edgePaths, adjacency };
}
