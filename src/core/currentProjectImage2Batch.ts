import {
  appendTaskRunEvent,
  createTaskRunLedger,
  projectTaskRunLedgers,
  type TaskRunLedger,
  type TaskRunLedgerProjection,
} from "./taskRunLedger";
import type { AssetLibraryAsset, AssetLibrarySnapshot } from "./assetLibraryCrud";

export const currentProjectImage2BatchSchemaVersion = "0.1.0";

export type CurrentProjectImage2BatchStatus = "ready_for_review" | "blocked";

export type CurrentProjectImage2ReferenceRole = "character" | "scene" | "style";

export type CurrentProjectImage2ReferenceInput =
  | string
  | {
      id?: string;
      path?: string;
      role?: CurrentProjectImage2ReferenceRole | string;
      locked?: boolean;
      lockedStatus?: string;
      status?: string;
      safeForFutureReference?: boolean;
    };

export type CurrentProjectImage2ReferenceSet = Partial<
  Record<CurrentProjectImage2ReferenceRole, CurrentProjectImage2ReferenceInput | CurrentProjectImage2ReferenceInput[]>
>;

export interface CurrentProjectImage2ShotInput {
  id?: string;
  shotId?: string;
  taskRunId?: string;
  packetId?: string;
  envelopeId?: string;
  expectedOutputPath?: string;
  providerObservationPath?: string;
  semanticQaPath?: string;
  promptPath?: string;
  referencePaths?: string[];
}

export interface BuildCurrentProjectImage2BatchPlanInput {
  projectId: string;
  runId: string;
  projectRoot: string;
  runRoot?: string;
  generatedAt?: string;
  maxImages?: number;
  selectedShotIds?: string[];
  shotIds?: string[];
  shots?: Array<string | CurrentProjectImage2ShotInput>;
  references?: CurrentProjectImage2ReferenceSet;
  assetLibrary?: AssetLibrarySnapshot;
}

export interface CurrentProjectImage2BatchSubmitPolicy {
  providerCallAllowed: false;
  dryRunOnly: true;
  manualSubmitRequired: true;
  liveSubmitAllowed: false;
  noSeedance: true;
  noJimeng: true;
  noVideo: true;
  noFast: true;
  noVip: true;
}

export interface CurrentProjectImage2BatchPlanItem {
  shotId: string;
  taskRunId: string;
  packetId: string;
  envelopeId: string;
  expectedOutputPath: string;
  providerObservationPath: string;
  semanticQaPath: string;
  promptPath: string;
  referencePaths: string[];
  queueOrder: number;
  submitPolicy: CurrentProjectImage2BatchSubmitPolicy;
  status: CurrentProjectImage2BatchStatus;
  blockers: string[];
}

export interface CurrentProjectImage2BatchUiSummary {
  plannedCount: number;
  blockedCount: number;
  readyCount: number;
  selectedShotIds: string[];
  nextAction: string;
}

export interface CurrentProjectImage2BatchPlan {
  schemaVersion: string;
  generatedAt: string;
  projectId: string;
  runId: string;
  projectRoot: string;
  runRoot: string;
  status: CurrentProjectImage2BatchStatus;
  submitPolicy: CurrentProjectImage2BatchSubmitPolicy;
  items: CurrentProjectImage2BatchPlanItem[];
  blockers: string[];
  uiSummary: CurrentProjectImage2BatchUiSummary;
}

export interface CurrentProjectImage2BatchLedgerSummary {
  total: number;
  queued: number;
  blocked: number;
  parked: number;
  completeVerified: number;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  noFileMutation: true;
  workerSpawnForbidden: true;
  providerCalled: false;
}

export interface CurrentProjectImage2BatchLedgerProjection {
  schemaVersion: string;
  projectId: string;
  runId: string;
  ledgers: TaskRunLedger[];
  projections: TaskRunLedgerProjection[];
  summary: CurrentProjectImage2BatchLedgerSummary;
}

export interface CurrentProjectImage2BatchRuntimeProjectionItem {
  taskRunId: string;
  envelopeId?: string;
  status: TaskRunLedgerProjection["reportSummary"]["status"];
  previewStatus: TaskRunLedgerProjection["previewSummary"]["status"];
  completeVerified: boolean;
  providerObserved: boolean;
  qaReviewed: boolean;
  terminal: boolean;
  manifestSummary: TaskRunLedgerProjection["manifestSummary"];
  reportSummary: TaskRunLedgerProjection["reportSummary"];
  previewSummary: TaskRunLedgerProjection["previewSummary"];
}

