export type ProviderRetryFailureKind =
  | "timeout"
  | "rate_limit"
  | "server_error"
  | "network_error"
  | "provider_missing"
  | "auth"
  | "validation_error"
  | "content_policy"
  | "qa_failed"
  | "cancelled";

export type ProviderRetryAttemptStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed_retryable"
  | "missing_retryable"
  | "failed_terminal"
  | "superseded";

export interface ProviderRetryPolicy {
  maxConcurrency: number;
  retryConcurrency?: number;
  maxAutoRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio?: number;
  retryableFailureKinds: ProviderRetryFailureKind[];
  terminalFailureKinds: ProviderRetryFailureKind[];
}

export interface ProviderRetryTask {
  taskId: string;
  shotId: string;
  inputHash: string;
  permissionReceiptId: string;
  expectedOutputPath: string;
  priority?: number;
}

export interface ProviderRetryAttempt {
  attemptId: string;
  taskId: string;
  shotId: string;
  inputHash: string;
  permissionReceiptId: string;
  expectedOutputPath: string;
  attemptNumber: number;
  status: ProviderRetryAttemptStatus;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  nextRetryAt?: string;
  failureKind?: ProviderRetryFailureKind;
  failureMessage?: string;
  retryReason?: string;
  providerRequestId?: string;
  outputPath?: string;
  outputSha256?: string;
  supersededByAttemptId?: string;
}

export interface ProviderRetrySummary {
  totalTasks: number;
  queued: number;
  running: number;
  succeeded: number;
  terminalFailed: number;
  retryScheduled: number;
  attemptsTotal: number;
  maxObservedConcurrency: number;
  providerCalled: boolean;
  promotionAllowed: false;
  lastUpdatedAt: string;
}

export interface ProviderRetrySchedulerState {
  schemaVersion: "provider_retry_scheduler_state_v1";
  generatedAt: string;
  policy: ProviderRetryPolicy;
  tasks: ProviderRetryTask[];
  attempts: ProviderRetryAttempt[];
  summary: ProviderRetrySummary;
}

export type ProviderRetryResult =
  | {
      status: "success";
      providerRequestId: string;
      outputPath: string;
      outputSha256: string;
    }
  | {
      status: "failure";
      failureKind: ProviderRetryFailureKind;
      message?: string;
    }
  | {
      status: "missing";
      failureKind?: "provider_missing";
      message?: string;
    };

export interface ProviderLateReturnCandidate {
  taskId: string;
  shotId: string;
  attemptId: string;
  inputHash?: string;
  permissionReceiptId?: string;
  expectedOutputPath?: string;
  status: "late_candidate_needs_review" | "unknown_attempt";
  outputPath?: string;
  outputSha256?: string;
  promotionAllowed: false;
}

export interface ProviderRetryAttemptReceiptCandidate {
  attemptId: string;
  taskId: string;
  shotId: string;
  inputHash: string;
  permissionReceiptId: string;
  expectedOutputPath: string;
  attemptNumber: number;
  status: ProviderRetryAttemptStatus;
  scheduledAt: string;
  providerRequestId?: string;
  outputPath?: string;
  outputSha256?: string;
  failureKind?: ProviderRetryFailureKind;
  retryReason?: string;
  promotionAllowed: false;
}

