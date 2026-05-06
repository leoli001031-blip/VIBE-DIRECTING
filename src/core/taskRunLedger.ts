export const taskRunLedgerSchemaVersion = "0.1.0";

export type TaskRunLedgerStatus =
  | "prepared"
  | "queued"
  | "leased"
  | "running"
  | "waiting_output"
  | "output_detected_no_sidecar"
  | "provider_observed"
  | "qa_pending"
  | "needs_review"
  | "complete_verified"
  | "stalled"
  | "interrupted"
  | "failed"
  | "parked";

export type TaskRunLedgerEventType =
  | "task_prepared"
  | "task_queued"
  | "task_leased"
  | "task_running"
  | "task_waiting_output"
  | "output_detected_no_sidecar"
  | "provider_observed"
  | "qa_pending"
  | "qa_passed"
  | "needs_review"
  | "complete_verified"
  | "stalled"
  | "interrupted"
  | "failed"
  | "parked"
  | "worker_self_reported_success";

export interface TaskRunLedgerLease {
  owner: string;
  leaseId?: string;
  workerId?: string;
  threadId?: string;
  turnId?: string;
  leasedAt?: string;
  expiresAt?: string;
  status?: "leased" | "running" | "stalled" | "interrupted" | "failed" | "released";
  retryBudget?: number;
  retryCount?: number;
  stallTimeoutSeconds?: number;
  resumePolicy?: "resume_same_worker" | "reassign_allowed" | "fail_on_interrupt" | "manual_review";
}

export interface TaskRunLedgerOutputEvidence {
  path: string;
  hash: string;
  hashAlgorithm?: "sha256" | "sha1" | "md5" | "unknown";
  byteLength?: number;
}

export interface TaskRunLedgerProviderObservation {
  providerId?: string;
  observationId?: string;
  outputPath: string;
  outputHash: string;
  sidecarPath?: string;
  sidecarHash?: string;
  appServerThreadId?: string;
  appServerTurnId?: string;
  appServerToolCallId?: string;
}

export interface TaskRunLedgerQaReview {
  qaReportId?: string;
  outputPath: string;
  reviewedOutputHash: string;
  sidecarPath?: string;
  sidecarHash?: string;
  status: "pending" | "pass" | "needs_review" | "failed";
  findingIds: string[];
  p0FindingCount?: number;
  p1FindingCount?: number;
  p2FindingCount?: number;
}

export interface TaskRunLedgerWorkerClaim {
  status: "success" | "failed" | "cancelled";
  outputPath?: string;
  outputHash?: string;
  message?: string;
}

export interface TaskRunLedgerEvent {
  eventId: string;
  eventType: TaskRunLedgerEventType;
  at: string;
  taskRunId?: string;
  envelopeId?: string;
  workerId?: string;
  lease?: TaskRunLedgerLease;
  output?: TaskRunLedgerOutputEvidence;
  providerObservation?: TaskRunLedgerProviderObservation;
  qaReview?: TaskRunLedgerQaReview;
  workerClaim?: TaskRunLedgerWorkerClaim;
  reason?: string;
  notes: string[];
}

export interface TaskRunLedger {
  schemaVersion: string;
  ledgerId: string;
  projectId?: string;
  taskRunId: string;
  envelopeId?: string;
  createdAt: string;
  updatedAt: string;
  expectedOutputs: string[];
  events: TaskRunLedgerEvent[];
}

export interface CreateTaskRunLedgerInput {
  ledgerId?: string;
  projectId?: string;
  taskRunId: string;
  envelopeId?: string;
  createdAt?: string;
  expectedOutputs?: string[];
}

export type AppendableTaskRunLedgerEvent = Omit<TaskRunLedgerEvent, "eventId" | "at" | "notes"> & {
  eventId?: string;
  at?: string;
  notes?: string[];
};

export interface TaskRunCompletionGate {
  completeVerified: boolean;
  outputHashPresent: boolean;
  providerObservationPresent: boolean;
  providerObservationHashMatches: boolean;
  providerSidecarHashPresent: boolean;
  qaReviewPresent: boolean;
  qaReviewedHashMatches: boolean;
  qaSidecarHashPresent: boolean;
  qaPassed: boolean;
  workerSelfReportIgnored: boolean;
  blockers: string[];
}

