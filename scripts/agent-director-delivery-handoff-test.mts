import {
  agentDirectorDeliveryHandoffPreviewQueue,
  buildAgentDirectorDeliveryHandoff,
} from "../src/core/agentDirectorDeliveryHandoff.ts";
import {
  createProjectVibe,
  hashProjectVibeFacts,
  type ProjectVibeDocument,
  type ProjectVibeReviewReceipt,
} from "../src/project/index.ts";
import { buildLocalPreviewExportProjection } from "../src/core/localPreviewExportProjection.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const projectRoot = "/tmp/p10-d9-delivery-handoff";
const projectId = "p10-d9-delivery-handoff";
const sourceProject = createProjectVibe({
  projectId,
  title: "P10-D9 Delivery Handoff",
  createdAt: "2026-07-19T04:00:00.000Z",
  updatedAt: "2026-07-19T04:00:00.000Z",
  storyFlow: {
    id: "story",
    sections: [{ id: "section", title: "Scene", summary: "Two shots", sequenceIndex: 0, shotIds: ["S01", "S02"] }],
    shotOrder: ["S01", "S02"],
  },
  visualMemory: { id: "memory", entries: [] },
  shots: ["S01", "S02"].map((shotId) => ({
    id: shotId,
    sectionId: "section",
    title: shotId,
    intent: `Promoted ${shotId}`,
    sceneAssetIds: [],
    characterAssetIds: [],
    propAssetIds: [],
    durationSeconds: 5,
    status: "generated" as const,
    sourceRefs: ["p10-d9-fixture"],
  })),
  assets: [],
  runs: [],
});
const sourceFactHash = hashProjectVibeFacts(sourceProject);

function promotionReceipt(shotId: "S01" | "S02", version: "A" | "B", createdAt: string, hashByte: string): ProjectVibeReviewReceipt {
  return {
    id: `promotion-${shotId}-${version}`,
    createdAt,
    status: "approved",
    decisionScope: "agent_video_promotion",
    projectId,
    projectRoot,
    projectFactHash: sourceFactHash,
    jobId: `job-${shotId}-${version}`,
    actionId: `generation-action-${shotId}-${version}`,
    selectionReceiptId: `selection-${shotId}-${version}`,
    versionPairId: `pair-${shotId}`,
    winnerVersion: version,
    promotionActionId: `promotion-action-${shotId}-${version}`,
    promotionConfirmationId: `promotion-confirmation-${shotId}-${version}`,
    reviewerId: "local_user",
    humanReviewed: true,
    shotId,
    sourceReceiptId: `generation-receipt-${shotId}-${version}`,
    outputPath: `video/${shotId}-${version}.mp4`,
    outputHash: `sha256:${hashByte.repeat(64)}`,
    retryRequested: false,
    lateOutput: false,
    providerSelfReportIgnored: true,
    promotionAuthorized: true,
    promotionAuthorizedBy: "local_user",
    promotionAuthorizedAt: createdAt,
    evidenceRefs: [`selection_receipt#selection-${shotId}-${version}`],
    blockers: [],
  };
}

function withReceipts(receipts: ProjectVibeReviewReceipt[]): ProjectVibeDocument {
  const project = structuredClone(sourceProject);
  project.receipts.reviewReceipts = receipts;
  const latestPromotion = receipts
    .filter((receipt) => receipt.decisionScope === "agent_video_promotion")
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
  if (latestPromotion) {
    project.manifest.updatedAt = latestPromotion.createdAt;
    project.sourceIndex.updatedAt = latestPromotion.createdAt;
    project.sourceIndex.reviewReceiptRefs = receipts.map((receipt) => receipt.id).sort();
  }
  return project;
}

const noPromotion = buildAgentDirectorDeliveryHandoff({
  project: sourceProject,
  projectRoot,
  projectFactHash: sourceFactHash,
});
assert(noPromotion.status === "not_applicable", "projects without P10 promotion receipts must retain the legacy delivery path");

