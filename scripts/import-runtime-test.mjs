import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import YAML from "yaml";

const DEFAULT_ROOT =
  "/Users/lichenhao/Desktop/Vibe Director/runtime-tests/full_generation_10shot_two_act_20260429";
const root = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_ROOT;
const publicDir = path.resolve("public");
const mediaDir = path.join(publicDir, "media");
const outPath = path.join(publicDir, "runtime-audit.json");
const stateOutPath = path.join(publicDir, "runtime-state.json");
const knowledgeManifestPath = path.resolve("resources/knowledge_pack_manifest.json");

const policy = {
  strictImageProvider: "image2_only",
  rules: [
    {
      slot: "image.generate",
      activeProvider: "openai-image2-codex-cli",
      executionState: "active",
      allowedProviders: ["openai-image2-codex-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream"],
      allowedModes: ["text2image"],
      forbiddenFallbacks: ["image2image_to_text2image"],
      concurrency: "adapter",
    },
    {
      slot: "image.edit",
      activeProvider: "openai-image2-api",
      executionState: "active",
      allowedProviders: ["openai-image2-codex-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream"],
      allowedModes: ["image2image"],
      forbiddenFallbacks: ["image2image_to_text2image", "reference_edit_to_text2image"],
      concurrency: "adapter",
    },
    {
      slot: "image.reference_asset",
      activeProvider: "openai-image2-api",
      executionState: "active",
      allowedProviders: ["openai-image2-codex-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream"],
      allowedModes: ["text2image", "image2image"],
      forbiddenFallbacks: ["image2image_to_text2image"],
      concurrency: "adapter",
    },
    {
      slot: "video.i2v",
      activeProvider: "seedance2-provider",
      executionState: "parked",
      allowedProviders: ["seedance2-provider", "dreamina-seedance2"],
      forbiddenProviders: [],
      allowedModes: ["frames2video"],
      forbiddenFallbacks: ["frames2video_to_text2video"],
      concurrency: 1,
    },
  ],
};

function runtimePlatform() {
  if (["darwin", "win32", "linux"].includes(process.platform)) return process.platform;
  return "unknown";
}

function safeSpawn(command, args) {
  try {
    return spawnSync(command, args, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 2500,
      maxBuffer: 1024 * 64,
    });
  } catch (error) {
    return { status: 1, error };
  }
}

function firstOutputLine(result) {
  return String(result?.stdout || result?.stderr || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean);
}

function resolveCommand(command, platform) {
  const resolver = platform === "win32" ? "where" : "which";
  const result = safeSpawn(resolver, [command]);
  if (result.status !== 0) return undefined;
  return firstOutputLine(result);
}

function detectCommand({ id, command, label, kind, requiredFor, versionArgs = ["--version"], planned = false, notes = [] }, platform) {
  if (planned) {
    return {
      id,
      label,
      kind,
      requiredFor,
      status: "planned",
      notes,
    };
  }

  const resolvedPath = resolveCommand(command, platform);
  if (!resolvedPath) {
    return {
      id,
      label,
      kind,
      requiredFor,
      status: "missing",
      notes: [...notes, "Command was not found by local path detection."],
    };
  }

  const versionResult = safeSpawn(resolvedPath, versionArgs);
  const versionLine = versionResult.status === 0 ? firstOutputLine(versionResult) : undefined;
  return {
    id,
    label,
    kind,
    requiredFor,
    status: "available",
    path: resolvedPath,
    version: versionLine,
    notes,
  };
}

function buildToolDetectionReport(generatedAt) {
  const platform = runtimePlatform();
  const tools = [
    detectCommand({
      id: "node",
      command: "node",
      label: "Node.js",
      kind: "node_runtime",
      requiredFor: ["TypeScript/Node core", "import runtime test"],
      notes: ["Detected with local path lookup and --version only."],
    }, platform),
    detectCommand({
      id: "npm",
      command: "npm",
      label: "npm",
      kind: "package_manager",
      requiredFor: ["development scripts"],
      notes: ["Diagnostics only; no package installation is performed."],
    }, platform),
    detectCommand({
      id: "git",
      command: "git",
      label: "Git",
      kind: "vcs",
      requiredFor: ["diagnostics"],
      notes: ["Optional local diagnostic helper."],
    }, platform),
    detectCommand({
      id: "ffmpeg",
      command: "ffmpeg",
      label: "FFmpeg",
      kind: "media_binary",
      requiredFor: ["preview/export health checks"],
      versionArgs: ["-version"],
      notes: ["Detected for media diagnostics only."],
    }, platform),
    detectCommand({
      id: "ffprobe",
      command: "ffprobe",
      label: "FFprobe",
      kind: "media_binary",
      requiredFor: ["media metadata checks"],
      versionArgs: ["-version"],
      notes: ["Detected for media metadata diagnostics only."],
    }, platform),
    detectCommand({
      id: "codex",
      command: "codex",
      label: "Codex CLI",
      kind: "agent_cli",
      requiredFor: ["agent task sidecar"],
      notes: ["Detected only; the importer does not start a Codex session."],
    }, platform),
    detectCommand({
      id: "image2-runtime",
      command: "image2",
      label: "Image2 Runtime",
      kind: "image_runtime",
      requiredFor: ["Image2 provider planning"],
      planned: true,
      notes: ["Adapter detection is planned; no provider submit is performed."],
    }, platform),
  ];

  return { generatedAt, platform, tools };
}

function pathStatusFromTool(tool) {
  if (!tool) return "unknown";
  if (tool.status === "available" && tool.path) return "path";
  if (tool.status === "planned") return "planned";
  if (tool.status === "blocked") return "blocked";
  return "unknown";
}

function toolPath(id, label, detectionReport, fallbackNotes = []) {
  const tool = detectionReport.tools.find((item) => item.id === id);
  return {
    id,
    label,
    status: pathStatusFromTool(tool),
    path: tool?.path,
    source: tool?.status === "available" ? "detected" : tool?.status === "planned" ? "planned" : "placeholder",
    notes: [...fallbackNotes, ...(tool?.notes || [])],
  };
}

function providerEnablement() {
  return {
    strictImageProvider: "image2_only",
    slots: [
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
        notes: ["Image edit slot remains Image2-only; no fallback to text-to-image."],
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
        notes: ["Seedance/Jimeng stay parked and cannot be activated from settings."],
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
    ],
  };
}

function summarizeProviderEnablement(enablement) {
  return {
    activeImageSlots: enablement.slots.filter((slot) => slot.slot.startsWith("image.") && slot.state === "active").length,
    parkedVideoSlots: enablement.slots.filter((slot) => slot.slot.startsWith("video.") && slot.state === "parked").length,
    plannedAudioSlots: enablement.slots.filter((slot) => slot.slot.startsWith("audio.") && slot.state === "planned").length,
    liveSubmitAllowed: enablement.slots.some((slot) => slot.liveSubmitAllowed),
    notes: [
      "Settings exposes provider enablement as read-only runtime facts.",
      "Image slots are active for Image2 only; video remains parked and audio remains planned.",
    ],
  };
}

function buildRuntimeEnvironment(generatedAt) {
  const detectionReport = buildToolDetectionReport(generatedAt);
  const platform = detectionReport.platform;
  const enablement = providerEnablement();
  const config = {
    schemaVersion: "0.1.0",
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
      codexCli: toolPath("codex", "Codex CLI", detectionReport, ["No Codex session is started by import-runtime-test."]),
      image2Runtime: toolPath("image2-runtime", "Image2 Runtime", detectionReport, ["Image2 adapter detection is planned."]),
      ffmpeg: toolPath("ffmpeg", "FFmpeg", detectionReport, ["Used for local media health checks."]),
      ffprobe: toolPath("ffprobe", "FFprobe", detectionReport, ["Used for local media metadata checks."]),
      node: toolPath("node", "Node.js", detectionReport, ["TypeScript/Node remains the orchestration core."]),
      npm: toolPath("npm", "npm", detectionReport, ["Diagnostics only; no npm install is performed."]),
      git: toolPath("git", "Git", detectionReport, ["Optional diagnostics helper."]),
    },
    providerEnablement: enablement,
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

  return {
    config,
    detectionReport,
    providerEnablementSummary: summarizeProviderEnablement(enablement),
  };
}

function readJson(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function readYaml(file, fallback = {}) {
  try {
    return YAML.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function exists(file) {
  return Boolean(file && fs.existsSync(file));
}

function dimensionsFromGenerated(entry) {
  if (!entry || !entry.dimensions) return undefined;
  return `${entry.dimensions.width}x${entry.dimensions.height}`;
}

function parseJsonl(file) {
  if (!exists(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { event: "parse_error", raw: line };
      }
    });
}

function parseQaTable(file) {
  if (!exists(file)) return new Map();
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const table = lines.filter((line) => line.trim().startsWith("|"));
  if (table.length < 3) return new Map();
  const headers = table[0].split("|").map((cell) => cell.trim()).filter(Boolean);
  const result = new Map();
  for (const line of table.slice(2)) {
    const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < headers.length) continue;
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
    const key = (row.Asset || row.Shot || "").replace(/`/g, "");
    if (key) result.set(key, row);
  }
  return result;
}

function gateValue(value, fallback = "UNKNOWN") {
  const clean = String(value || "").replace(/`/g, "").toUpperCase();
  return ["PASS", "PARTIAL", "FAIL", "N/A"].includes(clean) ? clean : fallback;
}

function gateSet(row = {}) {
  return {
    identity: gateValue(row.identity, "UNKNOWN"),
    scene: gateValue(row.scene, "UNKNOWN"),
    pair: gateValue(row.pair, "N/A"),
    story: gateValue(row.story, "UNKNOWN"),
    prop: gateValue(row.prop, "UNKNOWN"),
    style: gateValue(row.style, "UNKNOWN"),
  };
}

function flattenManifestAssets(manifest) {
  const assets = manifest?.generation_manifest?.assets || {};
  return [
    ...(assets.characters || []).map((item) => ({ ...item, type: "character" })),
    ...(assets.scenes || []).map((item) => ({ ...item, type: "scene" })),
    ...(assets.props || []).map((item) => ({ ...item, type: "prop" })),
  ];
}

function generatedEntryFor(generated, id) {
  return generated?.assets?.[id] || generated?.keyframes?.[id] || generated?.videos?.[id];
}

function providerIdForJob(jobId, events) {
  const event = events.find((item) => item.event === "cmd_start" && Array.isArray(item.cmd) && item.cmd[0] === "dreamina" && item.cmd.join(" ").includes(jobId));
  return event ? "dreamina" : "unknown";
}

function requiredModeForAsset(asset) {
  if (asset.type === "scene" && asset.asset_type === "scene_view") return "image2image";
  if (asset.type === "scene" && asset.asset_type === "master_reference") return "text2image";
  if (asset.type === "character" || asset.type === "prop") return "text2image";
  return "not_applicable";
}

function slotForAsset(asset) {
  if (asset.type === "character" || asset.type === "prop") return "image.reference_asset";
  if (asset.type === "scene" && asset.asset_type === "scene_view") return "image.edit";
  return "image.reference_asset";
}

function actIdForShot(shot) {
  if (shot.act_id) return String(shot.act_id);
  if (shot.actId) return String(shot.actId);
  const match = /^([A-Za-z]+\d+)/.exec(String(shot.shot_id || ""));
  return match?.[1] || "unknown";
}

function sectionIdForShot(shot) {
  return shot.section_id || shot.sectionId || shot.sequence_id || shot.scene_id || actIdForShot(shot);
}

function assetJobId(asset) {
  if (asset.type === "character") return `asset_character_${asset.character_id}`;
  if (asset.type === "prop") return `asset_prop_${asset.prop_id || asset.asset_id?.replace(/_master$/, "")}`;
  if (asset.type === "scene") {
    if (asset.asset_type === "master_reference") return `asset_scene_${asset.scene_id}_master`;
    return `asset_scene_${asset.scene_id}_${asset.asset_id}`;
  }
  return asset.asset_id;
}

function makeIssue(id, severity, type, title, detail, recommendation, target) {
  return { id, severity, type, title, detail, recommendation, target };
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    const items = value.map(canonicalize);
    if (items.every((item) => ["string", "number", "boolean"].includes(typeof item))) return [...items].sort();
    return items;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "sourceIndexHash" && key !== "updatedAt")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }

  return value;
}

