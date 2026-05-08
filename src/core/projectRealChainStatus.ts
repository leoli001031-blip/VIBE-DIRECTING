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
export const projectImage2BatchPlanEndpoint = `${projectRealChainRuntimeBasePath}/projects/current/image2-batch/plan`;
export const projectImage2BatchRunCheckEndpoint = `${projectRealChainRuntimeBasePath}/projects/current/image2-batch/run-check`;
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

export type ProjectImage2BatchUiStatus = "ready_for_review" | "blocked" | "running" | "unavailable";

export type ProjectImage2BatchPlanItem = {
  shotId: string;
  taskRunId?: string;
  packetId?: string;
  envelopeId?: string;
  expectedOutputPath?: string;
  providerObservationPath?: string;
  semanticQaPath?: string;
  promptPath?: string;
  referencePaths: string[];
  queueOrder: number;
  blocked: boolean;
  blockers: string[];
};

export type ProjectImage2BatchLedgerSummary = {
  total: number;
  queued: number;
  blocked: number;
  parked: number;
  completeVerified: number;
  providerSubmissionForbidden: boolean;
  liveSubmitAllowed: boolean;
  noFileMutation: boolean;
  workerSpawnForbidden: boolean;
  providerCalled: boolean;
};

export type ProjectImage2BatchLedgerProjection = {
  taskRunId: string;
  envelopeId?: string;
  currentStatus: string;
  expectedOutputPath?: string;
  expectedOutputs: Array<{ expectedOutputPath?: string; path?: string } | string>;
  previewStatus?: string;
  completeVerified: boolean;
};

export type ProjectImage2BatchPlanStatus = {
  uiStatus: ProjectImage2BatchUiStatus;
  schemaVersion?: string;
  projectionKind?: string;
  sourceLabel?: string;
  sandboxSource?: string;
  projectId?: string;
  runId?: string;
  projectRoot?: string;
  projectVibePath?: string;
  reportPath?: string;
  plannedCount: number;
  readyCount: number;
  blockedCount: number;
  selectedShotIds: string[];
  nextAction: string;
  items: ProjectImage2BatchPlanItem[];
  ledgerSummary?: ProjectImage2BatchLedgerSummary;
  ledgerProjections: ProjectImage2BatchLedgerProjection[];
  queuedCount: number;
  parkedCount: number;
  completeVerifiedCount: number;
  providerSubmissionForbidden: boolean;
  noFileMutation: boolean;
  workerSpawnForbidden: boolean;
  providerCalled: boolean;
  prepareRan: boolean;
  verifyScriptRan: boolean;
  liveSubmitAllowed: boolean;
  message?: string;
};

export type ProjectImage2BatchUiState = {
  status: ProjectImage2BatchUiStatus;
  summary?: ProjectImage2BatchPlanStatus;
  message?: string;
};

