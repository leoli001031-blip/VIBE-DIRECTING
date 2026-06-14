// This component has many useState hooks; consider extracting a useReducer or custom hook in a future refactor
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, CheckCircle2, ExternalLink, FileAudio2, FolderPlus, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import {
  buildIntakeStagedPlanProjection,
  buildProjectIntakeDraft,
  type IntakeReferenceAssetType,
  type IntakeStagedPlanProjection,
} from "../../core/projectIntakeDraft";
import {
  buildDirectorSessionFromIntake,
  extractTimecodedStoryboardBeats,
  splitScriptIntoStoryboardBeats,
  type DirectorStagedFactKind,
} from "../../core/directorSession";
import {
  buildStoryDiscussionWorkspace,
  confirmStoryDiscussionDeltas,
  stageStoryDiscussionTurn,
  type StoryDiscussionDelta,
  type StoryDiscussionLaneStatus,
  type StoryDiscussionWorkspace,
} from "../../core/storyDiscussionWorkspace";
import {
  DIRECTOR_RHYTHM_PROFILE_LABELS,
  planDirectorRhythm,
  type DirectorRhythmProfile,
} from "../../core/directorRhythmPlanner";
import {
  buildScriptMusicRhythmPlan,
  type ScriptMusicRhythmSegment,
} from "../../core/scriptMusicRhythmPlanner";
import {
  requestDirectorAiStoryboardPlan,
} from "../../core/directorAiStoryboardClient";
import {
  agentVideoSubmitContractDetail,
  agentVideoSubmitContractForMode,
  defaultAgentVideoSubmitContract,
  type AgentVideoSubmitContract,
  type AgentVideoSubmitMode,
} from "./agentPanelProjection";
import {
  extractRequestedShotCount,
  splitCreativePlanningText,
  type DirectorAiStoryboardPlan,
  type DirectorAiStoryboardSeedRow,
  type DirectorAiStoryboardShot,
} from "../../core/directorAiStoryboardPlanner";
import type { MusicRhythmAnalysis } from "../../core/musicRhythmAnalysis";
import { ensureMinimumDefaultKnowledgePacks } from "../../core/knowledgeDefaults";
import type { KnowledgePack } from "../../core/knowledgeTypes";
import {
  buildStyleResearchPreflight,
  formatStyleResearchPreflightForPrompt,
  type StyleResearchPreflight,
} from "../../core/styleResearchPreflight";
import {
  referenceAssetCandidates,
} from "../../core/referenceAssetStrategy";
import {
  buildAgentWebResearchSuggestion,
  defaultAgentWebSearchSettings,
  runAgentWebSearch,
  type AgentWebSearchResult,
  type AgentWebSearchSettings,
} from "../../core/agentWebSearchClient";
import { classifyDirectorAgentAction } from "../../core/directorAgentAction";
import type { ShotRecord } from "../../core/types";

type IntakeVisualReferenceKind = Extract<IntakeReferenceAssetType, "image" | "style" | "character" | "scene">;

export type NewVideoReferenceKind = IntakeVisualReferenceKind | "prop";
export type NewVideoReferenceBindingPurpose = "character" | "scene" | "prop" | "style";
export type NewVideoReferenceBindingScope = "whole_video" | "shot_range";
export type NewVideoStoryboardExecutionMode =
  | "single_continuous_shot"
  | "relationship_wide"
  | "action_insert"
  | "reaction_closeup"
  | "planned_cut_sequence";
export type NewVideoReferenceStrategy =
  | "storyboard_narrative"
  | "storyboard_rapid_cut"
  | "omni_reference";

export type NewVideoReferenceBinding = {
  purpose: NewVideoReferenceBindingPurpose;
  scope: NewVideoReferenceBindingScope;
  shotRange: string;
  note: string;
};

export type NewVideoReferenceFile = {
  id: string;
  type: NewVideoReferenceKind;
  file: File;
  binding: NewVideoReferenceBinding;
};

export type NewVideoStartDraft = {
  script: string;
  style: string;
  references: NewVideoReferenceFile[];
  audio?: File;
  audioRole?: "voice_reference" | "music_reference";
  musicAnalysis?: MusicRhythmAnalysis;
  agentBoundaryMode?: AgentVideoSubmitMode;
};

export type NewVideoStoryboardShot = {
  id: string;
  shotNo: string;
  duration: string;
  shotSize: string;
  camera: string;
  visualDescription: string;
  primaryAction: string;
  actionTrigger: string;
  microReaction: string;
  actionReactionQa: string;
  executionMode: NewVideoStoryboardExecutionMode;
  referenceStrategy: NewVideoReferenceStrategy;
  visibleCutBudget: string;
  visibleClips: number;
  storyboardPanels: number;
  actionBeats: string[];
  subtitle: string;
  sound: string;
  title: string;
  characters: string;
  scene: string;
  props: string;
  audioUsage: string;
  rhythmProfile: DirectorRhythmProfile;
  rhythmReason: string;
  sourceFactId?: string;
};

export type NewVideoStartConfirmationContext = {
  projection: IntakeStagedPlanProjection;
  directorSession: ReturnType<typeof buildDirectorSessionFromIntake>;
  styleResearchPreflight?: StyleResearchPreflight;
  discussionWorkspace?: StoryDiscussionWorkspace;
  storyboardDraft?: NewVideoStoryboardShot[];
};

const referenceTypeLabels: Record<NewVideoReferenceKind, string> = {
  character: "主角参考",
  style: "风格参考",
  scene: "场景/天气参考",
  prop: "道具参考",
  image: "参考图",
};

const referenceBindingPurposeLabels: Record<NewVideoReferenceBindingPurpose, string> = {
  character: "角色",
  scene: "场景/天气",
  prop: "道具",
  style: "风格",
};

const referenceBindingScopeLabels: Record<NewVideoReferenceBindingScope, string> = {
  whole_video: "全片",
  shot_range: "指定镜头",
};

const stagedFactLabels: Record<DirectorStagedFactKind, string> = {
  script_brief: "脚本摘要",
  visual_style: "风格方向",
  character_candidate: "角色",
  scene_candidate: "场景",
  prop_candidate: "道具",
  style_reference: "风格参考",
  image_reference: "参考图",
  audio_need: "音频",
  reference_binding: "绑定用途",
  shot_draft: "镜头草案",
};

const stagedFactOrder: DirectorStagedFactKind[] = [
  "script_brief",
  "character_candidate",
  "scene_candidate",
  "prop_candidate",
  "audio_need",
  "shot_draft",
  "reference_binding",
  "visual_style",
  "style_reference",
  "image_reference",
];

const rhythmProfileOptions = Object.entries(DIRECTOR_RHYTHM_PROFILE_LABELS) as Array<[DirectorRhythmProfile, string]>;

const executionModeLabels: Record<NewVideoStoryboardExecutionMode, string> = {
  single_continuous_shot: "单镜推进",
  relationship_wide: "关系远景",
  action_insert: "动作插入",
  reaction_closeup: "反应特写",
  planned_cut_sequence: "计划切镜",
};

const referenceStrategyLabels: Record<NewVideoReferenceStrategy, string> = {
  storyboard_narrative: "故事板叙事",
  storyboard_rapid_cut: "故事板快切",
  omni_reference: "全能参考",
};

const referenceStrategyDescriptions: Record<NewVideoReferenceStrategy, string> = {
  storyboard_narrative: "用故事板锁构图、人物关系、情绪承接和镜头顺序。",
  storyboard_rapid_cut: "用粗故事板锁快切、动作节点、运镜和节奏。",
  omni_reference: "直接用角色、场景、道具和文字导演提示生成视频。",
};

function storyboardPlanningRowsLabel(count: number, planningRunning: boolean) {
  return planningRunning ? `${count} 个镜头 · AI 优化中` : `${count} 个镜头`;
}

const newVideoComposerDraftStorageKeyPrefix = "vibe-director:new-video-composer-draft";

function newVideoComposerDraftStorageKey(projectKey?: string) {
  const safeProjectKey = cleanText(projectKey)
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(-96);
  return safeProjectKey
    ? `${newVideoComposerDraftStorageKeyPrefix}:${safeProjectKey}`
    : `${newVideoComposerDraftStorageKeyPrefix}:unbound`;
}

function readStoredNewVideoComposerDraft(storageKey: string): Pick<NewVideoStartDraft, "script" | "style"> {
  if (typeof window === "undefined") return { script: "", style: "" };
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(storageKey) || "{}") as Partial<NewVideoStartDraft>;
    return {
      script: typeof parsed.script === "string" ? parsed.script : "",
      style: typeof parsed.style === "string" ? parsed.style : "",
    };
  } catch {
    return { script: "", style: "" };
  }
}

function writeStoredNewVideoComposerDraft(storageKey: string, draft: NewVideoStartDraft) {
  if (typeof window === "undefined") return;
  try {
    if (!draft.script.trim() && !draft.style.trim()) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      script: draft.script,
      style: draft.style,
    }));
  } catch {
    // Best-effort protection for the first-send folder picker path.
  }
}

function clearStoredNewVideoComposerDraft(storageKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Best-effort cleanup only.
  }
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "文件";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function explicitTargetDurationSeconds(text: string) {
  const normalized = text.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
  const match = normalized.match(/(\d{1,3})\s*(?:秒|s|sec|seconds)/i);
  if (!match) return undefined;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return Math.max(1, Math.min(900, seconds));
}

function executableVideoDurationSeconds(value: unknown, fallback = 5) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value || ""));
  const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return Math.max(4, Math.min(15, Math.round(safe)));
}

function explicitShotCount(text: string) {
  const count = extractRequestedShotCount(text);
  if (count === undefined || !Number.isFinite(count) || count <= 0) return undefined;
  return Math.max(1, Math.min(24, Math.round(count)));
}

function localFileUri(file: File) {
  return `local-file://${encodeURIComponent(file.name)}`;
}

function browserMusicAnalysisCandidate(file: File): MusicRhythmAnalysis {
  const safeName = file.name
    .replace(/\.[^.]+$/u, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32) || "music";
  const analysisId = `music_analysis_${safeName}_${Math.abs(file.size || 0).toString(36)}`;
  return {
    schemaVersion: "0.1.0",
    analysisId,
    source: {
      label: file.name,
      safeRef: `music_reference:${analysisId}`,
      mimeType: file.type || undefined,
      sizeBytes: file.size,
    },
    sampleRate: 8000,
    windowSeconds: 1,
    energyCurve: [],
    sections: [],
    recommendedCutPoints: [],
    rhythmTags: ["music_reference_pending_runtime_analysis"],
    warnings: ["duration_unknown_until_runtime_analysis", "energy_curve_pending_runtime_ffmpeg_analysis"],
    projectRelativeAnalysisPath: `audio/music-analysis/${analysisId}.json`,
    noRawPathStored: true,
    videoProviderPolicy: {
      noBgmForVideoProvider: true,
      usedFor: ["rhythm_planning", "final_export_bgm"],
    },
  };
}

function inferAudioRole(file: File | undefined, contextText = ""): NewVideoStartDraft["audioRole"] {
  if (!file) return undefined;
  const fileText = `${file.name} ${file.type}`.toLowerCase();
  const context = contextText.toLowerCase();
  if (/配乐|音乐|背景乐|歌曲|bgm|music|song|ost|soundtrack|beat|rhythm/i.test(fileText)) return "music_reference";
  if (/旁白|对白|台词|配音|音色|音频克隆|声音|人声|voice|vocal|dialogue|narration|speaker|tts|clone/i.test(fileText)) return "voice_reference";
  if (/这段音频.{0,12}(配乐|音乐|背景乐)|这首歌|音乐参考|配乐参考|use this as (music|bgm|soundtrack)/i.test(context)) return "music_reference";
  if (/这段音频.{0,12}(旁白|对白|配音|音色|声音)|声音参考|配音参考|voice reference|speaker reference/i.test(context)) return "voice_reference";
  return "voice_reference";
}

