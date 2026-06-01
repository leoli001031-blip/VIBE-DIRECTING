export interface ElectronBridge {
  runtimeApiBaseUrl?(): string;
  ensureRuntimeApiBaseUrl?(): Promise<string>;
  chooseProjectRoot?(): Promise<{
    cancelled: boolean;
    projectRoot?: string;
    projectPath?: string;
    projectVibePath?: string;
    hasProjectVibe?: boolean;
    displayName?: string;
  }>;
  createLocalProject?(input?: { displayName?: string }): Promise<{
    cancelled: boolean;
    projectRoot?: string;
    projectPath?: string;
    projectVibePath?: string;
    hasProjectVibe?: boolean;
    displayName?: string;
  }>;
  rememberProject?(projectRoot: string): Promise<{
    cancelled: boolean;
    projectRoot?: string;
    projectPath?: string;
    projectVibePath?: string;
    hasProjectVibe?: boolean;
    displayName?: string;
  }>;
  forgetProject?(projectRoot: string): Promise<{ forgotten: boolean }>;
  sandboxWatch(watchDir: string): Promise<{ watching: boolean; dir: string; watchId?: string; reason?: string }>;
  sandboxUnwatch?(watchId: string): Promise<{ unwatched: boolean; watchId: string; reason?: string }>;
  sandboxFileExists?(filePath: string): Promise<{ exists: boolean; path: string }>;
  sandboxReadFile(filePath: string): Promise<{ content: string; hash: string; path: string }>;
  sandboxWriteFile(filePath: string, data: string): Promise<{ written: boolean; path: string; hash: string }>;
  sandboxCopyFile?(sourcePath: string, destinationPath: string): Promise<{ copied: boolean; sourcePath: string; path: string; hash: string; size: number }>;
  sandboxSpawn(command: string, args: string[]): Promise<{ exitCode: number | null; stdout: string; stderr: string }>;
}

declare global {
  interface Window {
    vibeRuntime?: ElectronBridge;
  }
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.vibeRuntime;
}

export function getElectronBridge(): ElectronBridge {
  const bridge = window.vibeRuntime;
  if (!bridge) throw new Error("Electron bridge not available");
  return bridge;
}
