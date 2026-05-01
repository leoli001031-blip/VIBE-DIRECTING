import {
  estimateKnowledgeTokens,
  normalizeKnowledgeManifest,
  stableKnowledgeHash,
  validateKnowledgePack,
} from "./knowledgeManifest";
import type {
  ContextBudgetResult,
  KnowledgeConflict,
  KnowledgeDependency,
  KnowledgeInjectedSnippet,
  KnowledgeInjectionRecord,
  KnowledgePack,
  KnowledgePackCategory,
  KnowledgePackConsumer,
  KnowledgePackManifest,
  KnowledgeRouteMatch,
  KnowledgeRouteResult,
  KnowledgeSnippet,
} from "./knowledgeTypes";

export const knowledgePackManagerSchemaVersion = "0.1.0";

export interface KnowledgePackManagerHardLocks {
  providerPolicyOverrideForbidden: true;
  preflightOverrideForbidden: true;
  referenceAuthorityOverrideForbidden: true;
  keyframePairDerivationOverrideForbidden: true;
  qaGateOverrideForbidden: true;
  phase24ValidatedEnvelopeRequired: true;
  providerSubmissionForbidden: true;
  credentialReadForbidden: true;
  credentialWriteForbidden: true;
  arbitraryShellExecutionForbidden: true;
  parkedProviderPolicyBypassForbidden: true;
  wholeLibraryInjectionForbidden: true;
}

export const knowledgePackManagerHardLocks: KnowledgePackManagerHardLocks = {
  providerPolicyOverrideForbidden: true,
  preflightOverrideForbidden: true,
  referenceAuthorityOverrideForbidden: true,
  keyframePairDerivationOverrideForbidden: true,
  qaGateOverrideForbidden: true,
  phase24ValidatedEnvelopeRequired: true,
  providerSubmissionForbidden: true,
  credentialReadForbidden: true,
  credentialWriteForbidden: true,
  arbitraryShellExecutionForbidden: true,
  parkedProviderPolicyBypassForbidden: true,
  wholeLibraryInjectionForbidden: true,
};

export type KnowledgePackBlockReason =
  | "pack_disabled"
  | "pack_invalid"
  | "duplicate_pack_id"
  | "external_pack_untrusted"
  | "external_pack_unverified"
  | "missing_required_dependency"
  | "dependency_version_mismatch"
  | "dependency_not_injectable"
  | "conflict_unacknowledged"
  | "route_binding_mismatch"
  | "budget_binding_mismatch";

export interface KnowledgePackManagerInput {
  manifest: KnowledgePackManifest;
  routeResult?: KnowledgeRouteResult;
  contextBudget?: ContextBudgetResult;
  generatedAt?: string;
}

export interface KnowledgePackManagerPackRef {
  packId: string;
  version: string;
  hash: string;
  category: KnowledgePackCategory;
  title: string;
  enabled: boolean;
}

export interface KnowledgePackManagerBlockedPack extends KnowledgePackManagerPackRef {
  reasons: KnowledgePackBlockReason[];
  details: string[];
}

export interface KnowledgePackManagerMissingDependency {
  packId: string;
  dependency: KnowledgeDependency;
  reason: "missing_required_dependency" | "dependency_version_mismatch" | "dependency_not_injectable" | "optional_dependency_missing";
  blocking: boolean;
}

export interface KnowledgePackManagerConflict {
  packId: string;
  conflict: KnowledgeConflict;
  acknowledged: boolean;
  blocking: boolean;
}

export interface KnowledgePackManagerSnippetSummary {
  snippetId: string;
  title: string;
  summary: string;
  tokenEstimate: number;
  hash?: string;
}

export interface KnowledgePackInjectionReadySummary {
  packId: string;
  version: string;
  hash: string;
  category: KnowledgePackCategory;
  title: string;
  summary: string;
  summaryHash: string;
  maxInjectionTokens: number;
  consumer: KnowledgePackConsumer;
  reason: string;
  injectedSnippetIds: string[];
  snippetSummaries: KnowledgePackManagerSnippetSummary[];
  tokenEstimate: number;
  truncated: boolean;
  truncationReason?: string;
}

export interface KnowledgePackManagerSummary {
  packCount: number;
  enabledCount: number;
  disabledCount: number;
  blockedCount: number;
  conflictCount: number;
  missingDependencyCount: number;
  injectionReadyCount: number;
  warningCount: number;
}

