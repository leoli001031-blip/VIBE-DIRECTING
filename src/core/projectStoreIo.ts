import {
  createProjectStoreSnapshot,
  openProjectStoreSnapshot,
  validateProjectStoreSnapshot,
  type ProjectStoreFactFile,
  type ProjectStoreFactRole,
  type ProjectStoreSnapshot,
  type ProjectStoreValidationResult,
} from "./projectStore";

export const projectStoreIoSchemaVersion = "0.1.0";
export const projectStoreIoPhase = "phase19_real_project_store_io_gate";

export type ProjectStoreIoMode = "create" | "open" | "save" | "rebuild_cache";
export type ProjectStoreIoOperation = "create_directory" | "read_file" | "write_file";

export interface ProjectStoreIoHardLocks {
  projectRootOnly: true;
  whitelistOnly: true;
  noAbsoluteContractPath: true;
  noParentTraversal: true;
  noUserFileMove: true;
  noDelete: true;
  noProviderSubmit: true;
  noImageGeneration: true;
  noVideoGeneration: true;
  noCredentialRead: true;
  noCredentialWrite: true;
  noArbitraryShell: true;
  runtimeStateIsDerivedCache: true;
}

export interface ProjectStoreIoEntry {
  id: string;
  role: ProjectStoreFactRole | "project_directory";
  operation: ProjectStoreIoOperation;
  path: string;
  content?: string;
  contentHash?: string;
  canExecute: boolean;
  projectRootRelative: true;
  notes: string[];
}

export interface ProjectStoreIoGate {
  schemaVersion: typeof projectStoreIoSchemaVersion;
  phase: typeof projectStoreIoPhase;
  mode: ProjectStoreIoMode;
  generatedAt: string;
  rootRef: "project_root";
  fileMutationScope: "project_root_whitelist";
  projectVibeWriteAllowed: boolean;
  runtimeStateWriteAllowed: boolean;
  directoryCreateAllowed: boolean;
  canExecute: boolean;
  snapshotValidation: ProjectStoreValidationResult;
  entries: ProjectStoreIoEntry[];
  whitelist: string[];
  blockers: string[];
  warnings: string[];
  hardLocks: ProjectStoreIoHardLocks;
  notes: string[];
}

export interface BuildProjectStoreIoGateInput {
  mode: ProjectStoreIoMode;
  snapshot?: ProjectStoreSnapshot;
  serializedProjectVibe?: string;
  generatedAt?: string;
  runtimeState?: Record<string, unknown>;
}

export interface ProjectStoreIoAdapter {
  mkdir(path: string): void | Promise<void>;
  readFile(path: string): string | Promise<string>;
  writeFile(path: string, content: string): void | Promise<void>;
}

export interface ProjectStoreIoExecutionResult {
  ok: boolean;
  executed: Array<{ id: string; operation: ProjectStoreIoOperation; path: string }>;
  skipped: Array<{ id: string; reason: string }>;
  errors: string[];
  openedSnapshot?: ProjectStoreSnapshot;
  validation?: ProjectStoreValidationResult;
}

interface ProjectVibeDocument {
  schemaVersion: typeof projectStoreIoSchemaVersion;
  kind: "vibe_project_file";
  phase: typeof projectStoreIoPhase;
  projectStoreSnapshot: ProjectStoreSnapshot;
  factFiles: Array<{
    id: string;
    role: ProjectStoreFactRole;
    path: string;
    hash: string;
    sourceOfTruth: ProjectStoreFactFile["sourceOfTruth"];
  }>;
  runtimeStateRole: "derived_cache";
  updatedAt: string;
}

const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/])/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;

const hardLocks: ProjectStoreIoHardLocks = {
  projectRootOnly: true,
  whitelistOnly: true,
  noAbsoluteContractPath: true,
  noParentTraversal: true,
  noUserFileMove: true,
  noDelete: true,
  noProviderSubmit: true,
  noImageGeneration: true,
  noVideoGeneration: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noArbitraryShell: true,
  runtimeStateIsDerivedCache: true,
};

