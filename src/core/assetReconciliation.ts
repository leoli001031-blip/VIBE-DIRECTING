import {
  classifyReferenceAssetText,
  referenceAssetCandidates,
  referenceConstraintBuckets,
} from "./referenceAssetStrategy";
import type { AssetRecord, ShotRecord } from "./types";

export type AssetReconciliationKind =
  | "character"
  | "scene"
  | "prop"
  | "style"
  | "storyboard_reference"
  | "voice_reference"
  | "music_reference";

export type AssetReconciliationStatus =
  | "matched"
  | "needs_review"
  | "missing"
  | "merged"
  | "unused"
  | "ambiguous";

export interface AssetReconciliationItem {
  id: string;
  kind: AssetReconciliationKind;
  label: string;
  status: AssetReconciliationStatus;
  detail: string;
  shotIds: string[];
  assetIds: string[];
  confidence: "high" | "medium" | "low";
  source: "story" | "project_assets" | "imported_assets" | "inferred";
  reason: string;
}

export interface AssetReconciliationProjection {
  summary: {
    total: number;
    matched: number;
    needsReview: number;
    missing: number;
    merged: number;
    unused: number;
    ambiguous: number;
  };
  items: AssetReconciliationItem[];
  creatorSummary: string;
  nextAction: string;
}

interface AssetRequirement {
  id: string;
  kind: AssetReconciliationKind;
  label: string;
  shotIds: string[];
  source: AssetReconciliationItem["source"];
  reason: string;
}

