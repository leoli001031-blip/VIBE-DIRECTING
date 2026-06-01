import {
  buildP6RealImage2Plan,
  buildP6RealImage2ReturnIngest,
} from "../src/core/p6RealImage2ClosedLoop.ts";
import { buildCurrentProjectPreviewProjection } from "../src/core/currentProjectPreviewProjection.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const generatedAt = "2026-05-16T00:00:00.000Z";
const receipt = {
  receiptId: "receipt_p6_s01",
  status: "pending_action_time_confirmation",
  providerCalled: false,
  runtimeExternalNetworkCallMade: false,
  projectVibeWritten: false,
  selectedShotIds: ["S01", "S02", "S03"],
  submitIntent: {
    maxProviderCallsPerReceipt: 1,
    providerSubmitAllowed: 0,
  },
};

const hashByShotId = {
  S01: `sha256:${"1".repeat(64)}`,
  S02: `sha256:${"2".repeat(64)}`,
  S03: `sha256:${"3".repeat(64)}`,
};

const readyPlan = buildP6RealImage2Plan({
  generatedAt,
  runId: "p6_run_001",
  shotIds: ["S01", "S02", "S03"],
  prompt: "Quiet anime keyframe, locked character and scene references.",
  imageCount: 3,
  providerId: "openai-image2-api",
  providerBaseUrl: "https://api.openai.com",
  credentialRef: "secret-store://providers/openai-image2/default",
  outputRoot: "test_artifacts/p6-real-image2/p6_run_001",
  submitPermissionReceipt: receipt,
  actionTimeConfirmation: {
    confirmed: true,
    phrase: "submit-p6-image2",
    confirmedAt: generatedAt,
  },
});

assert(readyPlan.status === "ready_for_live_submit", `ready plan should pass: ${readyPlan.blockers.join("; ")}`);
assert(readyPlan.hardLocks.maxImagesPerBatch === 3, "batch cap must stay at 3");
assert(readyPlan.hardLocks.maxConcurrency === 3, "image.generate default max concurrency must be 3");
assert(readyPlan.hardLocks.retryConcurrency === 2, "image.generate retry concurrency must be 2");
assert(readyPlan.hardLocks.maxAutoRetries === 2, "image.generate max auto retries must be 2");
assert(readyPlan.hardLocks.providerSubmitFastVerifyAllowed === false, "provider submit must not enter fast verify");
assert(readyPlan.hardLocks.runtimeStateIsDerivedCacheOnly === true, "runtime-state must remain derived cache only");
assert(readyPlan.hardLocks.humanQaForPromotionRequired === true, "human QA must be required for promotion");
assert(readyPlan.hardLocks.explicitPromotionAuthorizationRequired === true, "explicit promotion authorization must be required");
assert(readyPlan.hardLocks.providerSelfReportCanPromote === false, "provider self-report must not promote");
assert(readyPlan.hardLocks.runtimeStateCanPromote === false, "runtime-state must not promote");
assert(readyPlan.hardLocks.projectFactsPromotionAllowed === false, "P6 plan must not promote project facts");
assert(readyPlan.expectedOutputs[0].providerObservationPath.endsWith("provider_observations/S01.json"), "provider observation path missing");
assert(readyPlan.expectedOutputs.length === 3, "3-shot batch should create three expected outputs");

const supersetReceiptPlan = buildP6RealImage2Plan({
  generatedAt,
  runId: "p6_run_superset",
  shotIds: ["S01", "S02"],
  prompt: "Quiet anime keyframe, locked character and scene references.",
  imageCount: 2,
  providerId: "openai-image2-api",
  providerBaseUrl: "https://api.openai.com",
  credentialRef: "secret-store://providers/openai-image2/default",
  outputRoot: "test_artifacts/p6-real-image2/p6_run_superset",
  submitPermissionReceipt: receipt,
  actionTimeConfirmation: {
    confirmed: true,
    phrase: "submit-p6-image2",
    confirmedAt: generatedAt,
  },
});
assert(supersetReceiptPlan.status === "blocked", "permission receipt selectedShotIds must exactly match the plan shot set");

