import type {
  AudioPlan,
  TtsProviderCandidate,
  TtsProviderPlanningState,
  TtsProviderRoute,
  TtsSubmitPlanDraft,
} from "./types";

export const ttsProviderPlanningSchemaVersion = "0.1.0";

export interface BuildTtsProviderPlanningStateInput {
  generatedAt: string;
  shotPlans: AudioPlan[];
  preferredRoute?: TtsProviderRoute;
}

export interface TtsProviderPlanningValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checkedAt: string;
}

function safeId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "tts";
}

function stableTextHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function localIndexTtsProvider(): TtsProviderCandidate {
  return {
    providerId: "local-index-tts",
    label: "Local IndexTTS",
    route: "local_index_tts",
    executionSurface: "local_cli",
    state: "planned",
    commandEnvKey: "VIBE_INDEX_TTS_COMMAND",
    modelDirEnvKey: "VIBE_INDEX_TTS_MODEL_DIR",
    speakerWavEnvKey: "VIBE_INDEX_TTS_SPEAKER_WAV",
    modelEnvKey: "VIBE_INDEX_TTS_MODEL",
    voiceIdEnvKey: "VIBE_INDEX_TTS_VOICE_ID",
    outputFormat: "wav",
    maxConcurrentJobs: 1,
    maxAutoRetries: 1,
    timeoutSeconds: 600,
    storesSecrets: false,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      "Local IndexTTS is kept as a secondary project-runtime sidecar command, not the default demo route.",
      "The model path and speaker wav are configured through environment/local settings and are not stored in Project.vibe.",
      "Default concurrency is one because local voice cloning is CPU/GPU-memory sensitive.",
    ],
  };
}

function localQwen3TtsCloneProvider(): TtsProviderCandidate {
  return {
    providerId: "local-qwen3-tts-clone",
    label: "Local Qwen3 TTS Clone",
    route: "local_qwen3_tts_clone",
    executionSurface: "local_cli",
    state: "planned",
    commandEnvKey: "VIBE_QWEN3_TTS_COMMAND",
    modelDirEnvKey: "VIBE_QWEN3_TTS_MODEL_DIR",
    speakerWavEnvKey: "VIBE_QWEN3_TTS_SPEAKER_WAV",
    modelEnvKey: "VIBE_QWEN3_TTS_MODEL",
    voiceIdEnvKey: "VIBE_QWEN3_TTS_VOICE_ID",
    outputFormat: "wav",
    maxConcurrentJobs: 1,
    maxAutoRetries: 1,
    timeoutSeconds: 900,
    storesSecrets: false,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      "Local Qwen3-TTS Base is prepared for multilingual voice cloning, including Japanese voice-clone tests.",
      "The Qwen3 Base model, reference speaker wav, and future runner command are configured through environment/local settings and are not stored in Project.vibe.",
      "Qwen3 VoiceDesign is parked as an offline voice-drafting resource and is not included in submit plan routePreference by default.",
    ],
  };
}

function cloudTtsProvider(): TtsProviderCandidate {
  return {
    providerId: "cloud-tts",
    label: "Cloud TTS",
    route: "cloud_tts",
    executionSurface: "cloud_api",
    state: "planned",
    baseUrlEnvKey: "VIBE_TTS_BASE_URL",
    apiKeyEnvKey: "VIBE_TTS_API_KEY",
    modelEnvKey: "VIBE_TTS_MODEL",
    voiceIdEnvKey: "VIBE_TTS_VOICE_ID",
    outputFormat: "mp3",
    maxConcurrentJobs: 3,
    maxAutoRetries: 2,
    timeoutSeconds: 180,
    storesSecrets: false,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      "Cloud TTS is a replaceable provider slot and does not assume a specific vendor.",
      "API key material stays in the runtime credential layer, never in Project.vibe or export packages.",
      "Default cloud concurrency is prepared as three jobs with retry backoff once a real provider is selected.",
    ],
  };
}

