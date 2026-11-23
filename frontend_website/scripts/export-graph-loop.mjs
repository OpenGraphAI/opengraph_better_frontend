// Renders the "How it works" graph loop frame by frame in headless Chromium
// and encodes the files index.html loads.
//
//   node scripts/export-graph-loop.mjs                        # both cuts, all 288 frames each
//   node scripts/export-graph-loop.mjs --only=portrait        # one cut: wide | portrait
//   node scripts/export-graph-loop.mjs --stills=0,4,8.2,9.9   # PNG stills only (add --portrait)
//   options: --out=public/video  --frames-dir=/tmp/graph-loop-frames  --ssaa=2
//
// Every frame is rendered from its exact time (frame / fps), so the last frame
// flows straight back into the first and the file loops cleanly. Frames are
// supersampled (--ssaa): the canvas renders at N x the frame size and the
// screenshot downsamples it, which keeps thin lines crisp.
//
// Each video must fit its byte budget: the encoder raises CRF until it does,
// and fails rather than ship a heavier file. The files keep their names, so
// index.html loads them with ?v=<content hash> (printed at the end); update
// those after every export, or a browser that cached byte ranges of the old
// file under the same URL can splice them into the new one.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

const FPS = 24;
const LOOP_SECONDS = 12;
const FRAMES = FPS * LOOP_SECONDS;
const MIN_CRF = 16;
const MAX_CRF = 32;
const MIN_SEAM_PSNR = 32; // dB between the last and first frame, so the loop never jumps
const MAX_CANVAS = 8192; // larger drawing buffers are silently clamped, which softens every frame

const CUTS = {
  wide: {
    query: "capture",
    viewport: { width: 2880, height: 1216 },
    poster: { file: "graph-loop-poster.webp", width: 2880 },
    videos: [
      // Wide, high-DPI screens.
      { file: "graph-loop-2880.mp4", width: 2880, maxBytes: 2_000_000, crf: 18 },
      // Everything else that is not a phone.
      { file: "graph-loop-1440.mp4", width: 1440, maxBytes: 700_000, crf: 20 },
    ],
  },
  portrait: {
    query: "capture&portrait",
    viewport: { width: 1080, height: 1350 },
    poster: { file: "graph-loop-portrait-poster.webp", width: 1080 },
    videos: [{ file: "graph-loop-portrait.mp4", width: 1080, maxBytes: 1_000_000, crf: 20 }],
  },
};

function parseArgs(argv) {
  const args = Object.fromEntries(
    argv.filter((a) => a.startsWith("--")).map((a) => {
      const [key, value = "true"] = a.slice(2).split("=");
      return [key, value];
    }),
  );
  const only = args.only ?? (args.portrait === "true" ? "portrait" : null);
  if (only && !CUTS[only]) throw new Error(`--only must be one of: ${Object.keys(CUTS).join(", ")}`);
  const ssaa = Number(args.ssaa ?? 2);
  if (!(Number.isInteger(ssaa) && ssaa >= 1 && ssaa <= 3)) throw new Error("--ssaa must be 1, 2 or 3");
  const cuts = only ? [only] : Object.keys(CUTS);
  for (const key of cuts) {
    const { width, height } = CUTS[key].viewport;
    if (Math.max(width, height) * ssaa > MAX_CANVAS) throw new Error(`--ssaa=${ssaa} makes the ${key} canvas larger than ${MAX_CANVAS}px`);
  }
  return {
    cuts,
    out: resolve(args.out ?? "public/video"),
    framesDir: resolve(args["frames-dir"] ?? join(tmpdir(), "graph-loop-frames")),
    stills: args.stills ? args.stills.split(",").map(Number) : null,
    ssaa,
  };
}

function ffmpeg(args, { capture = false } = {}) {
  const result = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", capture ? "info" : "error", ...args], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) throw new Error(`Could not run ffmpeg: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${args.at(-1)}\n${result.stderr ?? ""}`);
  return result.stderr ?? "";
}

