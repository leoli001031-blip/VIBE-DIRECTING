import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import {
  buildJimengImage2VideoPlan,
  buildJimengFirstFrameProtectedPrompt,
  buildJimengFullFrameReferenceMotionPrompt,
  buildJimengVideoStatusProjection,
  extractDreaminaTaskInfo,
  jimengResumeCommand,
  JIMENG_CLI_DEFAULT_MAX_CONCURRENT_VIDEO_JOBS,
  JIMENG_FULL_FRAME_REFERENCE_PROMPT_MARKER,
  JIMENG_FIRST_FRAME_PROTECTION_PROMPT_MARKER,
  JIMENG_FIRST_FRAME_PROTECTION_SECONDS,
  JIMENG_CLI_DEFAULT_MODEL_VERSION,
  JIMENG_CLI_HIGH_COST_VIDEO_RESOLUTION,
  JIMENG_CLI_MODEL_OPTIONS,
  JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION,
  JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES,
  JIMENG_CLI_DEFAULT_RESUME_INTERVAL_SECONDS,
  JIMENG_CLI_VIP_MODEL_VERSION,
  jimengVideoResolutionOptionsForModel,
} from "../src/core/jimengVideoCli.ts";
import {
  buildVideoFirstFrameHoldPlan,
  firstFrameHoldOutputPath,
  VIDEO_FIRST_FRAME_CUT_DEFAULT_SECONDS,
  VIDEO_FIRST_FRAME_HOLD_DEFAULT_SECONDS,
} from "../src/core/videoFirstFrameProtection.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const plan = buildJimengImage2VideoPlan({
  imagePath: "/tmp/start.png",
  outputDir: "/tmp/video",
  prompt: "camera push in",
});

assert(plan.providerId === "jimeng-video-cli", "Jimeng plan providerId drifted");
assert(plan.cliPath === "dreamina", "Jimeng plan should default to dreamina CLI");
assert(plan.args[0] === "image2video", "Jimeng plan must call image2video");
assert(plan.args.includes("--image") && plan.args.includes("/tmp/start.png"), "Jimeng plan must include image");
assert(plan.sourcePrompt === "camera push in", "Jimeng plan must preserve source prompt separately");
assert(plan.prompt.includes(JIMENG_FULL_FRAME_REFERENCE_PROMPT_MARKER), "Jimeng prompt must default to full-frame reference motion rules");
assert(plan.prompt.includes("already a composed scene-state frame"), "Jimeng prompt must treat the input as composed scene state");
assert(!plan.prompt.includes(JIMENG_FIRST_FRAME_PROTECTION_PROMPT_MARKER), "Jimeng prompt must not default to first-frame protection");
assert(!plan.prompt.includes("first 0.5 seconds"), "Jimeng default prompt must not include old protected-opening copy");
assert(plan.firstFrameProtection.enabled === false, "Jimeng plan must default first-frame protection off");
assert(
  plan.firstFrameProtection.protectedInitialSeconds === 0,
  "Jimeng default first-frame protection seconds should be zero",
);
assert(
  plan.args[plan.args.indexOf("--prompt") + 1] === plan.prompt,
  "Jimeng CLI args must use the protected prompt",
);
assert(plan.args.includes("--video_resolution") && plan.args.includes(JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION), "Jimeng plan must default to 720p");
assert(plan.args.includes("--model_version") && plan.args.includes(JIMENG_CLI_DEFAULT_MODEL_VERSION), "Jimeng plan must default to Seedance 2.0");
assert(plan.queuePolicy.providerAsync === true, "Jimeng queue policy must model async provider behavior");
assert(plan.queuePolicy.timeoutIsRecoverable === true, "Jimeng queue timeout must be recoverable");
assert(plan.queuePolicy.maxConcurrentVideoJobs === JIMENG_CLI_DEFAULT_MAX_CONCURRENT_VIDEO_JOBS, "Jimeng video must default to single long-running lane");
assert(plan.queuePolicy.maxWaitSeconds >= 60 * 60, "Jimeng queue wait budget should cover severe queueing by default");
assert(plan.queuePolicy.expectedQueueWaitMinutes === JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES, "Jimeng queue policy must expose the expected long wait");
assert(plan.queuePolicy.recommendedResumeIntervalSeconds === JIMENG_CLI_DEFAULT_RESUME_INTERVAL_SECONDS, "Jimeng queue policy must expose resume interval");
assert(/50 分钟/.test(plan.queuePolicy.userMessage), "Jimeng queue copy must name the expected long wait");
assert(/恢复查询/.test(plan.queuePolicy.userMessage), "Jimeng queue copy must explain resume");
assert(!/并发视频/.test(plan.queuePolicy.userMessage), "Jimeng user copy must not mention concurrent video");
assert(
  buildJimengFirstFrameProtectedPrompt(plan.prompt) === plan.prompt,
  "Jimeng first-frame protection prompt wrapping must be idempotent",
);
assert(
  buildJimengFullFrameReferenceMotionPrompt(plan.prompt) === plan.prompt,
  "Jimeng full-frame reference prompt wrapping must be idempotent",
);

