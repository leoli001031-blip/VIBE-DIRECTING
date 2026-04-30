import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function transpile(path) {
  return ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: path,
  }).outputText;
}

function dataUrl(path, output) {
  return `data:text/javascript;base64,${Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64")}`;
}

async function importDesktopRuntime() {
  return import(dataUrl("src/core/desktopRuntime.ts", transpile("src/core/desktopRuntime.ts")));
}

const { buildDesktopRuntimePlan, desktopRuntimeHardLocks } = await importDesktopRuntime();

const generatedAt = "2026-05-01T00:00:00.000Z";

const darwinPlan = buildDesktopRuntimePlan({
  generatedAt,
  platform: "darwin",
  runtimeMode: "tauri_permission_shell_planned",
  projectRootToken: "user_selected_project_root:agi_new_humans",
  rawProjectRootPath: "/Users/example/Desktop/AGI 新人类",
  portableProjectPaths: ["project.vibe", "story_flow/story_flow.vibe.json", "visual_memory/hero/main.png"],
});

assert(darwinPlan.phase === "phase_15_desktop_runtime_permission_shell", "phase id drifted");
assert(darwinPlan.schemaVersion === "0.1.0", "schema version drifted");
assert(darwinPlan.generatedAt === generatedAt, "generatedAt must be stable");
assert(darwinPlan.platform === "darwin", "darwin platform plan missing");
assert(darwinPlan.runtimeMode === "tauri_permission_shell_planned", "runtime mode drifted");
assert(darwinPlan.validation.ok, `darwin plan should validate: ${darwinPlan.validation.errors.join("; ")}`);
assert(darwinPlan.validation.warnings.some((warning) => warning.includes("redacted")), "raw path redaction warning missing");
assert(!JSON.stringify(darwinPlan).includes("/Users/example/Desktop/AGI 新人类"), "raw project root path must not leak into the plan");
assert(darwinPlan.tauriShellPlan.capabilities.length >= 5, "tauri shell capabilities missing");
for (const id of ["window", "file_dialog", "filesystem_watch", "sidecar_start_stop", "keychain_commands"]) {
  const capability = darwinPlan.tauriShellPlan.capabilities.find((item) => item.id === id);
  assert(capability, `tauri capability ${id} missing`);
  assert(capability.executableNow === false, `tauri capability ${id} must not execute now`);
  assert(["planned", "disabled", "permission_gated"].includes(capability.status), `tauri capability ${id} has invalid status`);
}
assert(darwinPlan.projectPermissionScope.scopeKind === "user_selected_project_root_token", "project scope must be token based");
assert(darwinPlan.projectPermissionScope.token === "user_selected_project_root:agi_new_humans", "project root token drifted");
assert(darwinPlan.projectPermissionScope.rawPathRedacted === "[redacted:user_selected_project_root]", "raw path must be redacted");
assert(darwinPlan.projectPermissionScope.rawPathPersisted === false, "raw path must not be persisted");
assert(darwinPlan.projectPermissionScope.portableContract.absolutePathsAllowed === false, "absolute paths must be forbidden");
assert(darwinPlan.projectPermissionScope.portableContract.parentTraversalAllowed === false, "parent traversal must be forbidden");
assert(darwinPlan.projectPermissionScope.portableContract.shellSpecificPathsAllowed === false, "shell-specific paths must be forbidden");
assert(
  darwinPlan.pathResolverPlan.resolvers.some(
    (resolver) => resolver.platform === "darwin" && resolver.pathStyle === "posix" && resolver.persistedInProjectFiles === false,
  ),
  "darwin posix resolver plan missing",
);
assert(
  darwinPlan.pathResolverPlan.resolvers.some(
    (resolver) => resolver.platform === "all" && resolver.pathStyle === "project-root-relative" && resolver.persistedInProjectFiles === true,
  ),
  "portable project-root-relative resolver plan missing",
);
assert(darwinPlan.pathResolverPlan.hardcodedAbsolutePathPersistenceAllowed === false, "hardcoded absolute path persistence must be disabled");
assert(darwinPlan.pathResolverPlan.portablePaths.every((entry) => entry.status === "accepted"), "valid portable paths should be accepted");
assert(darwinPlan.sidecarAllowlist.requestedCommandExecutableNow === false, "default sidecar request executable flag must be false");

const winPlan = buildDesktopRuntimePlan({
  generatedAt,
  platform: "win32",
  projectRootToken: "user_selected_project_root:win_project",
  rawProjectRootPath: "C:\\Users\\example\\project",
  portableProjectPaths: ["project.vibe", "shots/shot_001.vibe.json"],
});
assert(winPlan.validation.ok, `win32 plan should validate: ${winPlan.validation.errors.join("; ")}`);
assert(winPlan.platform === "win32", "win32 platform plan missing");
assert(
  winPlan.pathResolverPlan.resolvers.some(
    (resolver) => resolver.platform === "win32" && resolver.pathStyle === "win32" && resolver.persistedInProjectFiles === false,
  ),
  "win32 resolver plan missing",
);
assert(winPlan.projectPermissionScope.rawPathRedacted === "[redacted:user_selected_project_root]", "windows raw path must be redacted");

