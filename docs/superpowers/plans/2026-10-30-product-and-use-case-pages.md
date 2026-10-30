# Product and Use-Case Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the 3 product and 4 use-case pages as alternating feature rows (short copy plus a labelled visual each), with reference detail moved into the docs.

**Architecture:** Page copy stays in `frontend_website/content/**/*.md`, written in a small row convention that a new build-time module (`scripts/page-rows.mjs`) turns into row HTML. `scripts/content-pages.mjs` swaps its long-article body and table-of-contents sidebar for those rows, plus "Good to know", "Go deeper" and "Related" sections. Visuals are plain HTML/CSS generated at build time. No runtime JavaScript is added.

**Tech Stack:** Node 22 ESM build scripts, `marked` (already a dependency), `node:test` (built in), Playwright (already a dev dependency) for layout checks, Vite.

**Spec:** `docs/superpowers/specs/2026-10-30-product-and-use-case-pages-design.md`

## Global Constraints

- Page titles, meta descriptions, URLs, and `<h1>` text do not change.
- No new dependencies and no new runtime JavaScript on the marketing pages.
- Every visual carries a tag: `Example output` (shows output) or `From the docs` (lists documented facts). An untagged visual is a build error.
- Copy keeps the meaning of today's pages; nothing that changes what a reader believes is dropped from the site (it stays on the page or moves to the docs).
- Product facts follow the product source at `/home/shaurya/Coding/Internship/opengraph-ai`. The docs are corrected where they disagree with it.
- Caveats about data going to a hosted model, sensitive or regulated data, Preview or install-from-source status, and unsuitable uses stay on the page as a full-sentence visible note.
- Use-case pages keep their limits on the page; product-page limit lists move to the docs.
- Nothing is reproduced from the Robot Scene Memory gallery (opengraphai.github.io); link to it only.
- No scroll-triggered animation; only the hover states the site already uses.
- Phones: rows stack (text first, visual second); no horizontal page scroll at 375 px.
- Paper theme tokens from `src/theme.css`; blue (`--signal`) only for relationships and citations.

## Review Focus

1. **Broken links after the move.** Every internal `href` on the 7 pages and the new docs pages must resolve to a path in `sitePaths` (anchors excepted). Pinned in Task 1 (`all internal links resolve`).
2. **Long monospace content on phones.** Quoted claims inside edges (Text, Research) can overflow at 375 px. Pinned in Task 2 (`check-pages` overflow assertion).
3. **A section with no visual.** An author may write a row without a visual block; it must render as a text-only row, not crash or leave an empty column. Pinned in Task 1 (`row without visual renders text-only`).
4. **Docs app missing new pages.** New docs markdown must be imported in `src/docs.js` and listed in `docsPages`, or client navigation shows nothing. Pinned in Task 5 (build emits `dist/docs/opengraph-text/overview/index.html`; `docs.js` imports both files).
5. **Header specimen and rows repeating the same example.** Pinned in Task 1 (`row visuals do not repeat header specimen edges`).

---

### Task 1: Row renderer with tagged visuals

**Files:**
- Create: `frontend_website/scripts/page-rows.mjs`
- Create: `frontend_website/scripts/page-rows.test.mjs`
- Modify: `frontend_website/scripts/content-pages.mjs` (`renderContentPage`, `renderPageContent`; drop `renderAside`, `renderMobileToc` and the `headings` plumbing)
- Modify: `frontend_website/package.json` (add `"test": "node --test scripts/"`)

**Interfaces:**
- Produces: `renderRows(markdown: string): { intro: string, rows: Row[], goodToKnow: string, goDeeper: string }`, where `Row = { label: string, heading: string, bodyHtml: string, visualHtml: string | null, id: string }`. It also produces `renderRowsHtml(result): string`, which outputs the `<section class="page-rows">` markup with `is-flipped` on every second row that has a visual.
- Produces: `renderVisual(type: string, tag: string, source: string): string`.

**Markdown convention** (document it in a comment at the top of `page-rows.mjs`):

    Optional intro paragraph(s) before the first H2.

    ## Beyond captions                        <- row label (eyebrow); also the row id
    ### What the model sees, kept as a graph. <- row heading, rendered as <h2>
    One or two sentences.

    ```visual:edges Example output
    @ kitchen-01.jpg
    mug | on_top_of | table | 0.94
    ```

    ## Good to know   <- reserved: list -> limit cards; blockquote -> visible note
    ## Go deeper      <- reserved: "- [Label](href) — blurb" -> link cards

