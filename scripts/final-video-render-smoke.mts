import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildFinalVideoRenderPlan, runFinalVideoRenderPlan } from "../src/core/finalVideoRender.ts";

function argValues(name: string): string[] {
  const prefix = `${name}=`;
  const values: string[] = [];
  for (let index = 2; index < process.argv.length; index += 1) {
    const item = process.argv[index];
    if (item === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1]);
      index += 1;
    } else if (item.startsWith(prefix)) {
      values.push(item.slice(prefix.length));
    }
  }
  return values;
}

function argValue(name: string, fallback = ""): string {
  return argValues(name)[0] || fallback;
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "final-video";
}

const repoRoot = process.cwd();
const runId = safeId(argValue("--run-id", `final-video-render-${new Date().toISOString().replace(/[:.]/g, "-")}`));
const outputRoot = path.resolve(argValue("--output-root", path.join(repoRoot, "real-test-sandbox", runId)));
const reportDir = path.join(outputRoot, "report");
const receiptDir = path.join(outputRoot, "receipts");
const outputPath = path.resolve(argValue("--output", path.join(outputRoot, "final-video", "final.mp4")));
const audioPath = argValue("--audio");
const clips = argValues("--clip").map((videoPath, index) => ({
  shotId: argValue(`--clip-${index + 1}-shot`, `S${String(index + 1).padStart(2, "0")}`),
  videoPath,
}));

mkdirSync(reportDir, { recursive: true });
mkdirSync(receiptDir, { recursive: true });

if (!clips.length) {
  clips.push({
    shotId: "MS01",
    videoPath: "real-test-sandbox/jimeng-video-live-ms01-20260519/video/e2ebfcfa3c6c77d4_video_1_firstframe-hold.mp4",
  });
}

const missingClips = clips.filter((clip) => !existsSync(path.resolve(clip.videoPath)));
if (missingClips.length) {
  const report = {
    ok: false,
    status: "blocked_missing_clip",
    outputRoot,
    missingClips,
    message: "Final video render needs existing local video clips.",
  };
  writeFileSync(path.join(reportDir, "final-video-render-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

if (audioPath && !existsSync(path.resolve(audioPath))) {
  const report = {
    ok: false,
    status: "blocked_missing_audio",
    outputRoot,
    audioPath,
    message: "Optional audio was requested but the file is missing.",
  };
  writeFileSync(path.join(reportDir, "final-video-render-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

const receiptPath = path.join(receiptDir, "final-video-render.json");
const plan = buildFinalVideoRenderPlan({
  clips,
  audioPath: audioPath || undefined,
  outputPath,
  width: Number(argValue("--width", "1280")),
  height: Number(argValue("--height", "720")),
  fps: Number(argValue("--fps", "30")),
});
const result = await runFinalVideoRenderPlan(plan, receiptPath);
const reportPath = path.join(reportDir, "final-video-render-report.json");
const summaryPath = path.join(reportDir, "summary.md");
const report = {
  ok: result.ok,
  status: result.status,
  outputRoot,
  outputPath: result.outputPath,
  outputSha256: result.outputSha256,
  outputSizeBytes: result.outputSizeBytes,
  receiptPath,
  clipCount: clips.length,
  audioIncluded: Boolean(audioPath),
  providerCalledExternal: false,
  runtimeExternalNetworkCallMade: false,
  blockers: result.blockers,
};
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(summaryPath, [
  "# Final Video Render Smoke",
  "",
  `Status: ${result.status}`,
  `Output: ${result.outputPath}`,
  `Clips: ${clips.length}`,
  `Audio: ${audioPath ? "included" : "not included"}`,
  `Provider call: no`,
  "",
  "This is a local ffmpeg stitched output. It is not a Jimeng/Image2/TTS provider call.",
  "",
].join("\n"), "utf8");

if (!result.ok) {
  console.error(JSON.stringify({
    ...report,
    stdoutTail: result.stdoutTail,
    stderrTail: result.stderrTail,
    receiptTail: existsSync(receiptPath) ? readFileSync(receiptPath, "utf8").slice(-1200) : "",
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
