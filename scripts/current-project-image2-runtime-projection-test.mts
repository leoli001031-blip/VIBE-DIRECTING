import {
  assert,
  compact,
  loadCore,
  smallProjectFixture,
} from "./demo-runtime-fixture.mts";

async function loadCurrentProjectImage2RuntimeProjectionCore() {
  const core = await loadCore();
  return {
    currentProjectImage2Batch: core.currentProjectImage2Batch,
    taskRunLedger: core.taskRunLedger,
  };
}

const generatedAt = "2026-05-08T06:10:00.000Z";
const runId = "current_project_image2_runtime_projection_001";
const runRoot = `${smallProjectFixture.projectRoot}/real-test-sandbox/${runId}`;
const outputHash = "sha256-synthetic-current-project-image2-runtime-output";
const providerSidecarHash = "sha256-synthetic-current-project-image2-runtime-provider-sidecar";
const qaSidecarHash = "sha256-synthetic-current-project-image2-runtime-qa-sidecar";

const { currentProjectImage2Batch, taskRunLedger } = await loadCurrentProjectImage2RuntimeProjectionCore();
const {
  buildCurrentProjectImage2BatchPlan,
  projectCurrentProjectImage2BatchLedgers,
  projectCurrentProjectImage2BatchRuntimeProjection,
  projectCurrentProjectImage2BatchRuntimeProjectionFromLedgerProjections,
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
    reason: "Synthetic output evidence for runtime projection test only.",
    notes: ["synthetic_output", "provider_called:false"],
  };
}

