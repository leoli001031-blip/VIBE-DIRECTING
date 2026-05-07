export const freshRunContractSchemaVersion = "0.1.0";

export type FreshRunContractStatus = "ready" | "blocked";

export interface FreshRunArtifactFacts {
  artifactPath: string;
  exists: boolean;
  fileModifiedAt?: string;
  sizeBytes?: number;
  outputSha256?: string;
}

export interface FreshRunSidecarFacts {
  sidecarPath?: string;
  exists: boolean;
  sidecarModifiedAt?: string;
  sidecarGeneratedAt?: string;
  reviewedAt?: string;
  taskRunId?: string;
  taskPacketId?: string;
  envelopeId?: string;
  outputPath?: string;
  outputSha256?: string;
  reviewedOutputSha256?: string;
}

export interface BuildFreshRunContractInput {
  generatedAt: string;
  runId: string;
  manifestGeneratedAt: string;
  taskRunId: string;
  taskPacketId: string;
  envelopeId: string;
  outputPath: string;
  artifact: FreshRunArtifactFacts;
  providerObservation?: FreshRunSidecarFacts;
  providerObservationRequired?: boolean;
  semanticQa?: FreshRunSidecarFacts;
  semanticQaRequired?: boolean;
  allowedClockSkewMs?: number;
}

export interface FreshRunSidecarState extends FreshRunSidecarFacts {
  required: boolean;
  present: boolean;
  sidecarModifiedAtFresh: boolean;
  sidecarGeneratedAtFresh: boolean;
  reviewedAtFresh: boolean;
  bindingMatched: boolean;
  hashMatched: boolean;
}

export interface FreshRunContractState {
  schemaVersion: typeof freshRunContractSchemaVersion;
  generatedAt: string;
  phase: "fresh_run_contract";
  status: FreshRunContractStatus;
  runId: string;
  manifestGeneratedAt: string;
  binding: {
    taskRunId: string;
    taskPacketId: string;
    envelopeId: string;
    outputPath: string;
  };
  artifact: FreshRunArtifactFacts & {
    present: boolean;
    pathMatched: boolean;
    nonEmpty: boolean;
    fileModifiedAtFresh: boolean;
  };
  providerObservation: FreshRunSidecarState;
  semanticQa: FreshRunSidecarState;
  verification: {
    artifactPresent: boolean;
    artifactPathMatched: boolean;
    artifactFresh: boolean;
    artifactNonEmpty: boolean;
    outputSha256Present: boolean;
    providerObservationRequired: boolean;
    providerObservationPresent: boolean;
    providerObservationFresh: boolean;
    providerObservationBindingMatched: boolean;
    providerObservationHashMatched: boolean;
    semanticQaRequired: boolean;
    semanticQaPresent: boolean;
    semanticQaFresh: boolean;
    semanticQaBindingMatched: boolean;
    semanticQaHashMatched: boolean;
  };
  blockers: string[];
  warnings: string[];
  notes: string[];
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).sort((left, right) => left.localeCompare(right));
}

function parseTimestampMs(value: string | undefined): number | null {
  const ms = Date.parse(value || "");
  return Number.isFinite(ms) ? ms : null;
}

function timestampIsFresh(value: string | undefined, manifestGeneratedAt: string, skewMs: number): boolean {
  const valueMs = parseTimestampMs(value);
  const manifestMs = parseTimestampMs(manifestGeneratedAt);
  if (valueMs === null || manifestMs === null) return false;
  return valueMs + skewMs >= manifestMs;
}

