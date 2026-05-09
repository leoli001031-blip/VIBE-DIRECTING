import { buildDirectorWorkflowState, type DirectorWorkflowStatus } from "../../core/directorWorkflow";
import { buildMinimalRuntimeProjection, type MinimalRuntimeProjection } from "../../core/minimalRuntimeProjection";
import type { ProjectRuntimeState } from "../../core/projectState";
import {
  buildProjectTransactionRuntime,
  commitProjectPendingTransactionForRuntime,
  confirmProjectPendingTransactionForRuntime,
  type ProjectConfirmedProjectionReceipt,
} from "../../core/projectTransaction";
import type { AssetRecord, ShotRecord } from "../../core/types";
import { formatShotNumber } from "./MinimalStoryFlow";

export type AgentPlanPhase = "idle" | "review" | "confirmed";
type MinimalAgentWorkflow = ReturnType<typeof buildDirectorWorkflowState>;

function cleanLabel(value: string) {
  return value
    .replace(/^asset_/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function selectedScopeLabel(shot?: ShotRecord, asset?: AssetRecord, sectionLabel?: string, selectedShots: ShotRecord[] = []) {
  if (selectedShots.length > 1) {
    const labels = selectedShots.slice(0, 4).map((item) => formatShotNumber(item.id));
    const suffix = selectedShots.length > labels.length ? ` +${selectedShots.length - labels.length}` : "";
    return `已选择 ${labels.join(", ")}${suffix}`;
  }
  if (shot) return `正在看 ${formatShotNumber(shot.id)}`;
  if (asset) return `正在看 ${cleanLabel(asset.name)}`;
  if (sectionLabel) return `正在看 ${sectionLabel}`;
  return "正在看整个项目";
}

function confirmedTransactionRuntime(workflow: MinimalAgentWorkflow, runtimeState: ProjectRuntimeState) {
  return buildProjectTransactionRuntime({
    workflowState: {
      generatedAt: workflow.generatedAt,
      status: workflow.status,
      confirmationRequired: workflow.confirmationRequired,
      blockedReasons: workflow.blockedReasons,
      editPlan: workflow.editPlan,
      taskPacketState: workflow.taskPacketState,
    },
    runtimeState,
    userConfirmed: true,
    userEnabled: true,
  });
}

export function buildAgentPanelProjection(
  workflow: MinimalAgentWorkflow,
  runtimeState: ProjectRuntimeState,
  planPhase: AgentPlanPhase,
) {
  return buildMinimalRuntimeProjection({
    generatedAt: workflow.generatedAt,
    transactionRuntime: planPhase === "confirmed" ? confirmedTransactionRuntime(workflow, runtimeState) : workflow.transactionRuntime,
  });
}

export function agentReceiptStatusLabel(receipt: ProjectConfirmedProjectionReceipt) {
  if (receipt.queuedCount > 0) return "已加入计划";
  if (receipt.status === "blocked_missing_knowledge_trace") return "缺少资产约束，需补齐";
  if (receipt.status === "blocked_queue") return "需补齐";
  if (receipt.status === "blocked_not_confirmed") return "等待复核";
  if (receipt.parkedCount > 0 && receipt.queuedCount === 0) return "等待写入项目事实";
  return "等待写入项目事实";
}

export function agentReceiptCountSummary(receipt: ProjectConfirmedProjectionReceipt) {
  const updateCount = Math.max(receipt.blockedCount, receipt.runtimeProjection.staleArtifactCount);
  const parts = [
    receipt.queuedCount ? `${receipt.queuedCount} 已加入计划` : "",
    receipt.parkedCount ? `${receipt.parkedCount} 等待复核` : "",
    updateCount ? `${updateCount} 需补齐` : "",
  ].filter(Boolean);
  return parts.join(" · ") || agentReceiptStatusLabel(receipt);
}

export function confirmAgentPlanProjection(workflow: MinimalAgentWorkflow, runtimeState: ProjectRuntimeState) {
  const transactionRuntime = confirmedTransactionRuntime(workflow, runtimeState);
  const receipt = confirmProjectPendingTransactionForRuntime(transactionRuntime);
  const stagedReceipt = commitProjectPendingTransactionForRuntime({
    runtime: transactionRuntime,
    confirmationReceipt: receipt,
  });
  const hardLocksHeld = receipt.projectVibeWriteAllowed === false
    && receipt.projectVibeWriteExecuted === false
    && receipt.noFileMutation === true
    && receipt.providerSubmissionForbidden === true
    && receipt.workerSpawnForbidden === true
    && receipt.providerCalled === false
    && receipt.projectVibeWritten === false
    && stagedReceipt.projectVibeWritten === false
    && stagedReceipt.providerCalled === false
    && stagedReceipt.workerSpawned === false
    && stagedReceipt.hardLocks.noFileMutation === true
    && stagedReceipt.hardLocks.projectVibeWriteAllowed === false;
  const baseProjection = buildMinimalRuntimeProjection({
    generatedAt: receipt.generatedAt,
    transactionRuntime,
  });
  const counts = {
    queued: receipt.queuedCount,
    parked: receipt.parkedCount,
    blocked: receipt.blockedCount,
    stale: receipt.runtimeProjection.staleArtifactCount,
  };
  const shortLabel = hardLocksHeld && stagedReceipt.status === "staged" ? "已准备写入" : agentReceiptStatusLabel(receipt);
  const countSummary = agentReceiptCountSummary(receipt);

  return {
    receipt,
    stagedReceipt,
    projection: {
      ...baseProjection,
      generatedAt: receipt.generatedAt,
      shortLabel,
      counts,
      countSummary,
      staleSummary: counts.stale ? `${counts.stale} 需更新` : "画面保持同步",
      progressDots: buildMinimalRuntimeProjection({
        generatedAt: receipt.generatedAt,
        transactionRuntime: {
          ...transactionRuntime,
          userStatus: receipt.runtimeProjection.status,
          nextUiProjection: {
            ...transactionRuntime.nextUiProjection,
            status: receipt.runtimeProjection.status,
            shortLabel,
            queuedCount: counts.queued,
            parkedCount: counts.parked,
            blockedCount: counts.blocked,
            staleArtifactCount: counts.stale,
          },
        },
      }).progressDots,
    },
  };
}

export function agentProjectionBadges(projection: MinimalRuntimeProjection, planPhase: AgentPlanPhase) {
  if (planPhase === "confirmed") return [projection.countSummary, "先等复核"].filter(Boolean);
  return [projection.shortLabel, projection.staleSummary].filter(Boolean);
}

export function agentProjectionNextStep(projection: MinimalRuntimeProjection, planPhase: AgentPlanPhase, canConfirm: boolean) {
  if (planPhase === "confirmed") return `${projection.countSummary}，等待写入项目事实。`;
  if (canConfirm) return "确认后只会加入计划，后续结果先复核。";
  if (projection.counts.blocked > 0) return "缺少资产约束，需补齐。";
  return "确认后只会加入计划，后续结果先复核。";
}

export function naturalWorkflowScopeLabel(label: string) {
  return label
    .replace(/^Multi-shot\s+/i, "多个镜头 ")
    .replace(/^Shot\s+/i, "镜头 ")
    .replace(/^Asset\s+/i, "素材 ")
    .replace(/^Section\s+/i, "段落 ")
    .replace(/^Export$/i, "导出")
    .replace(/^Project$/i, "整个项目");
}

export function workflowStatusLabel(status: DirectorWorkflowStatus) {
  if (status === "dry_run_ready") return "可以继续";
  if (status === "pending_confirmation") return "等你确认";
  if (status === "blocked_missing_context") return "需要补充信息";
  return "暂时不能改";
}

export function workflowNextStepLabel(status: DirectorWorkflowStatus) {
  if (status === "dry_run_ready") return "修改方向已准备好，确认后才会继续。";
  if (status === "pending_confirmation") return "等你确认后再继续。";
  if (status === "blocked_missing_context") return "补充镜头、角色或参考图后再试。";
  return "换一种更具体的说法。";
}

export function workflowBadgeLabels(workflow: MinimalAgentWorkflow) {
  const labels = ["先看一下", naturalWorkflowScopeLabel(workflow.scopeLabel)];
  if (workflow.summary.blockedTaskPackets > 0) labels.push("需要补充参考");
  if (workflow.summary.readyTaskPackets > 0) labels.push(`${workflow.summary.readyTaskPackets} 个画面会受影响`);
  return Array.from(new Set(labels));
}

export function workflowCanConfirm(
  workflow?: MinimalAgentWorkflow,
): workflow is MinimalAgentWorkflow {
  return Boolean(workflow && (workflow.status === "dry_run_ready" || workflow.status === "pending_confirmation"));
}

export function workflowPanelStatusLabel(workflow: MinimalAgentWorkflow, planPhase: AgentPlanPhase) {
  if (workflow.status === "blocked") return "阻断";
  if (workflow.status === "blocked_missing_context") return "需要补充信息";
  if (planPhase === "confirmed") return "已确认";
  return "等你确认";
}

export function workflowPanelNextStepLabel(workflow: MinimalAgentWorkflow, planPhase: AgentPlanPhase) {
  if (workflow.status === "blocked") return "这次修改还不能进入计划。";
  if (workflow.status === "blocked_missing_context") return workflowNextStepLabel(workflow.status);
  if (planPhase === "confirmed") return "已确认，后续输出会先进入人工复核。";
  return "确认后再继续。";
}

export function workflowPlanFacts(workflow: MinimalAgentWorkflow) {
  return [
    {
      label: "影响画面",
      value: `${workflow.summary.readyTaskPackets}`,
    },
    {
      label: "状态",
      value: workflowStatusLabel(workflow.status),
    },
  ];
}
