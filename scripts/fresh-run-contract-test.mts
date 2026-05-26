import { buildFreshRunContract, freshRunContractSchemaVersion } from "../src/core/freshRunContract.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const generatedAt = "2026-05-07T00:01:00.000Z";
const manifestGeneratedAt = "2026-05-07T00:00:00.000Z";
const freshAt = "2026-05-07T00:00:02.000Z";
const oldAt = "2026-05-06T23:59:00.000Z";
const outputSha256 = "sha256:fresh-output";

function artifact(overrides = {}) {
  return {
    artifactPath: "real-test-sandbox/real-demo-e2e/002-anime-pressure/outputs/shots/S01/start.png",
    exists: true,
    fileModifiedAt: freshAt,
    sizeBytes: 4096,
    outputSha256,
    ...overrides,
  };
}

function providerObservation(overrides = {}) {
  return {
    sidecarPath: "real-test-sandbox/real-demo-e2e/002-anime-pressure/provider_observations/S01_start_provider_observation.json",
    exists: true,
    sidecarModifiedAt: freshAt,
    sidecarGeneratedAt: freshAt,
    taskRunId: "task_run_S01",
    taskPacketId: "task_packet_S01",
    envelopeId: "envelope_S01",
    outputPath: "real-test-sandbox/real-demo-e2e/002-anime-pressure/outputs/shots/S01/start.png",
    outputSha256,
    ...overrides,
  };
}

function semanticQa(overrides = {}) {
  return {
    sidecarPath: "real-test-sandbox/real-demo-e2e/002-anime-pressure/semantic_qa/S01_start_semantic_qa.json",
    exists: true,
    sidecarModifiedAt: freshAt,
    reviewedAt: freshAt,
    taskRunId: "task_run_S01",
    taskPacketId: "task_packet_S01",
    envelopeId: "envelope_S01",
    outputPath: "real-test-sandbox/real-demo-e2e/002-anime-pressure/outputs/shots/S01/start.png",
    reviewedOutputSha256: outputSha256,
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    generatedAt,
    runId: "fresh_run_contract_test_run",
    manifestGeneratedAt,
    taskRunId: "task_run_S01",
    taskPacketId: "task_packet_S01",
    envelopeId: "envelope_S01",
    outputPath: "real-test-sandbox/real-demo-e2e/002-anime-pressure/outputs/shots/S01/start.png",
    artifact: artifact(),
    providerObservation: providerObservation(),
    semanticQa: semanticQa(),
    semanticQaRequired: true,
    ...overrides,
  };
}

const ready = buildFreshRunContract(input());
assert(ready.schemaVersion === freshRunContractSchemaVersion, "schema version drifted");
assert(ready.phase === "fresh_run_contract", "phase drifted");
assert(ready.status === "ready", `ready case should pass: ${ready.blockers.join("; ")}`);
assert(ready.verification.artifactFresh === true, "ready artifact must be fresh");
assert(ready.verification.providerObservationFresh === true, "ready provider sidecar must be fresh");
assert(ready.verification.semanticQaFresh === true, "ready semantic QA must be fresh");
assert(ready.verification.providerObservationHashMatched === true, "provider hash should bind");
assert(ready.verification.semanticQaHashMatched === true, "semantic QA hash should bind");
assert(ready.warnings.length === 0, "ready case should not warn when hash and semantic QA are present");

const noOutput = buildFreshRunContract(input({
  artifact: artifact({ exists: false, fileModifiedAt: undefined, sizeBytes: 0 }),
}));
assert(noOutput.status === "blocked", "missing output must block");
assert(noOutput.blockers.includes("fresh_run_artifact_missing"), "missing output blocker absent");

const oldOutput = buildFreshRunContract(input({
  artifact: artifact({ fileModifiedAt: oldAt }),
}));
assert(oldOutput.status === "blocked", "old output must block");
assert(oldOutput.blockers.includes("fresh_run_artifact_modified_at_missing_or_stale"), "old output blocker absent");

