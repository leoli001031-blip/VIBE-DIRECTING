import type { AssetRecord } from "./types";
import type {
  AssetReconciliationItem,
  AssetReconciliationProjection,
} from "./assetReconciliation";
import { directorAgentPermissionIntentDisallowsVideoSubmit } from "./directorAgentPermissionIntent";

export type ProjectInboxKind =
  | "script"
  | "character"
  | "scene"
  | "prop"
  | "storyboard"
  | "voice"
  | "video"
  | "export"
  | "reference"
  | "unknown";

export type ProjectIntentKind =
  | "story"
  | "reference"
  | "revision"
  | "research"
  | "video"
  | "video_status"
  | "export"
  | "status";

export type ProjectAgentConfirmationKind =
  | "none"
  | "project"
  | "reference_generation"
  | "video_submit"
  | "asset_review"
  | "export";

export interface ProjectInboxItem {
  id: string;
  assetId?: string;
  shotIds?: string[];
  kind: ProjectInboxKind;
  origin: "project_folder" | "project_asset" | "generated_reference" | "reconciliation";
  originLabel: string;
  label: string;
  detail: string;
  suggestedBinding: string;
  confidence: "high" | "medium" | "low";
  needsReview: boolean;
  source: "asset" | "reconciliation";
}

export interface ProjectInboxProjection {
  summary: string;
  nextAction: string;
  totalCount: number;
  needsReviewCount: number;
  items: ProjectInboxItem[];
}

export interface ProjectObservationProjection {
  story: {
    status: "empty" | "drafted" | "selected";
    label: string;
    detail: string;
  };
  references: {
    status: "missing" | "needs_review" | "ready";
    label: string;
    detail: string;
  };
  video: {
    status: "idle" | "ready" | "running" | "recoverable" | "review" | "done" | "failed";
    label: string;
    detail: string;
  };
  currentTask: {
    understanding: string;
    missing: string;
    plan: string;
    confirmation: {
      kind: ProjectAgentConfirmationKind;
      required: boolean;
      label: string;
      detail: string;
    };
  };
  summary: string;
  nextAction: string;
}

export interface ProjectIntentRoute {
  kind: ProjectIntentKind;
  label: string;
  plan: string[];
  confirmation: ProjectAgentConfirmationKind;
  target: "story" | "assets" | "preview" | "export";
}

export interface BuildProjectInboxInput {
  assets: AssetRecord[];
  reconciliation?: AssetReconciliationProjection;
}

export interface ProjectFolderFileEntry {
  path: string;
  sizeBytes?: number;
  modifiedAt?: string;
}

export interface BuildProjectFolderInboxInput {
  files: ProjectFolderFileEntry[];
  existingAssets?: AssetRecord[];
  reconciliation?: AssetReconciliationProjection;
}

export interface ProjectFolderInboxProjection extends ProjectInboxProjection {
  discoveredAssetCount: number;
  discoveredAssets: AssetRecord[];
  ignoredCount: number;
}

export interface BuildProjectObservationInput {
  localProjectReady: boolean;
  projectTitle: string;
  sectionCount: number;
  shotCount: number;
  selectedShotCount: number;
  referenceMissingCount: number;
  referenceReviewCount: number;
  referenceReadyCount: number;
  videoStatus: string;
  videoStatusLabel: string;
  videoDetail: string;
  videoWaitingCount: number;
  videoCompletedCount: number;
  videoReviewCount: number;
  videoCanResume: boolean;
  image2Running: boolean;
  inbox?: ProjectInboxProjection;
}

