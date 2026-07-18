import type { VibeAgentTimelineEntry } from "../../agent-core/types";
import type { AgentVideoGenerationJob } from "../../core/agentVideoProductionContract";
import {
  AGENT_DIRECTOR_REVIEW_IDENTITY_SCHEMA_VERSION,
  agentDirectorReviewIdentityFromUnknown,
  agentDirectorReviewIdentityMatches,
  normalizeAgentDirectorReviewProjectRoot,
  validateAgentDirectorReviewIdentity,
  type AgentDirectorReviewIdentity,
} from "../../core/agentDirectorReviewDecision";
import type { AgentDirectorClarificationTurn } from "./agentDirectorClarification";
import type { AgentDirectorReviewRevisionIntent } from "./agentDirectorReviewRevision";

export const AGENT_DIRECTOR_REVIEW_REGENERATION_SCHEMA_VERSION = "agent_director_review_regeneration/1.0.0" as const;

const proposalDetailKind = "agent_director_review_regeneration_proposal";
const proposalConfirmedDetailKind = "agent_director_review_regeneration_proposal_confirmed";
const proposalRevisionDetailKind = "agent_director_review_regeneration_proposal_revision";
const confirmationDetailKind = "agent_director_review_regeneration_confirmation";

export interface AgentDirectorReviewRegenerationProposal {
  schemaVersion: typeof AGENT_DIRECTOR_REVIEW_REGENERATION_SCHEMA_VERSION;
  proposalId: string;
  status: "awaiting_confirmation";
  revisionIntentId: string;
  clarificationId: string;
  sourceIdentity: AgentDirectorReviewIdentity;
  targetLabel: string;
  resolvedIntent: string;
  directionLabel: string;
  summary: string;
  message: string;
  proposedChanges: Array<{
    field: string;
    from?: string;
    to: string;
    reason: string;
  }>;
  promptPolicy: "compile_after_proposal_confirmation";
  originalResultPreserved: true;
  generationActionCreated: false;
  providerCalled: false;
  createdAt: string;
}

