import { ShieldAlert } from "lucide-react";
import { Metric, CompactList, StatusPill } from "../common/DiagnosticsPrimitives";
import { getQaHarness } from "./projections/runtimeDiagnostics";
import type { QaHarnessState, QaGateRow } from "./projections/runtimeDiagnostics";
import type { ProjectRuntimeState } from "../../core/projectState";

const qaHarnessDimensions = [
  "whole_film",
  "identity",
  "scene",
  "pair",
  "story",
  "prop",
  "style",
  "motion",
  "audio",
] as const;
type QaHarnessDimension = typeof qaHarnessDimensions[number];

const qaHarnessDimensionLabels: Record<QaHarnessDimension, string> = {
  whole_film: "\u540c\u7247\u611f",
  identity: "identity",
  scene: "scene",
  pair: "pair",
  story: "story",
  prop: "prop",
  style: "style",
  motion: "motion",
  audio: "audio",
};

function qaDimensionLabel(dimension: string) {
  return (qaHarnessDimensions as readonly string[]).includes(dimension)
    ? qaHarnessDimensionLabels[dimension as QaHarnessDimension]
    : dimension;
}

function qaMetricValue(harness: QaHarnessState, value?: number) {
  return harness.initialized && typeof value === "number" ? `${value}` : "Not initialized";
}

function qaMetricDetail(harness: QaHarnessState, detail: string) {
  return harness.initialized ? detail : "runtimeState.qaHarness missing";
}

function qaLockLabel(value: boolean | undefined, inverse = false) {
  if (typeof value !== "boolean") return "Not initialized";
  const locked = inverse ? !value : value;
  return locked ? "locked" : "not locked";
}

function qaBooleanLabel(value: boolean | undefined, trueLabel: string, falseLabel: string) {
  if (typeof value !== "boolean") return "Not initialized";
  return value ? trueLabel : falseLabel;
}

function qaGateCompact(gate: QaGateRow) {
  const details = [
    gate.severity !== "unknown" ? `severity: ${gate.severity}` : "",
    `${gate.blockers.length} blockers`,
    `${gate.warnings.length} warnings`,
    gate.sourceRefs.length ? `refs: ${gate.sourceRefs.join(", ")}` : "",
    gate.notes.length ? `notes: ${gate.notes.join(" · ")}` : "",
  ].filter(Boolean);
  return `${gate.label}: ${gate.status}${details.length ? ` · ${details.join(" · ")}` : ""}`;
}

