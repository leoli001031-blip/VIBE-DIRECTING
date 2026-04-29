import type { FileSnapshot, ManifestMatchReport } from "./manifestMatcher";
import type { Image2AdapterRequest, ImageTaskPlan, Severity, WatcherEvent, WatcherEventStatus, WatcherEventType } from "./types";

export interface BuildWatcherEventsInput {
  imageTaskPlans: ImageTaskPlan[];
  adapterRequests: Image2AdapterRequest[];
  fileSnapshot: FileSnapshot;
  manifestReports?: ManifestMatchReport[];
  createdAt?: string;
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

function basename(path: string): string {
  const parts = normalizePath(path).split("/");
  return parts[parts.length - 1] || path;
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function eventId(eventType: WatcherEventType, taskPlan: ImageTaskPlan, artifactPath?: string): string {
  return `watcher_${eventType}_${taskPlan.taskPlanId}_${hashString(artifactPath || taskPlan.expectedOutputPath)}`;
}

function watcherEvent(
  eventType: WatcherEventType,
  taskPlan: ImageTaskPlan,
  status: WatcherEventStatus,
  severity: Severity,
  createdAt: string,
  notes: string[],
  artifactPath?: string,
): WatcherEvent {
  return {
    id: eventId(eventType, taskPlan, artifactPath),
    eventType,
    taskId: taskPlan.taskPlanId,
    jobId: taskPlan.jobId,
    shotId: taskPlan.shotId,
    artifactPath,
    expectedOutputPath: taskPlan.expectedOutputPath,
    status,
    severity,
    createdAt,
    notes,
  };
}

function isTempCandidate(path: string): boolean {
  return /(^|\/)(tmp|temp|cache|candidates?|drafts?)(\/|$)/i.test(normalizePath(path)) || /[_\-.](tmp|temp|candidate|draft)\./i.test(path);
}

function isQaReport(path: string): boolean {
  return /(^|\/)(qa|reports?)(\/|$)/i.test(normalizePath(path)) || /qa|quality|audit/i.test(basename(path));
}

function matchesTaskPath(path: string, taskPlan: ImageTaskPlan): boolean {
  const haystack = normalizePath(path).toLowerCase();
  return [taskPlan.taskPlanId, taskPlan.jobId, taskPlan.shotId, basename(taskPlan.expectedOutputPath)]
    .filter(Boolean)
    .some((token) => haystack.includes(String(token).toLowerCase()));
}

function manifestReportFor(taskPlan: ImageTaskPlan, reports: ManifestMatchReport[]): ManifestMatchReport | undefined {
  return reports.find((report) => report.taskId === taskPlan.jobId || report.taskId === taskPlan.taskPlanId);
}

export function buildWatcherEventsFromImagePipeline(input: BuildWatcherEventsInput): WatcherEvent[] {
  const createdAt = input.createdAt || new Date().toISOString();
  const paths = snapshotPaths(input.fileSnapshot);
  const normalizedPaths = Array.from(paths);
  const adapterTaskIds = new Set(input.adapterRequests.map((request) => request.taskPlanId));
  const events: WatcherEvent[] = [];

  for (const taskPlan of input.imageTaskPlans) {
    const expectedPath = normalizePath(taskPlan.expectedOutputPath);
    const expectedExists = paths.has(expectedPath);
    const manifestReport = manifestReportFor(taskPlan, input.manifestReports || []);

    if (taskPlan.status === "blocked" || taskPlan.blockers.length > 0) {
      events.push(
        watcherEvent(
          "blocked",
          taskPlan,
          "blocked",
          "blocker",
          createdAt,
          taskPlan.blockers.length ? taskPlan.blockers : ["Image task plan is blocked."],
        ),
      );
    }

    if (expectedExists) {
      events.push(
        watcherEvent(
          "expected_output_detected",
          taskPlan,
          "detected",
          "info",
          createdAt,
          ["Expected output exists in the imported file snapshot."],
          taskPlan.expectedOutputPath,
        ),
      );
    }

    const tempCandidates = normalizedPaths.filter((path) => path !== expectedPath && isTempCandidate(path) && matchesTaskPath(path, taskPlan));
    for (const tempPath of tempCandidates) {
      events.push(
        watcherEvent("temp_output_detected", taskPlan, "detected", "warning", createdAt, ["Temp or candidate output is draft-only."], tempPath),
      );
    }

    const providerReadyCandidates = normalizedPaths.filter(
      (path) => path !== expectedPath && !isTempCandidate(path) && !isQaReport(path) && matchesTaskPath(path, taskPlan),
    );
    for (const candidatePath of providerReadyCandidates) {
      events.push(
        watcherEvent(
          "provider_ready_derivative_detected",
          taskPlan,
          "detected",
          "info",
          createdAt,
          ["A non-formal derivative exists and still needs manifest/QA gates before promotion."],
          candidatePath,
        ),
      );
    }

    const qaReports = normalizedPaths.filter((path) => isQaReport(path) && matchesTaskPath(path, taskPlan));
    for (const qaReportPath of qaReports) {
      events.push(watcherEvent("qa_report_detected", taskPlan, "detected", "info", createdAt, ["QA report artifact detected."], qaReportPath));
    }

    if (manifestReport?.status === "postprocess_recoverable") {
      const recoverablePaths = manifestReport.recoverableOutputs.length ? manifestReport.recoverableOutputs : [manifestReport.outputMatches[0]?.actualPath].filter(Boolean);
      for (const recoverablePath of recoverablePaths) {
        events.push(
          watcherEvent(
            "postprocess_recoverable",
            taskPlan,
            "recoverable",
            "warning",
            createdAt,
            ["Expected output is missing, but a recoverable derivative exists."],
            recoverablePath,
          ),
        );
      }
    }

    if (manifestReport && manifestReport.status !== "actual_output_present" && manifestReport.status !== "complete") {
      events.push(
        watcherEvent(
          "manifest_mismatch_detected",
          taskPlan,
          "failed",
          expectedExists ? "warning" : "blocker",
          createdAt,
          [manifestReport.missingExpectedOutputs.length ? "Manifest still reports missing expected output." : `Manifest status is ${manifestReport.status}.`],
        ),
      );
    }

    if (!expectedExists && adapterTaskIds.has(taskPlan.taskPlanId) && taskPlan.status !== "blocked") {
      events.push(
        watcherEvent(
          "worker_exit_without_expected_output",
          taskPlan,
          "failed",
          "warning",
          createdAt,
          ["Adapter request exists, but expected output is absent; worker self-report cannot mark the task complete."],
        ),
      );
    }
  }

  return events.sort((left, right) => left.id.localeCompare(right.id));
}
