import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function importTs(path) {
  const source = fs.readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: path,
  }).outputText;
  const encoded = Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

const {
  addAssetLibraryAsset,
  addSceneDerivedViewPlaceholder,
  createAssetLibrarySnapshot,
} = await importTs("src/core/assetLibraryCrud.ts");
const { createProjectStoreSnapshot } = await importTs("src/core/projectStore.ts");
const {
  buildProjectFactsIntegrationState,
  validateProjectFactsIntegrationHardLocks,
} = await importTs("src/core/projectFactsIntegration.ts");
const {
  addVoiceSource,
  buildVoiceSourceLibraryState,
} = await importTs("src/core/voiceSourceLibrary.ts");

const generatedAt = "2026-05-01T00:00:00.000Z";
const projectFactsIntegrationSchemaPath = "schemas/project_facts_integration.schema.json";
assert(fs.existsSync(projectFactsIntegrationSchemaPath), "Project Facts Integration schema file missing");
const projectFactsIntegrationSchema = JSON.parse(fs.readFileSync(projectFactsIntegrationSchemaPath, "utf8"));
const schemaRegistrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(
  schemaRegistrySource.includes("project_facts_integration.schema.json") &&
    schemaRegistrySource.includes("ProjectFactsIntegrationState"),
  "schema registry must include ProjectFactsIntegrationState",
);
assert(
  projectFactsIntegrationSchema.properties.phase.const === "phase20_project_facts_integration",
  "Project Facts Integration schema phase const drifted",
);
assert(
  !projectFactsIntegrationSchema.$defs.sourceOfTruth.enum.includes("runtime_state"),
  "Project Facts Integration sourceOfTruth schema must not include runtime_state",
);
assert(
  projectFactsIntegrationSchema.$defs.hardLocks.properties.runtimeStateIsDerivedCache.const === true,
  "Project Facts Integration schema must lock runtime state as derived cache",
);
for (const field of ["ready", "blocker", "missing", "sourceHashes", "sources"]) {
  assert(
    projectFactsIntegrationSchema.$defs.factConnection.required.includes(field),
    `Project Facts Integration factConnection must require ${field}`,
  );
}
for (const field of ["ready", "notReady", "missingSourceCount", "sourceHashCount"]) {
  assert(projectFactsIntegrationSchema.properties.summary.required.includes(field), `Project Facts Integration summary must require ${field}`);
}

function assertNoRuntimeSourceOfTruth(state, message) {
  for (const fact of Object.values(state.facts)) {
    assert(fact.sourceOfTruth !== "runtime_state", `${message}: ${fact.kind} used runtime_state as source-of-truth`);
  }
}

function shotLayout(overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    id: "shot_layout_shot_001",
    shotId: "shot_001",
    sceneId: "garage_scene_master",
    subjectPlacement: {
      subjectId: "hero_main_ref",
      worldPosition: { x: 0, y: 0, z: 1 },
      framePlacement: "center",
      blockingIntent: "Hero waits by the workbench.",
    },
    cameraPlacement: {
      worldPosition: { x: 0, y: 1.5, z: -3 },
      cameraVector: { x: 0, y: -0.1, z: 1 },
      height: "eye_level",
      framing: "medium",
    },
    axisAndDirection: {
      axisId: "garage_axis",
      screenDirection: "static",
      worldDirection: { x: 1, y: 0, z: 0 },
      crossesAxis: false,
    },
    startFrame: {
      description: "Hero stands still at the workbench.",
      subjectPlacementId: "hero_main_ref",
      cameraPlacementId: "garage_camera_A",
    },
    endFrameDerivation: {
      derivesFrom: "start_frame",
      derivationMode: "same_camera_state_change",
      allowedChanges: ["small hand motion"],
      forbiddenChanges: ["new character", "new location"],
    },
    cameraConstraints: {
      fixedCamera: true,
      movementAllowed: "none",
      allowedMovements: [],
      forbiddenMovements: ["dolly", "truck"],
    },
    spatialAnchors: ["garage_door", "workbench"],
    updatedAt: generatedAt,
    ...overrides,
  };
}

