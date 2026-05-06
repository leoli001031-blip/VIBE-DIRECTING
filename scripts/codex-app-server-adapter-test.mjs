import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(pathname) {
  return fs.readFileSync(pathname, "utf8");
}

function transpile(pathname) {
  return ts.transpileModule(read(pathname), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: pathname,
  }).outputText;
}

function dataUrl(pathname, output) {
  return `data:text/javascript;base64,${Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(pathname).href}`).toString("base64")}`;
}

function runCodex(args) {
  return execFileSync("codex", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function methodSetFromGeneratedType(source) {
  return new Set(Array.from(source.matchAll(/"method":\s*"([^"]+)"/g), (match) => match[1]));
}

async function importAdapter() {
  return import(dataUrl("src/core/codexAppServerAdapter.ts", transpile("src/core/codexAppServerAdapter.ts")));
}

const appServerHelp = runCodex(["app-server", "--help"]);
assert(appServerHelp.includes("--listen <URL>"), "app-server help must expose listen URL option");
for (const transport of ["stdio://", "unix://", "ws://IP:PORT", "off"]) {
  assert(appServerHelp.includes(transport), `app-server help must mention ${transport}`);
}
assert(appServerHelp.includes("--ws-auth"), "app-server help must expose websocket auth controls");

const rootHelp = runCodex(["--help"]);
assert(rootHelp.includes("--remote <ADDR>"), "codex help must expose remote TUI address");
assert(rootHelp.includes("ws://host:port"), "codex help must document ws remote form");
assert(rootHelp.includes("wss://host:port"), "codex help must document wss remote form");
assert(rootHelp.includes("--remote-auth-token-env"), "codex help must route remote auth token through env var");

const generateTsHelp = runCodex(["app-server", "generate-ts", "--help"]);
assert(generateTsHelp.includes("--out <DIR>"), "generate-ts help must expose --out directory");
const generateSchemaHelp = runCodex(["app-server", "generate-json-schema", "--help"]);
assert(generateSchemaHelp.includes("--out <DIR>"), "generate-json-schema help must expose --out directory");

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-codex-app-server-adapter-"));
const tsOut = path.join(outDir, "ts");
const schemaOut = path.join(outDir, "schema");
runCodex(["app-server", "generate-ts", "--out", tsOut]);
runCodex(["app-server", "generate-json-schema", "--out", schemaOut]);

for (const generatedPath of [
  path.join(tsOut, "ClientRequest.ts"),
  path.join(tsOut, "ServerRequest.ts"),
  path.join(tsOut, "ServerNotification.ts"),
  path.join(tsOut, "InitializeCapabilities.ts"),
  path.join(schemaOut, "ClientRequest.json"),
  path.join(schemaOut, "ServerRequest.json"),
  path.join(schemaOut, "ServerNotification.json"),
]) {
  assert(fs.existsSync(generatedPath), `${generatedPath} must be generated`);
}

const clientMethods = methodSetFromGeneratedType(read(path.join(tsOut, "ClientRequest.ts")));
const serverRequestMethods = methodSetFromGeneratedType(read(path.join(tsOut, "ServerRequest.ts")));
const notificationMethods = methodSetFromGeneratedType(read(path.join(tsOut, "ServerNotification.ts")));

for (const method of ["thread/start", "thread/resume", "thread/read", "thread/turns/list"]) {
  assert(clientMethods.has(method), `generated client protocol must include ${method}`);
}
for (const method of ["turn/start", "turn/steer", "turn/interrupt"]) {
  assert(clientMethods.has(method), `generated client protocol must include ${method}`);
}
for (const method of ["fs/watch", "fs/unwatch"]) {
  assert(clientMethods.has(method), `generated client protocol must include ${method}`);
}
for (const method of [
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/permissions/requestApproval",
]) {
  assert(serverRequestMethods.has(method), `generated server request protocol must include ${method}`);
}
for (const method of ["item/tool/call", "item/tool/requestUserInput", "mcpServer/elicitation/request"]) {
  assert(serverRequestMethods.has(method), `generated server tool protocol must include ${method}`);
}
for (const method of ["thread/started", "turn/started", "turn/completed", "fs/changed", "item/mcpToolCall/progress"]) {
  assert(notificationMethods.has(method), `generated notifications must include ${method}`);
}

const {
  buildCodexAppServerAdapterState,
  codexAppServerAdapterHardLocks,
  validateCodexAppServerAdapterHardLocks,
} = await importAdapter();

const state = buildCodexAppServerAdapterState({
  generatedAt: "2026-05-04T00:00:00.000Z",
  cliVersionObserved: "0.128.0",
});
assert(state.adapterId === "codex-app-server-agent", "adapter id drifted");
assert(state.runtimeKind === "codex_app_server", "runtime kind drifted");
assert(state.mode === "contract_readiness_adapter", "mode drifted");
assert(state.readiness === "ready", "default app-server adapter should be ready");
assert(state.capabilities.supportsRemoteTui === true, "adapter must support remote TUI");
assert(state.capabilities.generatedSchemaAvailable === true, "generated schema must be available");
assert(state.capabilities.generatedTypesAvailable === true, "generated TS bindings must be available");
assert(state.transport.selectedTransport === "off", "readiness adapter must not select a live transport");
assert(state.transport.liveConnectionAllowed === false, "live connection must be blocked");
assert(state.transport.appServerLaunchAllowed === false, "app-server launch must be blocked");
for (const transport of ["stdio", "unix", "ws", "off"]) {
  assert(state.transport.supportedTransports.includes(transport), `adapter must cover ${transport}`);
}
assert(state.fallback.legacyRuntime === "codex_exec_json", "legacy exec fallback must be preserved");
assert(state.fallback.legacyAdapterId === "codex-cli-agent", "legacy adapter id must point at codex-cli-agent");
assert(state.fallback.silentFallbackAllowed === false, "fallback must be explicit");
assert(state.hardLocks.noCredentialRead === true, "credential read must be locked");
assert(state.hardLocks.noCredentialStorage === true, "credential storage must be locked");
assert(state.hardLocks.noApprovalBypass === true, "approval bypass must be locked");
assert(state.hardLocks.noDirectProviderSubmit === true, "direct provider submit must be locked");
assert(state.hardLocks.noProviderSelfReportCompletion === true, "provider self-report completion must be locked");
assert(state.hardLocks.noTaskPacketBypass === true, "task packet bypass must be locked");
assert(state.hardLocks.noSidecarReplacement === true, "sidecar replacement must be locked");
assert(state.hardLocks.noQaReplacement === true, "QA replacement must be locked");
assert(validateCodexAppServerAdapterHardLocks(codexAppServerAdapterHardLocks).length === 0, "default hard locks must validate");

for (const method of state.methods.clientRequests.thread) assert(clientMethods.has(method), `state thread client method ${method} must be generated`);
for (const method of state.methods.clientRequests.turn) assert(clientMethods.has(method), `state turn client method ${method} must be generated`);
for (const method of state.methods.clientRequests.filesystem_watch) assert(clientMethods.has(method), `state fs client method ${method} must be generated`);
for (const method of state.methods.serverRequests.approval) assert(serverRequestMethods.has(method), `state approval server request ${method} must be generated`);
for (const method of state.methods.serverRequests.tool_call) assert(serverRequestMethods.has(method), `state tool server request ${method} must be generated`);
for (const method of Object.values(state.methods.serverNotifications).flat()) {
  assert(notificationMethods.has(method), `state notification ${method} must be generated`);
}

for (const [override, blocker] of [
  [{ generatedSchemaAvailable: false }, "generated_schema_unavailable"],
  [{ generatedTypesAvailable: false }, "generated_types_unavailable"],
  [{ supportedTransports: ["stdio", "unix", "ws"] }, "supported_transport_coverage_incomplete"],
  [{ socketConnectionAttempted: true }, "socket_connection_attempt_blocked"],
  [{ longRunningServerAttempted: true }, "long_running_app_server_attempt_blocked"],
  [{ credentialAccessAttempted: true }, "credential_access_attempt_blocked"],
  [{ credentialStorageAttempted: true }, "credential_storage_attempt_blocked"],
  [{ approvalBypassAttempted: true }, "approval_bypass_attempt_blocked"],
  [{ providerSubmitAttempted: true }, "provider_submit_attempt_blocked"],
  [{ directProviderSubmitAttempted: true }, "direct_provider_submit_attempt_blocked"],
  [{ providerSelfReportAcceptedAttempted: true }, "provider_self_report_completion_attempt_blocked"],
  [{ taskPacketBypassAttempted: true }, "task_packet_bypass_attempt_blocked"],
  [{ sidecarReplacementAttempted: true }, "sidecar_replacement_attempt_blocked"],
  [{ qaReplacementAttempted: true }, "qa_replacement_attempt_blocked"],
  [{ remoteControlAttempted: true }, "remote_control_attempt_blocked"],
  [{ legacyExecRemovedAttempted: true }, "legacy_exec_fallback_removed_attempt_blocked"],
]) {
  const blocked = buildCodexAppServerAdapterState({
    generatedAt: "2026-05-04T00:00:00.000Z",
    ...override,
  });
  assert(blocked.readiness === "blocked", `${blocker}: state must block`);
  assert(blocked.blockers.includes(blocker), `${blocker}: blocker missing`);
}

const source = read("src/core/codexAppServerAdapter.ts");
for (const [pattern, label] of [
  [/from\s+["']node:child_process["']|from\s+["']child_process["']/, "child_process import"],
  [/\bspawn\s*\(/, "spawn call"],
  [/\bexec(?:File)?\s*\(/, "exec call"],
  [/\bfetch\s*\(/, "fetch call"],
  [/\bWebSocket\s*\(/, "WebSocket call"],
  [/\bwriteFile(?:Sync)?\s*\(/, "writeFile call"],
  [/\bappendFile(?:Sync)?\s*\(/, "appendFile call"],
  [/\bcreateServer\s*\(/, "server creation call"],
]) {
  assert(!pattern.test(source), `codex app-server adapter module must not contain ${label}`);
}

const packageJson = JSON.parse(read("package.json"));
assert(
  packageJson.scripts["codex-app-server-adapter:test"] === "node scripts/codex-app-server-adapter-test.mjs",
  "package script missing",
);

console.log(
  `Codex app-server adapter tests passed: ${state.transport.supportedTransports.join("/")}, ${clientMethods.size} client methods, ${notificationMethods.size} notifications.`,
);
