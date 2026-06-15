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
  if (!canChoose) return "先写想法";
  return "打开项目";
}

export function projectFileSelectionDetail(selection: ProjectFileSelectionStatus, canUseLocalProjectPicker = true): string {
  if (selection.status === "selected") {
    return selection.hasProjectVibe ? "当前项目已连接" : "会创建项目文件";
  }
  if (!canUseLocalProjectPicker && selection.status !== "error") {
    return "可以先整理想法；当前浏览器不能打开本地文件夹，生成前请在桌面 App 选择项目。";
  }
  if (selection.detail) return selection.detail;
  if (selection.status === "unavailable") return "可以先整理想法；生成前请在桌面 App 选择项目。";
  return "选择一个本地项目文件夹";
}
