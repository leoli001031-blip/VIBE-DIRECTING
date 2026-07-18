import assert from "node:assert/strict";
import {
  activeAgentDirectorClarificationFromTimeline,
  buildAgentDirectorClarificationResolutionTimelineEntry,
  buildAgentDirectorClarificationTimelineEntries,
  buildAgentDirectorClarificationTurn,
} from "../src/ui/director/agentDirectorClarification";
import {
  buildAgentDirectorReviewRevisionIntent,
  buildAgentDirectorReviewRevisionTimelineEntries,
} from "../src/ui/director/agentDirectorReviewRevision";
import {
  activeAgentDirectorReviewRegenerationConfirmationFromTimeline,
  activeAgentDirectorReviewRegenerationProposalFromTimeline,
  agentDirectorReviewRegenerationConfirmationMatchesJob,
  buildAgentDirectorReviewRegenerationConfirmationTimelineEntries,
  buildAgentDirectorReviewRegenerationProposal,
  buildAgentDirectorReviewRegenerationProposalTimelineEntries,
  compileAgentDirectorReviewRegenerationPrompt,
} from "../src/ui/director/agentDirectorReviewRegeneration";
import {
  buildAgentVideoPipelinePlan,
  createAgentVideoGenerationJobLedger,
  planAgentVideoProductionAction,
  type AgentVideoGenerationJob,
} from "../src/core/agentVideoProductionContract";
import { classifyDirectorAgentAction } from "../src/core/directorAgentAction";

const identity = {
  projectId: "current_project",
  projectRoot: "/tmp/p10-d6/project",
  projectFactHash: "pv_p10d6",
  jobId: "old_job_p6s01",
  actionId: "old_action_p6s01",
  shotId: "P6S01",
  sourceReceiptId: "old_receipt_p6s01",
  outputPath: "video/P6S01.mp4",
  outputHash: `sha256:${"a".repeat(64)}`,
};
const originalIdentitySnapshot = structuredClone(identity);

const revision = buildAgentDirectorReviewRevisionIntent({
  identity,
  targetLabel: "P6S01",
  createdAt: "2026-07-18T09:00:00.000Z",
});
assert.equal(revision.ok, true);
assert.ok(revision.intent);

const clarification = buildAgentDirectorClarificationTurn({
  userIntent: "纸飞机亮得太早了",
  selectedShotId: "P6S01",
  targetLabel: "P6S01",
  createdAt: "2026-07-18T09:01:00.000Z",
  reviewRevision: {
    intentId: revision.intent.intentId,
    identity,
  },
});
assert.ok(clarification);
assert.equal(clarification.reviewRevision?.intentId, revision.intent.intentId);

const clarifyTimeline = [
  ...buildAgentDirectorReviewRevisionTimelineEntries(revision.intent),
  ...buildAgentDirectorClarificationTimelineEntries(clarification),
];
const restoredClarification = activeAgentDirectorClarificationFromTimeline(clarifyTimeline);
assert.equal(restoredClarification?.reviewRevision?.identity.outputHash, identity.outputHash);

const continuityClarification = buildAgentDirectorClarificationTurn({
  userIntent: "机器人抬手前先看向女孩，保持纸飞机的位置连续。",
  selectedShotId: "P6S01",
  targetLabel: "P6S01",
  createdAt: "2026-07-18T09:01:30.000Z",
  reviewRevision: {
    intentId: revision.intent.intentId,
    identity,
  },
});
assert.ok(continuityClarification);
assert.equal(continuityClarification.options[0]?.id, "apply_as_stated");
assert.equal(continuityClarification.options[1]?.id, "strengthen_direction");
assert.match(continuityClarification.question, /新版本提案/);

const option = clarification.options[0]!;
const proposalResult = buildAgentDirectorReviewRegenerationProposal({
  revisionIntent: revision.intent,
  clarification,
  resolvedIntent: option.resolvedIntent,
  directionLabel: option.label,
  createdAt: "2026-07-18T09:02:00.000Z",
});
assert.equal(proposalResult.ok, true);
assert.ok(proposalResult.proposal);
const proposal = proposalResult.proposal;
assert.equal(proposal.originalResultPreserved, true);
assert.equal(proposal.generationActionCreated, false);
assert.equal(proposal.promptPolicy, "compile_after_proposal_confirmation");
assert.equal("actionId" in proposal, false);
assert.equal("jobId" in proposal, false);

