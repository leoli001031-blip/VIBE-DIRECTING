import fs from "node:fs";
import path from "node:path";

import { buildDirectorWorkflowState } from "../src/core/directorWorkflow.ts";
import {
  buildProjectStoreApplyPlanForStagedFacts,
  buildProjectStoreTypedValueMaterializationPreviewForStagedFacts,
  buildProjectStoreTypedValueSourcePreviewForStagedFacts,
  buildProjectTransactionRuntime,
  confirmProjectPendingTransactionForRuntime,
  stageProjectFactsForCommit,
} from "../src/core/projectTransaction.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectStrings(value, out = []) {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
  return out;
}

const generatedAt = "2026-05-05T00:00:00.000Z";

function shot(id, overrides = {}) {
  return {
    id,
    actId: "A1",
    sectionId: "section-1",
    title: `Shot ${id}`,
    storyFunction: `story beat ${id}`,
    startFrame: `outputs/keyframes/${id}_start.png`,
    endFrame: `outputs/keyframes/${id}_end.png`,
    status: "ready",
    gates: {
      identity: "PASS",
      scene: "PASS",
      pair: "PASS",
      story: "PASS",
      prop: "PASS",
      style: "PASS",
    },
    issues: [],
    ...overrides,
  };
}

function asset(id, type = "character", overrides = {}) {
  return {
    id,
    type,
    name: id,
    path: `visual_memory/${id}.png`,
    status: "exists",
    lockedStatus: "locked",
    safeForFutureReference: true,
    issues: [],
    ...overrides,
  };
}

function runtime() {
  return {
    schemaVersion: "0.1.0",
    coreStateVersion: "project-runtime-state/0.1.0",
    generatedAt,
    project: {
      title: "Portable Transaction Test",
      providerPolicy: { rules: [] },
    },
    sourceIndex: {
      sourceIndexHash: "source_hash_tx_123",
    },
    sourceIndexSummary: {
      projectId: "project_tx_fixture",
      projectVersion: "0.4.0",
      sourceIndexHash: "source_hash_tx_123",
    },
    storyFlow: {
      shots: [shot("A1_01"), shot("A1_02"), shot("A1_03")],
    },
    visualMemory: {
      assets: [
        asset("hero_locked", "character", { usedByShotIds: ["A1_02"] }),
        asset("garage_scene_locked", "scene", { usedByShotIds: ["A1_02"] }),
        asset("global_style_locked", "style"),
      ],
    },
    videoPlanning: {
      readinessGates: [
        {
          gateId: "video_gate_A1_02",
          shotId: "A1_02",
          keyframePairDerivation: {
            shotId: "A1_02",
            startFrameId: "outputs/keyframes/A1_02_start.png",
            endFrameId: "outputs/keyframes/A1_02_end.png",
            endDerivationSource: "start_frame",
            validForI2vPair: true,
            allowedDelta: ["motion", "camera movement"],
            mustPreserve: ["character identity", "scene layout"],
            mustNotAdd: ["new characters", "text-to-video fallback"],
          },
        },
      ],
      taskPlans: [
        {
          taskPlanId: "video_task_A1_02",
          shotId: "A1_02",
          manifestFacts: {
            expectedOutputs: ["outputs/videos/A1_02.mp4"],
          },
        },
      ],
    },
    imagePipeline: {},
    previewEvents: [],
    taskRuns: { jobs: [], runs: [] },
    diagnostics: { issues: [] },
  };
}

function hydrateKnowledge(workflowState) {
  const next = clone(workflowState);
  for (const packet of next.taskPacketState.packets) {
    if (!packet.envelope?.taskEnvelope) continue;
    const record = {
      packId: `pack_${packet.taskKind}`,
      version: "0.1.0",
      hash: `hash_${packet.taskKind}`,
      category: packet.taskKind === "audio" ? "audio" : packet.taskKind === "video_execution" ? "camera" : "storyflow",
      reason: `bounded route for ${packet.taskKind}`,
      consumer: "subagent_context",
      injectedSnippetIds: [`snippet_${packet.taskKind}`],
      summaryHash: `summary_${packet.taskKind}`,
      truncated: false,
    };
    const snippet = {
      packId: record.packId,
      snippetId: `snippet_${packet.taskKind}`,
      title: `Snippet ${packet.taskKind}`,
      content: `Bounded knowledge snippet for ${packet.taskKind}.`,
      tokenEstimate: 12,
      hash: `snippet_hash_${packet.taskKind}`,
    };
    packet.envelope.taskEnvelope.knowledgeRouteResultId = `route_${packet.taskKind}`;
    packet.envelope.taskEnvelope.contextBudgetId = `budget_${packet.taskKind}`;
    packet.envelope.taskEnvelope.injectedKnowledgePacks = [record];
    packet.envelope.taskEnvelope.injectedKnowledgeSnippetIds = [`${record.packId}:${snippet.snippetId}`];
    packet.envelope.taskEnvelope.injectedKnowledgeSnippets = [snippet];
    packet.envelope.taskEnvelope.knowledgeInputHash = `knowledge_input_${packet.taskKind}`;
    packet.envelope.taskEnvelope.knowledgeManifestHash = "knowledge_manifest_fixture";
    packet.envelope.knowledgeRouteResultId = packet.envelope.taskEnvelope.knowledgeRouteResultId;
    packet.envelope.contextBudgetId = packet.envelope.taskEnvelope.contextBudgetId;
    packet.envelope.injectedKnowledgePacks = [record];
    packet.envelope.injectedKnowledgeSnippetIds = packet.envelope.taskEnvelope.injectedKnowledgeSnippetIds;
    packet.envelope.injectedKnowledgeSnippets = [snippet];
    packet.envelope.knowledgeInputHash = packet.envelope.taskEnvelope.knowledgeInputHash;
    packet.envelope.knowledgeManifestHash = packet.envelope.taskEnvelope.knowledgeManifestHash;
    packet.injectedKnowledgeTrace = {
      status: "present",
      knowledgeRouteResultId: packet.envelope.taskEnvelope.knowledgeRouteResultId,
      contextBudgetId: packet.envelope.taskEnvelope.contextBudgetId,
      knowledgeInputHash: packet.envelope.taskEnvelope.knowledgeInputHash,
      knowledgeManifestHash: packet.envelope.taskEnvelope.knowledgeManifestHash,
      packIds: [record.packId],
      snippetIds: packet.envelope.taskEnvelope.injectedKnowledgeSnippetIds,
      snippetCount: 1,
      qaPackBindingIds: [],
      warnings: [],
    };
    packet.envelope.injectedKnowledgeTrace = packet.injectedKnowledgeTrace;
  }
  return next;
}

