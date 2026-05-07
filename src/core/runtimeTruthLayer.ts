import {
  buildFreshRunContract,
  type FreshRunArtifactFacts,
  type FreshRunContractState,
  type FreshRunSidecarFacts,
} from "./freshRunContract";

export const runtimeTruthLayerSchemaVersion = "0.1.0";

export type TaskRunLifecycleStatus =
  | "prepared"
  | "leased"
  | "running"
  | "output_detected"
  | "provider_observed"
  | "semantic_qa_pending"
  | "semantic_qa_complete"
  | "preview_ready"
  | "blocked";

export type TaskRunLifecycleEvent =
  | "lease_recorded"
  | "worker_started"
  | "output_detected"
  | "provider_observed"
  | "semantic_qa_required"
  | "semantic_qa_complete"
  | "preview_ready"
  | "block";

export type RuntimeTruthLayerStatus = "preview_ready" | "blocked";

export type SemanticQaGateKey = "identity" | "scene" | "style" | "story" | "neighbor" | "output";
export type SemanticQaGateStatus = "pass" | "warn" | "fail" | "blocked" | "missing";

export type RuntimeTruthWatcherEventType =
  | "file_observed"
  | "file_stable"
  | "hash_recorded"
  | "sidecar_paired"
  | "qa_paired";

export interface WorkerLeaseFacts {
  leaseId?: string;
  workerId?: string;
  subagentId?: string;
  threadId?: string;
  turnId?: string;
  toolCallId?: string;
  leaseStartedAt?: string;
  leaseExpiresAt?: string;
  retryBudget?: number;
  resumable?: boolean;
  interrupted?: boolean;
  resumed?: boolean;
}

export interface ProviderObservationReceiptV2Facts extends FreshRunSidecarFacts {
  runId?: string;
  generatedAt?: string;
  providerId?: string;
  providerSelfReportedComplete?: boolean;
}

export interface SemanticQaSeverityCounts {
  p0: number;
  p1: number;
  p2: number;
}

export interface SemanticQaReceiptV2Facts extends FreshRunSidecarFacts {
  runId?: string;
  reviewedAt?: string;
  reviewedOutputSha256?: string;
  gates?: Partial<Record<SemanticQaGateKey, SemanticQaGateStatus>>;
  severityCounts?: Partial<SemanticQaSeverityCounts>;
}

export interface RuntimeTruthWatcherEventFacts {
  eventId: string;
  sequence: number;
  eventType: RuntimeTruthWatcherEventType;
  occurredAt: string;
  runId: string;
  taskRunId: string;
  taskPacketId: string;
  envelopeId: string;
  artifactPath?: string;
  outputPath?: string;
  outputSha256?: string;
  sidecarKind?: "provider_observation" | "semantic_qa";
  sidecarPath?: string;
  notes?: string[];
}

export interface BuildRuntimeTruthLayerInput {
  generatedAt: string;
  runId: string;
  manifestGeneratedAt: string;
  taskRunId: string;
  shotId?: string;
  taskPacketId: string;
  envelopeId: string;
  expectedOutputPath: string;
  artifact: FreshRunArtifactFacts;
  workerLease?: WorkerLeaseFacts;
  providerObservation?: ProviderObservationReceiptV2Facts;
  semanticQa?: SemanticQaReceiptV2Facts;
  watcherEvents?: RuntimeTruthWatcherEventFacts[];
  allowedClockSkewMs?: number;
}

export interface TaskRunLifecycleState {
  currentStatus: TaskRunLifecycleStatus;
  reachedStatuses: TaskRunLifecycleStatus[];
  transitions: Array<{
    from: TaskRunLifecycleStatus;
    event: TaskRunLifecycleEvent;
    to: TaskRunLifecycleStatus;
  }>;
  binding: {
    runId: string;
    taskRunId: string;
    shotId?: string;
    taskPacketId: string;
    envelopeId: string;
    expectedOutputPath: string;
  };
  timestamps: {
    generatedAt: string;
    manifestGeneratedAt: string;
  };
  blockers: string[];
  warnings: string[];
}

