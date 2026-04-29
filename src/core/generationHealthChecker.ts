import type { FileSnapshot, FileSnapshotEntry, ManifestMatchReport } from "./manifestMatcher";
import type {
  GenerationHealthCheckerFact,
  GenerationHealthCheckerItem,
  GenerationHealthCheckerItemStatus,
  GenerationHealthCheckerState,
  GenerationHealthReport,
  GenerationJob,
  ImageTaskPlan,
  TaskRun,
  WatcherEvent,
} from "./types";

export interface BuildGenerationHealthCheckerInput {
  generatedAt: string;
  imageTaskPlans: ImageTaskPlan[];
  generationHealthReports: GenerationHealthReport[];
  manifestMatches: ManifestMatchReport[];
  watcherEvents: WatcherEvent[];
  taskRuns?: TaskRun[];
  jobs?: GenerationJob[];
  fileSnapshot?: FileSnapshot;
}

type SnapshotMetadata = Omit<FileSnapshotEntry, "path"> & {
  dimensions?: string;
  width?: number;
  height?: number;
  readable?: boolean;
  format?: string;
};

const matchedManifestStatuses = new Set(["actual_output_present", "complete", "matched"]);
const workerSuccessStatuses = new Set(["success"]);
const localTerminalSuccessStatuses = new Set(["succeeded", "success", "completed"]);
const providerTerminalSuccessStatuses = new Set(["succeeded", "success", "completed"]);

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function snapshotMap(snapshot: FileSnapshot = []): Map<string, SnapshotMetadata> {
  if (Array.isArray(snapshot)) {
    return new Map(
      snapshot.map((entry) => {
        if (typeof entry === "string") return [normalizePath(entry), {}];
        const { path, ...metadata } = entry as FileSnapshotEntry & SnapshotMetadata;
        return [normalizePath(path), metadata];
      }),
    );
  }

  return new Map(
    Object.entries(snapshot).map(([path, metadata]) => [
      normalizePath(path),
      metadata === true ? {} : (metadata as SnapshotMetadata),
    ]),
  );
}

function manifestFor(taskPlan: ImageTaskPlan, reports: ManifestMatchReport[]): ManifestMatchReport | undefined {
  return reports.find((report) => report.taskId === taskPlan.taskPlanId || report.taskId === taskPlan.jobId);
}

function healthFor(taskPlan: ImageTaskPlan, reports: GenerationHealthReport[]): GenerationHealthReport | undefined {
  return reports.find((report) => report.taskPlanId === taskPlan.taskPlanId || report.jobId === taskPlan.jobId);
}

function taskRunFor(taskPlan: ImageTaskPlan, taskRuns: TaskRun[] = []): TaskRun | undefined {
  return taskRuns.find((taskRun) => taskRun.taskId === taskPlan.jobId || taskRun.taskId === taskPlan.taskPlanId);
}

function jobFor(taskPlan: ImageTaskPlan, jobs: GenerationJob[] = []): GenerationJob | undefined {
  return jobs.find((job) => job.id === taskPlan.jobId);
}

function scopedWatcherEvents(taskPlan: ImageTaskPlan, watcherEvents: WatcherEvent[]): WatcherEvent[] {
  return watcherEvents.filter((event) => event.taskId === taskPlan.taskPlanId || event.jobId === taskPlan.jobId);
}

function fact(input: Omit<GenerationHealthCheckerFact, "sourceRefs" | "notes"> & { sourceRefs?: string[]; notes?: string[] }): GenerationHealthCheckerFact {
  return {
    factId: input.factId,
    label: input.label,
    status: input.status,
    required: input.required,
    sourceRefs: uniqueSorted(input.sourceRefs || []),
    notes: uniqueSorted(input.notes || []),
  };
}

function hasDimensions(metadata?: SnapshotMetadata): boolean {
  return Boolean(metadata?.dimensions || (typeof metadata?.width === "number" && typeof metadata?.height === "number"));
}

function isReadable(metadata: SnapshotMetadata | undefined, outputExists: boolean): boolean {
  if (!outputExists) return false;
  if (metadata?.readable === false) return false;
  if (typeof metadata?.sizeBytes === "number") return metadata.sizeBytes > 0;
  return metadata !== undefined;
}

