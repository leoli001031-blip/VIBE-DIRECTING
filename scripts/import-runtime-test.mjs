import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import YAML from "yaml";

const DEFAULT_ROOT =
  "/Users/lichenhao/Desktop/Vibe Director/runtime-tests/full_generation_10shot_two_act_20260429";
const root = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_ROOT;
const publicDir = path.resolve("public");
const mediaDir = path.join(publicDir, "media");
const outPath = path.join(publicDir, "runtime-audit.json");
const stateOutPath = path.join(publicDir, "runtime-state.json");
const knowledgeManifestPath = path.resolve("resources/knowledge_pack_manifest.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function importTs(pathValue) {
  const source = fs.readFileSync(pathValue, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: pathValue,
  }).outputText;
  const encoded = Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(pathValue).href}`).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

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
      planned: true,
      notes: ["Phase 26 records the adapter placeholder only; the importer does not resolve or start Codex."],
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

function providerAdapterSettings() {
  return [
    {
      id: "adapter-openai-image2-codex-cli",
      label: "OpenAI Image2 via Codex CLI",
      providerId: "openai-image2-codex-cli",
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
  ];
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
  const adapterSettings = providerAdapterSettings();
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
    providerAdapterSettings: adapterSettings,
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

const projectFileCorePlannedEntries = [
  ["project_file", "project_manifest", "file", "project.vibe"],
  ["production_bible", "production_bible", "file", "production_bible/production_bible.vibe.json"],
  ["story_flow", "story_flow", "file", "story_flow/story_flow.vibe.json"],
  ["visual_memory", "visual_memory", "directory", "visual_memory"],
  ["shots", "shots", "directory", "shots"],
  ["manifests", "manifests", "directory", "manifests"],
  ["reports", "reports", "directory", "reports"],
  ["preview", "preview", "directory", "preview"],
  ["exports", "exports", "directory", "exports"],
  ["knowledge", "knowledge", "directory", "knowledge"],
  ["settings", "settings", "directory", "settings"],
].map(([id, role, kind, plannedPath]) => ({
  id,
  role,
  kind,
  path: plannedPath,
  pathOrigin: "project_root_relative",
  status: "planned_only",
  requiredForFileFirstCore: true,
  notes: ["Planned project.vibe file-first path; import-runtime-test does not create, move, or write this project artifact."],
}));

const projectFileCoreSourcePriorityPlan = [
  ["project_manifest", "project.vibe", "planned_project_file"],
  ["production_bible", "production_bible/production_bible.vibe.json", "project_file_tree"],
  ["story_flow", "story_flow/story_flow.vibe.json", "project_file_tree"],
  ["visual_memory", "visual_memory/visual_memory.vibe.json", "project_file_tree"],
  ["shots", "shots/shots.vibe.json", "project_file_tree"],
  ["manifests", "manifests/project_manifest.vibe.json", "project_file_tree"],
  ["reports", "reports/runtime_audit.vibe.json", "project_file_tree"],
  ["preview", "preview/preview_plan.vibe.json", "project_file_tree"],
  ["exports", "exports/export_profiles.vibe.json", "project_file_tree"],
  ["knowledge", "knowledge/knowledge_manifest.vibe.json", "project_file_tree"],
  ["settings", "settings/runtime_settings.vibe.json", "project_file_tree"],
  ["runtime_state", "runtime-state.json", "derived_cache"],
];

function normalizeProjectFileCorePath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/\/+/g, "/");
}

function isAbsoluteLikePath(value) {
  return /^(?:[A-Za-z]:[\\/]|\/|\/\/)/.test(String(value || ""));
}

function toProjectFileCorePathRef(pathValue, projectRoot, sourceRef) {
  const raw = String(pathValue || "").trim();
  if (!raw) return undefined;
  const normalized = normalizeProjectFileCorePath(raw);
  const root = projectRoot ? normalizeProjectFileCorePath(projectRoot).replace(/\/+$/, "") : "";
  if (root && normalized === root) {
    return {
      path: ".",
      origin: "user_selected_import",
      importedFrom: "user_selected_import",
      sourceRef,
      notes: ["User-selected import root is evidence only; it is not a portable project-file path contract."],
    };
  }
  if (root && normalized.startsWith(`${root}/`)) {
    return {
      path: normalized.slice(root.length + 1),
      origin: "project_root_relative",
      importedFrom: "user_selected_import",
      sourceRef,
      notes: ["Imported absolute path normalized to project-root-relative form."],
    };
  }
  if (isAbsoluteLikePath(normalized)) {
    return {
      path: normalized,
      origin: "user_selected_import",
      importedFrom: "user_selected_import",
      sourceRef,
      notes: ["External absolute path is allowed only as a user-selected import source."],
    };
  }
  return {
    path: normalized.replace(/^\/+/, ""),
    origin: "project_root_relative",
    sourceRef,
    notes: ["Path is project-root-relative."],
  };
}

function projectFileCoreRefsForRole(input, role) {
  const refs = [];
  if (role === "project_manifest") refs.push(toProjectFileCorePathRef(input.projectRoot, input.projectRoot, "audit.projectRoot"));
  if (role === "production_bible") {
    refs.push(toProjectFileCorePathRef(input.sourceIndex.currentProductionBibleId, input.projectRoot, "sourceIndex.currentProductionBibleId"));
    refs.push(toProjectFileCorePathRef(input.sourceTask, input.projectRoot, "audit.sourceTask"));
  }
  if (role === "story_flow") {
    refs.push(toProjectFileCorePathRef(input.sourceIndex.currentStoryFlowId, input.projectRoot, "sourceIndex.currentStoryFlowId"));
    refs.push(toProjectFileCorePathRef(input.sourceIndex.currentShotSpecId, input.projectRoot, "sourceIndex.currentShotSpecId"));
  }
  if (role === "visual_memory") {
    refs.push(toProjectFileCorePathRef(input.sourceIndex.currentVisualMemoryId, input.projectRoot, "sourceIndex.currentVisualMemoryId"));
    refs.push(...input.assets.slice(0, 12).map((asset) => toProjectFileCorePathRef(asset.path, input.projectRoot, `visualMemory.assets:${asset.id}`)));
  }
  if (role === "shots") {
    refs.push(...input.shots.slice(0, 12).flatMap((shot) => [
      toProjectFileCorePathRef(shot.startFrame, input.projectRoot, `storyFlow.shots:${shot.id}.startFrame`),
      toProjectFileCorePathRef(shot.endFrame, input.projectRoot, `storyFlow.shots:${shot.id}.endFrame`),
      toProjectFileCorePathRef(shot.videoPath, input.projectRoot, `storyFlow.shots:${shot.id}.videoPath`),
    ]));
  }
  if (role === "knowledge") refs.push(toProjectFileCorePathRef(input.sourceIndex.knowledgeLibraryRoot, input.projectRoot, "sourceIndex.knowledgeLibraryRoot"));
  if (role === "runtime_state") refs.push(toProjectFileCorePathRef("runtime-state.json", input.projectRoot, "stateSource.path"));
  return refs.filter(Boolean);
}

function buildProjectFileCoreState(input) {
  const blockers = [];
  if (!input.sourceIndex.sourceIndexHash) blockers.push("sourceIndex.sourceIndexHash is required to key the derived runtime-state cache.");
  if (!input.sourceIndex.projectId) blockers.push("sourceIndex.projectId is required for project manifest planning.");
  return {
    schemaVersion: "0.1.0",
    generatedAt: input.generatedAt,
    phase: "phase_9_1_minimum_file_first_core",
    projectFileName: "project.vibe",
    projectFileStatus: "planned_not_written",
    projectRoot: {
      rootRef: "project_root",
      origin: "user_selected_import",
      selectedImport: toProjectFileCorePathRef(input.projectRoot, input.projectRoot, "audit.projectRoot"),
      notes: ["The imported project root is user-selected input; Phase 9.1 does not write or move anything there."],
    },
    plannedFileTree: projectFileCorePlannedEntries,
    sourceOfTruthPriority: projectFileCoreSourcePriorityPlan.map(([role, canonicalPath, authority], index) => ({
      role,
      priority: index + 1,
      canonicalPath,
      authority,
      runtimeStateMayOverride: false,
      importedSourceRefs: projectFileCoreRefsForRole(input, role),
      notes: role === "runtime_state"
        ? ["Runtime-state is a derived cache and cannot override project-file facts."]
        : ["This role is part of the planned project.vibe file-first source-of-truth chain."],
    })),
    derivedCachePolicy: {
      runtimeStateRole: "derived_cache",
      runtimeStateMayBeRebuilt: true,
      runtimeStateIsSoleSourceOfTruth: false,
      rebuildInputs: [
        "project_manifest",
        "production_bible",
        "story_flow",
        "visual_memory",
        "shots",
        "manifests",
        "reports",
        "preview",
        "exports",
        "knowledge",
        "settings",
      ],
      cacheKeys: {
        sourceIndexHash: input.sourceIndex.sourceIndexHash,
        projectVersion: input.sourceIndex.projectVersion || input.importedAt || input.generatedAt,
        generatedAt: input.generatedAt,
      },
      invalidationRefs: uniqueSorted([
        input.sourceIndex.sourceIndexHash,
        ...input.shots.map((shot) => shot.id),
        ...input.assets.map((asset) => asset.id),
      ]),
      notes: ["runtime-state is rebuildable derived cache; project.vibe and the planned tree are the intended fact surface."],
    },
    pathPolicy: {
      allowedOrigins: ["project_root_relative", "user_selected_import"],
      projectRootRelativeRequired: true,
      userSelectedImportAllowed: true,
      hardcodedAbsolutePathContractForbidden: true,
      platformSpecificPathContractForbidden: true,
      pathResolverRequired: true,
      notes: ["Persisted paths must be project-root-relative; absolute paths are import evidence only."],
    },
    hardLocks: {
      dryRunOnly: true,
      readOnly: true,
      noFileMutation: true,
      noUserFileMove: true,
      noProviderSubmit: true,
      noImageGeneration: true,
      noVideoGeneration: true,
      noArbitraryShell: true,
      noCredentialRead: true,
      noCredentialWrite: true,
      projectVibeWriteAllowed: false,
      runtimeStateIsDerivedCache: true,
    },
    migrationReadiness: {
      status: blockers.length ? "blocked" : "planned_only_ready",
      readyForDryRunPlanning: blockers.length === 0,
      readyForRuntimeDerivation: blockers.length === 0,
      readyForProjectVibeWrite: false,
      blockers,
      warnings: ["Phase 9.1 plans project.vibe and the file tree only; it does not write, move, generate, or submit anything."],
      nextSteps: [
        "Add an explicit project.vibe writer only after the file contract is approved.",
        "Keep runtime-state rebuildable from project-file facts as subsequent phases migrate more fields.",
      ],
    },
    sourceRefs: [
      "audit.projectRoot",
      "sourceIndex",
      "storyFlow.shots",
      "visualMemory.assets",
      "runtime.config.projectRootPolicy",
      "runtime.providerEnablementSummary",
    ],
    notes: [
      "project.vibe is planned, not written, in Phase 9.1.",
      "No provider submit, file mutation, arbitrary shell execution, credential read/write, image generation, or video generation is allowed.",
    ],
  };
}

const subagentRunnerTaskKinds = [
  "image",
  "asset",
  "pair_qa",
  "scene_qa",
  "story_audit",
  "video_execution",
  "audio",
  "export",
];

const subagentRunnerHardLocks = {
  dryRunOnly: true,
  diagnosticsOnly: true,
  noFreeTextTask: true,
  validatedEnvelopeRequired: true,
  noSpawnAgent: true,
  noSubprocess: true,
  noShellExecution: true,
  noProviderExecution: true,
  noCredentialRead: true,
  noFileMutation: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
};

const subagentRunnerPacketRequirements = [
  ["source_index_hash", "Source Index Hash", "SubagentTaskEnvelope.sourceIndexHash"],
  ["provider_policy", "Provider Policy", "SubagentTaskEnvelope.providerPolicySummary"],
  ["expected_output_contract", "Expected Output Contract", "SubagentTaskEnvelope.expectedOutputContract"],
  ["acceptance_checklist", "Acceptance Checklist", "SubagentTaskEnvelope.qaChecklist"],
  ["output_schema", "Output Schema", "SubagentTaskEnvelope.expectedOutputContract.format"],
  ["forbidden_actions", "Forbidden Actions", "SubagentTaskEnvelope.disallowedReadScopes + mustNotAdd + taskEnvelope.hardRules"],
].map(([requirementId, label, schemaPath]) => ({
  requirementId,
  label,
  required: true,
  schemaPath,
  notes: ["Production worker planning requires this field in a validated SubagentTaskEnvelope."],
}));

function runnerHasItems(value) {
  return Array.isArray(value) && value.length > 0;
}

function checkSubagentEnvelopeRequirements(envelope) {
  return [
    {
      requirementId: "source_index_hash",
      present: Boolean(envelope?.sourceIndexHash),
      detail: envelope?.sourceIndexHash ? "sourceIndexHash is present." : "sourceIndexHash is missing.",
    },
    {
      requirementId: "provider_policy",
      present: runnerHasItems(envelope?.providerPolicySummary),
      detail: runnerHasItems(envelope?.providerPolicySummary) ? "providerPolicySummary is present." : "providerPolicySummary is missing.",
    },
    {
      requirementId: "expected_output_contract",
      present: Boolean(envelope?.expectedOutputContract && runnerHasItems(envelope.expectedOutputContract.requiredFields)),
      detail: envelope?.expectedOutputContract ? "expectedOutputContract is present." : "expectedOutputContract is missing.",
    },
    {
      requirementId: "acceptance_checklist",
      present: runnerHasItems(envelope?.qaChecklist),
      detail: runnerHasItems(envelope?.qaChecklist) ? "qaChecklist is present." : "qaChecklist is missing.",
    },
    {
      requirementId: "output_schema",
      present: envelope?.expectedOutputContract?.format === "subagent_result_v1",
      detail:
        envelope?.expectedOutputContract?.format === "subagent_result_v1"
          ? "output schema is subagent_result_v1."
          : "output schema is missing or unsupported.",
    },
    {
      requirementId: "forbidden_actions",
      present:
        runnerHasItems(envelope?.disallowedReadScopes) &&
        (runnerHasItems(envelope?.mustNotAdd) || runnerHasItems(envelope?.forbiddenReferences) || runnerHasItems(envelope?.taskEnvelope?.hardRules)),
      detail:
        runnerHasItems(envelope?.disallowedReadScopes) &&
        (runnerHasItems(envelope?.mustNotAdd) || runnerHasItems(envelope?.forbiddenReferences) || runnerHasItems(envelope?.taskEnvelope?.hardRules))
          ? "forbidden read scopes/actions are present."
          : "forbidden read scopes/actions are incomplete.",
    },
  ];
}

function runnerSafeId(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function subagentRunnerTaskKindForGeneration(job) {
  return job.providerSlot === "image.reference_asset" ? "asset" : "image";
}

function makeSubagentRunnerSlot(input) {
  const checks = checkSubagentEnvelopeRequirements(input.envelope);
  const envelopeStatus = input.envelope ? (checks.every((check) => check.present) ? "validated" : "invalid") : "missing";
  const status = input.freeTextPromptPresent
    ? "blocked_missing_envelope"
    : envelopeStatus === "validated"
      ? "planned"
      : envelopeStatus === "invalid"
        ? "blocked_contract_violation"
        : input.blockedWhenMissing
          ? "blocked_missing_envelope"
          : "planned_missing_envelope";
  const blockedReasons = uniqueSorted([
    ...(input.freeTextPromptPresent ? ["free_text_task_input_forbidden"] : []),
    ...(status === "planned_missing_envelope" || status === "blocked_missing_envelope" ? ["validated_subagent_task_envelope_required"] : []),
    ...(status === "blocked_contract_violation" ? checks.filter((check) => !check.present).map((check) => `missing_${check.requirementId}`) : []),
  ]);

  return {
    runnerSlotId: input.runnerSlotId,
    taskKind: input.taskKind,
    purpose: input.purpose,
    sourceId: input.sourceId,
    envelopeId: input.envelope?.id,
    parentTaskId: input.envelope?.parentTaskId,
    shotId: input.shotId || input.envelope?.shotId,
    status,
    envelopeStatus,
    canExecute: false,
    canSpawnAgent: false,
    freeTextPromptPresent: Boolean(input.freeTextPromptPresent),
    requirementChecks: checks,
    blockedReasons,
    warnings: uniqueSorted(input.warnings || []),
    sourceRefs: uniqueSorted(input.sourceRefs || []),
    notes: uniqueSorted([
      "Subagent Runner 9.3 is diagnostics-only and does not spawn a worker.",
      ...(input.notes || []),
    ]),
  };
}

function buildSubagentRunnerState(input) {
  const slots = [
    ...(input.videoExecutionPreview?.previews || []).map((preview) =>
      makeSubagentRunnerSlot({
        runnerSlotId: `subagent_runner_video_${runnerSafeId(preview.previewId)}`,
        taskKind: "video_execution",
        purpose: "video_generation",
        sourceId: preview.previewId,
        envelope: preview.subagentTaskEnvelope,
        shotId: preview.shotId,
        sourceRefs: [
          `videoExecutionPreview:${preview.previewId}`,
          `videoExecutionPreview.taskPlan:${preview.taskPlanId}`,
          `videoExecutionPreview.readinessGate:${preview.readinessGateId}`,
        ],
        warnings: preview.warnings,
        notes: ["Video execution packets are recognized from packet previews."],
      }),
    ),
    ...(input.generationHarness?.jobs || []).map((job) =>
      makeSubagentRunnerSlot({
        runnerSlotId: `subagent_runner_generation_${runnerSafeId(job.harnessJobId)}`,
        taskKind: subagentRunnerTaskKindForGeneration(job),
        purpose: "visual_generation",
        sourceId: job.harnessJobId,
        shotId: job.shotId,
        sourceRefs: [`generationHarness:${job.harnessJobId}`, `generationHarness.taskPlan:${job.taskPlanId}`],
        warnings: job.warnings,
        notes: ["Generation harness facts create future worker coverage, but no SubagentTaskEnvelope exists yet."],
      }),
    ),
    ...(input.qaHarness?.items || []).flatMap((item) => [
      makeSubagentRunnerSlot({
        runnerSlotId: `subagent_runner_pair_qa_${runnerSafeId(item.qaItemId)}`,
        taskKind: "pair_qa",
        purpose: "continuity_audit",
        sourceId: `${item.qaItemId}:pair_qa`,
        shotId: item.shotId,
        sourceRefs: uniqueSorted([`qaHarness:${item.qaItemId}`, item.videoTaskPlanId || ""]),
        notes: ["QA harness facts create future audit worker coverage, but no SubagentTaskEnvelope exists yet."],
      }),
      makeSubagentRunnerSlot({
        runnerSlotId: `subagent_runner_scene_qa_${runnerSafeId(item.qaItemId)}`,
        taskKind: "scene_qa",
        purpose: "visual_audit",
        sourceId: `${item.qaItemId}:scene_qa`,
        shotId: item.shotId,
        sourceRefs: uniqueSorted([`qaHarness:${item.qaItemId}`, item.harnessJobId || ""]),
        notes: ["QA harness facts create future audit worker coverage, but no SubagentTaskEnvelope exists yet."],
      }),
      makeSubagentRunnerSlot({
        runnerSlotId: `subagent_runner_story_audit_${runnerSafeId(item.qaItemId)}`,
        taskKind: "story_audit",
        purpose: "story_audit",
        sourceId: `${item.qaItemId}:story_audit`,
        shotId: item.shotId,
        sourceRefs: uniqueSorted([`qaHarness:${item.qaItemId}`, item.taskPlanId || ""]),
        notes: ["QA harness facts create future audit worker coverage, but no SubagentTaskEnvelope exists yet."],
      }),
      makeSubagentRunnerSlot({
        runnerSlotId: `subagent_runner_audio_${runnerSafeId(item.qaItemId)}`,
        taskKind: "audio",
        purpose: "continuity_audit",
        sourceId: `${item.qaItemId}:audio`,
        shotId: item.shotId,
        sourceRefs: uniqueSorted([`qaHarness:${item.qaItemId}`, item.audioPlanId || ""]),
        notes: ["QA harness facts create future audio worker coverage, but no SubagentTaskEnvelope exists yet."],
      }),
    ]),
  ].sort((left, right) => left.runnerSlotId.localeCompare(right.runnerSlotId));
  const coverage = subagentRunnerTaskKinds.map((taskKind) => {
    const scoped = slots.filter((slot) => slot.taskKind === taskKind);
    return {
      taskKind,
      expected: true,
      totalSlots: scoped.length,
      planned: scoped.filter((slot) => slot.status === "planned").length,
      plannedMissingEnvelope: scoped.filter((slot) => slot.status === "planned_missing_envelope").length,
      blockedMissingEnvelope: scoped.filter((slot) => slot.status === "blocked_missing_envelope").length,
      blockedContractViolation: scoped.filter((slot) => slot.status === "blocked_contract_violation").length,
      sourceRefs: uniqueSorted(scoped.flatMap((slot) => slot.sourceRefs)),
      notes: [
        scoped.length
          ? `Coverage inferred from ${scoped.length} ${taskKind} slot(s).`
          : `No current ${taskKind} slots were inferred; future packets remain missing coverage.`,
      ],
    };
  });

  return {
    schemaVersion: "0.1.0",
    generatedAt: input.generatedAt,
    slots,
    coverage,
    summary: {
      totalSlots: slots.length,
      planned: slots.filter((slot) => slot.status === "planned").length,
      plannedMissingEnvelope: slots.filter((slot) => slot.status === "planned_missing_envelope").length,
      blockedMissingEnvelope: slots.filter((slot) => slot.status === "blocked_missing_envelope").length,
      blockedContractViolation: slots.filter((slot) => slot.status === "blocked_contract_violation").length,
      freeTextBlocked: slots.filter((slot) => slot.freeTextPromptPresent && slot.status !== "planned").length,
      validatedEnvelopes: slots.filter((slot) => slot.envelopeStatus === "validated").length,
      missingEnvelopes: slots.filter((slot) => slot.envelopeStatus === "missing").length,
      invalidEnvelopes: slots.filter((slot) => slot.envelopeStatus === "invalid").length,
      canExecute: 0,
      dryRunOnly: true,
      diagnosticsOnly: true,
      noFreeTextTask: true,
      validatedEnvelopeRequired: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
    },
    hardLocks: subagentRunnerHardLocks,
    blockedReasons: uniqueSorted(slots.flatMap((slot) => slot.blockedReasons)),
    packetRequirements: subagentRunnerPacketRequirements,
    dryRunOnly: true,
    diagnosticsOnly: true,
    noFreeTextTask: true,
    validatedEnvelopeRequired: true,
    noSpawnAgent: true,
    noSubprocess: true,
    noShellExecution: true,
    noProviderExecution: true,
    noCredentialRead: true,
    noFileMutation: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      "Phase 9.3 Subagent Runner is a plan/diagnostics contract only.",
      "Production workers must be launched from validated SubagentTaskEnvelope packets, never free-text prompts.",
      "This state does not call Codex CLI, start subprocesses, execute shell commands, submit providers, read credentials, or move files.",
    ],
  };
}

function buildAgentCliMockRunnerState(input) {
  const validatedEnvelopeIds = uniqueSorted(
    (input.taskViews || [])
      .filter((task) => task.validator?.valid === true)
      .map((task) => task.envelope?.id)
      .filter(Boolean),
  );
  const blockedReasons = uniqueSorted([
    "subagent_runtime_gate_receipt_missing",
    "validated_subagent_task_envelope_required",
    ...(validatedEnvelopeIds.length ? [] : ["mock_runner_validated_envelope_missing"]),
  ]);
  const replacementProofReady = false;
  const envelopeId = validatedEnvelopeIds[0];
  const noopResult = {
    resultId: `agent_cli_mock_result_import_${runnerSafeId(envelopeId || "missing_envelope")}`,
    resultKind: "subagent_result_v1_mock_noop",
    status: "blocked",
    envelopeId,
    sourceRefs: envelopeId ? [`runtimeTaskEnvelope:${envelopeId}`] : [],
    inspectedFiles: [],
    gates: {
      identity: "N/A",
      scene: "N/A",
      pair: "N/A",
      story: "N/A",
      prop: "N/A",
      style: "N/A",
    },
    overallVisualVerdict: "N/A",
    styleQa: "N/A",
    motionQa: "N/A",
    continuityQa: "N/A",
    referenceUseDecision: "draft_only",
    issues: [],
    requiredFixes: blockedReasons,
    approvedFor: [],
    rejectedFor: ["phase_26_mock_runner_replacement_proof"],
    summaryForMainAgent: "Import runtime records the Phase 26 mock runner boundary only; no agent, provider, shell, credential, or file mutation path is executed.",
    notRealExecution: true,
  };
  const blockedSlot = {
    runnerSlotId: `agent_cli_mock_runner_import_${runnerSafeId(envelopeId || "missing_envelope")}`,
    scenarioId: "import_runtime_contract",
    envelopeId,
    status: "blocked",
    blockedReasons,
    noopResult,
  };

  return {
    schemaVersion: "0.1.0",
    phase: "phase_26_agent_cli_mock_runner",
    generatedAt: input.generatedAt,
    runnerKind: "mock_noop",
    purpose: "prove_replaceable_runner_contract",
    readiness: "blocked",
    replacementProofReady,
    readySlots: [],
    blockedSlots: [blockedSlot],
    noopResults: [noopResult],
    adapterBoundary: {
      inputContract: "validated_subagent_task_envelope_only",
      outputContract: "structured_subagent_result_shape_only",
      runnerContract: "replaceable_agent_cli_adapter",
      phase26Boundary: "mock_noop_only",
      phase29Boundary: "codex_cli_adapter_spike_after_replacement_proof",
      providerSubmitAllowed: false,
      shellAllowed: false,
      fileMutationAllowed: false,
    },
    hardLocks: {
      noCodexSpawn: true,
      noCodexResume: true,
      noProviderSubmit: true,
      liveSubmitAllowed: false,
      noCredentialRead: true,
      noCredentialWrite: true,
      noShellExecution: true,
      noFileMutation: true,
      validatedEnvelopeRequired: true,
      structuredResultRequired: true,
      noFreeTextWorker: true,
      mockOnly: true,
    },
    receipt: {
      receiptId: `agent_cli_mock_runner_import_${runnerSafeId(envelopeId || "missing")}`,
      phase: "phase_26_agent_cli_mock_runner",
      runnerKind: "mock_noop",
      purpose: "prove_replaceable_runner_contract",
      replacementProofReady,
      blockedReasons,
      sourceRefs: envelopeId ? [`runtimeTaskEnvelope:${envelopeId}`] : [],
    },
    validation: {
      ok: false,
      errors: blockedReasons,
      warnings: ["Import runtime did not receive a Phase 24 gate receipt or SubagentTaskEnvelope object."],
      checkedAt: input.generatedAt,
    },
    notes: [
      "Phase 26 is a mock/no-op runner contract proof only.",
      "Import runtime records the boundary without spawning or resuming Codex, submitting providers, executing shell, reading credentials, or mutating files.",
    ],
  };
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

const adapterProviderSlots = [
  "image.generate",
  "image.edit",
  "image.reference_asset",
  "video.i2v",
  "video.t2v.experimental",
  "video.extend",
  "video.edit",
  "audio.tts",
  "audio.music",
  "local.postprocess",
  "local.workflow",
];

function adapterCapabilityRefs(capabilities) {
  return capabilities.map((capability) => capability.id).sort((left, right) => left.localeCompare(right));
}

function matchingAdapterCapabilities(providerRegistry, providerIds, slot, requiredModes) {
  return providerRegistry.capabilities.filter(
    (capability) =>
      providerIds.includes(capability.providerId) &&
      capability.slot === slot &&
      requiredModes.includes(capability.requiredMode),
  );
}

function adapterCapabilitySummary(capabilities) {
  const outputKinds = Array.from(new Set(capabilities.map((capability) => capability.outputKind))).sort();
  const supportsReferenceImage = capabilities.some((capability) => capability.supports.referenceImage)
    ? true
    : capabilities.some((capability) => capability.supports.mask === "planned")
      ? "planned"
      : false;
  const supportsStartEndFrame = capabilities.some((capability) => capability.supports.startEndFrame)
    ? true
    : capabilities.some((capability) => capability.supports.cameraControl === "planned")
      ? "planned"
      : false;
  const supportsTextToVideo = capabilities.some((capability) => capability.slot === "video.t2v.experimental")
    ? "experimental_parked"
    : false;
  return { outputKinds, supportsReferenceImage, supportsStartEndFrame, supportsTextToVideo };
}

function providerAdapterContract(input) {
  return {
    kind: "provider",
    dryRunOnly: true,
    readOnly: true,
    liveSubmitAllowed: false,
    credentialStorage: false,
    providerSubmissionForbidden: true,
    arbitraryProviderCommandAllowed: false,
    ...input,
  };
}

function buildAdapterContractState(generatedAt, providerRegistry) {
  const image2GenerateProviderIds = ["openai-image2-codex-cli"];
  const image2ApiProviderIds = ["openai-image2-api"];
  const seedanceProviderIds = ["seedance2-provider"];
  const jimengProviderIds = ["jimeng-video"];
  const image2GenerateCapabilities = matchingAdapterCapabilities(providerRegistry, image2GenerateProviderIds, "image.generate", ["text2image"]);
  const image2EditCapabilities = matchingAdapterCapabilities(providerRegistry, image2ApiProviderIds, "image.edit", ["image2image"]);
  const image2ReferenceCapabilities = matchingAdapterCapabilities(providerRegistry, image2ApiProviderIds, "image.reference_asset", ["text2image", "image2image"]);
  const seedanceCapabilities = matchingAdapterCapabilities(providerRegistry, seedanceProviderIds, "video.i2v", ["frames2video"]);
  const jimengCapabilities = matchingAdapterCapabilities(providerRegistry, jimengProviderIds, "video.i2v", ["frames2video"]);
  const agentAdapters = [
    {
      id: "codex-cli-agent",
      kind: "agent",
      label: "Codex CLI Agent",
      runtimeKind: "codex_cli",
      state: "active",
      dryRunOnly: true,
      readOnly: true,
      liveSubmitAllowed: false,
      credentialStatus: "not_required",
      credentialStorage: false,
      uiBinding: false,
      capabilities: {
        canSpawnSubagents: true,
        canUseImageRuntime: true,
        contextPacketRequired: true,
        supportsThreadHandoff: true,
        supportsStructuredResult: true,
      },
      forbiddenRoutes: ["ui_binding", "live_submit", "credential_read", "credential_storage", "arbitrary_shell"],
      notes: ["Default agent runtime contract; product logic must depend on capabilities, not Codex-specific identity."],
    },
  ];
  const workerAdapters = [
    {
      id: "subagent-worker",
      kind: "worker",
      label: "Structured Subagent Worker",
      state: "active",
      dryRunOnly: true,
      readOnly: true,
      liveSubmitAllowed: false,
      credentialStatus: "not_required",
      credentialStorage: false,
      requiredEnvelopeSchema: "subagent_task_envelope.schema.json",
      allowedPurposes: [
        "visual_generation",
        "visual_audit",
        "video_generation",
        "video_audit",
        "continuity_audit",
        "regeneration_plan",
        "story_audit",
      ],
      readScopePolicy: "context_packet_only",
      writeScopePolicy: "declared_outputs_only",
      mustReceiveContextPacket: true,
      canBypassEnvelope: false,
      forbiddenRoutes: ["freeform_context", "envelope_bypass", "live_submit", "credential_read", "credential_storage"],
      notes: ["Worker/subagent execution must be mediated by subagent_task_envelope and a context packet."],
    },
  ];
  const providerAdapters = [
    providerAdapterContract({
      id: "image2-provider",
      label: "Image2 Generate Provider Contract",
      providerIds: image2GenerateProviderIds,
      slot: "image.generate",
      requiredModes: ["text2image"],
      state: "active",
      credentialStatus: "not_required",
      capabilityRefs: adapterCapabilityRefs(image2GenerateCapabilities),
      capabilitySummary: adapterCapabilitySummary(image2GenerateCapabilities),
      forbiddenRoutes: ["live_submit", "credential_read", "credential_storage", "arbitrary_provider_command"],
      notes: ["Active Image2 text-to-image contract. It mirrors one provider slot/mode and remains dry-run/read-only."],
    }),
    providerAdapterContract({
      id: "image2-edit-provider",
      label: "Image2 Edit Provider Contract",
      providerIds: image2ApiProviderIds,
      slot: "image.edit",
      requiredModes: ["image2image"],
      state: "active",
      credentialStatus: "not_required",
      capabilityRefs: adapterCapabilityRefs(image2EditCapabilities),
      capabilitySummary: adapterCapabilitySummary(image2EditCapabilities),
      forbiddenRoutes: ["live_submit", "credential_read", "credential_storage", "arbitrary_provider_command"],
      notes: ["Active Image2 image-to-image contract. It cannot fall back to text-to-image."],
    }),
    providerAdapterContract({
      id: "image2-reference-asset-provider",
      label: "Image2 Reference Asset Provider Contract",
      providerIds: image2ApiProviderIds,
      slot: "image.reference_asset",
      requiredModes: ["text2image", "image2image"],
      state: "active",
      credentialStatus: "not_required",
      capabilityRefs: adapterCapabilityRefs(image2ReferenceCapabilities),
      capabilitySummary: adapterCapabilitySummary(image2ReferenceCapabilities),
      forbiddenRoutes: ["live_submit", "credential_read", "credential_storage", "arbitrary_provider_command"],
      notes: ["Active Image2 reference-asset contract. Text and edit modes stay explicit, never silent fallbacks."],
    }),
    providerAdapterContract({
      id: "seedance2-provider",
      label: "Seedance 2 Provider Contract",
      providerIds: seedanceProviderIds,
      slot: "video.i2v",
      requiredModes: ["frames2video"],
      state: "parked",
      credentialStatus: "not_configured",
      capabilityRefs: adapterCapabilityRefs(seedanceCapabilities),
      capabilitySummary: adapterCapabilitySummary(seedanceCapabilities),
      forbiddenRoutes: ["fast_model", "vip_channel", "text_to_video_main_path", "bgm_in_video_prompt", "live_submit", "credential_read", "credential_storage", "arbitrary_provider_command"],
      notes: ["Parked video provider contract only; no Seedance submit route is connected."],
    }),
    providerAdapterContract({
      id: "jimeng-video",
      label: "Jimeng Video Provider Contract",
      providerIds: jimengProviderIds,
      slot: "video.i2v",
      requiredModes: ["frames2video"],
      state: "parked",
      credentialStatus: "not_configured",
      capabilityRefs: adapterCapabilityRefs(jimengCapabilities),
      capabilitySummary: adapterCapabilitySummary(jimengCapabilities),
      forbiddenRoutes: ["fast_model", "vip_channel", "text_to_video_main_path", "bgm_in_video_prompt", "live_submit", "credential_read", "credential_storage", "arbitrary_provider_command"],
      notes: ["Parked future video adapter contract; no Jimeng submit route is connected."],
    }),
    providerAdapterContract({
      id: "local-postprocess-planned",
      label: "Local Postprocess Planned Contract",
      providerIds: ["local-postprocess-planned"],
      slot: "local.postprocess",
      requiredModes: ["postprocess"],
      state: "planned",
      credentialStatus: "not_required",
      capabilityRefs: [],
      capabilitySummary: {
        outputKinds: ["metadata"],
        supportsReferenceImage: false,
        supportsStartEndFrame: false,
        supportsTextToVideo: false,
      },
      forbiddenRoutes: ["live_submit", "credential_read", "credential_storage", "arbitrary_provider_command"],
      notes: ["Planned local workflow slot. It cannot be used as semantic image/video repair."],
    }),
  ];
  const state = {
    schemaVersion: "0.1.0",
    generatedAt,
    agentAdapters,
    workerAdapters,
    providerAdapters,
    summary: {
      agentAdapters: agentAdapters.map((adapter) => adapter.id),
      workerAdapters: workerAdapters.map((adapter) => adapter.id),
      providerAdapters: providerAdapters.map((adapter) => adapter.id),
      activeImageProvider: "image2-provider",
      parkedVideoProviders: providerAdapters.filter((adapter) => adapter.slot.startsWith("video.") && adapter.state === "parked").map((adapter) => adapter.id),
      liveSubmitAllowed: false,
      credentialStorage: false,
      contractViolations: [],
    },
  };
  state.summary.contractViolations = validateAdapterContractState(state, providerRegistry);
  return state;
}

function validateAdapterContractState(state, providerRegistry = buildDefaultProviderRegistry()) {
  const violations = [];
  const capabilitiesById = new Map(providerRegistry.capabilities.map((capability) => [capability.id, capability]));
  for (const adapter of state.agentAdapters || []) {
    if (adapter.liveSubmitAllowed !== false) violations.push({ code: "live_submit_allowed", adapterId: adapter.id, severity: "blocker", detail: "Agent adapter cannot allow live submit." });
    if (adapter.credentialStorage !== false) violations.push({ code: "credential_storage_enabled", adapterId: adapter.id, severity: "blocker", detail: "Agent adapter cannot store credentials." });
    if (adapter.uiBinding !== false) violations.push({ code: "agent_ui_binding", adapterId: adapter.id, severity: "blocker", detail: "Agent adapter cannot bind to UI." });
  }
  for (const adapter of state.workerAdapters || []) {
    if (adapter.liveSubmitAllowed !== false) violations.push({ code: "live_submit_allowed", adapterId: adapter.id, severity: "blocker", detail: "Worker adapter cannot allow live submit." });
    if (adapter.credentialStorage !== false) violations.push({ code: "credential_storage_enabled", adapterId: adapter.id, severity: "blocker", detail: "Worker adapter cannot store credentials." });
    if (adapter.requiredEnvelopeSchema !== "subagent_task_envelope.schema.json" || adapter.canBypassEnvelope !== false) violations.push({ code: "worker_envelope_bypass", adapterId: adapter.id, severity: "blocker", detail: "Worker adapter must use subagent_task_envelope." });
    if (adapter.mustReceiveContextPacket !== true) violations.push({ code: "worker_context_packet_optional", adapterId: adapter.id, severity: "blocker", detail: "Worker adapter must receive a context packet." });
  }
  for (const adapter of state.providerAdapters || []) {
    if (!adapterProviderSlots.includes(adapter.slot)) violations.push({ code: "unknown_provider_slot", adapterId: adapter.id, severity: "blocker", detail: `${adapter.slot} is not a known provider slot.` });
    if (adapter.liveSubmitAllowed !== false) violations.push({ code: "live_submit_allowed", adapterId: adapter.id, severity: "blocker", detail: "Provider adapter cannot allow live submit." });
    if (adapter.credentialStorage !== false) violations.push({ code: "credential_storage_enabled", adapterId: adapter.id, severity: "blocker", detail: "Provider adapter cannot store credentials." });
    if (adapter.providerSubmissionForbidden !== true) violations.push({ code: "provider_submission_allowed", adapterId: adapter.id, severity: "blocker", detail: "Provider adapter must forbid provider submission." });
    if (adapter.arbitraryProviderCommandAllowed !== false) violations.push({ code: "arbitrary_provider_command_allowed", adapterId: adapter.id, severity: "blocker", detail: "Provider adapter cannot allow arbitrary provider commands." });
    const localPlaceholder = adapter.slot.startsWith("local.");
    if (!localPlaceholder && adapter.capabilityRefs.length === 0) violations.push({ code: "capability_mismatch", adapterId: adapter.id, severity: "blocker", detail: "Provider adapter must reference at least one matching provider capability." });
    for (const capabilityRef of adapter.capabilityRefs) {
      const capability = capabilitiesById.get(capabilityRef);
      if (!capability) {
        violations.push({ code: "capability_mismatch", adapterId: adapter.id, severity: "blocker", detail: `${capabilityRef} is not registered in provider capabilities.` });
        continue;
      }
      if (!adapter.providerIds.includes(capability.providerId) || capability.slot !== adapter.slot || !adapter.requiredModes.includes(capability.requiredMode)) {
        violations.push({ code: "capability_mismatch", adapterId: adapter.id, severity: "blocker", detail: `${capabilityRef} does not match providerIds/slot/requiredModes for this adapter contract.` });
      }
    }
    if (adapter.slot.startsWith("video.") && adapter.state !== "parked" && adapter.state !== "planned") violations.push({ code: "video_provider_not_parked", adapterId: adapter.id, severity: "blocker", detail: "Video providers must remain parked or planned." });
    if (adapter.id === "image2-provider" && (adapter.state !== "active" || adapter.dryRunOnly !== true)) violations.push({ code: "image2_not_active_dry_run", adapterId: adapter.id, severity: "blocker", detail: "Image2 must be active and dry-run only." });
  }
  return violations;
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

function styleDirectivesFromInjectedKnowledge(injectedKnowledgePacks = []) {
  const directives = injectedKnowledgePacks
    .filter((pack) => ["style", "composition", "camera", "lighting", "color", "prompt"].includes(pack.category))
    .slice(0, 6)
    .map((pack) => `${pack.consumer}:${pack.category}:${pack.packId}@${pack.hash}`);

  return directives.length ? directives : ["Use only routed knowledge summaries as compiler hints."];
}

function buildShotPromptPlan(job, shot, assets, sourceIndex, providerRegistry, injectedKnowledgePacks, generatedAt) {
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
    styleDirectives: styleDirectivesFromInjectedKnowledge(injectedKnowledgePacks),
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

const promptCheckerCameraMovementPattern = /\b(push(?:\s|-)?in|pull(?:\s|-)?back|dolly|truck|crane|orbit|whip\s*pan|zoom|sweeping|large\s+camera\s+move|dramatic\s+camera)\b/i;
const promptCheckerFrontDoorPattern = /\bfront\s+door\b/i;
const promptCheckerGaragePattern = /\bgarage(?:\s+door)?\b/i;
const promptCheckerColorWords = ["black", "blue", "brown", "cream", "green", "grey", "gray", "orange", "purple", "red", "silver", "white", "yellow"];

function normalizePromptCheckerText(value) {
  return String(value || "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function promptCheckerPromptText(plan) {
  return normalizePromptCheckerText([
    ...(plan.sourceIntent || []),
    ...(plan.mustPreserve || []),
    ...(plan.mustAvoid || []),
    ...(plan.styleDirectives || []),
    ...(plan.adapterWarnings || []),
  ].join(" "));
}

function promptCheckerShotText(shot) {
  if (!shot) return "";
  return normalizePromptCheckerText([shot.id, shot.title, shot.storyFunction, ...(shot.issues || [])].join(" "));
}

function promptCheckerReferencedAssets(plan, assets) {
  const refs = new Set((plan.referenceIds || []).map(normalizePromptCheckerText));
  return assets.filter((asset) => refs.has(normalizePromptCheckerText(asset.id)) || refs.has(normalizePromptCheckerText(asset.path)));
}

function promptCheckerLockedText(assets) {
  return normalizePromptCheckerText(
    assets
      .filter((asset) => asset.lockedStatus === "locked")
      .map((asset) => [asset.id, asset.name, asset.type, ...(asset.issues || [])].join(" "))
      .join(" "),
  );
}

function promptCheckerSourceRefs(plan, report, shot, assets = []) {
  return uniqueSorted([
    plan.promptPlanId,
    plan.promptPlanHash,
    plan.sourceShotSpecHash,
    report?.reportId || "",
    shot?.id || "",
    ...assets.map((asset) => asset.id),
  ]);
}

function promptCheckerResolutionFor(code) {
  return {
    updateShotSpec: code === "story_flow_stale_function" || code === "garage_front_door_conflict",
    updateShotLayout: code === "fixed_camera_movement_conflict" || code === "garage_front_door_conflict",
    updateShotPromptPlan: true,
    recompileRequired: true,
  };
}

function makePromptCheckerConflict({ code, target, structuredFact, promptEvidence, detail, sourceRefs }) {
  return {
    code,
    severity: "blocker",
    target,
    structuredFact,
    promptEvidence,
    detail,
    requiredResolution: promptCheckerResolutionFor(code),
    sourceRefs: uniqueSorted(sourceRefs),
  };
}

function promptCheckerStoryFunctionFromPrompt(text) {
  const match = text.match(/story function\s*:\s*([^|;]+)/i) || text.match(/story_function\s*:\s*([^|;]+)/i);
  return match?.[1] ? normalizePromptCheckerText(match[1]) : undefined;
}

function promptCheckerContainsFixedCameraFact(text) {
  return /\b(fixed camera|locked camera|static camera|tripod|no camera movement)\b/i.test(text);
}

function promptCheckerColorConflict(lockedText, text) {
  const lockedColors = promptCheckerColorWords.filter((color) => new RegExp(`\\b${color}\\b`, "i").test(lockedText));
  const promptColors = promptCheckerColorWords.filter((color) => new RegExp(`\\b${color}\\b`, "i").test(text));
  return lockedColors.length > 0 && promptColors.some((color) => !lockedColors.includes(color));
}

function promptCheckerOutfitConflict(lockedText, text) {
  if (!/\b(outfit|costume|clothes|coat|dress|jacket|uniform)\b/i.test(`${lockedText} ${text}`)) return false;
  return /\b(new|different|changed|replace|alternate)\s+(outfit|costume|clothes)\b/i.test(text) || promptCheckerColorConflict(lockedText, text);
}

function promptCheckerStyleConflict(lockedText, text) {
  const styleTokens = ["monochrome", "noir", "watercolor", "anime", "photoreal", "cinematic", "pixel art", "pastel"];
  const lockedStyles = styleTokens.filter((token) => lockedText.includes(token));
  const promptStyles = styleTokens.filter((token) => text.includes(token));
  return lockedStyles.length > 0 && promptStyles.some((token) => !lockedStyles.includes(token));
}

function buildPromptCheckerConflicts(plan, report, shot, assets) {
  const text = promptCheckerPromptText(plan);
  const shotText = promptCheckerShotText(shot);
  const lockedRefs = promptCheckerReferencedAssets(plan, assets).filter((asset) => asset.lockedStatus === "locked");
  const lockedText = promptCheckerLockedText(lockedRefs);
  const refs = promptCheckerSourceRefs(plan, report, shot, lockedRefs);
  const conflicts = [];
  const promptStoryFunction = promptCheckerStoryFunctionFromPrompt(text);
  const currentStoryFunction = shot?.storyFunction ? normalizePromptCheckerText(shot.storyFunction) : undefined;

  if (promptStoryFunction && currentStoryFunction && promptStoryFunction !== currentStoryFunction) {
    conflicts.push(makePromptCheckerConflict({
      code: "story_flow_stale_function",
      target: shot?.id || plan.promptPlanId,
      structuredFact: `storyFunction:${shot?.storyFunction}`,
      promptEvidence: `promptStoryFunction:${promptStoryFunction}`,
      detail: "Prompt source intent references an older Story Flow function.",
      sourceRefs: refs,
    }));
  }
  if ((promptCheckerGaragePattern.test(shotText) || promptCheckerGaragePattern.test(lockedText)) && promptCheckerFrontDoorPattern.test(text)) {
    conflicts.push(makePromptCheckerConflict({
      code: "garage_front_door_conflict",
      target: shot?.id || plan.promptPlanId,
      structuredFact: "Structured shot/scene fact requires garage door.",
      promptEvidence: "Prompt references front door.",
      detail: "Prompt door language conflicts with the current garage-door scene fact.",
      sourceRefs: refs,
    }));
  }
  if (promptCheckerContainsFixedCameraFact(`${shotText} ${lockedText}`) && promptCheckerCameraMovementPattern.test(text)) {
    conflicts.push(makePromptCheckerConflict({
      code: "fixed_camera_movement_conflict",
      target: shot?.id || plan.promptPlanId,
      structuredFact: "Shot Layout requires fixed/locked camera.",
      promptEvidence: "Prompt contains large camera movement.",
      detail: "Prompt motion conflicts with a fixed camera Shot Layout fact.",
      sourceRefs: refs,
    }));
  }
  if (plan.promptKind === "end_frame" && plan.derivesFromStartFrame !== true) {
    conflicts.push(makePromptCheckerConflict({
      code: "independent_end_frame_conflict",
      target: plan.promptPlanId,
      structuredFact: "End frame must derive from the start frame by default.",
      promptEvidence: `derivesFromStartFrame:${String(plan.derivesFromStartFrame)}`,
      detail: "End-frame prompt plan is compiled as independent generation instead of start-frame derivation.",
      sourceRefs: refs,
    }));
  }
  if (promptCheckerOutfitConflict(lockedText, text)) {
    conflicts.push(makePromptCheckerConflict({
      code: "visual_memory_locked_outfit_conflict",
      target: plan.promptPlanId,
      structuredFact: "Visual Memory has a locked outfit reference.",
      promptEvidence: "Prompt asks for a different outfit/color.",
      detail: "Prompt conflicts with locked Visual Memory outfit facts.",
      sourceRefs: refs,
    }));
  }
  if ((promptCheckerGaragePattern.test(lockedText) && promptCheckerFrontDoorPattern.test(text)) || (/\b(scene|location)\s*:\s*locked\b/i.test(lockedText) && /\bnew location|different scene\b/i.test(text))) {
    conflicts.push(makePromptCheckerConflict({
      code: "visual_memory_locked_scene_conflict",
      target: plan.promptPlanId,
      structuredFact: "Visual Memory has a locked scene reference.",
      promptEvidence: "Prompt asks for a conflicting scene/location.",
      detail: "Prompt conflicts with locked Visual Memory scene facts.",
      sourceRefs: refs,
    }));
  }
  if (promptCheckerStyleConflict(lockedText, text)) {
    conflicts.push(makePromptCheckerConflict({
      code: "visual_memory_locked_style_conflict",
      target: plan.promptPlanId,
      structuredFact: "Visual Memory has a locked style reference.",
      promptEvidence: "Prompt asks for a different style.",
      detail: "Prompt conflicts with locked Visual Memory style facts.",
      sourceRefs: refs,
    }));
  }
  for (const compilerConflict of report?.conflicts || []) {
    if (compilerConflict.severity === "blocker") {
      conflicts.push(makePromptCheckerConflict({
        code: "compiler_conflict_report_blocker",
        target: compilerConflict.target || plan.promptPlanId,
        structuredFact: "Compiler conflict report already blocks this prompt plan.",
        promptEvidence: compilerConflict.detail,
        detail: compilerConflict.detail,
        sourceRefs: refs,
      }));
    }
  }
  return conflicts;
}

function buildPromptConflictCheckerState({ generatedAt, promptPlans, promptConflictReports, shots, assets }) {
  const reportsByPlan = new Map(promptConflictReports.map((report) => [report.promptPlanId, report]));
  const shotsById = new Map(shots.map((shot) => [shot.id, shot]));
  const items = promptPlans.map((plan) => {
    const report = reportsByPlan.get(plan.promptPlanId);
    const shot = plan.shotId ? shotsById.get(plan.shotId) : undefined;
    const scopedAssets = promptCheckerReferencedAssets(plan, assets);
    const conflicts = buildPromptCheckerConflicts(plan, report, shot, assets);
    const status = conflicts.some((conflict) => conflict.severity === "blocker") ? "blocked" : report?.status === "warning" ? "warning" : "clear";
    return {
      checkerItemId: `prompt_conflict_checker_${plan.promptPlanId}`,
      promptPlanId: plan.promptPlanId,
      jobId: plan.jobId,
      shotId: plan.shotId,
      status,
      conflictReportId: report?.reportId || plan.conflictReportId,
      promptPlanHash: plan.promptPlanHash,
      sourceShotSpecHash: plan.sourceShotSpecHash,
      conflicts,
      blockers: uniqueSorted(conflicts.filter((conflict) => conflict.severity === "blocker").map((conflict) => conflict.detail)),
      warnings: uniqueSorted([
        ...conflicts.filter((conflict) => conflict.severity === "warning").map((conflict) => conflict.detail),
        ...(report?.status === "warning" ? report.conflicts.map((conflict) => conflict.detail) : []),
      ]),
      sourceRefs: promptCheckerSourceRefs(plan, report, shot, scopedAssets),
      nextAction: status === "blocked"
        ? "Update Shot Spec, Shot Layout, or Shot Prompt Plan and recompile before generation."
        : status === "warning"
          ? "Review compiler warnings before turning this plan into a generation task."
          : "No structured prompt conflict detected.",
    };
  });

  return {
    schemaVersion: "0.1.0",
    generatedAt,
    items,
    summary: {
      totalItems: items.length,
      clear: items.filter((item) => item.status === "clear").length,
      warning: items.filter((item) => item.status === "warning").length,
      blocked: items.filter((item) => item.status === "blocked").length,
      conflicts: items.reduce((total, item) => total + item.conflicts.length, 0),
      recompileRequired: items.filter((item) => item.conflicts.some((conflict) => conflict.requiredResolution.recompileRequired)).length,
      dryRunOnly: true,
      diagnosticsOnly: true,
      liveSubmitAllowed: false,
    },
    hardLocks: {
      dryRunOnly: true,
      diagnosticsOnly: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      agentPromiseCannotResolveConflict: true,
      requiresStructuredPlanUpdate: true,
      recompileRequiredAfterConflict: true,
      noPromptBypass: true,
    },
    dryRunOnly: true,
    diagnosticsOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      "Phase 8.10 Prompt Conflict Checker blocks structured fact conflicts before generation.",
      "Agent promises cannot resolve conflicts; Shot Spec, Shot Layout, or Shot Prompt Plan must be updated and recompiled.",
      "The checker is diagnostics-only and never submits provider work.",
    ],
  };
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

function formalPathForCandidate(candidatePath) {
  const normalized = normalizePathValue(candidatePath);
  const parts = normalized.split("/");
  const fileName = parts.pop() || "formal-output";
  const directory = parts.join("/");
  return `${directory ? `${directory}/` : ""}formal/${fileName}`;
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
    const candidatePath = taskPlan.expectedOutputPath;
    const formalPath = formalPathForCandidate(candidatePath);
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
      candidatePath,
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

const healthCheckerMatchedManifestStatuses = new Set(["actual_output_present", "complete", "matched"]);
const healthCheckerSuccessStatuses = new Set(["success", "succeeded", "completed"]);

function snapshotMetadataMap(snapshot = []) {
  if (Array.isArray(snapshot)) {
    return new Map(snapshot.map((entry) => {
      if (typeof entry === "string") return [normalizePathValue(entry), {}];
      const { path: entryPath, ...metadata } = entry;
      return [normalizePathValue(entryPath), metadata];
    }));
  }
  return new Map(Object.entries(snapshot).map(([entryPath, metadata]) => [normalizePathValue(entryPath), metadata === true ? {} : metadata]));
}

function checkerManifestForTaskPlan(taskPlan, reports = []) {
  return reports.find((report) => report.taskId === taskPlan.taskPlanId || report.taskId === taskPlan.jobId);
}

function checkerHealthForTaskPlan(taskPlan, reports = []) {
  return reports.find((report) => report.taskPlanId === taskPlan.taskPlanId || report.jobId === taskPlan.jobId);
}

function checkerScopedEvents(taskPlan, watcherEvents = []) {
  return watcherEvents.filter((event) => event.taskId === taskPlan.taskPlanId || event.jobId === taskPlan.jobId);
}

function healthCheckerFact({ factId, label, status, required, sourceRefs = [], notes = [] }) {
  return {
    factId,
    label,
    status,
    required,
    sourceRefs: uniqueSorted(sourceRefs),
    notes: uniqueSorted(notes),
  };
}

function healthCheckerHasDimensions(metadata) {
  return Boolean(metadata?.dimensions || (typeof metadata?.width === "number" && typeof metadata?.height === "number"));
}

function healthCheckerReadable(metadata, exists) {
  if (!exists) return false;
  if (metadata?.readable === false) return false;
  if (typeof metadata?.sizeBytes === "number") return metadata.sizeBytes > 0;
  return metadata !== undefined;
}

function generationHealthCheckerStatus(input) {
  if (input.taskBlocked || input.health?.healthStatus === "blocked" || input.health?.healthStatus === "failed") return "blocked";
  if (input.postprocessRecoverable) return "postprocess_recoverable";
  if (input.workerExitWithoutOutput) return "worker_exit_without_expected_output";
  if (!input.outputExists) return "waiting";
  if (!input.manifestMatched || !input.hashVerified || !input.dimensionsVerified || !input.readabilityVerified || !input.exitArtifactConsistent) {
    return "artifact_state_mismatch";
  }
  if (!input.qaCovered) return "qa_missing";
  return "verified_success";
}

function generationHealthCheckerNextAction(status) {
  if (status === "verified_success") return "All structured health facts agree; manual promotion gates may inspect this candidate.";
  if (status === "qa_missing") return "Attach explicit QA coverage for the expected output before promotion.";
  if (status === "postprocess_recoverable") return "Recover the temp/candidate artifact through mechanical postprocess, then rerun manifest and QA checks.";
  if (status === "worker_exit_without_expected_output") return "Treat worker completion as untrusted and rerun or repair until expected output exists.";
  if (status === "artifact_state_mismatch") return "Refresh manifest metadata/hash/dimensions/readability facts and resolve mismatched artifact state.";
  if (status === "blocked") return "Resolve upstream generation blockers before health can pass.";
  return "Wait for expected output and manifest facts.";
}

function buildGenerationHealthCheckerState({ generatedAt, imageTaskPlans, generationHealthReports, manifestMatches, watcherEvents, taskRuns = [], jobs = [], fileSnapshot = [] }) {
  const metadataByPath = snapshotMetadataMap(fileSnapshot);
  const items = imageTaskPlans.map((taskPlan) => {
    const expectedPath = normalizePathValue(taskPlan.expectedOutputPath);
    const metadata = metadataByPath.get(expectedPath);
    const health = checkerHealthForTaskPlan(taskPlan, generationHealthReports);
    const manifest = checkerManifestForTaskPlan(taskPlan, manifestMatches);
    const scopedEvents = checkerScopedEvents(taskPlan, watcherEvents);
    const taskRun = taskRuns.find((run) => run.taskId === taskPlan.jobId || run.taskId === taskPlan.taskPlanId);
    const job = jobs.find((item) => item.id === taskPlan.jobId);
    const expectedOutputExists = Boolean(
      metadata ||
      health?.outputExists ||
      (manifest?.actualOutputsPresent || []).map(normalizePathValue).includes(expectedPath),
    );
    const manifestStatus = manifest?.status || health?.manifestStatus || "missing_expected_output";
    const manifestMatched = healthCheckerMatchedManifestStatuses.has(manifestStatus);
    const tempEvents = scopedEvents.filter((event) => ["temp_output_detected", "provider_ready_derivative_detected"].includes(event.eventType));
    const tempOutputExists = tempEvents.length > 0 || Boolean(manifest?.recoverableOutputs?.length);
    const postprocessRecoverable = manifestStatus === "postprocess_recoverable" || scopedEvents.some((event) => event.eventType === "postprocess_recoverable");
    const workerReportedSuccess = Boolean(
      healthCheckerSuccessStatuses.has(job?.status) ||
      healthCheckerSuccessStatuses.has(taskRun?.localStatus) ||
      healthCheckerSuccessStatuses.has(taskRun?.providerStatus),
    );
    const workerExitWithoutOutput = !expectedOutputExists && (
      workerReportedSuccess ||
      scopedEvents.some((event) => event.eventType === "worker_exit_without_expected_output")
    );
    const qaCovered = health?.qaStatus === "pass";
    const hashVerified = Boolean(metadata?.hash) || manifestMatched;
    const dimensionsVerified = healthCheckerHasDimensions(metadata) || manifestMatched;
    const readabilityVerified = healthCheckerReadable(metadata, expectedOutputExists) || manifestMatched;
    const exitArtifactConsistent = !(workerReportedSuccess && !expectedOutputExists);
    const artifactStatusConsistent = expectedOutputExists === manifestMatched || postprocessRecoverable || manifestStatus === "missing_expected_output";
    const status = generationHealthCheckerStatus({
      taskBlocked: taskPlan.status === "blocked" || taskPlan.blockers.length > 0,
      health,
      outputExists: expectedOutputExists,
      manifestMatched,
      qaCovered,
      hashVerified,
      dimensionsVerified,
      readabilityVerified,
      postprocessRecoverable,
      workerExitWithoutOutput,
      exitArtifactConsistent,
    });
    const facts = [
      healthCheckerFact({
        factId: "expected_output",
        label: "Expected output exists",
        status: expectedOutputExists ? "pass" : "missing",
        required: true,
        sourceRefs: [taskPlan.expectedOutputPath, health?.reportId || ""],
      }),
      healthCheckerFact({
        factId: "manifest_match",
        label: "Manifest/hash/dimensions/readability match",
        status: manifestMatched ? "pass" : postprocessRecoverable ? "recoverable" : "mismatch",
        required: true,
        sourceRefs: [manifest?.taskId || "", health?.reportId || ""],
        notes: [
          `manifestStatus:${manifestStatus}`,
          hashVerified ? "hash:verified_or_manifest_matched" : "hash:missing",
          dimensionsVerified ? "dimensions:verified_or_manifest_matched" : "dimensions:missing",
          readabilityVerified ? "readability:verified_or_manifest_matched" : "readability:missing",
        ],
      }),
      healthCheckerFact({
        factId: "qa_coverage",
        label: "QA coverage for output",
        status: qaCovered ? "pass" : health?.qaStatus === "pending" ? "pending" : "missing",
        required: true,
        sourceRefs: [health?.reportId || "", ...scopedEvents.filter((event) => event.eventType === "qa_report_detected").map((event) => event.id)],
      }),
      healthCheckerFact({
        factId: "exit_artifact_consistency",
        label: "Worker exit/artifact status consistency",
        status: exitArtifactConsistent && artifactStatusConsistent ? "pass" : "mismatch",
        required: true,
        sourceRefs: [job?.id || "", taskRun?.taskId || "", ...scopedEvents.map((event) => event.id)],
        notes: [workerReportedSuccess ? "worker_reported_success:true" : "worker_reported_success:false"],
      }),
      healthCheckerFact({
        factId: "temp_recovery",
        label: "Temp candidate recovery state",
        status: postprocessRecoverable ? "recoverable" : tempOutputExists ? "pending" : "not_available",
        required: false,
        sourceRefs: [...tempEvents.map((event) => event.id), ...(manifest?.recoverableOutputs || [])],
      }),
    ];

    return {
      checkerItemId: `generation_health_checker_${taskPlan.taskPlanId}`,
      taskPlanId: taskPlan.taskPlanId,
      jobId: taskPlan.jobId,
      shotId: taskPlan.shotId,
      expectedOutputPath: taskPlan.expectedOutputPath,
      status,
      expectedOutputExists,
      tempOutputExists,
      postprocessRecoverable,
      manifestStatus,
      manifestMatched,
      hashVerified,
      dimensionsVerified,
      readabilityVerified,
      qaCovered,
      workerReportedSuccess,
      exitArtifactConsistent,
      artifactStatusConsistent,
      facts,
      blockers: uniqueSorted([
        ...(taskPlan.blockers || []),
        ...(status === "worker_exit_without_expected_output" ? ["Worker reported completion or exited, but expected output is missing."] : []),
        ...(status === "artifact_state_mismatch" ? ["Expected output, manifest metadata, readability, or exit status facts disagree."] : []),
        ...(status === "blocked" ? ["Generation task is blocked by upstream facts."] : []),
      ]),
      warnings: uniqueSorted([
        ...(taskPlan.warnings || []),
        ...(status === "qa_missing" ? ["QA coverage is missing; worker self-report cannot complete generation."] : []),
        ...(postprocessRecoverable ? ["Temp output exists but expected output postprocess failed; status is recoverable, not success."] : []),
      ]),
      nextAction: generationHealthCheckerNextAction(status),
    };
  });

  return {
    schemaVersion: "0.1.0",
    generatedAt,
    items,
    summary: {
      totalItems: items.length,
      verifiedSuccess: items.filter((item) => item.status === "verified_success").length,
      qaMissing: items.filter((item) => item.status === "qa_missing").length,
      waiting: items.filter((item) => item.status === "waiting").length,
      postprocessRecoverable: items.filter((item) => item.status === "postprocess_recoverable").length,
      workerExitWithoutExpectedOutput: items.filter((item) => item.status === "worker_exit_without_expected_output").length,
      artifactStateMismatch: items.filter((item) => item.status === "artifact_state_mismatch").length,
      blocked: items.filter((item) => item.status === "blocked").length,
      dryRunOnly: true,
      diagnosticsOnly: true,
      liveSubmitAllowed: false,
    },
    hardLocks: {
      dryRunOnly: true,
      diagnosticsOnly: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      workerSelfReportCannotComplete: true,
      expectedOutputRequired: true,
      manifestMetadataRequired: true,
      qaCoverageRequired: true,
      noFileMutation: true,
    },
    dryRunOnly: true,
    diagnosticsOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    noFileMutation: true,
    notes: [
      "Phase 8.9 Generation Health Checker is a structured fact layer; worker self-report never marks success.",
      "Success requires expected output, manifest metadata/hash/dimensions/readability, QA coverage, and exit/artifact consistency.",
      "Temp output plus postprocess failure is surfaced as postprocess_recoverable.",
    ],
  };
}

const generationHarnessForbiddenActions = [
  "live_submit",
  "provider_unlock",
  "prompt_bypass",
  "candidate_auto_promote",
  "semantic_postprocess_repair",
  "text_to_video_fallback",
];

const generationHarnessPostprocessPolicy = {
  allowedLocalOperations: ["format_convert", "manifest_match", "metadata_probe", "resize", "thumbnail_preview"],
  semanticRepairAllowed: false,
  openCvSemanticRepairAllowed: false,
  localPostprocessCanChangeMeaning: false,
  localPostprocessCanPromoteFormal: false,
  notes: [
    "Local postprocess is limited to mechanical size, format, preview, metadata, and manifest checks.",
    "Semantic repair must be expressed as a new prompt/QA cycle, not OpenCV or local image manipulation.",
  ],
};

function harnessStageStatus(blockers, warnings, waiting = false) {
  if (blockers.length) return "blocked";
  if (waiting) return "waiting";
  if (warnings.length) return "warning";
  return "pass";
}

function makeHarnessStage({ stageId, label, sourceRefs = [], blockers = [], warnings = [], waiting = false }) {
  const uniqueBlockers = uniqueSorted(blockers);
  const uniqueWarnings = uniqueSorted(warnings);
  return {
    stageId,
    label,
    status: harnessStageStatus(uniqueBlockers, uniqueWarnings, waiting),
    sourceRefs: uniqueSorted(sourceRefs),
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
  };
}

function formalPathForHarnessCandidate(candidatePath) {
  const normalized = normalizePathValue(candidatePath);
  const parts = normalized.split("/");
  const fileName = parts.pop() || "formal-output";
  const directory = parts.join("/");
  return `${directory ? `${directory}/` : ""}formal/${fileName}`;
}

function harnessRequestPreview(taskPlan, request) {
  return {
    requestId: request?.requestId,
    adapterId: request?.adapterId,
    operation: request?.operation,
    outputPath: request?.payload?.outputPath || taskPlan.expectedOutputPath,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    liveSubmitForbidden: true,
    forbiddenFallbacks: uniqueSorted([
      ...(request?.forbiddenFallbacks || []),
      "provider_or_mode_fallback",
      "text_to_video_fallback",
    ]),
  };
}

function harnessCandidateStatus(taskPlan, health, promotion) {
  if (promotion?.canPromoteToFormal) return "formal_ready";
  if (taskPlan.status === "blocked" || health?.healthStatus === "blocked" || health?.healthStatus === "failed") return "blocked";
  if (!health?.outputExists) return "missing";
  if (promotion?.promotionStatus === "qa_pending" || health.qaStatus === "pending" || health.qaStatus === "missing") return "qa_pending";
  return "candidate";
}

function harnessNextAction(status, health, promotion) {
  if (status === "formal_ready") return "Explicit QA, health, and promotion gates pass; formal promotion can be requested manually.";
  if (status === "qa_pending") return "Wait for explicit QA pass before formal promotion.";
  if (status === "missing") return "Wait for expected candidate output and manifest match.";
  if (status === "blocked") return "Resolve harness blockers before any provider request or promotion.";
  return promotion?.blockers?.[0] || health?.nextAction || "Candidate exists; run QA gate next.";
}

function buildHarnessStages({ taskPlan, promptPlan, conflictReport, readinessReport, adapterRequest, healthReport, promotionReport, watcherEvents }) {
  const readinessBlockers = readinessReport?.blockers || [];
  const readinessWarnings = readinessReport?.warnings || [];
  const conflictBlockers = conflictReport?.conflicts?.filter((conflict) => conflict.severity === "blocker").map((conflict) => conflict.detail) || [];
  const conflictWarnings = conflictReport?.conflicts?.filter((conflict) => conflict.severity !== "blocker").map((conflict) => conflict.detail) || [];
  const hasWatcherCandidate = watcherEvents.some((event) =>
    ["temp_output_detected", "expected_output_detected", "provider_ready_derivative_detected"].includes(event.eventType),
  );

  return [
    makeHarnessStage({
      stageId: "shot_spec",
      label: "Shot Spec",
      sourceRefs: [taskPlan.sourceShotSpecHash, promptPlan?.sourceShotSpecHash || ""],
      blockers: promptPlan ? [] : ["Shot prompt plan is missing, so the source shot spec cannot be audited."],
    }),
    makeHarnessStage({
      stageId: "visual_memory",
      label: "Visual Memory",
      sourceRefs: readinessReport ? [readinessReport.reportId, ...(readinessReport.safeReferenceIds || [])] : [],
      blockers: readinessReport ? readinessBlockers : ["Asset readiness report is missing."],
      warnings: readinessReport ? readinessWarnings : [],
    }),
    makeHarnessStage({
      stageId: "spatial_memory",
      label: "Spatial Memory",
      sourceRefs: readinessReport ? [readinessReport.reportId, ...(readinessReport.lockedReferenceIds || [])] : [],
      blockers: readinessReport?.status === "blocked" ? readinessBlockers : [],
      warnings: readinessReport ? readinessWarnings : ["No shot-level spatial readiness evidence was available."],
    }),
    makeHarnessStage({
      stageId: "shot_layout",
      label: "Shot Layout",
      sourceRefs: [taskPlan.taskEnvelopeSummary?.envelopeId || "", taskPlan.sourceShotSpecHash],
      blockers: taskPlan.taskEnvelopeSummary ? [] : ["Task envelope summary is missing."],
      warnings: taskPlan.taskEnvelopeSummary?.preflightStatus === "warning" ? ["Task envelope preflight has warnings."] : [],
    }),
    makeHarnessStage({
      stageId: "style_capsule",
      label: "Style Capsule",
      sourceRefs: promptPlan?.styleDirectives || [],
      blockers: promptPlan ? [] : ["Prompt plan is missing style capsule directives."],
      warnings: promptPlan && promptPlan.styleDirectives.length === 0 ? ["No style capsule directives were routed into the prompt plan."] : [],
    }),
    makeHarnessStage({
      stageId: "shot_prompt_plan",
      label: "Shot Prompt Plan",
      sourceRefs: [taskPlan.promptPlanId, promptPlan?.promptPlanHash || "", conflictReport?.reportId || ""],
      blockers: uniqueSorted([...(promptPlan?.blockers || []), ...conflictBlockers]),
      warnings: conflictWarnings,
    }),
    makeHarnessStage({
      stageId: "provider_capability_check",
      label: "Provider Capability Check",
      sourceRefs: [taskPlan.providerId, taskPlan.providerSlot, taskPlan.requiredMode],
      blockers: [
        ...(taskPlan.blockers || []),
        ...(isImageSlot({ slot: taskPlan.providerSlot }) ? [] : ["Only Image2 image slots can reach the Phase 8.4 harness request preview."]),
      ],
      warnings: taskPlan.warnings || [],
    }),
    makeHarnessStage({
      stageId: "provider_request_preview",
      label: "Provider Request Preview",
      sourceRefs: [adapterRequest?.requestId || ""],
      blockers: adapterRequest
        ? []
        : ["ready_for_dry_run", "ready_for_manual_submit"].includes(taskPlan.status)
          ? ["Ready task plan is missing an Image2 dry-run adapter request preview."]
          : [],
      warnings: adapterRequest ? [] : ["No provider request preview is emitted while upstream gates are draft or blocked."],
      waiting: !adapterRequest && taskPlan.status !== "blocked",
    }),
    makeHarnessStage({
      stageId: "candidate_output",
      label: "Candidate Output",
      sourceRefs: [
        taskPlan.expectedOutputPath,
        healthReport?.reportId || "",
        ...watcherEvents.map((event) => event.id),
      ],
      blockers: healthReport?.healthStatus === "blocked" || healthReport?.healthStatus === "failed" ? healthReport.blockers : [],
      warnings: [
        ...(healthReport?.warnings || []),
        ...(hasWatcherCandidate ? [] : ["No watcher event has confirmed a candidate output yet."]),
      ],
      waiting: !healthReport?.outputExists,
    }),
    makeHarnessStage({
      stageId: "qa_gate",
      label: "QA Gate",
      sourceRefs: [promotionReport?.reportId || "", healthReport?.reportId || ""],
      blockers: promotionReport?.canPromoteToFormal ? [] : promotionReport?.blockers || ["QA promotion report is missing."],
      warnings: promotionReport?.warnings || [],
      waiting: healthReport?.qaStatus === "pending" || healthReport?.qaStatus === "missing",
    }),
  ];
}

function buildGenerationHarnessState({
  generatedAt,
  imageTaskPlans,
  promptPlans,
  promptConflictReports,
  assetReadinessReports,
  image2AdapterRequests,
  watcherEvents,
  generationHealthReports,
  qaPromotionReports,
}) {
  const promptById = new Map(promptPlans.map((plan) => [plan.promptPlanId, plan]));
  const conflictByPlanId = new Map(promptConflictReports.map((report) => [report.promptPlanId, report]));
  const readinessByShot = new Map(assetReadinessReports.map((report) => [report.shotId, report]));
  const requestByTaskPlan = new Map(image2AdapterRequests.map((request) => [request.taskPlanId, request]));
  const healthByTaskPlan = new Map(generationHealthReports.map((report) => [report.taskPlanId, report]));
  const promotionByTaskPlan = new Map(qaPromotionReports.map((report) => [report.taskPlanId, report]));

  const jobs = imageTaskPlans.map((taskPlan) => {
    const promptPlan = promptById.get(taskPlan.promptPlanId);
    const healthReport = healthByTaskPlan.get(taskPlan.taskPlanId);
    const promotionReport = promotionByTaskPlan.get(taskPlan.taskPlanId);
    const scopedWatcherEvents = watcherEvents.filter((event) => event.taskId === taskPlan.taskPlanId || event.jobId === taskPlan.jobId);
    const adapterRequest = requestByTaskPlan.get(taskPlan.taskPlanId);
    const stages = buildHarnessStages({
      taskPlan,
      promptPlan,
      conflictReport: conflictByPlanId.get(taskPlan.promptPlanId),
      readinessReport: readinessByShot.get(taskPlan.shotId),
      adapterRequest,
      healthReport,
      promotionReport,
      watcherEvents: scopedWatcherEvents,
    });
    const status = harnessCandidateStatus(taskPlan, healthReport, promotionReport);

    return {
      harnessJobId: `generation_harness_${taskPlan.taskPlanId}`,
      jobId: taskPlan.jobId,
      shotId: taskPlan.shotId,
      taskPlanId: taskPlan.taskPlanId,
      promptPlanId: taskPlan.promptPlanId,
      providerId: taskPlan.providerId,
      providerSlot: taskPlan.providerSlot,
      requiredMode: taskPlan.requiredMode,
      dryRunOnly: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      forbiddenActions: generationHarnessForbiddenActions,
      stages,
      providerRequestPreview: harnessRequestPreview(taskPlan, adapterRequest),
      candidateOutput: {
        status,
        candidatePath: promotionReport?.candidatePath || taskPlan.expectedOutputPath,
        formalPath: promotionReport?.formalPath || formalPathForHarnessCandidate(taskPlan.expectedOutputPath),
        expectedOutputPath: taskPlan.expectedOutputPath,
        outputExists: Boolean(healthReport?.outputExists),
        manifestStatus: healthReport?.manifestStatus || "missing_expected_output",
        qaStatus: healthReport?.qaStatus || "unknown",
        promotionStatus: promotionReport?.promotionStatus,
        canPromoteToFormal: Boolean(promotionReport?.canPromoteToFormal),
        formalPromotionRequiresExplicitQa: true,
        autoPromoteToFormal: false,
      },
      postprocessPolicy: generationHarnessPostprocessPolicy,
      blockers: uniqueSorted(stages.flatMap((stage) => stage.blockers || [])),
      warnings: uniqueSorted(stages.flatMap((stage) => stage.warnings || [])),
      nextAction: harnessNextAction(status, healthReport, promotionReport),
    };
  });

  return {
    schemaVersion: "0.1.0",
    generatedAt,
    jobs,
    summary: {
      total: jobs.length,
      blocked: jobs.filter((job) => job.candidateOutput.status === "blocked").length,
      waiting: jobs.filter((job) => job.candidateOutput.status === "missing").length,
      qaPending: jobs.filter((job) => job.candidateOutput.status === "qa_pending").length,
      formalReady: jobs.filter((job) => job.candidateOutput.status === "formal_ready").length,
      canPromoteToFormal: jobs.filter((job) => job.candidateOutput.canPromoteToFormal).length,
      liveSubmitAllowed: false,
    },
    forbiddenActions: generationHarnessForbiddenActions,
    postprocessPolicy: generationHarnessPostprocessPolicy,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      "Phase 8.4 Generation Harness is a hard dry-run audit chain.",
      "Provider request previews are diagnostics only and cannot submit Image2, Seedance, Jimeng, or text-to-video jobs.",
      "Candidate output never auto-promotes to formal; QA and promotion gates must pass explicitly.",
    ],
  };
}

const filesystemWatcherMonitoredKinds = [
  "codex_temp_generated_images",
  "project_outputs",
  "reports",
  "videos",
  "audio",
];

const filesystemWatcherHardLocks = {
  watcherCannotPromoteFormal: true,
  workerSelfReportCannotComplete: true,
  tempOutputDraftOnly: true,
  semanticPostprocessForbidden: true,
  liveSubmitAllowed: false,
  providerSubmissionForbidden: true,
};

function snapshotPathCount(snapshot) {
  return Array.isArray(snapshot) ? snapshot.length : Object.keys(snapshot || {}).length;
}

function watcherArtifactClass(eventType) {
  if (eventType === "temp_output_detected") return "temp_candidate";
  if (eventType === "expected_output_detected") return "expected_output";
  if (eventType === "provider_ready_derivative_detected") return "provider_ready_derivative";
  if (eventType === "qa_report_detected") return "qa_report";
  if (eventType === "manifest_mismatch_detected") return "manifest_mismatch";
  if (eventType === "formal_output_promoted") return "formal_output";
  if (eventType === "worker_exit_without_expected_output") return "worker_exit_without_expected_output";
  if (eventType === "postprocess_recoverable") return "postprocess_recoverable";
  if (eventType === "stall_timeout_reached") return "stall_timeout";
  if (eventType === "blocked") return "blocked";
  return "unknown";
}

function watcherMonitoredKind(pathValue, artifactClass) {
  const normalized = normalizePathValue(pathValue || "").toLowerCase();
  if (artifactClass === "temp_candidate" || /(^|\/)(tmp|temp|cache|candidates?|drafts?)(\/|$)/.test(normalized)) {
    return "codex_temp_generated_images";
  }
  if (artifactClass === "qa_report" || artifactClass === "manifest_mismatch" || /(^|\/)reports?(\/|$)/.test(normalized)) return "reports";
  if (/\.(mp4|mov|m4v|webm)$/i.test(normalized) || /(^|\/)videos?(\/|$)/.test(normalized)) return "videos";
  if (/\.(wav|mp3|m4a|aac|flac|ogg)$/i.test(normalized) || /(^|\/)audio(\/|$)/.test(normalized)) return "audio";
  return "project_outputs";
}

function watcherRequiresManifestMatch(artifactClass) {
  return !["qa_report", "blocked", "stall_timeout"].includes(artifactClass);
}

function watcherRequiresQaPass(artifactClass) {
  return !["qa_report", "manifest_mismatch", "blocked", "stall_timeout", "worker_exit_without_expected_output"].includes(artifactClass);
}

function watcherDraftOnly(artifactClass, canPromoteFormal) {
  if (["temp_candidate", "provider_ready_derivative", "postprocess_recoverable"].includes(artifactClass)) return true;
  if (artifactClass === "formal_output") return false;
  return !canPromoteFormal;
}

function watcherCanBecomeFutureReference(artifactClass, canPromoteFormal) {
  if (["temp_candidate", "provider_ready_derivative", "postprocess_recoverable"].includes(artifactClass)) return false;
  return artifactClass === "formal_output" && canPromoteFormal;
}

function buildFilesystemWatcherMonitoredRoots(projectRoot) {
  const root = projectRoot || "<project-root>";
  return [
    {
      rootId: "codex-temp-generated-images",
      kind: "codex_temp_generated_images",
      label: "Codex Temp Generated Images",
      pathPolicy: "derived_static_only",
      pathHints: ["<codex-temp>/generated-images", `${root}/tmp`, `${root}/cache`, `${root}/candidates`],
      daemonStarted: false,
      notes: ["Derived from fileSnapshot paths and watcherEvents only; Phase 8.5 does not start fs.watch."],
    },
    {
      rootId: "project-outputs",
      kind: "project_outputs",
      label: "Project Outputs",
      pathPolicy: "derived_static_only",
      pathHints: [`${root}/outputs`, `${root}/02_keyframes`, `${root}/generated`],
      daemonStarted: false,
      notes: ["Expected outputs remain candidate artifacts until manifest and QA promotion gates pass."],
    },
    {
      rootId: "reports",
      kind: "reports",
      label: "Reports",
      pathPolicy: "derived_static_only",
      pathHints: [`${root}/reports`, `${root}/qa`],
      daemonStarted: false,
      notes: ["QA and manifest reports are evidence; they cannot move or promote files."],
    },
    {
      rootId: "videos",
      kind: "videos",
      label: "Videos",
      pathPolicy: "derived_static_only",
      pathHints: [`${root}/videos`, `${root}/renders`],
      daemonStarted: false,
      notes: ["Video paths are monitored as static facts while video providers remain parked."],
    },
    {
      rootId: "audio",
      kind: "audio",
      label: "Audio",
      pathPolicy: "derived_static_only",
      pathHints: [`${root}/audio`, `${root}/voice`],
      daemonStarted: false,
      notes: ["Audio paths are planning facts only; no audio provider or local daemon is started."],
    },
  ];
}

function buildFilesystemWatcherHarnessState({
  generatedAt,
  projectRoot,
  fileSnapshot,
  manifestMatches,
  imageTaskPlans,
  image2AdapterRequests,
  watcherEvents,
  generationHealthReports,
  qaPromotionReports,
  generationHarness,
}) {
  const taskPlanById = new Map(imageTaskPlans.map((taskPlan) => [taskPlan.taskPlanId, taskPlan]));
  const taskPlanByJob = new Map(imageTaskPlans.map((taskPlan) => [taskPlan.jobId, taskPlan]));
  const healthByTaskPlan = new Map(generationHealthReports.map((report) => [report.taskPlanId, report]));
  const promotionByTaskPlan = new Map(qaPromotionReports.map((report) => [report.taskPlanId, report]));
  const harnessByTaskPlan = new Map((generationHarness?.jobs || []).map((job) => [job.taskPlanId, job]));
  const requestTaskPlanIds = new Set(image2AdapterRequests.map((request) => request.taskPlanId));

  const streams = watcherEvents.map((event) => {
    const taskPlan = taskPlanById.get(event.taskId) || (event.jobId ? taskPlanByJob.get(event.jobId) : undefined);
    const taskPlanId = taskPlan?.taskPlanId || event.taskId;
    const artifactClass = watcherArtifactClass(event.eventType);
    const promotion = promotionByTaskPlan.get(taskPlanId);
    const health = healthByTaskPlan.get(taskPlanId);
    const manifestReport = manifestReportForTaskPlan(taskPlan, manifestMatches || []);
    const harnessJob = harnessByTaskPlan.get(taskPlanId);
    const canPromoteFormal =
      !["temp_candidate", "provider_ready_derivative", "postprocess_recoverable"].includes(artifactClass) &&
      Boolean(promotion?.canPromoteToFormal);
    const expectedOutputPath = event.expectedOutputPath || taskPlan?.expectedOutputPath;

    return {
      streamId: `filesystem_watcher_stream_${event.id}`,
      sourceEventId: event.id,
      eventType: event.eventType,
      artifactPath: event.artifactPath,
      expectedOutputPath,
      taskPlanId,
      jobId: event.jobId || taskPlan?.jobId,
      shotId: event.shotId || taskPlan?.shotId,
      artifactClass,
      monitoredKind: watcherMonitoredKind(event.artifactPath || expectedOutputPath, artifactClass),
      draftOnly: watcherDraftOnly(artifactClass, canPromoteFormal),
      canPromoteFormal,
      canBecomeFutureReference: watcherCanBecomeFutureReference(artifactClass, canPromoteFormal),
      requiresManifestMatch: watcherRequiresManifestMatch(artifactClass),
      requiresQaPass: watcherRequiresQaPass(artifactClass),
      manifestMatchStatus: manifestReport?.status,
      generationHealthReportId: health?.reportId,
      qaPromotionReportId: promotion?.reportId,
      generationHarnessJobId: harnessJob?.harnessJobId,
      harnessLinkStatus: harnessJob ? "linked" : "missing_harness_link",
      missingHarnessLinkReason: harnessJob
        ? undefined
        : `No generationHarness job matched taskPlanId ${taskPlanId}${event.jobId ? ` or jobId ${event.jobId}` : ""}.`,
      notes: [
        ...(event.notes || []),
        "Phase 8.5 watcher harness is derived/static and does not start a filesystem daemon.",
        ...(artifactClass === "worker_exit_without_expected_output" || requestTaskPlanIds.has(taskPlanId)
          ? ["Worker/provider self-report cannot complete or promote a task."]
          : []),
      ],
    };
  }).sort((left, right) => left.streamId.localeCompare(right.streamId));

  return {
    schemaVersion: "0.1.0",
    generatedAt,
    monitoredKinds: filesystemWatcherMonitoredKinds,
    monitoredRoots: buildFilesystemWatcherMonitoredRoots(projectRoot),
    streams,
    summary: {
      totalStreams: streams.length,
      draftOnly: streams.filter((stream) => stream.draftOnly).length,
      promotableFormal: streams.filter((stream) => stream.canPromoteFormal).length,
      missingHarnessLinks: streams.filter((stream) => stream.harnessLinkStatus === "missing_harness_link").length,
      tempCandidates: streams.filter((stream) => stream.artifactClass === "temp_candidate").length,
      expectedOutputs: streams.filter((stream) => stream.artifactClass === "expected_output").length,
      qaReports: streams.filter((stream) => stream.artifactClass === "qa_report").length,
      manifestMismatches: streams.filter((stream) => stream.artifactClass === "manifest_mismatch").length,
      daemonStarted: false,
      liveSubmitAllowed: false,
    },
    hardLocks: filesystemWatcherHardLocks,
    derivedOnly: true,
    fsWatchDaemonEnabled: false,
    daemonStarted: false,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      `Derived from ${snapshotPathCount(fileSnapshot)} file snapshot entries and ${watcherEvents.length} watcher events.`,
      "No fs.watch daemon, file move/copy/delete, provider submit, or formal promotion is performed by this harness.",
      "Formal promotion remains owned by qaPromotionReports.canPromoteToFormal and explicit promotion gates.",
    ],
  };
}

const checkpointResumeHarnessHardLocks = {
  dryRunOnly: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
  noFileMutation: true,
  noAutoSkipWithoutQa: true,
  workerSelfReportCannotComplete: true,
  tempCandidateCannotResumeAsFormal: true,
};

function checkpointSnapshotPaths(snapshot) {
  if (Array.isArray(snapshot)) {
    return new Set(snapshot.map((entry) => normalizePathValue(typeof entry === "string" ? entry : entry.path)));
  }
  return new Set(Object.keys(snapshot || {}).map(normalizePathValue));
}

function checkpointHasManifestMatch(status) {
  return ["actual_output_present", "complete", "matched"].includes(status);
}

function checkpointSourceHashMismatch(taskPlan) {
  return Boolean(
    taskPlan.taskEnvelopeSummary &&
      ((taskPlan.taskEnvelopeSummary.promptPlanHash &&
        taskPlan.taskEnvelopeSummary.promptPlanHash !== taskPlan.sourcePromptPlanHash) ||
        (taskPlan.taskEnvelopeSummary.sourceShotSpecHash &&
          taskPlan.taskEnvelopeSummary.sourceShotSpecHash !== taskPlan.sourceShotSpecHash)),
  );
}

function checkpointResumeStatus({ skipAllowed, manualReviewRequired, rerunAllowed, blocked }) {
  if (skipAllowed) return "skip_ready";
  if (blocked) return "blocked";
  if (manualReviewRequired) return "manual_review_required";
  if (rerunAllowed) return "rerun_required";
  return "waiting";
}

function checkpointResumeDecision({ skipAllowed, staleSource, expectedOutputExists, hasTempOrDerivative, canPromoteToFormal, blocked }) {
  if (skipAllowed) return "skip_existing_formal";
  if (staleSource) return "rerun_stale_source";
  if (!expectedOutputExists) return "rerun_missing_expected_output";
  if (hasTempOrDerivative) return "manual_review_temp_or_derivative";
  if (canPromoteToFormal) return "manual_promote_or_review_candidate";
  if (blocked) return "blocked_by_generation_gate";
  return "wait_for_qa_or_promotion";
}

function buildCheckpointResumeHarnessState({
  generatedAt,
  fileSnapshot,
  manifestMatches,
  imageTaskPlans,
  generationHealthReports,
  qaPromotionReports,
  generationHarness,
  filesystemWatcherHarness,
}) {
  const paths = checkpointSnapshotPaths(fileSnapshot || []);
  const healthByTaskPlan = new Map(generationHealthReports.map((report) => [report.taskPlanId, report]));
  const promotionByTaskPlan = new Map(qaPromotionReports.map((report) => [report.taskPlanId, report]));
  const generationJobByTaskPlan = new Map((generationHarness?.jobs || []).map((job) => [job.taskPlanId, job]));
  const streamsByTaskPlan = new Map();

  for (const stream of filesystemWatcherHarness?.streams || []) {
    const scoped = streamsByTaskPlan.get(stream.taskPlanId) || [];
    scoped.push(stream);
    streamsByTaskPlan.set(stream.taskPlanId, scoped);
  }

  const items = imageTaskPlans.map((taskPlan) => {
    const health = healthByTaskPlan.get(taskPlan.taskPlanId);
    const promotion = promotionByTaskPlan.get(taskPlan.taskPlanId);
    const manifestReport = manifestReportForTaskPlan(taskPlan, manifestMatches || []);
    const generationJob = generationJobByTaskPlan.get(taskPlan.taskPlanId);
    const watcherStreams = streamsByTaskPlan.get(taskPlan.taskPlanId) || [];
    const watcherStreamIds = uniqueSorted(watcherStreams.map((stream) => stream.streamId));
    const candidatePath = promotion?.candidatePath || generationJob?.candidateOutput?.candidatePath || taskPlan.expectedOutputPath;
    const formalPath = promotion?.formalPath || generationJob?.candidateOutput?.formalPath;
    const expectedOutputPath = taskPlan.expectedOutputPath;
    const expectedOutputExists = Boolean(health?.outputExists) || paths.has(normalizePathValue(expectedOutputPath));
    const candidatePathExists = Boolean(candidatePath && paths.has(normalizePathValue(candidatePath)));
    const formalPathExists = Boolean(formalPath && paths.has(normalizePathValue(formalPath)));
    const manifestStatus = health?.manifestStatus || manifestReport?.status || "missing_expected_output";
    const manifestMatched = checkpointHasManifestMatch(manifestStatus);
    const qaStatus = health?.qaStatus || "unknown";
    const staleSource = Boolean(health?.stalePrompt) || checkpointSourceHashMismatch(taskPlan);
    const hasTempOrDerivative = watcherStreams.some((stream) =>
      ["temp_candidate", "provider_ready_derivative", "postprocess_recoverable"].includes(stream.artifactClass),
    );
    const workerSelfReportOnly = watcherStreams.some((stream) => stream.artifactClass === "worker_exit_without_expected_output");
    const canPromoteToFormal = Boolean(promotion?.canPromoteToFormal);
    const blockedByGate = taskPlan.status === "blocked" || health?.healthStatus === "blocked" || health?.healthStatus === "failed";
    const formalGatePassed = canPromoteToFormal && manifestMatched && qaStatus === "pass" && !staleSource;
    const skipAllowed = formalGatePassed && formalPathExists && !hasTempOrDerivative;
    const missingExpectedOutput = !expectedOutputExists;
    const rerunAllowed = !skipAllowed && (missingExpectedOutput || staleSource || health?.healthStatus === "failed" || workerSelfReportOnly);
    const manualReviewRequired =
      !skipAllowed &&
      (hasTempOrDerivative ||
        (expectedOutputExists && !formalPathExists) ||
        (expectedOutputExists && (!manifestMatched || qaStatus !== "pass" || !canPromoteToFormal)));
    const blockingReasons = uniqueSorted([
      ...(taskPlan.status === "blocked" ? ["Image task plan is blocked."] : []),
      ...(missingExpectedOutput ? ["Expected output is missing; resume plan may only propose a dry-run rerun."] : []),
      ...(manifestMatched ? [] : [`Manifest status is ${manifestStatus}; skip is blocked.`]),
      ...(qaStatus === "pass" ? [] : [`QA status is ${qaStatus}; skip requires explicit QA pass.`]),
      ...(canPromoteToFormal ? [] : ["QA promotion gate has not set canPromoteToFormal=true."]),
      ...(staleSource ? ["Prompt or source hash mismatch blocks skip."] : []),
      ...(hasTempOrDerivative ? ["Temp/candidate/provider-ready derivatives require manual review or rerun; they cannot resume as formal."] : []),
      ...(workerSelfReportOnly ? ["Worker/provider self-report cannot complete a task."] : []),
      ...(formalGatePassed && !formalPathExists ? ["Formal path is not present in the file snapshot; automatic skip is blocked."] : []),
      ...(health?.blockers || []),
      ...(promotion?.blockers || []),
    ]);
    const resumeStatus = checkpointResumeStatus({
      skipAllowed,
      manualReviewRequired,
      rerunAllowed,
      blocked: blockedByGate && !rerunAllowed && !manualReviewRequired,
    });
    const resumeDecision = checkpointResumeDecision({
      skipAllowed,
      staleSource,
      expectedOutputExists,
      hasTempOrDerivative,
      canPromoteToFormal,
      blocked: blockedByGate,
    });

    return {
      resumeItemId: `checkpoint_resume_${taskPlan.taskPlanId}`,
      taskPlanId: taskPlan.taskPlanId,
      jobId: taskPlan.jobId,
      shotId: taskPlan.shotId,
      harnessJobId: generationJob?.harnessJobId,
      expectedOutputPath,
      candidatePath,
      formalPath,
      candidatePathExists,
      formalPathExists,
      expectedOutputExists,
      manifestStatus,
      healthStatus: health?.healthStatus || "missing",
      qaStatus,
      promotionStatus: promotion?.promotionStatus,
      canPromoteToFormal,
      watcherStreamIds,
      resumeStatus,
      resumeDecision,
      skipAllowed,
      rerunAllowed,
      manualReviewRequired,
      blockingReasons,
      notes: uniqueSorted([
        "Phase 8.6 Checkpoint Resume Harness emits a plan only; it does not skip, rerun, move, delete, copy, or submit.",
        ...(formalGatePassed
          ? ["Manifest, QA, and promotion gates pass; skip still requires an existing formal path."]
          : ["File existence, expected-output detection, and worker self-report are not completion gates."]),
      ]),
    };
  }).sort((left, right) => left.resumeItemId.localeCompare(right.resumeItemId));

  return {
    schemaVersion: "0.1.0",
    generatedAt,
    items,
    summary: {
      totalItems: items.length,
      skipAllowed: items.filter((item) => item.skipAllowed).length,
      rerunAllowed: items.filter((item) => item.rerunAllowed).length,
      manualReviewRequired: items.filter((item) => item.manualReviewRequired).length,
      blocked: items.filter((item) => item.resumeStatus === "blocked").length,
      missingExpectedOutput: items.filter((item) => !item.expectedOutputExists).length,
      linkedWatcherStreams: items.reduce((count, item) => count + item.watcherStreamIds.length, 0),
      linkedGenerationHarnessJobs: items.filter((item) => item.harnessJobId).length,
      dryRunOnly: true,
      liveSubmitAllowed: false,
      noFileMutation: true,
    },
    hardLocks: checkpointResumeHarnessHardLocks,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    noFileMutation: true,
    planOnly: true,
    notes: [
      `Derived from ${imageTaskPlans.length} image task plans, ${snapshotPathCount(fileSnapshot || [])} file snapshot entries, ${(generationHarness?.jobs || []).length} generation harness jobs, and ${(filesystemWatcherHarness?.streams || []).length} watcher streams.`,
      "Skip is allowed only for existing formal outputs that also pass manifest, explicit QA, and promotion gates.",
      "Missing expected outputs produce rerun-allowed dry-run plans only; no provider submission is performed.",
    ],
  };
}

const qaHarnessDimensionOrder = [
  "whole_film",
  "identity",
  "scene",
  "pair",
  "story",
  "prop",
  "style",
  "motion",
  "audio",
];

const qaHarnessSourceLayers = [
  "generationHealthReports",
  "qaPromotionReports",
  "manifestMatches",
  "assetReadinessReports",
  "promptPlans",
  "promptConflictReports",
  "generationHarness",
  "filesystemWatcherHarness",
  "checkpointResumeHarness",
  "videoPlanning",
  "audioPlanning",
  "storyFlow.shots",
];

const qaHarnessHardLocks = {
  dryRunOnly: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
  noFileMutation: true,
  noAutoPromotion: true,
  semanticRepairForbidden: true,
  workerSelfReportCannotPassQa: true,
  overallFirst: true,
};

function qaSeverityFor(status, blockers, warnings) {
  if (status === "FAIL" || blockers.length) return "blocker";
  if (status === "PARTIAL" || status === "UNKNOWN" || warnings.length) return "warning";
  return "info";
}

function qaMakeDimension({ dimensionId, status, blockers = [], warnings = [], sourceRefs = [], notes = [] }) {
  const uniqueBlockers = uniqueSorted(blockers);
  const uniqueWarnings = uniqueSorted(warnings);
  const resolvedStatus = uniqueBlockers.length ? "FAIL" : status;
  return {
    dimensionId,
    status: resolvedStatus,
    severity: qaSeverityFor(resolvedStatus, uniqueBlockers, uniqueWarnings),
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    sourceRefs: uniqueSorted(sourceRefs),
    notes: uniqueSorted(notes),
  };
}

function qaStatusWithWarnings(base, blockers, warnings) {
  if (blockers.length || base === "FAIL") return "FAIL";
  if (base === "PASS" && warnings.length) return "PARTIAL";
  return base;
}

function qaAggregateStatus(statuses) {
  if (!statuses.length) return "UNKNOWN";
  if (statuses.some((status) => status === "FAIL")) return "FAIL";
  const nonNa = statuses.filter((status) => status !== "N/A");
  if (!nonNa.length) return "N/A";
  if (nonNa.every((status) => status === "PASS")) return "PASS";
  if (nonNa.every((status) => status === "UNKNOWN")) return "UNKNOWN";
  return "PARTIAL";
}

function qaCoverageFromRefs(refsByLayer) {
  return qaHarnessSourceLayers.map((layer) => {
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

function qaMergeCoverage(entries) {
  const refsByLayer = {};
  for (const entry of entries) {
    refsByLayer[entry.layer] = [...(refsByLayer[entry.layer] || []), ...(entry.sourceRefs || [])];
  }
  return qaCoverageFromRefs(refsByLayer);
}

function qaManifestRefs(reports) {
  return reports.map((report) => `manifest_match:${report.taskId}:${report.status}`);
}

function qaItemsForShot(items, shotId) {
  return items.filter((item) => item.shotId === shotId);
}

function qaPromptConflictsForShot(conflictReports, promptPlans) {
  const promptPlanIds = new Set(promptPlans.map((plan) => plan.promptPlanId));
  return conflictReports.filter((report) => (report.shotId && promptPlans.some((plan) => plan.shotId === report.shotId)) || promptPlanIds.has(report.promptPlanId));
}

function qaLinkedManifestReports(reports, healthReports, promotionReports) {
  const taskIds = new Set([
    ...healthReports.flatMap((report) => [report.taskPlanId, report.jobId]),
    ...promotionReports.flatMap((report) => [report.taskPlanId, report.jobId]),
  ]);
  return reports.filter((report) => taskIds.has(report.taskId));
}

function qaReadinessWarnings(readiness) {
  if (!readiness) return ["No asset readiness report is linked to this shot."];
  if (readiness.status === "draft_only" || readiness.formalBlocked) {
    return ["Asset readiness keeps this shot draft-only for formal promotion.", ...(readiness.warnings || [])];
  }
  return readiness.warnings || [];
}

function qaEvaluateReferenceDimension({ dimensionId, shot, readiness }) {
  const base = shot.gates[dimensionId];
  const readinessBlockers = readiness && readiness.status === "blocked" && base !== "N/A"
    ? readiness.blockers?.length
      ? readiness.blockers
      : ["Asset readiness is blocked for this shot."]
    : [];
  const blockers = [
    ...(base === "FAIL" ? [`Story Flow ${dimensionId} gate is FAIL.`] : []),
    ...readinessBlockers,
  ];
  const warnings = [
    ...(base === "UNKNOWN" ? [`Story Flow ${dimensionId} gate is UNKNOWN.`] : []),
    ...(base === "PARTIAL" ? [`Story Flow ${dimensionId} gate is PARTIAL.`] : []),
    ...(base === "N/A" ? [] : qaReadinessWarnings(readiness)),
  ];

  return qaMakeDimension({
    dimensionId,
    status: base === "N/A" ? "N/A" : qaStatusWithWarnings(base, blockers, warnings),
    blockers,
    warnings,
    sourceRefs: [
      `storyFlow.shots:${shot.id}`,
      readiness?.reportId || "",
      ...(readiness?.safeReferenceIds || []),
      ...(readiness?.missingReferenceIds || []),
    ],
    notes: [`Uses Story Flow ${dimensionId} gate and shot-level asset readiness facts.`],
  });
}

function qaEvaluatePairDimension({ shot, videoGate }) {
  const base = shot.gates.pair;
  const pairBlockedChecks = videoGate?.checks?.filter((check) => check.status === "blocked" && /pair|frame|derivation/i.test(`${check.id} ${check.label}`)) || [];
  const blockers = [
    ...(base === "FAIL" ? ["Story Flow pair gate is FAIL."] : []),
    ...pairBlockedChecks.map((check) => check.detail),
    ...(!shot.startFrame ? ["Shot is missing a start frame reference."] : []),
    ...(!shot.endFrame ? ["Shot is missing an end frame reference."] : []),
  ];
  const warnings = [
    ...(base === "UNKNOWN" ? ["Story Flow pair gate is UNKNOWN."] : []),
    ...(base === "PARTIAL" ? ["Story Flow pair gate is PARTIAL."] : []),
    ...(videoGate ? [] : ["No video readiness gate is linked to this shot."]),
  ];
  return qaMakeDimension({
    dimensionId: "pair",
    status: qaStatusWithWarnings(base, blockers, warnings),
    blockers,
    warnings,
    sourceRefs: [`storyFlow.shots:${shot.id}`, videoGate?.gateId || ""],
    notes: ["Pair QA combines Story Flow pair gate, start/end frame presence, and video readiness derivation facts."],
  });
}

function qaEvaluateStoryDimension({ shot, promptPlans, conflictReports }) {
  const base = shot.gates.story;
  const conflictBlockers = conflictReports.flatMap((report) =>
    (report.conflicts || []).filter((conflict) => conflict.severity === "blocker").map((conflict) => conflict.detail),
  );
  const conflictWarnings = conflictReports.flatMap((report) =>
    (report.conflicts || []).filter((conflict) => conflict.severity !== "blocker").map((conflict) => conflict.detail),
  );
  const blockers = [
    ...(base === "FAIL" ? ["Story Flow story gate is FAIL."] : []),
    ...conflictBlockers,
  ];
  const warnings = [
    ...(base === "UNKNOWN" ? ["Story Flow story gate is UNKNOWN."] : []),
    ...(base === "PARTIAL" ? ["Story Flow story gate is PARTIAL."] : []),
    ...(shot.storyFunction ? [] : ["Shot storyFunction is missing."]),
    ...(promptPlans.length ? [] : ["No prompt plan is linked to this shot."]),
    ...conflictWarnings,
  ];
  return qaMakeDimension({
    dimensionId: "story",
    status: qaStatusWithWarnings(base, blockers, warnings),
    blockers,
    warnings,
    sourceRefs: [
      `storyFlow.shots:${shot.id}`,
      ...promptPlans.map((plan) => plan.promptPlanId),
      ...conflictReports.map((report) => report.reportId),
    ],
    notes: ["Story QA stays diagnostic: prompt conflicts can block, but 8.7 does not rewrite story semantics."],
  });
}

function qaEvaluateStyleDimension({ shot, promptPlans, conflictReports, readiness }) {
  const base = shot.gates.style;
  const hasStyleDirectives = promptPlans.some((plan) => (plan.styleDirectives || []).length > 0);
  const conflictBlockers = conflictReports.flatMap((report) =>
    (report.conflicts || []).filter((conflict) => conflict.severity === "blocker").map((conflict) => conflict.detail),
  );
  const conflictWarnings = conflictReports.flatMap((report) =>
    (report.conflicts || []).filter((conflict) => conflict.severity !== "blocker").map((conflict) => conflict.detail),
  );
  const blockers = [
    ...(base === "FAIL" ? ["Story Flow style gate is FAIL."] : []),
    ...conflictBlockers,
  ];
  const warnings = [
    ...(base === "UNKNOWN" ? ["Story Flow style gate is UNKNOWN."] : []),
    ...(base === "PARTIAL" ? ["Story Flow style gate is PARTIAL."] : []),
    ...(promptPlans.length ? [] : ["No prompt plan is linked to this shot."]),
    ...(hasStyleDirectives ? [] : ["No style directives are present in linked prompt plans."]),
    ...(readiness?.formalBlocked ? ["Asset readiness blocks formal style reference promotion."] : []),
    ...conflictWarnings,
  ];
  return qaMakeDimension({
    dimensionId: "style",
    status: qaStatusWithWarnings(base, blockers, warnings),
    blockers,
    warnings,
    sourceRefs: [
      `storyFlow.shots:${shot.id}`,
      readiness?.reportId || "",
      ...promptPlans.flatMap((plan) => [plan.promptPlanId, ...(plan.styleDirectives || [])]),
      ...conflictReports.map((report) => report.reportId),
    ],
    notes: ["Style QA uses Story Flow style gate plus prompt style directives and conflict reports."],
  });
}

function qaEvaluateMotionDimension({ shot, videoTaskPlan, videoGate }) {
  if (!videoTaskPlan) {
    return qaMakeDimension({
      dimensionId: "motion",
      status: "UNKNOWN",
      warnings: ["No video task plan is linked to this shot."],
      sourceRefs: [`storyFlow.shots:${shot.id}`],
      notes: ["Motion QA needs video planning facts; no provider submit or semantic inspection is run by 8.7."],
    });
  }
  const blockers = videoTaskPlan.status === "blocked" ? videoTaskPlan.blockers || [] : [];
  const warnings = [
    ...(videoTaskPlan.warnings || []),
    ...(videoTaskPlan.status === "parked" ? ["Video provider remains parked; motion output is not explicitly QA-passed."] : []),
    ...(videoTaskPlan.status === "ready" ? ["Video task is only a plan; no motion output QA pass is recorded by 8.7."] : []),
  ];
  const status = blockers.length ? "FAIL" : videoTaskPlan.status === "parked" || videoTaskPlan.status === "ready" ? "PARTIAL" : "UNKNOWN";
  return qaMakeDimension({
    dimensionId: "motion",
    status,
    blockers,
    warnings,
    sourceRefs: [videoTaskPlan.taskPlanId, videoGate?.gateId || ""],
    notes: ["Motion QA is derived from video planning/readiness only; Seedance/Jimeng submit remains forbidden."],
  });
}

function qaEvaluateAudioDimension({ shot, audioPlan }) {
  const audioPlanId = `audio_plan_${safeId(shot.id)}`;
  if (!audioPlan) {
    return qaMakeDimension({
      dimensionId: "audio",
      status: "UNKNOWN",
      warnings: ["No audio plan is linked to this shot."],
      sourceRefs: [`storyFlow.shots:${shot.id}`],
      notes: ["Audio QA needs audio planning facts; no audio provider is called by 8.7."],
    });
  }
  const base = audioPlan.outputPath ? audioPlan.audioQaStatus : "UNKNOWN";
  const blockers = base === "FAIL" ? ["Audio plan QA status is FAIL."] : [];
  const warnings = [
    ...(audioPlan.outputPath ? [] : ["Audio plan has no outputPath; audio QA cannot pass from planning facts only."]),
    ...(base === "PARTIAL" ? ["Audio plan QA status is PARTIAL."] : []),
    ...(base === "UNKNOWN" ? ["Audio plan QA status is UNKNOWN."] : []),
  ];
  return qaMakeDimension({
    dimensionId: "audio",
    status: qaStatusWithWarnings(base, blockers, warnings),
    blockers,
    warnings,
    sourceRefs: [audioPlanId, audioPlan.outputPath || ""],
    notes: ["Audio QA uses audioPlanning shot plan facts only; TTS/music providers remain forbidden."],
  });
}

function qaFormalPromotionGate({ promotion, health, manifest, readiness }) {
  const manifestStatus = health?.manifestStatus || manifest?.status;
  const checks = [
    {
      pass: promotion.canPromoteToFormal === true,
      reason: `${promotion.reportId} does not have canPromoteToFormal=true.`,
    },
    {
      pass: health?.healthStatus === "formal_ready",
      reason: `${health?.reportId || promotion.taskPlanId} generation health is not formal_ready.`,
    },
    {
      pass: hasManifestMatch(manifestStatus),
      reason: `Manifest status is ${manifestStatus || "missing"}.`,
    },
    {
      pass: health?.stalePrompt === false && promotion.requiredGates?.promptFresh === true,
      reason: "Prompt freshness gate is not satisfied.",
    },
    {
      pass:
        health?.assetReadinessStatus === "ready" &&
        promotion.requiredGates?.assetReadiness === true &&
        readiness?.status === "ready" &&
        readiness.formalBlocked === false,
      reason: "Asset readiness gate is not satisfied.",
    },
    {
      pass: health?.qaStatus === "pass" && promotion.requiredGates?.qaPass === true,
      reason: "Explicit QA pass is not satisfied.",
    },
    {
      pass: promotion.requiredGates?.expectedOutput === true,
      reason: "Expected output gate is not satisfied.",
    },
    {
      pass: promotion.requiredGates?.manifestMatch === true,
      reason: "QA promotion manifestMatch gate is not satisfied.",
    },
  ];
  const reasons = checks.filter((check) => !check.pass).map((check) => check.reason);
  return { eligible: reasons.length === 0, reasons };
}

function qaRequiresHumanReview(dimensions, blockingReasons) {
  return dimensions.some((dimension) => ["UNKNOWN", "FAIL", "PARTIAL"].includes(dimension.status) || (dimension.blockers || []).length > 0) || blockingReasons.length > 0;
}

function qaBuildItem(input, shot) {
  const healthReports = qaItemsForShot(input.generationHealthReports, shot.id);
  const promotionReports = qaItemsForShot(input.qaPromotionReports, shot.id);
  const scopedManifestReports = qaLinkedManifestReports(input.manifestMatches, healthReports, promotionReports);
  const readiness = input.assetReadinessReports.find((report) => report.shotId === shot.id);
  const promptPlans = input.promptPlans.filter((plan) => plan.shotId === shot.id);
  const conflictReports = qaPromptConflictsForShot(input.promptConflictReports, promptPlans);
  const generationJobs = input.generationHarness.jobs.filter((job) => job.shotId === shot.id);
  const watcherStreams = input.filesystemWatcherHarness.streams.filter((stream) => stream.shotId === shot.id);
  const resumeItems = input.checkpointResumeHarness.items.filter((item) => item.shotId === shot.id);
  const videoTaskPlan = input.videoPlanning.taskPlans.find((plan) => plan.shotId === shot.id);
  const videoGate = input.videoPlanning.readinessGates.find((gate) => gate.shotId === shot.id);
  const audioPlan = input.audioPlanning.shotPlans.find((plan) => plan.shotId === shot.id);
  const healthByTaskPlan = new Map(healthReports.map((report) => [report.taskPlanId, report]));
  const manifestByTaskId = new Map(scopedManifestReports.map((report) => [report.taskId, report]));
  const formalGateResults = promotionReports.map((promotion) =>
    qaFormalPromotionGate({
      promotion,
      health: healthByTaskPlan.get(promotion.taskPlanId),
      manifest: manifestByTaskId.get(promotion.taskPlanId) || manifestByTaskId.get(promotion.jobId),
      readiness,
    }),
  );
  const formalPromotionEligible = formalGateResults.length > 0 && formalGateResults.every((result) => result.eligible);
  const formalPromotionBlockedReasons = formalGateResults.length
    ? uniqueSorted(formalGateResults.flatMap((result) => result.reasons))
    : ["No QA promotion report is linked to this shot."];
  const dimensions = [
    qaMakeDimension({
      dimensionId: "whole_film",
      status: "N/A",
      sourceRefs: [`storyFlow.shots:${shot.id}`],
      notes: ["Whole-film QA is emitted in qaHarness.overall before shot/item details."],
    }),
    qaEvaluateReferenceDimension({ dimensionId: "identity", shot, readiness }),
    qaEvaluateReferenceDimension({ dimensionId: "scene", shot, readiness }),
    qaEvaluatePairDimension({ shot, videoGate }),
    qaEvaluateStoryDimension({ shot, promptPlans, conflictReports }),
    qaEvaluateReferenceDimension({ dimensionId: "prop", shot, readiness }),
    qaEvaluateStyleDimension({ shot, promptPlans, conflictReports, readiness }),
    qaEvaluateMotionDimension({ shot, videoTaskPlan, videoGate }),
    qaEvaluateAudioDimension({ shot, audioPlan }),
  ];
  const refsByLayer = {
    generationHealthReports: healthReports.map((report) => report.reportId),
    qaPromotionReports: promotionReports.map((report) => report.reportId),
    manifestMatches: qaManifestRefs(scopedManifestReports),
    assetReadinessReports: readiness ? [readiness.reportId] : [],
    promptPlans: promptPlans.map((plan) => plan.promptPlanId),
    promptConflictReports: conflictReports.map((report) => report.reportId),
    generationHarness: generationJobs.map((job) => job.harnessJobId),
    filesystemWatcherHarness: watcherStreams.map((stream) => stream.streamId),
    checkpointResumeHarness: resumeItems.map((item) => item.resumeItemId),
    videoPlanning: uniqueSorted([videoTaskPlan?.taskPlanId || "", videoGate?.gateId || ""]),
    audioPlanning: audioPlan ? [`audio_plan_${safeId(shot.id)}`] : [],
    "storyFlow.shots": [shot.id],
  };
  const primaryGenerationJob = generationJobs[0];
  const primaryResumeItem = resumeItems[0];

  return {
    qaItemId: `qa_harness_item_${safeId(shot.id)}`,
    shotId: shot.id,
    taskPlanId: primaryGenerationJob?.taskPlanId || healthReports[0]?.taskPlanId || promotionReports[0]?.taskPlanId,
    jobId: primaryGenerationJob?.jobId || healthReports[0]?.jobId || promotionReports[0]?.jobId,
    harnessJobId: primaryGenerationJob?.harnessJobId,
    checkpointResumeItemId: primaryResumeItem?.resumeItemId,
    videoTaskPlanId: videoTaskPlan?.taskPlanId,
    audioPlanId: audioPlan ? `audio_plan_${safeId(shot.id)}` : undefined,
    dimensions,
    formalPromotionEligible,
    formalPromotionBlockedReasons: formalPromotionEligible ? [] : formalPromotionBlockedReasons,
    requiresHumanReview: qaRequiresHumanReview(dimensions, formalPromotionEligible ? [] : formalPromotionBlockedReasons),
    sourceCoverage: qaCoverageFromRefs(refsByLayer),
    notes: [
      "Phase 8.7 QA Harness emits diagnostics only; it cannot promote formal files or perform semantic repair.",
      formalPromotionEligible
        ? "Formal promotion gates are eligible, but 8.7 still does not promote files."
        : "Formal promotion remains blocked until promotion, health, manifest, prompt freshness, asset readiness, and explicit QA pass all agree.",
    ],
  };
}

function qaBuildOverall(items) {
  const dimensions = qaHarnessDimensionOrder.map((dimensionId) => {
    const scopedStatuses =
      dimensionId === "whole_film"
        ? items.flatMap((item) => item.dimensions.filter((dimension) => dimension.dimensionId !== "whole_film").map((dimension) => dimension.status))
        : items.flatMap((item) => item.dimensions.filter((dimension) => dimension.dimensionId === dimensionId).map((dimension) => dimension.status));
    const blockers = items.flatMap((item) =>
      item.dimensions
        .filter((dimension) => dimensionId === "whole_film" || dimension.dimensionId === dimensionId)
        .flatMap((dimension) => dimension.blockers || []),
    );
    const warnings = items.flatMap((item) =>
      item.dimensions
        .filter((dimension) => dimensionId === "whole_film" || dimension.dimensionId === dimensionId)
        .flatMap((dimension) => dimension.warnings || []),
    );
    const sourceRefs = items.flatMap((item) =>
      item.dimensions
        .filter((dimension) => dimensionId === "whole_film" || dimension.dimensionId === dimensionId)
        .flatMap((dimension) => dimension.sourceRefs || []),
    );
    const status = qaAggregateStatus(scopedStatuses);
    return qaMakeDimension({
      dimensionId,
      status,
      blockers,
      warnings:
        status === "PARTIAL" && !warnings.length
          ? [`${dimensionId} has mixed PASS/N/A/UNKNOWN/PARTIAL shot-level facts.`]
          : warnings,
      sourceRefs,
      notes: [
        dimensionId === "whole_film"
          ? "Whole-film verdict is aggregated before shot/item detail."
          : `Aggregated ${dimensionId} verdict from shot-level QA item facts.`,
      ],
    });
  });
  const status = qaAggregateStatus(dimensions.map((dimension) => dimension.status));
  const blockers = uniqueSorted(dimensions.flatMap((dimension) => dimension.blockers || []));
  const warnings = uniqueSorted(dimensions.flatMap((dimension) => dimension.warnings || []));
  return {
    sequenceId: "qa_harness_overall_sequence",
    overallFirst: true,
    dimensions,
    status,
    severity: qaSeverityFor(status, blockers, warnings),
    requiresHumanReview: qaRequiresHumanReview(dimensions, blockers),
    blockers,
    warnings,
    sourceCoverage: qaMergeCoverage(items.flatMap((item) => item.sourceCoverage)),
    notes: [
      "Overall/sequence QA is emitted before shot details by contract.",
      "Overall verdict is an evidence summary, not a provider execution or semantic repair step.",
    ],
  };
}

function buildQaHarnessState(input) {
  const items = input.storyFlowShots.map((shot) => qaBuildItem(input, shot)).sort((left, right) => left.qaItemId.localeCompare(right.qaItemId));
  const overall = qaBuildOverall(items);
  const failedItems = items.filter((item) => item.dimensions.some((dimension) => dimension.status === "FAIL")).length;
  const partialItems = items.filter((item) => item.dimensions.some((dimension) => dimension.status === "PARTIAL")).length;
  const unknownItems = items.filter((item) => item.dimensions.some((dimension) => dimension.status === "UNKNOWN")).length;
  return {
    schemaVersion: "0.1.0",
    generatedAt: input.generatedAt,
    dimensionOrder: qaHarnessDimensionOrder,
    overall,
    items,
    summary: {
      totalItems: items.length,
      requiresHumanReview: items.filter((item) => item.requiresHumanReview).length,
      formalPromotionEligible: items.filter((item) => item.formalPromotionEligible).length,
      formalPromotionBlocked: items.filter((item) => !item.formalPromotionEligible).length,
      failedItems,
      partialItems,
      unknownItems,
      overallStatus: overall.status,
      overallFirst: true,
      dryRunOnly: true,
      liveSubmitAllowed: false,
      noFileMutation: true,
    },
    sourceCoverage: qaMergeCoverage([...items.flatMap((item) => item.sourceCoverage), ...overall.sourceCoverage]),
    hardLocks: qaHarnessHardLocks,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    noFileMutation: true,
    noAutoPromotion: true,
    planOnly: true,
    diagnosticsOnly: true,
    notes: [
      "Phase 8.7 QA Harness combines existing plan/fact/diagnostic layers only.",
      "It cannot submit providers, mutate files, promote formal outputs, or run semantic repair.",
      "No worker or provider self-report can pass QA; explicit QA and promotion gates remain required.",
    ],
  };
}

const toolRuntimeHarnessCategories = [
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

const toolRuntimeHarnessSourceLayers = [
  "runtime.config",
  "runtime.detectionReport",
  "runtime.providerEnablementSummary",
  "adapterContracts",
  "generationHarness",
  "filesystemWatcherHarness",
  "checkpointResumeHarness",
  "qaHarness",
];

const toolRuntimeHarnessHardLocks = {
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

function toolRuntimeStatus(status) {
  if (status === "available") return "ready";
  if (["missing", "planned", "blocked", "unknown"].includes(status)) return status;
  return "unknown";
}

function toolRuntimePathStatus(tool) {
  if (!tool) return "missing";
  if (tool.status === "available" && tool.path) return "path";
  if (["missing", "planned", "blocked"].includes(tool.status)) return tool.status;
  return "unknown";
}

function toolRuntimePlatformSupport(notes = []) {
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

function toolRuntimeFindTool(tools, ids) {
  return ids.map((id) => tools.find((tool) => tool.id === id)).find(Boolean);
}

function toolRuntimeDetectionRef(tool, fallbackId) {
  return tool ? `runtime.detectionReport:tool:${tool.id}:${tool.status}` : `runtime.detectionReport:tool:${fallbackId}:not_present`;
}

function toolRuntimeMissingBlockers(label, status, missingIsBlocker) {
  if (!missingIsBlocker) return [];
  if (status === "missing") return [`${label} is required by current runtime diagnostics but was not detected.`];
  if (status === "blocked") return [`${label} detection is blocked.`];
  if (status === "unknown") return [`${label} detection status is unknown.`];
  return [];
}

function toolRuntimeOptionalWarnings(label, status, missingIsBlocker) {
  if (missingIsBlocker) return [];
  if (status === "missing") return [`Optional ${label} is not detected; future workflows must stay disabled or use a configured replacement.`];
  if (status === "unknown") return [`Optional ${label} detection is unknown; do not assume it is available.`];
  if (status === "planned") return [`${label} detection is planned and cannot be used as an available runtime fact.`];
  return [];
}

function toolRuntimeDetectedCheck({
  checkId,
  category,
  label,
  toolIds,
  tools,
  requiredFor,
  missingIsBlocker,
  sourceRefs = [],
  notes = [],
}) {
  const tool = toolRuntimeFindTool(tools, toolIds);
  const status = toolRuntimeStatus(tool?.status);
  return {
    checkId,
    category,
    label: tool?.label || label,
    requiredFor: uniqueSorted(tool?.requiredFor?.length ? tool.requiredFor : requiredFor),
    status,
    pathStatus: toolRuntimePathStatus(tool),
    path: tool?.path,
    version: tool?.version,
    platformSupport: toolRuntimePlatformSupport(),
    canExecuteNow: false,
    executionMode: "diagnostic_only",
    missingIsBlocker,
    blockers: toolRuntimeMissingBlockers(label, status, missingIsBlocker),
    warnings: toolRuntimeOptionalWarnings(label, status, missingIsBlocker),
    sourceRefs: uniqueSorted([
      toolRuntimeDetectionRef(tool, checkId),
      "runtime.config:toolPaths",
      ...sourceRefs,
    ]),
    notes: uniqueSorted([
      ...(tool?.notes || []),
      ...notes,
      "8.8 records fact diagnostics only; this row never grants execution permission.",
    ]),
  };
}

function toolRuntimeSyntheticCheck({
  checkId,
  category,
  label,
  requiredFor,
  status,
  pathStatus,
  path,
  version,
  missingIsBlocker,
  sourceRefs,
  notes,
  platformSupportNotes = [],
}) {
  return {
    checkId,
    category,
    label,
    requiredFor: uniqueSorted(requiredFor),
    status,
    pathStatus,
    path,
    version,
    platformSupport: toolRuntimePlatformSupport(platformSupportNotes),
    canExecuteNow: false,
    executionMode: "diagnostic_only",
    missingIsBlocker,
    blockers: toolRuntimeMissingBlockers(label, status, missingIsBlocker),
    warnings: toolRuntimeOptionalWarnings(label, status, missingIsBlocker),
    sourceRefs: uniqueSorted(sourceRefs),
    notes: uniqueSorted(notes),
  };
}

function buildToolRuntimePathPolicy(runtime) {
  const refs = [
    "runtime.config:projectRootPolicy:project_root_relative",
    "runtime.config:projectRootPolicy:macPathStyle:posix",
    "runtime.config:projectRootPolicy:windowsPathStyle:win32",
    ...(runtime.config.pathRules || []).map((rule) => `runtime.config:pathRules:${rule.id}`),
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
    sourceRefs: uniqueSorted(refs),
    notes: [
      "Tool paths must come from RuntimeConfig or ToolDetectionReport facts.",
      "Hardcoded shell-only paths and shell profile lookups are not valid runtime configuration.",
    ],
  };
}

function toolRuntimeCoverage(refsByLayer) {
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

function buildToolRuntimeCoverageRefs(input, checks) {
  return {
    "runtime.config": uniqueSorted([
      `runtime.config:schemaVersion:${input.runtime.config.schemaVersion}`,
      `runtime.config:runtimeMode:${input.runtime.config.runtimeMode}`,
      `runtime.config:platform:${input.runtime.config.platform}`,
      `runtime.config:sidecarPermissions:arbitraryShellExecution:${input.runtime.config.sidecarPermissions.arbitraryShellExecution}`,
      ...(input.runtime.config.pathRules || []).map((rule) => `runtime.config:pathRules:${rule.id}`),
      ...checks.flatMap((check) => (check.sourceRefs || []).filter((ref) => ref.startsWith("runtime.config:"))),
    ]),
    "runtime.detectionReport": uniqueSorted([
      `runtime.detectionReport:generatedAt:${input.runtime.detectionReport.generatedAt}`,
      ...(input.runtime.detectionReport.tools || []).map((tool) => `runtime.detectionReport:tool:${tool.id}:${tool.status}`),
      ...checks.flatMap((check) => (check.sourceRefs || []).filter((ref) => ref.startsWith("runtime.detectionReport:"))),
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

function buildToolRuntimeHarnessState(input) {
  const tools = input.runtime.detectionReport.tools || [];
  const imageTool = toolRuntimeFindTool(tools, ["magick", "imagemagick", "sips"]);
  const pythonTool = toolRuntimeFindTool(tools, ["python", "python3"]);
  const checks = [
    toolRuntimeDetectedCheck({
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
    toolRuntimeDetectedCheck({
      checkId: "node-runtime",
      category: "node_runtime",
      label: "Node.js",
      toolIds: ["node"],
      tools,
      requiredFor: ["TypeScript/Node core", "import runtime test"],
      missingIsBlocker: true,
      notes: ["Node is required for local development scripts and runtime-state import diagnostics."],
    }),
    toolRuntimeSyntheticCheck({
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
    toolRuntimeDetectedCheck({
      checkId: "ffmpeg",
      category: "media_binary",
      label: "FFmpeg",
      toolIds: ["ffmpeg"],
      tools,
      requiredFor: ["preview/export health checks"],
      missingIsBlocker: true,
      notes: ["FFmpeg detection is a version/path diagnostic only."],
    }),
    toolRuntimeDetectedCheck({
      checkId: "ffprobe",
      category: "media_binary",
      label: "FFprobe",
      toolIds: ["ffprobe"],
      tools,
      requiredFor: ["media metadata checks"],
      missingIsBlocker: true,
      notes: ["FFprobe detection is a version/path diagnostic only."],
    }),
    toolRuntimeSyntheticCheck({
      checkId: "imagemagick-or-system-image-tool",
      category: "image_tool",
      label: "ImageMagick or System Image Tool",
      requiredFor: ["image dimension/format diagnostics", "future thumbnail and still-image inspection"],
      status: imageTool ? toolRuntimeStatus(imageTool.status) : "planned",
      pathStatus: imageTool ? toolRuntimePathStatus(imageTool) : "planned",
      path: imageTool?.path,
      version: imageTool?.version,
      missingIsBlocker: false,
      sourceRefs: [
        toolRuntimeDetectionRef(imageTool, "imagemagick-or-system-image-tool"),
        "generationHarness:postprocessPolicy:metadata_probe",
      ],
      notes: [
        "ImageMagick/magick/sips detection is not yet part of the import detection report.",
        "Do not infer image-tool availability from Image2 provider settings.",
      ],
    }),
    toolRuntimeSyntheticCheck({
      checkId: "python-optional",
      category: "python_optional",
      label: "Python Optional Runtime",
      requiredFor: ["optional document/media helper scripts"],
      status: pythonTool ? toolRuntimeStatus(pythonTool.status) : "missing",
      pathStatus: pythonTool ? toolRuntimePathStatus(pythonTool) : "missing",
      path: pythonTool?.path,
      version: pythonTool?.version,
      missingIsBlocker: false,
      sourceRefs: [toolRuntimeDetectionRef(pythonTool, "python-optional")],
      notes: ["Python is optional for this harness and missing Python must not block runtime-state generation."],
    }),
    toolRuntimeDetectedCheck({
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
    toolRuntimeDetectedCheck({
      checkId: "git-vcs-optional",
      category: "vcs_optional",
      label: "Git",
      toolIds: ["git"],
      tools,
      requiredFor: ["diagnostics"],
      missingIsBlocker: false,
      notes: ["Git is optional and used only as a local diagnostic helper."],
    }),
    toolRuntimeDetectedCheck({
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
  const pathPolicy = buildToolRuntimePathPolicy(input.runtime);
  const sourceCoverage = toolRuntimeCoverage(buildToolRuntimeCoverageRefs(input, checks));

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
      missingBlockers: checks.filter((check) => check.missingIsBlocker && ["missing", "blocked", "unknown"].includes(check.status)).length,
      optionalMissing: checks.filter((check) => !check.missingIsBlocker && check.status === "missing").length,
      blockerCount: checks.reduce((total, check) => total + (check.blockers || []).length, 0),
      warningCount: checks.reduce((total, check) => total + (check.warnings || []).length, 0),
      dryRunOnly: true,
      diagnosticsOnly: true,
      canExecuteNow: false,
      liveSubmitAllowed: false,
      providerSubmissionForbidden: true,
      arbitraryShellExecutionBlocked: true,
    },
    pathPolicy,
    platformCompatibility: {
      currentPlatform: input.runtime.config.platform || input.runtime.detectionReport.platform || "unknown",
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
    sourceCoverage,
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

function estimateKnowledgeTokens(value) {
  return Math.max(1, Math.ceil(String(value || "").length / 4));
}

function trimKnowledgeToBudget(content, maxTokens) {
  const maxChars = Math.max(1, maxTokens * 4);
  return String(content || "").length <= maxChars ? String(content || "") : String(content || "").slice(0, maxChars).trimEnd();
}

function summarySnippetForPack(pack) {
  return {
    id: "summary",
    title: `${pack.title} Summary`,
    content: pack.summary,
    keywords: pack.tags || [],
    hash: hashString(pack.summary || pack.id, "vck"),
    tokenEstimate: estimateKnowledgeTokens(pack.summary),
  };
}

function snippetsForKnowledgeMatch(pack, match) {
  const byId = new Map((pack.snippets || []).map((snippet) => [snippet.id, snippet]));
  const matched = (match.matchedSnippetIds || []).map((snippetId) => byId.get(snippetId)).filter(Boolean);

  if (matched.length) return matched;
  if ((pack.snippets || []).length) return pack.snippets.slice(0, 1);
  return [summarySnippetForPack(pack)];
}

function matchKnowledgeBindings(job, knowledgeManifest) {
  const purpose = knowledgePurposeFromSlot(job.slot);
  const preferredCategories = {
    asset: ["style", "prompt", "qa", "provider"],
    keyframe: ["composition", "camera", "lighting", "color", "style", "prompt", "qa"],
    edit: ["composition", "camera", "lighting", "color", "style", "prompt", "qa"],
    i2v: ["camera", "performance", "provider", "qa", "prompt"],
    audio: ["audio", "qa"],
    unknown: ["agent", "qa"],
  }[purpose] || ["qa"];

  return (knowledgeManifest.packs || [])
    .filter((pack) => pack.enabled && preferredCategories.includes(pack.category))
    .slice(0, 4)
    .map((pack, index) => ({
      packId: pack.id,
      version: pack.version,
      hash: pack.hash,
      category: pack.category,
      reason: `Bound through ProjectRuntimeState for ${purpose} task.`,
      consumer: index % 2 === 0 ? "prompt_compiler" : "qa_gate",
      score: Math.max(1, preferredCategories.length - index),
      matchedTerms: [purpose, pack.category].filter(Boolean),
      matchedSnippetIds: (pack.snippets || []).slice(0, 2).map((snippet) => snippet.id),
    }));
}

function buildRouteAndBudget(job, knowledgeManifest, generatedAt) {
  const matches = matchKnowledgeBindings(job, knowledgeManifest);
  const routeId = `route_${hashString(job.id, "vck")}`;
  const maxInjectionTokens = 900;
  const packById = new Map((knowledgeManifest.packs || []).map((pack) => [pack.id, pack]));
  const injectedKnowledgePacks = [];
  const injectedSnippets = [];
  let usedTokens = 0;

  for (const match of matches) {
    const pack = packById.get(match.packId);
    if (!pack) continue;

    const perPackLimit = Math.min(pack.maxInjectionTokens || 600, maxInjectionTokens - usedTokens);
    const selectedSnippetIds = [];
    let packTokens = 0;
    let truncated = false;
    let truncationReason;

    if (perPackLimit <= 0) {
      injectedKnowledgePacks.push({
        packId: pack.id,
        version: pack.version,
        hash: pack.hash,
        category: pack.category,
        reason: match.reason,
        consumer: match.consumer,
        injectedSnippetIds: [],
        summaryHash: hashString(pack.summary || pack.id, "vck"),
        truncated: true,
        truncationReason: "global_context_budget_exhausted",
      });
      continue;
    }

    for (const snippet of snippetsForKnowledgeMatch(pack, match)) {
      const remainingGlobal = maxInjectionTokens - usedTokens;
      const remainingPack = perPackLimit - packTokens;
      const remaining = Math.min(remainingGlobal, remainingPack);
      const tokenEstimate = snippet.tokenEstimate || estimateKnowledgeTokens(snippet.content);

      if (remaining <= 0) {
        truncated = true;
        truncationReason = packTokens >= perPackLimit ? "pack_max_injection_tokens_exhausted" : "global_context_budget_exhausted";
        break;
      }

      const injectedTokenEstimate = Math.min(tokenEstimate, remaining);
      selectedSnippetIds.push(snippet.id);
      injectedSnippets.push({
        packId: pack.id,
        snippetId: snippet.id,
        title: snippet.title,
        content: tokenEstimate > remaining ? trimKnowledgeToBudget(snippet.content, remaining) : snippet.content,
        tokenEstimate: injectedTokenEstimate,
        hash: snippet.hash,
      });
      usedTokens += injectedTokenEstimate;
      packTokens += injectedTokenEstimate;

      if (tokenEstimate > remaining) {
        truncated = true;
        truncationReason = packTokens >= perPackLimit ? "pack_max_injection_tokens_exhausted" : "global_context_budget_exhausted";
        break;
      }
    }

    injectedKnowledgePacks.push({
      packId: pack.id,
      version: pack.version,
      hash: pack.hash,
      category: pack.category,
      reason: match.reason,
      consumer: match.consumer,
      injectedSnippetIds: selectedSnippetIds,
      summaryHash: hashString(pack.summary || pack.id, "vck"),
      truncated,
      truncationReason,
    });
  }

  const routeResult = {
    routeId,
    taskId: job.id,
    taskPurpose: knowledgePurposeFromSlot(job.slot),
    providerSlot: job.slot,
    contextLevel: "L1",
    inputHash: hashString(`${job.id}:${job.slot}`, "vck"),
    matches,
    injectedKnowledgePacks,
    injectedKnowledgeSnippetIds: injectedSnippets.map((snippet) => `${snippet.packId}:${snippet.snippetId}`),
    notInjected: (knowledgeManifest.packs || []).filter((pack) => !pack.enabled).map((pack) => ({ packId: pack.id, reason: "pack_disabled" })),
    warnings: matches.length ? [] : ["No enabled knowledge pack matched this imported task."],
    createdAt: generatedAt,
  };
  const contextBudget = {
    budgetId: `${routeId}_budget`,
    routeId,
    contextLevel: "L1",
    maxInjectionTokens,
    usedTokens,
    injectedKnowledgePacks,
    injectedSnippets,
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

function buildEnvelope(job, shot, auditIssues, sourceIndex, knowledgeManifest, generatedAt) {
  const rule = policy.rules.find((item) => item.slot === job.slot);
  const expectedOutputs = job.outputPath ? [job.outputPath] : [];
  const references = (job.references || []).map((referencePath) => referenceFromPath(referencePath, sourceIndex));
  const keyframePairDerivation = buildKeyframePairDerivation(job, shot);
  const { routeResult, contextBudget } = buildRouteAndBudget(job, knowledgeManifest, generatedAt);
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
      injectedKnowledgeSnippetIds: contextBudget.injectedSnippets.map((snippet) => `${snippet.packId}:${snippet.snippetId}`),
      injectedKnowledgeSnippets: contextBudget.injectedSnippets,
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

function buildTaskStates(audit, sourceIndex, knowledgeManifest, generatedAt) {
  const snapshotPaths = new Set(audit.fileSnapshot || []);
  return audit.jobs.map((job) => {
    const shot = audit.shots.find((item) => job.id.includes(item.id));
    const { envelope, routeResult, contextBudget } = buildEnvelope(job, shot, audit.issues, sourceIndex, knowledgeManifest, generatedAt);
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

function safeId(value) {
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

function isParkedState(state) {
  return ["parked", "planned", "unavailable"].includes(state);
}

function videoCapabilities(registry) {
  return (registry.capabilities || []).filter((capability) => capability.slot === "video.i2v");
}

function selectedVideoProviderId(job, registry) {
  if (job?.providerId === "jimeng-video") return "jimeng-video";
  if (job?.providerId === "seedance2-provider") return "seedance2-provider";
  return registry.defaultProviderBySlot?.["video.i2v"] === "jimeng-video" ? "jimeng-video" : "seedance2-provider";
}

function selectedVideoCapability(providerId, registry) {
  return (registry.capabilities || []).find(
    (capability) =>
      capability.slot === "video.i2v" &&
      capability.requiredMode === "frames2video" &&
      capability.providerId === providerId,
  ) || videoCapabilities(registry)[0];
}

function buildVideoFallbackPairDerivation(shot) {
  const hasFrames = Boolean(
    shot.startFrame &&
      shot.endFrame &&
      !shot.issues.includes("missing_start_frame") &&
      !shot.issues.includes("missing_end_frame"),
  );
  return {
    shotId: shot.id,
    startFrameId: shot.startFrame || `${shot.id}:start`,
    endFrameId: shot.endFrame || `${shot.id}:end`,
    endDerivationSource: hasFrames ? "start_frame" : "unknown",
    validForI2vPair: hasFrames && shot.gates.pair === "PASS",
    exceptionReason: hasFrames ? undefined : "Start or end keyframe is missing from runtime audit.",
    allowedDelta: ["motion", "micro-expression", "camera movement"],
    mustPreserve: ["character identity", "scene layout", "style capsule"],
    mustNotAdd: ["new characters", "unapproved props", "text-to-video fallback"],
  };
}

function videoReadinessCheck(id, label, status, required, detail, target) {
  return { id, label, status, required, detail, target };
}

function videoRequiredGateCheck(field, value, shotId) {
  return videoReadinessCheck(
    `${field}_gate_pass`,
    `${field} gate PASS`,
    value === "PASS" ? "pass" : "blocked",
    true,
    `${field} gate is ${value}; Phase 7.1 requires PASS before video queue readiness.`,
    shotId,
  );
}

function videoNonRequiredGateCheck(field, value, shotId) {
  if (value === "FAIL") {
    return videoReadinessCheck(
      `${field}_gate_not_fail`,
      `${field} gate non-blocking`,
      "blocked",
      true,
      `${field} gate is FAIL; only pair/story are required PASS, but FAIL still blocks video readiness.`,
      shotId,
    );
  }
  const status = value === "UNKNOWN" ? "warning" : value === "N/A" ? "not_applicable" : "pass";
  return videoReadinessCheck(
    `${field}_gate_non_blocking`,
    `${field} gate may be PASS/PARTIAL/N/A`,
    status,
    false,
    `${field} gate is ${value}; Phase 7.1 allows N/A only for identity/scene/prop/style.`,
    shotId,
  );
}

function matchingHardIssues(issues, shot, job) {
  return (issues || []).filter((issue) => {
    const target = issue.target || "";
    const hard = issue.severity === "blocker" || /\bP0\b/i.test(issue.id) || /\bP0\b/i.test(issue.title) || /\bP0\b/i.test(issue.detail);
    return hard && (!target || target.includes(shot.id) || Boolean(job?.id && target.includes(job.id)));
  });
}

function buildVideoReadinessGate(shot, task, capability, audioPlanning, issues) {
  const derivation = task?.envelope?.keyframePairDerivation || buildVideoFallbackPairDerivation(shot);
  const startFramePresent = Boolean(shot.startFrame && !shot.issues.includes("missing_start_frame"));
  const endFramePresent = Boolean(shot.endFrame && !shot.issues.includes("missing_end_frame"));
  const hardIssues = matchingHardIssues(issues, shot, task?.job);
  const checks = [
    videoReadinessCheck("start_frame_present", "start frame present", startFramePresent ? "pass" : "blocked", true, startFramePresent ? "Shot has a start frame reference." : "Shot is missing a start frame reference.", shot.startFrame || shot.id),
    videoReadinessCheck("end_frame_present", "end frame present", endFramePresent ? "pass" : "blocked", true, endFramePresent ? "Shot has an end frame reference." : "Shot is missing an end frame reference.", shot.endFrame || shot.id),
    videoReadinessCheck("keyframe_pair_derivation_valid", "keyframe pair derivation valid", derivation.validForI2vPair ? "pass" : "blocked", true, derivation.validForI2vPair ? "Start/end frame derivation is valid for I2V." : "Start/end frame derivation is missing or invalid for I2V.", shot.id),
    videoRequiredGateCheck("pair", shot.gates.pair, shot.id),
    videoRequiredGateCheck("story", shot.gates.story, shot.id),
    videoNonRequiredGateCheck("identity", shot.gates.identity, shot.id),
    videoNonRequiredGateCheck("scene", shot.gates.scene, shot.id),
    videoNonRequiredGateCheck("prop", shot.gates.prop, shot.id),
    videoNonRequiredGateCheck("style", shot.gates.style, shot.id),
    videoReadinessCheck("no_bgm_for_video_provider", "no BGM for video provider", audioPlanning.videoProviderPolicy.noBgmForVideoProvider ? "pass" : "blocked", true, audioPlanning.videoProviderPolicy.noBgmForVideoProvider ? "Audio planning forbids BGM in video provider prompts." : "Audio planning did not assert noBgmForVideoProvider=true.", shot.id),
    videoReadinessCheck("video_provider_slot_parked", "video provider slot parked", isParkedState(capability?.executionState) && capability?.liveSubmitAllowed === false ? "pass" : "blocked", true, capability ? `Provider ${capability.providerId} is ${capability.executionState}; liveSubmitAllowed=${capability.liveSubmitAllowed}.` : "No parked video.i2v capability was found.", capability?.providerId),
    videoReadinessCheck("preflight_facts_present", "preflight facts present", task?.envelope?.preflight ? "pass" : "blocked", true, task?.envelope?.preflight ? `Preflight status is ${task.envelope.preflight.status}.` : "No video task preflight report is available for this shot.", task?.job?.id || shot.id),
    videoReadinessCheck("preflight_has_no_blockers", "preflight has no blockers", task?.envelope?.preflight && task.envelope.preflight.blockers.length === 0 ? "pass" : "blocked", true, task?.envelope?.preflight ? task.envelope.preflight.blockers.length === 0 ? "Video task preflight has no blockers." : `Video task preflight has ${task.envelope.preflight.blockers.length} blocker(s).` : "No video task preflight report is available for this shot.", task?.job?.id || shot.id),
    videoReadinessCheck("manifest_facts_present", "manifest facts present", task?.manifestMatch ? "pass" : "blocked", true, task?.manifestMatch ? `Manifest status is ${task.manifestMatch.status}.` : "No video task manifest match report is available for this shot.", task?.job?.id || shot.id),
    videoReadinessCheck("no_p0_or_blocker", "no P0/blocker", hardIssues.length ? "blocked" : "pass", true, hardIssues.length ? `${hardIssues.length} P0/blocker issue(s) apply to this video task.` : "No matching P0/blocker issue is attached to this shot or video job.", shot.id),
  ];
  const blockers = uniqueSorted(checks.filter((item) => item.required && item.status === "blocked").map((item) => item.detail));
  const warnings = uniqueSorted([
    ...checks.filter((item) => item.status === "warning").map((item) => item.detail),
    ...(task?.envelope?.preflight?.warnings || []).map((item) => item.messageForUser),
  ]);
  return {
    gateId: `video_readiness_${safeId(shot.id)}`,
    shotId: shot.id,
    status: blockers.length ? "blocked" : "parked",
    canEnterQueueShell: blockers.length === 0,
    canSubmitToProvider: false,
    startFramePresent,
    endFramePresent,
    keyframePairDerivation: derivation,
    allowedNaGateFields: ["identity", "scene", "prop", "style"],
    checks,
    blockers,
    warnings,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  };
}

function videoFrameRef(shotId, kind, pathValue) {
  return {
    shotFrameId: pathValue || `${shotId}:${kind}`,
    path: pathValue,
    present: Boolean(pathValue),
    source: pathValue ? "shot_record" : "missing",
  };
}

function buildVideoTaskPlan(shot, task, gate, providerId, capability) {
  const preflight = task?.envelope?.preflight;
  const providerParked = isParkedState(capability?.executionState);
  const status = gate.status === "blocked" ? "blocked" : providerParked ? "parked" : "ready";
  return {
    schemaVersion: "0.1.0",
    taskPlanId: `video_task_plan_${safeId(shot.id)}`,
    jobId: task?.job?.id || `video_${safeId(shot.id)}`,
    shotId: shot.id,
    readinessGateId: gate.gateId,
    providerSlot: "video.i2v",
    requiredMode: "frames2video",
    providerId,
    providerExecutionState: capability?.executionState || "parked",
    status,
    queueStatus: status,
    startFrameRef: videoFrameRef(shot.id, "start", shot.startFrame),
    endFrameRef: videoFrameRef(shot.id, "end", shot.endFrame),
    durationSeconds: null,
    durationPlaceholder: "derive_from_preview_event_or_motion_spec_later",
    motionBrief: shot.storyFunction ? `Motion should preserve the shot function: ${shot.storyFunction}` : "Motion placeholder reserved for future provider enablement.",
    promptConstraints: ["no bgm", "start/end frames only", "no text-to-video fallback", "no fast model", "no VIP channel", "preserve character identity, scene layout, and style capsule"],
    preflightFacts: {
      taskId: preflight?.taskId,
      status: preflight?.status || "not_available",
      blockerCount: preflight?.blockers?.length || 0,
      warningCount: preflight?.warnings?.length || 0,
    },
    manifestFacts: {
      status: task?.manifestMatch?.status || "not_available",
      expectedOutputs: task?.taskRun?.expectedOutputs || [],
      actualOutputs: task?.taskRun?.actualOutputs || [],
      missingExpectedOutput: task ? task.manifestMatch.status === "missing_expected_output" : true,
    },
    blockers: uniqueSorted([...gate.blockers, ...(preflight?.blockers || []).map((item) => item.messageForUser)]),
    warnings: uniqueSorted([...gate.warnings, ...(task?.queueGate?.warnings || []), "Provider submission is forbidden while video.i2v remains parked."]),
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    fastModelForbidden: true,
    vipChannelForbidden: true,
    textToVideoForbidden: true,
    liveSubmitAllowed: false,
  };
}

function buildVideoQueueShell(taskPlans) {
  const counts = {
    total: taskPlans.length,
    pending: taskPlans.filter((plan) => plan.queueStatus === "pending").length,
    ready: taskPlans.filter((plan) => plan.queueStatus === "ready").length,
    blocked: taskPlans.filter((plan) => plan.queueStatus === "blocked").length,
    parked: taskPlans.filter((plan) => plan.queueStatus === "parked").length,
  };
  const status = counts.total === 0 ? "empty" : counts.blocked > 0 && (counts.parked > 0 || counts.ready > 0) ? "blocked_with_ready_gates" : counts.blocked > 0 ? "blocked" : counts.parked > 0 ? "parked" : "ready";
  return {
    status,
    counts,
    concurrency: {
      placeholder: true,
      configuredLimit: 1,
      activeProviderLimit: 0,
      notes: ["Concurrency is reserved for Phase 7 provider enablement; parked providers have active limit 0."],
    },
    autoContinuePolicy: {
      enabled: false,
      mode: "manual_after_user_enablement",
      providerSubmissionForbidden: true,
      notes: ["Auto-continue can only be enabled after the user explicitly enables a live video adapter."],
    },
    longQueueTimeout: {
      placeholder: true,
      stallTimeoutSeconds: 600,
      action: "surface_waiting_state_only",
      notes: ["Timeout handling is a queue shell placeholder and never queries Seedance/Jimeng in Phase 7.1."],
    },
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    notes: [
      "Queue shell may display parked/blocked shot readiness, but it cannot submit provider tasks.",
      "blocked_with_ready_gates is only a queue-level mixed state when at least one shot is blocked and at least one shot is enterable.",
    ],
  };
}

function buildVideoPlanningState({ generatedAt, shots, jobs, taskViews, providerRegistry, audioPlanning, issues }) {
  const videoTasksByShot = new Map(
    taskViews
      .filter((task) => task.job.slot === "video.i2v")
      .map((task) => [task.shotId || task.envelope.keyframePairDerivation?.shotId || task.job.id, task]),
  );
  const readinessGates = [];
  const taskPlans = [];
  for (const shot of shots) {
    const task = videoTasksByShot.get(shot.id);
    const job = task?.job || jobs.find((item) => item.slot === "video.i2v" && item.id.includes(shot.id));
    const providerId = selectedVideoProviderId(job, providerRegistry);
    const capability = selectedVideoCapability(providerId, providerRegistry);
    const gate = buildVideoReadinessGate(shot, task, capability, audioPlanning, issues);
    readinessGates.push(gate);
    taskPlans.push(buildVideoTaskPlan(shot, task, gate, providerId, capability));
  }
  return {
    schemaVersion: "0.1.0",
    generatedAt,
    readinessGates,
    taskPlans,
    queueShell: buildVideoQueueShell(taskPlans),
    providerPolicySummary: {
      videoProvidersRemainParked: true,
      liveSubmitAllowed: false,
      userEnablementRequired: true,
      providerSubmissionForbidden: true,
      fastModelForbidden: true,
      vipChannelForbidden: true,
      textToVideoForbidden: true,
      parkedProviderIds: uniqueSorted(videoCapabilities(providerRegistry).map((capability) => capability.providerId)),
      notes: [
        "Seedance/Jimeng video providers remain parked.",
        "liveSubmitAllowed=false until a later explicit user enablement flow.",
        "Fast, VIP, and text-to-video paths are forbidden for the default formal video path.",
      ],
    },
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    notes: [
      "Phase 7.1 creates video provider readiness and queue-shell contracts only.",
      "No task is real-submit ready; providerSubmissionForbidden remains true.",
    ],
  };
}

const videoExecutionHardLocks = [
  "no_live_submit",
  "no_fast_model",
  "no_vip_channel",
  "no_text_to_video_main_path",
  "no_bgm_in_video_prompt",
  "start_end_frames_required",
  "subagent_must_use_packet",
];

const videoExecutionOrderPreview = [
  "prepare_subagent_packet",
  "inspect_readiness_gate",
  "compile_provider_adapter_payload_placeholder",
  "wait_for_user_enablement",
];

function fallbackGateStatus() {
  return {
    identity: "UNKNOWN",
    scene: "UNKNOWN",
    prop: "UNKNOWN",
    style: "UNKNOWN",
    pair: "UNKNOWN",
    story: "UNKNOWN",
  };
}

function videoExecutionPreviewStatus(taskPlan, gate) {
  if (taskPlan.status === "blocked" || gate?.status === "blocked" || taskPlan.blockers.length > 0 || (gate?.blockers?.length || 0) > 0) {
    return "blocked";
  }
  if (taskPlan.status === "parked" || taskPlan.providerSubmissionForbidden) return "parked";
  return "preview_ready";
}

function buildVideoSubagentPacketPreview(shot, taskPlan, gate, videoPlanning) {
  const keyframePairDerivation = gate?.keyframePairDerivation;
  return {
    selectedShot: {
      shotId: taskPlan.shotId,
      storyFunction: shot?.storyFunction,
      gateStatus: shot?.gates || fallbackGateStatus(),
      taskStatus: taskPlan.status,
      queueStatus: taskPlan.queueStatus,
    },
    startFrameRef: taskPlan.startFrameRef,
    endFrameRef: taskPlan.endFrameRef,
    keyframePairDerivation,
    providerPolicySummary: videoPlanning.providerPolicySummary,
    requiredReadScopes: [
      "ProjectRuntimeState.storyFlow.shots",
      "ProjectRuntimeState.videoPlanning.readinessGates",
      "ProjectRuntimeState.videoPlanning.taskPlans",
      "ProjectRuntimeState.videoPlanning.providerPolicySummary",
      "ProjectRuntimeState.audioPlanning.videoProviderPolicy",
      "ProjectRuntimeState.sourceIndex",
    ],
    forbiddenReadScopes: ["provider_credentials", "api_keys", "live_provider_task_ids", "outside_project_runtime_state", "unapproved_prompt_files"],
    mustPreserve: keyframePairDerivation?.mustPreserve || ["character identity", "scene layout", "style capsule"],
    allowedDelta: keyframePairDerivation?.allowedDelta || ["motion", "micro-expression", "camera movement"],
    mustNotAdd: keyframePairDerivation?.mustNotAdd || ["new characters", "unapproved props", "text-to-video fallback"],
    expectedOutputContract: {
      format: "video_execution_preview_v1",
      requiredFields: ["selectedShot", "startFrameRef", "endFrameRef", "keyframePairDerivation", "providerPolicySummary", "mustPreserve", "allowedDelta", "mustNotAdd"],
      artifactPolicy: "no_real_prompt_file_no_provider_task",
      resultScope: "structured_packet_preview_only",
    },
    requiredKnowledgeCategories: ["storyflow", "story_function", "camera", "performance", "provider", "qa"],
  };
}

function buildVideoSubagentTaskEnvelope(shot, task, taskPlan, gate, videoPlanning) {
  const keyframePairDerivation = gate?.keyframePairDerivation;
  const taskEnvelope = task.envelope;
  const injectedKnowledgePacks = taskEnvelope.injectedKnowledgePacks || [];
  const lockedReferences = (taskEnvelope.references || []).filter(
    (reference) => reference.lockedStatus === "locked" && reference.polarity === "positive" && reference.canUseAsFutureReference,
  );
  const forbiddenReferences = (taskEnvelope.references || []).filter(
    (reference) =>
      reference.lockedStatus === "rejected" ||
      reference.polarity === "negative" ||
      reference.referenceRole === "temp_candidate" ||
      !reference.canUseAsFutureReference,
  );

  return {
    id: `subagent_video_${safeId(taskPlan.shotId)}`,
    parentTaskId: taskEnvelope.id,
    purpose: "video_generation",
    contextLevel: "L2",
    sourceIndexHash: taskEnvelope.sourceIndexHash,
    sectionId: shot?.sectionId,
    shotId: taskPlan.shotId,
    storyFunction: shot?.storyFunction || taskEnvelope.storyFunction,
    userIntent: taskPlan.motionBrief,
    neighborShots: [],
    lockedReferences,
    forbiddenReferences,
    providerPolicySummary: [
      `slot=${taskPlan.providerSlot}`,
      `provider=${taskPlan.providerId}`,
      `state=${taskPlan.providerExecutionState}`,
      `mode=${taskPlan.requiredMode}`,
      ...videoPlanning.providerPolicySummary.notes,
    ],
    taskEnvelope,
    knowledgeRouteResultId: taskEnvelope.knowledgeRouteResultId,
    contextBudgetId: taskEnvelope.contextBudgetId,
    injectedKnowledgePacks,
    injectedKnowledgeSnippetIds: taskEnvelope.injectedKnowledgeSnippetIds || [],
    injectedKnowledgeSnippets: taskEnvelope.injectedKnowledgeSnippets || [],
    knowledgeInputHash: taskEnvelope.knowledgeInputHash,
    knowledgeManifestHash: taskEnvelope.knowledgeManifestHash,
    policyBinding: taskEnvelope.policyBinding,
    nonOverridableGateHashes: taskEnvelope.nonOverridableGateHashes,
    routeWarnings: taskEnvelope.routeWarnings || [],
    forbiddenKnowledgePacks: [],
    requiredKnowledgeCategories: ["storyflow", "story_function", "camera", "performance", "provider", "qa"],
    qaPackBindings: Object.fromEntries(
      injectedKnowledgePacks
        .filter((pack) => pack.consumer === "qa_gate")
        .map((pack) => [pack.packId, { version: pack.version, hash: pack.hash }]),
    ),
    allowedReadScopes: ["task_envelope", "locked_references", "injected_knowledge_snippets", "video_readiness_gate", "keyframe_pair_derivation"],
    disallowedReadScopes: ["unrouted_knowledge_library", "rejected_references", "failed_artifacts", "provider_credentials", "api_keys", "live_provider_task_ids"],
    sourceIndexRequired: true,
    mustInspectNeighborShotIds: [],
    authorityPriority: ["source_index", "provider_policy", "preflight", "identity", "scene", "pair", "story", "prop", "style"],
    resultMustReferencePackHashes: true,
    qaChecklist: taskEnvelope.qaChecklist,
    mustPreserve: keyframePairDerivation?.mustPreserve || ["character identity", "scene layout", "style capsule"],
    allowedDelta: keyframePairDerivation?.allowedDelta || ["motion", "micro-expression", "camera movement"],
    mustNotAdd: keyframePairDerivation?.mustNotAdd || ["new characters", "unapproved props", "text-to-video fallback"],
    expectedOutputContract: {
      format: "subagent_result_v1",
      requiredFields: [
        "taskId",
        "status",
        "inspectedFiles",
        "gates",
        "overallVisualVerdict",
        "styleQa",
        "motionQa",
        "continuityQa",
        "referenceUseDecision",
        "issues",
        "requiredFixes",
        "approvedFor",
        "rejectedFor",
        "summaryForMainAgent",
      ],
      severityLevels: ["P0", "P1", "P2"],
      gateFields: ["identity", "scene", "pair", "story", "prop", "style"],
    },
  };
}

function buildVideoExecutionPreviewState({ generatedAt, shots, videoPlanning, taskViews }) {
  const shotsById = new Map(shots.map((shot) => [shot.id, shot]));
  const gatesById = new Map(videoPlanning.readinessGates.map((gate) => [gate.gateId, gate]));
  const tasksByJobId = new Map(taskViews.map((task) => [task.job.id, task]));
  const previews = videoPlanning.taskPlans.flatMap((taskPlan) => {
    const task = tasksByJobId.get(taskPlan.jobId);
    if (!task) return [];

    const shot = shotsById.get(taskPlan.shotId);
    const gate = gatesById.get(taskPlan.readinessGateId);
    const status = videoExecutionPreviewStatus(taskPlan, gate);
    return {
      previewId: `video_execution_preview_${safeId(taskPlan.shotId)}`,
      shotId: taskPlan.shotId,
      taskPlanId: taskPlan.taskPlanId,
      readinessGateId: taskPlan.readinessGateId,
      status,
      providerId: taskPlan.providerId,
      providerSlot: "video.i2v",
      requiredMode: "frames2video",
      contextLevel: "L2",
      subagentPurpose: "video_generation",
      instructionSummary:
        status === "blocked"
          ? "Structured packet cannot be prepared until inherited readiness blockers clear."
          : "Structured packet may be inspected for a future parked I2V worker; provider handoff remains disabled.",
      subagentPacketPreview: buildVideoSubagentPacketPreview(shot, taskPlan, gate, videoPlanning),
      subagentTaskEnvelope: buildVideoSubagentTaskEnvelope(shot, task, taskPlan, gate, videoPlanning),
      executionOrderPreview: videoExecutionOrderPreview,
      hardLocks: videoExecutionHardLocks,
      blockers: uniqueSorted([...(gate?.blockers || []), ...taskPlan.blockers]),
      warnings: uniqueSorted([...(gate?.warnings || []), ...taskPlan.warnings, "Packet preview is read-only and waits for later user enablement before any adapter handoff."]),
      canPreviewPacket: status !== "blocked",
      canExecute: false,
      dryRunOnly: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
    };
  });

  return {
    schemaVersion: "0.1.0",
    generatedAt,
    previews,
    summary: {
      total: previews.length,
      blocked: previews.filter((preview) => preview.status === "blocked").length,
      previewReady: previews.filter((preview) => preview.status === "preview_ready").length,
      parked: previews.filter((preview) => preview.status === "parked").length,
      canPreviewPacket: previews.filter((preview) => preview.canPreviewPacket).length,
      canExecute: 0,
    },
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      "Phase 7.3 exposes structured subagent packet previews only.",
      "No command, provider handoff, or real prompt artifact is created by this state.",
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

function isExportWorkerPathAllowlisted(pathValue) {
  const normalized = String(pathValue || "").replace(/\\/g, "/");
  return Boolean(normalized)
    && !/^(?:[A-Za-z]:[\\/]|\/|\/\/)/.test(normalized)
    && !normalized.split("/").includes("..")
    && /^(?:exports|reports\/exports)(?:\/|$)/.test(normalized);
}

function buildExportWorkerState({ generatedAt, previewExport }) {
  const exportRoot = "exports/export-worker";
  const manifestPath = `${exportRoot}/export_manifest.json`;
  const profileEntries = [
    ["storyboard_table", "storyboard_table.tsv", "text/tab-separated-values", "storyboard_table"],
    ["developer_archive", "developer_archive.json", "application/json", "developer_archive"],
    ["rough_cut_timeline", "rough_cut_timeline.json", "application/json", "rough_cut"],
    ["asset_package_manifest", "asset_package_manifest.json", "application/json", "asset_package"],
  ];
  const documentEntries = profileEntries.map(([kind, fileName, mimeType, profileKind]) => {
    const content = JSON.stringify({
      schemaVersion: "0.1.0",
      kind,
      generatedAt,
      profile: previewExport.exportProfiles.find((item) => item.kind === profileKind),
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      renderMedia: false,
      copyFiles: false,
      moveFiles: false,
    }, null, 2) + "\n";
    return {
      id: `export_worker_${kind}`,
      kind,
      operation: "write_file",
      path: `${exportRoot}/${fileName}`,
      content,
      contentHash: hashString(content, "export_worker"),
      mimeType,
      canExecute: false,
      projectRootRelative: true,
      notes: ["Planned text manifest write only; no media render, provider submit, shell, credential IO, move, or delete."],
    };
  });
  const manifestContent = JSON.stringify({
    schemaVersion: "0.1.0",
    kind: "export_manifest",
    generatedAt,
    sourcePackagePlanId: previewExport.exportPackagePlan.planId,
    files: documentEntries.map((entry) => ({
      kind: entry.kind,
      path: entry.path,
      contentHash: entry.contentHash,
    })),
    providerSubmissionForbidden: true,
    mediaRenderAllowed: false,
  }, null, 2) + "\n";
  const writeEntries = [
    {
      id: "export_worker_export_manifest",
      kind: "export_manifest",
      operation: "write_file",
      path: manifestPath,
      content: manifestContent,
      contentHash: hashString(manifestContent, "export_worker"),
      mimeType: "application/json",
      canExecute: false,
      projectRootRelative: true,
      notes: ["Manifest write is planned only; adapter execution is not automatic."],
    },
    ...documentEntries,
  ];
  const directoryEntries = [
    {
      id: "export_worker_export_root",
      kind: "export_directory",
      operation: "create_directory",
      path: exportRoot,
      canExecute: false,
      projectRootRelative: true,
      notes: ["Directory creation is planned under the export/project IO contract only."],
    },
  ];
  const entries = [...directoryEntries, ...writeEntries];
  const blockers = uniqueSorted(entries.filter((entry) => !isExportWorkerPathAllowlisted(entry.path)).map((entry) => `export_worker_path_not_allowlisted:${entry.path}`));

  return {
    schemaVersion: "0.1.0",
    generatedAt,
    phase: "phase_27_export_worker_mvp",
    scope: "export_project_io_contract",
    rootRef: "project_root",
    exportRoot,
    executionMode: "plan_only",
    confirmationRequired: true,
    confirmed: false,
    readiness: blockers.length ? "blocked" : "planned",
    canExecute: false,
    entries,
    manifest: {
      manifestId: `export_worker_${hashString(`${generatedAt}:${exportRoot}`, "vci").replace(/^vci_/, "")}`,
      generatedAt,
      exportRoot,
      profileSelection: ["rough_cut", "asset_package", "storyboard_table", "developer_archive"],
      readiness: blockers.length ? "blocked" : "planned",
      writeFilesOnly: true,
      textOnly: true,
      allowedOperations: ["create_directory", "write_file"],
      allowedDirectories: directoryEntries.map((entry) => entry.path),
      allowedWritePaths: writeEntries.map((entry) => entry.path),
      files: documentEntries.map((entry) => ({
        kind: entry.kind,
        path: entry.path,
        contentHash: entry.contentHash,
      })),
      blockedProfileKinds: [],
      source: {
        schemaVersion: previewExport.schemaVersion,
        packagePlanId: previewExport.exportPackagePlan.planId,
        packageStatus: previewExport.exportPackagePlan.status,
        formalPreviewStatus: previewExport.formalPreview.status,
        draftPreviewStatus: previewExport.draftPreview.status,
      },
      notes: ["Manifest lists text export artifacts only; no media or NLE files are generated."],
    },
    blockers,
    warnings: ["Import runtime records the Phase 27 export worker plan only; it does not execute the adapter."],
    hardLocks: {
      projectRootRelativeOnly: true,
      exportScopeOnly: true,
      noAbsolutePath: true,
      noParentTraversal: true,
      noDelete: true,
      noMove: true,
      noMediaRender: true,
      noProviderSubmit: true,
      liveSubmitAllowed: false,
      noCredentialRead: true,
      noCredentialWrite: true,
      noArbitraryShell: true,
      noUserFileOverwriteOutsideExport: true,
    },
    notes: [
      "Export Worker MVP is a controlled Phase 27 IO contract layered on top of Preview Export planning.",
      "The default runtime state only plans export/report writes; a real adapter must be explicitly gated later.",
    ],
  };
}

function buildProjectRuntimeState(audit, knowledgeManifest, generatedAt) {
  const sourceIndex = buildSourceIndex(audit, knowledgeManifest);
  const sourceIndexSummary = summarizeSourceIndex(sourceIndex);
  const knowledgeSummary = buildKnowledgeSummary(knowledgeManifest);
  const taskViews = buildTaskStates(audit, sourceIndex, knowledgeManifest, generatedAt);
  const manifestMatches = manifestSummary(taskViews);
  const runtime = buildRuntimeEnvironment(generatedAt);
  const projectFileCore = buildProjectFileCoreState({
    generatedAt,
    projectRoot: audit.projectRoot,
    importedAt: audit.importedAt,
    sourceTask: audit.sourceTask,
    sourceIndex,
    shots: audit.shots,
    assets: audit.assets,
    runtime,
  });
  const providerRegistry = buildDefaultProviderRegistry(generatedAt);
  const promptPlanResults = taskViews.map((task) =>
    buildShotPromptPlan(
      task.job,
      audit.shots.find((shot) => shot.id === task.shotId),
      audit.assets,
      sourceIndex,
      providerRegistry,
      task.envelope.injectedKnowledgePacks,
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
  const videoPlanning = buildVideoPlanningState({
    generatedAt,
    shots: audit.shots,
    jobs: audit.jobs,
    taskViews,
    providerRegistry,
    audioPlanning,
    issues: audit.issues,
  });
  const videoExecutionPreview = buildVideoExecutionPreviewState({
    generatedAt,
    shots: audit.shots,
    videoPlanning,
    taskViews,
  });
  const adapterContracts = buildAdapterContractState(generatedAt, providerRegistry);
  const generationHarness = buildGenerationHarnessState({
    generatedAt,
    imageTaskPlans,
    promptPlans: promptPlanResults.map((result) => result.plan),
    promptConflictReports: promptPlanResults.map((result) => result.conflictReport),
    assetReadinessReports,
    image2AdapterRequests,
    watcherEvents,
    generationHealthReports,
    qaPromotionReports,
  });
  const filesystemWatcherHarness = buildFilesystemWatcherHarnessState({
    generatedAt,
    projectRoot: audit.projectRoot,
    fileSnapshot,
    manifestMatches: taskViews.map((task) => task.manifestMatch),
    imageTaskPlans,
    image2AdapterRequests,
    watcherEvents,
    generationHealthReports,
    qaPromotionReports,
    generationHarness,
  });
  const checkpointResumeHarness = buildCheckpointResumeHarnessState({
    generatedAt,
    fileSnapshot,
    manifestMatches: taskViews.map((task) => task.manifestMatch),
    imageTaskPlans,
    generationHealthReports,
    qaPromotionReports,
    generationHarness,
    filesystemWatcherHarness,
  });
  const qaHarness = buildQaHarnessState({
    generatedAt,
    generationHealthReports,
    qaPromotionReports,
    manifestMatches: taskViews.map((task) => task.manifestMatch),
    assetReadinessReports,
    promptPlans: promptPlanResults.map((result) => result.plan),
    promptConflictReports: promptPlanResults.map((result) => result.conflictReport),
    generationHarness,
    filesystemWatcherHarness,
    checkpointResumeHarness,
    videoPlanning,
    audioPlanning,
    storyFlowShots: audit.shots,
  });
  const toolRuntimeHarness = buildToolRuntimeHarnessState({
    generatedAt,
    runtime,
    adapterContracts,
    generationHarness,
    filesystemWatcherHarness,
    checkpointResumeHarness,
    qaHarness,
  });
  const subagentRunner = buildSubagentRunnerState({
    generatedAt,
    videoExecutionPreview,
    generationHarness,
    qaHarness,
  });
  const agentCliMockRunner = buildAgentCliMockRunnerState({
    generatedAt,
    taskViews,
  });
  const generationHealthChecker = buildGenerationHealthCheckerState({
    generatedAt,
    imageTaskPlans,
    generationHealthReports,
    manifestMatches: taskViews.map((task) => task.manifestMatch),
    watcherEvents,
    taskRuns: taskViews.map((task) => task.taskRun),
    jobs: audit.jobs,
    fileSnapshot,
  });
  const promptConflictChecker = buildPromptConflictCheckerState({
    generatedAt,
    promptPlans: promptPlanResults.map((result) => result.plan),
    promptConflictReports: promptPlanResults.map((result) => result.conflictReport),
    shots: audit.shots,
    assets: audit.assets,
    jobs: audit.jobs,
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
  const exportWorker = buildExportWorkerState({
    generatedAt,
    projectRoot: audit.projectRoot,
    previewExport,
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
    projectFileCore,
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
    exportWorker,
    audioPlanning,
    videoPlanning,
    videoExecutionPreview,
    adapterContracts,
    generationHarness,
    filesystemWatcherHarness,
    checkpointResumeHarness,
    qaHarness,
    toolRuntimeHarness,
    subagentRunner,
    agentCliMockRunner,
    generationHealthChecker,
    promptConflictChecker,
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
if (!runtimeState.voiceSourceLibrary) {
  const { buildVoiceSourceLibraryState, toRuntimeVoiceSources } = await importTs("src/core/voiceSourceLibrary.ts");
  runtimeState.voiceSourceLibrary = buildVoiceSourceLibraryState({
    generatedAt: runtimeState.generatedAt,
    runtimeVoiceSources: runtimeState.runtime.config.voiceSources,
  });
  runtimeState.runtime.config.voiceSources = toRuntimeVoiceSources(runtimeState.voiceSourceLibrary);
  runtimeState.audioPlanning.voiceSourceRegistry.sources = runtimeState.runtime.config.voiceSources;
  runtimeState.audioPlanning.voiceSourceRegistry.sourceCount = runtimeState.runtime.config.voiceSources.length;
  runtimeState.audioPlanning.voiceSourceRegistry.placeholderCount = runtimeState.runtime.config.voiceSources.filter((source) => source.status === "placeholder").length;
  runtimeState.audioPlanning.voiceSourceRegistry.plannedCount = runtimeState.runtime.config.voiceSources.filter((source) => source.status === "planned").length;
  runtimeState.audioPlanning.voiceSourceRegistry.unavailableCount = runtimeState.runtime.config.voiceSources.filter((source) => source.status === "unavailable").length;
}
if (!runtimeState.voiceAudioSettings) {
  const { buildVoiceAudioSettingsState: buildCoreVoiceAudioSettingsState } = await importTs("src/core/voiceAudioSettings.ts");
  runtimeState.voiceAudioSettings = buildCoreVoiceAudioSettingsState({
    generatedAt: runtimeState.generatedAt,
    voiceSourceLibrary: runtimeState.voiceSourceLibrary,
    audioPlanning: runtimeState.audioPlanning,
  });
}
if (!runtimeState.imageKeyframeRuntime) {
  const { buildImageKeyframeRuntimePlan } = await importTs("src/core/imageKeyframeRuntime.ts");
  runtimeState.imageKeyframeRuntime = buildImageKeyframeRuntimePlan({
    generatedAt: runtimeState.generatedAt,
    sourceIndex: runtimeState.sourceIndex,
    assets: audit.assets,
    assetReadinessReports: runtimeState.imagePipeline.assetReadinessReports,
    jobs: audit.jobs,
    promptPlans: runtimeState.imagePipeline.promptPlans,
    imageTaskPlans: runtimeState.imagePipeline.imageTaskPlans,
    keyframePairs: runtimeState.videoPlanning.readinessGates
      .map((gate) => gate.keyframePairDerivation)
      .filter(Boolean),
  });
}
if (!runtimeState.providerLiveGate) {
  const { buildProviderLiveGateState } = await importTs("src/core/providerLiveGate.ts");
  runtimeState.providerLiveGate = buildProviderLiveGateState({
    generatedAt: runtimeState.generatedAt,
    providerRegistry: runtimeState.imagePipeline.providerRegistry,
    adapterContracts: runtimeState.adapterContracts,
    imageTaskPlans: runtimeState.imagePipeline.imageTaskPlans,
    image2AdapterRequests: runtimeState.imagePipeline.image2AdapterRequests,
    assetReadinessReports: runtimeState.imagePipeline.assetReadinessReports,
    shots: runtimeState.storyFlow.shots,
    videoPlanning: runtimeState.videoPlanning,
    videoExecutionPreview: runtimeState.videoExecutionPreview,
    audioPlanning: runtimeState.audioPlanning,
    envelopeFacts: runtimeState.taskRuns.taskViews.map((task) => ({
      taskPlanId: task.job.id,
      envelopeId: task.envelope.id,
      schemaName: "TaskEnvelope",
      valid: task.validator.valid,
      blockers: task.validator.valid ? [] : task.validator.issues,
      warnings: [],
    })),
    confirmationTokens: [],
  });
}
if (!runtimeState.providerExecutionPermissionGate) {
  const { buildProviderExecutionPermissionGateState } = await importTs("src/core/providerExecutionPermissionGate.ts");
  runtimeState.providerExecutionPermissionGate = buildProviderExecutionPermissionGateState({
    generatedAt: runtimeState.generatedAt,
    providerLiveGate: runtimeState.providerLiveGate,
    codexCliAdapterSpike: runtimeState.codexCliAdapterSpike,
  });
}
if (!runtimeState.providerActionConfirmationReceipt) {
  const { buildProviderActionConfirmationReceiptState } = await importTs("src/core/providerActionConfirmationReceipt.ts");
  runtimeState.providerActionConfirmationReceipt = buildProviderActionConfirmationReceiptState({
    generatedAt: runtimeState.generatedAt,
    providerExecutionPermissionGate: runtimeState.providerExecutionPermissionGate,
  });
}
if (!runtimeState.providerExecutionHandoff) {
  const { buildProviderExecutionHandoffState } = await importTs("src/core/providerExecutionHandoff.ts");
  runtimeState.providerExecutionHandoff = buildProviderExecutionHandoffState({
    generatedAt: runtimeState.generatedAt,
    providerActionConfirmationReceipt: runtimeState.providerActionConfirmationReceipt,
  });
}
if (!runtimeState.localOrchestrator) {
  const { buildLocalOrchestratorState } = await importTs("src/core/localOrchestrator.ts");
  const taskPackets = runtimeState.imagePipeline.imageTaskPlans.map((taskPlan, index) => {
    const task = runtimeState.taskRuns.taskViews.find(
      (item) =>
        item.job.id === taskPlan.jobId ||
        item.envelope.id === taskPlan.taskEnvelopeSummary?.envelopeId ||
        item.envelope.preflight.taskId === taskPlan.taskEnvelopeSummary?.envelopeId,
    );
    return {
      packetId: `local_orchestrator_packet_${taskPlan.taskPlanId}`,
      taskPlanId: taskPlan.taskPlanId,
      jobId: taskPlan.jobId,
      shotId: taskPlan.shotId,
      envelopeId: task?.envelope.id || taskPlan.taskEnvelopeSummary?.envelopeId,
      taskKind: taskPlan.providerSlot,
      expectedOutputs: [taskPlan.expectedOutputPath],
      dependencies: task?.envelope.dependencies || [],
      priority: index,
      queueOrder: index,
      blocked: taskPlan.status === "blocked" || taskPlan.blockers.length > 0,
      blockers: taskPlan.blockers,
      warnings: taskPlan.warnings,
      sourceRefs: [
        `imageTaskPlan:${taskPlan.taskPlanId}`,
        `job:${taskPlan.jobId}`,
        ...(task?.envelope.id ? [`taskEnvelope:${task.envelope.id}`] : []),
        ...(task?.taskRun.taskId ? [`taskRun:${task.taskRun.taskId}`] : []),
      ],
    };
  });
  runtimeState.localOrchestrator = buildLocalOrchestratorState({
    generatedAt: runtimeState.generatedAt,
    taskPackets,
    taskEnvelopes: runtimeState.taskRuns.taskViews.map((task) => task.envelope),
    taskRuns: runtimeState.taskRuns.taskViews.map((task) => task.taskRun),
    generationHarness: runtimeState.generationHarness,
    filesystemWatcherHarness: runtimeState.filesystemWatcherHarness,
    checkpointResumeHarness: runtimeState.checkpointResumeHarness,
    qaHarness: runtimeState.qaHarness,
    subagentRunner: runtimeState.subagentRunner,
    options: { autoContinue: true, concurrency: 1, now: runtimeState.generatedAt },
  });
}

assert(runtimeState.providerLiveGate, "runtime-state must include providerLiveGate");
assert(runtimeState.providerLiveGate.phase === "phase_11_provider_adapter_live_gate", "providerLiveGate must remain the provider live gate evidence source");
assert(runtimeState.providerLiveGate.summary.providerSubmitAllowed === 0, "providerLiveGate must not allow provider submit");
assert(runtimeState.providerLiveGate.summary.liveSubmitAllowed === false, "providerLiveGate live submit must be false");
assert(runtimeState.providerLiveGate.summary.credentialStorage === false, "providerLiveGate credential storage must be false");
assert(runtimeState.providerLiveGate.phase30Evidence.canSubmitProvider === false, "providerLiveGate Phase 30 evidence must keep canSubmitProvider=false");
assert(runtimeState.providerLiveGate.phase30Evidence.providerSubmitAllowed === 0, "providerLiveGate Phase 30 evidence must keep providerSubmitAllowed=0");
assert(runtimeState.providerLiveGate.phase30Evidence.liveSubmitAllowed === false, "providerLiveGate Phase 30 evidence must keep liveSubmitAllowed=false");
assert(runtimeState.providerLiveGate.phase30Evidence.credentialStorage === false, "providerLiveGate Phase 30 evidence must keep credentialStorage=false");
assert(runtimeState.providerLiveGate.phase30Evidence.forbiddenProviderModesAbsent === true, "providerLiveGate Phase 30 evidence must keep forbidden modes absent");
assert(runtimeState.providerLiveGate.items.every((item) => item.canSubmitProvider === false), "providerLiveGate items must never submit providers");
assert(runtimeState.providerLiveGate.items.every((item) => item.liveSubmitAllowed === false), "providerLiveGate items must keep liveSubmitAllowed=false");
assert(runtimeState.providerLiveGate.items.every((item) => item.livePathBlocked === true), "providerLiveGate items must keep livePathBlocked=true until a later final gate");
for (const key of [
  "dryRunOnly",
  "readOnly",
  "readinessPlanOnly",
  "confirmationPlanOnly",
  "providerSubmissionForbidden",
  "noCredentialRead",
  "noCredentialWrite",
  "noApiKeyCreation",
  "noProviderSubmit",
  "noArbitraryProviderCommand",
  "fastModelForbidden",
  "vipChannelForbidden",
  "textToVideoMainPathForbidden",
  "bgmInVideoPromptForbidden",
]) {
  assert(runtimeState.providerLiveGate.hardLocks[key] === true, `providerLiveGate hard lock ${key} must be true`);
}
assert(runtimeState.providerLiveGate.hardLocks.liveSubmitAllowed === false, "providerLiveGate live submit hard lock must be false");
assert(runtimeState.providerLiveGate.hardLocks.credentialStorage === false, "providerLiveGate credential storage hard lock must be false");
assert(runtimeState.providerExecutionPermissionGate, "runtime-state must include providerExecutionPermissionGate");
assert(runtimeState.providerExecutionPermissionGate.phase === "phase_31_provider_execution_permission_gate", "providerExecutionPermissionGate must be Phase 31 evidence");
assert(runtimeState.providerExecutionPermissionGate.summary.providerSubmitAllowed === 0, "providerExecutionPermissionGate must not allow provider submit");
assert(runtimeState.providerExecutionPermissionGate.summary.liveSubmitAllowed === false, "providerExecutionPermissionGate live submit must be false");
assert(runtimeState.providerExecutionPermissionGate.summary.credentialAccessAllowed === false, "providerExecutionPermissionGate credential access must be false");
assert(runtimeState.providerExecutionPermissionGate.summary.automaticSubmitAllowed === false, "providerExecutionPermissionGate automatic submit must be false");
assert(runtimeState.providerExecutionPermissionGate.phase31Evidence.canSubmitProvider === false, "Phase 31 evidence must keep canSubmitProvider=false");
assert(runtimeState.providerExecutionPermissionGate.phase31Evidence.providerSubmitAllowed === 0, "Phase 31 evidence must keep providerSubmitAllowed=0");
assert(runtimeState.providerExecutionPermissionGate.phase31Evidence.liveSubmitAllowed === false, "Phase 31 evidence must keep liveSubmitAllowed=false");
assert(runtimeState.providerExecutionPermissionGate.phase31Evidence.credentialAccessAllowed === false, "Phase 31 evidence must keep credential access false");
assert(runtimeState.providerExecutionPermissionGate.phase31Evidence.noWorkerSpawn === true, "Phase 31 evidence must block worker spawn");
assert(runtimeState.providerExecutionPermissionGate.phase31Evidence.noFileMutation === true, "Phase 31 evidence must block file mutation");
assert(runtimeState.providerExecutionPermissionGate.requests.every((item) => item.canSubmitProvider === false), "Phase 31 requests must never submit providers");
assert(runtimeState.providerExecutionPermissionGate.requests.every((item) => item.providerSubmitAllowed === 0), "Phase 31 requests must keep providerSubmitAllowed=0");
assert(runtimeState.providerExecutionPermissionGate.requests.every((item) => item.userConfirmedAtActionTime === false), "Phase 31 requests must not pre-confirm action-time approval");
for (const key of [
  "dryRunOnly",
  "readOnly",
  "reviewPlanOnly",
  "actionTimeConfirmationRequired",
  "providerSubmissionForbidden",
  "noCredentialRead",
  "noCredentialWrite",
  "noApiKeyCreation",
  "noArbitraryProviderCommand",
  "noWorkerSpawn",
  "noFileMutation",
  "fastModelForbidden",
  "vipChannelForbidden",
  "textToVideoMainPathForbidden",
  "bgmInVideoPromptForbidden",
]) {
  assert(runtimeState.providerExecutionPermissionGate.hardLocks[key] === true, `providerExecutionPermissionGate hard lock ${key} must be true`);
}
assert(runtimeState.providerExecutionPermissionGate.hardLocks.canSubmitProvider === false, "providerExecutionPermissionGate canSubmitProvider lock must be false");
assert(runtimeState.providerExecutionPermissionGate.hardLocks.providerSubmitAllowed === 0, "providerExecutionPermissionGate providerSubmitAllowed lock must be 0");
assert(runtimeState.providerExecutionPermissionGate.hardLocks.liveSubmitAllowed === false, "providerExecutionPermissionGate live submit hard lock must be false");
assert(runtimeState.providerExecutionPermissionGate.hardLocks.credentialAccessAllowed === false, "providerExecutionPermissionGate credential access hard lock must be false");
assert(runtimeState.providerExecutionPermissionGate.hardLocks.credentialStorage === false, "providerExecutionPermissionGate credential storage hard lock must be false");
assert(runtimeState.providerActionConfirmationReceipt, "runtime-state must include providerActionConfirmationReceipt");
assert(runtimeState.providerActionConfirmationReceipt.phase === "phase_32_action_time_confirmation_receipt", "providerActionConfirmationReceipt must be Phase 32 evidence");
assert(runtimeState.providerActionConfirmationReceipt.summary.confirmedReceiptCount === 0, "Phase 32 receipts must start unconfirmed");
assert(runtimeState.providerActionConfirmationReceipt.summary.userConfirmedAtActionTime === false, "Phase 32 must not pre-confirm action-time user approval");
assert(runtimeState.providerActionConfirmationReceipt.summary.providerSubmitAllowed === 0, "Phase 32 must not allow provider submit");
assert(runtimeState.providerActionConfirmationReceipt.summary.liveSubmitAllowed === false, "Phase 32 live submit must be false");
assert(runtimeState.providerActionConfirmationReceipt.summary.credentialAccessAllowed === false, "Phase 32 credential access must be false");
assert(runtimeState.providerActionConfirmationReceipt.summary.automaticSubmitAllowed === false, "Phase 32 automatic submit must be false");
assert(runtimeState.providerActionConfirmationReceipt.phase32Evidence.typedEvidencePresent === true, "Phase 32 evidence must be typed");
assert(runtimeState.providerActionConfirmationReceipt.phase32Evidence.phase31GateConsumed === true, "Phase 32 must consume Phase 31 evidence");
assert(runtimeState.providerActionConfirmationReceipt.phase32Evidence.confirmedReceiptCount === 0, "Phase 32 typed evidence must start with zero confirmed receipts");
assert(runtimeState.providerActionConfirmationReceipt.phase32Evidence.actionTimeConfirmationRequired === true, "Phase 32 must require action-time confirmation");
assert(runtimeState.providerActionConfirmationReceipt.phase32Evidence.finalExecutionGateRequired === true, "Phase 32 must require a later final execution gate");
assert(runtimeState.providerActionConfirmationReceipt.phase32Evidence.canSubmitProvider === false, "Phase 32 must keep canSubmitProvider=false");
assert(runtimeState.providerActionConfirmationReceipt.phase32Evidence.providerSubmitAllowed === 0, "Phase 32 evidence must keep providerSubmitAllowed=0");
assert(runtimeState.providerActionConfirmationReceipt.phase32Evidence.liveSubmitAllowed === false, "Phase 32 evidence must keep liveSubmitAllowed=false");
assert(runtimeState.providerActionConfirmationReceipt.phase32Evidence.credentialAccessAllowed === false, "Phase 32 evidence must keep credential access false");
assert(runtimeState.providerActionConfirmationReceipt.phase32Evidence.noWorkerSpawn === true, "Phase 32 evidence must block worker spawn");
assert(runtimeState.providerActionConfirmationReceipt.phase32Evidence.noFileMutation === true, "Phase 32 evidence must block file mutation");
assert(runtimeState.providerActionConfirmationReceipt.requests.every((item) => item.confirmationReceiptRequired === true), "Phase 32 requests must require confirmation receipts");
assert(runtimeState.providerActionConfirmationReceipt.requests.every((item) => item.userConfirmedAtActionTime === false), "Phase 32 requests must not pre-confirm action-time approval");
assert(runtimeState.providerActionConfirmationReceipt.requests.every((item) => item.confirmedReceiptCount === 0), "Phase 32 requests must start with zero confirmed receipts");
assert(runtimeState.providerActionConfirmationReceipt.requests.every((item) => item.canSubmitProvider === false), "Phase 32 requests must never submit providers");
assert(runtimeState.providerActionConfirmationReceipt.requests.every((item) => item.providerSubmitAllowed === 0), "Phase 32 requests must keep providerSubmitAllowed=0");
assert(runtimeState.providerActionConfirmationReceipt.receipts.every((item) => item.placeholderPresent === true), "Phase 32 receipts must be placeholders");
assert(runtimeState.providerActionConfirmationReceipt.receipts.every((item) => item.confirmed === false), "Phase 32 receipts must not be confirmed by default");
assert(runtimeState.providerActionConfirmationReceipt.receipts.every((item) => item.canSubmitProvider === false), "Phase 32 receipts must never submit providers");
for (const key of [
  "dryRunOnly",
  "readOnly",
  "reviewShellOnly",
  "receiptPlanOnly",
  "actionTimeConfirmationRequired",
  "finalExecutionGateRequired",
  "providerSubmissionForbidden",
  "noCredentialRead",
  "noCredentialWrite",
  "noApiKeyCreation",
  "noArbitraryProviderCommand",
  "noWorkerSpawn",
  "noFileMutation",
  "fastModelForbidden",
  "vipChannelForbidden",
  "textToVideoMainPathForbidden",
  "bgmInVideoPromptForbidden",
]) {
  assert(runtimeState.providerActionConfirmationReceipt.hardLocks[key] === true, `providerActionConfirmationReceipt hard lock ${key} must be true`);
}
assert(runtimeState.providerActionConfirmationReceipt.hardLocks.canSubmitProvider === false, "providerActionConfirmationReceipt canSubmitProvider lock must be false");
assert(runtimeState.providerActionConfirmationReceipt.hardLocks.providerSubmitAllowed === 0, "providerActionConfirmationReceipt providerSubmitAllowed lock must be 0");
assert(runtimeState.providerActionConfirmationReceipt.hardLocks.liveSubmitAllowed === false, "providerActionConfirmationReceipt live submit hard lock must be false");
assert(runtimeState.providerActionConfirmationReceipt.hardLocks.credentialAccessAllowed === false, "providerActionConfirmationReceipt credential access hard lock must be false");
assert(runtimeState.providerActionConfirmationReceipt.hardLocks.automaticSubmitAllowed === false, "providerActionConfirmationReceipt automatic submit hard lock must be false");
assert(runtimeState.providerActionConfirmationReceipt.hardLocks.credentialStorage === false, "providerActionConfirmationReceipt credential storage hard lock must be false");
assert(runtimeState.providerExecutionHandoff, "runtime-state must include providerExecutionHandoff");
assert(runtimeState.providerExecutionHandoff.phase === "phase_33_provider_execution_handoff", "providerExecutionHandoff must be Phase 33 evidence");
assert(runtimeState.providerExecutionHandoff.summary.totalHandoffs === runtimeState.providerActionConfirmationReceipt.requests.length, "Phase 33 must mirror Phase 32 receipt requests into handoff items");
assert(runtimeState.providerExecutionHandoff.summary.readyForFinalUserHandoffReview === 0, "Phase 33 default import fixture must not be ready for final handoff review");
assert(runtimeState.providerExecutionHandoff.summary.confirmedReceiptCountObserved === 0, "Phase 33 default import fixture must observe zero confirmed receipts");
assert(runtimeState.providerExecutionHandoff.summary.userConfirmedAtActionTimeObserved === false, "Phase 33 default import fixture must not observe action-time user confirmation");
assert(runtimeState.providerExecutionHandoff.summary.providerSubmitAllowed === 0, "Phase 33 must not allow provider submit");
assert(runtimeState.providerExecutionHandoff.summary.liveSubmitAllowed === false, "Phase 33 live submit must be false");
assert(runtimeState.providerExecutionHandoff.summary.credentialAccessAllowed === false, "Phase 33 credential access must be false");
assert(runtimeState.providerExecutionHandoff.summary.automaticSubmitAllowed === false, "Phase 33 automatic submit must be false");
assert(runtimeState.providerExecutionHandoff.summary.canSpawnWorker === false, "Phase 33 worker spawn must be false");
assert(runtimeState.providerExecutionHandoff.summary.fileMutationAllowed === false, "Phase 33 file mutation must be false");
assert(runtimeState.providerExecutionHandoff.summary.handoffPlanOnly === true, "Phase 33 must remain handoff-plan-only");
assert(runtimeState.providerExecutionHandoff.summary.finalActionGateRequired === true, "Phase 33 must require a final action gate");
assert(runtimeState.providerExecutionHandoff.phase33Evidence.typedEvidencePresent === true, "Phase 33 evidence must be typed");
assert(runtimeState.providerExecutionHandoff.phase33Evidence.phase32ReceiptStateConsumed === true, "Phase 33 must consume Phase 32 receipt evidence");
assert(runtimeState.providerExecutionHandoff.phase33Evidence.confirmedReceiptCountObserved === 0, "Phase 33 typed evidence must observe zero confirmed receipts by default");
assert(runtimeState.providerExecutionHandoff.phase33Evidence.userConfirmedAtActionTimeObserved === false, "Phase 33 typed evidence must not observe user confirmation by default");
assert(runtimeState.providerExecutionHandoff.phase33Evidence.allPhase32ProviderRoutesClosed === true, "Phase 33 must observe Phase 32 provider routes still closed");
assert(runtimeState.providerExecutionHandoff.phase33Evidence.canSubmitProvider === false, "Phase 33 must keep canSubmitProvider=false");
assert(runtimeState.providerExecutionHandoff.phase33Evidence.providerSubmitAllowed === 0, "Phase 33 evidence must keep providerSubmitAllowed=0");
assert(runtimeState.providerExecutionHandoff.phase33Evidence.liveSubmitAllowed === false, "Phase 33 evidence must keep liveSubmitAllowed=false");
assert(runtimeState.providerExecutionHandoff.phase33Evidence.credentialAccessAllowed === false, "Phase 33 evidence must keep credential access false");
assert(runtimeState.providerExecutionHandoff.phase33Evidence.automaticSubmitAllowed === false, "Phase 33 evidence must keep automatic submit false");
assert(runtimeState.providerExecutionHandoff.phase33Evidence.canSpawnWorker === false, "Phase 33 evidence must block worker spawn");
assert(runtimeState.providerExecutionHandoff.phase33Evidence.fileMutationAllowed === false, "Phase 33 evidence must block file mutation");
assert(runtimeState.providerExecutionHandoff.handoffs.every((item) => item.canSubmitProvider === false), "Phase 33 handoffs must never submit providers");
assert(runtimeState.providerExecutionHandoff.handoffs.every((item) => item.providerSubmitAllowed === 0), "Phase 33 handoffs must keep providerSubmitAllowed=0");
assert(runtimeState.providerExecutionHandoff.handoffs.every((item) => item.liveSubmitAllowed === false), "Phase 33 handoffs must keep liveSubmitAllowed=false");
assert(runtimeState.providerExecutionHandoff.handoffs.every((item) => item.credentialAccessAllowed === false), "Phase 33 handoffs must keep credential access false");
assert(runtimeState.providerExecutionHandoff.handoffs.every((item) => item.automaticSubmitAllowed === false), "Phase 33 handoffs must keep automatic submit false");
assert(runtimeState.providerExecutionHandoff.handoffs.every((item) => item.canSpawnWorker === false), "Phase 33 handoffs must block worker spawn");
assert(runtimeState.providerExecutionHandoff.handoffs.every((item) => item.fileMutationAllowed === false), "Phase 33 handoffs must block file mutation");
assert(runtimeState.providerExecutionHandoff.handoffs.every((item) => item.receiptConfirmed === false), "Phase 33 default handoffs must not mark receipts confirmed");
for (const key of [
  "dryRunOnly",
  "readOnly",
  "handoffPlanOnly",
  "finalActionGateRequired",
  "noProviderSubmit",
  "noCredentialRead",
  "noCredentialWrite",
  "noApiKeyCreation",
  "noArbitraryProviderCommand",
  "noWorkerSpawn",
  "noFileMutation",
  "fastModelForbidden",
  "vipChannelForbidden",
  "textToVideoMainPathForbidden",
  "bgmInVideoPromptForbidden",
]) {
  assert(runtimeState.providerExecutionHandoff.hardLocks[key] === true, `providerExecutionHandoff hard lock ${key} must be true`);
}
assert(runtimeState.providerExecutionHandoff.hardLocks.canSubmitProvider === false, "providerExecutionHandoff canSubmitProvider lock must be false");
assert(runtimeState.providerExecutionHandoff.hardLocks.providerSubmitAllowed === 0, "providerExecutionHandoff providerSubmitAllowed lock must be 0");
assert(runtimeState.providerExecutionHandoff.hardLocks.liveSubmitAllowed === false, "providerExecutionHandoff live submit hard lock must be false");
assert(runtimeState.providerExecutionHandoff.hardLocks.credentialAccessAllowed === false, "providerExecutionHandoff credential access hard lock must be false");
assert(runtimeState.providerExecutionHandoff.hardLocks.automaticSubmitAllowed === false, "providerExecutionHandoff automatic submit hard lock must be false");
assert(runtimeState.providerExecutionHandoff.hardLocks.canSpawnWorker === false, "providerExecutionHandoff worker spawn hard lock must be false");
assert(runtimeState.providerExecutionHandoff.hardLocks.fileMutationAllowed === false, "providerExecutionHandoff file mutation hard lock must be false");
assert(runtimeState.localOrchestrator, "runtime-state must include localOrchestrator");
assert(runtimeState.localOrchestrator.dryRunOnly === true, "localOrchestrator must be dry-run only");
assert(runtimeState.localOrchestrator.planOnly === true, "localOrchestrator must be plan-only");
assert(runtimeState.localOrchestrator.providerSubmissionForbidden === true, "localOrchestrator must forbid provider submission");
assert(runtimeState.localOrchestrator.liveSubmitAllowed === false, "localOrchestrator live submit must be false");
assert(runtimeState.localOrchestrator.noFileMutation === true, "localOrchestrator must forbid file mutation");
assert(runtimeState.localOrchestrator.daemonStarted === false, "localOrchestrator must not start a daemon");
assert(runtimeState.localOrchestrator.queue.length > 0, "localOrchestrator must derive queue items from runtime task facts");
assert(runtimeState.localOrchestrator.queue.every((item) => item.canExecute === false), "localOrchestrator queue items must never execute");
assert(runtimeState.localOrchestrator.queue.every((item) => item.canSpawnCodex === false), "localOrchestrator queue items must never spawn Codex");
assert(runtimeState.localOrchestrator.queue.every((item) => item.providerSubmissionForbidden === true), "localOrchestrator queue items must forbid provider submission");
assert(runtimeState.localOrchestrator.queue.every((item) => item.liveSubmitAllowed === false), "localOrchestrator queue items must keep liveSubmitAllowed=false");
assert(runtimeState.localOrchestrator.queue.every((item) => item.noFileMutation === true), "localOrchestrator queue items must forbid file mutation");
assert(runtimeState.localOrchestrator.autoContinuePlan.mode === "plan_only", "localOrchestrator auto-continue must stay plan_only");
for (const key of [
  "dryRunOnly",
  "planOnly",
  "noDaemon",
  "noSpawnCodex",
  "noSubprocess",
  "noShellExecution",
  "noProviderExecution",
  "providerSubmissionForbidden",
  "noFileMutation",
  "noCredentialRead",
  "workerSelfReportCannotComplete",
  "expectedOutputRequired",
  "manifestRequired",
  "qaGateRequired",
]) {
  assert(runtimeState.localOrchestrator.hardLocks[key] === true, `localOrchestrator hard lock ${key} must be true`);
}
assert(runtimeState.localOrchestrator.hardLocks.daemonStarted === false, "localOrchestrator daemonStarted hard lock must be false");
assert(runtimeState.localOrchestrator.hardLocks.liveSubmitAllowed === false, "localOrchestrator live submit hard lock must be false");
assert(runtimeState.voiceAudioSettings, "runtime-state must include voiceAudioSettings");
assert(runtimeState.voiceAudioSettings.phase === "phase_28_voice_audio_settings_ui", "voiceAudioSettings must be Phase 28 evidence");
assert(runtimeState.voiceAudioSettings.scope === "voice_audio_project_facts", "voiceAudioSettings scope must stay project facts only");
assert(runtimeState.voiceAudioSettings.settingsOnly === true, "voiceAudioSettings must stay settings-only");
assert(runtimeState.voiceAudioSettings.providerSubmissionForbidden === true, "voiceAudioSettings must forbid provider submission");
assert(runtimeState.voiceAudioSettings.liveSubmitAllowed === false, "voiceAudioSettings live submit must be false");
assert(runtimeState.voiceAudioSettings.videoProviderAudioPolicy.noBgmForVideoProvider === true, "voiceAudioSettings must require no BGM for video provider");
assert(runtimeState.voiceAudioSettings.videoProviderAudioPolicy.bgmIncludedInVideoPrompt === false, "voiceAudioSettings must not include BGM in video prompts");
assert(runtimeState.voiceAudioSettings.videoProviderAudioPolicy.musicAllowed === false, "voiceAudioSettings video policy must keep musicAllowed=false");
assert(runtimeState.voiceAudioSettings.settingsControls.addVoiceSourceMode === "metadata_only", "voiceAudioSettings must keep voice source additions metadata-only");
assert(runtimeState.voiceAudioSettings.settingsControls.credentialsMode === "not_read_or_stored", "voiceAudioSettings must not read or store credentials");
assert(runtimeState.voiceAudioSettings.settingsControls.sampleAudioMode === "metadata_reference_only", "voiceAudioSettings must not copy sample audio");
assert(runtimeState.voiceAudioSettings.settingsControls.fileMutationMode === "blocked", "voiceAudioSettings file mutation must stay blocked");
assert(runtimeState.voiceAudioSettings.blockers.length === 0, "voiceAudioSettings import fixture must not carry blockers");
for (const key of [
  "settingsOnly",
  "noProviderSubmit",
  "noTtsSubmit",
  "noMusicSubmit",
  "noCredentialRead",
  "noCredentialWrite",
  "noSecretStorage",
  "noFileMutation",
  "noSampleAudioCopy",
  "noBgmInVideoProvider",
  "noVideoProviderBgmPrompt",
]) {
  assert(runtimeState.voiceAudioSettings.hardLocks[key] === true, `voiceAudioSettings hard lock ${key} must be true`);
}
assert(runtimeState.voiceAudioSettings.hardLocks.liveSubmitAllowed === false, "voiceAudioSettings live submit hard lock must be false");

assert(runtimeState.agentCliMockRunner, "runtime-state must include agentCliMockRunner");
assert(runtimeState.agentCliMockRunner.phase === "phase_26_agent_cli_mock_runner", "agentCliMockRunner must be Phase 26 evidence");
assert(runtimeState.agentCliMockRunner.runnerKind === "mock_noop", "agentCliMockRunner must stay mock/no-op");
assert(runtimeState.agentCliMockRunner.purpose === "prove_replaceable_runner_contract", "agentCliMockRunner purpose must prove replaceability");
assert(runtimeState.agentCliMockRunner.adapterBoundary.providerSubmitAllowed === false, "agentCliMockRunner must not submit providers");
assert(runtimeState.agentCliMockRunner.adapterBoundary.shellAllowed === false, "agentCliMockRunner must not execute shell");
assert(runtimeState.agentCliMockRunner.adapterBoundary.fileMutationAllowed === false, "agentCliMockRunner must not mutate files");
assert(runtimeState.agentCliMockRunner.noopResults.every((result) => result.notRealExecution === true), "agentCliMockRunner results must be marked not real execution");
assert(!runtimeState.agentCliMockRunner.validation.errors.some((error) => /provider_submit_attempt_blocked|free_text_prompt_attempt_blocked/.test(error)), "agentCliMockRunner must not observe provider submit or free-text attempts");
for (const key of [
  "noCodexSpawn",
  "noCodexResume",
  "noProviderSubmit",
  "noShellExecution",
  "noCredentialRead",
  "noCredentialWrite",
  "noFileMutation",
]) {
  assert(runtimeState.agentCliMockRunner.hardLocks[key] === true, `agentCliMockRunner hard lock ${key} must be true`);
}

assert(runtimeState.exportWorker, "runtime-state must include exportWorker");
assert(runtimeState.exportWorker.phase === "phase_27_export_worker_mvp", "exportWorker must be Phase 27 evidence");
assert(runtimeState.exportWorker.scope === "export_project_io_contract", "exportWorker scope must be export_project_io_contract");
assert(runtimeState.exportWorker.executionMode === "plan_only", "exportWorker must default to plan_only");
assert(runtimeState.exportWorker.canExecute === false, "exportWorker must not auto-run a real adapter");
assert(runtimeState.exportWorker.rootRef === "project_root", "exportWorker rootRef must stay project_root");
assert(runtimeState.exportWorker.exportRoot.startsWith("exports/"), "exportWorker exportRoot must be project-root-relative exports path");
assert(runtimeState.exportWorker.entries.length > 0, "exportWorker must plan export/report entries");
for (const entry of runtimeState.exportWorker.entries) {
  assert(entry.projectRootRelative === true, `exportWorker entry ${entry.id} must be project-root-relative`);
  assert(/^(exports|reports\/exports)(\/|$)/.test(entry.path), `exportWorker entry ${entry.id} must be under exports/ or reports/exports/`);
  assert(!/^(?:[A-Za-z]:[\\/]|\/|\/\/)/.test(entry.path), `exportWorker entry ${entry.id} must not be absolute`);
  assert(!entry.path.split(/[\\/]+/).includes(".."), `exportWorker entry ${entry.id} must not use parent traversal`);
  assert(["create_directory", "write_file"].includes(entry.operation), `exportWorker entry ${entry.id} operation must be allowlisted`);
  assert(entry.canExecute === false, `exportWorker entry ${entry.id} must not execute during import-runtime-test`);
}
assert(runtimeState.exportWorker.manifest.writeFilesOnly === true, "exportWorker manifest must be write-files-only");
assert(runtimeState.exportWorker.manifest.textOnly === true, "exportWorker manifest must be text-only");
assert(runtimeState.exportWorker.manifest.allowedWritePaths.every((entryPath) => /^(exports|reports\/exports)(\/|$)/.test(entryPath)), "exportWorker manifest write paths must stay in export/report roots");
for (const key of [
  "projectRootRelativeOnly",
  "exportScopeOnly",
  "noAbsolutePath",
  "noParentTraversal",
  "noProviderSubmit",
  "noCredentialRead",
  "noCredentialWrite",
  "noArbitraryShell",
  "noMediaRender",
  "noMove",
  "noDelete",
  "noUserFileOverwriteOutsideExport",
]) {
  assert(runtimeState.exportWorker.hardLocks[key] === true, `exportWorker hard lock ${key} must be true`);
}
assert(runtimeState.exportWorker.hardLocks.liveSubmitAllowed === false, "exportWorker live submit must be false");

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
