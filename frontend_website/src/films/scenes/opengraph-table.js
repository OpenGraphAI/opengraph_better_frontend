// OpenGraph Table: the camera dollies across two spreadsheets, the same
// supplier lights up in both and merges into one node, then Claude asks which
// supplier costs the most and the cited sheet lights up.
import { askCamera, askTiming, claudeBeat, claudePanel, CLAUDE_SHOTS, CLAUDE_SLOT, WORLD } from "../claude.js";
import { EASE } from "../engine.js";
import { appWindow, cite, dim, drawEdges, el, flyNode, glow, graph, place, posIn, sheet } from "../parts.js";

const SHEET = { y: 96, w: 540, h: 236 };
const SUPPLIERS = {
  x: 40,
  name: "suppliers.xlsx",
  columns: ["supplier", "part", "renewal_date"],
  rows: [["Acme Robotics", "drive units", "2026-03-01"], ["Borealis Parts", "sensors", "2026-06-15"], ["Cobalt Motion", "gearboxes", "2026-01-20"]],
};
const COSTS = {
  x: 620,
  name: "q3-costs.csv",
  columns: ["supplier", "total_cost"],
  rows: [["Acme Robotics", "412,000"], ["Borealis Parts", "168,500"], ["Cobalt Motion", "97,300"]],
};
const HUB = { x: 600, y: 480 };
const ASK = {
  repo: "tables",
  task: "Rank suppliers",
  prompt: "Which supplier costs the most?",
  calls: [{ server: "OpenGraph", tool: "query_graph" }],
  answer: "Acme Robotics, from the `total_cost` column of `q3-costs.csv`.",
};
const ASK_AT = 8.0;
const { citeAt } = askTiming(ASK_AT, ASK);
const DURATION = Math.ceil(citeAt + 2.3);
const ask = askCamera(ASK_AT, ASK, DURATION);

export default {
  duration: DURATION,
  end: DURATION - 0.8,
  poster: DURATION - 1,
  world: WORLD,
  shots: {
    command: [24, 14, 500, 50],
    left: [24, 84, 572, 260],
    right: [604, 84, 572, 260],
    both: [24, 84, 1152, 620],
    ...CLAUDE_SHOTS,
  },
  // A dolly from one sheet to the other before pulling back to see them merge.
  camera: [
    [0, "command", 0.8], [1.5, "command", 0.8], [2.3, "left", 0.9], [3.2, "left", 0.9],
    [4.0, "right", 0.9], [4.6, "right", 0.9], [5.4, "both", 0.94], [7.5, "both", 0.96],
    ...ask.camera, [DURATION, "command", 0.8],
  ],
  tilt: ask.tilt,

  build(ctx) {
    const { world, track, show, typing } = ctx;
    const app = appWindow(world, { x: 0, y: 0, w: 1200, h: 760, command: "opengraph-table build ./tables" });
    const suppliers = sheet(app.el, { ...SHEET, ...SUPPLIERS });
    const costs = sheet(app.el, { ...SHEET, ...COSTS });
    const memory = graph(app.el, {
      width: 1200,
      height: 760,
      nodes: [
        { id: "acme", label: "Acme Robotics", ...HUB, hub: true },
        { id: "part", label: "drive units", x: 400, y: 620 },
        { id: "cost", label: "total_cost 412,000", x: 800, y: 620 },
      ],
      edges: [{ from: "acme", to: "part", label: "supplies" }, { from: "acme", to: "cost", label: "costs" }],
    });
    // The second copy of the supplier, flying in from the other sheet to merge.
    const twin = place(el("span", "film-node is-hub", "Acme Robotics"), HUB);
    app.el.append(twin);
    const panel = claudePanel(world, { ...CLAUDE_SLOT, ...ASK });

    // Beat 1: the sheets open one after the other as the camera dollies across.
    track(app.el, show(0, { transform: "scale(.98)" }));
    track(app.cmd, typing(0.5, 1.4, app.chars));
    track(suppliers.el, show(2.0, { transform: "translateY(24px) scale(.97)" }));
    track(costs.el, show(3.5, { transform: "translateY(24px) scale(.97)" }));

    // Beat 2: the matching rows light up and the two records become one node.
    glow(ctx, [suppliers.cells[0][0], costs.cells[0][0]], 4.9);
    const centre = (cell) => {
      const { x, y, w, h } = posIn(world, cell);
      return { x: x + w / 2, y: y + h / 2 };
    };
    const fromCosts = centre(costs.cells[0][0]);
    const start = `translate(${fromCosts.x - HUB.x}px, ${fromCosts.y - HUB.y}px) scale(.6)`;
    track(twin, [
      [0, { opacity: 0, transform: start }], [5.6, { opacity: 0, transform: start }],
      [5.7, { opacity: 1, transform: start, easing: EASE }], [6.4, { opacity: 1, transform: "none" }], [6.6, { opacity: 0, transform: "none" }],
    ]);
    flyNode(ctx, memory.nodes.get("acme"), centre(suppliers.cells[0][0]), 5.6);
    glow(ctx, [suppliers.cells[0][1]], 6.6);
    glow(ctx, [costs.cells[0][1]], 6.9);
    flyNode(ctx, memory.nodes.get("part"), centre(suppliers.cells[0][1]), 6.7);
    flyNode(ctx, memory.nodes.get("cost"), centre(costs.cells[0][1]), 7.0);
    drawEdges(ctx, memory.edges, 7.3);

    // Beat 3: Claude asks; the costs sheet it cites lights up.
    const beat = claudeBeat(ctx, panel, ASK_AT);
    cite(ctx, costs, beat.citeAt + 0.1);
    dim(ctx, suppliers, beat.citeAt + 0.1);
  },
};
