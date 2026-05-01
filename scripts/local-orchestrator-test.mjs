import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadLocalOrchestrator() {
  const sourcePath = path.resolve("src/core/localOrchestrator.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      isolatedModules: true,
    },
    fileName: sourcePath,
  });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-local-orchestrator-"));
  const outPath = path.join(tmpDir, "localOrchestrator.mjs");
  fs.writeFileSync(outPath, output.outputText, "utf8");
  return import(pathToFileURL(outPath).href);
}

function taskPacket(index, overrides = {}) {
  const id = `image_task_plan_${String(index).padStart(2, "0")}`;
  return {
    packetId: `packet_${id}`,
    taskPlanId: id,
    jobId: `job_${String(index).padStart(2, "0")}`,
    shotId: `shot_${String(index).padStart(2, "0")}`,
    expectedOutputs: [`outputs/${id}.png`],
    queueOrder: index,
    sourceRefs: [`fixture:${id}`],
    ...overrides,
  };
}

const requiredStages = [
  "shot_spec",
  "visual_memory",
  "spatial_memory",
  "shot_layout",
  "style_capsule",
  "shot_prompt_plan",
  "provider_capability_check",
  "provider_request_preview",
  "candidate_output",
  "qa_gate",
];

function stages(status = "pass") {
  return requiredStages.map((stageId) => ({
    stageId,
    label: stageId,
    status,
    sourceRefs: [`source:${stageId}`],
    blockers: [],
    warnings: [],
  }));
}

function generationJob(taskPlanId, overrides = {}) {
  const index = taskPlanId.match(/(\d+)$/)?.[1] || "01";
  const expectedOutputPath = `outputs/${taskPlanId}.png`;
  return {
    harnessJobId: `generation_harness_${taskPlanId}`,
    jobId: `job_${index}`,
    shotId: `shot_${index}`,
    taskPlanId,
    promptPlanId: `prompt_${index}`,
    providerId: "openai-image2-api",
    providerSlot: "image.generate",
    requiredMode: "text2image",
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    forbiddenActions: [
      "live_submit",
      "provider_unlock",
      "prompt_bypass",
      "candidate_auto_promote",
      "semantic_postprocess_repair",
      "text_to_video_fallback",
    ],
    stages: stages(),
    providerRequestPreview: {
      outputPath: expectedOutputPath,
      dryRunOnly: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      liveSubmitForbidden: true,
      forbiddenFallbacks: ["provider_or_mode_fallback", "text_to_video_fallback"],
    },
    candidateOutput: {
      status: "missing",
      candidatePath: expectedOutputPath,
      formalPath: `outputs/formal/${taskPlanId}.png`,
      expectedOutputPath,
      outputExists: false,
      manifestStatus: "missing_expected_output",
      qaStatus: "unknown",
      canPromoteToFormal: false,
      formalPromotionRequiresExplicitQa: true,
      autoPromoteToFormal: false,
    },
    postprocessPolicy: {
      allowedLocalOperations: ["resize", "format_convert", "thumbnail_preview", "metadata_probe", "manifest_match"],
      semanticRepairAllowed: false,
      openCvSemanticRepairAllowed: false,
      localPostprocessCanChangeMeaning: false,
      localPostprocessCanPromoteFormal: false,
      notes: [],
    },
    blockers: [],
    warnings: [],
    nextAction: "Wait for expected output.",
    ...overrides,
  };
}

function generationHarness(jobs) {
  return {
    schemaVersion: "0.1.0",
    generatedAt: "2026-04-30T00:00:00.000Z",
    jobs,
    summary: {
      total: jobs.length,
      blocked: 0,
      waiting: jobs.filter((job) => job.candidateOutput.status === "missing").length,
      qaPending: jobs.filter((job) => job.candidateOutput.status === "qa_pending").length,
      formalReady: jobs.filter((job) => job.candidateOutput.status === "formal_ready").length,
      canPromoteToFormal: jobs.filter((job) => job.candidateOutput.canPromoteToFormal).length,
      liveSubmitAllowed: false,
    },
    forbiddenActions: [
      "live_submit",
      "provider_unlock",
      "prompt_bypass",
      "candidate_auto_promote",
      "semantic_postprocess_repair",
      "text_to_video_fallback",
    ],
    postprocessPolicy: {
      allowedLocalOperations: ["resize", "format_convert", "thumbnail_preview", "metadata_probe", "manifest_match"],
      semanticRepairAllowed: false,
      openCvSemanticRepairAllowed: false,
      localPostprocessCanChangeMeaning: false,
      localPostprocessCanPromoteFormal: false,
      notes: [],
    },
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [],
  };
}

