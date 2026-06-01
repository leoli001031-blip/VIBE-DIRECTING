import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { buildFinalVideoRenderPlan, runFinalVideoRenderPlan } from "../src/core/finalVideoRender.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
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
    `color=c=${color}:s=640x360:d=0.6:r=30`,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    target,
  ], root);
  return target;
}

function makeMusic(root: string) {
  const target = path.join(root, "music.wav");
  run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=523:duration=3",
    "-ar",
    "24000",
    "-ac",
    "1",
    target,
  ], root);
  return target;
}

const root = mkdtempSync(path.join(tmpdir(), "vibe-final-video-music-"));
try {
  const clipOne = makeClip(root, "shot-01", "0x2a9d8f");
  const clipTwo = makeClip(root, "shot-02", "0xe9c46a");
  const music = makeMusic(root);
  const output = path.join(root, "final-video", "final-with-music.mp4");
  const plan = buildFinalVideoRenderPlan({
    clips: [
      { shotId: "S01", videoPath: clipOne },
      { shotId: "S02", videoPath: clipTwo },
    ],
    musicPath: music,
    outputPath: output,
  });
  assert(plan.status === "ready", `music render plan should be ready: ${plan.blockers.join("; ")}`);
  assert(plan.music?.role === "final_mix_bgm", "music should be explicitly marked as final mix BGM");
  assert(plan.providerIndependent === true, "final render remains provider-independent");
  assert(plan.commandPreview.includes("[aout]"), "music render should use local audio filter output");
  assert(plan.notes.some((note) => /never sent to the video provider/i.test(note)), "plan should explain provider separation");

  const result = await runFinalVideoRenderPlan(plan);
  assert(result.ok, `render should succeed: ${result.stderrTail}`);
  assert(existsSync(output) && statSync(output).size > 0, "output should exist");
  const probe = run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=codec_type",
    "-of",
    "json",
    output,
  ], root);
  const payload = JSON.parse(probe.stdout);
  assert(payload.streams?.[0]?.codec_type === "audio", "final video should contain an audio stream");
  console.log(`final-video-render-music-test: ok ${output}`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
