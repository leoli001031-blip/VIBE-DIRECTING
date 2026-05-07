declare global {
  interface Window {
    __VIBE_RUNTIME_API_BASE_URL__?: string;
  }

  interface ImportMeta {
    env?: {
      VITE_VIBE_RUNTIME_API_BASE_URL?: string;
    };
  }
}

export const defaultRuntimeApiBaseUrl = "http://127.0.0.1:8790";
export const projectRealChainRuntimeBasePath = "/api/runtime";
export const projectRealChainStatusEndpoint = `${projectRealChainRuntimeBasePath}/projects/current/real-chain/status`;
export const projectRealChainRunCheckEndpoint = `${projectRealChainRuntimeBasePath}/projects/current/real-chain/run-check`;
export const projectRealChainFileEndpoint = `${projectRealChainRuntimeBasePath}/files`;
export const projectRealChainReportRelativePath =
  "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/reports/image2_start_long_chain_report.json";
export const projectRealChainFallbackReportUrl = `/${projectRealChainReportRelativePath}`;

export type ProjectRealChainUiStatus =
  | "running"
  | "preview_ready_with_review"
  | "production_needs_review"
  | "blocked"
  | "unavailable";

export type ProjectRealChainSource = "runtime_endpoint" | "fallback_report";

export type ProjectRealChainPreviewItem = {
  id: string;
  shotId: string;
  order: number;
  expectedOutputPath?: string;
  expectedOutputAbsPath?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  reviewRequired: boolean;
  reviewOverlay: boolean;
  previewQaStatus?: string;
  productionQaStatus?: string;
};

export type ProjectRealChainStatus = {
  uiStatus: ProjectRealChainUiStatus;
  schemaVersion?: string;
  source?: ProjectRealChainSource | string;
  projectionSource?: string;
  sourceLabel?: string;
  sandboxSource?: string;
  projectRootMode?: string;
  endpoint?: string;
  runtimeEndpoint?: string;
  generatedAt?: string;
  projectId?: string;
  runId?: string;
  projectSchemaVersion?: string;
  projectRoot?: string;
  projectVibePath?: string;
  previewStatus: string;
  previewStatusLabel: string;
  productionStatus: string;
  returnedImageCount: number;
  totalPlannedImages: number;
  needsReviewCount: number;
  reviewShotIds: string[];
  previewItems: ProjectRealChainPreviewItem[];
  previewThumbnails: ProjectRealChainPreviewItem[];
  reportPath: string;
  reportUrl: string;
  providerCalled: boolean;
  prepareRan: boolean;
  message?: string;
};

export type ProjectRealChainUiState = {
  status: ProjectRealChainUiStatus;
  summary?: ProjectRealChainStatus;
  message?: string;
};

type ProjectRealChainPayload = {
  schemaVersion?: string;
  source?: string;
  projectionSource?: string;
  sourceLabel?: string;
  sandboxSource?: string;
  projectRootMode?: string;
  endpoint?: string;
  runtimeEndpoint?: string;
  generatedAt?: string;
  projectId?: string;
  runId?: string;
  projectSchemaVersion?: string;
  projectRoot?: string;
  projectVibePath?: string;
  project?: {
    projectId?: string;
    runId?: string;
    schemaVersion?: string;
    projectRoot?: string;
    projectVibePath?: string;
  };
  status?: string;
  previewStatus?: string;
  previewStatusLabel?: string;
  productionStatus?: string;
  returnedImageCount?: number;
  plannedImageCount?: number;
  totalPlannedImages?: number;
  needsReviewCount?: number;
  reviewShotIds?: string[];
  reviewOverlayShots?: string[];
  productionNeedsReviewShots?: string[];
  shotCount?: number;
  reportPath?: string;
  reportRelativePath?: string;
  reportUrl?: string;
  providerCalled?: boolean;
  prepareRan?: boolean;
  previewItems?: ProjectRealChainPreviewItem[];
  previewThumbnails?: ProjectRealChainPreviewItem[];
  observations?: Array<{
    id?: string;
    order?: number;
    shotId?: string;
    expectedOutputPath?: string;
    expectedOutputAbsPath?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    reviewRequired?: boolean;
    reviewOverlay?: boolean;
    previewQaStatus?: string;
    productionQaStatus?: string;
    blockers?: string[];
  }>;
  blockers?: string[];
  message?: string;
  report?: unknown;
  result?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function payloadFromUnknown(payload: unknown): ProjectRealChainPayload | undefined {
  if (!isRecord(payload)) return undefined;
  if (typeof payload.previewStatus === "string" || Array.isArray(payload.previewItems) || Array.isArray(payload.observations)) {
    return payload as ProjectRealChainPayload;
  }
  if (isRecord(payload.report)) return { ...(payload.report as ProjectRealChainPayload), ...payload } as ProjectRealChainPayload;
  if (isRecord(payload.result)) return { ...(payload.result as ProjectRealChainPayload), ...payload } as ProjectRealChainPayload;
  return undefined;
}

function runtimeApiBaseUrl() {
  if (typeof window === "undefined") return "";
  const configured = window.__VIBE_RUNTIME_API_BASE_URL__ || import.meta.env?.VITE_VIBE_RUNTIME_API_BASE_URL || "";
  return configured.replace(/\/+$/, "");
}

function toRuntimeUrl(path: string) {
  if (/^(?:https?:|data:|blob:)/.test(path)) return path;
  const baseUrl = runtimeApiBaseUrl();
  if (!baseUrl) return path;
  return path.startsWith("/") ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
}

function toRuntimeFileUrl(path: string) {
  return toRuntimeUrl(`${projectRealChainFileEndpoint}?path=${encodeURIComponent(path)}`);
}

function humanPreviewStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("preview_ready_with_review")) return "ready with review";
  if (normalized.includes("preview_ready") || normalized === "ready") return "ready";
  if (normalized.includes("blocked")) return "blocked";
  if (normalized.includes("unavailable")) return "unavailable";
  return status || "unavailable";
}

