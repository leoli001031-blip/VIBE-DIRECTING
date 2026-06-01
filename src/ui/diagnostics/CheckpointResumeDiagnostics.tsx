import { ListChecks } from "lucide-react";
import { Metric, CompactList, StatusPill } from "../common/DiagnosticsPrimitives";
import { getCheckpointResumeHarness } from "./projections/runtimeDiagnostics";
import type { CheckpointResumeHarnessState } from "./projections/runtimeDiagnostics";
import type { ProjectRuntimeState } from "../../core/projectState";

function checkpointMetricValue(harness: CheckpointResumeHarnessState, value?: number) {
  return harness.hasSummary && typeof value === "number" ? `${value}` : "Not initialized";
}

function checkpointMetricDetail(harness: CheckpointResumeHarnessState, detail: string) {
  return harness.hasSummary ? detail : "runtimeState.checkpointResumeHarness.summary missing";
}

function watcherBooleanLabel(value: boolean | undefined, trueLabel: string, falseLabel: string) {
  if (typeof value !== "boolean") return "Not initialized";
  return value ? trueLabel : falseLabel;
}

export function CheckpointResumeDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const harness = getCheckpointResumeHarness(runtimeState);
  const summary = harness.summary;
  const visibleItems = harness.resumeItems.slice(0, 8);
  const lockRows = [
    {
      label: "dry-run only",
      value: watcherBooleanLabel(harness.hardLocks.dryRunOnly, "locked", "not locked"),
    },
    {
      label: "no file mutation",
      value: watcherBooleanLabel(harness.hardLocks.noFileMutation, "locked", "not locked"),
    },
    {
      label: "no auto skip without QA",
      value: watcherBooleanLabel(harness.hardLocks.noAutoSkipWithoutQa, "locked", "not locked"),
    },
    {
      label: "worker self-report cannot complete",
      value: watcherBooleanLabel(harness.hardLocks.workerSelfReportCannotComplete, "locked", "not locked"),
    },
    {
      label: "temp candidate cannot resume as formal",
      value: watcherBooleanLabel(harness.hardLocks.tempCandidateCannotResumeAsFormal, "locked", "not locked"),
    },
  ];

  return (
    <section className="machine-panel checkpoint-resume-panel">
      <div className="audit-head">
        <ListChecks size={17} />
        <span>Checkpoint Resume Harness</span>
      </div>
      <div className="summary-grid checkpoint-resume-metrics">
        <Metric label="Items" value={checkpointMetricValue(harness, summary.totalItems)} detail={checkpointMetricDetail(harness, "resume candidates")} />
        <Metric label="Skip allowed" value={checkpointMetricValue(harness, summary.skipAllowed)} detail={checkpointMetricDetail(harness, "safe to skip after QA")} />
        <Metric label="Rerun allowed" value={checkpointMetricValue(harness, summary.rerunAllowed)} detail={checkpointMetricDetail(harness, "eligible for rerun")} />
        <Metric label="Manual review" value={checkpointMetricValue(harness, summary.manualReviewRequired)} detail={checkpointMetricDetail(harness, "human decision required")} />
        <Metric label="Blocked" value={checkpointMetricValue(harness, summary.blocked)} detail={checkpointMetricDetail(harness, "cannot resume automatically")} />
        <Metric label="Missing output" value={checkpointMetricValue(harness, summary.missingExpectedOutput)} detail={checkpointMetricDetail(harness, "expected path absent")} />
        <Metric label="Formal ready" value={checkpointMetricValue(harness, summary.formalReady)} detail={checkpointMetricDetail(harness, "formal assets present")} />
      </div>

      <div className="watcher-lock-strip checkpoint-lock-strip">
        {lockRows.map((lock) => (
          <div key={lock.label}>
            <span>{lock.label}</span>
            <StatusPill value={lock.value} />
          </div>
        ))}
      </div>

      {!harness.initialized && (
        <p className="muted-copy generation-empty-state">Checkpoint Resume Harness not initialized in this runtime state.</p>
      )}

      <div className="checkpoint-resume-table">
        {!harness.hasResumeItems && <p className="muted-copy">Not initialized</p>}
        {harness.hasResumeItems && !visibleItems.length && <p className="muted-copy">No resume items reported.</p>}
        {visibleItems.map((item, index) => {
          const shotTask = item.shotId || item.taskPlanId || item.jobId || "Not initialized";
          const harnessLink = item.generationHarnessJobId || "Not initialized";
          return (
            <details key={`${item.resumeItemId}-${index}`} className="checkpoint-resume-row">
              <summary>
                <span>
                  <strong>{shotTask}</strong>
                  <small>{item.taskPlanId || item.resumeItemId}</small>
                </span>
                <StatusPill value={item.resumeStatus || "Not initialized"} />
                <StatusPill value={item.resumeDecision || "Not initialized"} />
                <span className="checkpoint-flag-group">
                  <StatusPill value={watcherBooleanLabel(item.skipAllowed, "skip allowed", "skip blocked")} />
                  <StatusPill value={watcherBooleanLabel(item.rerunAllowed, "rerun allowed", "rerun blocked")} />
                  <StatusPill value={watcherBooleanLabel(item.manualReviewRequired, "manual review", "review not required")} />
                </span>
                <span className="checkpoint-gate-group">
                  <small>manifest: {item.manifestStatus || "Not initialized"}</small>
                  <small>health: {item.healthStatus || "Not initialized"}</small>
                  <small>QA: {item.qaStatus || "Not initialized"}</small>
                </span>
                <span>
                  <strong>{harnessLink}</strong>
                  <small>{item.generationHarnessJobId ? "harness link" : "missing harness link"}</small>
                </span>
              </summary>
              <div className="checkpoint-resume-details">
                <small>watcher streams: {item.hasWatcherStreamIds ? item.watcherStreamIds.join(", ") || "None reported" : "Not initialized"}</small>
                <small>expected: {item.expectedOutputPath || "Not initialized"}</small>
                <small>candidate: {item.candidatePath || "Not initialized"}</small>
                <small>formal: {item.formalPath || "Not initialized"}</small>
                <small>blocking reasons: {item.hasBlockingReasons ? `${item.blockingReasons.length}` : "Not initialized"}</small>
                <CompactList items={[...item.blockingReasons, ...item.notes]} empty="No blocking reasons or notes reported." />
              </div>
            </details>
          );
        })}
        {harness.resumeItems.length > visibleItems.length && (
          <small className="muted-copy watcher-more">Showing {visibleItems.length} of {harness.resumeItems.length} resume item(s).</small>
        )}
      </div>
    </section>
  );
}
