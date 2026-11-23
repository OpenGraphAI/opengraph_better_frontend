# Product and use-case pages: from docs-style articles to feature rows

Date: 2026-10-30
Status: agreed in conversation; written up for the build

## Why

The three product pages (`/products/opengraph-image/`, `/products/opengraph-text/`,
`/products/opengraph-table/`) and the four use-case pages (`/use-cases/robotics/`,
`/use-cases/image-video-search/`, `/use-cases/multimodal-agents/`, `/use-cases/research/`)
read like documentation: a header, then a long markdown article (500–740 words) with
tables, install steps and a table of contents. The owner wants them to feel like
Linear's product pages: clean, not boring, nothing that looks forced.

## Goals

- Each page makes its case in short sections that a visitor can scan in under a minute.
- Every section pairs one idea with one visual that shows it.
- The meaning of today's copy is kept; only its length and arrangement change.
- Reference detail moves to the docs and stays one click away.

## Non-goals

- No change to the homepage, the hero, the navigation, the footer, or the docs app's look.
- No new product claims, numbers, or features.
- No change to page titles, meta descriptions, URLs, or `<h1>` text (SEO stays as is).

## Anti-goals (the page fails even if it works)

- Decoration that does not explain anything: floating shapes, gradients for their own
  sake, icons standing in for content.
- Scroll-triggered entrance animations or motion that competes with reading.
- A visual that implies behaviour the docs do not describe, or an example that is not
  labelled as an example.
- Hiding caveats that affect whether someone should use the product.

## Decisions made with the owner

1. **Layout: alternating rows (direction A from the mockups).** After the page header,
   the body is a sequence of rows. Each row has a small uppercase label, a short heading,
   one or two sentences, and a visual on the other side. The visual alternates sides
   from row to row.
2. **Copy: trim and split, keep the meaning.** Today's paragraphs are cut down and
   divided across rows. Nothing that changes what a reader would believe about the
   product may be dropped from the site; it either stays on the page or moves to the docs.
3. **Visuals: built from the docs, labelled.** *(Update, same day: after review the owner asked for the tags to be removed and the visuals kept plain; the hero card lost its tag too.)* Visuals show example output assembled
   from what the docs and repository already state. Any visual that shows output carries
   an "Example output" tag (the homepage already uses this tag); a visual that only lists
   documented facts (the relationship vocabulary, the tool names) carries "From the docs".
4. **Detail: moved to the docs and linked.** Node-type tables, install and run steps,
   full tool tables, and full limit lists move to docs pages. Each product page ends with
   "Go deeper in the docs" link cards.

## Page anatomy

**Header (kept, lightly adjusted).** Breadcrumb, `<h1>`, the existing lede, the release
facts (`v0.1.2 on PyPI`, licence, tool count), the two buttons, and the existing
"specimen" terminal card on the right (`renderSpecimen` in
`frontend_website/scripts/content-pages.mjs`). It already carries an "Example output" tag.

**Rows.** Four or five per page. Row content comes from the page's current sections.
For OpenGraph Image the agreed set, from the mockup, is:

| Label | Heading | Visual |
| --- | --- | --- |
| Beyond captions | What the model sees, kept as a graph. | Three labelled edges from one image (`mug on_top_of table 0.94`, …) |
| Fixed vocabulary | The same words in every photo. | The seven relationship names as chips, one highlighted |
| Linked across images | One node, every photo it's in. | One `bicycle` node with `seen_in` links to three image tiles |
| For your agent | Six MCP tools. | A short agent exchange calling `query_graph` and `get_image_entities` |

The other pages follow the same pattern from their own sections, for example:

- Text: what goes in and out; one entity across many documents; claims kept apart; tools.
- Table: what goes in and out; many tables, one graph; tools.
- Robotics: relations built for manipulation; see it on real robot data; a workflow you
  can run today.
- Image and video search: from tags to relationships; search from your agent; video via
  sampled frames; good fits.
- Multimodal agents: how it works today; a worked example; why separate graphs help.
- Research: papers as entities, topics and claims; figures and supplementary data;
  provenance by default.

**Good to know.** A row of short tags summarising the page's limits ("Merges by label,
not identity", "Still images only", …), linking to the full list in the docs.
Exception: caveats about data leaving the visitor's machine, sensitive or regulated
data, and "not validated for clinical or diagnostic use" (Research) stay on the page as a
full sentence in a visible note, not only as a tag.