export interface TaskRunCreatorProgress {
  status: TaskRunLedgerStatus;
  label: string;
  percent: number;
  waitingOn: string[];
  warnings: string[];
}

export interface TaskRunManifestProjection {
  taskRunId: string;
  envelopeId?: string;
  status: TaskRunLedgerStatus;
  expectedOutputs: string[];
  observedOutputs: string[];
  verifiedOutputs: string[];
  outputHashes: string[];
  blockers: string[];
}

export interface TaskRunReportProjection {
  taskRunId: string;
  status: TaskRunLedgerStatus;
  providerObserved: boolean;
  qaReviewed: boolean;
  completeVerified: boolean;
  latestOutputPath?: string;
  latestOutputHash?: string;
  terminal: boolean;
  blockers: string[];
  warnings: string[];
}

export interface TaskRunPreviewProjection {
  taskRunId: string;
  status: "missing" | "candidate" | "qa_pending" | "needs_review" | "ready" | "parked" | "failed" | "stalled" | "interrupted";
  items: Array<{
    path: string;
    hash: string;
    verified: boolean;
    needsReview: boolean;
  }>;
}

export interface TaskRunLedgerProjection {
  schemaVersion: string;
  ledgerId: string;
  taskRunId: string;
  envelopeId?: string;
  currentStatus: TaskRunLedgerStatus;
  terminal: boolean;
  latestEventAt?: string;
  currentLease?: TaskRunLedgerLease;
  latestOutput?: TaskRunLedgerOutputEvidence;
  providerObservation?: TaskRunLedgerProviderObservation;
  qaReview?: TaskRunLedgerQaReview;
  completionGate: TaskRunCompletionGate;
  creatorProgress: TaskRunCreatorProgress;
  manifestSummary: TaskRunManifestProjection;
  reportSummary: TaskRunReportProjection;
  previewSummary: TaskRunPreviewProjection;
}

const defaultTimestamp = "1970-01-01T00:00:00.000Z";
const terminalStatuses = new Set<TaskRunLedgerStatus>(["complete_verified", "failed", "parked"]);
const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/])/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;

function safeId(value: string): string {
  const safe = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return safe || "task_run";
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
}

function uniqueInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function eventIdFor(ledger: TaskRunLedger, eventType: TaskRunLedgerEventType): string {
  return `${safeId(ledger.taskRunId)}_${String(ledger.events.length + 1).padStart(4, "0")}_${eventType}`;
}

function normalizeEvent(ledger: TaskRunLedger, event: AppendableTaskRunLedgerEvent): TaskRunLedgerEvent {
  const normalized = clone(event) as TaskRunLedgerEvent;
  normalized.eventId = event.eventId || eventIdFor(ledger, event.eventType);
  normalized.at = event.at || ledger.updatedAt || ledger.createdAt || defaultTimestamp;
  normalized.taskRunId = event.taskRunId || ledger.taskRunId;
  normalized.envelopeId = event.envelopeId || ledger.envelopeId;
  normalized.notes = [...(event.notes || [])];
  if (normalized.output?.path) normalized.output.path = normalizePath(normalized.output.path);
  if (normalized.providerObservation?.outputPath) normalized.providerObservation.outputPath = normalizePath(normalized.providerObservation.outputPath);
  if (normalized.providerObservation?.sidecarPath) normalized.providerObservation.sidecarPath = normalizePath(normalized.providerObservation.sidecarPath);
  if (normalized.qaReview?.outputPath) normalized.qaReview.outputPath = normalizePath(normalized.qaReview.outputPath);
  if (normalized.qaReview?.sidecarPath) normalized.qaReview.sidecarPath = normalizePath(normalized.qaReview.sidecarPath);
  if (normalized.workerClaim?.outputPath) normalized.workerClaim.outputPath = normalizePath(normalized.workerClaim.outputPath);
  return normalized;
}