function boundEvidence(output: typeof readyPlan.expectedOutputs[number], options: {
  sha256?: string;
  status?: "verified" | "needs_review" | "success";
  omitProviderReceipt?: boolean;
  omitSemanticReceipt?: boolean;
  selectedShotIds?: string[];
} = {}) {
  const sha256 = options.sha256 || hashByShotId[output.shotId as keyof typeof hashByShotId];
  const selectedShotIds = options.selectedShotIds || readyPlan.shotIds;
  return {
    shotId: output.shotId,
    outputPath: output.expectedOutputPath,
    sha256,
    providerObservationPresent: true,
    semanticQaStatus: options.status || "verified",
    providerSelfReportedSuccess: true,
    providerObservation: options.omitProviderReceipt ? undefined : {
      receiptId: `provider_${output.shotId}`,
      receiptPath: output.providerObservationPath,
      runId: readyPlan.runId,
      shotId: output.shotId,
      submitPermissionReceiptId: readyPlan.submitPermissionReceipt?.receiptId,
      selectedShotIds,
      outputPath: output.expectedOutputPath,
      outputSha256: sha256,
      providerObservationMode: "actual_provider_call_observed",
    },
    semanticQa: options.omitSemanticReceipt ? undefined : {
      receiptId: `semantic_${output.shotId}`,
      receiptPath: output.semanticQaPath,
      runId: readyPlan.runId,
      shotId: output.shotId,
      submitPermissionReceiptId: readyPlan.submitPermissionReceipt?.receiptId,
      selectedShotIds,
      outputPath: output.expectedOutputPath,
      reviewedOutputSha256: sha256,
      status: options.status || "verified",
    },
  };
}

const mixedBatch = buildP6RealImage2ReturnIngest({
  generatedAt,
  plan: readyPlan,
  returnedOutputs: [
    boundEvidence(readyPlan.expectedOutputs[0], { status: "success" }),
    boundEvidence(readyPlan.expectedOutputs[1], { status: "needs_review" }),
    {
      shotId: "S03",
      outputPath: readyPlan.expectedOutputs[2].expectedOutputPath,
      providerObservationPresent: true,
      semanticQaStatus: "verified",
      providerSelfReportedSuccess: true,
    },
  ],
});
assert(mixedBatch.status === "blocked", "mixed batch with missing hash-bound output should block");
assert(mixedBatch.providerSelfReportIgnoredForCompletion === true, "provider self-report must be ignored");
assert(mixedBatch.summary.verified === 1, "success should normalize to verified");
assert(mixedBatch.summary.needsReview === 1, "needs_review count missing");
assert(mixedBatch.summary.missing === 1, "missing count should be recorded");
assert(mixedBatch.summary.previewEligible === 2, "verified and needs_review outputs should be preview-eligible");
assert(mixedBatch.summary.promotionAllowed === false, "mixed batch must not auto-promote");
assert(mixedBatch.shotStatuses.map((item) => item.status).join(",") === "verified,needs_review,missing", "3-shot statuses should be explicit");
assert(mixedBatch.previewItems[0].status === "verified", "success alias should preview as verified");
assert(mixedBatch.previewItems[1].status === "needs_review", "preview should carry needs_review status");
assert(mixedBatch.exportReport.receipts.providerObservationReceipts.length === 3, "export report must enumerate provider observation receipts");
assert(mixedBatch.exportReport.receipts.semanticQaReceipts.map((item) => item.status).join(",") === "verified,needs_review,missing", "export report must enumerate semantic QA statuses");
assert(mixedBatch.exportReport.report.previewPolicy === "verified_or_needs_review_only", "export report must pin preview policy");
assert(mixedBatch.exportReport.report.missingProjection === "blocked_placeholder", "export report must pin missing placeholder policy");
assert(
  mixedBatch.exportReport.statuses.map((item) => `${item.shotId}:${item.previewProjection}`).join(",") ===
    "S01:image_hold,S02:image_hold,S03:blocked_placeholder",
  "export statuses must project missing as blocked placeholder",
);
assert(mixedBatch.promotionGate.defaultPromotionAllowed === false, "promotion default must be false");
assert(mixedBatch.promotionGate.providerSelfReportCanPromote === false, "provider self-report must not promote");
assert(mixedBatch.promotionGate.runtimeStateCanPromote === false, "runtime-state must not promote");
assert(mixedBatch.promotionGate.blockers.some((blocker) => /Every selected shot/i.test(blocker)), "promotion should require all verified shots");

