import { Sparkles } from "lucide-react";
import type { ProjectRuntimeState } from "../../core/projectState";
import { buildPhase17ImageKeyframeRuntimeSummary } from "./projections/runtimeDiagnostics";
import { CompactList, Metric, StatusPill } from "../common/DiagnosticsPrimitives";

type Phase17LoopRow = {
  label: string;
  status: string;
  detail: string;
};

export function Image2KeyframeRuntimeDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildPhase17ImageKeyframeRuntimeSummary(runtimeState);

  return (
    <section className="machine-panel phase17-runtime-panel">
      <div className="audit-head">
        <Sparkles size={17} />
        <span>Image2 Asset + Keyframe Runtime</span>
      </div>
      <div className="summary-grid phase17-metrics">
        <Metric label="Runtime Plan" value={summary.status} detail="Phase 17 Diagnostics only" />
        <Metric label="Image2 Assets" value={`${summary.assetPlanCount}`} detail="reference asset task plans" />
        <Metric label="Keyframe Plans" value={`${summary.startFramePlanCount}/${summary.endFramePlanCount}`} detail="start / end frame plans" />
        <Metric label="Keyframe Pair" value={`${summary.validPairCount}/${summary.pairGateCount}`} detail="valid pair gates" />
        <Metric label="Motion Facts" value={`${summary.startPlanMotionFactCount}/${summary.endPlanMotionFactCount}`} detail={`${summary.blockedPairMotionBlockerCount} blocked pair motion blocker(s)`} />
        <Metric label="Closed Loop" value={`${summary.closedLoopEvidenceCount}`} detail="watcher, health, QA evidence" />
        <Metric label="Provider Locks" value={`${summary.providerLockCount}`} detail="live submit remains disabled" />
      </div>
      <div className="phase17-loop-grid" aria-label="Phase 17 Image2 runtime closed loop">
        {summary.rows.map((row: Phase17LoopRow) => (
          <div key={row.label} className="phase17-loop-row">
            <strong>{row.label}</strong>
            <StatusPill value={row.status} />
            <small>{row.detail}</small>
          </div>
        ))}
      </div>
      <div className="phase17-rule-strip">
        <span>Diagnostics-only runtime summary</span>
        <span>Image2 runtime details stay out of the Director surface</span>
        <span>End-frame derivation must stay tied to the approved start frame</span>
        <span>Provider locks remain active</span>
      </div>
      <div className="pipeline-details checker-details">
        <details open={Boolean(summary.blockers.length)}>
          <summary>Phase 17 blockers ({summary.blockers.length})</summary>
          <CompactList items={summary.blockers} empty="No Phase 17 blockers reported." />
        </details>
        <details>
          <summary>Phase 17 warnings ({summary.warnings.length})</summary>
          <CompactList items={summary.warnings} empty="No Phase 17 warnings reported." />
        </details>
      </div>
    </section>
  );
}
