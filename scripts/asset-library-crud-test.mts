import fs from "node:fs";
import {
  addAssetLibraryAsset,
  addSceneDerivedViewPlaceholder,
  createAssetLibrarySnapshot,
  markAssetLibraryAssetStatus,
  toSceneAssetPackDocuments,
  toVisualMemoryDocument,
  updateAssetLibraryAsset,
  validateAssetLibrarySnapshot,
} from "../src/core/assetLibraryCrud.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const generatedAt = "2026-04-30T00:00:00.000Z";
let library = createAssetLibrarySnapshot({ id: "visual_memory_test", createdAt: generatedAt });

assert(library.libraryPurpose === "asset_consistency_memory", "Asset Library must be asset consistency memory");
assert(library.referenceAuthorityPolicy.assetLibraryIsGallery === false, "Asset Library must not be a gallery");
assert(library.hardLocks.noFileMutation === true, "Asset CRUD must not mutate files");
assert(library.hardLocks.noTempOutputPromotion === true, "Asset CRUD must forbid temp output promotion");

let result = addAssetLibraryAsset(library, {
  id: "hero_main_ref",
  assetType: "character",
  name: "Hero Main Reference",
  status: "locked",
  sourceKind: "user_selected_import",
  pathOrigin: "user_selected_import",
  path: "/Users/example/Desktop/hero.png",
  importId: "hero_main_ref_import",
  textConstraints: ["same face", "blue work jacket", "no age shift"],
  sourceRefs: ["user.import.hero"],
  usedByShotIds: ["shot_001"],
  updatedAt: generatedAt,
});
assert(result.validation.ok, `locked protagonist should validate: ${result.validation.errors.join("; ")}`);
assert(result.asset.status === "locked", "protagonist reference must be locked");
assert(result.asset.assetType === "character", "protagonist asset type must be character");
assert(result.asset.canUseAsFutureReference === true, "locked protagonist can be a future reference");
assert(result.asset.sourcePath.rawPathRedacted === true, "user-selected import path must be redacted");
assert(!result.asset.sourcePath.path.includes("/Users/"), "portable asset source must not store macOS absolute path");
library = result.library;

result = addAssetLibraryAsset(library, {
  id: "garage_scene_master",
  assetType: "scene",
  name: "Garage Master Scene",
  status: "locked",
  sourceKind: "source_asset",
  path: "visual_memory/scenes/garage/master.png",
  textConstraints: ["single garage door on north wall", "workbench on camera left", "cool overhead fluorescent light"],
  sourceRefs: ["production_bible.scene.garage"],
  usedByShotIds: ["shot_001", "shot_002"],
  updatedAt: generatedAt,
});
assert(result.validation.ok, `locked scene should validate: ${result.validation.errors.join("; ")}`);
assert(result.asset.status === "locked", "scene reference must be locked");
library = result.library;
assert(library.sceneAssetPacks.length === 1, "adding a scene reference must create a scene asset pack placeholder");
assert(library.sceneAssetPacks[0].masterScene.masterImageRefs.includes("visual_memory/scenes/garage/master.png"), "scene master must reference the master image");
assert(library.sceneAssetPacks[0].inheritanceRules.masterInheritanceRequired === true, "scene pack must require master inheritance");

result = addSceneDerivedViewPlaceholder(library, {
  sceneId: "garage_scene_master",
  viewId: "garage_scene_reverse_view",
  worldPosition: { x: 1, y: 0, z: 2 },
  cameraVector: { x: 0, y: 0, z: -1 },
  derivationEvidence: ["derived from garage master scene placeholder"],
  updatedAt: "2026-04-30T00:01:00.000Z",
});
assert(result.validation.ok, `derived view placeholder should validate: ${result.validation.errors.join("; ")}`);
library = result.library;
const scenePack = toSceneAssetPackDocuments(library)[0];
assert(scenePack.derivedViews.length === 1, "scene pack must include one derived view placeholder");
assert(scenePack.derivedViews[0].inheritsFromMaster === true, "derived view must inherit from master");
assert(scenePack.derivedViews[0].derivationEvidence.length === 1, "derived view must carry derivation evidence");

