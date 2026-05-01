import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function transpile(path) {
  return ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: path,
  }).outputText;
}

function dataUrl(path, output) {
  return `data:text/javascript;base64,${Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64")}`;
}

async function importRuntimeModules() {
  const knowledgeManifestUrl = dataUrl("src/core/knowledgeManifest.ts", transpile("src/core/knowledgeManifest.ts"));
  const envelopeValidatorOutput = transpile("src/core/envelopeValidator.ts").replace(
    /from "\.\/knowledgeManifest";/g,
    `from "${knowledgeManifestUrl}";`,
  );
  const envelopeValidatorUrl = dataUrl("src/core/envelopeValidator.ts", envelopeValidatorOutput);
  const workerOutput = transpile("src/core/subagentWorkerRuntime.ts").replace(
    /from "\.\/envelopeValidator";/g,
    `from "${envelopeValidatorUrl}";`,
  );
  const gateOutput = transpile("src/core/subagentRuntimeGate.ts").replace(
    /from "\.\/envelopeValidator";/g,
    `from "${envelopeValidatorUrl}";`,
  );
  const runnerOutput = transpile("src/core/agentCliMockRunner.ts").replace(
    /from "\.\/envelopeValidator";/g,
    `from "${envelopeValidatorUrl}";`,
  );

  const [workerRuntime, runtimeGate, mockRunner] = await Promise.all([
    import(dataUrl("src/core/subagentWorkerRuntime.ts", workerOutput)),
    import(dataUrl("src/core/subagentRuntimeGate.ts", gateOutput)),
    import(dataUrl("src/core/agentCliMockRunner.ts", runnerOutput)),
  ]);

  return { workerRuntime, runtimeGate, mockRunner };
}

function taskEnvelope(id = "task_video_A1_01") {
  const lockedReference = referenceAuthority("hero_identity");
  return {
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
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    injectedKnowledgeSnippets: [],
    routeWarnings: [],
    blockingReasons: [],
  };
}

function referenceAuthority(id, role = "identity_authority") {
  return {
    id,
    path: `visual_memory/${id}.png`,
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
    providerPolicySummary: ["slot=video.i2v", "provider=seedance2-provider", "state=parked", "mode=frames2video"],
    taskEnvelope: taskEnvelope(parentTaskId),
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    injectedKnowledgeSnippets: [],
    routeWarnings: [],
    forbiddenKnowledgePacks: [],
    requiredKnowledgeCategories: ["provider", "qa"],
    qaPackBindings: {},
    allowedReadScopes: ["task_envelope", "locked_references", "injected_knowledge_snippets"],
    disallowedReadScopes: ["provider_credentials", "api_keys", "live_provider_task_ids", "unrouted_knowledge_library"],
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

const { workerRuntime, runtimeGate, mockRunner } = await importRuntimeModules();
const { buildSubagentWorkerRuntimePlan } = workerRuntime;
const { buildSubagentRuntimeGateReceipt } = runtimeGate;
const {
  buildAgentCliMockRunnerState,
  agentCliMockRunnerHardLocks,
  validateAgentCliMockRunnerHardLocks,
} = mockRunner;

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
assert(readyState.readiness === "ready_for_phase_29_adapter_spike", "ready fixture should prepare Phase 29");
assert(readyState.replacementProofReady === true, "replacement proof should be ready");
assert(readyState.readySlots.length === 1, "ready fixture should expose one ready slot");
assert(readyState.blockedSlots.length === 0, "ready fixture should not expose blocked slots");
assert(readyState.noopResults[0].resultKind === "subagent_result_v1_mock_noop", "result kind should be structured mock no-op");
assert(readyState.noopResults[0].status === "planned", "ready no-op result should be planned");
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
  hardLocksOverride: { noCodexSpawn: false, liveSubmitAllowed: true },
});
assert(hardLockDriftState.readiness === "blocked", "hard lock drift must block");
assert(
  hardLockDriftState.validation.errors.includes("agent_cli_mock_runner_hard_lock_drift:noCodexSpawn"),
  "noCodexSpawn drift blocker missing",
);
assert(
  hardLockDriftState.validation.errors.includes("agent_cli_mock_runner_hard_lock_drift:liveSubmitAllowed"),
  "liveSubmitAllowed drift blocker missing",
);

for (const [key, expected] of Object.entries({
  noCodexSpawn: true,
  noCodexResume: true,
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
assert(schema.title === "AgentCliMockRunnerState", "mock runner schema title missing");
assert(schema.properties.phase.const === "phase_26_agent_cli_mock_runner", "mock runner schema phase const missing");
assert(schema.properties.runnerKind.const === "mock_noop", "schema must pin mock runner kind");
assert(schema.properties.purpose.const === "prove_replaceable_runner_contract", "schema must pin purpose");
assert(schema.$defs.adapterBoundary.properties.inputContract.const === "validated_subagent_task_envelope_only", "schema input contract drifted");
assert(schema.$defs.adapterBoundary.properties.outputContract.const === "structured_subagent_result_shape_only", "schema output contract drifted");
assert(schema.$defs.adapterBoundary.properties.providerSubmitAllowed.const === false, "schema must pin provider submit false");
assert(schema.$defs.adapterBoundary.properties.shellAllowed.const === false, "schema must pin shell false");
assert(schema.$defs.adapterBoundary.properties.fileMutationAllowed.const === false, "schema must pin file mutation false");
assert(schema.$defs.noopResult.properties.resultKind.const === "subagent_result_v1_mock_noop", "schema must pin mock result kind");
assert(schema.$defs.noopResult.properties.notRealExecution.const === true, "schema must mark not real execution");
for (const [key, expected] of Object.entries(agentCliMockRunnerHardLocks)) {
  assert(schema.$defs.hardLocks.properties[key].const === expected, `schema hardLocks must pin ${key}=${expected}`);
}

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
