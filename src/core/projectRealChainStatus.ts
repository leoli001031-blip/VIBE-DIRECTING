import {
  currentProjectIdentityMatches,
  fetchRuntimeJson,
  hasProjectRuntimeIdentity,
  isRecord,
  numberOrUndefined,
  projectMismatchMessage,
  projectRuntimeBasePath,
  projectRuntimeRequestPath,
  stringArray,
  toRuntimeUrl,
  type ProjectRuntimeIdentity,
} from "./runtimeApiClient";
import {
  normalizeProjectRound5ShotGate,
  type ProjectRound5GateSummary,
} from "./projectRound5Types";
import { deriveP6LiveReportProjection } from "./p6LiveReportProjection";
import type { VideoRelayQueueState } from "./videoRelayQueue";

export {
  defaultRuntimeApiBaseUrl,
  projectRuntimeRequestPath,
} from "./runtimeApiClient";

export type {
  ProjectRuntimeIdentity,
} from "./runtimeApiClient";

export type {
  ProjectRound5GateSummary,
  ProjectRound5ShotGate,
} from "./projectRound5Types";

export const projectRealChainRuntimeBasePath = projectRuntimeBasePath;
export const projectRealChainStatusEndpoint = `${projectRealChainRuntimeBasePath}/projects/current/real-chain/status`;
export const projectRealChainRunCheckEndpoint = `${projectRealChainRuntimeBasePath}/projects/current/real-chain/run-check`;
export const projectRealChainFileEndpoint = `${projectRealChainRuntimeBasePath}/files`;
export const projectRealChainReportRelativePath =
  "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/reports/image2_start_long_chain_report.json";
export const projectRealChainFallbackReportUrl = `/${projectRealChainReportRelativePath}`;

export type ProjectRealChainUiStatus =
  | "running"
  | "needs_review"
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
  sourceReceiptId?: string;
  providerReceiptId?: string;
  providerRequestId?: string;
  outputHash?: string;
  outputSha256?: string;
  promptText?: string;
  promptPath?: string;
  promptHash?: string;
  mediaPath?: string;
  mediaType?: string;
  durationSeconds?: number;
  duration_seconds?: number;
  duration?: number;
  fileUrl?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  status?: string;
  previewStatus?: string;
  runtimeTruthStatus?: string;
  outputExists?: boolean;
  reviewRequired: boolean;
  reviewOverlay: boolean;
  previewQaStatus?: string;
  productionQaStatus?: string;
  blockers?: string[];
  videoStatus?: string;
  submitId?: string;
  submit_id?: string;
  queueInfo?: Record<string, unknown>;
  queue_info?: Record<string, unknown>;
  localMediaPaths?: string[];
  outputVideoPath?: string;
};

export type ProjectWorkbenchAssetFactStatus = "locked" | "candidate" | "needs_review" | "rejected" | "missing";

export type ProjectWorkbenchAssetFact = {
  id: string;
  type: "character" | "scene" | "prop" | "style" | "unknown";
  name: string;
  status: ProjectWorkbenchAssetFactStatus;
  path?: string;
  sourceKind?: string;
  sourceReceiptId?: string;
  sourceRunId?: string;
  outputHash?: string;
  promptText?: string;
  promptPath?: string;
  promptHash?: string;
  textConstraints: string[];
  usedByShotIds: string[];
  sourceRefs: string[];
  rejectedReason?: string;
};

export type ProjectWorkbenchStoryShotFact = {
  id: string;
  title?: string;
  storyFunction?: string;
  actId?: string;
  sectionId?: string;
  sceneId?: string;
  roleIds?: string[];
  propIds?: string[];
  characterAssetIds?: string[];
  sceneAssetIds?: string[];
  propAssetIds?: string[];
  startFrame?: string;
  endFrame?: string;
  status?: string;
  issues?: string[];
  camera?: string;
  executionMode?: string;
  rhythmProfile?: string;
  splitPolicy?: string;
  actionBeats?: string[];
  primaryAction?: string;
  actionTrigger?: string;
  microReaction?: string;
  seedanceDirection?: string;
  directorFeedbackDirectives?: string[];
  characterGuidance?: string[];
  sceneGuidance?: string[];
  propGuidance?: string[];
  durationSeconds?: number;
  sourceRefs?: string[];
};

export type ProjectWorkbenchStorySectionFact = {
  id: string;
  label: string;
  shotIds: string[];
};

