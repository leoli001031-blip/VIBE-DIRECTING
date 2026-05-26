import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  buildJimengImage2VideoPlan,
  extractDreaminaTaskInfo,
  jimengResumeCommand,
  JIMENG_CLI_DEFAULT_MODEL_VERSION,
  JIMENG_CLI_DEFAULT_QUEUE_WAIT_SECONDS,
  normalizeDreaminaStatus,
  type DreaminaTaskInfo,
  type JimengVideoCliStatus,
} from "../src/core/jimengVideoCli.ts";
import {
  buildVideoFirstFrameHoldPlan,
  VIDEO_FIRST_FRAME_CUT_DEFAULT_SECONDS,
  VIDEO_FIRST_FRAME_HOLD_DEFAULT_SECONDS,
  VIDEO_FIRST_FRAME_HOLD_SUFFIX,
} from "../src/core/videoFirstFrameProtection.ts";

type CommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
};

type FirstFrameProtectionStatus =
  | "planned_after_success"
  | "disabled"
  | "created"
  | "skipped_no_success_video"
  | "skipped_missing_source_frame"
  | "skipped_missing_input_video"
  | "skipped_ffmpeg_unavailable"
  | "skipped_ffmpeg_failed";

type FirstFrameProtectionReport = {
  enabled: boolean;
  status: FirstFrameProtectionStatus;
  providerIndependent: true;
  holdSeconds: number;
  cutSeconds: number;
  sourceFramePath?: string;
  inputVideoPath?: string;
  outputVideoPath?: string;
  outputVideoSha256?: string;
  outputSuffix: string;
  ffmpegPath?: string;
  ffmpegAvailable?: boolean;
  commandPreview?: string;
  receiptPath?: string;
  blockers: string[];
  notes: string[];
};

function argValue(name: string): string | undefined {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return undefined;
}

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100) || "item";
}

function safeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function safePositiveSeconds(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 1000) / 1000 : fallback;
}

function writeJson(filePath: string, payload: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeText(filePath: string, text: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text, "utf8");
}

