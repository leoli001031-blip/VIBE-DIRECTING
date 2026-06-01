import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { buildFinalVideoRenderPlan, runFinalVideoRenderPlan } from "../src/core/finalVideoRender.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`FAIL: ${command} failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  }
  return result;
}

function makeClip(root: string, name: string, color: string) {
  const target = path.join(root, `${name}.mp4`);
  run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `color=c=${color}:s=640x360:d=0.7:r=30`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    target,
  ], root);
  return target;
}

function makeAudio(root: string) {
  const target = path.join(root, "narration.wav");
  run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1.0",
    "-ar",
    "24000",
    "-ac",
    "1",
    target,
  ], root);
  return target;
}

const root = mkdtempSync(path.join(tmpdir(), "vibe-final-video-render-"));

try {
  const clipOne = makeClip(root, "shot-01", "0x14213d");
  const clipTwo = makeClip(root, "shot-02", "0xfca311");
  const audio = makeAudio(root);
  const output = path.join(root, "final-video", "final.mp4");
  const receipt = path.join(root, "receipts", "final-video-render.json");
  const plan = buildFinalVideoRenderPlan({
    clips: [
      { shotId: "S01", videoPath: clipOne },
      { shotId: "S02", videoPath: clipTwo },
    ],
    audioPath: audio,
    outputPath: output,
    width: 1280,
    height: 720,
    fps: 30,
  });

  assert(plan.status === "ready", `final video plan should be ready: ${plan.blockers.join("; ")}`);
  assert(plan.commandPreview.includes("ffmpeg"), "command preview should mention ffmpeg");
  assert(plan.notes.some((note) => /padding instead of stretch/i.test(note)), "plan should avoid stretch-cropping");

  const result = await runFinalVideoRenderPlan(plan, receipt);
  assert(result.ok, `final video render should succeed: ${result.stderrTail}`);
  assert(existsSync(output) && statSync(output).size > 0, "final output should exist");
  assert(existsSync(receipt), "receipt should be written");
  const receiptText = readFileSync(receipt, "utf8");
  assert(receiptText.includes("\"providerCalledExternal\": false"), "receipt must not claim provider calls");
  assert(receiptText.includes("\"runtimeExternalNetworkCallMade\": false"), "receipt must not claim network calls");

  const probe = run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "json",
    output,
  ], root);
  const payload = JSON.parse(probe.stdout);
  assert(payload.streams?.[0]?.width === 1280, "rendered width should be 1280");
  assert(payload.streams?.[0]?.height === 720, "rendered height should be 720");

  const blocked = buildFinalVideoRenderPlan({ clips: [], outputPath: path.join(root, "missing.mp4") });
  assert(blocked.status === "blocked", "empty render plan should block");
  assert(blocked.blockers.includes("no_video_clips"), "empty render plan should explain missing clips");

  console.log(`final-video-render-test: ok ${output}`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
