import type { AssetLibrarySnapshot } from "./assetLibraryCrud";
import type { PreviewQueueItem } from "./previewPlayerQueue";
import type { ProjectTransactionRuntimeState, ProjectTransactionUserStatus } from "./projectTransaction";
import type { TaskRunLedgerProjection, TaskRunLedgerStatus } from "./taskRunLedger";

export const minimalRuntimeProjectionSchemaVersion = "0.1.0";

export type MinimalRuntimeDotTone = "idle" | "active" | "review" | "blocked" | "done";

export interface MinimalRuntimeProgressDot {
  id: "confirm" | "plan" | "review" | "preview";
  label: string;
  tone: MinimalRuntimeDotTone;
}

export interface MinimalRuntimeCounts {
  queued: number;
  parked: number;
  blocked: number;
  stale: number;
}

export interface MinimalRuntimePreviewSummary {
  shortLabel: string;
  detail: string;
  total: number;
  imageHoldCount: number;
  videoClipCount: number;
  missingPlaceholderCount: number;
  qaPendingCount: number;
  needsReviewCount: number;
}

export interface MinimalRuntimeAssetSummary {
  shortLabel: string;
  detail: string;
  locked: number;
  candidate: number;
  needsReview: number;
  rejected: number;
}

export interface MinimalRuntimeProjection {
  schemaVersion: typeof minimalRuntimeProjectionSchemaVersion;
  generatedAt: string;
  shortLabel: string;
  progressDots: MinimalRuntimeProgressDot[];
  counts: MinimalRuntimeCounts;
  countSummary: string;
  staleSummary: string;
  previewSummary: MinimalRuntimePreviewSummary;
  assetSummary: MinimalRuntimeAssetSummary;
}

export interface BuildMinimalRuntimeProjectionInput {
  generatedAt?: string;
  transactionRuntime?: ProjectTransactionRuntimeState;
  previewQueue?: PreviewQueueItem[];
  assetLibrary?: Pick<AssetLibrarySnapshot, "assets">;
  ledgerProjections?: MinimalLedgerProjectionLike[];
}

export type MinimalLedgerProjectionLike =
  | TaskRunLedgerProjection
  | {
    currentStatus?: string;
    previewStatus?: string;
    completeVerified?: boolean;
    previewSummary?: {
      status?: string;
    };
  };

const defaultTimestamp = "1970-01-01T00:00:00.000Z";

function clampCount(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, value || 0) : 0;
}

function statusShortLabel(status?: ProjectTransactionUserStatus) {
  const labels: Record<ProjectTransactionUserStatus, string> = {
    waiting_confirmation: "等待确认",
    pending_project_facts: "等待确认",
    queued: "已加入计划",
    parked: "等待复核",
    blocked_missing_knowledge_trace: "需要补充资料",
    blocked: "需要处理",
  };
  return status ? labels[status] : undefined;
}

function ledgerCount(projections: MinimalLedgerProjectionLike[] | undefined, statuses: TaskRunLedgerStatus[]) {
  if (!projections?.length) return 0;
  const statusSet = new Set(statuses);
  return projections.filter((projection) => statusSet.has(projection.currentStatus as TaskRunLedgerStatus)).length;
}

function ledgerPreviewStatus(projection: MinimalLedgerProjectionLike) {
  const compact = projection as { previewStatus?: string; previewSummary?: { status?: string } };
  return compact.previewStatus || compact.previewSummary?.status;
}

function buildCounts(input: BuildMinimalRuntimeProjectionInput): MinimalRuntimeCounts {
  const nextUi = input.transactionRuntime?.nextUiProjection;
  const summary = input.transactionRuntime?.queueIngestSummary;
  const ledgerQueued = ledgerCount(input.ledgerProjections, ["queued", "leased", "running", "waiting_output"]);
  const ledgerParked = ledgerCount(input.ledgerProjections, ["parked"]);
  const ledgerBlocked = ledgerCount(input.ledgerProjections, ["failed", "stalled", "interrupted"]);
  const staleArtifacts = input.transactionRuntime?.pendingTransaction.artifactInvalidation.staleArtifacts.length;

  return {
    queued: clampCount(nextUi?.queuedCount ?? summary?.queued ?? ledgerQueued),
    parked: clampCount(nextUi?.parkedCount ?? summary?.parked ?? ledgerParked),
    blocked: clampCount(nextUi?.blockedCount ?? summary?.blocked ?? ledgerBlocked),
    stale: clampCount(nextUi?.staleArtifactCount ?? staleArtifacts),
  };
}

