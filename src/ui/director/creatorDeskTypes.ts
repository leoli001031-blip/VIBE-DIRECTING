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

export type CreatorVideoGenerationStatus = "not_generated" | "submitted" | "queued" | "generating" | "completed" | "recoverable";

export type CreatorVideoGenerationProjection = {
  status: CreatorVideoGenerationStatus;
  statusLabel: string;
  detail: string;
  submittedCount: number;
  queuedCount: number;
  generatingCount: number;
  completedCount: number;
  recoverableCount: number;
  shortSubmitId?: string;
  queuePosition?: number;
  canResume: boolean;
};

export type CreatorDeskProjection = {
  scriptPlanner: CreatorScriptPlannerProjection;
  batchGeneration: CreatorBatchGenerationProjection;
  framePlan: CreatorFramePlanProjection;
  videoGeneration: CreatorVideoGenerationProjection;
  reviewTray: CreatorReviewTrayProjection;
};
