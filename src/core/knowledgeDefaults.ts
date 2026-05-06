import type {
  KnowledgeInjectedSnippet,
  KnowledgeInjectionRecord,
  KnowledgePack,
  KnowledgePackCategory,
  KnowledgePackConsumer,
  KnowledgeRouteMatch,
  KnowledgeRouteResult,
  KnowledgeTaskPurpose,
} from "./knowledgeTypes";
import type { ContextLevel, ProviderSlot } from "./types";
import { estimateKnowledgeTokens, stableKnowledgeHash } from "./knowledgeManifest";

export const audioKnowledgePackId = "audio/core-audio-planning";

export const minimumDefaultKnowledgePackIds = [
  "script/core-script-writing",
  "script/script-to-storyflow",
  "story-function/core-shot-functions",
  "style/core-style-packs",
  "composition/core-composition",
  "camera/core-camera-movement",
  "prompt/core-prompt-templates",
  "provider/model-capability-matrix",
  "qa/core-qa",
  audioKnowledgePackId,
] as const;

export type MinimumDefaultKnowledgePackId = (typeof minimumDefaultKnowledgePackIds)[number];

export interface KnowledgeFallbackInput {
  taskId?: string;
  userIntent: string;
  taskPurpose: KnowledgeTaskPurpose;
  providerSlot?: ProviderSlot;
  contextLevel: ContextLevel;
  availablePacks: KnowledgePack[];
  reason: string;
  createdAt?: string;
}

export interface KnowledgeTraceLike {
  injectedKnowledgePacks?: KnowledgeInjectionRecord[];
  injectedKnowledgeSnippetIds?: string[];
  injectedKnowledgeSnippets?: KnowledgeInjectedSnippet[];
}

