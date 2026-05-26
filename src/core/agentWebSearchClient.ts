import {
  fetchRuntimeJson,
  isRecord,
  projectRuntimeBasePath,
  stringOrUndefined,
} from "./runtimeApiClient";

export type AgentWebSearchProvider = "mock" | "duckduckgo_instant_answer" | "searxng_json" | "tavily_search";
export type AgentWebSearchPurpose = "style_research" | "factual_lookup" | "reference_check" | "prompt_context";

export interface AgentWebSearchSettings {
  enabled: boolean;
  provider: AgentWebSearchProvider;
  endpoint: string;
  maxResults: number;
  allowNetwork: boolean;
}

export interface AgentWebSearchCitation {
  rank: number;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  source: AgentWebSearchProvider;
  publishedAt?: string;
  hash: string;
}

export interface AgentWebSearchResult {
  kind: "agent_web_search_result";
  status: "succeeded" | "empty";
  provider: AgentWebSearchProvider;
  query: string;
  purpose: AgentWebSearchPurpose;
  resultCount: number;
  citations: AgentWebSearchCitation[];
  evidenceRef: string;
  evidencePath: string;
  retrievedAt: string;
  networkCalled: boolean;
  reviewRequired: true;
  promotionAllowed: false;
  reviewCard?: AgentWebSearchReviewCard;
  warnings: string[];
}

export type AgentWebResearchSuggestion = {
  shouldSuggest: boolean;
  query: string;
  label: string;
  detail: string;
};

export type AgentWebSearchReviewCardKind = "style_research_card" | "project_reference_card";
export type AgentWebSearchConfirmationTarget = "project_knowledge_card" | "global_card";

export interface AgentWebSearchReviewCard {
  kind: "agent_web_search_review_card";
  schemaVersion: "0.1.0";
  cardId: string;
  cardKind: AgentWebSearchReviewCardKind;
  status: "needs_user_confirmation";
  title: string;
  summary: string;
  query: string;
  purpose: AgentWebSearchPurpose;
  citationCount: number;
  citationPreviews: Array<{
    rank: number;
    title: string;
    domain: string;
    hash: string;
  }>;
  evidenceRef: string;
  evidencePath: string;
  retrievedAt: string;
  networkCalled: boolean;
  reviewRequired: true;
  confirmationRequired: true;
  projectVibeWriteAllowed: false;
  projectFactsMutated: false;
  promotionAllowed: false;
  rawSearchMayBecomeFormalFacts: false;
  allowedConfirmationTargets: AgentWebSearchConfirmationTarget[];
  factSafety: {
    rawSearchResultsAreFacts: false;
    confirmedCardRequiredBeforeKnowledgeWrite: true;
    directPromptInjectionAllowed: false;
    projectVibeWriteAllowed: false;
    notes: string[];
  };
  warnings: string[];
}

const storageKey = "vibe-director.agent-web-search.settings.v1";
export const agentWebSearchEndpoint = `${projectRuntimeBasePath}/agent/web-search`;

export const defaultAgentWebSearchSettings: AgentWebSearchSettings = {
  enabled: false,
  provider: "mock",
  endpoint: "",
  maxResults: 3,
  allowNetwork: false,
};

function normalizeProvider(value: unknown): AgentWebSearchProvider {
  return value === "duckduckgo_instant_answer" || value === "searxng_json" || value === "tavily_search" ? value : "mock";
}

function normalizeMaxResults(value: unknown) {
  return Math.min(Math.max(typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 3, 1), 5);
}

export function normalizeAgentWebSearchSettings(value: unknown): AgentWebSearchSettings {
  const record = isRecord(value) ? value : {};
  const provider = normalizeProvider(record.provider);
  const endpoint = stringOrUndefined(record.endpoint) || "";
  const allowNetwork = record.allowNetwork === true && provider !== "mock";
  return {
    enabled: record.enabled === true,
    provider,
    endpoint,
    maxResults: normalizeMaxResults(record.maxResults),
    allowNetwork,
  };
}

export function loadAgentWebSearchSettings(): AgentWebSearchSettings {
  if (typeof window === "undefined") return defaultAgentWebSearchSettings;
  try {
    return normalizeAgentWebSearchSettings(JSON.parse(window.localStorage.getItem(storageKey) || "{}"));
  } catch {
    return defaultAgentWebSearchSettings;
  }
}

export function saveAgentWebSearchSettings(settings: AgentWebSearchSettings): AgentWebSearchSettings {
  const normalized = normalizeAgentWebSearchSettings(settings);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey, JSON.stringify(normalized));
  }
  return normalized;
}

export function agentWebSearchSourceLabel(settings: Pick<AgentWebSearchSettings, "provider" | "allowNetwork">) {
  if (settings.provider === "tavily_search") return settings.allowNetwork ? "联网资料" : "联网资料待开启";
  if (settings.provider === "searxng_json") return settings.allowNetwork ? "本地搜索服务" : "本地搜索待开启";
  if (settings.provider === "duckduckgo_instant_answer") return settings.allowNetwork ? "公开搜索" : "公开搜索待开启";
  return "本地演示";
}

export function buildAgentWebResearchSuggestion(userIntent: string, settings: AgentWebSearchSettings): AgentWebResearchSuggestion {
  const intent = userIntent.trim().replace(/\s+/g, " ");
  if (!settings.enabled || !intent) {
    return {
      shouldSuggest: false,
      query: "",
      label: settings.enabled ? "可查资料" : "查资料未开启",
      detail: settings.enabled ? "描述风格或知识点后可查来源。" : "在设置里开启后，Agent 可以先整理外部来源。",
    };
  }
  const externalCue =
    /风格|参考|像|类似|导演|电影|昆汀|诺兰|王家卫|宫崎|赛博|年代|历史|真实|资料|查一下|不了解|知识|style|reference|film|movie|director|cinematic|quentin|tarantino|nolan|wong|miyazaki|cyberpunk|history|research/i.test(
      intent,
    );
  const query = `${intent} film visual style reference`;
  return {
    shouldSuggest: externalCue,
    query,
    label: externalCue ? "可先查资料" : "不必查资料",
    detail: externalCue
      ? "外部来源会先变成待确认研究卡。"
      : "这次更像项目内修改，可以直接整理计划。",
  };
}