export interface AgentDirectorReviewRegenerationConfirmation {
  schemaVersion: typeof AGENT_DIRECTOR_REVIEW_REGENERATION_SCHEMA_VERSION;
  proposalId: string;
  revisionIntentId: string;
  sourceIdentity: AgentDirectorReviewIdentity;
  actionId: string;
  confirmationId: string;
  jobId: string;
  executionMode: "dry_run";
  promptPolicy: "compiled_from_confirmed_proposal";
  compiledPromptHash: string;
  originalResultPreserved: true;
  providerCalled: false;
  createdAt: string;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function stableId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function safeId(value: string, fallback: string) {
  return text(value).replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

function proposalFromEntry(entry: VibeAgentTimelineEntry): AgentDirectorReviewRegenerationProposal | undefined {
  const details = record(entry.details);
  if (details?.directorTurnKind !== proposalDetailKind) return undefined;
  const sourceIdentity = agentDirectorReviewIdentityFromUnknown(details.sourceReviewIdentity);
  const proposalId = text(details.proposalId);
  const revisionIntentId = text(details.revisionIntentId);
  const clarificationId = text(details.clarificationId);
  const targetLabel = text(details.targetLabel);
  const resolvedIntent = text(details.resolvedIntent);
  const directionLabel = text(details.directionLabel);
  const summary = text(details.summary);
  const message = text(details.message);
  const proposedChanges = Array.isArray(details.proposedChanges)
    ? details.proposedChanges.map((value) => {
      const change = record(value);
      const field = text(change?.field);
      const from = text(change?.from);
      const to = text(change?.to);
      const reason = text(change?.reason);
      return field && to && reason ? { field, ...(from ? { from } : {}), to, reason } : undefined;
    }).filter((value): value is AgentDirectorReviewRegenerationProposal["proposedChanges"][number] => Boolean(value))
    : [];
  if (
    !sourceIdentity
    || validateAgentDirectorReviewIdentity(sourceIdentity).length
    || !proposalId
    || !revisionIntentId
    || !clarificationId
    || !targetLabel
    || !resolvedIntent
    || !directionLabel
    || !summary
    || !message
    || proposedChanges.length < 2
    || details.schemaVersion !== AGENT_DIRECTOR_REVIEW_REGENERATION_SCHEMA_VERSION
    || details.status !== "awaiting_confirmation"
    || details.promptPolicy !== "compile_after_proposal_confirmation"
    || details.originalResultPreserved !== true
    || details.generationActionCreated !== false
    || details.providerCalled !== false
  ) return undefined;
  return {
    schemaVersion: AGENT_DIRECTOR_REVIEW_REGENERATION_SCHEMA_VERSION,
    proposalId,
    status: "awaiting_confirmation",
    revisionIntentId,
    clarificationId,
    sourceIdentity,
    targetLabel,
    resolvedIntent,
    directionLabel,
    summary,
    message,
    proposedChanges,
    promptPolicy: "compile_after_proposal_confirmation",
    originalResultPreserved: true,
    generationActionCreated: false,
    providerCalled: false,
    createdAt: entry.createdAt,
  };
}

export function buildAgentDirectorReviewRegenerationProposal(input: {
  revisionIntent: Pick<AgentDirectorReviewRevisionIntent, "intentId" | "identity" | "targetLabel">;
  clarification: AgentDirectorClarificationTurn;
  resolvedIntent: string;
  directionLabel?: string;
  createdAt?: string;
}): { ok: boolean; proposal?: AgentDirectorReviewRegenerationProposal; blockers: string[] } {
  const resolvedIntent = text(input.resolvedIntent);
  const binding = input.clarification.reviewRevision;
  const blockers = [
    ...validateAgentDirectorReviewIdentity(input.revisionIntent.identity),
    binding?.intentId === input.revisionIntent.intentId ? "" : "review_regeneration_revision_intent_mismatch",
    agentDirectorReviewIdentityMatches(binding?.identity, input.revisionIntent.identity) ? "" : "review_regeneration_source_identity_mismatch",
    resolvedIntent ? "" : "review_regeneration_resolved_intent_required",
  ].filter(Boolean);
  if (blockers.length) return { ok: false, blockers };
  const createdAt = input.createdAt || new Date().toISOString();
  const directionLabel = text(input.directionLabel) || "自定义修改";
  const proposalId = `proposal_agent_video_${safeId(input.revisionIntent.identity.shotId, "shot")}_${stableId([
    input.revisionIntent.intentId,
    input.clarification.id,
    resolvedIntent,
  ].join("::"))}`;
  return {
    ok: true,
    blockers: [],
    proposal: {
      schemaVersion: AGENT_DIRECTOR_REVIEW_REGENERATION_SCHEMA_VERSION,
      proposalId,
      status: "awaiting_confirmation",
      revisionIntentId: input.revisionIntent.intentId,
      clarificationId: input.clarification.id,
      sourceIdentity: input.revisionIntent.identity,
      targetLabel: input.revisionIntent.targetLabel,
      resolvedIntent,
      directionLabel,
      summary: `修改后重新生成 ${input.revisionIntent.targetLabel}`,
      message: `保留当前 ${input.revisionIntent.targetLabel} 版本，按“${directionLabel}”形成一个新的候选版本。`,
      proposedChanges: [
        {
          field: "directorIntent",
          to: resolvedIntent,
          reason: "先确认导演修改目标，再编译新的生成请求。",
        },
        {
          field: "versionPolicy",
          from: "当前返回版本",
          to: "保留旧版本，新增独立候选",
          reason: "重新生成不能覆盖旧媒体或旧复核证据。",
        },
        {
          field: "reviewGate",
          to: "新结果仍需人工复核",
          reason: "新结果不得自动通过、晋级项目事实或导出。",
        },
      ],
      promptPolicy: "compile_after_proposal_confirmation",
      originalResultPreserved: true,
      generationActionCreated: false,
      providerCalled: false,
      createdAt,
    },
  };
}

export function buildAgentDirectorReviewRegenerationProposalTimelineEntries(
  proposal: AgentDirectorReviewRegenerationProposal,
): VibeAgentTimelineEntry[] {
  return [{
    id: proposal.proposalId,
    type: "assistant_message",
    createdAt: proposal.createdAt,
    title: "AI 导演：修改提案",
    body: proposal.message,
    lifecycle: "needs_user_input",
    status: "waiting",
    facts: [
      { label: "范围", value: proposal.targetLabel },
      { label: "旧结果", value: "保留" },
      { label: "新动作", value: "确认提案后才创建" },
    ],
    details: {
      directorTurnKind: proposalDetailKind,
      schemaVersion: proposal.schemaVersion,
      proposalId: proposal.proposalId,
      status: proposal.status,
      revisionIntentId: proposal.revisionIntentId,
      clarificationId: proposal.clarificationId,
      sourceReviewIdentity: proposal.sourceIdentity,
      targetLabel: proposal.targetLabel,
      resolvedIntent: proposal.resolvedIntent,
      directionLabel: proposal.directionLabel,
      summary: proposal.summary,
      message: proposal.message,
      proposedChanges: proposal.proposedChanges,
      promptPolicy: proposal.promptPolicy,
      originalResultPreserved: proposal.originalResultPreserved,
      generationActionCreated: proposal.generationActionCreated,
      providerCalled: proposal.providerCalled,
    },
  }];
}

export function activeAgentDirectorReviewRegenerationProposalFromTimeline(
  entries: VibeAgentTimelineEntry[],
  expectedIdentity?: AgentDirectorReviewIdentity,
): AgentDirectorReviewRegenerationProposal | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const proposal = proposalFromEntry(entries[index]!);
    if (!proposal || entries[index]!.status === "done") continue;
    if (expectedIdentity && !agentDirectorReviewIdentityMatches(proposal.sourceIdentity, expectedIdentity)) continue;
    const resolved = entries.slice(index + 1).some((entry) => {
      const details = record(entry.details);
      return details?.proposalId === proposal.proposalId
        && (
          details.directorTurnKind === proposalConfirmedDetailKind
          || details.directorTurnKind === proposalRevisionDetailKind
          || details.directorTurnKind === confirmationDetailKind
        );
    });
    if (!resolved) return proposal;
  }
  return undefined;
}

