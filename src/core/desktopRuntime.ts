export type DesktopRuntimePlatform = "darwin" | "win32" | "linux" | "unknown";
export type DesktopRuntimeMode = "desktop_plan_only" | "tauri_permission_shell_planned";
export type DesktopRuntimeGateStatus = "planned" | "disabled" | "permission_gated" | "blocked";

export interface DesktopRuntimeBuildInput {
  generatedAt?: string;
  platform?: DesktopRuntimePlatform;
  runtimeMode?: DesktopRuntimeMode;
  projectRootToken?: string;
  rawProjectRootPath?: string;
  portableProjectPaths?: string[];
  requestedSidecarCommand?: string;
  requestedCredentialAction?: "read" | "write" | "create_api_key" | "none";
}

export interface DesktopRuntimeTauriCapability {
  id: string;
  status: DesktopRuntimeGateStatus;
  permissionRequired: boolean;
  executableNow: false;
  notes: string[];
}

export interface DesktopRuntimeProjectPermissionScope {
  scopeKind: "user_selected_project_root_token";
  token: string;
  rawPathRedacted: string | null;
  rawPathPersisted: false;
  allowedRoots: ["user_selected_project_root"];
  portableContract: {
    absolutePathsAllowed: false;
    parentTraversalAllowed: false;
    shellSpecificPathsAllowed: false;
  };
  blockedReasons: string[];
  notes: string[];
}

export interface DesktopRuntimePathResolverPlan {
  mode: "platform_aware_project_root_resolver";
  selectedPlatform: DesktopRuntimePlatform;
  resolvers: Array<{
    id: string;
    platform: "darwin" | "win32" | "all";
    pathStyle: "posix" | "win32" | "project-root-relative";
    status: "planned";
    persistedInProjectFiles: boolean;
    notes: string[];
  }>;
  portablePaths: Array<{
    path: string;
    status: "accepted" | "blocked";
    redacted: boolean;
    reason?: string;
  }>;
  hardcodedAbsolutePathPersistenceAllowed: false;
  notes: string[];
}

export interface DesktopRuntimeSidecarCommand {
  id: string;
  executable: "codex" | "ffmpeg" | "ffprobe" | "provider-cli";
  status: "planned" | "disabled";
  argumentSource: "validated_envelope_only";
  userFreeTextShellAllowed: false;
  liveSubmitAllowed: false;
  notes: string[];
}

export interface DesktopRuntimeSidecarPlan {
  mode: "controlled_sidecar_allowlist";
  status: "disabled";
  sidecarSpawnAllowedNow: false;
  arbitraryShell: "forbidden";
  commands: DesktopRuntimeSidecarCommand[];
  requestedCommandStatus: "not_requested" | "planned_allowlisted" | "blocked";
  requestedCommandExecutableNow: false;
  blockedReasons: string[];
  notes: string[];
}

export interface DesktopRuntimeCredentialVaultPlan {
  mode: "planned_placeholder";
  plannedStores: Array<"macos_keychain" | "windows_credential_manager" | "encrypted_local_fallback">;
  readAllowedNow: false;
  writeAllowedNow: false;
  createApiKeyAllowedNow: false;
  requestedActionStatus: "not_requested" | "blocked";
  blockedReasons: string[];
  notes: string[];
}

export interface DesktopRuntimeHardLocks {
  noFileMutation: true;
  noDirectoryCreate: true;
  noUserFileMove: true;
  noProviderSubmit: true;
  noCredentialRead: true;
  noCredentialWrite: true;
  noArbitraryShell: true;
  noSidecarSpawn: true;
  noInstall: true;
  noDownload: true;
  liveSubmitAllowed: false;
}

export interface DesktopRuntimeValidation {
  ok: boolean;
  checkedAt: string;
  errors: string[];
  warnings: string[];
}

export interface DesktopRuntimePlanItem {
  id: string;
  status: "ok" | "planned" | "needed" | "blocked";
  detail: string;
  action: string;
}

