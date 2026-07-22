import * as electron from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import crypto from "node:crypto";
import net from "node:net";
import { createProjectRootScope, spawnAllowed } from "./projectScope.mts";
import { createRuntimeSessionToken } from "./runtimeSessionToken.mts";
import { isSafeExternalUrl, isTrustedDocumentUrl, isTrustedRendererSender, runtimeLoopbackHost } from "./securityPolicy.mts";
import { exportDiagnosticBundle } from "./diagnosticBundle.mts";
import { createBrowserDraftProfileStore, type BrowserDraftRecoveryPointerKind } from "./browserDraftProfileStore.mts";

const { app, BrowserWindow, dialog, ipcMain, shell } = electron;
app.setName("Vibe Director Studio");
const explicitUserDataDirArg = process.argv.find((arg) => arg.startsWith("--user-data-dir="));
const explicitUserDataDir = (process.env.VIBE_DIRECTOR_USER_DATA_DIR || process.env.VIBE_CORE_USER_DATA_DIR || explicitUserDataDirArg?.split("=").slice(1).join("="))?.trim();
if (explicitUserDataDir) {
  app.setPath("userData", path.resolve(explicitUserDataDir));
}
const browserDraftProfileStore = createBrowserDraftProfileStore({ userDataRoot: app.getPath("userData") });
if (process.platform === "darwin") {
  // Local-first app: avoid Chromium touching macOS keychain storage during normal use.
  app.commandLine.appendSwitch("use-mock-keychain");
}
const packagedAcceptanceControlPort = Number(process.env.VIBE_ELECTRON_ACCEPTANCE_CONTROL_PORT || "");
const packagedAcceptanceControlToken = (process.env.VIBE_ELECTRON_ACCEPTANCE_CONTROL_TOKEN || "").trim();
const packagedAcceptanceControlEnabled = app.isPackaged
  && process.env.VIBE_ELECTRON_PACKAGED_ACCEPTANCE === "1"
  && Number.isInteger(packagedAcceptanceControlPort)
  && packagedAcceptanceControlPort >= 1024
  && packagedAcceptanceControlPort <= 65535
  && packagedAcceptanceControlToken.length >= 32;
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
const runtimeHost = runtimeLoopbackHost(readEnv("VIBE_DIRECTOR_RUNTIME_API_HOST", "VIBE_CORE_RUNTIME_API_HOST"));
const smokeMode = process.env.VIBE_ELECTRON_SMOKE === "1";
const smokeMarker = "__VIBE_ELECTRON_PACKAGED_GUI_SMOKE__";
const runtimeSessionToken = createRuntimeSessionToken();

let runtimeServer: ChildProcess | null = null;
let runtimeApiBaseUrl: string | undefined;
let runtimeServerStarting: Promise<string | undefined> | null = null;
let packagedAcceptanceControlServer: net.Server | null = null;
let trustedRendererWebContentsId: number | undefined;
const projectRootScope = createProjectRootScope();
const sandboxWatchers = new Map<string, ReturnType<typeof fs.watch>>();
const rootToWatchers = new Map<string, Set<string>>();
let sandboxWatchCounter = 0;
const runtimeDiagnosticLines: string[] = [];
const recentDiagnosticErrors: string[] = [];

function appendDiagnosticLines(target: string[], value: unknown, limit: number) {
  for (const line of String(value ?? "").split(/\r?\n/).filter(Boolean)) target.push(line);
  if (target.length > limit) target.splice(0, target.length - limit);
}

type PackagedAcceptanceExportFault = "write_enospc" | "publish_enospc";

function packagedAcceptanceExportFault(): PackagedAcceptanceExportFault | undefined {
  if (!packagedAcceptanceControlEnabled) return undefined;
  const value = process.env.VIBE_ELECTRON_ACCEPTANCE_EXPORT_FAULT;
  return value === "write_enospc" || value === "publish_enospc" ? value : undefined;
}

function packagedAcceptanceExportPublishDelayMs(): number {
  if (!packagedAcceptanceControlEnabled) return 0;
  const value = Number(process.env.VIBE_ELECTRON_ACCEPTANCE_EXPORT_PUBLISH_DELAY_MS || "0");
  return Number.isFinite(value) ? Math.max(0, Math.min(30_000, Math.floor(value))) : 0;
}