export function buildAgentDirectorReviewRegenerationProposalRevisionTimelineEntry(input: {
  proposal: AgentDirectorReviewRegenerationProposal;
  createdAt?: string;
}): VibeAgentTimelineEntry {
  return {
    id: `${input.proposal.proposalId}_revision`,
    type: "user_message",
    createdAt: input.createdAt || new Date().toISOString(),
    title: "你：继续调整提案",
    body: input.proposal.resolvedIntent,
    status: "done",
    facts: [{ label: "范围", value: input.proposal.targetLabel }],
    details: {
      directorTurnKind: proposalRevisionDetailKind,
      proposalId: input.proposal.proposalId,
      revisionIntentId: input.proposal.revisionIntentId,
      sourceReviewIdentity: input.proposal.sourceIdentity,
    },
  };
}

export function compileAgentDirectorReviewRegenerationPrompt(
  proposal: AgentDirectorReviewRegenerationProposal,
) {
  return [
    "再提交当前镜头的一个独立视频候选版本。",
    `目标镜头：${proposal.sourceIdentity.shotId}。`,
    `导演修改目标：${proposal.resolvedIntent}`,
    "版本约束：保留现有返回视频和 Review 证据，不覆盖旧 candidate。",
    "结果约束：新结果必须单独回到 needs_review，不自动批准、晋级项目事实或导出。",
  ].join("\n");
}

