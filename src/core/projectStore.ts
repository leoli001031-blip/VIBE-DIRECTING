export type ProjectStorePathOrigin = "project_root_relative" | "user_selected_import";

export type ProjectStoreFactRole =
  | "project_manifest"
  | "production_bible"
  | "story_flow"
  | "visual_memory"
  | "shot_spec"
  | "shot_layout"
  | "spatial_memory"
  | "scene_asset_pack"
  | "voice_memory"
  | "source_index"
  | "runtime_state";

export type ProjectStorePlanOperation = "read" | "write";

export interface ProjectStorePathRef {
  path: string;
  origin: ProjectStorePathOrigin;
  importId?: string;
  rawPathRedacted?: true;
  sourceRef?: string;
  notes: string[];
}

export interface ProjectStoreFactFile {
  id: string;
  role: ProjectStoreFactRole;
  path: ProjectStorePathRef;
  format: "json";
  required: boolean;
  sourceOfTruth: "project_file" | "derived_cache";
  hash: string;
  status: "fixture_snapshot" | "planned";
  notes: string[];
}

export interface ProjectStoreReadWritePlanEntry {
  id: string;
  factFileId: string;
  role: ProjectStoreFactRole;
  operation: ProjectStorePlanOperation;
  path: ProjectStorePathRef;
  execution: "dry_run_plan_only";
  canExecute: false;
  noFileMutation: true;
  notes: string[];
}

export interface ProjectStoreRuntimeCachePolicy {
  runtimeStateRole: "derived_cache";
  runtimeStateMayBeRebuilt: true;
  runtimeStateIsSoleSourceOfTruth: false;
  cacheId: string;
  cacheKeys: {
    sourceIndexHash: string;
    projectVersion: string;
    generatedAt: string;
    factHash: string;
  };
  rebuildInputs: ProjectStoreFactRole[];
  invalidationRefs: string[];
  notes: string[];
}

export interface ProjectStoreHardLocks {
  dryRunOnly: true;
  inMemoryOnly: true;
  noFileMutation: true;
  noDirectoryCreate: true;
  noDirectoryMove: true;
  noDirectoryDelete: true;
  noUserFileMove: true;
  noProviderSubmit: true;
  noImageGeneration: true;
  noVideoGeneration: true;
  noCredentialRead: true;
  noCredentialWrite: true;
  projectVibeWriteAllowed: false;
  runtimeStateIsDerivedCache: true;
}

export interface ProjectStorePathPolicy {
  allowedOrigins: ProjectStorePathOrigin[];
  projectRootRelativeRequired: true;
  userSelectedImportAllowed: true;
  hardcodedAbsolutePathContractForbidden: true;
  platformSpecificPathContractForbidden: true;
  parentTraversalForbidden: true;
  rawUserImportPathRedactionRequired: true;
  notes: string[];
}

export interface ProjectStoreSnapshot {
  schemaVersion: string;
  phase: "phase_9_5_project_store";
  createdAt: string;
  updatedAt: string;
  revision: number;
  project: {
    id: string;
    title: string;
    version: string;
    root: {
      rootRef: "project_root";
      selectedImport?: ProjectStorePathRef;
      notes: string[];
    };
  };
  projectFile: {
    fileName: "project.vibe";
    path: ProjectStorePathRef;
    entryKind: "project_entry";
    status: "fixture_only_not_written";
    format: "json";
    notes: string[];
  };
  pathPolicy: ProjectStorePathPolicy;
  hardLocks: ProjectStoreHardLocks;
  facts: {
    projectManifest: Record<string, unknown>;
    productionBible?: Record<string, unknown>;
    storyFlow: Record<string, unknown>;
    visualMemory: Record<string, unknown>;
    shotSpecs: Array<{
      shotId: string;
      path: ProjectStorePathRef;
      value: Record<string, unknown>;
    }>;
    shotLayouts?: Array<{
      shotId: string;
      path: ProjectStorePathRef;
      value: Record<string, unknown>;
    }>;
    spatialMemory?: Record<string, unknown>;
    sceneAssetPacks?: Array<{
      packId: string;
      path: ProjectStorePathRef;
      value: Record<string, unknown>;
    }>;
    voiceMemory?: Record<string, unknown>;
    sourceIndex?: Record<string, unknown>;
  };
  factFiles: ProjectStoreFactFile[];
  readWritePlan: ProjectStoreReadWritePlanEntry[];
  runtimeCachePolicy: ProjectStoreRuntimeCachePolicy;
  mutationLog: string[];
  notes: string[];
}