interface CandidateScore {
  asset: AssetRecord;
  score: number;
  exact: boolean;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function compact(value: unknown): string {
  return clean(value).toLowerCase().replace(/[\s._-]+/g, "");
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function stableId(value: string) {
  return compact(value).replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 64) || "item";
}

function firstUseful(values: unknown[]) {
  return values.map(clean).find(Boolean) || "";
}

function sourceText(asset: AssetRecord) {
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

function roleText(asset: AssetRecord) {
  return [
    asset.roleBinding?.role,
    ...(asset.roleBinding?.useFor || []),
    ...(asset.roleBinding?.ignoreFor || []),
  ].map(clean).join(" ").toLowerCase();
}

function hasVoiceReferenceSignal(value: string) {
  return /voice_reference|audio_reference|dialogue_audio|voice|speaker|dialogue|speech|tts|音色|声音|声线|人声|语音|配音|对白|台词/.test(value);
}

function hasMusicReferenceSignal(value: string) {
  return /music_reference|\b(bgm|music|song|score|soundtrack|eurobeat|ost)\b|背景音乐|配乐|音乐|歌曲/.test(value);
}

function assetKind(asset: AssetRecord): AssetReconciliationKind | undefined {
  const searchable = `${sourceText(asset)} ${roleText(asset)}`.toLowerCase();
  const hasVoiceSignal = hasVoiceReferenceSignal(searchable);
  const hasMusicSignal = hasMusicReferenceSignal(searchable);
  const audioPath = clean(asset.path).toLowerCase();
  if (/storyboard|故事板|分镜/.test(searchable)) return "storyboard_reference";
  if (hasVoiceSignal) return "voice_reference";
  if (hasMusicSignal) return undefined;
  if (/\.(wav|mp3|m4a|aac|flac|ogg)$/.test(audioPath)) return "voice_reference";
  if (asset.type === "character" || asset.type === "scene" || asset.type === "prop" || asset.type === "style") return asset.type;
  return undefined;
}

function assetIsImportLike(asset: AssetRecord) {
  const searchable = sourceText(asset).toLowerCase();
  return /import|upload|drag|drop|用户|素材|file|local/.test(searchable);
}

function assetReviewStatus(asset: AssetRecord): AssetReconciliationStatus | undefined {
  if (asset.status === "rejected") return undefined;
  if (asset.status === "missing" || asset.status === "planned" || asset.lockedStatus === "not_generated") return "missing";
  if (asset.lockedStatus === "locked") return "matched";
  if (asset.lockedStatus === "candidate" || asset.lockedStatus === "needs_review") return "needs_review";
  if (asset.status === "exists" || asset.status === "generated") return "needs_review";
  return undefined;
}

function hasShotOverlap(requirement: AssetRequirement, asset: AssetRecord) {
  const ids = new Set(requirement.shotIds);
  return Boolean(asset.usedByShotIds?.some((id) => ids.has(id)));
}

function roleUsesRequirementShot(requirement: AssetRequirement, asset: AssetRecord) {
  const uses = asset.roleBinding?.useFor || [];
  return requirement.shotIds.some((shotId) => uses.some((value) => compact(value) === compact(shotId)));
}

function scoreCandidate(requirement: AssetRequirement, asset: AssetRecord): CandidateScore | undefined {
  if (assetKind(asset) !== requirement.kind) return undefined;
  const status = assetReviewStatus(asset);
  if (!status || status === "missing") return undefined;
  const searchable = compact(sourceText(asset));
  const label = compact(requirement.label);
  const name = compact(asset.name);
  let score = 0;
  let exact = false;
  if (label && (searchable.includes(label) || label.includes(name))) {
    score += 8;
    exact = true;
  }
  if (roleUsesRequirementShot(requirement, asset)) {
    score += 5;
    if (requirement.kind === "storyboard_reference" || requirement.kind === "voice_reference" || requirement.kind === "music_reference") exact = true;
  }
  if (hasShotOverlap(requirement, asset)) score += 4;
  if (requirement.shotIds.some((id) => searchable.includes(compact(id)))) {
    score += 3;
    if (requirement.kind === "storyboard_reference" || requirement.kind === "voice_reference" || requirement.kind === "music_reference") exact = true;
  }
  if (score > 0 && asset.type === requirement.kind) score += 1;
  if (score > 0 && asset.lockedStatus === "locked") score += 1;
  if (score > 0 && assetIsImportLike(asset)) score += 1;
  return score >= 4 ? { asset, score, exact } : undefined;
}

function addRequirement(requirements: Map<string, AssetRequirement>, input: Omit<AssetRequirement, "id" | "shotIds"> & { shotId?: string }) {
  const label = clean(input.label);
  if (!label) return;
  const key = `${input.kind}:${stableId(label)}`;
  const existing = requirements.get(key);
  if (existing) {
    requirements.set(key, {
      ...existing,
      shotIds: unique([...existing.shotIds, input.shotId]),
    });
    return;
  }
  requirements.set(key, {
    id: key,
    kind: input.kind,
    label,
    shotIds: unique([input.shotId]),
    source: input.source,
    reason: input.reason,
  });
}

function addMerged(items: AssetReconciliationItem[], input: {
  kind: AssetReconciliationKind;
  label: string;
  shotId: string;
  detail: string;
  reason: string;
}) {
  const label = clean(input.label);
  if (!label) return;
  const id = `merged:${input.kind}:${input.shotId}:${stableId(label)}`;
  if (items.some((item) => item.id === id)) return;
  items.push({
    id,
    kind: input.kind,
    label,
    status: "merged",
    detail: input.detail,
    shotIds: [input.shotId],
    assetIds: [],
    confidence: "high",
    source: "inferred",
    reason: input.reason,
  });
}

function shotRequiresVoice(shot: ShotRecord) {
  const audio = `${clean(shot.audioUsage)} ${clean(shot.sound)}`.toLowerCase();
  return Boolean(shot.dialogueLines?.some(clean)) || /voice|dialogue|tts|配音|对白|台词|人声|旁白/.test(audio);
}

export function buildAssetRequirementsFromStory(shots: ShotRecord[]): {
  requirements: AssetRequirement[];
  mergedItems: AssetReconciliationItem[];
} {
  const requirements = new Map<string, AssetRequirement>();
  const mergedItems: AssetReconciliationItem[] = [];

  for (const shot of shots) {
    const characterCandidates = referenceAssetCandidates(shot.characterGuidance || [], "character");
    const sceneCandidates = referenceAssetCandidates(shot.sceneGuidance || [], "scene");
    const propBuckets = referenceConstraintBuckets(shot.propGuidance || []);

    for (const label of characterCandidates) {
      addRequirement(requirements, {
        kind: "character",
        label,
        shotId: shot.id,
        source: "story",
        reason: "镜头里出现的角色身份，需要可复用角色参考。",
      });
    }
    if (!characterCandidates.length && firstUseful(shot.characterGuidance || [])) {
      addRequirement(requirements, {
        kind: "character",
        label: firstUseful(shot.characterGuidance || []),
        shotId: shot.id,
        source: "story",
        reason: "镜头有角色描述，需要确认是否已有角色参考。",
      });
    }

    for (const label of sceneCandidates) {
      addRequirement(requirements, {
        kind: "scene",
        label,
        shotId: shot.id,
        source: "story",
        reason: "镜头有明确地点或天气基准，需要场景参考。",
      });
    }
    if (!sceneCandidates.length && firstUseful(shot.sceneGuidance || [])) {
      addRequirement(requirements, {
        kind: "scene",
        label: firstUseful(shot.sceneGuidance || []),
        shotId: shot.id,
        source: "story",
        reason: "镜头有场景描述，需要确认是否已有场景参考。",
      });
    }

    for (const label of propBuckets.standalone) {
      addRequirement(requirements, {
        kind: "prop",
        label,
        shotId: shot.id,
        source: "story",
        reason: "镜头里有可独立复用的道具或主体物。",
      });
    }
    for (const label of propBuckets.objectConstraints) {
      const classification = classifyReferenceAssetText(label);
      addMerged(mergedItems, {
        kind: "prop",
        label,
        shotId: shot.id,
        detail: "已并入父级道具或动作说明，不单独生成参考。",
        reason: classification.reason,
      });
    }
    for (const label of propBuckets.sceneConstraints) {
      addMerged(mergedItems, {
        kind: "scene",
        label,
        shotId: shot.id,
        detail: "已并入场景/天气参考，不单独生成素材。",
        reason: "scene_constraint",
      });
    }
    for (const label of propBuckets.characterConstraints) {
      addMerged(mergedItems, {
        kind: "character",
        label,
        shotId: shot.id,
        detail: "已并入角色外观或表演说明，不单独生成参考。",
        reason: "character_constraint",
      });
    }

    if (shot.referenceStrategy && shot.referenceStrategy !== "omni_reference") {
      addRequirement(requirements, {
        kind: "storyboard_reference",
        label: `${shot.title || shot.id} 故事板参考`,
        shotId: shot.id,
        source: "story",
        reason: "该镜头使用故事板模式，需要故事板参考控制顺序与动作。",
      });
    }
    if (shotRequiresVoice(shot)) {
      addRequirement(requirements, {
        kind: "voice_reference",
        label: `${shot.title || shot.id} 声音参考`,
        shotId: shot.id,
        source: "story",
        reason: "镜头包含台词或配音意图，需要确认声音素材。",
      });
    }
  }

  return {
    requirements: [...requirements.values()],
    mergedItems,
  };
}

function itemFromRequirement(requirement: AssetRequirement, candidates: CandidateScore[]): AssetReconciliationItem {
  const sorted = [...candidates].sort((left, right) => right.score - left.score);
  const strong = sorted.filter((candidate) => candidate.score >= 9 || candidate.exact);
  const top = strong[0] || sorted[0];
  if (!top) {
    return {
      id: requirement.id,
      kind: requirement.kind,
      label: requirement.label,
      status: "missing",
      detail: "还没有找到可用素材，需要生成或拖入项目。",
      shotIds: requirement.shotIds,
      assetIds: [],
      confidence: "low",
      source: requirement.source,
      reason: requirement.reason,
    };
  }
  if (strong.length > 1) {
    return {
      id: requirement.id,
      kind: requirement.kind,
      label: requirement.label,
      status: "ambiguous",
      detail: `找到 ${strong.length} 个可能素材，需要选一个。`,
      shotIds: requirement.shotIds,
      assetIds: strong.map((candidate) => candidate.asset.id),
      confidence: "medium",
      source: "project_assets",
      reason: requirement.reason,
    };
  }
  const status = assetReviewStatus(top.asset);
  const source = assetIsImportLike(top.asset) ? "imported_assets" : "project_assets";
  if (top.score >= 8 && status === "matched") {
    return {
      id: requirement.id,
      kind: requirement.kind,
      label: requirement.label,
      status: "matched",
      detail: `已匹配：${top.asset.name || top.asset.id}`,
      shotIds: requirement.shotIds,
      assetIds: [top.asset.id],
      confidence: "high",
      source,
      reason: requirement.reason,
    };
  }
  return {
    id: requirement.id,
    kind: requirement.kind,
    label: requirement.label,
    status: status === "matched" && top.score >= 6 ? "matched" : "needs_review",
    detail: `可能匹配：${top.asset.name || top.asset.id}`,
    shotIds: requirement.shotIds,
    assetIds: [top.asset.id],
    confidence: top.score >= 8 ? "high" : "medium",
    source,
    reason: requirement.reason,
  };
}

function unusedAssetItems(assets: AssetRecord[], matchedAssetIds: Set<string>): AssetReconciliationItem[] {
  return assets
    .filter((asset) => !matchedAssetIds.has(asset.id))
    .filter((asset) => assetReviewStatus(asset) && assetReviewStatus(asset) !== "missing")
    .map((asset): AssetReconciliationItem | undefined => {
      const kind = assetKind(asset);
      if (!kind) return undefined;
      return {
        id: `unused:${asset.id}`,
        kind,
        label: asset.name || asset.id,
        status: "unused" as const,
        detail: "项目里已有，但这轮故事暂时没有用到。",
        shotIds: asset.usedByShotIds || [],
        assetIds: [asset.id],
        confidence: "low" as const,
        source: assetIsImportLike(asset) ? "imported_assets" as const : "project_assets" as const,
        reason: "not_referenced_by_current_story",
      };
    })
    .filter((item): item is AssetReconciliationItem => item !== undefined);
}

function creatorSummary(summary: AssetReconciliationProjection["summary"]) {
  if (!summary.total) return "当前没有需要匹配的素材。";
  return `已匹配 ${summary.matched} · 待确认 ${summary.needsReview + summary.ambiguous} · 缺 ${summary.missing}`;
}

function nextAction(summary: AssetReconciliationProjection["summary"]) {
  if (!summary.total) return "继续整理";
  if (summary.missing > 0) return "让 AI 准备参考";
  if (summary.needsReview + summary.ambiguous > 0) return "确认素材匹配";
  return "素材已就绪";
}

export function buildAssetReconciliationProjection(input: {
  shots: ShotRecord[];
  assets: AssetRecord[];
}): AssetReconciliationProjection {
  const { requirements, mergedItems } = buildAssetRequirementsFromStory(input.shots);
  const matchedAssetIds = new Set<string>();
  const requirementItems = requirements.map((requirement) => {
    const candidates = input.assets
      .map((asset) => scoreCandidate(requirement, asset))
      .filter((candidate): candidate is CandidateScore => Boolean(candidate));
    const item = itemFromRequirement(requirement, candidates);
    for (const assetId of item.assetIds) matchedAssetIds.add(assetId);
    return item;
  });
  const unusedItems = unusedAssetItems(input.assets, matchedAssetIds);
  const items = [...requirementItems, ...mergedItems, ...unusedItems];
  const summary = {
    total: items.filter((item) => item.status !== "unused").length,
    matched: items.filter((item) => item.status === "matched").length,
    needsReview: items.filter((item) => item.status === "needs_review").length,
    missing: items.filter((item) => item.status === "missing").length,
    merged: items.filter((item) => item.status === "merged").length,
    unused: items.filter((item) => item.status === "unused").length,
    ambiguous: items.filter((item) => item.status === "ambiguous").length,
  };
  return {
    summary,
    items,
    creatorSummary: creatorSummary(summary),
    nextAction: nextAction(summary),
  };
}
