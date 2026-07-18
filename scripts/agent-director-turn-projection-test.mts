import type { AgentCurrentTaskProjection } from "../src/core/agentCurrentTaskProjection.ts";
import type { AgentVideoGenerationJob } from "../src/core/agentVideoProductionContract.ts";
import { buildAgentDirectorTurnProjection } from "../src/ui/director/agentDirectorTurnProjection.ts";
import { buildAgentDirectorReviewRevisionIntent } from "../src/ui/director/agentDirectorReviewRevision.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function task(overrides: Partial<AgentCurrentTaskProjection>): AgentCurrentTaskProjection {
  return {
    source: "project_status",
    step: "idle",
    label: "继续描述想法",
    requiresConfirmation: false,
    effect: "none",
    blockers: [],
    facts: [],
    ...overrides,
  };
}

function job(overrides: Partial<AgentVideoGenerationJob> = {}): AgentVideoGenerationJob {
  return {
    jobId: "p6s01-job",
    projectId: "p10-d-project",
    projectRoot: "/tmp/p10-d-project",
    projectFactHash: "p10-d-fact-hash",
    actionId: "submit-p6s01-once",
    operation: "execute",
    executionMode: "dry_run",
    providerCalled: false,
    kind: "video_submit",
    providerId: "vibe-director-dry-run-video",
    modelId: "dry-run-video",
    capability: "video_submit",
    pipelineStep: "submit_video",
    status: "running",
    sourceConfirmationId: "submit_p6s01_once",
    prompt: "P6S01",
    inputAssets: [],
    outputAssets: [],
    blockers: [],
    statusHistory: [
      { status: "staged", at: "2026-07-17T01:00:00.000Z" },
      { status: "confirmed", at: "2026-07-17T01:01:00.000Z" },
      { status: "running", at: "2026-07-17T01:02:00.000Z" },
    ],
    createdAt: "2026-07-17T01:00:00.000Z",
    updatedAt: "2026-07-17T01:02:00.000Z",
    ...overrides,
  };
}

const returnedReviewJob = job({
  status: "succeeded",
  outputAssets: ["/tmp/p10-d-project/video/P6S01.mp4"],
  statusHistory: [
    { status: "staged", at: "2026-07-17T01:00:00.000Z" },
    { status: "confirmed", at: "2026-07-17T01:01:00.000Z" },
    { status: "running", at: "2026-07-17T01:02:00.000Z" },
    { status: "succeeded", at: "2026-07-17T01:03:00.000Z" },
  ],
  updatedAt: "2026-07-17T01:03:00.000Z",
  reviewResult: {
    status: "needs_review",
    projectId: "p10-d-project",
    projectRoot: "/tmp/p10-d-project",
    projectFactHash: "p10-d-fact-hash",
    jobId: "p6s01-job",
    actionId: "submit-p6s01-once",
    shotId: "P6S01",
    sourceReceiptId: "provider_receipt_p6s01",
    outputPath: "/tmp/p10-d-project/video/P6S01.mp4",
    outputHash: `sha256:${"9".repeat(64)}`,
    receivedAt: "2026-07-17T01:03:00.000Z",
  },
});

const review = buildAgentDirectorTurnProjection({
  task: task({
    source: "project_observation",
    step: "prepare_references",
    label: "复核参考",
  }),
  reviewTarget: {
    id: "p6s01-result",
    shotId: "P6S01",
    label: "P6S01",
    detail: "视频结果已返回",
    status: "needs_review",
    mediaPath: "outputs/video/P6S01.mp4",
    sourceReceiptId: "provider_receipt_p6s01",
    outputHash: "sha256_p6s01",
  },
});
assert(review.mode === "review", "a receipt-bound needs_review result should become the current review turn");
assert(review.phase === "review", "a receipt-bound result should expose the review presentation phase");
assert(review.reviewIdentityReady, "review identity should require both receipt id and output hash");
assert(review.actions.find((action) => action.id === "approve_preview")?.effect === "review_receipt", "preview approval must only write a review receipt");
assert(review.actions.find((action) => action.id === "approve_preview")?.requiresConfirmation === false, "the explicit review button is the human review decision");
assert(review.actions.find((action) => action.id === "promote_project_fact")?.enabled === false, "preview review must not enable project-fact promotion");
assert(review.actions.find((action) => action.id === "promote_project_fact")?.requiresConfirmation === true, "project-fact promotion must remain a separate confirmation boundary");

