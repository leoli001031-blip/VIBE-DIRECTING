import {
  buildAgentDirectorReviewPromotionTransaction,
  buildAgentDirectorReviewSelectionProjection,
  confirmAgentDirectorReviewSelection,
  createAgentDirectorReviewSelectionLedger,
  stageAgentDirectorReviewPromotion,
  stageAgentDirectorReviewSelection,
} from "../src/core/agentDirectorReviewSelection.ts";
import { buildAgentDirectorReviewVersionPair } from "../src/core/agentDirectorReviewVersionPair.ts";
import type { AgentVideoGenerationJob, AgentVideoGenerationJobLedger } from "../src/core/agentVideoProductionContract.ts";
import {
  applyProjectVibeTransaction,
  createProjectVibe,
  hashProjectVibeFacts,
  validateProjectVibe,
} from "../src/project/index.ts";
import { restoreProjectAgentReviewSelectionLedger } from "../src/project/projectAgentReviewSelectionLedger.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const projectId = "p10-d8-project";
const projectRoot = "/tmp/p10-d8-project";
const shotId = "P10D8S01";
const createdAt = "2026-07-19T03:00:00.000Z";
const project = createProjectVibe({
  projectId,
  title: "P10-D8 selection gate",
  version: "1.0.0",
  createdAt,
  updatedAt: createdAt,
  storyFlow: {
    id: "story",
    sections: [{ id: "section", title: "Scene", summary: "A/B", sequenceIndex: 0, shotIds: [shotId] }],
    shotOrder: [shotId],
  },
  visualMemory: { id: "memory", entries: [] },
  shots: [{
    id: shotId,
    sectionId: "section",
    title: "Version pair",
    intent: "Compare two local results.",
    sceneAssetIds: [],
    characterAssetIds: [],
    propAssetIds: [],
    durationSeconds: 5,
    status: "generated",
    sourceRefs: ["p10-d8-fixture"],
  }],
  assets: [],
  runs: [],
});
const projectFactHash = hashProjectVibeFacts(project);
const identity = { projectId, projectRoot, projectFactHash };

function job(version: "a" | "b"): AgentVideoGenerationJob {
  const receivedAt = version === "a" ? "2026-07-19T03:01:00.000Z" : "2026-07-19T03:02:00.000Z";
  const jobId = `job-${version}`;
  const actionId = `action-${version}`;
  const outputPath = `${projectRoot}/video/${shotId}-${version}.mp4`;
  return {
    jobId,
    projectId,
    projectRoot,
    projectFactHash,
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
    sourceConfirmationId: `generation-confirmation-${version}`,
    prompt: `candidate ${version}`,
    inputAssets: [],
    outputAssets: [outputPath],
    reviewResult: {
      status: "needs_review",
      projectId,
      projectRoot,
      projectFactHash,
      jobId,
      actionId,
      shotId,
      sourceReceiptId: `generation-receipt-${version}`,
      outputPath,
      outputHash: `sha256:${version.repeat(64)}`,
      receivedAt,
    },
    blockers: [],
    statusHistory: [{ status: "staged", at: receivedAt }, { status: "succeeded", at: receivedAt }],
    createdAt: receivedAt,
    updatedAt: receivedAt,
  };
}

const generationLedger: AgentVideoGenerationJobLedger = {
  schemaVersion: "agent_video_generation_job_ledger/0.5.0",
  ledgerId: "p10-d8-generation-ledger",
  projectId,
  projectRoot,
  projectFactHash,
  createdAt,
  updatedAt: "2026-07-19T03:02:00.000Z",
  jobs: [job("a"), job("b")],
};
const pairResult = buildAgentDirectorReviewVersionPair({ ledger: generationLedger, identity });
assert(pairResult.status === "ready" && pairResult.pair, "D8 requires one exact D7 pair");
const pair = pairResult.pair;
const emptyLedger = createAgentDirectorReviewSelectionLedger({ ...identity, ledgerId: "p10-d8-selection-ledger", createdAt });
const baselineFactHash = hashProjectVibeFacts(project);