const mixedPreviewProjection = buildCurrentProjectPreviewProjection({
  summary: {
    status: "ready",
    projectId: "p6_return_contract",
    previewItems: readyPlan.expectedOutputs.map((output) => {
      const status = mixedBatch.shotStatuses.find((item) => item.shotId === output.shotId)?.status || "missing";
      const previewItem = mixedBatch.previewItems.find((item) => item.shotId === output.shotId);
      return {
        id: `p6_${output.shotId}`,
        shotId: output.shotId,
        status,
        previewStatus: status,
        mediaPath: previewItem?.outputPath || output.expectedOutputPath,
        outputExists: Boolean(previewItem),
        reviewRequired: status === "needs_review",
      };
    }),
  },
});
const mixedPreviewByShot = new Map(mixedPreviewProjection.items.map((item) => [item.shotId, item]));
assert(mixedPreviewByShot.get("S01")?.kind === "image_hold", "verified P6 return should enter preview");
assert(mixedPreviewByShot.get("S02")?.kind === "image_hold", "needs_review P6 return should enter preview");
assert(mixedPreviewByShot.get("S02")?.reviewRequired === true, "needs_review P6 return should keep review overlay");
assert(mixedPreviewByShot.get("S03")?.kind === "missing_placeholder", "missing P6 return should become placeholder");
assert(mixedPreviewByShot.get("S03")?.mediaPath === undefined, "missing P6 return must not expose expected/provider path");
assert(mixedPreviewProjection.returnedCount === 2, "P6 preview should count only verified and needs_review returns");
assert(mixedPreviewProjection.missingCount === 1, "P6 preview should count missing as missing");

const providerSelfReportOnly = buildP6RealImage2ReturnIngest({
  generatedAt,
  plan: readyPlan,
  returnedOutputs: readyPlan.expectedOutputs.map((output) => ({
    shotId: output.shotId,
    outputPath: output.expectedOutputPath,
    providerObservationPresent: true,
    semanticQaStatus: "verified" as const,
    providerSelfReportedSuccess: true,
  })),
});
assert(providerSelfReportOnly.status === "blocked", "provider self-report without hash-bound output must block");
assert(providerSelfReportOnly.summary.missing === 3, "all provider-self-report-only outputs should be missing");
assert(providerSelfReportOnly.previewItems.length === 0, "missing outputs must not be preview-eligible");
assert(providerSelfReportOnly.exportReport.statuses.every((item) => item.previewProjection === "blocked_placeholder"), "provider-self-report-only outputs must export as blocked placeholders");

const providerSelfReportProjection = buildCurrentProjectPreviewProjection({
  summary: {
    status: "ready",
    previewItems: [{
      id: "p6_provider_self_report_only",
      shotId: "S01",
      status: "provider_succeeded_self_report",
      mediaPath: readyPlan.expectedOutputs[0].expectedOutputPath,
      outputExists: true,
    }],
  },
});
assert(providerSelfReportProjection.items[0].kind === "missing_placeholder", "P6 provider self-report must not create preview media");
assert(providerSelfReportProjection.items[0].returned === false, "P6 provider self-report must not count as returned");
assert(providerSelfReportProjection.returnedCount === 0, "P6 provider self-report must not increment returned count");

const allVerifiedOutputs = readyPlan.expectedOutputs.map((output, index) => ({
  ...boundEvidence(output),
  sha256: [hashByShotId.S01, hashByShotId.S02, hashByShotId.S03][index],
}));

