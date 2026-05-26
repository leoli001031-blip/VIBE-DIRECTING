import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  appendProviderRetryAttemptResult,
  createProviderRetrySchedulerState,
  ingestLateProviderReturn,
  providerRetryAttemptReceiptCandidates,
  queueNextProviderRetryBatch,
  runMockProviderRetryScheduler,
  type ProviderRetryAttempt,
  type ProviderRetryFailureKind,
  type ProviderRetryPolicy,
  type ProviderRetryResult,
  type ProviderRetryTask,
} from "../src/core/providerRetryScheduler";
import {
  buildCurrentProjectImage2GenerateRetryPolicy,
  getCurrentProjectImage2BatchPolicyProjection,
  summarizeCurrentProjectImage2BatchExecution,
} from "../src/core/currentProjectImage2Batch";
import {
  buildReferenceEditRetryPolicy,
  classifyLateReferenceEditReturn,
  summarizeReferenceEditReturns,
} from "../src/core/referenceEditPolicy";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function categoryFor(taskIndex: number): "terminal_auth" | "terminal_validation" | "missing" | "timeout" | "rate_then_server" | "success" {
  const number = taskIndex + 1;
  if (number % 41 === 0) return "terminal_auth";
  if (number % 43 === 0) return "terminal_validation";
  if (number % 17 === 0) return "missing";
  if (number % 11 === 0) return "rate_then_server";
  if (number % 7 === 0) return "timeout";
  return "success";
}

function failure(kind: ProviderRetryFailureKind): ProviderRetryResult {
  return {
    status: "failure",
    failureKind: kind,
    message: `mock ${kind}`,
  };
}

function successFor(attempt: ProviderRetryAttempt, task: ProviderRetryTask): ProviderRetryResult {
  return {
    status: "success",
    providerRequestId: `mock-provider-${attempt.attemptId}`,
    outputPath: task.expectedOutputPath,
    outputSha256: sha256(`${task.taskId}:${attempt.attemptNumber}:output`),
  };
}

const totalTasks = 200;
const generatedAt = "2026-05-17T00:00:00.000Z";
const imageGenerateDefaultPolicy = buildCurrentProjectImage2GenerateRetryPolicy();
assert.equal(imageGenerateDefaultPolicy.maxConcurrency, 3, "image.generate default policy concurrency must be 3");
assert.equal(imageGenerateDefaultPolicy.retryConcurrency, 2, "image.generate retry policy concurrency must be 2");
assert.equal(imageGenerateDefaultPolicy.maxAutoRetries, 2, "image.generate retry policy budget must be 2");

const currentProjectPolicyProjection = getCurrentProjectImage2BatchPolicyProjection();
assert.equal(currentProjectPolicyProjection.imageGenerate.concurrency, 3, "current project image.generate concurrency projection must be 3");
assert.equal(currentProjectPolicyProjection.imageGenerate.retryConcurrency, 2, "current project image.generate retry projection must be 2");
assert.equal(currentProjectPolicyProjection.imageGenerate.maxAutoRetries, 2, "current project image.generate retry budget projection must be 2");
assert.equal(currentProjectPolicyProjection.imageGenerate.threeConcurrentTextToImageDefaultAllowed, true, "current project image.generate projection should name the 3-concurrent default");
assert.equal(currentProjectPolicyProjection.imageEditReference.concurrency, 3, "current project reference edit concurrency projection must be 3");
assert.equal(currentProjectPolicyProjection.imageEditReference.referenceConcurrency, 3, "current project reference edit cap projection must be 3");
assert.equal(currentProjectPolicyProjection.imageEditReference.retryConcurrency, 2, "current project reference edit retry projection must be 2");
assert.equal(currentProjectPolicyProjection.imageEditReference.maxAutoRetries, 2, "current project reference edit retry budget projection must be 2");

const tasks: ProviderRetryTask[] = Array.from({ length: totalTasks }, (_, index) => {
  const number = index + 1;
  const shotId = `P${String(number).padStart(3, "0")}`;
  return {
    taskId: `image2-task-${shotId}`,
    shotId,
    inputHash: sha256(`input:${shotId}`),
    permissionReceiptId: `permission-receipt-${shotId}`,
    expectedOutputPath: `outputs/${shotId}/image.png`,
    priority: totalTasks - index,
  };
});

const policy: ProviderRetryPolicy = {
  maxConcurrency: 7,
  maxAutoRetries: 2,
  baseDelayMs: 50,
  maxDelayMs: 500,
  retryableFailureKinds: ["timeout", "rate_limit", "server_error", "network_error", "provider_missing"],
  terminalFailureKinds: ["auth", "validation_error", "content_policy", "qa_failed", "cancelled"],
};

const initialState = createProviderRetrySchedulerState({ tasks, policy, generatedAt });

