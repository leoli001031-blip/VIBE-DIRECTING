import { buildAudioPlanningState } from "../src/core/audioPlanning.ts";
import { buildDefaultProviderRegistry, selectCapabilityForRequirement } from "../src/core/providerCapabilities.ts";
import { buildRuntimeConfig } from "../src/core/runtimeConfig.ts";
import {
  buildTtsProviderPlanningState,
  validateTtsProviderPlanningState,
} from "../src/core/ttsProviderPlanning.ts";
import type { AudioPlan } from "../src/core/types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const generatedAt = "2026-05-19T16:40:00.000Z";
const runtimeConfig = buildRuntimeConfig();
const ttsSlot = runtimeConfig.providerEnablement.slots.find((slot) => slot.slot === "audio.tts");

assert(ttsSlot, "audio.tts provider slot must exist");
assert(ttsSlot.activeProvider === "local-qwen3-tts-clone", "audio.tts should prefer local Qwen3 voice cloning");
assert(ttsSlot.allowedProviders.includes("local-index-tts"), "audio.tts must allow local IndexTTS");
assert(ttsSlot.allowedProviders.includes("local-qwen3-tts-clone"), "audio.tts must allow local Qwen3 voice cloning");
assert(ttsSlot.allowedProviders.includes("cloud-tts"), "audio.tts must allow cloud TTS fallback");
assert(ttsSlot.liveSubmitAllowed === false, "audio.tts must stay gated");

const localConfig = runtimeConfig.providerConfigs.find((provider) => provider.providerId === "local-index-tts");
const qwen3Config = runtimeConfig.providerConfigs.find((provider) => provider.providerId === "local-qwen3-tts-clone");
const cloudConfig = runtimeConfig.providerConfigs.find((provider) => provider.providerId === "cloud-tts");
assert(localConfig?.providerKind === "tts_local", "runtime config must include local IndexTTS provider config");
assert(localConfig.endpointMode === "local_cli", "local IndexTTS must be a local cli endpoint");
assert(localConfig.localCommand?.commandEnvKey === "VIBE_INDEX_TTS_COMMAND", "local IndexTTS command env key mismatch");
assert(localConfig.localCommand?.modelDirEnvKey === "VIBE_INDEX_TTS_MODEL_DIR", "local IndexTTS model dir env key mismatch");
assert(localConfig.localCommand?.speakerWavEnvKey === "VIBE_INDEX_TTS_SPEAKER_WAV", "local IndexTTS speaker wav env key mismatch");
assert(localConfig.credential.keyStatus === "not_required", "local IndexTTS should not require an API key");
assert(localConfig.ttsConcurrencyPolicy?.maxConcurrentJobs === 1, "local IndexTTS concurrency should default to one");
assert(qwen3Config?.providerKind === "tts_local", "runtime config must include local Qwen3 TTS clone provider config");
assert(qwen3Config.endpointMode === "local_cli", "local Qwen3 TTS clone must be a local cli endpoint");
assert(qwen3Config.localCommand?.commandEnvKey === "VIBE_QWEN3_TTS_COMMAND", "local Qwen3 TTS command env key mismatch");
assert(qwen3Config.localCommand?.modelDirEnvKey === "VIBE_QWEN3_TTS_MODEL_DIR", "local Qwen3 TTS model dir env key mismatch");
assert(qwen3Config.localCommand?.speakerWavEnvKey === "VIBE_QWEN3_TTS_SPEAKER_WAV", "local Qwen3 TTS speaker wav env key mismatch");
assert(qwen3Config.credential.keyStatus === "not_required", "local Qwen3 TTS should not require an API key");
assert(qwen3Config.ttsConcurrencyPolicy?.maxConcurrentJobs === 1, "local Qwen3 TTS concurrency should default to one");
assert(cloudConfig?.providerKind === "tts_cloud", "runtime config must include cloud TTS provider config");
assert(cloudConfig.endpointMode === "cloud_api", "cloud TTS must be a cloud api endpoint");
assert(cloudConfig.cloudEndpoint?.baseUrlEnvKey === "VIBE_TTS_BASE_URL", "cloud TTS base URL env key mismatch");
assert(cloudConfig.credential.envKey === "VIBE_TTS_API_KEY", "cloud TTS API key env key mismatch");
assert(cloudConfig.ttsConcurrencyPolicy?.maxConcurrentJobs === 3, "cloud TTS concurrency should default to three");

