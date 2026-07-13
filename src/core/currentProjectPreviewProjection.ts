import type { PreviewQueueItem, PreviewQueueItemKind } from "./previewPlayerQueue";
import type { ProjectImage2OneShotStatus } from "./projectImage2Types";
import {
  buildJimengVideoStatusProjection,
  type JimengVideoStatusProjection,
} from "./jimengVideoCli";
import type { VideoRelayQueueItem, VideoRelayQueueState } from "./videoRelayQueue";

export const currentProjectPreviewProjectionSchemaVersion = "0.1.0";
export const currentProjectPreviewProjectionSource = "current_project_runtime_truth" as const;

export interface CurrentProjectPreviewItemInput {
  id?: string;
  shotId?: string;
  order?: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  mediaPath?: string;
  mediaType?: string;
  sourceReceiptId?: string;
  providerReceiptId?: string;
  providerRequestId?: string;
  outputHash?: string;
  outputSha256?: string;
  providerOutputSha256?: string;
  promptText?: string;
  promptPath?: string;
  referencePaths?: string[];
  promptHash?: string;
  durationSeconds?: number;
  duration_seconds?: number;
  duration?: number;
  fileUrl?: string;
  expectedOutputPath?: string;
  status?: string;
  previewStatus?: string;
  runtimeTruthStatus?: string;
  previewQaStatus?: string;
  productionQaStatus?: string;
  reviewRequired?: boolean;
  reviewOverlay?: boolean;
  outputExists?: boolean;
  blockers?: string[];
  videoStatus?: string;
  generationStatus?: string;
  submitId?: string;
  submit_id?: string;
  queueInfo?: Record<string, unknown>;
  queue_info?: Record<string, unknown>;
  queuePosition?: number;
  queueIndex?: number;
  queue_idx?: number;
  queueLength?: number;
  queue_length?: number;
  queueStatus?: string;
  queue_status?: string;
  attemptCount?: number;
  attempt_count?: number;
  outputVideoPath?: string;
  videoPath?: string;
  videoUrl?: string;
  videoUrls?: string[];
  localMediaPaths?: string[];
  recoverable?: boolean;
  timedOut?: boolean;
}

export interface CurrentProjectPreviewSummaryInput {
  status?: string;
  projectId?: string;
  projectRoot?: string;
  generatedAt?: string;
  previewStatus?: string;
  productionStatus?: string;
  reviewShotIds?: string[];
  needsReviewShotIds?: string[];
  reviewOverlayShots?: string[];
  previewItems?: CurrentProjectPreviewItemInput[];
}

export interface CurrentProjectPreviewPlanClipInput {
  clipId?: string;
  id?: string;
  order?: number;
  shotId?: string;
  mediaType?: string;
  type?: string;
  mediaPath?: string;
  imageUrl?: string;
  fileUrl?: string;
  sourceReceiptId?: string;
  providerReceiptId?: string;
  providerRequestId?: string;
  outputHash?: string;
  outputSha256?: string;
  providerOutputSha256?: string;
  durationSeconds?: number;
  duration_seconds?: number;
  duration?: number;
  status?: string;
  videoStatus?: string;
  submitId?: string;
  submit_id?: string;
  queueInfo?: Record<string, unknown>;
  queue_info?: Record<string, unknown>;
  queuePosition?: number;
  queueIndex?: number;
  queue_idx?: number;
  queueLength?: number;
  queue_length?: number;
  queueStatus?: string;
  queue_status?: string;
  attemptCount?: number;
  attempt_count?: number;
  previewQaStatus?: string;
  productionQaStatus?: string;
}

export interface CurrentProjectPreviewPlanInput {
  clips?: CurrentProjectPreviewPlanClipInput[];
  events?: CurrentProjectPreviewPlanClipInput[];
  totalDurationSeconds?: number;
  previewStatus?: string;
  productionStatus?: string;
}

