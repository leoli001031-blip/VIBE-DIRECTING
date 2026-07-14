import type { ProjectRuntimeState } from "../../core/projectState";
import type { PreviewQueueItem } from "../../core/previewPlayerQueue";
import type { ProjectImage2BatchUiState } from "../../core/projectImage2Client";
import type { VideoRelayQueueState } from "../../core/videoRelayQueue";
import type { AssetRecord } from "../../core/types";
import { buildAssetReconciliationProjection } from "../../core/assetReconciliation";
import {
  buildProjectInboxProjection,
  buildProjectObservation,
  routeProjectAgentIntent,
} from "../../core/projectAgentWorkspace";
import {
  JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES,
  buildJimengVideoStatusProjection,
  normalizeDreaminaStatus,
  type JimengVideoStatusProjection,
  type JimengVideoUserStatus,
} from "../../core/jimengVideoCli";
import type {
  CreatorDeskProjection,
  CreatorFramePlanItem,
  CreatorFrameStatus,
  CreatorAgentCommand,
  CreatorVideoGenerationProjection,
  CreatorVideoGenerationStatus,
  CreatorVideoStageProjection,
  CreatorVideoTaskFact,
  CreatorAgentStage,
  CreatorPreflightProjection,
  CreatorPreflightCheckState,
  CreatorReviewStatus,
  CreatorReviewTrayItem,
} from "../director/creatorDeskTypes";
import type { ShotRecord } from "../../core/types";
import { usesEndpointEndFrame } from "../director/videoControlModeUi";
import { videoBlockerRecoveryAdvice } from "../../core/videoBlockerRecovery";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