function hashString(value, prefix = "vci") {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function providerSupport(overrides = {}) {
  return {
    referenceImage: false,
    imageEdit: false,
    startEndFrame: false,
    bbox: "unsupported",
    cameraControl: "none",
    controlNet: "unsupported",
    mask: "unsupported",
    negativePrompt: "supported",
    ...overrides,
  };
}

function providerCapability(input) {
  return {
    id: `${input.providerId}:${input.slot}:${input.requiredMode}`,
    liveSubmitAllowed: false,
    ...input,
  };
}

function buildDefaultProviderRegistry(generatedAt) {
  const capabilities = [
    providerCapability({
      providerId: "openai-image2-codex-cli",
      providerName: "OpenAI Image2 via Codex CLI",
      slot: "image.generate",
      requiredMode: "text2image",
      executionState: "active",
      inputKinds: ["text"],
      outputKind: "image",
      supports: providerSupport({ cameraControl: "textual" }),
      maxReferenceImages: 0,
      forbiddenFallbacks: ["text2image_to_image2image", "image2image_to_text2image"],
      notes: ["Dry-run contract only. The importer never submits Image2 jobs."],
    }),
    providerCapability({
      providerId: "openai-image2-api",
      providerName: "OpenAI Image2 API",
      slot: "image.edit",
      requiredMode: "image2image",
      executionState: "active",
      inputKinds: ["text", "image", "reference_image"],
      outputKind: "image",
      supports: providerSupport({
        referenceImage: true,
        imageEdit: true,
        startEndFrame: true,
        mask: "planned",
        cameraControl: "textual",
      }),
      maxReferenceImages: 4,
      forbiddenFallbacks: ["image2image_to_text2image", "reference_edit_to_text2image"],
      notes: ["End-frame edits must derive from the start frame or block; no text-to-image fallback is allowed."],
    }),
    providerCapability({
      providerId: "openai-image2-api",
      providerName: "OpenAI Image2 API",
      slot: "image.reference_asset",
      requiredMode: "text2image",
      executionState: "active",
      inputKinds: ["text", "reference_image"],
      outputKind: "image",
      supports: providerSupport({ referenceImage: true, cameraControl: "textual" }),
      maxReferenceImages: 3,
      forbiddenFallbacks: ["image2image_to_text2image"],
      notes: ["Reference assets are compiled as source-intent plans before any future Image2 adapter call."],
    }),
    providerCapability({
      providerId: "openai-image2-api",
      providerName: "OpenAI Image2 API",
      slot: "image.reference_asset",
      requiredMode: "image2image",
      executionState: "active",
      inputKinds: ["text", "image", "reference_image"],
      outputKind: "image",
      supports: providerSupport({
        referenceImage: true,
        imageEdit: true,
        mask: "planned",
        cameraControl: "textual",
      }),
      maxReferenceImages: 4,
      forbiddenFallbacks: ["image2image_to_text2image", "reference_edit_to_text2image"],
      notes: ["Reference-image asset edits stay Image2 image-to-image only."],
    }),
    providerCapability({
      providerId: "seedance2-provider",
      providerName: "Seedance 2 Provider",
      slot: "video.i2v",
      requiredMode: "frames2video",
      executionState: "parked",
      inputKinds: ["text", "start_frame", "end_frame"],
      outputKind: "video",
      supports: providerSupport({ referenceImage: true, startEndFrame: true, cameraControl: "planned" }),
      maxReferenceImages: 2,
      forbiddenFallbacks: ["frames2video_to_text2video"],
      notes: ["Parked capability only; live submit is false for Seedance/Jimeng paths."],
    }),
    providerCapability({
      providerId: "jimeng-video",
      providerName: "Jimeng Video",
      slot: "video.i2v",
      requiredMode: "frames2video",
      executionState: "parked",
      inputKinds: ["text", "start_frame", "end_frame"],
      outputKind: "video",
      supports: providerSupport({ referenceImage: true, startEndFrame: true, cameraControl: "planned" }),
      maxReferenceImages: 2,
      forbiddenFallbacks: ["frames2video_to_text2video"],
      notes: ["Parked capability only; retained for future adapter selection."],
    }),
    providerCapability({
      providerId: "none",
      providerName: "Parked text-to-video placeholder",
      slot: "video.t2v.experimental",
      requiredMode: "text2video",
      executionState: "parked",
      inputKinds: ["text"],
      outputKind: "video",
      supports: providerSupport({ cameraControl: "planned" }),
      maxReferenceImages: 0,
      forbiddenFallbacks: [],
      notes: ["Text-to-video is explicitly parked and cannot be used as an image/video fallback."],
    }),
  ];

  return {
    schemaVersion: "0.1.0",
    registryVersion: "provider-registry/phase-4.0",
    generatedAt,
    strictImageProvider: "image2_only",
    defaultProviderBySlot: {
      "image.generate": "openai-image2-codex-cli",
      "image.edit": "openai-image2-api",
      "image.reference_asset": "openai-image2-api",
      "video.i2v": "seedance2-provider",
      "video.t2v.experimental": "none",
    },
    capabilities,
    notes: [
      "Provider capability matrix is a dry-run contract.",
      "Image slots are Image2-only; image.edit never falls back to text2image.",
      "Video providers are parked and liveSubmitAllowed is false.",
    ],
  };
}

function getCapabilityForJob(job, registry) {
  const byProvider = registry.capabilities.find(
    (item) => item.slot === job.slot && item.requiredMode === job.requiredMode && item.providerId === job.providerId,
  );
  if (byProvider) return byProvider;
  const defaultProvider = registry.defaultProviderBySlot[job.slot];
  return registry.capabilities.find(
    (item) => item.slot === job.slot && item.requiredMode === job.requiredMode && item.providerId === defaultProvider,
  ) || registry.capabilities.find((item) => item.slot === job.slot && item.requiredMode === job.requiredMode);
}

function validateJobAgainstCapability(job, registry) {
  const blockers = [];
  const warnings = [];
  const capability = getCapabilityForJob(job, registry);
  if (!capability) return { valid: false, blockers: [`No provider capability supports ${job.slot}/${job.requiredMode}.`], warnings };
  if (job.slot === "image.generate" && job.requiredMode !== "text2image") blockers.push("image.generate requires text2image.");
  if (job.slot === "image.edit" && job.requiredMode !== "image2image") blockers.push("image.edit cannot fall back to text2image.");
  if (job.slot === "video.i2v" && job.requiredMode !== "frames2video") blockers.push("video.i2v requires frames2video.");
  if (job.providerId && job.providerId !== "unknown") {
    const providerMatchesSlot = registry.capabilities.some((item) => item.slot === job.slot && item.providerId === job.providerId);
    if (!providerMatchesSlot) blockers.push(`${job.providerId} is not registered for ${job.slot}.`);
  }
  if ((job.issues || []).some((issue) => /fallback_text|image2image_to_text2image|reference_edit_to_text2image/.test(issue))) {
    blockers.push("Job carries forbidden image fallback evidence.");
  }
  if (["parked", "planned", "unavailable"].includes(capability.executionState)) {
    warnings.push(`${capability.slot} is ${capability.executionState}; keep this as dry-run contract state.`);
  }
  if (job.slot === "image.edit") warnings.push("image.edit fallback to text2image is forbidden by capability.");
  return { valid: blockers.length === 0, capability, blockers, warnings };
}

function promptKindForJob(job) {
  if (job.slot === "image.generate") return "start_frame";
  if (job.slot === "image.edit") return "end_frame";
  if (job.slot === "image.reference_asset") return "reference_asset";
  if (String(job.slot).startsWith("video.")) return "video_parked";
  return "unknown";
}

function buildShotPromptPlan(job, shot, assets, sourceIndex, providerRegistry, knowledgeManifest, generatedAt) {
  const capabilityResult = validateJobAgainstCapability(job, providerRegistry);
  const promptKind = promptKindForJob(job);
  const referenceIds = uniqueSorted(job.references || []);
  const referencedAssets = assets.filter((asset) => referenceIds.includes(asset.path) || referenceIds.includes(asset.id));
  const sourceShotSpecHash = hashString(JSON.stringify(canonicalize({
    sourceIndexHash: sourceIndex.sourceIndexHash,
    shot: shot ? { id: shot.id, title: shot.title, storyFunction: shot.storyFunction, issues: shot.issues } : undefined,
    job: { id: job.id, slot: job.slot, requiredMode: job.requiredMode, outputPath: job.outputPath, references: job.references },
  })), "shot_spec");
  const conflicts = capabilityResult.blockers.map((detail) => ({
    code: "provider_capability_blocker",
    severity: "blocker",
    target: job.id,
    detail,
  }));
  const derivesFromStartFrame = promptKind === "end_frame"
    ? Boolean(shot?.startFrame && !(shot.issues || []).includes("missing_start_frame"))
    : undefined;
  if (promptKind === "end_frame" && !derivesFromStartFrame) {
    conflicts.push({
      code: "end_frame_missing_start_derivation",
      severity: "blocker",
      target: job.id,
      detail: "End-frame image.edit must record derivesFromStartFrame=true or stay blocked.",
    });
  }
  for (const asset of referencedAssets) {
    if (asset.lockedStatus !== "locked" || !asset.safeForFutureReference) {
      conflicts.push({
        code: "unsafe_reference_in_prompt_plan",
        severity: asset.status === "missing" ? "blocker" : "warning",
        target: asset.id,
        detail: `${asset.type}:${asset.id} is not a locked future-safe reference.`,
      });
    }
  }
  const adapterWarnings = [...capabilityResult.warnings];
  if (promptKind === "video_parked") adapterWarnings.push("Video prompt plan is parked; no Seedance/Jimeng submit is allowed.");
  const promptPlanId = `prompt_plan_${job.id}`;
  const conflictReportId = `prompt_conflict_${job.id}`;
  const blockers = conflicts.filter((conflict) => conflict.severity === "blocker").map((conflict) => conflict.detail);
  const status = blockers.length ? "blocked" : promptKind === "video_parked" ? "draft" : "ready_for_envelope";
  const styleDirectives = (knowledgeManifest.packs || [])
    .filter((pack) => pack.enabled && ["style", "composition", "camera", "lighting", "color", "prompt"].includes(pack.category))
    .slice(0, 6)
    .map((pack) => `${pack.category}:${pack.id}@${pack.hash}`);
  const planWithoutHash = {
    promptPlanId,
    sourceShotSpecHash,
    jobId: job.id,
    shotId: shot?.id,
    providerId: capabilityResult.capability?.providerId || job.providerId || "unknown",
    providerSlot: job.slot,
    requiredMode: job.requiredMode,
    promptKind,
    sourceIntent: [
      shot?.title ? `shot_title:${shot.title}` : "",
      shot?.storyFunction ? `story_function:${shot.storyFunction}` : "",
      job.promptPath ? `prompt_source_path:${job.promptPath}` : "",
    ].filter(Boolean),
    naturalLanguagePolicy: "source_intent_only",
    mustPreserve: [
      "locked character identity",
      "locked scene layout",
      "style capsule",
      ...(promptKind === "end_frame" ? ["start frame composition"] : []),
    ],
    mustAvoid: [
      "provider or mode fallback",
      "unlocked candidate as future reference",
      "natural language patch applied directly to provider prompt",
      ...(promptKind === "end_frame" ? ["text2image fallback"] : []),
    ],
    referenceIds,
    styleDirectives: styleDirectives.length ? styleDirectives : ["Use only routed knowledge summaries as compiler hints."],
    adapterWarnings,
    derivesFromStartFrame,
    status,
    blockers,
    conflictReportId,
    createdAt: generatedAt,
  };
  const plan = {
    ...planWithoutHash,
    promptPlanHash: hashString(JSON.stringify(canonicalize(planWithoutHash)), "prompt_plan"),
  };
  const conflictReport = {
    reportId: conflictReportId,
    promptPlanId,
    jobId: job.id,
    shotId: shot?.id,
    status: conflicts.some((conflict) => conflict.severity === "blocker")
      ? "blocked"
      : conflicts.some((conflict) => conflict.severity === "warning")
        ? "warning"
        : "clear",
    conflicts,
    checkedAt: generatedAt,
  };
  return { plan, conflictReport };
}

function buildAssetReadinessReport(shot, assets, sourceIndex, jobs, generatedAt) {
  const shotJobs = jobs.filter((job) => job.id.includes(shot.id));
  const referencedIds = uniqueSorted(shotJobs.flatMap((job) => job.references || []));
  const sourceLocked = sourceIndex.lockedReferenceIds || [];
  const sourceCandidate = sourceIndex.candidateReferenceIds || [];
  const sourceRejected = (sourceIndex.rejectedReferenceIds || []).filter((id) => referencedIds.includes(id));
  const sourceFailed = (sourceIndex.failedReferenceIds || []).filter((id) => referencedIds.includes(id));
  const sourceCandidateReferenced = sourceCandidate.filter((id) => referencedIds.includes(id));
  const knownAssetReferenceIds = new Set(assets.flatMap((asset) => [asset.id, asset.path]).filter(Boolean));
  const knownSourceReferenceIds = new Set([
    ...sourceLocked,
    ...sourceCandidate,
    ...(sourceIndex.rejectedReferenceIds || []),
    ...(sourceIndex.failedReferenceIds || []),
  ]);
  const missingReferenceIds = referencedIds.filter((id) => !knownAssetReferenceIds.has(id) && !knownSourceReferenceIds.has(id));
  const referencedAssets = assets.filter((asset) => referencedIds.includes(asset.id) || referencedIds.includes(asset.path));
  const scopedAssets = referencedIds.length ? referencedAssets : assets;
  const safeAssets = scopedAssets.filter((asset) =>
    asset.status !== "missing" &&
    asset.lockedStatus === "locked" &&
    asset.safeForFutureReference &&
    (sourceIndex.lockedReferenceIds.includes(asset.path) || sourceIndex.lockedReferenceIds.includes(asset.id))
  );
  const candidateAssets = scopedAssets.filter((asset) => asset.status !== "missing" && asset.lockedStatus !== "locked");
  const missingAssets = scopedAssets.filter((asset) => asset.status === "missing");
  const tempAssets = scopedAssets.filter((asset) =>
    ["candidate", "needs_review"].includes(asset.lockedStatus) ||
    (asset.issues || []).some((issue) => /temp|candidate|protocol_pass_needs_visual_audit/.test(issue))
  );
  const hasLockedScene = scopedAssets.some((asset) => asset.type === "scene" && safeAssets.some((safe) => safe.id === asset.id));
  const hasLockedCharacter = scopedAssets.some((asset) => asset.type === "character" && safeAssets.some((safe) => safe.id === asset.id));
  const blockers = [];
  const warnings = [];
  if (!hasLockedScene) warnings.push("No locked scene view is available; formal output must stay blocked.");
  if (!hasLockedCharacter) warnings.push("No locked character reference is available; formal output must stay blocked.");
  if (missingAssets.length || missingReferenceIds.length) blockers.push(`${missingAssets.length + missingReferenceIds.length} referenced asset(s) are missing.`);
  if (sourceRejected.length) blockers.push("Rejected references are present in this shot scope.");
  if (sourceFailed.length) blockers.push("Failed references are present in this shot scope.");
  if (candidateAssets.length || sourceCandidateReferenced.length || tempAssets.length) warnings.push("Candidate/temp references are draft-only and cannot become future reference authority.");
  const unsafeReferenceIds = uniqueSorted([
    ...candidateAssets.map((asset) => asset.id),
    ...missingAssets.map((asset) => asset.id),
    ...tempAssets.map((asset) => asset.id),
    ...sourceCandidateReferenced,
    ...sourceRejected,
    ...sourceFailed,
    ...missingReferenceIds,
  ]);
  const formalBlocked = blockers.length > 0 || !hasLockedScene || !hasLockedCharacter || unsafeReferenceIds.length > 0;
  const status = blockers.length ? "blocked" : formalBlocked ? "draft_only" : "ready";
  return {
    reportId: `asset_readiness_${hashString(`${shot.id}:${generatedAt}`, "vci").replace(/^vci_/, "")}`,
    shotId: shot.id,
    assetIds: uniqueSorted(scopedAssets.map((asset) => asset.id || asset.path)),
    status,
    formalBlocked,
    blockers,
    warnings,
    safeReferenceIds: uniqueSorted(safeAssets.map((asset) => asset.id)),
    unsafeReferenceIds,
    lockedReferenceIds: uniqueSorted(safeAssets.map((asset) => asset.id)),
    candidateReferenceIds: uniqueSorted([...candidateAssets.map((asset) => asset.id), ...sourceCandidateReferenced]),
    missingReferenceIds: uniqueSorted([...missingAssets.map((asset) => asset.id), ...missingReferenceIds]),
    rejectedReferenceIds: sourceRejected,
    tempReferenceIds: uniqueSorted(tempAssets.map((asset) => asset.id)),
    failedReferenceIds: uniqueSorted([...missingAssets.map((asset) => asset.id), ...sourceFailed]),
    checkedAt: generatedAt,
  };
}

function taskEnvelopeSummary(envelope, promptPlan) {
  if (!envelope) return undefined;
  return {
    envelopeId: envelope.id,
    providerSlot: envelope.providerSlot,
    providerId: envelope.providerId,
    requiredMode: envelope.requiredMode,
    sourceIndexHash: envelope.sourceIndexHash,
    promptPlanId: envelope.promptPlanId || promptPlan.promptPlanId,
    promptPlanHash: envelope.promptPlanHash || promptPlan.promptPlanHash,
    sourceShotSpecHash: envelope.sourceShotSpecHash || promptPlan.sourceShotSpecHash,
    expectedOutputs: envelope.expectedOutputs || [],
    preflightStatus: envelope.preflight?.status || "blocked",
    blockingReasons: envelope.blockingReasons || [],
  };
}

function isImageSlot(job) {
  return ["image.generate", "image.edit", "image.reference_asset"].includes(job.slot);
}

function buildImageTaskPlan(job, promptPlan, readinessReport, sourceIndex, taskEnvelope) {
  const blockers = [];
  const warnings = [];
  const expectedOutputPath = job.outputPath || taskEnvelope?.expectedOutputs?.[0] || "missing-output-path";

  if (!isImageSlot(job)) {
    blockers.push(
      String(job.slot).startsWith("video.")
        ? "Video generation is parked for Phase 4 dry-run and must not create an Image2 adapter request."
        : `${job.slot} is not an Image2 image slot.`,
    );
  }
  if (promptPlan.status === "blocked") blockers.push(...(promptPlan.blockers || []));
  if (promptPlan.status === "draft") warnings.push("Prompt plan is draft and cannot move beyond dry-run planning.");
  if (expectedOutputPath === "missing-output-path") blockers.push("Task has no expected output path.");
  if (!sourceIndex.sourceIndexHash) blockers.push("Source index hash is missing.");
  if (readinessReport) {
    blockers.push(...(readinessReport.blockers || []));
    warnings.push(...(readinessReport.warnings || []));
    if (readinessReport.formalBlocked) {
      warnings.push("Asset readiness blocks formal promotion; adapter request remains dry-run only.");
    }
  } else {
    warnings.push("No shot-level asset readiness report was available for this task plan.");
  }

  const status = blockers.length
    ? "blocked"
    : promptPlan.status === "ready_for_envelope" && isImageSlot(job)
      ? "ready_for_dry_run"
      : "draft";

  return {
    taskPlanId: `image_task_plan_${job.id}`,
    jobId: job.id,
    shotId: promptPlan.shotId || readinessReport?.shotId || "unscoped",
    promptPlanId: promptPlan.promptPlanId,
    providerSlot: promptPlan.providerSlot,
    requiredMode: promptPlan.requiredMode,
    providerId: promptPlan.providerId,
    mode: promptPlan.requiredMode,
    status,
    expectedOutputPath,
    inputReferenceIds: uniqueSorted(promptPlan.referenceIds || []),
    sourcePromptPlanHash: promptPlan.promptPlanHash,
    sourceShotSpecHash: promptPlan.sourceShotSpecHash,
    taskEnvelopeSummary: taskEnvelopeSummary(taskEnvelope, promptPlan),
    blockers: uniqueSorted(blockers),
    warnings: uniqueSorted([...warnings, ...(promptPlan.adapterWarnings || [])]),
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  };
}

function operationForImage2(taskPlan) {
  if (taskPlan.providerSlot === "image.reference_asset") return "reference_asset";
  if (taskPlan.requiredMode === "image2image") return "image2image";
  return "text2image";
}

function forbiddenFallbacksForImage2(taskPlan) {
  const fallbacks = ["provider_or_mode_fallback"];
  if (taskPlan.requiredMode === "image2image" || taskPlan.providerSlot === "image.edit") {
    fallbacks.push("image2image_to_text2image");
  }
  if (taskPlan.providerSlot === "image.reference_asset" && taskPlan.requiredMode === "image2image") {
    fallbacks.push("reference_edit_to_text2image");
  }
  if (taskPlan.requiredMode === "text2image") fallbacks.push("text2image_to_image2image");
  return uniqueSorted(fallbacks);
}

function buildImage2AdapterRequest(taskPlan, promptPlan) {
  return {
    requestId: `image2_request_${taskPlan.taskPlanId}`,
    taskPlanId: taskPlan.taskPlanId,
    adapterId: "image2-dry-run",
    operation: operationForImage2(taskPlan),
    payload: {
      sourceIntent: promptPlan.sourceIntent || [],
      mustPreserve: promptPlan.mustPreserve || [],
      mustAvoid: promptPlan.mustAvoid || [],
      references: (taskPlan.inputReferenceIds || []).map((referenceId) => ({ referenceId, source: "prompt_plan" })),
      outputPath: taskPlan.expectedOutputPath,
    },
    submitPolicy: {
      dry_run_only: true,
      manual_submit_required: true,
      live_submit_forbidden: true,
    },
    forbiddenFallbacks: forbiddenFallbacksForImage2(taskPlan),
  };
}

function normalizePathValue(pathValue) {
  return String(pathValue || "").replace(/\\/g, "/");
}

function snapshotPaths(snapshot) {
  if (Array.isArray(snapshot)) {
    return new Set(snapshot.map((entry) => normalizePathValue(typeof entry === "string" ? entry : entry.path)));
  }
  return new Set(Object.keys(snapshot || {}).map(normalizePathValue));
}

function basename(pathValue) {
  const parts = normalizePathValue(pathValue).split("/");
  return parts[parts.length - 1] || pathValue;
}

function watcherEventId(eventType, taskPlan, artifactPath) {
  return `watcher_${eventType}_${taskPlan.taskPlanId}_${hashString(artifactPath || taskPlan.expectedOutputPath, "watcher").replace(/^watcher_/, "")}`;
}

function makeWatcherEvent(eventType, taskPlan, status, severity, createdAt, notes, artifactPath) {
  return {
    id: watcherEventId(eventType, taskPlan, artifactPath),
    eventType,
    taskId: taskPlan.taskPlanId,
    jobId: taskPlan.jobId,
    shotId: taskPlan.shotId,
    artifactPath,
    expectedOutputPath: taskPlan.expectedOutputPath,
    status,
    severity,
    createdAt,
    notes,
  };
}

function isTempCandidate(pathValue) {
  const normalized = normalizePathValue(pathValue);
  return /(^|\/)(tmp|temp|cache|candidates?|drafts?)(\/|$)/i.test(normalized) || /[_\-.](tmp|temp|candidate|draft)\./i.test(pathValue);
}

function isQaReportPath(pathValue) {
  const normalized = normalizePathValue(pathValue);
  return /(^|\/)(qa|reports?)(\/|$)/i.test(normalized) || /qa|quality|audit/i.test(basename(pathValue));
}

function matchesTaskPath(pathValue, taskPlan) {
  const haystack = normalizePathValue(pathValue).toLowerCase();
  return [taskPlan.taskPlanId, taskPlan.jobId, taskPlan.shotId, basename(taskPlan.expectedOutputPath)]
    .filter(Boolean)
    .some((token) => haystack.includes(String(token).toLowerCase()));
}

function manifestReportForTaskPlan(taskPlan, reports) {
  return (reports || []).find((report) => report.taskId === taskPlan.jobId || report.taskId === taskPlan.taskPlanId);
}

function buildWatcherEventsFromImagePipeline({ imageTaskPlans, adapterRequests, fileSnapshot, manifestReports, createdAt }) {
  const paths = snapshotPaths(fileSnapshot);
  const normalizedPaths = Array.from(paths);
  const adapterTaskIds = new Set(adapterRequests.map((request) => request.taskPlanId));
  const watcherEvents = [];

  for (const taskPlan of imageTaskPlans) {
    const expectedPath = normalizePathValue(taskPlan.expectedOutputPath);
    const expectedExists = paths.has(expectedPath);
    const manifestReport = manifestReportForTaskPlan(taskPlan, manifestReports || []);

    if (taskPlan.status === "blocked" || taskPlan.blockers.length > 0) {
      watcherEvents.push(
        makeWatcherEvent(
          "blocked",
          taskPlan,
          "blocked",
          "blocker",
          createdAt,
          taskPlan.blockers.length ? taskPlan.blockers : ["Image task plan is blocked."],
        ),
      );
    }

    if (expectedExists) {
      watcherEvents.push(
        makeWatcherEvent(
          "expected_output_detected",
          taskPlan,
          "detected",
          "info",
          createdAt,
          ["Expected output exists in the imported file snapshot."],
          taskPlan.expectedOutputPath,
        ),
      );
    }

    for (const tempPath of normalizedPaths.filter((item) => item !== expectedPath && isTempCandidate(item) && matchesTaskPath(item, taskPlan))) {
      watcherEvents.push(
        makeWatcherEvent("temp_output_detected", taskPlan, "detected", "warning", createdAt, ["Temp or candidate output is draft-only."], tempPath),
      );
    }

    for (const candidatePath of normalizedPaths.filter(
      (item) => item !== expectedPath && !isTempCandidate(item) && !isQaReportPath(item) && matchesTaskPath(item, taskPlan),
    )) {
      watcherEvents.push(
        makeWatcherEvent(
          "provider_ready_derivative_detected",
          taskPlan,
          "detected",
          "info",
          createdAt,
          ["A non-formal derivative exists and still needs manifest/QA gates before promotion."],
          candidatePath,
        ),
      );
    }

    for (const qaPath of normalizedPaths.filter((item) => isQaReportPath(item) && matchesTaskPath(item, taskPlan))) {
      watcherEvents.push(makeWatcherEvent("qa_report_detected", taskPlan, "detected", "info", createdAt, ["QA report artifact detected."], qaPath));
    }

    if (manifestReport?.status === "postprocess_recoverable") {
      const recoverablePaths = manifestReport.recoverableOutputs.length
        ? manifestReport.recoverableOutputs
        : [manifestReport.outputMatches?.[0]?.actualPath].filter(Boolean);
      for (const recoverablePath of recoverablePaths) {
        watcherEvents.push(
          makeWatcherEvent(
            "postprocess_recoverable",
            taskPlan,
            "recoverable",
            "warning",
            createdAt,
            ["Expected output is missing, but a recoverable derivative exists."],
            recoverablePath,
          ),
        );
      }
    }

    if (manifestReport && manifestReport.status !== "actual_output_present" && manifestReport.status !== "complete") {
      watcherEvents.push(
        makeWatcherEvent(
          "manifest_mismatch_detected",
          taskPlan,
          "failed",
          expectedExists ? "warning" : "blocker",
          createdAt,
          [manifestReport.missingExpectedOutputs.length ? "Manifest still reports missing expected output." : `Manifest status is ${manifestReport.status}.`],
        ),
      );
    }

    if (!expectedExists && adapterTaskIds.has(taskPlan.taskPlanId) && taskPlan.status !== "blocked") {
      watcherEvents.push(
        makeWatcherEvent(
          "worker_exit_without_expected_output",
          taskPlan,
          "failed",
          "warning",
          createdAt,
          ["Adapter request exists, but expected output is absent; worker self-report cannot mark the task complete."],
        ),
      );
    }
  }

  return watcherEvents.sort((left, right) => left.id.localeCompare(right.id));
}

function hasManifestMatch(status) {
  return ["actual_output_present", "complete", "matched"].includes(status);
}

function promptIsStaleForTaskPlan(taskPlan, promptPlan) {
  if (!promptPlan) return false;
  return promptPlan.promptPlanHash !== taskPlan.sourcePromptPlanHash || promptPlan.sourceShotSpecHash !== taskPlan.sourceShotSpecHash;
}

function qaStatusForTaskPlan(taskPlan, outputExists, watcherEvents, qaStatusByOutputPath = {}) {
  const configured = qaStatusByOutputPath[taskPlan.expectedOutputPath] || qaStatusByOutputPath[normalizePathValue(taskPlan.expectedOutputPath)];
  if (configured) return configured;
  if (!outputExists) return "missing";
  const hasReportEvent = watcherEvents.some(
    (event) => event.eventType === "qa_report_detected" && (event.taskId === taskPlan.taskPlanId || event.jobId === taskPlan.jobId),
  );
  return hasReportEvent ? "pending" : "missing";
}

function generationHealthStatus({ blocked, outputExists, manifestMatched, stalePrompt, assetReady, qaStatus }) {
  if (blocked || stalePrompt || (outputExists && !assetReady)) return "blocked";
  if (!outputExists || !manifestMatched) return "waiting";
  if (qaStatus === "fail") return "failed";
  if (["missing", "pending", "unknown"].includes(qaStatus)) return "qa_pending";
  if (qaStatus === "pass" && assetReady) return "formal_ready";
  return "output_detected";
}

function nextActionForHealth(status) {
  if (status === "formal_ready") return "Ready for QA promotion review.";
  if (status === "qa_pending") return "Wait for explicit QA pass before formal promotion.";
  if (status === "waiting") return "Wait for expected output and rerun manifest match.";
  if (status === "failed") return "Review failing QA and regenerate or repair.";
  if (status === "blocked") return "Resolve blockers before promotion.";
  return "Output detected; run QA gate next.";
}

function buildGenerationHealthReports({ imageTaskPlans, fileSnapshot, manifestReports, watcherEvents = [], assetReadinessReports = [], promptPlans = [], qaStatusByOutputPath = {} }) {
  const paths = snapshotPaths(fileSnapshot);

  return imageTaskPlans.map((taskPlan) => {
    const expectedPath = normalizePathValue(taskPlan.expectedOutputPath);
    const manifestReport = manifestReportForTaskPlan(taskPlan, manifestReports || []);
    const manifestStatus = manifestReport?.status || (paths.has(expectedPath) ? "actual_output_present" : "missing_expected_output");
    const outputExists = paths.has(expectedPath) || hasManifestMatch(manifestStatus);
    const promptPlan = promptPlans.find((plan) => plan.promptPlanId === taskPlan.promptPlanId);
    const stalePrompt = promptIsStaleForTaskPlan(taskPlan, promptPlan);
    const readinessReport = assetReadinessReports.find((report) => report.shotId === taskPlan.shotId);
    const assetReadinessStatus = readinessReport?.status || "missing";
    const assetReady = Boolean(readinessReport && readinessReport.status === "ready" && !readinessReport.formalBlocked);
    const qaStatus = qaStatusForTaskPlan(taskPlan, outputExists, watcherEvents, qaStatusByOutputPath);
    const manifestMatched = hasManifestMatch(manifestStatus);
    const blockers = uniqueSorted([
      ...(taskPlan.blockers || []),
      ...(taskPlan.status === "blocked" ? ["Image task plan is blocked."] : []),
      ...(outputExists ? [] : ["Expected output is missing from the file snapshot."]),
      ...(manifestMatched ? [] : [`Manifest status is ${manifestStatus}.`]),
      ...(stalePrompt ? ["Prompt plan hash differs from the image task plan source hash."] : []),
      ...(readinessReport && !assetReady ? readinessReport.blockers : []),
    ]);
    const warnings = uniqueSorted([
      ...(taskPlan.warnings || []),
      ...(readinessReport?.warnings || []),
      ...(readinessReport ? [] : ["No asset readiness report was available for this task plan."]),
      ...(["missing", "pending"].includes(qaStatus) ? ["Missing explicit QA pass; worker success cannot promote formal output."] : []),
    ]);
    const healthStatus = generationHealthStatus({
      blocked: taskPlan.status === "blocked" || taskPlan.blockers.length > 0,
      outputExists,
      manifestMatched,
      stalePrompt,
      assetReady,
      qaStatus,
    });

    return {
      reportId: `generation_health_${taskPlan.taskPlanId}`,
      taskPlanId: taskPlan.taskPlanId,
      jobId: taskPlan.jobId,
      shotId: taskPlan.shotId,
      expectedOutputPath: taskPlan.expectedOutputPath,
      outputExists,
      manifestStatus,
      qaStatus,
      stalePrompt,
      assetReadinessStatus,
      healthStatus,
      blockers,
      warnings,
      nextAction: nextActionForHealth(healthStatus),
    };
  });
}

function promotionStatusForReport({ allGatesPass, formalAlreadyPromoted, expectedOutput, manifestMatch, promptFresh, assetReadiness, qaPass, qaStatus }) {
  if (allGatesPass && formalAlreadyPromoted) return "promoted";
  if (allGatesPass) return "ready_for_promotion";
  if (expectedOutput && manifestMatch && promptFresh && assetReadiness && !qaPass) return "qa_pending";
  if (!expectedOutput) return "candidate";
  return ["pending", "missing"].includes(qaStatus) ? "qa_pending" : "blocked";
}

function buildQaPromotionReports({ imageTaskPlans, fileSnapshot, manifestReports, generationHealthReports, assetReadinessReports, promptPlans, qaStatusByOutputPath, promotedFormalPaths = [] }) {
  const healthReports = generationHealthReports || buildGenerationHealthReports({
    imageTaskPlans,
    fileSnapshot,
    manifestReports,
    assetReadinessReports,
    promptPlans,
    qaStatusByOutputPath,
  });
  const healthByTaskPlan = new Map(healthReports.map((report) => [report.taskPlanId, report]));
  const promotedPaths = new Set(promotedFormalPaths.map(normalizePathValue));

  return imageTaskPlans.map((taskPlan) => {
    const health = healthByTaskPlan.get(taskPlan.taskPlanId);
    const expectedOutput = Boolean(health?.outputExists);
    const manifestMatch = hasManifestMatch(health?.manifestStatus || "missing_expected_output");
    const promptFresh = !health?.stalePrompt;
    const assetReadiness = health?.assetReadinessStatus === "ready";
    const qaPass = health?.qaStatus === "pass";
    const healthClear = health?.healthStatus !== "blocked" && health?.healthStatus !== "failed";
    const taskPlanClear = taskPlan.status !== "blocked";
    const requiredGates = { expectedOutput, manifestMatch, promptFresh, assetReadiness, qaPass };
    const formalPath = taskPlan.expectedOutputPath;
    const blockers = uniqueSorted([
      ...(expectedOutput ? [] : ["Expected output is required before formal promotion."]),
      ...(manifestMatch ? [] : [`Manifest match is required before formal promotion${health?.manifestStatus ? ` (${health.manifestStatus})` : ""}.`]),
      ...(promptFresh ? [] : ["Prompt must be fresh before formal promotion."]),
      ...(assetReadiness ? [] : ["Asset readiness must be ready before formal promotion."]),
      ...(qaPass ? [] : ["Explicit QA pass is required before formal promotion."]),
      ...(healthClear ? [] : [`Generation health must not be ${health?.healthStatus} before formal promotion.`]),
      ...(taskPlanClear ? [] : ["Task plan must not be blocked before formal promotion."]),
      ...(health?.blockers || []),
    ]);
    const canPromoteToFormal = Object.values(requiredGates).every(Boolean) && healthClear && taskPlanClear && blockers.length === 0;
    const warnings = uniqueSorted([...(health?.warnings || []), "Worker or provider self-report is not a formal success gate."]);

    return {
      reportId: `qa_promotion_${taskPlan.taskPlanId}`,
      taskPlanId: taskPlan.taskPlanId,
      jobId: taskPlan.jobId,
      shotId: taskPlan.shotId,
      candidatePath: taskPlan.expectedOutputPath,
      formalPath,
      promotionStatus: promotionStatusForReport({
        allGatesPass: canPromoteToFormal,
        formalAlreadyPromoted: promotedPaths.has(normalizePathValue(formalPath)),
        expectedOutput,
        manifestMatch,
        promptFresh,
        assetReadiness,
        qaPass,
        qaStatus: health?.qaStatus || "unknown",
      }),
      requiredGates,
      blockers,
      warnings,
      canPromoteToFormal,
    };
  });
}

function computeSourceIndexHash(index) {
  return hashString(JSON.stringify(canonicalize(index)));
}

function actLabel(actId) {
  const match = /^A(\d+)$/i.exec(actId);
  if (!match) return actId === "unknown" ? "Unknown Act" : actId;
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][Number(match[1]) - 1];
  return roman ? `Act ${roman}` : `Act ${match[1]}`;
}

