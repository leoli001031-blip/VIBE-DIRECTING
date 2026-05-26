import type { ProjectRuntimeState } from "../../core/projectState";
import type { PreviewQueueItem } from "../../core/previewPlayerQueue";
import type { ProjectImage2BatchUiState } from "../../core/projectImage2Client";
import type { AssetRecord } from "../../core/types";
import {
  JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES,
  buildJimengVideoStatusProjection,
  type JimengVideoStatusProjection,
  type JimengVideoUserStatus,
} from "../../core/jimengVideoCli";
import type {
  CreatorDeskProjection,
  CreatorFramePlanItem,
  CreatorFrameStatus,
  CreatorVideoGenerationProjection,
  CreatorVideoGenerationStatus,
  CreatorReviewStatus,
  CreatorReviewTrayItem,
} from "../director/creatorDeskTypes";
import type { ShotRecord } from "../../core/types";
import { usesEndpointEndFrame } from "../director/videoControlModeUi";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function statusTitle(value: CreatorReviewStatus) {
  if (value === "needs_review") return "待复核";
  if (value === "missing") return "待补齐";
  if (value === "approved") return "已通过";
  if (value === "retry") return "可重试";
  return "已锁定";
}

function shotDisplayId(value: string) {
  const match = value.trim().match(/^shot[_\s-]*0*(\d+)$/i);
  if (match) return `镜头 ${Number(match[1])}`;
  const actMatch = value.trim().match(/^A(\d+)_(\d+)$/i);
  if (actMatch) return `镜头 ${Number(actMatch[1])}-${Number(actMatch[2])}`;
  return value;
}

function previewReviewItem(item: PreviewQueueItem): CreatorReviewTrayItem {
  const evidence = item as PreviewQueueItem & {
    status?: string;
    reviewRequired?: boolean;
    sourceReceiptId?: string;
    receiptId?: string;
    providerReceiptId?: string;
    outputHash?: string;
    outputSha256?: string;
    sha256?: string;
    promptText?: string;
    promptPath?: string;
    promptHash?: string;
  };
  const missing = item.kind === "missing_placeholder" || !item.mediaPath;
  const status: CreatorReviewStatus = missing
    ? "missing"
    : clean(evidence.status).toLowerCase() === "approved"
      ? "approved"
      : "needs_review";
  return {
    id: item.id,
    shotId: item.shotId,
    label: item.shotId ? `${shotDisplayId(item.shotId)} · ${statusTitle(status)}` : statusTitle(status),
    detail: item.label || (item.shotId ? shotDisplayId(item.shotId) : "等待复核"),
    status,
    mediaPath: item.mediaPath,
    sourceReceiptId: clean(evidence.sourceReceiptId) || clean(evidence.receiptId) || clean(evidence.providerReceiptId),
    outputHash: clean(evidence.outputHash) || clean(evidence.outputSha256) || clean(evidence.sha256),
    promptText: clean(evidence.promptText),
    promptPath: clean(evidence.promptPath),
    promptHash: clean(evidence.promptHash),
  };
}

function reviewItemHasPromotionEvidence(item: CreatorReviewTrayItem) {
  return Boolean(item.mediaPath && item.sourceReceiptId && item.outputHash);
}

function assetReviewStatus(asset: AssetRecord): CreatorReviewStatus | undefined {
  if (asset.status === "missing" || asset.lockedStatus === "not_generated") return "missing";
  if (asset.lockedStatus === "locked") return "locked";
  if (asset.status === "rejected") return undefined;
  if (asset.lockedStatus === "candidate" || asset.lockedStatus === "needs_review") return "needs_review";
  return undefined;
}

function assetTypeTitle(type: AssetRecord["type"]) {
  if (type === "character") return "角色参考";
  if (type === "scene") return "场景参考";
  if (type === "prop") return "道具参考";
  if (type === "style") return "风格参考";
  return "参考图";
}

function assetReviewDetail(asset: AssetRecord, status: CreatorReviewStatus) {
  const firstConstraint = clean(asset.textConstraints?.[0]);
  const firstIssue = clean(asset.issues?.[0]);
  if (status === "locked") return `${assetTypeTitle(asset.type)}已锁定，可继续用于后续镜头。`;
  if (status === "missing") return `${assetTypeTitle(asset.type)}还没有可复核画面。`;
  return firstConstraint || firstIssue || `${assetTypeTitle(asset.type)}已生成，等待你确认是否可作为后续参考。`;
}