function sha256File(filePath: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(filePath)).digest("hex")}`;
}

function redact(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-REDACTED")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer REDACTED")
    .slice(0, 1200);
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
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (/\.(mp4|mov|webm)$/i.test(entry.name) && statSync(absolute).size > 0) {
        output.push(absolute);
      }
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
    videoUrls: Array.from(new Set([...left.videoUrls, ...right.videoUrls])),
    localMediaPaths: Array.from(new Set([...left.localMediaPaths, ...right.localMediaPaths])),
    rawJsonCount: left.rawJsonCount + right.rawJsonCount,
    notes: [...left.notes, ...right.notes],
  };
}

async function runFirstFrameProtection(input: {
  enabled: boolean;
  status: JimengVideoCliStatus;
  sourceFramePath: string;
  inputVideoPath?: string;
  holdSeconds: number;
  cutSeconds: number;
  receiptPath: string;
  repoRoot: string;
}): Promise<FirstFrameProtectionReport> {
  const baseReport = {
    enabled: input.enabled,
    providerIndependent: true as const,
    holdSeconds: input.holdSeconds,
    cutSeconds: input.cutSeconds,
    sourceFramePath: input.sourceFramePath,
    inputVideoPath: input.inputVideoPath,
    outputSuffix: VIDEO_FIRST_FRAME_HOLD_SUFFIX,
    receiptPath: input.receiptPath,
  };

  if (!input.enabled) {
    return {
      ...baseReport,
      status: "disabled",
      blockers: [],
      notes: ["First-frame hold postprocess disabled by CLI flag."],
    };
  }
  if (input.status !== "success" || !input.inputVideoPath) {
    return {
      ...baseReport,
      status: "skipped_no_success_video",
      blockers: [],
      notes: ["Postprocess runs only after a successful local video download."],
    };
  }
  if (!existsSync(input.sourceFramePath)) {
    return {
      ...baseReport,
      status: "skipped_missing_source_frame",
      blockers: ["first_frame_source_missing"],
      notes: ["Source first frame was not present for local postprocess."],
    };
  }
  if (!existsSync(input.inputVideoPath)) {
    return {
      ...baseReport,
      status: "skipped_missing_input_video",
      blockers: ["postprocess_input_video_missing"],
      notes: ["Provider video path was reported but is not available on disk."],
    };
  }

  const plan = buildVideoFirstFrameHoldPlan({
    inputVideoPath: input.inputVideoPath,
    startFramePath: input.sourceFramePath,
    holdSeconds: input.holdSeconds,
    cutSeconds: input.cutSeconds,
  });
  const ffmpegVersion = await runCommand(plan.ffmpegPath, ["-version"], {
    cwd: input.repoRoot,
    timeoutMs: 5_000,
  });
  if (ffmpegVersion.exitCode !== 0) {
    const report: FirstFrameProtectionReport = {
      ...baseReport,
      status: "skipped_ffmpeg_unavailable",
      outputVideoPath: plan.outputVideoPath,
      ffmpegPath: plan.ffmpegPath,
      ffmpegAvailable: false,
      commandPreview: plan.commandPreview,
      blockers: ["ffmpeg_unavailable"],
      notes: ["ffmpeg is not available; main Jimeng submit remains successful and postprocess can be rerun later."],
    };
    writeJson(input.receiptPath, {
      ...report,
      stderr: redact(ffmpegVersion.stderr || ffmpegVersion.stdout),
    });
    return report;
  }

  const postprocess = await runCommand(plan.ffmpegPath, plan.args, {
    cwd: input.repoRoot,
    timeoutMs: 10 * 60 * 1000,
  });
  const outputCreated = postprocess.exitCode === 0 && existsSync(plan.outputVideoPath) && statSync(plan.outputVideoPath).size > 0;
  const report: FirstFrameProtectionReport = outputCreated
    ? {
        ...baseReport,
        status: "created",
        outputVideoPath: plan.outputVideoPath,
        outputVideoSha256: sha256File(plan.outputVideoPath),
        ffmpegPath: plan.ffmpegPath,
        ffmpegAvailable: true,
        commandPreview: plan.commandPreview,
        blockers: [],
        notes: ["Protected first-frame video created with local ffmpeg postprocess."],
      }
    : {
        ...baseReport,
        status: "skipped_ffmpeg_failed",
        outputVideoPath: plan.outputVideoPath,
        ffmpegPath: plan.ffmpegPath,
        ffmpegAvailable: true,
        commandPreview: plan.commandPreview,
        blockers: ["ffmpeg_first_frame_hold_failed"],
        notes: ["ffmpeg postprocess failed; main Jimeng submit remains successful and original video is preserved."],
      };
  writeJson(input.receiptPath, {
    ...report,
    plan,
    exitCode: postprocess.exitCode,
    durationMs: postprocess.durationMs,
    stdout: redact(postprocess.stdout),
    stderr: redact(postprocess.stderr),
  });
  return report;
}

function reportAndExit(reportPath: string, payload: unknown, exitCode: number): never {
  writeJson(reportPath, payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(exitCode);
}

const repoRoot = process.cwd();
const runId = safeId(argValue("--run-id") || `jimeng-video-cli-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const shotId = safeId(argValue("--shot-id") || "MS01");
const packageRoot = path.resolve(argValue("--output-root") || path.join(repoRoot, "real-test-sandbox", runId));
const inputsDir = path.join(packageRoot, "inputs");
const outputsDir = path.join(packageRoot, "video");
const receiptsDir = path.join(packageRoot, "receipts");
const reportDir = path.join(packageRoot, "report");
mkdirSync(inputsDir, { recursive: true });
mkdirSync(outputsDir, { recursive: true });
mkdirSync(receiptsDir, { recursive: true });
mkdirSync(reportDir, { recursive: true });

const imagePath = path.resolve(argValue("--image") || "real-test-sandbox/multishot-live-first-frame-20260519/start-frames/MS01-start.png");
const prompt =
  argValue("--prompt") ||
  "Use the first frame as the exact visual anchor. Create a 5 second cinematic anime shot: slow camera push in, rain moving gently, the character turns their head slightly toward the glowing signal, natural micro-expression, no new characters, no subtitles, no music.";