export interface KnowledgePackManagerState {
  schemaVersion: typeof knowledgePackManagerSchemaVersion;
  managerId: string;
  generatedAt: string;
  manifestHash: string;
  manifestVersion: string;
  routeId?: string;
  budgetId?: string;
  summary: KnowledgePackManagerSummary;
  enabledPacks: KnowledgePackManagerPackRef[];
  disabledPacks: KnowledgePackManagerPackRef[];
  blockedPacks: KnowledgePackManagerBlockedPack[];
  missingDependencies: KnowledgePackManagerMissingDependency[];
  conflicts: KnowledgePackManagerConflict[];
  injectionReady: KnowledgePackInjectionReadySummary[];
  warnings: string[];
  hardLocks: KnowledgePackManagerHardLocks;
}

interface CandidateInjection {
  packId: string;
  consumer: KnowledgePackConsumer;
  reason: string;
  injectedSnippetIds: string[];
  tokenEstimate: number;
  truncated: boolean;
  truncationReason?: string;
  bindingHash?: string;
  bindingVersion?: string;
}

function packRef(pack: KnowledgePack): KnowledgePackManagerPackRef {
  return {
    packId: pack.id,
    version: pack.version,
    hash: pack.hash,
    category: pack.category,
    title: pack.title,
    enabled: pack.enabled,
  };
}

function addBlockedReason(
  blockedByPackId: Map<string, KnowledgePackManagerBlockedPack>,
  pack: KnowledgePack,
  reason: KnowledgePackBlockReason,
  detail: string,
) {
  const blocked = blockedByPackId.get(pack.id) || { ...packRef(pack), reasons: [], details: [] };

  if (!blocked.reasons.includes(reason)) blocked.reasons.push(reason);
  if (!blocked.details.includes(detail)) blocked.details.push(detail);
  blockedByPackId.set(pack.id, blocked);
}

function isExternalPackTrusted(pack: KnowledgePack): boolean {
  return pack.type !== "external_imported" || pack.trustLevel === "trusted" || pack.trustLevel === "verified";
}

function isExternalPackVerified(pack: KnowledgePack): boolean {
  return pack.type !== "external_imported" || pack.verificationStatus === "verified";
}

function matchingDependencyIssue(
  dependency: KnowledgeDependency,
  dependencyPack: KnowledgePack | undefined,
  blockedByPackId: Map<string, KnowledgePackManagerBlockedPack>,
): KnowledgePackManagerMissingDependency | undefined {
  if (!dependencyPack) {
    return {
      packId: "",
      dependency,
      reason: dependency.optional ? "optional_dependency_missing" : "missing_required_dependency",
      blocking: !dependency.optional,
    };
  }

  if (dependency.version && dependencyPack.version !== dependency.version) {
    return {
      packId: "",
      dependency,
      reason: "dependency_version_mismatch",
      blocking: !dependency.optional,
    };
  }

  if (!dependency.optional && blockedByPackId.has(dependencyPack.id)) {
    return {
      packId: "",
      dependency,
      reason: "dependency_not_injectable",
      blocking: true,
    };
  }

  return undefined;
}

function snippetSummary(pack: KnowledgePack, snippet: KnowledgeSnippet | KnowledgeInjectedSnippet): KnowledgePackManagerSnippetSummary {
  const contentSummary = "summary" in snippet && snippet.summary ? snippet.summary : snippet.title;

  return {
    snippetId: "snippetId" in snippet ? snippet.snippetId : snippet.id,
    title: snippet.title,
    summary: contentSummary,
    tokenEstimate: snippet.tokenEstimate || estimateKnowledgeTokens(contentSummary),
    hash: snippet.hash,
  };
}

function routeCandidate(match: KnowledgeRouteMatch): CandidateInjection {
  return {
    packId: match.packId,
    consumer: match.consumer,
    reason: match.reason,
    injectedSnippetIds: match.matchedSnippetIds,
    tokenEstimate: 0,
    truncated: false,
    bindingHash: match.hash,
    bindingVersion: match.version,
  };
}

function budgetCandidate(record: KnowledgeInjectionRecord, snippets: KnowledgeInjectedSnippet[]): CandidateInjection {
  return {
    packId: record.packId,
    consumer: record.consumer,
    reason: record.reason,
    injectedSnippetIds: record.injectedSnippetIds,
    tokenEstimate: snippets
      .filter((snippet) => snippet.packId === record.packId && record.injectedSnippetIds.includes(snippet.snippetId))
      .reduce((sum, snippet) => sum + snippet.tokenEstimate, 0),
    truncated: record.truncated,
    truncationReason: record.truncationReason,
    bindingHash: record.hash,
    bindingVersion: record.version,
  };
}

