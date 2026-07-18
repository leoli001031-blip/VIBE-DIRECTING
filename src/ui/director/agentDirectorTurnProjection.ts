import type {
  AgentCurrentTaskEffect,
  AgentCurrentTaskFact,
  AgentCurrentTaskProjection,
} from "../../core/agentCurrentTaskProjection";
import {
  agentVideoGenerationReviewResultMatchesJob,
  type AgentVideoGenerationJob,
} from "../../core/agentVideoProductionContract";
import type { CreatorReviewTrayItem } from "./creatorDeskTypes";

export type AgentDirectorTurnMode = "conversation" | "confirmation" | "running" | "review" | "blocked" | "idle";

export type AgentDirectorTurnPhase =
  | "conversation"
  | "clarification"
  | "proposal"
  | "confirmation"
  | "running"
  | "review"
  | "blocked"
  | "idle";

export type AgentDirectorTurnActionId =
  | "confirm_current_task"
  | "continue_conversation"
  | "background_job"
  | "inspect_job"
  | "approve_preview"
  | "request_changes"
  | "promote_project_fact";

export type AgentDirectorTurnActionEffect =
  | AgentCurrentTaskEffect
  | "conversation_only"
  | "job_observation"
  | "review_receipt"
  | "project_edit"
  | "project_fact_promotion";

export interface AgentDirectorClarificationOptionProjection {
  id: string;
  label: string;
  detail: string;
  resolvedIntent: string;
  effect: "conversation_only";
}

export interface AgentDirectorClarificationProjection {
  id: string;
  sourceIntent: string;
  targetLabel: string;
  question: string;
  boundary: string;
  options: AgentDirectorClarificationOptionProjection[];
}

export interface AgentDirectorProposalProjection {
  actionId: string;
  confirmationId: string;
  confirmationActionId: string;
  summary: string;
  message: string;
  targetLabel: string;
  proposedChanges: Array<{
    field: string;
    from?: string;
    to: string;
    reason: string;
  }>;
}

export interface AgentDirectorConfirmationContext {
  confirmationId?: string;
  actionId?: string;
  projectFactHash?: string;
  executionMode?: "dry_run" | "live";
  title?: string;
  message?: string;
  facts?: AgentCurrentTaskFact[];
}

export interface AgentDirectorConfirmationProjection {
  confirmationId: string;
  actionId: string;
  projectFactHash: string;
  executionMode?: "dry_run" | "live";
  title: string;
  message: string;
  facts: AgentCurrentTaskFact[];
}

export interface AgentDirectorRunningProgressItem {
  id: "confirmation" | "job" | "execution";
  label: string;
  status: "complete" | "current" | "pending";
}

export interface AgentDirectorRunningProjection {
  jobId: string;
  actionId: string;
  projectFactHash: string;
  sourceConfirmationId: string;
  status: "confirmed" | "running";
  executionMode: "dry_run" | "live";
  operation: "execute" | "query";
  providerCalled: boolean;
  executionServiceId: string;
  modelId: string;
  externalTaskId?: string;
  createdAt: string;
  updatedAt: string;
  progress: AgentDirectorRunningProgressItem[];
}

export interface AgentDirectorTurnAction {
  id: AgentDirectorTurnActionId;
  label: string;
  effect: AgentDirectorTurnActionEffect;
  enabled: boolean;
  requiresConfirmation: boolean;
  boundary: string;
}

export interface AgentDirectorTurnProjection {
  mode: AgentDirectorTurnMode;
  phase: AgentDirectorTurnPhase;
  task: AgentCurrentTaskProjection;
  reviewTarget?: CreatorReviewTrayItem;
  clarification?: AgentDirectorClarificationProjection;
  proposal?: AgentDirectorProposalProjection;
  confirmation?: AgentDirectorConfirmationProjection;
  running?: AgentDirectorRunningProjection;
  confirmationIdentityReady: boolean;
  runningIdentityReady: boolean;
  reviewIdentityReady: boolean;
  blockers: string[];
  actions: AgentDirectorTurnAction[];
}

function clean(value: string | undefined) {
  return value?.trim() || "";
}

