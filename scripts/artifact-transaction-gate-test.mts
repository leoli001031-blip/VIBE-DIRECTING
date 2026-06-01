import fs from "node:fs";
import {
  buildArtifactAvailabilitySummaries,
  evaluateArtifactTransactionGate,
  toTaskRunLedgerEvents,
} from "../src/core/artifactTransactionGate.ts";
import {
  appendTaskRunEvent,
  createTaskRunLedger,
  projectTaskRunLedger,
} from "../src/core/taskRunLedger.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function baseFacts(overrides = {}) {
  return {
    taskRunId: "task_S01",
    envelopeId: "envelope_S01",
    expectedOutputPath: "outputs/S01/start.png",
    output: {
      path: "outputs/S01/start.png",
      hash: "sha256-output-S01",
      hashAlgorithm: "sha256",
      byteLength: 2048,
    },
    providerObservation: {
      providerId: "openai-image2-api",
      observationId: "provider_obs_S01",
      outputPath: "outputs/S01/start.png",
      outputHash: "sha256-output-S01",
      sidecarPath: "outputs/S01/start.provider-observation.json",
      sidecarHash: "sha256-provider-sidecar-S01",
      threadId: "thread_S01",
      turnId: "turn_S01",
      toolCallId: "tool_call_S01",
    },
    semanticQa: {
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
    sandboxAllowedPrefixes: ["outputs", "reports"],
    ...overrides,
  };
}

