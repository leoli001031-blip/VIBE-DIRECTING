import {
  applyProjectStorePatch,
  createProjectStoreSnapshot,
  deriveRuntimeCachePolicy,
  openProjectStoreSnapshot,
  saveProjectStoreSnapshot,
  validateProjectStoreSnapshot,
  type ProjectStoreFactFile,
  type ProjectStoreFactRole,
  type ProjectStoreHardLocks,
  type ProjectStorePatchOperation,
  type ProjectStorePathRef,
  type ProjectStoreReadWritePlanEntry,
  type ProjectStoreRuntimeCachePolicy,
  type ProjectStoreSnapshot,
  type ProjectStoreValidationResult,
} from "./projectStore";

export type ProjectRuntimeMode = "create" | "open" | "save" | "rebuild";
export type ProjectRuntimeSourceOfTruth = "project_files" | "runtime_state";

export interface ProjectRuntimeShotSpecInput {
  shotId: string;
  path?: string;
  value: Record<string, unknown>;
}

export interface ProjectRuntimeBuildInput {
  mode?: ProjectRuntimeMode;
  projectId?: string;
  title?: string;
  rootRef?: string;
  generatedAt?: string;
  version?: string;
  serializedSnapshot?: string;
  snapshot?: ProjectStoreSnapshot;
  productionBible?: Record<string, unknown>;
  storyFlow?: Record<string, unknown>;
  visualMemory?: Record<string, unknown>;
  shotSpecs?: ProjectRuntimeShotSpecInput[];
  sourceIndex?: Record<string, unknown>;
  sourceIndexHash?: string;
  sourceOfTruth?: ProjectRuntimeSourceOfTruth;
}

export interface ProjectRuntimeEntry {
  fileName: "project.vibe";
  path: ProjectStorePathRef;
  entryKind: "project_entry";
  rootRef: string;
  role: "project_manifest";
  sourceOfTruth: "project_file";
  runtimeStateMayOverride: false;
  notes: string[];
}

export interface ProjectRuntimeTreeEntry {
  id: string;
  role: ProjectStoreFactRole | "project_directory";
  kind: "file" | "directory";
  path: ProjectStorePathRef;
  required: boolean;
  sourceOfTruth: "project_file" | "derived_cache";
  status: "planned";
  notes: string[];
}

export interface ProjectRuntimeReadPlanEntry extends ProjectStoreReadWritePlanEntry {
  futureExecutableBySidecar: true;
}

export interface ProjectRuntimeWritePlanEntry extends ProjectStoreReadWritePlanEntry {
  futureExecutableBySidecar: true;
  projectRootRelativeWrite: boolean;
}

export interface ProjectRuntimeCacheRebuildPlan {
  mode: "derived_cache_rebuild_plan";
  cachePolicy: ProjectStoreRuntimeCachePolicy;
  sourcePriority: Array<{
    role: ProjectStoreFactRole;
    sourceOfTruth: "project_file" | "derived_cache";
    runtimeStateMayOverride: false;
  }>;
  rebuildInputs: ProjectStoreFactRole[];
  invalidatesRuntimeState: boolean;
  noFileMutation: true;
  notes: string[];
}

export type ProjectRuntimePlanItemStatus = "ok" | "needed" | "blocked" | "planned";

export interface ProjectRuntimePlanItem {
  id: string;
  status: ProjectRuntimePlanItemStatus;
  detail: string;
  action: string;
}

export interface ProjectRuntimeValidation {
  ok: boolean;
  checkedAt: string;
  projectStore: ProjectStoreValidationResult;
  errors: string[];
  warnings: string[];
}

export interface ProjectRuntimeHardLocks extends ProjectStoreHardLocks {
  noDirectoryCreate: true;
  noUserFileMove: true;
  noFileMutation: true;
  noProviderSubmit: true;
  noCredentialRead: true;
}

