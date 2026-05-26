import fs from "node:fs";

import { appendTaskRunEvent, createTaskRunLedger, projectTaskRunLedger } from "../src/core/taskRunLedger.ts";
import { evaluateRuntimeArtifactFacts, ingestAppServerEvent, ingestQueueDecision, ingestWatcherFileEvent, ingestWorkerLease, runtimeIngestHardLocks } from "../src/core/runtimeIngestShell.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function baseLedger(createTaskRunLedger) {
  return createTaskRunLedger({
    projectId: "project_1",
    taskRunId: "task_S01",
    envelopeId: "envelope_S01",
    createdAt: "2026-05-05T00:00:00.000Z",
    expectedOutputs: ["outputs/S01/start.png"],
  });
}

function appendMany(appendTaskRunEvent, ledger, events) {
  return events.reduce((nextLedger, event, index) => appendTaskRunEvent(nextLedger, {
    at: `2026-05-05T00:00:${String(index + 1).padStart(2, "0")}.000Z`,
    ...event,
  }), ledger);
}

function leaseInput(status, overrides = {}) {
  return {
    taskRunId: "task_S01",
    envelopeId: "envelope_S01",
    leaseId: `lease_${status}`,
    workerId: "worker_image2_1",
    threadId: "thread_S01",
    turnId: "turn_S01",
    leasedAt: "2026-05-05T00:00:01.000Z",
    expiresAt: "2026-05-05T00:10:01.000Z",
    status,
    retryBudget: 2,
    retryCount: 0,
    stallTimeoutSeconds: 600,
    resumePolicy: "reassign_allowed",
    at: "2026-05-05T00:00:02.000Z",
    now: "2026-05-05T00:00:03.000Z",
    ...overrides,
  };
}

assert(runtimeIngestHardLocks.liveTransportEnabled === false, "runtime ingest live transport must default off");
assert(runtimeIngestHardLocks.canLaunchAppServer === false, "runtime ingest must not launch app-server");
assert(runtimeIngestHardLocks.ingestOnly === true, "runtime ingest must stay ingest-only");
assert(runtimeIngestHardLocks.fsWatchDaemonEnabled === false, "runtime ingest shell must not start a real watcher daemon");

const leased = ingestWorkerLease(leaseInput("leased"));
const running = ingestWorkerLease(leaseInput("running"));
const stalled = ingestWorkerLease(leaseInput("stalled", { retryCount: 1 }));
const interrupted = ingestWorkerLease(leaseInput("interrupted", { retryCount: 1 }));
const failed = ingestWorkerLease(leaseInput("failed"));
assert(leased.ledgerEvents[0].eventType === "task_leased", "leased status should project task_leased");
assert(running.ledgerEvents[0].eventType === "task_running", "running status should project task_running");
assert(stalled.ledgerEvents[0].eventType === "stalled", "stalled status should project stalled");
assert(interrupted.ledgerEvents[0].eventType === "interrupted", "interrupted status should project interrupted");
assert(failed.ledgerEvents[0].eventType === "failed", "failed status should project failed");
assert(interrupted.resumability.reassignable === true, "interrupted lease should be reassignable while retry budget remains");

const leaseLedger = appendMany(appendTaskRunEvent, baseLedger(createTaskRunLedger), [
  { eventType: "task_prepared" },
  leased.ledgerEvents[0],
  running.ledgerEvents[0],
]);
const leaseProjection = projectTaskRunLedger(leaseLedger);
assert(leaseProjection.currentStatus === "running", "running lease event should project running status");
assert(leaseProjection.currentLease.workerId === "worker_image2_1", "lease projection should retain workerId");
assert(leaseProjection.currentLease.threadId === "thread_S01", "lease projection should retain threadId");
assert(leaseProjection.currentLease.retryBudget === 2, "lease projection should retain retryBudget");