export function buildAgentDirectorReviewRegenerationConfirmationTimelineEntries(input: {
  proposal: AgentDirectorReviewRegenerationProposal;
  job: AgentVideoGenerationJob;
  confirmationId: string;
  compiledPrompt: string;
  createdAt?: string;
}): { ok: boolean; entries: VibeAgentTimelineEntry[]; confirmation?: AgentDirectorReviewRegenerationConfirmation; blockers: string[] } {
  const createdAt = input.createdAt || new Date().toISOString();
  const confirmationId = text(input.confirmationId);
  const compiledPrompt = text(input.compiledPrompt);
  const job = input.job;
  const blockers = [
    confirmationId ? "" : "review_regeneration_confirmation_id_required",
    compiledPrompt && compiledPrompt !== input.proposal.resolvedIntent ? "" : "review_regeneration_compiled_prompt_required",
    job.status === "staged" ? "" : "review_regeneration_job_must_be_staged",
    job.executionMode === "dry_run" ? "" : "review_regeneration_job_must_be_dry_run",
    job.kind === "video_submit" && job.pipelineStep === "submit_video" ? "" : "review_regeneration_job_kind_invalid",
    job.actionId && job.actionId !== input.proposal.sourceIdentity.actionId ? "" : "review_regeneration_new_action_id_required",
    job.jobId && job.jobId !== input.proposal.sourceIdentity.jobId ? "" : "review_regeneration_new_job_id_required",
    confirmationId !== input.proposal.sourceIdentity.actionId
      && confirmationId !== input.proposal.sourceIdentity.jobId
      && confirmationId !== input.proposal.sourceIdentity.sourceReceiptId
      ? ""
      : "review_regeneration_new_confirmation_id_required",
    job.sourceConfirmationId === confirmationId ? "" : "review_regeneration_confirmation_job_mismatch",
    job.projectId === input.proposal.sourceIdentity.projectId
      && normalizeAgentDirectorReviewProjectRoot(job.projectRoot)
        === normalizeAgentDirectorReviewProjectRoot(input.proposal.sourceIdentity.projectRoot)
      && job.projectFactHash === input.proposal.sourceIdentity.projectFactHash
      ? ""
      : "review_regeneration_project_identity_mismatch",
  ].filter(Boolean);
  if (blockers.length) return { ok: false, entries: [], blockers };
  const confirmation: AgentDirectorReviewRegenerationConfirmation = {
    schemaVersion: AGENT_DIRECTOR_REVIEW_REGENERATION_SCHEMA_VERSION,
    proposalId: input.proposal.proposalId,
    revisionIntentId: input.proposal.revisionIntentId,
    sourceIdentity: input.proposal.sourceIdentity,
    actionId: job.actionId,
    confirmationId,
    jobId: job.jobId,
    executionMode: "dry_run",
    promptPolicy: "compiled_from_confirmed_proposal",
    compiledPromptHash: `fnv1a:${stableId(compiledPrompt)}`,
    originalResultPreserved: true,
    providerCalled: false,
    createdAt,
  };
  const commonDetails = {
    schemaVersion: confirmation.schemaVersion,
    proposalId: confirmation.proposalId,
    revisionIntentId: confirmation.revisionIntentId,
    sourceReviewIdentity: confirmation.sourceIdentity,
    actionId: confirmation.actionId,
    confirmationId: confirmation.confirmationId,
    jobId: confirmation.jobId,
    executionMode: confirmation.executionMode,
    promptPolicy: confirmation.promptPolicy,
    compiledPromptHash: confirmation.compiledPromptHash,
    originalResultPreserved: confirmation.originalResultPreserved,
    providerCalled: confirmation.providerCalled,
    projectId: job.projectId,
    projectRoot: job.projectRoot,
    projectFactHash: job.projectFactHash,
  };
  return {
    ok: true,
    blockers: [],
    confirmation,
    entries: [
      {
        id: `${input.proposal.proposalId}_confirmed`,
        type: "user_message",
        createdAt,
        title: "你：确认修改提案",
        body: input.proposal.resolvedIntent,
        actionId: job.actionId,
        status: "done",
        facts: [{ label: "范围", value: input.proposal.targetLabel }],
        details: {
          ...commonDetails,
          directorTurnKind: proposalConfirmedDetailKind,
        },
      },
      {
        id: confirmationId,
        type: "confirmation_request",
        createdAt,
        title: `确认重新生成 ${input.proposal.targetLabel}`,
        body: "提案已确认。下一步只验证这个新生成任务的确认边界，不调用付费生成服务。",
        toolName: "submit_video",
        actionKind: "prepare_video_submit",
        actionId: job.actionId,
        confirmationRequired: true,
        lifecycle: "waiting_for_confirmation",
        status: "waiting",
        facts: [
          { label: "目标", value: input.proposal.targetLabel },
          { label: "任务", value: job.jobId },
          { label: "方式", value: "本地合同验证" },
          { label: "旧结果", value: "保留" },
        ],
        details: {
          ...commonDetails,
          directorTurnKind: confirmationDetailKind,
          next: "确认后仍只做本地合同验证；不会调用付费生成服务、自动重试、晋级或导出。",
        },
      },
    ],
  };
}

