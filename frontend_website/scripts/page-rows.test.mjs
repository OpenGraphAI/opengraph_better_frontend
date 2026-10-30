import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { contentPages, docsPages, sitePaths } from "../src/site-metadata.js";
import { renderContentPage } from "./content-pages.mjs";
import { renderRows, renderRowsHtml, renderVisual } from "./page-rows.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FENCE = "```";
const SAMPLE = [
  "Intro line.",
  "",
  "## Beyond captions",
  "### What the model sees, kept as a graph.",
  "One or two sentences.",
  "",
  `${FENCE}visual:edges Example output`,
  "@ street-14.jpg",
  "person | holding | umbrella | 0.93",
  "<b> | next_to | building",
  FENCE,
  "",
  "## Fixed vocabulary",
  "### The same words in every photo.",
  "Seven relationships.",
  "",
  `${FENCE}visual:chips From the docs`,
  "next_to",
  "*on_top_of",
  FENCE,
  "",
  "## Plain row",
  "### No picture here.",
  "Just words.",
  "",
  "## Linked across images",
  "### One node, every photo it's in.",
  "Merged by label.",
  "",
  `${FENCE}visual:fan Example output`,
  "bicycle",
  "seen_in",
  "street-03.jpg",
  "park-11.jpg",
  FENCE,
  "",
  "## Good to know",
  "> Images are sent to a hosted vision model during a build.",
  "",
  "- **Still images only.** Sample video frames first.",
  "- Alpha software",
  "",
  "[Full limits](/docs/opengraph-image/overview/)",
  "",
  "## Go deeper",
  "- [MCP tools](/docs/reference/mcp-tools/) — Inputs and outputs",
  "- [Quickstart](/docs/getting-started/quickstart/) — Install and first run",
].join("\n");

const H1 = {
  "/products/opengraph-image/": "OpenGraph Image",
  "/products/opengraph-text/": "OpenGraph Text",
  "/products/opengraph-table/": "OpenGraph Table",
  "/use-cases/robotics/": "Scene memory for robots",
  "/use-cases/image-video-search/": "Search images by relationship",
  "/use-cases/multimodal-agents/": "One agent, every source",
  "/use-cases/research/": "Map a research corpus",
};

const renderPage = (page) => renderContentPage(readFileSync(resolve(root, "page.html"), "utf8"), page, root);
const textOf = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

test("splits H2 sections into rows with label, heading, body and visual", () => {
  const { intro, rows } = renderRows(SAMPLE);
  assert.match(intro, /Intro line\./);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].label, "Beyond captions");
  assert.equal(rows[0].heading, "What the model sees, kept as a graph.");
  assert.equal(rows[0].id, "beyond-captions");
  assert.match(rows[0].bodyHtml, /One or two sentences\./);
  assert.match(rows[0].visualHtml, /class="row-visual-tag">Example output</);
});

test("a section without ### uses its label as the heading", () => {
  const { rows } = renderRows("## Only a label\nBody.");
  assert.equal(rows[0].heading, "Only a label");
  assert.equal(rows[0].label, "");
});

test("a visual without a tag is a build error", () => {
  assert.throws(() => renderRows(`## A\n### B\nC\n\n${FENCE}visual:chips\nx\n${FENCE}`), /needs a tag/);
});

test("a visual with an unknown tag is a build error", () => {
  assert.throws(() => renderVisual("chips", "Looks real", "x"), /needs a tag/);
});

test("unknown visual type is a build error", () => {
  assert.throws(() => renderVisual("pie", "Example output", "x"), /Unknown visual type "pie"/);
});

test("row without visual renders text-only", () => {
  const result = renderRows(SAMPLE);
  assert.equal(result.rows[2].visualHtml, null);
  assert.match(renderRowsHtml(result), /<section class="page-row is-text-only" id="plain-row"/);
});

