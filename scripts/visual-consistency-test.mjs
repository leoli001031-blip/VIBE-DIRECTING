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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const {
  addAssetLibraryAsset,
  addSceneDerivedViewPlaceholder,
  createAssetLibrarySnapshot,
} = await importTs("src/core/assetLibraryCrud.ts");
const {
  validateAssetLibraryHardContracts,
  validateSceneAssetPackHardContracts,
  validateShotLayoutHardContracts,
  validateStartEndDerivationHardContracts,
  validatePostprocessHardContracts,
  validateVisualConsistency,
} = await importTs("src/core/visualConsistency.ts");

const generatedAt = "2026-04-30T00:00:00.000Z";

function addRequiredAssets() {
  let library = createAssetLibrarySnapshot({ id: "visual_consistency_fixture", createdAt: generatedAt });
  let result = addAssetLibraryAsset(library, {
    id: "hero_locked",
    assetType: "character",
    name: "Hero Locked",
    status: "locked",
    sourceKind: "source_asset",
    path: "visual_memory/characters/hero/main.png",
    textConstraints: ["same face", "blue work jacket"],
    sourceRefs: ["fixture.hero"],
    usedByShotIds: ["S02"],
    updatedAt: generatedAt,
  });
  assert(result.validation.ok, `hero asset should validate: ${result.validation.errors.join("; ")}`);
  library = result.library;

  result = addAssetLibraryAsset(library, {
    id: "garage_scene_locked",
    assetType: "scene",
    name: "Garage Scene Locked",
    status: "locked",
    sourceKind: "source_asset",
    path: "visual_memory/scenes/garage/master.png",
    textConstraints: ["single garage door", "workbench camera left"],
    sourceRefs: ["fixture.scene"],
    usedByShotIds: ["S01", "S02", "S03"],
    updatedAt: generatedAt,
  });
  assert(result.validation.ok, `scene asset should validate: ${result.validation.errors.join("; ")}`);
  library = result.library;

  result = addSceneDerivedViewPlaceholder(library, {
    sceneId: "garage_scene_locked",
    viewId: "garage_reverse_locked",
    status: "locked",
    worldPosition: { x: 1, y: 0, z: 2 },
    cameraVector: { x: 0, y: 0, z: -1 },
    viewImageRefs: ["visual_memory/scenes/garage/reverse.png"],
    derivationEvidence: ["derived_from_master_scene_camera_solve"],
    updatedAt: generatedAt,
  });
  assert(result.validation.ok, `derived view should validate: ${result.validation.errors.join("; ")}`);
  library = result.library;

  result = addAssetLibraryAsset(library, {
    id: "muted_style_candidate",
    assetType: "style",
    name: "Muted Style Candidate",
    status: "candidate",
    sourceKind: "manual_definition",
    textConstraints: ["low contrast", "green shadows"],
    sourceRefs: ["fixture.style"],
    updatedAt: generatedAt,
  });
  assert(result.validation.ok, `candidate asset should validate: ${result.validation.errors.join("; ")}`);
  library = result.library;

  result = addAssetLibraryAsset(library, {
    id: "bad_prop_rejected",
    assetType: "prop",
    name: "Rejected Prop",
    status: "rejected",
    sourceKind: "manual_definition",
    textConstraints: ["not approved"],
    rejectedReason: "Prop breaks continuity.",
    sourceRefs: ["fixture.rejected"],
    updatedAt: generatedAt,
  });
  assert(result.validation.ok, `rejected asset should validate: ${result.validation.errors.join("; ")}`);
  return result.library;
}

function shotLayout(overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    id: "shot_layout_S02",
    shotId: "S02",
    sceneId: "garage_scene_locked",
    subjectPlacement: {
      subjectId: "hero_locked",
      worldPosition: { x: 0, y: 0, z: 1 },
      framePlacement: "center",
      blockingIntent: "hold still at the workbench",
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
      description: "Hero stands at the workbench.",
      subjectPlacementId: "hero_locked",
      cameraPlacementId: "garage_camera_A",
    },
    endFrameDerivation: {
      derivesFrom: "start_frame",
      derivationMode: "same_camera_state_change",
      allowedChanges: ["micro-expression", "small hand motion"],
      forbiddenChanges: ["new character", "new location"],
    },
    cameraConstraints: {
      fixedCamera: true,
      movementAllowed: "none",
      allowedMovements: [],
      forbiddenMovements: ["dolly", "truck", "large camera movement"],
    },
    spatialAnchors: ["garage_door", "workbench"],
    updatedAt: generatedAt,
    ...overrides,
  };
}