export function QaHarnessDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const harness = getQaHarness(runtimeState);
  const summary = harness.summary;
  const visibleItems = harness.items.slice(0, 8);
  const hardLockRows = [
    {
      label: "overallFirst",
      value: qaLockLabel(harness.hardLocks.overallFirst),
      primary: true,
    },
    {
      label: "noAutoPromotion",
      value: qaLockLabel(harness.hardLocks.noAutoPromotion),
      primary: true,
    },
    {
      label: "semanticRepairForbidden",
      value: qaLockLabel(harness.hardLocks.semanticRepairForbidden),
      primary: true,
    },
    {
      label: "workerSelfReportCannotPassQa",
      value: qaLockLabel(harness.hardLocks.workerSelfReportCannotPassQa),
      primary: true,
    },
    {
      label: "dryRunOnly",
      value: qaLockLabel(harness.hardLocks.dryRunOnly ?? summary.dryRunOnly),
    },
    {
      label: "providerSubmissionForbidden",
      value: qaLockLabel(harness.hardLocks.providerSubmissionForbidden),
    },
    {
      label: "liveSubmitAllowed",
      value: qaLockLabel(harness.hardLocks.liveSubmitAllowed ?? summary.liveSubmitAllowed, true),
    },
    {
      label: "noFileMutation",
      value: qaLockLabel(harness.hardLocks.noFileMutation ?? summary.noFileMutation),
    },
  ];

  return (
    <section className="machine-panel qa-harness-panel">
      <div className="audit-head">
        <ShieldAlert size={17} />
        <span>QA Harness</span>
      </div>
      <div className="qa-harness-meta">
        <small>schema: {harness.schemaVersion}</small>
        <small>generated: {harness.generatedAt}</small>
        <small>{harness.dimensions.length} fixed dimensions</small>
      </div>
      <div className="summary-grid qa-harness-metrics">
        <Metric label="Items" value={qaMetricValue(harness, summary.totalItems)} detail={qaMetricDetail(harness, "QA item count")} />
        <Metric label="Formal eligible" value={qaMetricValue(harness, summary.formalEligible)} detail={qaMetricDetail(harness, "eligible after QA")} />
        <Metric label="Human review" value={qaMetricValue(harness, summary.requiresHumanReview)} detail={qaMetricDetail(harness, "requires human decision")} />
        <Metric label="Blocked" value={qaMetricValue(harness, summary.blocked)} detail={qaMetricDetail(harness, "cannot pass current gate")} />
        <Metric label="Unknown" value={qaMetricValue(harness, summary.unknown)} detail={qaMetricDetail(harness, "missing facts or context")} />
        <Metric label="Failed" value={qaMetricValue(harness, summary.failed)} detail={qaMetricDetail(harness, "failed QA checks")} />
        <Metric label="Partial" value={qaMetricValue(harness, summary.partial)} detail={qaMetricDetail(harness, "partial evidence")} />
      </div>

      <div className="watcher-lock-strip qa-lock-strip">
        {hardLockRows.map((lock) => (
          <div key={lock.label} className={lock.primary ? "qa-lock-primary" : undefined}>
            <span>{lock.label}</span>
            <StatusPill value={lock.value} />
          </div>
        ))}
      </div>

      {!harness.initialized && (
        <p className="muted-copy generation-empty-state">QA Harness not initialized in this runtime state.</p>
      )}

      {harness.initialized && (
        <div className="qa-harness-sections">
          <div className="qa-section-head">
            <h3>Overall gates</h3>
            <small>{qaHarnessDimensions.map(qaDimensionLabel).join(" · ")}</small>
          </div>
          {!harness.hasOverall && <p className="muted-copy">Not initialized</p>}
          {harness.hasOverall && (
            <div className="qa-overall-table">
              {harness.overall.map((gate) => (
                <details key={gate.dimension} className="qa-overall-row" open={gate.blockers.length > 0}>
                  <summary>
                    <span>
                      <strong>{gate.label}</strong>
                      <small>{gate.dimension}</small>
                    </span>
                    <StatusPill value={gate.status} />
                    <span>{gate.severity}</span>
                    <small>{gate.blockers.length} blockers · {gate.warnings.length} warnings · {gate.sourceRefs.length} refs</small>
                  </summary>
                  <div className="qa-gate-details">
                    <CompactList items={gate.blockers} empty="No blockers reported." />
                    <CompactList items={gate.warnings} empty="No warnings reported." />
                    <CompactList items={[...gate.sourceRefs.map((ref) => `source: ${ref}`), ...gate.notes]} empty="No source refs or notes reported." />
                  </div>
                </details>
              ))}
            </div>
          )}

          <div className="qa-section-head">
            <h3>Item details</h3>
            <small>showing first {visibleItems.length} of {harness.items.length}</small>
          </div>
          {!harness.hasItems && <p className="muted-copy">Not initialized</p>}
          {harness.hasItems && !visibleItems.length && <p className="muted-copy">No QA items reported.</p>}
          {Boolean(visibleItems.length) && (
            <div className="qa-item-table">
              {visibleItems.map((item, index) => {
                const jobLink = item.harnessJobId || item.jobId || item.checkpointResumeItemId || "Not initialized";
                return (
                  <details key={`${item.qaItemId}-${index}`} className="qa-item-row" open={item.blockers.length > 0}>
                    <summary>
                      <span>
                        <strong>{item.shotId}</strong>
                        <small>{item.qaItemId}</small>
                      </span>
                      <StatusPill value={item.overallStatus} />
                      <StatusPill value={qaBooleanLabel(item.formalPromotionEligible, "formal eligible", "formal blocked")} />
                      <StatusPill value={qaBooleanLabel(item.requiresHumanReview, "human review", "review clear")} />
                      <span>
                        <strong>{jobLink}</strong>
                        <small>{item.harnessJobId ? "harness job" : "job/checkpoint link"}</small>
                      </span>
                      <small>{item.blockers.length} blockers · {item.warnings.length} warnings · {item.sourceCoverage.length} coverage rows</small>
                    </summary>
                    <div className="qa-item-details">
                      <small>task: {item.taskPlanId || "Not initialized"}</small>
                      <small>job: {item.jobId || "Not initialized"}</small>
                      <small>harness: {item.harnessJobId || "Not initialized"}</small>
                      <small>checkpoint: {item.checkpointResumeItemId || "Not initialized"}</small>
                      <div className="pipeline-details qa-item-detail-sections">
                        <details>
                          <summary>sourceCoverage ({item.sourceCoverage.length})</summary>
                          <CompactList items={item.sourceCoverage} empty="No source coverage reported." />
                        </details>
                        <details open={item.blockers.length > 0}>
                          <summary>Blockers ({item.blockers.length})</summary>
                          <CompactList items={item.blockers} empty="No blockers reported." />
                        </details>
                        <details open={item.warnings.length > 0}>
                          <summary>Warnings ({item.warnings.length})</summary>
                          <CompactList items={item.warnings} empty="No warnings reported." />
                        </details>
                        <details>
                          <summary>Dimension gates ({item.dimensionGates.length})</summary>
                          <CompactList items={item.dimensionGates.map(qaGateCompact)} empty="No dimension gates reported." />
                        </details>
                        <details>
                          <summary>Notes ({item.notes.length})</summary>
                          <CompactList items={item.notes} empty="No item notes reported." />
                        </details>
                      </div>
                    </div>
                  </details>
                );
              })}
              {harness.items.length > visibleItems.length && (
                <small className="muted-copy watcher-more">Showing {visibleItems.length} of {harness.items.length} QA item(s).</small>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