export interface CreateProjectStoreSnapshotInput {
  generatedAt?: string;
  projectId?: string;
  title?: string;
  version?: string;
  selectedImportPath?: string;
  selectedImportId?: string;
  projectManifest?: Record<string, unknown>;
  productionBible?: Record<string, unknown>;
  storyFlow?: Record<string, unknown>;
  visualMemory?: Record<string, unknown>;
  shotSpecs?: Array<{
    shotId: string;
    path?: string;
    value: Record<string, unknown>;
  }>;
  shotLayouts?: Array<{
    shotId: string;
    path?: string;
    value: Record<string, unknown>;
  }>;
  spatialMemory?: Record<string, unknown>;
  sceneAssetPacks?: Array<{
    packId: string;
    path?: string;
    value: Record<string, unknown>;
  }>;
  voiceMemory?: Record<string, unknown>;
  sourceIndex?: Record<string, unknown>;
  sourceIndexHash?: string;
}

export type ProjectStorePatchOperation =
  | { op: "set_project_manifest"; value: Record<string, unknown> }
  | { op: "set_production_bible"; value: Record<string, unknown> }
  | { op: "set_story_flow"; value: Record<string, unknown> }
  | { op: "set_visual_memory"; value: Record<string, unknown> }
  | { op: "set_source_index"; value: Record<string, unknown>; sourceIndexHash?: string }
  | { op: "set_project_version"; version: string }
  | { op: "upsert_shot_spec"; shotId: string; value: Record<string, unknown>; path?: string }
  | { op: "remove_shot_spec"; shotId: string };

export interface ProjectStorePatch {
  id: string;
  appliedAt?: string;
  operations: ProjectStorePatchOperation[];
}

export interface ProjectStoreValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checkedAt: string;
}

export interface ProjectStoreOpenResult {
  snapshot: ProjectStoreSnapshot;
  validation: ProjectStoreValidationResult;
  openedFrom: "memory_fixture";
  noFileRead: true;
}

export interface ProjectStoreSavePlan {
  id: string;
  plannedAt: string;
  mode: "memory_snapshot_only";
  noFileMutation: true;
  projectVibeWriteAllowed: false;
  entries: ProjectStoreReadWritePlanEntry[];
  notes: string[];
}

export interface ProjectStoreSaveResult {
  snapshot: ProjectStoreSnapshot;
  savePlan: ProjectStoreSavePlan;
  validation: ProjectStoreValidationResult;
}

export interface ProjectStorePatchResult {
  snapshot: ProjectStoreSnapshot;
  validation: ProjectStoreValidationResult;
  appliedOperationCount: number;
  rejectedOperations: string[];
}

export interface DeriveRuntimeCachePolicyInput {
  generatedAt: string;
  projectVersion: string;
  sourceIndexHash?: string;
  factFiles?: ProjectStoreFactFile[];
  facts?: Record<string, unknown>;
}

const schemaVersion = "0.1.0";
const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/])/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;

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

function isAbsoluteLike(value: string): boolean {
  return absolutePathPattern.test(value.trim());
}

function hasParentTraversal(value: string): boolean {
  return parentTraversalPattern.test(normalizeSlashes(value));
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
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_/-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "untitled";
}

