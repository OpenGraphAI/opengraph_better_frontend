# OpenGraph Image

`opengraph-image` turns a folder of images into a knowledge graph that an agent can inspect and query conversationally.

## What the package extracts

The image pipeline looks beyond filename metadata and captions. Each image contributes these kinds of nodes:

| Node | What it holds | Example |
| --- | --- | --- |
| Image | The source file, its dimensions, and format | `kitchen-01.jpg` |
| Object | A detected thing, with an optional normalized bounding box | `mug` |
| Scene | One scene label per image from a fixed set | `indoor_residential` |
| Attribute | A color, material, mood, lighting, style, or size value | `material: ceramic` |
| Text span | Text read from inside the image | `"EXIT"` |

Objects, scenes, attributes, text spans, and every edge carry a confidence score between 0 and 1.

Scene labels come from a fixed set: `outdoor`, `indoor_residential`, `indoor_commercial`, `indoor_other`, `vehicle`, and `mixed`.

### Relationships with a fixed vocabulary

Relationships between objects use a small controlled set: `next_to`, `on_top_of`, `inside`, `behind`, `in_front_of`, `holding`, and `wearing`. Because the words are fixed, "a mug on a table" matches the same way in every photo, not only in the ones whose captions happen to phrase it that way.

### Linked across images

After extraction, objects, scenes, and attributes with the same label are merged into one node that records every image it was `seen_in`. Asking "which photos show a bicycle?" becomes a single lookup rather than a search over captions.

## Package interfaces

| Interface | Best for |
| --- | --- |
| CLI | Local exploration, scripts, and repeatable terminal workflows |
| MCP server | Claude Code, Claude Desktop, Cursor, and other MCP-compatible agents |
| `graph.json` | Inspecting or integrating the serialized graph directly |

## Build lifecycle

```text
folder
  ├─ image-01.jpg
  ├─ image-02.png
  └─ image-03.webp
          ↓ build
opengraph-out/
  └─ graph.json
          ↓ query
entities + relationships + grounded answer
```

## A relationship-aware query

Keyword search can locate images tagged with “person” or “umbrella.” A graph query can ask for the relationship between them:

> Which images show a person holding an umbrella?

The graph follows the extracted `holding` relationship and returns the source images supporting the match. The answer names the image files it relied on.

## Limits worth knowing

- **Images leave your machine during a build.** Extraction calls a hosted vision model, so build time and cost grow with the number of images. The graph itself is stored locally.
- **Merging is by label, not identity.** Two different red mugs in two photos become one `mug` node seen in both. OpenGraph groups what looks the same; it does not track individual objects.
- **The vocabularies are deliberately small.** A relationship outside the set, such as "pouring into", is not recorded as an edge.
- **Still images only.** For video, sample frames into a folder first. The [image and video search](/use-cases/image-video-search/) page shows how.
- **Alpha software.** The graph format may change between releases.

## Current scope

This section describes the image package. Documents and tables have their own packages, with overviews under [OpenGraph Text](../opengraph-text/README.md) and [OpenGraph Table](../opengraph-table/README.md). The wider project is building toward a shared graph layer that also covers audio and video.

## Continue building

- [Install and run the package](../getting-started/quickstart.md)
- [Connect it to Claude](../getting-started/claude-mcp.md)
- [Review every MCP operation](../reference/mcp-tools.md)
