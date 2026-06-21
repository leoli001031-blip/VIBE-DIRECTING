import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, ExternalLink, LockKeyhole, MessageCircle, Pencil, Plus, RotateCcw, Search, Send, Sparkles, X } from "lucide-react";
import {
  agentWebSearchSourceLabel,
  buildAgentWebResearchSuggestion,
  defaultAgentWebSearchSettings,
  runAgentWebSearch as requestAgentWebSearch,
  type AgentWebSearchResult,
  type AgentWebSearchSettings,
} from "../../core/agentWebSearchClient";
import {
  buildDirectorAgentActionEnvelope,
  buildDirectorAgentStateSnapshot,
  directorAgentDisplayTargetLabel,
  directorAgentExecutionContractFromCreatorBoundary,
  directorAgentReadinessActions,
  type DirectorAgentActionEnvelope,
  type DirectorAgentSuggestedAction,
} from "../../core/directorAgentAction";
import {
  directorIntentCanStartNewVideoPlanningWithoutProject,
  directorIntentStartsFreshVideoDraft,
} from "../../core/directorFreshDraftIntent";
import {
  isDirectorAgentExplainOnlyIntent,
  isDirectorAgentPermissionControlOnlyIntent,
} from "../../core/directorAgentPermissionIntent";
import type { DirectorQaUserFeedback } from "../../core/directorQaUserFeedback";
import {
  type DirectorAgentToolAvailability,
  type DirectorAgentToolHandoff,
} from "../../core/directorAgentToolHandoff";
import {
  buildConfirmedVibeAgentToolHandoff,
  buildVibeAgentToolHandoff,
  buildVibeAgentProductToolAvailability,
  buildVibeAgentConfirmedActionReportEntry,
  buildVibeAgentConfirmedActionStartedEntry,
  buildVibeAgentConfirmedActionToolResultEntry,
  buildVibeAgentTimelineStatusView,
  vibeAgentToolOnlyNeedsConfirmation as agentToolOnlyNeedsConfirmation,
  vibeAgentToolPlannedResultLabel as agentToolPlannedResultLabel,
  vibeAgentToolResultLabel as agentToolResultLabel,
  type VibeAgentConfirmedToolRunOutcome,
} from "../../agent-core";
import {
  buildProjectInboxProjection,
  buildProjectObservation,
  isContinueIntent,
  routeProjectAgentIntent,
  type ProjectInboxProjection,
  type ProjectObservationProjection,
} from "../../core/projectAgentWorkspace";
import {
  buildDirectorFeedbackRecompile,
  type DirectorFeedbackRecompileResult,
} from "../../core/directorFeedbackRecompile";
import { buildDirectorWorkflowState } from "../../core/directorWorkflow";
import type { KnowledgePack, KnowledgePackManifest } from "../../core/knowledgeTypes";
import type { MinimalRuntimeProjection } from "../../core/minimalRuntimeProjection";
import type { ProjectRuntimeState } from "../../core/projectState";
import type { ProjectFactsStagedApplyPlan } from "../../core/projectTransaction";
import type { StoryboardReferenceProjectPlannerInput } from "../../core/storyboardReferenceProjectPlanner";
import type { AssetRecord, ShotRecord } from "../../core/types";
import type {
  VibeAgentExecutionResultSummary,
  VibeAgentKernelTurn,
  VibeAgentPermissionMode,
  VibeAgentTimelineEntry,
} from "../../agent-core/types";
import type { ProjectAgentActionLogItem, ProjectAgentStagedPlanDraft } from "../../project";
import { videoBlockerRecoveryIntent } from "../../core/videoBlockerRecovery";
import {
  agentProjectionBadges,
  agentProjectionNextStep,
  agentVideoSubmitContractAllowsReference as agentVideoPermissionAllowsReference,
  agentVideoSubmitContractAllowsVideo as agentVideoPermissionAllowsVideo,
  agentVideoSubmitContractDetail as agentVideoPermissionDetail,
  agentVideoSubmitContractForMode as agentVideoPermissionForMode,
  agentVideoSubmitContractForUi as agentVideoPermissionForUi,
  agentVideoSubmitContractLabel as agentVideoPermissionLabel,
  buildAgentPanelProjection,
  buildPrototypeAgentDemoProjection,
  confirmAgentPlanProjection,
  defaultAgentVideoSubmitContract as defaultAgentVideoPermissionContract,
  detectAgentVideoSubmitContract as detectAgentVideoPermissionContract,
  isCommittedNewVideoDraftAgentRun,
  type AgentControlledToolInvocationTarget,
  productScopeLabel,
  selectedScopeLabel,
  type AgentVideoSubmitContract as AgentVideoPermissionContract,
  type AgentVideoSubmitMode as AgentVideoPermissionMode,
  type AgentPlanPhase,
  type PrototypeAgentDemoRun,
  type PreviewPrototypeAgentDemoInput,
  type PreviewPrototypeAgentDemoResult,
  type StagePrototypeAgentPlanInput,
  type StagePrototypeAgentPlanResult,
  workflowBadgeLabels,
  workflowCanConfirm,
  workflowPanelNextStepLabel,
  workflowPlanFacts,
} from "./agentPanelProjection";
import { buildMinimalAgentProductAdapter } from "./agentProductCapabilities";
import {
  directorFeedbackCanConfirm,
  directorFeedbackGenerationLabel,
  directorFeedbackNeedsConcreteDirection,
} from "./directorFeedbackUi";
import {
  buildDirectorSkillCardFromShot,
  createDirectorSkillStackIndex,
  DIRECTOR_SKILL_STACK_INDEX_PATH,
  directorSkillCardMarkdown,
  directorSkillFileName,
  parseDirectorSkillStackIndex,
  serializeDirectorSkillStackIndex,
  upsertDirectorSkillStackIndex,
  type DirectorSkillStackItem,
} from "../../core/directorSkillLibrary";
import {
  directorSkillSummaryForShot,
} from "./directorSkillUi";
import { agentProjectRequirementCopy } from "./agentProjectRequirementCopy";
import type { DirectorView } from "./directorTypes";
import type { ProjectStatusViewModel } from "../app/projectStatusViewModel";
import type { CreatorAgentCommand } from "./creatorDeskTypes";
import { formatShotNumber } from "./MinimalStoryFlow";
import { usesEndpointEndFrame } from "./videoControlModeUi";

type DirectorWorkflowInput = Parameters<typeof buildDirectorWorkflowState>[0];
type MinimalAgentMessage = {
  id: string;
  entryType?: VibeAgentTimelineEntry["type"];
  role: "user" | "assistant" | "tool" | "confirmation";
  title: string;
  body: string;
  status?: VibeAgentTimelineEntry["status"];
  lifecycle?: VibeAgentTimelineEntry["lifecycle"];
  toolName?: VibeAgentTimelineEntry["toolName"];
  actionKind?: VibeAgentTimelineEntry["actionKind"];
  actionId?: VibeAgentTimelineEntry["actionId"];
  facts?: Array<{ label: string; value: string }>;
  confirmationFacts?: Array<{ label: string; value: string }>;
  confirmationBoundary?: string;
  resultView?: DirectorView;
  executionResult?: VibeAgentExecutionResultSummary;
  next?: string;
  assetActions?: MinimalAgentAssetAction[];
  assetActionOverflow?: {
    label: string;
    detail: string;
  };
  assetInboxSummary?: MinimalAgentAssetInboxSummary;
  skillRecommendations?: MinimalAgentSkillRecommendation[];
};

type MinimalAgentAssetAction = {
  id: string;
  label: string;
  detail: string;
  intent: string;
  selectedAssetId?: string;
  selectedShotIds?: string[];
};

type MinimalAgentSkillRecommendation = {
  label: string;
  reason: string;
  affectedShots: string[];
  impact: string[];
};

type MinimalAgentAssetInboxSummary = {
  summary: string;
  nextAction: string;
  totalCount: number;
  needsReviewCount: number;
  kindLabels: string[];
};

const MAX_VISIBLE_AGENT_THREAD_MESSAGES = 12;
const NEW_VIDEO_DRAFT_CONFIRM_LABEL = "确认这版故事";