const proposalTimeline = [
  ...clarifyTimeline,
  buildAgentDirectorClarificationResolutionTimelineEntry({
    turn: clarification,
    option,
    createdAt: "2026-07-18T09:02:00.000Z",
  }),
  ...buildAgentDirectorReviewRegenerationProposalTimelineEntries(proposal),
];
assert.equal(activeAgentDirectorClarificationFromTimeline(proposalTimeline), undefined);
assert.equal(activeAgentDirectorReviewRegenerationProposalFromTimeline(proposalTimeline, identity)?.proposalId, proposal.proposalId);

const compiledPrompt = compileAgentDirectorReviewRegenerationPrompt(proposal);
assert.notEqual(compiledPrompt, proposal.resolvedIntent);
assert.match(compiledPrompt, /保留现有返回视频和 Review 证据/);
assert.equal(classifyDirectorAgentAction(compiledPrompt), "prepare_video_submit");

const existingLedger = createAgentVideoGenerationJobLedger({
  ledgerId: "p10d6_existing_result_ledger",
  projectId: identity.projectId,
  projectRoot: identity.projectRoot,
  projectFactHash: identity.projectFactHash,
  createdAt: "2026-07-18T09:00:00.000Z",
});
const independentRegenerationPlan = buildAgentVideoPipelinePlan({
  planId: `review_regeneration_${proposal.proposalId}`,
  generatedAt: "2026-07-18T09:03:00.000Z",
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 0,
  videoSubmitted: false,
  videoNeedsQuery: false,
});
const stagedIndependentCandidate = planAgentVideoProductionAction({
  plan: independentRegenerationPlan,
  ledger: existingLedger,
  action: "submit_video",
  actionId: "agent_action_20260718t090300_prepare_video_submit",
  executionMode: "dry_run",
  generatedAt: "2026-07-18T09:03:00.000Z",
  sourceConfirmationId: "agent_tool_handoff_p10d6",
  sourceTimelineId: proposal.proposalId,
  prompt: compiledPrompt,
  inputAssets: [],
  outputAssets: [],
});
assert.equal(stagedIndependentCandidate.status, "staged_job");
assert.equal(stagedIndependentCandidate.job?.status, "staged");
assert.equal(stagedIndependentCandidate.job?.executionMode, "dry_run");
assert.equal(stagedIndependentCandidate.job?.providerCalled, false);

const newJob: AgentVideoGenerationJob = {
  jobId: "agent_video_job_minimal_agent_current_task_submit_video_002",
  projectId: identity.projectId,
  projectRoot: identity.projectRoot,
  projectFactHash: identity.projectFactHash,
  actionId: "agent_action_20260718t090300_prepare_video_submit",
  operation: "execute",
  executionMode: "dry_run",
  providerCalled: false,
  kind: "video_submit",
  providerId: "dry-run-provider",
  modelId: "dry-run-model",
  capability: "image-to-video",
  pipelineStep: "submit_video",
  status: "staged",
  sourceConfirmationId: "agent_tool_handoff_p10d6",
  sourceTimelineId: proposal.proposalId,
  prompt: compiledPrompt,
  inputAssets: [],
  outputAssets: [],
  blockers: [],
  statusHistory: [{ status: "staged", at: "2026-07-18T09:03:00.000Z" }],
  createdAt: "2026-07-18T09:03:00.000Z",
  updatedAt: "2026-07-18T09:03:00.000Z",
};
const confirmationResult = buildAgentDirectorReviewRegenerationConfirmationTimelineEntries({
  proposal,
  job: newJob,
  confirmationId: newJob.sourceConfirmationId,
  compiledPrompt,
  createdAt: "2026-07-18T09:03:00.000Z",
});
assert.equal(confirmationResult.ok, true);
assert.equal(confirmationResult.confirmation?.actionId, newJob.actionId);
assert.equal(confirmationResult.confirmation?.jobId, newJob.jobId);
assert.notEqual(newJob.actionId, identity.actionId);
assert.notEqual(newJob.jobId, identity.jobId);
assert.equal(newJob.prompt === proposal.resolvedIntent, false);

