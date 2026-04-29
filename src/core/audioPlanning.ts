import type {
  AudioPlan,
  AudioPlanningState,
  AudioProviderSlotSummary,
  ProviderEnablementEntry,
  PreviewEvent,
  RuntimeConfig,
  RuntimeVoiceSource,
  ShotRecord,
} from "./types";

export const audioPlanningSchemaVersion = "0.1.0";

export interface BuildAudioPlanningStateInput {
  generatedAt: string;
  shots: ShotRecord[];
  runtimeConfig: RuntimeConfig;
  previewEvents?: PreviewEvent[];
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function defaultVoiceSourceId(sources: RuntimeVoiceSource[]): string | null {
  const source = sources.find((item) => item.kind === "tts_voice" || item.kind === "voice_library");
  return source?.id || null;
}

function durationForShot(shot: ShotRecord, previewEvents: PreviewEvent[] = []): { startSeconds: number; durationSeconds: number } {
  const event = previewEvents.find((item) => item.shotId === shot.id);
  return {
    startSeconds: event?.startSeconds || 0,
    durationSeconds: event?.durationSeconds || (shot.videoPath ? 5 : 3),
  };
}

function buildShotPlan(shot: ShotRecord, sources: RuntimeVoiceSource[], previewEvents: PreviewEvent[]): AudioPlan {
  const { durationSeconds } = durationForShot(shot, previewEvents);

  return {
    shotId: shot.id,
    narrationText: "",
    dialogueLines: [],
    voiceSourceId: defaultVoiceSourceId(sources),
    deliveryNotes: "Placeholder delivery notes; edit through a future voice_change_transaction before audio generation.",
    ambienceBrief: shot.storyFunction
      ? `Ambience placeholder should support the story function: ${shot.storyFunction}`
      : "Ambience placeholder reserved for this shot.",
    bgmProfile: "No BGM for video provider; BGM may be planned here or imported later in post.",
    musicAllowed: false,
    targetDurationSeconds: durationSeconds,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
    outputPath: null,
    linkedTtsJobId: null,
    linkedMusicJobId: null,
    audioQaStatus: "UNKNOWN",
  };
}

function buildAudioPreviewEvents(plans: AudioPlan[], shots: ShotRecord[], previewEvents: PreviewEvent[]): PreviewEvent[] {
  return plans.flatMap((plan) => {
    const shot = shots.find((item) => item.id === plan.shotId);
    const { startSeconds, durationSeconds } = shot
      ? durationForShot(shot, previewEvents)
      : { startSeconds: 0, durationSeconds: plan.targetDurationSeconds };
    const idBase = safeId(plan.shotId);
    const events: PreviewEvent[] = [];

    if (plan.narrationText.trim()) {
      events.push({
        id: `audio_${idBase}_narration_placeholder`,
        mode: "draft_preview",
        type: "narration_audio",
        shotId: plan.shotId,
        startSeconds,
        durationSeconds,
        qaStatus: plan.outputPath ? plan.audioQaStatus : "UNKNOWN",
        sourceTaskId: plan.linkedTtsJobId || undefined,
      });
    }

    if (plan.dialogueLines.length) {
      events.push({
        id: `audio_${idBase}_dialogue_placeholder`,
        mode: "draft_preview",
        type: "dialogue_audio",
        shotId: plan.shotId,
        startSeconds,
        durationSeconds,
        qaStatus: plan.outputPath ? plan.audioQaStatus : "UNKNOWN",
        sourceTaskId: plan.linkedTtsJobId || undefined,
      });
    }

    if (plan.ambienceBrief.trim()) {
      events.push({
        id: `audio_${idBase}_ambience_placeholder`,
        mode: "draft_preview",
        type: "ambience_audio",
        shotId: plan.shotId,
        startSeconds,
        durationSeconds,
        qaStatus: "UNKNOWN",
      });
    }

    if (plan.musicAllowed) {
      events.push({
        id: `audio_${idBase}_music_placeholder`,
        mode: "draft_preview",
        type: "music_audio",
        shotId: plan.shotId,
        startSeconds,
        durationSeconds,
        qaStatus: plan.linkedMusicJobId && plan.outputPath ? plan.audioQaStatus : "UNKNOWN",
        sourceTaskId: plan.linkedMusicJobId || undefined,
      });
    }

    return events;
  });
}

function buildVoiceSourceRegistry(sources: RuntimeVoiceSource[]): AudioPlanningState["voiceSourceRegistry"] {
  return {
    sourceCount: sources.length,
    placeholderCount: sources.filter((source) => source.status === "placeholder").length,
    plannedCount: sources.filter((source) => source.status === "planned").length,
    unavailableCount: sources.filter((source) => source.status === "unavailable").length,
    sources,
    storesSecrets: false,
    changeTransactionRequired: true,
    liveSubmitAllowed: false,
    providerSubmissionForbidden: true,
    notes: [
      "Voice source registry is copied from runtime.config.voiceSources.",
      "No provider credentials, API keys, or sample audio are stored in ProjectRuntimeState.",
      "Voice changes must be represented by voice_change_transaction before reflow.",
    ],
  };
}

function isAudioProviderSlot(slot: ProviderEnablementEntry): slot is ProviderEnablementEntry & { slot: "audio.tts" | "audio.music" } {
  return slot.slot === "audio.tts" || slot.slot === "audio.music";
}

function buildProviderSlots(config: RuntimeConfig): AudioProviderSlotSummary[] {
  return config.providerEnablement.slots
    .filter(isAudioProviderSlot)
    .map((slot) => ({
      slot: slot.slot,
      state: slot.state,
      activeProvider: slot.activeProvider,
      allowedProviders: slot.allowedProviders,
      liveSubmitAllowed: false,
      notes: [
        ...slot.notes,
        "Phase 6 keeps audio providers planned/read-only; provider submission is forbidden.",
      ],
    }));
}

export function buildAudioPlanningState(input: BuildAudioPlanningStateInput): AudioPlanningState {
  const sources = input.runtimeConfig.voiceSources || [];
  const previewEvents = input.previewEvents || [];
  const shotPlans = input.shots.map((shot) => buildShotPlan(shot, sources, previewEvents));
  const audioEvents = buildAudioPreviewEvents(shotPlans, input.shots, previewEvents);
  const missingOutputPathCount = shotPlans.filter((plan) => !plan.outputPath).length;

  return {
    schemaVersion: audioPlanningSchemaVersion,
    generatedAt: input.generatedAt,
    shotPlans,
    voiceSourceRegistry: buildVoiceSourceRegistry(sources),
    previewMix: {
      planId: "audio_preview_mix_placeholder",
      generatedFromAudioPlan: true,
      eventCount: audioEvents.length,
      missingOutputPathCount,
      events: audioEvents,
      notes: [
        "Audio preview mix is a placeholder derived from AudioPlan; no audio file is rendered.",
        "Events without mediaPath are not successful files and must remain draft/placeholder material.",
      ],
      dryRunOnly: true,
      providerSubmissionForbidden: true,
    },
    videoProviderPolicy: {
      musicAllowed: false,
      noBgmForVideoProvider: true,
      ambienceSfxPlaceholderAllowed: true,
      bgmHandledBy: "audio_plan_or_post_import",
      summary: "Video provider prompts default to no BGM; music belongs in audio planning or post import.",
    },
    providerSlots: buildProviderSlots(input.runtimeConfig),
    exportPackageSummary: {
      status: "planned",
      includedInExportProfiles: ["asset_package", "developer_archive"],
      plannedCategories: ["audio_plan", "voice_source_registry_summary", "preview_mix_placeholder", "no_bgm_video_policy"],
      plannedPaths: [],
      blockedReasons: ["No real narration, dialogue, ambience, or music output files are written in Phase 6."],
      notes: [
        "Export/package code can include the audio plan contract without copying generated audio files.",
        "Developer archive should preserve the plan and policy summary for later provider implementation.",
      ],
      dryRunOnly: true,
      providerSubmissionForbidden: true,
    },
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    notes: [
      "Phase 6 implements audio planning data contracts only.",
      "TTS and music provider slots remain planned and liveSubmitAllowed=false.",
      "BGM is not mixed into video provider prompts.",
    ],
  };
}
