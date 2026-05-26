import { ShieldAlert } from "lucide-react";
import { Metric, CompactList } from "../common/DiagnosticsPrimitives";
import { getPromptConflictChecker } from "./projections/runtimeDiagnostics";
import type { ProjectRuntimeState } from "../../core/projectState";

export function PromptConflictCheckerDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const checker = getPromptConflictChecker(runtimeState);

  return (
    <section className="machine-panel prompt-conflict-panel">
      <div className="audit-head">
        <ShieldAlert size={17} />
        <span>Prompt Conflict Checker</span>
      </div>
      <div className="summary-grid checker-metrics">
        <Metric label="Reports" value={`${checker.reportCount}`} detail={checker.initialized ? "prompt plans checked" : "Not initialized"} />
        <Metric label="Conflicts" value={`${checker.conflictCount}`} detail="all severities" />
        <Metric label="Blocking" value={`${checker.blockingConflicts}`} detail="blocks envelope readiness" />
        <Metric label="Needs Recompile" value={`${checker.needsRecompile}`} detail="structured source drift" />
      </div>
      {!checker.initialized && (
        <p className="muted-copy generation-empty-state">Prompt Conflict Checker runtime field not initialized; showing defaults.</p>
      )}
      <div className="structured-source-strip">
        <span>Structured sources to update</span>
        <CompactList items={checker.structuredSourcesToUpdate.slice(0, 8)} empty="No structured source updates reported." />
        {checker.structuredSourcesToUpdate.length > 8 && (
          <small className="muted-copy">Showing 8 of {checker.structuredSourcesToUpdate.length} source update(s).</small>
        )}
      </div>
      <div className="pipeline-details checker-details">
        <details open={Boolean(checker.blockers.length)}>
          <summary>Blockers ({checker.blockers.length})</summary>
          <CompactList items={checker.blockers} empty="No conflict checker blockers reported." />
        </details>
        <details>
          <summary>Warnings ({checker.warnings.length})</summary>
          <CompactList items={checker.warnings} empty="No conflict checker warnings reported." />
        </details>
      </div>
    </section>
  );
}
