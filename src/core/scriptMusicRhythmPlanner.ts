import {
  planDirectorRhythm,
  type DirectorRhythmPlan,
  type DirectorRhythmProfile,
  type DirectorSplitPolicy,
} from "./directorRhythmPlanner";
import type { MusicRhythmAnalysis } from "./musicRhythmAnalysis";

export const scriptMusicRhythmPlannerSchemaVersion = "0.1.0";

export type ScriptMusicReferenceStrategy =
  | "storyboard_narrative"
  | "storyboard_rapid_cut"
  | "omni_reference";

export interface ScriptMusicRhythmSegment {
  shotIndex: number;
  shotId?: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  rhythmProfile: DirectorRhythmProfile;
  splitPolicy: DirectorSplitPolicy;
  referenceStrategy: ScriptMusicReferenceStrategy;
  cutAlignment: "music_cut" | "script_weight" | "fallback_even";
  reason: string;
}

export interface ScriptMusicRhythmPlan {
  schemaVersion: typeof scriptMusicRhythmPlannerSchemaVersion;
  planId: string;
  generatedFrom: "script_and_music" | "script_only";
  totalDurationSeconds: number;
  musicAnalysisId?: string;
  segments: ScriptMusicRhythmSegment[];
  summary: {
    shotCount: number;
    rhythmTags: string[];
    preferredReferenceStrategies: ScriptMusicReferenceStrategy[];
    musicReferenceRole: "music_reference";
    musicReferenceUsedFor: Array<"rhythm_planning" | "final_export_mix">;
    musicReferenceForbiddenFor: Array<"video_prompt" | "video_provider_payload">;
    videoProviderBgmAllowed: false;
    finalExportMusicPlanned: boolean;
  };
  warnings: string[];
}