const oldPreviewReceipt: ProjectVibeReviewReceipt = {
  ...promotionReceipt("S01", "A", "2026-07-19T04:01:00.000Z", "a"),
  id: "preview-only-S01-A",
  decisionScope: "agent_video_preview",
  selectionReceiptId: undefined,
  versionPairId: undefined,
  winnerVersion: undefined,
  promotionActionId: undefined,
  promotionConfirmationId: undefined,
  promotionAuthorized: false,
  promotionAuthorizedBy: undefined,
  promotionAuthorizedAt: undefined,
};
const promotedProject = withReceipts([
  oldPreviewReceipt,
  promotionReceipt("S01", "B", "2026-07-19T04:02:00.000Z", "b"),
  promotionReceipt("S02", "A", "2026-07-19T04:03:00.000Z", "c"),
]);
const promotedFactHash = hashProjectVibeFacts(promotedProject);
const ready = buildAgentDirectorDeliveryHandoff({ project: promotedProject, projectRoot, projectFactHash: promotedFactHash });
assert(ready.status === "ready" && ready.media.length === 2, `exact promoted winners should enter Delivery: ${ready.blockers.join("; ")}`);
assert(ready.media[0]?.winnerVersion === "B" && ready.media[0]?.shotId === "S01", "S01 Delivery must use the promoted B winner, not the preview-approved loser");
assert(ready.media[1]?.winnerVersion === "A" && ready.media[1]?.shotId === "S02", "S02 Delivery winner identity drifted");
assert(ready.reviewReceipts.every((receipt) => receipt.decisionScope === "agent_video_promotion" && receipt.promotionAuthorized), "Delivery review scope must contain promoted winners only");
const queue = agentDirectorDeliveryHandoffPreviewQueue(ready, promotedProject);
assert(queue.length === 2 && queue.every((item) => item.kind === "video_clip" && item.reviewReceiptId), "promoted winners should project as exact reviewed video clips");
assert(queue.every((item) => item.status === "approved" && item.reviewRequired === false && item.returned), "promoted winners must not be projected as needs_review again");
assert(queue[0]?.mediaPath === `${projectRoot}/video/S01-B.mp4`, "promoted preview media must resolve inside the active project root");
assert(!queue.some((item) => item.mediaPath?.includes("S01-A")), "the losing candidate must not enter Preview or Delivery");

const localProjection = buildLocalPreviewExportProjection({
  runtimeState: {
    generatedAt: "2026-07-19T04:05:00.000Z",
    project: { title: promotedProject.manifest.title, root: projectRoot },
    sourceIndex: { projectId },
    taskRuns: { jobs: [], runs: [], taskViews: [] },
    manifestMatches: { reports: [] },
    imagePipeline: { generationHealthReports: [], qaPromotionReports: [] },
  } as any,
  previewQueue: [
    {
      id: "loser-S01-A",
      kind: "video_clip",
      shotId: "S01",
      startSeconds: 0,
      durationSeconds: 5,
      mediaPath: `${projectRoot}/video/S01-A.mp4`,
      label: "S01 A",
      sourceReceiptId: "generation-receipt-S01-A",
      outputHash: `sha256:${"a".repeat(64)}`,
    },
    ...queue,
  ],
  shots: promotedProject.shots.map((shot) => ({
    id: shot.id,
    actId: "A1",
    sectionId: shot.sectionId,
    title: shot.title,
    storyFunction: shot.intent,
    durationSeconds: shot.durationSeconds,
    status: "ready",
    gates: { identity: "PASS", scene: "PASS", pair: "PASS", story: "PASS", prop: "N/A", style: "PASS" },
    issues: [],
  })) as any,
  projectVibe: promotedProject,
  projectRoot,
  projectFactHash: promotedFactHash,
  generatedAt: "2026-07-19T04:05:00.000Z",
  exportRoot: "exports/p10-d9-delivery",
});
assert(localProjection.deliveryHandoff?.status === "ready", "local export must use the exact promoted Delivery handoff");
assert(localProjection.previewQueue.length === 2 && !localProjection.previewQueue.some((item) => item.id === "loser-S01-A"), "local export projection must drop the losing candidate");
assert(localProjection.exportWorker.deliveryGate.status === "ready_for_confirmation", "promotion must not bypass the independent Delivery confirmation");
assert(localProjection.exportWorker.deliveryGate.reviewBindings.length === 2, "Delivery confirmation must bind both exact promotion receipts");
assert(localProjection.exportWorker.manifest.mediaFiles.length === 2, "the formal package must copy exactly the promoted winners");
assert(localProjection.exportWorker.manifest.mediaFiles.some((item) => item.sourcePath === "video/S01-B.mp4"), "the package must include the promoted S01 B winner");
assert(!localProjection.exportWorker.manifest.mediaFiles.some((item) => item.sourcePath === "video/S01-A.mp4"), "the package must exclude the S01 A loser");