function itemStatus(input: {
  taskBlocked: boolean;
  health?: GenerationHealthReport;
  outputExists: boolean;
  manifestMatched: boolean;
  qaCovered: boolean;
  hashVerified: boolean;
  dimensionsVerified: boolean;
  readabilityVerified: boolean;
  postprocessRecoverable: boolean;
  workerExitWithoutOutput: boolean;
  exitArtifactConsistent: boolean;
}): GenerationHealthCheckerItemStatus {
  if (input.taskBlocked || input.health?.healthStatus === "blocked" || input.health?.healthStatus === "failed") return "blocked";
  if (input.postprocessRecoverable) return "postprocess_recoverable";
  if (input.workerExitWithoutOutput) return "worker_exit_without_expected_output";
  if (!input.outputExists) return "waiting";
  if (!input.manifestMatched || !input.hashVerified || !input.dimensionsVerified || !input.readabilityVerified || !input.exitArtifactConsistent) {
    return "artifact_state_mismatch";
  }
  if (!input.qaCovered) return "qa_missing";
  return "verified_success";
}

function nextAction(status: GenerationHealthCheckerItemStatus): string {
  if (status === "verified_success") return "All structured health facts agree; manual promotion gates may inspect this candidate.";
  if (status === "qa_missing") return "Attach explicit QA coverage for the expected output before promotion.";
  if (status === "postprocess_recoverable") return "Recover the temp/candidate artifact through mechanical postprocess, then rerun manifest and QA checks.";
  if (status === "worker_exit_without_expected_output") return "Treat worker completion as untrusted and rerun or repair until expected output exists.";
  if (status === "artifact_state_mismatch") return "Refresh manifest metadata/hash/dimensions/readability facts and resolve mismatched artifact state.";
  if (status === "blocked") return "Resolve upstream generation blockers before health can pass.";
  return "Wait for expected output and manifest facts.";
}

