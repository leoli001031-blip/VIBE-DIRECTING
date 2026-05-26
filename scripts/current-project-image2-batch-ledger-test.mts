import {
  assert,
  compact,
  loadCore,
  smallProjectFixture,
} from "./demo-runtime-fixture.mts";

async function loadCurrentProjectImage2BatchLedgerCore() {
  const core = await loadCore();
  return {
    currentProjectImage2Batch: core.currentProjectImage2Batch,
    taskRunLedger: core.taskRunLedger,
  };
}

const generatedAt = "2026-05-07T05:15:00.000Z";
const runId = "current_project_image2_batch_ledger_001";
const runRoot = `${smallProjectFixture.projectRoot}/real-test-sandbox/${smallProjectFixture.batchId}`;
const { currentProjectImage2Batch, taskRunLedger } = await loadCurrentProjectImage2BatchLedgerCore();
const {
  buildCurrentProjectImage2BatchPlan,
  projectCurrentProjectImage2BatchLedgers,
} = currentProjectImage2Batch;
const { appendTaskRunEvent, projectTaskRunLedger } = taskRunLedger;

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

function assertProviderLocks(summary, label) {
  assert(summary.providerSubmissionForbidden === true, `${label}.providerSubmissionForbidden must be true`);
  assert(summary.liveSubmitAllowed === false, `${label}.liveSubmitAllowed must be false`);
  assert(summary.noFileMutation === true, `${label}.noFileMutation must be true`);
  assert(summary.workerSpawnForbidden === true, `${label}.workerSpawnForbidden must be true`);
  assert(summary.providerCalled === false, `${label}.providerCalled must be false`);
}

function assertLedgerExpectedOutputs(plan, projection, label) {
  assert(projection.ledgers.length === plan.items.length, `${label} should create one ledger per plan item`);
  assert(projection.projections.length === plan.items.length, `${label} should create one projection per plan item`);
  for (const item of plan.items) {
    const ledger = projection.ledgers.find((candidate) => candidate.taskRunId === item.taskRunId);
    assert(ledger, `${label} missing ledger for ${item.taskRunId}`);
    assert(
      ledger.expectedOutputs.includes(item.expectedOutputPath),
      `${label} ledger must include expected output ${item.expectedOutputPath}`,
    );
    assert(
      ledger.events.some((event) => event.eventType === "task_prepared"),
      `${label} ledger must include task_prepared for ${item.taskRunId}`,
    );
  }
}

const readyPlan = buildCurrentProjectImage2BatchPlan(baseInput());
assert(readyPlan.status === "ready_for_review", `ready plan should pass: ${compact(readyPlan.blockers)}`);
const readyProjection = projectCurrentProjectImage2BatchLedgers(readyPlan);
assert(readyProjection.summary.total === 2, "ready projection total should include both items");
assert(readyProjection.summary.queued === 2, "ready projection should queue both items");
assert(readyProjection.summary.blocked === 0, "ready projection should not mark items blocked");
assert(readyProjection.summary.parked === 0, "ready projection should not park items");
assert(readyProjection.summary.completeVerified === 0, "ready projection must not complete items");
assertProviderLocks(readyProjection.summary, "readyProjection.summary");
assertLedgerExpectedOutputs(readyPlan, readyProjection, "readyProjection");
for (const ledgerProjection of readyProjection.projections) {
  assert(ledgerProjection.currentStatus === "queued", "ready item should project queued");
  assert(ledgerProjection.reportSummary.completeVerified === false, "queued item must not be complete");
}

const selfReportedLedger = appendTaskRunEvent(readyProjection.ledgers[0], {
  eventType: "worker_self_reported_success",
  at: generatedAt,
  workerClaim: {
    status: "success",
    outputPath: readyPlan.items[0].expectedOutputPath,
    outputHash: "sha256-worker-claim-only",
    message: "Worker self-report is not completion evidence.",
  },
});
const selfReportedProjection = projectTaskRunLedger(selfReportedLedger);
assert(selfReportedProjection.currentStatus === "queued", "worker self-report must not advance queued status");
assert(selfReportedProjection.reportSummary.completeVerified === false, "worker self-report must not complete the task");
assert(selfReportedProjection.completionGate.workerSelfReportIgnored === true, "worker self-report should be explicitly ignored");

const blockedPlan = buildCurrentProjectImage2BatchPlan(baseInput({
  references: lockedReferences({ style: { path: smallProjectFixture.stylePath, lockedStatus: "candidate" } }),
}));
assert(blockedPlan.status === "blocked", "blocked plan should be blocked");
assert(blockedPlan.blockers.includes("missing_locked_style_reference"), "blocked plan must include missing locked style blocker");
const blockedProjection = projectCurrentProjectImage2BatchLedgers(blockedPlan);
assert(blockedProjection.summary.total === 2, "blocked projection total should include both items");
assert(blockedProjection.summary.queued === 0, "blocked projection must not queue blocked items");
assert(blockedProjection.summary.blocked === 2, "blocked projection should count blocked items");
assert(blockedProjection.summary.parked === 2, "blocked projection should park blocked items");
assert(blockedProjection.summary.completeVerified === 0, "blocked projection must not complete items");
assertProviderLocks(blockedProjection.summary, "blockedProjection.summary");
assertLedgerExpectedOutputs(blockedPlan, blockedProjection, "blockedProjection");
for (const ledgerProjection of blockedProjection.projections) {
  assert(ledgerProjection.currentStatus === "parked", "blocked item should project parked");
  assert(ledgerProjection.reportSummary.completeVerified === false, "parked item must not be complete");
}

assert(!JSON.stringify(readyProjection).includes("submitId"), "ready projection must not expose submitId");
assert(!JSON.stringify(blockedProjection).includes("providerTaskId"), "blocked projection must not expose providerTaskId");

console.log("Current project Image2 batch ledger projection tests passed. No provider calls were made.");
