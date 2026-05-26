import {
  applyProjectVibeTransaction,
  hashProjectVibeFacts,
  type ProjectVibePatchResult,
} from "../project/projectVibe";
import type {
  ProjectVibeDocument,
  ProjectVibePatchOperation,
  ProjectVibeRunReceipt,
  ProjectVibeShot,
  ProjectVibeTransaction,
} from "../project/types";
import type { DirectorFeedbackRecompileResult } from "./directorFeedbackRecompile";
import type {
  StoryboardReferenceProjectPlannerAsset,
  StoryboardReferenceProjectPlannerAudio,
  StoryboardReferenceProjectPlannerInput,
  StoryboardReferenceProjectPlannerShot,
} from "./storyboardReferenceProjectPlanner";
import type { StoryboardReferenceRoleBinding } from "./storyboardReferencePipeline";
import type {
  DirectorRhythmProfile,
  DirectorSplitPolicy,
} from "./directorRhythmPlanner";

export interface BuildProjectVibeStoryboardPlannerInputOptions {
  storyboardOutputRoot?: string;
  videoOutputRoot?: string;
  outputSize?: string;
}

export interface ApplyDirectorFeedbackRecompileToProjectVibeInput {
  project: ProjectVibeDocument;
  recompile: DirectorFeedbackRecompileResult;
  createdAt?: string;
}

