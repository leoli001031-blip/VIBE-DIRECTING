import type {
  BaseHardLocks,
  ExportPackagePlan,
  ExportProfile,
  ExportProfileKind,
  AudioPlanningState,
  DemoPackageDirectorStrategyEvidence,
  DemoPackageReferenceEvidence,
  DemoPackageVideoResult,
  ProjectPreviewExportState,
} from "./types";
import type { ExportBuilderState } from "./exportBuilder";
import type { KnowledgePack } from "./knowledgeTypes";
import type { ProjectVibeDocument } from "../project/types";
import { buildFinalVideoCompositionPlan } from "./finalVideoPlan";
import {
  JIMENG_CLI_DEFAULT_RESUME_INTERVAL_SECONDS,
  JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES,
} from "./jimengVideoCli";

export const exportWorkerSchemaVersion = "0.1.0";
export const exportWorkerPhase = "phase_27_export_worker_mvp";
export const exportWorkerScope = "export_project_io_contract";

export type ExportWorkerReadiness = "ready" | "planned" | "blocked";
export type ExportWorkerExecutionMode = "plan_only" | "adapter_execution";
export type ExportWorkerOperation = "create_directory" | "write_file" | "copy_file";
export type ExportWorkerEntryKind =
  | "export_directory"
  | "export_manifest"
  | "project_vibe"
  | "locked_assets_manifest"
  | "preview_media_manifest"
  | "receipts_manifest"
  | "knowledge_references_manifest"
  | "export_report"
  | "video_manifest"
  | "video_receipts_manifest"
  | "video_report"
  | "final_video_manifest"
  | "final_video_file"
  | "audio_manifest"
  | "storyboard_table"
  | "developer_archive"
  | "rough_cut_timeline"
  | "asset_package_manifest";

export interface ExportWorkerHardLocks extends BaseHardLocks {
  projectRootRelativeOnly: true;
  exportScopeOnly: true;
  noAbsolutePath: true;
  noParentTraversal: true;
  noDelete: true;
  noMove: true;
  noMediaRender: true;
  noProviderSubmit: true;
  noArbitraryShell: true;
  noUserFileOverwriteOutsideExport: true;
}

export interface ExportWorkerEntry {
  id: string;
  kind: ExportWorkerEntryKind;
  operation: ExportWorkerOperation;
  path: string;
  sourcePath?: string;
  shotId?: string;
  content?: string;
  contentHash?: string;
  sourceHash?: string;
  mimeType?: "application/json" | "text/tab-separated-values" | "text/markdown";
  canExecute: boolean;
  projectRootRelative: true;
  notes: string[];
}

export interface ExportWorkerManifestFile {
  kind: Exclude<ExportWorkerEntryKind, "export_directory" | "export_manifest" | "final_video_file">;
  path: string;
  contentHash: string;
  profileKind?: ExportProfileKind;
}

export interface ExportWorkerManifestMediaFile {
  kind: "final_video_file";
  sourcePath: string;
  path: string;
  sourceHash?: string;
  shotId?: string;
  copyStatus: "copy_ready" | "hash_unverified";
}

export interface ExportWorkerManifest {
  manifestId: string;
  generatedAt: string;
  exportRoot: string;
  profileSelection: ExportProfileKind[];
  readiness: ExportWorkerReadiness;
  writeFilesOnly: false;
  textOnly: false;
  allowedOperations: ExportWorkerOperation[];
  allowedDirectories: string[];
  allowedWritePaths: string[];
  allowedCopyPaths: string[];
  allowedCopySources: string[];
  files: ExportWorkerManifestFile[];
  mediaFiles: ExportWorkerManifestMediaFile[];
  blockedProfileKinds: ExportProfileKind[];
	  mvpPackage: {
	    projectVibeIncluded: boolean;
	    lockedAssetCount: number;
	    previewMediaCount: number;
	    videoResultCount: number;
	    videoNeedsReviewCount: number;
	    videoApprovedCount: number;
	    videoMissingCount: number;
	    finalVideoCopyCount: number;
	    referenceEvidenceCount?: number;
	    receiptCount: number;
	    knowledgeReferenceCount: number;
	    videoReportIncluded: boolean;
	    finalVideoManifestIncluded: boolean;
	    audioManifestIncluded: boolean;
	    reportIncluded: boolean;
	  };
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
  projectVibe?: ProjectVibeDocument;
  projectLocalKnowledgePacks?: KnowledgePack[];
  audioPlanning?: AudioPlanningState;
  projectTitle?: string;
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
  copyFile?(sourcePath: string, destinationPath: string): void | Promise<void>;
}

export interface ExportWorkerExecutionResult {
  ok: boolean;
  executed: Array<{ id: string; operation: ExportWorkerOperation; path: string }>;
  skipped: Array<{ id: string; reason: string }>;
  errors: string[];
}

interface PlannedDocument {
  kind: Exclude<ExportWorkerEntryKind, "export_directory" | "final_video_file">;
  fileName: string;
  profileKind?: ExportProfileKind;
  mimeType: "application/json" | "text/tab-separated-values" | "text/markdown";
  content: string;
}

interface PlannedCopy {
  kind: "final_video_file";
  sourcePath: string;
  destinationFileName: string;
  sourceHash?: string;
  shotId?: string;
  copyStatus: "copy_ready" | "hash_unverified";
}

const hardLocks: ExportWorkerHardLocks = {
  dryRunOnly: true,
  liveSubmitAllowed: false,
  providerSubmissionForbidden: true,
  noFileMutation: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noShellExecution: true,
  noWorkerSpawn: true,
  projectRootRelativeOnly: true,
  exportScopeOnly: true,
  noAbsolutePath: true,
  noParentTraversal: true,
  noDelete: true,
  noMove: true,
  noMediaRender: true,
  noProviderSubmit: true,
  noArbitraryShell: true,
  noUserFileOverwriteOutsideExport: true,
};