const vipPlan = buildJimengImage2VideoPlan({
  imagePath: "/tmp/start.png",
  outputDir: "/tmp/video",
  prompt: "camera push in",
  modelVersion: JIMENG_CLI_VIP_MODEL_VERSION,
});
assert(vipPlan.modelVersion === JIMENG_CLI_VIP_MODEL_VERSION, "VIP model should be selectable");
assert(vipPlan.videoResolution === "720p", "VIP selection must still default to 720p");
assert(vipPlan.args.includes("--model_version") && vipPlan.args.includes(JIMENG_CLI_VIP_MODEL_VERSION), "VIP model arg missing");
assert(vipPlan.args.includes("--video_resolution") && vipPlan.args.includes("720p"), "VIP plan must not silently switch to 1080p");
assert(
  jimengVideoResolutionOptionsForModel(JIMENG_CLI_VIP_MODEL_VERSION).includes(JIMENG_CLI_HIGH_COST_VIDEO_RESOLUTION),
  "VIP option should expose 1080p as an explicit high-cost choice",
);
assert(
  !jimengVideoResolutionOptionsForModel(JIMENG_CLI_DEFAULT_MODEL_VERSION).includes(JIMENG_CLI_HIGH_COST_VIDEO_RESOLUTION),
  "standard option must not expose 1080p",
);
assert(
  JIMENG_CLI_MODEL_OPTIONS.some((option) =>
    option.value === JIMENG_CLI_VIP_MODEL_VERSION
    && option.requiresExplicitHighCostConfirmation === true
    && option.defaultVideoResolution === "720p"
  ),
  "VIP model option must carry an explicit high-cost warning while defaulting to 720p",
);

const nonVip1080Plan = buildJimengImage2VideoPlan({
  imagePath: "/tmp/start.png",
  outputDir: "/tmp/video",
  prompt: "camera push in",
  modelVersion: JIMENG_CLI_DEFAULT_MODEL_VERSION,
  videoResolution: JIMENG_CLI_HIGH_COST_VIDEO_RESOLUTION,
});
assert(nonVip1080Plan.videoResolution === "720p", "non-VIP 1080p request should be normalized to 720p");

const protectedPlan = buildJimengImage2VideoPlan({
  imagePath: "/tmp/start.png",
  outputDir: "/tmp/video",
  prompt: "camera push in",
  firstFrameProtectionEnabled: true,
});
assert(protectedPlan.prompt.includes(JIMENG_FIRST_FRAME_PROTECTION_PROMPT_MARKER), "explicit first-frame protection should still be available");
assert(protectedPlan.prompt.includes("first 0.5 seconds"), "explicit first-frame protection should keep old timing copy");
assert(protectedPlan.prompt.includes("Do not stretch characters"), "explicit first-frame protection should keep anti-stretch copy");
assert(protectedPlan.firstFrameProtection.enabled === true, "explicit first-frame protection metadata missing");
assert(
  protectedPlan.firstFrameProtection.protectedInitialSeconds === JIMENG_FIRST_FRAME_PROTECTION_SECONDS,
  "explicit first-frame protection seconds drifted",
);

