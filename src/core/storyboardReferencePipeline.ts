import {
  JIMENG_CLI_DEFAULT_BINARY,
  JIMENG_CLI_DEFAULT_DURATION_SECONDS,
  JIMENG_CLI_MAX_DURATION_SECONDS,
  JIMENG_CLI_DEFAULT_MAX_CONCURRENT_VIDEO_JOBS,
  JIMENG_CLI_MIN_DURATION_SECONDS,
  JIMENG_CLI_DEFAULT_MODEL_VERSION,
  JIMENG_CLI_DEFAULT_SHORT_POLL_SECONDS,
  JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES,
  clampJimengDurationSeconds,
  normalizeJimengVideoResolution,
} from "./jimengVideoCli";
import {
  planDirectorRhythm,
  type CreativeBrief,
  type DirectorActionDensity,
  type DirectorRhythmPlan,
  type DirectorRhythmProfile,
  type DirectorSplitPolicy,
} from "./directorRhythmPlanner";
import type { DirectorProductionSkillPlan } from "./directorProductionSkill";

export const STORYBOARD_REFERENCE_PIPELINE_VERSION = "storyboard_reference_scene_baseline_v1";

export const IMAGE2_STORYBOARD_ALLOWED_REFERENCE_ROLES = [
  "scene_baseline",
  "character_identity",
  "prop_reference",
] as const;
export const IMAGE2_STORYBOARD_FORBIDDEN_REFERENCE_ROLES = [
  "dialogue_audio",
  "final_color_frame",
] as const;

export const SEEDANCE_ALL_AROUND_REFERENCE_ORDER = [
  "storyboard_reference",
  "scene_baseline",
  "character_identity",
  "prop_reference",
  "dialogue_audio",
] as const;

export const STORYBOARD_REFERENCE_STRATEGY_PACK_IDS = [
  "composition/visual-structure-decomposition",
  "composition/multi-character-blocking",
  "camera/state-flow-motion-planning",
  "camera/imperfect-camera-motion",
  "performance/action-motivation-microreaction",
  "visual-memory/reference-dimension-locking",
] as const;

export type Image2StoryboardAllowedReferenceRole = typeof IMAGE2_STORYBOARD_ALLOWED_REFERENCE_ROLES[number];
export type Image2StoryboardForbiddenReferenceRole = typeof IMAGE2_STORYBOARD_FORBIDDEN_REFERENCE_ROLES[number];
export type SeedanceAllAroundReferenceRole = typeof SEEDANCE_ALL_AROUND_REFERENCE_ORDER[number];
export type StoryboardReferenceRole =
  | SeedanceAllAroundReferenceRole
  | Image2StoryboardForbiddenReferenceRole
  | "final_color_frame";

export interface StoryboardReferenceRoleBinding {
  role: StoryboardReferenceRole;
  useFor: string[];
  ignoreFor: string[];
  priority: number;
  conflictRule: string;
}

export const STORYBOARD_REFERENCE_ROLE_BINDINGS: Record<StoryboardReferenceRole, StoryboardReferenceRoleBinding> = {
  storyboard_reference: {
    role: "storyboard_reference",
    useFor: ["composition", "blocking", "screen direction", "camera movement", "action beats", "rough cut rhythm"],
    ignoreFor: ["character identity", "wardrobe authority", "prop design authority", "scene color", "readable text", "panel borders", "visible arrows", "dotted eyeline guides", "panel numbers", "symbol overlays"],
    priority: 10,
    conflictRule: "Use storyboard references for motion and layout only; ignore any temporary design or visible storyboard notation that conflicts with locked assets or final-video cleanliness.",
  },
  scene_baseline: {
    role: "scene_baseline",
    useFor: ["location", "weather", "time of day", "spatial anchors", "atmosphere", "environment continuity"],
    ignoreFor: ["character identity", "prop redesign", "storyboard panel layout", "camera override"],
    priority: 20,
    conflictRule: "Use scene baselines for environment continuity; do not let them override storyboard composition.",
  },
  character_identity: {
    role: "character_identity",
    useFor: ["face", "hairstyle", "hair length", "outfit silhouette", "body design", "identity continuity"],
    ignoreFor: ["scene geography", "camera path", "action timing", "prop redesign", "storyboard text"],
    priority: 30,
    conflictRule: "Character identity references win when storyboard placeholders show a different person, outfit, or silhouette.",
  },
  prop_reference: {
    role: "prop_reference",
    useFor: ["object appearance", "shape", "scale", "material cues", "hand placement", "readable interaction"],
    ignoreFor: [
      "character identity",
      "scene layout",
      "camera path",
      "panel layout",
      "shot composition",
      "motion planning",
      "shot timing",
      "independent video beat",
      "background or catalog-image framing",
    ],
    priority: 40,
    conflictRule: "Use prop references for object appearance and interaction only; never render a prop reference image as its own shot or background frame.",
  },
  dialogue_audio: {
    role: "dialogue_audio",
    useFor: ["dialogue timing", "performance rhythm", "mouth movement timing"],
    ignoreFor: ["visual identity", "scene design", "prop design", "music or BGM instruction"],
    priority: 50,
    conflictRule: "Audio is timing and performance reference only; it must not add music or visual design authority.",
  },
  final_color_frame: {
    role: "final_color_frame",
    useFor: ["review evidence only"],
    ignoreFor: ["storyboard generation input", "locked identity authority", "scene authority", "prop authority"],
    priority: 90,
    conflictRule: "Final color frames are outputs/review evidence and must not become upstream storyboard authority unless explicitly promoted.",
  },
};

export interface StoryboardReferenceAsset {
  id: string;
  role: StoryboardReferenceRole;
  path: string;
  label?: string;
  notes?: string[];
  roleBinding?: StoryboardReferenceRoleBinding;
}

export interface Image2StoryboardReferencePlanInput {
  shotId: string;
  shotTitle: string;
  shotDescription: string;
  camera: string;
  directorPlan?: StoryboardDirectorPlan;
  productionSkillPlan?: DirectorProductionSkillPlan;
  sceneBaseline?: StoryboardReferenceAsset;
  characterReferences?: StoryboardReferenceAsset[];
  propReferences?: StoryboardReferenceAsset[];
  characterGuidance?: string[];
  propGuidance?: string[];
  dialogue?: string;
  durationSeconds?: number;
  outputSize?: string;
}

export interface Image2StoryboardReferencePlan {
  schemaVersion: string;
  providerId: "lanyi-image2-responses-stream";
  operation: "image2.storyboard_reference";
  shotId: string;
  outputSize: string;
  prompt: string;
  references: StoryboardReferenceAsset[];
  referencePolicy: {
    allowedImage2Roles: Image2StoryboardAllowedReferenceRole[];
    forbiddenImage2Roles: Image2StoryboardForbiddenReferenceRole[];
    roleBindings: StoryboardReferenceRoleBinding[];
    strategyPackIds: string[];
    referenceDimensionRule: string;
    maxSceneBaselineImages: 1;
    characterAndPropReferencesDeferredToVideo: false;
    userFacingSummary: string;
  };
  warnings: string[];
}

export interface SeedanceStoryboardVideoPlanInput {
  shotId: string;
  prompt: string;
  directorPlan?: StoryboardDirectorPlan;
  storyboardReference?: StoryboardReferenceAsset;
  sceneBaseline?: StoryboardReferenceAsset;
  characterReferences?: StoryboardReferenceAsset[];
  propReferences?: StoryboardReferenceAsset[];
  dialogueAudio?: StoryboardReferenceAsset;
  dialogueTranscript?: string;
  outputDir: string;
  durationSeconds?: number;
  ratio?: string;
  videoResolution?: string;
  modelVersion?: string;
  shortPollSeconds?: number;
  cliPath?: string;
}

export interface SeedanceStoryboardVideoPlan {
  schemaVersion: string;
  providerId: "jimeng-video-cli";
  command: "multimodal2video";
  cliPath: string;
  args: string[];
  shotId: string;
  prompt: string;
  outputDir: string;
  durationSeconds: number;
  ratio: string;
  videoResolution: string;
  modelVersion: string;
  inputs: {
    images: StoryboardReferenceAsset[];
    audio: StoryboardReferenceAsset[];
  };
  referencePolicy: {
    inputOrder: SeedanceAllAroundReferenceRole[];
    storyboardReferenceRole: string;
    sceneBaselineRole: string;
    characterReferenceRole: string;
    propReferenceRole: string;
    dialogueAudioRole: string;
    roleBindings: StoryboardReferenceRoleBinding[];
    strategyPackIds: string[];
    referenceDimensionRule: string;
    maxConcurrentVideoJobs: 1;
    userFacingSummary: string;
  };
  queuePolicy: {
    providerAsync: true;
    initialPollSeconds: number;
    expectedQueueWaitMinutes: number;
    maxConcurrentVideoJobs: 1;
    resumeWithSubmitId: true;
    userMessage: string;
  };
  directorStrategy: {
    rhythmProfile: DirectorRhythmProfile;
    splitPolicy: DirectorSplitPolicy;
    guidance: string[];
    warnings: string[];
  };
}