function isStagedExportPath(filePath: string): boolean {
  const projectRoot = projectRootScope.findRoot(filePath);
  if (!projectRoot) return false;
  const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, "/");
  return relativePath.startsWith("exports/.vibe-staging/")
    || relativePath.startsWith("reports/exports/.vibe-staging/");
}

function throwPackagedAcceptanceDiskFull(): never {
  const error = new Error("packaged acceptance simulated disk write failure");
  Object.assign(error, { code: "ENOSPC" });
  throw error;
}

async function applyPackagedAcceptanceExportWriteFault(filePath: string): Promise<void> {
  if (packagedAcceptanceExportFault() === "write_enospc" && isStagedExportPath(filePath)) {
    throwPackagedAcceptanceDiskFull();
  }
}

async function applyPackagedAcceptanceExportPublishFault(stagingPath: string): Promise<void> {
  if (!isStagedExportPath(stagingPath)) return;
  const delayMs = packagedAcceptanceExportPublishDelayMs();
  if (delayMs > 0) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
  }
  if (packagedAcceptanceExportFault() === "publish_enospc") {
    throwPackagedAcceptanceDiskFull();
  }
}

function sha256File(filePath: string): Promise<{ hash: string; size: number }> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    let size = 0;
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => {
      size += chunk.length;
      hash.update(chunk);
    });
    stream.on("error", reject);
    stream.on("end", () => {
      resolve({ hash: hash.digest("hex"), size });
    });
  });
}

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

function currentProjectBindingPath() {
  return readEnv("VIBE_DIRECTOR_CURRENT_PROJECT_BINDING_PATH", "VIBE_CORE_CURRENT_PROJECT_BINDING_PATH") ||
    path.join(app.getPath("userData"), "current-project.local.json");
}

function isTransientBrowserProjectRoot(projectRoot: string) {
  const normalized = projectRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  return normalized === ".vibe-runtime/browser-projects"
    || normalized.startsWith(".vibe-runtime/browser-projects/")
    || normalized.includes("/.vibe-runtime/browser-projects/");
}

function writeRememberedProjectSelection(projectRoot: string) {
  try {
    if (isTransientBrowserProjectRoot(projectRoot)) return;
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
    if (isTransientBrowserProjectRoot(resolved)) {
      clearRememberedProjectSelection(resolved);
      return;
    }
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      projectRootScope.rememberProjectRoot(resolved);
      return;
    }
    clearRememberedProjectSelection(resolved);
  } catch {
    clearRememberedProjectSelection();
  }
}

function projectSelection(resolvedProjectRoot: string, displayName?: string) {
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

function selectionForProjectRoot(projectRoot: string, displayName?: string) {
  const resolvedProjectRoot = projectRootScope.rememberProjectRoot(projectRoot);
  writeRememberedProjectSelection(resolvedProjectRoot);
  return projectSelection(resolvedProjectRoot, displayName);
}

function selectionForAuthorizedProjectRoot(projectRoot: string) {
  const resolvedProjectRoot = projectRootScope.resolveAuthorizedProjectRoot(projectRoot, "project:remember");
  writeRememberedProjectSelection(resolvedProjectRoot);
  return projectSelection(resolvedProjectRoot);
}

function currentProjectBindingForRenderer() {
  try {
    const bindingPath = currentProjectBindingPath();
    if (!fs.existsSync(bindingPath)) return undefined;
    const binding = JSON.parse(fs.readFileSync(bindingPath, "utf8")) as {
      projectRoot?: string;
      projectRootRelativePath?: string;
      projectVibeRelativePath?: string;
      projectId?: string;
      displayName?: string;
    };
    if (!binding.projectRoot) return undefined;
    const projectRoot = path.resolve(binding.projectRoot);
    if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) return undefined;
    projectRootScope.rememberProjectRoot(projectRoot);
    const projectVibePath = binding.projectVibeRelativePath || projectVibePathForRoot(projectRoot);
    return {
      ok: true,
      status: "bound",
      currentProject: {
        bound: true,
        binding,
        bindingPath,
        projectRoot,
        projectRootRelativePath: binding.projectRootRelativePath || projectRoot,
        projectVibeRelativePath: projectVibePath,
        project: {
          title: binding.displayName || path.basename(projectRoot) || "未命名项目",
          projectId: binding.projectId,
          projectRoot,
          projectVibePath,
        },
      },
    };
  } catch {
    return undefined;
  }
}

