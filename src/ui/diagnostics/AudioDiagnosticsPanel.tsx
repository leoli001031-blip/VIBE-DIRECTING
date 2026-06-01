import { Radio } from "lucide-react";
import type { AudioPlanningState } from "../../core/types";
import { CompactList, Metric, statusLabel } from "../common/DiagnosticsPrimitives";

export function AudioDiagnosticsPanel({ audioPlanning }: { audioPlanning: AudioPlanningState }) {
  const plannedSlots = audioPlanning.providerSlots.filter((slot) => slot.state === "planned").length;
  const liveSlots = audioPlanning.providerSlots.filter((slot) => slot.liveSubmitAllowed).length;
  const registry = audioPlanning.voiceSourceRegistry;
  const exportSummary = audioPlanning.exportPackageSummary;
  const ttsPlanning = audioPlanning.ttsProviderPlanning;

  return (
    <section className="machine-panel audio-diagnostics-panel">
      <div className="audit-head">
        <Radio size={17} />
        <span>Audio Planning</span>
      </div>
      <div className="summary-grid">
        <Metric label="Shot Plans" value={`${audioPlanning.shotPlans.length}`} detail="AudioPlan contracts" />
        <Metric label="Preview Mix" value={`${audioPlanning.previewMix.eventCount}`} detail="placeholder event(s)" />
        <Metric label="Missing Output" value={`${audioPlanning.previewMix.missingOutputPathCount}`} detail="planned audio paths" />
        <Metric label="Provider Slots" value={`${plannedSlots}/${audioPlanning.providerSlots.length}`} detail={`${liveSlots} live · submit forbidden`} />
        <Metric label="TTS Routes" value={`${ttsPlanning?.providers.length || 0}`} detail={`${ttsPlanning?.summary.submitDraftCount || 0} submit draft(s)`} />
      </div>
      <div className="audio-diagnostics-grid">
        <div>
          <h3>Voice Source Registry</h3>
          <div className="field-grid compact">
            <label>Sources</label>
            <span>{registry.sourceCount}</span>
            <label>Secrets</label>
            <span>{registry.storesSecrets ? "stored" : "not stored"}</span>
            <label>Planned</label>
            <span>{registry.plannedCount}</span>
            <label>Live</label>
            <span>{registry.liveSubmitAllowed ? "allowed" : "false"}</span>
          </div>
          <CompactList
            items={registry.sources.map((source) => `${source.label} · ${source.status} · ${statusLabel(source.kind)}`)}
            empty="No voice sources registered."
          />
        </div>
        <div>
          <h3>Audio Provider Slots</h3>
          <CompactList
            items={audioPlanning.providerSlots.map((slot) => `${slot.slot} · ${slot.state} · live ${slot.liveSubmitAllowed ? "allowed" : "false"}`)}
            empty="No audio provider slots planned."
          />
        </div>
        <div>
          <h3>TTS Routes</h3>
          <div className="field-grid compact">
            <label>Preferred</label>
            <span>{ttsPlanning?.preferredRoute || "none"}</span>
            <label>Local</label>
            <span>{ttsPlanning ? `${ttsPlanning.summary.maxLocalConcurrency} job` : "none"}</span>
            <label>Cloud</label>
            <span>{ttsPlanning ? `${ttsPlanning.summary.maxCloudConcurrency} jobs` : "none"}</span>
            <label>Submit</label>
            <span>{ttsPlanning?.summary.liveSubmitAllowed ? "allowed" : "gated"}</span>
          </div>
          <CompactList
            items={(ttsPlanning?.providers || []).map((provider) => `${provider.label} · ${provider.executionSurface} · ${provider.outputFormat} · live ${provider.liveSubmitAllowed ? "allowed" : "false"}`)}
            empty="No TTS routes prepared."
          />
        </div>
        <div>
          <h3>Export Package Summary</h3>
          <div className="field-grid compact">
            <label>Status</label>
            <span>{exportSummary.status}</span>
            <label>Profiles</label>
            <span>{exportSummary.includedInExportProfiles.map(statusLabel).join(", ")}</span>
            <label>Dry Run</label>
            <span>{exportSummary.dryRunOnly ? "true" : "false"}</span>
            <label>Provider</label>
            <span>{exportSummary.providerSubmissionForbidden ? "forbidden" : "allowed"}</span>
          </div>
          <CompactList
            items={[
              ...exportSummary.plannedCategories.map((item) => `category: ${item}`),
              ...exportSummary.blockedReasons.map((item) => `blocked: ${item}`),
            ]}
            empty="No export package notes."
          />
        </div>
      </div>
    </section>
  );
}