export function createProjectStorePathRef(input: {
  path: string;
  origin?: ProjectStorePathOrigin;
  importId?: string;
  sourceRef?: string;
  notes?: string[];
}): ProjectStorePathRef {
  const origin = input.origin || "project_root_relative";
  const rawPath = input.path.trim();
  const normalized = normalizeSlashes(rawPath);
  const notes = [...(input.notes || [])];

  if (origin === "user_selected_import") {
    const importId = slug(input.importId || stableHash(normalized).replace(/^vck_/, "import_"));
    return {
      path: `user_selected_import/${importId}`,
      origin,
      importId,
      rawPathRedacted: true,
      sourceRef: input.sourceRef,
      notes: [
        ...notes,
        "Raw user-selected import path is redacted from the portable project contract.",
        "Resolve this path through the future runtime path resolver, not through a persisted absolute path.",
      ],
    };
  }

  return {
    path: isAbsoluteLike(normalized) ? normalized : trimOuterSlashes(normalized),
    origin: "project_root_relative",
    sourceRef: input.sourceRef,
    notes: [...notes, "Project Store stores this as a project-root-relative path."],
  };
}

function defaultHardLocks(): ProjectStoreHardLocks {
  return {
    dryRunOnly: true,
    inMemoryOnly: true,
    noFileMutation: true,
    noDirectoryCreate: true,
    noDirectoryMove: true,
    noDirectoryDelete: true,
    noUserFileMove: true,
    noProviderSubmit: true,
    noImageGeneration: true,
    noVideoGeneration: true,
    noCredentialRead: true,
    noCredentialWrite: true,
    projectVibeWriteAllowed: false,
    runtimeStateIsDerivedCache: true,
  };
}

function defaultPathPolicy(): ProjectStorePathPolicy {
  return {
    allowedOrigins: ["project_root_relative", "user_selected_import"],
    projectRootRelativeRequired: true,
    userSelectedImportAllowed: true,
    hardcodedAbsolutePathContractForbidden: true,
    platformSpecificPathContractForbidden: true,
    parentTraversalForbidden: true,
    rawUserImportPathRedactionRequired: true,
    notes: [
      "Portable project facts use project-root-relative paths.",
      "User-selected imports are recorded as redacted import tokens until a runtime resolver can map them.",
    ],
  };
}

function defaultStoryFlow(projectId: string, generatedAt: string): Record<string, unknown> {
  return {
    schemaVersion,
    id: `${projectId}_story_flow`,
    productionBibleId: `${projectId}_production_bible`,
    sectionModel: "adaptive",
    sections: [
      {
        id: "section_0",
        label: "Project Section",
        sectionKind: "custom",
        sequenceIndex: 0,
        storyFunction: "Project-defined story section placeholder.",
        beats: [],
        shots: [],
      },
    ],
    shotOrder: [],
    sourceRefs: ["project_store.fixture"],
    updatedAt: generatedAt,
  };
}

function defaultVisualMemory(projectId: string, generatedAt: string): Record<string, unknown> {
  return {
    schemaVersion,
    id: `${projectId}_visual_memory`,
    libraryPurpose: "asset_consistency_memory",
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
    assets: [],
    updatedAt: generatedAt,
  };
}

function makeFactFile(
  role: ProjectStoreFactRole,
  id: string,
  path: string,
  value: unknown,
  required = true,
  sourceOfTruth: ProjectStoreFactFile["sourceOfTruth"] = "project_file",
): ProjectStoreFactFile {
  return {
    id,
    role,
    path: createProjectStorePathRef({ path, sourceRef: id }),
    format: "json",
    required,
    sourceOfTruth,
    hash: stableHash(value),
    status: "fixture_snapshot",
    notes:
      role === "runtime_state"
        ? ["Runtime state is a derived cache and not a project fact source of truth."]
        : ["This file is represented in memory only; no project file is written by Project Store in Phase 9.5."],
  };
}

function shotSpecPath(shotId: string): string {
  return `shots/${slug(shotId)}/shot_spec.vibe.json`;
}

function shotLayoutPath(shotId: string): string {
  return `shots/${slug(shotId)}/shot_layout.vibe.json`;
}

