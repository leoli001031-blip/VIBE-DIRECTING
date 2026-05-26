import { FileJson } from "lucide-react";
import type { ProjectRuntimeState } from "../../core/projectState";
import { buildExportWorkerUiSummary } from "./projections/runtimeDiagnostics";
import { Metric } from "../common/DiagnosticsPrimitives";

export function ExportWorkerDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildExportWorkerUiSummary(runtimeState);

  return (
    <section className="machine-panel phase27-export-worker-panel">
      <div className="audit-head">
        <FileJson size={17} />
        <span>Export Worker Diagnostics</span>
      </div>
      <div className="summary-grid phase27-metrics">
        <Metric label="Readiness" value={summary.readiness} detail={summary.initialized ? "runtimeState.exportWorker" : "blocked/missing"} />
        <Metric label="Scope" value={summary.scope} detail="export/project IO only" />
        <Metric label="Planned Writes" value={`${summary.plannedWriteCount}`} detail={summary.plannedWriteCount ? "scoped plan entries" : "blocked/missing"} />
        <Metric label="Export Root" value={summary.exportRoot} detail="compact root label" />
      </div>
      <div className="phase27-summary-list">
        <div>
          <strong>Blocked / warnings</strong>
          <small>{summary.blockersWarnings.slice(0, 4).join(" · ")}</small>
        </div>
        <div>
          <strong>Planned writes</strong>
          <small>{summary.plannedWriteSamples.length ? summary.plannedWriteSamples.join(" · ") : "blocked/missing"}</small>
        </div>
      </div>
      <div className="phase27-lock-strip" aria-label="Phase 27 hard locks">
        {summary.hardLocks.slice(0, 8).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}
