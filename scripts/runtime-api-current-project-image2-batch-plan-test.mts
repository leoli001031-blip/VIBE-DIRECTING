import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeApiCurrentProjectImage2BatchPlan } from "./runtime-api-current-project-image2-batch-plan.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleSource = readFileSync(path.join(__dirname, "runtime-api-current-project-image2-batch-plan.mjs"), "utf8");
for (const forbidden of [
  "writeFileSync",
  "renameSync",
  "spawn(",
  "exec(",
  "fetch(",
  "provider-submit",
  "current-project-provider-submit",
  "projectVibeWritten: true",
]) {
  assert(!moduleSource.includes(forbidden), `image2 batch plan module must not contain ${forbidden}`);
}

const source = {
  sourceLabel: "Fixture project",
  sandboxSource: "fixture",
  bindingPathRelative: ".vibe/current-project.json",
  binding: { projectRoot: "fixtures/project" },
  requestProjectRoot: "fixtures/project",
  requestContextSource: "query",
  requestProjectId: "fixture-project",
  requestProjectIdSource: "query",
  projectRootMode: "bound",
  runRootRelativePath: "fixtures/project",
  projectVibePath: "/repo/fixtures/project/project/project.vibe",
  projectVibeRelativePath: "fixtures/project/project/project.vibe",
  sourceIndexRelativePath: "fixtures/project/project/source_index.json",
  runManifestRelativePath: "fixtures/project/runtime/run_manifest.json",
  reportRelativePath: "fixtures/project/reports/report.json",
  runtimeTruthLayerRelativePath: "fixtures/project/runtime/runtime_truth_layer.json",
  previewPlanRelativePath: "fixtures/project/runtime/preview_plan.json",
};

const project = {
  projectId: "fixture-project",
  projectRoot: "fixtures/project",
  runId: "fixture-run",
};

function baseFacts(overrides = {}) {
  return {
    primaryReportRelativePath: "fixtures/project/runtime/preview_plan.json",
    projectionSource: "preview_plan",
    ledgerTruthSource: "preview_plan",
    factsUsed: [{ name: "preview_plan", path: "fixtures/project/runtime/preview_plan.json" }],
    projectionAvailable: true,
    runManifest: {
      shotPlans: [
        {
          shotId: "S01",
          taskRunId: "task_run_custom_s01",
          packetPath: "fixtures/project/task_packets/S01.md",
          envelopePath: "fixtures/project/subagent_envelopes/S01.json",
          promptRequestPath: "fixtures/project/prompts/S01.md",
          referencePaths: ["fixtures/project/custom/ref.png"],
        },
      ],
    },
    ...overrides,
  };
}

function baseProjection(overrides = {}) {
  const projectFacts = overrides.projectFacts || baseFacts();
  return {
    ok: true,
    status: "preview_ready",
    previewStatus: "preview_ready",
    productionStatus: "ready",
    project,
    projectFacts,
    observations: [
      {
        shotId: "S01",
        expectedOutputPath: "fixtures/project/outputs/shots/S01/start.png",
        outputExists: true,
        providerObservationPresent: true,
        providerObservationActual: true,
        providerOutputSha256: "sha256:s01",
        semanticQaPresent: true,
        semanticQaActual: true,
        semanticQaStatus: "passed",
        semanticQaPassed: true,
        previewStatus: "returned",
        runtimeTruthStatus: "preview_ready",
        returned: true,
        blockers: [],
      },
      {
        shotId: "S02",
        outputExists: false,
        previewStatus: "missing",
        runtimeTruthStatus: "queued",
        blockers: [],
      },
      {
        shotId: "S03",
        outputExists: true,
        providerObservationActual: true,
        semanticQaNeedsReview: true,
        reviewOverlay: true,
        blockers: [],
      },
      {
        shotId: "S04",
        blockers: ["missing_reference"],
      },
    ],
    ...overrides,
    projectFacts,
  };
}

function createFixtureApi({ projection, facts, projectVibeExists = true }) {
  return createRuntimeApiCurrentProjectImage2BatchPlan({
    currentProjectSource: () => source,
    projectProjectionFromSource: () => projection,
    readProjectFacts: () => facts || projection.projectFacts,
    runtimePolicy: (extra = {}) => ({
      runMode: "read_only_projection",
      liveSubmitAllowed: false,
      verifyScriptRan: false,
      ...extra,
    }),
    runtimeFileUrl: (relativePath) => `/api/runtime/files?path=${encodeURIComponent(relativePath)}`,
    existsSync: (filePath) => filePath === source.projectVibePath && projectVibeExists,
    currentProjectImage2BatchPlanEndpoint: "/api/runtime/projects/current/image2-batch/plan",
  });
}

const projection = baseProjection();
const api = createFixtureApi({ projection });
const plan = api.currentProjectImage2BatchPlanResponse({
  running: false,
  ignoredRequestContext: { projectRoot: "ignored" },
}, source);

