# OpenGraph Table

A number in a spreadsheet only means something next to its row label, its column header, and the sheet it lives on. OpenGraph Table reads CSV, TSV, and Excel files, plus photos and screenshots of tables, and keeps the file, sheet, and cell behind every value.

## What goes in, what comes out
### Tables in. A graph, a browsable page, and a report out.

It turns tables into entities, relationships, metrics, and notes, then writes `graph.json` for agents and code, `graph.html` for browsing, and `graph.md` for people.

```visual:terminal
$ opengraph-table build ./tables
tables/opengraph-out/graph.json
tables/opengraph-out/graph.html
tables/opengraph-out/graph.md
```

## Numbers keep their context
### Six kinds of part, each tied to its source.

Columns carry an inferred type: text, numeric, date, or boolean. Metrics hold sums, averages, counts, minimums, maximums, and percentages. Notes record insights, anomalies, and validation checks.

```visual:chips
source
column
*entity
relationship
metric
note
```

## Many tables, one graph
### "Acme" in two sheets is one node.

Entities deduplicate by normalized name and type, node IDs are scoped by source so two `id` columns never collide, and next month's export appends without a rebuild.

```visual:terminal
$ opengraph-table ingest ./tables-october \
    --graph ./tables/opengraph-out/graph.json
```

## For your agent
### Five MCP tools, one for pasted tables.

Build, query, and list sources from Claude or any MCP client. When someone drops a CSV into a conversation, `build_graph_from_content` builds a graph from it without first saving the CSV to a folder.

```visual:exchange
you: Here is our Q3 cost export. Which supplier costs the most?
-> build_graph_from_content([q3-costs.csv], "./q3/graph.json")
-> query_graph("Which supplier costs the most?", "./q3/graph.json")
agent: Acme Robotics, from the total_cost column of q3-costs.csv.
```

## Good to know

> **Preview.** OpenGraph Table is not on PyPI yet and its interfaces may change before the first release. Install it from source to try it today.

> **Table content leaves your machine during a build.** Extraction calls the Anthropic API, including for images of tables.

> **Deduplication is heuristic.** It works on names and types, so review merged entities before relying on them for financial or compliance work.

- **Large graphs are not tuned yet.** Past roughly 10,000 nodes, builds and queries may be slow.
- **Preview interfaces.** Command and tool signatures still differ slightly from OpenGraph Image and OpenGraph Text.

[Every limit, with details](/docs/opengraph-table/overview/). Have a table-heavy workload? [Get in touch](/#about) and tell us what your data looks like.

## Go deeper
- [OpenGraph Table overview](/docs/opengraph-table/overview/) — Parts, merging, tools, install from source, and limits
- [Connect Claude with MCP](/docs/getting-started/claude-mcp/) — Add an MCP server to Claude Code or Claude Desktop
- [Context graphs](/docs/concepts/context-graphs/) — Entities, relationships, and evidence paths
