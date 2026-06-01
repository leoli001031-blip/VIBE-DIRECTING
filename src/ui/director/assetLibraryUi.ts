import type { AssetRecord } from "../../core/types";
import {
  validateAssetLibrarySnapshot,
  type AssetLibraryAsset,
  type AssetLibraryAssetType,
  type AssetLibrarySnapshot,
  type AssetLibraryStatus,
} from "../../core/assetLibraryCrud";
import type { AssetLibraryUiStatus } from "./directorTypes";

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function cleanLabel(value: string) {
  return value
    .replace(/^asset_/i, "")
    .replace(/_/g, " ")
    .replace(/\bshot\s+0*(\d+)\b/gi, "镜头 $1")
    .replace(/\s+/g, " ")
    .trim();
}

export function assetStatusTone(asset: AssetRecord) {
  if (asset.status === "missing" || asset.lockedStatus === "not_generated") return "bad";
  if (asset.lockedStatus === "candidate" || asset.lockedStatus === "needs_review" || asset.issues.length) return "warn";
  return "ok";
}

export function splitConstraints(value: string) {
  return uniqueStrings(value.split(/\n|；|;|,/g));
}

export function safeAssetId(value: string, type: AssetLibraryAssetType) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return `${type}_${slug || "asset"}_${Date.now().toString(36).slice(-4)}`;
}

export function assetLibraryTypeLabel(type: AssetLibraryAssetType) {
  if (type === "character") return "角色参考";
  if (type === "scene") return "场景/天气参考";
  if (type === "voice_anchor") return "音频参考";
  return "道具参考";
}

export function assetLibraryStatusLabel(status: AssetLibraryUiStatus | AssetLibraryStatus) {
  return status === "locked" ? "已锁定" : "待复核";
}

export function uiStatusToAssetLibraryStatus(status: AssetLibraryUiStatus): AssetLibraryStatus {
  return status === "needs_review" ? "review" : status;
}

export function assetLibraryStatusToUiStatus(status: AssetLibraryStatus): AssetLibraryUiStatus {
  if (status === "review" || status === "missing") return "needs_review";
  return status;
}

export function assetSourceKindForPath(path?: string) {
  const normalized = (path || "").replace(/\\/g, "/").toLowerCase();
  if (/contact[-_ ]?sheet/.test(normalized)) return "contact_sheet" as const;
  if (/(^|\/)(tmp|temp|cache|candidates?|drafts?)(\/|$)/.test(normalized)) return "provider_temp_output" as const;
  if (/(^|\/)(failed|failures?)(\/|$)/.test(normalized)) return "failed_output" as const;
  if (/(^|\/)(shot[-_ ]?outputs?|outputs\/shots)(\/|$)/.test(normalized)) return "shot_output" as const;
  return "source_asset" as const;
}

export function pathOriginForUi(path?: string) {
  return path && /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/])/.test(path) ? "user_selected_import" as const : "project_root_relative" as const;
}

function blockedImportLabelForUi(sourceKind: string) {
  if (sourceKind === "failed_output") return "失败画面";
  if (sourceKind === "shot_output") return "镜头画面";
  if (sourceKind === "contact_sheet") return "拼图参考";
  if (sourceKind === "provider_temp_output") return "临时画面";
  return "参考素材";
}

export function defaultAssetConstraints(type: AssetLibraryAssetType, name: string) {
  if (type === "character") return [`保持 ${cleanLabel(name)} 的身份、年龄感、发型和服装连续`];
  if (type === "scene") return [`保持 ${cleanLabel(name)} 的天气、空间和环境一致，后续视频继续使用`];
  if (type === "style") return [`保持 ${cleanLabel(name)} 的色彩、光比、颗粒和纹理强度一致`];
  if (type === "voice_anchor") return [`保持 ${cleanLabel(name)} 的音色、语速和情绪区间一致`];
  return [`保持 ${cleanLabel(name)} 的形状、材质和使用方式一致`];
}

export function assetLibraryAssetToRecord(asset: AssetLibraryAsset): AssetRecord {
  const lockedStatus =
    asset.referenceAuthority.lockedStatus === "rejected"
      ? "needs_review"
      : asset.referenceAuthority.lockedStatus;
  const status = asset.status === "missing" ? "missing" : asset.sourceKind === "formal_output" ? "generated" : "exists";
  const type = asset.assetType === "voice_anchor" ? "unknown" : asset.assetType;
  return {
    id: asset.id,
    type,
    name: asset.name,
    path: asset.mainReferencePath || asset.sourcePath?.path || asset.referenceAuthority.path,
    status,
    lockedStatus,
    providerId: "asset-library",
    safeForFutureReference: asset.canUseAsFutureReference,
    issues: uniqueStrings([
      ...asset.blockers,
      ...asset.warnings,
      ...(asset.status === "rejected" ? [asset.referenceAuthority.rejectedReason || "Rejected by asset authority review."] : []),
    ]),
  };
}

export function assetLibraryUserBlockers(library: AssetLibrarySnapshot) {
  const validation = validateAssetLibrarySnapshot(library);
  const lockedCharacters = library.assets.filter((asset) => asset.assetType === "character" && asset.status === "locked");
  const lockedScenes = library.assets.filter((asset) => asset.assetType === "scene" && asset.status === "locked");
  const nonLocked = library.assets.filter((asset) => asset.status !== "locked" && asset.status !== "rejected");
  const noConstraints = library.assets.filter((asset) => !asset.textConstraints.length || asset.blockers.length);
  return uniqueStrings([
    ...(lockedCharacters.length ? [] : ["缺角色参考"]),
    ...(lockedScenes.length ? [] : ["缺场景/天气参考"]),
    ...nonLocked.map((asset) => `${cleanLabel(asset.name)} 待复核`),
    ...noConstraints.map((asset) => `${cleanLabel(asset.name)} 待补说明`),
    ...library.blockedImports.map((item) => `${blockedImportLabelForUi(item.sourceKind)} 待复核`),
    ...validation.errors.map(() => "参考信息待整理"),
  ]);
}