**Go deeper in the docs.** Link cards to the relevant docs pages (quickstart, node or
output reference, tools reference, limits).

**Kept from today.** "Related" pages (moved from the sidebar to the bottom, since the
table-of-contents sidebar goes away), the previous/next pager, and the closing CTA.

**Phones.** Rows stack with text first and the visual below. No horizontal scroll.

## Feel

- Uses the existing paper theme tokens (`frontend_website/src/theme.css`), fonts
  (Inter Tight headings, Instrument Sans body, Azeret Mono for code and labels), and the
  existing card, tag and button styles. Blue (`--signal`) marks relationships and
  citations only.
- Motion: none added beyond hover states the site already uses.

## Docs changes

- OpenGraph Image detail already lives in `frontend_website/docs/content/opengraph-image/`
  and `reference/`. Anything on the product page that the docs lack (for example the
  node-type table and the full limit list) is added there.
- OpenGraph Text and OpenGraph Table have no docs pages. Add an overview page for each
  under `frontend_website/docs/content/opengraph-text/` and `opengraph-table/`, modelled
  on the OpenGraph Image overview, holding the moved detail. Register them in
  `docs/content/SUMMARY.md` and `docsPages` in `frontend_website/src/site-metadata.js`
  so they get static pages and sitemap entries.
- Use-case detail (long workflows, extra example questions) moves to the matching
  product docs page or stays on the use-case page if it has no docs home.

## Constraints

- Pages stay statically rendered by `scripts/content-pages.mjs` at build time; no
  client-side framework and no new runtime JavaScript or dependencies.
- The page must not get slower: check with `npm run perf` (compare before and after).
- Accessible: real text in the visuals (no text baked into images), semantic lists and
  figures, sufficient contrast, keyboard-reachable links.
- Copy stays in plain English, matching the site's existing voice.

## Calls made while writing this up (owner to check)

1. **Which caveats get a visible sentence, not just a tag.** Rule: a caveat stays as a
   full sentence in a visible note when it concerns data leaving the machine, sensitive
   or regulated data, preview or install-from-source status, or uses the product is not
   suited to. That covers Research (hosted model, sensitive data, not clinical), Robotics
   (not a control loop; every frame is a hosted-model call), Table (deduplication is
   heuristic, review before financial or compliance work; the Preview notice), and every
   product page's "images/documents/tables are sent to a hosted model during a build".
   Everything else is a short tag.
2. **Use-case limits stay on the use-case page.** The docs have no home for them
   ("2D only", "no identity across frames", "agents join graphs at query time"), so
   use-case pages keep their limits as a short list on the page, without linking out.
   Only product-page limit lists move to the docs.
3. **Examples.** An illustrative example is allowed when it is labelled "Example output"
   and is consistent with behaviour the docs or the product source
   (`../opengraph-ai/`) describe; it does not have to restate repository data. Image
   tiles are filename boxes, not photos. Robotics "see it on real robot data" is a link
   card with facts only; nothing from the Robot Scene Memory gallery's frames or graph
   data is reproduced.
4. **Rows use different examples from the header specimen**, so nothing repeats.
5. **Docs follow the product source.** Where the docs disagree with
   `../opengraph-ai/` (Image tool count five vs six including `build_graph_html`, a `near`
   relation outside the fixed vocabulary, `pip install -e .` vs `pip install
   opengraph-image`), the docs are corrected to match the source. New docs pages are also
   registered in `src/docs.js` (the docs app bundles its markdown); that is existing
   docs code, not new runtime JavaScript on the marketing pages.
6. **Performance check.** `scripts/perf-check.mjs` gains a `--path` option and skips the
   video steps on pages without `[data-graph-video]`; the same budgets apply, measured
   on `/products/opengraph-image/` and one use-case page before and after.

## Left to the builder

- Where row content lives (extended markdown, front-matter, or data in
  `site-metadata.js` alongside the existing `specimen`), as long as copy remains easy to
  edit without touching rendering code.
- The small set of reusable visual types (edges, chips, node-with-links, terminal or
  agent exchange, short code) and their markup.
- Exact trimmed wording, within "same meaning".

## Order of work

1. OpenGraph Image product page plus its docs additions; owner reviews it in the browser.
2. The remaining two product pages and their new docs pages.
3. The four use-case pages.