const projectStore = createProjectStoreSnapshot({
  generatedAt,
  projectId: "facts_fixture",
  title: "Facts Integration Fixture",
  version: "0.20.0",
  productionBible: {
    schemaVersion: "0.1.0",
    id: "production_bible_fixture",
    logline: "A quiet character study inside a garage.",
    updatedAt: generatedAt,
  },
  storyFlow: {
    schemaVersion: "0.1.0",
    id: "story_flow_fixture",
    productionBibleId: "production_bible_fixture",
    sectionModel: "adaptive",
    sections: [
      {
        id: "opening",
        label: "Opening",
        sectionKind: "custom",
        sequenceIndex: 0,
        storyFunction: "Introduce protagonist and space.",
        beats: [],
        shots: [{ id: "shot_001", shotSpecId: "shot_001", storyFunction: "Hero waits.", status: "planned" }],
      },
    ],
    shotOrder: ["shot_001"],
    sourceRefs: ["fixture.story"],
    updatedAt: generatedAt,
  },
  shotSpecs: [
    {
      shotId: "shot_001",
      value: {
        schemaVersion: "0.1.0",
        id: "shot_001",
        storyFunction: "Hero waits.",
        action: "A small gesture breaks the stillness.",
      },
    },
  ],
  sourceIndex: {
    projectId: "facts_fixture",
    sourceIndexHash: "facts_source_hash",
  },
});

let assetLibrary = createAssetLibrarySnapshot({ id: "facts_visual_memory", createdAt: generatedAt });
let assetResult = addAssetLibraryAsset(assetLibrary, {
  id: "hero_main_ref",
  assetType: "character",
  name: "Hero Main Reference",
  status: "locked",
  sourceKind: "source_asset",
  path: "visual_memory/characters/hero/main.png",
  textConstraints: ["same face", "blue jacket"],
  sourceRefs: ["fixture.hero"],
  usedByShotIds: ["shot_001"],
  updatedAt: generatedAt,
});
assert(assetResult.validation.ok, `hero asset should validate: ${assetResult.validation.errors.join("; ")}`);
assetLibrary = assetResult.library;

assetResult = addAssetLibraryAsset(assetLibrary, {
  id: "garage_scene_master",
  assetType: "scene",
  name: "Garage Master",
  status: "locked",
  sourceKind: "source_asset",
  path: "visual_memory/scenes/garage/master.png",
  textConstraints: ["single garage door", "workbench camera left"],
  sourceRefs: ["fixture.scene"],
  usedByShotIds: ["shot_001"],
  updatedAt: generatedAt,
});
assert(assetResult.validation.ok, `scene asset should validate: ${assetResult.validation.errors.join("; ")}`);
assetLibrary = assetResult.library;

assetResult = addSceneDerivedViewPlaceholder(assetLibrary, {
  sceneId: "garage_scene_master",
  viewId: "garage_reverse_locked",
  status: "locked",
  worldPosition: { x: 1, y: 0, z: 2 },
  cameraVector: { x: 0, y: 0, z: -1 },
  viewImageRefs: ["visual_memory/scenes/garage/reverse.png"],
  derivationEvidence: ["derived_from_master_scene_camera_solve"],
  updatedAt: generatedAt,
});
assert(assetResult.validation.ok, `derived view should validate: ${assetResult.validation.errors.join("; ")}`);
assetLibrary = assetResult.library;

let voiceLibrary = buildVoiceSourceLibraryState({ generatedAt, runtimeVoiceSources: [] });
const voiceResult = addVoiceSource(voiceLibrary, {
  id: "narrator_main",
  displayName: "Narrator Main",
  provider: "openai-tts-planned",
  providerVoiceId: "narrator-placeholder",
  language: "zh-CN",
  role: "narrator",
  consentStatus: "user_owned",
  commercialUseStatus: "allowed",
  status: "locked",
  textConstraints: ["calm low register"],
  updatedAt: generatedAt,
});
assert(voiceResult.validation.ok, `voice source should validate: ${voiceResult.validation.errors.join("; ")}`);
voiceLibrary = voiceResult.library;

