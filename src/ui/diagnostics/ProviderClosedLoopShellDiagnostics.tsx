import { LockKeyhole } from "lucide-react";
import { Metric, CompactList } from "../common/DiagnosticsPrimitives";
import { buildProviderClosedLoopShellUiSummary } from "./projections/runtimeDiagnostics";
import type { ProjectRuntimeState } from "../../core/projectState";

export function ProviderClosedLoopShellDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildProviderClosedLoopShellUiSummary(runtimeState);

  return (
    <section className="machine-panel provider-closed-loop-shell-panel">
      <div className="audit-head">
        <LockKeyhole size={17} />
        <span>Phase 41 Provider Closed-loop Shell</span>
      </div>
      <div className="summary-grid provider-closed-loop-shell-metrics">
        <Metric label="Readiness" value={summary.readiness} detail="Phase 41 typed evidence" />
        <Metric label="Provider Shells" value={summary.shellStatus} detail="Image2 + Seedance" />
        <Metric label="Watcher" value={summary.watcherStatus} detail="required" />
        <Metric label="Manifest" value={summary.manifestStatus} detail="required" />
        <Metric label="QA Gate" value={summary.qaStatus} detail="required" />
        <Metric label="Promotion Gate" value={summary.promotionStatus} detail="required" />
        <Metric label="Safety" value={summary.safetyStatus} detail="provider submit/live submit/credential/shell closed" />
      </div>
      <div className="phase17-rule-strip">
        {summary.requiredGates.map((gate) => (
          <span key={gate}>{gate}</span>
        ))}
      </div>
      <div className="pipeline-details checker-details">
        <details open={Boolean(summary.blockersWarnings.length)}>
          <summary>Phase 41 blockers / warnings ({summary.blockersWarnings.length})</summary>
          <CompactList items={summary.blockersWarnings} empty="No Phase 41 blockers reported." />
        </details>
      </div>
    </section>
  );
}
