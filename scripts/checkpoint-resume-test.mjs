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

assert(importResult.status === 0, "checkpoint resume test could not refresh runtime-state with import-runtime-test");

const state = readJson("public/runtime-state.json");
const harness = state.checkpointResumeHarness;
assert(harness, "runtime-state missing checkpointResumeHarness");
assert(harness.schemaVersion === "0.1.0", "checkpointResumeHarness schemaVersion drifted");
assert(harness.dryRunOnly === true, "checkpointResumeHarness dryRunOnly must be true");
assert(harness.providerSubmissionForbidden === true, "checkpointResumeHarness must forbid provider submission");
assert(harness.liveSubmitAllowed === false, "checkpointResumeHarness liveSubmitAllowed must be false");
assert(harness.noFileMutation === true, "checkpointResumeHarness must forbid file mutation");
assert(harness.planOnly === true, "checkpointResumeHarness must be plan-only");
assert(harness.summary.dryRunOnly === true, "checkpointResumeHarness summary dryRunOnly must be true");
assert(harness.summary.liveSubmitAllowed === false, "checkpointResumeHarness summary liveSubmitAllowed must be false");
assert(harness.summary.noFileMutation === true, "checkpointResumeHarness summary noFileMutation must be true");

const locks = harness.hardLocks;
assert(locks.dryRunOnly === true, "hard lock dryRunOnly must be true");
assert(locks.providerSubmissionForbidden === true, "hard lock providerSubmissionForbidden must be true");
assert(locks.liveSubmitAllowed === false, "hard lock liveSubmitAllowed must be false");
assert(locks.noFileMutation === true, "hard lock noFileMutation must be true");
assert(locks.noAutoSkipWithoutQa === true, "hard lock noAutoSkipWithoutQa must be true");
assert(locks.workerSelfReportCannotComplete === true, "hard lock workerSelfReportCannotComplete must be true");
assert(locks.tempCandidateCannotResumeAsFormal === true, "hard lock tempCandidateCannotResumeAsFormal must be true");

const imageTaskPlans = state.imagePipeline.imageTaskPlans;
assert(Array.isArray(harness.items) && harness.items.length === imageTaskPlans.length, "each imageTaskPlan must have one resume item");
assert(harness.summary.totalItems === harness.items.length, "summary totalItems must match item count");

const itemByTaskPlan = new Map(harness.items.map((item) => [item.taskPlanId, item]));
for (const taskPlan of imageTaskPlans) {
  const item = itemByTaskPlan.get(taskPlan.taskPlanId);
  assert(item, `${taskPlan.taskPlanId} missing checkpoint resume item`);
  assert(item.jobId === taskPlan.jobId, `${taskPlan.taskPlanId} jobId must match imageTaskPlan`);
  assert(item.shotId === taskPlan.shotId, `${taskPlan.taskPlanId} shotId must match imageTaskPlan`);
  assert(item.expectedOutputPath === taskPlan.expectedOutputPath, `${taskPlan.taskPlanId} expectedOutputPath must match imageTaskPlan`);
  assert(typeof item.manifestStatus === "string" && item.manifestStatus.length > 0, `${item.resumeItemId} manifestStatus is required`);
  assert(typeof item.healthStatus === "string" && item.healthStatus.length > 0, `${item.resumeItemId} healthStatus is required`);
  assert(typeof item.qaStatus === "string" && item.qaStatus.length > 0, `${item.resumeItemId} qaStatus is required`);
  assert(Array.isArray(item.watcherStreamIds), `${item.resumeItemId} watcherStreamIds is required`);
  assert(typeof item.skipAllowed === "boolean", `${item.resumeItemId} skipAllowed is required`);
  assert(typeof item.rerunAllowed === "boolean", `${item.resumeItemId} rerunAllowed is required`);
  assert(typeof item.manualReviewRequired === "boolean", `${item.resumeItemId} manualReviewRequired is required`);
  assert(Array.isArray(item.blockingReasons), `${item.resumeItemId} blockingReasons is required`);
  assert(Array.isArray(item.notes), `${item.resumeItemId} notes is required`);
}

const promotionByTaskPlan = new Map(state.imagePipeline.qaPromotionReports.map((report) => [report.taskPlanId, report]));
const healthByTaskPlan = new Map(state.imagePipeline.generationHealthReports.map((report) => [report.taskPlanId, report]));
const watcherStreamById = new Map(state.filesystemWatcherHarness.streams.map((stream) => [stream.streamId, stream]));
const generationJobs = new Set(state.generationHarness.jobs.map((job) => job.harnessJobId));

