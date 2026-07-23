import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import type { AgentDirectorTurnProjection } from "../src/ui/director/agentDirectorTurnProjection.ts";
import {
  buildAgentReviewSessionTimelineProjection,
  buildAgentSessionTimelineProjection,
} from "../src/ui/director/agentSessionTimelineProjection.ts";

function reviewTurn(overrides: Partial<AgentDirectorTurnProjection> = {}): AgentDirectorTurnProjection {
  return {
    mode: "review",
    phase: "review",
    task: {
      step: "submit_video",
      label: "复核视频",
      source: "pipeline_step",
      effect: "none",
      requiresConfirmation: false,
      blockers: [],
      facts: [],
    },
    confirmationIdentityReady: false,
    runningIdentityReady: false,
    reviewIdentityReady: true,
    blockers: [],
    actions: [],
    ...overrides,
  };
}

const review = buildAgentReviewSessionTimelineProjection(reviewTurn());
assert(review, "structured Review must enable the Session Timeline");
assert.equal(review.currentPhaseId, "review");
assert.equal(review.phases.filter((phase) => phase.state === "current").length, 1, "exactly one phase must be current");
assert.equal(review.phases.find((phase) => phase.id === "running")?.state, "complete", "Running must not remain active after media returns");
assert.equal(review.phases.find((phase) => phase.id === "review")?.state, "current");
assert.equal(review.phases.find((phase) => phase.id === "promotion")?.state, "locked");
assert.equal(review.phases.find((phase) => phase.id === "delivery")?.state, "locked");

const blocked = buildAgentReviewSessionTimelineProjection(reviewTurn({
  mode: "blocked",
  reviewIdentityReady: false,
  blockers: ["identity mismatch"],
}));
assert(blocked);
assert.equal(blocked.currentTone, "blocked");
assert.equal(blocked.phases.filter((phase) => phase.state === "current").length, 1);
assert.equal(blocked.phases.find((phase) => phase.id === "review")?.detail, "复核身份待核对");

const renamed = buildAgentReviewSessionTimelineProjection(reviewTurn({
  task: { ...reviewTurn().task, label: "Localized copy can change" },
}));
assert(renamed, "phase selection must not depend on Chinese display copy");
assert.equal(renamed.currentPhaseId, "review");

const clarify = buildAgentSessionTimelineProjection(reviewTurn({
  mode: "conversation",
  phase: "clarification",
  clarification: {
    id: "clarify_current_shot",
    sourceIntent: "The timing changes too early.",
    targetLabel: "P13S01",
    question: "Should this be the turn or only foreshadowing?",
    boundary: "conversation only",
    options: [
      { id: "turn", label: "Turn", detail: "Use it as the turn.", resolvedIntent: "turn" },
      { id: "foreshadow", label: "Foreshadow", detail: "Keep it subtle.", resolvedIntent: "foreshadow" },
    ],
  },
}));
assert(clarify, "structured Clarify must enable the Session Timeline");
assert.equal(clarify.currentPhaseId, "clarify");
assert.equal(clarify.title, "P13S01");
assert.equal(clarify.phases.filter((phase) => phase.state === "current").length, 1);
assert.equal(clarify.phases.find((phase) => phase.id === "clarify")?.state, "current");
assert.equal(clarify.phases.find((phase) => phase.id === "proposal")?.state, "locked");
assert.equal(clarify.phases.find((phase) => phase.id === "review")?.state, "locked");

const proposal = buildAgentSessionTimelineProjection(reviewTurn({
  mode: "confirmation",
  phase: "proposal",
  proposal: {
    actionId: "action_proposal",
    confirmationId: "confirmation_proposal",
    confirmationActionId: "action_proposal",
    summary: "Adjust the timing",
    message: "Keep the original result and stage the change.",
    targetLabel: "P13S01",
    proposedChanges: [{ field: "timing", to: "later", reason: "preserve the action" }],
  },
}));
assert(proposal, "structured Proposal must enable the Session Timeline");
assert.equal(proposal.currentPhaseId, "proposal");
assert.equal(proposal.phases.filter((phase) => phase.state === "current").length, 1);
assert.equal(proposal.phases.find((phase) => phase.id === "clarify")?.state, "complete");
assert.equal(proposal.phases.find((phase) => phase.id === "proposal")?.state, "current");
assert.equal(proposal.phases.find((phase) => phase.id === "confirmation")?.state, "locked");
assert.equal(proposal.phases.find((phase) => phase.id === "running")?.state, "locked");

assert.equal(buildAgentReviewSessionTimelineProjection(reviewTurn({ phase: "running", mode: "running" })), undefined);
assert.equal(buildAgentReviewSessionTimelineProjection(reviewTurn({
  task: { ...reviewTurn().task, step: "prepare_references" },
})), undefined);

const [componentSource, panelSource] = await Promise.all([
  readFile(new URL("../src/ui/director/AgentSessionTimeline.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/ui/director/MinimalAgentPanel.tsx", import.meta.url), "utf8"),
]);
assert(componentSource.includes('aria-label="导演会话时间线"'));
assert(componentSource.includes('aria-current={current ? "step" : undefined}'));
assert(componentSource.includes('data-session-phase-state={phase.state}'));
assert(!componentSource.includes("<button"), "the Session Timeline must not introduce execution authority");
assert(panelSource.includes('sessionTimelineProjection?.currentPhaseId === "clarify"'));
assert(panelSource.includes('sessionTimelineProjection?.currentPhaseId === "proposal"'));
assert(panelSource.includes('sessionTimelineProjection?.currentPhaseId === "review"'));
assert(panelSource.match(/<AgentSessionTimeline projection=\{sessionTimelineProjection\}>/g)?.length === 3);
assert(panelSource.includes('aria-label="当前视频复核"'), "the existing Review action surface must remain intact");

console.log("agent session timeline projection test passed");