const macOsRealpathAliasResult = buildAgentDirectorReviewRegenerationConfirmationTimelineEntries({
  proposal,
  job: { ...newJob, projectRoot: "/private/tmp/p10-d6/project" },
  confirmationId: newJob.sourceConfirmationId,
  compiledPrompt,
});
assert.equal(macOsRealpathAliasResult.ok, true);

const differentProjectRootResult = buildAgentDirectorReviewRegenerationConfirmationTimelineEntries({
  proposal,
  job: { ...newJob, projectRoot: "/tmp/p10-d6/other-project" },
  confirmationId: newJob.sourceConfirmationId,
  compiledPrompt,
});
assert.equal(differentProjectRootResult.ok, false);
assert.ok(differentProjectRootResult.blockers.includes("review_regeneration_project_identity_mismatch"));

const confirmationTimeline = [...proposalTimeline, ...confirmationResult.entries];
assert.equal(activeAgentDirectorReviewRegenerationProposalFromTimeline(confirmationTimeline, identity), undefined);
const restoredConfirmation = activeAgentDirectorReviewRegenerationConfirmationFromTimeline(confirmationTimeline, identity);
assert.equal(restoredConfirmation?.confirmationId, newJob.sourceConfirmationId);
assert.equal(restoredConfirmation?.executionMode, "dry_run");
assert.equal(restoredConfirmation?.providerCalled, false);
assert.equal(agentDirectorReviewRegenerationConfirmationMatchesJob(restoredConfirmation, {
  actionId: newJob.actionId,
  confirmationId: newJob.sourceConfirmationId,
  job: newJob,
}), true);
assert.equal(agentDirectorReviewRegenerationConfirmationMatchesJob(restoredConfirmation, {
  actionId: newJob.actionId,
  confirmationId: newJob.sourceConfirmationId,
  job: { ...newJob, providerCalled: true },
}), false);
assert.equal(agentDirectorReviewRegenerationConfirmationMatchesJob(restoredConfirmation, {
  actionId: identity.actionId,
  confirmationId: newJob.sourceConfirmationId,
  job: newJob,
}), false);
assert.deepEqual(identity, originalIdentitySnapshot);

const corruptConfirmationTimeline = confirmationTimeline.map((entry) => (
  entry.id === newJob.sourceConfirmationId
    ? { ...entry, details: { ...entry.details, providerCalled: true } }
    : entry
));
assert.equal(
  activeAgentDirectorReviewRegenerationConfirmationFromTimeline(corruptConfirmationTimeline, identity),
  undefined,
);

const wrongIdentity = { ...identity, outputHash: `sha256:${"b".repeat(64)}` };
assert.equal(activeAgentDirectorReviewRegenerationConfirmationFromTimeline(confirmationTimeline, wrongIdentity), undefined);

const reusedJobResult = buildAgentDirectorReviewRegenerationConfirmationTimelineEntries({
  proposal,
  job: { ...newJob, jobId: identity.jobId },
  confirmationId: newJob.sourceConfirmationId,
  compiledPrompt,
});
assert.equal(reusedJobResult.ok, false);
assert.ok(reusedJobResult.blockers.includes("review_regeneration_new_job_id_required"));

const reusedActionResult = buildAgentDirectorReviewRegenerationConfirmationTimelineEntries({
  proposal,
  job: { ...newJob, actionId: identity.actionId },
  confirmationId: newJob.sourceConfirmationId,
  compiledPrompt,
});
assert.equal(reusedActionResult.ok, false);
assert.ok(reusedActionResult.blockers.includes("review_regeneration_new_action_id_required"));

const reusedConfirmationResult = buildAgentDirectorReviewRegenerationConfirmationTimelineEntries({
  proposal,
  job: { ...newJob, sourceConfirmationId: identity.sourceReceiptId },
  confirmationId: identity.sourceReceiptId,
  compiledPrompt,
});
assert.equal(reusedConfirmationResult.ok, false);
assert.ok(reusedConfirmationResult.blockers.includes("review_regeneration_new_confirmation_id_required"));

console.log("agent director review regeneration: ok");