const expiredRunning = ingestWorkerLease(leaseInput("running", {
  expiresAt: "2026-05-05T00:00:02.000Z",
  now: "2026-05-05T00:00:03.000Z",
}));
assert(expiredRunning.blockers.some((blocker) => /Expired lease/.test(blocker)), "expired running lease should block continuation");
assert(expiredRunning.ledgerEvents.length === 0, "expired running lease must not emit a running ledger event");

const queued = ingestQueueDecision({
  taskRunId: "task_S01",
  envelopeId: "envelope_S01",
  providerPolicyStatus: "enabled",
  userEnabled: true,
  capacityStatus: "full",
});
assert(queued.status === "queued", "capacity pressure should remain queued, not parked");
assert(queued.ledgerEvents[0].eventType === "task_queued", "queued ingest should emit task_queued");
assert(queued.warnings.some((warning) => /Capacity/.test(warning)), "queued capacity warning missing");

const parked = ingestQueueDecision({
  taskRunId: "task_video_1",
  envelopeId: "envelope_video_1",
  providerPolicyStatus: "planned",
  userEnabled: true,
  capacityStatus: "available",
  reason: "Video provider is planned only.",
});
assert(parked.status === "parked", "provider policy block should be parked");
assert(parked.ledgerEvents[0].eventType === "parked", "parked ingest should emit parked");

const blockedQueue = ingestQueueDecision({
  taskRunId: "task_bad",
  providerPolicyStatus: "enabled",
  userEnabled: true,
  preflightBlocked: true,
});
assert(blockedQueue.status === "blocked", "preflight block should remain blocked, not parked");
assert(blockedQueue.ledgerEvents.length === 0, "blocked queue ingest should not append ledger events");

const created = ingestWatcherFileEvent({
  eventId: "watch_created_S01",
  eventType: "created",
  at: "2026-05-05T00:01:00.000Z",
  source: "fs_watch",
  taskRunId: "task_S01",
  envelopeId: "envelope_S01",
  path: "outputs/S01/start.png",
  expectedOutputPath: "outputs/S01/start.png",
  sandboxAllowedPrefixes: ["outputs", "reports"],
});
assert(created.ledgerEvents[0].eventType === "task_waiting_output", "created file event should wait for settled output");
assert(!created.output, "created file event must not become output before hash/settle");

const hashObserved = ingestWatcherFileEvent({
  eventId: "watch_hash_S01",
  eventType: "hash_observed",
  at: "2026-05-05T00:01:01.000Z",
  source: "fs_watch",
  taskRunId: "task_S01",
  envelopeId: "envelope_S01",
  path: "outputs/S01/start.png",
  expectedOutputPath: "outputs/S01/start.png",
  hash: "sha256-output-S01",
  hashAlgorithm: "sha256",
  byteLength: 2048,
  sandboxAllowedPrefixes: ["outputs", "reports"],
});
assert(hashObserved.output.hash === "sha256-output-S01", "hash_observed should produce an output fact");
assert(hashObserved.ledgerEvents[0].eventType === "output_detected_no_sidecar", "hash_observed should compile to output ledger event");

const verifyNormal = ingestWatcherFileEvent({
  eventId: "watch_verify_bad",
  eventType: "hash_observed",
  at: "2026-05-05T00:01:02.000Z",
  source: "verify_scan",
  sourceIntent: "normal",
  taskRunId: "task_S01",
  path: "outputs/S01/start.png",
  hash: "sha256-output-S01",
  sandboxAllowedPrefixes: ["outputs"],
});
assert(verifyNormal.blockers.some((blocker) => /verify_scan/.test(blocker)), "verify_scan normal source must be blocked");