function clearKnowledge(workflowState) {
  const next = clone(workflowState);
  for (const packet of next.taskPacketState.packets) {
    if (!packet.envelope?.taskEnvelope) continue;
    packet.envelope.taskEnvelope.knowledgeRouteResultId = undefined;
    packet.envelope.taskEnvelope.contextBudgetId = undefined;
    packet.envelope.taskEnvelope.injectedKnowledgePacks = [];
    packet.envelope.taskEnvelope.injectedKnowledgeSnippetIds = [];
    packet.envelope.taskEnvelope.injectedKnowledgeSnippets = [];
    packet.envelope.taskEnvelope.knowledgeInputHash = undefined;
    packet.envelope.taskEnvelope.knowledgeManifestHash = undefined;
    packet.envelope.knowledgeRouteResultId = undefined;
    packet.envelope.contextBudgetId = undefined;
    packet.envelope.injectedKnowledgePacks = [];
    packet.envelope.injectedKnowledgeSnippetIds = [];
    packet.envelope.injectedKnowledgeSnippets = [];
    packet.envelope.knowledgeInputHash = undefined;
    packet.envelope.knowledgeManifestHash = undefined;
    packet.injectedKnowledgeTrace = {
      status: "missing",
      packIds: [],
      snippetIds: [],
      snippetCount: 0,
      qaPackBindingIds: [],
      warnings: ["test cleared knowledge trace"],
    };
    packet.envelope.injectedKnowledgeTrace = packet.injectedKnowledgeTrace;
  }
  return next;
}

function readyEnvelopeWorkflow(workflowState) {
  const next = clone(workflowState);
  next.taskPacketState.packets = next.taskPacketState.packets.filter((packet) => packet.envelope);
  next.taskPacketState.summary.total = next.taskPacketState.packets.length;
  next.taskPacketState.summary.ready = next.taskPacketState.packets.length;
  next.taskPacketState.summary.blockedMissingContext = 0;
  next.taskPacketState.summary.envelopeReady = next.taskPacketState.packets.length;
  return next;
}

function mutateFirstQueuedPacket(workflowState, confirmedRuntime, mutate) {
  const next = clone(workflowState);
  const queuedItem = confirmedRuntime.pendingTransaction.taskEnqueue.items.find((item) => item.queueStatus === "queued");
  assert(queuedItem, "fixture must include at least one queued packet for validation mutation tests");
  const packet = next.taskPacketState.packets.find((candidate) => candidate.packetId === queuedItem.packetId);
  assert(packet?.envelope?.taskEnvelope, "queued packet must include a task envelope");
  mutate(packet);
  return { workflowState: next, packetId: packet.packetId };
}

function assertPacketMutationBlocks({ workflowState, packetId, expectedError, label }) {
  const runtime = buildProjectTransactionRuntime({
    workflowState,
    runtimeState,
    userConfirmed: true,
    userEnabled: true,
  });
  const item = runtime.pendingTransaction.taskEnqueue.items.find((candidate) => candidate.packetId === packetId);
  assert(item, `${label} mutated packet must remain visible in enqueue plan`);
  assert(item.queueStatus === "blocked", `${label} must block queue validation`);
  assert(item.validationErrors.includes(expectedError), `${label} must report ${expectedError}`);
}

const runtimeState = runtime();
const workflowState = buildDirectorWorkflowState({
  runtimeState,
  userIntent: "把当前镜头里的角色服装改旧一点，场景更冷，整体风格更压抑，但保持身份和镜头顺序可追踪",
  selection: { selectedShotId: "A1_02" },
  generatedAt,
});

assert(workflowState.transactionRuntime, "DirectorWorkflow must expose transaction runtime summary");
assert(workflowState.transactionRuntime.projectVibeWritePlan.mode === "pending_only", "workflow transaction must be pending-only");
assert(workflowState.transactionRuntime.projectVibeWritePlan.noFileMutation === true, "workflow transaction must not write project.vibe");
assert(workflowState.transactionRuntime.projectVibeWritePlan.projectVibeWriteAllowed === false, "workflow transaction must keep project.vibe writes disabled");

const missingTraceRuntime = buildProjectTransactionRuntime({
  workflowState: clearKnowledge(workflowState),
  runtimeState,
  userConfirmed: true,
  userEnabled: true,
});

assert(
  missingTraceRuntime.userStatus === "blocked_missing_knowledge_trace",
  `empty knowledge trace must block formal enqueue, got ${missingTraceRuntime.userStatus} with ${missingTraceRuntime.pendingTransaction.taskEnqueue.items
    .flatMap((item) => item.validationErrors)
    .join(";")}`,
);
assert(missingTraceRuntime.queueIngestSummary.queued === 0, "empty knowledge trace must not queue any task");
assert(missingTraceRuntime.queueIngestSummary.blocked === workflowState.taskPacketState.packets.length, "all empty-trace packets should be blocked");
assert(
  missingTraceRuntime.pendingTransaction.taskEnqueue.items
    .filter((item) => item.taskEnvelopeId)
    .every((item) => item.validationErrors.includes("blocked_missing_knowledge_trace")),
  "each empty-trace TaskEnvelope enqueue item must carry blocked_missing_knowledge_trace",
);
assert(
  missingTraceRuntime.pendingTransaction.sourceFacts.knowledgeInjectionTrace.missingTaskEnvelopeIds.length > 0,
  "source facts must record missing task envelope knowledge trace ids",
);

const missingTraceReceipt = confirmProjectPendingTransactionForRuntime(missingTraceRuntime);
assert(missingTraceReceipt.status === "blocked_missing_knowledge_trace", "missing trace confirmation must fail closed");
assert(missingTraceReceipt.nextAction === "repair_knowledge_trace", "missing trace receipt must route to trace repair");
assert(missingTraceReceipt.queuedCount === 0, "missing trace receipt must not project queued work");
assert(
  missingTraceReceipt.missingKnowledgeTraceCount === missingTraceRuntime.queueIngestSummary.missingKnowledgeTrace,
  "missing trace count must be derived from summary",
);
assert(
  missingTraceReceipt.blockedReasons.some((reason) => reason.startsWith("missing_knowledge_trace:")),
  "missing trace receipt must expose missing envelope blockers",
);
const missingTraceStaged = stageProjectFactsForCommit({
  runtime: missingTraceRuntime,
  confirmationReceipt: missingTraceReceipt,
});
assert(missingTraceStaged.status === "blocked_missing_knowledge_trace", "missing trace staged commit must fail closed");
assert(missingTraceStaged.pendingFactPatches.length === 0, "missing trace staged commit must not produce fact patches");
assert(missingTraceStaged.projectVibeWritten === false, "missing trace staged commit must not write project.vibe");
assert(missingTraceStaged.providerCalled === false, "missing trace staged commit must not call provider");
assert(missingTraceStaged.workerSpawned === false, "missing trace staged commit must not spawn workers");
const missingTraceApplyPlan = buildProjectStoreApplyPlanForStagedFacts({ receipt: missingTraceStaged, generatedAt });
assert(missingTraceApplyPlan.status === "blocked_staged_receipt", "blocked staged receipt must generate blocked apply plan");
assert(missingTraceApplyPlan.items.length === 0, "blocked staged receipt apply plan must not expose patch items");
assert(missingTraceApplyPlan.projectStorePatch.operations.length === 0, "blocked staged receipt apply plan must not construct operations");
assert(missingTraceApplyPlan.canWriteNow === false, "blocked staged receipt apply plan must not be writable");
assert(missingTraceApplyPlan.projectVibeWritten === false, "blocked staged receipt apply plan must not write project.vibe");
assert(missingTraceApplyPlan.providerCalled === false, "blocked staged receipt apply plan must not call provider");
assert(missingTraceApplyPlan.workerSpawned === false, "blocked staged receipt apply plan must not spawn workers");