export function buildGenerationHealthCheckerState(input: BuildGenerationHealthCheckerInput): GenerationHealthCheckerState {
  const metadataByPath = snapshotMap(input.fileSnapshot);

  const items = input.imageTaskPlans.map((taskPlan): GenerationHealthCheckerItem => {
    const expectedOutputPath = normalizePath(taskPlan.expectedOutputPath);
    const metadata = metadataByPath.get(expectedOutputPath);
    const health = healthFor(taskPlan, input.generationHealthReports);
    const manifest = manifestFor(taskPlan, input.manifestMatches);
    const watcherEvents = scopedWatcherEvents(taskPlan, input.watcherEvents);
    const taskRun = taskRunFor(taskPlan, input.taskRuns);
    const job = jobFor(taskPlan, input.jobs);
    const expectedOutputExists = Boolean(
      metadata ||
      health?.outputExists ||
      manifest?.actualOutputsPresent.map(normalizePath).includes(expectedOutputPath),
    );
    const manifestStatus = manifest?.status || health?.manifestStatus || "missing_expected_output";
    const manifestMatched = matchedManifestStatuses.has(manifestStatus);
    const tempOutputEvents = watcherEvents.filter((event) => ["temp_output_detected", "provider_ready_derivative_detected"].includes(event.eventType));
    const tempOutputExists = tempOutputEvents.length > 0 || Boolean(manifest?.recoverableOutputs.length);
    const postprocessRecoverable = manifestStatus === "postprocess_recoverable" || watcherEvents.some((event) => event.eventType === "postprocess_recoverable");
    const workerReportedSuccess = Boolean(
      (job?.status && workerSuccessStatuses.has(job.status)) ||
      (taskRun?.localStatus && localTerminalSuccessStatuses.has(taskRun.localStatus)) ||
      (taskRun?.providerStatus && providerTerminalSuccessStatuses.has(taskRun.providerStatus)),
    );
    const workerExitWithoutOutput = !expectedOutputExists && (
      workerReportedSuccess ||
      watcherEvents.some((event) => event.eventType === "worker_exit_without_expected_output")
    );
    const qaCovered = health?.qaStatus === "pass";
    const hashVerified = Boolean(metadata?.hash) || manifestMatched;
    const dimensionsVerified = hasDimensions(metadata) || manifestMatched;
    const readabilityVerified = isReadable(metadata, expectedOutputExists) || manifestMatched;
    const exitArtifactConsistent = !(workerReportedSuccess && !expectedOutputExists);
    const artifactStatusConsistent = expectedOutputExists === manifestMatched || postprocessRecoverable || manifestStatus === "missing_expected_output";
    const status = itemStatus({
      taskBlocked: taskPlan.status === "blocked" || taskPlan.blockers.length > 0,
      health,
      outputExists: expectedOutputExists,
      manifestMatched,
      qaCovered,
      hashVerified,
      dimensionsVerified,
      readabilityVerified,
      postprocessRecoverable,
      workerExitWithoutOutput,
      exitArtifactConsistent,
    });
    const facts = [
      fact({
        factId: "expected_output",
        label: "Expected output exists",
        status: expectedOutputExists ? "pass" : "missing",
        required: true,
        sourceRefs: [taskPlan.expectedOutputPath, health?.reportId || ""],
      }),
      fact({
        factId: "manifest_match",
        label: "Manifest/hash/dimensions/readability match",
        status: manifestMatched ? "pass" : postprocessRecoverable ? "recoverable" : "mismatch",
        required: true,
        sourceRefs: [manifest?.taskId || "", health?.reportId || ""],
        notes: [
          `manifestStatus:${manifestStatus}`,
          hashVerified ? "hash:verified_or_manifest_matched" : "hash:missing",
          dimensionsVerified ? "dimensions:verified_or_manifest_matched" : "dimensions:missing",
          readabilityVerified ? "readability:verified_or_manifest_matched" : "readability:missing",
        ],
      }),
      fact({
        factId: "qa_coverage",
        label: "QA coverage for output",
        status: qaCovered ? "pass" : health?.qaStatus === "pending" ? "pending" : "missing",
        required: true,
        sourceRefs: [health?.reportId || "", ...watcherEvents.filter((event) => event.eventType === "qa_report_detected").map((event) => event.id)],
      }),
      fact({
        factId: "exit_artifact_consistency",
        label: "Worker exit/artifact status consistency",
        status: exitArtifactConsistent && artifactStatusConsistent ? "pass" : "mismatch",
        required: true,
        sourceRefs: [job?.id || "", taskRun?.taskId || "", ...watcherEvents.map((event) => event.id)],
        notes: [workerReportedSuccess ? "worker_reported_success:true" : "worker_reported_success:false"],
      }),
      fact({
        factId: "temp_recovery",
        label: "Temp candidate recovery state",
        status: postprocessRecoverable ? "recoverable" : tempOutputExists ? "pending" : "not_available",
        required: false,
        sourceRefs: [...tempOutputEvents.map((event) => event.id), ...(manifest?.recoverableOutputs || [])],
      }),
    ];
    const blockers = uniqueSorted([
      ...taskPlan.blockers,
      ...(status === "worker_exit_without_expected_output" ? ["Worker reported completion or exited, but expected output is missing."] : []),
      ...(status === "artifact_state_mismatch" ? ["Expected output, manifest metadata, readability, or exit status facts disagree."] : []),
      ...(status === "blocked" ? ["Generation task is blocked by upstream facts."] : []),
    ]);
    const warnings = uniqueSorted([
      ...taskPlan.warnings,
      ...(status === "qa_missing" ? ["QA coverage is missing; worker self-report cannot complete generation."] : []),
      ...(postprocessRecoverable ? ["Temp output exists but expected output postprocess failed; status is recoverable, not success."] : []),
    ]);

    return {
      checkerItemId: `generation_health_checker_${taskPlan.taskPlanId}`,
      taskPlanId: taskPlan.taskPlanId,
      jobId: taskPlan.jobId,
      shotId: taskPlan.shotId,
      expectedOutputPath: taskPlan.expectedOutputPath,
      status,
      expectedOutputExists,
      tempOutputExists,
      postprocessRecoverable,
      manifestStatus,
      manifestMatched,
      hashVerified,
      dimensionsVerified,
      readabilityVerified,
      qaCovered,
      workerReportedSuccess,
      exitArtifactConsistent,
      artifactStatusConsistent,
      facts,
      blockers,
      warnings,
      nextAction: nextAction(status),
    };
  });

  return {
    schemaVersion: "0.1.0",
    generatedAt: input.generatedAt,
    items,
    summary: {
      totalItems: items.length,
      verifiedSuccess: items.filter((item) => item.status === "verified_success").length,
      qaMissing: items.filter((item) => item.status === "qa_missing").length,
      waiting: items.filter((item) => item.status === "waiting").length,
      postprocessRecoverable: items.filter((item) => item.status === "postprocess_recoverable").length,
      workerExitWithoutExpectedOutput: items.filter((item) => item.status === "worker_exit_without_expected_output").length,
      artifactStateMismatch: items.filter((item) => item.status === "artifact_state_mismatch").length,
      blocked: items.filter((item) => item.status === "blocked").length,
      dryRunOnly: true,
      diagnosticsOnly: true,
      liveSubmitAllowed: false,
    },
    hardLocks: {
      dryRunOnly: true,
      diagnosticsOnly: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      workerSelfReportCannotComplete: true,
      expectedOutputRequired: true,
      manifestMetadataRequired: true,
      qaCoverageRequired: true,
      noFileMutation: true,
    },
    dryRunOnly: true,
    diagnosticsOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    noFileMutation: true,
    notes: [
      "Phase 8.9 Generation Health Checker is a structured fact layer; worker self-report never marks success.",
      "Success requires expected output, manifest metadata/hash/dimensions/readability, QA coverage, and exit/artifact consistency.",
      "Temp output plus postprocess failure is surfaced as postprocess_recoverable.",
    ],
  };
}
