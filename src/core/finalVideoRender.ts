import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export const finalVideoRenderSchemaVersion = "0.1.0";
export const FINAL_VIDEO_RENDER_DEFAULT_WIDTH = 1280;
export const FINAL_VIDEO_RENDER_DEFAULT_HEIGHT = 720;
export const FINAL_VIDEO_RENDER_DEFAULT_FPS = 30;
export const FINAL_VIDEO_RENDER_DEFAULT_FFMPEG = "ffmpeg";

export type FinalVideoRenderStatus = "ready" | "blocked";

export interface FinalVideoRenderClip {
  shotId?: string;
  videoPath: string;
}

export interface BuildFinalVideoRenderPlanInput {
  clips: FinalVideoRenderClip[];
  outputPath: string;
  audioPath?: string;
  musicPath?: string;
  width?: number;
  height?: number;
  fps?: number;
  ffmpegPath?: string;
  timeoutMs?: number;
}

export interface FinalVideoRenderPlan {
  schemaVersion: typeof finalVideoRenderSchemaVersion;
  renderKind: "final_video_stitch";
  providerIndependent: true;
  status: FinalVideoRenderStatus;
  ffmpegPath: string;
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  clips: Array<FinalVideoRenderClip & { sourceSha256?: string }>;
  audio?: {
    audioPath: string;
    sourceSha256?: string;
  };
  music?: {
    musicPath: string;
    sourceSha256?: string;
    role: "final_mix_bgm";
  };
  args: string[];
  commandPreview: string;
  timeoutMs: number;
  blockers: string[];
  notes: string[];
}

export interface FinalVideoRenderResult {
  ok: boolean;
  status: "created" | "blocked" | "failed" | "timeout";
  outputPath: string;
  outputSha256?: string;
  outputSizeBytes?: number;
  durationMs: number;
  exitCode?: number | null;
  stdoutTail: string;
  stderrTail: string;
  receiptPath?: string;
  blockers: string[];
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value !== undefined && value > 0 ? Math.floor(value) : fallback;
}

function quoteArg(value: string): string {
  return JSON.stringify(value);
}

const SHA256_MAX_FILE_BYTES = 256 * 1024 * 1024; // 256 MB — refuse to read larger files into memory

function sha256File(filePath: string): string | undefined {
  if (!existsSync(filePath)) return undefined;
  const fileStat = statSync(filePath);
  if (!fileStat.isFile()) return undefined;
  if (fileStat.size > SHA256_MAX_FILE_BYTES) return undefined;
  return `sha256:${createHash("sha256").update(readFileSync(filePath)).digest("hex")}`;
}

function tail(value: string, limit = 2000): string {
  return value.length > limit ? value.slice(-limit) : value;
}