export interface CurrentProjectPreviewQueueItem extends PreviewQueueItem {
  source: typeof currentProjectPreviewProjectionSource;
  order: number;
  status: string;
  sourceReceiptId?: string;
  providerReceiptId?: string;
  providerRequestId?: string;
  outputHash?: string;
  outputSha256?: string;
  promptText?: string;
  promptPath?: string;
  referencePaths?: string[];
  promptHash?: string;
  previewStatus?: string;
  runtimeTruthStatus?: string;
  previewQaStatus?: string;
  productionQaStatus?: string;
  reviewRequired: boolean;
  blocked: boolean;
  returned: boolean;
  blockers: string[];
  videoGeneration: JimengVideoStatusProjection;
}

export interface CurrentProjectPreviewProjection {
  schemaVersion: typeof currentProjectPreviewProjectionSchemaVersion;
  source: typeof currentProjectPreviewProjectionSource;
  available: boolean;
  projectId?: string;
  projectRoot?: string;
  generatedAt?: string;
  previewStatus?: string;
  productionStatus?: string;
  items: CurrentProjectPreviewQueueItem[];
  queue: CurrentProjectPreviewQueueItem[];
  totalDurationSeconds: number;
  blockedCount: number;
  reviewCount: number;
  returnedCount: number;
  missingCount: number;
  providerCalled: false;
  liveSubmitAllowed: false;
  workerSpawnForbidden: true;
}

export interface BuildCurrentProjectPreviewProjectionInput {
  summary?: CurrentProjectPreviewSummaryInput;
  previewItems?: CurrentProjectPreviewItemInput[];
  previewPlan?: CurrentProjectPreviewPlanInput;
  relayQueue?: VideoRelayQueueState;
  oneShot?: ProjectImage2OneShotStatus;
  projectId?: string;
  projectRoot?: string;
  generatedAt?: string;
}

const defaultDurationSeconds = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function asPreviewItem(value: unknown): CurrentProjectPreviewItemInput | undefined {
  return isRecord(value) ? value as CurrentProjectPreviewItemInput : undefined;
}

function asClip(value: unknown): CurrentProjectPreviewPlanClipInput | undefined {
  return isRecord(value) ? value as CurrentProjectPreviewPlanClipInput : undefined;
}

function clipId(clip: CurrentProjectPreviewPlanClipInput) {
  return stringValue(clip.shotId);
}

function safeDuration(value: unknown) {
  const duration = numberValue(value);
  return duration !== undefined && duration > 0 ? duration : undefined;
}

function clipDuration(clip: CurrentProjectPreviewPlanClipInput | undefined) {
  if (!clip) return defaultDurationSeconds;
  return safeDuration(clip.durationSeconds)
    ?? safeDuration(clip.duration_seconds)
    ?? safeDuration(clip.duration)
    ?? defaultDurationSeconds;
}

function clipMediaPath(clip: CurrentProjectPreviewPlanClipInput | undefined) {
  return stringValue(clip?.imageUrl)
    ?? stringValue(clip?.fileUrl)
    ?? stringValue(clip?.mediaPath);
}

function normalizeStatus(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim()) || "unknown";
}

function statusMatches(value: string | undefined, pattern: RegExp) {
  return pattern.test(String(value || "").toLowerCase());
}

function statusLooksLikeSelfReport(value: string | undefined) {
  return statusMatches(value, /self[-_ ]?report|worker[-_ ]?claim|provider[-_ ]?claimed|provider[-_ ]?succeeded|worker[-_ ]?succeeded/);
}

function statusLooksPreviewEligible(value: string | undefined) {
  return statusMatches(value, /^(complete_verified|verified|approved|pass|ready|success|needs_review|returned|returned_with_review_overlay)$/);
}