function isCitation(value: unknown): value is AgentWebSearchCitation {
  return isRecord(value)
    && typeof value.title === "string"
    && typeof value.url === "string"
    && typeof value.domain === "string"
    && typeof value.snippet === "string";
}

function stableCardHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `research_card_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function reviewCardKindForPurpose(purpose: AgentWebSearchPurpose): AgentWebSearchReviewCardKind {
  return purpose === "style_research" ? "style_research_card" : "project_reference_card";
}

function reviewCardTitle(cardKind: AgentWebSearchReviewCardKind, userIntent: string, query: string): string {
  const label = cardKind === "style_research_card" ? "风格研究卡" : "本片参考卡";
  const suffix = (userIntent || query).replace(/\s+/g, " ").trim().slice(0, 32);
  return suffix ? `${label}：${suffix}` : label;
}

export function buildAgentWebSearchReviewCard(
  result: Omit<AgentWebSearchResult, "reviewCard">,
  userIntent = "",
): AgentWebSearchReviewCard {
  const cardKind = reviewCardKindForPurpose(result.purpose);
  const seed = JSON.stringify({
    provider: result.provider,
    query: result.query,
    purpose: result.purpose,
    evidenceRef: result.evidenceRef,
    citations: result.citations.map((source) => source.hash),
  });
  return {
    kind: "agent_web_search_review_card",
    schemaVersion: "0.1.0",
    cardId: stableCardHash(seed),
    cardKind,
    status: "needs_user_confirmation",
    title: reviewCardTitle(cardKind, userIntent, result.query),
    summary: result.citations.length
      ? `${result.citations.length} 个外部来源已整理为待确认卡片；确认前不会写入 Project.vibe 或正式知识包。`
      : "没有可用外部来源；不能写入 Project.vibe 或正式知识包。",
    query: result.query,
    purpose: result.purpose,
    citationCount: result.citations.length,
    citationPreviews: result.citations.slice(0, 5).map((source) => ({
      rank: source.rank,
      title: source.title,
      domain: source.domain,
      hash: source.hash,
    })),
    evidenceRef: result.evidenceRef,
    evidencePath: result.evidencePath,
    retrievedAt: result.retrievedAt,
    networkCalled: result.networkCalled,
    reviewRequired: true,
    confirmationRequired: true,
    projectVibeWriteAllowed: false,
    projectFactsMutated: false,
    promotionAllowed: false,
    rawSearchMayBecomeFormalFacts: false,
    allowedConfirmationTargets: ["project_knowledge_card", "global_card"],
    factSafety: {
      rawSearchResultsAreFacts: false,
      confirmedCardRequiredBeforeKnowledgeWrite: true,
      directPromptInjectionAllowed: false,
      projectVibeWriteAllowed: false,
      notes: [
        "Search citations are evidence for review, not formal story or style facts.",
        "Only a user-confirmed card may be saved as project knowledge or a global card.",
        "Prompt builders must consume confirmed knowledge cards, not raw search payloads.",
      ],
    },
    warnings: result.warnings,
  };
}

function normalizeAgentWebSearchResult(value: unknown): AgentWebSearchResult | undefined {
  if (!isRecord(value)) return undefined;
  const source = isRecord(value.result) ? value.result : value;
  if (source.kind !== "agent_web_search_result") return undefined;
  const provider = normalizeProvider(source.provider);
  const result: Omit<AgentWebSearchResult, "reviewCard"> = {
    kind: "agent_web_search_result",
    status: source.status === "empty" ? "empty" : "succeeded",
    provider,
    query: stringOrUndefined(source.query) || "",
    purpose: source.purpose === "factual_lookup" || source.purpose === "reference_check" || source.purpose === "prompt_context" ? source.purpose : "style_research",
    resultCount: typeof source.resultCount === "number" ? source.resultCount : 0,
    citations: Array.isArray(source.citations) ? source.citations.filter(isCitation) : [],
    evidenceRef: stringOrUndefined(source.evidenceRef) || "",
    evidencePath: stringOrUndefined(source.evidencePath) || "",
    retrievedAt: stringOrUndefined(source.retrievedAt) || "",
    networkCalled: source.networkCalled === true,
    reviewRequired: true,
    promotionAllowed: false,
    warnings: Array.isArray(source.warnings) ? source.warnings.filter((item): item is string => typeof item === "string") : [],
  };
  return {
    ...result,
    reviewCard: buildAgentWebSearchReviewCard(result),
  };
}

export async function runAgentWebSearch(input: {
  query: string;
  purpose?: AgentWebSearchPurpose;
  settings: AgentWebSearchSettings;
}): Promise<AgentWebSearchResult> {
  const settings = normalizeAgentWebSearchSettings(input.settings);
  const payload = await fetchRuntimeJson(agentWebSearchEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: input.query,
      purpose: input.purpose || "style_research",
      provider: settings.provider,
      endpoint: settings.endpoint || undefined,
      maxResults: settings.maxResults,
      allowNetwork: settings.enabled && settings.allowNetwork,
    }),
  });
  const result = normalizeAgentWebSearchResult(payload);
  if (!result) throw new Error("agent_web_search_result_missing");
  return result;
}
