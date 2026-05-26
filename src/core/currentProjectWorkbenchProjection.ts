import type { ProjectRuntimeState } from "./projectState";
import type {
  ProjectCurrentBindingStatus,
  ProjectRealChainPreviewItem,
  ProjectRealChainUiState,
} from "./projectCurrentRuntimeClient";
import type {
  ProjectImage2BatchUiState,
} from "./projectImage2Client";
import type {
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

function isUrlOrAbsolute(value: string) {
  return /^(?:https?:|data:|blob:|file:)/i.test(value) || value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}

function resolveProjectMediaPath(value?: string, projectRoot?: string) {
  const cleaned = cleanString(value);
  if (!cleaned || isUrlOrAbsolute(cleaned)) return cleaned;
  if (!projectRoot || cleaned.includes("..")) return cleaned;
  const normalizedRoot = projectRoot.replace(/\\/g, "/").replace(/\/+$/g, "");
  const normalizedPath = cleaned.replace(/\\/g, "/").replace(/^\/+/g, "");
  if (normalizedRoot && (normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`))) {
    return normalizedPath;
  }
  return `${normalizedRoot}/${normalizedPath}`;
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
  const isVideoTask = previewItemLooksLikeVideo(item);
  const rawStatus = `${item.previewQaStatus || ""} ${item.productionQaStatus || ""}`.toLowerCase();
  const taskStatus = `${item.status || ""} ${item.previewStatus || ""} ${item.videoStatus || ""}`.toLowerCase();
  if (isVideoTask && /queued|queueing|submitted|generating|running/.test(taskStatus)) return "queued";
  if (isVideoTask && /success|complete|completed|done|finished/.test(taskStatus)) return "ready";
  if (item.outputExists === false) return "blocked";
  if (item.reviewRequired || rawStatus.includes("review")) return "assets_ready";
  if (item.imageUrl || item.thumbnailUrl || item.expectedOutputPath) return "ready";
  return "blocked";
}

function previewItemLooksLikeVideo(item?: ProjectRealChainPreviewItem) {
  if (!item) return false;
  return Boolean(
    item.videoStatus
    || item.submitId
    || item.submit_id
    || item.queueInfo
    || item.queue_info
    || item.localMediaPaths?.length
    || item.outputVideoPath
    || String(item.mediaType || "").toLowerCase().includes("video")
    || /\.(?:mp4|mov|m4v|webm)(?:$|\?)/i.test(String(item.mediaPath || item.imageUrl || item.fileUrl || ""))
  );
}

function previewItemImageFrame(item: ProjectRealChainPreviewItem | undefined, projectRoot?: string) {
  if (!item || previewItemLooksLikeVideo(item)) return undefined;
  return resolveProjectMediaPath(item.imageUrl, projectRoot)
    || resolveProjectMediaPath(item.thumbnailUrl, projectRoot)
    || resolveProjectMediaPath(item.expectedOutputPath, projectRoot);
}

function shotStoryFunction(item: ProjectRealChainPreviewItem) {
  if (item.outputExists === false) return "当前项目投影 / 等待画面回流";
  if (item.reviewRequired) return "当前项目画面需复核";
  return "当前项目画面已回流";
}

function shotFromPreviewItem(item: ProjectRealChainPreviewItem, index: number, projectRoot?: string): ShotRecord {
  const shotId = cleanString(item.shotId) || cleanString(item.id) || `S${String(index + 1).padStart(2, "0")}`;
  return {
    id: shotId,
    actId: "current",
    sectionId: "current_project",
    title: `当前项目 ${shotId}`,
    storyFunction: shotStoryFunction(item),
    startFrame: previewItemImageFrame(item, projectRoot),
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
  projectRoot?: string,
): ShotRecord {
  const shotId = cleanString(fact.id) || `S${String(index + 1).padStart(2, "0")}`;
  const previewIsQueuedVideo = Boolean(previewItem && previewItemStatus(previewItem) === "queued");
  const hasCharacter = Boolean(fact.characterAssetIds?.length || fact.roleIds?.length || fact.characterGuidance?.length);
  const hasScene = Boolean(fact.sceneAssetIds?.length || fact.sceneId || fact.sceneGuidance?.length);
  const hasProp = Boolean(fact.propAssetIds?.length || fact.propIds?.length || fact.propGuidance?.length);
  const issues = uniqueStrings([
    ...(Array.isArray(fact.issues) ? fact.issues : []),
    ...(previewItem?.reviewRequired ? ["needs_review"] : []),
    ...(previewItem?.outputExists === false && !previewIsQueuedVideo ? ["missing_start_frame"] : []),
  ]);
  return {
    id: shotId,
    actId: cleanString(fact.actId) || "current",
    sectionId: cleanString(fact.sectionId) || cleanString(fact.sceneId) || "current_project",
    title: cleanString(fact.title) || `当前项目 ${shotId}`,
    storyFunction: cleanString(fact.storyFunction) || "当前项目故事流",
    startFrame: resolveProjectMediaPath(fact.startFrame, projectRoot)
      || previewItemImageFrame(previewItem, projectRoot),
    endFrame: resolveProjectMediaPath(fact.endFrame, projectRoot),
    status: shotStatusFromFact(fact, previewItem),
    gates: {
      identity: hasCharacter ? "PASS" : previewItem?.reviewRequired ? "PARTIAL" : "UNKNOWN",
      scene: hasScene ? "PASS" : "UNKNOWN",
      pair: "UNKNOWN",
      story: "PASS",
      prop: hasProp ? "PASS" : "N/A",
      style: "UNKNOWN",
    },
    issues,
    camera: cleanString(fact.camera),
    executionMode: cleanString(fact.executionMode),
    rhythmProfile: cleanString(fact.rhythmProfile),
    splitPolicy: cleanString(fact.splitPolicy),
    actionBeats: fact.actionBeats,
    primaryAction: cleanString(fact.primaryAction),
    actionTrigger: cleanString(fact.actionTrigger),
    microReaction: cleanString(fact.microReaction),
    seedanceDirection: cleanString(fact.seedanceDirection),
    directorFeedbackDirectives: fact.directorFeedbackDirectives,
    characterGuidance: fact.characterGuidance,
    sceneGuidance: fact.sceneGuidance,
    propGuidance: fact.propGuidance,
    durationSeconds: fact.durationSeconds,
    sourceRefs: fact.sourceRefs,
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
  return facts?.storyFlow?.readable === true && facts.storyFlow.shots.length > 0;
}

function storyFlowReadable(facts?: ProjectWorkbenchFacts) {
  return facts?.storyFlow?.readable === true;
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

function assetFactToRecord(asset: ProjectWorkbenchAssetFact, projectRoot?: string): AssetRecord {
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
    path: resolveProjectMediaPath(asset.path, projectRoot) || `visual_memory/${asset.id}.json`,
    status: asset.status === "missing" ? "missing" : asset.status === "rejected" ? "rejected" : "exists",
    lockedStatus,
    providerId: "current-project-visual-memory",
    sourceReceiptId: asset.sourceReceiptId,
    outputHash: asset.outputHash,
    promptText: asset.promptText,
    promptPath: asset.promptPath,
    promptHash: asset.promptHash,
    usedByShotIds: asset.usedByShotIds,
    safeForFutureReference: asset.status === "locked",
    textConstraints: asset.textConstraints,
    sourceRefs: asset.sourceRefs,
    issues: uniqueStrings([
      ...(asset.status === "candidate" ? ["candidate_draft_only"] : []),
      ...(asset.status === "needs_review" ? ["needs_review"] : []),
      ...(asset.status === "rejected" ? [asset.rejectedReason || "rejected_reference"] : []),
      ...(asset.status === "missing" ? ["missing_reference"] : []),
    ]),
  };
}

function normalizedAssetMatchText(value?: string) {
  return (value || "").toLowerCase().replace(/\s+/g, "");
}

function assetMatchesGuidance(asset: AssetRecord, guidance: string[] | undefined) {
  const needles = [asset.id, asset.name]
    .map(normalizedAssetMatchText)
    .filter((value) => value.length >= 2);
  const haystack = (guidance || [])
    .map(normalizedAssetMatchText)
    .filter((value) => value.length >= 2);
  return needles.some((needle) => haystack.some((value) => value.includes(needle) || needle.includes(value)));
}

function assetMatchesShotText(asset: AssetRecord, shot: ShotRecord) {
  const shotText = normalizedAssetMatchText([
    shot.id,
    shot.title,
    shot.storyFunction,
    shot.camera,
    shot.primaryAction,
    shot.actionTrigger,
    shot.microReaction,
    shot.seedanceDirection,
    ...(shot.characterGuidance || []),
    ...(shot.sceneGuidance || []),
    ...(shot.propGuidance || []),
  ].filter(Boolean).join(" "));
  return [asset.id, asset.name, ...(asset.textConstraints || [])]
    .map(normalizedAssetMatchText)
    .filter((value) => value.length >= 2)
    .some((value) => shotText.includes(value) || value.includes(shotText));
}

function sceneClusterForText(value?: string) {
  const text = String(value || "").toLowerCase();
  const clusters = [
    { key: "old_bookstore", pattern: /旧书店|书店|书架|bookstore|bookshop|bookshelf/i },
    { key: "train_station", pattern: /车站|站台|电车站|火车站|地铁站|train\s*station|railway\s*platform|subway\s*platform/i },
    { key: "convenience_store", pattern: /便利店(?:门口|入口|雨棚|店内|外)?|自动门|convenience\s*store/i },
    { key: "mountain_road", pattern: /山路|便利店外山路|山脊|跑山|发卡弯|雨夜山路|mountain\s*road|touge|hairpin|convenience\s*store\s*road/i },
    { key: "street", pattern: /街道|街边|路口|巷|雾中街道|湿漉漉的街|湿街|城市湿路|城市道路|城市路面|neon\s*street|city\s*street|street|alley/i },
    { key: "cafe", pattern: /咖啡馆|咖啡店|cafe|coffee\s*shop/i },
    { key: "rooftop", pattern: /屋顶|天台|rooftop/i },
  ];
  return clusters.find((item) => item.pattern.test(text))?.key;
}

function shotSceneCluster(shot: ShotRecord) {
  return sceneClusterForText([
    ...(shot.sceneGuidance || []),
    shot.sectionId,
    shot.title,
    shot.storyFunction,
  ].filter(Boolean).join(" "));
}

function assetSceneCluster(asset: AssetRecord) {
  return sceneClusterForText([
    asset.id,
    asset.name,
    ...(asset.textConstraints || []),
  ].filter(Boolean).join(" "));
}

function assetFocusScore(asset: AssetRecord, shot: ShotRecord) {
  const needles = [asset.id, asset.name]
    .map(normalizedAssetMatchText)
    .filter((value) => value.length >= 2);
  const focusFields = [
    shot.title,
    shot.primaryAction,
    shot.actionTrigger,
    shot.microReaction,
  ].map(normalizedAssetMatchText).filter((value) => value.length >= 2);
  return needles.reduce((score, needle) => (
    score + focusFields.reduce((fieldScore, field, index) => {
      if (!field.includes(needle) && !needle.includes(field)) return fieldScore;
      return fieldScore + (index === 0 ? 4 : 2);
    }, 0)
  ), 0);
}

function bestFocusedAsset(assets: AssetRecord[], shot: ShotRecord, type: AssetRecord["type"]) {
  return assets
    .filter((asset) => asset.type === type && asset.path && assetFocusScore(asset, shot) > 0)
    .sort((a, b) => assetFocusScore(b, shot) - assetFocusScore(a, shot))[0];
}

function referenceFrameForShot(shot: ShotRecord, assets: AssetRecord[]) {
  const focusedProp = bestFocusedAsset(assets, shot, "prop");
  if (focusedProp?.path && shot.executionMode === "action_insert") return focusedProp.path;
  const exactScene = assets.find((asset) => asset.type === "scene" && asset.path && assetMatchesGuidance(asset, shot.sceneGuidance));
  if (exactScene?.path) return exactScene.path;
  const exactProp = assets.find((asset) => asset.type === "prop" && asset.path && assetMatchesGuidance(asset, shot.propGuidance));
  if (exactProp?.path && shot.executionMode === "action_insert") return exactProp.path;
  const sceneCluster = shotSceneCluster(shot);
  const clusterScene = sceneCluster
    ? assets.find((asset) => asset.type === "scene" && asset.path && assetSceneCluster(asset) === sceneCluster)
    : undefined;
  if (clusterScene?.path) return clusterScene.path;
  const exactCharacter = assets.find((asset) => asset.type === "character" && asset.path && assetMatchesGuidance(asset, shot.characterGuidance));
  if (exactCharacter?.path) return exactCharacter.path;
  if (exactProp?.path) return exactProp.path;
  return assets.find((asset) => asset.type === "scene" && asset.path && assetMatchesShotText(asset, shot))?.path
    || assets.find((asset) => asset.type === "character" && asset.path && assetMatchesShotText(asset, shot))?.path
    || assets.find((asset) => asset.type === "prop" && asset.path && assetMatchesShotText(asset, shot))?.path;
}

function isPlannedOrVideoFramePath(path?: string) {
  const normalized = (path || "").replace(/\\/g, "/");
  return Boolean(
    !normalized
    || /(?:^|\/)planned\/keyframes\//.test(normalized)
    || /\.(?:mp4|mov|m4v|webm)(?:$|\?)/i.test(normalized)
  );
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
  const useEmptyStoryFacts = bound && storyFlowReadable(facts) && !useStoryFacts;
  const allowPreviewStoryFallback = bound && !useStoryFacts && (storyFlowMissing(facts) || !facts?.storyFlow);
  const factStoryFlow = useStoryFacts ? facts?.storyFlow : undefined;
  const shots = factStoryFlow
    ? factStoryFlow.shots.map((shot, index) => shotFromStoryFact(shot, index, itemByShotId.get(shot.id), identity.projectRoot))
    : allowPreviewStoryFallback && items.length
      ? items.map((item, index) => shotFromPreviewItem(item, index, identity.projectRoot))
      : useEmptyStoryFacts
        ? []
        : [fallbackShot(identity)];
  const sections = factStoryFlow
    ? storySectionsFromFacts(factStoryFlow.sections, shots)
    : shots.length
      ? fallbackSection(shots, bound && !items.length ? "当前项目投影" : "当前项目故事流")
      : [];
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
          ? `${readinessCount} 个复核参考来自当前项目，等待生成或锁定`
          : "当前项目资产待补齐，等待生成或复核",
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
  const assetRecords = projection.assetFacts.map((asset) => assetFactToRecord(asset, projectRoot));
  const shotsWithDisplayReferences = projection.shots.map((shot) => {
    const referenceFrame = isPlannedOrVideoFramePath(shot.startFrame)
      ? referenceFrameForShot(shot, assetRecords)
      : undefined;
    if (!referenceFrame) return shot;
    return {
      ...shot,
      startFrame: referenceFrame,
      issues: shot.issues.filter((issue) => issue !== "missing_start_frame"),
    };
  });
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
  const lockedReferenceIds = projection.assetFacts.reduce((acc, asset) => { if (asset.status === "locked") acc.push(asset.id); return acc; }, [] as string[]);
  const candidateReferenceIds = projection.assetFacts.reduce((acc, asset) => { if (asset.status === "candidate" || asset.status === "needs_review") acc.push(asset.id); return acc; }, [] as string[]);
  const rejectedReferenceIds = projection.assetFacts.reduce((acc, asset) => { if (asset.status === "rejected") acc.push(asset.id); return acc; }, [] as string[]);

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
      shots: shotsWithDisplayReferences,
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
