import {
  evaluateArtifactTransactionGate,
  toTaskRunLedgerEvents,
  type ArtifactOutputFact,
  type ArtifactProviderObservationFact,
  type ArtifactSemanticQaFact,
  type ArtifactTransactionGateInput,
  type ArtifactTransactionGateResult,
} from "./artifactTransactionGate";
import type { AppendableTaskRunLedgerEvent, TaskRunLedgerLease } from "./taskRunLedger";
import type { BaseHardLocks } from "./types";

export const runtimeIngestShellSchemaVersion = "0.1.0";

export type RuntimeIngestSource =
  | "fs_watch"
  | "app_server_fs_changed"
  | "verify_scan"
  | "manual_recovery"
  | "audit_scan";
export type RuntimeSourceIntent = "normal" | "recovery" | "audit";
export type WorkerLeaseStatus = "leased" | "running" | "stalled" | "interrupted" | "failed";
export type WorkerLeaseResumePolicy = NonNullable<TaskRunLedgerLease["resumePolicy"]>;
export type RuntimeQueueIngestStatus = "queued" | "parked" | "blocked";
export type RuntimeFileEventType = "created" | "changed" | "settled" | "hash_observed" | "sidecar_paired";
export type RuntimeSidecarKind = "provider_observation" | "semantic_qa";
export type RuntimeAppServerEventKind =
  | "thread"
  | "turn"
  | "toolCall"
  | "fsChanged"
  | "approval"
  | "disconnect"
  | "reconnect";

export interface RuntimeIngestHardLocks extends BaseHardLocks {
  liveTransportEnabled: false;
  canLaunchAppServer: false;
  ingestOnly: true;
  fsWatchDaemonEnabled: false;
  workerSpawnForbidden: true;
}

export interface WorkerLeaseIngestInput {
  taskRunId: string;
  envelopeId?: string;
  leaseId: string;
  workerId: string;
  threadId?: string;
  turnId?: string;
  leasedAt: string;
  expiresAt: string;
  status: WorkerLeaseStatus;
  retryBudget: number;
  retryCount: number;
  stallTimeoutSeconds: number;
  resumePolicy: WorkerLeaseResumePolicy;
  at?: string;
  now?: string;
  reason?: string;
}

export interface WorkerLeaseResumability {
  resumable: boolean;
  reassignable: boolean;
  retryBudgetRemaining: number;
  reason: string;
}

export interface WorkerLeaseIngestResult {
  schemaVersion: typeof runtimeIngestShellSchemaVersion;
  kind: "worker_lease";
  lease: TaskRunLedgerLease;
  ledgerEvents: AppendableTaskRunLedgerEvent[];
  resumability: WorkerLeaseResumability;
  blockers: string[];
  warnings: string[];
}

export interface RuntimeQueueIngestInput {
  taskRunId: string;
  envelopeId?: string;
  at?: string;
  providerPolicyStatus: "enabled" | "parked" | "planned" | "unavailable";
  userEnabled: boolean;
  capacityStatus?: "available" | "full";
  preflightBlocked?: boolean;
  reason?: string;
}

export interface RuntimeQueueIngestResult {
  schemaVersion: typeof runtimeIngestShellSchemaVersion;
  kind: "queue";
  status: RuntimeQueueIngestStatus;
  ledgerEvents: AppendableTaskRunLedgerEvent[];
  blockers: string[];
  warnings: string[];
}

export interface RuntimeProviderSidecarFact {
  kind: "provider_observation";
  providerId?: string;
  observationId?: string;
  outputPath?: string;
  outputHash?: string;
  sidecarPath?: string;
  sidecarHash?: string;
  threadId?: string;
  turnId?: string;
  toolCallId?: string;
}

export interface RuntimeSemanticQaSidecarFact {
  kind: "semantic_qa";
  outputPath?: string;
  reviewedOutputHash?: string;
  sidecarPath?: string;
  sidecarHash?: string;
  stableFindingIds: string[];
  status: "pending" | "pass" | "needs_review" | "failed";
  p0FindingCount?: number;
  p1FindingCount?: number;
  p2FindingCount?: number;
}

