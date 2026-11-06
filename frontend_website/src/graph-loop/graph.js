import {
  BackSide,
  CanvasTexture,
  Color,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { EDGES, LIT_NODES, LIT_STAGES, NODE_ROWS, T, nodeAppearAt, riseStart } from "./layout.js";
import { easeInBack, easeInCubic, easeInOutCubic, easeOutBack, easeOutElastic, hump, lerp, seg } from "./motion.js";

export const PALETTE = {
  ground: new Color(0xf4f2ed),
  ceramic: new Color(0xeeeae2),
  ink: new Color(0x16181c),
  cobalt: new Color(0x2457d6),
};

// Line widths in CSS pixels at the reference frame width; scene.js scales them.
const WIDTH = { edge: 1.5, thread: 1.3, lit: 3.0 };
const OPACITY = { edge: 0.34, thread: 0.42 };
// While the search runs, everything off the lit path steps back to these.
const DIMMED = { node: 0.38, edge: 0.12, thread: 0.16 };
const CURVE_POINTS = 24;

const rowIndex = Object.fromEntries(NODE_ROWS.flatMap((row, r) => row.ids.map((id) => [id, r])));
const pairKey = (a, b) => [a, b].sort().join("|");
const LIT_EDGE_KEYS = new Set(
  LIT_STAGES.filter((s) => s.kind === "edge").flatMap((s) => s.hops.map(([a, b]) => pairKey(a, b))),
);
const LIT_THREAD_NODES = new Set(LIT_STAGES.at(-1).hops.map(([node]) => node));

/** When the search pulse reaches each lit node, which then locks blue. */
const LOCK_AT = { T1: T.search[0][1], M1: T.search[1][1], M3: T.search[1][1], B1: T.search[2][1], B4: T.search[2][1] };

// Lines are opaque, with their strength mixed into the paper colour: see-through
// segments overlap at every joint and would read as beads along faint lines.
function makeLine(color, width, strength, points) {
  const geometry = new LineGeometry();
  geometry.setPositions(new Float32Array(points * 3));
  const material = new LineMaterial({ linewidth: width, depthWrite: false });
  const line = new Line2(geometry, material);
  line.frustumCulled = false;
  line.renderOrder = 2;
  line.userData = { points, color: new Color(color) };
  tint(line, strength);
  return line;
}

/** `under` is the strength of the ink line this one is drawn over, so a fading overlay never erases it. */
function tint(line, strength, under = 0) {
  line.material.color.copy(PALETTE.ground).lerp(PALETTE.ink, under).lerp(line.userData.color, strength);
}

const scratch = new Vector3();
/** Writes `pointAt(u)` for u in [0, reach] into the line, as segments sharing their ends. */
function writeLine(line, pointAt, reach) {
  const { points } = line.userData;
  const buffer = line.geometry.attributes.instanceStart.data;
  const arr = buffer.array;
  for (let i = 0; i < points; i += 1) {
    const p = pointAt((reach * i) / (points - 1), scratch);
    // Point i ends segment i - 1 and starts segment i.
    for (const at of [(i - 1) * 6 + 3, i * 6]) {
      if (at < 0 || at >= (points - 1) * 6) continue;
      arr[at] = p.x;
      arr[at + 1] = p.y;
      arr[at + 2] = p.z;
    }
  }
  buffer.needsUpdate = true;
}

/** A soft vertical S-curve from a file's top edge up to its node. */
export function threadPoint(from, to, u, out) {
  const rise = to.y - from.y;
  const v = 1 - u;
  const w0 = v * v * v;
  const w1 = 3 * v * v * u;
  const w2 = 3 * v * u * u;
  const w3 = u * u * u;
  return out.set(
    (w0 + w1) * from.x + (w2 + w3) * to.x,
    w0 * from.y + w1 * (from.y + rise * 0.5) + w2 * (to.y - rise * 0.5) + w3 * to.y,
    (w0 + w1) * from.z + (w2 + w3) * to.z,
  );
}

let haloTexture = null;
/** A soft cobalt glow, shared by the pulses, the lit files and the agent. */
export function haloSprite(opacity) {
  if (!haloTexture) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    haloTexture = new CanvasTexture(canvas);
  }
  return new Sprite(
    new SpriteMaterial({ map: haloTexture, color: PALETTE.cobalt, transparent: true, opacity, depthWrite: false, toneMapped: false }),
  );
}

