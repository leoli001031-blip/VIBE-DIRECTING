import { PROVIDER_CREDENTIALS_FORBIDDEN } from "./statusConstants";
import { stableKnowledgeHash } from "./knowledgeManifest";
import type { KnowledgeInjectionRecord } from "./knowledgeTypes";
import type { SubagentResult, SubagentTaskEnvelope, TaskEnvelope } from "./types";

export const envelopeSchemaVersion = "0.2.0";

export interface EnvelopeValidationResult {
  valid: boolean;
  issues: string[];
}

const injectionRecordKeys = new Set([
  "packId",
  "version",
  "hash",
  "category",
  "reason",
  "consumer",
  "injectedSnippetIds",
  "summaryHash",
  "truncated",
  "truncationReason",
]);

const requiredNonOverridableGateHashKeys = [
  "providerPolicy",
  "preflight",
  "references",
  "keyframePairDerivation",
  "knowledgeManifest",
  "policyBinding",
];

const requiredAllowedReadScopes = [
  "task_envelope",
  "source_index",
  "locked_references",
  "injected_knowledge_snippets",
];

const requiredDisallowedReadScopes = [
  "provider_credentials",
  "api_keys",
  "live_provider_task_ids",
  "unrouted_knowledge_library",
  "rejected_references",
  "failed_artifacts",
];

const requiredForbiddenActionAliases: Record<string, string[]> = {
  no_free_text_task: ["no_free_text_task", "free_text_task_forbidden"],
  no_free_text_worker: ["no_free_text_worker", "free_text_worker_forbidden"],
  provider_submit_forbidden: ["provider_submit_forbidden", "provider_submission_forbidden", "no_provider_submit"],
  live_submit_forbidden: ["live_submit_forbidden", "live_submission_forbidden", "no_live_submit"],
  [PROVIDER_CREDENTIALS_FORBIDDEN]: [PROVIDER_CREDENTIALS_FORBIDDEN, "credential_access_forbidden", "no_provider_credentials"],
  file_mutation_forbidden: ["file_mutation_forbidden", "no_file_mutation"],
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }

  return value;
}

function stableHash(value: unknown): string {
  return stableKnowledgeHash(JSON.stringify(canonicalize(value)));
}

