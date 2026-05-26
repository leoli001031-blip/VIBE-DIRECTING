import { unique } from "./collectionUtils";
import { isPromptBypassIntent } from "./directorEdit";
import {
  buildStoryboardReferenceProjectPlan,
  type StoryboardReferenceProjectPlan,
  type StoryboardReferenceProjectPlannerInput,
  type StoryboardReferenceProjectPlannerShot,
  type StoryboardReferenceProjectShotPlan,
} from "./storyboardReferenceProjectPlanner";
import type {
  DirectorRhythmProfile,
  DirectorSplitPolicy,
} from "./directorRhythmPlanner";

export const DIRECTOR_FEEDBACK_RECOMPILE_VERSION = "director_feedback_recompile_v1";

export type DirectorFeedbackCategory =
  | "identity_drift"
  | "flat_action"
  | "shot_split"
  | "storyboard_structure"
  | "scene_continuity"
  | "reference_conflict"
  | "no_bgm"
  | "generic_director_note";

export type DirectorFeedbackRecompileStatus =
  | "ready_for_confirmation"
  | "blocked_prompt_bypass"
  | "blocked_missing_shot";

export interface DirectorFeedbackIntent {
  normalizedFeedback: string;
  categories: DirectorFeedbackCategory[];
  targetShotId: string;
  operation: "revise_storyboard_and_video_plan";
  confirmationRequired: true;
}

export interface DirectorFeedbackAffectedArtifact {
  artifactType:
    | "storyboard_reference_prompt"
    | "seedance_video_prompt"
    | "director_plan"
    | "preview_projection"
    | "export_plan";
  targetId: string;
  requiresRegeneration: true;
  reason: string;
}

export interface DirectorFeedbackRecompileResult {
  schemaVersion: typeof DIRECTOR_FEEDBACK_RECOMPILE_VERSION;
  id: string;
  status: DirectorFeedbackRecompileStatus;
  providerCalled: false;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  noFreeTextTask: true;
  confirmationRequired: true;
  feedbackIntent: DirectorFeedbackIntent;
  stagedShotPatch: Partial<StoryboardReferenceProjectPlannerShot>;
  patchedProjectInput?: StoryboardReferenceProjectPlannerInput;
  recompiledProjectPlan?: StoryboardReferenceProjectPlan;
  recompiledShotPlan?: StoryboardReferenceProjectShotPlan;
  affectedArtifacts: DirectorFeedbackAffectedArtifact[];
  blockedReasons: string[];
  warnings: string[];
  userFacingSummary: string;
  createdAt: string;
}

