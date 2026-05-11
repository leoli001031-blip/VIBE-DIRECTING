import type { ReactNode } from "react";
import type { PreviewQueueItem } from "../../core/previewPlayerQueue";
import type { ProjectRuntimeState } from "../../core/projectState";
import type { ProjectFactsStagedApplyPlan } from "../../core/projectTransaction";
import type { RuntimeView } from "../../core/runtimeView";
import type { AssetRecord, ProjectAudit, ShotRecord } from "../../core/types";
import { MinimalAgentPanel } from "./MinimalAgentPanel";
import { MinimalPreview } from "./MinimalPreview";
import { MinimalStoryFlow } from "./MinimalStoryFlow";
import type { DirectorView } from "./directorTypes";

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
  previewEmptyStateLabel,
  previewEmptyStateDetail,
  directorView,
  activeSectionId,
  statusNode,
  assetLibraryNode,
  onSelectShot,
  onProjectStoreApplyPlanReady,
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
  previewEmptyStateLabel?: string;
  previewEmptyStateDetail?: string;
  directorView: DirectorView;
  activeSectionId?: string;
  statusNode: ReactNode;
  assetLibraryNode: ReactNode;
  onSelectShot: (id: string, additive?: boolean) => void;
  onProjectStoreApplyPlanReady?: (plan: ProjectFactsStagedApplyPlan) => void;
}) {
  const activeSection = view.storySections.find((section) => section.id === activeSectionId) || view.storySections[0];
  const sectionLabel = activeSection?.label || "故事流";
  const shots = activeSection ? audit.shots.filter((shot) => activeSection.shotIds.includes(shot.id)) : audit.shots;

  return (
    <div className={`minimal-director ${directorView}`}>
      <div className="minimal-director-main">
        {statusNode}
        {directorView === "assets" && assetLibraryNode}
        {directorView === "story" && (
          <MinimalStoryFlow
            sectionLabel={sectionLabel}
            shots={shots}
            selectedShotId={selectedShotId}
            selectedShotIds={selectedShotIds}
            onSelectShot={onSelectShot}
          />
        )}
        {directorView === "preview" && (
          <MinimalPreview
            previewExport={runtimeState.previewExport}
            currentProjectPreviewItems={currentProjectPreviewItems}
            emptyStateLabel={previewEmptyStateLabel}
            emptyStateDetail={previewEmptyStateDetail}
            sections={view.storySections}
            shots={audit.shots}
            selectedShotId={selectedShotId}
            onSelectShot={onSelectShot}
          />
        )}
      </div>
      <MinimalAgentPanel
        runtimeState={runtimeState}
        projectScopeLabel={projectScopeLabel}
        shot={directorView === "assets" ? undefined : selectedShot}
        selectedShots={directorView === "story" ? selectedShots : []}
        asset={directorView === "assets" ? selectedAsset : undefined}
        sectionLabel={sectionLabel}
        sectionId={directorView === "story" && !selectedShot ? activeSection?.id : undefined}
        onProjectStoreApplyPlanReady={onProjectStoreApplyPlanReady}
      />
    </div>
  );
}
