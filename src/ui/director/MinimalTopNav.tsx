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

function compactProjectPathLabel(value?: string) {
  const cleaned = value?.trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) return cleaned;
  return `.../${parts.slice(-2).join("/")}`;
}

function formatRecentProjectUpdatedAt(value?: string) {
  if (!value) return "";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";
  const elapsed = Math.max(0, Date.now() - time);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (elapsed < minute) return "刚刚";
  if (elapsed < hour) return `${Math.max(1, Math.round(elapsed / minute))} 分钟前`;
  if (elapsed < day) return `${Math.max(1, Math.round(elapsed / hour))} 小时前`;
  return new Date(time).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function recentProjectMetaLabel(project: { updatedAt?: string; hasProjectVibe?: boolean }) {
  return [
    project.hasProjectVibe ? "有项目文件" : "待初始化",
    formatRecentProjectUpdatedAt(project.updatedAt),
  ]
    .filter(Boolean)
    .join(" · ");
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
  createProjectTitle,
  createProjectAriaLabel,
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
  createProjectTitle?: string;
  createProjectAriaLabel?: string;
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
  const storyViewLabel = activeSection ? `故事 · ${storyLabel} · ${totalShots} 个镜头` : `故事 · ${totalShots} 个镜头`;
  const isEmptyProject = totalShots === 0;
  const projectTitleLabel = projectTitle || "新视频项目";
  const projectFolderReady = Boolean(projectRoot?.trim());
  const unsavedProjectContent = !projectFolderReady && !isEmptyProject;
  const projectStorageBadge = projectFolderReady ? "本地" : "草稿";
  const emptyProjectPrimary = projectFolderReady ? "本地已准备" : "未保存草稿";
  const emptyProjectSecondary = projectFolderReady ? "确认后写入项目" : "先写想法";
  const [projectControlOpen, setProjectControlOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const projectControlRef = useRef<HTMLDivElement>(null);
  const projectRootLabel = compactProjectPathLabel(projectRoot) || "尚未选择本地文件夹";
  const currentProjectPathLabel = compactProjectPathLabel(currentProjectPath);
  const projectContentSummary = isEmptyProject
    ? projectFolderReady
      ? "底部发送脚本后，会写入这个项目文件夹。"
      : "先从底部发送想法或脚本，或打开已有项目。"
    : `故事流 · ${totalShots} 个镜头 · ${projectPlan.statusLabel}`;
  const projectSaveSummary = currentProjectPathLabel || (projectFolderReady ? "确认草案后创建项目文件" : "尚未选择保存位置");
  const projectControlStatus = projectFolderReady
    ? isEmptyProject
      ? "已准备项目文件夹"
      : "项目已连接"
    : "未保存草稿";
  const projectPickerDisabled = Boolean(!canCreateProject && !canChooseProjectRoot);
  const projectPickerDisabledCopy = projectFileStatusDetail || "可以先整理草稿；当前浏览器不能打开本地文件夹，生成参考或提交视频前请在桌面 App 选择项目。";
  const createProjectDisplayTitle = unsavedProjectContent
    ? "另开新草稿"
    : createProjectTitle || "新建项目";
  const createProjectDisplayAriaLabel = unsavedProjectContent
    ? "另开新草稿，不保存当前故事"
    : createProjectAriaLabel || "新建项目";
  const createProjectActionTitle = unsavedProjectContent
    ? "会开始一个空草稿；当前故事不会保存到本地项目。"
    : canCreateProject ? createProjectTitle || "新建项目" : projectPickerDisabledCopy;
  const recentProjectItems = (recentProjects || [])
    .filter((project) => project.projectRoot.trim())
    .slice(0, 6);
  const showWorkspaceTabs = !isEmptyProject;
  const exportDisabled = isEmptyProject || !projectFolderReady;
  const exportDisabledTitle = !projectFolderReady
    ? "先保存为本地项目，再导出。"
    : "先写故事或打开项目，再导出。";
  const currentViewLabel = directorView === "assets" ? "参考" : directorView === "preview" ? "预览" : "故事";
  const currentViewDetail = directorView === "assets"
    ? "角色、场景、道具"
    : directorView === "preview"
      ? "回流与粗看"
      : `${totalShots} 个镜头`;

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

  function openView(nextView: DirectorView) {
    setViewMenuOpen(false);
    onOpenDirectorView(nextView);
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
            aria-label={`项目控制：${projectTitleLabel}，${projectControlStatus}`}
            aria-expanded={projectControlOpen}
          >
            <span className="project-title-row">
              <span className="project-title-text">{projectTitleLabel}</span>
              <em className={`project-title-storage ${projectFolderReady ? "local" : "draft"}`}>{projectStorageBadge}</em>
              <ChevronDown size={14} aria-hidden="true" />
            </span>
          </button>
          {projectControlOpen && (
            <div className="project-control-popover" role="dialog" aria-label="项目控制">
              <div className="project-control-head">
                <span>当前项目</span>
                <strong>{projectTitleLabel}</strong>
                <small>{projectControlStatus}</small>
                <p>这里切换本地项目；退出或移除记录都不会删除文件。</p>
              </div>
              <div className="project-control-summary" aria-label="项目状态">
                <span>内容</span>
                <strong>{projectContentSummary}</strong>
                {!isEmptyProject && (
                  <span className="minimal-state-dots" aria-label={projectPlan.statusLabel}>
                    {projectPlan.progressDots.map((dot) => (
                      <i key={dot.id} className={dot.tone} title={dot.label} />
                    ))}
                  </span>
                )}
              </div>
              <div className="project-control-path">
                <span>文件夹</span>
                <strong title={projectRoot}>{projectRootLabel}</strong>
                <small title={currentProjectPath || projectSaveSummary}>保存文件：{projectSaveSummary}</small>
              </div>
              <div className="project-control-recent">
                <span>最近项目</span>
                {recentProjectItems.length > 0 ? (
                  <div className="project-control-recent-list">
                    {recentProjectItems.map((project) => {
                      const active = Boolean(projectRoot && project.projectRoot === projectRoot);
                      const metaLabel = recentProjectMetaLabel(project);
                      const removeDisabled = active || !onRemoveRecentProject;
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
                            aria-label={`打开项目 ${project.displayName || "未命名项目"}`}
                          >
                            <strong>
                              <span>{project.displayName || "未命名项目"}</span>
                              {active && <em className="project-control-current-badge">当前</em>}
                            </strong>
                            <small title={project.projectRoot}>{compactProjectPathLabel(project.projectRoot)}</small>
                            {metaLabel && <small className="project-control-recent-meta">{metaLabel}</small>}
                          </button>
                          <button
                            type="button"
                            className="project-control-recent-remove"
                            disabled={removeDisabled}
                            title={active ? "当前项目请用退出项目，不删除本地文件" : "移除这条项目记录，不删除本地文件"}
                            aria-label={active ? `当前项目 ${project.displayName || "未命名项目"} 请用退出项目` : `移除 ${project.displayName || "未命名项目"} 的项目记录`}
                            onClick={(event) => {
                              event.stopPropagation();
                              onRemoveRecentProject?.(project.projectRoot);
                            }}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <small className="project-control-recent-empty">打开或新建项目后，会在这里快速切换。</small>
                )}
              </div>
              <div className="project-control-actions">
                {onCreateProject && (
                  <button
                    type="button"
                    disabled={!canCreateProject}
                    onClick={() => performProjectControlAction(onCreateProject)}
                    title={createProjectActionTitle}
                    aria-label={createProjectDisplayAriaLabel}
                  >
                    <FolderPlus size={15} aria-hidden="true" />
                    {createProjectDisplayTitle}
                  </button>
                )}
                {onChooseProjectRoot && (
                  <button
                    type="button"
                    disabled={!canChooseProjectRoot}
                    onClick={() => performProjectControlAction(onChooseProjectRoot)}
                    title={canChooseProjectRoot ? projectFileStatusDetail || projectFileStatusLabel || "打开项目" : projectPickerDisabledCopy}
                    aria-label="打开本地项目"
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
                    title="退出当前项目，不删除本地文件"
                    aria-label="关闭当前项目记录"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    退出项目
                  </button>
                )}
                {projectPickerDisabled && (
                  <small className="project-control-action-note">{projectPickerDisabledCopy}</small>
                )}
                {unsavedProjectContent && (
                  <small className="project-control-action-note">
                    当前故事还没保存；另开草稿不会保存它。生成参考前请先在桌面 App 选择本地项目文件夹。
                  </small>
                )}
                {!projectPickerDisabled && onChooseProjectRoot && !canChooseProjectRoot && (
                  <small className="project-control-action-note">打开已有项目需要桌面文件选择器；当前环境可以先继续整理草稿。</small>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {showWorkspaceTabs && (
        <details
          className="minimal-nav minimal-nav-menu"
          aria-label="项目内容"
          open={viewMenuOpen}
          onToggle={(event) => setViewMenuOpen(event.currentTarget.open)}
        >
          <summary aria-label={`当前查看：${currentViewLabel}`}>
            <span className="minimal-nav-label">查看</span>
            <strong>{currentViewLabel}</strong>
            <small>{currentViewDetail}</small>
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          {viewMenuOpen && (
            <div className="minimal-nav-menu-list">
              <button
                className={mode === "director" && directorView === "story" ? "active" : ""}
                onClick={() => openView("story")}
                title={activeSection?.label || "故事"}
                aria-label={storyViewLabel}
              >
                <span className="minimal-section-label">故事</span>
                <small className="minimal-section-count">{totalShots}</small>
              </button>
              <button
                className={mode === "director" && directorView === "assets" ? "active" : ""}
                onClick={() => openView("assets")}
                aria-label="参考素材"
              >
                参考
              </button>
              <button
                className={mode === "director" && directorView === "preview" ? "active" : ""}
                onClick={() => openView("preview")}
                aria-label="预览"
              >
                预览
              </button>
            </div>
          )}
        </details>
      )}
      <div className="minimal-topbar-actions">
        <button
          className={`diagnostics-link topbar-export-action ${mode === "director" && directorView === "export" ? "active" : ""}`}
          disabled={exportDisabled}
          onClick={() => onOpenDirectorView("export")}
          title={exportDisabled ? exportDisabledTitle : "导出"}
          aria-label="导出"
        >
          导出
        </button>
        <button className={`diagnostics-link ${showInspector ? "active" : ""}`} onClick={onOpenInspector} aria-label="设置">
          <Settings size={18} aria-hidden="true" />
          <span className="settings-link-label">设置</span>
        </button>
      </div>
    </header>
  );
}
