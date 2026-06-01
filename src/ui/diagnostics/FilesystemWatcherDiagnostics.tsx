import { Database } from "lucide-react";
import { Metric, CompactList, StatusPill } from "../common/DiagnosticsPrimitives";
import { getFilesystemWatcherHarness } from "./projections/runtimeDiagnostics";
import type { FilesystemWatcherHarnessState } from "./projections/runtimeDiagnostics";
import type { ProjectRuntimeState } from "../../core/projectState";

function watcherMetricValue(harness: FilesystemWatcherHarnessState, value?: number) {
  return harness.hasSummary && typeof value === "number" ? `${value}` : "Not initialized";
}

function watcherMetricDetail(harness: FilesystemWatcherHarnessState, detail: string) {
  return harness.hasSummary ? detail : "runtimeState.filesystemWatcherHarness.summary missing";
}

function watcherBooleanLabel(value: boolean | undefined, trueLabel: string, falseLabel: string) {
  if (typeof value !== "boolean") return "Not initialized";
  return value ? trueLabel : falseLabel;
}

export function FilesystemWatcherDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const harness = getFilesystemWatcherHarness(runtimeState);
  const summary = harness.summary;
  const visibleStreams = harness.streams.slice(0, 8);
  const rootRows = harness.monitoredRoots.slice(0, 6);
  const lockRows = [
    {
      label: "Watcher cannot promote formal",
      value: watcherBooleanLabel(harness.locks.watcherCannotPromoteFormal, "locked", "not locked"),
    },
    {
      label: "Temp output draft only",
      value: watcherBooleanLabel(harness.locks.tempOutputDraftOnly, "draft only", "not locked"),
    },
    {
      label: "No semantic postprocess",
      value: watcherBooleanLabel(harness.locks.semanticPostprocessForbidden, "forbidden", "not locked"),
    },
    {
      label: "Provider submission",
      value: watcherBooleanLabel(harness.locks.providerSubmissionForbidden ?? summary.providerSubmissionForbidden, "forbidden", "not locked"),
    },
    {
      label: "Live submit",
      value: watcherBooleanLabel(harness.locks.liveSubmitAllowed ?? summary.liveSubmitAllowed, "allowed", "not allowed"),
    },
  ];

  return (
    <section className="machine-panel filesystem-watcher-panel">
      <div className="audit-head">
        <Database size={17} />
        <span>Filesystem Watcher Harness</span>
      </div>
      <div className="summary-grid filesystem-watcher-metrics">
        <Metric label="Events" value={watcherMetricValue(harness, summary.totalEvents)} detail={watcherMetricDetail(harness, `${summary.blockedEvents || 0} blocked`)} />
        <Metric label="Temp/Candidate" value={watcherMetricValue(harness, summary.tempCandidates)} detail={watcherMetricDetail(harness, `${summary.promotableArtifacts || 0} promotable`)} />
        <Metric label="Expected" value={watcherMetricValue(harness, summary.expectedOutputs)} detail={watcherMetricDetail(harness, "expected output paths")} />
        <Metric label="QA Reports" value={watcherMetricValue(harness, summary.qaReports)} detail={watcherMetricDetail(harness, "QA evidence files")} />
        <Metric label="Manifest Mismatch" value={watcherMetricValue(harness, summary.manifestMismatches)} detail={watcherMetricDetail(harness, "manifest gate failures")} />
        <Metric label="Draft Only" value={watcherMetricValue(harness, summary.draftOnlyArtifacts)} detail={watcherMetricDetail(harness, "cannot become formal automatically")} />
        <Metric label="Linked Harness" value={watcherMetricValue(harness, summary.linkedHarnessJobs)} detail={watcherMetricDetail(harness, `${summary.missingHarnessLinks || 0} missing link(s)`)} />
      </div>

      <div className="watcher-lock-strip">
        {lockRows.map((lock) => (
          <div key={lock.label}>
            <span>{lock.label}</span>
            <StatusPill value={lock.value} />
          </div>
        ))}
      </div>

      {!harness.initialized && (
        <p className="muted-copy generation-empty-state">Filesystem Watcher Harness not initialized in this runtime state.</p>
      )}

      <div className="watcher-diagnostics-grid">
        <div>
          <h3>Monitored Roots</h3>
          {!harness.hasMonitoredRoots && <p className="muted-copy">Not initialized</p>}
          {harness.hasMonitoredRoots && !rootRows.length && <p className="muted-copy">No monitored roots reported.</p>}
          {Boolean(rootRows.length) && (
            <div className="watcher-root-table">
              {rootRows.map((root) => (
                <div key={root.id} className="watcher-root-row">
                  <span>
                    <strong>{root.label}</strong>
                    <small>{root.id}</small>
                  </span>
                  <span>
                    <StatusPill value={root.status} />
                    <small>{root.kind}</small>
                  </span>
                  <small>{root.pathHint || "No path hint"}</small>
                  <small>{root.notes.join(" · ") || "No notes"}</small>
                </div>
              ))}
              {harness.monitoredRoots.length > rootRows.length && (
                <small className="muted-copy watcher-more">Showing {rootRows.length} of {harness.monitoredRoots.length} monitored roots.</small>
              )}
            </div>
          )}
        </div>

        <div>
          <h3>Watcher Streams</h3>
          {!harness.hasStreams && <p className="muted-copy">Not initialized</p>}
          {harness.hasStreams && !visibleStreams.length && <p className="muted-copy">No watcher events reported.</p>}
          {Boolean(visibleStreams.length) && (
            <div className="watcher-stream-table">
              {visibleStreams.map((stream) => {
                const shotTask = stream.shotId || stream.taskPlanId || stream.jobId || "unassigned";
                const harnessLink = stream.harnessJobId || stream.jobId || "missing";
                return (
                  <details key={stream.streamId} className="watcher-stream-row">
                    <summary>
                      <span>
                        <strong>{shotTask}</strong>
                        <small>{stream.eventType} · {stream.streamId}</small>
                      </span>
                      <span>{stream.artifactClass}</span>
                      <StatusPill value={stream.status} />
                      <StatusPill value={watcherBooleanLabel(stream.draftOnly, "draft only", "not draft only")} />
                      <StatusPill value={watcherBooleanLabel(stream.canPromoteFormal, "can promote", "cannot promote")} />
                      <span>
                        <strong>{harnessLink}</strong>
                        <small>{stream.harnessJobId ? "linked" : "missing link"}</small>
                      </span>
                    </summary>
                    <div className="watcher-stream-details">
                      <small>severity: {stream.severity}</small>
                      <small>artifact: {stream.artifactPath || "Not initialized"}</small>
                      <small>expected: {stream.expectedOutputPath || "Not initialized"}</small>
                      <small>future reference: {watcherBooleanLabel(stream.canBecomeFutureReference, "allowed", "blocked")}</small>
                      <small>requires manifest: {watcherBooleanLabel(stream.requiresManifestMatch, "yes", "no")}</small>
                      <small>requires QA: {watcherBooleanLabel(stream.requiresQaPass, "yes", "no")}</small>
                      <CompactList items={[...stream.blockingReasons, ...stream.notes]} empty="No blocking reasons or notes reported." />
                    </div>
                  </details>
                );
              })}
              {harness.streams.length > visibleStreams.length && (
                <small className="muted-copy watcher-more">Showing {visibleStreams.length} of {harness.streams.length} watcher stream event(s).</small>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
