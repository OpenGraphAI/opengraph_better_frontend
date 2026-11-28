import assert from "node:assert/strict";
import { test } from "node:test";
import { EDGES, NODES, buildGrid, lineCells } from "../src/about-graph/layout.js";

const SIZES = [
  { name: "phone", width: 340, height: 220 },
  { name: "tablet", width: 720, height: 300 },
  { name: "desktop", width: 620, height: 520 },
];
const PITCH = 10;

const touches = (grid, a, b) => {
  const ax = a % grid.columns;
  const ay = Math.floor(a / grid.columns);
  const bx = b % grid.columns;
  const by = Math.floor(b / grid.columns);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by)) <= 1;
};

test("lineCells runs endpoint to endpoint with no gaps", () => {
  const cells = lineCells(0, 0, 7, 3);
  assert.deepEqual(cells[0], [0, 0]);
  assert.deepEqual(cells.at(-1), [7, 3]);
  assert.equal(cells.length, 8);
  for (let index = 1; index < cells.length; index += 1) {
    const [x0, y0] = cells[index - 1];
    const [x1, y1] = cells[index];
    assert.ok(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) === 1, `gap at step ${index}`);
  }
});

test("lineCells handles a reversed, steep line", () => {
  const cells = lineCells(4, 9, 2, 1);
  assert.deepEqual(cells[0], [4, 9]);
  assert.deepEqual(cells.at(-1), [2, 1]);
  assert.equal(cells.length, 9);
});

test("every edge joins two distinct, existing nodes", () => {
  for (const [a, b] of EDGES) {
    assert.ok(NODES[a] && NODES[b], `edge ${a}-${b} points at a missing node`);
    assert.notEqual(a, b);
  }
});

test("the graph is connected, so a walker can reach every node", () => {
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const node = queue.shift();
    for (const [a, b] of EDGES) {
      const next = a === node ? b : b === node ? a : -1;
      if (next >= 0 && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  assert.equal(seen.size, NODES.length);
});

for (const { name, width, height } of SIZES) {
  test(`${name}: nodes sit fully inside the grid and never overlap`, () => {
    const grid = buildGrid(width, height, PITCH);
    const owner = new Map();
    grid.nodeCells.forEach((cells, node) => {
      assert.ok(cells.length > 0, `node ${node} has no cells`);
      for (const cell of cells) {
        assert.ok(cell >= 0 && cell < grid.columns * grid.rows, `node ${node} leaves the grid`);
        assert.ok(!owner.has(cell), `nodes ${owner.get(cell)} and ${node} overlap`);
        owner.set(cell, node);
      }
    });
  });

  test(`${name}: each edge path runs between its two nodes without crossing a node`, () => {
    const grid = buildGrid(width, height, PITCH);
    const nodeCells = new Set(grid.nodeCells.flat());
    grid.edgePaths.forEach((path, index) => {
      const [a, b] = EDGES[index];
      assert.ok(path.length > 0, `edge ${a}-${b} is too short to draw`);
      assert.ok(path.every((cell) => !nodeCells.has(cell)), `edge ${a}-${b} runs through a node`);
      assert.ok(grid.nodeCells[a].some((cell) => touches(grid, cell, path[0])), `edge ${a}-${b} starts away from ${a}`);
      assert.ok(grid.nodeCells[b].some((cell) => touches(grid, cell, path.at(-1))), `edge ${a}-${b} ends away from ${b}`);
    });
  });

  test(`${name}: kinds mark node cells 2 and edge cells 1`, () => {
    const grid = buildGrid(width, height, PITCH);
    for (const cell of grid.nodeCells.flat()) assert.equal(grid.kinds[cell], 2);
    for (const cell of grid.edgePaths.flat()) assert.equal(grid.kinds[cell], 1);
  });
}

test("region: the graph stays inside its region of a larger full-bleed grid", () => {
  const region = { left: 1100, top: 120, right: 1880, bottom: 640 };
  const grid = buildGrid(1905, 1400, PITCH, region);
  const inside = (cell) => {
    const x = grid.offsetX + (cell % grid.columns) * PITCH;
    const y = grid.offsetY + Math.floor(cell / grid.columns) * PITCH;
    return x >= region.left && x <= region.right && y >= region.top && y <= region.bottom;
  };
  assert.ok(grid.columns >= 190, "grid should span the whole width");
  for (const cell of grid.nodeCells.flat()) assert.ok(inside(cell), "node cell outside region");
  for (const cell of grid.edgePaths.flat()) assert.ok(inside(cell), "edge cell outside region");
});

test("region: a phone-sized region below the text still fits every node apart", () => {
  const region = { left: 16, top: 520, right: 374, bottom: 760 };
  const grid = buildGrid(390, 1700, PITCH, region);
  const all = grid.nodeCells.flat();
  assert.equal(new Set(all).size, all.length, "nodes overlap");
  const nodeCells = new Set(all);
  for (const cell of grid.edgePaths.flat()) assert.ok(!nodeCells.has(cell), "edge runs through a node");
});

test("adjacency lists each edge under both of its nodes", () => {
  const grid = buildGrid(620, 520, PITCH);
  EDGES.forEach(([a, b], index) => {
    assert.ok(grid.adjacency[a].includes(index));
    assert.ok(grid.adjacency[b].includes(index));
  });
});
