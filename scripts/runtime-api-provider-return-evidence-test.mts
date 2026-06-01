import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRuntimeApiProviderReturnEvidence } from "./runtime-api-provider-return-evidence.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(values, expected, message) {
  assert(values.includes(expected), message);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleSource = readFileSync(path.join(__dirname, "runtime-api-provider-return-evidence.mjs"), "utf8");
const serverSource = readFileSync(path.join(__dirname, "local-runtime-api-server.mjs"), "utf8");

for (const movedFunction of [
  "providerObservationContextBlockers",
  "actualProviderObservationMatches",
  "actualSemanticQaMatches",
  "readReturnedJson",
]) {
  assert(!serverSource.includes(`function ${movedFunction}`), `local runtime server should import moved evidence code: ${movedFunction}`);
}

for (const forbidden of [
  "provider submit",
  "provider-submit",
  "execute-return",
  "strict-edit",
]) {
  assert(!moduleSource.includes(forbidden), `provider return evidence module must not contain route semantics: ${forbidden}`);
}

const readCalls = [];
const evidence = createRuntimeApiProviderReturnEvidence({
  runtimeRelativeFromValue: (value) => typeof value === "string" ? value.replace(/^\/repo\//, "") : undefined,
  readRuntimeJson: (relativePath) => {
    readCalls.push(relativePath);
    return { fromPath: relativePath };
  },
});

const expectedContext = {
  selectedShotId: "S01",
  receiptId: "receipt-1",
  handoffPacketId: "packet-1",
};
const validObservation = {
  providerObservationMode: "actual_provider_call_observed",
  provider: "openai-image2-api",
  selectedShotId: "S01",
  receiptId: "receipt-1",
  handoffPacketId: "packet-1",
  providerRequestId: "provider-request-1",
  outputPath: "runs/S01/output.png",
  outputSha256: "sha256:abc",
  providerCalled: true,
  actualImage2Triggered: true,
};

const missingContextBlockers = evidence.providerObservationContextBlockers({}, expectedContext);
assertIncludes(missingContextBlockers, "Provider observation must include selectedShotId for the current shot.", "missing selectedShotId blocker should be reported");
assertIncludes(missingContextBlockers, "Provider observation must include receiptId for the current receipt.", "missing receiptId blocker should be reported");
assertIncludes(missingContextBlockers, "Provider observation must include handoffPacketId for the current handoff.", "missing handoffPacketId blocker should be reported");

const mismatchContextBlockers = evidence.providerObservationContextBlockers({
  selectedShotId: "S02",
  receiptId: "receipt-2",
  handoffPacketId: "packet-2",
}, expectedContext);
assertIncludes(mismatchContextBlockers, "Provider observation selectedShotId does not match the current shot.", "selectedShotId mismatch blocker should be reported");
assertIncludes(mismatchContextBlockers, "Provider observation receiptId does not match the current receipt.", "receiptId mismatch blocker should be reported");
assertIncludes(mismatchContextBlockers, "Provider observation handoffPacketId does not match the current handoff.", "handoffPacketId mismatch blocker should be reported");

assert(
  evidence.actualProviderObservationMatches(validObservation, "runs/S01/output.png", "sha256:abc", expectedContext) === true,
  "complete actual provider observation should match",
);

for (const [label, patch] of [
  ["mode", { providerObservationMode: "mock_readiness_evidence" }],
  ["image2 provider", { provider: "openai-text-api", providerId: "" }],
  ["providerRequestId", { providerRequestId: "" }],
  ["hash", { outputSha256: "sha256:other", outputHash: "" }],
  ["outputPath", { outputPath: "runs/S01/other.png" }],
  ["context", { selectedShotId: "S02" }],
  ["providerCalled", { providerCalled: false }],
  ["actualImage2Triggered", { actualImage2Triggered: false }],
]) {
  assert(
    evidence.actualProviderObservationMatches({ ...validObservation, ...patch }, "runs/S01/output.png", "sha256:abc", expectedContext) === false,
    `actual provider observation should fail without matching ${label}`,
  );
}

const validSemanticQa = {
  semanticReviewMode: "actual_image_semantic_review",
  outputPath: "/repo/runs/S01/output.png",
  reviewedOutputSha256: "sha256:abc",
  status: "needs_review",
};
assert(
  evidence.actualSemanticQaMatches(validSemanticQa, "runs/S01/output.png", "sha256:abc") === true,
  "complete actual semantic QA should match",
);

for (const [label, patch] of [
  ["mode", { semanticReviewMode: "mock_executor_semantic_review" }],
  ["outputPath", { outputPath: "/repo/runs/S01/other.png" }],
  ["hash", { reviewedOutputSha256: "sha256:other", outputSha256: "" }],
  ["needs_review status", { status: "approved", qaStatus: "approved", finalAssessment: { status: "approved" } }],
]) {
  assert(
    evidence.actualSemanticQaMatches({ ...validSemanticQa, ...patch }, "runs/S01/output.png", "sha256:abc") === false,
    `actual semantic QA should fail without matching ${label}`,
  );
}

const inlineObject = { inline: true };
assert(evidence.readReturnedJson(inlineObject, "sidecars/provider.json") === inlineObject, "readReturnedJson should prefer an input object");
assert(readCalls.length === 0, "readReturnedJson should not read a path when an input object is present");
assert(evidence.readReturnedJson(undefined, "sidecars/provider.json")?.fromPath === "sidecars/provider.json", "readReturnedJson should read from path when no input object is present");
assert(readCalls.length === 1 && readCalls[0] === "sidecars/provider.json", "readReturnedJson should call readRuntimeJson with the supplied path");

console.log("runtime-api-provider-return-evidence-test: ok");
