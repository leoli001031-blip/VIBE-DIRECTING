import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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
assert(mainSource.includes("ensureRuntimeServer"), "built Electron main must retain idempotent lazy runtime startup");
assert(
  !/app\.whenReady\(\)\.then[\s\S]*?startRuntimeServer\(/.test(mainSource),
  "built Electron main must not start the runtime server during app launch",
);
assert(mainSource.includes("preload.cjs"), "built Electron main must target built preload.cjs");
assert(mainSource.includes("VIBE_DIRECTOR_RUNTIME_API_PORT"), "built Electron main must prefer Vibe Director runtime env names");
assert(mainSource.includes("VIBE_CORE_RUNTIME_API_PORT"), "built Electron main must keep legacy runtime env compatibility isolated");
assert(preloadSource.includes("contextBridge"), "built preload must expose a context-isolated bridge");
assert(preloadSource.includes("vibeRuntime"), "built preload must expose vibeRuntime");
assert(preloadSource.includes("ensureRuntimeApiBaseUrl"), "built preload must expose lazy runtime startup");
assert(indexHtml.includes("<script") && indexHtml.includes("./assets/"), "packaged dist/index.html must reference relative built assets for file:// loading");
assert(runtimeSource.includes("vibe-director-runtime-api-listening"), "packaged runtime must publish the Vibe Director listen event");
assert(runtimeSource.includes("VIBE_DIRECTOR_RUNTIME_WORKDIR"), "packaged runtime must prefer Vibe Director writable-root env");
assert(runtimeSource.includes("/audio/local-index-tts/generate"), "packaged runtime must include the local IndexTTS route");
assert(runtimeSource.includes("/audio/local-qwen3-tts-clone/generate"), "packaged runtime must include the local Qwen3 TTS clone route");
assert(!runtimeSource.includes("tsx/esm/api"), "packaged runtime bundle must not depend on tsx register");
assert(
  !runtimeSource.includes("await import(\"./local-runtime-api-server.mts\")"),
  "packaged runtime bundle must not import the .mts source wrapper",
);

const runtimeCwd = mkdtempSync(path.join(tmpdir(), "vibe-packaged-runtime-"));
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