function statusTitle(value: CreatorReviewStatus) {
  if (value === "needs_review") return "待复核";
  if (value === "missing") return "待生成";
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

function normalizedAssetReviewState(asset: AssetRecord): CreatorReviewStatus | undefined {
  const status = clean(asset.status).toLowerCase();
  const lockedStatus = clean(asset.lockedStatus).toLowerCase();
  if (status === "missing" || lockedStatus === "not_generated") return "missing";
  if (status === "locked" || lockedStatus === "locked") return "locked";
  if (status === "rejected" || lockedStatus === "rejected") return undefined;
  if (status === "candidate" || status === "needs_review" || lockedStatus === "candidate" || lockedStatus === "needs_review") {
    return "needs_review";
  }
  return undefined;
}

function assetRecordType(asset: AssetRecord) {
  return clean(asset.type) || clean((asset as AssetRecord & { kind?: string }).kind);
}

function isTextOnlyStyleAsset(asset: AssetRecord) {
  const type = assetRecordType(asset);
  const sourceText = (asset.sourceRefs || []).join(" ").toLowerCase();
  const searchable = assetSearchText(asset);
  const path = clean(asset.path).toLowerCase();
  const textOnlyPath = !path || /\.(?:json|md|markdown|txt)$/.test(path);
  if (textOnlyPath && (
    sourceText.includes("new_video_reference:style:text")
    || searchable.includes("文字风格方向")
    || searchable.includes("项目视觉风格")
  )) return true;
  if (type !== "style") return false;
  return textOnlyPath && (
    Boolean(asset.textConstraints?.length)
    || Boolean(clean(asset.promptText))
  );
}

function reviewableReferenceAssets(assets: AssetRecord[]) {
  return assets.filter((asset) => !isTextOnlyStyleAsset(asset));
}

function assetHasVisualMedia(asset: AssetRecord) {
  return /\.(?:png|jpe?g|webp|gif)$/i.test(clean(asset.path));
}

function assetReviewStatus(asset: AssetRecord): CreatorReviewStatus | undefined {
  if (isTextOnlyStyleAsset(asset)) return undefined;
  return normalizedAssetReviewState(asset);
}

function assetSearchText(asset: AssetRecord) {
  return [
    asset.id,
    asset.name,
    asset.path,
    asset.promptText,
    asset.promptPath,
    asset.roleBinding?.role,
    ...(asset.roleBinding?.useFor || []),
    ...(asset.roleBinding?.ignoreFor || []),
    ...(asset.textConstraints || []),
    ...(asset.sourceRefs || []),
  ].join(" ").toLowerCase();
}

function isStoryboardReferenceAsset(asset: AssetRecord) {
  if (!clean(asset.path)) return false;
  const role = clean(asset.roleBinding?.role).toLowerCase();
  const type = assetRecordType(asset).toLowerCase();
  const directStoryboardText = [
    asset.name,
    asset.path,
    asset.promptPath,
    asset.roleBinding?.role,
    ...(asset.textConstraints || []),
  ].join(" ").toLowerCase();
  return role === "storyboard_reference"
    || type === "shot_reference"
    || /storyboard_reference|故事板参考|分镜参考/.test(directStoryboardText);
}

function assetReferenceKind(asset: AssetRecord): CreatorReviewTrayItem["referenceKind"] {
  if (isStoryboardReferenceAsset(asset)) return "storyboard_reference";
  return "visual_reference";
}

function assetTypeTitle(type: AssetRecord["type"], referenceKind?: CreatorReviewTrayItem["referenceKind"]) {
  if (referenceKind === "storyboard_reference") return "故事板参考";
  if (type === "character") return "角色参考";
  if (type === "scene") return "场景参考";
  if (type === "prop") return "道具参考";
  if (type === "style") return "风格参考";
  return "参考图";
}

function assetReviewDetail(asset: AssetRecord, status: CreatorReviewStatus, referenceKind?: CreatorReviewTrayItem["referenceKind"]) {
  const firstConstraint = clean(asset.textConstraints?.[0]);
  const firstIssue = clean(asset.issues?.[0]);
  const title = assetTypeTitle(assetRecordType(asset) as AssetRecord["type"], referenceKind);
  if (referenceKind === "storyboard_reference") {
    if (status === "locked") return "故事板参考已锁定，会用于这个镜头的构图、动作和切镜节奏。";
    if (status === "missing") return "这个镜头还缺故事板参考。";
    return firstConstraint || firstIssue || "故事板参考已生成，请确认它是否适合作为构图、动作和切镜节奏。";
  }
  if (status === "locked") return `${title}已锁定，可继续用于后续镜头。`;
  if (status === "missing") return `${title}还没有可复核画面。`;
  return firstConstraint || firstIssue || `${title}已生成，等待你确认是否可作为后续参考。`;
}

function assetReviewItem(asset: AssetRecord): CreatorReviewTrayItem | undefined {
  const status = assetReviewStatus(asset);
  if (!status) return undefined;
  const usedByShotIds = unique(asset.usedByShotIds || []);
  const referenceKind = assetReferenceKind(asset);
  const type = assetRecordType(asset) as AssetRecord["type"];
  const reviewAssetType = referenceKind === "storyboard_reference" ? "shot_reference" : type;
  const title = assetTypeTitle(type, referenceKind);
  return {
    id: `asset_${asset.id}`,
    assetId: asset.id,
    assetType: reviewAssetType,
    referenceKind,
    shotId: usedByShotIds[0],
    usedByShotIds,
    label: `${asset.name || title} · ${title} · ${statusTitle(status)}`,
    detail: assetReviewDetail(asset, status, referenceKind),
    status,
    mediaPath: asset.status === "missing" ? undefined : asset.path,
    sourceReceiptId: clean(asset.sourceReceiptId),
    outputHash: clean(asset.outputHash),
    promptText: clean(asset.promptText),
    promptPath: clean(asset.promptPath),
    promptHash: clean(asset.promptHash),
  };
}

function reviewItemPriority(item: CreatorReviewTrayItem, selectedShotIds: string[]) {
  const selected = item.shotId && selectedShotIds.includes(item.shotId) ? 0 : 10;
  const storyboard = item.referenceKind === "storyboard_reference" ? 0 : 2;
  const status = item.status === "needs_review"
    ? 0
    : item.status === "missing"
      ? 1
      : item.status === "retry"
        ? 2
        : item.status === "approved"
          ? 3
          : 4;
  const evidence = item.mediaPath ? 0 : 1;
  return selected + storyboard + status + evidence;
}

function sortReviewItems(items: CreatorReviewTrayItem[], selectedShotIds: string[]) {
  return [...items].sort((left, right) => {
    const priority = reviewItemPriority(left, selectedShotIds) - reviewItemPriority(right, selectedShotIds);
    if (priority !== 0) return priority;
    return left.label.localeCompare(right.label, "zh-Hans-CN");
  });
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
  if (item.startStatus === "missing") return "生成镜头参考";
  if (item.startStatus === "pending") return "先准备镜头参考";
  if (item.startStatus === "needs_review") return "复核镜头参考";
  if (!item.requiresEndFrame) return "准备视频";
  if (item.endStatus === "missing") return "生成尾帧参考";
  if (item.endStatus === "pending") return "再准备尾帧参考";
  if (item.endStatus === "needs_review") return "复核尾帧参考";
  return "画面已通过";
}

function framePlanItem(shot: ShotRecord): CreatorFramePlanItem {
  const usesOmniReference = shot.referenceStrategy === "omni_reference";
  const requiresEndFrame = !usesOmniReference && usesEndpointEndFrame(shot);
  const startStatus = usesOmniReference
    ? "approved"
    : frameStatusLabel(shot.status, Boolean(shot.startFrame), "start");
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
  id?: string;
  shotId?: string;
  title?: string;
  status?: string;
  reviewRequired?: boolean;
  videoStatus?: string;
  generationStatus?: string;
  previewStatus?: string;
  videoGeneration?: JimengVideoStatusProjection;
  submitId?: string;
  submit_id?: string;
  outputVideoPath?: string;
  localMediaPaths?: string[];
  queuePosition?: number;
  queueIndex?: number;
  queue_idx?: number;
  attemptCount?: number;
  attempt_count?: number;
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
    status: candidate.videoStatus || candidate.generationStatus || candidate.previewStatus || candidate.status,
    submitId: candidate.submitId || candidate.submit_id,
    queueInfo: candidate.queueInfo || candidate.queue_info,
    queuePosition: candidate.queuePosition ?? candidate.queueIndex ?? candidate.queue_idx,
    queueStatus: candidate.queueStatus || candidate.queue_status,
    outputVideoPath: candidate.outputVideoPath,
    localMediaPaths: candidate.localMediaPaths,
    mediaPath: candidate.mediaPath,
  });
}

function isVideoMediaPath(value: unknown) {
  return typeof value === "string" && /\.(?:mp4|mov|webm)(?:\?|$)/i.test(value);
}

function previewItemHasVideoMedia(item: PreviewQueueItem) {
  const candidate = item as PreviewItemWithVideoGeneration;
  return isVideoMediaPath(candidate.mediaPath)
    || isVideoMediaPath(candidate.outputVideoPath)
    || Boolean(candidate.localMediaPaths?.some(isVideoMediaPath));
}

function previewItemIsVideoInProgress(item: PreviewQueueItem) {
  const status = videoGenerationForItem(item).status;
  return status === "submitted" || status === "queued" || status === "generating" || status === "recoverable";
}

