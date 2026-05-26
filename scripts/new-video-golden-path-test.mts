// NOTE: all tests in this file use mock data only; real provider integration tests are needed to validate end-to-end provider calls, credential handling, and network behavior
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  buildCurrentProjectImage2BatchPlan,
  projectCurrentProjectImage2ProviderRetryScheduler,
  summarizeCurrentProjectImage2BatchExecution,
} from "../src/core/currentProjectImage2Batch.ts";
import { runExportAction } from "../src/core/exportAction.ts";
import { buildLocalPreviewExportProjection } from "../src/core/localPreviewExportProjection.ts";
import {
  buildNewVideoProjectVibeStagedTransaction,
  commitNewVideoProjectVibeStagedTransaction,
} from "../src/core/newVideoProjectVibePlanner.ts";
import {
  appendProviderRetryAttemptResult,
  queueNextProviderRetryBatch,
} from "../src/core/providerRetryScheduler.ts";
import {
  applyProjectVibeTransaction,
  buildProjectVibeReviewPromotionTransaction,
  createProjectVibe,
  hashProjectVibeFacts,
  validateProjectVibe,
  type ProjectVibeDocument,
  type ProjectVibePatchOperation,
} from "../src/project/index.ts";
import type { PreviewQueueItem } from "../src/core/previewPlayerQueue.ts";
import type { ProjectRuntimeState } from "../src/core/projectState.ts";
import type { ShotRecord } from "../src/core/types.ts";

const generatedAt = "2026-05-18T10:00:00.000Z";

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function createEmptyProject(): ProjectVibeDocument {
  return createProjectVibe({
    projectId: "new_video_golden_path",
    title: "New Video Golden Path",
    createdAt: generatedAt,
    updatedAt: generatedAt,
  });
}

function projectShotsAsExportShots(project: ProjectVibeDocument, reviewedOutputByShotId: Map<string, string>): ShotRecord[] {
  return project.shots.map((shot, index) => {
    const outputPath = reviewedOutputByShotId.get(shot.id);
    return {
      id: shot.id,
      actId: `act_${String(index + 1).padStart(2, "0")}`,
      sectionId: shot.sectionId,
      title: shot.title,
      storyFunction: shot.intent,
      startFrame: outputPath,
      status: outputPath ? "assets_ready" : "video_missing",
      gates: {
        identity: outputPath ? "PASS" : "UNKNOWN",
        scene: outputPath ? "PASS" : "UNKNOWN",
        pair: "N/A",
        story: outputPath ? "PASS" : "UNKNOWN",
        prop: "N/A",
        style: outputPath ? "PASS" : "UNKNOWN",
      },
      issues: outputPath ? [] : ["missing_reviewed_image_output"],
    };
  });
}

function runtimeProjectionFixture(project: ProjectVibeDocument): ProjectRuntimeState {
  return {
    generatedAt,
    project: {
      title: project.manifest.title,
      root: "sample-projects/new-video-golden-path",
    },
    taskRuns: {
      jobs: [],
      runs: [],
      taskViews: [],
    },
    manifestMatches: { reports: [] },
    imagePipeline: {
      generationHealthReports: [],
      qaPromotionReports: [],
    },
  } as ProjectRuntimeState;
}

const draft = {
  script: [
    "一名年轻导演在停电后的城市影院里发现一卷没有拍完的胶片。",
    "她想沿着胶片里的线索寻找失踪的放映员，但暴雨、封锁的地下剪辑室和即将拆除的屋顶放映间让她无法继续。",
    "最后她没有复原那部旧电影，而是把未完成的镜头交给新一代观众继续拍下去。",
  ].join(" "),
  style: "克制、低饱和、雨夜霓虹、真实摄影质感",
  references: [
    { type: "image", label: "导演主角参考", file: { name: "local-secret-character.png" }, binding: { role: "年轻导演", scope: "all_shots" } },
    { type: "image", label: "地下剪辑室参考", file: { name: "local-secret-scene.png" }, binding: { scene: "地下剪辑室", scope: "first_shot" } },
    { type: "style", label: "雨夜电影感参考", file: { name: "local-secret-style.jpg" }, binding: { style: "雨夜霓虹真实摄影", scope: "project" } },
  ],
  audio: { name: "local-secret-voice.wav" },
};

