import type { ProjectRuntimeState } from "../../core/projectState";

export type ProjectFileSelectionStatus = {
  status: "idle" | "choosing" | "selected" | "unavailable" | "error";
  label: string;
  detail?: string;
  projectRoot?: string;
  projectPath?: string;
  projectVibePath?: string;
  hasProjectVibe?: boolean;
  displayName?: string;
};

export function prototypeProjectDraftStorageKey(state: ProjectRuntimeState): string {
  const projectId = state.sourceIndex.projectId || state.project.title || "current_project";
  return `vibe-director:project-vibe:${projectId}`;
}

export function projectFileSelectionLabel(selection: ProjectFileSelectionStatus, canChoose: boolean): string {
  if (selection.status === "choosing") return "选择中";
  if (selection.status === "selected") return "切换项目";
  if (selection.status === "error") return "打开失败";
  if (!canChoose) return "浏览器草稿";
  return "打开项目";
}

export function projectFileSelectionDetail(selection: ProjectFileSelectionStatus): string {
  if (selection.detail) return selection.detail;
  if (selection.status === "selected") {
    return selection.hasProjectVibe ? "当前项目已连接" : "会创建项目文件";
  }
  if (selection.status === "unavailable") return "当前环境没有项目选择器";
  return "选择一个本地项目文件夹";
}
