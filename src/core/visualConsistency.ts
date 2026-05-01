import type {
  AssetLibraryAsset,
  AssetLibrarySceneAssetPack,
  AssetLibrarySnapshot,
  Vector3,
} from "./assetLibraryCrud";
import type {
  GenerationHarnessState,
  KeyframePairDerivation,
  ShotPromptPlan,
} from "./types";

export const visualConsistencySchemaVersion = "0.1.0";

export type VisualConsistencyLayer =
  | "asset_library"
  | "scene_asset_pack"
  | "shot_layout"
  | "start_end_derivation"
  | "fact_chain"
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
  | "shot_layout_vector_violation"
  | "shot_layout_end_frame_derivation_violation"
  | "shot_layout_camera_constraint_violation"
  | "keyframe_pair_derivation_violation"
  | "prompt_end_frame_derivation_violation"
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
  | "pair_gate"
  | "story_gate"
  | "prop_gate"
  | "style_gate"
  | "motion_gate"
  | "video_handoff_gate";

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

export interface ValidateVisualConsistencyInput {
  checkedAt?: string;
  assetLibrary?: AssetLibrarySnapshot;
  sceneAssetPacks?: AssetLibrarySceneAssetPack[];
  shotLayouts?: ShotLayoutContract[];
  startEndDerivations?: ValidateStartEndDerivationInput;
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
      const exceptionIsExplicit = Boolean(pair.exceptionReason?.trim());
      if (!allowIndependentExceptions || !exceptionIsExplicit) {
        issues.push(
          issue({
            code: "keyframe_pair_derivation_violation",
            layer: "start_end_derivation",
            severity: "blocker",
            target: pair.shotId,
            detail: "Independent end-frame generation is not the default path and requires an explicit allowed exception.",
            sourceRefs,
          }),
        );
      }
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

function buildVisualConsistencyGates(input: ValidateVisualConsistencyInput, issues: VisualConsistencyIssue[]): VisualConsistencyGate[] {
  const assets = input.assetLibrary?.assets || [];
  const promptPlans = input.startEndDerivations?.promptPlans || [];
  const lockedCharacters = assets.filter((asset) => asset.assetType === "character" && asset.status === "locked" && assetHasFutureUse(asset));
  const lockedScenes = assets.filter((asset) => asset.assetType === "scene" && asset.status === "locked" && assetHasFutureUse(asset));
  const lockedScenePacks = [
    ...(input.sceneAssetPacks || []),
    ...(input.assetLibrary?.sceneAssetPacks || []),
  ].filter((pack) => pack.status === "locked" && pack.readiness === "ready_for_formal");
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
        ...(input.assetLibrary && !lockedCharacters.length ? ["No locked character identity authority is available."] : []),
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
        ...(input.assetLibrary && (!lockedScenes.length || !lockedScenePacks.length)
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
      blockers: blockedByCode(["shot_layout_schema_missing", "shot_layout_vector_violation", "shot_layout_camera_constraint_violation"]),
      warnings: warnedByCode(["motion_gate_violation"]),
      sourceRefs: (input.shotLayouts || []).map((layout) => layout.id),
    }),
    gate({
      gateId: "pair_gate",
      layer: "start_end_derivation",
      target: "keyframe_pairs",
      detail: "End frames must derive from start frames before any I2V handoff.",
      blockers: blockedByCode(["keyframe_pair_derivation_violation", "prompt_end_frame_derivation_violation"]),
      sourceRefs: (input.startEndDerivations?.keyframePairs || []).map((pair) => pair.shotId),
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
      sourceRefs: (input.shotLayouts || []).map((layout) => layout.id),
    }),
    gate({
      gateId: "video_handoff_gate",
      layer: "start_end_derivation",
      target: "video_i2v_handoff",
      detail: "Video handoff must be sourced from a valid start/end keyframe pair.",
      blockers: (input.startEndDerivations?.keyframePairs || [])
        .filter((pair) => pair.validForI2vPair !== true || pair.endDerivationSource !== "start_frame")
        .map((pair) => `${pair.shotId} is not a derived I2V-ready keyframe pair.`),
      sourceRefs: (input.startEndDerivations?.keyframePairs || []).map((pair) => pair.shotId),
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
      gateIds: ["scene_gate"],
      detail: "Scene space inherits from master scene and derived view geometry.",
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
      gateIds: ["video_handoff_gate"],
      detail: "Video generation only receives approved derived keyframe pairs.",
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

export function validateVisualConsistency(input: ValidateVisualConsistencyInput): VisualConsistencyReport {
  const assetLibraryIssues = input.assetLibrary ? validateAssetLibraryHardContracts(input.assetLibrary) : [];
  const scenePackInputs = [
    ...(input.sceneAssetPacks || []),
    ...(input.assetLibrary?.sceneAssetPacks || []),
  ];
  const explicitScenePackIssues = (input.sceneAssetPacks || []).flatMap(validateSceneAssetPackHardContracts);
  const shotLayoutIssues = (input.shotLayouts || []).flatMap(validateShotLayoutHardContracts);
  const derivationIssues = input.startEndDerivations
    ? validateStartEndDerivationHardContracts(input.startEndDerivations)
    : [];
  const postprocessIssues = validatePostprocessHardContracts(input.postprocessPolicies, input.generationHarnesses);
  const motionPairIssues = buildMotionPairIssues(input);
  const issues = [
    ...assetLibraryIssues,
    ...explicitScenePackIssues,
    ...shotLayoutIssues,
    ...derivationIssues,
    ...motionPairIssues,
    ...postprocessIssues,
  ];
  const gates = buildVisualConsistencyGates(input, issues);
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
    },
    factChain,
    gates,
    hardLocks,
  };
}