const project = createEmptyProject();
const beforeHash = hashProjectVibeFacts(project);
const staged = buildNewVideoProjectVibeStagedTransaction({
  project,
  draft,
  generatedAt,
});

assert.equal(staged.kind, "new_video_project_vibe_staged_transaction_preview");
assert.equal(staged.projectVibeWriteAllowed, false, "draft preview must keep Project.vibe writes locked");
assert.equal(staged.projectFactsMutated, false, "draft preview must not mutate Project.vibe facts");
assert.equal("project" in staged, false, "draft preview must not return a committed Project.vibe document");
assert.equal(staged.blocked, false, `fixture draft should be confirmable: ${staged.blockedReasons.join("; ")}`);
assert.equal(hashProjectVibeFacts(project), beforeHash, "new-video staging must not mutate the source Project.vibe");
assert.equal(project.storyFlow.sections.length, 0, "unconfirmed draft must not write story sections");
assert.equal(project.shots.length, 0, "unconfirmed draft must not write shots");
assert.equal(project.assets.length, 0, "unconfirmed draft must not write assets");
assert.equal(project.receipts?.scriptPlanningReceipts.length || 0, 0, "unconfirmed draft must not write receipts");

const committed = commitNewVideoProjectVibeStagedTransaction({
  project,
  stagedTransaction: staged,
});

assert.equal(committed.status, "applied", `confirmed draft should commit: ${committed.blockedReasons.join("; ")}`);
assert.notEqual(hashProjectVibeFacts(committed.project), beforeHash, "confirmed Project.vibe facts should change");
assert.ok(committed.project.storyFlow.sections.length > 0, "confirmed Project.vibe should contain story sections");
assert.ok(committed.project.storyFlow.shotOrder.length > 0, "confirmed Project.vibe should contain story shot order");
assert.ok(committed.project.shots.length > 0, "confirmed Project.vibe should contain shots");
assert.ok(committed.project.assets.length > 0, "confirmed Project.vibe should contain candidate assets");
assert.ok(
  (committed.project.receipts?.scriptPlanningReceipts.length || 0) > 0,
  "confirmed Project.vibe should contain script planning receipts",
);
const committedSceneReference = committed.project.assets.find((asset) => asset.kind === "scene" && asset.sourceRefs.some((ref) => ref.startsWith("new_video_reference:")));
assert.ok(committedSceneReference, "confirmed Project.vibe should include the scoped scene reference");
assert.equal(committedSceneReference.usedByShotIds.length, 1, "scene reference should keep first-shot scope");
assert.equal(committedSceneReference.usedByShotIds[0], committed.project.shots[0]?.id, "scene reference should bind to the first planned shot");
assert.ok(committed.project.shots[0]?.sceneAssetIds.includes(committedSceneReference.id), "first shot should carry the scoped scene reference");
assert.equal(
  committed.project.shots.slice(1).some((shot) => shot.sceneAssetIds.includes(committedSceneReference.id)),
  false,
  "scene reference should not be bound to every planned shot",
);
assert.equal(
  committed.project.visualMemory.entries.find((entry) => entry.assetId === committedSceneReference.id)?.usedByShotIds.length,
  1,
  "visual memory should mirror scoped scene reference binding",
);
assert.ok(validateProjectVibe(committed.project).ok, "confirmed Project.vibe should validate");

const selectedShots = committed.project.storyFlow.shotOrder.slice(0, 2);
assert.ok(selectedShots.length >= 2, "golden-path fixture should plan at least two shots");

