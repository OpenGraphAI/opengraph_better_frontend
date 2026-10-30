# One agent, every source

Real questions rarely stay inside one format. Which sites reported damage, what the maintenance manual says to do about it, and whether the site photos show the problem: the answer lives in a spreadsheet, a PDF, and a folder of images. OpenGraph gives each format its own graph and exposes each one to your agent through MCP, so the agent follows typed edges and cites the file behind every step.

## How it works today
### One MCP server per format, side by side.

Each package builds a graph for one modality and runs as its own MCP server, and every answer comes back with evidence a person can open:

- **OpenGraph Image** reads photos, screenshots, and sampled video frames, and returns image filenames.
- **OpenGraph Text** reads `.txt`, `.md`, and PDF documents, and returns document paths and claims.
- **OpenGraph Table** (preview) reads CSV, TSV, Excel, and table images, and returns the file, sheet, and cell.

Install the ones you need and register them together.

## A worked example
### Three graphs, one answer with a source for every statement.

The agent queries the table graph for sites marked damaged, the text graph for the manual's procedure, and the image graph for the matching photos. It combines the three with a citation for each step and flags any site where the photos do not support the report. As with every server: summarize first, query second, and inspect individual sources only when an answer needs verification.

```visual:exchange Example output
you: Which sites in site-reports.xlsx were marked damaged, what does the manual say to do, and do the photos in ./site-photos show the damage?
-> opengraph-table: query_graph("Which sites are marked damaged?", "./reports")
-> opengraph-text: query_graph("What is the procedure for this damage?", "./manuals")
-> opengraph-image: get_image_entities("site-14-roof.jpg", "./site-photos")
agent: Two sites are marked damaged. The manual's procedure applies to both, and the photos support one of them; each statement cites its file.
```

## Why separate graphs help
### Structure survives, edges stay typed, answers stay checkable.

A cell stays tied to its row and column, a claim to its document, an object to its image; nothing is flattened into undifferentiated chunks. `acquired`, `on_top_of`, and a metric's source cell mean different things, and the agent can treat them differently. Every step points to a file a person can open and check.

```visual:chips From the docs
acquired
*on_top_of
contains_metric
states
seen_in
```

## Good to know

> **OpenGraph Table is a preview you install from source.** OpenGraph Image and OpenGraph Text are on PyPI.

- **No merged cross-modal graph.** Each server keeps its own graph. Matching "ACME Corp" in a PDF to "Acme" in a spreadsheet is left to the agent's reasoning.
- **Audio and video are not supported directly.** Video can be sampled into frames for OpenGraph Image; audio has no package yet.

A shared semantic graph across tables, text, images, audio, and video is where the project is heading. If you are building agents that need it, [talk to us](/#about).

## Go deeper
- [Connect Claude with MCP](/docs/getting-started/claude-mcp/) — Add the servers to Claude Code or Claude Desktop
- [MCP tools](/docs/reference/mcp-tools/) — Inputs, outputs, and the summarize-then-query pattern
- [Context graphs](/docs/concepts/context-graphs/) — Entities, relationships, and evidence paths
