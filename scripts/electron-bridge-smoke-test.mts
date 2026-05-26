import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import electronPath from "electron";
import { build } from "esbuild";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

if (process.platform === "darwin" && process.env.VIBE_ALLOW_ELECTRON_GUI_SMOKE !== "1") {
  console.log("electron-bridge-smoke-test: skipped on macOS unless VIBE_ALLOW_ELECTRON_GUI_SMOKE=1.");
  process.exit(0);
}

function escapeForTemplate(value: string) {
  return JSON.stringify(value);
}

const appRoot = process.cwd();
const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-electron-bridge-smoke-"));
const projectRoot = path.join(tempRoot, "project");
const outDir = path.join(tempRoot, "electron");
const preloadOut = path.join(outDir, "preload.cjs");
const mainOut = path.join(outDir, "main.cjs");
const marker = "__VIBE_ELECTRON_BRIDGE_SMOKE__";

mkdirSync(projectRoot, { recursive: true });
mkdirSync(outDir, { recursive: true });

try {
  await build({
    entryPoints: [path.join(appRoot, "electron", "preload.mts")],
    outfile: preloadOut,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["electron"],
  });

  writeFileSync(
    mainOut,
    `
const { app, BrowserWindow, ipcMain } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

app.setName("Vibe Director Studio");
if (process.platform === "darwin") {
  app.commandLine.appendSwitch("use-mock-keychain");
}

const marker = ${escapeForTemplate(marker)};
const preload = ${escapeForTemplate(preloadOut)};
const projectRoot = ${escapeForTemplate(projectRoot)};
const devUrl = process.env.VIBE_ELECTRON_DEV_URL || "data:text/html,<html><body>bridge-smoke</body></html>";

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function registerHandlers() {
  ipcMain.handle("project:chooseRoot", async () => ({
    cancelled: false,
    projectRoot,
    projectPath: "project.vibe",
    projectVibePath: path.join(projectRoot, "project.vibe"),
    hasProjectVibe: fs.existsSync(path.join(projectRoot, "project.vibe")),
    displayName: "Electron Bridge Smoke",
  }));

  ipcMain.handle("sandbox:readFile", async (_event, filePath) => {
    const resolved = path.resolve(filePath);
    const content = fs.readFileSync(resolved, "utf8");
    return { content, hash: sha256(content), path: resolved };
  });

  ipcMain.handle("sandbox:writeFile", async (_event, filePath, data) => {
    const resolved = path.resolve(filePath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, data, "utf8");
    return { written: true, path: resolved, hash: sha256(data) };
  });

  ipcMain.handle("sandbox:watch", async (_event, watchDir) => ({
    watching: fs.existsSync(path.resolve(watchDir)),
    dir: path.resolve(watchDir),
    watchId: "bridge-smoke-watch-1",
  }));

  ipcMain.handle("sandbox:unwatch", async (_event, watchId) => ({
    unwatched: watchId === "bridge-smoke-watch-1",
    watchId,
  }));

  ipcMain.handle("sandbox:copyFile", async (_event, sourcePath, destinationPath) => {
    const source = path.resolve(sourcePath);
    const destination = path.resolve(destinationPath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    const bytes = fs.readFileSync(destination);
    return {
      copied: true,
      sourcePath: source,
      path: destination,
      hash: sha256(bytes),
      size: bytes.length,
    };
  });

  ipcMain.handle("sandbox:spawn", async () => ({
    exitCode: 0,
    stdout: "",
    stderr: "",
  }));
}

app.whenReady().then(async () => {
  try {
    registerHandlers();
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload,
      },
    });
    await win.loadURL(devUrl);
    const result = await win.webContents.executeJavaScript(\`
      (async () => {
        const bridge = window.vibeRuntime;
        if (!bridge) throw new Error("Electron bridge missing");
        if (typeof bridge.chooseProjectRoot !== "function") throw new Error("chooseProjectRoot missing");
        const selection = await bridge.chooseProjectRoot();
        const target = selection.projectRoot + "/bridge-smoke.txt";
        const write = await bridge.sandboxWriteFile(target, "ok");
        const read = await bridge.sandboxReadFile(target);
        const watch = await bridge.sandboxWatch(selection.projectRoot);
        const copyTarget = selection.projectRoot + "/bridge-smoke-copy.txt";
        const copy = await bridge.sandboxCopyFile(target, copyTarget);
        const unwatch = await bridge.sandboxUnwatch(watch.watchId);
        const spawned = await bridge.sandboxSpawn("node", ["--version"]);
        return {
          selection,
          write,
          read,
          watch,
          copy,
          unwatch,
          spawned,
          hasBridge: true,
        };
      })()
    \`);
    console.log(marker + JSON.stringify(result));
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
`,
    "utf8",
  );

  const stdout: string[] = [];
  const stderr: string[] = [];
  const child = spawn(String(electronPath), [mainOut], {
    cwd: appRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      VIBE_ELECTRON_DEV_URL: process.env.VIBE_ELECTRON_DEV_URL || "data:text/html,<html><body>bridge-smoke</body></html>",
    },
  });

  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk.toString()));
  child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk.toString()));

  const exitResult = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Electron bridge smoke test timed out\nstdout:\n${stdout.join("")}\nstderr:\n${stderr.join("")}`));
    }, 30_000);

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });

  const output = stdout.join("");
  const errorOutput = stderr.join("");
  assert(exitResult.code === 0, `Electron bridge smoke process exited with code=${exitResult.code} signal=${exitResult.signal}\nstdout:\n${output}\nstderr:\n${errorOutput}`);

  const resultLine = output.split(/\r?\n/).find((line) => line.startsWith(marker));
  assert(resultLine, `Electron bridge smoke result marker missing\nstdout:\n${output}\nstderr:\n${errorOutput}`);

  const result = JSON.parse(resultLine.slice(marker.length));
  assert(result.hasBridge === true, "preload bridge should be available in renderer");
  assert(result.selection.cancelled === false, "project chooser IPC should return a selected root");
  assert(result.selection.projectRoot === projectRoot, "project chooser IPC should return the fixture project root");
  assert(result.selection.projectPath === "project.vibe", "project chooser IPC should return Project.vibe relative path");
  assert(result.selection.displayName === "Electron Bridge Smoke", "project chooser IPC should return display name");
  assert(result.write.written === true, "sandboxWriteFile should report success");
  assert(result.read.content === "ok", "sandboxReadFile should read back the written file");
  assert(result.watch.watching === true, "sandboxWatch should accept the selected project root");
  assert(result.watch.watchId === "bridge-smoke-watch-1", "sandboxWatch should return a clone-safe watch id");
  assert(result.copy.copied === true, "sandboxCopyFile should report success");
  assert(result.unwatch.unwatched === true, "sandboxUnwatch should close the clone-safe watch id");
  assert(result.spawned.exitCode === 0, "sandboxSpawn bridge should return a successful response");
  assert(existsSync(path.join(projectRoot, "bridge-smoke.txt")), "bridge smoke file should exist on disk");
  assert(readFileSync(path.join(projectRoot, "bridge-smoke.txt"), "utf8") === "ok", "bridge smoke file should persist expected content");
  assert(existsSync(path.join(projectRoot, "bridge-smoke-copy.txt")), "bridge smoke copied file should exist on disk");
  assert(readFileSync(path.join(projectRoot, "bridge-smoke-copy.txt"), "utf8") === "ok", "bridge smoke copied file should persist expected content");

  console.log("electron-bridge-smoke-test: Electron preload/IPC/filesystem bridge smoke completed.");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
