import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(projectRoot, "resources/knowledge_pack_manifest.json");
const testCasesPath = path.join(projectRoot, "resources/knowledge/router_test_cases.json");
const defaultContextLevel = "L1";
const defaultMaxInjectionTokens = 1200;

const categoryKeywords = {
  script: ["script", "story", "dialogue", "beat", "scene", "故事", "脚本", "剧本", "对白", "场景", "整理"],
  storyflow: ["storyflow", "story flow", "shot spec", "分镜", "故事流", "镜头表", "拆解"],
  story_function: ["establish", "reveal", "react", "payoff", "function", "功能", "转折", "揭示", "反应"],
  style: ["style", "realism", "noir", "dream", "documentary", "高级", "风格", "压抑", "克制", "孤独", "暖", "冷", "复古", "科幻"],
  composition: ["composition", "frame", "negative space", "symmetry", "scale", "构图", "负空间", "对称", "框", "尺度", "空镜"],
  camera: ["camera", "movement", "dolly", "pan", "tilt", "tracking", "handheld", "镜头", "运镜", "推", "拉", "横摇", "跟拍", "手持"],
  lighting: ["lighting", "light", "low key", "backlight", "practical", "光", "灯", "低调光", "逆光", "柔光", "硬光"],
  color: ["color", "saturation", "palette", "warm", "cool", "颜色", "色彩", "低饱和", "冷暖", "调色"],
  lens_focus: ["lens", "focus", "dof", "wide angle", "telephoto", "焦点", "镜头", "广角", "长焦", "景深", "虚化"],
  performance: ["performance", "gesture", "eye", "posture", "表演", "微表情", "视线", "姿态", "停顿", "犹豫"],
  prompt: ["prompt", "template", "compiler", "提示词", "模板", "编译", "生成"],
  provider: ["provider", "model", "image2", "seedance", "codex", "runway", "comfyui", "模型", "供应商", "即梦"],
  qa: ["qa", "audit", "check", "gate", "检查", "验收", "污染", "连续性", "失败", "审计"],
  audio: ["audio", "tts", "music", "voice", "sound", "音频", "旁白", "对白", "音乐", "音效", "bgm"],
  agent: ["agent", "subagent", "harness", "codex", "执行", "边界", "队列", "子代理"],
};

const purposeCategories = {
  script: ["script", "storyflow", "story_function", "qa"],
  asset: ["style", "composition", "lighting", "color", "prompt", "provider", "qa"],
  keyframe: ["prompt", "style", "composition", "lighting", "color", "lens_focus", "performance", "provider", "qa"],
  edit: ["prompt", "composition", "lighting", "color", "provider", "qa"],
  i2v: ["camera", "prompt", "provider", "qa"],
  video: ["camera", "prompt", "provider", "qa", "audio"],
  audio: ["audio", "provider", "qa"],
  qa: ["qa", "style", "composition", "camera", "lighting", "color", "provider"],
  audit: ["qa", "story_function", "composition", "provider"],
  visual_generation: ["prompt", "style", "composition", "lighting", "color", "provider", "qa"],
  visual_audit: ["qa", "style", "composition", "lighting", "color"],
  video_generation: ["camera", "prompt", "provider", "qa"],
  video_audit: ["qa", "camera", "story_function"],
  continuity_audit: ["qa", "story_function", "composition"],
  regeneration_plan: ["qa", "prompt", "provider"],
  story_audit: ["script", "storyflow", "story_function", "qa"],
};

const providerCategories = {
  "image.generate": ["prompt", "provider", "style", "composition", "lighting", "color", "qa"],
  "image.edit": ["prompt", "provider", "composition", "lighting", "color", "qa"],
  "image.reference_asset": ["prompt", "provider", "style", "qa"],
  "video.i2v": ["camera", "prompt", "provider", "qa"],
  "video.t2v.experimental": ["camera", "prompt", "provider", "qa"],
  "audio.tts": ["audio", "provider", "qa"],
  "audio.music": ["audio", "provider", "qa"],
};

