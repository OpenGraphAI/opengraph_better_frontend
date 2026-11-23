// The "Shelf" composition: six files in a row along the bottom, a graph that
// narrows upward like a fountain (6, 5 and 3 nodes), and the agent at top
// centre. Everything is mirror-symmetric about x = 0. World units: the wide
// frame shows roughly x in [-7.6, 7.6], y in [-3.3, 3.3] at z = 0.
//
// This module is plain data and timing, with no three.js, so the symmetry
// and timeline are unit-tested in scripts/graph-loop-layout.test.mjs.

/** Left to right, the file each bottom-row node B0-B5 rises out of. */
export const FILE_KINDS = ["document", "image", "table", "waveform", "code", "database"];

/** The mirrored pair of files the agent's search lands on. */
export const LIT_FILES = ["image", "code"];

export const NODE_ROWS = [
  { name: "bottom", ids: ["B0", "B1", "B2", "B3", "B4", "B5"] },
  { name: "middle", ids: ["M0", "M1", "M2", "M3", "M4"] },
  { name: "top", ids: ["T0", "T1", "T2"] },
];

const rowOf = (id) => NODE_ROWS.find((row) => row.ids.includes(id));

/** B1 <-> B4, M0 <-> M4, T1 <-> T1, ... */
export const mirrorOf = (id) => {
  if (id === "agent") return id;
  const { ids } = rowOf(id);
  return ids[ids.length - 1 - ids.indexOf(id)];
};

/** How far a node sits from the centre of its row: 0 for the centre pair. */
const rankOf = (id) => {
  const { ids } = rowOf(id);
  const i = ids.indexOf(id);
  return Math.floor(Math.abs(i - (ids.length - 1) / 2));
};

export const EDGES = [
  // Each middle node sits between two bottom nodes.
  ...[0, 1, 2, 3, 4].flatMap((i) => [[`M${i}`, `B${i}`], [`M${i}`, `B${i + 1}`]]),
  ["M0", "M1"], ["M1", "M2"], ["M2", "M3"], ["M3", "M4"],
  ["T0", "M0"], ["T0", "M1"], ["T2", "M3"], ["T2", "M4"],
  ["T1", "M1"], ["T1", "M2"], ["T1", "M3"],
  ["T0", "T1"], ["T1", "T2"],
];

/** When each part of the loop happens, in seconds of a 12 s loop. */
export const T = {
  rise: { start: 1.4, stagger: 0.16, duration: 1.0 },
  middle: { start: 2.75, stagger: 0.14 },
  top: { start: 3.75, stagger: 0.14 },
  nodePop: 0.5,
  edgeDraw: 0.55,
  agentEnter: [4.7, 5.5],
  agentLink: [5.55, 5.9],
  searchStart: 5.9,
  // Pulse windows: agent -> T1, T1 -> M1/M3, M1/M3 -> B1/B4, B1/B4 down the threads.
  search: [[5.9, 6.25], [6.25, 6.7], [6.7, 7.15], [7.15, 7.6]],
  dim: [6.0, 6.7],
  fileLift: [7.45, 8.0],
  // The answer travels back up the same path, faster.
  returnStart: 8.35,
  returning: [[8.35, 8.7], [8.7, 9.0], [9.0, 9.3], [9.3, 9.6]],
  receive: [9.6, 10.05],
  reset: 10.05,
  unlight: [10.05, 10.6],
  fold: { top: [10.25, 10.75], middle: [10.6, 11.1] },
  sink: [11.0, 11.8],
  sinkEnd: 11.8,
  agentExit: [10.95, 11.55],
  // The agent's mark changes on arrival and after it has the answer, never mid-pulse.
  agentMorphs: [5.05, 10.1, 10.42, 10.74],
  morphDuration: 0.28,
};

/** When a node pops into place. Bottom nodes "appear" once they reach the top of their thread. */
export function nodeAppearAt(id) {
  const row = rowOf(id);
  const rank = rankOf(id);
  if (row.name === "bottom") return T.rise.start + rank * T.rise.stagger + T.rise.duration;
  const timing = T[row.name];
  return timing.start + rank * timing.stagger;
}

/** When bottom node B<i> starts rising out of its file. */
export const riseStart = (id) => T.rise.start + rankOf(id) * T.rise.stagger;

/**
 * The lit search path, stage by stage. Edge stages pair a node with its mirror
 * partner; the last stage runs down the threads into the lit files.
 */
export const LIT_STAGES = [
  { kind: "link", hops: [["agent", "T1"]] },
  { kind: "edge", hops: [["T1", "M1"], ["T1", "M3"]] },
  { kind: "edge", hops: [["M1", "B1"], ["M3", "B4"]] },
  { kind: "thread", hops: [["B1", "image"], ["B4", "code"]] },
];

export const LIT_NODES = new Set(["T1", "M1", "M3", "B1", "B4"]);

const WIDE = {
  rowY: { bottom: -0.42, middle: 0.52, top: 1.46 },
  rowZ: { bottom: 0.25, middle: 0, top: -0.25 },
  spacing: 2.1,
  radius: { bottom: 0.25, middle: 0.25, top: 0.27 },
  agent: [0, 2.5, -0.25],
  // One row of six files.
  fileAt: (i, spacing) => [(i - 2.5) * spacing, -2.22, 0.35],
  ground: -2.92,
};

// Phones: two rows of three files under a narrower graph. The upper row sits
// in front, so the lower row's threads rise behind it.
const PORTRAIT_FILE_SLOTS = {
  document: [-2.55, -3.85, -0.6],
  table: [0, -3.85, -0.6],
  database: [2.55, -3.85, -0.6],
  image: [-2.55, -1.95, 0.55],
  waveform: [0, -1.95, 0.55],
  code: [2.55, -1.95, 0.55],
};

const PORTRAIT = {
  rowY: { bottom: 0.1, middle: 1.35, top: 2.6 },
  rowZ: { bottom: 0.15, middle: 0, top: -0.2 },
  spacing: 1.3,
  radius: { bottom: 0.24, middle: 0.24, top: 0.26 },
  agent: [0, 3.85, -0.2],
  fileAt: (i) => PORTRAIT_FILE_SLOTS[FILE_KINDS[i]],
  ground: -4.6,
};

/** Positions for the wide (default) or portrait cut. */
export function layoutFor(portrait = false) {
  const spec = portrait ? PORTRAIT : WIDE;
  const nodes = NODE_ROWS.flatMap(({ name, ids }) =>
    ids.map((id, i) => ({
      id,
      row: name,
      pos: [(i - (ids.length - 1) / 2) * spec.spacing, spec.rowY[name], spec.rowZ[name]],
      r: spec.radius[name],
    })),
  );
  const files = FILE_KINDS.map((kind, i) => ({ kind, node: `B${i}`, pos: spec.fileAt(i, spec.spacing) }));
  return {
    nodes,
    byId: Object.fromEntries(nodes.map((n) => [n.id, n])),
    files,
    agent: spec.agent,
    ground: spec.ground,
  };
}
