// Measures what the landing page costs a visitor, so a new graph-loop video
// can be checked against the old one before it ships.
//
//   npm run build && node scripts/perf-check.mjs --out=/tmp/before.json
//   (swap the video, rebuild)
//   npm run build && node scripts/perf-check.mjs --compare=/tmp/before.json
//   options: --runs=3  --profile=desktop|phone  --path=/products/opengraph-image/
//
// Each profile loads the built site from `vite preview`, waits without
// scrolling (the video is fetched on idle), then scrolls the video into view
// and watches it play (pages without the video skip that part, and their
// video metrics are reported as null). The phone profile uses Lighthouse's mobile settings:
// slow 4G and a 4x slower CPU. Medians across runs are reported. With
// --compare, the script exits non-zero when a budget below is exceeded.

import { writeFileSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { preview } from "vite";

const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, cpu: 1, network: null },
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    cpu: 4,
    // Lighthouse "slow 4G": 150 ms RTT, 1.6 Mbps down, 750 kbps up.
    network: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
  },
};

const SETTLE_MS = 6000; // idle time after load, long enough for the idle video fetch
const PLAYBACK_MS = 4000;
const VIDEO_TIMEOUT_MS = 30000;

// A metric fails when after > before * ratio + slack.
const BUDGETS = {
  lcp: { ratio: 1.1, slack: 100, label: "Largest contentful paint (ms)" },
  fcp: { ratio: 1.1, slack: 100, label: "First contentful paint (ms)" },
  cls: { ratio: 1, slack: 0.01, label: "Cumulative layout shift" },
  tbt: { ratio: 1.1, slack: 50, label: "Total blocking time (ms)" },
  pageBytes: { ratio: 1.05, slack: 20000, label: "Page bytes before scrolling (no video)" },
  videoPrefetch: { ratio: 1.05, slack: 10000, label: "Video bytes fetched before scrolling" },
  videoBytes: { ratio: 1.05, slack: 10000, label: "Video bytes after 4 s of playback" },
  videoStart: { ratio: 1.2, slack: 300, label: "Scroll to first video frame (ms)" },
  droppedRatio: { ratio: 1, slack: 0.03, label: "Dropped video frames (share)" },
  frameP95: { ratio: 1.2, slack: 4, label: "95th percentile frame time (ms)" },
};

function parseArgs(argv) {
  const args = Object.fromEntries(
    argv.filter((a) => a.startsWith("--")).map((a) => {
      const [key, value = "true"] = a.slice(2).split("=");
      return [key, value];
    }),
  );
  const profiles = args.profile ? [args.profile] : Object.keys(PROFILES);
  for (const name of profiles) {
    if (!PROFILES[name]) throw new Error(`Unknown profile "${name}"; use ${Object.keys(PROFILES).join(" or ")}`);
  }
  const runs = Number(args.runs ?? 3);
  if (!Number.isInteger(runs) || runs < 1) throw new Error("--runs must be a positive integer");
  const path = args.path ?? "/";
  if (!path.startsWith("/")) throw new Error("--path must start with /");
  return { runs, profiles, path, out: args.out ?? null, compare: args.compare ?? null };
}

// Installed before any page script runs.
function observe() {
  const perf = { fcp: 0, lcp: 0, cls: 0, longTasks: [] };
  window.__perf = perf;
  const watch = (type, onEntry) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({ type, buffered: true });
    } catch {
      // Entry type not supported by this browser; the metric stays at zero.
    }
  };
  watch("paint", (e) => { if (e.name === "first-contentful-paint") perf.fcp = e.startTime; });
  watch("largest-contentful-paint", (e) => { perf.lcp = e.startTime; });
  watch("layout-shift", (e) => { if (!e.hadRecentInput) perf.cls += e.value; });
  watch("longtask", (e) => { perf.longTasks.push([e.startTime, e.duration]); });
}

// Third-party requests (Google Fonts) are left out: their timing varies run to
// run and no change to this site affects them.
async function watchNetwork(cdp, origin) {
  // requestId -> { url, encoded, decoded, final }. A finished request counts its
  // final transfer size. A video still streaming never finishes, so it counts
  // what has arrived so far: encoded chunk sizes when Chrome reports them,
  // otherwise decoded sizes (video is not compressed in transit, so they match).
  const requests = new Map();
  const entry = (id) => requests.get(id) ?? requests.set(id, { url: "", encoded: 0, decoded: 0, final: null }).get(id);
  await cdp.send("Network.enable");
  cdp.on("Network.responseReceived", (e) => { entry(e.requestId).url = e.response.url; });
  cdp.on("Network.dataReceived", (e) => {
    const request = entry(e.requestId);
    request.encoded += e.encodedDataLength;
    request.decoded += e.dataLength;
  });
  cdp.on("Network.loadingFinished", (e) => { entry(e.requestId).final = e.encodedDataLength; });
  const bytesOf = (r) => r.final ?? (r.encoded || r.decoded);
  const sum = (filter) => [...requests.values()].filter(filter).reduce((total, r) => total + bytesOf(r), 0);
  return {
    page: () => sum((r) => r.url.startsWith(origin) && !r.url.includes("/video/")),
    video: () => sum((r) => r.url.includes("/video/")),
  };
}

