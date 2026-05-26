// electron/main.mts
import * as electron from "electron";
import { spawn } from "node:child_process";
import path2 from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import crypto from "node:crypto";
import net from "node:net";

// electron/projectScope.mts
import path from "node:path";
function isInsideRoot(root, target) {
  const scopedRelative = path.relative(root, target);
  return scopedRelative === "" || !scopedRelative.startsWith("..") && !path.isAbsolute(scopedRelative);
}
function createProjectRootScope() {
  const allowedProjectRoots = /* @__PURE__ */ new Set();
  return {
    rememberProjectRoot(projectRoot) {
      const resolved = path.resolve(projectRoot);
      allowedProjectRoots.add(resolved);
      return resolved;
    },
    forgetProjectRoot(projectRoot) {
      const resolved = path.resolve(projectRoot);
      return allowedProjectRoots.delete(resolved);
    },
    resolveOpenedProjectPath(filePath, label) {
      const resolved = path.resolve(filePath);
      const root = Array.from(allowedProjectRoots).find((candidate) => isInsideRoot(candidate, resolved));
      if (!root) {
        throw new Error(`${label} must stay inside an opened project folder.`);
      }
      return resolved;
    },
    findRoot(filePath) {
      const resolved = path.resolve(filePath);
      return Array.from(allowedProjectRoots).find((candidate) => isInsideRoot(candidate, resolved));
    },
    roots() {
      return Array.from(allowedProjectRoots);
    }
  };
}
function spawnAllowed(command, args) {
  const executable = path.basename(command);
  const normalizedArgs = args || [];
  if (!["node", "npm", "npx"].includes(executable)) return false;
  return normalizedArgs.length === 1 && ["--version", "-v"].includes(normalizedArgs[0]);
}

