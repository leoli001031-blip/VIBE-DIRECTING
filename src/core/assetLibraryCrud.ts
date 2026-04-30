export type AssetLibraryAssetType = "character" | "scene" | "prop" | "style" | "voice_anchor";
export type AssetLibraryStatus = "locked" | "candidate" | "review" | "rejected" | "missing";
export type AssetLibraryVisualMemoryStatus = "locked" | "candidate" | "rejected" | "not_serialized";
export type AssetLibraryPathOrigin = "project_root_relative" | "user_selected_import";
export type AssetLibrarySourceKind =
  | "user_import"
  | "user_selected_import"
  | "source_asset"
  | "formal_output"
  | "manual_definition"
  | "provider_temp_output"
  | "failed_output"
  | "shot_output"
  | "contact_sheet";

export interface AssetLibraryPathRef {
  path: string;
  origin: AssetLibraryPathOrigin;
  importId?: string;
  rawPathRedacted?: true;
  notes: string[];
}

export interface AssetLibraryReferenceAuthority {
  id: string;
  path: string;
  referenceRole:
    | "identity_authority"
    | "scene_layout_authority"
    | "style_authority"
    | "prop_authority"
    | "negative_case"
    | "rejected_case"
    | "temp_candidate";
  authorityScope: string[];
  polarity: "positive" | "negative";
  lockedStatus: "locked" | "candidate" | "needs_review" | "not_generated" | "rejected";
  allowedUse: Array<"prompt_reference" | "future_reference" | "draft_preview" | "formal_output" | "negative_prompt">;
  canPromoteToFormal: boolean;
  canUseAsFutureReference: boolean;
  rejectedReason?: string;
  contaminationReason?: string;
}

export interface AssetLibraryAsset {
  id: string;
  assetType: AssetLibraryAssetType;
  name: string;
  status: AssetLibraryStatus;
  visualMemoryStatus: AssetLibraryVisualMemoryStatus;
  originKind: Exclude<AssetLibrarySourceKind, "failed_output" | "shot_output" | "contact_sheet" | "user_selected_import">;
  sourceKind: AssetLibrarySourceKind;
  sourcePath?: AssetLibraryPathRef;
  mainReferencePath?: string;
  referenceAuthority: AssetLibraryReferenceAuthority;
  textConstraints: string[];
  sourceRefs: string[];
  usedByShotIds: string[];
  canPromoteToFormal: boolean;
  canUseAsFutureReference: boolean;
  formalLibraryIncluded: boolean;
  galleryItem: false;
  blockers: string[];
  warnings: string[];
  updatedAt: string;
}

export interface AssetLibrarySceneAssetPack {
  schemaVersion: string;
  id: string;
  sceneId: string;
  status: "locked" | "candidate" | "rejected";
  masterScene: {
    id: string;
    status: "locked" | "candidate" | "rejected";
    referenceAuthority: AssetLibraryReferenceAuthority;
    worldCoordinateSystem: string;
    worldAnchors: Array<{
      id: string;
      label: string;
      worldPosition: Vector3;
    }>;
    cameraVectors: Array<{
      id: string;
      worldPosition: Vector3;
      cameraVector: Vector3;
    }>;
    masterImageRefs: string[];
    textConstraints: string[];
  };
  derivedViews: AssetLibraryDerivedView[];
  assetRefs: string[];
  readiness: "draft_only" | "ready_for_formal" | "blocked";
  inheritanceRules: {
    masterInheritanceRequired: true;
    textOnlyViewRecreationAllowed: false;
    unknownDerivationCanLock: false;
  };
  updatedAt: string;
}