function itemMediaPath(item: CurrentProjectPreviewItemInput, clip: CurrentProjectPreviewPlanClipInput | undefined) {
  const directMediaPath = stringValue(item.mediaPath)
    ?? clipMediaPath(clip)
    ?? stringValue(item.expectedOutputPath);
  const mediaType = String(item.mediaType || clip?.mediaType || clip?.type || "").toLowerCase();
  if (mediaType.includes("video") || mediaLooksVideo(directMediaPath)) return directMediaPath
    ?? stringValue(item.imageUrl)
    ?? stringValue(item.fileUrl)
    ?? stringValue(item.thumbnailUrl);
  return stringValue(item.imageUrl)
    ?? stringValue(item.fileUrl)
    ?? directMediaPath
    ?? stringValue(item.thumbnailUrl)
}

function itemLabel(shotId: string | undefined, index: number) {
  return shotId || `Preview ${index + 1}`;
}

function itemKind(
  blocked: boolean,
  mediaPath: string | undefined,
  item: CurrentProjectPreviewItemInput,
  clip: CurrentProjectPreviewPlanClipInput | undefined,
): PreviewQueueItemKind {
  if (blocked || !mediaPath) return "missing_placeholder";
  const mediaType = String(item.mediaType || clip?.mediaType || clip?.type || "").toLowerCase();
  if (mediaType.includes("video") || mediaLooksVideo(mediaPath)) return "video_clip";
  return "image_hold";
}

function mediaLooksVideo(path: string | undefined) {
  return /\.(?:mp4|mov|webm)(?:\?|$)/i.test(path || "");
}

function itemHasVideoGenerationEvidence(
  item: CurrentProjectPreviewItemInput,
  clip: CurrentProjectPreviewPlanClipInput | undefined,
  mediaPath: string | undefined,
) {
  const mediaType = String(item.mediaType || clip?.mediaType || clip?.type || "").toLowerCase();
  return Boolean(
    item.videoStatus
    || item.generationStatus
    || item.submitId
    || item.submit_id
    || clip?.videoStatus
    || clip?.submitId
    || clip?.submit_id
    || item.queueInfo
    || item.queue_info
    || clip?.queueInfo
    || clip?.queue_info
    || item.queuePosition !== undefined
    || item.queueIndex !== undefined
    || item.queue_idx !== undefined
    || item.attemptCount !== undefined
    || item.attempt_count !== undefined
    || clip?.queuePosition !== undefined
    || clip?.queueIndex !== undefined
    || clip?.queue_idx !== undefined
    || clip?.attemptCount !== undefined
    || clip?.attempt_count !== undefined
    || item.outputVideoPath
    || item.videoPath
    || item.videoUrl
    || item.videoUrls?.length
    || item.localMediaPaths?.length
    || mediaType.includes("video")
    || mediaLooksVideo(mediaPath),
  );
}

function itemVideoGeneration(
  item: CurrentProjectPreviewItemInput,
  clip: CurrentProjectPreviewPlanClipInput | undefined,
  status: string,
  mediaPath: string | undefined,
) {
  const hasEvidence = itemHasVideoGenerationEvidence(item, clip, mediaPath);
  return buildJimengVideoStatusProjection({
    status: hasEvidence ? (item.videoStatus || item.generationStatus || clip?.videoStatus || item.previewStatus || status || clip?.status) : "not_submitted",
    submitId: item.submitId || item.submit_id || clip?.submitId || clip?.submit_id,
    queueInfo: item.queueInfo || item.queue_info || clip?.queueInfo || clip?.queue_info,
    queuePosition: numberValue(item.queuePosition)
      ?? numberValue(item.queueIndex)
      ?? numberValue(item.queue_idx)
      ?? numberValue(clip?.queuePosition)
      ?? numberValue(clip?.queueIndex)
      ?? numberValue(clip?.queue_idx),
    queueLength: numberValue(item.queueLength)
      ?? numberValue(item.queue_length)
      ?? numberValue(clip?.queueLength)
      ?? numberValue(clip?.queue_length),
    queueStatus: item.queueStatus || item.queue_status || clip?.queueStatus || clip?.queue_status,
    videoPath: item.videoPath,
    outputVideoPath: item.outputVideoPath,
    mediaPath,
    videoUrls: item.videoUrl ? [item.videoUrl, ...(item.videoUrls || [])] : item.videoUrls,
    localMediaPaths: item.localMediaPaths,
    recoverable: item.recoverable,
    timedOut: item.timedOut,
  });
}

