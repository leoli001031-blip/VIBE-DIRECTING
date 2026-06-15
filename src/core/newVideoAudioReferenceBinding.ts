import { buildAudioPlanningState } from "./audioPlanning";
import type { NewVideoProjectVibeDraftLike } from "./newVideoProjectVibePlanner";
import type { ProjectRuntimeState } from "./projectState";
import type { StoryDiscussionDelta } from "./storyDiscussionWorkspace";
import type { AudioPlanningState } from "./types";
import {
  addVoiceSource,
  toRuntimeVoiceSources,
  type VoiceSourceLibraryEntry,
  type VoiceSourceLibraryValidationResult,
} from "./voiceSourceLibrary";
import { buildVoiceAudioSettingsState } from "./voiceAudioSettings";
import { stableKnowledgeHash } from "./knowledgeManifest";

export interface BindNewVideoAudioReferenceInput {
  runtimeState: ProjectRuntimeState;
  draft: NewVideoProjectVibeDraftLike;
  discussionDeltas?: StoryDiscussionDelta[];
  generatedAt?: string;
}

export interface BindNewVideoAudioReferenceResult {
  runtimeState: ProjectRuntimeState;
  applied: boolean;
  source?: VoiceSourceLibraryEntry;
  validation?: VoiceSourceLibraryValidationResult;
  evidenceRefs: string[];
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function hasAudioCloneIntent(deltas?: StoryDiscussionDelta[]): boolean {
  return (deltas || []).some((delta) => delta.status === "confirmed" && delta.kind === "audio_clone_source");
}

function hasAudioUsageIntent(deltas?: StoryDiscussionDelta[]): boolean {
  return (deltas || []).some((delta) => (
    delta.status === "confirmed" &&
    (delta.kind === "audio_clone_source" || delta.kind === "audio_usage_note")
  ));
}

function audioSourceId(input: BindNewVideoAudioReferenceInput): string {
  const projectId = clean(input.runtimeState.sourceIndex.projectId) || clean(input.runtimeState.project.title) || "project";
  return `new_video_audio_${stableKnowledgeHash(`${projectId}:new_video_audio_reference`).slice(4, 12)}`;
}

function audioTextConstraints(input: BindNewVideoAudioReferenceInput): string[] {
  return unique([
    "用户上传声音参考，只能作为角色/旁白声线、语气和视频对白表现参考。",
    "候选音源：授权状态未确认前不能锁定、不能正式生成、不能提交 provider。",
    hasAudioCloneIntent(input.discussionDeltas) ? "已确认讨论提到声线参考，先作为候选角色音源绑定。" : "",
    hasAudioUsageIntent(input.discussionDeltas) ? "已确认讨论提到音频用途，进入声音参考计划，不作为配乐或 BGM。" : "",
  ]);
}

function bindSourceToAudioPlan(
  audioPlanning: AudioPlanningState,
  source: VoiceSourceLibraryEntry,
): AudioPlanningState {
  return {
    ...audioPlanning,
    shotPlans: audioPlanning.shotPlans.map((plan) => ({
      ...plan,
      voiceSourceId: source.id,
      deliveryNotes: `${plan.deliveryNotes} New-video audio reference is bound as candidate metadata only.`,
    })),
  };
}

export function bindNewVideoAudioReferenceToRuntimeState(
  input: BindNewVideoAudioReferenceInput,
): BindNewVideoAudioReferenceResult {
  if (!input.draft.audio) {
    return {
      runtimeState: input.runtimeState,
      applied: false,
      evidenceRefs: [],
    };
  }

  const generatedAt = input.generatedAt || input.runtimeState.generatedAt || new Date().toISOString();
  const sourceId = audioSourceId(input);
  const result = addVoiceSource(input.runtimeState.voiceSourceLibrary, {
    id: sourceId,
    displayName: "声音参考 1",
    provider: "user_audio_reference",
    providerVoiceId: sourceId,
    language: "unspecified",
    role: hasAudioCloneIntent(input.discussionDeltas) ? "character" : "narrator",
    samplePath: "redacted_user_audio_reference",
    samplePathOrigin: "user_selected_import",
    sampleImportId: sourceId,
    consentStatus: "unknown",
    commercialUseStatus: "unknown",
    status: "candidate",
    textConstraints: audioTextConstraints(input),
    updatedAt: generatedAt,
  });
  const voiceSourceLibrary = result.library;
  const runtime = {
    ...input.runtimeState.runtime,
    config: {
      ...input.runtimeState.runtime.config,
      voiceSources: toRuntimeVoiceSources(voiceSourceLibrary),
    },
  };
  const audioPlanningBase = buildAudioPlanningState({
    generatedAt,
    shots: input.runtimeState.storyFlow.shots,
    runtimeConfig: runtime.config,
    previewEvents: input.runtimeState.previewEvents,
  });
  const audioPlanning = result.source
    ? bindSourceToAudioPlan(audioPlanningBase, result.source)
    : audioPlanningBase;
  const voiceAudioSettings = buildVoiceAudioSettingsState({
    generatedAt,
    voiceSourceLibrary,
    audioPlanning,
  });
  return {
    runtimeState: {
      ...input.runtimeState,
      generatedAt,
      runtime,
      voiceSourceLibrary,
      audioPlanning,
      voiceAudioSettings,
    },
    applied: Boolean(result.source),
    source: result.source,
    validation: result.validation,
    evidenceRefs: result.source ? [`voice_source:${result.source.id}`, "audio_reference:new_video_audio_reference_1"] : [],
  };
}
