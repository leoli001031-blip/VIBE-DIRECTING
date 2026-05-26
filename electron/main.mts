import * as electron from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import crypto from "node:crypto";
import net from "node:net";
import { createProjectRootScope, spawnAllowed } from "./projectScope.mts";

const { app, BrowserWindow, dialog, ipcMain } = electron;
app.setName("Vibe Director Studio");
if (process.platform === "darwin") {
  // Local-first app: avoid Chromium touching macOS keychain storage during normal use.
  app.commandLine.appendSwitch("use-mock-keychain");
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function readEnv(primaryName: string, legacyName?: string): string | undefined {
  return process.env[primaryName] || (legacyName ? process.env[legacyName] : undefined);
}

function findWorkspaceRootNear(startPath: string | undefined) {
  if (!startPath) return undefined;
  let cursor = path.resolve(startPath);
  if (fs.existsSync(cursor) && !fs.statSync(cursor).isDirectory()) cursor = path.dirname(cursor);
  for (let depth = 0; depth < 10; depth += 1) {
    if (
      fs.existsSync(path.join(cursor, "package.json")) &&
      fs.existsSync(path.join(cursor, ".vibe-runtime"))
    ) {
      return cursor;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return undefined;
}

const appRoot = process.env.VIBE_ELECTRON_APP_ROOT
  ? path.resolve(process.env.VIBE_ELECTRON_APP_ROOT)
  : path.join(__dirname, "..");
const preloadPath = process.env.VIBE_ELECTRON_PRELOAD
  ? path.resolve(process.env.VIBE_ELECTRON_PRELOAD)
  : fs.existsSync(path.join(__dirname, "preload.cjs"))
    ? path.join(__dirname, "preload.cjs")
    : path.join(__dirname, "preload.mts");
const devUrl = process.env.VIBE_ELECTRON_DEV_URL || "http://127.0.0.1:5174";
const isDev = !app.isPackaged;
const openDevToolsInDev = process.env.VIBE_ELECTRON_OPEN_DEVTOOLS === "1";
const runtimeHost = readEnv("VIBE_DIRECTOR_RUNTIME_API_HOST", "VIBE_CORE_RUNTIME_API_HOST") || "127.0.0.1";
const smokeMode = process.env.VIBE_ELECTRON_SMOKE === "1";
const smokeMarker = "__VIBE_ELECTRON_PACKAGED_GUI_SMOKE__";

let runtimeServer: ChildProcess | null = null;
let runtimeApiBaseUrl: string | undefined;
let runtimeServerStarting: Promise<string | undefined> | null = null;
const projectRootScope = createProjectRootScope();
const sandboxWatchers = new Map<string, ReturnType<typeof fs.watch>>();
const rootToWatchers = new Map<string, Set<string>>();
let sandboxWatchCounter = 0;

function closeSandboxWatcher(watchId: string) {
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

function canListenOnPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, runtimeHost);
  });
}

function sleep(ms: number) {
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

function projectVibeCandidates(projectRoot: string) {
  return [
    path.join(projectRoot, "project.vibe"),
    path.join(projectRoot, "project", "project.vibe"),
    path.join(projectRoot, "project", "project.vibe.json"),
  ];
}

function projectVibePathForRoot(projectRoot: string) {
  return projectVibeCandidates(projectRoot).find((candidate) => fs.existsSync(candidate))
    || path.join(projectRoot, "project.vibe");
}

function projectPathRelativeToRoot(projectRoot: string, filePath: string) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/") || "project.vibe";
}

function defaultProjectsRoot() {
  const configuredProjectsRoot = readEnv("VIBE_DIRECTOR_PROJECTS_ROOT");
  return configuredProjectsRoot
    ? path.resolve(configuredProjectsRoot)
    : isDev
      ? path.join(appRoot, ".vibe-runtime", "projects")
      : path.join(app.getPath("documents"), "Vibe Director Studio Projects");
}

function rememberedProjectSelectionPath() {
  return path.join(app.getPath("userData"), "last-project.json");
}