function reviewTargetHasIdentity(target: CreatorReviewTrayItem | undefined) {
  return Boolean(
    target
      && target.status === "needs_review"
      && clean(target.sourceReceiptId)
      && clean(target.outputHash),
  );
}

function normalizeMediaPath(value: string | undefined) {
  return value?.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/private\/tmp(?=\/|$)/, "/tmp") || "";
}

function reviewTargetMatchesJob(
  target: CreatorReviewTrayItem | undefined,
  job: AgentVideoGenerationJob | undefined,
  currentProjectFactHash: string | undefined,
) {
  const result = job?.reviewResult;
  return Boolean(
    target
      && job
      && result
      && agentVideoGenerationReviewResultMatchesJob(job, result)
      && clean(currentProjectFactHash)
      && job.projectFactHash === currentProjectFactHash
      && target.jobId === job.jobId
      && target.actionId === job.actionId
      && target.projectFactHash === job.projectFactHash
      && target.shotId === result.shotId
      && target.sourceReceiptId === result.sourceReceiptId
      && target.outputHash?.toLowerCase() === result.outputHash.toLowerCase()
      && normalizeMediaPath(target.mediaPath) === normalizeMediaPath(result.outputPath),
  );
}

function confirmationBoundary(effect: AgentCurrentTaskEffect) {
  if (effect === "generation_job") return "只执行当前已确认的生成任务，不自动重试、批准或导出。";
  if (effect === "local_export") return "只执行当前交付确认，不会调用图片或视频生成服务。";
  if (effect === "state_only") return "只更新当前项目状态，不会生成媒体或导出。";
  return "只确认当前步骤，不会越过后续确认边界。";
}

function isNonTerminalRunningJob(
  job: AgentVideoGenerationJob | undefined,
): job is AgentVideoGenerationJob & { status: "confirmed" | "running" } {
  return Boolean(job && (job.status === "confirmed" || job.status === "running"));
}

function runningJobMatchesTask(input: {
  task: AgentCurrentTaskProjection;
  job?: AgentVideoGenerationJob;
  currentProjectFactHash?: string;
}) {
  const { task, job, currentProjectFactHash } = input;
  if (!isNonTerminalRunningJob(job)) return false;
  return Boolean(
    clean(task.jobId)
      && clean(task.actionId)
      && clean(currentProjectFactHash)
      && job.jobId === task.jobId
      && job.actionId === task.actionId
      && job.projectFactHash === currentProjectFactHash,
  );
}

function buildRunningProjection(
  job: AgentVideoGenerationJob & { status: "confirmed" | "running" },
): AgentDirectorRunningProjection {
  const executionStarted = job.status === "running";
  const providerStepLabel = job.executionMode === "live" ? "执行方已接收" : "本地执行合同已接收";
  return {
    jobId: job.jobId,
    actionId: job.actionId,
    projectFactHash: job.projectFactHash,
    sourceConfirmationId: job.sourceConfirmationId,
    status: job.status,
    executionMode: job.executionMode,
    operation: job.operation,
    providerCalled: job.providerCalled,
    executionServiceId: job.providerId,
    modelId: job.modelId,
    externalTaskId: job.externalTaskId,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    progress: [
      { id: "confirmation", label: "确认回执已锁定", status: "complete" },
      { id: "job", label: providerStepLabel, status: executionStarted ? "complete" : "current" },
      { id: "execution", label: executionStarted ? "执行中" : "等待执行", status: executionStarted ? "current" : "pending" },
    ],
  };
}

