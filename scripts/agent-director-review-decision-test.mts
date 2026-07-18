import fs from "node:fs";
import {
  agentDirectorApprovedReviewReceiptMatchesIdentity,
  agentDirectorReviewIdentityMatches,
  agentDirectorReviewReceiptId,
  validateAgentDirectorReviewIdentity,
  type AgentDirectorReviewIdentity,
} from "../src/core/agentDirectorReviewDecision.ts";
import {
  activeAgentDirectorReviewRevisionIntentFromTimeline,
  buildAgentDirectorReviewRevisionIntent,
  buildAgentDirectorReviewRevisionTimelineEntries,
} from "../src/ui/director/agentDirectorReviewRevision.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const identity: AgentDirectorReviewIdentity = {
  projectId: "p10-d5-project",
  projectRoot: "/tmp/p10-d5-project",
  projectFactHash: "pv_p10_d5_fact",
  jobId: "job-p10-d5-p6s01",
  actionId: "action-p10-d5-p6s01",
  shotId: "P6S01",
  sourceReceiptId: "provider-receipt-p6s01",
  outputPath: "/tmp/p10-d5-project/video/P6S01.mp4",
  outputHash: `sha256:${"a".repeat(64)}`,
};

assert(validateAgentDirectorReviewIdentity(identity).length === 0, "a complete returned-result identity should be reviewable");
assert(agentDirectorReviewIdentityMatches(identity, {
  ...identity,
  projectRoot: "/private/tmp/p10-d5-project/",
  outputPath: "/private/tmp/p10-d5-project/video/P6S01.mp4",
  outputHash: `SHA256:${"A".repeat(64)}`,
}), "review identity matching should normalize macOS tmp aliases, slashes, and hash casing");
assert(agentDirectorReviewIdentityMatches(identity, {
  ...identity,
  outputPath: "video/P6S01.mp4",
}), "review identity matching should treat a project-relative output as the same in-project media");
assert(!agentDirectorReviewIdentityMatches(identity, { ...identity, actionId: "another-action" }), "a different action must not bind to this result");
assert(!agentDirectorReviewIdentityMatches(identity, { ...identity, outputHash: `sha256:${"b".repeat(64)}` }), "a different output hash must not bind to this result");

const receiptId = agentDirectorReviewReceiptId(identity);
assert(receiptId === agentDirectorReviewReceiptId({ ...identity }), "preview approval receipt ids must be deterministic for replay idempotency");
assert(receiptId.startsWith("review_agent_video_P6S01_"), "the deterministic receipt id should retain the reviewed shot identity");
const approvedReceipt = {
  ...identity,
  id: receiptId,
  decisionScope: "agent_video_preview",
  status: "approved",
  humanReviewed: true,
  promotionAuthorized: false,
  outputPath: "video/P6S01.mp4",
};
assert(agentDirectorApprovedReviewReceiptMatchesIdentity(approvedReceipt, identity), "an exact strict Review Receipt should resolve the returned result");
assert(!agentDirectorApprovedReviewReceiptMatchesIdentity({ ...approvedReceipt, actionId: "another-action" }, identity), "a stale action receipt must not resolve the returned result");
assert(!agentDirectorApprovedReviewReceiptMatchesIdentity({ ...approvedReceipt, promotionAuthorized: true }, identity), "a promotion receipt must not substitute for preview approval");

const invalidIdentity = { ...identity, projectFactHash: "", outputPath: "../outside.mp4" };
const invalidBlockers = validateAgentDirectorReviewIdentity(invalidIdentity);
assert(invalidBlockers.includes("review_project_fact_hash_required"), "review must require the source project fact hash");
assert(invalidBlockers.includes("review_output_path_outside_project"), "review must fail closed for traversal output paths");

const revisionBuild = buildAgentDirectorReviewRevisionIntent({
  identity,
  targetLabel: "P6S01",
  createdAt: "2026-07-18T10:00:00.000Z",
});
assert(revisionBuild.ok && revisionBuild.intent, "a complete review identity should form a structured revision intent");
assert(revisionBuild.intent.status === "clarify", "requesting changes should return to a clarify state");
assert(revisionBuild.intent.originalResultPreserved, "requesting changes must preserve the returned candidate");
assert(!revisionBuild.intent.generationJobCreated && !revisionBuild.intent.providerCalled, "requesting changes must not create or submit a generation job");
assert(!revisionBuild.intent.projectFactsMutated && !revisionBuild.intent.exportTriggered, "requesting changes must not mutate facts or export");

const revisionEntries = buildAgentDirectorReviewRevisionTimelineEntries(revisionBuild.intent);
const restoredRevision = activeAgentDirectorReviewRevisionIntentFromTimeline(revisionEntries, identity);
assert(restoredRevision?.intentId === revisionBuild.intent.intentId, "an unresolved revision intent should restore from the Agent timeline");
assert(!activeAgentDirectorReviewRevisionIntentFromTimeline(revisionEntries, { ...identity, projectId: "another-project" }), "a revision intent from another project must not restore");

const resolvedRevision = activeAgentDirectorReviewRevisionIntentFromTimeline([
  ...revisionEntries,
  {
    id: "revision-detail-p6s01",
    type: "user_message",
    createdAt: "2026-07-18T10:00:01.000Z",
    title: "你",
    body: "纸飞机亮得太早了",
    status: "done",
  },
], identity);
assert(!resolvedRevision, "a later revision detail should resolve the initial revision-intent prompt");

const panelSource = fs.readFileSync("src/ui/director/MinimalAgentPanel.tsx", "utf8");
assert(
  /if \(!onRememberAgentTimelineEntries\)[\s\S]*await onRememberAgentTimelineEntries\(entries\);[\s\S]*setAgentTimelineEntries\([\s\S]*updateText\(revision\.intent\.composerPrompt\)/.test(panelSource),
  "request changes must persist and merge the structured revision intent before prefilling the composer",
);
assert(
  panelSource.includes("reviewRevisionIntent: activeDirectorReviewRevisionIntent"),
  "the restored revision intent must feed the single Director turn projection",
);
assert(
  panelSource.includes('aria-label="当前视频修改意图"'),
  "the structured revision intent must own one visible focused Agent turn",
);
assert(
  panelSource.includes("agentDirectorApprovedReviewReceiptMatchesIdentity"),
  "cold restore must use the exact strict Review Receipt to suppress an already approved ledger result",
);
assert(
  /reviewTurnVisible[\s\S]{0,180}agentDirectorTurnProjection\.phase === "review"/.test(panelSource),
  "a blocked confirmation must not render a second stale Review turn",
);

const appSource = fs.readFileSync("src/App.tsx", "utf8");
assert(appSource.includes("reviewIdentity: agentVideoReviewIdentity"), "Agent video approval must send the complete review identity to runtime");
assert(
  appSource.includes('throw new Error("agent_video_review_requires_bound_runtime")'),
  "Agent video approval must fail closed instead of using the local Project.vibe fallback without a bound runtime",
);
assert(
  /if \(agentVideoReviewIdentity\) \{[\s\S]*throw error;[\s\S]*Runtime review decision failed; falling back/.test(appSource),
  "a strict Agent video runtime failure must throw before the legacy local fallback path",
);
assert(
  appSource.includes('throw new Error(saveAgentTimelineResult.errors[0] || "agent_timeline_write_failed")'),
  "timeline persistence failures must reject so request-changes cannot appear saved without cold-restart evidence",
);

console.log("agent director review decision: ok");
