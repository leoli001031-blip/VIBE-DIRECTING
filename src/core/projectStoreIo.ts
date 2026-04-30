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
const credentialKeyPattern = /(?:credential|token|api_?key|secret|password|auth)/i;
const validModes: ProjectStoreIoMode[] = ["create", "open", "save", "rebuild_cache"];
const validOperations: ProjectStoreIoOperation[] = ["create_directory", "read_file", "write_file"];
const validEntryRoles: Array<ProjectStoreIoEntry["role"]> = [
  "project_manifest",
  "production_bible",
  "story_flow",
  "visual_memory",
  "shot_spec",
  "source_index",
  "runtime_state",
  "project_directory",
];

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validationError(checkedAt: string, errors: string[]): ProjectStoreValidationResult {
  return { ok: false, errors, warnings: [], checkedAt };
}

function readGateEntries(gate: ProjectStoreIoGate): ProjectStoreIoEntry[] {
  const rawGate = gate as unknown;
  return isRecord(rawGate) && Array.isArray(rawGate.entries) ? rawGate.entries as ProjectStoreIoEntry[] : [];
}

function entryKey(entry: Pick<ProjectStoreIoEntry, "operation" | "path">): string {
  const operation = typeof entry.operation === "string" ? entry.operation : "unknown_operation";
  const path = typeof entry.path === "string" ? normalizePath(entry.path) : "unknown_path";
  return `${operation}:${path}`;
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function directoryAllowlistFromFilePaths(paths: string[]): string[] {
  return uniqueSorted(paths.flatMap((path) => {
    const dirs: string[] = [];
    let current = directoryOf(path);
    while (current) {
      dirs.push(current);
      current = directoryOf(current);
    }
    return dirs;
  }));
}

function parseJsonSafe(serialized: string, label: string): { value?: unknown; errors: string[] } {
  try {
    return { value: JSON.parse(serialized), errors: [] };
  } catch (error) {
    return { errors: [`${label} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`] };
  }
}

function collectRuntimeStateSecurityErrors(value: unknown, label = "runtime-state"): string[] {
  const errors: string[] = [];
  const visit = (current: unknown, path: string): void => {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!isRecord(current)) return;
    for (const [key, child] of Object.entries(current)) {
      const childPath = `${path}.${key}`;
      if (key === "runtimeStateIsSoleSourceOfTruth" && child === true) {
        errors.push(`${childPath} cannot be true; runtime-state is only a derived cache.`);
      }
      if (credentialKeyPattern.test(key.replace(/[-\s]/g, "_"))) {
        errors.push(`${childPath} is blocked because runtime-state cannot persist credential, token, apiKey, secret, password, or auth keys.`);
      }
      visit(child, childPath);
    }
  };
  visit(value, label);
  return uniqueSorted(errors);
}

function runtimeStateFactContent(snapshot: ProjectStoreSnapshot): ProjectStoreSnapshot["runtimeCachePolicy"] {
  return snapshot.runtimeCachePolicy;
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
      hash: factFile.role === "runtime_state" ? stableHash(runtimeStateFactContent(snapshot)) : factFile.hash,
      sourceOfTruth: factFile.sourceOfTruth,
    })),
    runtimeStateRole: "derived_cache",
    updatedAt,
  };
}

