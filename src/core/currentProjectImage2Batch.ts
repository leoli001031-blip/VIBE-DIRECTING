import {
  appendTaskRunEvent,
  createTaskRunLedger,
  projectTaskRunLedgers,
  type TaskRunLedger,
  type TaskRunLedgerProjection,
} from "./taskRunLedger";
import {
  createProviderRetrySchedulerState,
  providerRetryAttemptReceiptCandidates,
  queueNextProviderRetryBatch,
  type ProviderRetryFailureKind,
  type ProviderRetryPolicy,
  type ProviderRetrySchedulerState,
  type ProviderRetryTask,
} from "./providerRetryScheduler";
import {
  IMAGE2_GENERATE_MAX_AUTO_RETRIES,
  IMAGE2_GENERATE_MAX_CONCURRENCY,
  IMAGE2_GENERATE_RETRY_CONCURRENCY,
  IMAGE2_REFERENCE_EDIT_MAX_AUTO_RETRIES,
  IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY,
  IMAGE2_REFERENCE_EDIT_RETRY_CONCURRENCY,
  getProviderRule,
} from "./providerPolicy";
import type { AssetLibraryAsset, AssetLibrarySnapshot } from "./assetLibraryCrud";
import type { CurrentProjectPreviewItemInput } from "./currentProjectPreviewProjection";

export const currentProjectImage2BatchSchemaVersion = "0.1.0";
export const currentProjectImage2BatchPolicySchemaVersion = "current_project_image2_batch_policy_v1";

export type CurrentProjectImage2BatchStatus = "ready_for_review" | "blocked";
export type CurrentProjectImage2BatchExecutionStatus =
  | "queued"
  | "blocked"
  | "completed_needs_review"
  | "completed_with_missing"
  | "missing";

export type CurrentProjectImage2ReferenceRole = "character" | "scene" | "style" | "prop";

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

export interface CurrentProjectImage2BatchPolicyProjection {
  schemaVersion: typeof currentProjectImage2BatchPolicySchemaVersion;
  providerCalled: false;
  liveSubmitAllowed: false;
  promotionAllowed: false;
  imageGenerate: {
    providerSlot: "image.generate";
    activeProvider?: string;
    requiredMode: "text2image";
    concurrency: typeof IMAGE2_GENERATE_MAX_CONCURRENCY;
    retryConcurrency: typeof IMAGE2_GENERATE_RETRY_CONCURRENCY;
    maxAutoRetries: typeof IMAGE2_GENERATE_MAX_AUTO_RETRIES;
    successfulReturnStatus: "needs_review";
    missingReturnStatus: "missing";
    lateReturnStatus: "needs_review";
    threeConcurrentTextToImageDefaultAllowed: true;
  };
  imageEditReference: {
    providerSlot: "image.edit";
    activeProvider?: string;
    requiredMode: "image2image";
    concurrency: typeof IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY;
    referenceConcurrency: typeof IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY;
    retryConcurrency: typeof IMAGE2_REFERENCE_EDIT_RETRY_CONCURRENCY;
    maxAutoRetries: typeof IMAGE2_REFERENCE_EDIT_MAX_AUTO_RETRIES;
    textToImageFallbackAllowed: false;
    successfulReturnStatus: "needs_review";
    missingReturnStatus: "missing";
    lateReturnStatus: "needs_review";
  };
}

export type CurrentProjectImage2CircuitBreakerStatus = "closed" | "retry_downshift" | "open";

