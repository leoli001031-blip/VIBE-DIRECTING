import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, ExternalLink, LockKeyhole, MessageCircle, Pencil, Plus, RotateCcw, Search, Send, Sparkles, X } from "lucide-react";
import {
  agentWebSearchSourceLabel,
  buildAgentWebResearchSuggestion,
  buildDirectorResearchQuery,
  defaultAgentWebSearchSettings,
  runAgentWebSearch as requestAgentWebSearch,
  type AgentWebSearchResult,
  type AgentWebSearchSettings,
} from "../../core/agentWebSearchClient";
import {
  buildDirectorAgentActionEnvelope,
  buildDirectorAgentStateSnapshot,
  directorAgentExecutionContractFromCreatorBoundary,
  directorAgentReadinessActions,
  type DirectorAgentActionEnvelope,
  type DirectorAgentSuggestedAction,
} from "../../core/directorAgentAction";
import { isDirectorAgentPermissionControlOnlyIntent } from "../../core/directorAgentPermissionIntent";
import type { DirectorQaUserFeedback } from "../../core/directorQaUserFeedback";
import {
  buildDirectorAgentToolHandoff,
  isDirectorAgentReferenceGenerationHandler,
  type DirectorAgentToolAvailability,
  type DirectorAgentToolHandoff,
} from "../../core/directorAgentToolHandoff";
import { buildDirectorAgentToolTrace } from "../../core/directorAgentToolTrace";
import {
  buildProjectInboxProjection,
  buildProjectObservation,
  routeProjectAgentIntent,
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
import type { ProjectAgentActionLogItem, ProjectAgentStagedPlanDraft } from "../../project";
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
  directorSkillSummaryForShot,
} from "./directorSkillUi";
import { agentProjectRequirementCopy } from "./agentProjectRequirementCopy";
import type { DirectorView } from "./directorTypes";
import type { CreatorAgentCommand } from "./creatorDeskTypes";
import { formatShotNumber } from "./MinimalStoryFlow";
import { usesEndpointEndFrame } from "./videoControlModeUi";

type DirectorWorkflowInput = Parameters<typeof buildDirectorWorkflowState>[0];

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
    || action.kind === "prepare_export"
    || action.kind === "request_style_research"
    || action.kind === "review_reference_asset"
    || action.kind === "update_shot_strategy"
    || (action.kind === "revise_story_or_shot" && action.proposedChanges.length > 0);
}