function textForPlan(plan: AudioPlan): string {
  return [plan.narrationText, ...plan.dialogueLines]
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function buildSubmitDraft(plan: AudioPlan, preferredRoute: TtsProviderRoute): TtsSubmitPlanDraft | null {
  const text = textForPlan(plan);
  if (!text) return null;
  const shotId = safeId(plan.shotId);
  const routePreferenceByPreferred: Record<TtsProviderRoute, TtsProviderRoute[]> = {
    local_index_tts: ["local_index_tts", "local_qwen3_tts_clone", "cloud_tts"],
    local_qwen3_tts_clone: ["local_qwen3_tts_clone", "local_index_tts", "cloud_tts"],
    cloud_tts: ["cloud_tts", "local_qwen3_tts_clone", "local_index_tts"],
  };
  const routePreference = routePreferenceByPreferred[preferredRoute] || routePreferenceByPreferred.local_qwen3_tts_clone;

  return {
    planId: `tts_plan_${shotId}_${stableTextHash(text).replace(/[^a-zA-Z0-9]+/g, "_")}`,
    shotId: plan.shotId,
    providerSlot: "audio.tts",
    requiredMode: "tts",
    routePreference,
    voiceSourceId: plan.voiceSourceId ?? null,
    textHash: stableTextHash(text),
    textPreview: text.length > 80 ? `${text.slice(0, 77)}...` : text,
    expectedOutputPath: `audio/tts/${shotId}.wav`,
    permissionRequired: true,
    canSubmitProvider: false,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    blockers: plan.voiceSourceId ? [] : ["No voice source is bound to this audio plan."],
    notes: [
      "This is a submit-plan draft only. A permission receipt is required before local or cloud TTS execution.",
      "Output path is project-relative and can be regenerated safely.",
    ],
  };
}

export function buildTtsProviderPlanningState(input: BuildTtsProviderPlanningStateInput): TtsProviderPlanningState {
  const preferredRoute = input.preferredRoute || "local_qwen3_tts_clone";
  const providers = [localQwen3TtsCloneProvider(), localIndexTtsProvider(), cloudTtsProvider()];
  const submitPlanDrafts = input.shotPlans
    .map((plan) => buildSubmitDraft(plan, preferredRoute))
    .filter((plan): plan is TtsSubmitPlanDraft => Boolean(plan));

  return {
    schemaVersion: ttsProviderPlanningSchemaVersion,
    generatedAt: input.generatedAt,
    preferredRoute,
    providers,
    submitPlanDrafts,
    summary: {
      localReadyToConfigure: providers.some((provider) => provider.route === "local_index_tts"),
      cloudReadyToConfigure: providers.some((provider) => provider.route === "cloud_tts"),
      submitDraftCount: submitPlanDrafts.length,
      maxLocalConcurrency: providers.find((provider) => provider.route === preferredRoute)?.maxConcurrentJobs
        || providers.find((provider) => provider.route === "local_qwen3_tts_clone")?.maxConcurrentJobs
        || providers.find((provider) => provider.route === "local_index_tts")?.maxConcurrentJobs
        || 0,
      maxCloudConcurrency: providers.find((provider) => provider.route === "cloud_tts")?.maxConcurrentJobs || 0,
      storesSecrets: false,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
    },
    hardLocks: {
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      noSecretStorage: true,
      permissionReceiptRequired: true,
      projectRelativeOutputOnly: true,
    },
    notes: [
      "TTS defaults to local Qwen3 voice cloning for multilingual dialogue, especially Japanese; IndexTTS remains a secondary local fallback.",
      "Agent output should create a TTS submit plan; runtime execution requires an explicit permission receipt.",
      "Generated audio should be written under project-relative audio/tts or .vibe-runtime/tts before preview/export promotion.",
    ],
  };
}

export function validateTtsProviderPlanningState(
  state: TtsProviderPlanningState,
  checkedAt = state.generatedAt,
): TtsProviderPlanningValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const local = state.providers.find((provider) => provider.route === "local_index_tts");
  const qwen3 = state.providers.find((provider) => provider.route === "local_qwen3_tts_clone");
  const cloud = state.providers.find((provider) => provider.route === "cloud_tts");

  if (state.schemaVersion !== ttsProviderPlanningSchemaVersion) errors.push("TTS provider planning schema version drifted.");
  if (!local) errors.push("Local IndexTTS provider candidate is missing.");
  if (!qwen3) errors.push("Local Qwen3 TTS voice-clone provider candidate is missing.");
  if (!cloud) errors.push("Cloud TTS provider candidate is missing.");
  if (state.hardLocks.providerSubmissionForbidden !== true || state.hardLocks.liveSubmitAllowed !== false) {
    errors.push("TTS provider planning must keep provider submission gated.");
  }
  if (state.hardLocks.noSecretStorage !== true) errors.push("TTS provider planning must not store secrets.");
  if (state.hardLocks.permissionReceiptRequired !== true) errors.push("TTS provider planning must require permission receipts.");

  for (const provider of state.providers) {
    if (provider.storesSecrets !== false) errors.push(`${provider.providerId} must not store secrets.`);
    if (provider.providerSubmissionForbidden !== true || provider.liveSubmitAllowed !== false) {
      errors.push(`${provider.providerId} must stay gated before explicit execution.`);
    }
    if (provider.route === "local_index_tts" && (!provider.commandEnvKey || !provider.modelDirEnvKey || !provider.speakerWavEnvKey)) {
      errors.push("Local IndexTTS must expose command, model dir, and speaker wav env keys.");
    }
    if (provider.route === "local_qwen3_tts_clone" && (!provider.commandEnvKey || !provider.modelDirEnvKey || !provider.speakerWavEnvKey)) {
      errors.push("Local Qwen3 TTS clone must expose command, model dir, and speaker wav env keys.");
    }
    if (provider.route === "cloud_tts" && (!provider.baseUrlEnvKey || !provider.apiKeyEnvKey)) {
      errors.push("Cloud TTS must expose base URL and API key env keys.");
    }
  }

  for (const draft of state.submitPlanDrafts) {
    if (draft.permissionRequired !== true || draft.canSubmitProvider !== false || draft.providerSubmissionForbidden !== true) {
      errors.push(`${draft.planId} must remain a gated TTS submit-plan draft.`);
    }
    if (draft.expectedOutputPath.startsWith("/") || draft.expectedOutputPath.includes("..")) {
      errors.push(`${draft.planId} must use a safe project-relative output path.`);
    }
    warnings.push(...draft.blockers.map((blocker) => `${draft.planId}: ${blocker}`));
  }

  return {
    ok: errors.length === 0,
    errors: Array.from(new Set(errors)).sort((left, right) => left.localeCompare(right)),
    warnings: Array.from(new Set(warnings)).sort((left, right) => left.localeCompare(right)),
    checkedAt,
  };
}