function assetReviewItem(asset: AssetRecord): CreatorReviewTrayItem | undefined {
  const status = assetReviewStatus(asset);
  if (!status) return undefined;
  const usedByShotIds = unique(asset.usedByShotIds || []);
  return {
    id: `asset_${asset.id}`,
    assetId: asset.id,
    assetType: asset.type,
    shotId: usedByShotIds[0],
    usedByShotIds,
    label: `${asset.name} · ${statusTitle(status)}`,
    detail: assetReviewDetail(asset, status),
    status,
    mediaPath: asset.status === "missing" ? undefined : asset.path,
    sourceReceiptId: clean(asset.sourceReceiptId),
    outputHash: clean(asset.outputHash),
    promptText: clean(asset.promptText),
    promptPath: clean(asset.promptPath),
    promptHash: clean(asset.promptHash),
  };
}

function frameStatusLabel(status: ShotRecord["status"], hasFrame: boolean, phase: "start" | "end"): CreatorFrameStatus {
  if (status === "blocked") return "missing";
  if (status === "queued" && !hasFrame) return "pending";
  if (status === "keyframe_pair_ready") return "approved";
  if (!hasFrame) return "missing";
  if (status === "assets_ready" || status === "ready") return phase === "start" ? "needs_review" : "pending";
  if (status === "video_missing") return phase === "start" ? "needs_review" : "missing";
  return "pending";
}

function frameNextAction(item: Pick<CreatorFramePlanItem, "startStatus" | "endStatus" | "requiresEndFrame">) {
  if (item.startStatus === "missing") return "补齐镜头参考";
  if (item.startStatus === "pending") return "先准备镜头参考";
  if (item.startStatus === "needs_review") return "复核镜头参考";
  if (!item.requiresEndFrame) return "准备视频";
  if (item.endStatus === "missing") return "补齐尾帧参考";
  if (item.endStatus === "pending") return "再准备尾帧参考";
  if (item.endStatus === "needs_review") return "复核尾帧参考";
  return "画面已通过";
}

function framePlanItem(shot: ShotRecord): CreatorFramePlanItem {
  const requiresEndFrame = usesEndpointEndFrame(shot);
  const startStatus = frameStatusLabel(shot.status, Boolean(shot.startFrame), "start");
  const endStatus = requiresEndFrame && startStatus === "approved"
    ? frameStatusLabel(shot.status, Boolean(shot.endFrame), "end")
    : "approved";
  const item = {
    shotId: shot.id,
    title: shot.title || shot.storyFunction || shot.id,
    startStatus,
    endStatus,
    requiresEndFrame,
    nextAction: "",
  };
  return {
    ...item,
    nextAction: frameNextAction(item),
  };
}

function framePlanStatuses(item: CreatorFramePlanItem): CreatorFrameStatus[] {
  return item.requiresEndFrame ? [item.startStatus, item.endStatus] : [item.startStatus];
}

type PreviewItemWithVideoGeneration = PreviewQueueItem & {
  status?: string;
  videoGeneration?: JimengVideoStatusProjection;
  submitId?: string;
  submit_id?: string;
  queuePosition?: number;
  queueIndex?: number;
  queue_idx?: number;
  queueInfo?: Record<string, unknown>;
  queue_info?: Record<string, unknown>;
  queueStatus?: string;
  queue_status?: string;
};

const videoStatusPriority: Record<JimengVideoUserStatus, number> = {
  recoverable: 0,
  queued: 1,
  generating: 2,
  submitted: 3,
  completed: 4,
  not_generated: 5,
};

function videoGenerationForItem(item: PreviewQueueItem): JimengVideoStatusProjection {
  const candidate = item as PreviewItemWithVideoGeneration;
  if (candidate.videoGeneration) return candidate.videoGeneration;
  return buildJimengVideoStatusProjection({
    status: candidate.status,
    submitId: candidate.submitId || candidate.submit_id,
    queueInfo: candidate.queueInfo || candidate.queue_info,
    queuePosition: candidate.queuePosition ?? candidate.queueIndex ?? candidate.queue_idx,
    queueStatus: candidate.queueStatus || candidate.queue_status,
    mediaPath: candidate.mediaPath,
  });
}

function previewItemIsVideoInProgress(item: PreviewQueueItem) {
  const status = videoGenerationForItem(item).status;
  return status === "submitted" || status === "queued" || status === "generating" || status === "recoverable";
}