const stagedA = stageAgentDirectorReviewSelection({
  ledger: emptyLedger,
  pair,
  winnerVersion: "A",
  generatedAt: "2026-07-19T03:03:00.000Z",
});
assert(stagedA.ok && stagedA.confirmation?.status === "waiting", "selecting A must first stage an independent confirmation");
assert(stagedA.ledger.selectionReceipts.length === 0, "staging selection must not write a selection receipt");
assert(hashProjectVibeFacts(project) === baselineFactHash, "staging selection must not alter Project.vibe facts");
const selectionProjection = buildAgentDirectorReviewSelectionProjection({ ledger: stagedA.ledger, pair });
assert(selectionProjection.status === "selection_confirmation" && selectionProjection.winnerVersion === "A", "selection confirmation must own the current projection");

const restoredWaiting = restoreProjectAgentReviewSelectionLedger(JSON.parse(JSON.stringify(stagedA.ledger)), identity);
assert(restoredWaiting.ok && restoredWaiting.ledger?.selectionConfirmations.length === 1, "cold restore must preserve one waiting selection confirmation");
const corrupted = restoreProjectAgentReviewSelectionLedger({ ...stagedA.ledger, schemaVersion: "broken" }, identity);
assert(!corrupted.ok && corrupted.status === "invalid", "a corrupted selection ledger must fail closed");

const selectedA = confirmAgentDirectorReviewSelection({
  ledger: stagedA.ledger,
  pair,
  confirmationId: stagedA.confirmation!.confirmationId,
  reviewerId: "local_user",
  generatedAt: "2026-07-19T03:04:00.000Z",
});
assert(selectedA.ok && selectedA.receipt?.winnerVersion === "A", "confirming selection must write an exact A receipt");
assert(selectedA.receipt.humanReviewed && !selectedA.receipt.promotionAuthorized, "selection receipt must be human-reviewed and non-promotional");
assert(hashProjectVibeFacts(project) === baselineFactHash, "selection receipt must remain outside Project.vibe authority");
const selectionReplay = confirmAgentDirectorReviewSelection({
  ledger: selectedA.ledger,
  pair,
  confirmationId: stagedA.confirmation!.confirmationId,
  reviewerId: "local_user",
  generatedAt: "2026-07-19T03:05:00.000Z",
});
assert(selectionReplay.ok && JSON.stringify(selectionReplay.ledger) === JSON.stringify(selectedA.ledger), "exact selection replay must be idempotent");

const promotionA = stageAgentDirectorReviewPromotion({
  ledger: selectedA.ledger,
  pair,
  selectionReceiptId: selectedA.receipt.receiptId,
  generatedAt: "2026-07-19T03:05:00.000Z",
});
assert(promotionA.ok && promotionA.promotionConfirmation?.status === "waiting", "promotion must have a second explicit confirmation");
assert(promotionA.promotionConfirmation.confirmationId !== selectedA.receipt.confirmationId, "selection and promotion confirmations must be distinct");
const promotionProjection = buildAgentDirectorReviewSelectionProjection({ ledger: promotionA.ledger, pair });
assert(promotionProjection.status === "promotion_confirmation", "promotion confirmation must preempt passive A/B Review");

