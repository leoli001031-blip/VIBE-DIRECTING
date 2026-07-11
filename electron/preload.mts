import { contextBridge, ipcRenderer } from "electron";

const runtimeApiBaseUrlArg = process.argv.find((arg) => arg.startsWith("--vibe-runtime-api-base-url="));
let runtimeApiBaseUrl = runtimeApiBaseUrlArg?.split("=").slice(1).join("=") || "";
let runtimeApiToken = "";
let runtimeApiBaseUrlStarting: Promise<string> | null = null;
const currentProjectBindingArg = process.argv.find((arg) => arg.startsWith("--vibe-current-project-binding="));

function currentProjectBindingBootstrap() {
  if (!currentProjectBindingArg) return undefined;
  try {
    const encoded = currentProjectBindingArg.split("=").slice(1).join("=");
    const parsed = JSON.parse(decodeURIComponent(encoded)) as unknown;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function ensureRuntimeApiBaseUrl() {
  if (runtimeApiBaseUrl) return runtimeApiBaseUrl;
  if (runtimeApiBaseUrlStarting) return runtimeApiBaseUrlStarting;
  runtimeApiBaseUrlStarting = ipcRenderer.invoke("runtime:ensureStarted")
    .then((value) => {
      const payload = value && typeof value === "object" ? value as { baseUrl?: unknown; token?: unknown } : undefined;
      runtimeApiBaseUrl = typeof payload?.baseUrl === "string"
        ? payload.baseUrl.trim().replace(/\/+$/, "")
        : typeof value === "string"
          ? value.trim().replace(/\/+$/, "")
          : "";
      runtimeApiToken = typeof payload?.token === "string" ? payload.token : "";
      return runtimeApiBaseUrl;
    })
    .finally(() => {
      runtimeApiBaseUrlStarting = null;
    });
  return runtimeApiBaseUrlStarting;
}

contextBridge.exposeInMainWorld("__VIBE_RUNTIME_API_BASE_URL__", runtimeApiBaseUrl);
const bootstrappedCurrentProjectBinding = currentProjectBindingBootstrap();
if (bootstrappedCurrentProjectBinding) {
  contextBridge.exposeInMainWorld("__VIBE_CURRENT_PROJECT_BINDING__", bootstrappedCurrentProjectBinding);
}

contextBridge.exposeInMainWorld("vibeRuntime", {
  runtimeApiBaseUrl: () => runtimeApiBaseUrl,
  runtimeApiToken: () => runtimeApiToken,
  ensureRuntimeApiBaseUrl,
  currentProjectBinding: () => ipcRenderer.invoke("project:currentBinding"),
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