const allVerifiedDefaultPromotion = buildP6RealImage2ReturnIngest({
  generatedAt,
  plan: readyPlan,
  returnedOutputs: allVerifiedOutputs,
});
assert(allVerifiedDefaultPromotion.status === "return_ingested", "all verified hash-bound evidence should ingest");
assert(allVerifiedDefaultPromotion.summary.verified === 3, "all verified count missing");
assert(allVerifiedDefaultPromotion.summary.promotionAllowed === false, "promotion must default false without explicit QA and authorization");
assert(allVerifiedDefaultPromotion.promotionGate.humanQaApproved === false, "human QA should default false");
assert(allVerifiedDefaultPromotion.promotionGate.promotionAuthorized === false, "promotion authorization should default false");

const humanQaOnly = buildP6RealImage2ReturnIngest({
  generatedAt,
  plan: readyPlan,
  returnedOutputs: allVerifiedOutputs,
  humanQaApproval: {
    approved: true,
    reviewerId: "qa_lead",
    reviewedAt: generatedAt,
    verifiedShotIds: ["S01", "S02", "S03"],
    reviewedSha256ByShotId: {
      S01: hashByShotId.S01,
      S02: hashByShotId.S02,
      S03: hashByShotId.S03,
    },
  },
});
assert(humanQaOnly.promotionGate.humanQaApproved === true, "explicit human QA should be accepted");
assert(humanQaOnly.summary.promotionAllowed === false, "human QA alone must not allow promotion");

const fullyAuthorizedPromotion = buildP6RealImage2ReturnIngest({
  generatedAt,
  plan: readyPlan,
  returnedOutputs: allVerifiedOutputs,
  humanQaApproval: {
    approved: true,
    reviewerId: "qa_lead",
    reviewedAt: generatedAt,
    verifiedShotIds: ["S01", "S02", "S03"],
    reviewedSha256ByShotId: {
      S01: hashByShotId.S01,
      S02: hashByShotId.S02,
      S03: hashByShotId.S03,
    },
  },
  promotionAuthorization: {
    authorized: true,
    authorizedBy: "producer",
    authorizedAt: generatedAt,
    runId: readyPlan.runId,
    shotIds: ["S01", "S02", "S03"],
    scope: "p6_real_image2_small_batch",
  },
});
assert(fullyAuthorizedPromotion.promotionGate.humanQaApproved === true, "full gate should include human QA");
assert(fullyAuthorizedPromotion.promotionGate.promotionAuthorized === true, "full gate should include promotion authorization");
assert(fullyAuthorizedPromotion.summary.promotionAllowed === true, "only explicit human QA plus explicit authorization should allow promotion");
assert(fullyAuthorizedPromotion.promotionGate.blockers.length === 0, "fully authorized promotion should have no promotion blockers");
assert(fullyAuthorizedPromotion.exportReport.receipts.humanQaReceipt.approved === true, "export report must carry human QA receipt state");
assert(fullyAuthorizedPromotion.exportReport.receipts.promotionAuthorizationReceipt.authorized === true, "export report must carry promotion authorization receipt state");
assert(fullyAuthorizedPromotion.exportReport.statuses.every((item) => item.promotionEligible === true), "only fully authorized verified statuses should become promotion eligible");

const fakeHashPromotion = buildP6RealImage2ReturnIngest({
  generatedAt,
  plan: readyPlan,
  returnedOutputs: readyPlan.expectedOutputs.map((output) => boundEvidence(output, { sha256: `sha256:fake-${output.shotId}` })),
  humanQaApproval: {
    approved: true,
    reviewerId: "qa_lead",
    reviewedAt: generatedAt,
    verifiedShotIds: ["S01", "S02", "S03"],
    reviewedSha256ByShotId: {
      S01: "sha256:fake-S01",
      S02: "sha256:fake-S02",
      S03: "sha256:fake-S03",
    },
  },
  promotionAuthorization: {
    authorized: true,
    authorizedBy: "producer",
    authorizedAt: generatedAt,
    runId: readyPlan.runId,
    shotIds: ["S01", "S02", "S03"],
    scope: "p6_real_image2_small_batch",
  },
});
assert(fakeHashPromotion.summary.promotionAllowed === false, "fake sha256 strings must not allow promotion");
assert(fakeHashPromotion.summary.missing === 3, "fake sha256 strings must be treated as missing evidence");