function clipList(previewPlan: CurrentProjectPreviewPlanInput | undefined): CurrentProjectPreviewPlanClipInput[] {
  const raw = Array.isArray(previewPlan?.clips) && previewPlan.clips.length ? previewPlan.clips : previewPlan?.events;
  return (raw || []).map(asClip).filter((clip): clip is CurrentProjectPreviewPlanClipInput => Boolean(clip));
}

function relayItemStatusForPreview(item: VideoRelayQueueItem) {
  if (item.status === "success") return "needs_review";
  if (item.status === "submitting") return "submitted";
  if (item.status === "running") return "generating";
  if (item.status === "polling") return "queued";
  if (item.status === "recoverable_queued") return "queued";
  return item.status;
}

function relayItemHasPreviewValue(item: VideoRelayQueueItem) {
  return item.status === "submitting"
    || item.status === "submitted"
    || item.status === "queued"
    || item.status === "running"
    || item.status === "generating"
    || item.status === "polling"
    || item.status === "recoverable_queued"
    || item.status === "success"
    || item.status === "failed"
    || item.status === "blocked";
}

function relayQueuePreviewItems(relayQueue: VideoRelayQueueState | undefined): CurrentProjectPreviewItemInput[] {
  if (!relayQueue) return [];
  return relayQueue.items
    .filter(relayItemHasPreviewValue)
    .map((item, index) => {
      const localVideoPath = item.outputVideoPath || item.localMediaPaths?.find(mediaLooksVideo);
      return {
        id: `relay_${item.id}`,
        shotId: item.shotId,
        order: index + 1,
        mediaType: "video",
        mediaPath: localVideoPath,
        outputVideoPath: item.outputVideoPath,
        localMediaPaths: item.localMediaPaths,
        status: relayItemStatusForPreview(item),
        videoStatus: relayItemStatusForPreview(item),
        submitId: item.submitId,
        queueInfo: item.queueInfo,
        queuePosition: item.queuePosition,
        attemptCount: item.attemptCount,
        promptPath: item.promptPath,
        referencePaths: item.referencePaths,
        durationSeconds: item.durationSeconds,
        reviewRequired: item.status === "success",
        outputExists: item.status === "success" && Boolean(localVideoPath),
        blockers: item.blockers,
        recoverable: item.status === "recoverable_queued" || item.status === "polling",
      };
    });
}

function mergeRuntimePreviewItems(
  normalized: CurrentProjectPreviewItemInput[],
  relayItems: CurrentProjectPreviewItemInput[],
) {
  if (!relayItems.length) return normalized;
  if (!normalized.length) return relayItems;
  const consumedRelayIds = new Set<string>();
  const relayByShotId = byShotId(relayItems);
  const merged = normalized.map((item) => {
    const relay = item.shotId ? relayByShotId.get(item.shotId) : undefined;
    if (!relay) return item;
    consumedRelayIds.add(relay.id || relay.shotId || "");
    return {
      ...item,
      ...relay,
      id: item.id || relay.id,
      order: item.order ?? relay.order,
      status: item.reviewRequired === false ? item.status : relay.status,
      videoStatus: relay.videoStatus || item.videoStatus,
      reviewRequired: item.reviewRequired === false ? false : relay.reviewRequired,
      reviewOverlay: item.reviewRequired === false ? false : relay.reviewOverlay,
      previewQaStatus: item.reviewRequired === false ? item.previewQaStatus : relay.previewQaStatus,
      productionQaStatus: item.reviewRequired === false ? item.productionQaStatus : relay.productionQaStatus,
      sourceReceiptId: item.sourceReceiptId,
      providerReceiptId: item.providerReceiptId,
      providerRequestId: item.providerRequestId,
      outputHash: item.outputHash,
      outputSha256: item.outputSha256,
      promptText: item.promptText,
      promptPath: item.promptPath || relay.promptPath,
      referencePaths: item.referencePaths?.length ? item.referencePaths : relay.referencePaths,
      promptHash: item.promptHash || relay.promptHash,
    };
  });
  return [
    ...merged,
    ...relayItems.filter((item) => !consumedRelayIds.has(item.id || item.shotId || "")),
  ];
}

