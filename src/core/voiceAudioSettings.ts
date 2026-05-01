import type { AudioPlanningState, AudioProviderSlotSummary } from "./types";
import type { VoiceSourceLibraryEntry, VoiceSourceLibraryState } from "./voiceSourceLibrary";

export const voiceAudioSettingsSchemaVersion = "0.1.0";
export const voiceAudioSettingsPhase = "phase_28_voice_audio_settings_ui";
export const voiceAudioSettingsScope = "voice_audio_project_facts";

export type VoiceAudioSettingsReadiness = "ready" | "planned" | "blocked";

export interface VoiceAudioSettingsRequestIntent {
  providerSubmitRequested?: boolean;
  ttsSubmitRequested?: boolean;
  musicSubmitRequested?: boolean;
  liveSubmitRequested?: boolean;
  credentialReadRequested?: boolean;
  credentialWriteRequested?: boolean;
  secretStorageRequested?: boolean;
  sampleAudioCopyRequested?: boolean;
  fileMutationRequested?: boolean;
  videoProviderBgmPromptRequested?: boolean;
  videoProviderPromptText?: string;
}

export interface VoiceAudioSourceSummary {
  total: number;
  locked: number;
  candidate: number;
  rejected: number;
  narrator: number;
  character: number;
  music: number;
  ambience: number;
  ttsReady: number;
  futureReferenceReady: number;
  rejectedInputCount: number;
  sourceHardLocksOk: boolean;
  storesSecrets: false;
  providerSubmitAllowed: false;
  liveSubmitAllowed: false;
}

export interface VoiceAudioProviderSlotState {
  slot: "audio.tts" | "audio.music";
  state: string;
  activeProvider?: string;
  allowedProviderCount: number;
  liveSubmitAllowed: false;
}

export interface VoiceAudioSettingSummary {
  shotPlanCount: number;
  previewMixPlaceholderCount: number;
  previewEventCount: number;
  missingOutputCount: number;
  providerSlotStates: VoiceAudioProviderSlotState[];
  shotPlansWithMusicAllowed: number;
  linkedTtsJobCount: number;
  linkedMusicJobCount: number;
}

export interface VoiceAudioVideoProviderPolicy {
  noBgmForVideoProvider: true;
  musicAllowed: false;
  bgmHandledBy: "audio_plan_or_post_import";
  bgmIncludedInVideoPrompt: false;
  defaultVideoPromptConstraint: "no bgm";
  ambienceSfxPlaceholderAllowed: true;
}

export interface VoiceAudioSettingsControls {
  addVoiceSourceMode: "metadata_only";
  changeVoiceRequires: "voice_change_transaction";
  bgmMusicRouting: "audio_plan_or_post_import";
  ambienceSfxPlaceholderAllowed: true;
  previewMixMode: "placeholder_only";
  credentialsMode: "not_read_or_stored";
  sampleAudioMode: "metadata_reference_only";
  fileMutationMode: "blocked";
}

export interface VoiceAudioSettingsHardLocks {
  settingsOnly: true;
  noProviderSubmit: true;
  noTtsSubmit: true;
  noMusicSubmit: true;
  noCredentialRead: true;
  noCredentialWrite: true;
  noSecretStorage: true;
  noSampleAudioCopy: true;
  noFileMutation: true;
  noBgmInVideoProvider: true;
  noVideoProviderBgmPrompt: true;
  liveSubmitAllowed: false;
}

export interface VoiceAudioSettingsState {
  schemaVersion: string;
  generatedAt: string;
  phase: typeof voiceAudioSettingsPhase;
  scope: typeof voiceAudioSettingsScope;
  readiness: VoiceAudioSettingsReadiness;
  voiceSourceSummary: VoiceAudioSourceSummary;
  audioSettingSummary: VoiceAudioSettingSummary;
  videoProviderAudioPolicy: VoiceAudioVideoProviderPolicy;
  settingsControls: VoiceAudioSettingsControls;
  hardLocks: VoiceAudioSettingsHardLocks;
  blockers: string[];
  warnings: string[];
  notes: string[];
  settingsOnly: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
}

