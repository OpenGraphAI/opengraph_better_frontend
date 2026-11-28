// OpenGraph Image: a folder of photos is dealt out of a tilted deck, one photo
// is read into a graph, then Claude asks which photo shows the desk setup.
import { askCamera, askTiming, claudeBeat, claudePanel, CLAUDE_SHOTS, CLAUDE_SLOT, WORLD } from "../claude.js";
import { appWindow, boxes, cite, defocus, dim, drawEdges, flyNode, graph, photo, snapBoxes } from "../parts.js";

const ASPECT = 800 / 1200;
const FRAME = { y: 96, w: 360, h: 240 };
const PHOTOS = [
  { x: 40, name: "kitchen-02.jpg", src: "/bento/kitchen-02-1200.webp" },
  { x: 420, name: "kitchen-01.jpg", src: "/bento/kitchen-01-1200.webp" },
  { x: 800, name: "kitchen-03.jpg", src: "/bento/kitchen-03-1200.webp" },
];
const ASK = {
  repo: "photos",
  task: "Find the desk setup",
  prompt: "Which photos show a mouse next to a tablet?",
  calls: [{ server: "OpenGraph", tool: "query_graph" }],
  answer: "Only `kitchen-01.jpg`. The mouse sits next to the tablet, and both are left of the fruit basket.",
};
const ASK_AT = 7.9;
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
    deck: [24, 70, 1152, 300],
    memory: [380, 86, 440, 540],
    ...CLAUDE_SHOTS,
  },
  camera: [
    [0, "command", 0.8], [1.7, "command", 0.8], [2.5, "deck", 0.9], [3.5, "deck", 0.92],
    [4.3, "memory", 0.94], [7.4, "memory", 0.96], ...ask.camera, [DURATION, "command", 0.8],
  ],
  // The deck is filmed from an angle, then the camera squares up to read it.
  tilt: [[0, 10, -9], [2.4, 10, -9], [3.4, 0, 0], ...ask.tilt.slice(1)],

  build(ctx) {
    const { world, track, show, typing } = ctx;
    const app = appWindow(world, { x: 0, y: 0, w: 1200, h: 760, command: "opengraph-image build ./photos" });
    const photos = PHOTOS.map((spec) => photo(app.el, { ...FRAME, ...spec, aspect: ASPECT }));
    const found = boxes(photos[1].el, [
      { label: "tablet", x: 114, y: 97, w: 127, h: 101 },
      { label: "mouse", x: 245, y: 176, w: 30, h: 16, place: "label-below" },
      { label: "fruit_basket", x: 262, y: 118, w: 96, h: 74 },
    ]);
    const memory = graph(app.el, {
      width: 1200,
      height: 760,
      nodes: [
        { id: "tablet", label: "tablet", x: 600, y: 450, hub: true },
        { id: "mouse", label: "mouse", x: 450, y: 580 },
        { id: "basket", label: "fruit_basket", x: 760, y: 580 },
      ],
      edges: [{ from: "tablet", to: "mouse", label: "next_to" }, { from: "tablet", to: "basket", label: "left_of" }],
    });
    const panel = claudePanel(world, { ...CLAUDE_SLOT, ...ASK });

    // Beat 1: the photos are dealt from a stack in the middle of the window.
    track(app.el, show(0, { transform: "scale(.98)" }));
    track(app.cmd, typing(0.5, 1.6, app.chars));
    [1, 0, 2].forEach((index, order) => {
      const fromCentre = PHOTOS[1].x - PHOTOS[index].x;
      const turn = (index - 1) * 7;
      track(photos[index].el, show(1.9 + order * 0.2, { transform: `translate(${fromCentre}px, 60px) rotate(${turn}deg) scale(.9)` }));
    });

    // Beat 2: the middle photo is read; its objects become linked nodes.
    defocus(ctx, [photos[0].shot, photos[2].shot], 3.7, 7.6);
    snapBoxes(ctx, found, 4.5, 7.8);
    const origin = (box) => ({ x: PHOTOS[1].x + box.x + 30, y: FRAME.y + box.y });
    flyNode(ctx, memory.nodes.get("tablet"), origin(found[0]), 5.4);
    flyNode(ctx, memory.nodes.get("mouse"), origin(found[1]), 5.65);
    flyNode(ctx, memory.nodes.get("basket"), origin(found[2]), 5.9);
    drawEdges(ctx, memory.edges, 6.7);

    // Beat 3: Claude asks; the one matching photo lights up.
    const beat = claudeBeat(ctx, panel, ASK_AT);
    cite(ctx, photos[1], beat.citeAt + 0.1);
    dim(ctx, photos[0], beat.citeAt + 0.1);
    dim(ctx, photos[2], beat.citeAt + 0.1);
  },
};
