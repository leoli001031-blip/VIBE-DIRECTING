import { LockKeyhole } from "lucide-react";
import { Metric, CompactList, StatusPill, statusLabel } from "../common/DiagnosticsPrimitives";
import { getGenerationHarness } from "./projections/runtimeDiagnostics";
import type { GenerationHarnessStage, GenerationHarnessCandidateOutput } from "./projections/runtimeDiagnostics";
import type { ProjectRuntimeState } from "../../core/projectState";

function generationStageTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("blocked") || normalized.includes("fail") || normalized.includes("missing")) return "stage-danger";
  if (normalized.includes("ready") || normalized.includes("done") || normalized.includes("pass") || normalized.includes("formal")) return "stage-good";
  if (normalized.includes("waiting") || normalized.includes("pending") || normalized.includes("qa")) return "stage-pending";
  return "stage-neutral";
}

function GenerationStageStrip({ stages }: { stages: GenerationHarnessStage[] }) {
  if (!stages.length) return <small className="muted-copy">No stage telemetry reported.</small>;

  return (
    <div className="generation-stage-strip" aria-label="Generation stage status">
      {stages.map((stage) => (
        <span key={stage.id} className={`generation-stage ${generationStageTone(stage.status)}`}>
          <strong>{stage.label}</strong>
          <small>{statusLabel(stage.status)}</small>
          {stage.detail && <em>{stage.detail}</em>}
        </span>
      ))}
    </div>
  );
}

function CandidateOutputSummary({ output }: { output: GenerationHarnessCandidateOutput }) {
  const details = [
    output.manifestStatus ? `manifest ${output.manifestStatus}` : undefined,
    output.healthStatus ? `health ${output.healthStatus}` : undefined,
    output.qaStatus ? `qa ${output.qaStatus}` : undefined,
    output.canPromoteToFormal ? "formal promotion ready" : "formal promotion blocked",
  ].filter((item): item is string => Boolean(item));

  return (
    <div className="candidate-output-summary">
      <div>
        <span>Candidate output</span>
        <StatusPill value={output.status} />
      </div>
      <small>{details.join(" · ") || "No candidate output telemetry."}</small>
      {output.candidatePath && <small>candidate: {output.candidatePath}</small>}
      {output.formalPath && <small>formal: {output.formalPath}</small>}
      {!output.candidatePath && output.expectedOutputPath && <small>{output.expectedOutputPath}</small>}
    </div>
  );
}

export function GenerationHarnessDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const harness = getGenerationHarness(runtimeState);
  const summary = harness.summary;
  const visibleJobs = harness.jobs.slice(0, 6);
  const providerLockLabel = harness.initialized
    ? summary.providerSubmissionForbidden ? "provider submission locked" : "provider submission open"
    : "provider lock not initialized";
  const dryRunLabel = harness.initialized
    ? summary.dryRunOnly ? "dry-run only" : "dry-run off"
    : "dry-run not initialized";
  const providerLockValue = !harness.initialized ? "not initialized" : summary.providerSubmissionForbidden || summary.dryRunOnly ? "locked" : "open";

  return (
    <section className="machine-panel generation-harness-panel">
      <div className="audit-head">
        <LockKeyhole size={17} />
        <span>Generation Harness</span>
      </div>
      <div className="summary-grid generation-harness-metrics">
        <Metric label="Total Jobs" value={`${summary.totalJobs}`} detail={`${summary.readyJobs} ready`} />
        <Metric label="Blocked" value={`${summary.blockedJobs}`} detail="blocking reasons active" />
        <Metric label="Waiting" value={`${summary.waitingForOutputJobs}`} detail="candidate output pending" />
        <Metric label="QA Pending" value={`${summary.qaPendingJobs}`} detail="requires QA decision" />
        <Metric label="Formal Ready" value={`${summary.formalReadyJobs}`} detail="promotable assets" />
        <Metric label="Provider Lock" value={providerLockValue} detail={`${providerLockLabel} · ${dryRunLabel}`} />
      </div>

      <div className="generation-lock-strip">
        <StatusPill value={providerLockLabel} />
        <StatusPill value={dryRunLabel} />
        <small>No live submit controls are exposed in Diagnostics.</small>
      </div>

      {!harness.initialized && (
        <p className="muted-copy generation-empty-state">Generation Harness not initialized in this runtime state.</p>
      )}

      <div className="generation-job-list">
        {visibleJobs.map((job) => (
          <div key={job.jobId} className="generation-job-row">
            <div className="generation-job-head">
              <div>
                <strong>{job.shotId}</strong>
                <small>{job.providerSlot} · {job.taskPlanId || job.jobId}</small>
              </div>
              <StatusPill value={job.chainStatus} />
            </div>
            <GenerationStageStrip stages={job.stages} />
            <CandidateOutputSummary output={job.candidateOutput} />
            <div className="generation-job-locks">
              <StatusPill value={job.providerSubmissionForbidden ? "provider locked" : "provider open"} />
              <StatusPill value={job.dryRunOnly ? "dry-run only" : "dry-run off"} />
              <StatusPill value={job.liveSubmitAllowed ? "live allowed" : "live false"} />
            </div>
            <div className="pipeline-details generation-job-details">
              <details open={Boolean(job.blockingReasons.length)}>
                <summary>Blocking reasons ({job.blockingReasons.length})</summary>
                <CompactList items={job.blockingReasons} empty="No blocking reasons reported." />
              </details>
              <details>
                <summary>Forbidden actions ({job.forbiddenActions.length})</summary>
                <CompactList
                  items={[
                    ...job.forbiddenActions,
                    ...(job.postprocessPolicy ? [`postprocess: ${job.postprocessPolicy}`] : []),
                  ]}
                  empty="No forbidden actions reported."
                />
              </details>
            </div>
          </div>
        ))}
        {harness.initialized && !visibleJobs.length && (
          <p className="muted-copy generation-empty-state">Generation Harness is initialized, but no jobs are currently queued.</p>
        )}
        {harness.jobs.length > visibleJobs.length && (
          <small className="muted-copy">Showing {visibleJobs.length} of {harness.jobs.length} generation jobs.</small>
        )}
      </div>
    </section>
  );
}
