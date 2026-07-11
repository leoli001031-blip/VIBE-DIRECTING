import type { AssetRecord } from "./types";
import type {
  AssetReconciliationItem,
  AssetReconciliationProjection,
} from "./assetReconciliation";
import {
  detectDirectorAgentPermissionIntent,
  directorAgentPermissionIntentDisallowsVideoSubmit,
  isDirectorAgentExplainOnlyIntent,
} from "./directorAgentPermissionIntent";
import { directorIntentStartsFreshVideoDraft } from "./directorFreshDraftIntent";

export type ProjectInboxKind =
  | "script"
  | "character"
  | "scene"
  | "prop"
  | "storyboard"
  | "voice"
  | "video"
  | "prompt"
  | "receipt"
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
  suggestedAction: string;
  reason: string;
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

const PROJECT_INBOX_ITEM_PREVIEW_LIMIT = 24;

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

function isPositiveReferencePreparationIntent(text: string) {
  const value = compact(text);
  if (!value) return false;
  const negativeReferencePattern = /(?:不要|不|别|不用|不必|无需|先不要|先别)(?:再|去|自动|直接|马上|立刻|先)?(?:补|补齐|补全|生成|做)?.{0,4}(?:参考|参考图|角色图|场景图|道具图|故事板)/g;
  const referenceIntentText = value.replace(negativeReferencePattern, "");
  if (!referenceIntentText.trim()) return false;
  const explicitReferenceStart = /(?:开始|继续|先|只|可以|允许|帮我|请|要|去).{0,8}(?:补|补齐|补全|生成|做).{0,4}(?:参考|参考图|角色图|场景图|道具图|故事板)/.test(referenceIntentText);
  if (explicitReferenceStart) return true;
  return /(?:补|补齐|补全|生成|做).{0,16}(?:参考|参考图|角色图|场景图|道具图|故事板)|(?:参考|参考图).{0,8}(?:计划|范围|清单|方案)/.test(referenceIntentText);
}

