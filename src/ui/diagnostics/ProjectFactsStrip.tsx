import type { ProjectStoreSnapshot } from "../../core/projectStore";
import type { ProjectStoreIoGate, ProjectStoreIoMode } from "../../core/projectStoreIo";
import type { ProjectFactsStagedApplyPlan } from "../../core/projectTransaction";

export type ProjectFactsUiMode = Extract<ProjectStoreIoMode, "create" | "open" | "save">;

export type ProjectFactsUiSummary = {
  mode: ProjectFactsUiMode;
  projectFile: string;
  factSource: string;
  runtimeCache: string;
  planStatus: string;
  planDetail: string;
  entryCount: number;
  writeCount: number;
  readCount: number;
  blockers: string[];
  gate: ProjectStoreIoGate;
  snapshot: ProjectStoreSnapshot;
};

export type ProjectFactsStripProps = {
  summary: ProjectFactsUiSummary;
  mode: ProjectFactsUiMode;
  applyPlan?: ProjectFactsStagedApplyPlan;
  onModeChange: (mode: ProjectFactsUiMode) => void;
};

export function ProjectFactsStrip({
  summary,
  mode,
  applyPlan,
  onModeChange,
}: ProjectFactsStripProps) {
  const applyPlanBlockedReasons = applyPlan?.blockedReasons.length
    ? applyPlan.blockedReasons.join(" · ")
    : "no staged apply plan";
  const applyPlanLocks = applyPlan
    ? [
      applyPlan.canWriteNow ? "" : "write locked",
      applyPlan.noFileMutation ? "no file mutation" : "",
      applyPlan.projectVibeWritten ? "" : "project.vibe not written",
      applyPlan.providerCalled ? "" : "provider not called",
      applyPlan.workerSpawned ? "" : "worker not spawned",
    ].filter(Boolean).join(" · ")
    : "waiting for staged confirmation";

  return (
    <section className="project-facts-strip" aria-label="Project Store">
      <div>
        <span>Project Store</span>
        <strong>{summary.projectFile}</strong>
        <small>{summary.factSource}</small>
      </div>
      <div>
        <span>runtime-state</span>
        <strong>derived cache</strong>
        <small>{summary.runtimeCache}</small>
      </div>
      <div>
        <span>{summary.mode} plan</span>
        <strong>{summary.planStatus}</strong>
        <small>{summary.planDetail}</small>
      </div>
      <div>
        <span>staged apply plan</span>
        <strong>{applyPlan?.status || "not ready"}</strong>
        <small>
          {applyPlan ? `${applyPlan.items.length} item(s) · ${applyPlan.projectStorePatch.operations.length} operation(s)` : "0 item(s) · 0 operation(s)"}
        </small>
      </div>
      <div>
        <span>blocked reasons</span>
        <strong>{applyPlan?.blockedReasons.length || 0}</strong>
        <small>{applyPlanBlockedReasons}</small>
      </div>
      <div>
        <span>locks</span>
        <strong>{applyPlan?.stagedOnly ? "staged only" : "read only"}</strong>
        <small>{applyPlanLocks}</small>
      </div>
      <div className="project-plan-actions" aria-label="Project Store plan mode">
        {(["create", "open", "save"] as const).map((item) => (
          <button key={item} className={mode === item ? "active" : ""} onClick={() => onModeChange(item)}>
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}