function carriesProjectDraftChange(action: DirectorAgentActionEnvelope) {
  return action.proposedChanges.some((change) => change.field === "projectDraft");
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
  return stagedAction;
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
          : "先准备视频",
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

function agentCapabilityGlanceItems(items: ReturnType<typeof agentCapabilityItems>) {
  const attentionItems = items.filter((item) => item.tone !== "ready");
  return (attentionItems.length ? attentionItems : items.filter((item) => item.id !== "project")).slice(0, 3);
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
  const focus = [...parts].reverse().find((part) => /^(正在看|已选择|镜头|素材|段落|整个项目|导出)/u.test(part));
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
  if (kind === "file") return "用途：作为补充材料，等待 AI 导演先整理再确认。";
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
  if (agentToolOnlyNeedsConfirmation(handoff)) return "确认后写项目";
  if (handoff.status === "ready") return "先保存项目，再执行动作";
  return "已保存计划，动作未开始";
}

function agentToolOnlyNeedsConfirmation(handoff: DirectorAgentToolHandoff) {
  return handoff.status === "blocked"
    && handoff.blockers.length === 1
    && handoff.blockers[0] === "user_confirmation_required";
}

function agentToolPlannedResultLabel(handler: DirectorAgentToolHandoff["handler"]) {
  if (handler === "project_vibe_patch") return "确认后写入项目";
  if (handler === "web_search") return "确认后资料进参考";
  if (handler === "image2_reference_generation") return "确认后图片进复核";
  if (handler === "seedance_video_submit") return "确认后排队回预览";
  if (handler === "project_export") return "确认后导出素材包";
  return "确认后执行";
}

function agentToolResultLabel(handoff: DirectorAgentToolHandoff) {
  if (handoff.status === "handled_by_project_write") return "不需要额外动作";
  if (agentToolOnlyNeedsConfirmation(handoff)) return agentToolPlannedResultLabel(handoff.handler);
  if (handoff.status === "ready") {
    if (handoff.handler === "web_search") return "资料先进入参考";
    if (handoff.handler === "image2_reference_generation") return "图片先进入复核";
    if (handoff.handler === "seedance_video_submit") return "排队后回到预览";
    if (handoff.handler === "project_export") return "导出素材包";
  }
  return handoff.userFacingMessage;
}

function agentShotScopeLabel(shotIds: string[]) {
  if (!shotIds.length) return "整个项目";
  if (shotIds.length === 1) return `镜头 ${formatShotNumber(shotIds[0] || "")}`;
  if (shotIds.length <= 3) return shotIds.map((shotId) => `镜头 ${formatShotNumber(shotId)}`).join("、");
  return `${shotIds.length} 个镜头`;
}

function agentTargetScopeLabel(action?: DirectorAgentActionEnvelope) {
  if (!action) return "整个项目";
  if (action.target.kind === "shot" && action.target.ids[0]) return agentShotScopeLabel([action.target.ids[0]]);
  if (action.target.kind === "multi_shot") return agentShotScopeLabel(action.target.ids);
  return action.target.label || "整个项目";
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
  if (handoff.handler === "project_export") return { view: "export", label: "去导出" };
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
  if (action.executionContract.mode === "reference_allowed") return "可做参考";
  return "可发视频";
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
  if (action.toolPlan.toolName === "project_vibe_patch") return "只写项目";
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
        label: "写项目",
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
      label: "写项目",
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

function agentToolBlockedStatus(handoff: DirectorAgentToolHandoff) {
  return `${handoff.userFacingMessage}。项目会保留，调整后可以重试。`;
}

function agentToolHandoffBindingIssue(
  action: DirectorAgentActionEnvelope,
  handoff: DirectorAgentToolHandoff,
) {
  const taskEnvelope = handoff.invocation?.taskEnvelope;
  const changedMessage = "这次动作已经变化，请重新发送一次。";
  if (handoff.actionId !== action.actionId) return changedMessage;
  if (handoff.handler !== action.toolPlan.toolName) return changedMessage;
  if (handoff.expectedReceipt !== action.toolPlan.expectedReceipt) return changedMessage;
  if (handoff.status !== "ready") return undefined;
  if (handoff.invocation?.confirmation.actionId !== action.actionId) return changedMessage;
  if (handoff.invocation?.confirmation.expectedReceipt !== action.toolPlan.expectedReceipt) return changedMessage;
  if (!taskEnvelope) return undefined;
  if (taskEnvelope.actionId !== action.actionId) return changedMessage;
  if (taskEnvelope.handoffId !== handoff.handoffId) return changedMessage;
  if (taskEnvelope.handler !== action.toolPlan.toolName) return changedMessage;
  if (taskEnvelope.expectedReceipt !== action.toolPlan.expectedReceipt) return changedMessage;
  if (taskEnvelope.providerSubmitAllowed !== action.toolPlan.providerSubmitAllowed) return changedMessage;
  return undefined;
}

function agentActionFieldLabel(field: string) {
  if (field === "projectStatus") return "项目状态";
  if (field === "referenceStatus") return "参考状态";
  if (field === "nextActions") return "后续动作";
  if (field === "referenceStrategy") return "生成方式";
  if (field === "knowledgeReferences") return "资料参考";
  if (field === "referenceAssets") return "参考素材";
  if (field === "assetStatus") return "素材状态";
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
  if (value.includes("不用再执行")) return "只写项目";
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

type ConfirmedAgentToolRunStatus = "skipped" | "completed" | "blocked" | "failed";

interface ConfirmedAgentToolRunOutcome {
  status: ConfirmedAgentToolRunStatus;
  label: string;
  projectRecordPreserved: boolean;
  waitingReview?: boolean;
  previewReady?: boolean;
  resultStatus?: "ready" | "running";
}

type AgentActionLogItem = ProjectAgentActionLogItem;
type AgentResultViewTarget = NonNullable<AgentActionLogItem["resultView"]>;

function isToolActionState(value: unknown): value is { status?: string; message?: string; qaFeedback?: DirectorQaUserFeedback } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function referenceGenerationToolOutcome(value: unknown): ConfirmedAgentToolRunOutcome {
  const state = isToolActionState(value) ? value : undefined;
  if (state?.status === "blocked" || state?.status === "missing") {
    return {
      status: "blocked",
      label: state.message || "参考生成被拦住，项目已保留。",
      projectRecordPreserved: true,
      waitingReview: true,
      previewReady: false,
    };
  }
  if (state?.status === "needs_review" || state?.status === "verified") {
    return {
      status: "completed",
      label: state.message || "参考已生成，去参考区复核。",
      projectRecordPreserved: true,
      waitingReview: true,
      previewReady: false,
      resultStatus: "ready",
    };
  }
  return {
    status: "completed",
    label: state?.message || "参考已开始生成",
    projectRecordPreserved: true,
    waitingReview: true,
    previewReady: false,
    resultStatus: "running",
  };
}

function videoSubmitToolOutcome(value: unknown): ConfirmedAgentToolRunOutcome {
  const state = isToolActionState(value) ? value : undefined;
  if (state?.status === "blocked") {
    return {
      status: "blocked",
      label: state.qaFeedback?.summary || state.message || "视频暂时不能发送，项目已保留。",
      projectRecordPreserved: true,
      waitingReview: true,
      previewReady: false,
    };
  }
  if (state?.status === "needs_review") {
    return {
      status: "completed",
      label: state.message || "视频已生成，等待复核。",
      projectRecordPreserved: true,
      waitingReview: true,
      previewReady: true,
      resultStatus: "ready",
    };
  }
  if (state?.status === "submitted") {
    return {
      status: "completed",
      label: state.message || "视频已发送，即梦排队中。",
      projectRecordPreserved: true,
      waitingReview: false,
      previewReady: false,
      resultStatus: "running",
    };
  }
  return {
    status: "completed",
    label: state?.message || "视频已发送，排队后回到预览",
    projectRecordPreserved: true,
    waitingReview: false,
    previewReady: false,
    resultStatus: "running",
  };
}

function exportToolOutcome(value: unknown): ConfirmedAgentToolRunOutcome {
  const state = isToolActionState(value) ? value : undefined;
  if (state?.status === "blocked") {
    return {
      status: "blocked",
      label: state.message || "导出还没准备好，项目已保留。",
      projectRecordPreserved: true,
      waitingReview: false,
      previewReady: false,
    };
  }
  if (state?.status === "failed") {
    return {
      status: "failed",
      label: state.message || "导出失败，项目已保留。",
      projectRecordPreserved: true,
      waitingReview: false,
      previewReady: false,
    };
  }
  if (state?.status === "ready") {
    return {
      status: "completed",
      label: state.message || "导出包已生成。",
      projectRecordPreserved: true,
      waitingReview: false,
      previewReady: false,
      resultStatus: "ready",
    };
  }
  return {
    status: "completed",
    label: "导出已开始。",
    projectRecordPreserved: true,
    waitingReview: false,
    previewReady: false,
    resultStatus: "running",
  };
}

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
    const label = toolRunOutcome?.status === "completed" ? toolRunOutcome.label : "参考已开始生成";
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
  const title = action.summary || agentToolHandlerLabel(action.toolPlan.toolName);
  const scope = agentActionScopeLabel(action, handoff, planPhase);
  const nextStep = handoff ? agentConfirmedResultNextStep(handoff, run) : agentNextControlledStepLabel(action, handoff, planPhase);
  const resultView = blocked ? undefined : agentResultViewTarget(handoff);
  return {
    id: action.actionId,
    title,
    scope,
    result: resultLabel || "已完成",
    nextStep,
    resultView,
    followUpIntent: [
      `继续刚才的动作：${title}`,
      `范围：${scope}`,
      `结果：${resultLabel || "已完成"}`,
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

export function MinimalAgentPanel({
  runtimeState,
  projectScopeLabel,
  projectStatusLabel,
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
  onStagePrototypeAgentPlan,
  onRememberAgentActionLogItem,
  onSaveResearchAsReference,
  onCreateP6RealSample,
  onCreateImage2EndFrame,
  onCreateLocalProject,
  onSendSeedanceVideo,
  onRunExport,
  onOpenResultView,
  agentCommand,
  videoPermissionContract,
  onVideoPermissionContractChange,
  storyboardProjectPlanInput,
  onDirectorFeedbackConfirmed,
}: {
  runtimeState: ProjectRuntimeState;
  projectScopeLabel?: string;
  projectStatusLabel?: string;
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
  };
  webSearchSettings?: AgentWebSearchSettings;
  webSearchReady?: boolean;
  projectReferenceGuide?: KnowledgePackManifest;
  restoredAgentStagedPlanDraft?: ProjectAgentStagedPlanDraft;
  restoredAgentActionLog?: ProjectAgentActionLogItem[];
  onSaveResearchAsReference?: (input: {
    result: AgentWebSearchResult;
    userIntent: string;
  }) => KnowledgePack | Promise<KnowledgePack>;
  onRememberAgentActionLogItem?: (item: ProjectAgentActionLogItem) => void | Promise<void>;
  onCreateLocalProject?: () => unknown | Promise<unknown>;
  onCreateP6RealSample?: (target?: AgentControlledToolInvocationTarget) => unknown | Promise<unknown>;
  onCreateImage2EndFrame?: () => void | Promise<void>;
  onSendSeedanceVideo?: (target?: AgentControlledToolInvocationTarget) => unknown | Promise<unknown>;
  onRunExport?: (target?: Pick<AgentControlledToolInvocationTarget, "agentToolTrace">) => unknown | Promise<unknown>;
  onOpenResultView?: (view: DirectorView) => void;
  agentCommand?: CreatorAgentCommand;
  videoPermissionContract?: AgentVideoPermissionContract;
  onVideoPermissionContractChange?: (contract: AgentVideoPermissionContract) => void;
  storyboardProjectPlanInput?: StoryboardReferenceProjectPlannerInput;
  onDirectorFeedbackConfirmed?: (recompile: DirectorFeedbackRecompileResult) => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousSelectionFocusKeyRef = useRef("");
  const previousRuntimeProjectKeyRef = useRef("");
  const restoredAgentDraftIdRef = useRef("");
  const restoredAgentLogKeyRef = useRef("");
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
  const [referenceStatus, setReferenceStatus] = useState<"idle" | "saving" | "saved" | "blocked">("idle");
  const [isPreparingPlan, setIsPreparingPlan] = useState(false);
  const [isRetryingTool, setIsRetryingTool] = useState(false);
  const [isComposerCollapsed, setIsComposerCollapsed] = useState(false);
  const [preparedContext, setPreparedContext] = useState<PreparedComposerContext | undefined>();
  const [agentActionEnvelope, setAgentActionEnvelope] = useState<DirectorAgentActionEnvelope | undefined>();
  const [agentToolHandoff, setAgentToolHandoff] = useState<DirectorAgentToolHandoff | undefined>();
  const [agentActionLog, setAgentActionLog] = useState<AgentActionLogItem[]>([]);
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
  const displayedScopeLabel = workflow ? preparedContext?.scopeLabel || scopeLabel : scopeLabel;
  const displayedSelectionHint = workflow ? preparedContext?.selectionHint || selectionHint : selectionHint;
  const displayedCompactScopeLabel = compactAgentScopeLabel(displayedScopeLabel);
  const displayedCompactSelectionHint = compactAgentSelectionHint(displayedSelectionHint);
  const inputPlaceholder = hasActiveSelection
    ? "说这块怎么改..."
    : "写脚本、提需求，或拖入图片/声音参考/文档。";
  const liveSelectionChips = selectionContextChips({
    shot,
    selectedShots,
    asset,
    sectionLabel: hasSectionSelection ? sectionLabel : undefined,
  });

  function rememberConfirmedAgentActionLogItem(item: AgentActionLogItem) {
    setAgentActionLog((items) => rememberAgentActionLogItem(items, item));
    void onRememberAgentActionLogItem?.(item);
  }
  const preparedSelectionChips = preparedSelectionContextChips({ context: preparedContext, runtimeState });
  const displayedSelectionChips = workflow && preparedSelectionChips.length ? preparedSelectionChips : liveSelectionChips;
  const selectionFocusKey = [scopedShotKey, shot?.id, asset?.id, sectionId].filter(Boolean).join("::");
  const prototypeAgentDemo = planPhase === "confirmed" && localPrototypeAgentDemo
    ? localPrototypeAgentDemo
    : latestPrototypeAgentDemo || localPrototypeAgentDemo;
  const prototypeAgentProjection = buildPrototypeAgentDemoProjection(prototypeAgentDemo);
  const realSampleBusy = realSampleAction?.status === "running";
  const endFrameBusy = endFrameAction?.status === "running";
  const videoBusy = videoSendAction?.status === "running";
  const videoCanResume = Boolean(videoSendAction?.canResume);
  const videoAlreadySent = (videoSendAction?.status === "submitted" && !videoCanResume) || videoSendAction?.status === "needs_review";
  const runtimeProjectKey = [
    runtimeState.project.root ? `root:${runtimeState.project.root}` : "",
    runtimeState.sourceIndexSummary.projectId ? `id:${runtimeState.sourceIndexSummary.projectId}` : "",
  ].filter(Boolean).join("::") || `title:${runtimeState.project.title || "unbound"}`;
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
  const agentCommandKind = agentCommand?.kind;
  const showEndpointEndFrameControls = usesEndpointEndFrame(shot) || selectedShots.some(usesEndpointEndFrame);
  const videoResultIsPrimary = videoCanResume || videoBusy || videoAlreadySent;
  const showRealSampleAction = !videoResultIsPrimary && Boolean(agentCommandKind === "generate_references" || realSampleAction?.keyConfigured || realSampleAction?.status === "running" || realSampleAction?.status === "needs_review" || realSampleAction?.status === "verified");
  const showEndFrameAction = !videoResultIsPrimary && showEndpointEndFrameControls && Boolean(endFrameAction?.keyConfigured || endFrameAction?.status === "running" || endFrameAction?.status === "needs_review" || endFrameAction?.status === "verified");
  const showVideoAction = Boolean(videoSendAction && runtimeState.storyFlow.shots.length > 0 && (
    agentCommandKind === "submit_video"
    || agentCommandKind === "resume_video"
    || agentCommandKind === "wait_video"
    || agentCommandKind === undefined
  ));
  const selectedSkillSummary = shot ? directorSkillSummaryForShot(shot) : undefined;
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
  const videoPermissionBlockedByContract = !videoCanResume && !agentVideoPermissionAllowsVideo(currentVideoPermissionContract);
  const videoPermissionBlockedByProject = !localProjectReadyForTools;
  const videoPermissionModeItems: Array<{ mode: AgentVideoPermissionMode; label: string }> = [
    { mode: "plan_only", label: "先整理" },
    { mode: "reference_allowed", label: "可做参考" },
    { mode: "video_allowed", label: "可发视频" },
  ];
  const realSampleLabel = realSampleBusy
    ? "生成中"
    : referenceGenerationBlockedByProject
      ? "先保存项目"
    : referenceGenerationBlockedByContract
      ? "允许做参考"
    : realSampleAction?.status === "needs_review"
      ? "等待复核"
    : realSampleAction?.status === "verified"
        ? "已完成"
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
      ? "允许做参考"
    : endFrameAction?.status === "needs_review"
      ? "等待复核"
      : endFrameAction?.status === "verified"
        ? "已完成"
        : "生成结束画面";
  const videoActionLabel = videoBusy
    ? videoCanResume ? "查询中" : "发送中"
    : videoCanResume
      ? "查询结果"
    : videoSendAction?.suggestedActionLabel
      ? videoSendAction.suggestedActionLabel
    : videoPermissionBlockedByProject
      ? "先保存项目"
    : videoPermissionBlockedByContract
      ? "允许发视频"
    : videoAlreadySent
      ? "已发送"
      : "发送视频";
  const agentBoundarySummaryLabel = videoCanResume
    ? "可查询结果"
    : videoBusy || videoAlreadySent || agentCommandKind === "wait_video"
      ? "等待结果"
      : agentVideoPermissionLabel(videoPermissionContractForUi);
  const agentBoundaryDetail = videoCanResume
    ? "即梦已收到任务；现在只查询结果，不会重复发送。"
    : videoBusy
      ? "正在处理视频任务，等结果出来后再继续。"
      : videoAlreadySent
        ? "视频已发送，等待结果。"
        : agentVideoPermissionDetail(videoPermissionContractForUi);

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
    if (!hasProjectBoundAgentState) return;
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
    setAgentActionLog([]);
    restoredAgentDraftIdRef.current = "";
    restoredAgentLogKeyRef.current = "";
    setStatus(hasComposerDraft ? "项目已切换，输入已清空" : "项目已切换，重新发送即可");
  }, [hasComposerDraft, hasProjectBoundAgentState, runtimeProjectKey, runtimeState.storyFlow.shots.length]);

  useEffect(() => {
    if (!localProjectReadyForTools) {
      restoredAgentLogKeyRef.current = "";
      setAgentActionLog([]);
      return;
    }
    const restoredItems = (restoredAgentActionLog || []).slice(0, 4);
    const nextKey = agentActionLogKey(restoredItems);
    if (!nextKey || restoredAgentLogKeyRef.current === nextKey) return;
    restoredAgentLogKeyRef.current = nextKey;
    setAgentActionLog(restoredItems);
  }, [localProjectReadyForTools, restoredAgentActionLog]);

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
    if (!selectionFocusKey || !hasBoundSelection || workflow || text.trim()) {
      previousSelectionFocusKeyRef.current = selectionFocusKey;
      return;
    }
    if (previousSelectionFocusKeyRef.current === selectionFocusKey) return;
    previousSelectionFocusKeyRef.current = selectionFocusKey;
    if (!canAutoFocusComposer()) return;
    window.setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 0);
  }, [asset?.id, hasBoundSelection, scopedShotKey, sectionId, selectionFocusKey, shot?.id, text, workflow]);

  function updateVideoPermissionContract(nextContract: AgentVideoPermissionContract) {
    setLocalVideoPermissionContract(nextContract);
    onVideoPermissionContractChange?.(nextContract);
  }

  function selectVideoPermissionMode(mode: AgentVideoPermissionMode) {
    if (workflow) return;
    const nextContract = agentVideoPermissionForMode(mode);
    updateVideoPermissionContract(nextContract);
    setStatus(agentVideoPermissionLabel(nextContract));
  }

  function runFooterReferenceGeneration() {
    if (!realSampleAction) return;
    if (referenceGenerationBlockedByProject) {
      setStatus("先打开或保存本地项目。");
      return;
    }
    if (referenceGenerationBlockedByContract) {
      const nextContract = agentVideoPermissionForMode("reference_allowed");
      updateVideoPermissionContract(nextContract);
      setStatus("已允许做参考，再点生成参考继续。");
      return;
    }
    if (!realSampleAction.keyConfigured) {
      setStatus("先在设置里连接图片服务。");
      return;
    }
    if (realSampleAction.disabled || realSampleBusy || !onCreateP6RealSample) {
      setStatus(realSampleAction.message || (realSampleBusy ? "参考正在生成。" : "当前还不能生成参考。"));
      return;
    }
    setStatus("已发送参考任务。");
    void onCreateP6RealSample({ scope: "project", videoPermissionContract: currentVideoPermissionContract });
  }

  function runFooterEndFrameGeneration() {
    if (!endFrameAction) return;
    if (referenceGenerationBlockedByProject) {
      setStatus("先打开或保存本地项目。");
      return;
    }
    if (referenceGenerationBlockedByContract) {
      const nextContract = agentVideoPermissionForMode("reference_allowed");
      updateVideoPermissionContract(nextContract);
      setStatus("已允许做参考，再点生成结束画面继续。");
      return;
    }
    if (!endFrameAction.keyConfigured) {
      setStatus("先在设置里连接图片服务。");
      return;
    }
    if (endFrameAction.disabled || endFrameBusy || !onCreateImage2EndFrame) {
      setStatus(endFrameAction.message || (endFrameBusy ? "结束画面正在生成。" : "当前还不能生成结束画面。"));
      return;
    }
    setStatus("已发送结束画面任务。");
    void onCreateImage2EndFrame();
  }

  function runFooterVideoAction() {
    if (!videoSendAction) return;
    if (videoPermissionBlockedByProject) {
      setStatus("先打开或保存本地项目。");
      return;
    }
    if (!videoCanResume && videoPermissionBlockedByContract) {
      const nextContract = agentVideoPermissionForMode("video_allowed");
      updateVideoPermissionContract(nextContract);
      setStatus("已允许发视频，再点发送视频继续。");
      return;
    }
    if (videoBusy || !onSendSeedanceVideo) {
      setStatus(videoBusy ? "视频任务正在处理。" : "当前还不能发送视频。");
      return;
    }
    if (!videoCanResume && (videoSendAction.disabled || !videoSendAction.ready || !videoSendAction.keyConfigured || videoAlreadySent)) {
      setStatus(videoSendAction.message || "视频还不能发送。");
      return;
    }
    setStatus(videoCanResume ? "开始查询视频结果。" : "开始发送视频。");
    void onSendSeedanceVideo({ videoPermissionContract: currentVideoPermissionContract });
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
    const referenceGenerationReady = Boolean(
      localProjectReadyForTools
      && onCreateP6RealSample
      && (!realSampleAction || (realSampleAction.keyConfigured && !realSampleAction.disabled && !realSampleBusy))
    );
    return {
      projectReady: localProjectReadyForTools,
      webSearchReady: effectiveWebSearchReady,
      referenceGenerationReady,
      videoSubmitReady: Boolean(localProjectReadyForTools && onSendSeedanceVideo && videoSendAction?.ready && videoSendAction.keyConfigured && (!videoAlreadySent || videoCanResume)),
      exportReady: Boolean(localProjectReadyForTools && onRunExport),
    };
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

  async function prepareChange(intentOverride?: string) {
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
      setStatus("正在整理");
      const nextVideoPermissionContract = detectAgentVideoPermissionContract(userIntent, activeVideoPermissionContract);
      const nextActionVideoPermissionContract = visibleVideoPermissionContractFor(nextVideoPermissionContract);
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
        selectedShotId: scopedShotIds.length <= 1 ? currentSelectedShotId : undefined,
        selectedShotIds: scopedShotIds.length > 1 ? scopedShotIds : undefined,
        selectedAssetId: asset?.id,
        sectionId: !scopedShotIds.length && !asset ? sectionId : undefined,
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
        }),
        executionContract: directorAgentExecutionContractFromCreatorBoundary({
          mode: nextActionVideoPermissionContract.mode,
          referenceGenerationAllowed: nextActionVideoPermissionContract.referenceGenerationAllowed,
          videoSubmitAllowed: nextActionVideoPermissionContract.videoSubmitAllowed,
          reason: nextActionVideoPermissionContract.reason,
        }),
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
          videoPermissionContract: nextActionVideoPermissionContract,
          availability: currentAgentToolAvailability(),
          generatedAt: nextWorkflow.generatedAt,
        });
      } catch (error) {
        console.error("Failed to stage Product Agent plan", error);
        resetPreparedComposerState("整理失败，请重试");
        return;
      }
      const nextAgentActionEnvelope = choosePreparedAgentAction(
        localAgentActionEnvelope,
        stagedAgentPlan?.agentActionEnvelope,
      );
      const agentResolvedShotIds = agentActionTargetShotIds(nextAgentActionEnvelope);
      const finalPreparedSelection: PreparedComposerContext = {
        ...preparedSelection,
        selectedShotId: preparedSelection.selectedShotId || (agentResolvedShotIds.length === 1 ? agentResolvedShotIds[0] : undefined),
        selectedShotIds: preparedSelection.selectedShotIds || (agentResolvedShotIds.length > 1 ? agentResolvedShotIds : undefined),
        sectionId: agentResolvedShotIds.length ? undefined : preparedSelection.sectionId,
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
      setAgentToolHandoff(stagedAgentPlan?.agentToolHandoff);
      setPlanPhase("review");
      setText("");
      setAttachments([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setStatus(nextAgentActionEnvelope.status === "blocked"
          ? "需要补充"
        : agentActionIsStatusInspection(nextAgentActionEnvelope)
          ? "已检查项目状态"
        : !agentVideoPermissionAllowsVideo(nextActionVideoPermissionContract)
          ? agentVideoPermissionLabel(nextActionVideoPermissionContract)
        : directorFeedbackCanConfirm(nextFeedbackRecompile)
          ? "等你确认"
          : directorFeedbackNeedsConcreteDirection(nextFeedbackRecompile)
            ? "再说具体一点"
            : workflowCanConfirm(nextWorkflow) ? "等你确认" : nextProjection.shortLabel);
    } finally {
      setIsPreparingPlan(false);
    }
  }

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
    if (nextIntent) await prepareChange(nextIntent);
  }

  async function continueFromStatusActionPath(intent: string) {
    const nextIntent = intent.trim();
    closeReadOnlyAgentStatus();
    if (nextIntent) await prepareChange(nextIntent);
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
    await prepareChange("现在项目怎么样");
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
    await prepareChange("下一步");
  }

  function buildConfirmedAgentToolHandoff(action: DirectorAgentActionEnvelope | undefined) {
    if (!action) {
      return undefined;
    }
    return buildDirectorAgentToolHandoff({
      action,
      userConfirmed: true,
      availability: currentAgentToolAvailability(),
    });
  }

  async function runConfirmedAgentTool(
    action: DirectorAgentActionEnvelope | undefined,
    userIntent: string,
    preparedHandoff?: DirectorAgentToolHandoff,
  ): Promise<ConfirmedAgentToolRunOutcome> {
    if (!action) {
      setStatus("预览已生成");
      return { status: "skipped", label: "预览已生成", projectRecordPreserved: true };
    }
    const handoff = preparedHandoff || buildConfirmedAgentToolHandoff(action);
    if (!handoff) {
      setStatus("预览已生成");
      return { status: "skipped", label: "预览已生成", projectRecordPreserved: true };
    }
    const bindingIssue = agentToolHandoffBindingIssue(action, handoff);
    if (bindingIssue) {
      const label = `${bindingIssue}项目已保留。`;
      setStatus(label);
      return { status: "blocked", label, projectRecordPreserved: true };
    }
    setAgentToolHandoff(handoff);
    setStatus(handoff.userFacingMessage);

    if (handoff.status === "handled_by_project_write") {
      return { status: "completed", label: "修改已写入项目", projectRecordPreserved: true };
    }

    if (handoff.status !== "ready") {
      const label = agentToolBlockedStatus(handoff);
      setStatus(label);
      return { status: "blocked", label, projectRecordPreserved: true };
    }

    const invocation = handoff.invocation;
    if (!invocation) {
      const label = "动作缺少确认后的执行信息，项目已保留。";
      setStatus(label);
      return { status: "blocked", label, projectRecordPreserved: true };
    }
    const toolTraceResult = buildDirectorAgentToolTrace(action, handoff);
    if (!toolTraceResult.ok || !toolTraceResult.trace) {
      const label = "动作缺少可追踪任务，项目已保留。";
      setStatus(label);
      return { status: "blocked", label, projectRecordPreserved: true };
    }
    const toolUserIntent = invocation.userIntent || userIntent;
    const agentToolTrace = toolTraceResult.trace;

    try {
      if (handoff.handler === "web_search") {
        const query = buildDirectorResearchQuery(toolUserIntent);
        if (!query) {
          setStatus("请先说清楚要查什么。");
          return { status: "blocked", label: "请先说清楚要查什么。", projectRecordPreserved: true };
        }
        setResearchStatus("running");
        setResearchResult(undefined);
        setReferenceStatus("idle");
        const result = await requestAgentWebSearch({
          query,
          purpose: "style_research",
          settings: webSearchSettings,
          agentToolTrace,
        });
        setResearchResult(result);
        setResearchStatus("ready");
        setStatus("资料已整理，等你确认后再用。");
        return { status: "completed", label: "资料已整理，等你确认", projectRecordPreserved: true };
      }

      if (isDirectorAgentReferenceGenerationHandler(handoff.handler)) {
        const result = await onCreateP6RealSample?.({
          selectedShotIds: invocation.selectedShotIds,
          selectedAssetId: invocation.selectedAssetId,
          sectionId: invocation.sectionId,
          skipConfirm: true,
          confirmationReceiptId: handoff.handoffId,
          confirmedAt: invocation.confirmation.confirmedAt,
          agentToolTrace,
        });
        const outcome = referenceGenerationToolOutcome(result);
        setStatus(outcome.label);
        return outcome;
      }

      if (handoff.handler === "seedance_video_submit") {
        const result = await onSendSeedanceVideo?.({
          selectedShotIds: invocation.selectedShotIds,
          selectedAssetId: invocation.selectedAssetId,
          sectionId: invocation.sectionId,
          skipConfirm: true,
          confirmationReceiptId: handoff.handoffId,
          confirmedAt: invocation.confirmation.confirmedAt,
          videoPermissionContract: activeVideoPermissionContract,
          agentToolTrace,
        });
        const outcome = videoSubmitToolOutcome(result);
        setStatus(outcome.label);
        return outcome;
      }

      if (handoff.handler === "project_export") {
        const result = await onRunExport?.({ agentToolTrace });
        const outcome = exportToolOutcome(result);
        setStatus(outcome.label);
        return outcome;
      }
      return { status: "completed", label: agentToolResultLabel(handoff), projectRecordPreserved: true };
    } catch {
      if (handoff.handler === "web_search") setResearchStatus("blocked");
      const label = "动作执行失败，项目已保留，可以稍后重试。";
      setStatus(label);
      return { status: "failed", label, projectRecordPreserved: true };
    }
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
          rememberConfirmedAgentActionLogItem(
            agentActionLogItemFromResult(agentActionEnvelope, agentToolHandoff, savedFeedbackRun, "confirmed"),
          );
        }
      } catch {
        setStatus("保存失败");
        const failedFeedbackRun: PrototypeAgentDemoRun = {
          status: "error",
          result: {
            label: "修改保存失败",
            projectVibeAdded: false,
            waitingReview: true,
            status: "error",
          },
        };
        setLocalPrototypeAgentDemo(failedFeedbackRun);
        if (agentActionEnvelope) {
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
      const authoritativeAgentActionEnvelope = previewResult?.agentActionEnvelope || agentActionEnvelope;
      if (authoritativeAgentActionEnvelope) {
        setAgentActionEnvelope(authoritativeAgentActionEnvelope);
      }
      const authoritativeAgentToolHandoff = previewResult?.agentToolHandoff || confirmedAgentToolHandoff;
      if (authoritativeAgentToolHandoff) {
        setAgentToolHandoff(authoritativeAgentToolHandoff);
      }
      const toolRunOutcome = await runConfirmedAgentTool(authoritativeAgentActionEnvelope, userIntent, authoritativeAgentToolHandoff);
      const confirmedRun = confirmedToolRunResult(authoritativeAgentToolHandoff, toolRunOutcome, previewResult || undefined);
      setLocalPrototypeAgentDemo(confirmedRun);
      if (authoritativeAgentActionEnvelope) {
        rememberConfirmedAgentActionLogItem(
          agentActionLogItemFromResult(authoritativeAgentActionEnvelope, authoritativeAgentToolHandoff, confirmedRun, "confirmed"),
        );
      }
    } catch {
      setStatus("需要检查");
      const failedRun: PrototypeAgentDemoRun = {
        status: "error",
        result: {
          label: "动作执行失败，项目已保留。",
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
      const toolRunOutcome = await runConfirmedAgentTool(agentActionEnvelope, userIntent, refreshedHandoff);
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
      rememberConfirmedAgentActionLogItem(
        agentActionLogItemFromResult(agentActionEnvelope, refreshedHandoff, failedRetryRun, "confirmed"),
      );
    } finally {
      setIsRetryingTool(false);
    }
  }

  const actionBlocked = agentActionEnvelope?.status === "blocked";
  const readOnlyStatusInspection = agentActionIsStatusInspection(agentActionEnvelope);
  const displayedAgentToolHandoff = readOnlyStatusInspection ? undefined : agentToolHandoff;
  const handoffPreflightBlocked = planPhase !== "confirmed" && agentToolHasPreflightBlocker(displayedAgentToolHandoff, agentActionEnvelope);
  const confirmationBlocked = Boolean(actionBlocked || handoffPreflightBlocked);
  const canConfirm = workflowCanConfirm(workflow) && !confirmationBlocked && !readOnlyStatusInspection;
  const canConfirmFeedback = Boolean(directorFeedbackCanConfirm(feedbackRecompile) && onDirectorFeedbackConfirmed);
  const hasComposerInput = Boolean(text.trim() || attachments.length);
  const hasPreparedComposerInput = Boolean(preparedContext?.userIntent?.trim() || hasComposerInput);
  const canPreviewPrototypeDemo = Boolean(workflow && onPreviewPrototypeAgentDemo && hasPreparedComposerInput && !canConfirmFeedback && !readOnlyStatusInspection);
  const canOfferFooterDirectAction = !hasComposerInput && !isPreparingPlan && (!workflow || planPhase === "confirmed");
  const referenceFooterAction = showRealSampleAction && realSampleAction?.status !== "verified"
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
  const videoResumeFooterAction = showVideoAction && videoSendAction && videoCanResume
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
        disabled: videoPermissionBlockedByProject || (!videoPermissionBlockedByContract && (Boolean(videoSendAction.disabled) || !videoSendAction.ready || !videoSendAction.keyConfigured || videoBusy || (videoAlreadySent && !videoCanResume) || !onSendSeedanceVideo)),
        disabledReason: videoPermissionBlockedByProject
          ? "先打开或保存本地项目。"
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
  const openViewFooterAction = agentCommand && (
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
      ? videoSubmitFooterAction
      : agentCommandKind === "resume_video"
        ? videoResumeFooterAction
        : openViewFooterAction || waitFooterAction;
  const fallbackFooterDirectAction =
    videoResumeFooterAction
    || referenceFooterAction
    || endFrameFooterAction
    || videoSubmitFooterAction;
  const footerDirectAction = canOfferFooterDirectAction
    ? commandFooterDirectAction || fallbackFooterDirectAction
    : undefined;
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
  const projectNeedsLocalFolder = !localProjectReadyForTools
    && !hasComposerInput
    && (Boolean(footerDirectAction) || projectNeededForGeneratedStory);
  const projectRequiredForWorkflow = projectNeedsLocalFolder && (canCreateProjectFromFooter || localProjectBusy);
  const projectBlockedWithoutFooterResolver = projectNeedsLocalFolder
    && !canCreateProjectFromFooter
    && !localProjectBusy;
  const projectRequirement = agentProjectRequirementCopy({
    localProjectBusy,
    canCreateLocalProject: canResolveProjectFromFooter,
  });
  const composerPrimaryIsFresh = hasComposerInput || !workflow || planPhase === "idle" || planPhase === "confirmed";
  const composerProjectInbox = useMemo(
    () => buildProjectInboxProjection({
      assets: runtimeState.visualMemory.assets,
    }),
    [runtimeState.visualMemory.assets],
  );
  const selectedShotCountForObservation = selectedShots.length || (shot ? 1 : 0);
  const composerProjectObservation = useMemo(
    () => buildProjectObservation({
      localProjectReady: localProjectReadyForTools,
      projectTitle: runtimeState.project.title,
      sectionCount: runtimeState.storyFlow.sections.length,
      shotCount: runtimeState.storyFlow.shots.length,
      selectedShotCount: selectedShotCountForObservation,
      referenceMissingCount: runtimeState.visualMemory.summary.missing,
      referenceReviewCount: runtimeState.visualMemory.summary.needsReview + composerProjectInbox.needsReviewCount,
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
    }),
    [
      composerProjectInbox,
      endFrameBusy,
      localProjectReadyForTools,
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
          setStatus("正在准备本地项目文件夹。");
          void onCreateLocalProject?.();
        },
      };
    }
    if (projectBlockedWithoutFooterResolver) {
      return {
        label: "发送",
        disabled: true,
        disabledReason: "继续写想法也可以；生成参考、视频或导出前需要本地项目。",
        statusLine: "故事草案已就绪；可以继续描述修改，生成前再打开项目。",
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
        statusLine: footerDirectAction.disabled ? footerDirectAction.disabledReason : `下一步：${footerDirectAction.label}`,
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
  const sendDisabledReason = isPreparingPlan
    ? `${status || "正在整理"}，稍等一下。`
    : !hasComposerInput
      ? "先写一句，或拖入文件。"
      : "";
  const sendDisabled = Boolean(sendDisabledReason);
  const sendAriaLabel = sendDisabled ? `发送：${sendDisabledReason}` : "发送";
  function handleSend() {
    if (sendDisabled) {
      setStatus(sendDisabledReason);
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
  const footerPrimaryUsesAgentNext = !hasComposerInput && primaryLabel !== "发送";
  const footerPrimaryLabel = hasComposerInput ? (isPreparingPlan ? "整理中" : "发送") : primaryLabel;
  const footerPrimaryDisabled = hasComposerInput ? sendDisabled : primaryDisabled;
  const footerPrimaryDisabledReason = hasComposerInput ? sendDisabledReason : primaryDisabledReason;
  const footerPrimaryAriaLabel = footerPrimaryDisabled
    ? `${footerPrimaryLabel}：${footerPrimaryDisabledReason}`
    : footerPrimaryUsesAgentNext ? primaryAriaLabel : sendAriaLabel;
  const footerPrimaryTitle = footerPrimaryDisabled
    ? footerPrimaryDisabledReason
    : footerPrimaryUsesAgentNext
      ? `继续：${primaryLabel}`
      : "发送给 AI 导演，也可以按 Cmd Enter";
  const footerStatusCopy = hasComposerInput
    ? "按发送交给 AI 导演"
    : footerPrimaryUsesAgentNext
      ? `建议动作：${primaryLabel}`
      : primaryDisabled
        ? `${primaryDisabledPrefix}${primaryDisabledReason}`
        : `按下后：${statusLineText}`;
  const composerHint = projectRequiredForWorkflow
    ? canResolveProjectFromFooter
      ? `可以先点${primaryLabel}，也可以继续写想法。`
      : "当前仍可继续改想法；生成前要先准备本地项目。"
    : text.trim()
      ? `识别为：${composerIntentRoute.label} · 点发送或 Cmd Enter`
      : attachments.length
        ? `${attachments.length} 个文件 · ${composerIntentRoute.plan[0]} · 点发送`
        : projectBlockedWithoutFooterResolver
          ? "先写一句想法，或拖入素材；我还能继续帮你整理。"
          : hasBoundSelection
            ? footerPrimaryUsesAgentNext
              ? `已选中内容，直接说改法；也可以点${primaryLabel}`
              : "已选中内容，直接说改法，点发送或 Cmd Enter"
            : footerPrimaryUsesAgentNext
              ? `${composerProjectObservation.currentTask.plan} · 可点${primaryLabel}`
              : `${composerProjectObservation.currentTask.plan} · 点发送`;
  if (isComposerCollapsed) {
    return (
      <aside className="minimal-agent-panel is-collapsed">
        <button
          type="button"
          className="minimal-agent-expand-button"
          onClick={() => {
            setIsComposerCollapsed(false);
          }}
          aria-label="展开底部输入框"
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
        { label: "对象", value: agentActionEnvelope.target.label },
        { label: "进度", value: agentActionEnvelope.sourceContext.projectReadiness.summary },
        { label: "模式", value: agentActionEnvelope.sourceContext.projectReadiness.modeSummary },
        { label: "工作范围", value: agentActionEnvelope.executionContract.mode === "plan_only" ? "先整理" : agentActionEnvelope.executionContract.mode === "reference_allowed" ? "可做参考" : "可发视频" },
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
    : feedbackFacts.length
    ? feedbackFacts
    : actionFacts.length
      ? [...actionFacts, ...stagedProjectFacts]
    : workflow
    ? [...workflowPlanFacts(workflow), { label: "范围", value: "故事 / 镜头 / 复核" }]
    : [];
  const visibleActionPlanFacts = planFacts.slice(0, 4);
  const actionDiffs = agentActionDiffs(agentActionEnvelope);
  const agentUnderstanding = agentActionEnvelope?.status === "blocked"
    ? preparedContext?.qaFeedback?.summary || agentActionEnvelope.userFacingMessage
    : feedbackRecompile
    ? directorFeedbackCanConfirm(feedbackRecompile)
      ? "已整理好。确认前不会生成。"
      : "还不够明确。请说清楚要改角色、动作、分镜、场景还是声音。"
    : agentActionEnvelope
      ? agentActionEnvelope.userFacingMessage
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
  const showAgentNote = Boolean(workflow && planPhase !== "confirmed");
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
  const visibleAgentCapabilityGlanceItems = agentCapabilityGlanceItems(visibleAgentCapabilityItems);
  const hasVisibleActionCard = showAgentNote || showAgentResultNote || idleActionSuggestions.length > 0;
  const generationDetailsLabel = videoCanResume
    ? "可查询结果"
    : agentCommandKind === "generate_references" || agentCommandKind === "submit_video" || agentCommandKind === "resume_video"
      ? agentCommand?.label || "按需展开"
      : "按需查看";
  const realSampleDetailNeedsReview = agentCommandKind === "open_review" || realSampleAction?.status === "needs_review";
  const showRealSampleDetailButton = realSampleDetailNeedsReview || !referenceGenerationBlockedByProject;
  function openReferenceReviewFromDetails() {
    onOpenResultView?.("assets");
    setStatus("去参考页检查画面。");
  }
  function pointToMainReferenceAction() {
    setStatus(referenceGenerationBlockedByProject ? "先打开或保存本地项目。" : "点底部发送，让 AI 导演生成参考。");
  }
  function pointToMainVideoAction() {
    setStatus(videoCanResume ? "点底部发送，继续查询视频结果。" : "点底部发送，让 AI 导演发送视频。");
  }
  const realSampleDetailAction = realSampleDetailNeedsReview
    ? openReferenceReviewFromDetails
    : pointToMainReferenceAction;
  const realSampleDetailButtonLabel = realSampleDetailNeedsReview ? "打开复核" : "回到底部";
  const videoDetailButtonLabel = "回到底部";

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
        aria-label="收起底部输入框"
        title="收起底部输入框"
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
            <span>{hasActiveSelection ? "当前选择" : "怎么用"}</span>
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
          </section>
        </div>
      </div>
      <details className="minimal-agent-advanced-controls">
        <summary>
          <span>工作范围</span>
          <strong>{agentBoundarySummaryLabel}</strong>
          {selectedSkillSummary && <small>{selectedSkillSummary.label}</small>}
        </summary>
        <section className="minimal-agent-permission-mode minimal-agent-permission-menu" aria-label="更改工作范围">
          <span>更改范围</span>
        {videoPermissionModeItems.map((item) => (
            <button
              key={item.mode}
              type="button"
              className={videoPermissionContractForUi.mode === item.mode ? "is-active" : ""}
              aria-label={`工作范围：${item.label}`}
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
        {visibleAgentCapabilityGlanceItems.length > 0 && (
          <div className="minimal-agent-capability-strip" aria-label="AI 导演当前能力">
            {visibleAgentCapabilityGlanceItems.map((item) => (
              <small key={item.id} className={item.tone}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </small>
            ))}
          </div>
        )}
        {selectedSkillSummary && (
          <section className="minimal-agent-skill-context" aria-label="AI 选择的做法">
            <div>
              <span>AI 选择的做法</span>
              <strong>{selectedSkillSummary.label}</strong>
              <small>{selectedSkillSummary.reason}</small>
            </div>
            <div className="minimal-agent-skill-tags">
              {selectedSkillSummary.skillTags.slice(0, 5).map((tag) => (
                <small key={tag}>{tag}</small>
              ))}
            </div>
            <p className="minimal-agent-skill-hint">想换做法，直接在下面输入框说，比如“这一段改成快切”或“这里用全能参考”。</p>
          </section>
        )}
        {idleActionSuggestions.length > 0 && (
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
                    <strong>{fact.value}</strong>
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
                  <strong>{fact.value}</strong>
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
	            <small>继续点底部发送：{primaryLabel}</small>
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
                  <strong>{fact.value}</strong>
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
      {agentActionLog.length > 0 && (
        <section className="minimal-agent-action-log" aria-label="最近动作">
          <span>最近动作</span>
          <div>
            {agentActionLog.map((item) => (
              <div key={item.id} className={`minimal-agent-action-log-item ${item.tone}`}>
                <button
                  type="button"
                  className="minimal-agent-action-log-followup"
                  onClick={() => continueFromAgentActionLog(item)}
                  title="把这条动作带回输入框继续改"
                >
                  <strong>{item.title}</strong>
                  <em>{item.scope}</em>
                  <span>{item.result}</span>
                  <b>{item.nextStep}</b>
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
            ))}
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
          value={text}
          onChange={(event) => updateText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              if (hasComposerInput) handleSend();
              else handleNext();
            }
          }}
          placeholder={inputPlaceholder}
        />
        <div className="minimal-agent-input-footer">
          <button
            type="button"
            className="minimal-agent-file-button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="添加脚本、图片或声音参考"
          >
            <Plus size={15} aria-hidden="true" />
            添加文件
	          </button>
          <div className="minimal-agent-footer-copy" aria-label="底部主按钮说明">
            <small>{composerHint}</small>
            <strong>{footerStatusCopy}</strong>
          </div>
          <button
            type="button"
            className="minimal-agent-send-button"
            disabled={footerPrimaryDisabled}
            title={footerPrimaryTitle}
            onClick={hasComposerInput ? handleSend : handleNext}
            aria-label={footerPrimaryAriaLabel}
          >
            {footerPrimaryUsesAgentNext ? <ArrowRight size={15} /> : <Send size={15} />}
            {footerPrimaryLabel}
          </button>
        </div>
      </div>
      <div className="minimal-agent-status-row">
        <span>状态</span>
        <strong className="minimal-agent-status">{statusLineText}</strong>
        {projection && (
          <div className="minimal-state-dots agent" aria-label={projection.shortLabel}>
            {projection.progressDots.map((dot) => (
              <i key={dot.id} className={dot.tone} title={dot.label} />
            ))}
          </div>
        )}
      </div>
      <details className="minimal-agent-details">
        <summary>这次会改什么</summary>
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
                <strong>{fact.value}</strong>
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
        <details className="minimal-agent-generation-details">
          <summary>
            <span>生成</span>
            <strong>{generationDetailsLabel}</strong>
          </summary>
          {showRealSampleAction && realSampleAction && (
            <section className={`agent-real-sample-action ${realSampleAction.status}`} aria-label="项目参考补全">
              <div>
                <span>参考素材</span>
                <strong>{realSampleLabel}</strong>
                <small>{
                  referenceGenerationBlockedByContract
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
                  aria-label={realSampleDetailNeedsReview ? "打开参考复核" : "查看底部主按钮的参考生成动作"}
                >
                  {realSampleDetailNeedsReview ? <Sparkles size={15} /> : <ArrowRight size={15} />}
                  {realSampleDetailButtonLabel}
                </button>
              )}
            </section>
          )}
          {showVideoAction && videoSendAction && (
            <section className={`agent-real-sample-action ${videoSendAction.status}`} aria-label="视频生成">
              <div>
                <span>视频生成</span>
                <strong>{videoActionLabel}</strong>
                <small>{
                  videoCanResume
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
	                disabled={videoCanResume
	                  ? videoPermissionBlockedByProject || videoBusy || !onSendSeedanceVideo
	                  : videoPermissionBlockedByProject || Boolean(videoSendAction.disabled) || !videoSendAction.ready || !videoSendAction.keyConfigured || videoBusy || (videoAlreadySent && !videoCanResume) || !onSendSeedanceVideo}
	                onClick={pointToMainVideoAction}
	                aria-label={videoCanResume ? "查看底部主按钮的视频查询动作" : "查看底部主按钮的视频发送动作"}
	              >
	                <ArrowRight size={15} />
	                {videoDetailButtonLabel}
	              </button>
            </section>
          )}
          {showEndFrameAction && endFrameAction && (
            <section className={`agent-real-sample-action ${endFrameAction.status}`} aria-label="当前镜头特殊结束画面">
              <div>
                <span>特殊结束画面</span>
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
                aria-label={referenceGenerationBlockedByContract ? "先继续准备参考" : referenceGenerationBlockedByProject ? "先保存项目文件夹" : "生成当前镜头特殊结束画面"}
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
