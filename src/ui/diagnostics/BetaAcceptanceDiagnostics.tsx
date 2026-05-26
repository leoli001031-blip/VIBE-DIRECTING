import { ListChecks } from "lucide-react";
import { Metric, CompactList } from "../common/DiagnosticsPrimitives";
import { buildBetaAcceptanceUiSummary } from "./projections/runtimeDiagnostics";
import type { ProjectRuntimeState } from "../../core/projectState";

export function BetaAcceptanceDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildBetaAcceptanceUiSummary(runtimeState);

  return (
    <section className="machine-panel beta-acceptance-panel">
      <div className="audit-head">
        <ListChecks size={17} />
        <span>Phase 42 Beta Acceptance</span>
      </div>
      <div className="summary-grid beta-acceptance-metrics">
        <Metric label="Readiness" value={summary.readiness} detail="Phase 42 typed evidence" />
        <Metric label="Mac/Windows" value={summary.desktopStatus} detail="desktop readiness" />
        <Metric label="Project / Export" value={summary.projectExportStatus} detail="save/open + preview/export" />
        <Metric label="Runtime Gates" value={summary.runtimeGateStatus} detail="queue, visual, knowledge, worker" />
        <Metric label="Provider Gate" value={summary.providerStatus} detail="closed-loop shell + provider gate" />
        <Metric label="Tests" value={summary.testStatus} detail="test matrix" />
        <Metric label="Closure" value={summary.closureStatus} detail="no additional phases planned" />
      </div>
      <div className="phase17-rule-strip">
        {summary.requiredGates.map((gate) => (
          <span key={gate}>{gate}</span>
        ))}
      </div>
      <div className="pipeline-details checker-details">
        <details open={Boolean(summary.blockersWarnings.length)}>
          <summary>Phase 42 blockers / warnings ({summary.blockersWarnings.length})</summary>
          <CompactList items={summary.blockersWarnings} empty="No Phase 42 blockers reported." />
        </details>
      </div>
    </section>
  );
}