const providerCallsByTaskId = new Map<string, number>();
const finalState = runMockProviderRetryScheduler({
  state: initialState,
  startAt: generatedAt,
  provider: (attempt, task) => {
    const taskIndex = Number(task.shotId.replace("P", "")) - 1;
    const category = categoryFor(taskIndex);
    providerCallsByTaskId.set(task.taskId, (providerCallsByTaskId.get(task.taskId) || 0) + 1);

    if (category === "terminal_auth") return failure("auth");
    if (category === "terminal_validation") return failure("validation_error");
    if (category === "missing") {
      return {
        status: "missing",
        failureKind: "provider_missing",
        message: "mock provider did not return this shot",
      };
    }
    if (category === "timeout" && attempt.attemptNumber === 1) return failure("timeout");
    if (category === "rate_then_server" && attempt.attemptNumber === 1) return failure("rate_limit");
    if (category === "rate_then_server" && attempt.attemptNumber === 2) return failure("server_error");
    return successFor(attempt, task);
  },
});

const expectedTerminalFirst = tasks.filter((_, index) => {
  const category = categoryFor(index);
  return category === "terminal_auth" || category === "terminal_validation";
}).length;
const expectedMissingTerminal = tasks.filter((_, index) => categoryFor(index) === "missing").length;
const expectedSucceeded = totalTasks - expectedTerminalFirst - expectedMissingTerminal;

assert.equal(finalState.summary.totalTasks, totalTasks, "all tasks should be tracked");
assert.equal(finalState.summary.succeeded, expectedSucceeded, "retryable non-missing tasks should eventually succeed");
assert.equal(
  finalState.summary.terminalFailed,
  expectedTerminalFirst + expectedMissingTerminal,
  "terminal and retry-budget-exhausted missing tasks should fail terminally",
);
assert.equal(finalState.summary.queued, 0, "scheduler should settle with no queued attempts");
assert.equal(finalState.summary.running, 0, "scheduler should settle with no running attempts");
assert.equal(finalState.summary.providerCalled, true, "mock provider should be called");
assert.equal(finalState.summary.promotionAllowed, false, "provider retry scheduler must never promote outputs");
assert.ok(finalState.summary.maxObservedConcurrency > 1, "mock pressure test should exercise concurrency");
assert.ok(
  finalState.summary.maxObservedConcurrency <= policy.maxConcurrency,
  "observed concurrency must respect policy maxConcurrency",
);

for (const task of tasks) {
  const attempts = finalState.attempts.filter((attempt) => attempt.taskId === task.taskId);
  assert.ok(attempts.length >= 1, `${task.taskId} should have at least one attempt`);
  assert.ok(
    attempts.length <= policy.maxAutoRetries + 1,
    `${task.taskId} should not exceed retry budget`,
  );

  const taskIndex = Number(task.shotId.replace("P", "")) - 1;
  const category = categoryFor(taskIndex);
  if (category === "terminal_auth" || category === "terminal_validation") {
    assert.equal(attempts.length, 1, `${task.taskId} terminal provider failures must not retry`);
    assert.equal(attempts[0].status, "failed_terminal", `${task.taskId} should fail terminally`);
  }
  if (category === "missing") {
    assert.equal(attempts.length, policy.maxAutoRetries + 1, `${task.taskId} missing should consume retry budget`);
    assert.equal(attempts.at(-1)?.status, "failed_terminal", `${task.taskId} missing should finish terminal`);
    assert.equal(attempts.at(-1)?.failureKind, "provider_missing", `${task.taskId} should preserve missing reason`);
  }
}

const missingTask = tasks.find((_, index) => categoryFor(index) === "missing");
assert.ok(missingTask, "fixture should include missing tasks");
const firstMissingAttempt = finalState.attempts.find(
  (attempt) => attempt.taskId === missingTask.taskId && attempt.attemptNumber === 1,
);
assert.ok(firstMissingAttempt, "missing task should have first attempt");

const lateCandidate = ingestLateProviderReturn(finalState, {
  attemptId: firstMissingAttempt.attemptId,
  outputPath: `late/${missingTask.shotId}.png`,
  outputSha256: sha256(`late:${missingTask.shotId}`),
});
assert.equal(lateCandidate.status, "late_candidate_needs_review", "late provider returns should become review candidates");
assert.equal(lateCandidate.promotionAllowed, false, "late provider returns must not promote directly");
assert.equal(lateCandidate.inputHash, firstMissingAttempt.inputHash, "late return candidate should retain input hash");
assert.equal(lateCandidate.permissionReceiptId, firstMissingAttempt.permissionReceiptId, "late return candidate should retain permission receipt id");
assert.equal(lateCandidate.expectedOutputPath, firstMissingAttempt.expectedOutputPath, "late return candidate should retain expected output path");

