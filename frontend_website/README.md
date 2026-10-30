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

The landing-page graph uses `public/video/graph-loop-1440.mp4` (muted, lazy-loaded,
and paused outside the viewport). Screens up to 600px wide get a 4:5 portrait cut,
`public/video/graph-loop-portrait.mp4`. Both are rendered in Blender from
`blender/graph_loop_scene.py` and encoded with `npm run encode:graph-loop`, which lays
the transparent frames over the page colour and keeps each file within its byte
budget; the commands are at the top of both files (`*.mp4` is gitignored, so add new
cuts with `git add -f`). After encoding, copy the `?v=` values the script prints into
the video's `data-src`/`data-poster` attributes in `index.html`, so browsers that cached
the previous file fetch the new one instead of splicing the two. Check what a change costs visitors with `npm run build` and
`npm run perf -- --out=before.json`, then `--compare=before.json` after the change.
The older Three.js scene remains in `graph-loop.html` (`?portrait` previews the phone
cut); `scripts/export-graph-loop.mjs` still exports it but no longer makes the shipped video. Hero dots
are capped at 24 fps; reduced-motion preferences disable automatic motion, except
the graph video and the demo loops, which are the page's illustrations. Embedded demo fonts
use Latin WOFF2 subsets, with the original font files retained for other uses.
