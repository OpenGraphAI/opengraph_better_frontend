// OpenGraph Text: pages drop into the window, the camera reads one closely as
// a highlighter picks out the names in a sentence, the names become a graph,
// then Claude asks who founded the company and which document says so.
import { askCamera, askTiming, claudeBeat, claudePanel, CLAUDE_SHOTS, CLAUDE_SLOT, WORLD } from "../claude.js";
import { appWindow, cite, defocus, dim, doc, drawEdges, flyNode, graph, highlight, posIn } from "../parts.js";

const PAGE = { y: 96, w: 360, h: 300 };
const DOCS = [
  { x: 40, name: "doc_openai.md", title: "OpenAI", lines: ["OpenAI was founded in 2015 in San Francisco.", "Sam Altman works at OpenAI as chief executive."] },
  { x: 420, name: "doc_anthropic.md", title: "Anthropic", lines: ["[[Anthropic]] was founded by [[Dario Amodei]] and [[Daniela Amodei]] in 2021.", "It builds the Claude family of AI models."] },
  { x: 800, name: "doc_competition.md", title: "Competition", lines: ["Anthropic and OpenAI compete to sell model access to developers.", "Both publish usage policies."] },
];
const ASK = {
  repo: "sample_documents",
  task: "Check a founder",
  prompt: "Who founded Anthropic, and which document says so?",
  calls: [{ server: "OpenGraph", tool: "query_graph" }],
  answer: "Dario Amodei and Daniela Amodei, as stated in `doc_anthropic.md`.",
};
const ASK_AT = 8.1;
const { citeAt } = askTiming(ASK_AT, ASK);
const DURATION = Math.ceil(citeAt + 2.3);
const ask = askCamera(ASK_AT, ASK, DURATION);

export default {
  duration: DURATION,
  end: DURATION - 0.8,
  poster: DURATION - 1,
  world: WORLD,
  shots: {
    command: [24, 14, 560, 50],
    pages: [24, 80, 1152, 340],
    read: [420, 150, 360, 150],
    memory: [360, 86, 480, 600],
    ...CLAUDE_SHOTS,
  },
  camera: [
    [0, "command", 0.8], [1.8, "command", 0.8], [2.6, "pages", 0.92], [3.5, "pages", 0.92],
    [4.3, "read", 0.9], [5.7, "read", 0.92], [6.5, "memory", 0.94], [7.6, "memory", 0.96],
    ...ask.camera, [DURATION, "command", 0.8],
  ],
  tilt: ask.tilt,

  build(ctx) {
    const { world, track, show, typing } = ctx;
    const app = appWindow(world, { x: 0, y: 0, w: 1200, h: 760, command: "opengraph-text build ./sample_documents" });
    const pages = DOCS.map((spec) => doc(app.el, { ...PAGE, ...spec }));
    const memory = graph(app.el, {
      width: 1200,
      height: 760,
      nodes: [
        { id: "anthropic", label: "Anthropic", x: 600, y: 490, hub: true },
        { id: "dario", label: "Dario Amodei", x: 430, y: 620 },
        { id: "daniela", label: "Daniela Amodei", x: 770, y: 620 },
      ],
      edges: [{ from: "dario", to: "anthropic", label: "founded" }, { from: "daniela", to: "anthropic", label: "founded" }],
    });
    const panel = claudePanel(world, { ...CLAUDE_SLOT, ...ASK });

    // Beat 1: the pages drop in, each settling at a slight angle.
    track(app.el, show(0, { transform: "scale(.98)" }));
    track(app.cmd, typing(0.5, 1.7, app.chars));
    pages.forEach((page, index) => track(page.el, show(2.0 + index * 0.18, { transform: `translateY(-140px) rotate(${(index - 1) * 4}deg)` })));

    // Beat 2: a close read; each name is highlighted and lifts into the graph.
    defocus(ctx, [pages[0].body, pages[2].body], 3.9, 7.6);
    const [company, founderA, founderB] = pages[1].marks;
    [company, founderA, founderB].forEach((mark, index) => highlight(ctx, mark, 4.5 + index * 0.35));
    const from = (mark) => {
      const { x, y, w } = posIn(world, mark);
      return { x: x + w / 2, y };
    };
    flyNode(ctx, memory.nodes.get("anthropic"), from(company), 5.9);
    flyNode(ctx, memory.nodes.get("dario"), from(founderA), 6.1);
    flyNode(ctx, memory.nodes.get("daniela"), from(founderB), 6.3);
    drawEdges(ctx, memory.edges, 6.9);

    // Beat 3: Claude asks; the document that says so lights up.
    const beat = claudeBeat(ctx, panel, ASK_AT);
    cite(ctx, pages[1], beat.citeAt + 0.1);
    dim(ctx, pages[0], beat.citeAt + 0.1);
    dim(ctx, pages[2], beat.citeAt + 0.1);
  },
};
