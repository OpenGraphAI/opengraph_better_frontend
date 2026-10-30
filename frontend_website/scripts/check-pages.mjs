// Loads every product and use-case page from the built site at phone and
// desktop widths and fails when content runs past the screen edge (the site
// clips sideways overflow, so it would be cut off, not scrollable), a visual has no
// "Example output" / "From the docs" tag, a visual's caption overlaps its tag,
// or the console reports an error.
//
//   npm run build && node scripts/check-pages.mjs
//   options: --base=http://localhost:4317 (skip starting vite preview)

import { chromium } from "playwright";
import { preview } from "vite";
import { contentPages } from "../src/site-metadata.js";

const VIEWPORTS = [
  { name: "small", width: 320, height: 640 },
  { name: "phone", width: 375, height: 812 },
  { name: "desktop", width: 1440, height: 900 },
];

async function checkPage(browser, base, path, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(new URL(path, base).href, { waitUntil: "load" });
    const found = await page.evaluate(() => {
      // Content inside its own scrolling box (a code block, a wide table) is fine
      // as long as that box itself fits on screen.
      const insideFittingScroller = (element) => {
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
          if (["auto", "scroll"].includes(getComputedStyle(parent).overflowX)) {
            return parent.getBoundingClientRect().right <= window.innerWidth + 1;
          }
        }
        return false;
      };
      const wide = [...document.querySelectorAll(".page-hero *, .page-rows-wrap *")]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.right > window.innerWidth + 1 && !insideFittingScroller(element);
        })
        .slice(0, 3)
        .map((element) => `${element.tagName.toLowerCase()}.${[...element.classList].join(".")}`);
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        wide,
        untagged: [...document.querySelectorAll(".page-row-visual")].filter((visual) => !visual.querySelector(".row-visual-tag")).length,
        overlapping: [...document.querySelectorAll(".page-row-visual")].filter((visual) => {
          const tag = visual.querySelector(".row-visual-tag")?.getBoundingClientRect();
          const caption = visual.querySelector(".row-caption")?.getBoundingClientRect();
          return tag && caption && caption.right > tag.left && caption.left < tag.right && caption.bottom > tag.top && caption.top < tag.bottom;
        }).length,
        rows: document.querySelectorAll(".page-row").length,
      };
    });
    const problems = [];
    if (found.overflow > 0) problems.push(`scrolls sideways by ${found.overflow}px`);
    if (found.wide.length) problems.push(`runs past the screen edge: ${found.wide.join(", ")}`);
    if (found.untagged) problems.push(`${found.untagged} visual(s) without a tag`);
    if (found.overlapping) problems.push(`${found.overlapping} visual caption(s) overlap the tag`);
    if (!found.rows) problems.push("no feature rows");
    problems.push(...errors.map((error) => `console error: ${error}`));
    return problems;
  } finally {
    await page.close();
  }
}

async function main() {
  const baseArg = process.argv.find((arg) => arg.startsWith("--base="))?.slice(7);
  const server = baseArg ? null : await preview({ preview: { port: 4318, strictPort: false }, logLevel: "error" });
  const base = baseArg ?? server.resolvedUrls.local[0];
  const browser = await chromium.launch();
  let failures = 0;
  try {
    for (const { path } of contentPages) {
      for (const viewport of VIEWPORTS) {
        const problems = await checkPage(browser, base, path, viewport);
        failures += problems.length;
        console.log(`${problems.length ? "FAIL" : "ok  "} ${viewport.name.padEnd(7)} ${path}${problems.length ? `\n       ${problems.join("\n       ")}` : ""}`);
      }
    }
  } finally {
    await browser.close();
    await server?.close();
  }
  if (failures) {
    console.error(`\n${failures} problem(s) found.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