const hydratedWorkflow = hydrateKnowledge(readyEnvelopeWorkflow(workflowState));
const parkedByUser = buildProjectTransactionRuntime({
  workflowState: hydratedWorkflow,
  runtimeState,
  userConfirmed: true,
  userEnabled: false,
});
assert(parkedByUser.userStatus === "parked", "user-disabled formal execution must park, not queue");
assert(parkedByUser.queueIngestSummary.parked === hydratedWorkflow.taskPacketState.packets.length, "user-disabled queue ingest should park every hydrated task");
assert(parkedByUser.runtimeEvents.every((event) => event.status === "parked"), "parked queue ingest facts should be exposed as runtime events");

const parkedReceipt = confirmProjectPendingTransactionForRuntime(parkedByUser);
assert(parkedReceipt.status === "confirmed", "confirmed parked transaction should still produce a software-layer projection receipt");
assert(parkedReceipt.projectVibeWriteAllowed === false, "parked confirmation receipt must not allow project.vibe writes");
assert(parkedReceipt.projectVibeWriteExecuted === false, "parked confirmation receipt must not execute project.vibe writes");
assert(parkedReceipt.noFileMutation === true, "parked confirmation receipt must forbid file mutation");
assert(parkedReceipt.providerSubmissionForbidden === true, "parked confirmation receipt must forbid provider submission");
assert(parkedReceipt.workerSpawnForbidden === true, "parked confirmation receipt must forbid worker spawn");
assert(parkedReceipt.requiresKnowledgeTrace === true, "parked confirmation receipt must require knowledge trace");
assert(parkedReceipt.parkedCount === parkedByUser.queueIngestSummary.parked, "parked receipt must derive parked count from queue summary");
assert(parkedReceipt.queuedCount === 0, "parked receipt must not invent queued work");
assert(
  parkedReceipt.runtimeProjection.parkedTaskRunIds.length === parkedByUser.pendingTransaction.taskEnqueue.items.length,
  "parked receipt projection must retain parked task run ids",
);
const parkedStaged = stageProjectFactsForCommit({
  runtime: parkedByUser,
  confirmationReceipt: parkedReceipt,
});
assert(parkedStaged.status === "staged", "confirmed parked transaction should stage project facts in memory");
assert(parkedStaged.mode === "dry_run_staged", "parked staged commit must be dry-run staged");
assert(parkedStaged.pendingFactPatches.some((patch) => patch.role === "task_runs_pointer"), "parked staged commit must include task run pointer patch");
assert(
  parkedStaged.stagingSummary.parkedTaskRunPointerCount === parkedByUser.queueIngestSummary.parked,
  "parked staged commit must count parked task run pointers",
);
assert(parkedStaged.hardLocks.projectVibeWritten === false, "parked staged commit must hard-lock project.vibe writes off");
assert(parkedStaged.hardLocks.providerCalled === false, "parked staged commit must hard-lock provider calls off");
assert(parkedStaged.hardLocks.workerSpawned === false, "parked staged commit must hard-lock worker spawn off");

const confirmedRuntime = buildProjectTransactionRuntime({
  workflowState: hydratedWorkflow,
  runtimeState,
  userConfirmed: true,
  userEnabled: true,
});
assert(confirmedRuntime.userStatus === "queued", "hydrated active image tasks should enter queued user status");
assert(confirmedRuntime.queueIngestSummary.queued > 0, "hydrated image/local tasks with enabled policy should have queued facts");
assert(confirmedRuntime.queueIngestSummary.parked > 0, "planned/parked provider tasks should remain parked");
assert(
  confirmedRuntime.pendingTransaction.taskEnqueue.items
    .filter((item) => item.providerExecutionState === "planned" || item.providerExecutionState === "parked")
    .every((item) => item.queueStatus === "parked"),
  "provider planned/parked tasks must be parked, not queued",
);
assert(
  confirmedRuntime.pendingTransaction.taskEnqueue.items
    .filter((item) => item.queueStatus === "queued")
    .every((item) => item.providerPolicyStatus === "enabled" && item.providerExecutionState === "active"),
  "runnable queued route must contain only active/enabled provider-policy tasks",
);
assert(
  confirmedRuntime.pendingTransaction.taskEnqueue.items
    .filter((item) => item.queueStatus === "queued")
    .every((item) => item.ledgerEvents.some((event) => event.eventType === "task_queued")),
  "queued ingest facts must include task_queued ledger events",
);
assert(
  confirmedRuntime.pendingTransaction.taskEnqueue.items
    .filter((item) => item.queueStatus === "parked")
    .every((item) => item.ledgerEvents.some((event) => event.eventType === "parked")),
  "parked ingest facts must include parked ledger events",
);

