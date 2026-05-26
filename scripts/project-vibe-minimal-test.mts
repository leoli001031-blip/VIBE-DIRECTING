import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import {
  applyProjectVibeTransaction,
  createProjectVibe,
  hashProjectVibeFacts,
  openProjectVibe,
  parseProjectVibeText,
  projectVibeFileName,
  saveProjectVibe,
  serializeProjectVibe,
  validateProjectVibe,
  buildProjectVibeReviewPromotionTransaction as buildProviderReviewPromotionTransaction,
  type ProjectVibeDocument,
  type ProjectVibeStorageAdapter,
} from "../src/project/index.ts";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function createDiskAdapter(root: string): ProjectVibeStorageAdapter {
  const scopedPath = (path: string) => join(root, path);
  return {
    mkdir(path: string): void {
      mkdirSync(scopedPath(path), { recursive: true });
    },
    readFile(path: string): string {
      return readFileSync(scopedPath(path), "utf8");
    },
    writeFile(path: string, content: string): void {
      mkdirSync(dirname(scopedPath(path)), { recursive: true });
      writeFileSync(scopedPath(path), content, "utf8");
    },
  };
}

const fixturePath = "test-fixtures/projects/agent-loop-minimal/project.vibe";
const fixtureText = readFileSync(fixturePath, "utf8");
const openedFixture = parseProjectVibeText(fixtureText);

assert(openedFixture.ok, `fixture should open: ${openedFixture.errors.join("; ")}`);
assert(openedFixture.project !== undefined, "fixture project missing");

const project = openedFixture.project as ProjectVibeDocument;
assert(project.receipts === undefined, "legacy fixture should remain compatible without optional receipt sections");
const beforeHash = hashProjectVibeFacts(project);
const targetShot = project.shots.find((shot) => shot.id === "shot_002");

assert(targetShot !== undefined, "fixture must include shot_002");
assert(project.manifest.runtimeFixtureAuthority === false, "runtime fixture cannot be Project.vibe authority");
assert(project.visualMemory.referencePolicy.runtimeFixturesMayBecomeAuthority === false, "runtime fixtures cannot become visual authority");

const patched = applyProjectVibeTransaction(project, {
  id: "txn_minimal_agent_loop_prop_lock",
  actor: "agent_loop",
  reason: "Lock a prop fact from the Agent Loop planning pass.",
  createdAt: "2026-05-15T01:00:00.000Z",
  operations: [
    {
      op: "upsert_asset",
      asset: {
        id: "asset_prop_radio",
        kind: "prop",
        label: "Weather Radio",
        status: "locked",
        path: "assets/locked/prop_radio.md",
        textConstraints: ["small red weather radio", "scratched antenna", "warm indicator light"],
        usedByShotIds: ["shot_002"],
        sourceRefs: ["agent_loop:minimal_planning"],
        lockedBy: "agent_loop",
        roleBinding: {
          role: "prop_reference",
          useFor: ["object appearance", "scale", "hand placement"],
          ignoreFor: ["character identity", "scene geography", "camera path"],
          priority: 40,
          conflictRule: "Weather Radio only controls prop appearance and interaction.",
        },
      },
    },
    {
      op: "upsert_shot",
      shot: {
        ...targetShot,
        propAssetIds: ["asset_prop_radio"],
        sourceRefs: [...targetShot.sourceRefs, "project.vibe#assets/asset_prop_radio"],
      },
    },
    {
      op: "append_run_receipt",
      run: {
        id: "run_minimal_agent_loop_001",
        runKind: "agent_loop",
        status: "succeeded",
        createdAt: "2026-05-15T01:00:00.000Z",
        summary: "Agent Loop planned a prop lock without using runtime fixture authority.",
        sourceFactHash: beforeHash,
        affectedShotIds: ["shot_002"],
        producedAssetIds: ["asset_prop_radio"],
        evidenceRefs: ["project.vibe#shots/shot_002", "project.vibe#assets/asset_prop_radio"],
        projectFactsMutated: true,
        runtimeFixtureUsed: false,
      },
    },
  ],
});

assert(patched.receipt.status === "applied", `transaction should apply: ${patched.receipt.errors.join("; ")}`);
assert(patched.receipt.runtimeFixtureUsed === false, "transaction receipt must not depend on runtime fixtures");
assert(patched.receipt.afterFactHash !== beforeHash, "fact hash should change after patch");
assert(patched.project.runs.length === 1, "patched project should carry one run receipt");
assert(
  patched.project.assets.find((asset) => asset.id === "asset_prop_radio")?.roleBinding?.ignoreFor.includes("camera path"),
  "Project.vibe assets should preserve reference role binding use-ignore semantics",
);