const retryConcurrencyPolicy: ProviderRetryPolicy = {
  maxConcurrency: 3,
  retryConcurrency: 2,
  maxAutoRetries: 2,
  baseDelayMs: 1,
  maxDelayMs: 1,
  retryableFailureKinds: ["provider_missing"],
  terminalFailureKinds: ["auth", "validation_error", "content_policy", "qa_failed", "cancelled"],
};
const retryConcurrencyTasks: ProviderRetryTask[] = ["A", "B", "C"].map((shotId, index) => ({
  taskId: `retry-concurrency-${shotId}`,
  shotId,
  inputHash: sha256(`retry-concurrency:${shotId}`),
  permissionReceiptId: `permission-retry-concurrency-${shotId}`,
  expectedOutputPath: `outputs/retry-concurrency/${shotId}.png`,
  priority: 3 - index,
}));
let retryConcurrencyState = createProviderRetrySchedulerState({
  tasks: retryConcurrencyTasks,
  policy: retryConcurrencyPolicy,
  generatedAt,
});
let firstRetryConcurrencyBatch = queueNextProviderRetryBatch(retryConcurrencyState, generatedAt);
assert.equal(firstRetryConcurrencyBatch.length, 3, "first image.generate batch should allow concurrency 3");
for (const attempt of firstRetryConcurrencyBatch) {
  retryConcurrencyState = appendProviderRetryAttemptResult(
    retryConcurrencyState,
    attempt.attemptId,
    { status: "missing", failureKind: "provider_missing", message: "mock missing" },
    "2026-05-17T00:00:00.001Z",
  );
}
const retryRunnable = queueNextProviderRetryBatch(retryConcurrencyState, "2026-05-17T00:00:00.002Z");
assert.equal(retryRunnable.length, 2, "failed image.generate retries must cap at concurrency 2");
assert.ok(retryRunnable.every((attempt) => attempt.attemptNumber === 2), "retry concurrency check should only pick retry attempts");

const receiptCandidates = providerRetryAttemptReceiptCandidates(retryConcurrencyState);
const firstReceiptCandidate = receiptCandidates.find((candidate) => candidate.taskId === retryConcurrencyTasks[0].taskId);
assert.ok(firstReceiptCandidate, "receipt candidate should exist for retry task");
assert.equal(firstReceiptCandidate?.inputHash, retryConcurrencyTasks[0].inputHash, "receipt candidate should expose inputHash");
assert.equal(
  firstReceiptCandidate?.permissionReceiptId,
  retryConcurrencyTasks[0].permissionReceiptId,
  "receipt candidate should expose permissionReceiptId",
);
assert.equal(
  firstReceiptCandidate?.expectedOutputPath,
  retryConcurrencyTasks[0].expectedOutputPath,
  "receipt candidate should expose expectedOutputPath",
);
assert.equal(firstReceiptCandidate?.shotId, retryConcurrencyTasks[0].shotId, "receipt candidate should expose shotId");

const referenceEditTasks: ProviderRetryTask[] = ["R5A", "R5B", "R5C", "R5D"].map((shotId, index) => ({
  taskId: `reference-edit-${shotId}`,
  shotId,
  inputHash: sha256(`reference-edit-input:${shotId}`),
  permissionReceiptId: `reference-edit-permission-${shotId}`,
  expectedOutputPath: `outputs/${shotId}/reference-edit.png`,
  priority: 4 - index,
}));
const referenceEditPolicy = buildReferenceEditRetryPolicy({ maxAutoRetries: 1, baseDelayMs: 1, maxDelayMs: 1 });
const referenceEditFinalState = runMockProviderRetryScheduler({
  state: createProviderRetrySchedulerState({
    tasks: referenceEditTasks,
    policy: referenceEditPolicy,
    generatedAt,
  }),
  startAt: generatedAt,
  provider: (attempt, task) => {
    if (task.shotId === "R5A" || task.shotId === "R5B") {
      return {
        status: "success",
        providerRequestId: `reference-edit-provider-${attempt.attemptId}`,
        outputPath: task.expectedOutputPath,
        outputSha256: sha256(`reference-edit-output:${task.taskId}`),
      };
    }
    return {
      status: "missing",
      failureKind: "provider_missing",
      message: "mock reference edit partial return",
    };
  },
});
const referenceEditReturnSummary = summarizeReferenceEditReturns(referenceEditFinalState);
assert.equal(referenceEditPolicy.maxConcurrency, 3, "reference edit retry policy must default to concurrency 3");
assert.equal(referenceEditFinalState.summary.maxObservedConcurrency, 3, "reference edit scheduler must respect concurrency 3");
assert.equal(referenceEditReturnSummary.status, "partial_return", "reference edit mixed return should stay partial");
assert.equal(referenceEditReturnSummary.returnedCount, 2, "reference edit returned count drifted");
assert.equal(referenceEditReturnSummary.needsReviewCount, 2, "reference edit returns should require review");
assert.equal(referenceEditReturnSummary.missingCount, 2, "reference edit missing outputs should remain missing");
assert.equal(referenceEditReturnSummary.promotionAllowed, false, "reference edit partial return must not promote");
assert.ok(
  referenceEditReturnSummary.items.every((item) => item.status === "needs_review" || item.status === "missing"),
  "reference edit return items may only be needs_review or missing",
);
const referenceEditMissingAttempt = referenceEditFinalState.attempts.find(
  (attempt) => attempt.taskId === "reference-edit-R5C" && attempt.attemptNumber === 1,
);
assert.ok(referenceEditMissingAttempt, "reference edit missing attempt should retain late-return evidence");
const referenceEditLateItem = classifyLateReferenceEditReturn(
  ingestLateProviderReturn(referenceEditFinalState, {
    attemptId: referenceEditMissingAttempt.attemptId,
    outputPath: "late/R5C/reference-edit.png",
    outputSha256: sha256("reference-edit-late:R5C"),
  }),
);
assert.equal(referenceEditLateItem.status, "needs_review", "reference edit late returns should require review");
assert.equal(referenceEditLateItem.promotionAllowed, false, "reference edit late returns must not promote");

