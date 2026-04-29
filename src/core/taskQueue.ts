import { getProviderRule } from "./providerPolicy";
import type {
  LocalTaskStatus,
  ProviderTaskStatus,
  TaskEnvelope,
  TaskRun,
} from "./types";

export type QueueGateStatus = "ready" | "blocked" | "parked";

export interface QueueGateResult {
  status: QueueGateStatus;
  canEnter: boolean;
  blockers: string[];
  warnings: string[];
}

export type TaskRunEvent =
  | { type: "preflight_passed"; envelope: TaskEnvelope; at?: string }
  | { type: "preflight_blocked"; envelope: TaskEnvelope; at?: string }
  | { type: "submit_requested"; envelope: TaskEnvelope; at?: string; codexSessionId?: string; submitId?: string }
  | { type: "provider_querying"; envelope: TaskEnvelope; at?: string; submitId?: string }
  | { type: "provider_queueing"; envelope: TaskEnvelope; at?: string }
  | { type: "provider_generating"; envelope: TaskEnvelope; at?: string }
  | { type: "connection_retrying"; at?: string; backoffUntil?: string }
  | { type: "temp_candidate_available"; at?: string; actualOutput?: string; tempDir?: string }
  | { type: "postprocess_pending"; at?: string; actualOutput?: string }
  | { type: "qa_pending"; at?: string; actualOutput?: string }
  | { type: "succeeded"; at?: string; actualOutput?: string }
  | { type: "failed"; at?: string }
  | { type: "cancelled"; at?: string }
  | { type: "retry_scheduled"; at?: string; backoffUntil?: string }
  | { type: "parked"; at?: string; reason: string };

export type ParkedTaskRun = TaskRun & { parkedReason: string };

function nowIso(): string {
  return new Date().toISOString();
}

function isProviderUnknown(providerId: string): boolean {
  return !providerId || providerId === "unknown";
}

function isExecutionParked(envelope: TaskEnvelope): boolean {
  const rule = getProviderRule(envelope.providerSlot);
  const executionState = rule?.executionState || envelope.executionState;
  return executionState === "parked" || executionState === "planned" || executionState === "unavailable";
}

function isBackoffActive(taskRun: TaskRun, now = new Date()): boolean {
  if (!taskRun.backoffUntil) return false;
  return new Date(taskRun.backoffUntil).getTime() > now.getTime();
}

function isLiveLocalStatus(status: LocalTaskStatus): boolean {
  return status === "submitted" || status === "connection_retrying" || status === "generating";
}

function isLiveProviderStatus(status: ProviderTaskStatus): boolean {
  return status === "querying" || status === "queueing" || status === "generating";
}

function withEventAt(taskRun: TaskRun, at?: string): TaskRun {
  return { ...taskRun, lastEventAt: at || nowIso() };
}

function withStatus(
  taskRun: TaskRun,
  localStatus: LocalTaskStatus,
  providerStatus: ProviderTaskStatus,
  at?: string,
): TaskRun {
  return { ...withEventAt(taskRun, at), localStatus, providerStatus };
}

function withEnvelopeProvider(taskRun: TaskRun, envelope: TaskEnvelope): TaskRun {
  return { ...taskRun, providerId: envelope.providerId || taskRun.providerId };
}

function appendUnique(items: string[], item?: string): string[] {
  if (!item || items.includes(item)) return items;
  return [...items, item];
}