function routeContinueFromObservation(observation: ProjectObservationProjection): ProjectIntentRoute {
  const basePlan = [observation.currentTask.understanding, observation.currentTask.plan].filter(Boolean);
  if (observation.currentTask.confirmation.kind === "reference_generation") {
    return { kind: "reference", label: "继续准备参考", target: "assets", confirmation: "reference_generation", plan: basePlan };
  }
  if (observation.currentTask.confirmation.kind === "asset_review") {
    return { kind: "reference", label: "继续复核素材", target: "assets", confirmation: "asset_review", plan: basePlan };
  }
  if (observation.currentTask.confirmation.kind === "video_submit") {
    return { kind: "video", label: "继续准备视频", target: "preview", confirmation: "video_submit", plan: basePlan };
  }
  if (observation.currentTask.confirmation.kind === "export") {
    return { kind: "export", label: "继续导出", target: "export", confirmation: "export", plan: basePlan };
  }
  if (observation.video.status === "recoverable" || observation.video.status === "running") {
    return { kind: "video_status", label: "继续查询视频", target: "preview", confirmation: "none", plan: ["读取已提交任务", "查询回流状态", "更新预览"] };
  }
  return { kind: "status", label: "继续当前任务", target: "story", confirmation: observation.currentTask.confirmation.kind, plan: basePlan };
}

function isContinueIntent(text: string) {
  return /^(好|好的|可以|行|没问题|没毛病|ok|OK|确认|通过|继续|下一步|就这样|就按这个)(了|吧|啊|呀|，|。|！|!|,|\s)*$/u.test(text)
    || /(没问题|可以|确认|通过).{0,8}(继续|下一步)/u.test(text)
    || /(继续|下一步).{0,8}(没问题|可以|确认|通过)/u.test(text);
}

