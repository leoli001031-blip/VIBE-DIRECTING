import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  createProviderRetrySchedulerState,
  ingestLateProviderReturn,
  runMockProviderRetryScheduler,
  type ProviderRetryAttempt,
  type ProviderRetryTask,
} from "../src/core/providerRetryScheduler";
import {
  buildReferenceEditRetryPolicy,
  classifyLateReferenceEditReturn,
  getReferenceEditReleasePolicy,
  summarizeReferenceEditReturns,
  validateReferenceEditRequestPolicy,
} from "../src/core/referenceEditPolicy";
import type { Image2AdapterRequest, Image2ReferenceImageInput } from "../src/core/types";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function lockedInput(overrides: Partial<Image2ReferenceImageInput> = {}): Image2ReferenceImageInput {
  return {
    inputId: "locked-character-reference",
    role: "locked_character_reference",
    path: "assets/locked/character.png",
    source: "locked_asset",
    required: true,
    mustUseAsVisualInput: true,
    status: "available",
    notes: ["locked reference must be attached as image input"],
    ...overrides,
  };
}

function request(overrides: Partial<Image2AdapterRequest> = {}): Image2AdapterRequest {
  return {
    requestId: "reference-edit-request",
    taskPlanId: "reference-edit-task-plan",
    adapterId: "openai-image2-api-dry-run",
    operation: "image2image",
    frameRole: "reference_asset",
    payload: {
      sourceIntent: ["edit the image using the locked reference only"],
      mustPreserve: ["identity", "composition"],
      mustAvoid: ["text-only redraw"],
      references: [{ referenceId: "locked-character-reference", source: "prompt_plan" }],
      referenceImageInputs: [lockedInput()],
      outputPath: "outputs/reference-edit.png",
    },
    submitPolicy: {
      dry_run_only: true,
      manual_submit_required: true,
      live_submit_forbidden: true,
    },
    forbiddenFallbacks: ["provider_or_mode_fallback", "image2image_to_text2image", "reference_edit_to_text2image"],
    ...overrides,
  };
}

function task(id: string, priority: number): ProviderRetryTask {
  return {
    taskId: `reference-edit-${id}`,
    shotId: id,
    inputHash: sha256(`input:${id}`),
    permissionReceiptId: `permission-${id}`,
    expectedOutputPath: `outputs/${id}/reference-edit.png`,
    priority,
  };
}

const releasePolicy = getReferenceEditReleasePolicy();
assert.equal(releasePolicy.lockedReferenceOnly, true, "reference edit policy must require locked references");
assert.equal(releasePolicy.textToImageFallbackAllowed, false, "reference edit policy must forbid text2image fallback");
assert.equal(releasePolicy.defaultConcurrency, 3, "reference edit default concurrency must be 3");
assert.equal(releasePolicy.maxConcurrency, 3, "reference edit max concurrency must be 3");
assert.equal(releasePolicy.promotionAllowed, false, "reference edit policy must never promote");

const retryPolicy = buildReferenceEditRetryPolicy({ maxConcurrency: 99, maxAutoRetries: 1, baseDelayMs: 1, maxDelayMs: 1 });
assert.equal(retryPolicy.maxConcurrency, 3, "reference edit retry policy must clamp max concurrency to 3");
assert.equal(retryPolicy.maxAutoRetries, 1, "reference edit retry policy should preserve explicit retry budget");

const validCheck = validateReferenceEditRequestPolicy(request());
assert.equal(validCheck.valid, true, "locked image2image request should satisfy reference edit policy");
assert.deepEqual(validCheck.blockers, [], "valid request should not carry blockers");

const candidateCheck = validateReferenceEditRequestPolicy(
  request({
    payload: {
      ...request().payload,
      referenceImageInputs: [lockedInput({ source: "candidate_asset" })],
    },
  }),
);
assert.equal(candidateCheck.valid, false, "candidate references must be blocked");
assert.ok(candidateCheck.blockers.includes("reference_image_input_0_not_locked_reference"), "candidate blocker missing");