export type StoryboardShotCountIntent =
  | "single_dominant_shot"
  | "two_beat_action_reaction"
  | "planned_cut_sequence";

export interface StoryboardDurationBudget {
  durationSeconds?: number;
  shotCountIntent: StoryboardShotCountIntent;
  maxVideoShots: 1 | 2 | 3;
  supportPanelLimit: 1 | 2 | 3;
  visualFocusLimit: 1 | 2 | 3;
  actionDensity?: DirectorActionDensity;
  splitPolicy?: DirectorSplitPolicy;
  guidance: string[];
  blockers: string[];
  warnings: string[];
}

export interface StoryboardDirectorSupportPanel {
  purpose: "hand_insert" | "eyeline" | "reaction" | "prop_detail" | "environment_motion";
  content: string;
}

export interface StoryboardTimingBeat {
  label: string;
  startSeconds?: number;
  endSeconds?: number;
  purpose: "start_state" | "primary_action" | "reaction" | "continuity" | "environment";
  content: string;
}

export interface StoryboardDirectorPlan {
  schemaVersion: "storyboard_director_plan_v1";
  shotId: string;
  shotTitle: string;
  creativeBrief?: CreativeBrief;
  rhythmProfile: DirectorRhythmProfile;
  rhythmReason: string;
  actionDensity: DirectorActionDensity;
  splitPolicy: DirectorSplitPolicy;
  durationBudget: StoryboardDurationBudget;
  mainComposition: {
    subject: string;
    startFrameAnchor: string;
    camera: string;
    screenDirection: string;
    foreground: string;
    midground: string;
    background: string;
    emotionalFocus: string;
  };
  primaryAction: string;
  actionTrigger?: string;
  microReaction?: string;
  supportPanels: StoryboardDirectorSupportPanel[];
  timingBeats: StoryboardTimingBeat[];
  seedanceAction: string;
}

function cleanLines(lines: Array<string | false | undefined>): string {
  return lines.filter((line): line is string => Boolean(line && line.trim())).join("\n");
}

function assetLabel(asset: StoryboardReferenceAsset | undefined): string {
  return asset?.label || asset?.id || "未命名参考";
}

export function roleBindingForStoryboardReferenceRole(role: StoryboardReferenceRole): StoryboardReferenceRoleBinding {
  return STORYBOARD_REFERENCE_ROLE_BINDINGS[role];
}

export function bindStoryboardReferenceAsset(asset: StoryboardReferenceAsset): StoryboardReferenceAsset {
  return {
    ...asset,
    roleBinding: {
      ...roleBindingForStoryboardReferenceRole(asset.role),
      ...asset.roleBinding,
      role: asset.role,
    },
  };
}

function bindStoryboardReferenceAssets(assets: StoryboardReferenceAsset[]): StoryboardReferenceAsset[] {
  return assets.map(bindStoryboardReferenceAsset);
}

function uniqueRoleBindings(assets: StoryboardReferenceAsset[]): StoryboardReferenceRoleBinding[] {
  const seen = new Set<string>();
  return assets.flatMap((asset) => {
    const binding = asset.roleBinding || roleBindingForStoryboardReferenceRole(asset.role);
    if (seen.has(binding.role)) return [];
    seen.add(binding.role);
    return [binding];
  });
}

function roleBindingPromptLines(assets: StoryboardReferenceAsset[]): string[] {
  const bindings = uniqueRoleBindings(assets);
  if (!bindings.length) return [];
  return [
    "Reference use/ignore bindings:",
    ...bindings.map((binding) => `- ${binding.role}: use for ${binding.useFor.join(", ")}; ignore ${binding.ignoreFor.join(", ")}.`),
  ];
}

function validateSceneBaseline(asset: StoryboardReferenceAsset | undefined): StoryboardReferenceAsset[] {
  if (!asset) return [];
  return asset.role === "scene_baseline" ? [bindStoryboardReferenceAsset(asset)] : [];
}

function validateReferenceAssets(
  assets: StoryboardReferenceAsset[] | undefined,
  role: Image2StoryboardAllowedReferenceRole,
): StoryboardReferenceAsset[] {
  return bindStoryboardReferenceAssets((assets || []).filter((asset) => asset.role === role));
}

function imageNumberRange(startIndex: number, count: number): string {
  if (count <= 0) return "";
  if (count === 1) return `Image ${startIndex}`;
  return `Images ${startIndex}-${startIndex + count - 1}`;
}

function safeDurationSeconds(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10) / 10 : undefined;
}

function actionDensity(text: string): number {
  return (String(text || "").match(/然后|随后|接着|同时|再|入画|走向|转身|递|接过|抬头|低头|停顿|看向|切|推近|拉远|then|while|turns|walks|hands|looks|cuts|push/gi) || []).length;
}

export function durationToStoryboardBudget(input: {
  durationSeconds?: number;
  executionMode?: string;
  actionText?: string;
  actionBeatCount?: number;
}): StoryboardDurationBudget {
  const durationSeconds = safeDurationSeconds(input.durationSeconds);
  const density = actionDensity(input.actionText || "");
  const actionBeatCount = Math.max(0, Math.floor(Number(input.actionBeatCount || 0)));
  const blockers: string[] = [];
  const warnings: string[] = [];
  const plannedCut = input.executionMode === "planned_cut_sequence";

  if (!durationSeconds) {
    warnings.push("duration_unknown");
    return {
      durationSeconds,
      shotCountIntent: plannedCut ? "planned_cut_sequence" : "single_dominant_shot",
      maxVideoShots: plannedCut ? 3 : 1,
      supportPanelLimit: plannedCut ? 3 : 1,
      visualFocusLimit: plannedCut ? 3 : 1,
      guidance: [
        "Duration budget is unknown. Build one large storyboard panel first; add only essential visual continuity panels.",
      ],
      blockers,
      warnings,
    };
  }

  if (durationSeconds <= 6) {
    if (plannedCut || density >= 5 || actionBeatCount > 3) blockers.push("duration_action_density_exceeded");
    return {
      durationSeconds,
      shotCountIntent: "single_dominant_shot",
      maxVideoShots: 1,
      supportPanelLimit: 2,
      visualFocusLimit: 1,
      guidance: [
        `${durationSeconds}s budget: one primary action, but present it with storyboard grammar: one large main panel plus one or two small continuity panels.`,
        "Small panels may clarify setup, hand detail, eyeline, or reaction; they must not add new story events.",
        "If the idea needs multiple real cuts or a long action chain, split it into separate shots before video generation.",
      ],
      blockers,
      warnings,
    };
  }

  if (durationSeconds <= 10) {
    if (density >= 7 || actionBeatCount > 5) blockers.push("duration_action_density_exceeded");
    return {
      durationSeconds,
      shotCountIntent: plannedCut ? "planned_cut_sequence" : "two_beat_action_reaction",
      maxVideoShots: plannedCut ? 3 : 1,
      supportPanelLimit: 2,
      visualFocusLimit: plannedCut ? 3 : 2,
      guidance: [
        `${durationSeconds}s budget: use a storyboard page with a large main panel and two or three connected panels for action/reaction.`,
        "For planned-cut sequences, the storyboard panel count is the visible cut contract; do not add extra provider-side cuts beyond the panels.",
        "Keep screen direction continuous. Do not turn small panels into a dense instruction manual.",
      ],
      blockers,
      warnings,
    };
  }

  return {
    durationSeconds,
    shotCountIntent: plannedCut || density >= 5 ? "planned_cut_sequence" : "two_beat_action_reaction",
    maxVideoShots: plannedCut || density >= 5 ? 3 : 2,
    supportPanelLimit: plannedCut || density >= 5 ? 3 : 2,
    visualFocusLimit: plannedCut || density >= 5 ? 3 : 2,
    guidance: [
      `${durationSeconds}s budget: a short planned sequence is allowed when one video task can express the action beats without changing scene authority or identity references.`,
      "Scene baselines may be reused across camera angles; storyboard references stay scoped to the current video task and timing contract.",
      "Use the storyboard as a composition anchor, while exact timing lives in the structured sidecar and video prompt.",
    ],
    blockers,
    warnings,
  };
}