export interface BuildVoiceAudioSettingsStateInput {
  generatedAt: string;
  voiceSourceLibrary: VoiceSourceLibraryState;
  audioPlanning: AudioPlanningState;
  requestIntent?: VoiceAudioSettingsRequestIntent;
}

export interface VoiceAudioSettingsValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checkedAt: string;
}

export const voiceAudioSettingsHardLocks: VoiceAudioSettingsHardLocks = {
  settingsOnly: true,
  noProviderSubmit: true,
  noTtsSubmit: true,
  noMusicSubmit: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noSecretStorage: true,
  noSampleAudioCopy: true,
  noFileMutation: true,
  noBgmInVideoProvider: true,
  noVideoProviderBgmPrompt: true,
  liveSubmitAllowed: false,
};

const expectedVoiceSourceHardLocks = {
  noProviderSubmit: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
  noCredentialRead: true,
  noCredentialWrite: true,
  noSecretStorage: true,
  noSampleAudioCopy: true,
  noFileMutation: true,
  noTtsSubmit: true,
  noMusicSubmit: true,
  noBgmInVideoProvider: true,
} as const;

const videoPromptAudioPattern = /\b(bgm|background\s+music|music\s+bed|music|soundtrack|score)\b/i;
const negativeAudioConstraintPattern = /\b(no|without|exclude|omit|disable)\s+(bgm|background\s+music|music\s+bed|music|soundtrack|score)\b/i;

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function entryRoleCount(sources: VoiceSourceLibraryEntry[], role: VoiceSourceLibraryEntry["role"]): number {
  return sources.filter((source) => source.role === role).length;
}

function hardLockDrift(
  locks: Record<string, unknown> | undefined,
  expected: Record<string, boolean>,
  label: string,
): string[] {
  return Object.entries(expected).flatMap(([key, value]) => (locks?.[key] === value ? [] : [`${label} hard lock ${key} drifted.`]));
}

function summarizeVoiceSources(library: VoiceSourceLibraryState, blockers: string[]): VoiceAudioSourceSummary {
  const sources = library.sources || [];
  const sourceHardLocksOk = hardLockDrift(library.hardLocks as Record<string, unknown> | undefined, expectedVoiceSourceHardLocks, "Voice source library").length === 0;
  if (!sourceHardLocksOk) blockers.push("Voice source library hard locks drifted.");

  return {
    total: sources.length,
    locked: sources.filter((source) => source.status === "locked").length,
    candidate: sources.filter((source) => source.status === "candidate").length,
    rejected: sources.filter((source) => source.status === "rejected").length,
    narrator: entryRoleCount(sources, "narrator"),
    character: entryRoleCount(sources, "character"),
    music: entryRoleCount(sources, "music_profile"),
    ambience: entryRoleCount(sources, "ambience_profile"),
    ttsReady: sources.filter((source) => source.canUseForTtsPlan && source.status === "locked").length,
    futureReferenceReady: sources.filter((source) => source.canUseAsFutureReference).length,
    rejectedInputCount: library.rejectedInputs?.length || 0,
    sourceHardLocksOk,
    storesSecrets: false,
    providerSubmitAllowed: false,
    liveSubmitAllowed: false,
  };
}

function summarizeProviderSlot(slot: AudioProviderSlotSummary): VoiceAudioProviderSlotState {
  return {
    slot: slot.slot,
    state: slot.state,
    activeProvider: slot.activeProvider,
    allowedProviderCount: slot.allowedProviders.length,
    liveSubmitAllowed: false,
  };
}

function summarizeAudioSettings(audioPlanning: AudioPlanningState): VoiceAudioSettingSummary {
  return {
    shotPlanCount: audioPlanning.shotPlans.length,
    previewMixPlaceholderCount: audioPlanning.previewMix.generatedFromAudioPlan ? 1 : 0,
    previewEventCount: audioPlanning.previewMix.eventCount,
    missingOutputCount: audioPlanning.previewMix.missingOutputPathCount,
    providerSlotStates: audioPlanning.providerSlots.map(summarizeProviderSlot),
    shotPlansWithMusicAllowed: audioPlanning.shotPlans.filter((plan) => plan.musicAllowed).length,
    linkedTtsJobCount: audioPlanning.shotPlans.filter((plan) => Boolean(plan.linkedTtsJobId)).length,
    linkedMusicJobCount: audioPlanning.shotPlans.filter((plan) => Boolean(plan.linkedMusicJobId)).length,
  };
}