function videoFilter(inputIndex: number, width: number, height: number, fps: number): string {
  return [
    `[${inputIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
    "setsar=1",
    `fps=${fps}`,
    `format=yuv420p[v${inputIndex}]`,
  ].join(",");
}

function concatFilter(count: number): string {
  const sources = Array.from({ length: count }, (_, index) => `[v${index}]`).join("");
  return `${sources}concat=n=${count}:v=1:a=0[vout]`;
}

function audioFilter(inputIndexes: number[]): string | undefined {
  if (!inputIndexes.length) return undefined;
  if (inputIndexes.length === 1) return `[${inputIndexes[0]}:a:0]apad[aout]`;
  // BGM volume 0.35 is a reasonable default for background music under dialogue; consider making this configurable.
  const prepared = inputIndexes.map((index, order) => `[${index}:a:0]volume=${order === 0 ? "1.0" : "0.35"}[a${order}]`);
  const sources = inputIndexes.map((_, order) => `[a${order}]`).join("");
  return `${prepared.join(";")};${sources}amix=inputs=${inputIndexes.length}:duration=longest:dropout_transition=0,apad[aout]`;
}

export function buildFinalVideoRenderPlan(input: BuildFinalVideoRenderPlanInput): FinalVideoRenderPlan {
  const width = positiveInteger(input.width, FINAL_VIDEO_RENDER_DEFAULT_WIDTH);
  const height = positiveInteger(input.height, FINAL_VIDEO_RENDER_DEFAULT_HEIGHT);
  const fps = positiveInteger(input.fps, FINAL_VIDEO_RENDER_DEFAULT_FPS);
  const ffmpegPath = input.ffmpegPath || FINAL_VIDEO_RENDER_DEFAULT_FFMPEG;
  const timeoutMs = Math.max(30_000, Math.min(input.timeoutMs || 20 * 60 * 1000, 60 * 60 * 1000));
  const blockers: string[] = [];
  const clips = input.clips.map((clip) => {
    const normalized = { ...clip, videoPath: path.resolve(clip.videoPath) };
    if (!existsSync(normalized.videoPath)) blockers.push(`missing_clip:${clip.shotId || normalized.videoPath}`);
    return {
      ...normalized,
      sourceSha256: sha256File(normalized.videoPath),
    };
  });
  const audioPath = input.audioPath ? path.resolve(input.audioPath) : undefined;
  const musicPath = input.musicPath ? path.resolve(input.musicPath) : undefined;
  if (!clips.length) blockers.push("no_video_clips");
  if (audioPath && !existsSync(audioPath)) blockers.push("missing_audio");
  if (musicPath && !existsSync(musicPath)) blockers.push("missing_music");
  const audioInputIndexes = [
    audioPath ? clips.length : undefined,
    musicPath ? clips.length + (audioPath ? 1 : 0) : undefined,
  ].filter((index): index is number => typeof index === "number");
  const audioFilterLine = audioFilter(audioInputIndexes);

  const outputPath = path.resolve(input.outputPath);
  const args = [
    "-y",
    ...clips.flatMap((clip) => ["-i", clip.videoPath]),
    ...(audioPath ? ["-i", audioPath] : []),
    ...(musicPath ? ["-i", musicPath] : []),
    "-filter_complex",
    [
      ...clips.map((_, index) => videoFilter(index, width, height, fps)),
      concatFilter(clips.length || 1),
      audioFilterLine,
    ].filter(Boolean).join(";"),
    "-map",
    "[vout]",
    ...(audioFilterLine ? ["-map", "[aout]", "-shortest", "-c:a", "aac", "-b:a", "192k"] : ["-an"]),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  return {
    schemaVersion: finalVideoRenderSchemaVersion,
    renderKind: "final_video_stitch",
    providerIndependent: true,
    status: blockers.length ? "blocked" : "ready",
    ffmpegPath,
    outputPath,
    width,
    height,
    fps,
    clips,
    audio: audioPath ? { audioPath, sourceSha256: sha256File(audioPath) } : undefined,
    music: musicPath ? { musicPath, sourceSha256: sha256File(musicPath), role: "final_mix_bgm" } : undefined,
    args,
    commandPreview: `${ffmpegPath} ${args.map(quoteArg).join(" ")}`,
    timeoutMs,
    blockers,
    notes: [
      "Final video render is local ffmpeg only; it never submits to Jimeng, Image2, or TTS providers.",
      "Clips are normalized to a stable 16:9 canvas with padding instead of stretch-cropping.",
      audioPath ? "Optional narration/audio is mapped into the final output and trimmed to video length." : "No narration/dialogue audio track was supplied for this render.",
      musicPath ? "Music reference is mixed locally as final BGM and is never sent to the video provider." : "No music reference was supplied for the final mix.",
    ],
  };
}

export async function runFinalVideoRenderPlan(plan: FinalVideoRenderPlan, receiptPath?: string): Promise<FinalVideoRenderResult> {
  const startedAt = Date.now();
  if (plan.status !== "ready") {
    return {
      ok: false,
      status: "blocked",
      outputPath: plan.outputPath,
      durationMs: 0,
      stdoutTail: "",
      stderrTail: "",
      receiptPath,
      blockers: plan.blockers,
    };
  }

  mkdirSync(path.dirname(plan.outputPath), { recursive: true });
  const result = await new Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }>((resolve) => {
    const child = spawn(plan.ffmpegPath, plan.args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill("SIGTERM"); } catch {}
      setTimeout(() => {
        try { child.kill("SIGKILL"); } catch {}
      }, 5000);
      resolve({ exitCode: null, stdout, stderr, timedOut: true });
    }, plan.timeoutMs);
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode: null, stdout, stderr: `${stderr}\n${error.message}`, timedOut: false });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exitCode: code, stdout, stderr, timedOut: false });
    });
  });

  const created = existsSync(plan.outputPath) && statSync(plan.outputPath).size > 0;
  const payload: FinalVideoRenderResult = {
    ok: result.exitCode === 0 && created,
    status: result.timedOut ? "timeout" : result.exitCode === 0 && created ? "created" : "failed",
    outputPath: plan.outputPath,
    outputSha256: created ? sha256File(plan.outputPath) : undefined,
    outputSizeBytes: created ? statSync(plan.outputPath).size : undefined,
    durationMs: Date.now() - startedAt,
    exitCode: result.exitCode,
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
    receiptPath,
    blockers: result.exitCode === 0 && created ? [] : ["ffmpeg_final_video_render_failed"],
  };

  if (receiptPath) {
    mkdirSync(path.dirname(receiptPath), { recursive: true });
    writeFileSync(receiptPath, `${JSON.stringify({
      receiptKind: "final_video_render",
      generatedAt: new Date().toISOString(),
      plan,
      result: payload,
      providerCalledExternal: false,
      runtimeExternalNetworkCallMade: false,
    }, null, 2)}\n`, "utf8");
  }

  return payload;
}
