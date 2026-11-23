# "How it works" loop: Shelf threads redesign

Date: 2026-11-06
Status: approved and built, 2026-11-06

## Why

Reviewers watching the landing page's "How it works" loop cannot tell what
OpenGraph AI does. In the current loop the source files dissolve into loose
particles, and nothing ties them to the graph that forms afterwards, so the
middle of the loop reads as an abstract network. The agent's part is short and
small, and it is unclear what the agent gets back.

The user also finds the current video blurry.

## The one idea

After one silent viewing, someone should be able to say: **"Your files become
a graph your AI agent can search."**

## Goals

- Show the files turning into the graph, with a visible tie from each file to
  its part of the graph that never breaks.
- Make the agent's search the clear climax: the search visibly runs from the
  agent, through the graph and back into specific files.
- Make it comfortable to watch: mirror-symmetric, slow eased motion, one thing
  happening at a time, and nothing crowding the frame edges.
- Make it sharp on a high-DPI laptop screen.

## Non-goals

- No text, labels, captions or numbers anywhere in the video.
- No small details: no tiny labels next to nodes, no particle dust, no small
  decorative glyphs. Every element is large enough to read at a glance.
- No change to the hero, the page layout or the section copy around the video.
- No live three.js on the landing page. It stays a pre-rendered, muted,
  looping video.

## Anti-goals (it fails even if it technically works)

- It looks busy or nervous: many things moving at once, fast moves, or jitter.
- The loop visibly jumps where the end meets the start.
- It is lopsided: the composition is not mirror-symmetric when it should be.
- It still looks soft or smeared on a 2x laptop screen.
- It looks like a new art style. It must keep today's paper ground, ceramic
  nodes, ink and cobalt blue.

## Design scheme (unchanged)

The look stays as it is today, from `frontend_website/src/graph-loop/`:

- Paper ground `#f4f2ed` (the page colour, so the video has no visible edge),
  ceramic nodes `#eeeae2` with soft contact shadows, ink `#16181c`, and cobalt
  `#2457d6` as the only accent.
- The six file cards drawn in `sources.js`: document, image, table, audio
  waveform, code and database.
- The agent orb from `agent-orb.js`, which **keeps cycling through the real
  agent logos** (Claude, Codex, Cursor, Gemini, Grok) in their own colours, as
  it does today. This was decided by the user, and it shows the graph works
  with any agent.
- Thin grey edges, and cobalt for anything that is lit.

## Composition: "Shelf" (chosen by the user)

The wide cut is mirror-symmetric about the vertical centre line:

- **Bottom:** the six file cards sit in one evenly spaced row, left to right:
  document, image, table, audio, code, database.
- **Graph:** three rows of nodes above the files, narrowing upward like a
  fountain:
  - bottom row: six nodes, each directly above its file;
  - middle row: five nodes, sitting between the bottom-row nodes;
  - top row: three nodes.
- **Edges:** each middle-row node links to the two bottom-row nodes below it
  and to its neighbours. The top row links down to the middle row and across.
  The whole edge set is mirror-symmetric.
- **Threads:** each file is tied to the bottom-row node directly above it by a
  thin thread. Threads stay visible for the whole loop.
- **Agent:** the orb sits at top centre, above the middle node of the top row.

The user picked this layout from a flat 2D mockup (option 1 "Shelf"). The
mockup file was temporary and no longer exists; its geometry, in a 320 × 180
frame with x = 160 as the mirror line, was:

| Element | Position |
|---|---|
| Agent orb (radius 10) | (160, 20) |
| Top row (3 nodes) | x = 112, 160, 208 at y = 52 |
| Middle row (5 nodes) | x = 64, 112, 160, 208, 256 at y = 80 |
| Bottom row (6 nodes) | x = 40, 88, 136, 184, 232, 280 at y = 112 |
| File cards (28 × 20) | same x as the bottom row, at y = 152 |
| Node radius | 6 |

Edges in the mockup: middle node *i* links to bottom nodes *i* and *i + 1*, and
the middle nodes link to their neighbours. The top-left node links to middle
nodes 0 and 1, and the top-right node links to middle nodes 3 and 4. The top
centre node links to middle nodes 1, 2 and 3 and to both top-row neighbours.
Edges are straight lines, and threads are soft vertical S-curves. The lit path
runs agent → top centre → middle nodes 1 and 3 → bottom nodes 1 and 4 → the
image and code files.

**Calls made while writing this doc (not decided by the user):**

- Camera: fixed and front-on, centred on the mirror line, with gentle
  perspective and depth for the 3D ceramic look. No side-to-side sway or
  off-centre dolly, since both break the symmetry. A slow, symmetric push-in
  is fine.
- The faint 40 px background grid baked into today's video stays, as part of
  the current look.

## Sequence (12 s seamless loop)

The timings are the user-approved guide. Small retiming for comfort is the
builder's call.

1. **0 – 2 s: Files.** The six files rest in their row, with open paper above.
   Only slow, shared, symmetric idle motion.
2. **2 – 5 s: Threads rise.** A node lifts out of each file on its thread.
   Then the graph builds upward row by row: bottom-row edges, then the middle
   row, then the top row. It is mirror-symmetric at every frame, so left and
   right partners always move together.