export function canEnterReadyToSubmit(envelope: TaskEnvelope): QueueGateResult {
  const blockers: string[] = [];
  const warnings = envelope.preflight.warnings.map((item) => item.messageForUser);
  const rule = getProviderRule(envelope.providerSlot);

  if (envelope.preflight.status === "blocked") {
    blockers.push(...envelope.preflight.blockers.map((item) => item.messageForUser));
  }

  if (!rule) {
    blockers.push(`Provider slot ${envelope.providerSlot} is not registered.`);
  }

  if (isProviderUnknown(envelope.providerId)) {
    blockers.push("任务没有解析出明确 provider，不能提交执行。");
  }

  if (rule?.forbiddenProviders.includes(envelope.providerId)) {
    blockers.push(`${envelope.providerId} is forbidden for ${envelope.providerSlot}.`);
  }

  if (rule?.allowedProviders.length && !rule.allowedProviders.includes(envelope.providerId)) {
    blockers.push(`${envelope.providerId} is not allowed for ${envelope.providerSlot}.`);
  }

  if (rule && !rule.allowedModes.includes(envelope.requiredMode)) {
    blockers.push(`${envelope.requiredMode} is not supported by ${envelope.providerSlot}.`);
  }

  if (envelope.expectedOutputs.length === 0) {
    blockers.push("任务没有声明 expected outputs，不能提交执行。");
  }

  if (blockers.length) {
    return {
      status: "blocked",
      canEnter: false,
      blockers,
      warnings,
    };
  }

  if (isExecutionParked(envelope)) {
    return {
      status: "parked",
      canEnter: false,
      blockers,
      warnings: appendUnique(warnings, "当前 provider 只允许生成任务占位，不能提交真实执行。"),
    };
  }

  return {
    status: "ready",
    canEnter: true,
    blockers,
    warnings,
  };
}

export function createTaskRunFromEnvelope(envelope: TaskEnvelope): TaskRun {
  const gate = canEnterReadyToSubmit(envelope);
  const localStatus: LocalTaskStatus =
    gate.status === "parked" ? "parked" : gate.canEnter ? "ready_to_submit" : "pending_local";

  return {
    taskId: envelope.id,
    localStatus,
    providerStatus: "not_submitted",
    providerId: envelope.providerId || "unknown",
    retryCount: 0,
    stallTimeoutSeconds: 600,
    tempDirs: [],
    expectedOutputs: envelope.expectedOutputs,
    actualOutputs: [],
    lastEventAt: nowIso(),
  };
}

export function parkTaskRun(taskRun: TaskRun, reason: string): ParkedTaskRun {
  const parkedTaskRun = { ...taskRun };
  delete parkedTaskRun.submitId;
  delete parkedTaskRun.providerTaskId;
  return {
    ...parkedTaskRun,
    localStatus: "parked",
    providerStatus: "not_submitted",
    parkedReason: reason,
    lastEventAt: nowIso(),
  };
}