for (const item of harness.items) {
  const promotion = promotionByTaskPlan.get(item.taskPlanId);
  const health = healthByTaskPlan.get(item.taskPlanId);
  if (item.harnessJobId) {
    assert(generationJobs.has(item.harnessJobId), `${item.resumeItemId} links to unknown generation harness job`);
  }
  for (const streamId of item.watcherStreamIds) {
    const stream = watcherStreamById.get(streamId);
    assert(stream, `${item.resumeItemId} links to unknown watcher stream ${streamId}`);
    assert(stream.taskPlanId === item.taskPlanId, `${item.resumeItemId} watcher stream ${streamId} belongs to a different taskPlan`);
  }
  if (item.skipAllowed) {
    assert(promotion?.canPromoteToFormal === true, `${item.resumeItemId} skipAllowed requires qaPromotion.canPromoteToFormal`);
    assert(item.canPromoteToFormal === true, `${item.resumeItemId} skipAllowed requires item canPromoteToFormal`);
    assert(item.qaStatus === "pass", `${item.resumeItemId} skipAllowed requires QA pass`);
    assert(["actual_output_present", "complete", "matched"].includes(item.manifestStatus), `${item.resumeItemId} skipAllowed requires manifest match`);
    assert(item.formalPathExists === true, `${item.resumeItemId} skipAllowed requires existing formal path`);
    assert(health?.stalePrompt !== true, `${item.resumeItemId} stale prompt must block skip`);
  }
  if (!item.expectedOutputExists) {
    assert(item.rerunAllowed === true, `${item.resumeItemId} missing expected output must allow dry-run rerun`);
    assert(item.skipAllowed === false, `${item.resumeItemId} missing expected output cannot skip`);
  }
}

const tempOrDerivativeStreams = state.filesystemWatcherHarness.streams.filter((stream) =>
  ["temp_candidate", "provider_ready_derivative", "postprocess_recoverable"].includes(stream.artifactClass),
);
for (const stream of tempOrDerivativeStreams) {
  const item = itemByTaskPlan.get(stream.taskPlanId);
  assert(item, `${stream.streamId} missing linked resume item`);
  assert(item.skipAllowed === false, `${item.resumeItemId} temp/candidate/provider-ready derivative cannot skip`);
  assert(
    item.manualReviewRequired === true || item.rerunAllowed === true,
    `${item.resumeItemId} temp/candidate/provider-ready derivative must require manual review or rerun`,
  );
}

const missingOutputItems = harness.items.filter((item) => !item.expectedOutputExists);
assert(missingOutputItems.length === harness.summary.missingExpectedOutput, "summary missingExpectedOutput must match item facts");
assert(
  harness.summary.linkedWatcherStreams === harness.items.reduce((count, item) => count + item.watcherStreamIds.length, 0),
  "summary linkedWatcherStreams must match item links",
);
assert(
  harness.summary.linkedGenerationHarnessJobs === harness.items.filter((item) => item.harnessJobId).length,
  "summary linkedGenerationHarnessJobs must match item links",
);

const schema = readJson("schemas/checkpoint_resume_harness.schema.json");
assert(schema.title === "CheckpointResumeHarnessState", "checkpoint resume harness schema title drifted");
assert(schema.properties.dryRunOnly.const === true, "schema must pin dryRunOnly true");
assert(schema.properties.providerSubmissionForbidden.const === true, "schema must pin providerSubmissionForbidden true");
assert(schema.properties.liveSubmitAllowed.const === false, "schema must pin liveSubmitAllowed false");
assert(schema.properties.noFileMutation.const === true, "schema must pin noFileMutation true");
assert(schema.properties.planOnly.const === true, "schema must pin planOnly true");
assert(schema.$defs.hardLocks.properties.noAutoSkipWithoutQa.const === true, "schema must pin noAutoSkipWithoutQa true");
assert(schema.$defs.hardLocks.properties.workerSelfReportCannotComplete.const === true, "schema must pin worker self-report lock true");
assert(schema.$defs.hardLocks.properties.tempCandidateCannotResumeAsFormal.const === true, "schema must pin temp candidate lock true");

const projectSchema = readJson("schemas/project_runtime_state.schema.json");
assert(projectSchema.required.includes("checkpointResumeHarness"), "project runtime schema must require checkpointResumeHarness");
assert(
  projectSchema.properties.checkpointResumeHarness.$ref === "checkpoint_resume_harness.schema.json",
  "project runtime schema must reference checkpoint_resume_harness schema",
);

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("checkpoint_resume_harness.schema.json"), "schema registry must include checkpoint_resume_harness.schema.json");

console.log(
  `Checkpoint resume harness tests passed: ${harness.items.length} items, ${harness.summary.rerunAllowed} rerun-allowed, ${harness.summary.manualReviewRequired} manual-review.`,
);