const defaultPackMetadata: Record<MinimumDefaultKnowledgePackId, {
  category: KnowledgePackCategory;
  title: string;
  summary: string;
  tags: string[];
  taskPurposes: KnowledgeTaskPurpose[];
  providerSlots: ProviderSlot[];
}> = {
  "script/core-script-writing": {
    category: "script",
    title: "Minimum Script Writing Fallback",
    summary: "Fallback script rules for story goal, obstacle, beat, scene, and concise short-film structure.",
    tags: ["script", "story", "scene", "beat", "脚本", "故事"],
    taskPurposes: ["script", "story_audit"],
    providerSlots: [],
  },
  "script/script-to-storyflow": {
    category: "storyflow",
    title: "Minimum Script To Story Flow Fallback",
    summary: "Fallback storyflow rules for converting script intent into shots, shot functions, and shot readiness checks.",
    tags: ["storyflow", "shot", "分镜", "镜头"],
    taskPurposes: ["script", "story_audit"],
    providerSlots: [],
  },
  "story-function/core-shot-functions": {
    category: "story_function",
    title: "Minimum Shot Function Fallback",
    summary: "Fallback shot-function vocabulary for establish, reveal, react, transition, payoff, and continuity anchors.",
    tags: ["story", "function", "shot", "continuity", "功能"],
    taskPurposes: ["script", "keyframe", "qa", "audit", "story_audit", "continuity_audit"],
    providerSlots: [],
  },
  "style/core-style-packs": {
    category: "style",
    title: "Minimum Style Fallback",
    summary: "Fallback style guard for restrained realism, mood continuity, visual tone, and avoiding ad-hoc style drift.",
    tags: ["style", "mood", "realism", "风格", "压抑", "冷", "暖"],
    taskPurposes: ["asset", "keyframe", "edit", "qa", "visual_generation", "visual_audit"],
    providerSlots: ["image.generate", "image.edit", "image.reference_asset"],
  },
  "composition/core-composition": {
    category: "composition",
    title: "Minimum Composition Fallback",
    summary: "Fallback composition rules for subject placement, negative space, scale, foreground, and frame continuity.",
    tags: ["composition", "frame", "space", "构图", "空间"],
    taskPurposes: ["asset", "keyframe", "edit", "qa", "visual_generation", "visual_audit", "continuity_audit"],
    providerSlots: ["image.generate", "image.edit"],
  },
  "camera/core-camera-movement": {
    category: "camera",
    title: "Minimum Camera Fallback",
    summary: "Fallback camera movement rules for locked shots, push-in, pull-back, tracking, handheld, and no unsafe t2v fallback.",
    tags: ["camera", "movement", "video", "镜头", "运镜"],
    taskPurposes: ["i2v", "video", "video_generation", "video_audit"],
    providerSlots: ["video.i2v", "video.t2v.experimental"],
  },
  "prompt/core-prompt-templates": {
    category: "prompt",
    title: "Minimum Prompt Fallback",
    summary: "Fallback prompt compiler template for structured visual prompt fields, references, expected output, and hard negatives.",
    tags: ["prompt", "template", "compiler", "提示词", "生成"],
    taskPurposes: ["asset", "keyframe", "edit", "i2v", "video", "visual_generation", "video_generation"],
    providerSlots: ["image.generate", "image.edit", "image.reference_asset", "video.i2v", "video.t2v.experimental"],
  },
  "provider/model-capability-matrix": {
    category: "provider",
    title: "Minimum Provider Fallback",
    summary: "Fallback provider capability guard for slot, mode, execution state, no silent fallback, and no live submit.",
    tags: ["provider", "model", "slot", "image2", "seedance", "tts", "music", "模型"],
    taskPurposes: ["asset", "keyframe", "edit", "i2v", "video", "audio", "audit", "qa", "export", "visual_generation", "video_generation"],
    providerSlots: [
      "image.generate",
      "image.edit",
      "image.reference_asset",
      "video.i2v",
      "video.t2v.experimental",
      "audio.tts",
      "audio.music",
      "local.workflow",
    ],
  },
  "qa/core-qa": {
    category: "qa",
    title: "Minimum QA Fallback",
    summary: "Fallback QA checklist for identity, scene, pair, story, prop, style, continuity, and provider-slot blockers.",
    tags: ["qa", "gate", "audit", "check", "验收", "连续性"],
    taskPurposes: [
      "asset",
      "keyframe",
      "edit",
      "i2v",
      "video",
      "audio",
      "qa",
      "audit",
      "visual_generation",
      "visual_audit",
      "video_generation",
      "video_audit",
      "continuity_audit",
      "regeneration_plan",
      "story_audit",
    ],
    providerSlots: ["image.generate", "image.edit", "image.reference_asset", "video.i2v", "audio.tts", "audio.music"],
  },
  "audio/core-audio-planning": {
    category: "audio",
    title: "Minimum Audio Planning Fallback",
    summary: "Fallback audio plan for narration, dialogue, voice authorization, ambience, BGM brief, video no BGM, and audio provider slots.",
    tags: ["audio", "tts", "music", "voice", "sound", "narration", "dialogue", "bgm", "no_bgm", "旁白", "对白", "环境音", "配乐"],
    taskPurposes: ["audio", "video", "video_generation"],
    providerSlots: ["audio.tts", "audio.music", "video.i2v", "video.t2v.experimental"],
  },
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function makeSyntheticDefaultPack(packId: MinimumDefaultKnowledgePackId): KnowledgePack {
  const metadata = defaultPackMetadata[packId];
  const content = `${metadata.summary} This synthetic minimum fallback exists only when the project manifest cannot provide ${packId}.`;
  const hash = stableKnowledgeHash(`${packId}\n${content}`);

  return {
    id: packId,
    version: "minimum-fallback/1.0.0",
    hash,
    path: `resources/knowledge/${packId}.md`,
    type: "system_builtin",
    category: metadata.category,
    title: metadata.title,
    summary: metadata.summary,
    tags: unique(metadata.tags),
    applicableTaskPurposes: metadata.taskPurposes,
    applicableProviderSlots: metadata.providerSlots,
    dependencies: [],
    conflicts: [],
    maxInjectionTokens: metadata.category === "audio" ? 520 : 420,
    trustLevel: "trusted",
    verificationStatus: "not_required",
    conflictAcknowledged: false,
    enabled: true,
    defaultEnabled: true,
    createdAt: "2026-05-05T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z",
    sourcePath: `${packId}.md`,
    snippets: [
      {
        id: "minimum-fallback",
        title: metadata.title,
        summary: metadata.summary,
        content,
        keywords: unique(metadata.tags),
        hash: stableKnowledgeHash(`${packId}:minimum-fallback:${content}`),
        tokenEstimate: estimateKnowledgeTokens(content),
        sourceHeading: metadata.title,
      },
    ],
  };
}

export function ensureMinimumDefaultKnowledgePacks(availablePacks: KnowledgePack[]): KnowledgePack[] {
  const packById = new Map(availablePacks.map((pack) => [pack.id, pack]));
  const missingDefaults = minimumDefaultKnowledgePackIds
    .filter((packId) => !packById.has(packId))
    .map(makeSyntheticDefaultPack);

  return [...availablePacks, ...missingDefaults];
}

function fallbackIdsForPurpose(taskPurpose: KnowledgeTaskPurpose): MinimumDefaultKnowledgePackId[] {
  if (taskPurpose === "script" || taskPurpose === "story_audit") {
    return ["script/core-script-writing", "script/script-to-storyflow", "story-function/core-shot-functions", "qa/core-qa"];
  }

  if (taskPurpose === "audio") {
    return [audioKnowledgePackId, "provider/model-capability-matrix", "qa/core-qa"];
  }

  if (taskPurpose === "video" || taskPurpose === "i2v" || taskPurpose === "video_generation" || taskPurpose === "video_audit") {
    return ["camera/core-camera-movement", "prompt/core-prompt-templates", "provider/model-capability-matrix", "qa/core-qa", audioKnowledgePackId];
  }

  if (taskPurpose === "qa" || taskPurpose === "audit" || taskPurpose === "continuity_audit") {
    return ["qa/core-qa", "story-function/core-shot-functions", "composition/core-composition", "provider/model-capability-matrix"];
  }

  if (taskPurpose === "asset" || taskPurpose === "keyframe" || taskPurpose === "edit" || taskPurpose === "visual_generation" || taskPurpose === "visual_audit") {
    return ["prompt/core-prompt-templates", "style/core-style-packs", "composition/core-composition", "provider/model-capability-matrix", "qa/core-qa"];
  }

  return ["prompt/core-prompt-templates", "provider/model-capability-matrix", "qa/core-qa"];
}

function fallbackIdsForProvider(providerSlot?: ProviderSlot): MinimumDefaultKnowledgePackId[] {
  if (!providerSlot) return [];
  if (providerSlot === "audio.tts" || providerSlot === "audio.music") return [audioKnowledgePackId, "provider/model-capability-matrix", "qa/core-qa"];
  if (providerSlot.startsWith("video.")) return ["camera/core-camera-movement", "prompt/core-prompt-templates", "provider/model-capability-matrix", "qa/core-qa", audioKnowledgePackId];
  if (providerSlot.startsWith("image.")) return ["prompt/core-prompt-templates", "style/core-style-packs", "composition/core-composition", "provider/model-capability-matrix", "qa/core-qa"];
  return ["provider/model-capability-matrix", "qa/core-qa"];
}

function audioIntentDetected(userIntent: string): boolean {
  return /audio|tts|voice|sound|music|bgm|no[-_\s]?bgm|narration|dialogue|ambience|旁白|对白|台词|环境音|音效|配乐|音乐|不要音乐|无配乐/i.test(userIntent);
}

export function fallbackKnowledgePackIdsForTask(input: {
  taskPurpose: KnowledgeTaskPurpose;
  providerSlot?: ProviderSlot;
  userIntent: string;
}): MinimumDefaultKnowledgePackId[] {
  return unique([
    ...fallbackIdsForPurpose(input.taskPurpose),
    ...fallbackIdsForProvider(input.providerSlot),
    audioIntentDetected(input.userIntent) ? audioKnowledgePackId : "",
  ]) as MinimumDefaultKnowledgePackId[];
}

function consumerForCategory(category: KnowledgePackCategory): KnowledgePackConsumer {
  if (category === "qa") return "qa_gate";
  if (category === "provider") return "diagnostics";
  if (category === "audio" || category === "storyflow" || category === "story_function") return "subagent_context";
  return "prompt_compiler";
}

export function buildFallbackKnowledgeRouteResult(input: KnowledgeFallbackInput): KnowledgeRouteResult {
  const fallbackIds = fallbackKnowledgePackIdsForTask(input);
  const packById = new Map(input.availablePacks.map((pack) => [pack.id, pack]));
  const selectedPacks = fallbackIds
    .map((packId) => packById.get(packId))
    .filter((pack): pack is KnowledgePack => Boolean(pack && pack.enabled));
  const inputHash = stableKnowledgeHash(
    JSON.stringify({
      fallback: true,
      reason: input.reason,
      userIntent: input.userIntent,
      taskPurpose: input.taskPurpose,
      providerSlot: input.providerSlot,
      contextLevel: input.contextLevel,
      packIds: selectedPacks.map((pack) => `${pack.id}@${pack.version}:${pack.hash}`),
    }),
  );
  const matches: KnowledgeRouteMatch[] = selectedPacks.map((pack, index) => ({
    packId: pack.id,
    version: pack.version,
    hash: pack.hash,
    category: pack.category,
    reason: `minimum_default_fallback:${input.reason}`,
    consumer: consumerForCategory(pack.category),
    score: 100 - index,
    matchedTerms: ["minimum_default_fallback"],
    matchedSnippetIds: pack.snippets.slice(0, 1).map((snippet) => snippet.id),
  }));

  return {
    routeId: `kr_${inputHash.slice(4, 12)}`,
    taskId: input.taskId,
    taskPurpose: input.taskPurpose,
    providerSlot: input.providerSlot,
    contextLevel: input.contextLevel,
    inputHash,
    matches,
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    notInjected: input.availablePacks
      .filter((pack) => !pack.enabled)
      .map((pack) => ({ packId: pack.id, reason: "pack_disabled" })),
    warnings: [
      `knowledge_route_fallback:${input.reason}`,
      selectedPacks.length ? "" : "knowledge_route_fallback_empty",
    ].filter(Boolean),
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function hasNonEmptyKnowledgeTrace(trace: KnowledgeTraceLike): boolean {
  return Boolean(
    trace.injectedKnowledgePacks?.length &&
      trace.injectedKnowledgeSnippetIds?.length &&
      trace.injectedKnowledgeSnippets?.length,
  );
}
