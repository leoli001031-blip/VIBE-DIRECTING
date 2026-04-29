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

export interface BuildContextBudgetInput {
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

function snippetForSummary(pack: KnowledgePack): KnowledgeSnippet {
  return {
    id: "summary",
    title: `${pack.title} Summary`,
    content: pack.summary,
    keywords: pack.tags,
    hash: stableKnowledgeHash(pack.summary),
    tokenEstimate: estimateKnowledgeTokens(pack.summary),
  };
}

function snippetsForMatch(pack: KnowledgePack, match: KnowledgeRouteMatch): KnowledgeSnippet[] {
  const byId = new Map(pack.snippets.map((snippet) => [snippet.id, snippet]));
  const matched = match.matchedSnippetIds.map((snippetId) => byId.get(snippetId)).filter((snippet): snippet is KnowledgeSnippet => Boolean(snippet));

  if (matched.length) return matched;
  if (pack.snippets.length) return pack.snippets.slice(0, 1);
  return [snippetForSummary(pack)];
}

function trimToBudget(content: string, maxTokens: number): string {
  const maxChars = Math.max(1, maxTokens * 4);

  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars).trimEnd();
}

export function buildContextBudget(input: BuildContextBudgetInput): ContextBudgetResult {
  const packById = new Map(input.availablePacks.map((pack) => [pack.id, pack]));
  const levelBudget = Math.floor(1200 * contextLevelMultiplier[input.routeResult.contextLevel]);
  const maxInjectionTokens = Math.max(1, Math.floor(input.maxInjectionTokens || levelBudget));
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

    const perPackLimit = Math.min(pack.maxInjectionTokens, maxInjectionTokens - usedTokens);
    const selectedSnippetIds: string[] = [];
    let packTokens = 0;
    let truncated = false;
    let truncationReason: string | undefined;

    if (perPackLimit <= 0) {
      injectedKnowledgePacks.push({
        packId: pack.id,
        version: pack.version,
        hash: pack.hash,
        category: pack.category,
        reason: match.reason,
        consumer: match.consumer,
        injectedSnippetIds: [],
        summaryHash: stableKnowledgeHash(pack.summary),
        truncated: true,
        truncationReason: "global_context_budget_exhausted",
      });
      continue;
    }

    for (const snippet of snippetsForMatch(pack, match)) {
      const remainingGlobal = maxInjectionTokens - usedTokens;
      const remainingPack = perPackLimit - packTokens;
      const remaining = Math.min(remainingGlobal, remainingPack);
      const tokenEstimate = snippet.tokenEstimate || estimateKnowledgeTokens(snippet.content);

      if (remaining <= 0) {
        truncated = true;
        truncationReason = packTokens >= perPackLimit ? "pack_max_injection_tokens_exhausted" : "global_context_budget_exhausted";
        break;
      }

      const injectedTokenEstimate = Math.min(tokenEstimate, remaining);
      const content = tokenEstimate > remaining ? trimToBudget(snippet.content, remaining) : snippet.content;

      if (tokenEstimate > remaining) {
        truncated = true;
        truncationReason = packTokens + tokenEstimate > perPackLimit ? "pack_max_injection_tokens_exhausted" : "global_context_budget_exhausted";
      }

      selectedSnippetIds.push(snippet.id);
      injectedSnippets.push({
        packId: pack.id,
        snippetId: snippet.id,
        title: snippet.title,
        content,
        tokenEstimate: injectedTokenEstimate,
        hash: snippet.hash,
      });
      usedTokens += injectedTokenEstimate;
      packTokens += injectedTokenEstimate;

      if (truncated) break;
    }

    injectedKnowledgePacks.push({
      packId: pack.id,
      version: pack.version,
      hash: pack.hash,
      category: pack.category,
      reason: match.reason,
      consumer: match.consumer,
      injectedSnippetIds: selectedSnippetIds,
      summaryHash: stableKnowledgeHash(pack.summary),
      truncated,
      truncationReason,
    });
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

export function attachBudgetToRouteResult(routeResult: KnowledgeRouteResult, budget: ContextBudgetResult): KnowledgeRouteResult {
  return {
    ...routeResult,
    injectedKnowledgePacks: budget.injectedKnowledgePacks,
    injectedKnowledgeSnippetIds: budget.injectedSnippets.map((snippet) => `${snippet.packId}:${snippet.snippetId}`),
    warnings: [...routeResult.warnings, ...budget.warnings],
  };
}