const fallbackCheck = validateReferenceEditRequestPolicy(
  request({
    operation: "text2image",
    forbiddenFallbacks: ["provider_or_mode_fallback"],
  }),
);
assert.equal(fallbackCheck.valid, false, "text2image fallback path must be blocked");
assert.ok(fallbackCheck.blockers.includes("reference_edit_requires_image2image_operation"), "image2image blocker missing");
assert.ok(fallbackCheck.blockers.includes("image2image_to_text2image_must_be_forbidden"), "fallback blocker missing");

const tasks = [task("R5A", 3), task("R5B", 2), task("R5C", 1), task("R5D", 0)];
const generatedAt = "2026-05-18T00:00:00.000Z";
const initialState = createProviderRetrySchedulerState({ tasks, policy: retryPolicy, generatedAt });
const firstBatch = initialState.attempts.filter((attempt) => attempt.status === "queued").slice(0, retryPolicy.maxConcurrency);
assert.equal(firstBatch.length, 3, "fixture should have three first-batch attempts");

const finalState = runMockProviderRetryScheduler({
  state: initialState,
  startAt: generatedAt,
  provider: (attempt: ProviderRetryAttempt, providerTask: ProviderRetryTask) => {
    if (providerTask.shotId === "R5A" || providerTask.shotId === "R5B") {
      return {
        status: "success",
        providerRequestId: `provider-${attempt.attemptId}`,
        outputPath: providerTask.expectedOutputPath,
        outputSha256: sha256(`output:${providerTask.taskId}`),
      };
    }
    return {
      status: "missing",
      failureKind: "provider_missing",
      message: "provider did not return the reference edit",
    };
  },
});

assert.equal(finalState.summary.maxObservedConcurrency, 3, "scheduler should exercise reference edit concurrency=3");
assert.equal(finalState.summary.promotionAllowed, false, "scheduler summary must never allow promotion");

const returnSummary = summarizeReferenceEditReturns(finalState);
assert.equal(returnSummary.status, "partial_return", "mixed success/missing must be partial_return");
assert.equal(returnSummary.requestedCount, 4, "all reference edits should be tracked");
assert.equal(returnSummary.returnedCount, 2, "two provider returns should be counted");
assert.equal(returnSummary.needsReviewCount, 2, "returned outputs must require review");
assert.equal(returnSummary.missingCount, 2, "missing outputs should remain missing");
assert.equal(returnSummary.promotionAllowed, false, "partial return must not promote");
assert.deepEqual(
  new Set(returnSummary.items.map((item) => item.status)),
  new Set(["needs_review", "missing"]),
  "partial return items may only be needs_review or missing",
);
assert.ok(returnSummary.items.every((item) => item.promotionAllowed === false), "no item may promote");

const missingAttempt = finalState.attempts.find((attempt) => attempt.taskId === "reference-edit-R5C" && attempt.attemptNumber === 1);
assert.ok(missingAttempt, "missing task should retain attempt evidence");
const lateCandidate = ingestLateProviderReturn(finalState, {
  attemptId: missingAttempt.attemptId,
  outputPath: "late/R5C/reference-edit.png",
  outputSha256: sha256("late:R5C"),
});
const lateItem = classifyLateReferenceEditReturn(lateCandidate);
assert.equal(lateItem.status, "needs_review", "late return must become needs_review");
assert.equal(lateItem.providerReturned, true, "late return should be marked returned");
assert.equal(lateItem.promotionAllowed, false, "late return must not promote");

console.log(
  JSON.stringify(
    {
      status: "reference_edit_policy_passed",
      defaultConcurrency: releasePolicy.defaultConcurrency,
      maxConcurrency: retryPolicy.maxConcurrency,
      maxObservedConcurrency: finalState.summary.maxObservedConcurrency,
      returnStatus: returnSummary.status,
      returnedCount: returnSummary.returnedCount,
      missingCount: returnSummary.missingCount,
      lateReturnStatus: lateItem.status,
      promotionAllowed: returnSummary.promotionAllowed,
    },
    null,
    2,
  ),
);