function endPromptPlan(overrides = {}) {
  return {
    promptPlanId: "prompt_S02_end",
    promptPlanHash: "prompt_hash_end",
    sourceShotSpecHash: "shot_hash_S02",
    jobId: "job_S02_end",
    shotId: "S02",
    providerId: "openai-image2-api",
    providerSlot: "image.edit",
    requiredMode: "image2image",
    promptKind: "end_frame",
    sourceIntent: ["derive end frame from approved start frame"],
    naturalLanguagePolicy: "source_intent_only",
    mustPreserve: ["character identity", "scene layout"],
    mustAvoid: ["new character", "new location"],
    referenceIds: ["hero_locked", "garage_scene_locked"],
    styleDirectives: ["same palette"],
    adapterWarnings: [],
    derivesFromStartFrame: true,
    status: "ready_for_envelope",
    blockers: [],
    conflictReportId: "conflict_clear",
    createdAt: generatedAt,
    ...overrides,
  };
}

function keyframePair(overrides = {}) {
  return {
    shotId: "S02",
    startFrameId: "outputs/keyframes/S02_start.png",
    endFrameId: "outputs/keyframes/S02_end.png",
    endDerivationSource: "start_frame",
    validForI2vPair: true,
    allowedDelta: ["micro-expression", "camera movement"],
    mustPreserve: ["character identity", "scene layout"],
    mustNotAdd: ["new character", "new location"],
    ...overrides,
  };
}

const library = addRequiredAssets();
const cleanReport = validateVisualConsistency({
  checkedAt: generatedAt,
  assetLibrary: library,
  shotLayouts: [shotLayout()],
  startEndDerivations: {
    keyframePairs: [keyframePair()],
    promptPlans: [endPromptPlan()],
  },
  postprocessPolicies: [
    {
      policyId: "local_postprocess_safe",
      allowedLocalOperations: ["resize", "format_convert", "thumbnail_preview", "metadata_probe", "manifest_match"],
      semanticRepairAllowed: false,
      openCvSemanticRepairAllowed: false,
      localPostprocessCanChangeMeaning: false,
      localPostprocessCanPromoteFormal: false,
      forbiddenActions: ["semantic_postprocess_repair"],
    },
  ],
});

assert(cleanReport.status === "pass", `clean visual consistency report should pass: ${cleanReport.blockers.join("; ")}`);
assert(cleanReport.hardLocks.derivedViewsMustInheritMasterScene === true, "derived-view hard lock missing");
assert(cleanReport.hardLocks.endFrameDefaultsToStartFrameDerivation === true, "end-frame derivation hard lock missing");
assert(cleanReport.summary.lockedAssets === 2, "clean fixture should include two locked assets");
assert(cleanReport.summary.candidateAssets === 1, "clean fixture should include one candidate asset");
assert(cleanReport.summary.rejectedAssets === 1, "clean fixture should include one rejected asset");

const assetIssues = validateAssetLibraryHardContracts(library);
assert(assetIssues.length === 0, `valid asset library should have no hard contract issues: ${assetIssues.map((item) => item.detail).join("; ")}`);

const contaminatedLibrary = clone(library);
const candidate = contaminatedLibrary.assets.find((asset) => asset.id === "muted_style_candidate");
candidate.canUseAsFutureReference = true;
candidate.referenceAuthority.canUseAsFutureReference = true;
candidate.referenceAuthority.allowedUse.push("future_reference");
const rejected = contaminatedLibrary.assets.find((asset) => asset.id === "bad_prop_rejected");
rejected.canPromoteToFormal = true;
const forbiddenFuture = clone(contaminatedLibrary.assets.find((asset) => asset.id === "hero_locked"));
forbiddenFuture.id = "contact_sheet_promoted";
forbiddenFuture.sourceKind = "contact_sheet";
forbiddenFuture.mainReferencePath = "reports/contact_sheets/hero_grid.png";
forbiddenFuture.referenceAuthority.path = "reports/contact_sheets/hero_grid.png";
contaminatedLibrary.assets.push(forbiddenFuture);