function providerObserved(item, hash = outputHash, sidecarHash = providerSidecarHash) {
  return {
    eventType: "provider_observed",
    at: generatedAt,
    providerObservation: {
      providerId: "openai-image2-api",
      observationId: `synthetic_runtime_provider_observation_${item.shotId}`,
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
      qaReportId: `synthetic_runtime_qa_${item.shotId}`,
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
    reason: "Synthetic QA pass sidecar metadata for runtime projection test only.",
    notes: ["synthetic_qa", "provider_called:false"],
  };
}

function appendMany(ledger, events) {
  return events.reduce((nextLedger, event) => appendTaskRunEvent(nextLedger, event), ledger);
}

function runtimeFromProjections(projections) {
  return projectCurrentProjectImage2BatchRuntimeProjectionFromLedgerProjections({
    schemaVersion: "0.1.0",
    projectId: "small_project_one_shot",
    runId,
    generatedAt,
    projections,
  });
}

function assertCoreLocks(summary, label) {
  assert(summary.providerCalled === false, `${label}.providerCalled must be false`);
  assert(summary.liveSubmitAllowed === false, `${label}.liveSubmitAllowed must be false`);
  assert(summary.noFileMutation === true, `${label}.noFileMutation must be true`);
  assert(summary.workerSpawnForbidden === true, `${label}.workerSpawnForbidden must be true`);
}

function assertItemMirrorsLedger(item, projection, label) {
  assert(item.manifestSummary === projection.manifestSummary, `${label} must reuse manifestSummary`);
  assert(item.reportSummary === projection.reportSummary, `${label} must reuse reportSummary`);
  assert(item.previewSummary === projection.previewSummary, `${label} must reuse previewSummary`);
  assert(item.status === projection.reportSummary.status, `${label} status must come from reportSummary`);
  assert(item.completeVerified === projection.reportSummary.completeVerified, `${label} complete must come from reportSummary`);
  assert(item.previewStatus === projection.previewSummary.status, `${label} preview status must come from previewSummary`);
}

function assertItemMatchesLedger(item, projection, label) {
  assert(JSON.stringify(item.manifestSummary) === JSON.stringify(projection.manifestSummary), `${label} manifestSummary must match ledger projection`);
  assert(JSON.stringify(item.reportSummary) === JSON.stringify(projection.reportSummary), `${label} reportSummary must match ledger projection`);
  assert(JSON.stringify(item.previewSummary) === JSON.stringify(projection.previewSummary), `${label} previewSummary must match ledger projection`);
  assert(item.status === projection.reportSummary.status, `${label} status must come from reportSummary`);
  assert(item.completeVerified === projection.reportSummary.completeVerified, `${label} complete must come from reportSummary`);
  assert(item.previewStatus === projection.previewSummary.status, `${label} preview status must come from previewSummary`);
}

const readyPlan = buildCurrentProjectImage2BatchPlan(baseInput());
assert(readyPlan.status === "ready_for_review", `ready plan should pass: ${compact(readyPlan.blockers)}`);
const readyLedgerProjection = projectCurrentProjectImage2BatchLedgers(readyPlan);
const readyRuntimeProjection = projectCurrentProjectImage2BatchRuntimeProjection(readyPlan);
const readyRuntimeFromLedgerProjections = runtimeFromProjections(readyLedgerProjection.projections);
assert(readyRuntimeProjection.schemaVersion === readyPlan.schemaVersion, "ready runtime schemaVersion should match plan");
assert(readyRuntimeProjection.projectId === readyPlan.projectId, "ready runtime projectId should match plan");
assert(readyRuntimeProjection.runId === readyPlan.runId, "ready runtime runId should match plan");
assert(readyRuntimeProjection.generatedAt === readyPlan.generatedAt, "ready runtime generatedAt should match plan");
assert(readyRuntimeProjection.summary.total === 2, "ready runtime should include both items");
assert(readyRuntimeProjection.summary.queued === 2, "ready runtime should count queued from ledger reports");
assert(readyRuntimeProjection.summary.parked === 0, "ready runtime should not park ready items");
assert(readyRuntimeProjection.summary.blocked === 0, "ready runtime should not block ready items");
assert(readyRuntimeProjection.summary.completeVerified === 0, "ready runtime should not complete without evidence");
assert(/queued for review/i.test(readyRuntimeProjection.summary.creatorShortStatus), "ready runtime should expose creator short status");
assertCoreLocks(readyRuntimeProjection.summary, "readyRuntimeProjection.summary");
for (let index = 0; index < readyRuntimeProjection.items.length; index += 1) {
  assertItemMatchesLedger(readyRuntimeProjection.items[index], readyLedgerProjection.projections[index], `ready item ${index}`);
  assertItemMirrorsLedger(readyRuntimeFromLedgerProjections.items[index], readyLedgerProjection.projections[index], `ready direct item ${index}`);
}

const blockedPlan = buildCurrentProjectImage2BatchPlan(baseInput({
  references: lockedReferences({ style: { path: smallProjectFixture.stylePath, lockedStatus: "candidate" } }),
}));
assert(blockedPlan.status === "blocked", "blocked plan should be blocked");
const blockedRuntimeProjection = projectCurrentProjectImage2BatchRuntimeProjection(blockedPlan);
assert(blockedRuntimeProjection.summary.total === 2, "blocked runtime should include both items");
assert(blockedRuntimeProjection.summary.queued === 0, "blocked runtime must not queue items");
assert(blockedRuntimeProjection.summary.parked === 2, "blocked runtime should count parked from reports");
assert(blockedRuntimeProjection.summary.blocked === 2, "blocked runtime should surface parked items as blocked");
assert(blockedRuntimeProjection.summary.completeVerified === 0, "blocked runtime must not complete items");
assert(/blocked/i.test(blockedRuntimeProjection.summary.creatorShortStatus), "blocked runtime should expose creator blocked status");
assertCoreLocks(blockedRuntimeProjection.summary, "blockedRuntimeProjection.summary");
for (const item of blockedRuntimeProjection.items) {
  assert(item.status === "parked", "blocked runtime items should read parked from reportSummary");
  assert(item.previewStatus === "parked", "blocked runtime items should read parked from previewSummary");
}

const queuedLedger = readyLedgerProjection.ledgers[0];
const queuedItem = readyPlan.items.find((item) => item.taskRunId === queuedLedger.taskRunId);
assert(queuedItem, "missing plan item for queued ledger");

const selfReportedProjection = projectTaskRunLedger(appendTaskRunEvent(queuedLedger, {
  eventType: "worker_self_reported_success",
  at: generatedAt,
  workerClaim: {
    status: "success",
    outputPath: queuedItem.expectedOutputPath,
    outputHash,
    message: "Worker self-report is not runtime completion evidence.",
  },
}));
const selfReportedRuntime = runtimeFromProjections([selfReportedProjection]);
assert(selfReportedRuntime.summary.completeVerified === 0, "worker self-report must not count as complete");
assert(selfReportedRuntime.items[0].status === "queued", "worker self-report must leave runtime status queued");
assert(selfReportedRuntime.items[0].reportSummary.warnings.some((warning) => /self-report/i.test(warning)), "worker self-report warning should pass through reportSummary");
assert(selfReportedRuntime.items[0].reportSummary === selfReportedProjection.reportSummary, "worker self-report runtime must reuse reportSummary");

const outputOnlyProjection = projectTaskRunLedger(appendTaskRunEvent(queuedLedger, outputDetected(queuedItem)));
const outputOnlyRuntime = runtimeFromProjections([outputOnlyProjection]);
assert(outputOnlyRuntime.summary.completeVerified === 0, "missing sidecars must not count as complete");
assert(outputOnlyRuntime.summary.candidate === 1, "missing sidecars should count candidate preview state");
assert(/waiting sidecars/i.test(outputOnlyRuntime.summary.creatorShortStatus), "missing sidecars should expose creator waiting sidecars status");
assert(outputOnlyRuntime.items[0].status === "output_detected_no_sidecar", "missing sidecars status should come from reportSummary");
assert(outputOnlyRuntime.items[0].previewStatus === "candidate", "missing sidecars preview should come from previewSummary");
assert(outputOnlyRuntime.items[0].manifestSummary.blockers.length > 0, "missing sidecars blockers should pass through manifestSummary");

const missingQaProjection = projectTaskRunLedger(appendMany(queuedLedger, [
  outputDetected(queuedItem),
  providerObserved(queuedItem),
]));
const missingQaRuntime = runtimeFromProjections([missingQaProjection]);
assert(missingQaRuntime.summary.completeVerified === 0, "missing QA must not count as complete");
assert(missingQaRuntime.summary.qaPending === 1, "missing QA should count qa pending preview state");
assert(/waiting QA/i.test(missingQaRuntime.summary.creatorShortStatus), "missing QA should expose creator waiting QA status");
assert(missingQaRuntime.items[0].status === "provider_observed", "missing QA status should come from reportSummary");
assert(missingQaRuntime.items[0].previewStatus === "qa_pending", "missing QA preview should come from previewSummary");
assert(missingQaRuntime.items[0].reportSummary.completeVerified === false, "missing QA report must not complete");

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
const completeBatchProjection = projectTaskRunLedgers([completeLedger, readyLedgerProjection.ledgers[1]]);
const completeRuntimeProjection = runtimeFromProjections(completeBatchProjection.projections);
assert(completeRuntimeProjection.summary.total === 2, "complete runtime should include synthetic complete and queued ledgers");
assert(completeRuntimeProjection.summary.completeVerified === 1, "complete runtime should count reportSummary.completeVerified");
assert(completeRuntimeProjection.summary.queued === 1, "complete runtime should leave untouched ledger queued");
assert(completeRuntimeProjection.items[0].status === "complete_verified", "complete runtime status should come from reportSummary");
assert(completeRuntimeProjection.items[0].completeVerified === true, "complete runtime item should read complete from reportSummary");
assert(completeRuntimeProjection.items[0].previewStatus === "ready", "complete runtime preview should come from previewSummary");
assert(completeRuntimeProjection.items[0].previewSummary.items[0].verified === true, "complete runtime preview item should remain verified");
assert(/1\/2 complete/i.test(completeRuntimeProjection.summary.creatorShortStatus), "complete runtime should expose creator progress");
assertCoreLocks(completeRuntimeProjection.summary, "completeRuntimeProjection.summary");

assert(!JSON.stringify(readyRuntimeProjection).includes("submitId"), "ready runtime projection must not expose submitId");
assert(!JSON.stringify(completeRuntimeProjection).includes("providerTaskId"), "complete runtime projection must not expose providerTaskId");

console.log("Current project Image2 runtime projection tests passed. Ledger summaries are the single source for manifest/report/preview truth.");
