# Map a research corpus

A literature review lives in many places at once: PDFs of papers, figures exported as images, and supplementary tables in spreadsheets. OpenGraph builds the structure that matters once, such as who reported what, which groups work together, and where two papers disagree, and keeps every node pointing back to the file it came from.

## Papers
### Entities, topics, and claims from every paper.

Run [OpenGraph Text](/products/opengraph-text/) over a folder of papers and notes. People, organizations, places, products, concepts, and events merge across papers, so a lab or author appears once with every paper that mentions it; topics merge across the corpus. Claims stay short and literal, each linked to the paper that makes it, and are never merged: when two papers report different results, both stay in the graph with their sources.

```visual:edges Example output
smith-2024.pdf | states | "Dropout held at 14% across both arms."
patel-2023.pdf | states | "Weekly reminders halved dropout."
Ravi Patel | works_at | Robotics Group | 0.86
```

## Ask the corpus
### Questions that work well.

Ask which papers make claims about sample size, which organizations collaborate and in which papers, or for every claim on a topic with the paper each comes from.

```visual:exchange Example output
you: List every claim about dropout rates, with the paper each comes from.
-> query_graph(question, "./papers")
agent: Three claims, from smith-2024.pdf, patel-2023.pdf, and lee-2025.pdf, quoted with their sources.
```

## Figures and supplementary data
### Figures and tables, through their own graphs.

Figures go through [OpenGraph Image](/products/opengraph-image/), which records visible objects and the text inside the image, such as axis labels, legends, and annotations; it describes what a figure shows, not the plotted values behind it. Supplementary tables go through [OpenGraph Table](/products/opengraph-table/) (preview), which keeps every entity and metric tied to its file, sheet, and cell. Register the servers together and a research agent can move between them, as the [multimodal agents](/use-cases/multimodal-agents/) page shows.

```visual:edges Example output
fig3-retention.png | has_text | "Weeks since enrollment" | 0.90
fig3-retention.png | has_text | "Control" | 0.87
supp-table-2.xlsx | contains_metric | dropout_rate
```

## Provenance by default
### Every answer traces back to its source in one step.

Every claim links to a document, every table value to a sheet and cell, and every visual entity to an image. A reviewer can trace any answer back to its source instead of trusting a summary.

## Good to know

> **Before you process sensitive data.** Building a graph sends source content to the configured model provider, currently the Anthropic API; the graph files are written locally. Before you process unpublished results, participant data, or anything governed by an ethics approval, a data-use agreement, or privacy law, confirm that sending it to a hosted model is allowed.

> **Not for clinical use.** OpenGraph is a research tool. It is not validated for clinical or diagnostic use.

- **The relation set is general-purpose.** `collaborates_with`, `part_of`, and `mentions` exist; research-specific links such as `cites`, `replicates`, or `contradicts` do not yet. Use claims for findings.
- **PDFs need a text layer.** Scanned papers without embedded text need OCR first.
- **Separate graphs per format.** Papers, figures, and tables live in separate graphs, and the agent connects them at query time.

Working on a research corpus and want to try this with us? [Get in touch](/#about).

## Go deeper
- [OpenGraph Text overview](/docs/opengraph-text/overview/) — Node types, relations, tools, install, and limits
- [OpenGraph Table overview](/docs/opengraph-table/overview/) — Parts, merging, tools, install from source, and limits
- [Context graphs](/docs/concepts/context-graphs/) — Entities, relationships, and evidence paths
- [Connect Claude with MCP](/docs/getting-started/claude-mcp/) — Add the servers to Claude Code or Claude Desktop
