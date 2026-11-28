// Image & video search: a playhead scrubs through footage and the frames land
// on a timeline, one frame is read into a graph, then Claude searches by
// relationship and only the matching frames light up and get tagged.
import { askCamera, askTiming, claudeBeat, claudePanel, CLAUDE_SHOTS, CLAUDE_SLOT, WORLD } from "../claude.js";
import { appWindow, boxes, cite, dim, drawEdges, el, flyNode, graph, mute, photo, place, snapBoxes } from "../parts.js";

const ASPECT = 320 / 480;
const THUMB = { y: 110, w: 204, h: 136 };
const STEP = 224;
const FRAMES = [
  { name: "street-03.jpg", src: "/bento/street-03-480.webp", match: true },
  { name: "kitchen-02.jpg", src: "/bento/kitchen-02-640.webp" },
  { name: "street-11.jpg", src: "/bento/street-11-480.webp", match: true },
  { name: "t00042.jpg", src: "/bento/walkthrough-t00042-480.webp", match: true },
  { name: "kitchen-03.jpg", src: "/bento/kitchen-03-640.webp" },
].map((frame, index) => ({ ...frame, x: 40 + index * STEP }));
const ASK = {
  repo: "frames",
  task: "Search the footage",
  prompt: "Which frames show a person holding an umbrella?",
  calls: [{ server: "OpenGraph", tool: "query_graph" }],
  answer: "Three: `street-03.jpg`, `street-11.jpg` and `t00042.jpg`.",
};
const ASK_AT = 7.6;
const { citeAt } = askTiming(ASK_AT, ASK);
const DURATION = Math.ceil(citeAt + 2.4);
const ask = askCamera(ASK_AT, ASK, DURATION);

export default {
  duration: DURATION,
  end: DURATION - 0.8,
  poster: DURATION - 1,
  world: WORLD,
  shots: {
    command: [24, 14, 500, 50],
    timeline: [24, 90, 1152, 210],
    memory: [24, 124, 860, 400], // starts below the command bar rather than cutting it
    ...CLAUDE_SHOTS,
  },
  camera: [
    [0, "command", 0.8], [1.5, "command", 0.8], [2.2, "timeline", 0.94], [3.7, "timeline", 0.94],
    [4.4, "memory", 0.94], [7.1, "memory", 0.96], ...ask.camera, [DURATION, "command", 0.8],
  ],
  tilt: ask.tilt,

  build(ctx) {
    const { world, track, show, typing } = ctx;
    const app = appWindow(world, { x: 0, y: 0, w: 1200, h: 540, command: "opengraph-image build ./frames" });
    const thumbs = FRAMES.map((frame) => photo(app.el, { ...THUMB, ...frame, aspect: ASPECT }));
    const scrubber = place(el("div", "film-scrubber", '<span class="film-scrubber-fill"></span><span class="film-playhead"></span>'), { x: 40, y: 268, w: 1120 });
    app.el.append(scrubber);
    const found = boxes(thumbs[0].el, [
      { label: "umbrella", x: 20, y: 19, w: 129, h: 38 },
      { label: "person", x: 73, y: 45, w: 57, h: 89, place: "label-inside" },
    ]);
    const memory = graph(app.el, {
      width: 1200,
      height: 760,
      nodes: [
        { id: "person", label: "person", x: 200, y: 440, hub: true },
        { id: "umbrella", label: "umbrella", x: 470, y: 440 },
        { id: "yellow", label: "yellow", x: 720, y: 440 },
      ],
      edges: [{ from: "person", to: "umbrella", label: "holding" }, { from: "umbrella", to: "yellow", label: "has_color" }],
    });
    const tags = FRAMES.filter((frame) => frame.match).map((frame) => {
      const tag = place(el("span", "film-chip", "person holding umbrella"), { x: frame.x + 10, y: THUMB.y + 10 });
      app.el.append(tag);
      return tag;
    });
    const panel = claudePanel(world, { ...CLAUDE_SLOT, ...ASK });

    // Beat 1: the playhead scrubs the footage; each frame lands as it passes.
    track(app.el, show(0, { transform: "scale(.98)" }));
    track(app.cmd, typing(0.5, 1.5, app.chars));
    track(scrubber, show(1.7));
    track(scrubber.querySelector(".film-scrubber-fill"), [[0, { transform: "scaleX(0)" }], [1.9, { transform: "scaleX(0)", easing: "linear" }], [3.7, { transform: "scaleX(1)" }]]);
    track(scrubber.querySelector(".film-playhead"), [[0, { transform: "translateX(0)" }], [1.9, { transform: "translateX(0)", easing: "linear" }], [3.7, { transform: "translateX(1120px)" }]]);
    thumbs.forEach((thumb, index) => track(thumb.el, show(1.9 + index * 0.36, { transform: "scale(.85)", filter: "blur(6px)" })));

    // Beat 2: the first frame is read into person, umbrella and its colour.
    mute(ctx, thumbs.slice(1).map((thumb) => thumb.shot), 4.0, 7.2);
    snapBoxes(ctx, found, 4.6, 7.4);
    const origin = (box) => ({ x: FRAMES[0].x + box.x + 30, y: THUMB.y + box.y });
    flyNode(ctx, memory.nodes.get("person"), origin(found[1]), 5.3);
    flyNode(ctx, memory.nodes.get("umbrella"), origin(found[0]), 5.55);
    flyNode(ctx, memory.nodes.get("yellow"), origin(found[0]), 5.8);
    drawEdges(ctx, memory.edges, 6.4);

    // Beat 3: Claude searches by relationship; matches light up and are tagged.
    const beat = claudeBeat(ctx, panel, ASK_AT);
    let cited = 0;
    FRAMES.forEach((frame, index) => {
      if (!frame.match) {
        dim(ctx, thumbs[index], beat.citeAt + 0.1);
        return;
      }
      cite(ctx, thumbs[index], beat.citeAt + 0.1 + cited * 0.15);
      track(tags[cited], show(beat.citeAt + 0.3 + cited * 0.15, { transform: "translateY(6px) scale(.9)" }));
      cited += 1;
    });
  },
};
