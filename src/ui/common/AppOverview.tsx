import type { ProjectAudit } from "../../core/types";
import type { RuntimeView } from "../../core/runtimeView";
import { Metric } from "./DiagnosticsPrimitives";

export function AppOverview({ audit, view, blockerCount }: { audit: ProjectAudit; view: RuntimeView; blockerCount: number }) {
  return (
    <section className="overview">
      <Metric label="Story Flow" value={`${audit.shots.length}`} detail={`${view.storySections.length} section(s)`} />
      <Metric label="Visual Memory" value={`${view.visualMemory.existing}/${view.visualMemory.total || audit.metrics.expectedAssets}`} detail="real assets indexed" />
      <Metric label="Queue" value={`${view.queueSummary.ready}/${view.queueSummary.total}`} detail={`${view.queueSummary.blocked} blocked · ${view.queueSummary.parked} parked`} />
      <Metric label="Blockers" value={`${blockerCount + view.preflightSummary.blocked}`} detail={view.nextStep} />
    </section>
  );
}