export interface DesktopRuntimePlan {
  schemaVersion: "0.1.0";
  phase: "phase_15_desktop_runtime_permission_shell";
  generatedAt: string;
  platform: DesktopRuntimePlatform;
  runtimeMode: DesktopRuntimeMode;
  tauriShellPlan: {
    mode: "tauri_shell_permission_plan";
    capabilities: DesktopRuntimeTauriCapability[];
    notes: string[];
  };
  projectPermissionScope: DesktopRuntimeProjectPermissionScope;
  pathResolverPlan: DesktopRuntimePathResolverPlan;
  sidecarAllowlist: DesktopRuntimeSidecarPlan;
  credentialVaultPlan: DesktopRuntimeCredentialVaultPlan;
  migrationPlan: DesktopRuntimePlanItem[];
  repairPlan: DesktopRuntimePlanItem[];
  validation: DesktopRuntimeValidation;
  hardLocks: DesktopRuntimeHardLocks;
  safetySummary: string[];
}

const schemaVersion = "0.1.0";
const defaultGeneratedAt = "1970-01-01T00:00:00.000Z";
const defaultProjectRootToken = "user_selected_project_root:unbound";
const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|[\\/]{1,2}|~(?:[\\/]|$))/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;

export const desktopRuntimeHardLocks: DesktopRuntimeHardLocks = {
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
};

function normalizeSlashes(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
}

function isAbsoluteLike(value: string): boolean {
  return absolutePathPattern.test(value.trim());
}

function hasParentTraversal(value: string): boolean {
  return parentTraversalPattern.test(normalizeSlashes(value));
}

function isUserSelectedRootToken(value: string): boolean {
  return /^user_selected_project_root:[A-Za-z0-9_-]+$/.test(value.trim());
}

function redactedPath(rawPath: string | undefined): string | null {
  return rawPath ? "[redacted:user_selected_project_root]" : null;
}

function tauriCapabilities(): DesktopRuntimeTauriCapability[] {
  return [
    {
      id: "window",
      status: "planned",
      permissionRequired: true,
      executableNow: false,
      notes: ["Desktop window lifecycle is a future Tauri shell concern; Phase 15 only records the contract."],
    },
    {
      id: "file_dialog",
      status: "permission_gated",
      permissionRequired: true,
      executableNow: false,
      notes: ["File dialog may mint a user-selected project root token later; raw paths must stay outside portable project facts."],
    },
    {
      id: "filesystem_watch",
      status: "permission_gated",
      permissionRequired: true,
      executableNow: false,
      notes: ["Filesystem watch is scoped to the selected project root token and remains disabled in Phase 15."],
    },
    {
      id: "sidecar_start_stop",
      status: "disabled",
      permissionRequired: true,
      executableNow: false,
      notes: ["Sidecar process start/stop is explicitly disabled until controlled command envelopes exist."],
    },
    {
      id: "keychain_commands",
      status: "disabled",
      permissionRequired: true,
      executableNow: false,
      notes: ["Credential vault commands are placeholders only; no credential read/write is allowed."],
    },
  ];
}

