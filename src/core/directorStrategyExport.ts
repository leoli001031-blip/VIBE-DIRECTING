import {
  DIRECTOR_RHYTHM_PROFILE_LABELS,
  type DirectorRhythmProfile,
  type DirectorSplitPolicy,
} from "./directorRhythmPlanner";
import type { ScriptStoryboardPromptPack, ScriptStoryboardPromptPackShot } from "./scriptStoryboardPromptPack";
import type { StoryDiscussionDelta } from "./storyDiscussionWorkspace";
import type { DemoPackageDirectorStrategyEvidence } from "./types";

export const directorStrategyExportSchemaVersion = "director_strategy_export_v1";

const splitPolicyLabels: Record<DirectorSplitPolicy, string> = {
  hold_single_shot: "保留单一主镜头",
  split_for_reaction: "动作后留反应",
  split_for_action: "拆成清楚动作点",
  montage_sequence: "蒙太奇段落",
};

export interface DirectorStrategyExportShotSummary extends DemoPackageDirectorStrategyEvidence {
  shotId: string;
  title: string;
  durationSeconds: number;
}

export interface DirectorStrategyExportSummary {
  schemaVersion: typeof directorStrategyExportSchemaVersion;
  title: string;
  shotCount: number;
  modificationSummary: string[];
  storyboardPromptPlanSummary: string;
  videoPromptPlanSummary: string;
  shotStrategies: DirectorStrategyExportShotSummary[];
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function firstUseful(values: Array<string | undefined>, fallback: string): string {
  return values.map(clean).find(Boolean) || fallback;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

export function rhythmLabelForExport(profile: DirectorRhythmProfile | string | undefined): string {
  return DIRECTOR_RHYTHM_PROFILE_LABELS[profile as DirectorRhythmProfile] || clean(profile) || "导演节奏";
}

export function splitPolicyLabelForExport(policy: DirectorSplitPolicy | string | undefined): string {
  return splitPolicyLabels[policy as DirectorSplitPolicy] || clean(policy) || "按镜头内容判断";
}

function deltaSummary(delta: StoryDiscussionDelta): string {
  const revision = delta.revisionSummary;
  return firstUseful([
    revision?.confirmationCopy,
    delta.summary,
    delta.label,
  ], "已确认一条导演修改");
}

function buildModificationSummary(deltas: StoryDiscussionDelta[] | undefined): string[] {
  const confirmed = (deltas || []).filter((delta) => delta.status === "confirmed");
  return unique(confirmed.map(deltaSummary));
}

function shotStrategyEvidence(shot: ScriptStoryboardPromptPackShot, modificationSummary: string[]): DirectorStrategyExportShotSummary {
  const plan = shot.storyboardDirectorPlan;
  const storyboardSummary = shot.image2StoryboardPlan?.referencePolicy.userFacingSummary || "全能参考模式不额外生成故事板；直接用锁定资产和文字导演提示进入视频。";
  const videoSummary = shot.seedanceVideoPlan.referencePolicy.userFacingSummary;
  return {
    shotId: shot.shotId,
    title: shot.title,
    durationSeconds: shot.durationSeconds,
    rhythmProfile: plan.rhythmProfile,
    rhythmLabel: rhythmLabelForExport(plan.rhythmProfile),
    rhythmReason: plan.rhythmReason,
    splitPolicy: plan.splitPolicy,
    splitLabel: splitPolicyLabelForExport(plan.splitPolicy),
    actionSummary: firstUseful([
      plan.primaryAction,
      shot.actionQA.primaryAction,
      shot.directorRow["主动作"],
    ], "保留一个清楚的主动作"),
    modificationSummary,
    storyboardPromptPlanSummary: storyboardSummary,
    videoPromptPlanSummary: videoSummary,
  };
}

export function buildDirectorStrategyExportSummary(input: {
  promptPack: ScriptStoryboardPromptPack;
  confirmedDeltas?: StoryDiscussionDelta[];
}): DirectorStrategyExportSummary {
  const modificationSummary = buildModificationSummary(input.confirmedDeltas);
  const shotStrategies = input.promptPack.shots.map((shot) => shotStrategyEvidence(shot, modificationSummary));
  return {
    schemaVersion: directorStrategyExportSchemaVersion,
    title: input.promptPack.title,
    shotCount: input.promptPack.shots.length,
    modificationSummary,
    storyboardPromptPlanSummary: "分镜参考图用于构图、走位、动作承接和节奏判断；角色、场景和道具参考继续各管各的，不让分镜草图替代锁定设定。",
    videoPromptPlanSummary: "视频计划把分镜、场景、角色、道具和可选对白音频按职责合并；默认保留复核，不把结果自动当成最终成片。",
    shotStrategies,
  };
}

export function directorStrategyEvidenceForShot(
  summary: DirectorStrategyExportSummary,
  shotId: string,
): DemoPackageDirectorStrategyEvidence | undefined {
  const strategy = summary.shotStrategies.find((shot) => shot.shotId === shotId);
  if (!strategy) return undefined;
  return {
    rhythmProfile: strategy.rhythmProfile,
    rhythmLabel: strategy.rhythmLabel,
    rhythmReason: strategy.rhythmReason,
    splitPolicy: strategy.splitPolicy,
    splitLabel: strategy.splitLabel,
    actionSummary: strategy.actionSummary,
    modificationSummary: strategy.modificationSummary,
    storyboardPromptPlanSummary: strategy.storyboardPromptPlanSummary,
    videoPromptPlanSummary: strategy.videoPromptPlanSummary,
  };
}