function statusForEvent(eventType: TaskRunLedgerEventType): TaskRunLedgerStatus | undefined {
  switch (eventType) {
    case "task_prepared":
      return "prepared";
    case "task_queued":
      return "queued";
    case "task_leased":
      return "leased";
    case "task_running":
      return "running";
    case "task_waiting_output":
      return "waiting_output";
    case "output_detected_no_sidecar":
      return "output_detected_no_sidecar";
    case "provider_observed":
      return "provider_observed";
    case "qa_pending":
    case "qa_passed":
      return "qa_pending";
    case "needs_review":
      return "needs_review";
    case "stalled":
      return "stalled";
    case "interrupted":
      return "interrupted";
    case "failed":
      return "failed";
    case "parked":
      return "parked";
    default:
      return undefined;
  }
}

function buildCompletionGate(input: {
  latestOutput?: TaskRunLedgerOutputEvidence;
  providerObservation?: TaskRunLedgerProviderObservation;
  qaReview?: TaskRunLedgerQaReview;
  workerSelfReportIgnored: boolean;
}): TaskRunCompletionGate {
  const outputHash = input.latestOutput?.hash;
  const providerObservationPresent = Boolean(input.providerObservation);
  const providerObservationHashMatches = Boolean(outputHash && input.providerObservation?.outputHash === outputHash);
  const providerSidecarHashPresent = Boolean(input.providerObservation?.sidecarHash);
  const qaReviewPresent = Boolean(input.qaReview);
  const qaReviewedHashMatches = Boolean(outputHash && input.qaReview?.reviewedOutputHash === outputHash);
  const qaSidecarHashPresent = Boolean(input.qaReview?.sidecarHash);
  const qaPassed = input.qaReview?.status === "pass";

  const blockers = uniqueInOrder([
    outputHash ? "" : "Output hash is required before complete_verified.",
    providerObservationPresent ? "" : "Provider observation is required before complete_verified.",
    providerObservationPresent && !providerObservationHashMatches ? "Provider observation must bind the current output hash." : "",
    providerSidecarHashPresent ? "" : "Provider observation sidecar hash is required before complete_verified.",
    qaReviewPresent ? "" : "QA review is required before complete_verified.",
    qaReviewPresent && !qaReviewedHashMatches ? "QA review must bind the current output hash." : "",
    qaSidecarHashPresent ? "" : "QA sidecar hash is required before complete_verified.",
    qaPassed ? "" : "QA status must be pass before complete_verified.",
  ]);

  return {
    completeVerified: blockers.length === 0,
    outputHashPresent: Boolean(outputHash),
    providerObservationPresent,
    providerObservationHashMatches,
    providerSidecarHashPresent,
    qaReviewPresent,
    qaReviewedHashMatches,
    qaSidecarHashPresent,
    qaPassed,
    workerSelfReportIgnored: input.workerSelfReportIgnored,
    blockers,
  };
}

function progressFor(status: TaskRunLedgerStatus, gate: TaskRunCompletionGate): TaskRunCreatorProgress {
  const percentByStatus: Record<TaskRunLedgerStatus, number> = {
    prepared: 5,
    queued: 10,
    leased: 20,
    running: 35,
    waiting_output: 45,
    output_detected_no_sidecar: 55,
    provider_observed: 70,
    qa_pending: 80,
    needs_review: 85,
    complete_verified: 100,
    stalled: 40,
    interrupted: 40,
    failed: 100,
    parked: 0,
  };
  const labelByStatus: Record<TaskRunLedgerStatus, string> = {
    prepared: "Task prepared",
    queued: "Queued",
    leased: "Worker leased",
    running: "Running",
    waiting_output: "Waiting for output",
    output_detected_no_sidecar: "Output detected; waiting for sidecars",
    provider_observed: "Provider observed; waiting for QA",
    qa_pending: "QA pending",
    needs_review: "Needs review",
    complete_verified: "Complete and verified",
    stalled: "Worker stalled",
    interrupted: "Worker interrupted",
    failed: "Failed",
    parked: "Parked",
  };

  return {
    status,
    label: labelByStatus[status],
    percent: percentByStatus[status],
    waitingOn: status === "complete_verified" ? [] : gate.blockers,
    warnings: gate.workerSelfReportIgnored ? ["Worker self-report is recorded but ignored for completion."] : [],
  };
}

