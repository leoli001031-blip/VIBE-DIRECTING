import type { RuntimeVoiceSource } from "./types";

export const voiceSourceLibrarySchemaVersion = "0.1.0";
export const voiceSourceLibraryPhase = "phase18_voice_source_library";

export type VoiceSourceRole = "narrator" | "character" | "brand_voice" | "music_profile" | "ambience_profile";
export type VoiceSourceStatus = "locked" | "candidate" | "rejected";
export type VoiceSourceConsentStatus = "user_owned" | "licensed" | "provider_builtin" | "unknown";
export type VoiceSourceCommercialUseStatus = "allowed" | "restricted" | "unknown";
export type VoiceSourcePathOrigin = "project_root_relative" | "user_selected_import";

export interface VoiceSourcePathRef {
  path: string;
  origin: VoiceSourcePathOrigin;
  importId?: string;
  rawPathRedacted?: true;
  notes: string[];
}

export interface VoiceSourceLibraryEntry {
  id: string;
  displayName: string;
  provider: string;
  providerVoiceId: string;
  language: string;
  role: VoiceSourceRole;
  linkedCharacterId?: string;
  samplePath?: VoiceSourcePathRef;
  consentStatus: VoiceSourceConsentStatus;
  commercialUseStatus: VoiceSourceCommercialUseStatus;
  status: VoiceSourceStatus;
  textConstraints: string[];
  allowedUse: Array<"tts_plan" | "music_brief" | "ambience_brief" | "draft_preview" | "future_reference">;
  canUseForTtsPlan: boolean;
  canUseAsFutureReference: boolean;
  storesCredential: false;
  storesSampleAudioFile: false;
  privateAuthMaterialForbidden: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  blockers: string[];
  warnings: string[];
  updatedAt: string;
}

export interface VoiceSourceRejectedInput {
  id: string;
  reason: string;
  blockedAt: string;
  fields: string[];
}

export interface VoiceSourceLibraryState {
  schemaVersion: string;
  generatedAt: string;
  phase: typeof voiceSourceLibraryPhase;
  libraryPurpose: "voice_source_memory";
  privateAuthMaterialForbidden: true;
  sources: VoiceSourceLibraryEntry[];
  rejectedInputs: VoiceSourceRejectedInput[];
  summary: {
    total: number;
    locked: number;
    candidate: number;
    rejected: number;
    narrator: number;
    character: number;
    musicProfile: number;
    ambienceProfile: number;
    futureReferenceReady: number;
    ttsReady: number;
    storesSecrets: false;
    providerSubmitAllowed: false;
    liveSubmitAllowed: false;
  };
  hardLocks: {
    dryRunOnly: true;
    noProviderSubmit: true;
    providerSubmissionForbidden: true;
    liveSubmitAllowed: false;
    noCredentialRead: true;
    noCredentialWrite: true;
    noSecretStorage: true;
    noSampleAudioCopy: true;
    noFileMutation: true;
    noTtsSubmit: true;
    noMusicSubmit: true;
    noBgmInVideoProvider: true;
  };
  dryRunOnly: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  notes: string[];
}

export interface BuildVoiceSourceLibraryStateInput {
  generatedAt: string;
  id?: string;
  runtimeVoiceSources?: RuntimeVoiceSource[];
  sources?: VoiceSourceLibraryEntry[];
  rejectedInputs?: VoiceSourceRejectedInput[];
}

export interface AddVoiceSourceInput {
  id?: string;
  displayName: string;
  provider: string;
  providerVoiceId?: string;
  language?: string;
  role: VoiceSourceRole;
  linkedCharacterId?: string;
  samplePath?: string;
  samplePathOrigin?: VoiceSourcePathOrigin;
  sampleImportId?: string;
  consentStatus?: VoiceSourceConsentStatus;
  commercialUseStatus?: VoiceSourceCommercialUseStatus;
  status?: VoiceSourceStatus;
  textConstraints?: string[];
  updatedAt?: string;
}

export interface UpdateVoiceSourceInput {
  displayName?: string;
  provider?: string;
  providerVoiceId?: string;
  language?: string;
  role?: VoiceSourceRole;
  linkedCharacterId?: string;
  samplePath?: string;
  samplePathOrigin?: VoiceSourcePathOrigin;
  sampleImportId?: string;
  consentStatus?: VoiceSourceConsentStatus;
  commercialUseStatus?: VoiceSourceCommercialUseStatus;
  status?: VoiceSourceStatus;
  textConstraints?: string[];
  updatedAt?: string;
}