const absoluteTokenPlan = buildDesktopRuntimePlan({
  platform: "darwin",
  projectRootToken: "/Users/example/project",
});
assert(!absoluteTokenPlan.validation.ok, "absolute project root token must be blocked");
assert(
  absoluteTokenPlan.validation.errors.some((error) => error.includes("user-selected project root token")),
  "absolute token rejection should mention token contract",
);
assert(absoluteTokenPlan.projectPermissionScope.token === "[blocked:invalid_project_root_token]", "invalid token must be redacted/block-labeled");

const absolutePathPlan = buildDesktopRuntimePlan({
  platform: "darwin",
  projectRootToken: "user_selected_project_root:valid",
  portableProjectPaths: ["/Users/example/project/project.vibe", "story_flow/story_flow.vibe.json"],
});
assert(!absolutePathPlan.validation.ok, "absolute portable path must be blocked");
assert(
  absolutePathPlan.pathResolverPlan.portablePaths.some(
    (entry) => entry.status === "blocked" && entry.redacted === true && entry.path === "[blocked:absolute_path_redacted]",
  ),
  "absolute portable path must be redacted in plan",
);
assert(
  absolutePathPlan.repairPlan.some((item) => item.id === "blocked_portable_paths" && item.status === "blocked"),
  "blocked portable paths repair item missing",
);

const windowsAbsolutePathPlan = buildDesktopRuntimePlan({
  platform: "win32",
  projectRootToken: "user_selected_project_root:valid",
  portableProjectPaths: ["C:\\Users\\example\\project\\project.vibe"],
});
assert(!windowsAbsolutePathPlan.validation.ok, "win32 absolute portable path must be blocked");
assert(
  windowsAbsolutePathPlan.pathResolverPlan.portablePaths.some(
    (entry) => entry.status === "blocked" && entry.redacted === true && entry.path === "[blocked:absolute_path_redacted]",
  ),
  "win32 absolute portable path must be redacted in plan",
);

const uncAbsolutePathPlan = buildDesktopRuntimePlan({
  platform: "win32",
  projectRootToken: "user_selected_project_root:valid",
  portableProjectPaths: ["\\\\server\\share\\project.vibe"],
});
assert(!uncAbsolutePathPlan.validation.ok, "UNC absolute portable path must be blocked");
assert(
  uncAbsolutePathPlan.pathResolverPlan.portablePaths.some((entry) => entry.status === "blocked" && entry.redacted === true),
  "UNC absolute path must be redacted in plan",
);

const parentTraversalPlan = buildDesktopRuntimePlan({
  platform: "win32",
  projectRootToken: "user_selected_project_root:valid",
  portableProjectPaths: ["../outside/project.vibe"],
});
assert(!parentTraversalPlan.validation.ok, "parent traversal portable path must be blocked");
assert(
  parentTraversalPlan.validation.errors.some((error) => error.includes("parent traversal")),
  "parent traversal rejection should be explicit",
);

const shellPlan = buildDesktopRuntimePlan({
  platform: "darwin",
  projectRootToken: "user_selected_project_root:valid",
  requestedSidecarCommand: "rm -rf /",
});
assert(shellPlan.sidecarAllowlist.arbitraryShell === "forbidden", "arbitrary shell must be forbidden");
assert(shellPlan.sidecarAllowlist.sidecarSpawnAllowedNow === false, "sidecar spawn must be disabled");
assert(shellPlan.sidecarAllowlist.requestedCommandStatus === "blocked", "unknown sidecar command must be blocked");
assert(shellPlan.sidecarAllowlist.requestedCommandExecutableNow === false, "unknown sidecar command must not be executable");
assert(
  shellPlan.sidecarAllowlist.commands.every(
    (command) =>
      command.argumentSource === "validated_envelope_only" &&
      command.userFreeTextShellAllowed === false &&
      command.liveSubmitAllowed === false,
  ),
  "sidecar commands must use validated envelopes only",
);
assert(
  !shellPlan.sidecarAllowlist.commands.some((command) => command.executable.includes("sh") || command.executable.includes("bash")),
  "shell executables must not be allowlisted",
);

const allowlistedFuturePlan = buildDesktopRuntimePlan({
  platform: "darwin",
  projectRootToken: "user_selected_project_root:valid",
  requestedSidecarCommand: "codex",
});
assert(allowlistedFuturePlan.sidecarAllowlist.requestedCommandStatus === "planned_allowlisted", "allowlisted command should be planned only");
assert(allowlistedFuturePlan.sidecarAllowlist.requestedCommandExecutableNow === false, "allowlisted command request must not be executable");
assert(allowlistedFuturePlan.sidecarAllowlist.sidecarSpawnAllowedNow === false, "allowlisted command request must not spawn sidecar");
assert(
  allowlistedFuturePlan.sidecarAllowlist.blockedReasons.some((reason) => reason.includes("sidecar spawn is disabled")),
  "allowlisted command must still explain disabled sidecar spawn",
);