const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/])/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;
const credentialKeyPattern = /(?:credential|token|api_?key|secret|password|auth)/i;
const credentialValuePattern = /(?:bearer\s+[a-z0-9._~+/-]+|sk-[a-z0-9_-]{12,}|tvly-[a-z0-9_-]{4,}|(?:api[_-]?key|authorization|access[_-]?token|auth[_-]?token|secret|password)\s*[:=]\s*["']?[a-z0-9._~+/-]{8,})/i;
const embeddedAbsolutePathPattern = /(?:^|[#:=\s])(?:[A-Za-z]:[\\/]|\/Users\/|\/private\/|\/tmp\/|~[\\/]|\/\/)/;
const sensitiveLeafKeyPattern = /^(?:api[_-]?key|authorization|access[_-]?token|auth[_-]?token|secret|password|private[_-]?key)$/i;
const validProfileKinds: ExportProfileKind[] = ["rough_cut", "asset_package", "storyboard_table", "developer_archive"];
const validOperations: ExportWorkerOperation[] = ["create_directory", "write_file", "copy_file"];
const allowedFileNames: Record<Exclude<ExportWorkerEntryKind, "export_directory">, string> = {
  export_manifest: "export_manifest.json",
  project_vibe: "Project.vibe",
  locked_assets_manifest: "locked_assets.json",
  preview_media_manifest: "preview_media.json",
  receipts_manifest: "receipts.json",
  knowledge_references_manifest: "knowledge_references.json",
  export_report: "report.md",
  video_manifest: "videos/video_manifest.json",
  video_receipts_manifest: "receipts/video/video_receipts.json",
  video_report: "video-report/summary.md",
  final_video_manifest: "final-video/composition_manifest.json",
  final_video_file: "final-video/__media_placeholder__.mp4",
  audio_manifest: "audio/manifest.json",
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

function containsUnsafeReference(value: string): boolean {
  const normalized = value.trim().replace(/\\/g, "/");
  return embeddedAbsolutePathPattern.test(normalized) || parentTraversalPattern.test(normalized) || credentialValuePattern.test(value);
}

function safeRefValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const structured = trimmed.match(/^(knowledge_pack|knowledge_pack_hash|knowledge_pack_path|web_search_evidence|web_search_evidence_path|web_citation)#(.+)$/);
  if (structured && containsUnsafeReference(structured[2])) return `${structured[1]}#redacted_ref#${stableHash(structured[2])}`;
  if (containsUnsafeReference(trimmed)) return `redacted_ref#${stableHash(trimmed)}`;
  return trimmed;
}

function sanitizeExportValue(value: unknown, key = ""): unknown {
  if (typeof value === "string") {
    if (sensitiveLeafKeyPattern.test(key) && value.trim() && !/^(?:\[REDACTED\]|REDACTED|\*\*\*\*)$/i.test(value.trim())) {
      return `redacted_secret#${stableHash(value)}`;
    }
    return safeRefValue(value);
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeExportValue(item));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([childKey, childValue]) => [childKey, sanitizeExportValue(childValue, childKey)]),
  );
}

function serializeExportValue(value: unknown): string {
  return serialize(sanitizeExportValue(value));
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

function isAllowedCopySourcePath(path: string | undefined): path is string {
  if (!path || isUnsafePath(path)) return false;
  if (!videoOutputPath(path)) return false;
  return !path.startsWith("redacted_ref#") && !path.startsWith("redacted_path#");
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
  return safeRefValue(String(value ?? "")).replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function storyboardTable(source: ProjectPreviewExportState): string {
  if (source.demoPackageFacts?.storyboardRows.length) {
    const rows = source.demoPackageFacts.storyboardRows.map((row) => [
      row.shotId,
      row.actId,
      row.sectionId || "",
      row.title,
      row.storyFunction,
      row.shotStatus,
      row.previewEventType || "",
      row.durationSeconds,
      row.mediaStatus,
      row.mediaPath || "",
      row.gateSummary.identity,
      row.gateSummary.scene,
      row.gateSummary.pair,
      row.gateSummary.story,
      row.gateSummary.prop,
      row.gateSummary.style,
    ]);
    return [
      [
        "shot_id",
        "act_id",
        "section_id",
        "title",
        "story_function",
        "shot_status",
        "preview_event_type",
        "duration_seconds",
        "media_status",
        "media_path",
        "gate_identity",
        "gate_scene",
        "gate_pair",
        "gate_story",
        "gate_prop",
        "gate_style",
      ].join("\t"),
      ...rows.map((row) => row.map(tsvValue).join("\t")),
    ].join("\n") + "\n";
  }

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
  return serializeExportValue({
    schemaVersion: exportWorkerSchemaVersion,
    kind: "rough_cut_timeline_manifest",
    generatedAt,
    sourcePreviewPlanId: preview.planId,
    previewStatus: preview.status,
    roughCutProxy: source.roughCutProxy,
    events: preview.events,
    renderMedia: false,
    futureNleFilesGenerated: false,
    roughCutProxyPlanIncluded: source.demoPackageFacts?.roughCutProxyPlanIncluded ?? true,
    notes: ["Text timeline manifest only; no media is rendered and no NLE project file is generated."],
  });
}

function assetPackageManifest(source: ProjectPreviewExportState, generatedAt: string): string {
  const assetProfile = source.exportProfiles.find((profile) => profile.kind === "asset_package");
  return serializeExportValue({
    schemaVersion: exportWorkerSchemaVersion,
    kind: "asset_package_manifest",
    generatedAt,
    profile: assetProfile,
    copyFiles: false,
    moveFiles: false,
    packageMedia: false,
    includedPathsAreReferencesOnly: true,
    selectedKeyframes: source.demoPackageFacts?.selectedKeyframes || [],
    projectFactsSnapshot: source.demoPackageFacts?.projectFactsSnapshot,
    notes: ["Asset package is a text manifest of project-root-relative references only."],
  });
}

function developerArchive(source: ProjectPreviewExportState, generatedAt: string): string {
  const builderLike = source as ExportBuilderState;
  return serializeExportValue({
    schemaVersion: exportWorkerSchemaVersion,
    kind: "developer_archive_manifest",
    generatedAt,
    formalPreviewGate: source.formalPreviewGate,
    exportPackagePlan: source.exportPackagePlan,
    developerArchiveProfile: source.exportProfiles.find((profile) => profile.kind === "developer_archive"),
    promptRequestPreviews: source.demoPackageFacts?.promptRequestPreviews || [],
    qaReports: source.demoPackageFacts?.qaReports || [],
    projectFactsSnapshot: source.demoPackageFacts?.projectFactsSnapshot,
    naturalLanguagePlanSummary: source.demoPackageFacts?.naturalLanguagePlanSummary,
    oneShotResultSummary: source.demoPackageFacts?.oneShotResultSummary,
    futureTargets: Array.isArray(builderLike.futureTargets) ? builderLike.futureTargets : [],
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    credentialMaterialIncluded: false,
    notes: ["Prompt and QA traceability is preserved as JSON only; provider submission remains blocked."],
  });
}

function sanitizeRefs(values: string[] | undefined): string[] {
  return uniqueSorted((values || []).map(safeRefValue));
}

function sanitizeProjectVibeForExport(projectVibe: ProjectVibeDocument): ProjectVibeDocument {
  return {
    ...projectVibe,
    visualMemory: {
      ...projectVibe.visualMemory,
      entries: projectVibe.visualMemory.entries.map((entry) => ({
        ...entry,
        sourceRefs: sanitizeRefs(entry.sourceRefs),
      })),
    },
    assets: projectVibe.assets.map((asset) => {
      const next = {
        ...asset,
        sourceRefs: sanitizeRefs(asset.sourceRefs),
      };
      if (next.path && isUnsafePath(next.path)) {
        return {
          ...next,
          path: `redacted_path#${stableHash(next.path)}`,
        };
      }
      return next;
    }),
    shots: projectVibe.shots.map((shot) => ({
      ...shot,
      sourceRefs: sanitizeRefs(shot.sourceRefs),
    })),
    runs: projectVibe.runs.map((run) => ({
      ...run,
      evidenceRefs: sanitizeRefs(run.evidenceRefs),
    })),
  };
}

function projectVibeDocument(projectVibe: ProjectVibeDocument | undefined): PlannedDocument | undefined {
  if (!projectVibe) return undefined;
  return {
    kind: "project_vibe",
    fileName: allowedFileNames.project_vibe,
    mimeType: "application/json",
    content: serializeExportValue(sanitizeProjectVibeForExport(projectVibe)),
  };
}

function lockedAssetsDocument(input: BuildExportWorkerStateInput, generatedAt: string): PlannedDocument {
  const lockedAssets = (input.projectVibe?.assets || [])
    .filter((asset) => asset.status === "locked")
    .map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      label: asset.label,
      path: asset.path && isUnsafePath(asset.path) ? `redacted_path#${stableHash(asset.path)}` : asset.path,
      textConstraints: asset.textConstraints,
      usedByShotIds: asset.usedByShotIds,
      sourceRefs: sanitizeRefs(asset.sourceRefs),
      lockedBy: asset.lockedBy || "user",
    }));
  return {
    kind: "locked_assets_manifest",
    fileName: allowedFileNames.locked_assets_manifest,
    mimeType: "application/json",
    content: serializeExportValue({
      schemaVersion: exportWorkerSchemaVersion,
      kind: "locked_assets_manifest",
      generatedAt,
      lockedAssets,
      source: input.projectVibe ? "Project.vibe" : "preview_export_state",
      copyFiles: false,
      notes: ["Locked assets are project-root-relative references; the MVP worker does not copy media files."],
    }),
  };
}

function previewMediaDocument(source: ProjectPreviewExportState, generatedAt: string): PlannedDocument {
  const preview = activePreview(source);
  const media = preview.events
    .filter((event) => Boolean(event.mediaPath))
    .map((event) => ({
      id: event.id,
      shotId: event.shotId,
      type: event.type,
      mediaPath: event.mediaPath,
      durationSeconds: event.durationSeconds,
      qaStatus: event.qaStatus,
    }));
  return {
    kind: "preview_media_manifest",
    fileName: allowedFileNames.preview_media_manifest,
    mimeType: "application/json",
    content: serializeExportValue({
      schemaVersion: exportWorkerSchemaVersion,
      kind: "preview_media_manifest",
      generatedAt,
      sourcePreviewPlanId: preview.planId,
      previewStatus: preview.status,
      media,
      missingPlaceholderCount: preview.events.filter((event) => event.type === "blocked_placeholder" || !event.mediaPath).length,
      copyFiles: false,
      notes: ["Preview media paths are package references only; no provider self-report or rendered media is written here."],
    }),
  };
}

function videoManifestDocument(input: BuildExportWorkerStateInput, generatedAt: string): PlannedDocument {
  const results = videoResults(input);
  const summary = videoSummary(results);
  return {
    kind: "video_manifest",
    fileName: allowedFileNames.video_manifest,
    mimeType: "application/json",
    content: serializeExportValue({
      schemaVersion: exportWorkerSchemaVersion,
      kind: "video_manifest",
      generatedAt,
      summary,
      videos: results.map((result) => ({
        id: result.id,
        shotId: result.shotId,
        reviewStatus: result.reviewStatus,
        reviewLabel: reviewLabel(result.reviewStatus),
        rawVideoPath: result.videoPath,
        firstFrameProtectedVideoPath: result.firstFrameProtectedVideoPath,
        outputHash: result.outputHash,
        durationSeconds: result.durationSeconds,
        sourceTaskId: result.sourceTaskId,
        referenceEvidence: sanitizeReferenceEvidence(result.referenceEvidence),
        autoPromoted: false,
      })),
      mediaFilesReferencedOnly: true,
      copyFiles: false,
      renderMedia: false,
      notes: [
        "Video files are referenced by project-root-relative paths; the MVP worker does not copy or render media.",
        "Video outputs default to needs_review until an explicit review receipt approves them.",
      ],
    }),
  };
}

function videoReceiptsDocument(input: BuildExportWorkerStateInput, generatedAt: string): PlannedDocument {
  const results = videoResults(input);
  return {
    kind: "video_receipts_manifest",
    fileName: allowedFileNames.video_receipts_manifest,
    mimeType: "application/json",
    content: serializeExportValue({
      schemaVersion: exportWorkerSchemaVersion,
      kind: "video_receipts_manifest",
      generatedAt,
      receiptRoot: "receipts/video",
      queuePolicy: {
        defaultConcurrentSubmissions: 1,
        expectedQueueWaitMinutes: JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES,
        recommendedResumeIntervalSeconds: JIMENG_CLI_DEFAULT_RESUME_INTERVAL_SECONDS,
        timeoutIsRecoverable: true,
        resumeWithSubmitId: true,
      },
      items: results.map((result) => ({
        id: result.id,
        shotId: result.shotId,
        reviewStatus: result.reviewStatus,
        submitId: result.submitId,
        providerTaskId: result.providerTaskId,
        taskId: result.taskId,
        sourceTaskId: result.sourceTaskId,
        receiptPaths: result.receiptPaths,
        queueLogPaths: result.queueLogPaths,
        queueAttempts: result.queueAttempts,
        resumeCommand: resumeCommandFor(result),
        autoPromoted: false,
      })),
      credentialMaterialIncluded: false,
      providerSubmissionForbidden: true,
      notes: [
        "submit_id and query logs are preserved so the user can continue checking later.",
        "This export never promotes a video to final without review.",
      ],
    }),
  };
}

function videoReportDocument(input: BuildExportWorkerStateInput, generatedAt: string): PlannedDocument {
  const results = videoResults(input);
  const summary = videoSummary(results);
  const rows = results.map((result) => [
    result.shotId || result.id,
    reviewLabel(result.reviewStatus),
    referenceEvidenceSummary(result.referenceEvidence),
    result.videoPath || "-",
    result.firstFrameProtectedVideoPath || "-",
    result.submitId || "-",
    result.queueLogPaths.join(", ") || "-",
    resumeCommandFor(result) || "-",
  ]);
  const lines = [
    "# Video Review Report",
    "",
    `Generated at: ${generatedAt}`,
    `待复核: ${summary.needsReview}`,
    `已通过: ${summary.approved}`,
    `缺失: ${summary.missing}`,
    "",
    "| 镜头 | 状态 | 参考说明 | 原始视频 | 首帧保护版 | submit_id | 排队日志 | 恢复命令 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...(rows.length ? rows.map((row) => `| ${row.map(markdownValue).join(" | ")} |`) : ["| - | 缺失 | - | - | - | - | - | - |"]),
    "",
    "说明：视频结果默认进入待复核；只有明确复核通过的记录才显示为已通过。",
    "",
  ];
  return {
    kind: "video_report",
    fileName: allowedFileNames.video_report,
    mimeType: "text/markdown",
    content: lines.map(safeRefValue).join("\n"),
  };
}

function finalVideoPlanFor(input: BuildExportWorkerStateInput, generatedAt: string) {
  return buildFinalVideoCompositionPlan({
    generatedAt,
    preview: activePreview(input.source),
    videoResults: videoResults(input),
    audioPlanning: input.audioPlanning,
  });
}

function finalVideoManifestDocument(input: BuildExportWorkerStateInput, generatedAt: string): PlannedDocument {
  return {
    kind: "final_video_manifest",
    fileName: allowedFileNames.final_video_manifest,
    mimeType: "application/json",
    content: serializeExportValue(finalVideoPlanFor(input, generatedAt)),
  };
}

function audioManifestDocument(input: BuildExportWorkerStateInput, generatedAt: string): PlannedDocument {
  const plan = finalVideoPlanFor(input, generatedAt);
  return {
    kind: "audio_manifest",
    fileName: allowedFileNames.audio_manifest,
    mimeType: "application/json",
    content: serializeExportValue({
      schemaVersion: exportWorkerSchemaVersion,
      kind: "audio_export_manifest",
      generatedAt,
      ...plan.audio,
      providerSubmissionForbidden: true,
      cloudTtsDependency: false,
      notes: plan.audio.notes,
    }),
  };
}

function receiptCount(input: BuildExportWorkerStateInput): number {
  return (input.projectVibe?.runs.length || 0)
    + (input.source.demoPackageFacts?.qaReports.length || 0)
    + (input.source.demoPackageFacts?.promptRequestPreviews.length || 0)
    + videoResults(input).filter((result) => result.submitId || result.receiptPaths.length || result.queueLogPaths.length).length;
}

function receiptsDocument(input: BuildExportWorkerStateInput, generatedAt: string): PlannedDocument {
  return {
    kind: "receipts_manifest",
    fileName: allowedFileNames.receipts_manifest,
    mimeType: "application/json",
    content: serializeExportValue({
      schemaVersion: exportWorkerSchemaVersion,
      kind: "receipts_manifest",
      generatedAt,
      projectRuns: input.projectVibe?.runs.map((run) => ({
        ...run,
        evidenceRefs: sanitizeRefs(run.evidenceRefs),
      })) || [],
      qaReports: input.source.demoPackageFacts?.qaReports || [],
      promptRequestPreviews: input.source.demoPackageFacts?.promptRequestPreviews || [],
      receiptCount: receiptCount(input),
      providerSubmissionForbidden: true,
      credentialMaterialIncluded: false,
      notes: ["Receipts are audit material only; export never promotes output without source receipts."],
    }),
  };
}

function referenceLooksProjectLocal(value: string): boolean {
  return /^(knowledge_pack|knowledge_pack_hash|knowledge_pack_path|web_search_evidence|web_search_evidence_path|web_citation)#/.test(value);
}

function parseKnowledgePackRefs(refs: string[]) {
  return {
    ids: uniqueSorted(refs.map((ref) => ref.match(/^knowledge_pack#(.+)$/)?.[1] || "").map(safeRefValue)),
    hashes: uniqueSorted(refs.map((ref) => ref.match(/^knowledge_pack_hash#(.+)$/)?.[1] || "").map(safeRefValue)),
    paths: uniqueSorted(refs.map((ref) => ref.match(/^knowledge_pack_path#(.+)$/)?.[1] || "").map(safeRefValue)),
  };
}

function parseEvidenceRefs(refs: string[]) {
  return uniqueSorted(refs
    .map((ref) => ref.match(/^web_search_evidence(?:_path)?#(.+)$/)?.[1] || "")
    .map(safeRefValue))
    .map((ref) => ({
      ref,
      refHash: stableHash(ref),
      redacted: ref.startsWith("redacted_ref#"),
    }));
}

function parseCitationHashes(refs: string[]) {
  return refs
    .map((ref) => {
      const match = ref.match(/^web_citation#([^#]+)#(.+)$/);
      return match ? { domain: safeRefValue(match[1]), hash: safeRefValue(match[2]) } : undefined;
    })
    .filter((item): item is { domain: string; hash: string } => Boolean(item))
    .filter((item, index, list) => list.findIndex((candidate) => candidate.domain === item.domain && candidate.hash === item.hash) === index)
    .sort((left, right) => `${left.domain}#${left.hash}`.localeCompare(`${right.domain}#${right.hash}`));
}

function knowledgePackSummary(pack: KnowledgePack) {
  return {
    id: safeRefValue(pack.id),
    version: pack.version,
    hash: safeRefValue(pack.hash),
    path: safeRefValue(pack.path),
    type: pack.type,
    category: pack.category,
    title: pack.title,
    summary: pack.summary,
    verificationStatus: pack.verificationStatus,
    trustLevel: pack.trustLevel,
    sourcePath: pack.sourcePath ? safeRefValue(pack.sourcePath) : undefined,
    snippetHashes: pack.snippets.map((snippet) => ({
      id: snippet.id,
      title: snippet.title,
      hash: snippet.hash || stableHash(`${pack.id}:${snippet.id}:${snippet.title}`),
    })),
  };
}

function projectLocalKnowledgeReferences(input: BuildExportWorkerStateInput) {
  const project = input.projectVibe;
  if (!project) {
    return {
      projectId: "",
      references: [],
      packs: [],
      sourceRefCount: 0,
      evidenceRefCount: 0,
      citationHashCount: 0,
    };
  }

  const researchAssets = project.assets.filter((asset) => (
    asset.status === "locked"
    && (
      asset.id.startsWith("style_research_")
      || asset.sourceRefs.some(referenceLooksProjectLocal)
    )
  ));
  const researchAssetIds = new Set(researchAssets.map((asset) => asset.id));
  const researchRuns = project.runs.filter((run) => (
    run.id.startsWith("run_research_")
    || (run.producedAssetIds || []).some((assetId) => researchAssetIds.has(assetId))
    || (run.evidenceRefs || []).some(referenceLooksProjectLocal)
  ));
  const projectRefs = sanitizeRefs([
    ...researchAssets.flatMap((asset) => asset.sourceRefs),
    ...researchRuns.flatMap((run) => run.evidenceRefs),
  ]);
  const referencedPackIds = new Set(parseKnowledgePackRefs(projectRefs).ids);
  const packs = (input.projectLocalKnowledgePacks || [])
    .filter((pack) => pack.type === "project_local" || referencedPackIds.has(pack.id))
    .map(knowledgePackSummary);

  const references = researchAssets.map((asset) => {
    const relatedRuns = researchRuns.filter((run) => (run.producedAssetIds || []).includes(asset.id) || (run.evidenceRefs || []).some(referenceLooksProjectLocal));
    const refs = sanitizeRefs([...asset.sourceRefs, ...relatedRuns.flatMap((run) => run.evidenceRefs)]);
    const packRefs = parseKnowledgePackRefs(refs);
    return {
      assetId: asset.id,
      label: asset.label,
      kind: asset.kind,
      lockedBy: asset.lockedBy || "user",
      runReceiptIds: relatedRuns.map((run) => run.id).sort((left, right) => left.localeCompare(right)),
      knowledgePacks: packRefs.ids.map((id) => ({
        id,
        hash: packRefs.hashes[0] || packs.find((pack) => pack.id === id)?.hash || "",
        path: packRefs.paths[0] || packs.find((pack) => pack.id === id)?.path || "",
      })),
      evidenceRefs: parseEvidenceRefs(refs),
      citationHashes: parseCitationHashes(refs),
      creativeBoundaries: asset.textConstraints.filter((line) => /本片参考|来源已确认|致敬边界|提示词边界/.test(line)),
    };
  });

  return {
    projectId: project.manifest.projectId,
    references,
    packs,
    sourceRefCount: projectRefs.length,
    evidenceRefCount: parseEvidenceRefs(projectRefs).length,
    citationHashCount: parseCitationHashes(projectRefs).length,
  };
}

function knowledgeReferencesDocument(input: BuildExportWorkerStateInput, generatedAt: string): PlannedDocument {
  const knowledgeReferences = projectLocalKnowledgeReferences(input);
  return {
    kind: "knowledge_references_manifest",
    fileName: allowedFileNames.knowledge_references_manifest,
    mimeType: "application/json",
    content: serializeExportValue({
      schemaVersion: exportWorkerSchemaVersion,
      kind: "project_local_knowledge_references",
      generatedAt,
      projectId: knowledgeReferences.projectId,
      references: knowledgeReferences.references,
      projectLocalPacks: knowledgeReferences.packs,
      summary: {
        referenceCount: knowledgeReferences.references.length,
        packCount: knowledgeReferences.packs.length,
        sourceRefCount: knowledgeReferences.sourceRefCount,
        evidenceRefCount: knowledgeReferences.evidenceRefCount,
        citationHashCount: knowledgeReferences.citationHashCount,
      },
      rawWebExcerptIncluded: false,
      credentialMaterialIncluded: false,
      localAbsolutePathsIncluded: false,
      notes: [
        "本片参考只保留可复核来源编号、证据编号和引用哈希。",
        "网页原文和密钥不会写入导出包；创作事实仍以 Project.vibe 的用户确认内容为准。",
      ],
    }),
  };
}

function reportDocument(input: BuildExportWorkerStateInput, generatedAt: string): PlannedDocument {
  const preview = activePreview(input.source);
  const lockedAssetCount = input.projectVibe?.assets.filter((asset) => asset.status === "locked").length || 0;
  const knowledgeReferenceCount = projectLocalKnowledgeReferences(input).references.length;
  const previewMediaCount = preview.events.filter((event) => Boolean(event.mediaPath)).length;
  const videos = videoResults(input);
  const videosSummary = videoSummary(videos);
  const videoReferenceSummaries = videos
    .map((result) => ({ shot: result.shotId || result.id, summary: referenceEvidenceSummary(result.referenceEvidence) }))
    .filter((item) => item.summary !== "无单独参考记录");
  const videoStrategySummaries = videos
    .map((result) => ({ shot: result.shotId || result.id, summary: directorStrategySummary(result.referenceEvidence?.directorStrategy) }))
    .filter((item) => item.summary);
  const lines = [
    "# MVP Export Report",
    "",
    `Generated at: ${generatedAt}`,
    `Project: ${input.projectTitle || input.projectVibe?.manifest.title || "Untitled"}`,
    `Preview: ${preview.status} / ${preview.events.length} event(s)`,
    `Locked assets: ${lockedAssetCount}`,
    `Project references: ${knowledgeReferenceCount}`,
    `Preview media: ${previewMediaCount}`,
    `Videos: ${videosSummary.total}`,
    `Video review: 待复核 ${videosSummary.needsReview} / 已通过 ${videosSummary.approved} / 缺失 ${videosSummary.missing}`,
    `参考证据: ${videoReferenceSummaries.length}`,
    `Receipts: ${receiptCount(input)}`,
    "",
    "参考证据:",
    ...(videoReferenceSummaries.length
      ? videoReferenceSummaries.map((item) => `- ${item.shot}: ${item.summary}`)
      : ["- 无单独参考记录"]),
    "",
    "导演策略:",
    ...(videoStrategySummaries.length
      ? videoStrategySummaries.map((item) => `- ${item.shot}: ${item.summary}`)
      : ["- 无单独策略记录"]),
    "",
    "Included files:",
    `- ${input.projectVibe ? "Project.vibe" : "Project.vibe unavailable in this export input"}`,
    "- locked_assets.json",
    "- preview_media.json",
    "- receipts.json",
    "- videos/video_manifest.json",
    "- receipts/video/video_receipts.json",
    "- video-report/summary.md",
    "- final-video/composition_manifest.json",
    "- final-video/*.mp4 when an existing project-relative video is available",
    "- audio/manifest.json",
    "- knowledge_references.json",
    "- report.md",
    "- export_manifest.json",
    "",
    "Safety:",
    "- No provider submission",
    "- No credential material",
    "- No media render",
    "- Project-root-relative export writes only",
    "",
  ];
  return {
    kind: "export_report",
    fileName: allowedFileNames.export_report,
    mimeType: "text/markdown",
    content: lines.map(safeRefValue).join("\n"),
  };
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

function mvpPackageDocuments(input: BuildExportWorkerStateInput, generatedAt: string): PlannedDocument[] {
  return [
	    projectVibeDocument(input.projectVibe),
	    lockedAssetsDocument(input, generatedAt),
	    previewMediaDocument(input.source, generatedAt),
	    videoManifestDocument(input, generatedAt),
	    videoReceiptsDocument(input, generatedAt),
	    videoReportDocument(input, generatedAt),
	    finalVideoManifestDocument(input, generatedAt),
	    audioManifestDocument(input, generatedAt),
	    receiptsDocument(input, generatedAt),
	    knowledgeReferencesDocument(input, generatedAt),
	    reportDocument(input, generatedAt),
  ].filter((document): document is PlannedDocument => Boolean(document));
}

function finalVideoCopies(input: BuildExportWorkerStateInput, generatedAt: string): PlannedCopy[] {
  return finalVideoPlanFor(input, generatedAt).copyItems
    .filter((item) => item.status === "copy_ready" || item.status === "hash_unverified")
    .filter((item) => isAllowedCopySourcePath(item.sourcePath))
    .map((item) => ({
      kind: "final_video_file" as const,
      sourcePath: item.sourcePath || "",
      destinationFileName: item.stablePath,
      sourceHash: item.sourceHash,
      shotId: item.shotId,
      copyStatus: item.status === "copy_ready" ? "copy_ready" as const : "hash_unverified" as const,
    }));
}

function expectedWritePathsFromManifest(exportRoot: string, manifestFiles: ExportWorkerManifestFile[] | undefined): string[] {
  return uniqueSorted([
    joinPath(exportRoot, allowedFileNames.export_manifest),
    ...(manifestFiles || []).map((file) => file.path),
  ]);
}

function expectedCopyPathsFromManifest(mediaFiles: ExportWorkerManifestMediaFile[] | undefined): string[] {
  return uniqueSorted((mediaFiles || []).map((file) => file.path));
}

function jsonObjectFromEntry(entry: ExportWorkerEntry | undefined): Record<string, unknown> {
  if (!entry?.content) return {};
  try {
    const parsed = JSON.parse(entry.content);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function videoOutputPath(path?: string): boolean {
  return /\.(?:mp4|mov|webm)$/i.test(path || "");
}

function reviewLabel(status: DemoPackageVideoResult["reviewStatus"]): string {
  if (status === "approved") return "已通过";
  if (status === "missing") return "缺失";
  return "待复核";
}

function markdownValue(value: unknown): string {
  const text = safeRefValue(String(value || "-")).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  return text.trim() || "-";
}

function sanitizeDirectorStrategy(strategy: DemoPackageDirectorStrategyEvidence | undefined): DemoPackageDirectorStrategyEvidence | undefined {
  if (!strategy) return undefined;
  const sanitized: DemoPackageDirectorStrategyEvidence = {
    rhythmProfile: safeOptionalRef(strategy.rhythmProfile),
    rhythmLabel: safeOptionalRef(strategy.rhythmLabel),
    rhythmReason: safeOptionalRef(strategy.rhythmReason),
    splitPolicy: safeOptionalRef(strategy.splitPolicy),
    splitLabel: safeOptionalRef(strategy.splitLabel),
    actionSummary: safeOptionalRef(strategy.actionSummary),
    modificationSummary: sanitizeRefs(strategy.modificationSummary),
    storyboardPromptPlanSummary: safeOptionalRef(strategy.storyboardPromptPlanSummary),
    videoPromptPlanSummary: safeOptionalRef(strategy.videoPromptPlanSummary),
  };
  return Object.values(sanitized).some((item) => Array.isArray(item) ? item.length : Boolean(item)) ? sanitized : undefined;
}

function sanitizeReferenceEvidence(evidence: DemoPackageReferenceEvidence | undefined): DemoPackageReferenceEvidence | undefined {
  if (!evidence) return undefined;
  const inputRoleOrder = Array.from(new Set((evidence.seedanceInputRoleOrder || []).map(safeRefValue).filter(Boolean)));
  const directorStrategy = sanitizeDirectorStrategy(evidence.directorStrategy);
  const sanitized: DemoPackageReferenceEvidence = {
    referencePolicyVersion: safeOptionalRef(evidence.referencePolicyVersion),
    storyboardReferencePath: safeOptionalRef(evidence.storyboardReferencePath),
    sceneReferencePath: safeOptionalRef(evidence.sceneReferencePath),
    characterReferencePaths: sanitizeRefs(evidence.characterReferencePaths),
    propReferencePaths: sanitizeRefs(evidence.propReferencePaths),
    dialogueAudioPath: safeOptionalRef(evidence.dialogueAudioPath),
    seedanceInputRoleOrder: inputRoleOrder,
    userFacingSummary: evidence.userFacingSummary ? safeRefValue(evidence.userFacingSummary) : undefined,
    directorStrategy,
  };
  const hasEvidence = Boolean(
    sanitized.storyboardReferencePath ||
    sanitized.sceneReferencePath ||
    sanitized.dialogueAudioPath ||
    sanitized.characterReferencePaths?.length ||
    sanitized.propReferencePaths?.length ||
    sanitized.seedanceInputRoleOrder?.length ||
    sanitized.userFacingSummary ||
    sanitized.directorStrategy,
  );
  return hasEvidence ? sanitized : undefined;
}

function directorStrategySummary(strategy: DemoPackageDirectorStrategyEvidence | undefined): string {
  const safe = sanitizeDirectorStrategy(strategy);
  if (!safe) return "";
  const parts = [
    safe.rhythmLabel ? `节奏：${safe.rhythmLabel}` : "",
    safe.rhythmReason ? `判断：${safe.rhythmReason}` : "",
    safe.splitLabel ? `拆分：${safe.splitLabel}` : "",
    safe.actionSummary ? `主动作：${safe.actionSummary}` : "",
    safe.modificationSummary?.length ? `已确认修改：${safe.modificationSummary.join("；")}` : "",
    safe.storyboardPromptPlanSummary ? `分镜计划：${safe.storyboardPromptPlanSummary}` : "",
    safe.videoPromptPlanSummary ? `视频计划：${safe.videoPromptPlanSummary}` : "",
  ].filter(Boolean);
  return parts.join("；");
}

function referenceEvidenceSummary(evidence: DemoPackageReferenceEvidence | undefined): string {
  const safe = sanitizeReferenceEvidence(evidence);
  if (!safe) return "无单独参考记录";
  const parts = [
    safe.storyboardReferencePath ? `分镜参考：${safe.storyboardReferencePath}` : "",
    safe.sceneReferencePath ? `场景/天气参考：${safe.sceneReferencePath}` : "",
    safe.characterReferencePaths?.length ? `角色参考：${safe.characterReferencePaths.join(", ")}` : "",
    safe.propReferencePaths?.length ? `道具参考：${safe.propReferencePaths.join(", ")}` : "",
    safe.dialogueAudioPath ? `音频参考：${safe.dialogueAudioPath}` : "",
    directorStrategySummary(safe.directorStrategy),
    safe.userFacingSummary || "",
  ].filter(Boolean);
  return parts.join("；") || "无单独参考记录";
}

function safeOptionalRef(value: string | undefined): string | undefined {
  return value ? safeRefValue(value) : undefined;
}

function firstFrameProtectedPath(paths: string[], videoPath?: string): string | undefined {
  const candidates = uniqueSorted(paths.filter((path) => videoOutputPath(path) && path !== videoPath));
  return candidates.find((path) => /first[-_]?frame|firstframe|protected|hold/i.test(path));
}

function promptPreviewForVideo(source: ProjectPreviewExportState, shotId: string | undefined, videoPath: string | undefined) {
  const previews = source.demoPackageFacts?.promptRequestPreviews || [];
  return previews.find((preview) => {
    const outputs = [...preview.actualOutputs, ...preview.expectedOutputs];
    return (
      (shotId && preview.shotId === shotId && outputs.some(videoOutputPath)) ||
      Boolean(videoPath && outputs.includes(videoPath)) ||
      Boolean(shotId && outputs.some((path) => path.includes(`/${shotId}`) || path.includes(`${shotId}_`)))
    );
  });
}

function resumeCommandFor(result: DemoPackageVideoResult, request?: ReturnType<typeof promptPreviewForVideo>): string | undefined {
  if (result.resumeCommand) return result.resumeCommand;
  if (request?.resumeCommand) return request.resumeCommand;
  const submitId = result.submitId || request?.submitId;
  if (!submitId) return undefined;
  const videoDir = directoryOf(result.videoPath || result.firstFrameProtectedVideoPath || "") || "videos";
  return `dreamina query_result --submit_id=${submitId} --download_dir=${videoDir}`;
}

function applyReviewReceipts(input: BuildExportWorkerStateInput, result: DemoPackageVideoResult): DemoPackageVideoResult {
  const receipts = input.projectVibe?.receipts?.reviewReceipts || [];
  const matching = receipts.find((receipt) => (
    receipt.status === "approved" &&
    Boolean(result.videoPath && receipt.outputPath === result.videoPath)
  ));
  const reviewStatus = !result.videoPath
    ? "missing"
    : matching || result.reviewStatus === "approved"
      ? "approved"
      : "needs_review";
  return {
    ...result,
    reviewStatus,
    sourceTaskId: result.sourceTaskId || matching?.sourceRunId,
    outputHash: result.outputHash || matching?.outputHash,
    autoPromoted: false,
    notes: uniqueSorted([
      ...result.notes,
      reviewStatus === "approved" ? "Approved only because an explicit review receipt was present." : "",
      reviewStatus === "needs_review" ? "Video remains a review candidate and is not promoted automatically." : "",
    ]),
  };
}

function deriveVideoResultsFromSource(input: BuildExportWorkerStateInput): DemoPackageVideoResult[] {
  const explicit = input.source.demoPackageFacts?.videoResults || [];
  if (explicit.length) return explicit.map((result) => applyReviewReceipts(input, result));

  const preview = activePreview(input.source);
  const eventByShot = new Map(preview.events.filter((event) => event.shotId).map((event) => [event.shotId || "", event]));
  const rows = input.source.demoPackageFacts?.storyboardRows || [];
  const rowResults = rows.map((row) => {
    const event = eventByShot.get(row.shotId);
    const videoPath = row.mediaStatus === "video" ? row.mediaPath : event?.type === "video_clip" ? event.mediaPath : undefined;
    const request = promptPreviewForVideo(input.source, row.shotId, videoPath);
    const outputPaths = uniqueSorted([...(request?.actualOutputs || []), ...(request?.expectedOutputs || []), videoPath || ""]);
    const result: DemoPackageVideoResult = {
      id: `video_result_${safeRefValue(row.shotId)}`,
      shotId: row.shotId,
      sourceTaskId: event?.sourceTaskId || request?.jobId || request?.taskId,
      taskId: request?.taskId,
      submitId: request?.submitId,
      providerTaskId: request?.providerTaskId,
      reviewStatus: videoPath ? "needs_review" : "missing",
      videoPath,
      firstFrameProtectedVideoPath: firstFrameProtectedPath(outputPaths, videoPath),
      receiptPaths: uniqueSorted(request?.receiptPaths || []),
      queueLogPaths: uniqueSorted(request?.queueLogPaths || []),
      resumeCommand: request?.resumeCommand,
      durationSeconds: row.durationSeconds || event?.durationSeconds,
      autoPromoted: false,
      notes: [
        videoPath ? "Video output is recorded as a review candidate." : "Video output is missing.",
        "Video output is not promoted automatically.",
      ],
    };
    return applyReviewReceipts(input, result);
  });

  const coveredShotIds = new Set(rowResults.map((result) => result.shotId).filter(Boolean));
  const eventResults = preview.events
    .filter((event) => event.type === "video_clip" && event.mediaPath && (!event.shotId || !coveredShotIds.has(event.shotId)))
    .map((event) => {
      const request = promptPreviewForVideo(input.source, event.shotId, event.mediaPath);
      const outputPaths = uniqueSorted([...(request?.actualOutputs || []), ...(request?.expectedOutputs || []), event.mediaPath || ""]);
      const result: DemoPackageVideoResult = {
        id: `video_result_${safeRefValue(event.id)}`,
        shotId: event.shotId,
        sourceTaskId: event.sourceTaskId || request?.jobId || request?.taskId,
        taskId: request?.taskId,
        submitId: request?.submitId,
        providerTaskId: request?.providerTaskId,
        reviewStatus: "needs_review",
        videoPath: event.mediaPath,
        firstFrameProtectedVideoPath: firstFrameProtectedPath(outputPaths, event.mediaPath),
        receiptPaths: uniqueSorted(request?.receiptPaths || []),
        queueLogPaths: uniqueSorted(request?.queueLogPaths || []),
        resumeCommand: request?.resumeCommand,
        durationSeconds: event.durationSeconds,
        autoPromoted: false,
        notes: ["Video output is recorded as a review candidate.", "Video output is not promoted automatically."],
      };
      return applyReviewReceipts(input, result);
    });

  return [...rowResults, ...eventResults];
}

function safeVideoResult(result: DemoPackageVideoResult): DemoPackageVideoResult {
  return {
    ...result,
    videoPath: safeOptionalRef(result.videoPath),
    firstFrameProtectedVideoPath: safeOptionalRef(result.firstFrameProtectedVideoPath),
    receiptPaths: sanitizeRefs(result.receiptPaths),
    queueLogPaths: sanitizeRefs(result.queueLogPaths),
    resumeCommand: result.resumeCommand ? safeRefValue(result.resumeCommand) : undefined,
    autoPromoted: false,
  };
}

function videoResults(input: BuildExportWorkerStateInput): DemoPackageVideoResult[] {
  return deriveVideoResultsFromSource(input).map(safeVideoResult);
}

function videoSummary(results: DemoPackageVideoResult[]) {
  return {
    total: results.length,
    needsReview: results.filter((result) => result.reviewStatus === "needs_review").length,
    approved: results.filter((result) => result.reviewStatus === "approved").length,
    missing: results.filter((result) => result.reviewStatus === "missing").length,
  };
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

function collectReferencePathErrors(source: ProjectPreviewExportState): string[] {
  const errors: string[] = [];
  const check = (path: string | undefined, label: string): void => {
    if (!path) return;
    if (isUnsafePath(path)) errors.push(`${label} must be project-root-relative and cannot use absolute paths or parent traversal: ${path}`);
  };

  source.exportProfiles.forEach((profile) => {
    profile.includedPaths.forEach((path, index) => check(path, `exportProfiles.${profile.kind}.includedPaths[${index}]`));
  });
  [...source.draftPreview.events, ...source.formalPreview.events].forEach((event) => {
    check(event.mediaPath, `previewEvents.${event.id}.mediaPath`);
  });
  source.demoPackageFacts?.selectedKeyframes.forEach((keyframe, index) => {
    check(keyframe.startFrame, `demoPackageFacts.selectedKeyframes[${index}].startFrame`);
    check(keyframe.endFrame, `demoPackageFacts.selectedKeyframes[${index}].endFrame`);
  });
  source.demoPackageFacts?.promptRequestPreviews.forEach((preview, index) => {
    check(preview.promptPath, `demoPackageFacts.promptRequestPreviews[${index}].promptPath`);
    preview.expectedOutputs.forEach((path, outputIndex) => check(path, `demoPackageFacts.promptRequestPreviews[${index}].expectedOutputs[${outputIndex}]`));
    preview.actualOutputs.forEach((path, outputIndex) => check(path, `demoPackageFacts.promptRequestPreviews[${index}].actualOutputs[${outputIndex}]`));
  });

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
  if (operations.some((operation) => /delete|move|render/i.test(operation))) {
    blockers.push("delete, move, and render operations are blocked by Phase 27 hard locks.");
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
  blockers.push(...collectReferencePathErrors(input.source));
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

function createCopyEntry(copy: PlannedCopy, exportRoot: string, canExecute: boolean): ExportWorkerEntry {
  const path = joinPath(exportRoot, copy.destinationFileName);
  return {
    id: `copy_${stableHash({ sourcePath: copy.sourcePath, path }).replace(/^vck_/, "")}`,
    kind: "final_video_file",
    operation: "copy_file",
    path,
    sourcePath: copy.sourcePath,
    shotId: copy.shotId,
    sourceHash: copy.sourceHash,
    canExecute,
    projectRootRelative: true,
    notes: [
      "Copies an existing project-root-relative video into final-video; no rendering or provider submission occurs.",
      copy.sourceHash ? "Source hash is recorded from receipts." : "Source hash is unavailable, so the manifest marks this copy hash-unverified.",
    ],
  };
}

function manifestDocument(
  source: ProjectPreviewExportState,
  generatedAt: string,
  exportRoot: string,
  selectedKinds: ExportProfileKind[],
  readiness: ExportWorkerReadiness,
  writeEntries: ExportWorkerEntry[],
  copyEntries: ExportWorkerEntry[],
  directoryEntries: ExportWorkerEntry[],
  blockedProfileKinds: ExportProfileKind[],
): PlannedDocument {
  const files: ExportWorkerManifestFile[] = writeEntries
    .filter((entry) => entry.kind !== "export_manifest" && entry.kind !== "export_directory")
    .map((entry) => ({
      kind: entry.kind as Exclude<ExportWorkerEntryKind, "export_directory" | "export_manifest" | "final_video_file">,
      path: entry.path,
      contentHash: entry.contentHash || "",
      profileKind: selectedKinds.find((kind) => entry.id.includes(kind)),
    }));
  const mediaFiles: ExportWorkerManifestMediaFile[] = copyEntries.map((entry) => ({
    kind: "final_video_file",
    sourcePath: entry.sourcePath || "",
    path: entry.path,
    sourceHash: entry.sourceHash,
    shotId: entry.shotId,
    copyStatus: entry.sourceHash ? "copy_ready" : "hash_unverified",
  }));
	  const lockedAssets = jsonObjectFromEntry(writeEntries.find((entry) => entry.kind === "locked_assets_manifest"));
	  const previewMedia = jsonObjectFromEntry(writeEntries.find((entry) => entry.kind === "preview_media_manifest"));
	  const receipts = jsonObjectFromEntry(writeEntries.find((entry) => entry.kind === "receipts_manifest"));
	  const knowledgeReferences = jsonObjectFromEntry(writeEntries.find((entry) => entry.kind === "knowledge_references_manifest"));
	  const knowledgeReferenceSummary = isRecord(knowledgeReferences.summary) ? knowledgeReferences.summary : {};
	  const videoManifest = jsonObjectFromEntry(writeEntries.find((entry) => entry.kind === "video_manifest"));
	  const videoManifestSummary = isRecord(videoManifest.summary) ? videoManifest.summary : {};
	  const videos = Array.isArray(videoManifest.videos) ? videoManifest.videos : [];
	  const manifest: ExportWorkerManifest = {
    manifestId: `export_worker_${stableHash({ generatedAt, exportRoot, selectedKinds }).replace(/^vck_/, "")}`,
    generatedAt,
    exportRoot,
    profileSelection: selectedKinds,
    readiness,
    writeFilesOnly: false,
    textOnly: false,
    allowedOperations: [...validOperations],
    allowedDirectories: directoryEntries.map((entry) => entry.path),
    allowedWritePaths: writeEntries.map((entry) => entry.path),
    allowedCopyPaths: copyEntries.map((entry) => entry.path),
    allowedCopySources: copyEntries.map((entry) => entry.sourcePath || ""),
    files,
    mediaFiles,
    blockedProfileKinds,
    mvpPackage: {
	      projectVibeIncluded: files.some((file) => file.kind === "project_vibe"),
	      lockedAssetCount: arrayLength(lockedAssets.lockedAssets),
	      previewMediaCount: arrayLength(previewMedia.media),
	      videoResultCount: typeof videoManifestSummary.total === "number" ? videoManifestSummary.total : 0,
	      videoNeedsReviewCount: typeof videoManifestSummary.needsReview === "number" ? videoManifestSummary.needsReview : 0,
	      videoApprovedCount: typeof videoManifestSummary.approved === "number" ? videoManifestSummary.approved : 0,
	      videoMissingCount: typeof videoManifestSummary.missing === "number" ? videoManifestSummary.missing : 0,
	      finalVideoCopyCount: copyEntries.length,
	      referenceEvidenceCount: videos.filter((video) => isRecord(video) && isRecord(video.referenceEvidence)).length,
	      receiptCount: typeof receipts.receiptCount === "number" ? receipts.receiptCount : 0,
	      knowledgeReferenceCount: typeof knowledgeReferenceSummary.referenceCount === "number" ? knowledgeReferenceSummary.referenceCount : 0,
	      videoReportIncluded: files.some((file) => file.kind === "video_report"),
	      finalVideoManifestIncluded: files.some((file) => file.kind === "final_video_manifest"),
	      audioManifestIncluded: files.some((file) => file.kind === "audio_manifest"),
	      reportIncluded: files.some((file) => file.kind === "export_report"),
	    },
    source: {
      schemaVersion: source.schemaVersion,
      packagePlanId: source.exportPackagePlan.planId,
      packageStatus: source.exportPackagePlan.status,
      formalPreviewStatus: source.formalPreview.status,
      draftPreviewStatus: source.draftPreview.status,
    },
    notes: [
      "Manifest lists text/JSON/TSV/Markdown export artifacts and adapter-mediated copies of existing project-relative videos.",
      "Media render, provider submission, credential IO, arbitrary shell, move/delete, and future NLE files remain blocked.",
    ],
  };
  return {
    kind: "export_manifest",
    fileName: allowedFileNames.export_manifest,
    mimeType: "application/json",
    content: serializeExportValue(manifest),
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
  const allowedCopyPaths = new Set(Array.isArray(state.manifest?.allowedCopyPaths) ? state.manifest.allowedCopyPaths : []);
  const allowedCopySources = new Set(Array.isArray(state.manifest?.allowedCopySources) ? state.manifest.allowedCopySources : []);
  const manifestFiles = new Map(
    (Array.isArray(state.manifest?.files) ? state.manifest.files : [])
      .filter((file) => isRecord(file))
      .map((file) => [String(file.path), file as ExportWorkerManifestFile]),
  );
  const manifestMediaFiles = new Map(
    (Array.isArray(state.manifest?.mediaFiles) ? state.manifest.mediaFiles : [])
      .filter((file) => isRecord(file))
      .map((file) => [String(file.path), file as ExportWorkerManifestMediaFile]),
  );
  const expectedWrites = expectedWritePathsFromManifest(state.exportRoot || "", state.manifest?.files);
  const expectedCopies = expectedCopyPathsFromManifest(state.manifest?.mediaFiles);
  const expectedDirs = expectedDirectoryPathsFromWritePaths([...expectedWrites, ...expectedCopies]);

  if (isRecord(state.manifest)) {
    if (state.manifest.generatedAt !== state.generatedAt) errors.push("Manifest generatedAt must match export worker state.");
    if (state.manifest.exportRoot !== state.exportRoot) errors.push("Manifest exportRoot must match export worker state.");
    if (state.manifest.readiness !== state.readiness) errors.push("Manifest readiness must match export worker state.");
    if (!arraysEqual(uniqueSorted(state.manifest.allowedOperations || []), uniqueSorted(validOperations))) {
      errors.push("Manifest allowedOperations must be exactly create_directory/write_file/copy_file.");
    }
    if (!arraysEqual(uniqueSorted(state.manifest.allowedWritePaths || []), uniqueSorted(expectedWrites))) {
      errors.push("Manifest allowedWritePaths do not match exportRoot/export manifest files.");
    }
    if (!arraysEqual(uniqueSorted(state.manifest.allowedCopyPaths || []), expectedCopies)) {
      errors.push("Manifest allowedCopyPaths do not match final-video media files.");
    }
    if (!arraysEqual(uniqueSorted(state.manifest.allowedCopySources || []), uniqueSorted((state.manifest.mediaFiles || []).map((file) => file.sourcePath)))) {
      errors.push("Manifest allowedCopySources do not match final-video media files.");
    }
    if (!arraysEqual(uniqueSorted(state.manifest.allowedDirectories || []), expectedDirs)) {
      errors.push("Manifest allowedDirectories do not match exportRoot/export manifest files.");
    }
    if (!arraysEqual(uniqueSorted((state.manifest.files || []).map((file) => file.path)), uniqueSorted(expectedWrites.filter((path) => !path.endsWith(allowedFileNames.export_manifest))))) {
      errors.push("Manifest files do not match selected profile and MVP package text outputs.");
    }
    for (const path of [...(state.manifest.allowedDirectories || []), ...(state.manifest.allowedWritePaths || []), ...(state.manifest.allowedCopyPaths || [])]) {
      if (path !== normalizePath(path) || isUnsafePath(path) || !isAllowedExportPath(path)) {
        errors.push(`Manifest allowlist path is outside export scope: ${path}`);
      }
    }
    for (const sourcePath of state.manifest.allowedCopySources || []) {
      if (!isAllowedCopySourcePath(sourcePath)) {
        errors.push(`Manifest copy source is not a safe project-root-relative video path: ${sourcePath}`);
      }
    }
  }

  for (const entry of readEntries(state)) {
    if (!isRecord(entry)) {
      errors.push("Export worker entry must be an object.");
      continue;
    }
    if (typeof entry.id !== "string" || !entry.id.trim()) errors.push("Export worker entry id is required.");
    if (![...Object.keys(allowedFileNames), "export_directory"].includes(entry.kind)) {
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
	      if (!Object.values(allowedFileNames).some((fileName) => entry.path === joinPath(state.exportRoot, fileName))) {
	        errors.push(`${entry.id || "entry"} write file name is not allowed.`);
	      }
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
    if (entry.operation === "copy_file") {
      if (entry.kind !== "final_video_file") errors.push(`${entry.id || "entry"} copy_file must use final_video_file kind.`);
      if (!allowedCopyPaths.has(entry.path)) errors.push(`${entry.id || "entry"} copy path is not manifest-allowlisted.`);
      if (!entry.sourcePath || !allowedCopySources.has(entry.sourcePath)) errors.push(`${entry.id || "entry"} copy source is not manifest-allowlisted.`);
      if (entry.sourcePath && !isAllowedCopySourcePath(entry.sourcePath)) {
        errors.push(`${entry.id || "entry"} copy source must be a project-root-relative video path.`);
      }
      const manifestMediaFile = manifestMediaFiles.get(entry.path);
      if (!manifestMediaFile) {
        errors.push(`${entry.id || "entry"} copy path is missing from manifest mediaFiles.`);
      } else {
        if (manifestMediaFile.sourcePath !== entry.sourcePath) errors.push(`${entry.id || "entry"} copy source does not match manifest mediaFiles.`);
        if (manifestMediaFile.sourceHash !== entry.sourceHash) errors.push(`${entry.id || "entry"} sourceHash does not match manifest mediaFiles.`);
      }
      if (typeof entry.content === "string" || typeof entry.contentHash === "string" || typeof entry.mimeType === "string") {
        errors.push(`${entry.id || "entry"} copy entry cannot include write content.`);
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
  const profileDocs = [
    ...mvpPackageDocuments(input, generatedAt),
    ...profileDocuments(input.source, selectedKinds, generatedAt),
  ];
  const profileWriteEntries = profileDocs.map((document) => createWriteEntry(document, exportRoot, canExecute));
  const copyEntries = finalVideoCopies(input, generatedAt).map((copy) => createCopyEntry(copy, exportRoot, canExecute));
  const directoryPaths = uniqueSorted([
    exportRoot,
    ...[...profileWriteEntries, ...copyEntries].flatMap((entry) => {
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
    copyEntries,
    directoryEntries,
    blockedProfileKinds,
  );
  const manifestEntry = createWriteEntry(manifestDoc, exportRoot, canExecute);
  const parsedManifest = JSON.parse(manifestDoc.content) as ExportWorkerManifest;
  parsedManifest.allowedWritePaths = [manifestEntry.path, ...parsedManifest.allowedWritePaths];
  manifestEntry.content = serializeExportValue(parsedManifest);
  manifestEntry.contentHash = stableHash(manifestEntry.content);

  const entries = [...directoryEntries, manifestEntry, ...profileWriteEntries, ...copyEntries];
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(operation: () => unknown, label: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await operation();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await delay(1000);
    }
  }
  throw lastError;
}

export async function executeExportWorkerPlan(
  state: ExportWorkerState,
  adapter: ExportWorkerAdapter,
  signal?: AbortSignal,
  onProgress?: (progress: { current: number; total: number; label: string }) => void,
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

  const entries = readEntries(state);
  const total = entries.length;
  let current = 0;

  for (const entry of entries) {
    if (signal?.aborted) {
      errors.push(`Export cancelled before ${entry.id}.`);
      break;
    }

    current += 1;
    onProgress?.({ current, total, label: `${entry.operation} ${entry.kind}` });

    try {
      if (entry.operation === "create_directory") {
        await withRetry(() => adapter.mkdir(entry.path), entry.id);
      } else if (entry.operation === "write_file") {
        await withRetry(() => adapter.writeFile(entry.path, entry.content || ""), entry.id);
      } else if (entry.operation === "copy_file") {
        if (!adapter.copyFile) {
          errors.push(`${entry.id}: adapter does not implement copyFile.`);
          continue;
        }
        await withRetry(() => adapter.copyFile!(entry.sourcePath || "", entry.path), entry.id);
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
