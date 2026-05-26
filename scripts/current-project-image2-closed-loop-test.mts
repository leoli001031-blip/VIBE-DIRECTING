import {
  assert,
  compact,
  loadCore,
  smallProjectFixture,
} from "./demo-runtime-fixture.mts";

async function loadCurrentProjectImage2ClosedLoopCore() {
  const core = await loadCore();
  return {
    currentProjectImage2Batch: core.currentProjectImage2Batch,
    taskRunLedger: core.taskRunLedger,
  };
}

const generatedAt = "2026-05-08T03:30:00.000Z";
const runId = "current_project_image2_closed_loop_001";
const runRoot = `${smallProjectFixture.projectRoot}/real-test-sandbox/${runId}`;
const outputHash = "sha256-synthetic-current-project-image2-output";
const providerSidecarHash = "sha256-synthetic-current-project-image2-provider-sidecar";
const qaSidecarHash = "sha256-synthetic-current-project-image2-qa-sidecar";

const { currentProjectImage2Batch, taskRunLedger } = await loadCurrentProjectImage2ClosedLoopCore();
const {
  buildCurrentProjectImage2BatchPlan,
  projectCurrentProjectImage2BatchLedgers,
} = currentProjectImage2Batch;
const { appendTaskRunEvent, projectTaskRunLedger, projectTaskRunLedgers } = taskRunLedger;

function lockedReferences(overrides = {}) {
  return {
    character: {
      path: smallProjectFixture.characterPath,
      lockedStatus: "locked",
      safeForFutureReference: true,
    },
    scene: {
      path: smallProjectFixture.scenePath,
      lockedStatus: "locked",
      safeForFutureReference: true,
    },
    style: {
      path: smallProjectFixture.stylePath,
      lockedStatus: "locked",
      safeForFutureReference: true,
    },
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    projectId: "small_project_one_shot",
    runId,
    projectRoot: smallProjectFixture.projectRoot,
    runRoot,
    generatedAt,
    references: lockedReferences(),
    selectedShotIds: ["S01", "S02"],
    ...overrides,
  };
}

function assertCoreLocks(summary, label) {
  assert(summary.providerCalled === false, `${label}.providerCalled must be false`);
  assert(summary.liveSubmitAllowed === false, `${label}.liveSubmitAllowed must be false`);
  assert(summary.workerSpawnForbidden === true, `${label}.workerSpawnForbidden must be true`);
}

function outputDetected(item, hash = outputHash) {
  return {
    eventType: "output_detected_no_sidecar",
    at: generatedAt,
    output: {
      path: item.expectedOutputPath,
      hash,
      hashAlgorithm: "sha256",
      byteLength: 2048,
    },
    reason: "Synthetic output evidence injected by software-layer test only.",
    notes: ["synthetic_output", "provider_called:false"],
  };
}

function providerObserved(item, hash = outputHash, sidecarHash = providerSidecarHash) {
  return {
    eventType: "provider_observed",
    at: generatedAt,
    providerObservation: {
      providerId: "openai-image2-api",
      observationId: `synthetic_provider_observation_${item.shotId}`,
      outputPath: item.expectedOutputPath,
      outputHash: hash,
      sidecarPath: item.providerObservationPath,
      ...(sidecarHash ? { sidecarHash } : {}),
    },
    reason: "Synthetic provider observation sidecar metadata; no provider was called.",
    notes: ["synthetic_provider_observation", "provider_called:false"],
  };
}

function qaPassed(item, hash = outputHash, sidecarHash = qaSidecarHash) {
  return {
    eventType: "qa_passed",
    at: generatedAt,
    qaReview: {
      qaReportId: `synthetic_qa_${item.shotId}`,
      outputPath: item.expectedOutputPath,
      reviewedOutputHash: hash,
      sidecarPath: item.semanticQaPath,
      ...(sidecarHash ? { sidecarHash } : {}),
      status: "pass",
      findingIds: [],
      p0FindingCount: 0,
      p1FindingCount: 0,
      p2FindingCount: 0,
    },
    reason: "Synthetic QA pass sidecar metadata for gate projection only.",
    notes: ["synthetic_qa", "provider_called:false"],
  };
}