function previewStatus(status: TaskRunLedgerStatus, gate: TaskRunCompletionGate): TaskRunPreviewProjection["status"] {
  if (status === "complete_verified" && gate.completeVerified) return "ready";
  if (status === "needs_review") return "needs_review";
  if (status === "qa_pending" || status === "provider_observed") return "qa_pending";
  if (status === "parked") return "parked";
  if (status === "failed") return "failed";
  if (status === "stalled") return "stalled";
  if (status === "interrupted") return "interrupted";
  if (status === "output_detected_no_sidecar") return "candidate";
  return "missing";
}

export function createTaskRunLedger(input: CreateTaskRunLedgerInput): TaskRunLedger {
  const createdAt = input.createdAt || defaultTimestamp;
  return {
    schemaVersion: taskRunLedgerSchemaVersion,
    ledgerId: input.ledgerId || `task_run_ledger_${safeId(input.taskRunId)}`,
    projectId: input.projectId,
    taskRunId: input.taskRunId,
    envelopeId: input.envelopeId,
    createdAt,
    updatedAt: createdAt,
    expectedOutputs: [...(input.expectedOutputs || []).map(normalizePath)],
    events: [],
  };
}

export function appendTaskRunEvent(ledger: TaskRunLedger, event: AppendableTaskRunLedgerEvent): TaskRunLedger {
  const normalizedEvent = normalizeEvent(ledger, event);
  return {
    ...clone(ledger),
    updatedAt: normalizedEvent.at,
    events: [...ledger.events.map((item) => clone(item)), normalizedEvent],
  };
}

export function projectTaskRunLedger(ledger: TaskRunLedger): TaskRunLedgerProjection {
  let currentStatus: TaskRunLedgerStatus = "prepared";
  let latestOutput: TaskRunLedgerOutputEvidence | undefined;
  let providerObservation: TaskRunLedgerProviderObservation | undefined;
  let qaReview: TaskRunLedgerQaReview | undefined;
  let currentLease: TaskRunLedgerLease | undefined;
  let latestEventAt: string | undefined;
  let workerSelfReportIgnored = false;
  const warnings: string[] = [];

  for (const event of ledger.events) {
    latestEventAt = event.at;
    if (event.lease) currentLease = clone(event.lease);
    if (event.output) latestOutput = clone(event.output);
    if (event.providerObservation) providerObservation = clone(event.providerObservation);
    if (event.qaReview) qaReview = clone(event.qaReview);
    if (event.workerClaim?.status === "success") workerSelfReportIgnored = true;

    const nextStatus = statusForEvent(event.eventType);
    if (nextStatus) currentStatus = nextStatus;

    if (event.eventType === "complete_verified") {
      const gateAtCompletion = buildCompletionGate({
        latestOutput,
        providerObservation,
        qaReview,
        workerSelfReportIgnored,
      });
      if (gateAtCompletion.completeVerified) {
        currentStatus = "complete_verified";
      } else {
        warnings.push("complete_verified event ignored because completion gate is not satisfied.");
      }
    }
  }

  const completionGate = buildCompletionGate({
    latestOutput,
    providerObservation,
    qaReview,
    workerSelfReportIgnored,
  });
  if (currentStatus === "complete_verified" && !completionGate.completeVerified) {
    currentStatus = qaReview?.status === "needs_review" ? "needs_review" : providerObservation ? "provider_observed" : latestOutput ? "output_detected_no_sidecar" : "waiting_output";
  }

  const observedOutputs = uniqueInOrder([
    ...(latestOutput?.path ? [latestOutput.path] : []),
    ...ledger.events.map((event) => event.output?.path || "").filter(Boolean),
  ]);
  const outputHashes = uniqueInOrder(ledger.events.map((event) => event.output?.hash || "").filter(Boolean));
  const verifiedOutputs = currentStatus === "complete_verified" && latestOutput ? [latestOutput.path] : [];
  const reportWarnings = uniqueInOrder([...warnings, ...(workerSelfReportIgnored ? ["Worker self-report success did not complete the task."] : [])]);
  const previewItems = latestOutput
    ? [
        {
          path: latestOutput.path,
          hash: latestOutput.hash,
          verified: currentStatus === "complete_verified" && completionGate.completeVerified,
          needsReview: currentStatus === "needs_review",
        },
      ]
    : [];

  return {
    schemaVersion: taskRunLedgerSchemaVersion,
    ledgerId: ledger.ledgerId,
    taskRunId: ledger.taskRunId,
    envelopeId: ledger.envelopeId,
    currentStatus,
    terminal: terminalStatuses.has(currentStatus),
    latestEventAt,
    currentLease,
    latestOutput,
    providerObservation,
    qaReview,
    completionGate,
    creatorProgress: progressFor(currentStatus, completionGate),
    manifestSummary: {
      taskRunId: ledger.taskRunId,
      envelopeId: ledger.envelopeId,
      status: currentStatus,
      expectedOutputs: [...ledger.expectedOutputs],
      observedOutputs,
      verifiedOutputs,
      outputHashes,
      blockers: completionGate.blockers,
    },
    reportSummary: {
      taskRunId: ledger.taskRunId,
      status: currentStatus,
      providerObserved: completionGate.providerObservationPresent && completionGate.providerObservationHashMatches,
      qaReviewed: completionGate.qaReviewPresent && completionGate.qaReviewedHashMatches,
      completeVerified: currentStatus === "complete_verified" && completionGate.completeVerified,
      latestOutputPath: latestOutput?.path,
      latestOutputHash: latestOutput?.hash,
      terminal: terminalStatuses.has(currentStatus),
      blockers: completionGate.blockers,
      warnings: reportWarnings,
    },
    previewSummary: {
      taskRunId: ledger.taskRunId,
      status: previewStatus(currentStatus, completionGate),
      items: previewItems,
    },
  };
}

