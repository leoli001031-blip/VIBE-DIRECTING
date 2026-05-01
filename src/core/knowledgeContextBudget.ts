import type {
  ContextBudgetResult,
  KnowledgeInjectedSnippet,
  KnowledgeInjectionRecord,
  KnowledgePack,
  KnowledgeRouteMatch,
  KnowledgeRouteResult,
  KnowledgeSnippet,
} from "./knowledgeTypes";
import { estimateKnowledgeTokens, stableKnowledgeHash } from "./knowledgeManifest";

export interface BuildKnowledgeContextBudgetInput {
  routeResult: KnowledgeRouteResult;
  availablePacks: KnowledgePack[];
  maxInjectionTokens?: number;
}

const contextLevelMultiplier = {
  L0: 0.5,
  L1: 1,
  L2: 1.5,
  L3: 2,
} as const;

function defaultMaxInjectionTokens(contextLevel: KnowledgeRouteResult["contextLevel"]): number {
  return Math.max(1, Math.floor(1200 * contextLevelMultiplier[contextLevel]));
}

function trustedForInjection(pack: KnowledgePack): boolean {
  if (pack.trustLevel !== "trusted" && pack.trustLevel !== "verified") return false;
  if (pack.verificationStatus === "failed") return false;
  if (pack.type === "external_imported" && pack.verificationStatus !== "verified") return false;
  return true;
}

function directProviderMismatch(pack: KnowledgePack, routeResult: KnowledgeRouteResult): boolean {
  return Boolean(
    routeResult.providerSlot &&
      pack.applicableProviderSlots.length > 0 &&
      !pack.applicableProviderSlots.includes(routeResult.providerSlot),
  );
}

function directPurposeMismatch(pack: KnowledgePack, routeResult: KnowledgeRouteResult): boolean {
  return pack.applicableTaskPurposes.length > 0 && !pack.applicableTaskPurposes.includes(routeResult.taskPurpose);
}

function hasIntentEvidence(match: KnowledgeRouteMatch): boolean {
  return match.matchedTerms.length > 0 || match.matchedSnippetIds.length > 0 || match.reason.includes("intent_keyword") || match.reason.includes("snippet_keyword");
}

function routeApplicabilityIssue(pack: KnowledgePack, match: KnowledgeRouteMatch, routeResult: KnowledgeRouteResult): string | undefined {
  const intentEvidence = hasIntentEvidence(match);

  if (directProviderMismatch(pack, routeResult) && !intentEvidence) return "provider_slot_not_applicable";
  if (directPurposeMismatch(pack, routeResult) && !intentEvidence && !match.reason.includes("provider_slot")) return "task_purpose_not_applicable";
  return undefined;
}

function normalizeSnippetContent(snippet: KnowledgeSnippet): string {
  return (snippet.summary || snippet.content || "").trim();
}

function snippetTokenEstimate(snippet: KnowledgeSnippet): number {
  return Math.max(1, Math.floor(snippet.tokenEstimate || estimateKnowledgeTokens(normalizeSnippetContent(snippet))));
}

function snippetsForMatch(pack: KnowledgePack, match: KnowledgeRouteMatch): KnowledgeSnippet[] {
  const byId = new Map(pack.snippets.map((snippet) => [snippet.id, snippet]));
  const matched = match.matchedSnippetIds.map((snippetId) => byId.get(snippetId)).filter((snippet): snippet is KnowledgeSnippet => Boolean(snippet));

  if (matched.length) return matched;
  return pack.snippets.slice(0, 1);
}

function trimToBudget(content: string, maxTokens: number): string {
  const maxChars = Math.max(1, maxTokens * 4);

  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars).trimEnd();
}

function makeInjectionRecord(
  pack: KnowledgePack,
  match: KnowledgeRouteMatch,
  injectedSnippetIds: string[],
  truncated: boolean,
  truncationReason?: string,
): KnowledgeInjectionRecord {
  return {
    packId: pack.id,
    version: pack.version,
    hash: pack.hash,
    category: pack.category,
    reason: match.reason,
    consumer: match.consumer,
    injectedSnippetIds,
    summaryHash: stableKnowledgeHash(pack.summary),
    truncated,
    truncationReason,
  };
}