function audioRoleCopy(role: NewVideoStartDraft["audioRole"]) {
  if (role === "music_reference") {
    return {
      title: "配乐参考",
      detail: "已识别为配乐参考，会用于节奏和最终导出，不会直接交给视频模型。",
      short: "用于节奏规划和最终成片配乐",
    };
  }
  return {
    title: "声音参考",
    detail: "已识别为声音参考，会用于角色/旁白配音准备，不会直接交给视频模型。",
    short: "用于配音、音色或对白准备",
  };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function contextualSceneDetail(value: unknown): string | undefined {
  const text = cleanText(value);
  const match = text.match(/^(同上|同前|同场景|同一地点|同一场景|上一镜|上一镜头|前一镜|前一镜头|same|same as above|same scene)(?:[，,、\s]+(.+))?$/iu);
  if (!match) return undefined;
  return cleanText(match[2]);
}

function mergeContextualScene(value: unknown, previousScene: string, fallback: string) {
  const text = cleanText(value);
  const detail = contextualSceneDetail(text);
  if (detail !== undefined) return [previousScene, detail].filter(Boolean).join("，") || fallback;
  return text || fallback;
}

function hasDriverlessCue(value: unknown): boolean {
  const text = cleanText(value);
  return /无司机|没有司机|无人驾驶|驾驶室[^。；;，,]*(?:空|没人|无人|没有人)|driverless|no\s+driver|empty\s+(?:driver|cockpit|cab)/i.test(text);
}

function isGenericDriverLabel(value: unknown): boolean {
  return /^(?:车手|司机|驾驶员|驾驶者|driver|racer)$/iu.test(cleanText(value));
}

function removeDriverlessCharacterLabels(labels: string[], context: string) {
  if (!hasDriverlessCue(context)) return labels;
  return labels.filter((label) => !isGenericDriverLabel(label));
}

function explicitTitleFromDraftScript(script: string) {
  const source = script.slice(0, 1200);
  const match = source.match(/(?:^|[\n\r\s])(?:标题|片名|故事名|项目名|作品名|Title)\s*[:：]\s*(?:《([^》\n]{1,64})》|["“「『]([^"”」』\n]{1,64})["”」』]|([^\n\r。；;]{1,64}))/iu);
  return cleanText(match?.[1] || match?.[2] || match?.[3]);
}

function planSummaryTitleForDisplay(summaryTitle: string, script: string) {
  const explicit = explicitTitleFromDraftScript(script);
  if (explicit) return explicit;
  return cleanText(summaryTitle)
    .replace(/^(?:标题|片名|故事名|项目名|作品名|Title)\s*[:：]\s*/iu, "")
    .replace(/^《(.{1,64})》$/u, "$1")
    .trim() || "新视频草案";
}

function safeDraftId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 54) || "shot";
}

function compactText(value: string, maxLength = 28) {
  const normalized = cleanText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function defaultBindingPurpose(type: NewVideoReferenceKind): NewVideoReferenceBindingPurpose {
  if (type === "character" || type === "scene" || type === "prop" || type === "style") return type;
  return "style";
}

function defaultReferenceBinding(type: NewVideoReferenceKind): NewVideoReferenceBinding {
  return {
    purpose: defaultBindingPurpose(type),
    scope: "whole_video",
    shotRange: "",
    note: "",
  };
}

function referenceTypeForBindingPurpose(purpose: NewVideoReferenceBindingPurpose): NewVideoReferenceKind {
  return purpose;
}

function referenceIntakeType(reference: NewVideoReferenceFile): IntakeReferenceAssetType {
  return reference.type === "prop" ? "image" : reference.type;
}

function referenceBindingSummary(reference: NewVideoReferenceFile) {
  const scope = reference.binding.scope === "shot_range"
    ? `镜头 ${cleanText(reference.binding.shotRange) || "待填写"}`
    : referenceBindingScopeLabels.whole_video;
  const note = cleanText(reference.binding.note);
  return [
    formatFileSize(reference.file.size),
    `用途：${referenceBindingPurposeLabels[reference.binding.purpose]}`,
    `范围：${scope}`,
    note ? `说明：${note}` : "",
  ].filter(Boolean).join(" · ");
}

function referenceInboxSuggestion(reference: NewVideoReferenceFile) {
  if (reference.binding.scope === "shot_range") {
    return `建议绑定到镜头 ${cleanText(reference.binding.shotRange) || "待填写"}`;
  }
  if (reference.binding.purpose === "character") return "建议作为角色身份参考";
  if (reference.binding.purpose === "scene") return "建议作为场景/天气参考";
  if (reference.binding.purpose === "prop") return "建议作为道具外观参考";
  return "建议作为风格或画面参考";
}

function audioInboxSuggestion(role: NewVideoStartDraft["audioRole"]) {
  return role === "music_reference"
    ? "会用于节奏判断和最终配乐，不会交给视频模型"
    : "会作为声音或台词参考，后续可绑定角色";
}

function stripSrtMarkup(value: string) {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !/^\d+$/.test(line) && !/^\d{2}:\d{2}:\d{2}[,.]\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(line))
    .join("\n");
}

function enumeratedShotSegments(text: string): string[] {
  const normalized = cleanText(text);
  const matches = Array.from(normalized.matchAll(
    /(?:第?\s*(?:[一二三四五六七八九十]|\d{1,2})\s*(?:段|镜|镜头|幕)|镜头\s*\d{1,2})[：:\s]*([^，,。；;\n]{2,80})/gu,
  ));
  return matches.map((match) => cleanText(match[1])).filter(Boolean);
}

function mostlyPlanningInstruction(text: string) {
  const normalized = cleanText(text);
  if (!normalized) return true;
  const startsLikeInstruction = /^(?:做成|希望|需要|请|先不要|不要|风格|时长|总时长|目标|用|使用|走|生成|规划|分成|拆成)/u.test(normalized);
  if (!startsLikeInstruction) return false;
  return !/(车|人|猫|少女|男|女|门|手|眼|灯|雨|路|店|房|街|站|电车|书|票|出现|走|跑|看|拿|递|冲|启动|亮起|进入|转身)/u.test(normalized);
}

function scriptSegments(scriptText: string) {
  const rawSegments = splitScriptIntoStoryboardBeats(scriptText).map(cleanText).filter(Boolean);
  const enumerated = rawSegments.flatMap(enumeratedShotSegments);
  if (enumerated.length >= 2) return enumerated;
  return rawSegments.filter((segment) => !mostlyPlanningInstruction(segment));
}

function sourceTextForShotFact(summary: string) {
  return cleanText(summary
    .replace(/^镜头\s*\d+\s*[：:]\s*/u, "")
    .replace(/^\d{1,2}:\d{2}(?::\d{2})?\s*(?:-|–|—|~|至|到|-->)\s*\d{1,2}:\d{2}(?::\d{2})?\s*/u, ""));
}

function titleFromShotText(text: string, index: number) {
  const cleaned = sourceTextForShotFact(text);
  return compactText(cleaned, 18) || `镜头 ${index + 1}`;
}

function shotNoForIndex(index: number) {
  return `1-${index + 1}`;
}

function shotSizeFromText(text: string, index: number) {
  if (/眼神|表情|泪|微笑|沉默|嘴角|手指|指尖|close[- ]?up|特写|大特写/i.test(text)) return "特写";
  if (/环境|街|站台|影院|房间|空间|关系|位置|全景|establish/i.test(text)) return "全景";
  if (/对话|递给|面对|相遇|父亲|母亲|老板|两人|关系/u.test(text)) return "中景";
  return index === 0 ? "全景" : "中近景";
}

function cameraFromText(text: string, index: number) {
  const prefix = index === 0 ? "平视三分之二侧面" : "平视近侧面";
  if (/追|跑|走|离开|进入|穿过|靠近|walk|run/i.test(text)) return `${prefix}，轻微跟拍，保留人物入画和出画方向`;
  if (/看见|发现|盯|望|眼神|屏幕|照片|胶片|放映/i.test(text)) return `${prefix}，缓慢推进到视觉重点`;
  if (/递|拿|握|放|按|打开|关上|hands?|takes?|opens?/i.test(text)) return `${prefix}，跟随手部动作做短推`;
  return `${prefix}，轻微呼吸感推进，不用完全固定镜头`;
}

function visualDescriptionFromText(input: {
  text: string;
  index: number;
  characterLabels: string[];
  sceneLabels: string[];
  propLabels: string[];
  styleResearchPreflight?: StyleResearchPreflight;
}) {
  const subject = input.characterLabels[0] || "主角";
  const scene = input.sceneLabels[input.index % Math.max(1, input.sceneLabels.length)] || "当前场景";
  const prop = input.propLabels[0] && input.propLabels[0] !== "无" ? `，手边可见${input.propLabels[0]}` : "";
  const scenePhrase = /(?:内|外|上空|路面|山路)$/u.test(scene) ? scene : `${scene}内`;
  const action = sourceTextForShotFact(input.text) || "完成这个镜头的主要动作";
  const animeHint = input.styleResearchPreflight?.card.animeCoverageHints[0];
  return [
    `${subject}位于${scenePhrase}，身体${input.index === 0 ? "略侧对" : "侧对"}镜头，视线指向画面右侧。${action}${prop}。动作保持单一清楚，带轻微呼吸、眨眼或手部小动作。`,
    animeHint ? `导演前置：${animeHint}` : "",
  ].filter(Boolean).join(" ");
}

function sceneFromShotText(text: string, sceneLabels: string[], index: number) {
  const candidates: Array<[RegExp, string]> = [
    [/便利店/u, "山脚便利店"],
    [/山顶|停车场/u, "山顶停车场"],
    [/车内|驾驶舱|方向盘|仪表/u, "车内"],
    [/山路|弯道|发卡弯|护栏/u, "山路"],
    [/天空|航拍|山顶方向/u, "山路上空"],
  ];
  return candidates.find(([pattern]) => pattern.test(text))?.[1]
    || mergeContextualScene(
      sceneLabels[index % Math.max(1, sceneLabels.length)] || "",
      sceneLabels[index - 1] || "",
      "",
    )
    || "";
}

function propsFromShotText(text: string, fallbackLabels: string[]) {
  const candidates: Array<[RegExp, string]> = [
    [/SU7|Xiaomi|小米/u, "Xiaomi SU7 Ultra"],
    [/Porsche|GT3|保时捷|911/i, "Porsche 911 GT3"],
    [/电影票|票根|门票/u, "电影票"],
    [/车票/u, "车票"],
    [/旧书|书本/u, "旧书"],
    [/放映机/u, "老放映机"],
    [/胶片/u, "胶片"],
  ];
  const labels = candidates.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
  if (labels.length) return Array.from(new Set(labels)).slice(0, 4);
  return referenceAssetCandidates(fallbackLabels.filter((label) => label !== "录音材料"), "prop").slice(0, 3);
}

function visibleCharacterLabelsFromText(text: string) {
  const labels = [
    /黑猫/u.test(text) ? "黑猫" : "",
    /白猫/u.test(text) ? "白猫" : "",
    !/黑猫|白猫/u.test(text) && /猫/u.test(text) ? "猫" : "",
    /穿雨衣.{0,4}少女|雨衣.{0,8}少女/u.test(text) ? "穿雨衣的少女" : "",
    !/穿雨衣.{0,4}少女|雨衣.{0,8}少女/u.test(text) && /女高中生|高中女生/u.test(text) ? "女高中生" : "",
    /女车手/u.test(text) ? "女车手" : "",
    /男车手/u.test(text) ? "男车手" : "",
    !/穿雨衣.{0,4}少女|雨衣.{0,8}少女|女高中生|高中女生|女车手|少女/u.test(text) && /女生|女孩/u.test(text) ? "女生" : "",
    !/穿雨衣.{0,4}少女|雨衣.{0,8}少女|女高中生|高中女生/u.test(text) && /少女/u.test(text) ? "少女" : "",
    !/男车手/u.test(text) && /男生|男孩/u.test(text) ? "男生" : "",
    /少年/u.test(text) ? "少年" : "",
    /机器人|机甲/u.test(text) ? "机器人" : "",
  ].filter(Boolean);
  return Array.from(new Set(labels));
}

function splitVisibleReferenceLabels(value: unknown) {
  return cleanText(value)
    .split(/[，、,;/；|]/u)
    .map(cleanText)
    .filter((label) => label && !/^(无|没有|待确认|none|n\/a)$/iu.test(label));
}

function charactersFromShotText(text: string, fallbackLabels: string[]) {
  const labels = [
    ...visibleCharacterLabelsFromText(text),
    ...fallbackLabels.filter((label) => text.includes(label) && !(label === "猫" && /黑猫|白猫|橘猫|狸花猫/u.test(text))),
  ].filter(Boolean);
  if (labels.length) return removeDriverlessCharacterLabels(Array.from(new Set(labels)).filter(Boolean), text);
  return removeDriverlessCharacterLabels(referenceAssetCandidates(fallbackLabels, "character"), text);
}

function subtitleFromText(text: string) {
  const quote = text.match(/[“"「『]([^”"」』]{1,36})[”"」』]/u)?.[1];
  if (quote) return quote;
  const dialogue = text.match(/(?:说|问|喊|低声|回答)[：:，,]\s*([^。！？!?]{1,36})/u)?.[1];
  return cleanText(dialogue) || "-";
}

function soundFromText(text: string, audioUsage: string) {
  const sounds = [
    /雨|rain/i.test(text) ? "雨声" : "",
    /门|door/i.test(text) ? "门轴声" : "",
    /车|地铁|站台|train|subway/i.test(text) ? "远处列车声" : "",
    /放映|胶片|影院|cinema|film/i.test(text) ? "放映机转动声" : "",
    /脚步|走|跑|walk|run/i.test(text) ? "脚步声" : "",
  ].filter(Boolean);
  if (sounds.length) return sounds.slice(0, 2).join("、");
  return audioUsage === "现场声或留空" ? "环境底噪" : audioUsage;
}

function firstActionSentence(text: string) {
  const cleaned = sourceTextForShotFact(text);
  return cleaned
    .split(/[。！？!?；;\n]/u)
    .map(cleanText)
    .find(Boolean) || cleaned || "角色完成一个清楚的主要动作";
}

function primaryActionFromText(text: string) {
  const sentence = firstActionSentence(text);
  const actionMatch = sentence.match(/([^，,。！？!?；;]{0,18}(?:递|接|拿|放|推|拉|看|望|抬头|低头|转身|走|跑|冲|停住|握紧|打开|关上|靠近|离开)[^，,。！？!?；;]{0,26})/u);
  return cleanText(actionMatch?.[1] || sentence).slice(0, 52) || "角色完成一个清楚的主要动作";
}

function actionTriggerFromText(text: string) {
  const cleaned = sourceTextForShotFact(text);
  const trigger = cleaned.match(/(?:因为|听见|看见|发现|收到|被|当|在)([^。！？!?；;]{2,34})/u)?.[0];
  if (trigger) return cleanText(trigger);
  if (/递|接|交给/u.test(cleaned)) return "上一动作把道具或视线交到两人之间";
  if (/门|脚步|广播|声音|雨|电话|消息/u.test(cleaned)) return "场景里的声音或物件变化触发行动";
  if (/对话|说|问|沉默/u.test(cleaned)) return "上一句对白或沉默触发反应";
  return "由上一镜头或当前场景状态触发";
}

function microReactionFromText(text: string) {
  const cleaned = sourceTextForShotFact(text);
  const reaction = cleaned.match(/([^。！？!?；;]{0,16}(?:眨眼|垂眼|抬眼|怔住|停顿|呼吸|手指|握紧|嘴角|回头|看向|沉默)[^。！？!?；;]{0,24})/u)?.[1];
  if (reaction) return cleanText(reaction);
  if (/特写|眼神|脸|表情/u.test(cleaned)) return "眼神停一拍，脸部表情有轻微变化";
  if (/递|接|拿|手/u.test(cleaned)) return "手指收紧或停半拍，让动作有活人感";
  return "保留轻微呼吸、眨眼或视线变化";
}

function executionModeFromRhythm(input: {
  rhythmProfile: DirectorRhythmProfile;
  text: string;
  durationSeconds: number;
}): NewVideoStoryboardExecutionMode {
  if (input.rhythmProfile === "action_fast_cut" || input.rhythmProfile === "emotion_montage") return "planned_cut_sequence";
  if (/手|指|递|接|拿|放|按|道具|物件|prop|insert/i.test(input.text)) return "action_insert";
  if (input.rhythmProfile === "anime_emotion" || /眼神|表情|脸|沉默|怔|close[- ]?up/i.test(input.text)) return "reaction_closeup";
  if (/两人|对话|面对|关系|左侧|右侧|前后|递给/u.test(input.text)) return "relationship_wide";
  if (input.durationSeconds >= 8 && input.rhythmProfile === "suspense_pressure") return "relationship_wide";
  return "single_continuous_shot";
}

function visibleCutBudgetFor(input: {
  executionMode: NewVideoStoryboardExecutionMode;
  durationSeconds: number;
  rhythmProfile: DirectorRhythmProfile;
}) {
  if (input.executionMode === "planned_cut_sequence") {
    if (input.durationSeconds <= 6) return "1-2 个最终可见剪辑";
    if (input.durationSeconds <= 10) return "2-3 个最终可见剪辑";
    return "3-4 个最终可见剪辑";
  }
  if (input.executionMode === "reaction_closeup" || input.executionMode === "action_insert") return "1 个最终可见剪辑";
  if (input.rhythmProfile === "suspense_pressure" && input.durationSeconds >= 8) return "1-2 个最终可见剪辑";
  return "不主动切镜";
}

function referenceStrategyFromPlan(input: {
  executionMode: NewVideoStoryboardExecutionMode;
  durationSeconds: number;
  rhythmProfile: DirectorRhythmProfile;
  text: string;
}): NewVideoReferenceStrategy {
  const text = input.text.toLowerCase();
  const shortCleanShot = input.durationSeconds <= 5
    && ["action_insert", "reaction_closeup", "relationship_wide"].includes(input.executionMode);
  if (
    input.executionMode === "planned_cut_sequence"
    || input.rhythmProfile === "action_fast_cut"
    || input.rhythmProfile === "emotion_montage"
    || /快切|连续动作|追逐|打斗|爆发|旋转|变形|展开|切镜|montage|sequence/i.test(text)
  ) {
    return "storyboard_rapid_cut";
  }
  if (shortCleanShot || input.rhythmProfile === "lyrical_observation") return "omni_reference";
  return "storyboard_narrative";
}

function buildActionReactionQa(input: {
  primaryAction: string;
  actionTrigger: string;
  microReaction: string;
  executionMode: NewVideoStoryboardExecutionMode;
  referenceStrategy: NewVideoReferenceStrategy;
  visibleCutBudget: string;
}) {
  return [
    `参考策略：${referenceStrategyLabels[input.referenceStrategy]}；${referenceStrategyDescriptions[input.referenceStrategy]}；`,
    `主动作：${input.primaryAction}；`,
    `触发：${input.actionTrigger}；`,
    `微反应：${input.microReaction}；`,
    `镜头节奏：${executionModeLabels[input.executionMode]}，${input.visibleCutBudget}。`,
  ].join("");
}

function storyboardActionBeats(input: {
  primaryAction: string;
  actionTrigger: string;
  microReaction: string;
  visualDescription?: string;
}): string[] {
  const explicitBeats = cleanText(input.visualDescription)
    .split(/[；;。]/u)
    .map((item) => cleanText(item))
    .filter((item) => /^节拍[一二三四五六七八九十\d]/u.test(item));
  return Array.from(new Set([
    ...explicitBeats,
    cleanText(input.primaryAction),
    cleanText(input.actionTrigger),
    cleanText(input.microReaction),
  ].filter(Boolean))).slice(0, 12);
}

function visibleClipsFromBudget(input: {
  referenceStrategy: NewVideoReferenceStrategy;
  visibleCutBudget: string;
  actionBeats: string[];
}): number {
  if (input.referenceStrategy !== "storyboard_rapid_cut") return 1;
  const budget = cleanText(input.visibleCutBudget);
  const exactClip = budget.match(/(\d+)\s*个?\s*(?:最终)?(?:可见)?(?:剪辑|镜头|片段|clip)/iu);
  if (exactClip) return Math.max(1, Math.min(12, Number(exactClip[1])));
  const rangeClip = budget.match(/(\d+)\s*[-~到至]\s*(\d+)\s*个?\s*(?:最终)?(?:可见)?(?:剪辑|镜头|片段|clip)/iu);
  if (rangeClip) return Math.max(1, Math.min(12, Number(rangeClip[2])));
  const exactCut = budget.match(/(\d+)\s*个?\s*(?:可见)?切点/u);
  if (exactCut) return Math.max(1, Math.min(12, Number(exactCut[1]) + 1));
  const rangeCut = budget.match(/(\d+)\s*[-~到至]\s*(\d+)\s*个?\s*(?:可见)?切点/u);
  if (rangeCut) return Math.max(1, Math.min(12, Number(rangeCut[2]) + 1));
  return Math.max(2, Math.min(12, input.actionBeats.length || 2));
}

function storyboardPanelsForReference(input: {
  referenceStrategy: NewVideoReferenceStrategy;
  visibleClips: number;
  actionBeats: string[];
}): number {
  if (input.referenceStrategy === "omni_reference") return 0;
  if (input.referenceStrategy === "storyboard_narrative") return 1;
  return Math.max(2, Math.min(12, Math.max(input.visibleClips, input.actionBeats.length || 2)));
}

function factsByKind(session: ReturnType<typeof buildDirectorSessionFromIntake> | undefined, kind: DirectorStagedFactKind) {
  return session?.stagedFacts.filter((fact) => fact.kind === kind) || [];
}

function makeStoryboardRow(input: {
  id: string;
  index: number;
  text?: string;
  title?: string;
  durationSeconds?: number;
  characterLabels: string[];
  sceneLabels: string[];
  propLabels: string[];
  audioUsage: string;
  musicSegment?: ScriptMusicRhythmSegment;
  sourceFactId?: string;
  styleResearchPreflight?: StyleResearchPreflight;
}): NewVideoStoryboardShot {
  const text = cleanText(input.text);
  const rowCharacterLabels = charactersFromShotText(text, input.characterLabels);
  const rowPropLabels = propsFromShotText(text, input.propLabels);
  const scene = sceneFromShotText(text, input.sceneLabels, input.index);
  const audioUsage = input.audioUsage;
  const durationSeconds = executableVideoDurationSeconds(input.durationSeconds || input.musicSegment?.durationSeconds, 5);
  const camera = cameraFromText(text, input.index);
  const visualDescription = visualDescriptionFromText({
    text,
    index: input.index,
    characterLabels: rowCharacterLabels,
    sceneLabels: scene ? [scene] : input.sceneLabels,
    propLabels: rowPropLabels,
    styleResearchPreflight: input.styleResearchPreflight,
  });
  const styleResearchLines = input.styleResearchPreflight
    ? formatStyleResearchPreflightForPrompt(input.styleResearchPreflight).slice(0, 7).join("\n")
    : "";
  const rhythmPlan = planDirectorRhythm({
    scriptText: text,
    shotText: [
      titleFromShotText(text, input.index),
      camera,
      visualDescription,
      styleResearchLines,
    ].join("\n"),
    userPreference: styleResearchLines,
    creativeBrief: {
      expressionLikes: input.propLabels,
      rhythmLikes: [audioUsage],
      notes: [input.text, styleResearchLines].filter(Boolean).join("\n"),
    },
    durationSeconds,
    musicAnalysis: input.musicSegment ? {
      rhythmTags: ["music_reference"],
      durationSeconds,
    } : undefined,
  });
  const rhythmProfile = input.musicSegment?.rhythmProfile || rhythmPlan.rhythmProfile;
  const rhythmReason = input.musicSegment?.reason || rhythmPlan.rhythmReason;
  const primaryAction = primaryActionFromText(text);
  const actionTrigger = actionTriggerFromText(text);
  const microReaction = microReactionFromText(text);
  const executionMode = executionModeFromRhythm({
    rhythmProfile,
    text,
    durationSeconds,
  });
  const visibleCutBudget = visibleCutBudgetFor({
    executionMode,
    durationSeconds,
    rhythmProfile,
  });
  const referenceStrategy = referenceStrategyFromPlan({
    executionMode,
    durationSeconds,
    rhythmProfile,
    text,
  });
  const segmentReferenceStrategy = input.musicSegment?.referenceStrategy || referenceStrategy;
  const actionBeats = storyboardActionBeats({
    primaryAction,
    actionTrigger,
    microReaction,
    visualDescription,
  });
  const visibleClips = visibleClipsFromBudget({
    referenceStrategy: segmentReferenceStrategy,
    visibleCutBudget,
    actionBeats,
  });
  const storyboardPanels = storyboardPanelsForReference({
    referenceStrategy: segmentReferenceStrategy,
    visibleClips,
    actionBeats,
  });
  return {
    id: input.id,
    shotNo: shotNoForIndex(input.index),
    duration: String(durationSeconds),
    shotSize: shotSizeFromText(text, input.index),
    camera,
    visualDescription,
    primaryAction,
    actionTrigger,
    microReaction,
    actionReactionQa: buildActionReactionQa({
      primaryAction,
      actionTrigger,
      microReaction,
      executionMode,
      referenceStrategy: segmentReferenceStrategy,
      visibleCutBudget,
    }),
    executionMode,
    referenceStrategy: segmentReferenceStrategy,
    visibleCutBudget,
    visibleClips,
    storyboardPanels,
    actionBeats,
    subtitle: subtitleFromText(text),
    sound: soundFromText(text, audioUsage),
    title: cleanText(input.title) || titleFromShotText(text, input.index),
    characters: rowCharacterLabels.join("、") || "待确认",
    scene: scene || "待确认",
    props: rowPropLabels.slice(0, 3).join("、") || "无",
    audioUsage,
    rhythmProfile,
    rhythmReason,
    sourceFactId: input.sourceFactId,
  };
}

function buildStoryboardRowsFromSession(
  session: ReturnType<typeof buildDirectorSessionFromIntake> | undefined,
  draft: NewVideoStartDraft,
  styleResearchPreflight?: StyleResearchPreflight,
): NewVideoStoryboardShot[] {
  const characterLabels = factsByKind(session, "character_candidate").map((fact) => fact.label);
  const sceneLabels = factsByKind(session, "scene_candidate").map((fact) => fact.label);
  const propLabels = factsByKind(session, "prop_candidate").map((fact) => fact.label);
  const audioUsage = draft.audio || factsByKind(session, "audio_need").length ? "旁白、对白或声音参考" : "现场声或留空";
  const shotFacts = factsByKind(session, "shot_draft");
  const timecodedBeats = extractTimecodedStoryboardBeats(draft.script);
  const scriptRows = timecodedBeats.length ? timecodedBeats.map((beat, index) => ({
    id: `timecoded_segment_${index + 1}_${safeDraftId(beat.title)}`,
    text: beat.text,
    title: beat.title,
    durationSeconds: executableVideoDurationSeconds(beat.durationSeconds),
  })) : scriptSegments(draft.script).map((text, index) => ({
    id: `script_segment_${index + 1}_${safeDraftId(text)}`,
    text,
    title: undefined,
    durationSeconds: undefined,
  }));
  const factRows = shotFacts.map((fact) => ({ id: fact.id, text: fact.summary, title: undefined, durationSeconds: undefined, sourceFactId: fact.id }));
  const sourceRows: Array<{ id: string; text: string; title?: string; durationSeconds?: number; sourceFactId?: string }> = timecodedBeats.length || scriptRows.length >= factRows.length
    ? scriptRows
    : factRows;
  const musicPlan = buildScriptMusicRhythmPlan({
    scriptText: draft.script,
    shotTexts: sourceRows.map((row) => row.text),
    userPreference: [draft.style, audioUsage].filter(Boolean).join("\n"),
    desiredTotalDurationSeconds: explicitTargetDurationSeconds(`${draft.script}\n${draft.style}`),
    musicAnalysis: draft.audioRole === "music_reference" ? draft.musicAnalysis : undefined,
  });

  return sourceRows.map((row, index) => makeStoryboardRow({
    id: `storyboard_${safeDraftId(row.id)}_${index + 1}`,
    index,
    text: row.text,
    title: row.title,
    durationSeconds: row.durationSeconds,
    characterLabels,
    sceneLabels,
    propLabels,
    audioUsage,
    musicSegment: musicPlan.segments[index],
    sourceFactId: row.sourceFactId,
    styleResearchPreflight,
  }));
}

function storyboardRowsToAiSeedRows(rows: NewVideoStoryboardShot[]): DirectorAiStoryboardSeedRow[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    text: [
      `标题：${row.title}`,
      `本地初步动作：${row.primaryAction}`,
      `原始画面摘要：${cleanText(row.visualDescription).slice(0, 220)}`,
      `主动作：${row.primaryAction}`,
      `触发：${row.actionTrigger}`,
      `微反应：${row.microReaction}`,
      row.subtitle && row.subtitle !== "-" ? `字幕：${row.subtitle}` : "",
      row.sound ? `声音：${row.sound}` : "",
    ].filter(Boolean).join("\n"),
    durationSeconds: Number.parseFloat(row.duration) || undefined,
    timeRange: `${row.shotNo} / ${row.duration} 秒`,
    characters: row.characters,
    scene: row.scene,
    props: row.props,
  }));
}