function isShotRevisionIntent(text: string) {
  const mentionsShot = /第[一二三四五六七八九十\d]+个?镜头|镜头\s*[一二三四五六七八九十\d]+|这一段|这段/u.test(text);
  const asksChange = /改|调整|重写|替换|删|加|优化|再|更|一点|压迫|紧张|轻松|慢|快|远|近|特写|全景|推近|拉远|日漫|节奏|构图|动作/u.test(text);
  return mentionsShot && asksChange;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function referenceMissingDetail(count: number) {
  if (count <= 0) return "暂时不需要额外参考。";
  return count > 1
    ? "还需要整理角色、场景、道具或故事板参考；生成前会请你确认范围。"
    : "还需要整理一个角色、场景、道具或故事板参考；生成前会请你确认。";
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function compact(value: unknown) {
  return clean(value).toLowerCase();
}

function pathExtension(value: string) {
  const match = value.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

function pathBasename(value: string) {
  const normalized = clean(value).replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).pop() || normalized || "未命名素材";
}

function hasAudioExtension(value: string) {
  return ["wav", "mp3", "m4a", "aac", "flac", "ogg"].includes(pathExtension(value));
}

function isSupportedProjectFolderFile(value: string) {
  return [
    "png",
    "jpg",
    "jpeg",
    "webp",
    "wav",
    "mp3",
    "m4a",
    "aac",
    "flac",
    "ogg",
    "txt",
    "md",
    "srt",
    "mp4",
    "mov",
    "webm",
    "mkv",
    "zip",
  ].includes(pathExtension(value));
}

function hasVoiceReferenceSignal(value: string) {
  return /voice_reference|audio_reference|dialogue_audio|\b(voice|tts|speaker|dialogue|speech)\b|音色|声音|声线|人声|语音|配音|对白|台词/.test(value);
}

function hasMusicReferenceSignal(value: string) {
  return /music_reference|\b(bgm|music|song|score|soundtrack|eurobeat|ost)\b|背景音乐|配乐|音乐|歌曲/.test(value);
}

function shotDisplayLabel(value: string) {
  const cleaned = clean(value)
    .replace(/^shot_storyboard_/i, "")
    .replace(/^shot_/i, "")
    .replace(/_/g, "-");
  return cleaned ? `镜头 ${cleaned}` : "这个镜头";
}

function shotBindingCopy(shotIds: string[]) {
  const visible = shotIds.slice(0, 3).map(shotDisplayLabel);
  return `${visible.join("、")}${shotIds.length > 3 ? ` 等 ${shotIds.length} 个镜头` : ""}`;
}

function assetSearchText(asset: AssetRecord) {
  return [
    asset.id,
    asset.name,
    asset.path,
    asset.type,
    asset.roleBinding?.role,
    ...(asset.roleBinding?.useFor || []),
    ...(asset.textConstraints || []),
    ...(asset.sourceRefs || []),
  ].map(clean).join(" ");
}

function assetFolderSignal(asset: AssetRecord): ProjectInboxKind | undefined {
  const normalized = clean(asset.path)
    .replace(/\\/g, "/")
    .toLowerCase();
  if (/(^|\/)(characters?|character_refs?|roles?|cast|角色|人物)(\/|$)/.test(normalized)) return "character";
  if (/(^|\/)(scenes?|locations?|environments?|backgrounds?|场景|地点|环境|天气)(\/|$)/.test(normalized)) return "scene";
  if (/(^|\/)(props?|objects?|items?|道具|物件)(\/|$)/.test(normalized)) return "prop";
  if (/(^|\/)(storyboards?|shotboards?|boards?|分镜|故事板)(\/|$)/.test(normalized)) return "storyboard";
  if (/(^|\/)(voices?|voice_refs?|dialogue|speech|audio\/voice|声音|声线|配音|对白)(\/|$)/.test(normalized)) return "voice";
  if (/(^|\/)(scripts?|script|screenplay|subtitles?|脚本|台词|字幕)(\/|$)/.test(normalized)) return "script";
  if (/(^|\/)(exports?|deliverables?|final|交付|导出|成片)(\/|$)/.test(normalized)) return "export";
  if (/(^|\/)(videos?|clips?|renders?|回流视频|视频)(\/|$)/.test(normalized)) return "video";
  return undefined;
}

function assetTypeForInboxKind(kind: ProjectInboxKind): AssetRecord["type"] {
  if (kind === "character") return "character";
  if (kind === "scene") return "scene";
  if (kind === "prop") return "prop";
  return "unknown";
}

function roleBindingForFolderAsset(kind: ProjectInboxKind, searchText: string): AssetRecord["roleBinding"] | undefined {
  if (kind === "storyboard") return { role: "storyboard_reference", useFor: [], ignoreFor: [] };
  if (kind === "voice") return { role: "voice_reference", useFor: [], ignoreFor: ["music"] };
  if (kind === "reference" && hasMusicReferenceSignal(searchText)) {
    return { role: "music_reference", useFor: [], ignoreFor: ["video_model"] };
  }
  return undefined;
}

function projectInboxKindForAsset(asset: AssetRecord): ProjectInboxKind {
  const searchable = compact(assetSearchText(asset));
  const hasVoiceSignal = hasVoiceReferenceSignal(searchable);
  const hasMusicSignal = hasMusicReferenceSignal(searchable);
  if (/\b(storyboard|panel|shotboard)\b|故事板|分镜/.test(searchable)) return "storyboard";
  if (hasVoiceSignal) return "voice";
  if (hasMusicSignal) return "reference";
  if (hasAudioExtension(asset.path)) return "voice";
  if (asset.type === "character") return "character";
  if (asset.type === "scene") return "scene";
  if (asset.type === "prop") return "prop";
  if (asset.type === "style") return "reference";
  const folderSignal = assetFolderSignal(asset);
  if (folderSignal) return folderSignal;
  const extension = pathExtension(asset.path);
  if (["txt", "md", "srt"].includes(extension)) return "script";
  if (["mp4", "mov", "webm", "mkv"].includes(extension)) return "video";
  if (["png", "jpg", "jpeg", "webp"].includes(extension)) return "reference";
  return "unknown";
}

function inboxKindLabel(kind: ProjectInboxKind) {
  if (kind === "script") return "脚本";
  if (kind === "character") return "角色";
  if (kind === "scene") return "场景";
  if (kind === "prop") return "道具";
  if (kind === "storyboard") return "故事板";
  if (kind === "voice") return "声音";
  if (kind === "video") return "视频";
  if (kind === "export") return "交付";
  if (kind === "reference") return "参考";
  return "待判断";
}

function assetNeedsReview(asset: AssetRecord) {
  return asset.lockedStatus === "candidate"
    || asset.lockedStatus === "needs_review"
    || asset.status === "exists"
    || asset.status === "generated";
}

function assetInboxOrigin(asset: AssetRecord): Pick<ProjectInboxItem, "origin" | "originLabel"> {
  const sourceRefs = asset.sourceRefs || [];
  if (sourceRefs.includes("project_folder_scan")) {
    return { origin: "project_folder", originLabel: "项目文件夹" };
  }
  if (asset.sourceReceiptId || asset.outputHash || asset.promptHash || asset.promptText || asset.promptPath) {
    return { origin: "generated_reference", originLabel: "生成参考" };
  }
  return { origin: "project_asset", originLabel: "项目素材" };
}

function assetBindingLabel(asset: AssetRecord) {
  const role = clean(asset.roleBinding?.role);
  const shots = (asset.usedByShotIds || asset.roleBinding?.useFor || []).map(clean).filter(Boolean);
  const kind = projectInboxKindForAsset(asset);
  if (shots.length) return `建议用于 ${shotBindingCopy(shots)}`;
  if (kind === "reference" && hasMusicReferenceSignal(compact(assetSearchText(asset)))) return "暂不进视频模型；需要配乐时留到后期";
  if (role === "storyboard_reference") return "建议作为故事板参考，先确认对应镜头";
  if (role === "voice_reference") return "建议作为声音参考，先确认对应角色";
  if (role && role !== "music_reference") return "建议先确认用途";
  if (kind === "reference") return "建议作为风格或画面参考";
  if (kind === "voice") return "建议作为声音参考";
  if (kind === "video") return "建议作为回流视频或剪辑素材";
  if (kind === "export") return "建议放入交付页核对";
  if (asset.type !== "unknown") return `建议作为${inboxKindLabel(kind)}参考`;
  return "需要 Agent 判断用途";
}

function inboxItemFromAsset(asset: AssetRecord): ProjectInboxItem | undefined {
  if (asset.status === "missing" || asset.status === "planned" || asset.status === "rejected") return undefined;
  const kind = projectInboxKindForAsset(asset);
  const shotIds = unique([...(asset.usedByShotIds || []), ...(asset.roleBinding?.useFor || [])]);
  const origin = assetInboxOrigin(asset);
  return {
    id: `asset:${asset.id}`,
    assetId: asset.id,
    shotIds,
    kind,
    ...origin,
    label: asset.name || inboxKindLabel(kind),
    detail: `${origin.originLabel} · ${inboxKindLabel(kind)} · ${asset.lockedStatus === "locked" ? "已可复用" : "等待确认用途"}`,
    suggestedBinding: assetBindingLabel(asset),
    confidence: asset.type === "unknown" ? "medium" : "high",
    needsReview: assetNeedsReview(asset),
    source: "asset",
  };
}

function inboxItemFromReconciliation(item: AssetReconciliationItem): ProjectInboxItem | undefined {
  if (item.status !== "ambiguous" && item.status !== "needs_review") return undefined;
  const kind = item.kind === "storyboard_reference"
    ? "storyboard"
    : item.kind === "music_reference"
      ? "reference"
      : item.kind === "voice_reference"
        ? "voice"
        : item.kind === "style"
          ? "reference"
          : item.kind;
  return {
    id: `reconciliation:${item.id}`,
    assetId: item.assetIds[0],
    shotIds: item.shotIds,
    kind,
    origin: "reconciliation",
    originLabel: "匹配建议",
    label: item.label,
    detail: `${inboxKindLabel(kind)} · ${item.status === "ambiguous" ? "用途不够确定" : "等待确认"}`,
    suggestedBinding: item.shotIds.length ? `建议用于 ${shotBindingCopy(item.shotIds)}` : "建议先确认用途",
    confidence: item.confidence,
    needsReview: true,
    source: "reconciliation",
  };
}

export function buildProjectInboxProjection(input: BuildProjectInboxInput): ProjectInboxProjection {
  const assetItems = input.assets.map(inboxItemFromAsset).filter((item): item is ProjectInboxItem => Boolean(item));
  const reconciliationItems = (input.reconciliation?.items || [])
    .map(inboxItemFromReconciliation)
    .filter((item): item is ProjectInboxItem => Boolean(item));
  const seen = new Set<string>();
  const items = [...reconciliationItems, ...assetItems].filter((item) => {
    const key = `${item.kind}:${item.label}:${item.suggestedBinding}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 16);
  const needsReviewCount = items.filter((item) => item.needsReview).length;
  const projectFolderCount = items.filter((item) => item.origin === "project_folder").length;
  return {
    totalCount: items.length,
    needsReviewCount,
    items,
    summary: projectFolderCount
      ? `项目文件夹里发现 ${projectFolderCount} 个素材，${needsReviewCount} 个还要看一眼。`
      : items.length
      ? `${items.length} 个素材已进入项目，${needsReviewCount} 个需要确认用途。`
      : "还没有放入素材；可以把脚本、图片、声音参考或素材文件夹拖到底部输入框。",
    nextAction: needsReviewCount
      ? "先确认这些素材分别怎么用。"
      : items.length
        ? "素材已可供 Agent 规划使用。"
        : "拖入素材或直接描述项目想法。",
  };
}

function projectFolderAssetId(filePath: string, index: number) {
  const key = clean(filePath)
    .replace(/\\/g, "/")
    .replace(/^[./]+/, "")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
  return `folder_asset_${key || index + 1}`;
}

function assetRecordFromProjectFolderFile(file: ProjectFolderFileEntry, index: number): AssetRecord | undefined {
  const rawPath = clean(file.path).replace(/\\/g, "/");
  if (!rawPath || rawPath.startsWith("/") || rawPath.startsWith("../") || rawPath.includes("/../")) return undefined;
  const normalizedPath = rawPath.replace(/^\.\//, "");
  if (/(^|\/)\./.test(normalizedPath)) return undefined;
  if (!isSupportedProjectFolderFile(normalizedPath)) return undefined;

  const shell: AssetRecord = {
    id: projectFolderAssetId(normalizedPath, index),
    type: "unknown",
    name: pathBasename(normalizedPath),
    path: normalizedPath,
    status: "exists",
    lockedStatus: "needs_review",
    safeForFutureReference: true,
    issues: [],
    sourceRefs: ["project_folder_scan"],
  };
  const kind = projectInboxKindForAsset(shell);
  const searchText = compact(assetSearchText(shell));
  return {
    ...shell,
    type: assetTypeForInboxKind(kind),
    roleBinding: roleBindingForFolderAsset(kind, searchText),
    textConstraints: [
      `从项目文件夹识别为${inboxKindLabel(kind)}素材，正式使用前需要确认。`,
      file.sizeBytes ? `文件大小 ${file.sizeBytes} bytes` : "",
      file.modifiedAt ? `修改时间 ${file.modifiedAt}` : "",
    ].map(clean).filter(Boolean),
  };
}

export function buildProjectFolderInboxProjection(input: BuildProjectFolderInboxInput): ProjectFolderInboxProjection {
  const existingAssets = input.existingAssets || [];
  const existingPaths = new Set(existingAssets.map((asset) => clean(asset.path).replace(/\\/g, "/").replace(/^[./]+/, "")));
  const discoveredAssets = input.files
    .map(assetRecordFromProjectFolderFile)
    .filter((asset): asset is AssetRecord => Boolean(asset))
    .filter((asset) => !existingPaths.has(clean(asset.path)));
  const inbox = buildProjectInboxProjection({
    assets: [...existingAssets, ...discoveredAssets],
    reconciliation: input.reconciliation,
  });
  return {
    ...inbox,
    discoveredAssetCount: discoveredAssets.length,
    discoveredAssets,
    ignoredCount: Math.max(0, input.files.length - discoveredAssets.length),
    summary: discoveredAssets.length
      ? `从项目文件夹识别到 ${discoveredAssets.length} 个可用素材，${inbox.needsReviewCount} 个需要确认用途。`
      : inbox.summary,
    nextAction: discoveredAssets.length
      ? "先看一眼这些素材怎么用，确认后再继续生成。"
      : inbox.nextAction,
  };
}

function observationVideoStatus(input: BuildProjectObservationInput): ProjectObservationProjection["video"] {
  if (input.videoCompletedCount > 0 && input.videoWaitingCount === 0 && input.videoReviewCount === 0) {
    return { status: "done", label: "视频已回流", detail: input.videoDetail || "可以预览并准备导出。" };
  }
  if (input.videoReviewCount > 0) {
    return { status: "review", label: "视频待复核", detail: "先看回流结果，再决定是否导出或重试。" };
  }
  if (input.videoCanResume) {
    return { status: "recoverable", label: "可查询结果", detail: "即梦任务已提交，查询不会重复提交。" };
  }
  if (input.videoWaitingCount > 0 || /submitted|queued|generating|running|in_progress/.test(input.videoStatus)) {
    return { status: "running", label: "视频排队中", detail: input.videoDetail || "保持串行等待回流。" };
  }
  if (/failed/.test(input.videoStatus)) {
    return { status: "failed", label: "视频失败", detail: input.videoDetail || "需要检查失败原因后重试。" };
  }
  if (input.referenceMissingCount === 0 && input.referenceReviewCount === 0 && input.shotCount > 0) {
    return { status: "ready", label: "可准备视频", detail: "故事和参考基本就绪，提交前会再检查。" };
  }
  return { status: "idle", label: input.videoStatusLabel || "未提交视频", detail: input.videoDetail || "先完成故事和参考。" };
}

export function buildProjectObservation(input: BuildProjectObservationInput): ProjectObservationProjection {
  const storyStatus: ProjectObservationProjection["story"]["status"] = input.shotCount > 0
    ? input.selectedShotCount > 0 ? "selected" : "drafted"
    : "empty";
  const story = {
    status: storyStatus,
    label: input.shotCount ? `${input.shotCount} 个镜头` : "还没有故事",
    detail: input.shotCount
      ? `${input.sectionCount || 1} 个段落${input.selectedShotCount ? ` · 当前选中 ${input.selectedShotCount} 个镜头` : ""}`
      : "先描述想法，Agent 会拆成故事和镜头。",
  };
  const references = input.image2Running
    ? {
        status: "needs_review" as const,
        label: "参考生成中",
        detail: "参考正在生成，完成后会进入复核。",
      }
    : input.referenceMissingCount > 0
    ? {
        status: "missing" as const,
        label: "参考不完整",
        detail: referenceMissingDetail(input.referenceMissingCount),
      }
    : input.referenceReviewCount > 0
      ? {
          status: "needs_review" as const,
          label: "参考待复核",
          detail: `${input.referenceReviewCount} 项参考需要你看一眼。`,
        }
      : {
          status: "ready" as const,
          label: "参考可用",
          detail: input.referenceReadyCount ? `${input.referenceReadyCount} 项参考已可复用。` : "暂时不需要额外参考。",
        };
  const video = observationVideoStatus(input);
  const needsProject = !input.localProjectReady;
  const needsReferenceGeneration = !input.image2Running && input.referenceMissingCount > 0;
  const needsAssetReview = !input.image2Running && (input.referenceReviewCount > 0 || Boolean(input.inbox?.needsReviewCount));
  const needsVideoSubmit = !input.image2Running && video.status === "ready";
  const confirmationKind: ProjectAgentConfirmationKind = needsProject
    ? "project"
    : needsReferenceGeneration
      ? "reference_generation"
      : needsAssetReview
        ? "asset_review"
        : needsVideoSubmit
          ? "video_submit"
          : "none";
  const understanding = input.shotCount
    ? `我看到《${input.projectTitle || "当前项目"}》已有 ${input.shotCount} 个镜头。`
    : "我会先把你的想法整理成故事和镜头。";
  const missing = needsProject
    ? "还没有选择本地项目文件夹。"
    : input.image2Running
      ? "参考正在生成，不需要重复操作。"
      : needsReferenceGeneration
      ? references.detail
      : needsAssetReview
        ? input.inbox?.needsReviewCount
          ? `${input.inbox.needsReviewCount} 个素材用途需要确认。`
          : references.detail
        : "暂时没有明显缺口。";
  const plan = needsProject
    ? "先选择或新建项目文件夹。"
    : input.image2Running
      ? "等待参考生成完成，完成后进入复核。"
      : needsReferenceGeneration
        ? "先生成角色、场景、关键道具或故事板参考。"
        : needsAssetReview
          ? "先复核参考和素材用途，再继续生成视频。"
          : needsVideoSubmit
            ? "提交前做一次检查，通过后串行提交视频。"
            : video.status === "recoverable"
              ? "先查询已提交的视频结果。"
              : input.shotCount
                ? "继续按当前故事推进。"
                : "先拆故事和镜头。";
  const confirmationLabel = confirmationKind === "project"
    ? "需要选择项目"
    : confirmationKind === "reference_generation"
      ? "生成参考前需要确认"
      : confirmationKind === "asset_review"
        ? "需要复核素材"
        : confirmationKind === "video_submit"
          ? "提交视频前需要确认"
          : "现在不用你操作";
  const observation: ProjectObservationProjection = {
    story,
    references,
    video,
    currentTask: {
      understanding,
      missing,
      plan,
      confirmation: {
        kind: confirmationKind,
        required: confirmationKind !== "none",
        label: confirmationLabel,
        detail: confirmationKind === "none" ? "可以继续输入想法或修改意见。" : plan,
      },
    },
    summary: `${story.label} · ${references.label} · ${video.label}`,
    nextAction: plan,
  };
  return observation;
}

export function routeProjectAgentIntent(input: {
  text: string;
  hasSelection?: boolean;
  hasAttachments?: boolean;
  observation: ProjectObservationProjection;
}): ProjectIntentRoute {
  const text = compact(input.text);
  const newStoryIntent = /新建|新项目|新片|新短片|新视频|重新做|重做|换个主题|完整项目|整个短片|整支片|另起/.test(text);
  if (/导出|交付|打包|export/.test(text)) {
    return { kind: "export", label: "导出项目", target: "export", confirmation: "export", plan: ["检查可导出内容", "整理交付文件", "生成报告"] };
  }
  if (/查询|回来|结果|回流|状态/.test(text) && /视频|即梦|seedance/.test(text)) {
    return { kind: "video_status", label: "查询视频", target: "preview", confirmation: "none", plan: ["读取已提交任务", "查询回流状态", "更新预览"] };
  }
  if (!directorAgentPermissionIntentDisallowsVideoSubmit(text) && /提交|生成视频|生视频|seedance|即梦/.test(text)) {
    return { kind: "video", label: "准备视频", target: "preview", confirmation: "video_submit", plan: ["检查故事和参考", "编译视频提示词", "确认后串行提交"] };
  }
  if (/查资料|查一下|搜一下|搜索|参考.*风格|研究|((分镜|风格|镜头|节奏).{0,8}怎么做)/.test(text)) {
    return { kind: "research", label: "查资料", target: "story", confirmation: "none", plan: ["整理检索问题", "保存可用资料", "等你确认后写入项目"] };
  }
  if (/补.*参考|生成.*参考|角色图|场景图|道具图|故事板/.test(text)) {
    return { kind: "reference", label: "生成参考", target: "assets", confirmation: "reference_generation", plan: ["判断缺少的角色、场景或道具参考", "确认生成范围", "生成后进入复核"] };
  }
  if (!text && input.hasAttachments) {
    return { kind: "reference", label: "整理素材", target: "assets", confirmation: "asset_review", plan: ["识别拖入文件", "建议作为角色、场景、道具或镜头参考", "需要时请你确认"] };
  }
  if (!text) {
    return { kind: "status", label: "检查项目", target: "story", confirmation: input.observation.currentTask.confirmation.kind, plan: [input.observation.currentTask.understanding, input.observation.currentTask.plan] };
  }
  if (isContinueIntent(text)) {
    return routeContinueFromObservation(input.observation);
  }
  if (newStoryIntent) {
    return { kind: "story", label: "整理新故事", target: "story", confirmation: "none", plan: ["理解新片方向", "重拆故事段落和镜头", "生成前先给你看草案"] };
  }
  if (input.hasSelection || isShotRevisionIntent(text) || /改|调整|重写|替换|删|加|优化/.test(text)) {
    return { kind: "revision", label: "修改当前内容", target: "story", confirmation: "none", plan: ["读取当前选中内容", "整理成可确认修改", "确认后写入项目"] };
  }
  return { kind: "story", label: "整理故事", target: "story", confirmation: "none", plan: ["理解你的想法", "拆成故事段落和镜头", "生成前先给你看草案"] };
}