export interface CurrentProjectImage2CircuitBreakerProjection {
  schemaVersion: "current_project_image2_circuit_breaker_v1";
  status: CurrentProjectImage2CircuitBreakerStatus;
  defaultConcurrency: number;
  retryConcurrency: number;
  activeConcurrency: number;
  maxAutoRetries: number;
  retryableFailureKinds: ProviderRetryFailureKind[];
  networkErrorCount: number;
  retryableFailureCount: number;
  retryScheduledCount: number;
  terminalFailedCount: number;
  nextRunnableCount: number;
  downshiftOnNetworkError: true;
  providerCalled: boolean;
  liveSubmitAllowed: false;
  promotionAllowed: false;
  nextAction: "run_default_batch" | "retry_missing_at_reduced_concurrency" | "manual_review_required";
  userLabel: string;
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
  policyProjection: CurrentProjectImage2BatchPolicyProjection;
  items: CurrentProjectImage2BatchPlanItem[];
  blockers: string[];
  uiSummary: CurrentProjectImage2BatchUiSummary;
}

export interface CurrentProjectImage2BatchRetrySchedulerProjection {
  schemaVersion: ProviderRetrySchedulerState["schemaVersion"];
  mode: "planning_only_retry_scheduler_projection";
  actualProviderRetryAllowed: false;
  automaticProviderRetryAllowed: false;
  requiresExplicitPermissionReceipt: true;
  noPromotionWithoutReceipt: true;
  providerCalled: false;
  liveSubmitAllowed: false;
  dryRunOnly: true;
  promotionAllowed: false;
  policyProjection: CurrentProjectImage2BatchPolicyProjection;
  schedulerState: ProviderRetrySchedulerState;
  circuitBreaker: CurrentProjectImage2CircuitBreakerProjection;
  attemptReceiptCandidates: ReturnType<typeof providerRetryAttemptReceiptCandidates>;
  summary: ProviderRetrySchedulerState["summary"] & {
    nextRunnableCount: number;
    blockedFromRetryCount: number;
  };
}

export interface CurrentProjectImage2BatchExecutionItem {
  taskId: string;
  shotId: string;
  expectedOutputPath: string;
  status: "needs_review" | "missing" | "blocked";
  providerReturned: boolean;
  outputPath?: string;
  outputSha256?: string;
  attemptId?: string;
  reasons: string[];
  promotionAllowed: false;
}

