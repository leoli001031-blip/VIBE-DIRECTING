import { PlugZap } from "lucide-react";
import type { ProjectRuntimeState } from "../../core/projectState";
import { buildCliAdapterSpikeUiSummary } from "./projections/runtimeDiagnostics";
import { Metric } from "../common/DiagnosticsPrimitives";

export function CliAdapterSpikeDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildCliAdapterSpikeUiSummary(runtimeState);

  return (
    <section className="machine-panel phase29-agent-adapter-panel">
      <div className="audit-head">
        <PlugZap size={17} />
        <span>Agent CLI Adapter Spike</span>
      </div>
      <div className="summary-grid phase29-metrics">
        <Metric label="Readiness" value={summary.readiness} detail={summary.initialized ? "Phase 29 contract-only" : "blocked/missing"} />
        <Metric label="Contract Mode" value={summary.contractMode} detail="adapter shape only" />
        <Metric label="Replacement Proof" value={summary.replacementProof} detail="Phase 26 required" />
        <Metric label="Input Source" value={summary.inputSource} detail="no free text task" />
        <Metric label="Spawn / Resume" value={summary.spawnResumeShape} detail="not executed" />
        <Metric label="Provider Submit" value={summary.providerSubmit} detail="blocked" />
      </div>
      <div className="phase29-summary-list">
        <div>
          <strong>Boundary</strong>
          <small>{summary.mutationBoundary}</small>
        </div>
        <div>
          <strong>Blocked / warnings</strong>
          <small>{[...summary.blockers, ...summary.warnings].slice(0, 4).join(" · ") || "none"}</small>
        </div>
      </div>
      <div className="phase29-lock-strip" aria-label="Phase 29 Agent CLI Adapter Spike hard locks">
        {summary.hardLocks.slice(0, 8).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}
