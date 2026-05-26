"use strict";

// electron/preload.mts
var import_electron = require("electron");
var runtimeApiBaseUrlArg = process.argv.find((arg) => arg.startsWith("--vibe-runtime-api-base-url="));
var runtimeApiBaseUrl = runtimeApiBaseUrlArg?.split("=").slice(1).join("=") || "";
var runtimeApiBaseUrlStarting = null;
async function ensureRuntimeApiBaseUrl() {
  if (runtimeApiBaseUrl) return runtimeApiBaseUrl;
  if (runtimeApiBaseUrlStarting) return runtimeApiBaseUrlStarting;
  runtimeApiBaseUrlStarting = import_electron.ipcRenderer.invoke("runtime:ensureStarted").then((value) => {
    runtimeApiBaseUrl = typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
    return runtimeApiBaseUrl;
  }).finally(() => {
    runtimeApiBaseUrlStarting = null;
  });
  return runtimeApiBaseUrlStarting;
}
import_electron.contextBridge.exposeInMainWorld("__VIBE_RUNTIME_API_BASE_URL__", runtimeApiBaseUrl);
import_electron.contextBridge.exposeInMainWorld("vibeRuntime", {
  runtimeApiBaseUrl: () => runtimeApiBaseUrl,
  ensureRuntimeApiBaseUrl,
  chooseProjectRoot: () => import_electron.ipcRenderer.invoke("project:chooseRoot"),
  createLocalProject: (input) => import_electron.ipcRenderer.invoke("project:createLocal", input),
  rememberProject: (projectRoot) => import_electron.ipcRenderer.invoke("project:remember", projectRoot),
  forgetProject: (projectRoot) => import_electron.ipcRenderer.invoke("project:forget", projectRoot),
  sandboxWatch: (watchDir) => import_electron.ipcRenderer.invoke("sandbox:watch", watchDir),
  sandboxUnwatch: (watchId) => import_electron.ipcRenderer.invoke("sandbox:unwatch", watchId),
  sandboxReadFile: (filePath) => import_electron.ipcRenderer.invoke("sandbox:readFile", filePath),
  sandboxWriteFile: (filePath, data) => import_electron.ipcRenderer.invoke("sandbox:writeFile", filePath, data),
  sandboxCopyFile: (sourcePath, destinationPath) => import_electron.ipcRenderer.invoke("sandbox:copyFile", sourcePath, destinationPath),
  sandboxSpawn: (command, args) => import_electron.ipcRenderer.invoke("sandbox:spawn", command, args)
});