const runtimeOnlyState = buildProjectFactsIntegrationState({
  generatedAt,
  runtimeState: {
    storyFlow: {
      schemaVersion: "0.1.0",
      id: "runtime_story_flow",
      shots: [{ id: "runtime_shot_001" }],
    },
    visualMemory: {
      schemaVersion: "0.1.0",
      id: "runtime_visual_memory",
      assets: [{ id: "runtime_asset_001" }],
    },
    voiceSourceLibrary: voiceLibrary,
  },
});
assertNoRuntimeSourceOfTruth(runtimeOnlyState, "runtime-only state");
assert(runtimeOnlyState.facts.storyFlow.status === "blocked", "runtime-only Story Flow must block");
assert(runtimeOnlyState.facts.storyFlow.ready === false, "runtime-only Story Flow must not be ready");
assert(runtimeOnlyState.facts.storyFlow.blocker === true, "runtime-only Story Flow must report blocker=true");
assert(runtimeOnlyState.facts.storyFlow.missing === true, "runtime-only Story Flow must report missing source");
assert(runtimeOnlyState.facts.storyFlow.sourceHashes.length === 0, "runtime-only Story Flow must not report a source hash");
assert(runtimeOnlyState.facts.storyFlow.sourceOfTruth === "not_connected", "runtime-only Story Flow must not become source-of-truth");
assert(runtimeOnlyState.facts.storyFlow.blockers.some((blocker) => blocker.includes("direct input/runtime state")), "runtime-only Story Flow blocker detail missing");
assert(runtimeOnlyState.facts.visualMemory.status === "blocked", "runtime-only Visual Memory must block");
assert(runtimeOnlyState.facts.visualMemory.ready === false, "runtime-only Visual Memory must not be ready");
assert(runtimeOnlyState.facts.visualMemory.missing === true, "runtime-only Visual Memory must report missing source");
assert(runtimeOnlyState.facts.visualMemory.sourceOfTruth === "not_connected", "runtime-only Visual Memory must not become source-of-truth");
assert(runtimeOnlyState.facts.visualMemory.blockers.some((blocker) => blocker.includes("direct input/runtime state")), "runtime-only Visual Memory blocker detail missing");
assert(runtimeOnlyState.facts.voiceMemory.status === "blocked", "runtime-only Voice Memory must block");
assert(runtimeOnlyState.facts.voiceMemory.ready === false, "runtime-only Voice Memory must not be ready");
assert(runtimeOnlyState.facts.voiceMemory.missing === true, "runtime-only Voice Memory must report missing source");
assert(runtimeOnlyState.facts.voiceMemory.sourceOfTruth === "not_connected", "runtime-only Voice Memory must not become source-of-truth");
assert(runtimeOnlyState.facts.voiceMemory.blockers.some((blocker) => blocker.includes("runtime state")), "runtime-only Voice Memory blocker detail missing");

const directStoryState = buildProjectFactsIntegrationState({
  generatedAt,
  storyFlow: {
    schemaVersion: "0.1.0",
    id: "direct_story_flow",
    shots: [{ id: "direct_shot_001" }],
  },
});
assertNoRuntimeSourceOfTruth(directStoryState, "direct Story Flow state");
assert(directStoryState.facts.storyFlow.status === "blocked", "direct Story Flow without Project Store must block");
assert(directStoryState.facts.storyFlow.sourceOfTruth === "not_connected", "direct Story Flow must not claim source-of-truth");
assert(directStoryState.facts.storyFlow.blockers.some((blocker) => blocker.includes("Project Store story_flow")), "direct Story Flow blocker detail missing");