const confirmedReceipt = confirmProjectPendingTransactionForRuntime(confirmedRuntime);
assert(confirmedReceipt.status === "confirmed", "queued confirmed transaction should produce confirmed projection receipt");
assert(confirmedReceipt.nextAction === "project_runtime_projection_ready", "queued confirmed receipt should be projection-ready");
assert(confirmedReceipt.projectVibeWriteAllowed === false, "queued confirmation receipt must not allow project.vibe writes");
assert(confirmedReceipt.projectVibeWriteExecuted === false, "queued confirmation receipt must not write project.vibe");
assert(confirmedReceipt.noFileMutation === true, "queued confirmation receipt must be in-memory only");
assert(confirmedReceipt.providerSubmissionForbidden === true, "queued confirmation receipt must not submit provider work");
assert(confirmedReceipt.workerSpawnForbidden === true, "queued confirmation receipt must not spawn workers");
assert(confirmedReceipt.providerCalled === false, "queued confirmation receipt must explicitly report providerCalled=false");
assert(confirmedReceipt.projectVibeWritten === false, "queued confirmation receipt must explicitly report projectVibeWritten=false");
assert(confirmedReceipt.requiresKnowledgeTrace === true, "queued confirmation receipt must require trace");
assert(confirmedReceipt.queuedCount === confirmedRuntime.queueIngestSummary.queued, "queued receipt must derive queued count from summary");
assert(confirmedReceipt.parkedCount === confirmedRuntime.queueIngestSummary.parked, "queued receipt must derive parked count from summary");
assert(confirmedReceipt.blockedCount === confirmedRuntime.queueIngestSummary.blocked, "queued receipt must derive blocked count from summary");
assert(
  confirmedReceipt.taskRunIds.length === confirmedRuntime.pendingTransaction.taskEnqueue.items.length,
  "queued receipt must derive task run ids from existing pending transaction items",
);
assert(
  confirmedReceipt.affectedExpectedOutputs.length >= confirmedRuntime.pendingTransaction.artifactInvalidation.affectedExpectedOutputs.length,
  "queued receipt must include artifact invalidation outputs",
);
assert(
  confirmedReceipt.runtimeProjection.queuedTaskRunIds.length === confirmedRuntime.queueIngestSummary.queued,
  "queued projection must expose queued task ids without re-ingesting",
);
const confirmedStaged = stageProjectFactsForCommit({
  runtime: confirmedRuntime,
  confirmationReceipt: confirmedReceipt,
});
assert(confirmedStaged.status === "staged", "valid confirmed transaction must produce staged project fact receipt");
assert(confirmedStaged.nextAction === "review_staged_project_facts", "valid staged commit should route to staged fact review");
assert(confirmedStaged.pendingFactPatches.length === confirmedRuntime.projectFactsWriteGate.futureFactRoles.length, "staged commit must produce one patch per future fact role");
assert(confirmedStaged.stagingSummary.rolesToUpdate.includes("story_flow"), "staged commit must summarize story_flow updates");
assert(confirmedStaged.stagingSummary.rolesToUpdate.includes("visual_memory"), "staged commit must summarize visual_memory updates");
assert(confirmedStaged.stagingSummary.rolesToUpdate.includes("shot_layout"), "staged commit must summarize shot_layout updates");
assert(confirmedStaged.stagingSummary.rolesToUpdate.includes("task_runs_pointer"), "staged commit must summarize task_runs pointer updates");
assert(
  confirmedStaged.pendingFactPatches
    .filter((patch) => patch.role === "task_runs_pointer")
    .every((patch) => patch.stagedTaskRunPointers.every((pointer) => pointer.pointerOnly === true && pointer.providerSubmissionForbidden === true)),
  "task run pointers must be staged pointer-only facts",
);
assert(
  confirmedStaged.stagingSummary.stagedTaskRunPointerCount === confirmedRuntime.pendingTransaction.taskEnqueue.items.length,
  "valid staged commit must retain staged task run pointers for every enqueue item",
);
assert(confirmedStaged.projectVibeWritten === false, "valid staged commit must not write project.vibe");
assert(confirmedStaged.providerCalled === false, "valid staged commit must not call provider");
assert(confirmedStaged.workerSpawned === false, "valid staged commit must not spawn worker");
assert(confirmedStaged.hardLocks.noFileMutation === true, "valid staged commit must forbid file mutation");
assert(confirmedStaged.hardLocks.projectVibeWriteAllowed === false, "valid staged commit must keep write gate closed");
const confirmedApplyPlan = buildProjectStoreApplyPlanForStagedFacts({ receipt: confirmedStaged, generatedAt });
assert(confirmedApplyPlan.mode === "dry_run_project_store_apply_plan", "confirmed staged receipt must generate ProjectStore dry-run apply plan");
assert(confirmedApplyPlan.stagedOnly === true, "ProjectStore apply plan must remain staged-only");
assert(confirmedApplyPlan.canWriteNow === false, "ProjectStore apply plan must never be writable");
assert(confirmedApplyPlan.noFileMutation === true, "ProjectStore apply plan must forbid file mutation");
assert(confirmedApplyPlan.projectVibeWritten === false, "ProjectStore apply plan must not write project.vibe");
assert(confirmedApplyPlan.providerCalled === false, "ProjectStore apply plan must not call provider");
assert(confirmedApplyPlan.workerSpawned === false, "ProjectStore apply plan must not spawn workers");
assert(confirmedApplyPlan.projectStorePatch.operations.length === 0, "ProjectStore apply plan must not construct operations without typed values");
assert(
  confirmedApplyPlan.items.length === confirmedStaged.pendingFactPatches.length,
  "ProjectStore apply plan must expose one review item per staged pending fact patch",
);
assert(
  confirmedApplyPlan.items.every((item) => item.canApplyNow === false && item.valuePresent === false),
  "ProjectStore apply plan items must stay blocked without typed fact values",
);
assert(
  confirmedApplyPlan.items.every((item) => item.blockedReasons.includes("project_store_value_missing")),
  "ProjectStore apply plan items must explicitly block missing ProjectStore values",
);
assert(
  confirmedApplyPlan.items.find((item) => item.role === "story_flow")?.projectStoreOperationIntent === "set_story_flow",
  "story_flow staged patch must map to set_story_flow intent",
);
assert(
  confirmedApplyPlan.items.find((item) => item.role === "visual_memory")?.projectStoreOperationIntent === "set_visual_memory",
  "visual_memory staged patch must map to set_visual_memory intent",
);
assert(
  confirmedApplyPlan.items.find((item) => item.role === "source_index")?.projectStoreOperationIntent === "set_source_index",
  "source_index staged patch must map to set_source_index intent",
);
for (const role of ["shot_layout", "task_runs_pointer", "knowledge_route_history"]) {
  const item = confirmedApplyPlan.items.find((candidate) => candidate.role === role);
  assert(item, `${role} staged patch must remain visible in the ProjectStore apply plan`);
  assert(item.canApplyNow === false, `${role} staged patch must not be currently applicable`);
  assert(!("projectStoreOperationIntent" in item), `${role} staged patch must not carry a ProjectStore operation intent`);
  assert(item.blockedReasons.includes("project_store_operation_unavailable_for_role"), `${role} staged patch must explain missing ProjectStore op`);
}
const taskRunPointerApplyItem = confirmedApplyPlan.items.find((item) => item.role === "task_runs_pointer");
assert(taskRunPointerApplyItem, "task_runs_pointer apply plan item must be present");
assert(
  taskRunPointerApplyItem.stagedTaskRunPointers.length === confirmedRuntime.pendingTransaction.taskEnqueue.items.length,
  "task_runs_pointer apply plan item must retain pointer-only task run information",
);
assert(
  taskRunPointerApplyItem.stagedTaskRunPointers.every((pointer) => pointer.pointerOnly === true && pointer.providerSubmissionForbidden === true),
  "task_runs_pointer apply plan item must keep pointers non-executable",
);
const stringifiedConfirmedApplyPlan = JSON.stringify(confirmedApplyPlan);
assert(!stringifiedConfirmedApplyPlan.includes(process.cwd()), "ProjectStore apply plan must not persist the workspace absolute path");
assert(
  !collectStrings(confirmedApplyPlan).some((value) => path.isAbsolute(value)),
  "ProjectStore apply plan must not contain absolute paths",
);
const previewProjectStore = {
  factFiles: [
    { role: "story_flow", sourceOfTruth: "project_file", path: { path: "story_flow/story_flow.vibe.json" }, hash: "vck_story_flow" },
    { role: "visual_memory", sourceOfTruth: "project_file", path: { path: "visual_memory/visual_memory.vibe.json" }, hash: "vck_visual_memory" },
    { role: "source_index", sourceOfTruth: "project_file", path: { path: "manifests/source_index.vibe.json" }, hash: "vck_source_index" },
  ],
  facts: {
    storyFlow: {
      schemaVersion: "0.1.0",
      id: "portable_story_flow",
      shotOrder: ["A1_01", "A1_02", "A1_03"],
      sections: [{ id: "section-1", shots: ["A1_01", "A1_02", "A1_03"] }],
    },
    visualMemory: {
      schemaVersion: "0.1.0",
      id: "portable_visual_memory",
      assets: [{ id: "hero_locked", type: "character", lockedStatus: "locked" }],
    },
    sourceIndex: {
      schemaVersion: "0.1.0",
      sourceIndexHash: "source_hash_tx_123",
      refs: ["story_flow/story_flow.vibe.json", "visual_memory/visual_memory.vibe.json"],
    },
  },
};
const previewProjectFactsIntegration = {
  facts: {
    storyFlow: {
      sourceOfTruth: "project_store",
      path: "story_flow/story_flow.vibe.json",
      sourceHash: "vck_story_flow",
      sources: [{ sourceOfTruth: "project_store", role: "story_flow", path: "story_flow/story_flow.vibe.json", hash: "vck_story_flow" }],
      sourceRefs: ["projectStore.facts.storyFlow"],
      warnings: [],
    },
    visualMemory: {
      sourceOfTruth: "project_store",
      path: "visual_memory/visual_memory.vibe.json",
      sourceHash: "vck_visual_memory",
      sources: [{ sourceOfTruth: "project_store", role: "visual_memory", path: "visual_memory/visual_memory.vibe.json", hash: "vck_visual_memory" }],
      sourceRefs: ["projectStore.facts.visualMemory"],
      warnings: [],
    },
  },
};
const confirmedTypedValuePreview = buildProjectStoreTypedValueSourcePreviewForStagedFacts({
  receipt: confirmedStaged,
  projectStore: previewProjectStore,
  projectFactsIntegration: previewProjectFactsIntegration,
  generatedAt,
});
assert(confirmedTypedValuePreview.mode === "dry_run_typed_value_source_preview", "typed value/source preview must use dry-run preview mode");
assert(confirmedTypedValuePreview.stagedOnly === true, "typed value/source preview must remain staged-only");
assert(confirmedTypedValuePreview.canWriteNow === false, "typed value/source preview must never be writable");
assert(confirmedTypedValuePreview.noFileMutation === true, "typed value/source preview must forbid file mutation");
assert(confirmedTypedValuePreview.projectVibeWritten === false, "typed value/source preview must not write project.vibe");
assert(confirmedTypedValuePreview.providerCalled === false, "typed value/source preview must not call providers");
assert(confirmedTypedValuePreview.workerSpawned === false, "typed value/source preview must not spawn workers");
assert(
  confirmedTypedValuePreview.items.length === confirmedStaged.pendingFactPatches.length,
  "confirmed staged receipt must generate one typed value/source preview item per pending fact patch",
);
assert(
  confirmedTypedValuePreview.items.every((item) => item.valuePresent === false && item.canApplyNow === false),
  "typed value/source preview items must never expose present values or apply readiness",
);
for (const [role, operationIntent] of [
  ["story_flow", "set_story_flow"],
  ["visual_memory", "set_visual_memory"],
  ["source_index", "set_source_index"],
]) {
  const item = confirmedTypedValuePreview.items.find((candidate) => candidate.role === role);
  assert(item, `${role} typed value/source preview item must be present`);
  assert(item.projectStoreOperationIntent === operationIntent, `${role} preview must expose ProjectStore operation intent`);
  assert(item.baseSourceEvidence?.path, `${role} preview must include base source path`);
  assert(item.baseSourceEvidence?.hash, `${role} preview must include base source hash`);
}
for (const role of ["shot_layout", "task_runs_pointer", "knowledge_route_history"]) {
  const item = confirmedTypedValuePreview.items.find((candidate) => candidate.role === role);
  assert(item, `${role} typed value/source preview item must be present`);
  assert(!("projectStoreOperationIntent" in item), `${role} preview must not expose unsupported operation intent`);
  assert(item.blockedReasons.includes("project_store_operation_unavailable_for_role"), `${role} preview must explain unavailable operation`);
}
const stringifiedTypedValuePreview = JSON.stringify(confirmedTypedValuePreview);
assert(!stringifiedTypedValuePreview.includes(process.cwd()), "typed value/source preview must not persist the workspace absolute path");
assert(
  !collectStrings(confirmedTypedValuePreview).some((value) => path.isAbsolute(value)),
  "typed value/source preview must not contain absolute paths",
);
const materializationPreview = buildProjectStoreTypedValueMaterializationPreviewForStagedFacts({
  receipt: confirmedStaged,
  sourcePreview: confirmedTypedValuePreview,
  projectStore: previewProjectStore,
  generatedAt,
});
assert(materializationPreview.mode === "dry_run_typed_value_materialization_preview", "typed value materialization preview must use dry-run materialization mode");
assert(materializationPreview.stagedOnly === true, "typed value materialization preview must remain staged-only");
assert(materializationPreview.canWriteNow === false, "typed value materialization preview must never be writable");
assert(materializationPreview.noFileMutation === true, "typed value materialization preview must forbid file mutation");
assert(materializationPreview.projectVibeWritten === false, "typed value materialization preview must not write project.vibe");
assert(materializationPreview.providerCalled === false, "typed value materialization preview must not call providers");
assert(materializationPreview.workerSpawned === false, "typed value materialization preview must not spawn workers");
assert(materializationPreview.projectStorePatch.operations.length === 0, "typed value materialization preview must not construct ProjectStorePatch operations");
assert(
  materializationPreview.items.length === confirmedStaged.pendingFactPatches.length,
  "typed value materialization preview must generate one item per staged patch",
);
for (const [role, operationIntent] of [
  ["story_flow", "set_story_flow"],
  ["visual_memory", "set_visual_memory"],
  ["source_index", "set_source_index"],
]) {
  const item = materializationPreview.items.find((candidate) => candidate.role === role);
  assert(item, `${role} materialization item must be present`);
  assert(item.valueMaterialization.valuePresent === true, `${role} materialization must find the typed ProjectStore value`);
  assert(item.valueMaterialization.valueKind === "object", `${role} materialization must only accept typed objects`);
  assert(/^vtx_[0-9a-f]{8}$/.test(item.valueMaterialization.valueHash || ""), `${role} materialization must include a stable value hash`);
  assert(item.projectStoreOperationIntent === operationIntent, `${role} materialization must expose operation intent`);
  assert(item.valueMaterialization.projectStoreOperationPreview?.op === operationIntent, `${role} materialization must preview the intended op`);
  assert(item.valueMaterialization.projectStoreOperationPreview?.canApplyNow === false, `${role} operation preview must remain non-applicable`);
  assert(item.canApplyNow === false, `${role} materialization candidate must not be applyable`);
}
for (const role of ["shot_layout", "task_runs_pointer", "knowledge_route_history"]) {
  const item = materializationPreview.items.find((candidate) => candidate.role === role);
  assert(item, `${role} materialization item must be present`);
  assert(item.valueMaterialization.valuePresent === false, `${role} must not materialize a typed value`);
  assert(item.valueMaterialization.valueKind === "unsupported", `${role} must remain unsupported or pointer-only`);
  assert(!("projectStoreOperationIntent" in item), `${role} materialization must not expose unsupported operation intent`);
  assert(item.blockedReasons.includes("project_store_operation_unavailable_for_role"), `${role} materialization must explain unavailable operation`);
}
assert(
  materializationPreview.items
    .find((item) => item.role === "task_runs_pointer")
    ?.blockedReasons.includes("task_runs_pointer_is_pointer_only"),
  "task_runs_pointer materialization must retain pointer-only blocker",
);
const stringifiedMaterializationPreview = JSON.stringify(materializationPreview);
assert(!stringifiedMaterializationPreview.includes(process.cwd()), "typed value materialization preview must not persist the workspace absolute path");
assert(
  !collectStrings(materializationPreview).some((value) => path.isAbsolute(value)),
  "typed value materialization preview must not contain absolute paths",
);
const blockedAuthorityPreview = buildProjectStoreTypedValueSourcePreviewForStagedFacts({
  receipt: {
    ...confirmedStaged,
    pendingFactPatches: confirmedStaged.pendingFactPatches.map((patch) =>
      patch.role === "story_flow"
        ? { ...patch, sourceRefs: ["runtime-state/storyFlow", "direct-input/storyFlow", "old-chat/storyFlow", "global-knowledge/storyFlow"] }
        : patch,
    ),
  },
  projectStore: previewProjectStore,
  projectFactsIntegration: previewProjectFactsIntegration,
  generatedAt,
});
assert(
  blockedAuthorityPreview.items
    .find((item) => item.role === "story_flow")
    ?.sourceValidation.errors.includes("blocked_authority_cannot_authorize_project_fact"),
  "runtime-state/direct-input/old-chat/global knowledge must not authorize project fact sources",
);
const blockedAuthorityMaterializationPreview = buildProjectStoreTypedValueMaterializationPreviewForStagedFacts({
  receipt: confirmedStaged,
  sourcePreview: blockedAuthorityPreview,
  projectStore: previewProjectStore,
  generatedAt,
});
const blockedAuthorityMaterializationItem = blockedAuthorityMaterializationPreview.items.find((item) => item.role === "story_flow");
assert(blockedAuthorityMaterializationItem, "blocked authority materialization item must be present");
assert(blockedAuthorityMaterializationItem.valueMaterialization.valuePresent === false, "blocked authority source preview must fail closed before materializing value");
assert(
  blockedAuthorityMaterializationItem.sourceValidation.errors.includes("blocked_authority_cannot_authorize_project_fact"),
  "blocked authority materialization must retain source validation error",
);
for (const rejectedPath of ["/tmp/story_flow.vibe.json", "~/story_flow.vibe.json", "../story_flow.vibe.json"]) {
  const unsafeSourcePreview = buildProjectStoreTypedValueSourcePreviewForStagedFacts({
    receipt: confirmedStaged,
    projectStore: {
      factFiles: previewProjectStore.factFiles.map((factFile) =>
        factFile.role === "story_flow" ? { ...factFile, path: { path: rejectedPath } } : factFile,
      ),
    },
    projectFactsIntegration: previewProjectFactsIntegration,
    generatedAt,
  });
  const unsafeMaterializationPreview = buildProjectStoreTypedValueMaterializationPreviewForStagedFacts({
    receipt: confirmedStaged,
    sourcePreview: unsafeSourcePreview,
    projectStore: previewProjectStore,
    generatedAt,
  });
  const unsafeStoryItem = unsafeMaterializationPreview.items.find((item) => item.role === "story_flow");
  assert(unsafeStoryItem, `${rejectedPath} materialization item must remain present for review`);
  assert(unsafeStoryItem.valueMaterialization.valuePresent === false, `${rejectedPath} must fail closed before value materialization`);
  assert(
    unsafeStoryItem.sourceValidation.errors.some((error) =>
      ["base_source_path_must_be_project_relative", "base_source_path_must_not_escape_project_root", "base_source_path_missing"].includes(error),
    ),
    `${rejectedPath} must be rejected as a non-portable source path`,
  );
  assert(!JSON.stringify(unsafeMaterializationPreview).includes(rejectedPath), `${rejectedPath} must not be persisted in materialization output`);
}

