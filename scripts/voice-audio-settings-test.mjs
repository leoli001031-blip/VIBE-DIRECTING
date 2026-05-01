import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

async function importTs(path) {
  const source = fs.readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: path,
  }).outputText;
  const encoded = Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

function buildRuntimeConfig(runtimeVoiceSources, slots = providerSlots()) {
  return {
    voiceSources: runtimeVoiceSources,
    providerEnablement: { slots },
  };
}

function providerSlots(overrides = {}) {
  return [
    {
      slot: "audio.tts",
      state: "planned",
      activeProvider: "tts-provider-planned",
      allowedProviders: ["tts-provider-planned"],
      forbiddenProviders: [],
      liveSubmitAllowed: false,
      notes: ["Planned TTS provider slot; no live submit."],
      ...(overrides["audio.tts"] || {}),
    },
    {
      slot: "audio.music",
      state: "planned",
      activeProvider: "music-provider-planned",
      allowedProviders: ["music-provider-planned"],
      forbiddenProviders: [],
      liveSubmitAllowed: false,
      notes: ["Planned music provider slot; no live submit."],
      ...(overrides["audio.music"] || {}),
    },
  ];
}

function shot(id, storyFunction) {
  return {
    id,
    storyFunction,
    videoPath: null,
  };
}

function assertBlocked(state, expectedSnippet) {
  assert(state.readiness === "blocked", `${expectedSnippet} should block`);
  assert(state.blockers.some((blocker) => blocker.toLowerCase().includes(expectedSnippet.toLowerCase())), `${expectedSnippet} blocker missing: ${state.blockers.join("; ")}`);
}

const voiceSourceLibrary = await importTs("src/core/voiceSourceLibrary.ts");
const audioPlanning = await importTs("src/core/audioPlanning.ts");
const voiceAudioSettings = await importTs("src/core/voiceAudioSettings.ts");

const {
  addVoiceSource,
  buildVoiceSourceLibraryState,
  toRuntimeVoiceSources,
} = voiceSourceLibrary;
const { buildAudioPlanningState } = audioPlanning;
const {
  buildVoiceAudioSettingsState,
  validateVoiceAudioSettingsState,
  voiceAudioSettingsHardLocks,
} = voiceAudioSettings;

const generatedAt = "2026-05-01T00:00:00.000Z";
let library = buildVoiceSourceLibraryState({ generatedAt, runtimeVoiceSources: [] });

for (const input of [
  {
    id: "main_narrator",
    displayName: "Main Narrator",
    provider: "tts-provider-planned",
    providerVoiceId: "main-narrator-placeholder",
    language: "zh-CN",
    role: "narrator",
    consentStatus: "user_owned",
    commercialUseStatus: "allowed",
    status: "locked",
    textConstraints: ["warm", "measured", "low register"],
    updatedAt: "2026-05-01T00:01:00.000Z",
  },
  {
    id: "sora_character",
    displayName: "Sora Character Voice",
    provider: "provider-builtin",
    providerVoiceId: "sora-placeholder",
    language: "zh-CN",
    role: "character",
    linkedCharacterId: "sora",
    consentStatus: "unknown",
    commercialUseStatus: "unknown",
    status: "candidate",
    textConstraints: ["restrained", "soft attack"],
    updatedAt: "2026-05-01T00:02:00.000Z",
  },
  {
    id: "piano_bgm_profile",
    displayName: "Sparse Piano BGM",
    provider: "music-provider-planned",
    providerVoiceId: "sparse-piano-placeholder",
    language: "instrumental",
    role: "music_profile",
    consentStatus: "licensed",
    commercialUseStatus: "restricted",
    status: "candidate",
    textConstraints: ["slow piano", "low emotional pressure"],
    updatedAt: "2026-05-01T00:03:00.000Z",
  },
  {
    id: "rain_ambience",
    displayName: "Soft Rain Ambience",
    provider: "ambience-library-planned",
    providerVoiceId: "soft-rain-placeholder",
    language: "field-recording",
    role: "ambience_profile",
    consentStatus: "licensed",
    commercialUseStatus: "allowed",
    status: "candidate",
    textConstraints: ["soft rain", "distant room tone"],
    updatedAt: "2026-05-01T00:04:00.000Z",
  },
]) {
  const result = addVoiceSource(library, input);
  assert(result.validation.ok, `voice source fixture failed: ${result.validation.errors.join("; ")}`);
  library = result.library;
}