const partialImageGenerateState = runMockProviderRetryScheduler({
  state: createProviderRetrySchedulerState({
    tasks: ["G1", "G2", "G3"].map((shotId, index) => ({
      taskId: `image-generate-${shotId}`,
      shotId,
      inputHash: sha256(`image-generate:${shotId}`),
      permissionReceiptId: `permission-image-generate-${shotId}`,
      expectedOutputPath: `outputs/image-generate/${shotId}.png`,
      priority: 3 - index,
    })),
    policy: {
      maxConcurrency: 3,
      retryConcurrency: 2,
      maxAutoRetries: 1,
      baseDelayMs: 1,
      maxDelayMs: 1,
      retryableFailureKinds: ["provider_missing"],
      terminalFailureKinds: ["auth", "validation_error", "content_policy", "qa_failed", "cancelled"],
    },
    generatedAt,
  }),
  startAt: generatedAt,
  provider: (attempt, task) => {
    if (task.shotId === "G3") {
      return {
        status: "missing",
        failureKind: "provider_missing",
        message: "mock partial missing",
      };
    }
    return successFor(attempt, task);
  },
});
const partialImageGenerateSummary = summarizeCurrentProjectImage2BatchExecution(partialImageGenerateState);
assert.equal(
  partialImageGenerateSummary.status,
  "completed_with_missing",
  "partial image.generate run should complete with missing instead of global failure",
);
assert.equal(partialImageGenerateSummary.returnedCount, 2, "partial image.generate returned count mismatch");
assert.equal(partialImageGenerateSummary.missingCount, 1, "partial image.generate missing count mismatch");
assert.equal(partialImageGenerateSummary.promotionAllowed, false, "partial image.generate batch must not promote");
assert.equal(partialImageGenerateSummary.missingCanPromote, false, "missing image.generate output must not promote");
assert.equal(partialImageGenerateSummary.lateReturnCanPromote, false, "late image.generate output must not promote");

console.log(
  JSON.stringify(
    {
      status: "provider_retry_scheduler_mock_passed",
      totalTasks,
      succeeded: finalState.summary.succeeded,
      terminalFailed: finalState.summary.terminalFailed,
      attemptsTotal: finalState.summary.attemptsTotal,
      maxObservedConcurrency: finalState.summary.maxObservedConcurrency,
      maxConcurrency: policy.maxConcurrency,
      maxAutoRetries: policy.maxAutoRetries,
      providerCalls: Array.from(providerCallsByTaskId.values()).reduce((sum, count) => sum + count, 0),
      promotionAllowed: finalState.summary.promotionAllowed,
      lateReturnStatus: lateCandidate.status,
      retryConcurrency: retryConcurrencyPolicy.retryConcurrency,
      retryRunnableCount: retryRunnable.length,
      receiptCandidateHasRequiredFields: Boolean(
        firstReceiptCandidate?.inputHash &&
          firstReceiptCandidate.permissionReceiptId &&
          firstReceiptCandidate.expectedOutputPath &&
          firstReceiptCandidate.shotId
      ),
      referenceEditMaxConcurrency: referenceEditPolicy.maxConcurrency,
      referenceEditReturnStatus: referenceEditReturnSummary.status,
      referenceEditLateReturnStatus: referenceEditLateItem.status,
      imageGeneratePartialStatus: partialImageGenerateSummary.status,
    },
    null,
    2,
  ),
);