const missingExpectedOutputs = mutateFirstQueuedPacket(hydratedWorkflow, confirmedRuntime, (packet) => {
  packet.envelope.taskEnvelope.expectedOutputs = [];
});
assertPacketMutationBlocks({
  workflowState: missingExpectedOutputs.workflowState,
  packetId: missingExpectedOutputs.packetId,
  expectedError: "expected_outputs_missing",
  label: "missing expected outputs",
});
const blockedQueueRuntime = buildProjectTransactionRuntime({
  workflowState: missingExpectedOutputs.workflowState,
  runtimeState,
  userConfirmed: true,
  userEnabled: true,
});
const blockedQueueReceipt = confirmProjectPendingTransactionForRuntime(blockedQueueRuntime);
assert(blockedQueueReceipt.status === "blocked_queue", "blocked queue confirmation must fail closed");
assert(blockedQueueReceipt.nextAction === "repair_queue_blockers", "blocked queue receipt must route to queue blocker repair");
assert(blockedQueueReceipt.blockedReasons.includes("expected_outputs_missing"), "blocked queue receipt must expose queue validation blockers");
const blockedExpectedOutputsStaged = stageProjectFactsForCommit({
  runtime: blockedQueueRuntime,
  confirmationReceipt: blockedQueueReceipt,
});
assert(blockedExpectedOutputsStaged.status === "blocked_missing_expected_outputs", "missing expected outputs must block staged commit specifically");
assert(blockedExpectedOutputsStaged.pendingFactPatches.length === 0, "missing expected outputs must not produce fact patches");