// electron/main.mts
var { app, BrowserWindow, dialog, ipcMain } = electron;
app.setName("Vibe Director Studio");
if (process.platform === "darwin") {
  app.commandLine.appendSwitch("use-mock-keychain");
}
var __dirname = path2.dirname(fileURLToPath(import.meta.url));
function readEnv(primaryName, legacyName) {
  return process.env[primaryName] || (legacyName ? process.env[legacyName] : void 0);
}
function findWorkspaceRootNear(startPath) {
  if (!startPath) return void 0;
  let cursor = path2.resolve(startPath);
  if (fs.existsSync(cursor) && !fs.statSync(cursor).isDirectory()) cursor = path2.dirname(cursor);
  for (let depth = 0; depth < 10; depth += 1) {
    if (fs.existsSync(path2.join(cursor, "package.json")) && fs.existsSync(path2.join(cursor, ".vibe-runtime"))) {
      return cursor;
    }
    const parent = path2.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return void 0;
}
var appRoot = process.env.VIBE_ELECTRON_APP_ROOT ? path2.resolve(process.env.VIBE_ELECTRON_APP_ROOT) : path2.join(__dirname, "..");
var preloadPath = process.env.VIBE_ELECTRON_PRELOAD ? path2.resolve(process.env.VIBE_ELECTRON_PRELOAD) : fs.existsSync(path2.join(__dirname, "preload.cjs")) ? path2.join(__dirname, "preload.cjs") : path2.join(__dirname, "preload.mts");
var devUrl = process.env.VIBE_ELECTRON_DEV_URL || "http://127.0.0.1:5174";
var isDev = !app.isPackaged;
var runtimeHost = readEnv("VIBE_DIRECTOR_RUNTIME_API_HOST", "VIBE_CORE_RUNTIME_API_HOST") || "127.0.0.1";
var smokeMode = process.env.VIBE_ELECTRON_SMOKE === "1";
var smokeMarker = "__VIBE_ELECTRON_PACKAGED_GUI_SMOKE__";
var runtimeServer = null;
var runtimeApiBaseUrl;
var runtimeServerStarting = null;
var projectRootScope = createProjectRootScope();
var sandboxWatchers = /* @__PURE__ */ new Map();
var rootToWatchers = /* @__PURE__ */ new Map();
var sandboxWatchCounter = 0;
function closeSandboxWatcher(watchId) {
  const watcher = sandboxWatchers.get(watchId);
  if (!watcher) return false;
  watcher.close();
  sandboxWatchers.delete(watchId);
  for (const watchers of rootToWatchers.values()) {
    watchers.delete(watchId);
  }
  return true;
}
function closeSandboxWatchers() {
  for (const watchId of sandboxWatchers.keys()) {
    closeSandboxWatcher(watchId);
  }
}
function canListenOnPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, runtimeHost);
  });
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function chooseRuntimePort() {
  const preferred = Number(readEnv("VIBE_DIRECTOR_RUNTIME_API_PORT", "VIBE_CORE_RUNTIME_API_PORT") || 8790);
  if (Number.isInteger(preferred) && preferred > 0 && await canListenOnPort(preferred)) return preferred;
  for (let candidate = 8791; candidate <= 8810; candidate += 1) {
    if (await canListenOnPort(candidate)) return candidate;
  }
  return 0;
}
function projectVibeCandidates(projectRoot) {
  return [
    path2.join(projectRoot, "project.vibe"),
    path2.join(projectRoot, "project", "project.vibe"),
    path2.join(projectRoot, "project", "project.vibe.json")
  ];
}
function projectVibePathForRoot(projectRoot) {
  return projectVibeCandidates(projectRoot).find((candidate) => fs.existsSync(candidate)) || path2.join(projectRoot, "project", "project.vibe");
}
function projectPathRelativeToRoot(projectRoot, filePath) {
  return path2.relative(projectRoot, filePath).replace(/\\/g, "/") || "project.vibe";
}
function timestampForProjectFolder() {
  return (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "").replace(/[-:T]/g, "").slice(0, 14);
}
function safeProjectFolderName(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  const cleaned = raw.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 48);
  return cleaned || "\u65B0\u89C6\u9891";
}
function nextAvailableProjectRoot(displayName) {
  const configuredProjectsRoot = readEnv("VIBE_DIRECTOR_PROJECTS_ROOT");
  const projectsRoot = configuredProjectsRoot ? path2.resolve(configuredProjectsRoot) : isDev ? path2.join(appRoot, ".vibe-runtime", "projects") : path2.join(app.getPath("documents"), "Vibe Director Studio Projects");
  fs.mkdirSync(projectsRoot, { recursive: true });
  const baseName = `${safeProjectFolderName(displayName)}-${timestampForProjectFolder()}`;
  let candidate = path2.join(projectsRoot, baseName);
  for (let index = 2; fs.existsSync(candidate); index += 1) {
    candidate = path2.join(projectsRoot, `${baseName}-${index}`);
  }
  return candidate;
}
function selectionForProjectRoot(projectRoot, displayName) {
  const resolvedProjectRoot = path2.resolve(projectRoot);
  projectRootScope.rememberProjectRoot(resolvedProjectRoot);
  const projectVibePath = projectVibePathForRoot(resolvedProjectRoot);
  return {
    cancelled: false,
    projectRoot: resolvedProjectRoot,
    projectPath: projectPathRelativeToRoot(resolvedProjectRoot, projectVibePath),
    projectVibePath,
    hasProjectVibe: fs.existsSync(projectVibePath),
    displayName: displayName || path2.basename(resolvedProjectRoot) || "\u672A\u547D\u540D\u9879\u76EE"
  };
}
async function startRuntimeServer() {
  if (runtimeServer && runtimeApiBaseUrl) return runtimeApiBaseUrl;
  const packagedResourcesPath = process.resourcesPath;
  const packagedWorkspaceRoot = app.isPackaged ? findWorkspaceRootNear(packagedResourcesPath || app.getAppPath()) : void 0;
  const runtimeWorkdir = readEnv("VIBE_DIRECTOR_RUNTIME_WORKDIR", "VIBE_CORE_RUNTIME_WORKDIR") || (isDev ? appRoot : packagedWorkspaceRoot || app.getPath("userData"));
  const unpackedServerScript = path2.join(
    packagedResourcesPath || path2.dirname(appRoot),
    "app.asar.unpacked",
    "electron-runtime",
    "local-runtime-api-server.mjs"
  );
  const serverScript = app.isPackaged && fs.existsSync(unpackedServerScript) ? unpackedServerScript : path2.join(appRoot, "electron-runtime", "local-runtime-api-server.mjs");
  if (!fs.existsSync(serverScript)) {
    console.warn(`Runtime API server skipped; bundled server script is missing: ${serverScript}`);
    return void 0;
  }
  const runtimePort = await chooseRuntimePort();
  const currentProjectBindingPath = readEnv("VIBE_DIRECTOR_CURRENT_PROJECT_BINDING_PATH", "VIBE_CORE_CURRENT_PROJECT_BINDING_PATH") || path2.join(app.getPath("userData"), "current-project.local.json");
  try {
    runtimeServer = spawn(process.execPath, [serverScript], {
      stdio: "pipe",
      cwd: runtimeWorkdir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        VIBE_DIRECTOR_RUNTIME_API_HOST: runtimeHost,
        VIBE_DIRECTOR_RUNTIME_API_PORT: String(runtimePort),
        VIBE_DIRECTOR_RUNTIME_WORKDIR: runtimeWorkdir,
        VIBE_DIRECTOR_CURRENT_PROJECT_BINDING_PATH: currentProjectBindingPath,
        // Compatibility for historical runtime scripts; new code should read VIBE_DIRECTOR_* first.
        VIBE_CORE_RUNTIME_API_HOST: runtimeHost,
        VIBE_CORE_RUNTIME_API_PORT: String(runtimePort),
        VIBE_CORE_RUNTIME_WORKDIR: runtimeWorkdir,
        VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: currentProjectBindingPath
      }
    });
  } catch (error) {
    console.error(`Runtime API server failed to start: ${error instanceof Error ? error.message : String(error)}`);
    runtimeServer = null;
    return void 0;
  }
  runtimeServer.stdout?.on("data", (data) => {
    process.stdout.write(`[runtime] ${data}`);
  });
  runtimeServer.stderr?.on("data", (data) => {
    process.stderr.write(`[runtime] ${data}`);
  });
  runtimeServer.on("error", (error) => {
    console.error(`Runtime API server error: ${error instanceof Error ? error.message : String(error)}`);
  });
  runtimeServer.on("close", (code) => {
    runtimeServer = null;
    runtimeApiBaseUrl = void 0;
    if (code !== 0 && code !== null) {
      console.error(`Runtime API server exited with code ${code}`);
    }
  });
  const nextRuntimeApiBaseUrl = `http://${runtimeHost}:${runtimePort}`;
  try {
    await waitForRuntimeStatus(nextRuntimeApiBaseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Runtime API server did not become ready: ${message}`);
    runtimeServer?.kill();
    runtimeServer = null;
    throw error;
  }
  runtimeApiBaseUrl = nextRuntimeApiBaseUrl;
  return runtimeApiBaseUrl;
}
async function ensureRuntimeServer() {
  if (runtimeServerStarting) return runtimeServerStarting;
  if (runtimeServer && runtimeApiBaseUrl) return runtimeApiBaseUrl;
  runtimeServerStarting = startRuntimeServer().finally(() => {
    runtimeServerStarting = null;
  });
  return runtimeServerStarting;
}
function registerIpcHandlers() {
  ipcMain.handle("runtime:ensureStarted", async () => {
    return await ensureRuntimeServer();
  });
  ipcMain.handle("project:chooseRoot", async () => {
    const result = await dialog.showOpenDialog({
      title: "\u6253\u5F00\u9879\u76EE",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || !result.filePaths[0]) {
      return { cancelled: true };
    }
    return selectionForProjectRoot(result.filePaths[0]);
  });
  ipcMain.handle("project:createLocal", async (_event, input) => {
    const projectRoot = nextAvailableProjectRoot(input?.displayName || "\u65B0\u89C6\u9891");
    fs.mkdirSync(projectRoot, { recursive: true });
    return selectionForProjectRoot(projectRoot, path2.basename(projectRoot) || "\u672A\u547D\u540D\u9879\u76EE");
  });
  ipcMain.handle("project:remember", async (_event, projectRoot) => {
    if (!projectRoot || typeof projectRoot !== "string") {
      return { cancelled: true };
    }
    const resolved = path2.resolve(projectRoot);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return { cancelled: true };
    }
    return selectionForProjectRoot(resolved);
  });
  ipcMain.handle("project:forget", async (_event, projectRoot) => {
    if (!projectRoot || typeof projectRoot !== "string") {
      throw new Error("project:forget requires a projectRoot");
    }
    const resolved = path2.resolve(projectRoot);
    const existed = projectRootScope.forgetProjectRoot(resolved);
    const watchers = rootToWatchers.get(resolved);
    if (watchers) {
      for (const watchId of watchers) {
        closeSandboxWatcher(watchId);
      }
      rootToWatchers.delete(resolved);
    }
    return { forgotten: existed };
  });
  ipcMain.handle("sandbox:watch", async (_event, watchDir) => {
    if (!watchDir || typeof watchDir !== "string") {
      throw new Error("sandbox:watch requires a watchDir path");
    }
    const resolved = projectRootScope.resolveOpenedProjectPath(watchDir, "sandbox:watch");
    if (!fs.existsSync(resolved)) {
      return { watching: false, reason: `directory not found: ${resolved}` };
    }
    const watchId = `watch_${Date.now()}_${sandboxWatchCounter += 1}`;
    const watcher = fs.watch(resolved, { recursive: true });
    watcher.on("error", () => {
      sandboxWatchers.delete(watchId);
    });
    sandboxWatchers.set(watchId, watcher);
    const root = projectRootScope.findRoot(resolved);
    if (root) {
      let set = rootToWatchers.get(root);
      if (!set) {
        set = /* @__PURE__ */ new Set();
        rootToWatchers.set(root, set);
      }
      set.add(watchId);
    }
    return {
      watching: true,
      dir: resolved,
      watchId
    };
  });
  ipcMain.handle("sandbox:unwatch", async (_event, watchId) => {
    if (!watchId || typeof watchId !== "string") {
      throw new Error("sandbox:unwatch requires a watchId");
    }
    return { unwatched: closeSandboxWatcher(watchId), watchId };
  });
  ipcMain.handle("sandbox:readFile", async (_event, filePath) => {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("sandbox:readFile requires a filePath");
    }
    const resolved = projectRootScope.resolveOpenedProjectPath(filePath, "sandbox:readFile");
    if (!fs.existsSync(resolved)) {
      throw new Error(`file not found: ${resolved}`);
    }
    const content = fs.readFileSync(resolved, "utf8");
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    return { content, hash, path: resolved };
  });
  ipcMain.handle("sandbox:writeFile", async (_event, filePath, data) => {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("sandbox:writeFile requires a filePath");
    }
    const resolved = projectRootScope.resolveOpenedProjectPath(filePath, "sandbox:writeFile");
    const dir = path2.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolved, data, "utf8");
    const hash = crypto.createHash("sha256").update(data).digest("hex");
    return { written: true, path: resolved, hash };
  });
  ipcMain.handle("sandbox:copyFile", async (_event, sourcePath, destinationPath) => {
    if (!sourcePath || typeof sourcePath !== "string") {
      throw new Error("sandbox:copyFile requires a sourcePath");
    }
    if (!destinationPath || typeof destinationPath !== "string") {
      throw new Error("sandbox:copyFile requires a destinationPath");
    }
    const source = projectRootScope.resolveOpenedProjectPath(sourcePath, "sandbox:copyFile source");
    const destination = projectRootScope.resolveOpenedProjectPath(destinationPath, "sandbox:copyFile destination");
    if (!fs.existsSync(source)) {
      throw new Error(`file not found: ${source}`);
    }
    fs.mkdirSync(path2.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    const bytes = fs.readFileSync(destination);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    return {
      copied: true,
      sourcePath: source,
      path: destination,
      hash,
      size: bytes.length
    };
  });
  ipcMain.handle("sandbox:spawn", async (_event, command, args) => {
    if (!command || typeof command !== "string") {
      throw new Error("sandbox:spawn requires a command");
    }
    if (!spawnAllowed(command, args || [])) {
      return {
        exitCode: null,
        stdout: "",
        stderr: "sandbox:spawn is limited to local runtime version checks."
      };
    }
    return new Promise((resolve, reject) => {
      const child = spawn(command, args || [], { stdio: "pipe", cwd: appRoot });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d) => {
        stdout += d.toString();
      });
      child.stderr?.on("data", (d) => {
        stderr += d.toString();
      });
      child.on("close", (code) => {
        resolve({ exitCode: code, stdout, stderr });
      });
      child.on("error", reject);
    });
  });
}
async function waitForRuntimeStatus(runtimeApiBaseUrl2) {
  const statusUrl = `${runtimeApiBaseUrl2.replace(/\/+$/, "")}/api/runtime/status`;
  const startedAt = Date.now();
  let lastError = "";
  while (Date.now() - startedAt < 15e3) {
    try {
      const response = await fetch(statusUrl, { signal: AbortSignal.timeout(5e3) });
      if (response.ok) {
        const payload = await response.json();
        if (payload && typeof payload === "object" && payload.ok === true) return payload;
        lastError = "status payload was not ready";
      } else {
        lastError = `HTTP ${response.status}`;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(250);
  }
  throw new Error(`runtime status did not become ready: ${lastError}`);
}
async function runPackagedSmoke(win, runtimeApiBaseUrl2) {
  try {
    const runtimeStatus = runtimeApiBaseUrl2 ? await waitForRuntimeStatus(runtimeApiBaseUrl2) : void 0;
    let renderer;
    const startedAt = Date.now();
    while (Date.now() - startedAt < 15e3) {
      renderer = await win.webContents.executeJavaScript(`
        (() => ({
          title: document.title,
          rootPresent: Boolean(document.querySelector("#root")),
          bodyLength: document.body?.innerText?.length || 0,
          bodyTextSample: (document.body?.innerText || "").slice(0, 240),
          hasBridge: Boolean(window.vibeRuntime),
          bridgeRuntimeApiBaseUrl: window.vibeRuntime?.runtimeApiBaseUrl?.() || "",
          exposedRuntimeApiBaseUrl: window.__VIBE_RUNTIME_API_BASE_URL__ || ""
        }))()
      `);
      if (typeof renderer.bodyTextSample === "string" && renderer.bodyTextSample.includes("\u672C\u5730\u521B\u4F5C\u53F0")) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    console.log(`${smokeMarker}${JSON.stringify({
      ok: true,
      packaged: app.isPackaged,
      runtimeStatus: runtimeStatus ? {
        providerCalled: runtimeStatus.providerCalled,
        liveSubmitAllowed: runtimeStatus.liveSubmitAllowed
      } : void 0,
      renderer
    })}`);
    app.exit(0);
  } catch (error) {
    console.error(`${smokeMarker}${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    })}`);
    app.exit(1);
  }
}
async function createWindow(runtimeApiBaseUrl2) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: !smokeMode,
    title: "Vibe Director Studio",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      additionalArguments: runtimeApiBaseUrl2 ? [`--vibe-runtime-api-base-url=${runtimeApiBaseUrl2}`] : []
    }
  });
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "content-security-policy": [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http://127.0.0.1:*; connect-src 'self' http://127.0.0.1:*"
        ]
      }
    });
  });
  if (isDev) {
    await win.loadURL(devUrl);
    if (!smokeMode) win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(path2.join(appRoot, "dist", "index.html"));
  }
  if (smokeMode) await runPackagedSmoke(win, runtimeApiBaseUrl2);
  return win;
}
app.whenReady().then(async () => {
  registerIpcHandlers();
  await createWindow();
}).catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  app.exit(1);
});
app.on("will-quit", () => {
  closeSandboxWatchers();
  runtimeServer?.kill();
});
app.on("window-all-closed", () => {
  app.quit();
});
