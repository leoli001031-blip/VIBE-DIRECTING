import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function functionBody(source: string, name: string) {
  const start = source.indexOf(`function ${name}`);
  assert(start >= 0, `${name} function is missing`);
  const open = source.indexOf("{", start);
  assert(open >= 0, `${name} body is missing`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`${name} body was not closed`);
}

const mainSource = readFileSync("electron/main.mts", "utf8");
const preloadSource = readFileSync("electron/preload.mts", "utf8");
const runtimeClientSource = readFileSync("src/core/runtimeApiClient.ts", "utf8");
const qwenRunnerSource = readFileSync("scripts/local-qwen3-tts-clone-runner.py", "utf8");
const runtimeServerSource = readFileSync("scripts/local-runtime-api-server.mts", "utf8");
const qwenRouteSource = readFileSync("scripts/runtime-routes/local-qwen3-tts-clone.mts", "utf8");
const packageSource = readFileSync("package.json", "utf8");

const appReadyBody = mainSource.slice(mainSource.indexOf("app.whenReady().then"));
const appReadyBeforeCatch = appReadyBody.slice(0, appReadyBody.indexOf("}).catch"));
const createWindowBody = functionBody(mainSource, "createWindow");
const startRuntimeServerBody = functionBody(mainSource, "startRuntimeServer");
const ensureRuntimeServerBody = functionBody(mainSource, "ensureRuntimeServer");
const runtimeEnsureHandler = mainSource.slice(
  mainSource.indexOf("ipcMain.handle(\"runtime:ensureStarted\""),
  mainSource.indexOf("ipcMain.handle(\"project:chooseRoot\""),
);

assert(mainSource.includes("runtime:ensureStarted"), "Electron main must expose lazy runtime startup IPC");
assert(mainSource.includes("ensureRuntimeServer"), "Electron main must keep runtime startup behind an idempotent ensure function");
assert(!appReadyBeforeCatch.includes("startRuntimeServer("), "Electron app launch must not start the runtime server immediately");
assert(appReadyBeforeCatch.includes("await createWindow()"), "Electron app launch should create the window without a runtime URL");
assert(!createWindowBody.includes("startRuntimeServer("), "window creation must not start the runtime server");
assert(!runtimeEnsureHandler.includes("isDev"), "runtime ensure IPC must start the lazy runtime in Electron dev and packaged modes");
assert(startRuntimeServerBody.includes("await waitForRuntimeStatus(nextRuntimeApiBaseUrl)"), "runtime startup must wait for status readiness before returning a base URL");
assert(startRuntimeServerBody.indexOf("await waitForRuntimeStatus(nextRuntimeApiBaseUrl)") < startRuntimeServerBody.indexOf("runtimeApiBaseUrl = nextRuntimeApiBaseUrl"), "runtime base URL must not be cached before status readiness");
assert(ensureRuntimeServerBody.indexOf("runtimeServerStarting") < ensureRuntimeServerBody.indexOf("runtimeServer && runtimeApiBaseUrl"), "concurrent ensure calls must wait for the in-flight readiness check");

assert(preloadSource.includes("ensureRuntimeApiBaseUrl"), "preload must expose a lazy runtime API starter");
assert(preloadSource.includes("ipcRenderer.invoke(\"runtime:ensureStarted\")"), "preload lazy runtime starter must call the runtime IPC");
assert(preloadSource.includes("runtimeApiBaseUrlStarting"), "preload must dedupe concurrent lazy runtime startup calls");
assert(runtimeClientSource.includes("ensureRuntimeApiBaseUrl"), "renderer runtime client must know how to lazily request runtime startup");
assert(runtimeClientSource.includes("window.vibeRuntime?.runtimeApiBaseUrl"), "renderer runtime client must read the bridge runtime URL");
assert(runtimeClientSource.includes("await ensureRuntimeApiBaseUrl()"), "runtime requests must ensure runtime startup before fetch");
assert(runtimeClientSource.includes("if (hasElectronRuntimeBridge()) return \"\""), "Electron renderer must not bypass the lazy bridge by falling back to the default dev runtime URL");
assert(runtimeClientSource.includes("await waitForRuntimeApiReady(baseUrl)"), "Electron runtime requests must wait for status readiness before endpoint fetches");
assert(runtimeClientSource.includes("fetchWithRuntimeStartupRetry"), "runtime endpoint fetches must tolerate startup connection races");

assert(qwenRunnerSource.includes("Qwen3TTSModel.from_pretrained"), "Qwen3 model loading should stay isolated in the Python runner");
assert(!runtimeServerSource.includes("Qwen3TTSModel.from_pretrained"), "runtime server startup must not load the Qwen3 model");
assert(!qwenRouteSource.includes("Qwen3TTSModel.from_pretrained"), "Qwen3 route planning must not load the model");
assert(!mainSource.includes("Qwen3TTSModel"), "Electron main must never import or load the Qwen3 model");
assert(!preloadSource.includes("Qwen3TTSModel"), "preload must never import or load the Qwen3 model");

assert(packageSource.includes("\"package:smoke:gui\""), "GUI smoke must be an explicit opt-in script");
assert(!/"package:smoke":\s*"[^"]*packaged-gui-smoke:test/.test(packageSource), "default package smoke must not launch GUI smoke");
assert(!/"package:smoke":\s*"[^"]*electron-bridge-smoke:test/.test(packageSource), "default package smoke must not launch Electron bridge GUI smoke");

console.log("electron-lazy-runtime-contract-test: ok");
