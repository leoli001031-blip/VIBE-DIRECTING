import { buildProjectRuntimeState, emptyKnowledgeManifest } from "../core/projectStateBuilder";
import type { ProjectRuntimeState, RuntimeStateSource } from "../core/projectState";
import { buildProjectVibePlanningProjection } from "../core/projectVibePlanningProjection";
import type { KnowledgePackManifest } from "../core/knowledgeTypes";
import type { AssetRecord, ProjectAudit, ProjectMetrics, ProjectSourceIndex } from "../core/types";
import { hashProjectVibeFacts } from "./projectVibe";
import type {
  ProjectVibeAsset,
  ProjectVibeAssetKind,
  ProjectVibeAssetStatus,
  ProjectVibeDocument,
} from "./types";

export interface BuildProjectRuntimeStateFromProjectVibeInput {
  project: ProjectVibeDocument;
  projectRoot?: string;
  projectPath?: string;
  generatedAt?: string;
  stateSource?: RuntimeStateSource;
  knowledgeManifest?: KnowledgePackManifest;
}

function uniqueSorted(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))))
    .sort((left, right) => left.localeCompare(right));
}

function assetRecordType(kind: ProjectVibeAssetKind): AssetRecord["type"] {
  if (kind === "character" || kind === "scene" || kind === "prop" || kind === "style") return kind;
  // Defaulting to "unknown" for unrecognized kinds; consider more specific defaults (e.g. "reference") for reference-type assets
  return "unknown";
}

function assetPath(asset: ProjectVibeAsset) {
  return asset.path || `assets/${asset.id}.json`;
}

function isUrlOrAbsolute(value: string) {
  return /^(?:https?:|data:|blob:|file:)/i.test(value) || value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}

function resolveProjectMediaPath(value: string | undefined, projectRoot?: string) {
  const cleaned = value?.trim();
  if (!cleaned || isUrlOrAbsolute(cleaned)) return cleaned;
  if (!projectRoot || cleaned.includes("..")) return cleaned;
  return `${projectRoot.replace(/\/+$/g, "")}/${cleaned.replace(/^\/+/g, "")}`;
}

function assetStatus(status: ProjectVibeAssetStatus, asset: ProjectVibeAsset): AssetRecord["status"] {
  if (status === "missing") return "missing";
  if (status === "rejected") return "rejected";
  if (asset.path) return "exists";
  return "planned";
}

function assetLockedStatus(status: ProjectVibeAssetStatus): AssetRecord["lockedStatus"] {
  if (status === "locked") return "locked";
  if (status === "candidate") return "candidate";
  if (status === "missing") return "not_generated";
  return "needs_review";
}

function assetIssues(asset: ProjectVibeAsset) {
  return uniqueSorted([
    ...(asset.status === "candidate" ? ["candidate_draft_only"] : []),
    ...(asset.status === "needs_review" ? ["needs_review"] : []),
    ...(asset.status === "rejected" ? ["rejected_reference"] : []),
    ...(asset.status === "missing" ? ["missing_reference"] : []),
  ]);
}