function taskRun(taskId, overrides = {}) {
  return {
    taskId,
    localStatus: "ready_to_submit",
    providerStatus: "not_submitted",
    providerId: "openai-image2-api",
    retryCount: 0,
    stallTimeoutSeconds: 600,
    tempDirs: [],
    expectedOutputs: [`outputs/${taskId}.png`],
    actualOutputs: [],
    lastEventAt: "2026-04-30T00:00:00.000Z",
    ...overrides,
  };
}

const { buildLocalOrchestratorState, localOrchestratorHardLocks } = await loadLocalOrchestrator();

const twentyTaskState = buildLocalOrchestratorState({
  generatedAt: "2026-04-30T00:00:00.000Z",
  taskPackets: Array.from({ length: 20 }, (_, index) => taskPacket(index + 1)),
  options: { autoContinue: true, concurrency: 1 },
});

assert(twentyTaskState.schemaVersion === "0.1.0", "localOrchestrator schemaVersion drifted");
assert(twentyTaskState.summary.totalItems === 20, "20-task queue must produce 20 queue items");
assert(twentyTaskState.summary.ready === 1, "20-task queue should plan exactly one next-ready item");
assert(twentyTaskState.summary.waiting === 19, "20-task queue should keep later items waiting");
assert(twentyTaskState.autoContinuePlan.nextReadyQueueItemIds.length === 1, "auto-continue should expose one next-ready item");
assert(twentyTaskState.queue.every((item) => item.canExecute === false), "orchestrator queue items cannot execute");
assert(twentyTaskState.queue.every((item) => item.providerSubmissionForbidden === true), "queue items must forbid provider submission");
assert(twentyTaskState.queue.every((item) => item.liveSubmitAllowed === false), "queue items must keep liveSubmitAllowed=false");
assert(twentyTaskState.queue.every((item) => item.noFileMutation === true), "queue items must keep noFileMutation=true");

const completeJob = generationJob("image_task_plan_01", {
  candidateOutput: {
    status: "formal_ready",
    candidatePath: "outputs/image_task_plan_01.png",
    formalPath: "outputs/formal/image_task_plan_01.png",
    expectedOutputPath: "outputs/image_task_plan_01.png",
    outputExists: true,
    manifestStatus: "matched",
    qaStatus: "pass",
    promotionStatus: "ready_for_promotion",
    canPromoteToFormal: true,
    formalPromotionRequiresExplicitQa: true,
    autoPromoteToFormal: false,
  },
});
const autoContinueState = buildLocalOrchestratorState({
  generatedAt: "2026-04-30T00:00:00.000Z",
  taskPackets: [taskPacket(1), taskPacket(2), taskPacket(3)],
  generationHarness: generationHarness([completeJob]),
  options: { autoContinue: true, concurrency: 1 },
});
const first = autoContinueState.queue.find((item) => item.taskPlanId === "image_task_plan_01");
const second = autoContinueState.queue.find((item) => item.taskPlanId === "image_task_plan_02");
const third = autoContinueState.queue.find((item) => item.taskPlanId === "image_task_plan_03");
assert(first?.queueStatus === "complete_verified", "verified task must become complete_verified");
assert(second?.queueStatus === "ready", "next task should become ready after verified task");
assert(second?.autoContinue.plannedAfterTaskId === first.queueItemId, "ready item should record the verified predecessor");
assert(third?.queueStatus === "waiting", "third task should still wait for queue position");
assert(autoContinueState.autoContinuePlan.transitions.length === 1, "auto-continue should record a planned transition");
assert(autoContinueState.autoContinuePlan.transitions[0].afterQueueItemId === first.queueItemId, "transition must start after verified task");
assert(autoContinueState.autoContinuePlan.transitions[0].plannedReadyQueueItemId === second.queueItemId, "transition must target next ready task");

