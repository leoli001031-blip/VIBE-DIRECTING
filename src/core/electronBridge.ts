export interface ElectronBridge {
  runtimeApiBaseUrl?(): string;
  runtimeApiToken?(): string;
  ensureRuntimeApiBaseUrl?(): Promise<string>;
  currentProjectBinding?(): Promise<unknown>;
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
  browserDraftBootstrap?(): {
    activeStorageKey?: string;
    pendingIntakeStorageKey?: string;
  };
  browserDraftFileExists?(input: { storageKey: string; path: string }): Promise<{ exists: boolean; path: string }>;
  browserDraftReadFile?(input: { storageKey: string; path: string }): Promise<{ content: string; path: string }>;
  browserDraftWriteFile?(input: { storageKey: string; path: string; content: string }): Promise<{ written: boolean; path: string }>;
  browserDraftDeleteFile?(input: { storageKey: string; path: string }): Promise<{ deleted: boolean; path: string }>;
  browserDraftForget?(storageKey: string): Promise<{ forgotten: boolean }>;
  browserDraftRememberPointer?(input: {
    kind: "active_project" | "pending_intake";
    storageKey?: string;
  }): Promise<{
    activeStorageKey?: string;
    pendingIntakeStorageKey?: string;
  }>;
  exportDiagnostics?(): Promise<{
    cancelled: boolean;
    filePath?: string;
    fileName?: string;
    size?: number;
    sha256?: string;
    sidecarCount?: number;
    generatedAt?: string;
  }>;
  sandboxWatch(watchDir: string): Promise<{ watching: boolean; dir: string; watchId?: string; reason?: string }>;
  sandboxUnwatch?(watchId: string): Promise<{ unwatched: boolean; watchId: string; reason?: string }>;
  sandboxFileExists?(filePath: string): Promise<{ exists: boolean; path: string }>;
  sandboxReadFile(filePath: string): Promise<{ content: string; hash: string; path: string }>;
  sandboxHashFile?(filePath: string): Promise<{ path: string; hash: string; size: number }>;
  sandboxWriteFile(filePath: string, data: string): Promise<{ written: boolean; path: string; hash: string }>;
  sandboxCopyFile?(sourcePath: string, destinationPath: string): Promise<{ copied: boolean; sourcePath: string; path: string; hash: string; size: number }>;
  sandboxPublishDirectory?(stagingPath: string, destinationPath: string): Promise<{
    published: boolean;
    stagingPath: string;
    destinationPath: string;
    previousPath?: string;
  }>;
  sandboxDiscardStagedExport?(stagingPath: string): Promise<{ discarded: boolean; stagingPath: string }>;
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