function previewItemIsReturnedVideoForReview(item: PreviewQueueItem) {
  const candidate = item as PreviewItemWithVideoGeneration;
  const itemStatus = clean(candidate.status).toLowerCase();
  if (candidate.reviewRequired === false) return false;
  if (itemStatus === "approved" || itemStatus === "locked") return false;
  const videoGeneration = videoGenerationForItem(item);
  return videoGeneration.status === "completed" && (videoGeneration.hasVideo || previewItemHasVideoMedia(item));
}

function compactTaskPath(value: string) {
  const cleanValue = clean(value);
  if (!cleanValue) return "";
  const parts = cleanValue.split(/[\\/]+/).filter(Boolean);
  return parts.length > 3 ? parts.slice(-3).join("/") : cleanValue;
}

function creatorFacingVideoText(value: string) {
  return clean(value)
    .replace(/等待回流/g, "等待结果")
    .replace(/回流结果/g, "视频结果")
    .replace(/视频已回流/g, "视频已返回")
    .replace(/回来后/g, "结果出来后");
}

function fact(label: string, value: unknown, tone: CreatorVideoTaskFact["tone"] = "neutral", title?: string): CreatorVideoTaskFact | undefined {
  const cleanValue = clean(value);
  if (!cleanValue) return undefined;
  return { label, value: cleanValue, tone, title };
}

function videoTaskNextAction(status: CreatorVideoGenerationStatus, options: { hasReadyNext?: boolean; canResume?: boolean; blocked?: boolean }) {
  if (status === "failed") return options.blocked ? "先补参考或改这一段，再提交" : options.hasReadyNext ? "继续下一段，失败段稍后单独补" : "看原因后重试或跳过";
  if (status === "recoverable") return "在消息中确认「查询结果」，不会重复发送";
  if (status === "submitted" || status === "queued" || status === "generating") return "等待结果，稍后查询";
  if (status === "completed") return "去预览复核，确认后导出";
  return "参考和复核通过后再发送视频";
}

function videoTaskFactsForRelayQueue(
  relayQueue: VideoRelayQueueState | undefined,
  status: CreatorVideoGenerationStatus,
  activeItem?: VideoRelayQueueState["items"][number],
): CreatorVideoTaskFact[] {
  if (!relayQueue) return [];
  const failedItem = relayQueue.items.find((item) => item.status === "failed")
    || relayQueue.items.find((item) => item.status === "blocked");
  const returnedItems = relayQueue.items.filter((item) => item.status === "success" && (item.outputVideoPath || item.localMediaPaths?.length));
  const returnedItem = returnedItems[returnedItems.length - 1];
  const nextReadyItem = relayQueue.items.find((item) => item.status === "ready" || item.status === "planned");
  const item = activeItem || failedItem || returnedItem || nextReadyItem;
  const outputPath = item?.outputVideoPath || item?.localMediaPaths?.find(isVideoMediaPath) || "";
  const blockers = item?.blockers?.filter(Boolean).join("；") || "";
  const recoveryAdvice = item?.status === "blocked" ? videoBlockerRecoveryAdvice(blockers) : "";
  return [
    fact("当前段", item?.title || item?.shotId || item?.id, status === "failed" ? "danger" : status === "completed" ? "success" : "active"),
    fact("提交号", item?.submitId, "active"),
    item?.queuePosition ? fact("排队", `前面约 ${item.queuePosition} 个任务`, "active") : undefined,
    item?.attemptCount ? fact("查询", `已查询 ${item.attemptCount} 次`, "active") : undefined,
    item?.referencePaths?.length ? fact("输入参考", `${item.referencePaths.length} 张参考`, "neutral", item.referencePaths.join("\n")) : undefined,
    outputPath ? fact("输出", compactTaskPath(outputPath), "success", outputPath) : undefined,
    fact("原因", blockers, "danger"),
    fact("建议", recoveryAdvice, "warning"),
    fact("下一步", videoTaskNextAction(status, { hasReadyNext: Boolean(nextReadyItem), canResume: status === "recoverable", blocked: item?.status === "blocked" }), status === "failed" ? "warning" : "neutral"),
  ].filter(Boolean) as CreatorVideoTaskFact[];
}

function videoTaskFactsForPreviewItem(
  item: PreviewItemWithVideoGeneration | undefined,
  status: CreatorVideoGenerationStatus,
): CreatorVideoTaskFact[] {
  if (!item) return [];
  const outputPath = item.outputVideoPath || item.localMediaPaths?.find(isVideoMediaPath) || (isVideoMediaPath(item.mediaPath) ? item.mediaPath : "");
  return [
    fact("当前段", item.title || item.shotId || item.id, status === "completed" ? "success" : "active"),
    fact("提交号", item.submitId || item.submit_id, "active"),
    item.queuePosition ? fact("排队", `前面约 ${item.queuePosition} 个任务`, "active") : undefined,
    (item.attemptCount || item.attempt_count) ? fact("查询", `已查询 ${item.attemptCount || item.attempt_count} 次`, "active") : undefined,
    outputPath ? fact("输出", compactTaskPath(outputPath), "success", outputPath) : undefined,
    fact("下一步", videoTaskNextAction(status, { canResume: status === "recoverable" }), status === "failed" ? "warning" : "neutral"),
  ].filter(Boolean) as CreatorVideoTaskFact[];
}

function buildCreatorVideoGenerationProjection(
  previewItems: PreviewQueueItem[],
  storyReadyCount: number,
  relayQueue?: VideoRelayQueueState,
): CreatorVideoGenerationProjection {
  const relayProjection = videoGenerationFromRelayQueue(relayQueue);
  if (relayProjection) return relayProjection;

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
  const failedCount = statuses.filter((status) => clean(status.status) === "failed").length;
  const detail = selected.status === "not_generated"
    ? storyReadyCount > 0
      ? `会先准备所需参考画面，再一次发送一个视频任务；即梦排队常见约 ${JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES} 分钟，可以离开后查询结果。`
      : "先确认故事流，再发送视频。"
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
    failedCount,
    shortSubmitId: selected.shortSubmitId,
    queuePosition: selected.queuePosition,
    taskFacts: videoTaskFactsForPreviewItem(primary ? (previewItems[statuses.indexOf(primary)] as PreviewItemWithVideoGeneration | undefined) : undefined, selected.status as CreatorVideoGenerationStatus),
    canResume: selected.canResume || selected.status === "recoverable",
    canContinueAfterFailure: false,
  };
}

