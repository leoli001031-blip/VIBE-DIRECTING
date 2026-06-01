import { Eye } from "lucide-react";
import { Metric, CompactList } from "../common/DiagnosticsPrimitives";
import { buildVisualConsistencyContractUiSummary } from "./projections/runtimeDiagnostics";
import type { ProjectRuntimeState } from "../../core/projectState";

export function VisualConsistencyContractDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildVisualConsistencyContractUiSummary(runtimeState);

  return (
    <section className="machine-panel visual-consistency-contract-panel">
      <div className="audit-head">
        <Eye size={17} />
        <span>Visual Consistency Contract</span>
      </div>
      <div className="summary-grid visual-consistency-contract-metrics">
        <Metric label="Readiness" value={summary.readiness} detail="Phase 37 typed evidence" />
        <Metric label="Typed Gates" value={summary.gateStatus} detail="identity/scene/spatial/keyframe/master QA" />
        <Metric label="Shot Layout" value={summary.shotLayoutStatus} detail="subject/camera/axis/anchors" />
        <Metric label="Spatial Memory" value={summary.geometryStatus} detail="camera vector/world position" />
        <Metric label="Keyframe Pair" value={summary.keyframePairStatus} detail="same-shot end frame must derive" />
        <Metric label="Motion / Repair" value={summary.driftRepairStatus} detail="large drift and semantic OpenCV repair blocked" />
      </div>
      <div className="phase17-rule-strip">
        {summary.requiredGates.map((gate) => (
          <span key={gate}>{gate}</span>
        ))}
      </div>
      <div className="pipeline-details checker-details">
        <details open={Boolean(summary.blockersWarnings.length)}>
          <summary>Phase 37 blockers / warnings ({summary.blockersWarnings.length})</summary>
          <CompactList items={summary.blockersWarnings} empty="No Phase 37 blockers reported." />
        </details>
      </div>
    </section>
  );
}
