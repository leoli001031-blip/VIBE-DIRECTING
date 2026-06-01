import { addAssetLibraryAsset, addSceneDerivedViewPlaceholder, createAssetLibrarySnapshot } from "../src/core/assetLibraryCrud.ts";
import { validateAssetLibraryHardContracts, validateMotionEndpointHardContracts, validatePostprocessHardContracts, validateSceneAssetPackHardContracts, validateShotLayoutHardContracts, validateSpatialMemoryHardContracts, validateStartEndDerivationHardContracts, validateVisualConsistency } from "../src/core/visualConsistency.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

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

function spatialMemory(overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    id: "spatial_memory_fixture",
    coordinatePolicy: {
      worldPositionRequired: true,
      cameraVectorRequired: true,
      textOnlyMultiViewAllowed: false,
    },
    visualConsistencyPolicy: {
      masterSceneInheritanceRequired: true,
      cameraWorldPositionRequired: true,
      subjectWorldPositionRequired: true,
      axisContinuityRequired: true,
      sceneStateFactsRequired: true,
      missingSpatialMemoryBlocksFormal: true,
    },
    scenes: [
      {
        id: "garage_scene_locked",
        name: "Garage",
        status: "locked",
        worldAnchors: [{ id: "workbench", label: "Workbench", worldPosition: { x: 0, y: 0, z: 1 } }],
        cameraVectors: [
          {
            id: "garage_camera_A",
            worldPosition: { x: 0, y: 1.5, z: -3 },
            cameraVector: { x: 0, y: -0.1, z: 1 },
            usableForShotIds: ["S02"],
          },
        ],
        subjectBlocking: [
          {
            subjectId: "hero_locked",
            worldPosition: { x: 0, y: 0, z: 1 },
            blockingNote: "Hero stays at the workbench.",
          },
        ],
        axisRules: [
          {
            id: "garage_axis",
            axisVector: { x: 1, y: 0, z: 0 },
            screenDirectionRule: "static screen direction for S02",
          },
        ],
        revealStates: [{ targetId: "garage_door", state: "revealed" }],
        derivedViewRefs: ["garage_reverse_locked"],
      },
    ],
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
    allowedDelta: ["micro-expression", "small hand motion"],
    mustPreserve: ["character identity", "scene layout"],
    mustNotAdd: ["new character", "new location"],
    ...overrides,
  };
}

function motionEndpointContract(overrides = {}) {
  const pair = overrides.keyframePairDerivation || keyframePair({ shotId: overrides.shotId || "S02" });
  return {
    schemaVersion: "0.1.0",
    generatedAt,
    shotId: pair.shotId,
    motionType: "micro_expression",
    whetherEndFrameRequired: false,
    endFrameRequiredReason: "Micro-expression can be carried by motion prompt.",
    startPoseRequirement: {
      required: true,
      description: "Preserve the approved start pose.",
      mustPreserve: ["identity", "scene layout"],
      reservedForEndPose: false,
    },
    endPoseRequirement: {
      required: false,
      description: "End pose is optional for micro-expression.",
      mustPreserve: ["identity", "scene layout"],
      reservedForEndPose: false,
    },
    bodyMechanics: {
      required: false,
      description: "Body mechanics are not required for micro-expression.",
      centerOfMass: "not_required",
      footwork: [],
      contactPoints: [],
      timing: "not_required",
    },
    editableRegions: [
      {
        id: "subject_motion_region",
        label: "Subject motion region",
        kind: "face",
        frameRole: "both",
        description: "Face and breathing surface may animate subtly.",
        constraints: ["keep identity locked"],
      },
    ],
    protectedRegions: [
      {
        id: "identity_lock_region",
        label: "Identity lock",
        kind: "subject",
        frameRole: "both",
        description: "Character identity is protected.",
        constraints: ["no face swap"],
      },
      {
        id: "scene_layout_lock_region",
        label: "Scene layout lock",
        kind: "background",
        frameRole: "both",
        description: "Background layout is protected.",
        constraints: ["no scene replacement"],
      },
    ],
    bboxAnchors: [
      {
        id: "subject_bbox_anchor",
        target: "primary_subject",
        frameRole: "both",
        notes: ["BBox anchors are QA inputs only."],
      },
    ],
    qaThresholds: {
      identityPreservation: "strict",
      scenePreservation: "strict",
      maxUnexplainedBboxShift: "small",
      requireDerivedEndFrame: false,
      requireBodyMechanicsEvidence: false,
    },
    gateInputs: {
      shotText: "Hero blinks subtly.",
      motionEvidence: ["keyframe_derivation_language"],
      keyframePairPresent: true,
      keyframePairDerivesFromStart: true,
      bboxOnlyMotionForbidden: true,
    },
    keyframePairDerivation: pair,
    status: "pass",
    blockers: [],
    warnings: [],
    ...overrides,
  };
}

