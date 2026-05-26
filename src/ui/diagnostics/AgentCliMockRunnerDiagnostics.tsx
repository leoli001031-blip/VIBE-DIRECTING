import { PlugZap } from "lucide-react";
import type { ProjectRuntimeState } from "../../core/projectState";
import { buildAgentCliMockRunnerUiSummary } from "./projections/runtimeDiagnostics";
import { Metric } from "../common/DiagnosticsPrimitives";

export function AgentCliMockRunnerDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildAgentCliMockRunnerUiSummary(runtimeState);

  return (
    <section className="machine-panel phase26-runner-panel">
      <div className="audit-head">
        <PlugZap size={17} />
        <span>Agent/CLI Mock Runner</span>
      </div>
      <div className="summary-grid phase26-metrics">
        <Metric label="Runner Kind" value={summary.runnerKind} detail={summary.initialized ? "Phase 26 mock/no-op" : "blocked/missing"} />
        <Metric label="Replacement Proof" value={summary.replacementProof} detail="replaceable runner contract" />
        <Metric label="Readiness" value={summary.readiness} detail="ready/blocked only" />
        <Metric label="No-op Results" value={`${summary.noopResultCount}`} detail="structured no-op count" />
      </div>
      <div className="phase26-lock-strip" aria-label="Phase 26 hard locks">
        {summary.hardLocks.slice(0, 8).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}