const postprocessPlan = buildVideoFirstFrameHoldPlan({
  inputVideoPath: "/tmp/video/shot.mp4",
  startFramePath: "/tmp/inputs/shot-start.png",
});
assert(postprocessPlan.providerIndependent === true, "first-frame hold postprocess must be provider-independent");
assert(postprocessPlan.holdSeconds === VIDEO_FIRST_FRAME_HOLD_DEFAULT_SECONDS, "first-frame hold default seconds mismatch");
assert(postprocessPlan.cutSeconds === VIDEO_FIRST_FRAME_CUT_DEFAULT_SECONDS, "first-frame cut default seconds mismatch");
assert(postprocessPlan.outputVideoPath === "/tmp/video/shot_firstframe-hold.mp4", "first-frame hold output path mismatch");
assert(firstFrameHoldOutputPath("/tmp/video/shot.mov") === "/tmp/video/shot_firstframe-hold.mp4", "first-frame output path should normalize to mp4");
assert(postprocessPlan.commandPreview.includes("ffmpeg"), "first-frame hold command preview must use ffmpeg");
assert(postprocessPlan.args.includes("-filter_complex"), "first-frame hold plan must include ffmpeg filter_complex");

const submitInfo = extractDreaminaTaskInfo(`{
  "submit_id": "abc123",
  "gen_status": "queueing",
  "queue_info": { "queue_idx": 2085, "queue_status": "Queueing", "queue_length": 2086 },
  "data": { "gen_task_id": "task_1" }
}`, "");
assert(submitInfo.submitId === "abc123", "submit_id parser failed");
assert(submitInfo.taskId === "task_1", "task id parser failed");
assert(submitInfo.status === "queued", "queued status normalization failed");
assert(submitInfo.queueInfo?.position === 2085, "queue position parser failed");
const queuedProjection = buildJimengVideoStatusProjection({
  status: submitInfo.status,
  submitId: submitInfo.submitId,
  queueInfo: submitInfo.queueInfo,
});
assert(queuedProjection.label === "排队中", "queued projection label mismatch");
assert(queuedProjection.shortSubmitId === "abc123", "submit id short code mismatch");
assert(/前面约 2085 个任务/.test(queuedProjection.detail), "queued projection must show visible position");
assert(/50 分钟/.test(queuedProjection.detail), "queued projection must show expected long wait");
assert(/恢复查询/.test(queuedProjection.detail), "queued projection must explain resume query");

const successInfo = extractDreaminaTaskInfo("", `status=success\nsaved to /tmp/out/movie.mp4\nsubmit_id=done456`);
assert(successInfo.submitId === "done456", "regex submit_id parser failed");
assert(successInfo.status === "success", "success status normalization failed");
assert(successInfo.localMediaPaths.includes("/tmp/out/movie.mp4"), "local media path parser failed");
const remoteSuccessInfo = extractDreaminaTaskInfo(`{
  "submit_id": "remote789",
  "gen_status": "success",
  "result_json": { "videos": [{ "video_url": "https://example.test/video/result.mp4?token=redacted" }] }
}`, "");
assert(remoteSuccessInfo.status === "success", "remote video success status normalization failed");
assert(remoteSuccessInfo.videoUrls.includes("https://example.test/video/result.mp4?token=redacted"), "remote video url parser failed");
assert(
  jimengResumeCommand({ submitId: "abc123", downloadDir: "/tmp/video" }) ===
    "dreamina query_result --submit_id=abc123 --download_dir=/tmp/video",
  "resume command mismatch",
);

