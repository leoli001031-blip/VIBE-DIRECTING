import { stableKnowledgeHash } from "./knowledgeManifest";
import type { AssetReadinessGate, AssetReadinessReport, AssetRecord, GenerationJob, ProjectSourceIndex, ShotRecord } from "./types";

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

function readinessGate(input: Omit<AssetReadinessGate, "status" | "blockers" | "warnings" | "sourceRefs"> & {
  blockers?: string[];
  warnings?: string[];
  sourceRefs?: string[];
}): AssetReadinessGate {
  const blockers = uniqueSorted(input.blockers || []);
  const warnings = uniqueSorted(input.warnings || []);
  return {
    ...input,
    status: blockers.length ? "blocked" : warnings.length ? "warning" : "pass",
    blockers,
    warnings,
    sourceRefs: uniqueSorted(input.sourceRefs || []),
  };
}

function shotGateBlocker(shot: ShotRecord, gate: keyof ShotRecord["gates"], label: string): string[] {
  return shot.gates[gate] === "FAIL" ? [`${label} is FAIL on shot ${shot.id}.`] : [];
}

function shotGateWarning(shot: ShotRecord, gate: keyof ShotRecord["gates"], label: string): string[] {
  return shot.gates[gate] === "PARTIAL" || shot.gates[gate] === "UNKNOWN"
    ? [`${label} is ${shot.gates[gate]} on shot ${shot.id}.`]
    : [];
}

function referencedAssetsOfType(assets: AssetRecord[], type: AssetRecord["type"]): AssetRecord[] {
  return assets.filter((asset) => asset.type === type);
}

function assetTypeBlockers(assets: AssetRecord[], type: AssetRecord["type"]): string[] {
  return referencedAssetsOfType(assets, type).flatMap((asset) => {
    if (asset.status === "missing") return [`${type} reference ${asset.id} is missing.`];
    if (asset.lockedStatus === "not_generated" && asset.issues.some((issue) => /rejected/i.test(issue))) {
      return [`${type} reference ${asset.id} is rejected.`];
    }
    return [];
  });
}

function assetTypeWarnings(assets: AssetRecord[], type: AssetRecord["type"]): string[] {
  return referencedAssetsOfType(assets, type).flatMap((asset) => {
    if (asset.lockedStatus === "candidate" || asset.lockedStatus === "needs_review" || asset.lockedStatus === "not_generated") {
      return [`${type} reference ${asset.id} is not locked and remains draft-only.`];
    }
    return [];
  });
}

function buildReadinessGates(input: {
  shot: ShotRecord;
  scopedAssets: AssetRecord[];
  hasLockedScene: boolean;
  hasLockedCharacter: boolean;
  missingReferenceIds: string[];
  sourceRejectedReferenceIds: string[];
  sourceFailedReferenceIds: string[];
}): AssetReadinessGate[] {
  return [
    readinessGate({
      gateId: "identity_gate",
      requiredForFormal: true,
      detail: "Shot must have locked character identity authority before formal keyframe/video work.",
      blockers: [
        ...shotGateBlocker(input.shot, "identity", "identity_gate"),
        ...assetTypeBlockers(input.scopedAssets, "character"),
      ],
      warnings: [
        ...(!input.hasLockedCharacter ? ["No locked character reference is available; formal output must stay blocked."] : []),
        ...shotGateWarning(input.shot, "identity", "identity_gate"),
        ...assetTypeWarnings(input.scopedAssets, "character"),
      ],
      sourceRefs: referencedAssetsOfType(input.scopedAssets, "character").map((asset) => asset.id),
    }),
    readinessGate({
      gateId: "scene_gate",
      requiredForFormal: true,
      detail: "Shot must have locked scene authority and avoid missing/failed scene references.",
      blockers: [
        ...shotGateBlocker(input.shot, "scene", "scene_gate"),
        ...assetTypeBlockers(input.scopedAssets, "scene"),
        ...input.sourceFailedReferenceIds.map((id) => `Scene/source reference ${id} is failed.`),
      ],
      warnings: [
        ...(!input.hasLockedScene ? ["No locked scene view is available; formal output must stay blocked."] : []),
        ...shotGateWarning(input.shot, "scene", "scene_gate"),
        ...assetTypeWarnings(input.scopedAssets, "scene"),
      ],
      sourceRefs: referencedAssetsOfType(input.scopedAssets, "scene").map((asset) => asset.id),
    }),
    readinessGate({
      gateId: "pair_gate",
      requiredForFormal: true,
      detail: "Shot pair gate must be ready before I2V handoff.",
      blockers: shotGateBlocker(input.shot, "pair", "pair_gate"),
      warnings: shotGateWarning(input.shot, "pair", "pair_gate"),
      sourceRefs: [input.shot.id],
    }),
    readinessGate({
      gateId: "story_gate",
      requiredForFormal: true,
      detail: "Shot story gate must match the current Story Flow before generation.",
      blockers: shotGateBlocker(input.shot, "story", "story_gate"),
      warnings: shotGateWarning(input.shot, "story", "story_gate"),
      sourceRefs: [input.shot.id],
    }),
    readinessGate({
      gateId: "prop_gate",
      requiredForFormal: false,
      detail: "Referenced props must not be rejected, missing, failed, or temp-only.",
      blockers: [
        ...shotGateBlocker(input.shot, "prop", "prop_gate"),
        ...assetTypeBlockers(input.scopedAssets, "prop"),
        ...input.sourceRejectedReferenceIds.map((id) => `Reference ${id} is rejected.`),
      ],
      warnings: [
        ...shotGateWarning(input.shot, "prop", "prop_gate"),
        ...assetTypeWarnings(input.scopedAssets, "prop"),
      ],
      sourceRefs: referencedAssetsOfType(input.scopedAssets, "prop").map((asset) => asset.id),
    }),
    readinessGate({
      gateId: "style_gate",
      requiredForFormal: false,
      detail: "Referenced style memory must not drift from locked style authority.",
      blockers: [
        ...shotGateBlocker(input.shot, "style", "style_gate"),
        ...assetTypeBlockers(input.scopedAssets, "style"),
      ],
      warnings: [
        ...shotGateWarning(input.shot, "style", "style_gate"),
        ...assetTypeWarnings(input.scopedAssets, "style"),
      ],
      sourceRefs: referencedAssetsOfType(input.scopedAssets, "style").map((asset) => asset.id),
    }),
  ];
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
  const gates = buildReadinessGates({
    shot: input.shot,
    scopedAssets,
    hasLockedScene,
    hasLockedCharacter,
    missingReferenceIds,
    sourceRejectedReferenceIds,
    sourceFailedReferenceIds,
  });
  const gateBlockers = gates.flatMap((gate) => gate.blockers);
  const gateWarnings = gates.flatMap((gate) => gate.warnings);
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
  blockers.push(...gateBlockers);
  warnings.push(...gateWarnings);

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
    gates,
    blockers: uniqueSorted(blockers),
    warnings: uniqueSorted(warnings),
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
