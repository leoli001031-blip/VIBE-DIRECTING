import { cloneElement, isValidElement, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Clapperboard, Images, PackageCheck, PlaySquare } from "lucide-react";
import type { PreviewQueueItem } from "../../core/previewPlayerQueue";
import type { ExportActionState } from "../../core/exportAction";
import type { ExportWorkerState } from "../../core/exportWorker";
import type { ProjectRuntimeState } from "../../core/projectState";
import type { AgentVideoGenerationJobLedger } from "../../core/agentVideoProductionContract";
import type { AgentCurrentTaskProjection } from "../../core/agentCurrentTaskProjection";
import { agentNewVideoProjectTargetMode } from "../../core/agentNewVideoProjectTarget";
import type { ProjectAgentActionLogItem, ProjectAgentStagedPlanDraft } from "../../project";
import {
  buildVibeAgentTimelineStatusView,
  isVibeAgentIntakeTimelineEntry,
} from "../../agent-core";
import type { VibeAgentTimelineEntry } from "../../agent-core/types";
import type { ProjectPreviewExportState } from "../../core/types";
import type { ProjectFactsStagedApplyPlan } from "../../core/projectTransaction";
import type { RuntimeView } from "../../core/runtimeView";
import type { DirectorFeedbackRecompileResult } from "../../core/directorFeedbackRecompile";
import type { StoryboardReferenceProjectPlannerInput } from "../../core/storyboardReferenceProjectPlanner";
import type { AssetRecord, ProjectAudit, ShotRecord } from "../../core/types";
import type { KnowledgePack, KnowledgePackManifest } from "../../core/knowledgeTypes";
import type { AgentWebSearchResult, AgentWebSearchSettings } from "../../core/agentWebSearchClient";
import type { DirectorQaUserFeedback } from "../../core/directorQaUserFeedback";
import { buildProjectStatusViewModel, type ProjectStatusViewModel } from "../app/projectStatusViewModel";
import { MinimalAgentPanel } from "./MinimalAgentPanel";
import { cleanStoryText, MinimalStoryFlow } from "./MinimalStoryFlow";
import { CreatorDeskPanels } from "./CreatorDeskPanels";
import { DirectorWorkflowOverview } from "./DirectorWorkflowOverview";
import type {
  NewVideoStartAgentIntakeCommand,
  NewVideoStartConfirmationContext,
  NewVideoStartDraft,
  NewVideoStartStatus,
} from "./NewVideoStart";
import type { DirectorView } from "./directorTypes";
import {
  agentVideoSubmitContractAllowsReference as agentVideoPermissionAllowsReference,
  agentVideoSubmitContractAllowsVideo as agentVideoPermissionAllowsVideo,
  agentVideoSubmitContractForMode as agentVideoPermissionForMode,
  defaultAgentVideoSubmitContract as defaultAgentVideoPermissionContract,
  detectAgentVideoSubmitContract as detectAgentVideoPermissionContract,
  isCommittedNewVideoDraftAgentRun,
  type AgentControlledToolInvocationTarget,
  type AgentVideoSubmitContract as AgentVideoPermissionContract,
  type PrototypeAgentDemoRun,
  type PreviewPrototypeAgentDemoInput,
  type PreviewPrototypeAgentDemoResult,
  type StagePrototypeAgentPlanInput,
  type StagePrototypeAgentPlanResult,
} from "./agentPanelProjection";
import type { CreatorAgentCommand, CreatorDeskProjection, CreatorReviewLockTarget, CreatorReviewTrayItem, CreatorVideoStageProjection } from "./creatorDeskTypes";
import type { MinimalAudioPlanDialogueAudioCreated } from "./MinimalAudioPlan";

const MinimalPreview = lazy(() =>
  import("./MinimalPreview").then(({ MinimalPreview }) => ({
    default: MinimalPreview,
  })),
);
const MinimalAudioPlan = lazy(() =>
  import("./MinimalAudioPlan").then(({ MinimalAudioPlan }) => ({
    default: MinimalAudioPlan,
  })),
);
const MinimalExport = lazy(() =>
  import("./MinimalExport").then(({ MinimalExport }) => ({
    default: MinimalExport,
  })),
);
const NewVideoStart = lazy(() =>
  import("./NewVideoStart").then(({ NewVideoStart }) => ({
    default: NewVideoStart,
  })),
);

function creatorReferenceGapCount(creatorDesk?: CreatorDeskProjection) {
  const visibleMissing = Math.max(
    creatorDesk?.batchGeneration?.missingCount || 0,
    creatorDesk?.framePlan?.missingCount || 0,
  );
  if (visibleMissing > 0) return visibleMissing;
  const missingItems = creatorDesk?.assetReconciliation?.items.filter((item) => item.status === "missing") || [];
  const shotIds = new Set<string>();
  for (const item of missingItems) {
    for (const shotId of item.shotIds || []) shotIds.add(shotId);
  }
  return shotIds.size || creatorDesk?.assetReconciliation?.summary.missing;
}

function directorProjectRailVideoLabel(videoStage?: CreatorVideoStageProjection) {
  const generation = videoStage?.generation;
  if (!videoStage || videoStage.status === "not_submitted") {
    if ((generation?.completedCount || 0) > 0) return `${generation?.completedCount} 已完成`;
    return "未生成";
  }
  if (videoStage.status === "failed") return "待处理";
  if (videoStage.status === "recoverable") return "可查询";
  if (videoStage.status === "needs_review") return `${videoStage.reviewCount || generation?.completedCount || 1} 待看`;
  if (videoStage.status === "completed") return `${generation?.completedCount || videoStage.reviewCount || 1} 可预览`;
  if (generation?.status === "queued") return "排队中";
  if (generation?.status === "generating") return "生成中";
  if (generation?.status === "submitted") return "已发送";
  return "处理中";
}

function directorProjectRailReferenceLabel(
  creatorDesk: CreatorDeskProjection | undefined,
  assetCount: number,
  referenceGapCount = 0,
) {
  const summary = creatorDesk?.assetReconciliation?.summary;
  const displayedMissing = Math.max(0, Math.round(referenceGapCount));
  if (displayedMissing > 0) return `缺 ${displayedMissing} 张`;
  if ((summary?.missing || 0) > 0) return `缺 ${summary?.missing} 张`;
  if ((summary?.needsReview || 0) > 0) return `${summary?.needsReview} 待看`;
  if ((summary?.matched || 0) > 0) return `${summary?.matched} 可用`;
  return assetCount > 0 ? `${assetCount} 张` : "未放";
}

function displayableReferenceAssetCount(assets: ProjectRuntimeState["visualMemory"]["assets"]) {
  return assets.filter((asset) => {
    if (asset.type === "style") return false;
    return /\.(png|jpe?g|webp|gif)$/i.test(asset.path);
  }).length;
}

function EmptyProjectSurface({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <section className="director-empty-project" aria-label={title}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </section>
  );
}

function DirectorDetailDisclosure({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <details className="director-detail-disclosure" aria-label={title}>
      <summary>
        <span>{title}</span>
        <small>{detail}</small>
      </summary>
      <div className="director-detail-disclosure-body">{children}</div>
    </details>
  );
}

function currentTaskObjectLabel(step: AgentCurrentTaskProjection["step"] | undefined) {
  if (step === "draft_story") return "创作意图";
  if (step === "confirm_story") return "故事草案";
  if (step === "choose_save_location") return "项目位置";
  if (step === "prepare_references") return "参考素材";
  if (step === "submit_video") return "视频任务";
  if (step === "export") return "交付资料";
  return "当前项目";
}

