import type { ProjectSourceIndex, ReferenceAuthority } from "./types";

export type ReferenceUseMode = ReferenceAuthority["allowedUse"][number];

export interface ReferenceAllowedResult {
  referenceId: string;
  mode: ReferenceUseMode;
  allowed: true;
  reason: "locked_reference" | "draft_candidate";
}

export interface SourceIndexSummary {
  projectId: string;
  projectVersion: string;
  sourceIndexHash: string;
  currentSourceCount: number;
  promptHashCount: number;
  lockedReferenceCount: number;
  candidateReferenceCount: number;
  rejectedReferenceCount: number;
  failedReferenceCount: number;
  confirmedDecisionCount: number;
  staleArtifactCount: number;
  updatedAt: string;
  isProductionReady: boolean;
  blockingReferenceCount: number;
}

export class SourceIndexReferenceError extends Error {
  code: string;
  referenceId: string;
  mode: ReferenceUseMode;

  constructor(code: string, referenceId: string, mode: ReferenceUseMode, message: string) {
    super(message);
    this.name = "SourceIndexReferenceError";
    this.code = code;
    this.referenceId = referenceId;
    this.mode = mode;
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(canonicalize);
    if (items.every((item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean")) {
      return [...items].sort();
    }
    return items;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "sourceIndexHash" && key !== "updatedAt")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }

  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `vci_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function refreshSourceIndexHash(index: ProjectSourceIndex): ProjectSourceIndex {
  return {
    ...index,
    sourceIndexHash: computeSourceIndexHash(index),
  };
}

export function computeSourceIndexHash(index: ProjectSourceIndex): string {
  return hashString(stableStringify(index));
}

export function createEmptySourceIndex(projectId: string, projectVersion: string): ProjectSourceIndex {
  const index: ProjectSourceIndex = {
    projectId,
    projectVersion,
    sourceIndexHash: "",
    currentPromptHashes: {},
    lockedReferenceIds: [],
    candidateReferenceIds: [],
    rejectedReferenceIds: [],
    failedReferenceIds: [],
    confirmedDecisionIds: [],
    staleArtifactIds: [],
    updatedAt: new Date().toISOString(),
  };

  return refreshSourceIndexHash(index);
}

export function markArtifactStale(index: ProjectSourceIndex, artifactId: string): ProjectSourceIndex {
  const nextIndex: ProjectSourceIndex = {
    ...index,
    staleArtifactIds: unique([...index.staleArtifactIds, artifactId]),
    updatedAt: new Date().toISOString(),
  };

  return refreshSourceIndexHash(nextIndex);
}

export function assertReferenceAllowed(
  index: ProjectSourceIndex,
  referenceId: string,
  mode: ReferenceUseMode,
): ReferenceAllowedResult {
  if (index.rejectedReferenceIds.includes(referenceId)) {
    throw new SourceIndexReferenceError(
      "rejected_reference",
      referenceId,
      mode,
      `${referenceId} is rejected in ProjectSourceIndex and cannot be used as ${mode}.`,
    );
  }

  if (index.failedReferenceIds.includes(referenceId)) {
    throw new SourceIndexReferenceError(
      "failed_reference",
      referenceId,
      mode,
      `${referenceId} is a failed artifact in ProjectSourceIndex and cannot be used as ${mode}.`,
    );
  }

  if (index.staleArtifactIds.includes(referenceId)) {
    throw new SourceIndexReferenceError(
      "stale_reference",
      referenceId,
      mode,
      `${referenceId} is stale in ProjectSourceIndex and must be refreshed before ${mode}.`,
    );
  }

  if (index.lockedReferenceIds.includes(referenceId)) {
    return {
      referenceId,
      mode,
      allowed: true,
      reason: "locked_reference",
    };
  }

  if (index.candidateReferenceIds.includes(referenceId)) {
    if (mode === "draft_preview") {
      return {
        referenceId,
        mode,
        allowed: true,
        reason: "draft_candidate",
      };
    }

    throw new SourceIndexReferenceError(
      "candidate_reference_not_formal",
      referenceId,
      mode,
      `${referenceId} is only a candidate reference and can only be used for draft_preview.`,
    );
  }

  throw new SourceIndexReferenceError(
    "unknown_reference",
    referenceId,
    mode,
    `${referenceId} is not part of the current ProjectSourceIndex.`,
  );
}

export function summarizeSourceIndex(index: ProjectSourceIndex): SourceIndexSummary {
  const currentSourceIds = [
    index.currentProductionBibleId,
    index.currentStoryFlowId,
    index.currentShotSpecId,
    index.currentVisualMemoryId,
    index.currentSpatialMemoryId,
    index.currentStyleCapsuleId,
    index.currentVoiceMemoryId,
  ].filter(Boolean);
  const blockingReferenceCount = index.rejectedReferenceIds.length + index.failedReferenceIds.length + index.staleArtifactIds.length;

  return {
    projectId: index.projectId,
    projectVersion: index.projectVersion,
    sourceIndexHash: computeSourceIndexHash(index),
    currentSourceCount: currentSourceIds.length,
    promptHashCount: Object.keys(index.currentPromptHashes).length,
    lockedReferenceCount: index.lockedReferenceIds.length,
    candidateReferenceCount: index.candidateReferenceIds.length,
    rejectedReferenceCount: index.rejectedReferenceIds.length,
    failedReferenceCount: index.failedReferenceIds.length,
    confirmedDecisionCount: index.confirmedDecisionIds.length,
    staleArtifactCount: index.staleArtifactIds.length,
    updatedAt: index.updatedAt,
    isProductionReady: blockingReferenceCount === 0 && index.lockedReferenceIds.length > 0,
    blockingReferenceCount,
  };
}