export interface CurrentProjectImage2BatchExecutionSummary {
  schemaVersion: typeof currentProjectImage2BatchPolicySchemaVersion;
  status: CurrentProjectImage2BatchExecutionStatus;
  requestedCount: number;
  returnedCount: number;
  missingCount: number;
  needsReviewCount: number;
  blockedCount: number;
  maxConcurrency: number;
  retryConcurrency: number;
  maxAutoRetries: number;
  promotionAllowed: false;
  missingCanPromote: false;
  lateReturnCanPromote: false;
  items: CurrentProjectImage2BatchExecutionItem[];
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
const defaultMaxImages = 3;
const requiredReferenceRoles: CurrentProjectImage2ReferenceRole[] = ["character", "scene", "style"];
const supportedReferenceRoles: CurrentProjectImage2ReferenceRole[] = ["character", "scene", "style", "prop"];
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

export function getCurrentProjectImage2BatchPolicyProjection(): CurrentProjectImage2BatchPolicyProjection {
  const imageGenerateRule = getProviderRule("image.generate");
  const imageEditRule = getProviderRule("image.edit");

  return {
    schemaVersion: currentProjectImage2BatchPolicySchemaVersion,
    providerCalled: false,
    liveSubmitAllowed: false,
    promotionAllowed: false,
    imageGenerate: {
      providerSlot: "image.generate",
      activeProvider: imageGenerateRule?.activeProvider,
      requiredMode: "text2image",
      concurrency: IMAGE2_GENERATE_MAX_CONCURRENCY,
      retryConcurrency: IMAGE2_GENERATE_RETRY_CONCURRENCY,
      maxAutoRetries: IMAGE2_GENERATE_MAX_AUTO_RETRIES,
      successfulReturnStatus: "needs_review",
      missingReturnStatus: "missing",
      lateReturnStatus: "needs_review",
      threeConcurrentTextToImageDefaultAllowed: true,
    },
    imageEditReference: {
      providerSlot: "image.edit",
      activeProvider: imageEditRule?.activeProvider,
      requiredMode: "image2image",
      concurrency: IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY,
      referenceConcurrency: IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY,
      retryConcurrency: IMAGE2_REFERENCE_EDIT_RETRY_CONCURRENCY,
      maxAutoRetries: IMAGE2_REFERENCE_EDIT_MAX_AUTO_RETRIES,
      textToImageFallbackAllowed: false,
      successfulReturnStatus: "needs_review",
      missingReturnStatus: "missing",
      lateReturnStatus: "needs_review",
    },
  };
}

export function buildCurrentProjectImage2GenerateRetryPolicy(
  overrides: Partial<ProviderRetryPolicy> = {},
): ProviderRetryPolicy {
  const maxConcurrency = Math.min(
    IMAGE2_GENERATE_MAX_CONCURRENCY,
    Math.max(0, Math.floor(overrides.maxConcurrency ?? IMAGE2_GENERATE_MAX_CONCURRENCY)),
  );
  const retryConcurrency = Math.min(
    IMAGE2_GENERATE_RETRY_CONCURRENCY,
    Math.max(0, Math.floor(overrides.retryConcurrency ?? IMAGE2_GENERATE_RETRY_CONCURRENCY)),
  );
  const maxAutoRetries = Math.min(
    IMAGE2_GENERATE_MAX_AUTO_RETRIES,
    Math.max(0, Math.floor(overrides.maxAutoRetries ?? IMAGE2_GENERATE_MAX_AUTO_RETRIES)),
  );

  return {
    maxConcurrency,
    retryConcurrency,
    maxAutoRetries,
    baseDelayMs: Math.max(0, Math.floor(overrides.baseDelayMs ?? 1_500)),
    maxDelayMs: Math.max(0, Math.floor(overrides.maxDelayMs ?? 30_000)),
    jitterRatio: Math.max(0, overrides.jitterRatio ?? 0),
    retryableFailureKinds: overrides.retryableFailureKinds || [
      "timeout",
      "rate_limit",
      "server_error",
      "network_error",
      "provider_missing",
    ],
    terminalFailureKinds: overrides.terminalFailureKinds || [
      "auth",
      "validation_error",
      "content_policy",
      "qa_failed",
      "cancelled",
    ],
  };
}

export function projectCurrentProjectImage2CircuitBreaker(
  state?: ProviderRetrySchedulerState,
): CurrentProjectImage2CircuitBreakerProjection {
  const policy = state?.policy || buildCurrentProjectImage2GenerateRetryPolicy();
  const retryConcurrency = policy.retryConcurrency ?? policy.maxConcurrency;
  const attempts = state?.attempts || [];
  const nextRunnable = state ? queueNextProviderRetryBatch(state, state.summary.lastUpdatedAt || state.generatedAt) : [];
  const networkErrorCount = attempts.filter((attempt) => attempt.failureKind === "network_error").length;
  const retryableFailureCount = attempts.filter(
    (attempt) => attempt.failureKind && policy.retryableFailureKinds.includes(attempt.failureKind),
  ).length;
  const retryScheduledCount = state?.summary.retryScheduled ?? 0;
  const terminalFailedCount = state?.summary.terminalFailed ?? 0;
  const retrySignal =
    retryScheduledCount > 0 ||
    retryableFailureCount > 0 ||
    nextRunnable.some((attempt) => attempt.attemptNumber > 1);
  const exhaustedAfterRetryableFailure =
    Boolean(state && state.tasks.length > 0) &&
    retryableFailureCount > 0 &&
    terminalFailedCount > 0 &&
    (state?.summary.queued ?? 0) === 0 &&
    (state?.summary.running ?? 0) === 0 &&
    (state?.summary.succeeded ?? 0) < (state?.tasks.length ?? 0);
  const status: CurrentProjectImage2CircuitBreakerStatus = exhaustedAfterRetryableFailure
    ? "open"
    : retrySignal
      ? "retry_downshift"
      : "closed";
  const activeConcurrency =
    status === "open" ? 0 : status === "retry_downshift" ? retryConcurrency : policy.maxConcurrency;

  return {
    schemaVersion: "current_project_image2_circuit_breaker_v1",
    status,
    defaultConcurrency: policy.maxConcurrency,
    retryConcurrency,
    activeConcurrency,
    maxAutoRetries: policy.maxAutoRetries,
    retryableFailureKinds: policy.retryableFailureKinds,
    networkErrorCount,
    retryableFailureCount,
    retryScheduledCount,
    terminalFailedCount,
    nextRunnableCount: nextRunnable.length,
    downshiftOnNetworkError: true,
    providerCalled: state?.summary.providerCalled ?? false,
    liveSubmitAllowed: false,
    promotionAllowed: false,
    nextAction:
      status === "open"
        ? "manual_review_required"
        : status === "retry_downshift"
          ? "retry_missing_at_reduced_concurrency"
          : "run_default_batch",
    userLabel:
      status === "open"
        ? "Manual review needed"
        : status === "retry_downshift"
          ? `Retry at ${retryConcurrency}`
          : `Default ${policy.maxConcurrency}`,
  };
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

function stablePlanHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
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
  for (const role of supportedReferenceRoles) {
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

  if (asset.assetType !== "character" && asset.assetType !== "scene" && asset.assetType !== "style" && asset.assetType !== "prop") {
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
  const byRole: Record<CurrentProjectImage2ReferenceRole, number> = { character: 0, scene: 0, style: 0, prop: 0 };
  let blockedCount = 0;

  for (const asset of library.assets) {
    if (asset.assetType !== "character" && asset.assetType !== "scene" && asset.assetType !== "style" && asset.assetType !== "prop") continue;

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
      eligibleCount: byRole.character + byRole.scene + byRole.style + byRole.prop,
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

  for (const role of supportedReferenceRoles) {
    const entries = referenceList(references?.[role]);
    if (!entries.length) {
      if (requiredReferenceRoles.includes(role)) blockers.push(`missing_locked_${role}_reference`);
      continue;
    }

    const locked = entries.filter(referenceIsLocked);
    if (!locked.length) {
      if (requiredReferenceRoles.includes(role)) blockers.push(`missing_locked_${role}_reference`);
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
    policyProjection: getCurrentProjectImage2BatchPolicyProjection(),
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

function inputHashForCurrentProjectImage2BatchItem(item: CurrentProjectImage2BatchPlanItem): string {
  return stablePlanHash(
    [
      item.shotId,
      item.taskRunId,
      item.packetId,
      item.envelopeId,
      item.expectedOutputPath,
      item.providerObservationPath,
      item.semanticQaPath,
      item.promptPath,
      ...item.referencePaths,
    ].join("\n"),
  );
}

export function buildCurrentProjectImage2ProviderRetryTasks(
  plan: CurrentProjectImage2BatchPlan,
  options: {
    permissionReceiptIdsByShotId?: Record<string, string>;
    permissionReceiptIdsByTaskRunId?: Record<string, string>;
  } = {},
): ProviderRetryTask[] {
  return plan.items
    .filter((item) => item.status === "ready_for_review")
    .map((item) => ({
      taskId: item.taskRunId,
      shotId: item.shotId,
      inputHash: inputHashForCurrentProjectImage2BatchItem(item),
      permissionReceiptId:
        options.permissionReceiptIdsByTaskRunId?.[item.taskRunId] ||
        options.permissionReceiptIdsByShotId?.[item.shotId] ||
        `manual_permission_required:${item.shotId}`,
      expectedOutputPath: item.expectedOutputPath,
      priority: Math.max(0, plan.items.length - item.queueOrder),
    }));
}

export function buildCurrentProjectImage2ProviderRetrySchedulerState(
  plan: CurrentProjectImage2BatchPlan,
  options: {
    generatedAt?: string;
    policyOverrides?: Partial<ProviderRetryPolicy>;
    permissionReceiptIdsByShotId?: Record<string, string>;
    permissionReceiptIdsByTaskRunId?: Record<string, string>;
  } = {},
): ProviderRetrySchedulerState {
  return createProviderRetrySchedulerState({
    tasks: buildCurrentProjectImage2ProviderRetryTasks(plan, options),
    policy: buildCurrentProjectImage2GenerateRetryPolicy(options.policyOverrides),
    generatedAt: options.generatedAt || plan.generatedAt,
  });
}

export function projectCurrentProjectImage2ProviderRetryScheduler(
  plan: CurrentProjectImage2BatchPlan,
  options: {
    generatedAt?: string;
    policyOverrides?: Partial<ProviderRetryPolicy>;
    permissionReceiptIdsByShotId?: Record<string, string>;
    permissionReceiptIdsByTaskRunId?: Record<string, string>;
  } = {},
): CurrentProjectImage2BatchRetrySchedulerProjection {
  const state = buildCurrentProjectImage2ProviderRetrySchedulerState(plan, options);
  const nextRunnable = queueNextProviderRetryBatch(state, options.generatedAt || plan.generatedAt);
  const circuitBreaker = projectCurrentProjectImage2CircuitBreaker(state);

  return {
    schemaVersion: state.schemaVersion,
    mode: "planning_only_retry_scheduler_projection",
    actualProviderRetryAllowed: false,
    automaticProviderRetryAllowed: false,
    requiresExplicitPermissionReceipt: true,
    noPromotionWithoutReceipt: true,
    providerCalled: false,
    liveSubmitAllowed: false,
    dryRunOnly: true,
    promotionAllowed: false,
    policyProjection: plan.policyProjection,
    schedulerState: state,
    circuitBreaker,
    attemptReceiptCandidates: providerRetryAttemptReceiptCandidates(state),
    summary: {
      ...state.summary,
      providerCalled: false,
      promotionAllowed: false,
      nextRunnableCount: nextRunnable.length,
      blockedFromRetryCount: plan.items.length - state.tasks.length,
    },
  };
}

function latestSucceededCurrentProjectImage2Attempt(state: ProviderRetrySchedulerState, task: ProviderRetryTask) {
  return state.attempts
    .filter((attempt) => attempt.taskId === task.taskId && attempt.status === "succeeded")
    .sort((left, right) => right.attemptNumber - left.attemptNumber)[0];
}

function currentProjectImage2TaskHasTerminalFailure(state: ProviderRetrySchedulerState, task: ProviderRetryTask): boolean {
  return state.attempts.some((attempt) => attempt.taskId === task.taskId && attempt.status === "failed_terminal");
}

export function summarizeCurrentProjectImage2BatchExecution(
  state: ProviderRetrySchedulerState,
): CurrentProjectImage2BatchExecutionSummary {
  const policyProjection = getCurrentProjectImage2BatchPolicyProjection();
  const items: CurrentProjectImage2BatchExecutionItem[] = state.tasks.map((task) => {
    const succeeded = latestSucceededCurrentProjectImage2Attempt(state, task);
    if (succeeded) {
      return {
        taskId: task.taskId,
        shotId: task.shotId,
        expectedOutputPath: task.expectedOutputPath,
        status: "needs_review",
        providerReturned: true,
        outputPath: succeeded.outputPath,
        outputSha256: succeeded.outputSha256,
        attemptId: succeeded.attemptId,
        reasons: ["provider_return_requires_human_review"],
        promotionAllowed: false,
      };
    }

    const terminalMissing = currentProjectImage2TaskHasTerminalFailure(state, task);
    return {
      taskId: task.taskId,
      shotId: task.shotId,
      expectedOutputPath: task.expectedOutputPath,
      status: terminalMissing ? "missing" : "blocked",
      providerReturned: false,
      reasons: terminalMissing ? ["provider_return_missing"] : ["provider_return_not_settled"],
      promotionAllowed: false,
    };
  });
  const returnedCount = items.filter((item) => item.providerReturned).length;
  const missingCount = items.filter((item) => item.status === "missing").length;
  const blockedCount = items.filter((item) => item.status === "blocked").length;
  const needsReviewCount = items.filter((item) => item.status === "needs_review").length;
  const status =
    blockedCount > 0
      ? "blocked"
      : returnedCount > 0 && missingCount > 0
        ? "completed_with_missing"
        : returnedCount > 0
          ? "completed_needs_review"
          : missingCount > 0
            ? "missing"
            : "queued";

  return {
    schemaVersion: currentProjectImage2BatchPolicySchemaVersion,
    status,
    requestedCount: state.tasks.length,
    returnedCount,
    missingCount,
    needsReviewCount,
    blockedCount,
    maxConcurrency: policyProjection.imageGenerate.concurrency,
    retryConcurrency: policyProjection.imageGenerate.retryConcurrency,
    maxAutoRetries: policyProjection.imageGenerate.maxAutoRetries,
    promotionAllowed: false,
    missingCanPromote: false,
    lateReturnCanPromote: false,
    items,
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

function previewShotIdFor(item: CurrentProjectImage2BatchRuntimeProjectionItem): string {
  const outputPath = item.manifestSummary.expectedOutputs[0] || item.reportSummary.latestOutputPath || "";
  const outputParts = normalizePath(outputPath).split("/").filter(Boolean);
  const image2PrepIndex = outputParts.lastIndexOf("image2-prep");
  if (image2PrepIndex >= 0 && outputParts[image2PrepIndex + 1]) return outputParts[image2PrepIndex + 1];
  const match = item.taskRunId.match(/_([^_]+)_image2_start$/);
  return match?.[1] || item.taskRunId;
}

export function projectCurrentProjectImage2BatchPreviewItems(
  projection: CurrentProjectImage2BatchRuntimeProjection,
): CurrentProjectPreviewItemInput[] {
  return projection.items.map((item, index): CurrentProjectPreviewItemInput => {
    const previewItem = item.previewSummary.items[0];
    const canShowMedia = Boolean(
      previewItem?.path &&
      (
        (item.previewStatus === "ready" && previewItem.verified === true && item.completeVerified) ||
        (item.previewStatus === "needs_review" && previewItem.needsReview === true)
      ),
    );
    const blocked = item.previewStatus === "parked" ||
      item.previewStatus === "failed" ||
      item.previewStatus === "stalled" ||
      item.previewStatus === "interrupted";

    return {
      id: `current_project_image2_${item.taskRunId}`,
      shotId: previewShotIdFor(item),
      order: index + 1,
      mediaPath: canShowMedia ? previewItem?.path : undefined,
      expectedOutputPath: item.manifestSummary.expectedOutputs[0],
      status: item.completeVerified ? "complete_verified" : item.previewStatus,
      previewStatus: item.previewStatus,
      runtimeTruthStatus: item.status,
      previewQaStatus: item.previewStatus === "needs_review" ? "needs_review" : item.previewStatus === "ready" ? "verified" : item.previewStatus,
      productionQaStatus: item.completeVerified ? "pass" : item.previewStatus === "needs_review" ? "needs_review" : undefined,
      reviewRequired: item.previewStatus === "needs_review",
      reviewOverlay: item.previewStatus === "needs_review",
      outputExists: canShowMedia,
      blockers: canShowMedia ? [] : uniqueInOrder([
        ...item.manifestSummary.blockers,
        ...item.reportSummary.blockers,
        blocked ? item.previewStatus : "",
      ]),
    };
  });
}
