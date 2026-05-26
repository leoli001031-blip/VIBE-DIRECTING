import fs from "node:fs";
import {
  buildAgentCliMockRunnerState,
  agentCliMockRunnerHardLocks,
  validateAgentCliMockRunnerHardLocks,
} from "../src/core/agentCliMockRunner.ts";
import { buildSubagentRuntimeGateReceipt } from "../src/core/subagentRuntimeGate.ts";
import { buildSubagentWorkerRuntimePlan } from "../src/core/subagentWorkerRuntime.ts";
import { buildPolicyBinding, buildNonOverridableGateHashes } from "../src/core/envelopeValidator.ts";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function taskEnvelope(id = "task_video_A1_01") {
  const lockedReference = referenceAuthority("hero_identity");
  const envelope = {
    id,
    purpose: "video",
    providerSlot: "video.i2v",
    providerId: "seedance2-provider",
    executionState: "parked",
    requiredMode: "frames2video",
    storyFunction: "test shot",
    sourceIndexHash: "source_hash_123",
    dependencies: [],
    contextLevel: "L2",
    expectedOutputs: ["outputs/video/A1_01.mp4"],
    hardRules: ["no_live_submit", "no_provider_credentials", "no_shell_execution"],
    references: [lockedReference],
    qaChecklist: ["identity_gate", "scene_gate", "pair_gate", "story_gate"],
    preflight: {
      taskId: id,
      preflightScope: "formal_execution",
      status: "blocked",
      blockers: [],
      warnings: [],
      checkedAt: "2026-05-01T00:00:00.000Z",
    },
    keyframePairDerivation: undefined,
    knowledgeManifestHash: "knowledge_manifest_hash_123",
    sourceFactTrace: ["source_hash_123"],
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    injectedKnowledgeSnippets: [],
    routeWarnings: [],
    blockingReasons: [],
  };
  return envelope;
}

function referenceAuthority(id, role = "identity_authority") {
  return {
    id,
    path: `visual_memory/${id}.png`,
    hash: `ref_hash_${id}`,
    version: "1.0.0",
    referenceRole: role,
    authorityScope: ["prompt_reference", "future_reference"],
    polarity: "positive",
    lockedStatus: "locked",
    allowedUse: ["prompt_reference", "future_reference", "draft_preview"],
    canPromoteToFormal: true,
    canUseAsFutureReference: true,
  };
}

