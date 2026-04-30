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

const {
  addVoiceSource,
  buildVoiceSourceLibraryState,
  markVoiceSourceStatus,
  toRuntimeVoiceSources,
  toVoiceMemoryDocument,
  updateVoiceSource,
  validateVoiceSourceLibraryState,
} = await importTs("src/core/voiceSourceLibrary.ts");

const generatedAt = "2026-05-01T00:00:00.000Z";
let library = buildVoiceSourceLibraryState({
  generatedAt,
  runtimeVoiceSources: [
    {
      id: "voice-registry-placeholder",
      label: "Voice Source Registry",
      status: "placeholder",
      kind: "voice_library",
      notes: ["Reserved metadata only."],
    },
  ],
});

assert(library.phase === "phase18_voice_source_library", "phase id drifted");
assert(library.libraryPurpose === "voice_source_memory", "library purpose drifted");
assert(library.privateAuthMaterialForbidden === true, "private auth must be forbidden");
assert(library.summary.total === 1, "runtime placeholder should seed one source");
assert(library.summary.storesSecrets === false, "voice library must not store secrets");
assert(library.hardLocks.noTtsSubmit === true, "TTS submit lock missing");
assert(library.hardLocks.noMusicSubmit === true, "music submit lock missing");
assert(library.hardLocks.noBgmInVideoProvider === true, "no-BGM video lock missing");

let result = addVoiceSource(library, {
  id: "narrator_main",
  displayName: "Main Narrator",
  provider: "openai-tts-planned",
  providerVoiceId: "alloy-placeholder",
  language: "zh-CN",
  role: "narrator",
  samplePath: "/Users/example/Desktop/narrator.wav",
  samplePathOrigin: "user_selected_import",
  sampleImportId: "narrator-import",
  consentStatus: "user_owned",
  commercialUseStatus: "allowed",
  status: "locked",
  textConstraints: ["calm", "low register", "measured delivery"],
  updatedAt: "2026-05-01T00:01:00.000Z",
});
assert(result.validation.ok, `locked narrator should validate: ${result.validation.errors.join("; ")}`);
assert(result.source.status === "locked", "narrator should lock with known consent/commercial status");
assert(result.source.canUseForTtsPlan === true, "locked narrator should be usable for TTS planning");
assert(result.source.canUseAsFutureReference === true, "locked narrator can be future voice reference");
assert(result.source.samplePath.rawPathRedacted === true, "user sample raw path must be redacted");
assert(!result.source.samplePath.path.includes("/Users/"), "absolute sample path must not persist");
assert(result.source.storesCredential === false, "source cannot store credential");
assert(result.source.storesSampleAudioFile === false, "source cannot store sample audio file");
library = result.library;

result = addVoiceSource(library, {
  id: "sora_dialogue_candidate",
  displayName: "Sora Dialogue Candidate",
  provider: "provider-builtin",
  providerVoiceId: "sora-candidate",
  language: "zh-CN",
  role: "character",
  linkedCharacterId: "sora",
  consentStatus: "unknown",
  commercialUseStatus: "unknown",
  status: "locked",
  textConstraints: ["young", "restrained", "soft attack"],
  updatedAt: "2026-05-01T00:02:00.000Z",
});
assert(result.validation.ok, `candidate should validate as draft-only: ${result.validation.errors.join("; ")}`);
assert(result.source.status === "candidate", "unknown consent/commercial status must downgrade to candidate");
assert(result.source.canUseAsFutureReference === false, "candidate cannot be future reference");
assert(result.source.warnings.some((warning) => warning.includes("Consent status is unknown")), "candidate consent warning missing");
library = result.library;

result = addVoiceSource(library, {
  id: "bgm_profile",
  displayName: "Sparse Piano BGM",
  provider: "music-provider-planned",
  providerVoiceId: "sparse-piano-style",
  language: "instrumental",
  role: "music_profile",
  consentStatus: "licensed",
  commercialUseStatus: "restricted",
  status: "candidate",
  textConstraints: ["slow piano", "no percussion", "low emotional pressure"],
  updatedAt: "2026-05-01T00:03:00.000Z",
});
assert(result.validation.ok, `music profile candidate should validate: ${result.validation.errors.join("; ")}`);
assert(result.source.canUseForTtsPlan === false, "music profile cannot be used for TTS plan");
assert(result.source.allowedUse.includes("music_brief"), "music profile must map to music brief");
library = result.library;