export function buildKnowledgeContextBudget(input: BuildKnowledgeContextBudgetInput): ContextBudgetResult {
  const packById = new Map(input.availablePacks.map((pack) => [pack.id, pack]));
  const maxInjectionTokens = Math.max(1, Math.floor(input.maxInjectionTokens || defaultMaxInjectionTokens(input.routeResult.contextLevel)));
  const injectedKnowledgePacks: KnowledgeInjectionRecord[] = [];
  const injectedSnippets: KnowledgeInjectedSnippet[] = [];
  const warnings: string[] = [];
  let usedTokens = 0;

  for (const match of input.routeResult.matches) {
    const pack = packById.get(match.packId);
    if (!pack) {
      warnings.push(`missing_pack:${match.packId}`);
      continue;
    }

    if (!pack.enabled) {
      warnings.push(`not_injected:${pack.id}:disabled`);
      continue;
    }

    if (!trustedForInjection(pack)) {
      warnings.push(`not_injected:${pack.id}:untrusted`);
      continue;
    }

    const applicabilityIssue = routeApplicabilityIssue(pack, match, input.routeResult);
    if (applicabilityIssue) {
      warnings.push(`not_injected:${pack.id}:${applicabilityIssue}`);
      continue;
    }

    const candidateSnippets = snippetsForMatch(pack, match);
    if (!candidateSnippets.length) {
      warnings.push(`not_injected:${pack.id}:missing_snippets`);
      continue;
    }

    const remainingGlobalBeforePack = maxInjectionTokens - usedTokens;
    const perPackLimit = Math.min(pack.maxInjectionTokens, remainingGlobalBeforePack);

    if (perPackLimit <= 0) {
      warnings.push(`not_injected:${pack.id}:budget_exceeded`);
      continue;
    }

    const selectedSnippetIds: string[] = [];
    let packTokens = 0;
    let truncated = false;
    let truncationReason: string | undefined;

    for (const snippet of candidateSnippets) {
      const content = normalizeSnippetContent(snippet);
      if (!content) continue;

      const remainingGlobal = maxInjectionTokens - usedTokens;
      const remainingPack = perPackLimit - packTokens;
      const remaining = Math.min(remainingGlobal, remainingPack);
      const tokenEstimate = snippetTokenEstimate(snippet);

      if (remaining <= 0) {
        truncated = true;
        truncationReason = packTokens >= perPackLimit ? "pack_max_injection_tokens_exhausted" : "global_context_budget_exhausted";
        break;
      }

      const injectedTokenEstimate = Math.min(tokenEstimate, remaining);
      const injectedContent = tokenEstimate > remaining ? trimToBudget(content, remaining) : content;

      if (tokenEstimate > remaining) {
        truncated = true;
        truncationReason = packTokens + tokenEstimate > perPackLimit ? "pack_max_injection_tokens_exhausted" : "global_context_budget_exhausted";
      }

      selectedSnippetIds.push(snippet.id);
      injectedSnippets.push({
        packId: pack.id,
        snippetId: snippet.id,
        title: snippet.title,
        content: injectedContent,
        tokenEstimate: injectedTokenEstimate,
        hash: snippet.hash,
      });
      usedTokens += injectedTokenEstimate;
      packTokens += injectedTokenEstimate;

      if (truncated) break;
    }

    if (!selectedSnippetIds.length) {
      warnings.push(`not_injected:${pack.id}:missing_snippets`);
      continue;
    }

    injectedKnowledgePacks.push(makeInjectionRecord(pack, match, selectedSnippetIds, truncated, truncationReason));
  }

  const budgetId = `kb_${stableKnowledgeHash(
    JSON.stringify({
      routeId: input.routeResult.routeId,
      maxInjectionTokens,
      packs: injectedKnowledgePacks.map((pack) => `${pack.packId}:${pack.injectedSnippetIds.join(",")}:${pack.truncated}`),
    }),
  ).slice(4, 12)}`;

  return {
    budgetId,
    routeId: input.routeResult.routeId,
    contextLevel: input.routeResult.contextLevel,
    maxInjectionTokens,
    usedTokens,
    injectedKnowledgePacks,
    injectedSnippets,
    warnings,
    createdAt: new Date().toISOString(),
  };
}

export function attachKnowledgeBudgetToRouteResult(routeResult: KnowledgeRouteResult, budget: ContextBudgetResult): KnowledgeRouteResult {
  const injectedPackIds = new Set(budget.injectedKnowledgePacks.map((pack) => pack.packId));
  const existingNotInjected = routeResult.notInjected || [];
  const budgetNotInjected = routeResult.matches
    .filter((match) => !injectedPackIds.has(match.packId))
    .map((match) => {
      const warning = budget.warnings.find((item) => item.startsWith(`not_injected:${match.packId}:`));
      const reason = warning?.split(":").slice(2).join(":") || "budget_exceeded";
      return { packId: match.packId, reason };
    });
  const notInjectedByPackId = new Map([...existingNotInjected, ...budgetNotInjected].map((item) => [item.packId, item]));

  return {
    ...routeResult,
    injectedKnowledgePacks: budget.injectedKnowledgePacks,
    injectedKnowledgeSnippetIds: budget.injectedSnippets.map((snippet) => `${snippet.packId}:${snippet.snippetId}`),
    notInjected: Array.from(notInjectedByPackId.values()).sort((left, right) => left.packId.localeCompare(right.packId)),
    warnings: Array.from(new Set([...routeResult.warnings, ...budget.warnings])),
  };
}