function buildNodes(scene, layout) {
  const sphere = new SphereGeometry(1, 48, 32);
  const ringGeometry = new TorusGeometry(1, 0.035, 10, 96);
  return layout.nodes.map((node) => {
    const core = new Mesh(
      sphere,
      new MeshStandardMaterial({ color: PALETTE.ceramic, roughness: 0.84, metalness: 0 }),
    );
    core.castShadow = true;
    const hull = new Mesh(sphere, new MeshBasicMaterial({ color: PALETTE.ink, side: BackSide }));
    const ring = new Mesh(
      ringGeometry,
      new MeshBasicMaterial({ color: PALETTE.cobalt, transparent: true, toneMapped: false }),
    );
    scene.add(core, hull, ring);
    return {
      ...node,
      base: new Vector3(...node.pos),
      row: rowIndex[node.id],
      lit: LIT_NODES.has(node.id),
      appearAt: nodeAppearAt(node.id),
      core,
      hull,
      ring,
      pos: new Vector3(),
      size: 0,
      grown: 0,
    };
  });
}

function buildEdges(scene, byId) {
  return EDGES.map(([a, b]) => {
    // Draw each edge up from the row below, or out from the centre within a row.
    const across = byId[a].row === byId[b].row;
    const [from, to] = across
      ? [byId[a], byId[b]].sort((p, q) => Math.abs(p.base.x) - Math.abs(q.base.x))
      : [byId[a], byId[b]].sort((p, q) => p.row - q.row);
    const line = makeLine(PALETTE.ink, WIDTH.edge, OPACITY.edge, 2);
    scene.add(line);
    const drawAt = Math.max(from.appearAt, to.appearAt) + (across ? 0.1 : -0.2);
    return { from, to, line, drawAt, lit: LIT_EDGE_KEYS.has(pairKey(a, b)) };
  });
}

function makePulse(scene, radius, glowSize) {
  const dot = new Mesh(
    new SphereGeometry(radius, 24, 16),
    new MeshBasicMaterial({ color: PALETTE.cobalt, toneMapped: false }),
  );
  const glow = haloSprite(0.38);
  glow.scale.setScalar(glowSize);
  scene.add(dot, glow);
  return { dot, glow, glowSize };
}

function placePulse(pulse, on, point, grow = 1) {
  pulse.dot.visible = on;
  pulse.glow.visible = on;
  if (!on) return;
  pulse.dot.position.copy(point);
  pulse.glow.position.copy(point);
  pulse.glow.scale.setScalar(pulse.glowSize * grow);
}

