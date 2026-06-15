import { bindNewVideoAudioReferenceToRuntimeState } from "../src/core/newVideoAudioReferenceBinding.ts";
import type { StoryDiscussionDelta } from "../src/core/storyDiscussionWorkspace.ts";
import { validateVoiceSourceLibraryState } from "../src/core/voiceSourceLibrary.ts";
import { buildProjectRuntimeStateFromProjectVibe, createProjectVibe } from "../src/project/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const generatedAt = "2026-05-18T09:30:00.000Z";
const project = createProjectVibe({
  projectId: "new_video_audio_reference_project",
  title: "New Video Audio Reference Project",
  createdAt: generatedAt,
  updatedAt: generatedAt,
  storyFlow: {
    id: "story_flow_current",
    sections: [{
      id: "sec_audio",
      title: "音频测试",
      summary: "Two shots for audio planning.",
      sequenceIndex: 0,
      shotIds: ["shot_audio_1", "shot_audio_2"],
    }],
    shotOrder: ["shot_audio_1", "shot_audio_2"],
  },
  shots: [
    {
      id: "shot_audio_1",
      sectionId: "sec_audio",
      title: "听见录音",
      intent: "主角听见父亲留下的录音。",
      sceneAssetIds: [],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: 5,
      status: "planned",
      sourceRefs: ["fixture:audio_story"],
    },
    {
      id: "shot_audio_2",
      sectionId: "sec_audio",
      title: "走向清晨",
      intent: "主角带着录音走向清晨。",
      sceneAssetIds: [],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: 5,
      status: "planned",
      sourceRefs: ["fixture:audio_story"],
    },
  ],
});
const runtimeState = buildProjectRuntimeStateFromProjectVibe({
  project,
  generatedAt,
});
const confirmedAudioCloneDelta: StoryDiscussionDelta = {
  id: "discussion_delta_audio_clone",
  kind: "audio_clone_source",
  laneId: "audio",
  label: "声线参考来源",
  summary: "用户反馈：「父亲旁白用这段音频做声线参考。」把反馈作为声音参考用途。",
  status: "confirmed",
  createdAt: generatedAt,
  confirmedAt: generatedAt,
  sourceTurnId: "discussion_turn_audio",
  sourceRefs: ["discussion_turn_audio"],
  sourceFactIds: ["fact_audio_need"],
  targetItemIds: ["audio_fact_audio_need"],
  needsUserConfirmation: true,
  canWriteProjectFactNow: false,
};

const result = bindNewVideoAudioReferenceToRuntimeState({
  runtimeState,
  generatedAt,
  discussionDeltas: [confirmedAudioCloneDelta],
  draft: {
    script: "一位摄影师听见父亲留下的录音。",
    style: "克制电影感",
    references: [],
    audio: { name: "secret-father-voice-source.wav" },
  },
});

assert(result.applied, "audio reference should be applied to voice source runtime state");
assert(result.source, "audio reference should produce a candidate voice source");
assert(result.source.role === "character", "audio clone delta should bind the reference as a character voice source");
assert(result.source.status === "candidate", "new audio reference should stay candidate until consent is reviewed");
assert(result.source.samplePath?.path === `user_import:${result.source.id}`, "raw user-selected sample path should be redacted");
assert(result.source.samplePath?.rawPathRedacted === true, "sample path should explicitly mark raw path redaction");
assert(result.source.storesCredential === false && result.source.storesSampleAudioFile === false, "voice source must not store secrets or sample audio");
assert(result.source.providerSubmissionForbidden === true && result.source.liveSubmitAllowed === false, "voice source cannot enable provider submit");
assert(result.evidenceRefs.includes("audio_reference:new_video_audio_reference_1"), "audio binding should expose safe evidence refs");
assert(
  result.runtimeState.runtime.config.voiceSources.some((source) => source.id === result.source?.id && source.kind === "tts_voice"),
  "runtime config should receive a voice-reference-compatible source placeholder",
);
assert(
  result.runtimeState.audioPlanning.shotPlans.every((plan) => plan.voiceSourceId === result.source?.id),
  "audio plans should point at the candidate audio reference source",
);
assert(result.runtimeState.audioPlanning.referencePolicy?.voiceReferenceRole === "voice_reference", "audio planning should name voice_reference explicitly");
assert(
  result.runtimeState.audioPlanning.referencePolicy?.voiceReferenceBinding === "character_or_narrator",
  "voice_reference should bind only to a character or narrator route",
);
assert(result.runtimeState.audioPlanning.referencePolicy?.defaultTtsRoute === "parked_in_demo", "demo path should park local TTS and use uploaded audio as video-model voice reference");
assert(!result.runtimeState.audioPlanning.ttsProviderPlanning, "demo audio planning should not prepare local/cloud TTS routes");
assert(result.runtimeState.audioPlanning.postMixPolicy?.finalMixMusicAllowed === false, "demo audio planning must not enable final music mixing");
assert(
  !result.runtimeState.audioPlanning.exportPackageSummary.plannedCategories.some((category) => /tts|music|mix/i.test(category)),
  "demo export categories must stay voice-reference/no-BGM only",
);
assert(result.runtimeState.voiceAudioSettings.voiceSourceSummary.candidate >= 1, "voice/audio settings should surface the candidate source");
assert(validateVoiceSourceLibraryState(result.runtimeState.voiceSourceLibrary, generatedAt).ok, "voice source library should validate");

const serialized = JSON.stringify(result.runtimeState.voiceSourceLibrary);
for (const pattern of [
  /secret-father-voice-source/i,
  /local-file/i,
]) {
  assert(!pattern.test(serialized), `voice source binding must not leak private local audio details: ${pattern}`);
}

const noAudio = bindNewVideoAudioReferenceToRuntimeState({
  runtimeState,
  generatedAt,
  draft: {
    script: "一位摄影师听见父亲留下的录音。",
    style: "",
    references: [],
  },
});
assert(!noAudio.applied, "drafts without audio should not mutate voice source state");
assert(noAudio.runtimeState === runtimeState, "drafts without audio should preserve the input runtime state reference");

const music = bindNewVideoAudioReferenceToRuntimeState({
  runtimeState,
  generatedAt,
  draft: {
    script: "一位摄影师带着城市节奏走向清晨。",
    style: "旧草稿里误标了音乐，但当前 demo 主链路只保留声音参考",
    references: [],
    audio: { name: "secret-city-music.wav" },
    audioRole: "music_reference",
  },
});
assert(music.applied, "legacy music-role audio should still be accepted as a safe voice reference");
assert(music.source, "legacy music-role audio should become a candidate voice source on the demo path");
assert(!music.runtimeState.audioPlanning.musicReferences?.length, "demo path must not create music-reference planning");
assert(
  music.runtimeState.runtime.config.voiceSources.length === runtimeState.runtime.config.voiceSources.length + 1,
  "legacy music-role audio should add one candidate voice reference source",
);
assert(!JSON.stringify(music.runtimeState.audioPlanning).includes("audio/music-analysis/"), "demo path must not plan music analysis");
assert(!/secret-city-music/i.test(JSON.stringify(music.runtimeState.audioPlanning)), "voice reference planning must not leak local audio filenames");

console.log(
  `new-video-audio-reference-test: source=${result.source.id}, shotPlans=${result.runtimeState.audioPlanning.shotPlans.length}.`,
);