function sceneAssetPackPath(packId: string): string {
  return `visual_memory/scene_asset_packs/${slug(packId)}.vibe.json`;
}

function rebuildFactFiles(snapshot: ProjectStoreSnapshot): ProjectStoreFactFile[] {
  const factFiles = [
    makeFactFile("project_manifest", "project_manifest", "project.vibe", snapshot.facts.projectManifest),
    makeFactFile("production_bible", "production_bible", "production_bible/production_bible.vibe.json", snapshot.facts.productionBible || {}, false),
    makeFactFile("story_flow", "story_flow", "story_flow/story_flow.vibe.json", snapshot.facts.storyFlow),
    makeFactFile("visual_memory", "visual_memory", "visual_memory/visual_memory.vibe.json", snapshot.facts.visualMemory),
    makeFactFile("source_index", "source_index", "manifests/source_index.vibe.json", snapshot.facts.sourceIndex || {}, false),
    makeFactFile("runtime_state", "runtime_state", "runtime-state.json", snapshot.runtimeCachePolicy || {}, false, "derived_cache"),
  ];

  for (const shot of snapshot.facts.shotSpecs) {
    factFiles.push({
      ...makeFactFile("shot_spec", `shot_spec_${slug(shot.shotId)}`, shot.path.path || shotSpecPath(shot.shotId), shot.value),
      path: shot.path,
    });
  }

  for (const layout of snapshot.facts.shotLayouts || []) {
    factFiles.push({
      ...makeFactFile("shot_layout", `shot_layout_${slug(layout.shotId)}`, layout.path.path || shotLayoutPath(layout.shotId), layout.value),
      path: layout.path,
    });
  }

  if (snapshot.facts.spatialMemory) {
    factFiles.push(makeFactFile("spatial_memory", "spatial_memory", "spatial_memory/spatial_memory.vibe.json", snapshot.facts.spatialMemory));
  }

  for (const pack of snapshot.facts.sceneAssetPacks || []) {
    factFiles.push({
      ...makeFactFile("scene_asset_pack", `scene_asset_pack_${slug(pack.packId)}`, pack.path.path || sceneAssetPackPath(pack.packId), pack.value),
      path: pack.path,
    });
  }

  if (snapshot.facts.voiceMemory) {
    factFiles.push(makeFactFile("voice_memory", "voice_memory", "voice_memory/voice_memory.vibe.json", snapshot.facts.voiceMemory));
  }

  return factFiles;
}

function createReadWritePlan(factFiles: ProjectStoreFactFile[]): ProjectStoreReadWritePlanEntry[] {
  return factFiles.flatMap((factFile) =>
    (["read", "write"] as const).map((operation) => ({
      id: `${operation}_${factFile.id}`,
      factFileId: factFile.id,
      role: factFile.role,
      operation,
      path: factFile.path,
      execution: "dry_run_plan_only" as const,
      canExecute: false as const,
      noFileMutation: true as const,
      notes: [
        operation === "read"
          ? "Read is modeled as a fixture/memory lookup in Phase 9.5."
          : "Write is a dry-run plan only; no project.vibe or user file is modified.",
      ],
    })),
  );
}

function sourceIndexHashFrom(snapshot: ProjectStoreSnapshot): string {
  const sourceIndex = snapshot.facts.sourceIndex;
  const explicit = typeof sourceIndex?.sourceIndexHash === "string" ? sourceIndex.sourceIndexHash.trim() : "";
  return explicit || stableHash({
    projectManifest: snapshot.facts.projectManifest,
    storyFlow: snapshot.facts.storyFlow,
    visualMemory: snapshot.facts.visualMemory,
    shotSpecs: snapshot.facts.shotSpecs.map((shot) => shot.value),
    shotLayouts: (snapshot.facts.shotLayouts || []).map((layout) => layout.value),
    spatialMemory: snapshot.facts.spatialMemory,
    sceneAssetPacks: (snapshot.facts.sceneAssetPacks || []).map((pack) => pack.value),
    voiceMemory: snapshot.facts.voiceMemory,
  });
}

