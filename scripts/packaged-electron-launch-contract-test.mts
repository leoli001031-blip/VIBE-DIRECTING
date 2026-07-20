import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractFile, listPackage } from "@electron/asar";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

async function waitForRuntime(child: ReturnType<typeof spawn>) {
  return new Promise<{ baseUrl: string }>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Timed out waiting for packaged runtime. stdout=${stdout} stderr=${stderr}`));
    }, 15_000);

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes("vibe-director-runtime-api-listening")) continue;
        try {
          clearTimeout(timeout);
          resolve(JSON.parse(line));
          return;
        } catch {
          // Keep waiting for a complete JSON line.
        }
      }
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      if (code === 0) return;
      clearTimeout(timeout);
      reject(new Error(`Packaged runtime exited early with ${code}. stdout=${stdout} stderr=${stderr}`));
    });
  });
}

async function stopRuntime(child: ReturnType<typeof spawn>) {
  if (!child || child.killed) return;
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(resolve, 1000);
  });
}

async function runPackagedExecutableSmoke(executablePath: string) {
  const marker = "__VIBE_ELECTRON_PACKAGED_GUI_SMOKE__";
  const smokeRoot = mkdtempSync("/tmp/vibe-packaged-app-smoke-");
  const smokeProfile = path.join(smokeRoot, "profile");
  const smokeProjects = path.join(smokeRoot, "projects");
  const smokeRuntime = path.join(smokeRoot, "runtime");
  mkdirSync(smokeProfile, { recursive: true });
  mkdirSync(smokeProjects, { recursive: true });
  mkdirSync(smokeRuntime, { recursive: true });
  const stdout: string[] = [];
  const stderr: string[] = [];
  const launchEnv = {
    VIBE_ELECTRON_SMOKE: "1",
    VIBE_DIRECTOR_RUNTIME_API_PORT: "0",
    VIBE_DIRECTOR_USER_DATA_DIR: smokeProfile,
    VIBE_DIRECTOR_PROJECTS_ROOT: smokeProjects,
    VIBE_DIRECTOR_RUNTIME_WORKDIR: smokeRuntime,
    VIBE_DIRECTOR_CURRENT_PROJECT_BINDING_PATH: path.join(smokeProfile, "current-project.local.json"),
  };
  const redirectedStdoutPath = process.platform === "darwin" ? path.join(smokeRoot, "stdout.log") : undefined;
  const redirectedStderrPath = process.platform === "darwin" ? path.join(smokeRoot, "stderr.log") : undefined;
  const darwinLaunchMarker = process.platform === "darwin" ? `vibe-packaged-smoke-id=${path.basename(smokeRoot)}` : undefined;
  const darwinSourceAppPath = process.platform === "darwin"
    ? path.resolve(path.dirname(executablePath), "../..")
    : undefined;
  const darwinAppPath = darwinSourceAppPath
    ? path.join(smokeRoot, path.basename(darwinSourceAppPath))
    : undefined;
  if (redirectedStdoutPath && redirectedStderrPath) {
    writeFileSync(redirectedStdoutPath, "", "utf8");
    writeFileSync(redirectedStderrPath, "", "utf8");
  }
  if (darwinSourceAppPath && darwinAppPath) {
    const sourceSignatureVerification = spawnSync("codesign", ["--verify", "--deep", "--strict", darwinSourceAppPath], { encoding: "utf8" });
    assert(
      sourceSignatureVerification.status === 0,
      `source packaged App signature verification failed: ${sourceSignatureVerification.stderr || sourceSignatureVerification.stdout}`,
    );
    const copy = spawnSync("ditto", [darwinSourceAppPath, darwinAppPath], { encoding: "utf8" });
    assert(copy.status === 0, `could not copy packaged App into the fresh smoke root: ${copy.stderr || copy.stdout}`);
    const signatureVerification = spawnSync("codesign", ["--verify", "--deep", "--strict", darwinAppPath], { encoding: "utf8" });
    assert(
      signatureVerification.status === 0,
      `packaged App signature verification failed: ${signatureVerification.stderr || signatureVerification.stdout}`,
    );
    const signatureDetails = spawnSync("codesign", ["-d", "--verbose=4", "--entitlements", ":-", darwinAppPath], { encoding: "utf8" });
    const signatureOutput = `${signatureDetails.stdout || ""}${signatureDetails.stderr || ""}`;
    assert(signatureDetails.status === 0 && /flags=.*runtime/.test(signatureOutput), "packaged App must retain hardened-runtime signing flags");
    for (const entitlement of [
      "com.apple.security.cs.allow-jit",
      "com.apple.security.cs.allow-unsigned-executable-memory",
      "com.apple.security.cs.disable-library-validation",
    ]) {
      assert(signatureOutput.includes(entitlement), `packaged App signature must retain ${entitlement}`);
    }
    const registration = spawnSync(
      "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister",
      ["-f", darwinAppPath],
      { encoding: "utf8" },
    );
    assert(registration.status === 0, `could not register packaged App with LaunchServices: ${registration.stderr || registration.stdout}`);
  }
  const child = process.platform === "darwin"
    ? spawn("open", [
        "-n",
        "-g",
        "-o",
        redirectedStdoutPath!,
        "--stderr",
        redirectedStderrPath!,
        ...Object.entries(launchEnv).flatMap(([name, value]) => ["--env", `${name}=${value}`]),
        darwinAppPath!,
        "--args",
        `--user-data-dir=${smokeProfile}`,
        `--${darwinLaunchMarker}`,
      ], {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      })
    : spawn(executablePath, [], {
        cwd: process.cwd(),
        env: { ...process.env, ...launchEnv },
        stdio: ["ignore", "pipe", "pipe"],
      });

  function output() {
    const redirectedStdout = redirectedStdoutPath && existsSync(redirectedStdoutPath)
      ? readFileSync(redirectedStdoutPath, "utf8")
      : "";
    const redirectedStderr = redirectedStderrPath && existsSync(redirectedStderrPath)
      ? readFileSync(redirectedStderrPath, "utf8")
      : "";
    return `${stdout.join("")}${redirectedStdout}\n${stderr.join("")}${redirectedStderr}`;
  }

  let stopChildPromise: Promise<void> | null = null;
  function stopChild(forceDarwinApp = false) {
    if (stopChildPromise) return stopChildPromise;
    stopChildPromise = new Promise<void>((resolve) => {
      if (darwinLaunchMarker) {
        if (!forceDarwinApp) {
          resolve();
          return;
        }
        const stop = spawn("pkill", ["-TERM", "-f", darwinLaunchMarker], { stdio: "ignore" });
        stop.once("error", () => resolve());
        stop.once("exit", () => resolve());
        return;
      }
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve();
        return;
      }
      child.once("exit", () => resolve());
      child.kill("SIGTERM");
      setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        resolve();
      }, 1000).unref();
    }).finally(() => {
      child.stdout?.destroy();
      child.stderr?.destroy();
    });
    return stopChildPromise;
  }

  let passed = false;
  try {
    const resultLine = await new Promise<string>((resolve, reject) => {
      let settled = false;
      const poll = setInterval(() => maybeResolve(), 100);
      function maybeResolve() {
        const line = output().split(/\r?\n/).find((candidate) => candidate.startsWith(marker));
        if (!line || settled) return;
        settled = true;
        clearInterval(poll);
        clearTimeout(timeout);
        void stopChild();
        resolve(line);
      }
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        void stopChild(true);
        reject(new Error(`Packaged executable smoke timed out; evidence retained at ${smokeRoot}\n${output()}`));
      }, 45_000);
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout.push(chunk.toString());
        maybeResolve();
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr.push(chunk.toString());
        maybeResolve();
      });
      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        clearTimeout(timeout);
        reject(error);
      });
      child.on("exit", (code) => {
        if (settled) return;
        const line = output().split(/\r?\n/).find((candidate) => candidate.startsWith(marker));
        if (line) {
          settled = true;
          clearInterval(poll);
          clearTimeout(timeout);
          resolve(line);
          return;
        }
        if (process.platform === "darwin" && code === 0) return;
        settled = true;
        clearInterval(poll);
        clearTimeout(timeout);
        reject(new Error(`Packaged executable smoke exited with ${code} before marker\n${output()}`));
      });
    });

    const result = JSON.parse(resultLine.slice(marker.length));
    const launchOutput = output();
    assert(result.ok === true, `packaged executable smoke failed: ${result.error || launchOutput}`);
    assert(result.packaged === true, "packaged executable smoke must run with app.isPackaged=true");
    assert(result.renderer?.rootPresent === true, "packaged executable smoke must render the app root");
    assert((result.renderer?.bodyLength || 0) > 100, "packaged executable smoke must render the real app body");
    assert(String(result.renderer?.bodyTextSample || "").includes("AI 导演"), "packaged executable smoke must render the Agent-first entry");
    assert(result.renderer?.hasBridge === true, "packaged executable smoke must expose the preload bridge");
    assert(Boolean(result.renderer?.bridgeRuntimeApiBaseUrl), "packaged executable smoke must expose the runtime base URL");
    assert(result.runtimeStartedBeforeRendererLoad === false, "packaged executable must create and load the renderer before Runtime starts");
    assert(result.runtimeAuthProbe?.tokenPresentBeforeEnsure === false, "packaged preload must not expose a Runtime token before lazy startup");
    assert(result.runtimeAuthProbe?.tokenPresentAfterEnsure === true, "packaged preload must receive the Runtime token after lazy startup");
    assert(result.runtimeAuthProbe?.missingTokenStatus === 403, "packaged Runtime must reject mutation without a token");
    assert(result.runtimeAuthProbe?.wrongTokenStatus === 403, "packaged Runtime must reject mutation with a wrong token");
    assert(result.runtimeAuthProbe?.correctTokenStatus === 200, "packaged Runtime must accept mutation with the in-memory Electron token");
    assert(result.runtimeAuthProbe?.missingReadTokenStatus === 403, "packaged Runtime must reject reads without a token");
    assert(result.runtimeAuthProbe?.wrongReadTokenStatus === 403, "packaged Runtime must reject reads with a wrong token");
    assert(result.runtimeAuthProbe?.correctReadTokenStatus === 200, "packaged Runtime must accept reads with the in-memory Electron token");
    assert(result.runtimeStatus?.tokenRequired === true, "packaged Runtime must report token protection enabled");
    assert(result.runtimeStatus?.providerCalled === false, "packaged executable smoke must not call providers");
    assert(result.runtimeStatus?.liveSubmitAllowed === false, "packaged executable smoke must keep live submit blocked");
    assert(
      !/(keychain|secret storage|password|系统钥匙串|钥匙串|密码)/i.test(launchOutput),
      "packaged executable smoke should not emit keychain/secret-storage/password prompts during normal launch",
    );
    passed = true;
  } finally {
    await stopChild();
    if (passed) rmSync(smokeRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return { response, payload };
}

function asText(file: Uint8Array) {
  return Buffer.from(file).toString("utf8");
}

const appPath = path.resolve(process.argv[2] || "release/mac-arm64/Vibe Director Studio.app");
const resourcesPath = path.join(appPath, "Contents", "Resources");
const asarPath = path.join(resourcesPath, "app.asar");
const runtimeBundlePath = path.join(
  resourcesPath,
  "app.asar.unpacked",
  "electron-runtime",
  "local-runtime-api-server.mjs",
);
const executablePath = path.join(appPath, "Contents", "MacOS", "Vibe Director Studio");

assert(existsSync(appPath), `packaged app must exist: ${appPath}`);
assert(existsSync(executablePath), "packaged app executable must exist");
assert(existsSync(asarPath), "packaged app.asar must exist");
assert(existsSync(runtimeBundlePath), "packaged runtime bundle must be unpacked next to app.asar");

const entries = listPackage(asarPath);
const entrySet = new Set(entries);

for (const required of [
  "/package.json",
  "/dist/index.html",
  "/electron-dist/main.mjs",
  "/electron-dist/preload.cjs",
]) {
  assert(entrySet.has(required), `app.asar must include ${required}`);
}

for (const forbiddenPrefix of [
  "/scripts/",
  "/electron/",
  "/test_artifacts/",
  "/fixtures/",
  "/docs/",
  "/release/",
  "/.electron-dev/",
]) {
  assert(
    !entries.some((entry) => entry === forbiddenPrefix.slice(0, -1) || entry.startsWith(forbiddenPrefix)),
    `app.asar must not include ${forbiddenPrefix}`,
  );
}

const packagedPackage = JSON.parse(asText(extractFile(asarPath, "package.json")));
assert(packagedPackage.main === "electron-dist/main.mjs", "packaged package.json must point at built Electron main");
assert(packagedPackage.name === "vibe-director-studio", "packaged package.json must not retain the old vibe-core app identity");

const mainSource = asText(extractFile(asarPath, "electron-dist/main.mjs"));
const preloadSource = asText(extractFile(asarPath, "electron-dist/preload.cjs"));
const indexHtml = asText(extractFile(asarPath, "dist/index.html"));
const runtimeSource = await readFile(runtimeBundlePath, "utf8");
for (const entry of entries.filter((item) => item.startsWith("/dist/assets/") && item.endsWith(".js"))) {
  const assetSource = asText(extractFile(asarPath, entry.replace(/^\//, "")));
  assert(!/from\s*["']node:|import\s*["']node:/.test(assetSource), `renderer asset must not import Node builtins: ${entry}`);
  for (const forbiddenSnippet of [
    "only available in the local runtime process",
    "node:fs/promises",
    "node:fs.watch",
    "node:child_process.spawn",
    "pseudoSha256Hex",
    "VITE_VIBE_DIRECTOR_RUNTIME_API_TOKEN",
    "VITE_VIBE_CORE_RUNTIME_API_TOKEN",
  ]) {
    assert(!assetSource.includes(forbiddenSnippet), `renderer asset must not bundle Node shim fallback "${forbiddenSnippet}": ${entry}`);
  }
}

assert(mainSource.includes("loadFile"), "built Electron main must load packaged dist/index.html");
assert(mainSource.includes("app.setName(\"Vibe Director Studio\")"), "built Electron main must set a clean app identity for macOS keychain prompts");
assert(
  mainSource.includes("appendSwitch(\"use-mock-keychain\")"),
  "built Electron main must avoid macOS keychain prompts during normal local use",
);
assert(mainSource.includes("runtime:ensureStarted"), "built Electron main must expose lazy runtime startup IPC");
assert(mainSource.includes("project:currentBinding"), "built Electron main must expose current project binding IPC for desktop restore");
assert(mainSource.includes("Blocked untrusted IPC sender"), "built Electron main must reject privileged IPC from untrusted senders");
assert(mainSource.includes("setWindowOpenHandler"), "built Electron main must deny embedded renderer-created windows");
assert(mainSource.includes("will-navigate"), "built Electron main must guard renderer navigation");
assert(mainSource.includes("will-redirect"), "built Electron main must guard renderer redirects");
assert(mainSource.includes("will-attach-webview"), "built Electron main must reject webview attachment");
assert(mainSource.includes("openExternal"), "built Electron main must delegate safe web links outside the Electron renderer");
assert(
  mainSource.includes("--user-data-dir=")
    && mainSource.includes("VIBE_DIRECTOR_USER_DATA_DIR")
    && mainSource.includes("setPath(\"userData\""),
  "built Electron main must align app userData with explicit env or user-data-dir profiles",
);
assert(mainSource.includes("ensureRuntimeServer"), "built Electron main must retain idempotent lazy runtime startup");
assert(
  /app\.whenReady\(\)\.then[\s\S]*?await createWindow\(\)/.test(mainSource),
  "built Electron main must create the first window without an eager Runtime URL",
);
const packagedAppReadyBody = mainSource.slice(mainSource.indexOf("app.whenReady().then"), mainSource.indexOf("}).catch", mainSource.indexOf("app.whenReady().then")));
assert(!packagedAppReadyBody.includes("ensureRuntimeServer("), "built Electron app startup must not ensure Runtime before the first window");
assert(mainSource.includes("runtimeStartedBeforeRendererLoad"), "built packaged smoke must verify the lazy Runtime startup order");
assert(mainSource.includes("currentProjectBindingBootstrapArg"), "built Electron main must provide a current project bootstrap argument");
assert(mainSource.includes("--vibe-current-project-binding="), "built Electron main must pass current project binding to preload");
assert(mainSource.includes("preload.cjs"), "built Electron main must target built preload.cjs");
assert(mainSource.includes("VIBE_DIRECTOR_RUNTIME_API_PORT"), "built Electron main must prefer Vibe Director runtime env names");
assert(mainSource.includes("VIBE_CORE_RUNTIME_API_PORT"), "built Electron main must keep legacy runtime env compatibility isolated");
assert(mainSource.includes("VIBE_ELECTRON_PACKAGED_ACCEPTANCE"), "built Electron main must gate packaged control acceptance behind an explicit test-only flag");
assert(mainSource.includes("VIBE_ELECTRON_ACCEPTANCE_CONTROL_TOKEN"), "packaged acceptance control must require an ephemeral token");
assert(
  mainSource.includes("VIBE_ELECTRON_ACCEPTANCE_EXPORT_FAULT")
    && mainSource.includes("VIBE_ELECTRON_ACCEPTANCE_EXPORT_PUBLISH_DELAY_MS"),
  "built Electron main must retain the P11 packaged export fault controls",
);
assert(
  /function packagedAcceptanceExportFault\(\)[\s\S]*?if \(!packagedAcceptanceControlEnabled\) return (?:undefined|void 0)/.test(mainSource)
    && /function packagedAcceptanceExportPublishDelayMs\(\)[\s\S]*?if \(!packagedAcceptanceControlEnabled\) return 0/.test(mainSource),
  "packaged export fault controls must fail closed outside authenticated packaged acceptance",
);
assert(mainSource.includes('server.listen(packagedAcceptanceControlPort, "127.0.0.1"'), "packaged acceptance control must bind to loopback only");
assert(mainSource.includes('request.method === "set_bounds"'), "packaged acceptance control must support authenticated responsive-window checks");
assert(mainSource.includes('request.method === "capture_page"'), "packaged acceptance control must support authenticated visual evidence capture");
assert(mainSource.includes('request.method === "click_at"'), "packaged acceptance control must support authenticated native click acceptance");
assert(mainSource.includes('invalid_click_coordinates'), "packaged native click acceptance must reject coordinates outside the window");
assert(preloadSource.includes("contextBridge"), "built preload must expose a context-isolated bridge");
assert(preloadSource.includes("vibeRuntime"), "built preload must expose vibeRuntime");
assert(preloadSource.includes("sandboxDiscardStagedExport"), "built preload must expose exact interrupted-export staging cleanup");
assert(preloadSource.includes("exportDiagnostics"), "built preload must expose diagnostic ZIP export");
assert(preloadSource.includes("ensureRuntimeApiBaseUrl"), "built preload must expose lazy runtime startup");
assert(preloadSource.includes("currentProjectBinding"), "built preload must expose current project binding restore helper");
assert(preloadSource.includes("__VIBE_CURRENT_PROJECT_BINDING__"), "built preload must expose current project bootstrap binding");
assert(preloadSource.includes("--vibe-current-project-binding="), "built preload must read current project bootstrap argument");
assert(indexHtml.includes("<script") && indexHtml.includes("./assets/"), "packaged dist/index.html must reference relative built assets for file:// loading");
assert(runtimeSource.includes("vibe-director-runtime-api-listening"), "packaged runtime must publish the Vibe Director listen event");
assert(runtimeSource.includes("VIBE_DIRECTOR_RUNTIME_WORKDIR"), "packaged runtime must prefer Vibe Director writable-root env");
assert(
  mainSource.includes("VIBE_DIRECTOR_RUNTIME_PARENT_PID")
    && runtimeSource.includes("VIBE_DIRECTOR_RUNTIME_PARENT_PID")
    && runtimeSource.includes("process.ppid"),
  "packaged Runtime must exit when its Electron parent is force-terminated",
);
assert(runtimeSource.includes("/audio/local-index-tts/generate"), "packaged runtime must include the local IndexTTS route");
assert(runtimeSource.includes("/audio/local-qwen3-tts-clone/generate"), "packaged runtime must include the local Qwen3 TTS clone route");
assert(!runtimeSource.includes("tsx/esm/api"), "packaged runtime bundle must not depend on tsx register");
assert(
  !runtimeSource.includes("await import(\"./local-runtime-api-server.mts\")"),
  "packaged runtime bundle must not import the .mts source wrapper",
);
await runPackagedExecutableSmoke(executablePath);

const runtimeCwd = mkdtempSync("/tmp/vibe-packaged-runtime-");
const isolatedHome = path.join(runtimeCwd, "home");
await mkdir(isolatedHome, { recursive: true });
const fakeSpeakerPath = path.join(runtimeCwd, "speaker.wav");
await writeFile(fakeSpeakerPath, Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(2048, 1)]));
const runtime = spawn(process.execPath, [runtimeBundlePath], {
  cwd: runtimeCwd,
  env: {
    ...process.env,
    HOME: isolatedHome,
    USERPROFILE: isolatedHome,
    VIBE_INDEX_TTS_ROOT: path.join(runtimeCwd, "missing-index-tts"),
    VIBE_DIRECTOR_RUNTIME_API_PORT: "0",
    VIBE_DIRECTOR_RUNTIME_WORKDIR: runtimeCwd,
    VIBE_DIRECTOR_CURRENT_PROJECT_BINDING_PATH: path.join(runtimeCwd, "current-project.local.json"),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  const { baseUrl } = await waitForRuntime(runtime);
  const response = await fetch(`${baseUrl}/api/runtime/status`);
  assert(response.status === 200, "packaged runtime status endpoint should respond");
  const payload = await response.json();
  assert(payload.providerCalled === false, "packaged runtime smoke must not call providers");
  assert(payload.liveSubmitAllowed === false, "packaged runtime smoke must keep live submit blocked");
  assert(
    Object.values(payload.endpoints || {}).includes("/api/runtime/audio/local-index-tts/generate"),
    "runtime status should advertise the local IndexTTS endpoint",
  );
  assert(
    Object.values(payload.endpoints || {}).includes("/api/runtime/audio/local-qwen3-tts-clone/generate"),
    "runtime status should advertise the local Qwen3 TTS clone endpoint",
  );

  const missingPermission = await postJson(`${baseUrl}/api/runtime/audio/local-index-tts/generate`, {
    text: "packaged local TTS permission probe",
    shotId: "pkg_tts_probe",
    speakerWavPath: fakeSpeakerPath,
    confirmationToken: "",
    permissionReceiptId: "",
    outputRelativePath: ".vibe-runtime/tts/local-index-tts/pkg_tts_probe.wav",
  });
  assert(missingPermission.response.status === 400, "packaged local IndexTTS route should block missing permission");
  assert(missingPermission.payload.localRuntimeCalled === false, "blocked local IndexTTS permission probe must not spawn local runtime");
  assert(missingPermission.payload.providerCalledExternal === false, "local IndexTTS permission probe must not call external providers");
  assert(missingPermission.payload.runtimeExternalNetworkCallMade === false, "local IndexTTS permission probe must not mark network use");

  const missingInstall = await postJson(`${baseUrl}/api/runtime/audio/local-index-tts/generate`, {
    text: "packaged local TTS install probe",
    shotId: "pkg_tts_probe",
    speakerWavPath: fakeSpeakerPath,
    confirmationToken: "submit-local-index-tts",
    permissionReceiptId: "packaged-local-tts-probe",
    outputRelativePath: ".vibe-runtime/tts/local-index-tts/pkg_tts_probe.wav",
  });
  assert(missingInstall.response.status === 400, "packaged local IndexTTS route should fail closed when local model files are absent");
  assert(missingInstall.payload.localRuntimeCalled === false, "missing local IndexTTS install must not spawn local runtime");
  assert(missingInstall.payload.providerCalledExternal === false, "missing local IndexTTS install must not call external providers");
  assert(!JSON.stringify(missingInstall.payload).includes(fakeSpeakerPath), "local IndexTTS blocker must not leak raw speaker path");
} finally {
  await stopRuntime(runtime);
  rmSync(runtimeCwd, { recursive: true, force: true });
}

console.log(`packaged-electron-launch-contract-test: ok (${path.relative(process.cwd(), appPath)})`);
