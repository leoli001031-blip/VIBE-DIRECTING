import { useEffect, useMemo, useRef, useState, type DragEvent, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, CircleDashed, Clapperboard, ExternalLink, FolderOpen, Images, LockKeyhole, MessageCircle, PackageCheck, Pencil, Plus, RotateCcw, Search, Send, Sparkles, Video, X } from "lucide-react";
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
  directorAgentPermissionIntentDisallowsVideoSubmit,
  isDirectorAgentExplainOnlyIntent,
  isDirectorAgentPermissionControlOnlyIntent,
  stripDirectorAgentPermissionControlPhrases,
} from "../../core/directorAgentPermissionIntent";
import type { DirectorQaUserFeedback } from "../../core/directorQaUserFeedback";
import type { ExportActionState } from "../../core/exportAction";
import type { ExportWorkerState } from "../../core/exportWorker";
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
  buildAgentCurrentTaskProjection,
  type AgentCurrentTaskCompletedStep,
  type AgentCurrentTaskConfirmation,
  type AgentCurrentTaskConfirmationKind,
  type AgentCurrentTaskProjection,
  type AgentCurrentTaskStagedPlanRestore,
  type AgentCurrentTaskStep,
} from "../../core/agentCurrentTaskProjection";
import {
  buildAgentVideoPipelinePlan,
  createAgentVideoGenerationJobLedger,
  planAgentVideoProductionAction,
  selectLatestAgentVideoGenerationReviewJob,
  type AgentVideoGenerationJob,
  type AgentVideoGenerationJobLedger,
} from "../../core/agentVideoProductionContract";
import {
  agentDirectorApprovedReviewReceiptMatchesIdentity,
  type AgentDirectorReviewIdentity,
} from "../../core/agentDirectorReviewDecision";
import {
  agentDirectorReviewVersionPairCandidate,
  type AgentDirectorReviewVersion,
  type AgentDirectorReviewVersionPair,
} from "../../core/agentDirectorReviewVersionPair";
import {
  buildAgentDirectorReviewSelectionProjection,
  cancelAgentDirectorReviewPromotionConfirmation,
  cancelAgentDirectorReviewSelectionConfirmation,
  confirmAgentDirectorReviewSelection,
  createAgentDirectorReviewSelectionLedger,
  stageAgentDirectorReviewPromotion,
  stageAgentDirectorReviewSelection,
  agentDirectorReviewSelectionLedgerMatchesProject,
  type AgentDirectorReviewSelectionLedger,
} from "../../core/agentDirectorReviewSelection";
import {
  buildProjectInboxProjection,
  buildProjectObservation,
  isContinueIntent,
  requestedStoryboardShotCountFromIntent,
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
import {
  bindProjectAgentTimelineEntriesToIdentity,
  createProjectAgentStagedPlanDraft,
  type ProjectAgentActionLogItem,
  type ProjectAgentStagedPlanDraft,
  type ProjectVibeReviewReceipt,
} from "../../project";
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
  parseDirectorSkillStackIndexWithStatus,
  serializeDirectorSkillStackIndex,
  upsertDirectorSkillStackIndex,
  type DirectorSkillStackItem,
} from "../../core/directorSkillLibrary";
import {
  directorSkillDefinitionFileName,
  directorSkillRecipeFileName,
  migrateLegacyDirectorSkillCard,
  serializeDirectorSkillContract,
  parseDirectorSkillDefinition,
  parseDirectorSkillRecipe,
  type DirectorSkillDefinition,
  type DirectorSkillRecipe,
} from "../../core/directorSkillContract";
import { appendProjectDirectorSkillInvocationReceipt } from "../../project/projectDirectorSkillInvocationStore";
import {
  directorSkillSummaryForShot,
} from "./directorSkillUi";
import type { DirectorView } from "./directorTypes";
import type { ProjectStatusViewModel } from "../app/projectStatusViewModel";
import type { CreatorAgentCommand, CreatorReviewTrayItem } from "./creatorDeskTypes";
import {
  activeAgentDirectorClarificationFromTimeline,
  agentDirectorClarificationReplyIntent,
  buildAgentDirectorClarificationFreeformResolutionTimelineEntry,
  buildAgentDirectorClarificationResolutionTimelineEntry,
  buildAgentDirectorClarificationTimelineEntries,
  buildAgentDirectorClarificationTurn,
} from "./agentDirectorClarification";
import { buildAgentDirectorTurnProjection } from "./agentDirectorTurnProjection";
import {
  activeAgentDirectorReviewRevisionIntentFromTimeline,
  buildAgentDirectorReviewRevisionIntent,
  buildAgentDirectorReviewRevisionTimelineEntries,
} from "./agentDirectorReviewRevision";
import {
  activeAgentDirectorReviewRegenerationConfirmationFromTimeline,
  activeAgentDirectorReviewRegenerationProposalFromTimeline,
  agentDirectorReviewRegenerationConfirmationMatchesJob,
  buildAgentDirectorReviewRegenerationConfirmationTimelineEntries,
  buildAgentDirectorReviewRegenerationProposal,
  buildAgentDirectorReviewRegenerationProposalRevisionTimelineEntry,
  buildAgentDirectorReviewRegenerationProposalTimelineEntries,
  compileAgentDirectorReviewRegenerationPrompt,
} from "./agentDirectorReviewRegeneration";
import { cleanStoryText, formatShotNumber } from "./MinimalStoryFlow";
import { usesEndpointEndFrame } from "./videoControlModeUi";
import {
  agentTimelineHasSucceededLiveExecution,
  agentTimelineHasValidatedExecution,
  agentTimelineLiveExecutionCoversProjectedState,
  agentVideoExecutionLedgerMatchesProject,
  agentVideoExecutionReceiptFromTimelineEntry,
  createAgentVideoExecutionController,
  normalizeAgentVideoExecutionProjectRoot,
  runAgentVideoConfirmedProductAction,
  type AgentVideoExecutionAction,
  type AgentVideoExecutionContext,
  type AgentVideoExecutionController,
  type AgentVideoExecutionOperation,
  type AgentVideoExecutionProjectIdentity,
} from "./agentVideoExecutionController";

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
  executionMode?: "dry_run" | "live";
  resultView?: DirectorView;
  executionResult?: VibeAgentExecutionResultSummary;
  next?: string;
  revisionUserIntent?: string;
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
  kindCountLabels: string[];
  handlingLabels: string[];
  bindingPreviewLabels: string[];
  foldedDetailLabels: string[];
};

const MAX_VISIBLE_AGENT_THREAD_MESSAGES = 12;
const NEW_VIDEO_DRAFT_CONFIRM_LABEL = "确认这版故事";
const EXPORT_PACKAGE_CONTENTS_LABEL = "当前可打包资料、制作报告、缺失视频说明";

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

function minimalAgentAssetInboxKindCountLabels(items: unknown[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!isPlainRecord(item)) continue;
    const label = minimalAgentInboxKindLabel(stringValue(item.kind));
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => `${label} ${count}`)
    .slice(0, 6);
}

function minimalAgentAssetInboxBindingPreviewLabels(items: unknown[]) {
  const records = items.filter(isPlainRecord);
  const reviewRecords = records.filter((item) => item.needsReview === true);
  return (reviewRecords.length ? reviewRecords : records)
    .map((item) => {
      const label = stringValue(item.label) || "素材";
      const action = stringValue(item.suggestedAction);
      const binding = stringValue(item.suggestedBinding);
      if (!action && !binding) return "";
      return `${label} → ${action || binding}${action && binding ? ` / ${binding}` : ""}`;
    })
    .filter(Boolean)
    .slice(0, 3);
}

function minimalAgentAssetInboxItemLooksFoldedDetail(item: Record<string, unknown>) {
  return /细节|不单独生成参考|并入主体|镜头说明/.test([
    item.detail,
    item.suggestedBinding,
    item.suggestedAction,
    item.reason,
  ].map(stringValue).join(" "));
}

function minimalAgentAssetInboxHandlingLabels(items: unknown[]) {
  const records = items.filter(isPlainRecord);
  const foldedDetailCount = records.filter(minimalAgentAssetInboxItemLooksFoldedDetail).length;
  const standaloneCount = records.filter((item) => {
    if (minimalAgentAssetInboxItemLooksFoldedDetail(item)) return false;
    return ["character", "scene", "prop", "storyboard", "voice"].includes(stringValue(item.kind));
  }).length;
  return [
    standaloneCount ? `可独立 ${standaloneCount}` : "",
    foldedDetailCount ? `并入镜头 ${foldedDetailCount}` : "",
  ].filter(Boolean);
}

function minimalAgentAssetInboxFoldedDetailLabels(items: unknown[]) {
  return items
    .filter(isPlainRecord)
    .filter(minimalAgentAssetInboxItemLooksFoldedDetail)
    .map((item) => stringValue(item.label) || "细节参考")
    .filter(Boolean)
    .slice(0, 3);
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
    kindCountLabels: minimalAgentAssetInboxKindCountLabels(items),
    handlingLabels: minimalAgentAssetInboxHandlingLabels(items),
    bindingPreviewLabels: minimalAgentAssetInboxBindingPreviewLabels(items),
    foldedDetailLabels: minimalAgentAssetInboxFoldedDetailLabels(items),
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
    kindCountLabels: minimalAgentAssetInboxKindCountLabels(inbox.items),
    handlingLabels: minimalAgentAssetInboxHandlingLabels(inbox.items),
    bindingPreviewLabels: minimalAgentAssetInboxBindingPreviewLabels(inbox.items),
    foldedDetailLabels: minimalAgentAssetInboxFoldedDetailLabels(inbox.items),
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
      { label: "分类", value: assetInboxSummary.kindCountLabels.join("、") || assetInboxSummary.kindLabels.join("、") || "待判断" },
      { label: "待确认", value: inbox.needsReviewCount ? `${inbox.needsReviewCount} 个` : "没有" },
      { label: "保护", value: "确认前不改绑定" },
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
    detail: "去参考页可以继续逐个看；不确认前不会改绑定、生成参考或提交视频。",
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
    .replace(/自然语言先进入 staged action，确认后才写入项目整体方向。?/g, "确认后只更新项目草案。")
    .replace(/自然语言先进入 staged action，确认后写入\s*/g, "确认后只更新")
    .replace(/\bstaged action\b/g, "待确认计划")
    .replace(/不会提交\s*(?:Seedance|即梦)(?:\s*视频任务)?/g, "不提交视频")
    .replace(/会提交外部视频任务/g, "会提交 Seedance 视频任务")
    .replace(/不会提交外部视频任务/g, "不提交视频")
    .replace(/可能产生生成成本/g, "会调用生成或联网服务")
    .replace(/无生成成本/g, "不调用生成服务")
    .replace(/Image2\s*\/\s*参考生成/g, "生成参考图")
    .replace(/Image2\/参考生成链路/g, "参考图生成")
    .replace(/确认后调用参考生成/g, "确认后生成参考图")
    .replace(/只调用参考生成/g, "只生成参考图")
    .replace(/会调用图片生成/g, "会生成参考图")
    .replace(/会调用参考生成/g, "会生成参考图")
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

function minimalAgentFactIsPreConfirmationBoundary(label: string, value: string) {
  return label === "边界" && /当前只允许整理计划|需要你确认后，才能写入项目/.test(value);
}

function minimalAgentCompactFactLabels(message: MinimalAgentMessage) {
  if (message.role === "user") return new Set<string>();
  if (message.entryType === "assistant_message" && message.title === "我理解为") {
    return new Set<string>();
  }
  return undefined;
}

function minimalAgentVisibleFacts(message: MinimalAgentMessage) {
  if (!message.facts?.length) return [];
  const executionSummary = cleanMinimalAgentMessageCopy(message.executionResult?.summary || message.body).trim();
  const executionNext = cleanMinimalAgentMessageCopy(message.executionResult?.next || message.next || "").trim();
  const hasVisibleNext = Boolean(message.executionResult?.next || message.next);
  const keepInlineNextFact = message.entryType === "action_result"
    && message.toolName === "write_project"
    && /故事已(?:保存到|加入).*(?:项目|计划)/.test(message.title);
  const compactLabels = minimalAgentCompactFactLabels(message);
  const hiddenConfirmationLabels = minimalAgentMessageRequestsActionConfirmation(message)
    ? new Set(["成本", "外部提交", "写入", "保存"])
    : new Set<string>();
  return message.facts.filter((fact) => {
    const label = fact.label.trim();
    const value = agentFactDisplayValue(fact).trim();
    if (!value) return false;
    if (compactLabels && !compactLabels.has(label)) return false;
    if (message.entryType === "assistant_message" && minimalAgentFactIsPreConfirmationBoundary(label, value)) return false;
    if (hiddenConfirmationLabels.has(label)) return false;
    if (/下一步/.test(label) && !keepInlineNextFact && (hasVisibleNext || value === executionNext)) return false;
    if (/状态/.test(label) && value === executionSummary) return false;
    return true;
  });
}

function minimalAgentActionContractFacts(facts: Array<{ label: string; value: string }> = []) {
  const confirmationLabels = new Set([
    "目标",
    "会做",
    "保护",
    "写入",
    "下一步",
    "范围",
    "边界",
    "结果",
    "外部提交",
    "包含",
    "写入文件",
    "动作",
    "成本",
  ]);
  return facts.filter((fact) => confirmationLabels.has(fact.label.trim()));
}

function minimalAgentMessageConfirmationFacts(message: MinimalAgentMessage) {
  if (!minimalAgentMessageRequestsActionConfirmation(message)) return [];
  const explicitConfirmationFacts = minimalAgentActionContractFacts(message.confirmationFacts);
  if (explicitConfirmationFacts.length) return explicitConfirmationFacts;
  return minimalAgentActionContractFacts(message.facts);
}

function minimalAgentReadableConfirmationFact(fact: { label: string; value: string }) {
  const label = fact.label.trim();
  const value = agentFactDisplayValue(fact);
  if (label === "成本") return { ...fact, label: "会发生", value };
  if (label === "外部提交") {
    return {
      ...fact,
      label: /不提交|不会提交|只生成参考图/.test(value) ? "保护" : "提交",
      value,
    };
  }
  if (label === "写入" || label === "保存") return { ...fact, label: "保存", value };
  if (label === "调用") return { ...fact, label: "会做", value };
  return { ...fact, value };
}

function minimalAgentReadableConfirmationFacts(facts: Array<{ label: string; value: string }>) {
  return facts.map(minimalAgentReadableConfirmationFact);
}

function minimalAgentMessageIsReferenceGenerationConfirmation(message: MinimalAgentMessage) {
  return minimalAgentMessageIsWaitingConfirmation(message)
    && minimalAgentConfirmationAction(message, "确认执行").label === "确认生成参考";
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
  if (status === "ready_to_run") return "准备好了";
  if (status === "running") return "处理中";
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

function isMinimalAgentSelectionContextId(id: string) {
  return id.startsWith("selection_context_")
    || id.startsWith("draft_selection_context_")
    || id.startsWith("draft_material_selection_context_");
}

function minimalAgentMessageStageLabel(message: MinimalAgentMessage) {
  if (message.role === "user") return "输入";
  if (minimalAgentMessageRequestsActionConfirmation(message)) return "需要确认";
  if (message.entryType === "action_result") {
    return message.status === "blocked" ? "需要处理" : "完成结果";
  }
  if (message.entryType === "state_change") {
    if (isMinimalAgentSelectionContextId(message.id)) return "当前选择";
    if (minimalAgentMessageIsUserFacingExecutionBoundary(message)) return "工作方式";
    return message.lifecycle === "running" || message.title === "执行中" ? "正在处理" : "项目状态";
  }
  if (message.entryType === "tool_call") return "正在处理";
  if (message.entryType === "tool_result") {
    if (message.title === "推荐 Skills") return "推荐方法";
    if (message.title === "执行边界") return "确认范围";
    if (message.toolName === "inspect_project") return "项目状态";
    if (message.toolName === "classify_assets" || message.toolName === "scan_assets") return "素材识别";
    if (message.toolName === "plan_story") return "故事规划";
    if (message.toolName === "plan_next_action") return "下一步";
    return "完成结果";
  }
  if (message.role === "assistant" && /理解/.test(message.title)) return "理解";
  if (message.role === "assistant") return "回复";
  return "";
}

function minimalAgentMessageTitleLabel(message: MinimalAgentMessage) {
  const title = cleanMinimalAgentMessageCopy(message.title);
  const stage = minimalAgentMessageStageLabel(message);
  if (!title || !stage) return title;
  if (message.entryType === "assistant_message" && stage === "理解") return "";
  if (
    minimalAgentMessageRequestsActionConfirmation(message)
    && (title === "请求确认" || title === "确认修改项目" || /^请确认[:：]\s*确认修改项目$/.test(title))
  ) {
    return minimalAgentConfirmationAction(message, "确认执行").label;
  }
  const status = minimalAgentMessageStatusLabel(message);
  if (status && title === status) return "";
  if (stage === "确认范围" && title === "执行边界") return "";
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
  const executionMode = entry.details?.executionMode === "dry_run" || entry.details?.executionMode === "live"
    ? entry.details.executionMode
    : undefined;
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
      executionMode,
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
      executionMode,
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

function minimalAgentMessagesFromTimelineEntries(entries: VibeAgentTimelineEntry[]) {
  let latestUserIntent = "";
  return entries.map((entry) => {
    const message = minimalAgentMessageFromTimelineEntry(entry);
    if (entry.type === "user_message") {
      latestUserIntent = cleanMinimalAgentMessageCopy(entry.body);
      return message;
    }
    if (!latestUserIntent || !minimalAgentMessageRequestsActionConfirmation(message)) return message;
    return {
      ...message,
      revisionUserIntent: latestUserIntent,
    };
  });
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
    return message.toolName === "run_confirmed_action" ? "处理中" : "等待";
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
  if (lifecycle === "waiting_for_confirmation") return "等你确认";
  if (lifecycle === "running") return "处理中";
  if (lifecycle === "succeeded") return "已完成";
  if (lifecycle === "failed") return "失败";
  if (lifecycle === "cancelled") return "已取消";
  if (lifecycle === "needs_user_input") return "需补充";
  return "";
}

type MinimalAgentConfirmationExecutionMode = "dry_run" | "live" | undefined;

function minimalAgentConfirmationExecutionModeForCapabilities(
  message: MinimalAgentMessage,
  input: {
    referenceLiveAdapterReady: boolean;
    videoLiveAdapterReady: boolean;
    queryVideoLiveAdapterReady: boolean;
    exportLiveAdapterReady: boolean;
  },
): MinimalAgentConfirmationExecutionMode {
  if (!minimalAgentMessageRequestsActionConfirmation(message)) return undefined;
  if (message.executionMode) return message.executionMode;
  if (message.actionKind === "prepare_reference_generation") return input.referenceLiveAdapterReady ? "live" : "dry_run";
  if (message.actionKind === "prepare_video_submit") return input.videoLiveAdapterReady ? "live" : "dry_run";
  if (message.actionKind === "query_video_result") return input.queryVideoLiveAdapterReady ? "live" : "dry_run";
  if (message.actionKind === "prepare_export") return input.exportLiveAdapterReady ? "live" : "dry_run";
  return undefined;
}

function minimalAgentDryRunConfirmationDescriptor(message: MinimalAgentMessage) {
  if (message.actionKind === "prepare_reference_generation") {
    return {
      label: "确认验证参考流程",
      action: "验证补参考执行合同",
      body: "我准备验证补参考的执行合同。这一步只做本地合同验证，不会调用真实 provider，也不会生成真实参考。",
      protection: "不调用真实 provider、不生成真实参考",
    };
  }
  if (message.actionKind === "prepare_video_submit") {
    return {
      label: "确认验证视频流程",
      action: "验证视频提交执行合同",
      body: "我准备验证视频提交的执行合同。这一步只做本地合同验证，不会调用真实 provider，也不会提交或生成真实视频。",
      protection: "不调用真实 provider、不提交或生成真实视频",
    };
  }
  if (message.actionKind === "query_video_result") {
    return {
      label: "确认验证查询流程",
      action: "验证视频查询执行合同",
      body: "我准备验证视频查询的执行合同。这一步只做本地合同验证，不会调用真实 provider，也不会重复提交视频。",
      protection: "不调用真实 provider、不重复提交视频",
    };
  }
  if (message.actionKind === "prepare_export") {
    return {
      label: "确认验证导出流程",
      action: "验证导出执行合同",
      body: "我准备验证导出的执行合同。这一步只做本地合同验证，不会写入导出文件。",
      protection: "不写入导出文件",
    };
  }
  return undefined;
}

function minimalAgentConfirmationMessageForExecutionMode(
  message: MinimalAgentMessage,
  executionMode: MinimalAgentConfirmationExecutionMode,
) {
  if (executionMode !== "dry_run" || !minimalAgentMessageRequestsActionConfirmation(message)) return message;
  const descriptor = minimalAgentDryRunConfirmationDescriptor(message);
  if (!descriptor) return message;
  const targetFact = minimalAgentFactValue(message, ["目标", "影响"]);
  return {
    ...message,
    title: `请确认：${descriptor.label}`,
    body: descriptor.body,
    facts: [
      { label: "动作", value: descriptor.action },
      ...(targetFact ? [{ label: "目标", value: targetFact }] : []),
      { label: "方式", value: "本地合同验证" },
      { label: "保护", value: descriptor.protection },
    ],
    confirmationFacts: [
      { label: "会做", value: "本地合同验证" },
      { label: "保护", value: descriptor.protection },
    ],
    confirmationBoundary: `这次只做本地合同验证；${descriptor.protection}。`,
    next: "确认后只验证执行合同；真实项目状态不会被伪造。",
  };
}

function minimalAgentConfirmationAction(message: MinimalAgentMessage, fallbackLabel: string) {
  if (minimalAgentFactValue(message, ["方式"]) === "本地合同验证") {
    const descriptor = minimalAgentDryRunConfirmationDescriptor(message);
    if (descriptor) {
      return {
        label: descriptor.label,
        hint: `${descriptor.body}确认后只验证执行合同。`,
      };
    }
  }
  const providerFact = minimalAgentFactValue(message, ["外部提交", "会做", "执行", "调用", "成本"]);
  const impactFact = minimalAgentFactValue(message, ["目标", "影响"]);
  const writeFact = minimalAgentFactValue(message, ["写入", "保存"]);
  const writeHint = writeFact && writeFact !== "不写文件" ? `，预计保存到${writeFact}` : "";
  if (message.toolName === "save_skill") {
    return {
      label: "确认保存 Skill",
      hint: "确认后只保存到项目 Skills，不生成参考或提交视频。",
    };
  }
  if (message.actionKind === "prepare_reference_generation") {
    return {
      label: "确认生成参考",
      hint: `确认后处理${impactFact || "当前镜头"}，${providerFact || "会生成参考图，不会提交视频"}${writeHint}。`,
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
      hint: "确认后只生成本地交付包和报告，不生成缺失视频。",
    };
  }
  if (message.actionKind === "revise_story_or_shot") {
    const concreteProjectEditLabel = minimalAgentProjectDraftEditConfirmationLabel(message);
    return {
      label: concreteProjectEditLabel || "确认修改",
      hint: "确认后把这版修改加入当前项目草案，不会自动生成参考或提交视频。",
    };
  }
  if (message.actionKind === "update_shot_strategy") {
    return {
      label: "确认修改方式",
      hint: `确认后只更新${impactFact || "当前镜头"}的生成方式，不会生成参考或提交视频。`,
    };
  }
  if (minimalAgentMessageIsProjectDraftEdit(message)) {
    const concreteProjectEditLabel = minimalAgentProjectDraftEditConfirmationLabel(message);
    return {
      label: concreteProjectEditLabel || "确认修改",
      hint: "确认后把这版修改加入当前项目草案，不会自动生成参考或提交视频。",
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
  if (minimalAgentMessageIsLocalProjectSetup(message)) {
    return {
      label: "选择保存位置",
      hint: "确认后只让你选择故事保存位置，不会生成参考、提交视频或导出。",
    };
  }
  if (/写入项目|写项目|改项目|只写项目/.test(providerFact) || /写入项目|修改项目/.test(`${message.body} ${message.next || ""}`)) {
    const concreteProjectEditLabel = minimalAgentProjectDraftEditConfirmationLabel(message);
    return {
      label: concreteProjectEditLabel || "确认修改",
      hint: "确认后把这版修改加入当前项目草案，不会自动生成参考或提交视频。",
    };
  }
  if (message.actionKind === "request_style_research") {
    return {
      label: "确认查资料",
      hint: "确认后联网查资料，结果会先回到消息流里。",
    };
  }
  if (/草案|故事流|写入故事|保存故事|确认故事/.test(`${message.title} ${message.body} ${message.next || ""}`)) {
    return {
      label: NEW_VIDEO_DRAFT_CONFIRM_LABEL,
      hint: "确认后只保存故事，不会生成参考或提交视频。",
    };
  }
  return {
    label: "确认执行",
    hint: "确认后继续当前消息里的动作，不会切换到其他推荐任务。",
  };
}

function minimalAgentMessageIsNewVideoDraftConfirmation(
  message: MinimalAgentMessage,
  action = minimalAgentConfirmationAction(message, NEW_VIDEO_DRAFT_CONFIRM_LABEL),
) {
  return minimalAgentMessageRequestsActionConfirmation(message)
    && (
      message.id.startsWith("footer_action_new_video_draft")
      || message.id.startsWith("new_video_confirmation_")
      || isNewVideoDraftConfirmationLabel(action.label)
    );
}

function minimalAgentFactValue(message: MinimalAgentMessage, labels: string[]) {
  const value = message.facts?.find((fact) => labels.includes(fact.label))?.value || "";
  return cleanMinimalAgentMessageCopy(value);
}

function minimalAgentProjectDraftEditConfirmationLabel(message: MinimalAgentMessage) {
  const changedFacts = (message.facts || [])
    .map((fact) => `${fact.label} ${agentFactDisplayValue(fact)}`)
    .join(" ");
  const combinedCopy = cleanMinimalAgentMessageCopy([
    minimalAgentFactValue(message, ["动作", "会做", "执行", "调用", "成本"]),
    message.title,
    message.body,
    message.next || "",
    changedFacts,
  ].join(" "));
  const requestedShotCount = requestedStoryboardShotCountFromIntent(combinedCopy);
  return requestedShotCount ? `确认重排为 ${requestedShotCount} 个镜头` : "";
}

function minimalAgentMessageIsProjectDraftEdit(message: MinimalAgentMessage) {
  if (message.actionKind === "revise_story_or_shot" || message.actionKind === "update_shot_strategy") return true;
  const actionFact = minimalAgentFactValue(message, ["动作", "会做", "执行", "调用", "成本"]);
  const changedFacts = (message.facts || [])
    .map((fact) => `${fact.label} ${fact.value}`)
    .join(" ");
  const combinedCopy = cleanMinimalAgentMessageCopy(`${message.title} ${message.body} ${message.next || ""} ${actionFact} ${changedFacts}`);
  const explicitShotCountEdit = /改成\s*\d+\s*个镜头|重排为\s*\d+\s*个镜头|当前故事改成/.test(combinedCopy);
  const looksLikeNewStoryDraft = /加入项目计划|故事已确认|确认故事|待确认草案|确认这版故事|正式故事|故事流/.test(combinedCopy);
  if (looksLikeNewStoryDraft && !explicitShotCountEdit) return false;
  return /改项目|修改项目|更新项目|重排/.test(actionFact)
    || (explicitShotCountEdit && /确认后才写入|不生成参考|不提交视频/.test(combinedCopy))
    || (/storyShotCount|故事结构|镜头数|镜头/.test(changedFacts) && /改项目|修改项目|更新项目|重排|修改当前故事|更新当前故事/.test(combinedCopy));
}

function minimalAgentMessageIsStructuredProjectDraftEdit(message: MinimalAgentMessage) {
  return message.actionKind === "revise_story_or_shot" || message.actionKind === "update_shot_strategy";
}

function minimalAgentMessageIsLocalProjectSetup(message: MinimalAgentMessage) {
  if (minimalAgentMessageIsProjectDraftEdit(message)) return false;
  return message.toolName === "write_project" && /本地项目|项目文件夹|保存位置/.test(`${message.title} ${message.body} ${message.next || ""}`);
}

function minimalAgentConfirmationTargetPhrase(message: MinimalAgentMessage, targetFact: string) {
  if (!targetFact) return "";
  if (message.actionKind === "prepare_reference_generation") return `这次只补 ${targetFact}`;
  if (message.actionKind === "prepare_video_submit") return `这次只提交 ${targetFact}`;
  if (message.actionKind === "query_video_result") return `这次只查询 ${targetFact}`;
  if (message.actionKind === "prepare_export") return `这次只导出 ${targetFact}`;
  if (message.actionKind === "revise_story_or_shot" || message.actionKind === "update_shot_strategy") return `这次只改 ${targetFact}`;
  if (message.toolName === "write_project") return `这次只保存 ${targetFact}`;
  return `这次只处理 ${targetFact}`;
}

function minimalAgentConfirmationCostPhrase(costFact: string) {
  if (!costFact) return "";
  if (/参考生成|生成参考/.test(costFact)) return "会生成参考图";
  if (/Seedance|视频提交|提交视频/.test(costFact)) return "会提交 Seedance 视频任务";
  if (/查询/.test(costFact)) return "只查询已有任务";
  if (/导出/.test(costFact)) return "会生成交付包";
  return costFact;
}

function minimalAgentConfirmationBoundary(message: MinimalAgentMessage) {
  if (minimalAgentFactValue(message, ["方式"]) === "本地合同验证") {
    const descriptor = minimalAgentDryRunConfirmationDescriptor(message);
    if (descriptor) return `确认前再核对：这次只做本地合同验证；${descriptor.protection}。`;
  }
  if (minimalAgentMessageIsLocalProjectSetup(message)) {
    return "确认前再核对：这次只选择故事保存位置；不会生成参考、提交视频或导出。";
  }
  if (minimalAgentMessageIsProjectDraftEdit(message)) {
    return "确认前再核对：确认后只更新项目草案；不会生成参考、提交视频或导出。";
  }
  const targetFact = minimalAgentFactValue(message, ["目标", "影响"]);
  const costFact = minimalAgentFactValue(message, ["成本", "调用", "会做", "执行"]);
  const writeFact = minimalAgentFactValue(message, ["写入", "保存"]);
  const externalFact = minimalAgentFactValue(message, ["外部提交"]);
  const parts = [
    minimalAgentConfirmationTargetPhrase(message, targetFact),
    minimalAgentConfirmationCostPhrase(costFact),
    writeFact && writeFact !== "不写文件" ? `结果保存到 ${writeFact}` : "",
    externalFact ? externalFact : "",
  ].filter(Boolean);
  return parts.length ? cleanMinimalAgentMessageCopy(`确认前再核对：${parts.join("；")}。`) : "";
}

function minimalAgentConfirmationReadableBody(message: MinimalAgentMessage) {
  if (minimalAgentFactValue(message, ["方式"]) === "本地合同验证") {
    const descriptor = minimalAgentDryRunConfirmationDescriptor(message);
    if (descriptor) return descriptor.body;
  }
  const confirmationAction = minimalAgentConfirmationAction(message, "确认执行");
  const actionLabel = confirmationAction.label.replace(/^确认/, "") || "继续这一步";
  const targetFact = minimalAgentFactValue(message, ["目标", "影响"]);
  const writeFact = minimalAgentFactValue(message, ["写入"]);
  const providerFact = minimalAgentFactValue(message, ["外部提交", "会做", "执行", "调用", "成本"]);
  const combinedCopy = cleanMinimalAgentMessageCopy(`${message.body} ${message.next || ""} ${confirmationAction.hint} ${providerFact}`);
  const projectOnlyChange = minimalAgentMessageIsProjectDraftEdit(message)
    || message.toolName === "write_project"
    || /写入项目|写项目|改项目|只写项目|修改项目/.test(providerFact);
  const readableActionLabel = message.actionKind === "update_shot_strategy"
    ? "更新生成方式"
    : actionLabel.startsWith("这版")
      ? `确认${actionLabel}`
      : actionLabel;
  const actionLine = `我准备${readableActionLabel}${targetFact ? `，范围是${targetFact}` : ""}。`;
  const writeLine = writeFact && writeFact !== "不写文件" ? `结果会保存到${writeFact}。` : "";
  if (isNewVideoDraftConfirmationLabel(confirmationAction.label) || /保存故事|确认故事/.test(combinedCopy)) {
    return `${actionLine}这一步只保存故事，不会生成参考或提交视频。`;
  }
  if (minimalAgentMessageIsLocalProjectSetup(message)) {
    return `${actionLine}这一步只选择故事保存位置，不会生成参考、提交视频或导出。`;
  }
  if (projectOnlyChange) {
    return `${actionLine}这一步只更新项目草案，不会生成参考或提交视频。`;
  }
  if (message.actionKind === "prepare_export") {
    return `${actionLine}${writeLine || "确认后才会写入本地导出文件。"}`;
  }
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
  return /本地项目|项目文件夹|临时项目|保存位置/.test(`${message.title} ${message.body} ${message.next || ""}`);
}

function minimalAgentMessageCompletedLocalProjectSetup(message: MinimalAgentMessage) {
  if (message.status !== "done" || message.toolName !== "write_project") return false;
  return /项目文件夹已准备|保存位置已选择/.test(`${message.title} ${message.body}`);
}

function minimalAgentMessageIncompleteLocalProjectSetup(message: MinimalAgentMessage) {
  if (message.entryType !== "action_result" || message.status !== "blocked" || message.toolName !== "write_project") return false;
  return /没有选择保存位置|保存位置选择失败/.test(`${message.title} ${message.body}`);
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
  return value.includes("确认继续")
    || value.includes(NEW_VIDEO_DRAFT_CONFIRM_LABEL)
    || value.includes("写入故事流")
    || value.includes("保存到项目")
    || value.includes("加入项目计划");
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
  if (message.actionId && confirmation.actionId) {
    if (message.actionId === confirmation.actionId) return true;
    if (message.actionId.includes(confirmation.actionId) || confirmation.actionId.includes(message.actionId)) return true;
  }
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
  if (isMinimalAgentSelectionContextId(message.id) && minimalAgentMessageIsWaitingConfirmation(confirmation)) return false;
  return isMinimalAgentSelectionContextId(message.id) || (
    message.id.startsWith("execution_boundary_")
    && !minimalAgentMessageIsUserFacingExecutionBoundary(message)
  );
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
  const action = minimalAgentFactValue(message, ["动作", "会做"]) || actionLabel || "当前动作";
  const target = minimalAgentFactValue(message, ["目标", "引用", "影响"]);
  const boundary = minimalAgentFactValue(message, ["外部提交", "成本", "会做", "执行"]);
  return [
    `确认执行：${action}`,
    target ? `目标：${target}` : "",
    boundary ? `边界：${boundary}` : "",
  ].filter(Boolean).join("。");
}

function agentMessageDraftRevisionIntent(message: MinimalAgentMessage, fallbackIntent = "") {
  if (!minimalAgentMessageRequestsActionConfirmation(message)) return "";
  const actionLabel = minimalAgentConfirmationAction(message, NEW_VIDEO_DRAFT_CONFIRM_LABEL).label;
  if (!isNewVideoDraftConfirmationLabel(actionLabel)) return "";
  const original = cleanMinimalAgentMessageCopy(message.revisionUserIntent?.trim() || fallbackIntent.trim());
  const looksLikeFreshIdea = /(?:我要|我想|想要|帮我|请)?\s*(?:拍|做|生成|制作|来一个)|短片|视频|片子/.test(original);
  const includesDraftSetupDirective = /整理成|整理为|拆成|分成|分为|重排成|重排为|不生成|不提交|不要提交|先不要|先不/.test(original);
  if (!original || (original.length <= 40 && !looksLikeFreshIdea && !includesDraftSetupDirective)) return original;
  return "修改这版草案：";
}

function agentMessageRevisionIntent(message: MinimalAgentMessage, fallbackIntent = "") {
  const draftRevisionIntent = agentMessageDraftRevisionIntent(message, fallbackIntent);
  const fallback = draftRevisionIntent || cleanMinimalAgentMessageCopy(message.revisionUserIntent?.trim() || fallbackIntent.trim());
  if (minimalAgentMessageRequestsActionConfirmation(message)) {
    const label = minimalAgentConfirmationAction(message, "继续").label;
    return fallback || cleanMinimalAgentMessageCopy(label) || "继续调整";
  }
  const summary = cleanMinimalAgentMessageCopy(message.executionResult?.summary?.trim() || message.body.trim());
  const next = agentMessageNextIntent(message, "调整后重试");
  if (summary && next) {
    return `刚才这一步没通过：${summary}\n请按这个方向继续改：${next}`;
  }
  return next || summary || "调整后重试";
}

function cleanEmptyComposerStatusLine(value: string, hasComposerInput: boolean) {
  if (hasComposerInput && value.includes("已同步当前项目")) return "准备好了，点发送让我整理故事和镜头。";
  if (hasComposerInput) return value;
  const looksLikeLegacyReadyDraft = value.includes("故事草案") && value.includes("已就绪");
  if (looksLikeLegacyReadyDraft) return "等待输入：先写一句想法，确认前不会生成。";
  return value;
}

function cleanEmptyComposerTimelineFooterLine(value: string, hasComposerInput: boolean) {
  if (hasComposerInput) return value;
  if (/Skill 保存已暂停|暂停保存 Skill|动作已取消|可以继续改这条导演经验/.test(value)) return "";
  return cleanEmptyComposerStatusLine(value, hasComposerInput);
}

function minimalAgentMessageIsCancelledSkillSaveResult(message: MinimalAgentMessage) {
  return message.toolName === "save_skill"
    && message.entryType === "action_result"
    && (message.lifecycle === "cancelled" || /Skill 保存已暂停|暂停保存 Skill|已取消/.test(`${message.title} ${message.body}`));
}

function minimalAgentMessageBelongsToSkillSaveTurn(message: MinimalAgentMessage) {
  return message.toolName === "save_skill" || message.id.startsWith("skill_save_");
}

function normalizedComposerFooterCopy(value: string) {
  return value.replace(/^等待输入[:：]\s*/, "").trim();
}

function composerFooterCopyIsRedundant(hint: string, status: string) {
  return normalizedComposerFooterCopy(hint) === normalizedComposerFooterCopy(status);
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

function minimalAgentMessageIsUserFacingExecutionBoundary(message: MinimalAgentMessage) {
  return message.entryType === "state_change"
    && message.id.startsWith("execution_boundary_")
    && /^AI 导演工作方式已/.test(message.title);
}

function minimalAgentMessageIsConfirmedExecutionProcessCard(message: MinimalAgentMessage) {
  if (message.toolName === "run_confirmed_action" && message.entryType !== "action_result") return true;
  return message.entryType === "state_change"
    && (message.lifecycle === "running" || message.title === "执行中")
    && !minimalAgentMessageIsUserFacingExecutionBoundary(message);
}

function minimalAgentMessageIsSupersededProcessCard(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  if (!minimalAgentMessageHasFinalActionResult(messages, message)) return false;
  if (minimalAgentMessageIsConfirmedExecutionProcessCard(message)) return true;
  if (message.id.startsWith("execution_boundary_") && !minimalAgentMessageIsUserFacingExecutionBoundary(message)) return true;
  if (message.title === "执行边界") return true;
  return false;
}

function minimalAgentMessageIsPreConfirmationExecutionLeak(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  if (!minimalAgentMessageIsConfirmedExecutionProcessCard(message)) return false;
  const messageIndex = messages.indexOf(message);
  return messages.some((candidate, index) => (
    index > messageIndex
    && minimalAgentMessageIsWaitingConfirmation(candidate)
    && (!message.actionId || !candidate.actionId || message.actionId !== candidate.actionId)
  ));
}

function minimalAgentMessageIsMaterialInboxCard(message: MinimalAgentMessage) {
  if (message.assetInboxSummary) return true;
  if (message.toolName === "classify_assets" || message.toolName === "scan_assets") return true;
  return /素材已识别|项目素材/.test(`${message.title} ${message.body}`);
}

function minimalAgentMessageIsProjectWriteResult(message: MinimalAgentMessage) {
  if (
    message.id === "project_story_flow_ready_state"
    && message.status === "done"
    && message.lifecycle !== "running"
  ) {
    return true;
  }
  if (message.entryType !== "action_result" || message.toolName !== "write_project") return false;
  if (message.status === "waiting" || message.lifecycle === "running") return false;
  const text = minimalAgentMessageSearchText(message);
  return /修改已写入项目|项目已更新|故事已确认|已保存到项目/.test(text);
}

function minimalAgentMessageIsPassiveProjectReadyState(message: MinimalAgentMessage) {
  return message.id === "project_story_flow_ready_state"
    && message.entryType === "state_change"
    && message.role === "tool"
    && message.status === "done";
}

function minimalAgentMaterialInboxSupersededByProjectResult(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  if (!minimalAgentMessageIsMaterialInboxCard(message)) return false;
  const messageIndex = messages.indexOf(message);
  let latestUserIndex = -1;
  for (let index = messageIndex - 1; index >= 0; index -= 1) {
    if (messages[index].role !== "user") continue;
    latestUserIndex = index;
    break;
  }
  return messages.some((candidate, index) => (
    index > latestUserIndex
    && index < messageIndex
    && minimalAgentMessageIsProjectWriteResult(candidate)
  ));
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

function minimalAgentConfirmationRequestsSameAction(left: MinimalAgentMessage, right: MinimalAgentMessage) {
  if (minimalAgentConfirmationRequestsOverlap(left, right)) return true;
  const leftLabel = minimalAgentConfirmationAction(left, "确认执行").label;
  const rightLabel = minimalAgentConfirmationAction(right, "确认执行").label;
  if (!leftLabel || leftLabel !== rightLabel) return false;
  const leftTarget = minimalAgentFactValue(left, ["目标", "影响"]);
  const rightTarget = minimalAgentFactValue(right, ["目标", "影响"]);
  const targetCompatible = !leftTarget || !rightTarget || leftTarget === rightTarget;
  const toolCompatible = !left.toolName
    || !right.toolName
    || left.toolName === right.toolName
    || left.toolName === "request_user_confirmation"
    || right.toolName === "request_user_confirmation";
  return targetCompatible && toolCompatible;
}

function minimalAgentFooterConfirmationHasExistingVisiblePeer(messages: MinimalAgentMessage[], footerMessage: MinimalAgentMessage) {
  if (!footerMessage.id.startsWith("footer_action_") || !minimalAgentMessageRequestsActionConfirmation(footerMessage)) return false;
  return messages.some((candidate) => (
    candidate.id !== footerMessage.id
    && !candidate.id.startsWith("footer_action_")
    && minimalAgentMessageRequestsActionConfirmation(candidate)
    && (candidate.status === "waiting" || candidate.lifecycle === "waiting_for_confirmation")
    && minimalAgentConfirmationRequestsSameAction(candidate, footerMessage)
  ));
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
    || (message.id.startsWith("execution_boundary_") && !minimalAgentMessageIsUserFacingExecutionBoundary(message))
    || message.title === "执行边界";
}

function minimalAgentMessageIsGenericAssistantPlanningReply(message: MinimalAgentMessage) {
  if (message.entryType !== "assistant_message") return false;
  if (message.title === "AI 导演") return true;
  if (message.title !== "理解" && message.title !== "我理解为") return false;
  const body = cleanMinimalAgentMessageCopy(message.body);
  return body.includes("继续看我下面的确认项")
    || body.includes("确认后才执行")
    || body.includes("不会绕过确认直接执行");
}

function minimalAgentMessageIsSupersededAssistantReplyCard(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  if (!minimalAgentMessageIsGenericAssistantPlanningReply(message)) return false;
  const messageIndex = messages.indexOf(message);
  return messages.some((candidate, index) => (
    index > messageIndex
    && (
      minimalAgentMessageRequestsActionConfirmation(candidate)
      || (
        candidate.entryType === "action_result"
        && candidate.status !== "waiting"
        && candidate.lifecycle !== "running"
        && candidate.lifecycle !== "waiting_for_confirmation"
      )
    )
    && (!message.actionId || !candidate.actionId || candidate.actionId === message.actionId)
  ));
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
  if (message.entryType !== "state_change" || !isMinimalAgentSelectionContextId(message.id)) return false;
  const messageIndex = messages.indexOf(message);
  return messages.some((candidate, index) => (
    index > messageIndex
    && candidate.entryType === "state_change"
    && isMinimalAgentSelectionContextId(candidate.id)
  ));
}

function minimalAgentMessageIsSelectionContext(message: MinimalAgentMessage) {
  return message.entryType === "state_change" && isMinimalAgentSelectionContextId(message.id);
}

function minimalAgentMessageIsWaitingConfirmation(message: MinimalAgentMessage) {
  const confirmationFinished = message.status === "done"
    || message.lifecycle === "succeeded"
    || message.lifecycle === "failed"
    || message.lifecycle === "cancelled";
  return minimalAgentMessageRequestsActionConfirmation(message)
    && !confirmationFinished
    && (
      message.status === "waiting"
      || message.lifecycle === "waiting_for_confirmation"
      || message.entryType === "confirmation_request"
    );
}

function minimalAgentMessageIsResolvedConfirmationCard(message: MinimalAgentMessage) {
  return minimalAgentMessageRequestsActionConfirmation(message)
    && !minimalAgentMessageIsWaitingConfirmation(message);
}

function placeSelectionContextBeforeActiveConfirmation(messages: MinimalAgentMessage[]) {
  const confirmationIndex = messages.findIndex(minimalAgentMessageIsWaitingConfirmation);
  if (confirmationIndex < 0) return messages;
  const selectionAfterConfirmation = messages.filter((message, index) => (
    index > confirmationIndex && minimalAgentMessageIsSelectionContext(message)
  ));
  if (!selectionAfterConfirmation.length) return messages;
  const withoutMovedSelection = messages.filter((message, index) => (
    !(index > confirmationIndex && minimalAgentMessageIsSelectionContext(message))
  ));
  const updatedConfirmationIndex = withoutMovedSelection.findIndex(minimalAgentMessageIsWaitingConfirmation);
  if (updatedConfirmationIndex < 0) return messages;
  return [
    ...withoutMovedSelection.slice(0, updatedConfirmationIndex),
    ...selectionAfterConfirmation,
    ...withoutMovedSelection.slice(updatedConfirmationIndex),
  ];
}

function minimalAgentSelectionContextMessageIsOutsideActiveScope(
  message: MinimalAgentMessage,
  activeSelectionKey: string,
  hasBoundSelection: boolean,
  storyLevelFocusActive: boolean,
  localProjectSetupFocusActive = false,
  storyShotCountRevisionFocusActive = false,
  projectEditBlockerFocusActive = false,
) {
  if (message.entryType !== "state_change" || !isMinimalAgentSelectionContextId(message.id)) return false;
  if (message.id.startsWith("draft_selection_context_") || message.id.startsWith("draft_material_selection_context_")) return false;
  if (storyLevelFocusActive || localProjectSetupFocusActive || storyShotCountRevisionFocusActive || projectEditBlockerFocusActive) return true;
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
    && !minimalAgentMessageIsResolvedConfirmationCard(message)
    && !minimalAgentMessageIsSupersededProcessCard(filteredMessages, message)
    && !minimalAgentMessageIsPreConfirmationExecutionLeak(filteredMessages, message)
    && !minimalAgentMessageIsSupersededObservationCard(filteredMessages, message)
    && !minimalAgentMessageIsSupersededConfirmationPrepCard(filteredMessages, message)
    && !minimalAgentMessageIsSupersededAssistantReplyCard(filteredMessages, message)
    && !minimalAgentConfirmationMessageIsStaleAfterLaterResult(filteredMessages, message)
    && !minimalAgentRequestConfirmationToolCallIsSuperseded(filteredMessages, message)
    && !minimalAgentMessageIsSupersededSelectionContextCard(filteredMessages, message)
    && !minimalAgentMaterialInboxSupersededByProjectResult(filteredMessages, message)
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
  const latestWaitingConfirmation = [...turnFocusedMessages]
    .reverse()
    .find(minimalAgentMessageIsWaitingConfirmation);
  const pinned = latestWaitingConfirmation && !bounded.some((message) => message.id === latestWaitingConfirmation.id)
    ? [...bounded, latestWaitingConfirmation]
    : bounded;
  const pinnedBounded = pinned.length > MAX_VISIBLE_AGENT_THREAD_MESSAGES
    ? pinned.filter((message, index) => (
        message.id === latestWaitingConfirmation?.id
        || index > pinned.length - MAX_VISIBLE_AGENT_THREAD_MESSAGES
      ))
    : pinned;
  return {
    messages: placeSelectionContextBeforeActiveConfirmation(pinnedBounded),
    hiddenCount: Math.max(0, currentMessages.length - pinnedBounded.length),
  };
}

function minimalAgentThreadNeedsStatusReply(messages: MinimalAgentMessage[]) {
  const latestUserIndex = messages.map((message) => message.role).lastIndexOf("user");
  const currentTurnMessages = latestUserIndex >= 0 ? messages.slice(latestUserIndex + 1) : messages;
  if (!currentTurnMessages.length) return true;
  return !currentTurnMessages.some((message) => (
    message.role === "assistant"
    || minimalAgentMessageIsWaitingConfirmation(message)
    || minimalAgentMessageFinalToolAction(message)
  ));
}

function minimalAgentReferenceReviewMessageIsStale(message: MinimalAgentMessage, referencesReadyAfterReview: boolean) {
  if (!referencesReadyAfterReview || message.role === "user") return false;
  const text = minimalAgentMessageSearchText(message);
  return /复核|需要复核|等你复核|去参考页复核|参考待复核/.test(text) && !/参考可用/.test(text);
}

function minimalAgentReferenceReviewMessageIsPremature(message: MinimalAgentMessage, referenceHasReviewableOutput: boolean) {
  if (referenceHasReviewableOutput || message.role === "user") return false;
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

function agentTimelineEntriesForCurrentUserIntent(entries: VibeAgentTimelineEntry[], userIntent: string) {
  const compactIntent = shortAgentPanelMessageText(userIntent).trim();
  if (!compactIntent) return entries;
  const intentLead = compactIntent.slice(0, 48);
  const currentUserIndex = entries.map((entry) => (
    entry.type === "user_message" && cleanMinimalAgentMessageCopy(entry.body).includes(intentLead)
  )).lastIndexOf(true);
  if (currentUserIndex < 0) {
    const hasTimelineUserMessage = entries.some((entry) => entry.type === "user_message");
    if (!hasTimelineUserMessage && entries.some(agentTimelineEntryCanFollowCommittedDraft)) return entries;
    return undefined;
  }
  const nextUserIndex = entries.findIndex((entry, index) => (
    index > currentUserIndex && entry.type === "user_message"
  ));
  return entries.slice(currentUserIndex, nextUserIndex >= 0 ? nextUserIndex : undefined);
}

function agentTimelineEntryRequestsActionConfirmation(entry: VibeAgentTimelineEntry) {
  return entry.type === "confirmation_request"
    && (Boolean(entry.actionId) || entry.toolName === "save_skill")
    && (entry.status === "waiting" || entry.lifecycle === "waiting_for_confirmation");
}

function latestWaitingReferenceGenerationConfirmationActionId(entries: VibeAgentTimelineEntry[]) {
  const timelineMessages = entries.map(minimalAgentMessageFromTimelineEntry);
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (
      !agentTimelineEntryRequestsActionConfirmation(entry)
      || entry.actionKind !== "prepare_reference_generation"
      || !entry.actionId
    ) {
      continue;
    }
    const message = timelineMessages[index];
    if (
      minimalAgentConfirmationSuperseded(timelineMessages, index)
      || minimalAgentConfirmationMessageIsStaleAfterLaterResult(timelineMessages, message)
    ) {
      return "";
    }
    return entry.actionId;
  }
  return "";
}

function agentTimelineEntriesForLatestWaitingConfirmation(entries: VibeAgentTimelineEntry[], activeReferenceGenerationActionId = "") {
  let confirmationIndex = -1;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (agentTimelineEntryRequestsActionConfirmation(entries[index])) {
      confirmationIndex = index;
      break;
    }
  }
  if (confirmationIndex < 0) return undefined;
  const timelineMessages = entries.map(minimalAgentMessageFromTimelineEntry);
  const confirmationMessage = timelineMessages[confirmationIndex];
  if (
    minimalAgentConfirmationSuperseded(timelineMessages, confirmationIndex)
    || minimalAgentConfirmationMessageIsStaleAfterLaterResult(timelineMessages, confirmationMessage)
    || minimalAgentReferenceGenerationConfirmationIsStale(timelineMessages, confirmationMessage, false, activeReferenceGenerationActionId)
  ) {
    return undefined;
  }
  const actionId = entries[confirmationIndex].actionId;
  const firstActionIndex = actionId
    ? entries.findIndex((entry) => entry.actionId === actionId)
    : confirmationIndex;
  const actionStartIndex = firstActionIndex >= 0 ? firstActionIndex : confirmationIndex;
  let userIndex = -1;
  for (let index = actionStartIndex; index >= 0; index -= 1) {
    if (entries[index].type === "user_message") {
      userIndex = index;
      break;
    }
  }
  return entries.slice(userIndex >= 0 ? userIndex : actionStartIndex, confirmationIndex + 1);
}

function latestWaitingConfirmationUserIntent(entries: VibeAgentTimelineEntry[], activeReferenceGenerationActionId = "") {
  const focusedEntries = agentTimelineEntriesForLatestWaitingConfirmation(entries, activeReferenceGenerationActionId);
  return focusedEntries?.find((entry) => entry.type === "user_message")?.body.trim() || "";
}

function agentTimelineEntryCanFollowCommittedDraft(entry: VibeAgentTimelineEntry) {
  return entry.id.startsWith("new_video_draft_committed_")
    || entry.id.startsWith("local_project_setup_")
    || entry.id.startsWith("local_agent_");
}

function minimalAgentMessageHasLaterReferenceReady(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  const messageIndex = messages.indexOf(message);
  return messages.some((candidate, index) => {
    if (index <= messageIndex || candidate.role === "user") return false;
    return /参考可用/.test(minimalAgentMessageSearchText(candidate));
  });
}

function minimalAgentMessageHasLaterReferencePlanOnlyDecision(messages: MinimalAgentMessage[], message: MinimalAgentMessage) {
  const messageIndex = messages.indexOf(message);
  return messages.some((candidate, index) => {
    if (index <= messageIndex || candidate.role === "user") return false;
    const text = minimalAgentMessageSearchText(candidate);
    return /准备参考计划|参考计划已准备/.test(text)
      && /不生成参考|不生成图片|不会生成图片/.test(text)
      && /不提交视频|不会提交视频/.test(text);
  });
}

function minimalAgentReferenceGenerationConfirmationIsStale(
  messages: MinimalAgentMessage[],
  message: MinimalAgentMessage,
  referencesReadyAfterReview: boolean,
  activeReferenceGenerationActionId = "",
) {
  if (message.role === "user") return false;
  const text = minimalAgentMessageSearchText(message);
  const looksLikeReferenceGenerationConfirmation = minimalAgentMessageRequestsActionConfirmation(message)
    || /需要确认|请求确认|等你确认|待确认/.test(text);
  if (!looksLikeReferenceGenerationConfirmation) return false;
  if (
    activeReferenceGenerationActionId
    && message.actionId === activeReferenceGenerationActionId
    && /补齐参考|生成参考|参考生成/.test(text)
  ) {
    return false;
  }
  return (
    referencesReadyAfterReview
    || minimalAgentMessageHasLaterReferenceReady(messages, message)
    || minimalAgentMessageHasLaterReferencePlanOnlyDecision(messages, message)
  )
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
    || /参考生成暂时中断|参考生成没有完成|完成结果：需要处理/.test(text)
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
  activeReferenceGenerationActionId = "",
) {
  const messages = entries.map(minimalAgentMessageFromTimelineEntry);
  const stateAwareMessages = messages.filter((message) =>
    !minimalAgentReferenceGenerationConfirmationIsStale(messages, message, referencesReadyAfterReview, activeReferenceGenerationActionId)
  );
  return [...visibleMinimalAgentMessages(stateAwareMessages).messages]
    .reverse()
    .find(minimalAgentMessageRequestsActionConfirmation);
}

function latestPendingProjectEditConfirmationMessage(entries: VibeAgentTimelineEntry[]) {
  const messages = entries.map(minimalAgentMessageFromTimelineEntry);
  const activeMessages = messages.filter((_, index) => !minimalAgentConfirmationSuperseded(messages, index));
  return [...activeMessages].reverse().find((message) =>
    minimalAgentMessageIsWaitingConfirmation(message) && minimalAgentMessageIsStructuredProjectDraftEdit(message)
  );
}

function preservedProjectEditConfirmationTimelineEntry(
  message: MinimalAgentMessage,
  createdAt: string,
): VibeAgentTimelineEntry {
  const suffix = `${createdAt}_${message.id}`.replace(/[^a-z0-9]+/gi, "_").slice(0, 80).toLowerCase();
  return {
    id: `preserved_project_edit_confirmation_${suffix}`,
    type: "confirmation_request",
    createdAt,
    title: message.title,
    body: message.body,
    lifecycle: "waiting_for_confirmation",
    status: "waiting",
    toolName: message.toolName || "write_project",
    actionKind: message.actionKind || "revise_story_or_shot",
    actionId: message.actionId,
    confirmationRequired: true,
    facts: message.facts,
    details: {
      ...(message.next ? { next: message.next } : {}),
      preservedFromMessageId: message.id,
    },
  };
}

function mergeVibeAgentTimelineEntries(
  current: VibeAgentTimelineEntry[],
  additions: VibeAgentTimelineEntry[],
) {
  const entriesById = new Map(current.map((entry) => [entry.id, entry]));
  for (const entry of additions) entriesById.set(entry.id, entry);
  return Array.from(entriesById.values()).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function agentVideoPermissionDisplayLabel(contract: AgentVideoPermissionContract, userIntent = "") {
  if (
    contract.mode === "reference_allowed"
    && (
      directorAgentPermissionIntentDisallowsVideoSubmit(userIntent)
      || /不(?:发送|提交)视频|先不(?:发送|提交)视频/.test(contract.reason)
    )
  ) {
    return "视频不提交";
  }
  return agentVideoPermissionLabel(contract);
}

function agentVideoPermissionDisplayDetail(contract: AgentVideoPermissionContract, userIntent = "") {
  if (
    contract.mode === "reference_allowed"
    && (
      directorAgentPermissionIntentDisallowsVideoSubmit(userIntent)
      || /不(?:发送|提交)视频|先不(?:发送|提交)视频/.test(contract.reason)
    )
  ) {
    return "参考可以之后再补；视频不会提交，发送视频前仍会单独确认。";
  }
  return agentVideoPermissionDetail(contract);
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
    {
      id: `local_agent_project_confirmation_${suffix}`,
      type: "confirmation_request",
      createdAt,
      title: "选择保存位置",
      body: "确认后只会让你选择这版故事的保存位置；不会生成参考、提交视频或导出。",
      toolName: "write_project",
      confirmationRequired: true,
      status: "waiting",
      facts: [
        { label: "目标", value: "故事保存位置" },
        { label: "会做", value: "选择保存位置" },
        { label: "保护", value: "不生成参考、不提交视频、不导出" },
      ],
      details: { next: "保存位置选好后，我会接着当前故事检查下一步。" },
    },
  ];
}

function buildPendingProjectEditBlockedTimelineEntries(input: {
  userIntent: string;
  blockedIntentLabel: string;
  confirmationLabel: string;
  confirmationMessage: MinimalAgentMessage;
}): VibeAgentTimelineEntry[] {
  const createdAt = new Date().toISOString();
  const suffix = createdAt.replace(/[^a-z0-9]+/gi, "").slice(0, 24).toLowerCase();
  const confirmationFacts = input.confirmationMessage.facts?.length
    ? input.confirmationMessage.facts
    : [
      { label: "确认", value: input.confirmationLabel },
      { label: "保护", value: "不生成参考、不提交视频" },
    ];
  const confirmationNext = input.confirmationMessage.next || "确认后才写入项目；不确认也可以继续改文字。";
  return [
    {
      id: `pending_project_edit_user_${suffix}`,
      type: "user_message",
      createdAt,
      title: "你",
      body: input.userIntent,
      status: "done",
    },
    {
      id: `pending_project_edit_block_${suffix}`,
      type: "assistant_message",
      createdAt,
      title: "AI 导演：先处理当前修改",
      body: `我看到了“${input.userIntent}”。但现在还有「${input.confirmationLabel}」待确认；先确认或清空这条修改，再检查保存位置、参考和视频前提。这一步不会生成参考、提交视频或导出。`,
      status: "blocked",
      facts: [
        { label: "你想做", value: input.blockedIntentLabel },
        { label: "先处理", value: input.confirmationLabel },
        { label: "保护", value: "不生成参考、不提交视频、不导出" },
      ],
      details: { next: "先处理当前修改；之后我会接着检查保存位置和工具前提。" },
    },
    {
      id: `pending_project_edit_confirmation_${suffix}`,
      type: "confirmation_request",
      createdAt,
      title: input.confirmationLabel,
      body: input.confirmationMessage.body || "这条修改仍在等待确认。确认后才写入项目；不确认也可以继续改文字。",
      toolName: input.confirmationMessage.toolName || "write_project",
      actionKind: input.confirmationMessage.actionKind,
      actionId: input.confirmationMessage.actionId,
      confirmationRequired: true,
      lifecycle: "waiting_for_confirmation",
      status: "waiting",
      facts: confirmationFacts,
      details: { next: confirmationNext },
    },
  ];
}

function buildLocalPreparedAgentTimelineEntries(input: {
  userIntent: string;
  action: DirectorAgentActionEnvelope;
}): VibeAgentTimelineEntry[] {
  const createdAt = new Date().toISOString();
  const suffix = createdAt.replace(/[^a-z0-9]+/gi, "").slice(0, 24).toLowerCase();
  const targetLabel = directorAgentDisplayTargetLabel(input.action.target, input.action.sourceContext);
  const projectOnly = input.action.kind === "revise_story_or_shot"
    || input.action.kind === "update_shot_strategy"
    || input.action.toolPlan.toolName === "project_vibe_patch";
  const facts = [
    targetLabel ? { label: "范围", value: targetLabel } : undefined,
    { label: "写入", value: "确认后才写入" },
    projectOnly ? { label: "保护", value: "不生成参考、不提交视频" } : undefined,
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));
  const entries: VibeAgentTimelineEntry[] = [
    {
      id: `local_agent_user_${suffix}`,
      type: "user_message",
      createdAt,
      title: "你",
      body: input.userIntent,
      status: "done",
    },
    {
      id: `local_agent_understanding_${suffix}`,
      type: "assistant_message",
      createdAt,
      title: "理解",
      body: input.action.userFacingMessage,
      actionKind: input.action.kind,
      actionId: input.action.actionId,
      lifecycle: input.action.status === "blocked" ? "needs_user_input" : "proposed",
      status: input.action.status === "blocked" ? "blocked" : "done",
      facts,
      details: { next: input.action.status === "blocked" ? "换个说法后重试。" : "确认后才执行。" },
    },
  ];
  if (input.action.status !== "blocked") {
    entries.push({
      id: `local_agent_confirmation_${suffix}`,
      type: "confirmation_request",
      createdAt,
      title: input.action.summary,
      body: "请先确认这次修改。确认后只按这条消息写明的范围推进。",
      toolName: "write_project",
      actionKind: input.action.kind,
      actionId: input.action.actionId,
      confirmationRequired: true,
      lifecycle: "waiting_for_confirmation",
      status: "waiting",
      facts,
      details: { next: "确认后才写入项目；不确认也可以继续改文字。" },
    });
  }
  return entries;
}

function buildLocalReferencePlanningTimelineEntries(input: {
  userIntent: string;
  label: string;
  plan: string[];
  observation: ProjectObservationProjection;
}): VibeAgentTimelineEntry[] {
  const createdAt = new Date().toISOString();
  const suffix = createdAt.replace(/[^a-z0-9]+/gi, "").slice(0, 24).toLowerCase();
  const referenceLabel = input.observation.references.status === "missing"
    ? input.observation.references.label
    : "按当前故事检查";
  const planBody = input.plan.length
    ? input.plan.join("；")
    : "整理参考范围和优先级，不生成图片、不提交视频";
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
      id: `local_agent_reference_plan_${suffix}`,
      type: "assistant_message",
      createdAt,
      title: input.label,
      body: `我会先做参考计划：${planBody}。这一步不会生成图片，也不会提交视频。`,
      status: "done",
      facts: [
        { label: "范围", value: "当前故事" },
        { label: "参考", value: referenceLabel },
        { label: "保护", value: "不生成图片、不提交视频" },
      ],
      details: { next: "确认要真正生成参考时，再说“生成参考”或“允许生成参考”。" },
    },
  ];
}

function localReferencePlanningFocusEntry(entries: VibeAgentTimelineEntry[]) {
  return [...entries].reverse().find((entry) =>
    entry.id.startsWith("local_agent_reference_plan_")
    && entry.type === "assistant_message"
    && entry.status === "done"
  );
}

function localReferencePlanningFocusChips(entry: VibeAgentTimelineEntry | undefined) {
  if (!entry) return [];
  const factValue = (label: string, fallback: string) =>
    entry.facts?.find((fact) => fact.label === label)?.value || fallback;
  return [
    { label: "范围", value: factValue("范围", "当前故事") },
    { label: "参考", value: factValue("参考", "参考不完整") },
    { label: "保护", value: factValue("保护", "不生成图片、不提交视频") },
  ];
}

function referencePlanningGenerationRequestText(text: string) {
  const value = text.trim();
  if (!value) return false;
  if (/不生成参考|不要生成参考|先不生成参考|先别生成参考|不生成图片|不要生成图片|不生图|不要生图|先别生成|先不要生成|别生成|不要生成|只准备计划|先只准备计划|只准备参考计划|先只准备参考计划/.test(value)) {
    return false;
  }
  return /生成参考|参考生成|补参考|补齐参考|做参考|可做参考|可以做参考|允许做参考/.test(value);
}

function referencePlanningPreparationRequestText(text: string) {
  const value = text.trim();
  if (!value) return false;
  return /开始补参考|继续补参考|补参考|准备参考计划|参考计划|安排参考|规划参考|只准备计划|先只准备计划|只准备参考|只准备参考计划|先只准备参考计划/.test(value);
}

function referencePlanningPlanOnlyRequestText(text: string) {
  const value = text.trim();
  if (!value || referencePlanningGenerationRequestText(value)) return false;
  const explicitPlanOnlyReference = referencePlanningPreparationRequestText(value);
  const cancelsReferenceGeneration = /不生成参考|不要生成参考|先不生成参考|先不要生成参考|先别生成参考|不生成图片|不要生成图片|不生图|不要生图|先别生成|先不要生成|别生成|不要生成/.test(value)
    && /参考|图片|画面|生图/.test(value);
  return explicitPlanOnlyReference || cancelsReferenceGeneration;
}

function storyShotCountRevisionRequestText(text: string) {
  return Boolean(requestedStoryboardShotCountFromIntent(text));
}

function buildLocalVideoBlockedPlanningTimelineEntries(input: {
  userIntent: string;
  label: string;
  plan: string[];
  observation: ProjectObservationProjection;
}): VibeAgentTimelineEntry[] {
  const createdAt = new Date().toISOString();
  const suffix = createdAt.replace(/[^a-z0-9]+/gi, "").slice(0, 24).toLowerCase();
  const planBody = input.plan.length
    ? input.plan.join("；")
    : "先检查故事、参考和提交权限，不生成参考、不提交视频";
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
      id: `local_agent_video_blocked_${suffix}`,
      type: "assistant_message",
      createdAt,
      title: input.label,
      body: `我看到了视频请求，但这句话同时限制了外部生成：${planBody}。这一步只说明前置条件，不会生成参考图，也不会提交视频。`,
      status: "done",
      facts: [
        { label: "范围", value: "当前故事" },
        { label: "参考", value: input.observation.references.label },
        { label: "视频", value: input.observation.video.label },
        { label: "保护", value: "不生成参考、不提交视频" },
      ],
      details: { next: "要继续视频，请先补齐参考；真正提交视频前我会再让你确认。" },
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
        title: "选择保存位置",
        body: "Agent 正在打开保存位置选择入口，等你选择或新建一个文件夹作为这版故事的保存位置。",
        toolName: "write_project",
        status: "waiting",
        facts: [
          { label: "动作", value: "选择保存位置" },
          { label: "原因", value: "生成参考、发送视频和导出前需要保存位置" },
        ],
        details: { next: "等待选择保存位置" },
      },
      {
        id: `local_project_setup_state_${suffix}`,
        type: "state_change",
        createdAt: input.createdAt,
        title: "等待保存位置",
        body: "保存位置选好后，我会继续沿着当前故事往下走。",
        toolName: "write_project",
        status: "waiting",
        details: { next: "选择或新建保存位置" },
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
      title: completed ? "保存位置已选择" : cancelled ? "没有选择保存位置" : "保存位置选择失败",
      body: completed
        ? "这版故事的保存位置已经准备好。你可以继续说“继续”，我会接着检查参考和视频下一步。"
        : cancelled
          ? "这次没有选择保存位置。你仍然可以继续改文字；生成参考、发送视频或导出前再选择即可。"
          : input.detail || "保存位置没有准备成功。可以稍后重试，或先继续修改故事。",
      toolName: "write_project",
      status: completed ? "done" : "blocked",
      facts: [
        { label: "动作", value: "选择保存位置" },
        { label: "状态", value: completed ? "已准备" : cancelled ? "已取消" : "失败" },
        { label: "下一步", value: completed ? "继续检查项目" : "可以重试或继续改文字" },
      ],
      details: {
        next: completed ? "说“继续”检查下一步" : "需要时再选择保存位置",
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
  next?: string;
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
      next: input.next || selectionContextNextCopy(),
    },
  };
}

function selectionContextNextCopy(localProjectReady = true) {
  return localProjectReady
    ? "直接说改法，或说“继续下一步”。"
    : "直接说改法，或确认「选择保存位置」。";
}

function selectionContextMessageId(selectionKey: string) {
  const selectionId = selectionKey.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 72) || "selection";
  return `selection_context_${selectionId}`;
}

function explicitAgentSelectionContextFromTimeline(entries: VibeAgentTimelineEntry[]) {
  const entry = [...entries].reverse().find((item) =>
    item.type === "state_change"
    && (
      item.id.startsWith("draft_selection_context_")
      || item.id.startsWith("draft_material_selection_context_")
    )
  );
  if (!entry) return undefined;
  const facts = entry.facts || [];
  const target = facts.find((fact) => fact.label === "这个指向")?.value || "";
  if (!target) return undefined;
  const binding = facts.find((fact) => fact.label === "识别为")?.value;
  const looksLikeVoiceContext = /声|音频|对白|台词|voice|audio/i.test(binding || "");
  const kind = entry.id.startsWith("draft_material_selection_context_")
    ? looksLikeVoiceContext ? "voice" : "asset"
    : "shot";
  const kindLabel = kind === "shot" ? "当前镜头" : kind === "voice" ? "当前声音" : "当前素材";
  const status = facts.find((fact) => fact.label === "状态")?.value;
  const next = typeof entry.details?.next === "string" ? entry.details.next : "";
  return {
    title: kindLabel,
    hint: kind === "shot"
      ? `已选中 ${target}。直接说“这个”怎么改。`
      : `已选中 ${target}。直接说这个素材怎么改。`,
    chips: [
      { label: "这个指向", value: target },
      binding ? { label: "识别为", value: binding } : undefined,
      status ? { label: "状态", value: status } : undefined,
      next ? { label: "下一步", value: next } : undefined,
    ].filter((item): item is { label: string; value: string } => Boolean(item)).slice(0, 4),
  };
}

function committedNewVideoDraftMessage(run?: PrototypeAgentDemoRun): MinimalAgentMessage | undefined {
  if (!isCommittedNewVideoDraftAgentRun(run)) return undefined;
  const result = run?.result;
  const title = result?.label || "故事已确认";
  const next = result?.projectTaskLabel || "继续修改或生成参考";
  return {
    id: "new_video_draft_committed_result",
    entryType: "action_result",
    role: "tool",
    title,
    body: result?.projectRecordLabel || "这版故事和镜头已经确认。接下来可以继续修改镜头，或让 Agent 安排下一步。",
    lifecycle: "succeeded",
    status: "done",
    toolName: "write_project",
    facts: [
      { label: "故事", value: result?.storageLabel || "已确认" },
      { label: "状态", value: result?.status || "故事已确认" },
      { label: "下一步", value: next },
    ],
    next: /本地项目|保存位置/.test(next) ? "可以直接说要改哪里，或确认「选择保存位置」。" : "可以直接说要改哪里，或让 Agent 继续安排参考和视频。",
  };
}

function storyFlowReadyMessage(shotCount: number, localProjectReady = true): MinimalAgentMessage | undefined {
  if (shotCount <= 0) return undefined;
  const nextStep = localProjectReady ? "修改镜头或生成参考" : "选择保存位置";
  const nextCopy = localProjectReady
    ? "直接说要改哪里，或让 Agent 继续安排参考和视频。"
    : "直接说要改哪里；生成参考或视频前，先确认「选择保存位置」。";
  return {
    id: "project_story_flow_ready_state",
    entryType: "state_change",
    role: "tool",
    title: "故事流已准备",
    body: localProjectReady
      ? `当前项目已有 ${shotCount} 个镜头。你可以点选镜头后直接说“这个”哪里不对，也可以让 Agent 继续安排下一步。`
      : `当前故事已有 ${shotCount} 个镜头。你可以继续改镜头；生成参考、视频或导出前，先选择保存位置。`,
    lifecycle: "succeeded",
    status: "done",
    toolName: "inspect_project",
    facts: [
      { label: "镜头", value: `${shotCount} 个` },
      { label: "下一步", value: nextStep },
    ],
    next: nextCopy,
  };
}

function buildExecutionBoundaryChangedTimelineEntry(input: {
  createdAt: string;
  contract: AgentVideoPermissionContract;
  userIntent?: string;
  changed?: boolean;
}): VibeAgentTimelineEntry {
  const label = agentVideoPermissionDisplayLabel(input.contract, input.userIntent);
  const detail = agentVideoPermissionDisplayDetail(input.contract, input.userIntent);
  const next = input.contract.mode === "video_allowed"
    ? "你可以继续说“发送视频”，我仍会在提交前确认。"
    : input.contract.mode === "reference_allowed"
      ? "你可以继续确认故事或补参考；视频提交仍会单独确认。"
      : "我现在只整理故事和镜头，不会生成参考或提交视频。";
  return {
    id: `execution_boundary_${input.contract.mode}_${input.createdAt}`,
    type: "state_change",
    createdAt: input.createdAt,
    title: input.changed === false ? "AI 导演工作方式已确认" : "AI 导演工作方式已切换",
    body: `${input.changed === false ? "保持" : "已切换为"}“${label}”。${detail}`,
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

function buildExecutionBoundaryControlUserTimelineEntry(input: {
  createdAt: string;
  userIntent: string;
}): VibeAgentTimelineEntry {
  return {
    id: `execution_boundary_user_${input.createdAt}`,
    type: "user_message",
    createdAt: input.createdAt,
    title: "你",
    body: input.userIntent,
    status: "done",
  };
}

type DirectProductActionToolName = Extract<
  NonNullable<VibeAgentTimelineEntry["toolName"]>,
  "generate_references" | "submit_video" | "query_video" | "export_showcase" | "export_project"
>;

function directProductActionKind(toolName: DirectProductActionToolName): VibeAgentTimelineEntry["actionKind"] {
  if (toolName === "generate_references") return "prepare_reference_generation";
  if (toolName === "submit_video") return "prepare_video_submit";
  if (toolName === "query_video") return "query_video_result";
  return "prepare_export";
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
  sourceFactHash?: string;
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
  const visibleFacts = (input.facts || []).slice(0, 3);
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
    actionKind: directProductActionKind(input.toolName),
    status: input.phase === "started" || input.phase === "running" ? "waiting" : input.phase === "completed" ? "done" : "blocked",
    facts: [
      ...visibleFacts,
      { label: "下一步", value: input.next },
    ],
    details: { next: input.next, sourceFactHash: input.sourceFactHash, directProductPhase: input.phase },
  };
}

function agentActionLogItemIsPrematureReferenceReview(item: AgentActionLogItem, referenceHasReviewableOutput: boolean) {
  if (referenceHasReviewableOutput) return false;
  const text = [
    item.title,
    item.result,
    item.nextStep,
    item.resultView?.label,
  ].map((part) => stringValue(part)).join(" ");
  return /参考已生成|参考图已经回到参考页|\d+\s*项参考需要复核|去参考页复核|等你复核/.test(text)
    && !/参考可用/.test(text);
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
      facts: [
        { label: "阶段", value: "已回到参考页" },
        { label: "查看", value: "参考页" },
        { label: "保护", value: "先复核再用于视频" },
      ],
    };
  }
  if (normalized === "blocked") {
    return {
      phase: "failed" as const,
      title: "参考生成没有完成",
      body: cleanMessage || "参考生成暂时中断。已生成的内容会保留，可以稍后重试。",
      next: "看原因后重试，或直接告诉我怎么调整。",
      status: cleanMessage || "参考生成没有完成。",
      facts: [
        { label: "阶段", value: "需要处理" },
        { label: "动作", value: "看原因后重试" },
      ],
    };
  }
  if (normalized === "running" || normalized === "prepared") {
    return {
      phase: "running" as const,
      title: "参考生成中",
      body: cleanMessage || "参考任务已交给图片服务，等图片回到参考页后再复核。",
      next: "等参考结果，或去参考页查看进度。",
      status: cleanMessage || "参考生成中，等待结果回到参考页。",
      facts: [
        { label: "阶段", value: "生成中" },
        { label: "查看", value: "参考页" },
      ],
    };
  }
  if (normalized === "verified") {
    return {
      phase: "completed" as const,
      title: "参考可用",
      body: cleanMessage || "参考已经确认，可以继续准备视频。",
      next: "继续下一步。",
      status: cleanMessage || "参考可用。",
      facts: [
        { label: "阶段", value: "可用于视频" },
        { label: "下一步", value: "准备视频" },
      ],
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
      body: cleanMessage || "视频已回流到预览页。先复核这一段，确认后再继续下一段或导出。",
      next: "去预览页复核。",
      status: cleanMessage || "视频结果待确认。",
      facts: [
        { label: "阶段", value: "已回流" },
        { label: "查看", value: "预览页" },
      ],
    };
  }
  if (normalized === "submitted" && canResume) {
    return {
      phase: "completed" as const,
      toolName: "query_video" as const,
      title: "视频可以查询结果",
      body: cleanMessage || "这个视频任务已经提交过。现在只查询结果，不会重复提交。",
      next: actionLabel || "查询结果。",
      status: cleanMessage || "视频可以查询结果。",
      facts: [
        { label: "阶段", value: "可查询" },
        { label: "保护", value: "不会重复提交" },
      ],
    };
  }
  if (normalized === "submitted") {
    return {
      phase: "completed" as const,
      toolName: "submit_video" as const,
      title: "视频已提交，等待结果",
      body: cleanMessage || "视频任务已串行提交到即梦。等结果回流后，会在预览页显示。",
      next: "等结果回流后去预览页复核。",
      status: cleanMessage || "视频已提交。",
      facts: [
        { label: "阶段", value: "排队中" },
        { label: "方式", value: "串行提交" },
      ],
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
      facts: [
        { label: "阶段", value: "需要处理" },
        { label: "动作", value: "先修复条件" },
      ],
    };
  }
  return undefined;
}

function intentNeedsLocalProjectBeforeTooling(value: string) {
  const text = value.trim();
  if (isDirectorAgentExplainOnlyIntent(text)) return false;
  if (isDirectorAgentPermissionControlOnlyIntent(text)) return false;
  if (intentIsStoryRevisionWithoutTooling(text)) return false;
  return /继续|下一步|生成|参考|视频|导出|补齐|发送|执行|开始|可以|确认/.test(text);
}

function intentRequestsToolOrExportWork(value: string) {
  const text = value.trim();
  if (!text) return false;
  const blocksReference = /(?:先不要|不要|别|不|无需).{0,12}(?:生成|补|补齐|参考|生图)/u.test(text);
  const blocksVideo = /(?:先不要|不要|别|不|无需).{0,12}(?:提交|发送|视频|seedance|即梦)/iu.test(text);
  const blocksExport = /(?:先不要|不要|别|不|无需).{0,12}(?:导出|交付|打包)/u.test(text);
  const asksReference = /补.*参考|生成.*参考|生图|角色图|场景图|道具图|故事板/u.test(text);
  const asksVideo = /提交|发送.*视频|生成.*视频|生视频|seedance|即梦/iu.test(text);
  const asksExport = /导出|交付|打包|export/iu.test(text);
  const asksStartTool = /开始.{0,8}(补|生成|提交|发送|导出|交付|打包|执行)/u.test(text);
  return (asksReference && !blocksReference)
    || (asksVideo && !blocksVideo)
    || (asksExport && !blocksExport)
    || asksStartTool;
}

function intentRequestsVideoSubmitWork(value: string) {
  const text = value.trim();
  if (!text) return false;
  const blocksVideo = /(?:先不要|不要|别|不|无需).{0,12}(?:提交|发送|发|视频|seedance|即梦)/iu.test(text);
  if (blocksVideo) return false;
  return /提交|发送.*视频|发视频|生成.*视频|生视频|seedance|即梦/iu.test(text);
}

function localProjectBlockedIntentLabel(route: ReturnType<typeof routeProjectAgentIntent>, userIntent = "") {
  if (userIntent && isContinueIntent(userIntent) && !intentRequestsToolOrExportWork(userIntent)) return "继续下一步";
  if (route.kind === "video" || route.confirmation === "video_submit") return "发送视频";
  if (route.kind === "export" || route.confirmation === "export") return "导出交付包";
  if (route.kind === "reference" || route.confirmation === "reference_generation") return "补参考";
  return route.label;
}

function intentIsStoryRevisionWithoutTooling(value: string) {
  const text = value.trim();
  if (!text || intentRequestsToolOrExportWork(text)) return false;
  return /改|修改|调整|重写|替换|删除|删掉|增加|新增|减少|合并|拆成|改成|重排|镜头|分镜|故事|草案/u.test(text);
}

function intentCanStartNewVideoPlanningWithoutProject(value: string) {
  if (isDirectorAgentExplainOnlyIntent(value)) return false;
  return directorIntentCanStartNewVideoPlanningWithoutProject(value);
}

function intentStartsFreshVideoDraft(value: string) {
  if (isDirectorAgentExplainOnlyIntent(value)) return false;
  return directorIntentStartsFreshVideoDraft(value);
}

function composerIntentTargetsProjectScope(value: string) {
  const normalized = value.trim().replace(/[，。！？、,.!?;；:："'“”‘’`~\s_-]/g, "");
  if (!normalized) return false;
  if (composerExportIntentTargetsProjectScope(value)) return true;
  return /(?:整个|全部|所有|完整|全片|整片)(?:故事|草案|项目|镜头|分镜|短片|视频)/u.test(normalized);
}

function composerExportIntentExplicitlyTargetsShot(value: string) {
  const text = value.trim();
  if (!text) return false;
  const normalized = text.replace(/[，。！？、,.!?;；:："'“”‘’`~\s_-]/g, "");
  const shotNumberToken = String.raw`(?:[0-9０-９]{1,3}(?:[-_－—–][0-9０-９]{1,3})?|[一二两俩三四五六七八九十]{1,3})`;
  if (new RegExp(String.raw`(?:镜头|分镜|shot)${shotNumberToken}`, "iu").test(normalized)) return true;
  return /(?:导出|交付|打包|export).{0,10}(?:这个|当前|这条|所选|选中|当前选中|this|current|selected).{0,8}(?:镜头|分镜|shot)/iu.test(normalized)
    || /(?:这个|当前|这条|所选|选中|当前选中|this|current|selected).{0,8}(?:镜头|分镜|shot).{0,10}(?:导出|交付|打包|export)/iu.test(normalized);
}

function composerExportIntentTargetsProjectScope(value: string) {
  const text = value.trim();
  if (!text) return false;
  if (/(?:先不要|不要|别|不|无需).{0,12}(?:导出|交付|打包)/u.test(text)) return false;
  if (!/导出|交付|打包|export/iu.test(text)) return false;
  return !composerExportIntentExplicitlyTargetsShot(text);
}

function composerVideoIntentExplicitlyTargetsShot(value: string) {
  const text = value.trim();
  if (!text || !/发送视频|提交视频|生成视频|视频|seedance|即梦/iu.test(text)) return false;
  const normalized = text.replace(/[，。！？、,.!?;；:："'“”‘’`~\s_-]/g, "");
  const shotNumberToken = String.raw`(?:[0-9０-９]{1,3}(?:[-_－—–][0-9０-９]{1,3})?|[一二两俩三四五六七八九十]{1,3})`;
  if (new RegExp(String.raw`(?:镜头|分镜|shot)${shotNumberToken}`, "iu").test(normalized)) return true;
  return /(?:发送|提交|生成|准备).{0,10}(?:这个|当前|这条|所选|选中|当前选中|this|current|selected).{0,8}(?:镜头|分镜|shot|视频段|片段)/iu.test(normalized)
    || /(?:这个|当前|这条|所选|选中|当前选中|this|current|selected).{0,8}(?:镜头|分镜|shot|视频段|片段).{0,10}(?:发送|提交|生成|准备).{0,8}(?:视频|seedance|即梦)?/iu.test(normalized);
}

function intentContinuesCurrentProject(value: string) {
  const text = value.trim();
  if (!text) return false;
  if (/(新建|新项目|新视频|新短片|另起|换个主题|换一个项目|全新|重新开始)/u.test(text)) return false;
  if (composerIntentTargetsProjectScope(text)) return true;
  return isContinueIntent(text)
    || /^(继续|下一步|接着|往下)(了|吧|啊|呀|，|。|！|!|,|\s|$)/u.test(text)
    || /(继续|下一步).{0,24}(检查|处理|推进|参考|视频|导出|生成|提交|发送)/u.test(text);
}

function shouldRouteToReadyNewVideoDraft(value: string) {
  const text = value.trim();
  if (!text) return false;
  if (isDirectorAgentPermissionControlOnlyIntent(text)) return false;
  return text.length <= 600;
}

const readyDraftTargetShotNumberToken = String.raw`([0-9０-９]{1,3}|一|二|两|俩|三|四|五|六|七|八|九|十|十[一二两俩三四五六七八九]|[一二两俩三四五六七八九]十[一二两俩三四五六七八九]?)`;

function parseReadyDraftTargetShotNumber(value: string) {
  const normalized = cleanStoryText(value).replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
  if (/^\d{1,3}$/u.test(normalized)) return Number.parseInt(normalized, 10);
  const digitValues: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    俩: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (normalized === "十") return 10;
  const teenMatch = normalized.match(/^十([一二两俩三四五六七八九])$/u);
  if (teenMatch) return 10 + (digitValues[teenMatch[1] || ""] || 0);
  const tenMatch = normalized.match(/^([一二两俩三四五六七八九])十([一二两俩三四五六七八九])?$/u);
  if (tenMatch) return (digitValues[tenMatch[1] || ""] || 0) * 10 + (digitValues[tenMatch[2] || ""] || 0);
  return digitValues[normalized];
}

function cleanReadyDraftTargetShotRevisionText(value: string) {
  const targetShotPattern = String.raw`(?:第\s*${readyDraftTargetShotNumberToken}|(?:最后|末尾|结尾|最终)\s*(?:那|这|那一|这一|一)?)\s*(?:个|条|段)?\s*(?:镜头|分镜|视频段|片段|段落|幕|镜)`;
  const targetPrefixPattern = new RegExp(String.raw`^(?:(?:这个|这段|这一镜|这镜|这里)?\s*(?:不对|不行|不准确|不太对)\s*[，,。；;\s]*)?(?:把|将|让|请把|请将)?\s*${targetShotPattern}\s*(?:放到|放在|移到|移至|挪到|换到|换至|改成|改为|调整成|调整为|换成|替换成|变成|变为|做成)?\s*`, "iu");
  const selectedTargetPrefixPattern = /^(?:这个(?!\s*(?:故事|草案|项目|短片|视频))|这段|这一镜|这镜|这里|当前镜头)\s*(?:镜头|分镜|视频段|片段|段落|幕|镜)?\s*(?:(?:只改场景不要改动作|只改场景|不要改动作|不要改变动作|不改动作|不改变动作|保留动作|动作不变|动作保持不变)\s*)?[，,。；;\s]*(?:场景|地点|环境)?\s*(?:改到|改为|改成|换到|换至|放到|放在|移到|移至|挪到|调整到|调整为)?\s*/iu;
  const sceneOnlyControlPattern = /(?:只改场景不要改动作|只改场景|不要改动作|不要改变动作|不改动作|不改变动作|保留动作|动作不变|动作保持不变)/giu;
  const safetyClausePattern = /(?:先)?(?:不要|别|不|不用|先不要|先别)[^，,。；;]*(?:参考图|参考|视频|提交|发送|生成)[^，,。；;]*/giu;
  return cleanStoryText(stripDirectorAgentPermissionControlPhrases(value))
    .replace(safetyClausePattern, " ")
    .replace(targetPrefixPattern, " ")
    .replace(selectedTargetPrefixPattern, " ")
    .replace(sceneOnlyControlPattern, " ")
    .replace(/^(?:场景|地点|环境)\s*(?:改到|改为|改成|换到|换至|放到|放在|移到|移至|挪到|调整到|调整为)\s*/iu, " ")
    .replace(/^(?:改到|改为|改成|换到|换至|放到|放在|移到|移至|挪到|调整到|调整为)\s*/iu, " ")
    .replace(/(?:^|[，,。；;\s])(?:图或|参考图或|参考或)(?=$|[，,。；;\s])/giu, " ")
    .replace(/[，,]\s*[，,]+/gu, "，")
    .replace(/^[，,。；;\s]+|[，,。；;\s]+$/gu, "")
    .trim();
}

function readyDraftRemovalTargetFromText(value: string) {
  const cleaned = cleanStoryText(value);
  const clauses = cleaned
    .split(/[，,。；;]/u)
    .map(cleanStoryText)
    .filter(Boolean);
  for (const clause of clauses) {
    if (/(?:参考图|参考|视频|提交|发送|生成|导出)/u.test(clause)) continue;
    if (/(?:只改场景|不要改动作|不要改变动作|不改动作|不改变动作|保留动作|动作不变|动作保持不变)/iu.test(clause)) continue;
    const match = clause.match(/(?:不要再提|不要|别|不用|去掉|移除|删掉|删除)\s*([^，,。；;!?！？\s]{1,16})/u);
    const target = cleanStoryText(match?.[1] || "").replace(/^(?:这?个|那?个)/u, "");
    if (target) return target;
  }
  return "";
}

function readyDraftIntentTargetsSelectedShot(value: string) {
  return /(?:这个(?!\s*(?:故事|草案|项目|短片|视频))|这段|这一镜|这镜|这里|当前镜头)\s*(?:镜头|分镜|视频段|片段|段落|幕|镜)?/iu.test(value);
}

function readyDraftPreservesShotAction(value: string) {
  return /(?:只改场景|不要改动作|不要改变动作|不改动作|不改变动作|保留动作|动作不变|动作保持不变)/iu.test(value);
}

function readyDraftSelectedShotTargetFromAgentContext(context?: {
  title: string;
  hint: string;
  chips: Array<{ label: string; value: string }>;
}) {
  const rawTarget = context?.chips.find((chip) => chip.label === "这个指向")?.value || "";
  const target = cleanStoryText(rawTarget);
  if ((!rawTarget && !target) || context?.title !== "当前镜头") return undefined;
  const rangeMatch = rawTarget.match(/(?:^|\D)([0-9０-９]{1,3})\s*[-－]\s*([0-9０-９]{1,3})(?=\D|$)/u)
    || target.match(/(?:^|\D)([0-9０-９]{1,3})\s*[-－]\s*([0-9０-９]{1,3})(?=\D|$)/u);
  const ordinalMatch = target.match(new RegExp(String.raw`第\s*${readyDraftTargetShotNumberToken}\s*(?:个|条|段)?\s*(?:镜头|分镜|视频段|片段|段落|幕|镜)`, "iu"));
  const plainMatch = target.match(/(?:镜头|分镜|第)\s*([0-9０-９]{1,3})(?=\D|$)/u);
  const shotNumber = rangeMatch
    ? Number.parseInt(rangeMatch[2]!.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)), 10)
    : ordinalMatch
      ? parseReadyDraftTargetShotNumber(ordinalMatch[1] || "")
      : plainMatch
        ? Number.parseInt(plainMatch[1]!.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)), 10)
        : undefined;
  if (!shotNumber || !Number.isFinite(shotNumber) || shotNumber < 1) return undefined;
  return {
    targetLabel: `第 ${shotNumber} 镜`,
    targetFact: `第 ${shotNumber} 镜（已选中）`,
  };
}

function readyDraftTargetShotRevisionFromIntent(value: string, shotCount: number, selectedTarget?: { targetLabel: string; targetFact: string }) {
  const text = cleanStoryText(value);
  if (!text) return undefined;
  const tailMatch = text.match(/(?:把|将|让|请把|请将)?\s*(?:最后|末尾|结尾|最终)\s*(?:那|这|那一|这一|一)?\s*(?:个|条|段)?\s*(?:镜头|分镜|视频段|片段|段落|幕|镜)/iu);
  const ordinalMatch = text.match(new RegExp(String.raw`(?:把|将|让|请把|请将)?\s*第\s*${readyDraftTargetShotNumberToken}\s*(?:个|条|段)?\s*(?:镜头|分镜|视频段|片段|段落|幕|镜)`, "iu"));
  const ordinalNumber = ordinalMatch ? parseReadyDraftTargetShotNumber(ordinalMatch[1] || "") : undefined;
  const selectedMatch = selectedTarget && readyDraftIntentTargetsSelectedShot(text);
  if (!tailMatch && !ordinalNumber && !selectedMatch) return undefined;
  const targetLabel = selectedMatch ? selectedTarget.targetLabel : tailMatch ? "最后一镜" : `第 ${ordinalNumber} 镜`;
  const revisionText = cleanReadyDraftTargetShotRevisionText(text);
  const sceneMove = /(放到|放在|移到|移至|挪到|换到|换至|改到|改为|改成|调整到|调整为)/u.test(text);
  const removalTarget = readyDraftRemovalTargetFromText(text);
  const preserveAction = readyDraftPreservesShotAction(text);
  const targetFact = selectedMatch
    ? selectedTarget.targetFact
    : tailMatch && removalTarget
    ? `${targetLabel}（含${removalTarget}的镜头）`
    : tailMatch && shotCount > 0
      ? `${targetLabel}（第 ${shotCount} 镜）`
      : targetLabel;
  const changeFact = revisionText
    ? removalTarget
      ? `去掉：${removalTarget}`
      : sceneMove
      ? `场景：${revisionText}${preserveAction ? "（保留原动作）" : ""}`
      : revisionText
    : "";
  const body = revisionText
    ? removalTarget
      ? `我理解你要把${targetLabel}里的${removalTarget}去掉。发送后我会先更新这个镜头，不会生成参考图，也不会发送视频。`
      : sceneMove
        ? `我理解你要把${targetLabel}的场景改到${revisionText}${preserveAction ? "，并保留原动作" : ""}。发送后我会先更新这个镜头，不会生成参考图，也不会发送视频。`
        : `我理解你要修改${targetLabel}：${revisionText}。发送后我会先更新这个镜头，不会生成参考图，也不会发送视频。`
    : `我理解你要修改${targetLabel}。发送后我会先更新这个镜头，不会生成参考图，也不会发送视频。`;
  return {
    label: `修改${targetLabel}`,
    targetFact,
    changeFact,
    preserveAction,
    body,
  };
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
  projectScope?: boolean;
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

function agentActionIsProjectDraftEdit(action?: DirectorAgentActionEnvelope) {
  return action?.kind === "revise_story_or_shot" || action?.kind === "update_shot_strategy";
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
  if (localAction.status !== "blocked" && stagedAction.status === "blocked" && isConcreteLocalAgentAction(localAction)) return localAction;
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

function restoredAgentStagedPlanConfirmationBody(
  action: DirectorAgentActionEnvelope,
  scopeLabel: string,
) {
  if (action.kind === "prepare_reference_generation") {
    return `我已经恢复了待确认的参考生成计划，范围是${scopeLabel}。确认前不会生成图片；确认后才会开始生成参考。`;
  }
  if (action.kind === "prepare_video_submit") {
    return action.executionContract.videoSubmitAllowed
      ? `我已经恢复了待确认的视频发送计划，范围是${scopeLabel}。确认前不会发送视频；确认后才会提交。`
      : `我已经恢复了待确认的视频计划，范围是${scopeLabel}。确认前不会发送视频；确认后只继续整理计划。`;
  }
  if (action.kind === "prepare_export") {
    return `我已经恢复了待确认的导出计划，范围是${scopeLabel}。确认前不会写入导出文件；确认后才会导出。`;
  }
  if (action.kind === "request_style_research") {
    return `我已经恢复了待确认的资料查询计划，范围是${scopeLabel}。确认前不会开始查询；确认后才会继续。`;
  }
  return `我已经恢复了待确认的计划，范围是${scopeLabel}。确认前不会执行；确认后只按这一步推进。`;
}

function restoredAgentStagedPlanThreadMessages(draft?: ProjectAgentStagedPlanDraft): MinimalAgentMessage[] {
  if (!draft || draft.status !== "active" || !draft.action) return [];
  const action = draft.action;
  if (action.status !== "staged" || !action.requiresUserConfirmation) return [];
  const handoff = draft.toolHandoff;
  const actionLabel = agentReviewPrimaryLabel(action);
  const scopeLabel = draft.scopeLabel || agentActionScopeLabel(action, handoff, "review");
  const confirmationFacts = agentActionConfirmationFacts(action, handoff, "review");
  return [
    {
      id: `restored_agent_user_${action.actionId}`,
      role: "user",
      title: "你",
      body: shortAgentPanelMessageText(draft.userIntent),
      actionKind: action.kind,
      actionId: action.actionId,
    },
    {
      id: `restored_agent_confirmation_${action.actionId}`,
      entryType: "confirmation_request",
      role: "confirmation",
      title: `请确认：${actionLabel}`,
      body: restoredAgentStagedPlanConfirmationBody(action, scopeLabel),
      lifecycle: "waiting_for_confirmation",
      status: "waiting",
      toolName: "request_user_confirmation",
      actionKind: action.kind,
      actionId: action.actionId,
      facts: [
        { label: "目标", value: scopeLabel },
        { label: "动作", value: action.summary || actionLabel },
        ...confirmationFacts,
      ],
      confirmationFacts,
      confirmationBoundary: "确认前不会执行；确认后只按这一步推进。",
      next: `确认后继续：${actionLabel}`,
    },
  ];
}

function agentCapabilityItems(
  availability: DirectorAgentToolAvailability,
  contract: AgentVideoPermissionContract,
  projectStatusLabel?: string,
  localProjectReady = availability.projectReady,
) {
  const videoSubmitWaitLabel = videoSubmitBlockerLabel(availability.videoSubmitBlockers?.[0]) || "先准备视频";
  const referenceCapabilityValue = !contract.referenceGenerationAllowed
    ? "仅计划"
    : !localProjectReady
      ? "选择保存位置"
    : availability.referenceGenerationReady
      ? "可生成"
      : "先连接图片服务";
  return [
    {
      id: "project",
      label: "项目",
      value: availability.projectReady ? projectStatusLabel || "已连接" : "需要保存位置",
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
      label: "参考",
      value: referenceCapabilityValue,
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
          ? "选择保存位置"
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
      value: !localProjectReady ? "选择保存位置" : availability.exportReady ? "可用" : "未准备",
      tone: availability.exportReady && localProjectReady ? "ready" : "waiting",
    },
  ];
}

function videoSubmitBlockerLabel(blocker?: string) {
  if (blocker === "video_submit_missing_project") return "选择保存位置";
  if (blocker === "video_submit_callback_missing") return "入口不可用";
  if (blocker === "video_submit_missing_references") return "先补参考";
  if (blocker === "video_submit_key_missing") return "先保存 Key";
  if (blocker === "video_submit_already_sent") return "先查结果";
  return "";
}

function videoSubmitBlockerAgentReply(blocker?: string) {
  if (blocker === "video_submit_missing_project") {
    return {
      body: "我还没有这版故事的保存位置。先选择保存位置后，我才能整理素材、补参考和提交视频。",
      next: "先选择保存位置。",
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
  const hierarchyItem = items.find((item) => item.id === "project-hierarchy");
  const attentionItems = items.filter((item) => item.tone !== "ready" && item.id !== "project-hierarchy");
  const fallbackItems = items.filter((item) => item.id !== "project" && item.id !== "project-hierarchy");
  return [
    ...(hierarchyItem ? [hierarchyItem] : []),
    ...(attentionItems.length ? attentionItems : fallbackItems),
  ].slice(0, 3);
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

function projectHierarchyCapabilityItem(input: {
  sectionCount: number;
  shotCount: number;
  assetCount: number;
  skillCount: number;
  storyLabel?: string;
}): ReturnType<typeof agentCapabilityItems>[number] {
  const storyPart = input.storyLabel
    ? `${input.storyLabel} / ${input.shotCount} 镜头`
    : input.sectionCount > 0
    ? `${input.sectionCount} 段 / ${input.shotCount} 镜头`
    : `短片 / ${input.shotCount} 镜头`;
  const supportPart = input.skillCount > 0
    ? `${input.assetCount} 素材 / ${input.skillCount} Skills`
    : `${input.assetCount} 素材`;
  return {
    id: "project-hierarchy",
    label: "项目",
    value: `${storyPart} · ${supportPart}`,
    tone: input.shotCount > 0 ? "ready" : "waiting",
  };
}

function pendingDraftShotCountFromMessage(message?: MinimalAgentMessage) {
  if (!message || !isNewVideoDraftConfirmationLabel(minimalAgentConfirmationAction(message, NEW_VIDEO_DRAFT_CONFIRM_LABEL).label)) return 0;
  const shotFact = minimalAgentFactValue(message, ["镜头", "分镜", "视频段"]);
  const match = shotFact.match(/([0-9０-９]{1,3})/);
  if (!match) return 0;
  const normalized = match[1].replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0));
  const count = Number.parseInt(normalized, 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
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

function selectionHierarchyValue(input: {
  shot?: ShotRecord;
  selectedShots: ShotRecord[];
  asset?: AssetRecord;
  sectionLabel?: string;
}) {
  if (input.selectedShots.length > 1) return input.sectionLabel ? "当前段落里的镜头组" : "当前项目里的镜头组";
  if (input.shot) return input.sectionLabel ? "当前段落里的镜头" : "当前项目里的镜头";
  if (input.asset) return "当前项目里的素材";
  if (input.sectionLabel) return "当前段落";
  return "整个项目";
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
      { label: "位置", value: selectionHierarchyValue(input) },
      { label: "选中", value: `${input.selectedShots.length} 个镜头` },
      { label: "镜头", value: `${shotLabels}${suffix}` },
    ];
  }
  if (input.shot) {
    const shotTitle = cleanStoryText(input.shot.title) || "未命名";
    return [
      { label: "位置", value: selectionHierarchyValue(input) },
      { label: "镜头", value: `${formatShotNumber(input.shot.id)} · ${shotTitle}` },
      { label: "方式", value: referenceStrategyLabel(input.shot.referenceStrategy) },
      input.shot.durationSeconds ? { label: "时长", value: `${input.shot.durationSeconds}s` } : undefined,
    ].filter((item): item is { label: string; value: string } => Boolean(item));
  }
  if (input.asset) {
    return [
      { label: "位置", value: selectionHierarchyValue(input) },
      { label: "素材", value: productScopeLabel(input.asset.name || input.asset.id) },
      { label: "类型", value: assetTypeLabel(input.asset.type) },
    ];
  }
  if (input.sectionLabel) {
    return [
      { label: "位置", value: selectionHierarchyValue(input) },
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
  const selectedSection = context.sectionId
    ? input.runtimeState.storyFlow.sections.find((item) => item.id === context.sectionId)
    : undefined;
  const sectionLabel = selectedSection?.label || context.scopeLabel;
  const shotIds = [...new Set([...(context.selectedShotIds || []), context.selectedShotId].filter(Boolean) as string[])];
  if (shotIds.length > 1) {
    const selectedShots = shotIds
      .map((shotId) => input.runtimeState.storyFlow.shots.find((item) => item.id === shotId))
      .filter((shot): shot is ShotRecord => Boolean(shot));
    if (selectedShots.length === shotIds.length) return selectionContextChips({ selectedShots, sectionLabel });
    const shotLabels = shotIds.slice(0, 3).map((shotId) => formatShotNumber(shotId)).join("、");
    const suffix = shotIds.length > 3 ? ` +${shotIds.length - 3}` : "";
    return [
      { label: "位置", value: sectionLabel ? "当前段落里的镜头组" : "当前项目里的镜头组" },
      { label: "选中", value: `${shotIds.length} 个镜头` },
      { label: "镜头", value: `${shotLabels}${suffix}` },
    ];
  }
  if (shotIds.length === 1) {
    const selectedShot = input.runtimeState.storyFlow.shots.find((item) => item.id === shotIds[0]);
    if (selectedShot) return selectionContextChips({ shot: selectedShot, selectedShots: [], sectionLabel });
    return [
      { label: "位置", value: sectionLabel ? "当前段落里的镜头" : "当前项目里的镜头" },
      { label: "镜头", value: formatShotNumber(shotIds[0] || "") },
    ];
  }
  if (context.selectedAssetId) {
    const selectedAsset = input.runtimeState.visualMemory.assets.find((item) => item.id === context.selectedAssetId);
    if (selectedAsset) return selectionContextChips({ asset: selectedAsset, selectedShots: [] });
    return [{ label: "素材", value: productScopeLabel(context.selectedAssetId) }];
  }
  if (context.sectionId) {
    return [
      { label: "位置", value: "当前段落" },
      { label: "段落", value: productScopeLabel(selectedSection?.label || context.scopeLabel || context.sectionId) },
    ];
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
const COMPOSER_MATERIAL_INTAKE_HELP = "脚本、图片、声音或视频会先进入素材收件箱，AI 导演先分类；采用前等你确认。";

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

function visibleIdleActionSuggestionForPermission(
  item: DirectorAgentSuggestedAction,
  contract: AgentVideoPermissionContract,
): DirectorAgentSuggestedAction {
  if (contract.mode !== "plan_only" || item.kind !== "prepare_reference_generation") return item;
  return {
    ...item,
    label: "准备参考计划",
    reason: "只整理参考范围和优先级，确认前不会生成图片，也不会提交视频。",
  };
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
  if (action.kind === "update_shot_strategy") return "确认修改方式";
  return "确认修改";
}

function agentActionIsStatusInspection(action?: DirectorAgentActionEnvelope): action is DirectorAgentActionEnvelope & { kind: "inspect_project_status" } {
  return action?.kind === "inspect_project_status";
}

function agentToolRecordLabel(handoff: DirectorAgentToolHandoff) {
  if (handoff.status === "handled_by_project_write") return "已写入项目";
  if (agentToolOnlyNeedsConfirmation(handoff)) return "确认后修改项目";
  if (handoff.status === "ready") return "先选择保存位置，再执行动作";
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
  if (blockers.includes("project_not_ready")) return "需要保存位置";
  if (blockers.includes("web_search_not_ready")) return "先开启查资料";
  if (blockers.includes("reference_generation_not_ready")) return "先连接图片服务";
  if (blockers.includes("reference_generation_not_allowed")) return "先整理";
	  if (blockers.includes("video_submit_not_ready")) return "先准备视频";
	  if (blockers.includes("video_submit_not_allowed")) return "当前不能发送";
  if (blockers.includes("export_not_ready")) return "先准备导出";
  if (blockers.includes("agent_action_blocked")) return "等你补充";
  return "先处理阻断";
}

function agentToolPreflightNotice(handoff: DirectorAgentToolHandoff) {
  const blockers = handoff.blockers.filter((blocker) => blocker !== "user_confirmation_required");
  if (!blockers.length) return "";
  if (blockers.includes("reference_generation_not_ready")) {
    return "图片服务还没连接，所以现在不能确认生成参考。先去设置里连接图片服务；确认前不会生成图片，也不会提交视频。";
  }
  const label = agentToolPreflightLabel(handoff);
  return label ? `现在还不能执行：${label}。确认前不会调用外部服务。` : "";
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
    return [];
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
  if (field === "referencePlan") return "参考计划";
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
  if (field === "storyShotCount") return "镜头数";
  if (field === "exportPackage") return "导出包";
  if (field === "selectedScopeDraft") return "当前选择";
  if (field === "projectDraft") return "项目草案";
  if (field === "directorIntent") return "修改方向";
  if (field === "versionPolicy") return "版本处理";
  if (field === "reviewGate") return "新版本复核";
  return field;
}

function agentActionDiffs(action?: DirectorAgentActionEnvelope) {
  if (agentActionIsStatusInspection(action)) return [];
  return (action?.proposedChanges || []).map((change) => ({
    label: agentActionFieldLabel(change.field),
    value: cleanMinimalAgentMessageCopy(change.from ? `${change.from} -> ${change.to}` : change.to),
    reason: cleanMinimalAgentMessageCopy(change.reason),
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

function confirmedProjectImpactLabel(
  result?: NonNullable<PrototypeAgentDemoRun["result"]>,
  handoff?: DirectorAgentToolHandoff,
  action?: DirectorAgentActionEnvelope,
) {
  const storyShotCountChange = action?.proposedChanges.find((change) =>
    change.field === "storyShotCount" && change.to.trim()
  );
  if (storyShotCountChange) return `整个故事 · ${storyShotCountChange.to.trim()}`;
  if (result?.projectImpactLabel) return result.projectImpactLabel;
  if (handoff) return agentToolScopeLabel(handoff, action);
  return undefined;
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
        : result.projectTemporaryUpdated
        ? result.storageLabel || "草案已更新"
        : result.projectSaved
        ? result.storageLabel || "已保存到项目"
        : result.projectVibeAdded
          ? result.storageLabel || "已写入，保存待重试"
          : "还未写入",
    });
    const projectImpactLabel = confirmedProjectImpactLabel(result, handoff, action);
    if (projectImpactLabel) facts.push({ label: "影响", value: projectImpactLabel });
    const projectTaskLabel = result.projectTemporaryUpdated ? "选择保存位置" : creatorProjectTaskLabel(result.projectTaskLabel);
    if (projectTaskLabel) {
      if (result.projectTemporaryUpdated) facts.push({ label: "下一步", value: projectTaskLabel });
      else facts.push({ label: "待处理", value: projectTaskLabel });
    }
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

function confirmedResultNextActionCopy(facts: Array<{ label: string; value: string }>) {
  const nextStep = facts.find((fact) => fact.label === "下一步")?.value.trim() || "";
  if (nextStep === "选择保存位置") {
    return {
      label: "选择保存位置",
      intent: "选择保存位置",
      inspectLabel: "检查保存位置",
    };
  }
  return {
    label: "继续下一步",
    intent: "下一步",
    inspectLabel: "检查下一步",
  };
}

function prototypeAgentRunHasFailure(run?: PrototypeAgentDemoRun) {
  const combinedStatus = `${run?.status || ""} ${run?.result?.status || ""}`;
  return /\b(?:error|failed|blocked)\b/i.test(combinedStatus);
}

function confirmedResultNeedsRetry(run?: PrototypeAgentDemoRun, handoff?: DirectorAgentToolHandoff) {
  if (prototypeAgentRunHasFailure(run)) return true;
  if (run?.status || run?.result) return false;
  return handoff?.status === "blocked";
}

function agentConfirmedResultNextStep(handoff: DirectorAgentToolHandoff, run?: PrototypeAgentDemoRun) {
  const result = run?.result;
  if (run?.status === "error" || result?.status === "error") return "调整后可重试";
  if (result?.previewReady) return "去预览确认";
  if (result?.projectTemporaryUpdated) return "选择保存位置";
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

function confirmedProjectWriteOutcomeForLocalState(
  outcome: ConfirmedAgentToolRunOutcome,
  handoff: DirectorAgentToolHandoff | undefined,
  localProjectReadyForTools: boolean,
): ConfirmedAgentToolRunOutcome {
  if (localProjectReadyForTools || handoff?.status !== "handled_by_project_write" || outcome.status !== "completed") {
    return outcome;
  }
  return {
    ...outcome,
    label: "草案已更新，尚未选择保存位置",
    projectRecordPreserved: false,
    resultFacts: [
      ...(outcome.resultFacts || []),
      { label: "保存", value: "尚未选择保存位置" },
      { label: "下一步", value: "选择保存位置" },
    ],
  };
}

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
  localProjectReadyForTools = true,
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
    const projectWriteLabel = localProjectReadyForTools ? "修改已写入项目" : "草案已更新";
    return {
      status: "ready",
      result: {
        label: projectWriteLabel,
        projectVibeAdded: true,
        projectTemporaryUpdated: !localProjectReadyForTools,
        projectSaved: localProjectReadyForTools,
        storageLabel: localProjectReadyForTools ? "已保存到项目" : "草案已更新",
        ...projectRecordFacts,
        projectTaskLabel: localProjectReadyForTools ? projectRecordFacts.projectTaskLabel : "选择保存位置",
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

function runtimeProjectRootIsLocalFolder(projectRoot?: string) {
  const normalized = projectRoot?.replace(/\\/g, "/").trim() || "";
  if (!normalized) return false;
  return normalized !== "project_root"
    && normalized !== "user_selected_project_root:unbound"
    && normalized !== ".vibe-runtime/browser-projects"
    && !normalized.startsWith(".vibe-runtime/browser-projects/")
    && !normalized.includes("/.vibe-runtime/browser-projects/")
    && !normalized.startsWith("browser-local:");
}

function exportWorkerReadyForAgentConfirmation(worker?: ExportWorkerState) {
  if (!worker || worker.blockers.length) return false;
  if (!worker.deliveryGate.canPrepare || worker.deliveryGate.status !== "ready_for_confirmation") return false;
  if (worker.readiness === "ready") return true;
  return Boolean(worker.manifest.mvpPackage.reportIncluded && worker.manifest.files.length > 0);
}

function nonConfirmationToolBlockers(handoff?: DirectorAgentToolHandoff) {
  return (handoff?.blockers || []).filter((blocker) => blocker !== "user_confirmation_required");
}

function uniqueProjectAgentBlockers(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function refreshedRestoredAgentStagedPlanDraft(
  draft: ProjectAgentStagedPlanDraft,
  refreshedToolHandoff: DirectorAgentToolHandoff,
): ProjectAgentStagedPlanDraft {
  const blockedReasons = uniqueProjectAgentBlockers([
    ...(draft.action?.blockers || []),
    ...nonConfirmationToolBlockers(refreshedToolHandoff),
  ]);
  return {
    ...draft,
    toolHandoff: refreshedToolHandoff,
    blockedReasons,
    loopStatus: blockedReasons.length ? "blocked" : "awaiting_confirmation",
  };
}

function restoredAgentStagedPlanDraftNeedsWriteBack(
  draft: ProjectAgentStagedPlanDraft,
  refreshedDraft: ProjectAgentStagedPlanDraft,
) {
  const original = draft.toolHandoff;
  const refreshed = refreshedDraft.toolHandoff;
  return draft.loopStatus !== refreshedDraft.loopStatus
    || draft.blockedReasons.join("|") !== refreshedDraft.blockedReasons.join("|")
    || original?.status !== refreshed?.status
    || original?.userFacingMessage !== refreshed?.userFacingMessage
    || (original?.blockers || []).join("|") !== (refreshed?.blockers || []).join("|")
    || Boolean(original?.invocation) !== Boolean(refreshed?.invocation);
}

function agentCurrentTaskStepFromActionKind(actionKind?: VibeAgentTimelineEntry["actionKind"]): AgentCurrentTaskStep | undefined {
  if (actionKind === "prepare_reference_generation" || actionKind === "review_reference_asset") return "prepare_references";
  if (actionKind === "prepare_video_submit" || actionKind === "query_video_result") return "submit_video";
  if (actionKind === "prepare_export") return "export";
  if (actionKind === "revise_story_or_shot" || actionKind === "update_shot_strategy") return "confirm_story";
  return undefined;
}

function agentCurrentTaskConfirmationKindFromActionKind(
  actionKind?: VibeAgentTimelineEntry["actionKind"],
): AgentCurrentTaskConfirmationKind {
  return actionKind === "revise_story_or_shot" || actionKind === "update_shot_strategy"
    ? "project_edit"
    : "pipeline_action";
}

function agentCurrentTaskStepFromStructuredAction(input: {
  id: string;
  actionKind?: VibeAgentTimelineEntry["actionKind"];
  toolName?: VibeAgentTimelineEntry["toolName"];
}): AgentCurrentTaskStep | undefined {
  const actionStep = agentCurrentTaskStepFromActionKind(input.actionKind);
  if (actionStep) return actionStep;
  if (
    input.id.startsWith("footer_action_new_video_draft")
    || input.id.startsWith("new_video_confirmation_")
    || input.id.startsWith("new_video_draft_committed_")
    || input.id.startsWith("pending_project_edit_confirmation_")
    || input.id.startsWith("preserved_project_edit_confirmation_")
  ) return "confirm_story";
  if (
    input.id === "footer_action_project_setup"
    || input.id.startsWith("local_agent_project_confirmation_")
  ) return "choose_save_location";
  if (input.toolName === "generate_references") return "prepare_references";
  if (input.toolName === "submit_video" || input.toolName === "query_video") return "submit_video";
  if (input.toolName === "export_project" || input.toolName === "export_showcase") return "export";
  return undefined;
}

function agentCurrentTaskStepFromMessage(message: MinimalAgentMessage): AgentCurrentTaskStep | undefined {
  return agentCurrentTaskStepFromStructuredAction(message);
}

function agentCurrentTaskMessageIsStructuredNewVideoDraftConfirmation(message: MinimalAgentMessage) {
  return minimalAgentMessageIsWaitingConfirmation(message)
    && agentCurrentTaskStepFromMessage(message) === "confirm_story"
    && (
      message.id.startsWith("footer_action_new_video_draft")
      || message.id.startsWith("new_video_confirmation_")
    );
}

function agentCurrentTaskConfirmationMessage(
  projection: AgentCurrentTaskProjection,
  messages: MinimalAgentMessage[],
) {
  if (!projection.requiresConfirmation) return undefined;
  const waitingMessages = messages.filter((message) => (
    minimalAgentMessageIsWaitingConfirmation(message)
    && !minimalAgentMessageRequestsSkillSave(message)
  ));
  if (projection.confirmationId) {
    const confirmationMatch = waitingMessages.find((message) => message.id === projection.confirmationId);
    if (confirmationMatch) return confirmationMatch;
  }
  if (projection.actionId) {
    const actionMatch = [...waitingMessages].reverse().find((message) => message.actionId === projection.actionId);
    if (actionMatch) return actionMatch;
  }
  return [...waitingMessages]
    .reverse()
    .find((message) => agentCurrentTaskStepFromMessage(message) === projection.step);
}

function agentCurrentTaskEffectLabel(projection: AgentCurrentTaskProjection) {
  if (projection.step === "draft_story") return "整理创作意图，不启动生成";
  if (projection.step === "confirm_story") return "保存当前故事并推进项目状态";
  if (projection.step === "confirm_version_selection") return "只写独立选择回执，不改项目事实";
  if (projection.step === "confirm_project_fact_promotion") return "只晋级已选择的获胜版本，不导出";
  if (projection.step === "prepare_references" && !projection.requiresConfirmation && projection.effect === "none") return "检查生成结果并决定是否采用";
  if (projection.effect === "state_only") return "只更新项目位置与绑定状态";
  if (projection.effect === "generation_job") return "建立这一步的受控任务与回执";
  if (projection.effect === "local_export") return "只写入本地交付资料包";
  return "等待你的下一句指令";
}

function agentCurrentTaskBoundaryLabel(projection: AgentCurrentTaskProjection) {
  if (projection.step === "confirm_story" || projection.step === "choose_save_location") {
    return "不会生成参考、提交视频或导出。";
  }
  if (projection.step === "prepare_references") return "不会提交视频或导出。";
  if (projection.step === "submit_video") return "不会绕过参考前提，也不会重复提交已有任务。";
  if (projection.step === "confirm_version_selection") return "不会修改项目事实、Visual Memory 或 Delivery。";
  if (projection.step === "confirm_project_fact_promotion") return "不会删除落选版本，也不会自动导出。";
  if (projection.step === "export") return "不会调用图片或视频 Provider。";
  return "不会在没有明确确认时执行。";
}

function agentCurrentTaskTone(projection: AgentCurrentTaskProjection) {
  if (projection.blockers.length) return "blocked";
  if (projection.source === "pipeline_job" && !projection.requiresConfirmation) return "running";
  if (projection.requiresConfirmation) return "waiting";
  if (projection.step === "idle") return "ready";
  return "working";
}

function agentCurrentTaskStatusLabel(projection: AgentCurrentTaskProjection) {
  if (projection.step === "prepare_references" && !projection.requiresConfirmation && projection.effect === "none") return "等待复核";
  const tone = agentCurrentTaskTone(projection);
  if (tone === "blocked") return "需要处理";
  if (tone === "running") return "处理中";
  if (tone === "waiting") return "等待确认";
  if (tone === "ready") return "可以继续";
  return "正在整理";
}

function AgentCurrentTaskIcon({ step }: { step: AgentCurrentTaskStep }) {
  if (step === "draft_story") return <Sparkles size={18} aria-hidden="true" />;
  if (step === "confirm_story") return <Clapperboard size={18} aria-hidden="true" />;
  if (step === "choose_save_location") return <FolderOpen size={18} aria-hidden="true" />;
  if (step === "prepare_references") return <Images size={18} aria-hidden="true" />;
  if (step === "submit_video") return <Video size={18} aria-hidden="true" />;
  if (step === "confirm_version_selection") return <CheckCircle2 size={18} aria-hidden="true" />;
  if (step === "confirm_project_fact_promotion") return <LockKeyhole size={18} aria-hidden="true" />;
  if (step === "export") return <PackageCheck size={18} aria-hidden="true" />;
  return <CircleDashed size={18} aria-hidden="true" />;
}

function agentCurrentTaskStepFromTimelineEntry(entry: VibeAgentTimelineEntry): AgentCurrentTaskStep | undefined {
  return agentCurrentTaskStepFromStructuredAction(entry);
}

function agentCurrentTaskConfirmationFromTimelineEntry(
  entry: VibeAgentTimelineEntry,
  executionMode?: MinimalAgentConfirmationExecutionMode,
): AgentCurrentTaskConfirmation | undefined {
  if (entry.type !== "confirmation_request") return undefined;
  if (entry.status !== "waiting" && entry.lifecycle !== "waiting_for_confirmation") return undefined;
  const step = agentCurrentTaskStepFromTimelineEntry(entry);
  if (!step) return undefined;
  const message = minimalAgentConfirmationMessageForExecutionMode(
    minimalAgentMessageFromTimelineEntry(entry),
    executionMode,
  );
  return {
    confirmationId: entry.id,
    step,
    kind: agentCurrentTaskConfirmationKindFromActionKind(entry.actionKind),
    projectId: stringValue(entry.details?.projectId),
    projectRoot: stringValue(entry.details?.projectRoot),
    projectFactHash: stringValue(entry.details?.projectFactHash),
    status: "waiting",
    createdAt: entry.createdAt,
    actionId: entry.actionId,
    label: minimalAgentConfirmationAction(message, entry.title).label,
    facts: entry.facts,
  };
}

function agentCurrentTaskCompletedStepsFromTimelineEntries(
  entries: VibeAgentTimelineEntry[],
  identity: { projectId: string; projectRoot?: string; projectFactHash: string },
): AgentCurrentTaskCompletedStep[] {
  const completed = new Map<AgentCurrentTaskStep, AgentCurrentTaskCompletedStep>();
  for (const entry of entries) {
    const executionReceipt = agentVideoExecutionReceiptFromTimelineEntry(entry, identity);
    const executionResult = isPlainRecord(entry.details?.executionResult) ? entry.details.executionResult : undefined;
    const executionStatus = stringValue(executionResult?.status);
    const outcomeStatus = stringValue(entry.details?.outcomeStatus);
    const done = entry.status === "done"
      || entry.lifecycle === "succeeded"
      || executionStatus === "succeeded"
      || outcomeStatus === "completed";
    if (!done) continue;
    const step = agentCurrentTaskStepFromTimelineEntry(entry);
    if (!step) continue;
    if (step === "export" && !executionReceipt) continue;
    const projectId = executionReceipt?.projectId || stringValue(entry.details?.projectId);
    const projectRoot = executionReceipt?.projectRoot || stringValue(entry.details?.projectRoot);
    const projectFactHash = executionReceipt?.projectFactHash || stringValue(entry.details?.sourceFactHash) || stringValue(entry.details?.projectFactHash);
    if (
      projectId !== identity.projectId
      || normalizeAgentVideoExecutionProjectRoot(projectRoot) !== normalizeAgentVideoExecutionProjectRoot(identity.projectRoot)
      || projectFactHash !== identity.projectFactHash
    ) continue;
    completed.set(step, {
      step,
      projectId,
      projectRoot,
      projectFactHash,
      executionMode: executionReceipt?.executionMode,
      actionId: entry.actionId,
      completedAt: entry.createdAt,
    });
  }
  return [...completed.values()];
}

function agentCurrentTaskStagedPlanRestoreFromDraft(
  draft?: ProjectAgentStagedPlanDraft,
): AgentCurrentTaskStagedPlanRestore | undefined {
  if (!draft) return undefined;
  return {
    status: draft.status,
    step: draft.action ? agentCurrentTaskStepFromActionKind(draft.action.kind) : undefined,
    kind: agentCurrentTaskConfirmationKindFromActionKind(draft.action?.kind),
    projectId: draft.projectId,
    projectRoot: draft.projectRoot,
    projectFactHash: draft.sourceFactHash,
    confirmationId: draft.draftId,
    actionId: draft.action?.actionId,
    label: draft.projectTaskLabel || draft.toolHandoff?.userFacingMessage || draft.action?.summary,
    createdAt: draft.createdAt,
    clearedAt: draft.clearedAt,
    blockers: draft.blockedReasons,
  };
}

function agentVideoDryRunActionFor(action?: DirectorAgentActionEnvelope): AgentVideoExecutionAction | undefined {
  if (action?.kind === "prepare_reference_generation") return "prepare_references";
  if (action?.kind === "prepare_video_submit") return "submit_video";
  if (action?.kind === "prepare_export") return "export";
  return undefined;
}

function minimalAgentReviewTargetIdentity(target?: CreatorReviewTrayItem) {
  const sourceId = stringValue(target?.sourceReceiptId);
  const outputId = stringValue(target?.outputHash);
  return {
    sourceId,
    outputId,
    key: [target?.id, target?.jobId, target?.actionId, target?.projectFactHash, sourceId, outputId, target?.status].filter(Boolean).join(":"),
  };
}

function minimalAgentReviewTargetFromGenerationJob(job?: AgentVideoGenerationJob): CreatorReviewTrayItem | undefined {
  const result = job?.reviewResult;
  if (!job || !result || job.status !== "succeeded" || result.status !== "needs_review") return undefined;
  return {
    id: `agent_video_review_${job.jobId}`,
    shotId: result.shotId,
    label: result.shotId,
    detail: "视频结果已返回",
    status: "needs_review",
    mediaPath: result.outputPath,
    sourceReceiptId: result.sourceReceiptId,
    outputHash: result.outputHash,
    jobId: job.jobId,
    actionId: job.actionId,
    projectFactHash: job.projectFactHash,
  };
}

function minimalAgentReviewTargetsMatch(left?: CreatorReviewTrayItem, right?: CreatorReviewTrayItem) {
  if (!left || !right) return false;
  const normalizedPath = (value?: string) => value?.trim().replace(/\\/g, "/").replace(/^\/private\/tmp(?=\/|$)/, "/tmp") || "";
  return left.shotId === right.shotId
    && left.sourceReceiptId === right.sourceReceiptId
    && left.outputHash?.toLowerCase() === right.outputHash?.toLowerCase()
    && normalizedPath(left.mediaPath) === normalizedPath(right.mediaPath);
}

export function MinimalAgentPanel({
  runtimeState,
  projectFactHash = "",
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
  restoredAgentGenerationJobLedger,
  restoredAgentReviewSelectionLedger,
  reviewReceipts,
  onStagePrototypeAgentPlan,
  onClearPrototypeAgentPlan,
  onRefreshRestoredAgentStagedPlanDraft,
  onRememberAgentActionLogItem,
  onRememberAgentTimelineEntries,
  onRememberAgentGenerationJobLedger,
  onRememberAgentReviewSelectionLedger,
  onPromoteAgentReviewSelection,
  onSaveResearchAsReference,
  onCreateP6RealSample,
  onCreateImage2EndFrame,
  onCreateLocalProject,
  onStartNewVideoDraftFromAgent,
  onContinueNewVideoDraftFromAgent,
  onConfirmNewVideoDraftFromAgent,
  newVideoResetKey = 0,
  newVideoDraftPendingForAgent = false,
  newVideoDraftPlanningForAgent = false,
  newVideoDraftReadyForAgent = false,
  newVideoDraftShotCountForAgent = 0,
  newVideoAgentSelectionContext,
  onSendSeedanceVideo,
  onRunExport,
  onOpenResultView,
  onRetryMissingBatch,
  reviewTarget,
  reviewVersionPair,
  activeReviewVersion = "B",
  onActiveReviewVersionChange,
  onApproveReviewItem,
  onSelectShot,
  agentCommand,
  projectObservation,
  projectStatusView,
  exportAction,
  exportWorker,
  videoPermissionContract,
  onVideoPermissionContractChange,
  storyboardProjectPlanInput,
  onDirectorFeedbackConfirmed,
  onPendingAgentActionChange,
  onReferencePlanningFocusChange,
  onEditingPendingConfirmationChange,
  onCurrentTaskProjectionChange,
}: {
  runtimeState: ProjectRuntimeState;
  projectFactHash?: string;
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
  onClearPrototypeAgentPlan?: () => void | Promise<void>;
  onRefreshRestoredAgentStagedPlanDraft?: (draft: ProjectAgentStagedPlanDraft) => void | Promise<void>;
  realSampleAction?: {
    keyConfigured: boolean;
    status: "idle" | "running" | "blocked" | "needs_review" | "verified";
    message?: string;
    disabled?: boolean;
    reviewableOutput?: boolean;
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
    returnedCount?: number;
    reviewCount?: number;
  };
  webSearchSettings?: AgentWebSearchSettings;
  webSearchReady?: boolean;
  projectReferenceGuide?: KnowledgePackManifest;
  restoredAgentStagedPlanDraft?: ProjectAgentStagedPlanDraft;
  restoredAgentActionLog?: ProjectAgentActionLogItem[];
  restoredAgentTimelineEntries?: VibeAgentTimelineEntry[];
  restoredAgentGenerationJobLedger?: AgentVideoGenerationJobLedger;
  restoredAgentReviewSelectionLedger?: AgentDirectorReviewSelectionLedger;
  reviewReceipts?: ProjectVibeReviewReceipt[];
  onRememberAgentTimelineEntries?: (entries: VibeAgentTimelineEntry[]) => void | Promise<void>;
  onRememberAgentGenerationJobLedger?: (ledger: AgentVideoGenerationJobLedger) => void | Promise<void>;
  onRememberAgentReviewSelectionLedger?: (ledger: AgentDirectorReviewSelectionLedger) => void | Promise<void>;
  onPromoteAgentReviewSelection?: (input: {
    pair: AgentDirectorReviewVersionPair;
    ledger: AgentDirectorReviewSelectionLedger;
    promotionConfirmationId: string;
  }) => unknown | Promise<unknown>;
  onSaveResearchAsReference?: (input: {
    result: AgentWebSearchResult;
    userIntent: string;
  }) => KnowledgePack | Promise<KnowledgePack>;
  onRememberAgentActionLogItem?: (item: ProjectAgentActionLogItem) => void | Promise<void>;
  onCreateLocalProject?: () => unknown | Promise<unknown>;
  onStartNewVideoDraftFromAgent?: (userIntent: string) => unknown | Promise<unknown>;
  onContinueNewVideoDraftFromAgent?: () => unknown | Promise<unknown>;
  onConfirmNewVideoDraftFromAgent?: () => unknown | Promise<unknown>;
  newVideoResetKey?: number;
  newVideoDraftPendingForAgent?: boolean;
  newVideoDraftPlanningForAgent?: boolean;
  newVideoDraftReadyForAgent?: boolean;
  newVideoDraftShotCountForAgent?: number;
  newVideoAgentSelectionContext?: {
    title: string;
    hint: string;
    chips: Array<{ label: string; value: string }>;
  };
  onCreateP6RealSample?: (target?: AgentControlledToolInvocationTarget) => unknown | Promise<unknown>;
  onCreateImage2EndFrame?: (target?: Pick<AgentControlledToolInvocationTarget, "skipConfirm" | "confirmationReceiptId" | "confirmedAt" | "signal">) => unknown | Promise<unknown>;
  onSendSeedanceVideo?: (target?: AgentControlledToolInvocationTarget) => unknown | Promise<unknown>;
  onRunExport?: (target?: Pick<AgentControlledToolInvocationTarget, "agentToolTrace" | "signal" | "exportExecutionReceipt">) => unknown | Promise<unknown>;
  onOpenResultView?: (view: DirectorView) => void;
  onRetryMissingBatch?: (target?: Pick<AgentControlledToolInvocationTarget, "signal">) => unknown | Promise<unknown>;
  reviewTarget?: CreatorReviewTrayItem;
  reviewVersionPair?: AgentDirectorReviewVersionPair;
  activeReviewVersion?: AgentDirectorReviewVersion;
  onActiveReviewVersionChange?: (version: AgentDirectorReviewVersion) => void;
  onApproveReviewItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onSelectShot?: (id: string, additive?: boolean) => void;
  agentCommand?: CreatorAgentCommand;
  projectObservation?: ProjectObservationProjection;
  projectStatusView?: ProjectStatusViewModel;
  exportAction?: ExportActionState;
  exportWorker?: ExportWorkerState;
  videoPermissionContract?: AgentVideoPermissionContract;
  onVideoPermissionContractChange?: (contract: AgentVideoPermissionContract) => void;
  storyboardProjectPlanInput?: StoryboardReferenceProjectPlannerInput;
  onDirectorFeedbackConfirmed?: (recompile: DirectorFeedbackRecompileResult) => void | Promise<void>;
  onPendingAgentActionChange?: (pending: boolean) => void;
  onReferencePlanningFocusChange?: (active: boolean) => void;
  onEditingPendingConfirmationChange?: (active: boolean) => void;
  onCurrentTaskProjectionChange?: (projection: AgentCurrentTaskProjection | undefined) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const liveComposerValueRef = useRef("");
  const lastVisibleComposerInputRef = useRef("");
  const skillSaveMouseDownHandledRef = useRef(false);
  const sendPointerHandledRef = useRef(false);
  const confirmationPointerHandledRef = useRef(false);
  const agentThreadRef = useRef<HTMLElement>(null);
  const previousSelectionFocusKeyRef = useRef("");
  const previousRuntimeProjectKeyRef = useRef("");
  const restoredAgentDraftIdRef = useRef("");
  const restoredAgentLogKeyRef = useRef("");
  const restoredAgentTimelineKeyRef = useRef("");
  const committedNewVideoDraftResetKeyRef = useRef("");
  const resumeAgentAfterLocalProjectSetupRef = useRef(false);
  const savedSkillStackProjectKeyRef = useRef("");
  const newVideoResetKeyRef = useRef(newVideoResetKey);
  const [text, setText] = useState("");
  const [composerEditingConfirmationLabel, setComposerEditingConfirmationLabel] = useState("");
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
  const [reviewDecisionStatus, setReviewDecisionStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [reviewHistoryOpen, setReviewHistoryOpen] = useState(false);
  const [clarificationResolvingId, setClarificationResolvingId] = useState("");
  const [isPreparingPlan, setIsPreparingPlan] = useState(false);
  const [isRetryingTool, setIsRetryingTool] = useState(false);
  const [isComposerCollapsed, setIsComposerCollapsed] = useState(false);
  const [localProjectSetupNotice, setLocalProjectSetupNotice] = useState<MinimalAgentMessage | undefined>();
  const [preparedContext, setPreparedContext] = useState<PreparedComposerContext | undefined>();
  const [agentActionEnvelope, setAgentActionEnvelope] = useState<DirectorAgentActionEnvelope | undefined>();
  const [agentToolHandoff, setAgentToolHandoff] = useState<DirectorAgentToolHandoff | undefined>();
  const [agentTimelineEntries, setAgentTimelineEntries] = useState<VibeAgentTimelineEntry[]>([]);
  const [activeComposerTurnIntent, setActiveComposerTurnIntent] = useState("");
  const [latestAgentKernelTurn, setLatestAgentKernelTurn] = useState<VibeAgentKernelTurn | undefined>();
  const [agentActionLog, setAgentActionLog] = useState<AgentActionLogItem[]>([]);
  const [savedSkillStack, setSavedSkillStack] = useState<DirectorSkillStackItem[]>([]);
  const [savedSkillDefinitions, setSavedSkillDefinitions] = useState<DirectorSkillDefinition[]>([]);
  const [savedSkillRecipes, setSavedSkillRecipes] = useState<DirectorSkillRecipe[]>([]);
  const agentGenerationProjectIdentity: AgentVideoExecutionProjectIdentity = {
    projectId: runtimeState.sourceIndex.projectId,
    projectRoot: localProjectReady && runtimeProjectRootIsLocalFolder(runtimeState.project.root)
      ? runtimeState.project.root
      : undefined,
    projectFactHash,
  };
  const reviewSelectionProjectIdentity = {
    projectId: agentGenerationProjectIdentity.projectId,
    projectRoot: agentGenerationProjectIdentity.projectRoot || "",
    projectFactHash: agentGenerationProjectIdentity.projectFactHash || "",
  };
  const agentGenerationProjectIdentityRef = useRef(agentGenerationProjectIdentity);
  agentGenerationProjectIdentityRef.current = agentGenerationProjectIdentity;
  const [agentVideoDryRunLedger, setAgentVideoDryRunLedger] = useState<AgentVideoGenerationJobLedger>(() => createAgentVideoGenerationJobLedger({
    ledgerId: "minimal_agent_video_dry_run",
    ...agentGenerationProjectIdentity,
    createdAt: "1970-01-01T00:00:00.000Z",
  }));
  const [agentReviewSelectionLedger, setAgentReviewSelectionLedger] = useState<AgentDirectorReviewSelectionLedger>(() => (
    restoredAgentReviewSelectionLedger
    && agentDirectorReviewSelectionLedgerMatchesProject(restoredAgentReviewSelectionLedger, reviewSelectionProjectIdentity)
      ? restoredAgentReviewSelectionLedger
      : createAgentDirectorReviewSelectionLedger({
          ...reviewSelectionProjectIdentity,
          createdAt: "1970-01-01T00:00:00.000Z",
        })
  ));
  const agentVideoExecutionLedgerRef = useRef(agentVideoDryRunLedger);
  const agentVideoExecutionRuntimeRef = useRef({
    onRememberAgentGenerationJobLedger,
    rememberAgentTimelineEntries,
    setStatus,
  });
  agentVideoExecutionRuntimeRef.current = {
    onRememberAgentGenerationJobLedger,
    rememberAgentTimelineEntries,
    setStatus,
  };
  const agentVideoExecutionControllerRef = useRef<AgentVideoExecutionController | undefined>(undefined);
  if (!agentVideoExecutionControllerRef.current) {
    agentVideoExecutionControllerRef.current = createAgentVideoExecutionController({
      getProjectIdentity: () => agentGenerationProjectIdentityRef.current,
      setProjectIdentity: (identity) => {
        agentGenerationProjectIdentityRef.current = identity;
      },
      getLedger: () => agentVideoExecutionLedgerRef.current,
      setLedger: (ledger) => {
        agentVideoExecutionLedgerRef.current = ledger;
        setAgentVideoDryRunLedger(ledger);
      },
      canPersistLedger: () => Boolean(agentVideoExecutionRuntimeRef.current.onRememberAgentGenerationJobLedger),
      persistLedger: (ledger) => agentVideoExecutionRuntimeRef.current.onRememberAgentGenerationJobLedger?.(ledger),
      publishTimeline: (entries, identity) => agentVideoExecutionRuntimeRef.current.rememberAgentTimelineEntries(entries, identity),
      setStatus: (nextStatus) => agentVideoExecutionRuntimeRef.current.setStatus(nextStatus),
    });
  }
  const agentVideoExecutionController = agentVideoExecutionControllerRef.current;

  useEffect(() => {
    setAgentVideoDryRunLedger((current) => {
      if (agentVideoExecutionLedgerMatchesProject(restoredAgentGenerationJobLedger, agentGenerationProjectIdentity)) {
        const restored = current.ledgerId === restoredAgentGenerationJobLedger!.ledgerId
          && current.updatedAt === restoredAgentGenerationJobLedger!.updatedAt
          ? current
          : restoredAgentGenerationJobLedger!;
        agentVideoExecutionLedgerRef.current = restored;
        return restored;
      }
      if (agentVideoExecutionLedgerMatchesProject(current, agentGenerationProjectIdentity)) {
        agentVideoExecutionLedgerRef.current = current;
        return current;
      }
      const created = createAgentVideoGenerationJobLedger({
        ledgerId: "minimal_agent_video_dry_run",
        ...agentGenerationProjectIdentity,
        createdAt: new Date().toISOString(),
      });
      agentVideoExecutionLedgerRef.current = created;
      return created;
    });
  }, [
    agentGenerationProjectIdentity.projectFactHash,
    agentGenerationProjectIdentity.projectId,
    agentGenerationProjectIdentity.projectRoot,
    restoredAgentGenerationJobLedger,
  ]);

  useEffect(() => {
    setAgentReviewSelectionLedger((current) => {
      if (
        restoredAgentReviewSelectionLedger
        && agentDirectorReviewSelectionLedgerMatchesProject(restoredAgentReviewSelectionLedger, reviewSelectionProjectIdentity)
      ) return restoredAgentReviewSelectionLedger;
      if (agentDirectorReviewSelectionLedgerMatchesProject(current, reviewSelectionProjectIdentity)) return current;
      return createAgentDirectorReviewSelectionLedger({
        ...reviewSelectionProjectIdentity,
        createdAt: new Date().toISOString(),
      });
    });
  }, [
    restoredAgentReviewSelectionLedger,
    reviewSelectionProjectIdentity.projectFactHash,
    reviewSelectionProjectIdentity.projectId,
    reviewSelectionProjectIdentity.projectRoot,
  ]);

  const activeReviewVersionCandidate = reviewVersionPair
    ? agentDirectorReviewVersionPairCandidate(reviewVersionPair, activeReviewVersion)
    : undefined;
  const reviewSelectionProjection = useMemo(() => buildAgentDirectorReviewSelectionProjection({
    ledger: agentReviewSelectionLedger,
    pair: reviewVersionPair,
  }), [agentReviewSelectionLedger, reviewVersionPair]);
  const recoveredVideoReviewJob = useMemo(
    () => activeReviewVersionCandidate
      ? agentVideoDryRunLedger.jobs.find((job) => job.jobId === activeReviewVersionCandidate.identity.jobId)
      : selectLatestAgentVideoGenerationReviewJob(agentVideoDryRunLedger, agentGenerationProjectIdentity),
    [
      activeReviewVersionCandidate?.identity.jobId,
      agentGenerationProjectIdentity.projectFactHash,
      agentGenerationProjectIdentity.projectId,
      agentGenerationProjectIdentity.projectRoot,
      agentVideoDryRunLedger,
    ],
  );
  const recoveredVideoReviewApproved = useMemo(
    () => Boolean(
      !reviewVersionPair
      &&
      recoveredVideoReviewJob?.reviewResult
      && reviewReceipts?.some((receipt) => agentDirectorApprovedReviewReceiptMatchesIdentity(
        receipt,
        recoveredVideoReviewJob.reviewResult!,
      )),
    ),
    [recoveredVideoReviewJob, reviewReceipts, reviewVersionPair],
  );
  const recoveredVideoReviewTarget = useMemo(
    () => recoveredVideoReviewApproved ? undefined : minimalAgentReviewTargetFromGenerationJob(recoveredVideoReviewJob),
    [recoveredVideoReviewApproved, recoveredVideoReviewJob],
  );
  const visibleReviewTarget = recoveredVideoReviewApproved
    && minimalAgentReviewTargetsMatch(reviewTarget, minimalAgentReviewTargetFromGenerationJob(recoveredVideoReviewJob))
    ? undefined
    : reviewTarget;
  const effectiveReviewTarget = recoveredVideoReviewTarget
    ? visibleReviewTarget && minimalAgentReviewTargetsMatch(visibleReviewTarget, recoveredVideoReviewTarget)
      ? { ...recoveredVideoReviewTarget, label: visibleReviewTarget.label, detail: visibleReviewTarget.detail }
      : visibleReviewTarget || recoveredVideoReviewTarget
    : visibleReviewTarget;
  const effectiveReviewIdentity: AgentDirectorReviewIdentity | undefined = effectiveReviewTarget
    && effectiveReviewTarget.jobId
    && effectiveReviewTarget.actionId
    && effectiveReviewTarget.projectFactHash
    && effectiveReviewTarget.shotId
    && effectiveReviewTarget.sourceReceiptId
    && effectiveReviewTarget.mediaPath
    && effectiveReviewTarget.outputHash
    && agentGenerationProjectIdentity.projectId
    && agentGenerationProjectIdentity.projectRoot
    ? {
        projectId: agentGenerationProjectIdentity.projectId,
        projectRoot: agentGenerationProjectIdentity.projectRoot,
        projectFactHash: effectiveReviewTarget.projectFactHash,
        jobId: effectiveReviewTarget.jobId,
        actionId: effectiveReviewTarget.actionId,
        shotId: effectiveReviewTarget.shotId,
        sourceReceiptId: effectiveReviewTarget.sourceReceiptId,
        outputPath: effectiveReviewTarget.mediaPath,
        outputHash: effectiveReviewTarget.outputHash,
      }
    : undefined;

  useEffect(() => {
    if (newVideoResetKeyRef.current === newVideoResetKey) return;
    newVideoResetKeyRef.current = newVideoResetKey;
    liveComposerValueRef.current = "";
    lastVisibleComposerInputRef.current = "";
    setText("");
    setAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setStatus("等待输入");
    setWorkflow(undefined);
    setProjection(undefined);
    setFeedbackRecompile(undefined);
    setPreparedContext(undefined);
    setAgentActionEnvelope(undefined);
    setAgentToolHandoff(undefined);
    setPlanPhase("idle");
    setLocalPrototypeAgentDemo(undefined);
    setIsPreparingPlan(false);
    setIsRetryingTool(false);
    setResearchResult(undefined);
    setResearchStatus("idle");
    setReferenceStatus("idle");
    setIsComposerCollapsed(false);
    setLocalProjectSetupNotice(undefined);
    setAgentTimelineEntries([]);
    setActiveComposerTurnIntent("");
    setLatestAgentKernelTurn(undefined);
    setAgentActionLog([]);
    const resetGenerationLedger = createAgentVideoGenerationJobLedger({
      ledgerId: "minimal_agent_video_dry_run",
      ...agentGenerationProjectIdentity,
      createdAt: "1970-01-01T00:00:00.000Z",
    });
    agentVideoExecutionLedgerRef.current = resetGenerationLedger;
    setAgentVideoDryRunLedger(resetGenerationLedger);
    restoredAgentDraftIdRef.current = "";
    restoredAgentLogKeyRef.current = "";
    restoredAgentTimelineKeyRef.current = "";
    onPendingAgentActionChange?.(false);
    onReferencePlanningFocusChange?.(false);
    onEditingPendingConfirmationChange?.(false);
    onCurrentTaskProjectionChange?.(undefined);
    setComposerEditingConfirmationLabel("");
  }, [
    newVideoResetKey,
    onCurrentTaskProjectionChange,
    onEditingPendingConfirmationChange,
    onPendingAgentActionChange,
    onReferencePlanningFocusChange,
  ]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const value = textareaRef.current?.value.trim();
      if (value) {
        liveComposerValueRef.current = value;
        lastVisibleComposerInputRef.current = value;
        if (value !== text.trim() || workflow) updateText(value);
      }
    }, 120);
    return () => window.clearInterval(intervalId);
  }, [text, workflow]);
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
  const timelineReferenceGenerationActionId = latestWaitingReferenceGenerationConfirmationActionId(agentTimelineEntries);
  const restoredReferenceGenerationActionId = restoredAgentStagedPlanDraft?.status === "active"
    && restoredAgentStagedPlanDraft.action?.kind === "prepare_reference_generation"
    ? restoredAgentStagedPlanDraft.action.actionId
    : timelineReferenceGenerationActionId;
  const activeDirectorReviewRegenerationConfirmation = useMemo(
    () => activeAgentDirectorReviewRegenerationConfirmationFromTimeline(agentTimelineEntries, effectiveReviewIdentity),
    [
      agentTimelineEntries,
      effectiveReviewIdentity?.actionId,
      effectiveReviewIdentity?.jobId,
      effectiveReviewIdentity?.outputHash,
      effectiveReviewIdentity?.projectFactHash,
      effectiveReviewIdentity?.projectId,
      effectiveReviewIdentity?.projectRoot,
      effectiveReviewIdentity?.shotId,
      effectiveReviewIdentity?.sourceReceiptId,
    ],
  );
  const visibleAgentTimelineEntries = useMemo(() => {
    if (activeDirectorReviewRegenerationConfirmation) return agentTimelineEntries;
    const restoredPendingAgentIntent = restoredAgentStagedPlanDraft?.status === "active"
      ? restoredAgentStagedPlanDraft.userIntent?.trim() || ""
      : "";
    const activeConfirmationIntent = latestWaitingConfirmationUserIntent(agentTimelineEntries, restoredReferenceGenerationActionId);
    const currentUserIntent = text.trim()
      || restoredPendingAgentIntent
      || activeConfirmationIntent
      || liveComposerValueRef.current.trim()
      || lastVisibleComposerInputRef.current.trim()
      || preparedContext?.userIntent?.trim()
      || activeComposerTurnIntent.trim();
    if (activeConfirmationIntent && currentUserIntent === activeConfirmationIntent) {
      return agentTimelineEntriesForLatestWaitingConfirmation(agentTimelineEntries, restoredReferenceGenerationActionId) || [];
    }
    if (!currentUserIntent) return agentTimelineEntries;
    return agentTimelineEntriesForCurrentUserIntent(agentTimelineEntries, currentUserIntent) || [];
  }, [activeComposerTurnIntent, activeDirectorReviewRegenerationConfirmation, agentTimelineEntries, preparedContext?.userIntent, restoredAgentStagedPlanDraft?.status, restoredAgentStagedPlanDraft?.userIntent, restoredReferenceGenerationActionId, text]);
  const activeDirectorClarificationTurn = useMemo(
    () => activeAgentDirectorClarificationFromTimeline(agentTimelineEntries),
    [agentTimelineEntries],
  );
  const activeDirectorReviewRevisionIntent = useMemo(
    () => activeAgentDirectorReviewRevisionIntentFromTimeline(agentTimelineEntries, effectiveReviewIdentity),
    [
      agentTimelineEntries,
      effectiveReviewIdentity?.actionId,
      effectiveReviewIdentity?.jobId,
      effectiveReviewIdentity?.outputHash,
      effectiveReviewIdentity?.projectFactHash,
      effectiveReviewIdentity?.projectId,
      effectiveReviewIdentity?.projectRoot,
      effectiveReviewIdentity?.shotId,
      effectiveReviewIdentity?.sourceReceiptId,
    ],
  );
  const activeDirectorReviewRegenerationProposal = useMemo(
    () => activeAgentDirectorReviewRegenerationProposalFromTimeline(agentTimelineEntries, effectiveReviewIdentity),
    [
      agentTimelineEntries,
      effectiveReviewIdentity?.actionId,
      effectiveReviewIdentity?.jobId,
      effectiveReviewIdentity?.outputHash,
      effectiveReviewIdentity?.projectFactHash,
      effectiveReviewIdentity?.projectId,
      effectiveReviewIdentity?.projectRoot,
      effectiveReviewIdentity?.shotId,
      effectiveReviewIdentity?.sourceReceiptId,
    ],
  );
  const referencePlanningFocusEntry = localReferencePlanningFocusEntry(visibleAgentTimelineEntries)
    || localReferencePlanningFocusEntry(agentTimelineEntries);
  const referencePlanningIntentText = text.trim()
    || liveComposerValueRef.current.trim()
    || lastVisibleComposerInputRef.current.trim();
  const storyShotCountRevisionIntentCount = requestedStoryboardShotCountFromIntent(referencePlanningIntentText);
  const storyShotCountRevisionIntentActive = Boolean(
    !attachments.length
      && storyShotCountRevisionIntentCount,
  );
  const referencePlanningGenerationIntentActive = Boolean(
    referencePlanningFocusEntry
    && !attachments.length
    && referencePlanningGenerationRequestText(referencePlanningIntentText),
  );
  const savedStoryReferencePlanStatusActive = Boolean(
    localProjectReady
      && runtimeProjectRootIsLocalFolder(runtimeState.project.root)
      && runtimeState.storyFlow.shots.length > 0
      && (
        runtimeState.visualMemory.summary.missing > 0
        || projectObservation?.references.status === "missing"
      ),
  );
  const referencePlanningContinueIntentActive = Boolean(
    !attachments.length
      && isContinueIntent(referencePlanningIntentText)
      && (referencePlanningFocusEntry || savedStoryReferencePlanStatusActive),
  );
  const referencePlanningFocusActive = Boolean(referencePlanningFocusEntry && !text.trim() && !attachments.length);
  const savedStoryIdleReferenceFocusActive = Boolean(
    referencePlanningFocusActive
      && savedStoryReferencePlanStatusActive
      && !text.trim()
      && !attachments.length,
  );
  const referencePlanningContextActive = referencePlanningFocusActive || referencePlanningGenerationIntentActive || referencePlanningContinueIntentActive;
  const referencePlanningFocusChips = referencePlanningContextActive
    ? localReferencePlanningFocusChips(referencePlanningFocusEntry)
    : [];
  const storyReferenceDeferredFocusActive = Boolean(
    !referencePlanningContextActive
      && savedStoryReferencePlanStatusActive
      && !text.trim()
      && !attachments.length,
  );
  const storyReferencePlanOnlyIntentActive = Boolean(
    !referencePlanningContextActive
      && !storyReferenceDeferredFocusActive
      && !attachments.length
      && !storyShotCountRevisionIntentActive
      && referencePlanningPreparationRequestText(referencePlanningIntentText)
      && !referencePlanningGenerationRequestText(referencePlanningIntentText)
  );
  const storyReferencePlanningIntentActive = Boolean(
    !referencePlanningContextActive
      && !storyReferenceDeferredFocusActive
      && (savedStoryReferencePlanStatusActive || storyReferencePlanOnlyIntentActive)
      && !attachments.length
      && !storyShotCountRevisionIntentActive
      && referencePlanningPreparationRequestText(referencePlanningIntentText),
  );
  const composerExecutionTimelineEntries = mergeVibeAgentTimelineEntries(
    mergeVibeAgentTimelineEntries(visibleAgentTimelineEntries, agentTimelineEntries),
    restoredAgentTimelineEntries || [],
  );
  const composerTimelineShowsReferenceReady = agentTimelineHasSucceededLiveExecution(
    composerExecutionTimelineEntries,
    "prepare_references",
    agentGenerationProjectIdentity,
  );
  const composerTimelineHasReferenceValidation = agentTimelineHasValidatedExecution(
    composerExecutionTimelineEntries,
    "prepare_references",
    agentGenerationProjectIdentity,
  );
  const storyHasMissingReferencesForComposer = Boolean(
    (
      runtimeState.visualMemory.summary.missing > 0
      || projectObservation?.references.status === "missing"
    )
      && !composerTimelineShowsReferenceReady
      && !composerTimelineHasReferenceValidation,
  );
  const composerVideoIntentShouldConfirmReferencesFirst = Boolean(
    referencePlanningIntentText
      && !attachments.length
      && runtimeState.storyFlow.shots.length > 0
      && storyHasMissingReferencesForComposer
      && intentRequestsVideoSubmitWork(referencePlanningIntentText),
  );
  const baseStoryLevelReferenceContextActive = referencePlanningContextActive
    || storyReferenceDeferredFocusActive
    || storyReferencePlanningIntentActive
    || composerVideoIntentShouldConfirmReferencesFirst;
  const storyReferenceDeferredChips = storyReferenceDeferredFocusActive
    ? [
        { label: "范围", value: "当前故事" },
        { label: "参考", value: projectObservation?.references.label || "参考不完整" },
        { label: "保护", value: "不生成参考、不提交视频" },
      ]
    : [];
  const storyReferencePlanningIntentChips = storyReferencePlanningIntentActive
    ? [
        { label: "范围", value: "当前故事" },
        { label: "参考", value: projectObservation?.references.label || "参考不完整" },
        { label: "保护", value: "只准备计划，不生成图片" },
      ]
    : [];
  const composerVideoReferencePreflightChips = composerVideoIntentShouldConfirmReferencesFirst
    ? [
        { label: "范围", value: "当前故事" },
        { label: "参考", value: projectObservation?.references.label || "参考不完整" },
        { label: "下一步", value: "先补参考" },
      ]
    : [];
  const pendingTimelineConfirmationMessageForContext = latestVisibleTimelineConfirmationMessage(visibleAgentTimelineEntries, false, restoredReferenceGenerationActionId);
  const pendingTimelineConfirmationStepForContext = pendingTimelineConfirmationMessageForContext
    ? agentCurrentTaskStepFromMessage(pendingTimelineConfirmationMessageForContext)
    : undefined;
  const localProjectSetupComposerIntentActive = Boolean(
    (!localProjectReady || !runtimeProjectRootIsLocalFolder(runtimeState.project.root))
      && text.trim()
      && !attachments.length
      && runtimeState.storyFlow.shots.length > 0
      && intentNeedsLocalProjectBeforeTooling(text),
  );
  const localProjectSetupConfirmationContextActive = pendingTimelineConfirmationStepForContext === "choose_save_location"
    || localProjectSetupComposerIntentActive
    || Boolean(
      localProjectBusy
        && !localProjectReady
        && !text.trim()
        && !attachments.length
        && runtimeState.storyFlow.shots.length > 0,
    )
    || Boolean(
      (!localProjectReady || !runtimeProjectRootIsLocalFolder(runtimeState.project.root))
        && !text.trim()
        && !attachments.length
        && runtimeState.storyFlow.shots.length > 0,
    );
  const localProjectSetupConfirmationChips = localProjectSetupConfirmationContextActive
    ? [
        { label: "范围", value: "当前故事" },
        { label: "会做", value: "选择保存位置" },
        { label: "保护", value: "不生成参考、不提交视频、不导出" },
      ]
    : [];
  const pendingSkillSaveConfirmationMessage = pendingTimelineConfirmationMessageForContext
    && minimalAgentMessageRequestsSkillSave(pendingTimelineConfirmationMessageForContext)
    ? pendingTimelineConfirmationMessageForContext
    : undefined;
  const pendingSkillSaveConfirmationContextActive = Boolean(pendingSkillSaveConfirmationMessage);
  const editingSkillSaveConfirmationActive = Boolean(text.trim() && !attachments.length && isSaveDirectorSkillIntent(text));
  const skillSaveContextActive = pendingSkillSaveConfirmationContextActive || editingSkillSaveConfirmationActive;
  const pendingSkillSaveActionLabel = pendingSkillSaveConfirmationMessage
    ? minimalAgentFactValue(pendingSkillSaveConfirmationMessage, ["动作"]) || "保存导演经验"
    : "";
  const pendingSkillSaveTargetLabel = pendingSkillSaveConfirmationMessage
    ? minimalAgentFactValue(pendingSkillSaveConfirmationMessage, ["保存到", "位置"]) || "项目 Skills"
    : "";
  const pendingSkillSaveConfirmationChips = pendingSkillSaveConfirmationContextActive
    ? [
        { label: "动作", value: pendingSkillSaveActionLabel || "保存导演经验" },
        { label: "保存到", value: pendingSkillSaveTargetLabel || "项目 Skills" },
        { label: "保护", value: "不生成参考、不提交视频" },
      ]
    : [];
  const editingSkillSaveConfirmationChips = editingSkillSaveConfirmationActive
    ? [
        { label: "动作", value: "保存导演经验" },
        { label: "保存到", value: "项目 Skills" },
        { label: "保护", value: "发送后先确认" },
      ]
    : [];
  const pendingReferenceGenerationConfirmationMessage = pendingTimelineConfirmationMessageForContext;
  const pendingReferenceGenerationConfirmationChips = pendingReferenceGenerationConfirmationMessage
    && agentCurrentTaskStepFromMessage(pendingReferenceGenerationConfirmationMessage) === "prepare_references"
    ? [
        { label: "范围", value: "当前故事" },
        { label: "参考", value: projectObservation?.references.label || "参考不完整" },
      ]
    : [];
  const pendingReferenceGenerationContextActive = Boolean(
    pendingReferenceGenerationConfirmationChips.length
      || (
        restoredAgentStagedPlanDraft?.status === "active"
        && restoredAgentStagedPlanDraft.action?.kind === "prepare_reference_generation"
      ),
  );
  const editingReferenceGenerationConfirmationActive = Boolean(
    text.trim()
      && !attachments.length
      && pendingReferenceGenerationConfirmationChips.length,
  );
  const editingReferenceGenerationConfirmationChips = editingReferenceGenerationConfirmationActive
    ? [
        { label: "范围", value: "当前故事" },
        { label: "修改", value: "正在修改确认" },
        { label: "保护", value: "发送前不生成参考图" },
      ]
    : [];
  const storyLevelReferenceContextActive = baseStoryLevelReferenceContextActive || pendingReferenceGenerationContextActive;
  const referencePlanningSurfaceFocusActive = Boolean(
    referencePlanningContextActive
      && !(
        text.trim()
        && !attachments.length
        && pendingReferenceGenerationConfirmationChips.length
      ),
  );
  const pendingStoryShotCountRevisionConfirmationCount = pendingTimelineConfirmationMessageForContext?.actionKind === "revise_story_or_shot"
    ? requestedStoryboardShotCountFromIntent([
        pendingTimelineConfirmationMessageForContext.title,
        pendingTimelineConfirmationMessageForContext.body,
        pendingTimelineConfirmationMessageForContext.next,
        ...(pendingTimelineConfirmationMessageForContext.facts || []).map((fact) => `${fact.label} ${fact.value}`),
      ].filter(Boolean).join(" "))
    : 0;
  const restoredStoryShotCountRevisionCount = restoredAgentStagedPlanDraft?.status === "active"
    && restoredAgentStagedPlanDraft.action?.kind === "revise_story_or_shot"
    ? requestedStoryboardShotCountFromIntent([
        restoredAgentStagedPlanDraft.userIntent,
        restoredAgentStagedPlanDraft.action.summary,
        restoredAgentStagedPlanDraft.action.userFacingMessage,
        ...restoredAgentStagedPlanDraft.action.proposedChanges.map((change) => `${change.field} ${change.from} ${change.to} ${change.reason}`),
      ].filter(Boolean).join(" "))
    : 0;
  const storyShotCountRevisionFocusCount = storyShotCountRevisionIntentCount
    || pendingStoryShotCountRevisionConfirmationCount
    || restoredStoryShotCountRevisionCount;
  const storyShotCountRevisionFocusActive = Boolean(
    !attachments.length
      && storyShotCountRevisionFocusCount,
  );
  useEffect(() => {
    onReferencePlanningFocusChange?.(referencePlanningSurfaceFocusActive);
    return () => onReferencePlanningFocusChange?.(false);
  }, [onReferencePlanningFocusChange, referencePlanningSurfaceFocusActive]);
  const currentSelectedShotId = scopedShotIds.length === 1 ? scopedShotIds[0] : shot?.id;
  const emptyNewVideoEntryContextActive = Boolean(
    projectStatusView?.stage === "准备开始"
      && projectStatusView.doing === "AI 会先整理故事和镜头"
      && projectStatusView.nextAction === "发送后整理故事和镜头",
  );
  const selectionHint = hasMultiShotSelection
    ? `已选中 ${localScopeLabel}。直接说这些镜头哪里不顺。`
    : shot
      ? `已选中 ${localScopeLabel}。直接说这一段怎么改。`
      : asset
        ? `已选中 ${localScopeLabel}。直接说这个素材怎么改。`
        : hasSectionSelection
          ? `已选中 ${localScopeLabel}。直接说这一段故事怎么改。`
          : emptyNewVideoEntryContextActive
          ? "先整理故事和镜头；草案出来后可点镜头修改。"
          : "写脚本、提需求，或点一段再说修改。";
  const newVideoDraftBusyForAgent = newVideoDraftPendingForAgent || newVideoDraftPlanningForAgent;
  const composerPermissionControlInputActive = Boolean(
    text.trim()
      && !attachments.length
      && isDirectorAgentPermissionControlOnlyIntent(text.trim())
      && detectAgentVideoPermissionContract(text.trim(), localVideoPermissionContract),
  );
  const pendingDraftScopeActive = Boolean(newVideoDraftShotCountForAgent || newVideoDraftBusyForAgent);
  const pendingDraftScopeLabel = composerPermissionControlInputActive
    ? "更新工作方式"
    : text.trim() || attachments.length
    ? "正在修改草案"
    : newVideoDraftBusyForAgent
      ? "正在整理草案"
      : "当前故事";
  const newStoryComposerScopeActive = Boolean(
    text.trim()
      && !attachments.length
      && runtimeState.storyFlow.shots.length === 0
      && !newVideoDraftShotCountForAgent
      && !newVideoDraftBusyForAgent
      && !hasActiveSelection
      && !pendingReferenceGenerationContextActive
      && directorIntentCanStartNewVideoPlanningWithoutProject(text),
  );
  const storyShotCountRevisionPlaceholderActive = Boolean(
    !newStoryComposerScopeActive
      && (
        pendingStoryShotCountRevisionConfirmationCount
        || Boolean(restoredAgentStagedPlanDraft?.status === "active" && restoredAgentStagedPlanDraft.action?.kind === "revise_story_or_shot")
      ),
  );
  const baseDisplayedScopeLabel = composerPermissionControlInputActive
    ? "更新工作方式"
    : localProjectSetupConfirmationContextActive
    ? "当前故事"
    : skillSaveContextActive
    ? pendingSkillSaveTargetLabel || "项目 Skills"
    : pendingDraftScopeActive
    ? pendingDraftScopeLabel
    : newStoryComposerScopeActive
    ? "新视频草案"
    : storyShotCountRevisionFocusActive
    ? "当前故事"
    : storyLevelReferenceContextActive
    ? "当前故事"
    : emptyNewVideoEntryContextActive
    ? "新视频入口"
    : workflow ? preparedContext?.scopeLabel || scopeLabel : scopeLabel;
  const baseDisplayedSelectionHint = effectiveReviewTarget?.status === "needs_review"
    ? `${effectiveReviewTarget.label} 已返回；当前只做预览复核，不会自动重试、晋级或导出。`
    : composerPermissionControlInputActive
    ? "只更新工作方式；不改故事，不生成参考，也不提交视频。"
    : localProjectSetupConfirmationContextActive
    ? "故事已确认；先选择保存位置，之后再补参考或视频。"
    : skillSaveContextActive
      ? editingSkillSaveConfirmationActive
        ? "正在修改保存导演经验的请求；发送后只会先生成保存确认卡。"
        : `准备${pendingSkillSaveActionLabel || "保存导演经验"}；确认前不会写入${pendingSkillSaveTargetLabel || "项目 Skills"}，也不会生成参考或提交视频。`
    : newStoryComposerScopeActive
      ? "点发送后先形成草案；确认前不会生成参考或提交视频。"
    : storyShotCountRevisionFocusActive
      ? `会把当前故事重排为 ${storyShotCountRevisionFocusCount} 个镜头；确认前不生成参考或提交视频。`
    : editingReferenceGenerationConfirmationActive
      ? "正在修改「确认生成参考」；发送后会重新判断，确认前不会生成图片或提交视频。"
    : composerVideoIntentShouldConfirmReferencesFirst
      ? "发送视频前先补齐当前故事参考；发送后会先给出确认卡。"
    : pendingReferenceGenerationConfirmationChips.length
      ? "当前看整个故事；确认卡会说明生成范围和边界。"
    : referencePlanningContextActive
    ? "参考计划已准备；真正生成参考前会再确认。"
    : storyReferencePlanningIntentActive
      ? "我会先准备参考计划；不会生成图片，也不会提交视频。"
    : storyReferenceDeferredFocusActive
      ? "故事已保存；可以继续修改故事，或说“开始补参考”。"
    : workflow ? preparedContext?.selectionHint || selectionHint : selectionHint;
  const inputPlaceholder = effectiveReviewTarget?.status === "needs_review"
    ? `说明 ${effectiveReviewTarget.label} 的时机、动作或连续性问题...`
    : newStoryComposerScopeActive
    ? "继续说这个新视频怎么拍..."
    : storyShotCountRevisionPlaceholderActive
    ? "继续说这次重排怎么改..."
    : localProjectSetupConfirmationContextActive
    ? "继续改故事，或确认保存位置..."
    : skillSaveContextActive
    ? "继续改这条 Skill，或在上方确认保存..."
    : storyLevelReferenceContextActive
    ? savedStoryIdleReferenceFocusActive
      ? "继续修改故事，或说“开始补参考”..."
      : referencePlanningContextActive || storyReferencePlanningIntentActive
        ? "继续说参考怎么安排..."
        : "继续修改故事，或说“开始补参考”..."
    : hasActiveSelection
    ? "说这块怎么改..."
    : "写一句想法，或拖入脚本、图片、声音。";
  const liveSelectionChips = hasActiveSelection
    ? selectionContextChips({
        shot,
        selectedShots,
        asset,
        sectionLabel,
      })
    : [];
  const agentShotSwitcherItems = useMemo(() => {
    if (!onSelectShot) return [];
    return runtimeState.storyFlow.shots.slice(0, 12).map((item) => ({
      id: item.id,
      label: formatShotNumber(item.id),
      title: shortAgentPanelMessageText(
        cleanMinimalAgentMessageCopy(cleanStoryText(item.title) || cleanStoryText(item.primaryAction || "") || cleanStoryText(item.storyFunction || "")),
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
  const videoSubmissionBlocked = videoSendAction?.status === "blocked";
  const videoBlockedRecoveryIntent = videoSubmissionBlocked ? videoBlockerRecoveryIntent(videoSendAction?.message) : "";
  const videoBlockedRecoveryTargetShots = (videoSendAction?.recoveryTargetShotIds || [])
    .map((shotId) => runtimeState.storyFlow.shots.find((item) => item.id === shotId))
    .filter((item): item is ShotRecord => Boolean(item));
  const videoBlockedRecoveryScopedIntent = videoBlockedRecoveryIntent && videoBlockedRecoveryTargetShots.length === 1
    ? `镜头 ${formatShotNumber(videoBlockedRecoveryTargetShots[0].id)} ${videoBlockedRecoveryTargetShots[0].title}：${videoBlockedRecoveryIntent}`
    : videoBlockedRecoveryIntent;
  const videoCanResume = Boolean(videoSendAction?.canResume);
  const referenceLiveAdapterReady = Boolean(
    onCreateP6RealSample
      && realSampleAction?.keyConfigured
      && !realSampleAction.disabled
      && !realSampleBusy,
  );
  const videoLiveAdapterReady = Boolean(
    onSendSeedanceVideo
      && videoSendAction?.keyConfigured
      && videoSendAction.ready
      && !videoSendAction.disabled
      && !videoBusy,
  );
  const queryVideoLiveAdapterReady = Boolean(onSendSeedanceVideo && videoCanResume && !videoBusy);
  const exportLiveAdapterReady = Boolean(onRunExport);
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
    setStatus(latestPrototypeAgentDemo?.result?.label || "故事已确认");
  }, [attachments.length, latestNewVideoDraftCommittedForProjection, latestPrototypeAgentDemo?.result?.label, text]);
  useEffect(() => {
    let cancelled = false;
    function acceptSkillContractPair(
      item: DirectorSkillStackItem,
      definitionContent: string,
      recipeContent: string,
    ): { definition: DirectorSkillDefinition; recipe: DirectorSkillRecipe } | undefined {
      const definition = parseDirectorSkillDefinition(definitionContent);
      const recipe = parseDirectorSkillRecipe(recipeContent);
      if (!definition.ok || !definition.value || !recipe.ok || !recipe.value) return undefined;
      if (definition.value.id !== item.id
        || definition.value.version !== item.version
        || definition.value.contentHash !== item.contentHash
        || recipe.value.skillId !== definition.value.id
        || !definition.value.recipeIds.includes(recipe.value.id)) return undefined;
      return { definition: definition.value, recipe: recipe.value };
    }

    async function loadDesktopSkillContracts(
      items: DirectorSkillStackItem[],
      projectRoot: string,
      bridge: NonNullable<typeof window.vibeRuntime>,
    ) {
      const pairs = await Promise.all(items.map(async (item) => {
        if (item.enabled === false || !item.definitionPath || !item.recipePath || !item.contentHash) return undefined;
        try {
          const root = projectRoot.replace(/\/+$/g, "");
          const [definitionResult, recipeResult] = await Promise.all([
            bridge.sandboxReadFile(`${root}/${item.definitionPath}`),
            bridge.sandboxReadFile(`${root}/${item.recipePath}`),
          ]);
          return acceptSkillContractPair(item, definitionResult.content, recipeResult.content);
        } catch {
          return undefined;
        }
      }));
      return pairs.filter((pair): pair is { definition: DirectorSkillDefinition; recipe: DirectorSkillRecipe } => Boolean(pair));
    }

    async function loadSkillStack() {
      const projectRoot = runtimeState.project.root?.trim();
      const bridge = typeof window !== "undefined" ? window.vibeRuntime : undefined;
      let desktopIndexContent = "";
      if (runtimeProjectRootIsLocalFolder(projectRoot) && bridge?.sandboxReadFile) {
        try {
          const indexPath = `${projectRoot.replace(/\/+$/g, "")}/${DIRECTOR_SKILL_STACK_INDEX_PATH}`;
          const indexExists = bridge.sandboxFileExists
            ? (await bridge.sandboxFileExists(indexPath)).exists
            : true;
          if (indexExists) {
            const result = await bridge.sandboxReadFile(indexPath);
            desktopIndexContent = result.content;
          }
        } catch {
          // Missing skill-index.json is a normal state for a fresh project.
        }
      }
      if (desktopIndexContent) {
        const parsedIndexResult = parseDirectorSkillStackIndexWithStatus(desktopIndexContent);
        const parsedIndex = parsedIndexResult.index;
        const pairs = bridge && projectRoot
          ? await loadDesktopSkillContracts(parsedIndex.skills, projectRoot, bridge)
          : [];
        if (!cancelled && parsedIndexResult.ok) {
          savedSkillStackProjectKeyRef.current = runtimeProjectKey;
          setSavedSkillStack(parsedIndex.skills);
          setSavedSkillDefinitions(pairs.map((pair) => pair.definition));
          setSavedSkillRecipes(pairs.map((pair) => pair.recipe));
          return;
        }
      }
      if (typeof window !== "undefined" && window.localStorage) {
        const content = window.localStorage.getItem(browserSkillIndexStorageKey(runtimeProjectKey));
        if (!cancelled) {
          if (content) {
            savedSkillStackProjectKeyRef.current = runtimeProjectKey;
            const parsedIndex = parseDirectorSkillStackIndex(content);
            const pairs = parsedIndex.skills.map((item) => {
              if (item.enabled === false || !item.definitionPath || !item.recipePath || !item.contentHash) return undefined;
              const definitionContent = window.localStorage.getItem(browserSkillStorageKey(runtimeState.project.title, item.definitionPath));
              const recipeContent = window.localStorage.getItem(browserSkillStorageKey(runtimeState.project.title, item.recipePath));
              return definitionContent && recipeContent
                ? acceptSkillContractPair(item, definitionContent, recipeContent)
                : undefined;
            }).filter((pair): pair is { definition: DirectorSkillDefinition; recipe: DirectorSkillRecipe } => Boolean(pair));
            setSavedSkillStack(parsedIndex.skills);
            setSavedSkillDefinitions(pairs.map((pair) => pair.definition));
            setSavedSkillRecipes(pairs.map((pair) => pair.recipe));
          } else if (savedSkillStackProjectKeyRef.current !== runtimeProjectKey) {
            savedSkillStackProjectKeyRef.current = runtimeProjectKey;
            setSavedSkillStack([]);
            setSavedSkillDefinitions([]);
            setSavedSkillRecipes([]);
          }
        }
        return;
      }
      if (!cancelled && savedSkillStackProjectKeyRef.current !== runtimeProjectKey) {
        savedSkillStackProjectKeyRef.current = runtimeProjectKey;
        setSavedSkillStack([]);
        setSavedSkillDefinitions([]);
        setSavedSkillRecipes([]);
      }
    }
    void loadSkillStack();
    return () => {
      cancelled = true;
    };
  }, [runtimeProjectKey, runtimeState.project.root, runtimeState.project.title]);
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
  const runtimeProjectRootReadyForTools = runtimeProjectRootIsLocalFolder(runtimeState.project.root);
  const localProjectReadyForTools = Boolean(localProjectReady && runtimeProjectRootReadyForTools);
  const agentVisibleProjectReadyForTools = localProjectReadyForTools;
  const persistedStoryContextActive = Boolean(
    runtimeState.storyFlow.shots.length > 0
      || selectedShots.length > 0
      || shot
      || projectObservation?.story.status === "selected",
  );
  const currentProjectHasStoryContext = Boolean(
    pendingReferenceGenerationContextActive
      || persistedStoryContextActive,
  );
  const agentCommandKind = agentCommand?.kind;
  const readyNewVideoDraftForAgent = Boolean(
    runtimeState.storyFlow.shots.length === 0
      && !newVideoDraftBusyForAgent
      && newVideoDraftReadyForAgent,
  );
  const activeNewVideoDraftConfirmation = readyNewVideoDraftForAgent;
  const agentReadinessTimelineEntries = mergeVibeAgentTimelineEntries(
    mergeVibeAgentTimelineEntries(visibleAgentTimelineEntries, agentTimelineEntries),
    restoredAgentTimelineEntries || [],
  );
  const timelineShowsExportReady = agentTimelineHasSucceededLiveExecution(
    agentReadinessTimelineEntries,
    "export",
    agentGenerationProjectIdentity,
  );
  const exportActionStopsConfirmation = Boolean(
    exportAction
      && exportAction.status !== "idle",
  ) || timelineShowsExportReady;
  const exportReadyForConfirmation = Boolean(
    currentView === "export"
      && !exportActionStopsConfirmation
      && exportWorkerReadyForAgentConfirmation(exportWorker),
  );
  const exportResultIsPrimary = Boolean(
    currentView === "export"
      && (
        exportAction?.status === "running"
        || exportAction?.status === "ready"
        || timelineShowsExportReady
        || exportReadyForConfirmation
      ),
  );
  const videoQueryMode = videoCanResume
    || agentCommandKind === "resume_video";
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
  const selectedSavedSkillDefinition = selectedSkillCard
    ? savedSkillDefinitions.find((definition) => definition.id === selectedSkillCard.id)
    : undefined;
  const selectedSkillDraftFile = selectedSkillCard ? directorSkillFileName(selectedSkillCard) : "";
  const restoredPendingSkillSaveRequest = useMemo(() => {
    if (!selectedSkillCard || !selectedSkillDraftFile) return undefined;
    const confirmationIndex = agentTimelineEntries.map((entry) => (
      entry.type === "confirmation_request"
      && entry.toolName === "save_skill"
      && (entry.status === "waiting" || entry.lifecycle === "waiting_for_confirmation")
    )).lastIndexOf(true);
    if (confirmationIndex < 0) return undefined;
    let userIntent = "把当前做法保存为 Skill";
    for (let index = confirmationIndex - 1; index >= 0; index -= 1) {
      if (agentTimelineEntries[index].type === "user_message" && agentTimelineEntries[index].body.trim()) {
        userIntent = agentTimelineEntries[index].body.trim();
        break;
      }
    }
    return {
      userIntent,
      card: selectedSkillCard,
      fileName: selectedSkillDraftFile,
    };
  }, [agentTimelineEntries, selectedSkillCard, selectedSkillDraftFile]);
  const activePendingSkillSaveRequest = pendingSkillSaveRequest || restoredPendingSkillSaveRequest;
  const selectedSkillSavedInTimeline = Boolean(selectedSkillCard && selectedSkillDraftFile && agentTimelineEntries.some((entry) => (
    /导演经验已(?:保存|暂存)/.test(entry.title)
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
  const selectedSkillOneLine = selectedSavedSkillDefinition?.summary || selectedSkillCard?.summary || selectedSkillSummary?.detail || "按当前镜头选择合适的导演方法。";
  const selectedSkillImpactLabel = selectedSkillCard?.appliesTo?.length
    ? selectedSkillCard.appliesTo.join(" / ")
    : "故事规划 / Seedance prompt / QA";
  const selectedSkillReasonLabel = selectedSkillSummary?.reason.replace(/[。！？!?.]+$/u, "");
  const agentRecommendedSkillCopy = selectedSkillSummary
    ? `${selectedSkillSummary.label}：${recommendedSkillLabel}。原因：${selectedSkillReasonLabel}。影响 ${selectedSkillImpactLabel}`
    : "先点一个镜头，我会解释适合的做法。";
  const storyboardProjectPlanInputWithSkills = useMemo(() => {
    if (!storyboardProjectPlanInput || !savedSkillDefinitions.length || !savedSkillRecipes.length) {
      return storyboardProjectPlanInput;
    }
    const projectRoot = runtimeState.project.root?.trim();
    const projectId = runtimeState.sourceIndex.projectId?.trim();
    const existing = storyboardProjectPlanInput.directorSkillContext;
    const definitions = Array.from(new Map(
      [...(existing?.definitions || []), ...savedSkillDefinitions]
        .map((definition) => [`${definition.id}@${definition.version}`, definition] as const),
    ).values());
    const recipes = Array.from(new Map(
      [...(existing?.recipes || []), ...savedSkillRecipes]
        .map((recipe) => [`${recipe.id}@${recipe.version}`, recipe] as const),
    ).values());
    return {
      ...storyboardProjectPlanInput,
      directorSkillContext: {
        definitions,
        recipes,
        knowledgePacks: existing?.knowledgePacks || [],
        projectIdentity: projectRoot && projectId && projectFactHash
          ? { projectId, projectRoot, projectFactHash }
          : undefined,
        userPreferenceTags: existing?.userPreferenceTags || [],
        projectConstraints: existing?.projectConstraints || [],
        explicitlySelectedSkillIds: existing?.explicitlySelectedSkillIds,
        actionIdPrefix: existing?.actionIdPrefix || "agent_feedback_skill",
        jobIdPrefix: existing?.jobIdPrefix || "agent_feedback_skill_dry_run",
        generatedAt: existing?.generatedAt,
      },
    };
  }, [
    projectFactHash,
    runtimeState.project.root,
    runtimeState.sourceIndex.projectId,
    savedSkillDefinitions,
    savedSkillRecipes,
    storyboardProjectPlanInput,
  ]);
  const selectedSkillUseWhenLabel = selectedSkillCard?.useWhen?.[0] || selectedSkillSummary?.reason || "镜头需要明确的导演方法时使用。";
  const selectedSkillAvoidWhenLabel = selectedSkillCard?.avoidWhen?.[0] || "镜头很简单时，不要过度增加约束。";
  const selectedSkillSourceLabel = selectedSkillCard?.createdFrom?.shotTitle
    ? `${selectedSkillCard.createdFrom.shotId || "当前镜头"} · ${cleanStoryText(selectedSkillCard.createdFrom.shotTitle) || "未命名"}`
    : shot
      ? `${shot.id} · ${cleanStoryText(shot.title) || "未命名"}`
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
  const referenceGenerationDeferredByCreator = Boolean(
    referenceGenerationBlockedByContract
      && currentVideoPermissionContract.mode === "plan_only"
  );
  const videoPermissionModeItems: Array<{ mode: AgentVideoPermissionMode; label: string }> = [
    { mode: "plan_only", label: "先整理" },
    { mode: "reference_allowed", label: "可补参考" },
    { mode: "video_allowed", label: "可发视频" },
  ];

  function clearSkillSaveComposerInput() {
    setText("");
    lastVisibleComposerInputRef.current = "";
    setAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function requestSelectedSkillDraftSave(userIntent: string) {
    const projectRoot = runtimeState.project.root?.trim();
    setActiveComposerTurnIntent(userIntent);
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
        title: "AI 导演：需要保存位置",
        body: "这条导演经验需要保存到当前故事里。先选择保存位置，再让我保存。",
        status: "blocked",
        path: `skills/${selectedSkillDraftFile}`,
        next: "选择保存位置后，再说“把这个沉淀成 Skill”。",
      }));
      clearSkillSaveComposerInput();
      setStatus("需要保存位置");
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
        title: "AI 导演：需要保存位置",
        body: "这条导演经验需要保存到当前故事里。先选择保存位置，再让我保存。",
        status: "blocked",
        path: `skills/${skillFileName}`,
        next: "选择保存位置后，再说“把这个沉淀成 Skill”。",
        includeUserMessage: input?.includeUserMessage,
      }));
      clearSkillSaveComposerInput();
      setStatus("需要保存位置");
      return;
    }

    const relativePath = `skills/${skillFileName}`;
    const markdown = directorSkillCardMarkdown(skillCard);
    const savedAt = new Date().toISOString();
    const migratedSkill = migrateLegacyDirectorSkillCard(skillCard);
    if (!migratedSkill.ok || !migratedSkill.definition || !migratedSkill.recipe) {
      rememberAgentTimelineEntries(buildSkillSaveTimelineEntries({
        userIntent,
        title: "AI 导演：保存失败",
        body: `导演经验合同无法安全迁移：${migratedSkill.errors.join("；")}`,
        status: "blocked",
        path: relativePath,
        next: "保留当前镜头，不会把缺失规则的 Skill 写入运行时。",
        includeUserMessage: input?.includeUserMessage,
      }));
      setStatus("保存失败");
      clearSkillSaveComposerInput();
      return;
    }
    const definitionPath = directorSkillDefinitionFileName(migratedSkill.definition);
    const recipePath = directorSkillRecipeFileName(migratedSkill.recipe);
    const nextSkillIndex = upsertDirectorSkillStackIndex(
      createDirectorSkillStackIndex(savedSkillStack),
      {
        card: skillCard,
        fileName: skillFileName,
        savedAt,
        definition: migratedSkill.definition,
        recipe: migratedSkill.recipe,
      },
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
          `${projectRoot.replace(/\/+$/g, "")}/${definitionPath}`,
          serializeDirectorSkillContract(migratedSkill.definition),
        );
        await bridge.sandboxWriteFile(
          `${projectRoot.replace(/\/+$/g, "")}/${recipePath}`,
          serializeDirectorSkillContract(migratedSkill.recipe),
        );
        await bridge.sandboxWriteFile(
          `${projectRoot.replace(/\/+$/g, "")}/${DIRECTOR_SKILL_STACK_INDEX_PATH}`,
          serializeDirectorSkillStackIndex(nextSkillIndex),
        );
        savedSkillStackProjectKeyRef.current = runtimeProjectKey;
        setSavedSkillStack(nextSkillIndex.skills);
        setSavedSkillDefinitions((current) => [
          ...current.filter((item) => item.id !== migratedSkill.definition!.id),
          migratedSkill.definition!,
        ]);
        setSavedSkillRecipes((current) => [
          ...current.filter((item) => item.id !== migratedSkill.recipe!.id),
          migratedSkill.recipe!,
        ]);
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
        window.localStorage.setItem(
          browserSkillStorageKey(projectTitle, definitionPath),
          serializeDirectorSkillContract(migratedSkill.definition),
        );
        window.localStorage.setItem(
          browserSkillStorageKey(projectTitle, recipePath),
          serializeDirectorSkillContract(migratedSkill.recipe),
        );
        window.localStorage.setItem(browserSkillIndexStorageKey(runtimeProjectKey), serializeDirectorSkillStackIndex(nextSkillIndex));
        savedSkillStackProjectKeyRef.current = runtimeProjectKey;
        setSavedSkillStack(nextSkillIndex.skills);
        setSavedSkillDefinitions((current) => [
          ...current.filter((item) => item.id !== migratedSkill.definition!.id),
          migratedSkill.definition!,
        ]);
        setSavedSkillRecipes((current) => [
          ...current.filter((item) => item.id !== migratedSkill.recipe!.id),
          migratedSkill.recipe!,
        ]);
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
    if (!activePendingSkillSaveRequest) {
      setStatus("没有待保存的 Skill");
      return;
    }
    await saveSelectedSkillDraft(activePendingSkillSaveRequest.userIntent, {
      card: activePendingSkillSaveRequest.card,
      fileName: activePendingSkillSaveRequest.fileName,
      includeUserMessage: false,
    });
  }

  function revisePendingSkillSave() {
    if (!activePendingSkillSaveRequest) {
      setStatus("没有待修改的导演经验");
      return;
    }
    rememberAgentTimelineEntries([buildSkillSaveCancelledTimelineEntry({
      skillName: activePendingSkillSaveRequest.card.name,
    })]);
    setText(activePendingSkillSaveRequest.userIntent);
    setPendingSkillSaveRequest(undefined);
    textareaRef.current?.focus();
    setStatus("可以调整后再发送");
  }

  const referenceMissingCount = runtimeState.visualMemory.summary.missing;
  const referenceLockedCount = runtimeState.visualMemory.summary.locked;
  const referenceReviewCount = runtimeState.visualMemory.summary.needsReview;
  const referenceDisplayableCount = runtimeState.visualMemory.assets.filter(minimalAgentAssetHasDisplayableReference).length;
  const referenceReviewableCount = Math.max(referenceReviewCount, realSampleAction?.reviewableOutput ? 1 : 0);
  const referenceNeedsReview = referenceReviewableCount > 0;
  const referenceHasReviewableOutput = (referenceReviewCount > 0 && referenceDisplayableCount > 0)
    || realSampleAction?.reviewableOutput === true;
  const referencesReadyAfterReview = referenceLockedCount > 0 && referenceDisplayableCount > 0 && referenceMissingCount === 0 && !referenceNeedsReview;
  const timelineShowsReferenceReady = agentTimelineHasSucceededLiveExecution(
    agentReadinessTimelineEntries,
    "prepare_references",
    agentGenerationProjectIdentity,
  );
  const timelineHasReferenceValidation = agentTimelineHasValidatedExecution(
    agentReadinessTimelineEntries,
    "prepare_references",
    agentGenerationProjectIdentity,
  );
  const referencesUsableForAgent = referencesReadyAfterReview || timelineShowsReferenceReady;
  const referenceExecutionSatisfiedForAgent = referencesUsableForAgent || timelineHasReferenceValidation;
  const timelineShowsVideoReady = agentTimelineHasSucceededLiveExecution(
    agentReadinessTimelineEntries,
    "submit_video",
    agentGenerationProjectIdentity,
  );
  const timelineHasVideoValidation = agentTimelineHasValidatedExecution(
    agentReadinessTimelineEntries,
    "submit_video",
    agentGenerationProjectIdentity,
  );
  const videoReturnedCountForAgent = Math.max(0, Math.floor(
    videoSendAction?.returnedCount
      ?? (timelineShowsVideoReady || videoSendAction?.status === "needs_review" ? 1 : 0),
  ));
  const videoReviewCountForAgent = Math.max(0, Math.floor(
    videoSendAction?.reviewCount
      ?? (timelineShowsVideoReady || videoSendAction?.status === "needs_review" ? 1 : 0),
  ));
  const referenceMissingCountForAgent = referenceExecutionSatisfiedForAgent ? 0 : referenceMissingCount;
  const referenceReviewCountForAgent = referenceHasReviewableOutput
    ? referenceReviewableCount
    : referencesUsableForAgent
      ? 0
      : referenceReviewableCount;
  const referenceReadyCountForAgent = referencesUsableForAgent ? Math.max(referenceLockedCount, 1) : referenceLockedCount;
  const videoSubmittedForAgent = Boolean(videoAlreadySent || videoBusy || videoCanResume || videoReturnedCountForAgent > 0 || timelineHasVideoValidation);
  const realSampleLabel = realSampleBusy
    ? "生成中"
    : referenceHasReviewableOutput
      ? "等待复核"
    : referenceGenerationBlockedByProject
      ? "选择保存位置"
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
      ? "选择保存位置"
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
      ? "选择保存位置"
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
      : agentVideoPermissionDisplayLabel(activeVideoPermissionContract);
  const agentBoundaryDetail = videoQueryMode
    ? "即梦已收到任务；现在只查询结果，不会重复发送。"
    : videoSubmissionBlocked
      ? videoSendAction?.message || "先补参考或修改这一段，再继续提交视频。"
    : videoBusy
      ? "正在处理视频任务，等结果出来后再继续。"
    : videoAlreadySent
      ? "视频已发送，等待结果。"
      : agentVideoPermissionDisplayDetail(activeVideoPermissionContract);
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
  const videoFocusSelectionChips = videoResultIsPrimary
    ? [
        { label: "范围", value: effectiveReviewTarget?.shotId || shot?.id || "当前视频" },
        { label: "状态", value: effectiveReviewTarget?.status || (videoQueryMode ? "待查询" : videoBusy ? "处理中" : "已返回") },
        { label: "保护", value: "不自动重试、不晋级、不导出" },
      ]
    : [];
  const exportFocusScopeLabel = exportReadyForConfirmation ? "本地交付包" : exportResultIsPrimary ? projectStatusView?.stage || "交付已整理" : "";
  const exportFocusSelectionHint = exportResultIsPrimary
    ? projectStatusView?.doing || "交付内容已整理好；还想改哪里，直接说。"
    : "";
  const exportFocusSelectionChips = exportResultIsPrimary
    ? exportReadyForConfirmation
      ? [
        { label: "下一步", value: "确认导出" },
        { label: "保护", value: "确认前不写文件、不生成缺失视频" },
      ]
      : [
        { label: "范围", value: "当前项目" },
        { label: "包含", value: EXPORT_PACKAGE_CONTENTS_LABEL },
        { label: "写入文件", value: "已生成" },
      ]
    : [];
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
  const visibleAgentActionLog = agentActionLog.filter((item) =>
    !agentActionLogItemIsPrematureReferenceReview(item, referenceHasReviewableOutput)
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
    const hasLiveComposerDraft = Boolean(currentComposerTextValue() || attachments.length);
    if (hasLiveComposerDraft) {
      liveComposerValueRef.current = currentComposerTextValue();
    } else {
      setText("");
      liveComposerValueRef.current = "";
      lastVisibleComposerInputRef.current = "";
      setAttachments([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
    setLocalProjectSetupNotice(undefined);
    setAgentTimelineEntries([]);
    setAgentActionLog([]);
    restoredAgentDraftIdRef.current = "";
    restoredAgentLogKeyRef.current = "";
    restoredAgentTimelineKeyRef.current = "";
    setStatus(hasLiveComposerDraft ? "已同步当前项目，输入已保留，点发送继续" : "已同步当前项目，可以继续说想法");
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
      && !restoredEntries.some(agentTimelineEntryCanFollowCommittedDraft)
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
    const reviewRegenerationJob = activeDirectorReviewRegenerationConfirmation
      ? agentVideoDryRunLedger.jobs.find((job) => job.jobId === activeDirectorReviewRegenerationConfirmation.jobId)
      : undefined;
    const preserveReviewRegenerationHandoff = agentDirectorReviewRegenerationConfirmationMatchesJob(
      activeDirectorReviewRegenerationConfirmation,
      {
        actionId: draft.action.actionId,
        confirmationId: draft.toolHandoff.handoffId,
        job: reviewRegenerationJob,
      },
    );
    const refreshedToolHandoff = preserveReviewRegenerationHandoff
      ? draft.toolHandoff
      : buildVibeAgentToolHandoff({
          action: draft.action,
          userConfirmed: false,
          confirmedAt: draft.toolHandoff.createdAt || draft.createdAt,
          availability: currentAgentToolAvailability(draft.action),
        }) || draft.toolHandoff;
    const refreshedDraft = refreshedRestoredAgentStagedPlanDraft(draft, refreshedToolHandoff);
    if (restoredAgentStagedPlanDraftNeedsWriteBack(draft, refreshedDraft)) {
      void onRefreshRestoredAgentStagedPlanDraft?.(refreshedDraft);
    }
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
    setAgentToolHandoff(refreshedToolHandoff);
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
    activeDirectorReviewRegenerationConfirmation,
    activeVideoPermissionContract,
    agentVideoDryRunLedger,
    hasPreparedAgentState,
	    localProjectReadyForTools,
	    onRefreshRestoredAgentStagedPlanDraft,
	    projectReferenceGuide,
    restoredAgentStagedPlanDraft,
    runtimeState,
    scopeLabel,
    selectionHint,
  ]);

  useEffect(() => {
    if (!selectionFocusKey || !hasBoundSelection || text.trim() || storyLevelReferenceContextActive) {
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
      next: selectionContextNextCopy(localProjectReadyForTools),
    })]);
    if (!canAutoFocusComposer()) return;
    window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 0);
  }, [asset?.id, hasBoundSelection, localProjectReadyForTools, localScopeLabel, scopedShotKey, sectionId, selectionFocusKey, selectionHint, shot?.id, storyLevelReferenceContextActive, text]);

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
    setStatus(agentVideoPermissionDisplayLabel(nextContract));
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
        { label: "查看", value: "参考页" },
        { label: "保护", value: "先复核再用于视频" },
      ],
    };
    if (referenceGenerationBlockedByProject) {
      rememberBlockedDirectProductAction({
        toolName: referenceTask.toolName,
        title: "还不能生成参考",
        body: "先选择保存位置，这样 Agent 才能把参考图写回项目。",
        next: "选择保存位置后，再点生成参考。",
        facts: referenceTask.facts,
        status: "需要保存位置",
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
        void runFooterAgentVideoExecution({
          action: "prepare_references",
          actionId: "footer_reference_generation",
          confirmationReceiptId: "footer_action_reference_generation",
          timeoutMs: 10 * 60 * 1000,
          perform: (context) => onRetryMissingBatch({ signal: context.signal }),
        });
        return;
      }
      setStatus("已确认，正在发送参考任务。");
      void runFooterAgentVideoExecution({
        action: "prepare_references",
        actionId: "footer_reference_generation",
        confirmationReceiptId: "footer_action_reference_generation",
        timeoutMs: 10 * 60 * 1000,
        perform: (context) => onCreateP6RealSample({
          scope: "project",
          videoPermissionContract: nextContract,
          skipConfirm: true,
          confirmationReceiptId: context.receipt.confirmationReceiptId,
          confirmedAt: context.receipt.createdAt,
          signal: context.signal,
        }),
      });
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
      void runFooterAgentVideoExecution({
        action: "prepare_references",
        actionId: "footer_reference_generation",
        confirmationReceiptId: "footer_action_reference_generation",
        timeoutMs: 10 * 60 * 1000,
        perform: (context) => onRetryMissingBatch({ signal: context.signal }),
      });
      return;
    }
    setStatus("已发送参考任务。");
    void runFooterAgentVideoExecution({
      action: "prepare_references",
      actionId: "footer_reference_generation",
      confirmationReceiptId: "footer_action_reference_generation",
      timeoutMs: 10 * 60 * 1000,
      perform: (context) => onCreateP6RealSample({
        scope: "project",
        videoPermissionContract: currentVideoPermissionContract,
        skipConfirm: true,
        confirmationReceiptId: context.receipt.confirmationReceiptId,
        confirmedAt: context.receipt.createdAt,
        signal: context.signal,
      }),
    });
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
        { label: "查看", value: "参考页" },
        { label: "保护", value: "先复核再用于视频" },
      ],
    };
    if (referenceGenerationBlockedByProject) {
      rememberBlockedDirectProductAction({
        toolName: endFrameTask.toolName,
        title: "还不能生成结束画面",
        body: "先选择保存位置，这样 Agent 才能把结束画面写回项目。",
        next: "选择保存位置后，再生成结束画面。",
        facts: endFrameTask.facts,
        status: "需要保存位置",
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
      void runFooterAgentVideoExecution({
        action: "prepare_references",
        actionId: "footer_end_frame_generation",
        confirmationReceiptId: "footer_action_end_frame_generation",
        timeoutMs: 10 * 60 * 1000,
        perform: (context) => onCreateImage2EndFrame({
          skipConfirm: true,
          confirmationReceiptId: context.receipt.confirmationReceiptId,
          confirmedAt: context.receipt.createdAt,
          signal: context.signal,
        }),
      });
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
    void runFooterAgentVideoExecution({
      action: "prepare_references",
      actionId: "footer_end_frame_generation",
      confirmationReceiptId: "footer_action_end_frame_generation",
      timeoutMs: 10 * 60 * 1000,
      perform: (context) => onCreateImage2EndFrame({
        skipConfirm: true,
        confirmationReceiptId: context.receipt.confirmationReceiptId,
        confirmedAt: context.receipt.createdAt,
        signal: context.signal,
      }),
    });
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
            { label: "保护", value: "不会重复提交" },
            { label: "查看", value: "预览页" },
          ],
        }
      : {
          toolName: "submit_video" as DirectProductActionToolName,
          startedTitle: "开始发送视频",
          startedBody: "已确认，Agent 正在串行提交当前视频任务。",
          completedTitle: "视频任务已发送",
          completedBody: "视频任务已提交，完成后会在预览页显示。",
          failedTitle: "视频任务发送失败",
          next: "等结果回流后，到预览页复核。",
          facts: [
            { label: "动作", value: "发送视频" },
            { label: "方式", value: "串行提交" },
            { label: "查看", value: "预览页" },
          ],
        };
    if (videoPermissionBlockedByProject) {
      rememberBlockedDirectProductAction({
        toolName: videoTask.toolName,
        title: videoQueryMode ? "还不能查询视频" : "还不能发送视频",
        body: "先选择保存位置，这样 Agent 才能读取任务状态并写回结果。",
        next: "选择保存位置后，再继续视频任务。",
        facts: videoTask.facts,
        status: "需要保存位置",
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
      void runFooterAgentVideoExecution({
        action: "submit_video",
        operation: videoQueryMode ? "query" : undefined,
        actionId: videoQueryMode ? "footer_video_query" : "footer_video_submit",
        confirmationReceiptId: videoQueryMode ? "footer_action_video_query" : "footer_action_video_submit",
        timeoutMs: 5 * 60 * 1000,
        perform: (context) => onSendSeedanceVideo({
          videoPermissionContract: nextContract,
          skipConfirm: true,
          confirmationReceiptId: context.receipt.confirmationReceiptId,
          confirmedAt: context.receipt.createdAt,
          signal: context.signal,
        }),
      });
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
    void runFooterAgentVideoExecution({
      action: "submit_video",
      operation: videoQueryMode ? "query" : undefined,
      actionId: videoQueryMode ? "footer_video_query" : "footer_video_submit",
      confirmationReceiptId: videoQueryMode ? "footer_action_video_query" : "footer_action_video_submit",
      timeoutMs: 5 * 60 * 1000,
      perform: (context) => onSendSeedanceVideo({
        videoPermissionContract: currentVideoPermissionContract,
        skipConfirm: true,
        confirmationReceiptId: context.receipt.confirmationReceiptId,
        confirmedAt: context.receipt.createdAt,
        signal: context.signal,
      }),
    });
  }

  function updateText(value: string) {
    liveComposerValueRef.current = value;
    lastVisibleComposerInputRef.current = value;
    setText(value);
    if (!value.trim()) {
      setComposerEditingConfirmationLabel("");
      onEditingPendingConfirmationChange?.(false);
    }
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

  function currentComposerTextValue() {
    return (textareaRef.current?.value || liveComposerValueRef.current || text).trim();
  }

  function continueFromAgentActionLog(item: AgentActionLogItem) {
    resetPreparedComposerState("继续写");
    setText(item.followUpIntent);
    window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 0);
  }

  function currentComposerSelectionOverride(intent?: string): ComposerSelectionOverride {
    if (intent && composerIntentTargetsProjectScope(intent)) return { projectScope: true };
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
    setActiveComposerTurnIntent("");
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

  function rememberLocalProjectBlockForIntent(userIntent: string) {
    const blockedShotCount = newVideoDraftShotCountForAgent || runtimeState.storyFlow.shots.length;
    const blockedIntentRoute = routeProjectAgentIntent({
      text: userIntent,
      hasSelection: storyReferencePlanOnlyIntentActive || referencePlanningContinueIntentActive ? false : hasActiveSelection,
      hasAttachments: attachments.length > 0,
      observation: composerProjectObservation,
    });
    const blockedIntentLabel = localProjectBlockedIntentLabel(blockedIntentRoute, userIntent);
    setActiveComposerTurnIntent(userIntent);
    rememberAgentTimelineEntries(buildLocalBlockedAgentTimelineEntries({
      userIntent,
      title: "AI 导演：需要保存位置",
      body: `我看到了“${userIntent}”。继续前需要先选择这版故事的保存位置；这一步只选择保存位置，不会生成参考、提交视频或导出。`,
      facts: [
        { label: "你想做", value: blockedIntentLabel },
        { label: "先做", value: "选择保存位置" },
        { label: "保护", value: "不生成参考、不提交视频、不导出" },
        { label: "镜头", value: `${blockedShotCount} 个` },
      ],
      next: "确认「选择保存位置」后，我会接着当前故事检查下一步。",
    }));
    setText("");
    liveComposerValueRef.current = "";
    lastVisibleComposerInputRef.current = "";
    setAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setStatus("需要保存位置：在消息中确认选择保存位置。");
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

  function currentAgentToolAvailability(action = agentActionEnvelope): DirectorAgentToolAvailability {
    const confirmedVideoSubmitAllowed = action?.kind === "prepare_video_submit"
      && action.executionContract.videoSubmitAllowed;
    const dryRunAction = agentVideoDryRunActionFor(action);
    const referenceDryRunReady = dryRunAction === "prepare_references";
    const videoDryRunReady = dryRunAction === "submit_video";
    const exportDryRunReady = dryRunAction === "export";
    return buildVibeAgentProductToolAvailability({
      localProjectReady: localProjectReadyForTools,
      webSearchReady: effectiveWebSearchReady,
      referenceGenerationCallbackReady: Boolean(onCreateP6RealSample) || referenceDryRunReady,
      referenceGenerationKeyConfigured: referenceDryRunReady || realSampleAction?.keyConfigured,
      referenceGenerationDisabled: referenceDryRunReady ? false : realSampleAction?.disabled,
      referenceGenerationBusy: referenceDryRunReady ? false : realSampleBusy,
      videoSubmitCallbackReady: Boolean(onSendSeedanceVideo) || videoDryRunReady,
      videoSubmitReady: Boolean(videoSendAction?.ready || confirmedVideoSubmitAllowed),
      videoSubmitKeyConfigured: videoDryRunReady || videoSendAction?.keyConfigured,
      videoAlreadySent,
      videoCanResume,
      exportCallbackReady: Boolean(onRunExport) || exportDryRunReady,
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

  async function prepareChange(
    intentOverride?: string,
    selectionOverride?: ComposerSelectionOverride,
    options: { skipClarification?: boolean } = {},
  ) {
    if (isPreparingPlan) return;
    setIsPreparingPlan(true);
    try {
      const usingOverride = Boolean(intentOverride?.trim());
      setStatus(!usingOverride && attachments.some((attachment) => attachment.kind === "script") ? "正在读取脚本" : "正在整理");
      const rawUserIntent = usingOverride
        ? intentOverride!.trim()
        : await composerIntentFromInput(text, attachments);
      if (!rawUserIntent) {
        setStatus("先写一句，或拖文件");
        return;
      }
      const resolvingClarification = Boolean(activeDirectorClarificationTurn && !options.skipClarification);
      const userIntent = resolvingClarification
        ? agentDirectorClarificationReplyIntent(activeDirectorClarificationTurn!, rawUserIntent)
        : rawUserIntent;
      if (!userIntent) {
        setStatus("先写一句，或拖文件");
        return;
      }
      if (activeDirectorClarificationTurn?.reviewRevision) {
        return await formReviewRegenerationProposal({
          clarificationTurn: activeDirectorClarificationTurn,
          resolvedIntent: userIntent,
        });
      }
      setActiveComposerTurnIntent(userIntent);
      if (!activeDirectorClarificationTurn && !options.skipClarification) {
        const clarificationShotId = selectionOverride?.selectedShotId
          || (selectionOverride?.selectedShotIds?.length === 1 ? selectionOverride.selectedShotIds[0] : undefined)
          || currentSelectedShotId
          || shot?.id;
        const clarificationTurn = buildAgentDirectorClarificationTurn({
          userIntent,
          selectedShotId: clarificationShotId,
          targetLabel: clarificationShotId,
          hasAttachments: attachments.length > 0,
          reviewRevision: activeDirectorReviewRevisionIntent
            ? {
              intentId: activeDirectorReviewRevisionIntent.intentId,
              identity: activeDirectorReviewRevisionIntent.identity,
            }
            : undefined,
        });
        if (clarificationTurn) {
          resetPreparedComposerState("需要确认导演意图");
          setActiveComposerTurnIntent(userIntent);
          rememberAgentTimelineEntries(buildAgentDirectorClarificationTimelineEntries(clarificationTurn));
          setText("");
          liveComposerValueRef.current = "";
          lastVisibleComposerInputRef.current = "";
          setAttachments([]);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
      }
      if (isSaveDirectorSkillIntent(userIntent)) {
        requestSelectedSkillDraftSave(userIntent);
        return;
      }
      const storyShotCountRevisionForCurrentStory = storyShotCountRevisionRequestText(userIntent);
      const planOnlyReferenceFollowupForCurrentStory = Boolean(
        !attachments.length
          && !storyShotCountRevisionForCurrentStory
          && referencePlanningPlanOnlyRequestText(userIntent)
          && (
            currentProjectHasStoryContext
            || persistedStoryContextActive
            || pendingReferenceGenerationContextActive
            || restoredAgentStagedPlanDraft?.status === "active"
            || pendingReferenceGenerationConfirmationMessage
          )
      );
      if (planOnlyReferenceFollowupForCurrentStory) {
        const nextContract = agentVideoPermissionForMode("plan_only");
        updateVideoPermissionContract(nextContract);
        await onClearPrototypeAgentPlan?.();
        resetPreparedComposerState("准备参考计划");
        rememberAgentTimelineEntries(buildLocalReferencePlanningTimelineEntries({
          userIntent,
          label: "准备参考计划",
          plan: ["保留当前故事的参考计划", "不生成图片", "不提交视频"],
          observation: composerProjectObservation,
        }));
        setText("");
        liveComposerValueRef.current = "";
        lastVisibleComposerInputRef.current = "";
        setAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const currentProjectContinueIntent = currentProjectHasStoryContext
        && (storyShotCountRevisionForCurrentStory || intentContinuesCurrentProject(userIntent));
      if (onStartNewVideoDraftFromAgent && !currentProjectContinueIntent && !storyShotCountRevisionForCurrentStory && !planOnlyReferenceFollowupForCurrentStory && intentStartsFreshVideoDraft(userIntent)) {
        setStatus("开始新草案");
        setText("");
        liveComposerValueRef.current = "";
        lastVisibleComposerInputRef.current = "";
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
        liveComposerValueRef.current = "";
        lastVisibleComposerInputRef.current = "";
        setAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await onStartNewVideoDraftFromAgent(userIntent);
        return;
      }
      if (
        runtimeState.storyFlow.shots.length === 0
        && !currentProjectHasStoryContext
        && onStartNewVideoDraftFromAgent
        && !planOnlyReferenceFollowupForCurrentStory
        && intentCanStartNewVideoPlanningWithoutProject(userIntent)
      ) {
        setStatus("正在拆镜头");
        setText("");
        liveComposerValueRef.current = "";
        lastVisibleComposerInputRef.current = "";
        setAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await onStartNewVideoDraftFromAgent(userIntent);
        return;
      }
      const userIntentIsPermissionControlOnly = isDirectorAgentPermissionControlOnlyIntent(userIntent);
      if (
        activeProjectEditConfirmationMessage
        && activeProjectEditConfirmationLabel
        && !userIntentIsPermissionControlOnly
        && intentRequestsToolOrExportWork(userIntent)
      ) {
        const blockedIntentRoute = routeProjectAgentIntent({
          text: userIntent,
          hasSelection: storyReferencePlanOnlyIntentActive || referencePlanningContinueIntentActive ? false : hasActiveSelection,
          hasAttachments: attachments.length > 0,
          observation: composerProjectObservation,
        });
        rememberAgentTimelineEntries(buildPendingProjectEditBlockedTimelineEntries({
          userIntent,
          blockedIntentLabel: localProjectBlockedIntentLabel(blockedIntentRoute, userIntent),
          confirmationLabel: activeProjectEditConfirmationLabel,
          confirmationMessage: activeProjectEditConfirmationMessage,
        }));
        setText("");
        liveComposerValueRef.current = "";
        lastVisibleComposerInputRef.current = "";
        setAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setStatus(`先处理当前修改：${activeProjectEditConfirmationLabel}`);
        return;
      }
      const userIntentNeedsLocalProject = !userIntentIsPermissionControlOnly && (
        !localProjectReadyForTools
        || projectRequiredForWorkflow
        || projectBlockedWithoutFooterResolver
      ) && intentNeedsLocalProjectBeforeTooling(userIntent);
      if (userIntentNeedsLocalProject) {
        rememberLocalProjectBlockForIntent(userIntent);
        return;
      }
      setStatus("正在整理");
      const nextVideoPermissionContract = detectAgentVideoPermissionContract(userIntent, activeVideoPermissionContract);
      const previousActionVideoPermissionContract = userIntentIsPermissionControlOnly
        ? activeVideoPermissionContract
        : visibleVideoPermissionContractFor(activeVideoPermissionContract);
      const nextActionVideoPermissionContract = userIntentIsPermissionControlOnly
        ? nextVideoPermissionContract
        : visibleVideoPermissionContractFor(nextVideoPermissionContract);
      const previousActionVideoPermissionLabel = agentVideoPermissionDisplayLabel(previousActionVideoPermissionContract);
      const nextActionVideoPermissionLabel = agentVideoPermissionDisplayLabel(nextActionVideoPermissionContract, userIntent);
      const agentDrivenContinueIntent = isContinueIntent(userIntent);
      const actionExecutionPermissionContract = agentDrivenContinueIntent
        ? undefined
        : nextActionVideoPermissionContract;
      updateVideoPermissionContract(nextVideoPermissionContract);
      const projectIntentRouteForTurn = routeProjectAgentIntent({
        text: userIntent,
        hasSelection: storyReferencePlanOnlyIntentActive || referencePlanningContinueIntentActive ? false : hasActiveSelection,
        hasAttachments: attachments.length > 0,
        observation: composerProjectObservation,
      });
      const referenceGenerationFromReferencePlan = Boolean(
        !userIntentIsPermissionControlOnly
        && projectIntentRouteForTurn.kind === "reference"
        && projectIntentRouteForTurn.confirmation === "reference_generation"
        && referencePlanningGenerationRequestText(userIntent),
      );
      const continueReferenceGenerationFromStoryPlan = Boolean(
        agentDrivenContinueIntent
          && !attachments.length
          && currentProjectHasStoryContext
          && composerProjectObservation.currentTask.confirmation.kind === "reference_generation"
          && (referencePlanningFocusEntry || savedStoryReferencePlanStatusActive),
      );
      const exportIntentUsesProjectScope = projectIntentRouteForTurn.kind === "export"
        && composerExportIntentTargetsProjectScope(userIntent);
      const videoIntentUsesProjectScope = projectIntentRouteForTurn.kind === "video"
        && !composerVideoIntentExplicitlyTargetsShot(userIntent);
      const videoSubmitIntentForCurrentStory = projectIntentRouteForTurn.kind === "video"
        && projectIntentRouteForTurn.confirmation === "video_submit"
        && !composerVideoIntentExplicitlyTargetsShot(userIntent);
      if (userIntentIsPermissionControlOnly && !referenceGenerationFromReferencePlan && !continueReferenceGenerationFromStoryPlan) {
        const executionBoundaryChangedAt = new Date().toISOString();
        const preservedProjectEditConfirmation = activeProjectEditConfirmationMessage
          ? preservedProjectEditConfirmationTimelineEntry(activeProjectEditConfirmationMessage, executionBoundaryChangedAt)
          : undefined;
        rememberAgentTimelineEntries([
          buildExecutionBoundaryControlUserTimelineEntry({
            createdAt: executionBoundaryChangedAt,
            userIntent,
          }),
          buildExecutionBoundaryChangedTimelineEntry({
            createdAt: executionBoundaryChangedAt,
            contract: nextActionVideoPermissionContract,
            userIntent,
            changed: previousActionVideoPermissionLabel !== nextActionVideoPermissionLabel,
          }),
          ...(preservedProjectEditConfirmation ? [preservedProjectEditConfirmation] : []),
        ]);
        resetPreparedComposerState(nextActionVideoPermissionLabel);
        setText("");
        liveComposerValueRef.current = "";
        lastVisibleComposerInputRef.current = "";
        setAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (projectIntentRouteForTurn.kind === "reference" && projectIntentRouteForTurn.confirmation === "none") {
        resetPreparedComposerState(projectIntentRouteForTurn.label);
        rememberAgentTimelineEntries(buildLocalReferencePlanningTimelineEntries({
          userIntent,
          label: projectIntentRouteForTurn.label,
          plan: projectIntentRouteForTurn.plan,
          observation: composerProjectObservation,
        }));
        setText("");
        liveComposerValueRef.current = "";
        lastVisibleComposerInputRef.current = "";
        setAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (projectIntentRouteForTurn.kind === "video" && projectIntentRouteForTurn.confirmation === "none") {
        resetPreparedComposerState(projectIntentRouteForTurn.label);
        rememberAgentTimelineEntries(buildLocalVideoBlockedPlanningTimelineEntries({
          userIntent,
          label: projectIntentRouteForTurn.label,
          plan: projectIntentRouteForTurn.plan,
          observation: composerProjectObservation,
        }));
        setText("");
        liveComposerValueRef.current = "";
        lastVisibleComposerInputRef.current = "";
        setAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const videoIntentShouldConfirmReferencesFirst = projectIntentRouteForTurn.kind === "video"
        && projectIntentRouteForTurn.confirmation === "video_submit"
        && composerProjectObservation.currentTask.confirmation.kind === "reference_generation";
      const agentActionEnvelopeIntent = videoIntentShouldConfirmReferencesFirst
        ? `${userIntent}；先补齐当前故事参考`
        : continueReferenceGenerationFromStoryPlan
          ? `${userIntent}；先补齐当前故事参考`
        : userIntent;
      const agentActionExecutionPermissionContract = videoIntentShouldConfirmReferencesFirst || referenceGenerationFromReferencePlan || continueReferenceGenerationFromStoryPlan
        ? agentVideoPermissionForMode("reference_allowed")
        : videoSubmitIntentForCurrentStory
          ? agentVideoPermissionForMode("video_allowed")
        : actionExecutionPermissionContract;
      const preparedAgentActionVideoPermissionContract = agentActionExecutionPermissionContract || nextActionVideoPermissionContract;
      const preparedActionUsesProjectScope = Boolean(
        videoIntentShouldConfirmReferencesFirst
        || referenceGenerationFromReferencePlan
	        || continueReferenceGenerationFromStoryPlan
	        || videoIntentUsesProjectScope
	        || exportIntentUsesProjectScope
	        || storyReferencePlanOnlyIntentActive
	        || storyShotCountRevisionForCurrentStory
	        || selectionOverride?.projectScope,
	      );
	      const preparedSelection: PreparedComposerContext = {
	        scopeLabel: videoIntentShouldConfirmReferencesFirst || referenceGenerationFromReferencePlan || continueReferenceGenerationFromStoryPlan || videoIntentUsesProjectScope || storyReferencePlanOnlyIntentActive || storyShotCountRevisionForCurrentStory ? "当前故事" : exportIntentUsesProjectScope ? "当前项目" : scopeLabel,
	        selectionHint: videoIntentShouldConfirmReferencesFirst
	          ? "发送视频前先补齐当前故事参考；真正生成前会再确认。"
	          : continueReferenceGenerationFromStoryPlan
	            ? "继续当前故事参考；真正生成前会再确认。"
	          : referenceGenerationFromReferencePlan
	          ? "准备生成当前故事缺少的参考；真正生成前会再确认。"
	          : videoIntentUsesProjectScope
	            ? "准备发送当前故事视频；真正提交前会再确认。"
	          : exportIntentUsesProjectScope
	            ? "准备导出当前项目交付包；确认前不会写入本地文件。"
          : storyShotCountRevisionForCurrentStory
            ? "按你的要求重排当前故事；确认前不会生成参考，也不会提交视频。"
          : storyReferencePlanOnlyIntentActive
            ? "只准备当前故事的参考计划；不会生成图片，也不会提交视频。"
            : selectionHint,
        userIntent,
        selectedShotId: preparedActionUsesProjectScope
          ? undefined
          : selectionOverride?.selectedShotId || (selectionOverride?.selectedShotIds?.length === 1 ? selectionOverride.selectedShotIds[0] : undefined) || (scopedShotIds.length <= 1 ? currentSelectedShotId : undefined),
        selectedShotIds: preparedActionUsesProjectScope
          ? undefined
          : selectionOverride?.selectedShotIds?.length ? selectionOverride.selectedShotIds : scopedShotIds.length > 1 ? scopedShotIds : undefined,
        selectedAssetId: preparedActionUsesProjectScope ? undefined : selectionOverride?.selectedAssetId || asset?.id,
        sectionId: preparedActionUsesProjectScope
          ? undefined
          : selectionOverride?.sectionId || (!selectionOverride?.selectedShotId && !selectionOverride?.selectedShotIds?.length && !scopedShotIds.length && !asset ? sectionId : undefined),
        videoPermissionContract: preparedAgentActionVideoPermissionContract,
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
        userIntent: agentActionEnvelopeIntent,
	        snapshot: buildDirectorAgentStateSnapshot({
	          runtimeState,
	          currentView: preparedSelection.sectionId ? "section" : preparedSelection.selectedAssetId ? "reference" : "story",
		          selectedShotId: preparedSelection.selectedShotId,
		          selectedShotIds: preparedSelection.selectedShotIds,
		          selectedAssetId: preparedSelection.selectedAssetId,
		          sectionId: preparedSelection.sectionId,
		          referenceReadyCount: referenceReadyCountForAgent,
		          referenceReviewCount: referenceReviewCountForAgent,
		          referenceMissingCount: referenceMissingCountForAgent,
		          videoStatus: videoCanResume ? "recoverable" : videoSendAction?.status,
		          videoCanResume,
		          videoWaitingCount: videoSendAction?.status === "submitted" ? 1 : 0,
	          videoCompletedCount: videoSendAction?.status === "needs_review" ? 1 : 0,
	          videoReviewCount: videoSendAction?.status === "needs_review" ? 1 : 0,
	          videoDetail: videoSendAction?.message,
	        }),
        executionContract: agentActionExecutionPermissionContract
          ? directorAgentExecutionContractFromCreatorBoundary({
              mode: agentActionExecutionPermissionContract.mode,
              referenceGenerationAllowed: agentActionExecutionPermissionContract.referenceGenerationAllowed,
              videoSubmitAllowed: agentActionExecutionPermissionContract.videoSubmitAllowed,
              reason: agentActionExecutionPermissionContract.reason,
            })
          : undefined,
        generatedAt: nextWorkflow.generatedAt,
      });
      const stageStoryRevisionLocally = !localProjectReadyForTools
        && currentProjectHasStoryContext
        && intentIsStoryRevisionWithoutTooling(userIntent);
      let stagedAgentPlan: StagePrototypeAgentPlanResult | void = undefined;
      if (!stageStoryRevisionLocally) {
        try {
          stagedAgentPlan = await onStagePrototypeAgentPlan?.({
            userIntent,
            agentActionUserIntent: agentActionEnvelopeIntent,
            scopeLabel: preparedSelection.scopeLabel,
            selectedShotId: preparedSelection.selectedShotId,
	            selectedShotIds: preparedSelection.selectedShotIds,
	            selectedAssetId: preparedSelection.selectedAssetId,
	            sectionId: preparedSelection.sectionId,
	            videoPermissionContract: agentActionExecutionPermissionContract,
	            videoStatus: videoCanResume ? "recoverable" : videoSendAction?.status,
	            videoCanResume,
	            videoWaitingCount: videoSendAction?.status === "submitted" ? 1 : 0,
	            videoCompletedCount: videoSendAction?.status === "needs_review" ? 1 : 0,
	            videoReviewCount: videoSendAction?.status === "needs_review" ? 1 : 0,
	            videoDetail: videoSendAction?.message,
	            referenceReadyCount: referenceReadyCountForAgent,
	            referenceReviewCount: referenceReviewCountForAgent,
	            referenceMissingCount: referenceMissingCountForAgent,
	            availability: currentAgentToolAvailability(localAgentActionEnvelope),
	            generatedAt: nextWorkflow.generatedAt,
	          });
        } catch (error) {
          console.error("Failed to stage Product Agent plan", error);
          resetPreparedComposerState("整理失败，请重试");
          return;
        }
      }
      const stagedAgentTimelineEntries = stagedAgentPlan?.agentTimelineEntries?.length
        ? stagedAgentPlan.agentTimelineEntries
        : undefined;
      if (stagedAgentPlan?.agentKernelTurn) {
        setLatestAgentKernelTurn(stagedAgentPlan.agentKernelTurn);
      }
      const nextAgentActionEnvelope = choosePreparedAgentAction(
        localAgentActionEnvelope,
        stagedAgentPlan?.agentActionEnvelope,
      );
      const stagedAgentActionMatchesChosen = !stagedAgentPlan?.agentActionEnvelope
        || (
          stagedAgentPlan.agentActionEnvelope.kind === nextAgentActionEnvelope.kind
          && stagedAgentPlan.agentActionEnvelope.status === nextAgentActionEnvelope.status
          && !agentActionTargetsDiffer(stagedAgentPlan.agentActionEnvelope, nextAgentActionEnvelope)
        );
      const nextAgentToolHandoff = buildVibeAgentToolHandoff({
        action: nextAgentActionEnvelope,
        userConfirmed: false,
        confirmedAt: handoffMatchesAction(stagedAgentPlan?.agentToolHandoff, nextAgentActionEnvelope)
          ? stagedAgentPlan?.agentToolHandoff?.createdAt
          : undefined,
        availability: currentAgentToolAvailability(nextAgentActionEnvelope),
      }) || stagedAgentPlan?.agentToolHandoff;
      const preparedTimelineEntries = stagedAgentActionMatchesChosen && stagedAgentTimelineEntries && agentTimelineEntriesForCurrentUserIntent(stagedAgentTimelineEntries, userIntent)
        ? stagedAgentTimelineEntries
        : buildLocalPreparedAgentTimelineEntries({
          userIntent,
          action: nextAgentActionEnvelope,
        });
      setAgentTimelineEntries(activeDirectorClarificationTurn || activeDirectorReviewRevisionIntent
        ? mergeVibeAgentTimelineEntries(agentTimelineEntries, preparedTimelineEntries)
        : preparedTimelineEntries);
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
      const nextFeedbackRecompile = feedbackTargetShotId && storyboardProjectPlanInputWithSkills && shouldBuildShotFeedbackRecompile(nextAgentActionEnvelope)
        ? buildDirectorFeedbackRecompile({
            feedback: feedbackWithSubmitCheckContext(userIntent, videoSendAction?.qaFeedback),
            targetShotId: feedbackTargetShotId,
            projectPlanInput: storyboardProjectPlanInputWithSkills,
          })
        : undefined;
      const directorSkillReceipt = nextFeedbackRecompile?.recompiledShotPlan?.directorSkillInvocationReceipt;
      if (directorSkillReceipt) {
        const persisted = await appendProjectDirectorSkillInvocationReceipt(
          { projectRoot: directorSkillReceipt.projectRoot },
          {
            projectId: directorSkillReceipt.projectId,
            projectRoot: directorSkillReceipt.projectRoot,
            projectFactHash: directorSkillReceipt.projectFactHash,
          },
          directorSkillReceipt,
        );
        if (!persisted.ok) {
          console.warn("Director Skill invocation record was not persisted", persisted.errors);
        }
      }
      const nextProjection = buildAgentPanelProjection(nextWorkflow, runtimeState, "review");
      setWorkflow(nextWorkflow);
      setProjection(nextProjection);
      setFeedbackRecompile(nextFeedbackRecompile);
      setPreparedContext(finalPreparedSelection);
      setAgentActionEnvelope(nextAgentActionEnvelope);
      setAgentToolHandoff(nextAgentToolHandoff);
      setPlanPhase("review");
      setText("");
      liveComposerValueRef.current = "";
      lastVisibleComposerInputRef.current = "";
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
          ? agentVideoPermissionDisplayLabel(preparedAgentPermissionContract, userIntent)
        : directorFeedbackCanConfirm(nextFeedbackRecompile)
          ? "等你确认"
          : directorFeedbackNeedsConcreteDirection(nextFeedbackRecompile)
            ? "再说具体一点"
            : workflowCanConfirm(nextWorkflow) ? "等你确认" : nextProjection.shortLabel);
      return true;
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
    const messageRevisionIntent = agentMessageRevisionIntent(message, previousIntent || activeComposerTurnIntent.trim());
    const revisionIntent = [
      !minimalAgentMessageRequestsActionConfirmation(message) ? previousIntent : "",
      messageRevisionIntent,
    ]
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
    if (minimalAgentMessageRequestsActionConfirmation(message)) {
      setComposerEditingConfirmationLabel(minimalAgentConfirmationAction(message, primaryLabel).label);
      onEditingPendingConfirmationChange?.(true);
    }
    liveComposerValueRef.current = revisionIntent;
    lastVisibleComposerInputRef.current = revisionIntent;
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

  async function continueNextAfterConfirmedAction(nextIntent = "下一步") {
    setWorkflow(undefined);
    setProjection(undefined);
    setFeedbackRecompile(undefined);
    setPreparedContext(undefined);
    setAgentActionEnvelope(undefined);
    setAgentToolHandoff(undefined);
    setPlanPhase("idle");
    setLocalPrototypeAgentDemo(undefined);
    setIsRetryingTool(false);
    await prepareChange(nextIntent, currentComposerSelectionOverride(nextIntent));
  }

  function buildConfirmedAgentToolHandoff(action: DirectorAgentActionEnvelope | undefined) {
    return buildConfirmedVibeAgentToolHandoff({
      action,
      availability: currentAgentToolAvailability(action),
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

  async function clearCompletedAgentStagedPlan(outcome: ConfirmedAgentToolRunOutcome) {
    if (outcome.status !== "completed") return;
    try {
      await onClearPrototypeAgentPlan?.();
    } catch (error) {
      console.warn("Failed to clear completed Agent staged plan", error);
    }
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

  function rememberAgentTimelineEntries(
    entries: VibeAgentTimelineEntry[],
    identity = agentGenerationProjectIdentityRef.current,
  ) {
    const boundEntries = bindProjectAgentTimelineEntriesToIdentity(entries, identity);
    setAgentTimelineEntries((current) => mergeVibeAgentTimelineEntries(current, boundEntries));
    const persistence = onRememberAgentTimelineEntries?.(boundEntries);
    if (persistence) void persistence.catch((error) => console.warn("Failed to persist Agent timeline entries", error));
  }

  function rememberDirectProductAction(input: {
    phase: "started" | "running" | "completed" | "failed" | "blocked";
    toolName: DirectProductActionToolName;
    title: string;
    body: string;
    next: string;
    facts?: Array<{ label: string; value: string }>;
    dedupeKey?: string;
    sourceFactHash?: string;
  }) {
    rememberAgentTimelineEntries([buildDirectProductActionTimelineEntry({
      createdAt: new Date().toISOString(),
      ...input,
      sourceFactHash: input.sourceFactHash || projectFactHash,
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
    const visibleReferenceStatus = realSampleAction?.status === "needs_review" && !referenceHasReviewableOutput
      ? undefined
      : realSampleAction?.status === "verified" && referenceDisplayableCount === 0
        ? "running"
        : realSampleAction?.status;
    const projectedReferenceStatus = referenceHasReviewableOutput
      ? "needs_review"
      : referencesReadyAfterReview && timelineShowsReferenceReview
        ? "verified"
        : visibleReferenceStatus;
    const projectedReferenceMessage = referenceHasReviewableOutput
      ? `${referenceReviewableCount} 项参考需要复核。`
      : referencesReadyAfterReview && timelineShowsReferenceReview
        ? "参考可用，下一步可以发送视频。"
      : realSampleAction?.status === "verified" && referenceDisplayableCount === 0
        ? "参考生成中，等待结果回到参考页。"
        : realSampleAction?.message;
    const projectedState = referenceDirectProductActionState(projectedReferenceStatus, projectedReferenceMessage);
    if (!projectedState) return;
    if (agentTimelineLiveExecutionCoversProjectedState(
      agentTimelineEntries,
      "prepare_references",
      projectedState.phase,
      agentGenerationProjectIdentity,
    )) return;
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
      facts: projectedState.facts || [
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
    referenceHasReviewableOutput,
    referenceNeedsReview,
    referenceReviewableCount,
    referencesReadyAfterReview,
    projectFactHash,
  ]);

  useEffect(() => {
    const projectedState = videoDirectProductActionState(
      videoSendAction?.status,
      videoSendAction?.message,
      videoCanResume,
      videoSendAction?.suggestedActionLabel,
    );
    if (!projectedState) return;
    if (agentTimelineLiveExecutionCoversProjectedState(
      agentTimelineEntries,
      "submit_video",
      projectedState.phase,
      agentGenerationProjectIdentity,
    )) return;
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
      facts: projectedState.facts || [
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
    projectFactHash,
  ]);

  async function runFooterAgentVideoExecution(input: {
    action: AgentVideoExecutionAction;
    operation?: AgentVideoExecutionOperation;
    actionId: string;
    confirmationReceiptId: string;
    timeoutMs: number;
    perform: (context: AgentVideoExecutionContext) => unknown | Promise<unknown>;
  }) {
    return agentVideoExecutionController.runFooterExecution({
      ...input,
      plan: agentCurrentTaskPipelinePlan,
      generatedAt: new Date().toISOString(),
    });
  }

  async function runConfirmedAgentTool(
    action: DirectorAgentActionEnvelope | undefined,
    userIntent: string,
    preparedHandoff?: DirectorAgentToolHandoff,
    options: { retry?: boolean; projectFactHash?: string } = {},
  ): Promise<ConfirmedAgentToolRunOutcome> {
    const confirmedToolVideoPermissionContract = agentVideoPermissionContractForAction(
      action,
      activeVideoPermissionContract,
    );
    const preStagedActionJob = action
      ? [...agentVideoExecutionLedgerRef.current.jobs].reverse().find((job) => job.actionId === action.actionId && job.status === "staged")
      : undefined;
    const actionPinnedToDryRun = preStagedActionJob?.executionMode === "dry_run";
    const referenceLive = Boolean(
      action?.kind === "prepare_reference_generation"
      && action.executionContract.referenceGenerationAllowed
      && onCreateP6RealSample
      && realSampleAction?.keyConfigured
      && !realSampleAction.disabled
      && !realSampleBusy,
    );
    const videoLive = Boolean(
      action?.kind === "prepare_video_submit"
      && !actionPinnedToDryRun
      && action.executionContract.videoSubmitAllowed
      && onSendSeedanceVideo
      && videoSendAction?.keyConfigured
      && videoSendAction.ready
      && !videoSendAction.disabled
      && !videoBusy,
    );
    const queryLive = Boolean(action?.kind === "query_video_result" && onSendSeedanceVideo && videoCanResume && !videoBusy);
    const exportLive = Boolean(action?.kind === "prepare_export" && onRunExport);
    return runAgentVideoConfirmedProductAction({
      controller: agentVideoExecutionController,
      plan: agentCurrentTaskPipelinePlan,
      action,
      userIntent,
      preparedHandoff,
      projectFactHash: options.projectFactHash,
      retry: options.retry,
      productAdapter: {
        availability: currentAgentToolAvailability(action),
        recoveryHint: videoSendAction?.message,
        videoPermissionContract: confirmedToolVideoPermissionContract,
        webSearchSettings,
        setStatus,
        setAgentToolHandoff,
        setResearchStatus,
        setReferenceStatus,
        setResearchResult,
      },
      references: {
        live: referenceLive,
        perform: onCreateP6RealSample
          ? (target, signal) => onCreateP6RealSample({ ...target, signal })
          : undefined,
      },
      video: {
        live: videoLive,
        perform: onSendSeedanceVideo
          ? (target, signal) => onSendSeedanceVideo({ ...target, signal })
          : undefined,
      },
      videoQuery: {
        live: queryLive,
        perform: onSendSeedanceVideo
          ? (target, signal) => onSendSeedanceVideo({ ...target, signal })
          : undefined,
      },
      exportProject: {
        live: exportLive,
        perform: onRunExport
          ? (target, signal, context) => onRunExport({
              agentToolTrace: target?.agentToolTrace,
              signal,
              exportExecutionReceipt: context.receipt,
            })
          : undefined,
      },
    });
  }

  async function confirmPlan() {
    if (!workflow) return;
    const canConfirmFeedback = Boolean(
      directorFeedbackCanConfirm(feedbackRecompile)
      && onDirectorFeedbackConfirmed,
    );
    const preStagedGenerationPrompt = agentActionEnvelope
      ? [...agentVideoExecutionLedgerRef.current.jobs].reverse().find((job) => (
        job.actionId === agentActionEnvelope.actionId
        && job.status === "staged"
        && job.executionMode === "dry_run"
      ))?.prompt
      : undefined;
    const preparedUserIntent = preStagedGenerationPrompt?.trim()
      || preparedContext?.userIntent?.trim()
      || await composerIntentFromInput(text, attachments);
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
        const feedbackSavedToLocalProject = agentVisibleProjectReadyForTools;
        const savedFeedbackRun: PrototypeAgentDemoRun = {
          status: "ready",
          result: {
            label: feedbackSavedToLocalProject ? "修改计划已写入项目" : "修改已加入草案",
            projectVibeAdded: true,
            projectTemporaryUpdated: !feedbackSavedToLocalProject,
            projectSaved: feedbackSavedToLocalProject,
            storageLabel: feedbackSavedToLocalProject ? "已保存到项目" : "待选择保存位置",
            projectTaskLabel: feedbackSavedToLocalProject ? undefined : "选择保存位置",
            waitingReview: false,
            status: "ready",
          },
        };
        setLocalPrototypeAgentDemo(savedFeedbackRun);
        if (agentActionEnvelope) {
          rememberConfirmedToolOutcome(agentActionEnvelope, {
            status: "completed",
            label: savedFeedbackRun.result?.label || "修改计划已写入项目",
            projectRecordPreserved: feedbackSavedToLocalProject,
            waitingReview: false,
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
        availability: currentAgentToolAvailability(agentActionEnvelope),
        referenceReadyCount: referenceReadyCountForAgent,
        referenceReviewCount: referenceReviewCountForAgent,
        referenceMissingCount: referenceMissingCountForAgent,
      });
      if (previewResult?.agentTimelineEntries?.length) {
        setAgentTimelineEntries(previewResult.agentTimelineEntries);
      }
      if (previewResult?.agentKernelTurn) {
        setLatestAgentKernelTurn(previewResult.agentKernelTurn);
      }
      if (previewResult?.projectFactHash) {
        agentGenerationProjectIdentityRef.current = {
          ...agentGenerationProjectIdentityRef.current,
          projectFactHash: previewResult.projectFactHash,
        };
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
      const rawToolRunOutcome = await runConfirmedAgentTool(
        authoritativeAgentActionEnvelope,
        userIntent,
        authoritativeAgentToolHandoff,
        { projectFactHash: previewResult?.projectFactHash },
      );
      const toolRunOutcome = confirmedProjectWriteOutcomeForLocalState(rawToolRunOutcome, authoritativeAgentToolHandoff, agentVisibleProjectReadyForTools);
      rememberConfirmedToolOutcome(authoritativeAgentActionEnvelope, toolRunOutcome);
      const confirmedRun = confirmedToolRunResult(authoritativeAgentToolHandoff, toolRunOutcome, previewResult || undefined, agentVisibleProjectReadyForTools);
      setLocalPrototypeAgentDemo(confirmedRun);
      await clearCompletedAgentStagedPlan(toolRunOutcome);
      if (authoritativeAgentActionEnvelope) {
        rememberConfirmedAgentActionLogItem(
          agentActionLogItemFromResult(authoritativeAgentActionEnvelope, authoritativeAgentToolHandoff, confirmedRun, "confirmed"),
        );
      }
    } catch (error) {
      console.error("Confirmed Agent action failed", error);
      if (!toolExecutionStarted && confirmedAgentToolHandoff?.status === "ready" && agentActionEnvelope) {
        rememberConfirmedToolStart(agentActionEnvelope);
        const rawToolRunOutcome = await runConfirmedAgentTool(agentActionEnvelope, userIntent, confirmedAgentToolHandoff);
        const toolRunOutcome = confirmedProjectWriteOutcomeForLocalState(rawToolRunOutcome, confirmedAgentToolHandoff, agentVisibleProjectReadyForTools);
        rememberConfirmedToolOutcome(agentActionEnvelope, toolRunOutcome);
        const fallbackRun = confirmedToolRunResult(confirmedAgentToolHandoff, toolRunOutcome, undefined, agentVisibleProjectReadyForTools);
        setLocalPrototypeAgentDemo(fallbackRun);
        await clearCompletedAgentStagedPlan(toolRunOutcome);
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

  async function confirmRestoredProjectEditFromMessage(message: MinimalAgentMessage) {
    const restoredDraft = restoredAgentStagedPlanDraft?.status === "active"
      && restoredAgentStagedPlanDraft.action
      && minimalAgentMessageIsProjectDraftEdit(message)
      && (!message.actionId || restoredAgentStagedPlanDraft.action.actionId === message.actionId)
      ? restoredAgentStagedPlanDraft
      : undefined;
    const action = restoredDraft?.action || agentActionEnvelope;
    if (!action || !agentActionIsProjectDraftEdit(action)) {
      setStatus("需要重新整理这条修改");
      return;
    }
    const confirmedHandoff = buildConfirmedAgentToolHandoff(action)
      || restoredDraft?.toolHandoff
      || agentToolHandoff;
    if (!confirmedHandoff) {
      setStatus("需要重新整理这条修改");
      return;
    }
    const userIntent = restoredDraft?.userIntent?.trim()
      || preparedContext?.userIntent?.trim()
      || action.sourceContext.userIntent
      || agentMessageConfirmationIntent(message, minimalAgentConfirmationAction(message, "确认修改").label);
    setStatus("正在保存修改");
    setAgentToolHandoff(confirmedHandoff);
    setLocalPrototypeAgentDemo({ status: "running", result: { projectVibeAdded: true, waitingReview: true } });
    rememberConfirmedToolStart(action);
    try {
      const rawToolRunOutcome = await runConfirmedAgentTool(action, userIntent, confirmedHandoff);
      const toolRunOutcome = confirmedProjectWriteOutcomeForLocalState(rawToolRunOutcome, confirmedHandoff, agentVisibleProjectReadyForTools);
      rememberConfirmedToolOutcome(action, toolRunOutcome);
      const confirmedRun = confirmedToolRunResult(confirmedHandoff, toolRunOutcome, undefined, agentVisibleProjectReadyForTools);
      setLocalPrototypeAgentDemo(confirmedRun);
      await clearCompletedAgentStagedPlan(toolRunOutcome);
      rememberConfirmedAgentActionLogItem(
        agentActionLogItemFromResult(action, confirmedHandoff, confirmedRun, "confirmed"),
      );
    } catch (error) {
      console.error("Restored project edit confirmation failed", error);
      const errorMessage = error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "修改保存失败，项目已保留。";
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
      rememberConfirmedToolOutcome(action, {
        status: "failed",
        label: errorMessage,
        projectRecordPreserved: true,
        waitingReview: true,
        previewReady: false,
      });
      rememberConfirmedAgentActionLogItem(
        agentActionLogItemFromResult(action, confirmedHandoff, failedRun, "confirmed"),
      );
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
      const rawToolRunOutcome = await runConfirmedAgentTool(agentActionEnvelope, userIntent, refreshedHandoff, { retry: true });
      const toolRunOutcome = confirmedProjectWriteOutcomeForLocalState(rawToolRunOutcome, refreshedHandoff, agentVisibleProjectReadyForTools);
      rememberConfirmedToolOutcome(agentActionEnvelope, toolRunOutcome);
      const retryRun = confirmedToolRunResult(refreshedHandoff, toolRunOutcome, undefined, agentVisibleProjectReadyForTools);
      setLocalPrototypeAgentDemo(retryRun);
      await clearCompletedAgentStagedPlan(toolRunOutcome);
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
  const visibleComposerInputText = currentComposerTextValue();
  if (visibleComposerInputText) lastVisibleComposerInputRef.current = visibleComposerInputText;
  const hasComposerInput = Boolean(visibleComposerInputText || attachments.length);
  const visibleComposerDomInputText = text.trim();
  const hasVisibleComposerInput = Boolean(visibleComposerDomInputText || attachments.length);
  const composerContinueIntent = Boolean(visibleComposerInputText && isContinueIntent(visibleComposerInputText));
  const hasPreparedComposerInput = Boolean(preparedContext?.userIntent?.trim() || hasComposerInput);
  const canPreviewPrototypeDemo = Boolean(workflow && onPreviewPrototypeAgentDemo && hasPreparedComposerInput && !canConfirmFeedback && !readOnlyStatusInspection);
  const canOfferFooterDirectAction = !hasComposerInput && !isPreparingPlan && (!workflow || planPhase === "confirmed");
  const hasReferenceItemsToReview = referenceHasReviewableOutput;
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
  const referenceFooterAction = showRealSampleAction && !referenceGenerationDeferredByCreator && !referenceExecutionSatisfiedForAgent && realSampleAction?.status !== "verified"
    ? {
        label: realSampleLabel,
        disabled: referenceGenerationBlockedByProject || (!referenceGenerationBlockedByContract && (Boolean(realSampleAction?.disabled) || !realSampleAction?.keyConfigured || realSampleBusy || !onCreateP6RealSample)),
        disabledReason: referenceGenerationBlockedByProject
          ? "先选择保存位置。"
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
          ? "先选择保存位置。"
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
        disabledReason: videoPermissionBlockedByProject ? "先选择保存位置。" : videoBusy ? "正在查询视频。" : "当前还不能查询视频。",
        perform: runFooterVideoAction,
      }
    : undefined;
  const videoSubmitFooterAction = showVideoAction && videoSendAction && videoSendAction.status !== "needs_review"
    ? {
        label: videoActionLabel,
        disabled: videoPermissionBlockedByProject || videoSubmissionBlocked || (!videoPermissionBlockedByContract && (Boolean(videoSendAction.disabled) || !videoSendAction.ready || !videoSendAction.keyConfigured || videoBusy || (videoAlreadySent && !videoCanResume) || !onSendSeedanceVideo)),
        disabledReason: videoPermissionBlockedByProject
          ? "先选择保存位置。"
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
  const exportFooterAction = exportReadyForConfirmation
    ? {
        label: "导出交付包",
        disabled: !localProjectReadyForTools || !onRunExport,
        disabledReason: !localProjectReadyForTools
          ? "先选择保存位置。"
          : "当前还不能导出交付包。",
        perform: () => {
          setStatus("正在导出交付包。");
          void runFooterAgentVideoExecution({
            action: "export",
            actionId: "footer_project_export",
            confirmationReceiptId: "footer_action_export",
            timeoutMs: 2 * 60 * 1000,
            perform: (context) => onRunExport?.({
              signal: context.signal,
              exportExecutionReceipt: context.receipt,
            }),
          });
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
  const exportFooterActionTakesPriority = Boolean(exportResultIsPrimary && exportFooterAction && !hasComposerInput);
  const footerDirectAction = exportFooterActionTakesPriority
    ? exportFooterAction
    : canOfferFooterDirectAction
    ? availableFooterDirectAction
    : undefined;
  function footerDirectActionBoundaryFor(action?: typeof availableFooterDirectAction) {
    if (!action) return "";
    if (
      referenceGenerationBlockedByContract
      && (action.label === realSampleLabel || action.label === endFrameLabel)
    ) {
      return "确认前不会生成参考；点消息里的确认才会开始。";
    }
    if (videoPermissionBlockedByContract && action.label === videoActionLabel) {
      return "确认前不会提交视频；点消息里的确认才会发送。";
    }
    if (action === exportFooterAction) {
      return "确认前不会导出；点消息里的确认才会生成交付包。";
    }
    return "";
  }
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
  const footerDirectActionBoundaryNotice = projectRequiredForWorkflow || projectBlockedWithoutFooterResolver
    ? ""
    : footerDirectActionBoundaryFor(footerDirectAction);
  const stateAwareAgentTimelineEntries = useMemo(
    () => visibleAgentTimelineEntries.filter((entry) =>
      !minimalAgentReferenceReviewMessageIsPremature(minimalAgentMessageFromTimelineEntry(entry), referenceHasReviewableOutput)
    ),
    [visibleAgentTimelineEntries, referenceHasReviewableOutput],
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
    () => latestVisibleTimelineConfirmationMessage(stateAwareAgentTimelineEntries, referenceExecutionSatisfiedForAgent, restoredReferenceGenerationActionId),
    [referenceExecutionSatisfiedForAgent, restoredReferenceGenerationActionId, stateAwareAgentTimelineEntries],
  );
  const latestTimelineConfirmationMessage = useMemo(
    () => latestVisibleTimelineConfirmationMessage(agentTimelineEntries, referenceExecutionSatisfiedForAgent, restoredReferenceGenerationActionId),
    [agentTimelineEntries, referenceExecutionSatisfiedForAgent, restoredReferenceGenerationActionId],
  );
  const latestProjectEditTimelineConfirmationMessage = useMemo(
    () => latestPendingProjectEditConfirmationMessage(agentTimelineEntries),
    [agentTimelineEntries],
  );
  const latestNewVideoDraftCommitted = isCommittedNewVideoDraftAgentRun(latestPrototypeAgentDemo);
  const projectStoryAlreadyCommittedForDraftConfirmation = runtimeState.storyFlow.shots.length > 0;
  const currentTimelineConfirmationLabel = visibleTimelineConfirmationMessage
    ? minimalAgentConfirmationAction(visibleTimelineConfirmationMessage, NEW_VIDEO_DRAFT_CONFIRM_LABEL).label
    : "";
  const activeProjectEditConfirmationMessage = [
    visibleTimelineConfirmationMessage,
    latestTimelineConfirmationMessage,
    latestProjectEditTimelineConfirmationMessage,
  ]
    .find((message): message is MinimalAgentMessage => Boolean(
      message
      && minimalAgentMessageIsWaitingConfirmation(message)
      && minimalAgentMessageIsStructuredProjectDraftEdit(message),
    ));
  const activeProjectEditConfirmationLabel = activeProjectEditConfirmationMessage
    ? minimalAgentConfirmationAction(activeProjectEditConfirmationMessage, "确认修改").label
    : "";
  const hasAgentTimelineConfirmation = Boolean(visibleTimelineConfirmationMessage);
  const composerEditingPendingConfirmation = Boolean(
    hasVisibleComposerInput
      && (
        (visibleTimelineConfirmationMessage && currentTimelineConfirmationLabel)
        || composerEditingConfirmationLabel
        || editingSkillSaveConfirmationActive
        || (
          restoredAgentStagedPlanDraft?.status === "active"
          && (
            restoredAgentStagedPlanDraft.blockedReasons.includes("user_confirmation_required")
            || restoredAgentStagedPlanDraft.toolHandoff?.blockers.includes("user_confirmation_required")
          )
        )
      )
  );
  useEffect(() => {
    onEditingPendingConfirmationChange?.(composerEditingPendingConfirmation);
    return () => onEditingPendingConfirmationChange?.(false);
  }, [composerEditingPendingConfirmation, onEditingPendingConfirmationChange]);
  const timelineNewVideoDraftConfirmationReady = Boolean(
    !latestNewVideoDraftCommitted
      && !projectStoryAlreadyCommittedForDraftConfirmation
      && !newVideoDraftBusyForAgent
      && visibleTimelineConfirmationMessage
      && agentCurrentTaskMessageIsStructuredNewVideoDraftConfirmation(visibleTimelineConfirmationMessage),
  );
  const visibleNewVideoDraftConfirmation = timelineNewVideoDraftConfirmationReady;
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
      if (projectObservation && !referencesUsableForAgent && !timelineShowsReferenceReady && !timelineHasReferenceValidation && !timelineShowsVideoReady && !timelineHasVideoValidation) return projectObservation;
      return buildProjectObservation({
        localProjectReady: localProjectReadyForTools,
        projectTitle: runtimeState.project.title,
        sectionCount: runtimeState.storyFlow.sections.length,
        shotCount: runtimeState.storyFlow.shots.length,
        selectedShotCount: selectedShotCountForObservation,
        referenceMissingCount,
        referenceReviewCount: referencesUsableForAgent ? 0 : Math.max(referenceReviewCountForAgent, composerProjectInbox.needsReviewCount),
        referenceReadyCount: referenceReadyCountForAgent,
        videoStatus: videoReviewCountForAgent > 0
          ? "needs_review"
          : videoReturnedCountForAgent > 0
            ? "approved"
            : videoSendAction?.status || "not_generated",
        videoStatusLabel: videoReviewCountForAgent > 0
          ? "视频待复核"
          : videoReturnedCountForAgent > 0
            ? "视频已通过预览审查"
            : videoSendAction?.suggestedActionLabel || "未发送视频",
        videoDetail: videoSendAction?.message || "",
        videoWaitingCount: videoReturnedCountForAgent === 0 && videoSendAction?.status === "submitted" ? 1 : 0,
        videoCompletedCount: videoReturnedCountForAgent,
        videoReviewCount: videoReviewCountForAgent,
        videoCanResume,
        image2Running: realSampleBusy || endFrameBusy,
        referenceExecutionValidated: timelineHasReferenceValidation,
        videoExecutionValidated: timelineHasVideoValidation,
        inbox: composerProjectInbox,
      });
    },
    [
      composerProjectInbox,
      endFrameBusy,
      localProjectReadyForTools,
      projectObservation,
      realSampleBusy,
      referenceMissingCountForAgent,
      referenceMissingCount,
      referenceReadyCountForAgent,
      referenceReviewCountForAgent,
      referencesUsableForAgent,
      runtimeState.project.title,
      runtimeState.storyFlow.sections.length,
      runtimeState.storyFlow.shots.length,
      selectedShotCountForObservation,
      timelineShowsVideoReady,
      timelineHasReferenceValidation,
      timelineHasVideoValidation,
      timelineShowsReferenceReady,
      videoCanResume,
      videoReturnedCountForAgent,
      videoReviewCountForAgent,
      videoSendAction?.message,
      videoSendAction?.status,
      videoSendAction?.suggestedActionLabel,
    ],
  );
  const composerIntentRoute = routeProjectAgentIntent({
    text,
    hasSelection: storyReferencePlanOnlyIntentActive || referencePlanningContinueIntentActive ? false : hasActiveSelection,
    hasAttachments: attachments.length > 0,
    observation: composerProjectObservation,
  });
  const composerIntentCanStartNewVideoWithoutProject = Boolean(
    visibleComposerInputText
      && !currentProjectHasStoryContext
      && directorIntentCanStartNewVideoPlanningWithoutProject(visibleComposerInputText)
  );
  const composerIntentNeedsLocalProject = Boolean(
    visibleComposerInputText
      && (
        !localProjectReadyForTools
        || projectRequiredForWorkflow
        || projectBlockedWithoutFooterResolver
      )
      && !composerIntentCanStartNewVideoWithoutProject
      && intentNeedsLocalProjectBeforeTooling(visibleComposerInputText)
  );
  const composerReadyDraftInputText = visibleComposerInputText.trim();
  const composerReadyDraftRequestedShotCount = requestedStoryboardShotCountFromIntent(composerReadyDraftInputText);
  const visibleExplicitAgentSelectionContext = newVideoAgentSelectionContext || explicitAgentSelectionContextFromTimeline(
    mergeVibeAgentTimelineEntries(visibleAgentTimelineEntries, restoredAgentTimelineEntries || []),
  );
  const composerReadyDraftSelectedShotTarget = readyDraftSelectedShotTargetFromAgentContext(visibleExplicitAgentSelectionContext);
  const composerReadyDraftTargetShotRevision = !composerReadyDraftRequestedShotCount
    ? readyDraftTargetShotRevisionFromIntent(composerReadyDraftInputText, newVideoDraftShotCountForAgent, composerReadyDraftSelectedShotTarget)
    : undefined;
  const composerReadyDraftTargetsExistingShot = !composerReadyDraftRequestedShotCount
    && Boolean(composerReadyDraftTargetShotRevision || /第\s*(?:[0-9０-９]{1,3}|一|二|两|俩|三|四|五|六|七|八|九|十|十[一二两俩三四五六七八九]|[一二两俩三四五六七八九]十[一二两俩三四五六七八九]?)\s*(?:个|条|段)?\s*(?:镜头|分镜|视频段|片段|段落|幕)/u.test(composerReadyDraftInputText));
  const composerInputIsPermissionControlOnly = Boolean(
    composerReadyDraftInputText
      && !attachments.length
      && isDirectorAgentPermissionControlOnlyIntent(composerReadyDraftInputText)
  );
  const composerReferenceGenerationFromReferencePlan = Boolean(
    (
      !composerInputIsPermissionControlOnly
      && composerIntentRoute.kind === "reference"
      && composerIntentRoute.confirmation === "reference_generation"
      && referencePlanningGenerationRequestText(composerReadyDraftInputText)
    )
    || (
      composerContinueIntent
      && !attachments.length
      && currentProjectHasStoryContext
      && composerProjectObservation.currentTask.confirmation.kind === "reference_generation"
      && (referencePlanningFocusEntry || savedStoryReferencePlanStatusActive)
    ),
  );
  const composerPurePermissionContract = composerReadyDraftInputText
    && !composerReferenceGenerationFromReferencePlan
    && composerInputIsPermissionControlOnly
    ? detectAgentVideoPermissionContract(composerReadyDraftInputText, activeVideoPermissionContract)
    : undefined;
  const composerReadyDraftPermissionContract = composerPurePermissionContract && activeNewVideoDraftConfirmation
    ? composerPurePermissionContract
    : undefined;
  const composerPermissionContract = composerPurePermissionContract;
  const composerToolIntentShouldYieldToProjectEditConfirmation = Boolean(
    visibleComposerInputText
      && activeProjectEditConfirmationMessage
      && activeProjectEditConfirmationLabel
      && intentRequestsToolOrExportWork(visibleComposerInputText)
      && !composerPermissionContract
  );
  const composerPermissionLabel = composerPermissionContract
    ? agentVideoPermissionDisplayLabel(composerPermissionContract, composerReadyDraftInputText)
    : "";
  const composerReadyDraftPermissionLabel = composerReadyDraftPermissionContract
    ? agentVideoPermissionDisplayLabel(composerReadyDraftPermissionContract, composerReadyDraftInputText)
    : "";
  const composerPermissionContentScope = activeNewVideoDraftConfirmation
    ? composerReadyDraftRequestedShotCount
      ? `草案会重排为 ${composerReadyDraftRequestedShotCount} 个镜头`
      : `草案仍保持 ${newVideoDraftShotCountForAgent ? `${newVideoDraftShotCountForAgent} 个` : "当前"}镜头`
    : runtimeState.storyFlow.shots.length > 0
      ? "当前故事不改"
      : "项目内容不改";
  const composerReadyNewVideoDraftConfirmationIntent = Boolean(
    composerReadyDraftInputText
      && activeNewVideoDraftConfirmation
      && !composerIntentNeedsLocalProject
      && isNewVideoDraftConfirmationRouteIntent(composerReadyDraftInputText),
  );
  const composerReadyDraftDeferredToolIntent = Boolean(
    composerReadyDraftInputText
      && activeNewVideoDraftConfirmation
      && composerIntentNeedsLocalProject
      && !composerReadyNewVideoDraftConfirmationIntent
      && !composerPermissionContract
      && intentRequestsToolOrExportWork(composerReadyDraftInputText),
  );
  const composerReadyDraftDeferredToolLabel = composerReadyDraftDeferredToolIntent
    ? composerIntentRoute.kind === "video" || composerIntentRoute.confirmation === "video_submit"
      ? "发送视频"
      : composerIntentRoute.kind === "export" || composerIntentRoute.confirmation === "export"
        ? "导出交付包"
        : "补参考"
    : "";
  const composerReadyDraftDeferredToolStatus = composerReadyDraftDeferredToolIntent
    ? composerReadyDraftDeferredToolLabel === "导出交付包"
      ? "先确认故事：导出前需要保存位置"
      : `先确认故事：${composerReadyDraftDeferredToolLabel}前需要保存位置`
    : "";
  const composerReadyDraftDeferredToolHint = composerReadyDraftDeferredToolIntent
    ? `我理解你想${composerReadyDraftDeferredToolLabel}。点发送后先确认保存位置，只保存故事；不会生成参考、提交视频或导出。`
    : "";
  const composerReadyNewVideoDraftFeedbackIntent = Boolean(
    composerReadyDraftInputText
      && activeNewVideoDraftConfirmation
      && !composerReadyNewVideoDraftConfirmationIntent
      && !composerPermissionContract
      && !composerReadyDraftDeferredToolIntent
      && !composerIntentNeedsLocalProject
      && shouldRouteToReadyNewVideoDraft(composerReadyDraftInputText),
  );
  const composerReadyDraftFeedbackLabel = composerReadyDraftRequestedShotCount
    ? `重排为 ${composerReadyDraftRequestedShotCount} 个镜头`
    : composerReadyDraftTargetShotRevision
    ? composerReadyDraftTargetShotRevision.label
    : composerReadyDraftTargetsExistingShot
    ? "修改当前草案"
    : composerIntentRoute.kind === "revision" && composerIntentRoute.label !== "修改当前内容"
    ? composerIntentRoute.label
    : "修改当前草案";
  const composerReadyDraftFeedbackFacts = composerReadyDraftRequestedShotCount
    ? [
      { label: "范围", value: "当前草案" },
      { label: "目标镜头", value: `${composerReadyDraftRequestedShotCount} 个` },
      { label: "外部生成", value: "不会自动生成" },
    ]
    : composerReadyDraftTargetShotRevision
      ? [
	        { label: "范围", value: "当前草案" },
	        { label: "目标", value: composerReadyDraftTargetShotRevision.targetFact },
	        composerReadyDraftTargetShotRevision.changeFact ? { label: "改动", value: composerReadyDraftTargetShotRevision.changeFact } : undefined,
	        composerReadyDraftTargetShotRevision.preserveAction ? { label: "保护", value: "保留原动作" } : undefined,
	        { label: "外部生成", value: "不会自动生成" },
	      ].filter((fact): fact is { label: string; value: string } => Boolean(fact))
      : [
        { label: "范围", value: "当前草案" },
        { label: "当前镜头", value: newVideoDraftShotCountForAgent ? `${newVideoDraftShotCountForAgent} 个` : "待确认" },
        { label: "外部生成", value: "不会自动生成" },
      ];
  const composerNewStoryRequestedShotCount = visibleComposerInputText
    ? requestedStoryboardShotCountFromIntent(visibleComposerInputText)
    : 0;
  const composerNewStoryPreviewMessage: MinimalAgentMessage | undefined = (
    visibleComposerInputText
    && !currentProjectHasStoryContext
    && !activeNewVideoDraftConfirmation
    && !composerIntentNeedsLocalProject
    && !composerPermissionContract
    && !editingSkillSaveConfirmationActive
    && directorIntentCanStartNewVideoPlanningWithoutProject(visibleComposerInputText)
  )
    ? {
      id: "composer-new-story-preview",
      role: "assistant",
      title: "AI 导演：整理新故事",
      body: "我理解你要把这句话整理成新视频草案。点发送后我会先拆故事和镜头；确认前不会生成参考图，也不会发送视频。",
      facts: [
        { label: "范围", value: "新视频草案" },
        { label: "会做", value: composerNewStoryRequestedShotCount ? `整理成 ${composerNewStoryRequestedShotCount} 个镜头` : "拆故事和镜头" },
        { label: "保护", value: "不生成参考、不提交视频" },
      ],
      next: "点发送后先形成草案；草案没问题再确认。",
    }
    : undefined;
  const composerSkillSavePreviewMessage: MinimalAgentMessage | undefined = (
    editingSkillSaveConfirmationActive
    && !composerIntentNeedsLocalProject
  )
    ? {
      id: "composer-skill-save-preview",
      role: "assistant",
      title: "AI 导演：保存导演经验",
      body: "我理解你要把当前做法保存成项目 Skill。发送后会先生成保存确认卡；不确认不会写入项目 Skills，也不会生成参考或提交视频。",
      facts: [
        { label: "动作", value: "保存导演经验" },
        { label: "保存到", value: "项目 Skills" },
        { label: "保护", value: "不生成参考、不提交视频" },
      ],
      next: "点发送后先让你确认保存内容。",
    }
    : undefined;
  const composerStoryRevisionPreviewMessage: MinimalAgentMessage | undefined = (
    visibleComposerInputText
    && !activeNewVideoDraftConfirmation
    && !composerIntentNeedsLocalProject
    && !composerPermissionContract
    && !editingSkillSaveConfirmationActive
    && composerIntentRoute.kind === "revision"
  )
    ? {
      id: "composer-story-revision-preview",
      role: "assistant",
      title: `AI 导演：${composerIntentRoute.label === "修改当前内容" ? "修改故事" : composerIntentRoute.label}`,
      body: "我理解你要改当前故事或镜头。发送后我会先整理成可确认修改，不会生成参考图，也不会发送视频。",
      facts: [
        { label: "范围", value: composerIntentRoute.target === "story" ? "当前故事" : "当前选择" },
        { label: "会做", value: composerIntentRoute.label },
        { label: "外部生成", value: "不会自动生成" },
      ],
      next: "点发送后先形成修改草案；确认后才写入项目。",
    }
    : undefined;
  const composerReferenceGenerationPreviewMessage: MinimalAgentMessage | undefined = (
    visibleComposerInputText
    && composerReferenceGenerationFromReferencePlan
    && !composerIntentNeedsLocalProject
  )
    ? {
      id: "composer-reference-generation-preview",
      role: "assistant",
      title: "AI 导演：确认生成参考",
      body: "我理解你现在允许生成参考图。点发送后，我会先准备生成参考图的确认卡；不点确认不会生成参考图，也不会提交视频。",
      facts: [
        { label: "范围", value: "当前故事" },
        { label: "会发生", value: "会生成参考图" },
        { label: "保护", value: "只生成参考图，不提交视频" },
      ],
      next: "发送后在消息里确认「确认生成参考」。",
    }
    : undefined;
  const composerVideoReferencePreflightPreviewMessage: MinimalAgentMessage | undefined = (
    visibleComposerInputText
    && composerVideoIntentShouldConfirmReferencesFirst
    && !composerIntentNeedsLocalProject
  )
    ? {
      id: "composer-video-reference-preflight-preview",
      role: "assistant",
      title: "AI 导演：先补参考",
      body: "我理解你想发送视频，但当前故事还缺参考。点发送后，我会先准备生成参考的确认卡；不确认不会生成参考图，也不会提交视频。",
      facts: [
        { label: "范围", value: "当前故事" },
        { label: "先做", value: "补齐参考" },
        { label: "保护", value: "不提交视频" },
      ],
      next: "发送后先确认「确认生成参考」。",
    }
    : undefined;
  const composerReferenceGenerationSelectionChips = composerReferenceGenerationFromReferencePlan && !composerIntentNeedsLocalProject
      ? [
        { label: "范围", value: "当前故事" },
        { label: "参考", value: projectObservation?.references.label || "参考不完整" },
        { label: "保护", value: "确认后生成参考图，不提交视频" },
      ]
    : [];
  const composerLocalProjectHint = canCreateProjectFromFooter
    ? "点发送后，我会先让你确认保存位置；这一步只选择保存位置，不会生成参考、提交视频或导出。"
    : "点发送后，我会先说明需要保存位置；你仍可继续改文字。";
  const preparedProjectEditCanConfirmWithoutLocalProject = Boolean(
    agentActionIsProjectDraftEdit(agentActionEnvelope)
    && workflowCanConfirm(workflow)
  );
  const canContinuePendingNewVideoDraft = Boolean(
    newVideoDraftPendingForAgent
      && onContinueNewVideoDraftFromAgent
      && !hasComposerInput
      && !attachments.length,
  );
  const statusReadyNewVideoDraftConfirmation = Boolean(
    !latestNewVideoDraftCommitted
      && !projectStoryAlreadyCommittedForDraftConfirmation
      && !newVideoDraftBusyForAgent
      && !visibleTimelineConfirmationMessage
      && newVideoDraftReadyForAgent,
  );
  const footerNewVideoDraftConfirmationReady = Boolean(
    !latestNewVideoDraftCommitted
      && (
        timelineNewVideoDraftConfirmationReady
        || statusReadyNewVideoDraftConfirmation
      ),
  );
  const footerNewVideoDraftConfirmationLabel = footerNewVideoDraftConfirmationReady
    ? currentTimelineConfirmationLabel && isNewVideoDraftConfirmationLabel(currentTimelineConfirmationLabel)
      ? currentTimelineConfirmationLabel
      : NEW_VIDEO_DRAFT_CONFIRM_LABEL
    : "";
  const agentCurrentTaskPipelinePlan = useMemo(
    () => buildAgentVideoPipelinePlan({
      planId: "minimal_agent_current_task",
      storyDraftPresent: Boolean(
        newVideoDraftReadyForAgent
          || newVideoDraftShotCountForAgent > 0
          || runtimeState.storyFlow.shots.length > 0
      ),
      storyConfirmed: Boolean(
        runtimeState.storyFlow.shots.length > 0
          && !newVideoDraftReadyForAgent
          && !newVideoDraftPendingForAgent
          && !newVideoDraftPlanningForAgent
      ),
      localProjectReady: localProjectReadyForTools,
      referenceMissingCount: referenceMissingCountForAgent,
      videoSubmitted: videoSubmittedForAgent,
      videoNeedsQuery: videoQueryMode,
    }),
    [
      localProjectReadyForTools,
      newVideoDraftPendingForAgent,
      newVideoDraftPlanningForAgent,
      newVideoDraftReadyForAgent,
      newVideoDraftShotCountForAgent,
      referenceMissingCountForAgent,
      runtimeState.storyFlow.shots.length,
      videoQueryMode,
      videoSubmittedForAgent,
    ],
  );
  const agentCurrentTaskTimelineConfirmations = useMemo(
    () => {
      const timelineMessages = visibleAgentTimelineEntries.map(minimalAgentMessageFromTimelineEntry);
      return visibleAgentTimelineEntries
        .map((entry, index) => {
          const confirmation = agentCurrentTaskConfirmationFromTimelineEntry(
            entry,
            minimalAgentConfirmationExecutionModeForCapabilities(timelineMessages[index]!, {
              referenceLiveAdapterReady,
              videoLiveAdapterReady,
              queryVideoLiveAdapterReady,
              exportLiveAdapterReady,
            }),
          );
          if (!confirmation) return undefined;
          const message = timelineMessages[index];
          if (message && minimalAgentConfirmationMessageIsStaleAfterLaterResult(timelineMessages, message)) return undefined;
          return confirmation;
        })
        .filter((confirmation): confirmation is AgentCurrentTaskConfirmation => Boolean(confirmation));
    },
    [
      exportLiveAdapterReady,
      queryVideoLiveAdapterReady,
      referenceLiveAdapterReady,
      videoLiveAdapterReady,
      visibleAgentTimelineEntries,
    ],
  );
  const agentCurrentTaskRecoveryTimelineEntries = useMemo(
    () => mergeVibeAgentTimelineEntries(agentTimelineEntries, restoredAgentTimelineEntries || []),
    [agentTimelineEntries, restoredAgentTimelineEntries],
  );
  const agentCurrentTaskCompletedSteps = useMemo(
    () => agentCurrentTaskCompletedStepsFromTimelineEntries(agentCurrentTaskRecoveryTimelineEntries, agentGenerationProjectIdentity),
    [
      agentCurrentTaskRecoveryTimelineEntries,
      agentGenerationProjectIdentity.projectFactHash,
      agentGenerationProjectIdentity.projectId,
      agentGenerationProjectIdentity.projectRoot,
    ],
  );
  const agentCurrentTaskProjection = useMemo(
    () => buildAgentCurrentTaskProjection({
      newVideoDraft: {
        status: newVideoDraftReadyForAgent
          ? "ready"
          : newVideoDraftPlanningForAgent || newVideoDraftPendingForAgent
            ? "planning"
            : latestNewVideoDraftCommitted
              ? "confirmed"
              : "empty",
        title: footerNewVideoDraftConfirmationLabel || NEW_VIDEO_DRAFT_CONFIRM_LABEL,
        confirmationId: visibleNewVideoDraftConfirmation ? visibleTimelineConfirmationMessage?.id : undefined,
        draftShotCount: newVideoDraftShotCountForAgent,
        facts: newVideoDraftShotCountForAgent ? [{ label: "镜头", value: `${newVideoDraftShotCountForAgent} 个` }] : undefined,
      },
      projectStatus: projectStatusView,
      projectObservation: composerProjectObservation,
      intentRoute: {
        kind: composerIntentRoute.kind,
        label: composerIntentRoute.label,
        confirmation: composerIntentRoute.confirmation,
        plan: composerIntentRoute.plan,
      },
      timelineConfirmations: agentCurrentTaskTimelineConfirmations,
      restoredStagedPlan: agentCurrentTaskStagedPlanRestoreFromDraft(restoredAgentStagedPlanDraft),
      pipelinePlan: agentCurrentTaskPipelinePlan,
      jobLedger: agentVideoDryRunLedger,
      currentProjectId: runtimeState.sourceIndex.projectId,
      currentProjectRoot: localProjectReadyForTools ? runtimeState.project.root : undefined,
      currentProjectFactHash: projectFactHash,
      completedSteps: agentCurrentTaskCompletedSteps,
      referenceReviewCount: referenceReviewCountForAgent,
      videoReviewCount: videoReviewCountForAgent,
      reviewVersionPair: reviewVersionPair && activeReviewVersionCandidate
        ? {
            pairId: reviewVersionPair.pairId,
            shotId: reviewVersionPair.shotId,
            activeVersion: activeReviewVersion,
            activeJobId: activeReviewVersionCandidate.identity.jobId,
            activeActionId: activeReviewVersionCandidate.identity.actionId,
        }
        : undefined,
      reviewSelection: {
        status: reviewSelectionProjection.status,
        winnerVersion: reviewSelectionProjection.winnerVersion,
        selectionReceiptId: reviewSelectionProjection.selectionReceipt?.receiptId,
        selectionConfirmation: reviewSelectionProjection.selectionConfirmation
          ? {
              confirmationId: reviewSelectionProjection.selectionConfirmation.confirmationId,
              actionId: reviewSelectionProjection.selectionConfirmation.actionId,
            }
          : undefined,
        promotionConfirmation: reviewSelectionProjection.promotionConfirmation
          ? {
              confirmationId: reviewSelectionProjection.promotionConfirmation.confirmationId,
              actionId: reviewSelectionProjection.promotionConfirmation.actionId,
            }
          : undefined,
        blockers: reviewSelectionProjection.blockers,
      },
      facts: projectStatusView?.facts,
    }),
    [
      agentCurrentTaskCompletedSteps,
      agentCurrentTaskPipelinePlan,
      agentCurrentTaskTimelineConfirmations,
      agentVideoDryRunLedger,
      composerIntentRoute.confirmation,
      composerIntentRoute.kind,
      composerIntentRoute.label,
      composerIntentRoute.plan,
      composerProjectObservation,
      footerNewVideoDraftConfirmationLabel,
      latestNewVideoDraftCommitted,
      newVideoDraftPendingForAgent,
      newVideoDraftPlanningForAgent,
      newVideoDraftReadyForAgent,
      newVideoDraftShotCountForAgent,
      projectStatusView,
      projectFactHash,
      referenceReviewCountForAgent,
      reviewVersionPair,
      activeReviewVersion,
      activeReviewVersionCandidate,
      reviewSelectionProjection,
      videoReviewCountForAgent,
      runtimeState.project.root,
      runtimeState.sourceIndex.projectId,
      restoredAgentStagedPlanDraft,
      visibleTimelineConfirmationMessage?.id,
      visibleNewVideoDraftConfirmation,
    ],
  );
  const agentDirectorProposal = useMemo(() => {
    const action = agentActionEnvelope?.status === "staged"
      ? agentActionEnvelope
      : restoredAgentStagedPlanDraft?.status === "active" && restoredAgentStagedPlanDraft.action?.status === "staged"
        ? restoredAgentStagedPlanDraft.action
        : undefined;
    if (
      !action
      || action.toolPlan.toolName !== "project_vibe_patch"
      || !activeProjectEditConfirmationMessage
      || activeProjectEditConfirmationMessage.actionId !== action.actionId
    ) return undefined;
    return {
      actionId: action.actionId,
      confirmationId: activeProjectEditConfirmationMessage.id,
      confirmationActionId: activeProjectEditConfirmationMessage.actionId,
      summary: action.summary,
      message: action.userFacingMessage,
      targetLabel: action.target.label,
      proposedChanges: action.proposedChanges,
    };
  }, [activeProjectEditConfirmationMessage, agentActionEnvelope, restoredAgentStagedPlanDraft]);
  const reviewTargetIdentity = minimalAgentReviewTargetIdentity(effectiveReviewTarget);
  useEffect(() => {
    setReviewDecisionStatus("idle");
  }, [reviewTargetIdentity.key]);
  useEffect(() => {
    setReviewHistoryOpen(false);
  }, [activeDirectorClarificationTurn?.id, activeDirectorReviewRegenerationConfirmation?.confirmationId, activeDirectorReviewRegenerationProposal?.proposalId, activeDirectorReviewRevisionIntent?.intentId, agentDirectorProposal?.actionId, reviewTargetIdentity.key]);
  useEffect(() => {
    onCurrentTaskProjectionChange?.(agentCurrentTaskProjection);
  }, [agentCurrentTaskProjection, onCurrentTaskProjectionChange]);
  useEffect(() => () => {
    onCurrentTaskProjectionChange?.(undefined);
  }, [onCurrentTaskProjectionChange]);
  function footerDirectActionStepFor(action?: typeof availableFooterDirectAction): AgentCurrentTaskStep | undefined {
    if (!action) return undefined;
    if (
      action === referenceReviewFooterAction
      || action === videoBlockedRecoveryFooterAction
      || action === referenceFooterAction
      || action === endFrameFooterAction
    ) {
      return "prepare_references";
    }
    if (action === videoSubmitFooterAction || action === videoResumeFooterAction) return "submit_video";
    if (action === exportFooterAction) return "export";
    return undefined;
  }
  const footerDirectActionStep = footerDirectActionStepFor(footerDirectAction);
  const projectedFooterDirectAction = footerDirectAction && (
    footerDirectActionStep === agentCurrentTaskProjection.step
    || (!footerDirectActionStep && agentCurrentTaskProjection.step === "idle")
  )
    ? footerDirectAction
    : undefined;
  const preparedAgentConfirmationCanDispatch = canConfirm || canPreviewPrototypeDemo || canConfirmFeedback;
  const preparedAgentConfirmationOwnsPrimaryAction = Boolean(
    agentActionEnvelope?.requiresUserConfirmation
      && preparedAgentConfirmationCanDispatch,
  );
  const projectedBlockerReason = agentCurrentTaskProjection.blockers[0] || "";
  const primaryOperation = (() => {
    if (
      agentCurrentTaskProjection.source === "pipeline_job"
      && !agentCurrentTaskProjection.requiresConfirmation
    ) {
      const disabledReason = projectedBlockerReason || `${agentCurrentTaskProjection.label}正在执行。`;
      return {
        label: agentCurrentTaskProjection.label,
        disabled: true,
        disabledReason,
        statusLine: disabledReason,
        perform: () => undefined,
      };
    }
    if (agentCurrentTaskProjection.step === "draft_story" && newVideoDraftPlanningForAgent) {
      const disabledReason = "AI 正在拆镜头，等草案出来后再继续。";
      return {
        label: agentCurrentTaskProjection.label,
        disabled: true,
        disabledReason,
        statusLine: disabledReason,
        perform: () => undefined,
      };
    }
    if (agentCurrentTaskProjection.step === "choose_save_location") {
      const disabled = Boolean(!canResolveProjectFromFooter || hasComposerInput || attachments.length || isPreparingPlan || projectedBlockerReason);
      const disabledReason = isPreparingPlan
        ? "正在整理，稍等一下。"
        : hasComposerInput || attachments.length
          ? "先发送或清空当前输入，再选择保存位置。"
          : projectedBlockerReason
            ? projectedBlockerReason
            : !canResolveProjectFromFooter
              ? "当前环境不能直接选文件夹，请从项目入口选择保存位置。"
              : "";
      return {
        label: agentCurrentTaskProjection.label,
        disabled,
        disabledReason,
        statusLine: disabled ? disabledReason : `下一步：${agentCurrentTaskProjection.label}`,
        perform: () => {
          void startLocalProjectSetupFromMessage();
        },
      };
    }
    if (
      agentCurrentTaskProjection.step === "confirm_story"
      && agentCurrentTaskProjection.confirmationKind === "project_edit"
    ) {
      const canDispatchProjectEdit = Boolean(workflow ? canConfirm : activeProjectEditConfirmationMessage);
      const disabled = Boolean(hasComposerInput || attachments.length || isPreparingPlan || projectedBlockerReason || !canDispatchProjectEdit);
      const disabledReason = isPreparingPlan
        ? "正在整理，稍等一下。"
        : hasComposerInput || attachments.length
          ? "先发送或清空当前输入，再确认这条修改。"
          : projectedBlockerReason
            ? projectedBlockerReason
            : !canDispatchProjectEdit
              ? "当前不能确认这条修改。"
              : "";
      return {
        label: agentCurrentTaskProjection.label,
        disabled,
        disabledReason,
        statusLine: disabled ? disabledReason : `等待确认：${agentCurrentTaskProjection.label}`,
        perform: () => {
          if (workflow) {
            void confirmPlan();
          } else if (activeProjectEditConfirmationMessage) {
            void confirmRestoredProjectEditFromMessage(activeProjectEditConfirmationMessage);
          }
        },
      };
    }
    if (agentCurrentTaskProjection.step === "confirm_story") {
      const confirmDraftFromAgent = onConfirmNewVideoDraftFromAgent || (() => onStartNewVideoDraftFromAgent?.(NEW_VIDEO_DRAFT_CONFIRM_LABEL));
      const disabled = Boolean((!onConfirmNewVideoDraftFromAgent && !onStartNewVideoDraftFromAgent) || hasComposerInput || attachments.length || isPreparingPlan || projectedBlockerReason);
      const disabledReason = isPreparingPlan
        ? "正在整理，稍等一下。"
        : hasComposerInput || attachments.length
          ? "先发送或清空当前输入，再确认草案。"
          : projectedBlockerReason
            ? projectedBlockerReason
            : (!onConfirmNewVideoDraftFromAgent && !onStartNewVideoDraftFromAgent)
              ? "当前不能从消息里确认草案。"
              : "";
      return {
        label: agentCurrentTaskProjection.label,
        disabled,
        disabledReason,
        statusLine: disabled ? disabledReason : `下一步：${agentCurrentTaskProjection.label}`,
        perform: () => {
          void confirmDraftFromAgent();
        },
      };
    }
    if (projectedFooterDirectAction && !preparedAgentConfirmationOwnsPrimaryAction) {
      const disabled = Boolean(projectedFooterDirectAction.disabled || projectedBlockerReason);
      const disabledReason = projectedBlockerReason || projectedFooterDirectAction.disabledReason;
      return {
        label: agentCurrentTaskProjection.label,
        disabled,
        disabledReason,
        statusLine: disabled
          ? disabledReason
          : footerDirectActionBoundaryFor(projectedFooterDirectAction) || `下一步：${agentCurrentTaskProjection.label}`,
        perform: projectedFooterDirectAction.perform,
      };
    }
    if (agentCurrentTaskProjection.requiresConfirmation) {
      const disabled = Boolean(hasComposerInput || attachments.length || isPreparingPlan || projectedBlockerReason || !preparedAgentConfirmationCanDispatch);
      const disabledReason = isPreparingPlan
        ? "正在整理，稍等一下。"
        : hasComposerInput || attachments.length
          ? "先发送或清空当前输入，再确认当前消息。"
          : projectedBlockerReason
            ? projectedBlockerReason
            : !preparedAgentConfirmationCanDispatch
              ? "当前不能确认这条消息。"
              : "";
      return {
        label: agentCurrentTaskProjection.label,
        disabled,
        disabledReason,
        statusLine: disabled ? disabledReason : `等待确认：${agentCurrentTaskProjection.label}`,
        perform: () => {
          void confirmPlan();
        },
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
  const agentNextActionAvailable = Boolean(
    !hasComposerInput
      && agentCurrentTaskProjection.requiresConfirmation
      && primaryLabel !== "发送"
      && !readOnlyStatusInspection,
  );
  const primaryOperationConfirmationLabel = agentNextActionAvailable
    ? agentCurrentTaskProjection.label
    : "";
  const emptyComposerConfirmationLabel = footerNewVideoDraftConfirmationLabel
    || primaryOperationConfirmationLabel
    || currentTimelineConfirmationLabel;
  const emptyComposerPendingConfirmationLabel = !hasVisibleComposerInput && !canContinuePendingNewVideoDraft
    ? emptyComposerConfirmationLabel
    : "";
  const showComposerMaterialIntakeHint = !attachments.length && !emptyComposerPendingConfirmationLabel && !skillSaveContextActive;
  const emptyComposerSendDisabledReason = !hasVisibleComposerInput && !canContinuePendingNewVideoDraft
    ? emptyComposerConfirmationLabel
      ? `上方消息等待你确认「${emptyComposerConfirmationLabel}」；要修改就先输入。`
      : "先写一句，或拖入文件。"
    : "";
  const sendDisabledReason = isPreparingPlan
    ? `${status || "正在整理"}，稍等一下。`
    : newVideoDraftPlanningForAgent
      ? "AI 正在拆镜头，等草案出来后再继续。"
      : emptyComposerSendDisabledReason;
  const sendDisabled = Boolean(sendDisabledReason);
  const storySavedIdleNowLineActive = Boolean(
    projectStatusView?.stage === "故事已保存"
      && !hasVisibleComposerInput
      && !attachments.length
      && !emptyComposerPendingConfirmationLabel
      && emptyComposerSendDisabledReason === "先写一句，或拖入文件。"
      && sendDisabledReason === emptyComposerSendDisabledReason,
  );
  const emptyComposerIdleNowLineActive = Boolean(
    !hasVisibleComposerInput
      && !attachments.length
      && !emptyComposerPendingConfirmationLabel
      && !storySavedIdleNowLineActive
      && sendDisabledReason === "先写一句，或拖入文件。",
  );
  const displaySendDisabledReason = storySavedIdleNowLineActive
    ? "等待你的下一句指令"
    : emptyComposerIdleNowLineActive
      ? "等待输入"
    : sendDisabledReason;
  const sendAriaLabel = "发送";
  function handleSend() {
    const currentTypedIntent = captureComposerLiveValue() || lastVisibleComposerInputRef.current.trim();
    const hasCurrentComposerInput = Boolean(currentTypedIntent || attachments.length);
    if (sendDisabled) {
      setStatus(sendDisabledReason);
      return;
    }
    if (!hasCurrentComposerInput && !canContinuePendingNewVideoDraft) {
      setStatus("先写一句，或拖入文件。");
      return;
    }
    if (currentTypedIntent) {
      setActiveComposerTurnIntent(currentTypedIntent);
      setText("");
      liveComposerValueRef.current = "";
      lastVisibleComposerInputRef.current = "";
      setComposerEditingConfirmationLabel("");
      onEditingPendingConfirmationChange?.(false);
    }
    if (!hasCurrentComposerInput && canContinuePendingNewVideoDraft) {
      setStatus("正在拆故事和镜头。");
      void onContinueNewVideoDraftFromAgent?.();
      return;
    }
    const typedIntentCanStartNewVideoWithoutProject = Boolean(
      currentTypedIntent
        && !currentProjectHasStoryContext
        && directorIntentCanStartNewVideoPlanningWithoutProject(currentTypedIntent)
    );
    const currentTypedIntentIsPermissionControlOnly = Boolean(
      currentTypedIntent
        && isDirectorAgentPermissionControlOnlyIntent(currentTypedIntent)
    );
    if (
      currentTypedIntent
      && activeProjectEditConfirmationMessage
      && activeProjectEditConfirmationLabel
      && !currentTypedIntentIsPermissionControlOnly
      && intentRequestsToolOrExportWork(currentTypedIntent)
    ) {
      const blockedIntentRoute = routeProjectAgentIntent({
        text: currentTypedIntent,
        hasSelection: storyReferencePlanOnlyIntentActive || referencePlanningContinueIntentActive ? false : hasActiveSelection,
        hasAttachments: attachments.length > 0,
        observation: composerProjectObservation,
      });
      rememberAgentTimelineEntries(buildPendingProjectEditBlockedTimelineEntries({
        userIntent: currentTypedIntent,
        blockedIntentLabel: localProjectBlockedIntentLabel(blockedIntentRoute, currentTypedIntent),
        confirmationLabel: activeProjectEditConfirmationLabel,
        confirmationMessage: activeProjectEditConfirmationMessage,
      }));
      liveComposerValueRef.current = "";
      lastVisibleComposerInputRef.current = "";
      setStatus(`先处理当前修改：${activeProjectEditConfirmationLabel}`);
      return;
    }
    const composerNeedsLocalProject = !currentTypedIntentIsPermissionControlOnly && (
      !localProjectReadyForTools
      || projectRequiredForWorkflow
      || projectBlockedWithoutFooterResolver
    ) && !typedIntentCanStartNewVideoWithoutProject && intentNeedsLocalProjectBeforeTooling(currentTypedIntent);
    if (composerNeedsLocalProject) {
      liveComposerValueRef.current = "";
      lastVisibleComposerInputRef.current = "";
      rememberLocalProjectBlockForIntent(currentTypedIntent);
      return;
    }
    const continueDirectAction = currentTypedIntent && isContinueIntent(currentTypedIntent) && !attachments.length && !composerNeedsLocalProject
      ? projectedFooterDirectAction
      : undefined;
    if (continueDirectAction) {
      setText("");
      liveComposerValueRef.current = "";
      lastVisibleComposerInputRef.current = "";
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
    void prepareChange(currentTypedIntent || undefined, currentComposerSelectionOverride(currentTypedIntent));
  }
  function captureComposerLiveValue() {
    const value = currentComposerTextValue();
    liveComposerValueRef.current = value;
    if (value) lastVisibleComposerInputRef.current = value;
    return value;
  }
  function handleComposerBlur(event: FocusEvent<HTMLTextAreaElement>) {
    const value = event.currentTarget.value.trim();
    if (value) {
      liveComposerValueRef.current = value;
      lastVisibleComposerInputRef.current = value;
    }
  }
  function handleSendPointerDown(event: PointerEvent<HTMLButtonElement>) {
    captureComposerLiveValue();
    if (event.button !== 0 || sendDisabled) return;
    sendPointerHandledRef.current = true;
    event.preventDefault();
    handleSend();
    window.setTimeout(() => {
      sendPointerHandledRef.current = false;
    }, 0);
  }
  function handleSendMouseDown(event: MouseEvent<HTMLButtonElement>) {
    if (sendPointerHandledRef.current) return;
    captureComposerLiveValue();
    if (event.button !== 0 || sendDisabled) return;
    sendPointerHandledRef.current = true;
    event.preventDefault();
    handleSend();
    window.setTimeout(() => {
      sendPointerHandledRef.current = false;
    }, 0);
  }
  function handleSendClick() {
    if (sendPointerHandledRef.current) {
      sendPointerHandledRef.current = false;
      return;
    }
    captureComposerLiveValue();
    handleSend();
  }
  function handleNext() {
    if (primaryDisabled) {
      setStatus(primaryDisabledReason);
      return;
    }
    primaryOperation.perform();
  }
  const activeFooterConfirmationLabel = footerNewVideoDraftConfirmationLabel
    || primaryOperationConfirmationLabel
    || currentTimelineConfirmationLabel;
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
    : "发送，也可以按 Cmd Enter";
  const displayedAgentBoundaryConfirmationLabel = !hasVisibleComposerInput && agentCurrentTaskProjection.requiresConfirmation
    ? agentCurrentTaskProjection.label
    : (
      composerToolIntentShouldYieldToProjectEditConfirmation
        ? activeProjectEditConfirmationLabel
        : currentTimelineConfirmationLabel
    )
      || (exportReadyForConfirmation && !hasComposerInput ? "导出交付包" : "")
      || (!hasComposerInput && showFooterNextActionButton && footerDirectActionBoundaryNotice ? primaryLabel : "");
  const displayedAgentBoundarySummaryLabel = editingReferenceGenerationConfirmationActive
    ? "正在修改确认"
    : composerToolIntentShouldYieldToProjectEditConfirmation
    ? "先处理当前修改"
    : composerReadyDraftDeferredToolIntent
    ? "先确认故事"
    : composerReferenceGenerationFromReferencePlan && !composerIntentNeedsLocalProject
    ? "确认生成参考"
    : composerVideoIntentShouldConfirmReferencesFirst
    ? "先补参考"
    : agentCurrentTaskProjection.step === "export" && agentCurrentTaskProjection.requiresConfirmation
    ? "确认导出"
    : agentCurrentTaskProjection.step === "prepare_references" && agentCurrentTaskProjection.requiresConfirmation
    ? agentCurrentTaskProjection.label
    : agentBoundarySummaryLabel;
  const displayedAgentBoundaryDetail = composerToolIntentShouldYieldToProjectEditConfirmation
    ? `当前还有「${activeProjectEditConfirmationLabel}」待确认；发送后会先保留这条修改确认，不会生成参考、提交视频或导出。`
    : exportReadyForConfirmation
    ? "当前等待你确认导出交付包；确认前不会写入本地导出文件。"
    : editingReferenceGenerationConfirmationActive
    ? "正在修改「确认生成参考」；发送后会先重新生成确认卡，确认前不会生成图片，也不会提交视频。"
    : displayedAgentBoundaryConfirmationLabel
    ? `当前等待你确认「${displayedAgentBoundaryConfirmationLabel}」。确认前不会执行；也可以继续说改法。`
    : composerReadyDraftDeferredToolIntent
    ? `当前输入想${composerReadyDraftDeferredToolLabel}；发送后只会先确认保存位置并保存故事，不会生成参考、提交视频或导出。`
    : composerReferenceGenerationFromReferencePlan && !composerIntentNeedsLocalProject
    ? "当前输入会先生成参考确认卡；不发送或不确认都不会生成图片，也不会提交视频。"
    : composerVideoIntentShouldConfirmReferencesFirst
    ? "当前输入想发送视频，但当前故事还缺参考；发送后会先准备参考确认卡。"
    : agentBoundaryDetail;
  const localProjectSetupRecoveryTakesFooterFocus = Boolean(
    !hasVisibleComposerInput
    && localProjectSetupNotice
    && !localProjectReadyForTools
    && minimalAgentMessageIncompleteLocalProjectSetup(localProjectSetupNotice)
    && !preparedProjectEditCanConfirmWithoutLocalProject
  );
  const footerSelectionTargetCopy = hasActiveSelection && !composerPermissionContract && !composerToolIntentShouldYieldToProjectEditConfirmation && !storyShotCountRevisionFocusActive && !storyLevelReferenceContextActive && !localProjectSetupConfirmationContextActive && !skillSaveContextActive
    ? localProjectSetupRecoveryTakesFooterFocus
      ? `你说“这个”时，我会理解为：${displayedCompactScopeLabel}`
    : agentNextActionAvailable && !hasComposerInput
      ? `你说“这个”时，我会理解为：${displayedCompactScopeLabel}；消息里的确认只会做它写明的事。`
      : `你说“这个”时，我会理解为：${displayedCompactScopeLabel}`
    : "";
  const footerActionIsVideoQuery = agentNextActionAvailable && videoQueryMode;
  const cleanedEmptyComposerTimelineNextLine = cleanEmptyComposerTimelineFooterLine(agentTimelineNextLine, hasComposerInput);
  const footerStatusCopy = composerReadyDraftDeferredToolIntent
    ? composerReadyDraftDeferredToolStatus
    : composerToolIntentShouldYieldToProjectEditConfirmation
    ? `先处理当前修改：${activeProjectEditConfirmationLabel}`
    : composerIntentNeedsLocalProject
    ? "需要保存位置：发送后先确认保存位置"
    : editingSkillSaveConfirmationActive
      ? "识别为：保存导演经验（等待确认）"
    : composerReferenceGenerationFromReferencePlan && !composerIntentNeedsLocalProject
      ? "识别为：生成参考图（等待确认）"
    : composerVideoIntentShouldConfirmReferencesFirst
      ? "识别为：准备视频（先补参考）"
    : composerPermissionContract
      ? `识别为：更新工作方式（${composerPermissionLabel}）`
    : composerReadyNewVideoDraftFeedbackIntent
      ? `识别为：${composerReadyDraftFeedbackLabel}`
    : hasVisibleComposerInput
    ? `识别为：${composerIntentRoute.label}`
    : canContinuePendingNewVideoDraft
      ? "内容已准备，点发送让 AI 导演拆故事"
    : newVideoDraftPlanningForAgent
      ? "AI 导演：草案出来后，你可以确认，也可以继续改。"
    : localProjectSetupRecoveryTakesFooterFocus
      ? "上方可重新选择保存位置，也可以继续改文字"
    : activeFooterConfirmationLabel
      ? emptyComposerPendingConfirmationLabel
        ? localProjectSetupConfirmationContextActive
          ? "可点上方「选择保存位置」，也可以直接写要改哪里。"
          : "要修改就直接输入；确认在上方消息里。"
        : `消息里等待你确认：${activeFooterConfirmationLabel}`
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
    : cleanedEmptyComposerTimelineNextLine
      ? cleanedEmptyComposerTimelineNextLine
    : primaryDisabled
      ? `${primaryDisabledPrefix}${primaryDisabledReason}`
      : `按下后：${statusLineText}`;
  const displayStatusLineText = footerActionIsVideoQuery
    ? "等待即梦结果"
    : emptyComposerPendingConfirmationLabel
      ? `等待确认：${emptyComposerPendingConfirmationLabel}`
    : sendDisabledReason
      ? displaySendDisabledReason
    : localProjectSetupRecoveryTakesFooterFocus
      ? footerStatusCopy
    : activeFooterConfirmationLabel || footerNewVideoDraftConfirmationReady
      ? footerStatusCopy
    : hasVisibleComposerInput
      ? footerStatusCopy
    : cleanEmptyComposerStatusLine(agentTimelineStatusLine || statusLineText, hasComposerInput);
  const composerHint = emptyComposerPendingConfirmationLabel
    ? ""
    : sendDisabledReason
    ? sendDisabledReason
    : editingSkillSaveConfirmationActive
    ? "点发送后会先让你确认保存 Skill；不确认不会写入项目 Skills，也不会生成参考或提交视频。"
    : composerToolIntentShouldYieldToProjectEditConfirmation
    ? `先处理「${activeProjectEditConfirmationLabel}」；不会生成参考、提交视频或导出。`
    : composerReadyDraftDeferredToolIntent
      ? composerReadyDraftDeferredToolHint
    : composerReferenceGenerationFromReferencePlan && !composerIntentNeedsLocalProject
    ? "点发送后会先让你确认生成参考图；不确认不会生成参考图，也不会提交视频。"
    : composerVideoIntentShouldConfirmReferencesFirst
    ? "点发送后会先让你确认生成当前故事参考图；不确认不会生成参考，也不会提交视频。"
    : composerPermissionContract
    ? "点发送后只更新工作方式，不改草案、不生成参考、不提交视频。"
    : footerNewVideoDraftConfirmationReady && !composerIntentNeedsLocalProject
    ? "草案没问题就在消息里确认；想改就继续说。"
    : localProjectSetupRecoveryTakesFooterFocus
      ? "可以点上方「选择保存位置」，或直接写要改哪里。"
    : composerIntentNeedsLocalProject
      ? composerLocalProjectHint
    : projectRequiredForWorkflow
      ? canResolveProjectFromFooter
      ? `可以在消息中确认「${footerNextLabel}」继续；也可以继续写想法。`
      : "当前仍可继续改想法；生成前要先选择保存位置。"
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
          : referencePlanningContextActive
          ? "参考计划已准备；要真正生成参考时，说“生成参考”或“允许生成参考”。"
          : storyReferenceDeferredFocusActive
            ? "故事已保存；可以继续修改故事，或说“开始补参考”。"
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
  const footerHintCopy = composerFooterCopyIsRedundant(composerHint, footerStatusCopy) ? "" : composerHint;
  const badges = agentActionEnvelope?.status === "blocked"
    ? ["需要补充", "未执行"]
    : feedbackRecompile
    ? [
        directorFeedbackCanConfirm(feedbackRecompile) ? "等你确认" : "需要复核",
        directorFeedbackCanConfirm(feedbackRecompile) ? "会重编译" : "换个说法",
      ]
    : readOnlyStatusInspection
      ? ["项目状态", "只读"]
    : agentActionEnvelope
      ? [
          "等你确认",
          agentActionEnvelope.toolPlan.toolName === "web_search" ? "查资料" : agentActionEnvelope.toolPlan.toolName === "project_vibe_patch" ? "改项目" : "待执行",
        ]
    : projection ? agentProjectionBadges(projection, planPhase).slice(0, 2) : workflow ? workflowBadgeLabels(workflow).slice(0, 2) : ["等你确认", "会先整理"];
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
	        referenceReadyCount: referenceReadyCountForAgent,
	        referenceReviewCount: referenceReviewCountForAgent,
	        referenceMissingCount: referenceMissingCountForAgent,
	        videoStatus: videoCanResume ? "recoverable" : videoSendAction?.status,
	        videoCanResume,
        videoWaitingCount: videoSendAction?.status === "submitted" ? 1 : 0,
        videoCompletedCount: videoSendAction?.status === "needs_review" ? 1 : 0,
        videoReviewCount: videoSendAction?.status === "needs_review" ? 1 : 0,
        videoDetail: videoSendAction?.message,
      }).projectReadiness)
      .map((item) => visibleIdleActionSuggestionForPermission(item, currentVideoPermissionContract))
      .slice(0, 3).map((item) => ({
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
  const showAgentNote = Boolean(workflow && planPhase !== "confirmed" && visibleAgentTimelineEntries.length === 0);
  const agentHasPendingActionForParent = showAgentNote && !readOnlyStatusInspection;
  useEffect(() => {
    onPendingAgentActionChange?.(agentHasPendingActionForParent);
  }, [agentHasPendingActionForParent, onPendingAgentActionChange]);
  const agentActionTitle = agentActionEnvelope?.summary
    || (feedbackRecompile ? "整理镜头修改" : preparedContext?.projectTaskLabel || "整理计划");
  const confirmedAgentResult = prototypeAgentProjection?.statusLabel
    || (agentToolHandoff ? agentToolResultLabel(agentToolHandoff) : "")
    || status;
  const confirmedAgentResultFactsList = confirmedAgentResultFacts(prototypeAgentDemo, agentToolHandoff, agentActionEnvelope);
  const confirmedResultNextAction = confirmedResultNextActionCopy(confirmedAgentResultFactsList);
  const showAgentResultNote = Boolean(planPhase === "confirmed" && confirmedAgentResult);
  const confirmedResultBlocked = confirmedResultNeedsRetry(prototypeAgentDemo, agentToolHandoff);
  const agentResultTarget = confirmedResultBlocked ? undefined : agentResultViewTarget(agentToolHandoff);
  const pendingReferenceGenerationPreviewProjection = pendingReferenceGenerationConfirmationChips.length
    ? {
      statusLabel: "等待确认生成参考",
      badges: [
        projectObservation?.references.label || "参考不完整",
        displayedAgentToolHandoff?.blockers.includes("reference_generation_not_ready") ? "图片服务未连接" : "确认前不生成",
        "不提交视频",
      ],
    }
    : undefined;
  const displayedPrototypeAgentProjection = pendingReferenceGenerationPreviewProjection || prototypeAgentProjection;
  const canRetryConfirmedTool = Boolean(
    planPhase === "confirmed"
    && agentActionEnvelope
    && agentToolHandoff
    && agentToolHandoff.status !== "handled_by_project_write"
    && !isRetryingTool
    && confirmedResultBlocked,
  );
  const pendingDraftShotCountFromTimeline = pendingDraftShotCountFromMessage(
    draftContextActive ? visibleTimelineConfirmationMessage : undefined,
  );
  const pendingDraftShotCount = (draftContextActive ? newVideoDraftShotCountForAgent : 0)
    || pendingDraftShotCountFromTimeline;
  const latestVisibleAgentUserIntent = [...visibleAgentTimelineEntries]
    .reverse()
    .find((entry) => entry.type === "user_message")
    ?.body?.trim()
    || activeComposerTurnIntent.trim()
    || preparedContext?.userIntent?.trim()
    || "";
  const pendingDraftRevisionBusyForAgent = Boolean(
    newVideoDraftBusyForAgent
      && pendingDraftShotCount
      && /修改这版草案|修改当前草案|重排|改成\s*[0-9０-９]{1,3}\s*个镜头/.test(latestVisibleAgentUserIntent),
  );
  const explicitTimelineSelectionContext = visibleExplicitAgentSelectionContext;
  const pendingDraftSelectionContext = pendingDraftShotCount ? explicitTimelineSelectionContext : undefined;
  const pendingDraftSelectionNextLabel = composerPermissionContract
    ? "更新工作方式"
    : hasVisibleComposerInput
    ? "发送修改说明"
    : newVideoDraftBusyForAgent
      ? "等草案出来后复核"
      : "等你确认";
  const pendingDraftSelectionHint = composerPermissionContract
    ? `只更新工作方式为“${composerPermissionLabel}”；不改草案，不生成参考，也不提交视频。`
    : hasVisibleComposerInput
    ? "正在修改当前草案；发送后先更新草案，不会生成参考或提交视频。"
    : newVideoDraftBusyForAgent
      ? "AI 正在整理故事和镜头，完成后再确认。"
      : pendingDraftSelectionContext?.hint || "草案待确认；确认后会成为故事流。";
  const pendingDraftSelectionChips = pendingDraftSelectionContext?.chips?.length
    ? pendingDraftSelectionContext.chips.map((chip) => (
      chip.label === "下一步"
        ? { ...chip, value: pendingDraftSelectionNextLabel }
        : chip
    ))
    : [
      { label: "正在看", value: "待确认草案" },
      { label: "镜头", value: `${pendingDraftShotCount} 个` },
      { label: "下一步", value: pendingDraftSelectionNextLabel },
  ];
  const shouldUseExplicitTimelineSelectionContext = Boolean(explicitTimelineSelectionContext && !composerPermissionContract && !pendingDraftShotCount && !storyLevelReferenceContextActive && !skillSaveContextActive);
  const projectedVideoQueryContextActive = Boolean(
    !hasVisibleComposerInput
      && !attachments.length
      && videoQueryMode
      && agentCurrentTaskProjection.step === "submit_video"
      && agentCurrentTaskProjection.label === "查询视频结果",
  );
  const projectedVideoQuerySelectionChips = projectedVideoQueryContextActive
    ? [
        { label: "任务", value: agentCurrentTaskProjection.label },
        { label: "提交", value: "不会重复提交" },
        { label: "状态", value: agentCurrentTaskProjection.requiresConfirmation ? "等待确认" : "查询中" },
      ]
    : [];
  const visibleCompactSelectionHint = pendingDraftShotCount
    ? pendingDraftSelectionHint
    : composerPermissionContract
      ? `只更新工作方式为“${composerPermissionLabel}”；不改故事，不生成参考，也不提交视频。`
    : newVideoDraftBusyForAgent
      ? "AI 正在整理故事和镜头，完成后再确认。"
    : skillSaveContextActive
      ? editingSkillSaveConfirmationActive
        ? "正在修改保存导演经验的请求；发送后先给你确认。"
        : `准备${pendingSkillSaveActionLabel || "保存导演经验"}；确认前不会写入${pendingSkillSaveTargetLabel || "项目 Skills"}。`
    : newStoryComposerScopeActive
      ? "点发送后先形成草案；确认前不会生成参考或提交视频。"
    : storyShotCountRevisionFocusActive
      ? `重排为 ${storyShotCountRevisionFocusCount} 个镜头，确认前不生成参考或提交视频。`
    : localProjectSetupConfirmationContextActive
      ? "故事已确认；先选择保存位置，之后再补参考或视频。"
    : projectedVideoQueryContextActive
      ? agentCurrentTaskProjection.requiresConfirmation
        ? `等待确认：${agentCurrentTaskProjection.label}`
        : `${agentCurrentTaskProjection.label}正在执行。`
    : exportResultIsPrimary
      ? displayedCompactSelectionHint
	  : videoResultIsPrimary
	    ? displayedCompactSelectionHint
	    : editingReferenceGenerationConfirmationActive
	      ? "正在修改「确认生成参考」；发送后会重新判断，确认前不会生成图片或提交视频。"
	    : composerVideoIntentShouldConfirmReferencesFirst
	      ? "发送视频前先补齐当前故事参考；发送后会先给出确认卡。"
	    : pendingReferenceGenerationConfirmationChips.length
	      ? "当前看整个故事；确认卡会说明生成范围和边界。"
    : referencePlanningContextActive
      ? "参考计划已准备；真正生成前会再确认。"
    : storyReferencePlanningIntentActive
      ? "我会先准备参考计划；不会生成图片或提交视频。"
    : storyReferenceDeferredFocusActive
      ? "故事已保存；需要参考时说“开始补参考”。"
    : shouldUseExplicitTimelineSelectionContext
      ? explicitTimelineSelectionContext?.hint || displayedCompactSelectionHint
    : displayedCompactSelectionHint;
  const selectionContextTitle = exportResultIsPrimary || videoResultIsPrimary
    ? "当前任务"
    : pendingDraftShotCount
      ? pendingDraftSelectionContext?.title || "当前草案"
    : composerPermissionContract
      ? "更新工作方式"
    : skillSaveContextActive
      ? "保存导演经验"
    : newStoryComposerScopeActive
      ? "新视频草案"
    : storyShotCountRevisionFocusActive
      ? "当前故事"
    : localProjectSetupConfirmationContextActive
      ? "当前故事"
    : editingReferenceGenerationConfirmationActive
      ? "当前故事"
    : composerVideoIntentShouldConfirmReferencesFirst
      ? "当前故事"
    : pendingReferenceGenerationConfirmationChips.length
      ? "当前故事"
    : referencePlanningContextActive
      ? "当前故事"
    : storyReferencePlanningIntentActive
      ? "当前故事"
    : storyReferenceDeferredFocusActive
      ? "当前故事"
    : shouldUseExplicitTimelineSelectionContext
      ? explicitTimelineSelectionContext?.title || "当前选择"
    : newVideoDraftBusyForAgent
        ? "正在整理"
        : hasActiveSelection
          ? "当前选择"
          : emptyNewVideoEntryContextActive
            ? "当前范围"
          : "怎么用";
  const displayedSelectionChips = pendingDraftShotCount
	    ? pendingDraftSelectionChips
    : composerPermissionContract
      ? [
          { label: "工作方式", value: composerPermissionLabel },
          { label: "内容", value: "不改" },
          { label: "视频", value: "不提交" },
        ]
    : pendingSkillSaveConfirmationChips.length
      ? pendingSkillSaveConfirmationChips
    : editingSkillSaveConfirmationChips.length
      ? editingSkillSaveConfirmationChips
    : newStoryComposerScopeActive
      ? [
          { label: "范围", value: "新视频草案" },
          { label: "目标镜头", value: storyShotCountRevisionIntentCount ? `${storyShotCountRevisionIntentCount} 个` : "先拆故事" },
          { label: "保护", value: "不生成参考、不提交视频" },
        ]
    : storyShotCountRevisionFocusActive
      ? [
          { label: "范围", value: "当前故事" },
          { label: "目标镜头", value: `${storyShotCountRevisionFocusCount} 个` },
          { label: "保护", value: "不生成参考、不提交视频" },
        ]
    : localProjectSetupConfirmationChips.length
      ? localProjectSetupConfirmationChips
    : projectedVideoQuerySelectionChips.length
      ? projectedVideoQuerySelectionChips
    : videoFocusSelectionChips.length
      ? videoFocusSelectionChips
    : editingReferenceGenerationConfirmationChips.length
      ? editingReferenceGenerationConfirmationChips
    : composerVideoReferencePreflightChips.length
      ? composerVideoReferencePreflightChips
    : composerReferenceGenerationSelectionChips.length
      ? composerReferenceGenerationSelectionChips
    : pendingReferenceGenerationConfirmationChips.length
      ? pendingReferenceGenerationConfirmationChips
    : exportFocusSelectionChips.length
      ? exportFocusSelectionChips
    : referencePlanningContextActive
      ? referencePlanningFocusChips
    : storyReferencePlanningIntentActive
      ? storyReferencePlanningIntentChips
    : storyReferenceDeferredFocusActive
      ? storyReferenceDeferredChips
    : shouldUseExplicitTimelineSelectionContext
      ? explicitTimelineSelectionContext?.chips || []
    : workflow && preparedSelectionChips.length ? preparedSelectionChips : liveSelectionChips;
  const visibleProjectHierarchyCapability = projectHierarchyCapabilityItem({
    sectionCount: pendingDraftShotCount ? 0 : runtimeState.storyFlow.sections.length,
    shotCount: pendingDraftShotCount || runtimeState.storyFlow.shots.length,
    assetCount: runtimeState.visualMemory.assets.length,
    skillCount: visibleSavedSkillCount,
    storyLabel: pendingDraftShotCount ? "草案" : undefined,
  });
  const visibleAgentCapabilityItems = [
    visibleProjectHierarchyCapability,
    ...agentCapabilityItems(
      currentAgentToolAvailability(),
      videoPermissionContractForUi,
      projectStatusLabel,
      localProjectReadyForTools,
    ),
  ].map((item) => {
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
  const realSampleDetailNeedsReview = referenceHasReviewableOutput || agentCommandKind === "open_review" || realSampleAction?.status === "needs_review";
  const showRealSampleDetailButton = realSampleDetailNeedsReview || !referenceGenerationBlockedByProject;
  const emptyStartStatusReplyActive = projectStatusView?.stage === "准备开始"
    && projectStatusView.doing === "AI 会先整理故事和镜头"
    && projectStatusView.nextAction === "发送后整理故事和镜头";
  const pendingDraftRevisionBusyReply = pendingDraftRevisionBusyForAgent
    ? {
      title: `重排为 ${pendingDraftShotCount} 个镜头`,
      body: `我正在按你的修改把当前草案重排为 ${pendingDraftShotCount} 个镜头；这里只更新草案，不生成参考图，也不发送视频。`,
      next: "草案出来后，你可以确认，也可以继续说哪里要改。",
      facts: [
        { label: "范围", value: "当前草案" },
        { label: "目标镜头", value: `${pendingDraftShotCount} 个` },
        { label: "保护", value: "不生成参考、不提交视频" },
      ],
    }
    : undefined;
  const passiveAgentReply = !showAgentNote && !showAgentResultNote && projectStatusView
    ? {
      title: pendingDraftRevisionBusyReply?.title || (videoSubmitReadinessReply ? "视频提交前检查" : projectStatusView.stage),
      body: pendingDraftRevisionBusyReply?.body || videoSubmitReadinessReply?.body || (emptyStartStatusReplyActive
        ? "我会先整理故事和镜头；你确认前不会生成参考或视频。"
        : [
        projectStatusView.doing,
        projectStatusView.waitingFor ? `现在等你：${projectStatusView.waitingFor}` : "",
      ].filter(Boolean).join("。")),
      next: pendingDraftRevisionBusyReply?.next || videoSubmitReadinessReply?.next || projectStatusView.nextAction,
      facts: pendingDraftRevisionBusyReply?.facts || (videoSubmitReadinessReply
        ? [
          { label: "视频", value: videoSubmitBlockerLabel(currentAgentToolAvailability().videoSubmitBlockers?.[0]) || "先准备" },
          { label: "下一步", value: videoSubmitReadinessReply.next },
        ]
        : projectStatusView.facts.slice(0, 3)),
    }
    : undefined;
  const showPassiveAgentReply = Boolean(passiveAgentReply && (
    passiveAgentReply.title !== "准备开始"
    || passiveAgentReply.body
    || passiveAgentReply.next
  ));
  const fullAgentThreadMessages: MinimalAgentMessage[] = minimalAgentMessagesFromTimelineEntries(visibleAgentTimelineEntries);
  function currentConfirmationExecutionMode(message: MinimalAgentMessage): MinimalAgentConfirmationExecutionMode {
    return minimalAgentConfirmationExecutionModeForCapabilities(message, {
      referenceLiveAdapterReady,
      videoLiveAdapterReady,
      queryVideoLiveAdapterReady,
      exportLiveAdapterReady,
    });
  }
  function visiblePendingDraftShotFacts(message: MinimalAgentMessage, facts: Array<{ label: string; value: string }>, includeMissingShotFact = true) {
    if (!pendingDraftShotCount || !isNewVideoDraftConfirmationLabel(minimalAgentConfirmationAction(message, NEW_VIDEO_DRAFT_CONFIRM_LABEL).label)) {
      return facts;
    }
    let hasShotFact = false;
    const normalized = facts.map((fact) => {
      if (!["镜头", "分镜", "视频段"].includes(fact.label.trim())) return fact;
      hasShotFact = true;
      return { ...fact, label: "镜头", value: `${pendingDraftShotCount} 个` };
    });
    return hasShotFact || !includeMissingShotFact ? normalized : [...normalized, { label: "镜头", value: `${pendingDraftShotCount} 个` }];
  }
  function visibleMessageFacts(message: MinimalAgentMessage) {
    return visiblePendingDraftShotFacts(message, minimalAgentVisibleFacts(message));
  }
  function visibleMessageConfirmationFacts(message: MinimalAgentMessage) {
    return visiblePendingDraftShotFacts(
      message,
      minimalAgentReadableConfirmationFacts(minimalAgentMessageConfirmationFacts(message)),
      false,
    );
  }
  function minimalAgentMessageInlineConfirmationFactsAreRedundant(message: MinimalAgentMessage) {
    return (message.id === "footer_action_export" && message.actionKind === "prepare_export")
      || (minimalAgentMessageIsWaitingConfirmation(message) && minimalAgentMessageIsProjectDraftEdit(message))
      || minimalAgentMessageIsReferenceGenerationConfirmation(message);
  }
  const storyFlowMessage = committedNewVideoDraftMessage(latestPrototypeAgentDemo) || storyFlowReadyMessage(runtimeState.storyFlow.shots.length, localProjectReadyForTools);
  const storyFlowAlreadyVisible = (message: MinimalAgentMessage) => {
    const messageText = minimalAgentMessageSearchText(message);
    return message.id === storyFlowMessage?.id
      || message.toolName === "write_project"
      || /草案.*故事流|故事流.*草案|故事流已准备|故事已(?:保存到|加入).*(?:项目|计划)|这版故事和镜头.*(?:保存到|加入).*(?:项目|计划)/.test(messageText);
  };
  if (storyFlowMessage && !fullAgentThreadMessages.some((message) => (
    storyFlowAlreadyVisible(message)
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
  if (!composerPermissionContract && !composerToolIntentShouldYieldToProjectEditConfirmation && !storyShotCountRevisionFocusActive && !storyLevelReferenceContextActive && hasBoundSelection && selectionFocusKey && !fullAgentThreadMessages.some((message) => message.id === selectionContextMessageId(selectionFocusKey))) {
    fullAgentThreadMessages.push(minimalAgentMessageFromTimelineEntry(buildSelectionChangedTimelineEntry({
      createdAt: "1970-01-01T00:00:00.000Z",
      selectionKey: selectionFocusKey,
      label: localScopeLabel,
      hint: selectionHint,
      facts: liveSelectionChips,
      next: selectionContextNextCopy(localProjectReadyForTools),
    })));
  }
  const latestAgentTimelineUserEntryId = [...visibleAgentTimelineEntries].reverse().find((entry) => entry.type === "user_message")?.id || "";
  const footerNewVideoDraftConfirmationId = `footer_action_new_video_draft_${(latestAgentTimelineUserEntryId || `${newVideoResetKey}_${newVideoDraftShotCountForAgent}`)
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
        body: "草案已经准备好。确认后只保存故事，不会生成参考，也不会提交视频。",
        lifecycle: "waiting_for_confirmation",
        status: "waiting",
        toolName: "write_project",
        facts: [
          { label: "目标", value: "当前草案" },
          { label: "会做", value: "保存故事" },
          { label: "外部提交", value: "不提交视频" },
        ],
        next: "确认后保存故事。",
      } satisfies MinimalAgentMessage;
    }
    if (showAgentNote || showAgentResultNote || preparedContext?.userIntent?.trim()) return undefined;
    if (projectRequiredForWorkflow) {
      return {
        id: "footer_action_project_setup",
        entryType: "confirmation_request",
        role: "confirmation",
        title: "建议行动：选择保存位置",
        body: "故事已经拆好。确认后只会让你选择这版故事的保存位置；不会生成参考、提交视频或导出。",
        lifecycle: "waiting_for_confirmation",
        status: "waiting",
        toolName: "write_project",
        facts: [
          { label: "目标", value: "故事保存位置" },
          { label: "会做", value: "选择保存位置" },
          { label: "保护", value: "不生成参考、不提交视频、不导出" },
        ],
        next: "保存位置选好后，我会接着当前故事检查下一步。",
      } satisfies MinimalAgentMessage;
    }
    const action = footerDirectAction;
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
          { label: "会做", value: "生成参考" },
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
          { label: "会做", value: "提交 Seedance 视频" },
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
          { label: "会做", value: "查询结果" },
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
          { label: "包含", value: EXPORT_PACKAGE_CONTENTS_LABEL },
          { label: "写入文件", value: "确认后才写入" },
        ],
        next: "确认后导出交付包；也可以继续输入修改意见。",
      } satisfies MinimalAgentMessage;
    }
    return undefined;
  })();
  const footerActionMatchesProjectedCurrentTask = Boolean(
    footerActionConfirmationMessage
      && agentCurrentTaskStepFromMessage(footerActionConfirmationMessage) === agentCurrentTaskProjection.step,
  );
  const shouldAppendFooterActionConfirmationMessage = Boolean(
    footerActionConfirmationMessage
      && footerActionMatchesProjectedCurrentTask
      && !minimalAgentFooterConfirmationHasExistingVisiblePeer(fullAgentThreadMessages, footerActionConfirmationMessage)
      && !fullAgentThreadMessages.some((message) => message.id === footerActionConfirmationMessage.id),
  );
  if (footerActionConfirmationMessage && shouldAppendFooterActionConfirmationMessage) {
    fullAgentThreadMessages.push(footerActionConfirmationMessage);
  }
  for (const item of visibleAgentActionLog) {
    if (fullAgentThreadMessages.some((message) => message.actionId === item.id || message.id.includes(item.id))) continue;
    fullAgentThreadMessages.push(minimalAgentMessageFromActionLogItem(item));
  }
  const threadUserIntent = visibleComposerInputText
    || text.trim()
    || preparedContext?.userIntent?.trim()
    || activeComposerTurnIntent.trim()
    || ((showAgentNote || showAgentResultNote) && hasComposerInput ? visibleComposerInputText || text.trim() : "");
  const composerReadyDraftPreviewMessage: MinimalAgentMessage | undefined = composerReadyNewVideoDraftConfirmationIntent
    ? {
      id: "composer-ready-draft-confirm-preview",
      role: "assistant",
      title: "AI 导演：确认这版故事",
      body: "我理解你要确认当前草案。发送后只会确认并保存故事，不会生成参考图，也不会发送视频。",
      facts: [
        { label: "范围", value: "当前草案" },
        { label: "镜头", value: newVideoDraftShotCountForAgent ? `${newVideoDraftShotCountForAgent} 个` : "待确认" },
        { label: "外部提交", value: "不提交视频" },
      ],
      next: "点发送后确认这版故事；也可以继续说要改哪里。",
    }
    : composerPermissionContract
      ? {
        id: "composer-ready-draft-permission-preview",
        role: "assistant",
        title: "AI 导演：更新工作方式",
        body: `我理解你只是调整工作方式。发送后会切到“${composerPermissionLabel}”，${composerPermissionContentScope}；不会生成参考图，也不会发送视频。`,
        facts: [
          { label: "工作方式", value: composerPermissionLabel },
          { label: "内容", value: "不改" },
          { label: "视频", value: "不提交" },
        ],
        next: "点发送后只更新工作方式；项目内容不会改变。",
      }
    : composerReadyDraftDeferredToolIntent
      ? {
        id: "composer-ready-draft-deferred-tool-preview",
        role: "assistant",
        title: "AI 导演：先确认故事",
        body: `我理解你想${composerReadyDraftDeferredToolLabel}。现在这版草案还没确认故事，也没有保存位置。发送后只会先确认保存位置并保存故事；不会生成参考、提交视频或导出。`,
        facts: [
          { label: "你想做", value: composerReadyDraftDeferredToolLabel },
          { label: "先做", value: "确认故事和保存位置" },
          { label: "保护", value: "不生成、不提交" },
        ],
        next: `故事保存后，再继续${composerReadyDraftDeferredToolLabel}。`,
      }
    : composerReadyNewVideoDraftFeedbackIntent
      ? {
        id: "composer-ready-draft-feedback-preview",
        role: "assistant",
        title: `AI 导演：${composerReadyDraftFeedbackLabel}`,
        body: composerReadyDraftRequestedShotCount
          ? `我理解你要把当前待确认草案重排为 ${composerReadyDraftRequestedShotCount} 个镜头。发送后我会先按这句话重排草案，不会生成参考图，也不会发送视频。`
          : composerReadyDraftTargetShotRevision
          ? composerReadyDraftTargetShotRevision.body
          : "我理解你要改当前待确认草案。发送后我会先按这句话重排草案，不会生成参考图，也不会发送视频。",
        facts: composerReadyDraftFeedbackFacts,
        next: "点发送后更新草案；不满意还可以继续改。",
      }
      : undefined;
  const composerLocalProjectBlockIntentLabel = localProjectBlockedIntentLabel(composerIntentRoute, visibleComposerInputText);
  const composerProjectEditConfirmationBlockPreviewMessage: MinimalAgentMessage | undefined = (
    composerToolIntentShouldYieldToProjectEditConfirmation
    && activeProjectEditConfirmationLabel
  )
    ? {
      id: "composer-project-edit-confirmation-block-preview",
      role: "assistant",
      title: "AI 导演：先处理当前修改",
      body: `我看到了“${shortAgentPanelMessageText(visibleComposerInputText)}”。但现在还有「${activeProjectEditConfirmationLabel}」待确认；先确认或清空这条修改，再检查保存位置、参考和视频前提。这一步不会生成参考、提交视频或导出。`,
      facts: [
        { label: "你想做", value: composerLocalProjectBlockIntentLabel },
        { label: "先处理", value: activeProjectEditConfirmationLabel },
        { label: "保护", value: "不生成参考、不提交视频、不导出" },
      ],
      next: "点发送后会保留当前修改确认；你也可以清空输入后直接确认那条修改。",
    }
    : undefined;
  const composerLocalProjectBlockPreviewMessage: MinimalAgentMessage | undefined = (
    !composerReadyDraftPreviewMessage
    && !composerProjectEditConfirmationBlockPreviewMessage
    && visibleComposerInputText
    && composerIntentNeedsLocalProject
    && !composerPermissionContract
  )
    ? {
      id: "composer-local-project-block-preview",
      role: "assistant",
      title: "AI 导演：需要保存位置",
      body: `我看到了“${shortAgentPanelMessageText(visibleComposerInputText)}”。继续前需要先选择这版故事的保存位置；这一步只选择保存位置，不会生成参考、提交视频或导出。`,
      facts: [
        { label: "你想做", value: composerLocalProjectBlockIntentLabel },
        { label: "先做", value: "选择保存位置" },
        { label: "保护", value: "不生成参考、不提交视频、不导出" },
      ],
      next: "点发送后先确认保存位置；你也可以继续改文字。",
    }
    : undefined;
  if (threadUserIntent && !minimalAgentThreadHasUserIntent(fullAgentThreadMessages, threadUserIntent)) {
    fullAgentThreadMessages.unshift({
      id: "user-intent",
      role: "user",
      title: "你",
      body: shortAgentPanelMessageText(threadUserIntent),
    });
  }
  if (composerReadyDraftPreviewMessage && !fullAgentThreadMessages.some((message) => message.id === composerReadyDraftPreviewMessage.id)) {
    fullAgentThreadMessages.push(composerReadyDraftPreviewMessage);
  }
  if (composerProjectEditConfirmationBlockPreviewMessage && !fullAgentThreadMessages.some((message) => message.id === composerProjectEditConfirmationBlockPreviewMessage.id)) {
    fullAgentThreadMessages.push(composerProjectEditConfirmationBlockPreviewMessage);
  }
  if (
    activeProjectEditConfirmationMessage
    && !fullAgentThreadMessages.some((message) => message.id === activeProjectEditConfirmationMessage.id)
  ) {
    fullAgentThreadMessages.push(activeProjectEditConfirmationMessage);
  }
  if (composerLocalProjectBlockPreviewMessage && !fullAgentThreadMessages.some((message) => message.id === composerLocalProjectBlockPreviewMessage.id)) {
    fullAgentThreadMessages.push(composerLocalProjectBlockPreviewMessage);
  }
  if (composerNewStoryPreviewMessage && !fullAgentThreadMessages.some((message) => message.id === composerNewStoryPreviewMessage.id)) {
    fullAgentThreadMessages.push(composerNewStoryPreviewMessage);
  }
  if (composerReferenceGenerationPreviewMessage && !fullAgentThreadMessages.some((message) => message.id === composerReferenceGenerationPreviewMessage.id)) {
    fullAgentThreadMessages.push(composerReferenceGenerationPreviewMessage);
  }
  if (composerVideoReferencePreflightPreviewMessage && !fullAgentThreadMessages.some((message) => message.id === composerVideoReferencePreflightPreviewMessage.id)) {
    fullAgentThreadMessages.push(composerVideoReferencePreflightPreviewMessage);
  }
  if (composerSkillSavePreviewMessage && !fullAgentThreadMessages.some((message) => message.id === composerSkillSavePreviewMessage.id)) {
    fullAgentThreadMessages.push(composerSkillSavePreviewMessage);
  }
  if (composerStoryRevisionPreviewMessage && !fullAgentThreadMessages.some((message) => message.id === composerStoryRevisionPreviewMessage.id)) {
    fullAgentThreadMessages.push(composerStoryRevisionPreviewMessage);
  }
  const composerCurrentTurnPreviewActive = Boolean(
    composerReadyDraftPreviewMessage
      || composerProjectEditConfirmationBlockPreviewMessage
      || composerLocalProjectBlockPreviewMessage
	      || composerNewStoryPreviewMessage
	      || composerReferenceGenerationPreviewMessage
	      || composerVideoReferencePreflightPreviewMessage
	      || composerSkillSavePreviewMessage
	      || composerStoryRevisionPreviewMessage,
  );
  if (!visibleAgentTimelineEntries.length && showAgentNote) {
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
    if (agentNextActionAvailable && agentActionEnvelope) {
      fullAgentThreadMessages.push({
        id: "assistant-plan-confirmation",
        entryType: "confirmation_request",
        role: "confirmation",
        title: primaryLabel,
        body: agentUnderstanding,
        lifecycle: "waiting_for_confirmation",
        status: "waiting",
        toolName: "request_user_confirmation",
        actionKind: agentActionEnvelope.kind,
        actionId: agentActionEnvelope.actionId,
        facts: visibleActionPlanFacts,
        confirmationFacts: actionConfirmationFacts,
        confirmationBoundary: "确认前不会执行；确认后只按这一步推进。",
        next: `确认后继续：${primaryLabel}`,
      });
    }
  } else if (!visibleAgentTimelineEntries.length && showAgentResultNote) {
    fullAgentThreadMessages.push({
      id: "assistant-result",
      role: "assistant",
      title: "AI 导演：已确认",
      body: confirmedAgentResult,
      facts: confirmedAgentResultFactsList.slice(0, 3),
      next: canRetryConfirmedTool ? "可以重试，或继续下一步。" : "可以继续下一步，或继续修改。",
    });
  } else if (!composerReadyDraftPreviewMessage && !composerProjectEditConfirmationBlockPreviewMessage && !composerLocalProjectBlockPreviewMessage && !composerNewStoryPreviewMessage && !composerReferenceGenerationPreviewMessage && !composerSkillSavePreviewMessage && !composerStoryRevisionPreviewMessage && showPassiveAgentReply && passiveAgentReply && minimalAgentThreadNeedsStatusReply(fullAgentThreadMessages)) {
    fullAgentThreadMessages.push({
      id: "assistant-status",
      role: "assistant",
      title: `AI 导演：${passiveAgentReply.title}`,
      body: passiveAgentReply.body,
      facts: passiveAgentReply.facts,
      next: passiveAgentReply.next,
    });
  }
  const restoredStagedPlanThreadMessages = restoredAgentStagedPlanThreadMessages(restoredAgentStagedPlanDraft);
  const restoredStagedPlanConfirmationMessage = restoredStagedPlanThreadMessages.find(minimalAgentMessageRequestsActionConfirmation);
  const shouldAppendRestoredStagedPlanThreadMessages = Boolean(
    restoredStagedPlanConfirmationMessage
      && !fullAgentThreadMessages.some((message) => minimalAgentConfirmationRequestsSameAction(message, restoredStagedPlanConfirmationMessage)),
  );
  if (restoredStagedPlanConfirmationMessage && shouldAppendRestoredStagedPlanThreadMessages) {
    const restoredStagedPlanUserMessage = restoredStagedPlanThreadMessages.find((message) => message.role === "user");
    if (restoredStagedPlanUserMessage && !minimalAgentThreadHasUserIntent(fullAgentThreadMessages, restoredStagedPlanUserMessage.body)) {
      fullAgentThreadMessages.push(restoredStagedPlanUserMessage);
    }
    fullAgentThreadMessages.push(restoredStagedPlanConfirmationMessage);
  }
  const threadReferencesUsableForAgent = referenceExecutionSatisfiedForAgent;
  const stateAwareAgentThreadMessages = fullAgentThreadMessages.filter((message) =>
    !minimalAgentReferenceReviewMessageIsStale(message, threadReferencesUsableForAgent)
    && !(projectStoryAlreadyCommittedForDraftConfirmation && minimalAgentMessageIsNewVideoDraftConfirmation(message))
    && !(composerCurrentTurnPreviewActive && minimalAgentMessageIsPassiveProjectReadyState(message))
    && !minimalAgentReferenceReviewMessageIsPremature(message, referenceHasReviewableOutput)
    && !minimalAgentReferenceGenerationConfirmationIsStale(fullAgentThreadMessages, message, threadReferencesUsableForAgent, restoredReferenceGenerationActionId)
    && !minimalAgentReferenceCompletionMessageIsStale(message, threadReferencesUsableForAgent)
    && !minimalAgentReferenceBlockedMessageIsStale(fullAgentThreadMessages, message)
    && !minimalAgentSelectionContextMessageIsOutsideActiveScope(
      message,
      selectionFocusKey,
      hasBoundSelection,
      storyLevelReferenceContextActive,
      localProjectSetupConfirmationContextActive,
      storyShotCountRevisionFocusActive || skillSaveContextActive,
      composerToolIntentShouldYieldToProjectEditConfirmation,
    )
  );
  const visibleAgentThreadResult = visibleMinimalAgentMessages(stateAwareAgentThreadMessages);
  let agentThreadMessages = visibleAgentThreadResult.messages;
  const hiddenAgentThreadMessageCount = visibleAgentThreadResult.hiddenCount;
  if (
    localProjectSetupNotice
    && !localProjectReadyForTools
    && !agentThreadMessages.some((message) => message.id === localProjectSetupNotice.id)
  ) {
    agentThreadMessages = [...agentThreadMessages, localProjectSetupNotice];
  }
  const localProjectSetupResultTakesFocus = agentThreadMessages.some(minimalAgentMessageIncompleteLocalProjectSetup);
  if (localProjectSetupResultTakesFocus) {
    agentThreadMessages = agentThreadMessages.filter((message) =>
      !minimalAgentMessageRequestsActionConfirmation(message) || !minimalAgentMessageIsLocalProjectSetup(message)
    );
  }
  const projectedStatusReplyMessage = !composerReadyDraftPreviewMessage
    && !composerProjectEditConfirmationBlockPreviewMessage
    && !composerLocalProjectBlockPreviewMessage
    && !composerNewStoryPreviewMessage
    && !composerReferenceGenerationPreviewMessage
    && !composerSkillSavePreviewMessage
    && !composerStoryRevisionPreviewMessage
    && showPassiveAgentReply
    && passiveAgentReply
    && !localProjectSetupResultTakesFocus
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
    && footerActionMatchesProjectedCurrentTask
    && !agentThreadMessages.some((message) => message.id === footerActionConfirmationMessage.id)
    && !minimalAgentFooterConfirmationHasExistingVisiblePeer(agentThreadMessages, footerActionConfirmationMessage)
    && !(localProjectSetupResultTakesFocus && minimalAgentMessageIsLocalProjectSetup(footerActionConfirmationMessage))
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
  const activeConfirmationMessage = agentCurrentTaskConfirmationMessage(
    agentCurrentTaskProjection,
    agentThreadMessages,
  );
  const activeConfirmationMessageId = activeConfirmationMessage?.id;
  const activeDirectorRunningJob = agentCurrentTaskProjection.jobId
    ? agentVideoDryRunLedger.jobs.find((job) => job.jobId === agentCurrentTaskProjection.jobId)
    : undefined;
  const activeDirectorReviewJob = agentCurrentTaskProjection.jobId
    ? agentVideoDryRunLedger.jobs.find((job) => job.jobId === agentCurrentTaskProjection.jobId && job.status === "succeeded")
    : undefined;
  const activeConfirmationFacts = activeConfirmationMessage
    ? visibleMessageConfirmationFacts(activeConfirmationMessage)
    : [];
  const agentDirectorTurnProjection = buildAgentDirectorTurnProjection({
    task: agentCurrentTaskProjection,
    reviewTarget: effectiveReviewTarget,
    reviewVersionPair,
    activeReviewVersion,
    reviewSelection: reviewSelectionProjection,
    reviewRevisionIntent: activeDirectorReviewRevisionIntent,
    reviewRegenerationProposal: activeDirectorReviewRegenerationProposal,
    clarification: activeDirectorClarificationTurn,
    proposal: agentDirectorProposal,
    currentProjectFactHash: projectFactHash,
    confirmationContext: activeConfirmationMessage
      ? {
        confirmationId: activeConfirmationMessage.id,
        actionId: activeConfirmationMessage.actionId,
        projectFactHash,
        executionMode: currentConfirmationExecutionMode(activeConfirmationMessage),
        title: minimalAgentMessageTitleLabel(activeConfirmationMessage) || activeConfirmationMessage.title,
        message: minimalAgentMessageBody(activeConfirmationMessage),
        facts: activeConfirmationFacts.length
          ? activeConfirmationFacts
          : visibleMessageFacts(activeConfirmationMessage),
      }
      : undefined,
    runningJob: activeDirectorRunningJob,
    reviewJob: activeDirectorReviewJob,
  });
  const activeConfirmationActionLabel = activeConfirmationMessage
    ? agentCurrentTaskProjection.label
    : "";
  const visibleConfirmationLocksWorkMode = Boolean(activeConfirmationMessageId && displayedAgentBoundaryConfirmationLabel && !hasVisibleComposerInput);
  const lockedWorkModeDetail = displayedAgentBoundaryConfirmationLabel
    ? `确认卡已锁定「${displayedAgentBoundaryConfirmationLabel}」的范围和后果；要改边界，点确认卡里的「再改一下」或直接输入改法。`
    : "确认卡已锁定本次操作；要改边界，先修改确认内容。";
  const displayedWorkModeSummaryLabel = visibleConfirmationLocksWorkMode
    ? "确认卡接管"
    : displayedAgentBoundarySummaryLabel;
  const showDisplayedPrototypeAgentProjection = Boolean(
    displayedPrototypeAgentProjection
      && !visibleConfirmationLocksWorkMode
      && !composerEditingPendingConfirmation
      && !localProjectSetupConfirmationContextActive,
  );
  const cancelledSkillSaveTurnShouldYieldToStoryIdle = Boolean(
    !skillSaveContextActive
      && !hasVisibleComposerInput
      && !attachments.length
      && projectStatusView?.stage === "故事已保存"
      && agentThreadMessages.some(minimalAgentMessageIsCancelledSkillSaveResult),
  );
  const agentThreadMessagesForCurrentFocus = cancelledSkillSaveTurnShouldYieldToStoryIdle
    ? agentThreadMessages.filter((message) => !minimalAgentMessageBelongsToSkillSaveTurn(message))
    : agentThreadMessages;
  const agentThreadMessagesForProjectedTask = agentThreadMessagesForCurrentFocus.filter((message) => (
    !minimalAgentMessageIsWaitingConfirmation(message)
      || minimalAgentMessageRequestsSkillSave(message)
      || message.id === activeConfirmationMessageId
  ));
  const projectedFooterActionTakesFocus = Boolean(
    agentCurrentTaskProjection.step === "export"
      && activeConfirmationMessage
      && activeConfirmationMessage.id === footerActionConfirmationMessage?.id,
  );
  const displayedAgentThreadMessages: MinimalAgentMessage[] = projectedFooterActionTakesFocus && activeConfirmationMessage
    ? [activeConfirmationMessage]
    : activeConfirmationActionLabel
    ? agentThreadMessagesForProjectedTask.map((message) => (
      message.entryType === "state_change" && isMinimalAgentSelectionContextId(message.id)
        ? { ...message, next: `可以确认「${activeConfirmationActionLabel}」，也可以继续说改法。` }
        : message
    ))
    : agentThreadMessagesForProjectedTask;
  const orderedDisplayedAgentThreadMessages = activeConfirmationMessageId
    ? [
      ...displayedAgentThreadMessages.filter((message) => message.id === activeConfirmationMessageId),
      ...displayedAgentThreadMessages.filter((message) => message.id !== activeConfirmationMessageId),
    ]
    : displayedAgentThreadMessages;
  useEffect(() => {
    const thread = agentThreadRef.current;
    if (!thread || !latestAgentThreadMessageId) return;
    window.requestAnimationFrame(() => {
      thread.scrollTop = activeConfirmationMessageId ? 0 : thread.scrollHeight;
    });
  }, [activeConfirmationMessageId, latestAgentThreadMessageId, orderedDisplayedAgentThreadMessages.length]);
  const showVisibleSkillStack = showSkillStack
    && !visibleConfirmationLocksWorkMode
    && !composerEditingPendingConfirmation
    && !localProjectSetupConfirmationContextActive;
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
      setStatus(localProjectBusy ? "正在选择保存位置。" : "当前还不能选择保存位置。");
      return;
    }
    setStatus("正在选择保存位置。");
    setLocalProjectSetupNotice(undefined);
    rememberAgentTimelineEntries(buildLocalProjectSetupTimelineEntries({
      createdAt: new Date().toISOString(),
      phase: "started",
    }));
    try {
      const result = await onCreateLocalProject?.();
      const resultEntries = buildLocalProjectSetupTimelineEntries({
        createdAt: new Date().toISOString(),
        phase: result ? "completed" : "cancelled",
      });
      rememberAgentTimelineEntries(resultEntries);
      setLocalProjectSetupNotice(minimalAgentMessageFromTimelineEntry(resultEntries[0]));
      if (result) {
        resumeAgentAfterLocalProjectSetupRef.current = true;
        setStatus("保存位置已准备，继续检查项目。");
      } else {
        resumeAgentAfterLocalProjectSetupRef.current = false;
        setStatus("没有选择保存位置。");
      }
    } catch (error) {
      resumeAgentAfterLocalProjectSetupRef.current = false;
      const failedEntries = buildLocalProjectSetupTimelineEntries({
        createdAt: new Date().toISOString(),
        phase: "failed",
        detail: error instanceof Error ? error.message : "保存位置选择失败。",
      });
      rememberAgentTimelineEntries(failedEntries);
      setLocalProjectSetupNotice(minimalAgentMessageFromTimelineEntry(failedEntries[0]));
      setStatus("保存位置选择失败。");
    }
  }

  function reviseLocalProjectBlockedIntent(message: MinimalAgentMessage) {
    const visibleIntent = currentComposerTextValue();
    const shouldRestorePreviousIntent = !minimalAgentMessageIncompleteLocalProjectSetup(message);
    const quotedIntent = `${message.body} ${message.title}`.match(/“([^”]+)”/)?.[1]?.trim() || "";
    const revisionIntent = visibleIntent
      || (shouldRestorePreviousIntent ? activeComposerTurnIntent.trim() : "")
      || (shouldRestorePreviousIntent ? minimalAgentFactValue(message, ["你想做", "动作"]) : "")
      || (shouldRestorePreviousIntent ? quotedIntent : "");
    if (revisionIntent) {
      updateText(revisionIntent);
    }
    setStatus(revisionIntent ? "可以继续改这句话；生成前再选择保存位置。" : "可以继续改故事；生成前再选择保存位置。");
    window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 0);
  }
  function openReferenceReviewFromDetails() {
    onOpenResultView?.("assets");
    setStatus("去参考页检查画面。");
  }
  function pointToMainReferenceAction() {
    if (agentNextActionAvailable && agentCurrentTaskProjection.step === "prepare_references") {
      handleNext();
      return;
    }
    setStatus(referenceGenerationBlockedByProject ? "先选择保存位置。" : `在消息中确认「${primaryLabel}」，我再生成参考。`);
  }
  function pointToMainVideoAction() {
    if (
      agentNextActionAvailable
      && (
        agentCurrentTaskProjection.step === "prepare_references"
        || agentCurrentTaskProjection.step === "submit_video"
      )
    ) {
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

  const clarificationTurnVisible = agentDirectorTurnProjection.phase === "clarification"
    && Boolean(agentDirectorTurnProjection.clarification);
  const proposalTurnVisible = agentDirectorTurnProjection.phase === "proposal"
    && Boolean(agentDirectorTurnProjection.proposal || agentDirectorTurnProjection.reviewRegenerationProposal);
  const paidConfirmationTurnVisible = agentDirectorTurnProjection.phase === "confirmation"
    && agentCurrentTaskProjection.effect === "generation_job"
    && agentCurrentTaskProjection.source !== "pipeline_job";
  const runningTurnVisible = agentDirectorTurnProjection.phase === "running"
    && Boolean(agentDirectorTurnProjection.running);
  const reviewTurnVisible = currentView === "preview"
    && agentDirectorTurnProjection.phase === "review"
    && (agentCurrentTaskProjection.step === "submit_video" || agentCurrentTaskProjection.step === "compare_versions")
    && (agentDirectorTurnProjection.mode === "review" || agentDirectorTurnProjection.mode === "blocked");
  const reviewSelectionTurnVisible = currentView === "preview"
    && agentDirectorTurnProjection.phase === "selection"
    && (agentCurrentTaskProjection.step === "confirm_version_selection" || agentCurrentTaskProjection.step === "confirm_project_fact_promotion");
  const reviewRevisionTurnVisible = agentDirectorTurnProjection.phase === "conversation"
    && Boolean(agentDirectorTurnProjection.reviewRevisionIntent);
  const focusedTurnVisible = clarificationTurnVisible
    || proposalTurnVisible
    || paidConfirmationTurnVisible
    || runningTurnVisible
    || reviewRevisionTurnVisible
    || reviewSelectionTurnVisible
    || reviewTurnVisible;
  const clarificationProjection = agentDirectorTurnProjection.clarification;
  const proposalProjection = agentDirectorTurnProjection.proposal;
  const reviewRegenerationProposalProjection = agentDirectorTurnProjection.reviewRegenerationProposal;
  const displayedProposalProjection = reviewRegenerationProposalProjection || proposalProjection;
  const paidConfirmationProjection = agentDirectorTurnProjection.confirmation;
  const runningProjection = agentDirectorTurnProjection.running;
  const reviewRevisionProjection = agentDirectorTurnProjection.reviewRevisionIntent;
  const proposalConfirmAction = proposalTurnVisible
    ? agentDirectorTurnProjection.actions.find((action) => action.id === "confirm_current_task")
    : undefined;
  const proposalReviseAction = proposalTurnVisible
    ? agentDirectorTurnProjection.actions.find((action) => action.id === "continue_conversation")
    : undefined;
  const proposalConfirmationMessage = proposalTurnVisible
    && agentDirectorProposal
    && activeProjectEditConfirmationMessage?.id === agentDirectorProposal.confirmationId
    && activeProjectEditConfirmationMessage.actionId === agentDirectorProposal.confirmationActionId
    ? activeProjectEditConfirmationMessage
    : undefined;
  const reviewApprovalAction = agentDirectorTurnProjection.actions.find((action) => action.id === "approve_preview");
  const reviewRevisionAction = agentDirectorTurnProjection.actions.find((action) => action.id === "request_changes");
  const reviewViewAAction = agentDirectorTurnProjection.actions.find((action) => action.id === "view_version_a");
  const reviewViewBAction = agentDirectorTurnProjection.actions.find((action) => action.id === "view_version_b");
  const reviewSelectionAction = agentDirectorTurnProjection.actions.find((action) => action.id === "select_candidate");
  const reviewPromotionAction = agentDirectorTurnProjection.actions.find((action) => action.id === "promote_project_fact");
  const reviewSelectionConfirmAction = agentDirectorTurnProjection.actions.find((action) => action.id === "confirm_review_selection");
  const reviewPromotionConfirmAction = agentDirectorTurnProjection.actions.find((action) => action.id === "confirm_project_fact_promotion");
  const reviewSelectionCancelAction = agentDirectorTurnProjection.actions.find((action) => action.id === "cancel_review_selection");
  const paidConfirmationAction = paidConfirmationTurnVisible
    ? agentDirectorTurnProjection.actions.find((action) => action.id === "confirm_current_task")
    : undefined;
  const paidConfirmationReviseAction = paidConfirmationTurnVisible
    ? agentDirectorTurnProjection.actions.find((action) => action.id === "continue_conversation")
    : undefined;
  const activeJobBackgroundAction = runningTurnVisible
    ? agentDirectorTurnProjection.actions.find((action) => action.id === "background_job")
    : undefined;
  const activeJobInspectAction = runningTurnVisible
    ? agentDirectorTurnProjection.actions.find((action) => action.id === "inspect_job")
    : undefined;
  const displayedCurrentTaskLabel = clarificationTurnVisible
    ? "确认导演意图"
    : proposalTurnVisible
      ? proposalConfirmAction?.label || "确认当前提案"
      : reviewRevisionTurnVisible
        ? "说明修改方向"
        : agentCurrentTaskProjection.label;
  const displayedCurrentTaskEffect = clarificationTurnVisible
    ? "先澄清导演方向，不创建新任务"
    : proposalTurnVisible
      ? "确认前只保留提案和原结果"
      : reviewRevisionTurnVisible
        ? "继续讨论修改，原结果保持不变"
        : agentCurrentTaskEffectLabel(agentCurrentTaskProjection);
  const displayedCurrentTaskStatus = clarificationTurnVisible
    ? "等待选择"
    : proposalTurnVisible
      ? "等待确认"
      : reviewRevisionTurnVisible
        ? "等待说明"
        : agentCurrentTaskStatusLabel(agentCurrentTaskProjection);
  const displayedCurrentTaskTone = clarificationTurnVisible || proposalTurnVisible || reviewRevisionTurnVisible
    ? "waiting"
    : agentCurrentTaskTone(agentCurrentTaskProjection);
  const reviewRegenerationConfirmationTurnVisible = paidConfirmationTurnVisible
    && Boolean(activeDirectorReviewRegenerationConfirmation);
  const focusedTaskOwnsVisibleContext = clarificationTurnVisible
    || proposalTurnVisible
    || reviewRevisionTurnVisible
    || reviewSelectionTurnVisible
    || reviewRegenerationConfirmationTurnVisible;
  const focusedCompactScopeLabel = focusedTaskOwnsVisibleContext
    ? displayedCurrentTaskLabel
    : displayedCompactScopeLabel;
  const focusedCompactSelectionHint = focusedTaskOwnsVisibleContext
    ? reviewRegenerationConfirmationTurnVisible
      ? "新的本地验证任务已建立；确认前不执行，也不会调用付费生成服务。"
      : displayedCurrentTaskEffect
    : visibleCompactSelectionHint;
  const focusedSelectionContextTitle = focusedTaskOwnsVisibleContext
    ? "当前任务"
    : selectionContextTitle;
  const focusedSelectionChips = clarificationTurnVisible
    ? [
        { label: "范围", value: clarificationProjection?.targetLabel || "当前视频" },
        { label: "原结果", value: "保留" },
        { label: "新任务", value: "未创建" },
      ]
    : proposalTurnVisible
      ? [
          { label: "范围", value: displayedProposalProjection?.targetLabel || "当前视频" },
          { label: "原结果", value: "保留" },
          { label: "下一步", value: "确认新任务" },
        ]
      : reviewRevisionTurnVisible
        ? [
            { label: "范围", value: reviewRevisionProjection?.targetLabel || "当前视频" },
            { label: "原结果", value: "保留" },
            { label: "新任务", value: "未创建" },
          ]
        : reviewSelectionTurnVisible
          ? [
              { label: "镜头", value: reviewVersionPair?.shotId || "当前视频" },
              { label: "获胜版本", value: reviewSelectionProjection.winnerVersion || activeReviewVersion },
              { label: "边界", value: agentCurrentTaskProjection.step === "confirm_version_selection" ? "只写选择回执" : "只晋级项目事实" },
            ]
        : reviewRegenerationConfirmationTurnVisible
          ? paidConfirmationProjection?.facts.slice(0, 3) || []
          : displayedSelectionChips;

  async function persistReviewSelectionLedger(nextLedger: AgentDirectorReviewSelectionLedger) {
    if (!onRememberAgentReviewSelectionLedger) throw new Error("review_selection_persistence_unavailable");
    await onRememberAgentReviewSelectionLedger(nextLedger);
    setAgentReviewSelectionLedger(nextLedger);
  }

  async function stageReviewVersionSelection() {
    if (!reviewVersionPair || !reviewSelectionAction?.enabled || !onRememberAgentReviewSelectionLedger) return;
    const staged = stageAgentDirectorReviewSelection({
      ledger: agentReviewSelectionLedger,
      pair: reviewVersionPair,
      winnerVersion: activeReviewVersion,
    });
    if (!staged.ok) {
      setStatus("当前版本身份已变化，不能进入选择确认。");
      return;
    }
    try {
      if (staged.receipt && !staged.confirmation) {
        const promotion = stageAgentDirectorReviewPromotion({
          ledger: staged.ledger,
          pair: reviewVersionPair,
          selectionReceiptId: staged.receipt.receiptId,
        });
        if (!promotion.ok) throw new Error(promotion.blockers[0] || "review_promotion_confirmation_blocked");
        await persistReviewSelectionLedger(promotion.ledger);
        setStatus(`版本 ${staged.receipt.winnerVersion} 已有选择回执；等待晋级确认。`);
        return;
      }
      await persistReviewSelectionLedger(staged.ledger);
      setStatus(`版本 ${activeReviewVersion} 等待独立选择确认。`);
    } catch {
      setStatus("版本选择确认保存失败；两个候选保持不变。");
    }
  }

  async function confirmReviewVersionSelection() {
    const confirmation = reviewSelectionProjection.selectionConfirmation;
    if (
      !reviewVersionPair
      || !confirmation
      || !reviewSelectionConfirmAction?.enabled
      || !onRememberAgentReviewSelectionLedger
    ) return;
    const selected = confirmAgentDirectorReviewSelection({
      ledger: agentReviewSelectionLedger,
      pair: reviewVersionPair,
      confirmationId: confirmation.confirmationId,
      reviewerId: "local_user",
    });
    if (!selected.ok || !selected.receipt) {
      setStatus("版本选择身份校验失败；没有写入选择回执。");
      return;
    }
    const promotion = stageAgentDirectorReviewPromotion({
      ledger: selected.ledger,
      pair: reviewVersionPair,
      selectionReceiptId: selected.receipt.receiptId,
    });
    if (!promotion.ok) {
      setStatus("选择回执已形成，但晋级确认无法建立。");
      await persistReviewSelectionLedger(selected.ledger).catch(() => undefined);
      return;
    }
    try {
      await persistReviewSelectionLedger(promotion.ledger);
      onActiveReviewVersionChange?.(selected.receipt.winnerVersion);
      setStatus(`版本 ${selected.receipt.winnerVersion} 已选择；等待独立项目事实晋级确认。`);
    } catch {
      setStatus("选择回执保存失败；项目事实没有改变。");
    }
  }

  async function cancelReviewSelectionBoundary() {
    if (!reviewSelectionCancelAction?.enabled || !onRememberAgentReviewSelectionLedger) return;
    const selectionConfirmation = reviewSelectionProjection.selectionConfirmation;
    const promotionConfirmation = reviewSelectionProjection.promotionConfirmation;
    const cancelled = selectionConfirmation
      ? cancelAgentDirectorReviewSelectionConfirmation({
          ledger: agentReviewSelectionLedger,
          confirmationId: selectionConfirmation.confirmationId,
        })
      : promotionConfirmation
        ? cancelAgentDirectorReviewPromotionConfirmation({
            ledger: agentReviewSelectionLedger,
            confirmationId: promotionConfirmation.confirmationId,
          })
        : undefined;
    if (!cancelled?.ok) return;
    try {
      await persistReviewSelectionLedger(cancelled.ledger);
      setStatus("已返回 A/B 比较；候选和历史回执保持不变。");
    } catch {
      setStatus("返回比较状态保存失败；没有修改项目事实。");
    }
  }

  async function confirmReviewProjectFactPromotion() {
    const confirmation = reviewSelectionProjection.promotionConfirmation;
    if (
      !reviewVersionPair
      || !confirmation
      || !reviewPromotionConfirmAction?.enabled
      || !onPromoteAgentReviewSelection
    ) return;
    try {
      await onPromoteAgentReviewSelection({
        pair: reviewVersionPair,
        ledger: agentReviewSelectionLedger,
        promotionConfirmationId: confirmation.confirmationId,
      });
      setStatus(`版本 ${reviewSelectionProjection.winnerVersion || activeReviewVersion} 已晋级项目事实；导出仍需单独确认。`);
    } catch {
      setStatus("项目事实晋级失败；选择回执和两个候选仍保留。");
    }
  }

  async function approveReviewFromAgentTurn() {
    if (
      !effectiveReviewTarget
      || !reviewApprovalAction?.enabled
      || !onApproveReviewItem
      || reviewDecisionStatus === "saving"
      || hasVisibleComposerInput
      || attachments.length
    ) return;
    setReviewDecisionStatus("saving");
    try {
      await onApproveReviewItem(effectiveReviewTarget);
      setReviewDecisionStatus("saved");
      setStatus("预览决定已写入复核记录；项目事实和交付状态没有改变。");
    } catch {
      setReviewDecisionStatus("error");
      setStatus("复核记录写入失败，结果仍保持待复核。");
    }
  }

  async function discussReviewChanges() {
    if (!effectiveReviewIdentity || !effectiveReviewTarget || !reviewRevisionAction?.enabled) {
      setStatus("当前结果身份不完整，不能记录修改意图。");
      return;
    }
    if (!onRememberAgentTimelineEntries) {
      setStatus("修改意图无法持久化；原结果仍保持待复核。");
      return;
    }
    const revision = buildAgentDirectorReviewRevisionIntent({
      identity: effectiveReviewIdentity,
      targetLabel: effectiveReviewTarget.label || shot?.id,
    });
    if (!revision.ok || !revision.intent) {
      setStatus("当前结果身份不完整，不能记录修改意图。");
      return;
    }
    const entries = bindProjectAgentTimelineEntriesToIdentity(
      buildAgentDirectorReviewRevisionTimelineEntries(revision.intent),
      agentGenerationProjectIdentityRef.current,
    );
    try {
      await onRememberAgentTimelineEntries(entries);
      setAgentTimelineEntries((current) => mergeVibeAgentTimelineEntries(current, entries));
      updateText(revision.intent.composerPrompt);
      setStatus("继续说明要改的时机、动作或连续性；原结果保持不变，不会自动重试。");
      window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 0);
    } catch {
      setStatus("修改意图保存失败；原结果仍保持待复核。");
    }
  }

  async function formReviewRegenerationProposal(input: {
    clarificationTurn: NonNullable<typeof activeDirectorClarificationTurn>;
    resolvedIntent: string;
    option?: NonNullable<typeof activeDirectorClarificationTurn>["options"][number];
  }) {
    const binding = input.clarificationTurn.reviewRevision;
    if (!binding || !onRememberAgentTimelineEntries) {
      setStatus("修改提案无法持久化；原结果保持不变。");
      return false;
    }
    const createdAt = new Date().toISOString();
    const result = buildAgentDirectorReviewRegenerationProposal({
      revisionIntent: {
        intentId: binding.intentId,
        identity: binding.identity,
        targetLabel: input.clarificationTurn.targetLabel,
      },
      clarification: input.clarificationTurn,
      resolvedIntent: input.resolvedIntent,
      directionLabel: input.option?.label,
      createdAt,
    });
    if (!result.ok || !result.proposal) {
      setStatus("修改提案与原结果身份不一致；没有创建新任务。");
      return false;
    }
    const resolutionEntry = input.option
      ? buildAgentDirectorClarificationResolutionTimelineEntry({
        turn: input.clarificationTurn,
        option: input.option,
        createdAt,
      })
      : buildAgentDirectorClarificationFreeformResolutionTimelineEntry({
        turn: input.clarificationTurn,
        resolvedIntent: input.resolvedIntent,
        createdAt,
      });
    const entries = bindProjectAgentTimelineEntriesToIdentity(
      [
        resolutionEntry,
        ...buildAgentDirectorReviewRegenerationProposalTimelineEntries(result.proposal),
      ],
      agentGenerationProjectIdentityRef.current,
    );
    try {
      await onRememberAgentTimelineEntries(entries);
      setAgentTimelineEntries((current) => mergeVibeAgentTimelineEntries(current, entries));
      setWorkflow(undefined);
      setProjection(undefined);
      setFeedbackRecompile(undefined);
      setPreparedContext(undefined);
      setAgentActionEnvelope(undefined);
      setAgentToolHandoff(undefined);
      setPlanPhase("idle");
      setText("");
      liveComposerValueRef.current = "";
      lastVisibleComposerInputRef.current = "";
      setAttachments([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setStatus("修改提案已形成；确认前不会创建新任务或调用付费生成服务。");
      return true;
    } catch {
      setStatus("修改提案保存失败；原结果保持不变。");
      return false;
    }
  }

  async function chooseClarificationOption(optionId: string) {
    const clarificationTurn = activeDirectorClarificationTurn;
    const option = clarificationTurn?.options.find((item) => item.id === optionId);
    const optionVisible = clarificationProjection?.options.some((item) => item.id === optionId);
    if (!option || !clarificationTurn || !optionVisible || clarificationResolvingId) return;
    setClarificationResolvingId(option.id);
    setStatus("正在形成提案");
    try {
      if (clarificationTurn.reviewRevision) {
        await formReviewRegenerationProposal({
          clarificationTurn,
          resolvedIntent: option.resolvedIntent,
          option,
        });
        return;
      }
      const proposalStaged = await prepareChange(
        option.resolvedIntent,
        { selectedShotId: clarificationTurn.selectedShotId || currentSelectedShotId },
        { skipClarification: true },
      );
      if (proposalStaged) {
        rememberAgentTimelineEntries([
          buildAgentDirectorClarificationResolutionTimelineEntry({
            turn: clarificationTurn,
            option,
          }),
        ]);
      }
    } finally {
      setClarificationResolvingId("");
    }
  }

  function continueClarificationInComposer() {
    if (!clarificationProjection) return;
    updateText(`${clarificationProjection.sourceIntent}\n补充：`);
    setStatus("继续补充导演意图；不会执行动作。");
    window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 0);
  }

  async function confirmReviewRegenerationProposal() {
    const proposal = activeDirectorReviewRegenerationProposal;
    if (
      !proposal
      || !onRememberAgentTimelineEntries
      || !onRememberAgentGenerationJobLedger
      || !onRefreshRestoredAgentStagedPlanDraft
      || !localProjectReadyForTools
    ) {
      setStatus("当前不能持久化新的生成确认；原结果保持不变。");
      return;
    }
    const createdAt = new Date().toISOString();
    const compiledPrompt = compileAgentDirectorReviewRegenerationPrompt(proposal);
    const videoPermission = agentVideoPermissionForMode("video_allowed");
    const action = buildDirectorAgentActionEnvelope({
      userIntent: compiledPrompt,
      snapshot: buildDirectorAgentStateSnapshot({
        runtimeState,
        currentView: "preview",
        selectedShotId: proposal.sourceIdentity.shotId,
        referenceReadyCount: Math.max(1, referenceReadyCountForAgent),
        referenceReviewCount: 0,
        referenceMissingCount: 0,
        videoStatus: videoSendAction?.status,
        videoCanResume,
        videoWaitingCount: videoSendAction?.status === "submitted" ? 1 : 0,
        videoCompletedCount: videoSendAction?.status === "needs_review" ? 1 : 0,
        videoReviewCount: videoSendAction?.status === "needs_review" ? 1 : 0,
        videoDetail: videoSendAction?.message,
      }),
      executionContract: directorAgentExecutionContractFromCreatorBoundary({
        mode: videoPermission.mode,
        referenceGenerationAllowed: videoPermission.referenceGenerationAllowed,
        videoSubmitAllowed: videoPermission.videoSubmitAllowed,
        reason: "确认修改提案后只建立新的独立生成动作。",
      }),
      generatedAt: createdAt,
    });
    if (action.kind !== "prepare_video_submit" || action.status !== "staged") {
      setStatus(action.blockers[0] || "新的生成动作无法形成；原结果保持不变。");
      return;
    }
    const handoff = buildVibeAgentToolHandoff({
      action,
      userConfirmed: false,
      confirmedAt: createdAt,
      availability: {
        ...currentAgentToolAvailability(action),
        videoSubmitReady: true,
        videoSubmitBlockers: [],
      },
    });
    if (!handoff || handoff.actionId !== action.actionId) {
      setStatus("新的生成确认身份不完整；原结果保持不变。");
      return;
    }
    const regenerationPipelinePlan = buildAgentVideoPipelinePlan({
      planId: `review_regeneration_${proposal.proposalId}`,
      generatedAt: createdAt,
      storyDraftPresent: true,
      storyConfirmed: true,
      localProjectReady: true,
      referenceMissingCount: 0,
      videoSubmitted: false,
      videoNeedsQuery: false,
    });
    const staged = planAgentVideoProductionAction({
      plan: regenerationPipelinePlan,
      ledger: agentVideoDryRunLedger,
      action: "submit_video",
      actionId: action.actionId,
      executionMode: "dry_run",
      generatedAt: createdAt,
      sourceConfirmationId: handoff.handoffId,
      sourceTimelineId: proposal.proposalId,
      prompt: compiledPrompt,
      inputAssets: [],
      outputAssets: [],
    });
    if (staged.status !== "staged_job" || !staged.job) {
      setStatus(staged.blockers[0] || "新的本地验证任务无法建立；原结果保持不变。");
      return;
    }
    const confirmation = buildAgentDirectorReviewRegenerationConfirmationTimelineEntries({
      proposal,
      job: staged.job,
      confirmationId: handoff.handoffId,
      compiledPrompt,
      createdAt,
    });
    if (!confirmation.ok) {
      setStatus(confirmation.blockers[0] || "新的确认身份无法核对；原结果保持不变。");
      return;
    }
    const suffix = createdAt.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
    const draft: ProjectAgentStagedPlanDraft = createProjectAgentStagedPlanDraft({
      status: "active",
      draftId: `agent_staged_plan_${suffix}_${action.actionId}`,
      createdAt,
      expiresAt: new Date(Date.parse(createdAt) + 24 * 60 * 60 * 1000).toISOString(),
      projectId: runtimeState.sourceIndex.projectId,
      projectTitle: runtimeState.project.title,
      projectRoot: runtimeState.project.root,
      sourceFactHash: projectFactHash,
      userIntent: compiledPrompt,
      scopeLabel: proposal.targetLabel,
      selectedShotId: proposal.sourceIdentity.shotId,
      selectedShotIds: [proposal.sourceIdentity.shotId],
      videoPermissionContract: videoPermission,
      action,
      toolHandoff: handoff,
      projectTaskLabel: `确认重新生成 ${proposal.targetLabel}`,
      loopStatus: "awaiting_confirmation",
      blockedReasons: nonConfirmationToolBlockers(handoff),
    });
    const entries = bindProjectAgentTimelineEntriesToIdentity(
      confirmation.entries,
      agentGenerationProjectIdentityRef.current,
    );
    try {
      await onRememberAgentGenerationJobLedger(staged.ledger);
      await onRefreshRestoredAgentStagedPlanDraft(draft);
      restoredAgentDraftIdRef.current = draft.draftId;
      await onRememberAgentTimelineEntries(entries);
      agentVideoExecutionLedgerRef.current = staged.ledger;
      setAgentVideoDryRunLedger(staged.ledger);
      setAgentTimelineEntries((current) => mergeVibeAgentTimelineEntries(current, entries));
      const nextWorkflow = buildDirectorWorkflowState(withProjectGuide({
        runtimeState,
        userIntent: compiledPrompt,
        selection: { selectedShotId: proposal.sourceIdentity.shotId },
      }, projectReferenceGuide));
      setWorkflow(nextWorkflow);
      setProjection(buildAgentPanelProjection(nextWorkflow, runtimeState, "review"));
      setFeedbackRecompile(undefined);
      setPreparedContext({
        scopeLabel: proposal.targetLabel,
        selectionHint: "只建立新的独立候选版本；旧结果保持不变。",
        userIntent: compiledPrompt,
        selectedShotId: proposal.sourceIdentity.shotId,
        videoPermissionContract: videoPermission,
        projectTaskLabel: `确认重新生成 ${proposal.targetLabel}`,
      });
      setAgentActionEnvelope(action);
      setAgentToolHandoff(handoff);
      setPlanPhase("review");
      setStatus("新的本地验证任务已建立；等待独立确认，不会调用付费生成服务。");
    } catch {
      setStatus("新的生成确认未能完整持久化；不会执行任务，原结果保持不变。");
    }
  }

  const proposalConfirmationDisabled = Boolean(
    !proposalConfirmAction?.enabled
      || (!proposalConfirmationMessage && !reviewRegenerationProposalProjection)
      || (reviewRegenerationProposalProjection && (
        !onRememberAgentTimelineEntries
        || !onRememberAgentGenerationJobLedger
        || !onRefreshRestoredAgentStagedPlanDraft
        || !localProjectReadyForTools
      ))
      || hasVisibleComposerInput
      || isPreparingPlan,
  );

  async function confirmProposalFromAgentTurn() {
    if (proposalConfirmationDisabled) return;
    if (reviewRegenerationProposalProjection) {
      await confirmReviewRegenerationProposal();
      return;
    }
    if (!proposalConfirmationMessage) return;
    if (workflow) {
      await confirmPlan();
      return;
    }
    await confirmRestoredProjectEditFromMessage(proposalConfirmationMessage);
  }

  async function reviseProposalFromAgentTurn() {
    if (reviewRegenerationProposalProjection && onRememberAgentTimelineEntries) {
      const entry = bindProjectAgentTimelineEntriesToIdentity([
        buildAgentDirectorReviewRegenerationProposalRevisionTimelineEntry({
          proposal: reviewRegenerationProposalProjection,
        }),
      ], agentGenerationProjectIdentityRef.current);
      try {
        await onRememberAgentTimelineEntries(entry);
        setAgentTimelineEntries((current) => mergeVibeAgentTimelineEntries(current, entry));
        updateText(reviewRegenerationProposalProjection.resolvedIntent);
        setStatus("继续调整修改提案；尚未创建新任务。");
        window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 0);
      } catch {
        setStatus("提案状态保存失败；仍停留在当前提案。");
      }
      return;
    }
    if (proposalConfirmationMessage) {
      reviseFromAgentMessage(proposalConfirmationMessage);
      return;
    }
    revisePlan();
  }

  const paidConfirmationDisabled = Boolean(
    !paidConfirmationAction?.enabled
      || !paidConfirmationProjection
      || !activeConfirmationMessage
      || activeConfirmationMessage.id !== paidConfirmationProjection.confirmationId
      || activeConfirmationMessage.actionId !== paidConfirmationProjection.actionId
      || hasVisibleComposerInput
      || attachments.length
      || isPreparingPlan
      || primaryDisabled,
  );

  function confirmPaidGenerationFromAgentTurn() {
    if (paidConfirmationDisabled) return;
    handleNext();
  }

  function revisePaidGenerationFromAgentTurn() {
    if (activeConfirmationMessage) {
      reviseFromAgentMessage(activeConfirmationMessage);
      return;
    }
    revisePlan();
  }

  function backgroundCurrentAgentJob() {
    if (!runningProjection || !activeJobBackgroundAction?.enabled) return;
    setStatus(`${agentCurrentTaskProjection.label}继续在后台运行；不会创建新任务或自动重试。`);
    setIsComposerCollapsed(true);
  }

  function inspectCurrentAgentJob() {
    if (!runningProjection || !activeJobInspectAction?.enabled) return;
    setReviewHistoryOpen(true);
    setStatus(`正在查看任务 ${runningProjection.jobId} 的现有记录；不会再次提交。`);
  }

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
          <span>{focusedCompactScopeLabel}</span>
          <small>{focusedTaskOwnsVisibleContext || hasActiveSelection ? focusedCompactSelectionHint : "点开后输入脚本、文件或修改意见。"}</small>
          <b>展开</b>
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={`minimal-agent-panel ${hasVisibleActionCard ? "has-visible-action-card" : ""}`}
      data-director-turn-mode={agentDirectorTurnProjection.mode}
      data-director-turn-phase={agentDirectorTurnProjection.phase}
    >
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
            <strong>{focusedCompactScopeLabel}</strong>
          </div>
          <section className="minimal-agent-selection-context" aria-label="当前选择">
            <span>{focusedSelectionContextTitle}</span>
            <p>{focusedCompactSelectionHint}</p>
            {focusedSelectionChips.length > 0 && (
              <div className="minimal-agent-context-chips" aria-label="当前引用内容">
                {focusedSelectionChips.map((item) => (
                  <small key={`${item.label}:${item.value}`}>
                    <b>{item.label}</b>
                    {item.value}
                  </small>
                ))}
              </div>
            )}
            {agentShotSwitcherItems.length > 1 && !composerPermissionContract && !composerToolIntentShouldYieldToProjectEditConfirmation && !storyShotCountRevisionFocusActive && !storyLevelReferenceContextActive && !localProjectSetupConfirmationContextActive && !skillSaveContextActive && (
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
      <section
        className={`signal-current-task ${displayedCurrentTaskTone}`}
        aria-label="AI 导演当前任务"
        aria-live="polite"
        data-current-task-step={agentCurrentTaskProjection.step}
        data-current-task-source={agentCurrentTaskProjection.source}
      >
        <div className="signal-current-task-icon" aria-hidden="true">
          {agentCurrentTaskProjection.blockers.length
            ? <AlertTriangle size={18} />
            : <AgentCurrentTaskIcon step={agentCurrentTaskProjection.step} />}
        </div>
        <div className="signal-current-task-copy">
          <span>当前任务</span>
          <strong>{displayedCurrentTaskLabel}</strong>
          <small>{displayedCurrentTaskEffect}</small>
        </div>
        <em>{displayedCurrentTaskStatus}</em>
      </section>
      {clarificationTurnVisible && clarificationProjection && (
        <section
          className="minimal-agent-focused-turn minimal-agent-clarification-turn"
          aria-label="当前导演澄清"
          aria-live="polite"
        >
          <div className="minimal-agent-focused-turn-head">
            <div>
              <span>本轮 · Clarify</span>
              <strong>确认导演意图</strong>
            </div>
            <em>conversation_only</em>
          </div>
          <p className="minimal-agent-focused-turn-quote">{clarificationProjection.sourceIntent}</p>
          <p>{clarificationProjection.question}</p>
          <div className="minimal-agent-clarification-options" aria-label="导演意图选项">
            {clarificationProjection.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => void chooseClarificationOption(option.id)}
                disabled={Boolean(clarificationResolvingId)}
                title="只形成待确认提案，不写项目、不调用外部生成服务。"
              >
                <strong>{option.label}</strong>
                <small>{option.detail}</small>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="minimal-agent-focused-secondary"
            onClick={continueClarificationInComposer}
            disabled={Boolean(clarificationResolvingId)}
          >
            <MessageCircle size={14} aria-hidden="true" />
            我再描述
          </button>
          <small className="minimal-agent-focused-boundary">{clarificationProjection.boundary}</small>
        </section>
      )}
      {proposalTurnVisible && displayedProposalProjection && (
        <section
          className={`minimal-agent-focused-turn minimal-agent-proposal-turn ${agentDirectorTurnProjection.mode}`}
          aria-label="当前导演提案"
          aria-live="polite"
        >
          <div className="minimal-agent-focused-turn-head">
            <div>
              <span>本轮 · Proposal</span>
              <strong>{reviewRegenerationProposalProjection ? "修改提案已形成" : "提案已形成"}</strong>
            </div>
            <em>staged_only</em>
          </div>
          <p>{displayedProposalProjection.message}</p>
          <div className="minimal-agent-proposal-meta" aria-label="提案身份">
            <small>
              <span>范围</span>
              <strong>{displayedProposalProjection.targetLabel}</strong>
            </small>
            <small>
              <span>{reviewRegenerationProposalProjection ? "提案" : "动作"}</span>
              <strong>{reviewRegenerationProposalProjection
                ? reviewRegenerationProposalProjection.proposalId.slice(0, 18)
                : proposalProjection?.actionId.slice(0, 18)}</strong>
            </small>
          </div>
          <div className="minimal-agent-proposal-changes" aria-label="提案改动">
            {displayedProposalProjection.proposedChanges.slice(0, 3).map((change) => (
              <small key={`${change.field}:${change.to}`}>
                <span>{agentActionFieldLabel(change.field)}</span>
                <strong>{change.from ? `${change.from} → ${change.to}` : change.to}</strong>
                <em>{change.reason}</em>
              </small>
            ))}
          </div>
          {agentDirectorTurnProjection.blockers.length > 0 && (
            <div className="minimal-agent-review-blocker" role="status">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>{agentDirectorTurnProjection.blockers[0]}</span>
            </div>
          )}
          <div className="minimal-agent-proposal-actions">
            <button
              type="button"
              onClick={() => void confirmProposalFromAgentTurn()}
              disabled={proposalConfirmationDisabled}
              title={proposalConfirmationDisabled
                ? hasVisibleComposerInput
                  ? "先发送或清空当前输入，再确认提案。"
                  : agentDirectorTurnProjection.blockers[0] || "当前提案身份不完整。"
                : proposalConfirmAction?.boundary}
            >
              <CheckCircle2 size={15} aria-hidden="true" />
              {proposalConfirmAction?.label || "确认写入项目"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => void reviseProposalFromAgentTurn()}
              disabled={!proposalReviseAction?.enabled}
              title={proposalReviseAction?.boundary}
            >
              <Pencil size={14} aria-hidden="true" />
              {proposalReviseAction?.label || "继续调整"}
            </button>
          </div>
          <small className="minimal-agent-focused-boundary">
            {proposalConfirmAction?.boundary || "确认前只保留提案，不执行。"}
          </small>
        </section>
      )}
      {paidConfirmationTurnVisible && (
        <section
          className={`minimal-agent-focused-turn minimal-agent-paid-confirmation-turn ${agentDirectorTurnProjection.mode}`}
          aria-label="当前生成任务确认"
          aria-live="polite"
          data-confirmation-id={paidConfirmationProjection?.confirmationId}
          data-confirmation-action-id={paidConfirmationProjection?.actionId}
        >
          <div className="minimal-agent-focused-turn-head">
            <div>
              <span>本轮 · Confirmation</span>
              <strong>{paidConfirmationProjection?.title || "确认一次执行"}</strong>
            </div>
            <em>{paidConfirmationProjection?.executionMode === "live" ? "外部任务 · 计费边界" : "本地验证 · 不计费"}</em>
          </div>
          <p>{paidConfirmationProjection?.message || agentDirectorTurnProjection.blockers[0] || "当前确认身份不完整。"}</p>
          {paidConfirmationProjection && (
            <div className="minimal-agent-confirmation-identity" aria-label="确认任务身份">
              <small>
                <span>确认</span>
                <strong>{paidConfirmationProjection.confirmationId.slice(0, 18)}</strong>
              </small>
              <small>
                <span>动作</span>
                <strong>{paidConfirmationProjection.actionId.slice(0, 18)}</strong>
              </small>
            </div>
          )}
          {paidConfirmationProjection && paidConfirmationProjection.facts.length > 0 && (
            <div className="minimal-agent-confirmation-facts" aria-label="本次执行范围">
              {paidConfirmationProjection.facts.slice(0, 6).map((fact) => (
                <small key={`${fact.label}:${fact.value}`}>
                  <span>{fact.label}</span>
                  <strong>{fact.value}</strong>
                </small>
              ))}
            </div>
          )}
          <div className={`minimal-agent-confirmation-risk ${paidConfirmationProjection?.executionMode === "live" ? "live" : "local"}`}>
            {paidConfirmationProjection?.executionMode === "live"
              ? <AlertTriangle size={15} aria-hidden="true" />
              : <LockKeyhole size={15} aria-hidden="true" />}
            <span>
              {paidConfirmationProjection?.executionMode === "live"
                ? "确认后只提交这一次外部任务；提交后本次请求不能撤回。"
                : "本轮只验证本地执行合同，不调用付费外部生成服务。"}
            </span>
          </div>
          {agentDirectorTurnProjection.blockers.length > 0 && (
            <div className="minimal-agent-review-blocker" role="status">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>{agentDirectorTurnProjection.blockers[0]}</span>
            </div>
          )}
          <div className="minimal-agent-confirmation-actions">
            <button
              type="button"
              onClick={confirmPaidGenerationFromAgentTurn}
              disabled={paidConfirmationDisabled}
              title={paidConfirmationDisabled
                ? agentDirectorTurnProjection.blockers[0] || primaryDisabledReason || "当前确认身份不完整。"
                : paidConfirmationAction?.boundary}
            >
              <CheckCircle2 size={15} aria-hidden="true" />
              {paidConfirmationAction?.label || "确认并执行 1 次"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={revisePaidGenerationFromAgentTurn}
              disabled={!paidConfirmationReviseAction?.enabled}
              title={paidConfirmationReviseAction?.boundary}
            >
              <Pencil size={14} aria-hidden="true" />
              {paidConfirmationReviseAction?.label || "返回调整"}
            </button>
          </div>
          <small className="minimal-agent-focused-boundary">
            {paidConfirmationAction?.boundary || "确认前不执行；确认后不自动重试、批准或导出。"}
          </small>
        </section>
      )}
      {runningTurnVisible && runningProjection && (
        <section
          className="minimal-agent-focused-turn minimal-agent-running-turn"
          aria-label="当前运行任务"
          aria-live="polite"
          data-job-id={runningProjection.jobId}
          data-job-action-id={runningProjection.actionId}
        >
          <small className="minimal-agent-running-confirmed">
            已确认：{agentCurrentTaskProjection.label} · 仅此任务
          </small>
          <div className="minimal-agent-focused-turn-head">
            <div>
              <span>本轮 · Running</span>
              <strong>{agentCurrentTaskProjection.label}</strong>
            </div>
            <em>{runningProjection.status === "running" ? "执行中" : "已确认"}</em>
          </div>
          <div className="minimal-agent-running-facts" aria-label="运行任务身份">
            <small>
              <span>任务</span>
              <strong>{runningProjection.jobId.slice(0, 18)}</strong>
            </small>
            <small>
              <span>模式</span>
              <strong>{runningProjection.executionMode}</strong>
            </small>
            <small>
              <span>执行方</span>
              <strong>{runningProjection.executionServiceId}</strong>
            </small>
            <small>
              <span>模型</span>
              <strong>{runningProjection.modelId}</strong>
            </small>
          </div>
          <div className="minimal-agent-running-progress" aria-label="执行进度">
            {runningProjection.progress.map((item) => (
              <small key={item.id} className={item.status}>
                {item.status === "complete"
                  ? <CheckCircle2 size={15} aria-hidden="true" />
                  : <CircleDashed size={15} aria-hidden="true" />}
                <strong>{item.label}</strong>
              </small>
            ))}
          </div>
          <div className="minimal-agent-running-policy">
            <LockKeyhole size={14} aria-hidden="true" />
            <span>
              {runningProjection.operation === "query"
                ? "只查询现有任务，不会再次提交。"
                : "已登记一次执行；不会自动重试、批准、晋级或导出。"}
            </span>
          </div>
          <div className="minimal-agent-running-actions">
            <button
              type="button"
              onClick={backgroundCurrentAgentJob}
              disabled={!activeJobBackgroundAction?.enabled}
              title={activeJobBackgroundAction?.boundary}
            >
              <CircleDashed size={15} aria-hidden="true" />
              {activeJobBackgroundAction?.label || "后台运行"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={inspectCurrentAgentJob}
              disabled={!activeJobInspectAction?.enabled}
              title={activeJobInspectAction?.boundary}
            >
              <ExternalLink size={14} aria-hidden="true" />
              {activeJobInspectAction?.label || "查看任务记录"}
            </button>
          </div>
          <small className="minimal-agent-focused-boundary">
            当前版本保持可复核；新结果返回后仍进入 needs_review。
          </small>
        </section>
      )}
      {reviewRevisionTurnVisible && reviewRevisionProjection && (
        <section
          className="minimal-agent-focused-turn minimal-agent-review-turn conversation"
          aria-label="当前视频修改意图"
          aria-live="polite"
        >
          <div className="minimal-agent-review-turn-head">
            <div>
              <span>本轮 · 修改</span>
              <strong>说明修改方向</strong>
            </div>
            <em>{reviewRevisionProjection.status}</em>
          </div>
          <p>
            已保留 {reviewRevisionProjection.targetLabel} 当前返回版本。继续说明要修改的时机、动作或连续性，我会先整理成提案。
          </p>
          <div className="minimal-agent-review-facts" aria-label="修改意图边界">
            <small>
              <span>原结果</span>
              <strong>保持不变</strong>
            </small>
            <small>
              <span>新任务</span>
              <strong>尚未创建</strong>
            </small>
          </div>
          <small className="minimal-agent-review-boundary">
            {reviewRevisionProjection.boundary}
          </small>
        </section>
      )}
      {reviewSelectionTurnVisible && reviewVersionPair && (
        <section
          className={`minimal-agent-focused-turn minimal-agent-review-turn ${agentDirectorTurnProjection.mode}`}
          aria-label={agentCurrentTaskProjection.step === "confirm_version_selection" ? "版本选择确认" : "项目事实晋级确认"}
          aria-live="polite"
          data-confirmation-id={agentCurrentTaskProjection.confirmationId}
        >
          <div className="minimal-agent-review-turn-head">
            <div>
              <span>{agentCurrentTaskProjection.step === "confirm_version_selection" ? "本轮 · Selection" : "本轮 · Promotion"}</span>
              <strong>{agentCurrentTaskProjection.label}</strong>
            </div>
            <em>waiting</em>
          </div>
          <p>
            {agentCurrentTaskProjection.step === "confirm_version_selection"
              ? `确认后只把版本 ${reviewSelectionProjection.winnerVersion || activeReviewVersion} 记为获胜候选。`
              : `版本 ${reviewSelectionProjection.winnerVersion || activeReviewVersion} 已有人工选择回执；确认后才会写入项目事实。`}
          </p>
          <div className="minimal-agent-review-facts" aria-label="版本决策身份">
            <small>
              <span>镜头</span>
              <strong>{reviewVersionPair.shotId}</strong>
            </small>
            <small>
              <span>获胜版本</span>
              <strong>{reviewSelectionProjection.winnerVersion || activeReviewVersion}</strong>
            </small>
            <small>
              <span>版本对</span>
              <strong>{reviewVersionPair.pairId.slice(-12)}</strong>
            </small>
            <small>
              <span>选择回执</span>
              <strong>{reviewSelectionProjection.selectionReceipt?.receiptId.slice(-12) || "确认后生成"}</strong>
            </small>
          </div>
          {agentDirectorTurnProjection.blockers.length > 0 && (
            <div className="minimal-agent-review-blocker" role="status">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>{agentDirectorTurnProjection.blockers[0]}</span>
            </div>
          )}
          <div className="minimal-agent-review-actions">
            <button
              type="button"
              onClick={() => agentCurrentTaskProjection.step === "confirm_version_selection"
                ? void confirmReviewVersionSelection()
                : void confirmReviewProjectFactPromotion()}
              disabled={agentCurrentTaskProjection.step === "confirm_version_selection"
                ? !reviewSelectionConfirmAction?.enabled || !onRememberAgentReviewSelectionLedger
                : !reviewPromotionConfirmAction?.enabled || !onPromoteAgentReviewSelection}
              title={(reviewSelectionConfirmAction || reviewPromotionConfirmAction)?.boundary}
            >
              <CheckCircle2 size={15} aria-hidden="true" />
              {agentCurrentTaskProjection.step === "confirm_version_selection"
                ? reviewSelectionConfirmAction?.label || `确认选择版本 ${reviewSelectionProjection.winnerVersion || activeReviewVersion}`
                : reviewPromotionConfirmAction?.label || "确认晋级项目事实"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => void cancelReviewSelectionBoundary()}
              disabled={!reviewSelectionCancelAction?.enabled || !onRememberAgentReviewSelectionLedger}
              title={reviewSelectionCancelAction?.boundary}
            >
              {reviewSelectionCancelAction?.label || "返回比较"}
            </button>
          </div>
          <small className="minimal-agent-review-boundary">
            {agentCurrentTaskProjection.step === "confirm_version_selection"
              ? "选择回执独立保存；不会修改项目事实、Visual Memory 或 Delivery。"
              : "晋级只写获胜版本事实；不会删除落选版本，也不会导出。"}
          </small>
        </section>
      )}
      {reviewTurnVisible && (
        <section
          className={`minimal-agent-focused-turn minimal-agent-review-turn ${agentDirectorTurnProjection.mode}`}
          aria-label="当前视频复核"
          aria-live="polite"
        >
          <div className="minimal-agent-review-turn-head">
            <div>
              <span>本轮 · Review</span>
              <strong>{effectiveReviewTarget ? reviewVersionPair ? "比较两个返回版本" : "新版本已返回" : "复核身份不完整"}</strong>
            </div>
            <em>{effectiveReviewTarget?.status || "blocked"}</em>
          </div>
          <p>
            {effectiveReviewTarget
              ? reviewVersionPair
                ? `当前查看版本 ${activeReviewVersion}。比较动作完成点、情绪转折与连续性后，再进入独立选择确认。`
                : "结果已返回。先检查动作完成点、情绪转折与已确认参考的连续性。"
              : agentDirectorTurnProjection.blockers[0] || "当前结果还不能进入复核。"}
          </p>
          {effectiveReviewTarget && (
            <div className="minimal-agent-review-facts" aria-label="复核对象身份">
              <small>
                <span>对象</span>
                <strong>{effectiveReviewTarget.label}</strong>
              </small>
              <small>
                <span>范围</span>
                <strong>{effectiveReviewTarget.shotId || "当前镜头"}</strong>
              </small>
              <small>
                <span>回执</span>
                <strong>{reviewTargetIdentity.sourceId ? reviewTargetIdentity.sourceId.slice(0, 12) : "缺失"}</strong>
              </small>
              <small>
                <span>输出</span>
                <strong>{reviewTargetIdentity.outputId ? reviewTargetIdentity.outputId.slice(0, 12) : "缺失"}</strong>
              </small>
              {reviewVersionPair && (
                <small>
                  <span>版本对</span>
                  <strong>{reviewVersionPair.pairId.slice(-12)}</strong>
                </small>
              )}
            </div>
          )}
          {agentDirectorTurnProjection.blockers.length > 0 && (
            <div className="minimal-agent-review-blocker" role="status">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>{agentDirectorTurnProjection.blockers[0]}</span>
            </div>
          )}
          <small className="minimal-agent-review-skill">
            审查依据：{selectedSkillSummary?.label || "当前项目导演方法"}
          </small>
          {reviewVersionPair && (
            <div className="minimal-agent-review-actions" aria-label="版本查看">
              <button
                type="button"
                className={activeReviewVersion === "A" ? undefined : "secondary"}
                onClick={() => onActiveReviewVersionChange?.("A")}
                disabled={!reviewViewAAction?.enabled}
                title={reviewViewAAction?.boundary}
                aria-pressed={activeReviewVersion === "A"}
              >
                {reviewViewAAction?.label || "查看 A"}
              </button>
              <button
                type="button"
                className={activeReviewVersion === "B" ? undefined : "secondary"}
                onClick={() => onActiveReviewVersionChange?.("B")}
                disabled={!reviewViewBAction?.enabled}
                title={reviewViewBAction?.boundary}
                aria-pressed={activeReviewVersion === "B"}
              >
                {reviewViewBAction?.label || "查看 B"}
              </button>
            </div>
          )}
          <div className="minimal-agent-review-actions">
            {reviewVersionPair ? (
              <button
                type="button"
                onClick={() => void stageReviewVersionSelection()}
                disabled={!reviewSelectionAction?.enabled || !onRememberAgentReviewSelectionLedger || hasVisibleComposerInput || Boolean(attachments.length)}
                title={reviewSelectionAction?.boundary}
              >
                <CheckCircle2 size={15} aria-hidden="true" />
                {reviewSelectionAction?.label || `选择版本 ${activeReviewVersion}`}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void approveReviewFromAgentTurn()}
                disabled={!reviewApprovalAction?.enabled || !onApproveReviewItem || reviewDecisionStatus === "saving" || reviewDecisionStatus === "saved" || hasVisibleComposerInput || Boolean(attachments.length)}
                title={hasVisibleComposerInput || attachments.length
                  ? "先发送或清空当前修改说明，再通过预览。"
                  : reviewApprovalAction?.enabled
                    ? reviewApprovalAction.boundary
                    : agentDirectorTurnProjection.blockers[0]}
              >
                <CheckCircle2 size={15} aria-hidden="true" />
                {reviewDecisionStatus === "saving" ? "写入中" : reviewDecisionStatus === "saved" ? "预览已通过" : reviewApprovalAction?.label || "通过预览"}
              </button>
            )}
            <button
              type="button"
              className="secondary"
              onClick={() => void discussReviewChanges()}
              disabled={!reviewRevisionAction?.enabled}
              title={reviewRevisionAction?.boundary}
            >
              <MessageCircle size={15} aria-hidden="true" />
              {reviewRevisionAction?.label || "需要修改"}
            </button>
          </div>
          <small className="minimal-agent-review-boundary">
            {reviewVersionPair
              ? reviewSelectionAction?.boundary || "选择仍需独立确认，不会晋级项目事实或导出。"
              : reviewApprovalAction?.boundary || "只写入复核记录，不会晋级项目事实，不会导出。"}
          </small>
          <button
            type="button"
            className="minimal-agent-review-promotion"
            disabled={!reviewPromotionAction?.enabled}
            title={reviewPromotionAction?.boundary}
          >
            <LockKeyhole size={14} aria-hidden="true" />
            {reviewPromotionAction?.label || "晋级为项目事实"}
            <small>需要另行确认</small>
          </button>
          {reviewDecisionStatus === "error" && (
            <small className="minimal-agent-review-error">复核记录写入失败，结果仍保持 needs_review。</small>
          )}
        </section>
      )}
      {showVisibleSkillStack && (
        !focusedTurnVisible && (
        <section className="minimal-agent-skill-stack" aria-label="当前导演技能">
          <details className="minimal-agent-skill-disclosure" open={skillSaveContextActive || undefined}>
            <summary className="minimal-agent-skill-summary">
              <span>导演经验</span>
              <strong>{selectedSkillSummary?.label || "项目 Skills"}</strong>
              <em>{skillSaveContextActive ? "正在保存 Skill" : "点开查看 Skills"}</em>
            </summary>
            <small className="minimal-agent-skill-reason">{selectedSkillSummary?.reason || "Agent 会按当前镜头和素材，选择合适的导演方法。"}</small>
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
                {agentRecommendedSkillCopy}
              </small>
              <small>
                <b>我的 Skills</b>
                {mySkillActionLabel}
              </small>
            </div>
            {selectedSkillCard && !selectedSkillAlreadySaved && (
              <div className="minimal-agent-skill-actions">
                <button
                  type="button"
                  className="minimal-agent-skill-save-button"
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    skillSaveMouseDownHandledRef.current = true;
                    requestSelectedSkillDraftSave("把当前做法保存为 Skill");
                  }}
                  onClick={(event) => {
                    if (skillSaveMouseDownHandledRef.current) {
                      skillSaveMouseDownHandledRef.current = false;
                      return;
                    }
                    requestSelectedSkillDraftSave("把当前做法保存为 Skill");
                  }}
                  title="先生成保存确认卡；确认前不会写项目、生成参考或提交视频。"
                  aria-label={`保存为 Skill：${selectedSkillCard.name}`}
                >
                  <Sparkles size={12} aria-hidden="true" />
                  保存为 Skill
                </button>
              </div>
            )}
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
          </details>
        </section>
        )
      )}
      {!focusedTurnVisible && <details
        className="minimal-agent-advanced-controls"
        open={advancedControlsOpen}
        onToggle={(event) => setAdvancedControlsOpen(event.currentTarget.open)}
      >
        <summary>
          <span>工作方式</span>
          <strong>{displayedWorkModeSummaryLabel}</strong>
        </summary>
        {advancedControlsOpen && visibleConfirmationLocksWorkMode ? (
          <section className="minimal-agent-permission-mode minimal-agent-permission-menu is-locked" aria-label="AI 导演工作方式已锁定">
            <span>确认卡接管</span>
            <small>{lockedWorkModeDetail}</small>
          </section>
        ) : advancedControlsOpen && (
          <section className="minimal-agent-permission-mode minimal-agent-permission-menu" aria-label="更改 AI 导演工作方式">
            <span>选择工作方式</span>
            {videoPermissionModeItems.map((item) => (
              <button
                key={item.mode}
                type="button"
                className={activeVideoPermissionContract.mode === item.mode ? "is-active" : ""}
                aria-label={`AI 导演工作方式：${item.label}`}
                aria-pressed={activeVideoPermissionContract.mode === item.mode}
                disabled={Boolean(workflow)}
                title={workflow ? "当前计划已生成，先点再改一下再切换边界。" : agentVideoPermissionDetail(agentVideoPermissionForMode(item.mode))}
                onClick={() => selectVideoPermissionMode(item.mode)}
              >
                {item.label}
              </button>
            ))}
            <small>{displayedAgentBoundaryDetail}</small>
          </section>
        )}
        {advancedControlsOpen && !visibleConfirmationLocksWorkMode && visibleAgentCapabilityGlanceItems.length > 0 && (
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
      </details>}
      {orderedDisplayedAgentThreadMessages.length > 0 && (
        <section
          ref={agentThreadRef}
          className={`minimal-agent-thread ${focusedTurnVisible ? "is-focused-history" : ""} ${reviewTurnVisible ? "is-review-history" : ""}`}
          aria-label="和 AI 导演的对话"
          aria-live="polite"
        >
          {focusedTurnVisible ? (
            <button
              type="button"
              className="minimal-agent-thread-history-toggle"
              onClick={() => setReviewHistoryOpen((open) => !open)}
              aria-expanded={reviewHistoryOpen}
            >
              <span>更早的对话</span>
              <small>{orderedDisplayedAgentThreadMessages.length} 条</small>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
          ) : <span>和 AI 导演的对话</span>}
          {(!focusedTurnVisible || reviewHistoryOpen) && <>
          {totalHiddenAgentThreadMessageCount > 0 && (
            <small className="minimal-agent-thread-history">
              前面的记录已保存，这里只显示最近一次推进。
            </small>
          )}
          {orderedDisplayedAgentThreadMessages.map((timelineMessage) => {
            const confirmationExecutionMode = currentConfirmationExecutionMode(timelineMessage);
            const message = minimalAgentConfirmationMessageForExecutionMode(timelineMessage, confirmationExecutionMode);
            const messageBody = minimalAgentMessageBody(message);
            const messageFacts = visibleMessageFacts(message);
            const messageConfirmationFacts = visibleMessageConfirmationFacts(message);
            const showMessageConfirmationFacts = messageConfirmationFacts.length > 0
              && !minimalAgentMessageInlineConfirmationFactsAreRedundant(message);
            const messageIsCurrentConfirmation = message.id === activeConfirmationMessageId;
            return (
            <article
              key={message.id}
              className={`minimal-agent-message ${message.role} ${messageIsCurrentConfirmation ? "is-current-confirmation" : ""}`}
              aria-current={messageIsCurrentConfirmation ? "step" : undefined}
            >
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
              {messageFacts.length > 0 && (
                <div className="minimal-agent-plan is-inline" aria-label={`${message.title}摘要`}>
                  {messageFacts.map((fact) => (
                    <small key={`${message.id}:${fact.label}:${fact.value}`}>
                      <span>{fact.label}</span>
                      <strong>{agentFactDisplayValue(fact)}</strong>
                    </small>
                  ))}
                </div>
              )}
              {showMessageConfirmationFacts && (
                <div className="minimal-agent-confirmation-strip is-message" aria-label="这条消息确认后动作">
                  {message.confirmationBoundary && (
                    <small className="minimal-agent-confirmation-boundary-copy">
                      <span>确认</span>
                      <strong>{message.confirmationBoundary}</strong>
                    </small>
                  )}
                  {messageConfirmationFacts.map((fact) => (
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
                      {message.assetInboxSummary.kindCountLabels.length
                        ? message.assetInboxSummary.kindCountLabels.join(" / ")
                        : message.assetInboxSummary.kindLabels.length
                          ? message.assetInboxSummary.kindLabels.join(" / ")
                          : "待你确认"}
                    </strong>
                  </small>
                  <small>
                    <span>等你确认</span>
                    <strong>
                      {message.assetInboxSummary.needsReviewCount
                        ? `${message.assetInboxSummary.needsReviewCount} 个`
                        : "没有"}
                    </strong>
                  </small>
                  <small className="is-boundary">
                    <span>边界</span>
                    <strong>先确认再写入项目</strong>
                  </small>
                  {message.assetInboxSummary.handlingLabels.length > 0 && (
                    <small>
                      <span>处理方式</span>
                      <strong>{message.assetInboxSummary.handlingLabels.join(" / ")}</strong>
                    </small>
                  )}
                  {message.assetInboxSummary.bindingPreviewLabels.length > 0 && (
                    <small>
                      <span>建议绑定</span>
                      <strong>{message.assetInboxSummary.bindingPreviewLabels.join("；")}</strong>
                    </small>
                  )}
                  {message.assetInboxSummary.foldedDetailLabels.length > 0 && (
                    <small>
                      <span>并入镜头</span>
                      <strong>{message.assetInboxSummary.foldedDetailLabels.join("、")}</strong>
                    </small>
                  )}
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
                const resultNextAction = projectedFooterDirectAction && !projectedFooterDirectAction.disabled
                  ? projectedFooterDirectAction
                  : undefined;
                const resultNextRequiresConfirmation = Boolean(
                  resultNextAction
                    && agentCurrentTaskProjection.requiresConfirmation,
                );
                const resultNextLabel = resultNextAction?.label || "按建议继续";
                const resultNextTitle = resultNextAction
                  ? footerDirectActionBoundaryFor(resultNextAction) || `执行下一步：${resultNextAction.label}`
                  : `把「${nextIntent}」发给 AI 导演，并保留当前选中内容。`;
                const continueFromCompletedToolAction = () => {
                  if (resultNextAction && resultNextRequiresConfirmation) {
                    setStatus(footerDirectActionBoundaryFor(resultNextAction) || `等待确认：${resultNextAction.label}`);
                    void prepareChange(
                      resultNextAction.label,
                      currentComposerSelectionOverride(resultNextAction.label),
                    );
                    return;
                  }
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
              {message.id === latestLocalProjectBlockedMessageId && !localProjectReadyForTools && !activeConfirmationMessageId && (
                <div className="minimal-agent-message-actions">
	                  <button
		                    type="button"
	                    onClick={startLocalProjectSetupFromMessage}
	                    disabled={!canResolveProjectFromFooter}
	                    title={canResolveProjectFromFooter ? "选择保存位置后，我会接着当前故事继续。" : localProjectBusy ? "正在选择保存位置。" : "当前环境暂时不能选择保存位置。"}
	                  >
	                    选择保存位置
	                  </button>
                    {!canResolveProjectFromFooter && (
                      <small className="minimal-agent-action-hint">
                        {localProjectBusy ? "正在选择保存位置。" : "当前环境不能直接选文件夹，请从项目入口选择保存位置。"}
                      </small>
                    )}
		                  <button
                    type="button"
                    className="secondary"
                    onClick={() => reviseLocalProjectBlockedIntent(message)}
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
                    disabled={!activePendingSkillSaveRequest}
                    title={activePendingSkillSaveRequest ? "确认后保存到项目 Skills。" : "这条保存请求已经处理。"}
                  >
                    确认保存
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={revisePendingSkillSave}
                    disabled={!activePendingSkillSaveRequest}
                    title="先不保存，把这句话放回输入框继续改。"
                  >
                    再改一下
                  </button>
                </div>
              )}
              {minimalAgentMessageRequestsActionConfirmation(message) && message.id === activeConfirmationMessageId && !minimalAgentMessageRequestsSkillSave(message) && (() => {
                const currentConfirmationIsVideoQuery = message.actionKind === "query_video_result";
                const confirmationAction = currentConfirmationIsVideoQuery
                  ? minimalAgentConfirmationAction({ ...message, actionKind: "query_video_result" }, primaryLabel)
                  : minimalAgentConfirmationAction(message, primaryLabel);
                const confirmationBoundary = minimalAgentConfirmationBoundary(message);
                const confirmationIsFooterAction = message.id.startsWith("footer_action_");
                const confirmationIsNewVideoDraftAction = agentCurrentTaskProjection.step === "confirm_story"
                  && agentCurrentTaskProjection.confirmationKind !== "project_edit";
                const confirmationIsLocalProjectSetup = agentCurrentTaskProjection.step === "choose_save_location";
                const confirmationMatchesPrimaryAction = Boolean(
                  agentNextActionAvailable
                  && message.actionId
                  && agentActionEnvelope?.actionId
                  && message.actionId === agentActionEnvelope.actionId
                );
                const confirmationMatchesVisibleTimeline = Boolean(
                  visibleTimelineConfirmationMessage
                  && message.id === visibleTimelineConfirmationMessage.id
                  && canConfirm
                );
                const confirmationUsesPreparedProjectEdit = agentCurrentTaskProjection.step === "confirm_story"
                  && agentCurrentTaskProjection.confirmationKind === "project_edit";
                const confirmationUsesPrimaryAction = [
                  "prepare_references",
                  "submit_video",
                  "export",
                ].includes(agentCurrentTaskProjection.step)
                  && (
                    confirmationMatchesPrimaryAction
                    || confirmationMatchesVisibleTimeline
                    || (agentNextActionAvailable && confirmationIsFooterAction)
                  );
                const confirmationDisabled = confirmationIsNewVideoDraftAction
                  ? Boolean((!onConfirmNewVideoDraftFromAgent && !onStartNewVideoDraftFromAgent) || hasComposerInput || attachments.length || isPreparingPlan)
                  : confirmationIsLocalProjectSetup
                    ? Boolean(!canResolveProjectFromFooter || hasComposerInput || attachments.length || isPreparingPlan)
                  : confirmationUsesPreparedProjectEdit
                    ? Boolean(hasVisibleComposerInput || isPreparingPlan)
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
                  : confirmationIsLocalProjectSetup
                    ? isPreparingPlan
                      ? "正在整理，稍等一下。"
                      : hasComposerInput || attachments.length
                        ? "先发送或清空当前输入，再选择保存位置。"
                        : !canResolveProjectFromFooter
                          ? "当前环境不能直接选文件夹，请从项目入口选择保存位置。"
                          : ""
                  : confirmationUsesPreparedProjectEdit
                    ? isPreparingPlan
                      ? "正在整理，稍等一下。"
                      : hasComposerInput || attachments.length
                        ? "先发送或清空当前输入，再确认这条修改。"
                        : ""
                  : confirmationUsesPrimaryAction
                    ? primaryDisabledReason
                    : hasComposerInput || attachments.length
                      ? "先发送或清空当前输入，再确认这条消息。"
                      : isPreparingPlan
                        ? "正在整理，稍等一下。"
                        : "";
                const confirmationButtonLabel = confirmationAction.label;
                const confirmationButtonHint = confirmationIsNewVideoDraftAction
                  ? confirmationAction.hint
                  : confirmationIsLocalProjectSetup
                    ? confirmationAction.hint
                  : confirmationUsesPreparedProjectEdit
                    ? confirmationAction.hint
                  : confirmationUsesPrimaryAction
                  ? confirmationAction.hint
                  : "这是从项目记录恢复的待确认动作。点击后我会按这条消息继续核对；真正执行前仍会停在确认门。";
                const confirmationPreflightNotice = confirmationUsesPrimaryAction && handoffPreflightBlocked && displayedAgentToolHandoff
                  ? agentToolPreflightNotice(displayedAgentToolHandoff)
                  : "";
                const runConfirmationAction = () => {
                  if (confirmationIsNewVideoDraftAction) {
                    const confirmDraftFromAgent = onConfirmNewVideoDraftFromAgent || (() => onStartNewVideoDraftFromAgent?.(NEW_VIDEO_DRAFT_CONFIRM_LABEL));
                    void confirmDraftFromAgent();
                    return;
                  }
                  if (confirmationIsLocalProjectSetup) {
                    void startLocalProjectSetupFromMessage();
                    return;
                  }
                  if (confirmationUsesPreparedProjectEdit) {
                    if (workflow) {
                      void confirmPlan();
                    } else {
                      void confirmRestoredProjectEditFromMessage(message);
                    }
                    return;
                  }
                  if (confirmationUsesPrimaryAction) {
                    handleNext();
                    return;
                  }
                  void prepareChange(agentMessageConfirmationIntent(message, confirmationAction.label), currentComposerSelectionOverride());
                };
                const handleConfirmationPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
                  if (event.button !== 0 || confirmationDisabled) return;
                  confirmationPointerHandledRef.current = true;
                  event.preventDefault();
                  runConfirmationAction();
                  window.setTimeout(() => {
                    confirmationPointerHandledRef.current = false;
                  }, 0);
                };
                const handleConfirmationMouseDown = (event: MouseEvent<HTMLButtonElement>) => {
                  if (confirmationPointerHandledRef.current || event.button !== 0 || confirmationDisabled) return;
                  confirmationPointerHandledRef.current = true;
                  event.preventDefault();
                  runConfirmationAction();
                  window.setTimeout(() => {
                    confirmationPointerHandledRef.current = false;
                  }, 0);
                };
                const handleConfirmationClick = () => {
                  if (confirmationPointerHandledRef.current) {
                    confirmationPointerHandledRef.current = false;
                    return;
                  }
                  runConfirmationAction();
                };
                const handleConfirmationKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
                  if ((event.key !== "Enter" && event.key !== " ") || confirmationDisabled) return;
                  confirmationPointerHandledRef.current = true;
                  event.preventDefault();
                  runConfirmationAction();
                  window.setTimeout(() => {
                    confirmationPointerHandledRef.current = false;
                  }, 0);
                };
                return (
                  <div className="minimal-agent-message-actions">
                    <small className="minimal-agent-confirmation-effect">
                      <span>确认后会</span>
                      <strong>{agentCurrentTaskEffectLabel(agentCurrentTaskProjection)}</strong>
                    </small>
                    {confirmationBoundary ? (
                      <small className="minimal-agent-confirmation-boundary">
                        <span>不会</span>
                        <strong>{confirmationBoundary}</strong>
                      </small>
                    ) : (
                      <small className="minimal-agent-confirmation-boundary">
                        <span>不会</span>
                        <strong>{agentCurrentTaskBoundaryLabel(agentCurrentTaskProjection)}</strong>
                      </small>
                    )}
                    {confirmationPreflightNotice && (
                      <small className="minimal-agent-action-hint">
                        {confirmationPreflightNotice}
                      </small>
                    )}
                    <button
                      type="button"
                      onPointerDown={handleConfirmationPointerDown}
                      onMouseDown={handleConfirmationMouseDown}
                      onClick={handleConfirmationClick}
                      onKeyDown={handleConfirmationKeyDown}
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
          </>}
        </section>
      )}
      {showAgentNote && (
        !focusedTurnVisible && (
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
        )
      )}
      {showAgentResultNote && (
        !focusedTurnVisible && (
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
            <button type="button" onClick={() => continueNextAfterConfirmedAction(confirmedResultNextAction.intent)}>
              <CheckCircle2 size={15} />
              {confirmedResultNextAction.label}
            </button>
            <button type="button" className="secondary" onClick={revisePlan}>
              <Pencil size={14} />
              继续修改
            </button>
            <button type="button" className="secondary" onClick={inspectNextAfterConfirmedAction}>
              {confirmedResultNextAction.inspectLabel}
            </button>
          </div>
        </section>
        )
      )}
      {showStandaloneAgentActionLog && (
        !focusedTurnVisible && (
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
        )
      )}
      {showResearchPrompt && (
        !focusedTurnVisible && (
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
        )
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
          onBlur={handleComposerBlur}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              captureComposerLiveValue();
              if (currentComposerTextValue() || attachments.length || canContinuePendingNewVideoDraft) handleSend();
              else setStatus("先写一句，或在消息中确认。");
            }
          }}
          placeholder={inputPlaceholder}
        />
        <div
          className="minimal-agent-input-footer"
          data-agent-footer-action={showFooterNextActionButton ? "true" : "false"}
          data-agent-footer-draft={footerNewVideoDraftConfirmationReady ? "true" : "false"}
          data-agent-footer-confirmation-label={displayedAgentBoundaryConfirmationLabel || ""}
          data-agent-current-task-step={agentCurrentTaskProjection.step}
          data-agent-current-task-source={agentCurrentTaskProjection.source}
          data-agent-current-task-effect={agentCurrentTaskProjection.effect}
          data-agent-current-task-confirmation={agentCurrentTaskProjection.requiresConfirmation ? "true" : "false"}
          data-agent-current-task-confirmation-id={agentCurrentTaskProjection.confirmationId || ""}
          data-agent-current-task-job-id={agentCurrentTaskProjection.jobId || ""}
          data-agent-project-status-stage={projectStatusView?.stage || ""}
        >
          <button
            type="button"
            className="minimal-agent-file-button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="添加脚本、图片或声音参考"
            aria-describedby={!focusedTurnVisible && showComposerMaterialIntakeHint ? "minimal-agent-material-intake-help" : undefined}
            title={COMPOSER_MATERIAL_INTAKE_HELP}
          >
            <Plus size={15} aria-hidden="true" />
            添加文件
          </button>
          <div className="minimal-agent-footer-copy" aria-label="当前输入提示">
            {clarificationTurnVisible ? <>
              <small className="minimal-agent-footer-target">
                {clarificationProjection?.targetLabel || "当前镜头"} · Clarify
              </small>
              <strong>选择一个方向，或继续补充；不会写项目。</strong>
            </> : proposalTurnVisible ? <>
              <small className="minimal-agent-footer-target">
                {displayedProposalProjection?.targetLabel || "当前范围"} · Proposal
              </small>
              <strong>确认前只保留提案，不会调用外部生成服务。</strong>
            </> : paidConfirmationTurnVisible ? <>
              <small className="minimal-agent-footer-target">
                {agentCurrentTaskProjection.label} · Confirmation
              </small>
              <strong>输入修改会返回调整，不会执行当前任务。</strong>
            </> : runningTurnVisible ? <>
              <small className="minimal-agent-footer-target">
                {agentCurrentTaskProjection.label} · Running
              </small>
              <strong>可以继续讨论；当前任务不会重复提交或自动重试。</strong>
            </> : reviewTurnVisible ? <>
              <small className="minimal-agent-footer-target">
                {effectiveReviewTarget?.label || "当前视频"} · needs_review
              </small>
              <strong>补充修改意图不会自动重试或提交。</strong>
            </> : <>
              {footerSelectionTargetCopy && <small className="minimal-agent-footer-target">{footerSelectionTargetCopy}</small>}
              {showComposerMaterialIntakeHint && (
                <small id="minimal-agent-material-intake-help" className="minimal-agent-material-intake-hint">
                  {COMPOSER_MATERIAL_INTAKE_HELP}
                </small>
              )}
              {footerHintCopy && <small>{footerHintCopy}</small>}
              <strong>{footerStatusCopy}</strong>
            </>}
          </div>
          <button
            type="button"
            className="minimal-agent-send-button"
            disabled={footerPrimaryDisabled}
            title={footerPrimaryTitle}
            onPointerDown={handleSendPointerDown}
            onMouseDown={handleSendMouseDown}
            onClick={handleSendClick}
            aria-label={footerPrimaryAriaLabel}
          >
            <Send size={15} />
            {footerPrimaryLabel}
          </button>
        </div>
      </div>
      <div className="minimal-agent-status-row">
        <span>现在</span>
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
      {showDisplayedPrototypeAgentProjection && displayedPrototypeAgentProjection && (
        <div className="minimal-agent-badges" aria-label="创作者预览状态">
          <small>{displayedPrototypeAgentProjection.statusLabel}</small>
          {displayedPrototypeAgentProjection.badges.filter((badge) => badge !== displayedPrototypeAgentProjection.statusLabel).map((badge) => (
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
                  referenceHasReviewableOutput
                    ? `${referenceReviewableCount} 项参考等你复核。`
                  : referenceGenerationBlockedByContract
                    ? agentVideoPermissionDisplayDetail(currentVideoPermissionContract)
                    : referenceGenerationBlockedByProject
                      ? "先选择保存位置，再生成参考。"
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
                    ? agentVideoPermissionDisplayDetail(currentVideoPermissionContract)
                    : videoPermissionBlockedByProject
                      ? "先选择保存位置，再发送视频。"
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
                    ? agentVideoPermissionDisplayDetail(currentVideoPermissionContract)
                    : referenceGenerationBlockedByProject
                      ? "先选择保存位置，再生成结束画面。"
                      : endFrameAction.message || "只用于循环、变身或明确首尾控制；生成后先放到复核区。"
                }</small>
              </div>
              <button
                disabled={referenceGenerationBlockedByProject || endFrameAction.disabled || !endFrameAction.keyConfigured || endFrameBusy}
                onClick={runFooterEndFrameGeneration}
                aria-label={referenceGenerationBlockedByContract ? "先继续准备参考" : referenceGenerationBlockedByProject ? "先选择保存位置" : "生成当前镜头结束画面"}
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
    && action.target.kind === "shot"
    && action.proposedChanges.length > 0;
}