function deriveUiStatus(payload: ProjectRealChainPayload): ProjectRealChainUiStatus {
  const raw = [payload.status, payload.previewStatus, payload.productionStatus].filter(Boolean).join(" ").toLowerCase();
  const blockers = stringArray(payload.blockers);
  if (blockers.length || raw.includes("blocked") || raw.includes("fail")) return "blocked";
  if (payload.productionStatus === "needs_review" || stringArray(payload.productionNeedsReviewShots).length) {
    return "production_needs_review";
  }
  if (raw.includes("preview_ready_with_review") || stringArray(payload.reviewOverlayShots).length || stringArray(payload.reviewShotIds).length) {
    return "preview_ready_with_review";
  }
  return "unavailable";
}

function previewItemFromObservation(
  item: NonNullable<ProjectRealChainPayload["observations"]>[number],
  index: number,
): ProjectRealChainPreviewItem {
  const shotId = item.shotId || item.id || `S${String(index + 1).padStart(2, "0")}`;
  const imageUrl = item.imageUrl
    ? toRuntimeUrl(item.imageUrl)
    : item.expectedOutputPath
      ? toRuntimeFileUrl(item.expectedOutputPath)
      : undefined;
  const reviewRequired = item.reviewRequired === true || item.reviewOverlay === true || item.productionQaStatus === "needs_review";
  return {
    id: item.id || shotId,
    shotId,
    order: typeof item.order === "number" ? item.order : index + 1,
    expectedOutputPath: item.expectedOutputPath,
    expectedOutputAbsPath: item.expectedOutputAbsPath,
    imageUrl,
    thumbnailUrl: item.thumbnailUrl ? toRuntimeUrl(item.thumbnailUrl) : imageUrl,
    reviewRequired,
    reviewOverlay: item.reviewOverlay === true,
    previewQaStatus: item.previewQaStatus,
    productionQaStatus: item.productionQaStatus,
  };
}

function normalizePreviewItem(item: ProjectRealChainPreviewItem, index: number): ProjectRealChainPreviewItem {
  const shotId = item.shotId || item.id || `S${String(index + 1).padStart(2, "0")}`;
  const imageUrl = item.imageUrl
    ? toRuntimeUrl(item.imageUrl)
    : item.expectedOutputPath
      ? toRuntimeFileUrl(item.expectedOutputPath)
      : undefined;
  const thumbnailUrl = item.thumbnailUrl ? toRuntimeUrl(item.thumbnailUrl) : imageUrl;
  return {
    ...item,
    id: item.id || shotId,
    shotId,
    order: typeof item.order === "number" ? item.order : index + 1,
    imageUrl,
    thumbnailUrl,
    reviewRequired: item.reviewRequired === true || item.reviewOverlay === true || item.productionQaStatus === "needs_review",
    reviewOverlay: item.reviewOverlay === true,
  };
}

function deriveReviewShotIds(payload: ProjectRealChainPayload, previewItems: ProjectRealChainPreviewItem[]) {
  const explicit = stringArray(payload.reviewShotIds);
  if (explicit.length) return explicit;
  const reviewOverlay = stringArray(payload.reviewOverlayShots);
  if (reviewOverlay.length) return reviewOverlay;
  const productionNeedsReview = stringArray(payload.productionNeedsReviewShots);
  if (productionNeedsReview.length) return productionNeedsReview;
  return previewItems.filter((item) => item.reviewRequired).map((item) => item.shotId);
}