function bindingInput(envelope: TaskEnvelope) {
  return {
    provider: {
      slot: envelope.providerSlot,
      providerId: envelope.providerId,
      executionState: envelope.executionState,
      requiredMode: envelope.requiredMode,
    },
    preflight: {
      taskId: envelope.preflight.taskId,
      preflightScope: envelope.preflight.preflightScope,
      status: envelope.preflight.status,
      blockerCodes: envelope.preflight.blockers.map((item) => item.code).sort(),
      warningCodes: envelope.preflight.warnings.map((item) => item.code).sort(),
    },
    references: envelope.references
      .map((reference) => ({
        id: reference.id,
        hash: reference.hash,
        version: reference.version,
        referenceRole: reference.referenceRole,
        lockedStatus: reference.lockedStatus,
        polarity: reference.polarity,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    keyframePairDerivation: envelope.keyframePairDerivation
      ? {
          shotId: envelope.keyframePairDerivation.shotId,
          startFrameId: envelope.keyframePairDerivation.startFrameId,
          endFrameId: envelope.keyframePairDerivation.endFrameId,
          startFrameHash: envelope.keyframePairDerivation.startFrameHash,
          endFrameHash: envelope.keyframePairDerivation.endFrameHash,
          endDerivationSource: envelope.keyframePairDerivation.endDerivationSource,
          validForI2vPair: envelope.keyframePairDerivation.validForI2vPair,
        }
      : undefined,
    knowledgeManifestHash: envelope.knowledgeManifestHash,
  };
}

export function buildPolicyBinding(envelope: TaskEnvelope): string {
  return stableHash(bindingInput(envelope));
}

export function buildNonOverridableGateHashes(envelope: TaskEnvelope): Record<string, string> {
  const input = bindingInput(envelope);

  return {
    providerPolicy: stableHash(input.provider),
    preflight: stableHash(input.preflight),
    references: stableHash(input.references),
    keyframePairDerivation: stableHash(input.keyframePairDerivation || null),
    knowledgeManifest: stableHash(input.knowledgeManifestHash || "missing-knowledge-manifest"),
    policyBinding: stableHash(input),
  };
}

function taskInput(envelope: TaskEnvelope) {
  return {
    id: envelope.id,
    purpose: envelope.purpose,
    providerSlot: envelope.providerSlot,
    providerId: envelope.providerId,
    executionState: envelope.executionState,
    requiredMode: envelope.requiredMode,
    providerRequirements: envelope.providerRequirements,
    storyFunction: envelope.storyFunction,
    sourceIndexHash: envelope.sourceIndexHash,
    promptHash: envelope.promptHash,
    dependencies: envelope.dependencies,
    contextLevel: envelope.contextLevel,
    expectedOutputs: envelope.expectedOutputs,
    hardRules: envelope.hardRules,
    references: envelope.references,
    qaChecklist: envelope.qaChecklist,
    preflight: envelope.preflight,
    keyframePairDerivation: envelope.keyframePairDerivation,
    knowledgeRouteResultId: envelope.knowledgeRouteResultId,
    contextBudgetId: envelope.contextBudgetId,
    injectedKnowledgePacks: envelope.injectedKnowledgePacks,
    injectedKnowledgeSnippetIds: envelope.injectedKnowledgeSnippetIds,
    injectedKnowledgeSnippets: envelope.injectedKnowledgeSnippets,
    knowledgeInputHash: envelope.knowledgeInputHash,
    knowledgeManifestHash: envelope.knowledgeManifestHash,
    promptPlanId: envelope.promptPlanId,
    promptPlanHash: envelope.promptPlanHash,
    sourceShotSpecHash: envelope.sourceShotSpecHash,
    outputPath: envelope.outputPath,
  };
}

export function buildInputHash(envelope: TaskEnvelope): string {
  return stableHash(taskInput(envelope));
}

function subagentInput(envelope: SubagentTaskEnvelope) {
  return {
    id: envelope.id,
    parentTaskId: envelope.parentTaskId,
    purpose: envelope.purpose,
    contextLevel: envelope.contextLevel,
    sourceIndexHash: envelope.sourceIndexHash,
    sectionId: envelope.sectionId,
    shotId: envelope.shotId,
    storyFunction: envelope.storyFunction,
    userIntent: envelope.userIntent,
    neighborShots: envelope.neighborShots,
    lockedReferences: envelope.lockedReferences,
    forbiddenReferences: envelope.forbiddenReferences,
    shotLayout: envelope.shotLayout,
    providerPolicySummary: envelope.providerPolicySummary,
    knowledgeRouteResultId: envelope.knowledgeRouteResultId,
    contextBudgetId: envelope.contextBudgetId,
    injectedKnowledgePacks: envelope.injectedKnowledgePacks,
    injectedKnowledgeSnippetIds: envelope.injectedKnowledgeSnippetIds,
    injectedKnowledgeSnippets: envelope.injectedKnowledgeSnippets,
    knowledgeInputHash: envelope.knowledgeInputHash,
    knowledgeManifestHash: envelope.knowledgeManifestHash,
    forbiddenKnowledgePacks: envelope.forbiddenKnowledgePacks,
    requiredKnowledgeCategories: envelope.requiredKnowledgeCategories,
    qaPackBindings: envelope.qaPackBindings,
    allowedReadScopes: envelope.allowedReadScopes,
    disallowedReadScopes: envelope.disallowedReadScopes,
    mustInspectNeighborShotIds: envelope.mustInspectNeighborShotIds,
    authorityPriority: envelope.authorityPriority,
    resultMustReferencePackHashes: envelope.resultMustReferencePackHashes,
    qaChecklist: envelope.qaChecklist,
    mustPreserve: envelope.mustPreserve,
    allowedDelta: envelope.allowedDelta,
    mustNotAdd: envelope.mustNotAdd,
    expectedOutputContract: envelope.expectedOutputContract,
    resultSchema: envelope.resultSchema,
    forbiddenActions: envelope.forbiddenActions,
    taskEnvelopeInputHash: envelope.taskEnvelope.inputHash,
  };
}

export function buildSubagentInputHash(envelope: SubagentTaskEnvelope): string {
  return stableHash(subagentInput(envelope));
}

export function buildOutputHash(result: SubagentResult | Partial<SubagentResult>): string {
  return stableHash(result);
}

function validateSchemaVersion(envelope: TaskEnvelope | SubagentTaskEnvelope): string[] {
  return envelope.schemaVersion === envelopeSchemaVersion ? [] : ["schema_version_mismatch"];
}

function validateInputHash(envelope: TaskEnvelope): string[] {
  if (!envelope.inputHash) return ["input_hash_missing"];
  const expected = buildInputHash(envelope);
  return envelope.inputHash === expected ? [] : ["input_hash_mismatch"];
}

function assertNoInjectionOverride(record: KnowledgeInjectionRecord, issues: string[]) {
  const unknownKeys = Object.keys(record as unknown as Record<string, unknown>).filter((key) => !injectionRecordKeys.has(key));
  if (unknownKeys.length) {
    issues.push(`knowledge_pack_override_shape:${record.packId}:${unknownKeys.sort().join(",")}`);
  }

  const overridePattern = /\boverride\b|provider_override|preflight_override|reference_override|keyframe_override|qa_override/i;
  if (overridePattern.test(record.reason)) {
    issues.push(`knowledge_pack_override_reason:${record.packId}`);
  }
}

function validateTaskEnvelopeCore(envelope: TaskEnvelope): string[] {
  const issues: string[] = [
    ...validateSchemaVersion(envelope),
    ...validateInputHash(envelope),
  ];
  const expectedBinding = buildPolicyBinding(envelope);
  const expectedGateHashes = buildNonOverridableGateHashes(envelope);
  const snippetKeys = new Set(envelope.injectedKnowledgeSnippets.map((snippet) => `${snippet.packId}:${snippet.snippetId}`));

  if (envelope.policyBinding && envelope.policyBinding !== expectedBinding) {
    issues.push("policy_binding_mismatch");
  }

  for (const [key, value] of Object.entries(envelope.nonOverridableGateHashes || {})) {
    if (expectedGateHashes[key] && expectedGateHashes[key] !== value) {
      issues.push(`non_overridable_gate_hash_mismatch:${key}`);
    }
  }

  for (const record of envelope.injectedKnowledgePacks) {
    assertNoInjectionOverride(record, issues);
    for (const snippetId of record.injectedSnippetIds) {
      if (!snippetKeys.has(`${record.packId}:${snippetId}`)) {
        issues.push(`missing_injected_snippet_content:${record.packId}:${snippetId}`);
      }
    }
  }

  for (const snippet of envelope.injectedKnowledgeSnippets) {
    if (!snippet.content.trim()) issues.push(`empty_injected_snippet:${snippet.packId}:${snippet.snippetId}`);
    if (snippet.tokenEstimate < 1) issues.push(`invalid_injected_snippet_tokens:${snippet.packId}:${snippet.snippetId}`);
  }

  return issues;
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasSourceHashEvidence(trace: string[] | undefined, sourceIndexHash: string): boolean {
  if (!trace?.length) return false;
  return trace.some((item) => item.includes(sourceIndexHash)) || trace.some((item) => /hash|source_index/i.test(item));
}

function hasProviderPolicyProof(summary: string[], envelope: SubagentTaskEnvelope): boolean {
  const joined = summary.join("\n").toLowerCase();
  const forbidsProviderSubmit =
    joined.includes("providersubmissionforbidden=true") ||
    joined.includes("provider_submit_forbidden") ||
    joined.includes("provider submission forbidden");
  const forbidsLiveSubmit =
    joined.includes("livesubmitallowed=false") ||
    joined.includes("live_submit_forbidden") ||
    joined.includes("live submit allowed false");
  const hasSlot = summary.some((item) => item.includes(`slot=${envelope.taskEnvelope.providerSlot}`)) || joined.includes("policy lock");
  const hasMode = summary.some((item) => item.includes(`mode=${envelope.taskEnvelope.requiredMode}`)) || joined.includes("policy lock");
  const hasState =
    summary.some((item) => item.includes(`state=${envelope.taskEnvelope.executionState}`)) ||
    summary.some((item) => item.includes(`providerExecutionState=${envelope.taskEnvelope.executionState}`)) ||
    joined.includes("provider policy lock") ||
    joined.includes("policy lock");

  return forbidsProviderSubmit && forbidsLiveSubmit && hasSlot && hasMode && hasState;
}

function hasRequiredForbiddenAction(actions: string[], canonicalAction: string): boolean {
  const aliases = requiredForbiddenActionAliases[canonicalAction] || [canonicalAction];
  return aliases.some((alias) => actions.includes(alias));
}

export function validateTaskEnvelope(envelope: TaskEnvelope): EnvelopeValidationResult {
  const issues = validateTaskEnvelopeCore(envelope);

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateSubagentTaskEnvelope(envelope: SubagentTaskEnvelope): EnvelopeValidationResult {
  const issues = [
    ...validateSchemaVersion(envelope),
    ...validateTaskEnvelopeCore(envelope.taskEnvelope),
    ...envelope.injectedKnowledgePacks.flatMap((record) => {
      const recordIssues: string[] = [];
      assertNoInjectionOverride(record, recordIssues);
      return recordIssues;
    }),
  ];
  const qaGatePacks = envelope.injectedKnowledgePacks.filter((pack) => pack.consumer === "qa_gate");
  const qaPackBindingEntries = Object.entries(envelope.qaPackBindings);
  const expectedPolicyBinding = buildPolicyBinding(envelope.taskEnvelope);
  const expectedGateHashes = buildNonOverridableGateHashes(envelope.taskEnvelope);
  const allowedScopes = new Set(envelope.allowedReadScopes);
  const disallowedScopes = new Set(envelope.disallowedReadScopes);
  const taskSourceFactTrace = envelope.taskEnvelope.sourceFactTrace;

  if (!hasNonEmptyString(envelope.sourceIndexHash) || envelope.sourceIndexHash === "missing-source-index") {
    issues.push("subagent_source_index_hash_missing");
  }
  if (envelope.sourceIndexHash !== envelope.taskEnvelope.sourceIndexHash) {
    issues.push("subagent_source_index_hash_mismatch");
  }
  if (!hasSourceHashEvidence(envelope.sourceFactTrace, envelope.sourceIndexHash)) {
    issues.push("subagent_source_fact_trace_missing_hash_evidence");
  }
  if (!hasSourceHashEvidence(taskSourceFactTrace, envelope.sourceIndexHash)) {
    issues.push("task_envelope_source_fact_trace_missing_hash_evidence");
  }
  if (!envelope.providerPolicySummary.length) {
    issues.push("subagent_provider_policy_summary_missing");
  } else if (!hasProviderPolicyProof(envelope.providerPolicySummary, envelope)) {
    issues.push("subagent_provider_policy_summary_missing_hard_lock_proof");
  }
  if (envelope.policyBinding !== expectedPolicyBinding) {
    issues.push("subagent_policy_binding_missing_or_mismatch");
  }
  for (const key of requiredNonOverridableGateHashKeys) {
    if (!envelope.nonOverridableGateHashes?.[key]) {
      issues.push(`non_overridable_gate_hash_missing:${key}`);
    } else if (envelope.nonOverridableGateHashes[key] !== expectedGateHashes[key]) {
      issues.push(`non_overridable_gate_hash_mismatch:${key}`);
    }
  }
  if (!envelope.sourceIndexRequired) issues.push("subagent_source_index_not_required");
  if (!envelope.resultMustReferencePackHashes) issues.push("subagent_result_pack_hash_reference_not_required");
  if (!envelope.allowedReadScopes.length) issues.push("subagent_allowed_read_scopes_missing");
  if (!envelope.disallowedReadScopes.length) issues.push("subagent_disallowed_read_scopes_missing");
  for (const scope of requiredAllowedReadScopes) {
    if (!allowedScopes.has(scope)) issues.push(`subagent_allowed_read_scope_missing:${scope}`);
  }
  for (const scope of requiredDisallowedReadScopes) {
    if (!disallowedScopes.has(scope)) issues.push(`subagent_disallowed_read_scope_missing:${scope}`);
  }
  for (const scope of envelope.allowedReadScopes) {
    if (disallowedScopes.has(scope)) issues.push(`subagent_read_scope_overlap:${scope}`);
  }
  if (!envelope.qaChecklist.length) {
    issues.push("subagent_qa_checklist_missing");
  } else {
    const taskChecklist = new Set(envelope.taskEnvelope.qaChecklist);
    for (const item of taskChecklist) {
      if (!envelope.qaChecklist.includes(item)) issues.push(`subagent_qa_checklist_missing_task_item:${item}`);
    }
  }
  if (envelope.resultSchema !== "subagent_result_v1") {
    issues.push("subagent_result_schema_not_subagent_result_v1");
  }
  if (envelope.expectedOutputContract.format !== "subagent_result_v1") {
    issues.push("subagent_expected_output_contract_not_subagent_result_v1");
  }
  for (const action of Object.keys(requiredForbiddenActionAliases)) {
    if (!hasRequiredForbiddenAction(envelope.forbiddenActions || [], action)) {
      issues.push(`subagent_forbidden_action_missing:${action}`);
    }
  }

  for (const pack of qaGatePacks) {
    const binding = envelope.qaPackBindings[pack.packId];
    if (!binding || binding.version !== pack.version || binding.hash !== pack.hash) {
      issues.push(`qa_pack_binding_mismatch:${pack.packId}`);
    }
  }

  for (const [packId, binding] of qaPackBindingEntries) {
    if (!qaGatePacks.some((pack) => pack.packId === packId && pack.version === binding.version && pack.hash === binding.hash)) {
      issues.push(`qa_pack_binding_without_injected_pack:${packId}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
