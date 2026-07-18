import type { VibeAgentTimelineEntry } from "../../agent-core/types";
import {
  AGENT_DIRECTOR_REVIEW_IDENTITY_SCHEMA_VERSION,
  agentDirectorReviewIdentityFromUnknown,
  agentDirectorReviewIdentityMatches,
  agentDirectorReviewRevisionIntentId,
  validateAgentDirectorReviewIdentity,
  type AgentDirectorReviewIdentity,
} from "../../core/agentDirectorReviewDecision";

const reviewRevisionIntentDetailKind = "agent_director_review_revision_intent";

export interface AgentDirectorReviewRevisionIntent {
  schemaVersion: typeof AGENT_DIRECTOR_REVIEW_IDENTITY_SCHEMA_VERSION;
  intentId: string;
  status: "clarify";
  identity: AgentDirectorReviewIdentity;
  targetLabel: string;
  composerPrompt: string;
  boundary: string;
  createdAt: string;
  originalResultPreserved: true;
  generationJobCreated: false;
  providerCalled: false;
  projectFactsMutated: false;
  exportTriggered: false;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export function buildAgentDirectorReviewRevisionIntent(input: {
  identity: AgentDirectorReviewIdentity;
  targetLabel?: string;
  createdAt?: string;
}): { ok: boolean; intent?: AgentDirectorReviewRevisionIntent; blockers: string[] } {
  const blockers = validateAgentDirectorReviewIdentity(input.identity);
  if (blockers.length) return { ok: false, blockers };
  const targetLabel = text(input.targetLabel) || input.identity.shotId;
  const intentId = agentDirectorReviewRevisionIntentId(input.identity);
  return {
    ok: true,
    blockers: [],
    intent: {
      schemaVersion: AGENT_DIRECTOR_REVIEW_IDENTITY_SCHEMA_VERSION,
      intentId,
      status: "clarify",
      identity: input.identity,
      targetLabel,
      composerPrompt: `${targetLabel} 需要修改：`,
      boundary: "只记录修改意图并进入导演讨论；保留原结果，不会自动重试、提交 Provider、晋级或导出。",
      createdAt: input.createdAt || new Date().toISOString(),
      originalResultPreserved: true,
      generationJobCreated: false,
      providerCalled: false,
      projectFactsMutated: false,
      exportTriggered: false,
    },
  };
}

export function buildAgentDirectorReviewRevisionTimelineEntries(
  intent: AgentDirectorReviewRevisionIntent,
): VibeAgentTimelineEntry[] {
  return [{
    id: intent.intentId,
    type: "assistant_message",
    createdAt: intent.createdAt,
    title: "AI 导演：说明修改方向",
    body: `保留 ${intent.targetLabel} 当前返回版本。请说明要修改的时机、动作或连续性。`,
    lifecycle: "needs_user_input",
    status: "waiting",
    facts: [
      { label: "范围", value: intent.targetLabel },
      { label: "原结果", value: "保留" },
      { label: "执行", value: "尚未创建新任务" },
    ],
    details: {
      directorTurnKind: reviewRevisionIntentDetailKind,
      schemaVersion: intent.schemaVersion,
      intentId: intent.intentId,
      status: intent.status,
      reviewIdentity: intent.identity,
      targetLabel: intent.targetLabel,
      composerPrompt: intent.composerPrompt,
      boundary: intent.boundary,
      originalResultPreserved: intent.originalResultPreserved,
      generationJobCreated: intent.generationJobCreated,
      providerCalled: intent.providerCalled,
      projectFactsMutated: intent.projectFactsMutated,
      exportTriggered: intent.exportTriggered,
    },
  }];
}

function reviewRevisionIntentFromEntry(entry: VibeAgentTimelineEntry): AgentDirectorReviewRevisionIntent | undefined {
  const details = record(entry.details);
  if (details?.directorTurnKind !== reviewRevisionIntentDetailKind) return undefined;
  const identity = agentDirectorReviewIdentityFromUnknown(details.reviewIdentity);
  if (!identity || validateAgentDirectorReviewIdentity(identity).length) return undefined;
  const intentId = text(details.intentId);
  const targetLabel = text(details.targetLabel);
  const composerPrompt = text(details.composerPrompt);
  const boundary = text(details.boundary);
  if (!intentId || !targetLabel || !composerPrompt || !boundary) return undefined;
  return {
    schemaVersion: AGENT_DIRECTOR_REVIEW_IDENTITY_SCHEMA_VERSION,
    intentId,
    status: "clarify",
    identity,
    targetLabel,
    composerPrompt,
    boundary,
    createdAt: entry.createdAt,
    originalResultPreserved: true,
    generationJobCreated: false,
    providerCalled: false,
    projectFactsMutated: false,
    exportTriggered: false,
  };
}

export function activeAgentDirectorReviewRevisionIntentFromTimeline(
  entries: VibeAgentTimelineEntry[],
  expectedIdentity?: AgentDirectorReviewIdentity,
): AgentDirectorReviewRevisionIntent | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    const intent = reviewRevisionIntentFromEntry(entry);
    if (!intent || entry.status === "done") continue;
    if (expectedIdentity && !agentDirectorReviewIdentityMatches(intent.identity, expectedIdentity)) continue;
    const resolved = entries.slice(index + 1).some((candidate) => (
      candidate.type === "confirmation_request"
        || candidate.type === "tool_call"
        || (candidate.type === "user_message" && candidate.id !== intent.intentId)
    ));
    if (!resolved) return intent;
  }
  return undefined;
}
