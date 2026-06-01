import {
  buildInputHash,
  buildOutputHash,
  buildSubagentInputHash,
  envelopeSchemaVersion,
  validateSubagentTaskEnvelope,
} from "../src/core/envelopeValidator.ts";
import { buildPolicyBinding, buildNonOverridableGateHashes } from "../src/core/envelopeValidator.ts";
import { validateEnvelopeProductionGate } from "../src/core/envelopeProductionGate.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function makeTaskEnvelope(id = "task_video_A1_01") {
  const base = {
    schemaVersion: envelopeSchemaVersion,
    id,
    purpose: "video" as const,
    providerSlot: "video.i2v" as const,
    providerId: "seedance2-provider",
    executionState: "parked" as const,
    requiredMode: "frames2video" as const,
    storyFunction: "test shot",
    sourceIndexHash: "source_hash_123",
    dependencies: [] as string[],
    contextLevel: "L2" as const,
    expectedOutputs: ["outputs/video/A1_01.mp4"],
    hardRules: ["no_live_submit", "no_provider_credentials"],
    references: [] as any[],
    qaChecklist: ["identity_gate", "scene_gate", "pair_gate", "story_gate"],
    preflight: {
      taskId: id,
      preflightScope: "formal_execution" as const,
      status: "blocked" as const,
      blockers: [] as any[],
      warnings: [] as any[],
      checkedAt: "2026-05-01T00:00:00.000Z",
    },
    injectedKnowledgePacks: [] as any[],
    injectedKnowledgeSnippetIds: [] as string[],
    injectedKnowledgeSnippets: [] as any[],
    routeWarnings: [] as string[],
    sourceFactTrace: [`source_index:source_hash_123`],
    blockingReasons: [] as string[],
  };
  const policyBinding = buildPolicyBinding(base as any);
  const withBinding = { ...base, policyBinding, nonOverridableGateHashes: buildNonOverridableGateHashes({ ...base, policyBinding } as any) };
  const inputHash = buildInputHash(withBinding as any);
  return { ...withBinding, inputHash };
}

function makeSubagentEnvelope(id = "subagent_video_A1_01", parentTaskId = "task_video_A1_01") {
  const task = makeTaskEnvelope(parentTaskId);
  const base = {
    schemaVersion: envelopeSchemaVersion,
    id,
    parentTaskId,
    purpose: "video_generation" as const,
    contextLevel: "L2" as const,
    sourceIndexHash: "source_hash_123",
    shotId: "A1_01",
    storyFunction: "test shot",
    userIntent: "task_kind:video_execution | shot:A1_01",
    neighborShots: [] as any[],
    lockedReferences: [] as any[],
    forbiddenReferences: [] as any[],
    providerPolicySummary: [
      "slot=video.i2v",
      "provider=seedance2-provider",
      "state=parked",
      "mode=frames2video",
      "providerSubmissionForbidden=true",
      "liveSubmitAllowed=false",
    ],
    taskEnvelope: task as any,
    injectedKnowledgePacks: [] as any[],
    injectedKnowledgeSnippetIds: [] as string[],
    injectedKnowledgeSnippets: [] as any[],
    routeWarnings: [] as string[],
    forbiddenKnowledgePacks: [] as string[],
    requiredKnowledgeCategories: ["provider", "qa"] as any[],
    qaPackBindings: {} as Record<string, { version: string; hash: string }>,
    policyBinding: task.policyBinding,
    nonOverridableGateHashes: task.nonOverridableGateHashes,
    allowedReadScopes: ["task_envelope", "source_index", "locked_references", "injected_knowledge_snippets"],
    disallowedReadScopes: ["provider_credentials", "api_keys", "live_provider_task_ids", "unrouted_knowledge_library", "rejected_references", "failed_artifacts"],
    sourceIndexRequired: true as const,
    mustInspectNeighborShotIds: [] as string[],
    authorityPriority: ["source_index", "provider_policy", "preflight"] as any[],
    resultMustReferencePackHashes: true,
    qaChecklist: ["identity_gate", "scene_gate", "pair_gate", "story_gate"],
    mustPreserve: ["character identity"],
    allowedDelta: ["motion"],
    mustNotAdd: ["new characters"],
    expectedOutputContract: {
      format: "subagent_result_v1" as const,
      requiredFields: ["taskId", "status", "inspectedFiles", "changedFiles", "tests", "artifactPaths", "residualRisks", "touched", "gates", "issues", "requiredFixes", "summaryForMainAgent"],
      severityLevels: ["P0", "P1", "P2"],
      gateFields: ["identity", "scene", "pair", "story", "prop", "style"],
    },
    sourceFactTrace: ["source_index:source_hash_123"],
    injectedKnowledgeTrace: { status: "missing" as const, packIds: [], snippetIds: [], snippetCount: 0, qaPackBindingIds: [], warnings: [] },
    resultSchema: "subagent_result_v1" as const,
    forbiddenActions: ["no_free_text_task", "no_free_text_worker", "provider_submit_forbidden", "live_submit_forbidden", "provider_credentials_forbidden", "file_mutation_forbidden"],
  };
  const inputHash = buildSubagentInputHash(base as any);
  return { ...base, inputHash };
}

