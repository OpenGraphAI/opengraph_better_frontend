// Turns the Blender frames from blender/graph_loop_scene.py into the four
// landing-page files that index.html loads.
//
//   blender -b --factory-startup -P blender/graph_loop_scene.py -- --layout wide --out /tmp/gl-wide
//   blender -b --factory-startup -P blender/graph_loop_scene.py -- --layout portrait --out /tmp/gl-portrait
//   node scripts/encode-graph-loop.mjs --wide=/tmp/gl-wide --portrait=/tmp/gl-portrait
//   options: --out=public/video  --crf=N (starting CRF for every cut)
//
// The frames are transparent. Each one is laid over the page colour, so the
// video has no edge of its own. Every cut must fit its byte budget (the size
// of the Three.js loop it replaced); the encoder raises CRF until it does, and
// fails rather than ship a heavier file.
//
// The files keep their names, so index.html loads them with ?v=<content hash>
// (printed at the end). Update those after every encode: a browser that cached
// byte ranges of the previous video under the same URL can otherwise splice
// them into the new one and fail to decode it.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const FPS = 24;
const FRAMES = 288;
const PAGE_GROUND = "f4f2ed"; // --ground in src/theme.css, data-theme="paper"
const MAX_CRF = 34;
const MIN_SEAM_PSNR = 32; // dB between the last and first frame, so the loop never jumps

const CUTS = [
  { key: "wide", size: [1440, 608], video: "graph-loop-1440.mp4", poster: "graph-loop-poster.webp", maxBytes: 555_000, crf: 26 },
  { key: "portrait", size: [720, 900], video: "graph-loop-portrait.mp4", poster: "graph-loop-portrait-poster.webp", maxBytes: 496_000, crf: 24 },
];

function parseArgs(argv) {
  const args = Object.fromEntries(
    argv.filter((a) => a.startsWith("--")).map((a) => {
      const [key, value = "true"] = a.slice(2).split("=");
      return [key, value];
    }),
  );
  const cuts = CUTS.filter((cut) => args[cut.key]);
  if (!cuts.length) throw new Error("Pass --wide=DIR and/or --portrait=DIR (folders of 0000.png-0287.png)");
  for (const cut of cuts) {
    const dir = resolve(args[cut.key]);
    for (const frame of [0, FRAMES - 1]) {
      const file = join(dir, `${String(frame).padStart(4, "0")}.png`);
      if (!existsSync(file)) throw new Error(`Missing ${file}; render all ${FRAMES} frames first`);
    }
  }
  const crf = args.crf === undefined ? null : Number(args.crf);
  if (crf !== null && !(Number.isInteger(crf) && crf >= 0 && crf <= MAX_CRF)) throw new Error(`--crf must be an integer 0-${MAX_CRF}`);
  return {
    cuts: cuts.map((cut) => ({ ...cut, crf: crf ?? cut.crf, dir: resolve(args[cut.key]) })),
    out: resolve(args.out ?? "public/video"),
  };
}

function ffmpeg(args, { capture = false } = {}) {
  const result = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", capture ? "info" : "error", ...args], {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.status !== 0) throw new Error(`ffmpeg failed (${result.status}): ${result.stderr ?? args.at(-1)}`);
  return result.stderr ?? "";
}

// Lays each transparent frame over the page colour.
function flattenedInput(cut) {
  const [width, height] = cut.size;
  return [
    "-f", "lavfi", "-i", `color=c=0x${PAGE_GROUND}:s=${width}x${height}:r=${FPS}`,
    "-framerate", String(FPS), "-i", join(cut.dir, "%04d.png"),
  ];
}
const OVERLAY = "[0][1]overlay=format=auto:shortest=1";
// Convert with the same BT.709 matrix the file is tagged with, so the page colour survives decoding.
const TO_VIDEO = `${OVERLAY},scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`;
const BT709 = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];

function encode(cut, file) {
  for (let crf = cut.crf; crf <= MAX_CRF; crf += 1) {
    ffmpeg([
      ...flattenedInput(cut), "-filter_complex", TO_VIDEO, "-frames:v", String(FRAMES), "-an",
      "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-preset", "veryslow", "-crf", String(crf),
      "-tune", "animation", "-g", String(FPS * 2), ...BT709, "-movflags", "+faststart", file,
    ]);
    const bytes = statSync(file).size;
    process.stdout.write(`${cut.video}: crf ${crf} -> ${bytes.toLocaleString("en-US")} bytes (budget ${cut.maxBytes.toLocaleString("en-US")})\n`);
    if (bytes <= cut.maxBytes) return { crf, bytes };
  }
  throw new Error(`${cut.video} is over its ${cut.maxBytes} byte budget even at crf ${MAX_CRF}`);
}

function poster(cut, file) {
  ffmpeg([...flattenedInput(cut), "-filter_complex", OVERLAY, "-frames:v", "1", "-quality", "88", file]);
}

// The last frame flows back into the first; a big difference would show as a jump every 12 s.
function seamPsnr(cut) {
  const last = join(cut.dir, `${String(FRAMES - 1).padStart(4, "0")}.png`);
  const first = join(cut.dir, "0000.png");
  const log = ffmpeg(["-i", last, "-i", first, "-filter_complex", "psnr", "-f", "null", "-"], { capture: true });
  const match = log.match(/average:(inf|[\d.]+)/);
  if (!match) throw new Error(`Could not read PSNR from ffmpeg output:\n${log}`);
  return match[1] === "inf" ? Infinity : Number(match[1]);
}

function contentVersion(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 8);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  mkdirSync(opts.out, { recursive: true });
  const scratch = mkdtempSync(join(tmpdir(), "graph-loop-encode-"));
  try {
    for (const cut of opts.cuts) {
      const seam = seamPsnr(cut);
      if (seam < MIN_SEAM_PSNR) throw new Error(`${cut.key}: loop seam PSNR ${seam.toFixed(1)} dB < ${MIN_SEAM_PSNR} dB`);
      const draft = join(scratch, cut.video);
      const { crf, bytes } = encode(cut, draft);
      ffmpeg(["-i", draft, "-c", "copy", "-movflags", "+faststart", join(opts.out, cut.video)]);
      poster(cut, join(opts.out, cut.poster));
      const posterBytes = statSync(join(opts.out, cut.poster)).size;
      process.stdout.write(`wrote ${cut.video} (crf ${crf}, ${bytes.toLocaleString("en-US")} bytes) and ${cut.poster} `
        + `(${posterBytes.toLocaleString("en-US")} bytes); loop seam ${seam === Infinity ? "identical" : `${seam.toFixed(1)} dB`}\n`);
    }
    process.stdout.write("\nUse these URLs in index.html:\n");
    for (const cut of opts.cuts) {
      for (const name of [cut.video, cut.poster]) {
        process.stdout.write(`  /video/${name}?v=${contentVersion(join(opts.out, name))}\n`);
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
}