const reviewWithoutIdentity = buildAgentDirectorTurnProjection({
  task: task({
    source: "project_observation",
    step: "submit_video",
    label: "复核视频",
  }),
  reviewTarget: {
    id: "p6s01-result-without-identity",
    shotId: "P6S01",
    label: "P6S01",
    detail: "视频结果已返回",
    status: "needs_review",
  },
});
assert(reviewWithoutIdentity.mode === "blocked", "review must fail closed when receipt identity is incomplete");
assert(reviewWithoutIdentity.actions.find((action) => action.id === "approve_preview")?.enabled === false, "a hashless result must not be reviewable");
assert(reviewWithoutIdentity.actions.find((action) => action.id === "request_changes")?.enabled === false, "a video result without job identity must not create an unbound revision intent");

const videoReviewWithoutLedgerJob = buildAgentDirectorTurnProjection({
  task: task({ source: "project_observation", step: "submit_video", label: "复核视频" }),
  currentProjectFactHash: "p10-d-fact-hash",
  reviewTarget: review.reviewTarget,
});
assert(videoReviewWithoutLedgerJob.mode === "blocked", "video review must require the exact restored generation job");
assert(videoReviewWithoutLedgerJob.actions.every((action) => action.id !== "approve_preview" || !action.enabled), "video approval must fail closed without a ledger job");

const recoveredReview = buildAgentDirectorTurnProjection({
  task: task({
    source: "project_observation",
    step: "submit_video",
    label: "复核视频",
    jobId: returnedReviewJob.jobId,
    actionId: returnedReviewJob.actionId,
  }),
  currentProjectFactHash: "p10-d-fact-hash",
  reviewJob: returnedReviewJob,
  reviewTarget: {
    id: "p6s01-returned-result",
    shotId: "P6S01",
    label: "P6S01",
    detail: "视频结果已返回",
    status: "needs_review",
    mediaPath: returnedReviewJob.reviewResult!.outputPath,
    sourceReceiptId: returnedReviewJob.reviewResult!.sourceReceiptId,
    outputHash: returnedReviewJob.reviewResult!.outputHash,
    jobId: returnedReviewJob.jobId,
    actionId: returnedReviewJob.actionId,
    projectFactHash: returnedReviewJob.projectFactHash,
  },
});
assert(recoveredReview.mode === "review" && recoveredReview.reviewIdentityReady, "a terminal result with exact job, action, fact, receipt, path, and hash identity should restore Review");
assert(recoveredReview.actions.find((action) => action.id === "approve_preview")?.enabled === true, "an exact recovered result should expose preview review only");

const recoveredReviewWithWrongHash = buildAgentDirectorTurnProjection({
  ...{
    task: recoveredReview.task,
    currentProjectFactHash: "p10-d-fact-hash",
    reviewJob: returnedReviewJob,
  },
  reviewTarget: {
    ...recoveredReview.reviewTarget!,
    outputHash: `sha256:${"a".repeat(64)}`,
  },
});
assert(recoveredReviewWithWrongHash.mode === "blocked", "a preview target for another output hash must not bind to the recovered job");
assert(recoveredReviewWithWrongHash.actions.find((action) => action.id === "approve_preview")?.enabled === false, "mismatched recovered output identity must disable review approval");

const recoveredReviewFromOldFacts = buildAgentDirectorTurnProjection({
  task: recoveredReview.task,
  currentProjectFactHash: "new-project-facts",
  reviewJob: returnedReviewJob,
  reviewTarget: recoveredReview.reviewTarget,
});
assert(recoveredReviewFromOldFacts.mode === "blocked", "a returned result from older project facts must fail closed");

const reviewRevisionIntent = buildAgentDirectorReviewRevisionIntent({
  identity: returnedReviewJob.reviewResult!,
  targetLabel: "P6S01",
  createdAt: "2026-07-17T01:04:00.000Z",
});
assert(reviewRevisionIntent.intent, "the exact returned result should form a revision intent");
const revisionConversation = buildAgentDirectorTurnProjection({
  task: recoveredReview.task,
  currentProjectFactHash: "p10-d-fact-hash",
  reviewJob: returnedReviewJob,
  reviewTarget: recoveredReview.reviewTarget,
  reviewRevisionIntent: reviewRevisionIntent.intent,
});
assert(revisionConversation.mode === "conversation" && revisionConversation.phase === "conversation", "a structured request-changes decision should own the current conversation turn");
assert(revisionConversation.reviewRevisionIntent?.intentId === reviewRevisionIntent.intent.intentId, "the current turn should retain the exact revision-intent identity");
assert(!revisionConversation.actions.some((action) => action.id === "approve_preview"), "the old Review actions must not remain active while revision clarification owns the turn");
assert(revisionConversation.actions.every((action) => action.effect === "conversation_only"), "revision intent must not create a job, promote facts, or export");