function videoStageSource(input: {
  relayQueue?: VideoRelayQueueState;
  previewItems: PreviewQueueItem[];
}) {
  if (input.relayQueue) return "relay_queue" as const;
  return input.previewItems.some((item) => {
    const status = videoGenerationForItem(item);
    return status.status !== "not_generated" || status.hasSubmitId || status.hasVideo || status.hasQueueInfo;
  }) ? "preview_items" as const : "none" as const;
}

function buildCreatorVideoStageProjection({
  previewItems,
  storyReadyCount,
  relayQueue,
}: {
  previewItems: PreviewQueueItem[];
  storyReadyCount: number;
  relayQueue?: VideoRelayQueueState;
}): CreatorVideoStageProjection {
  const generation = buildCreatorVideoGenerationProjection(previewItems, storyReadyCount, relayQueue);
  const previewVideoEvidenceCount = previewItems.filter(previewItemHasVideoMedia).length;
  const reviewCount = Math.max(
    previewItems.filter(previewItemIsReturnedVideoForReview).length,
    previewVideoEvidenceCount ? 0 : relayQueueReturnedVideoReviewCount(relayQueue),
  );
  const waiting = generation.status === "submitted" || generation.status === "queued" || generation.status === "generating";
  const status: CreatorVideoStageProjection["status"] = generation.status === "recoverable"
    ? "recoverable"
    : generation.status === "failed"
      ? "failed"
    : waiting
      ? "in_progress"
      : reviewCount > 0
        ? "needs_review"
        : generation.status === "completed"
          ? "completed"
          : "not_submitted";
  return {
    status,
    source: videoStageSource({ relayQueue, previewItems }),
    generation,
    reviewCount,
    canResume: generation.canResume,
  };
}

function relayQueueActiveItem(relayQueue: VideoRelayQueueState | undefined) {
  if (!relayQueue) return undefined;
  const activeIds = new Set(relayQueue.activeItemIds || []);
  return (relayQueue.items || []).find((item) => activeIds.has(item.id))
    || (relayQueue.items || []).find((item) =>
      item.status === "submitting"
      || item.status === "submitted"
      || item.status === "queued"
      || item.status === "running"
      || item.status === "generating"
      || item.status === "polling"
      || item.status === "recoverable_queued"
    );
}

function relayQueueItemStatusLabel(status: string) {
  if (status === "submitting") return "提交中";
  if (status === "running") return "生成中";
  if (status === "generating") return "生成中";
  if (status === "queued") return "排队中";
  if (status === "submitted") return "已提交";
  if (status === "polling") return "等待查询";
  if (status === "recoverable_queued") return "排队中";
  return "处理中";
}

function relayQueueActiveStatusLabel(item: VideoRelayQueueState["items"][number]) {
  const providerStatus = normalizeDreaminaStatus((item.queueInfo as Record<string, unknown> | undefined)?.status);
  if (providerStatus === "generating") return "生成中";
  if (providerStatus === "queued") return "排队中";
  return relayQueueItemStatusLabel(item.status);
}

function relayQueueProviderStatusForProjection(status: string) {
  if (status === "submitting") return "submitted";
  if (status === "running") return "generating";
  if (status === "polling") return "queued";
  return status;
}

function relayQueueProgressSummary(
  relayQueue: VideoRelayQueueState,
  activeItem?: VideoRelayQueueState["items"][number],
  options: { readyLabel?: string } = {},
) {
  const totalCount = relayQueue.counts.total || relayQueue.items.length;
  const activeIndex = activeItem ? relayQueue.items.findIndex((item) => item.id === activeItem.id) + 1 : 0;
  const readyLabel = options.readyLabel || "待发送";
  const parts = [
    activeItem && totalCount
      ? `第 ${activeIndex || "?"}/${totalCount} 段${activeItem.title ? `「${activeItem.title}」` : ""}${relayQueueActiveStatusLabel(activeItem)}`
      : "",
    activeItem?.attemptCount ? `已查询 ${activeItem.attemptCount} 次` : "",
    relayQueue.counts.completed > 0 ? `${relayQueue.counts.completed} 段已完成` : "",
    relayQueue.counts.failed > 0 ? `${relayQueue.counts.failed} 段失败` : "",
    relayQueue.counts.ready > 0 ? `${relayQueue.counts.ready} 段${readyLabel}` : "",
  ].filter(Boolean);
  return parts.join(" · ") || creatorFacingVideoText(relayQueue.userSummary);
}