function buildCreatorVideoGenerationProjection(
  previewItems: PreviewQueueItem[],
  storyReadyCount: number,
): CreatorVideoGenerationProjection {
  const statuses = previewItems.map(videoGenerationForItem);
  const visibleStatuses = statuses.filter((status) =>
    status.status !== "not_generated" || status.hasSubmitId || status.hasVideo || status.hasQueueInfo,
  );
  const primary = [...visibleStatuses].sort((left, right) => videoStatusPriority[left.status] - videoStatusPriority[right.status])[0];
  const fallback = buildJimengVideoStatusProjection({ status: "not_submitted" });
  const selected = primary || fallback;
  const submittedCount = statuses.filter((status) => status.status === "submitted").length;
  const queuedCount = statuses.filter((status) => status.status === "queued").length;
  const generatingCount = statuses.filter((status) => status.status === "generating").length;
  const completedCount = statuses.filter((status) => status.status === "completed").length;
  const recoverableCount = statuses.filter((status) => status.status === "recoverable").length;
  const detail = selected.status === "not_generated"
    ? storyReadyCount > 0
      ? `会先生成故事板参考，再一次提交一个视频任务；即梦排队常见约 ${JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES} 分钟，可以离开后恢复查询。`
      : "先确认故事流，再提交视频。"
    : selected.detail;
  return {
    status: selected.status as CreatorVideoGenerationStatus,
    statusLabel: selected.label,
    detail,
    submittedCount,
    queuedCount,
    generatingCount,
    completedCount,
    recoverableCount,
    shortSubmitId: selected.shortSubmitId,
    queuePosition: selected.queuePosition,
    canResume: selected.canResume || selected.status === "recoverable",
  };
}

