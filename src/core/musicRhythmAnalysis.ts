import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export const musicRhythmAnalysisSchemaVersion = "0.1.0";
export const MUSIC_ANALYSIS_DEFAULT_SAMPLE_RATE = 8000;
export const MUSIC_ANALYSIS_DEFAULT_WINDOW_SECONDS = 1;

export type MusicEnergyLabel = "quiet" | "steady" | "lift" | "peak";
export type MusicSectionKind = "intro" | "verse" | "build" | "peak" | "outro";

export interface MusicRhythmAnalysisPoint {
  startSeconds: number;
  endSeconds: number;
  rms: number;
  normalizedEnergy: number;
  label: MusicEnergyLabel;
}

export interface MusicRhythmAnalysisSection {
  id: string;
  kind: MusicSectionKind;
  label: string;
  startSeconds: number;
  endSeconds: number;
  averageEnergy: number;
  rhythmHint: "hold" | "steady_cut" | "build" | "rapid_cut";
}

export interface MusicRhythmAnalysis {
  schemaVersion: typeof musicRhythmAnalysisSchemaVersion;
  analysisId: string;
  source: {
    label: string;
    safeRef: string;
    mimeType?: string;
    sizeBytes?: number;
  };
  durationSeconds?: number;
  sampleRate: number;
  windowSeconds: number;
  energyCurve: MusicRhythmAnalysisPoint[];
  sections: MusicRhythmAnalysisSection[];
  recommendedCutPoints: number[];
  rhythmTags: string[];
  warnings: string[];
  projectRelativeAnalysisPath: string;
  noRawPathStored: true;
  videoProviderPolicy: {
    noBgmForVideoProvider: true;
    usedFor: Array<"rhythm_planning" | "final_export_bgm">;
  };
}

export interface BuildMusicRhythmAnalysisInput {
  label: string;
  safeRef?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  samples?: Float32Array | number[];
  sampleRate?: number;
  windowSeconds?: number;
  projectRelativeAnalysisPath?: string;
}