function oneShotPreviewItem(oneShot: ProjectImage2OneShotStatus | undefined): CurrentProjectPreviewItemInput | undefined {
  if (
    !oneShot?.selectedShotId
    || !oneShot.outputExists
    || !oneShot.imageUrl
    || !oneShot.outputSha256
    || !oneShot.hashBoundActual
    || !oneShot.providerReturnIngested
    || (oneShot.uiStatus !== "needs_review" && oneShot.uiStatus !== "verified")
  ) return undefined;
  const sourceReceiptId = stringValue(oneShot.sourceReceiptId)
    || stringValue(oneShot.receipt?.receiptId)
    || stringValue(oneShot.submitPermissionReceipt?.permissionReceiptId)
    || stringValue(oneShot.providerRequestId);
  const verified = oneShot.uiStatus === "verified";
  return {
    id: `p6_one_shot_${oneShot.selectedShotId}`,
    shotId: oneShot.selectedShotId,
    mediaType: "image",
    imageUrl: oneShot.imageUrl,
    expectedOutputPath: oneShot.expectedOutputPath,
    sourceReceiptId,
    providerReceiptId: stringValue(oneShot.submitPermissionReceipt?.permissionReceiptId),
    providerRequestId: oneShot.providerRequestId,
    outputHash: oneShot.outputSha256,
    outputSha256: oneShot.outputSha256,
    promptText: oneShot.promptText,
    promptPath: oneShot.promptPath,
    promptHash: oneShot.promptSha256,
    referencePaths: oneShot.receipt?.visualReferenceInputs
      ?.map((item) => stringValue(item.path))
      .filter((item): item is string => Boolean(item)),
    status: verified ? "verified" : "needs_review",
    previewStatus: verified ? "verified" : "needs_review",
    previewQaStatus: verified ? "verified" : "needs_review",
    productionQaStatus: verified ? "verified" : "needs_review",
    reviewRequired: !verified,
    outputExists: true,
    blockers: [],
  };
}

function mergeOneShotPreviewItem(
  items: CurrentProjectPreviewItemInput[],
  oneShot: ProjectImage2OneShotStatus | undefined,
) {
  const candidate = oneShotPreviewItem(oneShot);
  if (!candidate) return items;
  const matchIndex = items.findIndex((item) => {
    if (item.shotId !== candidate.shotId) return false;
    const mediaPath = item.mediaPath || item.outputVideoPath || item.videoPath || item.videoUrl || item.imageUrl;
    return !String(item.mediaType || "").toLowerCase().includes("video")
      && !item.videoStatus
      && !mediaLooksVideo(mediaPath);
  });
  if (matchIndex < 0) return [...items, candidate];
  return items.map((item, index) => index === matchIndex
    ? {
        ...item,
        ...candidate,
        order: item.order ?? candidate.order,
        durationSeconds: item.durationSeconds ?? candidate.durationSeconds,
      }
    : item);
}