const library = addRequiredAssets();
const cleanPair = keyframePair();
const cleanMotionContract = motionEndpointContract({ keyframePairDerivation: cleanPair });
const cleanMotionContractIssues = validateMotionEndpointHardContracts({
  motionEndpointContracts: [cleanMotionContract],
  keyframePairs: [cleanPair],
  shotLayouts: [shotLayout()],
});
assert(
  cleanMotionContractIssues.length === 0,
  `clean motion endpoint contract should pass: ${cleanMotionContractIssues.map((item) => item.detail).join("; ")}`,
);

const cleanReport = validateVisualConsistency({
  checkedAt: generatedAt,
  assetLibrary: library,
  shotLayouts: [shotLayout()],
  spatialMemory: spatialMemory(),
  startEndDerivations: {
    keyframePairs: [cleanPair],
    promptPlans: [endPromptPlan()],
  },
  motionEndpointContracts: [cleanMotionContract],
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
assert(cleanReport.hardLocks.sameShotIndependentEndFrameForbidden === true, "same-shot independent end-frame hard lock missing");
assert(cleanReport.hardLocks.identityScenePairStoryGatesRequired === true, "identity/scene/pair/story gate hard lock missing");
assert(cleanReport.hardLocks.propStyleMotionChecksRequired === true, "prop/style/motion hard lock missing");
assert(cleanReport.hardLocks.spatialMemoryRequiredForFormal === true, "spatial-memory formal hard lock missing");
assert(cleanReport.hardLocks.masterInheritanceQaGateRequired === true, "master inheritance QA hard lock missing");
assert(cleanReport.hardLocks.workerProviderSelfReportCannotOverrideQa === true, "worker/provider self-report override hard lock missing");
assert(cleanReport.summary.lockedAssets === 2, "clean fixture should include two locked assets");
assert(cleanReport.summary.candidateAssets === 1, "clean fixture should include one candidate asset");
assert(cleanReport.summary.rejectedAssets === 1, "clean fixture should include one rejected asset");
assert(cleanReport.summary.gateCount === 11, "clean fixture should compile eleven visual consistency gates");
assert(cleanReport.summary.contractGateCount === 6, "clean fixture should compile the six Phase 37 contract gates");
assert(cleanReport.contractReceipt.receiptKind === "visual_consistency_contract", "contract receipt kind drifted");
assert(cleanReport.contractReceipt.phase === "phase37_visual_consistency_contract", "contract receipt phase drifted");
assert(cleanReport.contractReceipt.status === "pass", "clean contract receipt should pass");
assert(cleanReport.contractReceipt.formalPlanningAllowed === true, "clean contract receipt should allow formal planning");
assert(cleanReport.contractReceipt.qaGateSummary.workerProviderSelfReportMayOverride === false, "worker/provider self-report cannot override QA");
assert(cleanReport.contractReceipt.qaGateSummary.scenePackIds.includes("scene_asset_pack_garage_scene_locked"), "QA summary must include scene pack");
assert(cleanReport.contractReceipt.qaGateSummary.derivedViewIds.includes("garage_reverse_locked"), "QA summary must include derived views");
assert(cleanReport.contractReceipt.qaGateSummary.shotLayoutIds.includes("shot_layout_S02"), "QA summary must include Shot Layout");
assert(cleanReport.contractReceipt.qaGateSummary.keyframePairShotIds.includes("S02"), "QA summary must include keyframe pair");
assert(cleanReport.factChain.sequence.join(" > ") === "character_identity > scene_space > shot_layout > start_end_keyframes > video_handoff", "visual fact chain sequence drifted");
assert(cleanReport.factChain.steps.every((step) => step.status === "pass"), `clean fact chain should pass: ${cleanReport.factChain.blockers.join("; ")}`);
for (const gateId of ["identity_gate", "scene_gate", "layout_gate", "spatial_memory_gate", "pair_gate", "master_inheritance_qa_gate", "story_gate", "prop_gate", "style_gate", "motion_gate", "video_handoff_gate"]) {
  const gate = cleanReport.gates.find((candidate) => candidate.gateId === gateId);
  assert(gate, `missing visual consistency gate ${gateId}`);
  assert(gate.status === "pass", `${gateId} should pass: ${gate.blockers.join("; ")}`);
}

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
    subjectPlacement: {
      worldPosition: { x: 0, y: 0, z: 1 },
      framePlacement: "",
      blockingIntent: "",
    },
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
  badLayoutIssues.some((item) => item.code === "shot_layout_structured_field_missing"),
  "missing structured shot layout fields must block",
);
assert(
  badLayoutIssues.some((item) => item.code === "shot_layout_camera_constraint_violation"),
  "fixed camera with dolly/truck movement must block",
);
assert(
  badLayoutIssues.some((item) => item.code === "motion_gate_violation"),
  "fixed camera layout must explicitly forbid large motion",
);

const badSpatialIssues = validateSpatialMemoryHardContracts(
  spatialMemory({
    scenes: [
      {
        id: "garage_scene_locked",
        name: "Garage",
        status: "locked",
        worldAnchors: [],
        cameraVectors: [],
        subjectBlocking: [],
        axisRules: [],
        revealStates: [],
        derivedViewRefs: [],
      },
    ],
  }),
);
assert(
  badSpatialIssues.filter((item) => item.code === "spatial_memory_contract_violation").length >= 3,
  "missing Spatial Memory world/axis/scene-state facts must block",
);

const badDerivationIssues = validateStartEndDerivationHardContracts({
  keyframePairs: [
    keyframePair({ endDerivationSource: "unknown", validForI2vPair: true }),
    keyframePair({ shotId: "S03", endDerivationSource: "independent_exception", exceptionReason: "" }),
    keyframePair({ shotId: "S04", allowedDelta: ["large camera movement"] }),
  ],
  promptPlans: [endPromptPlan({ derivesFromStartFrame: false })],
});
assert(
  badDerivationIssues.filter((item) => item.code === "keyframe_pair_derivation_violation").length >= 3,
  "unknown, independent, and large-motion keyframe derivations must block",
);
assert(
  badDerivationIssues.some((item) => item.code === "prompt_end_frame_derivation_violation"),
  "end-frame prompt not derived from start frame must block",
);

const missingMotionContractIssues = validateMotionEndpointHardContracts({
  keyframePairs: [keyframePair()],
  shotLayouts: [shotLayout()],
});
assert(
  missingMotionContractIssues.some((item) => item.detail.includes("no MotionEndpointContract")),
  "keyframe pair without motion endpoint contract must block",
);
const missingMotionContractReport = validateVisualConsistency({
  checkedAt: generatedAt,
  assetLibrary: library,
  shotLayouts: [shotLayout()],
  spatialMemory: spatialMemory(),
  startEndDerivations: {
    keyframePairs: [keyframePair()],
    promptPlans: [endPromptPlan()],
  },
  postprocessPolicies: [
    {
      policyId: "local_postprocess_safe_missing_motion",
      allowedLocalOperations: ["resize", "format_convert", "thumbnail_preview", "metadata_probe", "manifest_match"],
      semanticRepairAllowed: false,
      openCvSemanticRepairAllowed: false,
      localPostprocessCanChangeMeaning: false,
      localPostprocessCanPromoteFormal: false,
      forbiddenActions: ["semantic_postprocess_repair"],
    },
  ],
});
assert(
  missingMotionContractReport.gates.find((candidate) => candidate.gateId === "motion_gate").status === "blocked",
  "visual consistency motion gate must block missing motion endpoint contract",
);

const bboxOnlyLocomotionIssues = validateMotionEndpointHardContracts({
  motionEndpointContracts: [
    motionEndpointContract({
      motionType: "locomotion",
      whetherEndFrameRequired: true,
      bodyMechanics: {
        required: true,
        description: "Body mechanics are required for locomotion.",
        centerOfMass: "missing",
        footwork: [],
        contactPoints: [],
        timing: "must be coherent",
      },
      gateInputs: {
        shotText: "Subject walks by bbox translation only.",
        motionEvidence: ["bbox_or_translation_language"],
        keyframePairPresent: true,
        keyframePairDerivesFromStart: true,
        bboxOnlyMotionForbidden: true,
      },
      status: "blocked",
      blockers: ["Locomotion cannot be represented only by bbox translation."],
    }),
  ],
  keyframePairs: [keyframePair()],
  shotLayouts: [shotLayout()],
});
assert(
  bboxOnlyLocomotionIssues.some((item) => item.detail.includes("only motion evidence")),
  "bbox-only locomotion evidence must block",
);

const missingLocomotionContactIssues = validateMotionEndpointHardContracts({
  motionEndpointContracts: [
    motionEndpointContract({
      motionType: "locomotion",
      whetherEndFrameRequired: true,
      bodyMechanics: {
        required: true,
        description: "Locomotion needs footwork, center of mass, and contact points.",
        centerOfMass: "specified",
        footwork: ["left foot steps before weight transfer"],
        contactPoints: [],
        timing: "must be coherent",
      },
      gateInputs: {
        shotText: "Subject walks with steps and center-of-mass transfer but no explicit foot-ground contact point.",
        motionEvidence: ["body_mechanics_language"],
        keyframePairPresent: true,
        keyframePairDerivesFromStart: true,
        bboxOnlyMotionForbidden: true,
      },
    }),
  ],
  keyframePairs: [keyframePair()],
  shotLayouts: [shotLayout()],
});
assert(
  missingLocomotionContactIssues.some((item) => item.detail.includes("contactPoints")),
  "locomotion missing explicit contact points must block",
);

const pairMismatchIssues = validateMotionEndpointHardContracts({
  motionEndpointContracts: [
    motionEndpointContract({
      keyframePairDerivation: keyframePair({ endFrameId: "outputs/keyframes/S02_wrong_end.png" }),
    }),
  ],
  keyframePairs: [keyframePair()],
  shotLayouts: [shotLayout()],
});
assert(
  pairMismatchIssues.some((item) => item.detail.includes("endFrameId")),
  "motion endpoint contract/keyframe pair mismatch must block",
);

const missingBodyMechanicsIssues = validateMotionEndpointHardContracts({
  motionEndpointContracts: [
    motionEndpointContract({
      motionType: "pose_change_in_place",
      bodyMechanics: {
        required: true,
        description: "Pose change needs physical continuity.",
        centerOfMass: "missing",
        footwork: [],
        contactPoints: [],
        timing: "must be coherent",
      },
      gateInputs: {
        shotText: "Subject shifts pose in place.",
        motionEvidence: ["body_mechanics_language"],
        keyframePairPresent: true,
        keyframePairDerivesFromStart: true,
        bboxOnlyMotionForbidden: true,
      },
    }),
  ],
  keyframePairs: [keyframePair()],
  shotLayouts: [shotLayout()],
});
assert(
  missingBodyMechanicsIssues.some((item) => item.detail.includes("centerOfMass") && item.detail.includes("contactPoints")),
  "required body mechanics missing center of mass, footwork, or contact points must block",
);

const badMotionReport = validateVisualConsistency({
  checkedAt: generatedAt,
  assetLibrary: library,
  shotLayouts: [shotLayout()],
  spatialMemory: spatialMemory(),
  startEndDerivations: {
    keyframePairs: [keyframePair({ allowedDelta: ["large camera movement"] })],
    promptPlans: [endPromptPlan()],
  },
  motionEndpointContracts: [motionEndpointContract({ keyframePairDerivation: keyframePair({ allowedDelta: ["large camera movement"] }) })],
});
assert(
  badMotionReport.issues.some((item) => item.code === "motion_gate_violation" && item.severity === "blocker"),
  "fixed camera keyframe pair must block large camera motion deltas",
);
assert(
  badMotionReport.gates.find((candidate) => candidate.gateId === "motion_gate").status === "blocked",
  "motion gate must block fixed-camera keyframe pair motion drift",
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