export function transitionTaskRun(taskRun: TaskRun, event: TaskRunEvent): TaskRun {
  if (taskRun.localStatus === "parked" && event.type !== "parked") {
    return withEventAt(taskRun, event.at);
  }

  const eventEnvelope = "envelope" in event ? event.envelope : undefined;
  if (
    isProviderUnknown(taskRun.providerId) &&
    (!eventEnvelope || isProviderUnknown(eventEnvelope.providerId)) &&
    event.type !== "preflight_blocked" &&
    event.type !== "parked"
  ) {
    return withStatus(taskRun, "pending_local", "not_submitted", event.at);
  }

  switch (event.type) {
    case "preflight_passed": {
      const gate = canEnterReadyToSubmit(event.envelope);
      const nextTaskRun = withEnvelopeProvider(taskRun, event.envelope);
      if (gate.status === "parked") return parkTaskRun(nextTaskRun, gate.warnings.at(-1) || "Provider is parked.");
      if (!gate.canEnter) return withStatus(nextTaskRun, "pending_local", "not_submitted", event.at);
      return withStatus(nextTaskRun, "ready_to_submit", "not_submitted", event.at);
    }
    case "preflight_blocked":
      return withStatus(withEnvelopeProvider(taskRun, event.envelope), "pending_local", "not_submitted", event.at);
    case "submit_requested": {
      const gate = canEnterReadyToSubmit(event.envelope);
      const nextTaskRun = withEnvelopeProvider(taskRun, event.envelope);
      if (gate.status === "parked") return parkTaskRun(nextTaskRun, gate.warnings.at(-1) || "Provider is parked.");
      if (!gate.canEnter) return withStatus(nextTaskRun, "pending_local", "not_submitted", event.at);
      return {
        ...withStatus(nextTaskRun, "submitted", "querying", event.at),
        codexSessionId: event.codexSessionId || taskRun.codexSessionId,
        submitId: event.submitId || taskRun.submitId,
      };
    }
    case "provider_querying": {
      const gate = canEnterReadyToSubmit(event.envelope);
      const nextTaskRun = withEnvelopeProvider(taskRun, event.envelope);
      if (gate.status === "parked") return parkTaskRun(nextTaskRun, "Provider is parked.");
      if (!gate.canEnter) return withStatus(nextTaskRun, "pending_local", "not_submitted", event.at);
      return { ...withStatus(nextTaskRun, "submitted", "querying", event.at), submitId: event.submitId || taskRun.submitId };
    }
    case "provider_queueing": {
      const gate = canEnterReadyToSubmit(event.envelope);
      const nextTaskRun = withEnvelopeProvider(taskRun, event.envelope);
      if (gate.status === "parked") return parkTaskRun(nextTaskRun, "Provider is parked.");
      if (!gate.canEnter) return withStatus(nextTaskRun, "pending_local", "not_submitted", event.at);
      return withStatus(nextTaskRun, "submitted", "queueing", event.at);
    }
    case "provider_generating": {
      const gate = canEnterReadyToSubmit(event.envelope);
      const nextTaskRun = withEnvelopeProvider(taskRun, event.envelope);
      if (gate.status === "parked") return parkTaskRun(nextTaskRun, "Provider is parked.");
      if (!gate.canEnter) return withStatus(nextTaskRun, "pending_local", "not_submitted", event.at);
      return withStatus(nextTaskRun, "generating", "generating", event.at);
    }
    case "connection_retrying":
      return {
        ...withStatus(taskRun, "connection_retrying", "unknown", event.at),
        backoffUntil: event.backoffUntil || taskRun.backoffUntil,
      };
    case "temp_candidate_available":
      return {
        ...withStatus(taskRun, "temp_candidate_available", taskRun.providerStatus, event.at),
        actualOutputs: appendUnique(taskRun.actualOutputs, event.actualOutput),
        tempDirs: appendUnique(taskRun.tempDirs, event.tempDir),
      };
    case "postprocess_pending":
      return {
        ...withStatus(taskRun, "postprocess_pending", taskRun.providerStatus, event.at),
        actualOutputs: appendUnique(taskRun.actualOutputs, event.actualOutput),
      };
    case "qa_pending":
      return {
        ...withStatus(taskRun, "qa_pending", "success", event.at),
        actualOutputs: appendUnique(taskRun.actualOutputs, event.actualOutput),
      };
    case "succeeded":
      return {
        ...withStatus(taskRun, "succeeded", "success", event.at),
        actualOutputs: appendUnique(taskRun.actualOutputs, event.actualOutput),
      };
    case "failed":
      return withStatus(taskRun, "failed", "fail", event.at);
    case "cancelled":
      return withStatus(taskRun, "cancelled", "not_submitted", event.at);
    case "retry_scheduled":
      return {
        ...withStatus(taskRun, "connection_retrying", "unknown", event.at),
        retryCount: taskRun.retryCount + 1,
        backoffUntil: event.backoffUntil,
      };
    case "parked":
      return parkTaskRun(withEventAt(taskRun, event.at), event.reason);
    default:
      return withEventAt(taskRun);
  }
}

export function queueNextRunnable(taskRuns: TaskRun[], concurrency: number): TaskRun[] {
  if (concurrency <= 0) return [];

  const activeCount = taskRuns.filter(
    (taskRun) => isLiveLocalStatus(taskRun.localStatus) || isLiveProviderStatus(taskRun.providerStatus),
  ).length;
  const openSlots = Math.max(0, concurrency - activeCount);
  if (openSlots === 0) return [];

  const now = new Date();
  return taskRuns
    .filter((taskRun) => taskRun.localStatus === "ready_to_submit")
    .filter((taskRun) => taskRun.providerStatus === "not_submitted")
    .filter((taskRun) => !isBackoffActive(taskRun, now))
    .slice(0, openSlots);
}