const oldProviderSidecar = buildFreshRunContract(input({
  providerObservation: providerObservation({
    sidecarModifiedAt: oldAt,
    sidecarGeneratedAt: oldAt,
  }),
}));
assert(oldProviderSidecar.status === "blocked", "old provider sidecar must block");
assert(oldProviderSidecar.blockers.includes("fresh_run_provider_observation_sidecar_stale"), "old provider sidecar file blocker absent");
assert(oldProviderSidecar.blockers.includes("fresh_run_provider_observation_generated_at_stale"), "old provider generatedAt blocker absent");

const noSemanticQa = buildFreshRunContract(input({
  semanticQa: {
    exists: false,
    sidecarPath: "real-test-sandbox/real-demo-e2e/002-anime-pressure/semantic_qa/S01_start_semantic_qa.json",
  },
}));
assert(noSemanticQa.status === "blocked", "missing semantic QA must block when required");
assert(noSemanticQa.blockers.includes("fresh_run_semantic_qa_missing"), "missing semantic QA blocker absent");

const bindingMismatch = buildFreshRunContract(input({
  providerObservation: providerObservation({
    taskRunId: "other_task_run",
    taskPacketId: "other_task_packet",
    envelopeId: "other_envelope",
    outputPath: "real-test-sandbox/real-demo-e2e/002-anime-pressure/outputs/shots/S02/start.png",
  }),
}));
assert(bindingMismatch.status === "blocked", "provider binding mismatch must block");
assert(bindingMismatch.blockers.includes("fresh_run_provider_observation_binding_mismatch"), "provider binding mismatch blocker absent");

const semanticBindingMismatch = buildFreshRunContract(input({
  semanticQa: semanticQa({
    taskRunId: "other_task_run",
    taskPacketId: "other_task_packet",
    envelopeId: "other_envelope",
    outputPath: "real-test-sandbox/real-demo-e2e/002-anime-pressure/outputs/shots/S02/start.png",
  }),
}));
assert(semanticBindingMismatch.status === "blocked", "semantic QA binding mismatch must block");
assert(semanticBindingMismatch.blockers.includes("fresh_run_semantic_qa_binding_mismatch"), "semantic QA binding mismatch blocker absent");

const outputPathMismatch = buildFreshRunContract(input({
  artifact: artifact({
    artifactPath: "real-test-sandbox/real-demo-e2e/002-anime-pressure/outputs/shots/S99/start.png",
  }),
}));
assert(outputPathMismatch.status === "blocked", "artifact outputPath mismatch must block");
assert(outputPathMismatch.blockers.includes("fresh_run_artifact_path_mismatch"), "artifact path mismatch blocker absent");

const providerHashMismatch = buildFreshRunContract(input({
  providerObservation: providerObservation({ outputSha256: "sha256:wrong" }),
}));
assert(providerHashMismatch.status === "blocked", "provider output hash mismatch must block");
assert(providerHashMismatch.blockers.includes("fresh_run_provider_observation_output_hash_mismatch"), "provider hash mismatch blocker absent");

const semanticHashMismatch = buildFreshRunContract(input({
  semanticQa: semanticQa({ reviewedOutputSha256: "sha256:wrong" }),
}));
assert(semanticHashMismatch.status === "blocked", "semantic QA reviewed hash mismatch must block");
assert(semanticHashMismatch.blockers.includes("fresh_run_semantic_qa_output_hash_mismatch"), "semantic hash mismatch blocker absent");

const noHashOptional = buildFreshRunContract(input({
  artifact: artifact({ outputSha256: undefined }),
  providerObservation: providerObservation({ outputSha256: undefined }),
  semanticQa: semanticQa({ reviewedOutputSha256: undefined }),
}));
assert(noHashOptional.status === "ready", `missing hash is optional: ${noHashOptional.blockers.join("; ")}`);
assert(noHashOptional.warnings.includes("fresh_run_output_sha256_not_provided_optional"), "missing hash warning absent");

const semanticOptional = buildFreshRunContract(input({
  semanticQaRequired: false,
  semanticQa: undefined,
}));
assert(semanticOptional.status === "ready", `semantic QA optional case should pass: ${semanticOptional.blockers.join("; ")}`);
assert(semanticOptional.verification.semanticQaRequired === false, "semantic QA optional flag drifted");
assert(semanticOptional.warnings.includes("fresh_run_semantic_qa_not_required_for_this_scenario"), "semantic optional warning absent");

console.log("Fresh Run Contract tests passed.");
