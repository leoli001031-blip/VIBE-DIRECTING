import type { ProjectRuntimeState } from "./projectState";
import type {
  ProjectCurrentBindingStatus,
  ProjectImage2BatchUiState,
  ProjectRealChainPreviewItem,
  ProjectRealChainUiState,
} from "./projectRealChainStatus";
import type { ShotRecord } from "./types";

export const currentProjectWorkbenchProjectionSchemaVersion = "0.1.0";
export const currentProjectWorkbenchProjectionSource = "current_project_workbench_projection" as const;

export type CurrentProjectWorkbenchPreviewQueueSource =
  | "current_project_preview_items"
  | "current_project_no_preview_items"
  | "unbound";

export interface CurrentProjectWorkbenchIdentity {
  status: "bound" | "unbound" | "loading";
  projectId?: string;
  projectRoot?: string;
  projectTitle?: string;
  displayTitle: string;
  displayRoot: string;
}

export interface CurrentProjectWorkbenchStorySummary {
  statusLabel: string;
  detail: string;
  shotCount: number;
  sectionCount: number;
  fallbackUsed: boolean;
}

export interface CurrentProjectWorkbenchAssetSummary {
  statusLabel: string;
  detail: string;
  lockedCount: number;
  needsReviewCount: number;
  missingCount: number;
  readinessCount: number;
  readOnlyProjection: boolean;
}

export interface CurrentProjectWorkbenchSelectedScope {
  defaultShotId?: string;
  selectedShotIds: string[];
  label: string;
  detail: string;
}

export interface CurrentProjectWorkbenchProjection {
  schemaVersion: typeof currentProjectWorkbenchProjectionSchemaVersion;
  source: typeof currentProjectWorkbenchProjectionSource;
  available: boolean;
  identity: CurrentProjectWorkbenchIdentity;
  story: CurrentProjectWorkbenchStorySummary;
  assets: CurrentProjectWorkbenchAssetSummary;
  selectedScope: CurrentProjectWorkbenchSelectedScope;
  previewQueueSource: CurrentProjectWorkbenchPreviewQueueSource;
  previewItemCount: number;
  shots: ShotRecord[];
  providerCalled: false;
  liveSubmitAllowed: false;
  workerSpawnForbidden: true;
}

export interface BuildCurrentProjectWorkbenchProjectionInput {
  binding: ProjectCurrentBindingStatus;
  realChainState?: ProjectRealChainUiState;
  image2BatchState?: ProjectImage2BatchUiState;
  selectedShotId?: string;
  selectedShotIds?: string[];
}

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function basename(value?: string) {
  const normalized = (value || "").replace(/\\/g, "/").replace(/\/+$/g, "");
  return normalized.split("/").filter(Boolean).at(-1);
}

function displayTitle(binding: ProjectCurrentBindingStatus) {
  return cleanString(binding.projectTitle)
    || cleanString(binding.projectId)
    || basename(binding.projectRoot)
    || (binding.status === "bound" ? "未命名项目" : "未选择项目");
}

function previewItems(realChainState?: ProjectRealChainUiState): ProjectRealChainPreviewItem[] {
  return realChainState?.summary?.previewItems || [];
}

function previewItemStatus(item: ProjectRealChainPreviewItem): ShotRecord["status"] {
  const rawStatus = `${item.previewQaStatus || ""} ${item.productionQaStatus || ""}`.toLowerCase();
  if (item.outputExists === false) return "blocked";
  if (item.reviewRequired || rawStatus.includes("review")) return "assets_ready";
  if (item.imageUrl || item.thumbnailUrl || item.expectedOutputPath) return "ready";
  return "blocked";
}

function shotStoryFunction(item: ProjectRealChainPreviewItem) {
  if (item.outputExists === false) return "当前项目投影 / 等待画面回流";
  if (item.reviewRequired) return "当前项目画面需复核";
  return "当前项目画面已回流";
}

