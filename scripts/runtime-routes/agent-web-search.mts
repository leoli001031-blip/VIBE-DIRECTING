import { mkdirSync } from "node:fs";
import path from "node:path";

import { createAgentWebSearchTool } from "../../src/agent/webSearchTool.ts";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asProvider(value) {
  if (value === "duckduckgo_instant_answer" || value === "searxng_json" || value === "tavily_search") return value;
  return "mock";
}

function asPurpose(value) {
  if (value === "factual_lookup" || value === "reference_check" || value === "prompt_context") return value;
  return "style_research";
}

function asMaxResults(value) {
  return Math.min(Math.max(typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 3, 1), 5);
}

function endpointAllowed(provider, endpoint) {
  if (!endpoint) return provider === "duckduckgo_instant_answer" || provider === "tavily_search";
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (parsed.protocol === "http:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") return false;
    return true;
  } catch {
    return false;
  }
}

export function createRuntimeApiAgentWebSearchRoute({
  endpoint,
  getProviderApiKey = () => undefined,
  readRequestJsonBody,
  repoRoot,
  runtimeRoot = repoRoot,
  runtimePolicy,
  writeJson,
}) {
  const evidenceRelativeDir = ".vibe-runtime/web-search";

  async function handleRuntimeApiAgentWebSearchRoute(req, res, url) {
    if (url.pathname !== endpoint) return false;
    if (req.method !== "POST") {
      writeJson(res, 405, {
        ok: false,
        ...runtimePolicy(),
        status: "method_not_allowed",
        providerCalled: false,
      });
      return true;
    }

    let networkRequested = false;
    try {
      const parsedBody = await readRequestJsonBody(req, { signal: AbortSignal.timeout(10_000) });
      if (isRecord(parsedBody) && parsedBody.ok === false) {
        writeJson(res, 400, {
          ok: false,
          ...runtimePolicy(),
          status: "bad_request",
          message: asString(parsedBody.message, "Request body must be valid JSON."),
          providerCalled: false,
        });
        return true;
      }
      const body = isRecord(parsedBody) && parsedBody.ok === true && "body" in parsedBody ? parsedBody.body : parsedBody;
      if (!isRecord(body)) {
        writeJson(res, 400, {
          ok: false,
          ...runtimePolicy(),
          status: "bad_request",
          message: "Request body must be a JSON object.",
          providerCalled: false,
        });
        return true;
      }

      const provider = asProvider(body.provider);
      const providerEndpoint = asString(body.endpoint);
      networkRequested = body.allowNetwork === true && provider !== "mock";
      if (networkRequested && !endpointAllowed(provider, providerEndpoint)) {
        writeJson(res, 400, {
          ok: false,
          ...runtimePolicy(),
          status: "blocked",
          message: "Web search endpoint must be HTTPS or local HTTP.",
          providerCalled: false,
        });
        return true;
      }

      try { mkdirSync(path.join(runtimeRoot, evidenceRelativeDir), { recursive: true }); } catch { /* evidence dir may already exist; ignore benign creation errors */ }

      const apiKey = provider === "tavily_search" ? getProviderApiKey("tavily-search") : undefined;
      if (provider === "tavily_search" && !apiKey) {
        writeJson(res, 400, {
          ok: false,
          ...runtimePolicy(),
          status: "blocked",
          message: "web_search_tavily_api_key_required",
          providerCalled: false,
        });
        return true;
      }

      const tool = createAgentWebSearchTool({
        provider,
        endpoint: providerEndpoint || undefined,
        apiKey,
        allowNetwork: networkRequested,
        maxResults: asMaxResults(body.maxResults),
        evidenceRelativeDir,
      });
      const result = await tool.execute({
        query: asString(body.query),
        purpose: asPurpose(body.purpose),
        maxResults: asMaxResults(body.maxResults),
        allowedDomains: Array.isArray(body.allowedDomains) ? body.allowedDomains.filter((item) => typeof item === "string") : undefined,
      }, {
        taskEnvelope: {
          id: "runtime_agent_web_search",
          purpose: "research",
          providerSlot: "agent.web_search",
        },
        sandboxRoot: runtimeRoot,
        sessionId: asString(body.sessionId, "runtime-agent-web-search"),
      });
      writeJson(res, 200, {
        ok: true,
        ...runtimePolicy(),
        status: result.status,
        providerCalled: result.networkCalled,
        result,
      });
      return true;
    } catch (error) {
      writeJson(res, 500, {
        ok: false,
        ...runtimePolicy(),
        status: networkRequested ? "provider_failed" : "blocked",
        message: error instanceof Error ? error.message : String(error),
        providerCalled: networkRequested,
      });
      return true;
    }
  }

  return { handleRuntimeApiAgentWebSearchRoute };
}
