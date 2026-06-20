import path from "node:path";

export type JsonRecord = Record<string, unknown>;

export interface SeedanceLivePreflightDeps {
  commandExists: (command: string) => boolean;
  env?: Record<string, string | undefined>;
  exists: (filePath: string) => boolean;
  fileSize: (filePath: string) => number;
  homeDir: string;
  now?: () => Date;
  readJsonOptional: (filePath: string) => JsonRecord | undefined;
}

export interface SeedanceLivePreflightOptions {
  durationSeconds?: number;
  modelVersion?: string;
  projectRootInput?: string;
  repoRoot: string;
  selectedShotId?: string;
  videoResolution?: string;
}

export interface SeedanceLivePreflightReport {
  schemaVersion: "seedance_live_preflight_v1";
  generatedAt: string;
  ready: boolean;
  status: "ready_to_confirm_submit" | "blocked";
  project: {
    root: string;
    projectVibePath: string;
    title: string;
    shotCount: number;
    selectedShotIds: string[];
    assetCount: number;
    usableReferenceAssetCount: number;
  };
  submitDefaults: {
    modelVersion: string;
    videoResolution: string;
    durationSeconds: number;
    maxConcurrentVideoJobs: 1;
    noBgmRequiredAtPromptEnd: true;
  };
  queue?: {
    path: string;
    exists: boolean;
    total: number;
    active: number;
    ready: number;
    completed: number;
  };
  checks: {
    imageProviderKeyConfigured: boolean;
    jimengCliCommand: string;
    jimengCliFound: boolean;
    confirmationPhraseRequired: "submit-seedance-video";
  };
  blockers: string[];
  warnings: string[];
  next: string;
}

