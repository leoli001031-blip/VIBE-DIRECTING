import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeApiCurrentProjectRealChainStatus } from "./runtime-api-current-project-real-chain-status.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleSource = readFileSync(path.join(__dirname, "runtime-api-current-project-real-chain-status.mjs"), "utf8");
for (const forbidden of [
  "writeFileSync",
  "renameSync",
  "spawn(",
  "provider-submit",
  "current-project-provider-submit",
  "real-provider",
  "image2-batch",
  "strict-edit",
  "legacy 005",
]) {
  assert(!moduleSource.includes(forbidden), `real-chain status module must not contain ${forbidden}`);
}

const source = {
  sourceLabel: "Fixture project",
  sandboxSource: "fixture",
  bindingPathRelative: ".vibe/current-project.json",
  binding: { projectRoot: "fixtures/project" },
  runRootPath: "/repo/fixtures/project",
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
};

function baseProjectFacts(overrides = {}) {
  return {
    primaryReportRelativePath: "fixtures/project/runtime/preview_plan.json",
    projectionSource: "preview_plan",
    ledgerTruthSource: "preview_plan",
    factsUsed: [{ name: "preview_plan", path: "fixtures/project/runtime/preview_plan.json", usedFor: ["preview"] }],
    image2Report: { status: "preview_ready" },
    projectionAvailable: true,
    ...overrides,
  };
}

function baseProjection(overrides = {}) {
  const projectFacts = overrides.projectFacts || baseProjectFacts();
  return {
    ok: true,
    status: "preview_ready",
    previewStatus: "preview_ready",
    productionStatus: "ready",
    project,
    projectFacts,
    observations: [],
    reviewShotIds: [],
    returnedObservations: [],
    blockedObservations: [],
    ...overrides,
    projectFacts,
  };
}

function createFixtureApi({ projection, facts, round5ArtifactIngest, projectVibeExists = true, jsonByPath = {} }) {
  return createRuntimeApiCurrentProjectRealChainStatus({
    currentProjectSource: () => source,
    projectProjectionFromSource: () => projection,
    readProjectFacts: () => facts || projection.projectFacts,
    currentProjectWorkbenchFacts: (projectSource, projectFacts) => ({
      sourceProjectRoot: projectSource.runRootRelativePath,
      projectionSource: projectFacts.projectionSource,
      providerCalled: false,
      projectVibeWritten: false,
    }),
    round5ArtifactIngestFromReport: () => round5ArtifactIngest,
    runtimePolicy: () => ({
      runMode: "read_only_projection",
      liveSubmitAllowed: false,
      verifyScriptRan: false,
    }),
    runtimeFileUrl: (relativePath) => `/api/runtime/files?path=${encodeURIComponent(relativePath)}`,
    existsSync: (filePath) => filePath === source.projectVibePath && projectVibeExists,
    readJsonIfPresent: (filePath) => jsonByPath[filePath],
    currentProjectStatusEndpoint: "/api/runtime/projects/current/real-chain/status",
  });
}

const unavailableFacts = baseProjectFacts({
  primaryReportRelativePath: "fixtures/project/reports/report.json",
  projectionSource: "unavailable",
  ledgerTruthSource: "unavailable",
  factsUsed: [],
  image2Report: undefined,
  projectionAvailable: false,
});
const unavailableProjection = baseProjection({
  ok: false,
  status: "blocked",
  previewStatus: "blocked",
  productionStatus: "blocked",
  projectFacts: unavailableFacts,
});
const unavailablePayload = createFixtureApi({ projection: unavailableProjection }).currentProjectRealChainResponse({ running: false }, source);
assert(unavailablePayload.ok === false, "unavailable projection should not be ok");
assert(unavailablePayload.status === "unavailable", "unavailable projection should normalize status");
assert(unavailablePayload.providerCalled === false, "status projection must not call provider");
assert(unavailablePayload.nextAction === "provide_project_runtime_truth_or_preview_plan", "unavailable projection should ask for project runtime facts");