function collectRequestBlockers(intent: VoiceAudioSettingsRequestIntent | undefined): string[] {
  if (!intent) return [];
  const blockers: string[] = [];
  if (intent.providerSubmitRequested) blockers.push("Provider submit is blocked in Phase 28 voice/audio settings.");
  if (intent.ttsSubmitRequested) blockers.push("TTS submit is blocked in Phase 28 voice/audio settings.");
  if (intent.musicSubmitRequested) blockers.push("Music submit is blocked in Phase 28 voice/audio settings.");
  if (intent.liveSubmitRequested) blockers.push("Live submit is blocked in Phase 28 voice/audio settings.");
  if (intent.credentialReadRequested) blockers.push("Credential read is blocked in Phase 28 voice/audio settings.");
  if (intent.credentialWriteRequested) blockers.push("Credential write is blocked in Phase 28 voice/audio settings.");
  if (intent.secretStorageRequested) blockers.push("Secret storage is blocked in Phase 28 voice/audio settings.");
  if (intent.sampleAudioCopyRequested) blockers.push("Sample audio copy is blocked; only metadata references are allowed.");
  if (intent.fileMutationRequested) blockers.push("File mutation is blocked in Phase 28 voice/audio settings.");
  if (intent.videoProviderBgmPromptRequested) blockers.push("BGM text cannot be sent to video provider prompts.");

  if (hasPositiveVideoPromptAudioIntent(intent.videoProviderPromptText || "")) {
    blockers.push("Video provider prompt contains positive BGM/music intent.");
  }

  return blockers;
}

function hasPositiveVideoPromptAudioIntent(promptText: string): boolean {
  return promptText
    .split(/[.,;]|\bbut\b|\bhowever\b|\band then\b/i)
    .some((clause) => videoPromptAudioPattern.test(clause) && !negativeAudioConstraintPattern.test(clause));
}

function collectVoiceSourceBlockers(library: VoiceSourceLibraryState): string[] {
  const blockers = [
    ...hardLockDrift(library.hardLocks as Record<string, unknown> | undefined, expectedVoiceSourceHardLocks, "Voice source library"),
  ];

  if (library.libraryPurpose !== "voice_source_memory") blockers.push("Voice source library purpose must remain voice_source_memory.");
  if (library.privateAuthMaterialForbidden !== true) blockers.push("Voice source library must forbid private auth material.");
  if (library.providerSubmissionForbidden !== true || library.liveSubmitAllowed !== false) {
    blockers.push("Voice source library must keep provider submission blocked.");
  }
  if (library.summary.storesSecrets !== false) blockers.push("Voice source summary must not store secrets.");
  if (library.summary.providerSubmitAllowed !== false || library.summary.liveSubmitAllowed !== false) {
    blockers.push("Voice source summary must not allow provider or live submit.");
  }

  for (const source of library.sources || []) {
    if (source.storesCredential !== false) blockers.push(`${source.id} must not store credentials.`);
    if (source.storesSampleAudioFile !== false) blockers.push(`${source.id} must not store sample audio files.`);
    if (source.privateAuthMaterialForbidden !== true) blockers.push(`${source.id} must forbid private auth material.`);
    if (source.providerSubmissionForbidden !== true || source.liveSubmitAllowed !== false) {
      blockers.push(`${source.id} must keep provider submission blocked.`);
    }
    blockers.push(...source.blockers.map((blocker) => `${source.id}: ${blocker}`));
  }

  return blockers;
}