function currentProjectBindingBootstrapArg() {
  const payload = currentProjectBindingForRenderer();
  const binding = payload?.currentProject?.binding;
  if (!binding) return undefined;
  return `--vibe-current-project-binding=${encodeURIComponent(JSON.stringify(binding))}`;
}

function browserDraftBootstrapArg() {
  const payload = browserDraftProfileStore.bootstrap();
  if (!payload.activeStorageKey && !payload.pendingIntakeStorageKey) return undefined;
  return `--vibe-browser-draft-bootstrap=${encodeURIComponent(JSON.stringify(payload))}`;
}

function safeProjectFolderName(displayName?: string) {
  return (displayName || "新视频项目")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48)
    || "新视频项目";
}

function uniqueChildProjectRoot(parentRoot: string, displayName?: string) {
  const baseName = safeProjectFolderName(displayName);
  const baseCandidate = path.join(parentRoot, baseName);
  if (!fs.existsSync(baseCandidate)) return baseCandidate;
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return path.join(parentRoot, `${baseName}-${stamp}`);
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
  const runtimeCurrentProjectBindingPath = currentProjectBindingPath();
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
        VIBE_DIRECTOR_RUNTIME_PARENT_PID: String(process.pid),
        VIBE_DIRECTOR_RUNTIME_API_TOKEN: runtimeSessionToken,
        VIBE_DIRECTOR_CURRENT_PROJECT_BINDING_PATH: runtimeCurrentProjectBindingPath,
        VIBE_DIRECTOR_REMEMBERED_PROJECT_SELECTION_PATH: rememberedProjectPath,
        VIBE_DIRECTOR_ALLOWED_PROJECT_ROOTS: allowedProjectRoots,
        // Compatibility for historical runtime scripts; new code should read VIBE_DIRECTOR_* first.
        VIBE_CORE_RUNTIME_API_HOST: runtimeHost,
        VIBE_CORE_RUNTIME_API_PORT: String(runtimePort),
        VIBE_CORE_RUNTIME_WORKDIR: runtimeWorkdir,
        VIBE_CORE_RUNTIME_API_TOKEN: runtimeSessionToken,
        VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: runtimeCurrentProjectBindingPath,
        VIBE_CORE_REMEMBERED_PROJECT_SELECTION_PATH: rememberedProjectPath,
        VIBE_CORE_ALLOWED_PROJECT_ROOTS: allowedProjectRoots,
      },
    });
  } catch (error) {
    const message = `Runtime API server failed to start: ${error instanceof Error ? error.message : String(error)}`;
    appendDiagnosticLines(recentDiagnosticErrors, message, 40);
    console.error(message);
    runtimeServer = null;
    return undefined;
  }
  runtimeServer.stdout?.on("data", (data: Buffer) => {
    appendDiagnosticLines(runtimeDiagnosticLines, `[runtime:stdout] ${data}`, 500);
    process.stdout.write(`[runtime] ${data}`);
  });
  runtimeServer.stderr?.on("data", (data: Buffer) => {
    appendDiagnosticLines(runtimeDiagnosticLines, `[runtime:stderr] ${data}`, 500);
    appendDiagnosticLines(recentDiagnosticErrors, data, 40);
    process.stderr.write(`[runtime] ${data}`);
  });
  runtimeServer.on("error", (error) => {
    const message = `Runtime API server error: ${error instanceof Error ? error.message : String(error)}`;
    appendDiagnosticLines(recentDiagnosticErrors, message, 40);
    console.error(message);
  });
  runtimeServer.on("close", (code) => {
    runtimeServer = null;
    runtimeApiBaseUrl = undefined;
    if (code !== 0 && code !== null) {
      const message = `Runtime API server exited with code ${code}`;
      appendDiagnosticLines(recentDiagnosticErrors, message, 40);
      console.error(message);
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

async function stopRuntimeServer() {
  const child = runtimeServer;
  runtimeServer = null;
  runtimeApiBaseUrl = undefined;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolveStop) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolveStop();
    };
    child.once("exit", finish);
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      finish();
    }, 1000).unref();
  });
}

