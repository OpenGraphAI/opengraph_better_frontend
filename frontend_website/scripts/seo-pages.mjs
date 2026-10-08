import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { marked } from "marked";
import { docsPages, docsSchema, siteUrl } from "../src/site-metadata.js";

const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const sitemap = () => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", ...docsPages.map((page) => page.path)].map((path) => `  <url><loc>${siteUrl}${path}</loc></url>`).join("\n")}\n</urlset>\n`;

function renderDoc(template, page, root) {
  const markdown = readFileSync(resolve(root, "docs/content", page.source), "utf8");
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1] || page.title;
  let content = marked.parse(markdown.replace(/^#\s+.+\n/, ""));
  content = content.replace(/href="([^"]+\.md)"/g, (match, href) => {
    const source = new URL(href, `https://docs.local/${page.source}`).pathname.slice(1);
    const target = docsPages.find((candidate) => candidate.source === source);
    return target ? `href="${target.path}"` : match;
  });
  const canonical = `${siteUrl}${page.path}`;
  const title = `${page.title} | OpenGraph AI`;
  const schema = docsSchema(page, heading);
  return template
    .replace(/<title>.*?<\/title>/, `<title>${escape(title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*/, `$1${escape(page.description)}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${canonical}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${canonical}`)
    .replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*/g, `$1${escape(title)}`)
    .replace(/(<meta (?:property="og:description"|name="twitter:description") content=")[^"]*/g, `$1${escape(page.description)}`)
    .replace(/(<h1 data-page-title>).*?(<\/h1>)/, `$1${escape(heading)}$2`)
    .replace(/(<article class="markdown-body" data-docs-article>).*?(<\/article>)/s, (_, open, close) => `${open}${content}${close}`)
    .replace(/(<nav class="docs-nav"[^>]*>).*?(<\/nav>)/s, `$1${docsPages.map((doc) => `<a class="docs-nav-link" href="${doc.path}">${escape(doc.title)}</a>`).join("\n")}$2`)
    .replace("</head>", `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>\n</head>`);
}

/** Real HTML pages keep docs readable and crawlable without JavaScript. */
export function seoPages() {
  let root;
  return {
    name: "opengraph-seo-pages",
    enforce: "post",
    configResolved(config) { root = config.root; },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path === "/sitemap.xml") {
          res.setHeader("Content-Type", "application/xml");
          res.end(sitemap());
          return;
        }
        if (docsPages.some((page) => page.path !== "/docs/" && [page.path, page.path.slice(0, -1)].includes(path))) req.url = "/docs/index.html";
        next();
      });
    },
    generateBundle(_, bundle) {
      const template = bundle["docs/index.html"];
      if (!template || template.type !== "asset") throw new Error("Documentation HTML is missing from the build.");
      const html = String(template.source);
      docsPages.forEach((page) => {
        const source = renderDoc(html, page, root);
        if (page.path === "/docs/") template.source = source;
        else this.emitFile({ type: "asset", fileName: `${page.path.slice(1)}index.html`, source });
      });
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap() });
    },
  };
}