export interface VoiceSourceLibraryValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checkedAt: string;
}

export interface VoiceSourceLibraryMutationResult {
  library: VoiceSourceLibraryState;
  source?: VoiceSourceLibraryEntry;
  validation: VoiceSourceLibraryValidationResult;
  rejected?: VoiceSourceRejectedInput;
}

export interface VoiceMemoryDocument {
  schemaVersion: string;
  id: string;
  privateAuthMaterialForbidden: true;
  voiceSources: Array<{
    id: string;
    displayName: string;
    provider: string;
    providerVoiceId: string;
    language: string;
    role: VoiceSourceRole;
    linkedCharacterId?: string;
    samplePath?: string;
    consentStatus: VoiceSourceConsentStatus;
    commercialUseStatus: VoiceSourceCommercialUseStatus;
    status: "locked" | "candidate" | "rejected";
    textConstraints: string[];
  }>;
  updatedAt: string;
}

const hardLocks: VoiceSourceLibraryState["hardLocks"] = {
  dryRunOnly: true,
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
};

const forbiddenPrivateFields = [
  "apiKey",
  "api_key",
  "accessToken",
  "access_token",
  "authToken",
  "auth_token",
  "credential",
  "credentials",
  "secret",
  "password",
  "privateKey",
  "private_key",
];
const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/])/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function safeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "voice_source";
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function normalizeSlashes(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
}

function privateFieldHits(input: Record<string, unknown>): string[] {
  const keys = new Set(Object.keys(input));
  return forbiddenPrivateFields.filter((field) => keys.has(field));
}

function roleForRuntimeKind(kind: RuntimeVoiceSource["kind"]): VoiceSourceRole {
  if (kind === "music_source") return "music_profile";
  if (kind === "tts_voice") return "narrator";
  return "brand_voice";
}

function statusForRuntimeSource(source: RuntimeVoiceSource): VoiceSourceStatus {
  if (source.status === "unavailable") return "rejected";
  return "candidate";
}

function allowedUseFor(entry: Pick<VoiceSourceLibraryEntry, "status" | "role">): VoiceSourceLibraryEntry["allowedUse"] {
  if (entry.status === "rejected") return [];
  const uses: VoiceSourceLibraryEntry["allowedUse"] = ["draft_preview"];
  if (entry.role === "music_profile") uses.push("music_brief");
  else if (entry.role === "ambience_profile") uses.push("ambience_brief");
  else uses.push("tts_plan");
  if (entry.status === "locked") uses.push("future_reference");
  return uses;
}

function pathRefFor(input: {
  id: string;
  samplePath?: string;
  samplePathOrigin?: VoiceSourcePathOrigin;
  sampleImportId?: string;
}): { pathRef?: VoiceSourcePathRef; blockers: string[]; warnings: string[] } {
  if (!input.samplePath?.trim()) return { blockers: [], warnings: ["No sample path is stored; this source remains metadata-only."] };

  const origin = input.samplePathOrigin || (absolutePathPattern.test(input.samplePath) ? "user_selected_import" : "project_root_relative");
  const normalized = normalizeSlashes(input.samplePath);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (parentTraversalPattern.test(normalized)) blockers.push("Voice sample path cannot use parent traversal.");
  if (origin === "project_root_relative" && absolutePathPattern.test(normalized)) {
    blockers.push("Project-root voice sample paths cannot be absolute.");
  }

  if (origin === "user_selected_import") {
    return {
      pathRef: {
        path: `user_import:${input.sampleImportId || input.id}`,
        origin,
        importId: input.sampleImportId || input.id,
        rawPathRedacted: true,
        notes: [
          "Raw user-selected sample path is redacted from runtime state.",
          "Phase 18 stores metadata only and does not copy sample audio.",
        ],
      },
      blockers,
      warnings,
    };
  }

  return {
    pathRef: {
      path: normalized.replace(/^\/+/, ""),
      origin,
      notes: ["Project-relative sample path metadata only; no file copy is performed."],
    },
    blockers,
    warnings,
  };
}