export function createGraph(scene, layout) {
  const nodes = buildNodes(scene, layout);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges = buildEdges(scene, byId);

  const threads = nodes.filter((n) => n.row === 0).map((node) => {
    const line = makeLine(PALETTE.ink, WIDTH.thread, OPACITY.thread, CURVE_POINTS);
    scene.add(line);
    return { node, line, lit: LIT_THREAD_NODES.has(node.id), start: riseStart(node.id) };
  });

  // The lit path: one cobalt overlay per hop, a pulse going down and one coming back up.
  const hops = LIT_STAGES.flatMap((stage, s) => stage.hops.map(([a, b]) => {
    const line = makeLine(PALETTE.cobalt, WIDTH.lit, 0.95, stage.kind === "thread" ? CURVE_POINTS : 2);
    line.renderOrder = 3;
    scene.add(line);
    return { stage: s, kind: stage.kind, a, b, line, down: makePulse(scene, 0.085, 0.8), up: makePulse(scene, 0.1, 1.1) };
  }));

  const lines = [...edges.map((e) => e.line), ...threads.map((th) => th.line), ...hops.map((h) => h.line)];

  function updateNodes(t, camera, anchors, dim, unlight) {
    for (const n of nodes) {
      let grown;
      if (n.row === 0) {
        // Bottom nodes travel up their thread out of the file, and sink back at the end.
        const start = riseStart(n.id);
        const rise = easeInOutCubic(seg(t, start, start + T.rise.duration));
        const sink = easeInOutCubic(seg(t, ...T.sink));
        threadPoint(anchors[n.id], n.base, rise * (1 - sink), n.pos);
        grown = easeOutBack(seg(rise, 0, 0.45), 1.2) * (1 - easeInCubic(seg(sink, 0.55, 1)));
      } else {
        const fold = easeInOutCubic(seg(t, ...(n.row === 2 ? T.fold.top : T.fold.middle)));
        const appear = easeOutBack(seg(t, n.appearAt, n.appearAt + T.nodePop), 1.3);
        n.pos.copy(n.base);
        n.pos.y -= 0.55 * fold;
        grown = appear * (1 - easeInBack(fold, 1.2));
      }
      const lock = n.lit ? easeOutElastic(seg(t, LOCK_AT[n.id], LOCK_AT[n.id] + 0.7)) * (1 - unlight) : 0;
      n.grown = Math.max(0, grown);
      n.size = n.r * n.grown * (1 + 0.14 * lock);
      // Dimmed nodes fade toward the paper but stay solid, so edges never show through them.
      const fade = n.lit ? 0 : (1 - DIMMED.node) * dim;

      const visible = n.size > 0.001;
      n.core.visible = visible;
      n.hull.visible = visible;
      n.core.position.copy(n.pos);
      n.hull.position.copy(n.pos);
      n.core.scale.setScalar(n.size);
      n.hull.scale.setScalar(n.size * 1.07);
      n.core.material.color.copy(PALETTE.ceramic).lerp(PALETTE.ground, fade);
      n.hull.material.color.copy(PALETTE.ink).lerp(PALETTE.cobalt, lock).lerp(PALETTE.ground, fade);

      n.ring.visible = visible && lock > 0.001;
      n.ring.position.copy(n.pos);
      n.ring.quaternion.copy(camera.quaternion);
      n.ring.scale.setScalar(n.size * 1.75 * lock);
      n.ring.material.opacity = 0.9 * lock;
    }
  }

  function updateEdges(t, dim, lineScale) {
    for (const { from, to, line, drawAt, lit } of edges) {
      const reach = easeInOutCubic(seg(t, drawAt, drawAt + T.edgeDraw));
      const present = Math.min(1, Math.min(from.grown, to.grown) * 1.5);
      const opacity = (lit ? OPACITY.edge : lerp(OPACITY.edge, DIMMED.edge, dim)) * present;
      line.visible = reach > 0.001 && opacity > 0.003;
      if (!line.visible) continue;
      tint(line, opacity);
      line.material.linewidth = WIDTH.edge * lineScale;
      writeLine(line, (u, out) => out.lerpVectors(from.pos, to.pos, u), reach);
    }
  }

  function updateThreads(t, dim, anchors, lineScale) {
    for (const { node, line, lit, start } of threads) {
      const anchor = anchors[node.id];
      line.visible = t >= start && t < T.sinkEnd && node.pos.distanceTo(anchor) > 0.01;
      if (!line.visible) continue;
      tint(line, lit ? OPACITY.thread : lerp(OPACITY.thread, DIMMED.thread, dim));
      line.material.linewidth = WIDTH.thread * lineScale;
      // The thread runs from the file to wherever the node is right now.
      writeLine(line, (u, out) => threadPoint(anchor, node.pos, u, out), 1);
    }
  }

  // Each hop is walked from the agent's end (u = 0) toward the files (u = 1).
  function hopPoint(hop, u, out, agentPos, anchors) {
    if (hop.kind === "thread") return threadPoint(anchors[hop.a], byId[hop.a].pos, 1 - u, out);
    const from = hop.kind === "link" ? agentPos : byId[hop.a].pos;
    return out.lerpVectors(from, byId[hop.b].pos, u);
  }

  const point = new Vector3();
  // The answer climbs back: the thread hop goes first, the agent link last.
  const upWindows = [...T.returning].reverse();
  // How strong the ink line under each kind of hop is.
  const underOf = { link: 0, edge: OPACITY.edge, thread: OPACITY.thread };
  function updateHops(t, agent, anchors, lineScale, unlight) {
    const fade = 1 - unlight;
    for (const hop of hops) {
      const at = (u, out) => hopPoint(hop, u, out, agent.position, anchors);
      const drawWindow = hop.kind === "link" ? T.agentLink : T.search[hop.stage];
      const reach = easeInOutCubic(seg(t, ...drawWindow));
      hop.line.visible = agent.visible && reach > 0.001 && fade > 0.003;
      if (hop.line.visible) {
        tint(hop.line, fade, underOf[hop.kind]);
        hop.line.material.linewidth = WIDTH.lit * lineScale * (hop.kind === "link" ? 0.8 : 1);
        writeLine(hop.line, at, reach);
      }
      const down = seg(t, ...T.search[hop.stage]);
      placePulse(hop.down, agent.visible && down > 0 && down < 1, at(easeInOutCubic(down), point));
      const up = seg(t, ...upWindows[hop.stage]);
      placePulse(hop.up, agent.visible && up > 0 && up < 1, at(1 - easeInOutCubic(up), point), 1 + 0.25 * hump(up));
    }
  }

  return {
    lines,
    /** anchors: each bottom node's thread start (its file's top edge), keyed by node id. */
    update(t, camera, agent, anchors, lineScale) {
      const unlight = easeInOutCubic(seg(t, ...T.unlight));
      const dim = easeInOutCubic(seg(t, ...T.dim)) * (1 - unlight);
      updateNodes(t, camera, anchors, dim, unlight);
      updateEdges(t, dim, lineScale);
      updateThreads(t, dim, anchors, lineScale);
      updateHops(t, agent, anchors, lineScale, unlight);
      return { dim };
    },
  };
}
