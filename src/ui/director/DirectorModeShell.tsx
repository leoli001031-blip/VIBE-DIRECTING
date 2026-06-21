import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PreviewQueueItem } from "../../core/previewPlayerQueue";
import type { ExportActionState } from "../../core/exportAction";
import type { ExportWorkerState } from "../../core/exportWorker";
import type { ProjectRuntimeState } from "../../core/projectState";
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
import { MinimalStoryFlow } from "./MinimalStoryFlow";
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

function ProjectStatusSummary({ status }: { status: ProjectStatusViewModel }) {
  const videoQueryActive = status.stage === "视频待查询";
  return (
    <section className={`project-status-summary ${status.tone}`} aria-label="当前项目状态">
      <div className="project-status-summary-main">
        <span>{status.stage}</span>
        <strong>{status.doing}</strong>
        <small>等待：{status.waitingFor}</small>
      </div>
      <div className="project-status-summary-next">
        <span>{videoQueryActive ? "操作" : "下一步"}</span>
        <strong>{videoQueryActive ? "确认查询" : status.nextAction}</strong>
        {videoQueryActive
          ? <small>查询只取回结果，不会重复提交</small>
          : status.issue && <small>{status.issue}</small>}
      </div>
      <div className="project-status-summary-facts" aria-label="项目概览">
        {status.facts.map((fact, index) => (
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
        >
          <span>故事</span>
          <small>{totalShots} 镜头</small>
        </button>
        <button
          type="button"
          className={directorView === "assets" ? "active" : ""}
          onClick={() => onOpenDirectorView?.("assets")}
          disabled={!projectReady}
        >
          <span>参考</span>
          <small>{referenceLabel}</small>
        </button>
        <button
          type="button"
          className={directorView === "preview" ? "active" : ""}
          onClick={() => onOpenDirectorView?.("preview")}
          disabled={!projectReady}
        >
          <span>视频</span>
          <small>{videoLabel}</small>
        </button>
        <button
          type="button"
          className={directorView === "export" ? "active" : ""}
          onClick={() => onOpenDirectorView?.("export")}
          disabled={!projectReady}
        >
          <span>交付</span>
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
  const doing = generation.queueSummary || generation.detail || generation.statusLabel || "Seedance 2.0 VIP 已提交，后台等待";
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
    doing: "故事已保存到项目",
    waitingFor: "你的下一句指令",
    nextAction: "继续说要改哪里，或让 AI 开始补参考",
    tone: "ready",
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
  const userTitle = userEntry?.body.replace(/\s+/g, " ").trim();
  const shotCountText = latestConfirmation.facts?.find((fact) => fact.label === "镜头")?.value || "";
  const shotCount = Number.parseInt(shotCountText, 10);
  return {
    title: userTitle ? `待确认故事：${userTitle.slice(0, 28)}${userTitle.length > 28 ? "..." : ""}` : "待确认故事",
    shotCount: Number.isFinite(shotCount) && shotCount > 0 ? shotCount : undefined,
  };
}

export function DirectorMode({
  audit,
  view,
  runtimeState,
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
  onNewVideoStatusChange,
  onStagePrototypeAgentPlan,
  onRememberAgentActionLogItem,
  onRememberAgentTimelineEntries,
  onPreviewPrototypeAgentDemo,
}: {
  audit: ProjectAudit;
  view: RuntimeView;
  runtimeState: ProjectRuntimeState;
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
  directorView: DirectorView;
  activeSectionId?: string;
  assetLibraryNode: ReactNode;
  onSelectShot: (id: string, additive?: boolean) => void;
  onSelectAsset?: (id: string) => void;
  onOpenSection: (sectionId: string) => void;
  onProjectStoreApplyPlanReady?: (plan: ProjectFactsStagedApplyPlan) => void;
  onNewVideoDraftConfirmed?: (draft: NewVideoStartDraft, context: NewVideoStartConfirmationContext) => boolean | void | Promise<boolean | void>;
  onCreateLocalProject?: (draft?: NewVideoStartDraft) => unknown | Promise<unknown>;
  onRunExport?: (target?: Pick<AgentControlledToolInvocationTarget, "agentToolTrace">) => unknown | Promise<unknown>;
  onCreateP6RealSample?: (target?: AgentControlledToolInvocationTarget) => unknown | Promise<unknown>;
  onCreateImage2EndFrame?: () => void | Promise<void>;
  onSendSeedanceVideo?: (target?: AgentControlledToolInvocationTarget) => unknown | Promise<unknown>;
  onDialogueAudioCreated?: (input: MinimalAudioPlanDialogueAudioCreated) => void | Promise<void>;
  onRetryMissingBatch?: () => unknown | Promise<unknown>;
  onRetryReviewItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onApproveReviewItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onRejectReviewItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onLockReviewItem?: (item: CreatorReviewTrayItem, target: CreatorReviewLockTarget) => void | Promise<void>;
  onOpenDirectorView?: (view: DirectorView) => void;
  latestPrototypeAgentDemo?: PrototypeAgentDemoRun;
  restoredAgentStagedPlanDraft?: ProjectAgentStagedPlanDraft;
  restoredAgentActionLog?: ProjectAgentActionLogItem[];
  restoredAgentTimelineEntries?: VibeAgentTimelineEntry[];
  onNewVideoStatusChange?: (status?: NewVideoStartStatus) => void;
  onStagePrototypeAgentPlan?: (input: StagePrototypeAgentPlanInput) => StagePrototypeAgentPlanResult | void | Promise<StagePrototypeAgentPlanResult | void>;
  onRememberAgentActionLogItem?: (item: ProjectAgentActionLogItem) => void | Promise<void>;
  onRememberAgentTimelineEntries?: (entries: VibeAgentTimelineEntry[]) => void | Promise<void>;
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
        ? "导出"
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
      ? "先写想法"
      : "需要本地项目";
  const agentShotBoundView = directorView === "story" || directorView === "preview" || directorView === "export";
  const [videoPermissionContract, setVideoPermissionContract] = useState<AgentVideoPermissionContract>(defaultAgentVideoPermissionContract);
  const [newVideoStatus, setNewVideoStatus] = useState<NewVideoStartStatus | undefined>();
  const [agentIntakeCommand, setAgentIntakeCommand] = useState<NewVideoStartAgentIntakeCommand | undefined>();
  const [agentNewVideoDraftActive, setAgentNewVideoDraftActive] = useState(false);
  const [agentPendingAction, setAgentPendingAction] = useState(false);
  const restoredNewVideoDraft = useMemo(
    () => restoredNewVideoDraftSummary(restoredAgentTimelineEntries),
    [restoredAgentTimelineEntries],
  );
  const restoredNewVideoDraftActive = Boolean(restoredNewVideoDraft);
  const showNewVideoStart = !projectReady || shots.length === 0 || agentNewVideoDraftActive || restoredNewVideoDraftActive;
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
  const videoSubmitCancelled = videoSendAction?.status === "blocked" && /已取消，本次没有发送/.test(videoSendAction.message || "");
  const visibleAgentCommand = useMemo<CreatorAgentCommand | undefined>(() => {
    const command = creatorDesk?.agentCommand;
    if (!command) return undefined;
    if (command.kind === "generate_references" && !videoPermissionAllowsReference) {
      return {
        ...command,
        label: "确认生成参考",
        summary: "参考还缺，确认后再生成。",
        detail: "现在我只整理方案。确认后只生成参考，不会发送视频。",
      };
    }
    if (command.kind === "submit_video" && videoSendAction?.status === "blocked" && !videoSubmitCancelled) {
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
  }, [creatorDesk?.agentCommand, videoPermissionAllowsReference, videoPermissionAllowsSend, videoPermissionContract.mode, videoSendAction?.message, videoSendAction?.status, videoSubmitCancelled]);
  const storyDetailLabel = [`${storySections.length} 个段落`, "点击查看分镜、模式和画面状态"].join(" · ");
  const showCreatorDeskPanel = projectReady && creatorDesk && !showNewVideoStart && directorView === "story" && !agentPendingAction;
  useEffect(() => {
    if (!showNewVideoStart && newVideoStatus) {
      setNewVideoStatus(undefined);
      onNewVideoStatusChange?.(undefined);
    }
  }, [newVideoStatus, onNewVideoStatusChange, showNewVideoStart]);
  const agentTimelineStatusView = useMemo(
    () => buildVibeAgentTimelineStatusView(restoredAgentTimelineEntries),
    [restoredAgentTimelineEntries],
  );
  const rawProjectStatusView = useMemo(() => buildProjectStatusViewModel({
    runtimeState,
    folderReady,
    projectReady,
    localProjectBusy,
    directorView,
    referenceGenerationAction: realSampleAction,
    endFrameAction,
    videoSendAction: sessionVideoSendAction,
    videoStage: creatorDesk?.videoStage,
    referenceBatch: creatorDesk?.batchGeneration,
    framePlan: creatorDesk?.framePlan,
    referenceGapCount: creatorReferenceGapCount(creatorDesk),
    agentStage: creatorDesk?.agentStage,
    agentCommand: visibleAgentCommand,
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
    visibleAgentCommand,
  ]);
  const projectStatusView = useMemo(
    () => projectStatusViewWithCommittedDraft(
      projectStatusViewWithActiveVideo(rawProjectStatusView, creatorDesk),
      isCommittedNewVideoDraftAgentRun(latestPrototypeAgentDemo),
    ),
    [creatorDesk, latestPrototypeAgentDemo, rawProjectStatusView],
  );
  const displayedProjectStatusView: ProjectStatusViewModel = agentPendingAction
    ? {
        ...projectStatusView,
        stage: "待确认操作",
        doing: "右侧有一条待确认动作",
        waitingFor: "先确认，或继续说明怎么改",
        nextAction: "在右侧处理",
        tone: "waiting",
        issue: undefined,
      }
    : projectStatusView;
  const pendingDraftRailTitle = showNewVideoStart ? pendingNewVideoDraftTitle(newVideoStatus) || restoredNewVideoDraft?.title || "" : "";
  const projectNavReady = projectReady && !showNewVideoStart;
  const projectNavSections = showNewVideoStart ? [] : storySections;
  const projectNavShotCount = showNewVideoStart ? (newVideoStatus?.draftShotCount || restoredNewVideoDraft?.shotCount || 0) : runtimeState.storyFlow.shots.length;
  const projectRailTitle = pendingDraftRailTitle || runtimeState.project.title || projectScopeLabel || "新视频项目";
  const projectRailVideoLabel = directorProjectRailVideoLabel(creatorDesk?.videoStage);
  const projectRailReferenceGapCount = creatorReferenceGapCount(creatorDesk);
  const projectRailReferenceLabel = directorProjectRailReferenceLabel(
    creatorDesk,
    displayableReferenceAssetCount(runtimeState.visualMemory.assets),
    projectRailReferenceGapCount,
  );
  const projectRailDisplayReferenceLabel = showNewVideoStart
    ? newVideoStatus?.draftReferenceCount
      ? `${newVideoStatus.draftReferenceCount} 个素材`
      : "待确认"
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
    });
  }

  function confirmNewVideoDraftFromAgent() {
    onOpenDirectorView?.("story");
    setAgentNewVideoDraftActive(true);
    setNewVideoStatus(undefined);
    setAgentIntakeCommand({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: "确认这版故事",
      mode: "confirm_current_draft",
    });
  }

  function handleNewVideoStatusChange(status: NewVideoStartStatus) {
    setNewVideoStatus(status);
    onNewVideoStatusChange?.(status);
  }

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
          <ProjectStatusSummary status={displayedProjectStatusView} />
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
        {!showCreatorDeskPanel && !showNewVideoStart && (
          <DirectorDetailDisclosure
            title="流程详情"
            detail={creatorDesk?.agentStage.summary || (projectReady ? "AI 会带你推进下一步" : "先描述一个想法")}
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
        {directorView === "assets" && (projectReady ? assetLibraryNode : (
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
                  shots={shots}
                  projectDraftKey={runtimeState.project.root || runtimeState.sourceIndexSummary.projectId}
                  composerResetKey={newVideoComposerResetKey}
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
                  restoredAgentTimelineEntries={restoredAgentTimelineEntries}
                  onRememberAgentTimelineEntries={onRememberAgentTimelineEntries}
                  agentIntakeCommand={agentIntakeCommand}
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
              sections={storySections}
              shots={audit.shots}
              selectedShotId={selectedShotId}
              onSelectShot={onSelectShot}
              onApprovePreviewItem={onApproveReviewItem}
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
              localProjectReady={localProjectReady}
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
            latestPrototypeAgentDemo={latestPrototypeAgentDemo}
            restoredAgentStagedPlanDraft={restoredAgentStagedPlanDraft}
            restoredAgentActionLog={restoredAgentActionLog}
            restoredAgentTimelineEntries={restoredAgentTimelineEntries}
            onStagePrototypeAgentPlan={onStagePrototypeAgentPlan}
            onRememberAgentActionLogItem={onRememberAgentActionLogItem}
            onRememberAgentTimelineEntries={onRememberAgentTimelineEntries}
            onPreviewPrototypeAgentDemo={onPreviewPrototypeAgentDemo}
            agentCommand={visibleAgentCommand}
            projectObservation={projectNavReady ? creatorDesk?.projectObservation : undefined}
            projectStatusView={displayedProjectStatusView}
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
            newVideoDraftPendingForAgent={showNewVideoStart && newVideoStatus?.status === "drafting"}
            newVideoDraftPlanningForAgent={showNewVideoStart && newVideoStatus?.status === "planning"}
            newVideoDraftReadyForAgent={showNewVideoStart && newVideoStatus?.status === "ready"}
            onCreateP6RealSample={onCreateP6RealSample}
            onCreateImage2EndFrame={onCreateImage2EndFrame}
            onSendSeedanceVideo={onSendSeedanceVideo}
            onRunExport={onRunExport}
            onOpenResultView={onOpenDirectorView}
            onRetryMissingBatch={onRetryMissingBatch}
            videoPermissionContract={videoPermissionContract}
            onVideoPermissionContractChange={setVideoPermissionContract}
            onPendingAgentActionChange={setAgentPendingAction}
          />
        </div>
      )}
    </div>
  );
}