async function startPackagedAcceptanceControl(win: electron.BrowserWindow) {
  if (!packagedAcceptanceControlEnabled || packagedAcceptanceControlServer) return;
  const server = net.createServer((socket) => {
    let buffer = "";
    const respond = (payload: Record<string, unknown>) => socket.write(`${JSON.stringify(payload)}\n`);
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      if (buffer.length > 1_000_000) {
        socket.destroy();
        return;
      }
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        void (async () => {
          let request: { id?: number; token?: string; method?: string; expression?: string; width?: number; height?: number; x?: number; y?: number };
          try {
            request = JSON.parse(line);
          } catch {
            respond({ ok: false, error: "invalid_json" });
            return;
          }
          const id = Number(request.id);
          if (!Number.isInteger(id) || request.token !== packagedAcceptanceControlToken) {
            respond({ id, ok: false, error: "unauthorized" });
            return;
          }
          try {
            if (request.method === "evaluate" && typeof request.expression === "string") {
              const value = await win.webContents.executeJavaScript(request.expression, true);
              respond({ id, ok: true, value: value === undefined ? null : value });
              return;
            }
            if (request.method === "set_bounds") {
              const width = Number(request.width);
              const height = Number(request.height);
              if (!Number.isInteger(width) || !Number.isInteger(height) || width < 760 || width > 2400 || height < 600 || height > 1600) {
                respond({ id, ok: false, error: "invalid_bounds" });
                return;
              }
              win.setContentSize(width, height);
              respond({ id, ok: true, value: win.getContentBounds() });
              return;
            }
            if (request.method === "capture_page") {
              const image = await win.webContents.capturePage();
              respond({ id, ok: true, value: image.toPNG().toString("base64") });
              return;
            }
            if (request.method === "click_at") {
              const x = Number(request.x);
              const y = Number(request.y);
              const [width, height] = win.getContentSize();
              if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
                respond({ id, ok: false, error: "invalid_click_coordinates" });
                return;
              }
              win.show();
              win.focus();
              win.webContents.focus();
              win.webContents.sendInputEvent({ type: "mouseMove", x, y });
              win.webContents.sendInputEvent({ type: "mouseDown", x, y, button: "left", clickCount: 1 });
              win.webContents.sendInputEvent({ type: "mouseUp", x, y, button: "left", clickCount: 1 });
              respond({ id, ok: true, value: { x, y } });
              return;
            }
            if (request.method === "close") {
              respond({ id, ok: true, value: true });
              setTimeout(() => app.quit(), 0);
              return;
            }
            respond({ id, ok: false, error: "unsupported_method" });
          } catch (error) {
            respond({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
          }
        })();
      }
    });
  });
  packagedAcceptanceControlServer = server;
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(packagedAcceptanceControlPort, "127.0.0.1", () => resolveListen());
  }).catch((error) => {
    packagedAcceptanceControlServer = null;
    server.close();
    throw error;
  });
}

function trustedRendererDocumentUrl() {
  return isDev ? devUrl : pathToFileURL(path.join(appRoot, "dist", "index.html")).href;
}

function assertTrustedIpcSender(event: electron.IpcMainInvokeEvent, channel: string) {
  const senderFrame = event.senderFrame;
  const webContentsId = trustedRendererWebContentsId;
  if (
    webContentsId === undefined
    || !senderFrame
    || !isTrustedRendererSender({
      webContentsId: event.sender.id,
      frameUrl: senderFrame.url,
      isMainFrame: event.senderFrame === event.sender.mainFrame,
    }, {
      webContentsId,
      documentUrl: trustedRendererDocumentUrl(),
    })
  ) {
    throw new Error(`Blocked untrusted IPC sender for ${channel}.`);
  }
}

function handleTrustedIpc<Args extends unknown[], Result>(
  channel: string,
  listener: (event: electron.IpcMainInvokeEvent, ...args: Args) => Result | Promise<Result>,
) {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedIpcSender(event, channel);
    return listener(event, ...(args as Args));
  });
}