function collectAudioPlanningBlockers(audioPlanning: AudioPlanningState): string[] {
  const blockers: string[] = [];
  if (audioPlanning.dryRunOnly !== true || audioPlanning.providerSubmissionForbidden !== true) {
    blockers.push("Audio planning must stay dry-run with provider submission forbidden.");
  }
  if (audioPlanning.voiceSourceRegistry.storesSecrets !== false) blockers.push("Audio voice source registry must not store secrets.");
  if (audioPlanning.voiceSourceRegistry.changeTransactionRequired !== true) {
    blockers.push("Voice changes must require voice_change_transaction.");
  }
  if (audioPlanning.voiceSourceRegistry.liveSubmitAllowed !== false || audioPlanning.voiceSourceRegistry.providerSubmissionForbidden !== true) {
    blockers.push("Audio voice source registry must keep provider submission blocked.");
  }
  if (audioPlanning.previewMix.dryRunOnly !== true || audioPlanning.previewMix.providerSubmissionForbidden !== true) {
    blockers.push("Preview mix must remain a dry-run placeholder.");
  }
  if (audioPlanning.videoProviderPolicy.noBgmForVideoProvider !== true) {
    blockers.push("Video provider policy must keep noBgmForVideoProvider=true.");
  }
  if (audioPlanning.videoProviderPolicy.musicAllowed !== false) {
    blockers.push("Video provider policy must keep musicAllowed=false.");
  }
  if (audioPlanning.videoProviderPolicy.bgmHandledBy !== "audio_plan_or_post_import") {
    blockers.push("BGM must be handled by audio plan or post import.");
  }
  for (const slot of audioPlanning.providerSlots) {
    if (slot.liveSubmitAllowed !== false) blockers.push(`${slot.slot} live submit must remain false.`);
  }
  for (const plan of audioPlanning.shotPlans) {
    if (plan.musicAllowed !== false) blockers.push(`${plan.shotId} musicAllowed must remain false for Phase 28 settings facts.`);
  }
  return blockers;
}

function collectWarnings(library: VoiceSourceLibraryState, audioPlanning: AudioPlanningState): string[] {
  const warnings = (library.sources || []).flatMap((source) => source.warnings.map((warning) => `${source.id}: ${warning}`));
  if ((library.rejectedInputs || []).length) warnings.push("Rejected voice source inputs exist and remain blocked metadata.");
  if (audioPlanning.previewMix.missingOutputPathCount > 0) {
    warnings.push("Audio preview mix has missing output paths; Phase 28 records placeholders only.");
  }
  for (const slot of audioPlanning.providerSlots) {
    if (slot.state === "enabled" || slot.state === "active") {
      warnings.push(`${slot.slot} is ${slot.state} upstream; Phase 28 still exposes settings facts only.`);
    }
  }
  return uniqueSorted(warnings);
}

function readinessFor(blockers: string[], voiceSummary: VoiceAudioSourceSummary, audioSummary: VoiceAudioSettingSummary): VoiceAudioSettingsReadiness {
  if (blockers.length) return "blocked";
  if (voiceSummary.total === 0 && audioSummary.shotPlanCount === 0) return "planned";
  return "ready";
}