export interface WorkerLeaseState extends WorkerLeaseFacts {
  present: boolean;
  identityComplete: boolean;
  timingComplete: boolean;
  notExpired: boolean;
  retryBudgetAvailable: boolean;
  resumptionConsistent: boolean;
  verified: boolean;
  blockers: string[];
  warnings: string[];
}

export interface ProviderObservationReceiptV2State extends ProviderObservationReceiptV2Facts {
  present: boolean;
  runMatched: boolean;
  bindingMatched: boolean;
  hashPresent: boolean;
  hashMatched: boolean;
  generatedAtFresh: boolean;
  sidecarModifiedAtFresh: boolean;
  providerSelfReportRejected: boolean;
  verified: boolean;
  blockers: string[];
  warnings: string[];
}

export interface SemanticQaReceiptV2State extends SemanticQaReceiptV2Facts {
  present: boolean;
  runMatched: boolean;
  bindingMatched: boolean;
  hashPresent: boolean;
  hashMatched: boolean;
  reviewedAtFresh: boolean;
  sidecarModifiedAtFresh: boolean;
  gates: Record<SemanticQaGateKey, SemanticQaGateStatus>;
  gatesComplete: boolean;
  gatesPassable: boolean;
  severityCounts: SemanticQaSeverityCounts;
  noP0: boolean;
  noP1: boolean;
  verified: boolean;
  blockers: string[];
  warnings: string[];
}

export interface RuntimeTruthWatcherEventLogState {
  requiredEventTypes: RuntimeTruthWatcherEventType[];
  events: RuntimeTruthWatcherEventFacts[];
  appendOnly: boolean;
  bindingMatched: boolean;
  eventsFresh: boolean;
  requiredEventsPresent: boolean;
  hashRecorded: boolean;
  providerSidecarPaired: boolean;
  semanticQaPaired: boolean;
  verified: boolean;
  blockers: string[];
  warnings: string[];
}

export interface RuntimeTruthLayerState {
  schemaVersion: typeof runtimeTruthLayerSchemaVersion;
  generatedAt: string;
  phase: "runtime_truth_layer";
  status: RuntimeTruthLayerStatus;
  runId: string;
  manifestGeneratedAt: string;
  taskRunId: string;
  shotId?: string;
  taskPacketId: string;
  envelopeId: string;
  expectedOutputPath: string;
  lifecycle: TaskRunLifecycleState;
  workerLease: WorkerLeaseState;
  providerObservation: ProviderObservationReceiptV2State;
  semanticQa: SemanticQaReceiptV2State;
  watcherEventLog: RuntimeTruthWatcherEventLogState;
  freshRunContract: FreshRunContractState;
  verification: {
    workerLeaseVerified: boolean;
    outputFresh: boolean;
    providerObservationVerified: boolean;
    semanticQaVerified: boolean;
    watcherLogVerified: boolean;
    freshRunContractReady: boolean;
  };
  blockers: string[];
  warnings: string[];
  notes: string[];
}

const lifecycleTransitions: Record<TaskRunLifecycleStatus, Partial<Record<TaskRunLifecycleEvent, TaskRunLifecycleStatus>>> = {
  prepared: {
    lease_recorded: "leased",
    block: "blocked",
  },
  leased: {
    worker_started: "running",
    block: "blocked",
  },
  running: {
    output_detected: "output_detected",
    block: "blocked",
  },
  output_detected: {
    provider_observed: "provider_observed",
    block: "blocked",
  },
  provider_observed: {
    semantic_qa_required: "semantic_qa_pending",
    semantic_qa_complete: "semantic_qa_complete",
    block: "blocked",
  },
  semantic_qa_pending: {
    semantic_qa_complete: "semantic_qa_complete",
    block: "blocked",
  },
  semantic_qa_complete: {
    preview_ready: "preview_ready",
    block: "blocked",
  },
  preview_ready: {
    block: "blocked",
  },
  blocked: {},
};

const requiredQaGateKeys: SemanticQaGateKey[] = ["identity", "scene", "style", "story", "neighbor", "output"];
const requiredWatcherEventTypes: RuntimeTruthWatcherEventType[] = ["file_observed", "file_stable", "hash_recorded", "sidecar_paired", "qa_paired"];

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).sort((left, right) => left.localeCompare(right));
}