const missingReceiptPromotion = buildP6RealImage2ReturnIngest({
  generatedAt,
  plan: readyPlan,
  returnedOutputs: readyPlan.expectedOutputs.map((output) => boundEvidence(output, { omitProviderReceipt: output.shotId === "S02" })),
  humanQaApproval: {
    approved: true,
    reviewerId: "qa_lead",
    reviewedAt: generatedAt,
    verifiedShotIds: ["S01", "S02", "S03"],
    reviewedSha256ByShotId: {
      S01: hashByShotId.S01,
      S02: hashByShotId.S02,
      S03: hashByShotId.S03,
    },
  },
  promotionAuthorization: {
    authorized: true,
    authorizedBy: "producer",
    authorizedAt: generatedAt,
    runId: readyPlan.runId,
    shotIds: ["S01", "S02", "S03"],
    scope: "p6_real_image2_small_batch",
  },
});
assert(missingReceiptPromotion.summary.promotionAllowed === false, "missing provider observation receipt must not allow promotion");
assert(missingReceiptPromotion.summary.missing === 1, "missing receipt should mark only that shot missing");

const shotSetSupersetPromotion = buildP6RealImage2ReturnIngest({
  generatedAt,
  plan: readyPlan,
  returnedOutputs: readyPlan.expectedOutputs.map((output) => boundEvidence(output, { selectedShotIds: ["S01", "S02", "S03", "S04"] })),
  humanQaApproval: {
    approved: true,
    reviewerId: "qa_lead",
    reviewedAt: generatedAt,
    verifiedShotIds: ["S01", "S02", "S03"],
    reviewedSha256ByShotId: {
      S01: hashByShotId.S01,
      S02: hashByShotId.S02,
      S03: hashByShotId.S03,
    },
  },
  promotionAuthorization: {
    authorized: true,
    authorizedBy: "producer",
    authorizedAt: generatedAt,
    runId: readyPlan.runId,
    shotIds: ["S01", "S02", "S03"],
    scope: "p6_real_image2_small_batch",
  },
});
assert(shotSetSupersetPromotion.summary.promotionAllowed === false, "receipt shot-set supersets must not allow promotion");
assert(shotSetSupersetPromotion.summary.missing === 3, "shot-set supersets should fail receipt binding for every shot");

const rawCredential = buildP6RealImage2Plan({
  generatedAt,
  runId: "p6_run_002",
  shotIds: ["S01"],
  prompt: "Prompt",
  imageCount: 1,
  providerId: "openai-image2-api",
  providerBaseUrl: "https://api.openai.com",
  credentialRef: "sk-test123456789",
  outputRoot: "test_artifacts/p6-real-image2/p6_run_002",
  submitPermissionReceipt: { ...receipt, selectedShotIds: ["S01"] },
  actionTimeConfirmation: {
    confirmed: true,
    phrase: "submit-p6-image2",
  },
});
assert(rawCredential.status === "blocked", "raw credential material must block");
assert(rawCredential.blockers.some((blocker) => /credentialRef/i.test(blocker)), "raw credential blocker missing");

const tooLarge = buildP6RealImage2Plan({
  generatedAt,
  runId: "p6_run_003",
  shotIds: ["S01", "S02", "S03", "S04"],
  prompt: "Prompt",
  imageCount: 4,
  providerId: "openai-image2-api",
  providerBaseUrl: "https://api.openai.com",
  credentialRef: "secret-store://providers/openai-image2/default",
  outputRoot: "test_artifacts/p6-real-image2/p6_run_003",
  submitPermissionReceipt: { ...receipt, selectedShotIds: ["S01", "S02", "S03", "S04"] },
  actionTimeConfirmation: {
    confirmed: true,
    phrase: "submit-p6-image2",
  },
});
assert(tooLarge.status === "blocked", "P6 batch larger than 3 must block");
assert(tooLarge.blockers.some((blocker) => /1 to 3/i.test(blocker)), "batch cap blocker missing");

console.log("p6-real-image2-closed-loop-test: ok");
