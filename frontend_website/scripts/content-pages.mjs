import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { contentPages, contentSchema, siteUrl } from "../src/site-metadata.js";
import { renderRows, renderRowsHtml } from "./page-rows.mjs";
import { escapeHtml } from "./site-chrome.mjs";

export const contentDir = "content";

/** Fill the title, description, canonical, Open Graph and Twitter tags of a page template. */
export function applyPageMeta(html, { title, description, canonical }) {
  return html
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*/, `$1${escapeHtml(description)}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${canonical}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${canonical}`)
    .replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*/g, `$1${escapeHtml(title)}`)
    .replace(/(<meta (?:property="og:description"|name="twitter:description") content=")[^"]*/g, `$1${escapeHtml(description)}`);
}

const isExternal = (href) => /^https?:\/\//.test(href);
const button = ({ label, href }, variant) =>
  `<a class="page-button page-button-${variant}" href="${escapeHtml(href)}"${isExternal(href) ? ' target="_blank" rel="noopener noreferrer"' : ""}>${escapeHtml(label)}</a>`;

/** The pages listed in `related`, as cards at the foot of the page. */
function renderRelated(page) {
  const cards = (page.related || [])
    .map((path) => contentPages.find((candidate) => candidate.path === path))
    .filter(Boolean)
    .map((target) => `<a href="${target.path}"><b>${escapeHtml(target.navLabel)}</b><span>${escapeHtml(target.navBlurb)}</span></a>`);
  return cards.length
    ? `<nav class="page-related-cards" aria-labelledby="page-related-title">
        <h2 class="page-section-label" id="page-related-title">Related</h2>
        <div>${cards.join("")}</div>
      </nav>`
    : "";
}

// A fact is plain text, or { label, href } when it should link out (e.g. to PyPI).
const renderFact = (fact) =>
  typeof fact === "string"
    ? escapeHtml(fact)
    : `<a href="${escapeHtml(fact.href)}"${isExternal(fact.href) ? ' target="_blank" rel="noopener noreferrer"' : ""}>${escapeHtml(fact.label)}</a>`;

function renderBreadcrumb(page) {
  const badge = page.badge ? `<span class="page-badge">${escapeHtml(page.badge)}</span>` : "";
  return `<nav class="page-breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li><a href="/">Home</a></li>
            <li>${escapeHtml(page.section)}</li>
            <li aria-current="page">${escapeHtml(page.navLabel)}</li>
          </ol>
          ${badge}
        </nav>`;
}

/** A short excerpt of what the build produces, so each page shows output before prose. */
function renderSpecimen(specimen) {
  if (!specimen) return "";
  const commands = specimen.commands
    .map((command) => `<p><span aria-hidden="true">$</span> <code>${escapeHtml(command)}</code></p>`)
    .join("");
  const inputs = specimen.inputs.map((name) => `<li>${escapeHtml(name)}</li>`).join("");
  const edges = specimen.edges
    .map(([from, relation, to, score], index) => `<li style="--i: ${index}">
              <span class="specimen-node">${escapeHtml(from)}</span>
              <span class="specimen-relation"><span class="specimen-relation-label">${escapeHtml(relation)}</span></span>
              <span class="specimen-node">${escapeHtml(to)}</span>
              ${score ? `<span class="specimen-score" title="Confidence">${escapeHtml(score)}</span>` : ""}
            </li>`)
    .join("");
  return `<figure class="specimen">
        <div class="specimen-commands">${commands}</div>
        <div class="specimen-body">
          <p class="specimen-label">Reads <span class="example-tag">Example output</span></p>
          <ul class="specimen-inputs">${inputs}</ul>
          <p class="specimen-label">Writes edges like</p>
          <ul class="specimen-edges">
            ${edges}
          </ul>
        </div>
        <figcaption>${escapeHtml(specimen.output)}</figcaption>
      </figure>`;
}

/** Previous and next links walk products, then use cases, in navigation order. */
function renderPager(page) {
  const index = contentPages.findIndex((candidate) => candidate.path === page.path);
  const link = (target, direction) =>
    target
      ? `<a class="page-pager-${direction}" href="${target.path}" rel="${direction}">
          <span>${direction === "prev" ? "Previous" : "Next"}</span>
          <b>${escapeHtml(target.navLabel)}</b>
        </a>`
      : "<span></span>";
  return `<nav class="page-pager" aria-label="More pages">
      ${link(contentPages[index - 1], "prev")}
      ${link(contentPages[index + 1], "next")}
    </nav>`;
}

function renderPageContent(page, heading, sections) {
  const facts = page.facts?.length
    ? `<ul class="page-facts" aria-label="Release details">${page.facts.map((fact) => `<li>${renderFact(fact)}</li>`).join("")}</ul>`
    : "";
  return `<header class="page-hero${page.specimen ? " has-specimen" : ""}">
      <div class="page-hero-inner">
        <div class="page-hero-copy">
          ${renderBreadcrumb(page)}
          <h1>${escapeHtml(heading)}</h1>
          <p class="page-lede">${escapeHtml(page.lede)}</p>
          ${facts}
          <div class="page-actions">
            ${button(page.primaryCta, "primary")}
            ${page.secondaryCta ? button(page.secondaryCta, "secondary") : ""}
          </div>
        </div>
        ${renderSpecimen(page.specimen)}
      </div>
    </header>

    <div class="page-rows-wrap">
      ${renderRowsHtml(sections)}
      ${sections.goodToKnow}
      ${sections.goDeeper}
      ${renderRelated(page)}
    </div>

    ${renderPager(page)}

    <section class="page-cta" aria-labelledby="page-cta-title">
      <div>
        <h2 id="page-cta-title">Build your first graph</h2>
        <p>Open source under Apache-2.0. Runs locally with your own Anthropic API key.</p>
      </div>
      <div class="page-actions">
        ${button({ label: "Read the docs", href: "/docs/" }, "primary")}
        ${button({ label: "Star on GitHub", href: "https://github.com/OpenGraphAI/opengraph-ai" }, "secondary")}
      </div>
    </section>`;
}

/**
 * Render one markdown-backed page into the shared template (header and footer already injected).
 * @param {string} template
 * @param {(typeof contentPages)[number]} page
 * @param {string} root
 */
export function renderContentPage(template, page, root) {
  const markdown = readFileSync(resolve(root, contentDir, page.source), "utf8");
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1] || page.navLabel;
  const sections = renderRows(markdown.replace(/^#\s+.+\n/, ""));
  const canonical = `${siteUrl}${page.path}`;
  const schema = JSON.stringify(contentSchema(page, heading)).replace(/</g, "\\u003c");

  return applyPageMeta(template, { title: `${page.title} | OpenGraph AI`, description: page.description, canonical })
    .replace("<!-- page-content -->", () => renderPageContent(page, heading, sections))
    .replaceAll(`href="${page.path}"`, `href="${page.path}" aria-current="page"`)
    .replace("</head>", () => `<script type="application/ld+json">${schema}</script>\n</head>`);
}