export function deriveRuntimeCachePolicy(input: ProjectStoreSnapshot | DeriveRuntimeCachePolicyInput): ProjectStoreRuntimeCachePolicy {
  const generatedAt = "updatedAt" in input ? input.updatedAt : input.generatedAt;
  const projectVersion = "project" in input ? input.project.version : input.projectVersion;
  const factFiles: ProjectStoreFactFile[] = ("factFiles" in input ? input.factFiles : input.factFiles) || [];
  const sourceIndexHash = "project" in input ? sourceIndexHashFrom(input) : input.sourceIndexHash || stableHash(input.facts || factFiles);
  const factHash = stableHash(
    factFiles.map((factFile) => ({
      id: factFile.id,
      role: factFile.role,
      hash: factFile.hash,
      path: factFile.path.path,
    })),
  );
  const rebuildInputs = Array.from(
    new Set(factFiles.filter((factFile) => factFile.sourceOfTruth === "project_file").map((factFile) => factFile.role)),
  );

  return {
    runtimeStateRole: "derived_cache",
    runtimeStateMayBeRebuilt: true,
    runtimeStateIsSoleSourceOfTruth: false,
    cacheId: `runtime_cache_${stableHash({ sourceIndexHash, projectVersion, factHash }).replace(/^vck_/, "")}`,
    cacheKeys: {
      sourceIndexHash,
      projectVersion,
      generatedAt,
      factHash,
    },
    rebuildInputs,
    invalidationRefs: Array.from(new Set([sourceIndexHash, ...factFiles.map((factFile) => factFile.hash)])).sort(),
    notes: [
      "Runtime state is derived from project.vibe, story_flow, visual_memory, shot specs, and manifest facts.",
      "Changing any project fact invalidates this cache; runtime-state cannot override file-first project facts.",
    ],
  };
}

