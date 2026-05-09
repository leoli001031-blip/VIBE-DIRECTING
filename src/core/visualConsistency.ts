import type {
  AssetLibraryAsset,
  AssetLibrarySceneAssetPack,
  AssetLibrarySnapshot,
  Vector3,
} from "./assetLibraryCrud";
import type {
  GenerationHarnessState,
  KeyframePairDerivation,
  MotionEndpointContract,
  ShotPromptPlan,
} from "./types";

export const visualConsistencySchemaVersion = "0.1.0";

export type VisualConsistencyLayer =
  | "asset_library"
  | "scene_asset_pack"
  | "shot_layout"
  | "spatial_memory"
  | "start_end_derivation"
  | "fact_chain"
  | "master_inheritance_qa"
  | "postprocess";

export type VisualConsistencyIssueCode =
  | "asset_library_policy_violation"
  | "asset_status_future_reference_violation"
  | "asset_rejected_status_violation"
  | "asset_forbidden_future_reference"
  | "scene_pack_status_violation"
  | "scene_pack_inheritance_violation"
  | "scene_pack_vector_violation"
  | "scene_pack_forbidden_reference"
  | "shot_layout_schema_missing"
  | "shot_layout_structured_field_missing"
  | "shot_layout_vector_violation"
  | "shot_layout_end_frame_derivation_violation"
  | "shot_layout_camera_constraint_violation"
  | "spatial_memory_contract_violation"
  | "keyframe_pair_derivation_violation"
  | "prompt_end_frame_derivation_violation"
  | "master_inheritance_qa_violation"
  | "visual_fact_chain_violation"
  | "identity_gate_violation"
  | "scene_gate_violation"
  | "pair_gate_violation"
  | "story_gate_violation"
  | "prop_gate_violation"
  | "style_gate_violation"
  | "motion_gate_violation"
  | "postprocess_semantic_repair_violation";

export type VisualConsistencyGateId =
  | "identity_gate"
  | "scene_gate"
  | "layout_gate"
  | "spatial_memory_gate"
  | "pair_gate"
  | "master_inheritance_qa_gate"
  | "story_gate"
  | "prop_gate"
  | "style_gate"
  | "motion_gate"
  | "video_handoff_gate";

export type VisualConsistencyContractGateId =
  | "identity_gate"
  | "scene_gate"
  | "shot_layout_gate"
  | "spatial_memory_gate"
  | "keyframe_pair_derivation_gate"
  | "master_inheritance_qa_gate";

export interface VisualConsistencyGate {
  gateId: VisualConsistencyGateId;
  status: "pass" | "warning" | "blocked";
  layer: VisualConsistencyLayer;
  target: string;
  detail: string;
  blockers: string[];
  warnings: string[];
  sourceRefs: string[];
}

export interface VisualConsistencyContractGate {
  contractGateId: VisualConsistencyContractGateId;
  status: "pass" | "warning" | "blocked";
  formalEligible: boolean;
  detail: string;
  blockers: string[];
  warnings: string[];
  sourceRefs: string[];
}

export interface VisualConsistencyContractReceipt {
  receiptKind: "visual_consistency_contract";
  phase: "phase37_visual_consistency_contract";
  status: "pass" | "blocked";
  formalPlanningAllowed: boolean;
  gates: {
    identityGate: VisualConsistencyContractGate;
    sceneGate: VisualConsistencyContractGate;
    shotLayoutGate: VisualConsistencyContractGate;
    spatialMemoryGate: VisualConsistencyContractGate;
    keyframePairDerivationGate: VisualConsistencyContractGate;
    masterInheritanceQaGate: VisualConsistencyContractGate;
  };
  qaGateSummary: {
    scenePackIds: string[];
    derivedViewIds: string[];
    shotLayoutIds: string[];
    keyframePairShotIds: string[];
    workerProviderSelfReportMayOverride: false;
    blockers: string[];
    warnings: string[];
    sourceRefs: string[];
  };
  hardLocks: {
    identityRequiresLockedCharacterReference: true;
    candidateTempRejectedContactSheetShotOutputCannotBeFutureReference: true;
    derivedViewsMustInheritMasterScene: true;
    shotLayoutStructuredFieldsRequired: true;
    spatialMemoryRequiredForFormal: true;
    keyframeEndFrameMustDeriveFromApprovedStartFrame: true;
    independentEndFrameLargeMotionFixedCameraConflictBlocked: true;
    masterInheritanceQaGateRequired: true;
    workerProviderSelfReportCannotOverrideQa: true;
    localOpenCvPostprocessSemanticRepairForbidden: true;
  };
}

export interface VisualConsistencyFactChainStep {
  stepId:
    | "character_identity"
    | "scene_space"
    | "shot_layout"
    | "start_end_keyframes"
    | "video_handoff";
  gateIds: VisualConsistencyGateId[];
  status: "pass" | "warning" | "blocked";
  detail: string;
  sourceRefs: string[];
}

export interface VisualConsistencyIssue {
  code: VisualConsistencyIssueCode;
  layer: VisualConsistencyLayer;
  severity: "blocker" | "warning";
  target: string;
  detail: string;
  sourceRefs: string[];
}

export interface VisualConsistencyReport {
  schemaVersion: string;
  checkedAt: string;
  status: "pass" | "blocked";
  issues: VisualConsistencyIssue[];
  blockers: string[];
  warnings: string[];
  summary: {
    assetCount: number;
    scenePackCount: number;
    shotLayoutCount: number;
    keyframePairCount: number;
    promptPlanCount: number;
    generationHarnessCount: number;
    blockerCount: number;
    warningCount: number;
    lockedAssets: number;
    candidateAssets: number;
    rejectedAssets: number;
    forbiddenFutureReferences: number;
    semanticPostprocessViolations: number;
    gateCount: number;
    gateBlockers: number;
    gateWarnings: number;
    contractGateCount: number;
    contractGateBlockers: number;
    contractGateWarnings: number;
  };
  factChain: {
    sequence: [
      "character_identity",
      "scene_space",
      "shot_layout",
      "start_end_keyframes",
      "video_handoff",
    ];
    steps: VisualConsistencyFactChainStep[];
    blockers: string[];
    warnings: string[];
  };
  gates: VisualConsistencyGate[];
  contractReceipt: VisualConsistencyContractReceipt;
  hardLocks: {
    assetLibraryIsNotGallery: true;
    tempOutputCannotBecomeFutureReference: true;
    candidateCannotBecomeFutureReference: true;
    rejectedCannotBecomeFutureReference: true;
    derivedViewsMustInheritMasterScene: true;
    derivedViewsRequireCameraVectorAndWorldPosition: true;
    endFrameDefaultsToStartFrameDerivation: true;
    sameShotIndependentEndFrameForbidden: true;
    identityScenePairStoryGatesRequired: true;
    propStyleMotionChecksRequired: true;
    shotLayoutStructuredFieldsRequired: true;
    spatialMemoryRequiredForFormal: true;
    masterInheritanceQaGateRequired: true;
    workerProviderSelfReportCannotOverrideQa: true;
    localPostprocessSemanticRepairForbidden: true;
  };
}

export interface ShotLayoutFrameState {
  description?: string;
  subjectPlacementId?: string;
  cameraPlacementId?: string;
}

export interface ShotLayoutContract {
  schemaVersion?: string;
  id: string;
  shotId: string;
  sceneId: string;
  subjectPlacement: {
    subjectId?: string;
    worldPosition?: Vector3;
    framePlacement?: string;
    blockingIntent?: string;
  };
  cameraPlacement: {
    worldPosition?: Vector3;
    cameraVector?: Vector3;
    height?: string;
    framing?: string;
  };
  axisAndDirection: {
    axisId?: string;
    screenDirection?: string;
    worldDirection?: Vector3;
    crossesAxis?: boolean;
  };
  startFrame: ShotLayoutFrameState;
  endFrameDerivation: {
    derivesFrom?: string;
    derivationMode?: string;
    allowedChanges?: string[];
    forbiddenChanges?: string[];
  };
  cameraConstraints: {
    fixedCamera?: boolean;
    movementAllowed?: string;
    allowedMovements?: string[];
    forbiddenMovements?: string[];
  };
  spatialAnchors: string[];
  updatedAt?: string;
}

export interface SpatialMemoryContract {
  schemaVersion?: string;
  id?: string;
  coordinatePolicy?: {
    worldPositionRequired?: boolean;
    cameraVectorRequired?: boolean;
    textOnlyMultiViewAllowed?: boolean;
  };
  visualConsistencyPolicy?: {
    masterSceneInheritanceRequired?: boolean;
    cameraWorldPositionRequired?: boolean;
    subjectWorldPositionRequired?: boolean;
    axisContinuityRequired?: boolean;
  };
  scenes?: Array<{
    id?: string;
    name?: string;
    status?: string;
    worldAnchors?: Array<{ id?: string; label?: string; worldPosition?: Vector3 }>;
    cameraVectors?: Array<{ id?: string; worldPosition?: Vector3; cameraVector?: Vector3 }>;
    subjectBlocking?: Array<{ subjectId?: string; worldPosition?: Vector3; blockingNote?: string }>;
    axisRules?: Array<{ id?: string; axisVector?: Vector3; screenDirectionRule?: string }>;
    revealStates?: Array<{ targetId?: string; state?: string }>;
    derivedViewRefs?: string[];
  }>;
  anchors?: Array<{ id?: string; label?: string; worldPosition?: Vector3 }>;
  worldPositions?: Array<{ id?: string; worldPosition?: Vector3 }>;
  cameraVectors?: Array<{ id?: string; worldPosition?: Vector3; cameraVector?: Vector3 }>;
  axisRules?: Array<{ id?: string; axisVector?: Vector3; screenDirectionRule?: string }>;
  sceneStates?: Array<{ targetId?: string; state?: string }>;
  updatedAt?: string;
}