Visual types and line formats (one item per line):
- `edges`: optional `@ caption` first line, then `from | relation | to | score?`.
- `chips`: one chip per line; a leading `*` highlights it.
- `fan`: line 1 is the hub node, line 2 the relation, and the remaining lines are tiles.
- `exchange`: `you: text`, `agent: text`, or `-> tool_call(...)` lines.
- `terminal`: lines shown verbatim; a leading `$ ` marks a prompt.

- [ ] **Step 1: Write failing tests in `scripts/page-rows.test.mjs`**

```js
test("splits H2 sections into rows with label, heading, body and visual")
  // rows[0].label === "Beyond captions", rows[0].heading === "What the model sees, kept as a graph."
  // rows[0].visualHtml includes 'class="row-visual-tag">Example output<'
test("a visual without a tag is a build error")
  // assert.throws(() => renderRows("## A\n### B\nC\n\n```visual:chips\nx\n```"), /needs a tag/)
test("unknown visual type is a build error")            // /Unknown visual type "pie"/
test("row without visual renders text-only")              // visualHtml === null; html has class "page-row is-text-only"
test("every second row with a visual is flipped")
test("edges escape HTML and render the score")           // '<b>' in a node renders as &lt;b&gt;
test("chips mark the starred chip as highlighted")       // class="row-chip is-on">on_top_of<
test("Good to know: list items become limit cards, blockquotes become notes")
test("Go deeper: links become cards with blurbs")         // href="/docs/reference/mcp-tools/"
test("all internal links resolve")                        // for every contentPage, every href starting "/" (minus #hash) is in sitePaths
test("row visuals do not repeat header specimen edges")   // for every contentPage, no specimen edge triple appears in its rows' edges
test("h1 and title unchanged")                            // rendered <h1> equals the markdown H1; <title> equals `${page.title} | OpenGraph AI`
```

The last four tests render real pages with `renderContentPage(readFileSync("page.html"), page, root)`. They fail until Tasks 3, 5 and 6 rewrite the markdown. Mark them `{ todo: "until content rewrite" }` in this task, and remove `todo` in Task 3 for the Image page, then in Tasks 5 and 6.

- [ ] **Step 2: Run `cd frontend_website && npm test`** and confirm the unit tests fail with "renderRows is not a function".
- [ ] **Step 3: Implement `page-rows.mjs`.** Use `marked.lexer` to group tokens by `heading` depth 2. Route `Good to know` and `Go deeper` sections (case-insensitive) to their own renderers. Reuse the existing `escapeHtml` from `site-chrome.mjs` and the existing code highlighting for any non-visual code blocks.
- [ ] **Step 4: Wire it into `content-pages.mjs`.** `renderPageContent` outputs, in order: the header (unchanged, still with `renderSpecimen`), intro, rows, Good to know, Go deeper, Related cards (built from `page.related` as `renderAside` does today), the pager, and the CTA. Remove the TOC sidebar and the mobile TOC.
- [ ] **Step 5: Run `npm test`.** All unit tests pass; the 4 page-level tests stay `todo`.
- [ ] **Step 6: Commit** `feat(site): render content pages as feature rows with tagged visuals`.

### Task 2: Row, visual and section styles