export function buildVoiceAudioSettingsState(input: BuildVoiceAudioSettingsStateInput): VoiceAudioSettingsState {
  const blockers: string[] = [];
  const voiceSourceSummary = summarizeVoiceSources(input.voiceSourceLibrary, blockers);
  const audioSettingSummary = summarizeAudioSettings(input.audioPlanning);
  blockers.push(...collectRequestBlockers(input.requestIntent));
  blockers.push(...collectVoiceSourceBlockers(input.voiceSourceLibrary));
  blockers.push(...collectAudioPlanningBlockers(input.audioPlanning));
  const uniqueBlockers = uniqueSorted(blockers);

  return {
    schemaVersion: voiceAudioSettingsSchemaVersion,
    generatedAt: input.generatedAt,
    phase: voiceAudioSettingsPhase,
    scope: voiceAudioSettingsScope,
    readiness: readinessFor(uniqueBlockers, voiceSourceSummary, audioSettingSummary),
    voiceSourceSummary,
    audioSettingSummary,
    videoProviderAudioPolicy: {
      noBgmForVideoProvider: true,
      musicAllowed: false,
      bgmHandledBy: "audio_plan_or_post_import",
      bgmIncludedInVideoPrompt: false,
      defaultVideoPromptConstraint: "no bgm",
      ambienceSfxPlaceholderAllowed: true,
    },
    settingsControls: {
      addVoiceSourceMode: "metadata_only",
      changeVoiceRequires: "voice_change_transaction",
      bgmMusicRouting: "audio_plan_or_post_import",
      ambienceSfxPlaceholderAllowed: true,
      previewMixMode: "placeholder_only",
      credentialsMode: "not_read_or_stored",
      sampleAudioMode: "metadata_reference_only",
      fileMutationMode: "blocked",
    },
    hardLocks: voiceAudioSettingsHardLocks,
    blockers: uniqueBlockers,
    warnings: collectWarnings(input.voiceSourceLibrary, input.audioPlanning),
    notes: [
      "Phase 28 converts voice/audio settings into structured project facts only.",
      "Voice source additions are metadata-only and voice changes require voice_change_transaction.",
      "BGM/music belongs in the audio plan or post import; video provider prompts keep the default constraint: no bgm.",
    ],
    settingsOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
  };
}

export function validateVoiceAudioSettingsState(
  state: VoiceAudioSettingsState,
  checkedAt = state.generatedAt,
): VoiceAudioSettingsValidationResult {
  const errors: string[] = [];

  if (state.schemaVersion !== voiceAudioSettingsSchemaVersion) errors.push("Voice/audio settings schema version drifted.");
  if (state.phase !== voiceAudioSettingsPhase) errors.push("Voice/audio settings phase drifted.");
  if (state.scope !== voiceAudioSettingsScope) errors.push("Voice/audio settings scope drifted.");
  if (state.settingsOnly !== true || state.providerSubmissionForbidden !== true || state.liveSubmitAllowed !== false) {
    errors.push("Voice/audio settings must remain settings-only with provider submission blocked.");
  }
  for (const [key, expected] of Object.entries(voiceAudioSettingsHardLocks)) {
    if (state.hardLocks[key as keyof VoiceAudioSettingsHardLocks] !== expected) errors.push(`Hard lock ${key} drifted.`);
  }
  if (state.videoProviderAudioPolicy.noBgmForVideoProvider !== true) errors.push("Video provider policy must keep noBgmForVideoProvider=true.");
  if (state.videoProviderAudioPolicy.musicAllowed !== false) errors.push("Video provider policy must keep musicAllowed=false.");
  if (state.videoProviderAudioPolicy.bgmHandledBy !== "audio_plan_or_post_import") {
    errors.push("Video provider policy must keep bgmHandledBy=audio_plan_or_post_import.");
  }
  if (state.videoProviderAudioPolicy.bgmIncludedInVideoPrompt !== false) {
    errors.push("BGM must not be included in video provider prompts.");
  }
  if (state.videoProviderAudioPolicy.defaultVideoPromptConstraint !== "no bgm") {
    errors.push("Default video prompt audio constraint must be no bgm.");
  }
  if (state.settingsControls.addVoiceSourceMode !== "metadata_only") errors.push("Add voice source control must be metadata-only.");
  if (state.settingsControls.changeVoiceRequires !== "voice_change_transaction") {
    errors.push("Voice changes must require voice_change_transaction.");
  }
  if (state.voiceSourceSummary.storesSecrets !== false || state.voiceSourceSummary.providerSubmitAllowed !== false) {
    errors.push("Voice source summary must not store secrets or allow provider submit.");
  }
  for (const slot of state.audioSettingSummary.providerSlotStates) {
    if (slot.liveSubmitAllowed !== false) errors.push(`${slot.slot} live submit must remain false.`);
  }
  if (state.readiness !== "blocked" && state.blockers.length) errors.push("State with blockers must have blocked readiness.");
  if (state.readiness === "blocked" && state.blockers.length === 0) errors.push("Blocked readiness must include at least one blocker.");

  return {
    ok: errors.length === 0,
    errors: uniqueSorted(errors),
    warnings: state.warnings,
    checkedAt,
  };
}