export type RuntimeSidecarFact = RuntimeProviderSidecarFact | RuntimeSemanticQaSidecarFact;

export interface RuntimeWatcherFileEvent {
  eventId: string;
  eventType: RuntimeFileEventType;
  at: string;
  source: RuntimeIngestSource;
  sourceIntent?: RuntimeSourceIntent;
  taskRunId: string;
  envelopeId?: string;
  path: string;
  expectedOutputPath?: string;
  hash?: string;
  hashAlgorithm?: ArtifactOutputFact["hashAlgorithm"];
  byteLength?: number;
  sidecar?: RuntimeSidecarFact;
  sandboxAllowedPrefixes: string[];
}

export interface RuntimeWatcherIngestResult {
  schemaVersion: typeof runtimeIngestShellSchemaVersion;
  kind: "watcher";
  source: RuntimeIngestSource;
  sourceIntent: RuntimeSourceIntent;
  eventType: RuntimeFileEventType;
  output?: ArtifactOutputFact;
  providerObservation?: ArtifactProviderObservationFact;
  semanticQa?: ArtifactSemanticQaFact;
  ledgerEvents: AppendableTaskRunLedgerEvent[];
  blockers: string[];
  warnings: string[];
}

export interface RuntimeAppServerEvent {
  eventId: string;
  eventKind: RuntimeAppServerEventKind;
  at: string;
  threadId?: string;
  turnId?: string;
  toolCallId?: string;
  taskRunId?: string;
  envelopeId?: string;
  path?: string;
  expectedOutputPath?: string;
  hash?: string;
  sidecar?: RuntimeSidecarFact;
  message?: string;
}

export interface RuntimeAppServerIngestInput {
  event: RuntimeAppServerEvent;
  liveTransportEnabled?: boolean;
  canLaunchAppServer?: boolean;
  ingestOnly?: boolean;
  sandboxAllowedPrefixes?: string[];
}

export interface RuntimeAppServerIngestResult {
  schemaVersion: typeof runtimeIngestShellSchemaVersion;
  kind: "app_server";
  hardLocks: RuntimeIngestHardLocks;
  eventKind: RuntimeAppServerEventKind;
  threadId?: string;
  turnId?: string;
  toolCallId?: string;
  watcher?: RuntimeWatcherIngestResult;
  ledgerEvents: AppendableTaskRunLedgerEvent[];
  blockers: string[];
  warnings: string[];
}

export interface RuntimeArtifactFactSet {
  taskRunId: string;
  envelopeId?: string;
  expectedOutputPath: string;
  sandboxAllowedPrefixes: string[];
  output?: ArtifactOutputFact;
  providerObservation?: ArtifactProviderObservationFact;
  semanticQa?: ArtifactSemanticQaFact;
}

export interface RuntimeArtifactGateIngestResult {
  schemaVersion: typeof runtimeIngestShellSchemaVersion;
  kind: "artifact_gate";
  gateInput: ArtifactTransactionGateInput;
  gateResult: ArtifactTransactionGateResult;
  ledgerEvents: AppendableTaskRunLedgerEvent[];
  blockers: string[];
  warnings: string[];
}

export const runtimeIngestHardLocks: RuntimeIngestHardLocks = {
  dryRunOnly: true,
  liveSubmitAllowed: false,
  providerSubmissionForbidden: true,
  noFileMutation: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noShellExecution: true,
  noWorkerSpawn: true,
  liveTransportEnabled: false,
  canLaunchAppServer: false,
  ingestOnly: true,
  fsWatchDaemonEnabled: false,
  workerSpawnForbidden: true,
};

const defaultTimestamp = "1970-01-01T00:00:00.000Z";
const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/])/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function uniqueInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function portablePathBlockers(label: string, path: string | undefined): string[] {
  if (!path) return [];
  const normalized = normalizePath(path);
  if (absolutePathPattern.test(normalized)) return [`${label} must be project-root-relative, not absolute.`];
  if (parentTraversalPattern.test(normalized)) return [`${label} must not contain parent traversal.`];
  return [];
}

