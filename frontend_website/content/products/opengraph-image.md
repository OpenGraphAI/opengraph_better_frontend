# OpenGraph Image

Most image search stops at filenames, tags, and captions. OpenGraph Image reads every image in a folder with a vision model and writes what it sees into one `graph.json` that your agent can follow, edge by edge.

## Beyond captions
### What the model sees, kept as a graph.

Objects in the frame, the scene, colors and materials, text that appears in the picture, and how the objects relate. Each node and edge carries a confidence score between 0 and 1, so your agent follows edges instead of guessing which caption fits.

```visual:edges Example output
@ park-11.jpg
person | wearing | backpack | 0.91
bicycle | next_to | bench | 0.86
bench | has_attribute | material: wood | 0.83
```

## Fixed vocabulary
### The same words in every photo.

Relationships come from a small, fixed set. "A mug on a table" matches the same way in every image, not only in the ones whose captions happen to phrase it that way.

```visual:chips From the docs
next_to
*on_top_of
inside
behind
in_front_of
holding
wearing
```

## Linked across images
### One node, every photo it's in.

Objects, scenes, and attributes with the same label merge into one node that records every image it was `seen_in`. "Which photos show a bicycle?" becomes a single lookup rather than a search over captions.

```visual:fan Example output
bicycle
seen_in
street-03.jpg
park-11.jpg
garage-02.jpg
```

## For your agent
### Six MCP tools.

Claude Code, Claude Desktop, Cursor, or any MCP client can build, inspect, and query the graph. Graphs resolve by folder, so a later session that names `./photos` picks up where the last one stopped.

```visual:exchange Example output
you: Who is holding an umbrella?
-> query_graph("Who is holding an umbrella?", "./photos")
agent: street-14.jpg shows a person holding an umbrella.
-> get_image_entities("street-14.jpg", "./photos")
```

## Good to know

> **Images leave your machine during a build.** Extraction calls a hosted vision model through the Anthropic API, so build time and cost grow with the number of images. The graph itself is stored locally.

- **Merges by label, not identity.** Two different red mugs become one `mug` node seen in both photos.
- **Small, fixed vocabularies.** A relationship outside the set, such as "pouring into", is not recorded.
- **Still images only.** For video, sample frames into a folder first.
- **Alpha software.** The graph format may change between releases.

[Every limit, with examples](/docs/opengraph-image/overview/)

## Go deeper
- [Quickstart](/docs/getting-started/quickstart/) — Install, build, and query the sample images
- [OpenGraph Image overview](/docs/opengraph-image/overview/) — Node types, relationships, and limits
- [MCP tools](/docs/reference/mcp-tools/) — Every tool's inputs and outputs
- [CLI](/docs/reference/cli/) — Build, summary, and query commands