function validateProjectScope(input: DesktopRuntimeBuildInput): {
  scope: DesktopRuntimeProjectPermissionScope;
  errors: string[];
  warnings: string[];
} {
  const token = input.projectRootToken || defaultProjectRootToken;
  const errors: string[] = [];
  const warnings: string[] = [];
  const blockedReasons: string[] = [];

  if (!isUserSelectedRootToken(token)) {
    const reason = "Project root must be represented as a user-selected project root token, not a raw path.";
    errors.push(reason);
    blockedReasons.push(reason);
  }
  if (isAbsoluteLike(token)) {
    const reason = "Project root token must not be an absolute platform path in the portable contract.";
    errors.push(reason);
    blockedReasons.push(reason);
  }
  if (hasParentTraversal(token)) {
    const reason = "Project root token must not contain parent traversal.";
    errors.push(reason);
    blockedReasons.push(reason);
  }
  if (input.rawProjectRootPath) {
    warnings.push("Raw project root path was supplied and redacted; it must not be persisted in project facts.");
  }

  return {
    scope: {
      scopeKind: "user_selected_project_root_token",
      token: isUserSelectedRootToken(token) ? token : "[blocked:invalid_project_root_token]",
      rawPathRedacted: redactedPath(input.rawProjectRootPath),
      rawPathPersisted: false,
      allowedRoots: ["user_selected_project_root"],
      portableContract: {
        absolutePathsAllowed: false,
        parentTraversalAllowed: false,
        shellSpecificPathsAllowed: false,
      },
      blockedReasons,
      notes: [
        "Desktop Runtime accepts only a user-selected project root token as the portable scope authority.",
        "Absolute raw paths may exist transiently inside a permission shell, but project files must persist project-root-relative references.",
      ],
    },
    errors,
    warnings,
  };
}

function validatePortablePath(path: string): DesktopRuntimePathResolverPlan["portablePaths"][number] {
  if (isAbsoluteLike(path)) {
    return {
      path: "[blocked:absolute_path_redacted]",
      status: "blocked",
      redacted: true,
      reason: "Portable project paths must not be absolute platform paths.",
    };
  }
  if (hasParentTraversal(path)) {
    return {
      path,
      status: "blocked",
      redacted: false,
      reason: "Portable project paths must not contain parent traversal.",
    };
  }
  return {
    path: normalizeSlashes(path),
    status: "accepted",
    redacted: false,
  };
}

function buildPathResolverPlan(input: DesktopRuntimeBuildInput, platform: DesktopRuntimePlatform): DesktopRuntimePathResolverPlan {
  const portablePaths = (input.portableProjectPaths || ["project.vibe", "story_flow/story_flow.vibe.json"]).map(validatePortablePath);
  return {
    mode: "platform_aware_project_root_resolver",
    selectedPlatform: platform,
    resolvers: [
      {
        id: "darwin-posix-project-root",
        platform: "darwin",
        pathStyle: "posix",
        status: "planned",
        persistedInProjectFiles: false,
        notes: ["macOS may resolve the selected root token to a POSIX path at execution time only."],
      },
      {
        id: "win32-project-root",
        platform: "win32",
        pathStyle: "win32",
        status: "planned",
        persistedInProjectFiles: false,
        notes: ["Windows may resolve the selected root token to a Win32 path at execution time only."],
      },
      {
        id: "portable-project-root-relative",
        platform: "all",
        pathStyle: "project-root-relative",
        status: "planned",
        persistedInProjectFiles: true,
        notes: ["Project files persist project-root-relative paths, not shell-specific absolute paths."],
      },
    ],
    portablePaths,
    hardcodedAbsolutePathPersistenceAllowed: false,
    notes: [
      "Runtime path resolution is platform-aware and permission-scoped.",
      "Shell profile paths, Git Bash-only paths, and hardcoded absolute paths are not valid portable project facts.",
    ],
  };
}

