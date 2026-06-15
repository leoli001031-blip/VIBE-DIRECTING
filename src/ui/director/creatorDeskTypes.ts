import type { AssetReconciliationProjection } from "../../core/assetReconciliation";
import type {
  ProjectInboxProjection,
  ProjectIntentRoute,
  ProjectObservationProjection,
} from "../../core/projectAgentWorkspace";

export type CreatorReviewStatus = "needs_review" | "missing" | "approved" | "retry" | "locked";
export type CreatorReviewLockTarget = "character" | "scene" | "prop" | "shot_reference";

export type CreatorScriptPlannerSection = {
  id: string;
  label: string;
  shotCount: number;
};

export type CreatorScriptPlannerProjection = {
  title: string;
  brief: string;
  sectionCount: number;
  shotCount: number;
  selectedShotCount: number;
  draftStatus: "Ready" | "Missing";
  sections: CreatorScriptPlannerSection[];
  missingQuestions: string[];
};

export type CreatorBatchGenerationProjection = {
  statusLabel: string;
  detail: string;
  selectedShotCount: number;
  plannedCount: number;
  readyCount: number;
  missingCount: number;
  retryCount: number;
  concurrencyLabel: "Concurrency 10";
  safetyLabel: string;
  retryLabel: "Retry Missing";
  canRetryMissing: boolean;
};

export type CreatorReviewTrayItem = {
  id: string;
  shotId?: string;
  assetId?: string;
  assetType?: "character" | "scene" | "prop" | "style" | "unknown" | "shot_reference";
  referenceKind?: "visual_reference" | "storyboard_reference" | "shot_reference";
  usedByShotIds?: string[];
  label: string;
  detail: string;
  status: CreatorReviewStatus;
  mediaPath?: string;
  sourceReceiptId?: string;
  outputHash?: string;
  promptText?: string;
  promptPath?: string;
  promptHash?: string;
};

export type CreatorReviewTrayProjection = {
  counts: Record<CreatorReviewStatus, number>;
  items: CreatorReviewTrayItem[];
};

export type CreatorFrameStatus = "pending" | "needs_review" | "approved" | "missing";

export type CreatorFramePlanItem = {
  shotId: string;
  title: string;
  startStatus: CreatorFrameStatus;
  endStatus: CreatorFrameStatus;
  requiresEndFrame: boolean;
  nextAction: string;
};

export type CreatorFramePlanProjection = {
  items: CreatorFramePlanItem[];
  readyCount: number;
  reviewCount: number;
  missingCount: number;
  endpointCount: number;
};

export type CreatorVideoGenerationStatus = "not_generated" | "submitted" | "queued" | "generating" | "completed" | "recoverable" | "failed";

export type CreatorVideoTaskFact = {
  label: string;
  value: string;
  title?: string;
  tone?: "neutral" | "active" | "success" | "warning" | "danger";
};

export type CreatorVideoGenerationProjection = {
  status: CreatorVideoGenerationStatus;
  statusLabel: string;
  detail: string;
  submittedCount: number;
  queuedCount: number;
  generatingCount: number;
  completedCount: number;
  recoverableCount: number;
  failedCount: number;
  queueSummary?: string;
  shortSubmitId?: string;
  queuePosition?: number;
  taskFacts: CreatorVideoTaskFact[];
  canResume: boolean;
  canContinueAfterFailure?: boolean;
};

export type CreatorVideoStageProjection = {
  status: "not_submitted" | "in_progress" | "recoverable" | "needs_review" | "completed" | "failed";
  source: "relay_queue" | "preview_items" | "none";
  generation: CreatorVideoGenerationProjection;
  reviewCount: number;
  canResume: boolean;
};

export type CreatorPreflightCheckState = "ok" | "needs_review" | "missing" | "waiting";

export type CreatorPreflightCheck = {
  id: "story" | "references" | "modes" | "video";
  label: string;
  state: CreatorPreflightCheckState;
  detail: string;
};

export type CreatorPreflightProjection = {
  status: "ready" | "needs_story" | "needs_references" | "needs_review" | "waiting";
  summary: string;
  nextAction: string;
  modeSummary: string;
  referenceSummary: string;
  checks: CreatorPreflightCheck[];
};

export type CreatorAgentStage = {
  stage:
    | "empty"
    | "planning"
    | "reference_needed"
    | "reference_running"
    | "review_needed"
    | "video_ready"
    | "video_running"
    | "video_review"
    | "export_ready";
  primaryAction: string;
  summary: string;
  detail: string;
  targetView: "story" | "assets" | "preview" | "export";
};

export type CreatorAgentCommand = {
  kind:
    | "send_idea"
    | "open_story"
    | "generate_references"
    | "wait_references"
    | "open_review"
    | "submit_video"
    | "resume_video"
    | "wait_video"
    | "open_preview"
    | "open_export";
  label: string;
  summary: string;
  detail: string;
  targetView: "story" | "assets" | "preview" | "export";
};

export type CreatorDeskProjection = {
  agentStage: CreatorAgentStage;
  agentCommand: CreatorAgentCommand;
  projectObservation: ProjectObservationProjection;
  projectInbox: ProjectInboxProjection;
  defaultIntentRoute: ProjectIntentRoute;
  assetReconciliation?: AssetReconciliationProjection;
  preflight: CreatorPreflightProjection;
  scriptPlanner: CreatorScriptPlannerProjection;
  batchGeneration: CreatorBatchGenerationProjection;
  framePlan: CreatorFramePlanProjection;
  videoStage: CreatorVideoStageProjection;
  videoGeneration: CreatorVideoGenerationProjection;
  reviewTray: CreatorReviewTrayProjection;
};
