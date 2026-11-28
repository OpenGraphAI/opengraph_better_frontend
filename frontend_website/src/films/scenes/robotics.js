// Robotics: camera frames slide in like a filmstrip, the scene memory forms
// from the middle frame, then Claude asks which frames show the bowl.
import { askCamera, askTiming, claudeBeat, claudePanel, CLAUDE_SHOTS, CLAUDE_SLOT, WORLD } from "../claude.js";
import { appWindow, boxes, cite, dim, drawEdges, flyNode, graph, mute, photo, snapBoxes } from "../parts.js";

const PHOTO = { src: "/films/sink-dishes-1200.webp", aspect: 2099 / 1400 };
const FRAME = { y: 96, w: 360, h: 230 };
const FRAMES = [
  { x: 40, name: "ep07_step-000", crop: { x: 0, y: 0.17, w: 0.62 } }, // the rack and plate, before the bowl
  { x: 420, name: "ep07_step-015", crop: { x: 0, y: 0.45, w: 1 } },
  { x: 800, name: "ep07_step-030", crop: { x: 0.3, y: 0.52, w: 0.7 } },
];
const ASK = {
  repo: "robot-observations",
  task: "Find the bowl",
  prompt: "Which frames show the steel bowl in the sink?",
  calls: [{ server: "OpenGraph", tool: "query_graph" }],
  answer: "The steel bowl is inside the sink in `ep07_step-015` and `ep07_step-030`, next to the white bowl.",
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
    command: [24, 14, 560, 50],
    strip: [24, 84, 1152, 260],
    memory: [380, 86, 440, 540],
    ...CLAUDE_SHOTS,
  },
  camera: [
    [0, "command", 0.8], [1.8, "command", 0.8], [2.7, "strip", 0.92], [3.4, "strip", 0.92],
    [4.3, "memory", 0.94], [7.4, "memory", 0.96], ...ask.camera, [DURATION, "command", 0.8],
  ],
  tilt: ask.tilt,

  build(ctx) {
    const { world, track, show, typing } = ctx;
    const app = appWindow(world, { x: 0, y: 0, w: 1200, h: 760, command: "opengraph-image build ./episode-07" });
    const frames = FRAMES.map((frame) => photo(app.el, { ...FRAME, ...frame, ...PHOTO }));
    const found = boxes(frames[1].el, [
      { label: "sink", x: 90, y: 2, w: 266, h: 214, place: "label-inside" },
      { label: "white bowl", x: 216, y: 59, w: 124, h: 103 },
      { label: "steel bowl", x: 151, y: 89, w: 101, h: 103, place: "label-below" },
    ]);
    const memory = graph(app.el, {
      width: 1200,
      height: 760,
      nodes: [
        { id: "steel", label: "steel bowl", x: 600, y: 450, hub: true },
        { id: "sink", label: "sink", x: 460, y: 580 },
        { id: "white", label: "white bowl", x: 740, y: 580 },
      ],
      edges: [{ from: "steel", to: "sink", label: "inside" }, { from: "steel", to: "white", label: "next_to" }],
    });
    const panel = claudePanel(world, { ...CLAUDE_SLOT, ...ASK });

    // Beat 1: the build command types, then the frames slide in.
    track(app.el, show(0, { transform: "scale(.98)" }));
    track(app.cmd, typing(0.5, 1.7, app.chars));
    frames.forEach((frame, index) => track(frame.el, show(2.1 + index * 0.15, { transform: "translateX(90px)" })));

    // Beat 2: focus on the middle frame; its labels become graph nodes.
    mute(ctx, [frames[0].shot, frames[2].shot], 3.7, 7.6);
    snapBoxes(ctx, found, 4.5, 7.8);
    const origin = (box) => ({ x: FRAMES[1].x + box.x + 40, y: FRAME.y + box.y });
    flyNode(ctx, memory.nodes.get("steel"), origin(found[2]), 5.4);
    flyNode(ctx, memory.nodes.get("sink"), origin(found[0]), 5.65);
    flyNode(ctx, memory.nodes.get("white"), origin(found[1]), 5.9);
    drawEdges(ctx, memory.edges, 6.7);

    // Beat 3: Claude asks; the frames it cites light up.
    const beat = claudeBeat(ctx, panel, ASK_AT);
    cite(ctx, frames[1], beat.citeAt + 0.1);
    cite(ctx, frames[2], beat.citeAt + 0.25);
    dim(ctx, frames[0], beat.citeAt + 0.1);
  },
};