**Files:**
- Modify: `frontend_website/src/page.css` (add the row, visual, limits, notes, go-deeper and related-cards rules; remove the rules for `.page-aside`, `.page-toc`, `.page-toc-mobile` and `.page-layout`'s sidebar grid)
- Modify: `frontend_website/src/page.js` (remove `initialiseTocHighlight`; keep code copy, scoped to `.page-rows .code-block, .page-prose .code-block`)
- Create: `frontend_website/scripts/check-pages.mjs`

**Interfaces:**
- Consumes: the class names from Task 1: `page-rows`, `page-row`, `is-flipped`, `is-text-only`, `page-row-label`, `page-row-visual`, `row-visual-tag`, `row-edge`, `row-chip`, `is-on`, `row-fan`, `row-exchange`, `row-terminal`, `page-limits`, `page-notice`, `page-go-deeper`, `page-related-cards`.
- Produces: `node scripts/check-pages.mjs [--base=http://localhost:4317]`. It loads every `contentPages` path at 375×812 and 1440×900 from `vite preview` and exits 1 if `document.documentElement.scrollWidth > innerWidth`, if any `.page-row-visual` lacks `.row-visual-tag`, or if the console logs an error.

- [ ] **Step 1: Write `check-pages.mjs`** (Playwright plus `preview()` from Vite, same pattern as `perf-check.mjs`).
- [ ] **Step 2: Run `npm run build && node scripts/check-pages.mjs`.** It fails (no styles yet; long edges overflow at 375).
- [ ] **Step 3: Add the styles.** Desktop row: `grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr)`, gap `48px`, `padding-block: 46px`, a top border of `rgb(var(--paper-ink-rgb) / 0.1)`, and `order: 2` on the text column for `is-flipped`. Headings use Inter Tight 400, `clamp(26px, 3vw, 34px)`, `letter-spacing: -0.03em`. Labels use Azeret Mono at 10.5px, uppercase, `letter-spacing: 0.08em`. Visual panel: `--paper` background, 12px radius, 1px border, and the mockup's soft shadow. The terminal and exchange visuals use `--panel` with `--panel-ink`. `.row-edge` wraps (`flex-wrap: wrap; overflow-wrap: anywhere`). Below 720px the grid is one column with `order` reset.
- [ ] **Step 4: Run `node scripts/check-pages.mjs`.** It passes for every page that builds. Then view `/products/opengraph-image/` in the browser at desktop and 375 px.
- [ ] **Step 5: Commit** `feat(site): style feature rows, visuals and closing sections`.

### Task 3: OpenGraph Image page and its docs

**Files:**
- Modify: `frontend_website/content/products/opengraph-image.md` (rewrite in the row convention)
- Modify: `frontend_website/docs/content/opengraph-image/README.md` (add the node-type table, relationship vocabulary, cross-image linking and full limits moved from the product page; replace `near` with a vocabulary relation)
- Modify: `frontend_website/docs/content/reference/mcp-tools.md` (add `build_graph_html` if `opengraph-ai/opengraph-image/src` defines it)
- Modify: `frontend_website/docs/content/getting-started/quickstart.md` (install command per the source README)
- Modify: `frontend_website/scripts/page-rows.test.mjs` (drop `todo` for the Image page)

**Interfaces:**
- Consumes: Task 1's convention and Task 2's styles.

Rows (copy from the spec's table, trimmed from today's text). Each `fan` or `edges` example must differ from the header specimen (`mug on_top_of table`, `mug has_attribute material: ceramic`, `kitchen-01.jpg in_scene`, `desk-03.png has_text`):
1. `Beyond captions` / "What the model sees, kept as a graph." / `visual:edges Example output` (one image: `@ street-14.jpg`, `person | holding | umbrella | 0.93`, `bicycle | in_front_of | building | 0.88`, `street-14.jpg | has_text | "EXIT" | 0.86`).
2. `Fixed vocabulary` / "The same words in every photo." / `visual:chips From the docs` (the 7 relations, `*on_top_of`).
3. `Linked across images` / "One node, every photo it's in." / `visual:fan Example output` (`bicycle`, `seen_in`, 3 filenames).
4. `For your agent` / "Six MCP tools." (use the count found in the source) / `visual:exchange Example output`.
- Good to know: a visible note ("Images are sent to a hosted vision model during a build; the graph is stored locally."), then cards for "Merges by label, not identity", "Small, fixed vocabularies", "Still images only", "Alpha software", and a link "Full limits" → `/docs/opengraph-image/overview/#limits`.
- Go deeper: Quickstart, Image overview (node types), MCP tools, CLI.

- [ ] **Step 1: Verify facts against the source.** Grep `opengraph-ai/opengraph-image/src` for the tool list, the relation vocabulary, the scene set and the install command. Note any difference from today's page in the commit message.
- [ ] **Step 2: Rewrite the markdown and move detail into the docs files above.**
- [ ] **Step 3: Remove `todo` for this page; run `npm test`, `npm run build`, `node scripts/check-pages.mjs`.** All pass.
- [ ] **Step 4: Commit** `feat(site): OpenGraph Image page as feature rows; move reference detail to docs`.
- [ ] **Step 5: CHECKPOINT. Show the owner `/products/opengraph-image/` at desktop and phone width, and stop until they approve or give changes.**

### Task 4: Performance check on content pages

**Files:**
- Modify: `frontend_website/scripts/perf-check.mjs` (add `--path=/products/opengraph-image/`, defaulting to `/`; skip `measurePlayback` and report video metrics as `null` when the page has no `[data-graph-video]`; `compare` skips `null` metrics)

- [ ] **Step 1: Implement the option.** Run `node scripts/perf-check.mjs --path=/products/opengraph-image/ --runs=5` on the pre-redesign build (a `git worktree` at the commit before Task 1) with `--out=…/before.json`, then on the new build with `--compare`.
- [ ] **Step 2: Confirm all budgets are met**, or fix the cause (expected risks: extra fonts or large inline SVG).
- [ ] **Step 3: Commit** `test(site): perf-check can measure any page`.

### Task 5: OpenGraph Text and Table pages with new docs pages

**Files:**
- Modify: `frontend_website/content/products/opengraph-text.md`, `frontend_website/content/products/opengraph-table.md`
- Create: `frontend_website/docs/content/opengraph-text/README.md`, `frontend_website/docs/content/opengraph-table/README.md` (modelled on the Image overview: what it extracts, node and relation types, tools, install and run, limits)
- Modify: `frontend_website/docs/content/SUMMARY.md` (sections "OpenGraph Text" and "OpenGraph Table", each with an Overview)
- Modify: `frontend_website/src/site-metadata.js` (`docsPages` entries `opengraph-text/overview` → `/docs/opengraph-text/overview/` and `opengraph-table/overview` → `/docs/opengraph-table/overview/`, with title and description)
- Modify: `frontend_website/src/docs.js` (import both files `?raw` and register them where the other overviews are registered)
- Modify: `frontend_website/scripts/page-rows.test.mjs` (drop `todo` for these pages; add test `build emits new docs pages`, which checks for `dist/docs/opengraph-text/overview/index.html` and `dist/docs/opengraph-table/overview/index.html` after `npm run build`)

Rows follow the spec: Text covers what goes in and out, one entity across many documents, claims kept apart (`edges` showing two papers' differing claims, both kept), and tools. Table covers what goes in and out, many tables into one graph, and tools. Table's visible notes: the Preview and install-from-source status, and "Deduplication is heuristic; review before financial or compliance work." Text's visible note covers hosted-model processing. Verify tool counts, relation names and install commands against `opengraph-ai/opengraph-text` and `opengraph-ai/opengraph-table` first.

- [ ] **Step 1: Verify facts against the source** (as in Task 3, Step 1).
- [ ] **Step 2: Write the docs pages and register them** (SUMMARY, `docsPages`, `docs.js`).
- [ ] **Step 3: Rewrite both product pages.**
- [ ] **Step 4: Run `npm test` (todo removed), `npm run build`, `node scripts/check-pages.mjs`.** All pass. Open `/docs/opengraph-text/overview/` and `/docs/opengraph-table/overview/` in the browser, both as direct loads and through client navigation from `/docs/`.
- [ ] **Step 5: Commit** `feat(site): Text and Table pages as feature rows; add their docs overviews`.

### Task 6: The four use-case pages

**Files:**
- Modify: `frontend_website/content/use-cases/{robotics,image-video-search,multimodal-agents,research}.md`
- Modify: `frontend_website/scripts/page-rows.test.mjs` (drop the last `todo`)

Rows per the spec's list. Good to know keeps each page's limits on the page as cards, with no "Full limits" link. Visible notes cover Robotics ("not a control loop; every frame is a hosted-model call") and Research (hosted model, sensitive or regulated data, "not validated for clinical or diagnostic use"). The Robotics "See it on real robot data" row is text plus a link card to `playgroundUrl`, with no visual reproduced from the gallery. Long workflows move to the matching product docs page, or stay as a `visual:terminal From the docs` block when they have no docs home.

- [ ] **Step 1: Rewrite the 4 pages.**
- [ ] **Step 2: Run `npm test` (no `todo` left), `npm run build`, `node scripts/check-pages.mjs`, `node scripts/perf-check.mjs --path=/use-cases/robotics/ --compare=…`.** All pass.
- [ ] **Step 3: Commit** `feat(site): use-case pages as feature rows`.
- [ ] **Step 4: Show the owner all 7 pages, then push the branch when they approve.**