function sourceRefValue(sourceRefs: string[], prefix: string) {
  const match = sourceRefs.find((ref) => ref.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : undefined;
}

function visualMemoryFutureReference(project: ProjectVibeDocument, asset: ProjectVibeAsset) {
  return project.visualMemory.entries.some((entry) => entry.assetId === asset.id && entry.canUseAsFutureReference);
}

function toAssetRecord(project: ProjectVibeDocument, asset: ProjectVibeAsset, projectRoot?: string): AssetRecord {
  const sourceRefs = uniqueSorted(asset.sourceRefs);
  return {
    id: asset.id,
    type: assetRecordType(asset.kind),
    name: asset.label,
    path: resolveProjectMediaPath(assetPath(asset), projectRoot) || assetPath(asset),
    status: assetStatus(asset.status, asset),
    lockedStatus: assetLockedStatus(asset.status),
    providerId: "project-vibe",
    sourceReceiptId: sourceRefValue(sourceRefs, "receipt#"),
    outputHash: sourceRefValue(sourceRefs, "output_hash#"),
    usedByShotIds: uniqueSorted(asset.usedByShotIds),
    safeForFutureReference: asset.status === "locked" && (asset.lockedBy === "user" || visualMemoryFutureReference(project, asset)),
    textConstraints: uniqueSorted(asset.textConstraints),
    sourceRefs,
    roleBinding: asset.roleBinding,
    issues: assetIssues(asset),
  };
}

function projectMetrics(project: ProjectVibeDocument): ProjectMetrics {
  const existingAssets = project.assets.filter((asset) => asset.status !== "missing").length;
  const readyShots = project.shots.filter((shot) => shot.status === "ready" || shot.status === "generated").length;
  const batchReceipts = project.receipts?.batchReceipts.length || 0;
  return {
    expectedAssets: project.assets.length,
    existingAssets,
    expectedKeyframes: project.shots.length,
    existingKeyframes: readyShots,
    expectedVideos: project.shots.length,
    existingVideos: project.shots.filter((shot) => shot.status === "generated").length,
    providerEvents: project.runs.filter((run) => run.runKind === "provider").length + batchReceipts,
    dreaminaImageEvents: 0,
    forbiddenFallbackEvents: 0,
  };
}

function projectSourceIndex(project: ProjectVibeDocument): ProjectSourceIndex {
  const referenceId = (asset: ProjectVibeAsset) => asset.path || asset.id;
  const reviewReceiptIds = project.receipts?.reviewReceipts.map((receipt) => receipt.id) || [];
  const planningReceiptIds = [
    ...(project.receipts?.scriptPlanningReceipts.map((receipt) => receipt.id) || []),
    ...(project.receipts?.promptKeyframePlanningReceipts.map((receipt) => receipt.id) || []),
    ...(project.receipts?.batchReceipts.map((receipt) => receipt.id) || []),
  ];
  return {
    projectId: project.manifest.projectId,
    projectVersion: project.manifest.version,
    sourceIndexHash: hashProjectVibeFacts(project),
    currentProductionBibleId: project.sourceIndex.manifestRef,
    currentStoryFlowId: project.sourceIndex.storyFlowRef,
    currentVisualMemoryId: project.sourceIndex.visualMemoryRef,
    currentPromptHashes: promptHashes(project),
    lockedReferenceIds: uniqueSorted(project.assets.filter((asset) => asset.status === "locked").map(referenceId)),
    candidateReferenceIds: uniqueSorted(project.assets.filter((asset) => asset.status === "candidate" || asset.status === "needs_review").map(referenceId)),
    rejectedReferenceIds: uniqueSorted(project.assets.filter((asset) => asset.status === "rejected").map(referenceId)),
    failedReferenceIds: uniqueSorted(project.assets.filter((asset) => asset.status === "missing").map(referenceId)),
    confirmedDecisionIds: uniqueSorted([...project.runs.map((run) => run.id), ...reviewReceiptIds, ...planningReceiptIds]),
    staleArtifactIds: [],
    updatedAt: project.sourceIndex.updatedAt || project.manifest.updatedAt,
  };
}

export function projectVibeToProjectAudit(input: BuildProjectRuntimeStateFromProjectVibeInput): ProjectAudit {
  const { project } = input;
  if (!project || !Array.isArray(project.shots) || !Array.isArray(project.assets)) {
    const generatedAt = input.generatedAt || new Date().toISOString();
    const projectRoot = input.projectRoot || "project_root";
    const projectPath = input.projectPath || "project.vibe";
    return {
      importedAt: generatedAt,
      projectTitle: "missing or corrupt project",
      projectRoot,
      sourceTask: projectPath,
      state: "project_vibe_restored",
      sourceIndex: { projectId: "", projectVersion: "0", sourceIndexHash: "", currentProductionBibleId: "", currentStoryFlowId: "", currentVisualMemoryId: "", currentPromptHashes: {}, lockedReferenceIds: [], candidateReferenceIds: [], rejectedReferenceIds: [], failedReferenceIds: [], confirmedDecisionIds: [], staleArtifactIds: [], updatedAt: generatedAt },
      fileSnapshot: [projectPath],
      schemaSummary: { auditSchemaVersion: "0", coreStateVersion: "project-vibe-runtime-state/0.1.0", notes: ["Runtime state was rebuilt from Project.vibe.", "project.vibe data was incomplete or corrupt."] },
      metrics: { expectedAssets: 0, existingAssets: 0, expectedKeyframes: 0, existingKeyframes: 0, expectedVideos: 0, existingVideos: 0, providerEvents: 0, dreaminaImageEvents: 0, forbiddenFallbackEvents: 0 },
      providerPolicy: { strictImageProvider: "registry_default", rules: [] },
      workflow: [{ id: "project_vibe_restored", label: "Project.vibe 已恢复", status: "done", detail: "0 个镜头 · 0 个资产" }],
      assets: [],
      shots: [],
      jobs: [],
      issues: [],
      contactSheets: {},
    };
  }
  const generatedAt = input.generatedAt || new Date().toISOString();
  const projectRoot = input.projectRoot || "project_root";
  const projectPath = input.projectPath || "project.vibe";
  const planningProjection = buildProjectVibePlanningProjection({ project, generatedAt });
  return {
    importedAt: project.manifest.createdAt || generatedAt,
    projectTitle: project.manifest.title,
    projectRoot,
    sourceTask: projectPath,
    state: "project_vibe_restored",
    sourceIndex: projectSourceIndex(project),
    fileSnapshot: uniqueSorted([
      projectPath,
      ...project.assets.map((asset) => asset.path),
      ...project.runs.flatMap((run) => run.evidenceRefs),
      ...(project.receipts?.scriptPlanningReceipts.flatMap((receipt) => receipt.evidenceRefs) || []),
      ...(project.receipts?.promptKeyframePlanningReceipts.flatMap((receipt) => receipt.evidenceRefs) || []),
      ...(project.receipts?.batchReceipts.flatMap((receipt) => receipt.evidenceRefs) || []),
      ...(project.receipts?.reviewReceipts.flatMap((receipt) => receipt.evidenceRefs) || []),
    ]),
    schemaSummary: {
      auditSchemaVersion: project.modelVersion,
      coreStateVersion: "project-vibe-runtime-state/0.1.0",
      notes: ["Runtime state was rebuilt from Project.vibe."],
    },
    metrics: projectMetrics(project),
    providerPolicy: {
      strictImageProvider: "registry_default",
      rules: [],
    },
    workflow: [{
      id: "project_vibe_restored",
      label: "Project.vibe 已恢复",
      status: "done",
      detail: `${project.shots.length} 个镜头 · ${project.assets.length} 个资产`,
    }],
    assets: project.assets.map((asset) => toAssetRecord(project, asset, projectRoot)),
    shots: planningProjection.shots.map((item) => item.shot),
    jobs: planningProjection.jobs,
    issues: [],
    contactSheets: {},
  };
}

function promptHashes(project: ProjectVibeDocument): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const shot of project.shots) {
    hashes[shot.id] = stableHash({
      intent: shot.intent,
      camera: shot.camera,
      seedanceDirection: shot.seedanceDirection,
      characterGuidance: shot.characterGuidance,
      sceneGuidance: shot.sceneGuidance,
      propGuidance: shot.propGuidance,
      referenceStrategy: shot.referenceStrategy,
    });
  }
  return hashes;
}