export function buildCreatorDeskProjection({
  runtimeState,
  previewItems,
  image2BatchState,
  selectedShotIds,
}: {
  runtimeState: ProjectRuntimeState;
  previewItems: PreviewQueueItem[];
  image2BatchState: ProjectImage2BatchUiState;
  selectedShotIds: string[];
}): CreatorDeskProjection {
  const sections = runtimeState.storyFlow.sections.map((section) => ({
    id: section.id,
    label: section.label || section.id,
    shotCount: section.shotIds.length,
  }));
  const shotCount = runtimeState.storyFlow.shots.length;
  const selected = unique(selectedShotIds);
  const missingQuestions = unique([
    shotCount ? undefined : "Add a first shot",
    runtimeState.visualMemory.summary.locked ? undefined : "Lock one visual reference",
    image2BatchState.summary?.readyCount ? undefined : "Prepare frames for review",
  ]);

  const batch = image2BatchState.summary;
  const assetReviewItems = runtimeState.visualMemory.assets
    .map(assetReviewItem)
    .filter((item): item is CreatorReviewTrayItem => Boolean(item));
  const generatedReferenceAssetCount = runtimeState.visualMemory.assets.filter((asset) =>
    asset.status !== "missing" && asset.lockedStatus !== "not_generated",
  ).length;
  const missingReferenceAssetCount = runtimeState.visualMemory.assets.filter((asset) =>
    asset.status === "missing" || asset.lockedStatus === "not_generated",
  ).length;
  const legacyFrameBatchIsStale = generatedReferenceAssetCount > 0 && missingReferenceAssetCount === 0;
  const effectiveBlockedCount = legacyFrameBatchIsStale ? 0 : batch?.blockedCount || 0;
  const effectivePlannedCount = legacyFrameBatchIsStale ? runtimeState.visualMemory.assets.length : batch?.plannedCount || selected.length || shotCount;
  const effectiveReadyCount = legacyFrameBatchIsStale ? assetReviewItems.filter((item) => item.status !== "missing").length : batch?.readyCount || 0;
  const retryCount = legacyFrameBatchIsStale ? 0 : batch?.retrySummary?.nextRunnableCount || batch?.retrySummary?.retryScheduled || 0;
  const missingBatchItems = !effectiveBlockedCount ? [] : batch?.items.filter((item) => item.blocked).map((item) => ({
    id: `missing_${item.shotId}`,
    shotId: item.shotId,
    label: `${shotDisplayId(item.shotId)} · Missing`,
    detail: item.blockers[0] || "Waiting for a usable frame",
    status: "missing" as const,
  })) || [];
  const retryItems = retryCount
    ? [{
        id: "retry_missing",
        label: "Retry Missing",
        detail: `${retryCount} item${retryCount === 1 ? "" : "s"} ready to retry`,
        status: "retry" as const,
      }]
    : [];
  const pendingAssetItems = assetReviewItems
    .filter((item) => item.status !== "locked")
    .slice(0, 6);
  const lockedItems = assetReviewItems
    .filter((item) => item.status === "locked")
    .slice(0, 3)
    .map((item) => ({ ...item, id: `locked_${item.assetId || item.id}` }));
  const previewItemsForReview = legacyFrameBatchIsStale
    ? previewItems.filter((item) => item.kind !== "missing_placeholder" && Boolean(item.mediaPath))
    : previewItems;
  const previewReviewItems = previewItemsForReview
    .filter((item) => !previewItemIsVideoInProgress(item))
    .slice(0, 6)
    .map(previewReviewItem)
    .filter((item) => item.status === "missing" || reviewItemHasPromotionEvidence(item));
  const allItemsForCounts = [...assetReviewItems, ...previewReviewItems, ...missingBatchItems, ...retryItems, ...lockedItems];
  const allItems = [...pendingAssetItems, ...previewReviewItems, ...missingBatchItems, ...retryItems, ...lockedItems];
  const items = allItems.slice(0, 8);
  const counts = {
    needs_review: allItemsForCounts.filter((item) => item.status === "needs_review").length,
    missing: Math.max(effectiveBlockedCount, allItemsForCounts.filter((item) => item.status === "missing").length),
    approved: allItemsForCounts.filter((item) => item.status === "approved").length,
    retry: retryCount || allItems.filter((item) => item.status === "retry").length,
    locked: runtimeState.visualMemory.summary.locked || allItems.filter((item) => item.status === "locked").length,
  };
  const retryConcurrency = batch?.retrySummary?.retryConcurrency || 2;
  const activeConcurrency = batch?.retrySummary?.activeConcurrency || batch?.retrySummary?.maxConcurrency || 10;
  const safetyLabel =
    batch?.retrySummary?.circuitBreakerStatus === "open"
      ? "Review before retry"
      : batch?.retrySummary?.circuitBreakerStatus === "retry_downshift"
        ? `Retry now ${activeConcurrency}`
        : `Retry downshifts to ${retryConcurrency}`;
  const frameItems = (selected.length
    ? runtimeState.storyFlow.shots.filter((shot) => selected.includes(shot.id))
    : runtimeState.storyFlow.shots
  ).slice(0, 6).map(framePlanItem);
  const frameReviewCount = frameItems.filter((item) => framePlanStatuses(item).includes("needs_review")).length;
  const frameMissingCount = frameItems.filter((item) => framePlanStatuses(item).includes("missing")).length;
  const frameReadyCount = frameItems.filter((item) => framePlanStatuses(item).every((status) => status === "approved")).length;
  const endpointCount = frameItems.filter((item) => item.requiresEndFrame).length;
  const videoGeneration = buildCreatorVideoGenerationProjection(previewItems, shotCount);

  return {
    scriptPlanner: {
      title: runtimeState.project.title || "Untitled project",
      brief: sections.length
        ? `${sections.length} section${sections.length === 1 ? "" : "s"} drafted from the current story flow.`
        : "Start with a short story idea, then review the draft before applying it.",
      sectionCount: sections.length,
      shotCount,
      selectedShotCount: selected.length,
      draftStatus: shotCount ? "Ready" : "Missing",
      sections: sections.slice(0, 4),
      missingQuestions,
    },
    batchGeneration: {
      statusLabel: batch
        ? effectiveReadyCount > 0
          ? "Needs review"
          : effectiveBlockedCount > 0
            ? "Missing"
            : "Approved"
        : image2BatchState.status === "running"
          ? "Needs review"
          : "Missing",
      detail: batch
        ? `${effectiveReadyCount}/${effectivePlannedCount} ready · ${effectiveBlockedCount} missing`
        : image2BatchState.message || "Connect a project to prepare the next batch.",
      selectedShotCount: selected.length,
      plannedCount: effectivePlannedCount,
      readyCount: effectiveReadyCount,
      missingCount: effectiveBlockedCount,
      retryCount,
      concurrencyLabel: "Concurrency 10",
      safetyLabel,
      retryLabel: "Retry Missing",
      canRetryMissing: image2BatchState.status !== "running" && Boolean(batch && (effectiveBlockedCount > 0 || retryCount > 0)),
    },
    framePlan: {
      items: frameItems,
      readyCount: frameReadyCount,
      reviewCount: frameReviewCount,
      missingCount: frameMissingCount,
      endpointCount,
    },
    videoGeneration,
    reviewTray: {
      counts,
      items,
    },
  };
}