const runtimeVoiceSources = toRuntimeVoiceSources(library);
const plan = buildAudioPlanningState({
  generatedAt,
  shots: [shot("shot_001", "Open the scene with restraint."), shot("shot_002", "Hold on the character choice.")],
  runtimeConfig: buildRuntimeConfig(runtimeVoiceSources),
  previewEvents: [],
});

const readyState = buildVoiceAudioSettingsState({
  generatedAt,
  voiceSourceLibrary: library,
  audioPlanning: plan,
});

assert(readyState.schemaVersion === "0.1.0", "schema version drifted");
assert(readyState.phase === "phase_28_voice_audio_settings_ui", "phase id drifted");
assert(readyState.scope === "voice_audio_project_facts", "scope drifted");
assert(readyState.readiness === "ready", `good fixture should be ready: ${readyState.blockers.join("; ")}`);
assert(readyState.voiceSourceSummary.locked === 1, "locked source count mismatch");
assert(readyState.voiceSourceSummary.candidate === 3, "candidate source count mismatch");
assert(readyState.voiceSourceSummary.rejected === 0, "rejected source count mismatch");
assert(readyState.voiceSourceSummary.narrator === 1, "narrator count mismatch");
assert(readyState.voiceSourceSummary.character === 1, "character count mismatch");
assert(readyState.voiceSourceSummary.music === 1, "music count mismatch");
assert(readyState.voiceSourceSummary.ambience === 1, "ambience count mismatch");
assert(readyState.voiceSourceSummary.ttsReady === 1, "ttsReady count mismatch");
assert(readyState.voiceSourceSummary.futureReferenceReady === 1, "futureReferenceReady count mismatch");
assert(readyState.audioSettingSummary.shotPlanCount === 2, "shot plan count mismatch");
assert(readyState.audioSettingSummary.previewMixPlaceholderCount === 1, "preview mix placeholder count mismatch");
assert(readyState.audioSettingSummary.previewEventCount === 2, "audio preview event count mismatch");
assert(readyState.audioSettingSummary.missingOutputCount === 2, "missing output count mismatch");
assert(readyState.audioSettingSummary.providerSlotStates.length === 2, "provider slot states missing");
assert(readyState.audioSettingSummary.providerSlotStates.every((slot) => slot.liveSubmitAllowed === false), "provider slots must keep liveSubmitAllowed false");
assert(readyState.videoProviderAudioPolicy.noBgmForVideoProvider === true, "video provider no-BGM policy missing");
assert(readyState.videoProviderAudioPolicy.musicAllowed === false, "video provider musicAllowed must be false");
assert(readyState.videoProviderAudioPolicy.bgmHandledBy === "audio_plan_or_post_import", "BGM route must stay audio plan/post import");
assert(readyState.videoProviderAudioPolicy.bgmIncludedInVideoPrompt === false, "BGM must not enter video provider prompt");
assert(readyState.videoProviderAudioPolicy.defaultVideoPromptConstraint === "no bgm", "default video prompt constraint must be no bgm");
assert(readyState.settingsControls.addVoiceSourceMode === "metadata_only", "add voice source must be metadata-only");
assert(readyState.settingsControls.changeVoiceRequires === "voice_change_transaction", "voice changes must require transaction");
assert(readyState.settingsControls.bgmMusicRouting === "audio_plan_or_post_import", "BGM/music routing mismatch");
assert(readyState.settingsControls.ambienceSfxPlaceholderAllowed === true, "ambience/SFX placeholder should be allowed");
assert(validateVoiceAudioSettingsState(readyState).ok, "ready state should validate");

