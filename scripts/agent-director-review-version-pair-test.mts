import {
  buildAgentDirectorReviewVersionPair,
  type AgentDirectorReviewVersionPairProjectIdentity,
} from "../src/core/agentDirectorReviewVersionPair.ts";
import type {
  AgentVideoGenerationJob,
  AgentVideoGenerationJobLedger,
} from "../src/core/agentVideoProductionContract.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const identity: AgentDirectorReviewVersionPairProjectIdentity = {
  projectId: "p10-d7-project",
  projectRoot: "/tmp/p10-d7-project",
  projectFactHash: "p10-d7-fact",
};

function job(version: "a" | "b", overrides: Partial<AgentVideoGenerationJob> = {}): AgentVideoGenerationJob {
  const receivedAt = version === "a" ? "2026-07-18T13:00:00.000Z" : "2026-07-18T13:05:00.000Z";
  const outputHash = version === "a" ? `sha256:${"a".repeat(64)}` : `sha256:${"b".repeat(64)}`;
  const jobId = `job-${version}`;
  const actionId = `action-${version}`;
  const outputPath = `/tmp/p10-d7-project/video/P6S01-${version}.mp4`;
  return {
    jobId,
    projectId: identity.projectId,
    projectRoot: identity.projectRoot!,
    projectFactHash: identity.projectFactHash,
    actionId,
    operation: "execute",
    executionMode: "dry_run",
    providerCalled: false,
    kind: "video_submit",
    providerId: "local-fixture",
    modelId: "local-fixture",
    capability: "image-to-video",
    pipelineStep: "submit_video",
    status: "succeeded",
    sourceConfirmationId: `confirmation-${version}`,
    prompt: `candidate ${version}`,
    inputAssets: [],
    outputAssets: [outputPath],
    reviewResult: {
      status: "needs_review",
      projectId: identity.projectId,
      projectRoot: identity.projectRoot!,
      projectFactHash: identity.projectFactHash,
      jobId,
      actionId,
      shotId: "P6S01",
      sourceReceiptId: `receipt-${version}`,
      outputPath,
      outputHash,
      receivedAt,
    },
    blockers: [],
    statusHistory: [
      { status: "staged", at: receivedAt },
      { status: "succeeded", at: receivedAt },
    ],
    createdAt: receivedAt,
    updatedAt: receivedAt,
    ...overrides,
  };
}

function ledger(jobs: AgentVideoGenerationJob[]): AgentVideoGenerationJobLedger {
  return {
    schemaVersion: "agent_video_generation_job_ledger/0.5.0",
    ledgerId: "p10-d7-ledger",
    projectId: identity.projectId,
    projectRoot: identity.projectRoot,
    projectFactHash: identity.projectFactHash,
    createdAt: "2026-07-18T12:00:00.000Z",
    updatedAt: "2026-07-18T13:05:00.000Z",
    jobs,
  };
}

const pairResult = buildAgentDirectorReviewVersionPair({ ledger: ledger([job("a"), job("b")]), identity });
assert(pairResult.status === "ready" && pairResult.pair, "two exact local results should form a version pair");
assert(pairResult.pair.candidateA.identity.jobId === "job-a", "older candidate should be version A");
assert(pairResult.pair.candidateB.identity.jobId === "job-b", "newer candidate should be version B");
assert(pairResult.pair.candidateA.identity.outputHash !== pairResult.pair.candidateB.identity.outputHash, "version pair must keep distinct media hashes");
assert(pairResult.pair.originalCandidatesPreserved && !pairResult.pair.providerCalled, "pair derivation must preserve both local candidates without Provider work");
const repeatedPairResult = buildAgentDirectorReviewVersionPair({ ledger: ledger([job("a"), job("b")]), identity });
assert(repeatedPairResult.status === "ready" && repeatedPairResult.pair?.pairId === pairResult.pair.pairId, "repeated recovery must derive the same pair id without duplicating state");

const verifiedMediaPair = buildAgentDirectorReviewVersionPair({
  ledger: ledger([job("a"), job("b")]),
  identity,
  availableJobIds: ["job-a", "job-b"],
});
assert(verifiedMediaPair.status === "ready", "two locally verified media candidates should retain A/B Review");
const missingMediaPair = buildAgentDirectorReviewVersionPair({
  ledger: ledger([job("a"), job("b")]),
  identity,
  availableJobIds: ["job-a"],
});
assert(
  missingMediaPair.status === "blocked" && missingMediaPair.blockers.includes("review_version_pair_candidate_media_unavailable"),
  "a missing local candidate must fail closed before version selection",
);

const canonicalRoot = buildAgentDirectorReviewVersionPair({
  ledger: {
    ...ledger([job("a"), job("b")]),
    projectRoot: "/private/tmp/p10-d7-project",
    jobs: [job("a", { projectRoot: "/private/tmp/p10-d7-project" }), job("b", { projectRoot: "/private/tmp/p10-d7-project" })],
  },
  identity,
});
assert(canonicalRoot.status === "ready", "macOS /private/tmp and /tmp roots should compare canonically");

