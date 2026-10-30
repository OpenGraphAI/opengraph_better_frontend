/**
 * Turns a product or use-case markdown file into feature rows: one idea per
 * row, a short heading, a sentence or two, and a visual that shows it.
 *
 *   Optional intro paragraph(s) before the first H2.
 *
 *   ## Beyond captions                        <- row label; also the row id
 *   ### What the model sees, kept as a graph. <- row heading (rendered as <h2>)
 *   One or two sentences.
 *
 *   ```visual:edges Example output            <- visual type, then its tag
 *   @ kitchen-01.jpg                          <- optional caption
 *   mug | on_top_of | table | 0.94
 *   ```
 *
 *   ## Good to know   <- reserved: "> note" -> visible note; "- item" -> limit card
 *   ## Go deeper      <- reserved: "- [Label](href) — blurb" -> link card
 *
 * Visual types, one item per line:
 *   edges     "@ caption" (optional), then "from | relation | to | score?"
 *   chips     one chip per line; a leading "*" highlights it
 *   fan       hub node, relation, then one tile per line
 *   exchange  "you: text", "agent: text", or "-> tool_call(...)"
 *   terminal  lines shown as typed; a leading "$ " marks a prompt
 *
 * Every visual must say what it is: "Example output" for output we assembled
 * from the docs, "From the docs" for documented facts. Anything else fails
 * the build, so no example can pass for a real run.
 */

import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import { Marked, marked as lexerOnly } from "marked";
import { escapeHtml } from "./site-chrome.mjs";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("python", python);
hljs.registerLanguage("text", plaintext);

const VISUAL_TAGS = ["Example output", "From the docs"];
const RESERVED = { "good to know": "goodToKnow", "go deeper": "goDeeper" };
const codeLabels = { bash: "Terminal", shell: "Terminal", python: "Python", json: "JSON" };

