import type { ProjectRuntimeState } from "../../core/projectState";
import type { AssetRecord, ShotRecord } from "../../core/types";
import {
  addAssetLibraryAsset,
  createAssetLibrarySnapshot,
  type AssetLibraryAssetType,
  type AssetLibrarySnapshot,
  type AssetLibraryStatus,
} from "../../core/assetLibraryCrud";
import type { CurrentProjectWorkbenchProjection } from "../../core/currentProjectWorkbenchProjection";
import {
  createProjectVibe,
  isPortableProjectPath,
  type ProjectVibeAssetKind,
  type ProjectVibeAssetStatus,
  type ProjectVibeDocument,
  type ProjectVibeShotStatus,
} from "../../project";
import {
  assetLibraryAssetToRecord,
  assetSourceKindForPath,
  defaultAssetConstraints,
  pathOriginForUi,
} from "../director/assetLibraryUi";

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function assetRecordTypeToLibraryType(type: AssetRecord["type"]): AssetLibraryAssetType {
  if (type === "character" || type === "scene" || type === "prop" || type === "style") return type;
  return "prop";
}

function assetRecordStatusToLibraryStatus(asset: AssetRecord): AssetLibraryStatus {
  if (asset.status === "missing" || asset.lockedStatus === "not_generated") return "missing";
  if (asset.status === "rejected") return "rejected";
  if (asset.lockedStatus === "locked") return "locked";
  if (asset.lockedStatus === "needs_review") return "review";
  return "candidate";
}

function linkedShotIdsForAsset(asset: AssetRecord, state: ProjectRuntimeState) {
  return uniqueStrings(
    state.taskRuns.jobs
      .filter((job) => job.references.includes(asset.path) || job.references.includes(asset.id))
      .flatMap((job) =>
        state.storyFlow.shots
          .filter((shot) => job.id.startsWith(`${shot.id}_`) || job.outputPath === shot.startFrame || job.outputPath === shot.endFrame)
          .map((shot) => shot.id),
      ),
  );
}

function projectRelativePreviewPath(path: string | undefined, projectRoot: string | undefined) {
  const normalized = path?.trim().replace(/\\/g, "/");
  if (!normalized) return undefined;
  if (/^(?:https?:|data:|blob:|file:)/i.test(normalized)) return undefined;
  const normalizedRoot = projectRoot?.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
  if (normalizedRoot && normalized.startsWith(`${normalizedRoot}/`)) {
    return normalized.slice(normalizedRoot.length + 1);
  }
  if (/^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/])/.test(path || "")) return undefined;
  return normalized.replace(/^\/+/, "");
}

export function createAssetLibraryFromRuntimeState(state: ProjectRuntimeState): AssetLibrarySnapshot {
  const generatedAt = state.generatedAt || new Date().toISOString();
  let library = createAssetLibrarySnapshot({
    id: `${state.sourceIndex.projectId || "project"}_asset_library`,
    createdAt: generatedAt,
  });

  for (const asset of state.visualMemory.assets) {
    const assetType = assetRecordTypeToLibraryType(asset.type);
    const result = addAssetLibraryAsset(library, {
      id: asset.id,
      assetType,
      name: asset.name,
      status: assetRecordStatusToLibraryStatus(asset),
      sourceKind: assetSourceKindForPath(asset.path),
      path: asset.status === "missing" ? undefined : asset.path,
      pathOrigin: pathOriginForUi(asset.path),
      importId: asset.id,
      textConstraints: defaultAssetConstraints(assetType, asset.name),
      sourceRefs: [`runtime.visualMemory.assets:${asset.id}`],
      usedByShotIds: linkedShotIdsForAsset(asset, state),
      updatedAt: generatedAt,
    });
    library = result.library;
  }

  return library;
}

