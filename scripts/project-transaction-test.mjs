import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function transpile(sourcePath, rewrites = []) {
  let output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      isolatedModules: true,
    },
    fileName: sourcePath,
  }).outputText;
  for (const [from, to] of rewrites) output = output.replaceAll(from, to);
  return output;
}

async function loadModules() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-project-transaction-"));
  const modules = [
    ["storyChange.ts", "storyChange.mjs", []],
    ["directorEdit.ts", "directorEdit.mjs", [['from "./storyChange"', 'from "./storyChange.mjs"']]],
    ["providerCapabilities.ts", "providerCapabilities.mjs", []],
    ["knowledgeManifest.ts", "knowledgeManifest.mjs", []],
    ["knowledgeContextBudget.ts", "knowledgeContextBudget.mjs", [['from "./knowledgeManifest"', 'from "./knowledgeManifest.mjs"']]],
    ["knowledgeDefaults.ts", "knowledgeDefaults.mjs", [['from "./knowledgeManifest"', 'from "./knowledgeManifest.mjs"']]],
    ["knowledgeLibrary.ts", "knowledgeLibrary.mjs", [['from "./knowledgeManifest"', 'from "./knowledgeManifest.mjs"']]],
    [
      "knowledgeRouter.ts",
      "knowledgeRouter.mjs",
      [
        ['from "./knowledgeManifest"', 'from "./knowledgeManifest.mjs"'],
        ['from "./knowledgeContextBudget"', 'from "./knowledgeContextBudget.mjs"'],
      ],
    ],
    [
      "taskPacketBuilder.ts",
      "taskPacketBuilder.mjs",
      [
        ['from "./providerCapabilities"', 'from "./providerCapabilities.mjs"'],
        ['from "./knowledgeContextBudget"', 'from "./knowledgeContextBudget.mjs"'],
        ['from "./knowledgeDefaults"', 'from "./knowledgeDefaults.mjs"'],
        ['from "./knowledgeLibrary"', 'from "./knowledgeLibrary.mjs"'],
        ['from "./knowledgeManifest"', 'from "./knowledgeManifest.mjs"'],
        ['from "./knowledgeRouter"', 'from "./knowledgeRouter.mjs"'],
      ],
    ],
    ["taskRunLedger.ts", "taskRunLedger.mjs", []],
    ["artifactTransactionGate.ts", "artifactTransactionGate.mjs", [['from "./taskRunLedger"', 'from "./taskRunLedger.mjs"']]],
    [
      "runtimeIngestShell.ts",
      "runtimeIngestShell.mjs",
      [
        ['from "./artifactTransactionGate"', 'from "./artifactTransactionGate.mjs"'],
        ['from "./taskRunLedger"', 'from "./taskRunLedger.mjs"'],
      ],
    ],
    ["projectTransaction.ts", "projectTransaction.mjs", [['from "./runtimeIngestShell"', 'from "./runtimeIngestShell.mjs"']]],
    ["localOrchestrator.ts", "localOrchestrator.mjs", []],
    ["providerLiveGate.ts", "providerLiveGate.mjs", []],
    ["exportBuilder.ts", "exportBuilder.mjs", []],
    [
      "directorWorkflow.ts",
      "directorWorkflow.mjs",
      [
        ['from "./directorEdit"', 'from "./directorEdit.mjs"'],
        ['from "./exportBuilder"', 'from "./exportBuilder.mjs"'],
        ['from "./localOrchestrator"', 'from "./localOrchestrator.mjs"'],
        ['from "./providerLiveGate"', 'from "./providerLiveGate.mjs"'],
        ['from "./projectTransaction"', 'from "./projectTransaction.mjs"'],
        ['from "./taskPacketBuilder"', 'from "./taskPacketBuilder.mjs"'],
      ],
    ],
  ];

  for (const [sourceName, outputName, rewrites] of modules) {
    fs.writeFileSync(path.join(tmpDir, outputName), transpile(path.join("src/core", sourceName), rewrites), "utf8");
  }

  return {
    directorWorkflow: await import(pathToFileURL(path.join(tmpDir, "directorWorkflow.mjs")).href),
    projectTransaction: await import(pathToFileURL(path.join(tmpDir, "projectTransaction.mjs")).href),
  };
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

const {
  directorWorkflow: { buildDirectorWorkflowState },
  projectTransaction: {
    buildProjectTransactionRuntime,
    commitProjectPendingTransactionForRuntime,
    confirmProjectPendingTransactionForRuntime,
    stageProjectFactsForCommit,
  },
} = await loadModules();

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
const missingTraceStaged = commitProjectPendingTransactionForRuntime({
  runtime: missingTraceRuntime,
  confirmationReceipt: missingTraceReceipt,
});
assert(missingTraceStaged.status === "blocked_missing_knowledge_trace", "missing trace staged commit must fail closed");
assert(missingTraceStaged.pendingFactPatches.length === 0, "missing trace staged commit must not produce fact patches");
assert(missingTraceStaged.projectVibeWritten === false, "missing trace staged commit must not write project.vibe");
assert(missingTraceStaged.providerCalled === false, "missing trace staged commit must not call provider");
assert(missingTraceStaged.workerSpawned === false, "missing trace staged commit must not spawn workers");

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
const confirmedStaged = commitProjectPendingTransactionForRuntime({
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
const blockedExpectedOutputsStaged = commitProjectPendingTransactionForRuntime({
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
const missingQaStaged = commitProjectPendingTransactionForRuntime({
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
const missingEnvelopeStaged = commitProjectPendingTransactionForRuntime({
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
const waitingStaged = commitProjectPendingTransactionForRuntime({
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
assert(schema.$defs.projectFactsStagedCommitReceipt.properties.projectVibeWritten.const === false, "staged commit schema must forbid project.vibe writes");
assert(schema.$defs.projectFactsStagedCommitReceipt.properties.providerCalled.const === false, "staged commit schema must forbid provider calls");
assert(schema.$defs.projectFactsStagedCommitReceipt.properties.workerSpawned.const === false, "staged commit schema must forbid worker spawn");
assert(!JSON.stringify(confirmedRuntime).includes(process.cwd()), "runtime transaction must not persist absolute workspace paths");

console.log(
  `Project transaction tests passed: missingTrace=${missingTraceRuntime.userStatus}, userOff=${parkedByUser.userStatus}, queued=${confirmedRuntime.queueIngestSummary.queued}, parked=${confirmedRuntime.queueIngestSummary.parked}.`,
);
