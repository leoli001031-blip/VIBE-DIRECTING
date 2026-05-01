import type {
  ExportPackagePlan,
  ExportProfile,
  ExportProfileKind,
  ProjectPreviewExportState,
} from "./types";
import type { ExportBuilderState } from "./exportBuilder";

export const exportWorkerSchemaVersion = "0.1.0";
export const exportWorkerPhase = "phase_27_export_worker_mvp";
export const exportWorkerScope = "export_project_io_contract";

export type ExportWorkerReadiness = "ready" | "planned" | "blocked";
export type ExportWorkerExecutionMode = "plan_only" | "adapter_execution";
export type ExportWorkerOperation = "create_directory" | "write_file";
export type ExportWorkerEntryKind =
  | "export_directory"
  | "export_manifest"
  | "storyboard_table"
  | "developer_archive"
  | "rough_cut_timeline"
  | "asset_package_manifest";

export interface ExportWorkerHardLocks {
  projectRootRelativeOnly: true;
  exportScopeOnly: true;
  noAbsolutePath: true;
  noParentTraversal: true;
  noDelete: true;
  noMove: true;
  noMediaRender: true;
  noProviderSubmit: true;
  liveSubmitAllowed: false;
  noCredentialRead: true;
  noCredentialWrite: true;
  noArbitraryShell: true;
  noUserFileOverwriteOutsideExport: true;
}

export interface ExportWorkerEntry {
  id: string;
  kind: ExportWorkerEntryKind;
  operation: ExportWorkerOperation;
  path: string;
  content?: string;
  contentHash?: string;
  mimeType?: "application/json" | "text/tab-separated-values";
  canExecute: boolean;
  projectRootRelative: true;
  notes: string[];
}

export interface ExportWorkerManifestFile {
  kind: Exclude<ExportWorkerEntryKind, "export_directory" | "export_manifest">;
  path: string;
  contentHash: string;
  profileKind?: ExportProfileKind;
}

export interface ExportWorkerManifest {
  manifestId: string;
  generatedAt: string;
  exportRoot: string;
  profileSelection: ExportProfileKind[];
  readiness: ExportWorkerReadiness;
  writeFilesOnly: true;
  textOnly: true;
  allowedOperations: ExportWorkerOperation[];
  allowedDirectories: string[];
  allowedWritePaths: string[];
  files: ExportWorkerManifestFile[];
  blockedProfileKinds: ExportProfileKind[];
  source: {
    schemaVersion: string;
    packagePlanId: string;
    packageStatus: ExportPackagePlan["status"];
    formalPreviewStatus: ProjectPreviewExportState["formalPreview"]["status"];
    draftPreviewStatus: ProjectPreviewExportState["draftPreview"]["status"];
  };
  notes: string[];
}

export interface BuildExportWorkerStateInput {
  source: ProjectPreviewExportState | ExportBuilderState;
  exportRoot: string;
  profileSelection?: ExportProfileKind[] | "all";
  generatedAt?: string;
  executionMode?: ExportWorkerExecutionMode;
  confirmation?: boolean;
  requestedOperations?: string[];
  providerSubmitRequested?: boolean;
  credentialReadRequested?: boolean;
  credentialWriteRequested?: boolean;
  arbitraryShellRequested?: boolean;
  mediaRenderRequested?: boolean;
  liveSubmitRequested?: boolean;
  futureNleTargetRequested?: boolean;
}

export interface ExportWorkerState {
  schemaVersion: typeof exportWorkerSchemaVersion;
  generatedAt: string;
  phase: typeof exportWorkerPhase;
  scope: typeof exportWorkerScope;
  rootRef: "project_root";
  exportRoot: string;
  executionMode: ExportWorkerExecutionMode;
  confirmationRequired: boolean;
  confirmed: boolean;
  readiness: ExportWorkerReadiness;
  canExecute: boolean;
  entries: ExportWorkerEntry[];
  manifest: ExportWorkerManifest;
  blockers: string[];
  warnings: string[];
  hardLocks: ExportWorkerHardLocks;
  notes: string[];
}