function firstUseful(value: string | undefined, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function supportPanelPurpose(content: string): StoryboardDirectorSupportPanel["purpose"] {
  if (/手|递|接|拿|触|hand|grab|pass|hold/i.test(content)) return "hand_insert";
  if (/视线|眼神|看|抬眼|低头|eyeline|look|glance/i.test(content)) return "eyeline";
  if (/反应|停顿|犹豫|微笑|呼吸|reaction|pause|hesitat|breath|smile/i.test(content)) return "reaction";
  if (/风|雨|水|光|环境|weather|rain|wind|light/i.test(content)) return "environment_motion";
  return "prop_detail";
}

function timingPurposeForPanel(panel: StoryboardDirectorSupportPanel): StoryboardTimingBeat["purpose"] {
  if (panel.purpose === "reaction" || panel.purpose === "eyeline") return "reaction";
  if (panel.purpose === "environment_motion") return "environment";
  return "continuity";
}

function buildTimingBeats(input: {
  durationBudget: StoryboardDurationBudget;
  primaryAction: string;
  actionTrigger?: string;
  microReaction?: string;
  supportPanels: StoryboardDirectorSupportPanel[];
}): StoryboardTimingBeat[] {
  const duration = input.durationBudget.durationSeconds;
  const segmentCount = Math.max(1, input.durationBudget.maxVideoShots);
  const rawContentSeeds = [
    {
      purpose: "start_state" as const,
      content: input.actionTrigger
        ? `起势/触发：${input.actionTrigger}`
        : `起势：${input.primaryAction} 开始前一拍`,
    },
    {
      purpose: "primary_action" as const,
      content: `主动作：${input.primaryAction}`,
    },
    ...input.supportPanels.map((panel) => ({
      purpose: timingPurposeForPanel(panel),
      content: panel.content,
    })),
    input.microReaction
      ? {
          purpose: "reaction" as const,
      content: `微反应/收束：${input.microReaction}`,
    }
      : undefined,
  ].filter((item): item is { purpose: StoryboardTimingBeat["purpose"]; content: string } => Boolean(item?.content?.trim()));
  const seenContent = new Set<string>();
  const contentSeeds = rawContentSeeds.filter((item) => {
    const normalized = item.content.replace(/\s+/g, " ").trim();
    if (seenContent.has(normalized)) return false;
    seenContent.add(normalized);
    return true;
  });

  if (!duration) {
    return contentSeeds.slice(0, segmentCount).map((item, index) => ({
      label: `Beat ${String(index + 1).padStart(2, "0")}`,
      purpose: item.purpose,
      content: item.content,
    }));
  }

  const segmentDuration = duration / segmentCount;
  return Array.from({ length: segmentCount }, (_, index) => {
    const startSeconds = Math.round(index * segmentDuration * 10) / 10;
    const endSeconds = index === segmentCount - 1
      ? duration
      : Math.round((index + 1) * segmentDuration * 10) / 10;
    const item = contentSeeds[Math.min(index, contentSeeds.length - 1)] || contentSeeds[0] || {
      purpose: "primary_action" as const,
      content: `主动作推进：${input.primaryAction}`,
    };
    return {
      label: `Beat ${String(index + 1).padStart(2, "0")}`,
      startSeconds,
      endSeconds,
      purpose: item.purpose,
      content: item.content,
    };
  });
}

function formatTimingSeconds(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "--";
}

function formatTimingBeat(beat: StoryboardTimingBeat): string {
  const range = beat.startSeconds !== undefined || beat.endSeconds !== undefined
    ? `${formatTimingSeconds(beat.startSeconds)}-${formatTimingSeconds(beat.endSeconds)}s`
    : "time TBD";
  return `${beat.label} ${range}: ${beat.content}`;
}

function storyboardPanelTimingLines(
  plan: StoryboardDirectorPlan,
  panelCount: number,
  options: { visibleTimingLabels: boolean },
): string[] {
  const duration = plan.durationBudget.durationSeconds;
  if (!duration) {
    return [
      "[PANEL TIMING MAP]",
      `Panel count target: ${panelCount}. Duration unknown; keep one dominant main panel and only essential continuity panels.`,
      options.visibleTimingLabels
        ? "Visible timing labels are allowed in rough previs mode: place a tiny hand-written time range in each panel corner only when it helps sequencing."
        : "This timing map is a planning sidecar. Do not print timecodes inside the image; keep timing in this prompt/sidecar so video generation will not copy text artifacts.",
    ];
  }
  const safePanelCount = Math.max(1, panelCount);
  const segmentDuration = duration / safePanelCount;
  const contentSeeds = [
    `start-frame anchor: ${plan.mainComposition.startFrameAnchor}`,
    `primary action setup: ${plan.primaryAction}`,
    ...plan.supportPanels.map((panel) => `${panel.purpose}: ${panel.content}`),
    plan.microReaction ? `micro-reaction: ${plan.microReaction}` : undefined,
  ].filter((item): item is string => Boolean(item && item.trim()));
  return [
    "[PANEL TIMING MAP]",
    `Total duration: ${duration}s. Target storyboard panels: ${safePanelCount}.`,
    ...Array.from({ length: safePanelCount }, (_, index) => {
      const start = Math.round(index * segmentDuration * 10) / 10;
      const end = index === safePanelCount - 1 ? duration : Math.round((index + 1) * segmentDuration * 10) / 10;
      const content = contentSeeds[Math.min(index, contentSeeds.length - 1)] || plan.primaryAction;
      return `Panel ${String(index + 1).padStart(2, "0")} / ${start.toFixed(1)}-${end.toFixed(1)}s: ${content}`;
    }),
    options.visibleTimingLabels
      ? "Visible timing labels are allowed in rough previs mode: place a tiny hand-written time range in the corner of each panel, for example 0:00-0:03. Keep timing labels outside faces, hands, props, and body silhouettes. These labels are production notes only; Seedance must ignore them in final video."
      : "This timing map is a planning sidecar. Do not print timecodes inside the image; keep timing in this prompt/sidecar so video generation will not copy text artifacts.",
  ];
}

function buildStartFrameAnchor(input: {
  frameDescription: string;
  primaryAction: string;
  actionTrigger?: string;
}): string {
  return cleanLines([
    input.actionTrigger
      ? `Start from the trigger moment: ${input.actionTrigger}.`
      : "Start from the quiet anticipation moment immediately before the action begins.",
    `Characters, hands, gaze, and props are prepared for "${input.primaryAction}", but the action has not reached contact, transfer, impact, reveal, or emotional payoff yet.`,
    "The start-frame panel should feel like frame 0 of the video: readable, balanced, and ready to move on the next frame.",
    `Scene setup to preserve: ${input.frameDescription}`,
  ]);
}

export function buildStoryboardDirectorPlan(input: {
  shotId: string;
  shotTitle: string;
  durationSeconds?: number;
  executionMode?: string;
  creativeBrief?: CreativeBrief;
  userPreference?: string;
  rhythmPlan?: DirectorRhythmPlan;
  camera: string;
  frameDescription: string;
  actionBeats?: string[];
  primaryAction?: string;
  actionTrigger?: string;
  microReaction?: string;
  actorAction?: string;
  reactorResponse?: string;
}): StoryboardDirectorPlan {
  const actionText = [
    input.primaryAction,
    input.actionTrigger,
    input.microReaction,
    ...(input.actionBeats || []),
    input.frameDescription,
  ].filter(Boolean).join(" ");
  const durationBudget = durationToStoryboardBudget({
    durationSeconds: input.durationSeconds,
    executionMode: input.executionMode,
    actionText,
    actionBeatCount: input.actionBeats?.length || 0,
  });
  const rhythmPlan = input.rhythmPlan || planDirectorRhythm({
    scriptText: input.frameDescription,
    shotText: actionText,
    userPreference: input.userPreference,
    creativeBrief: input.creativeBrief,
    durationSeconds: input.durationSeconds,
  });
  durationBudget.actionDensity = rhythmPlan.actionDensity;
  durationBudget.splitPolicy = rhythmPlan.splitPolicy;
  const primaryAction = firstUseful(input.primaryAction, input.actionBeats?.[0] || input.frameDescription);
  const startFrameAnchor = buildStartFrameAnchor({
    frameDescription: input.frameDescription,
    primaryAction,
    actionTrigger: input.actionTrigger,
  });
  const candidates = [
    input.actorAction && input.actorAction !== primaryAction ? input.actorAction : primaryAction,
    input.reactorResponse,
    input.microReaction,
    ...(input.actionBeats || []).filter((beat) => beat !== primaryAction),
  ].filter((item): item is string => Boolean(item && item.trim()));
  const supportPanels = candidates
    .slice(0, durationBudget.supportPanelLimit)
    .map((content) => ({ purpose: supportPanelPurpose(content), content }));
  const timingBeats = buildTimingBeats({
    durationBudget,
    primaryAction,
    actionTrigger: input.actionTrigger,
    microReaction: input.microReaction,
    supportPanels,
  });
  const seedanceAction = cleanLines([
    `Start frame anchor: ${startFrameAnchor}`,
    `Primary action: ${primaryAction}`,
    input.actionTrigger ? `Trigger: ${input.actionTrigger}` : undefined,
    input.microReaction ? `Micro-reaction: ${input.microReaction}` : undefined,
    input.actorAction ? `Actor action: ${input.actorAction}` : undefined,
    input.reactorResponse ? `Reactor response: ${input.reactorResponse}` : undefined,
  ]);

  return {
    schemaVersion: "storyboard_director_plan_v1",
    shotId: input.shotId,
    shotTitle: input.shotTitle,
    creativeBrief: input.creativeBrief,
    rhythmProfile: rhythmPlan.rhythmProfile,
    rhythmReason: rhythmPlan.rhythmReason,
    actionDensity: rhythmPlan.actionDensity,
    splitPolicy: rhythmPlan.splitPolicy,
    durationBudget,
    mainComposition: {
      subject: startFrameAnchor,
      startFrameAnchor,
      camera: input.camera,
      screenDirection: "Keep a stable screen-left/screen-right axis and readable eyelines.",
      foreground: "Use one simple foreground layer only if it clarifies camera placement.",
      midground: "Place the acting characters and key prop in the midground as the start-frame setup before the primary action peaks.",
      background: "Keep scene/weather anchors visible without crowding the action.",
      emotionalFocus: firstUseful(input.microReaction, "Make the emotional read visible through posture, eyeline, and a small facial reaction."),
    },
    primaryAction,
    actionTrigger: input.actionTrigger,
    microReaction: input.microReaction,
    supportPanels,
    timingBeats,
    seedanceAction,
  };
}

function estimateSeedanceAllAroundDurationSeconds(prompt: string | undefined): number {
  const text = typeof prompt === "string" ? prompt : "";
  const markerCount = (text.match(/依次|然后|随后|接着|入画|进入|推门|走向|转身|握紧|眼线|对望|插入|反应|横移|推进|follow-up|reaction|insert|enters|walks|turns|push-in|lateral/gi) || []).length;
  if (markerCount >= 6) return 12;
  if (markerCount >= 3) return 8;
  return JIMENG_CLI_DEFAULT_DURATION_SECONDS;
}

function seedanceAllAroundDurationSeconds(input: { durationSeconds?: number; prompt?: string }): number {
  const fallback = estimateSeedanceAllAroundDurationSeconds(input.prompt);
  return clampJimengDurationSeconds(input.durationSeconds, fallback);
}

function storyboardDensityGuidance(plan: StoryboardDirectorPlan): string[] {
  return [
    ...plan.durationBudget.guidance,
    `Shot intent: ${plan.durationBudget.shotCountIntent}; max video shots ${plan.durationBudget.maxVideoShots}; small continuity panels ${plan.durationBudget.supportPanelLimit}.`,
    `Rhythm profile: ${plan.rhythmProfile}; action density ${plan.actionDensity}; split policy ${plan.splitPolicy}.`,
    `Director rhythm reason: ${plan.rhythmReason}`,
  ];
}

interface RhythmStoryboardGrammar {
  image2Layout: string;
  image2VisualRules: string[];
  seedanceMotion: string[];
}

const RHYTHM_STORYBOARD_GRAMMAR: Record<DirectorRhythmProfile, RhythmStoryboardGrammar> = {
  quiet_dialogue: {
    image2Layout: "Quiet dialogue storyboard grammar: one held two-person or over-shoulder main panel; one small eyeline/reaction panel only if it clarifies the pause. Keep cuts invisible and let posture, distance, and silence carry the beat.",
    image2VisualRules: [
      "Favor stable eye lines, negative space, small mouth/hand changes, and a clear listening reaction.",
      "Avoid action-comic speed lines, impact panels, or a busy multi-cut page.",
    ],
    seedanceMotion: [
      "Quiet dialogue rhythm: hold the shot, use restrained breathing, tiny gaze shifts, and natural listening pauses.",
      "Do not invent rapid cutting, punch-in edits, or extra action beats. Let the camera drift slowly or stay still.",
    ],
  },
  anime_emotion: {
    image2Layout: "Anime emotion storyboard grammar: main relationship frame plus selective insert close-ups for eyes, hands, or the prop, then a reaction panel. The page should feel like emotional timing, not a dense comic grid.",
    image2VisualRules: [
      "Make character relationship and screen direction obvious before close-ups.",
      "Use one insert close-up and one reaction cue at most when the duration is short.",
    ],
    seedanceMotion: [
      "Anime emotion rhythm: protect the relationship shot, then allow an insert close-up and a reaction beat if the duration supports it.",
      "Emphasize eye movement, hand tension, delayed breath, and the other character's response over literal plot explanation.",
    ],
  },
  action_fast_cut: {
    image2Layout: "Action fast-cut storyboard grammar: a strong start-frame main panel plus two or three clear short cut-point panels for setup, motion direction, and reaction/impact preparation. Keep each panel simple and directional.",
    image2VisualRules: [
      "Clarify direction through staging, body orientation, prop displacement, screen position, and panel order; do not draw arrows, dotted eyeline guides, impact glyphs, or written labels.",
      "Do not turn the page into a dense action manga spread; each small panel must be a clean video cut point.",
    ],
    seedanceMotion: [
      "Action fast-cut rhythm: short in-clip cuts are allowed when each cut point is explicit, directional, and shares the same video-task reference bundle.",
      "Use clear beats such as setup, burst movement, contact preparation, and reaction. Avoid one continuous muddled action chain.",
    ],
  },
  comedy_reaction: {
    image2Layout: "Comedy reaction storyboard grammar: setup frame, pause/blank beat, then contrast reaction. Keep the staging readable and leave visual space for the timing gap.",
    image2VisualRules: [
      "Show the joke through pose, delayed eye contact, awkward spacing, or a clean reaction face.",
      "Avoid overexplaining with text, symbols, or too many tiny panels.",
    ],
    seedanceMotion: [
      "Comedy rhythm: protect setup, pause, and contrast. Leave a visible beat before the reaction lands.",
      "Do not rush the reaction or add unrelated slapstick. The timing gap is the joke.",
    ],
  },
  suspense_pressure: {
    image2Layout: "Suspense pressure storyboard grammar: obstructed main composition with foreground occlusion, delayed reveal, and one environmental detail or following-angle panel. The page should create pressure by withholding information.",
    image2VisualRules: [
      "Use shadows, partial silhouettes, doorframes, reflections, or blocked sight lines as visual pressure.",
      "Avoid clean explanatory coverage or a full reveal in the main panel.",
    ],
    seedanceMotion: [
      "Suspense rhythm: use occlusion, delayed following movement, slow reveal, and environmental sound space.",
      "Do not cut randomly or reveal the threat too early. Let footsteps, room tone, breath, or object noise carry tension without BGM.",
    ],
  },
  commercial_short: {
    image2Layout: "Commercial short storyboard grammar: one instantly readable hero/product action frame plus one or two clean benefit/action panels. Make the information hierarchy obvious without text.",
    image2VisualRules: [
      "Put product, gesture, or visual selling point in the first read; keep faces and props clean.",
      "No slogans, UI captions, price tags, bullet points, or label-like copy inside the image.",
    ],
    seedanceMotion: [
      "Commercial short rhythm: make the product/action point readable immediately, then show one clean use or result beat.",
      "Keep it information-forward but wordless: no on-screen text, no slogans, no subtitles, no BGM.",
    ],
  },
  emotion_montage: {
    image2Layout: "Emotion montage storyboard grammar: a loose sequence of two or three memory/emotion fragments connected by gaze, object, or light. Keep it airy and non-tabular.",
    image2VisualRules: [
      "Use repeated visual motifs, lighting shifts, or matching hand/object positions to connect fragments.",
      "Avoid a production table, timeline infographic, or equal-size grid.",
    ],
    seedanceMotion: [
      "Emotion montage rhythm: allow a small sequence of lyrical fragments when they share one emotional motif.",
      "Cuts should feel like memory or feeling, not a checklist of plot events. Keep transitions soft and readable.",
    ],
  },
  lyrical_observation: {
    image2Layout: "Lyrical observation storyboard grammar: one spacious environmental main panel with the character held inside the scene, plus at most one detail panel for wind, rain, light, or a small gesture.",
    image2VisualRules: [
      "Let environment, weather, distance, and posture do most of the storytelling.",
      "Avoid fast cutting, comic emphasis marks, or busy explanatory coverage.",
    ],
    seedanceMotion: [
      "Lyrical observation rhythm: slow, observant movement; hold space, weather, posture, and tiny gestures.",
      "Do not overcut or chase plot beats. Let the shot breathe.",
    ],
  },
};

function rhythmStoryboardGrammar(profile: DirectorRhythmProfile): RhythmStoryboardGrammar {
  return RHYTHM_STORYBOARD_GRAMMAR[profile] || RHYTHM_STORYBOARD_GRAMMAR.lyrical_observation;
}

function seedanceSplitGuidance(plan: StoryboardDirectorPlan | undefined): { guidance: string[]; warnings: string[] } {
  if (!plan) {
    return {
      guidance: ["No rhythm plan was provided; keep one dominant video action unless the prompt explicitly asks for a planned cut sequence."],
      warnings: [],
    };
  }
  const guidance = [
    `Rhythm profile ${plan.rhythmProfile}: ${plan.rhythmReason}`,
    `Split policy ${plan.splitPolicy}; action density ${plan.actionDensity}.`,
  ];
  const warnings: string[] = [];

  if (plan.splitPolicy === "split_for_action") {
    guidance.push("Human review guidance: split_into_micro_shots is recommended when the shot contains more than one full action beat.");
    warnings.push("split_into_micro_shots: prepare separate Seedance submissions if the provider cannot keep the short cut points clean inside one clip.");
  } else if (plan.splitPolicy === "split_for_reaction") {
    guidance.push("Human review guidance: allow_in_clip_cuts for action-to-reaction timing only; keep the emotional axis stable.");
    warnings.push("allow_in_clip_cuts: reaction cuts are timing guidance, not permission to add unrelated new shots.");
  } else if (plan.splitPolicy === "montage_sequence") {
    guidance.push("Human review guidance: split_into_micro_shots may be cleaner for montage fragments if each fragment needs its own locked reference.");
    warnings.push("split_into_micro_shots: montage fragments can drift if submitted as one crowded provider prompt.");
  } else {
    guidance.push("Human review guidance: hold_single_shot; do not split unless the user explicitly asks for a separate micro-shot.");
  }

  if (plan.durationBudget.blockers.length) {
    warnings.push(`planning_blocker: ${plan.durationBudget.blockers.join(", ")}.`);
  }

  return { guidance, warnings };
}

function seedanceTimingPlanLines(plan: StoryboardDirectorPlan | undefined, durationSeconds: number): string[] {
  if (!plan) {
    return [
      "[TIMING PLAN]",
      `00:00-${durationSeconds.toFixed(1)}s: keep one dominant video action unless the written shot direction explicitly asks for a cut.`,
      "Do not infer timing from text or numbers visible inside reference images.",
    ];
  }

  return [
    "[TIMING PLAN]",
    `Total duration: ${durationSeconds}s. Target visible video cuts: ${Math.max(1, plan.durationBudget.maxVideoShots)}.`,
    "The storyboard panel count and this timing beat count are binding. The final video must not create extra visible cuts beyond the listed beats.",
    "Details such as feet, puddles, hands, props, eyelines, and reactions must stay inside their assigned beat unless they are listed as their own timing beat.",
    ...plan.timingBeats.map(formatTimingBeat),
    "If the storyboard page contains more panels than this timing plan can support, merge extra panels internally and preserve only the listed timing beats.",
    "Use this written timing plan as the timing authority. If the storyboard image includes panel time labels, treat them only as production timing notes and never render text, numbers, or timing marks into the final video.",
  ];
}

function propReferenceSafetyLines(propReferences: StoryboardReferenceAsset[]): string[] {
  if (!propReferences.length) return [];
  return [
    "Prop reference isolation:",
    "- Prop reference images are object sheets only, even if they look like a finished frame, insert shot, catalog image, or storyboard panel.",
    "- Never render a prop reference image as a standalone cutaway, split-screen, picture-in-picture, background, panel, or separate video beat.",
    "- Use only object shape, scale, material cues, and hand interaction when the prop appears inside the storyboard-directed scene.",
    "- If the prop reference includes a white background, table surface, framing, labels, shadows, or surrounding scene, ignore all of that context.",
  ];
}

export function buildImage2StoryboardReferencePlan(
  input: Image2StoryboardReferencePlanInput,
): Image2StoryboardReferencePlan {
  const sceneReferences = validateSceneBaseline(input.sceneBaseline);
  const sceneBaseline = sceneReferences[0];
  const characterReferences = validateReferenceAssets(input.characterReferences, "character_identity");
  const propReferences = validateReferenceAssets(input.propReferences, "prop_reference");
  const references = [
    ...sceneReferences,
    ...characterReferences,
    ...propReferences,
  ];
  const hasSceneBaseline = sceneReferences.length > 0;
  const firstCharacterImageIndex = sceneReferences.length + 1;
  const firstPropImageIndex = firstCharacterImageIndex + characterReferences.length;
  const durationSeconds = safeDurationSeconds(input.durationSeconds);
  const directorPlan = input.directorPlan || buildStoryboardDirectorPlan({
    shotId: input.shotId,
    shotTitle: input.shotTitle,
    durationSeconds,
    camera: input.camera,
    frameDescription: input.shotDescription,
    primaryAction: input.shotDescription,
  });
  const rhythmGrammar = rhythmStoryboardGrammar(directorPlan.rhythmProfile);
  const productionSkillPlan = input.productionSkillPlan;
  const image2Mode = productionSkillPlan?.image2Directive.mode;
  const allowProductionAnnotations = productionSkillPlan?.image2Directive.allowProductionAnnotations === true;
  const isOmniReferenceMode = image2Mode === "none";
  const isRapidCutStoryboard = image2Mode === "rapid_cut_storyboard";
  const outputSize = "1280x720";
  const durationSafePanelCount =
    directorPlan.durationBudget.durationSeconds && directorPlan.durationBudget.durationSeconds <= 10
      ? Math.min(productionSkillPlan?.panelCountIntent || directorPlan.durationBudget.supportPanelLimit + 1, directorPlan.durationBudget.supportPanelLimit + 1)
      : productionSkillPlan?.panelCountIntent || directorPlan.durationBudget.supportPanelLimit + 1;
  const productionSkillPromptLines = productionSkillPlan
    ? [
        `Internal production skill: ${productionSkillPlan.strategyId} / ${productionSkillPlan.strategyLabel}.`,
        `Image2 mode: ${productionSkillPlan.image2Directive.mode}.`,
        `Image2 role: ${productionSkillPlan.image2Directive.promptRole}`,
        `Duration logic: ${productionSkillPlan.durationGuidance}`,
        ...productionSkillPlan.reasons.map((reason) => `Routing reason: ${reason}`),
        ...productionSkillPlan.image2Directive.guidance.map((item) => `Skill guidance: ${item}`),
      ]
    : [];
  const warnings = [
    !hasSceneBaseline ? "No scene baseline image was provided; weather and location consistency will rely on text only." : "",
    input.sceneBaseline && input.sceneBaseline.role !== "scene_baseline"
      ? `Ignored non-scene storyboard reference role: ${input.sceneBaseline.role}`
      : "",
    ...(input.characterReferences || [])
      .filter((asset) => asset.role !== "character_identity")
      .map((asset) => `Ignored non-character storyboard reference role: ${asset.role}`),
    ...(input.propReferences || [])
      .filter((asset) => asset.role !== "prop_reference")
      .map((asset) => `Ignored non-prop storyboard reference role: ${asset.role}`),
  ].filter(Boolean);

	  const prompt = cleanLines([
			    isOmniReferenceMode
			      ? "Do not generate an image for this omni-reference shot. This plan is a contract guard only; the video stage should use locked assets and written direction."
			      : allowProductionAnnotations
			        ? "Create one rough cinematic storyboard planning sheet in 16:9 for a short film sequence, focused on planning, staging, timing, camera rhythm, and motion readability rather than illustration quality."
			        : "Create one professional black-and-white Japanese anime storyboard page in 16:9 for a short film shot.",
		        isOmniReferenceMode
		          ? undefined
		          : "Use a unified 16:9 storyboard canvas for readability inside the app. The final video ratio is controlled later by the Seedance video request, not by this storyboard canvas.",
	    isOmniReferenceMode
	      ? "If this prompt reaches Image2, stop: omni_reference does not need a storyboard, single start frame, comic grid, proposal board, poster, or production form."
	      : allowProductionAnnotations
	        ? "It must read as rough animation/storyboard previs focused on staging, timing, motion readability, and camera planning rather than illustration finish."
	        : "It must visibly read as a storyboard page, not a single keyframe, poster, concept art sheet, or proposal board.",
	    isOmniReferenceMode
	      ? "Omni-reference mode uses scene, character, prop and optional dialogue references directly in Seedance. No Image2 storyboard asset should be submitted."
	      : "This storyboard is for composition, blocking, action beats, camera movement, and video reference, not final color art.",
		    isOmniReferenceMode
		      ? "Storyboard layout: none."
		      : allowProductionAnnotations
		        ? `Storyboard layout: use about ${durationSafePanelCount} readable rough panels. Each panel must carry one clear action/camera beat. Panel shapes may be long, narrow, large, or small when it improves motion readability and information density.`
		        : "Storyboard layout: one large main storyboard panel should occupy about 55-65% of the sheet and carry the first-read composition. Smaller continuity panels may use flexible shapes when that makes the action or detail easier to read.",
	    "The start-frame anchor for video generation must show the poised moment immediately before the primary action begins, not the completed action, contact point, transfer, impact, reveal, or emotional payoff.",
	    isOmniReferenceMode ? undefined : rhythmGrammar.image2Layout,
	    ...(isOmniReferenceMode ? [] : rhythmGrammar.image2VisualRules),
	    isOmniReferenceMode
	      ? undefined
	      : allowProductionAnnotations
	        ? "Do not polish the drawing. Use loose pencil/ink strokes, broken lines, visible construction, simplified masses, low-to-medium detail, strong silhouettes, and semi-mannequin characters where useful."
	        : `Add ${directorPlan.durationBudget.supportPanelLimit === 1 ? "one small continuity panel" : `one to ${directorPlan.durationBudget.supportPanelLimit} small continuity panels`} below or beside the main panel for the first motion, hand detail, eyeline, reaction, or environmental motion only.`,
	    isOmniReferenceMode ? undefined : "Do not force a fixed number of small panels beyond what the duration and action actually need.",
	    isOmniReferenceMode ? undefined : "The page needs clean panel borders and readable cinematic sequencing. Panel order should read naturally left-to-right or top-to-bottom.",
	    !isOmniReferenceMode && allowProductionAnnotations
	      ? "Production annotation mode: hand-drawn arrows, motion paths, camera marks, panel numbers, tiny panel time ranges, and brief functional shot notes are allowed because this image is a previs reference. Keep marks readable and sparse; do not cover face direction, hand contact, fan/prop silhouettes, body line, or key scene axis."
	      : isOmniReferenceMode
	        ? undefined
	        : "Provider-safe storyboard rule: no arrows, no dotted eyeline guides, no camera arrows, no motion arrows, no circled panel numbers, no labels, no timing marks, no rulers, and no UI marks. Communicate direction through staging, gaze, body orientation, prop position, and panel order only.",
	    !isOmniReferenceMode && allowProductionAnnotations
	      ? "Use the production annotation color key only when useful: RED=camera, BLUE=body movement, GREEN=prop/cloth/environment/motion-system path, ORANGE=impact/burst/danger, PURPLE=timing/pause/acceleration."
	      : undefined,
    "Do not draw a storyboard form template. No PROJECT/SCENE/SHOT/DURATION/PAGE header, no production form fields, and no UI panels.",
	    isOmniReferenceMode
	      ? "Do not make a commercial proposal board, dense table, caption sheet, or tutorial diagram."
	      : allowProductionAnnotations
        ? "Do not make a polished manga page, finished concept-art sheet, commercial proposal board, dense table, caption sheet, tutorial diagram, poster collage, or UI mockup."
        : "Do not make an equal-size comic grid. Do not make a commercial proposal board, UI mockup, dense table, caption sheet, or tutorial diagram.",
	    !isOmniReferenceMode && allowProductionAnnotations
      ? "Avoid texture rendering, material rendering, finished lighting, clothing-fold decoration, glossy polish, decorative linework, and production illustration finish. The page should feel like rough sakuga planning thumbnails, key animation boards, action timing sheets, or first-pass previs notes."
      : undefined,
	    !isOmniReferenceMode && allowProductionAnnotations
      ? "This image is a planning reference. Panel numbers, short shot notes, and colored production marks are allowed, but no dialogue subtitles, logos, watermarks, UI overlays, speech bubbles, or decorative typography."
      : "This image is meant to be used directly as a video reference. Avoid all legible written words, English labels, Chinese labels, tables, captions, dialogue, subtitles, arrows, dotted guide lines, numbered badges, and UI-like symbols. Use visual staging instead of written notes.",
    "Character identity safety: use locked character references while drawing the storyboard. Do not invent a different hairstyle, hair length, bow/ribbon, outfit silhouette, body type, or face category that would conflict with those references.",
    "Reference dimension locking: each uploaded reference locks only its assigned dimension. The scene baseline locks environment, weather, time of day, and spatial anchors; character references lock identity and silhouette; prop references lock object appearance and hand interaction. Do not blend all references into a new hybrid style board.",
    "",
    ...productionSkillPromptLines,
    productionSkillPromptLines.length ? "" : undefined,
    hasSceneBaseline
      ? `Use Image 1 as the scene baseline: preserve the location, weather, time of day, spatial anchors, and atmosphere from "${assetLabel(sceneBaseline)}".`
      : "Use the written scene facts to anchor location, weather, time of day, spatial anchors, and atmosphere.",
    hasSceneBaseline
      ? "Translate the scene into clean grayscale storyboard language; do not copy final color rendering literally."
      : undefined,
    characterReferences.length
      ? `${imageNumberRange(firstCharacterImageIndex, characterReferences.length)} ${characterReferences.length > 1 ? "are" : "is"} locked character reference${characterReferences.length > 1 ? "s" : ""}. Use them for hair length, bow/ribbon, outfit silhouette, age impression, body shape, and identity continuity while simplifying into storyboard line art.`
      : "No locked character image is attached; use only text guidance for temporary character placeholders.",
    propReferences.length
      ? `${imageNumberRange(firstPropImageIndex, propReferences.length)} ${propReferences.length > 1 ? "are" : "is"} locked prop reference${propReferences.length > 1 ? "s" : ""}. Keep important prop shape, scale, and hand placement readable in the storyboard.`
      : "No locked prop image is attached; use only text guidance for prop placeholders.",
    "",
    ...propReferenceSafetyLines(propReferences),
    propReferences.length ? "" : undefined,
    ...roleBindingPromptLines(references),
    "",
    `Shot: ${input.shotTitle}`,
    `Shot id: ${input.shotId}`,
    ...storyboardDensityGuidance(directorPlan),
	    ...storyboardPanelTimingLines(directorPlan, durationSafePanelCount, {
	      visibleTimingLabels: !isOmniReferenceMode && allowProductionAnnotations,
	    }),
    directorPlan.durationBudget.blockers.length
      ? `Storyboard planning blocker: ${directorPlan.durationBudget.blockers.join(", ")}. Simplify the image to the primary action and do not draw every beat.`
      : undefined,
    `Camera and movement: ${input.camera}`,
    "Dominant main composition:",
    `- Subject: ${directorPlan.mainComposition.subject}`,
    `- Start-frame anchor: ${directorPlan.mainComposition.startFrameAnchor}`,
    `- Camera: ${directorPlan.mainComposition.camera}`,
    `- Screen direction: ${directorPlan.mainComposition.screenDirection}`,
    `- Foreground: ${directorPlan.mainComposition.foreground}`,
    `- Midground: ${directorPlan.mainComposition.midground}`,
    `- Background: ${directorPlan.mainComposition.background}`,
    `- Emotional focus: ${directorPlan.mainComposition.emotionalFocus}`,
    `Primary action after the start frame: ${directorPlan.primaryAction}`,
    directorPlan.actionTrigger ? `Trigger: ${directorPlan.actionTrigger}` : undefined,
    directorPlan.microReaction ? `Micro-reaction: ${directorPlan.microReaction}` : undefined,
	    !isOmniReferenceMode && directorPlan.supportPanels.length
      ? [
          "Small continuity panels:",
          ...directorPlan.supportPanels.map((panel) => `- ${panel.purpose}: ${panel.content}`),
        ].join("\n")
	      : "Small continuity panels: none unless visually necessary.",
    input.shotDescription ? `Additional drawable notes: ${input.shotDescription}` : undefined,
    ...(input.characterGuidance?.length
      ? [
          "Character guidance for storyboard drawing:",
          ...input.characterGuidance.map((item) => `- ${item}`),
          characterReferences.length
            ? "These notes must support the locked character references, not override them."
            : "These are temporary text-only constraints; generate a simple placeholder and avoid over-specific random redesigns.",
        ]
      : []),
    ...(input.propGuidance?.length
      ? [
          "Prop guidance for storyboard drawing:",
          ...input.propGuidance.map((item) => `- ${item}`),
          propReferences.length
            ? "These notes must support the locked prop references, not override them."
            : "These are temporary text-only constraints; keep the prop simple and readable.",
        ]
      : []),
    input.dialogue ? `Dialogue context for acting only: ${input.dialogue}` : undefined,
    "",
    "Multi-character blocking: use the main composition to lock screen-left/screen-right positions, foreground/background layers, and who looks toward whom. Keep the same 180-degree side and eyeline direction across supporting panels unless the shot explicitly includes a neutral camera transition. Use over-the-shoulder, reaction, insert, or hand/prop details without changing established positions.",
    "",
    "Visual constraints:",
	    isOmniReferenceMode
	      ? "- omni-reference guard: no Image2 storyboard output should be submitted"
	      : allowProductionAnnotations
      ? "- grayscale rough pencil and ink animation storyboard/previs, readable staging, strong silhouettes, clear body line, clear hands and props"
      : "- grayscale pencil and ink anime storyboard, clean readable anatomy, clear hands and props",
    "- no final color art, no photorealism, no glossy CG",
	    !isOmniReferenceMode && allowProductionAnnotations
      ? "- brief panel numbers, tiny panel timecodes/time ranges, short functional shot notes, rough arrows, colored motion paths, and production marks are allowed for previs; keep them sparse, functional, and visibly hand-drawn"
      : "- no dialogue text, no subtitles, no speech bubbles, no watermark, no readable production labels",
    "- no PROJECT/SCENE/SHOT/DURATION/PAGE header and no production form fields",
    allowProductionAnnotations
      ? "- no dense instruction board; time labels must be tiny per-panel production timing notes only, not a table, header, caption bar, UI overlay, or shot list"
      : "- no dense instruction board, no timecode printed inside the image",
	    isOmniReferenceMode
	      ? "- no storyboard image in this mode"
	      : allowProductionAnnotations
      ? "- do not make clean vector/UI arrows; use rough hand-drawn production marks only"
      : "- clean panel borders are acceptable, but do not draw circled numbers, arrows, dotted sight lines, motion arrows, impact glyphs, handwritten marks, or any other overlay symbols that Seedance could copy into the final video",
    "- make the scene/weather readable through environment shapes, puddles, sky tone, clothing movement, and staging",
  ]);

  return {
    schemaVersion: STORYBOARD_REFERENCE_PIPELINE_VERSION,
    providerId: "lanyi-image2-responses-stream",
    operation: "image2.storyboard_reference",
	    shotId: input.shotId,
	    outputSize,
    prompt,
    references,
    referencePolicy: {
      allowedImage2Roles: [...IMAGE2_STORYBOARD_ALLOWED_REFERENCE_ROLES],
      forbiddenImage2Roles: [...IMAGE2_STORYBOARD_FORBIDDEN_REFERENCE_ROLES],
      roleBindings: uniqueRoleBindings(references),
      strategyPackIds: [...STORYBOARD_REFERENCE_STRATEGY_PACK_IDS],
      referenceDimensionRule: "Scene, character, and prop references each lock one dimension; they must not be averaged into a hybrid style board.",
      maxSceneBaselineImages: 1,
      characterAndPropReferencesDeferredToVideo: false,
	      userFacingSummary: isOmniReferenceMode
	        ? "全能参考模式不生成额外分镜图：直接使用场景、角色、道具和可选对白音频参考，再用结构化提示词驱动视频。"
	        : isRapidCutStoryboard
	          ? "故事板快切使用已锁定场景、角色和道具参考：用粗分镜预演镜头切点、动作方向和节奏，并在视频阶段剥离所有标注。"
	          : "故事板叙事使用已锁定场景、角色和道具参考：主分镜格交代空间关系，小分镜格交代动作承接，并提前避免角色外观漂移。",
    },
    warnings: [...warnings, ...directorPlan.durationBudget.warnings, ...directorPlan.durationBudget.blockers],
  };
}

export function buildSeedanceStoryboardVideoPlan(input: SeedanceStoryboardVideoPlanInput): SeedanceStoryboardVideoPlan {
  const durationSeconds = seedanceAllAroundDurationSeconds(input);
  const modelVersion = input.modelVersion || JIMENG_CLI_DEFAULT_MODEL_VERSION;
  const videoResolution = normalizeJimengVideoResolution(input.videoResolution, modelVersion);
  const shortPollSeconds = input.shortPollSeconds || JIMENG_CLI_DEFAULT_SHORT_POLL_SECONDS;
  const cliPath = input.cliPath || JIMENG_CLI_DEFAULT_BINARY;
  const ratio = input.ratio || "16:9";
  const storyboardReference = input.storyboardReference ? bindStoryboardReferenceAsset(input.storyboardReference) : undefined;
  const sceneBaseline = input.sceneBaseline ? bindStoryboardReferenceAsset(input.sceneBaseline) : undefined;
  const characterReferences = bindStoryboardReferenceAssets(input.characterReferences || []);
  const propReferences = bindStoryboardReferenceAssets(input.propReferences || []);
  const dialogueAudio = input.dialogueAudio ? bindStoryboardReferenceAsset(input.dialogueAudio) : undefined;
  const images = [
    storyboardReference,
    sceneBaseline,
    ...characterReferences,
    ...propReferences,
  ].filter((asset): asset is StoryboardReferenceAsset => Boolean(asset));
  const audio = dialogueAudio ? [dialogueAudio] : [];
  const rhythmProfile = input.directorPlan?.rhythmProfile || "lyrical_observation";
  const splitPolicy = input.directorPlan?.splitPolicy || "hold_single_shot";
  const rhythmGrammar = rhythmStoryboardGrammar(rhythmProfile);
  const directorStrategy = {
    rhythmProfile,
    splitPolicy,
    ...seedanceSplitGuidance(input.directorPlan),
  };
  const storyboardImageIndex = storyboardReference ? 1 : undefined;
  const sceneImageIndex = sceneBaseline ? images.findIndex((image) => image.role === "scene_baseline") + 1 : undefined;
  const characterImageIndexes = images
    .map((image, index) => ({ image, index: index + 1 }))
    .filter((item) => item.image.role === "character_identity")
    .map((item) => item.index);
  const propImageIndexes = images
    .map((image, index) => ({ image, index: index + 1 }))
    .filter((item) => item.image.role === "prop_reference")
    .map((item) => item.index);

  const prompt = cleanLines([
    "Create the final color Japanese TV anime video shot using the uploaded all-around references.",
    `Duration budget: ${durationSeconds}s. Seedance all-around reference supports ${JIMENG_CLI_MIN_DURATION_SECONDS}-${JIMENG_CLI_MAX_DURATION_SECONDS}s.`,
    input.directorPlan
      ? `Director pacing: ${input.directorPlan.durationBudget.shotCountIntent}; max ${input.directorPlan.durationBudget.maxVideoShots} video shot${input.directorPlan.durationBudget.maxVideoShots > 1 ? "s" : ""}; one visual focus at a time.`
      : "Director pacing: prioritize the dominant storyboard frame and one primary action.",
    `Rhythm strategy: ${rhythmProfile}; split policy ${splitPolicy}.`,
    ...rhythmGrammar.seedanceMotion,
    input.directorPlan?.durationBudget.blockers.length
      ? `Planning blocker: ${input.directorPlan.durationBudget.blockers.join(", ")}. Do not execute a crowded beat list; keep only the primary action.`
      : undefined,
    "",
    "Reference roles:",
    storyboardReference
      ? `- Image ${storyboardImageIndex} is the black-and-white storyboard reference. Use it as a director's shot instruction and as choreography, timing, camera, framing, blocking, screen direction, eyeline, action-beat, and rough motion planning reference only.`
      : "- No storyboard reference image is attached. This is omni-reference mode: use locked scene, character, prop, optional dialogue audio, and the written shot direction only.",
    storyboardReference
      ? "- Follow the storyboard shot by shot internally when the timing plan allows multiple cuts. Preserve panel order and camera-rhythm progression, but do not render the storyboard page itself."
      : "- Do not invent a storyboard, panel grid, extra cut list, or first-frame image. Keep the shot count from the written timing plan and prompt.",
    storyboardReference
      ? "- The storyboard panel count is a hard visible-cut budget. Do not invent extra cuts from detail words such as footsteps, puddles, hands, props, reaction, or continued motion."
      : "- Without a storyboard: Do not invent extra cuts from detail words such as footsteps, hands, props, reaction, or continued motion.",
    storyboardReference
      ? `- If Image ${storyboardImageIndex} contains production annotation colors, interpret them internally only: RED=camera/lens/framing/camera move, BLUE=body movement/path/turn, GREEN=prop/cloth/environment/motion-system path, ORANGE=impact/burst/danger, PURPLE=timing/pause/acceleration.`
      : undefined,
    storyboardReference
      ? "- Never render storyboard artifacts in the final video: no colored annotations, arrows, motion lines, handwritten notes, labels, panel numbers, panel borders, timing marks, sketch overlays, text, UI elements, subtitles, logos, or watermarks."
      : "- Output cleanliness still applies: no text overlays, subtitles, logos, watermarks, UI elements, panel borders, annotation marks, or visible prompt artifacts.",
    storyboardReference
      ? "- Specifically enforce: no arrows, dotted eyeline guides, circled numbers, labels, tables, timing marks, or UI symbols from the storyboard reference may appear in the final video."
      : undefined,
    storyboardReference
      ? "- If the storyboard contains more panels than the timing plan can support, compress extra panels into internal staging cues instead of trying to show them all."
      : undefined,
    storyboardReference
      ? "- The storyboard may be rough or semi-abstract; character references define the final identity, not the temporary storyboard mannequin."
      : undefined,
    storyboardReference
      ? "- All-around reference anti-blend rule: do not average the uploaded images into one mixed moodboard. Each reference keeps its own job; use the storyboard for layout/motion, the scene baseline for environment/weather, character references for identity, prop references for objects, and audio only for timing."
      : "- All-around reference anti-blend rule: do not average the uploaded images into one mixed moodboard. Each reference keeps its own job; use written direction for layout/motion, the scene baseline for environment/weather, character references for identity, prop references for objects, and audio only for timing.",
    sceneBaseline
      ? `- Image ${sceneImageIndex} is the scene baseline. Use it for location, weather, time of day, spatial continuity, and atmosphere. ${storyboardReference ? "Do not let it override the storyboard composition." : "It is the environment authority for this omni-reference shot."}`
      : "- No scene baseline image is attached; use the written prompt for location and weather continuity.",
    characterReferences.length
      ? `- Character reference image${characterReferences.length > 1 ? "s" : ""} ${characterImageIndexes.length ? `(${imageNumberRange(characterImageIndexes[0]!, characterImageIndexes.length)}) ` : ""}have priority for face, hairstyle, outfit, body design, identity, and silhouette. If a storyboard or written detail shows a different-looking temporary character, ignore that temporary design and keep the character reference.`
      : "- No character reference image is attached.",
    propReferences.length
      ? `- Prop reference image${propReferences.length > 1 ? "s" : ""} ${propImageIndexes.length ? `(${imageNumberRange(propImageIndexes[0]!, propImageIndexes.length)}) ` : ""}keep important object appearance only. They are not storyboard panels, scene frames, camera cues, or separate video shots.`
      : "- No prop reference image is attached.",
    dialogueAudio
      ? "- The uploaded audio is dialogue timing and performance reference. The speaking character should match the audio timing naturally."
      : "- No dialogue audio is attached.",
    input.dialogueTranscript ? `Dialogue transcript: ${input.dialogueTranscript}` : undefined,
    "",
    ...propReferenceSafetyLines(propReferences),
    propReferences.length ? "" : undefined,
    ...roleBindingPromptLines([...images, ...audio]),
    "",
    ...seedanceTimingPlanLines(input.directorPlan, durationSeconds),
    "",
    "Shot direction:",
    input.prompt,
    input.directorPlan ? "Structured director plan:" : undefined,
    input.directorPlan ? input.directorPlan.seedanceAction : undefined,
    input.directorPlan?.supportPanels.length
      ? `Small storyboard/support details must stay inside the listed timing beats, not become extra visible cuts: ${input.directorPlan.supportPanels.map((panel) => `${panel.purpose}: ${panel.content}`).join("; ")}.`
      : undefined,
    storyboardReference
      ? "Reference priority rule: storyboard controls motion and layout; character references control who the character is; scene baseline controls weather/location; prop references control object appearance. If references conflict, keep this priority instead of blending them."
      : "Reference priority rule: written shot direction controls motion and camera; character references control who the character is; scene baseline controls weather/location; prop references control object appearance. If references conflict, keep this priority instead of blending them.",
    "Conflict resolution by dimension: never solve a mismatch by changing character identity, changing the weather, or replacing the scene layout. Drop the conflicting hint and preserve the locked dimension.",
    storyboardReference
      ? "Identity conflict rule: do not let a rough storyboard heroine or placeholder design replace the locked character design."
      : "Identity conflict rule: do not let written shorthand or scene mood change the locked character design.",
    "",
    "Audio constraints: no BGM, no music, no song, no added soundtrack. Music references belong to rhythm planning and final export mixing, not the video provider prompt. Keep room for later dialogue, TTS, ambient sound, and manual sound design.",
    "Output constraints: no subtitles, no on-screen text, no watermark, no manga page, no photorealism, no live action conversion.",
  ]);

  const args = [
    "multimodal2video",
    "--model_version",
    modelVersion,
    "--video_resolution",
    videoResolution,
    "--ratio",
    ratio,
    "--duration",
    String(durationSeconds),
    "--poll",
    String(shortPollSeconds),
    ...images.flatMap((image) => ["--image", image.path]),
    ...audio.flatMap((clip) => ["--audio", clip.path]),
    "--prompt",
    prompt,
  ];

  return {
    schemaVersion: STORYBOARD_REFERENCE_PIPELINE_VERSION,
    providerId: "jimeng-video-cli",
    command: "multimodal2video",
    cliPath,
    args,
    shotId: input.shotId,
    prompt,
    outputDir: input.outputDir,
    durationSeconds,
    ratio,
    videoResolution,
    modelVersion,
    inputs: { images, audio },
    referencePolicy: {
      inputOrder: [...SEEDANCE_ALL_AROUND_REFERENCE_ORDER],
	      storyboardReferenceRole: storyboardReference ? "composition, camera movement, blocking, rough action" : "not used in omni-reference mode",
      sceneBaselineRole: "location, weather, time of day, environment continuity, atmosphere",
      characterReferenceRole: "face, hairstyle, outfit, body design, identity, and silhouette",
      propReferenceRole: "important object appearance",
      dialogueAudioRole: "dialogue timing and performance",
      roleBindings: uniqueRoleBindings([...images, ...audio]),
      strategyPackIds: [...STORYBOARD_REFERENCE_STRATEGY_PACK_IDS],
	      referenceDimensionRule: storyboardReference
	        ? "All-around references are role-scoped: storyboard controls layout/motion, scene controls environment/weather, character controls identity, prop controls objects, audio controls timing only."
	        : "All-around references are role-scoped: written direction controls layout/motion, scene controls environment/weather, character controls identity, prop controls objects, audio controls timing only.",
      maxConcurrentVideoJobs: JIMENG_CLI_DEFAULT_MAX_CONCURRENT_VIDEO_JOBS,
	      userFacingSummary: storyboardReference
	        ? "视频生成使用分镜图控制构图和动作，用场景参考稳住天气环境，用角色/道具参考锁身份和物件；每类参考只承担自己的职责。"
	        : "视频生成使用场景、角色、道具和可选对白音频参考，再用文字导演提示控制构图和动作；不额外上传故事板或单张起始帧。",
    },
    queuePolicy: {
      providerAsync: true,
      initialPollSeconds: shortPollSeconds,
      expectedQueueWaitMinutes: JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES,
      maxConcurrentVideoJobs: JIMENG_CLI_DEFAULT_MAX_CONCURRENT_VIDEO_JOBS,
      resumeWithSubmitId: true,
      userMessage: `即梦视频默认一次处理一个任务；排队常见约 ${JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES} 分钟，可以离开后恢复查询。`,
    },
    directorStrategy,
  };
}
