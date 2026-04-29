import type {
  AdapterContractState,
  CheckpointResumeHarnessState,
  FilesystemWatcherHarnessState,
  GenerationHarnessState,
  ProjectRuntimeEnvironment,
  QaHarnessState,
  RuntimePlatform,
  ToolDetectionItem,
  ToolRuntimeHarnessCategory,
  ToolRuntimeHarnessCheckRow,
  ToolRuntimeHarnessHardLocks,
  ToolRuntimeHarnessPathPolicy,
  ToolRuntimeHarnessPathStatus,
  ToolRuntimeHarnessPlatformSupport,
  ToolRuntimeHarnessSourceCoverageEntry,
  ToolRuntimeHarnessSourceLayer,
  ToolRuntimeHarnessState,
  ToolRuntimeHarnessStatus,
} from "./types";

export interface BuildToolRuntimeHarnessInput {
  generatedAt: string;
  runtime: ProjectRuntimeEnvironment;
  adapterContracts: AdapterContractState;
  generationHarness: GenerationHarnessState;
  filesystemWatcherHarness: FilesystemWatcherHarnessState;
  checkpointResumeHarness: CheckpointResumeHarnessState;
  qaHarness: QaHarnessState;
}

export const toolRuntimeHarnessCategories: ToolRuntimeHarnessCategory[] = [
  "agent_cli",
  "node_runtime",
  "rust_runtime_or_app_shell",
  "media_binary",
  "image_tool",
  "python_optional",
  "provider_cli_optional",
  "vcs_optional",
  "package_manager",
];

export const toolRuntimeHarnessSourceLayers: ToolRuntimeHarnessSourceLayer[] = [
  "runtime.config",
  "runtime.detectionReport",
  "runtime.providerEnablementSummary",
  "adapterContracts",
  "generationHarness",
  "filesystemWatcherHarness",
  "checkpointResumeHarness",
  "qaHarness",
];