function buildStorySections(shots) {
  const groups = new Map();
  for (const shot of shots) {
    const key = shot.sectionId || shot.actId || "unknown";
    groups.set(key, [...(groups.get(key) || []), shot]);
  }

  return Array.from(groups.entries()).map(([id, sectionShots]) => ({
    id,
    label: id === sectionShots[0]?.actId ? actLabel(id) : `${actLabel(sectionShots[0]?.actId || "unknown")} / ${id}`,
    shotCount: sectionShots.length,
    blockedCount: sectionShots.filter((shot) => shot.status === "blocked" || shot.status === "video_missing").length,
    readyCount: sectionShots.filter((shot) => shot.status === "ready" || shot.status === "keyframe_pair_ready").length,
    shotIds: sectionShots.map((shot) => shot.id),
  }));
}

function buildVisualMemorySummary(audit) {
  const byType = Array.from(new Set(audit.assets.map((asset) => asset.type))).sort().map((type) => {
    const assets = audit.assets.filter((asset) => asset.type === type);
    return {
      type,
      total: assets.length,
      existing: assets.filter((asset) => asset.status !== "missing").length,
      missing: assets.filter((asset) => asset.status === "missing").length,
    };
  });

  return {
    total: audit.assets.length,
    existing: audit.assets.filter((asset) => asset.status !== "missing").length,
    locked: audit.assets.filter((asset) => asset.lockedStatus === "locked").length,
    needsReview: audit.assets.filter((asset) => asset.lockedStatus === "needs_review" || asset.lockedStatus === "candidate").length,
    missing: audit.assets.filter((asset) => asset.status === "missing").length,
    byType,
  };
}

