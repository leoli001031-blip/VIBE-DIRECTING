import {
  IMAGE2_REFERENCE_EDIT_MAX_AUTO_RETRIES,
  IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY,
  getProviderRule,
} from "./providerPolicy";
import type { Image2AdapterRequest, Image2ReferenceImageInput } from "./types";
import type {
  ProviderLateReturnCandidate,
  ProviderRetryPolicy,
  ProviderRetrySchedulerState,
  ProviderRetryTask,
} from "./providerRetryScheduler";

export const referenceEditPolicySchemaVersion = "reference_edit_policy_v1";

export type ReferenceEditReleaseStatus = "needs_review" | "missing" | "blocked";
export type ReferenceEditReferenceSource = Image2ReferenceImageInput["source"];

export interface ReferenceEditReleasePolicy {
  schemaVersion: typeof referenceEditPolicySchemaVersion;
  providerSlot: "image.edit";
  requiredMode: "image2image";
  lockedReferenceOnly: true;
  textToImageFallbackAllowed: false;
  defaultConcurrency: typeof IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY;
  maxConcurrency: typeof IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY;
  maxAutoRetries: typeof IMAGE2_REFERENCE_EDIT_MAX_AUTO_RETRIES;
  promotionAllowed: false;
  successfulReturnStatus: "needs_review";
  missingReturnStatus: "missing";
  lateReturnStatus: "needs_review";
}

export interface ReferenceEditRequestPolicyCheck {
  valid: boolean;
  blockers: string[];
  warnings: string[];
  policy: ReferenceEditReleasePolicy;
}

export interface ReferenceEditReturnItem {
  taskId: string;
  shotId: string;
  expectedOutputPath: string;
  status: ReferenceEditReleaseStatus;
  providerReturned: boolean;
  outputPath?: string;
  outputSha256?: string;
  attemptId?: string;
  reasons: string[];
  promotionAllowed: false;
}

export interface ReferenceEditReturnSummary {
  schemaVersion: typeof referenceEditPolicySchemaVersion;
  status: "complete_needs_review" | "partial_return" | "missing" | "blocked";
  requestedCount: number;
  returnedCount: number;
  missingCount: number;
  needsReviewCount: number;
  blockedCount: number;
  maxConcurrency: number;
  promotionAllowed: false;
  items: ReferenceEditReturnItem[];
}

const allowedReferenceSources = new Set<ReferenceEditReferenceSource>(["approved_start_frame", "locked_asset"]);

export function getReferenceEditReleasePolicy(): ReferenceEditReleasePolicy {
  return {
    schemaVersion: referenceEditPolicySchemaVersion,
    providerSlot: "image.edit",
    requiredMode: "image2image",
    lockedReferenceOnly: true,
    textToImageFallbackAllowed: false,
    defaultConcurrency: IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY,
    maxConcurrency: IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY,
    maxAutoRetries: IMAGE2_REFERENCE_EDIT_MAX_AUTO_RETRIES,
    promotionAllowed: false,
    successfulReturnStatus: "needs_review",
    missingReturnStatus: "missing",
    lateReturnStatus: "needs_review",
  };
}

export function buildReferenceEditRetryPolicy(overrides: Partial<ProviderRetryPolicy> = {}): ProviderRetryPolicy {
  const maxConcurrency = Math.min(
    IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY,
    Math.max(0, Math.floor(overrides.maxConcurrency ?? IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY)),
  );
  const maxAutoRetries = Math.max(0, Math.floor(overrides.maxAutoRetries ?? IMAGE2_REFERENCE_EDIT_MAX_AUTO_RETRIES));

  return {
    maxConcurrency,
    maxAutoRetries,
    baseDelayMs: Math.max(0, Math.floor(overrides.baseDelayMs ?? 1_000)),
    maxDelayMs: Math.max(0, Math.floor(overrides.maxDelayMs ?? 30_000)),
    jitterRatio: Math.max(0, overrides.jitterRatio ?? 0),
    retryableFailureKinds: overrides.retryableFailureKinds || [
      "timeout",
      "rate_limit",
      "server_error",
      "network_error",
      "provider_missing",
    ],
    terminalFailureKinds: overrides.terminalFailureKinds || [
      "auth",
      "validation_error",
      "content_policy",
      "qa_failed",
      "cancelled",
    ],
  };
}

