import { stableKnowledgeHash } from "./knowledgeManifest";
import type { KnowledgeInjectionRecord } from "./knowledgeTypes";
import type { SubagentTaskEnvelope, TaskEnvelope } from "./types";

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
  const issues: string[] = [];
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

export function validateTaskEnvelope(envelope: TaskEnvelope): EnvelopeValidationResult {
  const issues = validateTaskEnvelopeCore(envelope);

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateSubagentTaskEnvelope(envelope: SubagentTaskEnvelope): EnvelopeValidationResult {
  const issues = [
    ...validateTaskEnvelopeCore(envelope.taskEnvelope),
    ...envelope.injectedKnowledgePacks.flatMap((record) => {
      const recordIssues: string[] = [];
      assertNoInjectionOverride(record, recordIssues);
      return recordIssues;
    }),
  ];
  const qaGatePacks = envelope.injectedKnowledgePacks.filter((pack) => pack.consumer === "qa_gate");
  const qaPackBindingEntries = Object.entries(envelope.qaPackBindings);

  if (!envelope.sourceIndexRequired) issues.push("subagent_source_index_not_required");
  if (!envelope.resultMustReferencePackHashes) issues.push("subagent_result_pack_hash_reference_not_required");
  if (!envelope.allowedReadScopes.length) issues.push("subagent_allowed_read_scopes_missing");
  if (!envelope.disallowedReadScopes.length) issues.push("subagent_disallowed_read_scopes_missing");

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