const contaminatedReport = validateVisualConsistency({ checkedAt: generatedAt, assetLibrary: contaminatedLibrary });
assert(contaminatedReport.status === "blocked", "contaminated asset library must block");
assert(
  contaminatedReport.issues.some((item) => item.code === "asset_status_future_reference_violation"),
  "candidate future-reference violation must be reported",
);
assert(
  contaminatedReport.issues.some((item) => item.code === "asset_rejected_status_violation"),
  "rejected promotion violation must be reported",
);
assert(
  contaminatedReport.issues.some((item) => item.code === "asset_forbidden_future_reference"),
  "contact sheet future reference must be reported",
);

const badScenePack = clone(library.sceneAssetPacks[0]);
badScenePack.derivedViews[0].inheritsFromMaster = false;
badScenePack.derivedViews[0].masterSceneId = "other_master";
badScenePack.derivedViews[0].cameraVector = { x: 0, y: 0, z: 0 };
badScenePack.derivedViews[0].derivationEvidence = [];
badScenePack.derivedViews[0].viewImageRefs = [];
const badSceneIssues = validateSceneAssetPackHardContracts(badScenePack);
assert(
  badSceneIssues.some((item) => item.code === "scene_pack_inheritance_violation"),
  "bad derived-view inheritance must be reported",
);
assert(
  badSceneIssues.some((item) => item.code === "scene_pack_vector_violation"),
  "bad derived-view camera vector must be reported",
);

const badLayoutIssues = validateShotLayoutHardContracts(
  shotLayout({
    schemaVersion: undefined,
    endFrameDerivation: {
      derivesFrom: "independent_generation",
      derivationMode: "same_camera_state_change",
      allowedChanges: [],
      forbiddenChanges: [],
    },
    cameraPlacement: {
      worldPosition: { x: 0, y: 0, z: 0 },
      cameraVector: { x: 0, y: 0, z: 0 },
      height: "eye_level",
      framing: "medium",
    },
    cameraConstraints: {
      fixedCamera: true,
      movementAllowed: "dolly_or_truck_allowed",
      allowedMovements: ["dolly"],
      forbiddenMovements: [],
    },
  }),
);
assert(badLayoutIssues.some((item) => item.code === "shot_layout_schema_missing"), "missing schema must block shot layout");
assert(
  badLayoutIssues.some((item) => item.code === "shot_layout_end_frame_derivation_violation"),
  "independent end-frame layout must block",
);
assert(
  badLayoutIssues.some((item) => item.code === "shot_layout_camera_constraint_violation"),
  "fixed camera with dolly/truck movement must block",
);

const badDerivationIssues = validateStartEndDerivationHardContracts({
  keyframePairs: [
    keyframePair({ endDerivationSource: "unknown", validForI2vPair: true }),
    keyframePair({ shotId: "S03", endDerivationSource: "independent_exception", exceptionReason: "" }),
  ],
  promptPlans: [endPromptPlan({ derivesFromStartFrame: false })],
});
assert(
  badDerivationIssues.filter((item) => item.code === "keyframe_pair_derivation_violation").length >= 2,
  "unknown and unapproved independent keyframe derivations must block",
);
assert(
  badDerivationIssues.some((item) => item.code === "prompt_end_frame_derivation_violation"),
  "end-frame prompt not derived from start frame must block",
);

const postprocessIssues = validatePostprocessHardContracts([
  {
    policyId: "opencv_bad",
    allowedLocalOperations: ["resize", "opencv_face_repair"],
    semanticRepairAllowed: true,
    openCvSemanticRepairAllowed: true,
    localPostprocessCanChangeMeaning: true,
    localPostprocessCanPromoteFormal: true,
    forbiddenActions: [],
  },
]);
assert(
  postprocessIssues.some((item) => item.code === "postprocess_semantic_repair_violation" && item.severity === "blocker"),
  "OpenCV/local semantic repair must block",
);

console.log(
  `Visual consistency tests passed: ${cleanReport.summary.assetCount} assets, ${cleanReport.summary.scenePackCount} scene pack, ${contaminatedReport.summary.blockerCount} blocked contaminated issue(s).`,
);