export interface RunMockProviderRetrySchedulerOptions {
  state: ProviderRetrySchedulerState;
  provider: (attempt: ProviderRetryAttempt, task: ProviderRetryTask) => ProviderRetryResult;
  startAt?: string;
  maxTicks?: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function addMs(iso: string, delayMs: number): string {
  return new Date(new Date(iso).getTime() + delayMs).toISOString();
}

function attemptIdFor(taskId: string, attemptNumber: number): string {
  return `provider_retry:${taskId}:${attemptNumber}`;
}

function normalizePolicy(policy: ProviderRetryPolicy): ProviderRetryPolicy {
  return {
    ...policy,
    maxConcurrency: Math.max(0, Math.floor(policy.maxConcurrency)),
    retryConcurrency:
      policy.retryConcurrency === undefined
        ? Math.max(0, Math.floor(policy.maxConcurrency))
        : Math.max(0, Math.floor(policy.retryConcurrency)),
    maxAutoRetries: Math.max(0, Math.floor(policy.maxAutoRetries)),
    baseDelayMs: Math.max(0, Math.floor(policy.baseDelayMs)),
    maxDelayMs: Math.max(0, Math.floor(policy.maxDelayMs)),
    jitterRatio: policy.jitterRatio ? Math.max(0, policy.jitterRatio) : 0,
  };
}

function createAttempt(task: ProviderRetryTask, attemptNumber: number, scheduledAt: string): ProviderRetryAttempt {
  return {
    attemptId: attemptIdFor(task.taskId, attemptNumber),
    taskId: task.taskId,
    shotId: task.shotId,
    inputHash: task.inputHash,
    permissionReceiptId: task.permissionReceiptId,
    expectedOutputPath: task.expectedOutputPath,
    attemptNumber,
    status: "queued",
    scheduledAt,
  };
}

function createAttemptAfter(previousAttempt: ProviderRetryAttempt, scheduledAt: string): ProviderRetryAttempt {
  return {
    attemptId: attemptIdFor(previousAttempt.taskId, previousAttempt.attemptNumber + 1),
    taskId: previousAttempt.taskId,
    shotId: previousAttempt.shotId,
    inputHash: previousAttempt.inputHash,
    permissionReceiptId: previousAttempt.permissionReceiptId,
    expectedOutputPath: previousAttempt.expectedOutputPath,
    attemptNumber: previousAttempt.attemptNumber + 1,
    status: "queued",
    scheduledAt,
  };
}

function isTaskAlreadyClosed(attempts: ProviderRetryAttempt[], taskId: string): boolean {
  return attempts.some(
    (attempt) =>
      attempt.taskId === taskId &&
      (attempt.status === "succeeded" || attempt.status === "failed_terminal"),
  );
}

function isTaskRunning(attempts: ProviderRetryAttempt[], taskId: string): boolean {
  return attempts.some((attempt) => attempt.taskId === taskId && attempt.status === "running");
}

function isDue(attempt: ProviderRetryAttempt, now: string): boolean {
  return new Date(attempt.scheduledAt).getTime() <= new Date(now).getTime();
}

function taskRank(task: ProviderRetryTask): number {
  return task.priority ?? 0;
}

function calculateBackoffMs(policy: ProviderRetryPolicy, attemptNumber: number): number {
  const exponentialDelay = policy.baseDelayMs * 2 ** Math.max(0, attemptNumber - 1);
  return Math.min(policy.maxDelayMs, exponentialDelay);
}

function buildSummary(
  state: Omit<ProviderRetrySchedulerState, "summary"> & { summary?: ProviderRetrySummary },
  lastUpdatedAt: string,
): ProviderRetrySummary {
  const succeededTaskIds = new Set(
    state.attempts.filter((attempt) => attempt.status === "succeeded").map((attempt) => attempt.taskId),
  );
  const terminalFailedTaskIds = new Set(
    state.attempts
      .filter((attempt) => attempt.status === "failed_terminal" && !succeededTaskIds.has(attempt.taskId))
      .map((attempt) => attempt.taskId),
  );
  const running = state.attempts.filter((attempt) => attempt.status === "running").length;
  const queued = state.attempts.filter((attempt) => attempt.status === "queued").length;
  const retryScheduled = state.attempts.filter(
    (attempt) => attempt.status === "queued" && attempt.attemptNumber > 1,
  ).length;

  return {
    totalTasks: state.tasks.length,
    queued,
    running,
    succeeded: succeededTaskIds.size,
    terminalFailed: terminalFailedTaskIds.size,
    retryScheduled,
    attemptsTotal: state.attempts.length,
    maxObservedConcurrency: Math.max(state.summary?.maxObservedConcurrency ?? 0, running),
    providerCalled: state.summary?.providerCalled ?? false,
    promotionAllowed: false,
    lastUpdatedAt,
  };
}

function withSummary(state: ProviderRetrySchedulerState, lastUpdatedAt: string): ProviderRetrySchedulerState {
  return {
    ...state,
    summary: buildSummary(state, lastUpdatedAt),
  };
}

export function createProviderRetrySchedulerState(options: {
  tasks: ProviderRetryTask[];
  policy: ProviderRetryPolicy;
  generatedAt?: string;
}): ProviderRetrySchedulerState {
  const generatedAt = options.generatedAt || nowIso();
  const policy = normalizePolicy(options.policy);
  const tasks = [...options.tasks].sort((left, right) => taskRank(right) - taskRank(left));
  const state: ProviderRetrySchedulerState = {
    schemaVersion: "provider_retry_scheduler_state_v1",
    generatedAt,
    policy,
    tasks,
    attempts: tasks.map((task) => createAttempt(task, 1, generatedAt)),
    summary: {
      totalTasks: tasks.length,
      queued: tasks.length,
      running: 0,
      succeeded: 0,
      terminalFailed: 0,
      retryScheduled: 0,
      attemptsTotal: tasks.length,
      maxObservedConcurrency: 0,
      providerCalled: false,
      promotionAllowed: false,
      lastUpdatedAt: generatedAt,
    },
  };
  return withSummary(state, generatedAt);
}

export function isRetryableFailure(kind: ProviderRetryFailureKind, policy: ProviderRetryPolicy): boolean {
  if (policy.terminalFailureKinds.includes(kind)) return false;
  return policy.retryableFailureKinds.includes(kind);
}

export function queueNextProviderRetryBatch(
  state: ProviderRetrySchedulerState,
  now = nowIso(),
): ProviderRetryAttempt[] {
  if (state.policy.maxConcurrency <= 0) return [];
  const running = state.attempts.filter((attempt) => attempt.status === "running").length;
  const retryConcurrency = state.policy.retryConcurrency ?? state.policy.maxConcurrency;
  const runningRetry = state.attempts.filter((attempt) => attempt.status === "running" && attempt.attemptNumber > 1).length;
  const openSlots = Math.max(0, state.policy.maxConcurrency - running);
  if (openSlots === 0) return [];

  const eligible = state.attempts.filter((attempt) => {
    if (attempt.status !== "queued") return false;
    if (!isDue(attempt, now)) return false;
    if (isTaskAlreadyClosed(state.attempts, attempt.taskId)) return false;
    if (isTaskRunning(state.attempts, attempt.taskId)) return false;
    return true;
  });

  const selected: ProviderRetryAttempt[] = [];
  let selectedRetry = 0;
  for (const attempt of eligible) {
    if (selected.length >= openSlots) break;
    if (attempt.attemptNumber > 1 && runningRetry + selectedRetry >= retryConcurrency) continue;
    selected.push(attempt);
    if (attempt.attemptNumber > 1) selectedRetry += 1;
  }
  return selected;
}

export function markProviderRetryAttemptsRunning(
  state: ProviderRetrySchedulerState,
  attemptIds: string[],
  startedAt = nowIso(),
): ProviderRetrySchedulerState {
  const attemptIdSet = new Set(attemptIds);
  const attempts = state.attempts.map((attempt) => {
    if (!attemptIdSet.has(attempt.attemptId)) return attempt;
    if (attempt.status !== "queued") return attempt;
    return {
      ...attempt,
      status: "running" as const,
      startedAt,
    };
  });
  return withSummary({ ...state, attempts, summary: { ...state.summary, providerCalled: true } }, startedAt);
}

export function appendProviderRetryAttemptResult(
  state: ProviderRetrySchedulerState,
  attemptId: string,
  result: ProviderRetryResult,
  completedAt = nowIso(),
): ProviderRetrySchedulerState {
  const attempt = state.attempts.find((item) => item.attemptId === attemptId);
  if (!attempt) return withSummary(state, completedAt);

  let nextAttempt: ProviderRetryAttempt | undefined;
  const attempts = state.attempts.map((item) => {
    if (item.attemptId !== attemptId) return item;

    if (result.status === "success") {
      return {
        ...item,
        status: "succeeded" as const,
        completedAt,
        providerRequestId: result.providerRequestId,
        outputPath: result.outputPath,
        outputSha256: result.outputSha256,
      };
    }

    const failureKind = result.status === "missing" ? "provider_missing" : result.failureKind;
    const retryable = isRetryableFailure(failureKind, state.policy);
    const hasRetryBudget = item.attemptNumber <= state.policy.maxAutoRetries;
    if (retryable && hasRetryBudget) {
      const nextRetryAt = addMs(completedAt, calculateBackoffMs(state.policy, item.attemptNumber));
      nextAttempt = createAttemptAfter(item, nextRetryAt);
      return {
        ...item,
        status: result.status === "missing" ? ("missing_retryable" as const) : ("failed_retryable" as const),
        completedAt,
        nextRetryAt,
        failureKind,
        failureMessage: result.message,
        retryReason: `${failureKind} retry ${item.attemptNumber} of ${state.policy.maxAutoRetries}`,
        supersededByAttemptId: nextAttempt.attemptId,
      };
    }

    return {
      ...item,
      status: "failed_terminal" as const,
      completedAt,
      failureKind,
      failureMessage: result.message,
    };
  });

  if (nextAttempt) attempts.push(nextAttempt);
  return withSummary({ ...state, attempts }, completedAt);
}

export function ingestLateProviderReturn(
  state: ProviderRetrySchedulerState,
  lateReturn: {
    attemptId: string;
    outputPath: string;
    outputSha256: string;
  },
): ProviderLateReturnCandidate {
  const attempt = state.attempts.find((item) => item.attemptId === lateReturn.attemptId);
  if (!attempt) {
    return {
      taskId: "unknown",
      shotId: "unknown",
      attemptId: lateReturn.attemptId,
      status: "unknown_attempt",
      promotionAllowed: false,
    };
  }

  return {
    taskId: attempt.taskId,
    shotId: attempt.shotId,
    attemptId: lateReturn.attemptId,
    inputHash: attempt.inputHash,
    permissionReceiptId: attempt.permissionReceiptId,
    expectedOutputPath: attempt.expectedOutputPath,
    status: "late_candidate_needs_review",
    outputPath: lateReturn.outputPath,
    outputSha256: lateReturn.outputSha256,
    promotionAllowed: false,
  };
}

export function providerRetryAttemptReceiptCandidates(
  state: ProviderRetrySchedulerState,
): ProviderRetryAttemptReceiptCandidate[] {
  return state.attempts.map((attempt) => ({
    attemptId: attempt.attemptId,
    taskId: attempt.taskId,
    shotId: attempt.shotId,
    inputHash: attempt.inputHash,
    permissionReceiptId: attempt.permissionReceiptId,
    expectedOutputPath: attempt.expectedOutputPath,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    scheduledAt: attempt.scheduledAt,
    providerRequestId: attempt.providerRequestId,
    outputPath: attempt.outputPath,
    outputSha256: attempt.outputSha256,
    failureKind: attempt.failureKind,
    retryReason: attempt.retryReason,
    promotionAllowed: false,
  }));
}

export function runMockProviderRetryScheduler(
  options: RunMockProviderRetrySchedulerOptions,
): ProviderRetrySchedulerState {
  let state = options.state;
  let nowMs = new Date(options.startAt || state.generatedAt).getTime();
  const maxTicks = options.maxTicks ?? Math.max(100, state.tasks.length * (state.policy.maxAutoRetries + 2));

  for (let tick = 0; tick < maxTicks; tick += 1) {
    const now = new Date(nowMs).toISOString();
    const batch = queueNextProviderRetryBatch(state, now);

    if (batch.length === 0) {
      const queuedTimes = state.attempts
        .filter((attempt) => attempt.status === "queued")
        .map((attempt) => new Date(attempt.scheduledAt).getTime());
      if (queuedTimes.length === 0) return withSummary(state, now);
      nowMs = Math.max(nowMs + 1, Math.min(...queuedTimes));
      continue;
    }

    state = markProviderRetryAttemptsRunning(
      state,
      batch.map((attempt) => attempt.attemptId),
      now,
    );

    for (const attempt of batch) {
      const liveAttempt = state.attempts.find((item) => item.attemptId === attempt.attemptId) || attempt;
      const task = state.tasks.find((item) => item.taskId === liveAttempt.taskId);
      if (!task) continue;
      const result = options.provider(liveAttempt, task);
      state = appendProviderRetryAttemptResult(state, liveAttempt.attemptId, result, new Date(nowMs + 1).toISOString());
    }

    nowMs += 1;
  }

  throw new Error(`Provider retry scheduler did not settle after ${maxTicks} ticks.`);
}
