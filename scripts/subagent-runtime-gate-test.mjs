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

  const [workerRuntime, runtimeGate] = await Promise.all([
    import(dataUrl("src/core/subagentWorkerRuntime.ts", workerOutput)),
    import(dataUrl("src/core/subagentRuntimeGate.ts", gateOutput)),
  ]);

  return { workerRuntime, runtimeGate };
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

function readyProjectFacts(overrides = {}) {
  const facts = {
    productionBible: fact("productionBible"),
    storyFlow: fact("storyFlow"),
    shotSpec: fact("shotSpec"),
    shotLayout: fact("shotLayout"),
    visualMemory: fact("visualMemory", "asset_library", ["assetLibrary.assets"]),
    spatialMemory: fact("spatialMemory"),
    sceneAssetPack: fact("sceneAssetPack", "asset_library", ["sceneAssetPacks:scene_A"]),
    voiceMemory: fact("voiceMemory", "voice_source_library", ["voiceSourceLibrary.sources"]),
  };

  return {
    schemaVersion: "0.1.0",
    phase: "phase20_project_facts_integration",
    generatedAt: "2026-05-01T00:00:00.000Z",
    status: "ready",
    projectId: "project_A",
    facts,
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
    ...overrides,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const { workerRuntime, runtimeGate } = await importRuntimeModules();
const {
  buildSubagentWorkerRuntimePlan,
} = workerRuntime;
const {
  buildSubagentRuntimeGateReceipt,
  subagentRuntimeGateHardLocks,
  validateSubagentRuntimeGateHardLocks,
} = runtimeGate;

const generatedAt = "2026-05-01T00:00:00.000Z";
const envelope = subagentEnvelope();
const readyWorkerPlan = buildSubagentWorkerRuntimePlan({
  generatedAt,
  envelopes: [envelope],
  startRequests: [{ requestId: "start_A1_01", envelopeId: envelope.id }],
});

const readyReceipt = buildSubagentRuntimeGateReceipt({
  generatedAt,
  projectFactsEvidence: readyProjectFacts(),
  workerRuntimePlanEvidence: readyWorkerPlan,
  subagentTaskEnvelopeEvidence: envelope,
});
assert(readyReceipt.phase === "phase_24_subagent_runtime_gate", "phase id drifted");
assert(readyReceipt.readiness === "ready_for_worker_permission_gate", "ready fixture should pass the worker permission gate");
assert(readyReceipt.blockedReasons.length === 0, "ready fixture must have no blocked reasons");
assert(readyReceipt.validation.ok === true, "ready receipt validation should pass");
assert(readyReceipt.evidence.projectFacts.ready === true, "project facts should be ready");
assert(readyReceipt.evidence.projectFacts.runtimeStateSourceOfTruthRefs.length === 0, "runtime_state must not be a source of truth");
assert(readyReceipt.evidence.workerRuntime.validationOk === true, "worker runtime validation should be ok");
assert(readyReceipt.evidence.subject.envelopeValidationStatus === "valid", "envelope must validate");
assert(readyReceipt.evidence.subject.freeTextPromptPresent === false, "free text must be absent");
assert(readyReceipt.evidence.subject.commandPlanArgumentSource === "validated_envelope_only", "command plan must use validated envelope only");
assert(readyReceipt.commandPlanGate.canSpawnNow === false, "gate must not spawn now");
assert(readyReceipt.commandPlanGate.canUseShell === false, "gate must not use shell");
assert(readyReceipt.commandPlanGate.canSubmitProvider === false, "gate must not submit provider");
assert(readyReceipt.providerGate.providerSubmissionForbidden === true, "provider submission must be forbidden");
assert(readyReceipt.providerGate.liveSubmitAllowed === false, "live submit must be false");
assert(readyReceipt.roadmapEvidence.projectFactsValidated === true, "roadmap evidence must mark project facts valid");
assert(readyReceipt.roadmapEvidence.subagentEnvelopeValidatorReady === true, "roadmap evidence must mark envelope validator ready");
assert(readyReceipt.roadmapEvidence.workerPermissionGateReady === true, "roadmap evidence must mark worker gate ready");

const missingProjectFacts = buildSubagentRuntimeGateReceipt({
  generatedAt,
  workerRuntimePlanEvidence: readyWorkerPlan,
  subagentTaskEnvelopeEvidence: envelope,
});
assert(missingProjectFacts.readiness === "blocked", "missing project facts must block");
assert(missingProjectFacts.blockedReasons.includes("project_facts_evidence_missing"), "missing project facts blocker missing");

const runtimeStateProjectFacts = readyProjectFacts();
runtimeStateProjectFacts.facts.storyFlow = fact("storyFlow", "runtime_state", ["runtimeState.storyFlow"]);
const runtimeStateBlocked = buildSubagentRuntimeGateReceipt({
  generatedAt,
  projectFactsEvidence: runtimeStateProjectFacts,
  workerRuntimePlanEvidence: readyWorkerPlan,
  subagentTaskEnvelopeEvidence: envelope,
});
assert(runtimeStateBlocked.readiness === "blocked", "runtime_state source of truth must block");
assert(
  runtimeStateBlocked.blockedReasons.some((reason) => reason.startsWith("runtime_state_source_of_truth_forbidden:storyFlow")),
  "runtime_state source blocker missing",
);

const freeTextWorkerPlan = buildSubagentWorkerRuntimePlan({
  generatedAt,
  envelopes: [envelope],
  startRequests: [{ requestId: "bad_free_text", envelopeId: envelope.id, freeTextPrompt: "just check it however" }],
});
const freeTextBlocked = buildSubagentRuntimeGateReceipt({
  generatedAt,
  projectFactsEvidence: readyProjectFacts(),
  workerRuntimePlanEvidence: freeTextWorkerPlan,
  workerRuntimeSlotEvidence: freeTextWorkerPlan.slots[0],
});
assert(freeTextBlocked.readiness === "blocked", "free text worker starts must block");
assert(
  freeTextBlocked.blockedReasons.some((reason) => reason.includes("free_text_worker_start_forbidden")),
  "free text blocker missing",
);

const invalidEnvelope = {
  ...subagentEnvelope("invalid_envelope", "task_invalid"),
  resultMustReferencePackHashes: false,
  disallowedReadScopes: [],
};
const invalidWorkerPlan = buildSubagentWorkerRuntimePlan({
  generatedAt,
  envelopes: [invalidEnvelope],
});
const invalidEnvelopeBlocked = buildSubagentRuntimeGateReceipt({
  generatedAt,
  projectFactsEvidence: readyProjectFacts(),
  workerRuntimePlanEvidence: invalidWorkerPlan,
  subagentTaskEnvelopeEvidence: invalidEnvelope,
});
assert(invalidEnvelopeBlocked.readiness === "blocked", "invalid envelope must block");
assert(
  invalidEnvelopeBlocked.blockedReasons.some((reason) => reason.includes("invalid_envelope:subagent_result_pack_hash_reference_not_required")),
  "invalid envelope blocker missing",
);
assert(
  invalidEnvelopeBlocked.blockedReasons.some((reason) => reason.includes("invalid_envelope:subagent_disallowed_read_scopes_missing")),
  "invalid read scope blocker missing",
);

const phase38IncompleteEnvelope = {
  ...subagentEnvelope("phase38_incomplete", "task_phase38_incomplete"),
  userIntent: "",
  neighborShots: [],
  lockedReferences: [],
};
const phase38IncompletePlan = buildSubagentWorkerRuntimePlan({
  generatedAt,
  envelopes: [phase38IncompleteEnvelope],
});
const phase38IncompleteBlocked = buildSubagentRuntimeGateReceipt({
  generatedAt,
  projectFactsEvidence: readyProjectFacts(),
  workerRuntimePlanEvidence: phase38IncompletePlan,
  subagentTaskEnvelopeEvidence: phase38IncompleteEnvelope,
});
assert(phase38IncompleteBlocked.readiness === "blocked", "Phase38 incomplete envelope must block");
for (const blocker of [
  "phase38_context_capsule_missing",
  "phase38_reference_authority_missing",
  "phase38_before_after_shots_missing",
]) {
  assert(phase38IncompleteBlocked.blockedReasons.includes(blocker), `Phase38 blocker ${blocker} missing`);
}

const driftedWorkerPlan = clone(readyWorkerPlan);
driftedWorkerPlan.summary.providerSubmissionForbidden = false;
driftedWorkerPlan.summary.liveSubmitAllowed = true;
driftedWorkerPlan.hardLocks.providerSubmissionForbidden = false;
driftedWorkerPlan.hardLocks.liveSubmitAllowed = true;
const providerSubmitBlocked = buildSubagentRuntimeGateReceipt({
  generatedAt,
  projectFactsEvidence: readyProjectFacts(),
  workerRuntimePlanEvidence: driftedWorkerPlan,
  subagentTaskEnvelopeEvidence: envelope,
  providerSubmissionAttempted: true,
});
assert(providerSubmitBlocked.readiness === "blocked", "provider submit attempt and hard lock drift must block");
for (const blocker of [
  "provider_submit_attempt_blocked",
  "worker_runtime_hard_lock_drift:providerSubmissionForbidden",
  "worker_runtime_hard_lock_drift:liveSubmitAllowed",
  "worker_runtime_provider_submission_forbidden_not_pinned",
  "worker_runtime_live_submit_allowed_drift",
]) {
  assert(providerSubmitBlocked.blockedReasons.includes(blocker), `provider/drift blocker ${blocker} missing`);
}

for (const [key, expected] of Object.entries({
  noFreeTextWorker: true,
  validatedEnvelopeRequired: true,
  structuredResultRequired: true,
  noSpawnNow: true,
  noShellExecution: true,
  noProviderSubmit: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
  noCredentialRead: true,
  noCredentialWrite: true,
  noFileMutation: true,
  projectFactsEvidenceRequired: true,
  workerRuntimePlanEvidenceRequired: true,
  runtimeStateSourceOfTruthForbidden: true,
})) {
  assert(readyReceipt.hardLocks[key] === expected, `receipt hard lock ${key} drifted`);
  assert(subagentRuntimeGateHardLocks[key] === expected, `exported hard lock ${key} drifted`);
}
assert(validateSubagentRuntimeGateHardLocks(readyReceipt.hardLocks).length === 0, "hard lock validator should accept fixed locks");
const mutatedLocks = { ...readyReceipt.hardLocks, noShellExecution: false };
assert(
  validateSubagentRuntimeGateHardLocks(mutatedLocks).includes("subagent_runtime_gate_hard_lock_drift:noShellExecution"),
  "hard lock validator should detect drift",
);

const schema = readJson("schemas/subagent_runtime_gate.schema.json");
const schemaRegistrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(
  schemaRegistrySource.includes("subagent_runtime_gate.schema.json") &&
    schemaRegistrySource.includes("SubagentRuntimeGateReceipt"),
  "schema registry must include SubagentRuntimeGateReceipt",
);
assert(schema.title === "SubagentRuntimeGateReceipt", "schema title missing");
assert(schema.properties.phase.const === "phase_24_subagent_runtime_gate", "schema phase const missing");
assert(
  schema.$defs.commandPlanGate.properties.argumentSourceRequired.const === "validated_envelope_only",
  "schema must require validated-envelope-only command arguments",
);
assert(schema.$defs.commandPlanGate.properties.canSpawnNow.const === false, "schema must pin no spawn");
assert(schema.$defs.commandPlanGate.properties.canUseShell.const === false, "schema must pin no shell");
assert(schema.$defs.commandPlanGate.properties.canSubmitProvider.const === false, "schema must pin no provider submit");
assert(schema.$defs.providerGate.properties.providerSubmissionForbidden.const === true, "schema must pin provider submit forbidden");
assert(schema.$defs.providerGate.properties.liveSubmitAllowed.const === false, "schema must pin live submit false");
for (const [key, expected] of Object.entries(subagentRuntimeGateHardLocks)) {
  assert(schema.$defs.hardLocks.properties[key].const === expected, `schema hardLocks must pin ${key}=${expected}`);
}

const source = fs.readFileSync("src/core/subagentRuntimeGate.ts", "utf8");
for (const forbiddenCode of ["node:fs", "readFile", "writeFile", "child_process", "spawn(", "exec(", "fetch(", "XMLHttpRequest", "process.env"]) {
  assert(!source.includes(forbiddenCode), `subagentRuntimeGate source must not contain ${forbiddenCode}`);
}

console.log(
  `Subagent runtime gate tests passed: ready=${readyReceipt.readiness}, blocked cases=6, hardLocks=${Object.keys(subagentRuntimeGateHardLocks).length}.`,
);