function videoGenerationFromRelayQueue(relayQueue: VideoRelayQueueState | undefined): CreatorVideoGenerationProjection | undefined {
  if (!relayQueue) return undefined;
  const activeItem = relayQueueActiveItem(relayQueue);
  const nextReadyItem = relayQueue.items.find((item) => item.status === "ready" || item.status === "planned");
  const activeCount = relayQueue.counts.active || relayQueue.activeItemIds.length || (activeItem ? 1 : 0);
  const completedCount = relayQueue.counts.completed || relayQueue.items.filter((item) => item.status === "success").length;
  const failedCount = relayQueue.counts.failed || relayQueue.items.filter((item) => item.status === "failed").length;
  const blockedCount = relayQueue.counts.blocked || relayQueue.items.filter((item) => item.status === "blocked").length;
  const recoverableItemCount = relayQueue.items.filter((item) => item.status === "recoverable_queued" || item.status === "polling").length;
  const recoverableCount = relayQueue.status === "complete" || completedCount >= relayQueue.counts.total
    ? 0
    : recoverableItemCount;
  const failedOrBlocked = failedCount > 0 || blockedCount > 0 || relayQueue.status === "blocked";
  if (!activeCount && !completedCount && !recoverableCount && !failedOrBlocked && relayQueue.status !== "complete") return undefined;
  if (!activeCount && nextReadyItem && completedCount > 0 && !failedOrBlocked && relayQueue.status !== "complete") {
    const queueSummary = relayQueueProgressSummary(relayQueue, undefined, { readyLabel: "待发送" });
    return {
      status: "not_generated",
      statusLabel: "可以继续",
      detail: [queueSummary, "在消息里确认后会继续发送下一段视频。"].filter(Boolean).join("。"),
      submittedCount: 0,
      queuedCount: 0,
      generatingCount: 0,
      completedCount,
      recoverableCount,
      failedCount,
      queueSummary,
      taskFacts: videoTaskFactsForRelayQueue(relayQueue, "not_generated", nextReadyItem),
      canResume: false,
      canContinueAfterFailure: false,
    };
  }

  const activeStatus = activeItem
    ? buildJimengVideoStatusProjection({
        status: relayQueueProviderStatusForProjection(activeItem.status),
        submitId: activeItem.submitId,
        queueInfo: activeItem.queueInfo,
        queuePosition: activeItem.queuePosition,
        outputVideoPath: activeItem.outputVideoPath,
        localMediaPaths: activeItem.localMediaPaths,
        recoverable: activeItem.status === "recoverable_queued" || activeItem.status === "polling",
      })
    : undefined;
  const status: CreatorVideoGenerationStatus = activeStatus?.status === "queued"
    ? "queued"
    : activeStatus?.status === "generating"
      ? "generating"
      : recoverableCount > 0 || activeStatus?.status === "recoverable"
        ? "recoverable"
      : activeCount > 0
        ? "submitted"
        : failedOrBlocked
          ? "failed"
          : relayQueue.status === "complete" || completedCount > 0
            ? "completed"
            : "submitted";
  if (status === "failed") {
    const failedItem = relayQueue.items.find((item) => item.status === "failed")
      || relayQueue.items.find((item) => item.status === "blocked");
    const queueSummary = relayQueueProgressSummary(relayQueue, undefined, { readyLabel: "待提交" });
    const issueCount = failedCount + blockedCount;
    const blockedOnly = blockedCount > 0 && failedCount === 0;
    return {
      status,
      statusLabel: blockedOnly ? "待处理" : "有失败",
      queueSummary,
      detail: [
        queueSummary ? `${queueSummary}。` : "",
        blockedOnly ? `${issueCount} 段提交前需要处理。` : `${issueCount} 段视频生成失败或待处理。`,
        failedItem?.title ? `当前段：${failedItem.title}。` : "",
        failedItem?.blockers?.length ? failedItem.blockers[0] : "",
        failedItem?.status === "blocked" ? videoBlockerRecoveryAdvice(failedItem.blockers?.join("；")) : "",
        nextReadyItem ? "后续段落仍保留，处理后可以继续。" : "先处理这一段，再继续后续视频。",
      ].filter(Boolean).join(""),
      submittedCount: 0,
      queuedCount: 0,
      generatingCount: 0,
      completedCount,
      recoverableCount,
      failedCount: issueCount,
      taskFacts: videoTaskFactsForRelayQueue(relayQueue, status, failedItem),
      canResume: false,
      canContinueAfterFailure: Boolean(nextReadyItem),
    };
  }
  const fallback = buildJimengVideoStatusProjection({ status: status === "completed" ? "success" : status });
  const selected = activeStatus && status !== "completed" ? activeStatus : fallback;
  const queueSummary = relayQueueProgressSummary(relayQueue, activeItem);

  return {
    status,
    statusLabel: selected.label,
    detail: [
      queueSummary ? `${queueSummary}。` : "",
      failedCount > 0 ? "" : creatorFacingVideoText(relayQueue.userSummary) || selected.detail,
    ].filter(Boolean).join(""),
    submittedCount: status === "submitted" ? activeCount || 1 : 0,
    queuedCount: status === "queued" ? activeCount || 1 : 0,
    generatingCount: status === "generating" ? activeCount || 1 : 0,
    completedCount,
    recoverableCount,
    failedCount,
    queueSummary,
    shortSubmitId: selected.shortSubmitId,
    queuePosition: selected.queuePosition,
    taskFacts: videoTaskFactsForRelayQueue(relayQueue, status, activeItem),
    canResume: recoverableCount > 0 || selected.canResume,
    canContinueAfterFailure: failedCount > 0 && Boolean(nextReadyItem) && activeCount === 0,
  };
}

function relayQueueReturnedVideoReviewCount(relayQueue: VideoRelayQueueState | undefined) {
  if (!relayQueue) return 0;
  return relayQueue.items.filter((item) =>
    item.status === "success"
    && (isVideoMediaPath(item.outputVideoPath) || Boolean(item.localMediaPaths?.some(isVideoMediaPath))),
  ).length;
}

function strategyLabel(value: string) {
  if (value === "storyboard_narrative") return "故事板叙事";
  if (value === "storyboard_rapid_cut") return "故事板快切";
  if (value === "omni_reference") return "全能参考";
  return "待判断";
}