function buildPreviewSummary(
  queue: PreviewQueueItem[] | undefined,
  ledgerProjections: MinimalLedgerProjectionLike[] | undefined,
): MinimalRuntimePreviewSummary {
  const items = queue || [];
  const imageHoldCount = items.filter((item) => item.kind === "image_hold").length;
  const videoClipCount = items.filter((item) => item.kind === "video_clip").length;
  const missingPlaceholderCount = items.filter((item) => item.kind === "missing_placeholder").length;
  const qaPendingCount = ledgerProjections?.filter((item) => ledgerPreviewStatus(item) === "qa_pending").length || 0;
  const needsReviewCount = ledgerProjections?.filter((item) => ledgerPreviewStatus(item) === "needs_review").length || 0;
  const returned = imageHoldCount + videoClipCount;
  const returnedUnit = videoClipCount > 0 ? "段已返回" : "张已返回";
  const detail = [
    returned ? `${returned} ${returnedUnit}` : "",
    qaPendingCount ? `${qaPendingCount} 段等复核` : "",
    needsReviewCount ? `${needsReviewCount} 段需复核` : "",
    missingPlaceholderCount ? `${missingPlaceholderCount} 段待补齐` : "",
  ].filter(Boolean).join("，") || "等待素材";

  return {
    shortLabel: items.length ? `预览 ${items.length} 段` : "暂无预览",
    detail,
    total: items.length,
    imageHoldCount,
    videoClipCount,
    missingPlaceholderCount,
    qaPendingCount,
    needsReviewCount,
  };
}

function buildAssetSummary(assetLibrary: Pick<AssetLibrarySnapshot, "assets"> | undefined): MinimalRuntimeAssetSummary {
  const assets = assetLibrary?.assets || [];
  const locked = assets.filter((asset) => asset.status === "locked").length;
  const candidate = assets.filter((asset) => asset.status === "candidate").length;
  const needsReview = assets.filter((asset) => asset.status === "review" || asset.status === "missing").length;
  const rejected = assets.filter((asset) => asset.status === "rejected").length;

  return {
    shortLabel: locked ? `${locked} 个已锁定` : "审核并锁定资产",
    detail: `${locked} locked · ${candidate} candidate · ${needsReview} review · ${rejected} rejected`,
    locked,
    candidate,
    needsReview,
    rejected,
  };
}

function countSummary(counts: MinimalRuntimeCounts) {
  const parts = [
    counts.queued ? `${counts.queued} 已加入计划` : "",
    counts.parked ? `${counts.parked} 等待复核` : "",
    counts.blocked ? `${counts.blocked} 需要处理` : "",
    counts.stale ? `${counts.stale} 需更新` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "等待确认";
}

function buildProgressDots(
  status: ProjectTransactionUserStatus | undefined,
  counts: MinimalRuntimeCounts,
  preview: MinimalRuntimePreviewSummary,
): MinimalRuntimeProgressDot[] {
  const hasPlanned = counts.queued + counts.parked > 0;
  const hasReview = counts.parked + counts.stale + preview.qaPendingCount + preview.needsReviewCount > 0;
  const hasBlocked = counts.blocked > 0 || status === "blocked" || status === "blocked_missing_knowledge_trace";
  return [
    {
      id: "confirm",
      label: "确认",
      tone: status === "waiting_confirmation" || !status ? "active" : hasBlocked ? "blocked" : "done",
    },
    {
      id: "plan",
      label: "计划",
      tone: hasBlocked ? "blocked" : hasPlanned ? "done" : status === "queued" ? "active" : "idle",
    },
    {
      id: "review",
      label: "复核",
      tone: hasBlocked ? "blocked" : hasReview ? "review" : "idle",
    },
    {
      id: "preview",
      label: "预览",
      tone: preview.total ? "done" : "idle",
    },
  ];
}

export function buildMinimalRuntimeProjection(input: BuildMinimalRuntimeProjectionInput): MinimalRuntimeProjection {
  const counts = buildCounts(input);
  const previewSummary = buildPreviewSummary(input.previewQueue, input.ledgerProjections);
  const assetSummary = buildAssetSummary(input.assetLibrary);
  const status = input.transactionRuntime?.nextUiProjection.status || input.transactionRuntime?.userStatus;
  const statusLabel = statusShortLabel(status);
  const countLabel = countSummary(counts);
  const shortLabel = statusLabel || (previewSummary.total ? previewSummary.shortLabel : assetSummary.shortLabel);

  return {
    schemaVersion: minimalRuntimeProjectionSchemaVersion,
    generatedAt: input.generatedAt || input.transactionRuntime?.generatedAt || defaultTimestamp,
    shortLabel,
    progressDots: buildProgressDots(status, counts, previewSummary),
    counts,
    countSummary: countLabel,
    staleSummary: counts.stale ? `${counts.stale} 个画面需更新` : "画面保持同步",
    previewSummary,
    assetSummary,
  };
}
