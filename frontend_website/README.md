# OpenGraph AI flow model

Standalone light-mode Anime.js prototype showing multimodal inputs becoming an agent-ready context graph.

```bash
npm install
npm run dev
```

Current deployable frontend lives in `dist/`.

`npm run build` also renders all seven documentation pages to static HTML and
generates `dist/sitemap.xml`. Deploy the entire `dist/` directory with directory
index support so `/docs/reference/cli/` serves its `index.html`. Existing `#/…`
documentation links still resolve in the client. Canonicals and the sitemap use
`https://opengraphai.io`, the site's existing public domain.

The landing-page "How it works" loop is a pre-rendered video of the Three.js scene in
`src/graph-loop/` (preview it live at `/graph-loop.html`, `?portrait` for the phone cut).
`src/graph-loop/video.js` picks one of three cuts and fetches it only as the section nears
the viewport: `graph-loop-2880.mp4` for wide figures on high-DPI screens,
`graph-loop-1440.mp4` for other wide screens, and the 4:5 `graph-loop-portrait.mp4` for
screens up to 600px wide. `node scripts/export-graph-loop.mjs` renders every frame
supersampled in headless Chromium, checks the loop seam, encodes each cut within its byte
budget and prints the `?v=` values to copy into the video's `data-*` attributes in
`index.html`, so browsers that cached the previous file fetch the new one instead of
splicing the two. `*.mp4` is gitignored, so add new cuts with `git add -f`. The layout and
timeline are plain data in `src/graph-loop/layout.js`, covered by `npm test`. Check what a
change costs visitors with `npm run build` and `npm run perf -- --out=before.json`, then
`--compare=before.json` after the change. Hero dots
are capped at 24 fps; reduced-motion preferences disable automatic motion, except
the graph video and the demo loops, which are the page's illustrations. Embedded demo fonts
use Latin WOFF2 subsets, with the original font files retained for other uses.