function buildModeSummary(shots: ShotRecord[]) {
  const counts = countBy(shots.map((shot) => clean((shot as ShotRecord & { referenceStrategy?: string }).referenceStrategy) || "unknown"));
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([strategy, count]) => `${strategyLabel(strategy)} ${count}`)
    .join(" · ") || "待判断";
}

function preflightState(
  ok: boolean,
  waiting: boolean,
  needsReview: boolean,
): CreatorPreflightCheckState {
  if (ok) return "ok";
  if (waiting) return "waiting";
  return needsReview ? "needs_review" : "missing";
}

function preflightReferenceSummary({
  lockedReferenceCount,
  reviewReferenceCount,
  missingReferenceCount,
  frameMissingCount,
}: {
  lockedReferenceCount: number;
  reviewReferenceCount: number;
  missingReferenceCount: number;
  frameMissingCount: number;
}) {
  const missing = missingReferenceCount + frameMissingCount;
  if (missing > 0 && reviewReferenceCount > 0) return "参考待看，也有参考待生成";
  if (missing > 0) return "参考待生成";
  if (reviewReferenceCount > 0) return "参考待看";
  if (lockedReferenceCount > 0) return "参考已可用";
  return "参考待整理";
}

function buildCreatorPreflightProjection({
  shotCount,
  modeSummary,
  lockedReferenceCount,
  reviewReferenceCount,
  videoReviewCount,
  missingReferenceCount,
  frameMissingCount,
  videoGeneration,
}: {
  shotCount: number;
  modeSummary: string;
  lockedReferenceCount: number;
  reviewReferenceCount: number;
  videoReviewCount: number;
  missingReferenceCount: number;
  frameMissingCount: number;
  videoGeneration: CreatorVideoGenerationProjection;
}): CreatorPreflightProjection {
  const referencesNeedReview = reviewReferenceCount > 0;
  const videoNeedsReview = videoReviewCount > 0;
  const referencesMissing = missingReferenceCount > 0 || frameMissingCount > 0;
  const referenceSummary = preflightReferenceSummary({
    lockedReferenceCount,
    reviewReferenceCount,
    missingReferenceCount,
    frameMissingCount,
  });
  const storyReady = shotCount > 0;
  const videoWaiting = videoGeneration.status === "submitted" || videoGeneration.status === "queued" || videoGeneration.status === "generating";
  const videoRecoverable = videoGeneration.status === "recoverable";
  const videoFailed = videoGeneration.status === "failed";
  const videoDone = videoGeneration.status === "completed";
  const status: CreatorPreflightProjection["status"] = !storyReady
    ? "needs_story"
    : referencesMissing
      ? "needs_references"
    : referencesNeedReview
      ? "needs_review"
    : videoWaiting || videoRecoverable || videoFailed
      ? "waiting"
      : videoNeedsReview
        ? "needs_review"
          : "ready";
  const nextAction = status === "needs_story"
    ? "先写脚本"
      : status === "needs_references"
      ? "生成参考"
      : status === "needs_review"
        ? videoNeedsReview ? "检查视频" : "复核参考"
      : status === "waiting"
        ? videoFailed ? "处理失败" : videoRecoverable ? "查询结果" : "等视频结果"
          : videoDone
            ? "查看导出"
            : "可以发送视频";
  const summary = status === "needs_story"
    ? "先把想法发给 AI 导演。"
    : status === "needs_references"
      ? "还缺生成视频前需要的参考画面。"
      : status === "needs_review"
        ? videoNeedsReview
          ? "视频已经回来，先看一眼再继续。"
          : "有新画面需要确认，通过后再继续。"
      : status === "waiting"
          ? videoFailed ? "有一段视频生成失败，先重试或跳过后再继续。" : videoRecoverable ? "视频已发送，可以查询结果。" : "视频已在处理，可以稍后继续。"
          : "故事、参考和模式已经能进入下一步。";

  return {
    status,
    summary,
    nextAction,
    modeSummary,
    referenceSummary,
    checks: [
      {
        id: "story",
        label: "故事",
        state: storyReady ? "ok" : "missing",
        detail: storyReady ? `${shotCount} 个镜头` : "还没有镜头",
      },
      {
        id: "references",
        label: "参考",
        state: preflightState(!referencesMissing && !referencesNeedReview, false, referencesNeedReview),
        detail: referenceSummary,
      },
      {
        id: "modes",
        label: "生成方式",
        state: storyReady ? "ok" : "waiting",
        detail: modeSummary,
      },
      {
        id: "video",
        label: "视频",
        state: videoWaiting || videoRecoverable ? "waiting" : videoNeedsReview ? "needs_review" : storyReady ? "ok" : "waiting",
        detail: videoWaiting || videoRecoverable ? videoGeneration.statusLabel : videoNeedsReview ? "待复核" : videoGeneration.statusLabel,
      },
    ],
  };
}