function registerIpcHandlers() {
  handleTrustedIpc("runtime:ensureStarted", async () => {
    const baseUrl = await ensureRuntimeServer();
    return {
      baseUrl: baseUrl || "",
      token: baseUrl ? runtimeSessionToken : "",
    };
  });

  handleTrustedIpc("project:currentBinding", async () => {
    return currentProjectBindingForRenderer();
  });

  handleTrustedIpc("project:chooseRoot", async () => {
    const result = await dialog.showOpenDialog({
      title: "打开项目",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) {
      return { cancelled: true };
    }

    return selectionForProjectRoot(result.filePaths[0]);
  });

  handleTrustedIpc("project:createLocal", async (_event, input?: { displayName?: string }) => {
    const projectsRoot = defaultProjectsRoot();
    fs.mkdirSync(projectsRoot, { recursive: true });
    const displayName = input?.displayName?.trim() || "未命名项目";
    const result = await dialog.showSaveDialog({
      title: "新建项目",
      message: "选择或输入一个文件夹名称作为这个视频项目。",
      buttonLabel: "使用这个文件夹",
      defaultPath: path.join(projectsRoot, safeProjectFolderName(displayName)),
      properties: ["createDirectory", "showOverwriteConfirmation"],
    });
    if (result.canceled || !result.filePath) {
      return { cancelled: true };
    }

    const selectedRoot = path.resolve(result.filePath);
    const resolvedProjectsRoot = path.resolve(projectsRoot);
    const projectRoot = selectedRoot === resolvedProjectsRoot
      ? uniqueChildProjectRoot(resolvedProjectsRoot, displayName)
      : selectedRoot;
    fs.mkdirSync(projectRoot, { recursive: true });
    return selectionForProjectRoot(projectRoot, path.basename(projectRoot) || displayName);
  });

  handleTrustedIpc("project:remember", async (_event, projectRoot: string) => {
    if (!projectRoot || typeof projectRoot !== "string") {
      return { cancelled: true };
    }
    try {
      return selectionForAuthorizedProjectRoot(projectRoot);
    } catch {
      return { cancelled: true };
    }
  });

  handleTrustedIpc("project:forget", async (_event, projectRoot: string) => {
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

  handleTrustedIpc("browserDraft:fileExists", async (_event, input: { storageKey: string; path: string }) => ({
    exists: browserDraftProfileStore.fileExists(input?.storageKey, input?.path),
    path: input?.path,
  }));

  handleTrustedIpc("browserDraft:readFile", async (_event, input: { storageKey: string; path: string }) => (
    browserDraftProfileStore.readFile(input?.storageKey, input?.path)
  ));

  handleTrustedIpc("browserDraft:writeFile", async (_event, input: { storageKey: string; path: string; content: string }) => (
    browserDraftProfileStore.writeFile(input?.storageKey, input?.path, input?.content)
  ));

  handleTrustedIpc("browserDraft:deleteFile", async (_event, input: { storageKey: string; path: string }) => (
    browserDraftProfileStore.deleteFile(input?.storageKey, input?.path)
  ));

  handleTrustedIpc("browserDraft:forget", async (_event, storageKey: string) => (
    browserDraftProfileStore.forget(storageKey)
  ));

  handleTrustedIpc("browserDraft:rememberPointer", async (_event, input: {
    kind: BrowserDraftRecoveryPointerKind;
    storageKey?: string;
  }) => {
    if (input?.kind !== "active_project" && input?.kind !== "pending_intake") {
      throw new Error("Invalid browser draft recovery pointer kind.");
    }
    return browserDraftProfileStore.rememberPointer(input.kind, input.storageKey);
  });

  handleTrustedIpc("diagnostics:export", async () => {
    if (process.platform !== "darwin") {
      throw new Error("Diagnostic ZIP export is currently available in the macOS local Beta.");
    }
    const acceptanceOutput = packagedAcceptanceControlEnabled
      ? (process.env.VIBE_ELECTRON_ACCEPTANCE_DIAGNOSTICS_OUTPUT || "").trim()
      : "";
    let outputPath = "";
    if (acceptanceOutput) {
      const resolved = path.resolve(acceptanceOutput);
      const relativeToTmp = path.relative("/tmp", resolved);
      if (relativeToTmp.startsWith("..") || path.isAbsolute(relativeToTmp) || path.extname(resolved).toLowerCase() !== ".zip") {
        throw new Error("Packaged diagnostic acceptance output must be a .zip under /tmp.");
      }
      outputPath = resolved;
    } else {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const result = await dialog.showSaveDialog({
        title: "导出诊断日志",
        buttonLabel: "导出",
        defaultPath: path.join(app.getPath("downloads"), `Vibe-Director-Diagnostics-${stamp}.zip`),
        filters: [{ name: "ZIP", extensions: ["zip"] }],
        properties: ["showOverwriteConfirmation", "createDirectory"],
      });
      if (result.canceled || !result.filePath) return { cancelled: true };
      outputPath = result.filePath.toLowerCase().endsWith(".zip") ? result.filePath : `${result.filePath}.zip`;
    }
    const binding = currentProjectBindingForRenderer();
    const projectRoot = binding?.currentProject?.projectRoot;
    try {
      const exported = await exportDiagnosticBundle({
        outputPath,
        projectRoot,
        userDataRoot: app.getPath("userData"),
        runtimeRoot: readEnv("VIBE_DIRECTOR_RUNTIME_WORKDIR", "VIBE_CORE_RUNTIME_WORKDIR") || app.getPath("userData"),
        runtimeLogs: runtimeDiagnosticLines,
        recentMainErrors: recentDiagnosticErrors,
        tempRoot: app.getPath("temp"),
        appInfo: {
          name: app.getName(),
          version: app.getVersion(),
          packaged: app.isPackaged,
          platform: process.platform,
          arch: process.arch,
          electron: process.versions.electron || "unknown",
          node: process.versions.node,
        },
      });
      return { cancelled: false, ...exported };
    } catch (error) {
      appendDiagnosticLines(recentDiagnosticErrors, error instanceof Error ? error.message : String(error), 40);
      throw error;
    }
  });

  handleTrustedIpc("sandbox:watch", async (_event, watchDir: string) => {
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

  handleTrustedIpc("sandbox:unwatch", async (_event, watchId: string) => {
    if (!watchId || typeof watchId !== "string") {
      throw new Error("sandbox:unwatch requires a watchId");
    }
    return { unwatched: closeSandboxWatcher(watchId), watchId };
  });

  handleTrustedIpc("sandbox:fileExists", async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("sandbox:fileExists requires a filePath");
    }
    let resolved = "";
    try {
      resolved = projectRootScope.resolveOpenedProjectPath(filePath, "sandbox:fileExists");
    } catch {
      return { exists: false, path: "" };
    }
    return { exists: fs.existsSync(resolved), path: resolved };
  });

  handleTrustedIpc("sandbox:readFile", async (_event, filePath: string) => {
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

  handleTrustedIpc("sandbox:hashFile", async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("sandbox:hashFile requires a filePath");
    }
    const resolved = projectRootScope.resolveOpenedProjectPath(filePath, "sandbox:hashFile");
    if (!fs.existsSync(resolved)) {
      throw new Error(`file not found: ${resolved}`);
    }
    const { hash, size } = await sha256File(resolved);
    return { path: resolved, hash, size };
  });

  handleTrustedIpc("sandbox:writeFile", async (_event, filePath: string, data: string) => {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("sandbox:writeFile requires a filePath");
    }
    const resolved = projectRootScope.resolveOpenedProjectPath(filePath, "sandbox:writeFile");
    await applyPackagedAcceptanceExportWriteFault(resolved);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolved, data, "utf8");
    const hash = crypto.createHash("sha256").update(data).digest("hex");
    return { written: true, path: resolved, hash };
  });

  handleTrustedIpc("sandbox:copyFile", async (_event, sourcePath: string, destinationPath: string) => {
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
    await applyPackagedAcceptanceExportWriteFault(destination);
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    await fs.promises.copyFile(source, destination);
    const { hash, size } = await sha256File(destination);
    return {
      copied: true,
      sourcePath: source,
      path: destination,
      hash,
      size,
    };
  });

  handleTrustedIpc("sandbox:publishDirectory", async (_event, stagingPath: string, destinationPath: string) => {
    if (!stagingPath || typeof stagingPath !== "string") {
      throw new Error("sandbox:publishDirectory requires a stagingPath");
    }
    if (!destinationPath || typeof destinationPath !== "string") {
      throw new Error("sandbox:publishDirectory requires a destinationPath");
    }
    const staging = projectRootScope.resolveOpenedProjectPath(stagingPath, "sandbox:publishDirectory staging");
    const destination = projectRootScope.resolveOpenedProjectPath(destinationPath, "sandbox:publishDirectory destination");
    const projectRoot = projectRootScope.findRoot(staging);
    if (!projectRoot || projectRootScope.findRoot(destination) !== projectRoot) {
      throw new Error("sandbox:publishDirectory paths must use the same opened project folder.");
    }
    const stagingRelative = path.relative(projectRoot, staging).replace(/\\/g, "/");
    const destinationRelative = path.relative(projectRoot, destination).replace(/\\/g, "/");
    const exportBase = stagingRelative.startsWith("exports/.vibe-staging/")
      ? "exports"
      : stagingRelative.startsWith("reports/exports/.vibe-staging/")
        ? "reports/exports"
        : "";
    if (!exportBase || !destinationRelative.startsWith(`${exportBase}/`) || destinationRelative.includes("/.vibe-")) {
      throw new Error("sandbox:publishDirectory is limited to a staged export and its final export directory.");
    }
    const stagingStat = await fs.promises.lstat(staging);
    if (!stagingStat.isDirectory() || stagingStat.isSymbolicLink()) {
      throw new Error("sandbox:publishDirectory stagingPath must be a real directory.");
    }
    if (fs.existsSync(destination)) {
      const destinationStat = await fs.promises.lstat(destination);
      if (!destinationStat.isDirectory() || destinationStat.isSymbolicLink()) {
        throw new Error("sandbox:publishDirectory destinationPath must be a real directory.");
      }
    }
    await applyPackagedAcceptanceExportPublishFault(staging);

    const previousRoot = projectRootScope.resolveOpenedProjectPath(
      path.join(projectRoot, exportBase, ".vibe-previous"),
      "sandbox:publishDirectory previous root",
    );
    await fs.promises.mkdir(previousRoot, { recursive: true });
    const previousPath = projectRootScope.resolveOpenedProjectPath(
      path.join(previousRoot, `${path.basename(destination)}-${Date.now()}-${crypto.randomUUID()}`),
      "sandbox:publishDirectory previous path",
    );
    let previousMoved = false;
    try {
      if (fs.existsSync(destination)) {
        await fs.promises.rename(destination, previousPath);
        previousMoved = true;
      }
      await fs.promises.rename(staging, destination);
    } catch (error) {
      if (previousMoved && !fs.existsSync(destination) && fs.existsSync(previousPath)) {
        await fs.promises.rename(previousPath, destination);
      }
      throw error;
    }
    return {
      published: true,
      stagingPath: staging,
      destinationPath: destination,
      ...(previousMoved ? { previousPath } : {}),
    };
  });

  handleTrustedIpc("sandbox:discardStagedExport", async (_event, stagingPath: string) => {
    if (!stagingPath || typeof stagingPath !== "string") {
      throw new Error("sandbox:discardStagedExport requires a stagingPath");
    }
    const staging = projectRootScope.resolveOpenedProjectPath(stagingPath, "sandbox:discardStagedExport staging");
    const projectRoot = projectRootScope.findRoot(staging);
    if (!projectRoot) {
      throw new Error("sandbox:discardStagedExport requires an opened project folder.");
    }
    const relativePath = path.relative(projectRoot, staging).replace(/\\/g, "/");
    if (!/^(?:exports|reports\/exports)\/\.vibe-staging\/[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(relativePath)) {
      throw new Error("sandbox:discardStagedExport is limited to one bound export staging transaction.");
    }
    if (!fs.existsSync(staging)) return { discarded: false, stagingPath: staging };
    const stagingStat = await fs.promises.lstat(staging);
    if (!stagingStat.isDirectory() || stagingStat.isSymbolicLink()) {
      throw new Error("sandbox:discardStagedExport stagingPath must be a real directory.");
    }
    await fs.promises.rm(staging, { recursive: true, force: false, maxRetries: 3, retryDelay: 50 });
    return { discarded: true, stagingPath: staging };
  });

  handleTrustedIpc("sandbox:spawn", async (_event, command: string, args: string[]) => {
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
      const response = await fetch(statusUrl, {
        headers: { "x-vibe-runtime-token": runtimeSessionToken },
        signal: AbortSignal.timeout(5000),
      });
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

async function runPackagedSmoke(win: electron.BrowserWindow, runtimeStartedBeforeRendererLoad: boolean) {
  try {
    const runtimeAuthProbe = await win.webContents.executeJavaScript(`
      (async () => {
        const tokenPresentBeforeEnsure = Boolean(window.vibeRuntime?.runtimeApiToken?.());
        const baseUrl = await window.vibeRuntime?.ensureRuntimeApiBaseUrl?.() || "";
        const token = window.vibeRuntime?.runtimeApiToken?.() || "";
        const endpoint = baseUrl + "/api/runtime/projects/current/clear";
        const statusEndpoint = baseUrl + "/api/runtime/status";
        const mutationRequest = (tokenValue) => fetch(endpoint, {
          method: "POST",
          headers: tokenValue === undefined ? {} : { "x-vibe-runtime-token": tokenValue }
        }).then((response) => response.status);
        const readRequest = (tokenValue) => fetch(statusEndpoint, {
          headers: tokenValue === undefined ? {} : { "x-vibe-runtime-token": tokenValue }
        }).then((response) => response.status);
        return {
          baseUrl,
          tokenPresentBeforeEnsure,
          tokenPresentAfterEnsure: Boolean(token),
          missingTokenStatus: await mutationRequest(undefined),
          wrongTokenStatus: await mutationRequest("definitely-wrong-runtime-token"),
          correctTokenStatus: await mutationRequest(token),
          missingReadTokenStatus: await readRequest(undefined),
          wrongReadTokenStatus: await readRequest("definitely-wrong-runtime-token"),
          correctReadTokenStatus: await readRequest(token)
        };
      })()
    `);
    const runtimeApiBaseUrl = runtimeAuthProbe?.baseUrl;
    if (typeof runtimeApiBaseUrl !== "string" || !runtimeApiBaseUrl) {
      throw new Error("Packaged renderer did not receive a lazy Runtime API URL.");
    }
    const runtimeStatus = await waitForRuntimeStatus(runtimeApiBaseUrl);
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
      if (typeof renderer.bodyTextSample === "string" && renderer.bodyTextSample.includes("AI 导演")) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    await stopRuntimeServer();
    fs.writeSync(1, `${smokeMarker}${JSON.stringify({
      ok: true,
      packaged: app.isPackaged,
      runtimeStartedBeforeRendererLoad,
      runtimeAuthProbe: {
        tokenPresentBeforeEnsure: runtimeAuthProbe.tokenPresentBeforeEnsure,
        tokenPresentAfterEnsure: runtimeAuthProbe.tokenPresentAfterEnsure,
        missingTokenStatus: runtimeAuthProbe.missingTokenStatus,
        wrongTokenStatus: runtimeAuthProbe.wrongTokenStatus,
        correctTokenStatus: runtimeAuthProbe.correctTokenStatus,
        missingReadTokenStatus: runtimeAuthProbe.missingReadTokenStatus,
        wrongReadTokenStatus: runtimeAuthProbe.wrongReadTokenStatus,
        correctReadTokenStatus: runtimeAuthProbe.correctReadTokenStatus,
      },
      runtimeStatus: {
        tokenRequired: runtimeStatus.tokenRequired,
        providerCalled: runtimeStatus.providerCalled,
        liveSubmitAllowed: runtimeStatus.liveSubmitAllowed,
      },
      renderer,
    })}\n`);
    app.exit(0);
  } catch (error) {
    await stopRuntimeServer();
    fs.writeSync(2, `${smokeMarker}${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })}\n`);
    app.exit(1);
  }
}

async function createWindow() {
  const rendererDocumentUrl = trustedRendererDocumentUrl();
  const additionalArguments = [
    currentProjectBindingBootstrapArg(),
    browserDraftBootstrapArg(),
  ].filter((argument): argument is string => Boolean(argument));
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: !smokeMode,
    title: "Vibe Director Studio",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      additionalArguments,
    },
  });

  const rendererWebContentsId = win.webContents.id;
  trustedRendererWebContentsId = rendererWebContentsId;
  win.on("closed", () => {
    if (trustedRendererWebContentsId === rendererWebContentsId) trustedRendererWebContentsId = undefined;
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url).catch((error) => {
        console.error(`Failed to open external link: ${error instanceof Error ? error.message : String(error)}`);
      });
    }
    return { action: "deny" };
  });
  const blockUntrustedNavigation = (event: electron.Event, url: string) => {
    if (!isTrustedDocumentUrl(url, rendererDocumentUrl)) event.preventDefault();
  };
  win.webContents.on("will-navigate", blockUntrustedNavigation);
  win.webContents.on("will-redirect", blockUntrustedNavigation);
  win.webContents.on("will-attach-webview", (event) => event.preventDefault());

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

  const runtimeStartedBeforeRendererLoad = Boolean(runtimeServer || runtimeServerStarting || runtimeApiBaseUrl);
  if (isDev) {
    await win.loadURL(devUrl);
    if (!smokeMode && openDevToolsInDev) win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(path.join(appRoot, "dist", "index.html"));
  }

  await startPackagedAcceptanceControl(win);
  if (smokeMode) await runPackagedSmoke(win, runtimeStartedBeforeRendererLoad);
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
  packagedAcceptanceControlServer?.close();
  packagedAcceptanceControlServer = null;
  runtimeServer?.kill();
});

app.on("window-all-closed", () => {
  app.quit();
});