assert(plan.ok === true, "plan should preserve projection ok");
assert(plan.endpoint === "/api/runtime/projects/current/image2-batch/plan", "plan endpoint mismatch");
assert(plan.projectionKind === "current_project_image2_batch_prepare_plan", "plan projection kind mismatch");
assert(plan.runMode === "read_only_image2_batch_plan_projection", "plan must stay read-only projection mode");
assert(plan.providerCalled === false, "plan must not call provider");
assert(plan.prepareRan === false, "plan must not run prepare");
assert(plan.verifyScriptRan === false, "plan must not run verify");
assert(plan.liveSubmitAllowed === false, "plan must not allow live submit");
assert(plan.submitPolicy.providerCallAllowed === false, "provider calls must be disallowed");
assert(plan.submitPolicy.dryRunOnly === true, "submit policy must be dry-run only");
assert(plan.submitPolicy.manualSubmitRequired === true, "submit policy must require manual submit");
assert(plan.submitPolicy.liveSubmitAllowed === false, "submit policy must block live submit");
for (const key of ["noSeedance", "noJimeng", "noVideo", "noFast", "noVip"]) {
  assert(plan.submitPolicy[key] === true, `submit policy must keep ${key}=true`);
}
assert(plan.policyProjection.imageGenerate.concurrency === 3, "image.generate concurrency policy must be 3");
assert(plan.policyProjection.imageGenerate.retryConcurrency === 2, "image.generate retry concurrency policy must be 2");
assert(plan.policyProjection.imageGenerate.maxAutoRetries === 2, "image.generate retry budget must be 2");
assert(plan.policyProjection.imageGenerate.successfulReturnStatus === "needs_review", "image.generate returns must require review");
assert(plan.policyProjection.imageGenerate.missingReturnStatus === "missing", "image.generate missing status mismatch");
assert(plan.policyProjection.imageGenerate.threeConcurrentTextToImageDefaultAllowed === true, "three-concurrent text-to-image should be the stream default");
assert(plan.policyProjection.imageEditReference.concurrency === 3, "image.edit reference concurrency policy must be 3");
assert(plan.policyProjection.imageEditReference.referenceConcurrency === 3, "reference edit concurrency policy must be 3");
assert(plan.policyProjection.imageEditReference.textToImageFallbackAllowed === false, "reference edit must forbid text-to-image fallback");
assert(plan.plan.policyProjection.imageGenerate.concurrency === 3, "nested plan should expose image.generate policy");
assert(plan.retryScheduler.mode === "planning_only_retry_scheduler_projection", "retry scheduler should be planning-only");
assert(plan.retryScheduler.actualProviderRetryAllowed === false, "retry scheduler must not enable actual provider retry");
assert(plan.retryScheduler.automaticProviderRetryAllowed === false, "retry scheduler must not enable automatic retry");
assert(plan.retryScheduler.providerCalled === false, "retry scheduler must not call provider");
assert(plan.retryScheduler.promotionAllowed === false, "retry scheduler must not allow promotion");
assert(plan.retryScheduler.simulationPolicy.maxConcurrency === 3, "retry scheduler planning concurrency mismatch");
assert(plan.retryScheduler.simulationPolicy.retryConcurrency === 2, "retry scheduler planning retry concurrency mismatch");
assert(plan.retryScheduler.simulationPolicy.maxAutoRetries === 2, "retry scheduler planning retry budget mismatch");
assert(plan.retryScheduler.circuitBreaker.schemaVersion === "current_project_image2_circuit_breaker_v1", "retry scheduler circuit breaker schema mismatch");
assert(plan.retryScheduler.circuitBreaker.status === "closed", "initial circuit breaker should be closed");
assert(plan.retryScheduler.circuitBreaker.defaultConcurrency === 3, "circuit breaker default concurrency mismatch");
assert(plan.retryScheduler.circuitBreaker.retryConcurrency === 2, "circuit breaker retry concurrency mismatch");
assert(plan.retryScheduler.circuitBreaker.activeConcurrency === 3, "closed circuit breaker should keep default concurrency");
assert(plan.retryScheduler.circuitBreaker.downshiftOnNetworkError === true, "network-error downshift policy must be exposed");
assert(plan.retryScheduler.circuitBreaker.providerCalled === false, "circuit breaker must not imply provider calls");
assert(plan.retryScheduler.effectiveRuntimePolicy.maxConcurrency === 0, "effective runtime concurrency must stay locked");
assert(plan.retryScheduler.effectiveRuntimePolicy.maxAutoRetries === 0, "effective runtime retries must stay locked");
assert(plan.retryScheduler.summary.totalTasks === 1, "only missing non-blocked item should be retry-planned");
assert(plan.retryScheduler.summary.nextRunnableCount === 1, "one retry-planned item should be runnable");
assert(plan.retryScheduler.attemptReceiptCandidates.length === 1, "retry scheduler should expose one attempt receipt candidate");
const receiptCandidate = plan.retryScheduler.attemptReceiptCandidates[0];
assert(receiptCandidate.inputHash, "attempt receipt candidate must include inputHash");
assert(receiptCandidate.permissionReceiptId === "manual_permission_required:S02", "attempt receipt candidate must include permissionReceiptId");
assert(receiptCandidate.expectedOutputPath === "fixtures/project/outputs/shots/S02/start.png", "attempt receipt candidate must include expectedOutputPath");
assert(receiptCandidate.shotId === "S02", "attempt receipt candidate must include shotId");
assert(plan.summary.retryQueuedCount === 1, "summary should expose retry queued count");
assert(plan.items.length === 4, "plan should project all fixture observations");
assert(plan.items[0].taskRunId === "task_run_custom_s01", "shot plan overrides should be preserved");
assert(plan.items[0].referencePaths.includes("fixtures/project/custom/ref.png"), "custom reference path should be included");
assert(plan.items[1].expectedOutputPath === "fixtures/project/outputs/shots/S02/start.png", "default output path mismatch");
assert(plan.items[3].blocked === true, "blocked observation should produce blocked item");
assert(plan.summary.plannedCount === 4, "planned count mismatch");
assert(plan.summary.readyCount === 3, "ready count mismatch");
assert(plan.summary.blockedCount === 1, "blocked count mismatch");
assert(plan.summary.returnedCount === 1, "returned count mismatch");
assert(plan.summary.reviewCount === 1, "review count mismatch");
assert(plan.ledgerProjection.summary.total === 4, "ledger total mismatch");
assert(plan.ledgerProjection.summary.queued === 1, "ledger queued mismatch");
assert(plan.ledgerProjection.summary.completeVerified === 1, "ledger complete mismatch");
assert(plan.ledgerProjection.summary.reviewNeeded === 1, "ledger review mismatch");
assert(plan.ledgerProjection.summary.parked === 1, "ledger parked mismatch");
assert(plan.ledgerProjection.summary.providerSubmissionForbidden === true, "ledger must forbid provider submission");
assert(plan.ledgerProjection.summary.liveSubmitAllowed === false, "ledger must block live submit");
assert(plan.ledgerProjection.summary.noFileMutation === true, "ledger must block file mutation");
assert(plan.ledgerProjection.summary.workerSpawnForbidden === true, "ledger must forbid worker spawn");
assert(plan.ledgerProjection.summary.providerCalled === false, "ledger must not report provider calls");
assert(plan.ignoredRequestContext.projectRoot === "ignored", "route diagnostics should be preserved");