const directVisualState = buildProjectFactsIntegrationState({
  generatedAt,
  visualMemory: {
    schemaVersion: "0.1.0",
    id: "direct_visual_memory",
    assets: [{ id: "direct_asset_001" }],
  },
});
assertNoRuntimeSourceOfTruth(directVisualState, "direct Visual Memory state");
assert(directVisualState.facts.visualMemory.status === "blocked", "direct Visual Memory without Project Store/Asset Library must block");
assert(directVisualState.facts.visualMemory.sourceOfTruth === "not_connected", "direct Visual Memory must not claim source-of-truth");
assert(directVisualState.facts.visualMemory.blockers.some((blocker) => blocker.includes("Asset Library")), "direct Visual Memory blocker detail missing");

const assetOnlyState = buildProjectFactsIntegrationState({
  generatedAt,
  assetLibrary,
});
assertNoRuntimeSourceOfTruth(assetOnlyState, "asset-library state");
assert(assetOnlyState.facts.visualMemory.sourceOfTruth === "asset_library", "Asset Library Visual Memory must remain source-of-truth");
assert(["connected", "partial"].includes(assetOnlyState.facts.visualMemory.status), "Asset Library Visual Memory should remain connected or partial");

const voiceOnlyState = buildProjectFactsIntegrationState({
  generatedAt,
  voiceSourceLibrary: voiceLibrary,
});
assertNoRuntimeSourceOfTruth(voiceOnlyState, "voice-source-library state");
assert(voiceOnlyState.facts.voiceMemory.sourceOfTruth === "voice_source_library", "Voice Source Library must remain source-of-truth");
assert(["connected", "partial"].includes(voiceOnlyState.facts.voiceMemory.status), "Voice Source Library should remain connected or partial");

const blockedState = buildProjectFactsIntegrationState({
  generatedAt,
  projectStore,
  assetLibrary,
  voiceSourceLibrary: voiceLibrary,
});

assertNoRuntimeSourceOfTruth(blockedState, "blocked fixture state");
assert(blockedState.phase === "phase20_project_facts_integration", "phase id drifted");
assert(blockedState.status === "blocked", "missing layout/spatial memory should block integration readiness");
assert(blockedState.facts.productionBible.status === "connected", "fixture Production Bible should connect from Project Store");
assert(blockedState.facts.productionBible.ready === true, "fixture Production Bible should be ready");
assert(blockedState.facts.productionBible.sourceHashes.length > 0, "fixture Production Bible must report source hash");
assert(blockedState.facts.productionBible.sources.some((source) => source.path === "production_bible/production_bible.vibe.json"), "fixture Production Bible source path missing");
assert(blockedState.facts.storyFlow.recordCount === 1, "Story Flow should count fixture shot");
assert(blockedState.facts.storyFlow.sourceOfTruth === "project_store", "Story Flow should use Project Store source-of-truth");
assert(blockedState.facts.shotSpec.status === "connected", "Shot Spec should connect from Project Store");
assert(blockedState.facts.visualMemory.sourceOfTruth === "asset_library", "Visual Memory should prefer Asset Library source of truth");
assert(["connected", "partial"].includes(blockedState.facts.visualMemory.status), "Asset Library-backed Visual Memory should remain connected or partial");
assert(blockedState.facts.voiceMemory.sourceOfTruth === "voice_source_library", "Voice Memory should use Voice Source Library");
assert(["connected", "partial"].includes(blockedState.facts.voiceMemory.status), "Voice Source Library-backed Voice Memory should remain connected or partial");
assert(blockedState.facts.shotLayout.status === "blocked", "missing Shot Layout must block");
assert(blockedState.facts.shotLayout.ready === false, "missing Shot Layout must not be ready");
assert(blockedState.facts.shotLayout.missing === true, "missing Shot Layout must report missing source");
assert(blockedState.facts.shotLayout.blockers.some((blocker) => blocker.includes("Shot Layout")), "Shot Layout blocker detail missing");
assert(blockedState.facts.spatialMemory.status === "blocked", "missing Spatial Memory must block");
assert(blockedState.visualConsistency.masterScene.status === "structured", "master scene should be structurally supported by Scene Asset Pack");
assert(blockedState.visualConsistency.derivedViews.status === "structured", "derived view readiness should be structured");
assert(blockedState.visualConsistency.worldPosition.status === "partial", "world position should be partial without Shot Layout/Spatial Memory");
assert(blockedState.visualConsistency.startEndDerivation.status === "missing", "start-end derivation should be missing without Shot Layout");
assert(blockedState.hardLocks.dryRunOnly === true, "dry-run hard lock missing");
assert(blockedState.hardLocks.noProviderSubmit === true, "provider submit lock missing");
assert(blockedState.hardLocks.noCredentialRead === true, "credential read lock missing");
assert(blockedState.hardLocks.noTextToVideo === true, "text-to-video lock missing");
assert(blockedState.hardLocks.noFastVip === true, "Fast/VIP lock missing");
assert(blockedState.hardLocks.image2Preferred === true, "Image2 preference lock missing");
assert(blockedState.hardLocks.seedanceJimengVideoParked === true, "Seedance/Jimeng parked lock missing");
assert(validateProjectFactsIntegrationHardLocks(blockedState).length === 0, "hard lock validation should pass");