export function createAssetLibraryFromCurrentProjectWorkbench(projection: CurrentProjectWorkbenchProjection): AssetLibrarySnapshot {
  let library = createAssetLibrarySnapshot({
    id: `${projection.identity.projectId || "current_project"}_asset_library_projection`,
    createdAt: new Date().toISOString(),
  });
  for (const asset of projection.assetFacts) {
    const status: AssetLibraryStatus =
      asset.status === "needs_review"
        ? "review"
        : asset.status === "missing"
          ? "missing"
          : asset.status === "rejected"
            ? "rejected"
            : asset.status;
    const detectedSourceKind = asset.path ? assetSourceKindForPath(asset.path) : "manual_definition";
    const draftOnlySource = ["provider_temp_output", "failed_output", "shot_output", "contact_sheet"].includes(asset.sourceKind || detectedSourceKind);
    const sourceKind = draftOnlySource ? "manual_definition" : detectedSourceKind;
    const path = draftOnlySource ? undefined : projectRelativePreviewPath(asset.path, projection.identity.projectRoot);
    const result = addAssetLibraryAsset(library, {
      id: asset.id,
      assetType: asset.type === "unknown" ? "prop" : asset.type,
      name: asset.name,
      status,
      sourceKind,
      path,
      pathOrigin: pathOriginForUi(path),
      importId: asset.id,
      textConstraints: asset.textConstraints.length ? asset.textConstraints : defaultAssetConstraints(asset.type === "unknown" ? "prop" : asset.type, asset.name),
      sourceRefs: asset.sourceRefs.length ? asset.sourceRefs : ["current_project.visual_memory"],
      usedByShotIds: asset.usedByShotIds,
      rejectedReason: asset.rejectedReason,
      updatedAt: new Date().toISOString(),
    });
    library = result.library;
  }
  return library;
}

export function syncRuntimeStateWithAssetLibrary(state: ProjectRuntimeState, library: AssetLibrarySnapshot): ProjectRuntimeState {
  const assets = library.assets.map(assetLibraryAssetToRecord);
  const lockedReferenceIds = assets.reduce((acc, asset) => { if (asset.lockedStatus === "locked") acc.push(asset.id); return acc; }, [] as string[]);
  const candidateReferenceIds = assets.reduce((acc, asset) => { if (asset.lockedStatus === "candidate" || asset.lockedStatus === "needs_review") acc.push(asset.id); return acc; }, [] as string[]);
  const assetTypes = uniqueStrings(assets.map((asset) => asset.type));
  return {
    ...state,
    visualMemory: {
      ...state.visualMemory,
      assets,
      summary: {
        ...state.visualMemory.summary,
        existing: assets.filter((asset) => asset.status !== "missing").length,
        total: assets.length,
        locked: lockedReferenceIds.length,
        needsReview: assets.filter((asset) => asset.lockedStatus === "candidate" || asset.lockedStatus === "needs_review").length,
        missing: assets.filter((asset) => asset.status === "missing" || asset.lockedStatus === "not_generated").length,
        byType: assetTypes.map((type) => {
          const typedAssets = assets.filter((asset) => asset.type === type);
          return {
            type,
            total: typedAssets.length,
            existing: typedAssets.filter((asset) => asset.status !== "missing").length,
            missing: typedAssets.filter((asset) => asset.status === "missing").length,
          };
        }),
      },
    },
    sourceIndex: {
      ...state.sourceIndex,
      lockedReferenceIds,
      candidateReferenceIds,
      rejectedReferenceIds: library.assets.reduce((acc, asset) => { if (asset.status === "rejected") acc.push(asset.id); return acc; }, [] as string[]),
      updatedAt: library.updatedAt,
    },
    sourceIndexSummary: {
      ...state.sourceIndexSummary,
      lockedReferenceCount: lockedReferenceIds.length,
      candidateReferenceCount: candidateReferenceIds.length,
      rejectedReferenceCount: library.assets.filter((asset) => asset.status === "rejected").length,
      blockingReferenceCount: assets.filter((asset) => asset.lockedStatus !== "locked").length,
      updatedAt: library.updatedAt,
    },
  };
}

function projectVibeAssetKind(type: AssetRecord["type"]): ProjectVibeAssetKind {
  if (type === "character" || type === "scene" || type === "prop" || type === "style") return type;
  return "reference";
}

function projectVibeAssetStatus(asset: AssetRecord): ProjectVibeAssetStatus {
  if (asset.status === "missing" || asset.lockedStatus === "not_generated") return "missing";
  if (asset.status === "rejected") return "rejected";
  if (asset.lockedStatus === "locked") return "locked";
  if (asset.lockedStatus === "needs_review") return "needs_review";
  if (asset.lockedStatus === "candidate") return "candidate";
  return asset.status === "planned" ? "candidate" : "needs_review";
}

