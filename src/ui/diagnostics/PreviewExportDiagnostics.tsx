import { Play } from "lucide-react";
import type { ProjectPreviewExportState } from "../../core/types";
import { CompactList, Metric, StatusPill, statusLabel } from "../common/DiagnosticsPrimitives";

export function PreviewExportDiagnostics({ previewExport }: { previewExport: ProjectPreviewExportState }) {
  const gateChecks = Object.entries(previewExport.formalPreviewGate.requiredChecks);

  return (
    <section className="machine-panel preview-export-diagnostics">
      <div className="audit-head">
        <Play size={17} />
        <span>Preview / Export</span>
      </div>
      <div className="summary-grid">
        <Metric label="Formal Gate" value={previewExport.formalPreviewGate.status} detail={`${gateChecks.filter(([, passed]) => !passed).length} failed check(s)`} />
        <Metric label="Blocked Reasons" value={`${previewExport.formalPreviewGate.blockedReasons.length}`} detail="formal preview eligibility" />
        <Metric label="Package" value={previewExport.exportPackagePlan.status} detail={`${previewExport.exportProfiles.length} dry-run profile(s)`} />
        <Metric label="Future Targets" value={`${previewExport.exportPackagePlan.futureTargets.length}`} detail="reserved export slots" />
      </div>
      <div className="preview-export-grid">
        <div className="check-list">
          <h3>Formal Gate Checks</h3>
          {gateChecks.map(([check, passed]) => (
            <div key={check}>
              <span>{statusLabel(check)}</span>
              <StatusPill value={passed ? "PASS" : "blocked"} />
            </div>
          ))}
        </div>
        <div>
          <h3>Blocked Reasons</h3>
          <CompactList items={previewExport.formalPreviewGate.blockedReasons} empty="Formal preview gate is eligible." />
        </div>
        <div>
          <h3>Export Package Targets</h3>
          <CompactList items={previewExport.exportPackagePlan.futureTargets.map((target) => `${target} · ${previewExport.exportPackagePlan.status}`)} empty="No future package targets planned." />
        </div>
      </div>
    </section>
  );
}