function entryBlockers(input: {
  status: VoiceSourceStatus;
  provider: string;
  providerVoiceId: string;
  displayName: string;
  textConstraints: string[];
  samplePathBlockers: string[];
}): string[] {
  const blockers = [...input.samplePathBlockers];
  if (!input.displayName.trim()) blockers.push("Voice source displayName is required.");
  if (!input.provider.trim()) blockers.push("Voice source provider is required.");
  if (!input.providerVoiceId.trim()) blockers.push("Voice source providerVoiceId is required.");
  if (!input.textConstraints.length) blockers.push("Voice source requires at least one text constraint.");
  return input.status === "rejected" ? [] : blockers;
}

function entryWarnings(input: {
  status: VoiceSourceStatus;
  consentStatus: VoiceSourceConsentStatus;
  commercialUseStatus: VoiceSourceCommercialUseStatus;
  sampleWarnings: string[];
}): string[] {
  const warnings = [...input.sampleWarnings];
  if (input.status === "candidate") warnings.push("Candidate voice source is draft-only until explicitly locked.");
  if (input.consentStatus === "unknown") warnings.push("Consent status is unknown; keep this voice source draft-only.");
  if (input.commercialUseStatus === "unknown") warnings.push("Commercial use status is unknown; keep this voice source draft-only.");
  if (input.commercialUseStatus === "restricted") warnings.push("Commercial use is restricted; review before formal use.");
  return uniqueSorted(warnings);
}

function normalizeInputToEntry(input: AddVoiceSourceInput, generatedAt: string): VoiceSourceLibraryEntry {
  const id = input.id ? safeId(input.id) : safeId(input.displayName);
  const consentStatus = input.consentStatus || "unknown";
  const commercialUseStatus = input.commercialUseStatus || "unknown";
  const requestedStatus = input.status || "candidate";
  const status: VoiceSourceStatus =
    requestedStatus === "locked" && consentStatus !== "unknown" && commercialUseStatus !== "unknown"
      ? "locked"
      : requestedStatus === "rejected"
        ? "rejected"
        : "candidate";
  const textConstraints = uniqueSorted(input.textConstraints || ["Voice source metadata placeholder."]);
  const { pathRef, blockers: samplePathBlockers, warnings: sampleWarnings } = pathRefFor({
    id,
    samplePath: input.samplePath,
    samplePathOrigin: input.samplePathOrigin,
    sampleImportId: input.sampleImportId,
  });
  const blockers = entryBlockers({
    status,
    provider: input.provider,
    providerVoiceId: input.providerVoiceId || id,
    displayName: input.displayName,
    textConstraints,
    samplePathBlockers,
  });
  const warnings = entryWarnings({ status, consentStatus, commercialUseStatus, sampleWarnings });
  const role = input.role;

  return {
    id,
    displayName: input.displayName,
    provider: input.provider,
    providerVoiceId: input.providerVoiceId || id,
    language: input.language || "unspecified",
    role,
    linkedCharacterId: input.linkedCharacterId,
    samplePath: pathRef,
    consentStatus,
    commercialUseStatus,
    status,
    textConstraints,
    allowedUse: allowedUseFor({ status, role }),
    canUseForTtsPlan: status !== "rejected" && role !== "music_profile" && role !== "ambience_profile",
    canUseAsFutureReference: status === "locked",
    storesCredential: false,
    storesSampleAudioFile: false,
    privateAuthMaterialForbidden: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    blockers,
    warnings,
    updatedAt: input.updatedAt || generatedAt,
  };
}

function runtimeSourceToEntry(source: RuntimeVoiceSource, generatedAt: string): VoiceSourceLibraryEntry {
  return normalizeInputToEntry({
    id: source.id,
    displayName: source.label,
    provider: "runtime.config",
    providerVoiceId: source.id,
    language: "unspecified",
    role: roleForRuntimeKind(source.kind),
    consentStatus: source.status === "placeholder" ? "provider_builtin" : "unknown",
    commercialUseStatus: "unknown",
    status: statusForRuntimeSource(source),
    textConstraints: source.notes.length ? source.notes : ["Runtime voice source placeholder."],
    updatedAt: generatedAt,
  }, generatedAt);
}

