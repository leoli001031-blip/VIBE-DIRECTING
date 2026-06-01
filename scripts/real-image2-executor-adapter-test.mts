import { buildRealImage2ExecutorAdapterContract } from "../src/core/realImage2ExecutorAdapter.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixture() {
  const root = "real-test-sandbox/executor-adapter/project/run";
  const shotRoot = `${root}/real-trigger-one-shot/S01`;
  const receipt = {
    schemaVersion: "vibe_core_current_project_image2_one_shot_receipt_v1",
    receiptId: "image2_one_shot_prepare_project_S01_run",
    status: "prepared",
    projectId: "project",
    projectRoot: root,
    selectedShotId: "S01",
    selectedShotIds: ["S01"],
    imageCount: 1,
    oneShotOnly: true,
    expectedOutputPath: `${shotRoot}/image2-start.png`,
    providerObservationPath: `${shotRoot}/provider_observations/image2-start-provider-observation.json`,
    semanticQaPath: `${shotRoot}/semantic_qa/image2-start-semantic-qa.json`,
    transportMode: "agent_app_server",
    sandbox: {
      root: `${root}/real-trigger-one-shot`,
      shotRoot,
      manifestPath: `${shotRoot}/manifest.json`,
      qaReportPath: `${shotRoot}/qa/semantic-qa.json`,
      receiptStatePath: `${shotRoot}/state/prepare-receipt.json`,
      handoffStatePath: `${shotRoot}/state/handoff-packet.json`,
    },
    policy: {
      providerCalled: false,
      providerSubmitAllowed: 0,
      automaticSubmitAllowed: false,
      liveSubmitAllowed: false,
      externalNetworkIoAllowed: false,
      workerSpawnForbidden: true,
      projectVibeWritten: false,
    },
  };
  const handoff = {
    schemaVersion: "vibe_core_current_project_image2_one_shot_handoff_packet_v1",
    packetId: `handoff_${receipt.receiptId}`,
    receiptId: receipt.receiptId,
    status: "ready_for_manual_transport",
    projectId: receipt.projectId,
    projectRoot: receipt.projectRoot,
    selectedShotId: receipt.selectedShotId,
    selectedShotIds: receipt.selectedShotIds,
    imageCount: 1,
    requiresExternalAction: true,
    providerCalled: false,
    liveSubmitAllowed: false,
    workerSpawnForbidden: true,
    projectVibeWritten: false,
    expectedOutputPath: receipt.expectedOutputPath,
    providerObservationPath: receipt.providerObservationPath,
    semanticQaPath: receipt.semanticQaPath,
    receiptStatePath: receipt.sandbox.receiptStatePath,
    handoffStatePath: receipt.sandbox.handoffStatePath,
    transportPlan: {
      mode: "agent_app_server",
      target: "agent_app_server",
      endpoint: "/api/agent/app-server/image2/one-shot",
      externalCallPreparedOnly: true,
      actualExecutionAllowed: false,
      providerCalled: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
    },
    appServerContract: {
      mode: "agent_app_server_handoff_only",
      manualTransportRequired: true,
      automaticSubmitAllowed: false,
      actualExecutionAllowed: false,
    },
  };
  return { receipt, handoff };
}

const generatedAt = "2026-05-08T00:00:00.000Z";
const { receipt, handoff } = fixture();
const ready = buildRealImage2ExecutorAdapterContract({
  generatedAt,
  mode: "mock_executor",
  selectedShotId: "S01",
  receiptId: receipt.receiptId,
  expectedOutputPath: receipt.expectedOutputPath,
  persistedPrepareReceipt: receipt,
  persistedHandoffPacket: handoff,
});

assert(ready.schemaVersion === "0.1.0", "schema version drifted");
assert(ready.phase === "real_image2_executor_adapter_contract", "phase drifted");
assert(ready.status === "executor_ready_mock", "valid mock handoff should be ready");
assert(ready.providerCallContract.providerCalled === false, "contract must not call provider");
assert(ready.providerCallContract.externalNetworkIoAllowed === false, "contract must not allow network I/O");
assert(ready.providerCallContract.workerSpawnAllowed === false, "contract must not allow worker spawn");
assert(ready.providerCallContract.projectVibeMutationAllowed === false, "contract must not mutate project.vibe");
assert(ready.blockers.length === 0, `valid mock handoff should not block: ${ready.blockers.join("; ")}`);

