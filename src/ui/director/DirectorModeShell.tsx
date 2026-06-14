import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PreviewQueueItem } from "../../core/previewPlayerQueue";
import type { ExportActionState } from "../../core/exportAction";
import type { ExportWorkerState } from "../../core/exportWorker";
import type { ProjectRuntimeState } from "../../core/projectState";
import type { ProjectAgentActionLogItem, ProjectAgentStagedPlanDraft } from "../../project";
import type { ProjectPreviewExportState } from "../../core/types";
import type { ProjectFactsStagedApplyPlan } from "../../core/projectTransaction";
import type { RuntimeView } from "../../core/runtimeView";
import type { DirectorFeedbackRecompileResult } from "../../core/directorFeedbackRecompile";
import type { StoryboardReferenceProjectPlannerInput } from "../../core/storyboardReferenceProjectPlanner";
import type { AssetRecord, ProjectAudit, ShotRecord } from "../../core/types";
import type { KnowledgePack, KnowledgePackManifest } from "../../core/knowledgeTypes";
import type { AgentWebSearchResult, AgentWebSearchSettings } from "../../core/agentWebSearchClient";
import type { DirectorQaUserFeedback } from "../../core/directorQaUserFeedback";
import { MinimalAgentPanel } from "./MinimalAgentPanel";
import { MinimalStoryFlow } from "./MinimalStoryFlow";
import { CreatorDeskPanels } from "./CreatorDeskPanels";
import { DirectorWorkflowOverview } from "./DirectorWorkflowOverview";
import type { NewVideoStartConfirmationContext, NewVideoStartDraft } from "./NewVideoStart";
import type { DirectorView } from "./directorTypes";
import {
  agentVideoSubmitContractAllowsReference as agentVideoPermissionAllowsReference,
  agentVideoSubmitContractAllowsVideo as agentVideoPermissionAllowsVideo,
  agentVideoSubmitContractForMode as agentVideoPermissionForMode,
  defaultAgentVideoSubmitContract as defaultAgentVideoPermissionContract,
  detectAgentVideoSubmitContract as detectAgentVideoPermissionContract,
  type AgentControlledToolInvocationTarget,
  type AgentVideoSubmitContract as AgentVideoPermissionContract,
  type PrototypeAgentDemoRun,
  type PreviewPrototypeAgentDemoInput,
  type PreviewPrototypeAgentDemoResult,
  type StagePrototypeAgentPlanInput,
  type StagePrototypeAgentPlanResult,
} from "./agentPanelProjection";
import type { CreatorDeskProjection, CreatorReviewLockTarget, CreatorReviewTrayItem } from "./creatorDeskTypes";
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
  directorView,
  activeSectionId,
  statusNode,
  assetLibraryNode,
  onSelectShot,
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
  onStagePrototypeAgentPlan,
  onRememberAgentActionLogItem,
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
  directorView: DirectorView;
  activeSectionId?: string;
  statusNode: ReactNode;
  assetLibraryNode: ReactNode;
  onSelectShot: (id: string, additive?: boolean) => void;
  onProjectStoreApplyPlanReady?: (plan: ProjectFactsStagedApplyPlan) => void;
  onNewVideoDraftConfirmed?: (draft: NewVideoStartDraft, context: NewVideoStartConfirmationContext) => boolean | void | Promise<boolean | void>;
  onCreateLocalProject?: (draft?: NewVideoStartDraft) => unknown | Promise<unknown>;
  onRunExport?: (target?: Pick<AgentControlledToolInvocationTarget, "agentToolTrace">) => unknown | Promise<unknown>;
  onCreateP6RealSample?: (target?: AgentControlledToolInvocationTarget) => unknown | Promise<unknown>;
  onCreateImage2EndFrame?: () => void | Promise<void>;
  onSendSeedanceVideo?: (target?: AgentControlledToolInvocationTarget) => unknown | Promise<unknown>;
  onDialogueAudioCreated?: (input: MinimalAudioPlanDialogueAudioCreated) => void | Promise<void>;
  onRetryMissingBatch?: () => void | Promise<void>;
  onRetryReviewItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onApproveReviewItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onRejectReviewItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onLockReviewItem?: (item: CreatorReviewTrayItem, target: CreatorReviewLockTarget) => void | Promise<void>;
  onOpenDirectorView?: (view: DirectorView) => void;
  latestPrototypeAgentDemo?: PrototypeAgentDemoRun;
  restoredAgentStagedPlanDraft?: ProjectAgentStagedPlanDraft;
  restoredAgentActionLog?: ProjectAgentActionLogItem[];
  onStagePrototypeAgentPlan?: (input: StagePrototypeAgentPlanInput) => StagePrototypeAgentPlanResult | void | Promise<StagePrototypeAgentPlanResult | void>;
  onRememberAgentActionLogItem?: (item: ProjectAgentActionLogItem) => void | Promise<void>;
  onPreviewPrototypeAgentDemo?: (input: PreviewPrototypeAgentDemoInput) => PreviewPrototypeAgentDemoResult | void | Promise<PreviewPrototypeAgentDemoResult | void>;
}) {
  const folderReady = Boolean(localProjectReady);
  const projectReady = projectContentReady ?? folderReady;
  const activeSection = projectReady
    ? view.storySections.find((section) => section.id === activeSectionId) || view.storySections[0]
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
    ? audit.shots
    : audit.shots.filter((shot) => activeSection.shotIds.includes(shot.id));
  const shots = projectReady ? scopedShots : [];
  const storyAssets = projectReady ? audit.assets : [];
  const showNewVideoStart = !projectReady || shots.length === 0;
  const showAgentPanel = !(directorView === "story" && showNewVideoStart);
  const agentProjectStatusLabel = folderReady
    ? "已连接"
    : projectReady
      ? "浏览器草稿"
      : "需要本地项目";
  const agentShotBoundView = directorView === "story" || directorView === "preview" || directorView === "export";
  const [videoPermissionContract, setVideoPermissionContract] = useState<AgentVideoPermissionContract>(defaultAgentVideoPermissionContract);
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
    if (!videoSendAction || videoPermissionAllowsSend || queryOnly) return videoSendAction;
    return {
      ...videoSendAction,
      disabled: true,
      ready: false,
      message: videoPermissionContract.mode === "plan_only"
        ? "当前只规划，不会提交视频。"
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
  const storyDetailLabel = [`${view.storySections.length} 个段落`, "点击查看分镜、模式和画面状态"].join(" · ");
  const showCreatorDeskPanel = projectReady && creatorDesk && !showNewVideoStart && directorView === "story";
  async function confirmNewVideoDraft(draft: NewVideoStartDraft, context: NewVideoStartConfirmationContext) {
    const nextContract = draft.agentBoundaryMode
      ? agentVideoPermissionForMode(draft.agentBoundaryMode)
      : detectAgentVideoPermissionContract([draft.script, draft.style].filter(Boolean).join("\n"), videoPermissionContract);
    pendingConfirmedVideoPermissionContractRef.current = {
      contract: nextContract,
      confirmedAt: Date.now(),
    };
    setVideoPermissionContract(nextContract);
    return onNewVideoDraftConfirmed?.(draft, context);
  }

  return (
    <div className={`minimal-director ${directorView} ${showAgentPanel ? "has-bottom-composer" : "composer-only"}`}>
      <div className="minimal-director-main">
        <div className="director-workbar" aria-label="项目工作状态">
          {statusNode}
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
            onSendVideo={sessionSendSeedanceVideo}
            onRetryItem={sessionRetryReviewItem}
            onApproveItem={onApproveReviewItem}
            onRejectItem={onRejectReviewItem}
            onLockItem={onLockReviewItem}
            onSelectItem={(item) => item.shotId && onSelectShot(item.shotId)}
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
              detail="在底部写脚本或拖文件，确认后会出现在这里。"
          />
        ))}
        {directorView === "story" && (
          <>
            {showNewVideoStart && (
              <Suspense fallback={<EmptyProjectSurface title="正在打开新项目入口" detail="稍等一下，输入框马上就好。" />}>
                <NewVideoStart
                  shots={shots}
                  projectDraftKey={runtimeState.project.root || runtimeState.sourceIndexSummary.projectId}
                  localProjectReady={folderReady}
                  localProjectBusy={localProjectBusy}
                  canCreateLocalProject={canCreateLocalProject}
                  availableKnowledgePacks={projectReferenceGuide?.packs}
                  webSearchSettings={webSearchSettings}
                  webSearchReady={webSearchReady}
                  onSaveResearchAsReference={onSaveResearchAsReference}
                  onDraftConfirmed={confirmNewVideoDraft}
                  videoPermissionContract={videoPermissionContract}
                  onVideoPermissionContractChange={setVideoPermissionContract}
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
              sections={view.storySections}
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
              detail="画面和视频回来后，会在这里播放。"
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
              detail="先从底部开始一个项目，确认后再导出。"
            />
          )
        )}
      </div>
      {showAgentPanel && (
        <div className="director-bottom-composer" aria-label="底部对话框">
          <MinimalAgentPanel
            runtimeState={runtimeState}
            projectScopeLabel={projectReady ? projectScopeLabel : "新视频项目"}
            projectStatusLabel={agentProjectStatusLabel}
            localProjectReady={folderReady}
            localProjectBusy={localProjectBusy}
            canCreateLocalProject={canCreateLocalProject}
            shot={projectReady && agentShotBoundView ? selectedShot : undefined}
            selectedShots={projectReady && agentShotBoundView ? selectedShots : []}
            asset={projectReady && directorView === "assets" ? selectedAsset : undefined}
            sectionLabel={agentSectionLabel}
            sectionId={projectReady && directorView === "story" && !selectedShot ? activeSection?.id : undefined}
            onProjectStoreApplyPlanReady={onProjectStoreApplyPlanReady}
            latestPrototypeAgentDemo={latestPrototypeAgentDemo}
            restoredAgentStagedPlanDraft={restoredAgentStagedPlanDraft}
            restoredAgentActionLog={restoredAgentActionLog}
            onStagePrototypeAgentPlan={onStagePrototypeAgentPlan}
            onRememberAgentActionLogItem={onRememberAgentActionLogItem}
            onPreviewPrototypeAgentDemo={onPreviewPrototypeAgentDemo}
            agentCommand={creatorDesk?.agentCommand}
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
            onCreateP6RealSample={onCreateP6RealSample}
            onCreateImage2EndFrame={onCreateImage2EndFrame}
            onSendSeedanceVideo={onSendSeedanceVideo}
            onRunExport={onRunExport}
            onOpenResultView={onOpenDirectorView}
            videoPermissionContract={videoPermissionContract}
            onVideoPermissionContractChange={setVideoPermissionContract}
          />
        </div>
      )}
    </div>
  );
}
