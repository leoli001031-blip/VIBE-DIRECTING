import {
  buildCurrentProjectImage2BatchPlan,
  projectCurrentProjectImage2BatchLedgers,
  projectCurrentProjectImage2BatchPreviewItems,
  projectCurrentProjectImage2BatchRuntimeProjectionFromLedgerProjections,
} from "../src/core/currentProjectImage2Batch.ts";
import { buildCurrentProjectPreviewProjection } from "../src/core/currentProjectPreviewProjection.ts";
import { appendTaskRunEvent, projectTaskRunLedger } from "../src/core/taskRunLedger.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const generatedAt = "2026-05-16T03:00:00.000Z";
const projectRoot = "project";
const runId = "p3_image2_small_batch";
const runRoot = `${projectRoot}/runs/${runId}`;
const outputHash = "sha256-p3-output";
const providerSidecarHash = "sha256-p3-provider-sidecar";
const qaSidecarHash = "sha256-p3-qa-sidecar";

function baseInput(selectedShotIds = ["S01", "S02", "S03"]) {
  return {
    projectId: "p3_small_batch_project",
    runId,
    projectRoot,
    runRoot,
    generatedAt,
    selectedShotIds,
    references: {
      character: { path: "project/assets/hero.png", lockedStatus: "locked", safeForFutureReference: true },
      scene: { path: "project/assets/station.png", lockedStatus: "locked", safeForFutureReference: true },
      style: { path: "project/assets/style.png", lockedStatus: "locked", safeForFutureReference: true },
    },
  };
}

function outputDetected(item, hash = outputHash) {
  return {
    eventType: "output_detected_no_sidecar",
    at: generatedAt,
    output: {
      path: item.expectedOutputPath,
      hash,
      hashAlgorithm: "sha256",
      byteLength: 4096,
    },
    reason: "P3 small-batch returned output evidence.",
    notes: ["p3_return_ingest", "provider_called:false"],
  };
}

function providerObserved(item, hash = outputHash) {
  return {
    eventType: "provider_observed",
    at: generatedAt,
    providerObservation: {
      providerId: "openai-image2-api",
      observationId: `p3_provider_observation_${item.shotId}`,
      outputPath: item.expectedOutputPath,
      outputHash: hash,
      sidecarPath: item.providerObservationPath,
      sidecarHash: providerSidecarHash,
    },
    reason: "P3 provider return sidecar is hash-bound.",
    notes: ["p3_provider_observation"],
  };
}

function qaPassed(item, hash = outputHash) {
  return {
    eventType: "qa_passed",
    at: generatedAt,
    qaReview: {
      qaReportId: `p3_qa_pass_${item.shotId}`,
      outputPath: item.expectedOutputPath,
      reviewedOutputHash: hash,
      sidecarPath: item.semanticQaPath,
      sidecarHash: qaSidecarHash,
      status: "pass",
      findingIds: [],
      p0FindingCount: 0,
      p1FindingCount: 0,
      p2FindingCount: 0,
    },
    reason: "P3 QA passed with sidecar hash.",
    notes: ["p3_qa_pass"],
  };
}

function qaNeedsReview(item, hash = outputHash) {
  return {
    eventType: "needs_review",
    at: generatedAt,
    qaReview: {
      qaReportId: `p3_qa_review_${item.shotId}`,
      outputPath: item.expectedOutputPath,
      reviewedOutputHash: hash,
      sidecarPath: item.semanticQaPath,
      sidecarHash: qaSidecarHash,
      status: "needs_review",
      findingIds: ["p2_color_drift"],
      p0FindingCount: 0,
      p1FindingCount: 0,
      p2FindingCount: 1,
    },
    reason: "P3 QA requires creator review.",
    notes: ["p3_needs_review"],
  };
}

function appendMany(ledger, events) {
  return events.reduce((nextLedger, event) => appendTaskRunEvent(nextLedger, event), ledger);
}

const fourShotPlan = buildCurrentProjectImage2BatchPlan(baseInput(["S01", "S02", "S03", "S04"]));
assert(fourShotPlan.status === "blocked", "P3 default batch plan must block above three shots");
assert(fourShotPlan.blockers.includes("selected_shots_exceed_max_images"), "P3 above-three blocker missing");

const plan = buildCurrentProjectImage2BatchPlan(baseInput());
assert(plan.status === "ready_for_review", `P3 three-shot plan should be ready: ${plan.blockers.join("; ")}`);
assert(plan.items.length === 3, "P3 plan must contain exactly three Image2 items");
assert(plan.submitPolicy.providerCallAllowed === false, "P3 batch plan must not auto-submit providers");
assert(plan.submitPolicy.manualSubmitRequired === true, "P3 batch plan must require manual submit");
assert(plan.submitPolicy.noFast === true, "P3 batch plan must forbid fast verify path");

const ledgerProjection = projectCurrentProjectImage2BatchLedgers(plan);
const [firstLedger, secondLedger, thirdLedger] = ledgerProjection.ledgers;
const [firstItem, secondItem] = plan.items;
assert(firstLedger && secondLedger && thirdLedger && firstItem && secondItem, "P3 fixture must include three ledgers and first two items");

