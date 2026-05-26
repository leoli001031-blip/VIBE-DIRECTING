import { ListChecks } from "lucide-react";
import type { ProjectRuntimeState } from "../../core/projectState";
import { buildSubagentWorkerRuntimePlan, type SubagentWorkerRuntimePlan } from "../../core/subagentWorkerRuntime";
import { Metric, statusLabel } from "../common/DiagnosticsPrimitives";

function buildSubagentWorkerRuntimeView(runtimeState: ProjectRuntimeState): SubagentWorkerRuntimePlan {
  return buildSubagentWorkerRuntimePlan({
    generatedAt: runtimeState.generatedAt,
    envelopes: runtimeState.videoExecutionPreview.previews
      .map((preview) => preview.subagentTaskEnvelope)
      .filter(Boolean),
  });
}

export function SubagentWorkerRuntimeDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const plan = buildSubagentWorkerRuntimeView(runtimeState);
  const visibleSlots = plan.slots.slice(0, 6);

  return (
    <section className="machine-panel">
      <div className="audit-head">
        <ListChecks size={17} />
        <span>Subagent Worker Runtime</span>
      </div>
      <div className="summary-grid">
        <Metric label="Worker Plans" value={`${plan.summary.totalSlots}`} detail={statusLabel(plan.runtimeMode)} />
        <Metric label="Permission Gate" value={`${plan.summary.readyForPermissionGate}`} detail="validated envelopes" />
        <Metric label="Structured Results" value={`${plan.summary.resultAcceptedForHandoff}`} detail={`${plan.summary.resultRejected} rejected`} />
        <Metric label="Free Text" value={`${plan.summary.freeTextBlocked}`} detail="blocked" />
      </div>
      <div className="field-grid compact">
        <label>Spawn</label>
        <span>{plan.summary.canSpawnNow} now · permission gated · validated envelope only</span>
        <label>Project Store</label>
        <span>{plan.summary.canWriteProjectStoreNow} writes now · structured result required</span>
        <label>Provider</label>
        <span>{plan.summary.providerSubmissionForbidden ? "submission forbidden" : "allowed"} · live {String(plan.summary.liveSubmitAllowed)}</span>
      </div>
      <div className="settings-list">
        {visibleSlots.map((slot) => (
          <div key={slot.workerSlotId}>
            <strong>{slot.envelopeId || slot.workerSlotId}</strong>
            <small>{slot.status} · envelope {slot.envelopeValidation.status} · result {slot.resultGate.resultStatus}</small>
            {slot.resultGate.outputHash && <small>outputHash: {slot.resultGate.outputHash.slice(0, 12)}…</small>}
          </div>
        ))}
        {!visibleSlots.length && (
          <div>
            <strong>No worker plans</strong>
            <small>Validated SubagentTaskEnvelope packets are required before a worker runtime plan appears.</small>
          </div>
        )}
      </div>
    </section>
  );
}