export interface BuildDirectorFeedbackRecompileInput {
  feedback: string;
  targetShotId: string;
  projectPlanInput: StoryboardReferenceProjectPlannerInput;
  id?: string;
  createdAt?: string;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanLines(lines: Array<string | false | undefined>): string {
  return lines.filter((line): line is string => Boolean(line && line.trim())).join("\n");
}

function stableId(prefix: string, seed: string): string {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(16)}`;
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function feedbackCategories(feedback: string): DirectorFeedbackCategory[] {
  const text = feedback.toLowerCase();
  const categories: DirectorFeedbackCategory[] = [];

  if (hasAny(text, [/人物不像|角色不像|主角不像|女主.*不像|发型|短发|长发|蝴蝶结|衣服|服装|身份漂|character|identity|hair|outfit|silhouette|drift/i])) {
    categories.push("identity_drift");
  }
  if (hasAny(text, [/动作平|没有动作|太静|很僵|npc|表演|微反应|眼神|呼吸|手部紧张|flat|stiff|performance|micro[-\s]?reaction/i])) {
    categories.push("flat_action");
  }
  if (hasAny(text, [/拆|特写|大特写|快切|切镜头|手部|脸部|眼神|递东西|对视|close[-\s]?up|insert|fast[-\s]?cut|cutaway/i])) {
    categories.push("shot_split");
  }
  if (hasAny(text, [/分镜不像|不像分镜|故事板|主画面|小格|大图|构图|storyboard|main panel|composition/i])) {
    categories.push("storyboard_structure");
  }
  if (hasAny(text, [/场景|天气|光影|光线|环境|地点|空间|scene|weather|lighting|environment|location/i])) {
    categories.push("scene_continuity");
  }
  if (hasAny(text, [/参考图太多|全能参考|参考.*冲突|角色漂移|混在一起|拼盘|reference|all-around|blend|moodboard/i])) {
    categories.push("reference_conflict");
  }
  if (hasAny(text, [/no\s*bgm|不要音乐|无配乐|别加音乐|不要配乐|bgm|music/i])) {
    categories.push("no_bgm");
  }

  return unique(categories.length ? categories : ["generic_director_note"]);
}

function rhythmProfileFor(categories: DirectorFeedbackCategory[], shot: StoryboardReferenceProjectPlannerShot): DirectorRhythmProfile | undefined {
  if (categories.includes("shot_split") && /快切|动作|冲|跑|追|打|fast|action/i.test(clean(shot.intent))) return "action_fast_cut";
  if (categories.includes("shot_split") || categories.includes("flat_action")) return "anime_emotion";
  if (categories.includes("scene_continuity") && !categories.includes("flat_action")) return shot.rhythmProfile;
  return shot.rhythmProfile;
}

function splitPolicyFor(categories: DirectorFeedbackCategory[], shot: StoryboardReferenceProjectPlannerShot): DirectorSplitPolicy | undefined {
  if (categories.includes("shot_split") && /快切|动作|冲|跑|追|打|fast|action/i.test([shot.intent, shot.camera].map(clean).join(" "))) return "split_for_action";
  if (categories.includes("shot_split") || categories.includes("flat_action")) return "split_for_reaction";
  return shot.splitPolicy;
}

function patchForFeedback(
  feedback: string,
  shot: StoryboardReferenceProjectPlannerShot,
): { patch: Partial<StoryboardReferenceProjectPlannerShot>; warnings: string[] } {
  const categories = feedbackCategories(feedback);
  const feedbackDirectives: string[] = [];
  const characterGuidance: string[] = [];
  const sceneGuidance: string[] = [];
  const propGuidance: string[] = [];
  // actionBeats compiled from director feedback; consider making the beat extraction configurable
  const actionBeats = [...(shot.actionBeats || [])];
  const warnings: string[] = [];

  if (categories.includes("identity_drift")) {
    characterGuidance.push(
      "Locked character references are authoritative for face, hairstyle, hair length, ribbon/bow, outfit silhouette, body type, and identity. Do not replace the character with the temporary storyboard design.",
    );
    feedbackDirectives.push("修正角色一致性：分镜占位人物不能覆盖已锁定角色参考。");
  }

  if (categories.includes("flat_action")) {
    feedbackDirectives.push("修正表演过平：镜头必须有行为动机、动作触发、主动作和可读微反应。");
    if (!shot.actionTrigger) {
      feedbackDirectives.push("动作触发建议：先给角色一个可见诱因，例如声音、视线变化、物体移动或对方反应。");
    }
    if (!shot.microReaction) {
      feedbackDirectives.push("微反应建议：加入呼吸、眼神、手指、肩膀或停顿的细微变化。");
    }
  }

  if (categories.includes("shot_split")) {
    feedbackDirectives.push("修正镜头拆分：用关系镜头、手部/道具插入、眼神/脸部反应、回到关系镜头的顺序表达，不要一个中景拍完。");
    actionBeats.push(
      "关系镜头建立角色距离和屏幕方向",
      "手部或道具特写表现动作发生前的准备",
      "眼神或面部特写表现反应",
    );
    if (Number(shot.durationSeconds || 0) > 0 && Number(shot.durationSeconds || 0) <= 6) {
      warnings.push("短时长镜头只应保留一个主动作，小分镜只作为 timing hint，不要把所有切点塞进一个视频。");
    }
  }

  if (categories.includes("storyboard_structure")) {
    feedbackDirectives.push("修正分镜结构：一张大主画面锁定第一眼构图，小格只交代动作承接；不要做提案板、表格或密集漫画格。");
  }

  if (categories.includes("scene_continuity")) {
    sceneGuidance.push(
      "Scene baseline controls weather, time of day, light direction, spatial anchors, and atmosphere. Do not let character or storyboard references replace the scene lighting.",
    );
    feedbackDirectives.push("修正场景连续性：优先保留场景基准图的天气、光线方向、空间锚点和环境气氛。");
  }

  if (categories.includes("reference_conflict")) {
    feedbackDirectives.push("修正参考冲突：每张参考图只锁自己的维度，不要把全能参考混合成一个新风格拼盘。");
    characterGuidance.push("If storyboard and character reference disagree, keep the character reference for identity.");
    sceneGuidance.push("If storyboard and scene baseline disagree, keep the scene baseline for environment and weather.");
    propGuidance.push("If storyboard and prop reference disagree, keep the prop reference for object design.");
  }

  if (categories.includes("no_bgm")) {
    feedbackDirectives.push("声音修正：no BGM, no music；如有音频，只作为对白节奏和表演 timing。");
  }

  if (categories.includes("generic_director_note")) {
    feedbackDirectives.push("按导演反馈重新检查构图、动作、角色一致性、场景连续性和视频可执行性。");
  }

  const rhythmProfile = rhythmProfileFor(categories, shot);
  const splitPolicy = splitPolicyFor(categories, shot);
  const executionMode = categories.includes("shot_split")
    ? "planned_cut_sequence"
    : shot.executionMode;
  const primaryAction = shot.primaryAction || clean(shot.intent) || "保留当前主动作并让动作前状态更清楚";
  const actionTrigger = shot.actionTrigger || (categories.includes("flat_action") ? "角色受到可见诱因后才开始动作" : undefined);
  const microReaction = shot.microReaction || (categories.includes("flat_action") ? "角色出现眼神、呼吸、手指或肩膀的细微反应" : undefined);
  const seedanceDirection = cleanLines([
    shot.seedanceDirection || shot.intent,
    ...feedbackDirectives,
    ...sceneGuidance,
    categories.includes("no_bgm") ? "no BGM, no music, no added soundtrack." : undefined,
  ]);

  const patch: Partial<StoryboardReferenceProjectPlannerShot> = {
    // NOTE: guidance arrays are append-only (never reset between recompiles); risk of unbounded growth across multiple director feedback rounds
    feedbackDirectives: unique([...(shot.feedbackDirectives || []), ...feedbackDirectives]),
    characterGuidance: unique([...(shot.characterGuidance || []), ...characterGuidance]),
    sceneGuidance: unique([...(shot.sceneGuidance || []), ...sceneGuidance]),
    propGuidance: unique([...(shot.propGuidance || []), ...propGuidance]),
    actionBeats: unique(actionBeats),
    seedanceDirection,
  };
  if (rhythmProfile) patch.rhythmProfile = rhythmProfile;
  if (splitPolicy) patch.splitPolicy = splitPolicy;
  if (executionMode) patch.executionMode = executionMode;
  if (primaryAction) patch.primaryAction = primaryAction;
  if (actionTrigger) patch.actionTrigger = actionTrigger;
  if (microReaction) patch.microReaction = microReaction;

  return { patch, warnings };
}

function mergeShotPatch(
  shot: StoryboardReferenceProjectPlannerShot,
  patch: Partial<StoryboardReferenceProjectPlannerShot>,
): StoryboardReferenceProjectPlannerShot {
  return {
    ...shot,
    ...patch,
    feedbackDirectives: unique([...(shot.feedbackDirectives || []), ...(patch.feedbackDirectives || [])]),
    characterGuidance: unique([...(shot.characterGuidance || []), ...(patch.characterGuidance || [])]),
    sceneGuidance: unique([...(shot.sceneGuidance || []), ...(patch.sceneGuidance || [])]),
    propGuidance: unique([...(shot.propGuidance || []), ...(patch.propGuidance || [])]),
    actionBeats: unique([...(shot.actionBeats || []), ...(patch.actionBeats || [])]),
  };
}

function affectedArtifacts(targetShotId: string, categories: DirectorFeedbackCategory[]): DirectorFeedbackAffectedArtifact[] {
  const reason = `director_feedback:${categories.join("+")}`;
  return [
    "director_plan",
    "storyboard_reference_prompt",
    "seedance_video_prompt",
    "preview_projection",
    "export_plan",
  ].map((artifactType) => ({
    artifactType: artifactType as DirectorFeedbackAffectedArtifact["artifactType"],
    targetId: targetShotId,
    requiresRegeneration: true,
    reason,
  }));
}

export function buildDirectorFeedbackRecompile(
  input: BuildDirectorFeedbackRecompileInput,
): DirectorFeedbackRecompileResult {
  const createdAt = input.createdAt || new Date().toISOString();
  const normalizedFeedback = clean(input.feedback);
  const id = input.id || stableId("director_feedback_recompile", `${input.targetShotId}:${normalizedFeedback}:${createdAt}`);
  const categories = feedbackCategories(normalizedFeedback);
  const feedbackIntent: DirectorFeedbackIntent = {
    normalizedFeedback,
    categories,
    targetShotId: input.targetShotId,
    operation: "revise_storyboard_and_video_plan",
    confirmationRequired: true,
  };
  const base = {
    schemaVersion: DIRECTOR_FEEDBACK_RECOMPILE_VERSION as typeof DIRECTOR_FEEDBACK_RECOMPILE_VERSION,
    id,
    providerCalled: false as const,
    providerSubmissionForbidden: true as const,
    liveSubmitAllowed: false as const,
    noFreeTextTask: true as const,
    confirmationRequired: true as const,
    feedbackIntent,
    affectedArtifacts: affectedArtifacts(input.targetShotId, categories),
    createdAt,
  };

  if (isPromptBypassIntent(normalizedFeedback)) {
    return {
      ...base,
      status: "blocked_prompt_bypass",
      stagedShotPatch: {},
      blockedReasons: ["prompt_bypass_forbidden"],
      warnings: [],
      userFacingSummary: "这条反馈像是在要求直接改 provider prompt。需要先变成结构化导演修改，再由用户确认。",
    };
  }

  const targetShot = input.projectPlanInput.shots.find((shot) => shot.id === input.targetShotId);
  if (!targetShot) {
    return {
      ...base,
      status: "blocked_missing_shot",
      stagedShotPatch: {},
      blockedReasons: [`missing_shot:${input.targetShotId}`],
      warnings: [],
      userFacingSummary: "没有找到要修改的镜头，暂时不能重新编译。",
    };
  }

  const { patch, warnings } = patchForFeedback(normalizedFeedback, targetShot);
  const patchedProjectInput: StoryboardReferenceProjectPlannerInput = {
    ...input.projectPlanInput,
    shots: input.projectPlanInput.shots.map((shot) => (
      shot.id === input.targetShotId ? mergeShotPatch(shot, patch) : shot
    )),
  };
  const recompiledProjectPlan = buildStoryboardReferenceProjectPlan(patchedProjectInput);
  const recompiledShotPlan = recompiledProjectPlan.shotPlans.find((plan) => plan.shotId === input.targetShotId);

  return {
    ...base,
    status: "ready_for_confirmation",
    stagedShotPatch: patch,
    patchedProjectInput,
    recompiledProjectPlan,
    recompiledShotPlan,
    blockedReasons: recompiledShotPlan?.blockedReasons || [],
    warnings: unique([...warnings, ...(recompiledShotPlan?.warnings || [])]),
    userFacingSummary: "已把反馈整理成结构化导演修改，并重新编译分镜图和视频计划；确认前不会提交任何生成任务。",
  };
}