const duplicateHashJob = job("b");
duplicateHashJob.reviewResult = { ...duplicateHashJob.reviewResult!, outputHash: `sha256:${"a".repeat(64)}` };
const duplicateHash = buildAgentDirectorReviewVersionPair({ ledger: ledger([job("a"), duplicateHashJob]), identity });
assert(duplicateHash.status === "blocked", "duplicate media hashes must fail closed");
assert(duplicateHash.blockers.includes("review_version_pair_output_hash_not_distinct"), "duplicate hash blocker should be structured");

const duplicatePathJob = job("b");
duplicatePathJob.outputAssets = [job("a").reviewResult!.outputPath];
duplicatePathJob.reviewResult = { ...duplicatePathJob.reviewResult!, outputPath: job("a").reviewResult!.outputPath };
const duplicatePath = buildAgentDirectorReviewVersionPair({ ledger: ledger([job("a"), duplicatePathJob]), identity });
assert(duplicatePath.status === "blocked", "duplicate output paths must fail closed");

const duplicateJobIdJob = job("b", { jobId: "job-a" });
duplicateJobIdJob.reviewResult = { ...duplicateJobIdJob.reviewResult!, jobId: "job-a" };
const duplicateJobId = buildAgentDirectorReviewVersionPair({ ledger: ledger([job("a"), duplicateJobIdJob]), identity });
assert(duplicateJobId.status === "blocked" && duplicateJobId.blockers.includes("review_version_pair_job_id_not_distinct"), "duplicate job ids must fail closed");

const duplicateActionIdJob = job("b", { actionId: "action-a" });
duplicateActionIdJob.reviewResult = { ...duplicateActionIdJob.reviewResult!, actionId: "action-a" };
const duplicateActionId = buildAgentDirectorReviewVersionPair({ ledger: ledger([job("a"), duplicateActionIdJob]), identity });
assert(duplicateActionId.status === "blocked" && duplicateActionId.blockers.includes("review_version_pair_action_id_not_distinct"), "duplicate action ids must fail closed");

const duplicateReceiptJob = job("b");
duplicateReceiptJob.reviewResult = { ...duplicateReceiptJob.reviewResult!, sourceReceiptId: "receipt-a" };
const duplicateReceipt = buildAgentDirectorReviewVersionPair({ ledger: ledger([job("a"), duplicateReceiptJob]), identity });
assert(duplicateReceipt.status === "blocked" && duplicateReceipt.blockers.includes("review_version_pair_receipt_id_not_distinct"), "duplicate result receipt ids must fail closed");

const escapedPathJob = job("b");
escapedPathJob.outputAssets = ["/tmp/outside-project/P6S01-b.mp4"];
escapedPathJob.reviewResult = { ...escapedPathJob.reviewResult!, outputPath: "/tmp/outside-project/P6S01-b.mp4" };
const escapedPath = buildAgentDirectorReviewVersionPair({ ledger: ledger([job("a"), escapedPathJob]), identity });
assert(escapedPath.status === "blocked" && escapedPath.blockers.includes("review_version_pair_candidate_identity_invalid"), "a candidate outside the project root must fail closed");

const staleJob = job("b", { projectFactHash: "old-fact" });
staleJob.reviewResult = { ...staleJob.reviewResult!, projectFactHash: "old-fact" };
const stalePair = buildAgentDirectorReviewVersionPair({ ledger: ledger([job("a"), staleJob]), identity });
assert(stalePair.status === "missing", "a stale-fact candidate must not pair with the current result");

const crossProjectJob = job("b", { projectId: "other-project" });
crossProjectJob.reviewResult = { ...crossProjectJob.reviewResult!, projectId: "other-project" };
const crossProject = buildAgentDirectorReviewVersionPair({ ledger: ledger([job("a"), crossProjectJob]), identity });
assert(crossProject.status === "missing", "a cross-project candidate must not enter the pair");

const invalidJob = job("b");
invalidJob.reviewResult = { ...invalidJob.reviewResult!, outputHash: "missing-sha256" };
const invalidPair = buildAgentDirectorReviewVersionPair({ ledger: ledger([job("a"), invalidJob]), identity });
assert(invalidPair.status === "blocked", "an identity-incomplete relevant candidate must fail closed");

const wrongLedger = buildAgentDirectorReviewVersionPair({
  ledger: { ...ledger([job("a"), job("b")]), projectFactHash: "other-fact" },
  identity,
});
assert(wrongLedger.status === "blocked", "a restored ledger from another fact hash must fail closed");

const missing = buildAgentDirectorReviewVersionPair({ ledger: ledger([job("a")]), identity });
assert(missing.status === "missing" && !missing.pair, "one candidate alone must not claim A/B review");

console.log("agent director review version pair: ok");
