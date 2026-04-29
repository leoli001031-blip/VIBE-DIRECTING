import type {
  ProjectRuntimeEnvironment,
  ProviderEnablementEntry,
  RuntimeConfig,
  RuntimePlatform,
  RuntimeProviderEnablementSummary,
  RuntimeToolPath,
  ToolDetectionItem,
  ToolDetectionReport,
} from "./types";

export const runtimeConfigSchemaVersion = "0.1.0";

export const runtimeToolIds = ["codexCli", "image2Runtime", "ffmpeg", "ffprobe", "node", "npm", "git"] as const;

type RuntimeToolId = (typeof runtimeToolIds)[number];

const defaultToolPaths: Record<RuntimeToolId, RuntimeToolPath> = {
  codexCli: {
    id: "codex",
    label: "Codex CLI",
    status: "unknown",
    source: "placeholder",
    notes: ["Detected by the import script when available; no shell command is executed from the browser UI."],
  },
  image2Runtime: {
    id: "image2-runtime",
    label: "Image2 Runtime",
    status: "planned",
    source: "planned",
    notes: ["Image slots are enabled only for Image2-compatible adapters; live provider submit is still outside this settings shell."],
  },
  ffmpeg: {
    id: "ffmpeg",
    label: "FFmpeg",
    status: "unknown",
    source: "placeholder",
    notes: ["Used for local media inspection and preview/export health checks."],
  },
  ffprobe: {
    id: "ffprobe",
    label: "FFprobe",
    status: "unknown",
    source: "placeholder",
    notes: ["Used for local media metadata checks."],
  },
  node: {
    id: "node",
    label: "Node.js",
    status: "unknown",
    source: "placeholder",
    notes: ["TypeScript/Node remains the orchestration core for Phase 3.8."],
  },
  npm: {
    id: "npm",
    label: "npm",
    status: "unknown",
    source: "placeholder",
    notes: ["Detected for diagnostics only; Phase 3.8 does not install packages from settings."],
  },
  git: {
    id: "git",
    label: "Git",
    status: "unknown",
    source: "placeholder",
    notes: ["Optional diagnostic helper for local project inspection."],
  },
};

export function buildProviderEnablement(): RuntimeConfig["providerEnablement"] {
  const slots: ProviderEnablementEntry[] = [
    {
      slot: "image.generate",
      state: "active",
      activeProvider: "openai-image2-codex-cli",
      allowedProviders: ["openai-image2-codex-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream", "seedance"],
      liveSubmitAllowed: false,
      notes: ["Image generation slot is active for Image2 only; settings are read-only."],
    },
    {
      slot: "image.edit",
      state: "active",
      activeProvider: "openai-image2-api",
      allowedProviders: ["openai-image2-codex-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream", "seedance"],
      liveSubmitAllowed: false,
      notes: ["Image edit slot remains Image2-only; no text-to-image fallback is allowed."],
    },
    {
      slot: "image.reference_asset",
      state: "active",
      activeProvider: "openai-image2-api",
      allowedProviders: ["openai-image2-codex-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream", "seedance"],
      liveSubmitAllowed: false,
      notes: ["Reference assets can be planned against Image2 only."],
    },
    {
      slot: "video.i2v",
      state: "parked",
      activeProvider: "seedance2-provider",
      allowedProviders: ["seedance2-provider", "dreamina-seedance2", "jimeng-video"],
      forbiddenProviders: [],
      liveSubmitAllowed: false,
      notes: ["Seedance/Jimeng stay parked in Phase 3.8 and cannot be activated from settings."],
    },
    {
      slot: "video.t2v.experimental",
      state: "parked",
      allowedProviders: ["seedance2-provider", "jimeng-video"],
      forbiddenProviders: [],
      liveSubmitAllowed: false,
      notes: ["Text-to-video fallback remains parked."],
    },
    {
      slot: "audio.tts",
      state: "planned",
      allowedProviders: [],
      forbiddenProviders: [],
      liveSubmitAllowed: false,
      notes: ["Voice and narration providers are planned placeholders."],
    },
    {
      slot: "audio.music",
      state: "planned",
      allowedProviders: [],
      forbiddenProviders: [],
      liveSubmitAllowed: false,
      notes: ["Music providers are planned placeholders."],
    },
  ];

  return {
    strictImageProvider: "image2_only",
    slots,
  };
}

