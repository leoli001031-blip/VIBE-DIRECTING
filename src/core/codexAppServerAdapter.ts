export const codexAppServerAdapterSchemaVersion = "0.1.0";
export const codexAppServerAdapterId = "codex-app-server-agent";
export const codexAppServerAdapterMode = "contract_readiness_adapter";

export type CodexAppServerTransport = "stdio" | "unix" | "ws" | "off";
export type CodexAppServerAdapterReadiness = "ready" | "blocked";
export type CodexAppServerMethodCategory =
  | "thread"
  | "turn"
  | "filesystem_watch"
  | "approval"
  | "tool_call";

export interface CodexAppServerAdapterCapabilities {
  canSpawnSubagents: true;
  canUseImageRuntime: true;
  contextPacketRequired: true;
  supportsThreadHandoff: true;
  supportsStructuredResult: true;
  supportsRemoteTui: true;
  generatedTypesAvailable: boolean;
  generatedSchemaAvailable: boolean;
  legacyExecFallbackAvailable: true;
}

export interface CodexAppServerAdapterTransportState {
  supportedTransports: CodexAppServerTransport[];
  defaultListen: "stdio";
  selectedTransport: "off";
  remoteTuiTransport: "ws";
  remoteTuiSupported: boolean;
  liveConnectionAllowed: false;
  appServerLaunchAllowed: false;
  longRunningServerAllowed: false;
  notes: string[];
}

export interface CodexAppServerAdapterMethodMap {
  clientRequests: Record<CodexAppServerMethodCategory, string[]>;
  serverRequests: Record<"approval" | "tool_call", string[]>;
  serverNotifications: Record<CodexAppServerMethodCategory, string[]>;
}

export interface CodexAppServerAdapterHardLocks {
  contractReadinessOnly: true;
  noSocketConnection: true;
  noLongRunningAppServer: true;
  noCredentialRead: true;
  noCredentialStorage: true;
  noApprovalBypass: true;
  noProviderSubmit: true;
  noDirectProviderSubmit: true;
  noProviderSelfReportCompletion: true;
  noTaskPacketBypass: true;
  noSidecarReplacement: true;
  noQaReplacement: true;
  remoteControlNotExecuted: true;
  liveSubmitAllowed: false;
  legacyExecPreserved: true;
}

export interface CodexAppServerAdapterFallback {
  primaryRuntime: "codex_app_server_protocol";
  legacyRuntime: "codex_exec_json";
  legacyAdapterId: "codex-cli-agent";
  legacySpikePhase: "phase_29_codex_cli_adapter_spike";
  fallbackRelationship: "explicit_legacy_exec_fallback";
  silentFallbackAllowed: false;
  fallbackConditions: string[];
  notes: string[];
}

export interface CodexAppServerAdapterProtocolEvidence {
  cliVersionObserved?: string;
  helpCommands: string[];
  generatedProtocolOutDir: "/tmp/vibe-codex-app-server-schema";
  generatedFiles: Array<"ClientRequest.ts" | "ServerRequest.ts" | "ServerNotification.ts" | "InitializeCapabilities.ts" | "schema_bundle">;
  supportedListenUrls: Array<"stdio://" | "unix://" | "unix://PATH" | "ws://IP:PORT" | "off">;
  remoteTuiCommand: "codex --remote ws://host:port";
  schemaAvailability: "generated_from_local_cli";
  source: "local_codex_cli";
}

export interface CodexAppServerAdapterBuildOptions {
  generatedAt?: string;
  cliVersionObserved?: string;
  generatedTypesAvailable?: boolean;
  generatedSchemaAvailable?: boolean;
  remoteTuiSupported?: boolean;
  supportedTransports?: CodexAppServerTransport[];
  socketConnectionAttempted?: boolean;
  longRunningServerAttempted?: boolean;
  credentialAccessAttempted?: boolean;
  credentialStorageAttempted?: boolean;
  approvalBypassAttempted?: boolean;
  providerSubmitAttempted?: boolean;
  directProviderSubmitAttempted?: boolean;
  providerSelfReportAcceptedAttempted?: boolean;
  taskPacketBypassAttempted?: boolean;
  sidecarReplacementAttempted?: boolean;
  qaReplacementAttempted?: boolean;
  remoteControlAttempted?: boolean;
  legacyExecRemovedAttempted?: boolean;
}