function buildSourceIndex(audit, knowledgeManifest) {
  const lockedReferenceIds = audit.assets
    .filter((asset) => asset.status !== "missing" && asset.lockedStatus === "locked" && asset.safeForFutureReference)
    .map((asset) => asset.path);
  const candidateReferenceIds = [
    ...audit.assets.filter((asset) => asset.status !== "missing" && !lockedReferenceIds.includes(asset.path)).map((asset) => asset.path),
    ...audit.shots.flatMap((shot) => [shot.startFrame, shot.endFrame].filter(Boolean)),
  ];
  const index = {
    projectId: audit.projectTitle.replace(/\s+/g, "-").toLowerCase() || "runtime-project",
    projectVersion: audit.importedAt,
    sourceIndexHash: "",
    currentProductionBibleId: audit.sourceTask || undefined,
    currentStoryFlowId: `${audit.projectRoot}/00_task/shot_spec.yaml`,
    currentVisualMemoryId: `${audit.projectRoot}/visual_memory`,
    currentPromptHashes: Object.fromEntries(audit.jobs.filter((job) => job.promptPath).map((job) => [job.id, job.promptPath])),
    lockedReferenceIds: uniqueSorted(lockedReferenceIds),
    candidateReferenceIds: uniqueSorted(candidateReferenceIds),
    rejectedReferenceIds: [],
    failedReferenceIds: uniqueSorted(audit.assets.filter((asset) => asset.status === "missing").map((asset) => asset.path)),
    confirmedDecisionIds: [],
    staleArtifactIds: [],
    knowledgeLibraryRoot: knowledgeManifest.knowledgeLibraryRoot,
    activeKnowledgePackIds: (knowledgeManifest.packs || []).filter((pack) => pack.enabled).map((pack) => pack.id),
    disabledKnowledgePackIds: (knowledgeManifest.packs || []).filter((pack) => !pack.enabled).map((pack) => pack.id),
    knowledgeManifestHash: knowledgeManifest.manifestHash,
    packVersionBindings: Object.fromEntries((knowledgeManifest.packs || []).map((pack) => [pack.id, { version: pack.version, hash: pack.hash }])),
    updatedAt: audit.importedAt,
  };

  return { ...index, sourceIndexHash: computeSourceIndexHash(index) };
}

function summarizeSourceIndex(index) {
  const currentSourceIds = [
    index.currentProductionBibleId,
    index.currentStoryFlowId,
    index.currentShotSpecId,
    index.currentVisualMemoryId,
    index.currentSpatialMemoryId,
    index.currentStyleCapsuleId,
    index.currentVoiceMemoryId,
  ].filter(Boolean);
  const blockingReferenceCount = index.rejectedReferenceIds.length + index.failedReferenceIds.length + index.staleArtifactIds.length;

  return {
    projectId: index.projectId,
    projectVersion: index.projectVersion,
    sourceIndexHash: computeSourceIndexHash(index),
    currentSourceCount: currentSourceIds.length,
    promptHashCount: Object.keys(index.currentPromptHashes).length,
    lockedReferenceCount: index.lockedReferenceIds.length,
    candidateReferenceCount: index.candidateReferenceIds.length,
    rejectedReferenceCount: index.rejectedReferenceIds.length,
    failedReferenceCount: index.failedReferenceIds.length,
    confirmedDecisionCount: index.confirmedDecisionIds.length,
    staleArtifactCount: index.staleArtifactIds.length,
    updatedAt: index.updatedAt,
    isProductionReady: blockingReferenceCount === 0 && index.lockedReferenceIds.length > 0,
    blockingReferenceCount,
  };
}

function purposeFromSlot(slot) {
  if (slot === "image.reference_asset") return "asset";
  if (slot === "image.generate" || slot === "image.edit") return "keyframe";
  if (slot === "video.i2v") return "video";
  return "unknown";
}

function knowledgePurposeFromSlot(slot) {
  if (slot === "image.reference_asset") return "asset";
  if (slot === "image.generate") return "keyframe";
  if (slot === "image.edit") return "edit";
  if (slot === "video.i2v") return "i2v";
  if (slot === "audio.tts" || slot === "audio.music") return "audio";
  return "unknown";
}

function referenceFromPath(pathValue, sourceIndex) {
  const locked = sourceIndex.lockedReferenceIds.includes(pathValue);
  const rejected = sourceIndex.rejectedReferenceIds.includes(pathValue);
  const failed = sourceIndex.failedReferenceIds.includes(pathValue);
  return {
    id: pathValue,
    path: pathValue,
    referenceRole: rejected || failed ? "rejected_case" : locked ? "identity_authority" : "temp_candidate",
    authorityScope: locked ? ["prompt_reference", "future_reference"] : ["draft_preview"],
    polarity: rejected || failed ? "negative" : "positive",
    lockedStatus: rejected || failed ? "rejected" : locked ? "locked" : "candidate",
    allowedUse: locked ? ["prompt_reference", "future_reference", "draft_preview"] : ["draft_preview"],
    canPromoteToFormal: locked,
    canUseAsFutureReference: locked,
    contaminationReason: locked ? undefined : "Reference has not passed formal authority lock.",
  };
}

function buildKeyframePairDerivation(job, shot) {
  if (job.slot !== "video.i2v" || !shot) return undefined;
  const hasFrames = Boolean(shot.startFrame && shot.endFrame && !shot.issues.includes("missing_start_frame") && !shot.issues.includes("missing_end_frame"));
  return {
    shotId: shot.id,
    startFrameId: shot.startFrame || `${shot.id}:start`,
    endFrameId: shot.endFrame || `${shot.id}:end`,
    endDerivationSource: hasFrames ? "start_frame" : "unknown",
    validForI2vPair: hasFrames && (shot.gates.pair === "PASS" || shot.gates.pair === "PARTIAL"),
    exceptionReason: hasFrames ? undefined : "Start or end keyframe is missing from runtime audit.",
    allowedDelta: ["motion", "micro-expression", "camera movement"],
    mustPreserve: ["character identity", "scene layout", "style capsule"],
    mustNotAdd: ["new characters", "unapproved props", "text-to-video fallback"],
  };
}

function buildKnowledgeSummary(knowledgeManifest) {
  const packs = knowledgeManifest.packs || [];
  const categories = Array.from(new Set(packs.map((pack) => pack.category))).sort().map((category) => {
    const categoryPacks = packs.filter((pack) => pack.category === category);
    return {
      category,
      count: categoryPacks.length,
      enabled: categoryPacks.filter((pack) => pack.enabled).length,
    };
  });

  return {
    packCount: packs.length,
    enabledCount: packs.filter((pack) => pack.enabled).length,
    categories,
    manifestHash: knowledgeManifest.manifestHash || "",
    manifestVersion: knowledgeManifest.manifestVersion || "",
    validationIssues: [],
    bindings: packs.map((pack) => ({
      packId: pack.id,
      version: pack.version,
      hash: pack.hash,
      category: pack.category,
      title: pack.title,
      summary: pack.summary,
      tags: pack.tags || [],
      enabled: pack.enabled,
      maxInjectionTokens: pack.maxInjectionTokens || 600,
    })),
  };
}

function matchKnowledgeBindings(job, knowledgeSummary) {
  const purpose = knowledgePurposeFromSlot(job.slot);
  const preferredCategories = {
    asset: ["style", "prompt", "qa", "provider"],
    keyframe: ["composition", "camera", "lighting", "color", "style", "prompt", "qa"],
    edit: ["composition", "camera", "lighting", "color", "style", "prompt", "qa"],
    i2v: ["camera", "performance", "provider", "qa", "prompt"],
    audio: ["audio", "qa"],
    unknown: ["agent", "qa"],
  }[purpose] || ["qa"];

  return knowledgeSummary.bindings
    .filter((binding) => binding.enabled && preferredCategories.includes(binding.category))
    .slice(0, 4)
    .map((binding, index) => ({
      packId: binding.packId,
      version: binding.version,
      hash: binding.hash,
      category: binding.category,
      reason: `Bound through ProjectRuntimeState for ${purpose} task.`,
      consumer: index % 2 === 0 ? "prompt_compiler" : "qa_gate",
      score: Math.max(1, preferredCategories.length - index),
      matchedTerms: [purpose, binding.category].filter(Boolean),
      matchedSnippetIds: [],
    }));
}