function pathInsideAllowedPrefixes(path: string | undefined, allowedPrefixes: string[]): boolean {
  if (!path) return true;
  const normalized = normalizePath(path);
  return allowedPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

function sandboxBlockers(label: string, path: string | undefined, allowedPrefixes: string[]): string[] {
  const blockers = portablePathBlockers(label, path);
  if (path && blockers.length === 0 && !pathInsideAllowedPrefixes(path, allowedPrefixes)) {
    blockers.push(`${label} must be inside the sandbox allowed prefixes.`);
  }
  return blockers;
}

function sourceIntentFor(source: RuntimeIngestSource, sourceIntent?: RuntimeSourceIntent): RuntimeSourceIntent {
  if (source === "verify_scan") return sourceIntent || "normal";
  if (source === "manual_recovery") return sourceIntent || "recovery";
  if (source === "audit_scan") return sourceIntent || "audit";
  return sourceIntent || "normal";
}

function sourceBlockers(source: RuntimeIngestSource, sourceIntent: RuntimeSourceIntent): string[] {
  if (source === "verify_scan" && sourceIntent === "normal") {
    return ["verify_scan events must be marked recovery or audit, never normal."];
  }
  return [];
}

function leaseEventType(status: WorkerLeaseStatus): AppendableTaskRunLedgerEvent["eventType"] {
  if (status === "leased") return "task_leased";
  if (status === "running") return "task_running";
  if (status === "stalled") return "stalled";
  if (status === "interrupted") return "interrupted";
  return "failed";
}

function isExpired(expiresAt: string, now: string): boolean {
  return new Date(expiresAt).getTime() <= new Date(now).getTime();
}

function resumabilityFor(input: WorkerLeaseIngestInput, expired: boolean): WorkerLeaseResumability {
  const retryBudgetRemaining = Math.max(0, input.retryBudget - input.retryCount);
  if (input.status === "failed" || input.resumePolicy === "fail_on_interrupt") {
    return { resumable: false, reassignable: false, retryBudgetRemaining, reason: "Lease policy marks this run as non-resumable." };
  }
  if (expired && (input.status === "leased" || input.status === "running")) {
    return { resumable: false, reassignable: input.resumePolicy === "reassign_allowed", retryBudgetRemaining, reason: "Lease expired before continuation." };
  }
  if (input.status === "interrupted" || input.status === "stalled") {
    return {
      resumable: retryBudgetRemaining > 0 && input.resumePolicy !== "manual_review",
      reassignable: retryBudgetRemaining > 0 && input.resumePolicy === "reassign_allowed",
      retryBudgetRemaining,
      reason: retryBudgetRemaining > 0 ? "Retry budget remains for recovery." : "Retry budget exhausted.",
    };
  }
  return {
    resumable: true,
    reassignable: false,
    retryBudgetRemaining,
    reason: "Lease is active.",
  };
}

function sidecarPaths(sidecar: RuntimeSidecarFact | undefined): string[] {
  if (!sidecar) return [];
  return [sidecar.outputPath || "", sidecar.sidecarPath || ""].filter(Boolean);
}

function providerFact(sidecar: RuntimeProviderSidecarFact): ArtifactProviderObservationFact {
  return {
    providerId: sidecar.providerId,
    observationId: sidecar.observationId,
    outputPath: sidecar.outputPath ? normalizePath(sidecar.outputPath) : undefined,
    outputHash: sidecar.outputHash,
    sidecarPath: sidecar.sidecarPath ? normalizePath(sidecar.sidecarPath) : undefined,
    sidecarHash: sidecar.sidecarHash,
    threadId: sidecar.threadId,
    turnId: sidecar.turnId,
    toolCallId: sidecar.toolCallId,
  };
}

function qaFact(sidecar: RuntimeSemanticQaSidecarFact): ArtifactSemanticQaFact {
  return {
    outputPath: sidecar.outputPath ? normalizePath(sidecar.outputPath) : undefined,
    reviewedOutputHash: sidecar.reviewedOutputHash,
    sidecarPath: sidecar.sidecarPath ? normalizePath(sidecar.sidecarPath) : undefined,
    sidecarHash: sidecar.sidecarHash,
    stableFindingIds: uniqueInOrder(sidecar.stableFindingIds || []),
    status: sidecar.status,
    p0FindingCount: sidecar.p0FindingCount,
    p1FindingCount: sidecar.p1FindingCount,
    p2FindingCount: sidecar.p2FindingCount,
  };
}

export function ingestWorkerLease(input: WorkerLeaseIngestInput): WorkerLeaseIngestResult {
  const at = input.at || input.leasedAt || defaultTimestamp;
  const now = input.now || at;
  const lease: TaskRunLedgerLease = {
    owner: input.workerId,
    leaseId: input.leaseId,
    workerId: input.workerId,
    threadId: input.threadId,
    turnId: input.turnId,
    leasedAt: input.leasedAt,
    expiresAt: input.expiresAt,
    status: input.status,
    retryBudget: input.retryBudget,
    retryCount: input.retryCount,
    stallTimeoutSeconds: input.stallTimeoutSeconds,
    resumePolicy: input.resumePolicy,
  };
  const expired = isExpired(input.expiresAt, now);
  const blockers = uniqueInOrder([
    ...(input.leaseId ? [] : ["leaseId is required."]),
    ...(input.workerId ? [] : ["workerId is required."]),
    ...(input.retryCount > input.retryBudget ? ["retryCount must not exceed retryBudget."] : []),
    ...(expired && (input.status === "leased" || input.status === "running") ? ["Expired lease cannot continue running; emit stalled/interrupted or acquire a new lease."] : []),
  ]);
  const ledgerEvents = blockers.length
    ? []
    : [
        {
          eventType: leaseEventType(input.status),
          at,
          taskRunId: input.taskRunId,
          envelopeId: input.envelopeId,
          workerId: input.workerId,
          lease,
          reason: input.reason,
          notes: [`Worker lease ${input.status} fact ingested without spawning a worker.`],
        },
      ];

  return {
    schemaVersion: runtimeIngestShellSchemaVersion,
    kind: "worker_lease",
    lease,
    ledgerEvents,
    resumability: resumabilityFor(input, expired),
    blockers,
    warnings: expired && input.status !== "failed" ? ["Lease is expired and needs recovery handling."] : [],
  };
}

export function ingestQueueDecision(input: RuntimeQueueIngestInput): RuntimeQueueIngestResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  let status: RuntimeQueueIngestStatus = "queued";

  if (input.preflightBlocked) {
    status = "blocked";
    blockers.push(input.reason || "Preflight blocked this task before queue entry.");
  } else if (!input.userEnabled || input.providerPolicyStatus !== "enabled") {
    status = "parked";
    warnings.push(input.reason || "Provider policy or user enablement parks this task.");
  } else if (input.capacityStatus === "full") {
    warnings.push("Capacity is full now; task remains queued until a slot is available.");
  }

  const ledgerEvents: AppendableTaskRunLedgerEvent[] =
    status === "blocked"
      ? []
      : [
          {
            eventType: status === "parked" ? "parked" : "task_queued",
            at: input.at || defaultTimestamp,
            taskRunId: input.taskRunId,
            envelopeId: input.envelopeId,
            reason: input.reason,
            notes: [
              status === "parked"
                ? "Queue ingest parked this task because execution is policy/user blocked."
                : "Queue ingest accepted this task as queued, pending available capacity.",
            ],
          },
        ];

  return {
    schemaVersion: runtimeIngestShellSchemaVersion,
    kind: "queue",
    status,
    ledgerEvents,
    blockers,
    warnings,
  };
}