const unavailableFacts = baseFacts({
  primaryReportRelativePath: "fixtures/project/reports/report.json",
  projectionSource: "unavailable",
  ledgerTruthSource: "unavailable",
  factsUsed: [],
  projectionAvailable: false,
  runManifest: {},
});
const unavailableProjection = baseProjection({
  ok: false,
  status: "blocked",
  previewStatus: "blocked",
  productionStatus: "blocked",
  observations: [],
  projectFacts: unavailableFacts,
});
const runCheck = createFixtureApi({
  projection: unavailableProjection,
  facts: unavailableFacts,
  projectVibeExists: false,
}).currentProjectImage2BatchRunCheckResponse({
  running: true,
}, source);

assert(runCheck.ok === false, "unavailable run-check should preserve ok=false");
assert(runCheck.status === "unavailable", "unavailable run-check status mismatch");
assert(runCheck.running === true, "run-check should preserve running state");
assert(runCheck.command.mode === "read_only_image2_batch_plan_check", "run-check mode mismatch");
assert(runCheck.command.exitCode === 1, "run-check exit code mismatch");
assert(runCheck.command.reportRead === false, "run-check should report unread projection");
assert(runCheck.command.projectVibeRead === false, "run-check should report project.vibe read status");
assert(runCheck.command.projectVibeWritten === false, "run-check must not write project.vibe");
assert(runCheck.command.providerCalled === false, "run-check must not call provider");
assert(runCheck.command.prepareRan === false, "run-check must not run prepare");
assert(runCheck.command.verifyScriptRan === false, "run-check must not run verify");
assert(runCheck.command.liveSubmitAllowed === false, "run-check must not allow live submit");
assert(runCheck.command.providerSubmissionForbidden === true, "run-check must forbid provider submit");
assert(runCheck.command.noFileMutation === true, "run-check must forbid file mutation");
assert(runCheck.command.workerSpawnForbidden === true, "run-check must forbid worker spawn");
assert(runCheck.command.retrySchedulerPlanningOnly === true, "run-check should expose planning-only retry scheduler");
assert(runCheck.command.retrySchedulerProviderCalled === false, "run-check retry scheduler must not call provider");
assert(runCheck.command.retrySchedulerPromotionAllowed === false, "run-check retry scheduler must not allow promotion");

console.log("runtime-api-current-project-image2-batch-plan-test: ok");
