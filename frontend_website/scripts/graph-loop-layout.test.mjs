import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EDGES,
  FILE_KINDS,
  LIT_FILES,
  LIT_STAGES,
  NODE_ROWS,
  T,
  layoutFor,
  mirrorOf,
  nodeAppearAt,
} from "../src/graph-loop/layout.js";
import { LOOP } from "../src/graph-loop/motion.js";

const key = (a, b) => [a, b].sort().join("|");
const near = (a, b) => Math.abs(a - b) < 1e-9;

for (const portrait of [false, true]) {
  const cut = portrait ? "portrait" : "wide";
  const layout = layoutFor(portrait);

  test(`${cut}: every node has a mirror partner at -x with the same height, depth and size`, () => {
    for (const node of layout.nodes) {
      const partner = layout.byId[mirrorOf(node.id)];
      assert.ok(partner, `no mirror for ${node.id}`);
      assert.ok(near(partner.pos[0], -node.pos[0]), `${node.id} x`);
      assert.ok(near(partner.pos[1], node.pos[1]), `${node.id} y`);
      assert.ok(near(partner.pos[2], node.pos[2]), `${node.id} z`);
      assert.equal(partner.r, node.r);
    }
  });

  test(`${cut}: the agent sits on the mirror line, above the top row`, () => {
    assert.equal(layout.agent[0], 0);
    const topY = Math.max(...layout.nodes.map((n) => n.pos[1]));
    assert.ok(layout.agent[1] > topY);
  });

  test(`${cut}: the lit files are a mirrored pair, image and code`, () => {
    const [a, b] = LIT_FILES.map((kind) => layout.files.find((f) => f.kind === kind));
    assert.ok(near(a.pos[0], -b.pos[0]));
    assert.ok(near(a.pos[1], b.pos[1]));
    assert.deepEqual([...LIT_FILES].sort(), ["code", "image"]);
  });

  test(`${cut}: every file has a thread to its own bottom-row node`, () => {
    assert.equal(layout.files.length, 6);
    const targets = new Set(layout.files.map((f) => f.node));
    assert.equal(targets.size, 6);
    for (const f of layout.files) assert.equal(layout.byId[f.node].row, "bottom");
  });
}

test("the edge set maps onto itself under the mirror", () => {
  const keys = new Set(EDGES.map(([a, b]) => key(a, b)));
  for (const [a, b] of EDGES) assert.ok(keys.has(key(mirrorOf(a), mirrorOf(b))), `${a}-${b}`);
});

test("the graph narrows upward: 6, 5 and 3 nodes", () => {
  assert.deepEqual(NODE_ROWS.map((row) => row.ids.length), [6, 5, 3]);
});

test("mirror partners appear at the same moment", () => {
  for (const row of NODE_ROWS) {
    for (const id of row.ids) assert.equal(nodeAppearAt(id), nodeAppearAt(mirrorOf(id)));
  }
});

test("the lit path runs over real edges, mirrored, from the top centre down to the lit files", () => {
  const keys = new Set(EDGES.map(([a, b]) => key(a, b)));
  const [first, ...rest] = LIT_STAGES;
  assert.equal(first.hops.length, 1);
  assert.equal(first.hops[0][0], "agent");
  for (const stage of rest.filter((s) => s.kind === "edge")) {
    assert.equal(stage.hops.length, 2);
    for (const [a, b] of stage.hops) assert.ok(keys.has(key(a, b)), `${a}-${b} is not an edge`);
    const [[a1, b1], [a2, b2]] = stage.hops;
    assert.equal(mirrorOf(a1), a2);
    assert.equal(mirrorOf(b1), b2);
  }
  const threadStage = LIT_STAGES.at(-1);
  assert.equal(threadStage.kind, "thread");
  const layout = layoutFor(false);
  const litNodes = threadStage.hops.map(([node]) => node);
  for (const kind of LIT_FILES) assert.ok(litNodes.includes(layout.files.find((f) => f.kind === kind).node));
});

test("the search goes down, the answer comes back up, and the reset ends before the loop does", () => {
  assert.ok(T.searchStart > T.agentLink[1] - 1e-9);
  assert.ok(T.returnStart > T.search.at(-1)[1]);
  assert.ok(T.receive[1] <= T.reset);
  assert.ok(T.sinkEnd <= LOOP);
  assert.ok(T.agentExit[1] <= LOOP);
});

test("every timed window sits inside the loop", () => {
  const windows = [T.agentEnter, T.agentLink, T.dim, T.fileLift, T.receive, T.unlight, T.fold.top, T.fold.middle, T.sink, T.agentExit, ...T.search, ...T.returning];
  for (const [a, b] of windows) assert.ok(a >= 0 && a < b && b <= LOOP, `${a}-${b}`);
  for (const start of T.agentMorphs) assert.ok(start + T.morphDuration <= T.agentExit[1]);
});

test("the agent's logo never changes while a pulse is travelling", () => {
  const busy = [...T.search, ...T.returning];
  for (const start of T.agentMorphs) {
    const end = start + T.morphDuration;
    for (const [a, b] of busy) assert.ok(end <= a || start >= b, `morph at ${start} overlaps pulse ${a}-${b}`);
  }
});

test("the file kinds match the sources the scene can build", () => {
  assert.deepEqual(FILE_KINDS, ["document", "image", "table", "waveform", "code", "database"]);
});
