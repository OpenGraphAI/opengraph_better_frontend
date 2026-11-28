// Plays each agent exchange as a conversation once it scrolls into view: the
// question arrives, tool calls run and settle, then the answer streams in word
// by word. The full text is in the markup from the start, so it reads the same
// without JavaScript, with reduced motion, and to screen readers.

const STEP_GAP_MS = 380;
const CALL_RUN_MS = 900;
const THINK_MS = 700;
const WORD_MS = 45;
const VISIBLE_SHARE = 0.6;

const wait = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

/** Wrap each word of a message in a span so it can appear without reflowing the text. */
function wrapWords(paragraph) {
  const words = [];
  for (const node of [...paragraph.childNodes]) {
    if (node.nodeType !== Node.TEXT_NODE) {
      node.classList.add("row-word");
      words.push(node);
      continue;
    }
    const fragment = document.createDocumentFragment();
    for (const part of node.textContent.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        fragment.append(part);
        continue;
      }
      const word = document.createElement("span");
      word.className = "row-word";
      word.textContent = part;
      fragment.append(word);
      words.push(word);
    }
    node.replaceWith(fragment);
  }
  return words;
}

async function showItem(item, words) {
  if (item.classList.contains("is-call")) {
    item.classList.add("is-shown", "is-running");
    await wait(CALL_RUN_MS);
    item.classList.remove("is-running");
    return;
  }
  if (item.classList.contains("is-agent")) {
    item.classList.add("is-shown", "is-thinking");
    await wait(THINK_MS);
    item.classList.remove("is-thinking");
    for (const word of words.get(item) ?? []) {
      word.classList.add("is-shown");
      await wait(WORD_MS);
    }
    return;
  }
  item.classList.add("is-shown");
}

function setUpExchange(list) {
  const items = [...list.children];
  const words = new Map(
    items
      .filter((item) => item.classList.contains("is-agent"))
      .map((item) => [item, wrapWords(item.querySelector("p"))]),
  );

  const replay = document.createElement("button");
  replay.type = "button";
  replay.className = "row-replay";
  replay.textContent = "Replay";
  replay.classList.add("is-waiting");
  list.after(replay);

  let playing = false;
  const play = async () => {
    if (playing) return;
    playing = true;
    replay.classList.add("is-waiting");
    list.querySelectorAll(".is-shown").forEach((node) => node.classList.remove("is-shown"));
    list.classList.add("is-playing");
    for (const item of items) {
      await showItem(item, words);
      await wait(STEP_GAP_MS);
    }
    list.classList.remove("is-playing");
    replay.classList.remove("is-waiting");
    playing = false;
  };

  replay.addEventListener("click", play);
  list.classList.add("is-playing");

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    play();
  }, { threshold: VISIBLE_SHARE });
  observer.observe(list);
}

export function initialiseExchangeAnimation() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion || !("IntersectionObserver" in window)) return;
  document.querySelectorAll(".row-exchange").forEach(setUpExchange);
}