const verifyRecovery = ingestWatcherFileEvent({
  eventId: "watch_verify_recovery",
  eventType: "hash_observed",
  at: "2026-05-05T00:01:03.000Z",
  source: "verify_scan",
  sourceIntent: "recovery",
  taskRunId: "task_S01",
  path: "outputs/S01/start.png",
  hash: "sha256-output-S01",
  sandboxAllowedPrefixes: ["outputs"],
});
assert(verifyRecovery.blockers.length === 0, "verify_scan recovery source should be allowed as recovery evidence");
assert(verifyRecovery.warnings.some((warning) => /recovery\/audit/.test(warning)), "verify_scan recovery warning missing");

const absolutePath = ingestWatcherFileEvent({
  eventId: "watch_absolute",
  eventType: "hash_observed",
  at: "2026-05-05T00:01:04.000Z",
  source: "fs_watch",
  taskRunId: "task_S01",
  path: "/tmp/start.png",
  hash: "sha256-output-S01",
  sandboxAllowedPrefixes: ["outputs"],
});
assert(absolutePath.blockers.some((blocker) => /not absolute/.test(blocker)), "absolute watcher paths must be blocked");

const traversalPath = ingestWatcherFileEvent({
  eventId: "watch_traversal",
  eventType: "hash_observed",
  at: "2026-05-05T00:01:05.000Z",
  source: "fs_watch",
  taskRunId: "task_S01",
  path: "outputs/../secret.png",
  hash: "sha256-output-S01",
  sandboxAllowedPrefixes: ["outputs"],
});
assert(traversalPath.blockers.some((blocker) => /parent traversal/.test(blocker)), "parent traversal watcher paths must be blocked");

const outsidePath = ingestWatcherFileEvent({
  eventId: "watch_outside",
  eventType: "hash_observed",
  at: "2026-05-05T00:01:06.000Z",
  source: "fs_watch",
  taskRunId: "task_S01",
  path: "outside/S01/start.png",
  hash: "sha256-output-S01",
  sandboxAllowedPrefixes: ["outputs"],
});
assert(outsidePath.blockers.some((blocker) => /sandbox allowed prefixes/.test(blocker)), "outside sandbox watcher paths must be blocked");

const providerPair = ingestWatcherFileEvent({
  eventId: "watch_provider_sidecar",
  eventType: "sidecar_paired",
  at: "2026-05-05T00:01:07.000Z",
  source: "fs_watch",
  taskRunId: "task_S01",
  envelopeId: "envelope_S01",
  path: "outputs/S01/start.provider-observation.json",
  expectedOutputPath: "outputs/S01/start.png",
  sandboxAllowedPrefixes: ["outputs", "reports"],
  sidecar: {
    kind: "provider_observation",
    providerId: "openai-image2-api",
    observationId: "provider_obs_S01",
    outputPath: "outputs/S01/start.png",
    outputHash: "sha256-output-S01",
    sidecarPath: "outputs/S01/start.provider-observation.json",
    sidecarHash: "sha256-provider-sidecar-S01",
    threadId: "thread_S01",
    turnId: "turn_S01",
    toolCallId: "tool_S01",
  },
});
assert(providerPair.providerObservation.outputHash === "sha256-output-S01", "provider sidecar should produce provider observation fact");

const qaPair = ingestWatcherFileEvent({
  eventId: "watch_qa_sidecar",
  eventType: "sidecar_paired",
  at: "2026-05-05T00:01:08.000Z",
  source: "fs_watch",
  taskRunId: "task_S01",
  envelopeId: "envelope_S01",
  path: "outputs/S01/start.semantic-qa.json",
  expectedOutputPath: "outputs/S01/start.png",
  sandboxAllowedPrefixes: ["outputs", "reports"],
  sidecar: {
    kind: "semantic_qa",
    outputPath: "outputs/S01/start.png",
    reviewedOutputHash: "sha256-output-S01",
    sidecarPath: "outputs/S01/start.semantic-qa.json",
    sidecarHash: "sha256-qa-sidecar-S01",
    stableFindingIds: [],
    status: "pass",
    p0FindingCount: 0,
    p1FindingCount: 0,
    p2FindingCount: 0,
  },
});
assert(qaPair.semanticQa.reviewedOutputHash === "sha256-output-S01", "QA sidecar should produce semantic QA fact");