export type ProjectRuntimeIdentity = {
  projectId?: string;
  projectRoot?: string;
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

type ProjectImage2BatchPayload = {
  schemaVersion?: string;
  projectionKind?: string;
  sourceLabel?: string;
  sandboxSource?: string;
  project?: {
    projectId?: string;
    runId?: string;
    projectRoot?: string;
    projectVibePath?: string;
  };
  reportPath?: string;
  reportRelativePath?: string;
  providerCalled?: boolean;
  prepareRan?: boolean;
  verifyScriptRan?: boolean;
  liveSubmitAllowed?: boolean;
  items?: Array<{
    shotId?: string;
    taskRunId?: string;
    packetId?: string;
    envelopeId?: string;
    expectedOutputPath?: string;
    providerObservationPath?: string;
    semanticQaPath?: string;
    promptPath?: string;
    referencePaths?: string[];
    queueOrder?: number;
    blocked?: boolean;
    blockers?: string[];
  }>;
  summary?: {
    plannedCount?: number;
    readyCount?: number;
    blockedCount?: number;
    selectedShotIds?: string[];
    nextAction?: string;
  };
  ledgerProjection?: {
    schemaVersion?: string;
    summary?: Record<string, unknown>;
    projections?: Array<Record<string, unknown>>;
  };
  message?: string;
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

function booleanOrUndefined(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeIdentityPart(value?: string) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

function compactUnique(values: string[]) {
  return Array.from(new Set(values.map(normalizeIdentityPart).filter(Boolean)));
}

function currentProjectIdentityMatches(
  actual: { projectId?: string; projectRoot?: string },
  expected?: ProjectRuntimeIdentity,
) {
  const expectedParts = compactUnique([expected?.projectId || "", expected?.projectRoot || ""]);
  if (!expectedParts.length) return true;
  const actualParts = compactUnique([actual.projectId || "", actual.projectRoot || ""]);
  if (!actualParts.length) return false;
  return expectedParts.some((expectedPart) => actualParts.some((actualPart) => (
    actualPart === expectedPart
    || actualPart.endsWith(`/${expectedPart}`)
    || expectedPart.endsWith(`/${actualPart}`)
  )));
}

function projectMismatchMessage() {
  return "当前项目状态还没有和本项目同步。请重新同步。";
}

export function guardProjectRealChainUiStateForCurrentProject(
  state: ProjectRealChainUiState,
  expected?: ProjectRuntimeIdentity,
): ProjectRealChainUiState {
  if (!state.summary || currentProjectIdentityMatches(state.summary, expected)) return state;
  return {
    status: "unavailable",
    message: projectMismatchMessage(),
  };
}

export function guardProjectImage2BatchUiStateForCurrentProject(
  state: ProjectImage2BatchUiState,
  expected?: ProjectRuntimeIdentity,
): ProjectImage2BatchUiState {
  if (!state.summary || currentProjectIdentityMatches(state.summary, expected)) return state;
  return {
    status: "unavailable",
    message: projectMismatchMessage(),
  };
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

function image2BatchPayloadFromUnknown(payload: unknown): ProjectImage2BatchPayload | undefined {
  if (!isRecord(payload)) return undefined;
  if (payload.projectionKind === "current_project_image2_batch_prepare_plan" || Array.isArray(payload.items)) {
    return payload as ProjectImage2BatchPayload;
  }
  if (isRecord(payload.report)) return { ...(payload.report as ProjectImage2BatchPayload), ...payload } as ProjectImage2BatchPayload;
  if (isRecord(payload.result)) return { ...(payload.result as ProjectImage2BatchPayload), ...payload } as ProjectImage2BatchPayload;
  return undefined;
}

function deriveImage2BatchLedgerSummary(value: unknown): ProjectImage2BatchLedgerSummary | undefined {
  if (!isRecord(value)) return undefined;
  return {
    total: numberOrUndefined(value.total) ?? 0,
    queued: numberOrUndefined(value.queued) ?? 0,
    blocked: numberOrUndefined(value.blocked) ?? 0,
    parked: numberOrUndefined(value.parked) ?? 0,
    completeVerified: numberOrUndefined(value.completeVerified) ?? 0,
    providerSubmissionForbidden: booleanOrUndefined(value.providerSubmissionForbidden) ?? false,
    liveSubmitAllowed: booleanOrUndefined(value.liveSubmitAllowed) ?? false,
    noFileMutation: booleanOrUndefined(value.noFileMutation) ?? false,
    workerSpawnForbidden: booleanOrUndefined(value.workerSpawnForbidden) ?? false,
    providerCalled: booleanOrUndefined(value.providerCalled) ?? false,
  };
}

function normalizeLedgerExpectedOutputs(value: unknown): ProjectImage2BatchLedgerProjection["expectedOutputs"] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is { expectedOutputPath?: string; path?: string } | string => {
    if (typeof item === "string") return true;
    return isRecord(item) && (typeof item.expectedOutputPath === "string" || typeof item.path === "string");
  }).map((item) => {
    if (typeof item === "string") return item;
    return {
      expectedOutputPath: typeof item.expectedOutputPath === "string" ? item.expectedOutputPath : undefined,
      path: typeof item.path === "string" ? item.path : undefined,
    };
  });
}

function deriveImage2BatchLedgerProjections(value: unknown): ProjectImage2BatchLedgerProjection[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item, index): ProjectImage2BatchLedgerProjection => ({
    taskRunId: typeof item.taskRunId === "string" ? item.taskRunId : `task_run_${String(index + 1).padStart(2, "0")}`,
    envelopeId: typeof item.envelopeId === "string" ? item.envelopeId : undefined,
    currentStatus: typeof item.currentStatus === "string" ? item.currentStatus : "prepared",
    expectedOutputPath: typeof item.expectedOutputPath === "string" ? item.expectedOutputPath : undefined,
    expectedOutputs: normalizeLedgerExpectedOutputs(item.expectedOutputs),
    previewStatus: typeof item.previewStatus === "string"
      ? item.previewStatus
      : isRecord(item.previewSummary) && typeof item.previewSummary.status === "string"
        ? item.previewSummary.status
        : undefined,
    completeVerified: item.completeVerified === true
      || (isRecord(item.completionGate) && item.completionGate.completeVerified === true),
  }));
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

export function deriveProjectImage2BatchPlanStatus(
  payload: unknown,
): ProjectImage2BatchPlanStatus {
  const report = image2BatchPayloadFromUnknown(payload);
  if (!report) {
    return {
      uiStatus: "unavailable",
      plannedCount: 0,
      readyCount: 0,
      blockedCount: 0,
      selectedShotIds: [],
      nextAction: "Runtime Image2 batch plan is unavailable.",
      items: [],
      ledgerProjections: [],
      queuedCount: 0,
      parkedCount: 0,
      completeVerifiedCount: 0,
      providerSubmissionForbidden: false,
      noFileMutation: false,
      workerSpawnForbidden: false,
      providerCalled: false,
      prepareRan: false,
      verifyScriptRan: false,
      liveSubmitAllowed: false,
      message: "Project Image2 batch plan shape was not recognized.",
    };
  }

  const items = (report.items || []).map((item, index): ProjectImage2BatchPlanItem => ({
    shotId: item.shotId || `S${String(index + 1).padStart(2, "0")}`,
    taskRunId: item.taskRunId,
    packetId: item.packetId,
    envelopeId: item.envelopeId,
    expectedOutputPath: item.expectedOutputPath,
    providerObservationPath: item.providerObservationPath,
    semanticQaPath: item.semanticQaPath,
    promptPath: item.promptPath,
    referencePaths: stringArray(item.referencePaths),
    queueOrder: typeof item.queueOrder === "number" ? item.queueOrder : index + 1,
    blocked: item.blocked === true || stringArray(item.blockers).length > 0,
    blockers: stringArray(item.blockers),
  }));
  const plannedCount = numberOrUndefined(report.summary?.plannedCount) ?? items.length;
  const blockedCount = numberOrUndefined(report.summary?.blockedCount) ?? items.filter((item) => item.blocked).length;
  const readyCount = numberOrUndefined(report.summary?.readyCount) ?? Math.max(0, plannedCount - blockedCount);
  const selectedShotIds = stringArray(report.summary?.selectedShotIds).length
    ? stringArray(report.summary?.selectedShotIds)
    : items.map((item) => item.shotId);
  const ledgerSummary = deriveImage2BatchLedgerSummary(report.ledgerProjection?.summary);
  const ledgerProjections = deriveImage2BatchLedgerProjections(report.ledgerProjection?.projections);
  const uiStatus: ProjectImage2BatchUiStatus = plannedCount > 0 && blockedCount === 0 ? "ready_for_review" : plannedCount > 0 ? "blocked" : "unavailable";
  const project = report.project || {};

  return {
    uiStatus,
    schemaVersion: report.schemaVersion,
    projectionKind: report.projectionKind,
    sourceLabel: report.sourceLabel,
    sandboxSource: report.sandboxSource,
    projectId: project.projectId,
    runId: project.runId,
    projectRoot: project.projectRoot,
    projectVibePath: project.projectVibePath,
    reportPath: report.reportRelativePath || report.reportPath,
    plannedCount,
    readyCount,
    blockedCount,
    selectedShotIds,
    nextAction: report.summary?.nextAction || "Review the dry-run Image2 batch plan before any manual submit.",
    items,
    ledgerSummary,
    ledgerProjections,
    queuedCount: ledgerSummary?.queued ?? ledgerProjections.filter((item) => item.currentStatus === "queued").length,
    parkedCount: ledgerSummary?.parked ?? ledgerProjections.filter((item) => item.currentStatus === "parked").length,
    completeVerifiedCount: ledgerSummary?.completeVerified ?? ledgerProjections.filter((item) => item.completeVerified).length,
    providerSubmissionForbidden: ledgerSummary?.providerSubmissionForbidden ?? false,
    noFileMutation: ledgerSummary?.noFileMutation ?? false,
    workerSpawnForbidden: ledgerSummary?.workerSpawnForbidden ?? false,
    providerCalled: (ledgerSummary?.providerCalled ?? report.providerCalled) === true,
    prepareRan: report.prepareRan === true,
    verifyScriptRan: report.verifyScriptRan === true,
    liveSubmitAllowed: (ledgerSummary?.liveSubmitAllowed ?? report.liveSubmitAllowed) === true,
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

export async function loadProjectRealChainStatus(expected?: ProjectRuntimeIdentity): Promise<ProjectRealChainUiState> {
  try {
    const payload = await fetchRuntimeJson(projectRealChainStatusEndpoint);
    const summary = deriveProjectRealChainStatus(payload, "runtime_endpoint");
    return guardProjectRealChainUiStateForCurrentProject({ status: summary.uiStatus, summary }, expected);
  } catch (endpointError) {
    return guardProjectRealChainUiStateForCurrentProject(await fallbackToReport(
      `Runtime project endpoint unavailable; attempted report fallback. ${endpointError instanceof Error ? endpointError.message : ""}`.trim(),
    ), expected);
  }
}

export async function runProjectRealChainCheck(expected?: ProjectRuntimeIdentity): Promise<ProjectRealChainUiState> {
  try {
    const payload = await fetchRuntimeJson(projectRealChainRunCheckEndpoint, { method: "POST" });
    const summary = deriveProjectRealChainStatus(payload, "runtime_endpoint");
    return guardProjectRealChainUiStateForCurrentProject({ status: summary.uiStatus, summary }, expected);
  } catch (endpointError) {
    return guardProjectRealChainUiStateForCurrentProject(await fallbackToReport(
      `Runtime project run-check endpoint unavailable; synced report fallback only. ${endpointError instanceof Error ? endpointError.message : ""}`.trim(),
    ), expected);
  }
}

async function unavailableImage2BatchState(message: string): Promise<ProjectImage2BatchUiState> {
  return { status: "unavailable", message };
}

export async function loadProjectImage2BatchPlan(expected?: ProjectRuntimeIdentity): Promise<ProjectImage2BatchUiState> {
  try {
    const payload = await fetchRuntimeJson(projectImage2BatchPlanEndpoint);
    const summary = deriveProjectImage2BatchPlanStatus(payload);
    return guardProjectImage2BatchUiStateForCurrentProject({ status: summary.uiStatus, summary }, expected);
  } catch (endpointError) {
    return unavailableImage2BatchState(
      `Runtime Image2 batch plan endpoint unavailable. ${endpointError instanceof Error ? endpointError.message : ""}`.trim(),
    );
  }
}

export async function runProjectImage2BatchCheck(expected?: ProjectRuntimeIdentity): Promise<ProjectImage2BatchUiState> {
  try {
    const payload = await fetchRuntimeJson(projectImage2BatchRunCheckEndpoint, { method: "POST" });
    const summary = deriveProjectImage2BatchPlanStatus(payload);
    return guardProjectImage2BatchUiStateForCurrentProject({ status: summary.uiStatus, summary }, expected);
  } catch (endpointError) {
    return unavailableImage2BatchState(
      `Runtime Image2 batch run-check endpoint unavailable. ${endpointError instanceof Error ? endpointError.message : ""}`.trim(),
    );
  }
}