function buildRouteAndBudget(job, knowledgeSummary, generatedAt) {
  const matches = matchKnowledgeBindings(job, knowledgeSummary);
  const routeId = `route_${hashString(job.id, "vck")}`;
  const routeResult = {
    routeId,
    taskId: job.id,
    taskPurpose: knowledgePurposeFromSlot(job.slot),
    providerSlot: job.slot,
    contextLevel: "L1",
    inputHash: hashString(`${job.id}:${job.slot}`, "vck"),
    matches,
    warnings: matches.length ? [] : ["No enabled knowledge pack matched this imported task."],
    createdAt: generatedAt,
  };
  const contextBudget = {
    budgetId: `${routeId}_budget`,
    routeId,
    contextLevel: "L1",
    maxInjectionTokens: 900,
    usedTokens: 0,
    injectedKnowledgePacks: matches.map((match) => ({
      packId: match.packId,
      version: match.version,
      hash: match.hash,
      category: match.category,
      reason: match.reason,
      consumer: match.consumer,
      injectedSnippetIds: [],
      summaryHash: match.hash,
      truncated: false,
    })),
    injectedSnippets: [],
    warnings: routeResult.warnings,
    createdAt: generatedAt,
  };

  return { routeResult, contextBudget };
}

function buildPreflight(job, shot, references, sourceIndex, expectedOutputs, keyframePairDerivation, generatedAt) {
  const blockers = [];
  const warnings = [];
  if (!sourceIndex?.sourceIndexHash) {
    blockers.push({
      code: "missing_source_index",
      messageForUser: "Needs source index binding.",
      technicalDetail: "ProjectRuntimeState sourceIndex is missing.",
      target: job.id,
    });
  }
  if (job.providerId === "unknown") {
    blockers.push({
      code: "unknown_provider",
      messageForUser: "任务没有解析出明确 provider，不能提交执行。",
      technicalDetail: `${job.id} providerId is unknown.`,
      target: job.id,
    });
  }
  if (!expectedOutputs.length) {
    blockers.push({
      code: "missing_expected_output",
      messageForUser: "任务没有声明 expected outputs，不能提交执行。",
      technicalDetail: `${job.id} has no outputPath.`,
      target: job.id,
    });
  }
  if (job.slot === "video.i2v" && !keyframePairDerivation?.validForI2vPair) {
    blockers.push({
      code: "invalid_keyframe_pair",
      messageForUser: "Video task needs a valid start/end keyframe pair.",
      technicalDetail: `${shot?.id || job.id} does not have a complete I2V pair.`,
      target: job.id,
    });
  }
  for (const reference of references) {
    if (reference.lockedStatus !== "locked") {
      warnings.push({
        code: "candidate_reference",
        messageForUser: "Reference is a draft candidate, not formal authority.",
        technicalDetail: `${reference.id} is only allowed for draft preview.`,
        target: reference.id,
      });
    }
  }

  return {
    taskId: job.id,
    preflightScope: "formal_execution",
    status: blockers.length ? "blocked" : warnings.length ? "warning" : "pass",
    blockers,
    warnings,
    checkedAt: generatedAt,
  };
}

function buildEnvelope(job, shot, auditIssues, sourceIndex, knowledgeSummary, generatedAt) {
  const rule = policy.rules.find((item) => item.slot === job.slot);
  const expectedOutputs = job.outputPath ? [job.outputPath] : [];
  const references = (job.references || []).map((referencePath) => referenceFromPath(referencePath, sourceIndex));
  const keyframePairDerivation = buildKeyframePairDerivation(job, shot);
  const { routeResult, contextBudget } = buildRouteAndBudget(job, knowledgeSummary, generatedAt);
  const preflight = buildPreflight(job, shot, references, sourceIndex, expectedOutputs, keyframePairDerivation, generatedAt);
  const blockingReasons = [
    ...auditIssues.filter((issue) => issue.severity === "blocker" && (!issue.target || issue.target === job.id || String(issue.target).includes(job.id))).map((issue) => issue.title),
    ...preflight.blockers.map((item) => item.messageForUser),
  ];
  const hardRules = [
    "Use the declared provider slot only.",
    "Do not silently fall back to another model or mode.",
    "Only use locked or approved references as authority.",
  ];
  if (job.slot === "image.edit") hardRules.push("End frame must derive from the start frame unless the shot explicitly crosses location or time.");
  if (job.slot === "video.i2v") {
    hardRules.push("No text-to-video fallback. Use start/end frames only.");
    hardRules.push("No BGM in generated video; sound effects may be handled later.");
  }

  return {
    envelope: {
      id: job.id,
      purpose: purposeFromSlot(job.slot),
      providerSlot: job.slot,
      providerId: job.providerId || rule?.activeProvider || "unknown",
      executionState: rule?.executionState || "planned",
      requiredMode: job.requiredMode,
      storyFunction: shot?.storyFunction,
      sourceIndexHash: sourceIndex.sourceIndexHash,
      promptHash: job.promptPath,
      dependencies: [],
      contextLevel: "L1",
      expectedOutputs,
      hardRules,
      references,
      qaChecklist: ["identity_gate", "scene_gate", "pair_gate", "story_gate", "prop_gate", "style_gate"],
      preflight,
      keyframePairDerivation,
      knowledgeRouteResultId: routeResult.routeId,
      contextBudgetId: contextBudget.budgetId,
      injectedKnowledgePacks: contextBudget.injectedKnowledgePacks,
      injectedKnowledgeSnippetIds: [],
      injectedKnowledgeSnippets: [],
      knowledgeInputHash: routeResult.inputHash,
      knowledgeManifestHash: sourceIndex.knowledgeManifestHash,
      policyBinding: hashString(`${job.id}:${job.slot}:${job.providerId}`, "policy"),
      routeWarnings: routeResult.warnings,
      nonOverridableGateHashes: {},
      outputPath: job.outputPath,
      blockingReasons,
    },
    routeResult,
    contextBudget,
  };
}

function queueGateForEnvelope(envelope) {
  const blockers = [...envelope.preflight.blockers.map((item) => item.messageForUser)];
  const warnings = envelope.preflight.warnings.map((item) => item.messageForUser);
  const rule = policy.rules.find((item) => item.slot === envelope.providerSlot);
  if (!rule) blockers.push(`Provider slot ${envelope.providerSlot} is not registered.`);
  if (envelope.providerId === "unknown") blockers.push("任务没有解析出明确 provider，不能提交执行。");
  if (rule?.forbiddenProviders.includes(envelope.providerId)) blockers.push(`${envelope.providerId} is forbidden for ${envelope.providerSlot}.`);
  if (rule?.allowedProviders.length && !rule.allowedProviders.includes(envelope.providerId)) blockers.push(`${envelope.providerId} is not allowed for ${envelope.providerSlot}.`);
  if (rule && !rule.allowedModes.includes(envelope.requiredMode)) blockers.push(`${envelope.requiredMode} is not supported by ${envelope.providerSlot}.`);
  if (!envelope.expectedOutputs.length) blockers.push("任务没有声明 expected outputs，不能提交执行。");
  if (blockers.length) return { status: "blocked", canEnter: false, blockers: uniqueSorted(blockers), warnings };
  if (["parked", "planned", "unavailable"].includes(rule?.executionState || envelope.executionState)) {
    return {
      status: "parked",
      canEnter: false,
      blockers,
      warnings: uniqueSorted([...warnings, "当前 provider 只允许生成任务占位，不能提交真实执行。"]),
    };
  }
  return { status: "ready", canEnter: true, blockers, warnings };
}

function buildTaskRun(envelope, queueGate, generatedAt) {
  return {
    taskId: envelope.id,
    localStatus: queueGate.status === "parked" ? "parked" : queueGate.canEnter ? "ready_to_submit" : "pending_local",
    providerStatus: "not_submitted",
    providerId: envelope.providerId || "unknown",
    retryCount: 0,
    stallTimeoutSeconds: 600,
    tempDirs: [],
    expectedOutputs: envelope.expectedOutputs,
    actualOutputs: [],
    lastEventAt: generatedAt,
  };
}

function buildManifestMatch(taskRun, snapshotPaths) {
  const missingExpectedOutputs = [];
  const actualOutputsPresent = [];
  const outputMatches = taskRun.expectedOutputs.map((expectedPath) => {
    if (snapshotPaths.has(expectedPath)) {
      actualOutputsPresent.push(expectedPath);
      return {
        expectedPath,
        status: "actual_output_present",
        actualPath: expectedPath,
        recoverableCandidates: [],
        reason: "Expected output is present in the imported runtime snapshot.",
      };
    }
    missingExpectedOutputs.push(expectedPath);
    return {
      expectedPath,
      status: "missing_expected_output",
      recoverableCandidates: [],
      reason: "Expected output is absent from the imported runtime snapshot.",
    };
  });
  const status = missingExpectedOutputs.length || taskRun.expectedOutputs.length === 0 ? "missing_expected_output" : "actual_output_present";

  return {
    taskId: taskRun.taskId,
    status,
    expectedOutputCount: taskRun.expectedOutputs.length,
    presentOutputCount: actualOutputsPresent.length,
    missingExpectedOutputs,
    actualOutputsPresent,
    recoverableOutputs: [],
    outputMatches,
  };
}