const tempRoot = mkdtempSync(join(tmpdir(), "project-vibe-minimal-"));
try {
  const adapter = createDiskAdapter(tempRoot);
  const saveResult = await saveProjectVibe(adapter, patched.project, projectVibeFileName);
  assert(saveResult.ok, `save should pass: ${saveResult.errors.join("; ")}`);

  const reopened = await openProjectVibe(adapter, projectVibeFileName);
  assert(reopened.ok, `reopen should pass: ${reopened.errors.join("; ")}`);
  assert(reopened.project !== undefined, "reopened project missing");
  assert(hashProjectVibeFacts(reopened.project) === hashProjectVibeFacts(patched.project), "roundtrip fact hash drifted");
  assert(serializeProjectVibe(reopened.project) === serializeProjectVibe(patched.project), "roundtrip serialization drifted");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

const created = createProjectVibe({
  projectId: "created_minimal_agent_loop",
  title: "Created Minimal Agent Loop",
  createdAt: "2026-05-15T02:00:00.000Z",
});
const createdValidation = validateProjectVibe(created);

assert(createdValidation.ok, `created project should validate: ${createdValidation.errors.join("; ")}`);
assert(parseProjectVibeText(serializeProjectVibe(created)).ok, "created project should serialize and parse");
assert(!parseProjectVibeText("{\"kind\":\"project_vibe_document\"}").ok, "malformed Project.vibe should fail closed");

const receiptProject = createProjectVibe({
  projectId: "receipt_complete_project",
  title: "Receipt Complete Project",
  createdAt: "2026-05-18T01:00:00.000Z",
  updatedAt: "2026-05-18T01:00:00.000Z",
  storyFlow: {
    id: "story_flow_receipts",
    sections: [{ id: "section_receipts", title: "Receipts", summary: "Receipt coverage.", sequenceIndex: 0, shotIds: ["shot_receipt"] }],
    shotOrder: ["shot_receipt"],
  },
  shots: [{
    id: "shot_receipt",
    sectionId: "section_receipts",
    title: "Receipt Shot",
    intent: "A shot with durable planning and review receipts.",
    sceneAssetIds: [],
    characterAssetIds: [],
    propAssetIds: [],
    durationSeconds: 4,
    status: "planned",
    sourceRefs: ["fixture:receipt"],
  }],
});
const receiptProjectHash = hashProjectVibeFacts(receiptProject);
const receiptPatch = applyProjectVibeTransaction(receiptProject, {
  id: "txn_receipt_sections",
  actor: "system",
  reason: "Append durable planning, batch, and review receipts.",
  createdAt: "2026-05-18T01:02:00.000Z",
  operations: [
    {
      op: "append_script_planning_receipt",
      receipt: {
        id: "script_receipt_001",
        kind: "script_planning",
        createdAt: "2026-05-18T01:01:00.000Z",
        plannerId: "script_planner",
        sourceFactHash: receiptProjectHash,
        scriptBriefId: "brief_001",
        sectionIds: ["section_receipts"],
        shotIds: ["shot_receipt"],
        blockerCount: 0,
        evidenceRefs: ["scriptPlanner#brief_001"],
        providerSelfReportUsed: false,
        runtimeFixtureUsed: false,
      },
    },
    {
      op: "append_prompt_keyframe_planning_receipt",
      receipt: {
        id: "prompt_keyframe_receipt_001",
        kind: "prompt_keyframe_planning",
        createdAt: "2026-05-18T01:01:10.000Z",
        plannerId: "project_vibe_planning_projection",
        sourceFactHash: receiptProjectHash,
        affectedShotIds: ["shot_receipt"],
        promptPlanIds: ["prompt_plan_shot_receipt_start", "prompt_plan_shot_receipt_end"],
        keyframePlanIds: ["keyframe_shot_receipt_start", "keyframe_shot_receipt_end"],
        inputHash: "prompt_input_hash_001",
        outputPlanHash: "prompt_output_hash_001",
        evidenceRefs: ["planningProjection#shot_receipt"],
        rawProviderPromptStoredAsFact: false,
        providerSelfReportUsed: false,
        runtimeFixtureUsed: false,
      },
    },
    {
      op: "append_batch_receipt",
      receipt: {
        id: "batch_receipt_001",
        createdAt: "2026-05-18T01:01:20.000Z",
        batchId: "batch_001",
        status: "partial",
        sourceFactHash: receiptProjectHash,
        permissionReceiptId: "permission_001",
        providerId: "lanyi-image2",
        taskEnvelopeIds: ["task_envelope_001"],
        affectedShotIds: ["shot_receipt"],
        attemptIds: ["attempt_001"],
        returnedOutputCount: 1,
        missingOutputCount: 1,
        outputHashes: ["sha256:receipt-output"],
        evidenceRefs: ["providerObservation#attempt_001"],
        providerSelfReportCanPromote: false,
        projectFactsMutated: false,
        runtimeFixtureUsed: false,
      },
    },
    {
      op: "append_review_receipt",
      receipt: {
        id: "review_receipt_needs_review_001",
        createdAt: "2026-05-18T01:01:30.000Z",
        status: "needs_review",
        humanReviewed: false,
        shotId: "shot_receipt",
        sourceReceiptId: "batch_receipt_001",
        outputPath: "outputs/images/shot_receipt.png",
        outputHash: "sha256:receipt-output",
        retryRequested: false,
        lateOutput: false,
        providerSelfReportIgnored: true,
        promotionAuthorized: false,
        evidenceRefs: ["providerObservation#attempt_001"],
        blockers: ["human_review_required"],
      },
    },
  ],
});

assert(receiptPatch.receipt.status === "applied", `receipt patch should apply: ${receiptPatch.receipt.errors.join("; ")}`);
assert(receiptPatch.project.receipts?.scriptPlanningReceipts.length === 1, "script planning receipt should persist");
assert(receiptPatch.project.receipts?.promptKeyframePlanningReceipts.length === 1, "prompt/keyframe planning receipt should persist");
assert(receiptPatch.project.receipts?.batchReceipts.length === 1, "batch receipt should persist");
assert(receiptPatch.project.receipts?.reviewReceipts.length === 1, "review receipt should persist");
assert(receiptPatch.project.sourceIndex.scriptPlanningReceiptRefs?.includes("project.vibe#receipts/scriptPlanning/script_receipt_001"), "source index should include script planning receipt refs");
assert(receiptPatch.project.sourceIndex.reviewReceiptRefs?.includes("project.vibe#receipts/reviews/review_receipt_needs_review_001"), "source index should include review receipt refs");

const blockedProviderPromotion = buildProviderReviewPromotionTransaction({
  project: receiptPatch.project,
  candidate: {
    shotId: "shot_receipt",
    outputPath: "outputs/images/shot_receipt.png",
    sourceReceiptId: "batch_receipt_001",
    providerSelfReportedSuccess: true,
  },
  decision: {
    status: "approved",
    humanReviewed: true,
    reviewerId: "human_reviewer",
    reviewedAt: "2026-05-18T01:03:00.000Z",
    promotionTarget: "asset_and_locked_visual_memory",
    promotionAuthorization: {
      authorized: true,
      authorizedBy: "human_reviewer",
      authorizedAt: "2026-05-18T01:03:10.000Z",
    },
  },
});
assert(blockedProviderPromotion.status === "blocked", "approved promotion without output hash must block");
assert(blockedProviderPromotion.blockers.includes("output_hash_required"), "missing hash blocker should be explicit");
assert(blockedProviderPromotion.providerSelfReportIgnored === true, "provider self-report must be ignored");
assert(!blockedProviderPromotion.transaction, "blocked provider promotion must not stage Project.vibe writes");

const approvedPromotion = buildProviderReviewPromotionTransaction({
  project: receiptPatch.project,
  candidate: {
    shotId: "shot_receipt",
    outputPath: "outputs/images/shot_receipt.png",
    outputHash: "sha256:approved-output",
    sourceReceiptId: "batch_receipt_001",
    sourceRunId: "run_provider_001",
    providerSelfReportedSuccess: true,
    evidenceRefs: ["providerObservation#attempt_001", "semanticQa#shot_receipt"],
  },
  decision: {
    status: "approved",
    humanReviewed: true,
    reviewerId: "human_reviewer",
    reviewedAt: "2026-05-18T01:04:00.000Z",
    promotionTarget: "asset_and_locked_visual_memory",
    assetKind: "reference",
    assetLabel: "Approved receipt output",
    textConstraints: ["human approved output hash sha256:approved-output"],
    promotionAuthorization: {
      authorized: true,
      authorizedBy: "human_reviewer",
      authorizedAt: "2026-05-18T01:04:10.000Z",
    },
  },
});
assert(approvedPromotion.status === "staged", `approved promotion should stage: ${approvedPromotion.blockers.join("; ")}`);
assert(approvedPromotion.transaction, "approved promotion should return a staged transaction");
assert(approvedPromotion.promotionOperationCount === 2, "approved promotion should stage asset and locked visual memory operations");
assert(
  approvedPromotion.transaction.operations.some((operation) => operation.op === "append_review_receipt") &&
    approvedPromotion.transaction.operations.some((operation) => operation.op === "upsert_asset") &&
    approvedPromotion.transaction.operations.some((operation) => operation.op === "set_visual_memory"),
  "approved promotion should append review receipt and stage formal fact operations",
);
const promotedPatch = applyProjectVibeTransaction(receiptPatch.project, approvedPromotion.transaction);
assert(promotedPatch.receipt.status === "applied", `approved promotion transaction should apply: ${promotedPatch.receipt.errors.join("; ")}`);
const promotedAsset = promotedPatch.project.assets.find((asset) => asset.id === "asset_shot_receipt");
assert(promotedAsset?.status === "locked", "approved output should promote to a locked asset");
assert(promotedAsset.lockedBy === "user", "approved output should be locked by user review");
assert(promotedPatch.project.visualMemory.entries.some((entry) => entry.assetId === "asset_shot_receipt" && entry.canUseAsFutureReference), "approved output should become locked visual memory");
assert(promotedPatch.project.receipts?.reviewReceipts.some((receipt) => receipt.id === approvedPromotion.reviewReceipt.id && receipt.providerSelfReportIgnored), "approved review receipt should persist and ignore provider self-report");

const missingReview = buildProviderReviewPromotionTransaction({
  project: promotedPatch.project,
  candidate: {
    shotId: "shot_receipt",
    missingOutput: true,
    sourceReceiptId: "batch_receipt_001",
    providerSelfReportedSuccess: true,
  },
  decision: {
    status: "retry_requested",
    humanReviewed: true,
    reviewerId: "human_reviewer",
    reviewedAt: "2026-05-18T01:05:00.000Z",
    retryRequested: true,
    promotionTarget: "review_receipt_only",
  },
});
assert(missingReview.status === "staged", `retry review should stage review history only: ${missingReview.blockers.join("; ")}`);
assert(missingReview.transaction?.operations.length === 1, "missing/retry review must not stage promotion operations");
assert(missingReview.promotionOperationCount === 0, "missing/retry review must not promote locked memory");
assert(missingReview.reviewReceipt.retryRequested === true, "per-shot retry receipt should carry retryRequested");
assert(missingReview.reviewReceipt.shotId === "shot_receipt", "per-shot retry receipt should bind the shot id");

const rejectReview = buildProviderReviewPromotionTransaction({
  project: promotedPatch.project,
  candidate: {
    shotId: "shot_receipt",
    outputPath: "outputs/images/rejected_receipt.png",
    outputHash: "sha256:rejected-output",
    sourceReceiptId: "batch_receipt_001",
    providerSelfReportedSuccess: true,
  },
  decision: {
    status: "rejected",
    humanReviewed: true,
    reviewerId: "human_reviewer",
    reviewedAt: "2026-05-18T01:06:00.000Z",
    promotionTarget: "asset_and_locked_visual_memory",
  },
});
assert(rejectReview.status === "blocked", "rejected review cannot request promotion target");
assert(rejectReview.blockers.includes("review_status_must_be_approved_for_promotion"), "reject promotion blocker should be explicit");
assert(rejectReview.promotionOperationCount === 0, "rejected output must not promote locked memory");

const rejectHistory = buildProviderReviewPromotionTransaction({
  project: promotedPatch.project,
  candidate: {
    shotId: "shot_receipt",
    outputPath: "outputs/images/rejected_receipt.png",
    outputHash: "sha256:rejected-output",
    sourceReceiptId: "batch_receipt_001",
  },
  decision: {
    status: "rejected",
    humanReviewed: true,
    reviewerId: "human_reviewer",
    reviewedAt: "2026-05-18T01:06:10.000Z",
    promotionTarget: "review_receipt_only",
  },
});
assert(rejectHistory.status === "staged", `rejected review history should stage: ${rejectHistory.blockers.join("; ")}`);
assert(rejectHistory.transaction?.operations.length === 1, "rejected review should append review receipt only");

const approveReviewOnly = buildProviderReviewPromotionTransaction({
  project: promotedPatch.project,
  candidate: {
    shotId: "shot_receipt",
    outputPath: "outputs/images/approved_review_only.png",
    outputHash: "sha256:approved-review-only",
    sourceReceiptId: "batch_receipt_001",
  },
  decision: {
    status: "approved",
    humanReviewed: true,
    reviewerId: "human_reviewer",
    reviewedAt: "2026-05-18T01:06:20.000Z",
    promotionTarget: "review_receipt_only",
  },
});
assert(approveReviewOnly.status === "staged", `approve review-only should stage: ${approveReviewOnly.blockers.join("; ")}`);
assert(approveReviewOnly.transaction?.operations.length === 1, "approve review-only should stage only the review receipt");
assert(approveReviewOnly.promotionOperationCount === 0, "approve review-only must not lock visual memory");

const retryWithoutShot = buildProviderReviewPromotionTransaction({
  project: promotedPatch.project,
  candidate: {
    missingOutput: true,
    sourceReceiptId: "batch_receipt_001",
  },
  decision: {
    status: "retry_requested",
    humanReviewed: true,
    reviewerId: "human_reviewer",
    reviewedAt: "2026-05-18T01:06:30.000Z",
    retryRequested: true,
  },
});
assert(retryWithoutShot.status === "blocked", "per-shot retry without shot id must block");
assert(retryWithoutShot.blockers.includes("retry_shot_id_required"), "per-shot retry blocker should be explicit");

const latePromotion = buildProviderReviewPromotionTransaction({
  project: promotedPatch.project,
  candidate: {
    shotId: "shot_receipt",
    outputPath: "outputs/images/late_receipt.png",
    outputHash: "sha256:late-output",
    sourceReceiptId: "batch_receipt_001",
    lateOutput: true,
  },
  decision: {
    status: "approved",
    humanReviewed: true,
    reviewerId: "human_reviewer",
    reviewedAt: "2026-05-18T01:06:40.000Z",
    promotionTarget: "asset_and_locked_visual_memory",
    promotionAuthorization: {
      authorized: true,
      authorizedBy: "human_reviewer",
      authorizedAt: "2026-05-18T01:06:45.000Z",
    },
  },
});
assert(latePromotion.status === "blocked", "late output cannot directly promote to locked visual memory");
assert(latePromotion.blockers.includes("late_output_cannot_promote_directly"), "late output blocker should be explicit");

const invalidLockedMemory = applyProjectVibeTransaction(promotedPatch.project, {
  id: "txn_invalid_locked_memory_from_retry",
  actor: "user",
  reason: "Attempt invalid locked visual memory from retry review.",
  createdAt: "2026-05-18T01:07:00.000Z",
  operations: [
    {
      op: "append_review_receipt",
      receipt: {
        id: "review_retry_invalid_lock",
        createdAt: "2026-05-18T01:07:00.000Z",
        status: "retry_requested",
        humanReviewed: true,
        reviewerId: "human_reviewer",
        shotId: "shot_receipt",
        sourceReceiptId: "batch_receipt_001",
        retryRequested: true,
        lateOutput: false,
        providerSelfReportIgnored: true,
        promotionAuthorized: false,
        evidenceRefs: ["providerObservation#attempt_retry"],
        blockers: ["retry_requested"],
      },
    },
    {
      op: "set_visual_memory",
      visualMemory: {
        ...promotedPatch.project.visualMemory,
        entries: [
          ...promotedPatch.project.visualMemory.entries,
          {
            id: "vm_invalid_retry_lock",
            assetId: "asset_shot_receipt",
            kind: "reference",
            label: "Invalid retry lock",
            status: "locked",
            textConstraints: [],
            usedByShotIds: ["shot_receipt"],
            canUseAsFutureReference: true,
            sourceRefs: ["project.vibe#receipts/reviews/review_retry_invalid_lock"],
          },
        ],
      },
    },
  ],
});
assert(invalidLockedMemory.receipt.status === "rejected", "Project.vibe must reject locked visual memory from retry review");
assert(
  invalidLockedMemory.receipt.errors.some((error) => error.includes("cannot use non-approved review receipt") || error.includes("cannot lock retry-requested")),
  "invalid locked visual memory should explain retry/non-approved review blocker",
);

console.log(
  `Project.vibe minimal tests passed: fixture=${project.manifest.projectId}, before=${beforeHash}, after=${patched.receipt.afterFactHash}, runs=${patched.project.runs.length}, reviewReceipts=${promotedPatch.project.receipts?.reviewReceipts.length}.`,
);