const revisionConversationOverPassiveExport = buildAgentDirectorTurnProjection({
  task: task({ source: "project_status", step: "export", label: "准备交付" }),
  reviewRevisionIntent: reviewRevisionIntent.intent,
});
assert(revisionConversationOverPassiveExport.phase === "conversation", "a passive export state must not steal an unresolved review revision intent");

const clarification = buildAgentDirectorTurnProjection({
  task: task({
    source: "project_observation",
    step: "submit_video",
    label: "复核视频",
  }),
  clarification: {
    id: "clarify-p6s01-timing",
    sourceIntent: "纸飞机亮得太早了",
    targetLabel: "P6S01",
    question: "作为情绪转折，还是提前预兆？",
    boundary: "只形成提案，不执行。",
    options: [
      { id: "delay_as_turn", label: "情绪转折", detail: "延后变化", resolvedIntent: "延后到动作完成后" },
      { id: "keep_as_foreshadow", label: "提前预兆", detail: "降低强度", resolvedIntent: "保留时机但降低强度" },
    ],
  },
});
assert(clarification.mode === "conversation" && clarification.phase === "clarification", "an unresolved creative choice should become a clarification conversation turn");
assert(clarification.clarification?.options.every((option) => option.effect === "conversation_only"), "clarification choices must stay conversation-only");
assert(clarification.actions.every((action) => action.effect === "conversation_only"), "clarification must not expose a project or provider effect");

const regenerationProposal = buildAgentDirectorTurnProjection({
  task: recoveredReview.task,
  currentProjectFactHash: "p10-d-fact-hash",
  reviewJob: returnedReviewJob,
  reviewTarget: recoveredReview.reviewTarget,
  reviewRegenerationProposal: {
    schemaVersion: "agent_director_review_regeneration/1.0.0",
    proposalId: "proposal-agent-video-p6s01",
    status: "awaiting_confirmation",
    revisionIntentId: reviewRevisionIntent.intent.intentId,
    clarificationId: "clarify-p6s01-timing",
    sourceIdentity: returnedReviewJob.reviewResult!,
    targetLabel: "P6S01",
    resolvedIntent: "先完成递交动作，再让纸飞机发光。",
    directionLabel: "情绪转折",
    summary: "修改后重新生成 P6S01",
    message: "保留旧版本，形成一个新候选。",
    proposedChanges: [
      { field: "directorIntent", to: "延后发光", reason: "确认导演目标" },
      { field: "versionPolicy", from: "旧 candidate", to: "新增 candidate", reason: "保留旧结果" },
    ],
    promptPolicy: "compile_after_proposal_confirmation",
    originalResultPreserved: true,
    generationActionCreated: false,
    providerCalled: false,
    createdAt: "2026-07-17T01:05:00.000Z",
  },
});
assert(regenerationProposal.phase === "proposal" && regenerationProposal.mode === "confirmation", "an exact review-regeneration proposal should own the proposal turn over the old candidate");
assert(regenerationProposal.actions.find((action) => action.id === "confirm_current_task")?.label === "确认重新生成提案", "review regeneration must use an explicit proposal confirmation action");
assert(regenerationProposal.actions.find((action) => action.id === "confirm_current_task")?.boundary.includes("不调用付费生成服务"), "proposal confirmation must stop before paid generation execution");
assert(!regenerationProposal.actions.some((action) => action.id === "approve_preview"), "the old Review decision must not remain active while the new proposal owns the turn");

const staleRegenerationProposal = buildAgentDirectorTurnProjection({
  task: recoveredReview.task,
  currentProjectFactHash: "different-fact",
  reviewJob: returnedReviewJob,
  reviewRegenerationProposal: regenerationProposal.reviewRegenerationProposal,
});
assert(staleRegenerationProposal.phase === "proposal" && staleRegenerationProposal.mode === "blocked", "a regeneration proposal from old facts must fail closed");

const proposal = buildAgentDirectorTurnProjection({
  task: task({
    source: "timeline_confirmation",
    step: "confirm_story",
    label: "确认镜头修改",
    requiresConfirmation: true,
    effect: "none",
    confirmationKind: "project_edit",
    confirmationId: "confirm-p6s01-change",
    actionId: "action-p6s01-change",
  }),
  proposal: {
    actionId: "action-p6s01-change",
    confirmationId: "confirm-p6s01-change",
    confirmationActionId: "action-p6s01-change",
    summary: "P6S01 发光时机调整",
    message: "先完成递交动作，再让发光成为转折。",
    targetLabel: "P6S01",
    proposedChanges: [{ field: "selectedScopeDraft", to: "延后发光", reason: "保留动作完成点" }],
  },
});
assert(proposal.mode === "confirmation" && proposal.phase === "proposal", "a matching staged project edit should become the proposal turn");
assert(proposal.actions.find((action) => action.id === "confirm_current_task")?.effect === "project_edit", "proposal confirmation must identify the local project-edit effect");
assert(proposal.actions.find((action) => action.id === "confirm_current_task")?.boundary.includes("不调用外部生成服务"), "proposal confirmation must keep provider work outside the slice");

