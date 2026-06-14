import { buildExportWorkerState, type ExportWorkerState } from "./exportWorker";
import { buildPreviewExportState } from "./previewExport";
import type { PreviewQueueItem } from "./previewPlayerQueue";
import type { KnowledgePack } from "./knowledgeTypes";
import type { ProjectRuntimeState } from "./projectState";
import type { ExportProfileKind, PreviewEvent, ProjectPreviewExportState, ShotRecord } from "./types";
import type { ProjectVibeDocument, ProjectVibeReceiptLedger, ProjectVibeReviewReceipt } from "../project/types";

export const localPreviewExportProjectionSchemaVersion = "0.1.0";

export interface LocalPreviewExportProjection {
  schemaVersion: typeof localPreviewExportProjectionSchemaVersion;
  generatedAt: string;
  projectRoot?: string;
  previewQueue: PreviewQueueItem[];
  previewExport: ProjectPreviewExportState;
  exportWorker: ExportWorkerState;
  exportRoot: string;
  packageStatus: ProjectPreviewExportState["exportPackagePlan"]["status"];
  missingCount: number;
  needsReviewCount: number;
}

export interface BuildLocalPreviewExportProjectionInput {
  runtimeState: ProjectRuntimeState;
  previewQueue: PreviewQueueItem[];
  shots: ShotRecord[];
  projectVibe?: ProjectVibeDocument;
  projectLocalKnowledgePacks?: KnowledgePack[];
  projectRoot?: string;
  selectedShotId?: string;
  exportRoot?: string;
  generatedAt?: string;
}

function queueKindToEventType(kind: PreviewQueueItem["kind"]): PreviewEvent["type"] {
  if (kind === "video_clip") return "video_clip";
  if (kind === "image_hold") return "image_hold";
  return "blocked_placeholder";
}

function queueToPreviewEvents(queue: PreviewQueueItem[]): PreviewEvent[] {
  return queue.map((item, index) => ({
    id: item.id || `local_preview_${index + 1}`,
    mode: "draft_preview",
    type: queueKindToEventType(item.kind),
    shotId: item.shotId,
    startSeconds: item.startSeconds,
    durationSeconds: item.durationSeconds,
    mediaPath: item.kind === "missing_placeholder" ? undefined : item.mediaPath,
    qaStatus: "UNKNOWN",
  }));
}

function reviewRequired(item: PreviewQueueItem): boolean {
  const display = item as PreviewQueueItem & {
    reviewRequired?: boolean;
    status?: string;
    previewQaStatus?: string;
    productionQaStatus?: string;
  };
  return display.reviewRequired === true || /review|复核/i.test(`${display.status || ""} ${display.previewQaStatus || ""} ${display.productionQaStatus || ""}`);
}

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function safeId(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "output";
}

function emptyReceiptLedger(): ProjectVibeReceiptLedger {
  return {
    scriptPlanningReceipts: [],
    promptKeyframePlanningReceipts: [],
    batchReceipts: [],
    reviewReceipts: [],
  };
}

function receiptKey(receipt: Pick<ProjectVibeReviewReceipt, "shotId" | "outputPath" | "outputHash" | "sourceReceiptId">) {
  return [
    receipt.shotId || "",
    receipt.outputPath || "",
    receipt.outputHash || "",
    receipt.sourceReceiptId || "",
  ].join("\n");
}

function previewApprovalReceipt(item: PreviewQueueItem, index: number, generatedAt: string): ProjectVibeReviewReceipt | undefined {
  const evidence = item as PreviewQueueItem & {
    status?: string;
    previewQaStatus?: string;
    productionQaStatus?: string;
    sourceReceiptId?: string;
    providerReceiptId?: string;
    providerRequestId?: string;
    outputHash?: string;
    outputSha256?: string;
  };
  const approved = /approved|已通过/i.test(`${evidence.status || ""} ${evidence.previewQaStatus || ""} ${evidence.productionQaStatus || ""}`);
  const sourceReceiptId = cleanString(evidence.sourceReceiptId) || cleanString(evidence.providerReceiptId) || cleanString(evidence.providerRequestId);
  const outputHash = cleanString(evidence.outputHash) || cleanString(evidence.outputSha256);
  if (!approved || item.kind !== "video_clip" || !item.mediaPath || !sourceReceiptId || !outputHash) return undefined;
  const shotPart = safeId(item.shotId || item.id || `video_${index + 1}`);
  const hashPart = safeId(outputHash).slice(0, 24);
  return {
    id: `review_${shotPart}_${hashPart}`,
    createdAt: generatedAt,
    status: "approved",
    reviewerId: "runtime_preview_projection",
    humanReviewed: true,
    shotId: item.shotId,
    sourceReceiptId,
    outputPath: item.mediaPath,
    outputHash,
    retryRequested: false,
    lateOutput: false,
    providerSelfReportIgnored: true,
    promotionAuthorized: false,
    evidenceRefs: [
      `preview#${item.id}`,
      `receipt#${sourceReceiptId}`,
      `project_output#${item.mediaPath}`,
      `output_hash#${outputHash}`,
    ],
    blockers: [],
  };
}