function uniqueOrdered<T extends string>(values: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
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

function timestampIsNotExpired(value: string | undefined, generatedAt: string): boolean {
  const valueMs = parseTimestampMs(value);
  const generatedMs = parseTimestampMs(generatedAt);
  if (valueMs === null || generatedMs === null) return false;
  return valueMs >= generatedMs;
}

function normalizePath(value: string | undefined): string {
  return String(value || "").replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function pathsMatch(left: string | undefined, right: string | undefined): boolean {
  return Boolean(left && right && normalizePath(left) === normalizePath(right));
}

function bindingMatched(input: BuildRuntimeTruthLayerInput, facts: FreshRunSidecarFacts | undefined): boolean {
  if (!facts?.exists) return false;
  return (
    facts.taskRunId === input.taskRunId &&
    facts.taskPacketId === input.taskPacketId &&
    facts.envelopeId === input.envelopeId &&
    pathsMatch(facts.outputPath, input.expectedOutputPath)
  );
}

export function transitionTaskRunLifecycle(
  currentStatus: TaskRunLifecycleStatus,
  event: TaskRunLifecycleEvent,
): { from: TaskRunLifecycleStatus; event: TaskRunLifecycleEvent; to: TaskRunLifecycleStatus; accepted: boolean } {
  const to = lifecycleTransitions[currentStatus]?.[event];
  return {
    from: currentStatus,
    event,
    to: to || currentStatus,
    accepted: Boolean(to),
  };
}

function applyLifecycleEvents(events: TaskRunLifecycleEvent[]): TaskRunLifecycleState["transitions"] {
  let currentStatus: TaskRunLifecycleStatus = "prepared";
  const transitions: TaskRunLifecycleState["transitions"] = [];
  for (const event of events) {
    const transition = transitionTaskRunLifecycle(currentStatus, event);
    if (!transition.accepted) continue;
    transitions.push({
      from: transition.from,
      event: transition.event,
      to: transition.to,
    });
    currentStatus = transition.to;
  }
  return transitions;
}

function buildWorkerLeaseState(input: BuildRuntimeTruthLayerInput): WorkerLeaseState {
  const lease = input.workerLease;
  const present = Boolean(lease);
  const identityComplete = Boolean(
    lease &&
      nonEmpty(lease.leaseId) &&
      nonEmpty(lease.workerId) &&
      nonEmpty(lease.subagentId) &&
      nonEmpty(lease.threadId) &&
      nonEmpty(lease.turnId) &&
      nonEmpty(lease.toolCallId),
  );
  const timingComplete = Boolean(lease && nonEmpty(lease.leaseStartedAt) && nonEmpty(lease.leaseExpiresAt));
  const notExpired = Boolean(lease && timestampIsNotExpired(lease.leaseExpiresAt, input.generatedAt));
  const retryBudgetAvailable = Number(lease?.retryBudget ?? -1) >= 0;
  const resumptionConsistent = !lease?.resumed || lease.interrupted === true;
  const blockers = uniqueSorted([
    present ? "" : "runtime_truth_worker_lease_missing",
    identityComplete ? "" : "runtime_truth_worker_provenance_incomplete",
    timingComplete ? "" : "runtime_truth_worker_lease_timing_incomplete",
    notExpired ? "" : "runtime_truth_worker_lease_expired",
    retryBudgetAvailable ? "" : "runtime_truth_worker_retry_budget_missing",
    resumptionConsistent ? "" : "runtime_truth_worker_resumed_without_interruption",
  ]);
  return {
    leaseId: lease?.leaseId,
    workerId: lease?.workerId,
    subagentId: lease?.subagentId,
    threadId: lease?.threadId,
    turnId: lease?.turnId,
    toolCallId: lease?.toolCallId,
    leaseStartedAt: lease?.leaseStartedAt,
    leaseExpiresAt: lease?.leaseExpiresAt,
    retryBudget: lease?.retryBudget,
    resumable: lease?.resumable,
    interrupted: lease?.interrupted,
    resumed: lease?.resumed,
    present,
    identityComplete,
    timingComplete,
    notExpired,
    retryBudgetAvailable,
    resumptionConsistent,
    verified: blockers.length === 0,
    blockers,
    warnings: uniqueSorted([
      lease?.resumable ? "" : "runtime_truth_worker_not_resumable",
      lease?.interrupted ? "runtime_truth_worker_interrupted_recorded" : "",
    ]),
  };
}

function buildProviderObservationReceiptV2State(input: BuildRuntimeTruthLayerInput): ProviderObservationReceiptV2State {
  const observation = input.providerObservation;
  const present = observation?.exists === true;
  const runMatched = present && observation.runId === input.runId;
  const matched = bindingMatched(input, observation);
  const hashPresent = nonEmpty(observation?.outputSha256);
  const hashMatched = Boolean(hashPresent && observation?.outputSha256 === input.artifact.outputSha256);
  const generatedAtFresh = present && timestampIsFresh(observation?.generatedAt, input.manifestGeneratedAt, input.allowedClockSkewMs || 1000);
  const sidecarModifiedAtFresh = present && timestampIsFresh(observation?.sidecarModifiedAt, input.manifestGeneratedAt, input.allowedClockSkewMs || 1000);
  const providerSelfReportRejected = observation?.providerSelfReportedComplete !== true;
  const blockers = uniqueSorted([
    present ? "" : "runtime_truth_provider_observation_missing",
    runMatched ? "" : "runtime_truth_provider_observation_run_mismatch",
    matched ? "" : "runtime_truth_provider_observation_binding_mismatch",
    hashPresent ? "" : "runtime_truth_provider_observation_hash_missing",
    hashMatched ? "" : "runtime_truth_provider_observation_hash_mismatch",
    generatedAtFresh ? "" : "runtime_truth_provider_observation_generated_at_stale",
    sidecarModifiedAtFresh ? "" : "runtime_truth_provider_observation_sidecar_stale",
    providerSelfReportRejected ? "" : "runtime_truth_provider_self_report_cannot_complete",
  ]);
  return {
    ...observation,
    exists: present,
    present,
    runMatched,
    bindingMatched: matched,
    hashPresent,
    hashMatched,
    generatedAtFresh,
    sidecarModifiedAtFresh,
    providerSelfReportRejected,
    verified: blockers.length === 0,
    blockers,
    warnings: [],
  };
}

function normalizeQaGates(gates: SemanticQaReceiptV2Facts["gates"]): Record<SemanticQaGateKey, SemanticQaGateStatus> {
  return requiredQaGateKeys.reduce((accumulator, key) => {
    accumulator[key] = gates?.[key] || "missing";
    return accumulator;
  }, {} as Record<SemanticQaGateKey, SemanticQaGateStatus>);
}

function normalizeSeverityCounts(counts: SemanticQaReceiptV2Facts["severityCounts"]): SemanticQaSeverityCounts {
  return {
    p0: Number(counts?.p0 ?? 0),
    p1: Number(counts?.p1 ?? 0),
    p2: Number(counts?.p2 ?? 0),
  };
}

function buildSemanticQaReceiptV2State(input: BuildRuntimeTruthLayerInput): SemanticQaReceiptV2State {
  const qa = input.semanticQa;
  const present = qa?.exists === true;
  const runMatched = present && qa.runId === input.runId;
  const matched = bindingMatched(input, qa);
  const hashPresent = nonEmpty(qa?.reviewedOutputSha256);
  const hashMatched = Boolean(hashPresent && qa?.reviewedOutputSha256 === input.artifact.outputSha256);
  const reviewedAtFresh = present && timestampIsFresh(qa?.reviewedAt, input.manifestGeneratedAt, input.allowedClockSkewMs || 1000);
  const sidecarModifiedAtFresh = present && timestampIsFresh(qa?.sidecarModifiedAt, input.manifestGeneratedAt, input.allowedClockSkewMs || 1000);
  const gates = normalizeQaGates(qa?.gates);
  const gatesComplete = requiredQaGateKeys.every((key) => gates[key] !== "missing");
  const gatesPassable = requiredQaGateKeys.every((key) => gates[key] === "pass" || gates[key] === "warn");
  const severityCounts = normalizeSeverityCounts(qa?.severityCounts);
  const noP0 = severityCounts.p0 === 0;
  const noP1 = severityCounts.p1 === 0;
  const blockers = uniqueSorted([
    present ? "" : "runtime_truth_semantic_qa_missing",
    runMatched ? "" : "runtime_truth_semantic_qa_run_mismatch",
    matched ? "" : "runtime_truth_semantic_qa_binding_mismatch",
    hashPresent ? "" : "runtime_truth_semantic_qa_reviewed_hash_missing",
    hashMatched ? "" : "runtime_truth_semantic_qa_hash_mismatch",
    reviewedAtFresh ? "" : "runtime_truth_semantic_qa_reviewed_at_stale",
    sidecarModifiedAtFresh ? "" : "runtime_truth_semantic_qa_sidecar_stale",
    gatesComplete ? "" : "runtime_truth_semantic_qa_gates_incomplete",
    gatesPassable ? "" : "runtime_truth_semantic_qa_gate_failed",
    noP0 ? "" : "runtime_truth_semantic_qa_p0_blocker",
    noP1 ? "" : "runtime_truth_semantic_qa_p1_needs_review",
  ]);
  return {
    ...qa,
    exists: present,
    present,
    runMatched,
    bindingMatched: matched,
    hashPresent,
    hashMatched,
    reviewedAtFresh,
    sidecarModifiedAtFresh,
    gates,
    gatesComplete,
    gatesPassable,
    severityCounts,
    noP0,
    noP1,
    verified: blockers.length === 0,
    blockers,
    warnings: uniqueSorted([
      severityCounts.p2 > 0 ? "runtime_truth_semantic_qa_p2_note_present" : "",
    ]),
  };
}

function watcherEventBindingMatched(input: BuildRuntimeTruthLayerInput, event: RuntimeTruthWatcherEventFacts): boolean {
  return (
    event.runId === input.runId &&
    event.taskRunId === input.taskRunId &&
    event.taskPacketId === input.taskPacketId &&
    event.envelopeId === input.envelopeId &&
    (!event.outputPath || pathsMatch(event.outputPath, input.expectedOutputPath)) &&
    (!event.artifactPath || pathsMatch(event.artifactPath, input.expectedOutputPath))
  );
}

function hasWatcherEvent(events: RuntimeTruthWatcherEventFacts[], eventType: RuntimeTruthWatcherEventType): boolean {
  return events.some((event) => event.eventType === eventType);
}

function buildRuntimeTruthWatcherEventLog(input: BuildRuntimeTruthLayerInput): RuntimeTruthWatcherEventLogState {
  const events = input.watcherEvents || [];
  const eventIds = new Set<string>();
  let previousSequence = -1;
  let previousOccurredAt = 0;
  const appendOnly = events.every((event) => {
    const unique = !eventIds.has(event.eventId);
    eventIds.add(event.eventId);
    const sequenceOk = Number.isInteger(event.sequence) && event.sequence > previousSequence;
    previousSequence = event.sequence;
    const occurredAt = parseTimestampMs(event.occurredAt) || 0;
    const timeOk = occurredAt >= previousOccurredAt;
    previousOccurredAt = occurredAt;
    return unique && sequenceOk && timeOk;
  });
  const bindingIsMatched = events.length > 0 && events.every((event) => watcherEventBindingMatched(input, event));
  const eventsFresh = events.length > 0 && events.every((event) => timestampIsFresh(event.occurredAt, input.manifestGeneratedAt, input.allowedClockSkewMs || 1000));
  const requiredEventsPresent = requiredWatcherEventTypes.every((eventType) => hasWatcherEvent(events, eventType));
  const hashRecorded = events.some((event) => event.eventType === "hash_recorded" && event.outputSha256 === input.artifact.outputSha256);
  const providerSidecarPaired = events.some(
    (event) =>
      event.eventType === "sidecar_paired" &&
      event.sidecarKind === "provider_observation" &&
      pathsMatch(event.sidecarPath, input.providerObservation?.sidecarPath),
  );
  const semanticQaPaired = events.some(
    (event) => event.eventType === "qa_paired" && event.sidecarKind === "semantic_qa" && pathsMatch(event.sidecarPath, input.semanticQa?.sidecarPath),
  );
  const blockers = uniqueSorted([
    appendOnly ? "" : "runtime_truth_watcher_log_not_append_only",
    bindingIsMatched ? "" : "runtime_truth_watcher_log_binding_mismatch",
    eventsFresh ? "" : "runtime_truth_watcher_log_stale",
    requiredEventsPresent ? "" : "runtime_truth_watcher_log_required_events_missing",
    hashRecorded ? "" : "runtime_truth_watcher_hash_not_recorded",
    providerSidecarPaired ? "" : "runtime_truth_watcher_provider_sidecar_not_paired",
    semanticQaPaired ? "" : "runtime_truth_watcher_semantic_qa_not_paired",
  ]);
  return {
    requiredEventTypes: requiredWatcherEventTypes,
    events,
    appendOnly,
    bindingMatched: bindingIsMatched,
    eventsFresh,
    requiredEventsPresent,
    hashRecorded,
    providerSidecarPaired,
    semanticQaPaired,
    verified: blockers.length === 0,
    blockers,
    warnings: [],
  };
}

function lifecycleEventsFor(input: {
  workerLeaseVerified: boolean;
  outputFresh: boolean;
  providerObservationVerified: boolean;
  semanticQaVerified: boolean;
  allReady: boolean;
  blocked: boolean;
}): TaskRunLifecycleEvent[] {
  const events: TaskRunLifecycleEvent[] = [];
  if (input.workerLeaseVerified) events.push("lease_recorded", "worker_started");
  if (input.outputFresh) events.push("output_detected");
  if (input.providerObservationVerified) events.push("provider_observed");
  if (input.providerObservationVerified) events.push("semantic_qa_required");
  if (input.semanticQaVerified) events.push("semantic_qa_complete");
  if (input.allReady) events.push("preview_ready");
  if (input.blocked) events.push("block");
  return events;
}

export function buildTaskRunLifecycle(input: BuildRuntimeTruthLayerInput, blockers: string[] = []): TaskRunLifecycleState {
  const workerLease = buildWorkerLeaseState(input);
  const providerObservation = buildProviderObservationReceiptV2State(input);
  const semanticQa = buildSemanticQaReceiptV2State(input);
  const outputFresh = input.artifact.exists === true && timestampIsFresh(input.artifact.fileModifiedAt, input.manifestGeneratedAt, input.allowedClockSkewMs || 1000);
  const allReady = blockers.length === 0 && workerLease.verified && outputFresh && providerObservation.verified && semanticQa.verified;
  const transitions = applyLifecycleEvents(
    lifecycleEventsFor({
      workerLeaseVerified: workerLease.verified,
      outputFresh,
      providerObservationVerified: providerObservation.verified,
      semanticQaVerified: semanticQa.verified,
      allReady,
      blocked: blockers.length > 0,
    }),
  );
  const reachedStatuses = uniqueOrdered(["prepared", ...transitions.map((transition) => transition.to)]);
  return {
    currentStatus: transitions[transitions.length - 1]?.to || "prepared",
    reachedStatuses,
    transitions,
    binding: {
      runId: input.runId,
      taskRunId: input.taskRunId,
      shotId: input.shotId,
      taskPacketId: input.taskPacketId,
      envelopeId: input.envelopeId,
      expectedOutputPath: input.expectedOutputPath,
    },
    timestamps: {
      generatedAt: input.generatedAt,
      manifestGeneratedAt: input.manifestGeneratedAt,
    },
    blockers,
    warnings: [],
  };
}

export function buildRuntimeTruthLayer(input: BuildRuntimeTruthLayerInput): RuntimeTruthLayerState {
  const workerLease = buildWorkerLeaseState(input);
  const providerObservation = buildProviderObservationReceiptV2State(input);
  const semanticQa = buildSemanticQaReceiptV2State(input);
  const watcherEventLog = buildRuntimeTruthWatcherEventLog(input);
  const freshRunContract = buildFreshRunContract({
    generatedAt: input.generatedAt,
    runId: input.runId,
    manifestGeneratedAt: input.manifestGeneratedAt,
    taskRunId: input.taskRunId,
    taskPacketId: input.taskPacketId,
    envelopeId: input.envelopeId,
    outputPath: input.expectedOutputPath,
    artifact: input.artifact,
    providerObservation: {
      sidecarPath: input.providerObservation?.sidecarPath,
      exists: input.providerObservation?.exists === true,
      sidecarModifiedAt: input.providerObservation?.sidecarModifiedAt,
      sidecarGeneratedAt: input.providerObservation?.generatedAt || input.providerObservation?.sidecarGeneratedAt,
      taskRunId: input.providerObservation?.taskRunId,
      taskPacketId: input.providerObservation?.taskPacketId,
      envelopeId: input.providerObservation?.envelopeId,
      outputPath: input.providerObservation?.outputPath,
      outputSha256: input.providerObservation?.outputSha256,
    },
    providerObservationRequired: true,
    semanticQa: {
      sidecarPath: input.semanticQa?.sidecarPath,
      exists: input.semanticQa?.exists === true,
      sidecarModifiedAt: input.semanticQa?.sidecarModifiedAt,
      reviewedAt: input.semanticQa?.reviewedAt,
      taskRunId: input.semanticQa?.taskRunId,
      taskPacketId: input.semanticQa?.taskPacketId,
      envelopeId: input.semanticQa?.envelopeId,
      outputPath: input.semanticQa?.outputPath,
      reviewedOutputSha256: input.semanticQa?.reviewedOutputSha256,
    },
    semanticQaRequired: true,
    allowedClockSkewMs: input.allowedClockSkewMs,
  });
  const blockers = uniqueSorted([
    ...workerLease.blockers,
    input.artifact.exists === true ? "" : "runtime_truth_output_missing",
    timestampIsFresh(input.artifact.fileModifiedAt, input.manifestGeneratedAt, input.allowedClockSkewMs || 1000) ? "" : "runtime_truth_output_stale",
    input.artifact.outputSha256 ? "" : "runtime_truth_output_hash_missing",
    ...providerObservation.blockers,
    ...semanticQa.blockers,
    ...watcherEventLog.blockers,
    ...freshRunContract.blockers.map((blocker) => `runtime_truth_${blocker}`),
  ]);
  const ready =
    blockers.length === 0 &&
    workerLease.verified &&
    providerObservation.verified &&
    semanticQa.verified &&
    watcherEventLog.verified &&
    freshRunContract.status === "ready";
  const lifecycle = buildTaskRunLifecycle(input, blockers);
  return {
    schemaVersion: runtimeTruthLayerSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "runtime_truth_layer",
    status: ready ? "preview_ready" : "blocked",
    runId: input.runId,
    manifestGeneratedAt: input.manifestGeneratedAt,
    taskRunId: input.taskRunId,
    shotId: input.shotId,
    taskPacketId: input.taskPacketId,
    envelopeId: input.envelopeId,
    expectedOutputPath: input.expectedOutputPath,
    lifecycle,
    workerLease,
    providerObservation,
    semanticQa,
    watcherEventLog,
    freshRunContract,
    verification: {
      workerLeaseVerified: workerLease.verified,
      outputFresh: input.artifact.exists === true && timestampIsFresh(input.artifact.fileModifiedAt, input.manifestGeneratedAt, input.allowedClockSkewMs || 1000),
      providerObservationVerified: providerObservation.verified,
      semanticQaVerified: semanticQa.verified,
      watcherLogVerified: watcherEventLog.verified,
      freshRunContractReady: freshRunContract.status === "ready",
    },
    blockers,
    warnings: uniqueSorted([
      ...workerLease.warnings,
      ...providerObservation.warnings,
      ...semanticQa.warnings,
      ...watcherEventLog.warnings,
      ...freshRunContract.warnings.map((warning) => `runtime_truth_${warning}`),
    ]),
    notes: [
      "Runtime Truth Layer is pure software state. It does not submit providers, launch app-server, spawn workers, start filesystem daemons, mutate files, generate images, generate videos, or call external APIs.",
      "Preview readiness requires worker/subagent provenance, current-run output freshness, hash-bound provider observation, hash-bound semantic QA, and an append-only watcher event log.",
    ],
  };
}