function aiShotToStoryboardRow(
  shot: DirectorAiStoryboardShot,
  index: number,
  fallbackRows: NewVideoStoryboardShot[],
): NewVideoStoryboardShot {
  const fallback = fallbackRows[index] || fallbackRows[0] || emptyStoryboardRow(index);
  const durationSeconds = executableVideoDurationSeconds(shot.durationSeconds || Number.parseFloat(fallback.duration) || 5);
  const executionMode = shot.executionMode as NewVideoStoryboardExecutionMode;
  const referenceStrategy = shot.referenceStrategy as NewVideoReferenceStrategy;
  const actionBeats = shot.actionBeats?.length
    ? shot.actionBeats
    : storyboardActionBeats({
      primaryAction: cleanText(shot.primaryAction) || fallback.primaryAction,
      actionTrigger: cleanText(shot.actionTrigger) || fallback.actionTrigger,
      microReaction: cleanText(shot.microReaction) || fallback.microReaction,
      visualDescription: cleanText(shot.visualDescription) || fallback.visualDescription,
    });
  const visibleCutBudget = cleanText(shot.visibleCutBudget) || visibleCutBudgetFor({
    executionMode,
    durationSeconds,
    rhythmProfile: shot.rhythmProfile,
  });
  const visibleClips = Number.isFinite(shot.visibleClips) && shot.visibleClips > 0
    ? Math.max(1, Math.min(12, Math.round(shot.visibleClips)))
    : visibleClipsFromBudget({ referenceStrategy, visibleCutBudget, actionBeats });
  const storyboardPanels = Number.isFinite(shot.storyboardPanels) && shot.storyboardPanels >= 0
    ? Math.max(0, Math.min(12, Math.round(shot.storyboardPanels)))
    : storyboardPanelsForReference({ referenceStrategy, visibleClips, actionBeats });
  const shotContext = [
    shot.title,
    shot.visualDescription,
    shot.primaryAction,
    shot.actionTrigger,
    shot.microReaction,
    shot.camera,
    shot.scene,
    shot.characters,
  ].map(cleanText).filter(Boolean).join(" ");
  const cleanedCharacterLabels = removeDriverlessCharacterLabels(
    splitVisibleReferenceLabels(shot.characters),
    shotContext,
  );
  const contextCharacterLabels = charactersFromShotText(shotContext, splitVisibleReferenceLabels(fallback.characters));
  const characters = cleanedCharacterLabels.join("、")
    || (hasDriverlessCue(shotContext) ? "无" : contextCharacterLabels.join("、") || fallback.characters);
  const scene = mergeContextualScene(
    shot.scene,
    fallbackRows[index - 1]?.scene || fallback.scene,
    fallback.scene,
  );
  return {
    ...fallback,
    id: `ai_storyboard_${safeDraftId(shot.shotNo || String(index + 1))}_${index + 1}`,
    shotNo: cleanText(shot.shotNo) || shotNoForIndex(index),
    duration: String(durationSeconds),
    shotSize: cleanText(shot.shotSize) || fallback.shotSize,
    camera: cleanText(shot.camera) || fallback.camera,
    visualDescription: cleanText(shot.visualDescription) || fallback.visualDescription,
    primaryAction: cleanText(shot.primaryAction) || fallback.primaryAction,
    actionTrigger: cleanText(shot.actionTrigger) || fallback.actionTrigger,
    microReaction: cleanText(shot.microReaction) || fallback.microReaction,
    executionMode,
    referenceStrategy,
    visibleCutBudget,
    visibleClips,
    storyboardPanels,
    actionBeats,
    subtitle: cleanText(shot.subtitle) || "-",
    sound: cleanText(shot.sound) || fallback.sound,
    title: cleanText(shot.title) || fallback.title,
    characters,
    scene,
    props: cleanText(shot.props) || fallback.props,
    audioUsage: cleanText(shot.audioUsage) || fallback.audioUsage,
    rhythmProfile: shot.rhythmProfile,
    rhythmReason: cleanText(shot.rhythmReason) || fallback.rhythmReason,
    actionReactionQa: buildActionReactionQa({
      primaryAction: cleanText(shot.primaryAction) || fallback.primaryAction,
      actionTrigger: cleanText(shot.actionTrigger) || fallback.actionTrigger,
      microReaction: cleanText(shot.microReaction) || fallback.microReaction,
      executionMode,
      referenceStrategy,
      visibleCutBudget,
    }),
    sourceFactId: fallback.sourceFactId,
  };
}

function buildStoryboardRowsFromAiPlan(
  plan: DirectorAiStoryboardPlan,
  fallbackRows: NewVideoStoryboardShot[],
): NewVideoStoryboardShot[] {
  return plan.shots.map((shot, index) => aiShotToStoryboardRow(shot, index, fallbackRows));
}