export function projectTaskRunLedgers(ledgers: TaskRunLedger[]): {
  total: number;
  byStatus: Record<TaskRunLedgerStatus, number>;
  creatorSummary: string;
  projections: TaskRunLedgerProjection[];
} {
  const projections = ledgers.map(projectTaskRunLedger);
  const byStatus = {
    prepared: 0,
    queued: 0,
    leased: 0,
    running: 0,
    waiting_output: 0,
    output_detected_no_sidecar: 0,
    provider_observed: 0,
    qa_pending: 0,
    needs_review: 0,
    complete_verified: 0,
    stalled: 0,
    interrupted: 0,
    failed: 0,
    parked: 0,
  };
  for (const projection of projections) byStatus[projection.currentStatus] += 1;
  const creatorSummary = `${byStatus.complete_verified} complete, ${byStatus.qa_pending + byStatus.provider_observed} waiting QA, ${byStatus.needs_review} need review, ${byStatus.parked} parked`;
  return {
    total: projections.length,
    byStatus,
    creatorSummary,
    projections,
  };
}

export function validatePortableTaskRunLedgerPaths(ledger: TaskRunLedger): string[] {
  const paths = [
    ...ledger.expectedOutputs,
    ...ledger.events.flatMap((event) => [
      event.output?.path || "",
      event.providerObservation?.outputPath || "",
      event.providerObservation?.sidecarPath || "",
      event.qaReview?.outputPath || "",
      event.qaReview?.sidecarPath || "",
      event.workerClaim?.outputPath || "",
    ]),
  ].filter(Boolean);

  return uniqueInOrder(
    paths.flatMap((path) => {
      const normalized = normalizePath(path);
      if (absolutePathPattern.test(normalized)) return [`${normalized} must be project-root-relative, not absolute.`];
      if (parentTraversalPattern.test(normalized)) return [`${normalized} must not contain parent traversal.`];
      return [];
    }),
  );
}
