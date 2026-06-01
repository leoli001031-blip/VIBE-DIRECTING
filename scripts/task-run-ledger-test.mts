import fs from "node:fs";

import { appendTaskRunEvent, createTaskRunLedger, projectTaskRunLedger, projectTaskRunLedgers, validatePortableTaskRunLedgerPaths } from "../src/core/taskRunLedger.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function baseLedger() {
  return createTaskRunLedger({
    projectId: "project_1",
    taskRunId: "task_S01",
    envelopeId: "envelope_S01",
    createdAt: "2026-05-05T00:00:00.000Z",
    expectedOutputs: ["outputs/S01/start.png"],
  });
}

function appendMany(ledger, events) {
  return events.reduce((nextLedger, event, index) => appendTaskRunEvent(nextLedger, {
    at: `2026-05-05T00:00:${String(index + 1).padStart(2, "0")}.000Z`,
    ...event,
  }), ledger);
}

function outputEvidence(hash = "sha256-output-S01") {
  return {
    path: "outputs/S01/start.png",
    hash,
    hashAlgorithm: "sha256",
    byteLength: 1024,
  };
}

function providerObservation(hash = "sha256-output-S01", withSidecar = true) {
  return {
    providerId: "openai-image2-api",
    observationId: "provider_obs_S01",
    outputPath: "outputs/S01/start.png",
    outputHash: hash,
    ...(withSidecar
      ? {
          sidecarPath: "outputs/S01/start.provider-observation.json",
          sidecarHash: "sha256-provider-sidecar-S01",
        }
      : {}),
  };
}

function qaReview(status = "pass", hash = "sha256-output-S01", withSidecar = true) {
  return {
    qaReportId: "qa_S01",
    outputPath: "outputs/S01/start.png",
    reviewedOutputHash: hash,
    ...(withSidecar
      ? {
          sidecarPath: "outputs/S01/start.semantic-qa.json",
          sidecarHash: "sha256-qa-sidecar-S01",
        }
      : {}),
    status,
    findingIds: status === "pass" ? [] : ["style.arcade_texture.p1"],
    p0FindingCount: 0,
    p1FindingCount: status === "needs_review" ? 1 : 0,
    p2FindingCount: 0,
  };
}

const initial = baseLedger();
const appended = appendTaskRunEvent(initial, {
  eventType: "task_prepared",
  at: "2026-05-05T00:00:01.000Z",
});
assert(initial.events.length === 0, "appendTaskRunEvent must not mutate the input ledger");
assert(appended.events.length === 1, "appendTaskRunEvent must append one event");
assert(appended !== initial, "appendTaskRunEvent must return a new ledger object");
assert(appended.events !== initial.events, "appendTaskRunEvent must return a new events array");

const completeLedger = appendMany(baseLedger(), [
  { eventType: "task_prepared" },
  { eventType: "task_queued" },
  { eventType: "task_leased", lease: { owner: "worker_1", leaseId: "lease_S01" } },
  { eventType: "task_running" },
  { eventType: "task_waiting_output" },
  { eventType: "output_detected_no_sidecar", output: outputEvidence() },
  { eventType: "provider_observed", providerObservation: providerObservation() },
  { eventType: "qa_pending" },
  { eventType: "qa_passed", qaReview: qaReview() },
  { eventType: "complete_verified" },
]);
const completeProjection = projectTaskRunLedger(completeLedger);
assert(completeProjection.currentStatus === "complete_verified", "normal path should become complete_verified");
assert(completeProjection.completionGate.completeVerified === true, "normal path should satisfy the completion gate");
assert(completeProjection.manifestSummary.verifiedOutputs[0] === "outputs/S01/start.png", "verified output should feed manifest projection");
assert(completeProjection.reportSummary.completeVerified === true, "report projection should mark complete");
assert(completeProjection.previewSummary.status === "ready", "preview projection should be ready");
assert(completeProjection.creatorProgress.percent === 100, "creator progress should reach 100 on verified completion");
assert(validatePortableTaskRunLedgerPaths(completeLedger).length === 0, "portable paths should validate");

const missingSidecarLedger = appendMany(baseLedger(), [
  { eventType: "task_prepared" },
  { eventType: "task_running" },
  { eventType: "output_detected_no_sidecar", output: outputEvidence() },
  { eventType: "provider_observed", providerObservation: providerObservation("sha256-output-S01", false) },
  { eventType: "qa_passed", qaReview: qaReview() },
  { eventType: "complete_verified" },
]);
const missingSidecarProjection = projectTaskRunLedger(missingSidecarLedger);
assert(missingSidecarProjection.currentStatus !== "complete_verified", "missing provider sidecar must block complete_verified");
assert(
  missingSidecarProjection.completionGate.blockers.some((blocker) => /Provider observation sidecar hash/.test(blocker)),
  "provider sidecar blocker missing",
);

const missingQaLedger = appendMany(baseLedger(), [
  { eventType: "task_prepared" },
  { eventType: "task_running" },
  { eventType: "output_detected_no_sidecar", output: outputEvidence() },
  { eventType: "provider_observed", providerObservation: providerObservation() },
  { eventType: "complete_verified" },
]);
const missingQaProjection = projectTaskRunLedger(missingQaLedger);
assert(missingQaProjection.currentStatus === "provider_observed", "missing QA should leave task provider_observed");
assert(missingQaProjection.completionGate.qaReviewPresent === false, "missing QA must be explicit in the gate");
assert(missingQaProjection.previewSummary.status === "qa_pending", "preview should show QA pending when provider is observed");