function confirmationFromEntry(entry: VibeAgentTimelineEntry): AgentDirectorReviewRegenerationConfirmation | undefined {
  const details = record(entry.details);
  if (entry.type !== "confirmation_request" || details?.directorTurnKind !== confirmationDetailKind) return undefined;
  const sourceIdentity = agentDirectorReviewIdentityFromUnknown(details.sourceReviewIdentity);
  const proposalId = text(details.proposalId);
  const revisionIntentId = text(details.revisionIntentId);
  const actionId = text(details.actionId);
  const confirmationId = text(details.confirmationId);
  const jobId = text(details.jobId);
  const compiledPromptHash = text(details.compiledPromptHash);
  if (
    !sourceIdentity
    || validateAgentDirectorReviewIdentity(sourceIdentity).length
    || !proposalId
    || !revisionIntentId
    || !actionId
    || !confirmationId
    || !jobId
    || confirmationId !== entry.id
    || actionId !== entry.actionId
    || details.schemaVersion !== AGENT_DIRECTOR_REVIEW_REGENERATION_SCHEMA_VERSION
    || details.executionMode !== "dry_run"
    || details.promptPolicy !== "compiled_from_confirmed_proposal"
    || !compiledPromptHash.startsWith("fnv1a:")
    || details.originalResultPreserved !== true
    || details.providerCalled !== false
  ) return undefined;
  return {
    schemaVersion: AGENT_DIRECTOR_REVIEW_REGENERATION_SCHEMA_VERSION,
    proposalId,
    revisionIntentId,
    sourceIdentity,
    actionId,
    confirmationId,
    jobId,
    executionMode: "dry_run",
    promptPolicy: "compiled_from_confirmed_proposal",
    compiledPromptHash,
    originalResultPreserved: true,
    providerCalled: false,
    createdAt: entry.createdAt,
  };
}

export function activeAgentDirectorReviewRegenerationConfirmationFromTimeline(
  entries: VibeAgentTimelineEntry[],
  expectedIdentity?: AgentDirectorReviewIdentity,
): AgentDirectorReviewRegenerationConfirmation | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    const confirmation = confirmationFromEntry(entry);
    if (!confirmation || (entry.status !== "waiting" && entry.lifecycle !== "waiting_for_confirmation")) continue;
    if (expectedIdentity && !agentDirectorReviewIdentityMatches(confirmation.sourceIdentity, expectedIdentity)) continue;
    return confirmation;
  }
  return undefined;
}

export function agentDirectorReviewRegenerationConfirmationMatchesJob(
  confirmation: AgentDirectorReviewRegenerationConfirmation | undefined,
  input: {
    actionId?: string;
    confirmationId?: string;
    job?: Pick<
      AgentVideoGenerationJob,
      "jobId" | "actionId" | "sourceConfirmationId" | "executionMode" | "providerCalled"
    >;
  },
) {
  const job = input.job;
  return Boolean(
    confirmation
      && job
      && input.actionId === confirmation.actionId
      && input.confirmationId === confirmation.confirmationId
      && job.jobId === confirmation.jobId
      && job.actionId === confirmation.actionId
      && job.sourceConfirmationId === confirmation.confirmationId
      && job.executionMode === "dry_run"
      && job.providerCalled === false,
  );
}

export function agentDirectorReviewRegenerationSchemaCompatibility() {
  return {
    reviewIdentitySchemaVersion: AGENT_DIRECTOR_REVIEW_IDENTITY_SCHEMA_VERSION,
    regenerationSchemaVersion: AGENT_DIRECTOR_REVIEW_REGENERATION_SCHEMA_VERSION,
  };
}