export const toolRuntimeHarnessHardLocks: ToolRuntimeHarnessHardLocks = {
  dryRunOnly: true,
  diagnosticsOnly: true,
  noInstall: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noSystemSettingsMutation: true,
  arbitraryShellExecutionBlocked: true,
  sidecarDaemonDisabled: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
  platformPathAbstractionRequired: true,
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function detectionStatusToHarness(status?: ToolDetectionItem["status"]): ToolRuntimeHarnessStatus {
  if (status === "available") return "ready";
  if (status === "missing") return "missing";
  if (status === "planned") return "planned";
  if (status === "blocked") return "blocked";
  return "unknown";
}

function detectionPathStatus(tool?: ToolDetectionItem): ToolRuntimeHarnessPathStatus {
  if (!tool) return "missing";
  if (tool.status === "available" && tool.path) return "path";
  if (tool.status === "missing") return "missing";
  if (tool.status === "planned") return "planned";
  if (tool.status === "blocked") return "blocked";
  return "unknown";
}

function defaultPlatformSupport(notes: string[] = []): ToolRuntimeHarnessPlatformSupport {
  return {
    darwin: "supported",
    win32: "supported",
    linux: "planned",
    pathStyles: ["posix", "win32", "project-root-relative"],
    notes: uniqueSorted([
      "Darwin uses POSIX paths through RuntimeConfig.",
      "Windows uses Win32 paths through RuntimeConfig.",
      "Project artifacts should prefer project-root-relative schema references.",
      ...notes,
    ]),
  };
}

function findTool(tools: ToolDetectionItem[], ids: string[]): ToolDetectionItem | undefined {
  return ids.map((id) => tools.find((tool) => tool.id === id)).find(Boolean);
}

function detectionSourceRef(tool: ToolDetectionItem | undefined, fallbackId: string): string {
  return tool ? `runtime.detectionReport:tool:${tool.id}:${tool.status}` : `runtime.detectionReport:tool:${fallbackId}:not_present`;
}

function missingBlockers(label: string, status: ToolRuntimeHarnessStatus, missingIsBlocker: boolean): string[] {
  if (!missingIsBlocker) return [];
  if (status === "missing") return [`${label} is required by current runtime diagnostics but was not detected.`];
  if (status === "blocked") return [`${label} detection is blocked.`];
  if (status === "unknown") return [`${label} detection status is unknown.`];
  return [];
}

function optionalWarnings(label: string, status: ToolRuntimeHarnessStatus, missingIsBlocker: boolean): string[] {
  if (missingIsBlocker) return [];
  if (status === "missing") return [`Optional ${label} is not detected; future workflows must stay disabled or use a configured replacement.`];
  if (status === "unknown") return [`Optional ${label} detection is unknown; do not assume it is available.`];
  if (status === "planned") return [`${label} detection is planned and cannot be used as an available runtime fact.`];
  return [];
}

function detectedCheck(input: {
  checkId: string;
  category: ToolRuntimeHarnessCategory;
  label: string;
  toolIds: string[];
  tools: ToolDetectionItem[];
  requiredFor: string[];
  missingIsBlocker: boolean;
  sourceRefs?: string[];
  notes?: string[];
}): ToolRuntimeHarnessCheckRow {
  const tool = findTool(input.tools, input.toolIds);
  const status = detectionStatusToHarness(tool?.status);
  const requiredFor = uniqueSorted(tool?.requiredFor?.length ? tool.requiredFor : input.requiredFor);
  const blockers = missingBlockers(input.label, status, input.missingIsBlocker);
  const warnings = optionalWarnings(input.label, status, input.missingIsBlocker);

  return {
    checkId: input.checkId,
    category: input.category,
    label: tool?.label || input.label,
    requiredFor,
    status,
    pathStatus: detectionPathStatus(tool),
    path: tool?.path,
    version: tool?.version,
    platformSupport: defaultPlatformSupport(),
    canExecuteNow: false,
    executionMode: "diagnostic_only",
    missingIsBlocker: input.missingIsBlocker,
    blockers,
    warnings,
    sourceRefs: uniqueSorted([
      detectionSourceRef(tool, input.checkId),
      `runtime.config:toolPaths`,
      ...(input.sourceRefs || []),
    ]),
    notes: uniqueSorted([
      ...(tool?.notes || []),
      ...(input.notes || []),
      "8.8 records fact diagnostics only; this row never grants execution permission.",
    ]),
  };
}

function syntheticCheck(input: {
  checkId: string;
  category: ToolRuntimeHarnessCategory;
  label: string;
  requiredFor: string[];
  status: ToolRuntimeHarnessStatus;
  pathStatus: ToolRuntimeHarnessPathStatus;
  path?: string;
  version?: string;
  missingIsBlocker: boolean;
  sourceRefs: string[];
  notes: string[];
  platformSupportNotes?: string[];
}): ToolRuntimeHarnessCheckRow {
  const blockers = missingBlockers(input.label, input.status, input.missingIsBlocker);
  const warnings = optionalWarnings(input.label, input.status, input.missingIsBlocker);

  return {
    checkId: input.checkId,
    category: input.category,
    label: input.label,
    requiredFor: uniqueSorted(input.requiredFor),
    status: input.status,
    pathStatus: input.pathStatus,
    path: input.path,
    version: input.version,
    platformSupport: defaultPlatformSupport(input.platformSupportNotes),
    canExecuteNow: false,
    executionMode: "diagnostic_only",
    missingIsBlocker: input.missingIsBlocker,
    blockers,
    warnings,
    sourceRefs: uniqueSorted(input.sourceRefs),
    notes: uniqueSorted(input.notes),
  };
}

function buildPathPolicy(runtime: ProjectRuntimeEnvironment): ToolRuntimeHarnessPathPolicy {
  const pathRuleRefs = runtime.config.pathRules.map((rule) => `runtime.config:pathRules:${rule.id}`);
  const baseRefs = [
    "runtime.config:projectRootPolicy:project_root_relative",
    "runtime.config:projectRootPolicy:macPathStyle:posix",
    "runtime.config:projectRootPolicy:windowsPathStyle:win32",
    ...pathRuleRefs,
  ];

  return {
    platformPathAbstractionRequired: true,
    projectRootRelativeRequired: true,
    hardcodedShellPathForbidden: true,
    shellProfilePathLookupForbidden: true,
    pathResolverRequired: true,
    policies: [
      {
        policyId: "darwin-posix-runtime-config",
        platform: "darwin",
        pathStyle: "posix",
        required: true,
        sourceRefs: uniqueSorted([
          "runtime.config:projectRootPolicy:macPathStyle:posix",
          "runtime.config:pathRules:mac-posix-project-root",
        ]),
        notes: ["macOS paths must be resolved through runtime config, not shell profile assumptions."],
      },
      {
        policyId: "win32-runtime-config",
        platform: "win32",
        pathStyle: "win32",
        required: true,
        sourceRefs: uniqueSorted([
          "runtime.config:projectRootPolicy:windowsPathStyle:win32",
          "runtime.config:pathRules:windows-win32-project-root",
        ]),
        notes: ["Windows paths must use Win32 resolver semantics, not Git Bash or POSIX-only paths."],
      },
      {
        policyId: "project-root-relative-schema-paths",
        platform: "all",
        pathStyle: "project-root-relative",
        required: true,
        sourceRefs: uniqueSorted([
          "runtime.config:projectRootPolicy:project_root_relative",
          "runtime.config:pathRules:portable-project-relative",
        ]),
        notes: ["Schemas and manifests should prefer project-root-relative artifact references."],
      },
    ],
    sourceRefs: uniqueSorted(baseRefs),
    notes: [
      "Tool paths must come from RuntimeConfig or ToolDetectionReport facts.",
      "Hardcoded shell-only paths and shell profile lookups are not valid runtime configuration.",
    ],
  };
}

function sourceCoverage(refsByLayer: Partial<Record<ToolRuntimeHarnessSourceLayer, string[]>>): ToolRuntimeHarnessSourceCoverageEntry[] {
  return toolRuntimeHarnessSourceLayers.map((layer) => {
    const sourceRefs = uniqueSorted(refsByLayer[layer] || []);
    return {
      layer,
      referenced: sourceRefs.length > 0,
      referenceCount: sourceRefs.length,
      sourceRefs,
      notes: sourceRefs.length ? [`Referenced ${sourceRefs.length} ${layer} fact(s).`] : [`No ${layer} fact was linked.`],
    };
  });
}

function buildCoverageRefs(input: BuildToolRuntimeHarnessInput, checks: ToolRuntimeHarnessCheckRow[]): Partial<Record<ToolRuntimeHarnessSourceLayer, string[]>> {
  return {
    "runtime.config": uniqueSorted([
      `runtime.config:schemaVersion:${input.runtime.config.schemaVersion}`,
      `runtime.config:runtimeMode:${input.runtime.config.runtimeMode}`,
      `runtime.config:platform:${input.runtime.config.platform}`,
      `runtime.config:sidecarPermissions:arbitraryShellExecution:${input.runtime.config.sidecarPermissions.arbitraryShellExecution}`,
      ...input.runtime.config.pathRules.map((rule) => `runtime.config:pathRules:${rule.id}`),
      ...checks.flatMap((check) => check.sourceRefs.filter((ref) => ref.startsWith("runtime.config:"))),
    ]),
    "runtime.detectionReport": uniqueSorted([
      `runtime.detectionReport:generatedAt:${input.runtime.detectionReport.generatedAt}`,
      ...input.runtime.detectionReport.tools.map((tool) => `runtime.detectionReport:tool:${tool.id}:${tool.status}`),
      ...checks.flatMap((check) => check.sourceRefs.filter((ref) => ref.startsWith("runtime.detectionReport:"))),
    ]),
    "runtime.providerEnablementSummary": [
      `runtime.providerEnablementSummary:liveSubmitAllowed:${input.runtime.providerEnablementSummary.liveSubmitAllowed}`,
      `runtime.providerEnablementSummary:activeImageSlots:${input.runtime.providerEnablementSummary.activeImageSlots}`,
      `runtime.providerEnablementSummary:parkedVideoSlots:${input.runtime.providerEnablementSummary.parkedVideoSlots}`,
      `runtime.providerEnablementSummary:plannedAudioSlots:${input.runtime.providerEnablementSummary.plannedAudioSlots}`,
    ],
    adapterContracts: [
      `adapterContracts:schemaVersion:${input.adapterContracts.schemaVersion}`,
      `adapterContracts:agentAdapters:${input.adapterContracts.summary.agentAdapters.join(",")}`,
      `adapterContracts:providerAdapters:${input.adapterContracts.summary.providerAdapters.join(",")}`,
      `adapterContracts:liveSubmitAllowed:${input.adapterContracts.summary.liveSubmitAllowed}`,
    ],
    generationHarness: [
      `generationHarness:schemaVersion:${input.generationHarness.schemaVersion}`,
      `generationHarness:jobs:${input.generationHarness.summary.total}`,
      `generationHarness:liveSubmitAllowed:${input.generationHarness.liveSubmitAllowed}`,
    ],
    filesystemWatcherHarness: [
      `filesystemWatcherHarness:schemaVersion:${input.filesystemWatcherHarness.schemaVersion}`,
      `filesystemWatcherHarness:daemonStarted:${input.filesystemWatcherHarness.daemonStarted}`,
      `filesystemWatcherHarness:streams:${input.filesystemWatcherHarness.summary.totalStreams}`,
    ],
    checkpointResumeHarness: [
      `checkpointResumeHarness:schemaVersion:${input.checkpointResumeHarness.schemaVersion}`,
      `checkpointResumeHarness:items:${input.checkpointResumeHarness.summary.totalItems}`,
      `checkpointResumeHarness:dryRunOnly:${input.checkpointResumeHarness.dryRunOnly}`,
    ],
    qaHarness: [
      `qaHarness:schemaVersion:${input.qaHarness.schemaVersion}`,
      `qaHarness:overallStatus:${input.qaHarness.summary.overallStatus}`,
      `qaHarness:items:${input.qaHarness.summary.totalItems}`,
    ],
  };
}

function runtimePlatform(runtime: ProjectRuntimeEnvironment): RuntimePlatform {
  return runtime.config.platform || runtime.detectionReport.platform || "unknown";
}

export function buildToolRuntimeHarnessState(input: BuildToolRuntimeHarnessInput): ToolRuntimeHarnessState {
  const tools = input.runtime.detectionReport.tools || [];
  const imageTool = findTool(tools, ["magick", "imagemagick", "sips"]);
  const pythonTool = findTool(tools, ["python", "python3"]);
  const checks: ToolRuntimeHarnessCheckRow[] = [
    detectedCheck({
      checkId: "codex-cli",
      category: "agent_cli",
      label: "Codex CLI",
      toolIds: ["codex"],
      tools,
      requiredFor: ["agent task sidecar", "adapter contract diagnostics"],
      missingIsBlocker: true,
      sourceRefs: ["adapterContracts:agentAdapters:codex-cli-agent"],
      notes: ["Codex may be the default agent adapter, but 8.8 does not start a Codex session."],
    }),
    detectedCheck({
      checkId: "node-runtime",
      category: "node_runtime",
      label: "Node.js",
      toolIds: ["node"],
      tools,
      requiredFor: ["TypeScript/Node core", "import runtime test"],
      missingIsBlocker: true,
      notes: ["Node is required for local development scripts and runtime-state import diagnostics."],
    }),
    syntheticCheck({
      checkId: "rust-runtime-or-app-shell",
      category: "rust_runtime_or_app_shell",
      label: "Rust Runtime / App Shell",
      requiredFor: ["Tauri desktop runtime/app version diagnostics"],
      status: "planned",
      pathStatus: "planned",
      missingIsBlocker: false,
      sourceRefs: [
        `runtime.config:runtimeMode:${input.runtime.config.runtimeMode}`,
        `runtime.config:platform:${input.runtime.config.platform}`,
      ],
      notes: ["Rust/Tauri app shell detection is planned; browser_dev cannot claim a runtime version."],
      platformSupportNotes: ["Rust/Tauri support is planned for desktop builds."],
    }),
    detectedCheck({
      checkId: "ffmpeg",
      category: "media_binary",
      label: "FFmpeg",
      toolIds: ["ffmpeg"],
      tools,
      requiredFor: ["preview/export health checks"],
      missingIsBlocker: true,
      notes: ["FFmpeg detection is a version/path diagnostic only."],
    }),
    detectedCheck({
      checkId: "ffprobe",
      category: "media_binary",
      label: "FFprobe",
      toolIds: ["ffprobe"],
      tools,
      requiredFor: ["media metadata checks"],
      missingIsBlocker: true,
      notes: ["FFprobe detection is a version/path diagnostic only."],
    }),
    syntheticCheck({
      checkId: "imagemagick-or-system-image-tool",
      category: "image_tool",
      label: "ImageMagick or System Image Tool",
      requiredFor: ["image dimension/format diagnostics", "future thumbnail and still-image inspection"],
      status: imageTool ? detectionStatusToHarness(imageTool.status) : "planned",
      pathStatus: imageTool ? detectionPathStatus(imageTool) : "planned",
      path: imageTool?.path,
      version: imageTool?.version,
      missingIsBlocker: false,
      sourceRefs: [
        detectionSourceRef(imageTool, "imagemagick-or-system-image-tool"),
        "generationHarness:postprocessPolicy:metadata_probe",
      ],
      notes: [
        "ImageMagick/magick/sips detection is not yet part of the import detection report.",
        "Do not infer image-tool availability from Image2 provider settings.",
      ],
    }),
    syntheticCheck({
      checkId: "python-optional",
      category: "python_optional",
      label: "Python Optional Runtime",
      requiredFor: ["optional document/media helper scripts"],
      status: pythonTool ? detectionStatusToHarness(pythonTool.status) : "missing",
      pathStatus: pythonTool ? detectionPathStatus(pythonTool) : "missing",
      path: pythonTool?.path,
      version: pythonTool?.version,
      missingIsBlocker: false,
      sourceRefs: [detectionSourceRef(pythonTool, "python-optional")],
      notes: ["Python is optional for this harness and missing Python must not block runtime-state generation."],
    }),
    detectedCheck({
      checkId: "provider-cli-optional",
      category: "provider_cli_optional",
      label: "Provider CLI Optional",
      toolIds: ["image2-runtime", "provider-cli", "seedance-cli", "jimeng-cli", "dreamina-cli"],
      tools,
      requiredFor: ["optional provider adapter diagnostics"],
      missingIsBlocker: false,
      sourceRefs: [
        `runtime.providerEnablementSummary:liveSubmitAllowed:${input.runtime.providerEnablementSummary.liveSubmitAllowed}`,
        "adapterContracts:providerAdapters",
      ],
      notes: ["Provider CLI presence never allows live provider submission in 8.8."],
    }),
    detectedCheck({
      checkId: "git-vcs-optional",
      category: "vcs_optional",
      label: "Git",
      toolIds: ["git"],
      tools,
      requiredFor: ["diagnostics"],
      missingIsBlocker: false,
      notes: ["Git is optional and used only as a local diagnostic helper."],
    }),
    detectedCheck({
      checkId: "npm-package-manager",
      category: "package_manager",
      label: "npm",
      toolIds: ["npm"],
      tools,
      requiredFor: ["development scripts"],
      missingIsBlocker: true,
      notes: ["Package-manager detection is diagnostics only; 8.8 never runs install."],
    }),
  ].sort((left, right) => {
    const categoryOrder = toolRuntimeHarnessCategories.indexOf(left.category) - toolRuntimeHarnessCategories.indexOf(right.category);
    return categoryOrder || left.checkId.localeCompare(right.checkId);
  });

  const pathPolicy = buildPathPolicy(input.runtime);
  const coverage = sourceCoverage(buildCoverageRefs(input, checks));

  return {
    schemaVersion: "0.1.0",
    generatedAt: input.generatedAt,
    toolCategories: toolRuntimeHarnessCategories,
    checks,
    summary: {
      totalChecks: checks.length,
      ready: checks.filter((check) => check.status === "ready").length,
      missing: checks.filter((check) => check.status === "missing").length,
      planned: checks.filter((check) => check.status === "planned").length,
      blocked: checks.filter((check) => check.status === "blocked").length,
      unknown: checks.filter((check) => check.status === "unknown").length,
      missingBlockers: checks.filter(
        (check) => check.missingIsBlocker && ["missing", "blocked", "unknown"].includes(check.status),
      ).length,
      optionalMissing: checks.filter((check) => !check.missingIsBlocker && check.status === "missing").length,
      blockerCount: checks.reduce((total, check) => total + check.blockers.length, 0),
      warningCount: checks.reduce((total, check) => total + check.warnings.length, 0),
      dryRunOnly: true,
      diagnosticsOnly: true,
      canExecuteNow: false,
      liveSubmitAllowed: false,
      providerSubmissionForbidden: true,
      arbitraryShellExecutionBlocked: true,
    },
    pathPolicy,
    platformCompatibility: {
      currentPlatform: runtimePlatform(input.runtime),
      darwinPathStyle: "posix",
      win32PathStyle: "win32",
      projectRootRelative: true,
      hardcodedShellPathForbidden: true,
      sourceRefs: uniqueSorted(pathPolicy.sourceRefs),
      notes: [
        "macOS uses POSIX paths, Windows uses Win32 paths, and persisted project artifacts prefer project-root-relative paths.",
        "Shell-only hardcoded paths are forbidden by the tool runtime harness.",
      ],
    },
    sourceCoverage: coverage,
    hardLocks: toolRuntimeHarnessHardLocks,
    dryRunOnly: true,
    diagnosticsOnly: true,
    noInstall: true,
    noCredentialRead: true,
    noCredentialWrite: true,
    noSystemSettingsMutation: true,
    arbitraryShellExecutionBlocked: true,
    sidecarDaemonDisabled: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    platformPathAbstractionRequired: true,
    notes: [
      "Phase 8.8 Tool Runtime Harness is fact/diagnostics only.",
      "It does not install software, mutate system settings, read or write credentials, execute arbitrary shell commands, start sidecar daemons, or submit providers.",
      "Detection facts come from RuntimeConfig and ToolDetectionReport; planned optional tools stay planned or missing until detection is explicitly added.",
    ],
  };
}