export interface VisualConsistencyPostprocessPolicy {
  policyId?: string;
  allowedLocalOperations?: string[];
  semanticRepairAllowed?: boolean;
  openCvSemanticRepairAllowed?: boolean;
  localPostprocessCanChangeMeaning?: boolean;
  localPostprocessCanPromoteFormal?: boolean;
  forbiddenActions?: string[];
}

export interface ValidateStartEndDerivationInput {
  keyframePairs?: KeyframePairDerivation[];
  promptPlans?: ShotPromptPlan[];
  allowIndependentExceptions?: boolean;
}

export interface ValidateMotionEndpointHardContractsInput {
  motionEndpointContracts?: MotionEndpointContract[];
  keyframePairs?: KeyframePairDerivation[];
  shotLayouts?: ShotLayoutContract[];
}

export interface ValidateVisualConsistencyInput {
  checkedAt?: string;
  assetLibrary?: AssetLibrarySnapshot;
  sceneAssetPacks?: AssetLibrarySceneAssetPack[];
  shotLayouts?: ShotLayoutContract[];
  spatialMemory?: SpatialMemoryContract;
  startEndDerivations?: ValidateStartEndDerivationInput;
  motionEndpointContracts?: MotionEndpointContract[];
  postprocessPolicies?: VisualConsistencyPostprocessPolicy[];
  generationHarnesses?: GenerationHarnessState[];
}

const forbiddenPathPattern =
  /(^|\/)(tmp|temp|cache|candidates?|drafts?|failed|failures?|contact[-_ ]?sheets?|shot[-_ ]?outputs?|outputs\/shots)(\/|$)/i;
const contactSheetPattern = /contact[-_ ]?sheet/i;
const semanticRepairPattern =
  /\b(semantic|identity|face|outfit|costume|scene|layout|style|story|camera|prop|motion|meaning|opencv[_-]?(?:repair|fix|semantic|face))\b/i;
const largeCameraMovementPattern =
  /\b(camera\s+movement|push(?:\s|-)?in|pull(?:\s|-)?back|dolly|truck|crane|orbit|whip\s*pan|zoom|large\s+camera\s+move|dramatic\s+camera|sweeping)\b/i;
const allowedLocalPostprocessOperations = new Set([
  "resize",
  "format_convert",
  "thumbnail_preview",
  "metadata_probe",
  "manifest_match",
  "dimension_probe",
  "hash_probe",
  "colorspace_convert",
  "nonsemantic_crop",
  "letterbox",
  "light_texture_soften",
  "mild_denoise",
]);

const factChainSequence: VisualConsistencyReport["factChain"]["sequence"] = [
  "character_identity",
  "scene_space",
  "shot_layout",
  "start_end_keyframes",
  "video_handoff",
];

const hardLocks: VisualConsistencyReport["hardLocks"] = {
  assetLibraryIsNotGallery: true,
  tempOutputCannotBecomeFutureReference: true,
  candidateCannotBecomeFutureReference: true,
  rejectedCannotBecomeFutureReference: true,
  derivedViewsMustInheritMasterScene: true,
  derivedViewsRequireCameraVectorAndWorldPosition: true,
  endFrameDefaultsToStartFrameDerivation: true,
  sameShotIndependentEndFrameForbidden: true,
  identityScenePairStoryGatesRequired: true,
  propStyleMotionChecksRequired: true,
  shotLayoutStructuredFieldsRequired: true,
  spatialMemoryRequiredForFormal: true,
  masterInheritanceQaGateRequired: true,
  workerProviderSelfReportCannotOverrideQa: true,
  localPostprocessSemanticRepairForbidden: true,
};