const emptyLibrary = buildVoiceSourceLibraryState({ generatedAt, runtimeVoiceSources: [] });
const emptyPlan = buildAudioPlanningState({
  generatedAt,
  shots: [],
  runtimeConfig: buildRuntimeConfig([]),
  previewEvents: [],
});
const plannedState = buildVoiceAudioSettingsState({
  generatedAt,
  voiceSourceLibrary: emptyLibrary,
  audioPlanning: emptyPlan,
});
assert(plannedState.readiness === "planned", "empty-but-valid settings should be planned");
assert(validateVoiceAudioSettingsState(plannedState).ok, "planned state should validate");

const noBgmPromptState = buildVoiceAudioSettingsState({
  generatedAt,
  voiceSourceLibrary: library,
  audioPlanning: plan,
  requestIntent: { videoProviderPromptText: "Wide shot, no bgm, soft room tone only." },
});
assert(noBgmPromptState.readiness === "ready", "negative no-BGM video prompt constraint should remain ready");

assertBlocked(buildVoiceAudioSettingsState({
  generatedAt,
  voiceSourceLibrary: library,
  audioPlanning: plan,
  requestIntent: { videoProviderPromptText: "Add cinematic BGM under the slow push-in." },
}), "BGM");
assertBlocked(buildVoiceAudioSettingsState({
  generatedAt,
  voiceSourceLibrary: library,
  audioPlanning: plan,
  requestIntent: { videoProviderPromptText: "Wide shot, no bgm, but add a low score." },
}), "BGM");

assertBlocked(buildVoiceAudioSettingsState({
  generatedAt,
  voiceSourceLibrary: library,
  audioPlanning: plan,
  requestIntent: { providerSubmitRequested: true },
}), "Provider submit");
assertBlocked(buildVoiceAudioSettingsState({
  generatedAt,
  voiceSourceLibrary: library,
  audioPlanning: plan,
  requestIntent: { ttsSubmitRequested: true },
}), "TTS submit");
assertBlocked(buildVoiceAudioSettingsState({
  generatedAt,
  voiceSourceLibrary: library,
  audioPlanning: plan,
  requestIntent: { musicSubmitRequested: true },
}), "Music submit");
assertBlocked(buildVoiceAudioSettingsState({
  generatedAt,
  voiceSourceLibrary: library,
  audioPlanning: plan,
  requestIntent: { liveSubmitRequested: true },
}), "Live submit");
assertBlocked(buildVoiceAudioSettingsState({
  generatedAt,
  voiceSourceLibrary: library,
  audioPlanning: plan,
  requestIntent: { credentialReadRequested: true },
}), "Credential read");
assertBlocked(buildVoiceAudioSettingsState({
  generatedAt,
  voiceSourceLibrary: library,
  audioPlanning: plan,
  requestIntent: { credentialWriteRequested: true },
}), "Credential write");
assertBlocked(buildVoiceAudioSettingsState({
  generatedAt,
  voiceSourceLibrary: library,
  audioPlanning: plan,
  requestIntent: { secretStorageRequested: true },
}), "Secret storage");
assertBlocked(buildVoiceAudioSettingsState({
  generatedAt,
  voiceSourceLibrary: library,
  audioPlanning: plan,
  requestIntent: { sampleAudioCopyRequested: true },
}), "Sample audio copy");
assertBlocked(buildVoiceAudioSettingsState({
  generatedAt,
  voiceSourceLibrary: library,
  audioPlanning: plan,
  requestIntent: { fileMutationRequested: true },
}), "File mutation");

const driftedLibrary = structuredClone(library);
driftedLibrary.hardLocks.noCredentialRead = false;
const driftedState = buildVoiceAudioSettingsState({ generatedAt, voiceSourceLibrary: driftedLibrary, audioPlanning: plan });
assert(driftedState.readiness === "blocked", "voice source hard lock drift must block");
assert(driftedState.voiceSourceSummary.sourceHardLocksOk === false, "source hard lock summary should fail closed");
assert(driftedState.blockers.some((blocker) => blocker.includes("noCredentialRead")), "hard lock drift blocker missing");

const driftedAudioPolicy = structuredClone(plan);
driftedAudioPolicy.videoProviderPolicy.musicAllowed = true;
assertBlocked(buildVoiceAudioSettingsState({ generatedAt, voiceSourceLibrary: library, audioPlanning: driftedAudioPolicy }), "musicAllowed");