export interface CurrentProjectImage2BatchRuntimeProjectionSummary {
  total: number;
  queued: number;
  parked: number;
  blocked: number;
  candidate: number;
  qaPending: number;
  needsReview: number;
  completeVerified: number;
  providerCalled: false;
  liveSubmitAllowed: false;
  noFileMutation: true;
  workerSpawnForbidden: true;
  creatorShortStatus: string;
}

export interface ProjectCurrentProjectImage2BatchRuntimeProjectionInput {
  schemaVersion: string;
  projectId: string;
  runId: string;
  generatedAt: string;
  projections: TaskRunLedgerProjection[];
}

export interface CurrentProjectImage2BatchRuntimeProjection {
  schemaVersion: string;
  projectId: string;
  runId: string;
  generatedAt: string;
  summary: CurrentProjectImage2BatchRuntimeProjectionSummary;
  items: CurrentProjectImage2BatchRuntimeProjectionItem[];
}

export interface CurrentProjectImage2AssetLibraryReferenceSummary {
  eligibleCount: number;
  blockedCount: number;
  warningCount: number;
  byRole: Record<CurrentProjectImage2ReferenceRole, number>;
}

export interface CurrentProjectImage2AssetLibraryReferenceReadiness {
  references: CurrentProjectImage2ReferenceSet;
  blockers: string[];
  warnings: string[];
  summary: CurrentProjectImage2AssetLibraryReferenceSummary;
}

const defaultGeneratedAt = "1970-01-01T00:00:00.000Z";
const defaultMaxImages = 10;
const requiredReferenceRoles: CurrentProjectImage2ReferenceRole[] = ["character", "scene", "style"];
const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/]|[a-zA-Z][a-zA-Z0-9+.-]*:)/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;

const fixedSubmitPolicy: CurrentProjectImage2BatchSubmitPolicy = {
  providerCallAllowed: false,
  dryRunOnly: true,
  manualSubmitRequired: true,
  liveSubmitAllowed: false,
  noSeedance: true,
  noJimeng: true,
  noVideo: true,
  noFast: true,
  noVip: true,
};

function cloneSubmitPolicy(): CurrentProjectImage2BatchSubmitPolicy {
  return { ...fixedSubmitPolicy };
}

