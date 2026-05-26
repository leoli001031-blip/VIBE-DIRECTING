import { FileJson } from "lucide-react";
import { Metric, CompactList } from "../common/DiagnosticsPrimitives";
import { buildKnowledgePackUserManagementUiSummary } from "./projections/runtimeDiagnostics";
import type { ProjectRuntimeState } from "../../core/projectState";

export function KnowledgePackUserManagementDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildKnowledgePackUserManagementUiSummary(runtimeState);

  return (
    <section className="machine-panel knowledge-pack-user-management-panel">
      <div className="audit-head">
        <FileJson size={17} />
        <span>Phase 39 Knowledge Pack User Management</span>
      </div>
      <div className="summary-grid knowledge-pack-user-management-metrics">
        <Metric label="Readiness" value={summary.readiness} detail="typed evidence only" />
        <Metric label="User Flows" value={summary.userFlowStatus} detail="import/create/enable/disable" />
        <Metric label="Checks" value={summary.checkStatus} detail="version/hash/dependency" />
        <Metric label="Route / Conflict" value={summary.routeConflictStatus} detail="route test + conflict detection" />
        <Metric label="Hard Gates" value={summary.overrideStatus} detail="override forbidden" />
        <Metric label="Injection" value={summary.injectionStatus} detail="scoped verified packs" />
        <Metric label="References" value={summary.promotionStatus} detail="formal promotion gated" />
      </div>
      <div className="phase17-rule-strip">
        {summary.requiredGates.map((gate) => (
          <span key={gate}>{gate}</span>
        ))}
      </div>
      <div className="pipeline-details checker-details">
        <details open={Boolean(summary.blockersWarnings.length)}>
          <summary>Phase 39 blockers / warnings ({summary.blockersWarnings.length})</summary>
          <CompactList items={summary.blockersWarnings} empty="No Phase 39 blockers reported." />
        </details>
      </div>
    </section>
  );
}