async function openPage(url, viewport) {
  const browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  try {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector("[data-graph-loop]")?.dataset.state);
    const state = await page.evaluate(() => ({ ...document.querySelector("[data-graph-loop]").dataset }));
    if (state.state !== "ready") throw new Error(`Graph loop failed to start: ${state.error ?? state.state}`);
    await page.waitForFunction(() => window.__graphLoop);
    return { browser, page, figure: page.locator("[data-graph-loop]") };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function renderFrame(page, figure, t, path) {
  await page.evaluate((time) => window.__graphLoop.renderAt(time), t);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  await figure.screenshot({ path });
}

const framePath = (dir, i) => join(dir, `${String(i).padStart(4, "0")}.png`);

function checkSeam(dir) {
  const log = ffmpeg(
    ["-i", framePath(dir, FRAMES - 1), "-i", framePath(dir, 0), "-filter_complex", "psnr", "-f", "null", "-"],
    { capture: true },
  );
  const psnr = Number(log.match(/average:([\d.]+|inf)/)?.[1].replace("inf", "99"));
  if (!(psnr >= MIN_SEAM_PSNR)) throw new Error(`Loop seam PSNR ${psnr} dB is below ${MIN_SEAM_PSNR} dB`);
  return psnr;
}

/** Encodes one video into the frames folder, raising CRF until it fits its budget. */
function encode(dir, video) {
  const target = join(dir, video.file);
  for (let crf = Math.max(MIN_CRF, video.crf); crf <= MAX_CRF; crf += 1) {
    ffmpeg([
      "-framerate", String(FPS), "-i", join(dir, "%04d.png"), "-an",
      "-vf", `scale=${video.width}:-2:flags=lanczos`,
      "-c:v", "libx264", "-profile:v", "high", "-preset", "slower", "-tune", "animation", "-crf", String(crf),
      "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
      "-movflags", "+faststart", target,
    ]);
    const bytes = statSync(target).size;
    if (bytes <= video.maxBytes) return { crf, bytes };
  }
  throw new Error(`${video.file} does not fit ${video.maxBytes} bytes even at CRF ${MAX_CRF}`);
}

const contentVersion = (file) => createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 8);

async function exportCut(base, key, opts) {
  const cut = CUTS[key];
  const dir = join(opts.framesDir, key);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const { browser, page, figure } = await openPage(`${base}graph-loop.html?${cut.query}&ssaa=${opts.ssaa}`, cut.viewport);
  try {
    if (opts.stills) {
      for (const t of opts.stills) {
        const path = join(dir, `still-${t.toFixed(2)}.png`);
        await renderFrame(page, figure, t, path);
        process.stdout.write(`${path}\n`);
      }
      return [];
    }
    for (let i = 0; i < FRAMES; i += 1) {
      await renderFrame(page, figure, i / FPS, framePath(dir, i));
      if (i % FPS === 0) process.stdout.write(`${key}: frame ${i}/${FRAMES}\n`);
    }
  } finally {
    await browser.close();
  }

  process.stdout.write(`${key}: loop seam ${checkSeam(dir).toFixed(1)} dB\n`);
  // Everything is encoded beside the frames first, so a cut that fails its
  // budget never replaces the good files the page already loads.
  const files = cut.videos.map((video) => {
    const { crf, bytes } = encode(dir, video);
    process.stdout.write(`${key}: ${video.file} ${Math.round(bytes / 1000)} KB at CRF ${crf}\n`);
    return video.file;
  });
  ffmpeg(["-i", framePath(dir, 0), "-vf", `scale=${cut.poster.width}:-2:flags=lanczos`, "-quality", "88", join(dir, cut.poster.file)]);
  mkdirSync(opts.out, { recursive: true });
  // Copy, not rename: the frames folder usually lives on another filesystem (/tmp).
  for (const file of [...files, cut.poster.file]) copyFileSync(join(dir, file), join(opts.out, file));
  return [...files, cut.poster.file];
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: "error" });
  await server.listen();
  const base = server.resolvedUrls.local[0];
  try {
    const written = [];
    for (const key of opts.cuts) written.push(...(await exportCut(base, key, opts)));
    if (written.length) {
      process.stdout.write("Update the ?v= values in index.html:\n");
      for (const file of written) process.stdout.write(`  /video/${file}?v=${contentVersion(join(opts.out, file))}\n`);
    }
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