function ProjectStatusSummary({
  status,
  currentTask,
}: {
  status: ProjectStatusViewModel;
  currentTask?: AgentCurrentTaskProjection;
}) {
  const preferredFacts = status.facts.filter((fact) => ["镜头", "参考", "视频", "交付"].includes(fact.label));
  const visibleFacts = (preferredFacts.length ? preferredFacts : status.facts).slice(0, 4);
  return (
    <section
      className={`project-status-summary ${status.tone}`}
      aria-label="项目事实概览"
      data-current-task-step={currentTask?.step || "idle"}
    >
      <div className="project-status-summary-main">
        <span>当前对象</span>
        <strong>{currentTaskObjectLabel(currentTask?.step)}</strong>
        <small>{status.issue || "状态来自当前项目事实"}</small>
      </div>
      <div className="project-status-summary-facts" aria-label="项目概览">
        {visibleFacts.map((fact, index) => (
          <span key={`${fact.label}:${fact.value}:${index}`}>
            <small>{fact.label}</small>
            <strong>{fact.value}</strong>
          </span>
        ))}
      </div>
    </section>
  );
}

function DirectorProjectRail({
  projectTitle,
  projectStatus,
  directorView,
  sections,
  activeSectionId,
  totalShots,
  referenceLabel,
  videoLabel,
  projectReady,
  onOpenDirectorView,
  onOpenSection,
}: {
  projectTitle: string;
  projectStatus: ProjectStatusViewModel;
  directorView: DirectorView;
  sections: RuntimeView["storySections"];
  activeSectionId?: string;
  totalShots: number;
  referenceLabel: string;
  videoLabel: string;
  projectReady: boolean;
  onOpenDirectorView?: (view: DirectorView) => void;
  onOpenSection: (sectionId: string) => void;
}) {
  const visibleSections = sections.slice(0, 6);
  const extraSectionCount = Math.max(0, sections.length - visibleSections.length);
  return (
    <aside className="director-project-rail" aria-label="项目导航">
      <div className="director-project-rail-head">
        <span>项目</span>
        <strong title={projectTitle}>{projectTitle}</strong>
        <small>{projectStatus.stage} · {projectStatus.waitingFor}</small>
      </div>
      <nav className="director-project-rail-nav" aria-label="项目内容">
        <button
          type="button"
          className={directorView === "story" ? "active" : ""}
          onClick={() => onOpenDirectorView?.("story")}
          disabled={!projectReady}
          aria-label={`故事，${totalShots} 镜头`}
          aria-current={directorView === "story" ? "page" : undefined}
        >
          <span className="director-project-rail-nav-label"><Clapperboard size={17} aria-hidden="true" /><b>故事</b></span>
          <small>{totalShots} 镜头</small>
        </button>
        <button
          type="button"
          className={directorView === "assets" ? "active" : ""}
          onClick={() => onOpenDirectorView?.("assets")}
          disabled={!projectReady}
          aria-label={`参考，${referenceLabel}`}
          aria-current={directorView === "assets" ? "page" : undefined}
        >
          <span className="director-project-rail-nav-label"><Images size={17} aria-hidden="true" /><b>参考</b></span>
          <small>{referenceLabel}</small>
        </button>
        <button
          type="button"
          className={directorView === "preview" ? "active" : ""}
          onClick={() => onOpenDirectorView?.("preview")}
          disabled={!projectReady}
          aria-label={`视频，${videoLabel}`}
          aria-current={directorView === "preview" ? "page" : undefined}
        >
          <span className="director-project-rail-nav-label"><PlaySquare size={17} aria-hidden="true" /><b>视频</b></span>
          <small>{videoLabel}</small>
        </button>
        <button
          type="button"
          className={directorView === "export" ? "active" : ""}
          onClick={() => onOpenDirectorView?.("export")}
          disabled={!projectReady}
          aria-label="交付，展示包"
          aria-current={directorView === "export" ? "page" : undefined}
        >
          <span className="director-project-rail-nav-label"><PackageCheck size={17} aria-hidden="true" /><b>交付</b></span>
          <small>展示包</small>
        </button>
      </nav>
      {projectReady && visibleSections.length > 0 && (
        <div className="director-project-rail-sections" aria-label="故事段落">
          <span>段落</span>
          {visibleSections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={section.id === activeSectionId ? "active" : ""}
              onClick={() => {
                onOpenDirectorView?.("story");
                onOpenSection(section.id);
              }}
              title={section.label}
            >
              <strong>{section.label}</strong>
              <small>{section.shotCount} 镜头</small>
            </button>
          ))}
          {extraSectionCount > 0 && <small>还有 {extraSectionCount} 个段落，在故事页继续看。</small>}
        </div>
      )}
    </aside>
  );
}

function projectStatusViewWithActiveVideo(status: ProjectStatusViewModel, creatorDesk?: CreatorDeskProjection): ProjectStatusViewModel {
  const videoStage = creatorDesk?.videoStage;
  if (!videoStage || (videoStage.status !== "in_progress" && videoStage.status !== "recoverable")) return status;
  const generation = videoStage.generation;
  const canQuery = videoStage.canResume || videoStage.status === "recoverable";
  const doing = generation.queueSummary || generation.detail || generation.statusLabel || "Seedance 2.0 已提交，后台等待";
  const videoFact = generation.shortSubmitId ? `提交号 ${generation.shortSubmitId}` : generation.statusLabel;
  const facts = [
    ...status.facts.filter((fact) => fact.label !== "AI 导演" && fact.label !== "视频"),
    videoFact ? { label: "视频", value: videoFact } : undefined,
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));
  return {
    ...status,
    stage: canQuery ? "视频待查询" : "视频生成中",
    doing,
    waitingFor: canQuery ? "查询视频结果" : "视频结果",
    nextAction: canQuery ? "确认查询结果" : "等结果出来后看预览",
    tone: canQuery ? "ready" : "working",
    issue: undefined,
    facts,
  };
}

function projectStatusViewWithCommittedDraft(status: ProjectStatusViewModel, committed: boolean): ProjectStatusViewModel {
  if (!committed || status.stage !== "等待确认") return status;
  const copy = [status.doing, status.waitingFor, status.nextAction, ...status.facts.map((fact) => `${fact.label}:${fact.value}`)].join(" ");
  if (!/草案|故事流|写入/.test(copy)) return status;
  return {
    ...status,
    stage: "项目故事已更新",
    doing: "故事已确认",
    waitingFor: "你的下一句指令",
    nextAction: "继续说要改哪里，或让 AI 开始补参考",
    tone: "ready",
  };
}

function projectStatusViewWithCompletedExport(
  status: ProjectStatusViewModel,
  currentTask: AgentCurrentTaskProjection | undefined,
  directorView: DirectorView,
): ProjectStatusViewModel {
  if (
    directorView !== "export"
    || currentTask?.completion?.step !== "export"
    || currentTask.completion.executionMode !== "live"
  ) return status;
  return {
    ...status,
    stage: "导出已完成",
    doing: "已写入当前项目的 exports 文件夹。",
    waitingFor: "最后复核交付内容",
    nextAction: "查看交付内容",
    tone: "ready",
    issue: undefined,
  };
}