export interface ProjectRuntimePlan {
  schemaVersion: "0.1.0";
  phase: "phase_14_project_runtime_core";
  mode: ProjectRuntimeMode;
  generatedAt: string;
  projectEntry: ProjectRuntimeEntry;
  plannedTree: ProjectRuntimeTreeEntry[];
  factFiles: ProjectStoreFactFile[];
  writePlan: ProjectRuntimeWritePlanEntry[];
  readPlan: ProjectRuntimeReadPlanEntry[];
  runtimeCacheRebuildPlan: ProjectRuntimeCacheRebuildPlan;
  migrationPlan: ProjectRuntimePlanItem[];
  repairPlan: ProjectRuntimePlanItem[];
  validation: ProjectRuntimeValidation;
  hardLocks: ProjectRuntimeHardLocks;
  userFacingSummary: string[];
  snapshot: ProjectStoreSnapshot;
}

const schemaVersion = "0.1.0";
const defaultGeneratedAt = "1970-01-01T00:00:00.000Z";
const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/])/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;

const directoryTree: Array<{ id: string; path: string; required: boolean }> = [
  { id: "production_bible_dir", path: "production_bible", required: false },
  { id: "story_flow_dir", path: "story_flow", required: true },
  { id: "visual_memory_dir", path: "visual_memory", required: true },
  { id: "shots_dir", path: "shots", required: false },
  { id: "manifests_dir", path: "manifests", required: false },
  { id: "runtime_cache_dir", path: "runtime-state.json", required: false },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeSlashes(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
}

function isAbsoluteLike(value: string): boolean {
  return absolutePathPattern.test(value.trim());
}

function hasParentTraversal(value: string): boolean {
  return parentTraversalPattern.test(normalizeSlashes(value));
}

function projectRootPath(path: string, sourceRef: string): ProjectStorePathRef {
  return {
    path,
    origin: "project_root_relative",
    sourceRef,
    notes: ["Project Runtime plans this as a project-root-relative path; Phase 14 does not create it."],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringArrayFrom(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function shotIdsFromStoryFlow(storyFlow: Record<string, unknown>): string[] {
  const direct = stringArrayFrom(storyFlow.shotOrder);
  const ids = new Set(direct);
  const sections = Array.isArray(storyFlow.sections) ? storyFlow.sections : [];
  for (const section of sections) {
    if (!isRecord(section) || !Array.isArray(section.shots)) continue;
    for (const shot of section.shots) {
      if (isRecord(shot) && typeof shot.id === "string") ids.add(shot.id);
    }
  }
  const shots = Array.isArray(storyFlow.shots) ? storyFlow.shots : [];
  for (const shot of shots) {
    if (isRecord(shot) && typeof shot.id === "string") ids.add(shot.id);
  }
  return Array.from(ids).sort();
}

function factFileByRole(snapshot: ProjectStoreSnapshot, role: ProjectStoreFactRole): ProjectStoreFactFile | undefined {
  return snapshot.factFiles.find((factFile) => factFile.role === role);
}

function buildPatchOperations(input: ProjectRuntimeBuildInput): ProjectStorePatchOperation[] {
  const operations: ProjectStorePatchOperation[] = [];
  if (input.productionBible) operations.push({ op: "set_production_bible", value: clone(input.productionBible) });
  if (input.storyFlow) operations.push({ op: "set_story_flow", value: clone(input.storyFlow) });
  if (input.visualMemory) operations.push({ op: "set_visual_memory", value: clone(input.visualMemory) });
  if (input.sourceIndex) operations.push({ op: "set_source_index", value: clone(input.sourceIndex), sourceIndexHash: input.sourceIndexHash });
  if (input.version) operations.push({ op: "set_project_version", version: input.version });
  for (const shot of input.shotSpecs || []) {
    operations.push({ op: "upsert_shot_spec", shotId: shot.shotId, path: shot.path, value: clone(shot.value) });
  }
  return operations;
}

function snapshotFromInput(input: ProjectRuntimeBuildInput, generatedAt: string): {
  snapshot: ProjectStoreSnapshot;
  rejectedOperations: string[];
  openValidation?: ProjectStoreValidationResult;
} {
  const mode = input.mode || "create";
  let base: ProjectStoreSnapshot;
  let openValidation: ProjectStoreValidationResult | undefined;

  if ((mode === "open" || mode === "save" || mode === "rebuild") && (input.serializedSnapshot || input.snapshot)) {
    const opened = openProjectStoreSnapshot(input.serializedSnapshot || (input.snapshot as ProjectStoreSnapshot), generatedAt);
    base = opened.snapshot;
    openValidation = opened.validation;
  } else {
    base = createProjectStoreSnapshot({
      generatedAt,
      projectId: input.projectId,
      title: input.title,
      version: input.version,
      productionBible: input.productionBible,
      storyFlow: input.storyFlow,
      visualMemory: input.visualMemory,
      shotSpecs: input.shotSpecs,
      sourceIndex: input.sourceIndex,
      sourceIndexHash: input.sourceIndexHash,
    });
  }

  const operations = mode === "create" ? [] : buildPatchOperations(input);
  if (!operations.length) return { snapshot: base, rejectedOperations: [], openValidation };

  const patched = applyProjectStorePatch(base, {
    id: `project_runtime_${mode}_patch`,
    appliedAt: generatedAt,
    operations,
  });
  return {
    snapshot: patched.snapshot,
    rejectedOperations: patched.rejectedOperations,
    openValidation: patched.validation,
  };
}

function validateRootRef(rootRef: string, errors: string[]): void {
  if (!rootRef.trim()) {
    errors.push("rootRef is required.");
    return;
  }
  if (isAbsoluteLike(rootRef)) errors.push("rootRef must not be an absolute platform path in the portable contract.");
  if (hasParentTraversal(rootRef)) errors.push("rootRef must not contain parent traversal.");
  if (rootRef.startsWith("user_selected_import/") && rootRef.split("/").filter(Boolean).length < 2) {
    errors.push("user-selected import rootRef must be a redacted token.");
  }
}

function validatePathRef(pathRef: ProjectStorePathRef, label: string, errors: string[]): void {
  if (isAbsoluteLike(pathRef.path)) errors.push(`${label} must not be an absolute platform path.`);
  if (hasParentTraversal(pathRef.path)) errors.push(`${label} must not contain parent traversal.`);
  if (pathRef.origin === "user_selected_import" && (!pathRef.rawPathRedacted || !pathRef.importId)) {
    errors.push(`${label} user-selected import must be represented by a redacted token.`);
  }
}

function validateRuntimeContract(input: ProjectRuntimeBuildInput, snapshot: ProjectStoreSnapshot, rejectedOperations: string[]): string[] {
  const errors: string[] = [];
  validateRootRef(input.rootRef || "project_root", errors);
  for (const factFile of snapshot.factFiles) {
    validatePathRef(factFile.path, `factFiles.${factFile.id}.path`, errors);
    if (factFile.role === "runtime_state" && factFile.sourceOfTruth !== "derived_cache") {
      errors.push("runtime-state must be a derived cache, not a project fact source of truth.");
    }
    if (factFile.role !== "runtime_state" && factFile.sourceOfTruth !== "project_file") {
      errors.push(`${factFile.id} must use project files as the source of truth.`);
    }
  }
  for (const entry of snapshot.readWritePlan) validatePathRef(entry.path, `readWritePlan.${entry.id}.path`, errors);
  if (input.sourceOfTruth === "runtime_state") {
    errors.push("runtime-state cannot be used as the source of truth for project facts.");
  }
  for (const rejected of rejectedOperations) errors.push(`project store patch rejected: ${rejected}`);
  return errors;
}

function buildPlannedTree(snapshot: ProjectStoreSnapshot): ProjectRuntimeTreeEntry[] {
  const byPath = new Set<string>();
  const tree: ProjectRuntimeTreeEntry[] = [];
  for (const directory of directoryTree) {
    if (byPath.has(directory.path)) continue;
    byPath.add(directory.path);
    tree.push({
      id: directory.id,
      role: directory.id === "runtime_cache_dir" ? "runtime_state" : "project_directory",
      kind: directory.path.endsWith(".json") ? "file" : "directory",
      path: projectRootPath(directory.path, directory.id),
      required: directory.required,
      sourceOfTruth: directory.id === "runtime_cache_dir" ? "derived_cache" : "project_file",
      status: "planned",
      notes:
        directory.id === "runtime_cache_dir"
          ? ["runtime-state.json is planned only as a rebuildable derived cache."]
          : ["Directory creation is described for the future sidecar and not executed in Phase 14."],
    });
  }

  for (const factFile of snapshot.factFiles) {
    if (byPath.has(factFile.path.path)) continue;
    byPath.add(factFile.path.path);
    tree.push({
      id: factFile.id,
      role: factFile.role,
      kind: "file",
      path: factFile.path,
      required: factFile.required,
      sourceOfTruth: factFile.sourceOfTruth,
      status: "planned",
      notes: factFile.notes,
    });
  }
  return tree;
}

function buildReadPlan(snapshot: ProjectStoreSnapshot): ProjectRuntimeReadPlanEntry[] {
  return snapshot.readWritePlan
    .filter((entry) => entry.operation === "read")
    .map((entry) => ({ ...entry, futureExecutableBySidecar: true as const }));
}

function buildWritePlan(snapshot: ProjectStoreSnapshot, mode: ProjectRuntimeMode, generatedAt: string): {
  snapshot: ProjectStoreSnapshot;
  writePlan: ProjectRuntimeWritePlanEntry[];
  validation: ProjectStoreValidationResult;
} {
  const saved = mode === "save" ? saveProjectStoreSnapshot(snapshot, generatedAt) : undefined;
  const sourceSnapshot = saved?.snapshot || snapshot;
  const validation = saved?.validation || validateProjectStoreSnapshot(sourceSnapshot, generatedAt);
  const entries = saved?.savePlan.entries || sourceSnapshot.readWritePlan.filter((entry) => entry.operation === "write");
  return {
    snapshot: sourceSnapshot,
    validation,
    writePlan: entries.map((entry) => ({
      ...entry,
      futureExecutableBySidecar: true as const,
      projectRootRelativeWrite: entry.path.origin === "project_root_relative",
    })),
  };
}

function buildRuntimeCacheRebuildPlan(snapshot: ProjectStoreSnapshot): ProjectRuntimeCacheRebuildPlan {
  const cachePolicy = deriveRuntimeCachePolicy(snapshot);
  return {
    mode: "derived_cache_rebuild_plan",
    cachePolicy,
    sourcePriority: snapshot.factFiles.map((factFile) => ({
      role: factFile.role,
      sourceOfTruth: factFile.sourceOfTruth,
      runtimeStateMayOverride: false as const,
    })),
    rebuildInputs: cachePolicy.rebuildInputs,
    invalidatesRuntimeState: true,
    noFileMutation: true,
    notes: [
      "project.vibe and project fact files feed the rebuild.",
      "runtime-state is output-only derived cache and cannot override project files.",
    ],
  };
}

function buildMigrationPlan(snapshot: ProjectStoreSnapshot, validation: ProjectRuntimeValidation): ProjectRuntimePlanItem[] {
  const expectedRoles: ProjectStoreFactRole[] = ["project_manifest", "story_flow", "visual_memory", "source_index", "runtime_state"];
  const missingRoles = expectedRoles.filter((role) => !factFileByRole(snapshot, role));
  const cacheInvalidationReady = snapshot.runtimeCachePolicy.invalidationRefs.length > 0;
  return [
    {
      id: "schema_version_check",
      status: snapshot.schemaVersion === schemaVersion ? "ok" : "blocked",
      detail: `Expected Project Store schema ${schemaVersion}; found ${snapshot.schemaVersion}.`,
      action: "Block future writes until the sidecar can migrate older schemas safely.",
    },
    {
      id: "missing_fact_file_detection",
      status: missingRoles.length ? "needed" : "ok",
      detail: missingRoles.length ? `Missing fact roles: ${missingRoles.join(", ")}.` : "Required fact roles are represented in the runtime plan.",
      action: "Create an in-memory repair proposal before any future file writer is enabled.",
    },
    {
      id: "runtime_cache_invalidation",
      status: cacheInvalidationReady ? "ok" : "needed",
      detail: cacheInvalidationReady
        ? `Runtime cache has ${snapshot.runtimeCachePolicy.invalidationRefs.length} invalidation refs.`
        : "Runtime cache lacks invalidation refs.",
      action: "Rebuild runtime-state from project files when any project fact hash changes.",
    },
    {
      id: "future_safe_migration_placeholder",
      status: validation.ok ? "planned" : "blocked",
      detail: "Future migrations must remain path-portable and sidecar-mediated.",
      action: "Keep migrations in dry-run/write-plan form until filesystem permission gates exist.",
    },
  ];
}

function buildRepairPlan(input: ProjectRuntimeBuildInput, snapshot: ProjectStoreSnapshot): ProjectRuntimePlanItem[] {
  const storyShotIds = new Set(shotIdsFromStoryFlow(snapshot.facts.storyFlow));
  const orphanShotIds = snapshot.facts.shotSpecs.map((shot) => shot.shotId).filter((shotId) => storyShotIds.size > 0 && !storyShotIds.has(shotId));
  const runtimeStateFact = factFileByRole(snapshot, "runtime_state");
  const runtimeStateAsSource = input.sourceOfTruth === "runtime_state" || runtimeStateFact?.sourceOfTruth !== "derived_cache";

  return [
    {
      id: "missing_project_vibe",
      status: snapshot.projectFile.fileName === "project.vibe" && Boolean(factFileByRole(snapshot, "project_manifest")) ? "ok" : "needed",
      detail: "project.vibe is the project entry and must be present before future writes.",
      action: "Plan project.vibe as the file-first entry; do not write it in Phase 14.",
    },
    {
      id: "missing_story_flow",
      status: factFileByRole(snapshot, "story_flow") && snapshot.facts.storyFlow ? "ok" : "needed",
      detail: "story_flow/story_flow.vibe.json is required for project fact reconstruction.",
      action: "Recover story_flow from project files or ask the user to select the canonical fact file.",
    },
    {
      id: "missing_visual_memory",
      status: factFileByRole(snapshot, "visual_memory") && snapshot.facts.visualMemory ? "ok" : "needed",
      detail: "visual_memory/visual_memory.vibe.json is required for asset consistency facts.",
      action: "Recover visual_memory from project files or keep the project blocked for generation.",
    },
    {
      id: "missing_source_index",
      status: snapshot.facts.sourceIndex && factFileByRole(snapshot, "source_index") ? "ok" : "needed",
      detail: "manifests/source_index.vibe.json should key runtime cache rebuilds.",
      action: "Regenerate source_index from project fact files in memory before enabling cache writes.",
    },
    {
      id: "orphan_shot_specs",
      status: orphanShotIds.length ? "needed" : "ok",
      detail: orphanShotIds.length ? `Shot specs without story_flow references: ${orphanShotIds.join(", ")}.` : "No orphan shot specs detected.",
      action: "Attach orphan shot specs to story_flow or mark them for archive in a future write plan.",
    },
    {
      id: "runtime_state_as_source",
      status: runtimeStateAsSource ? "blocked" : "ok",
      detail: runtimeStateAsSource
        ? "runtime-state was requested or marked as a source of truth."
        : "runtime-state is derived cache only.",
      action: "Reject runtime-state as project fact authority and rebuild it from project files.",
    },
  ];
}

function buildValidation(
  input: ProjectRuntimeBuildInput,
  snapshot: ProjectStoreSnapshot,
  checkedAt: string,
  projectStore: ProjectStoreValidationResult,
  rejectedOperations: string[],
): ProjectRuntimeValidation {
  const runtimeErrors = validateRuntimeContract(input, snapshot, rejectedOperations);
  const warnings = [...projectStore.warnings];
  if (!snapshot.facts.sourceIndex) warnings.push("source_index fact is missing; runtime cache keys may be skeletal.");
  return {
    ok: projectStore.ok && runtimeErrors.length === 0,
    checkedAt,
    projectStore,
    errors: [...projectStore.errors, ...runtimeErrors],
    warnings,
  };
}

function buildUserFacingSummary(plan: {
  mode: ProjectRuntimeMode;
  validation: ProjectRuntimeValidation;
  writeCount: number;
  readCount: number;
  cachePolicy: ProjectStoreRuntimeCachePolicy;
}): string[] {
  return [
    `Project Runtime ${plan.mode} plan is ${plan.validation.ok ? "valid" : "blocked"} in Phase 14 dry-run mode.`,
    `project.vibe is the project entry; ${plan.writeCount} future writes and ${plan.readCount} future reads are described but not executed.`,
    `runtime-state is a derived cache keyed by ${plan.cachePolicy.cacheKeys.sourceIndexHash}; project files remain the source of truth.`,
    "Hard locks keep file mutation, directory creation, user-file moves, provider submits, and credential reads disabled.",
  ];
}

export function buildProjectRuntimePlan(input: ProjectRuntimeBuildInput = {}): ProjectRuntimePlan {
  const mode = input.mode || "create";
  const generatedAt = input.generatedAt || defaultGeneratedAt;
  const rootRef = input.rootRef || "project_root";
  const initial = snapshotFromInput(input, generatedAt);
  const write = buildWritePlan(initial.snapshot, mode, generatedAt);
  const snapshot = write.snapshot;
  const runtimeCacheRebuildPlan = buildRuntimeCacheRebuildPlan(snapshot);
  const projectStoreValidation = initial.openValidation && mode !== "save" ? initial.openValidation : write.validation;
  const validation = buildValidation(input, snapshot, generatedAt, projectStoreValidation, initial.rejectedOperations);
  const migrationPlan = buildMigrationPlan(snapshot, validation);
  const repairPlan = buildRepairPlan(input, snapshot);
  const readPlan = buildReadPlan(snapshot);

  return {
    schemaVersion,
    phase: "phase_14_project_runtime_core",
    mode,
    generatedAt,
    projectEntry: {
      fileName: "project.vibe",
      path: snapshot.projectFile.path,
      entryKind: "project_entry",
      rootRef,
      role: "project_manifest",
      sourceOfTruth: "project_file",
      runtimeStateMayOverride: false,
      notes: [
        "project.vibe is the file-first project entry.",
        "The portable contract stores project-root-relative paths; raw user-selected imports must stay redacted.",
      ],
    },
    plannedTree: buildPlannedTree(snapshot),
    factFiles: snapshot.factFiles,
    writePlan: write.writePlan,
    readPlan,
    runtimeCacheRebuildPlan,
    migrationPlan,
    repairPlan,
    validation,
    hardLocks: {
      ...snapshot.hardLocks,
      noDirectoryCreate: true,
      noUserFileMove: true,
      noFileMutation: true,
      noProviderSubmit: true,
      noCredentialRead: true,
    },
    userFacingSummary: buildUserFacingSummary({
      mode,
      validation,
      writeCount: write.writePlan.length,
      readCount: readPlan.length,
      cachePolicy: runtimeCacheRebuildPlan.cachePolicy,
    }),
    snapshot,
  };
}
