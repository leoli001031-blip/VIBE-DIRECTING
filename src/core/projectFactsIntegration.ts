import type { AssetLibrarySceneAssetPack, AssetLibrarySnapshot } from "./assetLibraryCrud";
import type { ProjectStoreFactFile, ProjectStoreSnapshot } from "./projectStore";
import type { ProjectRuntimeState } from "./projectState";
import type { ShotLayoutContract } from "./visualConsistency";
import type { VoiceSourceLibraryState } from "./voiceSourceLibrary";

export const projectFactsIntegrationSchemaVersion = "0.1.0";
export const projectFactsIntegrationPhase = "phase20_project_facts_integration";

export type ProjectFactsKind =
  | "productionBible"
  | "storyFlow"
  | "shotSpec"
  | "shotLayout"
  | "visualMemory"
  | "spatialMemory"
  | "sceneAssetPack"
  | "voiceMemory";

export type ProjectFactsSourceOfTruth =
  | "project_store"
  | "asset_library"
  | "voice_source_library"
  | "runtime_state"
  | "not_connected";

export type ProjectFactsStatus = "connected" | "partial" | "blocked" | "missing";
export type VisualSupportStatus = "structured" | "partial" | "missing";

export interface ProjectFactConnection {
  kind: ProjectFactsKind;
  label: string;
  sourceOfTruth: ProjectFactsSourceOfTruth;
  path?: string;
  status: ProjectFactsStatus;
  recordCount: number;
  blockers: string[];
  warnings: string[];
  sourceRefs: string[];
}

export interface ProjectFactsVisualConsistencySupport {
  masterScene: {
    status: VisualSupportStatus;
    supportedPackIds: string[];
    blockers: string[];
    warnings: string[];
  };
  derivedViews: {
    status: VisualSupportStatus;
    supportedViewIds: string[];
    blockers: string[];
    warnings: string[];
  };
  worldPosition: {
    status: VisualSupportStatus;
    supportedRefs: string[];
    blockers: string[];
    warnings: string[];
  };
  startEndDerivation: {
    status: VisualSupportStatus;
    supportedShotIds: string[];
    blockers: string[];
    warnings: string[];
  };
}

export interface ProjectFactsIntegrationHardLocks {
  dryRunOnly: true;
  noFileMutation: true;
  noDirectoryCreate: true;
  noProviderSubmit: true;
  noCredentialRead: true;
  noCredentialWrite: true;
  noImageGeneration: true;
  noVideoGeneration: true;
  noTextToVideo: true;
  noFastVip: true;
  image2Preferred: true;
  seedanceJimengVideoParked: true;
  projectFactsAreProjectLocal: true;
  assetLibraryIsNotGallery: true;
  runtimeStateIsDerivedCache: true;
}

export interface ProjectFactsIntegrationState {
  schemaVersion: string;
  phase: typeof projectFactsIntegrationPhase;
  generatedAt: string;
  status: "ready" | "blocked";
  projectId?: string;
  facts: Record<ProjectFactsKind, ProjectFactConnection>;
  visualConsistency: ProjectFactsVisualConsistencySupport;
  summary: {
    connected: number;
    partial: number;
    blocked: number;
    missing: number;
    blockerCount: number;
    warningCount: number;
    projectLocalFactCount: number;
  };
  hardLocks: ProjectFactsIntegrationHardLocks;
  notes: string[];
}

export interface BuildProjectFactsIntegrationInput {
  generatedAt: string;
  projectStore?: ProjectStoreSnapshot;
  assetLibrary?: AssetLibrarySnapshot;
  voiceSourceLibrary?: VoiceSourceLibraryState;
  runtimeState?: Pick<ProjectRuntimeState, "storyFlow" | "visualMemory" | "voiceSourceLibrary">;
  storyFlow?: Record<string, unknown>;
  visualMemory?: Record<string, unknown>;
  shots?: unknown[];
  shotLayouts?: ShotLayoutContract[];
  spatialMemory?: Record<string, unknown>;
  sceneAssetPacks?: AssetLibrarySceneAssetPack[];
}