function without(value, key) {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function appendMany(ledger, events) {
  return events.reduce((nextLedger, event, index) => appendTaskRunEvent(nextLedger, {
    at: `2026-05-05T00:00:${String(index + 1).padStart(2, "0")}.000Z`,
    ...event,
  }), ledger);
}

const completeWithP2 = evaluateArtifactTransactionGate(baseFacts({
  semanticQa: {
    ...baseFacts().semanticQa,
    stableFindingIds: ["style.arcade_texture.low_texture_drift"],
    p2FindingCount: 1,
  },
}));
assert(completeWithP2.status === "complete_verified", "P2 findings should not block by default");
assert(completeWithP2.completeVerified === true, "complete fixture should satisfy artifact gate");
assert(completeWithP2.trendFeedback.length === 1, "P2 should produce trend feedback");
assert(completeWithP2.canUseForPreview === true, "complete artifact should be available for preview");
assert(completeWithP2.canUseForExport === true, "complete artifact should be available for export");
assert(completeWithP2.canUseForPromotion === true, "complete artifact should be available for promotion");

const summaries = buildArtifactAvailabilitySummaries(completeWithP2);
assert(summaries.length === 3, "availability summaries should cover preview/export/promotion");
assert(summaries.every((summary) => summary.available), "only complete fixture should be available for every usage summary");
assert(summaries.every((summary) => summary.artifactPath === "outputs/S01/start.png"), "availability summaries should expose verified artifact path");

const ledger = createTaskRunLedger({
  taskRunId: "task_S01",
  envelopeId: "envelope_S01",
  createdAt: "2026-05-05T00:00:00.000Z",
  expectedOutputs: ["outputs/S01/start.png"],
});
const ledgerEvents = toTaskRunLedgerEvents(completeWithP2, "2026-05-05T00:00:01.000Z");
assert(ledgerEvents.map((event) => event.eventType).join("|") === "output_detected_no_sidecar|provider_observed|qa_passed|complete_verified", "complete gate should compile to output/provider/qa_passed/complete ledger events");
const projection = projectTaskRunLedger(appendMany(ledger, ledgerEvents));
assert(projection.currentStatus === "complete_verified", "compiled events should satisfy TaskRunLedger projection");
assert(projection.providerObservation.appServerThreadId === "thread_S01", "provider thread id should map into ledger observation");
assert(projection.providerObservation.appServerTurnId === "turn_S01", "provider turn id should map into ledger observation");
assert(projection.providerObservation.appServerToolCallId === "tool_call_S01", "provider tool call id should map into ledger observation");

const missingProvider = evaluateArtifactTransactionGate(baseFacts({ providerObservation: undefined }));
assert(missingProvider.status === "image_exists_but_provider_observation_missing", "missing provider sidecar should be first-class status");
assert(missingProvider.completeVerified === false, "missing provider sidecar cannot complete");
assert(buildArtifactAvailabilitySummaries(missingProvider).every((summary) => !summary.available), "non-complete artifact must not be available");
assert(buildArtifactAvailabilitySummaries(missingProvider).every((summary) => /complete_verified/.test(summary.messageForUser)), "blocker should be creator-readable");

const missingProviderSidecarHash = evaluateArtifactTransactionGate(baseFacts({
  providerObservation: without(baseFacts().providerObservation, "sidecarHash"),
}));
assert(missingProviderSidecarHash.status === "image_exists_but_provider_observation_missing", "provider observation without sidecar hash should remain missing-sidecar status");
assert(missingProviderSidecarHash.blockers.some((blocker) => /sidecarHash/.test(blocker)), "missing provider sidecar hash blocker missing");

const providerMismatch = evaluateArtifactTransactionGate(baseFacts({
  providerObservation: {
    ...baseFacts().providerObservation,
    outputHash: "sha256-other-output",
  },
}));
assert(providerMismatch.status === "sidecar_mismatch", "provider output hash mismatch should be sidecar_mismatch");
assert(providerMismatch.completeVerified === false, "provider mismatch cannot complete");

const missingQa = evaluateArtifactTransactionGate(baseFacts({ semanticQa: undefined }));
assert(missingQa.status === "provider_observed_but_qa_pending", "missing semantic QA should be provider_observed_but_qa_pending");
assert(toTaskRunLedgerEvents(missingQa).some((event) => event.eventType === "qa_pending"), "missing QA should compile to qa_pending");

const qaUnbound = evaluateArtifactTransactionGate(baseFacts({
  semanticQa: without(baseFacts().semanticQa, "reviewedOutputHash"),
}));
assert(qaUnbound.status === "semantic_qa_pending", "QA without reviewed output hash should be semantic_qa_pending");
assert(qaUnbound.blockers.some((blocker) => /reviewedOutputHash/.test(blocker)), "reviewed output hash blocker missing");

const qaSidecarMissing = evaluateArtifactTransactionGate(baseFacts({
  semanticQa: without(baseFacts().semanticQa, "sidecarHash"),
}));
assert(qaSidecarMissing.status === "semantic_qa_pending", "QA without sidecar hash should be semantic_qa_pending");
assert(qaSidecarMissing.completeVerified === false, "missing QA sidecar cannot complete");

const qaMismatch = evaluateArtifactTransactionGate(baseFacts({
  semanticQa: {
    ...baseFacts().semanticQa,
    reviewedOutputHash: "sha256-other-output",
  },
}));
assert(qaMismatch.status === "sidecar_mismatch", "QA reviewed hash mismatch should be sidecar_mismatch");

const sandboxBlocked = evaluateArtifactTransactionGate(baseFacts({
  expectedOutputPath: "outside/S01/start.png",
  output: {
    ...baseFacts().output,
    path: "outside/S01/start.png",
  },
  providerObservation: {
    ...baseFacts().providerObservation,
    outputPath: "outside/S01/start.png",
  },
  semanticQa: {
    ...baseFacts().semanticQa,
    outputPath: "outside/S01/start.png",
  },
}));
assert(sandboxBlocked.status === "blocked", "outside sandbox path should block");
assert(sandboxBlocked.blockers.some((blocker) => /sandbox allowed prefixes/.test(blocker)), "sandbox blocker missing");

const absolutePathBlocked = evaluateArtifactTransactionGate(baseFacts({
  expectedOutputPath: "/tmp/S01/start.png",
  output: {
    ...baseFacts().output,
    path: "/tmp/S01/start.png",
  },
  providerObservation: {
    ...baseFacts().providerObservation,
    outputPath: "/tmp/S01/start.png",
  },
  semanticQa: {
    ...baseFacts().semanticQa,
    outputPath: "/tmp/S01/start.png",
  },
}));
assert(absolutePathBlocked.status === "blocked", "absolute paths should block");
assert(absolutePathBlocked.blockers.some((blocker) => /not absolute/.test(blocker)), "absolute path blocker missing");

const p0Blocked = evaluateArtifactTransactionGate(baseFacts({
  semanticQa: {
    ...baseFacts().semanticQa,
    stableFindingIds: ["composition.identity.p0"],
    status: "failed",
    p0FindingCount: 1,
  },
}));
assert(p0Blocked.status === "blocked", "P0 semantic QA should block");
assert(toTaskRunLedgerEvents(p0Blocked).some((event) => event.eventType === "failed"), "P0 should compile to failed ledger event");

const p1NeedsReview = evaluateArtifactTransactionGate(baseFacts({
  semanticQa: {
    ...baseFacts().semanticQa,
    stableFindingIds: ["style.arcade_texture.p1"],
    status: "needs_review",
    p1FindingCount: 1,
  },
}));
assert(p1NeedsReview.status === "needs_review", "P1 semantic QA should require review");
assert(toTaskRunLedgerEvents(p1NeedsReview).some((event) => event.eventType === "needs_review"), "P1 should compile to needs_review ledger event");

const p2PolicyNeedsReview = evaluateArtifactTransactionGate(baseFacts({
  policy: { blockOnP2Findings: true },
  semanticQa: {
    ...baseFacts().semanticQa,
    stableFindingIds: ["style.arcade_texture.p2"],
    p2FindingCount: 1,
  },
}));
assert(p2PolicyNeedsReview.status === "needs_review", "P2 should need review when policy blocks P2");
assert(p2PolicyNeedsReview.completeVerified === false, "P2 block policy should prevent complete_verified");

const source = fs.readFileSync("src/core/artifactTransactionGate.ts", "utf8");
for (const forbiddenCode of ["fetch(", "XMLHttpRequest", "localStorage", "process.env", "spawn(", "exec("]) {
  assert(!source.includes(forbiddenCode), `artifactTransactionGate source must not contain ${forbiddenCode}`);
}

const schema = readJson("schemas/artifact_transaction_gate.schema.json");
assert(schema.title === "ArtifactTransactionGate", "schema title drifted");
for (const status of [
  "image_exists_but_provider_observation_missing",
  "provider_observed_but_qa_pending",
  "semantic_qa_pending",
  "sidecar_mismatch",
  "needs_review",
  "complete_verified",
  "blocked",
]) {
  assert(schema.$defs.status.enum.includes(status), `schema must include status ${status}`);
}
assert(JSON.stringify(schema).includes("reviewedOutputHash"), "schema must require QA hash binding field");
assert(JSON.stringify(schema).includes("threadId"), "schema must reserve provider thread id");
assert(JSON.stringify(schema).includes("toolCallId"), "schema must reserve provider tool call id");
assert(!JSON.stringify(schema).includes("/Users/"), "schema must not contain absolute local fixture paths");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("artifact_transaction_gate.schema.json"), "schema registry must include artifact transaction schema");
assert(registrySource.includes("ArtifactTransactionGate"), "schema registry must include ArtifactTransactionGate type");

console.log(
  `Artifact transaction gate tests passed: complete=${completeWithP2.status}, missing_provider=${missingProvider.status}, missing_qa=${missingQa.status}, p1=${p1NeedsReview.status}, p0=${p0Blocked.status}.`,
);