function summarize(sources: VoiceSourceLibraryEntry[]): VoiceSourceLibraryState["summary"] {
  return {
    total: sources.length,
    locked: sources.filter((source) => source.status === "locked").length,
    candidate: sources.filter((source) => source.status === "candidate").length,
    rejected: sources.filter((source) => source.status === "rejected").length,
    narrator: sources.filter((source) => source.role === "narrator").length,
    character: sources.filter((source) => source.role === "character").length,
    musicProfile: sources.filter((source) => source.role === "music_profile").length,
    ambienceProfile: sources.filter((source) => source.role === "ambience_profile").length,
    futureReferenceReady: sources.filter((source) => source.canUseAsFutureReference).length,
    ttsReady: sources.filter((source) => source.canUseForTtsPlan && source.status === "locked").length,
    storesSecrets: false,
    providerSubmitAllowed: false,
    liveSubmitAllowed: false,
  };
}

function withSummary(input: Omit<VoiceSourceLibraryState, "summary">): VoiceSourceLibraryState {
  return {
    ...input,
    summary: summarize(input.sources),
  };
}

export function buildVoiceSourceLibraryState(input: BuildVoiceSourceLibraryStateInput): VoiceSourceLibraryState {
  const generatedAt = input.generatedAt;
  const seededSources = input.sources
    ? clone(input.sources)
    : (input.runtimeVoiceSources || []).map((source) => runtimeSourceToEntry(source, generatedAt));

  return withSummary({
    schemaVersion: voiceSourceLibrarySchemaVersion,
    generatedAt,
    phase: voiceSourceLibraryPhase,
    libraryPurpose: "voice_source_memory",
    privateAuthMaterialForbidden: true,
    sources: seededSources,
    rejectedInputs: clone(input.rejectedInputs || []),
    hardLocks,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      "Phase 18 stores voice source metadata only.",
      "No TTS or music provider is submitted from this library.",
      "No credentials, API keys, tokens, or raw user sample paths are stored.",
      "BGM remains an audio/export concern and cannot enter video provider prompts.",
    ],
  });
}

export function validateVoiceSourceLibraryState(
  library: VoiceSourceLibraryState,
  checkedAt = library.generatedAt,
): VoiceSourceLibraryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (library.libraryPurpose !== "voice_source_memory") errors.push("Voice Source Library must remain voice_source_memory.");
  if (library.privateAuthMaterialForbidden !== true) errors.push("Private auth material must be forbidden.");
  if (library.dryRunOnly !== true || library.providerSubmissionForbidden !== true || library.liveSubmitAllowed !== false) {
    errors.push("Voice Source Library must stay dry-run with provider submit blocked.");
  }
  for (const [key, expected] of Object.entries(hardLocks)) {
    if (library.hardLocks[key as keyof VoiceSourceLibraryState["hardLocks"]] !== expected) {
      errors.push(`Hard lock ${key} drifted.`);
    }
  }

  for (const source of library.sources) {
    if (source.storesCredential !== false) errors.push(`${source.id} must not store credentials.`);
    if (source.storesSampleAudioFile !== false) errors.push(`${source.id} must not store sample audio files.`);
    if (source.privateAuthMaterialForbidden !== true) errors.push(`${source.id} must forbid private auth material.`);
    if (source.providerSubmissionForbidden !== true || source.liveSubmitAllowed !== false) {
      errors.push(`${source.id} must not allow provider submission.`);
    }
    if (source.status === "locked" && (source.consentStatus === "unknown" || source.commercialUseStatus === "unknown")) {
      errors.push(`${source.id} cannot lock while consent or commercial status is unknown.`);
    }
    if (source.status !== "locked" && source.canUseAsFutureReference) {
      errors.push(`${source.id} cannot become a future reference unless locked.`);
    }
    if (source.blockers.length) errors.push(...source.blockers.map((blocker) => `${source.id}: ${blocker}`));
    warnings.push(...source.warnings.map((warning) => `${source.id}: ${warning}`));
  }

  return {
    ok: errors.length === 0,
    errors: uniqueSorted(errors),
    warnings: uniqueSorted(warnings),
    checkedAt,
  };
}

