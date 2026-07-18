import { buildExportWorkerState, type ExportWorkerState } from "./exportWorker";
import { buildPreviewExportState } from "./previewExport";
import type { PreviewQueueItem } from "./previewPlayerQueue";
import type { KnowledgePack } from "./knowledgeTypes";
import type { ProjectRuntimeState } from "./projectState";
import type { ExportProfileKind, PreviewEvent, ProjectPreviewExportState, ShotRecord } from "./types";
import type { ProjectVibeDocument } from "../project/types";
import {
  agentDirectorDeliveryHandoffPreviewQueue,
  buildAgentDirectorDeliveryHandoff,
  type AgentDirectorDeliveryHandoffProjection,
} from "./agentDirectorDeliveryHandoff";

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
  deliveryHandoff?: AgentDirectorDeliveryHandoffProjection;
}

export interface BuildLocalPreviewExportProjectionInput {
  runtimeState: ProjectRuntimeState;
  previewQueue: PreviewQueueItem[];
  shots: ShotRecord[];
  projectVibe?: ProjectVibeDocument;
  projectLocalKnowledgePacks?: KnowledgePack[];
  projectRoot?: string;
  projectFactHash?: string;
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
    sourceReceiptId: item.sourceReceiptId,
    outputHash: item.outputHash,
    reviewReceiptId: item.reviewReceiptId,
  }));
}

function reviewRequired(item: PreviewQueueItem): boolean {
  const structured = item as PreviewQueueItem & { reviewRequired?: boolean };
  return structured.reviewRequired === true || (item.kind === "video_clip" && !item.reviewReceiptId);
}

function projectRelativeLocalReference(value: string | undefined, projectRoot: string | undefined) {
  if (!value) return undefined;
  const normalize = (path: string) => path
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/private(?=\/(?:tmp|var)(?:\/|$))/, "")
    .replace(/^\.\//, "")
    .replace(/\/$/, "");
  const path = normalize(value);
  const root = projectRoot ? normalize(projectRoot) : "";
  return root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
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
  const deliveryHandoff = input.projectVibe
    ? buildAgentDirectorDeliveryHandoff({
      project: input.projectVibe,
      projectRoot,
      projectFactHash: input.projectFactHash,
    })
    : undefined;
  const effectivePreviewQueue = deliveryHandoff?.status === "ready"
    ? agentDirectorDeliveryHandoffPreviewQueue(deliveryHandoff, input.projectVibe!)
    : deliveryHandoff?.promotionReceiptCount
      ? []
      : input.previewQueue;
  const exportPreviewQueue = effectivePreviewQueue.map((item) => ({
    ...item,
    mediaPath: projectRelativeLocalReference(item.mediaPath, projectRoot),
  }));
  const exportShots = input.shots.map((shot) => ({
    ...shot,
    startFrame: projectRelativeLocalReference(shot.startFrame, projectRoot),
    endFrame: projectRelativeLocalReference(shot.endFrame, projectRoot),
    videoPath: projectRelativeLocalReference(shot.videoPath, projectRoot),
  }));
  const previewEvents = queueToPreviewEvents(exportPreviewQueue);
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
    shots: exportShots,
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
  const exportWorker = buildExportWorkerState({
    source: previewExport,
    projectVibe: input.projectVibe,
    projectLocalKnowledgePacks: input.projectLocalKnowledgePacks,
    projectTitle: input.projectVibe?.manifest.title || input.runtimeState.project.title,
    exportRoot,
    generatedAt,
    profileSelection: readyExportProfileSelection(previewExport),
    executionMode: "plan_only",
    delivery: {
      identity: {
        projectId: input.projectVibe?.manifest.projectId || input.runtimeState.sourceIndex.projectId,
        projectRoot,
        projectFactHash: input.projectFactHash || "",
      },
      reviewReceipts: deliveryHandoff?.status === "ready"
        ? deliveryHandoff.reviewReceipts
        : deliveryHandoff?.promotionReceiptCount
          ? []
          : undefined,
    },
  });

  return {
    schemaVersion: localPreviewExportProjectionSchemaVersion,
    generatedAt,
    projectRoot,
    previewQueue: effectivePreviewQueue,
    previewExport,
    exportWorker,
    exportRoot,
    packageStatus: previewExport.exportPackagePlan.status,
    missingCount: effectivePreviewQueue.filter((item) => item.kind === "missing_placeholder").length,
    needsReviewCount: effectivePreviewQueue.filter(reviewRequired).length,
    deliveryHandoff,
  };
}