const missingQaChecklist = mutateFirstQueuedPacket(hydratedWorkflow, confirmedRuntime, (packet) => {
  packet.envelope.taskEnvelope.qaChecklist = [];
});
assertPacketMutationBlocks({
  workflowState: missingQaChecklist.workflowState,
  packetId: missingQaChecklist.packetId,
  expectedError: "qa_checklist_missing",
  label: "missing QA checklist",
});
const missingQaRuntime = buildProjectTransactionRuntime({
  workflowState: missingQaChecklist.workflowState,
  runtimeState,
  userConfirmed: true,
  userEnabled: true,
});
const missingQaReceipt = confirmProjectPendingTransactionForRuntime(missingQaRuntime);
const missingQaStaged = stageProjectFactsForCommit({
  runtime: missingQaRuntime,
  confirmationReceipt: missingQaReceipt,
});
assert(missingQaStaged.status === "blocked_missing_qa_checklist", "missing QA checklist must block staged commit specifically");
assert(missingQaStaged.pendingFactPatches.length === 0, "missing QA checklist must not produce fact patches");

const missingTaskEnvelope = mutateFirstQueuedPacket(hydratedWorkflow, confirmedRuntime, (packet) => {
  packet.envelope = undefined;
  packet.envelopeId = undefined;
});
assertPacketMutationBlocks({
  workflowState: missingTaskEnvelope.workflowState,
  packetId: missingTaskEnvelope.packetId,
  expectedError: "validated_task_envelope_missing",
  label: "missing task envelope",
});
const missingEnvelopeRuntime = buildProjectTransactionRuntime({
  workflowState: missingTaskEnvelope.workflowState,
  runtimeState,
  userConfirmed: true,
  userEnabled: true,
});
const missingEnvelopeReceipt = confirmProjectPendingTransactionForRuntime(missingEnvelopeRuntime);
const missingEnvelopeStaged = stageProjectFactsForCommit({
  runtime: missingEnvelopeRuntime,
  confirmationReceipt: missingEnvelopeReceipt,
});
assert(missingEnvelopeStaged.status === "blocked_missing_task_envelope", "missing task envelope must block staged commit specifically");
assert(missingEnvelopeStaged.pendingFactPatches.length === 0, "missing task envelope must not produce fact patches");

const missingSourceFactTrace = mutateFirstQueuedPacket(hydratedWorkflow, confirmedRuntime, (packet) => {
  packet.sourceFactTrace = [];
  packet.envelope.sourceFactTrace = [];
  packet.envelope.taskEnvelope.sourceFactTrace = [];
});
assertPacketMutationBlocks({
  workflowState: missingSourceFactTrace.workflowState,
  packetId: missingSourceFactTrace.packetId,
  expectedError: "source_fact_trace_missing",
  label: "missing source fact trace",
});

