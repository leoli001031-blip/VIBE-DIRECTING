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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-real-provider-one-shot-"));
  const outPath = path.join(tmpDir, exportPath);
  fs.writeFileSync(outPath, output.outputText, "utf8");
  return import(pathToFileURL(outPath).href);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function executor(overrides = {}) {
  const root = "real-provider-executor/project_1/batch_A";
  return {
    phase: "phase_44_real_provider_executor_shell",
    mode: "executor_review",
    status: "review_ready",
    selectedShotIds: ["S01"],
    selectedTaskPlanIds: ["image_task_plan_S01"],
    oneShotReadiness: {
      status: "reviewable_not_executable",
      selectedShotCount: 1,
      estimatedImageCount: 2,
      confirmationSatisfied: false,
      reviewable: true,
      executable: false,
      actualExecutionAllowed: false,
      providerSubmitAllowed: 0,
      blockers: [],
      notes: [],
    },
    budgetGuard: {
      status: "passed",
      estimatedImageCount: 2,
      maxImagesPerPilot: 3,
      selectedShotCount: 1,
      selectedShotIds: ["S01"],
      selectedTaskPlanCount: 1,
      checks: [],
      blockers: [],
      reviewOnly: true,
      actualExecutionAllowed: false,
    },
    providerRequestPreviews: [
      {
        previewId: "preview_S01",
        sourceRequestId: "image2_request_S01",
        taskPlanId: "image_task_plan_S01",
        jobId: "job_S01",
        shotId: "S01",
        providerId: "openai-image2-api",
        providerSlot: "image.edit",
        requiredMode: "image2image",
        adapterId: "openai-image2-api-dry-run",
        operation: "image2image",
        outputPath: `${root}/shots/S01/result.png`,
        status: "preview_ready",
        blockers: [],
        warnings: [],
        submitPolicy: {
          dry_run_only: true,
          manual_submit_required: true,
          live_submit_forbidden: true,
        },
        fallbackPolicy: {
          noProviderOrModeFallback: true,
          inheritedForbiddenFallbacks: ["provider_or_mode_fallback", "image2image_to_text2image"],
        },
        dryRunOnly: true,
        manualSubmitRequired: true,
        liveSubmitAllowed: false,
        liveSubmitForbidden: true,
        canSubmitProvider: false,
        providerSubmitAllowed: 0,
        credentialAccessAllowed: false,
        canSpawnWorker: false,
        noFileMutation: true,
      },
    ],
    outputWatcherBridgePlan: {
      sandboxRoot: root,
      expectedOutputs: [
        {
          shotId: "S01",
          role: "image",
          path: `${root}/shots/S01/result.png`,
          source: "image2_request",
        },
      ],
      manifestPath: `${root}/manifest.json`,
      qaReportPath: `${root}/qa/qa-report.json`,
      watchGlobs: [`${root}/shots/**/*.png`, `${root}/manifest.json`, `${root}/qa/**/*.json`],
      watcherStarted: false,
      daemonStarted: false,
      noFileMutation: true,
      fileMutationAllowed: false,
      autoPromoteAllowed: false,
      promotionAllowed: false,
      planOnly: true,
    },
    summary: {
      actualExecutionAllowed: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      workerSpawnsAllowed: 0,
      fileMutationsAllowed: 0,
      automaticRetryAllowed: false,
      maxConcurrency: 1,
      maxAutoRetries: 0,
    },
    warnings: [],
    ...overrides,
  };
}

const { buildRealProviderOneShotTestState, realProviderOneShotTestHardLocks } = await loadModule(
  "src/core/realProviderOneShotTest.ts",
  "realProviderOneShotTest.mjs",
);

const generatedAt = "2026-05-02T00:00:00.000Z";
const readyState = buildRealProviderOneShotTestState({
  generatedAt,
  mode: "one_shot_review",
  realProviderExecutor: executor(),
});

