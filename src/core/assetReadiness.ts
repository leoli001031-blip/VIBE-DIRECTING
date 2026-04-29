import { stableKnowledgeHash } from "./knowledgeManifest";
import type { AssetReadinessReport, AssetRecord, GenerationJob, ProjectSourceIndex, ShotRecord } from "./types";

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function hash(value: string): string {
  return stableKnowledgeHash(value);
}

function isTempAsset(asset: AssetRecord): boolean {
  return (
    asset.lockedStatus === "candidate" ||
    asset.lockedStatus === "needs_review" ||
    asset.issues.some((issue) => /temp|candidate|protocol_pass_needs_visual_audit/.test(issue))
  );
}

function isSafe(asset: AssetRecord, sourceIndex?: ProjectSourceIndex): boolean {
  return (
    asset.status !== "missing" &&
    asset.lockedStatus === "locked" &&
    asset.safeForFutureReference &&
    (!sourceIndex || sourceIndex.lockedReferenceIds.includes(asset.path) || sourceIndex.lockedReferenceIds.includes(asset.id))
  );
}

function idsForAssets(assets: AssetRecord[]): string[] {
  return uniqueSorted(assets.map((asset) => asset.id || asset.path));
}

export interface BuildAssetReadinessReportInput {
  shot: ShotRecord;
  assets: AssetRecord[];
  sourceIndex?: ProjectSourceIndex;
  jobs?: GenerationJob[];
  checkedAt?: string;
}

export function buildAssetReadinessReport(input: BuildAssetReadinessReportInput): AssetReadinessReport {
  const checkedAt = input.checkedAt || new Date().toISOString();
  const shotJobs = (input.jobs || []).filter((job) => job.id.includes(input.shot.id));
  const referencedIds = uniqueSorted(shotJobs.flatMap((job) => job.references || []));
  const sourceLockedIds = input.sourceIndex?.lockedReferenceIds || [];
  const sourceCandidateIds = input.sourceIndex?.candidateReferenceIds || [];
  const sourceRejectedIds = input.sourceIndex?.rejectedReferenceIds || [];
  const sourceFailedIds = input.sourceIndex?.failedReferenceIds || [];
  const knownAssetReferenceIds = new Set(input.assets.flatMap((asset) => [asset.id, asset.path]).filter(Boolean));
  const knownSourceReferenceIds = new Set([
    ...sourceLockedIds,
    ...sourceCandidateIds,
    ...sourceRejectedIds,
    ...sourceFailedIds,
  ]);
  const missingReferenceIds = referencedIds.filter(
    (referenceId) => !knownAssetReferenceIds.has(referenceId) && !knownSourceReferenceIds.has(referenceId),
  );
  const sourceCandidateReferenceIds = sourceCandidateIds.filter((id) => referencedIds.includes(id));
  const sourceRejectedReferenceIds = sourceRejectedIds.filter((id) => referencedIds.includes(id));
  const sourceFailedReferenceIds = sourceFailedIds.filter((id) => referencedIds.includes(id));
  const referencedAssets = input.assets.filter(
    (asset) => referencedIds.includes(asset.id) || referencedIds.includes(asset.path),
  );
  const scopedAssets = referencedIds.length ? referencedAssets : input.assets;
  const lockedAssets = scopedAssets.filter((asset) => isSafe(asset, input.sourceIndex));
  const candidateAssets = scopedAssets.filter((asset) => asset.status !== "missing" && asset.lockedStatus !== "locked");
  const missingAssets = scopedAssets.filter((asset) => asset.status === "missing");
  const rejectedAssets = scopedAssets.filter((asset) => asset.lockedStatus === "not_generated" && asset.issues.includes("rejected"));
  const tempAssets = scopedAssets.filter(isTempAsset);
  const failedAssets = scopedAssets.filter(
    (asset) => sourceFailedIds.includes(asset.path) || sourceFailedIds.includes(asset.id) || asset.status === "missing",
  );
  const hasLockedScene = scopedAssets.some((asset) => asset.type === "scene" && isSafe(asset, input.sourceIndex));
  const hasLockedCharacter = scopedAssets.some((asset) => asset.type === "character" && isSafe(asset, input.sourceIndex));
  const unsafeReferenceIds = uniqueSorted([
    ...candidateAssets.map((asset) => asset.id),
    ...missingAssets.map((asset) => asset.id),
    ...rejectedAssets.map((asset) => asset.id),
    ...tempAssets.map((asset) => asset.id),
    ...sourceCandidateReferenceIds,
    ...sourceRejectedReferenceIds,
    ...sourceFailedReferenceIds,
    ...missingReferenceIds,
  ]);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!hasLockedScene) warnings.push("No locked scene view is available; formal output must stay blocked.");
  if (!hasLockedCharacter) warnings.push("No locked character reference is available; formal output must stay blocked.");
  if (missingAssets.length || missingReferenceIds.length) blockers.push(`${missingAssets.length + missingReferenceIds.length} referenced asset(s) are missing.`);
  if (sourceRejectedReferenceIds.length || rejectedAssets.length) blockers.push("Rejected references are present in this shot scope.");
  if (sourceFailedReferenceIds.length) blockers.push("Failed references are present in this shot scope.");
  if (candidateAssets.length || sourceCandidateReferenceIds.length || tempAssets.length) warnings.push("Candidate/temp references are draft-only and cannot become future reference authority.");

  const formalBlocked = blockers.length > 0 || !hasLockedScene || !hasLockedCharacter || unsafeReferenceIds.length > 0;
  const status = blockers.length
    ? "blocked"
    : formalBlocked
      ? "draft_only"
      : "ready";

  return {
    reportId: `asset_readiness_${hash(`${input.shot.id}:${checkedAt}`).replace(/^vck_/, "")}`,
    shotId: input.shot.id,
    assetIds: idsForAssets(scopedAssets),
    status,
    formalBlocked,
    blockers,
    warnings,
    safeReferenceIds: uniqueSorted(lockedAssets.map((asset) => asset.id)),
    unsafeReferenceIds,
    lockedReferenceIds: uniqueSorted(lockedAssets.map((asset) => asset.id)),
    candidateReferenceIds: uniqueSorted([...candidateAssets.map((asset) => asset.id), ...sourceCandidateReferenceIds]),
    missingReferenceIds: uniqueSorted([...missingAssets.map((asset) => asset.id), ...missingReferenceIds]),
    rejectedReferenceIds: uniqueSorted([...rejectedAssets.map((asset) => asset.id), ...sourceRejectedReferenceIds]),
    tempReferenceIds: uniqueSorted(tempAssets.map((asset) => asset.id)),
    failedReferenceIds: uniqueSorted([...failedAssets.map((asset) => asset.id), ...sourceFailedReferenceIds]),
    checkedAt,
  };
}
