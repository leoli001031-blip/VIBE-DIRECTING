import type {
  KnowledgePack,
  KnowledgePackCategory,
  KnowledgePackConsumer,
  KnowledgeRouteMatch,
  KnowledgeRouteResult,
  KnowledgeTaskPurpose,
} from "./knowledgeTypes";
import type { ContextLevel, ProviderSlot } from "./types";
import { stableKnowledgeHash } from "./knowledgeManifest";
import { attachKnowledgeBudgetToRouteResult, buildKnowledgeContextBudget } from "./knowledgeContextBudget";

export interface KnowledgeRouterInput {
  taskId?: string;
  userIntent: string;
  taskPurpose: KnowledgeTaskPurpose;
  providerSlot?: ProviderSlot;
  contextLevel?: ContextLevel;
  availablePacks: KnowledgePack[];
  consumers?: KnowledgePackConsumer[];
  maxInjectionTokens?: number;
}

const categoryKeywords: Record<KnowledgePackCategory, string[]> = {
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

const purposeCategories: Record<string, KnowledgePackCategory[]> = {
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

const providerCategories: Partial<Record<ProviderSlot, KnowledgePackCategory[]>> = {
  "image.generate": ["prompt", "provider", "style", "composition", "lighting", "color", "qa"],
  "image.edit": ["prompt", "provider", "composition", "lighting", "color", "qa"],
  "image.reference_asset": ["prompt", "provider", "style", "qa"],
  "video.i2v": ["camera", "prompt", "provider", "qa"],
  "video.t2v.experimental": ["camera", "prompt", "provider", "qa"],
  "audio.tts": ["audio", "provider", "qa"],
  "audio.music": ["audio", "provider", "qa"],
};

function tokenize(value: string): string[] {
  return Array.from(new Set(value.toLowerCase().split(/[^\p{L}\p{N}.]+/u).filter(Boolean)));
}

function defaultConsumers(taskPurpose: KnowledgeTaskPurpose): KnowledgePackConsumer[] {
  if (String(taskPurpose).includes("audit") || taskPurpose === "qa") return ["subagent_context", "qa_gate"];
  if (taskPurpose === "script") return ["agent_context", "prompt_compiler"];
  return ["prompt_compiler", "subagent_context"];
}

function chooseConsumer(category: KnowledgePackCategory, consumers: KnowledgePackConsumer[]): KnowledgePackConsumer {
  if (category === "qa" && consumers.includes("qa_gate")) return "qa_gate";
  if (category === "provider" && consumers.includes("diagnostics")) return "diagnostics";
  if (consumers.includes("prompt_compiler") && ["prompt", "style", "composition", "camera", "lighting", "color", "lens_focus"].includes(category)) {
    return "prompt_compiler";
  }
  return consumers[0] || "agent_context";
}

function scorePack(pack: KnowledgePack, input: KnowledgeRouterInput, intentTokens: string[]) {
  let score = 0;
  const matchedTerms = new Set<string>();
  const reasons = new Set<string>();
  const purposeMatches = pack.applicableTaskPurposes.includes(input.taskPurpose);
  const providerMatches = input.providerSlot ? pack.applicableProviderSlots.includes(input.providerSlot) : false;
  const preferredByPurpose = purposeCategories[input.taskPurpose]?.includes(pack.category) || false;
  const preferredByProvider = input.providerSlot ? providerCategories[input.providerSlot]?.includes(pack.category) || false : false;
  const keywords = [...categoryKeywords[pack.category], ...pack.tags, pack.title, pack.summary].map((item) => item.toLowerCase());

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

  const matchedSnippetIds = pack.snippets
    .filter((snippet) =>
      snippet.keywords.some((keyword) => intentTokens.some((token) => keyword.toLowerCase().includes(token) || token.includes(keyword.toLowerCase()))),
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

export function routeKnowledge(input: KnowledgeRouterInput): KnowledgeRouteResult {
  const contextLevel = input.contextLevel || "L1";
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
  const matches: KnowledgeRouteMatch[] = input.availablePacks
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

  const routeResult: KnowledgeRouteResult = {
    routeId: `kr_${inputHash.slice(4, 12)}`,
    taskId: input.taskId,
    taskPurpose: input.taskPurpose,
    providerSlot: input.providerSlot,
    contextLevel,
    inputHash,
    matches,
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    notInjected: input.availablePacks
      .filter((pack) => !pack.enabled)
      .map((pack) => ({ packId: pack.id, reason: "pack_disabled" })),
    warnings: matches.length ? [] : ["no_knowledge_pack_matched"],
    createdAt: new Date().toISOString(),
  };

  const contextBudget = buildKnowledgeContextBudget({
    routeResult,
    availablePacks: input.availablePacks,
    maxInjectionTokens: input.maxInjectionTokens,
  });

  return attachKnowledgeBudgetToRouteResult(routeResult, contextBudget);
}