export interface BuildScriptMusicRhythmPlanInput {
  scriptText: string;
  shotTexts?: string[];
  shotIds?: string[];
  userPreference?: string;
  desiredTotalDurationSeconds?: number;
  musicAnalysis?: MusicRhythmAnalysis;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function safeId(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 44) || "rhythm";
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function splitScriptFallback(scriptText: string): string[] {
  return clean(scriptText)
    .split(/(?<=[。！？!?；;])\s*|\n+/u)
    .map(clean)
    .filter(Boolean)
    .slice(0, 24);
}

function titleFor(text: string, index: number): string {
  const title = clean(text).replace(/^镜头\s*\d+\s*[：:]/u, "").slice(0, 18);
  return title || `镜头 ${index + 1}`;
}

function densityWeight(plan: DirectorRhythmPlan): number {
  if (plan.rhythmProfile === "action_fast_cut") return 0.78;
  if (plan.rhythmProfile === "emotion_montage") return 0.86;
  if (plan.rhythmProfile === "anime_emotion" || plan.rhythmProfile === "comedy_reaction") return 0.96;
  if (plan.rhythmProfile === "quiet_dialogue" || plan.rhythmProfile === "lyrical_observation") return 1.16;
  if (plan.rhythmProfile === "suspense_pressure") return 1.08;
  return 1;
}

function referenceStrategyFor(plan: DirectorRhythmPlan, durationSeconds: number): ScriptMusicReferenceStrategy {
  if (
    plan.rhythmProfile === "action_fast_cut"
    || plan.rhythmProfile === "emotion_montage"
    || plan.splitPolicy === "split_for_action"
    || plan.splitPolicy === "montage_sequence"
  ) {
    return "storyboard_rapid_cut";
  }
  if (durationSeconds <= 5 && (plan.rhythmProfile === "anime_emotion" || plan.rhythmProfile === "lyrical_observation")) {
    return "omni_reference";
  }
  if (durationSeconds >= 8 || plan.splitPolicy === "split_for_reaction") return "storyboard_narrative";
  return "omni_reference";
}

function totalDuration(input: BuildScriptMusicRhythmPlanInput, shotCount: number): number {
  const desired = Number(input.desiredTotalDurationSeconds || 0);
  if (Number.isFinite(desired) && desired > 0) return clamp(round(desired), Math.max(4, shotCount * 3), 180);
  const musicDuration = Number(input.musicAnalysis?.durationSeconds || 0);
  if (Number.isFinite(musicDuration) && musicDuration >= 4) return clamp(round(musicDuration), Math.max(4, shotCount * 3), 180);
  return clamp(shotCount * 5, 4, 180);
}

function timingFromMusicCuts(input: {
  musicAnalysis?: MusicRhythmAnalysis;
  shotCount: number;
  totalDurationSeconds: number;
}): number[] | undefined {
  const cuts = (input.musicAnalysis?.recommendedCutPoints || [])
    .filter((point) => point >= 0 && point <= input.totalDurationSeconds)
    .sort((left, right) => left - right);
  if (cuts.length < input.shotCount + 1) return undefined;
  const selected = [0];
  for (let index = 1; index < input.shotCount; index += 1) {
    const target = (input.totalDurationSeconds / input.shotCount) * index;
    const nearest = cuts.reduce((best, cut) => (
      Math.abs(cut - target) < Math.abs(best - target) ? cut : best
    ), cuts[0] || target);
    selected.push(nearest);
  }
  selected.push(input.totalDurationSeconds);
  return Array.from(new Set(selected.map((point) => round(point))))
    .sort((left, right) => left - right);
}

function weightedTiming(weights: number[], totalDurationSeconds: number): number[] {
  const totalWeight = weights.reduce((total, value) => total + value, 0) || 1;
  const points = [0];
  let cursor = 0;
  weights.forEach((weight, index) => {
    cursor += index === weights.length - 1
      ? totalDurationSeconds - cursor
      : (weight / totalWeight) * totalDurationSeconds;
    points.push(round(cursor));
  });
  points[points.length - 1] = round(totalDurationSeconds);
  return points;
}

export function buildScriptMusicRhythmPlan(input: BuildScriptMusicRhythmPlanInput): ScriptMusicRhythmPlan {
  const shotTexts = (input.shotTexts?.length ? input.shotTexts : splitScriptFallback(input.scriptText)).map(clean).filter(Boolean);
  const fallbackShotTexts = shotTexts.length ? shotTexts : ["整理一个清楚的开场镜头"];
  const perShotPlans = fallbackShotTexts.map((text) => planDirectorRhythm({
    scriptText: text,
    shotText: text,
    userPreference: input.userPreference,
  }));
  const total = totalDuration(input, fallbackShotTexts.length);
  const musicTiming = timingFromMusicCuts({
    musicAnalysis: input.musicAnalysis,
    shotCount: fallbackShotTexts.length,
    totalDurationSeconds: total,
  });
  const timing = musicTiming || weightedTiming(perShotPlans.map(densityWeight), total);
  const segments = fallbackShotTexts.map((text, index): ScriptMusicRhythmSegment => {
    const startSeconds = timing[index] ?? round((total / fallbackShotTexts.length) * index);
    const endSeconds = timing[index + 1] ?? round((total / fallbackShotTexts.length) * (index + 1));
    const durationSeconds = round(clamp(endSeconds - startSeconds, 3, 15));
    const plan = perShotPlans[index]!;
    const referenceStrategy = referenceStrategyFor(plan, durationSeconds);
    return {
      shotIndex: index,
      shotId: input.shotIds?.[index],
      title: titleFor(text, index),
      startSeconds,
      endSeconds: round(startSeconds + durationSeconds),
      durationSeconds,
      rhythmProfile: plan.rhythmProfile,
      splitPolicy: plan.splitPolicy,
      referenceStrategy,
      cutAlignment: musicTiming ? "music_cut" : input.musicAnalysis ? "script_weight" : "fallback_even",
      reason: input.musicAnalysis
        ? `${plan.rhythmReason} 配乐用于节奏和最终导出，不进入视频模型提示词。`
        : plan.rhythmReason,
    };
  });

  return {
    schemaVersion: scriptMusicRhythmPlannerSchemaVersion,
    planId: `script_music_rhythm_${safeId(input.musicAnalysis?.analysisId || input.scriptText).slice(0, 32)}`,
    generatedFrom: input.musicAnalysis ? "script_and_music" : "script_only",
    totalDurationSeconds: total,
    musicAnalysisId: input.musicAnalysis?.analysisId,
    segments,
    summary: {
      shotCount: segments.length,
      rhythmTags: input.musicAnalysis?.rhythmTags || [],
      preferredReferenceStrategies: Array.from(new Set(segments.map((segment) => segment.referenceStrategy))),
      musicReferenceRole: "music_reference",
      musicReferenceUsedFor: ["rhythm_planning", "final_export_mix"],
      musicReferenceForbiddenFor: ["video_prompt", "video_provider_payload"],
      videoProviderBgmAllowed: false,
      finalExportMusicPlanned: Boolean(input.musicAnalysis),
    },
    warnings: [
      ...(input.musicAnalysis?.warnings || []),
      input.musicAnalysis ? "" : "music_analysis_missing_script_only_rhythm",
      segments.some((segment) => segment.durationSeconds >= 15) ? "some_segments_reach_seedance_max_duration" : "",
    ].filter(Boolean),
  };
}
