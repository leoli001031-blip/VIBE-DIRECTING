import { buildDirectorWorkflowState, type DirectorWorkflowStatus } from "../../core/directorWorkflow";
import { buildMinimalRuntimeProjection, type MinimalRuntimeProjection } from "../../core/minimalRuntimeProjection";
import type { ProjectRuntimeState } from "../../core/projectState";
import {
  buildProjectStoreApplyPlanForStagedFacts,
  buildProjectTransactionRuntime,
  stageProjectFactsForCommit,
  confirmProjectPendingTransactionForRuntime,
  type ProjectConfirmedProjectionReceipt,
  type ProjectFactsStagedApplyPlan,
} from "../../core/projectTransaction";
import type { AssetRecord, ShotRecord } from "../../core/types";
import { formatShotNumber } from "./MinimalStoryFlow";

export type AgentPlanPhase = "idle" | "review" | "confirmed";
type MinimalAgentWorkflow = ReturnType<typeof buildDirectorWorkflowState>;

export type AgentVideoSubmitMode = "plan_only" | "reference_allowed" | "video_allowed";

export type AgentVideoSubmitContract = {
  scope: "session";
  mode: AgentVideoSubmitMode;
  videoSubmitAllowed: boolean;
  referenceGenerationAllowed: boolean;
  reason: string;
};

export const defaultAgentVideoSubmitContract: AgentVideoSubmitContract = {
  scope: "session",
  mode: "video_allowed",
  videoSubmitAllowed: true,
  referenceGenerationAllowed: true,
  reason: "创作者允许故事通过后提交视频",
};

const planOnlyIntentPhrases = [
  "先不要提交视频",
  "不要提交视频",
  "先别提交视频",
  "别提交视频",
  "先别提交",
  "不要生视频",
  "先不要生视频",
  "先不生视频",
  "不要生成视频",
  "先不要生成视频",
  "先别生成视频",
  "只规划",
  "只做规划",
  "只要规划",
  "只要计划",
  "先做计划",
  "先规划",
];

const referenceAllowedIntentPhrases = [
  "先生成参考",
  "只生成参考",
  "只做参考",
  "可生成参考",
  "可以生成参考",
  "先补参考",
];

const videoAllowedIntentPhrases = [
  "可以提交视频",
  "可提交视频",
  "允许提交视频",
  "开始提交视频",
  "提交视频",
];