function makeWorkerResult(taskId = "task_video_A1_01") {
  return {
    taskId,
    status: "pass" as const,
    inspectedFiles: ["outputs/video/A1_01.mp4"],
    changedFiles: [],
    tests: [{ command: "manifest check", status: "pass" as const }],
    artifactPaths: ["outputs/video/A1_01.mp4"],
    residualRisks: [],
    touched: { provider: false, credential: false, promotion: false, fileMutation: false },
    gates: { identity: "pass" as const, scene: "pass" as const, pair: "pass" as const, story: "pass" as const, prop: "pass" as const, style: "pass" as const },
    overallVisualVerdict: "pass" as const,
    styleQa: "pass" as const,
    motionQa: "pass" as const,
    continuityQa: "pass" as const,
    referenceUseDecision: "approve_formal" as const,
    issues: [],
    requiredFixes: [],
    approvedFor: ["formal_asset"],
    rejectedFor: [],
    summaryForMainAgent: "All checks passed.",
  };
}

function makeReceipt(receiptId = "receipt_subagent_video_A1_01") {
  return {
    schemaVersion: "0.1.0" as const,
    phase: "phase_24_subagent_runtime_gate" as const,
    receiptId,
    generatedAt: "2026-05-01T00:00:00.000Z",
    readiness: "ready_for_worker_permission_gate" as const,
    blockedReasons: [],
    evidence: {
      projectFacts: { ready: true, runtimeStateSourceOfTruthRefs: [] },
      workerRuntime: { validationOk: true },
      subject: { envelopeValidationStatus: "valid" as const, freeTextPromptPresent: false, commandPlanArgumentSource: "validated_envelope_only" as const },
    } as any,
    hardLocks: {} as any,
    commandPlanGate: {
      argumentSourceRequired: "validated_envelope_only" as const,
      canSpawnNow: false,
      canUseShell: false,
      canSubmitProvider: false,
      expectedResultSchema: "subagent_result_v1" as const,
    },
    providerGate: {
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      providerSubmissionAttempted: false,
    },
    validation: { ok: true, errors: [], warnings: [], checkedAt: "2026-05-01T00:00:00.000Z" },
  };
}

// ===== Test 1: buildInputHash deterministic =====
{
  const a = makeTaskEnvelope("task_A");
  const b = makeTaskEnvelope("task_A");
  assert(a.inputHash === b.inputHash, "buildInputHash should be deterministic");
  console.log("PASS 1: buildInputHash deterministic");
}

// ===== Test 2: buildInputHash differs with field change =====
{
  const a = makeTaskEnvelope("task_A");
  const b = makeTaskEnvelope("task_A");
  b.storyFunction = "different shot";
  b.inputHash = buildInputHash(b as any);
  assert(a.inputHash !== b.inputHash, "buildInputHash should differ when fields change");
  console.log("PASS 2: buildInputHash field sensitivity");
}

// ===== Test 3: buildSubagentInputHash deterministic =====
{
  const a = makeSubagentEnvelope("sub_A");
  const b = makeSubagentEnvelope("sub_A");
  assert(a.inputHash === b.inputHash, "buildSubagentInputHash should be deterministic");
  console.log("PASS 3: buildSubagentInputHash deterministic");
}

// ===== Test 4: buildOutputHash deterministic =====
{
  const a = buildOutputHash(makeWorkerResult("task_A"));
  const b = buildOutputHash(makeWorkerResult("task_A"));
  assert(a === b, "buildOutputHash should be deterministic");
  console.log("PASS 4: buildOutputHash deterministic");
}