const liveSlotPlan = structuredClone(plan);
liveSlotPlan.providerSlots[0].liveSubmitAllowed = true;
assertBlocked(buildVoiceAudioSettingsState({ generatedAt, voiceSourceLibrary: library, audioPlanning: liveSlotPlan }), "live submit");

const tamperedState = structuredClone(readyState);
tamperedState.hardLocks.noProviderSubmit = false;
const tamperedValidation = validateVoiceAudioSettingsState(tamperedState);
assert(!tamperedValidation.ok, "state hard lock drift must fail validation");
assert(tamperedValidation.errors.some((error) => error.includes("noProviderSubmit")), "state hard lock validation error missing");

const schema = readJson("schemas/voice_audio_settings.schema.json");
assert(schema.title === "VoiceAudioSettingsState", "schema title drifted");
assert(schema.additionalProperties === false, "schema root must reject additional properties");
assert(schema.properties.schemaVersion.const === "0.1.0", "schema must pin schemaVersion");
assert(schema.properties.phase.const === "phase_28_voice_audio_settings_ui", "schema phase const missing");
assert(schema.properties.scope.const === "voice_audio_project_facts", "schema scope const missing");
assert(schema.properties.settingsOnly.const === true, "schema settingsOnly const missing");
assert(schema.properties.providerSubmissionForbidden.const === true, "schema providerSubmissionForbidden const missing");
assert(schema.properties.liveSubmitAllowed.const === false, "schema liveSubmitAllowed const missing");
assert(schema.$defs.videoProviderAudioPolicy.properties.noBgmForVideoProvider.const === true, "schema noBgmForVideoProvider const missing");
assert(schema.$defs.videoProviderAudioPolicy.properties.musicAllowed.const === false, "schema musicAllowed const missing");
assert(schema.$defs.videoProviderAudioPolicy.properties.bgmIncludedInVideoPrompt.const === false, "schema bgm prompt const missing");
assert(schema.$defs.videoProviderAudioPolicy.properties.defaultVideoPromptConstraint.const === "no bgm", "schema default prompt constraint const missing");
for (const [key, expected] of Object.entries(voiceAudioSettingsHardLocks)) {
  assert(schema.$defs.hardLocks.properties[key].const === expected, `schema hard lock must pin ${key}`);
}
assert(schema.$defs.settingsControls.properties.addVoiceSourceMode.const === "metadata_only", "schema metadata-only control missing");
assert(schema.$defs.settingsControls.properties.changeVoiceRequires.const === "voice_change_transaction", "schema voice change transaction control missing");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("voice_audio_settings.schema.json"), "schema registry must include voice_audio_settings.schema.json");
assert(registrySource.includes("VoiceAudioSettingsState"), "schema registry must include VoiceAudioSettingsState");

const packageJson = readJson("package.json");
assert(packageJson.scripts["voice-audio-settings:test"] === "node scripts/voice-audio-settings-test.mjs", "package script voice-audio-settings:test missing");

const sourceText = fs.readFileSync("src/core/voiceAudioSettings.ts", "utf8");
for (const forbidden of [
  /from\s+["']node:fs["']/,
  /from\s+["']fs["']/,
  /child_process/,
  /\bspawn\s*\(/,
  /\bexec(?:File|Sync)?\s*\(/,
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /\bwriteFile(?:Sync)?\s*\(/,
  /\bcopyFile(?:Sync)?\s*\(/,
  /\.submit\s*\(/,
  /provider\.(?:submit|send|create|generate)\s*\(/i,
  /tts\.(?:submit|send|create|generate)\s*\(/i,
  /music\.(?:submit|send|create|generate)\s*\(/i,
]) {
  assert(!forbidden.test(sourceText), `voiceAudioSettings source contains forbidden runtime primitive: ${forbidden}`);
}

console.log(
  `Voice/audio settings tests passed: ${readyState.readiness} fixture, ${plannedState.readiness} empty state, ${readyState.audioSettingSummary.shotPlanCount} shot plan(s).`,
);