const imagePlan = buildCurrentProjectImage2BatchPlan({
  projectId: committed.project.manifest.projectId,
  runId: "golden_path_image_plan",
  projectRoot: "sample-projects/new-video-golden-path",
  selectedShotIds: selectedShots,
  generatedAt,
  references: {
    character: {
      id: "locked_character_ref",
      path: "sample-projects/new-video-golden-path/assets/locked/character.png",
      locked: true,
    },
    scene: {
      id: "locked_scene_ref",
      path: "sample-projects/new-video-golden-path/assets/locked/cinema.png",
      locked: true,
    },
    style: {
      id: "locked_style_ref",
      path: "sample-projects/new-video-golden-path/assets/locked/rain-neon-style.png",
      locked: true,
    },
  },
});

assert.equal(imagePlan.status, "ready_for_review", `image plan should be review-ready: ${imagePlan.blockers.join("; ")}`);
assert.equal(imagePlan.submitPolicy.providerCallAllowed, false, "image plan must not allow provider calls");
assert.equal(imagePlan.submitPolicy.dryRunOnly, true, "image plan must stay dry-run only");
assert.equal(imagePlan.policyProjection.promotionAllowed, false, "image plan must not allow promotion");
assert.equal(imagePlan.policyProjection.imageGenerate.successfulReturnStatus, "needs_review");
assert.equal(imagePlan.policyProjection.imageGenerate.missingReturnStatus, "missing");

const retryScheduler = projectCurrentProjectImage2ProviderRetryScheduler(imagePlan, { generatedAt });
assert.equal(retryScheduler.mode, "planning_only_retry_scheduler_projection");
assert.equal(retryScheduler.providerCalled, false, "retry scheduler projection must not call providers");
assert.equal(retryScheduler.promotionAllowed, false, "retry scheduler projection must not allow promotion");

let schedulerState = retryScheduler.schedulerState;
const runnable = queueNextProviderRetryBatch(schedulerState, generatedAt);
// NOTE: this assertion assumes the mock data produces at least 2 runnable items; the test will silently pass if the fixture changes to produce fewer
assert.ok(runnable.length >= 2, "mock Image2 execution should have at least two runnable attempts");

schedulerState = appendProviderRetryAttemptResult(
  schedulerState,
  runnable[0].attemptId,
  {
    status: "success",
    providerRequestId: `mock-${runnable[0].attemptId}`,
    outputPath: runnable[0].expectedOutputPath,
    outputSha256: sha256(`${runnable[0].taskId}:output`),
  },
  "2026-05-18T10:00:01.000Z",
);
schedulerState = appendProviderRetryAttemptResult(
  schedulerState,
  runnable[1].attemptId,
  {
    status: "failure",
    failureKind: "validation_error",
    message: "mock missing final output without provider side effects",
  },
  "2026-05-18T10:00:01.000Z",
);

const executionSummary = summarizeCurrentProjectImage2BatchExecution(schedulerState);
assert.equal(executionSummary.status, "completed_with_missing", "mock execution should settle as reviewable partial return");
assert.equal(executionSummary.returnedCount, 1, "mock execution should have one returned output");
assert.equal(executionSummary.missingCount, 1, "mock execution should have one missing output");
assert.equal(executionSummary.needsReviewCount, 1, "returned output must require review");
assert.equal(executionSummary.promotionAllowed, false, "mock Image2 execution must not auto-promote");
assert.equal(executionSummary.missingCanPromote, false, "missing Image2 outputs must not promote");
assert.ok(
  executionSummary.items.every((item) => item.status === "needs_review" || item.status === "missing" || item.status === "blocked"),
  "Image2 execution may only project needs_review/missing/blocked states",
);

const returnedItem = executionSummary.items.find((item) => item.status === "needs_review");
const missingItem = executionSummary.items.find((item) => item.status === "missing");
assert.ok(returnedItem, "fixture should include a needs_review item");
assert.ok(missingItem, "fixture should include a missing item");