export function ingestWatcherFileEvent(event: RuntimeWatcherFileEvent): RuntimeWatcherIngestResult {
  const sourceIntent = sourceIntentFor(event.source, event.sourceIntent);
  const sandboxAllowedPrefixes = uniqueInOrder(event.sandboxAllowedPrefixes.map(normalizePath));
  const normalizedPath = normalizePath(event.path);
  const expectedOutputPath = event.expectedOutputPath ? normalizePath(event.expectedOutputPath) : normalizedPath;
  const blockers = uniqueInOrder([
    ...sourceBlockers(event.source, sourceIntent),
    ...(sandboxAllowedPrefixes.length ? [] : ["At least one sandbox allowed prefix is required."]),
    ...sandboxBlockers("path", normalizedPath, sandboxAllowedPrefixes),
    ...sandboxBlockers("expectedOutputPath", expectedOutputPath, sandboxAllowedPrefixes),
    ...sidecarPaths(event.sidecar).flatMap((path) => sandboxBlockers("sidecar path", path, sandboxAllowedPrefixes)),
  ]);
  const warnings = event.source === "verify_scan" ? ["verify_scan fact is recovery/audit evidence only."] : [];
  let output: ArtifactOutputFact | undefined;
  let providerObservation: ArtifactProviderObservationFact | undefined;
  let semanticQa: ArtifactSemanticQaFact | undefined;
  const ledgerEvents: AppendableTaskRunLedgerEvent[] = [];

  if (!blockers.length && (event.eventType === "created" || event.eventType === "changed")) {
    ledgerEvents.push({
      eventType: "task_waiting_output",
      at: event.at,
      taskRunId: event.taskRunId,
      envelopeId: event.envelopeId,
      reason: `${event.eventType} event observed; waiting for settled hash.`,
      notes: ["File event is not settled; UI should continue waiting for file stability."],
    });
  }

  if (!blockers.length && (event.eventType === "settled" || event.eventType === "hash_observed")) {
    if (event.hash) {
      output = {
        path: expectedOutputPath,
        hash: event.hash,
        hashAlgorithm: event.hashAlgorithm,
        byteLength: event.byteLength,
      };
      ledgerEvents.push({
        eventType: "output_detected_no_sidecar",
        at: event.at,
        taskRunId: event.taskRunId,
        envelopeId: event.envelopeId,
        output,
        notes: [`${event.eventType} file event produced a portable output hash fact.`],
      });
    } else {
      blockers.push("settled/hash_observed file events require hash before they can become output facts.");
    }
  }

  if (!blockers.length && event.eventType === "sidecar_paired" && event.sidecar) {
    if (event.sidecar.kind === "provider_observation") {
      providerObservation = providerFact(event.sidecar);
      ledgerEvents.push({
        eventType: "provider_observed",
        at: event.at,
        taskRunId: event.taskRunId,
        envelopeId: event.envelopeId,
        providerObservation: {
          providerId: providerObservation.providerId,
          observationId: providerObservation.observationId,
          outputPath: providerObservation.outputPath || expectedOutputPath,
          outputHash: providerObservation.outputHash || "",
          sidecarPath: providerObservation.sidecarPath,
          sidecarHash: providerObservation.sidecarHash,
          appServerThreadId: providerObservation.threadId,
          appServerTurnId: providerObservation.turnId,
          appServerToolCallId: providerObservation.toolCallId,
        },
        notes: ["Provider sidecar paired with output hash as a portable fact."],
      });
    } else {
      semanticQa = qaFact(event.sidecar);
      ledgerEvents.push({
        eventType: semanticQa.status === "pass" ? "qa_passed" : semanticQa.status === "needs_review" ? "needs_review" : semanticQa.status === "failed" ? "failed" : "qa_pending",
        at: event.at,
        taskRunId: event.taskRunId,
        envelopeId: event.envelopeId,
        qaReview: {
          outputPath: semanticQa.outputPath || expectedOutputPath,
          reviewedOutputHash: semanticQa.reviewedOutputHash || "",
          sidecarPath: semanticQa.sidecarPath,
          sidecarHash: semanticQa.sidecarHash,
          status: semanticQa.status,
          findingIds: semanticQa.stableFindingIds,
          p0FindingCount: semanticQa.p0FindingCount,
          p1FindingCount: semanticQa.p1FindingCount,
          p2FindingCount: semanticQa.p2FindingCount,
        },
        notes: ["Semantic QA sidecar paired with reviewed output hash as a portable fact."],
      });
    }
  }

  return {
    schemaVersion: runtimeIngestShellSchemaVersion,
    kind: "watcher",
    source: event.source,
    sourceIntent,
    eventType: event.eventType,
    output,
    providerObservation,
    semanticQa,
    ledgerEvents,
    blockers: uniqueInOrder(blockers),
    warnings: uniqueInOrder(warnings),
  };
}