function previewItemList(
  summary: CurrentProjectPreviewSummaryInput | undefined,
  previewItems: CurrentProjectPreviewItemInput[] | undefined,
  clips: CurrentProjectPreviewPlanClipInput[],
  relayQueue: VideoRelayQueueState | undefined,
  oneShot: ProjectImage2OneShotStatus | undefined,
): CurrentProjectPreviewItemInput[] {
  const explicit = previewItems?.length ? previewItems : summary?.previewItems;
  const normalized = (explicit || []).map(asPreviewItem).filter((item): item is CurrentProjectPreviewItemInput => Boolean(item));
  const relayItems = relayQueuePreviewItems(relayQueue);
  const baseItems = normalized.length
    ? mergeRuntimePreviewItems(normalized, relayItems)
    : relayItems.length
      ? relayItems
      : clips
        .filter((clip) => Boolean(clip.shotId))
        .map((clip) => ({
      id: clip.id || clip.clipId,
      shotId: clip.shotId,
      order: clip.order,
      mediaPath: clip.mediaPath,
      imageUrl: clip.imageUrl,
      fileUrl: clip.fileUrl,
      status: clip.status,
      sourceReceiptId: clip.sourceReceiptId,
      providerReceiptId: clip.providerReceiptId,
      providerRequestId: clip.providerRequestId,
      outputHash: clip.outputHash,
      outputSha256: clip.outputSha256,
      providerOutputSha256: clip.providerOutputSha256,
      previewQaStatus: clip.previewQaStatus,
      productionQaStatus: clip.productionQaStatus,
        }));
  return mergeOneShotPreviewItem(baseItems, oneShot);
}

function byShotId<T extends { shotId?: string }>(items: T[]) {
  const map = new Map<string, T>();
  for (const item of items) {
    const shotId = stringValue(item.shotId);
    if (shotId && !map.has(shotId)) map.set(shotId, item);
  }
  return map;
}

function sortedItems(items: CurrentProjectPreviewItemInput[]) {
  return [...items].sort((left, right) => {
    const leftOrder = numberValue(left.order) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = numberValue(right.order) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return items.indexOf(left) - items.indexOf(right);
  });
}

function reviewShotSet(summary: CurrentProjectPreviewSummaryInput | undefined) {
  return new Set([
    ...stringArray(summary?.reviewShotIds),
    ...stringArray(summary?.needsReviewShotIds),
    ...stringArray(summary?.reviewOverlayShots),
  ]);
}

function itemReviewRequired(item: CurrentProjectPreviewItemInput, clip: CurrentProjectPreviewPlanClipInput | undefined, reviewShots: Set<string>) {
  if (item.reviewRequired === false) return false;
  const shotId = stringValue(item.shotId);
  return item.reviewRequired === true
    || item.reviewOverlay === true
    || (shotId ? reviewShots.has(shotId) : false)
    || statusMatches(item.previewQaStatus, /review/)
    || statusMatches(item.productionQaStatus, /review/)
    || statusMatches(clip?.previewQaStatus, /review/)
    || statusMatches(clip?.productionQaStatus, /review/);
}

function itemBlocked(item: CurrentProjectPreviewItemInput, status: string, clip: CurrentProjectPreviewPlanClipInput | undefined) {
  return item.blockers?.length
    ? true
    : statusMatches(status, /blocked|missing|failed|unavailable/)
      || statusMatches(clip?.status, /blocked|missing|failed|unavailable/)
      || statusLooksLikeSelfReport(status)
      || statusLooksLikeSelfReport(clip?.status);
}

function itemReturned(item: CurrentProjectPreviewItemInput, status: string, mediaPath: string | undefined) {
  if (itemBlocked(item, status, undefined) || statusLooksLikeSelfReport(status)) return false;
  if (item.outputExists === true) return statusLooksPreviewEligible(status);
  if (item.outputExists === false) return false;
  if (item.imageUrl || item.fileUrl || item.thumbnailUrl) return statusLooksPreviewEligible(status);
  return Boolean(mediaPath) && statusLooksPreviewEligible(status);
}