const afterImageReceiptHash = hashProjectVibeFacts(committed.project);
const receiptOperations: ProjectVibePatchOperation[] = [
  {
    op: "append_run_receipt",
    run: {
      id: "run_golden_path_image_plan",
      runKind: "qa",
      status: "succeeded",
      createdAt: "2026-05-18T10:00:02.000Z",
      summary: "Mock Image2 plan produced review and missing states without provider promotion.",
      sourceFactHash: afterImageReceiptHash,
      affectedShotIds: selectedShots,
      producedAssetIds: [],
      evidenceRefs: ["image_plan:golden_path_image_plan"],
      projectFactsMutated: false,
      runtimeFixtureUsed: false,
    },
  },
  {
    op: "append_batch_receipt",
    receipt: {
      id: "batch_golden_path_image_plan",
      createdAt: "2026-05-18T10:00:02.000Z",
      batchId: imagePlan.runId,
      status: "partial",
      sourceFactHash: afterImageReceiptHash,
      taskEnvelopeIds: imagePlan.items.map((item) => item.envelopeId),
      affectedShotIds: selectedShots,
      attemptIds: schedulerState.attempts.map((attempt) => attempt.attemptId),
      returnedOutputCount: executionSummary.returnedCount,
      missingOutputCount: executionSummary.missingCount,
      outputHashes: executionSummary.items.flatMap((item) => item.outputSha256 ? [item.outputSha256] : []),
      evidenceRefs: ["retry_scheduler:golden_path_image_plan"],
      providerSelfReportCanPromote: false,
      projectFactsMutated: false,
      runtimeFixtureUsed: false,
    },
  },
  {
    op: "append_review_receipt",
    receipt: {
      id: "review_golden_path_needs_review",
      createdAt: "2026-05-18T10:00:03.000Z",
      status: "needs_review",
      humanReviewed: false,
      shotId: returnedItem.shotId,
      sourceReceiptId: "batch_golden_path_image_plan",
      outputPath: returnedItem.outputPath,
      outputHash: returnedItem.outputSha256,
      retryRequested: false,
      lateOutput: false,
      providerSelfReportIgnored: true,
      promotionAuthorized: false,
      evidenceRefs: [`attempt:${returnedItem.attemptId}`],
      blockers: ["human_review_required", "lock_gate_pending"],
    },
  },
  {
    op: "append_review_receipt",
    receipt: {
      id: "review_golden_path_missing",
      createdAt: "2026-05-18T10:00:03.000Z",
      status: "missing",
      humanReviewed: false,
      shotId: missingItem.shotId,
      sourceReceiptId: "batch_golden_path_image_plan",
      retryRequested: false,
      lateOutput: false,
      providerSelfReportIgnored: true,
      promotionAuthorized: false,
      evidenceRefs: [`task:${missingItem.taskId}`],
      blockers: ["provider_return_missing", "lock_gate_pending"],
    },
  },
];
const reviewedProjectPatch = applyProjectVibeTransaction(committed.project, {
  id: "txn_golden_path_review_receipts",
  actor: "system",
  reason: "Record mock Image2 review gate receipts without promotion.",
  createdAt: "2026-05-18T10:00:04.000Z",
  operations: receiptOperations,
});

assert.equal(reviewedProjectPatch.receipt.status, "applied", `review receipts should apply: ${reviewedProjectPatch.receipt.errors.join("; ")}`);
const reviewedProject = reviewedProjectPatch.project;
assert.equal(reviewedProject.receipts?.batchReceipts.length, 1, "Project.vibe should persist the Image2 batch receipt");
assert.equal(reviewedProject.receipts?.reviewReceipts.length, 2, "Project.vibe should persist needs_review and missing review receipts");
assert.ok(
  reviewedProject.receipts?.reviewReceipts.every((receipt) => receipt.promotionAuthorized === false),
  "review receipts should not authorize promotion automatically",
);
assert.equal(
  reviewedProject.assets.filter((asset) => asset.status === "locked" && asset.sourceRefs.some((ref) => ref.includes("review_golden_path"))).length,
  0,
  "needs_review/missing outputs must not become locked assets",
);

