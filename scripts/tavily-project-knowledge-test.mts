import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createAgentWebSearchTool } from "../src/agent/webSearchTool.ts";
import {
  buildProjectLocalKnowledgeManifest,
  buildProjectLocalKnowledgePackFromWebSearch,
  buildProjectLocalKnowledgeReferenceStagedTransaction,
  commitProjectLocalKnowledgeReferenceStagedTransaction,
} from "../src/core/projectLocalKnowledge.ts";
import { routeKnowledge } from "../src/core/knowledgeRouter.ts";
import type { AgentWebSearchResult } from "../src/core/agentWebSearchClient.ts";
import { createProjectVibe, hashProjectVibeFacts, validateProjectVibe } from "../src/project/projectVibe.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value as Record<string, unknown>;
}

const root = mkdtempSync(join(tmpdir(), "tavily-project-knowledge-"));
let requestedBody = "";
let requestedAuthorization = "";

try {
  const tool = createAgentWebSearchTool({
    provider: "tavily_search",
    apiKey: "tvly-test-secret",
    allowNetwork: true,
    maxResults: 3,
    fixedNow: "2026-05-19T10:00:00.000Z",
    fetchImpl: async (_url, init) => {
      requestedBody = typeof init?.body === "string" ? init.body : "";
      requestedAuthorization = String((init?.headers as Record<string, string> | undefined)?.Authorization || "");
      return new Response(JSON.stringify({
        results: [
          {
            title: "Pulp Fiction structure analysis",
            url: "https://analysis.example/pulp-fiction-structure",
            content: "Non-linear chapters, casual dialogue under pressure, and mid-scene stakes escalation.",
          },
          {
            title: "Evangelion visual economy",
            url: "https://analysis.example/eva-visual-language",
            content: "Limited animation, long still frames, negative space, monitor glow, and psychological pressure.",
          },
        ],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await tool.execute({
    query: "Quentin dialogue and Evangelion composition method",
    purpose: "style_research",
    maxResults: 3,
  }, {
    taskEnvelope: {
      id: "task_tavily_project_knowledge",
      purpose: "research",
      providerSlot: "agent.web_search",
    },
    sandboxRoot: root,
    sessionId: "tavily-project-knowledge",
  });

  assert(result.provider === "tavily_search", "tavily provider should be preserved");
  assert(result.networkCalled === true, "tavily provider should report networkCalled");
  assert(result.resultCount === 2, "tavily response should parse results");
  assert(requestedAuthorization === "Bearer tvly-test-secret", "tavily request should use bearer auth");
  assert(requestedBody.includes('"search_depth":"basic"'), "tavily request should use basic search depth");
  assert(existsSync(join(root, result.evidencePath)), "tavily search should write evidence");
  const evidence = readFileSync(join(root, result.evidencePath), "utf8");
  assert(!evidence.includes("tvly-test-secret"), "tavily evidence must not leak API keys");

  const pack = buildProjectLocalKnowledgePackFromWebSearch({
    result: result as unknown as AgentWebSearchResult,
    userIntent: "我想要昆汀对白结构和 EVA 原版动画压迫构图的原创致敬方法",
    projectId: "project-tavily-test",
    projectTitle: "Tavily Test",
    createdAt: "2026-05-19T10:00:00.000Z",
  });
  assert(pack.type === "project_local", "research result should become a project-local pack");
  assert(pack.trustLevel === "verified" && pack.verificationStatus === "verified", "confirmed research pack should be verified");
  assert(pack.snippets.some((snippet) => snippet.content.includes("不要复制任何现成角色")), "pack must carry homage boundary");

  const manifest = buildProjectLocalKnowledgeManifest("project-tavily-test", [pack], "2026-05-19T10:00:00.000Z");
  const route = routeKnowledge({
    userIntent: "拆分镜时参考昆汀对白压力和 EVA 静帧构图",
    taskPurpose: "script",
    contextLevel: "L1",
    availablePacks: manifest.packs,
    consumers: ["agent_context", "prompt_compiler", "qa_gate"],
  });
  const injectedPackIds = route.injectedKnowledgePacks?.map((item) => item.packId) || [];
  assert(injectedPackIds.includes(pack.id), "project-local research pack should inject into matching script work");
  assert((route.injectedKnowledgeSnippetIds || []).some((id) => id.includes("creative-method")), "project-local method snippet should be injected");

  const routeJson = JSON.stringify(route);
  assert(!/api[_-]?key|tvly-test-secret/i.test(routeJson), "injected knowledge route must not contain credentials");

  const project = createProjectVibe({
    projectId: "project-tavily-test",
    title: "Tavily Test",
    createdAt: "2026-05-19T10:00:00.000Z",
    updatedAt: "2026-05-19T10:00:00.000Z",
  });
  const beforeHash = hashProjectVibeFacts(project);
  const staged = buildProjectLocalKnowledgeReferenceStagedTransaction({
    project,
    pack,
    result: result as unknown as AgentWebSearchResult,
    userIntent: "我想要昆汀对白结构和 EVA 原版动画压迫构图的原创致敬方法",
    generatedAt: "2026-05-19T10:00:00.000Z",
  });
  assert(staged.kind === "project_local_knowledge_reference_staged_transaction_preview", "research reference should stage a Project.vibe transaction");
  assert(staged.projectVibeWriteAllowed === false, "research staging must not write Project.vibe immediately");
  assert(staged.projectFactsMutated === false, "research staging preview must not mutate facts");
  assert(staged.blocked === false, `research reference should be committable: ${staged.blockedReasons.join("; ")}`);
  assert(hashProjectVibeFacts(project) === beforeHash, "staging research reference must not mutate the source Project.vibe");
  assert(staged.transaction.operations.some((operation) => operation.op === "upsert_asset"), "research reference transaction should stage a project asset");
  assert(staged.transaction.operations.some((operation) => operation.op === "append_run_receipt"), "research reference transaction should stage a run receipt");

  const committed = commitProjectLocalKnowledgeReferenceStagedTransaction({ project, stagedTransaction: staged });
  assert(committed.status === "applied", `research reference transaction should apply: ${committed.blockedReasons.join("; ")}`);
  assert(hashProjectVibeFacts(committed.project) !== beforeHash, "committed research reference should change Project.vibe facts");
  const savedAsset = committed.project.assets.find((asset) => asset.id === staged.assetId);
  assert(savedAsset?.kind === "style", "confirmed research reference should become a style reference asset");
  assert(savedAsset?.status === "locked" && savedAsset.lockedBy === "user", "confirmed research reference should be user-locked");
  assert(savedAsset.textConstraints.some((line) => line.includes("致敬边界")), "saved reference should carry homage boundary");
  assert(!JSON.stringify(savedAsset).includes("Non-linear chapters"), "Project.vibe fact must not store raw web snippets");
  assert(committed.project.runs.some((run) => run.id === staged.runReceiptId && run.projectFactsMutated === true), "committed project should record a mutating research run receipt");
  assert(validateProjectVibe(committed.project).ok, "Project.vibe with research reference should validate");

  console.log(`tavily-project-knowledge-test: ok provider=${result.provider} pack=${pack.id}`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
