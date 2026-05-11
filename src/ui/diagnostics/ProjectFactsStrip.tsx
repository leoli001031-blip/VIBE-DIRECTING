import type { ProjectStoreSnapshot } from "../../core/projectStore";
import type { ProjectStoreIoGate, ProjectStoreIoMode } from "../../core/projectStoreIo";

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
  onModeChange: (mode: ProjectFactsUiMode) => void;
};

export function ProjectFactsStrip({
  summary,
  mode,
  onModeChange,
}: ProjectFactsStripProps) {
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