for (const credentialAction of ["read", "write", "create_api_key"]) {
  const credentialPlan = buildDesktopRuntimePlan({
    platform: "win32",
    projectRootToken: "user_selected_project_root:valid",
    requestedCredentialAction: credentialAction,
  });
  assert(credentialPlan.credentialVaultPlan.mode === "planned_placeholder", "credential vault should be placeholder");
  assert(credentialPlan.credentialVaultPlan.plannedStores.includes("macos_keychain"), "macOS Keychain placeholder missing");
  assert(credentialPlan.credentialVaultPlan.plannedStores.includes("windows_credential_manager"), "Windows Credential Manager placeholder missing");
  assert(credentialPlan.credentialVaultPlan.plannedStores.includes("encrypted_local_fallback"), "encrypted fallback placeholder missing");
  assert(credentialPlan.credentialVaultPlan.readAllowedNow === false, `${credentialAction}: credential read must be blocked`);
  assert(credentialPlan.credentialVaultPlan.writeAllowedNow === false, `${credentialAction}: credential write must be blocked`);
  assert(credentialPlan.credentialVaultPlan.createApiKeyAllowedNow === false, `${credentialAction}: API key creation must be blocked`);
  assert(credentialPlan.credentialVaultPlan.requestedActionStatus === "blocked", `${credentialAction}: credential action request must be blocked`);
  assert(
    credentialPlan.credentialVaultPlan.blockedReasons.some((reason) => reason.includes(credentialAction)),
    `${credentialAction}: blocked reason must name requested credential action`,
  );
}

for (const [key, expected] of Object.entries({
  noFileMutation: true,
  noDirectoryCreate: true,
  noUserFileMove: true,
  noProviderSubmit: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noArbitraryShell: true,
  noSidecarSpawn: true,
  noInstall: true,
  noDownload: true,
  liveSubmitAllowed: false,
})) {
  assert(darwinPlan.hardLocks[key] === expected, `hard lock ${key} drifted`);
  assert(desktopRuntimeHardLocks[key] === expected, `exported hard lock ${key} drifted`);
}
assert(darwinPlan.safetySummary.some((line) => line.includes("permission shell")), "safety summary should explain permission shell");
assert(darwinPlan.migrationPlan.some((item) => item.id === "tauri_shell_contract"), "migration plan missing tauri contract");
assert(darwinPlan.repairPlan.some((item) => item.id === "invalid_project_root_scope"), "repair plan missing project root scope");

const schema = readJson("schemas/desktop_runtime_plan.schema.json");
assert(schema.title === "DesktopRuntimePlan", "desktop runtime schema title missing");
assert(schema.properties.phase.const === "phase_15_desktop_runtime_permission_shell", "desktop runtime schema phase const missing");
assert(
  schema.$defs.projectPermissionScope.properties.token.pattern ===
    "^(user_selected_project_root:[A-Za-z0-9_-]+|\\[blocked:invalid_project_root_token\\])$",
  "schema project root token pattern must match builder contract",
);
assert(schema.$defs.sidecarAllowlist.properties.sidecarSpawnAllowedNow.const === false, "schema must pin sidecar spawn disabled");
assert(schema.$defs.sidecarAllowlist.properties.requestedCommandExecutableNow.const === false, "schema must pin requested command non-executable");
assert(schema.$defs.credentialVaultPlan.properties.readAllowedNow.const === false, "schema must pin credential read disabled");
assert(schema.$defs.credentialVaultPlan.properties.writeAllowedNow.const === false, "schema must pin credential write disabled");
assert(schema.$defs.credentialVaultPlan.properties.createApiKeyAllowedNow.const === false, "schema must pin API key creation disabled");
for (const [key, expected] of Object.entries(desktopRuntimeHardLocks)) {
  assert(schema.$defs.hardLocks.properties[key].const === expected, `schema hardLocks must pin ${key}=${expected}`);
}

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("desktop_runtime_plan.schema.json"), "schema registry must include desktop_runtime_plan.schema.json");
assert(registrySource.includes("DesktopRuntimePlan"), "schema registry must include DesktopRuntimePlan type");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert(packageJson.scripts["desktop-runtime:test"] === "node scripts/desktop-runtime-test.mjs", "package script desktop-runtime:test missing");

console.log(
  `Desktop Runtime tests passed: ${darwinPlan.tauriShellPlan.capabilities.length} tauri capabilities, ${darwinPlan.sidecarAllowlist.commands.length} sidecar entries, platform plans darwin+win32, schema hard locks pinned.`,
);
