import type {
  CurrentProjectPreviewItemInput,
  CurrentProjectPreviewSummaryInput,
} from "./currentProjectPreviewProjection";

export const p6LiveReportProjectionSchemaVersion = "0.1.0";
export const p6LiveReportProjectionSource = "p6_live_image2_report_projection";

export interface P6LiveReportProjectionItem extends CurrentProjectPreviewItemInput {
  id: string;
  shotId: string;
  order: number;
  status: "verified" | "needs_review" | "missing";
  expectedOutputPath?: string;
  mediaPath?: string;
  outputExists: boolean;
  reviewRequired: boolean;
  reviewOverlay: boolean;
  previewQaStatus: "verified" | "needs_review" | "missing";
  productionQaStatus: "verified" | "needs_review" | "missing";
}

export interface P6LiveReportProjectionEvidence {
  runId?: string;
  reportPath?: string;
  outputRoot?: string;
  providerCalled: boolean;
  runtimeExternalNetworkCallMade: boolean;
  providerRequestStrategy?: string;
  providerSelfReportIgnoredForCompletion: boolean;
  promotionAllowed: boolean;
  outputHashes: string[];
}

export interface P6LiveReportProjection {
  schemaVersion: typeof p6LiveReportProjectionSchemaVersion;
  source: typeof p6LiveReportProjectionSource;
  projectionSource: typeof p6LiveReportProjectionSource;
  sourceLabel: string;
  generatedAt?: string;
  projectId?: string;
  runId?: string;
  projectRoot?: string;
  status: string;
  previewStatus: string;
  previewStatusLabel: string;
  productionStatus: string;
  returnedImageCount: number;
  totalPlannedImages: number;
  needsReviewCount: number;
  reviewShotIds: string[];
  previewItems: P6LiveReportProjectionItem[];
  previewThumbnails: P6LiveReportProjectionItem[];
  reportPath: string;
  reportRelativePath: string;
  providerCalled: boolean;
  prepareRan: false;
  p6Evidence: P6LiveReportProjectionEvidence;
  summary: CurrentProjectPreviewSummaryInput;
}

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

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function unwrapP6Report(payload: unknown): Record<string, unknown> | undefined {
  if (!isRecord(payload)) return undefined;
  if (isRecord(payload.ingest) && (Array.isArray(payload.outputs) || Array.isArray(payload.selectedShotIds))) return payload;
  if (isRecord(payload.report)) return unwrapP6Report(payload.report);
  if (isRecord(payload.result)) return unwrapP6Report(payload.result);
  return undefined;
}

function outputPathFromStatus(status: Record<string, unknown>, previewByShotId: Map<string, Record<string, unknown>>) {
  const shotId = stringValue(status.shotId);
  const preview = shotId ? previewByShotId.get(shotId) : undefined;
  return stringValue(status.outputPath)
    ?? stringValue(status.mediaPath)
    ?? stringValue(status.expectedOutputPath)
    ?? stringValue(preview?.outputPath)
    ?? stringValue(preview?.mediaPath)
    ?? stringValue(preview?.expectedOutputPath);
}

function shaFromStatus(status: Record<string, unknown>, previewByShotId: Map<string, Record<string, unknown>>) {
  const shotId = stringValue(status.shotId);
  const preview = shotId ? previewByShotId.get(shotId) : undefined;
  return stringValue(status.sha256)
    ?? stringValue(status.outputSha256)
    ?? stringValue(preview?.sha256)
    ?? stringValue(preview?.outputSha256);
}

function normalizeP6Status(status: unknown, outputPath?: string): P6LiveReportProjectionItem["status"] {
  const value = String(status || "").toLowerCase();
  if (/missing|failed|blocked|unavailable/.test(value)) return "missing";
  if (/needs[_ -]?review|review/.test(value)) return "needs_review";
  if (/verified|complete[_ -]?verified|success|pass/.test(value)) return "verified";
  return outputPath ? "needs_review" : "missing";
}

function itemFromStatus(
  status: Record<string, unknown>,
  index: number,
  previewByShotId: Map<string, Record<string, unknown>>,
): P6LiveReportProjectionItem {
  const shotId = stringValue(status.shotId) || `P6S${String(index + 1).padStart(2, "0")}`;
  const outputPath = outputPathFromStatus(status, previewByShotId);
  const normalizedStatus = normalizeP6Status(status.status, outputPath);
  const outputExists = normalizedStatus !== "missing" && Boolean(outputPath);
  const reviewRequired = normalizedStatus === "needs_review";
  const blockers = normalizedStatus === "missing" ? ["P6 Image2 return is missing for this shot."] : [];
  return {
    id: `p6_live_${shotId}`,
    shotId,
    order: index + 1,
    mediaPath: outputExists ? outputPath : undefined,
    expectedOutputPath: outputExists ? outputPath : undefined,
    status: normalizedStatus,
    previewStatus: normalizedStatus,
    runtimeTruthStatus: normalizedStatus,
    previewQaStatus: normalizedStatus,
    productionQaStatus: normalizedStatus,
    outputExists,
    reviewRequired,
    reviewOverlay: reviewRequired,
    blockers,
  };
}

