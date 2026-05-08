import type { ProjectRuntimeState } from "./projectState";
import type {
  ProjectCurrentBindingStatus,
  ProjectImage2BatchUiState,
  ProjectRealChainPreviewItem,
  ProjectRealChainUiState,
  ProjectWorkbenchAssetFact,
  ProjectWorkbenchFacts,
  ProjectWorkbenchStorySectionFact,
  ProjectWorkbenchStoryShotFact,
} from "./projectRealChainStatus";
import type { ShotRecord } from "./types";
import type { AssetRecord } from "./types";

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
  candidateCount: number;
  needsReviewCount: number;
  rejectedCount: number;
  missingCount: number;
  readinessCount: number;
  readOnlyProjection: boolean;
  visualMemoryPresent: boolean;
  visualMemoryReadable: boolean;
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
  sections: Array<{ id: string; label: string; shotIds: string[] }>;
  assetFacts: ProjectWorkbenchAssetFact[];
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

function shotStatusFromFact(
  fact: ProjectWorkbenchStoryShotFact,
  previewItem?: ProjectRealChainPreviewItem,
): ShotRecord["status"] {
  const rawStatus = `${fact.status || ""}`.toLowerCase();
  if (rawStatus.includes("blocked") || rawStatus.includes("missing")) return "blocked";
  if (rawStatus.includes("queued")) return "queued";
  if (rawStatus.includes("keyframe")) return "keyframe_pair_ready";
  if (rawStatus.includes("ready")) return "ready";
  if (previewItem) return previewItemStatus(previewItem);
  return "assets_ready";
}