const proposalWhileReviewProjectionLags = buildAgentDirectorTurnProjection({
  task: review.task,
  reviewTarget: review.reviewTarget,
  proposal: proposal.proposal,
});
assert(proposalWhileReviewProjectionLags.phase === "proposal" && proposalWhileReviewProjectionLags.mode === "confirmation", "a receipt-bound staged proposal must own the turn while passive review projection catches up");

const mismatchedProposal = buildAgentDirectorTurnProjection({
  task: proposal.task,
  proposal: { ...proposal.proposal!, confirmationActionId: "another-action" },
});
assert(mismatchedProposal.mode === "blocked" && mismatchedProposal.phase === "proposal", "a proposal with mismatched identity must fail closed");
assert(mismatchedProposal.actions.find((action) => action.id === "confirm_current_task")?.enabled === false, "a mismatched proposal must not be writable");

const confirmation = buildAgentDirectorTurnProjection({
  task: task({
    source: "timeline_confirmation",
    step: "submit_video",
    label: "确认并提交 1 次",
    requiresConfirmation: true,
    effect: "generation_job",
    confirmationId: "submit_p6s01_once",
    actionId: "submit-p6s01-once",
  }),
  currentProjectFactHash: "p10-d-fact-hash",
  confirmationContext: {
    confirmationId: "submit_p6s01_once",
    actionId: "submit-p6s01-once",
    projectFactHash: "p10-d-fact-hash",
    executionMode: "dry_run",
    title: "重新生成 P6S01",
    message: "只提交当前镜头一次。",
    facts: [{ label: "设置", value: "5 秒 / 720p" }],
  },
});
assert(confirmation.mode === "confirmation", "a current structured confirmation should become the confirmation turn");
assert(confirmation.phase === "confirmation" && confirmation.confirmationIdentityReady, "generation confirmation must bind confirmation, action, and fact hash");
assert(confirmation.confirmation?.executionMode === "dry_run", "confirmation presentation must preserve the structured execution mode");
assert(confirmation.actions.find((action) => action.id === "confirm_current_task")?.effect === "generation_job", "confirmation must preserve the task effect");
assert(confirmation.actions.find((action) => action.id === "confirm_current_task")?.boundary.includes("不自动重试"), "generation confirmation must state the retry boundary");

const mismatchedConfirmation = buildAgentDirectorTurnProjection({
  task: confirmation.task,
  currentProjectFactHash: "p10-d-fact-hash",
  confirmationContext: {
    confirmationId: "submit_p6s01_once",
    actionId: "another-action",
    projectFactHash: "p10-d-fact-hash",
  },
});
assert(mismatchedConfirmation.mode === "blocked", "a generation confirmation with mismatched action identity must fail closed");
assert(mismatchedConfirmation.actions.find((action) => action.id === "confirm_current_task")?.enabled === false, "mismatched confirmation identity must disable submission");

const running = buildAgentDirectorTurnProjection({
  task: task({
    source: "pipeline_job",
    step: "submit_video",
    label: "发送视频",
    effect: "generation_job",
    jobId: "p6s01-job",
    actionId: "submit-p6s01-once",
  }),
  currentProjectFactHash: "p10-d-fact-hash",
  runningJob: job(),
});
assert(running.mode === "running", "a non-terminal pipeline job should become the running turn");
assert(running.runningIdentityReady && running.running?.jobId === "p6s01-job", "running must bind the exact non-terminal job and project fact hash");
assert(running.actions.every((action) => action.effect === "job_observation"), "running actions must observe the existing job only");
assert(!running.actions.some((action) => action.id === "confirm_current_task"), "running must never offer a second confirmation or submission");

const terminalJob = buildAgentDirectorTurnProjection({
  task: running.task,
  currentProjectFactHash: "p10-d-fact-hash",
  runningJob: job({ status: "succeeded" }),
});
assert(terminalJob.mode === "blocked" && terminalJob.phase !== "running", "a terminal job must not render as running");

const wrongFactJob = buildAgentDirectorTurnProjection({
  task: running.task,
  currentProjectFactHash: "current-fact-hash",
  runningJob: job(),
});
assert(wrongFactJob.mode === "blocked", "a job from an older project fact hash must not own the current running turn");

const idle = buildAgentDirectorTurnProjection({ task: task({}) });
assert(idle.mode === "idle", "an idle current task should stay idle");
assert(idle.actions[0]?.effect === "conversation_only", "idle continuation must not execute a side effect");

console.log("agent director turn projection: ok");