export function createProjectStoreSnapshot(input: CreateProjectStoreSnapshotInput = {}): ProjectStoreSnapshot {
  const generatedAt = input.generatedAt || nowIso();
  const projectId = slug(input.projectId || "project");
  const version = input.version || "0.1.0";
  const projectManifest = input.projectManifest || {
    schemaVersion,
    id: projectId,
    title: input.title || "Untitled Project",
    version,
    entryFile: "project.vibe",
    sourceRefs: ["project_store.fixture"],
    updatedAt: generatedAt,
  };
  const selectedImport = input.selectedImportPath
    ? createProjectStorePathRef({
        path: input.selectedImportPath,
        origin: "user_selected_import",
        importId: input.selectedImportId || `${projectId}_root`,
        sourceRef: "project.selectedImport",
      })
    : undefined;
  const shotSpecs = (input.shotSpecs || []).map((shot) => ({
    shotId: shot.shotId,
    path: createProjectStorePathRef({ path: shot.path || shotSpecPath(shot.shotId), sourceRef: `shotSpecs.${shot.shotId}` }),
    value: clone(shot.value),
  }));
  const shotLayouts = (input.shotLayouts || []).map((layout) => ({
    shotId: layout.shotId,
    path: createProjectStorePathRef({ path: layout.path || shotLayoutPath(layout.shotId), sourceRef: `shotLayouts.${layout.shotId}` }),
    value: clone(layout.value),
  }));
  const sceneAssetPacks = (input.sceneAssetPacks || []).map((pack) => ({
    packId: pack.packId,
    path: createProjectStorePathRef({ path: pack.path || sceneAssetPackPath(pack.packId), sourceRef: `sceneAssetPacks.${pack.packId}` }),
    value: clone(pack.value),
  }));
  const snapshot: ProjectStoreSnapshot = {
    schemaVersion,
    phase: "phase_9_5_project_store",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    revision: 1,
    project: {
      id: projectId,
      title: input.title || String(projectManifest.title || "Untitled Project"),
      version,
      root: {
        rootRef: "project_root",
        selectedImport,
        notes: ["Project root is a logical root. The raw selected folder path is not persisted in the portable contract."],
      },
    },
    projectFile: {
      fileName: "project.vibe",
      path: createProjectStorePathRef({ path: "project.vibe", sourceRef: "projectFile" }),
      entryKind: "project_entry",
      status: "fixture_only_not_written",
      format: "json",
      notes: ["project.vibe is the entry structure for the file-first model, but Phase 9.5 only models it in memory."],
    },
    pathPolicy: defaultPathPolicy(),
    hardLocks: defaultHardLocks(),
    facts: {
      projectManifest: clone(projectManifest),
      productionBible: input.productionBible ? clone(input.productionBible) : undefined,
      storyFlow: input.storyFlow ? clone(input.storyFlow) : defaultStoryFlow(projectId, generatedAt),
      visualMemory: input.visualMemory ? clone(input.visualMemory) : defaultVisualMemory(projectId, generatedAt),
      shotSpecs,
      shotLayouts,
      spatialMemory: input.spatialMemory ? clone(input.spatialMemory) : undefined,
      sceneAssetPacks,
      voiceMemory: input.voiceMemory ? clone(input.voiceMemory) : undefined,
      sourceIndex: input.sourceIndex ? { ...clone(input.sourceIndex), sourceIndexHash: input.sourceIndexHash || input.sourceIndex.sourceIndexHash } : undefined,
    },
    factFiles: [],
    readWritePlan: [],
    runtimeCachePolicy: deriveRuntimeCachePolicy({
      generatedAt,
      projectVersion: version,
      sourceIndexHash: input.sourceIndexHash,
      factFiles: [],
      facts: { projectManifest },
    }),
    mutationLog: ["snapshot_created_in_memory"],
    notes: [
      "Project Store is file-first in shape, but this implementation is memory/fixture only.",
      "No directories, user files, provider jobs, credentials, images, or videos are created, moved, deleted, or submitted.",
    ],
  };

  snapshot.factFiles = rebuildFactFiles(snapshot);
  snapshot.runtimeCachePolicy = deriveRuntimeCachePolicy(snapshot);
  snapshot.readWritePlan = createReadWritePlan(snapshot.factFiles);
  return snapshot;
}

function validatePathRef(pathRef: ProjectStorePathRef | undefined, label: string, errors: string[]): void {
  if (!pathRef) return;
  if (!["project_root_relative", "user_selected_import"].includes(pathRef.origin)) {
    errors.push(`${label} has unsupported path origin: ${String(pathRef.origin)}.`);
  }
  if (!pathRef.path || !pathRef.path.trim()) errors.push(`${label} path is required.`);
  if (isAbsoluteLike(pathRef.path)) errors.push(`${label} must not store an absolute platform path.`);
  if (hasParentTraversal(pathRef.path)) errors.push(`${label} must not contain parent traversal.`);
  if (pathRef.origin === "project_root_relative" && pathRef.rawPathRedacted) {
    errors.push(`${label} project-root-relative path must not be a redacted import token.`);
  }
  if (pathRef.origin === "user_selected_import" && (!pathRef.rawPathRedacted || !pathRef.importId)) {
    errors.push(`${label} user-selected import must be represented by a redacted import token.`);
  }
}