const registry = buildDefaultProviderRegistry(generatedAt);
assert(registry.defaultProviderBySlot["audio.tts"] === "local-qwen3-tts-clone", "provider registry should default audio.tts to local Qwen3 voice cloning");
const localCapability = selectCapabilityForRequirement({
  slot: "audio.tts",
  requiredMode: "tts",
  inputKinds: ["text"],
  outputKind: "audio",
  executionStates: ["planned"],
  notes: ["test local tts capability"],
}, registry);
assert(localCapability.blockers.length === 0, `local Qwen3 TTS capability must validate: ${localCapability.blockers.join("; ")}`);
assert(localCapability.capability?.providerId === "local-qwen3-tts-clone", "audio.tts capability should select local Qwen3 TTS clone");
assert(registry.capabilities.some((capability) => capability.providerId === "local-qwen3-tts-clone"), "registry must include local Qwen3 TTS clone capability");
assert(registry.capabilities.some((capability) => capability.providerId === "cloud-tts"), "registry must also include cloud TTS capability");

const audioPlans: AudioPlan[] = [
  {
    shotId: "shot_001",
    narrationText: "她轻声说，今天我们先把声音做好。",
    dialogueLines: [],
    voiceSourceId: "voice_main",
    deliveryNotes: "calm",
    ambienceBrief: "room tone",
    bgmProfile: "none",
    musicAllowed: false,
    targetDurationSeconds: 4,
    outputPath: null,
    linkedTtsJobId: null,
    linkedMusicJobId: null,
    audioQaStatus: "UNKNOWN",
  },
];
const ttsPlanning = buildTtsProviderPlanningState({ generatedAt, shotPlans: audioPlans });
assert(ttsPlanning.preferredRoute === "local_qwen3_tts_clone", "TTS planning should prefer local Qwen3 voice cloning");
assert(ttsPlanning.providers.length === 3, "TTS planning must prepare local, local Qwen3 clone, and cloud routes");
assert(ttsPlanning.summary.maxLocalConcurrency === 1, "local TTS max concurrency mismatch");
assert(ttsPlanning.summary.maxCloudConcurrency === 3, "cloud TTS max concurrency mismatch");
assert(ttsPlanning.submitPlanDrafts.length === 1, "narration text should create one submit-plan draft");
assert(ttsPlanning.submitPlanDrafts[0].routePreference.join(",") === "local_qwen3_tts_clone,local_index_tts,cloud_tts", "route preference mismatch");
assert(ttsPlanning.submitPlanDrafts[0].expectedOutputPath === "audio/tts/shot_001.wav", "TTS output must be project-relative");
assert(ttsPlanning.submitPlanDrafts[0].permissionRequired === true, "TTS submit must require permission");
assert(ttsPlanning.submitPlanDrafts[0].canSubmitProvider === false, "TTS submit draft cannot call provider directly");
assert(validateTtsProviderPlanningState(ttsPlanning).ok, "TTS provider planning should validate");

const audioPlanning = buildAudioPlanningState({
  generatedAt,
  shots: [{
    id: "shot_002",
    storyFunction: "测试音频计划。",
    videoPath: null,
  }],
  runtimeConfig,
});
assert(audioPlanning.ttsProviderPlanning?.providers.length === 3, "audio planning must include TTS provider routes");
assert(audioPlanning.ttsProviderPlanning?.preferredRoute === "local_qwen3_tts_clone", "audio planning should prefer Qwen3 voice cloning");
assert(audioPlanning.exportPackageSummary.plannedCategories.includes("tts_provider_config"), "export summary should include TTS provider config");

const dialogueAudioPlanning = buildAudioPlanningState({
  generatedAt,
  shots: [{
    id: "shot_003",
    storyFunction: "镜号：1-2。画面：少女看向门口。字幕：ねえ、見て。音效：雨水滴落。",
    videoPath: null,
  }],
  runtimeConfig,
});
assert(dialogueAudioPlanning.shotPlans[0]?.dialogueLines[0] === "ねえ、見て", "storyboard subtitle should become dialogue text");
assert(dialogueAudioPlanning.shotPlans[0]?.ambienceBrief === "雨水滴落", "storyboard sound should become ambience brief");
assert(dialogueAudioPlanning.ttsProviderPlanning?.submitPlanDrafts.length === 1, "dialogue text should create a Qwen3 TTS submit draft");
assert(dialogueAudioPlanning.ttsProviderPlanning?.submitPlanDrafts[0]?.routePreference[0] === "local_qwen3_tts_clone", "dialogue TTS draft should prefer Qwen3");

const serialized = JSON.stringify({ runtimeConfig, ttsPlanning, audioPlanning });
for (const forbidden of ["VIBE_TTS_API_KEY=", "sk-", "tvly-", "actual-api-key"]) {
  assert(!serialized.includes(forbidden), `TTS planning must not leak secrets: ${forbidden}`);
}

console.log("tts-provider-planning-test: ok");
