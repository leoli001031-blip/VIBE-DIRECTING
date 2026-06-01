import { contextBridge, ipcRenderer } from "electron";

const runtimeApiBaseUrlArg = process.argv.find((arg) => arg.startsWith("--vibe-runtime-api-base-url="));
let runtimeApiBaseUrl = runtimeApiBaseUrlArg?.split("=").slice(1).join("=") || "";
let runtimeApiBaseUrlStarting: Promise<string> | null = null;

async function ensureRuntimeApiBaseUrl() {
  if (runtimeApiBaseUrl) return runtimeApiBaseUrl;
  if (runtimeApiBaseUrlStarting) return runtimeApiBaseUrlStarting;
  runtimeApiBaseUrlStarting = ipcRenderer.invoke("runtime:ensureStarted")
    .then((value) => {
      runtimeApiBaseUrl = typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
      return runtimeApiBaseUrl;
    })
    .finally(() => {
      runtimeApiBaseUrlStarting = null;
    });
  return runtimeApiBaseUrlStarting;
}

contextBridge.exposeInMainWorld("__VIBE_RUNTIME_API_BASE_URL__", runtimeApiBaseUrl);

contextBridge.exposeInMainWorld("vibeRuntime", {
  runtimeApiBaseUrl: () => runtimeApiBaseUrl,
  ensureRuntimeApiBaseUrl,
  chooseProjectRoot: () => ipcRenderer.invoke("project:chooseRoot"),
  createLocalProject: (input?: { displayName?: string }) => ipcRenderer.invoke("project:createLocal", input),
  rememberProject: (projectRoot: string) => ipcRenderer.invoke("project:remember", projectRoot),
  forgetProject: (projectRoot: string) => ipcRenderer.invoke("project:forget", projectRoot),
  sandboxWatch: (watchDir: string) => ipcRenderer.invoke("sandbox:watch", watchDir),
  sandboxUnwatch: (watchId: string) => ipcRenderer.invoke("sandbox:unwatch", watchId),
  sandboxFileExists: (filePath: string) => ipcRenderer.invoke("sandbox:fileExists", filePath),
  sandboxReadFile: (filePath: string) => ipcRenderer.invoke("sandbox:readFile", filePath),
  sandboxWriteFile: (filePath: string, data: string) => ipcRenderer.invoke("sandbox:writeFile", filePath, data),
  sandboxCopyFile: (sourcePath: string, destinationPath: string) => ipcRenderer.invoke("sandbox:copyFile", sourcePath, destinationPath),
  sandboxSpawn: (command: string, args: string[]) => ipcRenderer.invoke("sandbox:spawn", command, args),
});