export function buildAgentDirectorTurnProjection(input: {
  task: AgentCurrentTaskProjection;
  reviewTarget?: CreatorReviewTrayItem;
  clarification?: Omit<AgentDirectorClarificationProjection, "options"> & {
    options: Array<Omit<AgentDirectorClarificationOptionProjection, "effect">>;
  };
  proposal?: AgentDirectorProposalProjection;
  confirmationContext?: AgentDirectorConfirmationContext;
  runningJob?: AgentVideoGenerationJob;
  reviewJob?: AgentVideoGenerationJob;
  currentProjectFactHash?: string;
}): AgentDirectorTurnProjection {
  const {
    task,
    reviewTarget,
    clarification,
    proposal,
    confirmationContext,
    runningJob,
    reviewJob,
    currentProjectFactHash,
  } = input;
  const reviewTask = !task.requiresConfirmation
    && task.effect === "none"
    && (task.step === "prepare_references" || task.step === "submit_video");
  const reviewIdentityReady = reviewTargetHasIdentity(reviewTarget)
    && (!reviewJob || reviewTargetMatchesJob(reviewTarget, reviewJob, currentProjectFactHash));
  const paidConfirmationTask = task.requiresConfirmation
    && task.effect === "generation_job"
    && task.source !== "pipeline_job";
  const confirmationIdentityReady = !paidConfirmationTask || Boolean(
    confirmationContext
      && clean(task.confirmationId)
      && clean(task.actionId)
      && clean(currentProjectFactHash)
      && confirmationContext.confirmationId === task.confirmationId
      && confirmationContext.actionId === task.actionId
      && confirmationContext.projectFactHash === currentProjectFactHash,
  );
  const runningIdentityReady = task.source !== "pipeline_job" || task.requiresConfirmation
    ? false
    : runningJobMatchesTask({ task, job: runningJob, currentProjectFactHash });
  const blockers = [...task.blockers];

  const taskIsProjectEditConfirmation = task.requiresConfirmation && task.confirmationKind === "project_edit";
  if (proposal || taskIsProjectEditConfirmation) {
    const proposalIdentityReady = Boolean(
      proposal?.actionId
      && proposal.confirmationId
      && proposal.confirmationActionId
      && proposal.actionId === proposal.confirmationActionId
      && (!taskIsProjectEditConfirmation || !task.actionId || proposal.actionId === task.actionId),
    );
    if (!proposalIdentityReady) blockers.push("当前提案与待确认动作身份不一致，不能写入项目。");
    return {
      mode: proposalIdentityReady && !blockers.length ? "confirmation" : "blocked",
      phase: "proposal",
      task,
      proposal,
      confirmationIdentityReady,
      runningIdentityReady,
      reviewIdentityReady,
      blockers,
      actions: [
        {
          id: "confirm_current_task",
          label: "确认写入项目",
          effect: "project_edit",
          enabled: proposalIdentityReady && !blockers.length,
          requiresConfirmation: true,
          boundary: "只写入当前提案范围；不生成参考、不提交视频、不调用外部生成服务、不导出。",
        },
        {
          id: "continue_conversation",
          label: "继续调整",
          effect: "conversation_only",
          enabled: true,
          requiresConfirmation: false,
          boundary: "只返回对话修改提案，不写项目、不调用外部生成服务。",
        },
      ],
    };
  }

  if (clarification) {
    return {
      mode: "conversation",
      phase: "clarification",
      task,
      clarification: {
        ...clarification,
        options: clarification.options.map((option) => ({ ...option, effect: "conversation_only" })),
      },
      confirmationIdentityReady,
      runningIdentityReady,
      reviewIdentityReady,
      blockers,
      actions: [{
        id: "continue_conversation",
        label: "继续说明",
        effect: "conversation_only",
        enabled: true,
        requiresConfirmation: false,
        boundary: "只补充导演意图，不写项目、不调用外部生成服务。",
      }],
    };
  }

  if (reviewTask) {
    if (!reviewIdentityReady) blockers.push(reviewJob
      ? "当前复核结果与返回任务的动作、事实、路径或哈希不一致，不能写入 Review Receipt。"
      : "当前复核结果缺少回执或输出哈希，不能写入 Review Receipt。");
    return {
      mode: blockers.length ? "blocked" : "review",
      phase: "review",
      task,
      reviewTarget,
      confirmationIdentityReady,
      runningIdentityReady,
      reviewIdentityReady,
      blockers,
      actions: [
        {
          id: "approve_preview",
          label: "通过预览",
          effect: "review_receipt",
          enabled: reviewIdentityReady,
          requiresConfirmation: false,
          boundary: "只写入 Review Receipt，不会晋级项目事实，不会导出。",
        },
        {
          id: "request_changes",
          label: "需要修改",
          effect: "conversation_only",
          enabled: true,
          requiresConfirmation: false,
          boundary: "只进入修改讨论，不会自动重试或重新提交外部任务。",
        },
        {
          id: "promote_project_fact",
          label: "晋级为项目事实",
          effect: "project_fact_promotion",
          enabled: false,
          requiresConfirmation: true,
          boundary: "需要独立授权，不能由预览通过代替。",
        },
      ],
    };
  }

  if (task.blockers.length) {
    return {
      mode: "blocked",
      phase: "blocked",
      task,
      confirmationIdentityReady,
      runningIdentityReady,
      reviewIdentityReady,
      blockers,
      actions: [{
        id: "continue_conversation",
        label: "继续说明",
        effect: "conversation_only",
        enabled: true,
        requiresConfirmation: false,
        boundary: "只补充信息，不会执行当前受阻动作。",
      }],
    };
  }

  if (task.requiresConfirmation) {
    if (!confirmationIdentityReady) {
      blockers.push("当前确认卡与待执行动作身份不一致，不能提交任务。");
    }
    const confirmation = confirmationIdentityReady && confirmationContext
      ? {
        confirmationId: confirmationContext.confirmationId!,
        actionId: confirmationContext.actionId!,
        projectFactHash: confirmationContext.projectFactHash!,
        executionMode: confirmationContext.executionMode,
        title: clean(confirmationContext.title) || task.label,
        message: clean(confirmationContext.message) || "确认后只执行当前任务一次。",
        facts: confirmationContext.facts || task.facts,
      } satisfies AgentDirectorConfirmationProjection
      : undefined;
    return {
      mode: blockers.length ? "blocked" : "confirmation",
      phase: "confirmation",
      task,
      confirmation,
      confirmationIdentityReady,
      runningIdentityReady,
      reviewIdentityReady,
      blockers,
      actions: [
        {
          id: "confirm_current_task",
          label: paidConfirmationTask
            ? task.step === "submit_video" ? "确认并提交 1 次" : "确认并执行 1 次"
            : task.label,
          effect: task.effect,
          enabled: confirmationIdentityReady && !blockers.length,
          requiresConfirmation: true,
          boundary: confirmationBoundary(task.effect),
        },
        {
          id: "continue_conversation",
          label: "返回调整",
          effect: "conversation_only",
          enabled: true,
          requiresConfirmation: false,
          boundary: "只修改方案，不会执行待确认动作。",
        },
      ],
    };
  }

  if (task.source === "pipeline_job") {
    if (
      !runningIdentityReady
      || !isNonTerminalRunningJob(runningJob)
    ) {
      blockers.push("当前运行任务缺少可核对的 job 身份，不能显示为执行中。");
      return {
        mode: "blocked",
        phase: "blocked",
        task,
        confirmationIdentityReady,
        runningIdentityReady,
        reviewIdentityReady,
        blockers,
        actions: [{
          id: "inspect_job",
          label: "查看任务记录",
          effect: "job_observation",
          enabled: Boolean(task.jobId),
          requiresConfirmation: false,
          boundary: "只查看当前任务和回执，不创建或重提任务。",
        }],
      };
    }
    return {
      mode: "running",
      phase: "running",
      task,
      running: buildRunningProjection(runningJob),
      confirmationIdentityReady,
      runningIdentityReady,
      reviewIdentityReady,
      blockers,
      actions: [
        {
          id: "background_job",
          label: "后台运行",
          effect: "job_observation",
          enabled: true,
          requiresConfirmation: false,
          boundary: "不创建新任务，也不会自动重试。",
        },
        {
          id: "inspect_job",
          label: "查看任务记录",
          effect: "job_observation",
          enabled: true,
          requiresConfirmation: false,
          boundary: "只查看当前任务和回执。",
        },
      ],
    };
  }

  return {
    mode: task.step === "idle" ? "idle" : "conversation",
    phase: task.step === "idle" ? "idle" : "conversation",
    task,
    confirmationIdentityReady,
    runningIdentityReady,
    reviewIdentityReady,
    blockers,
    actions: [{
      id: "continue_conversation",
      label: "继续讨论",
      effect: "conversation_only",
      enabled: true,
      requiresConfirmation: false,
      boundary: "只继续对话，不会执行生成、提交、晋级或导出。",
    }],
  };
}
