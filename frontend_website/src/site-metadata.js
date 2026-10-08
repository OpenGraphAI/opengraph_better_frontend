export const siteUrl = "https://opengraphai.io";

export const docsPages = [
  { slug: "introduction", path: "/docs/", source: "README.md", title: "Knowledge Graph Documentation", description: "Learn how OpenGraph AI builds queryable knowledge graphs, preserves source evidence, and gives AI agents connected context through the CLI and MCP." },
  { slug: "getting-started/quickstart", path: "/docs/getting-started/quickstart/", source: "getting-started/quickstart.md", title: "Knowledge Graph Quickstart", description: "Install OpenGraph Image, build a knowledge graph from your images, inspect entities and relationships, and run your first evidence-backed query." },
  { slug: "getting-started/claude-mcp", path: "/docs/getting-started/claude-mcp/", source: "getting-started/claude-mcp.md", title: "Connect Claude with MCP", description: "Connect OpenGraph AI to Claude Code or Claude Desktop with MCP. Build image knowledge graphs and query relationships from your existing agent workflow." },
  { slug: "concepts/context-graphs", path: "/docs/concepts/context-graphs/", source: "concepts/context-graphs.md", title: "Context Graphs: Entities, Relationships & Evidence", description: "Understand OpenGraph AI context graphs: source nodes, entities, typed relationships, and evidence paths that agents can inspect and traverse." },
  { slug: "opengraph-image/overview", path: "/docs/opengraph-image/overview/", source: "opengraph-image/README.md", title: "OpenGraph Image Overview", description: "Explore OpenGraph Image, the image-to-knowledge-graph implementation. Extract connected entities from image collections and access them through CLI or MCP." },
  { slug: "reference/mcp-tools", path: "/docs/reference/mcp-tools/", source: "reference/mcp-tools.md", title: "MCP Tools Reference", description: "Reference for OpenGraph AI MCP tools. Build and inspect image knowledge graphs, query connected entities, and return source evidence to your AI agent." },
  { slug: "reference/cli", path: "/docs/reference/cli/", source: "reference/cli.md", title: "CLI Command Reference", description: "Use the OpenGraph Image CLI to build, inspect, and query knowledge graphs. Find command syntax, configuration options, and examples for your workflow." },
];

export function docsSchema(page, heading) {
  const canonical = `${siteUrl}${page.path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "TechArticle", headline: heading, description: page.description, url: canonical, inLanguage: "en", publisher: { "@id": `${siteUrl}/#organization` } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Documentation", item: `${siteUrl}/docs/` },
        ...(page.path === "/docs/" ? [] : [{ "@type": "ListItem", position: 3, name: heading, item: canonical }]),
      ] },
    ],
  };
}