const relayQueueFixture = {
  schemaVersion: "0.1.0",
  generatedAt: "2026-05-24T00:00:00.000Z",
  queueId: "seedance_segment_relay_queue",
  storyboardConfirmed: true,
  status: "running",
  maxConcurrentVideoJobs: 1,
  counts: {
    total: 2,
    ready: 1,
    active: 1,
    completed: 0,
    failed: 0,
    blocked: 0,
  },
  activeItemIds: ["seedance_segment_1"],
  autoSubmitAllowed: false,
  resumeCommands: [],
  items: [],
  userSummary: "即梦正在处理当前任务，结果出来后会继续下一个。",
  notes: [],
};
const availableFacts = baseProjectFacts({
  previewPlan: {
    relayQueue: relayQueueFixture,
  },
});
const availableProjection = baseProjection({
  projectFacts: availableFacts,
  reviewShotIds: ["S01"],
  observations: [
    {
      shotId: "S01",
      order: 1,
      imageUrl: "/api/runtime/files?path=S01",
      expectedOutputPath: "fixtures/project/outputs/S01/start.png",
      outputExists: true,
      previewStatus: "returned_with_review_overlay",
      previewQaStatus: "needs_review",
      productionQaStatus: "needs_review",
      runtimeTruthStatus: "preview_ready",
      reviewOverlay: true,
      providerObservationActual: true,
      blockers: [],
    },
  ],
  returnedObservations: [{ shotId: "S01" }],
});
const availablePayload = createFixtureApi({ projection: availableProjection }).currentProjectRealChainResponse({}, source);
assert(availablePayload.ok === true, "available projection should be ok");
assert(availablePayload.status === "preview_ready", "available projection should preserve status");
assert(availablePayload.providerCalled === false, "providerCalled must remain false even with provider observations");
assert(availablePayload.actualImage2Triggered === true, "actual provider observations should still be projected");
assert(availablePayload.previewItems.length === 1, "preview item projection should be preserved");
assert(availablePayload.relayQueue?.status === "running", "video relay queue should be preserved for the UI");
assert(availablePayload.nextAction === "review_needed_outputs_before_production_promotion", "review overlays should block promotion");

const previewPlanVideoFacts = baseProjectFacts({
  previewPlan: {
    relayQueue: {
      ...relayQueueFixture,
      status: "complete",
      counts: { total: 1, ready: 0, active: 0, completed: 1, failed: 0, blocked: 0 },
      activeItemIds: [],
      items: [{
        id: "seedance_segment_1",
        shotId: "S01",
        status: "success",
        submitId: "seedance-submit-1",
        outputVideoPath: "fixtures/project/video/S01.mp4",
        outputVideoSha256: "sha256:video-s01",
        localMediaPaths: ["fixtures/project/video/S01.mp4"],
      }],
      userSummary: "视频队列已处理完，等待复核。",
    },
    previewItems: [{
      id: "seedance_storyboard_video_segment_1",
      shotId: "S01",
      order: 1,
      mediaType: "video",
      mediaPath: "fixtures/project/video/S01.mp4",
      durationSeconds: 4,
      status: "returned_with_review_overlay",
      videoStatus: "success",
      submitId: "seedance-submit-1",
      reviewRequired: true,
    }],
  },
});
const previewPlanVideoPayload = createFixtureApi({
  projection: baseProjection({
    projectFacts: previewPlanVideoFacts,
    observations: [],
    reviewShotIds: [],
  }),
}).currentProjectRealChainResponse({}, source);
assert(previewPlanVideoPayload.previewItems.length === 1, "preview plan video items should be returned to the UI");
assert(previewPlanVideoPayload.previewItems[0].mediaType === "video", "preview plan video item should keep mediaType=video");
assert(previewPlanVideoPayload.previewItems[0].videoStatus === "success", "preview plan video item should keep videoStatus success");
assert(previewPlanVideoPayload.previewItems[0].reviewRequired === true, "preview plan returned videos should remain reviewable");

