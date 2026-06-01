import { LockKeyhole } from "lucide-react";
import type { ProjectRuntimeState } from "../../core/projectState";
import type { VideoPlanningState } from "../../core/types";
import type { VideoReadinessGate, VideoTaskPlan } from "../../core/types/provider";
import { getVideoPlanning, buildMotionEndpointDiagnosticsSummary } from "./projections/runtimeDiagnostics";
import { CompactList, Metric } from "../common/DiagnosticsPrimitives";

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

export function VideoPlanningDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const videoPlanning: VideoPlanningState = getVideoPlanning(runtimeState);
  const queue = videoPlanning.queueShell;
  const policy = videoPlanning.providerPolicySummary;
  const gateCounts = countBy(videoPlanning.readinessGates.map((gate: VideoReadinessGate) => gate.status));
  const planCounts = countBy(videoPlanning.taskPlans.map((plan: VideoTaskPlan) => plan.status));
  const queueCounts = countBy(videoPlanning.taskPlans.map((plan: VideoTaskPlan) => plan.queueStatus));
  const motionSummary = buildMotionEndpointDiagnosticsSummary(videoPlanning);

  return (
    <section className="machine-panel video-planning-diagnostics">
      <div className="audit-head">
        <LockKeyhole size={17} />
        <span>Video Planning</span>
      </div>
      <div className="summary-grid">
        <Metric label="Queue Shell" value={queue.status} detail={`${queue.counts.ready} ready · ${queue.counts.blocked} blocked · ${queue.counts.parked} parked`} />
        <Metric label="Readiness Gates" value={`${videoPlanning.readinessGates.length}`} detail={`${gateCounts.ready || 0} ready · ${gateCounts.blocked || 0} blocked · ${gateCounts.parked || 0} parked`} />
        <Metric label="Task Plans" value={`${videoPlanning.taskPlans.length}`} detail={`${planCounts.ready || 0} ready · ${planCounts.blocked || 0} blocked · ${planCounts.parked || 0} parked`} />
        <Metric label="Provider Lock" value={policy.liveSubmitAllowed ? "unlocked" : "locked"} detail={`${policy.parkedProviderIds.length || 0} parked provider(s)`} />
        <Metric label="Motion Endpoint" value={`${motionSummary.total}`} detail={`${motionSummary.endFrameRequiredCount} end-frame · ${motionSummary.bodyMechanicsRequiredCount} body mechanics`} />
      </div>
      <div className="video-diagnostics-grid">
        <div>
          <h3>Queue Shell</h3>
          <div className="field-grid compact">
            <label>Total</label>
            <span>{queue.counts.total}</span>
            <label>Pending</label>
            <span>{queue.counts.pending}</span>
            <label>Concurrency</label>
            <span>{queue.concurrency.configuredLimit} configured · {queue.concurrency.activeProviderLimit} active</span>
            <label>Auto</label>
            <span>{queue.autoContinuePolicy.enabled ? "enabled" : queue.autoContinuePolicy.mode}</span>
            <label>Timeout</label>
            <span>{queue.longQueueTimeout.stallTimeoutSeconds}s · {queue.longQueueTimeout.action}</span>
            <label>Dry Run</label>
            <span>{queue.dryRunOnly ? "true" : "false"}</span>
          </div>
        </div>
        <div>
          <h3>Provider Policy</h3>
          <div className="field-grid compact">
            <label>Parked</label>
            <span>{policy.videoProvidersRemainParked ? "true" : "false"}</span>
            <label>Provider</label>
            <span>{policy.providerSubmissionForbidden ? "forbidden" : "allowed"}</span>
            <label>Fast</label>
            <span>{policy.fastModelForbidden ? "forbidden" : "allowed"}</span>
            <label>VIP</label>
            <span>{policy.vipChannelForbidden ? "forbidden" : "allowed"}</span>
            <label>T2V</label>
            <span>{policy.textToVideoForbidden ? "forbidden" : "allowed"}</span>
            <label>Providers</label>
            <span>{policy.parkedProviderIds.join(", ") || "none listed"}</span>
          </div>
        </div>
        <div>
          <h3>Task Plan Counts</h3>
          <CompactList
            items={[
              ...Object.entries(queueCounts).map(([status, count]: [string, number]) => `${status}: ${count}`),
              ...videoPlanning.taskPlans.slice(0, 4).map((plan: VideoTaskPlan) => `${plan.shotId} · ${plan.providerId} · ${plan.queueStatus}`),
            ]}
            empty="No video task plans."
          />
        </div>
        <div>
          <h3>Motion Contract</h3>
          <div className="field-grid compact">
            <label>Types</label>
            <span>{Object.entries(motionSummary.typeCounts).map(([type, count]: [string, number]) => `${type}: ${count}`).join(" · ") || "none"}</span>
            <label>Status</label>
            <span>{Object.entries(motionSummary.statusCounts).map(([status, count]: [string, number]) => `${status}: ${count}`).join(" · ") || "none"}</span>
            <label>End Required</label>
            <span>{motionSummary.endFrameRequiredCount}</span>
            <label>Body Mechanics</label>
            <span>{motionSummary.bodyMechanicsRequiredCount}</span>
          </div>
          <CompactList items={motionSummary.compactItems} empty="No motion endpoint facts." />
        </div>
      </div>
      <div className="pipeline-details">
        <details>
          <summary>Queue notes ({queue.notes.length})</summary>
          <CompactList items={[...queue.notes, ...queue.concurrency.notes, ...queue.autoContinuePolicy.notes, ...queue.longQueueTimeout.notes]} empty="No queue shell notes." />
        </details>
        <details>
          <summary>Policy notes ({policy.notes.length})</summary>
          <CompactList items={policy.notes} empty="No provider policy notes." />
        </details>
      </div>
    </section>
  );
}