function buildSidecarAllowlist(requestedCommand?: string): DesktopRuntimeSidecarPlan {
  const commands: DesktopRuntimeSidecarCommand[] = [
    {
      id: "codex-agent-task",
      executable: "codex",
      status: "planned",
      argumentSource: "validated_envelope_only",
      userFreeTextShellAllowed: false,
      liveSubmitAllowed: false,
      notes: ["Future Codex invocations must be compiled from task/subagent envelopes, never free text shell strings."],
    },
    {
      id: "ffmpeg-media-inspect",
      executable: "ffmpeg",
      status: "planned",
      argumentSource: "validated_envelope_only",
      userFreeTextShellAllowed: false,
      liveSubmitAllowed: false,
      notes: ["Future FFmpeg use is limited to controlled preview/export envelopes."],
    },
    {
      id: "ffprobe-media-metadata",
      executable: "ffprobe",
      status: "planned",
      argumentSource: "validated_envelope_only",
      userFreeTextShellAllowed: false,
      liveSubmitAllowed: false,
      notes: ["Future FFprobe use is limited to media metadata envelopes."],
    },
    {
      id: "provider-cli-placeholder",
      executable: "provider-cli",
      status: "disabled",
      argumentSource: "validated_envelope_only",
      userFreeTextShellAllowed: false,
      liveSubmitAllowed: false,
      notes: ["Provider CLI is a placeholder only; Phase 15 cannot submit provider jobs."],
    },
  ];
  const executables = new Set(commands.map((command) => command.executable));
  const requested = requestedCommand?.trim();
  const allowlisted = requested ? executables.has(requested as DesktopRuntimeSidecarCommand["executable"]) : false;
  const blockedReasons: string[] = [];
  if (requested && !allowlisted) blockedReasons.push("Requested command is not in the controlled sidecar allowlist.");
  if (requested && allowlisted) blockedReasons.push("Requested command is allowlisted for future planning but sidecar spawn is disabled in Phase 15.");

  return {
    mode: "controlled_sidecar_allowlist",
    status: "disabled",
    sidecarSpawnAllowedNow: false,
    arbitraryShell: "forbidden",
    commands,
    requestedCommandStatus: !requested ? "not_requested" : allowlisted ? "planned_allowlisted" : "blocked",
    requestedCommandExecutableNow: false,
    blockedReasons,
    notes: [
      "Arbitrary shell is always forbidden.",
      "Allowlisted requests are future command shapes only; Phase 15 never executes or spawns a sidecar.",
      "Arguments must come from validated envelopes; user free text must never be concatenated into a shell command.",
    ],
  };
}

function buildCredentialVaultPlan(action: DesktopRuntimeBuildInput["requestedCredentialAction"]): DesktopRuntimeCredentialVaultPlan {
  const requestedAction = action && action !== "none" ? action : undefined;
  return {
    mode: "planned_placeholder",
    plannedStores: ["macos_keychain", "windows_credential_manager", "encrypted_local_fallback"],
    readAllowedNow: false,
    writeAllowedNow: false,
    createApiKeyAllowedNow: false,
    requestedActionStatus: requestedAction ? "blocked" : "not_requested",
    blockedReasons: requestedAction
      ? [`Credential action "${requestedAction}" is blocked in Phase 15; vault integrations are placeholders only.`]
      : [],
    notes: [
      "macOS Keychain, Windows Credential Manager, and encrypted local fallback are future vault targets.",
      "Phase 15 cannot read, write, display, create, or infer API keys.",
    ],
  };
}

function buildMigrationPlan(validationOk: boolean): DesktopRuntimePlanItem[] {
  return [
    {
      id: "tauri_shell_contract",
      status: "planned",
      detail: "Desktop shell capabilities are recorded as planned, disabled, or permission-gated.",
      action: "Keep capabilities non-executable until a Tauri bridge can enforce permissions.",
    },
    {
      id: "project_root_token_migration",
      status: validationOk ? "ok" : "blocked",
      detail: "Project roots must migrate from raw paths to user-selected root tokens.",
      action: "Redact raw paths and persist project-root-relative references only.",
    },
    {
      id: "sidecar_envelope_migration",
      status: "planned",
      detail: "Future sidecar commands need validated task envelopes before execution is possible.",
      action: "Reject arbitrary shell and compile arguments from typed envelopes.",
    },
  ];
}

