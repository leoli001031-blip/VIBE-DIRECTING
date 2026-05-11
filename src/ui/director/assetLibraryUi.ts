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
  if (type === "character") return "角色";
  if (type === "scene") return "场景";
  if (type === "style") return "风格";
  if (type === "voice_anchor") return "音源";
  return "道具";
}

export function assetLibraryStatusLabel(status: AssetLibraryUiStatus | AssetLibraryStatus) {
  if (status === "review" || status === "needs_review") return "review";
  return status;
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

export function defaultAssetConstraints(type: AssetLibraryAssetType, name: string) {
  if (type === "character") return [`保持 ${cleanLabel(name)} 的身份、年龄感、发型和服装连续`];
  if (type === "scene") return [`保持 ${cleanLabel(name)} 的空间布局、主要入口、光源方向和透视关系`];
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
    ...(lockedCharacters.length ? [] : ["缺主角参考"]),
    ...(lockedScenes.length ? [] : ["缺场景 master"]),
    ...nonLocked.map((asset) => `${cleanLabel(asset.name)} 未 locked，不能做正式参考`),
    ...noConstraints.map((asset) => `${cleanLabel(asset.name)} 缺文本约束`),
    ...library.blockedImports.map((item) => `${item.sourceKind} 已拦截：${item.reason}`),
    ...validation.errors,
  ]);
}
