import { PlugZap } from "lucide-react";
import type { ProjectRuntimeState } from "../../core/projectState";
import { Metric, StatusPill, statusLabel } from "../common/DiagnosticsPrimitives";

function boolLockLabel(value: boolean) {
  return value ? "allowed" : "false / locked";
}

// Mirrors the AdapterContractState type defined in App.tsx.
type AdapterContractState = ProjectRuntimeState["adapterContracts"];

export function AdapterContractDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const contracts: AdapterContractState = runtimeState.adapterContracts;
  const summary = contracts.summary;
  const providerContracts = contracts.providerAdapters;
  const workerContracts = contracts.workerAdapters;
  const lockedProviderCount = providerContracts.filter((adapter) => adapter.providerSubmissionForbidden).length;
  const readOnlyCount = providerContracts.filter((adapter) => adapter.readOnly && adapter.dryRunOnly).length;

  return (
    <section className="machine-panel adapter-contract-diagnostics">
      <div className="audit-head">
        <PlugZap size={17} />
        <span>Adapter Contract Diagnostics</span>
      </div>
      <div className="summary-grid">
        <Metric label="Agent Contracts" value={`${summary.agentAdapters.length}`} detail={summary.agentAdapters.join(", ") || "none"} />
        <Metric label="Worker Contracts" value={`${summary.workerAdapters.length}`} detail={summary.workerAdapters.join(", ") || "none"} />
        <Metric label="Provider Contracts" value={`${summary.providerAdapters.length}`} detail={`${readOnlyCount} read-only dry-run · ${lockedProviderCount} provider locked`} />
        <Metric label="Violations" value={`${summary.contractViolations.length}`} detail="contract validation blockers" />
      </div>
      <div className="adapter-contract-locks video-rule-strip">
        <span>Contract: read-only diagnostics</span>
        <span>Active image provider: {summary.activeImageProvider || "none"}</span>
        <span>Parked video providers: {summary.parkedVideoProviders.join(", ") || "none"}</span>
        <span>liveSubmitAllowed: {boolLockLabel(summary.liveSubmitAllowed)}</span>
        <span>credentialStorage: {String(summary.credentialStorage)}</span>
      </div>
      <div className="adapter-contract-grid">
        <div>
          <h3>Provider Contracts</h3>
          <div className="adapter-contract-list">
            {providerContracts.map((adapter) => (
              <div key={adapter.id} className="adapter-contract-row">
                <div className="row-head">
                  <strong>{adapter.id}</strong>
                  <StatusPill value={adapter.state} />
                </div>
                <div className="field-grid compact">
                  <label>Slot</label>
                  <span>{adapter.slot}</span>
                  <label>requiredModes</label>
                  <span>{adapter.requiredModes.join(", ")}</span>
                  <label>capabilityRefs</label>
                  <span>{adapter.capabilityRefs.length}</span>
                  <label>Contract</label>
                  <span>dryRunOnly {String(adapter.dryRunOnly)} · readOnly {String(adapter.readOnly)}</span>
                  <label>liveSubmitAllowed</label>
                  <span>{boolLockLabel(adapter.liveSubmitAllowed)}</span>
                  <label>Provider</label>
                  <span>{adapter.providerSubmissionForbidden ? "locked / forbidden" : "allowed"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3>Worker Envelope / Context Packet</h3>
          <div className="adapter-contract-list">
            {workerContracts.map((adapter) => (
              <div key={adapter.id} className="adapter-contract-row">
                <div className="row-head">
                  <strong>{adapter.id}</strong>
                  <StatusPill value={adapter.state} />
                </div>
                <div className="field-grid compact">
                  <label>Envelope</label>
                  <span>{adapter.requiredEnvelopeSchema}</span>
                  <label>Context</label>
                  <span>{adapter.mustReceiveContextPacket ? "required" : "optional"}</span>
                  <label>Bypass</label>
                  <span>{adapter.canBypassEnvelope ? "allowed" : "false / locked"}</span>
                  <label>Read</label>
                  <span>{adapter.readScopePolicy}</span>
                  <label>Write</label>
                  <span>{adapter.writeScopePolicy}</span>
                  <label>Modes</label>
                  <span>{adapter.allowedPurposes.join(", ")}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="settings-list adapter-violation-list">
            <div>
              <strong>Contract Violations</strong>
              <small>{summary.contractViolations.length ? `${summary.contractViolations.length} violation(s)` : "none · provider locked · dry-run only"}</small>
            </div>
            {summary.contractViolations.slice(0, 4).map((violation) => (
              <div key={`${violation.adapterId}-${violation.code}`}>
                <strong>{violation.adapterId}</strong>
                <small>{violation.severity} · {statusLabel(violation.code)} · {violation.detail}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