function appendMany(ledger, events) {
  return events.reduce((nextLedger, event) => appendTaskRunEvent(nextLedger, event), ledger);
}

function assertNotComplete(ledger, message) {
  const projection = projectTaskRunLedger(appendTaskRunEvent(ledger, {
    eventType: "complete_verified",
    at: generatedAt,
    reason: "Attempted complete_verified should be ignored until the gate is satisfied.",
  }));
  assert(projection.currentStatus !== "complete_verified", `${message}: status must not be complete_verified`);
  assert(projection.reportSummary.completeVerified === false, `${message}: report must not be complete`);
  assert(
    projection.reportSummary.warnings.some((warning) => /complete_verified event ignored/i.test(warning)),
    `${message}: ignored complete_verified warning missing`,
  );
  return projection;
}

const readyPlan = buildCurrentProjectImage2BatchPlan(baseInput());
assert(readyPlan.status === "ready_for_review", `ready plan should pass: ${compact(readyPlan.blockers)}`);
const readyBatchProjection = projectCurrentProjectImage2BatchLedgers(readyPlan);
assert(readyBatchProjection.summary.total === 2, "ready plan should include two ledger items");
assert(readyBatchProjection.summary.queued === 2, "ready plan should project only queued items");
assert(readyBatchProjection.summary.completeVerified === 0, "ready plan must not complete without evidence");
assertCoreLocks(readyBatchProjection.summary, "readyBatchProjection.summary");
for (const projection of readyBatchProjection.projections) {
  assert(projection.currentStatus === "queued", "ready item should enter queued state only");
  assert(projection.reportSummary.completeVerified === false, "queued item must not be complete");
}

const queuedLedger = readyBatchProjection.ledgers[0];
const queuedItem = readyPlan.items.find((item) => item.taskRunId === queuedLedger.taskRunId);
assert(queuedItem, "missing plan item for queued ledger");

const selfReportedLedger = appendTaskRunEvent(queuedLedger, {
  eventType: "worker_self_reported_success",
  at: generatedAt,
  workerClaim: {
    status: "success",
    outputPath: queuedItem.expectedOutputPath,
    outputHash,
    message: "Synthetic worker claim must not satisfy completion.",
  },
});
const selfReportedProjection = projectTaskRunLedger(selfReportedLedger);
assert(selfReportedProjection.currentStatus === "queued", "worker self-report must not advance queued status");
assert(selfReportedProjection.completionGate.workerSelfReportIgnored === true, "worker self-report should be marked ignored");
assert(selfReportedProjection.reportSummary.completeVerified === false, "worker self-report must not complete");

const outputOnlyLedger = appendTaskRunEvent(queuedLedger, outputDetected(queuedItem));
const outputOnlyProjection = assertNotComplete(outputOnlyLedger, "mock output without sidecars");
assert(outputOnlyProjection.currentStatus === "output_detected_no_sidecar", "mock output should wait for sidecars");
assert(outputOnlyProjection.completionGate.outputHashPresent === true, "mock output hash should be visible");
assert(outputOnlyProjection.completionGate.providerObservationPresent === false, "mock output alone lacks provider observation");
assert(outputOnlyProjection.completionGate.qaReviewPresent === false, "mock output alone lacks QA");

const providerHashMismatchLedger = appendMany(queuedLedger, [
  outputDetected(queuedItem),
  providerObserved(queuedItem, "sha256-provider-observed-the-wrong-output"),
  qaPassed(queuedItem),
]);
const providerHashMismatchProjection = assertNotComplete(providerHashMismatchLedger, "provider observation hash mismatch");
assert(providerHashMismatchProjection.completionGate.providerObservationHashMatches === false, "provider hash mismatch must block completion");

const missingProviderSidecarLedger = appendMany(queuedLedger, [
  outputDetected(queuedItem),
  providerObserved(queuedItem, outputHash, ""),
  qaPassed(queuedItem),
]);
const missingProviderSidecarProjection = assertNotComplete(missingProviderSidecarLedger, "missing provider sidecar hash");
assert(missingProviderSidecarProjection.completionGate.providerSidecarHashPresent === false, "provider sidecar hash must be required");