const missingPromotionConfirmation = buildAgentDirectorReviewPromotionTransaction({
  project,
  projectRoot,
  pair,
  ledger: promotionA.ledger,
  promotionConfirmationId: "missing",
  reviewerId: "local_user",
});
assert(missingPromotionConfirmation.status === "blocked", "promotion without the exact confirmation must fail closed");
const stagedPromotion = buildAgentDirectorReviewPromotionTransaction({
  project,
  projectRoot,
  pair,
  ledger: promotionA.ledger,
  promotionConfirmationId: promotionA.promotionConfirmation.confirmationId,
  reviewerId: "local_user",
  generatedAt: "2026-07-19T03:06:00.000Z",
});
assert(stagedPromotion.status === "staged" && stagedPromotion.transaction && stagedPromotion.promotionReceipt, "exact current selection and confirmation should stage promotion");
assert(stagedPromotion.promotionReceipt.outputPath === `video/${shotId}-a.mp4`, "promoted output path must become project-relative");
assert(stagedPromotion.promotionReceipt.selectionReceiptId === selectedA.receipt.receiptId, "promotion receipt must bind the selection receipt");
const appliedPromotion = applyProjectVibeTransaction(project, stagedPromotion.transaction);
assert(appliedPromotion.receipt.status === "applied", `promotion transaction must validate: ${appliedPromotion.receipt.errors.join("; ")}`);
assert(validateProjectVibe(appliedPromotion.project).ok, "promoted Project.vibe must remain valid");
assert(appliedPromotion.receipt.afterFactHash && appliedPromotion.receipt.afterFactHash !== baselineFactHash, "promotion must create a new project fact hash");
assert(project.visualMemory.entries.length === 0 && appliedPromotion.project.visualMemory.entries.length === 0, "video promotion must not mutate Visual Memory");
assert(appliedPromotion.project.shots.length === project.shots.length, "video promotion must not rewrite shot facts");
const promotionReplay = buildAgentDirectorReviewPromotionTransaction({
  project: appliedPromotion.project,
  projectRoot,
  pair,
  ledger: promotionA.ledger,
  promotionConfirmationId: promotionA.promotionConfirmation.confirmationId,
  reviewerId: "local_user",
});
assert(promotionReplay.status === "already_promoted", "exact promotion replay must be idempotent after the fact hash changes");

const stagedB = stageAgentDirectorReviewSelection({
  ledger: promotionA.ledger,
  pair,
  winnerVersion: "B",
  generatedAt: "2026-07-19T03:07:00.000Z",
});
assert(stagedB.ok && stagedB.confirmation?.winnerVersion === "B", "selection must support reversing from A to B before promotion");
assert(stagedB.ledger.promotionConfirmations.every((item) => item.status !== "waiting"), "selection reversal must cancel the stale A promotion confirmation");
const selectedB = confirmAgentDirectorReviewSelection({
  ledger: stagedB.ledger,
  pair,
  confirmationId: stagedB.confirmation!.confirmationId,
  reviewerId: "local_user",
  generatedAt: "2026-07-19T03:08:00.000Z",
});
assert(selectedB.ok && selectedB.receipt?.winnerVersion === "B", "reversed selection must write a distinct B receipt and preserve A history");
assert(selectedB.ledger.selectionReceipts.length === 2, "selection reversal must preserve the loser and earlier receipt history");

const stalePair = { ...pair, projectFactHash: "stale-fact" };
const staleSelection = stageAgentDirectorReviewSelection({ ledger: emptyLedger, pair: stalePair, winnerVersion: "A" });
assert(!staleSelection.ok, "a stale fact pair must not stage selection");
const crossProjectLedger = { ...emptyLedger, projectId: "other-project" };
const crossProjectSelection = stageAgentDirectorReviewSelection({ ledger: crossProjectLedger, pair, winnerVersion: "A" });
assert(!crossProjectSelection.ok, "a cross-project ledger must not stage selection");

const wrongHashLedger = structuredClone(promotionA.ledger);
wrongHashLedger.selectionReceipts[0]!.winner.outputHash = `sha256:${"f".repeat(64)}`;
const wrongHashPromotion = buildAgentDirectorReviewPromotionTransaction({
  project,
  projectRoot,
  pair,
  ledger: wrongHashLedger,
  promotionConfirmationId: promotionA.promotionConfirmation.confirmationId,
  reviewerId: "local_user",
});
assert(wrongHashPromotion.status === "blocked", "a winner with the wrong output hash must not promote");

console.log("agent director review selection: ok");
