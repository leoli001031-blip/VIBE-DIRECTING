import { readFileSync } from "node:fs";

import {
  isSafeExternalUrl,
  isTrustedDocumentUrl,
  isTrustedRendererSender,
  runtimeLoopbackHost,
} from "../electron/securityPolicy.mts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function assertThrows(run: () => unknown, message: string) {
  try {
    run();
  } catch {
    return;
  }
  throw new Error(`FAIL: ${message}`);
}

const packagedUrl = "file:///Applications/Vibe%20Director%20Studio.app/Contents/Resources/app.asar/dist/index.html";
assert(isTrustedDocumentUrl(packagedUrl, packagedUrl), "packaged renderer document should trust its exact file URL");
assert(isTrustedDocumentUrl(`${packagedUrl}#project`, packagedUrl), "renderer hash routing should not change the trusted document");
assert(!isTrustedDocumentUrl("file:///tmp/hostile.html", packagedUrl), "another local file must not become a trusted renderer");
assert(!isTrustedDocumentUrl("https://example.com/index.html", packagedUrl), "remote documents must not match the packaged renderer");

const devUrl = "http://127.0.0.1:5174/";
assert(isTrustedDocumentUrl("http://127.0.0.1:5174/?project=demo#shot", devUrl), "dev renderer query and hash state should remain trusted");
assert(!isTrustedDocumentUrl("http://localhost:5174/", devUrl), "a hostname alias must not bypass exact dev origin matching");
assert(!isTrustedDocumentUrl("http://127.0.0.1:5175/", devUrl), "a different dev port must not be trusted");
assert(!isTrustedDocumentUrl("http://127.0.0.1:5174/hostile", devUrl), "a different dev document path must not be trusted");

const policy = { webContentsId: 17, documentUrl: packagedUrl };
assert(isTrustedRendererSender({ webContentsId: 17, frameUrl: packagedUrl, isMainFrame: true }, policy), "the registered main frame should be trusted");
assert(!isTrustedRendererSender({ webContentsId: 18, frameUrl: packagedUrl, isMainFrame: true }, policy), "another WebContents must not invoke privileged IPC");
assert(!isTrustedRendererSender({ webContentsId: 17, frameUrl: packagedUrl, isMainFrame: false }, policy), "subframes must not invoke privileged IPC");
assert(!isTrustedRendererSender({ webContentsId: 17, frameUrl: "file:///tmp/hostile.html", isMainFrame: true }, policy), "a navigated main frame must lose privileged IPC access");

assert(isSafeExternalUrl("https://github.com/example/project"), "https links should open in the system browser");
assert(isSafeExternalUrl("http://example.test/docs"), "http links should open in the system browser");
assert(!isSafeExternalUrl("https://user:secret@example.com/"), "credential-bearing links should fail closed");
assert(!isSafeExternalUrl("file:///tmp/secret"), "file links must not be opened externally");
assert(!isSafeExternalUrl("javascript:alert(1)"), "script URLs must not be opened externally");
assert(!isSafeExternalUrl("data:text/html,hostile"), "data URLs must not be opened externally");

assert(runtimeLoopbackHost() === "127.0.0.1", "Runtime must default to the IPv4 loopback address");
assert(runtimeLoopbackHost("localhost") === "127.0.0.1", "localhost must normalize to the pinned loopback address");
assert(runtimeLoopbackHost("[::1]") === "127.0.0.1", "IPv6 loopback must normalize to the pinned loopback address");
assertThrows(() => runtimeLoopbackHost("0.0.0.0"), "wildcard Runtime binding must fail closed");
assertThrows(() => runtimeLoopbackHost("192.168.1.10"), "LAN Runtime binding must fail closed");

const mainSource = readFileSync("electron/main.mts", "utf8");
for (const channel of [
  "runtime:ensureStarted",
  "project:currentBinding",
  "project:chooseRoot",
  "project:createLocal",
  "project:remember",
  "project:forget",
  "sandbox:watch",
  "sandbox:unwatch",
  "sandbox:fileExists",
  "sandbox:readFile",
  "sandbox:hashFile",
  "sandbox:writeFile",
  "sandbox:copyFile",
  "sandbox:spawn",
]) {
  assert(mainSource.includes(`handleTrustedIpc("${channel}"`), `${channel} must use the trusted IPC wrapper`);
  assert(!mainSource.includes(`ipcMain.handle("${channel}"`), `${channel} must not bypass sender validation`);
}
assert(mainSource.includes("event.senderFrame === event.sender.mainFrame"), "IPC sender validation must reject subframes");
assert(mainSource.includes("win.webContents.setWindowOpenHandler"), "renderer windows must install a new-window policy");
assert(mainSource.includes('win.webContents.on("will-navigate"'), "renderer windows must guard top-level navigation");
assert(mainSource.includes('win.webContents.on("will-redirect"'), "renderer windows must guard redirects");
assert(mainSource.includes('win.webContents.on("will-attach-webview"'), "renderer windows must reject webview attachment");
assert(/isSafeExternalUrl\(url\)[\s\S]{0,160}shell\.openExternal\(url\)/.test(mainSource), "only safe web URLs may be delegated to the system browser");
assert(/const runtimeHost = runtimeLoopbackHost\(readEnv\("VIBE_DIRECTOR_RUNTIME_API_HOST", "VIBE_CORE_RUNTIME_API_HOST"\)\)/.test(mainSource), "Electron Runtime host overrides must stay loopback-only");

console.log("electron-security-policy-test: ok");