assert(readyState.schemaVersion === "0.1.0", "schema version drifted");
assert(readyState.phase === "phase_45_one_shot_live_test_gate", "phase drifted");
assert(readyState.status === "ready_for_action_time_confirmation", "ready executor should prepare action-time confirmation");
assert(readyState.summary.readyForActionTimeConfirmation === true, "summary must mark action-time confirmation readiness");
assert(readyState.actionReview.canAskUserForActionTimeConfirmation === true, "ready state may ask for action-time confirmation");
assert(readyState.actionReview.userConfirmedAtActionTime === false, "Phase45 state must not self-confirm");
assert(readyState.actionReview.confirmationReceiptPresent === false, "Phase45 state must not fabricate a confirmation receipt");
assert(readyState.plannedAction.providerId === "openai-image2-api", "planned action must keep Image2 provider");
assert(readyState.plannedAction.providerSlot === "image.edit", "planned action must keep image slot");
assert(readyState.plannedAction.requiredMode === "image2image", "planned action must keep Image2 mode");
assert(readyState.plannedAction.actualExecutionAllowed === false, "planned action must not allow execution");
assert(readyState.plannedAction.providerSubmitAllowed === 0, "planned action must not allow provider submit");
assert(readyState.plannedAction.liveSubmitAllowed === false, "planned action must not allow live submit");
assert(readyState.plannedAction.credentialAccessAllowed === false, "planned action must not allow credential access");
assert(readyState.plannedAction.canSpawnWorker === false, "planned action must not allow workers");
assert(readyState.plannedAction.noFileMutation === true, "planned action must not allow file mutation");
assert(readyState.outputWatcherExpectation.planOnly === true, "output watcher must stay plan-only");
assert(readyState.outputWatcherExpectation.watcherStarted === false, "watcher must not start");
assert(readyState.outputWatcherExpectation.daemonStarted === false, "daemon must not start");
assert(readyState.budgetSnapshot.estimatedImageCount === 2, "budget snapshot should carry image count");
assert(readyState.hardLocks.singleActionOnly === true, "hard locks must be single-action only");
assert(readyState.hardLocks.oneShotOnly === true, "hard locks must be one-shot only");
assert(readyState.hardLocks.image2Only === true, "hard locks must be Image2 only");
assert(readyState.hardLocks.seedanceParked === true, "Seedance must stay parked");
assert(readyState.summary.actualExecutionAllowed === false, "summary must not allow actual execution");
assert(readyState.summary.providerSubmitAllowed === 0, "summary provider submit allowance must be zero");
assert(readyState.summary.liveSubmitAllowed === false, "summary live submit must be false");
assert(readyState.summary.credentialAccessAllowed === false, "summary credential access must be false");
assert(readyState.summary.workerSpawnsAllowed === 0, "summary worker spawns must be zero");
assert(readyState.summary.fileMutationsAllowed === 0, "summary file mutations must be zero");

const lockedState = buildRealProviderOneShotTestState({
  generatedAt,
  realProviderExecutor: executor(),
});
assert(lockedState.status === "locked", "default state must stay locked");
assert(lockedState.actionReview.canAskUserForActionTimeConfirmation === false, "locked state must not ask for confirmation");

const missingExecutorState = buildRealProviderOneShotTestState({
  generatedAt,
  mode: "one_shot_review",
});
assert(missingExecutorState.status === "blocked", "missing executor must block");
assert(missingExecutorState.blockers.includes("Phase44 Real Provider Executor state is required."), "missing executor blocker missing");

const multiShotState = buildRealProviderOneShotTestState({
  generatedAt,
  mode: "one_shot_review",
  realProviderExecutor: executor({
    selectedShotIds: ["S01", "S02"],
    budgetGuard: {
      ...executor().budgetGuard,
      selectedShotCount: 2,
      selectedShotIds: ["S01", "S02"],
    },
  }),
});
assert(multiShotState.status === "blocked", "multi-shot state must block");
assert(multiShotState.blockers.includes("One-shot test requires exactly one selected shot."), "multi-shot blocker missing");

const blockedBudgetState = buildRealProviderOneShotTestState({
  generatedAt,
  mode: "one_shot_review",
  realProviderExecutor: executor({
    budgetGuard: {
      ...executor().budgetGuard,
      status: "blocked",
      estimatedImageCount: 4,
      blockers: ["Estimated image count exceeds the pilot cap."],
    },
  }),
});
assert(blockedBudgetState.status === "blocked", "blocked budget must block Phase45");
assert(blockedBudgetState.blockers.includes("Budget guard must pass before action-time confirmation."), "budget blocker missing");

const schema = readJson("schemas/real_provider_one_shot_test.schema.json");
assert(schema.$id === "https://vibecore.local/schemas/real_provider_one_shot_test.schema.json", "schema id drifted");
assert(schema.properties.phase.const === "phase_45_one_shot_live_test_gate", "schema phase drifted");
assert(schema.properties.forbiddenActions.items.enum.includes("provider_submit_without_action_confirmation"), "schema must forbid unconfirmed provider submit");
assert(schema.$defs.hardLocks.properties.actualExecutionAllowed.const === false, "schema must hard-lock actual execution");
assert(schema.$defs.hardLocks.properties.providerSubmitAllowed.const === 0, "schema must hard-lock provider submit");

for (const key of [
  "defaultLocked",
  "singleActionOnly",
  "oneShotOnly",
  "image2Only",
  "seedanceParked",
  "videoProvidersParked",
  "noSubprocess",
  "noShellExecution",
  "noFileMutation",
]) {
  assert(realProviderOneShotTestHardLocks[key] === true, `${key} hard lock must be true`);
}
for (const key of [
  "actualExecutionAllowed",
  "liveSubmitAllowed",
  "credentialAccessAllowed",
  "canSpawnWorker",
  "automaticRetryAllowed",
]) {
  assert(realProviderOneShotTestHardLocks[key] === false, `${key} hard lock must be false`);
}
assert(realProviderOneShotTestHardLocks.providerSubmitAllowed === 0, "providerSubmitAllowed hard lock must be zero");
assert(realProviderOneShotTestHardLocks.maxConcurrency === 1, "max concurrency hard lock must be one");
assert(realProviderOneShotTestHardLocks.maxAutoRetries === 0, "max auto retries hard lock must be zero");

const source = fs.readFileSync("src/core/realProviderOneShotTest.ts", "utf8");
for (const forbiddenCode of ["fetch(", "spawn(", "exec(", "writeFile", "readFile", "process.env"]) {
  assert(!source.includes(forbiddenCode), `realProviderOneShotTest source must not contain ${forbiddenCode}`);
}

console.log("real-provider-one-shot tests passed");