export type ProjectWorkbenchFacts = {
  schemaVersion?: string;
  source?: string;
  project?: {
    projectId?: string;
    runId?: string;
    schemaVersion?: string;
    title?: string;
    projectRoot?: string;
    projectVibePath?: string;
  };
  projectRoot?: string;
  projectVibePath?: string;
  sourceIndex?: {
    present: boolean;
    readable: boolean;
    path?: string;
    sourceIndexHash?: string;
    refs: string[];
  };
  storyFlow?: {
    present: boolean;
    readable: boolean;
    path?: string;
    shotCount: number;
    sectionCount: number;
    sections: ProjectWorkbenchStorySectionFact[];
    shots: ProjectWorkbenchStoryShotFact[];
  };
  visualMemory?: {
    present: boolean;
    readable: boolean;
    path?: string;
    assetCount: number;
    assets: ProjectWorkbenchAssetFact[];
    summary?: {
      locked?: number;
      candidate?: number;
      needsReview?: number;
      rejected?: number;
      missing?: number;
    };
  };
  factsUsed?: Array<{ name: string; path: string; usedFor: string[] }>;
  providerCalled: false;
  prepareRan: false;
  projectVibeWritten: false;
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
  relayQueue?: VideoRelayQueueState;
  round5Gate?: ProjectRound5GateSummary;
  workbenchFacts?: ProjectWorkbenchFacts;
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
  relayQueue?: VideoRelayQueueState;
  round5ArtifactIngest?: unknown;
  round5Gate?: unknown;
  shotGateMatrix?: unknown;
  ledgerProjection?: unknown;
  assetGateSummary?: unknown;
  uiSummary?: unknown;
  isolation?: unknown;
  workbenchFacts?: ProjectWorkbenchFacts;
  observations?: Array<{
    id?: string;
    order?: number;
    shotId?: string;
	    expectedOutputPath?: string;
	    expectedOutputAbsPath?: string;
	    sourceReceiptId?: string;
	    providerReceiptId?: string;
	    providerRequestId?: string;
	    outputHash?: string;
	    outputSha256?: string;
	    providerOutputSha256?: string;
	    promptText?: string;
	    promptPath?: string;
	    promptHash?: string;
	    imageUrl?: string;
    thumbnailUrl?: string;
    outputExists?: boolean;
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

function payloadFromUnknown(payload: unknown): ProjectRealChainPayload | undefined {
  if (!isRecord(payload)) return undefined;
  const p6Projection = deriveP6LiveReportProjection(payload);
  if (p6Projection) return p6Projection as unknown as ProjectRealChainPayload;
  if (
    typeof payload.previewStatus === "string"
    || Array.isArray(payload.previewItems)
    || Array.isArray(payload.observations)
    || isRecord(payload.round5ArtifactIngest)
    || isRecord(payload.round5Gate)
    || Array.isArray(payload.shotGateMatrix)
    || isRecord(payload.uiSummary)
    || isRecord(payload.workbenchFacts)
  ) {
    return payload as ProjectRealChainPayload;
  }
  if (isRecord(payload.report)) return { ...(payload.report as ProjectRealChainPayload), ...payload } as ProjectRealChainPayload;
  if (isRecord(payload.result)) return { ...(payload.result as ProjectRealChainPayload), ...payload } as ProjectRealChainPayload;
  return undefined;
}

function deriveRound5GateSummary(payload: ProjectRealChainPayload): ProjectRound5GateSummary | undefined {
  const ingest = isRecord(payload.round5ArtifactIngest)
    ? payload.round5ArtifactIngest
    : isRecord(payload.round5Gate)
      ? payload.round5Gate
      : Array.isArray(payload.shotGateMatrix) || isRecord(payload.uiSummary)
        ? payload
        : undefined;
  if (!ingest) return undefined;

  const shotGateMatrix = Array.isArray(ingest.shotGateMatrix)
    ? ingest.shotGateMatrix.filter(isRecord).map(normalizeProjectRound5ShotGate)
    : [];
  if (!shotGateMatrix.length && !isRecord(ingest.uiSummary)) return undefined;

  return {
    status: isRecord(ingest.uiSummary) && typeof ingest.uiSummary.status === "string"
      ? ingest.uiSummary.status
      : typeof ingest.status === "string"
        ? ingest.status
        : undefined,
    shotGateMatrix,
    ledgerProjection: isRecord(ingest.ledgerProjection) ? ingest.ledgerProjection : undefined,
    assetGateSummary: isRecord(ingest.assetGateSummary) ? ingest.assetGateSummary : undefined,
    uiSummary: isRecord(ingest.uiSummary) ? ingest.uiSummary : undefined,
    isolation: isRecord(ingest.isolation) ? ingest.isolation : undefined,
  };
}

function toRuntimeFileUrl(path: string) {
  return toRuntimeUrl(`${projectRealChainFileEndpoint}?scope=current-project&path=${encodeURIComponent(path)}`);
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
  const round5Gate = deriveRound5GateSummary(payload);
  const round5UiStatus = String(round5Gate?.status || "").toLowerCase();
  const round5ShotBlockers = round5Gate?.shotGateMatrix.some((shot) => {
    const gateStatus = String(shot.gateStatus || "").toLowerCase();
    return shot.blockers.length > 0 || gateStatus.includes("blocked") || gateStatus.includes("required");
  }) === true;
  const round5ReturnedNeedsReview = round5Gate?.shotGateMatrix.some((shot) => shot.gateStatus === "end_returned_needs_review") === true;
  if (round5UiStatus === "blocked" || round5ShotBlockers) return "blocked";
  if (round5UiStatus === "needs_review" || round5ReturnedNeedsReview) return "needs_review";

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
    sourceReceiptId: item.sourceReceiptId || item.providerReceiptId || item.providerRequestId,
    providerReceiptId: item.providerReceiptId,
    providerRequestId: item.providerRequestId,
    outputHash: item.outputHash || item.outputSha256 || item.providerOutputSha256,
    outputSha256: item.outputSha256 || item.providerOutputSha256,
    promptText: item.promptText,
    promptPath: item.promptPath,
    promptHash: item.promptHash,
    imageUrl,
    thumbnailUrl: item.thumbnailUrl ? toRuntimeUrl(item.thumbnailUrl) : imageUrl,
    outputExists: item.outputExists,
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
    mediaPath: item.mediaPath,
    fileUrl: item.fileUrl,
    imageUrl,
    thumbnailUrl,
    status: item.status,
    previewStatus: item.previewStatus,
    runtimeTruthStatus: item.runtimeTruthStatus,
    reviewRequired: item.reviewRequired === true || item.reviewOverlay === true || item.productionQaStatus === "needs_review",
    reviewOverlay: item.reviewOverlay === true,
    blockers: item.blockers,
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
      message: projectMismatchMessage(),
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
  const round5Gate = deriveRound5GateSummary(report);
  const reviewShotIds = deriveReviewShotIds(report, previewItems);
  const previewStatus = report.previewStatus || report.status || "unavailable";
  const totalPlannedImages = numberOrUndefined(report.totalPlannedImages)
    ?? numberOrUndefined(report.plannedImageCount)
    ?? numberOrUndefined(report.shotCount)
    ?? numberOrUndefined(round5Gate?.uiSummary?.totalShots)
    ?? numberOrUndefined(round5Gate?.ledgerProjection?.total)
    ?? round5Gate?.shotGateMatrix.length
    ?? previewItems.length;
  const returnedImageCount = numberOrUndefined(report.returnedImageCount)
    ?? numberOrUndefined(round5Gate?.uiSummary?.observedStarts)
    ?? previewItems.filter((item) => item.imageUrl || item.expectedOutputPath).length;
  const project = report.project || {};
  const workbenchProject = report.workbenchFacts?.project || {};

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
    projectId: project.projectId || report.projectId || workbenchProject.projectId,
    runId: project.runId || report.runId,
    projectSchemaVersion: project.schemaVersion || report.projectSchemaVersion,
    projectRoot: project.projectRoot || report.projectRoot || workbenchProject.projectRoot || report.workbenchFacts?.projectRoot,
    projectVibePath: project.projectVibePath || report.projectVibePath || workbenchProject.projectVibePath || report.workbenchFacts?.projectVibePath,
    previewStatus,
    previewStatusLabel: report.previewStatusLabel || humanPreviewStatus(previewStatus),
    productionStatus: report.productionStatus || "unavailable",
    returnedImageCount,
    totalPlannedImages,
    needsReviewCount: numberOrUndefined(report.needsReviewCount) ?? reviewShotIds.length,
    reviewShotIds,
    previewItems,
    previewThumbnails,
    relayQueue: isRecord(report.relayQueue) ? report.relayQueue as VideoRelayQueueState : undefined,
    round5Gate,
    workbenchFacts: report.workbenchFacts,
    reportPath,
    reportUrl,
    providerCalled: report.providerCalled === true,
    prepareRan: report.prepareRan === true,
    message: report.message,
  };
}

async function fallbackToReport(message: string): Promise<ProjectRealChainUiState> {
  return {
    status: "unavailable",
    message,
  };
}

export async function loadProjectRealChainStatus(expected?: ProjectRuntimeIdentity): Promise<ProjectRealChainUiState> {
  if (!hasProjectRuntimeIdentity(expected)) {
    return {
      status: "unavailable",
      message: projectMismatchMessage(),
    };
  }

  try {
    const payload = await fetchRuntimeJson(projectRuntimeRequestPath(projectRealChainStatusEndpoint, expected));
    const summary = deriveProjectRealChainStatus(payload, "runtime_endpoint");
    return guardProjectRealChainUiStateForCurrentProject({ status: summary.uiStatus, summary }, expected);
  } catch (endpointError) {
    return guardProjectRealChainUiStateForCurrentProject(await fallbackToReport(
      projectMismatchMessage(),
    ), expected);
  }
}

export async function runProjectRealChainCheck(expected?: ProjectRuntimeIdentity): Promise<ProjectRealChainUiState> {
  if (!hasProjectRuntimeIdentity(expected)) {
    return {
      status: "unavailable",
      message: projectMismatchMessage(),
    };
  }

  try {
    const payload = await fetchRuntimeJson(projectRuntimeRequestPath(projectRealChainRunCheckEndpoint, expected), { method: "POST" });
    const summary = deriveProjectRealChainStatus(payload, "runtime_endpoint");
    return guardProjectRealChainUiStateForCurrentProject({ status: summary.uiStatus, summary }, expected);
  } catch (endpointError) {
    return guardProjectRealChainUiStateForCurrentProject(await fallbackToReport(
      projectMismatchMessage(),
    ), expected);
  }
}

export {
  currentProjectBindingIdentity,
  deriveCurrentProjectBindingStatus,
  deriveCurrentProjectChoices,
  loadCurrentProjectBindingStatus,
  loadCurrentProjectChoices,
  projectCurrentBindingEndpoint,
  projectCurrentChoicesEndpoint,
  projectCurrentSelectEndpoint,
  selectCurrentProjectBinding,
} from "./projectCurrentBindingClient";

export type {
  ProjectCurrentBindingStatus,
  ProjectCurrentChoice,
  SelectCurrentProjectInput,
} from "./projectCurrentBindingClient";

export {
  deriveRound5StrictEditReturnStatus,
  ingestProjectRound5StrictEditReturn,
  prepareProjectRound5StrictEditPreflight,
  projectRound5StrictEditPrepareEndpoint,
  projectRound5StrictEditReturnEndpoint,
} from "./projectRound5StrictEditClient";

export type {
  ProjectRound5StrictEditPreflightRequest,
  ProjectRound5StrictEditPreflightStatus,
  ProjectRound5StrictEditPreflightUiState,
  ProjectRound5StrictEditPreflightUiStatus,
  ProjectRound5StrictEditReturnRequest,
  ProjectRound5StrictEditReturnStatus,
  ProjectRound5StrictEditReturnUiState,
  ProjectRound5StrictEditReturnUiStatus,
} from "./projectRound5StrictEditClient";

export {
  confirmProjectImage2OneShot,
  deriveProjectImage2BatchPlanStatus,
  deriveProjectImage2OneShotStatus,
  executeReturnedProjectImage2OneShot,
  guardProjectImage2BatchUiStateForCurrentProject,
  guardProjectImage2OneShotUiStateForCurrentProject,
  loadProjectImage2BatchPlan,
  loadProjectImage2OneShotStatus,
  prepareProjectImage2OneShot,
  prepareProjectImage2OneShotPermissionReceipt,
  prepareProjectImage2OneShotTrigger,
  projectImage2BatchPlanEndpoint,
  projectImage2BatchRunCheckEndpoint,
  projectImage2OneShotConfirmEndpoint,
  projectImage2OneShotExecuteReturnEndpoint,
  projectImage2OneShotPrepareEndpoint,
  projectImage2OneShotPrepareTriggerEndpoint,
  projectImage2OneShotReturnEndpoint,
  projectImage2OneShotStatusEndpoint,
  projectP6RealImage2SubmitEndpoint,
  projectP6RealImage2SubmitSerialEndpoint,
  runProjectImage2BatchCheck,
  submitProjectP6RealImage2OneShot,
  submitProjectP6RealImage2SerialBatch,
} from "./projectImage2Client";

export type {
  ProjectImage2BatchLedgerProjection,
  ProjectImage2BatchLedgerSummary,
  ProjectImage2BatchPlanItem,
  ProjectImage2BatchPlanStatus,
  ProjectImage2BatchUiState,
  ProjectImage2BatchUiStatus,
  ProjectImage2OneShotPermissionInput,
  ProjectImage2OneShotPermissionReceipt,
  ProjectImage2OneShotReceipt,
  ProjectImage2OneShotStatus,
  ProjectImage2OneShotUiState,
  ProjectImage2OneShotUiStatus,
  ProjectP6RealImage2SerialBatchInput,
  ProjectP6RealImage2SerialShotInput,
  ProjectP6RealImage2SubmitInput,
} from "./projectImage2Client";

export {
  credentialsEndpoint,
  deleteCredential,
  loadCredentials,
  loadProviderConfigStatuses,
  saveCredential,
} from "./providerCredentialsClient";

export type {
  CredentialEntry,
  CredentialsSnapshot,
  ProviderConfigStatus,
} from "./providerCredentialsClient";