const blockedAutoLock = buildProjectVibeReviewPromotionTransaction({
  project: reviewedProject,
  candidate: {
    shotId: returnedItem.shotId,
    outputPath: returnedItem.outputPath,
    outputHash: returnedItem.outputSha256,
    sourceReceiptId: "batch_golden_path_image_plan",
    providerSelfReportedSuccess: true,
  },
  decision: {
    status: "approved",
    humanReviewed: true,
    reviewerId: "human_reviewer",
    reviewedAt: "2026-05-18T10:00:05.000Z",
    promotionTarget: "asset_and_locked_visual_memory",
  },
});
assert.equal(blockedAutoLock.status, "blocked", "lock gate should block promotion without explicit authorization");
assert.ok(blockedAutoLock.blockers.includes("explicit_promotion_authorization_required"), "lock gate should name missing authorization");
assert.equal(blockedAutoLock.transaction, undefined, "blocked lock gate must not stage Project.vibe promotion writes");
assert.equal(blockedAutoLock.providerSelfReportIgnored, true, "provider self-report must not unlock promotion");

const reviewedOutputByShotId = new Map<string, string>([[returnedItem.shotId, returnedItem.outputPath || returnedItem.expectedOutputPath]]);
const exportShots = projectShotsAsExportShots(reviewedProject, reviewedOutputByShotId);
const previewQueue: Array<PreviewQueueItem & { reviewRequired?: boolean; previewQaStatus?: string }> = exportShots.map((shot, index) => {
  const outputPath = reviewedOutputByShotId.get(shot.id);
  return {
    id: `golden_path_preview_${shot.id}`,
    kind: outputPath ? "image_hold" : "missing_placeholder",
    shotId: shot.id,
    startSeconds: index * 5,
    durationSeconds: 5,
    mediaPath: outputPath,
    label: shot.id,
    reviewRequired: Boolean(outputPath),
    previewQaStatus: outputPath ? "needs_review" : "missing",
  };
});
const exportProjection = buildLocalPreviewExportProjection({
  runtimeState: runtimeProjectionFixture(reviewedProject),
  previewQueue,
  shots: exportShots,
  projectVibe: reviewedProject,
  projectRoot: "sample-projects/new-video-golden-path",
  selectedShotId: returnedItem.shotId,
  exportRoot: "exports/new-video-golden-path",
  generatedAt,
});

assert.equal(exportProjection.exportWorker.hardLocks.noProviderSubmit, true, "export projection must not submit providers");
assert.equal(exportProjection.exportWorker.hardLocks.noMediaRender, true, "export projection must not render media");
assert.equal(exportProjection.exportWorker.manifest.mvpPackage.projectVibeIncluded, true, "export projection should include Project.vibe");
assert.ok(exportProjection.exportWorker.manifest.mvpPackage.previewMediaCount >= 1, "export projection should include reviewable preview media refs");
assert.ok(exportProjection.exportWorker.entries.some((entry) => entry.kind === "asset_package_manifest"), "export projection should include an asset package manifest");
assert.ok(exportProjection.exportWorker.entries.some((entry) => entry.kind === "storyboard_table"), "export projection should include a storyboard projection");

const exportAction = await runExportAction({ worker: exportProjection.exportWorker });
assert.equal(exportAction.status, "ready", `export action should build a reviewable projection package: ${exportAction.errors?.join("; ")}`);
assert.ok(exportAction.writes?.some((write) => write.path.endsWith("/Project.vibe")), "export package should write Project.vibe");
assert.ok(exportAction.writes?.some((write) => write.path.endsWith("/asset_package_manifest.json")), "export package should write asset package manifest");
assert.ok(exportAction.writes?.some((write) => write.path.endsWith("/preview_media.json")), "export package should write preview media manifest");

console.log(
  JSON.stringify(
    {
      status: "new_video_golden_path_ok",
      stagedOps: staged.patchOperations.length,
      committedShots: committed.project.shots.length,
      imagePlanItems: imagePlan.items.length,
      imageExecutionStatus: executionSummary.status,
      needsReviewCount: executionSummary.needsReviewCount,
      missingCount: executionSummary.missingCount,
      reviewReceipts: reviewedProject.receipts?.reviewReceipts.length || 0,
      lockGateStatus: blockedAutoLock.status,
      exportWrites: exportAction.writes?.length || 0,
      exportManifestPath: exportAction.manifestPath,
    },
    null,
    2,
  ),
);