function normalizePath(value: string | undefined): string {
  return (value || "").trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function joinPortablePath(...parts: string[]): string {
  return normalizePath(parts.map((part) => normalizePath(part).replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/"));
}

function safeId(value: string): string {
  const safe = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return safe || "item";
}

function uniqueInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizePath(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function mergeReferences(
  first: CurrentProjectImage2ReferenceSet | undefined,
  second: CurrentProjectImage2ReferenceSet | undefined,
): CurrentProjectImage2ReferenceSet | undefined {
  const result: CurrentProjectImage2ReferenceSet = {};
  for (const role of requiredReferenceRoles) {
    const entries = [...referenceList(first?.[role]), ...referenceList(second?.[role])];
    if (entries.length) result[role] = entries;
  }
  return Object.keys(result).length ? result : undefined;
}

function sourceKindCannotBeFutureReference(sourceKind: string | undefined): boolean {
  return (
    sourceKind === "provider_temp_output" ||
    sourceKind === "failed_output" ||
    sourceKind === "shot_output" ||
    sourceKind === "contact_sheet"
  );
}

function assetFutureReferenceBlockers(asset: AssetLibraryAsset): string[] {
  const blockers: string[] = [];
  const authority = asset.referenceAuthority;

  if (asset.assetType !== "character" && asset.assetType !== "scene" && asset.assetType !== "style") {
    blockers.push(`asset_library_${asset.id}_unsupported_reference_asset_type`);
  }
  if (asset.status !== "locked") blockers.push(`asset_library_${asset.id}_status_${asset.status}_not_locked`);
  if (sourceKindCannotBeFutureReference(asset.sourceKind)) blockers.push(`asset_library_${asset.id}_${asset.sourceKind}_not_future_reference`);
  if (!asset.canUseAsFutureReference) blockers.push(`asset_library_${asset.id}_asset_future_reference_forbidden`);
  if (!authority.canUseAsFutureReference) blockers.push(`asset_library_${asset.id}_authority_future_reference_forbidden`);
  if (!authority.allowedUse.includes("future_reference")) blockers.push(`asset_library_${asset.id}_authority_missing_future_reference_use`);
  if (authority.lockedStatus !== "locked") blockers.push(`asset_library_${asset.id}_authority_not_locked`);
  if (authority.polarity !== "positive") blockers.push(`asset_library_${asset.id}_authority_not_positive`);
  if (!normalizePath(asset.mainReferencePath || authority.path)) blockers.push(`asset_library_${asset.id}_reference_path_missing`);

  return uniqueInOrder(blockers);
}

export function buildCurrentProjectImage2ReferencesFromAssetLibrary(
  library: AssetLibrarySnapshot,
): CurrentProjectImage2AssetLibraryReferenceReadiness {
  const references: CurrentProjectImage2ReferenceSet = {};
  const blockers: string[] = [];
  const warnings: string[] = [];
  const byRole: Record<CurrentProjectImage2ReferenceRole, number> = { character: 0, scene: 0, style: 0 };
  let blockedCount = 0;

  for (const asset of library.assets) {
    if (asset.assetType !== "character" && asset.assetType !== "scene" && asset.assetType !== "style") continue;

    const assetBlockers = assetFutureReferenceBlockers(asset);
    if (assetBlockers.length) {
      blockedCount += 1;
      warnings.push(...assetBlockers);
      continue;
    }

    const role = asset.assetType;
    const reference = {
      id: asset.id,
      path: normalizePath(asset.mainReferencePath || asset.referenceAuthority.path),
      role,
      locked: true,
      lockedStatus: "locked",
      status: "locked",
      safeForFutureReference: true,
    };
    const existing = referenceList(references[role]);
    references[role] = [...existing, reference];
    byRole[role] += 1;
  }

  for (const role of requiredReferenceRoles) {
    if (!byRole[role]) blockers.push(`asset_library_missing_locked_${role}_future_reference`);
  }

  for (const blockedImport of library.blockedImports) {
    if (sourceKindCannotBeFutureReference(blockedImport.sourceKind)) {
      warnings.push(`asset_library_blocked_import_${blockedImport.sourceKind}_not_future_reference`);
    }
  }

  return {
    references,
    blockers: uniqueInOrder(blockers),
    warnings: uniqueInOrder(warnings),
    summary: {
      eligibleCount: byRole.character + byRole.scene + byRole.style,
      blockedCount,
      warningCount: uniqueInOrder(warnings).length,
      byRole,
    },
  };
}

function pathIsPortable(value: string): boolean {
  const normalized = normalizePath(value);
  return Boolean(normalized) && !absolutePathPattern.test(normalized) && !parentTraversalPattern.test(normalized);
}

function pathIsInside(path: string, root: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedRoot = normalizePath(root);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function validatePortablePath(field: string, value: string): string[] {
  const normalized = normalizePath(value);
  if (!normalized) return [`${field}_missing`];
  if (absolutePathPattern.test(normalized)) return [`${field}_must_be_portable_not_absolute`];
  if (parentTraversalPattern.test(normalized)) return [`${field}_must_not_use_parent_traversal`];
  return [];
}

function referenceList(value: CurrentProjectImage2ReferenceInput | CurrentProjectImage2ReferenceInput[] | undefined): CurrentProjectImage2ReferenceInput[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function referencePath(reference: CurrentProjectImage2ReferenceInput): string {
  return typeof reference === "string" ? normalizePath(reference) : normalizePath(reference.path || reference.id || "");
}

function referenceIsLocked(reference: CurrentProjectImage2ReferenceInput): boolean {
  if (typeof reference === "string") return Boolean(normalizePath(reference));
  if (reference.locked === false) return false;
  if (reference.locked === true) return true;
  if (reference.lockedStatus !== undefined) return reference.lockedStatus === "locked";
  if (reference.status !== undefined) return reference.status === "locked" || reference.status === "exists";
  return reference.safeForFutureReference === true;
}

function normalizeReferences(references: CurrentProjectImage2ReferenceSet | undefined): {
  paths: string[];
  blockers: string[];
} {
  const blockers: string[] = [];
  const paths: string[] = [];

  for (const role of requiredReferenceRoles) {
    const entries = referenceList(references?.[role]);
    if (!entries.length) {
      blockers.push(`missing_locked_${role}_reference`);
      continue;
    }

    const locked = entries.filter(referenceIsLocked);
    if (!locked.length) {
      blockers.push(`missing_locked_${role}_reference`);
      continue;
    }

    for (const reference of locked) {
      const path = referencePath(reference);
      if (!path) {
        blockers.push(`missing_locked_${role}_reference_path`);
        continue;
      }
      blockers.push(...validatePortablePath(`${role}_reference_path`, path));
      paths.push(path);
    }
  }

  return { paths: uniqueInOrder(paths), blockers: uniqueInOrder(blockers) };
}

function shotIdFromShot(shot: string | CurrentProjectImage2ShotInput): string {
  return typeof shot === "string" ? shot : shot.shotId || shot.id || "";
}

function shotById(shots: Array<string | CurrentProjectImage2ShotInput> | undefined): Map<string, CurrentProjectImage2ShotInput> {
  const result = new Map<string, CurrentProjectImage2ShotInput>();
  for (const shot of shots || []) {
    if (typeof shot === "string") continue;
    const shotId = normalizePath(shot.shotId || shot.id || "");
    if (shotId) result.set(shotId, shot);
  }
  return result;
}

function selectedShotIds(input: BuildCurrentProjectImage2BatchPlanInput): string[] {
  const explicit = input.selectedShotIds?.length
    ? input.selectedShotIds
    : input.shotIds?.length
      ? input.shotIds
      : (input.shots || []).map(shotIdFromShot);
  return uniqueInOrder(explicit.map((item) => item.trim()).filter(Boolean));
}

function itemBlockers(
  item: Pick<
    CurrentProjectImage2BatchPlanItem,
    "expectedOutputPath" | "providerObservationPath" | "semanticQaPath" | "promptPath" | "referencePaths"
  >,
  projectRoot: string,
  runRoot: string,
): string[] {
  const blockers = [
    ...validatePortablePath("expected_output_path", item.expectedOutputPath),
    ...validatePortablePath("provider_observation_path", item.providerObservationPath),
    ...validatePortablePath("semantic_qa_path", item.semanticQaPath),
    ...validatePortablePath("prompt_path", item.promptPath),
    ...item.referencePaths.flatMap((path) => validatePortablePath("reference_path", path)),
  ];

  if (pathIsPortable(item.expectedOutputPath) && !pathIsInside(item.expectedOutputPath, runRoot)) {
    blockers.push("expected_output_path_outside_run_root");
  }
  if (pathIsPortable(item.providerObservationPath) && !pathIsInside(item.providerObservationPath, runRoot)) {
    blockers.push("provider_observation_path_outside_run_root");
  }
  if (pathIsPortable(item.semanticQaPath) && !pathIsInside(item.semanticQaPath, runRoot)) {
    blockers.push("semantic_qa_path_outside_run_root");
  }
  if (pathIsPortable(item.promptPath) && !pathIsInside(item.promptPath, projectRoot)) {
    blockers.push("prompt_path_outside_project_root");
  }
  for (const referencePath of item.referencePaths) {
    if (pathIsPortable(referencePath) && !pathIsInside(referencePath, projectRoot)) {
      blockers.push("reference_path_outside_project_root");
    }
  }

  return uniqueInOrder(blockers);
}

function creatorShortStatus(
  summary: Pick<
    CurrentProjectImage2BatchRuntimeProjectionSummary,
    "total" | "queued" | "parked" | "candidate" | "qaPending" | "needsReview" | "completeVerified"
  >,
): string {
  if (!summary.total) return "No Image2 items";
  if (summary.completeVerified === summary.total) return `Image2 ${summary.completeVerified}/${summary.total} complete`;
  if (summary.needsReview) return `Image2 ${summary.needsReview}/${summary.total} need review`;
  if (summary.qaPending) return `Image2 ${summary.qaPending}/${summary.total} waiting QA`;
  if (summary.candidate) return `Image2 ${summary.candidate}/${summary.total} waiting sidecars`;
  if (summary.parked && !summary.queued) return `Image2 ${summary.parked}/${summary.total} blocked`;
  if (summary.completeVerified) return `Image2 ${summary.completeVerified}/${summary.total} complete, ${summary.queued} queued`;
  if (summary.queued === summary.total) return `Image2 ${summary.queued} queued for review`;
  return `Image2 ${summary.queued} queued, ${summary.parked} blocked`;
}

export function buildCurrentProjectImage2BatchPlan(input: BuildCurrentProjectImage2BatchPlanInput): CurrentProjectImage2BatchPlan {
  const projectRoot = normalizePath(input.projectRoot);
  const runRoot = normalizePath(input.runRoot || joinPortablePath(projectRoot, "runs", input.runId));
  const shotIds = selectedShotIds(input);
  const maxImages = input.maxImages ?? defaultMaxImages;
  const shotOverrides = shotById(input.shots);
  const assetLibraryReferences = input.assetLibrary ? buildCurrentProjectImage2ReferencesFromAssetLibrary(input.assetLibrary) : undefined;
  const normalizedReferences = normalizeReferences(mergeReferences(assetLibraryReferences?.references, input.references));
  const globalBlockers: string[] = [];

  globalBlockers.push(...validatePortablePath("project_root", projectRoot));
  globalBlockers.push(...validatePortablePath("run_root", runRoot));
  if (projectRoot && runRoot && pathIsPortable(projectRoot) && pathIsPortable(runRoot) && !pathIsInside(runRoot, projectRoot)) {
    globalBlockers.push("run_root_outside_project_root");
  }
  if (!shotIds.length) globalBlockers.push("no_selected_shots");
  if (shotIds.length > maxImages) globalBlockers.push("selected_shots_exceed_max_images");
  globalBlockers.push(...(assetLibraryReferences?.blockers || []));
  globalBlockers.push(...normalizedReferences.blockers);

  const items = shotIds.map((shotId, index): CurrentProjectImage2BatchPlanItem => {
    const shot = shotOverrides.get(shotId);
    const safeShotId = safeId(shotId);
    const safeRunId = safeId(input.runId);
    const itemRoot = joinPortablePath(runRoot, "image2-prep", safeShotId);
    const referencePaths = uniqueInOrder([...(shot?.referencePaths || []), ...normalizedReferences.paths]);
    const itemDraft = {
      expectedOutputPath: normalizePath(shot?.expectedOutputPath || joinPortablePath(itemRoot, "start.png")),
      providerObservationPath: normalizePath(shot?.providerObservationPath || joinPortablePath(itemRoot, "provider_observation.json")),
      semanticQaPath: normalizePath(shot?.semanticQaPath || joinPortablePath(itemRoot, "semantic_qa.json")),
      promptPath: normalizePath(shot?.promptPath || joinPortablePath(projectRoot, "prompts", `${safeShotId}_start.md`)),
      referencePaths,
    };
    const blockers = itemBlockers(itemDraft, projectRoot, runRoot);

    return {
      shotId,
      taskRunId: shot?.taskRunId || `task_run_${safeRunId}_${safeShotId}_image2_start`,
      packetId: shot?.packetId || `packet_${safeRunId}_${safeShotId}_image2_start`,
      envelopeId: shot?.envelopeId || `envelope_${safeRunId}_${safeShotId}_image2_start`,
      ...itemDraft,
      queueOrder: index + 1,
      submitPolicy: cloneSubmitPolicy(),
      status: blockers.length ? "blocked" : "ready_for_review",
      blockers,
    };
  });

  const itemBlockerCount = items.filter((item) => item.blockers.length).length;
  const blockers = uniqueInOrder([...globalBlockers, ...items.flatMap((item) => item.blockers)]);
  const status: CurrentProjectImage2BatchStatus = blockers.length ? "blocked" : "ready_for_review";
  const readyCount = status === "ready_for_review" ? items.length : 0;
  const blockedCount = status === "blocked" ? Math.max(1, itemBlockerCount || shotIds.length || 1) : 0;

  return {
    schemaVersion: currentProjectImage2BatchSchemaVersion,
    generatedAt: input.generatedAt || defaultGeneratedAt,
    projectId: input.projectId,
    runId: input.runId,
    projectRoot,
    runRoot,
    status,
    submitPolicy: cloneSubmitPolicy(),
    items: items.map((item) => ({
      ...item,
      status: status === "blocked" ? "blocked" : item.status,
      submitPolicy: cloneSubmitPolicy(),
    })),
    blockers,
    uiSummary: {
      plannedCount: items.length,
      blockedCount,
      readyCount,
      selectedShotIds: shotIds,
      nextAction:
        status === "ready_for_review"
          ? "Review the dry-run Image2 batch packet before any manual submit."
          : "Resolve blocked shot selection, locked references, or portable run-root paths before review.",
    },
  };
}

export function projectCurrentProjectImage2BatchLedgers(plan: CurrentProjectImage2BatchPlan): CurrentProjectImage2BatchLedgerProjection {
  const ledgers = plan.items.map((item) => {
    const preparedNotes = [
      `packet:${item.packetId}`,
      `queue_order:${item.queueOrder}`,
      "provider_submission_forbidden",
      "live_submit_allowed:false",
      "no_file_mutation",
      "worker_spawn_forbidden",
    ];
    const baseLedger = createTaskRunLedger({
      projectId: plan.projectId,
      taskRunId: item.taskRunId,
      envelopeId: item.envelopeId,
      createdAt: plan.generatedAt,
      expectedOutputs: [item.expectedOutputPath],
    });
    const preparedLedger = appendTaskRunEvent(baseLedger, {
      eventType: "task_prepared",
      at: plan.generatedAt,
      reason: "Current project Image2 batch item prepared for dry-run review only.",
      notes: preparedNotes,
    });

    if (item.status === "ready_for_review") {
      return appendTaskRunEvent(preparedLedger, {
        eventType: "task_queued",
        at: plan.generatedAt,
        reason: "Ready for review queue projection; live provider submit remains forbidden.",
        notes: ["manual_submit_required", "provider_called:false"],
      });
    }

    return appendTaskRunEvent(preparedLedger, {
      eventType: "parked",
      at: plan.generatedAt,
      reason: uniqueInOrder([...item.blockers, ...plan.blockers]).join(", ") || "Current project Image2 batch is blocked.",
      notes: ["blocked_before_provider_submit", "provider_called:false"],
    });
  });
  const batchProjection = projectTaskRunLedgers(ledgers);

  return {
    schemaVersion: plan.schemaVersion,
    projectId: plan.projectId,
    runId: plan.runId,
    ledgers,
    projections: batchProjection.projections,
    summary: {
      total: batchProjection.total,
      queued: batchProjection.byStatus.queued,
      blocked: plan.items.filter((item) => item.status === "blocked").length,
      parked: batchProjection.byStatus.parked,
      completeVerified: batchProjection.byStatus.complete_verified,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      noFileMutation: true,
      workerSpawnForbidden: true,
      providerCalled: false,
    },
  };
}

export function projectCurrentProjectImage2BatchRuntimeProjectionFromLedgerProjections(
  input: ProjectCurrentProjectImage2BatchRuntimeProjectionInput,
): CurrentProjectImage2BatchRuntimeProjection {
  const items = input.projections.map((projection): CurrentProjectImage2BatchRuntimeProjectionItem => ({
    taskRunId: projection.reportSummary.taskRunId,
    envelopeId: projection.manifestSummary.envelopeId,
    status: projection.reportSummary.status,
    previewStatus: projection.previewSummary.status,
    completeVerified: projection.reportSummary.completeVerified,
    providerObserved: projection.reportSummary.providerObserved,
    qaReviewed: projection.reportSummary.qaReviewed,
    terminal: projection.reportSummary.terminal,
    manifestSummary: projection.manifestSummary,
    reportSummary: projection.reportSummary,
    previewSummary: projection.previewSummary,
  }));
  const statusCounts = items.reduce(
    (counts, item) => {
      if (item.status === "queued") counts.queued += 1;
      if (item.status === "parked") counts.parked += 1;
      if (item.previewStatus === "candidate") counts.candidate += 1;
      if (item.previewStatus === "qa_pending") counts.qaPending += 1;
      if (item.previewStatus === "needs_review") counts.needsReview += 1;
      if (item.completeVerified) counts.completeVerified += 1;
      return counts;
    },
    { queued: 0, parked: 0, candidate: 0, qaPending: 0, needsReview: 0, completeVerified: 0 },
  );
  const summaryDraft = {
    total: items.length,
    queued: statusCounts.queued,
    parked: statusCounts.parked,
    blocked: statusCounts.parked,
    candidate: statusCounts.candidate,
    qaPending: statusCounts.qaPending,
    needsReview: statusCounts.needsReview,
    completeVerified: statusCounts.completeVerified,
  };

  return {
    schemaVersion: input.schemaVersion,
    projectId: input.projectId,
    runId: input.runId,
    generatedAt: input.generatedAt,
    summary: {
      ...summaryDraft,
      providerCalled: false,
      liveSubmitAllowed: false,
      noFileMutation: true,
      workerSpawnForbidden: true,
      creatorShortStatus: creatorShortStatus(summaryDraft),
    },
    items,
  };
}

export function projectCurrentProjectImage2BatchRuntimeProjection(
  plan: CurrentProjectImage2BatchPlan,
): CurrentProjectImage2BatchRuntimeProjection {
  const ledgerProjection = projectCurrentProjectImage2BatchLedgers(plan);
  return projectCurrentProjectImage2BatchRuntimeProjectionFromLedgerProjections({
    schemaVersion: plan.schemaVersion,
    projectId: plan.projectId,
    runId: plan.runId,
    generatedAt: plan.generatedAt,
    projections: ledgerProjection.projections,
  });
}