export interface ExportWorkerAdapter {
  mkdir(path: string): void | Promise<void>;
  writeFile(path: string, content: string): void | Promise<void>;
}

export interface ExportWorkerExecutionResult {
  ok: boolean;
  executed: Array<{ id: string; operation: ExportWorkerOperation; path: string }>;
  skipped: Array<{ id: string; reason: string }>;
  errors: string[];
}

interface PlannedDocument {
  kind: Exclude<ExportWorkerEntryKind, "export_directory">;
  fileName: string;
  profileKind?: ExportProfileKind;
  mimeType: "application/json" | "text/tab-separated-values";
  content: string;
}

const hardLocks: ExportWorkerHardLocks = {
  projectRootRelativeOnly: true,
  exportScopeOnly: true,
  noAbsolutePath: true,
  noParentTraversal: true,
  noDelete: true,
  noMove: true,
  noMediaRender: true,
  noProviderSubmit: true,
  liveSubmitAllowed: false,
  noCredentialRead: true,
  noCredentialWrite: true,
  noArbitraryShell: true,
  noUserFileOverwriteOutsideExport: true,
};

const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/])/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;
const credentialKeyPattern = /(?:credential|token|api_?key|secret|password|auth)/i;
const validProfileKinds: ExportProfileKind[] = ["rough_cut", "asset_package", "storyboard_table", "developer_archive"];
const validOperations: ExportWorkerOperation[] = ["create_directory", "write_file"];
const allowedFileNames: Record<Exclude<ExportWorkerEntryKind, "export_directory">, string> = {
  export_manifest: "export_manifest.json",
  storyboard_table: "storyboard_table.tsv",
  developer_archive: "developer_archive.json",
  rough_cut_timeline: "rough_cut_timeline.json",
  asset_package_manifest: "asset_package_manifest.json",
};