function pathStatusFromDetection(tool?: ToolDetectionItem): RuntimeToolPath["status"] {
  if (!tool) return "unknown";
  if (tool.status === "available" && tool.path) return "path";
  if (tool.status === "planned") return "planned";
  if (tool.status === "blocked") return "blocked";
  return "unknown";
}

function mergeToolPath(defaultPath: RuntimeToolPath, tool?: ToolDetectionItem): RuntimeToolPath {
  return {
    ...defaultPath,
    status: pathStatusFromDetection(tool),
    path: tool?.path,
    source: tool?.status === "available" ? "detected" : defaultPath.source,
    notes: [...defaultPath.notes, ...(tool?.notes || [])],
  };
}

export function summarizeProviderEnablement(providerEnablement: RuntimeConfig["providerEnablement"]): RuntimeProviderEnablementSummary {
  return {
    activeImageSlots: providerEnablement.slots.filter((slot) => slot.slot.startsWith("image.") && slot.state === "active").length,
    parkedVideoSlots: providerEnablement.slots.filter((slot) => slot.slot.startsWith("video.") && slot.state === "parked").length,
    plannedAudioSlots: providerEnablement.slots.filter((slot) => slot.slot.startsWith("audio.") && slot.state === "planned").length,
    liveSubmitAllowed: providerEnablement.slots.some((slot) => slot.liveSubmitAllowed),
    notes: [
      "Settings exposes provider enablement as read-only runtime facts.",
      "Image slots are active for Image2 only; video remains parked and audio remains planned.",
    ],
  };
}

export function buildRuntimeConfig(options: {
  platform?: RuntimePlatform;
  detectionReport?: ToolDetectionReport;
} = {}): RuntimeConfig {
  const platform = options.platform || options.detectionReport?.platform || "unknown";
  const toolById = new Map((options.detectionReport?.tools || []).map((tool) => [tool.id, tool]));
  const providerEnablement = buildProviderEnablement();

  return {
    schemaVersion: runtimeConfigSchemaVersion,
    runtimeMode: "browser_dev",
    platform,
    projectRootPolicy: {
      strategy: "project_root_relative",
      allowedRoots: ["project_root", "user_selected_import", "app_config", "temp_dir"],
      macPathStyle: "posix",
      windowsPathStyle: "win32",
      notes: [
        "Persist project-relative paths where possible.",
        "Resolve absolute paths through a platform-aware runtime path resolver before sidecar execution.",
      ],
    },
    pathRules: [
      {
        id: "mac-posix-project-root",
        platform: "darwin",
        rule: "Use POSIX paths under the selected project root.",
        example: "/Users/name/project/02_keyframes/start.png",
      },
      {
        id: "windows-win32-project-root",
        platform: "win32",
        rule: "Use Win32 paths through the runtime resolver; do not persist shell-specific Git Bash paths.",
        example: "C:\\Users\\name\\project\\02_keyframes\\start.png",
      },
      {
        id: "portable-project-relative",
        platform: "all",
        rule: "Prefer project-relative artifact references in schemas and manifests.",
        example: "02_keyframes/start/A1_01_start.png",
      },
    ],
    toolPaths: {
      codexCli: mergeToolPath(defaultToolPaths.codexCli, toolById.get("codex")),
      image2Runtime: mergeToolPath(defaultToolPaths.image2Runtime, toolById.get("image2-runtime")),
      ffmpeg: mergeToolPath(defaultToolPaths.ffmpeg, toolById.get("ffmpeg")),
      ffprobe: mergeToolPath(defaultToolPaths.ffprobe, toolById.get("ffprobe")),
      node: mergeToolPath(defaultToolPaths.node, toolById.get("node")),
      npm: mergeToolPath(defaultToolPaths.npm, toolById.get("npm")),
      git: mergeToolPath(defaultToolPaths.git, toolById.get("git")),
    },
    providerEnablement,
    sidecarPermissions: {
      arbitraryShellExecution: "blocked",
      providerLiveSubmit: "blocked",
      filesystemScope: ["project_root", "user_selected_import", "app_config", "temp_dir"],
      allowedCommands: [
        {
          id: "codex-cli-dry-agent-task",
          executable: "codex",
          allowedArgs: ["run", "--json", "--project"],
          requiredFor: ["agent planning", "dry diagnostics"],
          notes: ["Planned sidecar command shape; arguments must be compiled from task envelopes."],
        },
        {
          id: "ffmpeg-inspect",
          executable: "ffmpeg",
          allowedArgs: ["-version", "-i", "-hide_banner"],
          requiredFor: ["media health checks"],
          notes: ["No arbitrary shell string execution."],
        },
        {
          id: "ffprobe-inspect",
          executable: "ffprobe",
          allowedArgs: ["-version", "-show_streams", "-show_format", "-of", "json"],
          requiredFor: ["media metadata checks"],
          notes: ["Read-only media inspection command."],
        },
      ],
      notes: [
        "Frontend settings cannot execute commands.",
        "Live provider submission remains blocked for this minimal Phase 3.8 safety version.",
      ],
    },
    credentialStorage: {
      mode: "placeholder",
      storesSecrets: false,
      plannedStores: ["macos_keychain", "windows_credential_manager", "local_encrypted_store"],
      notes: ["No API key or provider token is read, written, or displayed by Phase 3.8 settings."],
    },
    voiceSources: [
      {
        id: "voice-registry-placeholder",
        label: "Voice Source Registry",
        status: "placeholder",
        kind: "voice_library",
        notes: ["Reserved for future user voice library metadata; no audio provider is active."],
      },
    ],
  };
}