function fallbackStatuses(report: Record<string, unknown>, previewItems: Record<string, unknown>[]): Record<string, unknown>[] {
  const outputByShot = new Map(recordArray(report.outputs).map((output) => [stringValue(output.shotId) || "", output]));
  const selectedShotIds = stringArray(report.selectedShotIds);
  const fromOutputs = recordArray(report.outputs).map((output) => ({
    shotId: output.shotId,
    status: "needs_review",
    outputPath: output.outputPath,
    sha256: output.outputSha256,
  }));
  const fromPreview = previewItems.map((item) => ({
    shotId: item.shotId,
    status: item.status,
    outputPath: item.outputPath,
    sha256: item.sha256,
  }));
  const fromSelected = selectedShotIds.map((shotId) => ({
    shotId,
    status: outputByShot.has(shotId) ? "needs_review" : "missing",
    outputPath: stringValue(outputByShot.get(shotId)?.outputPath),
    sha256: stringValue(outputByShot.get(shotId)?.outputSha256),
  }));
  return fromPreview.length ? fromPreview : fromOutputs.length ? fromOutputs : fromSelected;
}

function reportPathFor(report: Record<string, unknown>) {
  const explicit = stringValue(report.reportPath) ?? stringValue(report.reportRelativePath);
  if (explicit) return explicit;
  const outputRoot = stringValue(report.outputRoot);
  return outputRoot ? `${outputRoot.replace(/\/+$/, "")}/report.json` : "test_artifacts/p6-real-image2/report.json";
}

export function deriveP6LiveReportProjection(payload: unknown): P6LiveReportProjection | undefined {
  const report = unwrapP6Report(payload);
  if (!report) return undefined;
  const ingest = isRecord(report.ingest) ? report.ingest : undefined;
  if (!ingest) return undefined;

  const previewRecords = recordArray(ingest.previewItems);
  const previewByShotId = new Map(previewRecords.map((item) => [stringValue(item.shotId) || "", item]));
  const statusRecords = recordArray(ingest.shotStatuses);
  const baseStatuses = statusRecords.length ? statusRecords : fallbackStatuses(report, previewRecords);
  if (!baseStatuses.length) return undefined;

  const previewItems = baseStatuses.map((status, index) => itemFromStatus(status, index, previewByShotId));
  const reviewShotIds = previewItems.filter((item) => item.reviewRequired).map((item) => item.shotId);
  const returnedImageCount = previewItems.filter((item) => item.outputExists).length;
  const needsReviewCount = reviewShotIds.length;
  const selectedShotCount = stringArray(report.selectedShotIds).length || undefined;
  const totalPlannedImages = numberValue(isRecord(ingest.summary) ? ingest.summary.total : undefined)
    ?? numberValue(report.providerRequestedCount)
    ?? selectedShotCount
    ?? previewItems.length;
  const promotionAllowed = Boolean(isRecord(ingest.summary) && ingest.summary.promotionAllowed === true);
  const hasMissing = previewItems.some((item) => item.status === "missing");
  const previewStatus = hasMissing
    ? "blocked"
    : needsReviewCount > 0
      ? "preview_ready_with_review"
      : "ready";
  const productionStatus = promotionAllowed
    ? "ready_for_promotion"
    : needsReviewCount > 0
      ? "needs_review"
      : "qa_pending";
  const reportPath = reportPathFor(report);
  const runId = stringValue(report.runId) ?? stringValue(ingest.runId);
  const generatedAt = stringValue(report.generatedAt) ?? stringValue(ingest.generatedAt);
  const outputHashes = previewItems
    .map((item) => {
      const status = baseStatuses.find((candidate) => stringValue(candidate.shotId) === item.shotId);
      return status ? shaFromStatus(status, previewByShotId) : undefined;
    })
    .filter((hash): hash is string => Boolean(hash));
  const summary: CurrentProjectPreviewSummaryInput = {
    status: stringValue(report.status) ?? stringValue(ingest.status) ?? "return_ingested",
    projectId: stringValue(report.projectId),
    projectRoot: stringValue(report.projectRoot),
    generatedAt,
    previewStatus,
    productionStatus,
    reviewShotIds,
    needsReviewShotIds: reviewShotIds,
    reviewOverlayShots: reviewShotIds,
    previewItems,
  };

  return {
    schemaVersion: p6LiveReportProjectionSchemaVersion,
    source: p6LiveReportProjectionSource,
    projectionSource: p6LiveReportProjectionSource,
    sourceLabel: "P6 live Image2 report",
    generatedAt,
    projectId: stringValue(report.projectId),
    runId,
    projectRoot: stringValue(report.projectRoot),
    status: summary.status || "return_ingested",
    previewStatus,
    previewStatusLabel: needsReviewCount > 0 ? "ready with review" : previewStatus,
    productionStatus,
    returnedImageCount,
    totalPlannedImages,
    needsReviewCount,
    reviewShotIds,
    previewItems,
    previewThumbnails: previewItems,
    reportPath,
    reportRelativePath: reportPath,
    providerCalled: report.providerCalled === true,
    prepareRan: false,
    p6Evidence: {
      runId,
      reportPath,
      outputRoot: stringValue(report.outputRoot),
      providerCalled: report.providerCalled === true,
      runtimeExternalNetworkCallMade: report.runtimeExternalNetworkCallMade === true,
      providerRequestStrategy: stringValue(report.providerRequestStrategy),
      providerSelfReportIgnoredForCompletion: ingest.providerSelfReportIgnoredForCompletion === true,
      promotionAllowed,
      outputHashes,
    },
    summary,
  };
}