export function validateProjectStoreSnapshot(snapshot: ProjectStoreSnapshot, checkedAt = nowIso()): ProjectStoreValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (snapshot.phase !== "phase_9_5_project_store") errors.push("snapshot phase must be phase_9_5_project_store.");
  if (snapshot.projectFile.fileName !== "project.vibe") errors.push("project file entry must be project.vibe.");
  if (snapshot.projectFile.status !== "fixture_only_not_written") errors.push("project.vibe must remain fixture-only and not written.");
  validatePathRef(snapshot.projectFile.path, "projectFile.path", errors);
  validatePathRef(snapshot.project.root.selectedImport, "project.root.selectedImport", errors);

  const locks = snapshot.hardLocks;
  const requiredTrueLocks: Array<keyof ProjectStoreHardLocks> = [
    "dryRunOnly",
    "inMemoryOnly",
    "noFileMutation",
    "noDirectoryCreate",
    "noDirectoryMove",
    "noDirectoryDelete",
    "noUserFileMove",
    "noProviderSubmit",
    "noImageGeneration",
    "noVideoGeneration",
    "noCredentialRead",
    "noCredentialWrite",
    "runtimeStateIsDerivedCache",
  ];
  for (const key of requiredTrueLocks) {
    if (locks[key] !== true) errors.push(`hard lock ${key} must be true.`);
  }
  if (locks.projectVibeWriteAllowed !== false) errors.push("projectVibeWriteAllowed must remain false.");

  for (const factFile of snapshot.factFiles) {
    validatePathRef(factFile.path, `factFiles.${factFile.id}.path`, errors);
    if (factFile.role !== "runtime_state" && factFile.sourceOfTruth !== "project_file") {
      errors.push(`${factFile.id} must remain a project-file source of truth.`);
    }
    if (factFile.role === "runtime_state" && factFile.sourceOfTruth !== "derived_cache") {
      errors.push("runtime_state fact file must be marked derived_cache.");
    }
  }

  for (const entry of snapshot.readWritePlan) {
    validatePathRef(entry.path, `readWritePlan.${entry.id}.path`, errors);
    if (entry.canExecute !== false) errors.push(`${entry.id} must not be executable.`);
    if (entry.noFileMutation !== true) errors.push(`${entry.id} must preserve noFileMutation.`);
    if (entry.execution !== "dry_run_plan_only") errors.push(`${entry.id} must be dry-run plan only.`);
  }

  if (snapshot.runtimeCachePolicy.runtimeStateRole !== "derived_cache") errors.push("runtime cache role must be derived_cache.");
  if (snapshot.runtimeCachePolicy.runtimeStateIsSoleSourceOfTruth !== false) {
    errors.push("runtime state must not be the sole source of truth.");
  }
  if (!snapshot.runtimeCachePolicy.rebuildInputs.includes("project_manifest")) {
    errors.push("runtime cache rebuild inputs must include project_manifest.");
  }
  if (!snapshot.runtimeCachePolicy.rebuildInputs.includes("story_flow")) {
    errors.push("runtime cache rebuild inputs must include story_flow.");
  }
  if (!snapshot.runtimeCachePolicy.rebuildInputs.includes("visual_memory")) {
    errors.push("runtime cache rebuild inputs must include visual_memory.");
  }
  if (!snapshot.facts.shotSpecs.length) warnings.push("No shot specs are present yet; Project Store remains a skeleton fixture.");

  return { ok: errors.length === 0, errors, warnings, checkedAt };
}

export function openProjectStoreSnapshot(input: string | ProjectStoreSnapshot, checkedAt = nowIso()): ProjectStoreOpenResult {
  const snapshot = typeof input === "string" ? (JSON.parse(input) as ProjectStoreSnapshot) : clone(input);
  return {
    snapshot,
    validation: validateProjectStoreSnapshot(snapshot, checkedAt),
    openedFrom: "memory_fixture",
    noFileRead: true,
  };
}