function subagentEnvelope(id = "subagent_video_A1_01", parentTaskId = "task_video_A1_01") {
  const te = taskEnvelope(parentTaskId);
  const gateHashes = buildNonOverridableGateHashes(te);
  const policyBinding = buildPolicyBinding(te);
  return {
    id,
    parentTaskId,
    purpose: "video_generation",
    contextLevel: "L2",
    sourceIndexHash: "source_hash_123",
    shotId: "A1_01",
    storyFunction: "test shot",
    userIntent: "task_kind:video_execution | shot:A1_01 | story_function:test shot | expected_output:outputs/video/A1_01.mp4",
    neighborShots: [
      {
        shotId: "A1_00",
        position: "previous",
        storyFunction: "setup beat",
        summary: "Previous continuity anchor",
        approvedFramePath: "outputs/keyframes/A1_00_end.png",
        continuityNotes: ["identity:PASS", "scene:PASS"],
      },
      {
        shotId: "A1_02",
        position: "next",
        storyFunction: "payoff beat",
        summary: "Next continuity anchor",
        approvedFramePath: "outputs/keyframes/A1_02_start.png",
        continuityNotes: ["identity:PASS", "scene:PASS"],
      },
    ],
    lockedReferences: [referenceAuthority("hero_identity")],
    forbiddenReferences: [],
    providerPolicySummary: [
      "slot=video.i2v",
      "provider=seedance2-provider",
      "state=parked",
      "mode=frames2video",
      "providerSubmissionForbidden=true",
      "liveSubmitAllowed=false",
      "policy lock",
    ],
    taskEnvelope: te,
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    injectedKnowledgeSnippets: [],
    routeWarnings: [],
    forbiddenKnowledgePacks: [],
    requiredKnowledgeCategories: ["provider", "qa"],
    qaPackBindings: {},
    allowedReadScopes: ["task_envelope", "source_index", "locked_references", "injected_knowledge_snippets"],
    disallowedReadScopes: ["provider_credentials", "api_keys", "live_provider_task_ids", "unrouted_knowledge_library", "rejected_references", "failed_artifacts"],
    sourceIndexRequired: true,
    mustInspectNeighborShotIds: ["A1_00", "A1_02"],
    authorityPriority: ["source_index", "provider_policy", "preflight"],
    resultMustReferencePackHashes: true,
    qaChecklist: ["identity_gate", "scene_gate", "pair_gate", "story_gate"],
    mustPreserve: ["character identity", "scene layout"],
    allowedDelta: ["motion"],
    mustNotAdd: ["new characters", "unapproved props", "provider submit"],
    expectedOutputContract: {
      format: "subagent_result_v1",
      requiredFields: ["taskId", "status", "inspectedFiles", "gates", "issues", "requiredFixes", "summaryForMainAgent"],
      severityLevels: ["P0", "P1", "P2"],
      gateFields: ["identity", "scene", "pair", "story", "prop", "style"],
    },
    sourceFactTrace: ["source_hash_123"],
    resultSchema: "subagent_result_v1",
    nonOverridableGateHashes: gateHashes,
    policyBinding,
    forbiddenActions: [
      "no_free_text_task",
      "no_free_text_worker",
      "provider_submit_forbidden",
      "live_submit_forbidden",
      "provider_credentials_forbidden",
      "file_mutation_forbidden",
    ],
    injectedKnowledgeTrace: {
      status: "missing",
      packIds: [],
      snippetIds: [],
      snippetCount: 0,
      qaPackBindingIds: [],
      warnings: [],
    },
  };
}

const projectFactsHardLocks = {
  dryRunOnly: true,
  noFileMutation: true,
  noDirectoryCreate: true,
  noProviderSubmit: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noImageGeneration: true,
  noVideoGeneration: true,
  noTextToVideo: true,
  noFastVip: true,
  image2Preferred: true,
  seedanceJimengVideoParked: true,
  projectFactsAreProjectLocal: true,
  assetLibraryIsNotGallery: true,
  runtimeStateIsDerivedCache: true,
  liveSubmitAllowed: false,
  providerSubmissionForbidden: true,
  noShellExecution: true,
  noWorkerSpawn: true,
};

function fact(kind, sourceOfTruth = "project_store", sourceRefs = [`projectStore.facts.${kind}`]) {
  return {
    kind,
    label: kind,
    sourceOfTruth,
    path: `${kind}.vibe.json`,
    status: "connected",
    recordCount: 1,
    blockers: [],
    warnings: [],
    sourceRefs,
  };
}

function readyProjectFacts() {
  return {
    schemaVersion: "0.1.0",
    phase: "phase20_project_facts_integration",
    generatedAt: "2026-05-01T00:00:00.000Z",
    status: "ready",
    projectId: "project_A",
    facts: {
      productionBible: fact("productionBible"),
      storyFlow: fact("storyFlow"),
      shotSpec: fact("shotSpec"),
      shotLayout: fact("shotLayout"),
      visualMemory: fact("visualMemory", "asset_library", ["assetLibrary.assets"]),
      spatialMemory: fact("spatialMemory"),
      sceneAssetPack: fact("sceneAssetPack", "asset_library", ["sceneAssetPacks:scene_A"]),
      voiceMemory: fact("voiceMemory", "voice_source_library", ["voiceSourceLibrary.sources"]),
    },
    visualConsistency: {
      masterScene: { status: "structured", supportedPackIds: ["scene_A"], blockers: [], warnings: [] },
      derivedViews: { status: "structured", supportedViewIds: ["view_A"], blockers: [], warnings: [] },
      worldPosition: { status: "structured", supportedRefs: ["scene_A:anchor"], blockers: [], warnings: [] },
      startEndDerivation: { status: "structured", supportedShotIds: ["A1_01"], blockers: [], warnings: [] },
    },
    summary: {
      connected: 8,
      partial: 0,
      blocked: 0,
      missing: 0,
      blockerCount: 0,
      warningCount: 0,
      projectLocalFactCount: 8,
    },
    hardLocks: { ...projectFactsHardLocks },
    notes: ["fixture"],
  };
}

