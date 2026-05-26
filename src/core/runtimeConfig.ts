import type {
  ProjectRuntimeEnvironment,
  ProviderEnablementEntry,
  ProviderAdapterSetting,
  RuntimeProviderConfig,
  RuntimeConfig,
  RuntimePlatform,
  RuntimeProviderEnablementSummary,
  RuntimeToolPath,
  ToolDetectionItem,
  ToolDetectionReport,
} from "./types";
import {
  IMAGE2_GENERATE_DEFAULT_SIZE,
  IMAGE2_GENERATE_MAX_AUTO_RETRIES,
  IMAGE2_GENERATE_MAX_CONCURRENCY,
  IMAGE2_GENERATE_RETRY_CONCURRENCY,
  IMAGE2_REFERENCE_EDIT_MAX_AUTO_RETRIES,
  IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY,
  IMAGE2_REFERENCE_EDIT_RETRY_CONCURRENCY,
  JIMENG_COMPATIBLE_VIDEO_720P_SIZE_PRESETS,
} from "./providerPolicy";

export const runtimeConfigSchemaVersion = "0.1.0";

export const runtimeToolIds = ["agentCli", "image2Runtime", "ffmpeg", "ffprobe", "node", "npm", "git"] as const;

type RuntimeToolId = (typeof runtimeToolIds)[number];