const defaultModelVersion = "seedance2.0_vip";
const defaultVideoResolution = "720p";
const supportedModelVersions = new Set(["seedance2.0", "seedance2.0fast", "seedance2.0_vip", "seedance2.0fast_vip"]);
const activeQueueStatuses = new Set(["submitting", "submitted", "queued", "polling", "generating", "running", "recoverable_queued"]);
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const nonReferenceKinds = new Set(["style", "text", "script", "prompt", "receipt", "video", "audio", "music"]);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function resolveInsideRepo(repoRoot: string, value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

function projectVibePath(projectRoot: string, deps: SeedanceLivePreflightDeps) {
  for (const name of ["project.vibe", "Project.vibe"]) {
    const candidate = path.join(projectRoot, name);
    if (deps.exists(candidate)) return candidate;
  }
  return path.join(projectRoot, "project.vibe");
}

function projectShots(project: JsonRecord): JsonRecord[] {
  const fromStoryFlow = isRecord(project.storyFlow) ? arrayValue(project.storyFlow.shots) : [];
  const fromShots = arrayValue(project.shots);
  return [...fromStoryFlow, ...fromShots]
    .filter(isRecord)
    .filter((shot, index, list) => {
      const id = stringValue(shot.id) || `shot_${index}`;
      return list.findIndex((item) => (stringValue(item.id) || `shot_${index}`) === id) === index;
    });
}

function projectAssets(project: JsonRecord): JsonRecord[] {
  const visualMemoryAssets = isRecord(project.visualMemory) ? arrayValue(project.visualMemory.assets) : [];
  return [...arrayValue(project.assets), ...visualMemoryAssets]
    .filter(isRecord)
    .filter((asset, index, list) => {
      const id = stringValue(asset.id) || `asset_${index}`;
      return list.findIndex((item) => (stringValue(item.id) || `asset_${index}`) === id) === index;
    });
}

function assetPath(asset: JsonRecord, projectRoot: string) {
  const raw = stringValue(asset.path) || stringValue(asset.filePath) || stringValue(asset.url);
  if (!raw || /^https?:\/\//i.test(raw)) return "";
  return path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
}

function assetLooksLikeReference(asset: JsonRecord, projectRoot: string, deps: SeedanceLivePreflightDeps) {
  const kind = (stringValue(asset.kind) || stringValue(asset.type) || stringValue(asset.role)).toLowerCase();
  if (nonReferenceKinds.has(kind)) return false;
  const filePath = assetPath(asset, projectRoot);
  if (!filePath || !deps.exists(filePath)) return false;
  if (!imageExtensions.has(path.extname(filePath).toLowerCase())) return false;
  return deps.fileSize(filePath) > 0;
}

function readRelayQueue(projectRoot: string, deps: SeedanceLivePreflightDeps) {
  const relayQueuePath = path.join(projectRoot, "reports/video_relay_queue.json");
  const relayQueue = deps.readJsonOptional(relayQueuePath);
  const items = arrayValue(relayQueue?.items).filter(isRecord);
  const activeItems = items.filter((item) => activeQueueStatuses.has(stringValue(item.status)));
  const readyItems = items.filter((item) => stringValue(item.status) === "ready");
  const completedItems = items.filter((item) => stringValue(item.status) === "completed" || Boolean(stringValue(item.outputVideoPath)));
  return {
    relayQueuePath,
    relayQueue,
    items,
    activeItems,
    readyItems,
    completedItems,
  };
}

function configuredImageProviderKey(deps: SeedanceLivePreflightDeps) {
  const env = deps.env || {};
  if (env.VIBE_APIKEY_FUN_API_KEY || env.APIKEY_FUN_API_KEY || env.VIBE_IMAGE2_API_KEY) return true;
  const credentials = deps.readJsonOptional(path.join(deps.homeDir, ".vibe-director/credentials.json"));
  const providers = isRecord(credentials?.providers) ? credentials.providers : {};
  return ["apikey-fun-gpt55-responses-image", "apikey-fun", "apikey_fun", "gpt55-responses-image", "lanyi-image2", "lanyiapi-gpt-image-2", "openai-image2-api"]
    .some((providerId) => isRecord(providers[providerId]) && Boolean(stringValue(providers[providerId]?.apiKey)));
}

function cliReady(deps: SeedanceLivePreflightDeps) {
  const configured = deps.env?.VIBE_JIMENG_CLI_PATH || "dreamina";
  const command = path.basename(configured);
  return {
    command,
    ready: deps.commandExists(command),
  };
}

export function runSeedanceLivePreflight(
  options: SeedanceLivePreflightOptions,
  deps: SeedanceLivePreflightDeps,
): SeedanceLivePreflightReport {
  const repoRoot = options.repoRoot;
  const bindingPath = path.resolve(repoRoot, ".vibe-runtime/current-project.local.json");
  const binding = deps.readJsonOptional(bindingPath);
  const projectRootInput = options.projectRootInput || stringValue(binding?.projectRoot);
  const projectRoot = projectRootInput ? resolveInsideRepo(repoRoot, projectRootInput) : "";
  const projectPath = projectRoot ? projectVibePath(projectRoot, deps) : "";
  const project = projectPath ? deps.readJsonOptional(projectPath) : undefined;
  const shots = project ? projectShots(project) : [];
  const selectedShotId = options.selectedShotId || "";
  const selectedShots = selectedShotId ? shots.filter((shot) => stringValue(shot.id) === selectedShotId) : shots;
  const assets = project ? projectAssets(project) : [];
  const usableReferenceAssets = projectRoot ? assets.filter((asset) => assetLooksLikeReference(asset, projectRoot, deps)) : [];
  const relayQueue = projectRoot ? readRelayQueue(projectRoot, deps) : undefined;
  const cli = cliReady(deps);
  const modelVersion = options.modelVersion || defaultModelVersion;
  const videoResolution = options.videoResolution || defaultVideoResolution;
  const requestedDuration = options.durationSeconds;
  const targetDurationSeconds = typeof requestedDuration === "number" && Number.isFinite(requestedDuration) && requestedDuration > 0
    ? Math.round(requestedDuration)
    : Math.round(selectedShots.reduce((sum, shot) => sum + numberValue(shot.durationSeconds || shot.duration || shot.seconds, 4), 0) || 4);
  const imageProviderKeyConfigured = configuredImageProviderKey(deps);

  const blockers = [
    projectRoot ? "" : "当前还没有绑定项目文件夹。",
    project ? "" : "当前项目缺少 project.vibe。",
    shots.length ? "" : "当前项目没有镜头。",
    selectedShotId && selectedShots.length === 0 ? `找不到选中的镜头：${selectedShotId}` : "",
    usableReferenceAssets.length ? "" : "当前项目还没有可用于 Seedance 的角色/场景/道具图片参考。",
    relayQueue?.activeItems.length ? `已有视频任务在排队或生成：${relayQueue.activeItems.map((item) => stringValue(item.title) || stringValue(item.id) || stringValue(item.submitId)).filter(Boolean).join(", ")}` : "",
    imageProviderKeyConfigured ? "" : "生成故事板参考需要先配置图片/Responses Key。",
    cli.ready ? "" : `找不到即梦 CLI：${cli.command}。`,
    videoResolution === "720p" ? "" : "提交前请使用 720p，避免误触高成本分辨率。",
    supportedModelVersions.has(modelVersion) ? "" : `不支持的视频模型档位：${modelVersion}。`,
    targetDurationSeconds >= 4 && targetDurationSeconds <= 15 ? "" : `当前目标时长 ${targetDurationSeconds}s 超出 Seedance 全能参考 4-15s 范围。`,
  ].filter(Boolean);

  const warnings = [
    selectedShotId ? "" : "未指定 selected-shot-id；预检按当前项目全部镜头估算时长。",
    relayQueue?.readyItems.length ? `队列里还有 ${relayQueue.readyItems.length} 段 ready，真实提交会继续下一个可提交段。` : "",
    relayQueue?.completedItems.length ? `已有 ${relayQueue.completedItems.length} 段视频回流，可先去预览/导出页复核。` : "",
    "真实提交仍需要页面确认口令 submit-seedance-video；本脚本不会提交视频。",
  ].filter(Boolean);

  const ready = blockers.length === 0;
  return {
    schemaVersion: "seedance_live_preflight_v1",
    generatedAt: (deps.now?.() || new Date()).toISOString(),
    ready,
    status: ready ? "ready_to_confirm_submit" : "blocked",
    project: {
      root: projectRoot ? path.relative(repoRoot, projectRoot) || "." : "",
      projectVibePath: projectPath ? path.relative(repoRoot, projectPath) : "",
      title: stringValue(project?.manifest && isRecord(project.manifest) ? project.manifest.title : undefined) || stringValue(project?.title) || stringValue(binding?.displayName),
      shotCount: shots.length,
      selectedShotIds: selectedShots.map((shot) => stringValue(shot.id)).filter(Boolean),
      assetCount: assets.length,
      usableReferenceAssetCount: usableReferenceAssets.length,
    },
    submitDefaults: {
      modelVersion,
      videoResolution,
      durationSeconds: targetDurationSeconds,
      maxConcurrentVideoJobs: 1,
      noBgmRequiredAtPromptEnd: true,
    },
    queue: relayQueue ? {
      path: path.relative(repoRoot, relayQueue.relayQueuePath),
      exists: Boolean(relayQueue.relayQueue),
      total: relayQueue.items.length,
      active: relayQueue.activeItems.length,
      ready: relayQueue.readyItems.length,
      completed: relayQueue.completedItems.length,
    } : undefined,
    checks: {
      imageProviderKeyConfigured,
      jimengCliCommand: cli.command,
      jimengCliFound: cli.ready,
      confirmationPhraseRequired: "submit-seedance-video",
    },
    blockers,
    warnings,
    next: ready
      ? "可以在前端确认提交 1 段 Seedance VIP 720p 视频；保持串行，不要重复点提交。"
      : "先按 blockers 补齐参考、配置或等待队列，再提交视频。",
  };
}
