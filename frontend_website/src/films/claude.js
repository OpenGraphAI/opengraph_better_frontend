// The Claude Code window that asks the graph a question in every film. Its
// look follows the site's Claude Code mockup (public/mockups/claude-code).
import { OUT } from "./engine.js";
import { el, esc, place } from "./parts.js";

// The Claude mark, as drawn in public/mockups/claude-code/index.html.
const BURST_PATH = "M52.4285 162.873L98.7844 136.879L99.5485 134.602L98.7844 133.334H96.4921L88.7237 132.862L62.2346 132.153L39.3113 131.207L17.0249 130.026L11.4214 128.844L6.2 121.873L6.7094 118.447L11.4214 115.257L18.171 115.847L33.0711 116.911L55.485 118.447L71.6586 119.392L95.728 121.873H99.5485L100.058 120.337L98.7844 119.392L97.7656 118.447L74.5877 102.732L49.4995 86.1905L36.3823 76.62L29.3779 71.7757L25.8121 67.2858L24.2839 57.3608L30.6515 50.2716L39.3113 50.8623L41.4763 51.4531L50.2636 58.1879L68.9842 72.7209L93.4357 90.6804L97.0015 93.6343L98.4374 92.6652L98.6571 91.9801L97.0015 89.2625L83.757 65.2772L69.621 40.8192L63.2534 30.6579L61.5978 24.632C60.9565 22.1032 60.579 20.0111 60.579 17.4246L67.8381 7.49965L71.9133 6.19995L81.7193 7.49965L85.7946 11.0443L91.9074 24.9865L101.714 46.8451L116.996 76.62L121.453 85.4816L123.873 93.6343L124.764 96.1155H126.292V94.6976L127.566 77.9197L129.858 57.3608L132.15 30.8942L132.915 23.4505L136.608 14.4708L143.994 9.62643L149.725 12.344L154.437 19.0788L153.8 23.4505L150.998 41.6463L145.522 70.1215L141.957 89.2625H143.994L146.414 86.7813L156.093 74.0206L172.266 53.698L179.398 45.6635L187.803 36.802L193.152 32.5484H203.34L210.726 43.6549L207.415 55.1159L196.972 68.3492L188.312 79.5739L175.896 96.2095L168.191 109.585L168.882 110.689L170.738 110.53L198.755 104.504L213.91 101.787L231.994 98.7149L240.144 102.496L241.036 106.395L237.852 114.311L218.495 119.037L195.826 123.645L162.07 131.592L161.696 131.893L162.137 132.547L177.36 133.925L183.855 134.279H199.774L229.447 136.524L237.215 141.605L241.8 147.867L241.036 152.711L229.065 158.737L213.019 154.956L175.45 145.977L162.587 142.787H160.805V143.85L171.502 154.366L191.242 172.089L215.82 195.011L217.094 200.682L213.91 205.172L210.599 204.699L188.949 188.394L180.544 181.069L161.696 165.118H160.422V166.772L164.752 173.152L187.803 207.771L188.949 218.405L187.294 221.832L181.308 223.959L174.813 222.777L161.187 203.754L147.305 182.486L136.098 163.345L134.745 164.2L128.075 235.42L125.019 239.082L117.887 241.8L111.902 237.31L108.718 229.984L111.902 215.452L115.722 196.547L118.779 181.541L121.58 162.873L123.291 156.636L123.14 156.219L121.773 156.449L107.699 175.752L86.304 204.699L69.3663 222.777L65.291 224.431L58.2867 220.768L58.9235 214.27L62.8713 208.48L86.304 178.705L100.44 160.155L109.551 149.507L109.462 147.967L108.959 147.924L46.6977 188.512L35.6182 189.93L30.7788 185.44L31.4156 178.115L33.7079 175.752L52.4285 162.873Z";

// Where the panel sits in a 1800×760 world, right of a 1200px-wide product window,
// and the two camera shots every film uses for it.
export const CLAUDE_SLOT = { x: 1250, y: 150, w: 530, h: 460 };
export const CLAUDE_SHOTS = { claude: [1236, 136, 558, 488], wide: [0, 0, 1800, 760] };
export const WORLD = { w: 1800, h: 760 };

/**
 * @param {object} opts  { x, y, w, h, repo, task, prompt, calls: [{ server, tool }], answer }
 * `answer` is one sentence; wrap file names in backticks so they render as code.
 */