const approvedVideoPath = "fixtures/project/outputs/S01/video.mp4";
const approvedVideoHash = "sha256:approved-video";
const approvedReviewProjection = baseProjection({
  project: {
    ...project,
    receipts: {
      reviewReceipts: [
        {
          id: "review_S01_approved",
          status: "approved",
          humanReviewed: true,
          shotId: "S01",
          sourceReceiptId: "seedance_submit_fixture",
          outputPath: approvedVideoPath,
          outputHash: approvedVideoHash,
        },
      ],
    },
  },
  status: "returned_with_review_overlay",
  previewStatus: "returned_with_review_overlay",
  productionStatus: "needs_review",
  reviewShotIds: ["S01"],
  observations: [
    {
      shotId: "S01",
      order: 1,
      expectedOutputPath: approvedVideoPath,
      mediaType: "video",
      outputHash: approvedVideoHash,
      outputExists: true,
      previewStatus: "returned_with_review_overlay",
      previewQaStatus: "needs_review",
      productionQaStatus: "needs_review",
      reviewOverlay: true,
      blockers: [],
    },
  ],
  returnedObservations: [{ shotId: "S01" }],
});
const approvedReviewPayload = createFixtureApi({ projection: approvedReviewProjection }).currentProjectRealChainResponse({}, source);
assert(approvedReviewPayload.status === "preview_ready", "approved review receipt should clear returned review overlay status");
assert(approvedReviewPayload.productionStatus === "ready", "approved review receipt should clear production review status");
assert(approvedReviewPayload.needsReviewCount === 0, "approved review receipt should remove shot from review count");
assert(approvedReviewPayload.productionNeedsReviewShots.length === 0, "approved review receipt should remove production review shot");
assert(approvedReviewPayload.previewItems[0].status === "approved", "approved review receipt should mark preview item approved");
assert(approvedReviewPayload.previewItems[0].reviewOverlay === false, "approved review receipt should hide preview review overlay");
assert(approvedReviewPayload.nextAction === "preview_projection_ready", "approved review receipt should unblock next action");

const persistedQueuePayload = createFixtureApi({
  projection: unavailableProjection,
  jsonByPath: {
    "/repo/fixtures/project/reports/video_relay_queue.json": relayQueueFixture,
  },
}).currentProjectRealChainResponse({}, source);
assert(persistedQueuePayload.ok === false, "persisted relay queue should not fake preview projection availability");
assert(persistedQueuePayload.relayQueue?.status === "running", "persisted video relay queue should be exposed even when preview projection is unavailable");

const round5Facts = baseProjectFacts({
  primaryReportRelativePath: "fixtures/project/reports/round5_full_real_chain_report.json",
  projectionSource: "round5_full_real_chain_report_fallback",
  ledgerTruthSource: "round5_full_real_chain_report_fallback",
  image2Report: { status: "needs_review" },
});
const round5Projection = baseProjection({
  ok: true,
  status: "preview_ready",
  previewStatus: "preview_ready",
  productionStatus: "ready",
  projectFacts: round5Facts,
});
const round5Payload = createFixtureApi({
  projection: round5Projection,
  round5ArtifactIngest: {
    uiSummary: {
      status: "needs_review",
      totalShots: 3,
      observedStarts: 2,
      nextActions: ["review_ZP05"],
    },
  },
}).currentProjectRealChainResponse({}, source);
assert(round5Payload.ok === true, "round5 fallback should be ok when artifact ingest exists");
assert(round5Payload.status === "needs_review", "round5 fallback should prefer artifact status");
assert(round5Payload.previewStatus === "needs_review", "round5 fallback should derive preview status");
assert(round5Payload.productionStatus === "needs_review", "round5 fallback should derive production status");
assert(round5Payload.plannedImageCount === 3, "round5 fallback should use artifact shot count");
assert(round5Payload.returnedImageCount === 2, "round5 fallback should use artifact observed count");
assert(round5Payload.blockerCount === 1, "round5 fallback should use next action count");

const runCheckPayload = createFixtureApi({
  projection: unavailableProjection,
  facts: unavailableFacts,
  projectVibeExists: false,
}).currentProjectRealChainRunCheckResponse({
  running: true,
  ignoredRequestContext: { projectRoot: "ignored" },
}, source);
assert(runCheckPayload.running === true, "run-check should preserve route running state");
assert(runCheckPayload.command.mode === "read_only_projection_check", "run-check should stay read-only");
assert(runCheckPayload.command.exitCode === 1, "run-check should fail when projection is unavailable");
assert(runCheckPayload.command.reportRead === false, "run-check should report unread projection");
assert(runCheckPayload.command.projectVibeRead === false, "run-check should report project.vibe read status");
assert(runCheckPayload.command.providerCalled === false, "run-check must not call provider");
assert(runCheckPayload.command.prepareRan === false, "run-check must not run prepare");
assert(runCheckPayload.command.projectVibeWritten === false, "run-check must not write project.vibe");
assert(runCheckPayload.command.verifyScriptRan === false, "run-check must not run verify");
assert(runCheckPayload.command.liveSubmitAllowed === false, "run-check must not allow live submit");
assert(runCheckPayload.command.workerSpawnForbidden === true, "run-check must forbid worker spawn");
assert(runCheckPayload.ignoredRequestContext.projectRoot === "ignored", "run-check should preserve route diagnostics");

console.log("runtime-api-current-project-real-chain-status-test: ok");