export interface AssetLibraryDerivedView {
  id: string;
  status: "locked" | "candidate" | "rejected";
  masterSceneId: string;
  inheritsFromMaster: true;
  inheritanceOverrides: string[];
  worldPosition: Vector3;
  cameraVector: Vector3;
  viewImageRefs: string[];
  derivationEvidence: string[];
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface AssetLibrarySnapshot {
  schemaVersion: string;
  id: string;
  libraryPurpose: "asset_consistency_memory";
  createdAt: string;
  updatedAt: string;
  referenceAuthorityPolicy: {
    authorityRoleRequired: true;
    assetLibraryIsGallery: false;
    tempOutputAutoPromote: false;
    localPostprocessCanSemanticRepair: false;
  };
  v0Compatibility: {
    supportsSingleMainCharacterReference: true;
    supportsSingleSceneReference: true;
    requiresTextConstraints: true;
    supportsLockedStatus: true;
    futureExpansion: Array<"three_view_character_refs" | "multi_angle_scene_refs" | "prop_turnarounds" | "style_variant_sets">;
  };
  hardLocks: {
    dryRunOnly: true;
    inMemoryOnly: true;
    noFileMutation: true;
    noProviderSubmit: true;
    noCredentialRead: true;
    noCredentialWrite: true;
    noTempOutputPromotion: true;
    assetLibraryIsNotGallery: true;
  };
  assets: AssetLibraryAsset[];
  sceneAssetPacks: AssetLibrarySceneAssetPack[];
  blockedImports: AssetLibraryBlockedImport[];
  notes: string[];
}

export interface AssetLibraryBlockedImport {
  id: string;
  reason: string;
  sourceKind: AssetLibrarySourceKind;
  path?: string;
  blockedAt: string;
}

export interface AddAssetLibraryAssetInput {
  id: string;
  assetType: AssetLibraryAssetType;
  name: string;
  status?: AssetLibraryStatus;
  sourceKind?: AssetLibrarySourceKind;
  path?: string;
  pathOrigin?: AssetLibraryPathOrigin;
  importId?: string;
  textConstraints: string[];
  sourceRefs?: string[];
  usedByShotIds?: string[];
  rejectedReason?: string;
  updatedAt?: string;
}

export interface UpdateAssetLibraryAssetInput {
  name?: string;
  status?: AssetLibraryStatus;
  sourceKind?: AssetLibrarySourceKind;
  path?: string;
  pathOrigin?: AssetLibraryPathOrigin;
  importId?: string;
  textConstraints?: string[];
  sourceRefs?: string[];
  usedByShotIds?: string[];
  rejectedReason?: string;
  updatedAt?: string;
}

export interface AssetLibraryValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checkedAt: string;
}

export interface AssetLibraryMutationResult {
  library: AssetLibrarySnapshot;
  asset?: AssetLibraryAsset;
  validation: AssetLibraryValidationResult;
  rejected?: AssetLibraryBlockedImport;
}

export interface VisualMemoryDocument {
  schemaVersion: string;
  id: string;
  libraryPurpose: "asset_consistency_memory";
  referenceAuthorityPolicy: AssetLibrarySnapshot["referenceAuthorityPolicy"];
  v0Compatibility: AssetLibrarySnapshot["v0Compatibility"];
  assets: Array<{
    id: string;
    assetType: AssetLibraryAssetType;
    name: string;
    status: "locked" | "candidate" | "rejected";
    originKind: "user_import" | "source_asset" | "formal_output" | "provider_temp_output" | "manual_definition";
    referenceAuthority: AssetLibraryReferenceAuthority;
    mainReferencePath?: string;
    textConstraints: string[];
    sourceRefs: string[];
    usedByShotIds: string[];
    canPromoteToFormal: boolean;
    canUseAsFutureReference: boolean;
    rejectedReason?: string;
  }>;
  updatedAt: string;
}

const schemaVersion = "0.1.0";
const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/])/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;
const tempOrFailedPathPattern = /(^|\/)(tmp|temp|cache|candidates?|drafts?|failed|failures?|contact[-_ ]?sheets?|shot[-_ ]?outputs?|outputs\/shots)(\/|$)/i;
const contactSheetPattern = /contact[-_ ]?sheet/i;

