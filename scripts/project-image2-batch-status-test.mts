import { deriveProjectImage2BatchPlanStatus } from "../src/core/projectRealChainStatus.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const status = deriveProjectImage2BatchPlanStatus({
  projectionKind: "current_project_image2_batch_prepare_plan",
  project: { projectId: "demo", runId: "run" },
  providerCalled: false,
  liveSubmitAllowed: false,
  items: [
    { shotId: "S01", taskRunId: "task_s01", envelopeId: "env_s01", queueOrder: 1, blocked: false },
    { shotId: "S02", taskRunId: "task_s02", envelopeId: "env_s02", queueOrder: 2, blocked: true, blockers: ["missing_reference"] },
  ],
  summary: {
    plannedCount: 2,
    readyCount: 1,
    blockedCount: 1,
    retryQueuedCount: 1,
    retryNextRunnableCount: 1,
    selectedShotIds: ["S01", "S02"],
  },
  retryScheduler: {
    mode: "planning_only_retry_scheduler_projection",
    actualProviderRetryAllowed: false,
    automaticProviderRetryAllowed: false,
    providerCalled: false,
    promotionAllowed: false,
    simulationPolicy: {
      maxConcurrency: 3,
      retryConcurrency: 2,
      maxAutoRetries: 2,
    },
    circuitBreaker: {
      schemaVersion: "current_project_image2_circuit_breaker_v1",
      status: "closed",
      defaultConcurrency: 3,
      retryConcurrency: 2,
      activeConcurrency: 3,
      networkErrorCount: 0,
      retryableFailureCount: 0,
      downshiftOnNetworkError: true,
    },
    summary: {
      totalTasks: 1,
      queued: 1,
      running: 0,
      succeeded: 0,
      terminalFailed: 0,
      retryScheduled: 0,
      attemptsTotal: 1,
      maxObservedConcurrency: 0,
      nextRunnableCount: 1,
      providerCalled: false,
      promotionAllowed: false,
    },
  },
  ledgerProjection: {
    schemaVersion: "vibe_core_current_project_image2_batch_ledger_projection_v1",
    summary: {
      total: 2,
      queued: 1,
      parked: 1,
      completeVerified: 0,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      noFileMutation: true,
      workerSpawnForbidden: true,
      providerCalled: false,
    },
    projections: [
      {
        taskRunId: "task_s01",
        envelopeId: "env_s01",
        currentStatus: "queued",
        expectedOutputPath: "outputs/S01/start.png",
        expectedOutputs: [{ expectedOutputPath: "outputs/S01/start.png" }],
        previewStatus: "qa_pending",
        completeVerified: false,
      },
      {
        taskRunId: "task_s02",
        envelopeId: "env_s02",
        currentStatus: "parked",
        expectedOutputPath: "outputs/S02/start.png",
        expectedOutputs: ["outputs/S02/start.png"],
        previewStatus: "needs_review",
        completeVerified: false,
      },
    ],
  },
});

assert(status.uiStatus === "blocked", "blocked batch should remain blocked");
assert(status.ledgerSummary?.total === 2, "ledger summary should be retained");
assert(status.retrySummary?.totalTasks === 1, "retry summary should be retained");
assert(status.retrySummary?.maxConcurrency === 3, "retry summary should retain planning concurrency");
assert(status.retrySummary?.retryConcurrency === 2, "retry summary should retain retry concurrency");
assert(status.retrySummary?.maxAutoRetries === 2, "retry summary should retain planning retry budget");
assert(status.retrySummary?.circuitBreakerStatus === "closed", "retry summary should retain circuit breaker status");
assert(status.retrySummary?.activeConcurrency === 3, "retry summary should retain active circuit concurrency");
assert(status.retrySummary?.downshiftOnNetworkError === true, "retry summary should retain downshift policy");
assert(status.retrySummary?.providerCalled === false, "retry summary must not infer provider calls");
assert(status.retrySummary?.promotionAllowed === false, "retry summary must not allow promotion");
assert(status.ledgerProjections.length === 2, "ledger projections should be retained");
assert(status.queuedCount === 1, "queued count should come from ledger summary");
assert(status.parkedCount === 1, "parked count should come from ledger summary");
assert(status.completeVerifiedCount === 0, "complete verified count should come from ledger summary");
assert(status.providerSubmissionForbidden === true, "provider submission forbidden should be retained");
assert(status.noFileMutation === true, "no file mutation should be retained");
assert(status.workerSpawnForbidden === true, "worker spawn forbidden should be retained");
assert(status.liveSubmitAllowed === false, "live submit should stay forbidden");
assert(status.providerCalled === false, "adapter must not infer provider calls");
assert(status.ledgerProjections[0].previewStatus === "qa_pending", "preview status should be normalized");
assert(status.ledgerProjections[1].expectedOutputs[0] === "outputs/S02/start.png", "string expected outputs should be tolerated");

const partial = deriveProjectImage2BatchPlanStatus({
  projectionKind: "current_project_image2_batch_prepare_plan",
  items: [],
  ledgerProjection: {
    summary: { queued: 3 },
    projections: [{ currentStatus: "queued" }, { previewSummary: { status: "needs_review" } }],
  },
});
assert(partial.queuedCount === 3, "partial ledger summary should be tolerated");
assert(partial.ledgerProjections.length === 2, "partial ledger rows should be tolerated");
assert(partial.ledgerProjections[1].previewStatus === "needs_review", "previewSummary fallback should be tolerated");

console.log("Project Image2 batch status adapter tests passed. No provider calls were made.");