const stalledState = buildLocalOrchestratorState({
  generatedAt: "2026-04-30T01:00:00.000Z",
  taskPackets: [taskPacket(7)],
  taskRuns: [
    taskRun("image_task_plan_07", {
      localStatus: "generating",
      providerStatus: "generating",
      retryCount: 2,
      codexSessionId: "codex_stalled_session",
      lastEventAt: "2026-04-30T00:00:00.000Z",
      stallTimeoutSeconds: 300,
    }),
  ],
  options: { retryBudget: 2, stallTimeoutSeconds: 300, now: "2026-04-30T01:00:00.000Z" },
});
const stalledItem = stalledState.queue[0];
assert(stalledItem.queueStatus === "needs_review", "stalled task should require review");
assert(stalledItem.codexActivity.stalled === true, "stalled task must expose stalled=true");
assert(stalledItem.codexActivity.retryBudget === 2, "retry budget must be recorded");
assert(stalledItem.codexActivity.retriesRemaining === 0, "exhausted retry budget must be recorded");
assert(stalledItem.codexActivity.manualReviewRequired === true, "stalled task must require manual review");
assert(stalledItem.codexActivity.stallDetectedBy.includes("timeout"), "stalled task should include timeout evidence");

const selfReportState = buildLocalOrchestratorState({
  generatedAt: "2026-04-30T00:00:00.000Z",
  taskPackets: [taskPacket(8)],
  taskRuns: [
    taskRun("image_task_plan_08", {
      localStatus: "succeeded",
      providerStatus: "success",
      actualOutputs: ["outputs/image_task_plan_08.png"],
    }),
  ],
});
const selfReportItem = selfReportState.queue[0];
assert(selfReportItem.queueStatus === "needs_review", "worker self-report alone cannot complete a task");
assert(selfReportItem.completionGate.workerSelfReportPresent === true, "self-report presence must be recorded");
assert(selfReportItem.completionGate.workerSelfReportOnly === true, "self-report-only condition must be explicit");
assert(selfReportItem.completionGate.completeVerified === false, "self-report-only condition must not be complete_verified");
assert(selfReportState.summary.workerSelfReportOnly === 1, "summary must count self-report-only tasks");

const qaMissingJob = generationJob("image_task_plan_09", {
  candidateOutput: {
    status: "qa_pending",
    candidatePath: "outputs/image_task_plan_09.png",
    formalPath: "outputs/formal/image_task_plan_09.png",
    expectedOutputPath: "outputs/image_task_plan_09.png",
    outputExists: true,
    manifestStatus: "matched",
    qaStatus: "missing",
    promotionStatus: "qa_pending",
    canPromoteToFormal: false,
    formalPromotionRequiresExplicitQa: true,
    autoPromoteToFormal: false,
  },
});
const qaMissingState = buildLocalOrchestratorState({
  generatedAt: "2026-04-30T00:00:00.000Z",
  taskPackets: [taskPacket(9)],
  generationHarness: generationHarness([qaMissingJob]),
});
const qaMissingItem = qaMissingState.queue[0];
assert(qaMissingItem.queueStatus === "qa_pending", "missing QA should hold the task in qa_pending");
assert(qaMissingItem.completionGate.expectedOutputObserved === true, "QA-missing fixture should have expected output");
assert(qaMissingItem.completionGate.manifestMatched === true, "QA-missing fixture should have manifest match");
assert(qaMissingItem.completionGate.qaPass === false, "missing QA must not pass");
assert(qaMissingItem.completionGate.completeVerified === false, "missing QA must block complete_verified");
assert(
  qaMissingItem.completionGate.blockers.includes("Explicit QA pass is missing."),
  "completion gate must explain missing QA",
);

const coverageGapState = buildLocalOrchestratorState({
  generatedAt: "2026-04-30T00:00:00.000Z",
  subagentRunner: {
    slots: [],
    coverage: [
      {
        taskKind: "start_frame",
        expected: true,
        totalSlots: 0,
        planned: 0,
        plannedMissingEnvelope: 0,
        blockedMissingEnvelope: 0,
        blockedContractViolation: 0,
        sourceRefs: [],
        notes: ["Coverage gap: no current start_frame SubagentTaskEnvelope packet or planned slot was inferred."],
      },
      {
        taskKind: "identity_qa",
        expected: true,
        totalSlots: 1,
        planned: 0,
        plannedMissingEnvelope: 1,
        blockedMissingEnvelope: 0,
        blockedContractViolation: 0,
        sourceRefs: ["qaHarness:identity"],
        notes: ["Coverage gap: identity_qa has no validated envelope yet."],
      },
    ],
  },
});
assert(
  coverageGapState.notes.some((note) => note.includes("Subagent coverage gap: no start_frame slot")),
  "orchestrator notes must expose missing task-kind coverage",
);
assert(
  coverageGapState.notes.some((note) => note.includes("identity_qa has no validated planned envelope")),
  "orchestrator notes must expose missing validated envelope coverage",
);