export function claudePanel(parent, { x, y, w, h, repo, task, prompt, calls, answer }) {
  const panel = place(el("div", "film-cc"), { x, y, w, h });
  panel.append(el("div", "film-cc-crumb", `<b>${esc(repo)}</b><i>/</i><span>${esc(task)}</span>`));

  const stream = el("div", "film-cc-stream");
  const said = el("div", "film-cc-said", esc(prompt));
  const thinking = el("div", "film-cc-thinking",
    `<svg viewBox="0 0 248 248" aria-hidden="true"><path fill="currentColor" d="${BURST_PATH}"/></svg><span>Querying OpenGraph</span>`);
  const status = el("div", "film-cc-status");
  const rows = calls.map(({ server, tool }) => {
    const row = el("div", "film-cc-call", `<span class="film-cc-state"><span class="film-cc-spin"></span><span class="film-cc-done"></span></span><span>Called <b>${esc(server)}</b> ${esc(tool)}</span>`);
    status.append(row);
    return { el: row, spin: row.querySelector(".film-cc-spin"), done: row.querySelector(".film-cc-done") };
  });
  status.append(thinking);
  const words = answer.split(" ").map((word) => {
    const code = word.match(/^`([^`]+)`(.*)$/);
    return el("span", "film-cc-word", code ? `<code>${esc(code[1])}</code>${esc(code[2])}` : esc(word));
  });
  const prose = el("p", "film-cc-answer");
  words.forEach((word, index) => prose.append(word, index < words.length - 1 ? " " : ""));
  stream.append(said, status, prose);
  panel.append(stream);

  const dock = el("div", "film-cc-dock");
  const composer = el("div", "film-cc-composer");
  const placeholder = el("span", "film-cc-placeholder", "Describe a task or ask a question");
  const typed = el("span", "film-clip", esc(prompt));
  composer.append(placeholder, typed, el("span", "film-cc-enter", "↵"));
  dock.append(composer, el("div", "film-cc-toolbar", "<span>Auto</span><span>+</span><b>Opus</b>"));
  panel.append(dock);
  parent.append(panel);

  return { el: panel, said, thinking, calls: rows, words, codes: [...prose.querySelectorAll("code")], placeholder, typed, prompt, spec: { prompt, calls, answer } };
}

/** When each step of the ask happens; scenes use it to time the camera. */
export function askTiming(t0, { prompt, calls, answer }) {
  const typeAt = t0 + 0.7;
  const typeFor = Math.min(1.6, prompt.length * 0.03);
  const sendAt = typeAt + typeFor + 0.2;
  const thinkAt = sendAt + 0.35;
  const callAt = calls.map((_, index) => thinkAt + 1.15 + index * 0.75);
  const answerAt = callAt.at(-1) + 0.9;
  const citeAt = answerAt + answer.split(" ").length * 0.05 + 0.3;
  return { typeAt, typeFor, sendAt, thinkAt, callAt, answerAt, citeAt };
}

/**
 * Camera and tilt keys for the ask: hold on the panel while Claude works, then
 * pull back, tilted, to show the answer and its sources together.
 */
export function askCamera(t0, spec, duration) {
  const { citeAt } = askTiming(t0, spec);
  const pullAt = citeAt - 0.85;
  return {
    camera: [[t0 + 0.5, "claude", 0.94], [pullAt, "claude", 0.95], [citeAt + 0.05, "wide", 0.94], [duration - 0.4, "wide", 0.96]],
    tilt: [[0, 0, 0], [pullAt, 0, 0], [citeAt + 0.05, 7, -6], [duration - 0.4, 5, -3], [duration, 0, 0]],
  };
}

/**
 * Play the ask: the panel arrives, the prompt types and sends, Claude queries
 * each tool in turn, and the answer streams in. Returns when things happen so
 * a scene can light up the sources each call or citation refers to.
 */
export function claudeBeat(ctx, panel, t0) {
  const { track, show } = ctx;
  track(panel.el, show(t0, { transform: "translateX(80px)" }));
  const { typeAt, typeFor, sendAt, thinkAt, callAt, answerAt, citeAt } = askTiming(t0, panel.spec);
  track(panel.placeholder, [[0, { opacity: 1 }], [typeAt - 0.05, { opacity: 1 }], [typeAt, { opacity: 0 }], [sendAt - 0.05, { opacity: 0 }], [sendAt, { opacity: 1 }]]);
  track(panel.typed, [...ctx.typing(typeAt, typeAt + typeFor, panel.prompt.length), [sendAt - 0.05, { clipPath: "inset(0 0% 0 0)" }], [sendAt, { clipPath: "inset(0 100% 0 0)" }]]);
  track(panel.said, show(sendAt, { transform: "translateY(22px) scale(.92)", filter: "blur(4px)" }));

  track(panel.thinking, show(thinkAt, { transform: "translateY(4px)" }, thinkAt + 0.7));
  panel.calls.forEach((call, index) => {
    const t = callAt[index];
    track(call.el, show(t, { transform: "translateY(4px)" }));
    track(call.spin, [[0, { opacity: 1 }], [t + 0.55, { opacity: 1 }], [t + 0.65, { opacity: 0 }]]);
    track(call.done, [[0, { opacity: 0, transform: "scale(0)" }], [t + 0.6, { opacity: 0, transform: "scale(0)", easing: "cubic-bezier(.34,1.56,.64,1)" }], [t + 1.0, { opacity: 1, transform: "scale(1)" }]]);
  });

  panel.words.forEach((word, index) => track(word, show(answerAt + index * 0.05, { transform: "translateY(3px)" })));
  const off = { backgroundColor: "rgba(11,11,11,.05)", color: "#383835" };
  const on = { backgroundColor: "rgba(36,87,214,.12)", color: "#2457d6" };
  panel.codes.forEach((code, index) => track(code, [
    [0, off], [citeAt + index * 0.15, { ...off, easing: OUT }], [citeAt + index * 0.15 + 0.4, on], [ctx.end, on],
  ]));
  return { callAt, answerAt, citeAt };
}