export const slugify = (text) => text.toLowerCase().replace(/<[^>]+>|[`*_]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Markdown with build-time syntax highlighting, so pages ship no highlighter. */
const markdown = new Marked({
  renderer: {
    code({ text, lang }) {
      const language = (lang || "text").split(/\s+/)[0];
      const highlighted = hljs.getLanguage(language) ? hljs.highlight(text, { language }).value : escapeHtml(text);
      const label = codeLabels[language];
      const header = label ? `<p class="code-label">${label}</p>` : "";
      return `<div class="code-block${label ? " has-label" : ""}">${header}<pre><code class="hljs language-${escapeHtml(language)}">${highlighted}</code></pre></div>\n`;
    },
    // A quote that opens with bold text ("**Preview.**") is a notice; any other quote is a prompt to type into an agent.
    blockquote({ tokens }) {
      const inner = this.parser.parse(tokens);
      return /^<p><strong>/.test(inner.trim())
        ? `<aside class="page-notice">${inner}</aside>\n`
        : `<figure class="page-prompt"><figcaption>Ask your agent</figcaption><blockquote>${inner}</blockquote></figure>\n`;
    },
  },
});

const parse = (tokens, links) => markdown.parser(Object.assign([...tokens], { links }))
  .replace(/<table>/g, '<div class="page-table"><table>')
  .replace(/<\/table>/g, "</table></div>");

const lines = (source) => source.split("\n").map((line) => line.trim()).filter(Boolean);

const VISUALS = {
  edges(source) {
    const rows = lines(source);
    const caption = rows[0]?.startsWith("@ ") ? rows.shift().slice(2) : "";
    const edges = rows.map((row) => {
      const [from, relation, to, score] = row.split("|").map((part) => part.trim());
      if (!from || !relation || !to) throw new Error(`Edge "${row}" must read "from | relation | to | score?"`);
      return `<li class="row-edge"><span class="row-node">${escapeHtml(from)}</span><span class="row-relation">${escapeHtml(relation)}</span><span class="row-node">${escapeHtml(to)}</span>${score ? `<span class="row-score" title="Confidence">${escapeHtml(score)}</span>` : ""}</li>`;
    });
    return `${caption ? `<p class="row-caption">${escapeHtml(caption)}</p>` : ""}<ul class="row-edges">${edges.join("")}</ul>`;
  },
  chips(source) {
    const chips = lines(source).map((line) => {
      const on = line.startsWith("*");
      return `<li class="row-chip${on ? " is-on" : ""}">${escapeHtml(on ? line.slice(1).trim() : line)}</li>`;
    });
    return `<ul class="row-chips">${chips.join("")}</ul>`;
  },
  fan(source) {
    const [hub, relation, ...tiles] = lines(source);
    if (!hub || !relation || !tiles.length) throw new Error("A fan needs a hub, a relation and at least one tile");
    return `<div class="row-fan"><span class="row-node is-hub">${escapeHtml(hub)}</span><span class="row-relation">${escapeHtml(relation)}</span><ul class="row-tiles">${tiles.map((tile) => `<li class="row-tile">${escapeHtml(tile)}</li>`).join("")}</ul></div>`;
  },
  exchange(source) {
    const items = lines(source).map((line) => {
      if (line.startsWith("->")) return `<li class="is-call"><code>${escapeHtml(line.slice(2).trim())}</code></li>`;
      const match = line.match(/^(you|agent):\s*(.*)$/);
      if (!match) throw new Error(`Exchange line "${line}" must start with "you:", "agent:" or "->"`);
      return `<li class="is-${match[1]}"><span class="row-speaker">${match[1]}</span> ${escapeHtml(match[2])}</li>`;
    });
    return `<ol class="row-exchange">${items.join("")}</ol>`;
  },
  terminal(source) {
    const body = source.split("\n").map((line) => (line.startsWith("$ ")
      ? `<span class="row-prompt" aria-hidden="true">$</span> ${escapeHtml(line.slice(2))}`
      : escapeHtml(line))).join("\n");
    return `<pre class="row-terminal"><code>${body}</code></pre>`;
  },
};

/** One visual panel. Throws on an unknown type or a missing or unknown tag. */
export function renderVisual(type, tag, source) {
  const render = VISUALS[type];
  if (!render) throw new Error(`Unknown visual type "${type}"; use ${Object.keys(VISUALS).join(", ")}`);
  if (!VISUAL_TAGS.includes(tag)) throw new Error(`Visual "${type}" needs a tag: "${VISUAL_TAGS.join('" or "')}" (got "${tag ?? ""}")`);
  return `<figure class="page-row-visual row-visual-${type}"><span class="row-visual-tag">${escapeHtml(tag)}</span>${render(source)}</figure>`;
}

function toRow(heading, tokens, links) {
  const subheading = tokens.find((token) => token.type === "heading" && token.depth === 3);
  const visual = tokens.find((token) => token.type === "code" && token.lang?.startsWith("visual:"));
  const body = tokens.filter((token) => token !== subheading && token !== visual);
  let visualHtml = null;
  if (visual) {
    const [, type, tag] = visual.lang.match(/^visual:(\S+)\s*(.*)$/);
    visualHtml = renderVisual(type, tag.trim(), visual.text);
  }
  return {
    label: subheading ? heading.text : "",
    heading: subheading ? subheading.text : heading.text,
    bodyHtml: parse(body, links),
    visualHtml,
    id: slugify(heading.text),
  };
}

function renderGoodToKnow(tokens, links) {
  const parts = tokens.map((token) => {
    if (token.type === "blockquote") return `<aside class="page-notice">${parse(token.tokens, links)}</aside>`;
    if (token.type === "list") {
      const items = token.items.map((item) => `<li>${markdown.parseInline(item.text)}</li>`);
      return `<ul class="page-limits">${items.join("")}</ul>`;
    }
    return parse([token], links);
  });
  return `<section class="page-good-to-know" aria-labelledby="good-to-know">
        <h2 class="page-section-label" id="good-to-know">Good to know</h2>
        ${parts.join("\n        ")}
      </section>`;
}

function renderGoDeeper(tokens) {
  const items = tokens.filter((token) => token.type === "list").flatMap((token) => token.items);
  const cards = items.map((item) => {
    const match = item.text.match(/^\[([^\]]+)\]\(([^)\s]+)\)\s*(?:[—–-]\s*)?(.*)$/);
    if (!match) throw new Error(`Go deeper item "${item.text}" must read "[Label](href) — blurb"`);
    const [, label, href, blurb] = match;
    return `<a href="${escapeHtml(href)}"><b>${escapeHtml(label)}</b>${blurb ? `<span>${escapeHtml(blurb)}</span>` : ""}</a>`;
  });
  return `<nav class="page-go-deeper" aria-labelledby="go-deeper">
        <h2 class="page-section-label" id="go-deeper">Go deeper in the docs</h2>
        <div class="page-go-deeper-cards">${cards.join("")}</div>
      </nav>`;
}

/** Split a page's markdown (H1 already removed) into intro, rows and closing sections. */
export function renderRows(source) {
  const tokens = lexerOnly.lexer(source);
  const sections = [];
  const intro = [];
  for (const token of tokens) {
    if (token.type === "heading" && token.depth === 2) sections.push({ heading: token, tokens: [] });
    else if (sections.length) sections.at(-1).tokens.push(token);
    else intro.push(token);
  }
  const result = { intro: parse(intro, tokens.links).trim(), rows: [], goodToKnow: "", goDeeper: "" };
  for (const { heading, tokens: body } of sections) {
    const reserved = RESERVED[heading.text.trim().toLowerCase()];
    if (reserved === "goodToKnow") result.goodToKnow = renderGoodToKnow(body, tokens.links);
    else if (reserved === "goDeeper") result.goDeeper = renderGoDeeper(body);
    else result.rows.push(toRow(heading, body, tokens.links));
  }
  return result;
}

/** The rows as HTML. Every second row that has a visual puts it on the other side. */
export function renderRowsHtml({ intro, rows }) {
  let visuals = 0;
  const html = rows.map((row) => {
    const flipped = row.visualHtml && visuals++ % 2 === 1;
    const className = `page-row${row.visualHtml ? (flipped ? " is-flipped" : "") : " is-text-only"}`;
    const label = row.label ? `<p class="page-row-label">${escapeHtml(row.label)}</p>` : "";
    return `<section class="${className}" id="${row.id}" aria-labelledby="${row.id}-title">
        <div class="page-row-copy">
          ${label}
          <h2 id="${row.id}-title">${markdown.parseInline(row.heading)}</h2>
          ${row.bodyHtml}
        </div>
        ${row.visualHtml ?? ""}
      </section>`;
  });
  return `${intro ? `<div class="page-intro">${intro}</div>\n      ` : ""}${html.join("\n      ")}`;
}
