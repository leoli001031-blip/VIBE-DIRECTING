import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  agentWebSearchEndpoint,
  buildAgentWebSearchReviewCard,
  buildAgentWebResearchSuggestion,
  defaultAgentWebSearchSettings,
  normalizeAgentWebSearchSettings,
  type AgentWebSearchResult,
} from "../src/core/agentWebSearchClient.ts";
import { createRuntimeApiAgentWebSearchRoute } from "./runtime-routes/agent-web-search.mts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function createResponse() {
  const writes: Array<{ status: number; payload: unknown }> = [];
  return {
    writes,
    writeHead(status: number) {
      writes.push({ status, payload: undefined });
    },
    end(value?: string) {
      const current = writes[writes.length - 1];
      if (current && value) current.payload = JSON.parse(value);
    },
  };
}

const normalized = normalizeAgentWebSearchSettings({
  enabled: true,
  provider: "searxng_json",
  endpoint: "http://127.0.0.1:8080/search",
  maxResults: 20,
  allowNetwork: true,
});
assert(normalized.provider === "searxng_json", "settings should preserve provider");
assert(normalized.maxResults === 5, "settings should clamp max results");
assert(normalized.allowNetwork === true, "settings should allow network for non-mock provider");
assert(normalizeAgentWebSearchSettings({ ...normalized, provider: "mock", allowNetwork: true }).allowNetwork === false, "mock provider must disable network");
const normalizedTavily = normalizeAgentWebSearchSettings({
  enabled: true,
  provider: "tavily_search",
  maxResults: 4,
  allowNetwork: true,
});
assert(normalizedTavily.provider === "tavily_search", "settings should preserve Tavily provider");
assert(normalizedTavily.allowNetwork === true, "Tavily provider should allow explicit network research");

const disabledSuggestion = buildAgentWebResearchSuggestion("昆汀风格的雨夜对话", defaultAgentWebSearchSettings);
assert(disabledSuggestion.shouldSuggest === false, "disabled settings should not suggest active research");
const enabledSuggestion = buildAgentWebResearchSuggestion("昆汀风格的雨夜对话", { ...normalized, enabled: true });
assert(enabledSuggestion.shouldSuggest === true, "style/director cue should suggest research");
assert(enabledSuggestion.query.includes("film visual style reference"), "suggestion should build a research query");

const root = mkdtempSync(join(tmpdir(), "agent-web-search-product-"));
const runtimeRoot = mkdtempSync(join(tmpdir(), "agent-web-search-runtime-"));
try {
  const route = createRuntimeApiAgentWebSearchRoute({
    endpoint: agentWebSearchEndpoint,
    repoRoot: root,
    runtimeRoot,
    runtimePolicy: () => ({ runtimeMode: "local", providerCalled: false }),
    readRequestJsonBody: async (req: { body?: unknown }) => ({ ok: true, body: req.body }),
    writeJson: (res: ReturnType<typeof createResponse>, status: number, payload: unknown) => {
      res.writeHead(status);
      res.end(JSON.stringify(payload));
    },
  });

  const wrongPath = createResponse();
  assert(
    await route.handleRuntimeApiAgentWebSearchRoute({ method: "POST", body: {} }, wrongPath, new URL("http://127.0.0.1/api/runtime/nope")) === false,
    "wrong path should not be handled",
  );

  const mockResponse = createResponse();
  const handled = await route.handleRuntimeApiAgentWebSearchRoute({
    method: "POST",
    body: {
      query: "Quentin Tarantino visual style dialogue scene",
      purpose: "style_research",
      provider: "mock",
      maxResults: 2,
    },
  }, mockResponse, new URL(`http://127.0.0.1${agentWebSearchEndpoint}`));
  assert(handled === true, "web search endpoint should handle POST");
  assert(mockResponse.writes[0].status === 200, "mock web search should return 200");
  const payload = mockResponse.writes[0].payload as { result?: { evidencePath?: string; resultCount?: number; networkCalled?: boolean; promotionAllowed?: boolean } };
  assert(payload.result?.resultCount === 2, "mock web search should return requested citations");
  assert(payload.result.networkCalled === false, "mock web search must not call network");
  assert(payload.result.promotionAllowed === false, "web search result must not promote");
  const reviewCard = buildAgentWebSearchReviewCard(payload.result as AgentWebSearchResult, "像昆汀一样处理雨夜对话");
  assert(reviewCard.kind === "agent_web_search_review_card", "web search output should be wrapped as a review card");
  assert(reviewCard.cardKind === "style_research_card", "style research searches should become style research cards");
  assert(reviewCard.status === "needs_user_confirmation", "research card must wait for user confirmation");
  assert(reviewCard.projectVibeWriteAllowed === false, "unconfirmed research card must not write Project.vibe");
  assert(reviewCard.projectFactsMutated === false, "unconfirmed research card must not mutate project facts");
  assert(reviewCard.rawSearchMayBecomeFormalFacts === false, "raw search must never become formal facts directly");
  assert(reviewCard.allowedConfirmationTargets.includes("project_knowledge_card"), "card should be saveable as project knowledge after confirmation");
  assert(reviewCard.allowedConfirmationTargets.includes("global_card"), "card should be saveable as a global card after confirmation");
  assert(reviewCard.factSafety.confirmedCardRequiredBeforeKnowledgeWrite === true, "knowledge writes must require confirmed cards");
  assert(payload.result.evidencePath && existsSync(join(runtimeRoot, payload.result.evidencePath)), "web search route should write evidence JSON under the runtime writable root");
  assert(!existsSync(join(root, payload.result.evidencePath)), "web search route must not write cache files into the app/repo root when a runtime root is provided");
  const evidence = readFileSync(join(runtimeRoot, payload.result.evidencePath), "utf8");
  assert(evidence.includes("Quentin Tarantino visual style dialogue scene"), "evidence should preserve the query");

  const blockedResponse = createResponse();
  await route.handleRuntimeApiAgentWebSearchRoute({
    method: "POST",
    body: {
      query: "blocked external search",
      provider: "searxng_json",
      endpoint: "http://192.168.0.1/search",
      allowNetwork: true,
    },
  }, blockedResponse, new URL(`http://127.0.0.1${agentWebSearchEndpoint}`));
  assert(blockedResponse.writes[0].status === 400, "non-local HTTP endpoint should be blocked");
  assert(JSON.stringify(blockedResponse.writes[0].payload).includes("HTTPS or local HTTP"), "blocked route should explain endpoint policy");

  const tavilyMissingKeyResponse = createResponse();
  await route.handleRuntimeApiAgentWebSearchRoute({
    method: "POST",
    body: {
      query: "Tavily missing key should fail before network",
      provider: "tavily_search",
      allowNetwork: true,
    },
  }, tavilyMissingKeyResponse, new URL(`http://127.0.0.1${agentWebSearchEndpoint}`));
  assert(tavilyMissingKeyResponse.writes[0].status === 400, "Tavily should require a configured credential");
  assert(JSON.stringify(tavilyMissingKeyResponse.writes[0].payload).includes("web_search_tavily_api_key_required"), "Tavily key failure should be explicit");

  console.log(`agent-web-search-product-test: ok evidence=${payload.result.evidencePath}`);
} finally {
  rmSync(root, { recursive: true, force: true });
  rmSync(runtimeRoot, { recursive: true, force: true });
}
