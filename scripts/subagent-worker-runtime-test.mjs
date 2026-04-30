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

async function importWorkerRuntime() {
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
  return import(dataUrl("src/core/subagentWorkerRuntime.ts", workerOutput));
}

function taskEnvelope(id = "task_video_A1_01") {
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
    references: [],
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

function subagentEnvelope(id = "subagent_video_A1_01", parentTaskId = "task_video_A1_01") {
  const envelope = {
    id,
    parentTaskId,
    purpose: "video_generation",
    contextLevel: "L2",
    sourceIndexHash: "source_hash_123",
    shotId: "A1_01",
    storyFunction: "test shot",
    neighborShots: [],
    lockedReferences: [],
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
    mustInspectNeighborShotIds: [],
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
  return envelope;
}

function passingResult(taskId = "task_video_A1_01") {
  return {
    taskId,
    status: "pass",
    inspectedFiles: ["outputs/video/A1_01.mp4"],
    gates: {
      identity: "PASS",
      scene: "PASS",
      pair: "PASS",
      story: "PASS",
      prop: "PASS",
      style: "PASS",
    },
    overallVisualVerdict: "PASS",
    styleQa: "PASS",
    motionQa: "PASS",
    continuityQa: "PASS",
    referenceUseDecision: "approve_formal",
    issues: [],
    requiredFixes: [],
    approvedFor: ["formal_preview"],
    rejectedFor: [],
    summaryForMainAgent: "All checks pass and the result can be handed off as structured facts.",
  };
}

const { buildSubagentWorkerRuntimePlan, subagentWorkerRuntimeHardLocks } = await importWorkerRuntime();
const generatedAt = "2026-05-01T00:00:00.000Z";
const envelope = subagentEnvelope();

const readyPlan = buildSubagentWorkerRuntimePlan({
  generatedAt,
  envelopes: [envelope],
  startRequests: [{ requestId: "start_A1_01", envelopeId: envelope.id }],
});
assert(readyPlan.phase === "phase_16_subagent_worker_runtime", "phase id drifted");
assert(readyPlan.validation.ok, `ready plan should validate: ${readyPlan.validation.errors.join("; ")}`);
assert(readyPlan.summary.readyForPermissionGate === 1, "validated envelope should be ready for permission gate");
assert(readyPlan.summary.canSpawnNow === 0, "worker runtime must not spawn now");
assert(readyPlan.summary.canWriteProjectStoreNow === 0, "worker runtime must not write Project Store now");
assert(readyPlan.summary.structuredResultsRequired === true, "structured results must be required");
assert(readyPlan.summary.providerSubmissionForbidden === true, "provider submission must be forbidden");
assert(readyPlan.summary.liveSubmitAllowed === false, "live submit must be false");
const readySlot = readyPlan.slots[0];
assert(readySlot.status === "ready_for_permission_gate", "validated envelope should be permission gated");
assert(readySlot.envelopeValidation.status === "valid", "envelope should validate");
assert(readySlot.commandPlan?.argumentSource === "validated_envelope_only", "command plan must use validated envelope only");
assert(readySlot.commandPlan?.canSpawnNow === false, "command plan must not spawn");
assert(readySlot.commandPlan?.canUseShell === false, "command plan must not use shell");
assert(readySlot.commandPlan?.canSubmitProvider === false, "command plan must not submit provider");
assert(readySlot.resultGate.resultStatus === "missing", "result should be pending before worker output exists");
assert(readySlot.resultGate.canHandoffToProjectStore === false, "missing result cannot hand off");
assert(readySlot.handoffPlan.canWriteProjectStoreNow === false, "Project Store writes must remain blocked");

const freeTextPlan = buildSubagentWorkerRuntimePlan({
  generatedAt,
  envelopes: [envelope],
  startRequests: [{ requestId: "bad_free_text", envelopeId: envelope.id, freeTextPrompt: "just check it however" }],
});
assert(freeTextPlan.summary.freeTextBlocked === 1, "free text starts must be counted as blocked");
assert(freeTextPlan.slots[0].status === "blocked_free_text", "free text worker start must be blocked");
assert(freeTextPlan.slots[0].blockedReasons.includes("free_text_worker_start_forbidden"), "free text blocker missing");
assert(!freeTextPlan.slots[0].commandPlan, "free text blocked slot must not get command plan");

const invalidEnvelope = {
  ...subagentEnvelope("invalid_envelope", "task_invalid"),
  resultMustReferencePackHashes: false,
  disallowedReadScopes: [],
};
const invalidEnvelopePlan = buildSubagentWorkerRuntimePlan({
  generatedAt,
  envelopes: [invalidEnvelope],
});
assert(invalidEnvelopePlan.slots[0].status === "blocked_invalid_envelope", "invalid envelope must block worker runtime");
assert(
  invalidEnvelopePlan.slots[0].blockedReasons.some((reason) => reason.includes("subagent_result_pack_hash_reference_not_required")),
  "invalid envelope reason should be preserved",
);

const acceptedPlan = buildSubagentWorkerRuntimePlan({
  generatedAt,
  envelopes: [envelope],
  resultCandidates: [{ resultId: "result_A1_01", envelopeId: envelope.id, result: passingResult() }],
});
assert(acceptedPlan.summary.resultAcceptedForHandoff === 1, "valid structured result should be accepted for handoff planning");
assert(acceptedPlan.slots[0].status === "result_accepted_for_handoff", "valid result slot status drifted");
assert(acceptedPlan.slots[0].resultGate.resultStatus === "valid", "result gate should validate");
assert(acceptedPlan.slots[0].resultGate.taskIdMatchesEnvelope === true, "result taskId must match envelope parent task");
assert(acceptedPlan.slots[0].resultGate.gateFieldsPresent.length === 6, "all gate fields must be present");
assert(acceptedPlan.slots[0].handoffPlan.projectStorePatchPlanned === true, "valid result should plan Project Store patch");
assert(acceptedPlan.slots[0].handoffPlan.canWriteProjectStoreNow === false, "valid result still must not write now");

const rejectedPlan = buildSubagentWorkerRuntimePlan({
  generatedAt,
  envelopes: [envelope],
  resultCandidates: [
    {
      resultId: "result_bad",
      envelopeId: envelope.id,
      result: {
        ...passingResult("wrong_task"),
        gates: { identity: "PASS", scene: "PASS" },
        issues: [{ severity: "P9", code: "bad", target: "shot", recommendation: "fix" }],
      },
    },
  ],
});
assert(rejectedPlan.summary.resultRejected === 1, "invalid result should be rejected");
assert(rejectedPlan.slots[0].status === "result_rejected", "invalid result slot status drifted");
assert(rejectedPlan.slots[0].resultGate.blockers.includes("subagent_result_task_id_mismatch"), "task id mismatch blocker missing");
assert(rejectedPlan.slots[0].resultGate.blockers.includes("subagent_result_gate_set_incomplete"), "gate incomplete blocker missing");
assert(rejectedPlan.slots[0].resultGate.blockers.includes("subagent_result_issue_severity_invalid"), "severity blocker missing");

for (const [key, expected] of Object.entries({
  noFreeTextTask: true,
  validatedEnvelopeRequired: true,
  structuredResultRequired: true,
  noSpawnWorkerNow: true,
  noSubprocess: true,
  noShellExecution: true,
  noProviderExecution: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noFileMutation: true,
  noProjectStoreWrite: true,
  noUnscopedRead: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
})) {
  assert(readyPlan.hardLocks[key] === expected, `hard lock ${key} drifted`);
  assert(subagentWorkerRuntimeHardLocks[key] === expected, `exported hard lock ${key} drifted`);
}

const schema = readJson("schemas/subagent_worker_runtime.schema.json");
assert(schema.title === "SubagentWorkerRuntimePlan", "worker runtime schema title missing");
assert(schema.properties.phase.const === "phase_16_subagent_worker_runtime", "worker runtime schema phase const missing");
assert(schema.$defs.commandPlan.properties.argumentSource.const === "validated_envelope_only", "schema must pin validated-envelope-only command arguments");
assert(schema.$defs.commandPlan.properties.canSpawnNow.const === false, "schema must pin command spawn false");
assert(schema.$defs.commandPlan.properties.canUseShell.const === false, "schema must pin shell false");
assert(schema.$defs.commandPlan.properties.canSubmitProvider.const === false, "schema must pin provider submit false");
assert(schema.$defs.summary.properties.canSpawnNow.const === 0, "schema summary must pin canSpawnNow=0");
assert(schema.$defs.summary.properties.canWriteProjectStoreNow.const === 0, "schema summary must pin canWriteProjectStoreNow=0");
for (const [key, expected] of Object.entries(subagentWorkerRuntimeHardLocks)) {
  assert(schema.$defs.hardLocks.properties[key].const === expected, `schema hardLocks must pin ${key}=${expected}`);
}

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("subagent_worker_runtime.schema.json"), "schema registry must include subagent_worker_runtime schema");
assert(registrySource.includes("SubagentWorkerRuntimePlan"), "schema registry must include SubagentWorkerRuntimePlan type");

const packageJson = readJson("package.json");
assert(packageJson.scripts["subagent-worker:test"] === "node scripts/subagent-worker-runtime-test.mjs", "package script subagent-worker:test missing");

console.log(
  `Subagent worker runtime tests passed: ready=${readyPlan.summary.readyForPermissionGate}, accepted=${acceptedPlan.summary.resultAcceptedForHandoff}, rejected=${rejectedPlan.summary.resultRejected}.`,
);