const NO_VIDEO = { videoStart: null, droppedRatio: null, frameP95: null, videoSrc: null };

async function measurePlayback(page) {
  if (!(await page.locator("[data-graph-video]").count())) return NO_VIDEO;
  return page.evaluate(async ({ playbackMs, timeoutMs }) => {
    const video = document.querySelector("[data-graph-video]");
    const started = performance.now();
    video.scrollIntoView({ block: "center" });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Video did not start within ${timeoutMs} ms`)), timeoutMs);
      const check = () => {
        if (video.currentTime > 0 && !video.paused) {
          clearTimeout(timer);
          resolve();
        } else {
          requestAnimationFrame(check);
        }
      };
      check();
    });
    const videoStart = performance.now() - started;

    const before = video.getVideoPlaybackQuality();
    const frames = [];
    let last = performance.now();
    await new Promise((resolve) => {
      const end = last + playbackMs;
      const tick = (now) => {
        frames.push(now - last);
        last = now;
        if (now < end) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    const after = video.getVideoPlaybackQuality();
    const total = after.totalVideoFrames - before.totalVideoFrames;
    const dropped = after.droppedVideoFrames - before.droppedVideoFrames;
    const sorted = frames.slice(1).sort((a, b) => a - b);
    return {
      videoStart,
      droppedRatio: total > 0 ? dropped / total : 0,
      frameP95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      videoSrc: video.currentSrc.split("/").pop(),
    };
  }, { playbackMs: PLAYBACK_MS, timeoutMs: VIDEO_TIMEOUT_MS });
}

async function runOnce(browser, url, profile) {
  const { cpu, network, ...contextOptions } = profile;
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  try {
    const cdp = await context.newCDPSession(page);
    const totals = await watchNetwork(cdp, new URL(url).origin);
    if (network) await cdp.send("Network.emulateNetworkConditions", { offline: false, ...network });
    if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
    await page.addInitScript(observe);

    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(SETTLE_MS);
    const loadMetrics = await page.evaluate(() => {
      const { fcp, lcp, cls, longTasks } = window.__perf;
      const tbt = longTasks
        .filter(([start]) => start >= fcp)
        .reduce((sum, [, duration]) => sum + Math.max(0, duration - 50), 0);
      return { fcp, lcp, cls, tbt };
    });
    const pageBytes = totals.page();
    const videoPrefetch = totals.video();
    const playback = await measurePlayback(page);
    return { ...loadMetrics, pageBytes, videoPrefetch, videoBytes: totals.video(), ...playback };
  } finally {
    await context.close();
  }
}

function median(values) {
  if (values.some((value) => value === null)) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function summarise(runs) {
  const summary = {};
  for (const key of Object.keys(BUDGETS)) summary[key] = median(runs.map((r) => r[key]));
  summary.videoSrc = runs[0].videoSrc;
  return summary;
}

function format(value) {
  return Math.abs(value) < 1 ? value.toFixed(3) : Math.round(value).toLocaleString("en-US");
}

function compare(before, after) {
  const failures = [];
  for (const [profile, now] of Object.entries(after)) {
    const then = before[profile];
    if (!then) continue;
    console.log(`\n${profile}`);
    for (const [key, budget] of Object.entries(BUDGETS)) {
      if (then[key] === null || now[key] === null) continue;
      const limit = then[key] * budget.ratio + budget.slack;
      const ok = now[key] <= limit;
      if (!ok) failures.push(`${profile}: ${budget.label} ${format(now[key])} > limit ${format(limit)}`);
      console.log(`  ${ok ? "ok  " : "FAIL"} ${budget.label.padEnd(36)} ${format(then[key]).padStart(10)} -> ${format(now[key]).padStart(10)}`);
    }
  }
  return failures;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const server = await preview({ preview: { port: 4317, strictPort: false }, logLevel: "error" });
  const url = new URL(opts.path, server.resolvedUrls.local[0]).href;
  const browser = await chromium.launch();
  const results = {};
  try {
    for (const name of opts.profiles) {
      const runs = [];
      for (let i = 0; i < opts.runs; i += 1) {
        runs.push(await runOnce(browser, url, PROFILES[name]));
        process.stdout.write(`${name} run ${i + 1}/${opts.runs} done\n`);
      }
      results[name] = summarise(runs);
    }
  } finally {
    await browser.close();
    await server.close();
  }

  console.log(JSON.stringify(results, null, 2));
  if (opts.out) writeFileSync(opts.out, `${JSON.stringify(results, null, 2)}\n`);
  if (opts.compare) {
    const failures = compare(JSON.parse(readFileSync(opts.compare, "utf8")), results);
    if (failures.length) {
      console.error(`\n${failures.length} budget(s) exceeded:\n  ${failures.join("\n  ")}`);
      process.exitCode = 1;
    } else {
      console.log("\nAll budgets met.");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