type DirectorSkillCardDraft = NonNullable<ReturnType<typeof buildDirectorSkillCardFromShot>>;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value) ? value.map(stringValue).filter(Boolean) : [];
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function minimalAgentDisplayableReferencePath(path: string | undefined) {
  const value = path?.trim();
  if (!value || /\.json(?:[?#].*)?$/i.test(value)) return undefined;
  if (/^(?:https?:|data:|blob:|file:)/i.test(value)) return value;
  if (/\.(?:png|jpe?g|webp|gif|avif|bmp|tiff?|svg|mp4|mov|m4v|webm)(?:[?#].*)?$/i.test(value)) return value;
  return undefined;
}

function minimalAgentAssetHasDisplayableReference(asset: AssetRecord) {
  return Boolean(minimalAgentDisplayableReferencePath(asset.path))
    && (asset.status === "exists" || asset.status === "generated" || asset.lockedStatus === "needs_review" || asset.lockedStatus === "locked");
}

function minimalAgentInboxKindLabel(kind: string) {
  if (kind === "script") return "脚本";
  if (kind === "character") return "角色";
  if (kind === "scene") return "场景";
  if (kind === "prop") return "道具";
  if (kind === "storyboard") return "故事板";
  if (kind === "voice") return "声音";
  if (kind === "video") return "视频";
  if (kind === "prompt") return "提示词";
  if (kind === "receipt") return "回执";
  if (kind === "export") return "交付包";
  if (kind === "reference") return "参考";
  return "其他";
}

function minimalAgentAssetInboxSummaryFromTimelineEntry(entry: VibeAgentTimelineEntry): MinimalAgentAssetInboxSummary | undefined {
  if (entry.toolName !== "classify_assets" && entry.toolName !== "scan_assets") return undefined;
  const assetInbox = isPlainRecord(entry.details?.assetInbox) ? entry.details.assetInbox : undefined;
  if (!assetInbox) return undefined;
  const items = Array.isArray(assetInbox.items) ? assetInbox.items : [];
  const kindLabels = [...new Set(items
    .map((item) => isPlainRecord(item) ? minimalAgentInboxKindLabel(stringValue(item.kind)) : "")
    .filter(Boolean))].slice(0, 6);
  const totalCount = numberValue(assetInbox.totalCount) || items.length;
  const needsReviewCount = numberValue(assetInbox.needsReviewCount);
  if (totalCount <= 0 && needsReviewCount <= 0 && !kindLabels.length) return undefined;
  const summary = stringValue(assetInbox.summary) || (items.length ? `识别到 ${items.length} 个项目素材。` : "");
  if (!summary && !kindLabels.length) return undefined;
  return {
    summary,
    nextAction: stringValue(assetInbox.nextAction) || "确认素材用途后继续。",
    totalCount,
    needsReviewCount,
    kindLabels,
  };
}

function minimalAgentAssetInboxSummaryFromProjection(inbox: ProjectInboxProjection): MinimalAgentAssetInboxSummary | undefined {
  if (inbox.totalCount <= 0 && inbox.needsReviewCount <= 0 && !inbox.items.length) return undefined;
  const kindLabels = [...new Set(inbox.items.map((item) => minimalAgentInboxKindLabel(item.kind)))].slice(0, 6);
  return {
    summary: inbox.summary,
    nextAction: inbox.nextAction,
    totalCount: inbox.totalCount,
    needsReviewCount: inbox.needsReviewCount,
    kindLabels,
  };
}

function projectInboxAgentMessage(inbox: ProjectInboxProjection): MinimalAgentMessage | undefined {
  const assetInboxSummary = minimalAgentAssetInboxSummaryFromProjection(inbox);
  if (!assetInboxSummary) return undefined;
  const examples = inbox.items.slice(0, 3).map((item) => `${item.label}：${item.suggestedBinding}`);
  const assetActions = minimalAgentAssetActionsFromProjection(inbox);
  return {
    id: `project_inbox_status_${inbox.totalCount}_${inbox.needsReviewCount}`,
    entryType: "tool_result",
    role: "assistant",
    title: "素材已识别",
    body: assetInboxSummary.summary,
    lifecycle: inbox.needsReviewCount ? "needs_user_input" : "succeeded",
    status: inbox.needsReviewCount ? "waiting" : "done",
    toolName: "classify_assets",
    facts: [
      { label: "分类", value: assetInboxSummary.kindLabels.join("、") || "待判断" },
      { label: "待确认", value: inbox.needsReviewCount ? `${inbox.needsReviewCount} 个` : "没有" },
      examples.length ? { label: "示例", value: examples.join("；") } : undefined,
    ].filter((item): item is { label: string; value: string } => Boolean(item)),
    next: assetInboxSummary.nextAction,
    assetInboxSummary,
    assetActions,
    assetActionOverflow: minimalAgentAssetActionOverflowFromProjection(inbox, assetActions.length),
  };
}

function minimalAgentAssetActionsFromProjection(inbox: ProjectInboxProjection): MinimalAgentAssetAction[] {
  const reviewItems = inbox.items.filter((item) => item.needsReview);
  const visibleItems = (reviewItems.length ? reviewItems : inbox.items).slice(0, 3);
  return visibleItems.map((item, index): MinimalAgentAssetAction | undefined => {
    if (!item.assetId && !item.shotIds?.length) return undefined;
    const reason = item.reason.trim();
    return {
      id: item.id || `project_inbox_asset_${index + 1}`,
      label: `${item.label} · ${item.suggestedAction}`,
      detail: reason ? `${item.suggestedBinding}。判断理由：${reason}` : item.suggestedBinding,
      intent: `确认这个素材用途：${item.label}。建议动作：${item.suggestedAction}。${item.suggestedBinding}${reason ? `。判断理由：${reason}` : ""}`,
      selectedAssetId: item.assetId,
      selectedShotIds: item.shotIds?.length ? item.shotIds : undefined,
    };
  }).filter((item): item is MinimalAgentAssetAction => Boolean(item));
}

function minimalAgentAssetActionOverflowFromProjection(
  inbox: ProjectInboxProjection,
  visibleActionCount: number,
): MinimalAgentMessage["assetActionOverflow"] {
  const remainingCount = Math.max(0, inbox.needsReviewCount - visibleActionCount);
  if (!remainingCount) return undefined;
  return {
    label: `还有 ${remainingCount} 个素材待确认`,
    detail: "去参考页可以继续逐个看；不确认前不会改绑定、生成参考或提交视频。",
  };
}

function minimalAgentAssetActionsFromTimelineEntry(entry: VibeAgentTimelineEntry): MinimalAgentAssetAction[] {
  if (entry.toolName !== "classify_assets" && entry.toolName !== "scan_assets") return [];
  const assetInbox = isPlainRecord(entry.details?.assetInbox) ? entry.details.assetInbox : undefined;
  const items = Array.isArray(assetInbox?.items) ? assetInbox.items : [];
  return items
    .map((item, index): MinimalAgentAssetAction | undefined => {
      if (!isPlainRecord(item) || item.needsReview !== true) return undefined;
      const label = stringValue(item.label) || `素材 ${index + 1}`;
      const suggestedBinding = stringValue(item.suggestedBinding) || "建议先确认用途";
      const suggestedAction = stringValue(item.suggestedAction) || "确认用途";
      const reason = stringValue(item.reason);
      const detail = stringValue(item.detail) || suggestedBinding;
      const selectedAssetId = stringValue(item.assetId);
      const selectedShotIds = stringArrayValue(item.shotIds);
      if (!selectedAssetId && !selectedShotIds.length) return undefined;
      return {
        id: stringValue(item.id) || `asset_action_${index + 1}`,
        label: `${label} · ${suggestedAction}`,
        detail: reason ? `${suggestedBinding}。判断理由：${reason}` : suggestedBinding,
        intent: `确认这个素材用途：${label}。建议动作：${suggestedAction}。${suggestedBinding}${reason ? `。判断理由：${reason}` : ""}`,
        selectedAssetId: selectedAssetId || undefined,
        selectedShotIds: selectedShotIds.length ? selectedShotIds : undefined,
      };
    })
    .filter((item): item is MinimalAgentAssetAction => Boolean(item))
    .slice(0, 3);
}

function minimalAgentAssetActionOverflowFromTimelineEntry(
  entry: VibeAgentTimelineEntry,
  visibleActionCount: number,
): MinimalAgentMessage["assetActionOverflow"] {
  if (entry.toolName !== "classify_assets" && entry.toolName !== "scan_assets") return undefined;
  const assetInbox = isPlainRecord(entry.details?.assetInbox) ? entry.details.assetInbox : undefined;
  const needsReviewCount = numberValue(assetInbox?.needsReviewCount);
  const remainingCount = Math.max(0, needsReviewCount - visibleActionCount);
  if (!remainingCount) return undefined;
  return {
    label: `还有 ${remainingCount} 个素材待确认`,
    detail: "去参考页可以继续逐个看，不会生成参考或提交视频。",
  };
}

function minimalAgentSkillRecommendationsFromTimelineEntry(entry: VibeAgentTimelineEntry): MinimalAgentSkillRecommendation[] {
  const rawRecommendations = Array.isArray(entry.details?.skillRecommendations)
    ? entry.details.skillRecommendations
    : [];
  return rawRecommendations
    .map((item): MinimalAgentSkillRecommendation | undefined => {
      if (!isPlainRecord(item)) return undefined;
      const label = stringValue(item.label) || stringValue(item.strategy);
      const reason = stringValue(item.reason);
      const affectedShots = stringArrayValue(item.affectedShots);
      const impact = stringArrayValue(item.impact);
      if (!label || !reason) return undefined;
      return {
        label,
        reason,
        affectedShots,
        impact,
      };
    })
    .filter((item): item is MinimalAgentSkillRecommendation => Boolean(item))
    .slice(0, 3);
}

function cleanMinimalAgentMessageCopy(value: string) {
  return value
    .replace(/不会提交\s*(?:Seedance|即梦)(?:\s*视频任务)?/g, "不提交视频")
    .replace(/会提交外部视频任务/g, "会提交 Seedance 视频任务")
    .replace(/不会提交外部视频任务/g, "不提交视频")
    .replace(/可能产生生成成本/g, "会调用生成或联网服务")
    .replace(/无生成成本/g, "不调用生成服务")
    .replace(/会调用图片生成/g, "会调用参考生成")
    .replace(/参考任务已准备，等待生成结果回到参考页。?/g, "参考生成中，等待结果回到参考页。")
    .replace(/参考任务已准备，等待生成结果。?/g, "参考生成中，等待结果回到参考页。")
    .replace(/^参考任务已准备$/g, "参考生成中")
    .replace(/正在生成参考：Image2 正在为整个项目准备角色、场景、关键道具和故事板。完成后去参考页复核；不用重复点击。?/g, "参考任务已交给图片服务，等图片回到参考页后再复核。")
    .replace(/不生成，只整理请求/g, "只准备视频请求")
    .replace(/initialize logs failed:[\s\S]*?operation not permitted/g, "即梦 CLI 日志目录没有写入权限，视频未提交。")
    .replace(/\d+\s*项参考已通过，可以准备视频。?/g, "参考已通过，可以准备视频。")
    .replace(/\d+\s*项参考已通过/g, "参考已通过")
    .replace(/视频提交未完成，请检查生成服务、即梦登录和项目参考。?/g, "视频提交未完成，请检查即梦登录、CLI 权限或稍后重试。")
    .replace(/可以调整后重试，或继续描述要改哪里。?/g, "检查即梦登录、CLI 权限或稍后重试；也可以跳过这一段。");
}

function legacyReferenceGenerationPreparedMessage(entry: VibeAgentTimelineEntry) {
  if (entry.toolName !== "generate_references") return false;
  const combined = `${entry.title} ${entry.body} ${typeof entry.details?.next === "string" ? entry.details.next : ""}`;
  return /参考任务已准备|等待生成结果|正在生成参考/.test(combined) && !/参考已生成|需要复核|可用/.test(combined);
}

function agentFactDisplayValue(fact: { label: string; value: string }) {
  const cleaned = cleanMinimalAgentMessageCopy(fact.value);
  if (fact.label !== "视频" && fact.label !== "状态") return cleaned;
  const normalized = cleaned.trim().toLowerCase();
  if (!normalized || normalized === "idle" || normalized === "not_generated") return "未提交";
  if (normalized === "ready") return "可准备";
  if (normalized === "submitted" || normalized === "queued") return "已排队";
  if (normalized === "running" || normalized === "generating" || normalized === "in_progress") return "生成中";
  if (normalized === "recoverable") return "可查询结果";
  if (normalized === "needs_review" || normalized === "review") return "待复核";
  if (normalized === "completed" || normalized === "done") return "已完成";
  if (normalized === "failed") return "失败";
  return cleaned;
}

function stableIntentBoundaryFacts(entry: VibeAgentTimelineEntry) {
  if (!entry.facts?.length) return entry.facts;
  const shouldKeepPreConfirmationBoundary = entry.type === "user_message"
    || entry.type === "assistant_message";
  if (!shouldKeepPreConfirmationBoundary) return entry.facts;
  return entry.facts.map((fact) => (
    fact.label === "边界" && /权限和用户确认都已满足/.test(fact.value)
      ? { ...fact, value: "当前只允许整理计划；需要你确认后，才能写入项目。" }
      : fact
  ));
}

function minimalAgentVisibleFacts(message: MinimalAgentMessage) {
  if (!message.facts?.length) return [];
  const executionSummary = cleanMinimalAgentMessageCopy(message.executionResult?.summary || message.body).trim();
  const executionNext = cleanMinimalAgentMessageCopy(message.executionResult?.next || message.next || "").trim();
  const hasVisibleNext = Boolean(message.executionResult?.next || message.next);
  const hiddenConfirmationLabels = minimalAgentMessageRequestsActionConfirmation(message)
    ? new Set(["成本", "外部提交", "写入", "保存"])
    : new Set<string>();
  return message.facts.filter((fact) => {
    const label = fact.label.trim();
    const value = agentFactDisplayValue(fact).trim();
    if (!value) return false;
    if (hiddenConfirmationLabels.has(label)) return false;
    if (/下一步/.test(label) && (hasVisibleNext || value === executionNext)) return false;
    if (/状态/.test(label) && value === executionSummary) return false;
    return true;
  });
}

function minimalAgentMessageConfirmationFacts(message: MinimalAgentMessage) {
  if (message.confirmationFacts?.length) return message.confirmationFacts;
  if (!minimalAgentMessageRequestsActionConfirmation(message)) return [];
  const confirmationLabels = new Set(["写入", "下一步", "范围", "边界", "结果"]);
  return (message.facts || []).filter((fact) => confirmationLabels.has(fact.label.trim()));
}

function timelineResultView(entry: VibeAgentTimelineEntry): DirectorView | undefined {
  const resultView = entry.details?.resultView;
  if (resultView === "assets" || resultView === "preview" || resultView === "export") return resultView;
  const viewFact = entry.facts?.find((fact) => fact.label === "查看")?.value || "";
  if (/参考/.test(viewFact)) return "assets";
  if (/预览/.test(viewFact)) return "preview";
  if (/交付|导出/.test(viewFact)) return "export";
  return undefined;
}

function timelineExecutionResult(entry: VibeAgentTimelineEntry): VibeAgentExecutionResultSummary | undefined {
  const executionResult = isPlainRecord(entry.details?.executionResult) ? entry.details.executionResult : undefined;
  if (!executionResult) return undefined;
  const lifecycle = stringValue(executionResult.lifecycle);
  const status = stringValue(executionResult.status);
  const summary = stringValue(executionResult.summary);
  const next = stringValue(executionResult.next);
  const lifecycleValues: VibeAgentExecutionResultSummary["lifecycle"][] = [
    "proposed",
    "waiting_for_confirmation",
    "running",
    "succeeded",
    "failed",
    "cancelled",
    "needs_user_input",
  ];
  const statusValues: VibeAgentExecutionResultSummary["status"][] = [
    "blocked",
    "awaiting_confirmation",
    "ready_to_run",
    "running",
    "succeeded",
    "failed",
    "cancelled",
  ];
  if (!lifecycleValues.includes(lifecycle as VibeAgentExecutionResultSummary["lifecycle"])) return undefined;
  if (!statusValues.includes(status as VibeAgentExecutionResultSummary["status"])) return undefined;
  if (!summary) return undefined;
  return {
    lifecycle: lifecycle as VibeAgentExecutionResultSummary["lifecycle"],
    status: status as VibeAgentExecutionResultSummary["status"],
    summary: cleanMinimalAgentMessageCopy(summary),
    next: cleanMinimalAgentMessageCopy(next),
  };
}

function executionResultStatusLabel(status: VibeAgentExecutionResultSummary["status"]) {
  if (status === "blocked") return "需要处理";
  if (status === "awaiting_confirmation") return "等你确认";
  if (status === "ready_to_run") return "可执行";
  if (status === "running") return "执行中";
  if (status === "succeeded") return "已完成";
  if (status === "failed") return "失败";
  if (status === "cancelled") return "已取消";
  return "结果";
}

function minimalAgentMessageRequestsActionConfirmation(message: MinimalAgentMessage) {
  return message.role === "confirmation"
    || (
      message.toolName === "request_user_confirmation"
      && (message.status === "waiting" || message.lifecycle === "waiting_for_confirmation")
    );
}

function minimalAgentMessageStageLabel(message: MinimalAgentMessage) {
  if (message.role === "user") return "输入";
  if (minimalAgentMessageRequestsActionConfirmation(message)) return "需要确认";
  if (message.entryType === "action_result") {
    return message.status === "blocked" ? "执行受阻" : "执行结果";
  }
  if (message.entryType === "state_change") {
    return message.lifecycle === "running" || message.title === "执行中" ? "执行状态" : "项目状态";
  }
  if (message.entryType === "tool_call") return "正在处理";
  if (message.entryType === "tool_result") {
    if (message.title === "推荐 Skills") return "推荐方法";
    if (message.title === "执行边界") return "执行边界";
    if (message.toolName === "inspect_project") return "项目状态";
    if (message.toolName === "classify_assets" || message.toolName === "scan_assets") return "素材识别";
    if (message.toolName === "plan_story") return "故事规划";
    if (message.toolName === "plan_next_action") return "下一步";
    return "执行结果";
  }
  if (message.role === "assistant" && /理解/.test(message.title)) return "理解";
  if (message.role === "assistant") return "回复";
  return "";
}

function minimalAgentMessageTitleLabel(message: MinimalAgentMessage) {
  const title = cleanMinimalAgentMessageCopy(message.title);
  const stage = minimalAgentMessageStageLabel(message);
  if (!title || !stage) return title;
  if (minimalAgentMessageRequestsActionConfirmation(message) && title === "请求确认") {
    return minimalAgentConfirmationAction(message, "确认执行").label;
  }
  const status = minimalAgentMessageStatusLabel(message);
  if (status && title === status) return "";
  if (title === stage) return "";
  if (title.startsWith(stage)) {
    const remainder = cleanMinimalAgentMessageCopy(title.slice(stage.length));
    if (status && remainder === status) return "";
    return remainder || "";
  }
  return title;
}

function minimalAgentMessageFromTimelineEntry(entry: VibeAgentTimelineEntry): MinimalAgentMessage {
  const executionResult = timelineExecutionResult(entry);
  const next = cleanMinimalAgentMessageCopy(executionResult?.next || (typeof entry.details?.next === "string" ? entry.details.next : "") || "") || undefined;
  const assetInboxSummary = minimalAgentAssetInboxSummaryFromTimelineEntry(entry);
  const assetActions = minimalAgentAssetActionsFromTimelineEntry(entry);
  const assetActionOverflow = minimalAgentAssetActionOverflowFromTimelineEntry(entry, assetActions.length);
  const skillRecommendations = minimalAgentSkillRecommendationsFromTimelineEntry(entry);
  if (entry.type === "user_message") {
    return {
      id: entry.id,
      entryType: entry.type,
      role: "user",
      title: entry.title,
      body: cleanMinimalAgentMessageCopy(entry.body),
      status: entry.status,
      lifecycle: entry.lifecycle,
      facts: stableIntentBoundaryFacts(entry),
      actionKind: entry.actionKind,
      actionId: entry.actionId,
      next,
    };
  }
  if (entry.type === "tool_call" || entry.type === "tool_result" || entry.type === "action_result" || entry.type === "state_change") {
    const legacyReferenceRunning = legacyReferenceGenerationPreparedMessage(entry);
    return {
      id: entry.id,
      entryType: legacyReferenceRunning ? "state_change" : entry.type,
      role: "tool",
      title: legacyReferenceRunning ? "参考生成中" : cleanMinimalAgentMessageCopy(entry.title),
      body: cleanMinimalAgentMessageCopy(entry.body),
      status: legacyReferenceRunning ? "waiting" : entry.status,
      lifecycle: legacyReferenceRunning ? "running" : entry.lifecycle,
      toolName: entry.toolName,
      actionKind: entry.actionKind,
      actionId: entry.actionId,
      facts: entry.facts,
      resultView: timelineResultView(entry),
      executionResult,
      assetInboxSummary,
      assetActions,
      assetActionOverflow,
      skillRecommendations,
      next,
    };
  }
  if (entry.type === "confirmation_request") {
    return {
      id: entry.id,
      entryType: entry.type,
      role: "confirmation",
      title: entry.title,
      body: cleanMinimalAgentMessageCopy(entry.body),
      status: entry.status,
      lifecycle: entry.lifecycle,
      toolName: entry.toolName,
      actionKind: entry.actionKind,
      actionId: entry.actionId,
      facts: entry.facts,
      next: next || "确认后我再执行，不会自动调用生成服务。",
    };
  }
  return {
    id: entry.id,
    entryType: entry.type,
    role: "assistant",
    title: entry.title,
    body: cleanMinimalAgentMessageCopy(entry.body),
    status: entry.status,
    lifecycle: entry.lifecycle,
    actionKind: entry.actionKind,
    actionId: entry.actionId,
    facts: stableIntentBoundaryFacts(entry),
    next: next || (entry.confirmationRequired ? "等你确认后继续。" : undefined),
  };
}

function minimalAgentMessageStatusLabel(message: MinimalAgentMessage) {
  if (
    message.role === "assistant"
    && message.entryType === "assistant_message"
    && (
      message.lifecycle === "running"
      || message.lifecycle === "waiting_for_confirmation"
      || message.lifecycle === "proposed"
    )
  ) return "";
  const lifecycleLabel = minimalAgentMessageLifecycleLabel(message.lifecycle);
  if (lifecycleLabel) return lifecycleLabel;
  if (message.role === "user") return "";
  if (message.role === "assistant" && message.status === "done") return "";
  if (message.status === "waiting") {
    return message.toolName === "run_confirmed_action" ? "执行中" : "等待";
  }
  if (message.status === "blocked") {
    return message.entryType === "action_result" ? "可重试" : "需处理";
  }
  if (message.status === "done") {
    return message.entryType === "tool_result" ? "已读取" : "完成";
  }
  return "";
}

function minimalAgentMessageLifecycleLabel(lifecycle?: MinimalAgentMessage["lifecycle"]) {
  if (lifecycle === "proposed") return "已提议";
  if (lifecycle === "waiting_for_confirmation") return "待确认";
  if (lifecycle === "running") return "执行中";
  if (lifecycle === "succeeded") return "已完成";
  if (lifecycle === "failed") return "失败";
  if (lifecycle === "cancelled") return "已取消";
  if (lifecycle === "needs_user_input") return "需补充";
  return "";
}

function minimalAgentConfirmationAction(message: MinimalAgentMessage, fallbackLabel: string) {
  const providerFact = minimalAgentFactValue(message, ["外部提交", "执行", "调用", "成本"]);
  const impactFact = minimalAgentFactValue(message, ["目标", "影响"]);
  const writeFact = minimalAgentFactValue(message, ["写入", "保存"]);
  const writeHint = writeFact && writeFact !== "不写文件" ? `，预计保存到${writeFact}` : "";
  if (message.actionKind === "prepare_reference_generation") {
    return {
      label: /Image2|参考生成/.test(providerFact) ? "确认生成参考" : "确认参考计划",
      hint: `确认后处理${impactFact || "当前镜头"}，${providerFact || "不会自动提交视频"}${writeHint}。`,
    };
  }
  if (message.actionKind === "prepare_video_submit") {
    return {
      label: /Seedance|视频提交/.test(providerFact) ? "确认提交视频" : "确认视频计划",
      hint: `确认后处理${impactFact || "当前镜头"}，${providerFact || "会按当前权限执行"}${writeHint}。`,
    };
  }
  if (message.actionKind === "query_video_result") {
    return {
      label: "确认查询结果",
      hint: "只查询已有视频任务结果，不会重复提交。",
    };
  }
  if (message.actionKind === "prepare_export") {
    return {
      label: "确认导出",
      hint: "确认后生成本地交付包和报告。",
    };
  }
  if (message.actionKind === "revise_story_or_shot") {
    return {
      label: "确认修改",
      hint: `确认后保存这版修改到${writeFact || impactFact || "当前镜头"}，不会自动生成参考或提交视频。`,
    };
  }
  if (message.actionKind === "update_shot_strategy") {
    return {
      label: "确认方式",
      hint: `确认后更新${impactFact || "当前镜头"}的生成方式。`,
    };
  }
  if (message.actionKind === "review_reference_asset") {
    return {
      label: "确认复核",
      hint: "确认后保存这次复核结果。",
    };
  }
  if (message.actionKind === "inspect_project_status") {
    return {
      label: "继续",
      hint: "继续读取项目状态，不会调用生成服务。",
    };
  }
  if (/写入项目|写项目|改项目|只写项目/.test(providerFact) || /写入项目|修改项目/.test(`${message.body} ${message.next || ""}`)) {
    return {
      label: "确认修改",
      hint: `确认后保存这版修改到${writeFact || impactFact || "当前镜头"}，不会自动生成参考或提交视频。`,
    };
  }
  if (message.actionKind === "request_style_research") {
    return {
      label: "确认查资料",
      hint: "确认后联网查资料，结果会先回到消息流里。",
    };
  }
  if (/草案|故事流|写入故事/.test(`${message.title} ${message.body} ${message.next || ""}`)) {
    return {
      label: NEW_VIDEO_DRAFT_CONFIRM_LABEL,
      hint: "确认后只保存到项目，不会生成参考或提交视频。",
    };
  }
  return {
    label: "确认执行",
    hint: "确认后继续当前消息里的动作，不会切换到其他推荐任务。",
  };
}

function minimalAgentFactValue(message: MinimalAgentMessage, labels: string[]) {
  const value = message.facts?.find((fact) => labels.includes(fact.label))?.value || "";
  return cleanMinimalAgentMessageCopy(value);
}

function minimalAgentConfirmationBoundary(message: MinimalAgentMessage) {
  const targetFact = minimalAgentFactValue(message, ["目标", "影响"]);
  const costFact = minimalAgentFactValue(message, ["成本", "调用", "执行"]);
  const writeFact = minimalAgentFactValue(message, ["写入", "保存"]);
  const externalFact = minimalAgentFactValue(message, ["外部提交"]);
  const parts = [
    targetFact ? `这次只补 ${targetFact}` : "",
    costFact ? (costFact === "参考生成" ? "会生成参考图" : costFact) : "",
    writeFact && writeFact !== "不写文件" ? `结果保存到 ${writeFact}` : "",
    externalFact ? externalFact : "",
  ].filter(Boolean);
  return parts.length ? cleanMinimalAgentMessageCopy(`确认前再核对：${parts.join("；")}。`) : "";
}

function minimalAgentConfirmationReadableBody(message: MinimalAgentMessage) {
  const confirmationAction = minimalAgentConfirmationAction(message, "确认执行");
  const actionLabel = confirmationAction.label.replace(/^确认/, "") || "继续这一步";
  const targetFact = minimalAgentFactValue(message, ["目标", "影响"]);
  const writeFact = minimalAgentFactValue(message, ["写入"]);
  const providerFact = minimalAgentFactValue(message, ["外部提交", "执行", "调用", "成本"]);
  const combinedCopy = cleanMinimalAgentMessageCopy(`${message.body} ${message.next || ""} ${confirmationAction.hint} ${providerFact}`);
  const readableActionLabel = actionLabel.startsWith("这版") ? `确认${actionLabel}` : actionLabel;
  const actionLine = `我准备${readableActionLabel}${targetFact ? `，范围是${targetFact}` : ""}。`;
  const writeLine = writeFact && writeFact !== "不写文件" ? `结果会保存到${writeFact}。` : "";
  if (/不会.*提交视频|不会自动提交视频|不提交视频/.test(combinedCopy)) {
    return `${actionLine}${writeLine}这一步不会提交视频，确认后才执行。`;
  }
  if (/不会.*生成参考|不会生成参考|无生成成本|不调用生成服务|只保存|只查询/.test(combinedCopy)) {
    return `${actionLine}${writeLine}这一步不会调用生成服务，确认后才执行。`;
  }
  if (/Seedance|Image2|联网|外部|提交|生成|调用/.test(combinedCopy)) {
    return `${actionLine}${writeLine}这一步会调用外部服务，确认后才执行。`;
  }
  return `${actionLine}${writeLine}确认后才执行。`;
}

function minimalAgentMessageBody(message: MinimalAgentMessage) {
  return minimalAgentMessageRequestsActionConfirmation(message)
    ? minimalAgentConfirmationReadableBody(message)
    : cleanMinimalAgentMessageCopy(message.body);
}

function minimalAgentMessageNeedsLocalProject(message: MinimalAgentMessage) {
  if (message.status !== "blocked") return false;
  return /本地项目|项目文件夹|临时项目/.test(`${message.title} ${message.body} ${message.next || ""}`);
}

function minimalAgentMessageCompletedLocalProjectSetup(message: MinimalAgentMessage) {
  if (message.status !== "done" || message.toolName !== "write_project") return false;
  return /项目文件夹已准备/.test(`${message.title} ${message.body}`);
}

function minimalAgentMessageCompletedToolAction(message: MinimalAgentMessage) {
  if (message.entryType !== "action_result" || message.status !== "done") return false;
  return message.toolName === "generate_references"
    || message.toolName === "submit_video"
    || message.toolName === "query_video"
    || message.toolName === "export_showcase"
    || message.toolName === "export_project";
}

function minimalAgentMessageBlockedToolAction(message: MinimalAgentMessage) {
  if (message.entryType !== "action_result" || message.status !== "blocked") return false;
  return message.toolName === "generate_references"
    || message.toolName === "submit_video"
    || message.toolName === "query_video"
    || message.toolName === "export_showcase"
    || message.toolName === "export_project";
}

function minimalAgentMessageFinalToolAction(message: MinimalAgentMessage) {
  return minimalAgentMessageCompletedToolAction(message) || minimalAgentMessageBlockedToolAction(message);
}

function minimalAgentMessageRequestsSkillSave(message: MinimalAgentMessage) {
  return message.role === "confirmation" && message.toolName === "save_skill";
}

function isNewVideoDraftConfirmationLabel(value: string) {
  return value.includes("确认继续") || value.includes(NEW_VIDEO_DRAFT_CONFIRM_LABEL) || value.includes("写入故事流") || value.includes("保存到项目");
}

function minimalAgentMessageClosesConfirmation(message: MinimalAgentMessage) {
  if (message.entryType === "action_result") return message.lifecycle !== "running" && message.status !== "waiting";
  if (message.entryType !== "tool_result" || message.toolName !== "run_confirmed_action") return false;
  return message.lifecycle !== "running" && message.status !== "waiting";
}

function minimalAgentMessageMatchesConfirmationAction(message: MinimalAgentMessage, confirmation: MinimalAgentMessage) {
  const messageToolName = message.toolName || "";
  const confirmationToolName = confirmation.toolName || "";
  const confirmationActionKind = confirmation.actionKind || "";
  if (message.actionId && confirmation.actionId) return message.actionId === confirmation.actionId;
  if (messageToolName === "generate_references") {
    return confirmationToolName === "generate_references" || confirmationActionKind === "prepare_reference_generation";
  }
  if (messageToolName === "submit_video") {
    return confirmationToolName === "submit_video" || confirmationActionKind === "prepare_video_submit";
  }
  if (messageToolName === "query_video") {
    return confirmationToolName === "query_video" || confirmationActionKind === "query_video_result";
  }
  if (messageToolName === "export_showcase" || messageToolName === "export_project") {
    return confirmationToolName === messageToolName || confirmationActionKind === "prepare_export";
  }
  return Boolean(messageToolName && confirmationToolName && messageToolName === confirmationToolName);
}

function minimalAgentMessageInvalidatesConfirmation(message: MinimalAgentMessage, confirmation: MinimalAgentMessage) {
  if (message.id.startsWith("direct_product_")) return minimalAgentMessageMatchesConfirmationAction(message, confirmation);
  if (message.entryType !== "state_change" || message.status !== "done") return false;
  return message.id.startsWith("selection_context_") || message.id.startsWith("execution_boundary_");
}

function minimalAgentConfirmationSuperseded(
  messages: MinimalAgentMessage[],
  index: number,
) {
  const message = messages[index];
  if (!message || message.role !== "confirmation") return false;
  return messages.slice(index + 1).some((candidate) => {
    if (minimalAgentMessageInvalidatesConfirmation(candidate, message)) return true;
    if (!minimalAgentMessageClosesConfirmation(candidate)) return false;
    if (message.actionId && candidate.actionId) return message.actionId === candidate.actionId;
    if (candidate.toolName === "run_confirmed_action") return false;
    return minimalAgentMessageMatchesConfirmationAction(candidate, message);
  });
}

function dedupeMinimalAgentMessages(messages: MinimalAgentMessage[]) {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (!message.id.startsWith("direct_product_") || message.status === "waiting") return true;
    const key = [
      message.entryType,
      message.toolName,
      message.title,
      message.body,
      message.status,
    ].join("\u0000");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function completedToolActionView(message: MinimalAgentMessage): { view: DirectorView; label: string } | undefined {
  if (message.resultView === "assets") return { view: "assets", label: "去参考页" };
  if (message.resultView === "preview") return { view: "preview", label: "去预览页" };
  if (message.resultView === "export") return { view: "export", label: "去交付页" };
  if (message.toolName === "generate_references") return { view: "assets", label: "去参考页" };
  if (message.toolName === "submit_video") return { view: "preview", label: "去预览页" };
  if (message.toolName === "query_video") return { view: "preview", label: "去预览页" };
  if (message.toolName === "export_showcase") return { view: "export", label: "去交付页" };
  if (message.toolName === "export_project") return { view: "export", label: "去交付页" };
  return undefined;
}

function agentMessageNextIntent(message: MinimalAgentMessage, fallback = "继续") {
  return cleanMinimalAgentMessageCopy(message.executionResult?.next?.trim() || message.next?.trim() || fallback);
}

function agentMessageConfirmationIntent(message: MinimalAgentMessage, actionLabel: string) {
  const action = minimalAgentFactValue(message, ["动作"]) || actionLabel || "当前动作";
  const target = minimalAgentFactValue(message, ["目标", "引用", "影响"]);
  const boundary = minimalAgentFactValue(message, ["外部提交", "成本", "执行"]);
  return [
    `确认执行：${action}`,
    target ? `目标：${target}` : "",
    boundary ? `边界：${boundary}` : "",
  ].filter(Boolean).join("。");
}

function agentMessageRevisionIntent(message: MinimalAgentMessage) {
  const summary = cleanMinimalAgentMessageCopy(message.executionResult?.summary?.trim() || message.body.trim());
  const next = agentMessageNextIntent(message, "调整后重试");
  if (summary && next) {
    return `刚才这一步没通过：${summary}\n请按这个方向继续改：${next}`;
  }
  return next || summary || "调整后重试";
}

function cleanEmptyComposerStatusLine(value: string, hasComposerInput: boolean) {
  if (hasComposerInput) return value;
  const looksLikeLegacyReadyDraft = value.includes("故事草案") && value.includes("已就绪");
  if (looksLikeLegacyReadyDraft) return "等待输入：先写一句想法，确认前不会生成。";
  return value;
}

function minimalAgentMessageIsCompletedProcessCard(message: MinimalAgentMessage) {
  if (message.entryType !== "tool_call") return false;
  if (message.toolName === "request_user_confirmation" || message.toolName === "run_confirmed_action") return false;
  if (message.status === "waiting" || message.status === "blocked") return false;
  if (message.lifecycle === "running" || message.lifecycle === "waiting_for_confirmation") return false;
  return true;
}

function minimalAgentMessageHasResultCard(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  if (message.entryType !== "tool_result" || message.toolName !== "run_confirmed_action") return false;
  if (message.lifecycle === "running" || message.lifecycle === "waiting_for_confirmation") return false;
  return messages.some((candidate) =>
    candidate.entryType === "action_result"
    && (!message.actionId || !candidate.actionId || candidate.actionId === message.actionId)
  );
}

function minimalAgentMessageHasFinalActionResult(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  return messages.some((candidate) => (
    candidate.entryType === "action_result"
    && candidate.status !== "waiting"
    && candidate.lifecycle !== "running"
    && (!message.actionId || !candidate.actionId || candidate.actionId === message.actionId)
  ));
}

function minimalAgentMessageIsSupersededProcessCard(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  if (!minimalAgentMessageHasFinalActionResult(messages, message)) return false;
  if (message.toolName === "run_confirmed_action" && message.entryType !== "action_result") return true;
  if (message.id.startsWith("execution_boundary_")) return true;
  if (message.title === "执行边界") return true;
  if (message.entryType === "state_change" && (message.lifecycle === "running" || message.title === "执行中")) return true;
  return false;
}

function minimalAgentMessageHasLaterFinalActionResult(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  const messageIndex = messages.indexOf(message);
  return messages.some((candidate, index) => (
    index > messageIndex
    && candidate.entryType === "action_result"
    && candidate.status !== "waiting"
    && candidate.lifecycle !== "running"
    && (!message.actionId || !candidate.actionId || candidate.actionId === message.actionId)
  ));
}

function minimalAgentConfirmationRequestsOverlap(left: MinimalAgentMessage, right: MinimalAgentMessage) {
  if (!minimalAgentMessageRequestsActionConfirmation(left) || !minimalAgentMessageRequestsActionConfirmation(right)) return false;
  if (left.actionId && right.actionId && left.actionId === right.actionId) return true;
  const leftAction = minimalAgentFactValue(left, ["动作"]) || left.actionKind || left.toolName || "";
  const rightAction = minimalAgentFactValue(right, ["动作"]) || right.actionKind || right.toolName || "";
  const leftTarget = minimalAgentFactValue(left, ["目标", "影响"]);
  const rightTarget = minimalAgentFactValue(right, ["目标", "影响"]);
  return Boolean(leftAction && rightAction && leftAction === rightAction && leftTarget && rightTarget && leftTarget === rightTarget);
}

function minimalAgentMessageHasLaterConfirmationRequest(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  const messageIndex = messages.indexOf(message);
  const messageIsConfirmationRequest = minimalAgentMessageRequestsActionConfirmation(message);
  return messages.some((candidate, index) => (
    index > messageIndex
    && minimalAgentMessageRequestsActionConfirmation(candidate)
    && (candidate.status === "waiting" || candidate.lifecycle === "waiting_for_confirmation")
    && (
      messageIsConfirmationRequest
        ? minimalAgentConfirmationRequestsOverlap(message, candidate)
        : (!message.actionId || !candidate.actionId || candidate.actionId === message.actionId)
    )
  ));
}

function minimalAgentMessageIsSupersededObservationCard(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  if (message.entryType !== "tool_result") return false;
  if (message.lifecycle === "running" || message.lifecycle === "waiting_for_confirmation") return false;
  if (message.status === "waiting" || message.status === "blocked") return false;
  const toolIsObservation = message.toolName === "inspect_project"
    || message.toolName === "classify_assets"
    || message.toolName === "scan_assets"
    || message.toolName === "plan_next_action";
  return toolIsObservation && minimalAgentMessageHasLaterFinalActionResult(messages, message);
}

function minimalAgentMessageIsSupersededConfirmationPrepCard(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  if (!minimalAgentMessageHasLaterConfirmationRequest(messages, message)) return false;
  const isObservationTool = message.entryType === "tool_result" && (
    message.toolName === "inspect_project"
    || message.toolName === "classify_assets"
    || message.toolName === "scan_assets"
    || message.toolName === "plan_next_action"
  );
  return isObservationTool
    || message.id.startsWith("execution_boundary_")
    || message.title === "执行边界";
}

function minimalAgentConfirmationMessageIsStaleAfterLaterResult(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  if (!minimalAgentMessageRequestsActionConfirmation(message)) return false;
  if (message.status !== "waiting" && message.lifecycle !== "waiting_for_confirmation") return false;
  const messageIndex = messages.indexOf(message);
  return messages.some((candidate, index) => (
    index > messageIndex
    && candidate.role !== "user"
    && candidate.entryType === "action_result"
    && candidate.status !== "waiting"
    && candidate.lifecycle !== "running"
    && candidate.lifecycle !== "waiting_for_confirmation"
    && minimalAgentMessageMatchesConfirmationAction(candidate, message)
  ));
}

function minimalAgentRequestConfirmationToolCallIsSuperseded(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  if (message.entryType !== "tool_call" || message.toolName !== "request_user_confirmation") return false;
  if (message.status !== "waiting" && message.lifecycle !== "waiting_for_confirmation") return false;
  return messages.some((candidate) => (
    candidate.entryType === "confirmation_request"
    && candidate.toolName === "request_user_confirmation"
    && (candidate.status === "waiting" || candidate.lifecycle === "waiting_for_confirmation")
    && (!message.actionId || !candidate.actionId || candidate.actionId === message.actionId)
  ));
}

function minimalAgentMessageIsSupersededSelectionContextCard(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  if (message.entryType !== "state_change" || !message.id.startsWith("selection_context_")) return false;
  const messageIndex = messages.indexOf(message);
  return messages.some((candidate, index) => (
    index > messageIndex
    && candidate.entryType === "state_change"
    && candidate.id.startsWith("selection_context_")
  ));
}

function minimalAgentSelectionContextMessageIsOutsideActiveScope(
  message: MinimalAgentMessage,
  activeSelectionKey: string,
  hasBoundSelection: boolean,
) {
  if (message.entryType !== "state_change" || !message.id.startsWith("selection_context_")) return false;
  if (!hasBoundSelection || !activeSelectionKey) return true;
  return message.id !== selectionContextMessageId(activeSelectionKey);
}

function visibleMinimalAgentMessages(messages: MinimalAgentMessage[]): {
  messages: MinimalAgentMessage[];
  hiddenCount: number;
} {
  const filteredMessages = messages.filter((_, index) => !minimalAgentConfirmationSuperseded(messages, index));
  const compactedMessages = filteredMessages.filter((message) => (
    !minimalAgentMessageIsCompletedProcessCard(message)
    && !minimalAgentMessageHasResultCard(filteredMessages, message)
    && !minimalAgentMessageIsSupersededProcessCard(filteredMessages, message)
    && !minimalAgentMessageIsSupersededObservationCard(filteredMessages, message)
    && !minimalAgentMessageIsSupersededConfirmationPrepCard(filteredMessages, message)
    && !minimalAgentConfirmationMessageIsStaleAfterLaterResult(filteredMessages, message)
    && !minimalAgentRequestConfirmationToolCallIsSuperseded(filteredMessages, message)
    && !minimalAgentMessageIsSupersededSelectionContextCard(filteredMessages, message)
  ));
  const currentMessages = dedupeMinimalAgentMessages(compactedMessages.length ? compactedMessages : filteredMessages);
  const latestUserIndex = currentMessages.map((message) => message.role).lastIndexOf("user");
  const turnFocusedMessages = latestUserIndex >= 0
    ? currentMessages.slice(latestUserIndex)
    : currentMessages;
  const visible = turnFocusedMessages.length <= MAX_VISIBLE_AGENT_THREAD_MESSAGES
    ? turnFocusedMessages
    : turnFocusedMessages.slice(-MAX_VISIBLE_AGENT_THREAD_MESSAGES);
  const bounded = visible.length > MAX_VISIBLE_AGENT_THREAD_MESSAGES ? visible.slice(-MAX_VISIBLE_AGENT_THREAD_MESSAGES) : visible;
  return {
    messages: bounded,
    hiddenCount: Math.max(0, currentMessages.length - bounded.length),
  };
}

function minimalAgentThreadNeedsStatusReply(messages: MinimalAgentMessage[]) {
  const latestUserIndex = messages.map((message) => message.role).lastIndexOf("user");
  const currentTurnMessages = latestUserIndex >= 0 ? messages.slice(latestUserIndex + 1) : messages;
  if (!currentTurnMessages.length) return true;
  return !currentTurnMessages.some((message) => (
    message.role === "assistant"
    || message.role === "confirmation"
  ));
}

function minimalAgentReferenceReviewMessageIsStale(message: MinimalAgentMessage, referencesReadyAfterReview: boolean) {
  if (!referencesReadyAfterReview || message.role === "user") return false;
  const text = minimalAgentMessageSearchText(message);
  return /复核|需要复核|等你复核|去参考页复核|参考待复核/.test(text) && !/参考可用/.test(text);
}

function minimalAgentReferenceReviewMessageIsPremature(message: MinimalAgentMessage, referenceHasReviewableAssets: boolean) {
  if (referenceHasReviewableAssets || message.role === "user") return false;
  const text = minimalAgentMessageSearchText(message);
  return /参考已生成|参考图已经回到参考页|\d+\s*项参考需要复核|去参考页复核|等你复核/.test(text)
    && !/参考可用/.test(text);
}

function minimalAgentMessageSearchText(message: MinimalAgentMessage) {
  const factText = message.facts?.map((fact) => `${fact.label} ${fact.value}`).join(" ") || "";
  const executionText = message.executionResult
    ? `${message.executionResult.summary} ${message.executionResult.next || ""}`
    : "";
  return `${message.title} ${message.body} ${message.next || ""} ${factText} ${executionText}`;
}

function minimalAgentThreadHasUserIntent(messages: MinimalAgentMessage[], userIntent: string) {
  const compactIntent = shortAgentPanelMessageText(userIntent).trim();
  if (!compactIntent) return true;
  const intentLead = compactIntent.slice(0, 48);
  return messages.some((message) => (
    message.role === "user"
    && cleanMinimalAgentMessageCopy(message.body).includes(intentLead)
  ));
}

function minimalAgentMessageHasLaterReferenceReady(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  const messageIndex = messages.indexOf(message);
  return messages.some((candidate, index) => {
    if (index <= messageIndex || candidate.role === "user") return false;
    return /参考可用/.test(minimalAgentMessageSearchText(candidate));
  });
}

function minimalAgentReferenceGenerationConfirmationIsStale(
  messages: MinimalAgentMessage[],
  message: MinimalAgentMessage,
  referencesReadyAfterReview: boolean,
) {
  if (message.role === "user") return false;
  const text = minimalAgentMessageSearchText(message);
  const looksLikeReferenceGenerationConfirmation = minimalAgentMessageRequestsActionConfirmation(message)
    || /需要确认|请求确认|等你确认|待确认/.test(text);
  if (!looksLikeReferenceGenerationConfirmation) return false;
  return (referencesReadyAfterReview || minimalAgentMessageHasLaterReferenceReady(messages, message))
    && /补齐参考|生成参考|参考生成/.test(text)
    && !/参考可用/.test(text);
}

function minimalAgentReferenceCompletionMessageIsStale(message: MinimalAgentMessage, referencesReadyAfterReview: boolean) {
  if (message.role === "user") return false;
  const text = minimalAgentMessageSearchText(message);
  if (/参考已通过|可以准备视频/.test(text) && !/参考可用/.test(text)) return true;
  if (referencesReadyAfterReview || message.toolName !== "generate_references") return false;
  return /参考可用/.test(text);
}

function minimalAgentReferenceBlockedMessageIsStale(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  if (message.role === "user") return false;
  const text = minimalAgentMessageSearchText(message);
  const isBlockedReferenceMessage = (
    message.status === "blocked"
    || message.lifecycle === "needs_user_input"
    || message.lifecycle === "failed"
    || /参考生成暂时中断|参考生成没有完成|结果卡片：需要处理/.test(text)
  ) && /生成参考|参考生成/.test(text);
  if (!isBlockedReferenceMessage) return false;
  const messageIndex = messages.indexOf(message);
  return messages.some((candidate, index) => {
    if (index <= messageIndex || candidate.role === "user") return false;
    const candidateText = minimalAgentMessageSearchText(candidate);
    return /参考已生成|参考图已经回到参考页|\d+\s*项参考需要复核|参考已齐/.test(candidateText);
  });
}

function latestVisibleTimelineConfirmationMessage(
  entries: VibeAgentTimelineEntry[],
  referencesReadyAfterReview = false,
) {
  const messages = entries.map(minimalAgentMessageFromTimelineEntry);
  const stateAwareMessages = messages.filter((message) =>
    !minimalAgentReferenceGenerationConfirmationIsStale(messages, message, referencesReadyAfterReview)
  );
  return [...visibleMinimalAgentMessages(stateAwareMessages).messages]
    .reverse()
    .find(minimalAgentMessageRequestsActionConfirmation);
}

function mergeVibeAgentTimelineEntries(
  current: VibeAgentTimelineEntry[],
  additions: VibeAgentTimelineEntry[],
) {
  const entriesById = new Map(current.map((entry) => [entry.id, entry]));
  for (const entry of additions) entriesById.set(entry.id, entry);
  return Array.from(entriesById.values()).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function buildLocalBlockedAgentTimelineEntries(input: {
  userIntent: string;
  title: string;
  body: string;
  facts?: Array<{ label: string; value: string }>;
  next?: string;
}): VibeAgentTimelineEntry[] {
  const createdAt = new Date().toISOString();
  const suffix = createdAt.replace(/[^a-z0-9]+/gi, "").slice(0, 24).toLowerCase();
  return [
    {
      id: `local_agent_user_${suffix}`,
      type: "user_message",
      createdAt,
      title: "你",
      body: input.userIntent,
      status: "done",
    },
    {
      id: `local_agent_tool_inspect_${suffix}`,
      type: "tool_call",
      createdAt,
      title: "读取项目",
      body: "Agent 正在读取当前故事、镜头和项目连接状态。",
      toolName: "inspect_project",
      status: "done",
    },
    {
      id: `local_agent_result_${suffix}`,
      type: "assistant_message",
      createdAt,
      title: input.title,
      body: input.body,
      status: "blocked",
      facts: input.facts,
      details: input.next ? { next: input.next } : undefined,
    },
  ];
}

function buildLocalProjectSetupTimelineEntries(input: {
  createdAt: string;
  phase: "started" | "completed" | "cancelled" | "failed";
  detail?: string;
}): VibeAgentTimelineEntry[] {
  const suffix = input.createdAt.replace(/[^a-z0-9]+/gi, "").slice(0, 24).toLowerCase() || "now";
  if (input.phase === "started") {
    return [
      {
        id: `local_project_setup_call_${suffix}`,
        type: "tool_call",
        createdAt: input.createdAt,
        title: "准备项目文件夹",
        body: "Agent 正在打开项目文件夹选择入口，等你选择或新建一个本地项目。",
        toolName: "write_project",
        status: "waiting",
        facts: [
          { label: "动作", value: "选择项目文件夹" },
          { label: "原因", value: "生成参考、发送视频和导出前需要本地项目" },
        ],
        details: { next: "等待选择项目文件夹" },
      },
      {
        id: `local_project_setup_state_${suffix}`,
        type: "state_change",
        createdAt: input.createdAt,
        title: "等待项目文件夹",
        body: "选择完成后，我会继续沿着当前故事往下走。",
        toolName: "write_project",
        status: "waiting",
        details: { next: "选择或新建项目文件夹" },
      },
    ];
  }
  const completed = input.phase === "completed";
  const cancelled = input.phase === "cancelled";
  return [
    {
      id: `local_project_setup_result_${suffix}`,
      type: "action_result",
      createdAt: input.createdAt,
      title: completed ? "项目文件夹已准备" : cancelled ? "没有选择项目文件夹" : "项目文件夹准备失败",
      body: completed
        ? "本地项目文件夹已经准备好。你可以继续说“继续”，我会接着检查参考和视频下一步。"
        : cancelled
          ? "这次没有选择项目文件夹。你仍然可以继续改文字；生成参考、发送视频或导出前再选择即可。"
          : input.detail || "项目文件夹没有准备成功。可以稍后重试，或先继续修改故事。",
      toolName: "write_project",
      status: completed ? "done" : "blocked",
      facts: [
        { label: "动作", value: "选择项目文件夹" },
        { label: "状态", value: completed ? "已准备" : cancelled ? "已取消" : "失败" },
        { label: "下一步", value: completed ? "继续检查项目" : "可以重试或继续改文字" },
      ],
      details: {
        next: completed ? "说“继续”检查下一步" : "需要时再选择项目文件夹",
      },
    },
  ];
}

function buildSelectionChangedTimelineEntry(input: {
  createdAt: string;
  selectionKey: string;
  label: string;
  hint: string;
  facts: Array<{ label: string; value: string }>;
}): VibeAgentTimelineEntry {
  const selectionId = selectionContextMessageId(input.selectionKey);
  return {
    id: selectionId,
    type: "state_change",
    createdAt: input.createdAt,
    title: "我知道你在说哪里了",
    body: `现在你说“这个”，我会理解为${input.label}。${input.hint}`,
    lifecycle: "succeeded",
    status: "done",
    facts: [
      { label: "这个指向", value: input.label },
      ...input.facts,
    ].slice(0, 4),
    details: {
      deicticCue: input.label,
      next: "直接说改法，或说“继续下一步”。",
    },
  };
}

function selectionContextMessageId(selectionKey: string) {
  const selectionId = selectionKey.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 72) || "selection";
  return `selection_context_${selectionId}`;
}

function committedNewVideoDraftMessage(run?: PrototypeAgentDemoRun): MinimalAgentMessage | undefined {
  if (!isCommittedNewVideoDraftAgentRun(run)) return undefined;
  const result = run?.result;
  return {
    id: "new_video_draft_committed_result",
    entryType: "action_result",
    role: "tool",
    title: "故事已保存到项目",
    body: result?.label || "这版故事和镜头已经保存到项目。接下来可以继续修改镜头，或让 Agent 安排下一步。",
    lifecycle: "succeeded",
    status: "done",
    toolName: "write_project",
    facts: [
      { label: "写入", value: result?.storageLabel || "故事流" },
      { label: "状态", value: result?.status || "已保存到项目" },
      { label: "下一步", value: "继续修改或生成参考" },
    ],
    next: "可以直接说要改哪里，或让 Agent 继续安排参考和视频。",
  };
}

function storyFlowReadyMessage(shotCount: number): MinimalAgentMessage | undefined {
  if (shotCount <= 0) return undefined;
  return {
    id: "project_story_flow_ready_state",
    entryType: "state_change",
    role: "tool",
    title: "故事流已准备",
    body: `当前项目已有 ${shotCount} 个镜头。你可以点选镜头后直接说“这个”哪里不对，也可以让 Agent 继续安排下一步。`,
    lifecycle: "succeeded",
    status: "done",
    toolName: "inspect_project",
    facts: [
      { label: "镜头", value: `${shotCount} 个` },
      { label: "下一步", value: "修改镜头或生成参考" },
    ],
    next: "直接说要改哪里，或让 Agent 继续安排参考和视频。",
  };
}

function buildExecutionBoundaryChangedTimelineEntry(input: {
  createdAt: string;
  contract: AgentVideoPermissionContract;
}): VibeAgentTimelineEntry {
  const label = agentVideoPermissionLabel(input.contract);
  const detail = agentVideoPermissionDetail(input.contract);
  const next = input.contract.mode === "video_allowed"
    ? "你可以继续说“发送视频”，我仍会在提交前确认。"
    : input.contract.mode === "reference_allowed"
      ? "你可以继续说“补参考”，视频提交仍会单独确认。"
      : "我现在只整理故事和镜头，不会生成参考或提交视频。";
  return {
    id: `execution_boundary_${input.contract.mode}_${input.createdAt}`,
    type: "state_change",
    createdAt: input.createdAt,
    title: "可做范围已切换",
    body: `已切换为“${label}”。${detail}`,
    lifecycle: "succeeded",
    status: "done",
    facts: [
      { label: "当前范围", value: label },
      { label: "生成参考", value: input.contract.referenceGenerationAllowed ? "允许" : "不生成" },
      { label: "提交视频", value: input.contract.videoSubmitAllowed ? "允许" : "不提交" },
    ],
    details: { next },
  };
}

type DirectProductActionToolName = Extract<
  NonNullable<VibeAgentTimelineEntry["toolName"]>,
  "generate_references" | "submit_video" | "query_video" | "export_showcase" | "export_project"
>;

type DirectProductActionCopy = {
  toolName: DirectProductActionToolName;
  startedTitle: string;
  startedBody: string;
  completedTitle: string;
  completedBody: string;
  failedTitle: string;
  next: string;
  facts?: Array<{ label: string; value: string }>;
};

function directProductActionFailureNext(input: DirectProductActionCopy, message: string) {
  if (input.toolName === "export_project" || input.toolName === "export_showcase") {
    return "检查交付页和导出设置后重试；也可以继续告诉我哪里要调整。";
  }
  if (input.toolName !== "submit_video") return "可以调整后重试，或继续描述要改哪里。";
  if (/提交前|补参考|场景参考|参考无法|QA|画面参考/.test(message)) {
    return "按提示补参考或调整这一段后再重试。";
  }
  return "检查即梦登录、CLI 权限或稍后重试；也可以跳过这一段。";
}

function buildDirectProductActionTimelineEntry(input: {
  createdAt: string;
  phase: "started" | "running" | "completed" | "failed" | "blocked";
  toolName: DirectProductActionToolName;
  title: string;
  body: string;
  next: string;
  facts?: Array<{ label: string; value: string }>;
  dedupeKey?: string;
}): VibeAgentTimelineEntry {
  const rawSuffix = input.dedupeKey || input.createdAt;
  const suffix = rawSuffix.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 72).toLowerCase() || "now";
  const phaseLabel = input.phase === "started"
    ? "started"
    : input.phase === "running"
      ? "running"
      : input.phase === "completed"
      ? "completed"
      : input.phase === "blocked"
        ? "blocked"
        : "failed";
  return {
    id: `direct_product_${input.toolName}_${phaseLabel}_${suffix}`,
    type: input.phase === "started" ? "tool_call" : input.phase === "running" ? "state_change" : "action_result",
    createdAt: input.createdAt,
    title: input.title,
    body: input.body,
    lifecycle: input.phase === "started"
      ? "running"
      : input.phase === "running"
        ? "running"
      : input.phase === "completed"
        ? "succeeded"
        : input.phase === "blocked"
          ? "needs_user_input"
          : "failed",
    toolName: input.toolName,
    status: input.phase === "started" || input.phase === "running" ? "waiting" : input.phase === "completed" ? "done" : "blocked",
    facts: [
      ...(input.facts || []),
      { label: "下一步", value: input.next },
    ].slice(0, 4),
    details: { next: input.next },
  };
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  if (!value || (typeof value !== "object" && typeof value !== "function")) return false;
  return typeof (value as { then?: unknown }).then === "function";
}

function directProductActionResultStatus(result: unknown) {
  if (!isPlainRecord(result)) return "";
  return (stringValue(result.uiStatus) || stringValue(result.status)).toLowerCase();
}

function directProductActionResultMessage(result: unknown) {
  if (!isPlainRecord(result)) return "";
  return stringValue(result.message)
    || stringValue(result.summary)
    || stringValue(result.label);
}

function agentActionLogItemIsPrematureReferenceReview(item: AgentActionLogItem, referenceHasReviewableAssets: boolean) {
  if (referenceHasReviewableAssets) return false;
  const text = [
    item.title,
    item.result,
    item.nextStep,
    item.resultView?.label,
  ].map((part) => stringValue(part)).join(" ");
  return /参考已生成|参考图已经回到参考页|\d+\s*项参考需要复核|去参考页复核|等你复核/.test(text)
    && !/参考可用/.test(text);
}

function resolveDirectProductActionResult(input: DirectProductActionCopy, result: unknown) {
  const status = directProductActionResultStatus(result);
  const explicitFailure = isPlainRecord(result) && result.ok === false;
  const message = directProductActionResultMessage(result);
  if (explicitFailure || ["blocked", "missing", "failed", "error", "unavailable"].includes(status)) {
    return {
      phase: "failed" as const,
      title: input.failedTitle,
      body: message || "动作没有成功执行。",
      next: directProductActionFailureNext(input, message),
      status: message || "动作没有成功执行。",
    };
  }
  if (status === "needs_review" || status === "ready_for_review") {
    return {
      phase: "completed" as const,
      title: input.completedTitle,
      body: message || input.completedBody,
      next: "先去复核结果，确认后再继续。",
      status: message || input.completedBody,
    };
  }
  if (status === "verified" || status === "completed" || status === "done") {
    return {
      phase: "completed" as const,
      title: input.completedTitle,
      body: message || input.completedBody,
      next: input.next,
      status: message || input.completedBody,
    };
  }
  return {
    phase: "completed" as const,
    title: input.completedTitle,
    body: input.completedBody,
    next: input.next,
    status: "",
  };
}

function referenceDirectProductActionState(status: string | undefined, message: string | undefined) {
  const normalized = stringValue(status).toLowerCase();
  const cleanMessage = stringValue(message);
  if (normalized === "needs_review") {
    return {
      phase: "completed" as const,
      title: "参考已生成，等你复核",
      body: cleanMessage || "参考图已经回到参考页，先确认能不能用，再继续视频。",
      next: "去参考页复核。",
      status: cleanMessage || "参考已生成，等你复核。",
    };
  }
  if (normalized === "blocked") {
    return {
      phase: "failed" as const,
      title: "参考生成没有完成",
      body: cleanMessage || "参考生成暂时中断。已生成的内容会保留，可以稍后重试。",
      next: "看原因后重试，或直接告诉我怎么调整。",
      status: cleanMessage || "参考生成没有完成。",
    };
  }
  if (normalized === "running" || normalized === "prepared") {
    return {
      phase: "running" as const,
      title: "参考生成中",
      body: cleanMessage || "参考任务已交给图片服务，等图片回到参考页后再复核。",
      next: "等参考结果，或去参考页查看进度。",
      status: cleanMessage || "参考生成中，等待结果回到参考页。",
    };
  }
  if (normalized === "verified") {
    return {
      phase: "completed" as const,
      title: "参考可用",
      body: cleanMessage || "参考已经确认，可以继续准备视频。",
      next: "继续下一步。",
      status: cleanMessage || "参考可用。",
    };
  }
  return undefined;
}

function videoDirectProductActionState(
  status: string | undefined,
  message: string | undefined,
  canResume: boolean,
  suggestedActionLabel: string | undefined,
) {
  const normalized = stringValue(status).toLowerCase();
  const cleanMessage = stringValue(message);
  const actionLabel = stringValue(suggestedActionLabel);
  if (normalized === "needs_review") {
    return {
      phase: "completed" as const,
      toolName: "query_video" as const,
      title: "视频结果已回到预览页",
      body: cleanMessage || "视频已经回到预览页，先看结果，通过后再继续下一步。",
      next: "去预览页复核。",
      status: cleanMessage || "视频结果待确认。",
    };
  }
  if (normalized === "submitted" && canResume) {
    return {
      phase: "completed" as const,
      toolName: "query_video" as const,
      title: "视频可以查询结果",
      body: cleanMessage || "Seedance 任务已经提交过。现在只查询结果，不会重复提交。",
      next: actionLabel || "查询结果。",
      status: cleanMessage || "视频可以查询结果。",
    };
  }
  if (normalized === "submitted") {
    return {
      phase: "completed" as const,
      toolName: "submit_video" as const,
      title: "视频已提交，等待结果",
      body: cleanMessage || "视频任务已经进入 Seedance 队列，回流后会在预览页显示。",
      next: "等结果回流后去预览页复核。",
      status: cleanMessage || "视频已提交。",
    };
  }
  if (normalized === "blocked") {
    return {
      phase: "failed" as const,
      toolName: "submit_video" as const,
      title: "视频任务需要处理",
      body: cleanMessage || "视频任务暂时不能继续。先按提示处理后再重试。",
      next: "按提示修复后再继续。",
      status: cleanMessage || "视频任务需要处理。",
    };
  }
  return undefined;
}

function intentNeedsLocalProjectBeforeTooling(value: string) {
  const text = value.trim();
  if (isDirectorAgentExplainOnlyIntent(text)) return false;
  return /继续|下一步|生成|参考|视频|导出|补齐|发送|执行|开始|可以|确认/.test(text);
}

function intentCanStartNewVideoPlanningWithoutProject(value: string) {
  if (isDirectorAgentExplainOnlyIntent(value)) return false;
  return directorIntentCanStartNewVideoPlanningWithoutProject(value);
}

function intentStartsFreshVideoDraft(value: string) {
  if (isDirectorAgentExplainOnlyIntent(value)) return false;
  return directorIntentStartsFreshVideoDraft(value);
}

function intentContinuesCurrentProject(value: string) {
  const text = value.trim();
  if (!text) return false;
  if (/(新建|新项目|新视频|新短片|另起|换个主题|换一个项目|全新|重新开始)/u.test(text)) return false;
  return isContinueIntent(text)
    || /^(继续|下一步|接着|往下)(了|吧|啊|呀|，|。|！|!|,|\s|$)/u.test(text)
    || /(继续|下一步).{0,24}(检查|处理|推进|参考|视频|导出|生成|提交|发送)/u.test(text);
}

function shouldRouteToReadyNewVideoDraft(value: string) {
  const text = value.trim();
  if (!text) return false;
  return text.length <= 600;
}

function isNewVideoDraftConfirmationRouteIntent(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 80) return false;
  if (/(生成|补齐|参考|生图|提交|发送|视频|seedance|即梦|导出|素材|角色|场景|道具|故事板|不要|别|不提交|只)/u.test(normalized)) return false;
  const confirms = /(没问题|可以|确认|通过|继续|下一步|进入故事流|ok|okay|no problem|lets go)/i.test(normalized);
  if (!confirms) return false;
  return !/(但是|不过|先别|不要|别|不行|不对|有问题|不太|改|修改|调整|换|加|删|删除|重做|重新|希望|想要)/u.test(normalized);
}

function isSaveDirectorSkillIntent(value: string) {
  const text = value.trim();
  return /(沉淀|保存|记住|收进|加入|保留).{0,12}(skill|Skill|技能|导演经验|做法)/u.test(text)
    || /(skill|Skill|技能|导演经验|做法).{0,12}(沉淀|保存|记住|收进|加入|保留)/u.test(text);
}

function browserSkillStorageKey(projectTitle: string, fileName: string) {
  return `vibe.director.skills.${projectTitle || "project"}.${fileName}`;
}

function browserSkillIndexStorageKey(projectKey: string) {
  return `vibe.director.skillIndex.${projectKey || "project"}`;
}

function buildSkillSaveTimelineEntries(input: {
  userIntent: string;
  title: string;
  body: string;
  status: "done" | "blocked";
  path?: string;
  mode?: string;
  next?: string;
  includeUserMessage?: boolean;
}): VibeAgentTimelineEntry[] {
  const createdAt = new Date().toISOString();
  const suffix = createdAt.replace(/[^a-z0-9]+/gi, "").slice(0, 24).toLowerCase();
  const entries: VibeAgentTimelineEntry[] = [
    {
      id: `skill_save_user_${suffix}`,
      type: "user_message",
      createdAt,
      title: "你",
      body: input.userIntent,
      status: "done",
    },
    {
      id: `skill_save_call_${suffix}`,
      type: "tool_call",
      createdAt,
      title: "保存导演经验",
      body: "我正在把当前镜头的做法整理成可复用的导演经验。",
      toolName: "save_skill",
      status: input.status,
      lifecycle: input.status === "done" ? "succeeded" : "needs_user_input",
      facts: [
        { label: "动作", value: "保存导演经验" },
        { label: "位置", value: input.path ? "项目 Skills" : "未保存" },
      ],
    },
    {
      id: `skill_save_result_${suffix}`,
      type: "action_result",
      createdAt,
      title: input.title,
      body: input.body,
      toolName: "save_skill",
      status: input.status,
      lifecycle: input.status === "done" ? "succeeded" : "needs_user_input",
      facts: [
        { label: "保存方式", value: input.mode || "未保存" },
        { label: "位置", value: input.path ? "项目 Skills" : "未保存" },
      ],
      details: input.next ? { next: input.next } : undefined,
    },
  ];
  return input.includeUserMessage === false ? entries.slice(1) : entries;
}

function buildSkillSaveConfirmationTimelineEntries(input: {
  userIntent: string;
  skillName: string;
  fileName: string;
  summary: string;
}): VibeAgentTimelineEntry[] {
  const createdAt = new Date().toISOString();
  const suffix = createdAt.replace(/[^a-z0-9]+/gi, "").slice(0, 24).toLowerCase();
  const actionId = `save_skill_${suffix}`;
  return [
    {
      id: `skill_save_user_${suffix}`,
      type: "user_message",
      createdAt,
      title: "你",
      body: input.userIntent,
      status: "done",
    },
    {
      id: `skill_save_draft_${suffix}`,
      type: "assistant_message",
      createdAt,
      title: "AI 导演：导演经验已整理",
      body: `我会把当前做法沉淀成「${input.skillName}」。这只是保存导演经验，不会生成参考或提交视频。`,
      toolName: "save_skill",
      lifecycle: "proposed",
      status: "waiting",
      facts: [
        { label: "名称", value: input.skillName },
        { label: "保存到", value: "项目 Skills" },
        { label: "用途", value: input.summary },
      ],
      details: { next: "确认后保存到项目 Skills。" },
    },
    {
      id: `skill_save_confirm_${suffix}`,
      type: "confirmation_request",
      createdAt,
      title: "保存导演经验？",
      body: `确认后，我会把「${input.skillName}」保存到这个项目的 Skills 里。`,
      toolName: "save_skill",
      actionId,
      lifecycle: "waiting_for_confirmation",
      status: "waiting",
      confirmationRequired: true,
      facts: [
        { label: "动作", value: "保存导演经验" },
        { label: "保存到", value: "项目 Skills" },
        { label: "不会做", value: "不生成参考、不提交视频" },
        { label: "成本", value: "无生成成本" },
      ],
      details: { next: "等你确认后保存。" },
    },
  ];
}

function buildSkillSaveRunningTimelineEntry(input: {
  fileName: string;
  skillName: string;
}): VibeAgentTimelineEntry {
  const createdAt = new Date().toISOString();
  const suffix = createdAt.replace(/[^a-z0-9]+/gi, "").slice(0, 24).toLowerCase() || "now";
  return {
    id: `skill_save_running_${suffix}`,
    type: "tool_call",
    createdAt,
    title: "保存导演经验",
    body: `我正在把「${input.skillName}」保存到项目 Skills。`,
    toolName: "save_skill",
    lifecycle: "running",
    status: "waiting",
    facts: [
      { label: "动作", value: "保存导演经验" },
      { label: "保存到", value: "项目 Skills" },
    ],
    details: { next: "保存完成后会回到消息流。" },
  };
}

function buildSkillSaveCancelledTimelineEntry(input: {
  skillName: string;
}): VibeAgentTimelineEntry {
  const createdAt = new Date().toISOString();
  const suffix = createdAt.replace(/[^a-z0-9]+/gi, "").slice(0, 24).toLowerCase() || "now";
  return {
    id: `skill_save_cancelled_${suffix}`,
    type: "action_result",
    createdAt,
    title: "AI 导演：Skill 保存已暂停",
    body: `这次先不保存「${input.skillName}」。你可以调整说法后再让我沉淀成 Skill。`,
    toolName: "save_skill",
    lifecycle: "cancelled",
    status: "done",
    facts: [
      { label: "动作", value: "暂停保存 Skill" },
      { label: "下一步", value: "调整后再发送" },
    ],
    details: { next: "可以继续改这条导演经验。" },
  };
}

function withProjectGuide(input: DirectorWorkflowInput, projectGuide?: KnowledgePackManifest): DirectorWorkflowInput {
  return {
    ...input,
    knowledgeManifest: projectGuide,
  };
}

const creatorPathSteps = [
  { id: "natural-language", label: "描述修改", detail: "一句话说明" },
  { id: "draft-plan", label: "生成计划", detail: "先看改动" },
  { id: "confirmed-write", label: "确认应用", detail: "加入待处理" },
];

function shortAgentPanelMessageText(value: unknown, fallback = "刚才的输入") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 220 ? `${text.slice(0, 220)}...` : text;
}

type PreparedComposerContext = {
  scopeLabel: string;
  selectionHint: string;
  userIntent: string;
  selectedShotId?: string;
  selectedShotIds?: string[];
  selectedAssetId?: string;
  sectionId?: string;
  videoPermissionContract: AgentVideoPermissionContract;
  qaFeedback?: DirectorQaUserFeedback;
  projectRecordLabel?: string;
  projectImpactLabel?: string;
  projectTaskLabel?: string;
};

type ComposerSelectionOverride = {
  selectedShotId?: string;
  selectedShotIds?: string[];
  selectedAssetId?: string;
  sectionId?: string;
};

function feedbackWithSubmitCheckContext(feedback: string, check?: DirectorQaUserFeedback): string {
  if (!check || check.status === "clear") return feedback;
  return [
    feedback,
    `当前发送前提示：${check.summary}`,
    `建议改法：${check.primaryAction}`,
  ].filter(Boolean).join("\n");
}

function qaFeedbackFacts(feedback?: DirectorQaUserFeedback) {
  if (!feedback || feedback.status === "clear") return [];
  return [
    { label: "检查", value: feedback.title },
    { label: "建议", value: feedback.primaryAction },
    ...feedback.items.slice(0, 2).map((item) => ({
      label: item.severity === "blocker" ? "阻断" : item.severity === "warning" ? "提醒" : "提示",
      value: item.fix,
    })),
  ];
}

function isConcreteLocalAgentAction(action: DirectorAgentActionEnvelope) {
	  return action.kind === "prepare_reference_generation"
	    || action.kind === "prepare_video_submit"
	    || action.kind === "query_video_result"
	    || action.kind === "prepare_export"
    || action.kind === "request_style_research"
    || action.kind === "review_reference_asset"
    || action.kind === "update_shot_strategy"
    || (action.kind === "revise_story_or_shot" && action.proposedChanges.length > 0);
}

function carriesProjectDraftChange(action: DirectorAgentActionEnvelope) {
  return action.proposedChanges.some((change) => change.field === "projectDraft");
}

function agentActionTargetsDiffer(
  localAction: DirectorAgentActionEnvelope,
  stagedAction: DirectorAgentActionEnvelope,
) {
  return localAction.target.kind !== stagedAction.target.kind
    || localAction.target.ids.join("|") !== stagedAction.target.ids.join("|");
}

function choosePreparedAgentAction(
  localAction: DirectorAgentActionEnvelope,
  stagedAction?: DirectorAgentActionEnvelope,
) {
  if (!stagedAction) return localAction;
  if (localAction.kind === "inspect_project_status" && stagedAction.kind !== "inspect_project_status") return localAction;
  if (carriesProjectDraftChange(localAction) && !carriesProjectDraftChange(stagedAction)) return localAction;
  if (localAction.kind === "revise_story_or_shot" && localAction.target.kind === "project" && stagedAction.target.kind !== "project") {
    return localAction;
  }
  if (localAction.kind !== stagedAction.kind && isConcreteLocalAgentAction(localAction)) return localAction;
  if (localAction.kind === stagedAction.kind && isConcreteLocalAgentAction(localAction) && agentActionTargetsDiffer(localAction, stagedAction)) return localAction;
  return stagedAction;
}

function agentVideoPermissionContractForAction(
  action: DirectorAgentActionEnvelope | undefined,
  fallback: AgentVideoPermissionContract,
): AgentVideoPermissionContract {
  if (!action) return fallback;
  const mode = action.executionContract.mode;
  if (mode !== "plan_only" && mode !== "reference_allowed" && mode !== "video_allowed") return fallback;
  return {
    ...fallback,
    mode,
    referenceGenerationAllowed: action.executionContract.referenceGenerationAllowed,
    videoSubmitAllowed: action.executionContract.videoSubmitAllowed,
    reason: action.executionContract.reason || fallback.reason,
  };
}

function handoffMatchesAction(
  handoff: DirectorAgentToolHandoff | undefined,
  action: DirectorAgentActionEnvelope,
) {
  return Boolean(handoff && handoff.actionId === action.actionId);
}

function restoredVideoPermissionContract(
  draft: ProjectAgentStagedPlanDraft,
  fallback: AgentVideoPermissionContract,
): AgentVideoPermissionContract {
  const mode = draft.videoPermissionContract?.mode;
  if (mode !== "plan_only" && mode !== "reference_allowed" && mode !== "video_allowed") return fallback;
  return {
    ...fallback,
    mode,
    referenceGenerationAllowed: Boolean(draft.videoPermissionContract?.referenceGenerationAllowed),
    videoSubmitAllowed: Boolean(draft.videoPermissionContract?.videoSubmitAllowed),
    reason: draft.videoPermissionContract?.reason || fallback.reason,
  };
}

function agentCapabilityItems(
  availability: DirectorAgentToolAvailability,
  contract: AgentVideoPermissionContract,
  projectStatusLabel?: string,
  localProjectReady = availability.projectReady,
) {
  const videoSubmitWaitLabel = videoSubmitBlockerLabel(availability.videoSubmitBlockers?.[0]) || "先准备视频";
  return [
    {
      id: "project",
      label: "项目",
      value: availability.projectReady ? projectStatusLabel || "已连接" : "需要本地项目",
      tone: availability.projectReady ? "ready" : "blocked",
    },
    {
      id: "web-search",
      label: "查资料",
      value: availability.webSearchReady ? "可用" : "设置里开启",
      tone: availability.webSearchReady ? "ready" : "waiting",
    },
    {
      id: "reference",
      label: "生成参考",
      value: !contract.referenceGenerationAllowed
        ? "先整理"
        : !localProjectReady
          ? "先保存项目"
        : availability.referenceGenerationReady
          ? "可用"
          : "先连接图片服务",
      tone: !contract.referenceGenerationAllowed
        ? "blocked"
        : !localProjectReady
          ? "waiting"
        : availability.referenceGenerationReady
          ? "ready"
          : "waiting",
    },
    {
      id: "video",
      label: "发送视频",
      value: !contract.videoSubmitAllowed
        ? "等你允许"
        : !localProjectReady
          ? "先保存项目"
        : availability.videoSubmitReady
          ? "可用"
          : videoSubmitWaitLabel,
      tone: !contract.videoSubmitAllowed
        ? "blocked"
        : !localProjectReady
          ? "waiting"
        : availability.videoSubmitReady
          ? "ready"
          : "waiting",
    },
    {
      id: "export",
      label: "导出",
      value: !localProjectReady ? "先保存项目" : availability.exportReady ? "可用" : "未准备",
      tone: availability.exportReady && localProjectReady ? "ready" : "waiting",
    },
  ];
}

function videoSubmitBlockerLabel(blocker?: string) {
  if (blocker === "video_submit_missing_project") return "先保存项目";
  if (blocker === "video_submit_callback_missing") return "入口不可用";
  if (blocker === "video_submit_missing_references") return "先补参考";
  if (blocker === "video_submit_key_missing") return "先保存 Key";
  if (blocker === "video_submit_already_sent") return "先查结果";
  return "";
}

function videoSubmitBlockerAgentReply(blocker?: string) {
  if (blocker === "video_submit_missing_project") {
    return {
      body: "我还没有拿到本地项目文件夹。先选择或创建项目后，我才能整理素材、补参考和提交视频。",
      next: "先打开或保存项目文件夹。",
    };
  }
  if (blocker === "video_submit_callback_missing") {
    return {
      body: "视频提交入口还不可用。我可以先继续整理故事、参考和 Seedance 请求。",
      next: "先检查运行状态，或继续让我整理项目。",
    };
  }
  if (blocker === "video_submit_missing_references") {
    return {
      body: "现在还不能发视频：这个项目还缺可用的角色、场景或道具参考。先补参考，再提交会更稳。",
      next: "建议先说“补齐参考”，我会整理要生成或绑定的素材。",
    };
  }
  if (blocker === "video_submit_key_missing") {
    return {
      body: "现在还不能发视频：生成服务 Key 还没有准备好。故事和参考可以继续整理，但提交前要先连好服务。",
      next: "先去设置里保存 Key，或继续只做计划。",
    };
  }
  if (blocker === "video_submit_already_sent") {
    return {
      body: "这段视频已经发送过了。现在更适合查询结果或去预览页复核，不要重复提交。",
      next: "建议先查询结果。",
    };
  }
  return undefined;
}

function agentCapabilityGlanceItems(items: ReturnType<typeof agentCapabilityItems>) {
  const attentionItems = items.filter((item) => item.tone !== "ready");
  return (attentionItems.length ? attentionItems : items.filter((item) => item.id !== "project")).slice(0, 3);
}

function agentKernelCapabilityItem(turn: VibeAgentKernelTurn): ReturnType<typeof agentCapabilityItems>[number] {
  const status = turn.executionResult.status;
  if (status === "blocked") {
    return { id: "kernel-turn", label: "本轮", value: "需处理", tone: "blocked" };
  }
  if (status === "awaiting_confirmation") {
    return { id: "kernel-turn", label: "本轮", value: "等确认", tone: "waiting" };
  }
  if (status === "running") {
    return { id: "kernel-turn", label: "本轮", value: "执行中", tone: "waiting" };
  }
  return { id: "kernel-turn", label: "本轮", value: "可继续", tone: "ready" };
}

function intentWithQaRevisionHint(intent: string | undefined, feedback?: DirectorQaUserFeedback) {
  const base = String(intent || "").trim();
  if (!base || !feedback || feedback.status === "clear" || !feedback.primaryAction.trim()) return base;
  const hint = `按发送前检查修改：${feedback.primaryAction.trim()}`;
  return base.includes(hint) ? base : [base, hint].join("\n");
}

function referenceStrategyLabel(value?: ShotRecord["referenceStrategy"]) {
  if (value === "storyboard_rapid_cut") return "故事板快切";
  if (value === "storyboard_narrative") return "故事板叙事";
  if (value === "omni_reference") return "全能参考";
  return "待判断";
}

function assetTypeLabel(value?: AssetRecord["type"]) {
  if (value === "character") return "角色";
  if (value === "scene") return "场景";
  if (value === "prop") return "道具";
  if (value === "style") return "风格";
  return "素材";
}

function selectionContextChips(input: {
  shot?: ShotRecord;
  selectedShots: ShotRecord[];
  asset?: AssetRecord;
  sectionLabel?: string;
}) {
  if (input.selectedShots.length > 1) {
    const shotLabels = input.selectedShots.slice(0, 3).map((item) => formatShotNumber(item.id)).join("、");
    const suffix = input.selectedShots.length > 3 ? ` +${input.selectedShots.length - 3}` : "";
    return [
      { label: "范围", value: `${input.selectedShots.length} 个镜头` },
      { label: "镜头", value: `${shotLabels}${suffix}` },
    ];
  }
  if (input.shot) {
    return [
      { label: "镜头", value: `${formatShotNumber(input.shot.id)} · ${input.shot.title || "未命名"}` },
      { label: "方式", value: referenceStrategyLabel(input.shot.referenceStrategy) },
      input.shot.durationSeconds ? { label: "时长", value: `${input.shot.durationSeconds}s` } : undefined,
    ].filter((item): item is { label: string; value: string } => Boolean(item));
  }
  if (input.asset) {
    return [
      { label: "素材", value: productScopeLabel(input.asset.name || input.asset.id) },
      { label: "类型", value: assetTypeLabel(input.asset.type) },
    ];
  }
  if (input.sectionLabel) {
    return [
      { label: "段落", value: productScopeLabel(input.sectionLabel) },
    ];
  }
  return [];
}

function preparedSelectionContextChips(input: {
  context?: PreparedComposerContext;
  runtimeState: ProjectRuntimeState;
}) {
  const context = input.context;
  if (!context) return [];
  const shotIds = [...new Set([...(context.selectedShotIds || []), context.selectedShotId].filter(Boolean) as string[])];
  if (shotIds.length > 1) {
    const selectedShots = shotIds
      .map((shotId) => input.runtimeState.storyFlow.shots.find((item) => item.id === shotId))
      .filter((shot): shot is ShotRecord => Boolean(shot));
    if (selectedShots.length === shotIds.length) return selectionContextChips({ selectedShots });
    const shotLabels = shotIds.slice(0, 3).map((shotId) => formatShotNumber(shotId)).join("、");
    const suffix = shotIds.length > 3 ? ` +${shotIds.length - 3}` : "";
    return [
      { label: "范围", value: `${shotIds.length} 个镜头` },
      { label: "镜头", value: `${shotLabels}${suffix}` },
    ];
  }
  if (shotIds.length === 1) {
    const selectedShot = input.runtimeState.storyFlow.shots.find((item) => item.id === shotIds[0]);
    if (selectedShot) return selectionContextChips({ shot: selectedShot, selectedShots: [] });
    return [{ label: "镜头", value: formatShotNumber(shotIds[0] || "") }];
  }
  if (context.selectedAssetId) {
    const selectedAsset = input.runtimeState.visualMemory.assets.find((item) => item.id === context.selectedAssetId);
    if (selectedAsset) return selectionContextChips({ asset: selectedAsset, selectedShots: [] });
    return [{ label: "素材", value: productScopeLabel(context.selectedAssetId) }];
  }
  if (context.sectionId) {
    const selectedSection = input.runtimeState.storyFlow.sections.find((item) => item.id === context.sectionId);
    return [{ label: "段落", value: productScopeLabel(selectedSection?.label || context.scopeLabel || context.sectionId) }];
  }
  return [];
}

type ComposerAttachmentKind = "script" | "image" | "audio" | "video" | "file";

type ComposerAttachment = {
  id: string;
  kind: ComposerAttachmentKind;
  file: File;
};

const MAX_COMPOSER_SCRIPT_CHARS = 24_000;

function composerAttachmentKind(file: File): ComposerAttachmentKind {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".srt") || file.type.startsWith("text/")) return "script";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

function composerAttachmentLabel(kind: ComposerAttachmentKind) {
  if (kind === "script") return "脚本";
  if (kind === "image") return "图片";
  if (kind === "audio") return "声音";
  if (kind === "video") return "视频";
  return "文件";
}

function compactAgentScopeLabel(value: string) {
  const cleaned = productScopeLabel(value);
  const parts = cleaned.split(/\s*·\s*/u).map((part) => part.trim()).filter(Boolean);
  const focus = [...parts].reverse().find((part) => /^(正在看|正在等|正在发送|已选择|镜头|素材|段落|整个项目|导出|视频)/u.test(part));
  return focus || parts[parts.length - 1] || cleaned;
}

function compactAgentSelectionHint(value: string) {
  return productScopeLabel(value)
    .replace(/^已选中\s+正在看\s+/u, "正在看 ")
    .replace(/\s+/g, " ")
    .trim();
}

function composerAttachmentUseHint(kind: ComposerAttachmentKind) {
  if (kind === "image") return "用途：作为参考素材，等待 AI 导演归类为角色、场景、道具或镜头参考。";
  if (kind === "audio") return "用途：作为声音参考，等待 AI 导演绑定到角色、旁白或对白。";
  if (kind === "video") return "用途：作为视频参考，等待 AI 导演提取节奏、构图或风格信息。";
  if (kind === "file") return "用途：作为提示词、生成证据或补充材料，等待 AI 导演先整理再确认。";
  return "";
}

async function attachmentIntentLine(attachment: ComposerAttachment) {
  const label = `${composerAttachmentLabel(attachment.kind)}：${attachment.file.name}`;
  if (attachment.kind !== "script") {
    const hint = composerAttachmentUseHint(attachment.kind);
    return [label, hint].filter(Boolean).join("\n");
  }
  try {
    const rawText = (await attachment.file.text()).replace(/\r\n/g, "\n").trim();
    if (!rawText) return `${label}\n内容：（空文件）`;
    const clipped = rawText.length > MAX_COMPOSER_SCRIPT_CHARS
      ? `${rawText.slice(0, MAX_COMPOSER_SCRIPT_CHARS)}\n（后面内容较长，已先读取前 ${MAX_COMPOSER_SCRIPT_CHARS} 字。）`
      : rawText;
    return `${label}\n内容：\n${clipped}`;
  } catch {
    return `${label}\n内容：（读取失败，请直接粘贴脚本正文）`;
  }
}

async function composerIntentFromInput(text: string, attachments: ComposerAttachment[]) {
  const attachmentLines = await Promise.all(attachments.map(attachmentIntentLine));
  return [text.trim(), attachmentLines.join("\n")].filter(Boolean).join("\n");
}

function suggestedIntentFromQaFeedback(feedback?: DirectorQaUserFeedback) {
  if (!feedback || feedback.status === "clear") return "";
  const primaryAction = feedback.primaryAction.trim();
  if (!primaryAction) return "";
  return [
    `按项目检查修复：${primaryAction}`,
    feedback.summary ? `检查结果：${feedback.summary}` : "",
  ].filter(Boolean).join("\n");
}

function suggestedIntentFromStatusInspection(action?: DirectorAgentActionEnvelope, qaFeedback?: DirectorQaUserFeedback) {
  if (!agentActionIsStatusInspection(action)) return "";
  const qaIntent = suggestedIntentFromQaFeedback(qaFeedback);
  if (qaIntent) return qaIntent;
  const readiness = action.sourceContext.projectReadiness;
  const candidates = directorAgentReadinessActions(readiness);
  const nextCandidate = candidates.find((item) => item.priority === "now") || candidates[0];
  return suggestedIntentFromStatusAction(nextCandidate?.label || readiness.nextActionLabel, nextCandidate?.reason || readiness.summary);
}

function suggestedIntentFromStatusAction(label: string, reason?: string) {
  return [`按项目状态继续：${label}`, reason ? `原因：${reason}` : ""].filter(Boolean).join("\n");
}

function agentActionPathStepLabel(priority: DirectorAgentSuggestedAction["priority"]) {
  if (priority === "now") return "现在";
  if (priority === "next") return "接着";
  return "稍后";
}

function agentActionPathItems(action?: DirectorAgentActionEnvelope, qaFeedback?: DirectorQaUserFeedback) {
  if (!agentActionIsStatusInspection(action)) return [];
  const qaIntent = suggestedIntentFromQaFeedback(qaFeedback);
  const qaActionItems = qaIntent
    ? [{
        id: `qa:${qaFeedback?.status}:${qaFeedback?.primaryAction}`,
        step: "现在",
        label: "修复检查项",
        reason: qaFeedback?.summary || "先处理项目检查发现的问题。",
        priority: "now" as DirectorAgentSuggestedAction["priority"],
        intent: qaIntent,
      }]
    : [];
  const readinessItems = directorAgentReadinessActions(action.sourceContext.projectReadiness).map((item) => ({
    id: `${item.priority}:${item.kind}:${item.label}`,
    step: agentActionPathStepLabel(item.priority),
    label: item.label,
    reason: item.reason,
    priority: item.priority,
    intent: suggestedIntentFromStatusAction(item.label, item.reason),
  }));
  return [...qaActionItems, ...readinessItems].slice(0, 3);
}

function agentActionTargetShotIds(action?: DirectorAgentActionEnvelope): string[] {
  if (!action) return [];
  if (action.target.kind !== "shot" && action.target.kind !== "multi_shot") return [];
  return action.target.ids;
}

function agentToolHandlerLabel(handler: DirectorAgentToolHandoff["handler"]) {
  if (handler === "project_vibe_patch") return "改项目";
	  if (handler === "web_search") return "查资料";
	  if (handler === "image2_reference_generation") return "生成参考";
	  if (handler === "seedance_video_submit") return "发送视频";
	  if (handler === "project_export") return "导出";
  return "动作";
}

function agentReviewPrimaryLabel(action?: DirectorAgentActionEnvelope) {
  if (!action) return "确认";
  if (action.status === "blocked") return "需要补充";
  if (agentActionIsStatusInspection(action)) return "继续";
  if (action.kind === "request_style_research") return "确认查资料";
  if (action.kind === "prepare_reference_generation") return "确认生成参考";
	  if (action.kind === "prepare_video_submit") {
	    return action.executionContract.videoSubmitAllowed ? "确认发送" : "确认计划";
	  }
	  if (action.kind === "query_video_result") return "确认查询";
	  if (action.kind === "prepare_export") return "确认导出";
  if (action.kind === "review_reference_asset") return "确认复核";
  if (action.kind === "update_shot_strategy") return "确认方式";
  return "确认修改";
}

function agentActionIsStatusInspection(action?: DirectorAgentActionEnvelope): action is DirectorAgentActionEnvelope & { kind: "inspect_project_status" } {
  return action?.kind === "inspect_project_status";
}

function agentToolRecordLabel(handoff: DirectorAgentToolHandoff) {
  if (handoff.status === "handled_by_project_write") return "已写入项目";
  if (agentToolOnlyNeedsConfirmation(handoff)) return "确认后修改项目";
  if (handoff.status === "ready") return "先保存项目，再执行动作";
  return "已保存计划，动作未开始";
}

function agentShotScopeLabel(shotIds: string[]) {
  if (!shotIds.length) return "整个项目";
  if (shotIds.length === 1) return `镜头 ${formatShotNumber(shotIds[0] || "")}`;
  if (shotIds.length <= 3) return shotIds.map((shotId) => `镜头 ${formatShotNumber(shotId)}`).join("、");
  return `${shotIds.length} 个镜头`;
}

function agentTargetScopeLabel(action?: DirectorAgentActionEnvelope) {
  if (!action) return "整个项目";
  if (action.target.kind === "shot" && action.target.ids[0]) return directorAgentDisplayTargetLabel(action.target, action.sourceContext);
  if (action.target.kind === "multi_shot") return agentShotScopeLabel(action.target.ids);
  return directorAgentDisplayTargetLabel(action.target, action.sourceContext) || "整个项目";
}

function agentToolScopeLabel(handoff: DirectorAgentToolHandoff, action?: DirectorAgentActionEnvelope) {
  const shotIds = handoff.invocation?.selectedShotIds || [];
  if (shotIds.length) return agentShotScopeLabel(shotIds);
  if (handoff.invocation?.targetSummary.label) return handoff.invocation.targetSummary.label;
  return agentTargetScopeLabel(action);
}

function agentToolReceiptLabel(handoff: DirectorAgentToolHandoff) {
  if (handoff.status === "blocked") return "未执行";
  return agentExpectedReceiptLabel(handoff.expectedReceipt);
}

function agentToolFollowUpLabel(handoff: DirectorAgentToolHandoff) {
  if (handoff.status === "handled_by_project_write") return "回到当前镜头检查";
  if (handoff.status === "blocked") return "调整后可重试";
  if (handoff.handler === "web_search") return "保存为参考后再用";
	  if (handoff.handler === "image2_reference_generation") return "去参考区复核";
	  if (handoff.handler === "seedance_video_submit") return "等视频结果";
	  if (handoff.handler === "project_export") return "去交付页查看";
  return "继续下一步";
}

function agentResultViewTarget(handoff?: DirectorAgentToolHandoff): AgentResultViewTarget | undefined {
  if (!handoff) return undefined;
	  if (handoff.handler === "web_search" || handoff.handler === "image2_reference_generation") return { view: "assets", label: "去参考" };
	  if (handoff.handler === "seedance_video_submit") return { view: "preview", label: "去预览" };
	  if (handoff.handler === "project_export") return { view: "export", label: "去交付页" };
  if (handoff.handler === "project_vibe_patch") return { view: "story", label: "回故事" };
  return undefined;
}

function agentToolPreflightLabel(handoff: DirectorAgentToolHandoff) {
  const blockers = handoff.blockers.filter((blocker) => blocker !== "user_confirmation_required");
  if (!blockers.length) return undefined;
  if (blockers.includes("project_not_ready")) return "需要本地项目";
  if (blockers.includes("web_search_not_ready")) return "先开启查资料";
  if (blockers.includes("reference_generation_not_ready")) return "先连接图片服务";
  if (blockers.includes("reference_generation_not_allowed")) return "先整理";
	  if (blockers.includes("video_submit_not_ready")) return "先准备视频";
	  if (blockers.includes("video_submit_not_allowed")) return "当前不能发送";
  if (blockers.includes("export_not_ready")) return "先准备导出";
  if (blockers.includes("agent_action_blocked")) return "等你补充";
  return "先处理阻断";
}

function agentToolHasPreflightBlocker(handoff?: DirectorAgentToolHandoff, action?: DirectorAgentActionEnvelope) {
  const blockers = handoff?.blockers.filter((blocker) => blocker !== "user_confirmation_required") || [];
  if (action?.toolPlan.toolName === "project_vibe_patch") {
    return blockers.some((blocker) => blocker !== "project_not_ready");
  }
  return Boolean(blockers.length);
}

function agentExpectedReceiptLabel(expectedReceipt: DirectorAgentToolHandoff["expectedReceipt"]) {
  if (expectedReceipt === "web_research_reference_receipt") return "资料已保存";
	  if (expectedReceipt === "image_reference_receipt") return "参考已保存";
	  if (expectedReceipt === "video_submit_receipt") return "视频已留档";
	  if (expectedReceipt === "export_receipt") return "交付已留档";
  return "项目已保存";
}

function agentExecutionModeLabel(action: DirectorAgentActionEnvelope) {
  if (action.executionContract.mode === "plan_only") return "先整理";
  if (action.executionContract.mode === "reference_allowed") return "生成参考";
  return "提交视频";
}

function agentConfirmedProjectWriteLabel(
  action: DirectorAgentActionEnvelope,
  handoff?: DirectorAgentToolHandoff,
  planPhase?: AgentPlanPhase,
) {
  if (agentActionIsStatusInspection(action)) return "不写入项目";
  if (planPhase === "confirmed") {
    if (handoff?.status === "blocked") return "项目已保留";
    return "已写入项目";
  }
  if (action.status === "blocked") return "不会写入";
  return "确认后写入";
}

function agentActionScopeLabel(
  action: DirectorAgentActionEnvelope,
  handoff?: DirectorAgentToolHandoff,
  planPhase?: AgentPlanPhase,
) {
  if (planPhase === "confirmed" && handoff?.invocation?.selectedShotIds.length) return agentShotScopeLabel(handoff.invocation.selectedShotIds);
  return agentTargetScopeLabel(action);
}

function agentNextControlledStepLabel(
  action: DirectorAgentActionEnvelope,
  handoff?: DirectorAgentToolHandoff,
  planPhase?: AgentPlanPhase,
) {
  if (agentActionIsStatusInspection(action)) return action.sourceContext.projectReadiness.nextActionLabel;
  if (action.status === "blocked") return "等你补充";
  if (planPhase === "confirmed" && handoff?.status === "blocked") return "暂不执行";
	  if (planPhase !== "confirmed" && handoff?.status === "blocked") {
	    const preflightLabel = agentToolPreflightLabel(handoff);
	    if (preflightLabel) return preflightLabel;
	  }
	  if (action.kind === "query_video_result") return "查询视频";
	  if (action.toolPlan.toolName === "project_vibe_patch") return "写入项目";
  return agentToolHandlerLabel(action.toolPlan.toolName);
}

function agentActionConfirmationFacts(
  action?: DirectorAgentActionEnvelope,
  handoff?: DirectorAgentToolHandoff,
  planPhase?: AgentPlanPhase,
) {
  if (!action) return [];
  if (agentActionIsStatusInspection(action)) {
    return [
      { label: "读取", value: action.sourceContext.projectTitle },
      { label: "状态", value: action.sourceContext.projectReadiness.summary },
      { label: "下一步", value: action.sourceContext.projectReadiness.nextActionLabel },
      { label: "写入", value: "不写入项目" },
    ];
  }
  const targetScope = agentActionScopeLabel(action, handoff, planPhase);
  return [
    { label: "写入", value: agentConfirmedProjectWriteLabel(action, handoff, planPhase) },
    { label: "下一步", value: agentNextControlledStepLabel(action, handoff, planPhase) },
    { label: "范围", value: targetScope },
    { label: "边界", value: agentExecutionModeLabel(action) },
    { label: "结果", value: planPhase === "confirmed" && handoff ? agentToolReceiptLabel(handoff) : agentExpectedReceiptLabel(action.toolPlan.expectedReceipt) },
  ];
}

function agentExecutionTraceItems(
  action?: DirectorAgentActionEnvelope,
  handoff?: DirectorAgentToolHandoff,
  planPhase?: AgentPlanPhase,
) {
  if (!action) return [];
  const scopeLabel = agentActionScopeLabel(action, handoff, planPhase);
  const stagedChangeCount = action.proposedChanges.length;
  if (agentActionIsStatusInspection(action)) {
    return [
      {
        label: "读项目",
        value: `${action.sourceContext.projectTitle} · ${scopeLabel}`,
        tone: "done",
      },
      {
        label: "检查",
        value: action.sourceContext.projectReadiness.summary,
        tone: "done",
      },
      {
        label: "修改项目",
        value: "不写入项目",
        tone: "done",
      },
      {
        label: "下一步",
        value: action.sourceContext.projectReadiness.nextActionLabel,
        tone: "waiting",
      },
    ];
  }
  return [
    {
      label: "读项目",
      value: `${action.sourceContext.projectTitle} · ${scopeLabel}`,
      tone: "done",
    },
    {
      label: "暂存",
      value: action.status === "blocked"
        ? "需要补充"
        : stagedChangeCount > 0
          ? `${stagedChangeCount} 条改动`
          : agentToolHandlerLabel(action.toolPlan.toolName),
      tone: action.status === "blocked" ? "blocked" : "done",
    },
    {
      label: "修改项目",
      value: agentConfirmedProjectWriteLabel(action, handoff, planPhase),
      tone: action.status === "blocked"
        ? "blocked"
        : planPhase === "confirmed"
          ? "done"
          : "waiting",
    },
    {
      label: "下一步",
      value: agentNextControlledStepLabel(action, handoff, planPhase),
      tone: action.status === "blocked" || handoff?.status === "blocked"
        ? "blocked"
        : planPhase === "confirmed"
          ? "done"
          : "waiting",
    },
  ];
}

function creatorFacingActionLogText(value: string | undefined, fallback = "动作失败，项目已保留，可以稍后重试。") {
  const cleaned = (value || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  if (/\b(?:ReferenceError|TypeError|SyntaxError|Unhandled|Cannot read properties|Cannot access)\b/i.test(cleaned)) return fallback;
  if (/\b[a-zA-Z_$][\w$]* is not defined\b/.test(cleaned)) return fallback;
  if (/\bat\s+[a-zA-Z_$][\w$.[\]]+\s*\(/.test(cleaned)) return fallback;
  return cleaned;
}

function agentActionFieldLabel(field: string) {
  if (field === "projectStatus") return "项目状态";
  if (field === "referenceStatus") return "参考状态";
  if (field === "nextActions") return "后续动作";
  if (field === "referenceStrategy") return "生成方式";
  if (field === "knowledgeReferences") return "资料参考";
  if (field === "referenceAssets") return "参考素材";
  if (field === "assetStatus") return "素材状态";
  if (field === "assetRoleBinding") return "素材用途";
  if (field === "videoQueue") return "视频队列";
  if (field === "reviewTray") return "复核内容";
  if (field === "storyDraft") return "故事草案";
  if (field === "exportPackage") return "导出包";
  if (field === "selectedScopeDraft") return "当前选择";
  if (field === "projectDraft") return "项目草案";
  return field;
}

function agentActionDiffs(action?: DirectorAgentActionEnvelope) {
  if (agentActionIsStatusInspection(action)) return [];
  return (action?.proposedChanges || []).map((change) => ({
    label: agentActionFieldLabel(change.field),
    value: change.from ? `${change.from} -> ${change.to}` : change.to,
    reason: change.reason,
  }));
}

function creatorProjectTaskLabel(value?: string) {
  if (!value) return undefined;
  if (value.includes("有内容待补后入队")) return "生成参考后继续";
  if (value.includes("有内容待补")) return "先生成参考";
  if (value.includes("不用再执行")) return "写入项目";
  return value;
}

function agentStatusInspectionFacts(action?: DirectorAgentActionEnvelope) {
  if (action?.kind !== "inspect_project_status") return [];
  return action.proposedChanges.map((change) => ({
    label: agentActionFieldLabel(change.field),
    value: change.to,
  }));
}

function confirmedAgentResultFacts(run?: PrototypeAgentDemoRun, handoff?: DirectorAgentToolHandoff, action?: DirectorAgentActionEnvelope) {
  const result = run?.result;
  const resultHasError = run?.status === "error" || result?.status === "error";
  const facts: Array<{ label: string; value: string }> = [];
  if (result) {
    facts.push({
      label: "结果",
      value: result.projectRestored
        ? result.storageLabel || "已恢复项目"
        : result.projectSaved
        ? result.storageLabel || "已保存到项目"
        : result.projectVibeAdded
          ? result.storageLabel || "已写入，保存待重试"
          : "还未写入",
    });
    if (result.projectImpactLabel) facts.push({ label: "影响", value: result.projectImpactLabel });
    else if (handoff) facts.push({ label: "范围", value: agentToolScopeLabel(handoff, action) });
    const projectTaskLabel = creatorProjectTaskLabel(result.projectTaskLabel);
    if (projectTaskLabel) facts.push({ label: "待处理", value: projectTaskLabel });
    if (resultHasError) facts.push({ label: "下一步", value: handoff ? agentConfirmedResultNextStep(handoff, run) : "调整后可重试" });
    else if (result.previewReady) facts.push({ label: "下一步", value: "去预览复核" });
    else if (result.waitingReview) facts.push({ label: "下一步", value: "去复核" });
  }
  if (handoff) {
    if (!facts.some((fact) => fact.label === "范围" || fact.label === "影响")) {
      facts.push({ label: "范围", value: agentToolScopeLabel(handoff, action) });
    }
    if (!facts.some((fact) => fact.label === "下一步")) {
      facts.push({ label: "下一步", value: agentConfirmedResultNextStep(handoff, run) });
    }
  }
  return facts.slice(0, 4);
}

function agentConfirmedResultNextStep(handoff: DirectorAgentToolHandoff, run?: PrototypeAgentDemoRun) {
  const result = run?.result;
  if (run?.status === "error" || result?.status === "error") return "调整后可重试";
  if (result?.previewReady) return "去预览确认";
  if (handoff.handler === "web_search") return "保存为参考后再用";
  if (handoff.handler === "image2_reference_generation") {
    return result?.status === "running" ? "去参考区看进度" : "去参考区复核";
  }
	  if (handoff.handler === "seedance_video_submit") {
	    return result?.status === "running" ? "等视频结果" : "去预览确认";
	  }
  if (handoff.handler === "project_export") {
    return result?.status === "running" ? "等导出完成" : "去交付页查看";
  }
  return agentToolFollowUpLabel(handoff);
}

type ConfirmedAgentToolRunOutcome = VibeAgentConfirmedToolRunOutcome;

type AgentActionLogItem = ProjectAgentActionLogItem;
type AgentResultViewTarget = NonNullable<AgentActionLogItem["resultView"]>;

function agentProjectRecordResultFacts(previewResult?: PreviewPrototypeAgentDemoResult) {
  return {
    projectRecordLabel: previewResult?.projectRecordLabel,
    projectImpactLabel: previewResult?.projectImpactLabel,
    projectTaskLabel: previewResult?.projectTaskLabel,
  };
}

function confirmedToolRunResult(
  handoff?: DirectorAgentToolHandoff,
  toolRunOutcome?: ConfirmedAgentToolRunOutcome,
  previewResult?: PreviewPrototypeAgentDemoResult,
): PrototypeAgentDemoRun {
  const projectRecordFacts = agentProjectRecordResultFacts(previewResult);
  if (toolRunOutcome?.status === "failed" || toolRunOutcome?.status === "blocked") {
    return {
      status: "error",
      result: {
        label: toolRunOutcome.label,
        projectVibeAdded: toolRunOutcome.projectRecordPreserved,
        projectSaved: toolRunOutcome.projectRecordPreserved,
        storageLabel: toolRunOutcome.projectRecordPreserved ? "项目已保留" : undefined,
        ...projectRecordFacts,
        waitingReview: true,
        previewReady: false,
        status: "error",
      },
    };
  }
  if (handoff?.status === "handled_by_project_write") {
    return {
      status: "ready",
      result: {
        label: "修改已写入项目",
        projectVibeAdded: true,
        projectSaved: true,
        ...projectRecordFacts,
        waitingReview: false,
        previewReady: false,
        status: "ready",
      },
    };
  }
  if (!handoff || handoff.status !== "ready") {
    return {
      status: "preview_ready",
      result: { projectVibeAdded: true, ...projectRecordFacts, waitingReview: true, previewReady: true },
    };
  }
  if (handoff.handler === "web_search") {
    return {
      status: "ready",
      result: {
        label: "资料已整理，等你确认",
        projectVibeAdded: true,
        projectSaved: true,
        ...projectRecordFacts,
        waitingReview: false,
        previewReady: false,
        status: "ready",
      },
    };
  }
  if (handoff.handler === "image2_reference_generation") {
    const label = toolRunOutcome?.status === "completed" ? toolRunOutcome.label : "参考任务已启动";
    return {
      status: toolRunOutcome?.resultStatus || "running",
      result: {
        label,
        projectVibeAdded: true,
        projectSaved: true,
        ...projectRecordFacts,
        waitingReview: toolRunOutcome?.waitingReview ?? true,
        previewReady: toolRunOutcome?.previewReady ?? false,
        status: toolRunOutcome?.resultStatus || "running",
      },
    };
  }
	  if (handoff.handler === "seedance_video_submit") {
	    const label = toolRunOutcome?.status === "completed" ? toolRunOutcome.label : "视频已发送，排队后回到预览";
	    return {
      status: toolRunOutcome?.resultStatus || "running",
      result: {
        label,
        projectVibeAdded: true,
        projectSaved: true,
        ...projectRecordFacts,
        waitingReview: toolRunOutcome?.waitingReview ?? false,
        previewReady: toolRunOutcome?.previewReady ?? false,
        status: toolRunOutcome?.resultStatus || "running",
	      },
	    };
	  }
  if (handoff.handler === "project_export") {
    return {
      status: toolRunOutcome?.resultStatus || "running",
      result: {
        label: toolRunOutcome?.label || "导出已开始",
        projectVibeAdded: true,
        projectSaved: true,
        ...projectRecordFacts,
        waitingReview: false,
        previewReady: false,
        status: toolRunOutcome?.resultStatus || "running",
      },
    };
  }
  return {
    status: "ready",
    result: {
      label: agentToolResultLabel(handoff),
      projectVibeAdded: true,
      projectSaved: true,
      ...projectRecordFacts,
      waitingReview: false,
      previewReady: false,
      status: "ready",
    },
  };
}

function agentActionLogItemFromResult(
  action: DirectorAgentActionEnvelope,
  handoff: DirectorAgentToolHandoff | undefined,
  run: PrototypeAgentDemoRun,
  planPhase: AgentPlanPhase,
): AgentActionLogItem {
  const resultLabel = run.result?.label || (handoff ? agentToolResultLabel(handoff) : action.userFacingMessage);
  const blocked = action.status === "blocked" || run.status === "error" || run.result?.status === "error";
  const running = run.status === "running" || run.result?.status === "running";
  const title = creatorFacingActionLogText(action.summary || agentToolHandlerLabel(action.toolPlan.toolName), "刚才的动作");
  const scope = creatorFacingActionLogText(agentActionScopeLabel(action, handoff, planPhase), "当前项目");
  const nextStep = creatorFacingActionLogText(
    handoff ? agentConfirmedResultNextStep(handoff, run) : agentNextControlledStepLabel(action, handoff, planPhase),
    "调整后可重试",
  );
  const safeResultLabel = creatorFacingActionLogText(resultLabel, blocked ? "动作失败，项目已保留，可以稍后重试。" : "已完成");
  const resultView = blocked ? undefined : agentResultViewTarget(handoff);
  return {
    id: action.actionId,
    title,
    scope,
    result: safeResultLabel,
    nextStep,
    resultView,
    followUpIntent: [
      `继续刚才的动作：${title}`,
      `范围：${scope}`,
      `结果：${safeResultLabel}`,
      `下一步：${nextStep}`,
      "我想调整：",
    ].join("\n"),
    tone: blocked ? "blocked" : running ? "waiting" : "done",
    createdAt: new Date().toISOString(),
  };
}

function rememberAgentActionLogItem(
  items: AgentActionLogItem[],
  nextItem: AgentActionLogItem,
) {
  return [nextItem, ...items.filter((item) => item.id !== nextItem.id)].slice(0, 4);
}

function agentActionLogKey(items: AgentActionLogItem[] | undefined) {
  return (items || []).map((item) => `${item.id}:${item.createdAt}`).join("|");
}

function minimalAgentMessageFromActionLogItem(item: AgentActionLogItem): MinimalAgentMessage {
  const displayTitle = creatorFacingActionLogText(item.title, "刚才的动作");
  const displayScope = creatorFacingActionLogText(item.scope, "当前项目");
  const displayResult = creatorFacingActionLogText(item.result);
  const displayNextStep = creatorFacingActionLogText(item.nextStep, "调整后可重试");
  return {
    id: `action_log_message_${item.id}_${item.createdAt}`,
    entryType: "action_result",
    role: "tool",
    title: displayTitle,
    body: displayResult,
    lifecycle: item.tone === "blocked" ? "needs_user_input" : item.tone === "waiting" ? "running" : "succeeded",
    status: item.tone === "blocked" ? "blocked" : item.tone === "waiting" ? "waiting" : "done",
    facts: [
      { label: "范围", value: displayScope },
      { label: "下一步", value: displayNextStep },
    ],
    resultView: item.resultView?.view,
    next: displayNextStep,
  };
}

function agentTimelineKey(entries: VibeAgentTimelineEntry[] | undefined) {
  return (entries || []).map((entry) => `${entry.id}:${entry.createdAt}`).join("|");
}

function agentStoryFlowKey(shots: ShotRecord[]) {
  return shots.map((item) => [
    item.id,
    item.title,
    item.primaryAction,
  ].filter(Boolean).join(":")).join("|");
}

export function MinimalAgentPanel({
  runtimeState,
  projectScopeLabel,
  projectStatusLabel,
  currentView,
  localProjectReady = true,
  localProjectBusy = false,
  canCreateLocalProject = false,
  shot,
  selectedShots = [],
  asset,
  sectionLabel,
  sectionId,
  onProjectStoreApplyPlanReady,
  latestPrototypeAgentDemo,
  onPreviewPrototypeAgentDemo,
  realSampleAction,
  endFrameAction,
  videoSendAction,
  webSearchSettings = defaultAgentWebSearchSettings,
  webSearchReady,
  projectReferenceGuide,
  restoredAgentStagedPlanDraft,
  restoredAgentActionLog,
  restoredAgentTimelineEntries,
  onStagePrototypeAgentPlan,
  onRememberAgentActionLogItem,
  onRememberAgentTimelineEntries,
  onSaveResearchAsReference,
  onCreateP6RealSample,
  onCreateImage2EndFrame,
  onCreateLocalProject,
  onStartNewVideoDraftFromAgent,
  onContinueNewVideoDraftFromAgent,
  onConfirmNewVideoDraftFromAgent,
  newVideoDraftPendingForAgent = false,
  newVideoDraftPlanningForAgent = false,
  newVideoDraftReadyForAgent = false,
  onSendSeedanceVideo,
  onRunExport,
  onOpenResultView,
  onRetryMissingBatch,
  onSelectShot,
  agentCommand,
  projectObservation,
  projectStatusView,
  videoPermissionContract,
  onVideoPermissionContractChange,
  storyboardProjectPlanInput,
  onDirectorFeedbackConfirmed,
  onPendingAgentActionChange,
}: {
  runtimeState: ProjectRuntimeState;
  projectScopeLabel?: string;
  projectStatusLabel?: string;
  currentView?: DirectorView;
  localProjectReady?: boolean;
  localProjectBusy?: boolean;
  canCreateLocalProject?: boolean;
  shot?: ShotRecord;
  selectedShots?: ShotRecord[];
  asset?: AssetRecord;
  sectionLabel?: string;
  sectionId?: string;
  onProjectStoreApplyPlanReady?: (plan: ProjectFactsStagedApplyPlan) => void;
  latestPrototypeAgentDemo?: PrototypeAgentDemoRun;
  onPreviewPrototypeAgentDemo?: (input: PreviewPrototypeAgentDemoInput) => PreviewPrototypeAgentDemoResult | void | Promise<PreviewPrototypeAgentDemoResult | void>;
  onStagePrototypeAgentPlan?: (input: StagePrototypeAgentPlanInput) => StagePrototypeAgentPlanResult | void | Promise<StagePrototypeAgentPlanResult | void>;
  realSampleAction?: {
    keyConfigured: boolean;
    status: "idle" | "running" | "blocked" | "needs_review" | "verified";
    message?: string;
    disabled?: boolean;
  };
  endFrameAction?: {
    keyConfigured: boolean;
    status: "idle" | "running" | "blocked" | "needs_review" | "verified";
    message?: string;
    disabled?: boolean;
  };
  videoSendAction?: {
    keyConfigured: boolean;
    status: "idle" | "running" | "blocked" | "submitted" | "needs_review";
    message?: string;
    disabled?: boolean;
    ready?: boolean;
    canResume?: boolean;
    suggestedActionLabel?: string;
    qaFeedback?: DirectorQaUserFeedback;
    recoveryTargetShotIds?: string[];
  };
  webSearchSettings?: AgentWebSearchSettings;
  webSearchReady?: boolean;
  projectReferenceGuide?: KnowledgePackManifest;
  restoredAgentStagedPlanDraft?: ProjectAgentStagedPlanDraft;
  restoredAgentActionLog?: ProjectAgentActionLogItem[];
  restoredAgentTimelineEntries?: VibeAgentTimelineEntry[];
  onRememberAgentTimelineEntries?: (entries: VibeAgentTimelineEntry[]) => void | Promise<void>;
  onSaveResearchAsReference?: (input: {
    result: AgentWebSearchResult;
    userIntent: string;
  }) => KnowledgePack | Promise<KnowledgePack>;
  onRememberAgentActionLogItem?: (item: ProjectAgentActionLogItem) => void | Promise<void>;
  onCreateLocalProject?: () => unknown | Promise<unknown>;
  onStartNewVideoDraftFromAgent?: (userIntent: string) => unknown | Promise<unknown>;
  onContinueNewVideoDraftFromAgent?: () => unknown | Promise<unknown>;
  onConfirmNewVideoDraftFromAgent?: () => unknown | Promise<unknown>;
  newVideoDraftPendingForAgent?: boolean;
  newVideoDraftPlanningForAgent?: boolean;
  newVideoDraftReadyForAgent?: boolean;
  onCreateP6RealSample?: (target?: AgentControlledToolInvocationTarget) => unknown | Promise<unknown>;
  onCreateImage2EndFrame?: () => void | Promise<void>;
  onSendSeedanceVideo?: (target?: AgentControlledToolInvocationTarget) => unknown | Promise<unknown>;
  onRunExport?: (target?: Pick<AgentControlledToolInvocationTarget, "agentToolTrace">) => unknown | Promise<unknown>;
  onOpenResultView?: (view: DirectorView) => void;
  onRetryMissingBatch?: () => unknown | Promise<unknown>;
  onSelectShot?: (id: string, additive?: boolean) => void;
  agentCommand?: CreatorAgentCommand;
  projectObservation?: ProjectObservationProjection;
  projectStatusView?: ProjectStatusViewModel;
  videoPermissionContract?: AgentVideoPermissionContract;
  onVideoPermissionContractChange?: (contract: AgentVideoPermissionContract) => void;
  storyboardProjectPlanInput?: StoryboardReferenceProjectPlannerInput;
  onDirectorFeedbackConfirmed?: (recompile: DirectorFeedbackRecompileResult) => void | Promise<void>;
  onPendingAgentActionChange?: (pending: boolean) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const agentThreadRef = useRef<HTMLElement>(null);
  const previousSelectionFocusKeyRef = useRef("");
  const previousRuntimeProjectKeyRef = useRef("");
  const restoredAgentDraftIdRef = useRef("");
  const restoredAgentLogKeyRef = useRef("");
  const restoredAgentTimelineKeyRef = useRef("");
  const committedNewVideoDraftResetKeyRef = useRef("");
  const resumeAgentAfterLocalProjectSetupRef = useRef(false);
  const savedSkillStackProjectKeyRef = useRef("");
  const [text, setText] = useState("");
  // File objects in React state can cause memory leaks; consider using a ref or blob URL instead
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [status, setStatus] = useState("等待输入");
  const [planPhase, setPlanPhase] = useState<AgentPlanPhase>("idle");
  const [localPrototypeAgentDemo, setLocalPrototypeAgentDemo] = useState<PrototypeAgentDemoRun | undefined>();
  const [workflow, setWorkflow] = useState<ReturnType<typeof buildDirectorWorkflowState> | undefined>();
  const [projection, setProjection] = useState<MinimalRuntimeProjection | undefined>();
  const [feedbackRecompile, setFeedbackRecompile] = useState<DirectorFeedbackRecompileResult | undefined>();
  const [researchResult, setResearchResult] = useState<AgentWebSearchResult | undefined>();
  const [researchStatus, setResearchStatus] = useState<"idle" | "running" | "ready" | "blocked">("idle");
  const [advancedControlsOpen, setAdvancedControlsOpen] = useState(false);
  const [generationDetailsOpen, setGenerationDetailsOpen] = useState(false);
  const [referenceStatus, setReferenceStatus] = useState<"idle" | "saving" | "saved" | "blocked">("idle");
  const [isPreparingPlan, setIsPreparingPlan] = useState(false);
  const [isRetryingTool, setIsRetryingTool] = useState(false);
  const [isComposerCollapsed, setIsComposerCollapsed] = useState(false);
  const [preparedContext, setPreparedContext] = useState<PreparedComposerContext | undefined>();
  const [agentActionEnvelope, setAgentActionEnvelope] = useState<DirectorAgentActionEnvelope | undefined>();
  const [agentToolHandoff, setAgentToolHandoff] = useState<DirectorAgentToolHandoff | undefined>();
  const [agentTimelineEntries, setAgentTimelineEntries] = useState<VibeAgentTimelineEntry[]>([]);
  const [latestAgentKernelTurn, setLatestAgentKernelTurn] = useState<VibeAgentKernelTurn | undefined>();
  const [agentActionLog, setAgentActionLog] = useState<AgentActionLogItem[]>([]);
  const [savedSkillStack, setSavedSkillStack] = useState<DirectorSkillStackItem[]>([]);
  const [pendingSkillSaveRequest, setPendingSkillSaveRequest] = useState<{
    userIntent: string;
    card: DirectorSkillCardDraft;
    fileName: string;
  } | undefined>();
  const [localVideoPermissionContract, setLocalVideoPermissionContract] = useState<AgentVideoPermissionContract>(
    videoPermissionContract || defaultAgentVideoPermissionContract,
  );
  const scopedShotIds = selectedShots.map((item) => item.id);
  const scopedShotKey = scopedShotIds.join("|");
  const localScopeLabel = selectedScopeLabel(shot, asset, sectionLabel, selectedShots);
  const scopeLabel = projectScopeLabel ? `${productScopeLabel(projectScopeLabel)} · ${localScopeLabel}` : localScopeLabel;
  const hasBoundSelection = Boolean(scopedShotIds.length || shot || asset);
  const hasMultiShotSelection = scopedShotIds.length > 1;
  const hasSectionSelection = Boolean(sectionId && !scopedShotIds.length && !asset);
  const hasActiveSelection = hasBoundSelection || hasSectionSelection;
  const currentSelectedShotId = scopedShotIds.length === 1 ? scopedShotIds[0] : shot?.id;
  const selectionHint = hasMultiShotSelection
    ? `已选中 ${localScopeLabel}。直接说这些镜头哪里不顺。`
    : shot
      ? `已选中 ${localScopeLabel}。直接说这一段怎么改。`
      : asset
        ? `已选中 ${localScopeLabel}。直接说这个素材怎么改。`
        : hasSectionSelection
          ? `已选中 ${localScopeLabel}。直接说这一段故事怎么改。`
          : "写脚本、提需求，或点一段再说修改。";
  const baseDisplayedScopeLabel = workflow ? preparedContext?.scopeLabel || scopeLabel : scopeLabel;
  const baseDisplayedSelectionHint = workflow ? preparedContext?.selectionHint || selectionHint : selectionHint;
  const inputPlaceholder = hasActiveSelection
    ? "说这块怎么改..."
    : "写脚本、提需求，或拖入图片/声音参考/文档。";
  const liveSelectionChips = selectionContextChips({
    shot,
    selectedShots,
    asset,
    sectionLabel: hasSectionSelection ? sectionLabel : undefined,
  });
  const agentShotSwitcherItems = useMemo(() => {
    if (!onSelectShot) return [];
    return runtimeState.storyFlow.shots.slice(0, 12).map((item) => ({
      id: item.id,
      label: formatShotNumber(item.id),
      title: shortAgentPanelMessageText(
        cleanMinimalAgentMessageCopy(item.title || item.primaryAction || item.storyFunction || ""),
        formatShotNumber(item.id),
      ),
    }));
  }, [onSelectShot, runtimeState.storyFlow.shots]);

  function rememberConfirmedAgentActionLogItem(item: AgentActionLogItem) {
    setAgentActionLog((items) => rememberAgentActionLogItem(items, item));
    void onRememberAgentActionLogItem?.(item);
  }
  const preparedSelectionChips = preparedSelectionContextChips({ context: preparedContext, runtimeState });
  const selectionFocusKey = [scopedShotKey, shot?.id, asset?.id, sectionId].filter(Boolean).join("::");
  const latestNewVideoDraftCommittedForProjection = isCommittedNewVideoDraftAgentRun(latestPrototypeAgentDemo);
  const currentStoryFlowKey = agentStoryFlowKey(runtimeState.storyFlow.shots);
  const prototypeAgentDemo = latestNewVideoDraftCommittedForProjection
    ? latestPrototypeAgentDemo
    : planPhase === "confirmed" && localPrototypeAgentDemo
      ? localPrototypeAgentDemo
      : latestPrototypeAgentDemo || localPrototypeAgentDemo;
  const prototypeAgentProjection = buildPrototypeAgentDemoProjection(prototypeAgentDemo);
  const realSampleBusy = realSampleAction?.status === "running";
  const endFrameBusy = endFrameAction?.status === "running";
  const videoBusy = videoSendAction?.status === "running";
  const videoSubmitCancelled = videoSendAction?.status === "blocked" && /已取消，本次没有发送/.test(videoSendAction.message || "");
  const videoSubmissionBlocked = videoSendAction?.status === "blocked" && !videoSubmitCancelled;
  const videoBlockedRecoveryIntent = videoSubmissionBlocked ? videoBlockerRecoveryIntent(videoSendAction?.message) : "";
  const videoBlockedRecoveryTargetShots = (videoSendAction?.recoveryTargetShotIds || [])
    .map((shotId) => runtimeState.storyFlow.shots.find((item) => item.id === shotId))
    .filter((item): item is ShotRecord => Boolean(item));
  const videoBlockedRecoveryScopedIntent = videoBlockedRecoveryIntent && videoBlockedRecoveryTargetShots.length === 1
    ? `镜头 ${formatShotNumber(videoBlockedRecoveryTargetShots[0].id)} ${videoBlockedRecoveryTargetShots[0].title}：${videoBlockedRecoveryIntent}`
    : videoBlockedRecoveryIntent;
  const videoCanResume = Boolean(videoSendAction?.canResume);
  const videoAlreadySent = (videoSendAction?.status === "submitted" && !videoCanResume) || videoSendAction?.status === "needs_review";
  const runtimeProjectKey = [
    runtimeState.project.root ? `root:${runtimeState.project.root}` : "",
    runtimeState.sourceIndexSummary.projectId ? `id:${runtimeState.sourceIndexSummary.projectId}` : "",
  ].filter(Boolean).join("::") || `title:${runtimeState.project.title || "unbound"}`;
  useEffect(() => {
    if (latestNewVideoDraftCommittedForProjection && localPrototypeAgentDemo) {
      setLocalPrototypeAgentDemo(undefined);
    }
  }, [latestNewVideoDraftCommittedForProjection, localPrototypeAgentDemo]);
  useEffect(() => {
    if (!latestNewVideoDraftCommittedForProjection || !currentStoryFlowKey) return;
    const nextResetKey = `${runtimeProjectKey}:${currentStoryFlowKey}`;
    if (committedNewVideoDraftResetKeyRef.current === nextResetKey) return;
    committedNewVideoDraftResetKeyRef.current = nextResetKey;
    setWorkflow(undefined);
    setProjection(undefined);
    setFeedbackRecompile(undefined);
    setPreparedContext(undefined);
    setAgentActionEnvelope(undefined);
    setAgentToolHandoff(undefined);
    setPlanPhase("idle");
    setAgentTimelineEntries([]);
    setAgentActionLog([]);
    restoredAgentLogKeyRef.current = "new_video_draft_committed";
    restoredAgentTimelineKeyRef.current = "new_video_draft_committed";
  }, [currentStoryFlowKey, latestNewVideoDraftCommittedForProjection, runtimeProjectKey]);
  useEffect(() => {
    if (!latestNewVideoDraftCommittedForProjection || text.trim() || attachments.length) return;
    setStatus("故事已保存到项目");
  }, [attachments.length, latestNewVideoDraftCommittedForProjection, text]);
  useEffect(() => {
    let cancelled = false;
    async function loadSkillStack() {
      const projectRoot = runtimeState.project.root?.trim();
      const bridge = typeof window !== "undefined" ? window.vibeRuntime : undefined;
      if (projectRoot && bridge?.sandboxReadFile) {
        try {
          const indexPath = `${projectRoot.replace(/\/+$/g, "")}/${DIRECTOR_SKILL_STACK_INDEX_PATH}`;
          const result = await bridge.sandboxReadFile(indexPath);
          const parsedIndex = parseDirectorSkillStackIndex(result.content);
          if (!cancelled && parsedIndex.skills.length > 0) {
            savedSkillStackProjectKeyRef.current = runtimeProjectKey;
            setSavedSkillStack(parsedIndex.skills);
            return;
          }
        } catch {
          // Missing skill-index.json is a normal state for a fresh project.
        }
      }
      if (typeof window !== "undefined" && window.localStorage) {
        const content = window.localStorage.getItem(browserSkillIndexStorageKey(runtimeProjectKey));
        if (!cancelled) {
          if (content) {
            savedSkillStackProjectKeyRef.current = runtimeProjectKey;
            setSavedSkillStack(parseDirectorSkillStackIndex(content).skills);
          } else if (savedSkillStackProjectKeyRef.current !== runtimeProjectKey) {
            savedSkillStackProjectKeyRef.current = runtimeProjectKey;
            setSavedSkillStack([]);
          }
        }
        return;
      }
      if (!cancelled && savedSkillStackProjectKeyRef.current !== runtimeProjectKey) {
        savedSkillStackProjectKeyRef.current = runtimeProjectKey;
        setSavedSkillStack([]);
      }
    }
    void loadSkillStack();
    return () => {
      cancelled = true;
    };
  }, [runtimeProjectKey, runtimeState.project.root]);
  const hasPreparedAgentState = Boolean(
    workflow
    || projection
    || feedbackRecompile
    || preparedContext
    || agentActionEnvelope
    || agentToolHandoff
    || localPrototypeAgentDemo
  );
  const hasComposerDraft = Boolean(text.trim() || attachments.length);
  const hasProjectBoundAgentState = Boolean(hasPreparedAgentState || hasComposerDraft || agentActionLog.length);
  useEffect(() => {
    if (videoPermissionContract) setLocalVideoPermissionContract(videoPermissionContract);
  }, [videoPermissionContract]);
  useEffect(() => {
    if (text.trim() || attachments.length) {
      setIsComposerCollapsed(false);
    }
  }, [attachments.length, text]);
  const activeVideoPermissionContract = localVideoPermissionContract;
  const localProjectReadyForTools = Boolean(localProjectReady);
  const currentProjectHasStoryContext = Boolean(
    runtimeState.storyFlow.shots.length > 0
      || selectedShots.length > 0
      || shot
      || projectObservation?.story.status === "selected",
  );
  const agentCommandKind = agentCommand?.kind;
  const projectStatusStage = projectStatusView?.stage || "";
  const projectStatusExportCopy = `${projectStatusView?.nextAction || ""} ${projectStatusView?.waitingFor || ""}`;
  const newVideoDraftStatusCopy = [
    projectStatusView?.stage,
    projectStatusView?.doing,
    projectStatusView?.nextAction,
    projectStatusView?.waitingFor,
  ].filter(Boolean).join(" ");
  const newVideoDraftTimelineCopy = agentTimelineEntries.slice(-6).map((entry) => [
    entry.title,
    entry.body,
    typeof entry.details?.next === "string" ? entry.details.next : "",
    ...(entry.facts || []).map((fact) => `${fact.label}:${fact.value}`),
  ].filter(Boolean).join(" ")).join(" ");
  const newVideoDraftBusyForAgent = newVideoDraftPendingForAgent || newVideoDraftPlanningForAgent;
  const readyNewVideoDraftForAgent = Boolean(
    runtimeState.storyFlow.shots.length === 0
      && !newVideoDraftBusyForAgent
      && (
        newVideoDraftReadyForAgent
        || (
          !localProjectReadyForTools
          && /等待确认|草案|确认.*故事流/.test(`${newVideoDraftStatusCopy} ${newVideoDraftTimelineCopy}`)
        )
      ),
  );
  const activeNewVideoDraftConfirmation = readyNewVideoDraftForAgent;
  const exportResultIsPrimary = Boolean(
    projectStatusStage === "导出已完成"
      || projectStatusStage === "可以导出"
      || (projectStatusStage === "视频结果已出" && /交付|导出/.test(projectStatusExportCopy)),
  );
  const videoQueryMode = videoCanResume
    || agentCommandKind === "resume_video"
    || /查询/.test(videoSendAction?.suggestedActionLabel || "");
  const showEndpointEndFrameControls = usesEndpointEndFrame(shot) || selectedShots.some(usesEndpointEndFrame);
  const videoResultIsPrimary = !exportResultIsPrimary && (videoQueryMode || videoBusy || videoAlreadySent);
  const readOnlyAgentStatusInspection = agentActionIsStatusInspection(agentActionEnvelope);
  const showRealSampleAction = currentProjectHasStoryContext && !readOnlyAgentStatusInspection && !exportResultIsPrimary && !videoResultIsPrimary && Boolean(agentCommandKind === "generate_references" || realSampleAction?.keyConfigured || realSampleAction?.status === "running" || realSampleAction?.status === "needs_review" || realSampleAction?.status === "verified");
  const showEndFrameAction = !readOnlyAgentStatusInspection && !exportResultIsPrimary && !videoResultIsPrimary && showEndpointEndFrameControls && Boolean(endFrameAction?.keyConfigured || endFrameAction?.status === "running" || endFrameAction?.status === "needs_review" || endFrameAction?.status === "verified");
  const showVideoAction = !readOnlyAgentStatusInspection && !exportResultIsPrimary && Boolean(videoSendAction && runtimeState.storyFlow.shots.length > 0 && (
    agentCommandKind === "submit_video"
    || agentCommandKind === "resume_video"
    || agentCommandKind === "wait_video"
    || agentCommandKind === undefined
  ));
  const selectedSkillSummary = shot ? directorSkillSummaryForShot(shot) : undefined;
  const selectedSkillCard = useMemo(
    () => shot ? buildDirectorSkillCardFromShot(shot, { projectTitle: runtimeState.project.title }) : undefined,
    [runtimeState.project.title, shot],
  );
  const selectedSkillDraftFile = selectedSkillCard ? directorSkillFileName(selectedSkillCard) : "";
  const selectedSkillSavedInTimeline = Boolean(selectedSkillCard && selectedSkillDraftFile && agentTimelineEntries.some((entry) => (
    /导演经验已/.test(entry.title)
    && (
      entry.body.includes(selectedSkillCard.name)
      || entry.facts?.some((fact) => fact.value.includes(selectedSkillDraftFile))
    )
  )));
  const selectedSkillAlreadySaved = Boolean(
    selectedSkillCard
    && (savedSkillStack.some((item) => item.id === selectedSkillCard.id) || selectedSkillSavedInTimeline),
  );
  const savedSkillNames = savedSkillStack.length
    ? savedSkillStack.slice(0, 3).map((item) => item.name)
    : selectedSkillAlreadySaved && selectedSkillCard
      ? [selectedSkillCard.name]
      : [];
  const visibleSavedSkillCount = savedSkillStack.length || savedSkillNames.length;
  const showSkillStack = Boolean(selectedSkillSummary || visibleSavedSkillCount || runtimeState.storyFlow.shots.length > 0);
  const projectLoadedSkillLabel = visibleSavedSkillCount
    ? `已加载 ${visibleSavedSkillCount} 个：${savedSkillNames.join("、")}${visibleSavedSkillCount > savedSkillNames.length ? "…" : ""}`
    : "还没有保存的项目 Skill";
  const recommendedSkillLabel = selectedSkillSummary?.label === "故事板快切"
    ? "动作节点和可见剪辑先对齐"
    : selectedSkillSummary?.label === "故事板叙事"
      ? "按镜头顺序稳住叙事"
      : "锁定主体，再让模型补表演";
  const selectedSkillOneLine = selectedSkillCard?.summary || selectedSkillSummary?.detail || "按当前镜头选择合适的导演方法。";
  const selectedSkillImpactLabel = selectedSkillCard?.appliesTo?.length
    ? selectedSkillCard.appliesTo.join(" / ")
    : "故事规划 / Seedance prompt / QA";
  const selectedSkillUseWhenLabel = selectedSkillCard?.useWhen?.[0] || selectedSkillSummary?.reason || "镜头需要明确的导演方法时使用。";
  const selectedSkillAvoidWhenLabel = selectedSkillCard?.avoidWhen?.[0] || "镜头很简单时，不要过度增加约束。";
  const selectedSkillSourceLabel = selectedSkillCard?.createdFrom?.shotTitle
    ? `${selectedSkillCard.createdFrom.shotId || "当前镜头"} · ${selectedSkillCard.createdFrom.shotTitle}`
    : shot
      ? `${shot.id} · ${shot.title}`
      : "点选镜头后显示来源。";
  const mySkillActionLabel = selectedSkillAlreadySaved
    ? "当前做法已在项目里。"
    : selectedSkillCard
      ? `可把当前做法保存为 ${selectedSkillCard.name}。`
      : "点一个镜头后，可以说“把这个沉淀成 Skill”。";
  const effectiveWebSearchReady = webSearchReady ?? webSearchSettings.enabled;
  function visibleVideoPermissionContractFor(contract: AgentVideoPermissionContract) {
    return agentVideoPermissionForUi(contract, {
      referenceReady: Boolean(localProjectReadyForTools && (showRealSampleAction || showEndFrameAction)),
      videoReady: Boolean(localProjectReadyForTools && showVideoAction && videoSendAction?.ready && videoSendAction.keyConfigured && (!videoAlreadySent || videoCanResume)),
    });
  }

  const videoPermissionContractForUi = visibleVideoPermissionContractFor(activeVideoPermissionContract);
  const currentVideoPermissionContract = videoPermissionContractForUi;
  const referenceGenerationBlockedByContract = !agentVideoPermissionAllowsReference(currentVideoPermissionContract);
  const referenceGenerationBlockedByProject = !localProjectReadyForTools;
  const videoPermissionBlockedByContract = !videoQueryMode && !agentVideoPermissionAllowsVideo(currentVideoPermissionContract);
  const videoPermissionBlockedByProject = !localProjectReadyForTools;
  const videoPermissionModeItems: Array<{ mode: AgentVideoPermissionMode; label: string }> = [
    { mode: "plan_only", label: "先整理" },
    { mode: "reference_allowed", label: "生成参考" },
    { mode: "video_allowed", label: "提交视频" },
  ];

  function clearSkillSaveComposerInput() {
    setText("");
    setAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function requestSelectedSkillDraftSave(userIntent: string) {
    const projectRoot = runtimeState.project.root?.trim();
    if (!selectedSkillCard || !selectedSkillDraftFile) {
      rememberAgentTimelineEntries(buildSkillSaveTimelineEntries({
        userIntent,
        title: "AI 导演：先选一个镜头",
        body: "我可以把当前镜头的做法沉淀成 Skill，但现在还没有选中可保存的镜头。",
        status: "blocked",
        next: "先在中间点一个镜头，再说“把这个沉淀成 Skill”。",
      }));
      clearSkillSaveComposerInput();
      setStatus("先选镜头");
      return;
    }

    if (!localProjectReadyForTools || !projectRoot) {
      rememberAgentTimelineEntries(buildSkillSaveTimelineEntries({
        userIntent,
        title: "AI 导演：需要本地项目",
        body: "这条导演经验需要保存到当前项目里。先打开或新建一个项目文件夹，再让我保存。",
        status: "blocked",
        path: `skills/${selectedSkillDraftFile}`,
        next: "左上角打开或新建项目后，再说“把这个沉淀成 Skill”。",
      }));
      clearSkillSaveComposerInput();
      setStatus("需要本地项目");
      return;
    }

    setPendingSkillSaveRequest({
      userIntent,
      card: selectedSkillCard,
      fileName: selectedSkillDraftFile,
    });
    rememberAgentTimelineEntries(buildSkillSaveConfirmationTimelineEntries({
      userIntent,
      skillName: selectedSkillCard.name,
      fileName: selectedSkillDraftFile,
      summary: selectedSkillCard.summary,
    }));
    clearSkillSaveComposerInput();
    setStatus("等你确认保存导演经验");
  }

  async function saveSelectedSkillDraft(userIntent: string, input?: {
    card?: DirectorSkillCardDraft;
    fileName?: string;
    includeUserMessage?: boolean;
  }) {
    const projectRoot = runtimeState.project.root?.trim();
    const projectTitle = runtimeState.project.title || "当前项目";
    const skillCard = input?.card || selectedSkillCard;
    const skillFileName = input?.fileName || selectedSkillDraftFile;
    if (!skillCard || !skillFileName) {
      rememberAgentTimelineEntries(buildSkillSaveTimelineEntries({
        userIntent,
        title: "AI 导演：先选一个镜头",
        body: "我可以把当前镜头的做法沉淀成 Skill，但现在还没有选中可保存的镜头。",
        status: "blocked",
        next: "先在中间点一个镜头，再说“把这个沉淀成 Skill”。",
        includeUserMessage: input?.includeUserMessage,
      }));
      clearSkillSaveComposerInput();
      setStatus("先选镜头");
      return;
    }

    if (!localProjectReadyForTools || !projectRoot) {
      rememberAgentTimelineEntries(buildSkillSaveTimelineEntries({
        userIntent,
        title: "AI 导演：需要本地项目",
        body: "这条导演经验需要保存到当前项目里。先打开或新建一个项目文件夹，再让我保存。",
        status: "blocked",
        path: `skills/${skillFileName}`,
        next: "左上角打开或新建项目后，再说“把这个沉淀成 Skill”。",
        includeUserMessage: input?.includeUserMessage,
      }));
      clearSkillSaveComposerInput();
      setStatus("需要本地项目");
      return;
    }

    const relativePath = `skills/${skillFileName}`;
    const markdown = directorSkillCardMarkdown(skillCard);
    const savedAt = new Date().toISOString();
    const nextSkillIndex = upsertDirectorSkillStackIndex(
      createDirectorSkillStackIndex(savedSkillStack),
      { card: skillCard, fileName: skillFileName, savedAt },
    );
    const bridge = typeof window !== "undefined" ? window.vibeRuntime : undefined;
    try {
      rememberAgentTimelineEntries([buildSkillSaveRunningTimelineEntry({
        fileName: skillFileName,
        skillName: skillCard.name,
      })]);
      if (bridge?.sandboxWriteFile) {
        const targetPath = `${projectRoot.replace(/\/+$/g, "")}/${relativePath}`;
        await bridge.sandboxWriteFile(targetPath, markdown);
        await bridge.sandboxWriteFile(
          `${projectRoot.replace(/\/+$/g, "")}/${DIRECTOR_SKILL_STACK_INDEX_PATH}`,
          serializeDirectorSkillStackIndex(nextSkillIndex),
        );
        savedSkillStackProjectKeyRef.current = runtimeProjectKey;
        setSavedSkillStack(nextSkillIndex.skills);
        rememberAgentTimelineEntries(buildSkillSaveTimelineEntries({
          userIntent,
          title: "AI 导演：导演经验已保存",
          body: `我已经把当前镜头的做法保存成导演经验卡：${skillCard.name}。以后可以作为项目里的方法参考继续使用。`,
          status: "done",
          path: relativePath,
          mode: "项目文件",
          next: "需要的话，可以继续说“这个 Skill 用到下一段”。",
          includeUserMessage: input?.includeUserMessage,
        }));
      } else if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(browserSkillStorageKey(projectTitle, skillFileName), markdown);
        window.localStorage.setItem(browserSkillIndexStorageKey(runtimeProjectKey), serializeDirectorSkillStackIndex(nextSkillIndex));
        savedSkillStackProjectKeyRef.current = runtimeProjectKey;
        setSavedSkillStack(nextSkillIndex.skills);
        rememberAgentTimelineEntries(buildSkillSaveTimelineEntries({
          userIntent,
          title: "AI 导演：导演经验已暂存",
          body: `我已经把当前镜头的做法暂存在浏览器里：${skillCard.name}。打开桌面版项目后可以再写入项目文件夹。`,
          status: "done",
          path: relativePath,
          mode: "浏览器暂存",
          next: "想继续项目，就直接说下一步要改哪里。",
          includeUserMessage: input?.includeUserMessage,
        }));
      } else {
        throw new Error("当前环境不能写入项目文件，也不能使用浏览器暂存。");
      }
      setPendingSkillSaveRequest(undefined);
      setStatus("Skill 已保存");
    } catch (error) {
      rememberAgentTimelineEntries(buildSkillSaveTimelineEntries({
        userIntent,
        title: "AI 导演：保存失败",
        body: error instanceof Error ? error.message : "导演经验没有保存成功，可以重试。",
        status: "blocked",
        path: relativePath,
        next: "检查项目文件夹权限后，再说“保存这个 Skill”。",
        includeUserMessage: input?.includeUserMessage,
      }));
      setStatus("保存失败");
    } finally {
      clearSkillSaveComposerInput();
    }
  }

  async function confirmPendingSkillSave() {
    if (!pendingSkillSaveRequest) {
      setStatus("没有待保存的 Skill");
      return;
    }
    await saveSelectedSkillDraft(pendingSkillSaveRequest.userIntent, {
      card: pendingSkillSaveRequest.card,
      fileName: pendingSkillSaveRequest.fileName,
      includeUserMessage: false,
    });
  }

  function revisePendingSkillSave() {
    if (!pendingSkillSaveRequest) {
      setStatus("没有待修改的导演经验");
      return;
    }
    rememberAgentTimelineEntries([buildSkillSaveCancelledTimelineEntry({
      skillName: pendingSkillSaveRequest.card.name,
    })]);
    setText(pendingSkillSaveRequest.userIntent);
    setPendingSkillSaveRequest(undefined);
    textareaRef.current?.focus();
    setStatus("可以调整后再发送");
  }

  const referenceMissingCount = runtimeState.visualMemory.summary.missing;
  const referenceLockedCount = runtimeState.visualMemory.summary.locked;
  const referenceReviewCount = runtimeState.visualMemory.summary.needsReview;
  const referenceDisplayableCount = runtimeState.visualMemory.assets.filter(minimalAgentAssetHasDisplayableReference).length;
  const referenceNeedsReview = referenceReviewCount > 0;
  const referenceHasReviewableAssets = referenceNeedsReview && referenceDisplayableCount > 0;
  const referencesReadyAfterReview = referenceLockedCount > 0 && referenceDisplayableCount > 0 && referenceMissingCount === 0 && !referenceNeedsReview;
  const timelineShowsReferenceReady = agentTimelineEntries.some((entry) =>
    entry.toolName === "generate_references" && /参考可用/.test(`${entry.title} ${entry.body} ${entry.details?.next || ""}`),
  );
  const referencesUsableForAgent = referencesReadyAfterReview || timelineShowsReferenceReady;
  const realSampleLabel = realSampleBusy
    ? "生成中"
    : referenceHasReviewableAssets
      ? "等待复核"
    : referenceGenerationBlockedByProject
      ? "先保存项目"
    : referenceGenerationBlockedByContract
      ? "确认生成参考"
    : realSampleAction?.status === "needs_review"
      ? "等待复核"
    : realSampleAction?.status === "verified"
        ? referenceDisplayableCount > 0 ? "已完成" : "等待结果"
        : "生成参考";
  const idleActionHint = currentVideoPermissionContract.mode === "plan_only"
    ? "点一下只会先整理成待确认计划。"
    : currentVideoPermissionContract.mode === "reference_allowed"
      ? "点一下会准备参考，视频仍要你确认。"
      : "参考通过后，才会继续发送视频。";
  const endFrameLabel = endFrameBusy
    ? "生成中"
    : referenceGenerationBlockedByProject
      ? "先保存项目"
    : referenceGenerationBlockedByContract
      ? "确认生成结束画面"
    : endFrameAction?.status === "needs_review"
      ? "等待复核"
      : endFrameAction?.status === "verified"
        ? "已完成"
        : "生成结束画面";
  const videoActionLabel = videoBusy
    ? videoQueryMode ? "查询中" : "发送中"
    : videoSubmissionBlocked
      ? "先处理视频问题"
    : videoQueryMode
      ? "查询结果"
    : videoSendAction?.suggestedActionLabel
      ? videoSendAction.suggestedActionLabel
    : videoPermissionBlockedByProject
      ? "先保存项目"
    : videoPermissionBlockedByContract
      ? "确认提交视频"
    : videoAlreadySent
      ? "已发送"
      : "发送视频";
  const agentBoundarySummaryLabel = videoQueryMode
    ? "可查询结果"
    : videoSubmissionBlocked
      ? "需要处理"
    : videoBusy || videoAlreadySent || agentCommandKind === "wait_video"
      ? "等待结果"
      : agentVideoPermissionLabel(videoPermissionContractForUi);
  const agentBoundaryDetail = videoQueryMode
    ? "即梦已收到任务；现在只查询结果，不会重复发送。"
    : videoSubmissionBlocked
      ? videoSendAction?.message || "先补参考或修改这一段，再继续提交视频。"
    : videoBusy
      ? "正在处理视频任务，等结果出来后再继续。"
      : videoAlreadySent
      ? "视频已发送，等待结果。"
      : agentVideoPermissionDetail(videoPermissionContractForUi);
  const videoFocusScopeLabel = videoQueryMode
    ? "正在等视频结果"
    : videoBusy
      ? "正在发送视频"
      : videoAlreadySent
        ? "正在看视频结果"
        : "";
  const videoFocusSelectionHint = videoQueryMode
    ? "点确认只查询结果，不会重复提交。"
    : videoBusy
      ? "当前视频任务正在处理，等结果出来再继续。"
      : videoAlreadySent
        ? "先看视频结果，通过后再继续下一步。"
        : "";
  const exportFocusScopeLabel = exportResultIsPrimary ? projectStatusView?.stage || "交付已整理" : "";
  const exportFocusSelectionHint = exportResultIsPrimary
    ? projectStatusView?.doing || "交付内容已整理好；还想改哪里，直接说。"
    : "";
  const displayedScopeLabel = exportResultIsPrimary && exportFocusScopeLabel
    ? exportFocusScopeLabel
    : videoResultIsPrimary && videoFocusScopeLabel
    ? videoFocusScopeLabel
    : baseDisplayedScopeLabel;
  const displayedSelectionHint = exportResultIsPrimary && exportFocusSelectionHint
    ? exportFocusSelectionHint
    : videoResultIsPrimary && videoFocusSelectionHint
    ? videoFocusSelectionHint
    : baseDisplayedSelectionHint;
  const displayedCompactScopeLabel = compactAgentScopeLabel(displayedScopeLabel);
  const displayedCompactSelectionHint = compactAgentSelectionHint(displayedSelectionHint);
  const displayedSelectionChips = workflow && preparedSelectionChips.length ? preparedSelectionChips : liveSelectionChips;
  const visibleAgentActionLog = agentActionLog.filter((item) =>
    !agentActionLogItemIsPrematureReferenceReview(item, referenceHasReviewableAssets)
  );
  const standaloneAgentActionLogAllowed = visibleAgentActionLog.length > 0 && !videoResultIsPrimary && !exportResultIsPrimary;

  function canAutoFocusComposer() {
    if (typeof document === "undefined") return false;
    const activeElement = document.activeElement;
    if (!activeElement || activeElement === document.body) return true;
    if (activeElement === textareaRef.current) return false;
    return !(
      activeElement instanceof HTMLInputElement
      || activeElement instanceof HTMLTextAreaElement
      || activeElement instanceof HTMLSelectElement
    );
  }

  useEffect(() => {
    if (!previousRuntimeProjectKeyRef.current) {
      previousRuntimeProjectKeyRef.current = runtimeProjectKey;
      return;
    }
    if (previousRuntimeProjectKeyRef.current === runtimeProjectKey) return;
    previousRuntimeProjectKeyRef.current = runtimeProjectKey;
    setText("");
    setAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setWorkflow(undefined);
    setProjection(undefined);
    setFeedbackRecompile(undefined);
    setPreparedContext(undefined);
    setAgentActionEnvelope(undefined);
    setAgentToolHandoff(undefined);
    setPlanPhase("idle");
    setLocalPrototypeAgentDemo(undefined);
    setIsRetryingTool(false);
    setResearchResult(undefined);
    setResearchStatus("idle");
    setReferenceStatus("idle");
    setIsComposerCollapsed(false);
    setAgentTimelineEntries([]);
    setAgentActionLog([]);
    restoredAgentDraftIdRef.current = "";
    restoredAgentLogKeyRef.current = "";
    restoredAgentTimelineKeyRef.current = "";
    setStatus(hasComposerDraft ? "项目已切换，输入已清空" : "项目已切换，重新发送即可");
    setLatestAgentKernelTurn(undefined);
  }, [hasComposerDraft, hasProjectBoundAgentState, runtimeProjectKey, runtimeState.storyFlow.shots.length]);

  useEffect(() => {
    if (!localProjectReadyForTools) {
      restoredAgentLogKeyRef.current = "";
      setAgentActionLog([]);
      return;
    }
    if (latestNewVideoDraftCommittedForProjection) {
      restoredAgentLogKeyRef.current = "new_video_draft_committed";
      setAgentActionLog([]);
      return;
    }
    const restoredItems = (restoredAgentActionLog || []).slice(0, 4);
    const nextKey = agentActionLogKey(restoredItems);
    if (!nextKey || restoredAgentLogKeyRef.current === nextKey) return;
    restoredAgentLogKeyRef.current = nextKey;
    setAgentActionLog(restoredItems);
  }, [latestNewVideoDraftCommittedForProjection, localProjectReadyForTools, restoredAgentActionLog]);

  useEffect(() => {
    const restoredEntries = restoredAgentTimelineEntries || [];
    if (
      latestNewVideoDraftCommittedForProjection
      && restoredEntries.length > 0
      && !restoredEntries.some((entry) => entry.id.startsWith("new_video_draft_committed_"))
    ) {
      restoredAgentTimelineKeyRef.current = "new_video_draft_committed";
      setAgentTimelineEntries([]);
      return;
    }
    if (latestNewVideoDraftCommittedForProjection && !restoredEntries.length) {
      restoredAgentTimelineKeyRef.current = "new_video_draft_committed";
      setAgentTimelineEntries([]);
      return;
    }
    const nextKey = agentTimelineKey(restoredEntries);
    if (!nextKey) {
      restoredAgentTimelineKeyRef.current = "";
      setAgentTimelineEntries([]);
      return;
    }
    if (restoredAgentTimelineKeyRef.current === nextKey) return;
    restoredAgentTimelineKeyRef.current = nextKey;
    setAgentTimelineEntries(restoredEntries);
  }, [latestNewVideoDraftCommittedForProjection, restoredAgentTimelineEntries]);

  useEffect(() => {
    if (!localProjectReadyForTools) {
      restoredAgentDraftIdRef.current = "";
      return;
    }
    const draft = restoredAgentStagedPlanDraft;
    if (!draft || draft.status !== "active" || !draft.action || !draft.toolHandoff) return;
    if (restoredAgentDraftIdRef.current === draft.draftId) return;
    if (hasPreparedAgentState) return;
    restoredAgentDraftIdRef.current = draft.draftId;
    const nextVideoPermissionContract = restoredVideoPermissionContract(draft, activeVideoPermissionContract);
    updateVideoPermissionContract(nextVideoPermissionContract);
    const restoredSelection = {
      selectedShotId: draft.selectedShotId,
      selectedShotIds: draft.selectedShotIds.length > 1 ? draft.selectedShotIds : undefined,
      selectedAssetId: draft.selectedAssetId,
      sectionId: draft.sectionId,
    };
    const nextWorkflow = buildDirectorWorkflowState(withProjectGuide({
      runtimeState,
      userIntent: draft.userIntent,
      selection: restoredSelection,
    }, projectReferenceGuide));
    const nextProjection = buildAgentPanelProjection(nextWorkflow, runtimeState, "review");
    setWorkflow(nextWorkflow);
    setProjection(nextProjection);
    setFeedbackRecompile(undefined);
    setPreparedContext({
      scopeLabel: draft.scopeLabel || scopeLabel,
      selectionHint,
      userIntent: draft.userIntent,
      selectedShotId: draft.selectedShotId,
      selectedShotIds: draft.selectedShotIds.length > 1 ? draft.selectedShotIds : undefined,
      selectedAssetId: draft.selectedAssetId,
      sectionId: draft.sectionId,
      videoPermissionContract: nextVideoPermissionContract,
      qaFeedback: draft.qaFeedback,
      projectRecordLabel: draft.projectRecordLabel,
      projectImpactLabel: draft.projectImpactLabel,
      projectTaskLabel: draft.projectTaskLabel,
    });
    setAgentActionEnvelope(draft.action);
    setAgentToolHandoff(draft.toolHandoff);
    setPlanPhase("review");
    setLocalPrototypeAgentDemo({
      status: "ready",
      result: {
        label: draft.action.status === "blocked" ? "待处理计划已恢复" : "待确认计划已恢复",
        projectRestored: true,
        projectVibeAdded: false,
        projectSaved: false,
        projectRecordLabel: draft.projectRecordLabel,
        projectImpactLabel: draft.projectImpactLabel,
        projectTaskLabel: draft.projectTaskLabel,
        waitingReview: true,
        status: draft.action.status === "blocked" ? "blocked" : "ready",
      },
    });
    setStatus(draft.action.status === "blocked" ? "需要补充" : "等你确认");
  }, [
    activeVideoPermissionContract,
    hasPreparedAgentState,
    localProjectReadyForTools,
    projectReferenceGuide,
    restoredAgentStagedPlanDraft,
    runtimeState,
    scopeLabel,
    selectionHint,
  ]);

  useEffect(() => {
    if (!selectionFocusKey || !hasBoundSelection || text.trim()) {
      previousSelectionFocusKeyRef.current = selectionFocusKey;
      return;
    }
    if (previousSelectionFocusKeyRef.current === selectionFocusKey) return;
    previousSelectionFocusKeyRef.current = selectionFocusKey;
    rememberAgentTimelineEntries([buildSelectionChangedTimelineEntry({
      createdAt: new Date().toISOString(),
      selectionKey: selectionFocusKey,
      label: localScopeLabel,
      hint: selectionHint,
      facts: liveSelectionChips,
    })]);
    if (!canAutoFocusComposer()) return;
    window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 0);
  }, [asset?.id, hasBoundSelection, localScopeLabel, scopedShotKey, sectionId, selectionFocusKey, selectionHint, shot?.id, text]);

  function updateVideoPermissionContract(nextContract: AgentVideoPermissionContract) {
    setLocalVideoPermissionContract(nextContract);
    onVideoPermissionContractChange?.(nextContract);
  }

  function selectVideoPermissionMode(mode: AgentVideoPermissionMode) {
    if (workflow) return;
    const nextContract = agentVideoPermissionForMode(mode);
    if (activeVideoPermissionContract.mode !== nextContract.mode) {
      rememberAgentTimelineEntries([buildExecutionBoundaryChangedTimelineEntry({
        createdAt: new Date().toISOString(),
        contract: nextContract,
      })]);
    }
    updateVideoPermissionContract(nextContract);
    setStatus(agentVideoPermissionLabel(nextContract));
  }

  function runFooterReferenceGeneration() {
    if (!realSampleAction) return;
    const referenceTask = {
      toolName: "generate_references" as DirectProductActionToolName,
      startedTitle: "参考任务已启动",
      startedBody: "已确认，Agent 正在把参考生成任务交给图片服务。",
      completedTitle: "参考任务已发送",
      completedBody: "参考任务已交给生成队列，完成后会在参考页显示。",
      failedTitle: "参考生成没有完成",
      next: "等参考图完成后，到参考页复核。",
      facts: [
        { label: "动作", value: "生成参考" },
        { label: "范围", value: "当前项目" },
      ],
    };
    if (referenceGenerationBlockedByProject) {
      rememberBlockedDirectProductAction({
        toolName: referenceTask.toolName,
        title: "还不能生成参考",
        body: "先选择或创建项目文件夹，这样 Agent 才能把参考图写回项目。",
        next: "选择项目文件夹后，再点生成参考。",
        facts: referenceTask.facts,
        status: "需要本地项目",
      });
      return;
    }
    if (referenceGenerationBlockedByContract) {
      const nextContract = agentVideoPermissionForMode("reference_allowed");
      updateVideoPermissionContract(nextContract);
      if (!realSampleAction.keyConfigured) {
        rememberBlockedDirectProductAction({
          toolName: referenceTask.toolName,
          title: "还不能生成参考",
          body: "已允许生成参考，但图片服务还没有连接。先去设置里连接图片服务。",
          next: "连接图片服务后，再点生成参考。",
          facts: referenceTask.facts,
          status: "需要图片服务",
        });
        return;
      }
      if (realSampleAction.disabled || realSampleBusy || !onCreateP6RealSample) {
        const message = realSampleAction.message || (realSampleBusy ? "参考正在生成。" : "当前还不能生成参考。");
        rememberBlockedDirectProductAction({
          toolName: referenceTask.toolName,
          title: "参考任务还不能开始",
          body: message,
          next: "等当前任务结束，或按提示补齐条件后再试。",
          facts: referenceTask.facts,
          status: message,
        });
        return;
      }
      if (runtimeState.visualMemory.summary.missing > 0 && onRetryMissingBatch) {
        setStatus("已确认，正在生成参考。");
        runVisibleDirectProductAction(referenceTask, () => onRetryMissingBatch());
        return;
      }
      setStatus("已确认，正在发送参考任务。");
      runVisibleDirectProductAction(referenceTask, () => onCreateP6RealSample({ scope: "project", videoPermissionContract: nextContract, skipConfirm: true }));
      return;
    }
    if (!realSampleAction.keyConfigured) {
      rememberBlockedDirectProductAction({
        toolName: referenceTask.toolName,
        title: "还不能生成参考",
        body: "图片服务还没有连接。先去设置里连接图片服务。",
        next: "连接图片服务后，再点生成参考。",
        facts: referenceTask.facts,
        status: "需要图片服务",
      });
      return;
    }
    if (realSampleAction.disabled || realSampleBusy || !onCreateP6RealSample) {
      const message = realSampleAction.message || (realSampleBusy ? "参考正在生成。" : "当前还不能生成参考。");
      rememberBlockedDirectProductAction({
        toolName: referenceTask.toolName,
        title: "参考任务还不能开始",
        body: message,
        next: "等当前任务结束，或按提示补齐条件后再试。",
        facts: referenceTask.facts,
        status: message,
      });
      return;
    }
    if (runtimeState.visualMemory.summary.missing > 0 && onRetryMissingBatch) {
      setStatus("正在补齐故事流里的参考画面。");
      runVisibleDirectProductAction(referenceTask, () => onRetryMissingBatch());
      return;
    }
    setStatus("已发送参考任务。");
    runVisibleDirectProductAction(referenceTask, () => onCreateP6RealSample({ scope: "project", videoPermissionContract: currentVideoPermissionContract, skipConfirm: true }));
  }

  function runFooterEndFrameGeneration() {
    if (!endFrameAction) return;
    const endFrameTask = {
      toolName: "generate_references" as DirectProductActionToolName,
      startedTitle: "结束画面任务已启动",
      startedBody: "已确认，Agent 正在把结束画面任务交给图片服务。",
      completedTitle: "结束画面任务已发送",
      completedBody: "结束画面任务已交给生成队列，完成后会在参考页显示。",
      failedTitle: "结束画面任务发送失败",
      next: "等结束画面完成后，到参考页复核。",
      facts: [
        { label: "动作", value: "生成结束画面" },
        { label: "范围", value: "当前镜头" },
      ],
    };
    if (referenceGenerationBlockedByProject) {
      rememberBlockedDirectProductAction({
        toolName: endFrameTask.toolName,
        title: "还不能生成结束画面",
        body: "先选择或创建项目文件夹，这样 Agent 才能把结束画面写回项目。",
        next: "选择项目文件夹后，再生成结束画面。",
        facts: endFrameTask.facts,
        status: "需要本地项目",
      });
      return;
    }
    if (referenceGenerationBlockedByContract) {
      const nextContract = agentVideoPermissionForMode("reference_allowed");
      updateVideoPermissionContract(nextContract);
      if (!endFrameAction.keyConfigured) {
        rememberBlockedDirectProductAction({
          toolName: endFrameTask.toolName,
          title: "还不能生成结束画面",
          body: "已允许生成参考，但图片服务还没有连接。先去设置里连接图片服务。",
          next: "连接图片服务后，再生成结束画面。",
          facts: endFrameTask.facts,
          status: "需要图片服务",
        });
        return;
      }
      if (endFrameAction.disabled || endFrameBusy || !onCreateImage2EndFrame) {
        const message = endFrameAction.message || (endFrameBusy ? "结束画面正在生成。" : "当前还不能生成结束画面。");
        rememberBlockedDirectProductAction({
          toolName: endFrameTask.toolName,
          title: "结束画面任务还不能开始",
          body: message,
          next: "等当前任务结束，或按提示补齐条件后再试。",
          facts: endFrameTask.facts,
          status: message,
        });
        return;
      }
      setStatus("已确认，正在发送结束画面任务。");
      runVisibleDirectProductAction(endFrameTask, () => onCreateImage2EndFrame());
      return;
    }
    if (!endFrameAction.keyConfigured) {
      rememberBlockedDirectProductAction({
        toolName: endFrameTask.toolName,
        title: "还不能生成结束画面",
        body: "图片服务还没有连接。先去设置里连接图片服务。",
        next: "连接图片服务后，再生成结束画面。",
        facts: endFrameTask.facts,
        status: "需要图片服务",
      });
      return;
    }
    if (endFrameAction.disabled || endFrameBusy || !onCreateImage2EndFrame) {
      const message = endFrameAction.message || (endFrameBusy ? "结束画面正在生成。" : "当前还不能生成结束画面。");
      rememberBlockedDirectProductAction({
        toolName: endFrameTask.toolName,
        title: "结束画面任务还不能开始",
        body: message,
        next: "等当前任务结束，或按提示补齐条件后再试。",
        facts: endFrameTask.facts,
        status: message,
      });
      return;
    }
    setStatus("已发送结束画面任务。");
    runVisibleDirectProductAction(endFrameTask, () => onCreateImage2EndFrame());
  }

  function runFooterVideoAction() {
    if (!videoSendAction) return;
    const videoTask = videoQueryMode
      ? {
          toolName: "query_video" as DirectProductActionToolName,
          startedTitle: "开始查询视频结果",
          startedBody: "Agent 正在查询已经提交的视频任务，不会重复提交。",
          completedTitle: "查询请求已发送",
          completedBody: "查询请求已交给运行时，完成后会在预览页显示。",
          failedTitle: "查询请求失败",
          next: "等结果完成后，到预览页复核。",
          facts: [
            { label: "动作", value: "查询视频" },
            { label: "范围", value: "当前视频任务" },
          ],
        }
      : {
          toolName: "submit_video" as DirectProductActionToolName,
          startedTitle: "开始发送视频",
          startedBody: "已确认，Agent 正在把视频任务交给 Seedance 串行队列。",
          completedTitle: "视频任务已发送",
          completedBody: "视频任务已交给 Seedance 队列，完成后会在预览页显示。",
          failedTitle: "视频任务发送失败",
          next: "等 Seedance 回流后，到预览页复核。",
          facts: [
            { label: "动作", value: "发送视频" },
            { label: "范围", value: "当前镜头" },
          ],
        };
    if (videoPermissionBlockedByProject) {
      rememberBlockedDirectProductAction({
        toolName: videoTask.toolName,
        title: videoQueryMode ? "还不能查询视频" : "还不能发送视频",
        body: "先选择或创建项目文件夹，这样 Agent 才能读取任务状态并写回结果。",
        next: "选择项目文件夹后，再继续视频任务。",
        facts: videoTask.facts,
        status: "需要本地项目",
      });
      return;
    }
    if (!videoQueryMode && videoPermissionBlockedByContract) {
      const nextContract = agentVideoPermissionForMode("video_allowed");
      updateVideoPermissionContract(nextContract);
      if (videoBusy || !onSendSeedanceVideo) {
        const message = videoBusy ? "视频任务正在处理。" : "当前还不能发送视频。";
        rememberBlockedDirectProductAction({
          toolName: videoTask.toolName,
          title: "视频任务还不能开始",
          body: message,
          next: "等当前任务结束，或按提示补齐条件后再试。",
          facts: videoTask.facts,
          status: message,
        });
        return;
      }
      if (videoSendAction.disabled || !videoSendAction.ready || !videoSendAction.keyConfigured || videoAlreadySent) {
        const message = videoSendAction.message || "视频还不能发送。";
        rememberBlockedDirectProductAction({
          toolName: videoTask.toolName,
          title: "视频还不能发送",
          body: message,
          next: "按提示补齐条件后，再点发送视频。",
          facts: videoTask.facts,
          status: message,
        });
        return;
      }
      setStatus("已确认，开始发送视频。");
      runVisibleDirectProductAction(videoTask, () => onSendSeedanceVideo({ videoPermissionContract: nextContract }));
      return;
    }
    if (videoBusy || !onSendSeedanceVideo) {
      const message = videoBusy ? "视频任务正在处理。" : "当前还不能发送视频。";
      rememberBlockedDirectProductAction({
        toolName: videoTask.toolName,
        title: videoQueryMode ? "视频查询还不能开始" : "视频任务还不能开始",
        body: message,
        next: "等当前任务结束，或按提示补齐条件后再试。",
        facts: videoTask.facts,
        status: message,
      });
      return;
    }
    if (!videoQueryMode && (videoSendAction.disabled || !videoSendAction.ready || !videoSendAction.keyConfigured || videoAlreadySent)) {
      const message = videoSendAction.message || "视频还不能发送。";
      rememberBlockedDirectProductAction({
        toolName: videoTask.toolName,
        title: "视频还不能发送",
        body: message,
        next: "按提示补齐条件后，再点发送视频。",
        facts: videoTask.facts,
        status: message,
      });
      return;
    }
    setStatus(videoQueryMode ? "开始查询视频结果。" : "开始发送视频。");
    runVisibleDirectProductAction(videoTask, () => onSendSeedanceVideo({ videoPermissionContract: currentVideoPermissionContract }));
  }

  function updateText(value: string) {
    setText(value);
    setResearchResult(undefined);
    setResearchStatus("idle");
    setReferenceStatus("idle");
    if (!workflow) return;
    setWorkflow(undefined);
    setProjection(undefined);
    setFeedbackRecompile(undefined);
    setPreparedContext(undefined);
    setAgentActionEnvelope(undefined);
    setAgentToolHandoff(undefined);
    setPlanPhase("idle");
    setLocalPrototypeAgentDemo(undefined);
    setIsRetryingTool(false);
    setStatus(value.trim() ? "继续写" : "等待输入");
  }

  function continueFromAgentActionLog(item: AgentActionLogItem) {
    resetPreparedComposerState("继续写");
    setText(item.followUpIntent);
    window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 0);
  }

  function currentComposerSelectionOverride(): ComposerSelectionOverride {
    if (scopedShotIds.length > 1) return { selectedShotIds: scopedShotIds };
    if (currentSelectedShotId) return { selectedShotId: currentSelectedShotId };
    if (asset?.id) return { selectedAssetId: asset.id };
    if (sectionId && !scopedShotIds.length && !asset) return { sectionId };
    return {};
  }

  function openAgentResultView() {
    const target = agentResultViewTarget(agentToolHandoff);
    if (!target) return;
    onOpenResultView?.(target.view);
  }

  function openAgentActionLogResultView(item: AgentActionLogItem) {
    if (!item.resultView) return;
    onOpenResultView?.(item.resultView.view);
  }

  function resetPreparedComposerState(nextStatus?: string) {
    setWorkflow(undefined);
    setProjection(undefined);
    setFeedbackRecompile(undefined);
    setPreparedContext(undefined);
    setAgentActionEnvelope(undefined);
    setAgentToolHandoff(undefined);
    setPlanPhase("idle");
    setLocalPrototypeAgentDemo(undefined);
    setIsRetryingTool(false);
    setResearchResult(undefined);
    setResearchStatus("idle");
    setReferenceStatus("idle");
    if (nextStatus) setStatus(nextStatus);
  }

  function addComposerFiles(filesLike: FileList | File[] | null) {
    const files = Array.from(filesLike || []);
    if (!files.length) return;
    const nextAttachments = [
      ...attachments,
      ...files.map((file, index) => ({
        id: `${file.name.replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "_")}_${file.lastModified}_${file.size}_${attachments.length + index}`,
        kind: composerAttachmentKind(file),
        file,
      })),
    ];
    setAttachments(nextAttachments);
    resetPreparedComposerState("文件已放入");
    if (fileInputRef.current) fileInputRef.current.value = "";
    window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 0);
  }

  function removeComposerAttachment(id: string) {
    const nextAttachments = attachments.filter((item) => item.id !== id);
    setAttachments(nextAttachments);
    resetPreparedComposerState(text.trim() || nextAttachments.length ? "继续写" : "等待输入");
  }

  function currentAgentToolAvailability(): DirectorAgentToolAvailability {
    const confirmedVideoSubmitAllowed = agentActionEnvelope?.kind === "prepare_video_submit"
      && agentActionEnvelope.executionContract.videoSubmitAllowed;
    return buildVibeAgentProductToolAvailability({
      localProjectReady: localProjectReadyForTools,
      webSearchReady: effectiveWebSearchReady,
      referenceGenerationCallbackReady: Boolean(onCreateP6RealSample),
      referenceGenerationKeyConfigured: realSampleAction?.keyConfigured,
      referenceGenerationDisabled: realSampleAction?.disabled,
      referenceGenerationBusy: realSampleBusy,
      videoSubmitCallbackReady: Boolean(onSendSeedanceVideo),
      videoSubmitReady: Boolean(videoSendAction?.ready || confirmedVideoSubmitAllowed),
      videoSubmitKeyConfigured: videoSendAction?.keyConfigured,
      videoAlreadySent,
      videoCanResume,
      exportCallbackReady: Boolean(onRunExport),
    });
  }

  function handleComposerDrag(event: DragEvent<HTMLElement>, active: boolean) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFiles(active);
  }

  function handleComposerDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFiles(false);
    addComposerFiles(event.dataTransfer.files);
  }

  async function prepareChange(intentOverride?: string, selectionOverride?: ComposerSelectionOverride) {
    if (isPreparingPlan) return;
    setIsPreparingPlan(true);
    try {
      const usingOverride = Boolean(intentOverride?.trim());
      setStatus(!usingOverride && attachments.some((attachment) => attachment.kind === "script") ? "正在读取脚本" : "正在整理");
      const userIntent = usingOverride
        ? intentOverride!.trim()
        : await composerIntentFromInput(text, attachments);
      if (!userIntent) {
        setStatus("先写一句，或拖文件");
        return;
      }
      if (isSaveDirectorSkillIntent(userIntent)) {
        requestSelectedSkillDraftSave(userIntent);
        return;
      }
      const currentProjectContinueIntent = currentProjectHasStoryContext
        && intentContinuesCurrentProject(userIntent);
      if (onStartNewVideoDraftFromAgent && !currentProjectContinueIntent && intentStartsFreshVideoDraft(userIntent)) {
        setStatus("开始新草案");
        setText("");
        setAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await onStartNewVideoDraftFromAgent(userIntent);
        return;
      }
      if (
        (readyNewVideoDraftForAgent || (
          !localProjectReadyForTools
          && runtimeState.storyFlow.shots.length === 0
          && isNewVideoDraftConfirmationRouteIntent(userIntent)
        ))
        && onStartNewVideoDraftFromAgent
        && !currentProjectContinueIntent
        && runtimeState.storyFlow.shots.length === 0
        && shouldRouteToReadyNewVideoDraft(userIntent)
      ) {
        setStatus("交给当前草案");
        setText("");
        setAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await onStartNewVideoDraftFromAgent(userIntent);
        return;
      }
      if (
        !localProjectReadyForTools
        && !currentProjectHasStoryContext
        && onStartNewVideoDraftFromAgent
        && intentCanStartNewVideoPlanningWithoutProject(userIntent)
      ) {
        setStatus("正在拆镜头");
        setText("");
        setAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await onStartNewVideoDraftFromAgent(userIntent);
        return;
      }
      if (!localProjectReadyForTools && intentNeedsLocalProjectBeforeTooling(userIntent)) {
        rememberAgentTimelineEntries(buildLocalBlockedAgentTimelineEntries({
          userIntent,
          title: "AI 导演：需要本地项目",
          body: "我看到了你的指令，但生成参考、发送视频、导出或继续执行前，需要先选择一个本地项目文件夹。",
          facts: [
            { label: "当前项目", value: "临时项目" },
            { label: "镜头", value: `${runtimeState.storyFlow.shots.length} 个` },
            { label: "下一步", value: "左上角打开或新建项目" },
          ],
          next: "选好项目文件夹后，再说“继续”即可。",
        }));
        setText("");
        setAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setStatus("需要本地项目");
        return;
      }
      setStatus("正在整理");
      const nextVideoPermissionContract = detectAgentVideoPermissionContract(userIntent, activeVideoPermissionContract);
      const nextActionVideoPermissionContract = visibleVideoPermissionContractFor(nextVideoPermissionContract);
      const agentDrivenContinueIntent = isContinueIntent(userIntent);
      const actionExecutionPermissionContract = agentDrivenContinueIntent
        ? undefined
        : nextActionVideoPermissionContract;
      updateVideoPermissionContract(nextVideoPermissionContract);
      if (isDirectorAgentPermissionControlOnlyIntent(userIntent)) {
        resetPreparedComposerState(agentVideoPermissionLabel(nextActionVideoPermissionContract));
        setText("");
        setAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const preparedSelection: PreparedComposerContext = {
        scopeLabel,
        selectionHint,
        userIntent,
        selectedShotId: selectionOverride?.selectedShotId || (selectionOverride?.selectedShotIds?.length === 1 ? selectionOverride.selectedShotIds[0] : undefined) || (scopedShotIds.length <= 1 ? currentSelectedShotId : undefined),
        selectedShotIds: selectionOverride?.selectedShotIds?.length ? selectionOverride.selectedShotIds : scopedShotIds.length > 1 ? scopedShotIds : undefined,
        selectedAssetId: selectionOverride?.selectedAssetId || asset?.id,
        sectionId: selectionOverride?.sectionId || (!selectionOverride?.selectedShotId && !selectionOverride?.selectedShotIds?.length && !scopedShotIds.length && !asset ? sectionId : undefined),
        videoPermissionContract: nextActionVideoPermissionContract,
      };
      const nextWorkflow = buildDirectorWorkflowState(withProjectGuide({
        runtimeState,
        userIntent,
        selection: {
          selectedShotId: preparedSelection.selectedShotId,
          selectedShotIds: preparedSelection.selectedShotIds,
          selectedAssetId: preparedSelection.selectedAssetId,
          sectionId: preparedSelection.sectionId,
        },
      }, projectReferenceGuide));
      const localAgentActionEnvelope = buildDirectorAgentActionEnvelope({
        userIntent,
	        snapshot: buildDirectorAgentStateSnapshot({
	          runtimeState,
	          currentView: sectionId ? "section" : asset ? "reference" : "story",
	          selectedShotId: preparedSelection.selectedShotId,
	          selectedShotIds: preparedSelection.selectedShotIds,
	          selectedAssetId: preparedSelection.selectedAssetId,
	          sectionId: preparedSelection.sectionId,
	          videoStatus: videoCanResume ? "recoverable" : videoSendAction?.status,
	          videoCanResume,
	          videoWaitingCount: videoSendAction?.status === "submitted" ? 1 : 0,
	          videoCompletedCount: videoSendAction?.status === "needs_review" ? 1 : 0,
	          videoReviewCount: videoSendAction?.status === "needs_review" ? 1 : 0,
	          videoDetail: videoSendAction?.message,
	        }),
        executionContract: actionExecutionPermissionContract
          ? directorAgentExecutionContractFromCreatorBoundary({
              mode: actionExecutionPermissionContract.mode,
              referenceGenerationAllowed: actionExecutionPermissionContract.referenceGenerationAllowed,
              videoSubmitAllowed: actionExecutionPermissionContract.videoSubmitAllowed,
              reason: actionExecutionPermissionContract.reason,
            })
          : undefined,
        generatedAt: nextWorkflow.generatedAt,
      });
      let stagedAgentPlan: StagePrototypeAgentPlanResult | void = undefined;
      try {
        stagedAgentPlan = await onStagePrototypeAgentPlan?.({
          userIntent,
          scopeLabel,
          selectedShotId: preparedSelection.selectedShotId,
	          selectedShotIds: preparedSelection.selectedShotIds,
	          selectedAssetId: preparedSelection.selectedAssetId,
	          sectionId: preparedSelection.sectionId,
	          videoPermissionContract: actionExecutionPermissionContract,
	          videoStatus: videoCanResume ? "recoverable" : videoSendAction?.status,
	          videoCanResume,
	          videoWaitingCount: videoSendAction?.status === "submitted" ? 1 : 0,
	          videoCompletedCount: videoSendAction?.status === "needs_review" ? 1 : 0,
	          videoReviewCount: videoSendAction?.status === "needs_review" ? 1 : 0,
	          videoDetail: videoSendAction?.message,
	          availability: currentAgentToolAvailability(),
	          generatedAt: nextWorkflow.generatedAt,
	        });
      } catch (error) {
        console.error("Failed to stage Product Agent plan", error);
        resetPreparedComposerState("整理失败，请重试");
        return;
      }
      if (stagedAgentPlan?.agentTimelineEntries?.length) {
        setAgentTimelineEntries(stagedAgentPlan.agentTimelineEntries);
      }
      if (stagedAgentPlan?.agentKernelTurn) {
        setLatestAgentKernelTurn(stagedAgentPlan.agentKernelTurn);
      }
      const nextAgentActionEnvelope = choosePreparedAgentAction(
        localAgentActionEnvelope,
        stagedAgentPlan?.agentActionEnvelope,
      );
      const nextAgentToolHandoff = handoffMatchesAction(stagedAgentPlan?.agentToolHandoff, nextAgentActionEnvelope)
        ? stagedAgentPlan?.agentToolHandoff
        : buildVibeAgentToolHandoff({
            action: nextAgentActionEnvelope,
            userConfirmed: false,
            availability: currentAgentToolAvailability(),
          });
      const agentResolvedShotIds = agentActionTargetShotIds(nextAgentActionEnvelope);
      const preparedAgentPermissionContract = agentVideoPermissionContractForAction(
        nextAgentActionEnvelope,
        nextActionVideoPermissionContract,
      );
      const finalPreparedSelection: PreparedComposerContext = {
        ...preparedSelection,
        selectedShotId: preparedSelection.selectedShotId || (agentResolvedShotIds.length === 1 ? agentResolvedShotIds[0] : undefined),
        selectedShotIds: preparedSelection.selectedShotIds || (agentResolvedShotIds.length > 1 ? agentResolvedShotIds : undefined),
        sectionId: agentResolvedShotIds.length ? undefined : preparedSelection.sectionId,
        videoPermissionContract: preparedAgentPermissionContract,
        qaFeedback: stagedAgentPlan?.qaFeedback,
        projectRecordLabel: stagedAgentPlan?.projectRecordLabel,
        projectImpactLabel: stagedAgentPlan?.projectImpactLabel,
        projectTaskLabel: stagedAgentPlan?.projectTaskLabel,
      };
      const feedbackTargetShotId = finalPreparedSelection.selectedShotId;
      const nextFeedbackRecompile = feedbackTargetShotId && storyboardProjectPlanInput && shouldBuildShotFeedbackRecompile(nextAgentActionEnvelope)
        ? buildDirectorFeedbackRecompile({
            feedback: feedbackWithSubmitCheckContext(userIntent, videoSendAction?.qaFeedback),
            targetShotId: feedbackTargetShotId,
            projectPlanInput: storyboardProjectPlanInput,
          })
        : undefined;
      const nextProjection = buildAgentPanelProjection(nextWorkflow, runtimeState, "review");
      setWorkflow(nextWorkflow);
      setProjection(nextProjection);
      setFeedbackRecompile(nextFeedbackRecompile);
      setPreparedContext(finalPreparedSelection);
      setAgentActionEnvelope(nextAgentActionEnvelope);
      setAgentToolHandoff(nextAgentToolHandoff);
      setPlanPhase("review");
      setText("");
      setAttachments([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      const stagedToolAction = nextAgentActionEnvelope.status !== "blocked" && (
        nextAgentActionEnvelope.kind === "prepare_reference_generation"
        || nextAgentActionEnvelope.kind === "prepare_video_submit"
        || nextAgentActionEnvelope.kind === "prepare_export"
        || nextAgentActionEnvelope.kind === "request_style_research"
      );
      setStatus(nextAgentActionEnvelope.status === "blocked"
          ? "需要补充"
        : agentActionIsStatusInspection(nextAgentActionEnvelope)
          ? "已检查项目状态"
        : stagedToolAction
          ? "等你确认"
        : !agentVideoPermissionAllowsVideo(preparedAgentPermissionContract)
          ? agentVideoPermissionLabel(preparedAgentPermissionContract)
        : directorFeedbackCanConfirm(nextFeedbackRecompile)
          ? "等你确认"
          : directorFeedbackNeedsConcreteDirection(nextFeedbackRecompile)
            ? "再说具体一点"
            : workflowCanConfirm(nextWorkflow) ? "等你确认" : nextProjection.shortLabel);
    } finally {
      setIsPreparingPlan(false);
    }
  }

  useEffect(() => {
    if (!resumeAgentAfterLocalProjectSetupRef.current || !localProjectReadyForTools) return;
    resumeAgentAfterLocalProjectSetupRef.current = false;
    setStatus("继续检查项目");
    void prepareChange("继续", currentComposerSelectionOverride());
  }, [localProjectReadyForTools, runtimeProjectKey]);

  function revisePlan() {
    const previousIntent = intentWithQaRevisionHint(preparedContext?.userIntent, preparedContext?.qaFeedback);
    setWorkflow(undefined);
    setProjection(undefined);
    setFeedbackRecompile(undefined);
    setPreparedContext(undefined);
    setAgentActionEnvelope(undefined);
    setAgentToolHandoff(undefined);
    setPlanPhase("idle");
    setLocalPrototypeAgentDemo(undefined);
    setIsRetryingTool(false);
    if (previousIntent) setText(previousIntent);
    setStatus(previousIntent || text.trim() ? "继续写" : "等待输入");
  }

  function reviseFromAgentMessage(message: MinimalAgentMessage) {
    const previousIntent = intentWithQaRevisionHint(preparedContext?.userIntent, preparedContext?.qaFeedback);
    const revisionIntent = [previousIntent, agentMessageRevisionIntent(message)]
      .map((part) => part.trim())
      .filter(Boolean)
      .join("\n\n");
    setWorkflow(undefined);
    setProjection(undefined);
    setFeedbackRecompile(undefined);
    setPreparedContext(undefined);
    setAgentActionEnvelope(undefined);
    setAgentToolHandoff(undefined);
    setPlanPhase("idle");
    setLocalPrototypeAgentDemo(undefined);
    setIsRetryingTool(false);
    setText(revisionIntent);
    setStatus(revisionIntent ? "继续改这一步" : "等待输入");
    window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 0);
  }

  function closeReadOnlyAgentStatus() {
    setWorkflow(undefined);
    setProjection(undefined);
    setFeedbackRecompile(undefined);
    setPreparedContext(undefined);
    setAgentActionEnvelope(undefined);
    setAgentToolHandoff(undefined);
    setPlanPhase("idle");
    setLocalPrototypeAgentDemo(undefined);
    setIsRetryingTool(false);
    setStatus("等待输入");
  }

  async function continueFromStatusInspection() {
    const nextIntent = suggestedIntentFromStatusInspection(agentActionEnvelope, preparedContext?.qaFeedback);
    closeReadOnlyAgentStatus();
    if (nextIntent) await prepareChange(nextIntent, currentComposerSelectionOverride());
  }

  async function continueFromStatusActionPath(intent: string) {
    const nextIntent = intent.trim();
    closeReadOnlyAgentStatus();
    if (nextIntent) await prepareChange(nextIntent, currentComposerSelectionOverride());
  }

  async function inspectNextAfterConfirmedAction() {
    setWorkflow(undefined);
    setProjection(undefined);
    setFeedbackRecompile(undefined);
    setPreparedContext(undefined);
    setAgentActionEnvelope(undefined);
    setAgentToolHandoff(undefined);
    setPlanPhase("idle");
    setLocalPrototypeAgentDemo(undefined);
    setIsRetryingTool(false);
    await prepareChange("现在项目怎么样", currentComposerSelectionOverride());
  }

  async function continueNextAfterConfirmedAction() {
    setWorkflow(undefined);
    setProjection(undefined);
    setFeedbackRecompile(undefined);
    setPreparedContext(undefined);
    setAgentActionEnvelope(undefined);
    setAgentToolHandoff(undefined);
    setPlanPhase("idle");
    setLocalPrototypeAgentDemo(undefined);
    setIsRetryingTool(false);
    await prepareChange("下一步", currentComposerSelectionOverride());
  }

  function buildConfirmedAgentToolHandoff(action: DirectorAgentActionEnvelope | undefined) {
    return buildConfirmedVibeAgentToolHandoff({
      action,
      availability: currentAgentToolAvailability(),
    });
  }

  function rememberConfirmedToolOutcome(
    action: DirectorAgentActionEnvelope | undefined,
    outcome: ConfirmedAgentToolRunOutcome,
  ) {
    if (!action) return;
    const generatedAt = new Date().toISOString();
    const toolResultEntry = buildVibeAgentConfirmedActionToolResultEntry({
      generatedAt,
      action,
      outcome,
    });
    const reportEntry = buildVibeAgentConfirmedActionReportEntry({
      generatedAt,
      action,
      outcome,
    });
    rememberAgentTimelineEntries([toolResultEntry, reportEntry]);
  }

  function rememberConfirmedToolStart(
    action: DirectorAgentActionEnvelope | undefined,
    options: {
      existingEntries?: VibeAgentTimelineEntry[];
      retry?: boolean;
      force?: boolean;
    } = {},
  ) {
    if (!action) return;
    const existingEntries = options.existingEntries || agentTimelineEntries;
    const alreadyRecorded = existingEntries.some((entry) =>
      entry.type === "tool_call"
      && entry.toolName === "run_confirmed_action"
      && entry.actionId === action.actionId
    );
    if (alreadyRecorded && !options.force) return;
    const entry = buildVibeAgentConfirmedActionStartedEntry({
      generatedAt: new Date().toISOString(),
      action,
      retry: options.retry,
    });
    rememberAgentTimelineEntries([entry]);
  }

  function rememberAgentTimelineEntries(entries: VibeAgentTimelineEntry[]) {
    setAgentTimelineEntries((current) => mergeVibeAgentTimelineEntries(current, entries));
    void onRememberAgentTimelineEntries?.(entries);
  }

  function rememberDirectProductAction(input: {
    phase: "started" | "running" | "completed" | "failed" | "blocked";
    toolName: DirectProductActionToolName;
    title: string;
    body: string;
    next: string;
    facts?: Array<{ label: string; value: string }>;
    dedupeKey?: string;
  }) {
    rememberAgentTimelineEntries([buildDirectProductActionTimelineEntry({
      createdAt: new Date().toISOString(),
      ...input,
    })]);
  }

  function rememberBlockedDirectProductAction(input: {
    toolName: DirectProductActionToolName;
    title: string;
    body: string;
    next: string;
    facts?: Array<{ label: string; value: string }>;
    status?: string;
  }) {
    rememberDirectProductAction({
      phase: "blocked",
      toolName: input.toolName,
      title: input.title,
      body: input.body,
      next: input.next,
      facts: input.facts,
    });
    setStatus(input.status || input.body);
  }

  useEffect(() => {
    const timelineShowsReferenceReview = agentTimelineEntries.some((entry) =>
      entry.toolName === "generate_references" && /复核/.test(`${entry.title} ${entry.body}`),
    );
    const visibleReferenceStatus = realSampleAction?.status === "needs_review" && !referenceHasReviewableAssets
      ? undefined
      : realSampleAction?.status === "verified" && referenceDisplayableCount === 0
        ? "running"
        : realSampleAction?.status;
    const projectedReferenceStatus = referenceHasReviewableAssets
      ? "needs_review"
      : referencesReadyAfterReview && timelineShowsReferenceReview
        ? "verified"
        : visibleReferenceStatus;
    const projectedReferenceMessage = referenceHasReviewableAssets
      ? `${referenceReviewCount} 项参考需要复核。`
      : referencesReadyAfterReview && timelineShowsReferenceReview
        ? "参考可用，下一步可以发送视频。"
      : realSampleAction?.status === "verified" && referenceDisplayableCount === 0
        ? "参考生成中，等待结果回到参考页。"
        : realSampleAction?.message;
    const projectedState = referenceDirectProductActionState(projectedReferenceStatus, projectedReferenceMessage);
    if (!projectedState) return;
    const alreadyVisible = agentTimelineEntries.some((entry) =>
      entry.toolName === "generate_references"
      && entry.title === projectedState.title
      && entry.body === projectedState.body
    );
    if (alreadyVisible) return;
    rememberDirectProductAction({
      phase: projectedState.phase,
      toolName: "generate_references",
      title: projectedState.title,
      body: projectedState.body,
      next: projectedState.next,
      dedupeKey: `reference_state_${projectedReferenceStatus || "unknown"}`,
      facts: [
        { label: "动作", value: "生成参考" },
        { label: "状态", value: projectedState.status },
      ],
    });
    setStatus(projectedState.status);
  }, [
    agentTimelineEntries,
    realSampleAction?.message,
    realSampleAction?.status,
    referenceDisplayableCount,
    referenceLockedCount,
    referenceHasReviewableAssets,
    referenceNeedsReview,
    referenceReviewCount,
    referencesReadyAfterReview,
  ]);

  useEffect(() => {
    const projectedState = videoDirectProductActionState(
      videoSendAction?.status,
      videoSendAction?.message,
      videoCanResume,
      videoSendAction?.suggestedActionLabel,
    );
    if (!projectedState) return;
    const alreadyVisible = agentTimelineEntries.some((entry) =>
      entry.toolName === projectedState.toolName
      && entry.title === projectedState.title
      && entry.body === projectedState.body
    );
    if (alreadyVisible) return;
    rememberDirectProductAction({
      phase: projectedState.phase,
      toolName: projectedState.toolName,
      title: projectedState.title,
      body: projectedState.body,
      next: projectedState.next,
      dedupeKey: `video_state_${videoSendAction?.status || "unknown"}_${videoCanResume ? "resume" : "normal"}`,
      facts: [
        { label: "动作", value: projectedState.toolName === "query_video" ? "查询视频" : "发送视频" },
        { label: "状态", value: projectedState.status },
      ],
    });
    setStatus(projectedState.status);
  }, [
    agentTimelineEntries,
    videoCanResume,
    videoSendAction?.message,
    videoSendAction?.status,
    videoSendAction?.suggestedActionLabel,
  ]);

  function runVisibleDirectProductAction(input: DirectProductActionCopy, performTask: () => unknown | PromiseLike<unknown>) {
    rememberDirectProductAction({
      phase: "started",
      toolName: input.toolName,
      title: input.startedTitle,
      body: input.startedBody,
      next: input.next,
      facts: input.facts,
    });
    const markCompleted = (result?: unknown) => {
      const resolved = resolveDirectProductActionResult(input, result);
      rememberDirectProductAction({
        phase: resolved.phase,
        toolName: input.toolName,
        title: resolved.title,
        body: resolved.body,
        next: resolved.next,
        facts: input.facts,
      });
      if (resolved.status) setStatus(resolved.status);
    };
    const markFailed = (error: unknown) => {
      const message = error instanceof Error && error.message.trim() ? error.message.trim() : "动作没有成功执行。";
      rememberDirectProductAction({
        phase: "failed",
        toolName: input.toolName,
        title: input.failedTitle,
        body: message,
        next: directProductActionFailureNext(input, message),
        facts: input.facts,
      });
      setStatus(message);
    };
    try {
      const result = performTask();
      if (isPromiseLike(result)) {
        void Promise.resolve(result).then(markCompleted).catch(markFailed);
      } else {
        markCompleted(result);
      }
    } catch (error) {
      markFailed(error);
    }
  }

  async function runConfirmedAgentTool(
    action: DirectorAgentActionEnvelope | undefined,
    userIntent: string,
    preparedHandoff?: DirectorAgentToolHandoff,
  ): Promise<ConfirmedAgentToolRunOutcome> {
    const confirmedToolVideoPermissionContract = agentVideoPermissionContractForAction(
      action,
      activeVideoPermissionContract,
    );
    const productAdapter = buildMinimalAgentProductAdapter({
      availability: currentAgentToolAvailability(),
      recoveryHint: videoSendAction?.message,
      videoPermissionContract: confirmedToolVideoPermissionContract,
      webSearchSettings,
      setStatus,
      setAgentToolHandoff,
      setResearchStatus,
      setReferenceStatus,
      setResearchResult,
      createReferences: onCreateP6RealSample,
      submitVideo: onSendSeedanceVideo,
      queryVideo: onSendSeedanceVideo,
      runExport: onRunExport,
    });
    return productAdapter.runConfirmedAction({
      action,
      userIntent,
      preparedHandoff,
    });
  }

  async function confirmPlan() {
    if (!workflow) return;
    const canConfirmFeedback = Boolean(
      directorFeedbackCanConfirm(feedbackRecompile)
      && onDirectorFeedbackConfirmed,
    );
    const preparedUserIntent = preparedContext?.userIntent?.trim() || await composerIntentFromInput(text, attachments);
    const canPreviewPrototypeDemo = Boolean(onPreviewPrototypeAgentDemo && preparedUserIntent && !canConfirmFeedback);
    if (!workflowCanConfirm(workflow) && !canPreviewPrototypeDemo && !canConfirmFeedback) return;
    const confirmed = workflowCanConfirm(workflow)
      ? confirmAgentPlanProjection(workflow, runtimeState)
      : undefined;
    if (confirmed) setProjection(confirmed.projection);
    setPlanPhase("confirmed");
    setStatus(canConfirmFeedback ? "正在保存修改" : canPreviewPrototypeDemo ? "正在整理预览" : "已加入待处理");
    if (confirmed) onProjectStoreApplyPlanReady?.(confirmed.applyPlan);
    if (canConfirmFeedback && feedbackRecompile && onDirectorFeedbackConfirmed) {
      rememberConfirmedToolStart(agentActionEnvelope);
      try {
        await onDirectorFeedbackConfirmed(feedbackRecompile);
        setStatus("修改已保存");
        const savedFeedbackRun: PrototypeAgentDemoRun = {
          status: "ready",
          result: {
            label: localProjectReadyForTools ? "修改计划已写入项目" : "修改计划已暂存",
            projectVibeAdded: true,
            projectSaved: localProjectReadyForTools,
            storageLabel: localProjectReadyForTools ? "已保存到项目" : "暂存想法",
            waitingReview: true,
            status: "ready",
          },
        };
        setLocalPrototypeAgentDemo(savedFeedbackRun);
        if (agentActionEnvelope) {
          rememberConfirmedToolOutcome(agentActionEnvelope, {
            status: "completed",
            label: savedFeedbackRun.result?.label || "修改计划已写入项目",
            projectRecordPreserved: true,
            waitingReview: true,
            previewReady: false,
            resultStatus: "ready",
          });
          rememberConfirmedAgentActionLogItem(
            agentActionLogItemFromResult(agentActionEnvelope, agentToolHandoff, savedFeedbackRun, "confirmed"),
          );
        }
      } catch (error) {
        console.error("Director feedback save failed", error);
        const failureDetail = error instanceof Error && error.message.trim() ? error.message.trim() : "修改保存失败";
        setStatus(`保存失败：${failureDetail}`);
        const failedFeedbackRun: PrototypeAgentDemoRun = {
          status: "error",
          result: {
            label: `修改保存失败：${failureDetail}`,
            projectVibeAdded: false,
            waitingReview: true,
            status: "error",
          },
        };
        setLocalPrototypeAgentDemo(failedFeedbackRun);
        if (agentActionEnvelope) {
          rememberConfirmedToolOutcome(agentActionEnvelope, {
            status: "failed",
            label: failedFeedbackRun.result?.label || "修改保存失败，项目已保留。",
            projectRecordPreserved: true,
            waitingReview: true,
            previewReady: false,
          });
          rememberConfirmedAgentActionLogItem(
            agentActionLogItemFromResult(agentActionEnvelope, agentToolHandoff, failedFeedbackRun, "confirmed"),
          );
        }
      }
      return;
    }
    if (!onPreviewPrototypeAgentDemo) return;
    const userIntent = preparedUserIntent;
    const confirmedVideoPermissionContract = preparedContext?.videoPermissionContract || activeVideoPermissionContract;
    const confirmedAgentToolHandoff = buildConfirmedAgentToolHandoff(agentActionEnvelope);
    if (confirmedAgentToolHandoff) {
      setAgentToolHandoff(confirmedAgentToolHandoff);
    }
    setLocalPrototypeAgentDemo({ status: "running", result: { projectVibeAdded: true, waitingReview: true } });
    let toolExecutionStarted = false;
    try {
      const previewResult = await onPreviewPrototypeAgentDemo({
        userIntent,
        scopeLabel: preparedContext?.scopeLabel || scopeLabel,
        selectedShotId: preparedContext?.selectedShotId,
        selectedShotIds: preparedContext?.selectedShotIds,
        selectedAssetId: preparedContext?.selectedAssetId,
        sectionId: preparedContext?.sectionId,
        videoPermissionContract: confirmedVideoPermissionContract,
        workflowStatus: workflow.status,
        generatedAt: workflow.generatedAt,
        applyPlan: confirmed?.applyPlan,
        agentActionEnvelope,
        agentToolHandoff: confirmedAgentToolHandoff,
        availability: currentAgentToolAvailability(),
      });
      if (previewResult?.agentTimelineEntries?.length) {
        setAgentTimelineEntries(previewResult.agentTimelineEntries);
      }
      if (previewResult?.agentKernelTurn) {
        setLatestAgentKernelTurn(previewResult.agentKernelTurn);
      }
      const authoritativeAgentActionEnvelope = previewResult?.agentActionEnvelope || agentActionEnvelope;
      if (authoritativeAgentActionEnvelope) {
        setAgentActionEnvelope(authoritativeAgentActionEnvelope);
      }
      const authoritativeAgentToolHandoff = previewResult?.agentToolHandoff || confirmedAgentToolHandoff;
      if (authoritativeAgentToolHandoff) {
        setAgentToolHandoff(authoritativeAgentToolHandoff);
      }
      toolExecutionStarted = true;
      rememberConfirmedToolStart(authoritativeAgentActionEnvelope, {
        existingEntries: previewResult?.agentTimelineEntries,
      });
      const toolRunOutcome = await runConfirmedAgentTool(authoritativeAgentActionEnvelope, userIntent, authoritativeAgentToolHandoff);
      rememberConfirmedToolOutcome(authoritativeAgentActionEnvelope, toolRunOutcome);
      const confirmedRun = confirmedToolRunResult(authoritativeAgentToolHandoff, toolRunOutcome, previewResult || undefined);
      setLocalPrototypeAgentDemo(confirmedRun);
      if (authoritativeAgentActionEnvelope) {
        rememberConfirmedAgentActionLogItem(
          agentActionLogItemFromResult(authoritativeAgentActionEnvelope, authoritativeAgentToolHandoff, confirmedRun, "confirmed"),
        );
      }
    } catch (error) {
      console.error("Confirmed Agent action failed", error);
      if (!toolExecutionStarted && confirmedAgentToolHandoff?.status === "ready" && agentActionEnvelope) {
        rememberConfirmedToolStart(agentActionEnvelope);
        const toolRunOutcome = await runConfirmedAgentTool(agentActionEnvelope, userIntent, confirmedAgentToolHandoff);
        rememberConfirmedToolOutcome(agentActionEnvelope, toolRunOutcome);
        const fallbackRun = confirmedToolRunResult(confirmedAgentToolHandoff, toolRunOutcome);
        setLocalPrototypeAgentDemo(fallbackRun);
        rememberConfirmedAgentActionLogItem(
          agentActionLogItemFromResult(agentActionEnvelope, confirmedAgentToolHandoff, fallbackRun, "confirmed"),
        );
        return;
      }
      const errorMessage = error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "动作执行失败，项目已保留。";
      setStatus("需要检查");
      const failedRun: PrototypeAgentDemoRun = {
        status: "error",
        result: {
          label: errorMessage,
          projectVibeAdded: true,
          projectSaved: true,
          storageLabel: "项目已保留",
          waitingReview: true,
          previewReady: false,
          status: "error",
        },
      };
      setLocalPrototypeAgentDemo(failedRun);
      if (agentActionEnvelope) {
        rememberConfirmedToolOutcome(agentActionEnvelope, {
          status: "failed",
          label: errorMessage,
          projectRecordPreserved: true,
          waitingReview: true,
          previewReady: false,
        });
        rememberConfirmedAgentActionLogItem(
          agentActionLogItemFromResult(agentActionEnvelope, confirmedAgentToolHandoff || agentToolHandoff, failedRun, "confirmed"),
        );
      }
    }
  }

  async function retryConfirmedAgentTool() {
    if (!agentActionEnvelope || !agentToolHandoff || isRetryingTool) return;
    const userIntent = preparedContext?.userIntent?.trim() || agentActionEnvelope.sourceContext.userIntent;
    let refreshedHandoff = agentToolHandoff;
    setIsRetryingTool(true);
    setLocalPrototypeAgentDemo({ status: "running", result: { label: "正在重试", projectVibeAdded: true, waitingReview: true } });
    try {
      refreshedHandoff = agentToolHandoff.status === "blocked"
        ? buildConfirmedAgentToolHandoff(agentActionEnvelope) || agentToolHandoff
        : agentToolHandoff;
      rememberConfirmedToolStart(agentActionEnvelope, { retry: true, force: true });
      const toolRunOutcome = await runConfirmedAgentTool(agentActionEnvelope, userIntent, refreshedHandoff);
      rememberConfirmedToolOutcome(agentActionEnvelope, toolRunOutcome);
      const retryRun = confirmedToolRunResult(refreshedHandoff, toolRunOutcome);
      setLocalPrototypeAgentDemo(retryRun);
      rememberConfirmedAgentActionLogItem(
        agentActionLogItemFromResult(agentActionEnvelope, refreshedHandoff, retryRun, "confirmed"),
      );
    } catch {
      setStatus("重试失败");
      const failedRetryRun: PrototypeAgentDemoRun = {
        status: "error",
        result: {
          label: "重试失败，项目已保留。",
          projectVibeAdded: true,
          projectSaved: true,
          storageLabel: "项目已保留",
          waitingReview: true,
          status: "error",
        },
      };
      setLocalPrototypeAgentDemo(failedRetryRun);
      rememberConfirmedToolOutcome(agentActionEnvelope, {
        status: "failed",
        label: failedRetryRun.result?.label || "重试失败，项目已保留。",
        projectRecordPreserved: true,
        waitingReview: true,
        previewReady: false,
      });
      rememberConfirmedAgentActionLogItem(
        agentActionLogItemFromResult(agentActionEnvelope, refreshedHandoff, failedRetryRun, "confirmed"),
      );
    } finally {
      setIsRetryingTool(false);
    }
  }

  const actionBlocked = agentActionEnvelope?.status === "blocked";
  const readOnlyStatusInspection = readOnlyAgentStatusInspection;
  const displayedAgentToolHandoff = readOnlyStatusInspection ? undefined : agentToolHandoff;
  const handoffPreflightBlocked = planPhase !== "confirmed" && agentToolHasPreflightBlocker(displayedAgentToolHandoff, agentActionEnvelope);
  const confirmationBlocked = Boolean(actionBlocked || handoffPreflightBlocked);
  const canConfirm = workflowCanConfirm(workflow) && !confirmationBlocked && !readOnlyStatusInspection;
  const canConfirmFeedback = Boolean(directorFeedbackCanConfirm(feedbackRecompile) && onDirectorFeedbackConfirmed);
  const hasComposerInput = Boolean(text.trim() || attachments.length);
  const composerContinueIntent = Boolean(text.trim() && isContinueIntent(text));
  const hasPreparedComposerInput = Boolean(preparedContext?.userIntent?.trim() || hasComposerInput);
  const canPreviewPrototypeDemo = Boolean(workflow && onPreviewPrototypeAgentDemo && hasPreparedComposerInput && !canConfirmFeedback && !readOnlyStatusInspection);
  const canOfferFooterDirectAction = !hasComposerInput && !isPreparingPlan && (!workflow || planPhase === "confirmed");
  const hasReferenceItemsToReview = referenceHasReviewableAssets;
  const referenceReviewFooterAction = hasReferenceItemsToReview
    ? {
        label: "去参考复核",
        disabled: !onOpenResultView,
        disabledReason: "当前还不能切换到参考页。",
        perform: () => {
          onOpenResultView?.("assets");
          setStatus("先确认这些参考能不能用。");
        },
      }
    : undefined;
  const referenceFooterAction = showRealSampleAction && !referencesUsableForAgent && realSampleAction?.status !== "verified"
    ? {
        label: realSampleLabel,
        disabled: referenceGenerationBlockedByProject || (!referenceGenerationBlockedByContract && (Boolean(realSampleAction?.disabled) || !realSampleAction?.keyConfigured || realSampleBusy || !onCreateP6RealSample)),
        disabledReason: referenceGenerationBlockedByProject
          ? "先打开或保存本地项目。"
          : referenceGenerationBlockedByContract
            ? ""
          : !realSampleAction?.keyConfigured
            ? "先在设置里连接图片服务。"
            : realSampleBusy
              ? "参考正在生成。"
              : realSampleAction?.message || "当前还不能生成参考。",
        perform: runFooterReferenceGeneration,
      }
    : undefined;
  const endFrameFooterAction = showEndFrameAction && endFrameAction?.status !== "verified"
    ? {
        label: endFrameLabel,
        disabled: referenceGenerationBlockedByProject || (!referenceGenerationBlockedByContract && (Boolean(endFrameAction?.disabled) || !endFrameAction?.keyConfigured || endFrameBusy || !onCreateImage2EndFrame)),
        disabledReason: referenceGenerationBlockedByProject
          ? "先打开或保存本地项目。"
          : referenceGenerationBlockedByContract
            ? ""
          : !endFrameAction?.keyConfigured
            ? "先在设置里连接图片服务。"
            : endFrameBusy
              ? "结束画面正在生成。"
              : endFrameAction?.message || "当前还不能生成结束画面。",
        perform: runFooterEndFrameGeneration,
      }
    : undefined;
  const videoResumeFooterAction = showVideoAction && videoSendAction && videoQueryMode
    ? {
        label: videoActionLabel,
        disabled: videoPermissionBlockedByProject || videoBusy || !onSendSeedanceVideo,
        disabledReason: videoPermissionBlockedByProject ? "先打开或保存本地项目。" : videoBusy ? "正在查询视频。" : "当前还不能查询视频。",
        perform: runFooterVideoAction,
      }
    : undefined;
  const videoSubmitFooterAction = showVideoAction && videoSendAction && videoSendAction.status !== "needs_review"
    ? {
        label: videoActionLabel,
        disabled: videoPermissionBlockedByProject || videoSubmissionBlocked || (!videoPermissionBlockedByContract && (Boolean(videoSendAction.disabled) || !videoSendAction.ready || !videoSendAction.keyConfigured || videoBusy || (videoAlreadySent && !videoCanResume) || !onSendSeedanceVideo)),
        disabledReason: videoPermissionBlockedByProject
          ? "先打开或保存本地项目。"
          : videoSubmissionBlocked
            ? videoSendAction.message || "先补参考或修改这一段，再继续提交视频。"
          : videoPermissionBlockedByContract
            ? ""
          : !videoSendAction.keyConfigured
            ? "先在设置里连接即梦。"
            : videoBusy
              ? "视频任务正在处理。"
              : videoSendAction.message || "视频还不能发送。",
        perform: runFooterVideoAction,
      }
    : undefined;
  const videoBlockedRecoveryFooterAction = videoSubmissionBlocked && videoBlockedRecoveryScopedIntent
    ? {
        label: "补参考",
        disabled: isPreparingPlan,
        disabledReason: "正在整理，稍等一下。",
        perform: () => {
          void prepareChange(videoBlockedRecoveryScopedIntent, {
            selectedShotIds: videoSendAction?.recoveryTargetShotIds,
          });
        },
      }
    : undefined;
  const exportFooterAction = projectStatusStage === "可以导出"
    ? {
        label: "导出交付包",
        disabled: !localProjectReadyForTools || !onRunExport,
        disabledReason: !localProjectReadyForTools
          ? "先打开或保存本地项目。"
          : "当前还不能导出交付包。",
        perform: () => {
          const exportTask: DirectProductActionCopy = {
            toolName: "export_project",
            startedTitle: "开始导出交付包",
            startedBody: "我会把当前项目资料、视频和报告整理成一个交付包。",
            completedTitle: "交付包已导出",
            completedBody: "交付包已经生成，可以去交付页查看。",
            failedTitle: "交付包没有导出",
            next: "去交付页查看结果，或继续告诉我哪里要调整。",
            facts: [
              { label: "目标", value: "当前项目" },
              { label: "动作", value: "导出交付包" },
            ],
          };
          runVisibleDirectProductAction(exportTask, () => onRunExport?.());
          setStatus("正在导出交付包。");
        },
      }
    : undefined;
  const openViewAlreadyActive = Boolean(agentCommand && currentView && "targetView" in agentCommand && agentCommand.targetView === currentView);
  const openViewFooterAction = !openViewAlreadyActive && agentCommand && (
    agentCommand.kind === "open_story"
    || agentCommand.kind === "open_review"
    || agentCommand.kind === "open_preview"
    || agentCommand.kind === "open_export"
  )
    ? {
        label: agentCommand.label,
        disabled: !onOpenResultView,
        disabledReason: "当前还不能切换视图。",
        perform: () => {
          onOpenResultView?.(agentCommand.targetView);
          setStatus(agentCommand.summary);
        },
      }
    : undefined;
  const waitFooterAction = agentCommand && (
    agentCommand.kind === "wait_references"
    || agentCommand.kind === "wait_video"
  )
    ? {
        label: agentCommand.label,
        disabled: true,
        disabledReason: agentCommand.detail || agentCommand.summary,
        perform: () => setStatus(agentCommand.detail || agentCommand.summary),
      }
    : undefined;
  const commandFooterDirectAction = agentCommandKind === "generate_references"
    ? referenceFooterAction
    : agentCommandKind === "submit_video"
      ? referenceReviewFooterAction || videoBlockedRecoveryFooterAction || videoSubmitFooterAction
    : agentCommandKind === "resume_video"
      ? videoResumeFooterAction
      : openViewFooterAction || waitFooterAction;
  const fallbackFooterDirectAction =
    videoResumeFooterAction
    || exportFooterAction
    || referenceReviewFooterAction
    || videoBlockedRecoveryFooterAction
    || referenceFooterAction
    || endFrameFooterAction
    || videoSubmitFooterAction;
  const availableFooterDirectAction = referenceReviewFooterAction || videoBlockedRecoveryFooterAction || commandFooterDirectAction || fallbackFooterDirectAction;
  const footerDirectAction = canOfferFooterDirectAction
    ? availableFooterDirectAction
    : undefined;
  function footerDirectActionBoundaryFor(action?: typeof availableFooterDirectAction) {
    if (!action) return "";
    if (
      referenceGenerationBlockedByContract
      && (action.label === realSampleLabel || action.label === endFrameLabel)
    ) {
      return "现在我只整理方案；确认这张卡才会生成参考。";
    }
    if (videoPermissionBlockedByContract && action.label === videoActionLabel) {
      return "现在我只整理方案；确认这张卡才会提交视频。";
    }
    if (action === exportFooterAction) {
      return "现在我只整理方案；确认这张卡才会导出交付包。";
    }
    return "";
  }
  const footerDirectActionBoundaryNotice = footerDirectActionBoundaryFor(footerDirectAction);
  const projectNeededForGeneratedStory = !localProjectReadyForTools
    && !hasComposerInput
    && runtimeState.storyFlow.shots.length > 0
    && (
      runtimeState.visualMemory.summary.missing > 0
      || runtimeState.visualMemory.summary.needsReview > 0
      || Boolean(videoSendAction?.ready)
    );
  const canCreateProjectFromFooter = Boolean(canCreateLocalProject && onCreateLocalProject);
  const canResolveProjectFromFooter = canCreateProjectFromFooter && !localProjectBusy;
  const footerActionRequiresExistingStory = Boolean(footerDirectAction)
    && runtimeState.storyFlow.shots.length > 0;
  const projectNeedsLocalFolder = !localProjectReadyForTools
    && !hasComposerInput
    && (footerActionRequiresExistingStory || projectNeededForGeneratedStory);
  const projectRequiredForWorkflow = projectNeedsLocalFolder && (canCreateProjectFromFooter || localProjectBusy);
  const projectBlockedWithoutFooterResolver = projectNeedsLocalFolder
    && !canCreateProjectFromFooter
    && !localProjectBusy;
  const projectRequirement = agentProjectRequirementCopy({
    localProjectBusy,
    canCreateLocalProject: canResolveProjectFromFooter,
  });
  const stateAwareAgentTimelineEntries = useMemo(
    () => agentTimelineEntries.filter((entry) =>
      !minimalAgentReferenceReviewMessageIsPremature(minimalAgentMessageFromTimelineEntry(entry), referenceHasReviewableAssets)
    ),
    [agentTimelineEntries, referenceHasReviewableAssets],
  );
  const agentTimelineStatusView = useMemo(
    () => buildVibeAgentTimelineStatusView(stateAwareAgentTimelineEntries),
    [stateAwareAgentTimelineEntries],
  );
  const agentTimelineStatusLine = agentTimelineStatusView
    ? `${agentTimelineStatusView.stage}：${agentTimelineStatusView.doing}`
    : "";
  const agentTimelineNextLine = agentTimelineStatusView
    ? `${agentTimelineStatusView.stage}：${agentTimelineStatusView.nextAction}`
    : "";
  const visibleTimelineConfirmationMessage = useMemo(
    () => latestVisibleTimelineConfirmationMessage(stateAwareAgentTimelineEntries, referencesUsableForAgent),
    [referencesUsableForAgent, stateAwareAgentTimelineEntries],
  );
  const latestNewVideoDraftCommitted = isCommittedNewVideoDraftAgentRun(latestPrototypeAgentDemo);
  const currentTimelineConfirmationLabel = !latestNewVideoDraftCommitted
    && visibleTimelineConfirmationMessage
    ? minimalAgentConfirmationAction(visibleTimelineConfirmationMessage, NEW_VIDEO_DRAFT_CONFIRM_LABEL).label
    : "";
  const hasAgentTimelineConfirmation = Boolean(
    visibleTimelineConfirmationMessage
    || stateAwareAgentTimelineEntries.some((entry) => entry.type === "confirmation_request" && entry.status !== "done"),
  );
  const timelineNewVideoDraftConfirmationReady = Boolean(
    !latestNewVideoDraftCommitted
      && !newVideoDraftBusyForAgent
      && visibleTimelineConfirmationMessage
      && currentTimelineConfirmationLabel
      && isNewVideoDraftConfirmationLabel(currentTimelineConfirmationLabel)
      && /等待确认|草案|确认|故事流/.test([
        agentTimelineStatusLine,
        agentTimelineNextLine,
        visibleTimelineConfirmationMessage?.body,
        visibleTimelineConfirmationMessage?.next,
      ].filter(Boolean).join(" ")),
  );
  const visibleNewVideoDraftConfirmation = Boolean(
    !latestNewVideoDraftCommitted
      && !newVideoDraftBusyForAgent
      && visibleTimelineConfirmationMessage
      && currentTimelineConfirmationLabel
      && isNewVideoDraftConfirmationLabel(currentTimelineConfirmationLabel)
      && /等待确认|草案|确认|故事流/.test([
        agentTimelineStatusLine,
        agentTimelineNextLine,
        visibleTimelineConfirmationMessage?.body,
        visibleTimelineConfirmationMessage?.next,
      ].filter(Boolean).join(" ")),
  );
  const composerPrimaryIsFresh = hasComposerInput || !workflow || planPhase === "idle" || planPhase === "confirmed";
  const composerProjectInbox = useMemo(
    () => buildProjectInboxProjection({
      assets: runtimeState.visualMemory.assets,
    }),
    [runtimeState.visualMemory.assets],
  );
  const selectedShotCountForObservation = selectedShots.length || (shot ? 1 : 0);
  const composerProjectObservation = useMemo(
    () => {
      if (projectObservation) return projectObservation;
      return buildProjectObservation({
        localProjectReady: localProjectReadyForTools,
        projectTitle: runtimeState.project.title,
        sectionCount: runtimeState.storyFlow.sections.length,
        shotCount: runtimeState.storyFlow.shots.length,
        selectedShotCount: selectedShotCountForObservation,
        referenceMissingCount: runtimeState.visualMemory.summary.missing,
        referenceReviewCount: Math.max(runtimeState.visualMemory.summary.needsReview, composerProjectInbox.needsReviewCount),
        referenceReadyCount: runtimeState.visualMemory.summary.locked,
        videoStatus: videoSendAction?.status || "not_generated",
        videoStatusLabel: videoSendAction?.suggestedActionLabel || "未发送视频",
        videoDetail: videoSendAction?.message || "",
        videoWaitingCount: videoSendAction?.status === "submitted" ? 1 : 0,
        videoCompletedCount: videoSendAction?.status === "needs_review" ? 1 : 0,
        videoReviewCount: videoSendAction?.status === "needs_review" ? 1 : 0,
        videoCanResume,
        image2Running: realSampleBusy || endFrameBusy,
        inbox: composerProjectInbox,
      });
    },
    [
      composerProjectInbox,
      endFrameBusy,
      localProjectReadyForTools,
      projectObservation,
      realSampleBusy,
      runtimeState.project.title,
      runtimeState.storyFlow.sections.length,
      runtimeState.storyFlow.shots.length,
      runtimeState.visualMemory.summary.locked,
      runtimeState.visualMemory.summary.missing,
      runtimeState.visualMemory.summary.needsReview,
      selectedShotCountForObservation,
      videoCanResume,
      videoSendAction?.message,
      videoSendAction?.status,
      videoSendAction?.suggestedActionLabel,
    ],
  );
  const composerIntentRoute = routeProjectAgentIntent({
    text,
    hasSelection: hasActiveSelection,
    hasAttachments: attachments.length > 0,
    observation: composerProjectObservation,
  });
  const primaryOperation = (() => {
    if (projectRequiredForWorkflow) {
      const label = projectRequirement.label;
      const disabledReason = projectRequirement.detail;
      return {
        label,
        disabled: !canResolveProjectFromFooter,
        disabledReason,
        statusLine: canResolveProjectFromFooter ? `下一步：${label}` : disabledReason,
        perform: () => {
          void startLocalProjectSetupFromMessage();
        },
      };
    }
    if (activeNewVideoDraftConfirmation || visibleNewVideoDraftConfirmation) {
      const confirmDraftFromAgent = onConfirmNewVideoDraftFromAgent || (() => onStartNewVideoDraftFromAgent?.(NEW_VIDEO_DRAFT_CONFIRM_LABEL));
      const disabled = Boolean((!onConfirmNewVideoDraftFromAgent && !onStartNewVideoDraftFromAgent) || hasComposerInput || attachments.length || isPreparingPlan);
      const disabledReason = isPreparingPlan
        ? "正在整理，稍等一下。"
        : hasComposerInput || attachments.length
          ? "先发送或清空当前输入，再确认草案。"
          : (!onConfirmNewVideoDraftFromAgent && !onStartNewVideoDraftFromAgent)
            ? "当前不能从消息里确认草案。"
            : "";
      return {
        label: NEW_VIDEO_DRAFT_CONFIRM_LABEL,
        disabled,
        disabledReason,
        statusLine: disabled ? disabledReason : `下一步：${NEW_VIDEO_DRAFT_CONFIRM_LABEL}`,
        perform: () => {
          void confirmDraftFromAgent();
        },
      };
    }
    if (projectBlockedWithoutFooterResolver) {
      return {
        label: "发送",
        disabled: true,
        disabledReason: "继续写想法也可以；生成参考、视频或导出前需要本地项目。",
        statusLine: hasComposerInput
          ? "想法已写好；生成前再选择项目文件夹。"
          : "等待输入：先写一句想法，确认前不会生成。",
        perform: () => {
          void prepareChange();
        },
      };
    }
    if (footerDirectAction) {
      return {
        label: footerDirectAction.label,
        disabled: footerDirectAction.disabled,
        disabledReason: footerDirectAction.disabledReason,
        statusLine: footerDirectAction.disabled ? footerDirectAction.disabledReason : footerDirectActionBoundaryNotice || `下一步：${footerDirectAction.label}`,
        perform: footerDirectAction.perform,
      };
    }
    if (composerPrimaryIsFresh) {
      const label = isPreparingPlan ? "整理中" : "发送";
      const disabledReason = !hasComposerInput
        ? "先写一句，或拖入文件。"
        : `${status || "正在整理"}，稍等一下。`;
      return {
        label,
        disabled: !hasComposerInput || isPreparingPlan,
        disabledReason,
        statusLine: !hasComposerInput || isPreparingPlan ? disabledReason : status || "等待输入",
        perform: () => {
          void prepareChange();
        },
      };
    }
    if (readOnlyStatusInspection) {
      return {
        label: "继续",
        disabled: false,
        disabledReason: "",
        statusLine: status || "等待输入",
        perform: () => {
          void continueFromStatusInspection();
        },
      };
    }
    const disabled = confirmationBlocked || (!canConfirm && !canPreviewPrototypeDemo && !canConfirmFeedback);
    const disabledReason = actionBlocked && agentActionEnvelope
      ? agentActionEnvelope.userFacingMessage
      : handoffPreflightBlocked && displayedAgentToolHandoff
        ? agentToolPreflightLabel(displayedAgentToolHandoff) || "先处理阻断。"
        : "当前不能发送。";
    return {
      label: agentReviewPrimaryLabel(agentActionEnvelope),
      disabled,
      disabledReason,
      statusLine: disabled ? disabledReason : status || "等待输入",
      perform: () => {
        void confirmPlan();
      },
    };
  })();
  const primaryDisabled = primaryOperation.disabled;
  const primaryLabel = primaryOperation.label;
  const primaryDisabledReason = primaryOperation.disabledReason;
  const statusLineText = primaryOperation.statusLine;
  const primaryDisabledPrefix = !hasComposerInput && !isPreparingPlan ? "等待输入：" : "暂不能继续：";
  const primaryAriaLabel = primaryDisabled
    ? `${primaryLabel}：${primaryDisabledReason}`
    : primaryLabel;
  const canContinuePendingNewVideoDraft = Boolean(
    newVideoDraftPendingForAgent
      && onContinueNewVideoDraftFromAgent
      && !hasComposerInput
      && !attachments.length,
  );
  const sendDisabledReason = isPreparingPlan
    ? `${status || "正在整理"}，稍等一下。`
    : newVideoDraftPlanningForAgent
      ? "AI 正在拆镜头，等草案出来后再继续。"
    : !hasComposerInput && !canContinuePendingNewVideoDraft
      ? "先写一句，或拖入文件。"
      : "";
  const sendDisabled = Boolean(sendDisabledReason);
  const sendAriaLabel = "发送";
  function handleSend() {
    if (sendDisabled) {
      setStatus(sendDisabledReason);
      return;
    }
    if (canContinuePendingNewVideoDraft) {
      setStatus("正在拆故事和镜头。");
      void onContinueNewVideoDraftFromAgent?.();
      return;
    }
    const continueDirectAction = composerContinueIntent && !attachments.length
      ? availableFooterDirectAction
      : undefined;
    if (continueDirectAction) {
      setText("");
      setAttachments([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (continueDirectAction.disabled) {
        setStatus(continueDirectAction.disabledReason);
        return;
      }
      setStatus(footerDirectActionBoundaryFor(continueDirectAction) || `下一步：${continueDirectAction.label}`);
      continueDirectAction.perform();
      return;
    }
    void prepareChange();
  }
  function handleNext() {
    if (primaryDisabled) {
      setStatus(primaryDisabledReason);
      return;
    }
    primaryOperation.perform();
  }
  const agentNextActionAvailable = !hasComposerInput && primaryLabel !== "发送" && !readOnlyStatusInspection;
  const statusReadyNewVideoDraftConfirmation = Boolean(
    !latestNewVideoDraftCommitted
      && !newVideoDraftBusyForAgent
      && !visibleTimelineConfirmationMessage
      && (
        newVideoDraftReadyForAgent
        || (
          projectStatusView?.stage === "等待确认"
          && /确认|草案|故事流|写入故事流|保存到项目/.test(`${newVideoDraftStatusCopy} ${newVideoDraftTimelineCopy}`)
        )
      ),
  );
  const footerNewVideoDraftConfirmationReady = Boolean(
    !latestNewVideoDraftCommitted
      && (
        (isNewVideoDraftConfirmationLabel(currentTimelineConfirmationLabel) && timelineNewVideoDraftConfirmationReady)
        || statusReadyNewVideoDraftConfirmation
      ),
  );
  const visibleConfirmationActionAvailable = agentNextActionAvailable
    || visibleNewVideoDraftConfirmation
    || Boolean(visibleTimelineConfirmationMessage && !hasComposerInput && !isPreparingPlan);
  const showFooterNextActionButton = (agentNextActionAvailable && !hasComposerInput) || footerNewVideoDraftConfirmationReady;
  const footerNextLabel = footerNewVideoDraftConfirmationReady ? currentTimelineConfirmationLabel || NEW_VIDEO_DRAFT_CONFIRM_LABEL : primaryLabel;
  const draftContextActive = Boolean(
    newVideoDraftBusyForAgent
      || newVideoDraftPlanningForAgent
      || newVideoDraftPendingForAgent
      || newVideoDraftReadyForAgent
      || footerNewVideoDraftConfirmationReady
      || visibleNewVideoDraftConfirmation
      || timelineNewVideoDraftConfirmationReady
      || statusReadyNewVideoDraftConfirmation
  );
  const footerProjectPlanHint = draftContextActive
    ? "草案出来后，你可以确认，也可以直接说哪里要改。"
    : videoPermissionBlockedByContract
      ? "当前只整理故事和镜头；生成参考或提交视频会再等你确认。"
      : composerProjectObservation.currentTask.plan;
  const footerPrimaryLabel = isPreparingPlan ? "整理中" : "发送";
  const footerPrimaryDisabled = sendDisabled;
  const footerPrimaryDisabledReason = sendDisabledReason;
  const footerPrimaryAriaLabel = sendAriaLabel;
  const footerPrimaryTitle = footerPrimaryDisabled
    ? footerPrimaryDisabledReason
    : "发送给 AI 导演，也可以按 Cmd Enter";
  const footerSelectionTargetCopy = hasActiveSelection
    ? agentNextActionAvailable && !hasComposerInput
      ? `你发出的下一句话会指向：${displayedCompactScopeLabel}；上方确认卡仍按卡片范围执行。`
      : `你发出的下一句话会指向：${displayedCompactScopeLabel}`
    : "";
  const footerActionIsVideoQuery = agentNextActionAvailable && videoQueryMode;
  const footerStatusCopy = hasComposerInput
    ? `识别为：${composerIntentRoute.label}`
    : canContinuePendingNewVideoDraft
      ? "内容已准备，点发送让 AI 导演拆故事"
    : agentTimelineStatusView?.stage === "等待确认" && currentTimelineConfirmationLabel
      ? `消息里等待你确认：${currentTimelineConfirmationLabel || NEW_VIDEO_DRAFT_CONFIRM_LABEL}`
    : currentTimelineConfirmationLabel
      ? `消息里等待你确认：${currentTimelineConfirmationLabel}`
    : footerNewVideoDraftConfirmationReady
      ? `消息里等待你确认：${NEW_VIDEO_DRAFT_CONFIRM_LABEL}`
    : footerActionIsVideoQuery
      ? "消息里可以查询结果，不会重复提交"
    : referenceReviewFooterAction && agentNextActionAvailable
      ? "消息里建议先去参考复核"
    : videoBlockedRecoveryFooterAction && agentNextActionAvailable && primaryLabel === videoBlockedRecoveryFooterAction.label
      ? "消息里建议补参考，不会提交视频"
    : footerDirectActionBoundaryNotice && !hasAgentTimelineConfirmation
      ? footerDirectActionBoundaryNotice
    : showFooterNextActionButton
      ? "消息里有下一步建议，也可以继续写想法。"
    : agentTimelineNextLine
      ? agentTimelineNextLine
    : primaryDisabled
      ? `${primaryDisabledPrefix}${primaryDisabledReason}`
      : `按下后：${statusLineText}`;
  const displayStatusLineText = footerActionIsVideoQuery
    ? "等待即梦结果"
    : cleanEmptyComposerStatusLine(agentTimelineStatusLine || statusLineText, hasComposerInput);
  const composerHint = footerNewVideoDraftConfirmationReady
    ? "草案没问题就在消息里确认；想改就继续说。"
    : projectRequiredForWorkflow
      ? canResolveProjectFromFooter
      ? `可以在消息中确认「${footerNextLabel}」继续；也可以继续写想法。`
      : "当前仍可继续改想法；生成前要先准备本地项目。"
    : canContinuePendingNewVideoDraft
      ? "内容已准备，点发送让 AI 导演拆故事和镜头。"
    : text.trim()
      ? "点发送或 Cmd Enter，交给 AI 导演整理"
      : attachments.length
        ? `${attachments.length} 个文件 · ${composerIntentRoute.plan[0]} · 点发送`
        : projectBlockedWithoutFooterResolver
          ? "先写一句想法，或拖入素材；我还能继续帮你整理。"
          : videoBlockedRecoveryFooterAction
            ? referenceReviewFooterAction && agentNextActionAvailable
          ? "先去参考复核，确认素材能不能用。"
          : footerDirectActionBoundaryNotice && !hasAgentTimelineConfirmation
            ? `${footerDirectActionBoundaryNotice} 也可以继续说改法。`
          : "需要时在消息中确认补参考；不会提交视频，也可以直接说改法。"
        : videoQueryMode
            ? "可以在消息中查询结果，不会重复提交"
          : hasBoundSelection
            ? showFooterNextActionButton && currentTimelineConfirmationLabel
              ? "已选中内容，直接说改法；确认前不会执行。"
              : showFooterNextActionButton
              ? "已选中内容，直接说改法。"
                : "已选中内容，直接说改法，或说“继续下一步”。"
            : showFooterNextActionButton && currentTimelineConfirmationLabel
              ? `${footerProjectPlanHint} · 等待你确认`
              : showFooterNextActionButton
                ? `${footerProjectPlanHint} · 也可以继续补充想法`
                : "先写一句想法，或拖入素材；AI 会先整理故事和镜头。";
  const footerHintCopy = composerHint.trim() === footerStatusCopy.trim() ? "" : composerHint;
  if (isComposerCollapsed) {
    return (
      <aside className="minimal-agent-panel is-collapsed">
        <button
          type="button"
          className="minimal-agent-expand-button"
          onClick={() => {
            setIsComposerCollapsed(false);
          }}
          aria-label="展开 AI 导演对话区"
        >
          <MessageCircle size={15} aria-hidden="true" />
          <span>{displayedCompactScopeLabel}</span>
          <small>{hasActiveSelection ? displayedCompactSelectionHint : "点开后输入脚本、文件或修改意见。"}</small>
          <b>展开</b>
        </button>
      </aside>
    );
  }
  const badges = agentActionEnvelope?.status === "blocked"
    ? ["需要补充", "未执行"]
    : feedbackRecompile
    ? [
        directorFeedbackCanConfirm(feedbackRecompile) ? "待确认" : "需要复核",
        directorFeedbackCanConfirm(feedbackRecompile) ? "会重编译" : "换个说法",
      ]
    : readOnlyStatusInspection
      ? ["项目状态", "只读"]
    : agentActionEnvelope
      ? [
          "待确认",
          agentActionEnvelope.toolPlan.toolName === "web_search" ? "查资料" : agentActionEnvelope.toolPlan.toolName === "project_vibe_patch" ? "改项目" : "待执行",
        ]
    : projection ? agentProjectionBadges(projection, planPhase).slice(0, 2) : workflow ? workflowBadgeLabels(workflow).slice(0, 2) : ["待确认", "会先整理"];
  const nextStep = agentActionEnvelope?.status === "blocked"
    ? preparedContext?.qaFeedback?.primaryAction || agentActionEnvelope.userFacingMessage
    : feedbackRecompile
    ? directorFeedbackCanConfirm(feedbackRecompile)
      ? "确认后保存修改，不会生成。"
      : "再具体一点：改角色、动作、场景、节奏还是声音？"
    : agentActionEnvelope
      ? agentActionEnvelope.userFacingMessage
    : projection ? agentProjectionNextStep(projection, planPhase, canConfirm) : workflow ? workflowPanelNextStepLabel(workflow, planPhase) : "用自然语言描述想调整的镜头、角色或节奏。";
  const feedbackFacts = feedbackRecompile
    ? [
        { label: "修改对象", value: feedbackRecompile.feedbackIntent.targetShotId },
        { label: "会更新", value: "参考 / 视频安排" },
        { label: "生成动作", value: directorFeedbackGenerationLabel(feedbackRecompile) },
      ]
    : [];
  const actionFacts = agentActionEnvelope
    ? [
        { label: "动作", value: agentActionEnvelope.summary },
        { label: "对象", value: directorAgentDisplayTargetLabel(agentActionEnvelope.target, agentActionEnvelope.sourceContext) },
        { label: "进度", value: agentActionEnvelope.sourceContext.projectReadiness.summary },
        { label: "模式", value: agentActionEnvelope.sourceContext.projectReadiness.modeSummary },
        { label: "当前范围", value: agentExecutionModeLabel(agentActionEnvelope) },
      ]
    : [];
  const handoffFacts = displayedAgentToolHandoff
    ? [
        { label: "项目", value: agentToolRecordLabel(displayedAgentToolHandoff) },
        { label: "动作", value: agentToolHandlerLabel(displayedAgentToolHandoff.handler) },
        { label: "范围", value: agentToolScopeLabel(displayedAgentToolHandoff, agentActionEnvelope) },
        { label: "结果", value: agentToolResultLabel(displayedAgentToolHandoff) },
        { label: "结果", value: agentToolReceiptLabel(displayedAgentToolHandoff) },
      ]
    : [];
  const statusInspectionFacts = agentStatusInspectionFacts(agentActionEnvelope);
  const stagedProjectFacts = [
    ...qaFeedbackFacts(preparedContext?.qaFeedback),
    preparedContext?.projectRecordLabel ? { label: "结果", value: preparedContext.projectRecordLabel } : undefined,
    preparedContext?.projectImpactLabel ? { label: "影响", value: preparedContext.projectImpactLabel } : undefined,
    creatorProjectTaskLabel(preparedContext?.projectTaskLabel) ? { label: "待处理", value: creatorProjectTaskLabel(preparedContext?.projectTaskLabel) || "" } : undefined,
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));
  const planFacts = readOnlyStatusInspection
    ? [
        ...statusInspectionFacts,
        ...qaFeedbackFacts(preparedContext?.qaFeedback),
        ...actionFacts.filter((fact) => fact.label === "进度" || fact.label === "模式"),
      ]
    : agentActionEnvelope?.status === "blocked" && actionFacts.length
    ? actionFacts
    : handoffFacts.length
    ? [...handoffFacts, ...stagedProjectFacts, ...actionFacts.slice(0, 1)]
    : actionFacts.length
      ? [...actionFacts, ...stagedProjectFacts]
    : feedbackFacts.length
    ? feedbackFacts
    : workflow
    ? [...workflowPlanFacts(workflow), { label: "范围", value: "故事 / 镜头 / 复核" }]
    : [];
  const visibleActionPlanFacts = planFacts.slice(0, 4);
  const actionDiffs = agentActionDiffs(agentActionEnvelope);
  const agentUnderstanding = agentActionEnvelope?.status === "blocked"
    ? preparedContext?.qaFeedback?.summary || agentActionEnvelope.userFacingMessage
    : agentActionEnvelope
      ? agentActionEnvelope.userFacingMessage
    : feedbackRecompile
    ? directorFeedbackCanConfirm(feedbackRecompile)
      ? "已整理好。确认前不会生成。"
      : "还不够明确。请说清楚要改角色、动作、分镜、场景还是声音。"
    : preparedContext?.userIntent?.trim()
    ? `已整理成待确认修改：${preparedContext.userIntent.trim()}`
    : text.trim()
    ? `我会先整理成可确认修改：${text.trim()}`
    : attachments.length
      ? `我会先识别这 ${attachments.length} 个文件。`
    : "先说想拍什么，或点一段再提修改。";
  const actionConfirmationFacts = agentActionConfirmationFacts(agentActionEnvelope, displayedAgentToolHandoff, planPhase);
  const agentExecutionTrace = agentExecutionTraceItems(agentActionEnvelope, displayedAgentToolHandoff, planPhase);
  const agentStatusActionPath = agentActionPathItems(agentActionEnvelope, preparedContext?.qaFeedback);
  const idleActionSuggestions = !workflow && !footerDirectAction && !hasComposerInput && runtimeState.storyFlow.shots.length > 0
    ? directorAgentReadinessActions(buildDirectorAgentStateSnapshot({
        runtimeState,
        currentView: sectionId ? "section" : asset ? "reference" : "story",
	        selectedShotId: scopedShotIds.length <= 1 ? currentSelectedShotId : undefined,
	        selectedShotIds: scopedShotIds.length > 1 ? scopedShotIds : undefined,
	        selectedAssetId: asset?.id,
	        sectionId: !scopedShotIds.length && !asset ? sectionId : undefined,
	        videoStatus: videoCanResume ? "recoverable" : videoSendAction?.status,
	        videoCanResume,
	        videoWaitingCount: videoSendAction?.status === "submitted" ? 1 : 0,
	        videoCompletedCount: videoSendAction?.status === "needs_review" ? 1 : 0,
	        videoReviewCount: videoSendAction?.status === "needs_review" ? 1 : 0,
	        videoDetail: videoSendAction?.message,
	      }).projectReadiness).slice(0, 3).map((item) => ({
        id: `${item.priority}:${item.kind}:${item.label}`,
        step: agentActionPathStepLabel(item.priority),
        label: item.label,
        reason: item.reason,
        priority: item.priority,
        intent: suggestedIntentFromStatusAction(item.label, item.reason),
      }))
    : [];
  const enabledResearchSuggestion = buildAgentWebResearchSuggestion(text, { ...webSearchSettings, enabled: true });
  const researchSuggestion = effectiveWebSearchReady
    ? enabledResearchSuggestion
    : {
	      ...enabledResearchSuggestion,
	      label: enabledResearchSuggestion.shouldSuggest ? "可先查资料" : "查资料未开启",
	      detail: enabledResearchSuggestion.shouldSuggest
        ? "可以先查资料；去设置里连接联网查资料。不连接也能继续整理。"
        : "连接后可先整理外部资料；不影响本地整理。",
	    };
  const showResearchPrompt = Boolean(researchResult || researchStatus !== "idle");
  const researchBusy = researchStatus === "running";
  const researchLabel = researchStatus === "running"
    ? "正在查找"
    : researchResult
      ? "资料已整理"
      : researchSuggestion.label;
  const researchDetail = researchResult
    ? `${researchResult.citations.length} 个来源，等你确认后再用。`
    : researchSuggestion.detail;
  const agentNoteLabel = workflow
    ? readOnlyStatusInspection ? "项目状态" : planPhase === "confirmed" ? "已确认" : "待确认"
    : "我先帮你整理";
  const showAgentNote = Boolean(workflow && planPhase !== "confirmed" && agentTimelineEntries.length === 0);
  useEffect(() => {
    onPendingAgentActionChange?.(showAgentNote);
  }, [onPendingAgentActionChange, showAgentNote]);
  const agentActionTitle = agentActionEnvelope?.summary
    || (feedbackRecompile ? "整理镜头修改" : preparedContext?.projectTaskLabel || "整理计划");
  const confirmedAgentResult = prototypeAgentProjection?.statusLabel
    || (agentToolHandoff ? agentToolResultLabel(agentToolHandoff) : "")
    || status;
  const confirmedAgentResultFactsList = confirmedAgentResultFacts(prototypeAgentDemo, agentToolHandoff, agentActionEnvelope);
  const showAgentResultNote = Boolean(planPhase === "confirmed" && confirmedAgentResult);
  const confirmedResultBlocked = Boolean(
    agentToolHandoff?.status === "blocked"
    || prototypeAgentDemo?.status === "error"
    || prototypeAgentDemo?.result?.status === "error"
  );
  const agentResultTarget = confirmedResultBlocked ? undefined : agentResultViewTarget(agentToolHandoff);
  const canRetryConfirmedTool = Boolean(
    planPhase === "confirmed"
    && agentActionEnvelope
    && agentToolHandoff
    && agentToolHandoff.status !== "handled_by_project_write"
    && !isRetryingTool
    && confirmedResultBlocked,
  );
  const visibleAgentCapabilityItems = agentCapabilityItems(
    currentAgentToolAvailability(),
    videoPermissionContractForUi,
    projectStatusLabel,
    localProjectReadyForTools,
  ).map((item) => {
    if (videoResultIsPrimary && item.id === "reference") {
      return { ...item, value: "已够用", tone: "ready" as const };
    }
    if (videoCanResume && item.id === "video") {
      return { ...item, value: "可查询", tone: "ready" as const };
    }
    if ((videoBusy || videoAlreadySent) && item.id === "video") {
      return { ...item, value: videoBusy ? "处理中" : "已发送", tone: "waiting" as const };
    }
    if (item.id === "reference" && realSampleBusy) {
      return { ...item, value: "生成中", tone: "waiting" as const };
    }
    return item;
  });
  const visibleAgentCapabilityGlanceItems = agentCapabilityGlanceItems(
    latestAgentKernelTurn
      ? [agentKernelCapabilityItem(latestAgentKernelTurn), ...visibleAgentCapabilityItems]
      : visibleAgentCapabilityItems,
  );
  const videoSubmitReadinessReply = agentVideoPermissionAllowsVideo(videoPermissionContractForUi)
    ? videoSubmitBlockerAgentReply(currentAgentToolAvailability().videoSubmitBlockers?.[0])
    : undefined;
  const hasVisibleActionCard = showAgentNote || showAgentResultNote || idleActionSuggestions.length > 0;
  const generationDetailsLabel = videoCanResume
    ? "可查询结果"
    : agentCommandKind === "generate_references" || agentCommandKind === "submit_video" || agentCommandKind === "resume_video"
      ? agentCommand?.label || "按需展开"
      : "按需查看";
  const realSampleDetailNeedsReview = referenceHasReviewableAssets || agentCommandKind === "open_review" || realSampleAction?.status === "needs_review";
  const showRealSampleDetailButton = realSampleDetailNeedsReview || !referenceGenerationBlockedByProject;
  const passiveAgentReply = !showAgentNote && !showAgentResultNote && projectStatusView
    ? {
      title: videoSubmitReadinessReply ? "视频提交前检查" : projectStatusView.stage,
      body: videoSubmitReadinessReply?.body || [
        projectStatusView.doing,
        projectStatusView.waitingFor ? `现在等你：${projectStatusView.waitingFor}` : "",
      ].filter(Boolean).join("。"),
      next: videoSubmitReadinessReply?.next || projectStatusView.nextAction,
      facts: videoSubmitReadinessReply
        ? [
          { label: "视频", value: videoSubmitBlockerLabel(currentAgentToolAvailability().videoSubmitBlockers?.[0]) || "先准备" },
          { label: "下一步", value: videoSubmitReadinessReply.next },
        ]
        : projectStatusView.facts.slice(0, 3),
    }
    : undefined;
  const showPassiveAgentReply = Boolean(passiveAgentReply && (
    passiveAgentReply.title !== "准备开始"
    || passiveAgentReply.body
    || passiveAgentReply.next
  ));
  const fullAgentThreadMessages: MinimalAgentMessage[] = agentTimelineEntries.map(minimalAgentMessageFromTimelineEntry);
  const storyFlowMessage = committedNewVideoDraftMessage(latestPrototypeAgentDemo) || storyFlowReadyMessage(runtimeState.storyFlow.shots.length);
  if (storyFlowMessage && !fullAgentThreadMessages.some((message) => (
    message.id === storyFlowMessage.id
    || /草案.*故事流|故事流.*草案|故事流已准备/.test(`${message.title} ${message.body}`)
  ))) {
    fullAgentThreadMessages.unshift(storyFlowMessage);
  }
  const projectInboxMessage = projectInboxAgentMessage(composerProjectInbox);
  if (projectInboxMessage && !fullAgentThreadMessages.some((message) => (
    message.id === projectInboxMessage.id
    || message.assetInboxSummary
    || /素材已识别|项目素材/.test(`${message.title} ${message.body}`)
  ))) {
    fullAgentThreadMessages.push(projectInboxMessage);
  }
  if (hasBoundSelection && selectionFocusKey && !fullAgentThreadMessages.some((message) => message.id === selectionContextMessageId(selectionFocusKey))) {
    fullAgentThreadMessages.push(minimalAgentMessageFromTimelineEntry(buildSelectionChangedTimelineEntry({
      createdAt: "1970-01-01T00:00:00.000Z",
      selectionKey: selectionFocusKey,
      label: localScopeLabel,
      hint: selectionHint,
      facts: liveSelectionChips,
    })));
  }
  const latestAgentTimelineUserEntryId = [...agentTimelineEntries].reverse().find((entry) => entry.type === "user_message")?.id || "";
  const footerNewVideoDraftConfirmationId = `footer_action_new_video_draft_${(latestAgentTimelineUserEntryId || newVideoDraftStatusCopy || "current")
    .replace(/[^a-z0-9_-]+/gi, "_")
    .slice(0, 80)}`;
  const footerActionConfirmationMessage = (() => {
    if (hasComposerInput) return undefined;
    if (footerNewVideoDraftConfirmationReady) {
      return {
        id: footerNewVideoDraftConfirmationId,
        entryType: "confirmation_request",
        role: "confirmation",
        title: "建议行动：确认这版故事",
        body: "草案已经准备好。确认后只保存到项目，不会生成参考，也不会提交视频。",
        lifecycle: "waiting_for_confirmation",
        status: "waiting",
        toolName: "write_project",
        facts: [
          { label: "目标", value: "当前草案" },
          { label: "保存", value: "项目" },
          { label: "外部提交", value: "不提交视频" },
        ],
        next: "确认后保存到项目。",
      } satisfies MinimalAgentMessage;
    }
    if (projectRequiredForWorkflow) return undefined;
    if (showAgentNote || showAgentResultNote || preparedContext?.userIntent?.trim()) return undefined;
    const action = availableFooterDirectAction;
    if (!action || action.disabled) return undefined;
    if (action === referenceFooterAction || action === endFrameFooterAction) {
      const targetLabel = "当前项目缺少的参考";
      return {
        id: `footer_action_reference_${action.label}`,
        entryType: "confirmation_request",
        role: "confirmation",
        title: "建议行动：补齐参考",
        body: "我已经看完当前项目，下一步适合先把缺少的参考图补齐。确认前不会生成图片，也不会提交视频。",
        lifecycle: "waiting_for_confirmation",
        status: "waiting",
        toolName: "generate_references",
        actionKind: "prepare_reference_generation",
        facts: [
          { label: "目标", value: targetLabel },
          { label: "执行", value: "参考生成" },
          { label: "外部提交", value: "不提交视频" },
        ],
        next: "确认后生成参考；也可以继续输入修改意见。",
      } satisfies MinimalAgentMessage;
    }
    const targetLabel = hasBoundSelection ? displayedCompactScopeLabel : "当前项目";
    if (action === videoSubmitFooterAction) {
      return {
        id: "footer_action_video_submit",
        entryType: "confirmation_request",
        role: "confirmation",
        title: "建议行动：提交视频",
        body: "参考和故事已经够用，下一步可以编译并串行提交当前视频任务。确认前不会发送到即梦。",
        lifecycle: "waiting_for_confirmation",
        status: "waiting",
        toolName: "submit_video",
        actionKind: "prepare_video_submit",
        facts: [
          { label: "目标", value: targetLabel },
          { label: "执行", value: "Seedance 视频提交" },
          { label: "外部提交", value: "确认后才提交" },
        ],
        next: "确认后只提交当前队列允许的一段视频。",
      } satisfies MinimalAgentMessage;
    }
    if (action === videoResumeFooterAction) {
      return {
        id: "footer_action_video_query",
        entryType: "confirmation_request",
        role: "confirmation",
        title: "建议行动：查询视频结果",
        body: "已有视频任务在队列里，下一步适合查询回流状态。这个动作不会重复提交视频。",
        lifecycle: "waiting_for_confirmation",
        status: "waiting",
        toolName: "query_video",
        actionKind: "query_video_result",
        facts: [
          { label: "目标", value: "已有视频任务" },
          { label: "执行", value: "查询结果" },
          { label: "外部提交", value: "不会重复提交" },
        ],
        next: "确认后查询已有任务结果。",
      } satisfies MinimalAgentMessage;
    }
    if (action === exportFooterAction) {
      return {
        id: "footer_action_export",
        entryType: "confirmation_request",
        role: "confirmation",
        title: "建议行动：导出交付包",
        body: "视频和项目资料已经够用，下一步可以生成交付包。确认前不会写入导出文件。",
        lifecycle: "waiting_for_confirmation",
        status: "waiting",
        toolName: "export_project",
        actionKind: "prepare_export",
        facts: [
          { label: "目标", value: "当前项目" },
          { label: "执行", value: "导出交付包" },
          { label: "写入文件", value: "确认后才写入" },
        ],
        next: "确认后导出交付包；也可以继续输入修改意见。",
      } satisfies MinimalAgentMessage;
    }
    return undefined;
  })();
  const shouldAppendFooterActionConfirmationMessage = Boolean(
    footerActionConfirmationMessage
      && (
        footerActionConfirmationMessage.id.startsWith("footer_action_new_video_draft")
          ? !fullAgentThreadMessages.some((message) => message.id === footerActionConfirmationMessage.id)
          : !fullAgentThreadMessages.some((message) => message.role === "confirmation")
      ),
  );
  if (footerActionConfirmationMessage && shouldAppendFooterActionConfirmationMessage) {
    fullAgentThreadMessages.push(footerActionConfirmationMessage);
  }
  for (const item of visibleAgentActionLog) {
    if (fullAgentThreadMessages.some((message) => message.actionId === item.id || message.id.includes(item.id))) continue;
    fullAgentThreadMessages.push(minimalAgentMessageFromActionLogItem(item));
  }
  const threadUserIntent = preparedContext?.userIntent?.trim()
    || ((showAgentNote || showAgentResultNote) && hasComposerInput ? text.trim() : "");
  if (threadUserIntent && !minimalAgentThreadHasUserIntent(fullAgentThreadMessages, threadUserIntent)) {
    fullAgentThreadMessages.unshift({
      id: "user-intent",
      role: "user",
      title: "你",
      body: shortAgentPanelMessageText(threadUserIntent),
    });
  }
  if (!agentTimelineEntries.length && showAgentNote) {
    fullAgentThreadMessages.push({
      id: "assistant-plan",
      role: "assistant",
	      title: `AI 导演：${agentActionTitle}`,
	      body: agentUnderstanding,
	      facts: visibleActionPlanFacts.slice(0, 3),
	      confirmationFacts: actionConfirmationFacts,
	      confirmationBoundary: actionConfirmationFacts.length
	        ? "确认前不会执行；确认后只按下面这一步推进。"
	        : undefined,
	      next: agentNextActionAvailable ? `在这条消息中确认「${primaryLabel}」后继续。` : "可以继续写想法。",
	    });
  } else if (!agentTimelineEntries.length && showAgentResultNote) {
    fullAgentThreadMessages.push({
      id: "assistant-result",
      role: "assistant",
      title: "AI 导演：已确认",
      body: confirmedAgentResult,
      facts: confirmedAgentResultFactsList.slice(0, 3),
      next: canRetryConfirmedTool ? "可以重试，或继续下一步。" : "可以继续下一步，或继续修改。",
    });
  } else if (showPassiveAgentReply && passiveAgentReply && minimalAgentThreadNeedsStatusReply(fullAgentThreadMessages)) {
    fullAgentThreadMessages.push({
      id: "assistant-status",
      role: "assistant",
      title: `AI 导演：${passiveAgentReply.title}`,
      body: passiveAgentReply.body,
      facts: passiveAgentReply.facts,
      next: passiveAgentReply.next,
    });
  }
  const threadShowsReferenceReady = fullAgentThreadMessages.some((message) =>
    message.role !== "user" && /参考可用/.test(minimalAgentMessageSearchText(message))
  );
  const threadReferencesUsableForAgent = referencesUsableForAgent || threadShowsReferenceReady;
  const stateAwareAgentThreadMessages = fullAgentThreadMessages.filter((message) =>
    !minimalAgentReferenceReviewMessageIsStale(message, threadReferencesUsableForAgent)
    && !minimalAgentReferenceReviewMessageIsPremature(message, referenceHasReviewableAssets)
    && !minimalAgentReferenceGenerationConfirmationIsStale(fullAgentThreadMessages, message, threadReferencesUsableForAgent)
    && !minimalAgentReferenceCompletionMessageIsStale(message, threadReferencesUsableForAgent)
    && !minimalAgentReferenceBlockedMessageIsStale(fullAgentThreadMessages, message)
    && !minimalAgentSelectionContextMessageIsOutsideActiveScope(message, selectionFocusKey, hasBoundSelection)
  );
  const visibleAgentThreadResult = visibleMinimalAgentMessages(stateAwareAgentThreadMessages);
  let agentThreadMessages = visibleAgentThreadResult.messages;
  const hiddenAgentThreadMessageCount = visibleAgentThreadResult.hiddenCount;
  const projectedStatusReplyMessage = showPassiveAgentReply
    && passiveAgentReply
    && minimalAgentThreadNeedsStatusReply(agentThreadMessages)
    ? {
      id: "assistant-visible-status",
      role: "assistant" as const,
      title: `AI 导演：${passiveAgentReply.title}`,
      body: passiveAgentReply.body,
      facts: passiveAgentReply.facts,
      next: passiveAgentReply.next,
    } satisfies MinimalAgentMessage
    : undefined;
  if (projectedStatusReplyMessage) {
    agentThreadMessages = [...agentThreadMessages, projectedStatusReplyMessage];
  }
  if (
    footerActionConfirmationMessage
    && !agentThreadMessages.some((message) => message.id === footerActionConfirmationMessage.id)
    && !hasComposerInput
  ) {
    agentThreadMessages = [...agentThreadMessages, footerActionConfirmationMessage];
  }
  const visibleAgentActionLogMirroredInThread = visibleAgentActionLog.some((item) =>
    agentThreadMessages.some((message) => message.actionId === item.id || message.id.includes(item.id))
  );
  const showStandaloneAgentActionLog = standaloneAgentActionLogAllowed && !visibleAgentActionLogMirroredInThread;
  const totalHiddenAgentThreadMessageCount = hiddenAgentThreadMessageCount;
  const latestAgentThreadMessageId = agentThreadMessages.at(-1)?.id || "";
  useEffect(() => {
    const thread = agentThreadRef.current;
    if (!thread || !latestAgentThreadMessageId) return;
    window.requestAnimationFrame(() => {
      thread.scrollTop = thread.scrollHeight;
    });
  }, [latestAgentThreadMessageId, agentThreadMessages.length]);
  const latestConfirmationMessageId = [...agentThreadMessages]
    .reverse()
    .find(minimalAgentMessageRequestsActionConfirmation)?.id;
  const latestSkillSaveConfirmationMessageId = [...agentThreadMessages]
    .reverse()
    .find(minimalAgentMessageRequestsSkillSave)?.id;
  const latestLocalProjectBlockedMessageId = [...agentThreadMessages]
    .reverse()
    .find(minimalAgentMessageNeedsLocalProject)?.id;
  const latestLocalProjectReadyMessageId = [...agentThreadMessages]
    .reverse()
    .find(minimalAgentMessageCompletedLocalProjectSetup)?.id;
  const latestFinalToolActionMessage = [...agentThreadMessages]
    .reverse()
    .find(minimalAgentMessageFinalToolAction);
  const latestCompletedToolActionMessageId = latestFinalToolActionMessage && minimalAgentMessageCompletedToolAction(latestFinalToolActionMessage)
    ? latestFinalToolActionMessage.id
    : undefined;
  const latestBlockedToolActionMessageId = latestFinalToolActionMessage && minimalAgentMessageBlockedToolAction(latestFinalToolActionMessage)
    ? latestFinalToolActionMessage.id
    : undefined;
  async function startLocalProjectSetupFromMessage() {
    if (!canResolveProjectFromFooter) {
      setStatus(localProjectBusy ? "正在准备本地项目文件夹。" : "当前还不能选择项目文件夹。");
      return;
    }
    setStatus("正在准备本地项目文件夹。");
    rememberAgentTimelineEntries(buildLocalProjectSetupTimelineEntries({
      createdAt: new Date().toISOString(),
      phase: "started",
    }));
    try {
      const result = await onCreateLocalProject?.();
      rememberAgentTimelineEntries(buildLocalProjectSetupTimelineEntries({
        createdAt: new Date().toISOString(),
        phase: result ? "completed" : "cancelled",
      }));
      if (result) {
        resumeAgentAfterLocalProjectSetupRef.current = true;
        setStatus("本地项目已准备，继续检查项目。");
      } else {
        resumeAgentAfterLocalProjectSetupRef.current = false;
        setStatus("没有选择项目文件夹。");
      }
    } catch (error) {
      resumeAgentAfterLocalProjectSetupRef.current = false;
      rememberAgentTimelineEntries(buildLocalProjectSetupTimelineEntries({
        createdAt: new Date().toISOString(),
        phase: "failed",
        detail: error instanceof Error ? error.message : "项目文件夹选择失败。",
      }));
      setStatus("项目文件夹选择失败。");
    }
  }
  function openReferenceReviewFromDetails() {
    onOpenResultView?.("assets");
    setStatus("去参考页检查画面。");
  }
  function pointToMainReferenceAction() {
    if (agentNextActionAvailable && /参考|生成/.test(primaryLabel)) {
      handleNext();
      return;
    }
    setStatus(referenceGenerationBlockedByProject ? "先打开或保存本地项目。" : `在消息中确认「${primaryLabel}」，我再生成参考。`);
  }
  function pointToMainVideoAction() {
    if (agentNextActionAvailable && /视频|发送|查询|补参考/.test(primaryLabel)) {
      handleNext();
      return;
    }
    setStatus(videoCanResume ? "在消息中确认「查询结果」，我继续取回视频。" : `在消息中确认「${primaryLabel}」，我再发送视频。`);
  }
  const realSampleDetailAction = realSampleDetailNeedsReview
    ? openReferenceReviewFromDetails
    : pointToMainReferenceAction;
  const realSampleDetailButtonLabel = realSampleDetailNeedsReview ? "打开复核" : "去确认生成";
  const videoDetailButtonLabel = videoQueryMode
    ? "查询结果"
    : videoSubmissionBlocked
      ? "处理阻塞"
      : videoPermissionBlockedByContract
        ? "去确认发送"
        : "发送视频";

  async function lookupSources() {
    if (!effectiveWebSearchReady || !researchSuggestion.query || researchStatus === "running") return;
    setResearchStatus("running");
    setResearchResult(undefined);
    setReferenceStatus("idle");
    try {
      const result = await requestAgentWebSearch({
        query: researchSuggestion.query,
        purpose: "style_research",
        settings: webSearchSettings,
      });
      setResearchResult(result);
      setResearchStatus("ready");
    } catch {
      setResearchStatus("blocked");
    }
  }

  async function saveReferenceMethod() {
    if (!researchResult || !onSaveResearchAsReference || referenceStatus === "saving") return;
    setReferenceStatus("saving");
    try {
      const pack = await onSaveResearchAsReference({ result: researchResult, userIntent: text.trim() || researchResult.query });
      setReferenceStatus("saved");
      setStatus("本片参考已保存，后续整理会使用。");
      setLocalPrototypeAgentDemo({
        status: "ready",
        result: {
          label: "本片参考已保存",
          projectVibeAdded: true,
          projectSaved: true,
          projectRecordLabel: "新增本片参考",
          projectImpactLabel: "分镜、提示词和文本复核",
          projectTaskLabel: pack?.title || "已加入项目参考",
          storageLabel: "已保存到项目",
          waitingReview: false,
          previewReady: false,
          status: "ready",
        },
      });
    } catch {
      setReferenceStatus("blocked");
    }
  }

  return (
    <aside className={`minimal-agent-panel ${hasVisibleActionCard ? "has-visible-action-card" : ""}`}>
      <button
        type="button"
        className="minimal-agent-collapse-button"
        onClick={() => {
          setIsComposerCollapsed(true);
        }}
        aria-label="收起 AI 导演对话区"
        title="收起 AI 导演对话区"
      >
        <ChevronDown size={13} aria-hidden="true" />
        收起
      </button>
      <div className="minimal-agent-cockpit" aria-label="AI 导演工作台">
        <div className="minimal-agent-cockpit-main">
          <div className="minimal-agent-head">
            <span>AI 导演</span>
            <strong>{displayedCompactScopeLabel}</strong>
          </div>
          <section className="minimal-agent-selection-context" aria-label="当前选择">
            <span>{exportResultIsPrimary || videoResultIsPrimary ? "当前任务" : hasActiveSelection ? "当前选择" : "怎么用"}</span>
            <p>{displayedCompactSelectionHint}</p>
            {displayedSelectionChips.length > 0 && (
              <div className="minimal-agent-context-chips" aria-label="当前引用内容">
                {displayedSelectionChips.map((item) => (
                  <small key={`${item.label}:${item.value}`}>
                    <b>{item.label}</b>
                    {item.value}
                  </small>
                ))}
              </div>
            )}
            {agentShotSwitcherItems.length > 1 && (
              <div className="minimal-agent-shot-switcher" aria-label="切换当前镜头">
                {agentShotSwitcherItems.map((item) => {
                  const selected = currentSelectedShotId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={selected ? "selected" : undefined}
                      onClick={() => {
                        onSelectShot?.(item.id);
                        setStatus(`正在看 ${item.label}，可以直接说这一段怎么改。`);
                      }}
                      aria-pressed={selected}
                      aria-label={`切换到镜头 ${item.label}：${item.title}`}
                      title={`切换到镜头 ${item.label}：${item.title}`}
                    >
                      <strong>{item.label}</strong>
                      <span>{item.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
      {showSkillStack && (
        <section className="minimal-agent-skill-stack" aria-label="当前导演技能">
          <div>
            <span>导演经验</span>
            <strong>{selectedSkillSummary?.label || "项目 Skills"}</strong>
          </div>
          <small>{selectedSkillSummary?.reason || "Agent 会按当前镜头和素材，选择合适的导演方法。"}</small>
          {selectedSkillSummary && (
            <div className="minimal-agent-skill-tags">
              {selectedSkillSummary.skillTags.slice(0, 5).map((tag) => (
                <small key={tag}>{tag}</small>
              ))}
            </div>
          )}
          <div className="minimal-agent-skill-groups" aria-label="项目 Skills">
            <small>
              <b>当前项目已加载</b>
              {projectLoadedSkillLabel}
            </small>
            <small>
              <b>Agent 推荐</b>
              {selectedSkillSummary ? `${selectedSkillSummary.label}：${recommendedSkillLabel}` : "先点一个镜头，我会解释适合的做法。"}
            </small>
            <small>
              <b>我的 Skills</b>
              {mySkillActionLabel}
            </small>
          </div>
          {(selectedSkillCard || selectedSkillSummary) && (
            <details className="minimal-agent-skill-detail" aria-label="Skill 使用说明">
              <summary>
                <span>Skill 说明</span>
                <strong>展开</strong>
              </summary>
              <small>
                <b>做什么</b>
                {selectedSkillOneLine}
              </small>
              <small>
                <b>作用于</b>
                {selectedSkillImpactLabel}
              </small>
              <small>
                <b>适合</b>
                {selectedSkillUseWhenLabel}
              </small>
              <small>
                <b>别用在</b>
                {selectedSkillAvoidWhenLabel}
              </small>
              <small>
                <b>使用镜头</b>
                {selectedSkillSourceLabel}
              </small>
            </details>
          )}
        </section>
      )}
      <details
        className="minimal-agent-advanced-controls"
        open={advancedControlsOpen}
        onToggle={(event) => setAdvancedControlsOpen(event.currentTarget.open)}
      >
        <summary>
          <span>我现在会</span>
          <strong>{agentBoundarySummaryLabel}</strong>
        </summary>
        {advancedControlsOpen && (
          <section className="minimal-agent-permission-mode minimal-agent-permission-menu" aria-label="更改 AI 导演可做范围">
            <span>可做范围</span>
            {videoPermissionModeItems.map((item) => (
              <button
                key={item.mode}
                type="button"
                className={videoPermissionContractForUi.mode === item.mode ? "is-active" : ""}
                aria-label={`AI 导演可做范围：${item.label}`}
                aria-pressed={videoPermissionContractForUi.mode === item.mode}
                disabled={Boolean(workflow)}
                title={workflow ? "当前计划已生成，先点再改一下再切换边界。" : agentVideoPermissionDetail(agentVideoPermissionForMode(item.mode))}
                onClick={() => selectVideoPermissionMode(item.mode)}
              >
                {item.label}
              </button>
            ))}
            <small>{agentBoundaryDetail}</small>
          </section>
        )}
        {advancedControlsOpen && visibleAgentCapabilityGlanceItems.length > 0 && (
          <div className="minimal-agent-capability-strip" aria-label="AI 导演当前能力">
            {visibleAgentCapabilityGlanceItems.map((item) => (
              <small key={item.id} className={item.tone}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </small>
            ))}
          </div>
        )}
        {advancedControlsOpen && idleActionSuggestions.length > 0 && (
          <section className="minimal-agent-idle-actions" aria-label="AI 导演建议下一步">
            <div>
              <span>建议下一步</span>
              <small>{idleActionHint}</small>
            </div>
            <div>
              {idleActionSuggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.priority}
                  onClick={() => void continueFromStatusActionPath(item.intent)}
                  title={item.reason}
                >
                  <span>{item.step}</span>
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>
          </section>
        )}
      </details>
      {agentThreadMessages.length > 0 && (
        <section ref={agentThreadRef} className="minimal-agent-thread" aria-label="和 AI 导演的对话" aria-live="polite">
          <span>和 AI 导演的对话</span>
          {totalHiddenAgentThreadMessageCount > 0 && (
            <small className="minimal-agent-thread-history">
              前面的记录已保存，这里只显示最近一次推进。
            </small>
          )}
          {agentThreadMessages.map((message) => {
            const messageBody = minimalAgentMessageBody(message);
            return (
            <article key={message.id} className={`minimal-agent-message ${message.role}`}>
              <div className="minimal-agent-message-head">
                <div className="minimal-agent-message-title">
                  <small className="minimal-agent-message-stage">{minimalAgentMessageStageLabel(message)}</small>
                  {minimalAgentMessageTitleLabel(message) && (
                    <strong>{minimalAgentMessageTitleLabel(message)}</strong>
                  )}
                </div>
                {minimalAgentMessageStatusLabel(message) && (
                  <small className={`minimal-agent-message-status ${message.status}`}>
                    {minimalAgentMessageStatusLabel(message)}
                  </small>
                )}
              </div>
              <p>{messageBody}</p>
              {message.executionResult && (
                <div
                  className={`minimal-agent-execution-result ${message.executionResult.status}`}
                  aria-label={`${message.title}执行回执`}
                >
                  <small>
                    <span>结果</span>
                    <strong>
                      {executionResultStatusLabel(message.executionResult.status)}：{cleanMinimalAgentMessageCopy(message.executionResult.summary)}
                    </strong>
                  </small>
                  {message.executionResult.next && (
                    <small>
                      <span>下一步</span>
                      <strong>{cleanMinimalAgentMessageCopy(message.executionResult.next)}</strong>
                    </small>
                  )}
                </div>
              )}
              {minimalAgentVisibleFacts(message).length > 0 && (
                <div className="minimal-agent-plan is-inline" aria-label={`${message.title}摘要`}>
                  {minimalAgentVisibleFacts(message).map((fact) => (
                    <small key={`${message.id}:${fact.label}:${fact.value}`}>
                      <span>{fact.label}</span>
                      <strong>{agentFactDisplayValue(fact)}</strong>
                    </small>
                  ))}
                </div>
              )}
              {minimalAgentMessageConfirmationFacts(message).length > 0 && (
                <div className="minimal-agent-confirmation-strip is-message" aria-label="这条消息确认后动作">
                  {message.confirmationBoundary && (
                    <small className="minimal-agent-confirmation-boundary-copy">
                      <span>确认</span>
                      <strong>{message.confirmationBoundary}</strong>
                    </small>
                  )}
                  {minimalAgentMessageConfirmationFacts(message).map((fact) => (
                    <small key={`${message.id}:confirm:${fact.label}:${fact.value}`}>
                      <span>{fact.label}</span>
                      <strong>{agentFactDisplayValue(fact)}</strong>
                    </small>
                  ))}
                </div>
              )}
              {message.skillRecommendations && message.skillRecommendations.length > 0 && (
                <div className="minimal-agent-skill-recommendations" aria-label="推荐方法说明">
                  {message.skillRecommendations.map((skill) => (
                    <small key={`${message.id}:${skill.label}`}>
                      <strong>{skill.label}</strong>
                      <span>{skill.reason}</span>
                      <em>
                        影响{skill.affectedShots.length ? ` ${skill.affectedShots.join("、")}` : "当前目标"}
                        {skill.impact.length ? `；作用于 ${skill.impact.join(" / ")}` : ""}
                      </em>
                    </small>
                  ))}
                </div>
              )}
              {message.assetInboxSummary && (
                <div className="minimal-agent-asset-inbox-summary" aria-label="素材识别摘要">
                  <small>
                    <strong>{message.assetInboxSummary.summary}</strong>
                    <span>{message.assetInboxSummary.nextAction}</span>
                  </small>
                  <small>
                    <span>类型</span>
                    <strong>
                      {message.assetInboxSummary.kindLabels.length
                        ? message.assetInboxSummary.kindLabels.join(" / ")
                        : "待确认"}
                    </strong>
                  </small>
                  <small>
                    <span>待确认</span>
                    <strong>
                      {message.assetInboxSummary.needsReviewCount
                        ? `${message.assetInboxSummary.needsReviewCount} 个`
                        : "没有"}
                    </strong>
                  </small>
                </div>
              )}
              {message.assetActions && message.assetActions.length > 0 && (
                <div className="minimal-agent-material-suggestions" aria-label="素材用途建议">
                  <small className="minimal-agent-action-hint">
                    我先把建议列出来，不会直接改素材。需要采用时，直接说“确认这些素材用途”。
                  </small>
                  <ul>
                    {message.assetActions.map((action) => (
                      <li key={`${message.id}:${action.id}`}>
                        <strong>{action.label}</strong>
                        <span>{action.detail}</span>
                      </li>
                    ))}
                  </ul>
                  {message.assetActionOverflow && (
                    <small className="minimal-agent-action-hint">
                      {message.assetActionOverflow.label}。{message.assetActionOverflow.detail}
                    </small>
                  )}
                </div>
              )}
              {message.next && !message.executionResult && <em>{cleanMinimalAgentMessageCopy(message.next)}</em>}
              {message.id === latestCompletedToolActionMessageId && (() => {
                const resultView = completedToolActionView(message);
                const nextIntent = agentMessageNextIntent(message);
                const resultNextAction = availableFooterDirectAction && !availableFooterDirectAction.disabled
                  ? availableFooterDirectAction
                  : undefined;
                const resultNextLabel = resultNextAction?.label || "按建议继续";
                const resultNextTitle = resultNextAction
                  ? footerDirectActionBoundaryFor(resultNextAction) || `执行下一步：${resultNextAction.label}`
                  : `把「${nextIntent}」发给 AI 导演，并保留当前选中内容。`;
                const continueFromCompletedToolAction = () => {
                  if (resultNextAction) {
                    setStatus(footerDirectActionBoundaryFor(resultNextAction) || `下一步：${resultNextAction.label}`);
                    resultNextAction.perform();
                    return;
                  }
                  void prepareChange(nextIntent, currentComposerSelectionOverride());
                };
                return (
                  <div className="minimal-agent-message-actions">
                    {resultView && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenResultView?.(resultView.view);
                          setStatus(`打开${resultView.label.replace(/^去/, "")}查看结果。`);
                        }}
                        disabled={!onOpenResultView}
                        title={onOpenResultView ? `打开${resultView.label.replace(/^去/, "")}查看这次结果。` : "当前还不能切换视图。"}
                      >
                        {resultView.label}
                      </button>
                    )}
                    <button
                      type="button"
                      className={resultView ? "secondary" : undefined}
                      onClick={continueFromCompletedToolAction}
                      disabled={isPreparingPlan}
                      title={isPreparingPlan ? "正在整理项目状态。" : resultNextTitle}
                    >
                      {resultNextLabel}
                    </button>
                  </div>
                );
              })()}
              {message.id === latestBlockedToolActionMessageId && (
                <div className="minimal-agent-message-actions">
                  {canRetryConfirmedTool && (
                    <button
                      type="button"
                      onClick={retryConfirmedAgentTool}
                      disabled={isRetryingTool}
                      title={isRetryingTool ? "正在重试。" : "重新执行刚才确认过的动作。"}
                    >
                      再试一次
                    </button>
                  )}
	                  <button
	                    type="button"
	                    className="secondary"
	                    onClick={() => reviseFromAgentMessage(message)}
	                    title="把这次失败原因和下一步建议放回输入框继续修改。"
	                  >
	                    继续修改
	                  </button>
                </div>
              )}
              {message.id === latestLocalProjectReadyMessageId && localProjectReadyForTools && (
                <div className="minimal-agent-message-actions">
                  <button
                    type="button"
                    onClick={() => void prepareChange("继续", currentComposerSelectionOverride())}
                    disabled={isPreparingPlan}
                    title={isPreparingPlan ? "正在整理项目状态。" : "让 AI 导演重新检查项目，并判断下一步。"}
                  >
                    继续检查项目
                  </button>
                </div>
              )}
              {message.id === latestLocalProjectBlockedMessageId && !localProjectReadyForTools && (
                <div className="minimal-agent-message-actions">
		                  <button
		                    type="button"
	                    onClick={startLocalProjectSetupFromMessage}
	                    disabled={!canResolveProjectFromFooter}
	                    title={canResolveProjectFromFooter ? "选择项目文件夹后，我会接着当前故事继续。" : localProjectBusy ? "正在准备本地项目文件夹。" : "当前环境暂时不能选择项目文件夹。"}
	                  >
	                    选择项目文件夹
	                  </button>
                    {!canResolveProjectFromFooter && (
                      <small className="minimal-agent-action-hint">
                        {localProjectBusy ? "正在准备项目文件夹。" : "当前环境不能直接选文件夹，请用左上角打开或新建项目。"}
                      </small>
                    )}
	                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      textareaRef.current?.focus();
                      setStatus("可以继续改故事；生成前再选择项目文件夹。");
                    }}
                  >
                    先继续改文字
	                  </button>
                </div>
              )}
              {minimalAgentMessageRequestsSkillSave(message) && message.id === latestSkillSaveConfirmationMessageId && (
                <div className="minimal-agent-message-actions">
                  <button
                    type="button"
                    onClick={() => void confirmPendingSkillSave()}
                    disabled={!pendingSkillSaveRequest}
                    title={pendingSkillSaveRequest ? "确认后保存到项目 Skills。" : "这条保存请求已经处理。"}
                  >
                    确认保存
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={revisePendingSkillSave}
                    disabled={!pendingSkillSaveRequest}
                    title="先不保存，把这句话放回输入框继续改。"
                  >
                    再改一下
                  </button>
                </div>
              )}
              {minimalAgentMessageRequestsActionConfirmation(message) && message.id === latestConfirmationMessageId && !minimalAgentMessageRequestsSkillSave(message) && (visibleConfirmationActionAvailable || !hasComposerInput) && (() => {
                const currentConfirmationIsVideoQuery = videoQueryMode || /查询/.test(primaryLabel) || /查询结果|不会重复提交/.test(footerStatusCopy);
                const confirmationAction = currentConfirmationIsVideoQuery
                  ? minimalAgentConfirmationAction({ ...message, actionKind: "query_video_result" }, primaryLabel)
                  : minimalAgentConfirmationAction(message, primaryLabel);
                const confirmationBoundary = minimalAgentConfirmationBoundary(message);
                const confirmationIsFooterAction = message.id.startsWith("footer_action_");
                const confirmationIsNewVideoDraftAction = message.id.startsWith("footer_action_new_video_draft") || visibleNewVideoDraftConfirmation;
                const confirmationMatchesPrimaryAction = Boolean(
                  agentNextActionAvailable
                  && message.actionId
                  && agentActionEnvelope?.actionId
                  && message.actionId === agentActionEnvelope.actionId
                );
                const confirmationUsesPrimaryAction = !confirmationIsNewVideoDraftAction
                  && (
                    confirmationMatchesPrimaryAction
                    || (agentNextActionAvailable && confirmationIsFooterAction)
                  );
                const confirmationDisabled = confirmationIsNewVideoDraftAction
                  ? Boolean((!onConfirmNewVideoDraftFromAgent && !onStartNewVideoDraftFromAgent) || hasComposerInput || attachments.length || isPreparingPlan)
                  : confirmationUsesPrimaryAction
                    ? primaryDisabled
                    : Boolean(hasComposerInput || attachments.length || isPreparingPlan);
                const confirmationDisabledReason = confirmationIsNewVideoDraftAction
                  ? isPreparingPlan
                    ? "正在整理，稍等一下。"
                    : hasComposerInput || attachments.length
                      ? "先发送或清空当前输入，再确认草案。"
                      : (!onConfirmNewVideoDraftFromAgent && !onStartNewVideoDraftFromAgent)
                        ? "当前不能从消息里确认草案。"
                        : ""
                  : confirmationUsesPrimaryAction
                    ? primaryDisabledReason
                    : hasComposerInput || attachments.length
                      ? "先发送或清空当前输入，再确认这条消息。"
                      : isPreparingPlan
                        ? "正在整理，稍等一下。"
                        : "";
                const confirmationButtonLabel = confirmationIsNewVideoDraftAction
                  ? confirmationAction.label
                  : confirmationUsesPrimaryAction ? confirmationAction.label : "继续确认";
                const confirmationButtonHint = confirmationIsNewVideoDraftAction
                  ? confirmationAction.hint
                  : confirmationUsesPrimaryAction
                  ? confirmationAction.hint
                  : "这条确认来自历史消息，我会先按它重新整理一次，再让你确认执行。";
                const runConfirmationAction = () => {
                  if (confirmationIsNewVideoDraftAction) {
                    const confirmDraftFromAgent = onConfirmNewVideoDraftFromAgent || (() => onStartNewVideoDraftFromAgent?.(NEW_VIDEO_DRAFT_CONFIRM_LABEL));
                    void confirmDraftFromAgent();
                    return;
                  }
                  if (confirmationUsesPrimaryAction) {
                    handleNext();
                    return;
                  }
                  void prepareChange(agentMessageConfirmationIntent(message, confirmationAction.label), currentComposerSelectionOverride());
                };
                return (
                  <div className="minimal-agent-message-actions">
                    {confirmationBoundary && (
                      <small className="minimal-agent-confirmation-boundary">
                        {confirmationBoundary}
                      </small>
                    )}
                    <button
                      type="button"
                      onClick={runConfirmationAction}
                      disabled={confirmationDisabled}
                      title={confirmationDisabled ? confirmationDisabledReason : confirmationButtonHint}
                    >
                      {confirmationButtonLabel}
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => reviseFromAgentMessage(message)}
                      title="先不确认，把这次想法放回输入框继续改。"
                    >
                      再改一下
                    </button>
                  </div>
                );
              })()}
            </article>
            );
          })}
        </section>
      )}
      {showAgentNote && (
        <section className="minimal-agent-note has-plan" aria-label="AI 导演理解">
          <div className="minimal-agent-card-head">
            <span>{agentNoteLabel}</span>
            <strong>{agentActionTitle}</strong>
          </div>
          <div className="minimal-agent-card-block">
            <small>理解</small>
            <p>{agentUnderstanding}</p>
          </div>
          {visibleActionPlanFacts.length > 0 && (
            <div className="minimal-agent-card-block">
              <small>计划</small>
              <div className="minimal-agent-plan is-inline">
                {visibleActionPlanFacts.map((fact, index) => (
                  <small key={`${fact.label}:${fact.value}:visible:${index}`}>
                    <span>{fact.label}</span>
                    <strong>{agentFactDisplayValue(fact)}</strong>
                  </small>
                ))}
              </div>
            </div>
          )}
          {actionDiffs.length > 0 && (
            <div className="minimal-agent-diff" aria-label="待确认改动">
              {actionDiffs.slice(0, 3).map((diff) => (
                <small key={`${diff.label}:${diff.value}`}>
                  <span>{diff.label}</span>
                  <strong>{diff.value}</strong>
                  <em>{diff.reason}</em>
                </small>
              ))}
            </div>
          )}
          {actionConfirmationFacts.length > 0 && (
            <div className="minimal-agent-confirmation-strip" aria-label="确认后动作">
              {actionConfirmationFacts.map((fact) => (
                <small key={`${fact.label}:${fact.value}`}>
                  <span>{fact.label}</span>
                  <strong>{agentFactDisplayValue(fact)}</strong>
                </small>
              ))}
            </div>
          )}
          {(agentExecutionTrace.length > 0 || agentStatusActionPath.length > 0) && (
            <details className="minimal-agent-evidence-details">
              <summary>执行细节</summary>
              {agentExecutionTrace.length > 0 && (
                <div className="minimal-agent-execution-trace" aria-label="AI 导演执行路径">
                  {agentExecutionTrace.map((item) => (
                    <small key={`${item.label}:${item.value}`} className={item.tone}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </small>
                  ))}
                </div>
              )}
              {agentStatusActionPath.length > 0 && (
                <div className="minimal-agent-action-path" aria-label="后续动作路径">
                  {agentStatusActionPath.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={item.priority}
                      onClick={() => void continueFromStatusActionPath(item.intent)}
                      title={`继续：${item.label}`}
                    >
                      <span>{item.step}</span>
                      <strong>{item.label}</strong>
                      <em>{item.reason}</em>
                    </button>
                  ))}
                </div>
              )}
            </details>
	          )}
	          <div className="minimal-agent-note-actions">
	            <small>{agentNextActionAvailable ? "确认后我再执行；输入框只负责继续对话。" : "可以继续写想法。"}</small>
              {agentNextActionAvailable && (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={primaryDisabled}
                  title={primaryDisabled ? primaryDisabledReason : `确认后继续：${primaryLabel}`}
                >
                  {primaryLabel}
                </button>
              )}
	            <button type="button" className="secondary" onClick={revisePlan}>
	              再改一下
	            </button>
	          </div>
        </section>
      )}
      {showAgentResultNote && (
        <section className="minimal-agent-note has-plan has-result" aria-label="上次动作结果">
          <span>已确认</span>
          <p>{confirmedAgentResult}</p>
          {confirmedAgentResultFactsList.length > 0 && (
            <div className="minimal-agent-result-facts" aria-label="确认后的项目状态">
              {confirmedAgentResultFactsList.map((fact) => (
                <small key={`${fact.label}:${fact.value}`}>
                  <span>{fact.label}</span>
                  <strong>{agentFactDisplayValue(fact)}</strong>
                </small>
              ))}
            </div>
          )}
          {actionDiffs.length > 0 && (
            <div className="minimal-agent-diff is-confirmed" aria-label="已确认改动">
              {actionDiffs.slice(0, 2).map((diff) => (
                <small key={`${diff.label}:${diff.value}:confirmed`}>
                  <span>{diff.label}</span>
                  <strong>{diff.value}</strong>
                  <em>{diff.reason}</em>
                </small>
              ))}
            </div>
          )}
          <div className="minimal-agent-note-actions">
            {canRetryConfirmedTool && (
              <button type="button" onClick={retryConfirmedAgentTool}>
                <RotateCcw size={15} />
                再试一次
              </button>
            )}
            {agentResultTarget && onOpenResultView && (
              <button type="button" onClick={openAgentResultView}>
                <ExternalLink size={14} />
                {agentResultTarget.label}
              </button>
            )}
            <button type="button" onClick={continueNextAfterConfirmedAction}>
              <CheckCircle2 size={15} />
              继续下一步
            </button>
            <button type="button" className="secondary" onClick={revisePlan}>
              <Pencil size={14} />
              继续修改
            </button>
            <button type="button" className="secondary" onClick={inspectNextAfterConfirmedAction}>
              检查下一步
            </button>
          </div>
        </section>
      )}
      {showStandaloneAgentActionLog && (
        <section className="minimal-agent-action-log" aria-label="最近动作">
          <span>最近动作</span>
          <div>
            {visibleAgentActionLog.map((item) => {
              const displayTitle = creatorFacingActionLogText(item.title, "刚才的动作");
              const displayScope = creatorFacingActionLogText(item.scope, "当前项目");
              const displayResult = creatorFacingActionLogText(item.result);
              const displayNextStep = creatorFacingActionLogText(item.nextStep, "调整后可重试");
              return (
                <div key={item.id} className={`minimal-agent-action-log-item ${item.tone}`}>
                  <button
                    type="button"
                    className="minimal-agent-action-log-followup"
                    onClick={() => continueFromAgentActionLog(item)}
                    title="把这条动作带回输入框继续改"
                  >
                    <strong>{displayTitle}</strong>
                    <em>{displayScope}</em>
                    <span>{displayResult}</span>
                    <b>{displayNextStep}</b>
                  </button>
                  {item.resultView && onOpenResultView && (
                    <button
                      type="button"
                      className="minimal-agent-action-log-view"
                      onClick={() => openAgentActionLogResultView(item)}
                      title="打开结果所在位置"
                    >
                      <ExternalLink size={12} aria-hidden="true" />
                      {item.resultView.label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
      {showResearchPrompt && (
        <section className={`minimal-agent-research ${researchStatus}`} aria-label="资料来源">
          <div className="minimal-agent-research-head">
            <span>{researchLabel}</span>
            <small>{agentWebSearchSourceLabel(webSearchSettings)}</small>
          </div>
          <p>{researchDetail}</p>
          {researchResult && (
            <div className="minimal-agent-sources">
              {researchResult.citations.slice(0, 3).map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  <span>{source.title}</span>
                  <small>{source.domain}</small>
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              ))}
            </div>
          )}
          <div className="minimal-agent-research-actions">
            <button
              type="button"
              disabled={!effectiveWebSearchReady || researchBusy}
              onClick={lookupSources}
            >
              <Search size={14} />
              查资料
            </button>
            {researchResult && onSaveResearchAsReference && (
              <button
                type="button"
                className="secondary"
                disabled={referenceStatus === "saving" || referenceStatus === "saved"}
                onClick={saveReferenceMethod}
              >
                <CheckCircle2 size={14} />
                {referenceStatus === "saved" ? "已保存" : referenceStatus === "saving" ? "保存中" : "保存为参考"}
              </button>
            )}
            {researchResult && <small>{referenceStatus === "saved" ? "后续整理会参考它。" : "采用前会先让你确认。"}</small>}
	            {!effectiveWebSearchReady && <small>在设置里连接联网查资料；不连接也能继续整理。</small>}
            {researchStatus === "blocked" && <small>暂时没有查到，稍后可重试。</small>}
            {referenceStatus === "blocked" && <small>保存失败，可重试。</small>}
          </div>
        </section>
      )}
      <div
        className={`minimal-agent-input ${isDraggingFiles ? "is-dragging" : ""}`}
        onDragEnter={(event) => handleComposerDrag(event, true)}
        onDragOver={(event) => handleComposerDrag(event, true)}
        onDragLeave={(event) => handleComposerDrag(event, false)}
        onDrop={handleComposerDrop}
      >
        <input
          ref={fileInputRef}
          hidden
          aria-hidden="true"
          tabIndex={-1}
          type="file"
          accept=".txt,.md,.srt,text/plain,text/markdown,image/*,audio/*,video/*"
          multiple
          onChange={(event) => addComposerFiles(event.currentTarget.files)}
        />
        {attachments.length > 0 && (
          <div className="minimal-agent-attachments" aria-label="已放入的文件">
            {attachments.map((attachment) => (
              <span key={attachment.id} title={attachment.file.name}>
                <b>{composerAttachmentLabel(attachment.kind)}</b>
                <small>{attachment.file.name}</small>
                <button type="button" onClick={() => removeComposerAttachment(attachment.id)} aria-label={`移除 ${attachment.file.name}`}>
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          aria-label="和 AI 导演说"
          value={text}
          onChange={(event) => updateText(event.target.value)}
	          onKeyDown={(event) => {
	            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
	              event.preventDefault();
	              if (hasComposerInput) handleSend();
	              else setStatus("先写一句，或在消息中确认。");
	            }
	          }}
          placeholder={inputPlaceholder}
        />
        <div
          className="minimal-agent-input-footer"
          data-agent-footer-action={showFooterNextActionButton ? "true" : "false"}
          data-agent-footer-draft={footerNewVideoDraftConfirmationReady ? "true" : "false"}
          data-agent-footer-confirmation-label={currentTimelineConfirmationLabel || ""}
          data-agent-project-status-stage={projectStatusView?.stage || ""}
        >
          <button
            type="button"
            className="minimal-agent-file-button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="添加脚本、图片或声音参考"
          >
            <Plus size={15} aria-hidden="true" />
            添加文件
          </button>
          <div className="minimal-agent-footer-copy" aria-label="当前输入提示">
            {footerSelectionTargetCopy && <small className="minimal-agent-footer-target">{footerSelectionTargetCopy}</small>}
            {footerHintCopy && <small>{footerHintCopy}</small>}
            <strong>{footerStatusCopy}</strong>
          </div>
          <button
            type="button"
            className="minimal-agent-send-button"
            disabled={footerPrimaryDisabled}
            title={footerPrimaryTitle}
            onClick={handleSend}
            aria-label={footerPrimaryAriaLabel}
          >
            <Send size={15} />
            {footerPrimaryLabel}
          </button>
        </div>
      </div>
      <div className="minimal-agent-status-row">
        <span>状态</span>
        <strong className="minimal-agent-status">{displayStatusLineText}</strong>
        {projection && (
          <div className="minimal-state-dots agent" aria-label={projection.shortLabel}>
            {projection.progressDots.map((dot) => (
              <i key={dot.id} className={dot.tone} title={dot.label} />
            ))}
          </div>
        )}
      </div>
      <details className="minimal-agent-details">
        <summary>{readOnlyStatusInspection ? "这次检查了什么" : "这次会改什么"}</summary>
        <div className="minimal-agent-badges" aria-label="修改摘要">
          {badges.map((badge) => (
            <small key={badge}>{badge}</small>
          ))}
        </div>
        <div className="minimal-agent-steps" aria-label="创作者路径">
          {creatorPathSteps.map((step, index) => (
            <small
              key={step.id}
              className={
                planPhase === "confirmed" || (workflow && index < 2) || (!workflow && index === 0)
                  ? "is-active"
                  : ""
              }
            >
              {step.label}
              <span>{step.detail}</span>
            </small>
          ))}
        </div>
        <div className="minimal-agent-capabilities" aria-label="现在能做">
          {visibleAgentCapabilityItems.map((item) => (
            <small key={item.id} className={item.tone}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </small>
          ))}
        </div>
        {workflow && (
          <div className="minimal-agent-plan" aria-label="修改计划详情">
            {planFacts.map((fact, index) => (
              <small key={`${fact.label}:${fact.value}:${index}`}>
                <span>{fact.label}</span>
                <strong>{agentFactDisplayValue(fact)}</strong>
              </small>
            ))}
          </div>
        )}
        {actionDiffs.length > 0 && (
          <div className="minimal-agent-diff is-compact" aria-label="待确认改动明细">
            {actionDiffs.map((diff) => (
              <small key={`${diff.label}:${diff.value}:${diff.reason}`}>
                <span>{diff.label}</span>
                <strong>{diff.value}</strong>
                <em>{diff.reason}</em>
              </small>
            ))}
          </div>
        )}
        <small className="minimal-agent-next">{nextStep}</small>
      </details>
      {prototypeAgentProjection && (
        <div className="minimal-agent-badges" aria-label="创作者预览状态">
          <small>{prototypeAgentProjection.statusLabel}</small>
          {prototypeAgentProjection.badges.filter((badge) => badge !== prototypeAgentProjection.statusLabel).map((badge) => (
            <small key={badge}>{badge}</small>
          ))}
        </div>
      )}
      {(showRealSampleAction || showVideoAction || showEndFrameAction) && (
        <details
          className="minimal-agent-generation-details"
          open={generationDetailsOpen}
          onToggle={(event) => setGenerationDetailsOpen(event.currentTarget.open)}
        >
          <summary>
            <span>Agent 可代办</span>
            <strong>{generationDetailsLabel}</strong>
          </summary>
          {generationDetailsOpen && showRealSampleAction && realSampleAction && (
            <section className={`agent-real-sample-action ${realSampleAction.status}`} aria-label="项目参考补全">
              <div>
                <span>参考图</span>
                <strong>{realSampleLabel}</strong>
                <small>{
                  referenceHasReviewableAssets
                    ? `${referenceReviewCount} 项参考等你复核。`
                  : referenceGenerationBlockedByContract
                    ? agentVideoPermissionDetail(currentVideoPermissionContract)
                    : referenceGenerationBlockedByProject
                      ? "先把草稿保存到项目文件夹，再生成参考。"
                      : realSampleAction.message || "会检查当前故事，缺的参考会放进复核区。"
                }</small>
              </div>
              {showRealSampleDetailButton && (
                <button
                  disabled={realSampleDetailNeedsReview
                    ? !onOpenResultView
                    : realSampleAction.disabled || !realSampleAction.keyConfigured || realSampleBusy}
                  onClick={realSampleDetailAction}
                  aria-label={realSampleDetailNeedsReview ? "打开参考复核" : "查看参考生成确认动作"}
                >
                  {realSampleDetailNeedsReview ? <Sparkles size={15} /> : <ArrowRight size={15} />}
                  {realSampleDetailButtonLabel}
                </button>
              )}
            </section>
          )}
          {generationDetailsOpen && showVideoAction && videoSendAction && (
            <section className={`agent-real-sample-action ${videoSendAction.status}`} aria-label="视频任务">
              <div>
                <span>视频</span>
                <strong>{videoActionLabel}</strong>
                <small>{
                  videoQueryMode
                    ? videoSendAction.message || "即梦已经收到任务，可以随时查询结果。"
                    : videoPermissionBlockedByContract
                    ? agentVideoPermissionDetail(currentVideoPermissionContract)
                    : videoPermissionBlockedByProject
                      ? "先把内容保存到项目文件夹，再发送视频。"
                      : videoSendAction.message || "会按当前故事板/全能参考策略发送；即梦排队时可以稍后查询结果。"
                }</small>
                {videoSendAction.qaFeedback && videoSendAction.qaFeedback.status !== "clear" && (
                  <small title={videoSendAction.qaFeedback.primaryAction}>{videoSendAction.qaFeedback.summary}</small>
                )}
              </div>
	              <button
	                disabled={videoQueryMode
	                  ? videoPermissionBlockedByProject || videoBusy || !onSendSeedanceVideo
	                  : videoPermissionBlockedByProject || Boolean(videoSendAction.disabled) || videoSubmissionBlocked || !videoSendAction.ready || !videoSendAction.keyConfigured || videoBusy || (videoAlreadySent && !videoQueryMode) || !onSendSeedanceVideo}
	                onClick={pointToMainVideoAction}
	                aria-label={videoQueryMode ? "查看下方发送的视频查询动作" : "查看下方发送的视频发送动作"}
	              >
	                <ArrowRight size={15} />
	                {videoDetailButtonLabel}
	              </button>
            </section>
          )}
          {generationDetailsOpen && showEndFrameAction && endFrameAction && (
            <section className={`agent-real-sample-action ${endFrameAction.status}`} aria-label="当前镜头结束画面">
              <div>
                <span>结束画面</span>
                <strong>{endFrameLabel}</strong>
                <small>{
                  referenceGenerationBlockedByContract
                    ? agentVideoPermissionDetail(currentVideoPermissionContract)
                    : referenceGenerationBlockedByProject
                      ? "先把草稿保存到项目文件夹，再生成结束画面。"
                      : endFrameAction.message || "只用于循环、变身或明确首尾控制；生成后先放到复核区。"
                }</small>
              </div>
              <button
                disabled={referenceGenerationBlockedByProject || endFrameAction.disabled || !endFrameAction.keyConfigured || endFrameBusy}
                onClick={runFooterEndFrameGeneration}
                aria-label={referenceGenerationBlockedByContract ? "先继续准备参考" : referenceGenerationBlockedByProject ? "先保存项目文件夹" : "生成当前镜头结束画面"}
              >
                {endFrameAction.keyConfigured ? <Sparkles size={15} /> : <LockKeyhole size={15} />}
                生成
              </button>
            </section>
          )}
        </details>
      )}
    </aside>
  );
}

function shouldBuildShotFeedbackRecompile(action: DirectorAgentActionEnvelope) {
  return action.kind === "revise_story_or_shot"
    && action.proposedChanges.some((change) => change.field === "selectedScopeDraft");
}