function writeRememberedProjectSelection(projectRoot: string) {
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(rememberedProjectSelectionPath(), JSON.stringify({ projectRoot: path.resolve(projectRoot) }), "utf8");
  } catch {
    // Best-effort restore helper only; sandbox selection still succeeds without it.
  }
}

function clearRememberedProjectSelection(projectRoot?: string) {
  try {
    const filePath = rememberedProjectSelectionPath();
    if (projectRoot && fs.existsSync(filePath)) {
      const record = JSON.parse(fs.readFileSync(filePath, "utf8")) as { projectRoot?: string };
      if (record.projectRoot && path.resolve(record.projectRoot) !== path.resolve(projectRoot)) return;
    }
    fs.rmSync(filePath, { force: true });
  } catch {
    // Best-effort restore helper only.
  }
}

function restoreRememberedProjectRootScope() {
  try {
    const filePath = rememberedProjectSelectionPath();
    if (!fs.existsSync(filePath)) return;
    const record = JSON.parse(fs.readFileSync(filePath, "utf8")) as { projectRoot?: string };
    if (!record.projectRoot) return;
    const resolved = path.resolve(record.projectRoot);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      projectRootScope.rememberProjectRoot(resolved);
      return;
    }
    clearRememberedProjectSelection(resolved);
  } catch {
    clearRememberedProjectSelection();
  }
}

function selectionForProjectRoot(projectRoot: string, displayName?: string) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  projectRootScope.rememberProjectRoot(resolvedProjectRoot);
  writeRememberedProjectSelection(resolvedProjectRoot);
  const projectVibePath = projectVibePathForRoot(resolvedProjectRoot);
  return {
    cancelled: false,
    projectRoot: resolvedProjectRoot,
    projectPath: projectPathRelativeToRoot(resolvedProjectRoot, projectVibePath),
    projectVibePath,
    hasProjectVibe: fs.existsSync(projectVibePath),
    displayName: displayName || path.basename(resolvedProjectRoot) || "未命名项目",
  };
}