function shotFromStoryFact(
  fact: ProjectWorkbenchStoryShotFact,
  index: number,
  previewItem?: ProjectRealChainPreviewItem,
): ShotRecord {
  const shotId = cleanString(fact.id) || `S${String(index + 1).padStart(2, "0")}`;
  const issues = uniqueStrings([
    ...(Array.isArray(fact.issues) ? fact.issues : []),
    ...(previewItem?.reviewRequired ? ["needs_review"] : []),
    ...(previewItem?.outputExists === false ? ["missing_start_frame"] : []),
  ]);
  return {
    id: shotId,
    actId: cleanString(fact.actId) || "current",
    sectionId: cleanString(fact.sectionId) || cleanString(fact.sceneId) || "current_project",
    title: cleanString(fact.title) || `当前项目 ${shotId}`,
    storyFunction: cleanString(fact.storyFunction) || "当前项目故事流",
    startFrame: cleanString(fact.startFrame) || cleanString(previewItem?.imageUrl) || cleanString(previewItem?.thumbnailUrl) || cleanString(previewItem?.expectedOutputPath),
    endFrame: cleanString(fact.endFrame),
    status: shotStatusFromFact(fact, previewItem),
    gates: {
      identity: previewItem?.reviewRequired ? "PARTIAL" : "UNKNOWN",
      scene: "UNKNOWN",
      pair: "UNKNOWN",
      story: "PASS",
      prop: "UNKNOWN",
      style: "UNKNOWN",
    },
    issues,
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

function previewItemByShotId(items: ProjectRealChainPreviewItem[]) {
  return new Map(items.map((item) => [item.shotId, item]));
}

function storySectionsFromFacts(
  sections: ProjectWorkbenchStorySectionFact[] | undefined,
  shots: ShotRecord[],
): Array<{ id: string; label: string; shotIds: string[] }> {
  const shotIds = new Set(shots.map((shot) => shot.id));
  const normalized = (sections || [])
    .map((section) => ({
      id: cleanString(section.id) || "current_project",
      label: cleanString(section.label) || cleanString(section.id) || "当前项目故事流",
      shotIds: uniqueStrings(section.shotIds || []).filter((shotId) => shotIds.has(shotId)),
    }))
    .filter((section) => section.shotIds.length);
  if (normalized.length) return normalized;
  return [{
    id: "current_project",
    label: "当前项目故事流",
    shotIds: shots.map((shot) => shot.id),
  }];
}

function fallbackSection(shots: ShotRecord[], label: string) {
  return [{
    id: "current_project",
    label,
    shotIds: shots.map((shot) => shot.id),
  }];
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

function workbenchFacts(realChainState?: ProjectRealChainUiState): ProjectWorkbenchFacts | undefined {
  return realChainState?.summary?.workbenchFacts;
}

function storyFlowUsable(facts?: ProjectWorkbenchFacts) {
  return facts?.storyFlow?.present === true && facts.storyFlow.readable === true && facts.storyFlow.shots.length > 0;
}

function storyFlowMissing(facts?: ProjectWorkbenchFacts) {
  return facts?.storyFlow?.present === false;
}

function visualMemoryReadable(facts?: ProjectWorkbenchFacts) {
  return facts?.visualMemory?.present === true && facts.visualMemory.readable === true;
}

function assetCounts(assetFacts: ProjectWorkbenchAssetFact[]) {
  return {
    locked: assetFacts.filter((asset) => asset.status === "locked").length,
    candidate: assetFacts.filter((asset) => asset.status === "candidate").length,
    needsReview: assetFacts.filter((asset) => asset.status === "needs_review").length,
    rejected: assetFacts.filter((asset) => asset.status === "rejected").length,
    missing: assetFacts.filter((asset) => asset.status === "missing").length,
  };
}

function assetFactToRecord(asset: ProjectWorkbenchAssetFact): AssetRecord {
  const lockedStatus: AssetRecord["lockedStatus"] =
    asset.status === "locked"
      ? "locked"
      : asset.status === "candidate"
        ? "candidate"
        : asset.status === "missing"
          ? "not_generated"
          : "needs_review";
  return {
    id: asset.id,
    type: asset.type,
    name: asset.name,
    path: cleanString(asset.path) || `visual_memory/${asset.id}.json`,
    status: asset.status === "missing" ? "missing" : "exists",
    lockedStatus,
    providerId: "current-project-visual-memory",
    safeForFutureReference: asset.status === "locked",
    issues: uniqueStrings([
      ...(asset.status === "candidate" ? ["candidate_draft_only"] : []),
      ...(asset.status === "needs_review" ? ["needs_review"] : []),
      ...(asset.status === "rejected" ? [asset.rejectedReason || "rejected_reference"] : []),
      ...(asset.status === "missing" ? ["missing_reference"] : []),
    ]),
  };
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
  const facts = bound ? workbenchFacts(input.realChainState) : undefined;
  const itemByShotId = previewItemByShotId(items);
  const useStoryFacts = storyFlowUsable(facts);
  const allowPreviewStoryFallback = bound && !useStoryFacts && (storyFlowMissing(facts) || !facts?.storyFlow);
  const factStoryFlow = useStoryFacts ? facts?.storyFlow : undefined;
  const shots = factStoryFlow
    ? factStoryFlow.shots.map((shot, index) => shotFromStoryFact(shot, index, itemByShotId.get(shot.id)))
    : allowPreviewStoryFallback && items.length
      ? items.map(shotFromPreviewItem)
      : [fallbackShot(identity)];
  const sections = factStoryFlow
    ? storySectionsFromFacts(factStoryFlow.sections, shots)
    : fallbackSection(shots, bound && !items.length ? "当前项目投影" : "当前项目故事流");
  const previewQueueSource: CurrentProjectWorkbenchPreviewQueueSource = !bound
    ? "unbound"
    : items.length
      ? "current_project_preview_items"
      : "current_project_no_preview_items";
  const storyFallbackUsed = !useStoryFacts;
  const readinessCount = referenceReadinessCount(input.image2BatchState);
  const visualPresent = facts?.visualMemory?.present === true;
  const visualReadable = visualMemoryReadable(facts);
  const assetFacts = visualReadable ? facts?.visualMemory?.assets || [] : [];
  const counts = assetCounts(assetFacts);
  const selectedScope = selectedShotScope(shots, input, identity);

  return {
    schemaVersion: currentProjectWorkbenchProjectionSchemaVersion,
    source: currentProjectWorkbenchProjectionSource,
    available: bound,
    identity,
    story: {
      statusLabel: bound && useStoryFacts ? "当前项目故事流" : bound ? "当前项目投影" : "未选择项目",
      detail: bound && !useStoryFacts
        ? facts?.storyFlow?.present && facts.storyFlow.readable === false
          ? "故事流读取失败"
          : "待补齐故事流"
        : bound
          ? `${shots.length} 个镜头来自当前项目`
          : "未同步",
      shotCount: shots.length,
      sectionCount: sections.length,
      fallbackUsed: storyFallbackUsed,
    },
    assets: {
      statusLabel: bound && visualReadable ? "当前项目资产" : bound ? "当前项目资产待补齐" : "未选择项目资产",
      detail: bound && visualReadable
        ? `${assetFacts.length} 个资产来自当前项目`
        : readinessCount
          ? `${readinessCount} 个复核参考来自当前项目 / 只读投影`
          : "当前项目资产待补齐 / 只读投影",
      lockedCount: counts.locked,
      candidateCount: counts.candidate,
      needsReviewCount: counts.needsReview,
      rejectedCount: counts.rejected,
      missingCount: visualReadable ? counts.missing : bound ? 1 : 0,
      readinessCount,
      readOnlyProjection: !visualReadable,
      visualMemoryPresent: visualPresent,
      visualMemoryReadable: visualReadable,
    },
    selectedScope,
    previewQueueSource,
    previewItemCount: items.length,
    shots,
    sections,
    assetFacts,
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
  const assetRecords = projection.assetFacts.map(assetFactToRecord);
  const assetTypes = uniqueStrings(assetRecords.map((asset) => asset.type));
  const visualMemorySummary = {
    total: assetRecords.length,
    existing: assetRecords.filter((asset) => asset.status !== "missing").length,
    locked: projection.assets.lockedCount,
    needsReview: projection.assets.candidateCount + projection.assets.needsReviewCount + projection.assets.rejectedCount,
    missing: projection.available ? projection.assets.missingCount : 0,
    byType: assetTypes.map((type) => {
      const typedAssets = assetRecords.filter((asset) => asset.type === type);
      return {
        type,
        total: typedAssets.length,
        existing: typedAssets.filter((asset) => asset.status !== "missing").length,
        missing: typedAssets.filter((asset) => asset.status === "missing").length,
      };
    }),
  };
  const lockedReferenceIds = projection.assetFacts.filter((asset) => asset.status === "locked").map((asset) => asset.id);
  const candidateReferenceIds = projection.assetFacts.filter((asset) => asset.status === "candidate" || asset.status === "needs_review").map((asset) => asset.id);
  const rejectedReferenceIds = projection.assetFacts.filter((asset) => asset.status === "rejected").map((asset) => asset.id);

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
        existingAssets: visualMemorySummary.existing,
        expectedKeyframes: projection.shots.length,
        existingKeyframes: projection.previewItemCount,
      },
    },
    sourceIndex: {
      ...runtimeState.sourceIndex,
      projectId,
      currentStoryFlowId: projection.available ? `${projectRoot || projectId}/story_flow` : undefined,
      currentVisualMemoryId: projection.available ? `${projectRoot || projectId}/visual_memory` : undefined,
      lockedReferenceIds,
      candidateReferenceIds,
      rejectedReferenceIds,
      failedReferenceIds: [],
      staleArtifactIds: [],
      updatedAt: generatedAt,
    },
    sourceIndexSummary: {
      ...runtimeState.sourceIndexSummary,
      projectId,
      lockedReferenceCount: lockedReferenceIds.length,
      candidateReferenceCount: candidateReferenceIds.length,
      rejectedReferenceCount: rejectedReferenceIds.length,
      failedReferenceCount: 0,
      staleArtifactCount: 0,
      blockingReferenceCount: projection.assets.missingCount + projection.assets.candidateCount + projection.assets.needsReviewCount,
      isProductionReady: projection.assets.lockedCount > 0 && projection.assets.candidateCount === 0 && projection.assets.needsReviewCount === 0 && projection.assets.missingCount === 0,
      updatedAt: generatedAt,
    },
    storyFlow: {
      sections: projection.sections.map((section) => {
        const sectionShots = projection.shots.filter((shot) => section.shotIds.includes(shot.id));
        return {
          id: section.id,
          label: section.label,
          shotCount: sectionShots.length,
          blockedCount: sectionShots.filter((shot) => shot.status === "blocked" || shot.status === "video_missing").length,
          readyCount: sectionShots.filter((shot) => shot.status === "ready" || shot.status === "keyframe_pair_ready").length,
          shotIds: sectionShots.map((shot) => shot.id),
        };
      }),
      shots: projection.shots,
    },
    visualMemory: {
      summary: visualMemorySummary,
      assets: assetRecords,
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