function projectVibeShotStatus(shot: ShotRecord): ProjectVibeShotStatus {
  if (shot.status === "ready") return "generated";
  if (shot.status === "blocked" || shot.status === "video_missing") return "blocked";
  if (shot.status === "assets_ready" || shot.status === "keyframe_pair_ready") return "ready";
  return "planned";
}

function optionalPortablePath(path: string | undefined) {
  if (!path) return undefined;
  const normalized = path.replace(/\\/g, "/");
  return isPortableProjectPath(normalized) ? normalized : undefined;
}

function projectVibeAssetIdsForShot(
  assets: AssetRecord[],
  state: ProjectRuntimeState,
  shotId: string,
  kind: ProjectVibeAssetKind,
) {
  return assets
    .filter((asset) => projectVibeAssetKind(asset.type) === kind && linkedShotIdsForAsset(asset, state).includes(shotId))
    .map((asset) => asset.id);
}

export function createProjectVibeFromRuntimeState(state: ProjectRuntimeState): ProjectVibeDocument {
  const generatedAt = state.generatedAt || new Date().toISOString();
  const projectId = state.sourceIndex.projectId || "current_project";
  const assets = state.visualMemory.assets;
  const sections = state.storyFlow.sections.length
    ? state.storyFlow.sections.map((section, index) => ({
        id: section.id,
        title: section.label || section.id,
        summary: `${section.shotCount} 个镜头`,
        sequenceIndex: index,
        shotIds: section.shotIds.filter((shotId) => state.storyFlow.shots.some((shot) => shot.id === shotId)),
      }))
    : [{
        id: "current_project",
        title: "当前项目故事流",
        summary: `${state.storyFlow.shots.length} 个镜头`,
        sequenceIndex: 0,
        shotIds: state.storyFlow.shots.map((shot) => shot.id),
      }];
  const sectionIds = new Set(sections.map((section) => section.id));

  return createProjectVibe({
    projectId,
    title: state.project.title || projectId,
    version: state.sourceIndex.projectVersion || "0.1.0",
    createdAt: state.project.importedAt || generatedAt,
    updatedAt: generatedAt,
    storyFlow: {
      id: "story_flow_current",
      sections,
      shotOrder: state.storyFlow.shots.map((shot) => shot.id),
    },
    visualMemory: {
      id: "visual_memory_current",
      entries: assets.map((asset) => {
        const status = projectVibeAssetStatus(asset);
        return {
          id: `vm_${asset.id}`,
          assetId: asset.id,
          kind: projectVibeAssetKind(asset.type),
          label: asset.name,
          status,
          textConstraints: asset.issues.length ? asset.issues : [asset.name],
          usedByShotIds: linkedShotIdsForAsset(asset, state),
          canUseAsFutureReference: status === "locked" && asset.safeForFutureReference,
          sourceRefs: [`runtime.visualMemory.assets:${asset.id}`],
        };
      }),
    },
    shots: state.storyFlow.shots.map((shot) => ({
      id: shot.id,
      sectionId: shot.sectionId && sectionIds.has(shot.sectionId) ? shot.sectionId : sections[0]?.id || "current_project",
      title: shot.title,
      intent: shot.storyFunction,
      sceneAssetIds: projectVibeAssetIdsForShot(assets, state, shot.id, "scene"),
      characterAssetIds: projectVibeAssetIdsForShot(assets, state, shot.id, "character"),
      propAssetIds: projectVibeAssetIdsForShot(assets, state, shot.id, "prop"),
      durationSeconds: 5,
      status: projectVibeShotStatus(shot),
      sourceRefs: ["runtime.storyFlow.shots", "runtime.visualMemory.assets"],
    })),
    assets: assets.map((asset) => ({
      id: asset.id,
      kind: projectVibeAssetKind(asset.type),
      label: asset.name,
      status: projectVibeAssetStatus(asset),
      path: optionalPortablePath(asset.path),
      textConstraints: asset.issues.length ? asset.issues : [asset.name],
      usedByShotIds: linkedShotIdsForAsset(asset, state),
      sourceRefs: [`runtime.visualMemory.assets:${asset.id}`],
      lockedBy: asset.lockedStatus === "locked" ? "user" : undefined,
    })),
    runs: [],
  });
}
