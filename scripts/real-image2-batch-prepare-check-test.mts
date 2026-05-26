import {
  assert,
  loadCore,
  smallProjectFixture,
} from "./demo-runtime-fixture.mts";

const generatedAt = "2026-05-07T04:00:00.000Z";
const manifestGeneratedAt = "2026-05-07T03:59:00.000Z";
const outputAt = "2026-05-07T03:59:20.000Z";
const { runtimeTruthLayer, runtimeTruthIngest, runtimeTruthReceipts } = await loadCore();

const plans = ["S01", "S02"].map((shotId, index) => ({
  shotId,
  providerId: "openai-image2-agent-cli",
  providerSlot: "image.generate",
  taskRunId: `task_run_${shotId}`,
  taskPacketId: `task_packet_${shotId}`,
  envelopeId: `envelope_${shotId}`,
  expectedOutputPath: `${smallProjectFixture.batchRoot}/image2-prep/${shotId}/start.png`,
  providerObservationPath: `${smallProjectFixture.batchRoot}/image2-prep/${shotId}/provider_observation.json`,
  semanticQaPath: `${smallProjectFixture.batchRoot}/image2-prep/${shotId}/semantic_qa.json`,
  promptPath: `${smallProjectFixture.projectRoot}/prompts/${shotId}_start.md`,
  referencePaths: [smallProjectFixture.characterPath, smallProjectFixture.scenePath, smallProjectFixture.stylePath],
  submitPolicy: {
    providerCallAllowed: false,
    dryRunOnly: true,
    noSeedance: true,
    noJimeng: true,
    noVideo: true,
    noFast: true,
    noVip: true,
  },
  queueOrder: index + 1,
}));

assert(plans.length === 2, "prepare/check should generate 1-2 Image2 plans");
assert(plans.every((plan) => plan.providerId === "openai-image2-agent-cli"), "plans must target Image2 agent CLI only");
assert(plans.every((plan) => plan.submitPolicy.providerCallAllowed === false && plan.submitPolicy.dryRunOnly === true), "plans must not allow provider calls");
assert(plans.every((plan) => plan.referencePaths.length === 3), "plans must carry locked character/scene/style references");

function blockedRuntimeTruthFor(plan) {
  return runtimeTruthLayer.buildRuntimeTruthLayer({
    generatedAt,
    runId: "real_image2_batch_prepare_check",
    manifestGeneratedAt,
    taskRunId: plan.taskRunId,
    shotId: plan.shotId,
    taskPacketId: plan.taskPacketId,
    envelopeId: plan.envelopeId,
    expectedOutputPath: plan.expectedOutputPath,
    artifact: {
      artifactPath: plan.expectedOutputPath,
      exists: false,
      sizeBytes: 0,
    },
    workerLease: undefined,
    providerObservation: undefined,
    semanticQa: undefined,
    watcherEvents: [],
  });
}

for (const plan of plans) {
  const blocked = blockedRuntimeTruthFor(plan);
  assert(blocked.status === "blocked", "missing real output must block prepared Image2 runtime truth");
  assert(blocked.blockers.includes("runtime_truth_output_missing"), "prepared Image2 runtime truth must require real output");
}

const mockPlan = plans[0];
const outputSha256 = "sha256:real-image2-batch-prepare-mock-output";
const binding = {
  runId: "real_image2_batch_prepare_check",
  taskRunId: mockPlan.taskRunId,
  taskPacketId: mockPlan.taskPacketId,
  envelopeId: mockPlan.envelopeId,
  outputPath: mockPlan.expectedOutputPath,
  outputSha256,
};
const providerReceipt = runtimeTruthReceipts.buildProviderObservationReceiptV2({
  generatedAt: outputAt,
  sidecarPath: mockPlan.providerObservationPath,
  binding,
  providerId: mockPlan.providerId,
  providerObservationMode: "mock_readiness_evidence",
  workerId: "worker_mock_image2_batch",
  subagentId: "subagent_mock_image2_batch",
  threadId: "thread_mock_image2_batch",
  turnId: "turn_mock_image2_batch_001",
  toolCallId: "tool_call_mock_image2_batch_001",
});
const qaReceipt = runtimeTruthReceipts.buildSemanticQaReceiptV2({
  reviewedAt: outputAt,
  sidecarPath: mockPlan.semanticQaPath,
  binding,
  reviewerId: "semantic_qa_mock",
  gates: {
    identity: "pass",
    scene: "pass",
    style: "pass",
    story: "pass",
    neighbor: "pass",
    output: "pass",
  },
});
const ingest = runtimeTruthIngest.buildRuntimeTruthWatcherEvents({
  generatedAt,
  sourceKind: "mock_fixture",
  eventIdPrefix: "real_image2_batch_prepare_mock",
  binding,
  file: {
    exists: true,
    stable: true,
    outputPath: mockPlan.expectedOutputPath,
    outputSha256,
    observedAt: outputAt,
    stableAt: outputAt,
    hashRecordedAt: outputAt,
  },
  providerObservation: {
    exists: true,
    sidecarPath: providerReceipt.sidecarPath,
    outputSha256,
    pairedAt: outputAt,
  },
  semanticQa: {
    exists: true,
    sidecarPath: qaReceipt.sidecarPath,
    outputSha256,
    pairedAt: outputAt,
  },
});
const mockBlocked = runtimeTruthLayer.buildRuntimeTruthLayer({
  generatedAt,
  runId: binding.runId,
  manifestGeneratedAt,
  taskRunId: binding.taskRunId,
  shotId: mockPlan.shotId,
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
  workerLease: {
    exists: true,
    sidecarKind: "worker_provenance",
    provenanceMode: "actual_subagent_worker_lease_observed",
    sidecarPath: `${smallProjectFixture.batchRoot}/image2-prep/${mockPlan.shotId}/worker_provenance.json`,
    sidecarModifiedAt: outputAt,
    leaseId: "lease_mock_image2_batch",
    runId: binding.runId,
    taskRunId: binding.taskRunId,
    taskPacketId: binding.taskPacketId,
    envelopeId: binding.envelopeId,
    outputPath: binding.outputPath,
    workerId: "worker_mock_image2_batch",
    subagentId: "subagent_mock_image2_batch",
    threadId: "thread_mock_image2_batch",
    turnId: "turn_mock_image2_batch_001",
    toolCallId: "tool_call_mock_image2_batch_001",
    leaseStartedAt: outputAt,
    leaseExpiresAt: "2026-05-07T04:05:00.000Z",
    retryBudget: 1,
    resumable: true,
    interrupted: false,
    resumed: false,
  },
  providerObservation: providerReceipt,
  semanticQa: qaReceipt,
  watcherEvents: ingest.events,
});
assert(mockBlocked.status === "blocked", "mock fixture facts must not unlock real preview_ready");
assert(
  mockBlocked.blockers.includes("runtime_truth_provider_observation_mode_not_actual"),
  "mock provider observation mode must block real RuntimeTruthLayer readiness",
);
assert(
  mockBlocked.blockers.includes("runtime_truth_watcher_mock_fixture_source_detected"),
  "mock watcher source must block real RuntimeTruthLayer readiness",
);
assert(mockBlocked.notes.some((note) => note.includes("does not submit providers")), "mock blocked state should still declare no provider submission");

console.log("Real Image2 batch prepare/check tests passed: 2 dry plans blocked without outputs, mock receipt facts blocked from real preview_ready. No provider calls were made.");
