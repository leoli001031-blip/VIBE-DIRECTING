import { Sparkles } from "lucide-react";
import { Metric, CompactList, statusLabel } from "../common/DiagnosticsPrimitives";
import { getImagePipeline, countBy } from "./projections/runtimeDiagnostics";
import type { ProjectRuntimeState } from "../../core/projectState";

export function ImagePipelineDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const pipeline = getImagePipeline(runtimeState);
  const capabilities = pipeline.providerRegistry.capabilities;
  const activeImage = capabilities.filter((item) => item.slot.startsWith("image.") && item.executionState === "active").length;
  const parkedVideo = capabilities.filter((item) => item.slot.startsWith("video.") && item.executionState === "parked").length;
  const promptBlocked = pipeline.promptPlans.filter((plan) => plan.status === "blocked").length;
  const promptReady = pipeline.promptPlans.filter((plan) => plan.status === "ready_for_envelope").length;
  const readinessCounts = countBy(pipeline.assetReadinessReports.map((report) => report.status));
  const taskBlocked = pipeline.imageTaskPlans.filter((plan) => plan.status === "blocked").length;
  const taskReady = pipeline.imageTaskPlans.filter((plan) => plan.status === "ready_for_dry_run").length;
  const dryRunOnly = pipeline.image2AdapterRequests.filter((request) => request.submitPolicy?.dry_run_only).length;
  const liveForbidden = pipeline.image2AdapterRequests.filter((request) => request.submitPolicy?.live_submit_forbidden).length;
  const watcherCounts = countBy(pipeline.watcherEvents.map((event) => event.status));
  const healthCounts = countBy(pipeline.generationHealthReports.map((report) => report.healthStatus));
  const promotionCounts = countBy(pipeline.qaPromotionReports.map((report) => report.promotionStatus));
  const blockers = [
    ...pipeline.promptPlans.flatMap((plan) => plan.blockers.map((blocker) => `${plan.shotId || plan.jobId}: ${blocker}`)),
    ...pipeline.assetReadinessReports.flatMap((report) => report.blockers.map((blocker) => `${report.shotId}: ${blocker}`)),
    ...pipeline.imageTaskPlans.flatMap((plan) => plan.blockers.map((blocker) => `${plan.shotId}: ${blocker}`)),
    ...pipeline.generationHealthReports.flatMap((report) => report.blockers.map((blocker) => `${report.shotId}: ${blocker}`)),
    ...pipeline.qaPromotionReports.flatMap((report) => report.blockers.map((blocker) => `${report.shotId}: ${blocker}`)),
  ];
  const warnings = [
    ...pipeline.promptPlans.flatMap((plan) => plan.adapterWarnings.map((warning) => `${plan.shotId || plan.jobId}: ${warning}`)),
    ...pipeline.assetReadinessReports.flatMap((report) => report.warnings.map((warning) => `${report.shotId}: ${warning}`)),
    ...pipeline.imageTaskPlans.flatMap((plan) => plan.warnings.map((warning) => `${plan.shotId}: ${warning}`)),
    ...pipeline.generationHealthReports.flatMap((report) => report.warnings.map((warning) => `${report.shotId}: ${warning}`)),
    ...pipeline.qaPromotionReports.flatMap((report) => report.warnings.map((warning) => `${report.shotId}: ${warning}`)),
  ];

  return (
    <section className="machine-panel image-pipeline-panel">
      <div className="audit-head">
        <Sparkles size={17} />
        <span>Image Pipeline</span>
      </div>
      <div className="summary-grid">
        <Metric label="Provider Capabilities" value={`${capabilities.length}`} detail={`${activeImage} active image · ${parkedVideo} parked video`} />
        <Metric label="Prompt Plans" value={`${pipeline.promptPlans.length}`} detail={`${promptBlocked} blocked · ${promptReady} ready`} />
        <Metric label="Asset Readiness" value={`${readinessCounts.ready || 0}/${pipeline.assetReadinessReports.length}`} detail={`${readinessCounts.draft_only || 0} draft only · ${readinessCounts.blocked || 0} blocked`} />
        <Metric label="Image Task Plans" value={`${pipeline.imageTaskPlans.length}`} detail={`${taskBlocked} blocked · ${taskReady} dry-run ready`} />
      </div>
      <div className="summary-grid pipeline-secondary">
        <Metric label="Adapter Requests" value={`${pipeline.image2AdapterRequests.length}`} detail={`${dryRunOnly} dry run only · ${liveForbidden} live path forbidden`} />
        <Metric label="Watcher Events" value={`${pipeline.watcherEvents.length}`} detail={Object.entries(watcherCounts).map(([key, value]) => `${value} ${statusLabel(key)}`).join(" · ") || "none"} />
        <Metric label="Health Reports" value={`${pipeline.generationHealthReports.length}`} detail={Object.entries(healthCounts).map(([key, value]) => `${value} ${statusLabel(key)}`).join(" · ") || "none"} />
        <Metric label="Promotion Reports" value={`${pipeline.qaPromotionReports.length}`} detail={Object.entries(promotionCounts).map(([key, value]) => `${value} ${statusLabel(key)}`).join(" · ") || "none"} />
      </div>
      <div className="pipeline-details">
        <details>
          <summary>Blockers ({blockers.length})</summary>
          <CompactList items={blockers} />
        </details>
        <details>
          <summary>Warnings ({warnings.length})</summary>
          <CompactList items={warnings} />
        </details>
      </div>
    </section>
  );
}