result = addVoiceSource(library, {
  id: "secret_voice",
  displayName: "Secret Voice",
  provider: "bad-provider",
  providerVoiceId: "bad",
  language: "zh-CN",
  role: "narrator",
  consentStatus: "user_owned",
  commercialUseStatus: "allowed",
  textConstraints: ["should be rejected"],
  apiKey: "sk-should-not-enter-state",
  updatedAt: "2026-05-01T00:04:00.000Z",
});
assert(result.rejected, "private auth material must reject input");
assert(result.library.rejectedInputs.length === 1, "rejected input must be recorded as blocked metadata");
assert(!result.library.sources.some((source) => source.id === "secret_voice"), "secret voice must not enter sources");
library = result.library;

result = updateVoiceSource(library, "sora_dialogue_candidate", {
  consentStatus: "licensed",
  commercialUseStatus: "allowed",
  status: "locked",
  updatedAt: "2026-05-01T00:05:00.000Z",
});
assert(result.validation.ok, `updated character voice should validate: ${result.validation.errors.join("; ")}`);
assert(result.source.status === "locked", "known consent/commercial status should allow lock");
library = result.library;

result = markVoiceSourceStatus(library, "bgm_profile", "rejected", "2026-05-01T00:06:00.000Z");
assert(result.validation.ok, `rejected music profile should validate: ${result.validation.errors.join("; ")}`);
assert(result.source.status === "rejected", "music profile should be rejected");
assert(result.source.canUseForTtsPlan === false, "rejected source cannot be used for TTS");
assert(result.source.allowedUse.length === 0, "rejected source should have no positive allowed use");
library = result.library;

const validation = validateVoiceSourceLibraryState(library, "2026-05-01T00:07:00.000Z");
assert(validation.ok, `final voice library should validate: ${validation.errors.join("; ")}`);
assert(library.summary.locked === 2, "two voice sources should be locked");
assert(library.summary.rejected === 1, "one voice source should be rejected");
assert(library.summary.providerSubmitAllowed === false, "provider submit must stay false");
assert(library.summary.liveSubmitAllowed === false, "live submit must stay false");

const runtimeSources = toRuntimeVoiceSources(library);
assert(runtimeSources.length === library.sources.length, "runtime source export count mismatch");
assert(runtimeSources.some((source) => source.id === "narrator_main" && source.status === "planned"), "locked narrator should export as planned runtime source");
assert(runtimeSources.some((source) => source.id === "bgm_profile" && source.status === "unavailable"), "rejected music should export unavailable");

const voiceMemory = toVoiceMemoryDocument(library);
assert(voiceMemory.privateAuthMaterialForbidden === true, "voice memory must forbid private auth material");
assert(voiceMemory.voiceSources.some((source) => source.id === "narrator_main" && source.status === "locked"), "voice memory must include locked narrator");
assert(voiceMemory.voiceSources.some((source) => source.id === "bgm_profile" && source.status === "rejected"), "voice memory must include rejected music profile");
assert(!JSON.stringify(voiceMemory).includes("/Users/example"), "voice memory must not persist raw absolute sample path");

const schema = readJson("schemas/voice_source_library.schema.json");
assert(schema.title === "VoiceSourceLibraryState", "schema title drifted");
assert(schema.properties.phase.const === "phase18_voice_source_library", "schema must pin phase");
assert(schema.properties.libraryPurpose.const === "voice_source_memory", "schema must pin library purpose");
assert(schema.properties.privateAuthMaterialForbidden.const === true, "schema must forbid private auth material");
assert(schema.properties.liveSubmitAllowed.const === false, "schema must pin liveSubmitAllowed false");
for (const [key, expected] of Object.entries(library.hardLocks)) {
  assert(schema.$defs.hardLocks.properties[key].const === expected, `schema hard lock must pin ${key}`);
}
assert(schema.$defs.voiceSourceLibraryEntry.properties.storesCredential.const === false, "schema must forbid credential storage");
assert(schema.$defs.voiceSourceLibraryEntry.properties.storesSampleAudioFile.const === false, "schema must forbid sample audio storage");

const projectSchema = readJson("schemas/project_runtime_state.schema.json");
assert(projectSchema.required.includes("voiceSourceLibrary"), "project runtime schema must require voiceSourceLibrary");
assert(projectSchema.properties.voiceSourceLibrary.$ref === "voice_source_library.schema.json", "project runtime schema must reference voice source library schema");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("voice_source_library.schema.json"), "schema registry must include voice_source_library.schema.json");
assert(registrySource.includes("VoiceSourceLibraryState"), "schema registry must include VoiceSourceLibraryState");

const packageJson = readJson("package.json");
assert(packageJson.scripts["voice-source:test"] === "node scripts/voice-source-library-test.mjs", "package script voice-source:test missing");

console.log(
  `Voice source library tests passed: ${library.summary.locked} locked, ${library.summary.candidate} candidate, ${library.summary.rejected} rejected, ${library.rejectedInputs.length} blocked secret input.`,
);