function issue(input: VisualConsistencyIssue): VisualConsistencyIssue {
  return input;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function gate(input: Omit<VisualConsistencyGate, "status" | "blockers" | "warnings" | "sourceRefs"> & {
  blockers?: string[];
  warnings?: string[];
  sourceRefs?: string[];
}): VisualConsistencyGate {
  const blockers = unique(input.blockers || []);
  const warnings = unique(input.warnings || []);
  return {
    gateId: input.gateId,
    status: blockers.length ? "blocked" : warnings.length ? "warning" : "pass",
    layer: input.layer,
    target: input.target,
    detail: input.detail,
    blockers,
    warnings,
    sourceRefs: unique(input.sourceRefs || []),
  };
}

function statusFromGates(gates: VisualConsistencyGate[]): VisualConsistencyGate["status"] {
  if (gates.some((item) => item.status === "blocked")) return "blocked";
  if (gates.some((item) => item.status === "warning")) return "warning";
  return "pass";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isVector3(value: unknown): value is Vector3 {
  const vector = value as Vector3 | undefined;
  return Boolean(vector && isFiniteNumber(vector.x) && isFiniteNumber(vector.y) && isFiniteNumber(vector.z));
}

function isNonZeroVector(value: unknown): value is Vector3 {
  return isVector3(value) && Math.sqrt(value.x * value.x + value.y * value.y + value.z * value.z) > 0;
}

function pathLooksForbidden(path: string | undefined): boolean {
  if (!path) return false;
  const normalized = path.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
  return forbiddenPathPattern.test(normalized) || contactSheetPattern.test(normalized);
}

function assetPaths(asset: AssetLibraryAsset): string[] {
  return unique([
    asset.sourcePath?.path || "",
    asset.mainReferencePath || "",
    asset.referenceAuthority.path || "",
  ]);
}

function assetHasFutureUse(asset: AssetLibraryAsset): boolean {
  return Boolean(
    asset.canUseAsFutureReference ||
      asset.referenceAuthority.canUseAsFutureReference ||
      asset.referenceAuthority.allowedUse.includes("future_reference") ||
      asset.referenceAuthority.allowedUse.includes("formal_output"),
  );
}

function assetStatusIssues(asset: AssetLibraryAsset): VisualConsistencyIssue[] {
  const issues: VisualConsistencyIssue[] = [];
  const target = asset.id;

  if (asset.status === "locked") {
    if (asset.visualMemoryStatus !== "locked" || asset.referenceAuthority.lockedStatus !== "locked") {
      issues.push(
        issue({
          code: "asset_status_future_reference_violation",
          layer: "asset_library",
          severity: "blocker",
          target,
          detail: "Locked assets must map to locked Visual Memory and locked reference authority.",
          sourceRefs: asset.sourceRefs,
        }),
      );
    }
    if (!asset.canUseAsFutureReference || !asset.referenceAuthority.canUseAsFutureReference) {
      issues.push(
        issue({
          code: "asset_status_future_reference_violation",
          layer: "asset_library",
          severity: "blocker",
          target,
          detail: "Locked assets must be the only positive future-reference authority.",
          sourceRefs: asset.sourceRefs,
        }),
      );
    }
  }

  if (asset.status === "candidate" || asset.status === "review") {
    if (assetHasFutureUse(asset)) {
      issues.push(
        issue({
          code: "asset_status_future_reference_violation",
          layer: "asset_library",
          severity: "blocker",
          target,
          detail: "Candidate/review assets are draft-only and cannot become future references.",
          sourceRefs: asset.sourceRefs,
        }),
      );
    }
    if (asset.referenceAuthority.allowedUse.some((use) => use !== "draft_preview")) {
      issues.push(
        issue({
          code: "asset_status_future_reference_violation",
          layer: "asset_library",
          severity: "blocker",
          target,
          detail: "Candidate/review reference authority must be limited to draft_preview.",
          sourceRefs: asset.sourceRefs,
        }),
      );
    }
  }

  if (asset.status === "rejected") {
    if (asset.referenceAuthority.lockedStatus !== "rejected" || asset.referenceAuthority.polarity !== "negative") {
      issues.push(
        issue({
          code: "asset_rejected_status_violation",
          layer: "asset_library",
          severity: "blocker",
          target,
          detail: "Rejected assets must be negative/rejected authority.",
          sourceRefs: asset.sourceRefs,
        }),
      );
    }
    if (assetHasFutureUse(asset) || asset.canPromoteToFormal) {
      issues.push(
        issue({
          code: "asset_rejected_status_violation",
          layer: "asset_library",
          severity: "blocker",
          target,
          detail: "Rejected assets cannot promote or become future references.",
          sourceRefs: asset.sourceRefs,
        }),
      );
    }
  }

  if (asset.status === "missing" && (asset.formalLibraryIncluded || assetHasFutureUse(asset))) {
    issues.push(
      issue({
        code: "asset_status_future_reference_violation",
        layer: "asset_library",
        severity: "blocker",
        target,
        detail: "Missing assets cannot enter formal Visual Memory or future reference authority.",
        sourceRefs: asset.sourceRefs,
      }),
    );
  }

  if (asset.sourceKind === "provider_temp_output" && assetHasFutureUse(asset)) {
    issues.push(
      issue({
        code: "asset_forbidden_future_reference",
        layer: "asset_library",
        severity: "blocker",
        target,
        detail: "Provider temp outputs cannot become future references.",
        sourceRefs: asset.sourceRefs,
      }),
    );
  }

  for (const path of assetPaths(asset)) {
    if (pathLooksForbidden(path) && assetHasFutureUse(asset)) {
      issues.push(
        issue({
          code: "asset_forbidden_future_reference",
          layer: "asset_library",
          severity: "blocker",
          target,
          detail: `Forbidden temp/failed/contact-sheet/shot-output material cannot be a future reference: ${path}`,
          sourceRefs: asset.sourceRefs,
        }),
      );
    }
  }

  return issues;
}

export function validateAssetLibraryHardContracts(library: AssetLibrarySnapshot): VisualConsistencyIssue[] {
  const issues: VisualConsistencyIssue[] = [];

  if (library.libraryPurpose !== "asset_consistency_memory") {
    issues.push(
      issue({
        code: "asset_library_policy_violation",
        layer: "asset_library",
        severity: "blocker",
        target: library.id,
        detail: "Asset Library must remain asset_consistency_memory.",
        sourceRefs: [library.id],
      }),
    );
  }
  if (library.referenceAuthorityPolicy.assetLibraryIsGallery !== false) {
    issues.push(
      issue({
        code: "asset_library_policy_violation",
        layer: "asset_library",
        severity: "blocker",
        target: library.id,
        detail: "Asset Library cannot be treated as a gallery.",
        sourceRefs: [library.id],
      }),
    );
  }
  if (library.referenceAuthorityPolicy.tempOutputAutoPromote !== false) {
    issues.push(
      issue({
        code: "asset_library_policy_violation",
        layer: "asset_library",
        severity: "blocker",
        target: library.id,
        detail: "Temp output auto-promotion must be disabled.",
        sourceRefs: [library.id],
      }),
    );
  }
  if (library.referenceAuthorityPolicy.localPostprocessCanSemanticRepair !== false) {
    issues.push(
      issue({
        code: "postprocess_semantic_repair_violation",
        layer: "postprocess",
        severity: "blocker",
        target: library.id,
        detail: "Local/OpenCV postprocess cannot perform semantic repair.",
        sourceRefs: [library.id],
      }),
    );
  }
  if (library.hardLocks.assetLibraryIsNotGallery !== true || library.hardLocks.noTempOutputPromotion !== true) {
    issues.push(
      issue({
        code: "asset_library_policy_violation",
        layer: "asset_library",
        severity: "blocker",
        target: library.id,
        detail: "Asset Library hard locks must keep not-gallery and no-temp-promotion true.",
        sourceRefs: [library.id],
      }),
    );
  }

  for (const asset of library.assets) {
    issues.push(...assetStatusIssues(asset));
  }

  for (const pack of library.sceneAssetPacks) {
    issues.push(...validateSceneAssetPackHardContracts(pack));
  }

  return issues;
}

function expectedReadiness(status: AssetLibrarySceneAssetPack["status"]): AssetLibrarySceneAssetPack["readiness"] {
  if (status === "locked") return "ready_for_formal";
  if (status === "rejected") return "blocked";
  return "draft_only";
}

export function validateSceneAssetPackHardContracts(pack: AssetLibrarySceneAssetPack): VisualConsistencyIssue[] {
  const issues: VisualConsistencyIssue[] = [];
  const sourceRefs = [pack.id, pack.sceneId];

  if (!["locked", "candidate", "rejected"].includes(pack.status)) {
    issues.push(
      issue({
        code: "scene_pack_status_violation",
        layer: "scene_asset_pack",
        severity: "blocker",
        target: pack.id,
        detail: "Scene Asset Pack status must be locked, candidate, or rejected.",
        sourceRefs,
      }),
    );
  }
  if (pack.masterScene.status !== pack.status) {
    issues.push(
      issue({
        code: "scene_pack_status_violation",
        layer: "scene_asset_pack",
        severity: "blocker",
        target: pack.masterScene.id,
        detail: "Master scene status must match the Scene Asset Pack status.",
        sourceRefs,
      }),
    );
  }
  if (pack.readiness !== expectedReadiness(pack.status)) {
    issues.push(
      issue({
        code: "scene_pack_status_violation",
        layer: "scene_asset_pack",
        severity: "blocker",
        target: pack.id,
        detail: "Scene Asset Pack readiness must follow locked/candidate/rejected status.",
        sourceRefs,
      }),
    );
  }
  if (
    pack.inheritanceRules.masterInheritanceRequired !== true ||
    pack.inheritanceRules.textOnlyViewRecreationAllowed !== false ||
    pack.inheritanceRules.unknownDerivationCanLock !== false
  ) {
    issues.push(
      issue({
        code: "scene_pack_inheritance_violation",
        layer: "scene_asset_pack",
        severity: "blocker",
        target: pack.id,
        detail: "Scene Asset Pack must require master inheritance, forbid text-only view recreation, and forbid unknown derivation locks.",
        sourceRefs,
      }),
    );
  }

  for (const camera of pack.masterScene.cameraVectors) {
    if (!isVector3(camera.worldPosition) || !isNonZeroVector(camera.cameraVector)) {
      issues.push(
        issue({
          code: "scene_pack_vector_violation",
          layer: "scene_asset_pack",
          severity: "blocker",
          target: camera.id,
          detail: "Master scene camera vectors require finite worldPosition and non-zero cameraVector.",
          sourceRefs,
        }),
      );
    }
  }

  for (const anchor of pack.masterScene.worldAnchors) {
    if (!isVector3(anchor.worldPosition)) {
      issues.push(
        issue({
          code: "scene_pack_vector_violation",
          layer: "scene_asset_pack",
          severity: "blocker",
          target: anchor.id,
          detail: "World anchors require finite worldPosition.",
          sourceRefs,
        }),
      );
    }
  }

  for (const masterImageRef of pack.masterScene.masterImageRefs) {
    if (pathLooksForbidden(masterImageRef) && pack.status === "locked") {
      issues.push(
        issue({
          code: "scene_pack_forbidden_reference",
          layer: "scene_asset_pack",
          severity: "blocker",
          target: pack.masterScene.id,
          detail: `Locked master scene cannot use temp/failed/contact-sheet/shot-output material: ${masterImageRef}`,
          sourceRefs,
        }),
      );
    }
  }

  for (const view of pack.derivedViews) {
    if (view.inheritsFromMaster !== true || view.masterSceneId !== pack.masterScene.id) {
      issues.push(
        issue({
          code: "scene_pack_inheritance_violation",
          layer: "scene_asset_pack",
          severity: "blocker",
          target: view.id,
          detail: "Derived views must inherit from the exact master scene id.",
          sourceRefs: [...sourceRefs, view.id],
        }),
      );
    }
    if (!view.derivationEvidence.length) {
      issues.push(
        issue({
          code: "scene_pack_inheritance_violation",
          layer: "scene_asset_pack",
          severity: "blocker",
          target: view.id,
          detail: "Derived views require explicit derivation evidence.",
          sourceRefs: [...sourceRefs, view.id],
        }),
      );
    }
    if (!isVector3(view.worldPosition) || !isNonZeroVector(view.cameraVector)) {
      issues.push(
        issue({
          code: "scene_pack_vector_violation",
          layer: "scene_asset_pack",
          severity: "blocker",
          target: view.id,
          detail: "Derived views require finite worldPosition and non-zero cameraVector.",
          sourceRefs: [...sourceRefs, view.id],
        }),
      );
    }
    if (view.status === "locked" && !view.viewImageRefs.length) {
      issues.push(
        issue({
          code: "scene_pack_inheritance_violation",
          layer: "scene_asset_pack",
          severity: "blocker",
          target: view.id,
          detail: "Locked derived views require at least one view image reference.",
          sourceRefs: [...sourceRefs, view.id],
        }),
      );
    }
    for (const imageRef of view.viewImageRefs) {
      if (pathLooksForbidden(imageRef) && view.status === "locked") {
        issues.push(
          issue({
            code: "scene_pack_forbidden_reference",
            layer: "scene_asset_pack",
            severity: "blocker",
            target: view.id,
            detail: `Locked derived view cannot use temp/failed/contact-sheet/shot-output material: ${imageRef}`,
            sourceRefs: [...sourceRefs, view.id],
          }),
        );
      }
    }
  }

  return issues;
}

export function validateShotLayoutHardContracts(layout: ShotLayoutContract): VisualConsistencyIssue[] {
  const issues: VisualConsistencyIssue[] = [];
  const sourceRefs = [layout.id, layout.shotId, layout.sceneId];

  if (!layout.schemaVersion) {
    issues.push(
      issue({
        code: "shot_layout_schema_missing",
        layer: "shot_layout",
        severity: "blocker",
        target: layout.id,
        detail: "Shot Layout must carry schemaVersion before it can enter formal planning.",
        sourceRefs,
      }),
    );
  }
  if (
    !layout.subjectPlacement.subjectId ||
    !layout.subjectPlacement.framePlacement ||
    !layout.subjectPlacement.blockingIntent ||
    !layout.cameraPlacement.height ||
    !layout.cameraPlacement.framing ||
    !layout.axisAndDirection.axisId ||
    !layout.axisAndDirection.screenDirection ||
    !layout.startFrame.subjectPlacementId ||
    !layout.startFrame.cameraPlacementId
  ) {
    issues.push(
      issue({
        code: "shot_layout_structured_field_missing",
        layer: "shot_layout",
        severity: "blocker",
        target: layout.id,
        detail: "Shot Layout must structure subject position, camera placement, axis/screen direction, and frame placement ids.",
        sourceRefs,
      }),
    );
  }
  if (!isVector3(layout.subjectPlacement.worldPosition)) {
    issues.push(
      issue({
        code: "shot_layout_vector_violation",
        layer: "shot_layout",
        severity: "blocker",
        target: `${layout.id}.subjectPlacement`,
        detail: "Shot Layout subject placement requires finite worldPosition.",
        sourceRefs,
      }),
    );
  }
  if (!isVector3(layout.cameraPlacement.worldPosition) || !isNonZeroVector(layout.cameraPlacement.cameraVector)) {
    issues.push(
      issue({
        code: "shot_layout_vector_violation",
        layer: "shot_layout",
        severity: "blocker",
        target: `${layout.id}.cameraPlacement`,
        detail: "Shot Layout camera placement requires finite worldPosition and non-zero cameraVector.",
        sourceRefs,
      }),
    );
  }
  if (!layout.spatialAnchors.length) {
    issues.push(
      issue({
        code: "shot_layout_vector_violation",
        layer: "shot_layout",
        severity: "blocker",
        target: `${layout.id}.spatialAnchors`,
        detail: "Shot Layout requires spatial anchors so camera/world positions stay bound to the scene.",
        sourceRefs,
      }),
    );
  }
  if (!isVector3(layout.axisAndDirection.worldDirection)) {
    issues.push(
      issue({
        code: "shot_layout_vector_violation",
        layer: "shot_layout",
        severity: "blocker",
        target: `${layout.id}.axisAndDirection`,
        detail: "Shot Layout axis/direction requires finite worldDirection.",
        sourceRefs,
      }),
    );
  }
  if (layout.endFrameDerivation.derivesFrom !== "start_frame") {
    issues.push(
      issue({
        code: "shot_layout_end_frame_derivation_violation",
        layer: "shot_layout",
        severity: "blocker",
        target: `${layout.id}.endFrameDerivation`,
        detail: "End frame must derive from the start frame by default.",
        sourceRefs,
      }),
    );
  }
  const allowedMotionText = [
    layout.cameraConstraints.movementAllowed,
    ...(layout.cameraConstraints.allowedMovements || []),
    ...(layout.endFrameDerivation.allowedChanges || []),
  ].join(" ");
  if (
    layout.cameraConstraints.fixedCamera &&
    (layout.cameraConstraints.movementAllowed === "dolly_or_truck_allowed" || largeCameraMovementPattern.test(allowedMotionText))
  ) {
    issues.push(
      issue({
        code: "shot_layout_camera_constraint_violation",
        layer: "shot_layout",
        severity: "blocker",
        target: `${layout.id}.cameraConstraints`,
        detail: "Fixed camera layouts cannot allow dolly/truck movement.",
        sourceRefs,
      }),
    );
  }
  if (
    layout.cameraConstraints.fixedCamera &&
    layout.cameraConstraints.forbiddenMovements &&
    !layout.cameraConstraints.forbiddenMovements.some((movement) => largeCameraMovementPattern.test(movement))
  ) {
    issues.push(
      issue({
        code: "motion_gate_violation",
        layer: "shot_layout",
        severity: "warning",
        target: `${layout.id}.cameraConstraints`,
        detail: "Fixed-camera layouts should explicitly forbid large camera movement in forbiddenMovements.",
        sourceRefs,
      }),
    );
  }

  return issues;
}

function spatialMemoryWorldPositionRefs(memory: SpatialMemoryContract | undefined): string[] {
  if (!memory) return [];
  return unique([
    ...(memory.worldPositions || []).filter((item) => isVector3(item.worldPosition)).map((item) => item.id || "world_position"),
    ...(memory.anchors || []).filter((item) => isVector3(item.worldPosition)).map((item) => item.id || "anchor"),
    ...(memory.cameraVectors || [])
      .filter((item) => isVector3(item.worldPosition) && isNonZeroVector(item.cameraVector))
      .map((item) => item.id || "camera_vector"),
    ...(memory.scenes || []).flatMap((scene) => [
      ...(scene.worldAnchors || []).filter((item) => isVector3(item.worldPosition)).map((item) => `${scene.id || "scene"}:${item.id || "anchor"}`),
      ...(scene.cameraVectors || [])
        .filter((item) => isVector3(item.worldPosition) && isNonZeroVector(item.cameraVector))
        .map((item) => `${scene.id || "scene"}:${item.id || "camera_vector"}`),
      ...(scene.subjectBlocking || [])
        .filter((item) => isVector3(item.worldPosition))
        .map((item) => `${scene.id || "scene"}:${item.subjectId || "subject"}`),
    ]),
  ]);
}

function spatialMemoryAxisRefs(memory: SpatialMemoryContract | undefined): string[] {
  if (!memory) return [];
  return unique([
    ...(memory.axisRules || []).filter((item) => isNonZeroVector(item.axisVector) && Boolean(item.screenDirectionRule)).map((item) => item.id || "axis"),
    ...(memory.scenes || []).flatMap((scene) =>
      (scene.axisRules || [])
        .filter((item) => isNonZeroVector(item.axisVector) && Boolean(item.screenDirectionRule))
        .map((item) => `${scene.id || "scene"}:${item.id || "axis"}`),
    ),
  ]);
}

function spatialMemorySceneStateRefs(memory: SpatialMemoryContract | undefined): string[] {
  if (!memory) return [];
  return unique([
    ...(memory.sceneStates || []).filter((item) => Boolean(item.targetId && item.state)).map((item) => item.targetId || "scene_state"),
    ...(memory.scenes || []).flatMap((scene) =>
      (scene.revealStates || [])
        .filter((item) => Boolean(item.targetId && item.state))
        .map((item) => `${scene.id || "scene"}:${item.targetId || "state"}`),
    ),
  ]);
}

export function validateSpatialMemoryHardContracts(memory: SpatialMemoryContract | undefined): VisualConsistencyIssue[] {
  const target = memory?.id || "spatial_memory";
  const sourceRefs = memory ? [target] : [];
  const issues: VisualConsistencyIssue[] = [];

  if (!memory) {
    return [
      issue({
        code: "spatial_memory_contract_violation",
        layer: "spatial_memory",
        severity: "blocker",
        target,
        detail: "Spatial Memory is required before visual planning can become formal.",
        sourceRefs,
      }),
    ];
  }

  if (
    memory.coordinatePolicy &&
    (memory.coordinatePolicy.worldPositionRequired !== true ||
      memory.coordinatePolicy.cameraVectorRequired !== true ||
      memory.coordinatePolicy.textOnlyMultiViewAllowed !== false)
  ) {
    issues.push(
      issue({
        code: "spatial_memory_contract_violation",
        layer: "spatial_memory",
        severity: "blocker",
        target,
        detail: "Spatial Memory coordinate policy must require world positions/camera vectors and forbid text-only multi-view recreation.",
        sourceRefs,
      }),
    );
  }
  if (
    memory.visualConsistencyPolicy &&
    (memory.visualConsistencyPolicy.masterSceneInheritanceRequired !== true ||
      memory.visualConsistencyPolicy.cameraWorldPositionRequired !== true ||
      memory.visualConsistencyPolicy.subjectWorldPositionRequired !== true ||
      memory.visualConsistencyPolicy.axisContinuityRequired !== true)
  ) {
    issues.push(
      issue({
        code: "spatial_memory_contract_violation",
        layer: "spatial_memory",
        severity: "blocker",
        target,
        detail: "Spatial Memory visual consistency policy must require master inheritance, camera/subject world positions, and axis continuity.",
        sourceRefs,
      }),
    );
  }
  if (!spatialMemoryWorldPositionRefs(memory).length) {
    issues.push(
      issue({
        code: "spatial_memory_contract_violation",
        layer: "spatial_memory",
        severity: "blocker",
        target,
        detail: "Spatial Memory must include finite world coordinate facts for anchors, cameras, or subjects.",
        sourceRefs,
      }),
    );
  }
  if (!spatialMemoryAxisRefs(memory).length) {
    issues.push(
      issue({
        code: "spatial_memory_contract_violation",
        layer: "spatial_memory",
        severity: "blocker",
        target,
        detail: "Spatial Memory must include structured axis/screen-direction facts.",
        sourceRefs,
      }),
    );
  }
  if (!spatialMemorySceneStateRefs(memory).length) {
    issues.push(
      issue({
        code: "spatial_memory_contract_violation",
        layer: "spatial_memory",
        severity: "blocker",
        target,
        detail: "Spatial Memory must include scene state facts before formal visual planning.",
        sourceRefs,
      }),
    );
  }

  return issues;
}

export function validateStartEndDerivationHardContracts(input: ValidateStartEndDerivationInput): VisualConsistencyIssue[] {
  const issues: VisualConsistencyIssue[] = [];
  const allowIndependentExceptions = input.allowIndependentExceptions === true;

  for (const pair of input.keyframePairs || []) {
    const sourceRefs = [pair.shotId, pair.startFrameId, pair.endFrameId];
    if (!pair.startFrameId || !pair.endFrameId) {
      issues.push(
        issue({
          code: "keyframe_pair_derivation_violation",
          layer: "start_end_derivation",
          severity: "blocker",
          target: pair.shotId,
          detail: "Keyframe pair derivation requires both startFrameId and endFrameId.",
          sourceRefs,
        }),
      );
    }
    if (pair.endDerivationSource === "unknown" || pair.validForI2vPair !== true) {
      issues.push(
        issue({
          code: "keyframe_pair_derivation_violation",
          layer: "start_end_derivation",
          severity: "blocker",
          target: pair.shotId,
          detail: "Unknown or invalid keyframe pair derivation cannot enter I2V/formal planning.",
          sourceRefs,
        }),
      );
    }
    if (pair.endDerivationSource === "independent_exception") {
      issues.push(
        issue({
          code: "keyframe_pair_derivation_violation",
          layer: "start_end_derivation",
          severity: "blocker",
          target: pair.shotId,
          detail: allowIndependentExceptions && pair.exceptionReason?.trim()
            ? "Independent end-frame exceptions are recorded for review but remain blocked from the formal Phase 37 contract."
            : "Independent end-frame generation is blocked; the same-shot end frame must derive from the approved start frame.",
          sourceRefs,
        }),
      );
    }
    if (pair.endDerivationSource === "start_frame" && !pair.mustPreserve.length) {
      issues.push(
        issue({
          code: "keyframe_pair_derivation_violation",
          layer: "start_end_derivation",
          severity: "blocker",
          target: pair.shotId,
          detail: "Start-frame derivation must state what is preserved.",
          sourceRefs,
        }),
      );
    }
    if (largeCameraMovementPattern.test([...pair.allowedDelta, ...pair.mustPreserve, ...pair.mustNotAdd].join(" "))) {
      issues.push(
        issue({
          code: "keyframe_pair_derivation_violation",
          layer: "start_end_derivation",
          severity: "blocker",
          target: pair.shotId,
          detail: "Large motion drift in keyframe pair deltas is blocked from the formal visual consistency contract.",
          sourceRefs,
        }),
      );
    }
  }

  for (const plan of input.promptPlans || []) {
    if (plan.promptKind === "end_frame" && plan.derivesFromStartFrame !== true) {
      issues.push(
        issue({
          code: "prompt_end_frame_derivation_violation",
          layer: "start_end_derivation",
          severity: "blocker",
          target: plan.promptPlanId,
          detail: "End-frame prompt plans must derive from the start frame by default.",
          sourceRefs: [plan.promptPlanId, plan.promptPlanHash, plan.sourceShotSpecHash],
        }),
      );
    }
  }

  return issues;
}

function motionContractSourceRefs(
  contract: MotionEndpointContract | undefined,
  pair: KeyframePairDerivation | undefined,
  layout: ShotLayoutContract | undefined,
): string[] {
  return unique([
    contract?.shotId || "",
    pair?.shotId || "",
    pair?.startFrameId || "",
    pair?.endFrameId || "",
    layout?.id || "",
  ]);
}

function motionEndpointIssue(
  target: string,
  detail: string,
  sourceRefs: string[],
): VisualConsistencyIssue {
  return issue({
    code: "motion_gate_violation",
    layer: "start_end_derivation",
    severity: "blocker",
    target,
    detail,
    sourceRefs,
  });
}

function valuesDiffer(left: unknown, right: unknown): boolean {
  return left !== undefined && right !== undefined && left !== right;
}

export function validateMotionEndpointHardContracts(input: ValidateMotionEndpointHardContractsInput): VisualConsistencyIssue[] {
  const issues: VisualConsistencyIssue[] = [];
  const contracts = input.motionEndpointContracts || [];
  const keyframePairs = input.keyframePairs || [];
  const pairsByShot = new Map(keyframePairs.map((pair) => [pair.shotId, pair]));
  const contractsByShot = new Map(contracts.map((contract) => [contract.shotId, contract]));
  const layoutsByShot = new Map((input.shotLayouts || []).map((layout) => [layout.shotId, layout]));

  for (const pair of keyframePairs) {
    if (!contractsByShot.has(pair.shotId)) {
      issues.push(
        motionEndpointIssue(
          pair.shotId,
          "Keyframe pair has no MotionEndpointContract; visual consistency cannot approve the motion endpoint.",
          motionContractSourceRefs(undefined, pair, layoutsByShot.get(pair.shotId)),
        ),
      );
    }
  }

  for (const contract of contracts) {
    const pair = pairsByShot.get(contract.shotId) || contract.keyframePairDerivation;
    const layout = layoutsByShot.get(contract.shotId);
    const sourceRefs = motionContractSourceRefs(contract, pair, layout);
    const target = contract.shotId || "motion_endpoint_contract";

    if (contract.status === "blocked" || contract.blockers.length > 0) {
      issues.push(
        motionEndpointIssue(
          target,
          `MotionEndpointContract is already blocked: ${contract.blockers.length ? contract.blockers.join("; ") : "status is blocked."}`,
          sourceRefs,
        ),
      );
    }

    if (!pair) {
      issues.push(
        motionEndpointIssue(
          target,
          "MotionEndpointContract has no matching keyframe pair evidence for shotId/start/end validation.",
          sourceRefs,
        ),
      );
    }

    const embeddedPair = contract.keyframePairDerivation;
    if (pair && !embeddedPair) {
      issues.push(
        motionEndpointIssue(
          target,
          "MotionEndpointContract must embed the keyframePairDerivation it gates.",
          sourceRefs,
        ),
      );
    }
    if (pair && embeddedPair) {
      const mismatchFields = [
        valuesDiffer(contract.shotId, pair.shotId) ? "shotId" : "",
        valuesDiffer(embeddedPair.shotId, pair.shotId) ? "keyframePairDerivation.shotId" : "",
        valuesDiffer(embeddedPair.startFrameId, pair.startFrameId) ? "startFrameId" : "",
        valuesDiffer(embeddedPair.endFrameId, pair.endFrameId) ? "endFrameId" : "",
        valuesDiffer(embeddedPair.endDerivationSource, pair.endDerivationSource) ? "endDerivationSource" : "",
        valuesDiffer(embeddedPair.validForI2vPair, pair.validForI2vPair) ? "validForI2vPair" : "",
      ].filter(Boolean);
      if (mismatchFields.length > 0) {
        issues.push(
          motionEndpointIssue(
            target,
            `MotionEndpointContract does not match keyframe pair fields: ${mismatchFields.join(", ")}.`,
            sourceRefs,
          ),
        );
      }
    }

    if (contract.gateInputs.keyframePairPresent !== true) {
      issues.push(
        motionEndpointIssue(
          target,
          "MotionEndpointContract gateInputs.keyframePairPresent must be true.",
          sourceRefs,
        ),
      );
    }
    if (contract.gateInputs.keyframePairDerivesFromStart !== true) {
      issues.push(
        motionEndpointIssue(
          target,
          "MotionEndpointContract gateInputs.keyframePairDerivesFromStart must be true.",
          sourceRefs,
        ),
      );
    }
    if (contract.gateInputs.bboxOnlyMotionForbidden !== true) {
      issues.push(
        motionEndpointIssue(
          target,
          "MotionEndpointContract gateInputs.bboxOnlyMotionForbidden must be true.",
          sourceRefs,
        ),
      );
    }

    if (contract.bodyMechanics.required === true) {
      const missingBodyMechanics = [
        (contract.motionType === "locomotion" || contract.motionType === "pose_change_in_place") &&
        (!contract.bodyMechanics.centerOfMass || contract.bodyMechanics.centerOfMass === "missing")
          ? "centerOfMass"
          : "",
        contract.motionType === "locomotion" && !contract.bodyMechanics.footwork.length ? "footwork" : "",
        !contract.bodyMechanics.contactPoints.length ? "contactPoints" : "",
      ].filter(Boolean);
      if (missingBodyMechanics.length > 0) {
        issues.push(
          motionEndpointIssue(
            target,
            `MotionEndpointContract requires body mechanics but is missing ${missingBodyMechanics.join(", ")}.`,
            sourceRefs,
          ),
        );
      }
    }

    if (contract.editableRegions.length === 0 || contract.protectedRegions.length === 0) {
      issues.push(
        motionEndpointIssue(
          target,
          "MotionEndpointContract must declare both editableRegions and protectedRegions.",
          sourceRefs,
        ),
      );
    }
    const editableRegionIds = new Set(contract.editableRegions.map((region) => region.id).filter(Boolean));
    const conflictingRegionIds = unique(contract.protectedRegions.map((region) => region.id).filter((id) => editableRegionIds.has(id)));
    if (conflictingRegionIds.length > 0) {
      issues.push(
        motionEndpointIssue(
          target,
          `MotionEndpointContract region ids cannot be both editable and protected: ${conflictingRegionIds.join(", ")}.`,
          sourceRefs,
        ),
      );
    }

    const evidence = contract.gateInputs.motionEvidence || [];
    if (contract.motionType === "locomotion" && evidence.length === 1 && evidence[0] === "bbox_or_translation_language") {
      issues.push(
        motionEndpointIssue(
          target,
          "Locomotion cannot use bbox_or_translation_language as its only motion evidence.",
          sourceRefs,
        ),
      );
    }
  }

  return issues;
}

export function validatePostprocessHardContracts(
  policies: VisualConsistencyPostprocessPolicy[] = [],
  generationHarnesses: GenerationHarnessState[] = [],
): VisualConsistencyIssue[] {
  const issues: VisualConsistencyIssue[] = [];
  const allPolicies: VisualConsistencyPostprocessPolicy[] = [
    ...policies,
    ...generationHarnesses.flatMap((harness) => [
      {
        policyId: `generation_harness:${harness.generatedAt}`,
        ...harness.postprocessPolicy,
        forbiddenActions: harness.forbiddenActions,
      },
      ...harness.jobs.map((job) => ({
        policyId: job.harnessJobId,
        ...job.postprocessPolicy,
        forbiddenActions: job.forbiddenActions,
      })),
    ]),
  ];

  for (const policy of allPolicies) {
    const target = policy.policyId || "postprocess_policy";
    const flags = [
      policy.semanticRepairAllowed,
      policy.openCvSemanticRepairAllowed,
      policy.localPostprocessCanChangeMeaning,
      policy.localPostprocessCanPromoteFormal,
    ];
    if (flags.some((flag) => flag === true)) {
      issues.push(
        issue({
          code: "postprocess_semantic_repair_violation",
          layer: "postprocess",
          severity: "blocker",
          target,
          detail: "OpenCV/local postprocess cannot semantically repair, change meaning, or promote formal output.",
          sourceRefs: [target],
        }),
      );
    }
    for (const operation of policy.allowedLocalOperations || []) {
      const normalizedOperation = operation.trim().toLowerCase();
      if (!allowedLocalPostprocessOperations.has(normalizedOperation)) {
        issues.push(
          issue({
            code: "postprocess_semantic_repair_violation",
            layer: "postprocess",
            severity: "blocker",
            target,
            detail: `Local postprocess operation is not on the non-semantic allowlist: ${operation}`,
            sourceRefs: [target],
          }),
        );
      }
      if (semanticRepairPattern.test(operation)) {
        issues.push(
          issue({
            code: "postprocess_semantic_repair_violation",
            layer: "postprocess",
            severity: "blocker",
            target,
            detail: `Local postprocess operation is semantic and therefore forbidden: ${operation}`,
            sourceRefs: [target],
          }),
        );
      }
    }
    if (policy.forbiddenActions && !policy.forbiddenActions.includes("semantic_postprocess_repair")) {
      issues.push(
        issue({
          code: "postprocess_semantic_repair_violation",
          layer: "postprocess",
          severity: "warning",
          target,
          detail: "Postprocess policy should explicitly forbid semantic_postprocess_repair.",
          sourceRefs: [target],
        }),
      );
    }
  }

  return issues;
}

function referencesAsset(plan: ShotPromptPlan, asset: AssetLibraryAsset): boolean {
  return plan.referenceIds.includes(asset.id) || Boolean(asset.mainReferencePath && plan.referenceIds.includes(asset.mainReferencePath));
}

function assetReferenceGateBlockers(
  promptPlans: ShotPromptPlan[],
  assets: AssetLibraryAsset[],
  assetType: AssetLibraryAsset["assetType"],
): string[] {
  return promptPlans.flatMap((plan) =>
    assets
      .filter((asset) => asset.assetType === assetType && referencesAsset(plan, asset))
      .flatMap((asset) => {
        if (asset.status === "rejected") return [`${plan.promptPlanId} references rejected ${assetType} authority ${asset.id}.`];
        if (asset.status === "missing") return [`${plan.promptPlanId} references missing ${assetType} authority ${asset.id}.`];
        return [];
      }),
  );
}

function assetReferenceGateWarnings(
  promptPlans: ShotPromptPlan[],
  assets: AssetLibraryAsset[],
  assetType: AssetLibraryAsset["assetType"],
): string[] {
  return promptPlans.flatMap((plan) =>
    assets
      .filter((asset) => asset.assetType === assetType && referencesAsset(plan, asset))
      .flatMap((asset) => {
        if (asset.status === "candidate" || asset.status === "review") {
          return [`${plan.promptPlanId} references draft-only ${assetType} authority ${asset.id}.`];
        }
        return [];
      }),
  );
}

function buildMotionPairIssues(input: ValidateVisualConsistencyInput): VisualConsistencyIssue[] {
  const fixedShotIds = new Set((input.shotLayouts || []).filter((layout) => layout.cameraConstraints.fixedCamera).map((layout) => layout.shotId));

  return (input.startEndDerivations?.keyframePairs || []).flatMap((pair) => {
    if (!fixedShotIds.has(pair.shotId)) return [];
    const motionText = [...pair.allowedDelta, ...pair.mustPreserve, ...pair.mustNotAdd].join(" ");
    if (!largeCameraMovementPattern.test(motionText)) return [];
    return [
      issue({
        code: "motion_gate_violation",
        layer: "start_end_derivation",
        severity: "blocker",
        target: pair.shotId,
        detail: "Fixed-camera shots cannot carry keyframe pair deltas that allow large camera movement.",
        sourceRefs: [pair.shotId, pair.startFrameId, pair.endFrameId],
      }),
    ];
  });
}

function allScenePacks(input: ValidateVisualConsistencyInput): AssetLibrarySceneAssetPack[] {
  return [
    ...(input.sceneAssetPacks || []),
    ...(input.assetLibrary?.sceneAssetPacks || []),
  ];
}

function buildMasterInheritanceQaIssue(input: ValidateVisualConsistencyInput, issues: VisualConsistencyIssue[]): VisualConsistencyIssue[] {
  const packs = allScenePacks(input);
  const derivedViews = packs.flatMap((pack) => pack.derivedViews.map((view) => ({ pack, view })));
  const shotLayouts = input.shotLayouts || [];
  const keyframePairs = input.startEndDerivations?.keyframePairs || [];
  const packSceneIds = new Set(packs.flatMap((pack) => [pack.sceneId, pack.masterScene.id]));
  const qaBlockers: string[] = [];

  if (!packs.length) qaBlockers.push("Master inheritance QA requires at least one Scene Asset Pack.");
  if (!derivedViews.length) qaBlockers.push("Master inheritance QA requires derived views tied to the master scene.");
  if (!shotLayouts.length) qaBlockers.push("Master inheritance QA requires Shot Layout evidence.");
  if (!keyframePairs.length) qaBlockers.push("Master inheritance QA requires keyframe pair derivation evidence.");
  for (const layout of shotLayouts) {
    if (packSceneIds.size && !packSceneIds.has(layout.sceneId)) {
      qaBlockers.push(`${layout.id} sceneId ${layout.sceneId} is not tied to a Scene Asset Pack master scene.`);
    }
  }
  const inheritedViewIds = new Set(derivedViews.filter(({ view }) => view.inheritsFromMaster).map(({ view }) => view.id));
  for (const layout of shotLayouts) {
    for (const anchor of layout.spatialAnchors) {
      if (/derived|view|camera/i.test(anchor) && !inheritedViewIds.has(anchor)) {
        qaBlockers.push(`${layout.id} references derived-view-like anchor ${anchor} without matching inherited derived view evidence.`);
      }
    }
  }
  qaBlockers.push(
    ...issues
      .filter((item) =>
        item.severity === "blocker" &&
        [
          "scene_pack_status_violation",
          "scene_pack_inheritance_violation",
          "scene_pack_vector_violation",
          "shot_layout_schema_missing",
          "shot_layout_structured_field_missing",
          "shot_layout_vector_violation",
          "shot_layout_end_frame_derivation_violation",
          "keyframe_pair_derivation_violation",
          "prompt_end_frame_derivation_violation",
          "spatial_memory_contract_violation",
        ].includes(item.code),
      )
      .map((item) => item.detail),
  );

  if (!qaBlockers.length) return [];
  return [
    issue({
      code: "master_inheritance_qa_violation",
      layer: "master_inheritance_qa",
      severity: "blocker",
      target: "master_inheritance_qa_gate",
      detail: `Master inheritance QA blocked: ${unique(qaBlockers).join(" ")}`,
      sourceRefs: unique([
        ...packs.map((pack) => pack.id),
        ...derivedViews.map(({ view }) => view.id),
        ...shotLayouts.map((layout) => layout.id),
        ...keyframePairs.map((pair) => pair.shotId),
      ]),
    }),
  ];
}

function buildVisualConsistencyGates(input: ValidateVisualConsistencyInput, issues: VisualConsistencyIssue[]): VisualConsistencyGate[] {
  const assets = input.assetLibrary?.assets || [];
  const promptPlans = input.startEndDerivations?.promptPlans || [];
  const lockedCharacters = assets.filter((asset) => asset.assetType === "character" && asset.status === "locked" && assetHasFutureUse(asset));
  const lockedScenes = assets.filter((asset) => asset.assetType === "scene" && asset.status === "locked" && assetHasFutureUse(asset));
  const scenePacks = allScenePacks(input);
  const lockedScenePacks = scenePacks.filter((pack) => pack.status === "locked" && pack.readiness === "ready_for_formal");
  const keyframePairs = input.startEndDerivations?.keyframePairs || [];
  const blockedByCode = (codes: VisualConsistencyIssueCode[]) =>
    issues.filter((item) => item.severity === "blocker" && codes.includes(item.code)).map((item) => item.detail);
  const warnedByCode = (codes: VisualConsistencyIssueCode[]) =>
    issues.filter((item) => item.severity === "warning" && codes.includes(item.code)).map((item) => item.detail);

  return [
    gate({
      gateId: "identity_gate",
      layer: "asset_library",
      target: input.assetLibrary?.id || "asset_library",
      detail: "Character identity authority must be locked before formal visual generation.",
      blockers: [
        ...(!input.assetLibrary || !lockedCharacters.length ? ["No locked character identity authority is available."] : []),
        ...assetReferenceGateBlockers(promptPlans, assets, "character"),
        ...blockedByCode(["asset_status_future_reference_violation", "asset_rejected_status_violation"]),
      ],
      warnings: assetReferenceGateWarnings(promptPlans, assets, "character"),
      sourceRefs: [input.assetLibrary?.id || "", ...lockedCharacters.map((asset) => asset.id)],
    }),
    gate({
      gateId: "scene_gate",
      layer: "scene_asset_pack",
      target: input.assetLibrary?.id || "scene_asset_pack",
      detail: "Scene space must flow from locked Scene Asset Pack master scenes and derived views.",
      blockers: [
        ...(!input.assetLibrary || !lockedScenes.length || !lockedScenePacks.length
          ? ["No locked scene authority and ready Scene Asset Pack are available."]
          : []),
        ...assetReferenceGateBlockers(promptPlans, assets, "scene"),
        ...blockedByCode(["scene_pack_status_violation", "scene_pack_inheritance_violation", "scene_pack_vector_violation", "scene_pack_forbidden_reference"]),
      ],
      warnings: assetReferenceGateWarnings(promptPlans, assets, "scene"),
      sourceRefs: [...lockedScenes.map((asset) => asset.id), ...lockedScenePacks.map((pack) => pack.id)],
    }),
    gate({
      gateId: "layout_gate",
      layer: "shot_layout",
      target: "shot_layouts",
      detail: "Shot Layout must bind subject placement, camera placement, axis, and spatial anchors.",
      blockers: [
        ...(!(input.shotLayouts || []).length ? ["Shot Layout evidence is missing; subject position, camera placement, axis/screen direction, and anchors cannot be formal."] : []),
        ...blockedByCode(["shot_layout_schema_missing", "shot_layout_structured_field_missing", "shot_layout_vector_violation", "shot_layout_camera_constraint_violation"]),
      ],
      warnings: warnedByCode(["motion_gate_violation"]),
      sourceRefs: (input.shotLayouts || []).map((layout) => layout.id),
    }),
    gate({
      gateId: "spatial_memory_gate",
      layer: "spatial_memory",
      target: input.spatialMemory?.id || "spatial_memory",
      detail: "Spatial Memory must bind world coordinates, axes, and scene states as project facts.",
      blockers: blockedByCode(["spatial_memory_contract_violation"]),
      sourceRefs: [
        input.spatialMemory?.id || "",
        ...spatialMemoryWorldPositionRefs(input.spatialMemory),
        ...spatialMemoryAxisRefs(input.spatialMemory),
        ...spatialMemorySceneStateRefs(input.spatialMemory),
      ],
    }),
    gate({
      gateId: "pair_gate",
      layer: "start_end_derivation",
      target: "keyframe_pairs",
      detail: "End frames must derive from start frames before any I2V handoff.",
      blockers: [
        ...(!keyframePairs.length ? ["Keyframe pair derivation evidence is missing."] : []),
        ...blockedByCode(["keyframe_pair_derivation_violation", "prompt_end_frame_derivation_violation"]),
      ],
      sourceRefs: keyframePairs.map((pair) => pair.shotId),
    }),
    gate({
      gateId: "master_inheritance_qa_gate",
      layer: "master_inheritance_qa",
      target: "master_inheritance_qa",
      detail: "Scene packs, derived views, Shot Layout, and keyframe pairs must pass QA together; worker/provider self-report cannot override it.",
      blockers: blockedByCode(["master_inheritance_qa_violation"]),
      sourceRefs: unique([
        ...scenePacks.map((pack) => pack.id),
        ...scenePacks.flatMap((pack) => pack.derivedViews.map((view) => view.id)),
        ...(input.shotLayouts || []).map((layout) => layout.id),
        ...keyframePairs.map((pair) => pair.shotId),
      ]),
    }),
    gate({
      gateId: "story_gate",
      layer: "fact_chain",
      target: "story_flow_prompt_plan",
      detail: "Prompt plans must not carry blocked or stale Story Flow facts.",
      blockers: promptPlans.flatMap((plan) => (plan.status === "blocked" ? plan.blockers.length ? plan.blockers : [`${plan.promptPlanId} is blocked.`] : [])),
      warnings: promptPlans.flatMap((plan) => (plan.status === "draft" ? [`${plan.promptPlanId} is still draft.`] : [])),
      sourceRefs: promptPlans.map((plan) => plan.promptPlanId),
    }),
    gate({
      gateId: "prop_gate",
      layer: "asset_library",
      target: "prop_authority",
      detail: "Referenced props must not come from rejected, missing, or temp authority.",
      blockers: assetReferenceGateBlockers(promptPlans, assets, "prop"),
      warnings: assetReferenceGateWarnings(promptPlans, assets, "prop"),
      sourceRefs: assets.filter((asset) => asset.assetType === "prop").map((asset) => asset.id),
    }),
    gate({
      gateId: "style_gate",
      layer: "asset_library",
      target: "style_authority",
      detail: "Style references must stay consistent with locked Visual Memory style facts.",
      blockers: assetReferenceGateBlockers(promptPlans, assets, "style"),
      warnings: assetReferenceGateWarnings(promptPlans, assets, "style"),
      sourceRefs: assets.filter((asset) => asset.assetType === "style").map((asset) => asset.id),
    }),
    gate({
      gateId: "motion_gate",
      layer: "shot_layout",
      target: "camera_motion",
      detail: "Motion deltas cannot contradict fixed camera/world-position contracts.",
      blockers: blockedByCode(["motion_gate_violation", "shot_layout_camera_constraint_violation"]),
      warnings: warnedByCode(["motion_gate_violation"]),
      sourceRefs: [
        ...(input.shotLayouts || []).map((layout) => layout.id),
        ...(input.motionEndpointContracts || []).map((contract) => contract.shotId),
      ],
    }),
    gate({
      gateId: "video_handoff_gate",
      layer: "start_end_derivation",
      target: "video_i2v_handoff",
      detail: "Video handoff must be sourced from a valid start/end keyframe pair.",
      blockers: keyframePairs
        .filter((pair) => pair.validForI2vPair !== true || pair.endDerivationSource !== "start_frame")
        .map((pair) => `${pair.shotId} is not a derived I2V-ready keyframe pair.`),
      sourceRefs: keyframePairs.map((pair) => pair.shotId),
    }),
  ];
}

function buildFactChain(gates: VisualConsistencyGate[]): VisualConsistencyReport["factChain"] {
  const stepDefs: Array<Omit<VisualConsistencyFactChainStep, "status" | "sourceRefs">> = [
    {
      stepId: "character_identity",
      gateIds: ["identity_gate"],
      detail: "Character identity authority is the first visual fact.",
    },
    {
      stepId: "scene_space",
      gateIds: ["scene_gate", "spatial_memory_gate"],
      detail: "Scene space inherits from master scene, derived view geometry, and Spatial Memory facts.",
    },
    {
      stepId: "shot_layout",
      gateIds: ["layout_gate", "motion_gate"],
      detail: "Shot Layout locks camera/world position and permitted motion.",
    },
    {
      stepId: "start_end_keyframes",
      gateIds: ["pair_gate", "story_gate", "prop_gate", "style_gate"],
      detail: "Start/end keyframes preserve identity, scene, story, prop, and style facts.",
    },
    {
      stepId: "video_handoff",
      gateIds: ["master_inheritance_qa_gate", "video_handoff_gate"],
      detail: "Video generation only receives QA-approved derived keyframe pairs.",
    },
  ];
  const steps = stepDefs.map((step): VisualConsistencyFactChainStep => {
    const stepGates = gates.filter((gateItem) => step.gateIds.includes(gateItem.gateId));
    return {
      ...step,
      status: statusFromGates(stepGates),
      sourceRefs: unique(stepGates.flatMap((gateItem) => gateItem.sourceRefs)),
    };
  });

  return {
    sequence: factChainSequence,
    steps,
    blockers: unique(gates.flatMap((gateItem) => gateItem.blockers)),
    warnings: unique(gates.flatMap((gateItem) => gateItem.warnings)),
  };
}

function receiptGate(
  contractGateId: VisualConsistencyContractGateId,
  gateItem: VisualConsistencyGate | undefined,
  detail: string,
): VisualConsistencyContractGate {
  const blockers = unique(gateItem?.blockers || []);
  const warnings = unique(gateItem?.warnings || []);
  const status = blockers.length ? "blocked" : warnings.length ? "warning" : "pass";
  return {
    contractGateId,
    status,
    formalEligible: status === "pass",
    detail,
    blockers,
    warnings,
    sourceRefs: unique(gateItem?.sourceRefs || []),
  };
}

function buildVisualConsistencyContractReceipt(gates: VisualConsistencyGate[], input: ValidateVisualConsistencyInput): VisualConsistencyContractReceipt {
  const findGate = (gateId: VisualConsistencyGateId) => gates.find((candidate) => candidate.gateId === gateId);
  const scenePacks = allScenePacks(input);
  const derivedViewIds = scenePacks.flatMap((pack) => pack.derivedViews.map((view) => view.id));
  const shotLayoutIds = (input.shotLayouts || []).map((layout) => layout.id);
  const keyframePairShotIds = (input.startEndDerivations?.keyframePairs || []).map((pair) => pair.shotId);
  const qaGate = findGate("master_inheritance_qa_gate");
  const receiptGates: VisualConsistencyContractReceipt["gates"] = {
    identityGate: receiptGate(
      "identity_gate",
      findGate("identity_gate"),
      "Locked character reference plus text constraints are the only positive future identity authority.",
    ),
    sceneGate: receiptGate(
      "scene_gate",
      findGate("scene_gate"),
      "Master scene, derived views, camera vectors, and world positions must be inherited from Scene Asset Pack authority.",
    ),
    shotLayoutGate: receiptGate(
      "shot_layout_gate",
      findGate("layout_gate"),
      "Subject position, camera placement, axis/screen direction, and spatial anchors must be structured.",
    ),
    spatialMemoryGate: receiptGate(
      "spatial_memory_gate",
      findGate("spatial_memory_gate"),
      "World coordinates, axes, and scene states must exist as project-local Spatial Memory facts.",
    ),
    keyframePairDerivationGate: receiptGate(
      "keyframe_pair_derivation_gate",
      findGate("pair_gate"),
      "Same-shot end frames must derive from approved start frames; independent end frames, large drift, and fixed-camera conflicts are blocked.",
    ),
    masterInheritanceQaGate: receiptGate(
      "master_inheritance_qa_gate",
      qaGate,
      "Scene pack, derived views, Shot Layout, and keyframe pair evidence must pass QA together.",
    ),
  };
  const gateValues = Object.values(receiptGates);
  const qaBlockers = unique(qaGate?.blockers || []);
  const qaWarnings = unique(qaGate?.warnings || []);

  return {
    receiptKind: "visual_consistency_contract",
    phase: "phase37_visual_consistency_contract",
    status: gateValues.some((gateItem) => gateItem.status === "blocked") ? "blocked" : "pass",
    formalPlanningAllowed: gateValues.every((gateItem) => gateItem.formalEligible),
    gates: receiptGates,
    qaGateSummary: {
      scenePackIds: scenePacks.map((pack) => pack.id),
      derivedViewIds,
      shotLayoutIds,
      keyframePairShotIds,
      workerProviderSelfReportMayOverride: false,
      blockers: qaBlockers,
      warnings: qaWarnings,
      sourceRefs: unique([
        ...scenePacks.map((pack) => pack.id),
        ...derivedViewIds,
        ...shotLayoutIds,
        ...keyframePairShotIds,
      ]),
    },
    hardLocks: {
      identityRequiresLockedCharacterReference: true,
      candidateTempRejectedContactSheetShotOutputCannotBeFutureReference: true,
      derivedViewsMustInheritMasterScene: true,
      shotLayoutStructuredFieldsRequired: true,
      spatialMemoryRequiredForFormal: true,
      keyframeEndFrameMustDeriveFromApprovedStartFrame: true,
      independentEndFrameLargeMotionFixedCameraConflictBlocked: true,
      masterInheritanceQaGateRequired: true,
      workerProviderSelfReportCannotOverrideQa: true,
      localOpenCvPostprocessSemanticRepairForbidden: true,
    },
  };
}

export function validateVisualConsistency(input: ValidateVisualConsistencyInput): VisualConsistencyReport {
  const assetLibraryIssues = input.assetLibrary ? validateAssetLibraryHardContracts(input.assetLibrary) : [];
  const scenePackInputs = allScenePacks(input);
  const explicitScenePackIssues = (input.sceneAssetPacks || []).flatMap(validateSceneAssetPackHardContracts);
  const shotLayoutIssues = (input.shotLayouts || []).flatMap(validateShotLayoutHardContracts);
  const spatialMemoryIssues = validateSpatialMemoryHardContracts(input.spatialMemory);
  const derivationIssues = input.startEndDerivations
    ? validateStartEndDerivationHardContracts(input.startEndDerivations)
    : [];
  const motionEndpointIssues = validateMotionEndpointHardContracts({
    motionEndpointContracts: input.motionEndpointContracts,
    keyframePairs: input.startEndDerivations?.keyframePairs,
    shotLayouts: input.shotLayouts,
  });
  const postprocessIssues = validatePostprocessHardContracts(input.postprocessPolicies, input.generationHarnesses);
  const motionPairIssues = buildMotionPairIssues(input);
  const preQaIssues = [
    ...assetLibraryIssues,
    ...explicitScenePackIssues,
    ...shotLayoutIssues,
    ...spatialMemoryIssues,
    ...derivationIssues,
    ...motionEndpointIssues,
    ...motionPairIssues,
    ...postprocessIssues,
  ];
  const issues = [
    ...preQaIssues,
    ...buildMasterInheritanceQaIssue(input, preQaIssues),
  ];
  const gates = buildVisualConsistencyGates(input, issues);
  const contractReceipt = buildVisualConsistencyContractReceipt(gates, input);
  const factChain = buildFactChain(gates);
  const blockers = [
    ...issues.filter((item) => item.severity === "blocker").map((item) => item.detail),
    ...gates.flatMap((gateItem) => gateItem.blockers),
  ];
  const warnings = [
    ...issues.filter((item) => item.severity === "warning").map((item) => item.detail),
    ...gates.flatMap((gateItem) => gateItem.warnings),
  ];
  const assets = input.assetLibrary?.assets || [];

  return {
    schemaVersion: visualConsistencySchemaVersion,
    checkedAt: input.checkedAt || "fixture_time_not_runtime_io",
    status: blockers.length ? "blocked" : "pass",
    issues,
    blockers: unique(blockers),
    warnings: unique(warnings),
    summary: {
      assetCount: assets.length,
      scenePackCount: scenePackInputs.length,
      shotLayoutCount: input.shotLayouts?.length || 0,
      keyframePairCount: input.startEndDerivations?.keyframePairs?.length || 0,
      promptPlanCount: input.startEndDerivations?.promptPlans?.length || 0,
      generationHarnessCount: input.generationHarnesses?.length || 0,
      blockerCount: issues.filter((item) => item.severity === "blocker").length,
      warningCount: issues.filter((item) => item.severity === "warning").length,
      lockedAssets: assets.filter((asset) => asset.status === "locked").length,
      candidateAssets: assets.filter((asset) => asset.status === "candidate" || asset.status === "review").length,
      rejectedAssets: assets.filter((asset) => asset.status === "rejected").length,
      forbiddenFutureReferences: issues.filter((item) => item.code === "asset_forbidden_future_reference").length,
      semanticPostprocessViolations: issues.filter((item) => item.code === "postprocess_semantic_repair_violation").length,
      gateCount: gates.length,
      gateBlockers: gates.filter((gateItem) => gateItem.status === "blocked").length,
      gateWarnings: gates.filter((gateItem) => gateItem.status === "warning").length,
      contractGateCount: Object.keys(contractReceipt.gates).length,
      contractGateBlockers: Object.values(contractReceipt.gates).filter((gateItem) => gateItem.status === "blocked").length,
      contractGateWarnings: Object.values(contractReceipt.gates).filter((gateItem) => gateItem.status === "warning").length,
    },
    factChain,
    gates,
    contractReceipt,
    hardLocks,
  };
}