function nowIso(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeSlashes(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
}

function trimOuterSlashes(value: string): string {
  return normalizeSlashes(value).replace(/^\/+/, "").replace(/\/+$/, "");
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

function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_/-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") || "asset"
  );
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function vector(x = 0, y = 0, z = 0): Vector3 {
  return { x, y, z };
}

function isAbsoluteLike(value: string): boolean {
  return absolutePathPattern.test(value.trim());
}

function hasParentTraversal(value: string): boolean {
  return parentTraversalPattern.test(normalizeSlashes(value));
}

function pathLooksForbidden(path: string | undefined): boolean {
  if (!path) return false;
  return tempOrFailedPathPattern.test(normalizeSlashes(path)) || contactSheetPattern.test(path);
}

export function createAssetLibraryPathRef(input: {
  path: string;
  origin?: AssetLibraryPathOrigin;
  importId?: string;
}): AssetLibraryPathRef {
  const origin = input.origin || "project_root_relative";
  const normalized = normalizeSlashes(input.path);

  if (origin === "user_selected_import") {
    const importId = slug(input.importId || stableHash(normalized).replace(/^vck_/, "import_"));
    return {
      path: `user_selected_import/${importId}`,
      origin,
      importId,
      rawPathRedacted: true,
      notes: [
        "Raw user-selected import path is redacted from the portable asset contract.",
        "Asset Library stores authority metadata, not platform-specific filesystem locations.",
      ],
    };
  }

  return {
    path: isAbsoluteLike(normalized) ? normalized : trimOuterSlashes(normalized),
    origin,
    notes: ["Asset path is project-root-relative."],
  };
}

export function createAssetLibrarySnapshot(input: {
  id?: string;
  createdAt?: string;
  assets?: AssetLibraryAsset[];
  sceneAssetPacks?: AssetLibrarySceneAssetPack[];
} = {}): AssetLibrarySnapshot {
  const createdAt = input.createdAt || nowIso();
  return {
    schemaVersion,
    id: input.id || "visual_memory",
    libraryPurpose: "asset_consistency_memory",
    createdAt,
    updatedAt: createdAt,
    referenceAuthorityPolicy: {
      authorityRoleRequired: true,
      assetLibraryIsGallery: false,
      tempOutputAutoPromote: false,
      localPostprocessCanSemanticRepair: false,
    },
    v0Compatibility: {
      supportsSingleMainCharacterReference: true,
      supportsSingleSceneReference: true,
      requiresTextConstraints: true,
      supportsLockedStatus: true,
      futureExpansion: ["three_view_character_refs", "multi_angle_scene_refs", "prop_turnarounds", "style_variant_sets"],
    },
    hardLocks: {
      dryRunOnly: true,
      inMemoryOnly: true,
      noFileMutation: true,
      noProviderSubmit: true,
      noCredentialRead: true,
      noCredentialWrite: true,
      noTempOutputPromotion: true,
      assetLibraryIsNotGallery: true,
    },
    assets: input.assets ? clone(input.assets) : [],
    sceneAssetPacks: input.sceneAssetPacks ? clone(input.sceneAssetPacks) : [],
    blockedImports: [],
    notes: [
      "Asset Library is an authority and consistency memory, not a gallery.",
      "Temp, failed, shot output, and contact sheet artifacts cannot enter the formal Asset Library.",
    ],
  };
}

function isForbiddenSource(input: { sourceKind?: AssetLibrarySourceKind; path?: string }): string | undefined {
  if (input.sourceKind === "provider_temp_output") return "provider_temp_output cannot enter formal Asset Library.";
  if (input.sourceKind === "failed_output") return "failed_output cannot enter formal Asset Library.";
  if (input.sourceKind === "shot_output") return "shot_output cannot enter formal Asset Library.";
  if (input.sourceKind === "contact_sheet") return "contact_sheet cannot enter formal Asset Library.";
  if (pathLooksForbidden(input.path)) return "Path looks like temp, failed, shot output, candidate cache, or contact sheet material.";
  return undefined;
}

function originKindFor(sourceKind: AssetLibrarySourceKind): AssetLibraryAsset["originKind"] {
  if (sourceKind === "user_selected_import") return "user_import";
  if (sourceKind === "failed_output" || sourceKind === "shot_output" || sourceKind === "contact_sheet") return "manual_definition";
  return sourceKind;
}

function referenceRoleFor(assetType: AssetLibraryAssetType, status: AssetLibraryStatus): AssetLibraryReferenceAuthority["referenceRole"] {
  if (status === "rejected" || status === "missing") return "rejected_case";
  if (status === "candidate" || status === "review") return "temp_candidate";
  if (assetType === "character") return "identity_authority";
  if (assetType === "scene") return "scene_layout_authority";
  if (assetType === "prop") return "prop_authority";
  return "style_authority";
}

function statusMapping(status: AssetLibraryStatus): {
  visualMemoryStatus: AssetLibraryVisualMemoryStatus;
  lockedStatus: AssetLibraryReferenceAuthority["lockedStatus"];
  polarity: AssetLibraryReferenceAuthority["polarity"];
  allowedUse: AssetLibraryReferenceAuthority["allowedUse"];
  canPromoteToFormal: boolean;
  canUseAsFutureReference: boolean;
  formalLibraryIncluded: boolean;
} {
  if (status === "locked") {
    return {
      visualMemoryStatus: "locked",
      lockedStatus: "locked",
      polarity: "positive",
      allowedUse: ["prompt_reference", "future_reference", "draft_preview", "formal_output"],
      canPromoteToFormal: true,
      canUseAsFutureReference: true,
      formalLibraryIncluded: true,
    };
  }
  if (status === "candidate") {
    return {
      visualMemoryStatus: "candidate",
      lockedStatus: "candidate",
      polarity: "positive",
      allowedUse: ["draft_preview"],
      canPromoteToFormal: false,
      canUseAsFutureReference: false,
      formalLibraryIncluded: true,
    };
  }
  if (status === "review") {
    return {
      visualMemoryStatus: "candidate",
      lockedStatus: "needs_review",
      polarity: "positive",
      allowedUse: ["draft_preview"],
      canPromoteToFormal: false,
      canUseAsFutureReference: false,
      formalLibraryIncluded: true,
    };
  }
  if (status === "rejected") {
    return {
      visualMemoryStatus: "rejected",
      lockedStatus: "rejected",
      polarity: "negative",
      allowedUse: ["negative_prompt"],
      canPromoteToFormal: false,
      canUseAsFutureReference: false,
      formalLibraryIncluded: true,
    };
  }
  return {
    visualMemoryStatus: "not_serialized",
    lockedStatus: "not_generated",
    polarity: "negative",
    allowedUse: [],
    canPromoteToFormal: false,
    canUseAsFutureReference: false,
    formalLibraryIncluded: false,
  };
}

function authorityScopeFor(assetType: AssetLibraryAssetType, status: AssetLibraryStatus): string[] {
  if (status === "missing") return [];
  if (status === "rejected") return ["negative_prompt"];
  if (status === "candidate" || status === "review") return ["draft_preview"];
  if (assetType === "character") return ["identity", "prompt_reference", "future_reference"];
  if (assetType === "scene") return ["scene_layout", "prompt_reference", "future_reference"];
  if (assetType === "prop") return ["prop_continuity", "prompt_reference", "future_reference"];
  if (assetType === "voice_anchor") return ["voice_anchor", "prompt_reference", "future_reference"];
  return ["style", "prompt_reference", "future_reference"];
}

function buildReferenceAuthority(input: {
  id: string;
  assetType: AssetLibraryAssetType;
  status: AssetLibraryStatus;
  path?: string;
  rejectedReason?: string;
}): AssetLibraryReferenceAuthority {
  const mapping = statusMapping(input.status);
  return {
    id: `ref_${input.id}`,
    path: input.path || `visual_memory/${slug(input.id)}.json`,
    referenceRole: referenceRoleFor(input.assetType, input.status),
    authorityScope: authorityScopeFor(input.assetType, input.status),
    polarity: mapping.polarity,
    lockedStatus: mapping.lockedStatus,
    allowedUse: mapping.allowedUse,
    canPromoteToFormal: mapping.canPromoteToFormal,
    canUseAsFutureReference: mapping.canUseAsFutureReference,
    rejectedReason: input.status === "rejected" ? input.rejectedReason || "Rejected by asset authority review." : undefined,
    contaminationReason:
      input.status === "candidate" || input.status === "review"
        ? "Candidate/review assets are draft-only until explicitly locked."
        : input.status === "missing"
          ? "Missing asset has no usable reference authority."
          : undefined,
  };
}

function buildAsset(input: AddAssetLibraryAssetInput | (UpdateAssetLibraryAssetInput & AssetLibraryAsset), base?: AssetLibraryAsset): AssetLibraryAsset {
  const updatedAt = input.updatedAt || nowIso();
  const status = input.status || base?.status || "candidate";
  const sourceKind = input.sourceKind || base?.sourceKind || "user_import";
  const sourcePath =
    input.path !== undefined
      ? createAssetLibraryPathRef({
          path: input.path,
          origin: input.pathOrigin || "project_root_relative",
          importId: input.importId,
        })
      : base?.sourcePath;
  const mainReferencePath =
    status === "missing"
      ? undefined
      : sourcePath?.path || base?.mainReferencePath || `visual_memory/${slug(input.id || base?.id || "asset")}.json`;
  const mapping = statusMapping(status);
  const textConstraints = unique(input.textConstraints || base?.textConstraints || []);
  const sourceRefs = unique(input.sourceRefs || base?.sourceRefs || []);
  const usedByShotIds = unique(input.usedByShotIds || base?.usedByShotIds || []);
  const assetType = input.assetType || base?.assetType || "prop";
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!textConstraints.length) blockers.push("Asset Library anchors require text constraints; this is not a gallery image.");
  if (status === "candidate" || status === "review") warnings.push("Candidate/review asset is draft-only and cannot be used as future reference authority.");
  if (status === "missing") warnings.push("Missing asset is tracked as a placeholder and is not serialized into Visual Memory assets.");
  const referenceAuthority = buildReferenceAuthority({
    id: input.id || base?.id || "asset",
    assetType,
    status,
    path: mainReferencePath,
    rejectedReason: input.rejectedReason || base?.referenceAuthority.rejectedReason,
  });

  return {
    id: input.id || base?.id || "asset",
    assetType,
    name: input.name || base?.name || input.id || base?.id || "Asset",
    status,
    visualMemoryStatus: mapping.visualMemoryStatus,
    originKind: originKindFor(sourceKind),
    sourceKind,
    sourcePath,
    mainReferencePath,
    referenceAuthority,
    textConstraints,
    sourceRefs,
    usedByShotIds,
    canPromoteToFormal: mapping.canPromoteToFormal,
    canUseAsFutureReference: mapping.canUseAsFutureReference,
    formalLibraryIncluded: mapping.formalLibraryIncluded,
    galleryItem: false,
    blockers,
    warnings,
    updatedAt,
  };
}

