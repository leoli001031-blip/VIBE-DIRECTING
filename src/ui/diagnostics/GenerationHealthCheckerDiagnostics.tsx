import { ListChecks } from "lucide-react";
import { Metric, CompactList, StatusPill } from "../common/DiagnosticsPrimitives";
import { getGenerationHealthChecker } from "./projections/runtimeDiagnostics";
import type { ProjectRuntimeState } from "../../core/projectState";

export function GenerationHealthCheckerDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const checker = getGenerationHealthChecker(runtimeState);
  const visibleFacts = checker.factChainSummary.slice(0, 6);

  return (
    <section className="machine-panel health-checker-panel">
      <div className="audit-head">
        <ListChecks size={17} />
        <span>Generation Health Checker</span>
      </div>
      <div className="summary-grid checker-metrics">
        <Metric label="Reports" value={`${checker.reportCount}`} detail={checker.initialized ? "fact chain coverage" : "Not initialized"} />
        <Metric label="Postprocess Recoverable" value={`${checker.postprocessRecoverable}`} detail="recoverable only; no semantic repair" />
        <Metric label="Worker Mismatch" value={`${checker.workerSelfReportMismatch}`} detail="self-report differs from evidence" />
        <Metric label="QA Coverage Missing" value={`${checker.qaCoverageMissing}`} detail="missing explicit QA signal" />
      </div>
      {!checker.initialized && (
        <p className="muted-copy generation-empty-state">Generation Health Checker runtime field not initialized; showing defaults.</p>
      )}
      <div className="checker-fact-table">
        {visibleFacts.map((fact) => (
          <div key={fact.id} className="checker-fact-row">
            <div>
              <strong>{fact.label}</strong>
              <small>{fact.sourceRefs.join(" · ") || fact.id}</small>
            </div>
            <StatusPill value={fact.status} />
            <small>{fact.detail}</small>
          </div>
        ))}
        {checker.initialized && !visibleFacts.length && <p className="muted-copy">No fact chain rows reported.</p>}
      </div>
      <div className="pipeline-details checker-details">
        <details open={Boolean(checker.blockers.length)}>
          <summary>Blockers ({checker.blockers.length})</summary>
          <CompactList items={checker.blockers} empty="No health checker blockers reported." />
        </details>
        <details>
          <summary>Warnings ({checker.warnings.length})</summary>
          <CompactList items={checker.warnings} empty="No health checker warnings reported." />
        </details>
      </div>
    </section>
  );
}