const readyState = buildProjectFactsIntegrationState({
  generatedAt,
  projectStore,
  assetLibrary,
  voiceSourceLibrary: voiceLibrary,
  shotLayouts: [shotLayout()],
  spatialMemory: {
    schemaVersion: "0.1.0",
    id: "spatial_memory_fixture",
    anchors: [{ id: "workbench", label: "Workbench" }],
    worldPositions: [{ id: "hero_main_ref", worldPosition: { x: 0, y: 0, z: 1 } }],
    updatedAt: generatedAt,
  },
});

assertNoRuntimeSourceOfTruth(readyState, "ready fixture state");
assert(readyState.status === "ready", `ready fixture should not block: ${readyState.summary.blockerCount} blockers`);
assert(readyState.summary.ready === 8, "ready fixture should mark all fact families ready");
assert(readyState.summary.notReady === 0, "ready fixture should have no not-ready fact families");
assert(readyState.summary.missingSourceCount === 0, "ready fixture should have no missing sources");
assert(readyState.summary.sourceHashCount >= 8, "ready fixture should report source hashes for all fact families");
assert(readyState.facts.shotLayout.status === "connected", "Shot Layout should connect when layout fixture exists");
assert(readyState.facts.shotLayout.sources[0].hash, "Shot Layout source hash missing");
assert(readyState.facts.spatialMemory.status === "connected", "Spatial Memory should connect when world positions exist");
assert(readyState.facts.spatialMemory.sources[0].path === "spatial_memory/spatial_memory.vibe.json", "Spatial Memory source path missing");
assert(readyState.facts.sceneAssetPack.status === "connected", "locked scene pack with derived view should connect");
assert(readyState.facts.sceneAssetPack.sources[0].path.includes("scene_asset_packs"), "Scene Asset Pack source path missing");
assert(readyState.visualConsistency.worldPosition.status === "structured", "world position should be structured with scene pack and shot layout");
assert(readyState.visualConsistency.startEndDerivation.status === "structured", "start-end derivation should be structured from Shot Layout");
assert(readyState.visualConsistency.startEndDerivation.supportedShotIds.includes("shot_001"), "Shot Layout derivation shot id missing");
assert(readyState.summary.projectLocalFactCount >= 8, "all project-local fact families should be represented");

const drifted = structuredClone(readyState);
drifted.hardLocks.noProviderSubmit = false;
assert(
  validateProjectFactsIntegrationHardLocks(drifted).some((error) => error.includes("noProviderSubmit")),
  "hard lock drift should be detected",
);

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert(
  packageJson.scripts["project-facts-integration:test"] === "node scripts/project-facts-integration-test.mjs",
  "package script project-facts-integration:test missing",
);

console.log(
  `Project facts integration tests passed: ${readyState.summary.connected} connected, ${blockedState.summary.blockerCount} blocker(s) in missing-layout fixture, ${readyState.visualConsistency.derivedViews.supportedViewIds.length} derived view(s).`,
);