export interface CodexAppServerAdapterState {
  schemaVersion: typeof codexAppServerAdapterSchemaVersion;
  adapterId: typeof codexAppServerAdapterId;
  runtimeKind: "codex_app_server";
  mode: typeof codexAppServerAdapterMode;
  generatedAt: string;
  readiness: CodexAppServerAdapterReadiness;
  capabilities: CodexAppServerAdapterCapabilities;
  transport: CodexAppServerAdapterTransportState;
  methods: CodexAppServerAdapterMethodMap;
  hardLocks: CodexAppServerAdapterHardLocks;
  fallback: CodexAppServerAdapterFallback;
  protocolEvidence: CodexAppServerAdapterProtocolEvidence;
  integrationBoundary: {
    adapterPurpose: "readiness_contract_only";
    doesNotReplace: Array<"subagent_task_envelope" | "context_packet" | "sidecar_permissions" | "qa_harness" | "task_packet" | "project_runtime_state">;
    forbiddenActions: string[];
    notes: string[];
  };
  roadmapEvidence: {
    appServerProtocolReady: boolean;
    supportedTransportCoverage: boolean;
    remoteTuiSupportReady: boolean;
    generatedSchemaAvailable: boolean;
    generatedTypesAvailable: boolean;
    threadMethodCoverage: boolean;
    turnMethodCoverage: boolean;
    fsWatchCoverage: boolean;
    approvalCoverage: boolean;
    toolCallCoverage: boolean;
    legacyExecFallbackPreserved: boolean;
    hardLocksPinned: boolean;
  };
  blockers: string[];
  warnings: string[];
  validation: {
    ok: boolean;
    errors: string[];
    warnings: string[];
    checkedAt: string;
  };
  notes: string[];
}

export const codexAppServerAdapterHardLocks: CodexAppServerAdapterHardLocks = {
  contractReadinessOnly: true,
  noSocketConnection: true,
  noLongRunningAppServer: true,
  noCredentialRead: true,
  noCredentialStorage: true,
  noApprovalBypass: true,
  noProviderSubmit: true,
  noDirectProviderSubmit: true,
  noProviderSelfReportCompletion: true,
  noTaskPacketBypass: true,
  noSidecarReplacement: true,
  noQaReplacement: true,
  remoteControlNotExecuted: true,
  liveSubmitAllowed: false,
  legacyExecPreserved: true,
};

const defaultGeneratedAt = "1970-01-01T00:00:00.000Z";
const requiredTransports: CodexAppServerTransport[] = ["stdio", "unix", "ws", "off"];

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function hardLockDrift(hardLocks: CodexAppServerAdapterHardLocks): string[] {
  const actualRecord = hardLocks as unknown as Record<string, boolean>;
  const expectedRecord = codexAppServerAdapterHardLocks as unknown as Record<string, boolean>;

  return Object.entries(expectedRecord).flatMap(([key, expectedValue]) =>
    actualRecord[key] === expectedValue ? [] : [`codex_app_server_hard_lock_drift:${key}`],
  );
}