export function addVoiceSource(
  library: VoiceSourceLibraryState,
  input: AddVoiceSourceInput & Record<string, unknown>,
): VoiceSourceLibraryMutationResult {
  const generatedAt = input.updatedAt || library.generatedAt;
  const privateHits = privateFieldHits(input);
  if (privateHits.length) {
    const rejected: VoiceSourceRejectedInput = {
      id: safeId(String(input.id || input.displayName || "rejected_voice_source")),
      reason: "Private auth material cannot be stored in Voice Source Library.",
      blockedAt: generatedAt,
      fields: privateHits,
    };
    const next = withSummary({
      ...clone(library),
      rejectedInputs: [...library.rejectedInputs, rejected],
      generatedAt,
    });
    return { library: next, rejected, validation: validateVoiceSourceLibraryState(next, generatedAt) };
  }

  const entry = normalizeInputToEntry(input, generatedAt);
  const nextSources = [...library.sources.filter((source) => source.id !== entry.id), entry]
    .sort((left, right) => left.id.localeCompare(right.id));
  const next = withSummary({
    ...clone(library),
    generatedAt,
    sources: nextSources,
  });
  return { library: next, source: entry, validation: validateVoiceSourceLibraryState(next, generatedAt) };
}

export function updateVoiceSource(
  library: VoiceSourceLibraryState,
  sourceId: string,
  input: UpdateVoiceSourceInput & Record<string, unknown>,
): VoiceSourceLibraryMutationResult {
  const existing = library.sources.find((source) => source.id === sourceId);
  if (!existing) {
    return {
      library,
      validation: {
        ok: false,
        errors: [`Voice source ${sourceId} was not found.`],
        warnings: [],
        checkedAt: input.updatedAt || library.generatedAt,
      },
    };
  }

  return addVoiceSource(library, {
    id: existing.id,
    displayName: input.displayName || existing.displayName,
    provider: input.provider || existing.provider,
    providerVoiceId: input.providerVoiceId || existing.providerVoiceId,
    language: input.language || existing.language,
    role: input.role || existing.role,
    linkedCharacterId: input.linkedCharacterId ?? existing.linkedCharacterId,
    samplePath: input.samplePath || existing.samplePath?.path,
    samplePathOrigin: input.samplePathOrigin || existing.samplePath?.origin,
    sampleImportId: input.sampleImportId || existing.samplePath?.importId,
    consentStatus: input.consentStatus || existing.consentStatus,
    commercialUseStatus: input.commercialUseStatus || existing.commercialUseStatus,
    status: input.status || existing.status,
    textConstraints: input.textConstraints || existing.textConstraints,
    updatedAt: input.updatedAt || library.generatedAt,
  });
}

export function markVoiceSourceStatus(
  library: VoiceSourceLibraryState,
  sourceId: string,
  status: VoiceSourceStatus,
  updatedAt = library.generatedAt,
): VoiceSourceLibraryMutationResult {
  return updateVoiceSource(library, sourceId, { status, updatedAt });
}

export function toRuntimeVoiceSources(library: VoiceSourceLibraryState): RuntimeVoiceSource[] {
  return library.sources.map((source) => ({
    id: source.id,
    label: source.displayName,
    status: source.status === "locked" ? "planned" : source.status === "rejected" ? "unavailable" : "placeholder",
    kind: source.role === "music_profile" ? "music_source" : source.role === "ambience_profile" ? "voice_library" : "tts_voice",
    notes: [
      ...source.textConstraints,
      `consent:${source.consentStatus}`,
      `commercial:${source.commercialUseStatus}`,
      "Phase 18 metadata only; no credentials or provider submission.",
    ],
  }));
}

export function toVoiceMemoryDocument(library: VoiceSourceLibraryState): VoiceMemoryDocument {
  return {
    schemaVersion: voiceSourceLibrarySchemaVersion,
    id: `${library.libraryPurpose}_${library.generatedAt.replace(/[^0-9]/g, "").slice(0, 14) || "dry_run"}`,
    privateAuthMaterialForbidden: true,
    voiceSources: library.sources.map((source) => ({
      id: source.id,
      displayName: source.displayName,
      provider: source.provider,
      providerVoiceId: source.providerVoiceId,
      language: source.language,
      role: source.role,
      linkedCharacterId: source.linkedCharacterId,
      samplePath: source.samplePath?.path,
      consentStatus: source.consentStatus,
      commercialUseStatus: source.commercialUseStatus,
      status: source.status,
      textConstraints: source.textConstraints,
    })),
    updatedAt: library.generatedAt,
  };
}
