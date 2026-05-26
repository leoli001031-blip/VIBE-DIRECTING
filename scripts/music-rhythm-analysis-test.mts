import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  buildMusicRhythmAnalysis,
  runMusicRhythmAnalysis,
} from "../src/core/musicRhythmAnalysis.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  }
}

const pure = buildMusicRhythmAnalysis({
  label: "test-music.wav",
  durationSeconds: 8,
  samples: [
    ...Array.from({ length: 8000 }, () => 0.05),
    ...Array.from({ length: 8000 }, () => 0.3),
    ...Array.from({ length: 8000 }, () => 0.8),
  ],
  sampleRate: 8000,
  windowSeconds: 1,
});
assert(pure.noRawPathStored === true, "pure analysis must not store raw paths");
assert(pure.energyCurve.length >= 3, "pure analysis should build an energy curve");
assert(pure.recommendedCutPoints.includes(0), "cut points should include the start");
assert(pure.videoProviderPolicy.noBgmForVideoProvider === true, "music must not enter video provider prompt");

const root = mkdtempSync(path.join(tmpdir(), "vibe-music-rhythm-"));
try {
  const audio = path.join(root, "rhythm.wav");
  const output = path.join(root, "audio", "music-analysis", "analysis.json");
  run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=330:duration=6",
    "-af",
    "volume='if(lt(t,2),0.15,if(lt(t,4),0.45,0.9))'",
    "-ar",
    "24000",
    "-ac",
    "1",
    audio,
  ], root);
  const analysis = await runMusicRhythmAnalysis({
    audioPath: audio,
    outputPath: output,
    projectRelativeAnalysisPath: "audio/music-analysis/analysis.json",
    label: "节奏测试",
  });
  assert(analysis.durationSeconds && analysis.durationSeconds >= 5.8 && analysis.durationSeconds <= 6.2, "runtime analysis should read duration through ffprobe");
  assert(analysis.energyCurve.length >= 5, "runtime analysis should create windowed energy points");
  assert(analysis.sections.length >= 2, "runtime analysis should create sections");
  assert(analysis.rhythmTags.includes("sectioned_music") || analysis.recommendedCutPoints.length >= 2, "analysis should expose rhythm planning hints");
  assert(existsSync(output) && statSync(output).size > 0, "analysis JSON should be written when outputPath is provided");
  const serialized = readFileSync(output, "utf8");
  assert(!serialized.includes(root), "analysis JSON must not leak the local temp path");
  console.log(`music-rhythm-analysis-test: ok ${analysis.analysisId}`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
