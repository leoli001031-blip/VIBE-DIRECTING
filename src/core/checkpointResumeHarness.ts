import type { FileSnapshot, ManifestMatchReport } from "./manifestMatcher";
import type {
  CheckpointResumeDecision,
  CheckpointResumeHarnessItem,
  CheckpointResumeHarnessState,
  CheckpointResumeStatus,
  FilesystemWatcherHarnessState,
  GenerationHarnessState,
  GenerationHealthReport,
  ImageTaskPlan,
  QaPromotionReport,
} from "./types";

export interface BuildCheckpointResumeHarnessInput {
  generatedAt: string;
  fileSnapshot: FileSnapshot;
  manifestMatches: ManifestMatchReport[];
  imageTaskPlans: ImageTaskPlan[];
  generationHealthReports: GenerationHealthReport[];
  qaPromotionReports: QaPromotionReport[];
  generationHarness: GenerationHarnessState;
  filesystemWatcherHarness: FilesystemWatcherHarnessState;
}

export const checkpointResumeHarnessHardLocks: CheckpointResumeHarnessState["hardLocks"] = {
  dryRunOnly: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
  noFileMutation: true,
  noAutoSkipWithoutQa: true,
  workerSelfReportCannotComplete: true,
  tempCandidateCannotResumeAsFormal: true,
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function snapshotPaths(snapshot: FileSnapshot): Set<string> {
  if (Array.isArray(snapshot)) {
    return new Set(snapshot.map((entry) => normalizePath(typeof entry === "string" ? entry : entry.path)));
  }

  return new Set(Object.keys(snapshot).map(normalizePath));
}

function snapshotPathCount(snapshot: FileSnapshot): number {
  return Array.isArray(snapshot) ? snapshot.length : Object.keys(snapshot).length;
}

function manifestReportFor(taskPlan: ImageTaskPlan, reports: ManifestMatchReport[]): ManifestMatchReport | undefined {
  return reports.find((report) => report.taskId === taskPlan.jobId || report.taskId === taskPlan.taskPlanId);
}

function hasManifestMatch(status: string): boolean {
  return ["actual_output_present", "complete", "matched"].includes(status);
}

function hasSourceHashMismatch(taskPlan: ImageTaskPlan): boolean {
  return Boolean(
    taskPlan.taskEnvelopeSummary &&
      ((taskPlan.taskEnvelopeSummary.promptPlanHash &&
        taskPlan.taskEnvelopeSummary.promptPlanHash !== taskPlan.sourcePromptPlanHash) ||
        (taskPlan.taskEnvelopeSummary.sourceShotSpecHash &&
          taskPlan.taskEnvelopeSummary.sourceShotSpecHash !== taskPlan.sourceShotSpecHash)),
  );
}

function statusFor(input: {
  skipAllowed: boolean;
  manualReviewRequired: boolean;
  rerunAllowed: boolean;
  blocked: boolean;
}): CheckpointResumeStatus {
  if (input.skipAllowed) return "skip_ready";
  if (input.blocked) return "blocked";
  if (input.manualReviewRequired) return "manual_review_required";
  if (input.rerunAllowed) return "rerun_required";
  return "waiting";
}

function decisionFor(input: {
  skipAllowed: boolean;
  staleSource: boolean;
  expectedOutputExists: boolean;
  hasTempOrDerivative: boolean;
  canPromoteToFormal: boolean;
  blocked: boolean;
}): CheckpointResumeDecision {
  if (input.skipAllowed) return "skip_existing_formal";
  if (input.staleSource) return "rerun_stale_source";
  if (!input.expectedOutputExists) return "rerun_missing_expected_output";
  if (input.hasTempOrDerivative) return "manual_review_temp_or_derivative";
  if (input.canPromoteToFormal) return "manual_promote_or_review_candidate";
  if (input.blocked) return "blocked_by_generation_gate";
  return "wait_for_qa_or_promotion";
}

export function buildCheckpointResumeHarnessState(input: BuildCheckpointResumeHarnessInput): CheckpointResumeHarnessState {
  const paths = snapshotPaths(input.fileSnapshot);
  const healthByTaskPlan = new Map(input.generationHealthReports.map((report) => [report.taskPlanId, report]));
  const promotionByTaskPlan = new Map(input.qaPromotionReports.map((report) => [report.taskPlanId, report]));
  const generationJobByTaskPlan = new Map(input.generationHarness.jobs.map((job) => [job.taskPlanId, job]));
  const streamsByTaskPlan = new Map<string, FilesystemWatcherHarnessState["streams"]>();

  for (const stream of input.filesystemWatcherHarness.streams) {
    const scoped = streamsByTaskPlan.get(stream.taskPlanId) || [];
    scoped.push(stream);
    streamsByTaskPlan.set(stream.taskPlanId, scoped);
  }

  const items = input.imageTaskPlans.map((taskPlan): CheckpointResumeHarnessItem => {
    const health = healthByTaskPlan.get(taskPlan.taskPlanId);
    const promotion = promotionByTaskPlan.get(taskPlan.taskPlanId);
    const manifestReport = manifestReportFor(taskPlan, input.manifestMatches);
    const generationJob = generationJobByTaskPlan.get(taskPlan.taskPlanId);
    const watcherStreams = streamsByTaskPlan.get(taskPlan.taskPlanId) || [];
    const watcherStreamIds = uniqueSorted(watcherStreams.map((stream) => stream.streamId));
    const candidatePath = promotion?.candidatePath || generationJob?.candidateOutput.candidatePath || taskPlan.expectedOutputPath;
    const formalPath = promotion?.formalPath || generationJob?.candidateOutput.formalPath;
    const expectedOutputPath = taskPlan.expectedOutputPath;
    const expectedOutputExists = Boolean(health?.outputExists) || paths.has(normalizePath(expectedOutputPath));
    const candidatePathExists = Boolean(candidatePath && paths.has(normalizePath(candidatePath)));
    const formalPathExists = Boolean(formalPath && paths.has(normalizePath(formalPath)));
    const manifestStatus = health?.manifestStatus || manifestReport?.status || "missing_expected_output";
    const manifestMatched = hasManifestMatch(manifestStatus);
    const qaStatus = health?.qaStatus || "unknown";
    const staleSource = Boolean(health?.stalePrompt) || hasSourceHashMismatch(taskPlan);
    const hasTempOrDerivative = watcherStreams.some((stream) =>
      ["temp_candidate", "provider_ready_derivative", "postprocess_recoverable"].includes(stream.artifactClass),
    );
    const workerSelfReportOnly = watcherStreams.some((stream) => stream.artifactClass === "worker_exit_without_expected_output");
    const canPromoteToFormal = Boolean(promotion?.canPromoteToFormal);
    const blockedByGate = taskPlan.status === "blocked" || health?.healthStatus === "blocked" || health?.healthStatus === "failed";
    const formalGatePassed = canPromoteToFormal && manifestMatched && qaStatus === "pass" && !staleSource;
    const skipAllowed = formalGatePassed && formalPathExists && !hasTempOrDerivative;
    const missingExpectedOutput = !expectedOutputExists;
    const rerunAllowed = !skipAllowed && (missingExpectedOutput || staleSource || health?.healthStatus === "failed" || workerSelfReportOnly);
    const manualReviewRequired =
      !skipAllowed &&
      (hasTempOrDerivative ||
        (expectedOutputExists && !formalPathExists) ||
        (expectedOutputExists && (!manifestMatched || qaStatus !== "pass" || !canPromoteToFormal)));
    const blockingReasons = uniqueSorted([
      ...(taskPlan.status === "blocked" ? ["Image task plan is blocked."] : []),
      ...(missingExpectedOutput ? ["Expected output is missing; resume plan may only propose a dry-run rerun."] : []),
      ...(manifestMatched ? [] : [`Manifest status is ${manifestStatus}; skip is blocked.`]),
      ...(qaStatus === "pass" ? [] : [`QA status is ${qaStatus}; skip requires explicit QA pass.`]),
      ...(canPromoteToFormal ? [] : ["QA promotion gate has not set canPromoteToFormal=true."]),
      ...(staleSource ? ["Prompt or source hash mismatch blocks skip."] : []),
      ...(hasTempOrDerivative ? ["Temp/candidate/provider-ready derivatives require manual review or rerun; they cannot resume as formal."] : []),
      ...(workerSelfReportOnly ? ["Worker/provider self-report cannot complete a task."] : []),
      ...(formalGatePassed && !formalPathExists ? ["Formal path is not present in the file snapshot; automatic skip is blocked."] : []),
      ...(health?.blockers || []),
      ...(promotion?.blockers || []),
    ]);
    const resumeStatus = statusFor({
      skipAllowed,
      manualReviewRequired,
      rerunAllowed,
      blocked: blockedByGate && !rerunAllowed && !manualReviewRequired,
    });
    const resumeDecision = decisionFor({
      skipAllowed,
      staleSource,
      expectedOutputExists,
      hasTempOrDerivative,
      canPromoteToFormal,
      blocked: blockedByGate,
    });

    return {
      resumeItemId: `checkpoint_resume_${taskPlan.taskPlanId}`,
      taskPlanId: taskPlan.taskPlanId,
      jobId: taskPlan.jobId,
      shotId: taskPlan.shotId,
      harnessJobId: generationJob?.harnessJobId,
      expectedOutputPath,
      candidatePath,
      formalPath,
      candidatePathExists,
      formalPathExists,
      expectedOutputExists,
      manifestStatus,
      healthStatus: health?.healthStatus || "missing",
      qaStatus,
      promotionStatus: promotion?.promotionStatus,
      canPromoteToFormal,
      watcherStreamIds,
      resumeStatus,
      resumeDecision,
      skipAllowed,
      rerunAllowed,
      manualReviewRequired,
      blockingReasons,
      notes: uniqueSorted([
        "Phase 8.6 Checkpoint Resume Harness emits a plan only; it does not skip, rerun, move, delete, copy, or submit.",
        ...(formalGatePassed
          ? ["Manifest, QA, and promotion gates pass; skip still requires an existing formal path."]
          : ["File existence, expected-output detection, and worker self-report are not completion gates."]),
      ]),
    };
  });

  return {
    schemaVersion: "0.1.0",
    generatedAt: input.generatedAt,
    items: items.sort((left, right) => left.resumeItemId.localeCompare(right.resumeItemId)),
    summary: {
      totalItems: items.length,
      skipAllowed: items.filter((item) => item.skipAllowed).length,
      rerunAllowed: items.filter((item) => item.rerunAllowed).length,
      manualReviewRequired: items.filter((item) => item.manualReviewRequired).length,
      blocked: items.filter((item) => item.resumeStatus === "blocked").length,
      missingExpectedOutput: items.filter((item) => !item.expectedOutputExists).length,
      linkedWatcherStreams: items.reduce((count, item) => count + item.watcherStreamIds.length, 0),
      linkedGenerationHarnessJobs: items.filter((item) => item.harnessJobId).length,
      dryRunOnly: true,
      liveSubmitAllowed: false,
      noFileMutation: true,
    },
    hardLocks: checkpointResumeHarnessHardLocks,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    noFileMutation: true,
    planOnly: true,
    notes: [
      `Derived from ${input.imageTaskPlans.length} image task plans, ${snapshotPathCount(input.fileSnapshot)} file snapshot entries, ${input.generationHarness.jobs.length} generation harness jobs, and ${input.filesystemWatcherHarness.streams.length} watcher streams.`,
      "Skip is allowed only for existing formal outputs that also pass manifest, explicit QA, and promotion gates.",
      "Missing expected outputs produce rerun-allowed dry-run plans only; no provider submission is performed.",
    ],
  };
}