export interface RunMusicRhythmAnalysisInput {
  audioPath: string;
  label?: string;
  mimeType?: string;
  sizeBytes?: number;
  ffprobePath?: string;
  ffmpegPath?: string;
  sampleRate?: number;
  windowSeconds?: number;
  outputPath?: string;
  projectRelativeAnalysisPath?: string;
  timeoutMs?: number;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function safeId(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "music";
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function analysisIdFor(label: string, durationSeconds?: number, sizeBytes?: number): string {
  const hash = createHash("sha256")
    .update(JSON.stringify({ label: clean(label), durationSeconds: durationSeconds || 0, sizeBytes: sizeBytes || 0 }))
    .digest("hex")
    .slice(0, 12);
  return `music_analysis_${hash}`;
}

function energyLabel(value: number): MusicEnergyLabel {
  if (value >= 0.72) return "peak";
  if (value >= 0.48) return "lift";
  if (value >= 0.22) return "steady";
  return "quiet";
}

function sectionKind(label: MusicEnergyLabel, index: number, total: number): MusicSectionKind {
  if (index === 0) return "intro";
  if (index === total - 1) return "outro";
  if (label === "peak") return "peak";
  if (label === "lift") return "build";
  return "verse";
}

function rhythmHint(label: MusicEnergyLabel): MusicRhythmAnalysisSection["rhythmHint"] {
  if (label === "peak") return "rapid_cut";
  if (label === "lift") return "build";
  if (label === "steady") return "steady_cut";
  return "hold";
}

function samplesToEnergyCurve(input: {
  samples: Float32Array | number[];
  sampleRate: number;
  windowSeconds: number;
  durationSeconds?: number;
}): MusicRhythmAnalysisPoint[] {
  const samples = input.samples;
  const windowSize = Math.max(1, Math.floor(input.sampleRate * input.windowSeconds));
  const points: Array<Omit<MusicRhythmAnalysisPoint, "normalizedEnergy" | "label">> = [];
  for (let offset = 0; offset < samples.length; offset += windowSize) {
    const end = Math.min(samples.length, offset + windowSize);
    let sum = 0;
    for (let index = offset; index < end; index += 1) {
      const sample = Number(samples[index] || 0);
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / Math.max(1, end - offset));
    points.push({
      startSeconds: round(offset / input.sampleRate),
      endSeconds: round(end / input.sampleRate),
      rms: round(rms, 6),
    });
  }
  if (!points.length && input.durationSeconds && input.durationSeconds > 0) {
    points.push({ startSeconds: 0, endSeconds: round(input.durationSeconds), rms: 0.001 });
  }
  const maxRms = Math.max(...points.map((point) => point.rms), 0.000001);
  return points.map((point) => {
    const normalizedEnergy = round(clamp(point.rms / maxRms, 0, 1));
    return {
      ...point,
      normalizedEnergy,
      label: energyLabel(normalizedEnergy),
    };
  });
}

function candidateEnergyCurve(durationSeconds?: number): MusicRhythmAnalysisPoint[] {
  const duration = Math.max(0, Number(durationSeconds || 0));
  if (!duration) return [];
  const buckets = Math.max(1, Math.ceil(duration / MUSIC_ANALYSIS_DEFAULT_WINDOW_SECONDS));
  return Array.from({ length: buckets }, (_, index) => {
    const startSeconds = index * MUSIC_ANALYSIS_DEFAULT_WINDOW_SECONDS;
    const endSeconds = Math.min(duration, startSeconds + MUSIC_ANALYSIS_DEFAULT_WINDOW_SECONDS);
    return {
      startSeconds: round(startSeconds),
      endSeconds: round(endSeconds),
      rms: 0,
      normalizedEnergy: 0.5,
      label: "steady" as const,
    };
  });
}

function buildSections(points: MusicRhythmAnalysisPoint[], durationSeconds?: number): MusicRhythmAnalysisSection[] {
  const duration = durationSeconds || points.at(-1)?.endSeconds || 0;
  if (!points.length || duration <= 0) return [];
  const sectionTarget = clamp(Math.round(duration / 8), 2, 8);
  const sectionDuration = duration / sectionTarget;
  return Array.from({ length: sectionTarget }, (_, index) => {
    const startSeconds = round(index * sectionDuration);
    const endSeconds = round(index === sectionTarget - 1 ? duration : (index + 1) * sectionDuration);
    const sectionPoints = points.filter((point) => point.endSeconds > startSeconds && point.startSeconds < endSeconds);
    const averageEnergy = round(
      sectionPoints.reduce((total, point) => total + point.normalizedEnergy, 0) / Math.max(1, sectionPoints.length),
    );
    const label = energyLabel(averageEnergy);
    const kind = sectionKind(label, index, sectionTarget);
    return {
      id: `music_section_${index + 1}`,
      kind,
      label: kind === "intro" ? "开场" : kind === "outro" ? "收束" : kind === "peak" ? "高点" : kind === "build" ? "推进" : "稳定段",
      startSeconds,
      endSeconds,
      averageEnergy,
      rhythmHint: rhythmHint(label),
    };
  });
}

function recommendedCutPoints(points: MusicRhythmAnalysisPoint[], sections: MusicRhythmAnalysisSection[], durationSeconds?: number): number[] {
  const duration = durationSeconds || points.at(-1)?.endSeconds || 0;
  const sectionEdges = sections.flatMap((section) => [section.startSeconds, section.endSeconds]);
  const energyEdges = points
    .filter((point, index) => index > 0 && Math.abs(point.normalizedEnergy - points[index - 1]!.normalizedEnergy) >= 0.28)
    .map((point) => point.startSeconds);
  return Array.from(new Set([0, ...sectionEdges, ...energyEdges, duration].filter((point) => point >= 0 && point <= duration)))
    .sort((left, right) => left - right)
    .map((point) => round(point, 2));
}

function rhythmTags(points: MusicRhythmAnalysisPoint[], sections: MusicRhythmAnalysisSection[]): string[] {
  const peakCount = points.filter((point) => point.label === "peak").length;
  const quietCount = points.filter((point) => point.label === "quiet").length;
  const rapidSections = sections.filter((section) => section.rhythmHint === "rapid_cut").length;
  return [
    peakCount >= Math.max(2, points.length * 0.25) ? "high_energy" : "",
    quietCount >= Math.max(2, points.length * 0.35) ? "quiet_open_space" : "",
    rapidSections ? "rapid_cut_candidate" : "",
    sections.length >= 4 ? "sectioned_music" : "",
  ].filter(Boolean);
}

function warningsFor(durationSeconds: number | undefined, points: MusicRhythmAnalysisPoint[]): string[] {
  return [
    !durationSeconds ? "duration_unknown_until_runtime_analysis" : "",
    durationSeconds && durationSeconds < 4 ? "music_too_short_for_full_video_rhythm" : "",
    durationSeconds && durationSeconds > 180 ? "music_longer_than_mvp_rhythm_window" : "",
    !points.length ? "energy_curve_pending_runtime_ffmpeg_analysis" : "",
  ].filter(Boolean) as string[];
}

export function buildMusicRhythmAnalysis(input: BuildMusicRhythmAnalysisInput): MusicRhythmAnalysis {
  const sampleRate = input.sampleRate || MUSIC_ANALYSIS_DEFAULT_SAMPLE_RATE;
  const windowSeconds = input.windowSeconds || MUSIC_ANALYSIS_DEFAULT_WINDOW_SECONDS;
  const durationSeconds = input.durationSeconds && input.durationSeconds > 0 ? round(input.durationSeconds, 3) : undefined;
  const energyCurve = input.samples
    ? samplesToEnergyCurve({ samples: input.samples, sampleRate, windowSeconds, durationSeconds })
    : candidateEnergyCurve(durationSeconds);
  const sections = buildSections(energyCurve, durationSeconds);
  const analysisId = analysisIdFor(input.label, durationSeconds, input.sizeBytes);
  return {
    schemaVersion: musicRhythmAnalysisSchemaVersion,
    analysisId,
    source: {
      label: clean(input.label) || "配乐参考",
      safeRef: input.safeRef || `music_reference:${analysisId}`,
      mimeType: clean(input.mimeType) || undefined,
      sizeBytes: input.sizeBytes,
    },
    durationSeconds,
    sampleRate,
    windowSeconds,
    energyCurve,
    sections,
    recommendedCutPoints: recommendedCutPoints(energyCurve, sections, durationSeconds),
    rhythmTags: rhythmTags(energyCurve, sections),
    warnings: warningsFor(durationSeconds, energyCurve),
    projectRelativeAnalysisPath: input.projectRelativeAnalysisPath || `audio/music-analysis/${analysisId}.json`,
    noRawPathStored: true,
    videoProviderPolicy: {
      noBgmForVideoProvider: true,
      usedFor: ["rhythm_planning", "final_export_bgm"],
    },
  };
}

export function buildMusicRhythmAnalysisCandidate(input: {
  label?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
}): MusicRhythmAnalysis {
  return buildMusicRhythmAnalysis({
    label: input.label || "配乐参考",
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    durationSeconds: input.durationSeconds,
  });
}

function runProcess(command: string, args: string[], timeoutMs: number): Promise<{ code: number | null; stdout: Buffer; stderr: string; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], shell: false });
    const stdout: Buffer[] = [];
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill("SIGTERM"); } catch {}
      resolve({ code: null, stdout: Buffer.concat(stdout), stderr, timedOut: true });
    }, timeoutMs);
    child.stdout?.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout: Buffer.concat(stdout), stderr, timedOut: false });
    });
  });
}

