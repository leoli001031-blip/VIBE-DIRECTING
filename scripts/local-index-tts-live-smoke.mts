import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  buildLocalIndexTtsPlan,
  runLocalIndexTtsPlan,
} from "./runtime-routes/local-index-tts.mts";

function argValue(name: string, fallback = "") {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((item) => item === name || item.startsWith(prefix));
  if (!match) return fallback;
  if (match === name) return "1";
  return match.slice(prefix.length);
}

function sha256File(filePath: string) {
  return `sha256:${createHash("sha256").update(readFileSync(filePath)).digest("hex")}`;
}

function ensureDefaultSpeaker() {
  const speakerPath = "/tmp/index_tts_speaker.wav";
  if (existsSync(speakerPath)) return speakerPath;
  const aiffPath = "/tmp/index_tts_speaker.aiff";
  const say = spawnSync("say", ["-o", aiffPath, "这是一个本地音色参考。"], { stdio: "inherit" });
  if (say.status !== 0) throw new Error("Failed to create default speaker with macOS say.");
  const ffmpeg = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", aiffPath, "-ar", "24000", "-ac", "1", speakerPath], { stdio: "inherit" });
  if (ffmpeg.status !== 0) throw new Error("Failed to convert default speaker to wav with ffmpeg.");
  return speakerPath;
}

const runtimeRoot = process.cwd();
const speakerWavPath = argValue("--speaker", ensureDefaultSpeaker());
const text = argValue("--text", "测试一下本地配音接入。");
const shotId = argValue("--shot-id", "local_index_tts_smoke");
const outputRelativePath = argValue("--output", `.vibe-runtime/tts/local-index-tts/${shotId}.wav`);
const indexTtsRoot = argValue("--index-root", process.env.VIBE_INDEX_TTS_ROOT || path.join(process.env.HOME || "", "index-tts"));
const permissionReceiptId = argValue("--permission", "local-index-tts-live-smoke");

const plan = buildLocalIndexTtsPlan({
  text,
  shotId,
  speakerWavPath,
  indexTtsRoot,
  confirmationToken: "submit-local-index-tts",
  permissionReceiptId,
  outputRelativePath,
  verbose: argValue("--verbose") === "1",
}, { runtimeRoot });

const result = await runLocalIndexTtsPlan(plan);
if (!result.ok) {
  console.error(JSON.stringify({
    ok: false,
    status: result.status,
    message: result.message,
    stdoutTail: String(result.stdout || "").slice(-1200),
    stderrTail: String(result.stderr || "").slice(-1200),
  }, null, 2));
  process.exit(1);
}

const receiptRelativePath = `.vibe-runtime/tts/receipts/${shotId}.json`;
const receiptPath = path.join(runtimeRoot, receiptRelativePath);
mkdirSync(path.dirname(receiptPath), { recursive: true });
writeFileSync(receiptPath, JSON.stringify({
  receiptKind: "local_index_tts_live_smoke",
  generatedAt: new Date().toISOString(),
  providerId: "local-index-tts",
  providerSlot: "audio.tts",
  permissionReceiptId,
  outputRelativePath,
  outputSha256: result.outputSha256 || sha256File(plan.outputPath),
  speakerAudioSha256: plan.speakerAudioHash,
  rawSpeakerPathRedacted: true,
  providerCalledExternal: false,
  runtimeExternalNetworkCallMade: false,
}, null, 2), "utf8");

console.log(JSON.stringify({
  ok: true,
  status: "created",
  providerId: "local-index-tts",
  outputPath: plan.outputPath,
  outputRelativePath,
  outputSha256: result.outputSha256 || sha256File(plan.outputPath),
  outputSizeBytes: result.outputSizeBytes,
  receiptPath,
  speakerAudioSha256: plan.speakerAudioHash,
  rawSpeakerPathRedacted: true,
  providerCalledExternal: false,
  runtimeExternalNetworkCallMade: false,
}, null, 2));
