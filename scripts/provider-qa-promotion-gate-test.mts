import {
  applyProjectVibeTransaction,
  buildProjectVibeReviewPromotionTransaction,
  createProjectVibe,
  hashProjectVibeFacts,
} from "../src/project/index.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const project = createProjectVibe({
  projectId: "provider_qa_promotion_gate",
  title: "Provider QA Promotion Gate",
  createdAt: "2026-05-18T02:00:00.000Z",
  updatedAt: "2026-05-18T02:00:00.000Z",
  storyFlow: {
    id: "story_flow_review_gate",
    sections: [{ id: "section_review_gate", title: "Review Gate", summary: "Review gate contract.", sequenceIndex: 0, shotIds: ["S01"] }],
    shotOrder: ["S01"],
  },
  shots: [{
    id: "S01",
    sectionId: "section_review_gate",
    title: "Review gate shot",
    intent: "Prove review decisions before promotion.",
    sceneAssetIds: [],
    characterAssetIds: [],
    propAssetIds: [],
    durationSeconds: 4,
    status: "planned",
    sourceRefs: ["test:review_gate"],
  }],
});
const sourceFactHash = hashProjectVibeFacts(project);
const projectWithBatch = applyProjectVibeTransaction(project, {
  id: "txn_review_gate_batch_receipt",
  actor: "system",
  reason: "Record returned and missing outputs before review.",
  createdAt: "2026-05-18T02:00:10.000Z",
  operations: [{
    op: "append_batch_receipt",
    receipt: {
      id: "batch_review_gate_001",
      createdAt: "2026-05-18T02:00:10.000Z",
      batchId: "batch_review_gate",
      status: "partial",
      sourceFactHash,
      affectedShotIds: ["S01"],
      taskEnvelopeIds: ["task_S01"],
      attemptIds: ["attempt_S01"],
      returnedOutputCount: 1,
      missingOutputCount: 1,
      outputHashes: ["sha256:return-s01"],
      evidenceRefs: ["providerObservation#attempt_S01"],
      providerSelfReportCanPromote: false,
      projectFactsMutated: false,
      runtimeFixtureUsed: false,
    },
  }],
});
assert(projectWithBatch.receipt.status === "applied", `batch receipt should apply: ${projectWithBatch.receipt.errors.join("; ")}`);

const approved = buildProjectVibeReviewPromotionTransaction({
  project: projectWithBatch.project,
  candidate: {
    shotId: "S01",
    outputPath: "outputs/images/S01.png",
    outputHash: "sha256:return-s01",
    sourceReceiptId: "batch_review_gate_001",
    providerSelfReportedSuccess: true,
  },
  decision: {
    status: "approved",
    humanReviewed: true,
    reviewerId: "human_reviewer",
    reviewedAt: "2026-05-18T02:01:00.000Z",
    promotionTarget: "asset_and_locked_visual_memory",
    promotionAuthorization: {
      authorized: true,
      authorizedBy: "human_reviewer",
      authorizedAt: "2026-05-18T02:01:05.000Z",
    },
  },
});
assert(approved.status === "staged", `approved output should stage promotion: ${approved.blockers.join("; ")}`);
assert(approved.promotionOperationCount === 2, "approved output should stage asset plus locked visual memory");
assert(approved.providerSelfReportIgnored === true, "provider self-report must be ignored");

const rejected = buildProjectVibeReviewPromotionTransaction({
  project: projectWithBatch.project,
  candidate: {
    shotId: "S01",
    outputPath: "outputs/images/S01-rejected.png",
    outputHash: "sha256:reject-s01",
    sourceReceiptId: "batch_review_gate_001",
  },
  decision: {
    status: "rejected",
    humanReviewed: true,
    reviewerId: "human_reviewer",
    reviewedAt: "2026-05-18T02:02:00.000Z",
    promotionTarget: "review_receipt_only",
  },
});
assert(rejected.status === "staged", `rejected output should stage review history only: ${rejected.blockers.join("; ")}`);
assert(rejected.transaction?.operations.length === 1, "rejected output must not stage promotion operations");

const retry = buildProjectVibeReviewPromotionTransaction({
  project: projectWithBatch.project,
  candidate: {
    shotId: "S01",
    missingOutput: true,
    sourceReceiptId: "batch_review_gate_001",
  },
  decision: {
    status: "retry_requested",
    humanReviewed: true,
    reviewerId: "human_reviewer",
    reviewedAt: "2026-05-18T02:03:00.000Z",
    retryRequested: true,
    promotionTarget: "review_receipt_only",
  },
});
assert(retry.status === "staged", `missing output retry should stage per-shot review history: ${retry.blockers.join("; ")}`);
assert(retry.reviewReceipt.shotId === "S01" && retry.reviewReceipt.retryRequested === true, "retry must be per-shot");
assert(retry.promotionOperationCount === 0, "retry must not promote");

const late = buildProjectVibeReviewPromotionTransaction({
  project: projectWithBatch.project,
  candidate: {
    shotId: "S01",
    outputPath: "outputs/images/S01-late.png",
    outputHash: "sha256:late-s01",
    sourceReceiptId: "batch_review_gate_001",
    lateOutput: true,
  },
  decision: {
    status: "approved",
    humanReviewed: true,
    reviewerId: "human_reviewer",
    reviewedAt: "2026-05-18T02:04:00.000Z",
    promotionTarget: "asset_and_locked_visual_memory",
    promotionAuthorization: {
      authorized: true,
      authorizedBy: "human_reviewer",
      authorizedAt: "2026-05-18T02:04:05.000Z",
    },
  },
});
assert(late.status === "blocked", "late output cannot directly lock visual memory");
assert(late.blockers.includes("late_output_cannot_promote_directly"), "late output blocker must be explicit");

console.log("provider-qa-promotion-gate-test: review decisions stage safely without provider calls.");