const defaultToolPaths: Record<RuntimeToolId, RuntimeToolPath> = {
  agentCli: {
    id: "agent",
    label: "Agent CLI",
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
      activeProvider: "lanyi-image2",
      allowedProviders: ["lanyi-image2", "openai-image2-agent-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream", "seedance"],
      liveSubmitAllowed: false,
      notes: [`Image generation slot defaults to ${IMAGE2_GENERATE_MAX_CONCURRENCY} concurrent requests at ${IMAGE2_GENERATE_DEFAULT_SIZE}; failed shots retry at ${IMAGE2_GENERATE_RETRY_CONCURRENCY} concurrent requests before remaining missing.`],
    },
    {
      slot: "image.edit",
      state: "active",
      activeProvider: "lanyi-image2",
      allowedProviders: ["lanyi-image2", "openai-image2-agent-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream", "seedance"],
      liveSubmitAllowed: false,
      notes: [`Image edit slot remains Image2-only; reference edits default and cap at ${IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY} concurrent requests, retry at ${IMAGE2_REFERENCE_EDIT_RETRY_CONCURRENCY}, and allow no text-to-image fallback.`],
    },
    {
      slot: "image.reference_asset",
      state: "active",
      activeProvider: "lanyi-image2",
      allowedProviders: ["lanyi-image2", "openai-image2-agent-cli", "openai-image2-api"],
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
      notes: [`Seedance/Jimeng stay parked in Phase 3.8; Image2 start frames now use the same Jimeng-compatible ${JIMENG_COMPATIBLE_VIDEO_720P_SIZE_PRESETS["16:9"]} input grid to avoid resize stretch.`],
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
      activeProvider: "local-qwen3-tts-clone",
      allowedProviders: ["local-qwen3-tts-clone", "local-index-tts", "cloud-tts"],
      forbiddenProviders: [],
      liveSubmitAllowed: false,
      notes: ["Voice and narration default to local Qwen3 voice cloning for multilingual dialogue. IndexTTS remains a local fallback and cloud TTS remains a replaceable future route. Submit still requires explicit permission."],
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

export function buildProviderAdapterSettings(): ProviderAdapterSetting[] {
  return [
    {
      id: "adapter-lanyi-image2",
      label: "Lanyi Image2",
      providerId: "lanyi-image2",
      slot: "image.generate",
      requiredMode: "text2image",
      state: "active",
      credentialStatus: "not_configured",
      dryRunOnly: true,
      liveSubmitAllowed: false,
      providerSubmissionForbidden: true,
      supports: {
        referenceImage: true,
        startEndFrame: false,
        textToVideo: false,
        fastModel: false,
        vipChannel: false,
        bgmInVideoPrompt: false,
        cameraControl: "textual",
      },
      forbiddenRoutes: ["fast_model", "vip_channel", "text_to_video_main_path", "bgm_in_video_prompt", "live_submit"],
      notes: ["Uses Image2-compatible generation through the configured base URL; key material stays outside Project.vibe and export packages."],
    },
    {
      id: "adapter-openai-image2-agent-cli",
      label: "OpenAI Image2 via Agent CLI",
      providerId: "openai-image2-agent-cli",
      slot: "image.generate",
      requiredMode: "text2image",
      state: "active",
      credentialStatus: "not_required",
      dryRunOnly: true,
      liveSubmitAllowed: false,
      providerSubmissionForbidden: true,
      supports: {
        referenceImage: "planned",
        startEndFrame: false,
        textToVideo: false,
        fastModel: false,
        vipChannel: false,
        bgmInVideoPrompt: false,
        cameraControl: "textual",
      },
      forbiddenRoutes: ["fast_model", "vip_channel", "text_to_video_main_path", "bgm_in_video_prompt", "live_submit"],
      notes: ["Image2 is the preferred still-image path; settings expose adapter facts only."],
    },
    {
      id: "adapter-seedance2-provider",
      label: "Seedance 2 I2V",
      providerId: "seedance2-provider",
      slot: "video.i2v",
      requiredMode: "frames2video",
      state: "parked",
      credentialStatus: "not_configured",
      dryRunOnly: true,
      liveSubmitAllowed: false,
      providerSubmissionForbidden: true,
      supports: {
        referenceImage: true,
        startEndFrame: true,
        textToVideo: "experimental_parked",
        fastModel: false,
        vipChannel: false,
        bgmInVideoPrompt: false,
        cameraControl: "planned",
      },
      forbiddenRoutes: ["fast_model", "vip_channel", "text_to_video_main_path", "bgm_in_video_prompt", "live_submit"],
      notes: ["Adapter shell only. It can prepare frames-to-video envelopes later, but cannot submit provider tasks in Phase 7.2."],
    },
    {
      id: "adapter-jimeng-video",
      label: "Jimeng Video",
      providerId: "jimeng-video",
      slot: "video.i2v",
      requiredMode: "frames2video",
      state: "parked",
      credentialStatus: "not_configured",
      dryRunOnly: true,
      liveSubmitAllowed: false,
      providerSubmissionForbidden: true,
      supports: {
        referenceImage: true,
        startEndFrame: true,
        textToVideo: "experimental_parked",
        fastModel: false,
        vipChannel: false,
        bgmInVideoPrompt: false,
        cameraControl: "planned",
      },
      forbiddenRoutes: ["fast_model", "vip_channel", "text_to_video_main_path", "bgm_in_video_prompt", "live_submit"],
      notes: ["Reserved as a future replaceable video adapter; no VIP or live route is enabled."],
    },
    {
      id: "adapter-local-index-tts",
      label: "Local IndexTTS",
      providerId: "local-index-tts",
      slot: "audio.tts",
      requiredMode: "tts",
      state: "planned",
      credentialStatus: "not_required",
      dryRunOnly: true,
      liveSubmitAllowed: false,
      providerSubmissionForbidden: true,
      supports: {
        referenceImage: false,
        startEndFrame: false,
        textToVideo: false,
        fastModel: false,
        vipChannel: false,
        bgmInVideoPrompt: false,
        cameraControl: "none",
      },
      forbiddenRoutes: ["fast_model", "vip_channel", "text_to_video_main_path", "bgm_in_video_prompt", "live_submit"],
      notes: ["Local TTS adapter shell for IndexTTS. It can only be invoked later by the runtime after a permission receipt."],
    },
    {
      id: "adapter-local-qwen3-tts-clone",
      label: "Local Qwen3 TTS Clone",
      providerId: "local-qwen3-tts-clone",
      slot: "audio.tts",
      requiredMode: "tts",
      state: "planned",
      credentialStatus: "not_required",
      dryRunOnly: true,
      liveSubmitAllowed: false,
      providerSubmissionForbidden: true,
      supports: {
        referenceImage: false,
        startEndFrame: false,
        textToVideo: false,
        fastModel: false,
        vipChannel: false,
        bgmInVideoPrompt: false,
        cameraControl: "none",
      },
      forbiddenRoutes: ["fast_model", "vip_channel", "text_to_video_main_path", "bgm_in_video_prompt", "live_submit"],
      notes: ["Local voice-clone adapter shell for Qwen3-TTS Base. VoiceDesign remains an offline model resource and is not part of the default submit path."],
    },
    {
      id: "adapter-cloud-tts",
      label: "Cloud TTS",
      providerId: "cloud-tts",
      slot: "audio.tts",
      requiredMode: "tts",
      state: "planned",
      credentialStatus: "not_configured",
      dryRunOnly: true,
      liveSubmitAllowed: false,
      providerSubmissionForbidden: true,
      supports: {
        referenceImage: false,
        startEndFrame: false,
        textToVideo: false,
        fastModel: false,
        vipChannel: false,
        bgmInVideoPrompt: false,
        cameraControl: "none",
      },
      forbiddenRoutes: ["fast_model", "vip_channel", "text_to_video_main_path", "bgm_in_video_prompt", "live_submit"],
      notes: ["Cloud TTS adapter shell. Vendor credentials stay in the runtime credential layer."],
    },
  ];
}

export function buildProviderConfigs(): RuntimeProviderConfig[] {
  return [
    {
      providerId: "deepseek-v4-pro",
      label: "DeepSeek v4 Pro",
      providerKind: "agent",
      baseUrl: "https://api.deepseek.com",
      chatModel: "deepseek-v4-pro",
      endpointMode: "cloud_api",
      source: "default",
      credential: {
        envKey: "VIBE_DEEPSEEK_API_KEY",
        keyStatus: "not_configured",
        source: "none",
        secretDisplayed: false,
      },
      notes: ["Director planning model only. It plans shots and prompts; it does not submit image or video jobs."],
    },
    {
      providerId: "lanyi-image2",
      label: "Lanyi Image2",
      providerKind: "image",
      baseUrl: "https://lanyiapi.com",
      imageModel: "gpt-image-2",
      chatModel: "claude-opus-4-6",
      endpointMode: "responses_api",
      concurrencyPolicy: {
        imageGenerateMaxConcurrency: IMAGE2_GENERATE_MAX_CONCURRENCY,
        imageGenerateRetryConcurrency: IMAGE2_GENERATE_RETRY_CONCURRENCY,
        imageGenerateMaxAutoRetries: IMAGE2_GENERATE_MAX_AUTO_RETRIES,
        imageEditMaxConcurrency: IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY,
        imageEditMaxAutoRetries: IMAGE2_REFERENCE_EDIT_MAX_AUTO_RETRIES,
        referenceEditDefault: true,
        notes: [
          `Text-to-image generation defaults to ${IMAGE2_GENERATE_MAX_CONCURRENCY} concurrent requests at ${IMAGE2_GENERATE_DEFAULT_SIZE}.`,
          `Failed image.generate shots retry at ${IMAGE2_GENERATE_RETRY_CONCURRENCY} concurrent requests with auto retries capped at ${IMAGE2_GENERATE_MAX_AUTO_RETRIES}.`,
          `Reference-image edits default and cap at ${IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY}; failed reference edits retry at ${IMAGE2_REFERENCE_EDIT_RETRY_CONCURRENCY} with auto retries capped at ${IMAGE2_REFERENCE_EDIT_MAX_AUTO_RETRIES}.`,
        ],
      },
      source: "default",
      credential: {
        envKey: "VIBE_IMAGE2_API_KEY",
        keyStatus: "not_configured",
        source: "none",
        secretDisplayed: false,
      },
      notes: ["Settings may show status and masked/local references, never raw key material."],
    },
    {
      providerId: "local-index-tts",
      label: "Local IndexTTS",
      providerKind: "tts_local",
      baseUrl: "local://index-tts",
      ttsModel: "IndexTTS",
      endpointMode: "local_cli",
      localCommand: {
        commandEnvKey: "VIBE_INDEX_TTS_COMMAND",
        modelDirEnvKey: "VIBE_INDEX_TTS_MODEL_DIR",
        speakerWavEnvKey: "VIBE_INDEX_TTS_SPEAKER_WAV",
        expectedOutputFormat: "wav",
        notes: [
          "Point VIBE_INDEX_TTS_COMMAND at the local IndexTTS runner after installation.",
          "Model and speaker paths stay in runtime configuration, not Project.vibe.",
        ],
      },
      ttsConcurrencyPolicy: {
        maxConcurrentJobs: 1,
        maxAutoRetries: 1,
        timeoutSeconds: 600,
        notes: ["Local IndexTTS defaults to one job because voice cloning can be memory-heavy."],
      },
      source: "default",
      credential: {
        envKey: "VIBE_INDEX_TTS_COMMAND",
        keyStatus: "not_required",
        source: "none",
        secretDisplayed: false,
      },
      notes: ["Prepared local TTS route. It cannot execute from Settings and requires a runtime permission receipt."],
    },
    {
      providerId: "local-qwen3-tts-clone",
      label: "Local Qwen3 TTS Clone",
      providerKind: "tts_local",
      baseUrl: "local://qwen3-tts",
      ttsModel: "Qwen3-TTS-12Hz-1.7B-Base",
      endpointMode: "local_cli",
      localCommand: {
        commandEnvKey: "VIBE_QWEN3_TTS_COMMAND",
        modelDirEnvKey: "VIBE_QWEN3_TTS_MODEL_DIR",
        speakerWavEnvKey: "VIBE_QWEN3_TTS_SPEAKER_WAV",
        expectedOutputFormat: "wav",
      notes: [
          "Point VIBE_QWEN3_TTS_COMMAND at the local Qwen3-TTS runner after installation.",
          "Use VIBE_QWEN3_TTS_MODEL_DIR for Qwen3-TTS-12Hz-1.7B-Base; VoiceDesign can stay configured separately for offline voice drafting.",
          "Speaker/reference audio paths stay in runtime configuration and permission receipts, not Project.vibe.",
        ],
      },
      ttsConcurrencyPolicy: {
        maxConcurrentJobs: 1,
        maxAutoRetries: 1,
        timeoutSeconds: 900,
        notes: ["Local Qwen3 voice cloning defaults to one job because 1.7B model inference is memory-heavy on desktop machines."],
      },
      source: "default",
      credential: {
        envKey: "VIBE_QWEN3_TTS_COMMAND",
        keyStatus: "not_required",
        source: "none",
        secretDisplayed: false,
      },
      notes: ["Prepared local multilingual voice-clone route. It cannot execute from Settings and requires a runtime permission receipt."],
    },
    {
      providerId: "cloud-tts",
      label: "Cloud TTS",
      providerKind: "tts_cloud",
      baseUrl: "https://api.example-tts.invalid",
      ttsModel: "cloud-tts-default",
      endpointMode: "cloud_api",
      cloudEndpoint: {
        baseUrlEnvKey: "VIBE_TTS_BASE_URL",
        modelEnvKey: "VIBE_TTS_MODEL",
        voiceIdEnvKey: "VIBE_TTS_VOICE_ID",
        expectedOutputFormat: "mp3",
        notes: ["The concrete vendor can be swapped by environment/local settings without changing Project.vibe."],
      },
      ttsConcurrencyPolicy: {
        maxConcurrentJobs: 3,
        maxAutoRetries: 2,
        timeoutSeconds: 180,
        notes: ["Cloud TTS is prepared for small parallel narration batches once a real provider is selected."],
      },
      source: "default",
      credential: {
        envKey: "VIBE_TTS_API_KEY",
        keyStatus: "not_configured",
        source: "none",
        secretDisplayed: false,
      },
      notes: ["Prepared cloud TTS route. Raw keys remain outside project files and export packages."],
    },
  ];
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
      "Image slots are active for Image2 only; video remains parked and audio defaults to planned local Qwen3 voice cloning.",
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
  const providerAdapterSettings = buildProviderAdapterSettings();
  const providerConfigs = buildProviderConfigs();

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
      agentCli: mergeToolPath(defaultToolPaths.agentCli, toolById.get("agent")),
      image2Runtime: mergeToolPath(defaultToolPaths.image2Runtime, toolById.get("image2-runtime")),
      ffmpeg: mergeToolPath(defaultToolPaths.ffmpeg, toolById.get("ffmpeg")),
      ffprobe: mergeToolPath(defaultToolPaths.ffprobe, toolById.get("ffprobe")),
      node: mergeToolPath(defaultToolPaths.node, toolById.get("node")),
      npm: mergeToolPath(defaultToolPaths.npm, toolById.get("npm")),
      git: mergeToolPath(defaultToolPaths.git, toolById.get("git")),
    },
    providerEnablement,
    providerAdapterSettings,
    providerConfigs,
    sidecarPermissions: {
      arbitraryShellExecution: "blocked",
      providerLiveSubmit: "blocked",
      filesystemScope: ["project_root", "user_selected_import", "app_config", "temp_dir"],
      allowedCommands: [
        {
          id: "agent-cli-dry-task",
          executable: "agent",
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
      mode: "local_file",
      storesSecrets: false,
      plannedStores: ["macos_keychain", "windows_credential_manager", "local_encrypted_store"],
      notes: ["API keys stored in ~/.vibe-director/credentials.json. Credential read is allowed for settings display only. Provider submit remains locked."],
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
  // P2-130: new Date(0) produces epoch as default; this may cause confusion
  // when no generatedAt is supplied. Consider using current date or explicit marker.
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
        id: "agent",
        label: "Agent CLI",
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
        providerAdapterSettings: runtime.config.providerAdapterSettings || fallback.config.providerAdapterSettings,
        providerConfigs: runtime.config.providerConfigs || fallback.config.providerConfigs,
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