function normalizePath(value: string | undefined): string {
  return String(value || "").replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function pathsMatch(left: string | undefined, right: string | undefined): boolean {
  return Boolean(left && right && normalizePath(left) === normalizePath(right));
}

function bindingMatched(input: BuildFreshRunContractInput, sidecar: FreshRunSidecarFacts | undefined): boolean {
  if (!sidecar?.exists) return false;
  return (
    sidecar.taskRunId === input.taskRunId &&
    sidecar.taskPacketId === input.taskPacketId &&
    sidecar.envelopeId === input.envelopeId &&
    pathsMatch(sidecar.outputPath, input.outputPath)
  );
}

function hashMatched(artifact: FreshRunArtifactFacts, sidecar: FreshRunSidecarFacts | undefined): boolean {
  if (!sidecar?.exists) return false;
  if (!artifact.outputSha256) return true;
  const sidecarHash = sidecar.reviewedOutputSha256 || sidecar.outputSha256;
  return Boolean(sidecarHash && sidecarHash === artifact.outputSha256);
}

function sidecarState(
  input: BuildFreshRunContractInput,
  sidecar: FreshRunSidecarFacts | undefined,
  required: boolean,
  timestampRole: "generatedAt" | "reviewedAt",
): FreshRunSidecarState {
  const exists = sidecar?.exists === true;
  const sidecarModifiedAtFresh = exists && timestampIsFresh(sidecar?.sidecarModifiedAt, input.manifestGeneratedAt, input.allowedClockSkewMs || 1000);
  const sidecarGeneratedAtFresh = exists && timestampIsFresh(sidecar?.sidecarGeneratedAt, input.manifestGeneratedAt, input.allowedClockSkewMs || 1000);
  const reviewedAtFresh = exists && timestampIsFresh(sidecar?.reviewedAt, input.manifestGeneratedAt, input.allowedClockSkewMs || 1000);
  const effectiveSidecarGeneratedAtFresh = timestampRole === "reviewedAt" ? true : sidecarGeneratedAtFresh;
  const effectiveReviewedAtFresh = timestampRole === "generatedAt" ? true : reviewedAtFresh;
  return {
    sidecarPath: sidecar?.sidecarPath,
    exists,
    sidecarModifiedAt: sidecar?.sidecarModifiedAt,
    sidecarGeneratedAt: sidecar?.sidecarGeneratedAt,
    reviewedAt: sidecar?.reviewedAt,
    taskRunId: sidecar?.taskRunId,
    taskPacketId: sidecar?.taskPacketId,
    envelopeId: sidecar?.envelopeId,
    outputPath: sidecar?.outputPath,
    outputSha256: sidecar?.outputSha256,
    reviewedOutputSha256: sidecar?.reviewedOutputSha256,
    required,
    present: exists,
    sidecarModifiedAtFresh,
    sidecarGeneratedAtFresh: effectiveSidecarGeneratedAtFresh,
    reviewedAtFresh: effectiveReviewedAtFresh,
    bindingMatched: bindingMatched(input, sidecar),
    hashMatched: hashMatched(input.artifact, sidecar),
  };
}

function sidecarBlockers(prefix: string, state: FreshRunSidecarState, timestampRole: "generatedAt" | "reviewedAt"): string[] {
  if (!state.required) return [];
  return uniqueSorted([
    state.present ? "" : `${prefix}_missing`,
    state.sidecarModifiedAtFresh ? "" : `${prefix}_sidecar_stale`,
    timestampRole === "generatedAt" || state.reviewedAtFresh ? "" : `${prefix}_reviewed_at_stale`,
    timestampRole === "reviewedAt" || state.sidecarGeneratedAtFresh ? "" : `${prefix}_generated_at_stale`,
    state.bindingMatched ? "" : `${prefix}_binding_mismatch`,
    state.hashMatched ? "" : `${prefix}_output_hash_mismatch`,
  ]);
}

export function buildFreshRunContract(input: BuildFreshRunContractInput): FreshRunContractState {
  const providerObservationRequired = input.providerObservationRequired !== false;
  const semanticQaRequired = input.semanticQaRequired === true;
  const skewMs = input.allowedClockSkewMs || 1000;
  const artifactPresent = input.artifact.exists === true;
  const artifactPathMatched = pathsMatch(input.artifact.artifactPath, input.outputPath);
  const artifactFresh = artifactPresent && timestampIsFresh(input.artifact.fileModifiedAt, input.manifestGeneratedAt, skewMs);
  const artifactNonEmpty = artifactPresent && Number(input.artifact.sizeBytes || 0) > 0;
  const providerObservation = sidecarState(input, input.providerObservation, providerObservationRequired, "generatedAt");
  const semanticQa = sidecarState(input, input.semanticQa, semanticQaRequired, "reviewedAt");
  const blockers = uniqueSorted([
    artifactPresent ? "" : "fresh_run_artifact_missing",
    artifactPathMatched ? "" : "fresh_run_artifact_path_mismatch",
    artifactNonEmpty ? "" : "fresh_run_artifact_empty_or_missing_size",
    artifactFresh ? "" : "fresh_run_artifact_modified_at_missing_or_stale",
    ...sidecarBlockers("fresh_run_provider_observation", providerObservation, "generatedAt"),
    ...sidecarBlockers("fresh_run_semantic_qa", semanticQa, "reviewedAt"),
  ]);

  return {
    schemaVersion: freshRunContractSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "fresh_run_contract",
    status: blockers.length ? "blocked" : "ready",
    runId: input.runId,
    manifestGeneratedAt: input.manifestGeneratedAt,
    binding: {
      taskRunId: input.taskRunId,
      taskPacketId: input.taskPacketId,
      envelopeId: input.envelopeId,
      outputPath: input.outputPath,
    },
    artifact: {
      ...input.artifact,
      present: artifactPresent,
      pathMatched: artifactPathMatched,
      nonEmpty: artifactNonEmpty,
      fileModifiedAtFresh: artifactFresh,
    },
    providerObservation,
    semanticQa,
    verification: {
      artifactPresent,
      artifactPathMatched,
      artifactFresh,
      artifactNonEmpty,
      outputSha256Present: Boolean(input.artifact.outputSha256),
      providerObservationRequired,
      providerObservationPresent: providerObservation.present,
      providerObservationFresh: providerObservation.sidecarModifiedAtFresh && providerObservation.sidecarGeneratedAtFresh,
      providerObservationBindingMatched: providerObservation.bindingMatched,
      providerObservationHashMatched: providerObservation.hashMatched,
      semanticQaRequired,
      semanticQaPresent: semanticQa.present,
      semanticQaFresh: semanticQa.sidecarModifiedAtFresh && semanticQa.reviewedAtFresh,
      semanticQaBindingMatched: semanticQa.bindingMatched,
      semanticQaHashMatched: semanticQa.hashMatched,
    },
    blockers,
    warnings: uniqueSorted([
      input.artifact.outputSha256 ? "" : "fresh_run_output_sha256_not_provided_optional",
      semanticQaRequired ? "" : "fresh_run_semantic_qa_not_required_for_this_scenario",
    ]),
    notes: [
      "Fresh Run Contract is a pure software-layer gate. It performs no provider submit, network I/O, app-server launch, video generation, filesystem write, or child process work.",
      "Artifacts and required sidecars must be newer than the run manifest and must bind to the same taskRunId, taskPacketId, envelopeId, and outputPath.",
    ],
  };
}