const selfReportLedger = appendMany(baseLedger(), [
  { eventType: "task_prepared" },
  { eventType: "task_running" },
  {
    eventType: "worker_self_reported_success",
    workerClaim: {
      status: "success",
      outputPath: "outputs/S01/start.png",
      outputHash: "sha256-output-S01",
      message: "Worker reported success before sidecars arrived.",
    },
  },
  { eventType: "complete_verified" },
]);
const selfReportProjection = projectTaskRunLedger(selfReportLedger);
assert(selfReportProjection.currentStatus === "running", "worker self-report success must not complete or advance gates");
assert(selfReportProjection.completionGate.workerSelfReportIgnored === true, "worker self-report should be marked ignored");
assert(selfReportProjection.reportSummary.warnings.some((warning) => /self-report/i.test(warning)), "self-report warning missing");

const needsReviewLedger = appendMany(baseLedger(), [
  { eventType: "task_prepared" },
  { eventType: "task_running" },
  { eventType: "output_detected_no_sidecar", output: outputEvidence() },
  { eventType: "provider_observed", providerObservation: providerObservation() },
  { eventType: "qa_pending" },
  { eventType: "needs_review", qaReview: qaReview("needs_review") },
  { eventType: "complete_verified" },
]);
const needsReviewProjection = projectTaskRunLedger(needsReviewLedger);
assert(needsReviewProjection.currentStatus === "needs_review", "P1 QA should stay needs_review");
assert(needsReviewProjection.previewSummary.status === "needs_review", "preview should expose needs_review");
assert(needsReviewProjection.completionGate.qaPassed === false, "needs_review QA must not pass the gate");

const stalledLedger = appendMany(baseLedger(), [
  { eventType: "task_prepared" },
  { eventType: "task_running" },
  { eventType: "stalled", reason: "No file event before stall timeout." },
]);
const interruptedLedger = appendMany(baseLedger(), [
  { eventType: "task_prepared" },
  { eventType: "task_running" },
  { eventType: "interrupted", reason: "Worker disconnected before sidecar." },
]);
assert(projectTaskRunLedger(stalledLedger).currentStatus === "stalled", "stalled event should project stalled status");
assert(projectTaskRunLedger(stalledLedger).previewSummary.status === "stalled", "stalled preview status missing");
assert(projectTaskRunLedger(interruptedLedger).currentStatus === "interrupted", "interrupted event should project interrupted status");
assert(projectTaskRunLedger(interruptedLedger).terminal === false, "interrupted should remain recoverable, not terminal");

const parkedLedger = appendMany(baseLedger(), [
  { eventType: "task_prepared" },
  { eventType: "parked", reason: "Provider policy is parked." },
]);
const parkedProjection = projectTaskRunLedger(parkedLedger);
assert(parkedProjection.currentStatus === "parked", "parked provider should project parked");
assert(parkedProjection.terminal === true, "parked should be terminal until policy/user enablement changes");
assert(parkedProjection.previewSummary.status === "parked", "parked preview status missing");

const batchProjection = projectTaskRunLedgers([completeLedger, missingQaLedger, needsReviewLedger, parkedLedger]);
assert(batchProjection.total === 4, "batch projection should include all ledgers");
assert(batchProjection.byStatus.complete_verified === 1, "batch projection should count complete tasks");
assert(batchProjection.byStatus.provider_observed === 1, "batch projection should count provider observed tasks");
assert(batchProjection.byStatus.needs_review === 1, "batch projection should count needs_review tasks");
assert(batchProjection.byStatus.parked === 1, "batch projection should count parked tasks");
assert(/waiting QA/.test(batchProjection.creatorSummary), "batch creator summary should be creator-facing");

const portableProblemLedger = appendTaskRunEvent(baseLedger(), {
  eventType: "output_detected_no_sidecar",
  at: "2026-05-05T00:00:01.000Z",
  output: {
    path: "/tmp/not-portable.png",
    hash: "sha256-output",
  },
});
assert(validatePortableTaskRunLedgerPaths(portableProblemLedger).some((error) => /absolute/.test(error)), "absolute paths must be rejected");

const source = fs.readFileSync("src/core/taskRunLedger.ts", "utf8");
for (const forbiddenCode of ["fetch(", "XMLHttpRequest", "localStorage", "process.env", "spawn(", "exec("]) {
  assert(!source.includes(forbiddenCode), `taskRunLedger source must not contain ${forbiddenCode}`);
}

const schema = readJson("schemas/task_run_ledger.schema.json");
assert(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "task run ledger schema $schema missing");
assert(!JSON.stringify(schema).includes("/Users/"), "schema must not contain absolute local fixture paths");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("task_run_ledger.schema.json"), "schema registry must include task run ledger schema");
assert(registrySource.includes("TaskRunLedger"), "schema registry must include TaskRunLedger type");

console.log(
  `TaskRun ledger tests passed: complete=${batchProjection.byStatus.complete_verified}, qa_waiting=${batchProjection.byStatus.provider_observed}, needs_review=${batchProjection.byStatus.needs_review}, parked=${batchProjection.byStatus.parked}.`,
);
