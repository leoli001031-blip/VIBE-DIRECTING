import { Wrench } from "lucide-react";
import { Metric, CompactList, StatusPill } from "../common/DiagnosticsPrimitives";
import { getToolRuntimeHarness } from "./projections/runtimeDiagnostics";
import type { ToolRuntimeHarnessState } from "./projections/runtimeDiagnostics";
import type { ProjectRuntimeState } from "../../core/projectState";

function toolRuntimeMetricValue(harness: ToolRuntimeHarnessState, value?: number) {
  return harness.initialized && typeof value === "number" ? `${value}` : "Not initialized";
}

function toolRuntimeMetricDetail(harness: ToolRuntimeHarnessState, detail: string) {
  return harness.initialized ? detail : "runtimeState.toolRuntimeHarness missing";
}

function toolRuntimeLockLabel(value: boolean | undefined) {
  if (typeof value !== "boolean") return "Not initialized";
  return value ? "locked" : "not locked";
}

function toolRuntimeRequiredLabel(value: boolean | undefined) {
  if (typeof value !== "boolean") return "Not initialized";
  return value ? "required" : "not required";
}

function toolRuntimeBooleanLabel(value: boolean | undefined, trueLabel: string, falseLabel: string) {
  if (typeof value !== "boolean") return "Not initialized";
  return value ? trueLabel : falseLabel;
}

export function ToolRuntimeHarnessDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const harness = getToolRuntimeHarness(runtimeState);
  const summary = harness.summary;
  const visibleChecks = harness.checks.slice(0, 8);
  const optionalMissing = typeof summary.optionalMissing === "number" ? summary.optionalMissing : 0;
  const lockRows = [
    { label: "noInstall", value: toolRuntimeLockLabel(harness.hardLocks.noInstall) },
    { label: "noCredentialRead", value: toolRuntimeLockLabel(harness.hardLocks.noCredentialRead) },
    { label: "arbitraryShellExecutionBlocked", value: toolRuntimeLockLabel(harness.hardLocks.arbitraryShellExecutionBlocked) },
    { label: "sidecarDaemonDisabled", value: toolRuntimeLockLabel(harness.hardLocks.sidecarDaemonDisabled) },
    { label: "providerSubmissionForbidden", value: toolRuntimeLockLabel(harness.hardLocks.providerSubmissionForbidden) },
    { label: "platformPathAbstractionRequired", value: toolRuntimeRequiredLabel(harness.hardLocks.platformPathAbstractionRequired) },
  ];
  const pathPolicyRows = [
    {
      label: "mac posix",
      value: harness.pathPolicy.macPathStyle,
      detail: toolRuntimeRequiredLabel(harness.pathPolicy.platformPathAbstractionRequired),
    },
    {
      label: "win32",
      value: harness.pathPolicy.windowsPathStyle,
      detail: `${harness.pathPolicy.allowedRoots.length} allowed root(s)`,
    },
    {
      label: "project-relative",
      value: toolRuntimeRequiredLabel(harness.pathPolicy.projectRootRelativeRequired),
      detail: "project root policy",
    },
    {
      label: "allowed roots",
      value: harness.pathPolicy.allowedRoots.join(", ") || "Not initialized",
      detail: `${harness.pathPolicy.blockers.length} blockers / ${harness.pathPolicy.warnings.length} warnings`,
    },
  ];

  return (
    <section className="machine-panel tool-runtime-panel">
      <div className="audit-head">
        <Wrench size={17} />
        <span>Tool Runtime Harness</span>
      </div>
      <div className="qa-harness-meta">
        <small>schema: {harness.schemaVersion}</small>
        <small>generated: {harness.generatedAt}</small>
        <small>{harness.hasSummary ? "summary reported" : "summary Not initialized"}</small>
        <small>{harness.hasHardLocks ? "hard locks reported" : "hard locks Not initialized"}</small>
      </div>

      <div className="summary-grid tool-runtime-metrics">
        <Metric label="Checks" value={toolRuntimeMetricValue(harness, summary.totalChecks)} detail={toolRuntimeMetricDetail(harness, "tool readiness checks")} />
        <Metric label="Ready" value={toolRuntimeMetricValue(harness, summary.ready)} detail={toolRuntimeMetricDetail(harness, "diagnostic ready")} />
        <Metric label="Missing" value={toolRuntimeMetricValue(harness, summary.missing)} detail={toolRuntimeMetricDetail(harness, "required + optional")} />
        <Metric label="Planned" value={toolRuntimeMetricValue(harness, summary.planned)} detail={toolRuntimeMetricDetail(harness, "planned slots")} />
        <Metric label="Blocked" value={toolRuntimeMetricValue(harness, summary.blocked)} detail={toolRuntimeMetricDetail(harness, "cannot execute now")} />
        <Metric label="Unknown" value={toolRuntimeMetricValue(harness, summary.unknown)} detail={toolRuntimeMetricDetail(harness, "missing facts")} />
        <Metric label="Required missing" value={toolRuntimeMetricValue(harness, summary.requiredMissing)} detail={toolRuntimeMetricDetail(harness, `${optionalMissing} optional missing`)} />
      </div>

      <div className="watcher-lock-strip tool-runtime-lock-strip">
        {lockRows.map((lock) => (
          <div key={lock.label}>
            <span>{lock.label}</span>
            <StatusPill value={lock.value} />
          </div>
        ))}
      </div>

      {!harness.initialized && (
        <p className="muted-copy generation-empty-state">Tool Runtime Harness not initialized in this runtime state.</p>
      )}

      {harness.initialized && (
        <div className="tool-runtime-sections">
          <div>
            <div className="qa-section-head">
              <h3>Path policy</h3>
              <small>{harness.hasPathPolicy ? "platform path abstraction" : "Not initialized"}</small>
            </div>
            {!harness.hasPathPolicy && <p className="muted-copy">Not initialized</p>}
            {harness.hasPathPolicy && (
              <>
                <div className="tool-runtime-policy-grid">
                  {pathPolicyRows.map((row) => (
                    <div key={row.label}>
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                      <small>{row.detail}</small>
                    </div>
                  ))}
                </div>
                <div className="pipeline-details tool-runtime-policy-details">
                  <details open={harness.pathPolicy.blockers.length > 0}>
                    <summary>Policy blockers ({harness.pathPolicy.blockers.length})</summary>
                    <CompactList items={harness.pathPolicy.blockers} empty="No path policy blockers reported." />
                  </details>
                  <details open={harness.pathPolicy.warnings.length > 0}>
                    <summary>Policy warnings ({harness.pathPolicy.warnings.length})</summary>
                    <CompactList items={harness.pathPolicy.warnings} empty="No path policy warnings reported." />
                  </details>
                  <details>
                    <summary>Policy notes ({harness.pathPolicy.notes.length})</summary>
                    <CompactList items={harness.pathPolicy.notes} empty="No path policy notes reported." />
                  </details>
                </div>
              </>
            )}
          </div>

          <div>
            <div className="qa-section-head">
              <h3>Tool checks</h3>
              <small>showing first {visibleChecks.length} of {harness.checks.length}</small>
            </div>
            {!harness.hasChecks && <p className="muted-copy">Not initialized</p>}
            {harness.hasChecks && !visibleChecks.length && <p className="muted-copy">No tool runtime checks reported.</p>}
            {Boolean(visibleChecks.length) && (
              <div className="tool-runtime-check-table">
                {visibleChecks.map((check, index) => {
                  const requiredFor = check.requiredFor.join(", ") || "Not initialized";
                  const platformSupport = check.platformSupport.join(", ") || "Not initialized";
                  return (
                    <details key={`${check.checkId}-${index}`} className="tool-runtime-row" open={check.blockers.length > 0}>
                      <summary>
                        <span>
                          <strong>{check.label}</strong>
                          <small>{check.checkId}</small>
                          <small>{check.category}</small>
                        </span>
                        <StatusPill value={check.status} />
                        <StatusPill value={check.pathStatus} />
                        <span>
                          <strong>{check.path || "No path"}</strong>
                          <small>{check.version ? `version ${check.version}` : "version Not initialized"}</small>
                        </span>
                        <span>
                          <strong>{requiredFor}</strong>
                          <small>{platformSupport}</small>
                        </span>
                        <small>
                          {toolRuntimeBooleanLabel(check.canExecuteNow, "canExecute true", "canExecute false")} / {check.executionMode}
                        </small>
                      </summary>
                      <div className="tool-runtime-check-details">
                        <small>category: {check.category}</small>
                        <small>requiredFor: {requiredFor}</small>
                        <small>platformSupport: {platformSupport}</small>
                        <small>missingIsBlocker: {toolRuntimeBooleanLabel(check.missingIsBlocker, "true", "false")}</small>
                        <div className="pipeline-details tool-runtime-detail-sections">
                          <details open={check.blockers.length > 0}>
                            <summary>Blockers ({check.blockers.length})</summary>
                            <CompactList items={check.blockers} empty="No blockers reported." />
                          </details>
                          <details open={check.warnings.length > 0}>
                            <summary>Warnings ({check.warnings.length})</summary>
                            <CompactList items={check.warnings} empty="No warnings reported." />
                          </details>
                          <details>
                            <summary>Source refs ({check.sourceRefs.length})</summary>
                            <CompactList items={check.sourceRefs} empty="No source refs reported." />
                          </details>
                          <details>
                            <summary>Notes ({check.notes.length})</summary>
                            <CompactList items={check.notes} empty="No notes reported." />
                          </details>
                        </div>
                      </div>
                    </details>
                  );
                })}
                {harness.checks.length > visibleChecks.length && (
                  <small className="muted-copy watcher-more">Showing {visibleChecks.length} of {harness.checks.length} tool runtime check(s).</small>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