function nowIso(): string {
  return new Date().toISOString();
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

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function isUnsafePath(path: string): boolean {
  const normalized = path.trim().replace(/\\/g, "/");
  return absolutePathPattern.test(path.trim()) || parentTraversalPattern.test(normalized) || !normalizePath(path);
}

function directoryOf(path: string): string | undefined {
  const normalized = normalizePath(path);
  const parts = normalized.split("/");
  if (parts.length <= 1) return undefined;
  return parts.slice(0, -1).join("/");
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function toProjectVibeDocument(snapshot: ProjectStoreSnapshot, updatedAt: string): ProjectVibeDocument {
  return {
    schemaVersion: projectStoreIoSchemaVersion,
    kind: "vibe_project_file",
    phase: projectStoreIoPhase,
    projectStoreSnapshot: snapshot,
    factFiles: snapshot.factFiles.map((factFile) => ({
      id: factFile.id,
      role: factFile.role,
      path: factFile.path.path,
      hash: factFile.hash,
      sourceOfTruth: factFile.sourceOfTruth,
    })),
    runtimeStateRole: "derived_cache",
    updatedAt,
  };
}

function factContent(snapshot: ProjectStoreSnapshot, factFile: ProjectStoreFactFile, runtimeState?: Record<string, unknown>): unknown {
  if (factFile.role === "project_manifest") return toProjectVibeDocument(snapshot, snapshot.updatedAt);
  if (factFile.role === "production_bible") return snapshot.facts.productionBible || {};
  if (factFile.role === "story_flow") return snapshot.facts.storyFlow;
  if (factFile.role === "visual_memory") return snapshot.facts.visualMemory;
  if (factFile.role === "source_index") return snapshot.facts.sourceIndex || {};
  if (factFile.role === "runtime_state") {
    return runtimeState || {
      schemaVersion: projectStoreIoSchemaVersion,
      role: "derived_cache_placeholder",
      source: "ProjectStoreIoGate",
      runtimeStateMayBeRebuilt: true,
      runtimeStateIsSoleSourceOfTruth: false,
      generatedAt: snapshot.updatedAt,
    };
  }
  const shot = snapshot.facts.shotSpecs.find((item) => normalizePath(item.path.path) === normalizePath(factFile.path.path));
  return shot?.value || {};
}

function createDirectoryEntries(paths: string[], canExecute: boolean): ProjectStoreIoEntry[] {
  return uniqueSorted(paths.flatMap((path) => {
    const dirs: string[] = [];
    let current = directoryOf(path);
    while (current) {
      dirs.push(current);
      current = directoryOf(current);
    }
    return dirs;
  })).map((path) => ({
    id: `mkdir_${stableHash(path).replace(/^vck_/, "")}`,
    role: "project_directory" as const,
    operation: "create_directory" as const,
    path,
    canExecute,
    projectRootRelative: true as const,
    notes: ["Directory creation is allowed only inside the selected project root whitelist."],
  }));
}

function buildWriteEntries(snapshot: ProjectStoreSnapshot, runtimeState: Record<string, unknown> | undefined, canExecute: boolean): ProjectStoreIoEntry[] {
  return snapshot.factFiles.map((factFile) => {
    const path = normalizePath(factFile.path.path);
    const content = serialize(factContent(snapshot, factFile, runtimeState));
    return {
      id: `write_${factFile.id}`,
      role: factFile.role,
      operation: "write_file" as const,
      path,
      content,
      contentHash: stableHash(content),
      canExecute,
      projectRootRelative: true as const,
      notes:
        factFile.role === "runtime_state"
          ? ["runtime-state.json is written only as a derived cache."]
          : ["Project fact write is scoped to the selected project root whitelist."],
    };
  });
}

function buildReadEntries(snapshot: ProjectStoreSnapshot, canExecute: boolean): ProjectStoreIoEntry[] {
  return snapshot.factFiles.map((factFile) => ({
    id: `read_${factFile.id}`,
    role: factFile.role,
    operation: "read_file" as const,
    path: normalizePath(factFile.path.path),
    canExecute,
    projectRootRelative: true as const,
    notes: ["Project fact read is scoped to the selected project root whitelist."],
  }));
}

function openSnapshotFromProjectVibe(serialized: string, checkedAt: string): {
  snapshot: ProjectStoreSnapshot;
  validation: ProjectStoreValidationResult;
  blockers: string[];
} {
  const parsed = JSON.parse(serialized) as ProjectVibeDocument | ProjectStoreSnapshot;
  const snapshot = "projectStoreSnapshot" in parsed ? parsed.projectStoreSnapshot : parsed;
  const opened = openProjectStoreSnapshot(snapshot, checkedAt);
  const blockers: string[] = [];
  if ("projectStoreSnapshot" in parsed && parsed.kind !== "vibe_project_file") blockers.push("project.vibe kind must be vibe_project_file.");
  if ("projectStoreSnapshot" in parsed && parsed.runtimeStateRole !== "derived_cache") blockers.push("project.vibe must mark runtime-state as derived_cache.");
  return { snapshot: opened.snapshot, validation: opened.validation, blockers };
}

export function buildProjectStoreIoGate(input: BuildProjectStoreIoGateInput): ProjectStoreIoGate {
  const generatedAt = input.generatedAt || nowIso();
  const opened = input.serializedProjectVibe ? openSnapshotFromProjectVibe(input.serializedProjectVibe, generatedAt) : undefined;
  const snapshot = opened?.snapshot || input.snapshot || createProjectStoreSnapshot({ generatedAt });
  const snapshotValidation = opened?.validation || validateProjectStoreSnapshot(snapshot, generatedAt);
  const blockers = [...(opened?.blockers || []), ...snapshotValidation.errors];
  const unsafePaths = snapshot.factFiles.map((factFile) => normalizePath(factFile.path.path)).filter(isUnsafePath);
  blockers.push(...unsafePaths.map((path) => `Unsafe project path blocked: ${path}`));
  if (input.mode === "open" && !input.serializedProjectVibe) blockers.push("Open mode requires serialized project.vibe content.");

  const canExecute = blockers.length === 0;
  const factPaths = snapshot.factFiles.map((factFile) => normalizePath(factFile.path.path));
  const writeAllowed = input.mode === "create" || input.mode === "save" || input.mode === "rebuild_cache";
  const readAllowed = input.mode === "open";
  const entries = [
    ...(writeAllowed ? createDirectoryEntries(factPaths, canExecute) : []),
    ...(readAllowed ? buildReadEntries(snapshot, canExecute) : []),
    ...(writeAllowed ? buildWriteEntries(snapshot, input.runtimeState, canExecute) : []),
  ];

  return {
    schemaVersion: projectStoreIoSchemaVersion,
    phase: projectStoreIoPhase,
    mode: input.mode,
    generatedAt,
    rootRef: "project_root",
    fileMutationScope: "project_root_whitelist",
    projectVibeWriteAllowed: writeAllowed && canExecute,
    runtimeStateWriteAllowed: writeAllowed && canExecute,
    directoryCreateAllowed: writeAllowed && canExecute,
    canExecute,
    snapshotValidation,
    entries,
    whitelist: uniqueSorted(factPaths),
    blockers: uniqueSorted(blockers),
    warnings: uniqueSorted(snapshotValidation.warnings),
    hardLocks,
    notes: [
      "Phase 19 allows project-root-whitelisted project file IO through an explicit adapter only.",
      "No provider, credential, arbitrary shell, user-file move, or delete route is opened by this gate.",
      "runtime-state.json remains a derived cache and cannot become the project source of truth.",
    ],
  };
}

export async function executeProjectStoreIoGate(
  gate: ProjectStoreIoGate,
  adapter: ProjectStoreIoAdapter,
): Promise<ProjectStoreIoExecutionResult> {
  const executed: ProjectStoreIoExecutionResult["executed"] = [];
  const skipped: ProjectStoreIoExecutionResult["skipped"] = [];
  const errors: string[] = [];
  let openedSnapshot: ProjectStoreSnapshot | undefined;
  let validation: ProjectStoreValidationResult | undefined;

  if (!gate.canExecute) {
    return {
      ok: false,
      executed,
      skipped: gate.entries.map((entry) => ({ id: entry.id, reason: "Gate is blocked." })),
      errors: gate.blockers,
    };
  }

  for (const entry of gate.entries) {
    if (!entry.canExecute) {
      skipped.push({ id: entry.id, reason: "Entry is not executable." });
      continue;
    }
    if (isUnsafePath(entry.path) || !gate.whitelist.includes(entry.path) && entry.operation !== "create_directory") {
      skipped.push({ id: entry.id, reason: "Path is outside the project IO whitelist." });
      continue;
    }
    try {
      if (entry.operation === "create_directory") await adapter.mkdir(entry.path);
      if (entry.operation === "write_file") await adapter.writeFile(entry.path, entry.content || "");
      if (entry.operation === "read_file") {
        const content = await adapter.readFile(entry.path);
        if (entry.path === "project.vibe") {
          const opened = openSnapshotFromProjectVibe(content, gate.generatedAt);
          openedSnapshot = opened.snapshot;
          validation = opened.validation;
          errors.push(...opened.blockers);
        }
      }
      executed.push({ id: entry.id, operation: entry.operation, path: entry.path });
    } catch (error) {
      errors.push(`${entry.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    ok: errors.length === 0,
    executed,
    skipped,
    errors,
    openedSnapshot,
    validation,
  };
}