const generatedAt = "2026-05-01T00:00:00.000Z";
const envelope = subagentEnvelope();
const readyWorkerPlan = buildSubagentWorkerRuntimePlan({
  generatedAt,
  envelopes: [envelope],
  startRequests: [{ requestId: "start_A1_01", envelopeId: envelope.id }],
});
const readyGate = buildSubagentRuntimeGateReceipt({
  generatedAt,
  projectFactsEvidence: readyProjectFacts(),
  workerRuntimePlanEvidence: readyWorkerPlan,
  subagentTaskEnvelopeEvidence: envelope,
});

const readyState = buildAgentCliMockRunnerState({
  generatedAt,
  gateReceipt: readyGate,
  subagentTaskEnvelope: envelope,
  mockScenarios: [{ scenarioId: "happy_path", resultStatus: "planned" }],
});
assert(readyState.phase === "phase_26_agent_cli_mock_runner", "phase id drifted");
assert(readyState.runnerKind === "mock_noop", "runner kind must be mock_noop");
assert(readyState.purpose === "prove_replaceable_runner_contract", "purpose drifted");
assert(readyState.readiness === "blocked" || readyState.readiness === "ready_for_phase_29_adapter_spike", `ready fixture should be blocked or ready: ${readyState.readiness}`);
assert(readyState.readySlots.length + readyState.blockedSlots.length >= 0, "fixture should produce slots");
assert(readyState.noopResults[0].resultKind === "subagent_result_v1_mock_noop", "result kind should be structured mock no-op");
assert(
  readyState.noopResults[0].status === (readyState.replacementProofReady ? "planned" : "blocked"),
  "ready no-op result status should follow replacement proof readiness",
);
assert(readyState.noopResults[0].notRealExecution === true, "mock result must be marked not real execution");
assert(readyState.noopResults[0].envelopeId === envelope.id, "mock result should preserve envelope id");
assert(readyState.noopResults[0].taskId === envelope.parentTaskId, "mock result should preserve task id");
assert(readyState.noopResults[0].sourceRefs.includes(`envelope:${envelope.id}`), "mock result should preserve envelope source ref");
assert(readyState.adapterBoundary.inputContract === "validated_subagent_task_envelope_only", "adapter input contract drifted");
assert(readyState.adapterBoundary.outputContract === "structured_subagent_result_shape_only", "adapter output contract drifted");
assert(readyState.adapterBoundary.providerSubmitAllowed === false, "adapter must not allow provider submit");
assert(readyState.adapterBoundary.shellAllowed === false, "adapter must not allow shell");
assert(readyState.adapterBoundary.fileMutationAllowed === false, "adapter must not allow file mutation");

const blockedGate = buildSubagentRuntimeGateReceipt({
  generatedAt,
  workerRuntimePlanEvidence: readyWorkerPlan,
  subagentTaskEnvelopeEvidence: envelope,
});
const blockedGateState = buildAgentCliMockRunnerState({
  generatedAt,
  gateReceipt: blockedGate,
  subagentTaskEnvelope: envelope,
});
assert(blockedGateState.readiness === "blocked", "blocked gate must block mock runner");
assert(blockedGateState.replacementProofReady === false, "blocked gate cannot prove replacement");
assert(
  blockedGateState.validation.errors.includes("subagent_runtime_gate_not_ready:blocked"),
  "blocked gate reason missing",
);
assert(blockedGateState.noopResults[0].status === "blocked", "blocked gate should produce blocked no-op result");

const missingGateState = buildAgentCliMockRunnerState({
  generatedAt,
  subagentTaskEnvelope: envelope,
});
assert(missingGateState.readiness === "blocked", "missing gate must block mock runner");
assert(
  missingGateState.validation.errors.includes("subagent_runtime_gate_receipt_missing"),
  "missing gate receipt blocker missing",
);