function nowIso(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function joinPath(root: string, fileName: string): string {
  return normalizePath(`${root}/${fileName}`);
}

function directoryOf(path: string): string | undefined {
  const normalized = normalizePath(path);
  const parts = normalized.split("/");
  if (parts.length <= 1) return undefined;
  return parts.slice(0, -1).join("/");
}

function isUnsafePath(path: string): boolean {
  const normalized = path.trim().replace(/\\/g, "/");
  return absolutePathPattern.test(path.trim()) || parentTraversalPattern.test(normalized) || !normalizePath(path);
}

function isAllowedExportPath(path: string): boolean {
  const normalized = normalizePath(path);
  return (
    normalized === "exports" ||
    normalized.startsWith("exports/") ||
    normalized === "reports/exports" ||
    normalized.startsWith("reports/exports/")
  );
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function uniqueProfileKinds(values: ExportProfileKind[]): ExportProfileKind[] {
  const seen = new Set<ExportProfileKind>();
  const result: ExportProfileKind[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function profileByKind(source: ProjectPreviewExportState): Map<ExportProfileKind, ExportProfile> {
  return new Map(source.exportProfiles.map((profile) => [profile.kind, profile]));
}

function selectedProfileKinds(source: ProjectPreviewExportState, selection?: ExportProfileKind[] | "all"): ExportProfileKind[] {
  if (!selection || selection === "all") return validProfileKinds.filter((kind) => profileByKind(source).has(kind));
  return uniqueProfileKinds(selection.filter((kind) => validProfileKinds.includes(kind)));
}

function activePreview(source: ProjectPreviewExportState): ProjectPreviewExportState["formalPreview"] {
  return source.formalPreview.status === "ready" ? source.formalPreview : source.draftPreview;
}

function tsvValue(value: unknown): string {
  return String(value ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function storyboardTable(source: ProjectPreviewExportState): string {
  const rows = activePreview(source).events.map((event) => [
    event.shotId || "",
    event.mode,
    event.type,
    event.startSeconds,
    event.durationSeconds,
    event.mediaPath || "",
    event.qaStatus,
  ]);
  return [
    ["shot_id", "mode", "type", "start_seconds", "duration_seconds", "media_path", "qa_status"].join("\t"),
    ...rows.map((row) => row.map(tsvValue).join("\t")),
  ].join("\n") + "\n";
}

function roughCutTimeline(source: ProjectPreviewExportState, generatedAt: string): string {
  const preview = activePreview(source);
  return serialize({
    schemaVersion: exportWorkerSchemaVersion,
    kind: "rough_cut_timeline_manifest",
    generatedAt,
    sourcePreviewPlanId: preview.planId,
    previewStatus: preview.status,
    roughCutProxy: source.roughCutProxy,
    events: preview.events,
    renderMedia: false,
    futureNleFilesGenerated: false,
    notes: ["Text timeline manifest only; no media is rendered and no NLE project file is generated."],
  });
}

function assetPackageManifest(source: ProjectPreviewExportState, generatedAt: string): string {
  const assetProfile = source.exportProfiles.find((profile) => profile.kind === "asset_package");
  return serialize({
    schemaVersion: exportWorkerSchemaVersion,
    kind: "asset_package_manifest",
    generatedAt,
    profile: assetProfile,
    copyFiles: false,
    moveFiles: false,
    packageMedia: false,
    includedPathsAreReferencesOnly: true,
    notes: ["Asset package is a text manifest of project-root-relative references only."],
  });
}

function developerArchive(source: ProjectPreviewExportState, generatedAt: string): string {
  const builderLike = source as ExportBuilderState;
  return serialize({
    schemaVersion: exportWorkerSchemaVersion,
    kind: "developer_archive_manifest",
    generatedAt,
    formalPreviewGate: source.formalPreviewGate,
    exportPackagePlan: source.exportPackagePlan,
    developerArchiveProfile: source.exportProfiles.find((profile) => profile.kind === "developer_archive"),
    futureTargets: Array.isArray(builderLike.futureTargets) ? builderLike.futureTargets : [],
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    credentialMaterialIncluded: false,
    notes: ["Prompt and QA traceability is preserved as JSON only; provider submission remains blocked."],
  });
}

function profileDocuments(source: ProjectPreviewExportState, selectedKinds: ExportProfileKind[], generatedAt: string): PlannedDocument[] {
  const documents: PlannedDocument[] = [];
  if (selectedKinds.includes("storyboard_table")) {
    documents.push({
      kind: "storyboard_table",
      fileName: allowedFileNames.storyboard_table,
      profileKind: "storyboard_table",
      mimeType: "text/tab-separated-values",
      content: storyboardTable(source),
    });
  }
  if (selectedKinds.includes("developer_archive")) {
    documents.push({
      kind: "developer_archive",
      fileName: allowedFileNames.developer_archive,
      profileKind: "developer_archive",
      mimeType: "application/json",
      content: developerArchive(source, generatedAt),
    });
  }
  if (selectedKinds.includes("rough_cut")) {
    documents.push({
      kind: "rough_cut_timeline",
      fileName: allowedFileNames.rough_cut_timeline,
      profileKind: "rough_cut",
      mimeType: "application/json",
      content: roughCutTimeline(source, generatedAt),
    });
  }
  if (selectedKinds.includes("asset_package")) {
    documents.push({
      kind: "asset_package_manifest",
      fileName: allowedFileNames.asset_package_manifest,
      profileKind: "asset_package",
      mimeType: "application/json",
      content: assetPackageManifest(source, generatedAt),
    });
  }
  return documents;
}

function expectedManifestFileKinds(selectedKinds: ExportProfileKind[]): Array<Exclude<ExportWorkerEntryKind, "export_directory" | "export_manifest">> {
  const kinds: Array<Exclude<ExportWorkerEntryKind, "export_directory" | "export_manifest">> = [];
  if (selectedKinds.includes("storyboard_table")) kinds.push("storyboard_table");
  if (selectedKinds.includes("developer_archive")) kinds.push("developer_archive");
  if (selectedKinds.includes("rough_cut")) kinds.push("rough_cut_timeline");
  if (selectedKinds.includes("asset_package")) kinds.push("asset_package_manifest");
  return kinds;
}

function expectedWritePaths(exportRoot: string, selectedKinds: ExportProfileKind[]): string[] {
  return [
    joinPath(exportRoot, allowedFileNames.export_manifest),
    ...expectedManifestFileKinds(selectedKinds).map((kind) => joinPath(exportRoot, allowedFileNames[kind])),
  ];
}

function expectedDirectoryPathsFromWritePaths(writePaths: string[]): string[] {
  return uniqueSorted(writePaths.flatMap((path) => {
    const dirs: string[] = [];
    let current = directoryOf(path);
    while (current) {
      if (isAllowedExportPath(current)) dirs.push(current);
      current = directoryOf(current);
    }
    return dirs;
  }));
}

function collectCredentialKeyErrors(value: unknown, label = "input"): string[] {
  const errors: string[] = [];
  const visit = (current: unknown, path: string): void => {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!isRecord(current)) return;
    for (const [key, child] of Object.entries(current)) {
      const childPath = `${path}.${key}`;
      if (credentialKeyPattern.test(key.replace(/[-\s]/g, "_"))) {
        errors.push(`${childPath} is blocked because export worker cannot read, write, or persist credential material.`);
      }
      visit(child, childPath);
    }
  };
  visit(value, label);
  return uniqueSorted(errors);
}

function inputBlockers(input: BuildExportWorkerStateInput, exportRoot: string, selectedKinds: ExportProfileKind[]): string[] {
  const blockers: string[] = [];
  const normalizedRoot = normalizePath(exportRoot);
  const source = input.source;
  const profiles = profileByKind(source);
  const operations = input.requestedOperations || [];
  const builderLike = source as ExportBuilderState;

  if (isUnsafePath(exportRoot)) blockers.push(`Export root must be a normalized project-root-relative path: ${exportRoot}`);
  if (!isAllowedExportPath(normalizedRoot)) blockers.push(`Export root must be inside exports/ or reports/exports/: ${exportRoot}`);
  if (!source || !Array.isArray(source.exportProfiles)) blockers.push("Export worker source must include export profiles.");
  if (selectedKinds.length === 0) blockers.push("At least one supported export profile must be selected.");
  if (input.profileSelection !== "all" && Array.isArray(input.profileSelection)) {
    for (const kind of input.profileSelection) {
      if (!validProfileKinds.includes(kind)) blockers.push(`Unsupported export profile selected: ${String(kind)}`);
    }
  }
  for (const kind of selectedKinds) {
    const profile = profiles.get(kind);
    if (!profile) blockers.push(`Selected profile is missing from source export state: ${kind}`);
    if (profile?.readiness === "blocked") blockers.push(`Selected profile is blocked: ${kind}`);
  }
  if (operations.some((operation) => !validOperations.includes(operation as ExportWorkerOperation))) {
    blockers.push("Requested operations include a mutation outside create_directory/write_file.");
  }
  if (operations.some((operation) => /delete|move|copy|render/i.test(operation))) {
    blockers.push("delete, move, copy, and render operations are blocked by Phase 27 hard locks.");
  }
  if (input.providerSubmitRequested) blockers.push("Provider submit is blocked for export worker.");
  if (input.credentialReadRequested) blockers.push("Credential read is blocked for export worker.");
  if (input.credentialWriteRequested) blockers.push("Credential write is blocked for export worker.");
  if (input.arbitraryShellRequested) blockers.push("Arbitrary shell is blocked for export worker.");
  if (input.mediaRenderRequested) blockers.push("Media render is blocked for export worker.");
  if (input.liveSubmitRequested) blockers.push("Live submit is blocked for export worker.");
  if (input.futureNleTargetRequested) blockers.push("Future NLE target generation is blocked in Phase 27 MVP.");
  if (Array.isArray(builderLike.futureTargets)) {
    for (const target of builderLike.futureTargets) {
      if (target.enabled !== false || target.writesFile !== false) {
        blockers.push(`Future NLE target must remain disabled and non-writing: ${target.target}`);
      }
    }
  }
  blockers.push(...collectCredentialKeyErrors(input.source, "source"));
  return uniqueSorted(blockers);
}

function createDirectoryEntries(paths: string[], canExecute: boolean): ExportWorkerEntry[] {
  return uniqueSorted(paths).map((path) => ({
    id: `mkdir_${stableHash(path).replace(/^vck_/, "")}`,
    kind: "export_directory",
    operation: "create_directory",
    path,
    canExecute,
    projectRootRelative: true,
    notes: ["Directory creation is limited to exports/ or reports/exports/ under the selected project root."],
  }));
}

function createWriteEntry(document: PlannedDocument, exportRoot: string, canExecute: boolean): ExportWorkerEntry {
  const path = joinPath(exportRoot, document.fileName);
  return {
    id: `write_${document.kind}`,
    kind: document.kind,
    operation: "write_file",
    path,
    content: document.content,
    contentHash: stableHash(document.content),
    mimeType: document.mimeType,
    canExecute,
    projectRootRelative: true,
    notes: ["Text manifest write only; no media file, provider submission, or NLE project generation is performed."],
  };
}

function manifestDocument(
  source: ProjectPreviewExportState,
  generatedAt: string,
  exportRoot: string,
  selectedKinds: ExportProfileKind[],
  readiness: ExportWorkerReadiness,
  writeEntries: ExportWorkerEntry[],
  directoryEntries: ExportWorkerEntry[],
  blockedProfileKinds: ExportProfileKind[],
): PlannedDocument {
  const files: ExportWorkerManifestFile[] = writeEntries
    .filter((entry) => entry.kind !== "export_manifest" && entry.kind !== "export_directory")
    .map((entry) => ({
      kind: entry.kind as Exclude<ExportWorkerEntryKind, "export_directory" | "export_manifest">,
      path: entry.path,
      contentHash: entry.contentHash || "",
      profileKind: selectedKinds.find((kind) => entry.id.includes(kind)),
    }));
  const manifest: ExportWorkerManifest = {
    manifestId: `export_worker_${stableHash({ generatedAt, exportRoot, selectedKinds }).replace(/^vck_/, "")}`,
    generatedAt,
    exportRoot,
    profileSelection: selectedKinds,
    readiness,
    writeFilesOnly: true,
    textOnly: true,
    allowedOperations: [...validOperations],
    allowedDirectories: directoryEntries.map((entry) => entry.path),
    allowedWritePaths: writeEntries.map((entry) => entry.path),
    files,
    blockedProfileKinds,
    source: {
      schemaVersion: source.schemaVersion,
      packagePlanId: source.exportPackagePlan.planId,
      packageStatus: source.exportPackagePlan.status,
      formalPreviewStatus: source.formalPreview.status,
      draftPreviewStatus: source.draftPreview.status,
    },
    notes: [
      "Manifest lists text/JSON/TSV export artifacts only.",
      "Media copy, media render, provider submission, credential IO, arbitrary shell, and future NLE files remain blocked.",
    ],
  };
  return {
    kind: "export_manifest",
    fileName: allowedFileNames.export_manifest,
    mimeType: "application/json",
    content: serialize(manifest),
  };
}

function entryKey(entry: Pick<ExportWorkerEntry, "operation" | "path">): string {
  return `${entry.operation}:${normalizePath(entry.path)}`;
}

function readEntries(state: ExportWorkerState): ExportWorkerEntry[] {
  const rawState = state as unknown;
  return isRecord(rawState) && Array.isArray(rawState.entries) ? rawState.entries as ExportWorkerEntry[] : [];
}

function skipAllEntries(state: ExportWorkerState, reason: string): ExportWorkerExecutionResult["skipped"] {
  return readEntries(state).map((entry) => ({ id: entry.id || entryKey(entry), reason }));
}

function validateStateEnvelope(state: ExportWorkerState): string[] {
  const errors: string[] = [];
  const rawState = state as unknown;
  if (!isRecord(rawState)) return ["Export worker state must be an object."];

  if (state.schemaVersion !== exportWorkerSchemaVersion) errors.push("Export worker schemaVersion is invalid.");
  if (state.phase !== exportWorkerPhase) errors.push("Export worker phase is invalid.");
  if (state.scope !== exportWorkerScope) errors.push("Export worker scope is invalid.");
  if (state.rootRef !== "project_root") errors.push("Export worker rootRef must be project_root.");
  if (!["plan_only", "adapter_execution"].includes(state.executionMode)) errors.push("Export worker executionMode is invalid.");
  if (typeof state.generatedAt !== "string" || !state.generatedAt.trim()) errors.push("Export worker generatedAt is required.");
  if (state.exportRoot !== normalizePath(state.exportRoot)) errors.push("Export root must be normalized.");
  if (isUnsafePath(state.exportRoot)) errors.push("Export root must be project-root-relative.");
  if (!isAllowedExportPath(state.exportRoot)) errors.push("Export root must stay inside exports/ or reports/exports/.");
  if (!isRecord(state.manifest)) errors.push("Export worker manifest must be an object.");
  if (!Array.isArray(state.entries)) errors.push("Export worker entries must be an array.");
  if (!Array.isArray(state.blockers)) errors.push("Export worker blockers must be an array.");
  if (!Array.isArray(state.warnings)) errors.push("Export worker warnings must be an array.");
  if (!Array.isArray(state.notes)) errors.push("Export worker notes must be an array.");

  if (!isRecord(state.hardLocks)) {
    errors.push("Export worker hardLocks must be an object.");
  } else {
    for (const key of Object.keys(hardLocks) as Array<keyof ExportWorkerHardLocks>) {
      if (state.hardLocks[key] !== hardLocks[key]) errors.push(`Export worker hard lock ${key} drifted.`);
    }
  }

  const allowedDirectories = new Set(Array.isArray(state.manifest?.allowedDirectories) ? state.manifest.allowedDirectories : []);
  const allowedWritePaths = new Set(Array.isArray(state.manifest?.allowedWritePaths) ? state.manifest.allowedWritePaths : []);
  const manifestProfileSelection = Array.isArray(state.manifest?.profileSelection)
    ? state.manifest.profileSelection.filter((kind): kind is ExportProfileKind => validProfileKinds.includes(kind as ExportProfileKind))
    : [];
  const expectedWrites = expectedWritePaths(state.exportRoot || "", manifestProfileSelection);
  const expectedDirs = expectedDirectoryPathsFromWritePaths(expectedWrites);
  const manifestFiles = new Map(
    (Array.isArray(state.manifest?.files) ? state.manifest.files : [])
      .filter((file) => isRecord(file))
      .map((file) => [String(file.path), file as ExportWorkerManifestFile]),
  );

  if (isRecord(state.manifest)) {
    if (state.manifest.generatedAt !== state.generatedAt) errors.push("Manifest generatedAt must match export worker state.");
    if (state.manifest.exportRoot !== state.exportRoot) errors.push("Manifest exportRoot must match export worker state.");
    if (state.manifest.readiness !== state.readiness) errors.push("Manifest readiness must match export worker state.");
    if (!arraysEqual(uniqueSorted(state.manifest.allowedOperations || []), validOperations)) {
      errors.push("Manifest allowedOperations must be exactly create_directory/write_file.");
    }
    if (!arraysEqual(uniqueSorted(state.manifest.allowedWritePaths || []), uniqueSorted(expectedWrites))) {
      errors.push("Manifest allowedWritePaths do not match exportRoot/profileSelection.");
    }
    if (!arraysEqual(uniqueSorted(state.manifest.allowedDirectories || []), expectedDirs)) {
      errors.push("Manifest allowedDirectories do not match exportRoot/profileSelection.");
    }
    if (!arraysEqual(uniqueSorted((state.manifest.files || []).map((file) => file.path)), uniqueSorted(expectedWrites.filter((path) => !path.endsWith(allowedFileNames.export_manifest))))) {
      errors.push("Manifest files do not match selected profile text outputs.");
    }
    for (const path of [...(state.manifest.allowedDirectories || []), ...(state.manifest.allowedWritePaths || [])]) {
      if (path !== normalizePath(path) || isUnsafePath(path) || !isAllowedExportPath(path)) {
        errors.push(`Manifest allowlist path is outside export scope: ${path}`);
      }
    }
  }

  for (const entry of readEntries(state)) {
    if (!isRecord(entry)) {
      errors.push("Export worker entry must be an object.");
      continue;
    }
    if (typeof entry.id !== "string" || !entry.id.trim()) errors.push("Export worker entry id is required.");
    if (!["export_directory", "export_manifest", "storyboard_table", "developer_archive", "rough_cut_timeline", "asset_package_manifest"].includes(entry.kind)) {
      errors.push(`${entry.id || "entry"} has an invalid kind.`);
    }
    if (!validOperations.includes(entry.operation)) errors.push(`${entry.id || "entry"} has an invalid operation.`);
    if (entry.path !== normalizePath(entry.path)) errors.push(`${entry.id || "entry"} path must be normalized.`);
    if (isUnsafePath(entry.path)) errors.push(`${entry.id || "entry"} path must be project-root-relative.`);
    if (!isAllowedExportPath(entry.path)) errors.push(`${entry.id || "entry"} path must stay inside exports/ or reports/exports/.`);
    if (entry.projectRootRelative !== true) errors.push(`${entry.id || "entry"} must be project-root-relative.`);
    if (typeof entry.canExecute !== "boolean") errors.push(`${entry.id || "entry"} canExecute must be boolean.`);
    if (!Array.isArray(entry.notes)) errors.push(`${entry.id || "entry"} notes must be an array.`);
    if (entry.operation === "create_directory") {
      if (entry.kind !== "export_directory") errors.push(`${entry.id || "entry"} create_directory must use export_directory kind.`);
      if (!allowedDirectories.has(entry.path)) errors.push(`${entry.id || "entry"} directory is not manifest-allowlisted.`);
      if (typeof entry.content === "string") errors.push(`${entry.id || "entry"} directory entry cannot include content.`);
    }
    if (entry.operation === "write_file") {
      if (!allowedWritePaths.has(entry.path)) errors.push(`${entry.id || "entry"} write path is not manifest-allowlisted.`);
      const fileName = entry.path.split("/").at(-1) || "";
      if (!Object.values(allowedFileNames).includes(fileName)) errors.push(`${entry.id || "entry"} write file name is not allowed.`);
      if (typeof entry.content !== "string") errors.push(`${entry.id || "entry"} write content must be a string.`);
      if (typeof entry.contentHash !== "string" || !entry.contentHash.trim()) errors.push(`${entry.id || "entry"} write contentHash is required.`);
      if (typeof entry.content === "string" && entry.contentHash !== stableHash(entry.content)) {
        errors.push(`${entry.id || "entry"} contentHash does not match entry content.`);
      }
      if (entry.kind !== "export_manifest") {
        const manifestFile = manifestFiles.get(entry.path);
        if (!manifestFile) {
          errors.push(`${entry.id || "entry"} write path is missing from manifest files.`);
        } else if (manifestFile.contentHash !== entry.contentHash) {
          errors.push(`${entry.id || "entry"} contentHash does not match manifest file hash.`);
        }
      }
    }
  }

  if (state.entries.some((entry) => entry.canExecute !== state.canExecute)) {
    errors.push("Entry canExecute flags must match export worker canExecute.");
  }
  if (state.canExecute && (state.executionMode !== "adapter_execution" || state.confirmed !== true)) {
    errors.push("Export worker canExecute requires adapter_execution mode and explicit confirmation.");
  }
  if (state.canExecute && Array.isArray(state.blockers) && state.blockers.length > 0) {
    errors.push("Export worker canExecute cannot be true while blockers are present.");
  }

  return uniqueSorted(errors);
}

export function buildExportWorkerState(input: BuildExportWorkerStateInput): ExportWorkerState {
  const generatedAt = input.generatedAt || nowIso();
  const exportRoot = normalizePath(input.exportRoot);
  const executionMode = input.executionMode || "plan_only";
  const confirmed = input.confirmation === true;
  const selectedKinds = selectedProfileKinds(input.source, input.profileSelection);
  const blockers = inputBlockers(input, input.exportRoot, selectedKinds);
  const blockedProfileKinds = selectedKinds.filter((kind) => profileByKind(input.source).get(kind)?.readiness === "blocked");
  const readiness: ExportWorkerReadiness = blockers.length ? "blocked" : executionMode === "adapter_execution" && confirmed ? "ready" : "planned";
  const canExecute = readiness === "ready";
  const profileDocs = profileDocuments(input.source, selectedKinds, generatedAt);
  const profileWriteEntries = profileDocs.map((document) => createWriteEntry(document, exportRoot, canExecute));
  const directoryPaths = uniqueSorted([
    exportRoot,
    ...profileWriteEntries.flatMap((entry) => {
      const dirs: string[] = [];
      let current = directoryOf(entry.path);
      while (current) {
        dirs.push(current);
        current = directoryOf(current);
      }
      return dirs;
    }),
  ].filter(isAllowedExportPath));
  const directoryEntries = createDirectoryEntries(directoryPaths, canExecute);
  const manifestDoc = manifestDocument(
    input.source,
    generatedAt,
    exportRoot,
    selectedKinds,
    readiness,
    profileWriteEntries,
    directoryEntries,
    blockedProfileKinds,
  );
  const manifestEntry = createWriteEntry(manifestDoc, exportRoot, canExecute);
  const parsedManifest = JSON.parse(manifestDoc.content) as ExportWorkerManifest;
  parsedManifest.allowedWritePaths = [manifestEntry.path, ...parsedManifest.allowedWritePaths];
  manifestEntry.content = serialize(parsedManifest);
  manifestEntry.contentHash = stableHash(manifestEntry.content);

  const entries = [...directoryEntries, manifestEntry, ...profileWriteEntries];
  const warnings = uniqueSorted([
    ...(executionMode === "plan_only" ? ["Plan-only mode builds export entries but does not authorize adapter mutation."] : []),
    ...input.source.exportProfiles
      .filter((profile) => selectedKinds.includes(profile.kind) && profile.readiness === "draft_only")
      .map((profile) => `${profile.kind} export is based on draft-only preview material.`),
  ]);

  return {
    schemaVersion: exportWorkerSchemaVersion,
    generatedAt,
    phase: exportWorkerPhase,
    scope: exportWorkerScope,
    rootRef: "project_root",
    exportRoot,
    executionMode,
    confirmationRequired: true,
    confirmed,
    readiness,
    canExecute,
    entries,
    manifest: parsedManifest,
    blockers,
    warnings,
    hardLocks,
    notes: [
      "Phase 27 Export Worker MVP only creates export directories and writes text manifests under exports/ or reports/exports/.",
      "It does not copy or move media, render media, submit providers, read or write credentials, execute shell, or generate future NLE project files.",
    ],
  };
}

export async function executeExportWorkerPlan(
  state: ExportWorkerState,
  adapter: ExportWorkerAdapter,
): Promise<ExportWorkerExecutionResult> {
  const executed: ExportWorkerExecutionResult["executed"] = [];
  const errors = validateStateEnvelope(state);

  if (!state.canExecute) errors.push(...(Array.isArray(state.blockers) && state.blockers.length ? state.blockers : ["Export worker state is not executable."]));
  if (errors.length > 0) {
    return {
      ok: false,
      executed,
      skipped: skipAllEntries(state, "Export worker failed preflight validation."),
      errors: uniqueSorted(errors),
    };
  }

  for (const entry of readEntries(state)) {
    try {
      if (entry.operation === "create_directory") {
        await adapter.mkdir(entry.path);
      } else if (entry.operation === "write_file") {
        await adapter.writeFile(entry.path, entry.content || "");
      } else {
        errors.push(`${entry.id}: unsupported operation ${String(entry.operation)}`);
        continue;
      }
      executed.push({ id: entry.id, operation: entry.operation, path: entry.path });
    } catch (error) {
      errors.push(`${entry.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    ok: errors.length === 0,
    executed,
    skipped: [],
    errors: uniqueSorted(errors),
  };
}
