import { Gauge } from "lucide-react";
import { Metric } from "../common/DiagnosticsPrimitives";
import { buildLocalOrchestratorUiSummary } from "./projections/runtimeDiagnostics";
import type { ProjectRuntimeState } from "../../core/projectState";

export function LocalOrchestratorDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildLocalOrchestratorUiSummary(runtimeState);

  return (
    <section className="machine-panel phase34-local-orchestrator-panel">
      <div className="audit-head">
        <Gauge size={17} />
        <span>Local Orchestrator / Auto-continue</span>
      </div>
      <div className="summary-grid phase34-metrics">
        <Metric label="Readiness" value={summary.readiness} detail={summary.initialized ? "read-only queue state" : "blocked/missing"} />
        <Metric label="Queue Total" value={`${summary.queueTotal}`} detail="planned items" />
        <Metric label="Ready" value={`${summary.ready}`} detail={`${summary.nextReadyCount} next-ready`} />
        <Metric label="Waiting" value={`${summary.waiting}`} detail="held by earlier facts" />
        <Metric label="Running / Output" value={`${summary.runningPlanned} / ${summary.waitingOutput}`} detail="planned / waiting output" />
        <Metric label="QA Pending" value={`${summary.qaPending}`} detail={`${summary.needsReview} needs review`} />
        <Metric label="Blocked" value={`${summary.blocked + summary.failed}`} detail={`${summary.failed} failed`} />
        <Metric label="Complete Verified" value={`${summary.completeVerified}`} detail="verified complete" />
        <Metric label="Stalled" value={`${summary.stalled}`} detail="timeout/watch evidence" />
        <Metric label="Auto-continue" value={`${summary.nextReadyCount}`} detail={summary.autoContinueMode} />
      </div>
      <div className="phase34-summary-list">
        <div>
          <strong>Queue state</strong>
          <small>{summary.queueTotal} total · {summary.ready} ready · {summary.waiting} waiting · {summary.runningPlanned} running planned · {summary.waitingOutput} waiting output</small>
        </div>
        <div>
          <strong>Review gates</strong>
          <small>{summary.qaPending} QA pending · {summary.needsReview} needs review · {summary.stalled} stalled</small>
        </div>
        <div>
          <strong>Resolution</strong>
          <small>{summary.blocked} blocked · {summary.failed} failed · {summary.completeVerified} complete verified</small>
        </div>
        <div>
          <strong>Provider / file / daemon locks</strong>
          <small>{summary.providerFileDaemonLocks}</small>
        </div>
        <div>
          <strong>Blockers / warnings</strong>
          <small>{summary.blockersWarnings.length ? summary.blockersWarnings.slice(0, 5).join(" · ") : "none reported"}</small>
        </div>
      </div>
      <div className="phase34-lock-strip" aria-label="Phase 34 Local Orchestrator hard locks">
        {summary.hardLocks.slice(0, 10).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}