function normalizedCreatorIntent(value: string) {
  return value
    .toLowerCase()
    .replace(/[，。！？、,.!?;；:："'“”‘’`~\s]/g, "");
}

function hasCreatorIntentPhrase(normalizedIntent: string, phrases: string[]) {
  return phrases.some((phrase) => normalizedIntent.includes(normalizedCreatorIntent(phrase)));
}

export function detectAgentVideoSubmitContract(
  userIntent: string,
  current: AgentVideoSubmitContract = defaultAgentVideoSubmitContract,
): AgentVideoSubmitContract {
  const normalizedIntent = normalizedCreatorIntent(userIntent);
  if (!normalizedIntent) return current;
  if (hasCreatorIntentPhrase(normalizedIntent, planOnlyIntentPhrases)) {
    return {
      scope: "session",
      mode: "plan_only",
      videoSubmitAllowed: false,
      referenceGenerationAllowed: false,
      reason: "创作者要求先只做规划",
    };
  }
  if (hasCreatorIntentPhrase(normalizedIntent, referenceAllowedIntentPhrases)) {
    return {
      scope: "session",
      mode: "reference_allowed",
      videoSubmitAllowed: false,
      referenceGenerationAllowed: true,
      reason: "创作者允许先做参考",
    };
  }
  if (hasCreatorIntentPhrase(normalizedIntent, videoAllowedIntentPhrases)) return defaultAgentVideoSubmitContract;
  return current;
}

export function agentVideoSubmitContractForUi(
  contract: AgentVideoSubmitContract,
  availability: { referenceReady: boolean; videoReady: boolean },
): AgentVideoSubmitContract {
  if (!contract.videoSubmitAllowed) return contract;
  if (availability.videoReady) return defaultAgentVideoSubmitContract;
  if (availability.referenceReady) {
    return {
      scope: "session",
      mode: "reference_allowed",
      videoSubmitAllowed: false,
      referenceGenerationAllowed: true,
      reason: "当前先补齐参考",
    };
  }
  return {
    scope: "session",
    mode: "plan_only",
    videoSubmitAllowed: false,
    referenceGenerationAllowed: false,
    reason: "当前先整理计划",
  };
}

export function agentVideoSubmitContractLabel(contract: AgentVideoSubmitContract) {
  if (contract.mode === "plan_only") return "只规划";
  if (contract.mode === "reference_allowed") return "可做参考";
  return "可提交视频";
}

export function agentVideoSubmitContractAllowsVideo(contract: AgentVideoSubmitContract) {
  return contract.videoSubmitAllowed;
}

export function agentVideoSubmitContractDetail(contract: AgentVideoSubmitContract) {
  if (contract.mode === "plan_only") return "当前只整理计划，不会提交视频。";
  if (contract.mode === "reference_allowed") return "可以先做参考，视频等你确认。";
  return "故事和参考通过后，可以提交视频。";
}

export type PrototypeAgentDemoStatus =
  | "idle"
  | "preparing"
  | "running"
  | "ready"
  | "needs_review"
  | "review"
  | "preview_ready"
  | "complete"
  | "error"
  | string;

export type PrototypeAgentDemoResult = {
  projectVibeAdded?: boolean;
  projectRestored?: boolean;
  projectSaved?: boolean;
  storageLabel?: string;
  waitingReview?: boolean;
  previewReady?: boolean;
  label?: string;
  status?: PrototypeAgentDemoStatus;
};

export type PrototypeAgentDemoRun = {
  status?: PrototypeAgentDemoStatus;
  result?: PrototypeAgentDemoResult;
};

export type PreviewPrototypeAgentDemoInput = {
  userIntent: string;
  scopeLabel: string;
  selectedShotId?: string;
  selectedShotIds?: string[];
  selectedAssetId?: string;
  sectionId?: string;
  videoPermissionContract?: AgentVideoSubmitContract;
  workflowStatus?: DirectorWorkflowStatus;
  generatedAt?: string;
  applyPlan?: ProjectFactsStagedApplyPlan;
};

export type PrototypeAgentDemoProjection = {
  statusLabel: string;
  badges: string[];
};

const PROJECT_PLAN_ADDED_LABEL = "已加入项目计划";
const PROJECT_RECORDED_LABEL = "已记录到项目";
const PROJECT_SAVED_LABEL = "已保存到项目";
const PREVIEW_READY_REVIEW_LABEL = "预览已生成、等待复核";
const HIGH_STALE_IMPACT_THRESHOLD = 4;

function cleanLabel(value: string) {
  return value
    .replace(/\bCURRENT_PROJECT\b/g, "当前项目")
    .replace(/^asset_/i, "")
    .replace(/_/g, " ")
    .replace(/\bshot\s+[a-f0-9]+\s+(\d+)\b/gi, "镜头 $1")
    .replace(/\bshot\s+0*(\d+)\b/gi, "镜头 $1")
    .replace(/\s+/g, " ")
    .trim();
}

export function productScopeLabel(value: string) {
  return cleanLabel(value).replace(/当前项目\s*·\s*当前项目/g, "当前项目");
}

function shotScopeLabel(id: string) {
  const formatted = formatShotNumber(id);
  return formatted === "当前项目" ? formatted : `镜头 ${formatted}`;
}

export function buildPrototypeAgentDemoProjection(run?: PrototypeAgentDemoRun): PrototypeAgentDemoProjection | undefined {
  if (!run) return undefined;
  const status = run.result?.status || run.status || "idle";
  const normalizedStatus = status.toLowerCase();
  const projectVibeAdded = run.result?.projectVibeAdded || ["ready", "needs_review", "review", "preview_ready", "complete"].includes(normalizedStatus);
  const projectSaved = run.result?.projectSaved === true;
  const waitingReview = run.result?.waitingReview || ["running", "needs_review", "review"].includes(normalizedStatus);
  const previewReady = run.result?.previewReady || ["preview_ready", "complete"].includes(normalizedStatus);
  const badges = [
    projectVibeAdded ? PROJECT_PLAN_ADDED_LABEL : "",
    projectSaved ? run.result?.storageLabel || PROJECT_SAVED_LABEL : "",
    waitingReview ? "等待复核" : "",
    previewReady ? "预览已生成" : "",
  ].filter(Boolean);

  if (run.result?.label) return { statusLabel: run.result.label, badges };
  if (previewReady) return { statusLabel: PREVIEW_READY_REVIEW_LABEL, badges };
  if (waitingReview) return { statusLabel: "等待复核", badges };
  if (projectVibeAdded) return { statusLabel: PROJECT_PLAN_ADDED_LABEL, badges };
  if (normalizedStatus === "error") return { statusLabel: "需要复核", badges: badges.length ? badges : ["等待复核"] };
  if (normalizedStatus === "preparing" || normalizedStatus === "running") return { statusLabel: "正在整理预览", badges: badges.length ? badges : ["等待复核"] };
  return undefined;
}

export function selectedScopeLabel(shot?: ShotRecord, asset?: AssetRecord, sectionLabel?: string, selectedShots: ShotRecord[] = []) {
  if (selectedShots.length > 1) {
    const labels = selectedShots.slice(0, 4).map((item) => shotScopeLabel(item.id));
    const suffix = selectedShots.length > labels.length ? ` +${selectedShots.length - labels.length}` : "";
    return `已选择 ${labels.join(", ")}${suffix}`;
  }
  if (shot) return `正在看 ${shotScopeLabel(shot.id)}`;
  if (asset) return `正在看 ${cleanLabel(asset.name)}`;
  if (sectionLabel) return `正在看 ${productScopeLabel(sectionLabel)}`;
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
  if (receipt.queuedCount > 0) return "已加入计划".replace("计划", "项目计划");
  if (receipt.status === "blocked_missing_knowledge_trace") return "缺少资产约束，需补齐";
  if (receipt.status === "blocked_queue") return "需补齐";
  if (receipt.status === "blocked_not_confirmed") return "等待复核";
  if (receipt.parkedCount > 0 && receipt.queuedCount === 0) return PROJECT_RECORDED_LABEL;
  return PROJECT_RECORDED_LABEL;
}

export function agentReceiptCountSummary(receipt: ProjectConfirmedProjectionReceipt) {
  const updateCount = Math.max(receipt.blockedCount, receipt.runtimeProjection.staleArtifactCount);
  const updateLabel = receipt.blockedCount
    ? `${receipt.blockedCount} 需要处理`
    : updateCount > HIGH_STALE_IMPACT_THRESHOLD
      ? "当前选择需复核"
      : updateCount
        ? `${updateCount} 项需复核`
        : "";
  const parts = [
    receipt.queuedCount ? `${receipt.queuedCount} ${PROJECT_PLAN_ADDED_LABEL}` : "",
    receipt.parkedCount ? `${receipt.parkedCount} 等待复核` : "",
    updateLabel,
  ].filter(Boolean);
  return parts.join(" · ") || agentReceiptStatusLabel(receipt);
}

function agentStaleImpactLabelFromCount(staleCount: number) {
  if (!staleCount) return "画面保持同步";
  if (staleCount > HIGH_STALE_IMPACT_THRESHOLD) return "当前选择需复核";
  return `${staleCount} 项需复核`;
}

function agentStaleImpactLabel(projection: MinimalRuntimeProjection) {
  return agentStaleImpactLabelFromCount(projection.counts.stale);
}

function agentDisplayCountSummary(projection: MinimalRuntimeProjection) {
  const parts = [
    projection.counts.queued ? `${projection.counts.queued} ${PROJECT_PLAN_ADDED_LABEL}` : "",
    projection.counts.parked ? `${projection.counts.parked} 等待复核` : "",
    projection.counts.blocked ? `${projection.counts.blocked} 需要处理` : "",
    !projection.counts.blocked && projection.counts.stale ? agentStaleImpactLabelFromCount(projection.counts.stale) : "",
  ].filter(Boolean);
  return parts.join(" · ") || projection.countSummary;
}

export function confirmAgentPlanProjection(workflow: MinimalAgentWorkflow, runtimeState: ProjectRuntimeState) {
  const transactionRuntime = confirmedTransactionRuntime(workflow, runtimeState);
  const receipt = confirmProjectPendingTransactionForRuntime(transactionRuntime);
  const stagedReceipt = stageProjectFactsForCommit({
    runtime: transactionRuntime,
    confirmationReceipt: receipt,
  });
  const applyPlan = buildProjectStoreApplyPlanForStagedFacts({ receipt: stagedReceipt, generatedAt: receipt.generatedAt });
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
  const shortLabel = hardLocksHeld && stagedReceipt.status === "staged" ? PROJECT_RECORDED_LABEL : agentReceiptStatusLabel(receipt);
  const countSummary = agentReceiptCountSummary(receipt);

  return {
    receipt,
    stagedReceipt,
    applyPlan,
    projection: {
      ...baseProjection,
      generatedAt: receipt.generatedAt,
      shortLabel,
      counts,
      countSummary,
      staleSummary: agentStaleImpactLabelFromCount(counts.stale),
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
  if (planPhase === "confirmed") return [agentDisplayCountSummary(projection), "先等复核"].filter(Boolean);
  return [projection.shortLabel, agentStaleImpactLabel(projection)].filter(Boolean);
}

export function agentProjectionNextStep(projection: MinimalRuntimeProjection, planPhase: AgentPlanPhase, canConfirm: boolean) {
  if (planPhase === "confirmed") return `${agentDisplayCountSummary(projection)}，等待复核。`;
  if (canConfirm) return "确认后只会加入计划，后续结果先复核。".replace("加入计划", "加入项目计划");
  if (projection.counts.blocked > 0) return "缺少资产约束，需补齐。";
  return "确认后只会加入计划，后续结果先复核。".replace("加入计划", "加入项目计划");
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
  if (planPhase === "confirmed") return "已确认，后续输出会先放到复核区。";
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