export function deriveProjectRealChainStatus(
  payload: unknown,
  source: ProjectRealChainSource,
): ProjectRealChainStatus {
  const report = payloadFromUnknown(payload);
  if (!report) {
    return {
      uiStatus: "unavailable",
      source,
      previewStatus: "unavailable",
      previewStatusLabel: "unavailable",
      productionStatus: "unavailable",
      returnedImageCount: 0,
      totalPlannedImages: 0,
      needsReviewCount: 0,
      reviewShotIds: [],
      previewItems: [],
      previewThumbnails: [],
      reportPath: projectRealChainReportRelativePath,
      reportUrl: projectRealChainFallbackReportUrl,
      providerCalled: false,
      prepareRan: false,
      message: "Project real-chain status shape was not recognized.",
    };
  }

  const reportRelativePath = report.reportRelativePath || projectRealChainReportRelativePath;
  const reportPath = report.reportRelativePath || report.reportPath || projectRealChainReportRelativePath;
  const reportUrl = report.reportUrl ? toRuntimeUrl(report.reportUrl) : toRuntimeFileUrl(reportRelativePath);
  const previewItems = Array.isArray(report.previewItems) && report.previewItems.length
    ? report.previewItems.map(normalizePreviewItem)
    : (report.observations || [])
      .filter((item) => typeof item.shotId === "string" || typeof item.id === "string")
      .map(previewItemFromObservation);
  const previewThumbnails = Array.isArray(report.previewThumbnails) && report.previewThumbnails.length
    ? report.previewThumbnails.map(normalizePreviewItem)
    : previewItems;
  const reviewShotIds = deriveReviewShotIds(report, previewItems);
  const previewStatus = report.previewStatus || report.status || "unavailable";
  const totalPlannedImages = numberOrUndefined(report.totalPlannedImages)
    ?? numberOrUndefined(report.plannedImageCount)
    ?? numberOrUndefined(report.shotCount)
    ?? previewItems.length;
  const returnedImageCount = numberOrUndefined(report.returnedImageCount) ?? previewItems.filter((item) => item.imageUrl || item.expectedOutputPath).length;
  const project = report.project || {};

  return {
    uiStatus: deriveUiStatus({ ...report, reviewShotIds }),
    schemaVersion: report.schemaVersion,
    source: report.source || source,
    projectionSource: report.projectionSource,
    sourceLabel: report.sourceLabel,
    sandboxSource: report.sandboxSource,
    projectRootMode: report.projectRootMode,
    endpoint: report.endpoint,
    runtimeEndpoint: report.runtimeEndpoint,
    generatedAt: report.generatedAt,
    projectId: project.projectId || report.projectId,
    runId: project.runId || report.runId,
    projectSchemaVersion: project.schemaVersion || report.projectSchemaVersion,
    projectRoot: project.projectRoot || report.projectRoot,
    projectVibePath: project.projectVibePath || report.projectVibePath,
    previewStatus,
    previewStatusLabel: report.previewStatusLabel || humanPreviewStatus(previewStatus),
    productionStatus: report.productionStatus || "unavailable",
    returnedImageCount,
    totalPlannedImages,
    needsReviewCount: numberOrUndefined(report.needsReviewCount) ?? reviewShotIds.length,
    reviewShotIds,
    previewItems,
    previewThumbnails,
    reportPath,
    reportUrl,
    providerCalled: report.providerCalled === true,
    prepareRan: report.prepareRan === true,
    message: report.message,
  };
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(toRuntimeUrl(url), init);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

function isRuntimeEndpointPath(url: string) {
  return url.startsWith(projectRealChainRuntimeBasePath);
}

async function fetchRuntimeJson(url: string, init?: RequestInit): Promise<unknown> {
  try {
    return await fetchJson(url, init);
  } catch (error) {
    if (runtimeApiBaseUrl() || !isRuntimeEndpointPath(url)) throw error;
    const response = await fetch(`${defaultRuntimeApiBaseUrl}${url}`, init);
    if (!response.ok) throw new Error(`${defaultRuntimeApiBaseUrl}${url} returned ${response.status}`);
    return response.json() as Promise<unknown>;
  }
}

async function fallbackToReport(message: string): Promise<ProjectRealChainUiState> {
  try {
    const payload = await fetchJson(projectRealChainFallbackReportUrl);
    const summary = deriveProjectRealChainStatus(payload, "fallback_report");
    return {
      status: summary.uiStatus,
      summary,
      message,
    };
  } catch (reportError) {
    return {
      status: "unavailable",
      message: reportError instanceof Error ? reportError.message : "Runtime API and fallback report are unavailable.",
    };
  }
}

export async function loadProjectRealChainStatus(): Promise<ProjectRealChainUiState> {
  try {
    const payload = await fetchRuntimeJson(projectRealChainStatusEndpoint);
    const summary = deriveProjectRealChainStatus(payload, "runtime_endpoint");
    return { status: summary.uiStatus, summary };
  } catch (endpointError) {
    return fallbackToReport(
      `Runtime project endpoint unavailable; attempted report fallback. ${endpointError instanceof Error ? endpointError.message : ""}`.trim(),
    );
  }
}

export async function runProjectRealChainCheck(): Promise<ProjectRealChainUiState> {
  try {
    const payload = await fetchRuntimeJson(projectRealChainRunCheckEndpoint, { method: "POST" });
    const summary = deriveProjectRealChainStatus(payload, "runtime_endpoint");
    return { status: summary.uiStatus, summary };
  } catch (endpointError) {
    return fallbackToReport(
      `Runtime project run-check endpoint unavailable; synced report fallback only. ${endpointError instanceof Error ? endpointError.message : ""}`.trim(),
    );
  }
}
