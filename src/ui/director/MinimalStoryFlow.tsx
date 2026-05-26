import type { AssetRecord, ShotRecord } from "../../core/types";
import { MediaFrame } from "../common/MediaFrame";
import { usesEndpointEndFrame } from "./videoControlModeUi";

export function formatShotNumber(id: string) {
  const value = id.trim();
  if (value === "CURRENT_PROJECT" || /current[-_\s]*project/i.test(value)) return "当前项目";
  const match = id.match(/^A(\d+)_(\d+)$/i);
  if (match) return `${Number(match[1])}-${Number(match[2])}`;
  const shotMatch = id.match(/^shot_[a-f0-9]+_(\d+)$/i);
  if (shotMatch) return `1-${Number(shotMatch[1])}`;
  const storyboardShotMatch = id.match(/^shot[_\s-]*storyboard[_\s-]*(\d+)[_\s-]+(\d+)(?:[_\s-]+\d+)?$/i);
  if (storyboardShotMatch) return `${Number(storyboardShotMatch[1])}-${Number(storyboardShotMatch[2])}`;
  const simpleShotMatch = id.match(/^shot[_\s-]*0*(\d+)$/i);
  if (simpleShotMatch) return `${Number(simpleShotMatch[1])}`;
  return id;
}

export function cleanStoryText(value: string) {
  return value
    .replace(/\s*\/\s*sec(?:\b|[_\s-]).*$/i, "")
    .replace(/\bshot[_\s-]*[a-f0-9]+[_\s-]*(\d+)\b/gi, "镜头 $1")
    .replace(/\bshot[_\s-]*0*(\d+)(?=$|[_\s-])/gi, "镜头 $1")
    .replace(/\bsec[_\s-]*[a-f0-9]+(?:[_\s-]*\d+)?\b/gi, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+\/\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function displayShotNumber(id: string) {
  const formatted = formatShotNumber(id);
  return formatted === id ? cleanStoryText(id) || id : formatted;
}

const storyFunctionLabels = ["开场", "信号", "选择", "行动", "揭示", "测试", "转折", "决定", "回应", "收束"];

export function shortStoryFunction(shot: ShotRecord, index: number) {
  const value = shot.storyFunction.trim();
  if (shot.id === "CURRENT_PROJECT" || shot.issues.includes("current_project_story_pending")) {
    return value.includes("未同步") ? "等待同步" : "待补齐故事流";
  }
  if (/^setup$/i.test(value)) return "开场";
  if (/^[A-Za-z][A-Za-z\s-]{1,16}$/.test(value)) return value;
  return storyFunctionLabels[index % storyFunctionLabels.length];
}

function shotDisplayTitle(shot: ShotRecord, index: number) {
  return cleanStoryText(shot.title) || shortStoryFunction(shot, index) || "未命名镜头";
}

function shotDisplayBrief(shot: ShotRecord) {
  const brief = [shot.camera, shot.primaryAction, shot.actionTrigger, shot.microReaction]
    .map((value) => cleanStoryText(value || ""))
    .filter(Boolean)
    .join(" / ");
  return brief || "先确认镜头意图，再准备镜头参考和视频。";
}

export function shotStatusTone(shot: ShotRecord) {
  if (shot.status === "blocked" || shot.issues.some((issue) => issue.includes("missing"))) return "bad";
  if (shot.issues.length || shot.status === "video_missing") return "warn";
  return "ok";
}

export function shotStatusLabel(shot: ShotRecord) {
  if (shot.id === "CURRENT_PROJECT" || shot.issues.includes("current_project_story_pending")) return "待补齐";
  if (shot.status === "blocked" || shot.issues.some((issue) => issue.includes("missing"))) return "需复核";
  if (shot.issues.length || shot.status === "video_missing") return "待补齐";
  return "已就绪";
}

type FrameUiStatus = "pending" | "needs_review" | "approved" | "missing";

function shotFrameStatus(shot: ShotRecord, phase: "start" | "end"): FrameUiStatus {
  const hasFrame = phase === "start" ? Boolean(shot.startFrame) : Boolean(shot.endFrame);
  if (shot.status === "blocked") return "missing";
  if (shot.status === "keyframe_pair_ready") return "approved";
  if (!hasFrame) return "missing";
  if (shot.status === "assets_ready" || shot.status === "ready") return phase === "start" ? "needs_review" : "pending";
  if (shot.status === "video_missing") return phase === "start" ? "needs_review" : "missing";
  return "pending";
}

function frameStatusLabel(status: FrameUiStatus) {
  if (status === "approved") return "已通过";
  if (status === "needs_review") return "待复核";
  if (status === "missing") return "待补齐";
  return "待准备";
}

function referenceStatusLabel(status?: AssetRecord["lockedStatus"]) {
  if (status === "locked") return "已锁定";
  if (status === "not_generated") return "待补齐";
  return "待复核";
}

function referenceStatusTone(status?: AssetRecord["lockedStatus"]) {
  if (status === "locked") return "approved" as const;
  if (status === "not_generated") return "missing" as const;
  return "needs_review" as const;
}

type SceneReferenceUiStatus = "locked" | "needs_review" | "missing";

export function shotSceneReferenceStatus(shot: ShotRecord): SceneReferenceUiStatus {
  if (shot.status === "blocked" || shot.issues.some((issue) => /scene|reference|missing|缺|丢失/i.test(issue))) {
    return "missing";
  }
  if (shot.gates.scene === "PASS" && (shot.status === "assets_ready" || shot.status === "keyframe_pair_ready" || shot.status === "ready")) {
    return "locked";
  }
  return "needs_review";
}

function sceneReferenceStatusLabel(status: SceneReferenceUiStatus) {
  if (status === "locked") return "已锁定";
  if (status === "missing") return "待补齐";
  return "待复核";
}

function sceneReferenceStatusTone(status: SceneReferenceUiStatus) {
  if (status === "locked") return "ok";
  if (status === "missing") return "bad";
  return "warn";
}

function gateStatusTone(value: string) {
  if (value === "PASS" || value === "N/A") return "ok";
  if (value === "FAIL") return "bad";
  return "warn";
}

function gateStatusLabel(value: string) {
  if (value === "PASS" || value === "N/A") return "已就绪";
  if (value === "FAIL") return "待补齐";
  return "待确认";
}

function currentShotReferenceUi(
  shot: ShotRecord,
  sceneStatus: SceneReferenceUiStatus,
  shotStoryboardReference?: AssetRecord,
) {
  const strategy = shotReferenceStrategy(shot);
  const storyboardStatusTone = shotStoryboardReference?.path
    ? referenceStatusTone(shotStoryboardReference.lockedStatus)
    : strategy === "omni_reference" ? "ok" : "warn";
  return {
    identity: {
      label: shot.gates.identity === "PASS" ? "已锁定" : gateStatusLabel(shot.gates.identity),
      tone: gateStatusTone(shot.gates.identity),
    },
    scene: {
      label: sceneReferenceStatusLabel(sceneStatus),
      tone: sceneReferenceStatusTone(sceneStatus),
    },
    prop: {
      label: gateStatusLabel(shot.gates.prop),
      tone: gateStatusTone(shot.gates.prop),
    },
    story: {
      label: strategy === "omni_reference"
        ? "不需要故事板"
        : shotStoryboardReference?.path
          ? referenceStatusLabel(shotStoryboardReference.lockedStatus)
          : "待生成故事板",
      tone: storyboardStatusTone,
    },
  };
}

function currentShotReadiness(shot: ShotRecord, displayReference?: ShotDisplayReference) {
  const referenceReady = ["identity", "scene", "prop"].every((key) => {
    const value = shot.gates[key as keyof ShotRecord["gates"]];
    return value === "PASS" || value === "N/A";
  });
  const storyboardReady = shot.gates.story === "PASS" || shot.gates.story === "N/A";
  const visualTone = displayReference?.statusTone === "missing" ? "warn" : displayReference?.statusTone || "warn";
  return [
    {
      label: "参考分工",
      value: referenceReady ? "已分清" : "待确认",
      tone: referenceReady ? "ok" : "warn",
      detail: "角色、场景、道具各自只管一件事",
    },
    {
      label: "分镜策略",
      value: storyboardReady ? "已定策略" : "待拆清",
      tone: storyboardReady ? "ok" : "warn",
      detail: "时长、主动作、触发、切点",
    },
    {
      label: "画面参考",
      value: displayReference?.statusLabel || "待补齐",
      tone: visualTone,
      detail: "故事板镜头先生成故事板，全能参考镜头直接使用参考包",
    },
  ];
}

function isStoryboardReferenceAsset(asset: AssetRecord) {
  const searchable = [
    asset.id,
    asset.name,
    asset.path,
    ...(asset.textConstraints || []),
  ].join(" ").toLowerCase();
  return /storyboard|分镜|故事板/.test(searchable) && Boolean(asset.path);
}

function storyboardReferenceAssets(assets: AssetRecord[]) {
  return assets.filter(isStoryboardReferenceAsset);
}

function storyboardReferenceForShot(assets: AssetRecord[], shot: ShotRecord) {
  const shotId = shot.id.toLowerCase();
  return storyboardReferenceAssets(assets).find((asset) => {
    const searchable = [
      asset.id,
      asset.name,
      asset.path,
      ...(asset.textConstraints || []),
    ].join(" ").toLowerCase();
    return searchable.includes(shotId);
  });
}

function sequenceStoryboardReference(assets: AssetRecord[]) {
  return storyboardReferenceAssets(assets)[0];
}

function normalizedText(value?: string) {
  return (value || "").toLowerCase().replace(/\s+/g, "");
}

function identityKey(value?: string) {
  return (value || "").toLowerCase().replace(/[\s_-]+/g, "").trim();
}

function shotTextArrayField(shot: ShotRecord, key: string) {
  const value = (shot as ShotRecord & Record<string, unknown>)[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function shotExplicitAssetIds(shot: ShotRecord, type: AssetRecord["type"]) {
  if (type === "scene") return shotTextArrayField(shot, "sceneAssetIds");
  if (type === "character") return shotTextArrayField(shot, "characterAssetIds");
  if (type === "prop") return shotTextArrayField(shot, "propAssetIds");
  return [];
}

function assetIdentityKeys(asset: AssetRecord) {
  return [asset.id, asset.name, ...(asset.textConstraints || [])].map(identityKey).filter(Boolean);
}

function shotSearchText(shot: ShotRecord) {
  return normalizedText([
    shot.id,
    shot.title,
    shot.storyFunction,
    shot.camera,
    shot.primaryAction,
    shot.actionTrigger,
    shot.microReaction,
    shot.seedanceDirection,
    ...(shot.characterGuidance || []),
    ...(shot.sceneGuidance || []),
    ...(shot.propGuidance || []),
    ...shotTextArrayField(shot, "characterAssetIds"),
    ...shotTextArrayField(shot, "sceneAssetIds"),
    ...shotTextArrayField(shot, "propAssetIds"),
  ].filter(Boolean).join(" "));
}

function sceneClusterForText(value?: string) {
  const text = String(value || "").toLowerCase();
  const clusters = [
    { key: "old_bookstore", pattern: /旧书店|书店|书架|旧书|bookstore|bookshop|bookshelf|old\s*books?/i },
    { key: "train_station", pattern: /车站|站台|电车站|火车站|地铁站|train\s*station|railway\s*platform|subway\s*platform/i },
    { key: "lighthouse_interior", pattern: /灯塔内部|灯塔内|维修室|控制台|旧灯塔控制台|灯塔维修|lighthouse\s*(interior|inside|control\s*room)|control\s*room/i },
    { key: "lighthouse_exterior", pattern: /海雾小镇|灯塔外观|灯塔门口|灯塔灯束|海边灯塔|海岸灯塔|雨后.*灯塔|lighthouse\s*(exterior|outside)|coastal\s*(town|lighthouse)/i },
    { key: "whale_tram_ocean", pattern: /鲸鱼电车|鲸影|海面|海雾中.*电车|whale\s*tram|ocean|sea/i },
    { key: "convenience_store", pattern: /便利店(?:门口|入口|雨棚|店内|外)?|自动门|convenience\s*store/i },
    { key: "mountain_road", pattern: /山路|便利店外山路|山脊|跑山|发卡弯|雨夜山路|mountain\s*road|touge|hairpin|convenience\s*store\s*road/i },
    { key: "street", pattern: /街道|街边|路口|巷|雾中街道|湿漉漉的街|湿街|城市湿路|城市道路|城市路面|neon\s*street|city\s*street|street|alley/i },
    { key: "cafe", pattern: /咖啡馆|咖啡店|cafe|coffee\s*shop/i },
    { key: "rooftop", pattern: /屋顶|天台|rooftop/i },
  ];
  return clusters.find((item) => item.pattern.test(text))?.key;
}

function shotSceneCluster(shot: ShotRecord) {
  return sceneClusterForText([
    ...(shot.sceneGuidance || []),
    shot.sectionId,
    shot.storyFunction,
    shot.title,
  ].filter(Boolean).join(" "));
}

function resolvedSceneClusters(shots: ShotRecord[]) {
  const raw = shots.map(shotSceneCluster);
  const resolved = [...raw];
  let previous: string | undefined;
  for (let index = 0; index < resolved.length; index += 1) {
    if (resolved[index]) previous = resolved[index];
    else if (previous) resolved[index] = previous;
  }
  let next: string | undefined;
  for (let index = resolved.length - 1; index >= 0; index -= 1) {
    if (resolved[index]) next = resolved[index];
    else if (next) resolved[index] = next;
  }
  return resolved.map((value, index) => value || `scene_${index + 1}`);
}

function referenceSegmentForShot(shots: ShotRecord[], currentShot: ShotRecord) {
  const index = shots.findIndex((shot) => shot.id === currentShot.id);
  if (index < 0) return shots;
  const shotReferenceGroupId = (shot: ShotRecord) => cleanStoryText(
    String((shot as ShotRecord & Record<string, unknown>).storyboardGroupId
      || (shot as ShotRecord & Record<string, unknown>).videoSegmentId
      || (shot as ShotRecord & Record<string, unknown>).referenceGroupId
      || ""),
  );
  const currentGroupId = shotReferenceGroupId(currentShot);
  if (!currentGroupId) return [currentShot];
  const clusters = resolvedSceneClusters(shots);
  const target = clusters[index];
  let start = index;
  while (start > 0
    && clusters[start - 1] === target
    && shotReferenceGroupId(shots[start - 1]) === currentGroupId) start -= 1;
  let end = index;
  while (end + 1 < shots.length
    && clusters[end + 1] === target
    && shotReferenceGroupId(shots[end + 1]) === currentGroupId) end += 1;
  return shots.slice(start, end + 1);
}

function assetUsedByShotIds(asset: AssetRecord) {
  const maybe = (asset as AssetRecord & { usedByShotIds?: unknown }).usedByShotIds;
  return Array.isArray(maybe) ? maybe.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function assetSceneSpecificityPenalty(asset: AssetRecord) {
  const text = [asset.id, asset.name, ...(asset.textConstraints || [])].join(" ");
  const specificHints = ["书桌前", "窗边", "手部", "特写", "近景", "insert", "close-up", "桌面"];
  return specificHints.filter((hint) => text.includes(hint)).length * 0.2;
}

function assetMatchesShot(asset: AssetRecord, shot: ShotRecord) {
  const explicitAssetIds = shotExplicitAssetIds(shot, asset.type);
  if (explicitAssetIds.length) {
    const assetKeys = new Set(assetIdentityKeys(asset));
    return explicitAssetIds.some((id) => assetKeys.has(identityKey(id)));
  }
  const shotText = shotSearchText(shot);
  const assetNeedles = [
    asset.id,
    asset.name,
    ...(asset.textConstraints || []),
  ].map(normalizedText).filter((value) => value.length >= 2);
  if (asset.type === "scene") {
    const assetCluster = sceneClusterForText([asset.id, asset.name, ...(asset.textConstraints || [])].join(" "));
    const shotCluster = shotSceneCluster(shot);
    if (assetCluster && shotCluster && assetCluster === shotCluster) return true;
  }
  return assetNeedles.some((needle) => shotText.includes(needle) || needle.includes(shotText));
}

function bestReferenceAssetForShot(assets: AssetRecord[], shot: ShotRecord) {
  const typed = (type: AssetRecord["type"]) =>
    assets.find((asset) => asset.type === type && asset.path && !isStoryboardReferenceAsset(asset) && assetMatchesShot(asset, shot));
  return typed("scene") || typed("character") || typed("prop");
}

function bestReferenceAssetOfType(assets: AssetRecord[], shot: ShotRecord, type: AssetRecord["type"]) {
  return assets.find((asset) => asset.type === type && asset.path && !isStoryboardReferenceAsset(asset) && assetMatchesShot(asset, shot));
}

function representativeAssetOfType(assets: AssetRecord[], shots: ShotRecord[], type: AssetRecord["type"]) {
  return representativeAssetsOfType(assets, shots, type, 1)[0];
}

function representativeAssetsOfType(assets: AssetRecord[], shots: ShotRecord[], type: AssetRecord["type"], limit: number) {
  const shotIds = new Set(shots.map((shot) => shot.id));
  return assets
    .filter((asset) => asset.type === type && asset.path && !isStoryboardReferenceAsset(asset))
    .map((asset, index) => {
      const usedByShotRefs = asset.sourceRefs?.join(" ") || "";
      const text = [asset.id, asset.name, usedByShotRefs, ...assetUsedByShotIds(asset), ...(asset.textConstraints || [])].join(" ");
      const explicitOverlap = Array.from(shotIds).filter((shotId) => text.includes(shotId)).length;
      const semanticOverlap = shots.filter((shot) => assetMatchesShot(asset, shot)).length;
      const scenePenalty = type === "scene" ? assetSceneSpecificityPenalty(asset) : 0;
      return {
        asset,
        index,
        score: Math.max(explicitOverlap * 2, semanticOverlap) + (asset.lockedStatus === "locked" ? 0.25 : 0) - scenePenalty,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map((item) => item.asset);
}

function isPlannedFramePath(path?: string) {
  return Boolean(path && /(?:^|\/)planned\/keyframes\//.test(path.replace(/\\/g, "/")));
}

function isReferenceAssetPath(path?: string) {
  if (!path) return false;
  const normalized = path.replace(/\\/g, "/");
  return /(?:^|\/)assets\/generated\/(?:character_|prop_|scene_|style_|storyboard_)/.test(normalized);
}

function actualShotFramePath(path?: string) {
  if (!path || isPlannedFramePath(path) || isReferenceAssetPath(path)) return undefined;
  return path;
}

function referenceLabelForType(type?: AssetRecord["type"]) {
  if (type === "scene") return "场景参考";
  if (type === "character") return "角色参考";
  if (type === "prop") return "道具参考";
  return "镜头参考";
}

type ShotReferenceStrategy = "omni_reference" | "storyboard_narrative" | "storyboard_rapid_cut";

function shotReferenceStrategy(shot: ShotRecord): ShotReferenceStrategy {
  const raw = cleanStoryText((shot as ShotRecord & { referenceStrategy?: string }).referenceStrategy || "");
  if (raw === "storyboard_narrative" || /故事板叙事/.test(shot.seedanceDirection || "")) return "storyboard_narrative";
  if (raw === "storyboard_rapid_cut" || /故事板快切/.test(shot.seedanceDirection || "")) return "storyboard_rapid_cut";
  return "omni_reference";
}

function referenceStrategyLabel(strategy: ShotReferenceStrategy) {
  if (strategy === "storyboard_narrative") return "故事板叙事";
  if (strategy === "storyboard_rapid_cut") return "故事板快切";
  return "全能参考";
}

function referenceStrategyDetail(strategy: ShotReferenceStrategy) {
  if (strategy === "storyboard_narrative") return "先用故事板控制构图和人物关系";
  if (strategy === "storyboard_rapid_cut") return "先用故事板控制快切和动作节点";
  return "直接使用角色、场景、道具和文字导演提示";
}

function shotDisplayReference(shot: ShotRecord, fallbackReference?: AssetRecord, shotStoryboardReference?: AssetRecord) {
  const strategy = shotReferenceStrategy(shot);
  const actualStartFrame = actualShotFramePath(shot.startFrame);
  if (actualStartFrame) {
    return {
      src: actualStartFrame,
      label: strategy === "omni_reference" ? "镜头参考" : referenceStrategyLabel(strategy),
      statusLabel: frameStatusLabel(shotFrameStatus(shot, "start")),
      statusTone: shotFrameStatus(shot, "start"),
    };
  }
  if (shotStoryboardReference?.path) {
    const statusTone = referenceStatusTone(shotStoryboardReference.lockedStatus);
    return {
      src: shotStoryboardReference.path,
      label: referenceStrategyLabel(strategy),
      statusLabel: referenceStatusLabel(shotStoryboardReference.lockedStatus),
      statusTone,
    };
  }
  if (strategy !== "omni_reference") {
    return {
      src: undefined,
      label: referenceStrategyLabel(strategy),
      statusLabel: "待生成故事板",
      statusTone: "missing" as const,
    };
  }
  if (fallbackReference?.path) {
    const statusTone = referenceStatusTone(fallbackReference.lockedStatus);
    return {
      src: fallbackReference.path,
      label: referenceLabelForType(fallbackReference.type),
      statusLabel: referenceStatusLabel(fallbackReference.lockedStatus),
      statusTone,
    };
  }
  return {
    src: undefined,
    label: shot.videoControlMode === "text_only_draft" ? "文本计划" : "镜头参考",
    statusLabel: "待补齐",
    statusTone: "missing" as const,
  };
}

type ShotDisplayReference = ReturnType<typeof shotDisplayReference>;

function currentShotState(shot: ShotRecord, displayReference?: ShotDisplayReference) {
  if (!displayReference?.src) {
    return { label: displayReference?.statusLabel || "待补齐", tone: "warn" as const };
  }
  if (displayReference?.src && displayReference.statusLabel === "待复核") {
    return { label: "待复核", tone: "warn" as const };
  }
  if (displayReference?.src && shot.status === "video_missing") {
    return { label: "待复核", tone: "warn" as const };
  }
  return {
    label: shotStatusLabel(shot),
    tone: shotStatusTone(shot),
  };
}

function shotThumbnailReference(shot: ShotRecord, fallbackReference?: AssetRecord, shotStoryboardReference?: AssetRecord) {
  const actualStartFrame = actualShotFramePath(shot.startFrame);
  if (actualStartFrame) {
    return {
      src: actualStartFrame,
      label: "镜头参考",
      statusLabel: frameStatusLabel(shotFrameStatus(shot, "start")),
      statusTone: shotFrameStatus(shot, "start"),
    };
  }
  return shotDisplayReference(shot, fallbackReference, shotStoryboardReference);
}

function submittedReferenceBundle(assets: AssetRecord[], shots: ShotRecord[], shot: ShotRecord) {
  const segmentShots = referenceSegmentForShot(shots, shot);
  const hasStoryboardReference = shotReferenceStrategy(shot) !== "omni_reference";
  const sequenceStoryboard = hasStoryboardReference ? storyboardReferenceForShot(assets, shot) || sequenceStoryboardReference(assets) : undefined;
  const sceneReferences = [
    ...representativeAssetsOfType(assets, segmentShots, "scene", 1),
    ...[bestReferenceAssetOfType(assets, shot, "scene")].filter((asset): asset is AssetRecord => Boolean(asset)),
  ].filter((asset, index, list) => list.findIndex((item) => item.id === asset.id) === index).slice(0, 1);
  const characterReferences = [
    ...representativeAssetsOfType(assets, segmentShots, "character", 3),
    ...[bestReferenceAssetOfType(assets, shot, "character")].filter((asset): asset is AssetRecord => Boolean(asset)),
  ].filter((asset, index, list) => list.findIndex((item) => item.id === asset.id) === index).slice(0, 3);
  const propReferences = [
    ...representativeAssetsOfType(assets, segmentShots, "prop", 2),
    ...[bestReferenceAssetOfType(assets, shot, "prop")].filter((asset): asset is AssetRecord => Boolean(asset)),
  ].filter((asset, index, list) => list.findIndex((item) => item.id === asset.id) === index).slice(0, 2);
  const ordered: Array<{ label: string; asset?: AssetRecord; missingLabel?: string }> = [
    ...(hasStoryboardReference
      ? [{ label: "故事板", asset: sequenceStoryboard, missingLabel: "待生成故事板" }]
      : []),
    ...sceneReferences.map((asset) => ({ label: "场景/天气", asset })),
    ...characterReferences.map((asset) => ({ label: "角色身份", asset })),
    ...propReferences.map((asset) => ({ label: "道具", asset })),
  ];
  return ordered
    .filter((item) => Boolean(item.asset?.path || item.missingLabel))
    .map((item, index) => ({
      ...item,
      role: `图像${index + 1}`,
      statusLabel: item.asset?.path ? referenceStatusLabel(item.asset.lockedStatus) : item.missingLabel || "待补齐",
      statusTone: item.asset?.path ? referenceStatusTone(item.asset.lockedStatus) : "missing",
      id: item.asset?.id || `${shot.id}-${item.label}-missing`,
    }));
}

export function MinimalStoryFlow({
  sectionLabel,
  shots,
  assets = [],
  selectedShotId,
  selectedShotIds,
  onSelectShot,
}: {
  sectionLabel: string;
  shots: ShotRecord[];
  assets?: AssetRecord[];
  selectedShotId: string;
  selectedShotIds: string[];
  onSelectShot: (id: string, additive?: boolean) => void;
}) {
  const selectedSet = new Set(selectedShotIds.length ? selectedShotIds : [selectedShotId]);
  // Could memoize or compute once to avoid O(2n) scan
  const currentShot = shots.find((shot) => shot.id === selectedShotId) || shots[0];
  const currentIndex = currentShot ? shots.findIndex((shot) => shot.id === currentShot.id) : -1;
  const currentRequiresEndFrame = usesEndpointEndFrame(currentShot);
  const currentStartStatus = currentShot ? shotFrameStatus(currentShot, "start") : "missing";
  const currentEndStatus = currentShot && currentRequiresEndFrame ? shotFrameStatus(currentShot, "end") : "missing";
  const currentSceneStatus = currentShot ? shotSceneReferenceStatus(currentShot) : "missing";
  const currentStoryboardReference = currentShot ? storyboardReferenceForShot(assets, currentShot) : undefined;
  const currentFallbackReference = currentShot ? bestReferenceAssetForShot(assets, currentShot) : undefined;
  const currentDisplayReference = currentShot ? shotDisplayReference(currentShot, currentFallbackReference, currentStoryboardReference) : undefined;
  const referenceUi = currentShot ? currentShotReferenceUi(currentShot, currentSceneStatus, currentStoryboardReference) : undefined;
  const readiness = currentShot ? currentShotReadiness(currentShot, currentDisplayReference) : [];
  const currentState = currentShot ? currentShotState(currentShot, currentDisplayReference) : undefined;
  const currentStrategy = currentShot ? shotReferenceStrategy(currentShot) : undefined;
  const currentReferenceSegment = currentShot ? referenceSegmentForShot(shots, currentShot) : [];
  const currentSubmittedBundle = currentShot ? submittedReferenceBundle(assets, shots, currentShot) : [];
  const displaySection = cleanStoryText(sectionLabel) || "故事流";
  return (
    <main className="minimal-story-flow current-shot-flow">
      <div className="minimal-section-head">
        <div>
          <span>故事流</span>
          <h2 title={sectionLabel}>{displaySection.length > 24 ? `${displaySection.slice(0, 23).trim()}...` : displaySection}</h2>
        </div>
        <small>{shots.length} 个镜头</small>
      </div>
      {currentShot ? (
        <section className="current-shot-workbench" aria-label="当前镜头">
          <div className="current-shot-head">
            <div>
              <span>当前镜头</span>
              <h3 title={currentShot.title}>
                镜头 {displayShotNumber(currentShot.id)} {shotDisplayTitle(currentShot, Math.max(currentIndex, 0))}
              </h3>
              {currentStrategy && (
                <div className="current-shot-strategy-row" aria-label="参考模式">
                  <b>{referenceStrategyLabel(currentStrategy)}</b>
                  <small>{referenceStrategyDetail(currentStrategy)}</small>
                </div>
              )}
              <p>{shotDisplayBrief(currentShot).slice(0, 96)}</p>
            </div>
            <small className={`current-shot-state ${currentState?.tone || shotStatusTone(currentShot)}`}>
              {currentState?.label || shotStatusLabel(currentShot)}
            </small>
          </div>
          <div className={`current-frame-pair ${currentRequiresEndFrame ? "" : "single-frame"}`}>
            <figure>
              <figcaption>
                <span>{currentDisplayReference?.label || "镜头参考"}</span>
                <small className={currentDisplayReference?.statusTone || currentStartStatus}>
                  {currentDisplayReference?.statusLabel || frameStatusLabel(currentStartStatus)}
                </small>
              </figcaption>
              <MediaFrame
                src={currentDisplayReference?.src}
                alt={`${cleanStoryText(currentShot.title) || "当前镜头"} ${currentDisplayReference?.label || "镜头参考"}`}
                label={currentDisplayReference?.label || "镜头参考"}
                className="current-frame-image"
              />
            </figure>
            {currentRequiresEndFrame && (
              <figure>
                <figcaption>
                  <span>尾帧参考</span>
                  <small className={currentEndStatus}>{frameStatusLabel(currentEndStatus)}</small>
                </figcaption>
                <MediaFrame
                  src={currentShot.endFrame}
                  alt={`${cleanStoryText(currentShot.title) || "当前镜头"} 尾帧参考`}
                  label="尾帧参考"
                  className="current-frame-image"
                />
              </figure>
            )}
          </div>
          {currentSubmittedBundle.length > 0 && (
            <div className="submitted-reference-strip" aria-label="视频提交参考包">
              <div>
                <small>实际提交参考</small>
                <strong>
                  {currentReferenceSegment.length > 1 ? `本段 ${currentReferenceSegment.length} 镜头 · 共享参考` : "本镜头参考"}
                </strong>
              </div>
              {currentSubmittedBundle.map((item) => (
                <span key={`${item.role}-${item.id}`} className={item.asset?.path ? "" : "missing"}>
                  <MediaFrame
                    src={item.asset?.path}
                    alt={`${item.role} ${item.label} ${item.asset?.name || item.statusLabel}`}
                    label={item.statusLabel || item.label}
                    className="submitted-reference-thumb"
                  />
                  <em>{item.role}</em>
                  <strong>{item.label}</strong>
                  {!item.asset?.path && <small>{item.statusLabel}</small>}
                </span>
              ))}
            </div>
          )}
          <div className="shot-reference-strip" aria-label="本片参考">
            <span>
              <small>角色参考</small>
              <strong>{referenceUi?.identity.label}</strong>
              <em>只管身份和外观</em>
              <i className={`dot ${referenceUi?.identity.tone || "warn"}`} />
            </span>
            <span>
              <small>场景参考</small>
              <strong>{referenceUi?.scene.label}</strong>
              <em>只管空间和天气</em>
              <i className={`dot ${referenceUi?.scene.tone || "warn"}`} />
            </span>
            <span>
              <small>道具参考</small>
              <strong>{referenceUi?.prop.label}</strong>
              <em>只管形状和交互</em>
              <i className={`dot ${referenceUi?.prop.tone || "warn"}`} />
            </span>
            <span>
              <small>故事板参考</small>
              <strong>{referenceUi?.story.label}</strong>
              <em>只管构图和动作</em>
              <i className={`dot ${referenceUi?.story.tone || "warn"}`} />
            </span>
          </div>
          <div className="current-shot-checklist" aria-label="生成前检查">
            {readiness.map((item) => (
              <span key={item.label} className={item.tone}>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
                <em>{item.detail}</em>
              </span>
            ))}
          </div>
        </section>
      ) : (
        <section className="current-shot-workbench empty" aria-label="当前镜头">
          <div className="minimal-empty-line">确认草案后，当前镜头会显示在这里。</div>
        </section>
      )}
      <div className="minimal-shot-grid filmstrip-shot-grid" aria-label="分镜胶片条">
        {shots.map((shot, index) => {
          const storyboardReference = storyboardReferenceForShot(assets, shot);
          const fallbackReference = bestReferenceAssetForShot(assets, shot);
          const thumbnailReference = shotThumbnailReference(shot, fallbackReference, storyboardReference);
          const cardState = currentShotState(shot, thumbnailReference);
          const strategy = shotReferenceStrategy(shot);
          return (
            <button
              key={shot.id}
              className={`minimal-shot-card filmstrip-shot ${selectedSet.has(shot.id) ? "selected" : ""} ${selectedShotId === shot.id ? "primary" : ""}`}
              onClick={(event) => onSelectShot(shot.id, event.metaKey || event.ctrlKey || event.shiftKey)}
              aria-pressed={selectedSet.has(shot.id)}
            >
              <MediaFrame
                src={thumbnailReference.src || (usesEndpointEndFrame(shot) ? shot.endFrame : undefined)}
                alt={shot.title}
                label={displayShotNumber(shot.id)}
                className="minimal-shot-image"
              />
              <span className="minimal-shot-caption">
                <strong>{displayShotNumber(shot.id)}</strong>
                <span>{shotDisplayTitle(shot, index)}</span>
                <i className={`dot ${cardState.tone}`} aria-label={cardState.label} />
              </span>
              <small className="minimal-shot-strategy">{referenceStrategyLabel(strategy)}</small>
              <span className="minimal-frame-status" aria-label="镜头状态">
                <small className={cardState.tone}>{cardState.label}</small>
              </span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
