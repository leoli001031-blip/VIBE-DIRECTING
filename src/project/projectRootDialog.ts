import type { ElectronBridge } from "../core/electronBridge";

export interface ProjectRootDialogSelection {
  cancelled: boolean;
  projectRoot?: string;
  projectPath?: string;
  projectVibePath?: string;
  hasProjectVibe?: boolean;
  displayName?: string;
}

export function canChooseProjectRoot(): boolean {
  return typeof electronBridge()?.chooseProjectRoot === "function";
}

export function canCreateLocalProject(): boolean {
  return typeof electronBridge()?.createLocalProject === "function";
}

export function canRememberProjectRoot(): boolean {
  return typeof electronBridge()?.rememberProject === "function";
}

export async function chooseProjectRoot(): Promise<ProjectRootDialogSelection> {
  const bridge = electronBridge();
  if (!bridge?.chooseProjectRoot) {
    return { cancelled: true };
  }
  const selection = await bridge.chooseProjectRoot();
  return normalizeSelection(selection);
}

export async function createLocalProject(input?: { displayName?: string }): Promise<ProjectRootDialogSelection> {
  const bridge = electronBridge();
  if (!bridge?.createLocalProject) {
    return { cancelled: true };
  }
  const selection = await bridge.createLocalProject(input);
  return normalizeSelection(selection);
}

export async function rememberProjectRoot(projectRoot: string): Promise<ProjectRootDialogSelection> {
  const bridge = electronBridge();
  if (!bridge?.rememberProject) {
    return { cancelled: true };
  }
  const selection = await bridge.rememberProject(projectRoot);
  return normalizeSelection(selection);
}

function electronBridge(): ElectronBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return window.vibeRuntime;
}

function normalizeSelection(selection: ProjectRootDialogSelection): ProjectRootDialogSelection {
  if (selection.cancelled || !selection.projectRoot?.trim()) return { cancelled: true };
  return {
    cancelled: false,
    projectRoot: selection.projectRoot.trim(),
    projectPath: selection.projectPath?.trim() || "project.vibe",
    projectVibePath: selection.projectVibePath?.trim(),
    hasProjectVibe: selection.hasProjectVibe === true,
    displayName: selection.displayName?.trim(),
  };
}
