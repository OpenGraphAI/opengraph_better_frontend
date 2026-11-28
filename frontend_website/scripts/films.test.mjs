import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { answerWords, askCamera, askTiming, CLAUDE_SHOTS, CLAUDE_SLOT, WORLD } from "../src/films/claude.js";
import { whenImagesReady } from "../src/films/ready.js";

const ROOT = new URL("..", import.meta.url).pathname;
const SCENES = join(ROOT, "src/films/scenes");
const STAGE_ASPECT = 16 / 9;
const READ_S = 1;
const ASK = {
  prompt: "Which frames show the steel bowl in the sink?",
  calls: [{ server: "OpenGraph", tool: "query_graph" }],
  answer: "The steel bowl is inside the sink in `ep07_step-015` and `ep07_step-030`, next to the white bowl.",
};

const fakeImage = (decode) => ({ decode });
const never = () => new Promise(() => {});

test("every image a film shows exists in public/", () => {
  const files = readdirSync(SCENES).filter((file) => file.endsWith(".js"));
  const sources = files.flatMap((file) => [...readFileSync(join(SCENES, file), "utf8").matchAll(/"(\/[^"]+\.(?:webp|jpe?g|png|avif))"/g)].map((match) => [file, match[1]]));
  assert.ok(sources.length > 0, "expected the scenes to reference images");
  sources.forEach(([file, src]) => assert.ok(existsSync(join(ROOT, "public", src)), `${file}: ${src} is missing from public/`));
});

test("the answer has fully streamed and been on screen to read before the camera pulls back", () => {
  const t0 = 8;
  const timing = askTiming(t0, ASK);
  const camera = askCamera(t0, ASK, 20).camera;
  const lastClaudeKey = camera.filter(([, shot]) => shot === "claude").at(-1)[0];
  assert.ok(timing.answerDone > timing.answerAt, "answerDone comes after the answer starts");
  assert.ok(lastClaudeKey >= timing.answerDone + READ_S, `camera leaves the panel at ${lastClaudeKey}s, answer done at ${timing.answerDone}s`);
});

test("sources light up only once the camera has pulled back to the wide shot", () => {
  const timing = askTiming(8, ASK);
  const camera = askCamera(8, ASK, 20).camera;
  const wideAt = camera.find(([, shot]) => shot === "wide")[0];
  assert.ok(timing.citeAt >= wideAt - 0.1, `cite at ${timing.citeAt}s, wide shot lands at ${wideAt}s`);
});

test("the Claude close-up does not show a clipped edge of the 1200px product window", () => {
  const [x, , w, h] = CLAUDE_SHOTS.claude;
  const pads = askCamera(8, ASK, 20).camera.filter(([, shot]) => shot === "claude").map(([, , pad]) => pad);
  pads.forEach((pad) => {
    // engine.js cam(): the shot is fitted into the 16:9 stage, then padded.
    const visibleW = Math.max(w, h * STAGE_ASPECT) / pad;
    const left = x + w / 2 - visibleW / 2;
    assert.ok(left >= 1215, `close-up starts at world x=${left.toFixed(0)}, inside the product window`);
  });
  assert.ok(CLAUDE_SLOT.x + CLAUDE_SLOT.w <= WORLD.w, "the panel fits in the world");
  assert.deepEqual(CLAUDE_SHOTS.wide, [0, 0, WORLD.w, WORLD.h]);
});

test("whenImagesReady waits for every image to decode", async () => {
  let release;
  const slow = new Promise((resolve) => { release = resolve; });
  let ready = false;
  const done = whenImagesReady([fakeImage(() => Promise.resolve()), fakeImage(() => slow)], 1000).then(() => { ready = true; });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(ready, false, "resolved before the slow image decoded");
  release();
  await done;
  assert.equal(ready, true);
});

test("whenImagesReady does not let a broken image block the film", async () => {
  await whenImagesReady([fakeImage(() => Promise.reject(new Error("broken")))], 1000);
});

test("whenImagesReady gives up after the timeout", async () => {
  const started = Date.now();
  await whenImagesReady([fakeImage(never)], 50);
  assert.ok(Date.now() - started < 500);
});

test("answer words find code spans even inside punctuation", () => {
  assert.deepEqual(answerWords("in the control arm (`smith-2024.pdf`), higher"), [
    { text: "in" }, { text: "the" }, { text: "control" }, { text: "arm" },
    { before: "(", code: "smith-2024.pdf", after: ")," }, { text: "higher" },
  ]);
  assert.deepEqual(answerWords("`q3-costs.csv`."), [{ before: "", code: "q3-costs.csv", after: "." }]);
});

test("no film answer would show a raw backtick", async () => {
  const files = readdirSync(SCENES).filter((file) => file.endsWith(".js"));
  for (const file of files) {
    const answer = readFileSync(join(SCENES, file), "utf8").match(/answer: "([^"]+)"/)?.[1];
    assert.ok(answer, `${file}: no answer found`);
    answerWords(answer).forEach((word) => {
      const shown = word.code === undefined ? word.text : word.before + word.after;
      assert.ok(!shown.includes("`"), `${file}: "${shown}" would show a backtick`);
    });
  }
});