assert(confirmedRuntime.pendingTransaction.components.some((component) => component.kind === "story_change"), "pending transaction must include story_change component");
assert(confirmedRuntime.pendingTransaction.components.some((component) => component.kind === "asset_update"), "pending transaction must include asset_update component");
assert(confirmedRuntime.pendingTransaction.components.some((component) => component.kind === "shot_reflow"), "pending transaction must include shot_reflow component");
assert(confirmedRuntime.pendingTransaction.components.some((component) => component.kind === "artifact_invalidation"), "pending transaction must include artifact_invalidation component");
assert(confirmedRuntime.pendingTransaction.components.some((component) => component.kind === "task_enqueue"), "pending transaction must include task_enqueue component");
assert(confirmedRuntime.pendingTransaction.sourceFacts.projectId === "project_tx_fixture", "source facts must retain projectId");
assert(confirmedRuntime.pendingTransaction.sourceFacts.projectVersion === "0.4.0", "source facts must retain projectVersion");
assert(confirmedRuntime.pendingTransaction.sourceFacts.currentProjectIdentity.projectId === "project_tx_fixture", "source facts must retain current project identity");
assert(confirmedRuntime.pendingTransaction.sourceFacts.currentProjectIdentity.projectTitle === "Portable Transaction Test", "source facts must retain current project title");
assert(confirmedRuntime.pendingTransaction.sourceFacts.currentProjectIdentity.sourceIndexHash === "source_hash_tx_123", "source facts must retain current project source hash");
assert(confirmedRuntime.pendingTransaction.sourceFacts.sourceIndexHash === "source_hash_tx_123", "source facts must retain sourceIndexHash");
assert(confirmedRuntime.pendingTransaction.sourceFacts.selectedScope.scopeKind === "shot", "source facts must retain selected shot scope kind");
assert(confirmedRuntime.pendingTransaction.sourceFacts.selectedScope.selectedShotIds.join(",") === "A1_02", "source facts must retain selected shot ids");
assert(confirmedRuntime.pendingTransaction.sourceFacts.selectedScope.selectedAssetIds.length === 0, "source facts must avoid inventing selected asset ids");
assert(confirmedRuntime.pendingTransaction.sourceFacts.taskEnvelopeIds.length === hydratedWorkflow.taskPacketState.summary.envelopeReady, "source facts must record task envelope ids");
assert(confirmedRuntime.pendingTransaction.sourceFacts.knowledgeInjectionTrace.status === "present", "hydrated trace should be present");
assert(confirmedRuntime.pendingTransaction.sourceFacts.staleArtifactImpact.staleArtifactCount === confirmedRuntime.pendingTransaction.artifactInvalidation.staleArtifacts.length, "source facts must retain stale artifact impact");
assert(confirmedRuntime.pendingTransaction.sourceFacts.expectedTaskEnqueuePlan.total === confirmedRuntime.pendingTransaction.taskEnqueue.summary.total, "source facts must retain expected task enqueue plan total");
assert(confirmedRuntime.pendingTransaction.sourceFacts.expectedTaskEnqueuePlan.validatedEnvelopeRequired === true, "expected task enqueue plan must require validated envelopes");
assert(confirmedRuntime.pendingTransaction.sourceFacts.expectedTaskEnqueuePlan.knowledgeTraceRequired === true, "expected task enqueue plan must require knowledge trace");
assert(confirmedRuntime.pendingTransaction.sourceFacts.expectedTaskEnqueuePlan.expectedOutputsRequired === true, "expected task enqueue plan must require expected outputs");
assert(confirmedRuntime.pendingTransaction.sourceFacts.expectedTaskEnqueuePlan.qaChecklistRequired === true, "expected task enqueue plan must require QA checklist");
assert(confirmedRuntime.pendingTransaction.sourceFacts.packetPlannerReceipt.receiptId, "source facts must retain packet planner receipt id");
assert(confirmedRuntime.pendingTransaction.sourceFacts.packetPlannerReceipt.validatedEnvelopeRequired === true, "packet planner receipt must require validated envelopes");
assert(confirmedRuntime.pendingTransaction.sourceFacts.packetPlannerReceipt.formalTaskRejectsMissingPacket === true, "packet planner receipt must reject missing packets");
assert(confirmedRuntime.pendingTransaction.sourceFacts.packetPlannerReceipt.sourceFactTraceRecorded === true, "packet planner receipt must record source fact trace");
assert(confirmedRuntime.pendingTransaction.sourceFacts.packetPlannerReceipt.knowledgePacksRecorded === true, "packet planner receipt must record injected knowledge trace");
assert(confirmedRuntime.pendingTransaction.sourceFacts.packetPlannerReceipt.phase37VisualConsistencyTraceRequired === true, "packet planner receipt must require Phase37 visual trace");
assert(confirmedRuntime.pendingTransaction.artifactInvalidation.deleteForbidden === true, "artifact invalidation must never delete files");
assert(confirmedRuntime.pendingTransaction.artifactInvalidation.changeKinds.includes("character"), "character edits must affect artifact invalidation summary");
assert(confirmedRuntime.pendingTransaction.artifactInvalidation.changeKinds.includes("scene"), "scene edits must affect artifact invalidation summary");
assert(confirmedRuntime.pendingTransaction.artifactInvalidation.changeKinds.includes("style"), "style edits must affect artifact invalidation summary");
assert(confirmedRuntime.pendingTransaction.artifactInvalidation.affectedEnvelopeIds.length > 0, "stale artifact summary must list affected envelopes");
assert(confirmedRuntime.pendingTransaction.artifactInvalidation.affectedExpectedOutputs.every((item) => !path.isAbsolute(item)), "artifact invalidation output refs must be portable");
assert(confirmedRuntime.projectVibeWritePlan.entries.every((entry) => entry.path === "project.vibe"), "write plan must stay project.vibe scoped");
assert(confirmedRuntime.projectVibeWritePlan.entries.every((entry) => entry.canExecute === false), "write plan entries must not execute");
assert(confirmedRuntime.projectFactsWriteGate.projectVibeWriteAllowed === false, "project facts write gate must default project.vibe writes off");
assert(confirmedRuntime.projectFactsWriteGate.requiresUserCommit === true, "project facts write gate must require user commit");
assert(confirmedRuntime.projectFactsWriteGate.noFileMutation === true, "project facts write gate must forbid file mutation");
assert(confirmedRuntime.projectFactsWriteGate.canWriteNow === false, "project facts write gate must not be executable");
assert(confirmedRuntime.projectFactsWriteGate.futureFactRoles.some((role) => role.role === "story_flow"), "project facts write gate must list story_flow future writes");
assert(confirmedRuntime.projectFactsWriteGate.futureFactRoles.some((role) => role.role === "visual_memory"), "project facts write gate must list visual_memory future writes");
assert(confirmedRuntime.projectFactsWriteGate.futureFactRoles.some((role) => role.role === "shot_layout"), "project facts write gate must list shot_layout future writes");
assert(confirmedRuntime.projectFactsWriteGate.futureFactRoles.some((role) => role.role === "task_runs_pointer"), "project facts write gate must list task_runs pointer future writes");
assert(confirmedRuntime.pendingTransaction.projectFactsWriteGate.transactionId === confirmedRuntime.pendingTransaction.id, "pending transaction must carry the project facts write gate");
assert(confirmedRuntime.projectVibeWritePlan.requiresUserCommit === true, "write plan must require user commit");
assert(confirmedRuntime.projectVibeWritePlan.projectFactsWriteGate.transactionId === confirmedRuntime.pendingTransaction.id, "write plan must embed the project facts write gate");
assert(confirmedRuntime.projectVibeWritePlan.futureApplyInterface.requiresKnowledgeTrace === true, "future apply interface must require knowledge trace");

