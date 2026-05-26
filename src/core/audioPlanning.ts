import type {
  AudioPlan,
  AudioPlanningState,
  MusicReferenceSummary,
  AudioProviderSlotSummary,
  ProviderEnablementEntry,
  PreviewEvent,
  RuntimeConfig,
  RuntimeVoiceSource,
  ShotRecord,
} from "./types";
import { buildTtsProviderPlanningState } from "./ttsProviderPlanning";

export const audioPlanningSchemaVersion = "0.1.0";

export interface BuildAudioPlanningStateInput {
  generatedAt: string;
  shots: ShotRecord[];
  runtimeConfig: RuntimeConfig;
  previewEvents?: PreviewEvent[];
  musicReferences?: MusicReferenceSummary[];
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function defaultVoiceSourceId(sources: RuntimeVoiceSource[]): string | null {
  const source = sources.find((item) => item.kind === "tts_voice" || item.kind === "voice_library");
  return source?.id || null;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function shotField(shot: ShotRecord, keys: string[]): string {
  const record = shot as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = cleanText(record[key]);
    if (value) return value;
  }
  return "";
}

function shotArrayField(shot: ShotRecord, keys: string[]): string[] {
  const record = shot as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .map(cleanText)
        .filter((line) => line && line !== "-" && line !== "无");
    }
  }
  return [];
}

function extractStoryField(storyFunction: string, labels: string[]): string {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = storyFunction.match(new RegExp(`${escaped}\\s*[:：]\\s*([^。\\n]+)`, "u"));
    const value = cleanText(match?.[1]);
    if (value && value !== "-" && value !== "无") return value;
  }
  return "";
}

function narrationForShot(shot: ShotRecord): string {
  return shotField(shot, ["narrationText", "narration", "speechThrough", "voiceover", "旁白"]);
}

function dialogueLinesForShot(shot: ShotRecord): string[] {
  const direct = shotArrayField(shot, ["dialogueLines", "dialogue", "subtitles"]);
  if (direct.length) return direct;
  const directSubtitle = shotField(shot, ["subtitle", "dialogueText", "line"]);
  if (directSubtitle && directSubtitle !== "-" && directSubtitle !== "无") return [directSubtitle];
  const fromStory = extractStoryField(shot.storyFunction || "", ["字幕", "对白", "台词"]);
  return fromStory ? [fromStory] : [];
}

function ambienceForShot(shot: ShotRecord): string {
  const direct = shotField(shot, ["sound", "soundEffect", "ambienceBrief", "audioUsage"]);
  if (direct) return direct;
  const fromStory = extractStoryField(shot.storyFunction || "", ["声音", "音效", "环境音"]);
  return fromStory;
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
  const narrationText = narrationForShot(shot);
  const dialogueLines = dialogueLinesForShot(shot);
  const ambienceBrief = ambienceForShot(shot);

  return {
    shotId: shot.id,
    narrationText,
    dialogueLines,
    voiceSourceId: defaultVoiceSourceId(sources),
    deliveryNotes: dialogueLines.length
      ? "Use the confirmed dialogue line for this shot. Keep delivery natural and timed to the shot duration."
      : narrationText
        ? "Use the confirmed narration line for this shot. Keep delivery clear and restrained."
        : "No spoken line is confirmed yet; add dialogue or narration before TTS generation.",
    ambienceBrief: ambienceBrief || (shot.storyFunction
      ? `Ambience placeholder should support the story function: ${shot.storyFunction}`
      : "Ambience placeholder reserved for this shot."),
    bgmProfile: "配乐不交给视频模型；如有配乐参考，会用于节奏规划和最终导出混音。",
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

function buildAudioReferencePolicy(): AudioPlanningState["referencePolicy"] {
  return {
    voiceReferenceRole: "voice_reference",
    voiceReferenceBinding: "character_or_narrator",
    musicReferenceRole: "music_reference",
    musicReferenceBinding: "rhythm_and_final_mix",
    musicNeverEntersVideoPrompt: true,
    videoProviderPayloadIncludesMusic: false,
    defaultTtsRoute: "local_qwen3_tts_clone",
    reviewActions: ["listen", "review", "replace"],
    notes: [
      "voice_reference binds only to a character or narrator TTS plan.",
      "music_reference is rhythm planning plus final export mix only.",
      "Music references must not be copied into video prompt text or provider payloads.",
      "Generated TTS outputs should be playable, reviewable, and replaceable before export promotion.",
    ],
  };
}

export function buildAudioPlanningState(input: BuildAudioPlanningStateInput): AudioPlanningState {
  const sources = input.runtimeConfig.voiceSources || [];
  const previewEvents = input.previewEvents || [];
  const musicReferences = input.musicReferences || [];
  const shotPlans = input.shots.map((shot) => buildShotPlan(shot, sources, previewEvents));
  const audioEvents = buildAudioPreviewEvents(shotPlans, input.shots, previewEvents);
  const missingOutputPathCount = shotPlans.filter((plan) => !plan.outputPath).length;
  const ttsProviderPlanning = buildTtsProviderPlanningState({
    generatedAt: input.generatedAt,
    shotPlans,
  });

  return {
    schemaVersion: audioPlanningSchemaVersion,
    generatedAt: input.generatedAt,
    shotPlans,
    musicReferences,
    postMixPolicy: {
      musicReferenceCount: musicReferences.length,
      finalMixMusicAllowed: musicReferences.length > 0,
      videoProviderBgmAllowed: false,
      notes: [
        "配乐参考只用于节奏规划和最终导出混音。",
        "视频模型提示词仍然保持 no BGM / no music。",
      ],
    },
    referencePolicy: buildAudioReferencePolicy(),
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
    ttsProviderPlanning,
    exportPackageSummary: {
      status: "planned",
      includedInExportProfiles: ["asset_package", "developer_archive"],
      plannedCategories: ["audio_plan", "voice_source_registry_summary", "music_reference_summary", "preview_mix_placeholder", "tts_provider_config", "no_bgm_video_policy"],
      plannedPaths: [
        ...ttsProviderPlanning.submitPlanDrafts.map((draft) => draft.expectedOutputPath),
        ...musicReferences.flatMap((reference) => [reference.analysisPath || "", reference.finalMixPath || ""]).filter(Boolean),
      ],
      blockedReasons: ["No real narration, dialogue, ambience, or music output files are written until explicit permission receipt and runtime execution."],
      notes: [
        "Export/package code can include the audio plan contract without copying generated audio files.",
        "TTS output paths are planned as project-relative targets for later local IndexTTS or cloud TTS execution.",
        "Developer archive should preserve the plan and policy summary for later provider implementation.",
      ],
      dryRunOnly: true,
      providerSubmissionForbidden: true,
    },
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    notes: [
      "Audio planning prepares local Qwen3 voice cloning, local IndexTTS fallback, and cloud TTS routes, but submit remains gated.",
      "TTS and music provider slots remain planned and liveSubmitAllowed=false until an explicit permission receipt.",
      "BGM is not mixed into video provider prompts.",
      musicReferences.length ? "Imported music is planned for rhythm and final export mix only." : "",
    ].filter(Boolean),
  };
}
