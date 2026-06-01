import { LockKeyhole } from "lucide-react";
import { Metric, CompactList } from "../common/DiagnosticsPrimitives";
import { buildWorkerRuntimeGateUiSummary } from "./projections/runtimeDiagnostics";
import type { ProjectRuntimeState } from "../../core/projectState";

export function WorkerRuntimeGateDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildWorkerRuntimeGateUiSummary(runtimeState);

  return (
    <section className="machine-panel worker-runtime-gate-panel">
      <div className="audit-head">
        <LockKeyhole size={17} />
        <span>Phase 40 Worker Runtime Gate</span>
      </div>
      <div className="summary-grid worker-runtime-gate-metrics">
        <Metric label="Readiness" value={summary.readiness} detail="Phase 40 typed evidence" />
        <Metric label="Runtime Contract" value={summary.contractStatus} detail="worker runtime contract defined" />
        <Metric label="Default Gate" value={summary.gateStatus} detail="default gated off" />
        <Metric label="Input" value={summary.inputStatus} detail="validated envelope only" />
        <Metric label="Output" value={summary.outputStatus} detail="structured result only" />
        <Metric label="Execution Paths" value={summary.executionStatus} detail="spawn/resume/daemon/shell/credential/file/provider/free-text closed" />
      </div>
      <div className="phase17-rule-strip">
        {summary.requiredGates.map((gate) => (
          <span key={gate}>{gate}</span>
        ))}
      </div>
      <div className="pipeline-details checker-details">
        <details open={Boolean(summary.blockersWarnings.length)}>
          <summary>Phase 40 blockers / warnings ({summary.blockersWarnings.length})</summary>
          <CompactList items={summary.blockersWarnings} empty="No Phase 40 blockers reported." />
        </details>
      </div>
    </section>
  );
}