function emptyStoryboardRow(index: number): NewVideoStoryboardShot {
  return {
    id: `storyboard_manual_${Date.now()}_${index + 1}`,
    shotNo: shotNoForIndex(index),
    duration: "5",
    shotSize: "中景",
    camera: "平视近侧面，轻微呼吸感推进",
    visualDescription: "主角位于当前场景内，侧对镜头完成一个清楚的主要动作，保留轻微呼吸、眨眼或手部小动作。",
    primaryAction: "角色完成一个清楚的主要动作",
    actionTrigger: "由上一镜头或当前场景状态触发",
    microReaction: "保留轻微呼吸、眨眼或视线变化",
    actionReactionQa: `参考策略：${referenceStrategyLabels.omni_reference}；${referenceStrategyDescriptions.omni_reference}；主动作清楚；触发原因和微反应需要在画面里能看出来。`,
    executionMode: "single_continuous_shot",
    referenceStrategy: "omni_reference",
    visibleCutBudget: "不主动切镜",
    visibleClips: 1,
    storyboardPanels: 0,
    actionBeats: ["角色完成一个清楚的主要动作", "由上一镜头或当前场景状态触发", "保留轻微呼吸、眨眼或视线变化"],
    subtitle: "-",
    sound: "环境底噪",
    title: `新增镜头 ${index + 1}`,
    characters: "待确认",
    scene: "待确认",
    props: "无",
    audioUsage: "现场声或留空",
    rhythmProfile: "lyrical_observation",
    rhythmReason: "新增镜头先按观察式慢铺处理，等画面动作明确后再调整节奏。",
  };
}

function storyboardSignature(rows: NewVideoStoryboardShot[]) {
  return rows.map((row) => [
    row.id,
    cleanText(row.shotNo),
    cleanText(row.duration),
    cleanText(row.shotSize),
    cleanText(row.camera),
    cleanText(row.visualDescription),
    cleanText(row.primaryAction),
    cleanText(row.actionTrigger),
    cleanText(row.microReaction),
    cleanText(row.actionReactionQa),
    cleanText(row.executionMode),
    cleanText(row.referenceStrategy),
    cleanText(row.visibleCutBudget),
    String(row.visibleClips),
    String(row.storyboardPanels),
    row.actionBeats.join("|"),
    cleanText(row.subtitle),
    cleanText(row.sound),
    cleanText(row.title),
    cleanText(row.characters),
    cleanText(row.scene),
    cleanText(row.props),
    cleanText(row.audioUsage),
    cleanText(row.rhythmProfile),
    cleanText(row.rhythmReason),
  ].join("|")).join("\n");
}

function visibleStagedFacts(session: ReturnType<typeof buildDirectorSessionFromIntake> | undefined) {
  if (!session) return [];
  return session.stagedFacts
    .slice()
    .sort((left, right) => stagedFactOrder.indexOf(left.kind) - stagedFactOrder.indexOf(right.kind))
    .slice(0, 10);
}

function buildIntakeDraftFromNewVideoDraft(draft: NewVideoStartDraft) {
  const referenceAssets = [
    ...draft.references.map((reference, index) => ({
      id: reference.id || `reference_${reference.type}_${index + 1}`,
      type: referenceIntakeType(reference),
      label: reference.file.name,
      uri: localFileUri(reference.file),
      note: referenceBindingSummary(reference),
    })),
    ...(draft.audio
      ? [{
          id: "audio_reference_1",
          type: "audio" as const,
          label: draft.audio.name,
          uri: localFileUri(draft.audio),
          note: formatFileSize(draft.audio.size),
        }]
      : []),
  ];
  return buildProjectIntakeDraft({
    scriptText: draft.script,
    styleNote: draft.style,
    referenceAssets,
  });
}

function draftForPlanning(draft: NewVideoStartDraft): NewVideoStartDraft {
  const splitScript = splitCreativePlanningText(draft.script);
  return {
    ...draft,
    script: splitScript.storyText || draft.script,
    style: [draft.style, splitScript.directiveText].map(cleanText).filter(Boolean).join("\n"),
  };
}

function isStarterShot(shot: ShotRecord) {
  return shot.id === "CURRENT_PROJECT" || shot.issues.includes("current_project_story_pending");
}

function discussionStatusLabel(status: StoryDiscussionLaneStatus) {
  if (status === "ready") return "已整理";
  if (status === "needs_reference") return "待绑定";
  if (status === "needs_decision") return "待确认";
  return "待补充";
}

function discussionDeltaLaneLabel(workspace: StoryDiscussionWorkspace, laneId: string) {
  return workspace.lanes.find((lane) => lane.id === laneId)?.label || "草案";
}

function stylePreflightStatusLabel(status: StyleResearchPreflight["status"]) {
  if (status === "ready") return "可用于分镜";
  if (status === "needs_user_confirmation") return "资料待确认";
  return "可先查资料";
}

function stylePreflightLayerText(preflight: StyleResearchPreflight) {
  const localCount = preflight.knowledgeLayers.localBuiltIn.packIds.length;
  const internalizedCount = preflight.knowledgeLayers.projectInternalized.packIds.length;
  const pendingCount = preflight.knowledgeLayers.pendingExternal.resultCount;
  return [
    `本地知识 ${localCount || "无"}`,
    `已保存参考 ${internalizedCount || "无"}`,
    `待确认外部资料 ${pendingCount || "无"}`,
  ].join(" · ");
}

function stylePreflightCardStatusLabel(status: StyleResearchPreflight["contentCards"][number]["status"]) {
  if (status === "usable") return "可用";
  if (status === "needs_confirmation") return "待确认";
  return "待研究";
}

function stylePreflightBehindSceneText(preflight: StyleResearchPreflight) {
  const methods = preflight.contentCards
    .filter((card) => card.status !== "needs_research")
    .map((card) => `${card.title.replace(/卡$/, "")}${stylePreflightCardStatusLabel(card.status)}`)
    .slice(0, 3);
  if (methods.length) return `后台参考：${methods.join(" / ")}。你只需要继续改脚本和分镜。`;
  return "后台会先按本地资料整理镜头节奏，需要时再查资料。";
}

function cleanPlanningSummaryValue(value: string | undefined) {
  const text = cleanText(value);
  return /^(待确认|待补|待补充|无|-)$/.test(text) ? "" : text;
}

function planningSummaryPart(label: string, value: string | undefined) {
  const text = cleanPlanningSummaryValue(value);
  return text ? `${label}：${text}` : "";
}

function agentBoundaryInstruction(mode?: AgentVideoSubmitMode) {
  if (mode === "plan_only") return "当前边界：只做脚本、分镜和节奏规划，不要安排生图或视频提交。";
  if (mode === "reference_allowed") return "当前边界：可以规划参考资产和生图，但不要安排视频提交。";
  return "当前边界：故事和参考通过后，可以继续规划视频提交。";
}

function tableRowSummary(row: NewVideoStoryboardShot, index: number) {
  const rhythmLabel = DIRECTOR_RHYTHM_PROFILE_LABELS[row.rhythmProfile] || "抒情观察";
  const strategyLabel = referenceStrategyLabels[row.referenceStrategy] || "全能参考";
  const bodyParts = [
    `镜头安排：镜号 ${cleanPlanningSummaryValue(row.shotNo) || shotNoForIndex(index)}`,
    `时长 ${cleanPlanningSummaryValue(row.duration) || "5"} 秒`,
    planningSummaryPart("景别", row.shotSize) || "景别：中景",
    planningSummaryPart("镜头", row.camera) || "镜头：轻微呼吸感镜头",
    planningSummaryPart("画面描述", row.visualDescription) || planningSummaryPart("画面描述", row.title) || `画面描述：镜头 ${index + 1}`,
    planningSummaryPart("主动作", row.primaryAction),
    planningSummaryPart("触发", row.actionTrigger),
    planningSummaryPart("微反应", row.microReaction),
    planningSummaryPart("动作反馈", row.actionReactionQa),
    `参考策略：${strategyLabel}`,
    `节奏：${rhythmLabel}`,
    planningSummaryPart("剪辑", row.visibleCutBudget) || "剪辑：不主动切镜",
    planningSummaryPart("理由", row.rhythmReason),
    planningSummaryPart("字幕", row.subtitle),
    planningSummaryPart("音效", row.sound) || planningSummaryPart("音效", row.audioUsage) || "音效：环境底噪",
  ].filter(Boolean);
  const bindingParts = [
    planningSummaryPart("角色", row.characters),
    planningSummaryPart("场景", row.scene),
    planningSummaryPart("道具", row.props),
  ].filter(Boolean);
  return `${bodyParts.join("，")}。${bindingParts.length ? `绑定：${bindingParts.join("，")}。` : ""}`;
}

function makeTableDelta(input: {
  workspace: StoryDiscussionWorkspace;
  id: string;
  kind: StoryDiscussionDelta["kind"];
  label: string;
  summary: string;
  createdAt: string;
}): StoryDiscussionDelta {
  const storyboardItems = input.workspace.lanes.find((lane) => lane.id === "storyboard")?.items || [];
  return {
    id: `${input.workspace.workspaceId}_table_${safeDraftId(input.id)}`,
    kind: input.kind,
    laneId: "storyboard",
    label: input.label,
    summary: input.summary,
    status: "confirmed",
    createdAt: input.createdAt,
    confirmedAt: input.createdAt,
    sourceTurnId: `${input.workspace.workspaceId}_table_turn`,
    sourceRefs: [`storyboard_table:${input.workspace.workspaceId}`],
    sourceFactIds: Array.from(new Set(storyboardItems.flatMap((item) => item.sourceFactIds))).slice(0, 8),
    targetItemIds: storyboardItems.map((item) => item.id).slice(0, 8),
    needsUserConfirmation: true,
    canWriteProjectFactNow: false,
  };
}

function buildStoryboardTableDeltas(input: {
  workspace: StoryDiscussionWorkspace;
  currentRows: NewVideoStoryboardShot[];
  baselineRows: NewVideoStoryboardShot[];
  createdAt: string;
}): StoryDiscussionDelta[] {
  if (storyboardSignature(input.currentRows) === storyboardSignature(input.baselineRows)) return [];
  const baselineIds = new Set(input.baselineRows.map((row) => row.id));
  const currentIds = new Set(input.currentRows.map((row) => row.id));
  const deltas: StoryDiscussionDelta[] = [];

  input.baselineRows.forEach((row, index) => {
    if (!currentIds.has(row.id)) {
      deltas.push(makeTableDelta({
        workspace: input.workspace,
        id: `remove_${row.id}`,
        kind: "storyboard_add_remove",
        label: "分镜增删",
        summary: `删除第 ${index + 1} 个镜头《${cleanText(row.title) || `镜头 ${index + 1}`}》。`,
        createdAt: input.createdAt,
      }));
    }
  });

  input.currentRows.forEach((row, index) => {
    const baselineIndex = input.baselineRows.findIndex((item) => item.id === row.id);
    if (!baselineIds.has(row.id)) {
      deltas.push(makeTableDelta({
        workspace: input.workspace,
        id: `add_${row.id}`,
        kind: "storyboard_add_remove",
        label: "分镜增删",
        summary: `新增第 ${index + 1} 个镜头《${cleanText(row.title) || `镜头 ${index + 1}`}》。${tableRowSummary(row, index)}`,
        createdAt: input.createdAt,
      }));
      return;
    }
    if (baselineIndex !== index) {
      deltas.push(makeTableDelta({
        workspace: input.workspace,
        id: `order_${row.id}_${index + 1}`,
        kind: "storyboard_order_change",
        label: "分镜顺序调整",
        summary: `第 ${baselineIndex + 1} 个镜头移到第 ${index + 1} 个镜头位置。${tableRowSummary(row, index)}`,
        createdAt: input.createdAt,
      }));
    }
    const baseline = input.baselineRows[baselineIndex];
    const durationChanged = cleanText(baseline.duration) !== cleanText(row.duration);
    if (durationChanged) {
      const baselineDuration = Number.parseFloat(baseline.duration) || 5;
      const nextDuration = Number.parseFloat(row.duration) || baselineDuration;
      deltas.push(makeTableDelta({
        workspace: input.workspace,
        id: `duration_${row.id}`,
        kind: "storyboard_timing_adjustment",
        label: "分镜节奏调整",
        summary: `第 ${index + 1} 个镜头时长约 ${cleanText(row.duration) || "5"} 秒，${nextDuration >= baselineDuration ? "节奏慢一点，停留多一点" : "节奏快一点，短一点"}。`,
        createdAt: input.createdAt,
      }));
    }
    const fieldsChanged = ["shotNo", "shotSize", "camera", "visualDescription", "primaryAction", "actionTrigger", "microReaction", "actionReactionQa", "executionMode", "referenceStrategy", "visibleCutBudget", "visibleClips", "storyboardPanels", "actionBeats", "subtitle", "sound", "title", "characters", "scene", "props", "audioUsage", "rhythmProfile", "rhythmReason"].some((field) => (
      cleanText(baseline[field as keyof NewVideoStoryboardShot]) !== cleanText(row[field as keyof NewVideoStoryboardShot])
    ));
    if (fieldsChanged) {
      deltas.push(makeTableDelta({
        workspace: input.workspace,
        id: `fields_${row.id}`,
        kind: "general_note",
        label: "分镜内容调整",
        summary: tableRowSummary(row, index),
        createdAt: input.createdAt,
      }));
    }
  });

  return deltas;
}

function workspaceWithStoryboardTable(
  workspace: StoryDiscussionWorkspace | undefined,
  currentRows: NewVideoStoryboardShot[],
  baselineRows: NewVideoStoryboardShot[],
) {
  if (!workspace || !currentRows.length) return workspace;
  const createdAt = new Date().toISOString();
  const deltas = buildStoryboardTableDeltas({
    workspace,
    currentRows,
    baselineRows,
    createdAt,
  });
  if (!deltas.length) return workspace;
  return {
    ...workspace,
    turns: [
      ...workspace.turns,
      {
        id: `${workspace.workspaceId}_table_turn`,
        role: "user" as const,
        focus: "storyboard" as const,
        createdAt,
        text: "确认镜头安排中的镜号、时长、景别、镜头、主动作、触发原因、微反应、节奏、字幕、音效、角色、场景、道具和音频用途。",
        sourceRefs: [`storyboard_table:${workspace.workspaceId}`],
        rawTextMayBecomeProjectFact: false as const,
      },
    ],
    stagedDeltas: [...workspace.stagedDeltas, ...deltas],
    nextActionLabel: "确认",
  };
}