function buildRepairPlan(input: {
  scopeErrors: string[];
  blockedPortablePaths: number;
  sidecarBlockedReasons: string[];
  credentialBlockedReasons: string[];
}): DesktopRuntimePlanItem[] {
  return [
    {
      id: "invalid_project_root_scope",
      status: input.scopeErrors.length ? "blocked" : "ok",
      detail: input.scopeErrors.length ? input.scopeErrors.join(" ") : "Project root scope is represented by a user-selected token.",
      action: "Ask the permission shell to mint a user-selected project root token before future file access.",
    },
    {
      id: "blocked_portable_paths",
      status: input.blockedPortablePaths ? "blocked" : "ok",
      detail: input.blockedPortablePaths
        ? `${input.blockedPortablePaths} portable path(s) violate the path contract.`
        : "Portable paths are project-root-relative.",
      action: "Replace absolute paths or parent traversal with project-root-relative references.",
    },
    {
      id: "blocked_sidecar_request",
      status: input.sidecarBlockedReasons.length ? "blocked" : "ok",
      detail: input.sidecarBlockedReasons.length ? input.sidecarBlockedReasons.join(" ") : "No executable sidecar request is pending.",
      action: "Keep sidecar spawn disabled until a validated envelope and explicit permission gate exist.",
    },
    {
      id: "blocked_credential_request",
      status: input.credentialBlockedReasons.length ? "blocked" : "ok",
      detail: input.credentialBlockedReasons.length ? input.credentialBlockedReasons.join(" ") : "No credential read/write request is pending.",
      action: "Route future credential setup through an explicit vault UI and never create provider API keys.",
    },
  ];
}

function buildSafetySummary(validation: DesktopRuntimeValidation): string[] {
  return [
    `Desktop Runtime permission shell plan is ${validation.ok ? "valid" : "blocked"} in Phase 15.`,
    "Tauri window, dialogs, filesystem watch, sidecar start/stop, and keychain commands are planned/disabled/permission-gated only.",
    "Project access is scoped by a user-selected root token; raw absolute paths are redacted and not portable facts.",
    "Sidecar execution, arbitrary shell, installs, downloads, provider submissions, and credential reads/writes are hard-locked off.",
  ];
}

export function buildDesktopRuntimePlan(input: DesktopRuntimeBuildInput = {}): DesktopRuntimePlan {
  const generatedAt = input.generatedAt || defaultGeneratedAt;
  const platform = input.platform || "unknown";
  const runtimeMode = input.runtimeMode || "desktop_plan_only";
  const scopeResult = validateProjectScope(input);
  const pathResolverPlan = buildPathResolverPlan(input, platform);
  const sidecarAllowlist = buildSidecarAllowlist(input.requestedSidecarCommand);
  const credentialVaultPlan = buildCredentialVaultPlan(input.requestedCredentialAction);
  const pathErrors = pathResolverPlan.portablePaths
    .filter((entry) => entry.status === "blocked")
    .map((entry) => entry.reason || "Portable path rejected.");
  const errors = [...scopeResult.errors, ...pathErrors];
  const warnings = [...scopeResult.warnings];
  if (platform === "linux") warnings.push("Linux desktop runtime is not a Phase 15 primary target; keep it planned only.");

  const validation: DesktopRuntimeValidation = {
    ok: errors.length === 0,
    checkedAt: generatedAt,
    errors,
    warnings,
  };

  return {
    schemaVersion,
    phase: "phase_15_desktop_runtime_permission_shell",
    generatedAt,
    platform,
    runtimeMode,
    tauriShellPlan: {
      mode: "tauri_shell_permission_plan",
      capabilities: tauriCapabilities(),
      notes: [
        "This is a permission-shell contract, not a live Tauri integration.",
        "Every desktop capability remains non-executable from the browser/runtime plan.",
      ],
    },
    projectPermissionScope: scopeResult.scope,
    pathResolverPlan,
    sidecarAllowlist,
    credentialVaultPlan,
    migrationPlan: buildMigrationPlan(validation.ok),
    repairPlan: buildRepairPlan({
      scopeErrors: scopeResult.errors,
      blockedPortablePaths: pathResolverPlan.portablePaths.filter((entry) => entry.status === "blocked").length,
      sidecarBlockedReasons: sidecarAllowlist.blockedReasons,
      credentialBlockedReasons: credentialVaultPlan.blockedReasons,
    }),
    validation,
    hardLocks: desktopRuntimeHardLocks,
    safetySummary: buildSafetySummary(validation),
  };
}