function factContent(snapshot: ProjectStoreSnapshot, factFile: ProjectStoreFactFile): unknown {
  if (factFile.role === "project_manifest") return toProjectVibeDocument(snapshot, snapshot.updatedAt);
  if (factFile.role === "production_bible") return snapshot.facts.productionBible || {};
  if (factFile.role === "story_flow") return snapshot.facts.storyFlow;
  if (factFile.role === "visual_memory") return snapshot.facts.visualMemory;
  if (factFile.role === "source_index") return snapshot.facts.sourceIndex || {};
  if (factFile.role === "runtime_state") return runtimeStateFactContent(snapshot);
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

function buildWriteEntries(snapshot: ProjectStoreSnapshot, canExecute: boolean): ProjectStoreIoEntry[] {
  return snapshot.factFiles.map((factFile) => {
    const path = normalizePath(factFile.path.path);
    const content = serialize(factContent(snapshot, factFile));
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
  snapshot?: ProjectStoreSnapshot;
  validation: ProjectStoreValidationResult;
  blockers: string[];
  factFiles: ProjectVibeDocument["factFiles"];
} {
  const blockers: string[] = [];
  const parsed = parseJsonSafe(serialized, "project.vibe");
  if (parsed.errors.length || !parsed.value) {
    return { validation: validationError(checkedAt, parsed.errors), blockers: parsed.errors, factFiles: [] };
  }
  if (!isRecord(parsed.value)) {
    const errors = ["project.vibe must be a JSON object."];
    return { validation: validationError(checkedAt, errors), blockers: errors, factFiles: [] };
  }

  const hasDocumentEnvelope = "projectStoreSnapshot" in parsed.value;
  const snapshotInput = hasDocumentEnvelope ? parsed.value.projectStoreSnapshot : parsed.value;
  if (!isRecord(snapshotInput)) {
    const errors = ["project.vibe projectStoreSnapshot must be a JSON object."];
    return { validation: validationError(checkedAt, errors), blockers: errors, factFiles: [] };
  }

  if (hasDocumentEnvelope) {
    if (parsed.value.schemaVersion !== projectStoreIoSchemaVersion) blockers.push("project.vibe schemaVersion must match the Project Store IO schema version.");
    if (parsed.value.kind !== "vibe_project_file") blockers.push("project.vibe kind must be vibe_project_file.");
    if (parsed.value.phase !== projectStoreIoPhase) blockers.push("project.vibe phase must match the Project Store IO phase.");
    if (parsed.value.runtimeStateRole !== "derived_cache") blockers.push("project.vibe must mark runtime-state as derived_cache.");
    if (!Array.isArray(parsed.value.factFiles)) blockers.push("project.vibe factFiles must be an array.");
  }

  try {
    const opened = openProjectStoreSnapshot(snapshotInput as unknown as ProjectStoreSnapshot, checkedAt);
    const documentFactFiles = hasDocumentEnvelope && Array.isArray(parsed.value.factFiles)
      ? parsed.value.factFiles
          .filter(isRecord)
          .map((factFile) => ({
            id: String(factFile.id || ""),
            role: factFile.role as ProjectStoreFactRole,
            path: normalizePath(String(factFile.path || "")),
            hash: String(factFile.hash || ""),
            sourceOfTruth: factFile.sourceOfTruth as ProjectStoreFactFile["sourceOfTruth"],
          }))
      : opened.snapshot.factFiles.map((factFile) => ({
          id: factFile.id,
          role: factFile.role,
          path: normalizePath(factFile.path.path),
          hash: factFile.hash,
          sourceOfTruth: factFile.sourceOfTruth,
        }));
    return { snapshot: opened.snapshot, validation: opened.validation, blockers, factFiles: documentFactFiles };
  } catch (error) {
    const errors = [`project.vibe could not be opened: ${error instanceof Error ? error.message : String(error)}`];
    return { validation: validationError(checkedAt, errors), blockers: [...blockers, ...errors], factFiles: [] };
  }
}

function canonicalFactPaths(snapshot: ProjectStoreSnapshot): { paths: string[]; errors: string[] } {
  const errors: string[] = [];
  const paths = snapshot.factFiles.map((factFile) => normalizePath(factFile.path.path));
  for (const path of paths) {
    if (isUnsafePath(path)) errors.push(`Unsafe project path blocked: ${path}`);
  }
  const uniquePaths = uniqueSorted(paths);
  if (uniquePaths.length !== paths.length) errors.push("Project Store fact file paths must be unique.");
  return { paths: uniquePaths, errors };
}

function expectedEntriesForMode(snapshot: ProjectStoreSnapshot, mode: ProjectStoreIoMode): ProjectStoreIoEntry[] {
  const factPaths = snapshot.factFiles.map((factFile) => normalizePath(factFile.path.path));
  if (mode === "open") return buildReadEntries(snapshot, true);
  return [...createDirectoryEntries(factPaths, true), ...buildWriteEntries(snapshot, true)];
}

function validateGateEnvelope(gate: ProjectStoreIoGate): string[] {
  const errors: string[] = [];
  const rawGate = gate as unknown;
  if (!isRecord(rawGate)) return ["Project Store IO gate must be an object."];

  if (gate.schemaVersion !== projectStoreIoSchemaVersion) errors.push("Gate schemaVersion is invalid.");
  if (gate.phase !== projectStoreIoPhase) errors.push("Gate phase is invalid.");
  if (!validModes.includes(gate.mode)) errors.push("Gate mode is invalid.");
  if (typeof gate.generatedAt !== "string" || !gate.generatedAt.trim()) errors.push("Gate generatedAt is required.");
  if (gate.rootRef !== "project_root") errors.push("Gate rootRef must be project_root.");
  if (gate.fileMutationScope !== "project_root_whitelist") errors.push("Gate fileMutationScope must be project_root_whitelist.");
  if (typeof gate.projectVibeWriteAllowed !== "boolean") errors.push("Gate projectVibeWriteAllowed must be boolean.");
  if (typeof gate.runtimeStateWriteAllowed !== "boolean") errors.push("Gate runtimeStateWriteAllowed must be boolean.");
  if (typeof gate.directoryCreateAllowed !== "boolean") errors.push("Gate directoryCreateAllowed must be boolean.");
  if (typeof gate.canExecute !== "boolean") errors.push("Gate canExecute must be boolean.");
  if (!Array.isArray(gate.whitelist)) errors.push("Gate whitelist must be an array.");
  if (!Array.isArray(gate.entries)) errors.push("Gate entries must be an array.");
  if (!Array.isArray(gate.blockers)) errors.push("Gate blockers must be an array.");
  if (!Array.isArray(gate.warnings)) errors.push("Gate warnings must be an array.");
  if (!Array.isArray(gate.notes)) errors.push("Gate notes must be an array.");

  if (!isRecord(gate.snapshotValidation)) {
    errors.push("Gate snapshotValidation must be an object.");
  } else if (Array.isArray(gate.snapshotValidation.errors) && gate.snapshotValidation.errors.length > 0) {
    errors.push(...gate.snapshotValidation.errors.map((error) => `Gate snapshot validation error: ${error}`));
  }

  if (!isRecord(gate.hardLocks)) {
    errors.push("Gate hardLocks must be an object.");
  } else {
    for (const key of Object.keys(hardLocks) as Array<keyof ProjectStoreIoHardLocks>) {
      if (gate.hardLocks[key] !== true) errors.push(`Gate hard lock ${key} must be true.`);
    }
  }

  const writeMode = gate.mode === "create" || gate.mode === "save" || gate.mode === "rebuild_cache";
  const expectedWriteAllowed = writeMode && gate.canExecute === true;
  if (gate.projectVibeWriteAllowed !== expectedWriteAllowed) errors.push("Gate projectVibeWriteAllowed does not match the canonical mode/canExecute policy.");
  if (gate.runtimeStateWriteAllowed !== expectedWriteAllowed) errors.push("Gate runtimeStateWriteAllowed does not match the canonical mode/canExecute policy.");
  if (gate.directoryCreateAllowed !== expectedWriteAllowed) errors.push("Gate directoryCreateAllowed does not match the canonical mode/canExecute policy.");

  for (const entry of readGateEntries(gate)) {
    if (!entry || typeof entry !== "object") {
      errors.push("Gate entry must be an object.");
      continue;
    }
    if (typeof entry.id !== "string" || !entry.id.trim()) errors.push("Gate entry id is required.");
    if (!validEntryRoles.includes(entry.role)) errors.push(`${entry.id || "entry"} has an invalid role.`);
    if (!validOperations.includes(entry.operation)) errors.push(`${entry.id || "entry"} has an invalid operation.`);
    if (typeof entry.path !== "string" || !entry.path.trim()) errors.push(`${entry.id || "entry"} path is required.`);
    if (entry.path !== normalizePath(entry.path)) errors.push(`${entry.id || "entry"} path must be normalized project-root-relative path.`);
    if (entry.path && isUnsafePath(entry.path)) errors.push(`${entry.id || "entry"} path is outside the project root policy.`);
    if (entry.projectRootRelative !== true) errors.push(`${entry.id || "entry"} must be project-root-relative.`);
    if (typeof entry.canExecute !== "boolean") errors.push(`${entry.id || "entry"} canExecute must be boolean.`);
    if (!Array.isArray(entry.notes)) errors.push(`${entry.id || "entry"} notes must be an array.`);
    if (entry.operation === "write_file") {
      if (typeof entry.content !== "string") errors.push(`${entry.id || "entry"} write content must be a string.`);
      if (typeof entry.contentHash !== "string" || !entry.contentHash.trim()) errors.push(`${entry.id || "entry"} write contentHash is required.`);
      if (typeof entry.content === "string" && entry.contentHash !== stableHash(entry.content)) {
        errors.push(`${entry.id || "entry"} contentHash does not match entry content.`);
      }
    }
  }

  return uniqueSorted(errors);
}

function validateGateAgainstCanonicalPlan(
  gate: ProjectStoreIoGate,
  snapshot: ProjectStoreSnapshot,
): { entries: ProjectStoreIoEntry[]; errors: string[] } {
  const errors: string[] = [];
  const canonical = canonicalFactPaths(snapshot);
  errors.push(...canonical.errors);
  const expectedEntries = expectedEntriesForMode(snapshot, gate.mode);
  const expectedByKey = new Map(expectedEntries.map((entry) => [entryKey(entry), entry]));
  const gateEntries = readGateEntries(gate);
  const gateByKey = new Map(gateEntries.map((entry) => [entryKey(entry), entry]));
  const directoryAllowlist = directoryAllowlistFromFilePaths(canonical.paths);
  const gateWhitelist = uniqueSorted((Array.isArray(gate.whitelist) ? gate.whitelist : []).map((path) => normalizePath(String(path))));

  if (!arraysEqual(gateWhitelist, canonical.paths)) {
    errors.push("Gate whitelist does not match canonical Project Store fact file paths.");
  }

  for (const path of gateWhitelist) {
    if (isUnsafePath(path)) errors.push(`Gate whitelist path is outside the project root policy: ${path}`);
  }

  if (gateEntries.length !== expectedEntries.length) {
    errors.push("Gate entries do not match the canonical Project Store IO plan.");
  }

  for (const entry of gateEntries) {
    const key = entryKey(entry);
    const expected = expectedByKey.get(key);
    if (!expected) {
      errors.push(`${entry.id || key} is not part of the canonical Project Store IO plan.`);
      continue;
    }
    if (entry.id !== expected.id) errors.push(`${entry.id || key} id does not match the canonical Project Store IO plan.`);
    if (entry.role !== expected.role) errors.push(`${entry.id || key} role does not match the canonical Project Store IO plan.`);
    if (entry.canExecute !== true) errors.push(`${entry.id || key} must be executable only after executor validation.`);
    if (entry.operation === "create_directory" && !directoryAllowlist.includes(entry.path)) {
      errors.push(`${entry.id || key} directory is outside the canonical directory allowlist.`);
    }
    if (entry.operation !== "create_directory" && !canonical.paths.includes(entry.path)) {
      errors.push(`${entry.id || key} path is outside canonical Project Store fact file paths.`);
    }
    if (entry.operation === "write_file") {
      if (entry.content !== expected.content) errors.push(`${entry.id || key} content does not match canonical Project Store content.`);
      if (entry.contentHash !== expected.contentHash) errors.push(`${entry.id || key} contentHash does not match canonical Project Store content.`);
      if (entry.role === "runtime_state") {
        const parsed = parseJsonSafe(entry.content || "", entry.path);
        errors.push(...parsed.errors);
        if (parsed.value) {
          errors.push(...collectRuntimeStateSecurityErrors(parsed.value, entry.path));
          if (stableHash(parsed.value) !== stableHash(runtimeStateFactContent(snapshot))) {
            errors.push(`${entry.id || key} must write only the canonical derived runtime cache policy.`);
          }
        }
      }
    }
  }

  for (const expected of expectedEntries) {
    if (!gateByKey.has(entryKey(expected))) {
      errors.push(`${expected.id} is missing from the gate entries.`);
    }
  }

  return { entries: expectedEntries, errors: uniqueSorted(errors) };
}

function skipAllEntries(gate: ProjectStoreIoGate, reason: string): ProjectStoreIoExecutionResult["skipped"] {
  return readGateEntries(gate).map((entry) => ({ id: entry.id || entryKey(entry), reason }));
}

export function buildProjectStoreIoGate(input: BuildProjectStoreIoGateInput): ProjectStoreIoGate {
  const generatedAt = input.generatedAt || nowIso();
  const opened = input.serializedProjectVibe ? openSnapshotFromProjectVibe(input.serializedProjectVibe, generatedAt) : undefined;
  const snapshot = opened?.snapshot || input.snapshot || createProjectStoreSnapshot({ generatedAt });
  const snapshotValidation = opened?.validation || validateProjectStoreSnapshot(snapshot, generatedAt);
  const blockers = [...(opened?.blockers || []), ...snapshotValidation.errors, ...collectRuntimeStateSecurityErrors(input.runtimeState, "runtimeState")];
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
    ...(writeAllowed ? buildWriteEntries(snapshot, canExecute) : []),
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

  errors.push(...validateGateEnvelope(gate));
  if (!gate.canExecute) {
    errors.push(...(Array.isArray(gate.blockers) ? gate.blockers : ["Gate is blocked."]));
  }
  if (errors.length > 0) {
    return {
      ok: false,
      executed,
      skipped: skipAllEntries(gate, "Gate failed executor validation."),
      errors: uniqueSorted(errors),
    };
  }

  if (gate.mode === "open") {
    const projectVibeEntry = readGateEntries(gate).find((entry) => entry.operation === "read_file" && normalizePath(entry.path) === "project.vibe");
    try {
      const content = await adapter.readFile("project.vibe");
      executed.push({ id: projectVibeEntry?.id || "read_project_manifest", operation: "read_file", path: "project.vibe" });
      const opened = openSnapshotFromProjectVibe(content, gate.generatedAt);
      openedSnapshot = opened.snapshot;
      validation = opened.validation;
      errors.push(...opened.blockers, ...opened.validation.errors);

      if (opened.snapshot) {
        const canonicalPlan = validateGateAgainstCanonicalPlan(gate, opened.snapshot);
        errors.push(...canonicalPlan.errors);
        if (errors.length === 0) {
          const expectedHashes = new Map(opened.factFiles.map((factFile) => [normalizePath(factFile.path), factFile]));
          for (const entry of canonicalPlan.entries.filter((planEntry) => planEntry.path !== "project.vibe")) {
            try {
              const sidecarContent = await adapter.readFile(entry.path);
              const parsed = parseJsonSafe(sidecarContent, entry.path);
              errors.push(...parsed.errors);
              if (parsed.value) {
                const expectedHash = expectedHashes.get(entry.path);
                if (!expectedHash) {
                  errors.push(`${entry.path} is missing from project.vibe factFiles.`);
                } else if (stableHash(parsed.value) !== expectedHash.hash) {
                  errors.push(`${entry.path} hash mismatch: project.vibe=${expectedHash.hash} actual=${stableHash(parsed.value)}.`);
                }
                if (entry.role === "runtime_state") {
                  errors.push(...collectRuntimeStateSecurityErrors(parsed.value, entry.path));
                }
              }
              executed.push({ id: entry.id, operation: entry.operation, path: entry.path });
            } catch (error) {
              errors.push(`${entry.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
      }
    } catch (error) {
      errors.push(`read_project_manifest: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      ok: errors.length === 0,
      executed,
      skipped,
      errors: uniqueSorted(errors),
      openedSnapshot,
      validation,
    };
  }

  const projectVibeEntry = readGateEntries(gate).find((entry) => entry.operation === "write_file" && normalizePath(entry.path) === "project.vibe");
  if (!projectVibeEntry || typeof projectVibeEntry.content !== "string") {
    errors.push("Write mode requires a project.vibe write entry with canonical content.");
  } else if (projectVibeEntry.contentHash !== stableHash(projectVibeEntry.content)) {
    errors.push("project.vibe write entry contentHash does not match entry content.");
  } else {
    const opened = openSnapshotFromProjectVibe(projectVibeEntry.content, gate.generatedAt);
    openedSnapshot = opened.snapshot;
    validation = opened.validation;
    errors.push(...opened.blockers, ...opened.validation.errors);
    if (opened.snapshot) {
      const canonicalPlan = validateGateAgainstCanonicalPlan(gate, opened.snapshot);
      errors.push(...canonicalPlan.errors);
      if (errors.length === 0) {
        for (const entry of canonicalPlan.entries) {
          try {
            if (entry.operation === "create_directory") await adapter.mkdir(entry.path);
            if (entry.operation === "write_file") await adapter.writeFile(entry.path, entry.content || "");
            executed.push({ id: entry.id, operation: entry.operation, path: entry.path });
          } catch (error) {
            errors.push(`${entry.id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    executed,
    skipped,
    errors: uniqueSorted(errors),
    openedSnapshot,
    validation,
  };
}