async function startRuntimeServer() {
  if (runtimeServer && runtimeApiBaseUrl) return runtimeApiBaseUrl;
  const packagedResourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const packagedWorkspaceRoot = app.isPackaged
    ? findWorkspaceRootNear(packagedResourcesPath || app.getAppPath())
    : undefined;
  const runtimeWorkdir = readEnv("VIBE_DIRECTOR_RUNTIME_WORKDIR", "VIBE_CORE_RUNTIME_WORKDIR")
    || (isDev ? appRoot : packagedWorkspaceRoot || app.getPath("userData"));
  const unpackedServerScript = path.join(
    packagedResourcesPath || path.dirname(appRoot),
    "app.asar.unpacked",
    "electron-runtime",
    "local-runtime-api-server.mjs",
  );
  const serverScript = app.isPackaged && fs.existsSync(unpackedServerScript)
    ? unpackedServerScript
    : path.join(appRoot, "electron-runtime", "local-runtime-api-server.mjs");
  if (!fs.existsSync(serverScript)) {
    console.warn(`Runtime API server skipped; bundled server script is missing: ${serverScript}`);
    return undefined;
  }
  const runtimePort = await chooseRuntimePort();
  const currentProjectBindingPath =
    readEnv("VIBE_DIRECTOR_CURRENT_PROJECT_BINDING_PATH", "VIBE_CORE_CURRENT_PROJECT_BINDING_PATH") ||
    path.join(app.getPath("userData"), "current-project.local.json");
  const rememberedProjectPath = rememberedProjectSelectionPath();
  const allowedProjectRoots = projectRootScope.roots().join(",");
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
        VIBE_DIRECTOR_REMEMBERED_PROJECT_SELECTION_PATH: rememberedProjectPath,
        VIBE_DIRECTOR_ALLOWED_PROJECT_ROOTS: allowedProjectRoots,
        // Compatibility for historical runtime scripts; new code should read VIBE_DIRECTOR_* first.
        VIBE_CORE_RUNTIME_API_HOST: runtimeHost,
        VIBE_CORE_RUNTIME_API_PORT: String(runtimePort),
        VIBE_CORE_RUNTIME_WORKDIR: runtimeWorkdir,
        VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: currentProjectBindingPath,
        VIBE_CORE_REMEMBERED_PROJECT_SELECTION_PATH: rememberedProjectPath,
        VIBE_CORE_ALLOWED_PROJECT_ROOTS: allowedProjectRoots,
      },
    });
  } catch (error) {
    console.error(`Runtime API server failed to start: ${error instanceof Error ? error.message : String(error)}`);
    runtimeServer = null;
    return undefined;
  }
  runtimeServer.stdout?.on("data", (data: Buffer) => {
    process.stdout.write(`[runtime] ${data}`);
  });
  runtimeServer.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(`[runtime] ${data}`);
  });
  runtimeServer.on("error", (error) => {
    console.error(`Runtime API server error: ${error instanceof Error ? error.message : String(error)}`);
  });
  runtimeServer.on("close", (code) => {
    runtimeServer = null;
    runtimeApiBaseUrl = undefined;
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
      title: "打开项目",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) {
      return { cancelled: true };
    }

    return selectionForProjectRoot(result.filePaths[0]);
  });

  ipcMain.handle("project:createLocal", async (_event, input?: { displayName?: string }) => {
    const projectsRoot = defaultProjectsRoot();
    fs.mkdirSync(projectsRoot, { recursive: true });
    const result = await dialog.showOpenDialog({
      title: "新建项目",
      message: "选择或新建一个文件夹作为这个视频项目。",
      buttonLabel: "使用这个文件夹",
      defaultPath: projectsRoot,
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) {
      return { cancelled: true };
    }

    return selectionForProjectRoot(result.filePaths[0], path.basename(result.filePaths[0]) || input?.displayName || "未命名项目");
  });

  ipcMain.handle("project:remember", async (_event, projectRoot: string) => {
    if (!projectRoot || typeof projectRoot !== "string") {
      return { cancelled: true };
    }
    const resolved = path.resolve(projectRoot);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return { cancelled: true };
    }
    return selectionForProjectRoot(resolved);
  });

  ipcMain.handle("project:forget", async (_event, projectRoot: string) => {
    if (!projectRoot || typeof projectRoot !== "string") {
      throw new Error("project:forget requires a projectRoot");
    }
    const resolved = path.resolve(projectRoot);
    const existed = projectRootScope.forgetProjectRoot(resolved);
    clearRememberedProjectSelection(resolved);
    const watchers = rootToWatchers.get(resolved);
    if (watchers) {
      for (const watchId of watchers) {
        closeSandboxWatcher(watchId);
      }
      rootToWatchers.delete(resolved);
    }
    return { forgotten: existed };
  });

  ipcMain.handle("sandbox:watch", async (_event, watchDir: string) => {
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
        set = new Set();
        rootToWatchers.set(root, set);
      }
      set.add(watchId);
    }
    return {
      watching: true,
      dir: resolved,
      watchId,
    };
  });

  ipcMain.handle("sandbox:unwatch", async (_event, watchId: string) => {
    if (!watchId || typeof watchId !== "string") {
      throw new Error("sandbox:unwatch requires a watchId");
    }
    return { unwatched: closeSandboxWatcher(watchId), watchId };
  });

  ipcMain.handle("sandbox:fileExists", async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("sandbox:fileExists requires a filePath");
    }
    const resolved = projectRootScope.resolveOpenedProjectPath(filePath, "sandbox:fileExists");
    return { exists: fs.existsSync(resolved), path: resolved };
  });

  ipcMain.handle("sandbox:readFile", async (_event, filePath: string) => {
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

  ipcMain.handle("sandbox:writeFile", async (_event, filePath: string, data: string) => {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("sandbox:writeFile requires a filePath");
    }
    const resolved = projectRootScope.resolveOpenedProjectPath(filePath, "sandbox:writeFile");
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolved, data, "utf8");
    const hash = crypto.createHash("sha256").update(data).digest("hex");
    return { written: true, path: resolved, hash };
  });

  ipcMain.handle("sandbox:copyFile", async (_event, sourcePath: string, destinationPath: string) => {
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
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    const bytes = fs.readFileSync(destination);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    return {
      copied: true,
      sourcePath: source,
      path: destination,
      hash,
      size: bytes.length,
    };
  });

  ipcMain.handle("sandbox:spawn", async (_event, command: string, args: string[]) => {
    if (!command || typeof command !== "string") {
      throw new Error("sandbox:spawn requires a command");
    }
    if (!spawnAllowed(command, args || [])) {
      return {
        exitCode: null,
        stdout: "",
        stderr: "sandbox:spawn is limited to local runtime version checks.",
      };
    }
    return new Promise((resolve, reject) => {
      const child = spawn(command, args || [], { stdio: "pipe", cwd: appRoot });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
      child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
      child.on("close", (code) => {
        resolve({ exitCode: code, stdout, stderr });
      });
      child.on("error", reject);
    });
  });
}

