import path from "node:path";

export const videoFirstFrameProtectionSchemaVersion = "0.1.0";
export const VIDEO_FIRST_FRAME_HOLD_SUFFIX = "_firstframe-hold";
export const VIDEO_FIRST_FRAME_HOLD_DEFAULT_SECONDS = 0.35;
export const VIDEO_FIRST_FRAME_CUT_DEFAULT_SECONDS = 0.35;
export const VIDEO_FIRST_FRAME_HOLD_DEFAULT_WIDTH = 1280;
export const VIDEO_FIRST_FRAME_HOLD_DEFAULT_HEIGHT = 720;
export const VIDEO_FIRST_FRAME_HOLD_DEFAULT_FPS = 30;
export const VIDEO_FIRST_FRAME_HOLD_DEFAULT_FFMPEG = "ffmpeg";

export interface BuildVideoFirstFrameHoldPlanInput {
  inputVideoPath: string;
  startFramePath: string;
  outputVideoPath?: string;
  holdSeconds?: number;
  cutSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  ffmpegPath?: string;
}

export interface VideoFirstFrameHoldPlan {
  schemaVersion: string;
  postprocessKind: "first_frame_hold";
  providerIndependent: true;
  inputVideoPath: string;
  startFramePath: string;
  outputVideoPath: string;
  holdSeconds: number;
  cutSeconds: number;
  width: number;
  height: number;
  fps: number;
  ffmpegPath: string;
  args: string[];
  commandPreview: string;
  blockers: string[];
  notes: string[];
}

function positiveSeconds(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || value === undefined || value <= 0) return fallback;
  return Math.round(value * 1000) / 1000;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || value === undefined || value <= 0) return fallback;
  return Math.floor(value);
}

function quoteArg(value: string): string {
  return JSON.stringify(value);
}

export function firstFrameHoldOutputPath(inputVideoPath: string): string {
  const extension = path.extname(inputVideoPath);
  const base = extension ? inputVideoPath.slice(0, -extension.length) : inputVideoPath;
  return `${base}${VIDEO_FIRST_FRAME_HOLD_SUFFIX}.mp4`;
}

export function buildVideoFirstFrameHoldPlan(input: BuildVideoFirstFrameHoldPlanInput): VideoFirstFrameHoldPlan {
  const holdSeconds = positiveSeconds(input.holdSeconds, VIDEO_FIRST_FRAME_HOLD_DEFAULT_SECONDS);
  const cutSeconds = positiveSeconds(input.cutSeconds, VIDEO_FIRST_FRAME_CUT_DEFAULT_SECONDS);
  const width = positiveInteger(input.width, VIDEO_FIRST_FRAME_HOLD_DEFAULT_WIDTH);
  const height = positiveInteger(input.height, VIDEO_FIRST_FRAME_HOLD_DEFAULT_HEIGHT);
  const fps = positiveInteger(input.fps, VIDEO_FIRST_FRAME_HOLD_DEFAULT_FPS);
  const ffmpegPath = input.ffmpegPath || VIDEO_FIRST_FRAME_HOLD_DEFAULT_FFMPEG;
  const outputVideoPath = input.outputVideoPath || firstFrameHoldOutputPath(input.inputVideoPath);
  const filter = [
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${fps},format=yuv420p[hold]`,
    `[1:v]trim=start=${cutSeconds},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${fps},format=yuv420p[main]`,
    "[hold][main]concat=n=2:v=1:a=0[outv]",
  ].join(";");
  const args = [
    "-y",
    "-loop",
    "1",
    "-t",
    String(holdSeconds),
    "-i",
    input.startFramePath,
    "-i",
    input.inputVideoPath,
    "-filter_complex",
    filter,
    "-map",
    "[outv]",
    "-an",
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
    outputVideoPath,
  ];

  return {
    schemaVersion: videoFirstFrameProtectionSchemaVersion,
    postprocessKind: "first_frame_hold",
    providerIndependent: true,
    inputVideoPath: input.inputVideoPath,
    startFramePath: input.startFramePath,
    outputVideoPath,
    holdSeconds,
    cutSeconds,
    width,
    height,
    fps,
    ffmpegPath,
    args,
    commandPreview: `${ffmpegPath} ${args.map(quoteArg).join(" ")}`,
    blockers: [],
    notes: [
      "Create a protected opening by holding the reviewed start frame, then trimming the same duration from the provider video before concat.",
      "This postprocess is local ffmpeg only and never calls the video provider.",
    ],
  };
}
