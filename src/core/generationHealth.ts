import type { FileSnapshot, ManifestMatchReport } from "./manifestMatcher";
import type {
  AssetReadinessReport,
  GenerationHealthReport,
  GenerationHealthStatus,
  GenerationQaStatus,
  ImageTaskPlan,
  ShotPromptPlan,
  WatcherEvent,
} from "./types";

export interface BuildGenerationHealthReportsInput {
  imageTaskPlans: ImageTaskPlan[];
  fileSnapshot: FileSnapshot;
  manifestReports?: ManifestMatchReport[];
  watcherEvents?: WatcherEvent[];
  assetReadinessReports?: AssetReadinessReport[];
  promptPlans?: ShotPromptPlan[];
  qaStatusByOutputPath?: Record<string, GenerationQaStatus>;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function snapshotPaths(snapshot: FileSnapshot): Set<string> {
  if (Array.isArray(snapshot)) {
    return new Set(snapshot.map((entry) => (typeof entry === "string" ? entry : entry.path)).map(normalizePath));
  }

  return new Set(Object.keys(snapshot).map(normalizePath));
}

function manifestReportFor(taskPlan: ImageTaskPlan, reports: ManifestMatchReport[]): ManifestMatchReport | undefined {
  return reports.find((report) => report.taskId === taskPlan.jobId || report.taskId === taskPlan.taskPlanId);
}

function hasManifestMatch(status: string): boolean {
  return ["actual_output_present", "complete", "matched"].includes(status);
}

function promptIsStale(taskPlan: ImageTaskPlan, promptPlan?: ShotPromptPlan): boolean {
  if (!promptPlan) return false;
  return promptPlan.promptPlanHash !== taskPlan.sourcePromptPlanHash || promptPlan.sourceShotSpecHash !== taskPlan.sourceShotSpecHash;
}

function qaStatusFor(taskPlan: ImageTaskPlan, outputExists: boolean, input: BuildGenerationHealthReportsInput): GenerationQaStatus {
  const configured = input.qaStatusByOutputPath?.[taskPlan.expectedOutputPath] || input.qaStatusByOutputPath?.[normalizePath(taskPlan.expectedOutputPath)];
  if (configured) return configured;
  if (!outputExists) return "missing";
  const hasReportEvent = input.watcherEvents?.some(
    (event) => event.eventType === "qa_report_detected" && (event.taskId === taskPlan.taskPlanId || event.jobId === taskPlan.jobId),
  );
  return hasReportEvent ? "pending" : "missing";
}

function healthStatus(input: {
  blocked: boolean;
  outputExists: boolean;
  manifestMatched: boolean;
  stalePrompt: boolean;
  assetReady: boolean;
  qaStatus: GenerationQaStatus;
}): GenerationHealthStatus {
  if (input.blocked || input.stalePrompt || (input.outputExists && !input.assetReady)) return "blocked";
  if (!input.outputExists || !input.manifestMatched) return "waiting";
  if (input.qaStatus === "fail") return "failed";
  if (input.qaStatus === "missing" || input.qaStatus === "pending" || input.qaStatus === "unknown") return "qa_pending";
  if (input.qaStatus === "pass" && input.assetReady) return "formal_ready";
  return "output_detected";
}

function nextActionFor(status: GenerationHealthStatus): string {
  if (status === "formal_ready") return "Ready for QA promotion review.";
  if (status === "qa_pending") return "Wait for explicit QA pass before formal promotion.";
  if (status === "waiting") return "Wait for expected output and rerun manifest match.";
  if (status === "failed") return "Review failing QA and regenerate or repair.";
  if (status === "blocked") return "Resolve blockers before promotion.";
  return "Output detected; run QA gate next.";
}

export function buildGenerationHealthReports(input: BuildGenerationHealthReportsInput): GenerationHealthReport[] {
  const paths = snapshotPaths(input.fileSnapshot);

  return input.imageTaskPlans.map((taskPlan) => {
    const expectedPath = normalizePath(taskPlan.expectedOutputPath);
    const manifestReport = manifestReportFor(taskPlan, input.manifestReports || []);
    const manifestStatus = manifestReport?.status || (paths.has(expectedPath) ? "actual_output_present" : "missing_expected_output");
    const outputExists = paths.has(expectedPath) || hasManifestMatch(manifestStatus);
    const promptPlan = input.promptPlans?.find((plan) => plan.promptPlanId === taskPlan.promptPlanId);
    const stalePrompt = promptIsStale(taskPlan, promptPlan);
    const readinessReport = input.assetReadinessReports?.find((report) => report.shotId === taskPlan.shotId);
    const assetReadinessStatus = readinessReport?.status || "missing";
    const assetReady = Boolean(readinessReport && readinessReport.status === "ready" && !readinessReport.formalBlocked);
    const qaStatus = qaStatusFor(taskPlan, outputExists, input);
    const manifestMatched = hasManifestMatch(manifestStatus);
    const blockers = [
      ...taskPlan.blockers,
      ...(taskPlan.status === "blocked" ? ["Image task plan is blocked."] : []),
      ...(outputExists ? [] : ["Expected output is missing from the file snapshot."]),
      ...(manifestMatched ? [] : [`Manifest status is ${manifestStatus}.`]),
      ...(stalePrompt ? ["Prompt plan hash differs from the image task plan source hash."] : []),
      ...(readinessReport && !assetReady ? readinessReport.blockers : []),
    ];
    const warnings = [
      ...taskPlan.warnings,
      ...(readinessReport?.warnings || []),
      ...(readinessReport ? [] : ["No asset readiness report was available for this task plan."]),
      ...(qaStatus === "missing" || qaStatus === "pending" ? ["Missing explicit QA pass; worker success cannot promote formal output."] : []),
    ];
    const status = healthStatus({
      blocked: taskPlan.status === "blocked" || taskPlan.blockers.length > 0,
      outputExists,
      manifestMatched,
      stalePrompt,
      assetReady,
      qaStatus,
    });

    return {
      reportId: `generation_health_${taskPlan.taskPlanId}`,
      taskPlanId: taskPlan.taskPlanId,
      jobId: taskPlan.jobId,
      shotId: taskPlan.shotId,
      expectedOutputPath: taskPlan.expectedOutputPath,
      outputExists,
      manifestStatus,
      qaStatus,
      stalePrompt,
      assetReadinessStatus,
      healthStatus: status,
      blockers: Array.from(new Set(blockers.filter(Boolean))).sort(),
      warnings: Array.from(new Set(warnings.filter(Boolean))).sort(),
      nextAction: nextActionFor(status),
    };
  });
}