function shotFromPreviewItem(item: ProjectRealChainPreviewItem, index: number): ShotRecord {
  const shotId = cleanString(item.shotId) || cleanString(item.id) || `S${String(index + 1).padStart(2, "0")}`;
  return {
    id: shotId,
    actId: "current",
    sectionId: "current_project",
    title: `当前项目 ${shotId}`,
    storyFunction: shotStoryFunction(item),
    startFrame: cleanString(item.imageUrl) || cleanString(item.thumbnailUrl) || cleanString(item.expectedOutputPath),
    status: previewItemStatus(item),
    gates: {
      identity: item.reviewRequired ? "PARTIAL" : "UNKNOWN",
      scene: "UNKNOWN",
      pair: "UNKNOWN",
      story: "UNKNOWN",
      prop: "UNKNOWN",
      style: "UNKNOWN",
    },
    issues: item.reviewRequired ? ["needs_review"] : item.outputExists === false ? ["missing_start_frame"] : [],
  };
}

function fallbackShot(identity: CurrentProjectWorkbenchIdentity): ShotRecord {
  return {
    id: "CURRENT_PROJECT",
    actId: "current",
    sectionId: "current_project",
    title: identity.status === "bound" ? identity.displayTitle : "未选择项目",
    storyFunction: identity.status === "bound" ? "当前项目投影 / 待补齐故事流" : "未选择项目 / 未同步",
    status: "blocked",
    gates: {
      identity: "UNKNOWN",
      scene: "UNKNOWN",
      pair: "UNKNOWN",
      story: "UNKNOWN",
      prop: "UNKNOWN",
      style: "UNKNOWN",
    },
    issues: ["current_project_story_pending"],
  };
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(cleanString(value)))));
}

function selectedShotScope(
  shots: ShotRecord[],
  input: BuildCurrentProjectWorkbenchProjectionInput,
  identity: CurrentProjectWorkbenchIdentity,
): CurrentProjectWorkbenchSelectedScope {
  const shotIds = new Set(shots.map((shot) => shot.id));
  const selectedShotIds = uniqueStrings([...(input.selectedShotIds || []), input.selectedShotId]).filter((shotId) => shotIds.has(shotId));
  const defaultShotId = selectedShotIds[0] || shots[0]?.id;
  const normalized = selectedShotIds.length ? selectedShotIds : defaultShotId ? [defaultShotId] : [];
  const label = identity.status !== "bound"
    ? "未选择项目/未同步"
    : normalized.length > 1
      ? `${identity.displayTitle} · ${normalized.length} 个镜头`
      : normalized[0]
        ? `${identity.displayTitle} · ${normalized[0]}`
        : identity.displayTitle;
  return {
    defaultShotId,
    selectedShotIds: normalized,
    label,
    detail: identity.status === "bound" ? "跟随当前项目选择" : "等待连接当前项目",
  };
}

function referenceReadinessCount(image2BatchState?: ProjectImage2BatchUiState) {
  const references = image2BatchState?.summary?.items.flatMap((item) => item.referencePaths) || [];
  return uniqueStrings(references).length;
}

export function buildCurrentProjectWorkbenchProjection(
  input: BuildCurrentProjectWorkbenchProjectionInput,
): CurrentProjectWorkbenchProjection {
  const identity: CurrentProjectWorkbenchIdentity = {
    status: input.binding.status,
    projectId: cleanString(input.binding.projectId),
    projectRoot: cleanString(input.binding.projectRoot),
    projectTitle: cleanString(input.binding.projectTitle),
    displayTitle: displayTitle(input.binding),
    displayRoot: cleanString(input.binding.projectRoot) || "未选择项目",
  };
  const bound = input.binding.status === "bound";
  const items = bound ? previewItems(input.realChainState) : [];
  const shots = items.length ? items.map(shotFromPreviewItem) : [fallbackShot(identity)];
  const previewQueueSource: CurrentProjectWorkbenchPreviewQueueSource = !bound
    ? "unbound"
    : items.length
      ? "current_project_preview_items"
      : "current_project_no_preview_items";
  const storyFallbackUsed = !items.length;
  const readinessCount = referenceReadinessCount(input.image2BatchState);
  const selectedScope = selectedShotScope(shots, input, identity);

  return {
    schemaVersion: currentProjectWorkbenchProjectionSchemaVersion,
    source: currentProjectWorkbenchProjectionSource,
    available: bound,
    identity,
    story: {
      statusLabel: bound && !storyFallbackUsed ? "当前项目故事流" : bound ? "当前项目投影" : "未选择项目",
      detail: bound && storyFallbackUsed ? "待补齐故事流" : bound ? `${shots.length} 个镜头来自当前项目` : "未同步",
      shotCount: shots.length,
      sectionCount: 1,
      fallbackUsed: storyFallbackUsed,
    },
    assets: {
      statusLabel: bound ? "当前项目资产待补齐" : "未选择项目资产",
      detail: readinessCount ? `${readinessCount} 个复核参考来自当前项目 / 只读投影` : "当前项目资产待补齐 / 只读投影",
      lockedCount: 0,
      needsReviewCount: 0,
      missingCount: bound ? 1 : 0,
      readinessCount,
      readOnlyProjection: true,
    },
    selectedScope,
    previewQueueSource,
    previewItemCount: items.length,
    shots,
    providerCalled: false,
    liveSubmitAllowed: false,
    workerSpawnForbidden: true,
  };
}

