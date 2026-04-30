import fs from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function get(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function assertRequired(schema, path, fields) {
  const required = get(schema, path);
  assert(Array.isArray(required), `${schema.title} missing required array at ${path}`);
  for (const field of fields) {
    assert(required.includes(field), `${schema.title} must require ${field} at ${path}`);
  }
}

function propertyNames(object, names = []) {
  if (!object || typeof object !== "object") return names;
  for (const [key, value] of Object.entries(object)) {
    if (key === "properties" && value && typeof value === "object") {
      names.push(...Object.keys(value));
    }
    propertyNames(value, names);
  }
  return names;
}

const schemas = [
  ["schemas/production_bible.schema.json", "ProductionBible"],
  ["schemas/story_flow.schema.json", "StoryFlow"],
  ["schemas/shot_spec.schema.json", "ShotSpec"],
  ["schemas/shot_layout.schema.json", "ShotLayout"],
  ["schemas/visual_memory.schema.json", "VisualMemory"],
  ["schemas/spatial_memory.schema.json", "SpatialMemory"],
  ["schemas/voice_memory.schema.json", "VoiceMemory"],
  ["schemas/scene_asset_pack.schema.json", "SceneAssetPack"],
];

const loaded = new Map();

for (const [path, title] of schemas) {
  const schema = readJson(path);
  loaded.set(title, schema);
  assert(schema.title === title, `${path} title drifted`);
  assert(schema.$id === `https://vibecore.local/schemas/${path.replace("schemas/", "")}`, `${title} $id drifted`);
  assert(schema.$schema === "https://json-schema.org/draft/2020-12/schema", `${title} must use draft 2020-12`);
  assert(schema.additionalProperties === false, `${title} must reject unknown top-level fields`);
}

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
for (const [path, title] of schemas) {
  const fileName = path.replace("schemas/", "");
  assert(registrySource.includes(fileName), `schema registry must include ${fileName}`);
  assert(registrySource.includes(title), `schema registry must include ${title}`);
}

const productionBible = loaded.get("ProductionBible");
assertRequired(productionBible, "required", [
  "storyPremise",
  "characters",
  "scenes",
  "props",
  "styleRules",
  "soundDirection",
  "reusableAssetRequirements",
  "keyframePairRequirements",
]);

const storyFlow = loaded.get("StoryFlow");
assert(storyFlow.properties.sectionModel.const === "adaptive", "Story Flow must declare adaptive section model");
assertRequired(storyFlow, "required", ["sectionModel", "sections", "shotOrder"]);
assertRequired(storyFlow, "$defs.section.required", ["label", "sectionKind", "beats", "shots"]);
assert(!storyFlow.$defs.section.properties.label.enum, "Story Flow section labels must not be fixed to named acts");
const sectionKinds = storyFlow.$defs.section.properties.sectionKind.enum.join("|");
assert(!/Act I|Act II|Act III|Act IV/.test(sectionKinds), "Story Flow section kinds must not hard-code Act I-IV");

const shotSpec = loaded.get("ShotSpec");
assertRequired(shotSpec, "required", [
  "storyFunction",
  "action",
  "emotionalIntent",
  "targetDurationSeconds",
  "dialogue",
  "pairConstraints",
  "allowedDelta",
  "forbiddenChanges",
  "lockedAssetRefs",
  "layoutId",
]);
assertRequired(shotSpec, "$defs.pairConstraints.required", [
  "requiresKeyframePair",
  "startFrameSource",
  "endFrameSource",
  "endFrameDerivesFromStart",
]);
assert(shotSpec.$defs.pairConstraints.properties.endFrameDerivesFromStart.const === true, "Shot Spec must default end frame derivation from start");

const shotLayout = loaded.get("ShotLayout");
assertRequired(shotLayout, "required", [
  "subjectPlacement",
  "cameraPlacement",
  "axisAndDirection",
  "startFrame",
  "endFrameDerivation",
  "cameraConstraints",
]);
assertRequired(shotLayout, "$defs.subjectPlacement.required", ["worldPosition", "framePlacement", "blockingIntent"]);
assertRequired(shotLayout, "$defs.cameraPlacement.required", ["worldPosition", "cameraVector", "height", "framing"]);
assertRequired(shotLayout, "$defs.axisAndDirection.required", ["axisId", "screenDirection", "worldDirection"]);
assertRequired(shotLayout, "$defs.endFrameDerivation.required", ["derivesFrom", "derivationMode", "allowedChanges", "forbiddenChanges"]);
assert(shotLayout.$defs.endFrameDerivation.properties.derivesFrom.const === "start_frame", "Shot Layout must derive end frame from start frame");
assertRequired(shotLayout, "$defs.cameraConstraints.required", ["fixedCamera", "movementAllowed", "allowedMovements", "forbiddenMovements"]);

const visualMemory = loaded.get("VisualMemory");
assert(visualMemory.properties.libraryPurpose.const === "asset_consistency_memory", "Visual Memory must be asset consistency memory");
assertRequired(visualMemory, "required", ["referenceAuthorityPolicy", "v0Compatibility", "assets"]);
assert(visualMemory.$defs.assetStatus.enum.join("|") === "locked|candidate|rejected", "Visual Memory status set must be locked/candidate/rejected only");
assert(visualMemory.$defs.asset.properties.assetType.enum.includes("voice_anchor"), "Visual Memory must support voice anchors");
assertRequired(visualMemory, "$defs.asset.required", [
  "referenceAuthority",
  "textConstraints",
  "usedByShotIds",
  "canPromoteToFormal",
  "canUseAsFutureReference",
]);
assert(visualMemory.$defs.referenceAuthorityPolicy.properties.assetLibraryIsGallery.const === false, "Asset Library must not be modeled as a gallery");
assert(visualMemory.$defs.referenceAuthorityPolicy.properties.tempOutputAutoPromote.const === false, "Visual Memory must forbid temp output auto-promotion");
assert(visualMemory.$defs.referenceAuthorityPolicy.properties.localPostprocessCanSemanticRepair.const === false, "Local postprocess must not be semantic repair");
assert(visualMemory.$defs.v0Compatibility.properties.supportsSingleMainCharacterReference.const === true, "v0.1/v0.3 must support one protagonist reference");
assert(visualMemory.$defs.v0Compatibility.properties.supportsSingleSceneReference.const === true, "v0.1/v0.3 must support one scene reference");
assert(visualMemory.$defs.v0Compatibility.properties.requiresTextConstraints.const === true, "v0.1/v0.3 must support text constraints");
assert(visualMemory.$defs.v0Compatibility.properties.supportsLockedStatus.const === true, "v0.1/v0.3 must support locked status");
const tempRule = visualMemory.$defs.asset.allOf.find((rule) => rule.if?.properties?.originKind?.const === "provider_temp_output");
assert(tempRule, "Visual Memory must include provider temp output rule");
assert(tempRule.then.properties.canPromoteToFormal.const === false, "provider temp output must not promote to formal");
assert(tempRule.then.properties.canUseAsFutureReference.const === false, "provider temp output must not become future reference");
assert(!tempRule.then.properties.status.enum.includes("locked"), "provider temp output must not become locked through auto-promotion");

const spatialMemory = loaded.get("SpatialMemory");
assertRequired(spatialMemory, "required", ["coordinatePolicy", "scenes"]);
assert(spatialMemory.$defs.coordinatePolicy.properties.worldPositionRequired.const === true, "Spatial Memory must require world positions");
assert(spatialMemory.$defs.coordinatePolicy.properties.cameraVectorRequired.const === true, "Spatial Memory must require camera vectors");
assert(spatialMemory.$defs.coordinatePolicy.properties.textOnlyMultiViewAllowed.const === false, "Spatial Memory must reject text-only multi-view recreation");
assertRequired(spatialMemory, "$defs.spatialScene.required", ["worldAnchors", "cameraVectors", "subjectBlocking", "axisRules", "revealStates", "derivedViewRefs"]);

const voiceMemory = loaded.get("VoiceMemory");
assertRequired(voiceMemory, "required", ["privateAuthMaterialForbidden", "voiceSources"]);
assert(voiceMemory.properties.privateAuthMaterialForbidden.const === true, "Voice Memory must forbid private auth material");
assertRequired(voiceMemory, "$defs.voiceSource.required", [
  "provider",
  "providerVoiceId",
  "language",
  "role",
  "consentStatus",
  "commercialUseStatus",
  "status",
  "textConstraints",
]);
const forbiddenVoiceKeys = new Set(["credential", "credentials", "apiKey", "accessToken", "secret", "password", "token"]);
const voicePropertyNames = propertyNames(voiceMemory);
for (const name of voicePropertyNames) {
  assert(!forbiddenVoiceKeys.has(name), `Voice Memory must not define private auth field: ${name}`);
}

const sceneAssetPack = loaded.get("SceneAssetPack");
assertRequired(sceneAssetPack, "required", ["masterScene", "derivedViews", "readiness", "inheritanceRules"]);
assertRequired(sceneAssetPack, "$defs.masterScene.required", [
  "referenceAuthority",
  "worldCoordinateSystem",
  "worldAnchors",
  "cameraVectors",
  "masterImageRefs",
  "textConstraints",
]);
assertRequired(sceneAssetPack, "$defs.derivedView.required", [
  "masterSceneId",
  "inheritsFromMaster",
  "inheritanceOverrides",
  "worldPosition",
  "cameraVector",
  "viewImageRefs",
  "derivationEvidence",
]);
assert(sceneAssetPack.$defs.derivedView.properties.inheritsFromMaster.const === true, "Derived views must inherit from master scene");
assert(sceneAssetPack.$defs.inheritanceRules.properties.masterInheritanceRequired.const === true, "Scene Asset Pack must require master inheritance");
assert(sceneAssetPack.$defs.inheritanceRules.properties.textOnlyViewRecreationAllowed.const === false, "Scene Asset Pack must reject text-only view recreation");
assert(sceneAssetPack.$defs.inheritanceRules.properties.unknownDerivationCanLock.const === false, "Unknown derivation must not lock a view");

console.log(`Project facts schema tests passed: ${schemas.length} schemas checked.`);