export function applyProjectStorePatch(
  baseSnapshot: ProjectStoreSnapshot,
  patch: ProjectStorePatch,
): ProjectStorePatchResult {
  const snapshot = clone(baseSnapshot);
  const rejectedOperations: string[] = [];
  const appliedAt = patch.appliedAt || nowIso();
  let appliedOperationCount = 0;

  for (const operation of patch.operations) {
    switch (operation.op) {
      case "set_project_manifest":
        snapshot.facts.projectManifest = clone(operation.value);
        appliedOperationCount += 1;
        break;
      case "set_production_bible":
        snapshot.facts.productionBible = clone(operation.value);
        appliedOperationCount += 1;
        break;
      case "set_story_flow":
        snapshot.facts.storyFlow = clone(operation.value);
        appliedOperationCount += 1;
        break;
      case "set_visual_memory":
        snapshot.facts.visualMemory = clone(operation.value);
        appliedOperationCount += 1;
        break;
      case "set_source_index":
        snapshot.facts.sourceIndex = { ...clone(operation.value), sourceIndexHash: operation.sourceIndexHash || operation.value.sourceIndexHash };
        appliedOperationCount += 1;
        break;
      case "set_project_version":
        snapshot.project.version = operation.version;
        snapshot.facts.projectManifest = { ...snapshot.facts.projectManifest, version: operation.version };
        appliedOperationCount += 1;
        break;
      case "upsert_shot_spec": {
        const path = createProjectStorePathRef({ path: operation.path || shotSpecPath(operation.shotId), sourceRef: `patch.${patch.id}` });
        const pathErrors: string[] = [];
        validatePathRef(path, `patch.${patch.id}.${operation.shotId}`, pathErrors);
        if (pathErrors.length) {
          rejectedOperations.push(`${operation.op}:${operation.shotId}:${pathErrors.join("|")}`);
          break;
        }
        const existingIndex = snapshot.facts.shotSpecs.findIndex((shot) => shot.shotId === operation.shotId);
        const nextShot = { shotId: operation.shotId, path, value: clone(operation.value) };
        if (existingIndex >= 0) snapshot.facts.shotSpecs[existingIndex] = nextShot;
        else snapshot.facts.shotSpecs.push(nextShot);
        appliedOperationCount += 1;
        break;
      }
      case "remove_shot_spec":
        snapshot.facts.shotSpecs = snapshot.facts.shotSpecs.filter((shot) => shot.shotId !== operation.shotId);
        appliedOperationCount += 1;
        break;
      default:
        rejectedOperations.push(`unknown_operation:${String((operation as { op?: unknown }).op)}`);
    }
  }

  snapshot.updatedAt = appliedAt;
  snapshot.revision += 1;
  snapshot.mutationLog = [...snapshot.mutationLog, `patch:${patch.id}:operations:${appliedOperationCount}`];
  snapshot.factFiles = rebuildFactFiles(snapshot);
  snapshot.runtimeCachePolicy = deriveRuntimeCachePolicy(snapshot);
  snapshot.readWritePlan = createReadWritePlan(snapshot.factFiles);

  return {
    snapshot,
    validation: validateProjectStoreSnapshot(snapshot, appliedAt),
    appliedOperationCount,
    rejectedOperations,
  };
}

export function saveProjectStoreSnapshot(snapshot: ProjectStoreSnapshot, plannedAt = nowIso()): ProjectStoreSaveResult {
  const nextSnapshot = clone(snapshot);
  nextSnapshot.updatedAt = plannedAt;
  nextSnapshot.revision += 1;
  nextSnapshot.factFiles = rebuildFactFiles(nextSnapshot);
  nextSnapshot.runtimeCachePolicy = deriveRuntimeCachePolicy(nextSnapshot);
  nextSnapshot.readWritePlan = createReadWritePlan(nextSnapshot.factFiles);
  nextSnapshot.mutationLog = [...nextSnapshot.mutationLog, "save_planned_memory_only"];

  const savePlan: ProjectStoreSavePlan = {
    id: `project_store_save_${stableHash({ plannedAt, revision: nextSnapshot.revision }).replace(/^vck_/, "")}`,
    plannedAt,
    mode: "memory_snapshot_only",
    noFileMutation: true,
    projectVibeWriteAllowed: false,
    entries: nextSnapshot.readWritePlan.filter((entry) => entry.operation === "write"),
    notes: [
      "This save result is a plan and an updated in-memory snapshot only.",
      "No filesystem write, directory creation, project.vibe write, user-file move, credential access, or provider submit occurs.",
    ],
  };

  return {
    snapshot: nextSnapshot,
    savePlan,
    validation: validateProjectStoreSnapshot(nextSnapshot, plannedAt),
  };
}
