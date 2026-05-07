import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function transpile(sourcePath) {
  const resolved = path.resolve(sourcePath);
  return ts.transpileModule(fs.readFileSync(resolved, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      isolatedModules: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: resolved,
  }).outputText;
}

async function loadRuntimeTruthLayer() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-runtime-truth-layer-"));
  const coreDir = path.join(tmpDir, "src/core");
  fs.mkdirSync(coreDir, { recursive: true });
  fs.writeFileSync(path.join(coreDir, "freshRunContract.mjs"), transpile("src/core/freshRunContract.ts"), "utf8");
  const runtimeTruthLayer = transpile("src/core/runtimeTruthLayer.ts").replace(/from ["']\.\/freshRunContract["'];/g, 'from "./freshRunContract.mjs";');
  fs.writeFileSync(path.join(coreDir, "runtimeTruthLayer.mjs"), runtimeTruthLayer, "utf8");
  return import(pathToFileURL(path.join(coreDir, "runtimeTruthLayer.mjs")).href);
}

const {
  buildRuntimeTruthLayer,
  runtimeTruthLayerSchemaVersion,
  transitionTaskRunLifecycle,
} = await loadRuntimeTruthLayer();

const generatedAt = "2026-05-07T01:01:00.000Z";
const manifestGeneratedAt = "2026-05-07T01:00:00.000Z";
const freshAt = "2026-05-07T01:00:02.000Z";
const oldAt = "2026-05-06T23:59:00.000Z";
const expiresAt = "2026-05-07T01:05:00.000Z";
const expiredAt = "2026-05-07T00:59:00.000Z";
const runId = "runtime_truth_layer_mock_run";
const taskRunId = "task_run_S01";
const shotId = "S01";
const taskPacketId = "task_packet_S01";
const envelopeId = "envelope_S01";
const expectedOutputPath = "real-test-sandbox/runtime-truth-layer/outputs/shots/S01/start.png";
const providerSidecarPath = "real-test-sandbox/runtime-truth-layer/provider_observations/S01_start_provider_observation.json";
const semanticQaPath = "real-test-sandbox/runtime-truth-layer/semantic_qa/S01_start_semantic_qa.json";
const outputSha256 = "sha256:runtime-truth-layer-output";

function artifact(overrides = {}) {
  return {
    artifactPath: expectedOutputPath,
    exists: true,
    fileModifiedAt: freshAt,
    sizeBytes: 4096,
    outputSha256,
    mediaKind: "image",
    mediaFormat: "png",
    mediaReadable: true,
    width: 1920,
    height: 1080,
    ...overrides,
  };
}

function workerLease(overrides = {}) {
  return {
    exists: true,
    sidecarKind: "worker_provenance",
    provenanceMode: "actual_subagent_worker_lease_observed",
    sidecarPath: "real-test-sandbox/runtime-truth-layer/worker_provenance/S01_start_worker_provenance.json",
    sidecarModifiedAt: freshAt,
    leaseId: "lease_runtime_truth_S01",
    runId,
    taskRunId,
    taskPacketId,
    envelopeId,
    outputPath: expectedOutputPath,
    workerId: "worker_codex_cli_mock",
    subagentId: "subagent_image_worker_mock",
    threadId: "thread_runtime_truth",
    turnId: "turn_runtime_truth_001",
    toolCallId: "tool_call_image2_mock_001",
    leaseStartedAt: freshAt,
    leaseExpiresAt: expiresAt,
    retryBudget: 2,
    resumable: true,
    interrupted: false,
    resumed: false,
    ...overrides,
  };
}

function providerObservation(overrides = {}) {
  return {
    sidecarPath: providerSidecarPath,
    exists: true,
    sidecarModifiedAt: freshAt,
    generatedAt: freshAt,
    runId,
    taskRunId,
    taskPacketId,
    envelopeId,
    outputPath: expectedOutputPath,
    outputSha256,
    providerId: "image2_mock",
    providerObservationMode: "actual_provider_call_observed",
    workerId: "worker_codex_cli_mock",
    subagentId: "subagent_image_worker_mock",
    providerSelfReportedComplete: false,
    providerSelfReportCompletesTask: false,
    manualFileCopyDetected: false,
    fixtureReuseDetected: false,
    threadId: "thread_runtime_truth",
    turnId: "turn_runtime_truth_001",
    toolCallId: "tool_call_image2_mock_001",
    ...overrides,
  };
}

function semanticQa(overrides = {}) {
  return {
    sidecarPath: semanticQaPath,
    exists: true,
    sidecarModifiedAt: freshAt,
    reviewedAt: freshAt,
    runId,
    taskRunId,
    taskPacketId,
    envelopeId,
    outputPath: expectedOutputPath,
    reviewedOutputSha256: outputSha256,
    gates: {
      identity: "pass",
      scene: "pass",
      style: "pass",
      story: "pass",
      neighbor: "pass",
      output: "pass",
    },
    severityCounts: {
      p0: 0,
      p1: 0,
      p2: 0,
    },
    ...overrides,
  };
}

function watcherEvents(overrides = {}) {
  const providerPath = overrides.providerSidecarPath || providerSidecarPath;
  const qaPath = overrides.semanticQaPath || semanticQaPath;
  const eventAt = overrides.occurredAt || freshAt;
  return [
    {
      eventId: "rtl_watcher_001_file_observed",
      sequence: 1,
      eventType: "file_observed",
      occurredAt: eventAt,
      runId,
      taskRunId,
      taskPacketId,
      envelopeId,
      artifactPath: expectedOutputPath,
      outputPath: expectedOutputPath,
      sourceKind: "app_server_fs_changed",
    },
    {
      eventId: "rtl_watcher_002_file_stable",
      sequence: 2,
      eventType: "file_stable",
      occurredAt: eventAt,
      runId,
      taskRunId,
      taskPacketId,
      envelopeId,
      artifactPath: expectedOutputPath,
      outputPath: expectedOutputPath,
      sourceKind: "app_server_fs_changed",
    },
    {
      eventId: "rtl_watcher_003_hash_recorded",
      sequence: 3,
      eventType: "hash_recorded",
      occurredAt: eventAt,
      runId,
      taskRunId,
      taskPacketId,
      envelopeId,
      artifactPath: expectedOutputPath,
      outputPath: expectedOutputPath,
      outputSha256,
      sourceKind: "app_server_fs_changed",
    },
    {
      eventId: "rtl_watcher_004_provider_sidecar_paired",
      sequence: 4,
      eventType: "sidecar_paired",
      occurredAt: eventAt,
      runId,
      taskRunId,
      taskPacketId,
      envelopeId,
      artifactPath: expectedOutputPath,
      outputPath: expectedOutputPath,
      outputSha256,
      sourceKind: "app_server_fs_changed",
      sidecarKind: "provider_observation",
      sidecarPath: providerPath,
    },
    {
      eventId: "rtl_watcher_005_semantic_qa_paired",
      sequence: 5,
      eventType: "qa_paired",
      occurredAt: eventAt,
      runId,
      taskRunId,
      taskPacketId,
      envelopeId,
      artifactPath: expectedOutputPath,
      outputPath: expectedOutputPath,
      outputSha256,
      sourceKind: "app_server_fs_changed",
      sidecarKind: "semantic_qa",
      sidecarPath: qaPath,
    },
  ];
}

function input(overrides = {}) {
  return {
    generatedAt,
    runId,
    manifestGeneratedAt,
    taskRunId,
    shotId,
    taskPacketId,
    envelopeId,
    expectedOutputPath,
    artifact: artifact(),
    workerLease: workerLease(),
    providerObservation: providerObservation(),
    semanticQa: semanticQa(),
    watcherEvents: watcherEvents(),
    ...overrides,
  };
}

function expectBlocked(state, blocker, label) {
  assert(state.status === "blocked", `${label} should be blocked`);
  assert(state.blockers.includes(blocker), `${label} missing blocker ${blocker}: ${state.blockers.join("; ")}`);
}

const transition = transitionTaskRunLifecycle("prepared", "lease_recorded");
assert(transition.accepted === true && transition.to === "leased", "prepared -> leased transition should be accepted");
assert(transitionTaskRunLifecycle("prepared", "preview_ready").accepted === false, "prepared -> preview_ready must not skip the state machine");

const ready = buildRuntimeTruthLayer(input());
assert(ready.schemaVersion === runtimeTruthLayerSchemaVersion, "schema version drifted");
assert(ready.phase === "runtime_truth_layer", "phase drifted");
assert(ready.status === "preview_ready", `ready case should pass: ${ready.blockers.join("; ")}`);
assert(ready.lifecycle.currentStatus === "preview_ready", "ready lifecycle should reach preview_ready");
assert(ready.lifecycle.reachedStatuses.includes("semantic_qa_pending"), "ready lifecycle should pass through semantic_qa_pending");
assert(ready.workerLease.verified === true, "ready lease should be verified");
assert(ready.workerLease.provenanceModeActual === true, "ready lease should be actual worker provenance");
assert(ready.workerLease.sidecarIndependent === true, "ready lease sidecar should be independent");
assert(ready.providerObservation.verified === true, "ready provider observation should be verified");
assert(ready.providerObservation.protocolBindingPresent === true, "ready provider observation should bind thread/turn/toolCall");
assert(ready.providerObservation.protocolBindingMatched === true, "ready provider observation protocol should match the worker lease");
assert(ready.providerObservation.workerBindingPresent === true, "ready provider observation should bind worker/subagent");
assert(ready.providerObservation.workerBindingMatched === true, "ready provider observation worker/subagent should match the worker lease");
assert(ready.semanticQa.verified === true, "ready semantic QA should be verified");
assert(ready.watcherEventLog.verified === true, "ready watcher log should be verified");
assert(ready.freshRunContract.status === "ready", "ready fresh run contract should be ready");

const noOutput = buildRuntimeTruthLayer(input({
  artifact: artifact({ exists: false, fileModifiedAt: undefined, sizeBytes: 0 }),
}));
expectBlocked(noOutput, "runtime_truth_output_missing", "missing output");

const oldOutput = buildRuntimeTruthLayer(input({
  artifact: artifact({ fileModifiedAt: oldAt }),
}));
expectBlocked(oldOutput, "runtime_truth_output_stale", "old output");

const promptOnlyOutput = buildRuntimeTruthLayer(input({
  artifact: artifact({
    mediaKind: "unknown",
    mediaFormat: "unknown",
    mediaReadable: false,
    width: 0,
    height: 0,
  }),
}));
expectBlocked(promptOnlyOutput, "runtime_truth_output_not_image", "prompt-only output masquerading as image");
expectBlocked(promptOnlyOutput, "runtime_truth_output_image_unreadable", "unreadable image output");
expectBlocked(promptOnlyOutput, "runtime_truth_output_image_dimensions_missing", "missing image dimensions");

const oldProviderSidecar = buildRuntimeTruthLayer(input({
  providerObservation: providerObservation({
    sidecarModifiedAt: oldAt,
    generatedAt: oldAt,
  }),
}));
expectBlocked(oldProviderSidecar, "runtime_truth_provider_observation_generated_at_stale", "new output with old provider sidecar");

const noSemanticQa = buildRuntimeTruthLayer(input({
  semanticQa: {
    sidecarPath: semanticQaPath,
    exists: false,
  },
  watcherEvents: watcherEvents().filter((event) => event.eventType !== "qa_paired"),
}));
expectBlocked(noSemanticQa, "runtime_truth_semantic_qa_missing", "missing semantic QA");

const semanticHashMismatch = buildRuntimeTruthLayer(input({
  semanticQa: semanticQa({ reviewedOutputSha256: "sha256:wrong-output" }),
}));
expectBlocked(semanticHashMismatch, "runtime_truth_semantic_qa_hash_mismatch", "semantic QA hash mismatch");

const missingLease = buildRuntimeTruthLayer(input({
  workerLease: undefined,
}));
expectBlocked(missingLease, "runtime_truth_worker_lease_missing", "missing worker lease");

const expiredLease = buildRuntimeTruthLayer(input({
  workerLease: workerLease({ leaseExpiresAt: expiredAt }),
}));
expectBlocked(expiredLease, "runtime_truth_worker_lease_expired", "expired worker lease");

const mismatchedWorkerLeaseBinding = buildRuntimeTruthLayer(input({
  workerLease: workerLease({ taskRunId: "task_run_from_another_run" }),
}));
expectBlocked(mismatchedWorkerLeaseBinding, "runtime_truth_worker_lease_binding_mismatch", "worker lease binding mismatch");

const missingWorkerSidecar = buildRuntimeTruthLayer(input({
  workerLease: workerLease({ sidecarPath: "" }),
}));
expectBlocked(missingWorkerSidecar, "runtime_truth_worker_provenance_sidecar_missing", "missing worker provenance sidecar");

const providerSourcedWorkerSidecar = buildRuntimeTruthLayer(input({
  workerLease: workerLease({ sidecarPath: providerSidecarPath }),
}));
expectBlocked(providerSourcedWorkerSidecar, "runtime_truth_worker_provenance_sidecar_not_independent", "provider-sourced worker provenance sidecar");

const outputSourcedWorkerSidecar = buildRuntimeTruthLayer(input({
  workerLease: workerLease({ sidecarPath: expectedOutputPath }),
}));
expectBlocked(outputSourcedWorkerSidecar, "runtime_truth_worker_provenance_sidecar_not_independent", "output-sourced worker provenance sidecar");

const mismatchedWorkerSidecarKind = buildRuntimeTruthLayer(input({
  workerLease: workerLease({ sidecarKind: undefined }),
}));
expectBlocked(mismatchedWorkerSidecarKind, "runtime_truth_worker_provenance_sidecar_kind_mismatch", "worker provenance sidecar kind mismatch");

const verifyScanWatcher = buildRuntimeTruthLayer(input({
  watcherEvents: watcherEvents().map((event) => ({ ...event, sourceKind: "verify_scan" })),
}));
expectBlocked(verifyScanWatcher, "runtime_truth_watcher_source_not_actual", "verify scan watcher source");

const providerSelfReport = buildRuntimeTruthLayer(input({
  providerObservation: providerObservation({ providerSelfReportedComplete: true }),
}));
expectBlocked(providerSelfReport, "runtime_truth_provider_self_report_cannot_complete", "provider self-report completion");

const providerSelfCompletesTask = buildRuntimeTruthLayer(input({
  providerObservation: providerObservation({ providerSelfReportCompletesTask: true }),
}));
expectBlocked(providerSelfCompletesTask, "runtime_truth_provider_self_report_cannot_complete", "provider self-report completion alias");

const missingProviderProtocol = buildRuntimeTruthLayer(input({
  providerObservation: providerObservation({
    threadId: "",
  }),
}));
expectBlocked(missingProviderProtocol, "runtime_truth_provider_observation_protocol_binding_missing", "provider observation missing protocol binding");

const mismatchedProviderProtocol = buildRuntimeTruthLayer(input({
  providerObservation: providerObservation({
    toolCallId: "tool_call_from_another_run",
  }),
}));
expectBlocked(mismatchedProviderProtocol, "runtime_truth_provider_observation_protocol_binding_mismatch", "provider observation protocol mismatch");

const missingProviderWorkerBinding = buildRuntimeTruthLayer(input({
  providerObservation: providerObservation({
    workerId: "",
  }),
}));
expectBlocked(missingProviderWorkerBinding, "runtime_truth_provider_observation_worker_binding_missing", "provider observation missing worker binding");

const mismatchedProviderWorkerBinding = buildRuntimeTruthLayer(input({
  providerObservation: providerObservation({
    subagentId: "subagent_from_another_run",
  }),
}));
expectBlocked(mismatchedProviderWorkerBinding, "runtime_truth_provider_observation_worker_binding_mismatch", "provider observation worker mismatch");

const mockProviderObservation = buildRuntimeTruthLayer(input({
  providerObservation: providerObservation({ providerObservationMode: "mock_readiness_evidence" }),
}));
expectBlocked(mockProviderObservation, "runtime_truth_provider_observation_mode_not_actual", "mock provider observation mode");

const manualFileCopyProviderObservation = buildRuntimeTruthLayer(input({
  providerObservation: providerObservation({ manualFileCopyDetected: true }),
}));
expectBlocked(manualFileCopyProviderObservation, "runtime_truth_provider_observation_manual_file_copy_detected", "manual file copy provider observation");

const fixtureReuseProviderObservation = buildRuntimeTruthLayer(input({
  providerObservation: providerObservation({ fixtureReuseDetected: true }),
}));
expectBlocked(fixtureReuseProviderObservation, "runtime_truth_provider_observation_fixture_reuse_detected", "fixture reuse provider observation");

const incompleteQaGate = buildRuntimeTruthLayer(input({
  semanticQa: semanticQa({
    gates: {
      identity: "pass",
      scene: "pass",
      style: "pass",
      story: "pass",
      output: "pass",
    },
  }),
}));
expectBlocked(incompleteQaGate, "runtime_truth_semantic_qa_gates_incomplete", "incomplete semantic QA gates");

const p1Qa = buildRuntimeTruthLayer(input({
  semanticQa: semanticQa({
    severityCounts: {
      p0: 0,
      p1: 1,
      p2: 0,
    },
  }),
}));
expectBlocked(p1Qa, "runtime_truth_semantic_qa_p1_needs_review", "P1 semantic QA finding");

const nonAppendOnlyWatcher = buildRuntimeTruthLayer(input({
  watcherEvents: watcherEvents().map((event) => (
    event.eventId === "rtl_watcher_003_hash_recorded" ? { ...event, sequence: 1 } : event
  )),
}));
expectBlocked(nonAppendOnlyWatcher, "runtime_truth_watcher_log_not_append_only", "non append-only watcher log");

const mockFixtureWatcher = buildRuntimeTruthLayer(input({
  watcherEvents: watcherEvents().map((event) => ({ ...event, sourceKind: "mock_fixture" })),
}));
expectBlocked(mockFixtureWatcher, "runtime_truth_watcher_mock_fixture_source_detected", "mock fixture watcher source");

const freshRunBridge = buildRuntimeTruthLayer(input({
  semanticQa: semanticQa({ reviewedOutputSha256: "sha256:wrong-output" }),
}));
assert(
  freshRunBridge.blockers.includes("runtime_truth_fresh_run_semantic_qa_output_hash_mismatch"),
  "runtime truth layer should retain prefixed fresh-run blocker",
);

console.log("Runtime Truth Layer tests passed.");