const returned = buildRealImage2ExecutorAdapterContract({
  generatedAt,
  mode: "mock_executor",
  selectedShotId: "S01",
  receiptId: receipt.receiptId,
  expectedOutputPath: receipt.expectedOutputPath,
  persistedPrepareReceipt: receipt,
  persistedHandoffPacket: handoff,
  outputReturned: true,
});
assert(returned.status === "mock_output_returned_needs_review", "mock output should return needs_review");
assert(returned.outputReturnContract.watcherProjection.expectedOutputDetected === true, "mock output must project expected output");
assert(returned.outputReturnContract.providerObservation.providerObservationMode === "mock_readiness_evidence", "mock provider evidence mode missing");
assert(returned.outputReturnContract.previewProjection.needsHumanReview === true, "mock output must need human review");

const missingHandoff = buildRealImage2ExecutorAdapterContract({
  generatedAt,
  mode: "mock_executor",
  persistedPrepareReceipt: receipt,
});
assert(missingHandoff.status === "blocked", "missing handoff must block");
assert(missingHandoff.blockers.includes("Persisted handoff packet is required."), "missing handoff blocker missing");

const mismatchedReceipt = clone(receipt);
mismatchedReceipt.receiptId = "other_receipt";
const mismatch = buildRealImage2ExecutorAdapterContract({
  generatedAt,
  mode: "mock_executor",
  persistedPrepareReceipt: mismatchedReceipt,
  persistedHandoffPacket: handoff,
});
assert(mismatch.status === "blocked", "receipt mismatch must block");
assert(mismatch.blockers.includes("Handoff receiptId must match the persisted prepare receipt."), "receipt mismatch blocker missing");

const unsafe = clone(handoff);
unsafe.expectedOutputPath = "../outside.png";
const unsafePlan = buildRealImage2ExecutorAdapterContract({
  generatedAt,
  mode: "mock_executor",
  persistedPrepareReceipt: receipt,
  persistedHandoffPacket: unsafe,
});
assert(unsafePlan.status === "blocked", "unsafe output path must block");
assert(unsafePlan.blockers.includes("Handoff expectedOutputPath must match the persisted prepare receipt."), "unsafe mismatch blocker missing");

const manual = clone(handoff);
manual.transportPlan.mode = "manual";
manual.transportPlan.target = "manual";
const manualPlan = buildRealImage2ExecutorAdapterContract({
  generatedAt,
  mode: "mock_executor",
  persistedPrepareReceipt: receipt,
  persistedHandoffPacket: manual,
});
assert(manualPlan.status === "blocked", "non app-server transport must block");
assert(manualPlan.blockers.includes("Executor can only consume agent_app_server handoff transport."), "transport mode blocker missing");

const liveDrift = clone(handoff);
liveDrift.transportPlan.liveSubmitAllowed = true;
const liveDriftPlan = buildRealImage2ExecutorAdapterContract({
  generatedAt,
  mode: "mock_executor",
  persistedPrepareReceipt: receipt,
  persistedHandoffPacket: liveDrift,
});
assert(liveDriftPlan.status === "blocked", "live submit drift must block");
assert(liveDriftPlan.blockers.includes("Handoff transport plan must keep liveSubmitAllowed=false."), "live submit blocker missing");

const secret = buildRealImage2ExecutorAdapterContract({
  generatedAt,
  mode: "mock_executor",
  persistedPrepareReceipt: receipt,
  persistedHandoffPacket: handoff,
  realProviderGate: {
    explicitUserConfirmed: true,
    allowRealProviderCall: true,
    confirmationScope: "single_image2_one_shot",
    maxProviderCalls: 1,
    mainThreadFinalConfirmation: true,
  },
  credentialMaterial: "sk-should-not-appear",
});
assert(secret.status === "blocked", "raw credential material must block");
assert(secret.blockers.includes("Raw credential material is forbidden; executor may only see scoped references."), "raw credential blocker missing");

const realMode = buildRealImage2ExecutorAdapterContract({
  generatedAt,
  mode: "real_provider_call",
  persistedPrepareReceipt: receipt,
  persistedHandoffPacket: handoff,
  realProviderGate: {
    explicitUserConfirmed: true,
    allowRealProviderCall: true,
    confirmationScope: "single_image2_one_shot",
    maxProviderCalls: 1,
    mainThreadFinalConfirmation: true,
  },
});
assert(realMode.status === "blocked", "real provider mode must still block without live implementation");
assert(realMode.blockers.includes("Real provider execution remains blocked in this adapter until the main thread explicitly enables a live provider implementation."), "real provider blocker missing");

console.log("real-image2-executor-adapter tests passed");
