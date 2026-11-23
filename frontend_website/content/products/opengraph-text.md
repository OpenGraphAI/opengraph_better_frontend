# OpenGraph Text

Retrieval over documents usually means cutting text into chunks and hoping the right passage ranks first. OpenGraph Text reads each document in a folder and records what it says as a graph, with every node linked back to the documents it came from.

## What goes in, what comes out
### Notes, reports, and PDFs in. One graph out.

Point it at a folder of .txt, .md, and .pdf files. It records who and what each document mentions, the topics it covers, the claims it makes, and how the people, organizations, and places in it relate. Every node and edge carries a confidence score.

```visual:edges
@ board-notes-q3.pdf
Acme Robotics | acquired | Beta Logistics | 0.91
Dana Ruiz | works_at | Acme Robotics | 0.88
Acme Robotics | located_in | Austin | 0.86
```

## Fixed relations
### Nine relations, spelled the same in every document.

Entities connect through a fixed set of relations. "Which reports say Acme acquired Beta?" means following an `acquired` edge, then pointing to the files that support it.

```visual:chips
works_at
founded
invested_in
*acquired
located_in
part_of
competitor_of
collaborates_with
mentions
```

## One entity, many documents
### "Acme Robotics Inc" and "Acme Robotics" are one node.

Entities with the same normalized name and type merge across documents into one node that records every document it was `seen_in`. Topics and attributes merge the same way.

```visual:fan
Acme Robotics
seen_in
board-notes-q3.pdf
market-scan.md
partner-call.txt
```

## Claims are kept apart
### When documents disagree, both claims stay.

Claims are never merged. Each stays linked to the document that states it, so an agent can report the disagreement and cite both sources instead of quietly picking one.

```visual:edges
board-notes-q3.pdf | states | "Acme opened a second plant in 2025."
partner-call.txt | states | "Acme's second plant opens in 2026."
```

## For your agent
### Five MCP tools.

Build, list, inspect, and query from Claude or any MCP client. Graphs resolve by folder: name the folder and the server finds the graph inside it. A sixth tool, `build_graph_html`, is on the main branch and ships with the next release.

```visual:exchange
you: Which reports say Acme acquired Beta?
-> query_graph("Which reports say Acme acquired Beta?", "./reports")
agent: board-notes-q3.pdf and market-scan.md both state it.
-> get_document_entities("market-scan.md", "./reports")
```

## Good to know

> **Documents leave your machine during a build.** Extraction and querying call the Anthropic API. The graph files are written locally.

- **PDFs need a text layer.** Scanned pages without embedded text come through empty; run OCR first.
- **General-purpose relations.** Domain links such as `cites` or `contradicts` are not in the set yet; use claims for findings.
- **Merging is by name.** Two different people who share a name and type will merge.
- **Alpha software.** Expect the schema to change between releases.

[Every limit, with details](/docs/opengraph-text/overview/)

## Go deeper
- [OpenGraph Text overview](/docs/opengraph-text/overview/) — Node types, relations, tools, install, and limits
- [Connect Claude with MCP](/docs/getting-started/claude-mcp/) — Add an MCP server to Claude Code or Claude Desktop
- [Context graphs](/docs/concepts/context-graphs/) — Entities, relationships, and evidence paths