function stableHash(value: unknown): string {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `pv_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function buildProjectRuntimeStateFromProjectVibe(input: BuildProjectRuntimeStateFromProjectVibeInput): ProjectRuntimeState {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const audit = projectVibeToProjectAudit({ ...input, generatedAt });
  const planningProjection = buildProjectVibePlanningProjection({ project: input.project, generatedAt });
  const runtimeState = buildProjectRuntimeState(audit, input.knowledgeManifest || emptyKnowledgeManifest, {
    generatedAt,
    selectedShotId: audit.shots[0]?.id,
    keyframePairs: planningProjection.keyframePairs,
    stateSource: input.stateSource || {
      kind: "runtime-state",
      label: "Project.vibe",
      path: input.projectPath || "project.vibe",
      sourceImportedAt: input.project.manifest.updatedAt,
      note: "Rebuilt from the opened Project.vibe document.",
    },
  });
  const sectionTitleById = new Map(input.project.storyFlow.sections.map((section) => [section.id, section.title]));
  const restoredSections = runtimeState.storyFlow.sections.map((section) => ({
    ...section,
    label: sectionTitleById.get(section.id) || section.label,
  }));
  return {
    ...runtimeState,
    storyFlow: {
      ...runtimeState.storyFlow,
      sections: restoredSections,
    },
  };
}