export function buildDefaultToolDetectionReport(options: {
  generatedAt?: string;
  platform?: RuntimePlatform;
} = {}): ToolDetectionReport {
  const generatedAt = options.generatedAt || new Date(0).toISOString();
  const platform = options.platform || "unknown";

  return {
    generatedAt,
    platform,
    tools: [
      {
        id: "node",
        label: "Node.js",
        kind: "node_runtime",
        requiredFor: ["TypeScript/Node core", "import runtime test"],
        status: "unknown",
        notes: ["Not detected in browser fallback state."],
      },
      {
        id: "npm",
        label: "npm",
        kind: "package_manager",
        requiredFor: ["development scripts"],
        status: "unknown",
        notes: ["Not detected in browser fallback state."],
      },
      {
        id: "git",
        label: "Git",
        kind: "vcs",
        requiredFor: ["diagnostics"],
        status: "unknown",
        notes: ["Optional."],
      },
      {
        id: "ffmpeg",
        label: "FFmpeg",
        kind: "media_binary",
        requiredFor: ["preview/export health checks"],
        status: "unknown",
        notes: ["Not detected in browser fallback state."],
      },
      {
        id: "ffprobe",
        label: "FFprobe",
        kind: "media_binary",
        requiredFor: ["media metadata checks"],
        status: "unknown",
        notes: ["Not detected in browser fallback state."],
      },
      {
        id: "codex",
        label: "Codex CLI",
        kind: "agent_cli",
        requiredFor: ["agent task sidecar"],
        status: "unknown",
        notes: ["Not detected in browser fallback state."],
      },
      {
        id: "image2-runtime",
        label: "Image2 Runtime",
        kind: "image_runtime",
        requiredFor: ["Image2 provider planning"],
        status: "planned",
        notes: ["Adapter detection is planned; no provider submit is performed."],
      },
    ],
  };
}

export function buildRuntimeEnvironment(options: {
  generatedAt?: string;
  platform?: RuntimePlatform;
  detectionReport?: ToolDetectionReport;
} = {}): ProjectRuntimeEnvironment {
  const detectionReport = options.detectionReport || buildDefaultToolDetectionReport(options);
  const config = buildRuntimeConfig({ platform: options.platform, detectionReport });

  return {
    config,
    detectionReport,
    providerEnablementSummary: summarizeProviderEnablement(config.providerEnablement),
  };
}

export function ensureRuntimeEnvironment(
  runtime: Partial<ProjectRuntimeEnvironment> | undefined,
  options: { generatedAt?: string; platform?: RuntimePlatform } = {},
): ProjectRuntimeEnvironment {
  const fallback = buildRuntimeEnvironment(options);
  const detectionReport = runtime?.detectionReport?.tools ? runtime.detectionReport : fallback.detectionReport;
  const config = runtime?.config?.providerEnablement
    ? {
        ...fallback.config,
        ...runtime.config,
        toolPaths: { ...fallback.config.toolPaths, ...runtime.config.toolPaths },
        providerEnablement: runtime.config.providerEnablement,
        sidecarPermissions: runtime.config.sidecarPermissions || fallback.config.sidecarPermissions,
        credentialStorage: runtime.config.credentialStorage || fallback.config.credentialStorage,
        voiceSources: runtime.config.voiceSources || fallback.config.voiceSources,
      }
    : buildRuntimeConfig({ platform: options.platform, detectionReport });
  const providerEnablementSummary = summarizeProviderEnablement(config.providerEnablement);

  return {
    config,
    detectionReport,
    providerEnablementSummary,
  };
}