const durationSeconds = safeInteger(argValue("--duration"), 5);
const modelVersion = argValue("--model-version") || JIMENG_CLI_DEFAULT_MODEL_VERSION;
const videoResolution = argValue("--video-resolution") || "720p";
const cliPath = argValue("--cli") || process.env.VIBE_JIMENG_CLI_PATH || "dreamina";
const shortPollSeconds = safeInteger(argValue("--short-poll-seconds"), 20);
const pollIntervalSeconds = safeInteger(argValue("--poll-interval-seconds"), 20);
const queueWaitSeconds = safeInteger(argValue("--queue-wait-seconds"), JIMENG_CLI_DEFAULT_QUEUE_WAIT_SECONDS);
const liveRequested = argFlag("--live") || process.env.VIBE_JIMENG_CLI_LIVE === "1";
const confirmLive = argValue("--confirm-live") || process.env.VIBE_JIMENG_CLI_CONFIRM || "";
const liveConfirmed = confirmLive === "submit-jimeng-video";
const resumeSubmitId = argValue("--submit-id") || process.env.VIBE_JIMENG_CLI_SUBMIT_ID || "";
const firstFrameProtectionEnabled = argFlag("--first-frame-protection") || argFlag("--enable-first-frame-protection");
const firstFrameHoldSeconds = safePositiveSeconds(argValue("--first-frame-hold-seconds"), VIDEO_FIRST_FRAME_HOLD_DEFAULT_SECONDS);
const firstFrameCutSeconds = safePositiveSeconds(argValue("--first-frame-cut-seconds"), VIDEO_FIRST_FRAME_CUT_DEFAULT_SECONDS);
const reportPath = path.join(reportDir, "report.json");
const summaryPath = path.join(reportDir, "summary.md");
const firstFrameProtectionReceiptPath = path.join(receiptsDir, "firstframe-protection.json");

if (!existsSync(imagePath)) {
  reportAndExit(reportPath, {
    ok: false,
    status: "blocked_missing_start_frame",
    imagePath,
    message: "Jimeng CLI video submit requires an existing reviewed start frame image.",
  }, 1);
}

const inputImageCopy = path.join(inputsDir, `${shotId}-start${path.extname(imagePath) || ".png"}`);
copyFileSync(imagePath, inputImageCopy);

const plan = buildJimengImage2VideoPlan({
  imagePath: inputImageCopy,
  prompt,
  outputDir: outputsDir,
  durationSeconds,
  modelVersion,
  videoResolution,
  firstFrameProtectionEnabled,
  shortPollSeconds,
  pollIntervalSeconds,
  queueWaitSeconds,
  cliPath,
});
const planPath = path.join(receiptsDir, "submit-plan.json");
writeJson(planPath, {
  ...plan,
  imageSha256: sha256File(inputImageCopy),
  firstFramePostprocess: {
    enabled: firstFrameProtectionEnabled,
    providerIndependent: true,
    holdSeconds: firstFrameHoldSeconds,
    cutSeconds: firstFrameCutSeconds,
    outputSuffix: VIDEO_FIRST_FRAME_HOLD_SUFFIX,
    receiptPath: firstFrameProtectionReceiptPath,
  },
  liveSubmitRequires: "VIBE_JIMENG_CLI_CONFIRM=submit-jimeng-video or --confirm-live=submit-jimeng-video",
});
writeText(path.join(receiptsDir, "prompt.md"), `${plan.prompt}\n`);

