// Multimodal agents: a spreadsheet, a manual and a photo arrive, each behind
// its own OpenGraph server, evidence is marked in all three, then Claude calls
// the three servers in turn and each source lights up as its call returns.
import { askTiming, claudeBeat, claudePanel, CLAUDE_SHOTS, CLAUDE_SLOT, WORLD } from "../claude.js";
import { boxes, cite, doc, el, glow, highlight, photo, place, sheet, snapBoxes } from "../parts.js";

const SOURCES = {
  sheet: { x: 40, y: 80, w: 520, h: 236 },
  doc: { x: 40, y: 400, w: 520, h: 280 },
  photo: { x: 620, y: 80, w: 540, h: 360 },
};
// The roof photo and its boxes, in the photo's own pixels at 540 wide.
const ROOF = {
  src: "/films/roof-shingles-1200.webp",
  aspect: 933 / 1400,
  boxes: [
    { label: "missing shingles", x: 238, y: 112, w: 150, h: 122, place: "label-below" },
    { label: "lifted shingle", x: 392, y: 133, w: 116, h: 52 },
  ],
};
const ASK = {
  repo: "site-inspections",
  task: "Plan roof repairs",
  prompt: "Which sites are damaged, and do the photos show it?",
  calls: [
    { server: "opengraph-table", tool: "query_graph" },
    { server: "opengraph-text", tool: "query_graph" },
    { server: "opengraph-image", tool: "get_image_entities" },
  ],
  answer: "Sites 14 and 21 are marked damaged in `site-reports.xlsx`. `maintenance-manual.pdf` says to replace missing shingles within 48 hours, and `site-14-roof.jpg` shows a patch of them gone.",
};
const ASK_AT = 7.6;
const timing = askTiming(ASK_AT, ASK);
const DURATION = Math.ceil(timing.citeAt + 2.2);

export default {
  duration: DURATION,
  end: DURATION - 0.8,
  poster: DURATION - 1,
  world: WORLD,
  shots: {
    sources: [24, 30, 1152, 680],
    sheet: [30, 50, 540, 290],
    doc: [30, 380, 540, 320],
    photo: [610, 50, 560, 410],
    ...CLAUDE_SHOTS,
  },
  // Unlike the other films the camera pulls back as soon as the calls start,
  // so each source is seen lighting up when its server answers.
  camera: [
    [0, "sources", 0.94], [2.6, "sources", 0.94], [3.3, "sheet", 0.92], [4.2, "sheet", 0.92],
    [4.9, "doc", 0.92], [5.6, "doc", 0.92], [6.3, "photo", 0.92], [7.0, "photo", 0.92],
    [ASK_AT + 0.5, "claude", 0.94], [timing.callAt[0] - 0.6, "claude", 0.95],
    [timing.callAt[0] + 0.2, "wide", 0.94], [DURATION - 0.4, "wide", 0.96], [DURATION, "sources", 0.94],
  ],
  tilt: [[0, 0, 0], [timing.callAt[0] - 0.6, 0, 0], [timing.callAt[0] + 0.2, 6, -5], [DURATION - 0.4, 4, -2], [DURATION, 0, 0]],

  build(ctx) {
    const { world, track, show } = ctx;
    const reports = sheet(world, {
      ...SOURCES.sheet,
      name: "site-reports.xlsx",
      columns: ["site", "status", "inspected"],
      rows: [["Site 9", "ok", "2026-08-02"], ["Site 14", "damaged", "2026-08-04"], ["Site 21", "damaged", "2026-08-05"]],
    });
    const manual = doc(world, {
      ...SOURCES.doc,
      name: "maintenance-manual.pdf",
      title: "Roof maintenance",
      lines: ["Inspect flashing after every storm.", "[[Replace missing shingles within 48 hours.]]", "Log each repair against its site."],
    });
    const roof = photo(world, { ...SOURCES.photo, ...ROOF, name: "site-14-roof.jpg" });
    const found = boxes(roof.el, ROOF.boxes);
    const servers = [
      ["opengraph-table", SOURCES.sheet],
      ["opengraph-text", SOURCES.doc],
      ["opengraph-image", SOURCES.photo],
    ].map(([name, at]) => {
      const chip = place(el("span", "film-server", name), { x: at.x, y: at.y - 34 });
      world.append(chip);
      return chip;
    });
    const panel = claudePanel(world, { ...CLAUDE_SLOT, ...ASK });

    // Beat 1: the three sources arrive, each labelled with the server that reads it.
    track(reports.el, show(0.3, { transform: "translate(-60px, -30px) scale(.95)" }));
    track(manual.el, show(0.6, { transform: "translate(-60px, 30px) scale(.95)" }));
    track(roof.el, show(0.9, { transform: "translate(60px, -20px) scale(.95)" }));
    servers.forEach((chip, index) => track(chip, show(1.3 + index * 0.2, { transform: "translateY(8px)" })));

    // Beat 2: the camera visits each source as its evidence is marked.
    glow(ctx, [reports.cells[1][1], reports.cells[2][1]], 3.5);
    highlight(ctx, manual.marks[0], 5.1);
    snapBoxes(ctx, found, 6.5, DURATION - 1.2);

    // Beat 3: one call per server; each source lights up as its call returns.
    const beat = claudeBeat(ctx, panel, ASK_AT);
    [reports, manual, roof].forEach((source, index) => cite(ctx, source, beat.callAt[index] + 0.65));
  },
};
