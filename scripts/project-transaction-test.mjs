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
  projectTransaction: { buildProjectTransactionRuntime },
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

const missingExpectedOutputs = mutateFirstQueuedPacket(hydratedWorkflow, confirmedRuntime, (packet) => {
  packet.envelope.taskEnvelope.expectedOutputs = [];
});
assertPacketMutationBlocks({
  workflowState: missingExpectedOutputs.workflowState,
  packetId: missingExpectedOutputs.packetId,
  expectedError: "expected_outputs_missing",
  label: "missing expected outputs",
});

const missingQaChecklist = mutateFirstQueuedPacket(hydratedWorkflow, confirmedRuntime, (packet) => {
  packet.envelope.taskEnvelope.qaChecklist = [];
});
assertPacketMutationBlocks({
  workflowState: missingQaChecklist.workflowState,
  packetId: missingQaChecklist.packetId,
  expectedError: "qa_checklist_missing",
  label: "missing QA checklist",
});

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
assert(confirmedRuntime.pendingTransaction.sourceFacts.sourceIndexHash === "source_hash_tx_123", "source facts must retain sourceIndexHash");
assert(confirmedRuntime.pendingTransaction.sourceFacts.taskEnvelopeIds.length === hydratedWorkflow.taskPacketState.summary.envelopeReady, "source facts must record task envelope ids");
assert(confirmedRuntime.pendingTransaction.sourceFacts.knowledgeInjectionTrace.status === "present", "hydrated trace should be present");
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

const schema = readJson("schemas/project_transaction.schema.json");
assert(schema.$id === "https://vibecore.local/schemas/project_transaction.schema.json", "project transaction schema id drifted");
assert(JSON.stringify(schema).includes("pending_only"), "schema must document pending_only write plan");
assert(!JSON.stringify(confirmedRuntime).includes(process.cwd()), "runtime transaction must not persist absolute workspace paths");

console.log(
  `Project transaction tests passed: missingTrace=${missingTraceRuntime.userStatus}, userOff=${parkedByUser.userStatus}, queued=${confirmedRuntime.queueIngestSummary.queued}, parked=${confirmedRuntime.queueIngestSummary.parked}.`,
);
