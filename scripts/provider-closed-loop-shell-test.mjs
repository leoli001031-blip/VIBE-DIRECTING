import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function transpile(path) {
  return ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: path,
  }).outputText;
}

function dataUrl(path, output) {
  return `data:text/javascript;base64,${Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64")}`;
}

async function importProviderClosedLoopShell() {
  return import(dataUrl("src/core/providerClosedLoopShell.ts", transpile("src/core/providerClosedLoopShell.ts")));
}

const generatedAt = "2026-05-01T00:00:00.000Z";

function imageTaskPlan(overrides = {}) {
  return {
    taskPlanId: "image_task_plan_S01",
    jobId: "job_prompt_S01",
    shotId: "S01",
    promptPlanId: "prompt_plan_S01",
    providerSlot: "image.edit",
    requiredMode: "image2image",
    providerId: "openai-image2-api",
    mode: "image2image",
    status: "ready_for_manual_submit",
    expectedOutputPath: "outputs/images/S01.png",
    inputReferenceIds: ["asset_start_S01"],
    sourcePromptPlanHash: "prompt_hash_S01",
    sourceShotSpecHash: "shot_hash_S01",
    blockers: [],
    warnings: [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    ...overrides,
  };
}

function image2Request(taskPlan = imageTaskPlan(), overrides = {}) {
  return {
    requestId: `image2_request_${taskPlan.taskPlanId}`,
    taskPlanId: taskPlan.taskPlanId,
    adapterId: "openai-image2-api-dry-run",
    operation: "image2image",
    payload: {
      sourceIntent: ["keep composition and improve final frame"],
      mustPreserve: ["identity", "scene layout"],
      mustAvoid: ["new characters"],
      references: [{ referenceId: "asset_start_S01", source: "prompt_plan" }],
      outputPath: taskPlan.expectedOutputPath,
    },
    submitPolicy: {
      dry_run_only: true,
      manual_submit_required: true,
      live_submit_forbidden: true,
    },
    forbiddenFallbacks: ["image2image_to_text2image"],
    ...overrides,
  };
}

function watcherEvent(taskPlan = imageTaskPlan(), overrides = {}) {
  return {
    id: `watcher_expected_${taskPlan.taskPlanId}`,
    eventType: "expected_output_detected",
    taskId: taskPlan.taskPlanId,
    jobId: taskPlan.jobId,
    shotId: taskPlan.shotId,
    artifactPath: taskPlan.expectedOutputPath,
    expectedOutputPath: taskPlan.expectedOutputPath,
    status: "detected",
    severity: "info",
    createdAt: generatedAt,
    notes: ["Expected output exists."],
    ...overrides,
  };
}

function manifestReport(taskPlan = imageTaskPlan(), overrides = {}) {
  return {
    taskId: taskPlan.taskPlanId,
    status: "complete",
    expectedOutputCount: 1,
    presentOutputCount: 1,
    missingExpectedOutputs: [],
    actualOutputsPresent: [taskPlan.expectedOutputPath],
    recoverableOutputs: [],
    outputMatches: [
      {
        expectedPath: taskPlan.expectedOutputPath,
        status: "complete",
        actualPath: taskPlan.expectedOutputPath,
        recoverableCandidates: [],
        reason: "Expected output is present.",
      },
    ],
    ...overrides,
  };
}

function qaPromotionReport(taskPlan = imageTaskPlan(), overrides = {}) {
  return {
    reportId: `qa_promotion_${taskPlan.taskPlanId}`,
    taskPlanId: taskPlan.taskPlanId,
    jobId: taskPlan.jobId,
    shotId: taskPlan.shotId,
    candidatePath: taskPlan.expectedOutputPath,
    formalPath: "outputs/images/formal/S01.png",
    promotionStatus: "ready_for_promotion",
    requiredGates: {
      expectedOutput: true,
      manifestMatch: true,
      promptFresh: true,
      assetReadiness: true,
      qaPass: true,
    },
    blockers: [],
    warnings: [],
    canPromoteToFormal: true,
    ...overrides,
  };
}

function seedanceVideoPlan(overrides = {}) {
  return {
    taskPlanId: "video_task_plan_S01",
    jobId: "job_video_S01",
    shotId: "S01",
    readinessGateId: "video_readiness_S01",
    providerSlot: "video.i2v",
    requiredMode: "frames2video",
    providerId: "seedance2-provider",
    providerExecutionState: "parked",
    status: "parked",
    queueStatus: "parked",
    startFrameRef: { shotFrameId: "S01:start", path: "outputs/images/S01_start.png", present: true, source: "shot_record" },
    endFrameRef: { shotFrameId: "S01:end", path: "outputs/images/S01.png", present: true, source: "shot_record" },
    durationSeconds: null,
    durationPlaceholder: "derive_later",
    motionBrief: "Preserve shot function with restrained camera movement.",
    promptConstraints: ["no bgm", "start/end frames only", "no text-to-video fallback", "no fast model", "no VIP channel"],
    preflightFacts: { taskId: "task_video_S01", status: "pass", blockerCount: 0, warningCount: 0 },
    manifestFacts: {
      status: "not_available",
      expectedOutputs: ["outputs/videos/S01.mp4"],
      actualOutputs: [],
      missingExpectedOutput: true,
    },
    blockers: [],
    warnings: [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    fastModelForbidden: true,
    vipChannelForbidden: true,
    textToVideoForbidden: true,
    liveSubmitAllowed: false,
    ...overrides,
  };
}

function videoPlanning(overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    generatedAt,
    readinessGates: [],
    taskPlans: [seedanceVideoPlan()],
    queueShell: {},
    providerPolicySummary: {
      videoProvidersRemainParked: true,
      liveSubmitAllowed: false,
      userEnablementRequired: true,
      providerSubmissionForbidden: true,
      fastModelForbidden: true,
      vipChannelForbidden: true,
      textToVideoForbidden: true,
      parkedProviderIds: ["seedance2-provider", "jimeng-video"],
      notes: [],
    },
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    notes: [],
    ...overrides,
  };
}

function providerLiveGate(overrides = {}) {
  return {
    summary: {
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialStorage: false,
    },
    hardLocks: {
      providerSubmissionForbidden: true,
      fastModelForbidden: true,
      vipChannelForbidden: true,
      textToVideoMainPathForbidden: true,
      bgmInVideoPromptForbidden: true,
    },
    ...overrides,
  };
}

function readyInput(overrides = {}) {
  const taskPlan = imageTaskPlan();
  return {
    generatedAt,
    imageTaskPlans: [taskPlan],
    image2AdapterRequests: [image2Request(taskPlan)],
    videoPlanning: videoPlanning(),
    providerLiveGate: providerLiveGate(),
    watcherEvents: [watcherEvent(taskPlan)],
    manifestReports: [manifestReport(taskPlan)],
    qaPromotionReports: [qaPromotionReport(taskPlan)],
    ...overrides,
  };
}

function assertBlocked(state, reason) {
  assert(state.readiness === "blocked", `${reason}: state should block`);
  assert(state.validation.ok === false, `${reason}: validation should fail`);
  assert(state.blockers.some((blocker) => blocker.includes(reason)), `${reason}: blocker missing in ${state.blockers.join("; ")}`);
}

const schema = readJson("schemas/provider_closed_loop_shell.schema.json");
assert(schema.$id === "https://vibecore.local/schemas/provider_closed_loop_shell.schema.json", "schema id drifted");
assert(schema.title === "ProviderClosedLoopShellState", "schema title drifted");
assert(schema.properties.phaseId.const === "phase_41_provider_closed_loop_shell", "schema phase const missing");
assert(schema.$defs.providerCommitGate.properties.providerCommitDefaultGated.const === true, "schema must default provider commit gated");
assert(schema.$defs.providerCommitGate.properties.providerCommitAllowed.const === false, "schema must forbid provider commit");
assert(schema.$defs.providerCommitGate.properties.canSubmitProvider.const === false, "schema must pin canSubmitProvider=false");
assert(schema.$defs.providerCommitGate.properties.providerSubmitAllowed.const === 0, "schema must pin providerSubmitAllowed=0");
assert(schema.$defs.providerCommitGate.properties.liveSubmitAllowed.const === false, "schema must pin liveSubmitAllowed=false");
for (const stepId of ["provider_request_preview", "watcher_expected_output", "manifest_match", "qa_report_check", "promotion_gate"]) {
  assert(schema.$defs.closedLoopStep.properties.stepId.enum.includes(stepId), `schema closed-loop step missing ${stepId}`);
}

const projectRuntimeSchema = readJson("schemas/project_runtime_state.schema.json");
assert(projectRuntimeSchema.required.includes("providerClosedLoopShell"), "ProjectRuntimeState must require providerClosedLoopShell");
assert(
  projectRuntimeSchema.properties.providerClosedLoopShell.$ref === "provider_closed_loop_shell.schema.json",
  "ProjectRuntimeState must reference provider closed-loop shell schema",
);

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(
  registrySource.includes("provider_closed_loop_shell.schema.json") &&
    registrySource.includes("ProviderClosedLoopShellState"),
  "schema registry must include ProviderClosedLoopShellState",
);

const builderSource = fs.readFileSync("src/core/projectStateBuilder.ts", "utf8");
assert(builderSource.includes("buildProviderClosedLoopShellState"), "project state builder must default build providerClosedLoopShell");

const packageJson = readJson("package.json");
assert(
  packageJson.scripts["provider-closed-loop-shell:test"] === "node scripts/provider-closed-loop-shell-test.mjs",
  "package script provider-closed-loop-shell:test missing",
);

const source = fs.readFileSync("src/core/providerClosedLoopShell.ts", "utf8");
for (const [pattern, label] of [
  [/from\s+["']node:child_process["']|from\s+["']child_process["']/, "child_process import"],
  [/\bspawn\s*\(/, "spawn call"],
  [/\bexec(?:File)?\s*\(/, "exec call"],
  [/\bwriteFile(?:Sync)?\s*\(/, "writeFile call"],
  [/\bappendFile(?:Sync)?\s*\(/, "appendFile call"],
  [/\b(providerSubmit|submitProvider|liveSubmit)\s*\(/, "provider submit function"],
]) {
  assert(!pattern.test(source), `Phase 41 shell must not contain ${label}`);
}

const {
  buildProviderClosedLoopShellState,
  validateProviderClosedLoopShellHardLocks,
  providerClosedLoopShellHardLocks,
  providerClosedLoopShellPhaseId,
  providerClosedLoopShellSchemaVersion,
} = await importProviderClosedLoopShell();

const readyState = buildProviderClosedLoopShellState(readyInput());
assert(readyState.schemaVersion === providerClosedLoopShellSchemaVersion, "schema version drifted");
assert(readyState.phaseId === providerClosedLoopShellPhaseId, "phase id drifted");
assert(readyState.phaseId === "phase_41_provider_closed_loop_shell", "phase 41 id missing");
assert(readyState.readiness === "ready_gated_shell", `ready shell should be gated-ready: ${readyState.blockers.join("; ")}`);
assert(readyState.validation.ok === true, "ready shell should validate");
assert(readyState.contract.image2ShellRequired === true, "Image2 shell must be required");
assert(readyState.contract.seedanceShellRequired === true, "Seedance shell must be required");
assert(readyState.shells.image2.length === 1, "Image2 shell must be defined");
assert(readyState.shells.seedance.length === 1, "Seedance shell must be defined");
assert(readyState.shells.image2[0].status === "ready_gated_shell", "Image2 shell should be ready gated");
assert(readyState.shells.seedance[0].status === "parked_unsupported", "Seedance shell should remain parked");
assert(readyState.shells.jimeng.status === "parked_unsupported", "Jimeng summary should be parked/unsupported");
assert(readyState.shells.image2[0].closedLoopSteps.every((step) => step.status === "pass"), "Image2 closed-loop steps must pass");
assert(readyState.shells.image2[0].workerProviderSelfReportAccepted === false, "self-report must not be accepted");
assert(readyState.shells.image2[0].canCompleteFromSelfReport === false, "self-report cannot complete");
assert(readyState.providerCommitGate.providerCommitDefaultGated === true, "provider commit must default gated");
assert(readyState.providerCommitGate.providerCommitAllowed === false, "provider commit must be disallowed");
assert(readyState.providerCommitGate.canSubmitProvider === false, "canSubmitProvider must be false");
assert(readyState.providerCommitGate.providerSubmitAllowed === 0, "providerSubmitAllowed must be 0");
assert(readyState.providerCommitGate.liveSubmitAllowed === false, "live submit must be false");
assert(readyState.summary.providerCommitDefaultGated === true, "summary provider commit default gate missing");
assert(readyState.summary.providerCommitAllowed === false, "summary provider commit allowed drifted");
assert(readyState.proof.workerProviderSelfReportCannotComplete === true, "self-report proof missing");
assert(readyState.proof.providerRequestPreviewToPayloadShape === true, "request preview proof missing");
assert(validateProviderClosedLoopShellHardLocks(providerClosedLoopShellHardLocks).length === 0, "default hard locks must validate");

for (const [key, expected] of Object.entries({
  closedLoopShellOnly: true,
  dryRunOnly: true,
  readOnly: true,
  planOnly: true,
  providerSubmissionForbidden: true,
  noActualProviderSubmit: true,
  noLiveSubmit: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  credentialAccessAllowed: false,
  credentialStorage: false,
  noApiKeyCreation: true,
  noWorkerSpawn: true,
  noShellExecution: true,
  noFileMutation: true,
  fastModelForbidden: true,
  vipChannelForbidden: true,
  textToVideoMainPathForbidden: true,
  bgmInVideoPromptForbidden: true,
  workerSelfReportCannotComplete: true,
  expectedOutputRequired: true,
  watcherRequired: true,
  manifestRequired: true,
  qaGateRequired: true,
  promotionGateRequired: true,
})) {
  assert(readyState.hardLocks[key] === expected, `hard lock ${key} drifted`);
  assert(providerClosedLoopShellHardLocks[key] === expected, `exported hard lock ${key} drifted`);
  assert(schema.$defs.hardLocks.properties[key].const === expected, `schema hard lock ${key} const drifted`);
}

assertBlocked(buildProviderClosedLoopShellState(readyInput({ watcherEvents: [] })), "watcher_expected_output_required");
assertBlocked(buildProviderClosedLoopShellState(readyInput({ manifestReports: [] })), "manifest_report_required");
assertBlocked(buildProviderClosedLoopShellState(readyInput({ qaPromotionReports: [] })), "qa_report_required");
assertBlocked(
  buildProviderClosedLoopShellState(readyInput({ qaPromotionReports: [qaPromotionReport(imageTaskPlan(), { canPromoteToFormal: false, promotionStatus: "qa_pending" })] })),
  "promotion_gate_ready_required",
);
assertBlocked(buildProviderClosedLoopShellState(readyInput({ image2AdapterRequests: [] })), "provider_request_preview_required");

for (const [flag, reason] of [
  ["providerSubmitAttempted", "provider_submit_attempt_blocked"],
  ["liveSubmitAttempted", "live_submit_attempt_blocked"],
  ["credentialReadWriteAttempted", "credential_read_write_attempt_blocked"],
  ["apiKeyCreateAttempted", "api_key_create_attempt_blocked"],
  ["workerSpawnAttempted", "worker_spawn_attempt_blocked"],
  ["shellAttempted", "shell_attempt_blocked"],
  ["fileMutationAttempted", "file_mutation_attempt_blocked"],
  ["fastModelAttempted", "fast_model_attempt_blocked"],
  ["vipChannelAttempted", "vip_channel_attempt_blocked"],
  ["textToVideoAttempted", "text_to_video_main_path_attempt_blocked"],
  ["bgmInVideoPromptAttempted", "bgm_in_video_prompt_attempt_blocked"],
  ["providerCommitAttempted", "provider_commit_attempt_blocked"],
]) {
  assertBlocked(buildProviderClosedLoopShellState(readyInput({ [flag]: true })), reason);
}

assertBlocked(
  buildProviderClosedLoopShellState(readyInput({ hardLocksOverride: { noActualProviderSubmit: false } })),
  "provider_closed_loop_shell_hard_lock_drift:noActualProviderSubmit",
);
assertBlocked(
  buildProviderClosedLoopShellState(readyInput({ providerLiveGate: providerLiveGate({ summary: { providerSubmitAllowed: 1, liveSubmitAllowed: false, credentialStorage: false } }) })),
  "provider_live_gate_provider_submit_allowed_drift",
);

console.log(
  `provider-closed-loop-shell-test passed: readiness=${readyState.readiness}, shells=${readyState.summary.totalShellItems}, hardLocks=${Object.keys(readyState.hardLocks).length}.`,
);