export function NewVideoStart({
  shots,
  projectDraftKey,
  onDraftChange,
  onStart,
  localProjectReady,
  localProjectBusy,
  canCreateLocalProject,
  onDraftConfirmed,
  availableKnowledgePacks,
  webSearchSettings = defaultAgentWebSearchSettings,
  webSearchReady,
  onSaveResearchAsReference,
  videoPermissionContract,
  onVideoPermissionContractChange,
}: {
  shots: ShotRecord[];
  projectDraftKey?: string;
  onDraftChange?: (draft: NewVideoStartDraft) => void;
  onStart?: (draft: NewVideoStartDraft) => void;
  localProjectReady?: boolean;
  localProjectBusy?: boolean;
  canCreateLocalProject?: boolean;
  onDraftConfirmed?: (draft: NewVideoStartDraft, context: NewVideoStartConfirmationContext) => boolean | void | Promise<boolean | void>;
  availableKnowledgePacks?: KnowledgePack[];
  webSearchSettings?: AgentWebSearchSettings;
  webSearchReady?: boolean;
  onSaveResearchAsReference?: (input: {
    result: AgentWebSearchResult;
    userIntent: string;
  }) => KnowledgePack | Promise<KnowledgePack>;
  videoPermissionContract?: AgentVideoSubmitContract;
  onVideoPermissionContractChange?: (contract: AgentVideoSubmitContract) => void;
}) {
  const workspaceInputRef = useRef<HTMLInputElement>(null);
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const planRef = useRef<HTMLDivElement>(null);
  const composerStorageKey = useMemo(() => newVideoComposerDraftStorageKey(projectDraftKey), [projectDraftKey]);
  const composerStorageKeyRef = useRef(composerStorageKey);
  const initialComposerDraftRef = useRef(readStoredNewVideoComposerDraft(composerStorageKey));
  const pendingReferenceTypeRef = useRef<NewVideoReferenceKind>("image");
  const [script, setScript] = useState(initialComposerDraftRef.current.script);
  const [style, setStyle] = useState(initialComposerDraftRef.current.style);
  const [references, setReferences] = useState<NewVideoReferenceFile[]>([]);
  const [audio, setAudio] = useState<File | undefined>();
  const [audioRole, setAudioRole] = useState<NewVideoStartDraft["audioRole"]>();
  const [projection, setProjection] = useState<IntakeStagedPlanProjection | undefined>();
  const [directorSession, setDirectorSession] = useState<ReturnType<typeof buildDirectorSessionFromIntake> | undefined>();
  const [discussionWorkspace, setDiscussionWorkspace] = useState<StoryDiscussionWorkspace | undefined>();
  const [styleResearchPreflight, setStyleResearchPreflight] = useState<StyleResearchPreflight | undefined>();
  const [discussionFeedback, setDiscussionFeedback] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [referenceUrls, setReferenceUrls] = useState<Record<string, string>>({});
  const [scriptFileName, setScriptFileName] = useState("");
  const [scriptFileError, setScriptFileError] = useState("");
  const [storyboardRows, setStoryboardRows] = useState<NewVideoStoryboardShot[]>([]);
  const [storyboardBaselineRows, setStoryboardBaselineRows] = useState<NewVideoStoryboardShot[]>([]);
  const [expandedStoryboardRowIds, setExpandedStoryboardRowIds] = useState<Set<string>>(() => new Set());
  const [discussionDetailsOpen, setDiscussionDetailsOpen] = useState(false);
  const [planDetailsOpen, setPlanDetailsOpen] = useState(false);
  const [storyboardPlanningSource, setStoryboardPlanningSource] = useState<"none" | "local_structure" | "ai_director">("none");
  const storyboardRowsRef = useRef(storyboardRows);
  const storyboardBaselineRowsRef = useRef(storyboardBaselineRows);
  const storyboardPlanningSourceRef = useRef(storyboardPlanningSource);
  storyboardRowsRef.current = storyboardRows;
  storyboardBaselineRowsRef.current = storyboardBaselineRows;
  storyboardPlanningSourceRef.current = storyboardPlanningSource;
  const [storyboardPlanningStatus, setStoryboardPlanningStatus] = useState<"idle" | "running" | "ready" | "fallback" | "blocked">("idle");
  const [storyboardPlanningMessage, setStoryboardPlanningMessage] = useState("");
  const [storyboardPlanningStartedAt, setStoryboardPlanningStartedAt] = useState<number | undefined>();
  const [storyboardPlanningElapsedSeconds, setStoryboardPlanningElapsedSeconds] = useState(0);
  const [submittedDraft, setSubmittedDraft] = useState<NewVideoStartDraft | undefined>();
  const [styleResearchResult, setStyleResearchResult] = useState<AgentWebSearchResult | undefined>();
  const [styleResearchStatus, setStyleResearchStatus] = useState<"idle" | "running" | "ready" | "blocked">("idle");
  const [styleReferenceStatus, setStyleReferenceStatus] = useState<"idle" | "saving" | "saved" | "blocked">("idle");
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [emptyProjectAgentNotice, setEmptyProjectAgentNotice] = useState<{ title: string; body: string; next: string } | undefined>();
  const isStartingProject = shots.length === 0 || shots.every(isStarterShot);
  const [isOpen, setIsOpen] = useState(isStartingProject);
  const [localVideoPermissionContract, setLocalVideoPermissionContract] = useState<AgentVideoSubmitContract>(
    videoPermissionContract || defaultAgentVideoSubmitContract,
  );
  const hasDraft = Boolean(script.trim() || style.trim() || references.length || audio);
  const effectiveWebSearchReady = webSearchReady ?? webSearchSettings.enabled;
  useEffect(() => {
    if (videoPermissionContract) setLocalVideoPermissionContract(videoPermissionContract);
  }, [videoPermissionContract]);
  useEffect(() => {
    const rowIds = new Set(storyboardRows.map((row) => row.id));
    setExpandedStoryboardRowIds((current) => {
      let changed = false;
      const next = new Set<string>();
      current.forEach((id) => {
        if (rowIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [storyboardRows]);
  const activeVideoPermissionContract = localVideoPermissionContract;
  const draft = useMemo(
    () => ({
      script,
      style,
      references,
      audio,
      audioRole,
      musicAnalysis: audio && audioRole === "music_reference" ? browserMusicAnalysisCandidate(audio) : undefined,
      agentBoundaryMode: activeVideoPermissionContract.mode,
    }),
    [activeVideoPermissionContract.mode, audio, audioRole, references, script, style],
  );
  const activeDraft = submittedDraft || draft;
  useEffect(() => {
    if (storyboardPlanningStatus !== "running" || !storyboardPlanningStartedAt) {
      setStoryboardPlanningElapsedSeconds(0);
      return undefined;
    }
    const tick = () => {
      setStoryboardPlanningElapsedSeconds(Math.max(0, Math.floor((Date.now() - storyboardPlanningStartedAt) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [storyboardPlanningStartedAt, storyboardPlanningStatus]);
  const visualReferences = useMemo(
    () => references.filter((reference) => reference.file.type.startsWith("image/")),
    [references],
  );
  const referenceTypeCounts = useMemo(() => ({
    character: references.filter((reference) => reference.binding.purpose === "character").length,
    scene: references.filter((reference) => reference.binding.purpose === "scene").length,
    prop: references.filter((reference) => reference.binding.purpose === "prop").length,
    style: references.filter((reference) => reference.binding.purpose === "style").length,
  }), [references]);
  const audioCopy = audioRoleCopy(audioRole);
  const hasWorkspaceMaterials = Boolean(visualReferences.length || audio);

  useEffect(() => {
    if (composerStorageKeyRef.current === composerStorageKey) return;
    composerStorageKeyRef.current = composerStorageKey;
    if (projection || submittedDraft || confirmed) return;
    const stored = readStoredNewVideoComposerDraft(composerStorageKey);
    setScript(stored.script);
    setStyle(stored.style);
    setReferences([]);
    setAudio(undefined);
    setAudioRole(undefined);
    setScriptFileName("");
    setScriptFileError("");
    onDraftChange?.({
      script: stored.script,
      style: stored.style,
      references: [],
      audio: undefined,
      audioRole: undefined,
      musicAnalysis: undefined,
      agentBoundaryMode: activeVideoPermissionContract.mode,
    });
  }, [activeVideoPermissionContract.mode, composerStorageKey, confirmed, onDraftChange, projection, submittedDraft]);

  useEffect(() => {
    if (isStartingProject) {
      setIsOpen(true);
      return;
    }
    if (!hasDraft && !projection && !confirmed) setIsOpen(false);
  }, [confirmed, hasDraft, isStartingProject, projection]);

  useEffect(() => {
    const urls = Object.fromEntries(visualReferences.map((reference) => [
      reference.id,
      URL.createObjectURL(reference.file),
    ]));
    setReferenceUrls(urls);
    return () => {
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [visualReferences]);

  function publish(nextDraft: NewVideoStartDraft) {
    writeStoredNewVideoComposerDraft(composerStorageKey, nextDraft);
    setSubmittedDraft(undefined);
    onDraftChange?.(nextDraft);
    setProjection(undefined);
    setDirectorSession(undefined);
    setDiscussionWorkspace(undefined);
    setStyleResearchPreflight(undefined);
    setDiscussionFeedback("");
    setStoryboardRows([]);
    setStoryboardBaselineRows([]);
    setStoryboardPlanningSource("none");
    setStoryboardPlanningStatus("idle");
    setStoryboardPlanningMessage("");
    setStyleResearchResult(undefined);
    setStyleResearchStatus("idle");
    setStyleReferenceStatus("idle");
    setEmptyProjectAgentNotice(undefined);
    setConfirmed(false);
    setConfirmPending(false);
    setConfirmError("");
  }

  function buildCurrentStyleResearchPreflight(input?: {
    draftOverride?: NewVideoStartDraft;
    webSearchResults?: AgentWebSearchResult[];
    extraPacks?: KnowledgePack[];
  }) {
    const sourceDraft = draftForPlanning(input?.draftOverride || activeDraft);
    return buildStyleResearchPreflight({
      userIntent: [sourceDraft.style, sourceDraft.script].filter(Boolean).join("\n"),
      styleIntent: sourceDraft.style,
      scriptText: sourceDraft.script,
      availablePacks: ensureMinimumDefaultKnowledgePacks([...(availableKnowledgePacks || []), ...(input?.extraPacks || [])]),
      webSearchResults: input?.webSearchResults,
      createdAt: new Date().toISOString(),
    });
  }

  function updateScript(value: string) {
    setScriptFileName("");
    setScriptFileError("");
    setScript(value);
    publish({ ...draft, script: value });
  }

  function openWorkspacePicker() {
    workspaceInputRef.current?.click();
  }

  async function readScriptFile(file: File) {
    const fileName = file.name.toLowerCase();
    const allowed = fileName.endsWith(".txt") || fileName.endsWith(".md") || fileName.endsWith(".srt");
    if (!allowed) {
      setScriptFileError("只能导入 .txt、.md 或 .srt。");
      return undefined;
    }
    setScriptFileError("");
    try {
      const rawText = await file.text();
      setScriptFileName(file.name);
      return fileName.endsWith(".srt") ? stripSrtMarkup(rawText) : rawText.trim();
    } catch {
      setScriptFileError("脚本文件没有读出来，请换一个文件。");
      return undefined;
    }
  }

  async function importScriptFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      const nextScript = await readScriptFile(file);
      if (nextScript == null) return;
      setScript(nextScript);
      publish({ ...draft, script: nextScript });
    } finally {
      if (scriptInputRef.current) scriptInputRef.current.value = "";
    }
  }

  function buildReferenceFiles(files: File[], referenceType: NewVideoReferenceKind, offset = references.length) {
    return files
      .filter((file) => file.type.startsWith("image/"))
      .map((file, index) => ({
        id: `${referenceType}_${file.name.replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "_")}_${file.lastModified}_${offset + index + 1}`,
        type: referenceType,
        file,
        binding: defaultReferenceBinding(referenceType),
      }));
  }

  function addReferences(files: FileList | null) {
    if (!files?.length) return;
    const referenceType = pendingReferenceTypeRef.current;
    const nextReferences = [
      ...references,
      ...buildReferenceFiles(Array.from(files), referenceType),
    ];
    setReferences(nextReferences);
    publish({ ...draft, references: nextReferences });
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function addWorkspaceFiles(filesLike: FileList | File[] | null) {
    const files = Array.from(filesLike || []);
    if (!files.length) return;

    const scriptFile = files.find((file) => {
      const name = file.name.toLowerCase();
      return name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".srt") || file.type === "text/plain" || file.type === "text/markdown";
    });
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    const audioFile = files.find((file) => file.type.startsWith("audio/"));

    let nextScript = script;
    if (scriptFile) {
      const importedScript = await readScriptFile(scriptFile);
      if (importedScript != null) nextScript = importedScript;
    }
    const nextReferences = imageFiles.length
      ? [...references, ...buildReferenceFiles(imageFiles, "image")]
      : references;
    const nextAudio = audioFile || audio;
    const nextAudioRole = inferAudioRole(nextAudio, nextScript || style);

    setScript(nextScript);
    setReferences(nextReferences);
    setAudio(nextAudio);
    setAudioRole(nextAudioRole);
    publish({
      ...draft,
      script: nextScript,
      references: nextReferences,
      audio: nextAudio,
      audioRole: nextAudioRole,
      musicAnalysis: nextAudio && nextAudioRole === "music_reference" ? browserMusicAnalysisCandidate(nextAudio) : undefined,
    });
    if (workspaceInputRef.current) workspaceInputRef.current.value = "";
  }

  function handleWorkspaceDrag(event: DragEvent<HTMLElement>, active: boolean) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFiles(active);
  }

  function handleWorkspaceDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFiles(false);
    void addWorkspaceFiles(event.dataTransfer.files);
  }

  function removeReference(index: number) {
    const nextReferences = references.filter((_, itemIndex) => itemIndex !== index);
    setReferences(nextReferences);
    publish({ ...draft, references: nextReferences });
  }

  function updateReferenceBinding(index: number, patch: Partial<NewVideoReferenceBinding>) {
    const nextReferences = references.map((reference, itemIndex) => {
      if (itemIndex !== index) return reference;
      const binding = { ...defaultReferenceBinding(reference.type), ...reference.binding, ...patch };
      return {
        ...reference,
        type: patch.purpose ? referenceTypeForBindingPurpose(patch.purpose) : reference.type,
        binding,
      };
    });
    setReferences(nextReferences);
    publish({ ...draft, references: nextReferences });
  }

  function updateAudio(file: File | undefined) {
    const nextAudioRole = inferAudioRole(file, script || style);
    setAudio(file);
    setAudioRole(nextAudioRole);
    publish({
      ...draft,
      audio: file,
      audioRole: nextAudioRole,
      musicAnalysis: file && nextAudioRole === "music_reference" ? browserMusicAnalysisCandidate(file) : undefined,
    });
    if (audioInputRef.current) audioInputRef.current.value = "";
  }

  async function prepareDraft() {
    if (!hasDraft || storyboardPlanningStatus === "running") return;
    const draftToSubmit = draft;
    const planningDraft = draftForPlanning(draftToSubmit);
    const intakeDraft = buildIntakeDraftFromNewVideoDraft(planningDraft);
    const nextProjection = buildIntakeStagedPlanProjection(intakeDraft);
    const nextSession = buildDirectorSessionFromIntake({ draft: intakeDraft, projection: nextProjection });
    const nextStyleResearchPreflight = buildCurrentStyleResearchPreflight({ draftOverride: planningDraft });
    const localStoryboardRows = buildStoryboardRowsFromSession(nextSession, planningDraft, nextStyleResearchPreflight);
    setSubmittedDraft(planningDraft);
    setScript("");
    setScriptFileName("");
    setScriptFileError("");
    setProjection(nextProjection);
    setDirectorSession(nextSession);
    setStyleResearchPreflight(nextStyleResearchPreflight);
    setDiscussionWorkspace(buildStoryDiscussionWorkspace({ session: nextSession }));
    setStoryboardRows(localStoryboardRows);
    setStoryboardBaselineRows(localStoryboardRows);
    setStoryboardPlanningSource("local_structure");
    setStoryboardPlanningStatus("running");
    setStoryboardPlanningStartedAt(Date.now());
    setStoryboardPlanningElapsedSeconds(0);
    setStoryboardPlanningMessage("已先按时间码和材料做初步识别，正在让 AI 导演重新拆镜头和判断节奏。");
    setDiscussionFeedback("");
    setConfirmed(false);
    setConfirmError("");
    onStart?.(planningDraft);
    window.setTimeout(() => {
      planRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    try {
      const aiPlan = await requestDirectorAiStoryboardPlan({
        scriptText: planningDraft.script,
        styleText: planningDraft.style,
        userPreference: [
          "请真正按导演逻辑拆分，不要机械沿用本地结构行。",
          agentBoundaryInstruction(draftToSubmit.agentBoundaryMode),
          explicitShotCount(`${draftToSubmit.script}\n${draftToSubmit.style}`)
            ? `用户明确要求 ${explicitShotCount(`${draftToSubmit.script}\n${draftToSubmit.style}`)} 个镜头，AI 输出的 shots 数组必须保持这个数量。`
            : "",
          planningDraft.audioRole === "music_reference" ? "用户放入了配乐参考，节奏可以受音乐影响，但不要把 BGM 写给视频模型。" : "",
        ].filter(Boolean).join("\n"),
        targetDurationSeconds: explicitTargetDurationSeconds(`${draftToSubmit.script}\n${draftToSubmit.style}`)
          || localStoryboardRows.reduce((sum, row) => sum + (Number.parseFloat(row.duration) || 0), 0)
          || undefined,
        structuralRows: storyboardRowsToAiSeedRows(localStoryboardRows),
      }, {
        timeoutMs: 150_000,
      });
      const aiRows = buildStoryboardRowsFromAiPlan(aiPlan, localStoryboardRows);
      setStoryboardRows(aiRows);
      setStoryboardBaselineRows(aiRows);
      setStoryboardPlanningSource("ai_director");
      setStoryboardPlanningStatus("ready");
      setStoryboardPlanningStartedAt(undefined);
      setStoryboardPlanningMessage("AI 已重新拆分镜头、节奏和生成方式。确认前仍是草案。");
    } catch (error) {
      setStoryboardPlanningSource("local_structure");
      setStoryboardPlanningStatus("fallback");
      setStoryboardPlanningStartedAt(undefined);
      setStoryboardPlanningMessage(error instanceof Error && /key|配置|API/i.test(error.message)
        ? "AI 分镜还没跑起来：先显示本地初步识别。配置好 Key 后再试。"
        : "AI 分镜这次没有完成，当前保留本地初步识别；可以直接改，或稍后再发送重试。");
    }
  }

  async function lookupStyleResearch() {
    if (styleResearchStatus === "running") return;
    const suggestion = buildAgentWebResearchSuggestion([activeDraft.style, activeDraft.script].filter(Boolean).join("\n"), webSearchSettings);
    const query = suggestion.query || styleResearchPreflight?.suggestedWebQueries[0] || styleResearchPreflight?.query || "";
    if (!effectiveWebSearchReady || !query.trim()) {
      setStyleResearchStatus("blocked");
      return;
    }
    setStyleResearchStatus("running");
    setStyleReferenceStatus("idle");
    try {
      const result = await runAgentWebSearch({
        query,
        purpose: "style_research",
        settings: webSearchSettings,
      });
      setStyleResearchResult(result);
      const nextPreflight = buildCurrentStyleResearchPreflight({ webSearchResults: [result] });
      const canRebuildRows = directorSession
        && storyboardPlanningSourceRef.current !== "ai_director"
        && storyboardSignature(storyboardRowsRef.current) === storyboardSignature(storyboardBaselineRowsRef.current);
      setStyleResearchPreflight(nextPreflight);
      if (directorSession && canRebuildRows) {
        const nextRows = buildStoryboardRowsFromSession(directorSession, draftForPlanning(activeDraft), nextPreflight);
        setStoryboardRows(nextRows);
        setStoryboardBaselineRows(nextRows);
      }
      setStyleResearchStatus("ready");
    } catch {
      setStyleResearchStatus("blocked");
    }
  }

  async function saveStyleResearchAsReference() {
    if (!styleResearchResult || !onSaveResearchAsReference || styleReferenceStatus === "saving") return;
    setStyleReferenceStatus("saving");
    try {
      const pack = await onSaveResearchAsReference({
        result: styleResearchResult,
        userIntent: [activeDraft.style, activeDraft.script].filter(Boolean).join("\n") || styleResearchResult.query,
      });
      const nextPreflight = buildCurrentStyleResearchPreflight({ extraPacks: [pack] });
      const canRebuildRows = directorSession
        && storyboardPlanningSourceRef.current !== "ai_director"
        && storyboardSignature(storyboardRowsRef.current) === storyboardSignature(storyboardBaselineRowsRef.current);
      setStyleResearchPreflight(nextPreflight);
      if (directorSession && canRebuildRows) {
        const nextRows = buildStoryboardRowsFromSession(directorSession, draftForPlanning(activeDraft), nextPreflight);
        setStoryboardRows(nextRows);
        setStoryboardBaselineRows(nextRows);
      }
      setStyleReferenceStatus("saved");
    } catch {
      setStyleReferenceStatus("blocked");
    }
  }

  async function sendDiscussionFeedback() {
    if (!discussionWorkspace || !discussionFeedback.trim()) return;
    if (storyboardPlanningStatus === "running") return;
    const feedbackText = discussionFeedback.trim();
    const stagedWorkspace = stageStoryDiscussionTurn({
      workspace: discussionWorkspace,
      text: feedbackText,
      createdAt: new Date().toISOString(),
    });
    setDiscussionWorkspace(stagedWorkspace);
    setDiscussionFeedback("");
    const planningDraft = draftForPlanning(activeDraft);
    setStoryboardPlanningStatus("running");
    setStoryboardPlanningStartedAt(Date.now());
    setStoryboardPlanningElapsedSeconds(0);
    setStoryboardPlanningMessage("正在按你的反馈重排分镜。");
    try {
      const aiPlan = await requestDirectorAiStoryboardPlan({
        scriptText: planningDraft.script,
        styleText: planningDraft.style,
        userPreference: [
          "用户正在修改当前新视频草案。请直接输出修正后的完整分镜表，不要只记录反馈。",
          `用户反馈：${feedbackText}`,
          agentBoundaryInstruction(activeDraft.agentBoundaryMode),
          planningDraft.audioRole === "music_reference" ? "用户放入了配乐参考，节奏可以受音乐影响，但不要把 BGM 写给视频模型。" : "",
        ].filter(Boolean).join("\n"),
        targetDurationSeconds: explicitTargetDurationSeconds(`${activeDraft.script}\n${activeDraft.style}`)
          || storyboardRows.reduce((sum, row) => sum + (Number.parseFloat(row.duration) || 0), 0)
          || undefined,
        structuralRows: storyboardRowsToAiSeedRows(storyboardRows),
      }, {
        timeoutMs: 150_000,
      });
      const aiRows = buildStoryboardRowsFromAiPlan(aiPlan, storyboardRows);
      setStoryboardRows(aiRows);
      setStoryboardBaselineRows(aiRows);
      setStoryboardPlanningSource("ai_director");
      setStoryboardPlanningStatus("ready");
      setStoryboardPlanningStartedAt(undefined);
      setStoryboardPlanningMessage("已按反馈更新分镜草案，确认前仍不会写入项目。");
      setDiscussionWorkspace(confirmStoryDiscussionDeltas({
        workspace: stagedWorkspace,
        createdAt: new Date().toISOString(),
      }));
    } catch (error) {
      setStoryboardPlanningStatus("ready");
      setStoryboardPlanningStartedAt(undefined);
      setStoryboardPlanningMessage(error instanceof Error && /key|配置|API/i.test(error.message)
        ? "AI 修改还没跑起来：先保留你的反馈，配置好 Key 后再试。"
        : "AI 修改这次没有完成，已先保留你的反馈。");
    }
  }

  function submitComposer() {
    if (storyboardPlanningStatus === "running") return;
    if (projection && discussionWorkspace) {
      void sendDiscussionFeedback();
      return;
    }
    if (shouldHandleEmptyProjectStatusIntent(script)) {
      showEmptyProjectStatusNotice();
      return;
    }
    void prepareDraft();
  }

  function shouldHandleEmptyProjectStatusIntent(value: string) {
    const normalized = cleanText(value);
    if (!isStartingProject || references.length || audio || scriptFileName || style.trim()) return false;
    if (!normalized || normalized.length > 80) return false;
    return classifyDirectorAgentAction(normalized) === "inspect_project_status";
  }

  function showEmptyProjectStatusNotice() {
    const nextDraft = { ...draft, script: "" };
    setScript("");
    setScriptFileName("");
    setScriptFileError("");
    writeStoredNewVideoComposerDraft(composerStorageKey, nextDraft);
    onDraftChange?.(nextDraft);
    setEmptyProjectAgentNotice({
      title: "当前还没有故事流",
      body: localProjectReady
        ? "项目文件夹已经准备好，但还没有正式故事。先写脚本或拖入脚本文件，我会整理成待确认草案。"
        : canCreateLocalProject
          ? "还没有绑定项目文件夹。先写脚本或拖入脚本文件；我会先拆草案，确认时再选择项目文件夹。"
          : "当前是浏览器草稿。先写脚本或拖入脚本文件，我会先整理成待确认内容，确认时再保存项目。",
      next: "下一步：放入脚本或一句故事想法。",
    });
  }

  function selectVideoPermissionMode(mode: AgentVideoSubmitMode) {
    const nextContract = agentVideoSubmitContractForMode(mode);
    setLocalVideoPermissionContract(nextContract);
    onVideoPermissionContractChange?.(nextContract);
  }

  function confirmDiscussionDeltas() {
    if (!discussionWorkspace) return;
    setDiscussionWorkspace(confirmStoryDiscussionDeltas({
      workspace: discussionWorkspace,
      createdAt: new Date().toISOString(),
    }));
  }

  async function confirmDraft() {
    if (!projection || !directorSession || confirmPending || confirmed) return;
    if (discussionWorkspace?.stagedDeltas.some((delta) => delta.status === "staged")) {
      setConfirmError("先确认待修改。");
      return;
    }
    if (!onDraftConfirmed) {
      setConfirmError("当前入口还没有连上项目保存，请刷新后再试。");
      return;
    }
    setConfirmPending(true);
    setConfirmError("");
    try {
      const confirmationWorkspace = workspaceWithStoryboardTable(discussionWorkspace, storyboardRows, storyboardBaselineRows);
      const accepted = await onDraftConfirmed(activeDraft, {
        projection,
        directorSession,
        styleResearchPreflight,
        discussionWorkspace: confirmationWorkspace,
        storyboardDraft: storyboardRows,
      });
      if (accepted === false) return;
      clearStoredNewVideoComposerDraft(composerStorageKey);
      setConfirmed(true);
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : "保存失败，请再试一次。");
    } finally {
      setConfirmPending(false);
    }
  }

  function updateStoryboardRow<K extends keyof Omit<NewVideoStoryboardShot, "id" | "sourceFactId">>(
    id: string,
    field: K,
    value: NewVideoStoryboardShot[K],
  ) {
    setStoryboardRows((rows) => rows.map((row) => {
      if (row.id !== id) return row;
      const nextRow = { ...row, [field]: value };
      if (field === "duration" || field === "executionMode" || field === "rhythmProfile") {
        const durationSeconds = executableVideoDurationSeconds(nextRow.duration);
        const visibleCutBudget = visibleCutBudgetFor({
          executionMode: nextRow.executionMode,
          durationSeconds,
          rhythmProfile: nextRow.rhythmProfile,
        });
        const referenceStrategy = referenceStrategyFromPlan({
          executionMode: nextRow.executionMode,
          durationSeconds,
          rhythmProfile: nextRow.rhythmProfile,
          text: `${nextRow.title} ${nextRow.visualDescription} ${nextRow.primaryAction}`,
        });
        return {
          ...nextRow,
          referenceStrategy,
          visibleCutBudget,
          actionReactionQa: buildActionReactionQa({
            primaryAction: nextRow.primaryAction,
            actionTrigger: nextRow.actionTrigger,
            microReaction: nextRow.microReaction,
            executionMode: nextRow.executionMode,
            referenceStrategy,
            visibleCutBudget,
          }),
        };
      }
      return nextRow;
    }));
    setConfirmed(false);
    setConfirmError("");
  }

  function addStoryboardRow(afterIndex: number) {
    setStoryboardRows((rows) => {
      const nextRows = [...rows];
      nextRows.splice(afterIndex + 1, 0, emptyStoryboardRow(afterIndex + 1));
      return nextRows;
    });
    setConfirmed(false);
    setConfirmError("");
  }

  function removeStoryboardRow(id: string) {
    setStoryboardRows((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== id)));
    setExpandedStoryboardRowIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setConfirmed(false);
    setConfirmError("");
  }

  function moveStoryboardRow(id: string, direction: -1 | 1) {
    setStoryboardRows((rows) => {
      const index = rows.findIndex((row) => row.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= rows.length) return rows;
      const nextRows = [...rows];
      const [row] = nextRows.splice(index, 1);
      nextRows.splice(nextIndex, 0, row);
      return nextRows;
    });
    setConfirmed(false);
    setConfirmError("");
  }

  function setStoryboardRowDetailOpen(id: string, open: boolean) {
    setExpandedStoryboardRowIds((current) => {
      if (open && current.has(id)) return current;
      if (!open && !current.has(id)) return current;
      const next = new Set(current);
      if (open) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  const requiredMissing = projection?.missingChecklist.some((item) => item.severity === "required") || false;
  const pendingDiscussionDeltaCount = discussionWorkspace?.stagedDeltas.filter((delta) => delta.status === "staged").length || 0;
  useEffect(() => {
    if (pendingDiscussionDeltaCount > 0) setDiscussionDetailsOpen(true);
  }, [pendingDiscussionDeltaCount]);
  const workspaceStage = confirmed
    ? "已进入故事流"
    : directorSession?.workspace.stageLabel || (projection
      ? "待确认"
      : hasDraft
        ? "已放入材料"
        : "先写脚本");
  const referenceSummary = directorSession
    ? `${directorSession.workspace.visualReferenceCount} 张参考图${directorSession.workspace.audioReferenceCount ? ` · 1 段${audioCopy.title}` : ""}`
    : references.length || audio
    ? `${references.length} 张参考图${audio ? ` · 1 段${audioCopy.title}` : ""}`
    : "参考和音乐会显示在这里";
  const stagedFacts = visibleStagedFacts(directorSession);
  const usesBrowserDraftProject = !localProjectReady && !localProjectBusy && !canCreateLocalProject;
  const showLocalProjectAction = Boolean(localProjectReady || localProjectBusy || canCreateLocalProject || usesBrowserDraftProject);
  const localProjectLabel = localProjectReady
    ? "项目文件夹已准备"
      : localProjectBusy
        ? "正在选择文件夹"
      : canCreateLocalProject
        ? "确认时选文件夹"
        : "浏览器草稿";
  const storyboardPlanningLabel = storyboardPlanningStatus === "running"
    ? "AI 正在拆分"
    : storyboardPlanningSource === "ai_director"
      ? "AI 分镜草案"
      : storyboardPlanningSource === "local_structure"
        ? "初步识别"
        : "镜头安排";
  const storyboardPlanningRunning = storyboardPlanningStatus === "running";
  const showStoryboardRows = storyboardRows.length > 0 && !storyboardPlanningRunning;
  const storyboardPlanningDetail = storyboardPlanningMessage || (storyboardPlanningSource === "ai_director"
    ? "AI 已整理好，确认前不会写入项目。"
    : storyboardPlanningSource === "local_structure"
      ? "这是本地初步识别，可继续让 AI 拆分。"
      : "");
  const storyboardPlanningRunningDetail = storyboardPlanningRunning
    ? `${storyboardPlanningDetail || "正在整理内容。"} ${storyboardPlanningElapsedSeconds >= 8
      ? `已等待 ${storyboardPlanningElapsedSeconds} 秒，网络慢时可能要 1-3 分钟。`
      : "只整理分镜，不会生图或提交视频。"}`
    : storyboardPlanningDetail;
  const composerIsFeedback = Boolean(projection && discussionWorkspace);
  const composerValue = composerIsFeedback ? discussionFeedback : script;
  const draftConfirmDisabled = requiredMissing || storyboardPlanningRunning || Boolean(pendingDiscussionDeltaCount) || confirmed || confirmPending || Boolean(localProjectBusy && !localProjectReady);
  const draftConfirmDisabledReason = localProjectBusy && !localProjectReady
    ? "本地项目正在准备，稍等一下就能确认。"
    : storyboardPlanningRunning
      ? "AI 正在拆分镜头，等草案出来后再确认。"
    : requiredMissing
      ? "先补脚本，再确认。"
    : pendingDiscussionDeltaCount
      ? "先确认待修改。"
    : confirmed
      ? "草案已经进入故事流。"
    : "当前不能确认。";
  const composerConfirmsDraft = Boolean(composerIsFeedback && !discussionFeedback.trim() && projection);
  const composerDisabled = composerConfirmsDraft
    ? draftConfirmDisabled
    : storyboardPlanningStatus === "running"
      || (composerIsFeedback ? !discussionFeedback.trim() : !hasDraft);
  const composerDisabledReason = composerConfirmsDraft
    ? draftConfirmDisabledReason
    : storyboardPlanningStatus === "running"
    ? "AI 正在拆分镜头，完成后再继续发送。"
    : composerIsFeedback && !discussionFeedback.trim()
      ? "先说一句你想改哪里。"
      : !composerIsFeedback && !hasDraft
        ? "先写一句想法，或拖入脚本、图片、音乐。"
        : "";
  const composerPlaceholder = composerIsFeedback
    ? "直接说哪里要改..."
    : "写脚本、风格或修改意见；也可以拖文件。";
  const composerTitle = composerIsFeedback
    ? "说想改哪里"
    : projection
      ? "继续和 AI 导演说"
      : "写下你想拍什么";
  const composerPrimaryLabel = storyboardPlanningStatus === "running"
    ? "整理中"
    : composerConfirmsDraft
      ? confirmed ? "已进入故事流" : confirmPending ? "正在进入" : "确认进故事流"
      : composerIsFeedback
        ? "发送修改"
        : "发送";
  const composerPrimaryAriaLabel = storyboardPlanningStatus === "running"
    ? "正在拆分镜头"
    : composerConfirmsDraft
      ? confirmed ? "草案已确认" : confirmPending ? "正在确认草案" : "确认新视频草案"
      : composerIsFeedback ? "发送修改意见" : "发送给 AI 导演";
  const composerPrimaryTitle = composerDisabled
    ? composerDisabledReason
    : composerConfirmsDraft
      ? "确认后会进入故事流，不会直接生成。"
      : composerIsFeedback
        ? "发送修改意见给 AI 导演。"
        : "让 AI 先拆故事、分镜和节奏，不会生图或提交视频。";
  const composerStatusLine = composerDisabled
    ? composerDisabledReason
    : storyboardPlanningStatus === "running"
      ? "正在拆分镜头"
      : composerConfirmsDraft
        ? `下一步：${composerPrimaryLabel}`
        : projection
          ? "可以继续修改，或确认进故事流。"
        : hasDraft
            ? "下一步：发送给 AI 导演"
            : "等待输入";
  const composerHelper = storyboardPlanningStatus === "running"
    ? "正在拆分分镜，不会生图或提交视频。"
      : composerConfirmsDraft
        ? "草案没问题就确认；想改的话直接输入意见。"
      : composerIsFeedback
        ? "选中镜头或素材后，直接说你想怎么改。"
      : localProjectReady
        ? "拖入图片、音乐或脚本；音频会自动识别为配乐或声音参考；Cmd Enter 发送。"
      : canCreateLocalProject
          ? "拖入图片、音乐或脚本；先拆草案，确认后再选择项目文件夹。"
          : "拖入图片、音乐或脚本；当前会先作为浏览器草稿规划，确认时再保存项目。";
  const videoPermissionModeItems: Array<{ mode: AgentVideoSubmitMode; label: string }> = [
    { mode: "plan_only", label: "只规划" },
    { mode: "reference_allowed", label: "可做参考" },
    { mode: "video_allowed", label: "可提交视频" },
  ];
  const activeVideoPermissionLabel = videoPermissionModeItems.find((item) => item.mode === activeVideoPermissionContract.mode)?.label || "只规划";
  const showStylePreflight = Boolean(styleResearchPreflight)
    && (styleResearchStatus !== "idle" || Boolean(styleResearchResult) || styleReferenceStatus === "saved");
  const unifiedComposer = (
    <section
      className={`new-video-unified-composer ${projection ? "is-compact" : ""}`}
      aria-label="统一创作输入"
      onDragEnter={(event) => handleWorkspaceDrag(event, true)}
      onDragOver={(event) => handleWorkspaceDrag(event, true)}
      onDragLeave={(event) => handleWorkspaceDrag(event, false)}
      onDrop={handleWorkspaceDrop}
    >
      <label className="new-video-field new-video-composer-field">
        <span>{composerTitle}</span>
        <textarea
          value={composerValue}
          onChange={(event) => {
            if (composerIsFeedback) {
              setDiscussionFeedback(event.target.value);
              return;
            }
            updateScript(event.target.value);
          }}
          placeholder={composerPlaceholder}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              if (!composerDisabled) submitComposer();
            }
          }}
        />
      </label>
      <details className="new-video-agent-boundary-details">
        <summary>
          <span>执行范围</span>
          <strong>{activeVideoPermissionLabel}</strong>
        </summary>
        <div className="minimal-agent-permission-mode" aria-label="当前生成边界">
          {videoPermissionModeItems.map((item) => (
            <button
              key={item.mode}
              type="button"
              className={activeVideoPermissionContract.mode === item.mode ? "is-active" : ""}
              aria-label={`生成边界：${item.label}`}
              aria-pressed={activeVideoPermissionContract.mode === item.mode}
              disabled={storyboardPlanningStatus === "running"}
              title={agentVideoSubmitContractDetail(agentVideoSubmitContractForMode(item.mode))}
              onClick={() => selectVideoPermissionMode(item.mode)}
            >
              {item.label}
            </button>
          ))}
          <span>{agentVideoSubmitContractDetail(activeVideoPermissionContract)}</span>
        </div>
      </details>
      <div className="new-video-composer-bar">
        <input
          ref={workspaceInputRef}
          hidden
          aria-hidden="true"
          tabIndex={-1}
          type="file"
          accept=".txt,.md,.srt,text/plain,text/markdown,image/*,audio/*"
          multiple
          onChange={(event) => void addWorkspaceFiles(event.currentTarget.files)}
        />
        <input
          ref={scriptInputRef}
          hidden
          aria-hidden="true"
          tabIndex={-1}
          type="file"
          accept=".txt,.md,.srt,text/plain,text/markdown"
          onChange={(event) => void importScriptFile(event.currentTarget.files)}
        />
        <input
          ref={imageInputRef}
          hidden
          aria-hidden="true"
          tabIndex={-1}
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => addReferences(event.currentTarget.files)}
        />
        <input
          ref={audioInputRef}
          hidden
          aria-hidden="true"
          tabIndex={-1}
          type="file"
          accept="audio/*"
          onChange={(event) => updateAudio(event.currentTarget.files?.[0])}
        />
        <button className="new-video-asset-action" type="button" onClick={openWorkspacePicker} aria-label="添加脚本、图片或音频文件">
          <Plus size={16} aria-hidden="true" />
          添加文件
        </button>
        <small>
          {scriptFileName ? `${scriptFileName} · ` : ""}
          {composerHelper}
        </small>
        <button
          className="new-video-asset-action new-video-primary-action"
          type="button"
          disabled={composerDisabled}
          aria-label={composerPrimaryAriaLabel}
          title={composerPrimaryTitle}
          onClick={composerConfirmsDraft ? confirmDraft : submitComposer}
        >
          {composerConfirmsDraft ? <CheckCircle2 size={15} aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
          {composerPrimaryLabel}
        </button>
        {scriptFileError && <small className="new-video-script-error">{scriptFileError}</small>}
      </div>
      <div className="new-video-composer-status minimal-agent-status-row">
        <span>状态</span>
        <strong className="minimal-agent-status">{composerStatusLine}</strong>
      </div>
      {(scriptFileName || references.length > 0 || audio) && (
        <div className="new-video-composer-inbox" aria-label="素材收件箱">
          <div className="new-video-composer-inbox-head">
            <span>素材收件箱</span>
            <strong>{[scriptFileName, ...references, audio].filter(Boolean).length} 个素材</strong>
            <small>AI 会先粗分用途，确认故事后再绑定到项目。</small>
          </div>
          <div className="new-video-composer-attachments" aria-label="素材分类和绑定建议">
            {scriptFileName && (
              <span>
                <b>脚本</b>
                <small>{scriptFileName}</small>
                <em>会用于故事、镜头和节奏规划</em>
              </span>
            )}
            {references.map((file, index) => (
              <span key={file.id}>
                <b>{referenceTypeLabels[file.type]}</b>
                <small>{file.file.name}</small>
                <em>{referenceInboxSuggestion(file)}</em>
                <button type="button" onClick={() => removeReference(index)} aria-label={`移除 ${file.file.name}`}>
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            ))}
            {audio && (
              <span>
                <b>{audioCopy.title}</b>
                <small>{audio.name}</small>
                <em>{audioInboxSuggestion(audioRole)}</em>
                <button type="button" onClick={() => updateAudio(undefined)} aria-label={`移除 ${audio.name}`}>
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
  const composerSurface = typeof document === "undefined"
    ? unifiedComposer
    : createPortal(<div className="new-video-bottom-portal">{unifiedComposer}</div>, document.body);
  const projectionTitleForDisplay = projection ? planSummaryTitleForDisplay(projection.summary.title, activeDraft.script) : "";

  return (
    <details
      className={`new-video-start ${isStartingProject ? "is-starting" : ""}`}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <strong>{isStartingProject ? "从新视频开始" : "新视频"}</strong>
          <small>{hasDraft ? "草稿已准备" : "脚本、素材和修改都放下面"}</small>
        </span>
        <Sparkles size={16} aria-hidden="true" />
      </summary>
      <div className="new-video-start-body">
        {!projection && (
          <section className="new-video-start-guide" aria-label="下一步">
            <div>
              <span>下一步</span>
              <strong>{hasDraft ? "AI 拆分镜头" : "写一句故事，或拖入脚本/图片/音乐"}</strong>
              <small>{localProjectLabel} · 这里只整理计划，确认前不会生图或提交视频。</small>
            </div>
            <ol>
              <li>写想法</li>
              <li>AI 拆镜头</li>
              <li>确认进故事流</li>
            </ol>
          </section>
        )}
          <div
            className={`new-video-workspace new-video-codex-composer ${isDraggingFiles ? "is-dragging" : ""}`}
            aria-label="新视频工作区"
            onDragEnter={(event) => handleWorkspaceDrag(event, true)}
            onDragOver={(event) => handleWorkspaceDrag(event, true)}
            onDragLeave={(event) => handleWorkspaceDrag(event, false)}
            onDrop={handleWorkspaceDrop}
          >
            {composerSurface}
        </div>
        {(references.length > 0 || audio) && (
          <details className="new-video-file-details">
            <summary>已添加素材</summary>
            <div className="new-video-file-list" aria-label="已添加素材">
              {references.map((file, index) => (
                <span key={file.id}>
                  <b>{file.file.name}</b>
                  <small>{referenceTypeLabels[file.type]} · {referenceBindingSummary(file)}</small>
                  <button type="button" onClick={() => removeReference(index)} aria-label={`移除 ${file.file.name}`}>
                    <X size={13} aria-hidden="true" />
                  </button>
                </span>
              ))}
              {audio && (
                <span>
                  <b>{audioCopy.title}</b>
                  <small>{audioCopy.short}</small>
                  <button type="button" onClick={() => updateAudio(undefined)} aria-label={`移除 ${audio.name}`}>
                    <X size={13} aria-hidden="true" />
                  </button>
                </span>
              )}
            </div>
          </details>
        )}
        {showLocalProjectAction && (
          <div className="new-video-start-footer">
            <small className="new-video-local-project-status">
              <FolderPlus size={14} aria-hidden="true" />
              {localProjectLabel}
            </small>
          </div>
        )}
        {emptyProjectAgentNotice && !projection && (
          <section className="new-video-agent-notice" aria-label="项目状态">
            <span>项目状态</span>
            <strong>{emptyProjectAgentNotice.title}</strong>
            <p>{emptyProjectAgentNotice.body}</p>
            <small>{emptyProjectAgentNotice.next}</small>
          </section>
        )}
        {projection && (
          <div ref={planRef} className={`new-video-plan ${confirmed ? "is-confirmed" : ""} ${confirmError ? "has-error" : ""}`} aria-label="新视频草案">
            <div className="new-video-plan-summary">
              <div className="new-video-plan-head">
                <strong>{projectionTitleForDisplay}</strong>
                <small>{projection.summary.scriptPreview}</small>
              </div>
              <div className="new-video-next-flow" aria-label="确认后的流程">
                <span>确认后</span>
                <strong>进入故事流，再生成参考</strong>
                <small>确认草案不会生图或提交视频；后面会先看参考，再单独确认提交。</small>
              </div>
              <small className="new-video-next-hint">
                {confirmed ? "已进入故事流" : confirmPending ? "正在进入故事流" : "底部继续：确认进故事流"}
              </small>
            </div>
            {showStylePreflight && styleResearchPreflight && (
              <details
                className="new-video-style-preflight"
                aria-label="导演准备"
                open={styleResearchStatus === "running" || Boolean(styleResearchResult)}
              >
                <summary>
                  <span>资料</span>
                  <strong>{stylePreflightStatusLabel(styleResearchPreflight.status)}</strong>
                  <small>{stylePreflightLayerText(styleResearchPreflight)}</small>
                </summary>
                <div className="new-video-style-preflight-body">
                  <small className="new-video-style-preflight-summary">{stylePreflightBehindSceneText(styleResearchPreflight)}</small>
                  <div className={`new-video-style-research-actions ${styleResearchStatus}`} aria-label="导演资料动作">
                    <button
                      type="button"
                      disabled={!effectiveWebSearchReady || styleResearchStatus === "running"}
                      title={!effectiveWebSearchReady ? "先在设置里开启联网资料并补好 Key。" : "查找风格、分镜和镜头方法资料。"}
                      onClick={() => { void lookupStyleResearch(); }}
                    >
                      <Search size={14} aria-hidden="true" />
                      {!effectiveWebSearchReady ? "未开启" : styleResearchStatus === "running" ? "查找中" : "查资料"}
                    </button>
                    {styleResearchResult && onSaveResearchAsReference && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={styleReferenceStatus === "saving" || styleReferenceStatus === "saved"}
                        onClick={() => { void saveStyleResearchAsReference(); }}
                      >
                        <CheckCircle2 size={14} aria-hidden="true" />
                        {styleReferenceStatus === "saved" ? "已保存" : styleReferenceStatus === "saving" ? "保存中" : "保存为本片参考"}
                      </button>
                    )}
                    <small>
                      {!effectiveWebSearchReady
                        ? "在设置里开启并补好 Key 后，可以先查风格和分镜方法。"
                        : styleResearchStatus === "blocked"
                          ? "这次没有查到可用资料，可换一个风格描述再试。"
                          : styleReferenceStatus === "saved"
                            ? "后续分镜会参考它。"
                            : "资料会先等你确认。"}
                    </small>
                  </div>
                  {styleResearchResult && (
                    <div className="new-video-style-sources" aria-label="资料来源">
                      {styleResearchResult.citations.slice(0, 3).map((source) => (
                        <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                          <span>{source.title}</span>
                          <small>{source.domain}</small>
                          <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            )}
            {storyboardPlanningRunning && (
              <section className="new-video-storyboard-draft is-planning" aria-label="AI 正在拆分镜头">
                <div className="new-video-storyboard-head">
                  <span>{storyboardPlanningLabel}</span>
                  <strong>正在整理分镜</strong>
                  <small>{storyboardPlanningRunningDetail || "先给你看草案，不会直接写入项目。"}</small>
                </div>
              </section>
            )}
            {showStoryboardRows && (
              <section className="new-video-storyboard-draft" aria-label="镜头安排">
                <div className="new-video-storyboard-head">
                  <span>{storyboardPlanningRunning ? "本地草案" : storyboardPlanningLabel}</span>
                  <strong>{storyboardPlanningRowsLabel(storyboardRows.length, storyboardPlanningRunning)}</strong>
                  {storyboardPlanningDetail && <small>{storyboardPlanningDetail}</small>}
                </div>
                <div className="new-video-storyboard-list">
                  {storyboardRows.map((row, index) => (
                    <article className="new-video-storyboard-card" key={row.id}>
                      <header className="new-video-storyboard-card-head">
                        <div className="new-video-storyboard-card-index">
                          <span>{index + 1}</span>
                          <small>{row.shotNo || `镜头 ${index + 1}`}</small>
                        </div>
                        <div className="new-video-storyboard-title">
                          <strong>{row.title || `镜头 ${index + 1}`}</strong>
                          <small>{executableVideoDurationSeconds(row.duration)} 秒 · {row.shotSize || "景别待定"} · {DIRECTOR_RHYTHM_PROFILE_LABELS[row.rhythmProfile] || "节奏待定"}</small>
                        </div>
                      </header>
                      <div className="new-video-storyboard-readable">
                        <p>{row.visualDescription || "画面描述待补。"}</p>
                        <div>
                          <small><b>动作</b>{row.primaryAction || "待填写"}</small>
                          <small><b>角色</b>{row.characters || "待填写"}</small>
                          <small><b>场景</b>{row.scene || "待填写"}</small>
                          <small><b>道具</b>{row.props || "无"}</small>
                        </div>
                        <div className="new-video-reference-strategy" aria-label={`第 ${index + 1} 个生成方式`}>
                          <span>生成方式</span>
                          <strong>{referenceStrategyLabels[row.referenceStrategy]}</strong>
                          <small>{referenceStrategyDescriptions[row.referenceStrategy]}</small>
                        </div>
                      </div>
                      <details
                        className="new-video-storyboard-card-detail"
                        open={expandedStoryboardRowIds.has(row.id)}
                        onToggle={(event) => setStoryboardRowDetailOpen(row.id, event.currentTarget.open)}
                      >
                        <summary>更多镜头细节</summary>
                        {expandedStoryboardRowIds.has(row.id) && (
                          <>
                        <div className="new-video-storyboard-actions" aria-label={`第 ${index + 1} 个镜头调整`}>
                          <button type="button" disabled={index === 0} onClick={() => moveStoryboardRow(row.id, -1)} aria-label={`上移第 ${index + 1} 个镜头`}>
                            <ArrowUp size={13} aria-hidden="true" />
                            上移
                          </button>
                          <button type="button" disabled={index === storyboardRows.length - 1} onClick={() => moveStoryboardRow(row.id, 1)} aria-label={`下移第 ${index + 1} 个镜头`}>
                            <ArrowDown size={13} aria-hidden="true" />
                            下移
                          </button>
                          <button type="button" onClick={() => addStoryboardRow(index)} aria-label={`在第 ${index + 1} 个镜头后新增镜头`}>
                            <Plus size={13} aria-hidden="true" />
                            增加
                          </button>
                          <button type="button" disabled={storyboardRows.length <= 1} onClick={() => removeStoryboardRow(row.id)} aria-label={`删除第 ${index + 1} 个镜头`}>
                            <Trash2 size={13} aria-hidden="true" />
                            删除
                          </button>
                        </div>
                        <div className="new-video-storyboard-card-grid">
                          <label>
                            <span>镜号</span>
                            <input
                              value={row.shotNo}
                              onChange={(event) => updateStoryboardRow(row.id, "shotNo", event.target.value)}
                              aria-label={`第 ${index + 1} 个镜号`}
                            />
                          </label>
                          <label>
                            <span>标题</span>
                            <input
                              value={row.title}
                              onChange={(event) => updateStoryboardRow(row.id, "title", event.target.value)}
                              aria-label={`第 ${index + 1} 个镜头标题`}
                            />
                          </label>
                          <label>
                            <span>时长</span>
                            <div className="new-video-storyboard-duration">
                              <input
                                value={row.duration}
                                onChange={(event) => updateStoryboardRow(row.id, "duration", event.target.value)}
                                onBlur={() => updateStoryboardRow(row.id, "duration", String(executableVideoDurationSeconds(row.duration)))}
                                inputMode="numeric"
                                aria-label={`第 ${index + 1} 个镜头时长`}
                              />
                              <small>秒</small>
                            </div>
                          </label>
                          <label>
                            <span>景别</span>
                            <input
                              value={row.shotSize}
                              onChange={(event) => updateStoryboardRow(row.id, "shotSize", event.target.value)}
                              aria-label={`第 ${index + 1} 个景别`}
                            />
                          </label>
                          <label>
                            <span>节奏</span>
                            <select
                              value={row.rhythmProfile}
                              onChange={(event) => updateStoryboardRow(row.id, "rhythmProfile", event.target.value as DirectorRhythmProfile)}
                              aria-label={`第 ${index + 1} 个节奏`}
                            >
                              {rhythmProfileOptions.map(([profile, label]) => (
                                <option key={profile} value={profile}>{label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="wide">
                            <span>画面</span>
                            <textarea
                              value={row.visualDescription}
                              onChange={(event) => updateStoryboardRow(row.id, "visualDescription", event.target.value)}
                              aria-label={`第 ${index + 1} 个画面描述`}
                            />
                          </label>
                          <label>
                            <span>动作</span>
                            <input
                              value={row.primaryAction}
                              onChange={(event) => updateStoryboardRow(row.id, "primaryAction", event.target.value)}
                              aria-label={`第 ${index + 1} 个主动作`}
                            />
                          </label>
                          <label>
                            <span>角色</span>
                            <input
                              value={row.characters}
                              onChange={(event) => updateStoryboardRow(row.id, "characters", event.target.value)}
                              aria-label={`第 ${index + 1} 个镜头角色`}
                            />
                          </label>
                          <label>
                            <span>场景</span>
                            <input
                              value={row.scene}
                              onChange={(event) => updateStoryboardRow(row.id, "scene", event.target.value)}
                              aria-label={`第 ${index + 1} 个镜头场景`}
                            />
                          </label>
                          <label>
                            <span>道具</span>
                            <input
                              value={row.props}
                              onChange={(event) => updateStoryboardRow(row.id, "props", event.target.value)}
                              aria-label={`第 ${index + 1} 个镜头道具`}
                            />
                          </label>
                        </div>
                        <div className="new-video-storyboard-card-grid">
                          <label>
                            <span>镜头</span>
                            <textarea
                              value={row.camera}
                              onChange={(event) => updateStoryboardRow(row.id, "camera", event.target.value)}
                              aria-label={`第 ${index + 1} 个镜头机位运镜`}
                            />
                          </label>
                          <label>
                            <span>触发</span>
                            <input
                              value={row.actionTrigger}
                              onChange={(event) => updateStoryboardRow(row.id, "actionTrigger", event.target.value)}
                              aria-label={`第 ${index + 1} 个触发原因`}
                            />
                          </label>
                          <label>
                            <span>微反应</span>
                            <input
                              value={row.microReaction}
                              onChange={(event) => updateStoryboardRow(row.id, "microReaction", event.target.value)}
                              aria-label={`第 ${index + 1} 个微反应`}
                            />
                          </label>
                          <label>
                            <span>剪辑</span>
                            <input
                              value={row.visibleCutBudget}
                              onChange={(event) => updateStoryboardRow(row.id, "visibleCutBudget", event.target.value)}
                              aria-label={`第 ${index + 1} 个最终可见剪辑预算`}
                            />
                          </label>
                          <label>
                            <span>镜头节奏</span>
                            <select
                              value={row.executionMode}
                              onChange={(event) => updateStoryboardRow(row.id, "executionMode", event.target.value as NewVideoStoryboardExecutionMode)}
                              aria-label={`第 ${index + 1} 个镜头节奏`}
                            >
                              {Object.entries(executionModeLabels).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="wide">
                            <span>行动反应</span>
                            <textarea
                              value={row.actionReactionQa}
                              onChange={(event) => updateStoryboardRow(row.id, "actionReactionQa", event.target.value)}
                              aria-label={`第 ${index + 1} 个动作反馈`}
                            />
                          </label>
                          <label className="wide">
                            <span>节奏理由</span>
                            <textarea
                              value={row.rhythmReason}
                              onChange={(event) => updateStoryboardRow(row.id, "rhythmReason", event.target.value)}
                              aria-label={`第 ${index + 1} 个节奏理由`}
                            />
                          </label>
                          <label>
                            <span>字幕</span>
                            <input
                              value={row.subtitle}
                              onChange={(event) => updateStoryboardRow(row.id, "subtitle", event.target.value)}
                              aria-label={`第 ${index + 1} 个字幕`}
                            />
                          </label>
                          <label>
                            <span>音效</span>
                            <input
                              value={row.sound}
                              onChange={(event) => updateStoryboardRow(row.id, "sound", event.target.value)}
                              aria-label={`第 ${index + 1} 个音效`}
                            />
                          </label>
                          <label>
                            <span>音频</span>
                            <input
                              value={row.audioUsage}
                              onChange={(event) => updateStoryboardRow(row.id, "audioUsage", event.target.value)}
                              aria-label={`第 ${index + 1} 个镜头音频用途`}
                            />
                          </label>
                        </div>
                          </>
                        )}
                      </details>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {discussionWorkspace && (
              <details
                className="new-video-discussion"
                aria-label="导演讨论与分镜"
                open={discussionDetailsOpen}
                onToggle={(event) => setDiscussionDetailsOpen(event.currentTarget.open)}
              >
                <summary>
                  <span>导演讨论</span>
                  <strong>{discussionWorkspace.nextActionLabel}</strong>
                </summary>
                {discussionDetailsOpen && (
                  <>
                    <div className="new-video-discussion-lanes" aria-label="整理方向">
                      {discussionWorkspace.lanes.map((lane) => (
                        <small key={lane.id} className={lane.status}>
                          <span>{lane.label}</span>
                          <b>{lane.count || "待补"}</b>
                          <em>{discussionStatusLabel(lane.status)}</em>
                        </small>
                      ))}
                    </div>
                    <div className="new-video-discussion-turns" aria-label="讨论记录">
                      {discussionWorkspace.turns.slice(-4).map((turn) => (
                        <p key={turn.id} className={turn.role}>
                          {turn.text}
                        </p>
                      ))}
                    </div>
                    {discussionWorkspace.stagedDeltas.length > 0 && (
                      <div className="new-video-discussion-deltas" aria-label="待确认修改">
                        {discussionWorkspace.stagedDeltas.slice(-4).map((delta) => (
                          <small key={delta.id} className={delta.status}>
                            <span>{discussionDeltaLaneLabel(discussionWorkspace, delta.laneId)}</span>
                            <strong>{delta.label}</strong>
                            <em>{delta.revisionSummary?.confirmationCopy || delta.summary}</em>
                          </small>
                        ))}
                        <button type="button" disabled={!pendingDiscussionDeltaCount} onClick={confirmDiscussionDeltas}>
                          {pendingDiscussionDeltaCount ? "确认修改" : "修改已确认"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </details>
            )}
            {confirmError && <small className="new-video-confirm-error">{confirmError}</small>}
            <details
              className="new-video-plan-details"
              open={planDetailsOpen}
              onToggle={(event) => setPlanDetailsOpen(event.currentTarget.open)}
            >
              <summary>更多细节</summary>
              {planDetailsOpen && (
                <div className="new-video-plan-detail-body">
                  <div className="new-video-plan-status">
                    <small>{confirmed ? "已确认" : "待确认"}</small>
                    <small>{requiredMissing ? "先补脚本，再确认。" : "确认后进入故事流，不会直接生成。"}</small>
                  </div>
                  <div className="new-video-plan-grid" aria-label="草案材料">
                    <small>{referenceTypeCounts.character} 个主角参考</small>
                    <small>{referenceTypeCounts.scene} 个场景参考</small>
                    <small>{referenceTypeCounts.prop} 个道具参考</small>
                    <small>{referenceTypeCounts.style} 个风格参考</small>
                    <small>{projection.summary.assetCounts.audio} 个音频</small>
                  </div>
                  {stagedFacts.length > 0 && (
                    <div className="new-video-staged-facts" aria-label="整理出的内容">
                      {stagedFacts.map((fact) => (
                        <small key={fact.id} className={fact.kind}>
                          <span>{stagedFactLabels[fact.kind]}</span>
                          <strong>{fact.label}</strong>
                        </small>
                      ))}
                    </div>
                  )}
                  {projection.missingChecklist.length > 0 && (
                    <div className="new-video-checklist" aria-label="待补齐">
                      {projection.missingChecklist.map((item) => (
                        <small key={item.field} className={item.severity}>
                          {item.label}
                        </small>
                      ))}
                    </div>
                  )}
                  <div className="new-video-plan-steps" aria-label="整理计划">
                    {projection.stagedPlan.map((step) => (
                      <small key={step.id} className={step.status}>
                        {step.label}
                      </small>
                    ))}
                  </div>
                </div>
              )}
            </details>
          </div>
        )}
      </div>
    </details>
  );
}