result = addAssetLibraryAsset(library, {
  id: "style_noir_candidate",
  assetType: "style",
  name: "Muted Noir Style",
  status: "candidate",
  sourceKind: "manual_definition",
  textConstraints: ["muted green shadows", "low contrast skin tones"],
  updatedAt: "2026-04-30T00:02:00.000Z",
});
assert(result.validation.ok, `candidate style should validate: ${result.validation.errors.join("; ")}`);
assert(result.asset.visualMemoryStatus === "candidate", "candidate style must map to Visual Memory candidate");
assert(result.asset.canUseAsFutureReference === false, "candidate style must not be a future reference");
library = result.library;

result = markAssetLibraryAssetStatus(library, "style_noir_candidate", "review", "2026-04-30T00:03:00.000Z");
assert(result.validation.ok, `review style should validate: ${result.validation.errors.join("; ")}`);
assert(result.asset.status === "review", "review status must be retained in Asset Library state");
assert(result.asset.visualMemoryStatus === "candidate", "review status must serialize as candidate, not locked");
assert(result.asset.referenceAuthority.lockedStatus === "needs_review", "review status must map to needs_review authority");
library = result.library;

result = addAssetLibraryAsset(library, {
  id: "lighting_needs_review_direct",
  assetType: "style",
  name: "Lighting Needs Review",
  status: "review",
  sourceKind: "manual_definition",
  textConstraints: ["warm rim light is promising but not authority-locked"],
  updatedAt: "2026-04-30T00:03:30.000Z",
});
assert(result.validation.ok, `direct needs_review style should validate: ${result.validation.errors.join("; ")}`);
assert(result.asset.status === "review", "direct needs_review asset must use the review Asset Library state");
assert(result.asset.referenceAuthority.lockedStatus === "needs_review", "direct review asset must expose needs_review authority status");
assert(result.asset.visualMemoryStatus === "candidate", "direct needs_review asset must serialize as candidate until locked");
assert(result.asset.canUseAsFutureReference === false, "direct needs_review asset must not be a future reference");
library = result.library;

result = addAssetLibraryAsset(library, {
  id: "continuity_prop_lifecycle",
  assetType: "prop",
  name: "Continuity Prop Lifecycle",
  status: "candidate",
  sourceKind: "source_asset",
  path: "visual_memory/props/toolbox/candidate.png",
  textConstraints: ["red metal toolbox", "silver latch stays visible"],
  updatedAt: "2026-04-30T00:03:40.000Z",
});
assert(result.validation.ok, `candidate prop lifecycle should validate: ${result.validation.errors.join("; ")}`);
assert(result.asset.status === "candidate", "candidate lifecycle asset must be created as candidate");
assert(result.asset.referenceAuthority.lockedStatus === "candidate", "candidate lifecycle asset must expose candidate authority");
library = result.library;

result = markAssetLibraryAssetStatus(library, "continuity_prop_lifecycle", "locked", "2026-04-30T00:03:50.000Z");
assert(result.validation.ok, `locked prop lifecycle should validate: ${result.validation.errors.join("; ")}`);
assert(result.asset.status === "locked", "candidate lifecycle asset must migrate to locked");
assert(result.asset.visualMemoryStatus === "locked", "locked lifecycle asset must serialize as locked");
assert(result.asset.canUseAsFutureReference === true, "locked lifecycle asset can be a future reference");
library = result.library;

result = markAssetLibraryAssetStatus(library, "continuity_prop_lifecycle", "review", "2026-04-30T00:03:55.000Z");
assert(result.validation.ok, `needs_review prop lifecycle should validate: ${result.validation.errors.join("; ")}`);
assert(result.asset.status === "review", "locked lifecycle asset must migrate to review state");
assert(result.asset.referenceAuthority.lockedStatus === "needs_review", "review lifecycle asset must expose needs_review authority");
assert(result.asset.canUseAsFutureReference === false, "needs_review lifecycle asset must not remain a future reference");
library = result.library;

result = markAssetLibraryAssetStatus(library, "continuity_prop_lifecycle", "missing", "2026-04-30T00:03:59.000Z");
assert(result.validation.ok, `missing prop lifecycle should validate: ${result.validation.errors.join("; ")}`);
assert(result.asset.status === "missing", "review lifecycle asset must be markable as missing");
assert(result.asset.mainReferencePath === undefined, "missing lifecycle asset must drop the main reference path");
assert(result.asset.visualMemoryStatus === "not_serialized", "missing lifecycle asset must not serialize into Visual Memory");
assert(result.asset.formalLibraryIncluded === false, "missing lifecycle asset must leave the formal Asset Library export");
library = result.library;