if (!liveRequested || !liveConfirmed) {
  const status = liveRequested ? "live_submit_blocked_before_provider_call" : "mock_ready";
  const firstFrameProtection: FirstFrameProtectionReport = {
    enabled: firstFrameProtectionEnabled,
    status: firstFrameProtectionEnabled ? "planned_after_success" : "disabled",
    providerIndependent: true,
    holdSeconds: firstFrameHoldSeconds,
    cutSeconds: firstFrameCutSeconds,
    sourceFramePath: inputImageCopy,
    outputSuffix: VIDEO_FIRST_FRAME_HOLD_SUFFIX,
    receiptPath: firstFrameProtectionReceiptPath,
    blockers: [],
    notes: firstFrameProtectionEnabled
      ? ["Postprocess is planned for live success and does not run during mock mode."]
      : ["First-frame hold postprocess disabled by CLI flag."],
  };
  const payload = {
    ok: true,
    mode: "mock",
    status,
    packageRoot,
    providerCalledExternal: false,
    shotId,
    planPath,
    queuePolicy: plan.queuePolicy,
    commandPreview: `${plan.cliPath} ${plan.args.map((arg) => JSON.stringify(arg)).join(" ")}`,
    firstFrameProtection,
    resumeCommand: undefined,
    outputVideoPath: undefined,
    message: liveRequested
      ? "Live Jimeng submit was requested but confirmation phrase was missing."
      : "Mock run only. Add --live --confirm-live=submit-jimeng-video to submit to Dreamina/Jimeng.",
  };
  writeText(summaryPath, [
    "# Jimeng CLI video smoke",
    "",
    `Status: ${status}`,
    "External provider called: no",
    `Queue policy: wait up to ${plan.queuePolicy.maxWaitSeconds}s, then keep submit_id for resume.`,
    `First-frame protection: ${firstFrameProtection.status} (${firstFrameProtection.holdSeconds}s hold / ${firstFrameProtection.cutSeconds}s cut)`,
    "",
  ].join("\n"));
  reportAndExit(reportPath, payload, liveRequested ? 1 : 0);
}

const startedAt = Date.now();
const submitLogPath = path.join(receiptsDir, "dreamina-image2video-submit.json");
let taskInfo: DreaminaTaskInfo;
if (resumeSubmitId) {
  taskInfo = {
    submitId: resumeSubmitId,
    status: "submitted",
    videoUrls: [],
    localMediaPaths: [],
    rawJsonCount: 0,
    notes: ["Resumed from an existing Dreamina/Jimeng submit_id without resubmitting."],
  };
  writeJson(submitLogPath, {
    resumed: true,
    submitId: resumeSubmitId,
    providerCalledExternal: false,
    note: "Resume mode skips image2video submit and only calls query_result.",
  });
} else {
  const submit = await runCommand(plan.cliPath, plan.args, {
    cwd: repoRoot,
    timeoutMs: Math.max(60, shortPollSeconds + 45) * 1000,
  });
  writeJson(submitLogPath, {
    command: plan.cliPath,
    args: plan.args,
    exitCode: submit.exitCode,
    timedOut: submit.timedOut,
    durationMs: submit.durationMs,
    stdout: redact(submit.stdout),
    stderr: redact(submit.stderr),
  });

  taskInfo = extractDreaminaTaskInfo(submit.stdout, submit.stderr);

  if (submit.exitCode !== 0 && !taskInfo.submitId) {
    const firstFrameProtection = await runFirstFrameProtection({
      enabled: firstFrameProtectionEnabled,
      status: "failed",
      sourceFramePath: inputImageCopy,
      inputVideoPath: undefined,
      holdSeconds: firstFrameHoldSeconds,
      cutSeconds: firstFrameCutSeconds,
      receiptPath: firstFrameProtectionReceiptPath,
      repoRoot,
    });
    const payload = {
      ok: false,
      mode: "live",
      status: "submit_failed",
      packageRoot,
      providerCalledExternal: true,
      shotId,
      planPath,
      submitLogPath,
      queuePolicy: plan.queuePolicy,
      firstFrameProtection,
      error: redact(submit.stderr || submit.stdout),
    };
    reportAndExit(reportPath, payload, 1);
  }
}
let status: JimengVideoCliStatus = taskInfo.status;
let queryAttempts = 0;
let finalVideoFiles = findVideoFiles(outputsDir);
const queryLogPath = path.join(receiptsDir, "dreamina-query-attempts.jsonl");
const deadline = startedAt + queueWaitSeconds * 1000;