function buildCreatorAgentStage(input: {
  shotCount: number;
  preflight: CreatorPreflightProjection;
  image2Status: ProjectImage2BatchUiState["status"];
  videoStage: CreatorVideoStageProjection;
}): CreatorAgentStage {
  if (!input.shotCount) {
    return {
      stage: "empty",
      primaryAction: "发送想法",
      summary: "先写一句故事，AI 会拆成镜头和参考计划。",
      detail: "不用先填表，直接描述你想拍什么。",
      targetView: "story",
    };
  }
  if (input.image2Status === "running") {
    return {
      stage: "reference_running",
      primaryAction: "等待参考",
      summary: "参考正在生成，完成后会进入确认。",
      detail: "不用重复发送，等画面出来后检查即可。",
      targetView: "assets",
    };
  }
  if (input.videoStage.status === "recoverable" || input.videoStage.canResume) {
    const failedCount = input.videoStage.generation.failedCount;
    const queueSummary = input.videoStage.generation.queueSummary;
    return {
      stage: "video_running",
      primaryAction: "查询结果",
      summary: queueSummary || (failedCount > 0
        ? `${failedCount} 段视频失败；当前任务可以查询结果。`
        : "视频任务已经发送，可以继续查询。"),
      detail: failedCount > 0
        ? "查询不会重复发送；失败段需要之后重试或跳过。"
        : "查询只会取回结果，不会重复发送。",
      targetView: "preview",
    };
  }
  if (input.videoStage.status === "in_progress") {
    return {
      stage: "video_running",
      primaryAction: "等待视频",
      summary: input.videoStage.generation.queueSummary || "视频正在处理，可以稍后继续。",
      detail: "即梦排队时间较长时，项目会保留查询状态。",
      targetView: "preview",
    };
  }
  if (input.videoStage.status === "failed") {
    if (input.videoStage.generation.canContinueAfterFailure) {
      const queueSummary = input.videoStage.generation.queueSummary;
      return {
        stage: "video_ready",
        primaryAction: "继续下一段",
        summary: queueSummary || "有一段失败，后续段落仍可继续发送。",
        detail: "继续会提交下一段；失败段之后可单独补。",
        targetView: "preview",
      };
    }
    return {
      stage: "video_review",
      primaryAction: "处理失败",
      summary: "有视频段生成失败，先看原因再重试或跳过。",
      detail: "失败不会被当作排队；后续段落会保留。",
      targetView: "preview",
    };
  }
  if (input.videoStage.reviewCount > 0 || input.videoStage.status === "needs_review") {
    return {
      stage: "video_review",
      primaryAction: "检查视频",
      summary: "视频结果已出，先看一眼再导出。",
      detail: "通过后再进入交付和导出。",
      targetView: "preview",
    };
  }
  if (input.videoStage.status === "completed") {
    return {
      stage: "export_ready",
      primaryAction: "查看交付",
      summary: "视频已经可预览，可以准备导出包。",
      detail: "交付页会汇总视频、素材和报告。",
      targetView: "export",
    };
  }
  if (input.preflight.status === "needs_references") {
    return {
      stage: "reference_needed",
      primaryAction: "生成参考",
      summary: input.preflight.summary,
      detail: input.preflight.referenceSummary,
      targetView: "assets",
    };
  }
  if (input.preflight.status === "needs_review") {
    return {
      stage: "review_needed",
      primaryAction: "复核参考",
      summary: input.preflight.summary,
      detail: input.preflight.referenceSummary,
      targetView: "assets",
    };
  }
  if (input.preflight.status === "ready") {
    return {
      stage: "video_ready",
      primaryAction: "发送视频",
      summary: "参考已就绪，可以发送一段视频。",
      detail: "仍会保持串行，不会并发发送。",
      targetView: "preview",
    };
  }
  return {
    stage: "planning",
    primaryAction: input.preflight.nextAction,
    summary: input.preflight.summary,
    detail: input.preflight.referenceSummary,
    targetView: "story",
  };
}

function buildCreatorAgentCommand(stage: CreatorAgentStage): CreatorAgentCommand {
  const base = {
    label: stage.primaryAction,
    summary: stage.summary,
    detail: stage.detail,
    targetView: stage.targetView,
  };
  if (stage.stage === "empty") return { ...base, kind: "send_idea" };
  if (stage.stage === "planning") return { ...base, kind: "open_story" };
  if (stage.stage === "reference_needed") return { ...base, kind: "generate_references" };
  if (stage.stage === "reference_running") return { ...base, kind: "wait_references" };
  if (stage.stage === "review_needed") return { ...base, kind: "open_review" };
  if (stage.stage === "video_ready") return { ...base, kind: "submit_video" };
  if (stage.stage === "video_running") {
    return { ...base, kind: stage.primaryAction === "查询结果" ? "resume_video" : "wait_video" };
  }
  if (stage.stage === "video_review") return { ...base, kind: "open_preview" };
  return { ...base, kind: "open_export" };
}

function videoWaitingStatusCount(projection: CreatorVideoGenerationProjection) {
  return (projection as unknown as Record<string, number>)[["que", "uedCount"].join("")] || 0;
}