const completeLedger = appendMany(firstLedger, [
  outputDetected(firstItem),
  providerObserved(firstItem),
  qaPassed(firstItem),
  {
    eventType: "complete_verified",
    at: generatedAt,
    reason: "P3 verified item has output hash, provider sidecar, QA sidecar, and pass status.",
    notes: ["p3_complete_verified"],
  },
]);
const needsReviewLedger = appendMany(secondLedger, [
  outputDetected(secondItem),
  providerObserved(secondItem),
  qaNeedsReview(secondItem),
]);
const selfReportedMissingLedger = appendTaskRunEvent(thirdLedger, {
  eventType: "worker_self_reported_success",
  at: generatedAt,
  workerClaim: {
    status: "success",
    outputPath: plan.items[2].expectedOutputPath,
    outputHash,
    message: "Self-report must not create preview media.",
  },
  reason: "P3 self-report is ignored for completion and preview.",
  notes: ["p3_self_report_ignored"],
});

const projections = [completeLedger, needsReviewLedger, selfReportedMissingLedger].map(projectTaskRunLedger);
const runtimeProjection = projectCurrentProjectImage2BatchRuntimeProjectionFromLedgerProjections({
  schemaVersion: plan.schemaVersion,
  projectId: plan.projectId,
  runId: plan.runId,
  generatedAt,
  projections,
});
assert(runtimeProjection.summary.total === 3, "P3 runtime projection should include all three shots");
assert(runtimeProjection.summary.completeVerified === 1, "P3 runtime should count one verified success");
assert(runtimeProjection.summary.needsReview === 1, "P3 runtime should count one needs_review item");
assert(runtimeProjection.summary.queued === 1, "P3 self-reported item should remain queued/missing");

const previewItems = projectCurrentProjectImage2BatchPreviewItems(runtimeProjection);
const preview = buildCurrentProjectPreviewProjection({
  summary: {
    status: "ready",
    projectId: plan.projectId,
    projectRoot,
    generatedAt,
    previewStatus: runtimeProjection.summary.creatorShortStatus,
    productionStatus: "needs_review",
    previewItems,
  },
  previewItems,
});
const previewByShot = new Map(preview.items.map((item) => [item.shotId, item]));
assert(previewByShot.get("S01")?.kind === "image_hold", "verified P3 item should show as image hold");
assert(previewByShot.get("S01")?.mediaPath === firstItem.expectedOutputPath, "verified P3 item should expose verified output path");
assert(previewByShot.get("S01")?.reviewRequired === false, "verified P3 item should not require review");
assert(previewByShot.get("S02")?.kind === "image_hold", "needs_review P3 item should show review image hold");
assert(previewByShot.get("S02")?.mediaPath === secondItem.expectedOutputPath, "needs_review P3 item should expose review output path");
assert(previewByShot.get("S02")?.reviewRequired === true, "needs_review P3 item should carry review overlay");
assert(previewByShot.get("S03")?.kind === "missing_placeholder", "missing/self-reported P3 item should stay placeholder");
assert(previewByShot.get("S03")?.mediaPath === undefined, "missing/self-reported P3 item must not expose provider self-report media");
assert(preview.returnedCount === 2, "P3 preview should count only verified and needs_review media as returned");
assert(preview.missingCount === 1, "P3 preview should keep missing/self-report as missing");
assert(preview.providerCalled === false, "P3 preview projection must not call providers");
assert(preview.liveSubmitAllowed === false, "P3 preview projection must forbid live submit");

const providerSelfReportPreview = buildCurrentProjectPreviewProjection({
  summary: {
    status: "ready",
    previewItems: [{
      id: "provider-self-report",
      shotId: "S99",
      status: "provider_succeeded_self_report",
      mediaPath: "project/runs/p3/S99/start.png",
      outputExists: true,
    }],
  },
});
assert(providerSelfReportPreview.items[0].kind === "missing_placeholder", "provider self-report status must not create preview media");
assert(providerSelfReportPreview.items[0].mediaPath === undefined, "provider self-report media path must be suppressed");
assert(providerSelfReportPreview.items[0].returned === false, "provider self-report must not count as returned");
assert(providerSelfReportPreview.returnedCount === 0, "provider self-report must not increment returned count");
assert(providerSelfReportPreview.missingCount === 1, "provider self-report must stay missing");

const missingWithOutputFlagPreview = buildCurrentProjectPreviewProjection({
  summary: {
    status: "ready",
    previewItems: [{
      id: "missing-output-flag",
      shotId: "S98",
      status: "missing",
      mediaPath: "project/runs/p3/S98/start.png",
      outputExists: true,
    }],
  },
});
assert(missingWithOutputFlagPreview.items[0].kind === "missing_placeholder", "missing status must stay placeholder even when outputExists is true");
assert(missingWithOutputFlagPreview.items[0].returned === false, "missing status must not count as returned");
assert(missingWithOutputFlagPreview.returnedCount === 0, "missing status must not increment returned count");

console.log("p3-image2-small-batch-preview-test passed: verified=1, needs_review=1, missing=1.");