async function probeDuration(input: RunMusicRhythmAnalysisInput): Promise<number | undefined> {
  const result = await runProcess(input.ffprobePath || "ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    input.audioPath,
  ], input.timeoutMs || 60_000);
  const duration = Number.parseFloat(result.stdout.toString("utf8"));
  return Number.isFinite(duration) && duration > 0 ? duration : undefined;
}

function floatSamplesFromBuffer(buffer: Buffer): Float32Array {
  const count = Math.floor(buffer.length / 4);
  const samples = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    samples[index] = buffer.readFloatLE(index * 4);
  }
  return samples;
}

export async function runMusicRhythmAnalysis(input: RunMusicRhythmAnalysisInput): Promise<MusicRhythmAnalysis> {
  if (!existsSync(input.audioPath)) {
    throw new Error(`Audio file does not exist: ${input.audioPath}`);
  }
  const timeoutMs = input.timeoutMs || 120_000;
  const sampleRate = input.sampleRate || MUSIC_ANALYSIS_DEFAULT_SAMPLE_RATE;
  const durationSeconds = await probeDuration(input);
  const pcm = await runProcess(input.ffmpegPath || "ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    input.audioPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    String(sampleRate),
    "-f",
    "f32le",
    "pipe:1",
  ], timeoutMs);
  if (pcm.code !== 0 || pcm.timedOut) {
    throw new Error(`ffmpeg audio analysis failed: ${pcm.timedOut ? "timeout" : pcm.stderr}`);
  }
  const label = input.label || path.basename(input.audioPath);
  const analysis = buildMusicRhythmAnalysis({
    label,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    durationSeconds,
    samples: floatSamplesFromBuffer(pcm.stdout),
    sampleRate,
    windowSeconds: input.windowSeconds,
    projectRelativeAnalysisPath: input.projectRelativeAnalysisPath,
  });
  if (input.outputPath) {
    mkdirSync(path.dirname(input.outputPath), { recursive: true });
    writeFileSync(input.outputPath, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
  }
  return analysis;
}
