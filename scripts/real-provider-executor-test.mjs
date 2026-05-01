import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadModule(sourcePath, exportPath) {
  const resolved = path.resolve(sourcePath);
  const source = fs.readFileSync(resolved, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      isolatedModules: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: resolved,
  });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-real-provider-executor-"));
  const outPath = path.join(tmpDir, exportPath);
  fs.writeFileSync(outPath, output.outputText, "utf8");
  return import(pathToFileURL(outPath).href);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sandbox() {
  const root = "real-provider-executor/project_1/batch_A";
  return {
    root,
    allowedPrefixes: [root],
    manifestPath: `${root}/manifest.json`,
    qaReportPath: `${root}/qa/qa-report.json`,
    ledgerPath: `${root}/execution-ledger.json`,
    projectRootRelative: true,
    outsideRootWriteAllowed: false,
  };
}

function taskPlan(overrides = {}) {
  return {
    taskPlanId: "image_task_plan_S01",
    jobId: "job_S01",
    shotId: "S01",
    promptPlanId: "prompt_S01",
    providerSlot: "image.edit",
    requiredMode: "image2image",
    providerId: "openai-image2-api",
    mode: "image2image",
    status: "ready_for_dry_run",
    expectedOutputPath: "real-provider-executor/project_1/batch_A/shots/S01/result.png",
    inputReferenceIds: ["hero_locked"],
    sourcePromptPlanHash: "prompt_hash_S01",
    sourceShotSpecHash: "shot_hash_S01",
    taskEnvelopeSummary: {
      envelopeId: "envelope_S01",
      providerSlot: "image.edit",
      providerId: "openai-image2-api",
      requiredMode: "image2image",
      sourceIndexHash: "source_hash",
      promptPlanId: "prompt_S01",
      promptPlanHash: "prompt_hash_S01",
      sourceShotSpecHash: "shot_hash_S01",
      expectedOutputs: ["real-provider-executor/project_1/batch_A/shots/S01/result.png"],
      preflightStatus: "pass",
      blockingReasons: [],
    },
    blockers: [],
    warnings: [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    ...overrides,
  };
}

function image2Request(overrides = {}) {
  return {
    requestId: "image2_request_image_task_plan_S01",
    taskPlanId: "image_task_plan_S01",
    adapterId: "openai-image2-api-dry-run",
    operation: "image2image",
    payload: {
      sourceIntent: ["create reviewed keyframe"],
      mustPreserve: ["identity"],
      mustAvoid: ["style drift"],
      references: [{ referenceId: "hero_locked", source: "prompt_plan" }],
      outputPath: "real-provider-executor/project_1/batch_A/shots/S01/result.png",
    },
    submitPolicy: {
      dry_run_only: true,
      manual_submit_required: true,
      live_submit_forbidden: true,
    },
    forbiddenFallbacks: ["image2image_to_text2image", "provider_or_mode_fallback"],
    ...overrides,
  };
}

function pilot() {
  return {
    phase: "phase_43_real_provider_pilot",
    status: "review_ready",
    projectId: "project_1",
    batchId: "batch_A",
    selectedShotIds: ["S01"],
    selectedTaskPlanIds: ["image_task_plan_S01"],
    warnings: [],
    providerPlan: {
      providerId: "openai-image2-api",
      adapterId: "image2-adapter-v1",
      providerSlot: "image.edit",
      requiredMode: "image2image",
      executionState: "active",
      status: "image2_first_review_candidate",
      image2FirstEligible: true,
      seedanceParked: false,
      blockers: [],
      warnings: [],
    },
    parkedFutureProviderPlans: [
      {
        providerId: "seedance2-provider",
        adapterId: "seedance-parked",
        providerSlot: "video.i2v",
        requiredMode: "frames2video",
        executionState: "parked",
        status: "parked_future",
        image2FirstEligible: false,
        seedanceParked: true,
        blockers: ["Seedance/video provider is parked."],
        warnings: [],
      },
    ],
    scopeSummary: {
      projectId: "project_1",
      selectedShotCount: 1,
      estimatedImageCount: 2,
      outputSandboxRoot: sandbox().root,
      providerSlot: "image.edit",
      providerId: "openai-image2-api",
      adapterId: "image2-adapter-v1",
      image2FirstOnly: true,
      seedanceParkedForFuture: true,
      maxBatchSize: 3,
      reviewReadyOnly: true,
    },
    expectedOutputPlan: {
      sandboxRoot: sandbox().root,
      estimatedImageCount: 2,
      outputs: [
        {
          shotId: "S01",
          role: "image",
          suggestedRelativePath: "shots/S01/result.png",
          suggestedSandboxPath: "real-provider-executor/project_1/batch_A/shots/S01/result.png",
          source: "image_task_plan",
          noFileMutation: true,
        },
      ],
      noFileMutation: true,
    },
    manifestPlan: {
      manifestPath: sandbox().manifestPath,
      entryCount: 1,
      entries: [{ shotId: "S01", expectedOutputs: ["real-provider-executor/project_1/batch_A/shots/S01/result.png"], status: "planned_for_review" }],
      writeAllowed: false,
      noFileMutation: true,
    },
    watcherLinkPlan: {
      sandboxRoot: sandbox().root,
      watchGlobs: [`${sandbox().root}/shots/**/*.png`, `${sandbox().root}/manifest.json`, `${sandbox().root}/qa/**/*.json`],
      manifestPath: sandbox().manifestPath,
      qaReportPath: sandbox().qaReportPath,
      linkedForFutureReview: true,
      watcherStarted: false,
      noFileMutation: true,
    },
  };
}

function ledger(status = "ready_for_scoped_review") {
  return {
    phase: "scoped_real_execution_ledger",
    ledgerId: "execution_ledger_project_1_batch_A",
    status,
    projectId: "project_1",
    batchId: "batch_A",
    selectedShotIds: ["S01"],
    selectedTaskPlanIds: ["image_task_plan_S01"],
    outputSandbox: sandbox(),
    entries: [
      {
        ledgerEntryId: "ledger_entry_S01",
        taskPlanId: "image_task_plan_S01",
        jobId: "job_S01",
        shotId: "S01",
        expectedOutputs: ["real-provider-executor/project_1/batch_A/shots/S01/result.png"],
        status,
      },
    ],
  };
}

function realGate(status = "ready_for_scoped_real_test_review") {
  return {
    phase: "scoped_real_execution_gate",
    status,
    projectId: "project_1",
    batchId: "batch_A",
    selectedShotIds: ["S01"],
    selectedTaskPlanIds: ["image_task_plan_S01"],
    outputSandbox: sandbox(),
    items: [],
  };
}

function handoff(confirmed = false) {
  return {
    phase: "phase_33_provider_execution_handoff",
    summary: {
      userConfirmedAtActionTimeObserved: confirmed,
    },
  };
}

const { buildRealProviderExecutorState, realProviderExecutorHardLocks } = await loadModule(
  "src/core/realProviderExecutor.ts",
  "realProviderExecutor.mjs",
);

const generatedAt = "2026-05-02T00:00:00.000Z";
const readyInput = {
  generatedAt,
  mode: "executor_review",
  realProviderPilot: pilot(),
  realExecutionGate: realGate(),
  executionLedger: ledger(),
  providerExecutionHandoff: handoff(false),
  imageTaskPlans: [taskPlan()],
  image2AdapterRequests: [image2Request()],
};
const readyState = buildRealProviderExecutorState(readyInput);

assert(readyState.schemaVersion === "0.1.0", "schema version drifted");
assert(readyState.phase === "phase_44_real_provider_executor_shell", "phase drifted");
assert(readyState.status === "review_ready", "ready facts should produce review-ready shell state");
assert(readyState.executor.readyForUserReviewOnly === true, "review_ready must be user-review only");
assert(readyState.executor.executorEnabled === false, "executor must remain disabled");
assert(readyState.executor.actualExecutionAllowed === false, "actual execution must remain disabled");
assert(readyState.executor.providerSubmitAllowed === 0, "provider submit count must stay zero");
assert(readyState.providerSubmitAllowed === false, "top-level provider submit flag must stay false");
assert(readyState.liveSubmitAllowed === false, "live submit must stay false");
assert(readyState.credentialAccessAllowed === false, "credential access must stay false");
assert(readyState.canSpawnWorker === false, "worker route must stay closed");
assert(readyState.noFileMutation === true, "file mutation must be locked");
assert(readyState.automaticRetryAllowed === false, "automatic retry must be disabled");
assert(readyState.budgetGuard.status === "passed", "ready budget should pass");
assert(readyState.budgetGuard.estimatedImageCount === 2, "image count should derive from pilot");
assert(readyState.budgetGuard.maxImagesPerPilot === 3, "max images should default to 3");
assert(readyState.budgetGuard.selectedShotCount === 1, "selected shot count should be one");
assert(readyState.quotaConcurrencyRetryPolicy.concurrencyPolicy.maxConcurrency === 1, "max concurrency must be one");
assert(readyState.quotaConcurrencyRetryPolicy.concurrencyPolicy.activeProviderRequestsAllowed === 0, "active provider requests must be zero");
assert(readyState.quotaConcurrencyRetryPolicy.retryPolicy.maxAutoRetries === 0, "auto retries must be zero");
assert(readyState.quotaConcurrencyRetryPolicy.retryPolicy.automaticRetryAllowed === false, "automatic retry policy must be false");
assert(readyState.actionTimeConfirmationChecklist.some((item) => item.confirmationId === "action_time_user_confirmation" && item.present === false), "missing action-time confirmation should be visible");
assert(readyState.actionTimeConfirmationChecklist.every((item) => item.satisfied === false), "checklist must remain unsatisfied in Phase 44");
assert(readyState.oneShotReadiness.status === "reviewable_not_executable", "one-shot should be reviewable only");
assert(readyState.oneShotReadiness.reviewable === true, "one-shot should be reviewable");
assert(readyState.oneShotReadiness.executable === false, "one-shot must not be executable");
assert(readyState.oneShotReadiness.confirmationSatisfied === false, "one-shot confirmation must be unsatisfied");

const preview = readyState.providerRequestPreviews[0];
assert(preview.status === "preview_ready", "Image2 preview should be ready for review");
assert(preview.submitPolicy.dry_run_only === true, "preview must be dry-run only");
assert(preview.submitPolicy.manual_submit_required === true, "preview must require manual submit");
assert(preview.submitPolicy.live_submit_forbidden === true, "preview must forbid live submit");
assert(preview.fallbackPolicy.noProviderOrModeFallback === true, "preview must inherit no fallback");
assert(preview.fallbackPolicy.inheritedForbiddenFallbacks.includes("provider_or_mode_fallback"), "provider fallback ban missing");
assert(preview.canSubmitProvider === false, "preview must not submit");
assert(preview.providerSubmitAllowed === 0, "preview submit count must be zero");
assert(preview.liveSubmitAllowed === false, "preview live submit must be false");
assert(preview.credentialAccessAllowed === false, "preview credentials must be false");
assert(preview.canSpawnWorker === false, "preview worker route must stay closed");
assert(preview.noFileMutation === true, "preview file mutation must be locked");

assert(readyState.parkedProviderPreviews.some((item) => item.providerId === "seedance2-provider" && item.status === "parked"), "Seedance parked preview missing");
assert(readyState.outputWatcherBridgePlan.expectedOutputs.length >= 1, "watcher bridge should record expected outputs");
assert(readyState.outputWatcherBridgePlan.manifestPath === sandbox().manifestPath, "manifest bridge path missing");
assert(readyState.outputWatcherBridgePlan.qaReportPath === sandbox().qaReportPath, "QA bridge path missing");
assert(readyState.outputWatcherBridgePlan.watchGlobs.includes(`${sandbox().root}/shots/**/*.png`), "watch glob missing");
assert(readyState.outputWatcherBridgePlan.watcherStarted === false, "watcher must not start");
assert(readyState.outputWatcherBridgePlan.daemonStarted === false, "daemon must not start");
assert(readyState.outputWatcherBridgePlan.noFileMutation === true, "watcher bridge must not mutate files");
assert(readyState.outputWatcherBridgePlan.fileMutationAllowed === false, "watcher bridge file mutation flag must be false");
assert(readyState.outputWatcherBridgePlan.autoPromoteAllowed === false, "watcher bridge must not auto-promote");
assert(readyState.outputWatcherBridgePlan.promotionAllowed === false, "watcher bridge must not promote");

for (const key of [
  "defaultLocked",
  "noWorkerSpawn",
  "noSubprocess",
  "noShellExecution",
  "noFileMutation",
  "dryRunOnly",
  "manualSubmitRequired",
  "liveSubmitForbidden",
  "requestPreviewOnly",
  "outputWatcherPlanOnly",
  "seedanceParked",
  "videoProvidersParked",
]) {
  assert(readyState.hardLocks[key] === true, `${key} hard lock must be true`);
  assert(realProviderExecutorHardLocks[key] === true, `${key} exported hard lock must be true`);
}

for (const key of [
  "executorEnabled",
  "actualExecutionAllowed",
  "canExecute",
  "canSubmitProvider",
  "providerSubmitAllowedBoolean",
  "liveSubmitAllowed",
  "credentialAccessAllowed",
  "credentialReadAllowed",
  "credentialWriteAllowed",
  "canSpawnWorker",
  "canMutateFiles",
  "automaticRetryAllowed",
  "autoPromoteAllowed",
]) {
  assert(readyState.hardLocks[key] === false, `${key} hard lock must be false`);
  assert(realProviderExecutorHardLocks[key] === false, `${key} exported hard lock must be false`);
}
assert(readyState.hardLocks.providerSubmitAllowed === 0, "provider submit hard lock must be zero");
assert(readyState.hardLocks.maxConcurrency === 1, "max concurrency hard lock must be one");
assert(readyState.hardLocks.maxAutoRetries === 0, "max auto retry hard lock must be zero");
assert(readyState.forbiddenActions.includes("provider_submit"), "provider submit forbidden action missing");
assert(readyState.forbiddenActions.includes("credential_read"), "credential read forbidden action missing");
assert(readyState.forbiddenActions.includes("image2_execution"), "Image2 execution forbidden action missing");
assert(readyState.forbiddenActions.includes("seedance_execution"), "Seedance execution forbidden action missing");
assert(readyState.forbiddenActions.includes("output_watcher_daemon"), "watcher daemon forbidden action missing");

const missingPilot = buildRealProviderExecutorState({
  ...readyInput,
  realProviderPilot: undefined,
});
assert(missingPilot.status === "blocked", "missing pilot must block");
assert(missingPilot.blockers.some((blocker) => /Real Provider Pilot state is required/.test(blocker)), "missing pilot blocker missing");

const budgetTooHigh = buildRealProviderExecutorState({
  ...readyInput,
  estimatedImageCount: 4,
  maxImagesPerPilot: 3,
});
assert(budgetTooHigh.status === "blocked", "budget too high must block");
assert(budgetTooHigh.budgetGuard.status === "blocked", "budget guard should block high image count");
assert(
  budgetTooHigh.budgetGuard.checks.some((item) => item.checkId === "estimated_images_within_pilot_cap" && item.passed === false),
  "estimated image cap check should fail",
);

const tooManyShots = buildRealProviderExecutorState({
  ...readyInput,
  selectedShotIds: ["S01", "S02", "S03", "S04"],
  estimatedImageCount: 2,
});
assert(tooManyShots.status === "blocked", "too many selected shots must block");
assert(
  tooManyShots.budgetGuard.checks.some((item) => item.checkId === "selected_shot_count_lte_3" && item.passed === false),
  "selected shot cap check should fail",
);

const videoTask = taskPlan({
  taskPlanId: "video_task_plan_S01",
  providerSlot: "video.i2v",
  requiredMode: "frames2video",
  providerId: "seedance2-provider",
  mode: "frames2video",
});
const videoBlocked = buildRealProviderExecutorState({
  ...readyInput,
  imageTaskPlans: [videoTask],
  image2AdapterRequests: [
    image2Request({
      taskPlanId: "video_task_plan_S01",
      operation: "text2image",
    }),
  ],
});
assert(videoBlocked.status === "blocked", "Seedance/video path must block");
assert(videoBlocked.providerRequestPreviews[0].status === "parked", "video request preview should be parked");
assert(videoBlocked.parkedProviderPreviews.some((item) => item.status === "parked"), "parked video preview missing");
assert(videoBlocked.blockers.some((blocker) => /Seedance|video/i.test(blocker)), "Seedance/video blocker missing");

const unsafePreview = buildRealProviderExecutorState({
  ...readyInput,
  image2AdapterRequests: [
    image2Request({
      submitPolicy: {
        dry_run_only: true,
        manual_submit_required: true,
        live_submit_forbidden: false,
      },
    }),
  ],
});
assert(unsafePreview.status === "blocked", "unsafe request preview must block");
assert(unsafePreview.providerRequestPreviews[0].status === "blocked", "unsafe preview should be blocked");
assert(unsafePreview.providerRequestPreviews[0].canSubmitProvider === false, "blocked preview still cannot submit");
assert(unsafePreview.providerRequestPreviews[0].liveSubmitAllowed === false, "blocked preview still cannot live submit");

const confirmationObserved = buildRealProviderExecutorState({
  ...readyInput,
  providerExecutionHandoff: handoff(true),
});
assert(confirmationObserved.status === "review_ready", "observed confirmation should not become execution permission");
assert(confirmationObserved.actionTimeConfirmationChecklist.every((item) => item.satisfied === false), "observed confirmation must still be unsatisfied");
assert(confirmationObserved.actualExecutionAllowed === false, "confirmation observed must keep execution disabled");
assert(confirmationObserved.executorEnabled === false, "confirmation observed must keep executor disabled");

const source = fs.readFileSync("src/core/realProviderExecutor.ts", "utf8");
for (const forbiddenCode of ["fetch(", "spawn(", "exec(", "writeFile", "readFile", "process.env"]) {
  assert(!source.includes(forbiddenCode), `realProviderExecutor source must not contain ${forbiddenCode}`);
}

const schema = readJson("schemas/real_provider_executor.schema.json");
assert(schema.title === "RealProviderExecutorState", "schema title drifted");
assert(schema.properties.phase.const === "phase_44_real_provider_executor_shell", "schema phase drifted");
assert(schema.properties.executorEnabled.const === false, "schema must pin executorEnabled=false");
assert(schema.properties.actualExecutionAllowed.const === false, "schema must pin actualExecutionAllowed=false");
assert(schema.properties.providerSubmitAllowed.const === false, "schema must pin providerSubmitAllowed=false");
assert(schema.properties.liveSubmitAllowed.const === false, "schema must pin liveSubmitAllowed=false");
assert(schema.properties.credentialAccessAllowed.const === false, "schema must pin credentialAccessAllowed=false");
assert(schema.properties.canSpawnWorker.const === false, "schema must pin canSpawnWorker=false");
assert(schema.properties.noFileMutation.const === true, "schema must pin noFileMutation=true");
assert(schema.properties.automaticRetryAllowed.const === false, "schema must pin automaticRetryAllowed=false");
assert(schema.properties.dryRunOnly.const === true, "schema must pin dryRunOnly=true");
assert(schema.$defs.hardLocks.properties.executorEnabled.const === false, "schema hard lock must pin executor disabled");
assert(schema.$defs.hardLocks.properties.actualExecutionAllowed.const === false, "schema hard lock must pin actual execution false");
assert(schema.$defs.hardLocks.properties.providerSubmitAllowed.const === 0, "schema hard lock must pin submit count zero");
assert(schema.$defs.hardLocks.properties.providerSubmitAllowedBoolean.const === false, "schema hard lock must pin submit false");
assert(schema.$defs.hardLocks.properties.maxConcurrency.const === 1, "schema hard lock must pin concurrency one");
assert(schema.$defs.hardLocks.properties.maxAutoRetries.const === 0, "schema hard lock must pin retries zero");
assert(schema.$defs.outputWatcherBridgePlan.properties.watcherStarted.const === false, "schema watcher must not start");
assert(schema.$defs.outputWatcherBridgePlan.properties.daemonStarted.const === false, "schema daemon must not start");
assert(schema.$defs.outputWatcherBridgePlan.properties.noFileMutation.const === true, "schema watcher no mutation missing");
assert(schema.$defs.outputWatcherBridgePlan.properties.autoPromoteAllowed.const === false, "schema must forbid auto promote");

console.log("real-provider-executor tests passed");
