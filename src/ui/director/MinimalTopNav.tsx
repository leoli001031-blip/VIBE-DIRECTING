import { Settings } from "lucide-react";
import type { RuntimeView } from "../../core/runtimeView";
import type { UiMode } from "../../core/types";
import type { DirectorView, MinimalProjectPlan } from "./directorTypes";

function cleanLabel(value: string) {
  return value
    .replace(/^asset_/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortSectionLabel(section: RuntimeView["storySections"][number], index = 0) {
  const raw = cleanLabel(section.label || section.id || `Section ${index + 1}`);
  const withoutIdPrefix = raw
    .replace(/^section[-_\s]*/i, "")
    .replace(/^act[-_\s]*/i, "");
  const titleish = withoutIdPrefix
    .replace(/[-_]+/g, " ")
    .replace(/\b[a-f0-9]{7,}\b/gi, "")
    .trim();
  const label = titleish || `Part ${index + 1}`;
  return label.length > 14 ? `${label.slice(0, 13).trim()}...` : label;
}

export function MinimalTopNav({
  projectTitle,
  projectPlan,
  mode,
  directorView,
  sections,
  activeSectionId,
  onOpenDirectorView,
  onOpenSection,
  onOpenDiagnostics,
}: {
  projectTitle: string;
  projectPlan: MinimalProjectPlan;
  mode: UiMode;
  directorView: DirectorView;
  sections: RuntimeView["storySections"];
  activeSectionId?: string;
  onOpenDirectorView: (view: DirectorView) => void;
  onOpenSection: (sectionId: string) => void;
  onOpenDiagnostics: () => void;
}) {
  return (
    <header className="minimal-topbar">
      <button className="project-title-button" onClick={() => onOpenDirectorView("story")}>
        <span className="project-title-text">{projectTitle || "Untitled project"}</span>
        <span className="project-plan-entry" aria-label="项目计划状态">
          <strong>Story</strong>
          <span>{projectPlan.entryLabel}</span>
          <span>{projectPlan.planLabel}</span>
          <span>{projectPlan.statusLabel}</span>
        </span>
        <span className="minimal-state-dots" aria-label={projectPlan.statusLabel}>
          {projectPlan.progressDots.map((dot) => (
            <i key={dot.id} className={dot.tone} title={dot.label} />
          ))}
        </span>
      </button>
      <nav className="minimal-nav" aria-label="Director views">
        <button
          className={mode === "director" && directorView === "assets" ? "active" : ""}
          onClick={() => onOpenDirectorView("assets")}
        >
          Asset Library
        </button>
        {sections.map((section, index) => (
          <button
            key={section.id}
            className={mode === "director" && directorView === "story" && activeSectionId === section.id ? "active" : ""}
            onClick={() => onOpenSection(section.id)}
            title={section.label || section.id}
            aria-label={`${section.label || section.id} · ${section.shotCount} shots`}
          >
            <span className="minimal-section-label">{shortSectionLabel(section, index)}</span>
            <small className="minimal-section-count">{section.shotCount}</small>
          </button>
        ))}
        <button
          className={mode === "director" && directorView === "preview" ? "active" : ""}
          onClick={() => onOpenDirectorView("preview")}
        >
          Preview
        </button>
      </nav>
      <button className={`diagnostics-link ${mode === "diagnostics" ? "active" : ""}`} onClick={onOpenDiagnostics} aria-label="Diagnostics">
        <Settings size={18} aria-hidden="true" />
        <span className="sr-only">Diagnostics</span>
      </button>
    </header>
  );
}