// ===== Test 5: validateEnvelopeProductionGate all valid =====
{
  const envelope = makeSubagentEnvelope();
  envelope.outputHash = buildOutputHash(makeWorkerResult());
  envelope.receiptRef = "receipt_sub_A";
  const receipt = makeReceipt("receipt_sub_A");
  const result = validateEnvelopeProductionGate({
    envelope: envelope as any,
    workerResult: makeWorkerResult(),
    receipt: receipt as any,
  });
  assert(result.allPassed, "all-valid gate should pass");
  console.log("PASS 5: all-valid production gate passes");
}

// ===== Test 6: inputHash tampering detected =====
{
  const envelope = makeSubagentEnvelope();
  envelope.outputHash = buildOutputHash(makeWorkerResult());
  envelope.receiptRef = "receipt_sub_B";
  envelope.taskEnvelope.inputHash = "tampered_hash";
  const receipt = makeReceipt("receipt_sub_B");
  const result = validateEnvelopeProductionGate({
    envelope: envelope as any,
    workerResult: makeWorkerResult(),
    receipt: receipt as any,
  });
  assert(!result.allPassed, "tampered inputHash should block");
  assert(result.checks.inputHashValid === false, "inputHashValid should be false");
  console.log("PASS 6: tampered inputHash detected");
}

// ===== Test 7: outputHash mismatch detected =====
{
  const envelope = makeSubagentEnvelope();
  envelope.outputHash = "wrong_output_hash";
  envelope.receiptRef = "receipt_sub_C";
  const receipt = makeReceipt("receipt_sub_C");
  const result = validateEnvelopeProductionGate({
    envelope: envelope as any,
    workerResult: makeWorkerResult(),
    receipt: receipt as any,
  });
  assert(!result.allPassed, "outputHash mismatch should block");
  assert(result.checks.outputHashValid === false, "outputHashValid should be false");
  console.log("PASS 7: outputHash mismatch detected");
}

// ===== Test 8: receiptRef mismatch detected =====
{
  const envelope = makeSubagentEnvelope();
  envelope.outputHash = buildOutputHash(makeWorkerResult());
  envelope.receiptRef = "receipt_sub_D";
  const receipt = makeReceipt("receipt_sub_OTHER");
  const result = validateEnvelopeProductionGate({
    envelope: envelope as any,
    workerResult: makeWorkerResult(),
    receipt: receipt as any,
  });
  assert(!result.allPassed, "receiptRef mismatch should block");
  assert(result.checks.receiptRefMatches === false, "receiptRefMatches should be false");
  console.log("PASS 8: receiptRef mismatch detected");
}

// ===== Test 9: schema version mismatch detected =====
{
  const envelope = makeSubagentEnvelope();
  (envelope as any).schemaVersion = "0.1.0";
  envelope.outputHash = buildOutputHash(makeWorkerResult());
  envelope.receiptRef = "receipt_sub_E";
  const receipt = makeReceipt("receipt_sub_E");
  const result = validateEnvelopeProductionGate({
    envelope: envelope as any,
    workerResult: makeWorkerResult(),
    receipt: receipt as any,
  });
  assert(!result.allPassed, "schema version mismatch should block");
  assert(result.checks.schemaVersionValid === false, "schemaVersionValid should be false");
  console.log("PASS 9: schema version mismatch detected");
}

// ===== Test 10: existing envelope validation issues still caught =====
{
  const envelope = makeSubagentEnvelope("invalid_sub", "task_invalid");
  envelope.outputHash = buildOutputHash(makeWorkerResult());
  envelope.receiptRef = "receipt_sub_F";
  envelope.resultMustReferencePackHashes = false;
  envelope.disallowedReadScopes = [];
  const receipt = makeReceipt("receipt_sub_F");
  const result = validateEnvelopeProductionGate({
    envelope: envelope as any,
    workerResult: makeWorkerResult(),
    receipt: receipt as any,
  });
  assert(!result.allPassed, "existing envelope issues should still block");
  assert(!result.checks.envelopeValidationPassed, "envelopeValidationPassed should be false");
  console.log("PASS 10: existing envelope issues still caught");
}

console.log(`\nEnvelope production gate tests passed: 10/10.`);
