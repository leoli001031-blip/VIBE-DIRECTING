import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { LanguageModel, ModelMessage, ToolSet } from "ai";

import {
  buildInputHash,
  buildNonOverridableGateHashes,
  buildPolicyBinding,
  envelopeSchemaVersion,
} from "../src/core/envelopeValidator.ts";
import type { TaskEnvelope } from "../src/core/types.ts";
import {
  agentWebSearchToolName,
  canPromoteOwnedAgentResult,
  createAgentWebSearchTool,
  createOwnedAgentToolRegistry,
  runOwnedAgentTaskEnvelope,
  ToolRegistry,
  validateOwnedAgentTaskEnvelope,
  type LLMCallResult,
  type LLMProvider,
} from "../src/agent/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value as Record<string, unknown>;
}

function taskEnvelope(id = "task_owned_agent_web_search_style_001"): TaskEnvelope {
  const base = {
    schemaVersion: envelopeSchemaVersion,
    id,
    purpose: "audit",
    providerSlot: "image.generate",
    providerId: "agent",
    executionState: "planned",
    requiredMode: "text2image",
    storyFunction: "Research an external film style reference before turning it into a creator-facing visual direction.",
    sourceIndexHash: "source_hash_owned_agent_web_123",
    dependencies: [],
    contextLevel: "L2",
    expectedOutputs: ["evidence/web-search/style-research.json"],
    hardRules: ["no_free_text_task", "external_web_findings_require_user_confirmation"],
    references: [],
    qaChecklist: ["citation_gate", "project_fact_confirmation_gate"],
    preflight: {
      taskId: id,
      preflightScope: "formal_execution",
      status: "pass",
      blockers: [],
      warnings: [],
      checkedAt: "2026-05-19T09:00:00.000Z",
    },
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    injectedKnowledgeSnippets: [],
    routeWarnings: ["local_knowledge_pack_gap_requires_external_research"],
    sourceFactTrace: ["source_index:source_hash_owned_agent_web_123"],
    blockingReasons: [],
  } as TaskEnvelope;
  const policyBinding = buildPolicyBinding(base);
  const withBinding = {
    ...base,
    policyBinding,
    nonOverridableGateHashes: buildNonOverridableGateHashes({ ...base, policyBinding }),
  };
  return {
    ...withBinding,
    inputHash: buildInputHash(withBinding),
  };
}

const root = mkdtempSync(join(tmpdir(), "owned-agent-web-search-"));