function projectVibeWithPreviewApprovals(
  projectVibe: ProjectVibeDocument | undefined,
  previewQueue: PreviewQueueItem[],
  generatedAt: string,
) {
  if (!projectVibe) return projectVibe;
  const previewReceipts = previewQueue
    .map((item, index) => previewApprovalReceipt(item, index, generatedAt))
    .filter((receipt): receipt is ProjectVibeReviewReceipt => Boolean(receipt));
  if (!previewReceipts.length) return projectVibe;
  const receipts = projectVibe.receipts || emptyReceiptLedger();
  const existing = new Set(receipts.reviewReceipts.map(receiptKey));
  const additions = previewReceipts.filter((receipt) => !existing.has(receiptKey(receipt)));
  if (!additions.length) return projectVibe;
  return {
    ...projectVibe,
    receipts: {
      ...receipts,
      reviewReceipts: [...receipts.reviewReceipts, ...additions],
    },
  };
}

const preferredExportProfiles: ExportProfileKind[] = ["rough_cut", "asset_package", "storyboard_table"];

function readyExportProfileSelection(previewExport: ProjectPreviewExportState): ExportProfileKind[] {
  const profiles = new Map(previewExport.exportProfiles.map((profile) => [profile.kind, profile]));
  const available = preferredExportProfiles.filter((kind) => {
    const profile = profiles.get(kind);
    return profile && profile.readiness !== "blocked";
  });
  return available.length ? available : ["storyboard_table"];
}

export function buildLocalPreviewExportProjection(input: BuildLocalPreviewExportProjectionInput): LocalPreviewExportProjection {
  const generatedAt = input.generatedAt || input.runtimeState.generatedAt;
  const projectRoot = input.projectRoot || input.runtimeState.project.root;
  const previewEvents = queueToPreviewEvents(input.previewQueue);
  const taskViews = input.runtimeState.taskRuns.taskViews.map((task) => ({
    job: task.job,
    shotId: task.shotId,
    taskRun: task.taskRun,
    manifestMatch: task.manifestMatch,
  }));
  const previewExport = buildPreviewExportState({
    generatedAt,
    projectRoot: projectRoot || "project_root",
    previewEvents,
    shots: input.shots,
    jobs: input.runtimeState.taskRuns.jobs,
    taskRuns: input.runtimeState.taskRuns.runs,
    taskViews,
    manifestMatches: input.runtimeState.manifestMatches.reports,
    generationHealthReports: input.runtimeState.imagePipeline.generationHealthReports,
    qaPromotionReports: input.runtimeState.imagePipeline.qaPromotionReports,
    issues: [],
    selectedShotId: input.selectedShotId,
    preferPreviewEvents: previewEvents.length > 0,
  });
  const exportRoot = input.exportRoot || "exports/current-project";
  const exportProjectVibe = projectVibeWithPreviewApprovals(input.projectVibe, input.previewQueue, generatedAt);
  const exportWorker = buildExportWorkerState({
    source: previewExport,
    projectVibe: exportProjectVibe,
    projectLocalKnowledgePacks: input.projectLocalKnowledgePacks,
    projectTitle: exportProjectVibe?.manifest.title || input.runtimeState.project.title,
    exportRoot,
    generatedAt,
    profileSelection: readyExportProfileSelection(previewExport),
    executionMode: "plan_only",
  });

  return {
    schemaVersion: localPreviewExportProjectionSchemaVersion,
    generatedAt,
    projectRoot,
    previewQueue: input.previewQueue,
    previewExport,
    exportWorker,
    exportRoot,
    packageStatus: previewExport.exportPackagePlan.status,
    missingCount: input.previewQueue.filter((item) => item.kind === "missing_placeholder").length,
    needsReviewCount: input.previewQueue.filter(reviewRequired).length,
  };
}
