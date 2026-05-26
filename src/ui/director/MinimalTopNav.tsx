import { useEffect, useRef, useState } from "react";
import { ChevronDown, FolderOpen, FolderPlus, Settings, Trash2 } from "lucide-react";
import type { RuntimeView } from "../../core/runtimeView";
import type { UiMode } from "../../core/types";
import type { DirectorView, MinimalProjectPlan } from "./directorTypes";
import { cleanStoryText } from "./MinimalStoryFlow";

function cleanLabel(value: string) {
  return value
    .replace(/^asset_/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortSectionLabel(section: RuntimeView["storySections"][number], index = 0) {
  const raw = cleanLabel(section.label || section.id || `Section ${index + 1}`);
  const titleish = cleanStoryText(raw)
    .replace(/^section[-_\s]*/i, "")
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
  showInspector,
  projectFileStatusLabel,
  projectFileStatusDetail,
  projectRoot,
  currentProjectPath,
  recentProjects,
  canCreateProject,
  onCreateProject,
  canChooseProjectRoot,
  onChooseProjectRoot,
  canForgetProject,
  onForgetProject,
  onOpenRecentProject,
  onRemoveRecentProject,
  onOpenDirectorView,
  onOpenSection,
  onOpenInspector,
}: {
  projectTitle: string;
  projectPlan: MinimalProjectPlan;
  mode: UiMode;
  directorView: DirectorView;
  sections: RuntimeView["storySections"];
  activeSectionId?: string;
  showInspector?: boolean;
  projectFileStatusLabel?: string;
  projectFileStatusDetail?: string;
  projectRoot?: string;
  currentProjectPath?: string;
  recentProjects?: Array<{
    projectRoot: string;
    displayName: string;
    projectPath?: string;
    updatedAt?: string;
    hasProjectVibe?: boolean;
  }>;
  canCreateProject?: boolean;
  onCreateProject?: () => void;
  canChooseProjectRoot?: boolean;
  onChooseProjectRoot?: () => void;
  canForgetProject?: boolean;
  onForgetProject?: () => void;
  onOpenRecentProject?: (project: { projectRoot: string; displayName: string; projectPath?: string; hasProjectVibe?: boolean }) => void;
  onRemoveRecentProject?: (projectRoot: string) => void;
  onOpenDirectorView: (view: DirectorView) => void;
  onOpenSection: (sectionId: string) => void;
  onOpenInspector: () => void;
}) {
  const totalShots = sections.reduce((sum, section) => sum + section.shotCount, 0);
  const activeSection = sections.find((section) => section.id === activeSectionId) || sections[0];
  const storyLabel = activeSection ? shortSectionLabel(activeSection) : "故事";
  const isEmptyProject = totalShots === 0;
  const projectTitleLabel = isEmptyProject ? "新视频项目" : (projectTitle || "新视频项目");
  const emptyProjectPrimary = canForgetProject ? "本地项目已准备" : "还没有项目";
  const emptyProjectSecondary = canForgetProject ? "确认后会写到这里" : "先写脚本或打开项目";
  const [projectControlOpen, setProjectControlOpen] = useState(false);
  const projectControlRef = useRef<HTMLDivElement>(null);
  const projectRootLabel = projectRoot?.trim() || (canForgetProject ? "本地项目已连接" : "尚未选择本地文件夹");
  const projectControlStatus = canForgetProject
    ? isEmptyProject
      ? "已准备项目文件夹"
      : "项目已连接"
    : "还没有项目";
  const recentProjectItems = (recentProjects || [])
    .filter((project) => project.projectRoot.trim())
    .slice(0, 6);

  useEffect(() => {
    if (!projectControlOpen) return undefined;
    function onPointerDown(event: PointerEvent) {
      const target = event.target instanceof Node ? event.target : undefined;
      if (target && projectControlRef.current?.contains(target)) return;
      setProjectControlOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setProjectControlOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [projectControlOpen]);

  function performProjectControlAction(action?: () => void) {
    setProjectControlOpen(false);
    action?.();
  }

  return (
    <header className="minimal-topbar">
      <div className="minimal-topbar-left">
        <div className="identity-top">
          <img className="identity-signature" src="/zc-signature.png" alt="" aria-hidden="true" />
          <span className="identity-name">Vibe Director<span className="identity-separator"> / </span>本地创作台</span>
        </div>
        <div className="project-control" ref={projectControlRef}>
          <button
            className="project-title-button"
            onClick={() => setProjectControlOpen((open) => !open)}
            aria-label="项目控制"
            aria-expanded={projectControlOpen}
          >
            <span className="project-title-row">
              <span className="project-title-text">{projectTitleLabel}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </span>
            <span className="project-plan-entry" aria-label="项目计划状态">
              <strong>{isEmptyProject ? emptyProjectPrimary : "故事流"}</strong>
              <span>{isEmptyProject ? emptyProjectSecondary : projectPlan.entryLabel}</span>
              {!isEmptyProject && <span>{projectPlan.planLabel}</span>}
              {!isEmptyProject && <span>{projectPlan.statusLabel}</span>}
            </span>
            {!isEmptyProject && (
              <span className="minimal-state-dots" aria-label={projectPlan.statusLabel}>
                {projectPlan.progressDots.map((dot) => (
                  <i key={dot.id} className={dot.tone} title={dot.label} />
                ))}
              </span>
            )}
          </button>
          {projectControlOpen && (
            <div className="project-control-popover" role="dialog" aria-label="项目控制">
              <div className="project-control-head">
                <span>当前项目</span>
                <strong>{projectTitleLabel}</strong>
                <small>{projectControlStatus}</small>
              </div>
              <div className="project-control-path">
                <span>文件夹</span>
                <strong>{projectRootLabel}</strong>
                {currentProjectPath && <small>{currentProjectPath}</small>}
              </div>
              {recentProjectItems.length > 0 && (
                <div className="project-control-recent">
                  <span>最近项目</span>
                  <div className="project-control-recent-list">
                    {recentProjectItems.map((project) => {
                      const active = projectRoot && project.projectRoot === projectRoot;
                      return (
                        <div
                          key={project.projectRoot}
                          className={`project-control-recent-item${active ? " active" : ""}`}
                        >
                          <button
                            type="button"
                            className="project-control-recent-open"
                            disabled={active || !onOpenRecentProject}
                            onClick={() => performProjectControlAction(() => onOpenRecentProject?.(project))}
                          >
                            <strong>
                              <span>{project.displayName || "未命名项目"}</span>
                              {active && <em className="project-control-current-badge">当前</em>}
                            </strong>
                            <small>{project.projectRoot}</small>
                          </button>
                          <button
                            type="button"
                            className="project-control-recent-remove"
                            disabled={!onRemoveRecentProject}
                            title="移除这条项目记录，不删除本地文件"
                            aria-label={`移除 ${project.displayName || "未命名项目"} 的项目记录`}
                            onClick={() => onRemoveRecentProject?.(project.projectRoot)}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="project-control-actions">
                {onCreateProject && (
                  <button
                    type="button"
                    disabled={!canCreateProject}
                    onClick={() => performProjectControlAction(onCreateProject)}
                  >
                    <FolderPlus size={15} aria-hidden="true" />
                    新建项目
                  </button>
                )}
                {onChooseProjectRoot && (
                  <button
                    type="button"
                    disabled={!canChooseProjectRoot}
                    onClick={() => performProjectControlAction(onChooseProjectRoot)}
                    title={projectFileStatusDetail || projectFileStatusLabel || "打开项目"}
                  >
                    <FolderOpen size={15} aria-hidden="true" />
                    打开项目
                  </button>
                )}
                {onForgetProject && canForgetProject && (
                  <button
                    type="button"
                    className="project-control-danger"
                    onClick={() => performProjectControlAction(onForgetProject)}
                    title="只忘记当前记录，不删除本地文件"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    忘记记录
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <nav className="minimal-nav" aria-label="导演视图">
        <button
          className={mode === "director" && directorView === "story" ? "active" : ""}
          onClick={() => onOpenDirectorView("story")}
          title={activeSection?.label || "故事"}
          aria-label={`${storyLabel} · ${totalShots} 个镜头`}
        >
          <span className="minimal-section-label">故事</span>
          <small className="minimal-section-count">{totalShots}</small>
        </button>
        <button
          className={mode === "director" && directorView === "assets" ? "active" : ""}
          onClick={() => onOpenDirectorView("assets")}
          aria-label="视觉记忆"
        >
          参考
        </button>
        <button
          className={mode === "director" && directorView === "preview" ? "active" : ""}
          onClick={() => onOpenDirectorView("preview")}
          aria-label="预览"
        >
          交付
        </button>
        <button
          className={mode === "director" && directorView === "export" ? "active" : ""}
          onClick={() => onOpenDirectorView("export")}
        >
          导出
        </button>
      </nav>
      <div className="minimal-topbar-actions">
        <button className={`diagnostics-link ${showInspector ? "active" : ""}`} onClick={onOpenInspector} aria-label="设置">
          <Settings size={18} aria-hidden="true" />
          <span className="settings-link-label">设置</span>
        </button>
      </div>
    </header>
  );
}