3. **5 – 6 s: Agent arrives.** The orb settles in at top centre, and one edge
   connects it to the top-centre node.
4. **6 – 9.5 s: Search.** A cobalt pulse travels down from the agent, splits
   into two mirrored paths, and runs down the edges and threads into one
   mirrored pair of files: image and code, the second from each end. The
   graph's nodes and edges dim slightly so the lit path stands out. Those two
   files lift a little and glow cobalt, then hold for a beat.
   **Return (decided by the user):** a cobalt glow then travels from each lit
   file back up its lit path. The two glows meet at the top centre node and
   reach the agent, which brightens briefly as it receives them. The search
   and return together end at about 10 s.
5. **About 10 – 12 s: Reset.** The lit path fades. The graph folds back down
   row by row, top first, and the nodes sink back into their files. The last
   frame matches the first frame. The reset is shorter now to make room for
   the return. If 2 s feels rushed, the builder may lengthen the loop to
   14 s rather than hurry the motion.

The agent's logo keeps cycling throughout. It must never change mid-pulse
in a way that pulls the eye away from the lit path; the builder times the
changes to stay out of the way.

## Phone cut

On phones the frame is 4:5. Six files in one row would be too small, so the
phone cut uses two rows of three files, keeping the same mirror symmetry
about the vertical centre line, with the graph and agent above them. (The user
accepted this layout when it was proposed.)

**Calls made while writing this doc:**

- The upper file row is image, audio, code, and the lower row is document,
  table, database. The lit pair stays image and code, the two ends of the
  upper row, so it is still a mirrored pair.
- The graph keeps its 6-5-3 shape, narrowed to fit. No thread crosses a
  card: the lower row's threads curve up through the gaps beside the upper
  cards. The exact routing is left to the builder.

## Sharpness

The current wide video is 1440 × 608, while the figure is often wider than
1440 CSS px × the device pixel ratio, so it gets upscaled and looks soft. It is
also heavily compressed, which smears thin lines.

Requirements:

- Wide cut encoded at **2880 × 1216** (2× the current size, same 1440:608
  aspect).
- Frames rendered with anti-aliasing at least as good as rendering at the
  output size with supersampling. Thin lines and threads stay crisp, without
  stair-stepping or shimmer between frames.
- Encoding good enough that thin lines and node edges show no visible
  smearing or blocking at 100% zoom.
- **Size ceiling (decided by the user): up to 2 MB for the 2880 file.**
- Delivery, proposed in brainstorming and accepted by the user:
  - the 2880 file loads only on wide, high-DPI screens;
  - other wide screens get a 1440 × 608 cut;
  - phones keep their own separate, small portrait cut.
- **Calls made while writing this doc:**
  - A file starts loading only when the section is about to scroll into view,
    not on page idle as `video.js` does today, so visitors who never scroll
    there don't pay for it.
  - The phone cut is encoded at 1080 × 1350 so it is sharp on phones too,
    with a ceiling of about 1 MB.
  - Which cut to load is decided by the figure's width × devicePixelRatio,
    so a phone held sideways still never gets the 2880 file.
  - `encode-graph-loop.mjs` budgets and the `npm run perf` baseline are
    updated to the new sizes. Any other perf regression, such as time to
    first frame, still has to be fixed or reported to the user.

## How it gets made (builder's call unless stated)

- **Decided:** it is built from the existing three.js loop in
  `frontend_website/src/graph-loop/` (the user had the Blender render
  replaced with the three.js one) and rendered to video. Do not use
  `frontend_website/blender/`.
- The frame-by-frame export already exists in
  `frontend_website/scripts/export-graph-loop.mjs` (headless Chromium renders
  each frame from its exact time, then ffmpeg encodes it). Reuse or adapt it.
- `layout.js` and `scene.js` hold today's composition and timeline. They are
  replaced or reworked for the Shelf composition. Anything no longer used,
  such as the particles, the node side-labels and the closing triangle-mark
  formation, can be removed. Keep the agent orb's logo cycling.
- `index.html` keeps loading the four files through `video.js` with content
  hashes in `?v=`; update those after the encode. `index.html` also has
  unrelated uncommitted edits from other work, so change only the video lines
  and leave the rest alone.
- **Call made while writing this doc:** "done" means committed on the current
  branch and checked in the local dev server. Pushing and the Vercel deploy
  happen only when the user asks.
- Keep the existing CSS edge masks that blend the video into the page.

## Left to the builder

- Exact node coordinates, sizes, depth and camera, as long as the frame reads
  as the mockup and stays symmetric.
- Easing curves, small timing adjustments and idle motion.
- Codec settings and final file sizes, within the sharpness requirements.
- Whether to also ship a more efficient codec (AV1 or VP9) with an MP4
  fallback.

## Done when

- Both cuts (wide and phone) are re-rendered and live on the landing page.
- A frame-seam check shows the last frame flows into the first with no
  visible jump.
- Stills at 0, 3, 5.5, 8 and 11 s are reviewed for symmetry and sharpness at
  2× zoom.
- `npm run perf` still passes, apart from the agreed bigger video bytes.
