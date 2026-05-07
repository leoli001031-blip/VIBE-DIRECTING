import {
  assert,
  buildSmallProjectAudit,
  loadCore,
  smallProjectFixture,
} from "./demo-runtime-fixture.mjs";

const generatedAt = "2026-05-07T03:00:00.000Z";
const manifestGeneratedAt = "2026-05-07T02:59:00.000Z";
const outputAt = "2026-05-07T02:59:10.000Z";
const outputSha256 = "sha256:runtime-truth-integration-output";
const binding = {
  runId: "runtime_truth_integration_run",
  taskRunId: "task_run_S01",
  taskPacketId: "task_packet_S01",
  envelopeId: "envelope_S01",
  outputPath: smallProjectFixture.outputPath,
  outputSha256,
};

function workerLease(overrides = {}) {
  return {
    exists: true,
    sidecarKind: "worker_provenance",
    provenanceMode: "actual_subagent_worker_lease_observed",
    sidecarPath: `${smallProjectFixture.batchRoot}/worker_provenance/S01_start_worker_provenance.json`,
    sidecarModifiedAt: outputAt,
    leaseId: "lease_runtime_truth_integration",
    runId: binding.runId,
    taskRunId: binding.taskRunId,
    taskPacketId: binding.taskPacketId,
    envelopeId: binding.envelopeId,
    outputPath: binding.outputPath,
    workerId: "worker_runtime_truth_integration",
    subagentId: "subagent_runtime_truth_integration",
    threadId: "thread_runtime_truth_integration",
    turnId: "turn_runtime_truth_integration_001",
    toolCallId: "tool_call_runtime_truth_integration_001",
    leaseStartedAt: outputAt,
    leaseExpiresAt: "2026-05-07T03:05:00.000Z",
    retryBudget: 1,
    resumable: true,
    interrupted: false,
    resumed: false,
    ...overrides,
  };
}

const {
  projectStateBuilder,
  providerPolicy,
  runtimeTruthLayer,
  runtimeTruthIngest,
  runtimeTruthReceipts,
  projectStore,
  projectVibeIo,
} = await loadCore();

const providerReceipt = runtimeTruthReceipts.buildProviderObservationReceiptV2({
  generatedAt: outputAt,
  sidecarPath: `${smallProjectFixture.batchRoot}/provider_observations/S01_start_provider_observation.json`,
  binding,
  providerId: "openai-image2-codex-cli",
  workerId: "worker_runtime_truth_integration",
  subagentId: "subagent_runtime_truth_integration",
  threadId: "thread_runtime_truth_integration",
  turnId: "turn_runtime_truth_integration_001",
  toolCallId: "tool_call_runtime_truth_integration_001",
  providerSelfReportedComplete: false,
});
const qaReceipt = runtimeTruthReceipts.buildSemanticQaReceiptV2({
  reviewedAt: outputAt,
  sidecarPath: `${smallProjectFixture.batchRoot}/semantic_qa/S01_start_semantic_qa.json`,
  binding,
  reviewerId: "semantic_qa_subagent_mock",
  gates: {
    identity: "pass",
    scene: "pass",
    style: "pass",
    story: "pass",
    neighbor: "pass",
    output: "pass",
  },
  severityCounts: { p0: 0, p1: 0, p2: 1 },
});
assert(providerReceipt.providerSelfReportCompletesTask === false, "provider receipt must never claim completion");
assert(providerReceipt.threadId && providerReceipt.turnId && providerReceipt.toolCallId, "provider receipt must bind protocol ids");
assert(qaReceipt.reviewedOutputSha256 === outputSha256, "semantic QA receipt must bind reviewedOutputSha256");
assert(qaReceipt.previewGate === "warning", "P2-only semantic QA should warn, not block");

const ingest = runtimeTruthIngest.buildRuntimeTruthWatcherEvents({
  generatedAt,
  sourceKind: "app_server_fs_changed",
  eventIdPrefix: "runtime_truth_integration",
  binding,
  file: {
    exists: true,
    stable: true,
    outputPath: binding.outputPath,
    outputSha256,
    observedAt: outputAt,
    stableAt: outputAt,
    hashRecordedAt: outputAt,
  },
  providerObservation: {
    exists: true,
    sidecarPath: providerReceipt.sidecarPath,
    pairedAt: outputAt,
    outputSha256,
  },
  semanticQa: {
    exists: true,
    sidecarPath: qaReceipt.sidecarPath,
    pairedAt: outputAt,
    outputSha256,
  },
});
assert(ingest.events.length === 5, `expected 5 watcher truth events, got ${ingest.events.length}`);
assert(ingest.events.every((event) => event.sourceKind === "app_server_fs_changed"), "watcher ingest events must retain sourceKind");
assert(ingest.events.every((event) => event.runId === binding.runId && event.taskRunId === binding.taskRunId), "watcher ingest must bind run/task ids");

