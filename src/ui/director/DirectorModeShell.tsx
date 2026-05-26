import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import type { PreviewQueueItem } from "../../core/previewPlayerQueue";
import type { ExportActionState } from "../../core/exportAction";
import type { ExportWorkerState } from "../../core/exportWorker";
import type { ProjectRuntimeState } from "../../core/projectState";
import type { ProjectPreviewExportState } from "../../core/types";
import type { ProjectFactsStagedApplyPlan } from "../../core/projectTransaction";
import type { RuntimeView } from "../../core/runtimeView";
import type { DirectorFeedbackRecompileResult } from "../../core/directorFeedbackRecompile";
import type { StoryboardReferenceProjectPlannerInput } from "../../core/storyboardReferenceProjectPlanner";
import type { AssetRecord, ProjectAudit, ShotRecord } from "../../core/types";
import type { KnowledgePack, KnowledgePackManifest } from "../../core/knowledgeTypes";
import type { AgentWebSearchResult, AgentWebSearchSettings } from "../../core/agentWebSearchClient";
import { MinimalAgentPanel } from "./MinimalAgentPanel";
import { MinimalStoryFlow } from "./MinimalStoryFlow";
import { CreatorDeskPanels } from "./CreatorDeskPanels";
import { DirectorWorkflowOverview } from "./DirectorWorkflowOverview";
import { NewVideoStart, type NewVideoStartConfirmationContext, type NewVideoStartDraft } from "./NewVideoStart";
import type { DirectorView } from "./directorTypes";
import {
  agentVideoSubmitContractAllowsVideo as agentVideoPermissionAllowsVideo,
  defaultAgentVideoSubmitContract as defaultAgentVideoPermissionContract,
  type AgentVideoSubmitContract as AgentVideoPermissionContract,
  type PrototypeAgentDemoRun,
  type PreviewPrototypeAgentDemoInput,
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
  latestPrototypeAgentDemo,
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
  };
  webSearchSettings?: AgentWebSearchSettings;
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
  onCreateLocalProject?: (draft: NewVideoStartDraft) => unknown | Promise<unknown>;
  onRunExport?: () => void | Promise<void>;
  onCreateP6RealSample?: () => void | Promise<void>;
  onCreateImage2EndFrame?: () => void | Promise<void>;
  onSendSeedanceVideo?: () => void | Promise<void>;
  onDialogueAudioCreated?: (input: MinimalAudioPlanDialogueAudioCreated) => void | Promise<void>;
  onRetryMissingBatch?: () => void | Promise<void>;
  onRetryReviewItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onApproveReviewItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onRejectReviewItem?: (item: CreatorReviewTrayItem) => void | Promise<void>;
  onLockReviewItem?: (item: CreatorReviewTrayItem, target: CreatorReviewLockTarget) => void | Promise<void>;
  latestPrototypeAgentDemo?: PrototypeAgentDemoRun;
  onPreviewPrototypeAgentDemo?: (input: PreviewPrototypeAgentDemoInput) => void | Promise<void>;
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
  const agentShotBoundView = directorView === "story" || directorView === "preview" || directorView === "export";
  const [videoPermissionContract, setVideoPermissionContract] = useState<AgentVideoPermissionContract>(defaultAgentVideoPermissionContract);
  const videoPermissionAllowsSend = agentVideoPermissionAllowsVideo(videoPermissionContract);
  const sessionVideoSendAction = useMemo(() => {
    if (!videoSendAction || videoPermissionAllowsSend) return videoSendAction;
    return {
      ...videoSendAction,
      disabled: true,
      ready: false,
      message: videoPermissionContract.mode === "plan_only"
        ? "当前只规划，不会提交视频。"
        : "当前先做参考，视频等你确认。",
    };
  }, [videoSendAction, videoPermissionAllowsSend, videoPermissionContract.mode]);
  const sessionSendSeedanceVideo = videoPermissionAllowsSend ? onSendSeedanceVideo : undefined;

  return (
    <div className={`minimal-director ${directorView} ${showAgentPanel ? "has-bottom-composer" : "composer-only"}`}>
      <div className="minimal-director-main">
        <div className="director-workbar" aria-label="项目工作状态">
          {statusNode}
        </div>
        <DirectorWorkflowOverview
          runtimeState={runtimeState}
          shots={projectReady ? audit.shots : []}
          selectedShot={projectReady ? selectedShot : undefined}
          currentView={directorView}
          creatorDesk={projectReady ? creatorDesk : undefined}
          localProjectReady={projectReady}
        />
        {directorView === "assets" && (projectReady ? assetLibraryNode : (
            <EmptyProjectSurface
              title="还没有参考资产"
              detail="在底部写脚本或拖文件，确认后会出现在这里。"
          />
        ))}
        {directorView === "story" && (
          <>
            {showNewVideoStart && (
              <NewVideoStart
                shots={shots}
                localProjectReady={folderReady}
                localProjectBusy={localProjectBusy}
                canCreateLocalProject={canCreateLocalProject}
                availableKnowledgePacks={projectReferenceGuide?.packs}
                webSearchSettings={webSearchSettings}
                onSaveResearchAsReference={onSaveResearchAsReference}
                onCreateLocalProject={onCreateLocalProject}
                onDraftConfirmed={onNewVideoDraftConfirmed}
              />
            )}
            {!showNewVideoStart && (
              <MinimalStoryFlow
                sectionLabel={sectionLabel}
                shots={shots}
                assets={storyAssets}
                selectedShotId={selectedShotId}
                selectedShotIds={selectedShotIds}
                onSelectShot={onSelectShot}
              />
            )}
            {projectReady && creatorDesk && (
              <CreatorDeskPanels
                projection={creatorDesk}
                onRetryMissing={onRetryMissingBatch}
                videoSendAction={sessionVideoSendAction}
                onSendVideo={sessionSendSeedanceVideo}
                onRetryItem={onRetryReviewItem}
                onApproveItem={onApproveReviewItem}
                onRejectItem={onRejectReviewItem}
                onLockItem={onLockReviewItem}
                onSelectItem={(item) => item.shotId && onSelectShot(item.shotId)}
              />
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
            shot={projectReady && agentShotBoundView ? selectedShot : undefined}
            selectedShots={projectReady && agentShotBoundView ? selectedShots : []}
            asset={projectReady && directorView === "assets" ? selectedAsset : undefined}
            sectionLabel={agentSectionLabel}
            sectionId={projectReady && directorView === "story" && !selectedShot ? activeSection?.id : undefined}
            onProjectStoreApplyPlanReady={onProjectStoreApplyPlanReady}
            latestPrototypeAgentDemo={latestPrototypeAgentDemo}
            onPreviewPrototypeAgentDemo={onPreviewPrototypeAgentDemo}
            realSampleAction={directorView === "story" ? realSampleAction : undefined}
            endFrameAction={directorView === "story" ? endFrameAction : undefined}
            videoSendAction={directorView === "story" ? sessionVideoSendAction : undefined}
            webSearchSettings={webSearchSettings}
            projectReferenceGuide={projectReferenceGuide}
            storyboardProjectPlanInput={storyboardProjectPlanInput}
            onDirectorFeedbackConfirmed={onDirectorFeedbackConfirmed}
            onSaveResearchAsReference={onSaveResearchAsReference}
            onCreateP6RealSample={onCreateP6RealSample}
            onCreateImage2EndFrame={onCreateImage2EndFrame}
            onSendSeedanceVideo={sessionSendSeedanceVideo}
            videoPermissionContract={videoPermissionContract}
            onVideoPermissionContractChange={setVideoPermissionContract}
          />
        </div>
      )}
    </div>
  );
}