result = addAssetLibraryAsset(library, {
  id: "voice_anchor_placeholder",
  assetType: "voice_anchor",
  name: "Narrator Voice Anchor",
  status: "missing",
  sourceKind: "manual_definition",
  textConstraints: ["warm low register", "measured delivery"],
  updatedAt: "2026-04-30T00:04:00.000Z",
});
assert(result.validation.ok, `missing voice anchor should validate: ${result.validation.errors.join("; ")}`);
assert(result.asset.visualMemoryStatus === "not_serialized", "missing asset must not serialize into Visual Memory assets");
assert(result.asset.formalLibraryIncluded === false, "missing asset must not enter formal Visual Memory");
library = result.library;

result = updateAssetLibraryAsset(library, "voice_anchor_placeholder", {
  status: "rejected",
  rejectedReason: "Voice source not cleared.",
  updatedAt: "2026-04-30T00:05:00.000Z",
});
assert(result.validation.ok, `rejected voice anchor should validate: ${result.validation.errors.join("; ")}`);
assert(result.asset.visualMemoryStatus === "rejected", "rejected asset must map to Visual Memory rejected");
assert(result.asset.canPromoteToFormal === false, "rejected asset cannot promote to formal");
library = result.library;

for (const forbidden of [
  {
    id: "tmp_provider_output",
    sourceKind: "provider_temp_output",
    path: "tmp/generated/hero.png",
    reason: "provider temp",
  },
  {
    id: "failed_provider_output",
    sourceKind: "failed_output",
    path: "outputs/failed/hero.png",
    reason: "failed output",
  },
  {
    id: "contact_sheet_output",
    sourceKind: "contact_sheet",
    path: "reports/contact_sheets/assets.png",
    reason: "contact sheet",
  },
  {
    id: "shot_output_frame",
    sourceKind: "shot_output",
    path: "outputs/shots/shot_001/start.png",
    reason: "shot output",
  },
]) {
  const beforeCount = library.assets.length;
  result = addAssetLibraryAsset(library, {
    id: forbidden.id,
    assetType: "character",
    name: forbidden.reason,
    status: "locked",
    sourceKind: forbidden.sourceKind,
    path: forbidden.path,
    textConstraints: ["should be rejected"],
    updatedAt: "2026-04-30T00:06:00.000Z",
  });
  assert(result.rejected, `${forbidden.reason} must be rejected`);
  assert(result.library.assets.length === beforeCount, `${forbidden.reason} must not be added to assets`);
  library = result.library;
}

const validation = validateAssetLibrarySnapshot(library, "2026-04-30T00:07:00.000Z");
assert(validation.ok, `final library should validate: ${validation.errors.join("; ")}`);

const visualMemory = toVisualMemoryDocument(library);
assert(visualMemory.libraryPurpose === "asset_consistency_memory", "Visual Memory export must stay asset consistency memory");
assert(visualMemory.referenceAuthorityPolicy.assetLibraryIsGallery === false, "Visual Memory export must not be a gallery");
assert(visualMemory.assets.some((asset) => asset.id === "hero_main_ref" && asset.status === "locked"), "Visual Memory must include locked protagonist");
assert(visualMemory.assets.some((asset) => asset.id === "garage_scene_master" && asset.status === "locked"), "Visual Memory must include locked scene");
assert(visualMemory.assets.some((asset) => asset.id === "style_noir_candidate" && asset.status === "candidate"), "Visual Memory must preserve review/candidate mapping");
assert(visualMemory.assets.some((asset) => asset.id === "lighting_needs_review_direct" && asset.status === "candidate"), "Visual Memory must preserve direct needs_review as candidate");
assert(visualMemory.assets.some((asset) => asset.id === "voice_anchor_placeholder" && asset.status === "rejected"), "Visual Memory must preserve rejected mapping");
assert(!visualMemory.assets.some((asset) => asset.id === "continuity_prop_lifecycle"), "Missing lifecycle asset must not enter Visual Memory");
assert(!visualMemory.assets.some((asset) => asset.id.startsWith("tmp_") || asset.id.startsWith("failed_")), "Forbidden artifacts must not enter Visual Memory");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert(packageJson.scripts["asset-library:test"] === "tsx scripts/asset-library-crud-test.mts", "package script asset-library:test missing");

console.log(
  `Asset Library CRUD tests passed: ${library.assets.length} authority assets, ${library.blockedImports.length} blocked imports, ${scenePack.derivedViews.length} derived view placeholder.`,
);