async function waitForRuntimeStatus(runtimeApiBaseUrl: string) {
  const statusUrl = `${runtimeApiBaseUrl.replace(/\/+$/, "")}/api/runtime/status`;
  const startedAt = Date.now();
  let lastError = "";
  while (Date.now() - startedAt < 15000) {
    try {
      const response = await fetch(statusUrl, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const payload = await response.json();
        if (payload && typeof payload === "object" && (payload as { ok?: unknown }).ok === true) return payload;
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

async function runPackagedSmoke(win: electron.BrowserWindow, runtimeApiBaseUrl?: string) {
  try {
    const runtimeStatus = runtimeApiBaseUrl ? await waitForRuntimeStatus(runtimeApiBaseUrl) : undefined;
    let renderer: Record<string, unknown> | undefined;
    const startedAt = Date.now();
    while (Date.now() - startedAt < 15000) {
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
      if (typeof renderer.bodyTextSample === "string" && renderer.bodyTextSample.includes("本地创作台")) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    console.log(`${smokeMarker}${JSON.stringify({
      ok: true,
      packaged: app.isPackaged,
      runtimeStatus: runtimeStatus
        ? {
            providerCalled: runtimeStatus.providerCalled,
            liveSubmitAllowed: runtimeStatus.liveSubmitAllowed,
          }
        : undefined,
      renderer,
    })}`);
    app.exit(0);
  } catch (error) {
    console.error(`${smokeMarker}${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })}`);
    app.exit(1);
  }
}

async function createWindow(runtimeApiBaseUrl?: string) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: !smokeMode,
    title: "Vibe Director Studio",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      additionalArguments: runtimeApiBaseUrl ? [`--vibe-runtime-api-base-url=${runtimeApiBaseUrl}`] : [],
    },
  });

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev
      ? "default-src 'self' http://127.0.0.1:*; script-src 'self' 'unsafe-inline' http://127.0.0.1:*; style-src 'self' 'unsafe-inline' http://127.0.0.1:*; img-src 'self' data: blob: http://127.0.0.1:*; media-src 'self' data: blob: http://127.0.0.1:*; connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*; worker-src 'self' blob:"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http://127.0.0.1:*; media-src 'self' data: blob: http://127.0.0.1:*; connect-src 'self' http://127.0.0.1:*";
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "content-security-policy": [
          csp,
        ],
      },
    });
  });

  if (isDev) {
    await win.loadURL(devUrl);
    if (!smokeMode && openDevToolsInDev) win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(path.join(appRoot, "dist", "index.html"));
  }

  if (smokeMode) await runPackagedSmoke(win, runtimeApiBaseUrl);
  return win;
}

app.whenReady().then(async () => {
  restoreRememberedProjectRootScope();
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