for (const state of [twentyTaskState, autoContinueState, stalledState, selfReportState, qaMissingState, coverageGapState]) {
  assert(state.dryRunOnly === true, "orchestrator must be dry-run only");
  assert(state.planOnly === true, "orchestrator must be plan-only");
  assert(state.providerSubmissionForbidden === true, "orchestrator must forbid provider submission");
  assert(state.liveSubmitAllowed === false, "orchestrator liveSubmitAllowed must be false");
  assert(state.noFileMutation === true, "orchestrator must forbid file mutation");
  assert(state.daemonStarted === false, "orchestrator must not start a daemon");
  assert(state.hardLocks.noDaemon === true, "hard lock noDaemon must be true");
  assert(state.hardLocks.daemonStarted === false, "hard lock daemonStarted must be false");
  assert(state.hardLocks.noSpawnCodex === true, "hard lock noSpawnCodex must be true");
  assert(state.hardLocks.noShellExecution === true, "hard lock noShellExecution must be true");
  assert(state.hardLocks.noProviderExecution === true, "hard lock noProviderExecution must be true");
  assert(state.hardLocks.providerSubmissionForbidden === true, "hard lock providerSubmissionForbidden must be true");
  assert(state.hardLocks.liveSubmitAllowed === false, "hard lock liveSubmitAllowed must be false");
  assert(state.hardLocks.noFileMutation === true, "hard lock noFileMutation must be true");
  assert(state.hardLocks.workerSelfReportCannotComplete === true, "hard lock workerSelfReportCannotComplete must be true");
}

assert(localOrchestratorHardLocks.noDaemon === true, "exported hard locks should pin noDaemon");
assert(localOrchestratorHardLocks.providerSubmissionForbidden === true, "exported hard locks should forbid provider submit");
assert(localOrchestratorHardLocks.liveSubmitAllowed === false, "exported hard locks should pin liveSubmitAllowed=false");
assert(
  qaMissingItem.factChain.some((entry) => entry.layer === "generation_harness") &&
    qaMissingItem.factChain.some((entry) => entry.layer === "local_orchestrator"),
  "fact chain should connect generation facts to the orchestrator completion gate",
);

const schema = readJson("schemas/local_orchestrator.schema.json");
assert(schema.title === "LocalOrchestratorState", "local orchestrator schema title drifted");
assert(schema.properties.dryRunOnly.const === true, "schema must pin dryRunOnly true");
assert(schema.properties.planOnly.const === true, "schema must pin planOnly true");
assert(schema.properties.providerSubmissionForbidden.const === true, "schema must pin providerSubmissionForbidden true");
assert(schema.properties.liveSubmitAllowed.const === false, "schema must pin liveSubmitAllowed false");
assert(schema.properties.noFileMutation.const === true, "schema must pin noFileMutation true");
assert(schema.properties.daemonStarted.const === false, "schema must pin daemonStarted false");
assert(schema.$defs.hardLocks.properties.noDaemon.const === true, "schema must pin noDaemon true");
assert(schema.$defs.hardLocks.properties.noSpawnCodex.const === true, "schema must pin noSpawnCodex true");
assert(schema.$defs.hardLocks.properties.noShellExecution.const === true, "schema must pin noShellExecution true");
assert(schema.$defs.hardLocks.properties.workerSelfReportCannotComplete.const === true, "schema must pin worker self-report lock");
assert(schema.$defs.queueStatus.enum.includes("complete_verified"), "schema must include complete_verified queue status");
assert(schema.$defs.queueStatus.enum.includes("qa_pending"), "schema must include qa_pending queue status");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("local_orchestrator.schema.json"), "schema registry must include local_orchestrator.schema.json");
assert(registrySource.includes("LocalOrchestratorState"), "schema registry must include LocalOrchestratorState");

const packageJson = readJson("package.json");
assert(packageJson.scripts["orchestrator:test"] === "node scripts/local-orchestrator-test.mjs", "package.json must expose orchestrator:test");

console.log(
  `Local orchestrator tests passed: ${twentyTaskState.summary.totalItems}-task queue, ${autoContinueState.autoContinuePlan.transitions.length} auto-continue transition, ${stalledState.summary.stalled} stalled task.`,
);