const hardLocks: ProjectFactsIntegrationHardLocks = {
  dryRunOnly: true,
  noFileMutation: true,
  noDirectoryCreate: true,
  noProviderSubmit: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noImageGeneration: true,
  noVideoGeneration: true,
  noTextToVideo: true,
  noFastVip: true,
  image2Preferred: true,
  seedanceJimengVideoParked: true,
  projectFactsAreProjectLocal: true,
  assetLibraryIsNotGallery: true,
  runtimeStateIsDerivedCache: true,
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function arrayFrom(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hasKeys(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length > 0;
}

function factPath(projectStore: ProjectStoreSnapshot | undefined, role: ProjectStoreFactFile["role"]): string | undefined {
  return projectStore?.factFiles.find((factFile) => factFile.role === role)?.path.path;
}

function fact(
  input: Omit<ProjectFactConnection, "blockers" | "warnings" | "sourceRefs"> & {
    blockers?: string[];
    warnings?: string[];
    sourceRefs?: string[];
  },
): ProjectFactConnection {
  return {
    ...input,
    blockers: unique(input.blockers || []),
    warnings: unique(input.warnings || []),
    sourceRefs: unique(input.sourceRefs || []),
  };
}

function statusFor(blockers: string[], recordCount: number, hasSource: boolean, warnings: string[] = []): ProjectFactsStatus {
  if (blockers.length) return "blocked";
  if (!hasSource) return "missing";
  if (recordCount === 0 || warnings.length) return "partial";
  return "connected";
}

function storyShots(input: BuildProjectFactsIntegrationInput): unknown[] {
  const storyFlow = input.projectStore?.facts.storyFlow || input.storyFlow;
  const runtimeShots = input.runtimeState?.storyFlow?.shots || input.shots || [];
  const directShots = isRecord(storyFlow) ? arrayFrom(storyFlow.shots) : [];
  const sectionShots = isRecord(storyFlow)
    ? arrayFrom(storyFlow.sections).flatMap((section) => (isRecord(section) ? arrayFrom(section.shots) : []))
    : [];
  return directShots.length || sectionShots.length ? [...directShots, ...sectionShots] : runtimeShots;
}

function scenePacks(input: BuildProjectFactsIntegrationInput): AssetLibrarySceneAssetPack[] {
  return input.sceneAssetPacks || input.assetLibrary?.sceneAssetPacks || [];
}

function vectorReady(value: unknown): boolean {
  return isRecord(value)
    && typeof value.x === "number"
    && Number.isFinite(value.x)
    && typeof value.y === "number"
    && Number.isFinite(value.y)
    && typeof value.z === "number"
    && Number.isFinite(value.z);
}

function buildProductionBibleFact(input: BuildProjectFactsIntegrationInput): ProjectFactConnection {
  const productionBible = input.projectStore?.facts.productionBible;
  const hasSource = hasKeys(productionBible);
  const blockers = hasSource ? [] : ["Production Bible is not connected to project-local facts yet."];
  return fact({
    kind: "productionBible",
    label: "Production Bible",
    sourceOfTruth: input.projectStore ? "project_store" : "not_connected",
    path: factPath(input.projectStore, "production_bible"),
    status: statusFor(blockers, hasSource ? 1 : 0, Boolean(input.projectStore)),
    recordCount: hasSource ? 1 : 0,
    blockers,
    sourceRefs: hasSource ? ["projectStore.facts.productionBible"] : [],
  });
}

function buildStoryFlowFact(input: BuildProjectFactsIntegrationInput): ProjectFactConnection {
  const storyFlow = input.projectStore?.facts.storyFlow || input.storyFlow;
  const shots = storyShots(input);
  const blockers = hasKeys(storyFlow) ? [] : ["Story Flow is not connected to project-local facts."];
  const warnings = shots.length ? [] : ["Story Flow has no resolved shots yet."];
  return fact({
    kind: "storyFlow",
    label: "Story Flow",
    sourceOfTruth: input.projectStore?.facts.storyFlow ? "project_store" : input.runtimeState?.storyFlow ? "runtime_state" : "not_connected",
    path: factPath(input.projectStore, "story_flow"),
    status: statusFor(blockers, shots.length, Boolean(storyFlow), warnings),
    recordCount: shots.length,
    blockers,
    warnings,
    sourceRefs: hasKeys(storyFlow) ? ["projectStore.facts.storyFlow"] : input.runtimeState?.storyFlow ? ["runtimeState.storyFlow"] : [],
  });
}

function buildShotSpecFact(input: BuildProjectFactsIntegrationInput): ProjectFactConnection {
  const shotSpecs = input.projectStore?.facts.shotSpecs || [];
  const blockers = shotSpecs.length ? [] : ["Shot Spec project facts are missing."];
  return fact({
    kind: "shotSpec",
    label: "Shot Spec",
    sourceOfTruth: input.projectStore ? "project_store" : "not_connected",
    path: shotSpecs.length === 1 ? shotSpecs[0].path.path : factPath(input.projectStore, "shot_spec"),
    status: statusFor(blockers, shotSpecs.length, Boolean(input.projectStore)),
    recordCount: shotSpecs.length,
    blockers,
    sourceRefs: shotSpecs.map((shot) => `projectStore.facts.shotSpecs:${shot.shotId}`),
  });
}

function buildShotLayoutFact(input: BuildProjectFactsIntegrationInput): ProjectFactConnection {
  const shotLayouts = input.shotLayouts || [];
  const blockers = shotLayouts.length ? [] : ["Shot Layout is not connected; camera placement, subject placement, and layout constraints remain missing."];
  const warnings = shotLayouts.filter((layout) => !layout.schemaVersion || !layout.endFrameDerivation?.derivesFrom).map((layout) => `${layout.shotId} has incomplete Shot Layout derivation structure.`);
  return fact({
    kind: "shotLayout",
    label: "Shot Layout",
    sourceOfTruth: shotLayouts.length ? "project_store" : "not_connected",
    path: shotLayouts.length === 1 ? `shots/${shotLayouts[0].shotId}/shot_layout.vibe.json` : "shots/*/shot_layout.vibe.json",
    status: statusFor(blockers, shotLayouts.length, shotLayouts.length > 0, warnings),
    recordCount: shotLayouts.length,
    blockers,
    warnings,
    sourceRefs: shotLayouts.map((layout) => `shotLayouts:${layout.shotId}`),
  });
}

function buildVisualMemoryFact(input: BuildProjectFactsIntegrationInput): ProjectFactConnection {
  const visualMemory = input.projectStore?.facts.visualMemory || input.visualMemory;
  const assetCount = input.assetLibrary?.assets.length || arrayFrom(isRecord(visualMemory) ? visualMemory.assets : undefined).length || input.runtimeState?.visualMemory?.assets.length || 0;
  const hasSource = Boolean(input.assetLibrary || hasKeys(visualMemory) || input.runtimeState?.visualMemory);
  const blockers = hasSource ? [] : ["Visual Memory is not connected to project-local facts."];
  const warnings = input.assetLibrary?.referenceAuthorityPolicy.assetLibraryIsGallery === false ? [] : ["Visual Memory should be backed by Asset Library authority, not a gallery."];
  return fact({
    kind: "visualMemory",
    label: "Visual Memory",
    sourceOfTruth: input.assetLibrary ? "asset_library" : input.projectStore?.facts.visualMemory ? "project_store" : input.runtimeState?.visualMemory ? "runtime_state" : "not_connected",
    path: factPath(input.projectStore, "visual_memory") || "visual_memory/visual_memory.vibe.json",
    status: statusFor(blockers, assetCount, hasSource, warnings),
    recordCount: assetCount,
    blockers,
    warnings,
    sourceRefs: input.assetLibrary ? ["assetLibrary.assets"] : hasKeys(visualMemory) ? ["projectStore.facts.visualMemory"] : [],
  });
}

function buildSpatialMemoryFact(input: BuildProjectFactsIntegrationInput): ProjectFactConnection {
  const spatialMemory = input.spatialMemory;
  const anchors = arrayFrom(spatialMemory?.anchors);
  const worldPositions = arrayFrom(spatialMemory?.worldPositions);
  const blockers = hasKeys(spatialMemory) ? [] : ["Spatial Memory is not connected; world coordinate facts remain missing."];
  const warnings = hasKeys(spatialMemory) && !worldPositions.length ? ["Spatial Memory has no structured worldPositions array."] : [];
  return fact({
    kind: "spatialMemory",
    label: "Spatial Memory",
    sourceOfTruth: hasKeys(spatialMemory) ? "project_store" : "not_connected",
    path: "spatial_memory/spatial_memory.vibe.json",
    status: statusFor(blockers, anchors.length + worldPositions.length, hasKeys(spatialMemory), warnings),
    recordCount: anchors.length + worldPositions.length,
    blockers,
    warnings,
    sourceRefs: hasKeys(spatialMemory) ? ["spatialMemory"] : [],
  });
}

function buildSceneAssetPackFact(input: BuildProjectFactsIntegrationInput): ProjectFactConnection {
  const packs = scenePacks(input);
  const blockers = packs.length ? [] : ["Scene Asset Pack is not connected; master scene inheritance cannot be checked."];
  const warnings = packs
    .filter((pack) => pack.readiness !== "ready_for_formal")
    .map((pack) => `${pack.id} readiness is ${pack.readiness}.`);
  return fact({
    kind: "sceneAssetPack",
    label: "Scene Asset Pack",
    sourceOfTruth: packs.length ? "asset_library" : "not_connected",
    path: "visual_memory/scene_asset_packs/*.vibe.json",
    status: statusFor(blockers, packs.length, packs.length > 0, warnings),
    recordCount: packs.length,
    blockers,
    warnings,
    sourceRefs: packs.map((pack) => `sceneAssetPacks:${pack.id}`),
  });
}

function buildVoiceMemoryFact(input: BuildProjectFactsIntegrationInput): ProjectFactConnection {
  const voiceSourceLibrary = input.voiceSourceLibrary || input.runtimeState?.voiceSourceLibrary;
  const blockers = voiceSourceLibrary ? [] : ["Voice Memory is not connected to Voice Source Library state."];
  const warnings = voiceSourceLibrary?.summary.locked ? [] : voiceSourceLibrary ? ["Voice Memory has no locked voice sources yet."] : [];
  return fact({
    kind: "voiceMemory",
    label: "Voice Memory",
    sourceOfTruth: voiceSourceLibrary ? "voice_source_library" : "not_connected",
    path: "voice_memory/voice_memory.vibe.json",
    status: statusFor(blockers, voiceSourceLibrary?.sources.length || 0, Boolean(voiceSourceLibrary), warnings),
    recordCount: voiceSourceLibrary?.sources.length || 0,
    blockers,
    warnings,
    sourceRefs: voiceSourceLibrary ? ["voiceSourceLibrary.sources"] : [],
  });
}

function supportStatus(hasStructured: boolean, hasPartial: boolean): VisualSupportStatus {
  if (hasStructured) return "structured";
  if (hasPartial) return "partial";
  return "missing";
}

function buildVisualConsistencySupport(input: BuildProjectFactsIntegrationInput): ProjectFactsVisualConsistencySupport {
  const packs = scenePacks(input);
  const shotLayouts = input.shotLayouts || [];
  const packsWithMaster = packs.filter((pack) => Boolean(pack.masterScene?.id && pack.masterScene.masterImageRefs.length));
  const derivedViews = packs.flatMap((pack) => pack.derivedViews.map((view) => ({ pack, view })));
  const structuredViews = derivedViews.filter(({ view }) => view.inheritsFromMaster && vectorReady(view.worldPosition) && vectorReady(view.cameraVector) && view.derivationEvidence.length);
  const layoutWorldRefs = shotLayouts.filter((layout) => vectorReady(layout.subjectPlacement?.worldPosition) && vectorReady(layout.cameraPlacement?.worldPosition));
  const packWorldRefs = packs.flatMap((pack) => [
    ...pack.masterScene.worldAnchors.map((anchor) => `${pack.id}:${anchor.id}`),
    ...pack.masterScene.cameraVectors.filter((camera) => vectorReady(camera.worldPosition) && vectorReady(camera.cameraVector)).map((camera) => `${pack.id}:${camera.id}`),
    ...pack.derivedViews.filter((view) => vectorReady(view.worldPosition) && vectorReady(view.cameraVector)).map((view) => `${pack.id}:${view.id}`),
  ]);
  const derivationLayouts = shotLayouts.filter((layout) => layout.endFrameDerivation?.derivesFrom === "start_frame");

  return {
    masterScene: {
      status: supportStatus(packsWithMaster.length > 0, packs.length > 0),
      supportedPackIds: packsWithMaster.map((pack) => pack.id),
      blockers: packs.length ? [] : ["Master scene has no Scene Asset Pack source."],
      warnings: packs.length && !packsWithMaster.length ? ["Scene Asset Pack exists but master scene image refs are incomplete."] : [],
    },
    derivedViews: {
      status: supportStatus(structuredViews.length > 0, derivedViews.length > 0),
      supportedViewIds: structuredViews.map(({ view }) => view.id),
      blockers: derivedViews.length ? [] : ["No derived views are connected yet."],
      warnings: derivedViews.length && structuredViews.length !== derivedViews.length ? ["Some derived views lack inheritance evidence, world position, or camera vector."] : [],
    },
    worldPosition: {
      status: supportStatus(packWorldRefs.length > 0 && layoutWorldRefs.length > 0, packWorldRefs.length > 0 || layoutWorldRefs.length > 0),
      supportedRefs: unique([...packWorldRefs, ...layoutWorldRefs.map((layout) => `shotLayout:${layout.shotId}`)]),
      blockers: packWorldRefs.length || layoutWorldRefs.length ? [] : ["World position facts are still missing from Spatial Memory / Scene Asset Pack / Shot Layout."],
      warnings: packWorldRefs.length && !layoutWorldRefs.length ? ["Scene packs have world positions, but Shot Layout world positions are not connected."] : [],
    },
    startEndDerivation: {
      status: supportStatus(derivationLayouts.length > 0, shotLayouts.length > 0),
      supportedShotIds: derivationLayouts.map((layout) => layout.shotId),
      blockers: shotLayouts.length ? [] : ["Start-end derivation is missing because Shot Layout is not connected."],
      warnings: shotLayouts.length && derivationLayouts.length !== shotLayouts.length ? ["Some Shot Layouts do not derive end frame from start_frame."] : [],
    },
  };
}

function summarize(facts: Record<ProjectFactsKind, ProjectFactConnection>): ProjectFactsIntegrationState["summary"] {
  const values = Object.values(facts);
  return {
    connected: values.filter((item) => item.status === "connected").length,
    partial: values.filter((item) => item.status === "partial").length,
    blocked: values.filter((item) => item.status === "blocked").length,
    missing: values.filter((item) => item.status === "missing").length,
    blockerCount: values.reduce((total, item) => total + item.blockers.length, 0),
    warningCount: values.reduce((total, item) => total + item.warnings.length, 0),
    projectLocalFactCount: values.filter((item) => item.sourceOfTruth !== "runtime_state" && item.sourceOfTruth !== "not_connected").length,
  };
}

export function buildProjectFactsIntegrationState(input: BuildProjectFactsIntegrationInput): ProjectFactsIntegrationState {
  const facts: Record<ProjectFactsKind, ProjectFactConnection> = {
    productionBible: buildProductionBibleFact(input),
    storyFlow: buildStoryFlowFact(input),
    shotSpec: buildShotSpecFact(input),
    shotLayout: buildShotLayoutFact(input),
    visualMemory: buildVisualMemoryFact(input),
    spatialMemory: buildSpatialMemoryFact(input),
    sceneAssetPack: buildSceneAssetPackFact(input),
    voiceMemory: buildVoiceMemoryFact(input),
  };
  const summary = summarize(facts);

  return {
    schemaVersion: projectFactsIntegrationSchemaVersion,
    phase: projectFactsIntegrationPhase,
    generatedAt: input.generatedAt,
    status: summary.blockerCount > 0 ? "blocked" : "ready",
    projectId: input.projectStore?.project.id,
    facts,
    visualConsistency: buildVisualConsistencySupport(input),
    summary,
    hardLocks,
    notes: [
      "Project Facts Integration is a pure dry-run builder.",
      "It does not read, write, create, move, or delete project files.",
      "It does not submit providers, read credentials, generate images, generate videos, or enable text-to-video.",
    ],
  };
}

export function validateProjectFactsIntegrationHardLocks(state: ProjectFactsIntegrationState): string[] {
  const errors: string[] = [];
  for (const [key, expected] of Object.entries(hardLocks)) {
    if (state.hardLocks[key as keyof ProjectFactsIntegrationHardLocks] !== expected) {
      errors.push(`Project Facts Integration hard lock drifted: ${key}.`);
    }
  }
  if (state.facts.visualMemory.sourceOfTruth === "asset_library" && state.hardLocks.assetLibraryIsNotGallery !== true) {
    errors.push("Asset Library-backed Visual Memory must remain not-gallery.");
  }
  return errors;
}