function validationFor(library: AssetLibrarySnapshot, checkedAt: string): AssetLibraryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (library.libraryPurpose !== "asset_consistency_memory") errors.push("Asset Library must be asset_consistency_memory.");
  if (library.referenceAuthorityPolicy.assetLibraryIsGallery !== false) errors.push("Asset Library must not be modeled as a gallery.");
  if (library.referenceAuthorityPolicy.tempOutputAutoPromote !== false) errors.push("Temp outputs must not auto-promote.");
  if (library.referenceAuthorityPolicy.localPostprocessCanSemanticRepair !== false) errors.push("Local postprocess cannot semantic-repair assets.");
  if (library.hardLocks.noFileMutation !== true) errors.push("Asset CRUD must not mutate files.");
  if (library.hardLocks.noProviderSubmit !== true) errors.push("Asset CRUD must not submit providers.");
  if (library.hardLocks.noTempOutputPromotion !== true) errors.push("Temp output promotion hard lock must be true.");
  if (library.hardLocks.assetLibraryIsNotGallery !== true) errors.push("Asset Library not-gallery hard lock must be true.");

  for (const asset of library.assets) {
    if (asset.galleryItem !== false) errors.push(`${asset.id} must not be a gallery item.`);
    if (!asset.textConstraints.length && asset.status !== "missing") errors.push(`${asset.id} must include text constraints.`);
    if (asset.sourcePath) {
      if (!["project_root_relative", "user_selected_import"].includes(asset.sourcePath.origin)) {
        errors.push(`${asset.id} has unsupported path origin.`);
      }
      if (isAbsoluteLike(asset.sourcePath.path)) errors.push(`${asset.id} must not store an absolute path.`);
      if (hasParentTraversal(asset.sourcePath.path)) errors.push(`${asset.id} must not contain parent traversal.`);
      if (asset.sourcePath.origin === "user_selected_import" && (!asset.sourcePath.rawPathRedacted || !asset.sourcePath.importId)) {
        errors.push(`${asset.id} user-selected import must be redacted.`);
      }
    }
    if (asset.mainReferencePath && (isAbsoluteLike(asset.mainReferencePath) || hasParentTraversal(asset.mainReferencePath))) {
      errors.push(`${asset.id} mainReferencePath must be portable and project-root-relative.`);
    }
    if (asset.referenceAuthority.path && (isAbsoluteLike(asset.referenceAuthority.path) || hasParentTraversal(asset.referenceAuthority.path))) {
      errors.push(`${asset.id} referenceAuthority.path must be portable.`);
    }
    if ((asset.status === "candidate" || asset.status === "review") && asset.canUseAsFutureReference) {
      errors.push(`${asset.id} candidate/review asset cannot be a future reference.`);
    }
    if (asset.status === "missing" && asset.formalLibraryIncluded) {
      errors.push(`${asset.id} missing asset cannot be included in formal Visual Memory.`);
    }
    if (isForbiddenSource({ sourceKind: asset.sourceKind, path: asset.mainReferencePath || asset.sourcePath?.path })) {
      errors.push(`${asset.id} uses a forbidden source for formal Asset Library.`);
    }
    warnings.push(...asset.warnings.map((warning) => `${asset.id}: ${warning}`));
  }

  for (const pack of library.sceneAssetPacks) {
    if (pack.inheritanceRules.masterInheritanceRequired !== true) errors.push(`${pack.id} must require master inheritance.`);
    if (pack.inheritanceRules.textOnlyViewRecreationAllowed !== false) errors.push(`${pack.id} must reject text-only view recreation.`);
    if (pack.inheritanceRules.unknownDerivationCanLock !== false) errors.push(`${pack.id} must not lock unknown derivations.`);
    for (const view of pack.derivedViews) {
      if (view.inheritsFromMaster !== true) errors.push(`${view.id} must inherit from master scene.`);
      if (!view.derivationEvidence.length) errors.push(`${view.id} requires derivation evidence.`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, checkedAt };
}

export function validateAssetLibrarySnapshot(library: AssetLibrarySnapshot, checkedAt = nowIso()): AssetLibraryValidationResult {
  return validationFor(library, checkedAt);
}

function blockedImport(input: AddAssetLibraryAssetInput | UpdateAssetLibraryAssetInput, reason: string, blockedAt: string): AssetLibraryBlockedImport {
  return {
    id: `blocked_${stableHash({ input, blockedAt }).replace(/^vck_/, "")}`,
    reason,
    sourceKind: input.sourceKind || "user_import",
    path: input.path,
    blockedAt,
  };
}

function upsertScenePackForAsset(library: AssetLibrarySnapshot, asset: AssetLibraryAsset): void {
  if (asset.assetType !== "scene" || asset.status === "missing") return;
  const existingIndex = library.sceneAssetPacks.findIndex((pack) => pack.sceneId === asset.id);
  const sceneStatus = asset.status === "locked" ? "locked" : asset.status === "rejected" ? "rejected" : "candidate";
  const readiness = asset.status === "locked" ? "ready_for_formal" : asset.status === "rejected" ? "blocked" : "draft_only";
  const pack: AssetLibrarySceneAssetPack = {
    schemaVersion,
    id: `scene_asset_pack_${slug(asset.id)}`,
    sceneId: asset.id,
    status: sceneStatus,
    masterScene: {
      id: `master_scene_${slug(asset.id)}`,
      status: sceneStatus,
      referenceAuthority: asset.referenceAuthority,
      worldCoordinateSystem: "project_scene_local_space",
      worldAnchors: [],
      cameraVectors: [
        {
          id: `camera_vector_${slug(asset.id)}_placeholder`,
          worldPosition: vector(),
          cameraVector: vector(0, 0, 1),
        },
      ],
      masterImageRefs: asset.mainReferencePath ? [asset.mainReferencePath] : [],
      textConstraints: asset.textConstraints,
    },
    derivedViews: existingIndex >= 0 ? library.sceneAssetPacks[existingIndex].derivedViews : [],
    assetRefs: [asset.id],
    readiness,
    inheritanceRules: {
      masterInheritanceRequired: true,
      textOnlyViewRecreationAllowed: false,
      unknownDerivationCanLock: false,
    },
    updatedAt: asset.updatedAt,
  };

  if (existingIndex >= 0) library.sceneAssetPacks[existingIndex] = pack;
  else library.sceneAssetPacks.push(pack);
}

export function addAssetLibraryAsset(baseLibrary: AssetLibrarySnapshot, input: AddAssetLibraryAssetInput): AssetLibraryMutationResult {
  const library = clone(baseLibrary);
  const updatedAt = input.updatedAt || nowIso();
  const forbiddenReason = isForbiddenSource(input);
  if (forbiddenReason) {
    const rejected = blockedImport(input, forbiddenReason, updatedAt);
    library.blockedImports.push(rejected);
    library.updatedAt = updatedAt;
    return {
      library,
      validation: validateAssetLibrarySnapshot(library, updatedAt),
      rejected,
    };
  }

  const asset = buildAsset({ ...input, updatedAt });
  const existingIndex = library.assets.findIndex((candidate) => candidate.id === asset.id);
  if (existingIndex >= 0) library.assets[existingIndex] = asset;
  else library.assets.push(asset);
  upsertScenePackForAsset(library, asset);
  library.updatedAt = updatedAt;
  return {
    library,
    asset,
    validation: validateAssetLibrarySnapshot(library, updatedAt),
  };
}

export function updateAssetLibraryAsset(
  baseLibrary: AssetLibrarySnapshot,
  assetId: string,
  input: UpdateAssetLibraryAssetInput,
): AssetLibraryMutationResult {
  const library = clone(baseLibrary);
  const updatedAt = input.updatedAt || nowIso();
  const existing = library.assets.find((asset) => asset.id === assetId);
  if (!existing) {
    const rejected: AssetLibraryBlockedImport = {
      id: `blocked_missing_${slug(assetId)}`,
      reason: `Asset ${assetId} does not exist.`,
      sourceKind: input.sourceKind || "manual_definition",
      path: input.path,
      blockedAt: updatedAt,
    };
    library.blockedImports.push(rejected);
    library.updatedAt = updatedAt;
    return { library, validation: validateAssetLibrarySnapshot(library, updatedAt), rejected };
  }

  const forbiddenReason = isForbiddenSource(input);
  if (forbiddenReason) {
    const rejected = blockedImport(input, forbiddenReason, updatedAt);
    library.blockedImports.push(rejected);
    library.updatedAt = updatedAt;
    return { library, asset: existing, validation: validateAssetLibrarySnapshot(library, updatedAt), rejected };
  }

  const asset = buildAsset({ ...existing, ...input, id: assetId, updatedAt }, existing);
  library.assets = library.assets.map((candidate) => (candidate.id === assetId ? asset : candidate));
  upsertScenePackForAsset(library, asset);
  library.updatedAt = updatedAt;
  return { library, asset, validation: validateAssetLibrarySnapshot(library, updatedAt) };
}

export function markAssetLibraryAssetStatus(
  baseLibrary: AssetLibrarySnapshot,
  assetId: string,
  status: AssetLibraryStatus,
  updatedAt = nowIso(),
): AssetLibraryMutationResult {
  return updateAssetLibraryAsset(baseLibrary, assetId, { status, updatedAt });
}

export function addSceneDerivedViewPlaceholder(
  baseLibrary: AssetLibrarySnapshot,
  input: {
    sceneId: string;
    viewId: string;
    status?: "locked" | "candidate" | "rejected";
    worldPosition?: Vector3;
    cameraVector?: Vector3;
    viewImageRefs?: string[];
    derivationEvidence?: string[];
    updatedAt?: string;
  },
): AssetLibraryMutationResult {
  const library = clone(baseLibrary);
  const updatedAt = input.updatedAt || nowIso();
  const pack = library.sceneAssetPacks.find((candidate) => candidate.sceneId === input.sceneId);
  if (!pack) {
    const rejected: AssetLibraryBlockedImport = {
      id: `blocked_scene_pack_${slug(input.sceneId)}`,
      reason: `Scene pack ${input.sceneId} does not exist.`,
      sourceKind: "manual_definition",
      blockedAt: updatedAt,
    };
    library.blockedImports.push(rejected);
    library.updatedAt = updatedAt;
    return { library, validation: validateAssetLibrarySnapshot(library, updatedAt), rejected };
  }

  const derivedView: AssetLibraryDerivedView = {
    id: input.viewId,
    status: input.status || "candidate",
    masterSceneId: pack.masterScene.id,
    inheritsFromMaster: true,
    inheritanceOverrides: [],
    worldPosition: input.worldPosition || vector(),
    cameraVector: input.cameraVector || vector(0, 0, 1),
    viewImageRefs: input.viewImageRefs || [],
    derivationEvidence: input.derivationEvidence || ["derived_view_placeholder_waiting_for_locked_view"],
  };

  const existingIndex = pack.derivedViews.findIndex((view) => view.id === input.viewId);
  if (existingIndex >= 0) pack.derivedViews[existingIndex] = derivedView;
  else pack.derivedViews.push(derivedView);
  pack.updatedAt = updatedAt;
  library.updatedAt = updatedAt;
  return { library, validation: validateAssetLibrarySnapshot(library, updatedAt) };
}

export function toVisualMemoryDocument(library: AssetLibrarySnapshot): VisualMemoryDocument {
  return {
    schemaVersion: library.schemaVersion,
    id: library.id,
    libraryPurpose: "asset_consistency_memory",
    referenceAuthorityPolicy: library.referenceAuthorityPolicy,
    v0Compatibility: library.v0Compatibility,
    assets: library.assets
      .filter((asset) => asset.formalLibraryIncluded && asset.visualMemoryStatus !== "not_serialized")
      .map((asset) => ({
        id: asset.id,
        assetType: asset.assetType,
        name: asset.name,
        status: asset.visualMemoryStatus as "locked" | "candidate" | "rejected",
        originKind: asset.originKind,
        referenceAuthority: asset.referenceAuthority,
        mainReferencePath: asset.mainReferencePath,
        textConstraints: asset.textConstraints,
        sourceRefs: asset.sourceRefs,
        usedByShotIds: asset.usedByShotIds,
        canPromoteToFormal: asset.canPromoteToFormal,
        canUseAsFutureReference: asset.canUseAsFutureReference,
        rejectedReason: asset.referenceAuthority.rejectedReason,
      })),
    updatedAt: library.updatedAt,
  };
}

export function toSceneAssetPackDocuments(library: AssetLibrarySnapshot): AssetLibrarySceneAssetPack[] {
  return clone(library.sceneAssetPacks);
}