const reversedProject = withReceipts([
  promotionReceipt("S01", "B", "2026-07-19T04:02:00.000Z", "b"),
  promotionReceipt("S01", "A", "2026-07-19T04:04:00.000Z", "d"),
  promotionReceipt("S02", "A", "2026-07-19T04:03:00.000Z", "c"),
]);
const reversed = buildAgentDirectorDeliveryHandoff({
  project: reversedProject,
  projectRoot,
  projectFactHash: hashProjectVibeFacts(reversedProject),
});
assert(reversed.status === "ready" && reversed.media[0]?.winnerVersion === "A", "the latest explicit promotion must supersede an older winner without deleting its history");

const missingPromotionProject = withReceipts([promotionReceipt("S01", "B", "2026-07-19T04:02:00.000Z", "b")]);
const missingPromotion = buildAgentDirectorDeliveryHandoff({
  project: missingPromotionProject,
  projectRoot,
  projectFactHash: hashProjectVibeFacts(missingPromotionProject),
});
assert(missingPromotion.status === "blocked" && missingPromotion.blockers.includes("delivery_promotion_missing_for_shot:S02"), "an unpromoted shot must block formal Delivery");

const needsReviewProject = withReceipts([
  { ...promotionReceipt("S01", "B", "2026-07-19T04:02:00.000Z", "b"), status: "needs_review", promotionAuthorized: false },
  promotionReceipt("S02", "A", "2026-07-19T04:03:00.000Z", "c"),
]);
const needsReview = buildAgentDirectorDeliveryHandoff({
  project: needsReviewProject,
  projectRoot,
  projectFactHash: hashProjectVibeFacts(needsReviewProject),
});
assert(needsReview.status === "blocked" && needsReview.blockers.some((item) => item.startsWith("delivery_promotion_not_approved")), "needs_review media must never enter Delivery");

const outsidePathProject = withReceipts([
  { ...promotionReceipt("S01", "B", "2026-07-19T04:02:00.000Z", "b"), outputPath: "../outside.mp4" },
  promotionReceipt("S02", "A", "2026-07-19T04:03:00.000Z", "c"),
]);
const outsidePath = buildAgentDirectorDeliveryHandoff({
  project: outsidePathProject,
  projectRoot,
  projectFactHash: hashProjectVibeFacts(outsidePathProject),
});
assert(outsidePath.status === "blocked" && outsidePath.blockers.some((item) => item.startsWith("delivery_promotion_output_path_invalid")), "a project-external output path must fail closed");

const wrongRoot = buildAgentDirectorDeliveryHandoff({ project: promotedProject, projectRoot: "/tmp/another-project", projectFactHash: promotedFactHash });
assert(wrongRoot.status === "blocked" && wrongRoot.blockers.some((item) => item.startsWith("delivery_promotion_root_mismatch")), "a cross-project root must fail closed");

const staleFact = buildAgentDirectorDeliveryHandoff({ project: promotedProject, projectRoot, projectFactHash: "stale-fact" });
assert(staleFact.status === "blocked" && staleFact.blockers.includes("delivery_handoff_current_fact_mismatch"), "an old fact hash must fail closed");

const changedAfterPromotionProject = structuredClone(promotedProject);
changedAfterPromotionProject.manifest.updatedAt = "2026-07-19T04:06:00.000Z";
changedAfterPromotionProject.sourceIndex.updatedAt = "2026-07-19T04:06:00.000Z";
const changedAfterPromotion = buildAgentDirectorDeliveryHandoff({
  project: changedAfterPromotionProject,
  projectRoot,
  projectFactHash: hashProjectVibeFacts(changedAfterPromotionProject),
});
assert(changedAfterPromotion.status === "blocked" && changedAfterPromotion.blockers.includes("delivery_handoff_project_changed_after_promotion"), "project facts changed after promotion must invalidate the old Delivery handoff");

const duplicateHashProject = withReceipts([
  promotionReceipt("S01", "B", "2026-07-19T04:02:00.000Z", "e"),
  promotionReceipt("S02", "A", "2026-07-19T04:03:00.000Z", "e"),
]);
const duplicateHash = buildAgentDirectorDeliveryHandoff({
  project: duplicateHashProject,
  projectRoot,
  projectFactHash: hashProjectVibeFacts(duplicateHashProject),
});
assert(duplicateHash.status === "blocked" && duplicateHash.blockers.includes("delivery_promotion_output_hash_reused"), "the same media hash cannot satisfy two promoted shot identities");

console.log("agent director delivery handoff: ok");