export function ingestAppServerEvent(input: RuntimeAppServerIngestInput): RuntimeAppServerIngestResult {
  const event = input.event;
  const hardLocks = runtimeIngestHardLocks;
  const blockers = uniqueInOrder([
    ...(input.liveTransportEnabled ? ["liveTransportEnabled must remain false for runtime ingest shell tests."] : []),
    ...(input.canLaunchAppServer ? ["canLaunchAppServer must remain false for runtime ingest shell tests."] : []),
    ...(input.ingestOnly === false ? ["ingestOnly must remain true; app-server is not the source of truth."] : []),
  ]);
  const warnings: string[] = [];
  let watcher: RuntimeWatcherIngestResult | undefined;
  let ledgerEvents: AppendableTaskRunLedgerEvent[] = [];

  if (!blockers.length && event.eventKind === "fsChanged") {
    if (!event.taskRunId || !event.path) {
      blockers.push("fsChanged ingest requires taskRunId and path.");
    } else {
      watcher = ingestWatcherFileEvent({
        eventId: event.eventId,
        eventType: event.hash ? "hash_observed" : "changed",
        at: event.at,
        source: "app_server_fs_changed",
        sourceIntent: "normal",
        taskRunId: event.taskRunId,
        envelopeId: event.envelopeId,
        path: event.path,
        expectedOutputPath: event.expectedOutputPath,
        hash: event.hash,
        sidecar: event.sidecar,
        sandboxAllowedPrefixes: input.sandboxAllowedPrefixes || [],
      });
      ledgerEvents = watcher.ledgerEvents;
      blockers.push(...watcher.blockers);
      warnings.push(...watcher.warnings);
    }
  }

  if (!blockers.length && (event.eventKind === "disconnect" || event.eventKind === "reconnect")) {
    warnings.push(`${event.eventKind} is recovery metadata only; ledger state changes require worker lease or watcher facts.`);
  }

  if (!blockers.length && event.eventKind === "approval") {
    warnings.push("Approval events are recorded as facts only; this shell cannot bypass approval or mutate files.");
  }

  return {
    schemaVersion: runtimeIngestShellSchemaVersion,
    kind: "app_server",
    hardLocks,
    eventKind: event.eventKind,
    threadId: event.threadId,
    turnId: event.turnId,
    toolCallId: event.toolCallId,
    watcher,
    ledgerEvents,
    blockers: uniqueInOrder(blockers),
    warnings: uniqueInOrder(warnings),
  };
}

export function evaluateRuntimeArtifactFacts(input: RuntimeArtifactFactSet, at = defaultTimestamp): RuntimeArtifactGateIngestResult {
  const gateInput: ArtifactTransactionGateInput = {
    taskRunId: input.taskRunId,
    envelopeId: input.envelopeId,
    expectedOutputPath: input.expectedOutputPath,
    output: input.output,
    providerObservation: input.providerObservation,
    semanticQa: input.semanticQa,
    sandboxAllowedPrefixes: input.sandboxAllowedPrefixes,
  };
  const gateResult = evaluateArtifactTransactionGate(gateInput);

  return {
    schemaVersion: runtimeIngestShellSchemaVersion,
    kind: "artifact_gate",
    gateInput,
    gateResult,
    ledgerEvents: toTaskRunLedgerEvents(gateResult, at),
    blockers: gateResult.blockers,
    warnings: gateResult.warnings,
  };
}