function deriveNextStep(task) {
  if (!task.validator.valid) return `Fix envelope schema: ${task.validator.issues[0]}`;
  if (task.envelope.preflight.blockers.some((blocker) => blocker.code.includes("provider") || blocker.code.includes("fallback"))) return "Blocked by provider policy";
  if (task.envelope.preflight.blockers.some((blocker) => blocker.code === "missing_source_index")) return "Needs source index binding";
  if (task.queueGate.status === "parked") return "Provider parked; keep as dry-run envelope";
  if (task.queueGate.status === "blocked") return task.queueGate.blockers[0] || "Blocked by preflight";
  if (task.manifestMatch.status === "missing_expected_output") return "Ready for dry check; expected output not present";
  if (task.queueGate.status === "ready") return "Ready dry check";
  return "Monitor queue state";
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateEnvelope(envelope) {
  const issues = [];
  if (!isObject(envelope)) {
    return { valid: false, issues: ["envelope_missing"] };
  }

  if (!isNonEmptyString(envelope.id)) issues.push("missing_task_id");
  if (!isNonEmptyString(envelope.providerSlot)) issues.push("missing_provider_slot");
  if (!isNonEmptyString(envelope.providerId)) issues.push("missing_provider_id");
  if (!isNonEmptyString(envelope.requiredMode)) issues.push("missing_required_mode");
  if (!Array.isArray(envelope.expectedOutputs)) issues.push("missing_expected_outputs");
  if (!Array.isArray(envelope.injectedKnowledgePacks)) issues.push("missing_injected_knowledge_packs");

  if (!isObject(envelope.preflight)) {
    issues.push("missing_preflight");
  } else {
    if (!isNonEmptyString(envelope.preflight.taskId)) issues.push("missing_preflight_task_id");
    if (envelope.preflight.taskId && envelope.id && envelope.preflight.taskId !== envelope.id) issues.push("preflight_task_id_mismatch");
    if (!["pass", "warning", "blocked"].includes(envelope.preflight.status)) issues.push("invalid_preflight_status");
    if (!Array.isArray(envelope.preflight.blockers)) issues.push("missing_preflight_blockers");
    if (!Array.isArray(envelope.preflight.warnings)) issues.push("missing_preflight_warnings");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

function buildTaskStates(audit, sourceIndex, knowledgeSummary, generatedAt) {
  const snapshotPaths = new Set(audit.fileSnapshot || []);
  return audit.jobs.map((job) => {
    const shot = audit.shots.find((item) => job.id.includes(item.id));
    const { envelope, routeResult, contextBudget } = buildEnvelope(job, shot, audit.issues, sourceIndex, knowledgeSummary, generatedAt);
    const queueGate = queueGateForEnvelope(envelope);
    const taskRun = buildTaskRun(envelope, queueGate, generatedAt);
    const manifestMatch = buildManifestMatch(taskRun, snapshotPaths);
    const task = {
      job,
      shotId: shot?.id,
      envelope,
      taskRun,
      queueGate,
      manifestMatch,
      validator: validateEnvelope(envelope),
      routeResult,
      contextBudget,
      nextStep: "",
    };
    return { ...task, nextStep: deriveNextStep(task) };
  });
}

function queueSummary(taskViews) {
  return {
    total: taskViews.length,
    ready: taskViews.filter((task) => task.queueGate.status === "ready").length,
    blocked: taskViews.filter((task) => task.queueGate.status === "blocked").length,
    parked: taskViews.filter((task) => task.queueGate.status === "parked").length,
    succeeded: taskViews.filter((task) => task.job.status === "success").length,
    missingOutputs: taskViews.filter((task) => task.manifestMatch.status === "missing_expected_output").length,
  };
}

function preflightSummary(taskViews) {
  const blockers = taskViews.flatMap((task) => task.envelope.preflight.blockers);
  return {
    blocked: taskViews.filter((task) => task.envelope.preflight.status === "blocked").length,
    warnings: taskViews.reduce((count, task) => count + task.envelope.preflight.warnings.length, 0),
    blockers,
  };
}

function manifestSummary(taskViews) {
  return {
    complete: taskViews.filter((task) => task.manifestMatch.status === "complete").length,
    present: taskViews.filter((task) => task.manifestMatch.status === "actual_output_present").length,
    missing: taskViews.filter((task) => task.manifestMatch.status === "missing_expected_output").length,
    recoverable: taskViews.filter((task) => task.manifestMatch.status === "postprocess_recoverable").length,
  };
}

function buildPreviewEvents(audit, taskViews) {
  let cursor = 0;
  return audit.shots.map((shot, index) => {
    const videoTask = taskViews.find((task) => task.shotId === shot.id && task.job.slot === "video.i2v");
    const keyframeTask = taskViews.find((task) => task.shotId === shot.id && (task.job.slot === "image.generate" || task.job.slot === "image.edit"));
    const pairPassed = shot.gates.pair === "PASS" || shot.gates.pair === "PARTIAL";
    const storyPassed = shot.gates.story === "PASS" || shot.gates.story === "PARTIAL";
    const durationSeconds = shot.videoPath ? 5 : 3;
    const startSeconds = cursor;
    cursor += durationSeconds;

    if (shot.videoPath && videoTask?.manifestMatch.status === "actual_output_present" && pairPassed && storyPassed) {
      return {
        id: `preview_${shot.id}_video`,
        mode: "draft_preview",
        type: "video_clip",
        shotId: shot.id,
        startSeconds,
        durationSeconds,
        mediaPath: shot.videoPath,
        qaStatus: "PARTIAL",
        sourceTaskId: videoTask.job.id,
      };
    }

    if (shot.startFrame && !shot.issues.includes("missing_start_frame")) {
      return {
        id: `preview_${shot.id}_hold`,
        mode: "draft_preview",
        type: pairPassed || storyPassed ? "image_hold" : "blocked_placeholder",
        shotId: shot.id,
        startSeconds,
        durationSeconds,
        mediaPath: shot.startFrame,
        qaStatus: pairPassed && storyPassed ? "PARTIAL" : "FAIL",
        sourceTaskId: keyframeTask?.job.id,
      };
    }

    return {
      id: `preview_${shot.id}_blocked`,
      mode: "draft_preview",
      type: "blocked_placeholder",
      shotId: shot.id,
      startSeconds,
      durationSeconds,
      qaStatus: "FAIL",
      sourceTaskId: videoTask?.job.id || keyframeTask?.job.id || `shot_${index}`,
    };
  });
}

function safeAudioId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function defaultVoiceSourceId(voiceSources) {
  const source = (voiceSources || []).find((item) => item.kind === "tts_voice" || item.kind === "voice_library");
  return source?.id || null;
}

function audioDurationForShot(shot, previewEvents = []) {
  const event = previewEvents.find((item) => item.shotId === shot.id);
  return {
    startSeconds: event?.startSeconds || 0,
    durationSeconds: event?.durationSeconds || (shot.videoPath ? 5 : 3),
  };
}

function buildShotAudioPlan(shot, runtimeConfig, previewEvents) {
  const { durationSeconds } = audioDurationForShot(shot, previewEvents);

  return {
    shotId: shot.id,
    narrationText: "",
    dialogueLines: [],
    voiceSourceId: defaultVoiceSourceId(runtimeConfig.voiceSources),
    deliveryNotes: "Placeholder delivery notes; edit through a future voice_change_transaction before audio generation.",
    ambienceBrief: shot.storyFunction
      ? `Ambience placeholder should support the story function: ${shot.storyFunction}`
      : "Ambience placeholder reserved for this shot.",
    bgmProfile: "No BGM for video provider; BGM may be planned here or imported later in post.",
    musicAllowed: false,
    targetDurationSeconds: durationSeconds,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
    outputPath: null,
    linkedTtsJobId: null,
    linkedMusicJobId: null,
    audioQaStatus: "UNKNOWN",
  };
}

function buildAudioPreviewEvents(audioPlans, shots, previewEvents) {
  return audioPlans.flatMap((plan) => {
    const shot = shots.find((item) => item.id === plan.shotId);
    const { startSeconds, durationSeconds } = shot
      ? audioDurationForShot(shot, previewEvents)
      : { startSeconds: 0, durationSeconds: plan.targetDurationSeconds };
    const idBase = safeAudioId(plan.shotId);
    const events = [];

    if (plan.narrationText.trim()) {
      events.push({
        id: `audio_${idBase}_narration_placeholder`,
        mode: "draft_preview",
        type: "narration_audio",
        shotId: plan.shotId,
        startSeconds,
        durationSeconds,
        qaStatus: plan.outputPath ? plan.audioQaStatus : "UNKNOWN",
        sourceTaskId: plan.linkedTtsJobId || undefined,
      });
    }

    if (plan.dialogueLines.length) {
      events.push({
        id: `audio_${idBase}_dialogue_placeholder`,
        mode: "draft_preview",
        type: "dialogue_audio",
        shotId: plan.shotId,
        startSeconds,
        durationSeconds,
        qaStatus: plan.outputPath ? plan.audioQaStatus : "UNKNOWN",
        sourceTaskId: plan.linkedTtsJobId || undefined,
      });
    }

    if (plan.ambienceBrief.trim()) {
      events.push({
        id: `audio_${idBase}_ambience_placeholder`,
        mode: "draft_preview",
        type: "ambience_audio",
        shotId: plan.shotId,
        startSeconds,
        durationSeconds,
        qaStatus: "UNKNOWN",
      });
    }

    if (plan.musicAllowed) {
      events.push({
        id: `audio_${idBase}_music_placeholder`,
        mode: "draft_preview",
        type: "music_audio",
        shotId: plan.shotId,
        startSeconds,
        durationSeconds,
        qaStatus: plan.linkedMusicJobId && plan.outputPath ? plan.audioQaStatus : "UNKNOWN",
        sourceTaskId: plan.linkedMusicJobId || undefined,
      });
    }

    return events;
  });
}

function buildAudioPlanningState({ generatedAt, shots, runtimeConfig, previewEvents }) {
  const voiceSources = runtimeConfig.voiceSources || [];
  const shotPlans = shots.map((shot) => buildShotAudioPlan(shot, runtimeConfig, previewEvents));
  const audioEvents = buildAudioPreviewEvents(shotPlans, shots, previewEvents);
  const providerSlots = runtimeConfig.providerEnablement.slots
    .filter((slot) => slot.slot === "audio.tts" || slot.slot === "audio.music")
    .map((slot) => ({
      slot: slot.slot,
      state: slot.state,
      activeProvider: slot.activeProvider,
      allowedProviders: slot.allowedProviders,
      liveSubmitAllowed: false,
      notes: [
        ...slot.notes,
        "Phase 6 keeps audio providers planned/read-only; provider submission is forbidden.",
      ],
    }));

  return {
    schemaVersion: "0.1.0",
    generatedAt,
    shotPlans,
    voiceSourceRegistry: {
      sourceCount: voiceSources.length,
      placeholderCount: voiceSources.filter((source) => source.status === "placeholder").length,
      plannedCount: voiceSources.filter((source) => source.status === "planned").length,
      unavailableCount: voiceSources.filter((source) => source.status === "unavailable").length,
      sources: voiceSources,
      storesSecrets: false,
      changeTransactionRequired: true,
      liveSubmitAllowed: false,
      providerSubmissionForbidden: true,
      notes: [
        "Voice source registry is copied from runtime.config.voiceSources.",
        "No provider credentials, API keys, or sample audio are stored in ProjectRuntimeState.",
        "Voice changes must be represented by voice_change_transaction before reflow.",
      ],
    },
    previewMix: {
      planId: "audio_preview_mix_placeholder",
      generatedFromAudioPlan: true,
      eventCount: audioEvents.length,
      missingOutputPathCount: shotPlans.filter((plan) => !plan.outputPath).length,
      events: audioEvents,
      notes: [
        "Audio preview mix is a placeholder derived from AudioPlan; no audio file is rendered.",
        "Events without mediaPath are not successful files and must remain draft/placeholder material.",
      ],
      dryRunOnly: true,
      providerSubmissionForbidden: true,
    },
    videoProviderPolicy: {
      musicAllowed: false,
      noBgmForVideoProvider: true,
      ambienceSfxPlaceholderAllowed: true,
      bgmHandledBy: "audio_plan_or_post_import",
      summary: "Video provider prompts default to no BGM; music belongs in audio planning or post import.",
    },
    providerSlots,
    exportPackageSummary: {
      status: "planned",
      includedInExportProfiles: ["asset_package", "developer_archive"],
      plannedCategories: ["audio_plan", "voice_source_registry_summary", "preview_mix_placeholder", "no_bgm_video_policy"],
      plannedPaths: [],
      blockedReasons: ["No real narration, dialogue, ambience, or music output files are written in Phase 6."],
      notes: [
        "Export/package code can include the audio plan contract without copying generated audio files.",
        "Developer archive should preserve the plan and policy summary for later provider implementation.",
      ],
      dryRunOnly: true,
      providerSubmissionForbidden: true,
    },
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    notes: [
      "Phase 6 implements audio planning data contracts only.",
      "TTS and music provider slots remain planned and liveSubmitAllowed=false.",
      "BGM is not mixed into video provider prompts.",
    ],
  };
}

function previewTotalDuration(events) {
  return events.reduce((max, event) => Math.max(max, event.startSeconds + event.durationSeconds), 0);
}

function summarizePreview(mode, status, events, blockedReasons) {
  return {
    mode,
    status,
    eventCount: events.length,
    videoClipCount: events.filter((event) => event.type === "video_clip").length,
    imageHoldCount: events.filter((event) => event.type === "image_hold").length,
    blockedPlaceholderCount: events.filter((event) => event.type === "blocked_placeholder").length,
    totalDurationSeconds: previewTotalDuration(events),
    blockedShotIds: uniqueSorted(events.filter((event) => event.type === "blocked_placeholder" && event.shotId).map((event) => event.shotId)),
    blockedReasons: uniqueSorted(blockedReasons),
  };
}

function buildPreviewPlan(planId, mode, status, events, blockedReasons) {
  return {
    schemaVersion: "0.1.0",
    planId,
    mode,
    status,
    summary: summarizePreview(mode, status, events, blockedReasons),
    events,
    blockedReasons: uniqueSorted(blockedReasons),
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  };
}

function gateValuesForShot(shot) {
  return [shot.gates.identity, shot.gates.scene, shot.gates.pair, shot.gates.story, shot.gates.prop, shot.gates.style];
}

function allNonOptionalGatesPassForShot(shot) {
  return gateValuesForShot(shot).every((gate) => gate === "PASS" || gate === "N/A");
}

function shotHasUnknownGate(shot) {
  return gateValuesForShot(shot).some((gate) => gate === "UNKNOWN");
}

function hasP0Issues(issues, shotId) {
  return (issues || []).some((issue) => {
    const severity = String(issue.severity || "");
    return severity === "P0" && (!shotId || issue.target === shotId || issue.target?.includes(shotId));
  });
}

function promotionReportsPass(reports) {
  return reports.length > 0 && reports.every((report) => report.canPromoteToFormal || report.promotionStatus === "promoted");
}

function relatedImageQaIsClear(reports) {
  return reports.every((report) => report.qaStatus !== "fail" && report.qaStatus !== "unknown" && report.healthStatus !== "failed");
}

function formalShotReasons(input, shot) {
  const reasons = [];
  const videoTask = input.taskViews.find((task) => task.shotId === shot.id && String(task.job.slot).startsWith("video."));
  const videoManifest = videoTask?.manifestMatch || input.manifestMatches.find((report) => report.taskId === videoTask?.job.id);
  const videoPath = shot.videoPath || videoTask?.taskRun.expectedOutputs?.[0];
  const relatedPromotions = input.qaPromotionReports.filter((report) => report.shotId === shot.id);
  const relatedHealth = input.generationHealthReports.filter((report) => report.shotId === shot.id);
  const draftEvent = input.previewEvents.find((event) => event.shotId === shot.id);

  if (draftEvent?.type === "blocked_placeholder") reasons.push(`${shot.id}: draft preview uses blocked placeholder.`);
  if (shot.gates.pair !== "PASS") reasons.push(`${shot.id}: pair QA must be PASS for formal preview.`);
  if (!allNonOptionalGatesPassForShot(shot)) reasons.push(`${shot.id}: video QA proxy gates must all be PASS or N/A.`);
  if (shotHasUnknownGate(shot)) reasons.push(`${shot.id}: unknown gate is not allowed in formal preview.`);
  if (hasP0Issues(input.issues, shot.id)) reasons.push(`${shot.id}: P0 issue blocks formal preview.`);
  if (!videoPath) reasons.push(`${shot.id}: video output path is missing.`);
  if (!videoTask) reasons.push(`${shot.id}: video task run is missing.`);
  if (!hasManifestMatch(videoManifest?.status)) reasons.push(`${shot.id}: video manifest match is missing or incomplete.`);
  if (!promotionReportsPass(relatedPromotions)) reasons.push(`${shot.id}: related QA promotion has not passed.`);
  if (!relatedImageQaIsClear(relatedHealth)) reasons.push(`${shot.id}: related image QA has FAIL or UNKNOWN status.`);

  return uniqueSorted(reasons);
}

function buildFormalPreviewEvents(input) {
  let cursor = 0;
  const events = [];
  const blockedReasons = [];

  for (const shot of input.shots) {
    const draftEvent = input.previewEvents.find((event) => event.shotId === shot.id);
    const durationSeconds = draftEvent?.durationSeconds || (shot.videoPath ? 5 : 3);
    const videoTask = input.taskViews.find((task) => task.shotId === shot.id && String(task.job.slot).startsWith("video."));
    const videoPath = shot.videoPath || videoTask?.taskRun.expectedOutputs?.[0];
    const reasons = formalShotReasons(input, shot);

    if (reasons.length === 0 && videoPath) {
      events.push({
        id: `formal_${shot.id}_video`,
        mode: "formal_preview",
        type: "video_clip",
        shotId: shot.id,
        startSeconds: cursor,
        durationSeconds,
        mediaPath: videoPath,
        qaStatus: "PASS",
        sourceTaskId: videoTask?.job.id,
      });
    } else {
      blockedReasons.push(...reasons);
    }

    cursor += durationSeconds;
  }

  return { events, blockedReasons: uniqueSorted(blockedReasons) };
}

function formalPreviewChecks(input, formalEvents, blockedReasons) {
  const shotIdsWithFormalEvents = new Set(formalEvents.map((event) => event.shotId).filter(Boolean));
  const videoTasks = input.taskViews.filter((task) => String(task.job.slot).startsWith("video."));

  return {
    noBlockedMaterial: formalEvents.every((event) => event.type !== "blocked_placeholder") && !blockedReasons.some((reason) => reason.includes("blocked placeholder")),
    pairQaPass: input.shots.every((shot) => shot.gates.pair === "PASS"),
    videoQaPass: input.shots.every((shot) => allNonOptionalGatesPassForShot(shot)),
    manifestMatched: videoTasks.length > 0 && input.shots.every((shot) => {
      const task = videoTasks.find((item) => item.shotId === shot.id);
      return hasManifestMatch(task?.manifestMatch.status);
    }),
    promotionPassed: input.shots.every((shot) => promotionReportsPass(input.qaPromotionReports.filter((report) => report.shotId === shot.id))),
    noP0Issues: !hasP0Issues(input.issues),
    noUnknownGate: input.shots.every((shot) => !shotHasUnknownGate(shot)),
    videoPresent: input.shots.length > 0 && input.shots.every((shot) => Boolean(shot.videoPath) || shotIdsWithFormalEvents.has(shot.id)),
  };
}

function buildFormalPreviewGate(input, formalEvents, blockedReasons) {
  const requiredChecks = formalPreviewChecks(input, formalEvents, blockedReasons);
  const failedChecks = Object.entries(requiredChecks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `Formal preview check failed: ${check}.`);
  const reasons = uniqueSorted([...blockedReasons, ...failedChecks]);

  return {
    status: reasons.length === 0 ? "pass" : "blocked",
    requiredChecks,
    blockedReasons: reasons,
  };
}

function makeExportProfile(input) {
  return {
    schemaVersion: "0.1.0",
    profileId: `export_${input.kind}`,
    kind: input.kind,
    label: input.label,
    readiness: input.readiness,
    includedCategories: uniqueSorted(input.includedCategories || []),
    includedPaths: uniqueSorted(input.includedPaths || []),
    blockedReasons: uniqueSorted(input.blockedReasons || []),
    notes: input.notes || [],
    futureTargets: input.futureTargets,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  };
}

function buildExportProfiles(input, draftPreview, formalPreview) {
  const draftMediaPaths = draftPreview.events.map((event) => event.mediaPath || "").filter(Boolean);
  const formalMediaPaths = formalPreview.events.map((event) => event.mediaPath || "").filter(Boolean);
  const assetPaths = input.shots.flatMap((shot) => [shot.startFrame, shot.endFrame, shot.videoPath].filter(Boolean));
  const promptPaths = input.jobs.map((job) => job.promptPath || "").filter(Boolean);
  const taskOutputPaths = input.taskRuns.flatMap((run) => [...(run.expectedOutputs || []), ...(run.actualOutputs || [])]);
  const qaPaths = input.qaPromotionReports.flatMap((report) => [report.candidatePath, report.formalPath].filter(Boolean));
  const roughCutPaths = formalMediaPaths.length ? formalMediaPaths : draftMediaPaths;
  const packagePaths = uniqueSorted([...assetPaths, ...taskOutputPaths]);
  const archivePaths = uniqueSorted([...promptPaths, ...taskOutputPaths, ...qaPaths]);

  return [
    makeExportProfile({
      kind: "rough_cut",
      label: "Rough Cut Proxy",
      readiness: roughCutPaths.length ? (formalPreview.status === "ready" ? "ready" : "draft_only") : "blocked",
      includedCategories: ["preview_timeline", "video_clips", "image_holds", "blocked_placeholders_when_draft"],
      includedPaths: roughCutPaths,
      blockedReasons: roughCutPaths.length ? [] : ["No preview media paths are available for rough cut export planning."],
      notes: [
        "Dry-run package plan only; no rough cut file is written.",
        "Uses formal preview media when the formal gate passes, otherwise remains draft-only.",
      ],
      futureTargets: ["premiere_pro_xml_slot", "davinci_resolve_folder_slot", "jianying_folder_slot", "fcpxml_future_slot", "edl_future_slot"],
    }),
    makeExportProfile({
      kind: "asset_package",
      label: "Asset Package",
      readiness: packagePaths.length ? (formalPreview.status === "ready" ? "ready" : "draft_only") : "blocked",
      includedCategories: ["keyframes", "videos", "task_outputs", "reference_assets"],
      includedPaths: packagePaths,
      blockedReasons: packagePaths.length ? [] : ["No asset or task output paths are available for package planning."],
      notes: [
        "Folder structure is reserved for external editors; the builder does not copy or export files.",
        "Future layout can include PR, DaVinci Resolve, and Jianying friendly folders.",
      ],
      futureTargets: ["pr_friendly_directory_slot", "davinci_resolve_directory_slot", "jianying_directory_slot"],
    }),
    makeExportProfile({
      kind: "storyboard_table",
      label: "Storyboard Table",
      readiness: input.shots.length ? "ready" : "blocked",
      includedCategories: ["shot_order", "story_function", "preview_event_refs", "gate_summary"],
      includedPaths: [],
      blockedReasons: input.shots.length ? [] : ["No shots are available for storyboard table planning."],
      notes: ["Structured table plan only; no CSV, XLSX, or document is written."],
    }),
    makeExportProfile({
      kind: "developer_archive",
      label: "Prompt and QA Developer Archive",
      readiness: archivePaths.length ? "ready" : "blocked",
      includedCategories: ["prompts", "manifest_matches", "generation_health", "qa_promotion", "task_runs"],
      includedPaths: archivePaths,
      blockedReasons: archivePaths.length ? [] : ["No prompt, task output, or QA paths are available for archive planning."],
      notes: ["Developer archive plan is read-only and preserves prompt/QA traceability without submitting providers."],
    }),
  ];
}

function exportPackageStatus(profiles) {
  if (profiles.some((profile) => profile.readiness === "blocked")) return "blocked";
  if (profiles.some((profile) => profile.readiness === "draft_only")) return "draft_only";
  if (profiles.some((profile) => profile.readiness === "planned")) return "planned";
  return "ready";
}

function buildExportPackagePlan(profiles) {
  const futureTargets = uniqueSorted(profiles.flatMap((profile) => profile.futureTargets || []));
  const blockedReasons = uniqueSorted(profiles.flatMap((profile) => profile.blockedReasons || []));

  return {
    schemaVersion: "0.1.0",
    planId: "export_package_plan",
    status: exportPackageStatus(profiles),
    profiles,
    futureTargets,
    blockedReasons,
    notes: [
      "Preview/export planning is dry-run/read-only.",
      "NLE slots are placeholders only; no FCPXML, EDL, PR, DaVinci, or Jianying file is generated.",
    ],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  };
}

function buildPreviewExportState(input) {
  const draftEvents = input.previewEvents.filter((event) => event.mode === "draft_preview");
  const draftBlockedReasons = draftEvents
    .filter((event) => event.type === "blocked_placeholder")
    .map((event) => `${event.shotId || event.id}: draft preview contains blocked placeholder.`);
  const draftPreview = buildPreviewPlan(
    "draft_preview_plan",
    "draft_preview",
    draftEvents.length ? "draft_only" : "blocked",
    draftEvents,
    draftEvents.length ? draftBlockedReasons : ["No draft preview events are available."],
  );
  const formalResult = buildFormalPreviewEvents({ ...input, previewEvents: draftEvents });
  const formalPreviewGate = buildFormalPreviewGate(input, formalResult.events, formalResult.blockedReasons);
  const formalPreview = buildPreviewPlan(
    "formal_preview_plan",
    "formal_preview",
    formalPreviewGate.status === "pass" ? "ready" : "blocked",
    formalResult.events,
    formalPreviewGate.blockedReasons,
  );
  const exportProfiles = buildExportProfiles(input, draftPreview, formalPreview);
  const exportPackagePlan = buildExportPackagePlan(exportProfiles);
  const proxySourcePreview = formalPreview.status === "ready" ? formalPreview : draftPreview;

  return {
    schemaVersion: "0.1.0",
    generatedAt: input.generatedAt,
    draftPreview,
    formalPreview,
    formalPreviewGate,
    roughCutProxy: {
      status: proxySourcePreview.status,
      sourcePreviewPlanId: proxySourcePreview.planId,
      totalDurationSeconds: proxySourcePreview.summary.totalDurationSeconds,
      eventCount: proxySourcePreview.summary.eventCount,
      proxyOnly: true,
      notes: [
        "Rough cut proxy is a timeline plan only; no media file is rendered.",
        formalPreview.status === "ready" ? "Formal preview is available for proxy planning." : "Formal preview is blocked; proxy uses draft preview events.",
      ],
    },
    exportProfiles,
    exportPackagePlan,
  };
}

function buildProjectRuntimeState(audit, knowledgeManifest, generatedAt) {
  const sourceIndex = buildSourceIndex(audit, knowledgeManifest);
  const sourceIndexSummary = summarizeSourceIndex(sourceIndex);
  const knowledgeSummary = buildKnowledgeSummary(knowledgeManifest);
  const taskViews = buildTaskStates(audit, sourceIndex, knowledgeSummary, generatedAt);
  const manifestMatches = manifestSummary(taskViews);
  const runtime = buildRuntimeEnvironment(generatedAt);
  const providerRegistry = buildDefaultProviderRegistry(generatedAt);
  const promptPlanResults = taskViews.map((task) =>
    buildShotPromptPlan(
      task.job,
      audit.shots.find((shot) => shot.id === task.shotId),
      audit.assets,
      sourceIndex,
      providerRegistry,
      knowledgeManifest,
      generatedAt,
    ),
  );
  const assetReadinessReports = audit.shots.map((shot) =>
    buildAssetReadinessReport(shot, audit.assets, sourceIndex, audit.jobs, generatedAt),
  );
  const imageTaskPlans = promptPlanResults.map((result) => {
    const task = taskViews.find((item) => item.job.id === result.plan.jobId);
    const readinessReport = result.plan.shotId
      ? assetReadinessReports.find((report) => report.shotId === result.plan.shotId)
      : undefined;
    return buildImageTaskPlan(
      task?.job || audit.jobs.find((job) => job.id === result.plan.jobId),
      result.plan,
      readinessReport,
      sourceIndex,
      task?.envelope,
    );
  });
  const image2AdapterRequests = imageTaskPlans
    .filter((taskPlan) =>
      ["ready_for_dry_run", "ready_for_manual_submit"].includes(taskPlan.status) &&
      isImageSlot({ slot: taskPlan.providerSlot })
    )
    .map((taskPlan) => {
      const promptPlan = promptPlanResults.find((result) => result.plan.promptPlanId === taskPlan.promptPlanId)?.plan;
      return promptPlan ? buildImage2AdapterRequest(taskPlan, promptPlan) : undefined;
    })
    .filter(Boolean);
  const fileSnapshot = audit.fileSnapshot || [];
  const watcherEvents = buildWatcherEventsFromImagePipeline({
    imageTaskPlans,
    adapterRequests: image2AdapterRequests,
    fileSnapshot,
    manifestReports: taskViews.map((task) => task.manifestMatch),
    createdAt: generatedAt,
  });
  const generationHealthReports = buildGenerationHealthReports({
    imageTaskPlans,
    fileSnapshot,
    manifestReports: taskViews.map((task) => task.manifestMatch),
    watcherEvents,
    assetReadinessReports,
    promptPlans: promptPlanResults.map((result) => result.plan),
  });
  const qaPromotionReports = buildQaPromotionReports({
    imageTaskPlans,
    fileSnapshot,
    manifestReports: taskViews.map((task) => task.manifestMatch),
    generationHealthReports,
    assetReadinessReports,
    promptPlans: promptPlanResults.map((result) => result.plan),
  });
  const previewEvents = buildPreviewEvents(audit, taskViews);
  const audioPlanning = buildAudioPlanningState({
    generatedAt,
    shots: audit.shots,
    runtimeConfig: runtime.config,
    previewEvents,
  });
  const previewExport = buildPreviewExportState({
    generatedAt,
    projectRoot: audit.projectRoot,
    previewEvents,
    shots: audit.shots,
    jobs: audit.jobs,
    taskRuns: taskViews.map((task) => task.taskRun),
    taskViews: taskViews.map((task) => ({
      job: task.job,
      shotId: task.shotId,
      taskRun: task.taskRun,
      manifestMatch: task.manifestMatch,
    })),
    manifestMatches: taskViews.map((task) => task.manifestMatch),
    generationHealthReports,
    qaPromotionReports,
    issues: audit.issues,
  });

  return {
    schemaVersion: "0.1.0",
    coreStateVersion: "project-runtime-state/0.1.0",
    generatedAt,
    project: {
      title: audit.projectTitle,
      root: audit.projectRoot,
      sourceTask: audit.sourceTask,
      state: audit.state,
      importedAt: audit.importedAt,
      metrics: audit.metrics,
      providerPolicy: audit.providerPolicy,
      workflow: audit.workflow,
      contactSheets: audit.contactSheets,
    },
    sourceIndex,
    sourceIndexSummary,
    storyFlow: {
      sections: buildStorySections(audit.shots),
      shots: audit.shots,
    },
    visualMemory: {
      summary: buildVisualMemorySummary(audit),
      assets: audit.assets,
    },
    taskRuns: {
      jobs: audit.jobs,
      runs: taskViews.map((task) => task.taskRun),
      taskViews,
      queueSummary: queueSummary(taskViews),
      preflightSummary: preflightSummary(taskViews),
    },
    manifestMatches: {
      summary: manifestMatches,
      reports: taskViews.map((task) => task.manifestMatch),
    },
    imagePipeline: {
      providerRegistry,
      promptPlans: promptPlanResults.map((result) => result.plan),
      promptConflictReports: promptPlanResults.map((result) => result.conflictReport),
      assetReadinessReports,
      imageTaskPlans,
      image2AdapterRequests,
      watcherEvents,
      generationHealthReports,
      qaPromotionReports,
    },
    previewEvents,
    previewExport,
    audioPlanning,
    storyChanges: {
      transactions: [],
      reflowReports: [],
      pendingConfirmationCount: 0,
      lastGeneratedAt: generatedAt,
    },
    runtime,
    diagnostics: {
      issues: audit.issues,
      schemaSummary: audit.schemaSummary,
      generatedBy: "scripts/import-runtime-test.mjs",
    },
    knowledge: knowledgeSummary,
    stateSource: {
      kind: "runtime-state",
      label: "runtime-state",
      path: "/runtime-state.json",
      sourceAuditPath: "/runtime-audit.json",
      sourceImportedAt: audit.importedAt,
      note: "Generated by import-runtime-test without live provider submission.",
    },
  };
}

function parkedExecutionStateForSlot(slot) {
  const executionState = policy.rules.find((item) => item.slot === slot)?.executionState;
  return ["parked", "planned", "unavailable"].includes(executionState) ? executionState : undefined;
}

function stripProviderSubmitTraces(job, traces) {
  const executionState = parkedExecutionStateForSlot(job.slot);
  if (!executionState) return job;

  const strippedFields = Object.entries(traces || {})
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
    .map(([field]) => field)
    .sort();
  if (!strippedFields.length) return job;

  return {
    ...job,
    submitId: undefined,
    providerTaskId: undefined,
    issues: uniqueSorted([
      ...(job.issues || []),
      `parked_provider_submit_trace_stripped:${strippedFields.join("+")}`,
    ]),
  };
}

function statusForAsset(pathValue, generatedEntry) {
  if (exists(pathValue)) return generatedEntry?.status === "generated" ? "generated" : "exists";
  return "missing";
}

function collectJobs(manifestAssets, shots, generated, events) {
  const jobs = [];
  for (const asset of manifestAssets) {
    const id = assetJobId(asset);
    const entry = generatedEntryFor(generated, id);
    const requiredMode = requiredModeForAsset(asset);
    jobs.push(stripProviderSubmitTraces({
      id,
      slot: slotForAsset(asset),
      requiredMode,
      providerId: providerIdForJob(id, events),
      status: entry?.status === "generated" || entry?.status === "exists" ? "success" : "planned",
      outputPath: asset.path,
      promptPath: entry?.prompt_path,
      references: entry?.references || [],
      submitId: entry?.submit_id,
      issues: [],
    }, { submitId: entry?.submit_id, providerTaskId: entry?.provider_task_id || entry?.providerTaskId }));
  }

  for (const shot of shots) {
    for (const kind of ["start", "end"]) {
      const id = `keyframe_${shot.shot_id}_${kind}`;
      const entry = generatedEntryFor(generated, id);
      jobs.push(stripProviderSubmitTraces({
        id,
        slot: kind === "start" ? "image.generate" : "image.edit",
        requiredMode: kind === "start" ? "text2image" : "image2image",
        providerId: providerIdForJob(id, events),
        status: entry?.status === "generated" || entry?.status === "exists" ? "success" : "planned",
        outputPath: path.join(root, "02_keyframes", kind, `${shot.shot_id}_${kind}.png`),
        promptPath: entry?.prompt_path,
        references: entry?.references || [],
        submitId: entry?.submit_id,
        issues: [],
      }, { submitId: entry?.submit_id, providerTaskId: entry?.provider_task_id || entry?.providerTaskId }));
    }

    const id = `video_${shot.shot_id}_seedance`;
    const videoPath = path.join(root, "03_videos/clips", `${shot.shot_id}.mp4`);
    const submitId = events.find((event) => JSON.stringify(event).includes(id) && event.response?.submit_id)?.response?.submit_id;
    const providerTaskResponse = events.find((event) => JSON.stringify(event).includes(id) && (event.response?.provider_task_id || event.response?.providerTaskId))?.response;
    const providerTaskId = providerTaskResponse?.provider_task_id || providerTaskResponse?.providerTaskId;
    jobs.push(stripProviderSubmitTraces({
      id,
      slot: "video.i2v",
      requiredMode: "frames2video",
      providerId: "dreamina-seedance2",
      status: exists(videoPath) ? "success" : "parked",
      outputPath: videoPath,
      promptPath: path.join(root, "prompts/video", `${id}.txt`),
      references: [
        path.join(root, "02_keyframes/start", `${shot.shot_id}_start_seedance_720p.png`),
        path.join(root, "02_keyframes/end", `${shot.shot_id}_end_seedance_720p.png`),
      ],
      submitId,
      providerTaskId,
      issues: [],
    }, { submitId, providerTaskId }));
  }
  return jobs;
}

function validateJobs(jobs, events) {
  const issues = [];
  const fallbackEvents = events.filter((event) => String(event.event || "").includes("fallback") || JSON.stringify(event).includes("fallback_text"));

  for (const job of jobs) {
    const rule = policy.rules.find((item) => item.slot === job.slot);
    if (!rule) continue;
    if (["parked", "planned", "unavailable"].includes(rule.executionState)) {
      const submitTraceFields = [
        job.submitId ? "submitId" : undefined,
        job.providerTaskId ? "providerTaskId" : undefined,
      ].filter(Boolean);
      if (submitTraceFields.length) {
        issues.push(
          makeIssue(
            `parked-submit-trace-${job.id}`,
            "blocker",
            "provider_policy",
            "Parked provider submit trace is blocked",
            `${job.id} is bound to ${job.slot} (${rule.executionState}) but still carries ${submitTraceFields.join(", ")}.`,
            "Strip historical/live provider submit identifiers before exporting runtime-state or runtime-audit.",
            job.id,
          ),
        );
        job.issues.push("parked_provider_submit_trace_blocked");
      }
      for (const issueCode of job.issues.filter((issue) => String(issue).startsWith("parked_provider_submit_trace_stripped:"))) {
        issues.push(
          makeIssue(
            `parked-submit-stripped-${job.id}`,
            "warning",
            "provider_policy",
            "Parked provider submit trace was stripped",
            `${job.id} had historical/live provider submit fields removed during import (${String(issueCode).split(":")[1] || "submit trace"}).`,
            "Keep parked/planned/unavailable providers as dry-run envelopes until the adapter is explicitly enabled.",
            job.id,
          ),
        );
      }
      if (["submitted", "querying", "success"].includes(job.status)) {
        issues.push(
          makeIssue(
            `parked-live-${job.id}`,
            "blocker",
            "provider_policy",
            "Parked provider produced a live task",
            `${job.id} is ${job.status}, but ${job.slot} is ${rule.executionState}.`,
            "Do not submit or advance this provider path until Settings explicitly enables the adapter.",
            job.id,
          ),
        );
        job.issues.push("parked_provider_live_task");
      }
      continue;
    }
    if (rule.forbiddenProviders.includes(job.providerId)) {
      issues.push(
        makeIssue(
          `provider-${job.id}`,
          "blocker",
          "provider_policy",
          "Image provider drift",
          `${job.id} used ${job.providerId}, but ${job.slot} is locked to ${rule.activeProvider}.`,
          "Block formal use and rerun through the Image 2 adapter or mark this as an external experiment.",
          job.id,
        ),
      );
      job.issues.push("provider_policy_violation");
    }
    if (!rule.allowedModes.includes(job.requiredMode)) {
      issues.push(
        makeIssue(
          `mode-${job.id}`,
          "blocker",
          "state_gate",
          "Required mode is not allowed",
          `${job.id} requires ${job.requiredMode}; ${job.slot} allows ${rule.allowedModes.join(", ")}.`,
          "Recompile this task through ProviderTaskValidator.",
          job.id,
        ),
      );
      job.issues.push("mode_policy_violation");
    }
  }

  if (fallbackEvents.length) {
    issues.push(
      makeIssue(
        "forbidden-fallback",
        "blocker",
        "fallback",
        "Forbidden text fallback was attempted",
        `${fallbackEvents.length} event(s) show image-to-image failure falling toward text-to-image candidate generation.`,
        "Reject that reference chain. Required image-to-image jobs can only retry image-to-image or stop blocked.",
      ),
    );
  }

  return issues;
}

const manifestPath = path.join(root, "00_task/generation_manifest.json");
const shotSpecPath = path.join(root, "00_task/shot_spec.yaml");
const generatedPath = path.join(root, "manifests/generated_outputs.json");
const eventsPath = path.join(root, "manifests/generation_events.jsonl");
const assetQaPath = path.join(root, "04_reports/asset_qa.md");
const keyframeQaPath = path.join(root, "04_reports/keyframe_pair_qa.md");
const videoQaPath = path.join(root, "04_reports/video_qa.md");

const manifest = readJson(manifestPath);
const knowledgeManifest = readJson(knowledgeManifestPath, {
  schemaVersion: "0.1.0",
  manifestVersion: "empty",
  generatedAt: new Date(0).toISOString(),
  knowledgeLibraryRoot: "resources/knowledge",
  manifestHash: "empty",
  packs: [],
});
const shotSpec = readYaml(shotSpecPath);
const generated = readJson(generatedPath, { assets: {}, keyframes: {}, videos: {} });
const events = parseJsonl(eventsPath);
const assetQa = parseQaTable(assetQaPath);
const pairQa = parseQaTable(keyframeQaPath);
const manifestAssets = flattenManifestAssets(manifest);
const shotsSpec = shotSpec?.shots || [];
const jobs = collectJobs(manifestAssets, shotsSpec, generated, events);

const issues = validateJobs(jobs, events);

const expected = manifest?.generation_manifest?.expected_outputs || {};
const assetRecords = manifestAssets.map((asset) => {
  const id = assetJobId(asset);
  const entry = generatedEntryFor(generated, id);
  const qa = assetQa.get(id);
  const status = statusForAsset(asset.path, entry);
  const localIssues = [];
  if (status === "missing") localIssues.push("missing_file");
  if (qa && String(qa.Notes || "").includes("if visual audit")) localIssues.push("protocol_pass_needs_visual_audit");
  return {
    id,
    type: asset.type || "unknown",
    name: asset.asset_id || id,
    path: asset.path,
    status,
    lockedStatus: qa ? "needs_review" : asset.locked_status || "not_generated",
    providerId: providerIdForJob(id, events),
    requiredMode: requiredModeForAsset(asset),
    safeForFutureReference: false,
    dimensions: dimensionsFromGenerated(entry),
    issues: localIssues,
  };
});

const shotRecords = shotsSpec.map((shot) => {
  const startPath = path.join(root, "02_keyframes/start", `${shot.shot_id}_start.png`);
  const endPath = path.join(root, "02_keyframes/end", `${shot.shot_id}_end.png`);
  const videoPath = path.join(root, "03_videos/clips", `${shot.shot_id}.mp4`);
  const qa = pairQa.get(shot.shot_id);
  const localIssues = [];
  if (!exists(startPath)) localIssues.push("missing_start_frame");
  if (!exists(endPath)) localIssues.push("missing_end_frame");
  if (!exists(videoPath)) localIssues.push("missing_video");
  if (qa && String(qa.Notes || "").includes("auto QA only")) localIssues.push("auto_qa_not_human_approved");
  const gates = gateSet(qa);
  const hasFail = Object.values(gates).includes("FAIL");
  const status = !exists(videoPath)
    ? "video_missing"
    : hasFail
      ? "blocked"
      : "ready";
  return {
    id: shot.shot_id,
    actId: actIdForShot(shot),
    sectionId: sectionIdForShot(shot),
    title: `${shot.scene_id || "Scene"} / ${shot.view_id || "View"}`,
    storyFunction: shot.story_function || "Missing story function",
    startFrame: startPath,
    endFrame: endPath,
    videoPath: exists(videoPath) ? videoPath : undefined,
    status,
    gates,
    issues: localIssues,
  };
});

const existingAssets = assetRecords.filter((asset) => asset.status !== "missing").length;
const existingKeyframes = shotRecords.filter((shot) => exists(shot.startFrame) && exists(shot.endFrame)).length * 2;
const existingVideos = shotRecords.filter((shot) => shot.videoPath && exists(shot.videoPath)).length;
const dreaminaImageEvents = events.filter((event) => Array.isArray(event.cmd) && event.cmd[0] === "dreamina" && ["text2image", "image2image"].includes(event.cmd[1])).length;
const fallbackEvents = events.filter((event) => String(event.event || "").includes("fallback") || JSON.stringify(event).includes("fallback_text"));

if (!exists(videoQaPath)) {
  issues.push(
    makeIssue(
      "missing-video-qa",
      "warning",
      "missing_output",
      "Video QA report is not available yet",
      "The Seedance/Jimeng video adapter is parked, so no live video QA is expected in this build.",
      "Keep preview/export locked, but do not submit real Jimeng tasks during this phase.",
      videoQaPath,
    ),
  );
}

if (existingVideos < (expected.videos || shotRecords.length)) {
  issues.push(
    makeIssue(
      "videos-missing",
      "warning",
      "queue",
      "Video queue is parked",
      `${existingVideos}/${expected.videos || shotRecords.length} video clips exist. No Jimeng/Seedance jobs are submitted in this phase.`,
      "Keep the queue visible for later adapter integration; current implementation should only prepare task envelopes.",
      path.join(root, "03_videos/clips"),
    ),
  );
}

if (assetRecords.some((asset) => asset.issues.includes("protocol_pass_needs_visual_audit"))) {
  issues.push(
    makeIssue(
      "protocol-qa-only",
      "warning",
      "qa_gap",
      "Protocol QA is not visual approval",
      "Asset QA notes say future reference safety depends on later visual audit.",
      "Keep assets as needs_review until subagent or human visual audit approves them.",
    ),
  );
}

const metrics = {
  expectedAssets: (expected.character_assets || 0) + (expected.scene_master_assets || 0) + (expected.scene_view_assets || 0) + (expected.prop_assets_minimum || 0),
  existingAssets,
  expectedKeyframes: expected.keyframes || shotRecords.length * 2,
  existingKeyframes,
  expectedVideos: expected.videos || shotRecords.length,
  existingVideos,
  providerEvents: events.length,
  dreaminaImageEvents,
  forbiddenFallbackEvents: fallbackEvents.length,
};

const workflow = [
  {
    id: "production_bible",
    label: "Production Bible",
    status: exists(path.join(root, "00_task/production_bible.md")) ? "done" : "blocked",
    detail: exists(path.join(root, "00_task/production_bible.md")) ? "Production facts imported." : "Missing production bible.",
  },
  {
    id: "visual_memory",
    label: "Visual Memory",
    status: existingAssets >= metrics.expectedAssets ? "done" : "active",
    detail: `${existingAssets}/${metrics.expectedAssets} assets found.`,
  },
  {
    id: "keyframe_pairs",
    label: "Keyframe Pairs",
    status: existingKeyframes >= metrics.expectedKeyframes ? "done" : "active",
    detail: `${existingKeyframes}/${metrics.expectedKeyframes} keyframes found.`,
  },
  {
    id: "provider_policy",
    label: "Provider Policy",
    status: issues.some((issue) => issue.severity === "blocker" && ["provider_policy", "fallback"].includes(issue.type)) ? "blocked" : "done",
    detail: `${issues.filter((issue) => issue.type === "provider_policy" || issue.type === "fallback").length} policy issue(s).`,
  },
  {
    id: "videos",
    label: "Video Provider",
    status: existingVideos >= metrics.expectedVideos ? "done" : "pending",
    detail: existingVideos >= metrics.expectedVideos ? `${existingVideos}/${metrics.expectedVideos} video clips found.` : "Seedance/Jimeng adapter parked; no live submit.",
  },
  {
    id: "preview",
    label: "Preview Timeline",
    status: existingVideos >= metrics.expectedVideos && !issues.some((issue) => issue.severity === "blocker") ? "done" : "pending",
    detail: "Preview remains locked until videos and video QA pass.",
  },
];

const blocked = workflow.find((stage) => stage.status === "blocked");
const state = blocked ? `blocked_at_${blocked.id}` : "ready";
const generatedAt = new Date().toISOString();

const audit = {
  importedAt: generatedAt,
  projectTitle: manifest?.generation_manifest?.project_title || shotSpec?.project_title || "Untitled",
  projectRoot: root,
  sourceTask: manifest?.generation_manifest?.source_documents?.task || "",
  state,
  fileSnapshot: [
    ...assetRecords.filter((asset) => asset.status !== "missing").map((asset) => asset.path),
    ...shotRecords.flatMap((shot) => [shot.startFrame, shot.endFrame, shot.videoPath].filter((pathValue) => pathValue && exists(pathValue))),
    ...[assetQaPath, keyframeQaPath, videoQaPath].filter((pathValue) => exists(pathValue)),
  ],
  schemaSummary: {
    auditSchemaVersion: "0.3.0",
    coreStateVersion: "runtime-view-derived-from-audit",
    notes: [
      "TaskRun, manifest match, preflight, knowledge route, and preview events are derived by src/core/runtimeView.ts.",
      "Parked provider tasks are never submitted by this importer.",
    ],
  },
  metrics,
  providerPolicy: policy,
  workflow,
  assets: assetRecords,
  shots: shotRecords,
  jobs,
  issues,
  contactSheets: {
    assets: "/media/asset_contact_sheet.png",
    keyframes: "/media/keyframe_pair_contact_sheet.png",
  },
};
const runtimeState = buildProjectRuntimeState(audit, knowledgeManifest, generatedAt);

fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(mediaDir, { recursive: true });
for (const [name, source] of [
  ["asset_contact_sheet.png", path.join(root, "04_reports/contact_sheets/asset_contact_sheet.png")],
  ["keyframe_pair_contact_sheet.png", path.join(root, "04_reports/contact_sheets/keyframe_pair_contact_sheet.png")],
]) {
  if (exists(source)) fs.copyFileSync(source, path.join(mediaDir, name));
}
fs.writeFileSync(outPath, JSON.stringify(audit, null, 2));
fs.writeFileSync(stateOutPath, JSON.stringify(runtimeState, null, 2));
console.log(`Imported runtime audit: ${outPath}`);
console.log(`Imported runtime state: ${stateOutPath}`);
console.log(`State: ${state}`);
console.log(`Issues: ${issues.length}`);