const missingQaLedger = appendMany(queuedLedger, [
  outputDetected(queuedItem),
  providerObserved(queuedItem),
]);
const missingQaProjection = assertNotComplete(missingQaLedger, "missing QA pass and QA sidecar");
assert(missingQaProjection.currentStatus === "provider_observed", "missing QA should remain provider_observed");
assert(missingQaProjection.completionGate.qaReviewPresent === false, "QA review must be required");

const missingQaSidecarLedger = appendMany(queuedLedger, [
  outputDetected(queuedItem),
  providerObserved(queuedItem),
  qaPassed(queuedItem, outputHash, ""),
]);
const missingQaSidecarProjection = assertNotComplete(missingQaSidecarLedger, "missing QA sidecar hash");
assert(missingQaSidecarProjection.completionGate.qaSidecarHashPresent === false, "QA sidecar hash must be required");

const completeLedger = appendMany(queuedLedger, [
  outputDetected(queuedItem),
  providerObserved(queuedItem),
  qaPassed(queuedItem),
  {
    eventType: "complete_verified",
    at: generatedAt,
    reason: "All synthetic hash bindings and sidecars are present; projection may mark complete_verified.",
    notes: ["synthetic_complete_verified", "provider_called:false"],
  },
]);
const completeProjection = projectTaskRunLedger(completeLedger);
assert(completeProjection.currentStatus === "complete_verified", "fully bound synthetic ledger should complete_verified");
assert(completeProjection.completionGate.completeVerified === true, "full evidence set should satisfy completion gate");
assert(completeProjection.completionGate.outputHashPresent === true, "complete gate requires output hash");
assert(completeProjection.completionGate.providerObservationHashMatches === true, "complete gate requires provider hash match");
assert(completeProjection.completionGate.providerSidecarHashPresent === true, "complete gate requires provider sidecar hash");
assert(completeProjection.completionGate.qaPassed === true, "complete gate requires QA pass");
assert(completeProjection.completionGate.qaSidecarHashPresent === true, "complete gate requires QA sidecar hash");
assert(completeProjection.reportSummary.completeVerified === true, "report projection should mark complete_verified");
assert(completeProjection.previewSummary.status === "ready", "preview projection should become ready");

const batchWithOneComplete = projectTaskRunLedgers([completeLedger, readyBatchProjection.ledgers[1]]);
assert(batchWithOneComplete.total === 2, "batch projection should include complete and queued ledgers");
assert(batchWithOneComplete.byStatus.complete_verified === 1, "batch projection should count exactly one complete_verified ledger");
assert(batchWithOneComplete.byStatus.queued === 1, "batch projection should leave the untouched ready ledger queued");

const blockedPlan = buildCurrentProjectImage2BatchPlan(baseInput({
  references: lockedReferences({ style: { path: smallProjectFixture.stylePath, lockedStatus: "candidate" } }),
}));
assert(blockedPlan.status === "blocked", "blocked plan should be blocked");
assert(blockedPlan.blockers.includes("missing_locked_style_reference"), "blocked plan must include missing locked style blocker");
const blockedBatchProjection = projectCurrentProjectImage2BatchLedgers(blockedPlan);
assert(blockedBatchProjection.summary.queued === 0, "blocked plan must not queue items");
assert(blockedBatchProjection.summary.blocked === 2, "blocked plan should count both items as blocked");
assert(blockedBatchProjection.summary.parked === 2, "blocked plan must park items");
assert(blockedBatchProjection.summary.completeVerified === 0, "blocked plan must not complete items");
assertCoreLocks(blockedBatchProjection.summary, "blockedBatchProjection.summary");
for (const projection of blockedBatchProjection.projections) {
  assert(projection.currentStatus === "parked", "blocked item should project parked");
  assert(projection.reportSummary.completeVerified === false, "parked item must not be complete");
}

assert(!JSON.stringify(readyBatchProjection).includes("submitId"), "ready projection must not expose submitId");
assert(!JSON.stringify(blockedBatchProjection).includes("providerTaskId"), "blocked projection must not expose providerTaskId");

console.log("Current project Image2 closed-loop core tests passed. Synthetic ledger evidence only; providerCalled=false, liveSubmitAllowed=false, workerSpawnForbidden=true.");