const tempRoot = mkdtempSync(path.join(tmpdir(), "jimeng-video-cli-test-"));
try {
  const imagePath = path.join(tempRoot, "start.png");
  writeFileSync(imagePath, Buffer.from("not-a-real-png-but-existing-for-mock"));
  const run = spawnSync(
    "npx",
    [
      "tsx",
      "scripts/jimeng-video-cli-smoke.mts",
      `--run-id=jimeng-video-cli-test-${Date.now()}`,
      `--output-root=${path.join(tempRoot, "package")}`,
      `--image=${imagePath}`,
      "--prompt=slow camera push in",
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert(run.status === 0, `mock smoke should pass: ${run.stderr || run.stdout}`);
  const reportPath = path.join(tempRoot, "package", "report", "report.json");
  assert(existsSync(reportPath), "mock smoke report missing");
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  assert(report.providerCalledExternal === false, "mock smoke must not call provider");
  assert(report.status === "mock_ready", "mock smoke status mismatch");
  assert(report.queuePolicy.maxWaitSeconds >= 60 * 60, "mock smoke must expose long queue wait policy");
  assert(report.queuePolicy.expectedQueueWaitMinutes === 50, "mock smoke must expose expected 50 minute wait");
  assert(report.queuePolicy.recommendedResumeIntervalSeconds === 10 * 60, "mock smoke must expose resume interval");
  assert(report.commandPreview.includes(JIMENG_FULL_FRAME_REFERENCE_PROMPT_MARKER), "mock command preview must use full-frame reference prompt");
  assert(!report.commandPreview.includes(JIMENG_FIRST_FRAME_PROTECTION_PROMPT_MARKER), "mock command preview must not default to protected prompt");
  assert(report.firstFrameProtection.enabled === false, "mock report must default first-frame protection off");
  assert(report.firstFrameProtection.status === "disabled", "mock postprocess status must be disabled by default");
  assert(report.firstFrameProtection.providerIndependent === true, "mock postprocess report must be provider-independent");
  assert(report.firstFrameProtection.holdSeconds === VIDEO_FIRST_FRAME_HOLD_DEFAULT_SECONDS, "mock postprocess report must expose default hold seconds");
  assert(report.firstFrameProtection.cutSeconds === VIDEO_FIRST_FRAME_CUT_DEFAULT_SECONDS, "mock postprocess report must expose default cut seconds");
  assert(report.firstFrameProtection.outputSuffix === "_firstframe-hold", "mock postprocess report must expose protected output suffix");
  const promptReceipt = readFileSync(path.join(tempRoot, "package", "receipts", "prompt.md"), "utf8");
  assert(promptReceipt.includes(JIMENG_FULL_FRAME_REFERENCE_PROMPT_MARKER), "prompt receipt must store full-frame prompt");
  assert(!promptReceipt.includes(JIMENG_FIRST_FRAME_PROTECTION_PROMPT_MARKER), "prompt receipt must not store protected prompt by default");

  const enabledRun = spawnSync(
    "npx",
    [
      "tsx",
      "scripts/jimeng-video-cli-smoke.mts",
      `--run-id=jimeng-video-cli-test-protected-${Date.now()}`,
      `--output-root=${path.join(tempRoot, "package-protected")}`,
      `--image=${imagePath}`,
      "--prompt=slow camera push in",
      "--first-frame-protection",
      "--first-frame-hold-seconds=0.5",
      "--first-frame-cut-seconds=0.45",
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert(enabledRun.status === 0, `protected mock smoke should pass: ${enabledRun.stderr || enabledRun.stdout}`);
  const enabledReport = JSON.parse(readFileSync(path.join(tempRoot, "package-protected", "report", "report.json"), "utf8"));
  assert(enabledReport.providerCalledExternal === false, "protected mock smoke must not call provider");
  assert(enabledReport.commandPreview.includes(JIMENG_FIRST_FRAME_PROTECTION_PROMPT_MARKER), "protected mock command preview must use protected prompt");
  assert(enabledReport.firstFrameProtection.enabled === true, "protected mock report must expose enabled first-frame protection");
  assert(enabledReport.firstFrameProtection.status === "planned_after_success", "protected mock postprocess status mismatch");
  assert(enabledReport.firstFrameProtection.holdSeconds === 0.5, "protected mock should report adjusted hold seconds");
  assert(enabledReport.firstFrameProtection.cutSeconds === 0.45, "protected mock should report adjusted cut seconds");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("jimeng-video-cli-test: ok");