export interface ApplyDirectorFeedbackRecompileToProjectVibeResult {
  status: "applied" | "blocked" | "rejected";
  project: ProjectVibeDocument;
  transaction?: ProjectVibeTransaction;
  patchResult?: ProjectVibePatchResult;
  blockedReasons: string[];
  providerCalled: false;
  providerSubmissionForbidden: true;
  projectVibeWritten: boolean;
  summary: string;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function list(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function maybeList(values?: string[]): string[] | undefined {
  const next = list(values || []);
  return next.length ? next : undefined;
}

function plannerRoleBinding(
  binding: ProjectVibeDocument["assets"][number]["roleBinding"],
): StoryboardReferenceRoleBinding | undefined {
  if (!binding) return undefined;
  if (
    binding.role !== "scene_baseline"
    && binding.role !== "character_identity"
    && binding.role !== "prop_reference"
    && binding.role !== "storyboard_reference"
    && binding.role !== "dialogue_audio"
    && binding.role !== "final_color_frame"
  ) return undefined;
  return {
    role: binding.role,
    useFor: binding.useFor,
    ignoreFor: binding.ignoreFor,
    priority: binding.priority,
    conflictRule: binding.conflictRule,
  };
}

function plannerAssetFromProjectAsset(asset: ProjectVibeDocument["assets"][number]): StoryboardReferenceProjectPlannerAsset {
  return {
    id: asset.id,
    kind: asset.kind,
    role: asset.roleBinding?.role,
    label: asset.label,
    path: asset.path,
    usedByShotIds: asset.usedByShotIds,
    textConstraints: asset.textConstraints,
    roleBinding: plannerRoleBinding(asset.roleBinding),
  };
}

function isDialogueAudioProjectAsset(asset: ProjectVibeDocument["assets"][number]): boolean {
  if (asset.status === "missing" || asset.status === "rejected") return false;
  const role = clean(asset.roleBinding?.role).toLowerCase();
  const haystack = [asset.id, asset.label, asset.path, ...asset.textConstraints].map(clean).join(" ").toLowerCase();
  return role === "dialogue_audio" || /(^|[^a-z])dialogue_audio([^a-z]|$)|对白音频|台词音频|tts/.test(haystack);
}

function transcriptFromAsset(asset: ProjectVibeDocument["assets"][number]): string | undefined {
  const transcript = asset.textConstraints
    .map(clean)
    .find((line) => /^transcript[:：]/i.test(line) || /^台词[:：]/i.test(line) || /^对白[:：]/i.test(line));
  return transcript?.replace(/^(transcript|台词|对白)[:：]\s*/i, "").trim() || undefined;
}

function plannerAudioFromProjectAsset(asset: ProjectVibeDocument["assets"][number]): StoryboardReferenceProjectPlannerAudio | undefined {
  if (!isDialogueAudioProjectAsset(asset) || !asset.path) return undefined;
  return {
    id: asset.id,
    role: "dialogue_audio",
    label: asset.label,
    path: asset.path,
    shotIds: asset.usedByShotIds,
    transcript: transcriptFromAsset(asset),
  };
}

function plannerShotFromProjectShot(shot: ProjectVibeShot): StoryboardReferenceProjectPlannerShot {
  return {
    id: shot.id,
    title: shot.title,
    intent: shot.intent,
    camera: shot.camera,
    executionMode: shot.executionMode,
    rhythmProfile: shot.rhythmProfile as DirectorRhythmProfile | undefined,
    splitPolicy: shot.splitPolicy as DirectorSplitPolicy | undefined,
    actionBeats: shot.actionBeats,
    primaryAction: shot.primaryAction,
    actionTrigger: shot.actionTrigger,
    microReaction: shot.microReaction,
    feedbackDirectives: shot.directorFeedbackDirectives,
    characterGuidance: shot.characterGuidance,
    sceneGuidance: shot.sceneGuidance,
    propGuidance: shot.propGuidance,
    seedanceDirection: shot.seedanceDirection,
    sceneAssetIds: shot.sceneAssetIds,
    characterAssetIds: shot.characterAssetIds,
    propAssetIds: shot.propAssetIds,
    durationSeconds: shot.durationSeconds,
  };
}

export function buildProjectVibeStoryboardPlannerInput(
  project: ProjectVibeDocument,
  options: BuildProjectVibeStoryboardPlannerInputOptions = {},
): StoryboardReferenceProjectPlannerInput {
  const assets = project.assets.map(plannerAssetFromProjectAsset);
  const storyboardReferences = assets.filter((asset) => (
    clean(asset.role || asset.kind).toLowerCase() === "storyboard_reference"
    || clean(asset.roleBinding?.role).toLowerCase() === "storyboard_reference"
    || /storyboard|分镜/i.test([asset.id, asset.label, asset.path].map(clean).join(" "))
  ));
  const audioReferences = project.assets
    .map(plannerAudioFromProjectAsset)
    .filter((audio): audio is StoryboardReferenceProjectPlannerAudio => Boolean(audio));
  return {
    projectId: project.manifest.projectId,
    shots: project.storyFlow.shotOrder
      .map((shotId) => project.shots.find((shot) => shot.id === shotId))
      .filter((shot): shot is ProjectVibeShot => Boolean(shot))
      .map(plannerShotFromProjectShot),
    assets,
    storyboardReferences,
    audioReferences,
    userPreference: project.assets
      .flatMap((asset) => asset.textConstraints)
      .filter((item) => /style|风格|日漫|电影|anime|manga/i.test(item))
      .slice(0, 6)
      .join("；"),
    storyboardOutputRoot: options.storyboardOutputRoot || "storyboards",
    videoOutputRoot: options.videoOutputRoot || "video",
    outputSize: options.outputSize || "16:9",
  };
}

function mergePatchedShot(source: ProjectVibeShot, patch: StoryboardReferenceProjectPlannerShot, feedbackId: string): ProjectVibeShot {
  return {
    ...source,
    intent: clean(patch.intent) || source.intent,
    camera: clean(patch.camera) || source.camera,
    executionMode: clean(patch.executionMode) || source.executionMode,
    rhythmProfile: clean(patch.rhythmProfile) || source.rhythmProfile,
    splitPolicy: clean(patch.splitPolicy) || source.splitPolicy,
    actionBeats: maybeList([...(source.actionBeats || []), ...(patch.actionBeats || [])]),
    primaryAction: clean(patch.primaryAction) || source.primaryAction,
    actionTrigger: clean(patch.actionTrigger) || source.actionTrigger,
    microReaction: clean(patch.microReaction) || source.microReaction,
    seedanceDirection: clean(patch.seedanceDirection) || source.seedanceDirection,
    directorFeedbackDirectives: maybeList([...(source.directorFeedbackDirectives || []), ...(patch.feedbackDirectives || [])]),
    characterGuidance: maybeList([...(source.characterGuidance || []), ...(patch.characterGuidance || [])]),
    sceneGuidance: maybeList([...(source.sceneGuidance || []), ...(patch.sceneGuidance || [])]),
    propGuidance: maybeList([...(source.propGuidance || []), ...(patch.propGuidance || [])]),
    sourceRefs: list([...source.sourceRefs, `director_feedback_recompile:${feedbackId}`]),
    status: source.status === "blocked" ? "blocked" : "ready",
  };
}

function buildFeedbackRunReceipt(input: {
  project: ProjectVibeDocument;
  recompile: DirectorFeedbackRecompileResult;
  createdAt: string;
}): ProjectVibeRunReceipt {
  return {
    id: `run_${input.recompile.id}`,
    runKind: "agent_loop",
    status: "succeeded",
    createdAt: input.createdAt,
    summary: "导演反馈已整理为分镜图和视频计划修改，等待后续生成与复核。",
    sourceFactHash: hashProjectVibeFacts(input.project),
    affectedShotIds: [input.recompile.feedbackIntent.targetShotId],
    producedAssetIds: [],
    evidenceRefs: [
      `project.vibe#shots/${input.recompile.feedbackIntent.targetShotId}`,
      `director_feedback_recompile:${input.recompile.id}`,
    ],
    projectFactsMutated: true,
    runtimeFixtureUsed: false,
  };
}

export function applyDirectorFeedbackRecompileToProjectVibe(
  input: ApplyDirectorFeedbackRecompileToProjectVibeInput,
): ApplyDirectorFeedbackRecompileToProjectVibeResult {
  const recompile = input.recompile;
  const createdAt = input.createdAt || new Date().toISOString();
  if (recompile.status !== "ready_for_confirmation" || !recompile.patchedProjectInput) {
    return {
      status: "blocked",
      project: input.project,
      blockedReasons: recompile.blockedReasons.length ? recompile.blockedReasons : [recompile.status],
      providerCalled: false,
      providerSubmissionForbidden: true,
      projectVibeWritten: false,
      summary: "这条反馈还不能写入项目。",
    };
  }

  const targetShotId = recompile.feedbackIntent.targetShotId;
  const sourceShot = input.project.shots.find((shot) => shot.id === targetShotId);
  const patchedPlannerShot = recompile.patchedProjectInput.shots.find((shot) => shot.id === targetShotId);
  if (!sourceShot || !patchedPlannerShot) {
    return {
      status: "blocked",
      project: input.project,
      blockedReasons: [`missing_shot:${targetShotId}`],
      providerCalled: false,
      providerSubmissionForbidden: true,
      projectVibeWritten: false,
      summary: "没有找到要写入的镜头。",
    };
  }

  const operations: ProjectVibePatchOperation[] = [
    {
      op: "upsert_shot",
      shot: mergePatchedShot(sourceShot, patchedPlannerShot, recompile.id),
    },
    {
      op: "append_run_receipt",
      run: buildFeedbackRunReceipt({ project: input.project, recompile, createdAt }),
    },
  ];
  const transaction: ProjectVibeTransaction = {
    id: `txn_${recompile.id}`,
    actor: "agent_loop",
    reason: "Apply confirmed director feedback recompile.",
    createdAt,
    operations,
  };
  const patchResult = applyProjectVibeTransaction(input.project, transaction);
  if (patchResult.receipt.status !== "applied") {
    return {
      status: "rejected",
      project: input.project,
      transaction,
      patchResult,
      blockedReasons: patchResult.receipt.errors,
      providerCalled: false,
      providerSubmissionForbidden: true,
      projectVibeWritten: false,
      summary: patchResult.receipt.errors[0] || "修改计划写入失败。",
    };
  }

  return {
    status: "applied",
    project: patchResult.project,
    transaction,
    patchResult,
    blockedReasons: [],
    providerCalled: false,
    providerSubmissionForbidden: true,
    projectVibeWritten: true,
    summary: "修改计划已写入项目，后续生成仍需要单独确认。",
  };
}