function validateReferenceInput(input: Image2ReferenceImageInput, index: number): string[] {
  const prefix = `reference_image_input_${index}`;
  const blockers: string[] = [];
  if (!allowedReferenceSources.has(input.source)) blockers.push(`${prefix}_not_locked_reference`);
  if (input.required !== true) blockers.push(`${prefix}_must_be_required`);
  if (input.mustUseAsVisualInput !== true) blockers.push(`${prefix}_must_use_visual_input`);
  if (input.status !== "available") blockers.push(`${prefix}_not_available`);
  if (!input.path?.trim()) blockers.push(`${prefix}_path_missing`);
  return blockers;
}

export function validateReferenceEditRequestPolicy(request: Image2AdapterRequest): ReferenceEditRequestPolicyCheck {
  const policy = getReferenceEditReleasePolicy();
  const rule = getProviderRule(policy.providerSlot);
  const referenceImageInputs = request.payload?.referenceImageInputs || [];
  const blockers = [
    request.operation === "image2image" ? "" : "reference_edit_requires_image2image_operation",
    request.forbiddenFallbacks.includes("image2image_to_text2image") ? "" : "image2image_to_text2image_must_be_forbidden",
    request.forbiddenFallbacks.includes("reference_edit_to_text2image") ? "" : "reference_edit_to_text2image_must_be_forbidden",
    rule?.concurrency === IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY ? "" : "provider_policy_reference_edit_concurrency_must_be_3",
    Array.isArray(referenceImageInputs) && referenceImageInputs.length > 0 ? "" : "locked_reference_image_input_required",
    ...referenceImageInputs.flatMap(validateReferenceInput),
  ].filter(Boolean);

  return {
    valid: blockers.length === 0,
    blockers,
    warnings: [],
    policy,
  };
}

function latestSucceededReturn(state: ProviderRetrySchedulerState, task: ProviderRetryTask) {
  return state.attempts
    .filter((attempt) => attempt.taskId === task.taskId && attempt.status === "succeeded")
    .sort((left, right) => right.attemptNumber - left.attemptNumber)[0];
}

function taskHasTerminalFailure(state: ProviderRetrySchedulerState, task: ProviderRetryTask): boolean {
  return state.attempts.some((attempt) => attempt.taskId === task.taskId && attempt.status === "failed_terminal");
}

export function summarizeReferenceEditReturns(state: ProviderRetrySchedulerState): ReferenceEditReturnSummary {
  const items: ReferenceEditReturnItem[] = state.tasks.map((task) => {
    const succeeded = latestSucceededReturn(state, task);
    if (succeeded) {
      return {
        taskId: task.taskId,
        shotId: task.shotId,
        expectedOutputPath: task.expectedOutputPath,
        status: "needs_review",
        providerReturned: true,
        outputPath: succeeded.outputPath,
        outputSha256: succeeded.outputSha256,
        attemptId: succeeded.attemptId,
        reasons: ["provider_return_requires_human_review"],
        promotionAllowed: false,
      };
    }

    return {
      taskId: task.taskId,
      shotId: task.shotId,
      expectedOutputPath: task.expectedOutputPath,
      status: taskHasTerminalFailure(state, task) ? "missing" : "blocked",
      providerReturned: false,
      reasons: taskHasTerminalFailure(state, task) ? ["provider_return_missing"] : ["provider_return_not_settled"],
      promotionAllowed: false,
    };
  });

  const returnedCount = items.filter((item) => item.providerReturned).length;
  const missingCount = items.filter((item) => item.status === "missing").length;
  const blockedCount = items.filter((item) => item.status === "blocked").length;
  const needsReviewCount = items.filter((item) => item.status === "needs_review").length;
  const status =
    blockedCount > 0
      ? "blocked"
      : returnedCount === 0
        ? "missing"
        : returnedCount < state.tasks.length
          ? "partial_return"
          : "complete_needs_review";

  return {
    schemaVersion: referenceEditPolicySchemaVersion,
    status,
    requestedCount: state.tasks.length,
    returnedCount,
    missingCount,
    needsReviewCount,
    blockedCount,
    maxConcurrency: state.policy.maxConcurrency,
    promotionAllowed: false,
    items,
  };
}

export function classifyLateReferenceEditReturn(candidate: ProviderLateReturnCandidate): ReferenceEditReturnItem {
  return {
    taskId: candidate.taskId,
    shotId: candidate.shotId,
    expectedOutputPath: "",
    status: candidate.status === "late_candidate_needs_review" ? "needs_review" : "missing",
    providerReturned: candidate.status === "late_candidate_needs_review",
    outputPath: candidate.outputPath,
    outputSha256: candidate.outputSha256,
    attemptId: candidate.attemptId,
    reasons: [candidate.status === "late_candidate_needs_review" ? "late_return_requires_human_review" : "late_return_unknown_attempt"],
    promotionAllowed: false,
  };
}
