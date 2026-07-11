import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

if (process.platform === "darwin" && process.env.VIBE_ALLOW_ELECTRON_GUI_SMOKE !== "1") {
  console.log("packaged-electron-gui-smoke-test: skipped on macOS unless VIBE_ALLOW_ELECTRON_GUI_SMOKE=1.");
  process.exit(0);
}

const marker = "__VIBE_ELECTRON_PACKAGED_GUI_SMOKE__";
const appPath = path.resolve(process.argv[2] || "release/mac-arm64/Vibe Director Studio.app");
const executablePath = path.join(appPath, "Contents", "MacOS", "Vibe Director Studio");

assert(existsSync(appPath), `packaged app must exist: ${appPath}`);
assert(existsSync(executablePath), "packaged app executable must exist");

const stdout: string[] = [];
const stderr: string[] = [];
const child = spawn(executablePath, [], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    VIBE_ELECTRON_SMOKE: "1",
    VIBE_DIRECTOR_RUNTIME_API_PORT: "0",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

function stopChild() {
  child.stdout?.destroy();
  child.stderr?.destroy();
  if (!child.killed) child.kill("SIGTERM");
  setTimeout(() => {
    if (!child.killed) child.kill("SIGKILL");
  }, 1000).unref();
  child.unref();
}

const resultLine = await new Promise<string>((resolve, reject) => {
  let resolved = false;
  function output() {
    return `${stdout.join("")}\n${stderr.join("")}`;
  }
  function maybeResolve() {
    const line = output().split(/\r?\n/).find((candidate) => candidate.startsWith(marker));
    if (!line || resolved) return;
    resolved = true;
    clearTimeout(timeout);
    stopChild();
    resolve(line);
  }
  const timeout = setTimeout(() => {
    stopChild();
    reject(new Error(`Packaged Electron GUI smoke timed out\nstdout:\n${stdout.join("")}\nstderr:\n${stderr.join("")}`));
  }, 45_000);
  child.stdout.on("data", (chunk: Buffer) => {
    stdout.push(chunk.toString());
    maybeResolve();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr.push(chunk.toString());
    maybeResolve();
  });
  child.on("error", (error) => {
    if (resolved) return;
    clearTimeout(timeout);
    reject(error);
  });
  child.on("exit", (code) => {
    if (resolved) return;
    clearTimeout(timeout);
    const line = output().split(/\r?\n/).find((candidate) => candidate.startsWith(marker));
    if (line) {
      resolve(line);
      return;
    }
    reject(new Error(`packaged GUI smoke exited with ${code} before marker\n${output()}`));
  });
});

const output = `${stdout.join("")}\n${stderr.join("")}`;
const result = JSON.parse(resultLine.slice(marker.length));
assert(result.ok === true, `packaged GUI smoke failed: ${result.error || output}`);
assert(result.packaged === true, "packaged GUI smoke must run against app.isPackaged=true");
assert(result.renderer?.rootPresent === true, "renderer root should be present");
assert((result.renderer?.bodyLength || 0) > 100, "renderer should render the real app body, not a blank root");
const bodyTextSample = String(result.renderer?.bodyTextSample || "");
assert(bodyTextSample.includes("新视频项目") && bodyTextSample.includes("AI 导演"), "renderer should show the Agent-first creator entry");
assert(result.renderer?.hasBridge === true, "preload bridge should be available");
assert(Boolean(result.renderer.bridgeRuntimeApiBaseUrl), "runtime base URL bridge should be available");
assert(result.runtimeStartedBeforeRendererLoad === false, "packaged renderer must load before Runtime starts");
assert(result.runtimeAuthProbe?.tokenPresentBeforeEnsure === false, "Runtime token must not be exposed before lazy startup");
assert(result.runtimeAuthProbe?.tokenPresentAfterEnsure === true, "Runtime token must be available after lazy startup");
assert(result.runtimeAuthProbe?.missingTokenStatus === 403, "Runtime mutation without token must be rejected");
assert(result.runtimeAuthProbe?.wrongTokenStatus === 403, "Runtime mutation with wrong token must be rejected");
assert(result.runtimeAuthProbe?.correctTokenStatus === 200, "Runtime mutation with the Electron token must succeed");
assert(result.runtimeAuthProbe?.missingReadTokenStatus === 403, "Runtime read without token must be rejected");
assert(result.runtimeAuthProbe?.wrongReadTokenStatus === 403, "Runtime read with wrong token must be rejected");
assert(result.runtimeAuthProbe?.correctReadTokenStatus === 200, "Runtime read with the Electron token must succeed");
if (result.renderer.exposedRuntimeApiBaseUrl) {
  assert(result.renderer.bridgeRuntimeApiBaseUrl === result.renderer.exposedRuntimeApiBaseUrl, "runtime base URL bridge mismatch");
}
assert(result.runtimeStatus?.tokenRequired === true, "packaged Runtime must report token protection enabled");
assert(result.runtimeStatus?.providerCalled === false, "packaged GUI smoke must not call providers");
assert(result.runtimeStatus?.liveSubmitAllowed === false, "packaged GUI smoke must keep live submit blocked");
assert(
  !/(keychain|secret storage|password|系统钥匙串|钥匙串|密码)/i.test(output),
  "packaged GUI smoke should not emit keychain/secret-storage/password prompts during normal launch",
);

console.log(`packaged-electron-gui-smoke-test: ok (${path.relative(process.cwd(), appPath)})`);