test("every second row with a visual is flipped", () => {
  const html = renderRowsHtml(renderRows(SAMPLE));
  const classes = [...html.matchAll(/<section class="(page-row[^"]*)" id="([^"]+)"/g)].map((m) => [m[2], m[1]]);
  assert.deepEqual(classes, [
    ["beyond-captions", "page-row"],
    ["fixed-vocabulary", "page-row is-flipped"],
    ["plain-row", "page-row is-text-only"],
    ["linked-across-images", "page-row"],
  ]);
});

test("edges escape HTML and render the caption and score", () => {
  const html = renderVisual("edges", "Example output", "@ street-14.jpg\nperson | holding | umbrella | 0.93\n<b> | next_to | building");
  assert.match(html, /street-14\.jpg/);
  assert.match(html, /<span class="row-relation">holding<\/span>/);
  assert.match(html, /<span class="row-score"[^>]*>0\.93<\/span>/);
  assert.match(html, /&lt;b&gt;/);
  assert.doesNotMatch(html, /<b>/);
});

test("an edge line without three parts is a build error", () => {
  assert.throws(() => renderVisual("edges", "Example output", "mug | on_top_of"), /from \| relation \| to/);
});

test("chips mark the starred chip as highlighted", () => {
  const html = renderVisual("chips", "From the docs", "next_to\n*on_top_of");
  assert.match(html, /class="row-chip is-on">on_top_of</);
  assert.match(html, /class="row-chip">next_to</);
});

test("fan renders a hub, a relation and tiles", () => {
  const html = renderVisual("fan", "Example output", "bicycle\nseen_in\nstreet-03.jpg\npark-11.jpg");
  assert.match(html, /class="row-node is-hub">bicycle</);
  assert.equal([...html.matchAll(/class="row-tile"/g)].length, 2);
});

test("exchange renders you, agent and tool-call lines", () => {
  const html = renderVisual("exchange", "Example output", "you: Which photos?\n-> query_graph(question)\nagent: kitchen-01.jpg");
  assert.match(html, /<li class="is-you">/);
  assert.match(html, /<li class="is-call"><code>query_graph\(question\)<\/code>/);
  assert.match(html, /<li class="is-agent">/);
});

test("terminal marks prompts", () => {
  const html = renderVisual("terminal", "From the docs", "$ pip install opengraph-image\ndone");
  assert.match(html, /<span class="row-prompt"[^>]*>\$<\/span> pip install opengraph-image/);
});

test("Good to know: list items become limit cards, blockquotes become notes, links stay", () => {
  const { goodToKnow } = renderRows(SAMPLE);
  assert.match(goodToKnow, /<aside class="page-notice">[\s\S]*hosted vision model/);
  assert.match(goodToKnow, /<ul class="page-limits">[\s\S]*<strong>Still images only\.<\/strong>[\s\S]*Alpha software/);
  assert.match(goodToKnow, /href="\/docs\/opengraph-image\/overview\/"/);
});

test("Go deeper: links become cards with blurbs", () => {
  const { goDeeper } = renderRows(SAMPLE);
  assert.match(goDeeper, /<a href="\/docs\/reference\/mcp-tools\/"><b>MCP tools<\/b><span>Inputs and outputs<\/span><\/a>/);
  assert.equal([...goDeeper.matchAll(/<a /g)].length, 2);
});

test("a Go deeper item that is not a link is a build error", () => {
  assert.throws(() => renderRows("## Go deeper\n- Quickstart"), /\[Label\]\(href\)/);
});