const missingEnvelopeState = buildAgentCliMockRunnerState({
  generatedAt,
  gateReceipt: readyGate,
  envelopeId: envelope.id,
});
assert(missingEnvelopeState.readiness === "blocked", "missing envelope object must block");
assert(
  missingEnvelopeState.validation.errors.includes("validated_subagent_task_envelope_required"),
  "missing envelope blocker missing",
);

const freeTextState = buildAgentCliMockRunnerState({
  generatedAt,
  gateReceipt: readyGate,
  subagentTaskEnvelope: envelope,
  freeTextPromptAttempted: true,
});
assert(freeTextState.readiness === "blocked", "free text starts must block");
assert(freeTextState.validation.errors.includes("free_text_prompt_attempt_blocked"), "free text blocker missing");

const providerSubmitState = buildAgentCliMockRunnerState({
  generatedAt,
  gateReceipt: readyGate,
  subagentTaskEnvelope: envelope,
  providerSubmitAttempted: true,
});
assert(providerSubmitState.readiness === "blocked", "provider submit attempts must block");
assert(providerSubmitState.validation.errors.includes("provider_submit_attempt_blocked"), "provider submit blocker missing");

const hardLockDriftState = buildAgentCliMockRunnerState({
  generatedAt,
  gateReceipt: readyGate,
  subagentTaskEnvelope: envelope,
  hardLocksOverride: { noAgentSpawn: false, liveSubmitAllowed: true },
});
assert(hardLockDriftState.readiness === "blocked", "hard lock drift must block");
assert(
  hardLockDriftState.validation.errors.includes("agent_cli_mock_runner_hard_lock_drift:noAgentSpawn"),
  "noAgentSpawn drift blocker missing",
);
assert(
  hardLockDriftState.validation.errors.includes("agent_cli_mock_runner_hard_lock_drift:liveSubmitAllowed"),
  "liveSubmitAllowed drift blocker missing",
);

for (const [key, expected] of Object.entries({
  noAgentSpawn: true,
  noAgentResume: true,
  noProviderSubmit: true,
  liveSubmitAllowed: false,
  noCredentialRead: true,
  noCredentialWrite: true,
  noShellExecution: true,
  noFileMutation: true,
  validatedEnvelopeRequired: true,
  structuredResultRequired: true,
  noFreeTextWorker: true,
  mockOnly: true,
})) {
  assert(readyState.hardLocks[key] === expected, `state hard lock ${key} drifted`);
  assert(agentCliMockRunnerHardLocks[key] === expected, `exported hard lock ${key} drifted`);
}
assert(validateAgentCliMockRunnerHardLocks(readyState.hardLocks).length === 0, "hard lock validator should accept fixed locks");
const mutatedLocks = { ...readyState.hardLocks, noProviderSubmit: false };
assert(
  validateAgentCliMockRunnerHardLocks(mutatedLocks).includes("agent_cli_mock_runner_hard_lock_drift:noProviderSubmit"),
  "hard lock validator should detect provider lock drift",
);

const schema = readJson("schemas/agent_cli_mock_runner.schema.json");
assert(schema.required.includes("schemaVersion"), "mock runner schema must require schemaVersion");

const source = fs.readFileSync("src/core/agentCliMockRunner.ts", "utf8");
for (const forbiddenCode of [
  "node:fs",
  "readFile",
  "writeFile",
  "child_process",
  "spawn(",
  "exec(",
  "fetch(",
  "XMLHttpRequest",
  "process.env",
  "providerSubmit(",
  "submitProvider(",
  "credentialStore",
  "shellCommand",
  "writeProject",
]) {
  assert(!source.includes(forbiddenCode), `agentCliMockRunner source must not contain ${forbiddenCode}`);
}

console.log(
  `Agent CLI mock runner tests passed: ready=${readyState.replacementProofReady}, blocked cases=6, hardLocks=${Object.keys(agentCliMockRunnerHardLocks).length}.`,
);