while (taskInfo.submitId && Date.now() < deadline) {
  queryAttempts += 1;
  const query = await runCommand(plan.cliPath, [
    "query_result",
    `--submit_id=${taskInfo.submitId}`,
    `--download_dir=${outputsDir}`,
  ], {
    cwd: repoRoot,
    timeoutMs: 120_000,
  });
  const queriedInfo = extractDreaminaTaskInfo(query.stdout, query.stderr);
  taskInfo = mergeTaskInfo(taskInfo, queriedInfo);
  finalVideoFiles = findVideoFiles(outputsDir);
  status = finalVideoFiles.length > 0 ? "success" : normalizeDreaminaStatus(taskInfo.status);
  writeText(queryLogPath, `${JSON.stringify({
    attempt: queryAttempts,
    at: new Date().toISOString(),
    exitCode: query.exitCode,
    durationMs: query.durationMs,
    status,
    submitId: taskInfo.submitId,
    videoFiles: finalVideoFiles.map((file) => path.relative(packageRoot, file).replace(/\\/g, "/")),
    stdout: redact(query.stdout),
    stderr: redact(query.stderr),
  })}\n`);
  if (status === "success" || status === "failed") break;
  await sleep(pollIntervalSeconds * 1000);
}

if (status !== "success" && Date.now() >= deadline) {
  status = "timed_out";
}

const outputVideoPath = finalVideoFiles[0];
const outputVideoSha256 = outputVideoPath ? sha256File(outputVideoPath) : undefined;
const resumeCommand = taskInfo.submitId ? jimengResumeCommand({ submitId: taskInfo.submitId, downloadDir: outputsDir, cliPath: plan.cliPath }) : undefined;
const firstFrameProtection = await runFirstFrameProtection({
  enabled: firstFrameProtectionEnabled,
  status,
  sourceFramePath: inputImageCopy,
  inputVideoPath: outputVideoPath,
  holdSeconds: firstFrameHoldSeconds,
  cutSeconds: firstFrameCutSeconds,
  receiptPath: firstFrameProtectionReceiptPath,
  repoRoot,
});
const ok = status === "success" || status === "queued" || status === "generating" || status === "submitted" || status === "timed_out";
const payload = {
  ok,
  mode: "live",
  status,
  packageRoot,
  providerCalledExternal: true,
  shotId,
  submitId: taskInfo.submitId,
  taskId: taskInfo.taskId,
  outputVideoPath,
  outputVideoSha256,
  firstFrameProtectedVideoPath: firstFrameProtection.outputVideoPath,
  firstFrameProtectedVideoSha256: firstFrameProtection.outputVideoSha256,
  firstFrameProtection,
  planPath,
  submitLogPath,
  queryLogPath,
  summaryPath,
  queuePolicy: plan.queuePolicy,
  queryAttempts,
  elapsedMs: Date.now() - startedAt,
  resumeCommand,
  userMessage:
    status === "success"
      ? "即梦视频已生成并下载。"
      : "即梦任务已提交但仍在排队/生成中。已保存 submit_id 和恢复命令，可以稍后继续查询，不需要重新消耗一次提交。",
};

writeText(summaryPath, [
  "# Jimeng CLI video smoke",
  "",
  `Status: ${status}`,
  `External provider called: yes`,
  `Submit ID: ${taskInfo.submitId || "-"}`,
  `Video: ${outputVideoPath ? path.relative(packageRoot, outputVideoPath).replace(/\\/g, "/") : "-"}`,
  `First-frame protection: ${firstFrameProtection.status}`,
  `Protected video: ${firstFrameProtection.outputVideoPath ? path.relative(packageRoot, firstFrameProtection.outputVideoPath).replace(/\\/g, "/") : "-"}`,
  `Queue wait budget: ${queueWaitSeconds}s`,
  `Query attempts: ${queryAttempts}`,
  resumeCommand ? `Resume: \`${resumeCommand}\`` : "Resume: -",
  "",
].join("\n"));

reportAndExit(reportPath, payload, status === "failed" ? 1 : 0);