test("all internal links resolve", () => {
  const known = new Set(sitePaths);
  for (const page of contentPages) {
    const html = renderPage(page);
    for (const [, href] of html.matchAll(/<a [^>]*href="(\/[^"]*)"/g)) {
      const path = href.split(/[#?]/)[0];
      assert.ok(known.has(path), `${page.path} links to ${href}, which is not a site path`);
    }
  }
});

test("row visuals do not repeat header specimen edges", () => {
  for (const page of contentPages) {
    const markdown = readFileSync(resolve(root, "content", page.source), "utf8");
    const edgeTexts = renderRows(markdown).rows
      .flatMap((row) => [...(row.visualHtml ?? "").matchAll(/<li class="row-edge">([\s\S]*?)<\/li>/g)])
      .map((match) => textOf(match[1]));
    for (const [from, relation, to] of page.specimen?.edges ?? []) {
      const parts = [from, relation, to].map((part) => part.replace(/[<>&"]/g, ""));
      const repeated = edgeTexts.find((text) => parts.every((part) => text.includes(part)));
      assert.equal(repeated, undefined, `${page.path} repeats its header edge "${from} ${relation} ${to}"`);
    }
  }
});

test("h1 and title unchanged", () => {
  for (const page of contentPages) {
    const html = renderPage(page);
    assert.equal(textOf(html.match(/<h1>([\s\S]*?)<\/h1>/)[1]), H1[page.path], page.path);
    assert.ok(html.includes(`<title>${page.title} | OpenGraph AI</title>`), page.path);
  }
});

test("page intros are plain text, so a font swap above the fold cannot shift inline boxes", () => {
  for (const page of contentPages) {
    const markdown = readFileSync(resolve(root, "content", page.source), "utf8").replace(/^#\s+.+\n/, "");
    const { intro } = renderRows(markdown);
    assert.doesNotMatch(intro, /<(code|a|strong|em)\b/, `${page.path} intro has inline markup`);
  }
});

test("content pages render rows, not the old table-of-contents article", () => {
  for (const page of contentPages) {
    const html = renderPage(page);
    assert.match(html, /<div class="page-rows-wrap">/, page.path);
    assert.doesNotMatch(html, /class="page-toc/, page.path);
  }
});

test("every product has a docs overview registered for the static build, the docs app and the docs sidebar", () => {
  const docsApp = readFileSync(resolve(root, "src/docs.js"), "utf8");
  const summary = readFileSync(resolve(root, "docs/content/SUMMARY.md"), "utf8");
  for (const product of ["opengraph-image", "opengraph-text", "opengraph-table"]) {
    const source = `${product}/README.md`;
    const doc = docsPages.find((page) => page.source === source);
    assert.ok(doc, `docsPages has no entry for ${source}`);
    assert.equal(doc.path, `/docs/${product}/overview/`);
    assert.ok(existsSync(resolve(root, "docs/content", source)), `${source} is missing`);
    assert.match(docsApp, new RegExp(`"\\.\\./docs/content/${source}\\?raw"`), `src/docs.js does not import ${source}`);
    assert.match(docsApp, new RegExp(`"${source}":`), `src/docs.js does not register ${source}`);
    assert.ok(summary.includes(`(${source})`), `SUMMARY.md does not list ${source}`);
  }
});

// Top-level arguments of a call such as `query_graph("a, b", "./x")`.
const callArguments = (call) => {
  const inner = call.slice(call.indexOf("(") + 1, call.lastIndexOf(")"));
  let depth = 0;
  let quoted = false;
  let count = inner.trim() ? 1 : 0;
  for (const char of inner) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && "([".includes(char)) depth += 1;
    else if (!quoted && ")]".includes(char)) depth -= 1;
    else if (!quoted && depth === 0 && char === ",") count += 1;
  }
  return count;
};

test("agent exchanges pass a graph path to every graph query", () => {
  for (const page of contentPages) {
    const markdown = readFileSync(resolve(root, "content", page.source), "utf8");
    const calls = renderRows(markdown).rows
      .flatMap((row) => [...(row.visualHtml ?? "").matchAll(/<li class="is-call"><code>([\s\S]*?)<\/code>/g)])
      .map((match) => match[1].replace(/&quot;/g, '"').replace(/^[\w-]+:\s*/, ""));
    for (const call of calls.filter((text) => /^(query_graph|get_\w+_entities)\(/.test(text))) {
      assert.ok(callArguments(call) >= 2, `${page.path}: "${call}" names no graph, so the server would look in ./opengraph-out`);
    }
  }
});

test("the Image docs overview says a build also writes graph.html", () => {
  const overview = readFileSync(resolve(root, "docs/content/opengraph-image/README.md"), "utf8");
  const lifecycle = overview.slice(overview.indexOf("## Build lifecycle"), overview.indexOf("## A relationship-aware query"));
  assert.match(lifecycle, /graph\.html/);
});
