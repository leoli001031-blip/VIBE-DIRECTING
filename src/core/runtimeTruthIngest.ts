import type { RuntimeTruthWatcherEventFacts, RuntimeTruthWatcherEventType } from "./runtimeTruthLayer";

export const runtimeTruthIngestSchemaVersion = "0.1.0";

export type RuntimeTruthIngestSourceKind =
  | "verify_scan"
  | "app_server_fs_changed"
  | "provider_sidecar_scan"
  | "semantic_qa_scan"
  | "mock_fixture";

export interface RuntimeTruthIngestBinding {
  runId: string;
  taskRunId: string;
  taskPacketId: string;
  envelopeId: string;
  outputPath: string;
  outputSha256?: string;
}

export interface RuntimeTruthIngestFileFacts {
  exists?: boolean;
  stable?: boolean;
  artifactPath?: string;
  outputPath?: string;
  outputSha256?: string;
  observedAt?: string;
  stableAt?: string;
  hashRecordedAt?: string;
  notes?: string[];
}

export interface RuntimeTruthIngestSidecarFacts {
  exists?: boolean;
  sidecarPath?: string;
  sidecarKind: "provider_observation" | "semantic_qa";
  pairedAt?: string;
  outputSha256?: string;
  notes?: string[];
}

export interface BuildRuntimeTruthWatcherEventsInput {
  binding: RuntimeTruthIngestBinding;
  sourceKind: RuntimeTruthIngestSourceKind;
  generatedAt: string;
  sequenceStart?: number;
  eventIdPrefix?: string;
  file?: RuntimeTruthIngestFileFacts;
  providerObservation?: Omit<RuntimeTruthIngestSidecarFacts, "sidecarKind">;
  semanticQa?: Omit<RuntimeTruthIngestSidecarFacts, "sidecarKind">;
}

export interface RuntimeTruthIngestResult {
  schemaVersion: typeof runtimeTruthIngestSchemaVersion;
  generatedAt: string;
  sourceKind: RuntimeTruthIngestSourceKind;
  binding: RuntimeTruthIngestBinding;
  events: RuntimeTruthWatcherEventFacts[];
  blockers: string[];
  warnings: string[];
  notes: string[];
}

function normalizePath(value: string | undefined): string {
  return String(value || "").replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function eventId(prefix: string, sequence: number, eventType: RuntimeTruthWatcherEventType): string {
  return `${prefix}_${String(sequence).padStart(4, "0")}_${eventType}`;
}

function eventBase(
  input: BuildRuntimeTruthWatcherEventsInput,
  sequence: number,
  eventType: RuntimeTruthWatcherEventType,
  occurredAt: string,
): RuntimeTruthWatcherEventFacts & { sourceKind: RuntimeTruthIngestSourceKind } {
  const artifactPath = input.file?.artifactPath || input.file?.outputPath || input.binding.outputPath;
  return {
    eventId: eventId(input.eventIdPrefix || "runtime_truth_ingest", sequence, eventType),
    sequence,
    eventType,
    occurredAt,
    runId: input.binding.runId,
    taskRunId: input.binding.taskRunId,
    taskPacketId: input.binding.taskPacketId,
    envelopeId: input.binding.envelopeId,
    artifactPath: normalizePath(artifactPath),
    outputPath: normalizePath(input.file?.outputPath || input.binding.outputPath),
    outputSha256: input.file?.outputSha256 || input.binding.outputSha256,
    sourceKind: input.sourceKind,
    notes: [],
  };
}

function sidecarEvent(
  input: BuildRuntimeTruthWatcherEventsInput,
  sequence: number,
  eventType: "sidecar_paired" | "qa_paired",
  sidecarKind: "provider_observation" | "semantic_qa",
  sidecar: Omit<RuntimeTruthIngestSidecarFacts, "sidecarKind">,
): RuntimeTruthWatcherEventFacts & { sourceKind: RuntimeTruthIngestSourceKind } {
  return {
    ...eventBase(input, sequence, eventType, sidecar.pairedAt || input.generatedAt),
    outputSha256: sidecar.outputSha256 || input.file?.outputSha256 || input.binding.outputSha256,
    sidecarKind,
    sidecarPath: normalizePath(sidecar.sidecarPath),
    notes: sidecar.notes || [],
  };
}

function pushFileEvents(
  input: BuildRuntimeTruthWatcherEventsInput,
  events: Array<RuntimeTruthWatcherEventFacts & { sourceKind: RuntimeTruthIngestSourceKind }>,
): void {
  const file = input.file;
  if (!file?.exists) return;
  const sequenceStart = input.sequenceStart || 1;
  events.push({
    ...eventBase(input, sequenceStart, "file_observed", file.observedAt || input.generatedAt),
    notes: file.notes || [],
  });
  if (file.stable) {
    events.push({
      ...eventBase(input, sequenceStart + 1, "file_stable", file.stableAt || file.observedAt || input.generatedAt),
      notes: file.notes || [],
    });
  }
  if (file.outputSha256 || input.binding.outputSha256) {
    events.push({
      ...eventBase(input, sequenceStart + 2, "hash_recorded", file.hashRecordedAt || file.stableAt || file.observedAt || input.generatedAt),
      outputSha256: file.outputSha256 || input.binding.outputSha256,
      notes: file.notes || [],
    });
  }
}

export function buildRuntimeTruthWatcherEvents(input: BuildRuntimeTruthWatcherEventsInput): RuntimeTruthIngestResult {
  const events: Array<RuntimeTruthWatcherEventFacts & { sourceKind: RuntimeTruthIngestSourceKind }> = [];
  pushFileEvents(input, events);

  let nextSequence = (input.sequenceStart || 1) + 3;
  if (input.providerObservation?.exists && input.providerObservation.sidecarPath) {
    events.push(sidecarEvent(input, nextSequence, "sidecar_paired", "provider_observation", input.providerObservation));
    nextSequence += 1;
  }
  if (input.semanticQa?.exists && input.semanticQa.sidecarPath) {
    events.push(sidecarEvent(input, nextSequence, "qa_paired", "semantic_qa", input.semanticQa));
  }

  const blockers = [
    input.file?.exists ? "" : "runtime_truth_ingest_file_missing",
    input.file?.stable ? "" : "runtime_truth_ingest_file_not_stable",
    input.file?.outputSha256 || input.binding.outputSha256 ? "" : "runtime_truth_ingest_output_hash_missing",
  ].filter(Boolean);

  return {
    schemaVersion: runtimeTruthIngestSchemaVersion,
    generatedAt: input.generatedAt,
    sourceKind: input.sourceKind,
    binding: {
      ...input.binding,
      outputPath: normalizePath(input.binding.outputPath),
    },
    events,
    blockers,
    warnings: [],
    notes: [
      "Runtime truth ingest is append-only software evidence. It does not start fs.watch, read files, mutate files, submit providers, or call external APIs.",
    ],
  };
}
