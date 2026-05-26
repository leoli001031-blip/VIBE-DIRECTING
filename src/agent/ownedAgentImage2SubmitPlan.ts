import {
  createProviderRetrySchedulerState,
  queueNextProviderRetryBatch,
  type ProviderRetryAttempt,
  type ProviderRetrySchedulerState,
  type ProviderRetryTask,
} from "../core/providerRetryScheduler";
import { buildCurrentProjectImage2GenerateRetryPolicy } from "../core/currentProjectImage2Batch";
import type { LanyiImage2SubmitPlanCandidate } from "./lanyiImage2AgentTool";
import type { OwnedAgentStructuredResult } from "./ownedAgentLoop";

export const ownedAgentImage2SubmitPlanSchemaVersion = "0.1.0";

export interface OwnedAgentImage2SubmitPlanConfirmation {
  planId: string;
  taskEnvelopeId: string;
  permissionReceiptId: string;
  confirmed: boolean;
  confirmedAt: string;
  phrase: "queue-p6-image2";
}

export interface OwnedAgentImage2P6SchedulerProjection {
  schemaVersion: typeof ownedAgentImage2SubmitPlanSchemaVersion;
  status: "awaiting_user_confirmation" | "ready_for_p6_scheduler" | "blocked";
  providerCalled: false;
  networkIoAllowed: false;
  liveSubmitAllowed: false;
  promotionAllowed: false;
  submitPlans: LanyiImage2SubmitPlanCandidate[];
  confirmations: OwnedAgentImage2SubmitPlanConfirmation[];
  tasks: ProviderRetryTask[];
  schedulerState: ProviderRetrySchedulerState;
  nextRunnable: ProviderRetryAttempt[];
  blockers: string[];
  summary: {
    submitPlanCount: number;
    confirmedCount: number;
    queuedCount: number;
    nextRunnableCount: number;
  };
}

function confirmationMatchesPlan(
  plan: LanyiImage2SubmitPlanCandidate,
  confirmation: OwnedAgentImage2SubmitPlanConfirmation,
) {
  return confirmation.confirmed === true
    && confirmation.phrase === "queue-p6-image2"
    && Boolean(confirmation.confirmedAt)
    && confirmation.planId === plan.id
    && confirmation.taskEnvelopeId === plan.taskEnvelopeId
    && confirmation.permissionReceiptId === plan.permissionReceiptId;
}

function planIsSafe(plan: LanyiImage2SubmitPlanCandidate) {
  return plan.kind === "lanyi_image2_submit_plan_candidate"
    && plan.providerId === "lanyi-image2"
    && Boolean(plan.taskEnvelopeId)
    && Boolean(plan.inputHash)
    && Boolean(plan.permissionReceiptId)
    && Boolean(plan.shotId)
    && Boolean(plan.expectedOutputPath)
    && plan.providerCalled === false
    && plan.networkIoAllowed === false
    && plan.liveSubmitAllowed === false
    && plan.promotionAllowed === false;
}

function taskFromPlan(plan: LanyiImage2SubmitPlanCandidate, priority: number): ProviderRetryTask {
  return {
    taskId: plan.taskEnvelopeId,
    shotId: plan.shotId,
    inputHash: plan.inputHash,
    permissionReceiptId: plan.permissionReceiptId,
    expectedOutputPath: plan.expectedOutputPath,
    priority,
  };
}

export function queueOwnedAgentImage2SubmitPlansForP6(input: {
  result: OwnedAgentStructuredResult;
  confirmations?: OwnedAgentImage2SubmitPlanConfirmation[];
  generatedAt?: string;
}): OwnedAgentImage2P6SchedulerProjection {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const confirmations = input.confirmations || [];
  const submitPlans = input.result.image2SubmitPlans || [];
  const blockers = [
    input.result.status === "succeeded" ? "" : "owned_agent_result_not_succeeded",
    input.result.receiptCandidate ? "" : "owned_agent_receipt_candidate_missing",
    input.result.providerCalled === false ? "" : "owned_agent_provider_call_observed",
    submitPlans.length ? "" : "owned_agent_image2_submit_plan_missing",
    ...submitPlans.flatMap((plan) => planIsSafe(plan) ? [] : [`unsafe_submit_plan:${plan.id || "missing"}`]),
  ].filter(Boolean);
  const confirmedPlans = blockers.length
    ? []
    : submitPlans.filter((plan) => confirmations.some((confirmation) => confirmationMatchesPlan(plan, confirmation)));
  const tasks = confirmedPlans.map((plan, index) => taskFromPlan(plan, submitPlans.length - index));
  const schedulerState = createProviderRetrySchedulerState({
    tasks,
    policy: buildCurrentProjectImage2GenerateRetryPolicy(),
    generatedAt,
  });
  const nextRunnable = queueNextProviderRetryBatch(schedulerState, generatedAt);
  const status = blockers.length
    ? "blocked"
    : tasks.length
      ? "ready_for_p6_scheduler"
      : "awaiting_user_confirmation";

  return {
    schemaVersion: ownedAgentImage2SubmitPlanSchemaVersion,
    status,
    providerCalled: false,
    networkIoAllowed: false,
    liveSubmitAllowed: false,
    promotionAllowed: false,
    submitPlans,
    confirmations,
    tasks,
    schedulerState,
    nextRunnable,
    blockers: status === "awaiting_user_confirmation" ? ["explicit_permission_receipt_required"] : blockers,
    summary: {
      submitPlanCount: submitPlans.length,
      confirmedCount: confirmedPlans.length,
      queuedCount: tasks.length,
      nextRunnableCount: nextRunnable.length,
    },
  };
}
