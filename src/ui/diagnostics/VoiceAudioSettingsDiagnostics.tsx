import { Radio } from "lucide-react";
import { Metric } from "../common/DiagnosticsPrimitives";
import { buildVoiceAudioSettingsUiSummary } from "./projections/runtimeDiagnostics";
import type { ProjectRuntimeState } from "../../core/projectState";

export function VoiceAudioSettingsDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildVoiceAudioSettingsUiSummary(runtimeState);

  return (
    <section className="machine-panel phase28-voice-audio-panel">
      <div className="audit-head">
        <Radio size={17} />
        <span>Phase 28 Voice/Audio Settings</span>
      </div>
      <div className="summary-grid phase28-metrics">
        <Metric label="Readiness" value={summary.readiness} detail={summary.initialized ? "settings summary" : "blocked/missing"} />
        <Metric label="Voice Sources" value={`${summary.voiceSourceCount}`} detail={summary.voiceSourceDetail} />
        <Metric label="Audio Plans" value={`${summary.audioPlanCount}`} detail={summary.audioPlanDetail} />
        <Metric label="No BGM Policy" value={summary.noBgmPolicy ? "on" : "off"} detail={summary.noBgmDetail} />
        <Metric label="Provider Slots" value={`${summary.providerSlotsPlanned}/${summary.providerSlotsTotal}`} detail={`${summary.providerSlotsLive} live`} />
      </div>
      <div className="phase28-summary-list">
        <div>
          <strong>Blockers / warnings</strong>
          <small>{summary.blockersWarnings.length ? summary.blockersWarnings.slice(0, 4).join(" · ") : "none reported"}</small>
        </div>
        <div>
          <strong>Provider slots planned/live</strong>
          <small>{summary.providerSlotsPlanned} planned · {summary.providerSlotsLive} live · {summary.providerSlotsTotal} total</small>
        </div>
      </div>
      <div className="phase28-lock-strip" aria-label="Phase 28 Voice/Audio Settings hard locks">
        {summary.hardLocks.slice(0, 8).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}