function restoredAgentVideoPermissionContract(
  draft: ProjectAgentStagedPlanDraft | undefined,
  fallback: AgentVideoPermissionContract,
): AgentVideoPermissionContract {
  if (draft?.status !== "active") return fallback;
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

function sameVideoPermissionContract(left: AgentVideoPermissionContract, right: AgentVideoPermissionContract) {
  return left.mode === right.mode
    && left.referenceGenerationAllowed === right.referenceGenerationAllowed
    && left.videoSubmitAllowed === right.videoSubmitAllowed
    && left.reason === right.reason;
}

function projectStatusViewWithPendingAgentConfirmation(
  status: ProjectStatusViewModel,
  label: string,
): ProjectStatusViewModel {
  if (!label) return status;
  return {
    ...status,
    stage: "等待你确认",
    doing: `右侧消息里有「${label}」`,
    waitingFor: "先处理消息里的确认，或继续说明怎么改",
    nextAction: label,
    tone: "waiting",
    issue: undefined,
    facts: status.facts.map((fact) => fact.label === "AI 导演" ? { ...fact, value: label } : fact),
  };
}

function projectStatusViewWithEditingAgentConfirmation(
  status: ProjectStatusViewModel,
  label: string,
): ProjectStatusViewModel {
  if (!label) return status;
  const editingStoryDraftConfirmation = label === "确认这版故事";
  return {
    ...status,
    stage: "继续说明",
    doing: editingStoryDraftConfirmation ? "正在修改当前草案" : `正在修改「${label}」`,
    waitingFor: editingStoryDraftConfirmation ? "发送右侧输入，或清空后回到确认故事" : "发送右侧输入，或清空后再回到确认",
    nextAction: "发送修改说明",
    tone: "waiting",
    issue: undefined,
    facts: status.facts.map((fact) => fact.label === "AI 导演" ? { ...fact, value: editingStoryDraftConfirmation ? "修改草案" : "正在修改确认" } : fact),
  };
}

function pendingNewVideoDraftTitle(status?: NewVideoStartStatus) {
  if (!status) return "";
  const title = status.draftTitle?.trim();
  if (!title || status.status === "empty" || status.status === "confirmed") return "";
  if (status.status === "planning") return `正在整理：${title}`;
  if (status.status === "ready") return `待确认故事：${title}`;
  return `新想法：${title}`;
}

function timelineDetailText(entry: VibeAgentTimelineEntry | undefined, key: string) {
  const value = entry?.details?.[key];
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function restoredNewVideoDraftSummary(entries?: VibeAgentTimelineEntry[]) {
  const intakeEntries = (entries || []).filter(isVibeAgentIntakeTimelineEntry);
  const latestConfirmation = [...intakeEntries].reverse().find((entry) => (
    entry.type === "confirmation_request"
    && entry.status === "waiting"
    && entry.details?.intakePhase === "planning_ready"
  ));
  if (!latestConfirmation) return undefined;
  const confirmed = intakeEntries.some((entry) => (
    entry.details?.intakePhase === "draft_confirmed"
    && entry.createdAt >= latestConfirmation.createdAt
  ));
  if (confirmed) return undefined;
  const userEntry = [...intakeEntries].reverse().find((entry) => (
    entry.type === "user_message"
    && entry.createdAt <= latestConfirmation.createdAt
  ));
  const userTitle = timelineDetailText(latestConfirmation, "draftScript")
    || timelineDetailText(userEntry, "draftScript")
    || userEntry?.body.replace(/\s+/g, " ").trim();
  const shotCountText = latestConfirmation.facts?.find((fact) => fact.label === "镜头")?.value || "";
  const shotCount = Number.parseInt(shotCountText, 10);
  return {
    title: userTitle ? `待确认故事：${userTitle.slice(0, 28)}${userTitle.length > 28 ? "..." : ""}` : "待确认故事",
    shotCount: Number.isFinite(shotCount) && shotCount > 0 ? shotCount : undefined,
  };
}

function restoredNewVideoDraftStatus(restored?: { title: string; shotCount?: number }): NewVideoStartStatus | undefined {
  if (!restored?.shotCount) return undefined;
  const draftTitle = restored.title.replace(/^待确认故事：/u, "").trim() || restored.title;
  return {
    status: "ready",
    title: "草案待确认",
    draftTitle,
    detail: "草案待确认；确认后会成为故事流。",
    nextAction: "确认这版故事",
    draftShotCount: restored.shotCount,
  };
}

function isNewVideoSurfaceAgentTimelineEntry(entry: VibeAgentTimelineEntry) {
  return isVibeAgentIntakeTimelineEntry(entry)
    || entry.id.startsWith("local_agent_")
    || entry.id.startsWith("local_project_setup_")
    || entry.id.startsWith("new_video_draft_committed_");
}

function newVideoEntryProjectStatusView(
  status?: NewVideoStartStatus,
  restored?: { title: string; shotCount?: number },
): ProjectStatusViewModel {
  const draftShotCount = status?.draftShotCount || restored?.shotCount || 0;
  const draftReferenceCount = status?.draftReferenceCount || 0;
  const rawStatusKind = status?.status;
  const restoredDraftActive = Boolean(restored);
  const statusKind = rawStatusKind && (rawStatusKind !== "empty" || !restoredDraftActive)
    ? rawStatusKind
    : restoredDraftActive
      ? "ready"
      : "empty";
  const emptyNewVideoStatus = rawStatusKind === "empty" && !restoredDraftActive;
  const statusTitle = rawStatusKind === "empty" ? undefined : status?.title;
  const statusDetail = rawStatusKind === "empty" ? undefined : status?.detail;
  const statusNextAction = rawStatusKind === "empty" ? undefined : status?.nextAction;
  const stage = statusKind === "planning"
    ? "正在拆镜头"
    : statusKind === "ready"
      ? "草案待确认"
      : statusKind === "blocked"
        ? "草案待处理"
        : statusKind === "confirmed"
          ? "故事已保存"
          : statusKind === "drafting"
            ? "想法已放入"
            : "准备开始";
  const tone: ProjectStatusViewModel["tone"] = statusKind === "planning"
    ? "working"
    : statusKind === "blocked"
      ? "blocked"
      : "waiting";
  const doing = emptyNewVideoStatus ? "AI 会先整理故事和镜头" : statusTitle || restored?.title || "准备整理故事和镜头";
  const waitingFor = emptyNewVideoStatus ? "故事素材" : statusDetail || (restored ? "确认这版故事，或直接说哪里要改" : "故事素材");
  const nextAction = emptyNewVideoStatus ? "发送后整理故事和镜头" : statusNextAction || (restored ? "确认这版故事，或继续修改" : "AI 会先整理故事和镜头");
  const facts = [
    { label: "项目", value: "新视频" },
    { label: "镜头", value: draftShotCount > 0 ? `草案 ${draftShotCount} 个` : "0 个" },
    { label: "参考", value: draftReferenceCount > 0 ? `${draftReferenceCount} 个素材` : "未开始" },
    { label: "AI 导演", value: statusKind === "planning" ? "正在拆镜头" : "先整理" },
  ];
  return {
    stage,
    doing,
    waitingFor,
    nextAction,
    tone,
    issue: statusKind === "blocked" ? waitingFor : undefined,
    facts,
  };
}

export function DirectorMode({
  audit,
  view,
  runtimeState,
  projectFactHash,
  projectScopeLabel,
  selectedShot,
  selectedShots,
  selectedAsset,
  selectedShotId,
  selectedShotIds,
  currentProjectPreviewItems,
  localPreviewExport,
  exportWorker,
  exportAction,
  previewEmptyStateLabel,
  previewEmptyStateDetail,
  realSampleAction,
  endFrameAction,
  videoSendAction,
  webSearchSettings,
  webSearchReady,
  projectReferenceGuide,
  storyboardProjectPlanInput,
  onDirectorFeedbackConfirmed,
  onSaveResearchAsReference,
  creatorDesk,
  localProjectReady,
  projectContentReady,
  localProjectBusy,
  canCreateLocalProject,
  newVideoComposerResetKey,
  newVideoResetKey,
  directorView,
  activeSectionId,
  assetLibraryNode,
  onSelectShot,
  onSelectAsset,
  onOpenSection,
  onProjectStoreApplyPlanReady,
  onNewVideoDraftConfirmed,
  onCreateLocalProject,
  onRunExport,
  onCreateP6RealSample,
  onCreateImage2EndFrame,
  onSendSeedanceVideo,
  onDialogueAudioCreated,
  onRetryMissingBatch,
  onRetryReviewItem,
  onApproveReviewItem,
  onRejectReviewItem,
  onLockReviewItem,
  onOpenDirectorView,
  latestPrototypeAgentDemo,
  restoredAgentStagedPlanDraft,
  restoredAgentActionLog,
  restoredAgentTimelineEntries,
  restoredAgentGenerationJobLedger,
  onNewVideoStatusChange,
  onStagePrototypeAgentPlan,
  onClearPrototypeAgentPlan,
  onRefreshRestoredAgentStagedPlanDraft,
  onRememberAgentActionLogItem,
  onRememberAgentTimelineEntries,
  onRememberAgentGenerationJobLedger,
  onPreviewPrototypeAgentDemo,
}: {
  audit: ProjectAudit;
  view: RuntimeView;
  runtimeState: ProjectRuntimeState;
  projectFactHash?: string;
  projectScopeLabel?: string;
  selectedShot?: ShotRecord;
  selectedShots: ShotRecord[];
  selectedAsset?: AssetRecord;
  selectedShotId: string;
  selectedShotIds: string[];
  currentProjectPreviewItems?: PreviewQueueItem[];
  localPreviewExport?: ProjectPreviewExportState;
  exportWorker?: ExportWorkerState;
  exportAction?: ExportActionState;
  previewEmptyStateLabel?: string;
  previewEmptyStateDetail?: string;
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
  storyboardProjectPlanInput?: StoryboardReferenceProjectPlannerInput;
  onDirectorFeedbackConfirmed?: (recompile: DirectorFeedbackRecompileResult) => void | Promise<void>;
  onSaveResearchAsReference?: (input: {
    result: AgentWebSearchResult;
    userIntent: string;
  }) => KnowledgePack | Promise<KnowledgePack>;
  creatorDesk?: CreatorDeskProjection;
  localProjectReady?: boolean;
  projectContentReady?: boolean;
  localProjectBusy?: boolean;
  canCreateLocalProject?: boolean;
  newVideoComposerResetKey?: string;
  newVideoResetKey?: number;
  directorView: DirectorView;
  activeSectionId?: string;
  assetLibraryNode: ReactNode;
  onSelectShot: (id: string, additive?: boolean) => void;
  onSelectAsset?: (id: string) => void;
  onOpenSection: (sectionId: string) => void;
  onProjectStoreApplyPlanReady?: (plan: ProjectFactsStagedApplyPlan) => void;
  onNewVideoDraftConfirmed?: (draft: NewVideoStartDraft, context: NewVideoStartConfirmationContext) => boolean | void | Promise<boolean | void>;
  onCreateLocalProject?: (draft?: NewVideoStartDraft) => unknown | Promise<unknown>;
  onRunExport?: (target?: Pick<AgentControlledToolInvocationTarget, "agentToolTrace" | "signal" | "exportExecutionReceipt">) => unknown | Promise<unknown>;
  onCreateP6RealSample?: (target?: AgentControlledToolInvocationTarget) => unknown | Promise<unknown>;
  onCreateImage2EndFrame?: (target?: Pick<AgentControlledToolInvocationTarget, "skipConfirm" | "confirmationReceiptId" | "confirmedAt" | "signal">) => unknown | Promise<unknown>;
  onSendSeedanceVideo?: (target?: AgentControlledToolInvocationTarget) => unknown | Promise<unknown>;
  onDialogueAudioCreated?: (input: MinimalAudioPlanDialogueAudioCreated) => void | Promise<void>;
  onRetryMissingBatch?: (target?: Pick<AgentControlledToolInvocationTarget, "signal">) => unknown | Promise<unknown>;
  onRetryReviewItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onApproveReviewItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onRejectReviewItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onLockReviewItem?: (item: CreatorReviewTrayItem, target: CreatorReviewLockTarget) => void | Promise<void>;
  onOpenDirectorView?: (view: DirectorView) => void;
  latestPrototypeAgentDemo?: PrototypeAgentDemoRun;
  restoredAgentStagedPlanDraft?: ProjectAgentStagedPlanDraft;
  restoredAgentActionLog?: ProjectAgentActionLogItem[];
  restoredAgentTimelineEntries?: VibeAgentTimelineEntry[];
  restoredAgentGenerationJobLedger?: AgentVideoGenerationJobLedger;
  onNewVideoStatusChange?: (status?: NewVideoStartStatus) => void;
  onStagePrototypeAgentPlan?: (input: StagePrototypeAgentPlanInput) => StagePrototypeAgentPlanResult | void | Promise<StagePrototypeAgentPlanResult | void>;
  onClearPrototypeAgentPlan?: () => void | Promise<void>;
  onRefreshRestoredAgentStagedPlanDraft?: (draft: ProjectAgentStagedPlanDraft) => void | Promise<void>;
  onRememberAgentActionLogItem?: (item: ProjectAgentActionLogItem) => void | Promise<void>;
  onRememberAgentTimelineEntries?: (entries: VibeAgentTimelineEntry[]) => void | Promise<void>;
  onRememberAgentGenerationJobLedger?: (ledger: AgentVideoGenerationJobLedger) => void | Promise<void>;
  onPreviewPrototypeAgentDemo?: (input: PreviewPrototypeAgentDemoInput) => PreviewPrototypeAgentDemoResult | void | Promise<PreviewPrototypeAgentDemoResult | void>;
}) {
  const folderReady = Boolean(localProjectReady);
  const projectReady = projectContentReady ?? folderReady;
  const runtimeShotIds = new Set(runtimeState.storyFlow.shots.map((shot) => shot.id));
  const storySections = (view.storySections || [])
    .map((section) => {
      const shotIds = section.shotIds.filter((shotId) => runtimeShotIds.has(shotId));
      return {
        ...section,
        label: cleanStoryText(section.label) || "当前故事",
        shotIds,
        shotCount: shotIds.length,
      };
    })
    .filter((section) => section.shotIds.length > 0);
  const activeSection = projectReady
    ? storySections.find((section) => section.id === activeSectionId) || storySections[0]
    : undefined;
  const sectionLabel = directorView === "story" ? "故事流" : (activeSection?.label || "故事流");
  const agentSectionLabel = directorView === "assets"
    ? "参考资产"
    : directorView === "preview"
      ? "预览"
      : directorView === "export"
        ? "交付"
        : sectionLabel;
  const scopedShots = directorView === "story" || !activeSection
    ? runtimeState.storyFlow.shots
    : runtimeState.storyFlow.shots.filter((shot) => activeSection.shotIds.includes(shot.id));
  const shots = projectReady ? scopedShots : [];
  const storyAssets = projectReady ? runtimeState.visualMemory.assets : [];
  const showAgentPanel = true;
  const agentProjectStatusLabel = folderReady
    ? "已连接"
    : projectReady
      ? "需要保存位置"
      : "需要保存位置";
  const agentShotBoundView = directorView === "story" || directorView === "preview" || directorView === "export";
  const [videoPermissionContract, setVideoPermissionContract] = useState<AgentVideoPermissionContract>(defaultAgentVideoPermissionContract);
  const [newVideoStatus, setNewVideoStatus] = useState<NewVideoStartStatus | undefined>();
  const [agentIntakeCommand, setAgentIntakeCommand] = useState<NewVideoStartAgentIntakeCommand | undefined>();
  const [agentNewVideoDraftActive, setAgentNewVideoDraftActive] = useState(false);
  const [agentPendingAction, setAgentPendingAction] = useState(false);
  const [agentReferencePlanningFocus, setAgentReferencePlanningFocus] = useState(false);
  const [agentEditingPendingConfirmation, setAgentEditingPendingConfirmation] = useState(false);
  const [agentCurrentTaskProjection, setAgentCurrentTaskProjection] = useState<AgentCurrentTaskProjection>();
  const [activePreviewReviewTarget, setActivePreviewReviewTarget] = useState<CreatorReviewTrayItem>();
  const activeNewVideoResetKey = newVideoResetKey || 0;
  const activeNewVideoResetKeyRef = useRef(activeNewVideoResetKey);
  activeNewVideoResetKeyRef.current = activeNewVideoResetKey;
  const effectiveNewVideoComposerResetKey = newVideoResetKey
    ? `${newVideoComposerResetKey || "project-reset"}:${newVideoResetKey}`
    : newVideoComposerResetKey;
  const handleAgentPendingActionChange = useCallback((pending: boolean) => {
    setAgentPendingAction((current) => current === pending ? current : pending);
  }, []);
  const handleAgentReferencePlanningFocusChange = useCallback((active: boolean) => {
    setAgentReferencePlanningFocus((current) => current === active ? current : active);
  }, []);
  const handleAgentEditingPendingConfirmationChange = useCallback((active: boolean) => {
    setAgentEditingPendingConfirmation((current) => current === active ? current : active);
  }, []);
  const handleAgentCurrentTaskProjectionChange = useCallback((projection: AgentCurrentTaskProjection | undefined) => {
    setAgentCurrentTaskProjection((current) => current === projection ? current : projection);
  }, []);
  const handleActivePreviewReviewTargetChange = useCallback((target: CreatorReviewTrayItem | undefined) => {
    setActivePreviewReviewTarget((current) => {
      if (
        current?.id === target?.id
        && current?.sourceReceiptId === target?.sourceReceiptId
        && current?.outputHash === target?.outputHash
        && current?.status === target?.status
      ) return current;
      return target;
    });
  }, []);
  useEffect(() => {
    if (directorView === "preview") return;
    setActivePreviewReviewTarget(undefined);
  }, [directorView]);
  useEffect(() => {
    if (!newVideoResetKey) return;
    setNewVideoStatus(undefined);
    setAgentIntakeCommand(undefined);
    setAgentNewVideoDraftActive(false);
    setAgentReferencePlanningFocus(false);
    setAgentEditingPendingConfirmation(false);
    setAgentCurrentTaskProjection(undefined);
    onNewVideoStatusChange?.(undefined);
  }, [newVideoResetKey, onNewVideoStatusChange]);
  const surfaceAgentIntakeCommand = agentIntakeCommand
    && (agentIntakeCommand.sessionResetKey ?? 0) === activeNewVideoResetKey
    ? agentIntakeCommand
    : undefined;
  const newVideoSurfaceAgentTimelineEntries = useMemo(
    () => newVideoResetKey
      ? []
      : (restoredAgentTimelineEntries || []).filter(isNewVideoSurfaceAgentTimelineEntry),
    [newVideoResetKey, restoredAgentTimelineEntries],
  );
  const restoredNewVideoDraft = useMemo(
    () => restoredNewVideoDraftSummary(newVideoSurfaceAgentTimelineEntries),
    [newVideoSurfaceAgentTimelineEntries],
  );
  const restoredAgentStagedPlanTakingFocus = Boolean(
    restoredAgentStagedPlanDraft?.status === "active"
      && restoredAgentStagedPlanDraft.action?.status === "staged",
  );
  const restoredNewVideoDraftActive = Boolean(restoredNewVideoDraft) && !restoredAgentStagedPlanTakingFocus;
  const showNewVideoStart = !projectReady || shots.length === 0 || agentNewVideoDraftActive || restoredNewVideoDraftActive;
  const surfaceAgentTimelineEntries = showNewVideoStart
    ? newVideoSurfaceAgentTimelineEntries
    : restoredAgentTimelineEntries;
  const pendingConfirmedVideoPermissionContractRef = useRef<{
    contract: AgentVideoPermissionContract;
    confirmedAt: number;
  } | undefined>(undefined);
  const permissionProjectKey = runtimeState.project.root
    ? `root:${runtimeState.project.root}`
    : runtimeState.sourceIndexSummary.projectId
      ? `id:${runtimeState.sourceIndexSummary.projectId}`
      : `title:${runtimeState.project.title || "browser_draft"}`;
  const previousPermissionProjectKeyRef = useRef(permissionProjectKey);
  useEffect(() => {
    if (previousPermissionProjectKeyRef.current === permissionProjectKey) return;
    previousPermissionProjectKeyRef.current = permissionProjectKey;
    const pendingConfirmedContract = pendingConfirmedVideoPermissionContractRef.current;
    if (pendingConfirmedContract && Date.now() - pendingConfirmedContract.confirmedAt < 8_000) {
      pendingConfirmedVideoPermissionContractRef.current = undefined;
      setVideoPermissionContract(pendingConfirmedContract.contract);
      return;
    }
    pendingConfirmedVideoPermissionContractRef.current = undefined;
    setVideoPermissionContract(defaultAgentVideoPermissionContract);
  }, [permissionProjectKey]);
  useEffect(() => {
    if (restoredAgentStagedPlanDraft?.status !== "active" || !restoredAgentStagedPlanDraft.videoPermissionContract?.mode) return;
    setVideoPermissionContract((current) => {
      const next = restoredAgentVideoPermissionContract(restoredAgentStagedPlanDraft, current);
      return sameVideoPermissionContract(current, next) ? current : next;
    });
  }, [
    restoredAgentStagedPlanDraft?.draftId,
    restoredAgentStagedPlanDraft?.status,
    restoredAgentStagedPlanDraft?.videoPermissionContract?.mode,
    restoredAgentStagedPlanDraft?.videoPermissionContract?.referenceGenerationAllowed,
    restoredAgentStagedPlanDraft?.videoPermissionContract?.videoSubmitAllowed,
    restoredAgentStagedPlanDraft?.videoPermissionContract?.reason,
  ]);
  const videoPermissionAllowsSend = agentVideoPermissionAllowsVideo(videoPermissionContract);
  const videoPermissionAllowsReference = agentVideoPermissionAllowsReference(videoPermissionContract);
  const sessionVideoSendAction = useMemo(() => {
    const queryOnly = Boolean(videoSendAction?.canResume);
    if (!videoSendAction || videoPermissionAllowsSend || queryOnly || videoSendAction.status === "blocked") return videoSendAction;
    return {
      ...videoSendAction,
      disabled: true,
      ready: false,
      message: videoPermissionContract.mode === "plan_only"
        ? "先整理，不会生成或发送。"
        : "当前先做参考，视频等你确认。",
    };
  }, [videoSendAction, videoPermissionAllowsSend, videoPermissionContract.mode]);
  const sessionSendSeedanceVideo = videoPermissionAllowsSend || videoSendAction?.canResume
    ? (target?: AgentControlledToolInvocationTarget) => onSendSeedanceVideo?.({
      ...target,
      videoPermissionContract,
    })
    : undefined;
  const sessionRetryMissingBatch = videoPermissionAllowsReference ? onRetryMissingBatch : undefined;
  const sessionRetryReviewItem = videoPermissionAllowsReference ? onRetryReviewItem : undefined;
  const visibleAgentCommand = useMemo<CreatorAgentCommand | undefined>(() => {
    const command = creatorDesk?.agentCommand;
    if (!command) return undefined;
    const referenceGenerationDeferredByCreator = !videoPermissionAllowsReference
      && videoPermissionContract.mode === "plan_only";
    if (command.kind === "generate_references" && referenceGenerationDeferredByCreator) {
      return {
        ...command,
        kind: "open_story",
        label: "之后补参考",
        summary: "已按你的要求先整理故事。",
        detail: "需要参考时，在右侧说“开始补参考”。",
        targetView: "story",
      };
    }
    if (command.kind === "generate_references" && !videoPermissionAllowsReference) {
      return {
        ...command,
        label: "确认生成参考",
        summary: "参考还缺，确认后再生成。",
        detail: "现在我只整理方案。确认后只生成参考，不会发送视频。",
      };
    }
    if (command.kind === "submit_video" && videoSendAction?.status === "blocked") {
      return {
        ...command,
        label: "先处理视频问题",
        summary: "这一段还不能直接发送。",
        detail: videoSendAction.message || "先补参考或修改这一段，再继续提交视频。",
      };
    }
    if (command.kind === "submit_video" && !videoPermissionAllowsSend) {
      return {
        ...command,
        label: "确认提交视频",
        summary: "确认后提交视频，按串行队列执行。",
        detail: videoPermissionContract.mode === "plan_only"
          ? "现在我只整理方案。确认后会提交视频。"
          : "当前先做参考。确认后会提交视频。",
      };
    }
    return command;
  }, [creatorDesk?.agentCommand, videoPermissionAllowsReference, videoPermissionAllowsSend, videoPermissionContract.mode, videoPermissionContract.reason, videoSendAction?.message, videoSendAction?.status]);
  const surfaceAgentCommand = showNewVideoStart ? undefined : visibleAgentCommand;
  const referenceGenerationDeferredByCreator = !videoPermissionAllowsReference
    && videoPermissionContract.mode === "plan_only";
  const storyDetailLabel = [`${storySections.length} 个段落`, "点击查看分镜、模式和画面状态"].join(" · ");
  const showCreatorDeskPanel = projectReady && creatorDesk && !showNewVideoStart && directorView === "story" && !agentPendingAction;
  useEffect(() => {
    if (!showNewVideoStart && newVideoStatus) {
      setNewVideoStatus(undefined);
      onNewVideoStatusChange?.(undefined);
    }
  }, [newVideoStatus, onNewVideoStatusChange, showNewVideoStart]);
  const restoredNewVideoStatus = useMemo(
    () => restoredNewVideoDraftActive ? restoredNewVideoDraftStatus(restoredNewVideoDraft) : undefined,
    [restoredNewVideoDraft, restoredNewVideoDraftActive],
  );
  useEffect(() => {
    if (!showNewVideoStart) return;
    if (!restoredNewVideoStatus) return;
    if (newVideoStatus && newVideoStatus.status !== "empty") return;
    onNewVideoStatusChange?.(restoredNewVideoStatus);
  }, [newVideoStatus, onNewVideoStatusChange, restoredNewVideoStatus, showNewVideoStart]);
  const agentTimelineStatusView = useMemo(
    () => buildVibeAgentTimelineStatusView(surfaceAgentTimelineEntries),
    [surfaceAgentTimelineEntries],
  );
  const displayedPendingAgentConfirmationCopy = agentCurrentTaskProjection?.requiresConfirmation
    ? agentCurrentTaskProjection.label
    : "";
  const rawProjectStatusView = useMemo(() => buildProjectStatusViewModel({
    runtimeState,
    folderReady,
    projectReady,
    localProjectBusy,
    directorView,
    referenceGenerationAction: realSampleAction,
    referenceGenerationDeferredByCreator,
    endFrameAction,
    videoSendAction: sessionVideoSendAction,
    videoStage: creatorDesk?.videoStage,
    referenceBatch: creatorDesk?.batchGeneration,
    framePlan: creatorDesk?.framePlan,
    referenceGapCount: creatorReferenceGapCount(creatorDesk),
    agentStage: creatorDesk?.agentStage,
    agentCommand: surfaceAgentCommand,
    agentTimelineStatus: agentTimelineStatusView,
    newVideoStatus,
    exportAction,
    exportWorker,
  }), [
    creatorDesk?.agentStage,
    creatorDesk?.batchGeneration,
    creatorDesk?.framePlan,
    creatorDesk?.assetReconciliation,
    creatorDesk?.videoStage,
    directorView,
    endFrameAction,
    exportAction,
    exportWorker,
    folderReady,
    localProjectBusy,
    newVideoStatus,
    projectReady,
    realSampleAction,
    runtimeState,
    sessionVideoSendAction,
    agentTimelineStatusView,
    referenceGenerationDeferredByCreator,
    surfaceAgentCommand,
  ]);
  const projectStatusView = useMemo(
    () => projectStatusViewWithCompletedExport(
      projectStatusViewWithCommittedDraft(
        projectStatusViewWithActiveVideo(rawProjectStatusView, creatorDesk),
        isCommittedNewVideoDraftAgentRun(latestPrototypeAgentDemo),
      ),
      agentCurrentTaskProjection,
      directorView,
    ),
    [agentCurrentTaskProjection, creatorDesk, directorView, latestPrototypeAgentDemo, rawProjectStatusView],
  );
  const newVideoEntryStatusView = useMemo(
    () => showNewVideoStart ? newVideoEntryProjectStatusView(newVideoStatus, restoredNewVideoDraft) : undefined,
    [newVideoStatus, restoredNewVideoDraft, showNewVideoStart],
  );
  const activeProjectStatusView = newVideoEntryStatusView || projectStatusView;
  const displayedPendingAgentConfirmationForStatus = displayedPendingAgentConfirmationCopy;
  const displayedProjectStatusView: ProjectStatusViewModel = agentEditingPendingConfirmation && displayedPendingAgentConfirmationCopy
    ? projectStatusViewWithEditingAgentConfirmation(activeProjectStatusView, displayedPendingAgentConfirmationCopy)
    : projectStatusViewWithPendingAgentConfirmation(
      activeProjectStatusView,
      displayedPendingAgentConfirmationForStatus,
    );
  const pendingAgentConfirmationForSurfaces = agentEditingPendingConfirmation && displayedPendingAgentConfirmationCopy
    ? displayedPendingAgentConfirmationCopy
    : displayedProjectStatusView.stage === "等待你确认"
      ? displayedProjectStatusView.nextAction
      : "";
  const agentEditingConfirmationLabel = agentEditingPendingConfirmation && displayedPendingAgentConfirmationCopy
    ? displayedPendingAgentConfirmationCopy
    : "";
  const projectRailReferenceGapCount = creatorReferenceGapCount(creatorDesk);
  const displayedAssetLibraryNode = useMemo(() => {
    if (!isValidElement(assetLibraryNode)) return assetLibraryNode;
    if (!pendingAgentConfirmationForSurfaces && !projectRailReferenceGapCount) return assetLibraryNode;
    return cloneElement(assetLibraryNode as ReactElement<{ pendingConfirmationLabel?: string; referenceGapCount?: number }>, {
      pendingConfirmationLabel: pendingAgentConfirmationForSurfaces,
      referenceGapCount: projectRailReferenceGapCount,
    });
  }, [assetLibraryNode, pendingAgentConfirmationForSurfaces, projectRailReferenceGapCount]);
  const pendingDraftRailTitle = showNewVideoStart ? pendingNewVideoDraftTitle(newVideoStatus) || restoredNewVideoDraft?.title || "" : "";
  const projectNavReady = projectReady && !showNewVideoStart;
  const projectNavSections = showNewVideoStart ? [] : storySections;
  const projectNavShotCount = showNewVideoStart ? (newVideoStatus?.draftShotCount || restoredNewVideoDraft?.shotCount || 0) : runtimeState.storyFlow.shots.length;
  const projectRailTitle = showNewVideoStart ? pendingDraftRailTitle || "新视频项目" : runtimeState.project.title || projectScopeLabel || "新视频项目";
  const projectRailVideoLabel = directorProjectRailVideoLabel(creatorDesk?.videoStage);
  const projectRailReferenceLabel = directorProjectRailReferenceLabel(
    creatorDesk,
    displayableReferenceAssetCount(runtimeState.visualMemory.assets),
    projectRailReferenceGapCount,
  );
  const projectRailDisplayReferenceLabel = showNewVideoStart
    ? newVideoStatus?.draftReferenceCount
      ? `${newVideoStatus.draftReferenceCount} 个素材`
      : "未开始"
    : projectRailReferenceLabel;
  const projectRailDisplayVideoLabel = showNewVideoStart ? "未生成" : projectRailVideoLabel;
  const agentSelectionReady = projectReady && !showNewVideoStart && agentShotBoundView;
  const agentScopeLabel = showNewVideoStart
    ? pendingDraftRailTitle || "新视频草案"
    : projectReady
      ? projectScopeLabel
      : "新视频项目";
  async function confirmNewVideoDraft(draft: NewVideoStartDraft, context: NewVideoStartConfirmationContext) {
    const nextContract = draft.agentBoundaryMode
      ? agentVideoPermissionForMode(draft.agentBoundaryMode)
      : detectAgentVideoPermissionContract([draft.script, draft.style].filter(Boolean).join("\n"), videoPermissionContract);
    pendingConfirmedVideoPermissionContractRef.current = {
      contract: nextContract,
      confirmedAt: Date.now(),
    };
    setVideoPermissionContract(nextContract);
    const result = await onNewVideoDraftConfirmed?.(draft, context);
    if (result !== false) {
      setAgentNewVideoDraftActive(false);
      setAgentIntakeCommand(undefined);
    }
    return result;
  }

  function startNewVideoFromAgent(userIntent: string) {
    const text = userIntent.trim();
    if (!text) return;
    onOpenDirectorView?.("story");
    setAgentNewVideoDraftActive(true);
    setNewVideoStatus(undefined);
    setAgentIntakeCommand({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      projectTargetMode: agentNewVideoProjectTargetMode({
        localProjectReady: folderReady,
        currentProjectShotCount: runtimeState.storyFlow.shots.length,
      }),
      sessionResetKey: activeNewVideoResetKey,
    });
  }

  function continueNewVideoDraftFromAgent() {
    onOpenDirectorView?.("story");
    setAgentNewVideoDraftActive(true);
    setNewVideoStatus(undefined);
    setAgentIntakeCommand({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: "",
      mode: "continue_current_draft",
      sessionResetKey: activeNewVideoResetKey,
    });
  }

  function confirmNewVideoDraftFromAgent() {
    onOpenDirectorView?.("story");
    setAgentNewVideoDraftActive(true);
    setAgentIntakeCommand({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: "确认这版故事",
      mode: "confirm_current_draft",
      sessionResetKey: activeNewVideoResetKey,
    });
  }

  const handleNewVideoStatusChange = useCallback((status: NewVideoStartStatus) => {
    if (activeNewVideoResetKeyRef.current !== activeNewVideoResetKey) return;
    setNewVideoStatus(status);
    onNewVideoStatusChange?.(status);
  }, [activeNewVideoResetKey, onNewVideoStatusChange]);

  return (
    <div className={`minimal-director ${directorView} ${showAgentPanel ? "has-agent-rail" : "composer-only"}`}>
      <DirectorProjectRail
        projectTitle={projectRailTitle}
        projectStatus={displayedProjectStatusView}
        directorView={directorView}
        sections={projectNavSections}
        activeSectionId={showNewVideoStart ? undefined : activeSection?.id}
        totalShots={projectNavShotCount}
        referenceLabel={projectRailDisplayReferenceLabel}
        videoLabel={projectRailDisplayVideoLabel}
        projectReady={projectNavReady}
        onOpenDirectorView={onOpenDirectorView}
        onOpenSection={onOpenSection}
      />
      <div className="minimal-director-main">
        <div className="director-workbar" aria-label="项目工作状态">
          <ProjectStatusSummary status={displayedProjectStatusView} currentTask={agentCurrentTaskProjection} />
        </div>
        {showCreatorDeskPanel && (
          <CreatorDeskPanels
            projection={creatorDesk}
            localProjectReady={folderReady}
            localProjectBusy={localProjectBusy}
            canCreateLocalProject={canCreateLocalProject}
            onRetryMissing={sessionRetryMissingBatch}
            referenceGenerationAction={realSampleAction}
            videoSendAction={sessionVideoSendAction}
            agentCommandOverride={visibleAgentCommand}
            projectStatusView={displayedProjectStatusView}
            referencePlanningFocusActive={agentReferencePlanningFocus && !agentPendingAction && folderReady}
            referenceConfirmationEditingFocusActive={Boolean(agentEditingConfirmationLabel)}
            editingConfirmationLabel={agentEditingConfirmationLabel}
            onSendVideo={sessionSendSeedanceVideo}
            onRetryItem={sessionRetryReviewItem}
            onApproveItem={onApproveReviewItem}
            onRejectItem={onRejectReviewItem}
            onLockItem={onLockReviewItem}
            onSelectItem={(item) => item.shotId && onSelectShot(item.shotId)}
            onSelectInboxItem={(item) => {
              if (item.assetId && onSelectAsset) {
                onSelectAsset(item.assetId);
                onOpenDirectorView?.("assets");
                return;
              }
              if (item.shotIds?.[0]) onSelectShot(item.shotIds[0]);
            }}
            onOpenView={onOpenDirectorView}
          />
        )}
        {!showCreatorDeskPanel && !showNewVideoStart && directorView === "story" && (
          <DirectorDetailDisclosure
            title="流程详情"
            detail={pendingAgentConfirmationForSurfaces
              ? `先处理右侧消息里的「${pendingAgentConfirmationForSurfaces}」。`
              : creatorDesk?.agentStage.summary || (projectReady ? "AI 会带你推进下一步" : "先描述一个想法")}
          >
            <DirectorWorkflowOverview
              runtimeState={runtimeState}
              shots={projectReady ? audit.shots : []}
              selectedShot={projectReady ? selectedShot : undefined}
              currentView={directorView}
              creatorDesk={projectReady ? creatorDesk : undefined}
              localProjectReady={folderReady}
            />
          </DirectorDetailDisclosure>
        )}
        {directorView === "assets" && (projectReady ? displayedAssetLibraryNode : (
            <EmptyProjectSurface
              title="还没有参考资产"
              detail="先在右侧和 AI 导演说清楚项目，确认后参考会出现在这里。"
          />
        ))}
        {directorView === "story" && (
          <>
            {showNewVideoStart && (
              <Suspense fallback={<EmptyProjectSurface title="正在打开新项目入口" detail="稍等一下，输入框马上就好。" />}>
                <NewVideoStart
                  key={effectiveNewVideoComposerResetKey || "new-video-start"}
                  shots={shots}
                  projectDraftKey={runtimeState.project.root || runtimeState.sourceIndexSummary.projectId}
                  composerResetKey={effectiveNewVideoComposerResetKey}
                  localProjectReady={folderReady}
                  localProjectBusy={localProjectBusy}
                  canCreateLocalProject={canCreateLocalProject}
                  availableKnowledgePacks={projectReferenceGuide?.packs}
                  webSearchSettings={webSearchSettings}
                  webSearchReady={webSearchReady}
                  onSaveResearchAsReference={onSaveResearchAsReference}
                  onStatusChange={handleNewVideoStatusChange}
                  onDraftConfirmed={confirmNewVideoDraft}
                  videoPermissionContract={videoPermissionContract}
                  onVideoPermissionContractChange={setVideoPermissionContract}
                  restoredAgentTimelineEntries={newVideoSurfaceAgentTimelineEntries}
                  onRememberAgentTimelineEntries={onRememberAgentTimelineEntries}
                  agentIntakeCommand={surfaceAgentIntakeCommand}
                  composerPlacement="draft_only"
                />
              </Suspense>
            )}
            {!showNewVideoStart && (
              <DirectorDetailDisclosure
                title="故事和镜头"
                detail={storyDetailLabel}
              >
                <MinimalStoryFlow
                  sectionLabel={sectionLabel}
                  shots={shots}
                  assets={storyAssets}
                  previewItems={currentProjectPreviewItems}
                  selectedShotId={selectedShotId}
                  selectedShotIds={selectedShotIds}
                  onSelectShot={onSelectShot}
                  onOpenReferences={() => onOpenDirectorView?.("assets")}
                />
              </DirectorDetailDisclosure>
            )}
          </>
        )}
        {directorView === "preview" && (
          projectReady ? <Suspense fallback={null}>
            <MinimalPreview
              previewExport={localPreviewExport || runtimeState.previewExport}
              currentProjectPreviewItems={currentProjectPreviewItems}
              emptyStateLabel={previewEmptyStateLabel}
              emptyStateDetail={previewEmptyStateDetail}
              pendingConfirmationLabel={pendingAgentConfirmationForSurfaces}
              sections={storySections}
              shots={audit.shots}
              selectedShotId={selectedShotId}
              onSelectShot={onSelectShot}
              onActiveReviewTargetChange={handleActivePreviewReviewTargetChange}
            />
            <MinimalAudioPlan
              audioPlanning={runtimeState.audioPlanning}
              shotId={projectReady ? selectedShotId : undefined}
              onDialogueAudioCreated={onDialogueAudioCreated}
            />
          </Suspense> : (
            <EmptyProjectSurface
              title="还没有预览"
              detail="画面和视频结果出来后，会在这里播放。"
            />
          )
        )}
        {directorView === "export" && (
          projectReady ? <Suspense fallback={null}>
            <MinimalExport
              previewExport={localPreviewExport || runtimeState.previewExport}
              audioPlanning={runtimeState.audioPlanning}
              exportWorker={exportWorker}
              exportAction={exportAction}
              exportCompleted={agentCurrentTaskProjection?.completion?.step === "export"
                && agentCurrentTaskProjection.completion.executionMode === "live"}
              localProjectReady={localProjectReady}
              pendingConfirmationLabel={pendingAgentConfirmationForSurfaces}
              onRunExport={onRunExport}
            />
          </Suspense> : (
            <EmptyProjectSurface
              title="还没有可导出的内容"
              detail="先和 AI 导演开始一个项目，确认后再导出。"
            />
          )
        )}
      </div>
      {showAgentPanel && (
        <div className="director-agent-rail" aria-label="AI 导演对话区">
          <MinimalAgentPanel
            runtimeState={runtimeState}
            projectFactHash={projectFactHash}
            projectScopeLabel={agentScopeLabel}
            projectStatusLabel={agentProjectStatusLabel}
            currentView={directorView}
            localProjectReady={folderReady}
            localProjectBusy={localProjectBusy}
            canCreateLocalProject={canCreateLocalProject}
            shot={agentSelectionReady ? selectedShot : undefined}
            selectedShots={agentSelectionReady ? selectedShots : []}
            asset={projectReady && !showNewVideoStart && directorView === "assets" ? selectedAsset : undefined}
            onSelectShot={projectNavReady ? onSelectShot : undefined}
            sectionLabel={agentSectionLabel}
            sectionId={projectNavReady && directorView === "story" && !selectedShot ? activeSection?.id : undefined}
            onProjectStoreApplyPlanReady={onProjectStoreApplyPlanReady}
            latestPrototypeAgentDemo={showNewVideoStart ? undefined : latestPrototypeAgentDemo}
            restoredAgentStagedPlanDraft={showNewVideoStart ? undefined : restoredAgentStagedPlanDraft}
            restoredAgentActionLog={showNewVideoStart ? [] : restoredAgentActionLog}
            restoredAgentTimelineEntries={surfaceAgentTimelineEntries}
            restoredAgentGenerationJobLedger={restoredAgentGenerationJobLedger}
            onStagePrototypeAgentPlan={showNewVideoStart ? undefined : onStagePrototypeAgentPlan}
            onClearPrototypeAgentPlan={onClearPrototypeAgentPlan}
            onRefreshRestoredAgentStagedPlanDraft={onRefreshRestoredAgentStagedPlanDraft}
            onRememberAgentActionLogItem={onRememberAgentActionLogItem}
            onRememberAgentTimelineEntries={onRememberAgentTimelineEntries}
            onRememberAgentGenerationJobLedger={onRememberAgentGenerationJobLedger}
            onPreviewPrototypeAgentDemo={onPreviewPrototypeAgentDemo}
            agentCommand={surfaceAgentCommand}
            projectObservation={projectNavReady ? creatorDesk?.projectObservation : undefined}
            projectStatusView={displayedProjectStatusView}
            exportAction={exportAction}
            exportWorker={exportWorker}
            realSampleAction={realSampleAction}
            endFrameAction={endFrameAction}
            videoSendAction={videoSendAction}
            webSearchSettings={webSearchSettings}
            webSearchReady={webSearchReady}
            projectReferenceGuide={projectReferenceGuide}
            storyboardProjectPlanInput={storyboardProjectPlanInput}
            onDirectorFeedbackConfirmed={onDirectorFeedbackConfirmed}
            onSaveResearchAsReference={onSaveResearchAsReference}
            onCreateLocalProject={() => onCreateLocalProject?.()}
            onStartNewVideoDraftFromAgent={startNewVideoFromAgent}
            onContinueNewVideoDraftFromAgent={continueNewVideoDraftFromAgent}
            onConfirmNewVideoDraftFromAgent={confirmNewVideoDraftFromAgent}
            newVideoResetKey={activeNewVideoResetKey}
            newVideoDraftPendingForAgent={showNewVideoStart && newVideoStatus?.status === "drafting"}
            newVideoDraftPlanningForAgent={showNewVideoStart && newVideoStatus?.status === "planning"}
            newVideoDraftReadyForAgent={showNewVideoStart && newVideoStatus?.status === "ready"}
            newVideoDraftShotCountForAgent={showNewVideoStart ? (newVideoStatus?.draftShotCount || restoredNewVideoDraft?.shotCount || 0) : 0}
            newVideoAgentSelectionContext={showNewVideoStart ? newVideoStatus?.agentSelectionContext : undefined}
            onCreateP6RealSample={onCreateP6RealSample}
            onCreateImage2EndFrame={onCreateImage2EndFrame}
            onSendSeedanceVideo={onSendSeedanceVideo}
            onRunExport={onRunExport}
            onOpenResultView={onOpenDirectorView}
            onRetryMissingBatch={onRetryMissingBatch}
            reviewTarget={directorView === "preview" ? activePreviewReviewTarget : undefined}
            onApproveReviewItem={onApproveReviewItem}
            videoPermissionContract={videoPermissionContract}
            onVideoPermissionContractChange={setVideoPermissionContract}
            onPendingAgentActionChange={handleAgentPendingActionChange}
            onReferencePlanningFocusChange={handleAgentReferencePlanningFocusChange}
            onEditingPendingConfirmationChange={handleAgentEditingPendingConfirmationChange}
            onCurrentTaskProjectionChange={handleAgentCurrentTaskProjectionChange}
          />
        </div>
      )}
    </div>
  );
}