export function buildCurrentProjectPreviewProjection(
  input: BuildCurrentProjectPreviewProjectionInput,
): CurrentProjectPreviewProjection {
  const summary = input.summary;
  const clips = clipList(input.previewPlan);
  const clipsByShotId = byShotId(clips.filter((clip) => Boolean(clipId(clip))));
  const reviewShots = reviewShotSet(summary);
  let startSeconds = 0;

  const items = sortedItems(previewItemList(summary, input.previewItems, clips, input.relayQueue, input.oneShot)).map((item, index): CurrentProjectPreviewQueueItem => {
    const shotId = stringValue(item.shotId);
    const clip = shotId ? clipsByShotId.get(shotId) : undefined;
    const status = normalizeStatus(item.status, item.previewStatus, item.runtimeTruthStatus, clip?.status);
    const mediaPath = itemMediaPath(item, clip);
    const blocked = itemBlocked(item, status, clip);
    const reviewRequired = itemReviewRequired(item, clip, reviewShots);
    const durationSeconds = safeDuration(item.durationSeconds)
      ?? safeDuration(item.duration_seconds)
      ?? safeDuration(item.duration)
      ?? clipDuration(clip);
    const kind = itemKind(blocked, mediaPath, item, clip);
    const videoGeneration = itemVideoGeneration(item, clip, status, mediaPath);
    const queueItem: CurrentProjectPreviewQueueItem = {
      id: stringValue(item.id) || stringValue(clip?.id) || stringValue(clip?.clipId) || `current_project_preview_${shotId || index + 1}`,
      kind,
      shotId,
      startSeconds,
      durationSeconds,
      mediaPath: kind === "missing_placeholder" ? undefined : mediaPath,
      label: itemLabel(shotId, index),
      source: currentProjectPreviewProjectionSource,
      order: numberValue(item.order) ?? numberValue(clip?.order) ?? index + 1,
      status,
      sourceReceiptId: stringValue(item.sourceReceiptId) || stringValue(item.providerReceiptId) || stringValue(item.providerRequestId) || stringValue(clip?.sourceReceiptId) || stringValue(clip?.providerReceiptId) || stringValue(clip?.providerRequestId),
      providerReceiptId: stringValue(item.providerReceiptId) || stringValue(clip?.providerReceiptId),
      providerRequestId: stringValue(item.providerRequestId) || stringValue(clip?.providerRequestId),
      outputHash: stringValue(item.outputHash) || stringValue(item.outputSha256) || stringValue(item.providerOutputSha256) || stringValue(clip?.outputHash) || stringValue(clip?.outputSha256) || stringValue(clip?.providerOutputSha256),
      outputSha256: stringValue(item.outputSha256) || stringValue(item.providerOutputSha256) || stringValue(clip?.outputSha256) || stringValue(clip?.providerOutputSha256),
      promptText: stringValue(item.promptText),
      promptPath: stringValue(item.promptPath),
      referencePaths: Array.isArray(item.referencePaths) ? item.referencePaths : undefined,
      promptHash: stringValue(item.promptHash),
      previewStatus: item.previewStatus || clip?.status,
      runtimeTruthStatus: item.runtimeTruthStatus,
      previewQaStatus: item.previewQaStatus || clip?.previewQaStatus,
      productionQaStatus: item.productionQaStatus || clip?.productionQaStatus,
      reviewRequired,
      blocked,
      returned: itemReturned(item, status, mediaPath),
      blockers: item.blockers || [],
      videoGeneration,
    };
    startSeconds += durationSeconds;
    return queueItem;
  });

  const totalDurationSeconds = items.reduce((max, item) => Math.max(max, item.startSeconds + item.durationSeconds), 0);
  const blockedCount = items.filter((item) => item.blocked).length;
  const reviewCount = items.filter((item) => item.reviewRequired).length;
  const returnedCount = items.filter((item) => item.returned).length;

  return {
    schemaVersion: currentProjectPreviewProjectionSchemaVersion,
    source: currentProjectPreviewProjectionSource,
    available: items.length > 0 && summary?.status !== "unbound",
    projectId: input.projectId || summary?.projectId,
    projectRoot: input.projectRoot || summary?.projectRoot,
    generatedAt: input.generatedAt || summary?.generatedAt,
    previewStatus: summary?.previewStatus || input.previewPlan?.previewStatus,
    productionStatus: summary?.productionStatus || input.previewPlan?.productionStatus,
    items,
    queue: items,
    totalDurationSeconds,
    blockedCount,
    reviewCount,
    returnedCount,
    missingCount: items.length - returnedCount,
    providerCalled: false,
    liveSubmitAllowed: false,
    workerSpawnForbidden: true,
  };
}
