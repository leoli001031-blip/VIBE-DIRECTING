import type {
  CheckpointResumeHarnessItem,
  CheckpointResumeHarnessState,
  FilesystemWatcherHarnessState,
  FilesystemWatcherHarnessStream,
  GenerationHarnessJob,
  GenerationHarnessState,
  LocalTaskStatus,
  ProviderTaskStatus,
  QaHarnessItem,
  QaHarnessState,
  SubagentRunnerSlot,
  SubagentRunnerState,
  TaskEnvelope,
  TaskRun,
} from "./types";

export const localOrchestratorSchemaVersion = "0.1.0";

export type LocalOrchestratorQueueStatus =
  | "waiting"
  | "ready"
  | "running_planned"
  | "waiting_output"
  | "qa_pending"
  | "needs_review"
  | "failed"
  | "blocked"
  | "complete_verified";

export type LocalOrchestratorFactLayer =
  | "task_packet"
  | "task_envelope"
  | "task_run"
  | "generation_harness"
  | "filesystem_watcher_harness"
  | "checkpoint_resume_harness"
  | "qa_harness"
  | "subagent_runner"
  | "local_orchestrator";

export type LocalOrchestratorCodexActivityState =
  | "not_started"
  | "ready_to_start"
  | "running_planned"
  | "waiting_output"
  | "reconnect_planned"
  | "stalled"
  | "manual_review_required"
  | "verified";

export interface LocalOrchestratorTaskPacket {
  packetId: string;
  taskPlanId?: string;
  jobId?: string;
  shotId?: string;
  envelopeId?: string;
  runnerSlotId?: string;
  taskKind?: string;
  expectedOutputs?: string[];
  dependencies?: string[];
  priority?: number;
  queueOrder?: number;
  blocked?: boolean;
  blockers?: string[];
  warnings?: string[];
  sourceRefs?: string[];
}

export interface BuildLocalOrchestratorOptions {
  autoContinue?: boolean;
  concurrency?: number;
  retryBudget?: number;
  stallTimeoutSeconds?: number;
  now?: string;
}

export interface BuildLocalOrchestratorInput {
  generatedAt: string;
  taskPackets?: LocalOrchestratorTaskPacket[];
  taskEnvelopes?: TaskEnvelope[];
  taskRuns?: TaskRun[];
  generationHarness?: GenerationHarnessState;
  filesystemWatcherHarness?: FilesystemWatcherHarnessState;
  checkpointResumeHarness?: CheckpointResumeHarnessState;
  qaHarness?: QaHarnessState;
  subagentRunner?: SubagentRunnerState;
  options?: BuildLocalOrchestratorOptions;
}

export interface LocalOrchestratorFactChainEntry {
  factId: string;
  layer: LocalOrchestratorFactLayer;
  sourceRef: string;
  status: string;
  detail: string;
  at?: string;
}

export interface LocalOrchestratorCompletionGate {
  expectedOutputDeclared: boolean;
  expectedOutputObserved: boolean;
  manifestMatched: boolean;
  qaPass: boolean;
  promotionGatePassed: boolean;
  formalPromotionEligible: boolean;
  workerSelfReportPresent: boolean;
  workerSelfReportOnly: boolean;
  completeVerified: boolean;
  blockers: string[];
}

export interface LocalOrchestratorCodexActivity {
  state: LocalOrchestratorCodexActivityState;
  codexSessionId?: string;
  retryCount: number;
  retryBudget: number;
  retriesRemaining: number;
  stallTimeoutSeconds: number;
  lastEventAt?: string;
  backoffUntil?: string;
  stalled: boolean;
  stallDetectedBy: Array<"timeout" | "watcher_event">;
  manualReviewRequired: boolean;
  notes: string[];
}

export interface LocalOrchestratorAutoContinueMarker {
  eligibleAsNext: boolean;
  plannedAfterTaskId?: string;
  waitingForTaskId?: string;
  reason: string;
}

export interface LocalOrchestratorQueueItem {
  queueItemId: string;
  queueOrder: number;
  queueStatus: LocalOrchestratorQueueStatus;
  rawQueueStatus: LocalOrchestratorQueueStatus;
  taskPlanId?: string;
  jobId?: string;
  shotId?: string;
  packetId?: string;
  envelopeId?: string;
  runnerSlotId?: string;
  providerId?: string;
  expectedOutputs: string[];
  dependencies: string[];
  canExecute: false;
  canSpawnCodex: false;
  dryRunOnly: true;
  planOnly: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  noFileMutation: true;
  completionGate: LocalOrchestratorCompletionGate;
  codexActivity: LocalOrchestratorCodexActivity;
  autoContinue: LocalOrchestratorAutoContinueMarker;
  factChain: LocalOrchestratorFactChainEntry[];
  blockers: string[];
  warnings: string[];
  nextAction: string;
  notes: string[];
}

export interface LocalOrchestratorAutoContinueTransition {
  afterQueueItemId: string;
  plannedReadyQueueItemId: string;
  reason: string;
}

export interface LocalOrchestratorAutoContinuePlan {
  enabled: boolean;
  mode: "plan_only";
  concurrency: number;
  terminalQueueItemIds: string[];
  currentQueueItemIds: string[];
  nextReadyQueueItemIds: string[];
  waitingQueueItemIds: string[];
  transitions: LocalOrchestratorAutoContinueTransition[];
  notes: string[];
}