const artifactGate = evaluateRuntimeArtifactFacts({
  taskRunId: "task_S01",
  envelopeId: "envelope_S01",
  expectedOutputPath: "outputs/S01/start.png",
  sandboxAllowedPrefixes: ["outputs", "reports"],
  output: hashObserved.output,
  providerObservation: providerPair.providerObservation,
  semanticQa: qaPair.semanticQa,
}, "2026-05-05T00:01:09.000Z");
assert(artifactGate.gateResult.completeVerified === true, "complete watcher/provider/QA facts should satisfy the round 2 artifact gate");
assert(artifactGate.ledgerEvents.some((event) => event.eventType === "complete_verified"), "artifact gate should be the only source of complete_verified ledger events");

const completeLedger = appendMany(appendTaskRunEvent, baseLedger(createTaskRunLedger), [
  { eventType: "task_prepared" },
  queued.ledgerEvents[0],
  leased.ledgerEvents[0],
  running.ledgerEvents[0],
  ...artifactGate.ledgerEvents,
]);
assert(projectTaskRunLedger(completeLedger).currentStatus === "complete_verified", "runtime ingest facts should project through TaskRunLedger as complete only via artifact gate");

const appFsChanged = ingestAppServerEvent({
  event: {
    eventId: "app_fs_changed_S01",
    eventKind: "fsChanged",
    at: "2026-05-05T00:02:00.000Z",
    taskRunId: "task_S01",
    envelopeId: "envelope_S01",
    threadId: "thread_S01",
    turnId: "turn_S01",
    toolCallId: "tool_S01",
    path: "outputs/S01/start.png",
    expectedOutputPath: "outputs/S01/start.png",
    hash: "sha256-output-S01",
  },
  sandboxAllowedPrefixes: ["outputs", "reports"],
});
assert(appFsChanged.blockers.length === 0, "app-server fsChanged ingest should be allowed as ingest-only facts");
assert(appFsChanged.hardLocks.liveTransportEnabled === false, "app-server ingest hard lock should keep live transport off");
assert(appFsChanged.watcher.output.hash === "sha256-output-S01", "app-server fsChanged should route through watcher ingest");

const appLiveBlocked = ingestAppServerEvent({
  event: {
    eventId: "app_thread_live",
    eventKind: "thread",
    at: "2026-05-05T00:02:01.000Z",
    threadId: "thread_live",
  },
  liveTransportEnabled: true,
  canLaunchAppServer: true,
});
assert(appLiveBlocked.blockers.some((blocker) => /liveTransportEnabled/.test(blocker)), "live app-server transport must be blocked by default");
assert(appLiveBlocked.blockers.some((blocker) => /canLaunchAppServer/.test(blocker)), "app-server launch must be blocked by default");

const source = fs.readFileSync("src/core/runtimeIngestShell.ts", "utf8");
for (const forbiddenCode of ["fetch(", "XMLHttpRequest", "localStorage", "process.env", "spawn(", "exec("]) {
  assert(!source.includes(forbiddenCode), `runtimeIngestShell source must not contain ${forbiddenCode}`);
}

const schema = readJson("schemas/runtime_ingest_shell.schema.json");
assert(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "runtime ingest schema $schema missing");
assert(!JSON.stringify(schema).includes("/Users/"), "runtime ingest schema must not contain absolute local fixture paths");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("runtime_ingest_shell.schema.json"), "schema registry must include runtime ingest shell schema");
assert(registrySource.includes("RuntimeIngestShell"), "schema registry must include RuntimeIngestShell type");

console.log(
  `Runtime ingest shell tests passed: lease=${leaseProjection.currentStatus}, queue=${queued.status}/${parked.status}, watcher=${hashObserved.eventType}, appServer=${appFsChanged.eventKind}, artifact=${artifactGate.gateResult.status}.`,
);