function isVideoSubmitRequestIntent(text: string) {
  const value = compact(text);
  if (!value) return false;
  const negativeVideoPattern = /(?:不要|不|别|不用|不必|无需|先不要|先别|先不)(?:再|去|自动|直接|马上|立刻|先)?(?:提交|发送|生成|生|跑|测|测试|调用)?.{0,6}(?:视频|即梦|seedance|外部生成)|(?:视频|即梦|seedance).{0,6}(?:先不用|先别|不用管|别跑|不用跑)/gi;
  const positiveVideoText = value.replace(negativeVideoPattern, "");
  if (!positiveVideoText.trim()) return false;
  return /发送视频|生成视频|生视频|(?:提交|发送).{0,6}(?:视频|即梦|seedance)|seedance|即梦/i.test(positiveVideoText);
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
  referenceExecutionValidated?: boolean;
  videoExecutionValidated?: boolean;
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

export function isContinueIntent(text: string) {
  return /^(好|好的|可以|行|没问题|没毛病|ok|OK|确认|通过|继续下一步|继续下步|继续|下一步|就这样|就按这个)(了|吧|啊|呀|，|。|！|!|,|\s)*$/u.test(text)
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

function assetReviewMissingDetail(input: Pick<BuildProjectObservationInput, "referenceReviewCount" | "inbox">) {
  if (input.referenceReviewCount > 0) return `${input.referenceReviewCount} 项参考需要复核。`;
  if (input.inbox?.needsReviewCount) return `${input.inbox.needsReviewCount} 个素材用途需要确认。`;
  return "有参考或素材用途需要确认。";
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function compact(value: unknown) {
  return clean(value).toLowerCase();
}

function parseLocalizedInteger(value: string): number | undefined {
  const normalized = clean(value).replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
  if (/^\d{1,3}$/.test(normalized)) return Number.parseInt(normalized, 10);
  const digitValues: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    俩: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (normalized === "十") return 10;
  const teenMatch = normalized.match(/^十([一二两俩三四五六七八九])$/u);
  if (teenMatch) return 10 + digitValues[teenMatch[1] || ""]!;
  const tenMatch = normalized.match(/^([一二两俩三四五六七八九])十([一二两俩三四五六七八九])?$/u);
  if (tenMatch) return digitValues[tenMatch[1] || ""]! * 10 + (digitValues[tenMatch[2] || ""] || 0);
  return digitValues[normalized];
}

const localizedShotCountToken = String.raw`([0-9０-９]{1,3}|一|二|两|俩|三|四|五|六|七|八|九|十|十[一二两俩三四五六七八九]|[一二两俩三四五六七八九]十[一二两俩三四五六七八九]?)`;

export function requestedStoryboardShotCountFromIntent(value: string): number | undefined {
  const text = clean(value);
  if (!text) return undefined;
  const patterns = [
    new RegExp(String.raw`(?:拆成|分成|分为|切成|规划成|做成|改成|调整成|换成|整理成|整理为|重排成|重排为)\s*${localizedShotCountToken}\s*(?:个|条|段)?\s*(?:镜头|分镜|视频段|视频|短片|片段|段落|shots?|clips?|cuts?)`, "iu"),
    new RegExp(String.raw`(?:镜头|分镜|视频段|片段|段落)\s*(?:改成|调整成|换成|变成|拆成|分成|整理成|整理为|重排成|重排为)\s*${localizedShotCountToken}\s*(?:个|条|段)?`, "iu"),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const count = match ? parseLocalizedInteger(match[1] || "") : undefined;
    if (count && count >= 1 && count <= 80) return count;
  }
  return undefined;
}

export function isStoryShotCountRestructureIntent(value: string) {
  return Boolean(requestedStoryboardShotCountFromIntent(value));
}

function pathExtension(value: unknown) {
  const match = clean(value).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

function pathBasename(value: string) {
  const normalized = clean(value).replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).pop() || normalized || "未命名素材";
}

function hasAudioExtension(value: unknown) {
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
    "json",
    "zip",
  ].includes(pathExtension(value));
}

function isSystemManagedProjectFolderPath(value: string) {
  const normalized = clean(value)
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .toLowerCase();
  return normalized.startsWith("assets/generated/")
    || normalized.startsWith("exports/current-project/");
}

function hasVoiceReferenceSignal(value: string) {
  return /voice_reference|audio_reference|dialogue_audio|\b(voice|tts|speaker|dialogue|speech)\b|音色|声音|声线|人声|语音|配音|对白|台词/.test(value);
}

function hasMusicReferenceSignal(value: string) {
  return /music_reference|\b(bgm|music|song|score|soundtrack|eurobeat|ost|post_audio)\b|背景音乐|配乐|音乐|歌曲|后期声音/.test(value);
}

function hasStyleReferenceSignal(value: string) {
  return /style_reference|\b(styles?|looks?|moodboards?|skills?)\b|风格|画风|技能|分镜方法|参考方法/.test(value);
}

function hasScriptTextSignal(value: string) {
  return /\b(scripts?|screenplays?|dialogues?|dialogs?|lines?|subtitles?|captions?)\b|脚本|台词|字幕|对白/.test(value);
}

function hasFineDetailReferenceSignal(value: string) {
  return /(?:^|[\s/_-])(?:detail|details|closeups?|insert|cutaway|part|parts|component|fragment|texture|pose|gesture|expression|reaction)(?:[\s/_-]|$)|局部|细节|特写|插入镜头|动作瞬间|表情|姿态|手势|质感|纹理|(?:^|[\s/_-])(?:headlights?|taillights?|brake[-_\s]?lights?|wheels?|tires?|tyres?|rims?|windows?|mirrors?|logos?|badges?|license[-_\s]?plates?)(?:[\s/_-]|$)|车灯|尾灯|刹车灯|轮胎|车轮|轮毂|车窗|后视镜|车标|车牌|(?:^|[\s/_-])(?:hands?|fingers?|eyes?|mouth|lips|hair|sleeves?|collars?|cuffs?|feet|shoes?)(?:[\s/_-]|$)|手部|手指|指尖|眼神|眼睛|嘴唇|头发|袖口|衣领|脚步|鞋底|(?:^|[\s/_-])(?:rain|fog|mist|smoke|steam|shadow|shadows|reflection|reflections|splash|splashes|spark|glow|light[-_\s]?streaks?)(?:[\s/_-]|$)|雨水|雾气|烟雾|阴影|反光|倒影|水花|火花|光斑|光线/.test(value);
}

function fineDetailBindingCopy() {
  return "这是局部细节、动作或状态参考，建议并入主体资产或镜头说明，不单独生成参考。";
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

function projectScopeSegmentLabel(segment: string): string | undefined {
  const raw = clean(segment);
  if (!raw) return undefined;
  const normalized = raw.toLowerCase();
  const generic = new Set([
    "act",
    "acts",
    "chapter",
    "chapters",
    "episode",
    "episodes",
    "section",
    "sections",
    "sequence",
    "sequences",
    "scene",
    "scenes",
    "shot",
    "shots",
    "镜头",
    "章节",
    "段落",
    "序列",
    "场次",
  ]);
  if (generic.has(normalized)) return undefined;
  const display = raw.replace(/[_-]+/g, " ");
  if (/^(act|chapter|chap|episode|ep)[-_\s]?\w+/i.test(raw) || /第.+[章节集幕]|章节|篇章/.test(raw)) {
    return `章节 ${display}`;
  }
  if (/^(sequence|seq|section|scene)[-_\s]?\w+/i.test(raw) || /段落|序列|场次|分段/.test(raw)) {
    return `段落 ${display}`;
  }
  if (/^(shot|cut)[-_\s]?\w+/i.test(raw) || /镜头/.test(raw)) {
    return `镜头 ${display}`;
  }
  return undefined;
}

function projectPathScopeLabel(asset: AssetRecord) {
  const segments = clean(asset.path)
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .slice(0, -1);
  return unique(segments.map(projectScopeSegmentLabel)).slice(0, 3).join(" / ");
}

function appendScopeHint(text: string, scopeLabel: string) {
  return scopeLabel ? `${text} 路径提示：${scopeLabel}。` : text;
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

function assetHasVisualOrAudioMedia(asset: AssetRecord) {
  return /\.(?:png|jpe?g|webp|gif|avif|mp3|m4a|wav|mp4|mov|webm|mkv)(?:\?|$)/i.test(clean(asset.path));
}

function isTextOnlyStyleAsset(asset: AssetRecord) {
  if (asset.type !== "style") return false;
  const sourceText = (asset.sourceRefs || []).join(" ").toLowerCase();
  const searchable = assetSearchText(asset).toLowerCase();
  return !assetHasVisualOrAudioMedia(asset) && (
    sourceText.includes("new_video_reference:style:text")
    || searchable.includes("文字风格方向")
    || searchable.includes("项目视觉风格")
  );
}

function assetFolderSignal(asset: AssetRecord): ProjectInboxKind | undefined {
  const normalized = clean(asset.path)
    .replace(/\\/g, "/")
    .toLowerCase();
  if (/(^|\/)(characters?|character_refs?|roles?|cast|角色|人物)(\/|$)/.test(normalized)) return "character";
  if (/(^|\/)(scenes?|locations?|environments?|backgrounds?|场景|地点|环境|天气)(\/|$)/.test(normalized)) return "scene";
  if (/(^|\/)(vehicles?|cars?|autos?|汽车|车辆|赛车)(\/|$)/.test(normalized)) return "prop";
  if (/(^|\/)(props?|objects?|items?|道具|物件)(\/|$)/.test(normalized)) return "prop";
  if (/(^|\/)(styles?|style_refs?|looks?|moodboards?|skills?|风格|画风|技能|方法)(\/|$)/.test(normalized)) return "reference";
  if (/(^|\/)(storyboards?|shotboards?|boards?|分镜|故事板)(\/|$)/.test(normalized)) return "storyboard";
  if (/(^|\/)(voices?|voice_refs?|dialogue|speech|audio\/voice|声音|声线|配音|对白)(\/|$)/.test(normalized)) return "voice";
  if (/(^|\/)(music|bgm|scores?|soundtracks?|ost|audio\/music|post_audio|后期声音|配乐|音乐|歌曲)(\/|$)/.test(normalized)) return "reference";
  if (/(^|\/)(scripts?|script|screenplay|subtitles?|脚本|台词|字幕)(\/|$)/.test(normalized)) return "script";
  if (/(^|\/)(prompts?|prompt-packs?|提示词|请求)(\/|$)/.test(normalized)) return "prompt";
  if (/(^|\/)(receipts?|reports?|evidence|submit-ids?|提交证据|回执|证据|报告)(\/|$)/.test(normalized)) return "receipt";
  if (/(^|\/)(exports?|deliverables?|final|交付|导出|成片)(\/|$)/.test(normalized)) return "export";
  if (/(^|\/)(videos?|clips?|renders?|回流视频|视频)(\/|$)/.test(normalized)) return "video";
  return undefined;
}

function assetTypeForFolderAsset(kind: ProjectInboxKind, searchText: string): AssetRecord["type"] {
  if (kind === "character") return "character";
  if (kind === "scene") return "scene";
  if (kind === "prop") return "prop";
  if (kind === "reference" && hasStyleReferenceSignal(searchText)) return "style";
  return "unknown";
}

function roleBindingForFolderAsset(kind: ProjectInboxKind, searchText: string): AssetRecord["roleBinding"] | undefined {
  if (kind !== "scene" && hasFineDetailReferenceSignal(searchText)) return { role: "detail_reference", useFor: [], ignoreFor: ["standalone_reference"] };
  if (kind === "storyboard") return { role: "storyboard_reference", useFor: [], ignoreFor: [] };
  if (kind === "voice") return { role: "voice_reference", useFor: [], ignoreFor: ["music"] };
  if (kind === "prompt") return { role: "prompt_reference", useFor: [], ignoreFor: ["voice", "music"] };
  if (kind === "receipt") return { role: "generation_receipt", useFor: [], ignoreFor: ["video_model", "voice", "music"] };
  if (kind === "reference" && hasMusicReferenceSignal(searchText)) {
    return { role: "music_reference", useFor: [], ignoreFor: ["video_model"] };
  }
  if (kind === "reference" && hasStyleReferenceSignal(searchText)) {
    return { role: "style_reference", useFor: [], ignoreFor: ["voice", "music"] };
  }
  return undefined;
}

function projectInboxKindForAsset(asset: AssetRecord): ProjectInboxKind {
  const searchable = assetSearchText(asset).toLowerCase();
  const extension = pathExtension(asset.path);
  const isTextDocument = ["txt", "md", "srt"].includes(extension);
  const hasVoiceSignal = hasVoiceReferenceSignal(searchable);
  const hasMusicSignal = hasMusicReferenceSignal(searchable);
  const folderSignal = assetFolderSignal(asset);
  if (folderSignal !== "scene" && hasFineDetailReferenceSignal(searchable)) return "reference";
  if (folderSignal === "reference" && (hasStyleReferenceSignal(searchable) || hasMusicSignal)) return "reference";
  if (folderSignal === "prompt") return "prompt";
  if (folderSignal === "receipt") return "receipt";
  if (folderSignal === "storyboard") return "storyboard";
  if (folderSignal === "script" || (isTextDocument && hasScriptTextSignal(searchable))) return "script";
  if (/\b(storyboard|panel|shotboard)\b|故事板|分镜/.test(searchable)) return "storyboard";
  if (hasVoiceSignal && !isTextDocument) return "voice";
  if (hasMusicSignal) return "reference";
  if (hasStyleReferenceSignal(searchable)) return "reference";
  if (hasAudioExtension(asset.path)) return "voice";
  if (asset.type === "character") return "character";
  if (asset.type === "scene") return "scene";
  if (asset.type === "prop") return "prop";
  if (asset.type === "style") return "reference";
  if (folderSignal) return folderSignal;
  if (isTextDocument) return "script";
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
  if (kind === "prompt") return "提示词";
  if (kind === "receipt") return "生成证据";
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
  const searchable = assetSearchText(asset).toLowerCase();
  const scopeLabel = projectPathScopeLabel(asset);
  if (kind !== "scene" && (role === "detail_reference" || hasFineDetailReferenceSignal(searchable))) return appendScopeHint(fineDetailBindingCopy(), scopeLabel);
  if (shots.length) return appendScopeHint(`建议用于 ${shotBindingCopy(shots)}`, scopeLabel);
  if (kind === "reference" && hasMusicReferenceSignal(searchable)) return appendScopeHint("暂不进视频模型；需要配乐时留到后期", scopeLabel);
  if (kind === "reference" && hasStyleReferenceSignal(searchable)) return appendScopeHint("建议作为风格或分镜方法参考，先确认适用范围", scopeLabel);
  if (role === "storyboard_reference") return appendScopeHint("建议作为故事板参考，先确认对应镜头", scopeLabel);
  if (role === "voice_reference") return appendScopeHint("建议作为声音参考，先确认对应角色", scopeLabel);
  if (role && role !== "music_reference") return appendScopeHint("建议先确认用途", scopeLabel);
  if (kind === "reference") return appendScopeHint("建议作为风格或画面参考", scopeLabel);
  if (kind === "voice") return appendScopeHint("建议作为声音参考", scopeLabel);
  if (kind === "video") return appendScopeHint("建议作为回流视频或剪辑素材", scopeLabel);
  if (kind === "prompt") return appendScopeHint("建议作为提示词证据，先确认对应镜头", scopeLabel);
  if (kind === "receipt") return appendScopeHint("建议作为生成证据，不直接交给视频模型", scopeLabel);
  if (kind === "export") return appendScopeHint("建议放入交付页核对", scopeLabel);
  if (kind === "character" || kind === "scene" || kind === "prop") return appendScopeHint(`建议作为${inboxKindLabel(kind)}参考`, scopeLabel);
  if (asset.type !== "unknown") return appendScopeHint(`建议作为${inboxKindLabel(kind)}参考`, scopeLabel);
  return appendScopeHint("需要 Agent 判断用途", scopeLabel);
}

function assetSuggestedAction(asset: AssetRecord, kind: ProjectInboxKind) {
  const searchable = assetSearchText(asset).toLowerCase();
  if (kind !== "scene" && (asset.roleBinding?.role === "detail_reference" || hasFineDetailReferenceSignal(searchable))) {
    return "并入主体或镜头说明";
  }
  if (kind === "script") return "作为故事输入";
  if (kind === "storyboard") return "确认对应镜头";
  if (kind === "voice") return "确认对应角色";
  if (kind === "prompt") return "作为提示词证据";
  if (kind === "receipt") return "作为生成证据";
  if (kind === "export") return "放入交付核对";
  if (kind === "video") return "放入预览或剪辑";
  if (kind === "reference" && hasMusicReferenceSignal(searchable)) return "留到后期声音";
  if (kind === "reference" && hasStyleReferenceSignal(searchable)) return "确认风格适用范围";
  if (kind === "character" || kind === "scene" || kind === "prop") return `作为${inboxKindLabel(kind)}参考`;
  return "确认用途";
}

function assetInboxReason(asset: AssetRecord, kind: ProjectInboxKind) {
  const searchable = assetSearchText(asset).toLowerCase();
  const folderSignal = assetFolderSignal(asset);
  const scopeLabel = projectPathScopeLabel(asset);
  if (kind !== "scene" && (asset.roleBinding?.role === "detail_reference" || hasFineDetailReferenceSignal(searchable))) {
    return appendScopeHint("文件名或目录像局部细节、动作瞬间或状态，不适合单独变成可复用参考。", scopeLabel);
  }
  if (folderSignal) {
    return appendScopeHint("先按项目文件夹目录和文件名判断，正式绑定前仍让你确认。", scopeLabel);
  }
  if (asset.sourceReceiptId || asset.outputHash || asset.promptHash || asset.promptText || asset.promptPath) {
    return appendScopeHint("这是生成链路留下的素材，通常可复用，但还需要复核画面是否符合当前项目。", scopeLabel);
  }
  if (kind === "reference" && hasMusicReferenceSignal(searchable)) {
    return appendScopeHint("音乐不会交给视频模型，只作为后期或节奏参考保留。", scopeLabel);
  }
  if (kind === "prompt" || kind === "receipt") {
    return appendScopeHint("这是过程证据，不直接当成画面参考。", scopeLabel);
  }
  if (asset.type === "unknown") {
    return appendScopeHint("素材类型不够明确，需要你确认它应该服务哪一块。", scopeLabel);
  }
  return appendScopeHint("根据素材类型和已有绑定推断，确认后可进入后续规划。", scopeLabel);
}

function inboxItemFromAsset(asset: AssetRecord): ProjectInboxItem | undefined {
  if (asset.status === "missing" || asset.status === "planned" || asset.status === "rejected") return undefined;
  if (isTextOnlyStyleAsset(asset)) return undefined;
  const kind = projectInboxKindForAsset(asset);
  const shotIds = unique([...(asset.usedByShotIds || []), ...(asset.roleBinding?.useFor || [])]);
  const origin = assetInboxOrigin(asset);
  const detailReference = asset.roleBinding?.role === "detail_reference";
  const scopeLabel = projectPathScopeLabel(asset);
  return {
    id: `asset:${asset.id}`,
    assetId: asset.id,
    shotIds,
    kind,
    ...origin,
    label: asset.name || inboxKindLabel(kind),
    detail: detailReference
      ? `${origin.originLabel} · ${scopeLabel ? `${scopeLabel} · ` : ""}局部细节 · 建议并入主体或镜头说明`
      : `${origin.originLabel} · ${scopeLabel ? `${scopeLabel} · ` : ""}${inboxKindLabel(kind)} · ${asset.lockedStatus === "locked" ? "已可复用" : "等待确认用途"}`,
    suggestedBinding: assetBindingLabel(asset),
    suggestedAction: assetSuggestedAction(asset, kind),
    reason: assetInboxReason(asset, kind),
    confidence: detailReference ? "low" : asset.type === "unknown" ? "medium" : "high",
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
    suggestedAction: item.shotIds.length ? "确认对应镜头" : "确认用途",
    reason: item.status === "ambiguous"
      ? "同一个素材可能对应多个用途，需要你确认后再写入项目。"
      : "匹配系统认为它需要复核，确认后再进入后续生成。",
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
  const allItems = [...reconciliationItems, ...assetItems].filter((item) => {
    const key = `${item.kind}:${item.label}:${item.suggestedBinding}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const items = allItems.slice(0, PROJECT_INBOX_ITEM_PREVIEW_LIMIT);
  const needsReviewCount = allItems.filter((item) => item.needsReview).length;
  const projectFolderCount = allItems.filter((item) => item.origin === "project_folder").length;
  const reconciliationCount = allItems.filter((item) => item.origin === "reconciliation").length;
  const projectAssetCount = allItems.length - reconciliationCount;
  return {
    totalCount: allItems.length,
    needsReviewCount,
    items,
    summary: projectFolderCount
      ? `项目文件夹里发现 ${projectFolderCount} 个素材，${needsReviewCount} 个还要看一眼。`
      : reconciliationCount
        ? `${reconciliationCount} 项参考匹配${projectAssetCount ? `，${projectAssetCount} 个项目素材` : ""}，${needsReviewCount} 项要看一眼。`
      : items.length
      ? `${items.length} 个素材已进入项目，${needsReviewCount} 个需要确认用途。`
      : "还没有放入素材；可以把脚本、图片、声音参考或素材文件夹拖到 AI 导演输入框。",
    nextAction: needsReviewCount
      ? reconciliationCount ? "先复核匹配建议和参考用途。" : "先确认这些素材分别怎么用。"
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
  if (isSystemManagedProjectFolderPath(normalizedPath)) return undefined;
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
  const searchText = assetSearchText(shell).toLowerCase();
  return {
    ...shell,
    type: assetTypeForFolderAsset(kind, searchText),
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
    return { status: "done", label: "视频已返回", detail: input.videoDetail || "可以预览并准备导出。" };
  }
  if (input.videoReviewCount > 0) {
    return { status: "review", label: "视频待复核", detail: "先看视频结果，再决定是否导出或重试。" };
  }
  if (input.videoCanResume) {
    return { status: "recoverable", label: "可查询结果", detail: "即梦任务已提交，查询不会重复提交。" };
  }
  if (input.videoWaitingCount > 0 || /submitted|queued|generating|running|in_progress/.test(input.videoStatus)) {
    return { status: "running", label: "视频排队中", detail: input.videoDetail || "保持串行等待结果。" };
  }
  if (/failed/.test(input.videoStatus)) {
    return { status: "failed", label: "视频失败", detail: input.videoDetail || "需要检查失败原因后重试。" };
  }
  if (input.videoExecutionValidated) {
    return { status: "idle", label: "视频未生成", detail: "本地执行合同已验证；没有提交或生成真实视频。" };
  }
  if (input.referenceExecutionValidated && input.shotCount > 0) {
    return { status: "ready", label: "可验证视频流程", detail: "参考执行合同已验证；真实参考仍未生成，因此只允许继续本地验证。" };
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
    : input.referenceExecutionValidated && (input.referenceMissingCount > 0 || input.referenceReviewCount > 0)
      ? {
          status: "missing" as const,
          label: "参考未生成",
          detail: "本地执行合同已验证；没有生成或锁定真实参考。",
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
  const needsReferenceGeneration = !input.referenceExecutionValidated && !input.image2Running && input.referenceMissingCount > 0;
  const needsAssetReview = !input.referenceExecutionValidated && !input.image2Running && (input.referenceReviewCount > 0 || Boolean(input.inbox?.needsReviewCount));
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
        ? assetReviewMissingDetail(input)
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
        : input.videoExecutionValidated
          ? "真实视频仍未生成；可以继续验证导出边界，或连接服务后实际执行。"
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
  const permissionIntent = detectDirectorAgentPermissionIntent(text);
  const referenceGenerationDisallowed = permissionIntent === "plan_only";
  const requestedShotCount = requestedStoryboardShotCountFromIntent(text);
  const explicitCurrentStoryShotCountRestructure = Boolean(
    requestedShotCount
      && /^(?:把|将|请把|请将)?\s*(?:当前|这个|这版)?\s*(?:故事|草案|项目|短片|视频|分镜|镜头)?\s*(?:改成|改为|调整成|调整为|换成|变成|重排成|重排为|拆成|分成|分为|整理成|整理为)/u.test(text),
  );
  const newStoryIntent = directorIntentStartsFreshVideoDraft(text)
    || /完整项目|整个短片|整支片/.test(text);
  if (isDirectorAgentExplainOnlyIntent(text)) {
    return {
      kind: "status",
      label: "说明下一步",
      target: "story",
      confirmation: "none",
      plan: ["读取当前项目", "说明接下来建议", "不写项目、不生成参考、不提交视频"],
    };
  }
  if (/导出|交付|打包|export/.test(text)) {
    return { kind: "export", label: "导出项目", target: "export", confirmation: "export", plan: ["检查可导出内容", "整理交付文件", "生成报告"] };
  }
  if (/查询|回来|结果|回流|状态/.test(text) && /视频|即梦|seedance/.test(text)) {
    return { kind: "video_status", label: "查询视频", target: "preview", confirmation: "none", plan: ["读取已提交任务", "查询回流状态", "更新预览"] };
  }
  const videoSubmitRequested = isVideoSubmitRequestIntent(text);
  if (videoSubmitRequested && directorAgentPermissionIntentDisallowsVideoSubmit(text)) {
    return {
      kind: "video",
      label: "检查视频前提",
      target: "preview",
      confirmation: "none",
      plan: ["识别到视频请求", "当前指令禁止外部提交", "不生成参考、不提交视频"],
    };
  }
  if (videoSubmitRequested) {
    return { kind: "video", label: "准备视频", target: "preview", confirmation: "video_submit", plan: ["检查故事和参考", "编译视频提示词", "确认后串行提交"] };
  }
  if (/查资料|查一下|搜一下|搜索|参考.*风格|研究|((分镜|风格|镜头|节奏).{0,8}怎么做)/.test(text)) {
    return { kind: "research", label: "查资料", target: "story", confirmation: "none", plan: ["整理检索问题", "保存可用资料", "等你确认后写入项目"] };
  }
  const referencePreparationRequested = isPositiveReferencePreparationIntent(text);
  if (referencePreparationRequested && referenceGenerationDisallowed) {
    return { kind: "reference", label: "准备参考计划", target: "assets", confirmation: "none", plan: ["判断缺少的角色、场景或道具参考", "整理参考范围和优先级", "不生成图片、不提交视频"] };
  }
  if (referencePreparationRequested) {
    return { kind: "reference", label: "生成参考", target: "assets", confirmation: "reference_generation", plan: ["判断缺少的角色、场景或道具参考", "确认生成范围", "生成后进入复核"] };
  }
  if (/(?:素材|文件|参考素材|项目材料|拖入文件).{0,16}(?:整理|分类|归类|绑定|匹配|建议|识别)|(?:整理|分类|归类|绑定|匹配|识别).{0,16}(?:素材|文件|参考素材|项目材料|拖入文件)|绑定建议/.test(text)) {
    return { kind: "reference", label: "整理素材", target: "assets", confirmation: "asset_review", plan: ["读取当前素材", "给出角色、场景、道具或声音绑定建议", "等你确认后再写入项目"] };
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
  if (explicitCurrentStoryShotCountRestructure && requestedShotCount) {
    return {
      kind: "revision",
      label: `重排为 ${requestedShotCount} 个镜头`,
      target: "story",
      confirmation: "none",
      plan: ["读取当前故事", `按要求重排为 ${requestedShotCount} 个镜头`, "确认后才写入项目"],
    };
  }
  if (newStoryIntent) {
    return { kind: "story", label: "整理新故事", target: "story", confirmation: "none", plan: ["理解新片方向", "重拆故事段落和镜头", "生成前先给你看草案"] };
  }
  if (requestedShotCount) {
    return {
      kind: "revision",
      label: `重排为 ${requestedShotCount} 个镜头`,
      target: "story",
      confirmation: "none",
      plan: ["读取当前故事", `按要求重排为 ${requestedShotCount} 个镜头`, "确认后才写入项目"],
    };
  }
  if (input.hasSelection || isShotRevisionIntent(text) || /改|调整|重写|替换|删|加|优化/.test(text)) {
    return { kind: "revision", label: "修改当前内容", target: "story", confirmation: "none", plan: ["读取当前选中内容", "整理成可确认修改", "确认后写入项目"] };
  }
  return { kind: "story", label: "整理故事", target: "story", confirmation: "none", plan: ["理解你的想法", "拆成故事段落和镜头", "生成前先给你看草案"] };
}
