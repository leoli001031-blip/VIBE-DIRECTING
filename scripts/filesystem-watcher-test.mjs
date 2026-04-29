import fs from "node:fs";
import { spawnSync } from "node:child_process";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const importResult = spawnSync("node", ["scripts/import-runtime-test.mjs"], {
  stdio: "inherit",
  encoding: "utf8",
  timeout: 120000,
});

assert(importResult.status === 0, "filesystem watcher test could not refresh runtime-state with import-runtime-test");

const requiredKinds = [
  "codex_temp_generated_images",
  "project_outputs",
  "reports",
  "videos",
  "audio",
];

const state = readJson("public/runtime-state.json");
const harness = state.filesystemWatcherHarness;
assert(harness, "runtime-state missing filesystemWatcherHarness");
assert(harness.schemaVersion === "0.1.0", "filesystemWatcherHarness schemaVersion drifted");
assert(harness.derivedOnly === true, "filesystemWatcherHarness must be derived-only");
assert(harness.fsWatchDaemonEnabled === false, "filesystemWatcherHarness must not enable fs.watch daemon");
assert(harness.daemonStarted === false, "filesystemWatcherHarness must not start a daemon");
assert(harness.providerSubmissionForbidden === true, "filesystemWatcherHarness must forbid provider submission");
assert(harness.liveSubmitAllowed === false, "filesystemWatcherHarness liveSubmitAllowed must be false");
assert(harness.summary.daemonStarted === false, "filesystemWatcherHarness summary daemonStarted must be false");
assert(harness.summary.liveSubmitAllowed === false, "filesystemWatcherHarness summary liveSubmitAllowed must be false");

for (const kind of requiredKinds) {
  assert(harness.monitoredKinds.includes(kind), `filesystemWatcherHarness must monitor ${kind}`);
  assert(harness.monitoredRoots.some((root) => root.kind === kind), `filesystemWatcherHarness missing root for ${kind}`);
}

for (const root of harness.monitoredRoots) {
  assert(root.pathPolicy === "derived_static_only", `${root.rootId} must be derived/static only`);
  assert(root.daemonStarted === false, `${root.rootId} must not start daemon`);
}

const locks = harness.hardLocks;
assert(locks.watcherCannotPromoteFormal === true, "watcherCannotPromoteFormal lock must be true");
assert(locks.workerSelfReportCannotComplete === true, "workerSelfReportCannotComplete lock must be true");
assert(locks.tempOutputDraftOnly === true, "tempOutputDraftOnly lock must be true");
assert(locks.semanticPostprocessForbidden === true, "semanticPostprocessForbidden lock must be true");
assert(locks.liveSubmitAllowed === false, "hard lock liveSubmitAllowed must be false");
assert(locks.providerSubmissionForbidden === true, "hard lock providerSubmissionForbidden must be true");

const watcherEvents = state.imagePipeline.watcherEvents;
const streamByEventId = new Map(harness.streams.map((stream) => [stream.sourceEventId, stream]));
assert(harness.streams.length === watcherEvents.length, "each watcher event must map to one watcher harness stream");
for (const event of watcherEvents) {
  const stream = streamByEventId.get(event.id);
  assert(stream, `watcher event ${event.id} missing from filesystemWatcherHarness.streams`);
  assert(stream.eventType === event.eventType, `${event.id} eventType must be preserved`);
  assert(stream.taskPlanId === event.taskId, `${event.id} taskPlanId must mirror watcher event taskId`);
  assert(typeof stream.requiresManifestMatch === "boolean", `${event.id} requiresManifestMatch is required`);
  assert(typeof stream.requiresQaPass === "boolean", `${event.id} requiresQaPass is required`);
  assert(typeof stream.draftOnly === "boolean", `${event.id} draftOnly is required`);
  assert(typeof stream.canPromoteFormal === "boolean", `${event.id} canPromoteFormal is required`);
  assert(typeof stream.canBecomeFutureReference === "boolean", `${event.id} canBecomeFutureReference is required`);
}

const generationJobs = new Set(state.generationHarness.jobs.map((job) => job.harnessJobId));
for (const stream of harness.streams) {
  if (stream.harnessLinkStatus === "linked") {
    assert(generationJobs.has(stream.generationHarnessJobId), `${stream.streamId} linked to unknown generation harness job`);
  } else {
    assert(stream.missingHarnessLinkReason, `${stream.streamId} missing harness link must include a reason`);
  }
}

const tempOrCandidate = harness.streams.filter((stream) =>
  ["temp_candidate", "provider_ready_derivative", "postprocess_recoverable"].includes(stream.artifactClass),
);
for (const stream of tempOrCandidate) {
  assert(stream.draftOnly === true, `${stream.streamId} ${stream.artifactClass} must be draft-only`);
  assert(stream.canPromoteFormal === false, `${stream.streamId} ${stream.artifactClass} cannot promote formal`);
  assert(stream.canBecomeFutureReference === false, `${stream.streamId} ${stream.artifactClass} cannot become future reference`);
}

const promotionByTaskPlan = new Map(state.imagePipeline.qaPromotionReports.map((report) => [report.taskPlanId, report]));
for (const stream of harness.streams) {
  const promotion = promotionByTaskPlan.get(stream.taskPlanId);
  if (stream.canPromoteFormal) {
    assert(promotion?.canPromoteToFormal === true, `${stream.streamId} canPromoteFormal must come from qaPromotion.canPromoteToFormal`);
    assert(stream.qaPromotionReportId === promotion.reportId, `${stream.streamId} must reference the promotion report`);
  }
  if (stream.artifactClass === "formal_output") {
    assert(stream.requiresManifestMatch === true, `${stream.streamId} formal output still requires manifest match evidence`);
    assert(stream.requiresQaPass === true, `${stream.streamId} formal output still requires QA pass evidence`);
  }
}

const schema = readJson("schemas/filesystem_watcher_harness.schema.json");
assert(schema.title === "FilesystemWatcherHarnessState", "filesystem watcher harness schema title drifted");
assert(schema.properties.fsWatchDaemonEnabled.const === false, "schema must pin fsWatchDaemonEnabled false");
assert(schema.properties.daemonStarted.const === false, "schema must pin daemonStarted false");
assert(schema.properties.liveSubmitAllowed.const === false, "schema must pin liveSubmitAllowed false");
assert(schema.properties.hardLocks.$ref === "#/$defs/hardLocks", "schema must define hard locks");
assert(schema.$defs.hardLocks.properties.watcherCannotPromoteFormal.const === true, "schema must pin watcherCannotPromoteFormal true");
assert(schema.$defs.hardLocks.properties.workerSelfReportCannotComplete.const === true, "schema must pin worker self-report lock true");
assert(schema.$defs.hardLocks.properties.tempOutputDraftOnly.const === true, "schema must pin tempOutputDraftOnly true");
assert(schema.$defs.hardLocks.properties.semanticPostprocessForbidden.const === true, "schema must pin semantic postprocess lock true");

const projectSchema = readJson("schemas/project_runtime_state.schema.json");
assert(projectSchema.required.includes("filesystemWatcherHarness"), "project runtime schema must require filesystemWatcherHarness");
assert(
  projectSchema.properties.filesystemWatcherHarness.$ref === "filesystem_watcher_harness.schema.json",
  "project runtime schema must reference filesystem_watcher_harness schema",
);

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("filesystem_watcher_harness.schema.json"), "schema registry must include filesystem_watcher_harness.schema.json");

console.log(`Filesystem watcher harness tests passed: ${harness.streams.length} streams, ${harness.summary.missingHarnessLinks} missing harness links.`);