const dangerousResultPatterns = [
  /\blive[-_\s]?submit\b/i,
  /\bsubmit[-_\s]?live\b/i,
  /\bprovider[-_\s]?unlock\b/i,
  /\bunlock[-_\s]?provider\b/i,
  /\b(envelope|provider|policy|preflight|qa)[-_\s]?bypass\b/i,
  /\bbypass[-_\s]?(envelope|provider|policy|preflight|qa)\b/i,
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function stableKnowledgeHash(value) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `vck_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function estimateKnowledgeTokens(value) {
  return Math.max(1, Math.ceil(String(value || "").length / 4));
}

function tokenize(value) {
  return Array.from(new Set(String(value || "").toLowerCase().split(/[^\p{L}\p{N}.]+/u).filter(Boolean)));
}

function defaultConsumers(taskPurpose) {
  if (String(taskPurpose).includes("audit") || taskPurpose === "qa") return ["subagent_context", "qa_gate"];
  if (taskPurpose === "script") return ["agent_context", "prompt_compiler"];
  return ["prompt_compiler", "subagent_context"];
}

function chooseConsumer(category, consumers) {
  if (category === "qa" && consumers.includes("qa_gate")) return "qa_gate";
  if (category === "provider" && consumers.includes("diagnostics")) return "diagnostics";
  if (consumers.includes("prompt_compiler") && ["prompt", "style", "composition", "camera", "lighting", "color", "lens_focus"].includes(category)) {
    return "prompt_compiler";
  }
  return consumers[0] || "agent_context";
}

function scorePack(pack, input, intentTokens) {
  let score = 0;
  const matchedTerms = new Set();
  const reasons = new Set();
  const purposeMatches = (pack.applicableTaskPurposes || []).includes(input.taskPurpose);
  const providerMatches = input.providerSlot ? (pack.applicableProviderSlots || []).includes(input.providerSlot) : false;
  const preferredByPurpose = purposeCategories[input.taskPurpose]?.includes(pack.category) || false;
  const preferredByProvider = input.providerSlot ? providerCategories[input.providerSlot]?.includes(pack.category) || false : false;
  const keywords = [...(categoryKeywords[pack.category] || []), ...(pack.tags || []), pack.title, pack.summary].map((item) => String(item || "").toLowerCase());

  if (purposeMatches || preferredByPurpose) {
    score += purposeMatches ? 35 : 20;
    reasons.add("task_purpose");
  }

  if (providerMatches || preferredByProvider) {
    score += providerMatches ? 30 : 16;
    reasons.add("provider_slot");
  }

  for (const token of intentTokens) {
    if (keywords.some((keyword) => keyword.includes(token) || token.includes(keyword))) {
      score += 12;
      matchedTerms.add(token);
      reasons.add("intent_keyword");
    }
  }

  const matchedSnippetIds = (pack.snippets || [])
    .filter((snippet) =>
      (snippet.keywords || []).some((keyword) =>
        intentTokens.some((token) => String(keyword || "").toLowerCase().includes(token) || token.includes(String(keyword || "").toLowerCase())),
      ),
    )
    .map((snippet) => snippet.id);

  if (matchedSnippetIds.length) {
    score += Math.min(24, matchedSnippetIds.length * 6);
    reasons.add("snippet_keyword");
  }

  if (pack.enabled) score += 5;

  return {
    score,
    matchedTerms: Array.from(matchedTerms).sort(),
    matchedSnippetIds,
    reason: Array.from(reasons).sort().join("+") || "low_confidence",
  };
}

function routeKnowledge(input) {
  const contextLevel = input.contextLevel || defaultContextLevel;
  const intentTokens = tokenize(input.userIntent);
  const consumers = input.consumers || defaultConsumers(input.taskPurpose);
  const inputHash = stableKnowledgeHash(
    JSON.stringify({
      userIntent: input.userIntent,
      taskPurpose: input.taskPurpose,
      providerSlot: input.providerSlot,
      contextLevel,
      packIds: input.availablePacks.map((pack) => `${pack.id}@${pack.version}:${pack.hash}`).sort(),
    }),
  );

  const matches = input.availablePacks
    .filter((pack) => pack.enabled)
    .map((pack) => {
      const scored = scorePack(pack, input, intentTokens);

      return {
        packId: pack.id,
        version: pack.version,
        hash: pack.hash,
        category: pack.category,
        reason: scored.reason,
        consumer: chooseConsumer(pack.category, consumers),
        score: scored.score,
        matchedTerms: scored.matchedTerms,
        matchedSnippetIds: scored.matchedSnippetIds,
      };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.packId.localeCompare(right.packId));

  return {
    routeId: `kr_${inputHash.slice(4, 12)}`,
    taskId: input.taskId,
    taskPurpose: input.taskPurpose,
    providerSlot: input.providerSlot,
    contextLevel,
    inputHash,
    matches,
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    notInjected: input.availablePacks.filter((pack) => !pack.enabled).map((pack) => ({ packId: pack.id, reason: "pack_disabled" })),
    warnings: matches.length ? [] : ["no_knowledge_pack_matched"],
    createdAt: "2026-04-29T00:00:00.000Z",
  };
}

function snippetForSummary(pack) {
  return {
    id: "summary",
    title: `${pack.title} Summary`,
    content: pack.summary,
    keywords: pack.tags || [],
    hash: stableKnowledgeHash(pack.summary),
    tokenEstimate: estimateKnowledgeTokens(pack.summary),
  };
}

function snippetsForMatch(pack, match) {
  const byId = new Map((pack.snippets || []).map((snippet) => [snippet.id, snippet]));
  const matched = match.matchedSnippetIds.map((snippetId) => byId.get(snippetId)).filter(Boolean);

  if (matched.length) return matched;
  if (pack.snippets?.length) return pack.snippets.slice(0, 1);
  return [snippetForSummary(pack)];
}

function buildContextBudget({ routeResult, availablePacks, maxInjectionTokens = defaultMaxInjectionTokens }) {
  const packById = new Map(availablePacks.map((pack) => [pack.id, pack]));
  const injectedKnowledgePacks = [];
  const injectedSnippets = [];
  const warnings = [];
  let usedTokens = 0;

  for (const match of routeResult.matches) {
    const pack = packById.get(match.packId);
    if (!pack) {
      warnings.push(`missing_pack:${match.packId}`);
      continue;
    }

    const perPackLimit = Math.min(pack.maxInjectionTokens, maxInjectionTokens - usedTokens);
    const selectedSnippetIds = [];
    let packTokens = 0;
    let truncated = false;
    let truncationReason;

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
      if (tokenEstimate > remaining) {
        truncated = true;
        truncationReason = packTokens + tokenEstimate > perPackLimit ? "pack_max_injection_tokens_exhausted" : "global_context_budget_exhausted";
      }

      selectedSnippetIds.push(snippet.id);
      injectedSnippets.push({
        packId: pack.id,
        snippetId: snippet.id,
        title: snippet.title,
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

  return {
    budgetId: `kb_${stableKnowledgeHash(JSON.stringify({ routeId: routeResult.routeId, maxInjectionTokens })).slice(4, 12)}`,
    routeId: routeResult.routeId,
    contextLevel: routeResult.contextLevel,
    maxInjectionTokens,
    usedTokens,
    injectedKnowledgePacks,
    injectedSnippets,
    warnings,
    createdAt: "2026-04-29T00:00:00.000Z",
  };
}

function assertNoDangerousResultSemantics(result, caseId) {
  const serialized = JSON.stringify(result);
  const matched = dangerousResultPatterns.find((pattern) => pattern.test(serialized));
  assert(!matched, `${caseId} produced dangerous result semantics matching ${matched}`);
}

async function assertPathExists(relativePath, packId) {
  const absolutePath = path.join(projectRoot, relativePath);
  const stat = await fs.stat(absolutePath).catch(() => undefined);
  assert(stat?.isFile(), `${packId} path does not exist: ${relativePath}`);
}

async function validateManifest(manifest) {
  assert(manifest && typeof manifest === "object", "knowledge manifest must be a JSON object");
  assert(Array.isArray(manifest.packs), "knowledge manifest packs must be an array");

  const seenPackIds = new Set();
  for (const pack of manifest.packs) {
    assert(pack.id && typeof pack.id === "string", "pack id is required");
    assert(!seenPackIds.has(pack.id), `duplicate pack id: ${pack.id}`);
    seenPackIds.add(pack.id);

    if (!pack.enabled) continue;

    assert(pack.version && typeof pack.version === "string", `${pack.id} enabled pack version is required`);
    assert(pack.hash && typeof pack.hash === "string", `${pack.id} enabled pack hash is required`);
    assert(pack.path && typeof pack.path === "string", `${pack.id} enabled pack path is required`);
    assert(Number.isInteger(pack.maxInjectionTokens) && pack.maxInjectionTokens > 0, `${pack.id} maxInjectionTokens must be a positive integer`);
    await assertPathExists(pack.path, pack.id);

    if (pack.type === "external_imported") {
      assert(pack.verificationStatus === "verified", `${pack.id} external_imported enabled pack must have verificationStatus=verified`);
      assert(pack.trustLevel === "verified" || pack.trustLevel === "trusted", `${pack.id} external_imported enabled pack must be verified/trusted`);
      assert(pack.verificationReportId, `${pack.id} external_imported enabled pack must include verificationReportId`);
    }
  }

  return seenPackIds;
}

function validateTestCase(testCase, knownPackIds) {
  assert(testCase.id && typeof testCase.id === "string", "router test case id is required");
  assert(testCase.userIntent && typeof testCase.userIntent === "string", `${testCase.id} userIntent is required`);
  assert(testCase.taskPurpose && typeof testCase.taskPurpose === "string", `${testCase.id} taskPurpose is required`);
  assert(Array.isArray(testCase.expectedPackIds), `${testCase.id} expectedPackIds must be an array`);
  assert(Array.isArray(testCase.forbiddenPackIds), `${testCase.id} forbiddenPackIds must be an array`);

  for (const packId of [...testCase.expectedPackIds, ...testCase.forbiddenPackIds]) {
    assert(knownPackIds.has(packId), `${testCase.id} references unknown pack id: ${packId}`);
  }
}

function assertBudgetWithinLimits(budget, packsById, caseId) {
  assert(budget.usedTokens <= budget.maxInjectionTokens, `${caseId} used ${budget.usedTokens} tokens over total budget ${budget.maxInjectionTokens}`);

  const tokensByPack = new Map();
  for (const snippet of budget.injectedSnippets) {
    tokensByPack.set(snippet.packId, (tokensByPack.get(snippet.packId) || 0) + snippet.tokenEstimate);
  }

  for (const [packId, usedTokens] of tokensByPack) {
    const pack = packsById.get(packId);
    assert(pack, `${caseId} budget includes missing pack: ${packId}`);
    assert(usedTokens <= pack.maxInjectionTokens, `${caseId} ${packId} used ${usedTokens} tokens over pack budget ${pack.maxInjectionTokens}`);
  }
}

async function main() {
  await Promise.all([fs.access(manifestPath), fs.access(testCasesPath)]);

  const [manifest, testCases] = await Promise.all([readJson(manifestPath), readJson(testCasesPath)]);
  const knownPackIds = await validateManifest(manifest);
  assert(Array.isArray(testCases), "router test cases must be an array");

  const packsById = new Map(manifest.packs.map((pack) => [pack.id, pack]));
  const failures = [];

  for (const testCase of testCases) {
    try {
      validateTestCase(testCase, knownPackIds);

      const routeResult = routeKnowledge({
        taskId: testCase.id,
        userIntent: testCase.userIntent,
        taskPurpose: testCase.taskPurpose,
        providerSlot: testCase.providerSlot,
        contextLevel: defaultContextLevel,
        availablePacks: manifest.packs,
      });
      const hitPackIds = new Set(routeResult.matches.map((match) => match.packId));

      for (const packId of testCase.expectedPackIds) {
        assert(hitPackIds.has(packId), `${testCase.id} expected ${packId} to be routed`);
      }

      for (const packId of testCase.forbiddenPackIds) {
        assert(!hitPackIds.has(packId), `${testCase.id} forbidden ${packId} was routed`);
      }

      const budget = buildContextBudget({
        routeResult,
        availablePacks: manifest.packs,
        maxInjectionTokens: defaultMaxInjectionTokens,
      });
      assertBudgetWithinLimits(budget, packsById, testCase.id);
      assertNoDangerousResultSemantics(
        {
          routeResult,
          budget: {
            ...budget,
            injectedSnippets: budget.injectedSnippets.map(({ content: _content, ...snippet }) => snippet),
          },
        },
        testCase.id,
      );
    } catch (error) {
      failures.push(error.message);
    }
  }

  if (failures.length) {
    console.error(`Knowledge router test failed with ${failures.length} issue(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }

  const enabledPackCount = manifest.packs.filter((pack) => pack.enabled).length;
  console.log(`Knowledge router test passed: ${enabledPackCount} enabled packs, ${testCases.length} route cases, ${defaultMaxInjectionTokens} token budget.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