export interface LocalOrchestratorHardLocks {
  dryRunOnly: true;
  planOnly: true;
  noDaemon: true;
  daemonStarted: false;
  noSpawnCodex: true;
  noSubprocess: true;
  noShellExecution: true;
  noProviderExecution: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  noFileMutation: true;
  noCredentialRead: true;
  workerSelfReportCannotComplete: true;
  expectedOutputRequired: true;
  manifestRequired: true;
  qaGateRequired: true;
}

export interface LocalOrchestratorState {
  schemaVersion: string;
  generatedAt: string;
  queue: LocalOrchestratorQueueItem[];
  autoContinuePlan: LocalOrchestratorAutoContinuePlan;
  summary: {
    totalItems: number;
    waiting: number;
    ready: number;
    runningPlanned: number;
    waitingOutput: number;
    qaPending: number;
    needsReview: number;
    failed: number;
    blocked: number;
    completeVerified: number;
    manualReviewRequired: number;
    stalled: number;
    workerSelfReportOnly: number;
    providerSubmissionForbidden: true;
    liveSubmitAllowed: false;
    noFileMutation: true;
    daemonStarted: false;
  };
  hardLocks: LocalOrchestratorHardLocks;
  sourceCoverage: Array<{
    layer: LocalOrchestratorFactLayer;
    referenced: boolean;
    referenceCount: number;
    sourceRefs: string[];
  }>;
  dryRunOnly: true;
  planOnly: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  noFileMutation: true;
  daemonStarted: false;
  notes: string[];
}

export const localOrchestratorHardLocks: LocalOrchestratorHardLocks = {
  dryRunOnly: true,
  planOnly: true,
  noDaemon: true,
  daemonStarted: false,
  noSpawnCodex: true,
  noSubprocess: true,
  noShellExecution: true,
  noProviderExecution: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
  noFileMutation: true,
  noCredentialRead: true,
  workerSelfReportCannotComplete: true,
  expectedOutputRequired: true,
  manifestRequired: true,
  qaGateRequired: true,
};

const statusOrder: LocalOrchestratorQueueStatus[] = [
  "waiting",
  "ready",
  "running_planned",
  "waiting_output",
  "qa_pending",
  "needs_review",
  "failed",
  "blocked",
  "complete_verified",
];

const matchedManifestStatuses = new Set(["actual_output_present", "complete", "matched"]);
const activeLocalStatuses = new Set<LocalTaskStatus>(["submitted", "connection_retrying", "generating"]);
const activeProviderStatuses = new Set<ProviderTaskStatus>(["querying", "queueing", "generating"]);