export function buildCodexAppServerAdapterState(
  options: CodexAppServerAdapterBuildOptions = {},
): CodexAppServerAdapterState {
  const generatedAt = options.generatedAt || defaultGeneratedAt;
  const generatedTypesAvailable = options.generatedTypesAvailable !== false;
  const generatedSchemaAvailable = options.generatedSchemaAvailable !== false;
  const remoteTuiSupported = options.remoteTuiSupported !== false;
  const supportedTransports = uniqueSorted(options.supportedTransports || requiredTransports) as CodexAppServerTransport[];
  const transportCoverage = requiredTransports.every((transport) => supportedTransports.includes(transport));
  const hardLocks = codexAppServerAdapterHardLocks;
  const lockDrift = hardLockDrift(hardLocks);

  const blockers = uniqueSorted([
    ...(generatedTypesAvailable ? [] : ["generated_types_unavailable"]),
    ...(generatedSchemaAvailable ? [] : ["generated_schema_unavailable"]),
    ...(remoteTuiSupported ? [] : ["remote_tui_support_unavailable"]),
    ...(transportCoverage ? [] : ["supported_transport_coverage_incomplete"]),
    ...lockDrift,
    ...(options.socketConnectionAttempted ? ["socket_connection_attempt_blocked"] : []),
    ...(options.longRunningServerAttempted ? ["long_running_app_server_attempt_blocked"] : []),
    ...(options.credentialAccessAttempted ? ["credential_access_attempt_blocked"] : []),
    ...(options.credentialStorageAttempted ? ["credential_storage_attempt_blocked"] : []),
    ...(options.approvalBypassAttempted ? ["approval_bypass_attempt_blocked"] : []),
    ...(options.providerSubmitAttempted ? ["provider_submit_attempt_blocked"] : []),
    ...(options.directProviderSubmitAttempted ? ["direct_provider_submit_attempt_blocked"] : []),
    ...(options.providerSelfReportAcceptedAttempted ? ["provider_self_report_completion_attempt_blocked"] : []),
    ...(options.taskPacketBypassAttempted ? ["task_packet_bypass_attempt_blocked"] : []),
    ...(options.sidecarReplacementAttempted ? ["sidecar_replacement_attempt_blocked"] : []),
    ...(options.qaReplacementAttempted ? ["qa_replacement_attempt_blocked"] : []),
    ...(options.remoteControlAttempted ? ["remote_control_attempt_blocked"] : []),
    ...(options.legacyExecRemovedAttempted ? ["legacy_exec_fallback_removed_attempt_blocked"] : []),
  ]);
  const readiness: CodexAppServerAdapterReadiness = blockers.length ? "blocked" : "ready";

  const methods: CodexAppServerAdapterMethodMap = {
    clientRequests: {
      thread: [
        "thread/start",
        "thread/resume",
        "thread/fork",
        "thread/list",
        "thread/read",
        "thread/turns/list",
        "thread/unsubscribe",
        "thread/compact/start",
      ],
      turn: ["turn/start", "turn/steer", "turn/interrupt"],
      filesystem_watch: ["fs/watch", "fs/unwatch"],
      approval: ["thread/approveGuardianDeniedAction"],
      tool_call: ["mcpServer/tool/call"],
    },
    serverRequests: {
      approval: [
        "item/commandExecution/requestApproval",
        "item/fileChange/requestApproval",
        "item/permissions/requestApproval",
        "applyPatchApproval",
        "execCommandApproval",
      ],
      tool_call: ["item/tool/call", "item/tool/requestUserInput", "mcpServer/elicitation/request"],
    },
    serverNotifications: {
      thread: [
        "thread/started",
        "thread/status/changed",
        "thread/name/updated",
        "thread/goal/updated",
        "thread/tokenUsage/updated",
        "thread/compacted",
        "remoteControl/status/changed",
      ],
      turn: ["turn/started", "turn/completed", "turn/diff/updated", "turn/plan/updated"],
      filesystem_watch: ["fs/changed"],
      approval: ["item/autoApprovalReview/started", "item/autoApprovalReview/completed", "serverRequest/resolved", "guardianWarning"],
      tool_call: [
        "item/started",
        "item/completed",
        "item/mcpToolCall/progress",
        "command/exec/outputDelta",
        "item/commandExecution/outputDelta",
        "item/fileChange/outputDelta",
        "item/fileChange/patchUpdated",
      ],
    },
  };

  return {
    schemaVersion: codexAppServerAdapterSchemaVersion,
    adapterId: codexAppServerAdapterId,
    runtimeKind: "codex_app_server",
    mode: codexAppServerAdapterMode,
    generatedAt,
    readiness,
    capabilities: {
      canSpawnSubagents: true,
      canUseImageRuntime: true,
      contextPacketRequired: true,
      supportsThreadHandoff: true,
      supportsStructuredResult: true,
      supportsRemoteTui: true,
      generatedTypesAvailable,
      generatedSchemaAvailable,
      legacyExecFallbackAvailable: true,
    },
    transport: {
      supportedTransports,
      defaultListen: "stdio",
      selectedTransport: "off",
      remoteTuiTransport: "ws",
      remoteTuiSupported,
      liveConnectionAllowed: false,
      appServerLaunchAllowed: false,
      longRunningServerAllowed: false,
      notes: [
        "Supported listen values come from local codex app-server help.",
        "The adapter selects off because this module is readiness-only and must not open sockets.",
      ],
    },
    methods,
    hardLocks,
    fallback: {
      primaryRuntime: "codex_app_server_protocol",
      legacyRuntime: "codex_exec_json",
      legacyAdapterId: "codex-cli-agent",
      legacySpikePhase: "phase_29_codex_cli_adapter_spike",
      fallbackRelationship: "explicit_legacy_exec_fallback",
      silentFallbackAllowed: false,
      fallbackConditions: [
        "app-server protocol unavailable",
        "generated protocol schema unavailable",
        "app-server integration disabled by runtime gate",
      ],
      notes: ["Legacy codex exec --json stays available as an explicit fallback path; this adapter does not delete or replace it."],
    },
    protocolEvidence: {
      cliVersionObserved: options.cliVersionObserved,
      helpCommands: [
        "codex app-server --help",
        "codex app-server generate-ts --help",
        "codex app-server generate-json-schema --help",
        "codex --help",
      ],
      generatedProtocolOutDir: "/tmp/vibe-codex-app-server-schema",
      generatedFiles: ["ClientRequest.ts", "ServerRequest.ts", "ServerNotification.ts", "InitializeCapabilities.ts", "schema_bundle"],
      supportedListenUrls: ["stdio://", "unix://", "unix://PATH", "ws://IP:PORT", "off"],
      remoteTuiCommand: "codex --remote ws://host:port",
      schemaAvailability: "generated_from_local_cli",
      source: "local_codex_cli",
    },
    integrationBoundary: {
      adapterPurpose: "readiness_contract_only",
      doesNotReplace: [
        "subagent_task_envelope",
        "context_packet",
        "sidecar_permissions",
        "qa_harness",
        "task_packet",
        "project_runtime_state",
      ],
      forbiddenActions: [
        "credential_read",
        "credential_storage",
        "approval_bypass",
        "direct_provider_submit",
        "provider_self_report_as_completion",
        "socket_connection",
        "long_running_app_server",
        "task_packet_bypass",
        "sidecar_replacement",
        "qa_replacement",
      ],
      notes: ["This adapter records protocol readiness only; task packets, sidecar gates, watcher facts, and QA remain separate authorities."],
    },
    roadmapEvidence: {
      appServerProtocolReady: readiness === "ready",
      supportedTransportCoverage: transportCoverage,
      remoteTuiSupportReady: remoteTuiSupported,
      generatedSchemaAvailable,
      generatedTypesAvailable,
      threadMethodCoverage: methods.clientRequests.thread.length > 0 && methods.serverNotifications.thread.length > 0,
      turnMethodCoverage: methods.clientRequests.turn.length > 0 && methods.serverNotifications.turn.length > 0,
      fsWatchCoverage: methods.clientRequests.filesystem_watch.includes("fs/watch") && methods.serverNotifications.filesystem_watch.includes("fs/changed"),
      approvalCoverage: methods.serverRequests.approval.length > 0 && methods.serverNotifications.approval.length > 0,
      toolCallCoverage: methods.serverRequests.tool_call.length > 0 && methods.serverNotifications.tool_call.length > 0,
      legacyExecFallbackPreserved: true,
      hardLocksPinned: lockDrift.length === 0,
    },
    blockers,
    warnings: [],
    validation: {
      ok: blockers.length === 0,
      errors: blockers,
      warnings: [],
      checkedAt: generatedAt,
    },
    notes: [
      "Codex app-server is modeled as a future Agent runtime protocol adapter.",
      "No socket connection, long-running server, remote control, provider submit, or credential route is opened by this module.",
      "Legacy codex exec --json remains the explicit fallback adapter path.",
    ],
  };
}

export function validateCodexAppServerAdapterHardLocks(hardLocks: CodexAppServerAdapterHardLocks): string[] {
  return hardLockDrift(hardLocks);
}
