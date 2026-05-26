import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";

import type { ToolContext, ToolDefinition } from "./toolRegistry";

export const agentWebSearchToolName = "web_search";
export const agentWebSearchToolSchemaVersion = "0.1.0";

export type AgentWebSearchProvider = "mock" | "duckduckgo_instant_answer" | "searxng_json" | "tavily_search";
export type AgentWebSearchPurpose = "style_research" | "factual_lookup" | "reference_check" | "prompt_context";

export const agentWebSearchToolInputSchema = z.object({
  query: z.string().trim().min(3).max(240),
  purpose: z.enum(["style_research", "factual_lookup", "reference_check", "prompt_context"]).default("style_research"),
  maxResults: z.number().int().min(1).max(5).optional(),
  allowedDomains: z.array(z.string().trim().min(3).max(120)).max(8).optional(),
  recencyDays: z.number().int().positive().max(3650).optional(),
  notes: z.string().trim().max(500).optional(),
}).strict();

export type AgentWebSearchToolInput = z.infer<typeof agentWebSearchToolInputSchema>;

export interface AgentWebSearchToolConfig {
  provider?: AgentWebSearchProvider;
  endpoint?: string;
  apiKey?: string;
  allowNetwork?: boolean;
  timeoutMs?: number;
  maxResults?: number;
  evidenceRelativeDir?: string;
  fixedNow?: string;
  fetchImpl?: typeof fetch;
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

export interface AgentWebSearchToolResult {
  kind: "agent_web_search_result";
  schemaVersion: typeof agentWebSearchToolSchemaVersion;
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
  warnings: string[];
}

type RawSearchItem = {
  title?: unknown;
  url?: unknown;
  snippet?: unknown;
  source?: unknown;
  publishedAt?: unknown;
};

const defaultEvidenceDir = "evidence/web-search";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function hashValue(prefix: string, value: unknown): string {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function safeId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "search";
}

function normalizeRelativePath(path: string): string {
  const normalized = path.trim().replace(/\\/g, "/").replace(/^\.?\//, "").replace(/\/+$/, "");
  if (!normalized || normalized.startsWith("~/") || isAbsolute(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`Web search evidence path must be project-relative and scoped: ${path}`);
  }
  return normalized;
}

function resolveEvidencePath(context: ToolContext, evidenceRelativeDir: string, evidenceId: string) {
  const relativePath = `${normalizeRelativePath(evidenceRelativeDir)}/${safeId(evidenceId)}.json`;
  const root = resolve(context.sandboxRoot);
  const absolutePath = resolve(root, relativePath);
  const scopedRelative = relative(root, absolutePath);
  if (scopedRelative === "" || scopedRelative.startsWith("..") || isAbsolute(scopedRelative)) {
    throw new Error(`Web search evidence path escaped sandbox: ${relativePath}`);
  }
  return { relativePath, absolutePath };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function domainAllowed(domain: string, allowedDomains?: string[]): boolean {
  if (!allowedDomains?.length) return true;
  const allowed = allowedDomains.map((item) => item.toLowerCase().replace(/^www\./, ""));
  return allowed.some((allowedDomain) => domain === allowedDomain || domain.endsWith(`.${allowedDomain}`));
}

function toCitation(item: RawSearchItem, provider: AgentWebSearchProvider, rank: number): AgentWebSearchCitation | undefined {
  const url = normalizeUrl(asText(item.url));
  if (!url) return undefined;
  const domain = domainFromUrl(url);
  if (!domain) return undefined;
  const title = asText(item.title) || domain;
  const snippet = asText(item.snippet).replace(/\s+/g, " ").slice(0, 420);
  return {
    rank,
    title: title.slice(0, 180),
    url,
    domain,
    snippet,
    source: provider,
    publishedAt: asText(item.publishedAt) || undefined,
    hash: hashValue("web_source", { url, title, snippet }),
  };
}

function dedupeAndLimit(items: RawSearchItem[], provider: AgentWebSearchProvider, maxResults: number, allowedDomains?: string[]): AgentWebSearchCitation[] {
  const seen = new Set<string>();
  const citations: AgentWebSearchCitation[] = [];
  for (const item of items) {
    const citation = toCitation(item, provider, citations.length + 1);
    if (!citation) continue;
    if (!domainAllowed(citation.domain, allowedDomains)) continue;
    if (seen.has(citation.url)) continue;
    seen.add(citation.url);
    citations.push({ ...citation, rank: citations.length + 1 });
    if (citations.length >= maxResults) break;
  }
  return citations;
}

function mockSearch(input: AgentWebSearchToolInput, maxResults: number): AgentWebSearchCitation[] {
  const queryId = safeId(input.query).toLowerCase();
  const items: RawSearchItem[] = [
    {
      title: `External style research for ${input.query}`,
      url: `https://example.test/research/${queryId}`,
      snippet: "Mock search evidence: dialogue rhythm, genre contrast, lens language, color cues, and reference caveats should be cited before becoming project facts.",
    },
    {
      title: `Source checklist for ${input.query}`,
      url: `https://example.test/source-checklist/${queryId}`,
      snippet: "Mock source evidence: separate verified references from creative interpretation, and keep final style instructions concise.",
    },
  ];
  return dedupeAndLimit(items, "mock", maxResults, input.allowedDomains);
}

async function fetchJson(url: URL, fetchImpl: typeof fetch, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`web_search_http_${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error(`fetchJson failed for ${url.href}:`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function postJson(url: URL, body: unknown, fetchImpl: typeof fetch, timeoutMs: number, headers: Record<string, string> = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`web_search_http_${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error(`postJson failed for ${url.href}:`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function flattenDuckDuckGoTopic(topic: unknown): RawSearchItem[] {
  const record = asRecord(topic);
  if (!record) return [];
  if (Array.isArray(record.Topics)) return record.Topics.flatMap((item) => flattenDuckDuckGoTopic(item));
  const text = asText(record.Text);
  const firstUrl = asText(record.FirstURL);
  if (!text || !firstUrl) return [];
  const parts = text.split(" - ");
  return [{
    title: parts[0] || text,
    url: firstUrl,
    snippet: parts.slice(1).join(" - ") || text,
    source: "duckduckgo_instant_answer",
  }];
}

async function duckDuckGoSearch(input: AgentWebSearchToolInput, config: AgentWebSearchToolConfig, maxResults: number): Promise<AgentWebSearchCitation[]> {
  const fetchImpl = config.fetchImpl || fetch;
  const url = new URL(config.endpoint || "https://api.duckduckgo.com/");
  url.searchParams.set("q", input.query);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  url.searchParams.set("skip_disambig", "1");
  const payload = asRecord(await fetchJson(url, fetchImpl, config.timeoutMs || 12000)) || {};
  const items: RawSearchItem[] = [];
  const abstractUrl = asText(payload.AbstractURL);
  const abstractText = asText(payload.AbstractText);
  const heading = asText(payload.Heading);
  if (abstractUrl && abstractText) {
    items.push({
      title: heading || input.query,
      url: abstractUrl,
      snippet: abstractText,
      source: "duckduckgo_instant_answer",
    });
  }
  items.push(...asArray(payload.Results).flatMap((item) => flattenDuckDuckGoTopic(item)));
  items.push(...asArray(payload.RelatedTopics).flatMap((item) => flattenDuckDuckGoTopic(item)));
  return dedupeAndLimit(items, "duckduckgo_instant_answer", maxResults, input.allowedDomains);
}

async function searxngSearch(input: AgentWebSearchToolInput, config: AgentWebSearchToolConfig, maxResults: number): Promise<AgentWebSearchCitation[]> {
  if (!config.endpoint) {
    throw new Error("web_search_searxng_endpoint_required");
  }
  const fetchImpl = config.fetchImpl || fetch;
  const url = new URL(config.endpoint);
  url.searchParams.set("q", input.query);
  url.searchParams.set("format", "json");
  if (input.recencyDays) url.searchParams.set("time_range", input.recencyDays <= 2 ? "day" : input.recencyDays <= 10 ? "week" : input.recencyDays <= 45 ? "month" : "year");
  const payload = asRecord(await fetchJson(url, fetchImpl, config.timeoutMs || 12000)) || {};
  const items = asArray(payload.results).map((item): RawSearchItem => {
    const record = asRecord(item) || {};
    return {
      title: record.title,
      url: record.url,
      snippet: record.content ?? record.snippet,
      source: record.engine,
      publishedAt: record.publishedDate ?? record.published_at,
    };
  });
  return dedupeAndLimit(items, "searxng_json", maxResults, input.allowedDomains);
}

async function tavilySearch(input: AgentWebSearchToolInput, config: AgentWebSearchToolConfig, maxResults: number): Promise<AgentWebSearchCitation[]> {
  const apiKey = asText(config.apiKey);
  if (!apiKey) {
    throw new Error("web_search_tavily_api_key_required");
  }
  const fetchImpl = config.fetchImpl || fetch;
  const url = new URL(config.endpoint || "https://api.tavily.com/search");
  const payload = asRecord(await postJson(url, {
    query: input.query,
    search_depth: "basic",
    topic: "general",
    max_results: maxResults,
    include_answer: false,
    include_raw_content: false,
    include_images: false,
    include_image_descriptions: false,
  }, fetchImpl, config.timeoutMs || 20000, {
    Authorization: `Bearer ${apiKey}`,
  })) || {};
  const items = asArray(payload.results).map((item): RawSearchItem => {
    const record = asRecord(item) || {};
    return {
      title: record.title,
      url: record.url,
      snippet: record.content ?? record.snippet,
      source: "tavily_search",
      publishedAt: record.published_date ?? record.publishedAt,
    };
  });
  return dedupeAndLimit(items, "tavily_search", maxResults, input.allowedDomains);
}

async function runSearch(input: AgentWebSearchToolInput, config: AgentWebSearchToolConfig, maxResults: number): Promise<{ citations: AgentWebSearchCitation[]; networkCalled: boolean }> {
  const provider = config.provider || "mock";
  if (provider === "mock") {
    return { citations: mockSearch(input, maxResults), networkCalled: false };
  }
  if (!config.allowNetwork) {
    throw new Error("web_search_network_disabled");
  }
  if (provider === "duckduckgo_instant_answer") {
    return { citations: await duckDuckGoSearch(input, config, maxResults), networkCalled: true };
  }
  if (provider === "tavily_search") {
    return { citations: await tavilySearch(input, config, maxResults), networkCalled: true };
  }
  return { citations: await searxngSearch(input, config, maxResults), networkCalled: true };
}

export function createAgentWebSearchTool(config: AgentWebSearchToolConfig = {}): ToolDefinition<AgentWebSearchToolInput, AgentWebSearchToolResult> {
  const provider = config.provider || "mock";
  const configuredMaxResults = Math.min(Math.max(config.maxResults || 3, 1), 5);
  const evidenceRelativeDir = config.evidenceRelativeDir || defaultEvidenceDir;

  return {
    name: agentWebSearchToolName,
    description: [
      "Search the public web for external research when project knowledge packs are insufficient.",
      "Return concise citations only; do not treat web findings as Project.vibe facts until the user confirms them.",
    ].join(" "),
    schema: agentWebSearchToolInputSchema,
    requiresApproval: provider !== "mock",
    async execute(rawInput, context): Promise<AgentWebSearchToolResult> {
      const input = agentWebSearchToolInputSchema.parse(rawInput);
      const maxResults = Math.min(input.maxResults || configuredMaxResults, configuredMaxResults, 5);
      const retrievedAt = config.fixedNow || new Date().toISOString();
      const { citations, networkCalled } = await runSearch(input, { ...config, provider }, maxResults);
      const evidenceId = hashValue("web_search", {
        taskEnvelopeId: context.taskEnvelope.id,
        sessionId: context.sessionId,
        provider,
        query: input.query,
        purpose: input.purpose,
        maxResults,
        citations,
        retrievedAt,
      });
      const evidencePath = resolveEvidencePath(context, evidenceRelativeDir, evidenceId);
      const warnings = [
        citations.length ? "" : "no_search_results_returned",
        input.allowedDomains?.length && !citations.length ? "allowed_domain_filter_removed_all_results" : "",
      ].filter(Boolean);
      const result: AgentWebSearchToolResult = {
        kind: "agent_web_search_result",
        schemaVersion: agentWebSearchToolSchemaVersion,
        status: citations.length ? "succeeded" : "empty",
        provider,
        query: input.query,
        purpose: input.purpose,
        resultCount: citations.length,
        citations,
        evidenceRef: `${agentWebSearchToolName}#${evidencePath.relativePath}`,
        evidencePath: evidencePath.relativePath,
        retrievedAt,
        networkCalled,
        reviewRequired: true,
        promotionAllowed: false,
        warnings,
      };
      await mkdir(resolve(context.sandboxRoot, normalizeRelativePath(evidenceRelativeDir)), { recursive: true });
      await writeFile(evidencePath.absolutePath, JSON.stringify(result, null, 2), "utf8");
      return result;
    },
  };
}