function candidateSnippetSummaries(
  pack: KnowledgePack,
  candidate: CandidateInjection,
  budgetSnippets: KnowledgeInjectedSnippet[],
): KnowledgePackManagerSnippetSummary[] {
  const budgetById = new Map(
    budgetSnippets
      .filter((snippet) => snippet.packId === pack.id)
      .map((snippet) => [snippet.snippetId, snippet]),
  );
  const packSnippetById = new Map(pack.snippets.map((snippet) => [snippet.id, snippet]));
  const requestedIds = candidate.injectedSnippetIds.length
    ? candidate.injectedSnippetIds
    : pack.snippets.slice(0, 1).map((snippet) => snippet.id);

  return requestedIds
    .map((snippetId) => budgetById.get(snippetId) || packSnippetById.get(snippetId))
    .filter((snippet): snippet is KnowledgeSnippet | KnowledgeInjectedSnippet => Boolean(snippet))
    .map((snippet) => snippetSummary(pack, snippet));
}

function buildInjectionReadySummary(
  pack: KnowledgePack,
  candidate: CandidateInjection,
  budgetSnippets: KnowledgeInjectedSnippet[],
): KnowledgePackInjectionReadySummary {
  const snippetSummaries = candidateSnippetSummaries(pack, candidate, budgetSnippets);
  const tokenEstimate =
    candidate.tokenEstimate ||
    snippetSummaries.reduce((sum, snippet) => sum + Math.min(snippet.tokenEstimate, pack.maxInjectionTokens), 0);

  return {
    packId: pack.id,
    version: pack.version,
    hash: pack.hash,
    category: pack.category,
    title: pack.title,
    summary: pack.summary,
    summaryHash: stableKnowledgeHash(pack.summary),
    maxInjectionTokens: pack.maxInjectionTokens,
    consumer: candidate.consumer,
    reason: candidate.reason,
    injectedSnippetIds: candidate.injectedSnippetIds,
    snippetSummaries,
    tokenEstimate: Math.min(tokenEstimate, pack.maxInjectionTokens),
    truncated: candidate.truncated,
    truncationReason: candidate.truncationReason,
  };
}

function uniqueWarnings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

