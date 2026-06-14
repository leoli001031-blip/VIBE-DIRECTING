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
  | "music"
  | "voice"
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
  kind: ProjectInboxKind;
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

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function compact(value: unknown) {
  return clean(value).toLowerCase();
}

function pathExtension(value: string) {
  const match = value.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
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

function projectInboxKindForAsset(asset: AssetRecord): ProjectInboxKind {
  const searchable = compact(assetSearchText(asset));
  const extension = pathExtension(asset.path);
  if (/\b(storyboard|panel|shotboard)\b|故事板|分镜/.test(searchable)) return "storyboard";
  if (/music_reference|\b(bgm|song|score|soundtrack)\b|配乐|音乐|歌曲/.test(searchable)) return "music";
  if (/voice_reference|\b(voice|tts|speaker|dialogue)\b|音色|声音|配音|对白|台词/.test(searchable)) return "voice";
  if (asset.type === "character") return "character";
  if (asset.type === "scene") return "scene";
  if (asset.type === "prop") return "prop";
  if (asset.type === "style") return "reference";
  if (["txt", "md", "srt"].includes(extension)) return "script";
  if (["wav", "mp3", "m4a", "aac", "flac", "ogg"].includes(extension)) return "voice";
  if (["png", "jpg", "jpeg", "webp"].includes(extension)) return "reference";
  return "unknown";
}

function inboxKindLabel(kind: ProjectInboxKind) {
  if (kind === "script") return "脚本";
  if (kind === "character") return "角色";
  if (kind === "scene") return "场景";
  if (kind === "prop") return "道具";
  if (kind === "storyboard") return "故事板";
  if (kind === "music") return "配乐";
  if (kind === "voice") return "声音";
  if (kind === "reference") return "参考";
  return "待判断";
}

function assetNeedsReview(asset: AssetRecord) {
  return asset.lockedStatus === "candidate"
    || asset.lockedStatus === "needs_review"
    || asset.status === "exists"
    || asset.status === "generated";
}

function assetBindingLabel(asset: AssetRecord) {
  const role = clean(asset.roleBinding?.role);
  const shots = (asset.usedByShotIds || asset.roleBinding?.useFor || []).map(clean).filter(Boolean);
  const kind = projectInboxKindForAsset(asset);
  if (shots.length) return `建议绑定到 ${shots.slice(0, 3).join("、")}${shots.length > 3 ? ` 等 ${shots.length} 处` : ""}`;
  if (role) return `建议作为${role}`;
  if (kind === "reference") return "建议作为风格或画面参考";
  if (kind === "music") return "建议作为配乐参考";
  if (kind === "voice") return "建议作为声音参考";
  if (asset.type !== "unknown") return `建议作为${inboxKindLabel(kind)}参考`;
  return "需要 Agent 判断用途";
}

function inboxItemFromAsset(asset: AssetRecord): ProjectInboxItem | undefined {
  if (asset.status === "missing" || asset.status === "planned" || asset.status === "rejected") return undefined;
  const kind = projectInboxKindForAsset(asset);
  return {
    id: `asset:${asset.id}`,
    kind,
    label: asset.name || inboxKindLabel(kind),
    detail: `${inboxKindLabel(kind)} · ${asset.lockedStatus === "locked" ? "已可复用" : "等待确认用途"}`,
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
      ? "music"
      : item.kind === "voice_reference"
        ? "voice"
        : item.kind === "style"
          ? "reference"
          : item.kind;
  return {
    id: `reconciliation:${item.id}`,
    kind,
    label: item.label,
    detail: `${inboxKindLabel(kind)} · ${item.status === "ambiguous" ? "用途不够确定" : "等待确认"}`,
    suggestedBinding: item.shotIds.length ? `建议绑定到 ${item.shotIds.slice(0, 3).join("、")}` : "建议先确认用途",
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
  }).slice(0, 8);
  const needsReviewCount = items.filter((item) => item.needsReview).length;
  return {
    totalCount: items.length,
    needsReviewCount,
    items,
    summary: items.length
      ? `${items.length} 个素材已进入项目，${needsReviewCount} 个需要确认用途。`
      : "还没有放入素材；可以把脚本、图片、音乐直接拖到底部输入框。",
    nextAction: needsReviewCount
      ? "先确认素材要绑定到哪里。"
      : items.length
        ? "素材已可供 Agent 规划使用。"
        : "拖入素材或直接描述项目想法。",
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
        detail: `缺少 ${input.referenceMissingCount} 项参考，生成前会请你确认。`,
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
  const needsVideoSubmit = video.status === "ready";
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
        ? "先补齐角色、场景、关键道具或故事板参考。"
        : needsAssetReview
          ? "先复核参考和素材绑定，再继续生成视频。"
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
  if (/查资料|搜索|参考.*风格|研究/.test(text)) {
    return { kind: "research", label: "查资料", target: "story", confirmation: "none", plan: ["整理检索问题", "保存可用资料", "等你确认后写入项目"] };
  }
  if (/补.*参考|生成.*参考|角色图|场景图|道具图|故事板/.test(text)) {
    return { kind: "reference", label: "补齐参考", target: "assets", confirmation: "reference_generation", plan: ["判断缺少的参考", "确认生成范围", "生成后进入复核"] };
  }
  if (!text && input.hasAttachments) {
    return { kind: "reference", label: "整理素材", target: "assets", confirmation: "asset_review", plan: ["识别拖入文件", "建议绑定到角色、场景或镜头", "需要时请你确认"] };
  }
  if (!text) {
    return { kind: "status", label: "检查项目", target: "story", confirmation: input.observation.currentTask.confirmation.kind, plan: [input.observation.currentTask.understanding, input.observation.currentTask.plan] };
  }
  if (newStoryIntent) {
    return { kind: "story", label: "整理新故事", target: "story", confirmation: "none", plan: ["理解新片方向", "重拆故事段落和镜头", "生成前先给你看草案"] };
  }
  if (input.hasSelection || /改|调整|重写|替换|删|加|优化/.test(text)) {
    return { kind: "revision", label: "修改当前内容", target: "story", confirmation: "none", plan: ["读取当前选中内容", "整理成可确认修改", "确认后写入项目"] };
  }
  return { kind: "story", label: "整理故事", target: "story", confirmation: "none", plan: ["理解你的想法", "拆成故事段落和镜头", "生成前先给你看草案"] };
}
