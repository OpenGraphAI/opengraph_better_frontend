// Research: the camera tracks across three papers as a highlighter finds the
// dropout claim in each, the claims gather on one topic, then Claude lists them
// with their sources and all three papers light up.
import { askCamera, askTiming, claudeBeat, claudePanel, CLAUDE_SHOTS, CLAUDE_SLOT, WORLD } from "../claude.js";
import { appWindow, cite, doc, drawEdges, flyNode, graph, highlight, posIn } from "../parts.js";

const PAGE = { y: 96, w: 360, h: 280 };
const PAPERS = [
  { x: 40, name: "smith-2024.pdf", title: "Attrition in online courses", lines: ["We followed 1,200 learners for one term.", "[[Dropout was 14% in the control arm.]]"] },
  { x: 420, name: "patel-2023.pdf", title: "Session length and retention", lines: ["[[Dropout rose when sessions ran past 40 minutes.]]", "Shorter modules held attention."] },
  { x: 800, name: "lee-2025.pdf", title: "Weekly check-ins", lines: ["[[Dropout fell to 8% with weekly check-ins.]]", "The effect held in both cohorts."] },
];
const ASK = {
  repo: "papers",
  task: "Collect dropout claims",
  prompt: "List every claim about dropout rates, with its paper.",
  calls: [{ server: "OpenGraph", tool: "query_graph" }],
  answer: "Three claims: 14% in the control arm (`smith-2024.pdf`), higher past 40 minutes (`patel-2023.pdf`) and 8% with check-ins (`lee-2025.pdf`).",
};
const ASK_AT = 8.2;
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
    papers: [24, 80, 1152, 320],
    ...Object.fromEntries(PAPERS.map((paper, index) => [`paper${index}`, [paper.x - 10, PAGE.y - 10, PAGE.w + 20, PAGE.h + 20]])),
    claims: [24, 80, 1152, 640],
    ...CLAUDE_SHOTS,
  },
  // A tracking shot from paper to paper, in time with the highlighter.
  camera: [
    [0, "command", 0.8], [1.5, "command", 0.8], [2.3, "papers", 0.92], [3.0, "papers", 0.92],
    [3.7, "paper0", 0.92], [4.3, "paper0", 0.92], [4.9, "paper1", 0.92], [5.4, "paper1", 0.92],
    [6.0, "paper2", 0.92], [6.5, "paper2", 0.92], [7.3, "claims", 0.94], [7.8, "claims", 0.95],
    ...ask.camera, [DURATION, "command", 0.8],
  ],
  tilt: ask.tilt,

  build(ctx) {
    const { world, track, show, typing } = ctx;
    const app = appWindow(world, { x: 0, y: 0, w: 1200, h: 760, command: "opengraph-text build ./papers" });
    const papers = PAPERS.map((spec) => doc(app.el, { ...PAGE, ...spec }));
    const memory = graph(app.el, {
      width: 1200,
      height: 760,
      nodes: [
        { id: "topic", label: "dropout rate", x: 600, y: 470, hub: true },
        { id: "smith", label: "14% in control arm", x: 230, y: 620 },
        { id: "patel", label: "rises past 40 min", x: 600, y: 640 },
        { id: "lee", label: "8% with check-ins", x: 970, y: 620 },
      ],
      edges: ["smith", "patel", "lee"].map((id) => ({ from: id, to: "topic", label: "about" })),
    });
    const panel = claudePanel(world, { ...CLAUDE_SLOT, ...ASK });

    // Beat 1: the papers fan in from behind one another.
    track(app.el, show(0, { transform: "scale(.98)" }));
    track(app.cmd, typing(0.5, 1.4, app.chars));
    papers.forEach((paper, index) => track(paper.el, show(1.9 + index * 0.15, { transform: `translateX(${(1 - index) * 380}px) scale(.94)` })));

    // Beat 2: the highlighter finds each claim as the camera passes, then the
    // claims gather around the topic they share.
    const claimAt = [3.9, 5.0, 6.1];
    papers.forEach((paper, index) => highlight(ctx, paper.marks[0], claimAt[index]));
    const topicFrom = posIn(world, papers[1].el);
    flyNode(ctx, memory.nodes.get("topic"), { x: topicFrom.x + PAGE.w / 2, y: topicFrom.y + PAGE.h }, 6.9);
    ["smith", "patel", "lee"].forEach((id, index) => {
      const { x, y, w } = posIn(world, papers[index].marks[0]);
      flyNode(ctx, memory.nodes.get(id), { x: x + w / 2, y }, 7.1 + index * 0.15);
    });
    drawEdges(ctx, memory.edges, 7.6, 0.15);

    // Beat 3: Claude lists the claims; every paper it cites lights up.
    const beat = claudeBeat(ctx, panel, ASK_AT);
    papers.forEach((paper, index) => cite(ctx, paper, beat.citeAt + 0.1 + index * 0.15));
  },
};