const runtimeTruthInput = {
  generatedAt,
  runId: binding.runId,
  manifestGeneratedAt,
  taskRunId: binding.taskRunId,
  shotId: "S01",
  taskPacketId: binding.taskPacketId,
  envelopeId: binding.envelopeId,
  expectedOutputPath: binding.outputPath,
  artifact: {
    artifactPath: binding.outputPath,
    exists: true,
    fileModifiedAt: outputAt,
    sizeBytes: 4096,
    outputSha256,
    mediaKind: "image",
    mediaFormat: "png",
    mediaReadable: true,
    width: 1920,
    height: 1080,
  },
  workerLease: workerLease(),
  providerObservation: providerReceipt,
  semanticQa: qaReceipt,
  watcherEvents: ingest.events,
};
const ready = runtimeTruthLayer.buildRuntimeTruthLayer(runtimeTruthInput);
assert(ready.status === "preview_ready", `ready RuntimeTruthLayer should pass: ${ready.blockers.join("; ")}`);
assert(ready.warnings.includes("runtime_truth_semantic_qa_p2_note_present"), "P2 semantic QA should surface as warning");

const blocked = runtimeTruthLayer.buildRuntimeTruthLayer({
  ...runtimeTruthInput,
  artifact: {
    artifactPath: binding.outputPath,
    exists: false,
    sizeBytes: 0,
  },
  providerObservation: undefined,
  semanticQa: undefined,
  watcherEvents: [],
});
assert(blocked.status === "blocked", "missing runtime facts must block");
assert(blocked.blockers.includes("runtime_truth_output_missing"), "blocked RuntimeTruthLayer should explain missing output");

const audit = buildSmallProjectAudit(providerPolicy.defaultProviderPolicy, {
  ...smallProjectFixture,
  generatedAt,
});
const runtimeState = projectStateBuilder.buildProjectRuntimeState(audit, projectStateBuilder.emptyKnowledgeManifest, {
  generatedAt,
  selectedShotId: "S01",
  runtimeTruthLayerInput: runtimeTruthInput,
});
assert(runtimeState.runtimeTruthLayer?.status === "preview_ready", "ProjectRuntimeState builder must project ready RuntimeTruthLayer");
assert(runtimeState.runtimeTruthLayer?.taskRunId === binding.taskRunId, "ProjectRuntimeState RuntimeTruthLayer taskRunId drifted");

const blockedRuntimeState = projectStateBuilder.buildProjectRuntimeState(audit, projectStateBuilder.emptyKnowledgeManifest, {
  generatedAt,
  selectedShotId: "S01",
  runtimeTruthLayerInput: {
    ...runtimeTruthInput,
    artifact: {
      artifactPath: binding.outputPath,
      exists: false,
      sizeBytes: 0,
    },
    providerObservation: undefined,
    semanticQa: undefined,
    watcherEvents: [],
  },
});
assert(blockedRuntimeState.runtimeTruthLayer?.status === "blocked", "ProjectRuntimeState builder must preserve blocked RuntimeTruthLayer");

const snapshot = projectStore.createProjectStoreSnapshot({
  generatedAt,
  projectId: "runtime_truth_project_vibe_roundtrip",
  title: "Runtime Truth Project Vibe Roundtrip",
  storyFlow: {
    schemaVersion: "0.1.0",
    id: "story_flow_runtime_truth_roundtrip",
    sectionModel: "adaptive",
    sections: [],
    shots: [],
    shotOrder: [],
    sourceRefs: ["runtime-truth-integration-test"],
    updatedAt: generatedAt,
  },
  visualMemory: {
    schemaVersion: "0.1.0",
    id: "visual_memory_runtime_truth_roundtrip",
    assets: [],
    sourceRefs: ["runtime-truth-integration-test"],
    updatedAt: generatedAt,
  },
  sourceIndex: {
    projectId: "runtime_truth_project_vibe_roundtrip",
    projectVersion: "0.1.0",
    sourceIndexHash: "runtime_truth_project_vibe_hash",
  },
  sourceIndexHash: "runtime_truth_project_vibe_hash",
});
const roundtrip = await projectVibeIo.roundtripProjectVibeInMemory({
  mode: "save",
  generatedAt,
  snapshot,
  runtimeState: {
    schemaVersion: "0.1.0",
    runtimeTruthLayer: ready,
  },
});
assert(roundtrip.ok, `project.vibe memory roundtrip should pass: ${roundtrip.blockers.join("; ")}`);
assert(roundtrip.projectVibePresent, "project.vibe should be present in memory adapter");
assert(roundtrip.runtimeStatePresent, "runtime-state derived cache should be present in memory adapter");
assert(roundtrip.opened.openedSnapshot?.project.id === "runtime_truth_project_vibe_roundtrip", "opened project.vibe snapshot should preserve project id");

console.log("Runtime Truth integration tests passed: ingest, receipt writers, ProjectRuntimeState projection, and in-memory project.vibe roundtrip. No providers were called.");