interface WorkRecord {
  key: string;
  aliases: Set<string>;
  queueOrder: number;
  priority: number;
  packet?: LocalOrchestratorTaskPacket;
  envelope?: TaskEnvelope;
  taskRun?: TaskRun;
  generationJob?: GenerationHarnessJob;
  watcherStreams: FilesystemWatcherHarnessStream[];
  resumeItem?: CheckpointResumeHarnessItem;
  qaItem?: QaHarnessItem;
  subagentSlot?: SubagentRunnerSlot;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
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

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function hasManifestMatch(status?: string): boolean {
  return Boolean(status && matchedManifestStatuses.has(status));
}

function isTerminal(status: LocalOrchestratorQueueStatus): boolean {
  return status === "complete_verified" || status === "blocked";
}

function isActive(status: LocalOrchestratorQueueStatus): boolean {
  return status === "running_planned" || status === "waiting_output" || status === "qa_pending";
}

function queueItemId(record: WorkRecord): string {
  return `local_orchestrator_item_${safeId(record.key)}`;
}

function latestIso(values: Array<string | undefined>): string | undefined {
  const timestamps = values.filter(Boolean).map((value) => new Date(value as string).getTime()).filter(Number.isFinite);
  if (!timestamps.length) return undefined;
  return new Date(Math.max(...timestamps)).toISOString();
}

function parseTaskPlanRef(ref: string): string | undefined {
  const match = ref.match(/(?:generationHarness\.taskPlan|taskPlan):([^:]+)$/);
  return match?.[1];
}

function aliasesFromPacket(packet: LocalOrchestratorTaskPacket): string[] {
  return uniqueInOrder([
    packet.taskPlanId || "",
    packet.jobId || "",
    packet.envelopeId || "",
    packet.runnerSlotId || "",
    packet.packetId,
  ]);
}

function aliasesFromSlot(slot: SubagentRunnerSlot): string[] {
  const taskPlanRefs = slot.sourceRefs.map(parseTaskPlanRef).filter((value): value is string => Boolean(value));
  return uniqueInOrder([
    slot.runnerSlotId,
    slot.envelopeId || "",
    slot.parentTaskId || "",
    slot.sourceId,
    ...taskPlanRefs,
  ]);
}

function makeRegistry() {
  const records: WorkRecord[] = [];
  const aliasToRecord = new Map<string, WorkRecord>();

  function upsert(aliases: string[], fallbackKey: string, order: number, priority = order): WorkRecord {
    const cleanAliases = uniqueInOrder(aliases);
    const existing = cleanAliases.map((alias) => aliasToRecord.get(alias)).find((record): record is WorkRecord => Boolean(record));
    const record =
      existing ||
      ({
        key: cleanAliases[0] || fallbackKey,
        aliases: new Set<string>(),
        queueOrder: order,
        priority,
        watcherStreams: [],
      } satisfies WorkRecord);

    if (!existing) records.push(record);
    record.queueOrder = Math.min(record.queueOrder, order);
    record.priority = Math.min(record.priority, priority);
    for (const alias of cleanAliases) {
      record.aliases.add(alias);
      aliasToRecord.set(alias, record);
    }
    return record;
  }

  return { records, upsert };
}

function expectedOutputsFor(record: WorkRecord): string[] {
  return uniqueInOrder([
    ...(record.packet?.expectedOutputs || []),
    ...(record.envelope?.expectedOutputs || []),
    ...(record.taskRun?.expectedOutputs || []),
    record.generationJob?.candidateOutput.expectedOutputPath || "",
    record.resumeItem?.expectedOutputPath || "",
  ]);
}

function dependenciesFor(record: WorkRecord): string[] {
  return uniqueInOrder([...(record.packet?.dependencies || []), ...(record.envelope?.dependencies || [])]);
}

function providerIdFor(record: WorkRecord): string | undefined {
  return record.envelope?.providerId || record.generationJob?.providerId || record.taskRun?.providerId;
}

function taskPlanIdFor(record: WorkRecord): string | undefined {
  return record.packet?.taskPlanId || record.generationJob?.taskPlanId || record.resumeItem?.taskPlanId || record.qaItem?.taskPlanId;
}

function jobIdFor(record: WorkRecord): string | undefined {
  return record.packet?.jobId || record.generationJob?.jobId || record.resumeItem?.jobId || record.qaItem?.jobId;
}

function shotIdFor(record: WorkRecord): string | undefined {
  return record.packet?.shotId || record.generationJob?.shotId || record.resumeItem?.shotId || record.qaItem?.shotId || record.subagentSlot?.shotId;
}

function envelopeIdFor(record: WorkRecord): string | undefined {
  return record.packet?.envelopeId || record.envelope?.id || record.subagentSlot?.envelopeId;
}

function hasExpectedWatcherOutput(record: WorkRecord): boolean {
  return record.watcherStreams.some((stream) => stream.artifactClass === "expected_output" || stream.artifactClass === "formal_output");
}

function hasWorkerSelfReport(record: WorkRecord): boolean {
  return (
    record.taskRun?.localStatus === "succeeded" ||
    record.taskRun?.providerStatus === "success" ||
    record.watcherStreams.some((stream) => stream.artifactClass === "worker_exit_without_expected_output")
  );
}

function buildCompletionGate(record: WorkRecord): LocalOrchestratorCompletionGate {
  const expectedOutputs = expectedOutputsFor(record);
  const taskRunActualExpected = Boolean(
    record.taskRun &&
      record.taskRun.actualOutputs.some((actualOutput) => expectedOutputs.includes(actualOutput)),
  );
  const expectedOutputObserved = Boolean(
    record.generationJob?.candidateOutput.outputExists ||
      record.resumeItem?.expectedOutputExists ||
      hasExpectedWatcherOutput(record) ||
      taskRunActualExpected,
  );
  const manifestMatched = Boolean(
    hasManifestMatch(record.generationJob?.candidateOutput.manifestStatus) ||
      hasManifestMatch(record.resumeItem?.manifestStatus) ||
      record.resumeItem?.skipAllowed,
  );
  const qaPass = Boolean(
    record.generationJob?.candidateOutput.qaStatus === "pass" ||
      record.resumeItem?.qaStatus === "pass" ||
      record.qaItem?.formalPromotionEligible,
  );
  const promotionGatePassed = Boolean(
    record.generationJob?.candidateOutput.canPromoteToFormal ||
      record.resumeItem?.canPromoteToFormal ||
      record.qaItem?.formalPromotionEligible,
  );
  const workerSelfReportPresent = hasWorkerSelfReport(record);
  const formalPromotionEligible = Boolean(record.qaItem?.formalPromotionEligible || record.resumeItem?.skipAllowed);
  const workerSelfReportOnly =
    workerSelfReportPresent && !(expectedOutputObserved && manifestMatched && qaPass && promotionGatePassed);
  const expectedOutputDeclared = expectedOutputs.length > 0;
  const completeVerified =
    expectedOutputDeclared && expectedOutputObserved && manifestMatched && qaPass && promotionGatePassed && !workerSelfReportOnly;

  return {
    expectedOutputDeclared,
    expectedOutputObserved,
    manifestMatched,
    qaPass,
    promotionGatePassed,
    formalPromotionEligible,
    workerSelfReportPresent,
    workerSelfReportOnly,
    completeVerified,
    blockers: uniqueSorted([
      ...(expectedOutputDeclared ? [] : ["Expected output contract is missing."]),
      ...(expectedOutputObserved ? [] : ["Expected output has not been observed yet."]),
      ...(manifestMatched ? [] : ["Manifest match is missing or incomplete."]),
      ...(qaPass ? [] : ["Explicit QA pass is missing."]),
      ...(promotionGatePassed ? [] : ["QA promotion gate has not passed."]),
      ...(workerSelfReportOnly ? ["Worker/provider self-report cannot complete a task without expected output, manifest match, and QA pass."] : []),
    ]),
  };
}

function upstreamGenerationBlockers(job?: GenerationHarnessJob): string[] {
  if (!job) return [];
  if (job.candidateOutput.status === "blocked") return job.blockers;

  const upstreamStages = new Set([
    "shot_spec",
    "visual_memory",
    "spatial_memory",
    "shot_layout",
    "style_capsule",
    "shot_prompt_plan",
    "provider_capability_check",
  ]);
  return job.stages.filter((stage) => upstreamStages.has(stage.stageId) && stage.status === "blocked").flatMap((stage) => stage.blockers);
}

function hardBlockersFor(record: WorkRecord, gate: LocalOrchestratorCompletionGate): string[] {
  return uniqueSorted([
    ...(record.packet?.blocked ? record.packet.blockers || ["Task packet is blocked."] : []),
    ...(record.envelope?.preflight.status === "blocked"
      ? record.envelope.preflight.blockers.map((blocker) => blocker.messageForUser)
      : []),
    ...(record.subagentSlot?.status === "blocked_missing_envelope" || record.subagentSlot?.status === "blocked_contract_violation"
      ? record.subagentSlot.blockedReasons
      : []),
    ...(record.resumeItem?.resumeStatus === "blocked" ? record.resumeItem.blockingReasons : []),
    ...upstreamGenerationBlockers(record.generationJob),
    ...(gate.expectedOutputDeclared ? [] : ["Expected output contract is required before a queue item can execute."]),
  ]);
}

function isFailed(record: WorkRecord): boolean {
  return (
    record.taskRun?.localStatus === "failed" ||
    record.taskRun?.providerStatus === "fail" ||
    record.resumeItem?.healthStatus === "failed" ||
    record.watcherStreams.some((stream) => stream.eventType === "blocked" && stream.artifactClass === "blocked")
  );
}

function isActiveRun(record: WorkRecord): boolean {
  return Boolean(
    record.taskRun &&
      (activeLocalStatuses.has(record.taskRun.localStatus) || activeProviderStatuses.has(record.taskRun.providerStatus)),
  );
}

function isQaPending(record: WorkRecord, gate: LocalOrchestratorCompletionGate): boolean {
  return Boolean(
    record.generationJob?.candidateOutput.status === "qa_pending" ||
      record.resumeItem?.qaStatus === "pending" ||
      record.resumeItem?.qaStatus === "missing" ||
      (gate.expectedOutputObserved && (!gate.qaPass || !gate.promotionGatePassed)),
  );
}

function hasOutputWait(record: WorkRecord, gate: LocalOrchestratorCompletionGate): boolean {
  return Boolean(
    gate.expectedOutputDeclared &&
      !gate.expectedOutputObserved &&
      (record.generationJob ||
        (record.taskRun &&
          !["pending_local", "ready_to_submit", "parked", "cancelled"].includes(record.taskRun.localStatus))),
  );
}

function hasReadyEvidence(record: WorkRecord): boolean {
  return Boolean(
    record.packet ||
      (record.envelope && record.envelope.preflight.status !== "blocked") ||
      record.subagentSlot?.status === "planned" ||
      record.generationJob?.providerRequestPreview ||
      record.resumeItem?.rerunAllowed,
  );
}

function buildCodexActivity(
  record: WorkRecord,
  gate: LocalOrchestratorCompletionGate,
  inputOptions: Required<Pick<BuildLocalOrchestratorOptions, "retryBudget" | "stallTimeoutSeconds" | "now">>,
): LocalOrchestratorCodexActivity {
  const retryCount = record.taskRun?.retryCount || 0;
  const retryBudget = inputOptions.retryBudget;
  const retriesRemaining = Math.max(0, retryBudget - retryCount);
  const stallTimeoutSeconds = record.taskRun?.stallTimeoutSeconds || inputOptions.stallTimeoutSeconds;
  const lastEventAt = latestIso([
    record.taskRun?.lastEventAt,
    ...record.watcherStreams.map((stream) => {
      const streamAt = stream.notes.find((note) => /^\d{4}-\d{2}-\d{2}T/.test(note));
      return streamAt;
    }),
  ]);
  const lastEventMs = lastEventAt ? new Date(lastEventAt).getTime() : undefined;
  const nowMs = new Date(inputOptions.now).getTime();
  const timeoutStalled = Boolean(lastEventMs && isActiveRun(record) && nowMs - lastEventMs > stallTimeoutSeconds * 1000);
  const watcherStalled = record.watcherStreams.some((stream) => stream.artifactClass === "stall_timeout" || stream.eventType === "stall_timeout_reached");
  const stalled = timeoutStalled || watcherStalled;
  const manualReviewRequired = stalled || gate.workerSelfReportOnly;

  let state: LocalOrchestratorCodexActivityState = "not_started";
  if (gate.completeVerified) {
    state = "verified";
  } else if (stalled && retriesRemaining === 0) {
    state = "manual_review_required";
  } else if (stalled) {
    state = "stalled";
  } else if (record.taskRun?.localStatus === "connection_retrying") {
    state = "reconnect_planned";
  } else if (isActiveRun(record)) {
    state = "running_planned";
  } else if (gate.expectedOutputDeclared && !gate.expectedOutputObserved && (record.taskRun || record.generationJob)) {
    state = "waiting_output";
  } else if (hasReadyEvidence(record)) {
    state = "ready_to_start";
  }

  return {
    state,
    codexSessionId: record.taskRun?.codexSessionId,
    retryCount,
    retryBudget,
    retriesRemaining,
    stallTimeoutSeconds,
    lastEventAt,
    backoffUntil: record.taskRun?.backoffUntil,
    stalled,
    stallDetectedBy: uniqueInOrder([
      timeoutStalled ? "timeout" : "",
      watcherStalled ? "watcher_event" : "",
    ]) as Array<"timeout" | "watcher_event">,
    manualReviewRequired,
    notes: uniqueSorted([
      "Codex activity is represented as a plan/fact chain only; the orchestrator does not spawn Codex.",
      ...(record.taskRun?.localStatus === "connection_retrying" ? ["Reconnect is planned from taskRun.connection_retrying."] : []),
      ...(stalled ? [`Stall timeout is ${stallTimeoutSeconds}s with ${retriesRemaining} retry slot(s) remaining.`] : []),
      ...(gate.workerSelfReportOnly ? ["Worker self-report is evidence for review, not completion."] : []),
    ]),
  };
}

function rawStatusFor(
  record: WorkRecord,
  gate: LocalOrchestratorCompletionGate,
  codexActivity: LocalOrchestratorCodexActivity,
  hardBlockers: string[],
): LocalOrchestratorQueueStatus {
  if (gate.completeVerified) return "complete_verified";
  if (hardBlockers.length) return "blocked";
  if (isFailed(record)) return "failed";
  if (codexActivity.manualReviewRequired || record.resumeItem?.manualReviewRequired || gate.workerSelfReportOnly) return "needs_review";
  if (isQaPending(record, gate)) return "qa_pending";
  if (isActiveRun(record) || record.subagentSlot?.status === "planned") return "running_planned";
  if (hasOutputWait(record, gate)) return "waiting_output";
  if (hasReadyEvidence(record)) return "ready";
  return "waiting";
}

function factChainFor(record: WorkRecord, gate: LocalOrchestratorCompletionGate): LocalOrchestratorFactChainEntry[] {
  const entries: LocalOrchestratorFactChainEntry[] = [];
  const push = (entry: LocalOrchestratorFactChainEntry) => entries.push(entry);

  if (record.packet) {
    push({
      factId: `task_packet_${safeId(record.packet.packetId)}`,
      layer: "task_packet",
      sourceRef: record.packet.packetId,
      status: record.packet.blocked ? "blocked" : "planned",
      detail: "Task packet contributes queue identity, expected outputs, dependencies, and ordering.",
    });
  }

  if (record.envelope) {
    push({
      factId: `task_envelope_${safeId(record.envelope.id)}`,
      layer: "task_envelope",
      sourceRef: record.envelope.id,
      status: record.envelope.preflight.status,
      detail: "Task envelope preflight and expected output contract are visible to the orchestrator.",
      at: record.envelope.preflight.checkedAt,
    });
  }

  if (record.taskRun) {
    push({
      factId: `task_run_${safeId(record.taskRun.taskId)}`,
      layer: "task_run",
      sourceRef: record.taskRun.taskId,
      status: `${record.taskRun.localStatus}/${record.taskRun.providerStatus}`,
      detail: "TaskRun provides reconnect, retry, provider queue, and last-event facts; it is not a completion gate by itself.",
      at: record.taskRun.lastEventAt,
    });
  }

  if (record.generationJob) {
    push({
      factId: record.generationJob.harnessJobId,
      layer: "generation_harness",
      sourceRef: record.generationJob.harnessJobId,
      status: record.generationJob.candidateOutput.status,
      detail: `Generation harness says expected output observed=${gate.expectedOutputObserved}, manifest=${record.generationJob.candidateOutput.manifestStatus}, qa=${record.generationJob.candidateOutput.qaStatus}.`,
    });
  }

  for (const stream of record.watcherStreams) {
    push({
      factId: stream.streamId,
      layer: "filesystem_watcher_harness",
      sourceRef: stream.sourceEventId,
      status: stream.artifactClass,
      detail: "Watcher stream is a static fact; it cannot promote formal output or complete the task.",
    });
  }

  if (record.resumeItem) {
    push({
      factId: record.resumeItem.resumeItemId,
      layer: "checkpoint_resume_harness",
      sourceRef: record.resumeItem.resumeItemId,
      status: record.resumeItem.resumeStatus,
      detail: "Checkpoint resume contributes skip/rerun/manual-review planning without file mutation.",
    });
  }

  if (record.qaItem) {
    push({
      factId: record.qaItem.qaItemId,
      layer: "qa_harness",
      sourceRef: record.qaItem.qaItemId,
      status: record.qaItem.formalPromotionEligible ? "formal_promotion_eligible" : "formal_promotion_blocked",
      detail: "QA harness contributes explicit QA and human-review eligibility facts.",
    });
  }

  if (record.subagentSlot) {
    push({
      factId: record.subagentSlot.runnerSlotId,
      layer: "subagent_runner",
      sourceRef: record.subagentSlot.sourceId,
      status: record.subagentSlot.status,
      detail: "Subagent runner slot is packet coverage only; the local orchestrator does not spawn an agent.",
    });
  }

  push({
    factId: `completion_gate_${safeId(record.key)}`,
    layer: "local_orchestrator",
    sourceRef: record.key,
    status: gate.completeVerified ? "complete_verified" : "incomplete",
    detail: "Completion requires declared expected output, observed output, manifest match, QA pass, and promotion gate.",
  });

  return entries;
}

function nextActionFor(status: LocalOrchestratorQueueStatus, item: Pick<LocalOrchestratorQueueItem, "codexActivity" | "completionGate">): string {
  if (status === "complete_verified") return "Task is verified complete; auto-continue may mark the next queue item ready.";
  if (status === "blocked") return "Resolve blockers or let auto-continue skip to the next planned item.";
  if (status === "failed") return "Review failure facts and decide whether to create a rerun plan.";
  if (status === "needs_review") return "Manual review is required before this item can be considered complete or retried.";
  if (status === "qa_pending") return "Wait for explicit QA and promotion gate facts; worker self-report cannot satisfy this.";
  if (status === "waiting_output") return "Wait for expected output and manifest facts; no daemon or provider submit is started.";
  if (status === "running_planned") return "Show the Codex activity fact chain while execution remains external to this harness.";
  if (status === "ready") return "Ready for the next planned worker packet; this harness does not execute it.";
  if (item.codexActivity.state === "reconnect_planned") return "Reconnect is represented as a plan with retry budget; no subprocess is started.";
  return "Waiting for previous queue item or missing packet facts.";
}

function warningsFor(record: WorkRecord, gate: LocalOrchestratorCompletionGate, codexActivity: LocalOrchestratorCodexActivity): string[] {
  return uniqueSorted([
    ...(record.packet?.warnings || []),
    ...(record.envelope?.preflight.warnings.map((warning) => warning.messageForUser) || []),
    ...(record.generationJob?.warnings || []),
    ...(record.resumeItem?.blockingReasons || []).filter((reason) => !record.resumeItem?.skipAllowed),
    ...(record.qaItem?.formalPromotionBlockedReasons || []),
    ...(record.subagentSlot?.warnings || []),
    ...(record.subagentSlot && record.subagentSlot.envelopeStatus !== "validated"
      ? [`Subagent coverage gap for ${record.subagentSlot.taskKind}: ${record.subagentSlot.envelopeStatus}.`]
      : []),
    ...(record.subagentSlot?.requirementChecks.filter((check) => !check.present).map((check) => `Subagent packet requirement missing: ${check.requirementId}.`) || []),
    ...codexActivity.notes,
    ...gate.blockers.filter((blocker) => blocker !== "Expected output has not been observed yet."),
  ]);
}

function createQueueItem(
  record: WorkRecord,
  rawQueueStatus: LocalOrchestratorQueueStatus,
  gate: LocalOrchestratorCompletionGate,
  codexActivity: LocalOrchestratorCodexActivity,
  hardBlockers: string[],
): LocalOrchestratorQueueItem {
  const placeholder: LocalOrchestratorQueueItem = {
    queueItemId: queueItemId(record),
    queueOrder: record.queueOrder,
    queueStatus: rawQueueStatus,
    rawQueueStatus,
    taskPlanId: taskPlanIdFor(record),
    jobId: jobIdFor(record),
    shotId: shotIdFor(record),
    packetId: record.packet?.packetId,
    envelopeId: envelopeIdFor(record),
    runnerSlotId: record.subagentSlot?.runnerSlotId || record.packet?.runnerSlotId,
    providerId: providerIdFor(record),
    expectedOutputs: expectedOutputsFor(record),
    dependencies: dependenciesFor(record),
    canExecute: false,
    canSpawnCodex: false,
    dryRunOnly: true,
    planOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    noFileMutation: true,
    completionGate: gate,
    codexActivity,
    autoContinue: {
      eligibleAsNext: false,
      reason: "Auto-continue planning is evaluated after the full queue is sorted.",
    },
    factChain: factChainFor(record, gate),
    blockers: hardBlockers,
    warnings: [],
    nextAction: "",
    notes: [
      "Local Orchestrator is dry-run and plan-only.",
      "It does not start a daemon, spawn Codex, execute shell commands, submit providers, or mutate files.",
    ],
  };
  placeholder.warnings = warningsFor(record, gate, codexActivity);
  placeholder.nextAction = nextActionFor(rawQueueStatus, placeholder);
  return placeholder;
}

function applyAutoContinuePlan(
  queue: LocalOrchestratorQueueItem[],
  options: Required<Pick<BuildLocalOrchestratorOptions, "autoContinue" | "concurrency">>,
): LocalOrchestratorAutoContinuePlan {
  const transitions: LocalOrchestratorAutoContinueTransition[] = [];
  const terminalQueueItemIds = queue.filter((item) => isTerminal(item.queueStatus)).map((item) => item.queueItemId);
  const currentQueueItemIds: string[] = [];
  const nextReadyQueueItemIds: string[] = [];
  const waitingQueueItemIds: string[] = [];
  let openSlots = options.concurrency;
  let lastTerminalId: string | undefined;
  let heldByNonTerminalId: string | undefined;

  if (!options.autoContinue) {
    for (const item of queue) {
      item.autoContinue = {
        eligibleAsNext: false,
        reason: "Auto-continue planning is disabled.",
      };
    }
    return {
      enabled: false,
      mode: "plan_only",
      concurrency: options.concurrency,
      terminalQueueItemIds,
      currentQueueItemIds,
      nextReadyQueueItemIds,
      waitingQueueItemIds: queue.filter((item) => item.queueStatus === "waiting").map((item) => item.queueItemId),
      transitions,
      notes: ["Auto-continue is disabled; no queue state is executed or mutated."],
    };
  }

  for (const item of queue) {
    if (isTerminal(item.rawQueueStatus)) {
      item.queueStatus = item.rawQueueStatus;
      item.autoContinue = {
        eligibleAsNext: false,
        reason: "Terminal queue item; auto-continue may plan a later item after it.",
      };
      lastTerminalId = item.queueItemId;
      continue;
    }

    if (heldByNonTerminalId) {
      item.queueStatus = item.rawQueueStatus === "ready" ? "waiting" : item.rawQueueStatus;
      item.autoContinue = {
        eligibleAsNext: false,
        waitingForTaskId: heldByNonTerminalId,
        reason: `Waiting for ${heldByNonTerminalId} before becoming ready in the plan.`,
      };
      waitingQueueItemIds.push(item.queueItemId);
      item.nextAction = nextActionFor(item.queueStatus, item);
      continue;
    }

    if (item.rawQueueStatus === "ready" && openSlots > 0) {
      item.queueStatus = "ready";
      item.autoContinue = {
        eligibleAsNext: true,
        plannedAfterTaskId: lastTerminalId,
        reason: lastTerminalId
          ? `Previous terminal item ${lastTerminalId} is verified or blocked; this item is next-ready in plan.`
          : "First non-terminal item is next-ready in plan.",
      };
      if (lastTerminalId) {
        transitions.push({
          afterQueueItemId: lastTerminalId,
          plannedReadyQueueItemId: item.queueItemId,
          reason: "Auto-continue only changes the plan state; it does not execute the task.",
        });
      }
      nextReadyQueueItemIds.push(item.queueItemId);
      currentQueueItemIds.push(item.queueItemId);
      openSlots -= 1;
      heldByNonTerminalId = item.queueItemId;
      item.nextAction = nextActionFor(item.queueStatus, item);
      continue;
    }

    if (isActive(item.rawQueueStatus) || item.rawQueueStatus === "needs_review" || item.rawQueueStatus === "failed") {
      item.queueStatus = item.rawQueueStatus;
      item.autoContinue = {
        eligibleAsNext: false,
        plannedAfterTaskId: lastTerminalId,
        reason: "This item holds the current queue position until it is verified, blocked, or reviewed.",
      };
      currentQueueItemIds.push(item.queueItemId);
      heldByNonTerminalId = item.queueItemId;
      item.nextAction = nextActionFor(item.queueStatus, item);
      continue;
    }

    item.queueStatus = "waiting";
    item.autoContinue = {
      eligibleAsNext: false,
      waitingForTaskId: heldByNonTerminalId,
      reason: "Waiting for earlier queue facts before it can become ready.",
    };
    waitingQueueItemIds.push(item.queueItemId);
    item.nextAction = nextActionFor(item.queueStatus, item);
  }

  return {
    enabled: true,
    mode: "plan_only",
    concurrency: options.concurrency,
    terminalQueueItemIds,
    currentQueueItemIds,
    nextReadyQueueItemIds,
    waitingQueueItemIds,
    transitions,
    notes: [
      "Auto-continue only marks which item would be next-ready after verified/blocked terminal states.",
      "The Local Orchestrator does not launch workers, submit providers, or mutate queue files.",
    ],
  };
}

function sourceCoverage(queue: LocalOrchestratorQueueItem[]): LocalOrchestratorState["sourceCoverage"] {
  const layers: LocalOrchestratorFactLayer[] = [
    "task_packet",
    "task_envelope",
    "task_run",
    "generation_harness",
    "filesystem_watcher_harness",
    "checkpoint_resume_harness",
    "qa_harness",
    "subagent_runner",
    "local_orchestrator",
  ];
  return layers.map((layer) => {
    const sourceRefs = uniqueSorted(queue.flatMap((item) => item.factChain.filter((entry) => entry.layer === layer).map((entry) => entry.sourceRef)));
    return {
      layer,
      referenced: sourceRefs.length > 0,
      referenceCount: sourceRefs.length,
      sourceRefs,
    };
  });
}

function subagentCoverageNotes(input: BuildLocalOrchestratorInput): string[] {
  return uniqueSorted(
    (input.subagentRunner?.coverage || []).flatMap((entry) => [
      entry.totalSlots === 0 ? `Subagent coverage gap: no ${entry.taskKind} slot is visible to the orchestrator.` : "",
      entry.totalSlots > 0 && entry.planned === 0 ? `Subagent coverage gap: ${entry.taskKind} has no validated planned envelope.` : "",
      ...entry.notes.filter((note) => note.startsWith("Coverage gap")),
    ]),
  );
}

function buildRecords(input: BuildLocalOrchestratorInput): WorkRecord[] {
  const registry = makeRegistry();
  let order = 0;

  for (const packet of input.taskPackets || []) {
    const record = registry.upsert(aliasesFromPacket(packet), packet.packetId, packet.queueOrder ?? order, packet.priority ?? packet.queueOrder ?? order);
    record.packet = packet;
    order += 1;
  }

  for (const envelope of input.taskEnvelopes || []) {
    const record = registry.upsert([envelope.id], envelope.id, order);
    record.envelope = envelope;
    order += 1;
  }

  for (const taskRun of input.taskRuns || []) {
    const record = registry.upsert([taskRun.taskId], taskRun.taskId, order);
    record.taskRun = taskRun;
    order += 1;
  }

  for (const job of input.generationHarness?.jobs || []) {
    const record = registry.upsert([job.taskPlanId, job.jobId, job.harnessJobId], job.harnessJobId, order);
    record.generationJob = job;
    order += 1;
  }

  for (const stream of input.filesystemWatcherHarness?.streams || []) {
    const record = registry.upsert([stream.taskPlanId, stream.jobId || "", stream.generationHarnessJobId || ""], stream.streamId, order);
    record.watcherStreams.push(stream);
    order += 1;
  }

  for (const resumeItem of input.checkpointResumeHarness?.items || []) {
    const record = registry.upsert([resumeItem.taskPlanId, resumeItem.jobId, resumeItem.resumeItemId, resumeItem.harnessJobId || ""], resumeItem.resumeItemId, order);
    record.resumeItem = resumeItem;
    order += 1;
  }

  for (const qaItem of input.qaHarness?.items || []) {
    const record = registry.upsert(
      [qaItem.taskPlanId || "", qaItem.jobId || "", qaItem.harnessJobId || "", qaItem.qaItemId],
      qaItem.qaItemId,
      order,
    );
    record.qaItem = qaItem;
    order += 1;
  }

  for (const slot of input.subagentRunner?.slots || []) {
    const record = registry.upsert(aliasesFromSlot(slot), slot.runnerSlotId, order);
    record.subagentSlot = slot;
    order += 1;
  }

  return registry.records.sort(
    (left, right) => left.priority - right.priority || left.queueOrder - right.queueOrder || left.key.localeCompare(right.key),
  );
}

export function buildLocalOrchestratorState(input: BuildLocalOrchestratorInput): LocalOrchestratorState {
  const options = {
    autoContinue: input.options?.autoContinue ?? true,
    concurrency: Math.max(1, input.options?.concurrency ?? 1),
    retryBudget: Math.max(0, input.options?.retryBudget ?? 3),
    stallTimeoutSeconds: Math.max(1, input.options?.stallTimeoutSeconds ?? 600),
    now: input.options?.now || input.generatedAt,
  };
  const queue = buildRecords(input).map((record): LocalOrchestratorQueueItem => {
    const gate = buildCompletionGate(record);
    const codexActivity = buildCodexActivity(record, gate, options);
    const hardBlockers = hardBlockersFor(record, gate);
    const rawStatus = rawStatusFor(record, gate, codexActivity, hardBlockers);
    return createQueueItem(record, rawStatus, gate, codexActivity, hardBlockers);
  });
  const autoContinuePlan = applyAutoContinuePlan(queue, options);
  const count = (status: LocalOrchestratorQueueStatus) => queue.filter((item) => item.queueStatus === status).length;

  return {
    schemaVersion: localOrchestratorSchemaVersion,
    generatedAt: input.generatedAt,
    queue,
    autoContinuePlan,
    summary: {
      totalItems: queue.length,
      waiting: count("waiting"),
      ready: count("ready"),
      runningPlanned: count("running_planned"),
      waitingOutput: count("waiting_output"),
      qaPending: count("qa_pending"),
      needsReview: count("needs_review"),
      failed: count("failed"),
      blocked: count("blocked"),
      completeVerified: count("complete_verified"),
      manualReviewRequired: queue.filter((item) => item.codexActivity.manualReviewRequired).length,
      stalled: queue.filter((item) => item.codexActivity.stalled).length,
      workerSelfReportOnly: queue.filter((item) => item.completionGate.workerSelfReportOnly).length,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      noFileMutation: true,
      daemonStarted: false,
    },
    hardLocks: localOrchestratorHardLocks,
    sourceCoverage: sourceCoverage(queue),
    dryRunOnly: true,
    planOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    noFileMutation: true,
    daemonStarted: false,
    notes: [
      "Phase 10 Local Orchestrator is a dry-run/plan-only queue state machine.",
      "It can show the fact chain that makes a task look active, stalled, QA-pending, blocked, or verified.",
      ...subagentCoverageNotes(input),
      "It never starts daemons, spawns Codex, executes shell commands, submits providers, reads credentials, or mutates files.",
      `Queue statuses are fixed to ${statusOrder.join(", ")}.`,
    ],
  };
}
