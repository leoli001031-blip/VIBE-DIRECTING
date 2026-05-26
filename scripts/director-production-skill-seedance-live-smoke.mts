import { createHash } from "node:crypto";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  extractDreaminaTaskInfo,
  jimengResumeCommand,
  normalizeDreaminaStatus,
  type DreaminaTaskInfo,
  type JimengVideoCliStatus,
} from "../src/core/jimengVideoCli.ts";

type CommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
};

function argValue(name: string): string | undefined {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100) || "seedance";
}

function safeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function writeFile(filePath: string, value: string | Buffer): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value);
}

function writeJson(filePath: string, payload: unknown): void {
  writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function sha256File(filePath: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(filePath)).digest("hex")}`;
}

function firstExisting(paths: string[]): string | undefined {
  return paths.find((candidate) => existsSync(candidate));
}

function redact(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-REDACTED")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer REDACTED")
    .slice(0, 6000);
}

function runCommand(command: string, args: string[], options: { cwd: string; timeoutMs: number }): Promise<CommandResult> {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        exitCode: null,
        stdout,
        stderr: `${stderr}\n${error instanceof Error ? error.message : String(error)}`,
        timedOut,
        durationMs: Date.now() - startedAt,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code, stdout, stderr, timedOut, durationMs: Date.now() - startedAt });
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findVideoFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const output: string[] = [];
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (/\.(mp4|mov|webm)$/i.test(entry.name) && statSync(absolute).size > 0) output.push(absolute);
    }
  };
  visit(dir);
  return output.sort();
}

function mergeTaskInfo(left: DreaminaTaskInfo, right: DreaminaTaskInfo): DreaminaTaskInfo {
  return {
    submitId: right.submitId || left.submitId,
    taskId: right.taskId || left.taskId,
    status: right.status !== "unknown" ? right.status : left.status,
    queueInfo: right.queueInfo || left.queueInfo,
    videoUrls: Array.from(new Set([...left.videoUrls, ...right.videoUrls])),
    localMediaPaths: Array.from(new Set([...left.localMediaPaths, ...right.localMediaPaths])),
    rawJsonCount: left.rawJsonCount + right.rawJsonCount,
    notes: [...left.notes, ...right.notes],
  };
}

const repoRoot = process.cwd();
const inputRoot = path.resolve(argValue("--input-root") || "real-test-sandbox/director-production-skill-image2-live-2026-05-21T23-36-19-055Z");
const shotId = safeId(argValue("--shot-id") || "FT03");
const outputRoot = path.resolve(argValue("--output-root") || path.join(
  "real-test-sandbox",
  `director-production-skill-seedance-live-${shotId}-${new Date().toISOString().replace(/[:.]/g, "-")}`,
));
const cliPath = argValue("--cli") || process.env.VIBE_JIMENG_CLI_PATH || "dreamina";
const modelVersion = argValue("--model-version") || "seedance2.0";
const videoResolution = argValue("--video-resolution") || "720p";
const ratio = argValue("--ratio") || "16:9";
const duration = safeInteger(argValue("--duration"), 10);
const shortPollSeconds = safeInteger(argValue("--short-poll-seconds"), 90);
const pollIntervalSeconds = safeInteger(argValue("--poll-interval-seconds"), 60);
const queueWaitSeconds = safeInteger(argValue("--queue-wait-seconds"), 180);
const liveRequested = argFlag("--live") || process.env.VIBE_JIMENG_CLI_LIVE === "1";
const confirmLive = argValue("--confirm-live") || process.env.VIBE_JIMENG_CLI_CONFIRM || "";
const liveConfirmed = confirmLive === "submit-seedance-storyboard";
const resumeSubmitId = argValue("--submit-id") || process.env.VIBE_JIMENG_CLI_SUBMIT_ID || "";

const fixtureRoot = path.resolve("real-test-sandbox/storyboard-sheet-chain-flex-live-20260520-01/assets");
const storyboardSource = path.resolve(argValue("--storyboard-source") || firstExisting([
  path.join(inputRoot, "shots", shotId, `${shotId}-sequence_storyboard.png`),
  path.join(inputRoot, "shots", shotId, `${shotId}-motion_system_storyboard.png`),
  path.join(inputRoot, "shots", shotId, `${shotId}-shot_state_reference.png`),
]) || path.join(inputRoot, "shots", shotId, `${shotId}-sequence_storyboard.png`));
const storyboardKind =
  argValue("--storyboard-kind") ||
  (storyboardSource.includes("motion_system_storyboard") ? "motion_system_storyboard" :
    storyboardSource.includes("shot_state_reference") ? "shot_state_reference" :
      "sequence_storyboard");
const includeRen = argFlag("--include-ren") || (storyboardKind !== "motion_system_storyboard" && shotId !== "FT04");
const sourceImages = [
  {
    role: "storyboard_reference",
    source: storyboardSource,
    targetName: `${shotId}-storyboard-reference.png`,
  },
  {
    role: "scene_baseline",
    source: path.join(fixtureRoot, "scenes", "after-rain-school-rooftop.png"),
    targetName: "scene-after-rain-school-rooftop.png",
  },
  {
    role: "character_identity",
    source: path.join(fixtureRoot, "characters", "hina-main-character.png"),
    targetName: "character-hina.png",
  },
  ...(includeRen ? [{
    role: "character_identity" as const,
    source: path.join(fixtureRoot, "characters", "ren-supporting-character.png"),
    targetName: "character-ren.png",
  }] : []),
  {
    role: "prop_reference",
    source: path.join(fixtureRoot, "props", "blue-cassette-case.png"),
    targetName: "prop-blue-cassette-case.png",
  },
];

for (const image of sourceImages) {
  if (!existsSync(image.source)) throw new Error(`Missing input image for ${image.role}: ${image.source}`);
}

const inputsDir = path.join(outputRoot, "inputs");
const videoDir = path.join(outputRoot, "video");
const receiptsDir = path.join(outputRoot, "receipts");
const reportDir = path.join(outputRoot, "report");
mkdirSync(inputsDir, { recursive: true });
mkdirSync(videoDir, { recursive: true });
mkdirSync(receiptsDir, { recursive: true });
mkdirSync(reportDir, { recursive: true });

const images = sourceImages.map((image) => {
  const target = path.join(inputsDir, image.targetName);
  copyFileSync(image.source, target);
  return {
    role: image.role,
    source: image.source,
    path: target,
    sha256: sha256File(target),
  };
});

const sceneImageIndex = 2;
const hinaImageIndex = 3;
const renImageIndex = includeRen ? 4 : undefined;
const propImageIndex = includeRen ? 5 : 4;
const artifactSuppression = [
  "The final video must be a clean full-frame cinematic animation, not a storyboard sheet and not a split-screen board.",
  "If Image 1 contains production annotation colors, interpret them internally only: RED=camera/lens/framing/camera movement, BLUE=body movement/path/turn, GREEN=prop/cloth/environment/motion-system path, ORANGE=impact/burst/danger, PURPLE=timing/pause/acceleration.",
  "Image 1 contains non-diegetic planning metadata. Treat every visible arrow, colored or dashed line, handwritten note, English text, Chinese text, circled number, panel number, timing mark, label, grid border, white margin, title block, caption block, UI mark, logo, and watermark as invisible metadata.",
  "This cleanup rule has higher priority than visual copying from Image 1. Do not reproduce text-like shapes, marks, arrows, numbers, panel boxes, or annotation symbols even as background texture.",
].join("\n");
const timingPlan = storyboardKind === "motion_system_storyboard" ? [
  "[TIMING PLAN]",
  `Total duration: ${duration}s. Storyboard panels: 3. Target visible video cuts: exactly 3.`,
  "The storyboard panel count is binding. Do not create extra visible cuts beyond these three panels.",
  "Detail actions must stay inside their assigned panel beat, not become separate shots.",
  `00:00-${Math.min(duration, 3.2).toFixed(1)}s: tense start-frame setup, cassette in hand, wind/electric hum begins.`,
  `${Math.min(duration, 3.2).toFixed(1)}-${Math.min(duration, 6.8).toFixed(1)}s: magnetic tape lifts from the cassette and curls through the rooftop air.`,
  `${Math.min(duration, 6.8).toFixed(1)}-${duration.toFixed(1)}s: tape signal path extends toward the rooftop door; end with unresolved forward motion.`,
  "If the storyboard page has more panels, merge extra panels internally and preserve only these timing beats.",
  "Use this written timing plan as authority. Visible panel time labels in Image 1 are production notes only; never render text, numbers, or timing marks in the final video.",
] : [
  "[TIMING PLAN]",
  `Total duration: ${duration}s. Storyboard panels: 3. Target visible video cuts: exactly 3.`,
  "The storyboard panel count is binding. Do not create extra visible cuts beyond these three panels.",
  "Detail actions such as footsteps, puddles, hands, cassette, reaction, and continued movement must stay inside the three listed panel beats.",
  `00:00-${Math.min(duration, 3).toFixed(1)}s: establish the rainy rooftop direction, left-right spacing, rooftop door light, and the cassette action setup.`,
  `${Math.min(duration, 3).toFixed(1)}-${Math.min(duration, 7).toFixed(1)}s: the girl starts moving with the cassette; footsteps cross puddles; the boy follows and checks the flickering rooftop door.`,
  `${Math.min(duration, 7).toFixed(1)}-${duration.toFixed(1)}s: continue forward movement in a closer moving beat, preserving the cassette as the prop anchor and the same screen direction.`,
  "If the storyboard page has more panels, merge extra panels internally and preserve only these timing beats.",
  "Use this written timing plan as authority. Visible panel time labels in Image 1 are production notes only; never render text, numbers, or timing marks in the final video.",
];
const propIsolation = [
  "Prop reference isolation:",
  `Image ${propImageIndex} is an object sheet only, even if it looks like a finished frame, insert shot, catalog image, or storyboard panel.`,
  `Never render Image ${propImageIndex} as a standalone cutaway, split-screen, picture-in-picture, background, panel, or separate video beat.`,
  "Use only object shape, scale, material cues, and hand interaction when the prop appears inside the storyboard-directed rooftop scene.",
  "If the prop reference includes a white background, table surface, framing, labels, shadows, or surrounding scene, ignore all of that context.",
];
const shotPrompt = storyboardKind === "motion_system_storyboard" ? [
  "Create a 10-second Japanese TV anime rooftop motion sequence.",
  "The short-haired schoolgirl holds the blue cassette case; wind and a distant electrical hum pull the magnetic tape out of the case.",
  "The tape rises like a ribbon-shaped signal path, curls in the wet rooftop air, passes near the camera, and extends toward the rooftop door.",
  "Keep the action readable and evolving within exactly three visible cuts: setup, tape lift, signal path extension. Low-angle follow, subtle orbit, reaction, and puddle reflection are internal motion details only.",
  "Do not show the final emotional payoff too early; this is an active setup shot with unresolved forward motion.",
] : [
  "Create a 10-second Japanese TV anime rooftop sequence.",
  includeRen
    ? "The girl leads from screen-left toward the rooftop edge while holding the cassette; the boy follows from screen-right."
    : "The girl leads from screen-left toward the rooftop edge while holding the cassette.",
  "Show exactly three storyboard-matched visible cuts: wide rooftop direction, moving follow with cassette, closer continued forward motion.",
  "Footsteps, puddles, cassette hand detail, the boy's glance, and reaction are internal details within those three cuts, not extra shots.",
];

const prompt = [
  "Use Image 1 only as an internal storyboard reference for choreography, shot order, camera rhythm, staging, and motion-planning.",
  "Follow the storyboard panels internally from left to right and top to bottom. Treat each panel as a separate cinematic beat, not as one single final image.",
  "The visible cut count must match the storyboard panels and timing plan. Do not split support details into additional shots.",
  artifactSuppression,
  `Use Image ${sceneImageIndex} as the scene/weather reference: rainy school rooftop, wet reflective floor, rooftop door, railings, cloudy sky, subdued Japanese TV anime atmosphere.`,
  renImageIndex
    ? `Use Images ${hinaImageIndex} and ${renImageIndex} as strict character identity references. Preserve the short-haired girl and the boy identity, school-uniform silhouettes, face categories, and age impression. If the storyboard drawing differs, the character references win.`
    : `Use Image ${hinaImageIndex} as the strict character identity reference. Preserve the short-haired girl identity, short bob hair, school-uniform silhouette, face category, and age impression. If the storyboard drawing differs, the character reference wins.`,
  `Use Image ${propImageIndex} only for the blue cassette case object appearance and hand interaction. It is not a shot, scene, insert, camera cue, or motion reference.`,
  ...propIsolation,
  ...timingPlan,
  ...shotPrompt,
  "Keep the movement natural and readable, with mild handheld anime camera energy and restrained Evangelion-like tension. Do not make it photorealistic, live action, 3D CG, glossy game render, or commercial ad style.",
  "No BGM, no music, no song, no subtitles. Leave room for later dialogue and ambient sound design.",
].join("\n");

writeFile(path.join(receiptsDir, "prompt.md"), `${prompt}\n`);
writeJson(path.join(receiptsDir, "input-manifest.json"), {
  schemaVersion: "director_production_skill_seedance_live_smoke_v1",
  shotId,
  storyboardKind,
  modelVersion,
  videoResolution,
  ratio,
  duration,
  images,
  rawSecretStored: false,
});

const args = [
  "multimodal2video",
  ...images.flatMap((image) => ["--image", image.path]),
  "--prompt", prompt,
  "--duration", String(duration),
  "--ratio", ratio,
  "--video_resolution", videoResolution,
  "--model_version", modelVersion,
  "--poll", String(shortPollSeconds),
];

const planPath = path.join(receiptsDir, "submit-plan.json");
writeJson(planPath, {
  command: cliPath,
  args,
  liveSubmitRequires: "--live --confirm-live=submit-seedance-storyboard",
  expectedQueueWaitMinutes: 50,
  maxConcurrentVideoJobs: 1,
  rawSecretStored: false,
});

if (!liveRequested || !liveConfirmed) {
  const report = {
    ok: true,
    mode: "mock",
    providerCalledExternal: false,
    status: liveRequested ? "live_submit_blocked_before_provider_call" : "mock_ready",
    outputRoot,
    planPath,
    commandPreview: `${cliPath} ${args.map((arg) => JSON.stringify(arg)).join(" ")}`,
  };
  writeJson(path.join(reportDir, "report.json"), report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(liveRequested ? 1 : 0);
}

let taskInfo: DreaminaTaskInfo = {
  submitId: resumeSubmitId || undefined,
  status: resumeSubmitId ? "submitted" : "unknown",
  videoUrls: [],
  localMediaPaths: [],
  rawJsonCount: 0,
  notes: resumeSubmitId ? ["Resumed from submit id without resubmitting."] : [],
};
const submitLogPath = path.join(receiptsDir, "dreamina-multimodal2video-submit.json");
const startedAt = Date.now();

if (resumeSubmitId) {
  writeJson(submitLogPath, {
    resumed: true,
    submitId: resumeSubmitId,
    providerCalledExternal: false,
  });
} else {
  const submit = await runCommand(cliPath, args, {
    cwd: repoRoot,
    timeoutMs: Math.max(60, shortPollSeconds + 60) * 1000,
  });
  writeJson(submitLogPath, {
    command: cliPath,
    args,
    exitCode: submit.exitCode,
    timedOut: submit.timedOut,
    durationMs: submit.durationMs,
    stdout: redact(submit.stdout),
    stderr: redact(submit.stderr),
  });
  taskInfo = extractDreaminaTaskInfo(submit.stdout, submit.stderr);
  if (submit.exitCode !== 0 && !taskInfo.submitId) {
    const report = {
      ok: false,
      mode: "live",
      providerCalledExternal: true,
      status: "submit_failed",
      outputRoot,
      planPath,
      submitLogPath,
      error: redact(submit.stderr || submit.stdout),
    };
    writeJson(path.join(reportDir, "report.json"), report);
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }
}

let status: JimengVideoCliStatus = taskInfo.status;
let queryAttempts = 0;
let videoFiles = findVideoFiles(videoDir);
const queryLogPath = path.join(receiptsDir, "dreamina-query-attempts.jsonl");
const deadline = Date.now() + queueWaitSeconds * 1000;

while (taskInfo.submitId && Date.now() < deadline) {
  queryAttempts += 1;
  const query = await runCommand(cliPath, [
    "query_result",
    `--submit_id=${taskInfo.submitId}`,
    `--download_dir=${videoDir}`,
  ], {
    cwd: repoRoot,
    timeoutMs: 120_000,
  });
  const queriedInfo = extractDreaminaTaskInfo(query.stdout, query.stderr);
  taskInfo = mergeTaskInfo(taskInfo, queriedInfo);
  videoFiles = findVideoFiles(videoDir);
  status = videoFiles.length > 0 ? "success" : normalizeDreaminaStatus(taskInfo.status);
  appendFileSync(queryLogPath, `${JSON.stringify({
    attempt: queryAttempts,
    at: new Date().toISOString(),
    exitCode: query.exitCode,
    durationMs: query.durationMs,
    status,
    submitId: taskInfo.submitId,
    videoFiles: videoFiles.map((file) => path.relative(outputRoot, file).replace(/\\/g, "/")),
    stdout: redact(query.stdout),
    stderr: redact(query.stderr),
  })}\n`);
  if (status === "success" || status === "failed") break;
  await sleep(pollIntervalSeconds * 1000);
}

if (status !== "success" && Date.now() >= deadline) status = "timed_out";

const outputVideoPath = videoFiles[0];
const report = {
  ok: status === "success" || status === "queued" || status === "generating" || status === "submitted" || status === "timed_out",
  mode: "live",
  providerCalledExternal: true,
  status,
  outputRoot,
  shotId,
  submitId: taskInfo.submitId,
  taskId: taskInfo.taskId,
  queueInfo: taskInfo.queueInfo,
  outputVideoPath,
  outputVideoSha256: outputVideoPath ? sha256File(outputVideoPath) : undefined,
  planPath,
  submitLogPath,
  queryLogPath,
  queryAttempts,
  elapsedMs: Date.now() - startedAt,
  resumeCommand: taskInfo.submitId ? jimengResumeCommand({ submitId: taskInfo.submitId, downloadDir: videoDir, cliPath }) : undefined,
};
writeJson(path.join(reportDir, "report.json"), report);
writeFile(path.join(reportDir, "summary.md"), [
  "# Director Production Skill Seedance Live Smoke",
  "",
  `- status: ${status}`,
  `- model: ${modelVersion}`,
  `- resolution: ${videoResolution}`,
  `- duration: ${duration}s`,
  `- submit_id: ${taskInfo.submitId || "-"}`,
  `- output: ${outputVideoPath ? path.relative(outputRoot, outputVideoPath).replace(/\\/g, "/") : "-"}`,
  `- resume: ${report.resumeCommand || "-"}`,
  "",
].join("\n"));

console.log(JSON.stringify(report, null, 2));
