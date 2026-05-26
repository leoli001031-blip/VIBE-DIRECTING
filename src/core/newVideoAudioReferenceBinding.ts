import { buildAudioPlanningState } from "./audioPlanning";
import type { NewVideoProjectVibeDraftLike } from "./newVideoProjectVibePlanner";
import type { ProjectRuntimeState } from "./projectState";
import type { StoryDiscussionDelta } from "./storyDiscussionWorkspace";
import type { AudioPlanningState, MusicReferenceSummary } from "./types";
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

function audioRole(input: BindNewVideoAudioReferenceInput): "voice_reference" | "music_reference" {
  return input.draft.audioRole === "music_reference" ? "music_reference" : "voice_reference";
}

function musicReferenceSummary(input: BindNewVideoAudioReferenceInput): MusicReferenceSummary {
  const sourceId = audioSourceId(input).replace("new_video_audio_", "new_video_music_");
  return {
    id: sourceId,
    label: "配乐参考 1",
    status: "candidate",
    referenceRole: "music_reference",
    usage: "rhythm_and_final_mix",
    usedFor: ["rhythm_planning", "final_export_mix"],
    forbiddenFor: ["video_prompt", "video_provider_payload"],
    analysisPath: `audio/music-analysis/${sourceId}.json`,
    finalMixPath: "audio/music/final-music-reference",
    noRawPathStored: true,
    sourceRefs: [
      `music_reference:${sourceId}`,
      "audio_reference:new_video_music_reference_1",
    ],
  };
}

function audioTextConstraints(input: BindNewVideoAudioReferenceInput): string[] {
  return unique([
    "用户上传音频参考，只能作为后续音色讨论和 TTS 计划的候选来源。",
    "候选音源：授权状态未确认前不能锁定、不能正式生成、不能提交 provider。",
    hasAudioCloneIntent(input.discussionDeltas) ? "已确认讨论提到音色克隆，先作为候选角色音源绑定。" : "",
    hasAudioUsageIntent(input.discussionDeltas) ? "已确认讨论提到音频用途，进入音频计划但不进入视频 provider prompt。" : "",
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
  if (audioRole(input) === "music_reference") {
    const musicReference = musicReferenceSummary(input);
    const audioPlanning = buildAudioPlanningState({
      generatedAt,
      shots: input.runtimeState.storyFlow.shots,
      runtimeConfig: input.runtimeState.runtime.config,
      previewEvents: input.runtimeState.previewEvents,
      musicReferences: [musicReference],
    });
    const voiceAudioSettings = buildVoiceAudioSettingsState({
      generatedAt,
      voiceSourceLibrary: input.runtimeState.voiceSourceLibrary,
      audioPlanning,
    });
    return {
      runtimeState: {
        ...input.runtimeState,
        generatedAt,
        audioPlanning,
        voiceAudioSettings,
      },
      applied: true,
      evidenceRefs: musicReference.sourceRefs,
    };
  }

  const sourceId = audioSourceId(input);
  const result = addVoiceSource(input.runtimeState.voiceSourceLibrary, {
    id: sourceId,
    displayName: "音频参考 1",
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
