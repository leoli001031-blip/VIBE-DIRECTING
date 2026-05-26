import { FileJson } from "lucide-react";
import { Metric, CompactList } from "../common/DiagnosticsPrimitives";
import { buildFullTaskSubagentPacketPlannerUiSummary } from "./projections/runtimeDiagnostics";
import type { ProjectRuntimeState } from "../../core/projectState";

export function FullTaskSubagentPacketPlannerDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildFullTaskSubagentPacketPlannerUiSummary(runtimeState);

  return (
    <section className="machine-panel full-task-subagent-packet-planner-panel">
      <div className="audit-head">
        <FileJson size={17} />
        <span>Full Task Subagent Packet Planner</span>
      </div>
      <div className="summary-grid full-task-subagent-packet-planner-metrics">
        <Metric label="Readiness" value={summary.readiness} detail="Phase 38 typed evidence" />
        <Metric label="Task Coverage" value={summary.coverageStatus} detail="production task kinds" />
        <Metric label="Validated Packet" value={summary.packetStatus} detail="formal task input contract" />
        <Metric label="Expected Outputs" value={summary.outputStatus} detail="worker completion contract" />
        <Metric label="Source / Knowledge Trace" value={summary.traceStatus} detail="source fact trace + knowledge trace" />
        <Metric label="Free Text" value={summary.freeTextStatus} detail="worker/task route guard" />
        <Metric label="Routes" value={summary.routeStatus} detail="worker/provider/file/credential/shell" />
      </div>
      <div className="phase17-rule-strip">
        {summary.requiredGates.map((gate) => (
          <span key={gate}>{gate}</span>
        ))}
      </div>
      <div className="pipeline-details checker-details">
        <details open={Boolean(summary.blockersWarnings.length)}>
          <summary>Phase 38 blockers / warnings ({summary.blockersWarnings.length})</summary>
          <CompactList items={summary.blockersWarnings} empty="No Phase 38 blockers reported." />
        </details>
      </div>
    </section>
  );
}