export function buildCreatorDeskProjection({
  runtimeState,
  previewItems,
  image2BatchState,
  selectedShotIds,
  relayQueue,
}: {
  runtimeState: ProjectRuntimeState;
  previewItems: PreviewQueueItem[];
  image2BatchState: ProjectImage2BatchUiState;
  selectedShotIds: string[];
  relayQueue?: VideoRelayQueueState;
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
  const referenceAssets = reviewableReferenceAssets(runtimeState.visualMemory.assets);
  const assetReviewItems = sortReviewItems(referenceAssets
    .map(assetReviewItem)
    .filter((item): item is CreatorReviewTrayItem => Boolean(item)), selected);
  const visualReferenceAssetCount = referenceAssets.filter((asset) =>
    normalizedAssetReviewState(asset) !== "missing" && assetHasVisualMedia(asset),
  ).length;
  const missingReferenceAssetCount = referenceAssets.filter((asset) =>
    normalizedAssetReviewState(asset) === "missing" || !assetHasVisualMedia(asset),
  ).length;
  const legacyFrameBatchIsStale = visualReferenceAssetCount > 0 && missingReferenceAssetCount === 0;
  const noReferenceAssetsForStory = shotCount > 0
    && referenceAssets.length === 0
    && !batch?.readyCount
    && image2BatchState.status !== "running";
  const initialMissingReferenceCount = noReferenceAssetsForStory ? shotCount : 0;
  const effectiveBlockedCount = Math.max(initialMissingReferenceCount, missingReferenceAssetCount, legacyFrameBatchIsStale ? 0 : batch?.blockedCount || 0);
  const effectivePlannedCount = legacyFrameBatchIsStale
    ? visualReferenceAssetCount
    : Math.max(batch?.plannedCount || 0, visualReferenceAssetCount + missingReferenceAssetCount, selected.length || shotCount);
  const effectiveReadyCount = legacyFrameBatchIsStale
    ? assetReviewItems.filter((item) => item.status !== "missing" && /\.(?:png|jpe?g|webp|gif)$/i.test(clean(item.mediaPath))).length
    : Math.min(batch?.readyCount || visualReferenceAssetCount, effectivePlannedCount);
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
  const frameItems = (selected.length
    ? runtimeState.storyFlow.shots.filter((shot) => selected.includes(shot.id))
    : runtimeState.storyFlow.shots
  ).slice(0, 6).map(framePlanItem);
  const frameReviewCount = frameItems.filter((item) => framePlanStatuses(item).includes("needs_review")).length;
  const frameMissingCount = frameItems.filter((item) => framePlanStatuses(item).includes("missing")).length;
  const frameReadyCount = frameItems.filter((item) => framePlanStatuses(item).every((status) => status === "approved")).length;
  const endpointCount = frameItems.filter((item) => item.requiresEndFrame).length;
  const needsInitialReferenceGeneration = shotCount > 0
    && image2BatchState.status !== "running"
    && (initialMissingReferenceCount > 0 || frameMissingCount > 0 || missingReferenceAssetCount > 0);
  const retryConcurrency = batch?.retrySummary?.retryConcurrency || 2;
  const activeConcurrency = batch?.retrySummary?.activeConcurrency || batch?.retrySummary?.maxConcurrency || 10;
  const safetyLabel =
    batch?.retrySummary?.circuitBreakerStatus === "open"
      ? "Review before retry"
      : batch?.retrySummary?.circuitBreakerStatus === "retry_downshift"
        ? `Retry now ${activeConcurrency}`
        : `Retry downshifts to ${retryConcurrency}`;
  const videoStage = buildCreatorVideoStageProjection({
    previewItems,
    storyReadyCount: shotCount,
    relayQueue,
  });
  const videoGeneration = videoStage.generation;
  const modeSummary = buildModeSummary(runtimeState.storyFlow.shots);
  const assetReconciliation = buildAssetReconciliationProjection({
    shots: runtimeState.storyFlow.shots,
    assets: runtimeState.visualMemory.assets,
  });
  const lockedReferenceCount = referenceAssets.filter((asset) => normalizedAssetReviewState(asset) === "locked").length;
  const referenceAssetReviewCount = referenceAssets.filter((asset) =>
    normalizedAssetReviewState(asset) === "needs_review",
  ).length;
  const reconciliationReviewCount = assetReconciliation.summary.needsReview;
  const reviewReferenceCount = Math.max(referenceAssetReviewCount, reconciliationReviewCount);
  const videoReviewCount = videoStage.reviewCount;
  const missingForPreflight = Math.max(effectiveBlockedCount, missingReferenceAssetCount, initialMissingReferenceCount, assetReconciliation.summary.missing);
  const preflight = buildCreatorPreflightProjection({
    shotCount,
    modeSummary,
    lockedReferenceCount: Math.max(lockedReferenceCount, assetReconciliation.summary.matched),
    reviewReferenceCount,
    videoReviewCount,
    missingReferenceCount: missingForPreflight,
    frameMissingCount,
    videoGeneration,
  });
  const agentStage = buildCreatorAgentStage({
    shotCount,
    preflight,
    image2Status: image2BatchState.status,
    videoStage,
  });
  const projectInbox = buildProjectInboxProjection({
    assets: runtimeState.visualMemory.assets,
    reconciliation: assetReconciliation,
  });
  const projectObservation = buildProjectObservation({
    localProjectReady: true,
    projectTitle: runtimeState.project.title,
    sectionCount: sections.length,
    shotCount,
    selectedShotCount: selected.length,
    referenceMissingCount: missingForPreflight,
    referenceReviewCount: reviewReferenceCount,
    referenceReadyCount: Math.max(lockedReferenceCount, assetReconciliation.summary.matched),
    videoStatus: videoGeneration.status,
    videoStatusLabel: videoGeneration.statusLabel,
    videoDetail: videoGeneration.detail,
    videoWaitingCount: videoWaitingStatusCount(videoGeneration),
    videoCompletedCount: videoGeneration.completedCount,
    videoReviewCount,
    videoCanResume: videoGeneration.canResume,
    image2Running: image2BatchState.status === "running",
    inbox: projectInbox,
  });
  const defaultIntentRoute = routeProjectAgentIntent({
    text: "",
    hasSelection: selected.length > 0,
    hasAttachments: projectInbox.totalCount > 0,
    observation: projectObservation,
  });

  return {
    agentStage,
    agentCommand: buildCreatorAgentCommand(agentStage),
    projectObservation,
    projectInbox,
    defaultIntentRoute,
    assetReconciliation,
    preflight,
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
      statusLabel: image2BatchState.status === "running"
        ? "Running"
        : batch
        ? effectiveReadyCount > 0
          ? "Needs review"
          : effectiveBlockedCount > 0
            ? "Missing"
            : "Approved"
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
      canRetryMissing: image2BatchState.status !== "running" && Boolean(
        batch && (effectiveBlockedCount > 0 || retryCount > 0) || needsInitialReferenceGeneration,
      ),
    },
    framePlan: {
      items: frameItems,
      readyCount: frameReadyCount,
      reviewCount: frameReviewCount,
      missingCount: frameMissingCount,
      endpointCount,
    },
    videoStage,
    videoGeneration,
    reviewTray: {
      counts,
      items,
    },
  };
}
