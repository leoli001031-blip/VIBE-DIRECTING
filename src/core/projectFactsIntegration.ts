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
  | "not_connected";

export type ProjectFactsStatus = "connected" | "partial" | "blocked" | "missing";
export type VisualSupportStatus = "structured" | "partial" | "missing";

export interface ProjectFactConnection {
  kind: ProjectFactsKind;
  label: string;
  required: true;
  sourceOfTruth: ProjectFactsSourceOfTruth;
  path?: string;
  sourceHash?: string;
  sourceHashes: string[];
  sources: ProjectFactSourceEvidence[];
  status: ProjectFactsStatus;
  ready: boolean;
  blocker: boolean;
  missing: boolean;
  recordCount: number;
  blockers: string[];
  warnings: string[];
  sourceRefs: string[];
}

export interface ProjectFactSourceEvidence {
  sourceOfTruth: ProjectFactsSourceOfTruth;
  ref: string;
  role?: string;
  path?: string;
  hash?: string;
  derivedCache: false;
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
    ready: number;
    notReady: number;
    connected: number;
    partial: number;
    blocked: number;
    missing: number;
    missingSourceCount: number;
    sourceHashCount: number;
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

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function stableHash(value: unknown): string {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `vck_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function factPath(projectStore: ProjectStoreSnapshot | undefined, role: ProjectStoreFactFile["role"]): string | undefined {
  return projectStore?.factFiles.find((factFile) => factFile.role === role)?.path.path;
}

function sourceFromFactFile(sourceOfTruth: ProjectFactsSourceOfTruth, factFile: ProjectStoreFactFile): ProjectFactSourceEvidence {
  return {
    sourceOfTruth,
    ref: `projectStore.factFiles:${factFile.id}`,
    role: factFile.role,
    path: factFile.path.path,
    hash: factFile.hash,
    derivedCache: false,
  };
}

function sourcesForProjectStoreRole(
  projectStore: ProjectStoreSnapshot | undefined,
  role: ProjectStoreFactFile["role"],
): ProjectFactSourceEvidence[] {
  return (projectStore?.factFiles || [])
    .filter((factFile) => factFile.role === role && factFile.sourceOfTruth === "project_file")
    .map((factFile) => sourceFromFactFile("project_store", factFile));
}

function sourceFromValue(input: {
  sourceOfTruth: ProjectFactsSourceOfTruth;
  ref: string;
  role: string;
  path?: string;
  value: unknown;
}): ProjectFactSourceEvidence {
  return {
    sourceOfTruth: input.sourceOfTruth,
    ref: input.ref,
    role: input.role,
    path: input.path,
    hash: stableHash(input.value),
    derivedCache: false,
  };
}

function fact(
  input: Omit<
    ProjectFactConnection,
    "required" | "sourceHash" | "sourceHashes" | "ready" | "blocker" | "missing" | "blockers" | "warnings" | "sourceRefs" | "sources"
  > & {
    blockers?: string[];
    warnings?: string[];
    sourceRefs?: string[];
    sources?: ProjectFactSourceEvidence[];
    missing?: boolean;
  },
): ProjectFactConnection {
  const blockers = unique(input.blockers || []);
  const warnings = unique(input.warnings || []);
  const sources = input.sources || [];
  const sourceHashes = unique(sources.map((source) => source.hash || ""));
  const missing = input.missing ?? (input.sourceOfTruth === "not_connected" || sources.length === 0);
  const ready = input.status === "connected" && blockers.length === 0 && !missing;
  return {
    ...input,
    required: true,
    sourceHash: sourceHashes.length ? stableHash(sourceHashes) : undefined,
    sourceHashes,
    sources,
    ready,
    blocker: blockers.length > 0 || input.status === "blocked",
    missing,
    blockers,
    warnings,
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
  const sources = hasSource ? sourcesForProjectStoreRole(input.projectStore, "production_bible") : [];
  return fact({
    kind: "productionBible",
    label: "Production Bible",
    sourceOfTruth: input.projectStore ? "project_store" : "not_connected",
    path: factPath(input.projectStore, "production_bible"),
    status: statusFor(blockers, hasSource ? 1 : 0, Boolean(input.projectStore)),
    recordCount: hasSource ? 1 : 0,
    blockers,
    sources,
    sourceRefs: hasSource ? ["projectStore.facts.productionBible"] : [],
  });
}

function buildStoryFlowFact(input: BuildProjectFactsIntegrationInput): ProjectFactConnection {
  const projectStoreStoryFlow = input.projectStore?.facts.storyFlow;
  const storyFlow = projectStoreStoryFlow || input.storyFlow;
  const shots = storyShots(input);
  const hasProjectLocalSource = hasKeys(projectStoreStoryFlow);
  const hasDerivedInput = hasKeys(input.storyFlow) || Boolean(input.runtimeState?.storyFlow);
  const blockers = hasProjectLocalSource
    ? []
    : [
        hasDerivedInput
          ? "Story Flow is only present in direct input/runtime state; connect Project Store story_flow facts before treating it as source-of-truth."
          : "Story Flow is not connected to project-local facts.",
      ];
  const warnings = hasProjectLocalSource && !shots.length ? ["Story Flow has no resolved shots yet."] : [];
  return fact({
    kind: "storyFlow",
    label: "Story Flow",
    sourceOfTruth: hasProjectLocalSource ? "project_store" : "not_connected",
    path: factPath(input.projectStore, "story_flow"),
    status: statusFor(blockers, shots.length, hasProjectLocalSource, warnings),
    recordCount: shots.length,
    blockers,
    warnings,
    sources: hasProjectLocalSource ? sourcesForProjectStoreRole(input.projectStore, "story_flow") : [],
    sourceRefs: hasProjectLocalSource
      ? ["projectStore.facts.storyFlow"]
      : [
          hasKeys(input.storyFlow) ? "directInput.storyFlow" : "",
          input.runtimeState?.storyFlow ? "runtimeState.storyFlow" : "",
        ],
  });
}

function buildShotSpecFact(input: BuildProjectFactsIntegrationInput): ProjectFactConnection {
  const shotSpecs = input.projectStore?.facts.shotSpecs || [];
  const blockers = shotSpecs.length ? [] : ["Shot Spec project facts are missing."];
  const sources = shotSpecs.length ? sourcesForProjectStoreRole(input.projectStore, "shot_spec") : [];
  return fact({
    kind: "shotSpec",
    label: "Shot Spec",
    sourceOfTruth: input.projectStore ? "project_store" : "not_connected",
    path: shotSpecs.length === 1 ? shotSpecs[0].path.path : factPath(input.projectStore, "shot_spec"),
    status: statusFor(blockers, shotSpecs.length, Boolean(input.projectStore)),
    recordCount: shotSpecs.length,
    blockers,
    sources,
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
    sources: shotLayouts.length
      ? shotLayouts.map((layout) =>
          sourceFromValue({
            sourceOfTruth: "project_store",
            ref: `shotLayouts:${layout.shotId}`,
            role: "shot_layout",
            path: `shots/${layout.shotId}/shot_layout.vibe.json`,
            value: layout,
          }),
        )
      : [],
    sourceRefs: shotLayouts.map((layout) => `shotLayouts:${layout.shotId}`),
  });
}

function buildVisualMemoryFact(input: BuildProjectFactsIntegrationInput): ProjectFactConnection {
  const projectStoreVisualMemory = input.projectStore?.facts.visualMemory;
  const projectStoreAssetCount = arrayFrom(isRecord(projectStoreVisualMemory) ? projectStoreVisualMemory.assets : undefined).length;
  const directAssetCount = arrayFrom(isRecord(input.visualMemory) ? input.visualMemory.assets : undefined).length;
  const runtimeAssetCount = arrayFrom(input.runtimeState?.visualMemory?.assets).length;
  const assetCount = input.assetLibrary?.assets.length || projectStoreAssetCount || directAssetCount || runtimeAssetCount;
  const hasProjectLocalSource = Boolean(input.assetLibrary || hasKeys(projectStoreVisualMemory));
  const hasDerivedInput = hasKeys(input.visualMemory) || Boolean(input.runtimeState?.visualMemory);
  const blockers = hasProjectLocalSource
    ? []
    : [
        hasDerivedInput
          ? "Visual Memory is only present in direct input/runtime state; connect Project Store visual_memory facts or Asset Library before treating it as source-of-truth."
          : "Visual Memory is not connected to project-local facts.",
      ];
  const warnings = hasProjectLocalSource && input.assetLibrary?.referenceAuthorityPolicy.assetLibraryIsGallery !== false
    ? ["Visual Memory should be backed by Asset Library authority, not a gallery."]
    : [];
  return fact({
    kind: "visualMemory",
    label: "Visual Memory",
    sourceOfTruth: input.assetLibrary ? "asset_library" : hasKeys(projectStoreVisualMemory) ? "project_store" : "not_connected",
    path: factPath(input.projectStore, "visual_memory") || "visual_memory/visual_memory.vibe.json",
    status: statusFor(blockers, assetCount, hasProjectLocalSource, warnings),
    recordCount: assetCount,
    blockers,
    warnings,
    sources: input.assetLibrary
      ? [
          sourceFromValue({
            sourceOfTruth: "asset_library",
            ref: "assetLibrary.assets",
            role: "visual_memory",
            path: "visual_memory/visual_memory.vibe.json",
            value: input.assetLibrary,
          }),
        ]
      : hasKeys(projectStoreVisualMemory)
        ? sourcesForProjectStoreRole(input.projectStore, "visual_memory")
        : [],
    sourceRefs: input.assetLibrary
      ? ["assetLibrary.assets"]
      : hasKeys(projectStoreVisualMemory)
        ? ["projectStore.facts.visualMemory"]
        : [
            hasKeys(input.visualMemory) ? "directInput.visualMemory" : "",
            input.runtimeState?.visualMemory ? "runtimeState.visualMemory" : "",
          ],
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
    sources: hasKeys(spatialMemory)
      ? [
          sourceFromValue({
            sourceOfTruth: "project_store",
            ref: "spatialMemory",
            role: "spatial_memory",
            path: "spatial_memory/spatial_memory.vibe.json",
            value: spatialMemory,
          }),
        ]
      : [],
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
    sources: packs.length
      ? packs.map((pack) =>
          sourceFromValue({
            sourceOfTruth: "asset_library",
            ref: `sceneAssetPacks:${pack.id}`,
            role: "scene_asset_pack",
            path: `visual_memory/scene_asset_packs/${pack.id}.vibe.json`,
            value: pack,
          }),
        )
      : [],
    sourceRefs: packs.map((pack) => `sceneAssetPacks:${pack.id}`),
  });
}

function buildVoiceMemoryFact(input: BuildProjectFactsIntegrationInput): ProjectFactConnection {
  const voiceSourceLibrary = input.voiceSourceLibrary;
  const hasRuntimeVoiceSourceLibrary = Boolean(input.runtimeState?.voiceSourceLibrary);
  const blockers = voiceSourceLibrary
    ? []
    : [
        hasRuntimeVoiceSourceLibrary
          ? "Voice Memory is only present in runtime state; connect Voice Source Library state before treating it as source-of-truth."
          : "Voice Memory is not connected to Voice Source Library state.",
      ];
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
    sources: voiceSourceLibrary
      ? [
          sourceFromValue({
            sourceOfTruth: "voice_source_library",
            ref: "voiceSourceLibrary.sources",
            role: "voice_memory",
            path: "voice_memory/voice_memory.vibe.json",
            value: voiceSourceLibrary,
          }),
        ]
      : [],
    sourceRefs: voiceSourceLibrary ? ["voiceSourceLibrary.sources"] : hasRuntimeVoiceSourceLibrary ? ["runtimeState.voiceSourceLibrary"] : [],
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
    ready: values.filter((item) => item.ready).length,
    notReady: values.filter((item) => !item.ready).length,
    connected: values.filter((item) => item.status === "connected").length,
    partial: values.filter((item) => item.status === "partial").length,
    blocked: values.filter((item) => item.status === "blocked").length,
    missing: values.filter((item) => item.status === "missing").length,
    missingSourceCount: values.filter((item) => item.missing).length,
    sourceHashCount: values.reduce((total, item) => total + item.sourceHashes.length, 0),
    blockerCount: values.reduce((total, item) => total + item.blockers.length, 0),
    warningCount: values.reduce((total, item) => total + item.warnings.length, 0),
    projectLocalFactCount: values.filter((item) => item.sourceOfTruth !== "not_connected").length,
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
    status: summary.blockerCount > 0 || summary.notReady > 0 ? "blocked" : "ready",
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
