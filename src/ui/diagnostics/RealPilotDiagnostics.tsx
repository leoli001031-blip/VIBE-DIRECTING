import { Sparkles } from "lucide-react";
import type { ProjectRuntimeState } from "../../core/projectState";
import { buildRealPilotUiSummary } from "./projections/runtimeDiagnostics";
import { Metric } from "../common/DiagnosticsPrimitives";

export function RealPilotDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildRealPilotUiSummary(runtimeState);

  return (
    <section className="machine-panel real-pilot-diagnostics">
      <div className="audit-head">
        <Sparkles size={17} />
        <span>Real Pilot / 真实小样</span>
      </div>
      <div className="summary-grid real-pilot-diagnostic-metrics">
        <Metric label="Review Status" value={summary.reviewStatus} detail={summary.confirmationState} />
        <Metric label="Selected Shots" value={`${summary.selectedShotCount}`} detail={summary.selectedShotDetail} />
        <Metric label="First Frame Control" value={summary.framePairValue} detail={summary.framePairDetail} />
        <Metric label="Output Root" value={summary.outputRoot} detail="scoped review folder" />
        <Metric label="Estimated Outputs" value={`${summary.estimatedOutputCount}`} detail={summary.estimatedOutputDetail} />
        <Metric label="Image2 First" value={summary.image2State} detail={summary.seedanceState} />
        <Metric label="Ready / Blocked" value={`${summary.readyItems}/${summary.blockedItems}`} detail="gate item review state" />
        <Metric label="Ledger Entries" value={`${summary.ledgerEntries}`} detail="state-only record" />
        <Metric label="执行前确认" value={summary.preConfirmState} detail={summary.preConfirmScopeDetail} />
        <Metric label="预算上限" value={summary.preConfirmBudgetLimit} detail="额度风险复核" />
        <Metric label="输出监听" value={summary.preConfirmOutputWatch} detail={summary.outputRoot} />
        <Metric label="请求预览" value={summary.preConfirmRequestPreview} detail="只读摘要" />
        <Metric label="单次确认" value={summary.oneShotStatus} detail={summary.oneShotConfirmation} />
        <Metric label="单次范围" value={summary.oneShotActionScope} detail={summary.oneShotOutputExpectation} />
      </div>
      <div className="real-pilot-diagnostic-list">
        <div>
          <strong>Pilot Boundary</strong>
          <small>Small Image2 review only; the UI exposes no action button here.</small>
        </div>
        <div>
          <strong>Blockers / warnings</strong>
          <small>{[...summary.blockers, ...summary.warnings].slice(0, 5).join(" · ") || "none reported"}</small>
        </div>
      </div>
    </section>
  );
}