try {
  const envelope = taskEnvelope();
  const validatedEnvelope = validateOwnedAgentTaskEnvelope(envelope);

  const defaultRegistry = createOwnedAgentToolRegistry({ providerMode: "mock_provider" });
  assert(!defaultRegistry.listToolNames().includes(agentWebSearchToolName), "web_search must stay opt-in by default");
  const enabledRegistry = createOwnedAgentToolRegistry({
    providerMode: "mock_provider",
    webSearchTool: { provider: "mock", fixedNow: "2026-05-19T09:00:00.000Z" },
  });
  assert(enabledRegistry.listToolNames().includes(agentWebSearchToolName), "web_search should register when explicitly configured");

  let callCount = 0;
  const researchProvider: LLMProvider = {
    async call(messages: ModelMessage[], tools?: ToolSet): Promise<LLMCallResult> {
      callCount += 1;
      assert(tools?.[agentWebSearchToolName], "configured owned agent must expose web_search");
      if (callCount === 1) {
        return {
          text: null,
          toolCalls: [{
            id: "web-search-quentin-style",
            name: agentWebSearchToolName,
            args: {
              query: "Quentin Tarantino visual style dialogue scene",
              purpose: "style_research",
              maxResults: 2,
            },
          }],
          finishReason: "tool-calls",
          usage: { inputTokens: 42, outputTokens: 9 },
        };
      }
      const toolMessage = messages.find((message) => message.role === "tool");
      assert(JSON.stringify(toolMessage).includes("agent_web_search_result"), "provider should receive structured web_search tool output");
      return {
        text: "Use cited external research as a draft note only; ask the user before writing it into Project.vibe.",
        toolCalls: [],
        finishReason: "stop",
        usage: { inputTokens: 50, outputTokens: 12 },
      };
    },
  };

  const result = await runOwnedAgentTaskEnvelope({
    validatedTaskEnvelope: validatedEnvelope,
    sandboxRoot: root,
    sessionId: "owned-agent-web-search-session",
    createdAt: "2026-05-19T09:00:00.000Z",
    config: {
      providerMode: "mock_provider",
      providerClient: researchProvider,
      provider: {
        model: {} as LanguageModel,
        systemPrompt: "Owned agent web search test provider.",
      },
      maxTurns: 4,
      webSearchTool: { provider: "mock", fixedNow: "2026-05-19T09:00:00.000Z" },
    },
  });

  assert(result.status === "succeeded", `web search run should succeed: ${result.blockedReasons.join("; ")}`);
  assert(result.webSearches.length === 1, "structured owned result must expose webSearches");
  assert(result.webSearches[0].citations.length === 2, "mock web search should return two citations");
  assert(result.webSearches[0].networkCalled === false, "mock web search must not perform network IO");
  assert(result.receiptCandidate?.reviewRequired === true, "web findings must require review before promotion");
  assert(result.receiptCandidate?.canPromote === false, "web findings must not auto-promote into project facts");
  assert(result.promotionAllowed === false && !canPromoteOwnedAgentResult(result), "web-search-backed owned result must not promote without user confirmation");
  assert(result.evidenceRefs.some((ref) => ref.startsWith(`${agentWebSearchToolName}#evidence/web-search/`)), "web search evidence ref must be surfaced");
  assert(existsSync(join(root, result.webSearches[0].evidencePath)), "web search evidence JSON must be written inside sandbox");
  const evidenceJson = JSON.parse(readFileSync(join(root, result.webSearches[0].evidencePath), "utf8"));
  assert(evidenceJson.query === "Quentin Tarantino visual style dialogue scene", "evidence JSON should preserve query");
  assert(!JSON.stringify(evidenceJson).includes("apiKey"), "web search evidence must not leak credentials");

  const blockedRegistry = new ToolRegistry();
  blockedRegistry.register(createAgentWebSearchTool({
    provider: "duckduckgo_instant_answer",
    fetchImpl: async () => {
      throw new Error("fetch should not run when network is disabled");
    },
  }));
  const blocked = await blockedRegistry.dispatch([{
    id: "blocked-web-search",
    name: agentWebSearchToolName,
    args: { query: "live network should be blocked", purpose: "factual_lookup" },
  }], {
    taskEnvelope: envelope as unknown as Record<string, unknown>,
    sandboxRoot: root,
    sessionId: "blocked-web-search-session",
  });
  assert(blocked[0].error === "web_search_network_disabled", "network providers must fail closed unless allowNetwork is true");

  let searxngPath = "";
  const searxngServer = createServer((request, response) => {
    searxngPath = request.url || "";
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      results: [
        {
          title: "Camera language source",
          url: "https://cinema.example/articles/camera-language",
          content: "A concise source snippet for camera language.",
          engine: "fixture",
          publishedDate: "2026-05-01",
        },
      ],
    }));
  });
  await new Promise<void>((resolve) => searxngServer.listen(0, "127.0.0.1", resolve));
  try {
    const address = searxngServer.address() as AddressInfo;
    const liveRegistry = new ToolRegistry();
    liveRegistry.register(createAgentWebSearchTool({
      provider: "searxng_json",
      endpoint: `http://127.0.0.1:${address.port}/search`,
      allowNetwork: true,
      fixedNow: "2026-05-19T09:00:00.000Z",
    }));
    const live = await liveRegistry.dispatch([{
      id: "searxng-web-search",
      name: agentWebSearchToolName,
      args: {
        query: "camera language source",
        purpose: "reference_check",
        allowedDomains: ["cinema.example"],
      },
    }], {
      taskEnvelope: envelope as unknown as Record<string, unknown>,
      sandboxRoot: root,
      sessionId: "searxng-web-search-session",
    });
    assert(!live[0].error, `searxng search should succeed: ${live[0].error}`);
    const liveOutput = asRecord(live[0].output, "searxng output");
    assert(liveOutput.networkCalled === true, "searxng provider should report networkCalled=true");
    assert(liveOutput.resultCount === 1, "searxng provider should parse JSON results");
    assert(searxngPath.includes("format=json"), "searxng request must ask for JSON");
    assert(searxngPath.includes("camera+language+source") || searxngPath.includes("camera%20language%20source"), "searxng request must include query");
  } finally {
    await new Promise<void>((resolve) => searxngServer.close(() => resolve()));
  }

  console.log(`owned-agent-web-search-tool-test passed: citations=${result.webSearches[0].citations.length}, evidence=${result.webSearches[0].evidencePath}`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