const waitingWorkflow = clone(workflowState);
waitingWorkflow.confirmationRequired = true;
waitingWorkflow.editPlan.confirmationRequired = true;
const waitingRuntime = buildProjectTransactionRuntime({
  workflowState: hydrateKnowledge(waitingWorkflow),
  runtimeState,
  userConfirmed: false,
  userEnabled: true,
});
assert(waitingRuntime.userStatus === "waiting_confirmation", "unconfirmed edit must stay waiting_confirmation");
assert(waitingRuntime.queueIngestSummary.queued === 0, "waiting confirmation must not queue formal tasks");

const waitingReceipt = confirmProjectPendingTransactionForRuntime(waitingRuntime);
assert(waitingReceipt.status === "blocked_not_confirmed", "waiting confirmation receipt must fail closed");
assert(waitingReceipt.nextAction === "show_confirmation", "waiting confirmation receipt must route back to confirmation");
assert(waitingReceipt.projectVibeWriteAllowed === false, "waiting receipt must not allow project.vibe writes");
assert(waitingReceipt.projectVibeWriteExecuted === false, "waiting receipt must not execute writes");
assert(waitingReceipt.providerSubmissionForbidden === true, "waiting receipt must forbid provider submission");
assert(waitingReceipt.workerSpawnForbidden === true, "waiting receipt must forbid worker spawn");
assert(waitingReceipt.blockedReasons.includes("pending_transaction_not_confirmed"), "waiting receipt must explain unconfirmed blocker");
const waitingStaged = stageProjectFactsForCommit({
  runtime: waitingRuntime,
  confirmationReceipt: waitingReceipt,
});
assert(waitingStaged.status === "blocked_not_confirmed", "unconfirmed user transaction must not stage project facts");
assert(waitingStaged.pendingFactPatches.length === 0, "unconfirmed user transaction must not produce fact patches");
assert(waitingStaged.nextAction === "show_confirmation", "unconfirmed staged commit must route to confirmation");

const schema = readJson("schemas/project_transaction.schema.json");
assert(schema.$id === "https://vibecore.local/schemas/project_transaction.schema.json", "project transaction schema id drifted");
assert(JSON.stringify(schema).includes("pending_only"), "schema must document pending_only write plan");
assert(JSON.stringify(schema).includes("dry_run_staged"), "schema must document staged dry-run commit receipt");
assert(schema.$defs.projectFactsStagedCommitReceipt, "schema must define staged project facts commit receipt");
assert(schema.$defs.projectFactStagedPatch, "schema must define staged project fact patch");
assert(schema.$defs.stagedTaskRunPointer, "schema must define staged task run pointer");
assert(schema.$defs.projectFactsStagedApplyPlan, "schema must define staged ProjectStore apply plan");
assert(schema.$defs.projectFactsStagedApplyPlanItem, "schema must define staged ProjectStore apply plan item");
assert(schema.$defs.projectStoreTypedValueSourcePreview, "schema must define typed value/source preview");
assert(schema.$defs.projectStoreTypedValueSourcePreviewItem, "schema must define typed value/source preview item");
assert(schema.$defs.projectStoreTypedValueMaterializationPreview, "schema must define typed value materialization preview");
assert(schema.$defs.projectStoreTypedValueMaterializationPreviewItem, "schema must define typed value materialization preview item");
assert(schema.$defs.projectFactsStagedCommitReceipt.properties.projectVibeWritten.const === false, "staged commit schema must forbid project.vibe writes");
assert(schema.$defs.projectFactsStagedCommitReceipt.properties.providerCalled.const === false, "staged commit schema must forbid provider calls");
assert(schema.$defs.projectFactsStagedCommitReceipt.properties.workerSpawned.const === false, "staged commit schema must forbid worker spawn");
assert(schema.$defs.projectFactsStagedApplyPlan.properties.canWriteNow.const === false, "apply plan schema must forbid immediate writes");
assert(schema.$defs.projectFactsStagedApplyPlan.properties.projectVibeWritten.const === false, "apply plan schema must forbid project.vibe writes");
assert(schema.$defs.projectFactsStagedApplyPlan.properties.providerCalled.const === false, "apply plan schema must forbid provider calls");
assert(schema.$defs.projectFactsStagedApplyPlan.properties.workerSpawned.const === false, "apply plan schema must forbid worker spawn");
assert(
  schema.$defs.projectFactsStagedApplyPlan.properties.projectStorePatch.properties.operations.maxItems === 0,
  "apply plan schema must keep ProjectStorePatch operations unavailable",
);
assert(schema.$defs.projectStoreTypedValueSourcePreview.properties.canWriteNow.const === false, "preview schema must forbid immediate writes");
assert(schema.$defs.projectStoreTypedValueSourcePreview.properties.projectVibeWritten.const === false, "preview schema must forbid project.vibe writes");
assert(schema.$defs.projectStoreTypedValueSourcePreview.properties.providerCalled.const === false, "preview schema must forbid provider calls");
assert(schema.$defs.projectStoreTypedValueSourcePreview.properties.workerSpawned.const === false, "preview schema must forbid worker spawn");
assert(schema.$defs.projectStoreTypedValueMaterializationPreview.properties.canWriteNow.const === false, "materialization preview schema must forbid immediate writes");
assert(schema.$defs.projectStoreTypedValueMaterializationPreview.properties.projectVibeWritten.const === false, "materialization preview schema must forbid project.vibe writes");
assert(schema.$defs.projectStoreTypedValueMaterializationPreview.properties.providerCalled.const === false, "materialization preview schema must forbid provider calls");
assert(schema.$defs.projectStoreTypedValueMaterializationPreview.properties.workerSpawned.const === false, "materialization preview schema must forbid worker spawn");
assert(
  schema.$defs.projectStoreTypedValueMaterializationPreview.properties.projectStorePatch.properties.operations.maxItems === 0,
  "materialization preview schema must keep ProjectStorePatch operations unavailable",
);
assert(!JSON.stringify(confirmedRuntime).includes(process.cwd()), "runtime transaction must not persist absolute workspace paths");
const projectTransactionSource = fs.readFileSync("src/core/projectTransaction.ts", "utf8");
const typedPreviewSource = projectTransactionSource.slice(
  projectTransactionSource.indexOf("export function buildProjectStoreTypedValueSourcePreviewForStagedFacts"),
  projectTransactionSource.indexOf("function writePlan"),
);
for (const forbiddenEntry of [
  "buildProjectStoreIoGate",
  "executeProjectStoreIoGate",
  "saveProjectStoreSnapshot",
  "applyProjectStorePatch",
  "child_process",
  "spawn(",
  "provider.submit",
  "submitProvider",
  "executeProvider",
]) {
  assert(!typedPreviewSource.includes(forbiddenEntry), `typed value/source and materialization previews must not reference ${forbiddenEntry}`);
}

console.log(
  `Project transaction tests passed: missingTrace=${missingTraceRuntime.userStatus}, userOff=${parkedByUser.userStatus}, queued=${confirmedRuntime.queueIngestSummary.queued}, parked=${confirmedRuntime.queueIngestSummary.parked}.`,
);
