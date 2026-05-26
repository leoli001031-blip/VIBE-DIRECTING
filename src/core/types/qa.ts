import type { BaseHardLocks, Severity, GateStatus } from "./base";
import type { QaPromotionStatus } from "./task";

export type QaHarnessDimensionId =
  | "whole_film"
  | "identity"
  | "scene"
  | "pair"
  | "story"
  | "prop"
  | "style"
  | "motion"
  | "audio";

export type QaHarnessSourceLayer =
  | "generationHealthReports"
  | "qaPromotionReports"
  | "manifestMatches"
  | "assetReadinessReports"
  | "promptPlans"
  | "promptConflictReports"
  | "generationHarness"
  | "filesystemWatcherHarness"
  | "checkpointResumeHarness"
  | "videoPlanning"
  | "audioPlanning"
  | "storyFlow.shots";

export interface QaHarnessHardLocks extends BaseHardLocks {
  noAutoPromotion: true;
  semanticRepairForbidden: true;
  workerSelfReportCannotPassQa: true;
  overallFirst: true;
}

export interface QaHarnessSourceCoverageEntry {
  layer: QaHarnessSourceLayer;
  referenced: boolean;
  referenceCount: number;
  sourceRefs: string[];
  notes: string[];
}

export interface QaHarnessDimensionResult {
  dimensionId: QaHarnessDimensionId;
  status: GateStatus;
  severity: Severity;
  blockers: string[];
  warnings: string[];
  sourceRefs: string[];
  notes: string[];
}

export interface QaHarnessOverallSequence {
  sequenceId: string;
  overallFirst: true;
  dimensions: QaHarnessDimensionResult[];
  status: GateStatus;
  severity: Severity;
  requiresHumanReview: boolean;
  blockers: string[];
  warnings: string[];
  sourceCoverage: QaHarnessSourceCoverageEntry[];
  notes: string[];
}

export interface QaHarnessItem {
  qaItemId: string;
  shotId: string;
  taskPlanId?: string;
  jobId?: string;
  harnessJobId?: string;
  checkpointResumeItemId?: string;
  videoTaskPlanId?: string;
  audioPlanId?: string;
  dimensions: QaHarnessDimensionResult[];
  formalPromotionEligible: boolean;
  formalPromotionBlockedReasons: string[];
  requiresHumanReview: boolean;
  sourceCoverage: QaHarnessSourceCoverageEntry[];
  notes: string[];
}

export interface QaHarnessState {
  schemaVersion: string;
  generatedAt: string;
  dimensionOrder: QaHarnessDimensionId[];
  overall: QaHarnessOverallSequence;
  items: QaHarnessItem[];
  summary: {
    totalItems: number;
    requiresHumanReview: number;
    formalPromotionEligible: number;
    formalPromotionBlocked: number;
    failedItems: number;
    partialItems: number;
    unknownItems: number;
    overallStatus: GateStatus;
    overallFirst: true;
    dryRunOnly: true;
    liveSubmitAllowed: false;
    noFileMutation: true;
  };
  sourceCoverage: QaHarnessSourceCoverageEntry[];
  hardLocks: QaHarnessHardLocks;
  dryRunOnly: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  noFileMutation: true;
  noAutoPromotion: true;
  planOnly: true;
  diagnosticsOnly: true;
  notes: string[];
}