export function buildKnowledgePackManagerState(input: KnowledgePackManagerInput): KnowledgePackManagerState {
  const manifest = normalizeKnowledgeManifest(input.manifest);
  const warnings = [...(input.routeResult?.warnings || []), ...(input.contextBudget?.warnings || [])];
  const blockedByPackId = new Map<string, KnowledgePackManagerBlockedPack>();
  const packById = new Map<string, KnowledgePack>();
  const seenPackIds = new Set<string>();

  for (const pack of manifest.packs) {
    if (seenPackIds.has(pack.id)) {
      addBlockedReason(blockedByPackId, pack, "duplicate_pack_id", `duplicate pack id ${pack.id}`);
    }
    seenPackIds.add(pack.id);
    packById.set(pack.id, pack);
  }

  for (const pack of manifest.packs) {
    const validationIssues = validateKnowledgePack(pack);
    if (validationIssues.length) {
      addBlockedReason(blockedByPackId, pack, "pack_invalid", validationIssues.join("; "));
    }

    if (!pack.enabled) {
      addBlockedReason(blockedByPackId, pack, "pack_disabled", "pack is disabled");
    }

    if (!isExternalPackTrusted(pack)) {
      addBlockedReason(blockedByPackId, pack, "external_pack_untrusted", "external_imported pack must be trusted or verified");
    }

    if (!isExternalPackVerified(pack)) {
      addBlockedReason(blockedByPackId, pack, "external_pack_unverified", "external_imported pack must have verificationStatus=verified");
    }

    if (pack.type !== "external_imported" && (pack.trustLevel === "unverified" || pack.trustLevel === "experimental")) {
      warnings.push(`pack_trust_warning:${pack.id}:${pack.trustLevel}`);
    }
  }

  const missingDependencies: KnowledgePackManagerMissingDependency[] = [];
  const conflicts: KnowledgePackManagerConflict[] = [];

  for (const pack of manifest.packs) {
    for (const dependency of pack.dependencies) {
      const issue = matchingDependencyIssue(dependency, packById.get(dependency.packId), blockedByPackId);
      if (!issue) continue;

      const dependencyIssue = { ...issue, packId: pack.id };
      missingDependencies.push(dependencyIssue);
      warnings.push(`${dependencyIssue.reason}:${pack.id}->${dependency.packId}`);

      if (dependencyIssue.blocking && dependencyIssue.reason !== "optional_dependency_missing") {
        addBlockedReason(
          blockedByPackId,
          pack,
          dependencyIssue.reason,
          `${pack.id} requires ${dependency.packId}${dependency.version ? `@${dependency.version}` : ""}`,
        );
      }
    }

    for (const conflict of pack.conflicts) {
      const conflictPack = packById.get(conflict.packId);
      if (!conflictPack) continue;

      const acknowledged = pack.conflictAcknowledged === true;
      const conflictReport: KnowledgePackManagerConflict = {
        packId: pack.id,
        conflict,
        acknowledged,
        blocking: !acknowledged,
      };
      conflicts.push(conflictReport);
      warnings.push(`${acknowledged ? "conflict_acknowledged" : "conflict_unacknowledged"}:${pack.id}<->${conflict.packId}`);

      if (!acknowledged) {
        addBlockedReason(blockedByPackId, pack, "conflict_unacknowledged", `${pack.id} conflicts with ${conflict.packId}: ${conflict.reason}`);
      }
    }
  }

  const routeCandidates = new Map<string, CandidateInjection>();
  for (const match of input.routeResult?.matches || []) {
    const pack = packById.get(match.packId);
    if (!pack) {
      warnings.push(`route_missing_pack:${match.packId}`);
      continue;
    }

    if (match.version !== pack.version || match.hash !== pack.hash) {
      addBlockedReason(blockedByPackId, pack, "route_binding_mismatch", `route binding mismatch for ${pack.id}`);
      warnings.push(`route_binding_mismatch:${pack.id}`);
    }

    routeCandidates.set(match.packId, routeCandidate(match));
  }

  const budgetSnippets = input.contextBudget?.injectedSnippets || [];
  const budgetCandidates = new Map<string, CandidateInjection>();
  for (const record of input.contextBudget?.injectedKnowledgePacks || []) {
    const pack = packById.get(record.packId);
    if (!pack) {
      warnings.push(`budget_missing_pack:${record.packId}`);
      continue;
    }

    if (record.version !== pack.version || record.hash !== pack.hash) {
      addBlockedReason(blockedByPackId, pack, "budget_binding_mismatch", `budget binding mismatch for ${pack.id}`);
      warnings.push(`budget_binding_mismatch:${pack.id}`);
    }

    budgetCandidates.set(record.packId, budgetCandidate(record, budgetSnippets));
  }

  const candidateMap = budgetCandidates.size ? budgetCandidates : routeCandidates;
  const injectionReady = Array.from(candidateMap.values())
    .map((candidate) => {
      const pack = packById.get(candidate.packId);
      if (!pack || blockedByPackId.has(candidate.packId)) return undefined;
      if (candidate.bindingVersion && candidate.bindingVersion !== pack.version) return undefined;
      if (candidate.bindingHash && candidate.bindingHash !== pack.hash) return undefined;
      return buildInjectionReadySummary(pack, candidate, budgetSnippets);
    })
    .filter((summary): summary is KnowledgePackInjectionReadySummary => Boolean(summary))
    .sort((left, right) => left.packId.localeCompare(right.packId));

  const enabledPacks = manifest.packs.filter((pack) => pack.enabled).map(packRef);
  const disabledPacks = manifest.packs.filter((pack) => !pack.enabled).map(packRef);
  const blockedPacks = Array.from(blockedByPackId.values()).sort((left, right) => left.packId.localeCompare(right.packId));
  const cleanWarnings = uniqueWarnings(warnings);
  const generatedAt = input.generatedAt || manifest.generatedAt;
  const managerId = `kpm_${stableKnowledgeHash(
    JSON.stringify({
      manifestHash: manifest.manifestHash,
      routeId: input.routeResult?.routeId,
      budgetId: input.contextBudget?.budgetId,
      blocked: blockedPacks.map((pack) => [pack.packId, pack.reasons]),
      injectionReady: injectionReady.map((pack) => [pack.packId, pack.hash, pack.injectedSnippetIds]),
    }),
  ).slice(4, 12)}`;

  return {
    schemaVersion: knowledgePackManagerSchemaVersion,
    managerId,
    generatedAt,
    manifestHash: manifest.manifestHash,
    manifestVersion: manifest.manifestVersion,
    routeId: input.routeResult?.routeId,
    budgetId: input.contextBudget?.budgetId,
    summary: {
      packCount: manifest.packs.length,
      enabledCount: enabledPacks.length,
      disabledCount: disabledPacks.length,
      blockedCount: blockedPacks.length,
      conflictCount: conflicts.length,
      missingDependencyCount: missingDependencies.length,
      injectionReadyCount: injectionReady.length,
      warningCount: cleanWarnings.length,
    },
    enabledPacks,
    disabledPacks,
    blockedPacks,
    missingDependencies,
    conflicts,
    injectionReady,
    warnings: cleanWarnings,
    hardLocks: knowledgePackManagerHardLocks,
  };
}