export function applyCurrentProjectWorkbenchProjectionToRuntimeState(
  runtimeState: ProjectRuntimeState,
  projection: CurrentProjectWorkbenchProjection,
): ProjectRuntimeState {
  const generatedAt = runtimeState.generatedAt || new Date().toISOString();
  const projectId = projection.identity.projectId || "current_project";
  const projectRoot = projection.identity.projectRoot || "";
  const projectTitle = projection.identity.displayTitle;
  const visualMemorySummary = {
    total: 0,
    existing: 0,
    locked: 0,
    needsReview: 0,
    missing: projection.available ? projection.assets.missingCount : 0,
    byType: [],
  };

  return {
    ...runtimeState,
    project: {
      ...runtimeState.project,
      title: projectTitle,
      root: projectRoot,
      sourceTask: projection.story.detail,
      state: projection.available ? "current_project_projection" : "current_project_unbound",
      metrics: {
        ...runtimeState.project.metrics,
        expectedAssets: 0,
        existingAssets: 0,
        expectedKeyframes: projection.shots.length,
        existingKeyframes: projection.previewItemCount,
      },
    },
    sourceIndex: {
      ...runtimeState.sourceIndex,
      projectId,
      currentStoryFlowId: projection.available ? `${projectRoot || projectId}/story_flow` : undefined,
      currentVisualMemoryId: projection.available ? `${projectRoot || projectId}/visual_memory` : undefined,
      lockedReferenceIds: [],
      candidateReferenceIds: [],
      rejectedReferenceIds: [],
      failedReferenceIds: [],
      staleArtifactIds: [],
      updatedAt: generatedAt,
    },
    sourceIndexSummary: {
      ...runtimeState.sourceIndexSummary,
      projectId,
      lockedReferenceCount: 0,
      candidateReferenceCount: 0,
      rejectedReferenceCount: 0,
      failedReferenceCount: 0,
      staleArtifactCount: 0,
      blockingReferenceCount: projection.assets.missingCount,
      isProductionReady: false,
      updatedAt: generatedAt,
    },
    storyFlow: {
      sections: [{
        id: "current_project",
        label: projection.story.statusLabel,
        shotCount: projection.shots.length,
        blockedCount: projection.shots.filter((shot) => shot.status === "blocked" || shot.status === "video_missing").length,
        readyCount: projection.shots.filter((shot) => shot.status === "ready" || shot.status === "keyframe_pair_ready").length,
        shotIds: projection.shots.map((shot) => shot.id),
      }],
      shots: projection.shots,
    },
    visualMemory: {
      summary: visualMemorySummary,
      assets: [],
    },
    taskRuns: {
      ...runtimeState.taskRuns,
      jobs: [],
      runs: [],
      taskViews: [],
      queueSummary: {
        total: 0,
        ready: 0,
        blocked: 0,
        parked: 0,
        succeeded: 0,
        missingOutputs: 0,
      },
      preflightSummary: {
        blocked: projection.story.fallbackUsed ? 1 : 0,
        warnings: 0,
        blockers: [],
      },
    },
    manifestMatches: {
      ...runtimeState.manifestMatches,
      summary: {
        complete: 0,
        present: 0,
        missing: 0,
        recoverable: 0,
      },
      reports: [],
    },
    imagePipeline: {
      ...runtimeState.imagePipeline,
      promptPlans: [],
      promptConflictReports: [],
      assetReadinessReports: [],
      imageTaskPlans: [],
      image2AdapterRequests: [],
      watcherEvents: [],
      generationHealthReports: [],
      qaPromotionReports: [],
      imageReferenceTransports: [],
      imageReferenceDeliveryReceipts: [],
    },
    previewEvents: [],
  };
}
