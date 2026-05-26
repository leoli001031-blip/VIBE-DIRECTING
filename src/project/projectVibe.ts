import {
  projectVibeFileName,
  projectVibeModelVersion,
  type ProjectVibeAsset,
  type ProjectVibeAssetKind,
  type ProjectVibeDocument,
  type ProjectVibeOpenResult,
  type ProjectVibePatchOperation,
  type ProjectVibeReviewReceipt,
  type ProjectVibeReviewStatus,
  type ProjectVibeReceiptLedger,
  type ProjectVibeRunReceipt,
  type ProjectVibeSaveResult,
  type ProjectVibeShot,
  type ProjectVibeSourceIndex,
  type ProjectVibeStorageAdapter,
  type ProjectVibeStoryFlow,
  type ProjectVibeTransaction,
  type ProjectVibeTransactionReceipt,
  type ProjectVibeValidationResult,
  type ProjectVibeVisualMemory,
} from "./types";

export interface CreateProjectVibeInput {
  projectId: string;
  title: string;
  version?: string;
  createdAt?: string;
  updatedAt?: string;
  storyFlow?: Pick<ProjectVibeStoryFlow, "id" | "sections" | "shotOrder">;
  visualMemory?: Pick<ProjectVibeVisualMemory, "id" | "entries">;
  shots?: ProjectVibeShot[];
  assets?: ProjectVibeAsset[];
  runs?: ProjectVibeRunReceipt[];
  receipts?: Partial<ProjectVibeReceiptLedger>;
}

export interface ProjectVibePatchResult {
  project: ProjectVibeDocument;
  receipt: ProjectVibeTransactionReceipt;
}

export type ProjectVibeReviewPromotionStatus = "staged" | "blocked";
export type ProjectVibeReviewPromotionTarget =
  | "review_receipt_only"
  | "asset"
  | "locked_visual_memory"
  | "asset_and_locked_visual_memory";

export interface ProjectVibeReviewOutputCandidate {
  shotId?: string;
  assetId?: string;
  assetKind?: ProjectVibeAssetKind;
  label?: string;
  outputPath?: string;
  outputHash?: string;
  sourceReceiptId?: string;
  sourceRunId?: string;
  providerSelfReportedSuccess?: boolean;
  returnedOutput?: boolean;
  missingOutput?: boolean;
  lateOutput?: boolean;
  evidenceRefs?: string[];
}

export interface ProjectVibeReviewDecision {
  status: ProjectVibeReviewStatus;
  humanReviewed: boolean;
  reviewerId?: string;
  reviewedAt: string;
  retryRequested?: boolean;
  promotionTarget?: ProjectVibeReviewPromotionTarget;
  promotionAuthorization?: {
    authorized: boolean;
    authorizedBy?: string;
    authorizedAt?: string;
  };
  assetKind?: ProjectVibeAssetKind;
  assetLabel?: string;
  textConstraints?: string[];
  usedByShotIds?: string[];
  rawFreeTextTask?: string;
}

export interface BuildProjectVibeReviewPromotionTransactionInput {
  project: ProjectVibeDocument;
  candidate: ProjectVibeReviewOutputCandidate;
  decision: ProjectVibeReviewDecision;
  transactionId?: string;
  receiptId?: string;
}

export interface ProjectVibeReviewPromotionTransactionResult {
  status: ProjectVibeReviewPromotionStatus;
  reviewReceipt: ProjectVibeReviewReceipt;
  transaction?: ProjectVibeTransaction;
  promotionOperationCount: number;
  blockers: string[];
  warnings: string[];
  providerSelfReportIgnored: true;
  freeTextFormalTaskBlocked: true;
}

const portablePathPattern = /^(?!\/|~\/|[A-Za-z]:[\\/]|\/\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^?#\n\r]+$/;

export function createProjectVibe(input: CreateProjectVibeInput): ProjectVibeDocument {
  const createdAt = input.createdAt || new Date().toISOString();
  const updatedAt = input.updatedAt || createdAt;
  const project: ProjectVibeDocument = {
    kind: "project_vibe_document",
    modelVersion: projectVibeModelVersion,
    manifest: {
      projectId: input.projectId,
      title: input.title,
      version: input.version || "0.1.0",
      createdAt,
      updatedAt,
      sourceOfTruth: "project_vibe",
      portableRoot: "project_root",
      runtimeFixtureAuthority: false,
    },
    storyFlow: {
      id: input.storyFlow?.id || "story_flow_current",
      updatedAt,
      sourceOfTruth: "project_vibe",
      sections: input.storyFlow?.sections || [],
      shotOrder: input.storyFlow?.shotOrder || [],
    },
    visualMemory: {
      id: input.visualMemory?.id || "visual_memory_current",
      updatedAt,
      sourceOfTruth: "project_vibe",
      referencePolicy: {
        temporaryOutputsMayBecomeAuthority: false,
        runtimeFixturesMayBecomeAuthority: false,
        lockedAssetsRequiredForGeneration: true,
      },
      entries: input.visualMemory?.entries || [],
    },
    shots: input.shots || [],
    assets: input.assets || [],
    runs: input.runs || [],
    receipts: normalizeReceiptLedger(input.receipts),
    sourceIndex: {
      id: "source_index_current",
      updatedAt,
      sourceOfTruth: "project_vibe",
      manifestRef: "project.vibe#manifest",
      storyFlowRef: "project.vibe#storyFlow",
      visualMemoryRef: "project.vibe#visualMemory",
      shotRefs: [],
      assetRefs: [],
      runReceiptRefs: [],
      // NOTE: only shotRefs, assetRefs, and runReceiptRefs are initialized here; the full receiptRefs mapping (scriptPlanning, promptKeyframe, batch, review) are built exclusively by buildSourceIndex() and not included in this initial placeholder
    },
  };

  return refreshProjectVibeSourceIndex(project, updatedAt);
}

export function parseProjectVibeText(serialized: string): ProjectVibeOpenResult {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch (error) {
    return {
      ok: false,
      errors: [`project.vibe must be valid JSON: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  if (!isProjectVibeDocumentShape(value)) {
    return {
      ok: false,
      errors: ["project.vibe does not match the minimal Project.vibe document shape."],
    };
  }

  const validation = validateProjectVibe(value);
  return {
    ok: validation.ok,
    project: value,
    validation,
    errors: validation.errors,
  };
}

export async function openProjectVibe(adapter: ProjectVibeStorageAdapter, path = projectVibeFileName): Promise<ProjectVibeOpenResult> {
  const serialized = await adapter.readFile(path);
  return parseProjectVibeText(serialized);
}

export async function saveProjectVibe(
  adapter: ProjectVibeStorageAdapter,
  project: ProjectVibeDocument,
  path = projectVibeFileName,
): Promise<ProjectVibeSaveResult> {
  const validation = validateProjectVibe(project);
  if (!validation.ok) {
    return { ok: false, path, factHash: hashProjectVibeFacts(project), validation, errors: validation.errors };
  }

  const directory = parentDirectory(path);
  if (directory && adapter.mkdir) await adapter.mkdir(directory);
  const serialized = serializeProjectVibe(project);
  if (adapter.writeFileAtomic) await adapter.writeFileAtomic(path, serialized);
  else await adapter.writeFile(path, serialized);
  return { ok: true, path, factHash: hashProjectVibeFacts(project), validation, errors: [] };
}

export function serializeProjectVibe(project: ProjectVibeDocument): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

export function applyProjectVibeTransaction(
  project: ProjectVibeDocument,
  transaction: ProjectVibeTransaction,
): ProjectVibePatchResult {
  const beforeFactHash = hashProjectVibeFacts(project);
  const next = cloneProject(project);
  const touched = {
    storyFlow: false,
    visualMemory: false,
    shotIds: [] as string[],
    assetIds: [] as string[],
    runIds: [] as string[],
    receiptIds: [] as string[],
  };

  for (const operation of transaction.operations) {
    applyOperation(next, operation, touched);
  }

  next.manifest.updatedAt = transaction.createdAt;
  refreshProjectVibeSourceIndex(next, transaction.createdAt);
  const validation = validateProjectVibe(next);
  const receipt: ProjectVibeTransactionReceipt = {
    transactionId: transaction.id,
    status: validation.ok ? "applied" : "rejected",
    actor: transaction.actor,
    reason: transaction.reason,
    createdAt: transaction.createdAt,
    operationCount: transaction.operations.length,
    beforeFactHash,
    afterFactHash: validation.ok ? hashProjectVibeFacts(next) : undefined,
    projectFactsAuthority: "project_vibe",
    runtimeFixtureUsed: false,
    touched: {
      storyFlow: touched.storyFlow,
      visualMemory: touched.visualMemory,
      shotIds: uniqueSorted(touched.shotIds),
      assetIds: uniqueSorted(touched.assetIds),
      runIds: uniqueSorted(touched.runIds),
      receiptIds: uniqueSorted(touched.receiptIds),
    },
    errors: validation.errors,
    warnings: validation.warnings,
  };

  return { project: validation.ok ? next : project, receipt };
}

export function patchProjectVibe(
  project: ProjectVibeDocument,
  operations: ProjectVibePatchOperation[],
  options?: Pick<ProjectVibeTransaction, "id" | "actor" | "reason" | "createdAt">,
): ProjectVibePatchResult {
  return applyProjectVibeTransaction(project, {
    id: options?.id || `txn_${Date.now()}`,
    actor: options?.actor || "agent_loop",
    reason: options?.reason || "Apply minimal Project.vibe patch.",
    createdAt: options?.createdAt || new Date().toISOString(),
    operations,
  });
}

function compactReviewTime(value: string): string {
  return value.replace(/\D/g, "").slice(0, 14) || `${Date.now()}`;
}

function reviewSafeId(value: string | undefined, fallback: string): string {
  const raw = (value || fallback).trim();
  const safe = raw.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  if (safe) return safe;
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${fallback}_${(hash >>> 0).toString(36)}`;
}

function reviewUnique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

function normalizedProjectPath(path: string | undefined): string | undefined {
  const normalized = path?.trim().replace(/\\/g, "/").replace(/^\.?\//, "");
  return normalized || undefined;
}

function reviewTargetNeedsPromotion(target: ProjectVibeReviewPromotionTarget): boolean {
  return target === "asset" || target === "locked_visual_memory" || target === "asset_and_locked_visual_memory";
}

function projectVibeReviewDecisionBlockers(input: BuildProjectVibeReviewPromotionTransactionInput): string[] {
  const { candidate, decision } = input;
  const target = decision.promotionTarget || "review_receipt_only";
  const promotionRequested = decision.status === "approved" && reviewTargetNeedsPromotion(target);
  const outputPath = normalizedProjectPath(candidate.outputPath);
  const authorization = decision.promotionAuthorization;
  const reviewFinal = decision.status === "approved" || decision.status === "rejected" || decision.status === "retry_requested";
  return reviewUnique([
    reviewFinal && !decision.humanReviewed ? "human_review_required" : undefined,
    reviewFinal && !decision.reviewerId ? "reviewer_id_required" : undefined,
    decision.status === "retry_requested" && !candidate.shotId ? "retry_shot_id_required" : undefined,
    decision.status === "retry_requested" && decision.retryRequested !== true ? "retry_requested_flag_required" : undefined,
    decision.rawFreeTextTask?.trim() ? "free_text_formal_task_forbidden" : undefined,
    decision.status !== "approved" && authorization?.authorized ? "promotion_authorization_requires_approved_review" : undefined,
    decision.status !== "approved" && reviewTargetNeedsPromotion(target) ? "review_status_must_be_approved_for_promotion" : undefined,
    promotionRequested && !candidate.sourceReceiptId ? "source_receipt_required" : undefined,
    promotionRequested && (!outputPath || !isPortableProjectPath(outputPath)) ? "project_relative_output_path_required" : undefined,
    promotionRequested && !candidate.outputHash ? "output_hash_required" : undefined,
    promotionRequested && candidate.missingOutput ? "missing_output_cannot_promote" : undefined,
    promotionRequested && candidate.lateOutput ? "late_output_cannot_promote_directly" : undefined,
    promotionRequested && authorization?.authorized !== true ? "explicit_promotion_authorization_required" : undefined,
    promotionRequested && !authorization?.authorizedBy ? "promotion_authorized_by_required" : undefined,
    promotionRequested && !authorization?.authorizedAt ? "promotion_authorized_at_required" : undefined,
    outputPath && !isPortableProjectPath(outputPath) ? "project_relative_output_path_required" : undefined,
  ]);
}

function projectVibeVisualMemoryWithLockedReviewEntry(input: {
  project: ProjectVibeDocument;
  assetId: string;
  assetKind: ProjectVibeAssetKind;
  label: string;
  textConstraints: string[];
  usedByShotIds: string[];
  reviewReceiptId: string;
  sourceRefs: string[];
  createdAt: string;
}): ProjectVibeVisualMemory {
  const existing = input.project.visualMemory.entries.filter((entry) => entry.assetId !== input.assetId);
  return {
    ...input.project.visualMemory,
    updatedAt: input.createdAt,
    entries: [
      ...existing,
      {
        id: `vm_${reviewSafeId(input.assetId, "approved_asset")}`,
        assetId: input.assetId,
        kind: input.assetKind,
        label: input.label,
        status: "locked",
        textConstraints: input.textConstraints,
        usedByShotIds: input.usedByShotIds,
        canUseAsFutureReference: true,
        sourceRefs: reviewUnique([
          ...input.sourceRefs,
          `project.vibe#receipts/reviews/${input.reviewReceiptId}`,
          `project.vibe#assets/${input.assetId}`,
        ]),
      },
    ],
  };
}

export function buildProjectVibeReviewPromotionTransaction(
  input: BuildProjectVibeReviewPromotionTransactionInput,
): ProjectVibeReviewPromotionTransactionResult {
  const { project, candidate, decision } = input;
  const reviewedAt = decision.reviewedAt || new Date().toISOString();
  const outputPath = normalizedProjectPath(candidate.outputPath);
  const receiptId = input.receiptId || `review_${reviewSafeId(candidate.shotId || candidate.assetId, "output")}_${compactReviewTime(reviewedAt)}`;
  const target = decision.promotionTarget || "review_receipt_only";
  const promotionRequested = decision.status === "approved" && reviewTargetNeedsPromotion(target);
  const blockers = projectVibeReviewDecisionBlockers(input);
  const authorization = decision.promotionAuthorization;
  const reviewReceipt: ProjectVibeReviewReceipt = {
    id: receiptId,
    createdAt: reviewedAt,
    status: decision.status,
    reviewerId: decision.reviewerId,
    humanReviewed: decision.humanReviewed,
    shotId: candidate.shotId,
    assetId: candidate.assetId,
    sourceReceiptId: candidate.sourceReceiptId,
    sourceRunId: candidate.sourceRunId,
    outputPath,
    outputHash: candidate.outputHash,
    retryRequested: decision.status === "retry_requested" || decision.retryRequested === true,
    lateOutput: candidate.lateOutput === true,
    providerSelfReportIgnored: true,
    promotionAuthorized: authorization?.authorized === true,
    promotionAuthorizedBy: authorization?.authorizedBy,
    promotionAuthorizedAt: authorization?.authorizedAt,
    evidenceRefs: reviewUnique([
      ...(candidate.evidenceRefs || []),
      candidate.sourceReceiptId ? `receipt#${candidate.sourceReceiptId}` : undefined,
      candidate.sourceRunId ? `run#${candidate.sourceRunId}` : undefined,
      outputPath ? `project_output#${outputPath}` : undefined,
      candidate.outputHash ? `output_hash#${candidate.outputHash}` : undefined,
      candidate.missingOutput ? "review_decision#missing_output" : undefined,
      candidate.lateOutput ? "review_decision#late_output" : undefined,
    ]),
    blockers,
  };
  const reviewOperation: ProjectVibePatchOperation = { op: "append_review_receipt", receipt: reviewReceipt };

  if (blockers.length) {
    return {
      status: "blocked",
      reviewReceipt,
      promotionOperationCount: 0,
      blockers,
      warnings: candidate.providerSelfReportedSuccess ? ["Provider self-report was ignored for promotion."] : [],
      providerSelfReportIgnored: true,
      freeTextFormalTaskBlocked: true,
    };
  }

  const operations: ProjectVibePatchOperation[] = [reviewOperation];
  if (promotionRequested) {
    const assetId = candidate.assetId || `asset_${reviewSafeId(candidate.shotId, "approved_output")}`;
    const assetKind = decision.assetKind || candidate.assetKind || "reference";
    const label = decision.assetLabel || candidate.label || `Approved ${reviewSafeId(candidate.shotId || assetId, "output")}`;
    const usedByShotIds = reviewUnique([...(decision.usedByShotIds || []), candidate.shotId]);
    const textConstraints = reviewUnique(decision.textConstraints || []);
    const sourceRefs = reviewUnique([
      `project.vibe#receipts/reviews/${reviewReceipt.id}`,
      candidate.sourceReceiptId ? `receipt#${candidate.sourceReceiptId}` : undefined,
      candidate.outputHash ? `output_hash#${candidate.outputHash}` : undefined,
    ]);

    if (target === "asset" || target === "asset_and_locked_visual_memory") {
      operations.push({
        op: "upsert_asset",
        asset: {
          id: assetId,
          kind: assetKind,
          label,
          status: "locked",
          path: outputPath,
          textConstraints,
          usedByShotIds,
          sourceRefs,
          lockedBy: "user",
        },
      });
    }

    if (target === "locked_visual_memory" || target === "asset_and_locked_visual_memory") {
      operations.push({
        op: "set_visual_memory",
        visualMemory: projectVibeVisualMemoryWithLockedReviewEntry({
          project,
          assetId,
          assetKind,
          label,
          textConstraints,
          usedByShotIds,
          reviewReceiptId: reviewReceipt.id,
          sourceRefs,
          createdAt: reviewedAt,
        }),
      });
    }
  }

  return {
    status: "staged",
    reviewReceipt,
    transaction: {
      id: input.transactionId || `txn_${receiptId}`,
      actor: "user",
      reason: promotionRequested
        ? "Stage approved reviewed output for Project.vibe promotion."
        : "Record reviewed provider output decision.",
      createdAt: reviewedAt,
      operations,
    },
    promotionOperationCount: operations.length - 1,
    blockers: [],
    warnings: candidate.providerSelfReportedSuccess ? ["Provider self-report was ignored for promotion."] : [],
    providerSelfReportIgnored: true,
    freeTextFormalTaskBlocked: true,
  };
}

export function validateProjectVibe(project: ProjectVibeDocument): ProjectVibeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checkedAt = new Date().toISOString();

  if (project.kind !== "project_vibe_document") errors.push("project.kind must be project_vibe_document.");
  if (project.modelVersion !== projectVibeModelVersion) errors.push(`project.modelVersion must be ${projectVibeModelVersion}.`);
  if (project.manifest.sourceOfTruth !== "project_vibe") errors.push("manifest.sourceOfTruth must be project_vibe.");
  if (project.manifest.runtimeFixtureAuthority !== false) errors.push("manifest.runtimeFixtureAuthority must be false.");
  if (project.manifest.portableRoot !== "project_root") errors.push("manifest.portableRoot must be project_root.");
  if (project.storyFlow.sourceOfTruth !== "project_vibe") errors.push("storyFlow.sourceOfTruth must be project_vibe.");
  if (project.visualMemory.sourceOfTruth !== "project_vibe") errors.push("visualMemory.sourceOfTruth must be project_vibe.");
  if (project.visualMemory.referencePolicy.temporaryOutputsMayBecomeAuthority !== false) {
    errors.push("visualMemory.referencePolicy.temporaryOutputsMayBecomeAuthority must stay false.");
  }
  if (project.visualMemory.referencePolicy.runtimeFixturesMayBecomeAuthority !== false) {
    errors.push("visualMemory.referencePolicy.runtimeFixturesMayBecomeAuthority must stay false.");
  }

  const shotIds = new Set(project.shots.map((shot) => shot.id));
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  assertUnique(project.shots.map((shot) => shot.id), "shot.id", errors);
  assertUnique(project.assets.map((asset) => asset.id), "asset.id", errors);
  assertUnique(project.runs.map((run) => run.id), "run.id", errors);
  assertUnique(project.visualMemory.entries.map((entry) => entry.id), "visualMemory.entries.id", errors);
  const receipts = receiptLedger(project);
  assertUnique(receipts.scriptPlanningReceipts.map((receipt) => receipt.id), "receipts.scriptPlanningReceipts.id", errors);
  assertUnique(receipts.promptKeyframePlanningReceipts.map((receipt) => receipt.id), "receipts.promptKeyframePlanningReceipts.id", errors);
  assertUnique(receipts.batchReceipts.map((receipt) => receipt.id), "receipts.batchReceipts.id", errors);
  assertUnique(receipts.reviewReceipts.map((receipt) => receipt.id), "receipts.reviewReceipts.id", errors);
  const reviewReceiptByRef = new Map(receipts.reviewReceipts.map((receipt) => [`project.vibe#receipts/reviews/${receipt.id}`, receipt]));

  for (const shotId of project.storyFlow.shotOrder) {
    if (!shotIds.has(shotId)) errors.push(`storyFlow.shotOrder references missing shot ${shotId}.`);
  }
  for (const section of project.storyFlow.sections) {
    if (section.sequenceIndex < 0 || !Number.isInteger(section.sequenceIndex)) {
      errors.push(`storyFlow.sections.${section.id}.sequenceIndex must be a non-negative integer.`);
    }
    for (const shotId of section.shotIds) {
      if (!shotIds.has(shotId)) errors.push(`storyFlow.sections.${section.id} references missing shot ${shotId}.`);
    }
  }

  for (const shot of project.shots) {
    if (shot.durationSeconds <= 0) errors.push(`shot ${shot.id} durationSeconds must be positive.`);
    if (!project.storyFlow.sections.some((section) => section.id === shot.sectionId)) {
      errors.push(`shot ${shot.id} references missing section ${shot.sectionId}.`);
    }
    for (const assetId of [...shot.sceneAssetIds, ...shot.characterAssetIds, ...shot.propAssetIds]) {
      if (!assetIds.has(assetId)) errors.push(`shot ${shot.id} references missing asset ${assetId}.`);
    }
  }

  for (const asset of project.assets) {
    if (asset.path && !isPortableProjectPath(asset.path)) {
      errors.push(`asset ${asset.id} path must be project-root-relative and portable.`);
    }
    for (const shotId of asset.usedByShotIds) {
      if (!shotIds.has(shotId)) warnings.push(`asset ${asset.id} lists unknown usedByShotId ${shotId}.`);
    }
  }

  for (const entry of project.visualMemory.entries) {
    if (!assetIds.has(entry.assetId)) errors.push(`visualMemory entry ${entry.id} references missing asset ${entry.assetId}.`);
    for (const shotId of entry.usedByShotIds) {
      if (!shotIds.has(shotId)) warnings.push(`visualMemory entry ${entry.id} lists unknown usedByShotId ${shotId}.`);
    }
    if (entry.status !== "locked" && entry.canUseAsFutureReference) {
      errors.push(`visualMemory entry ${entry.id} cannot be future reference unless locked.`);
    }
    for (const sourceRef of entry.sourceRefs) {
      const reviewReceipt = reviewReceiptByRef.get(sourceRef);
      if (!reviewReceipt) continue;
      if (entry.canUseAsFutureReference && reviewReceipt.status !== "approved") {
        errors.push(`visualMemory entry ${entry.id} cannot use non-approved review receipt ${reviewReceipt.id} as future reference.`);
      }
      if (entry.canUseAsFutureReference && reviewReceipt.lateOutput) {
        errors.push(`visualMemory entry ${entry.id} cannot lock late review receipt ${reviewReceipt.id} directly.`);
      }
      if (entry.canUseAsFutureReference && reviewReceipt.retryRequested) {
        errors.push(`visualMemory entry ${entry.id} cannot lock retry-requested review receipt ${reviewReceipt.id}.`);
      }
      if (entry.canUseAsFutureReference && !reviewReceipt.outputHash) {
        errors.push(`visualMemory entry ${entry.id} requires hash-bound approved review receipt ${reviewReceipt.id}.`);
      }
    }
  }

  for (const run of project.runs) {
    if (run.runtimeFixtureUsed !== false) errors.push(`run ${run.id} runtimeFixtureUsed must be false.`);
    if (!run.sourceFactHash) errors.push(`run ${run.id} must carry sourceFactHash.`);
    for (const shotId of run.affectedShotIds) {
      if (!shotIds.has(shotId)) warnings.push(`run ${run.id} lists unknown affectedShotId ${shotId}.`);
    }
    for (const assetId of run.producedAssetIds) {
      if (!assetIds.has(assetId)) warnings.push(`run ${run.id} lists unknown producedAssetId ${assetId}.`);
    }
  }

  for (const receipt of receipts.scriptPlanningReceipts) {
    if (receipt.kind !== "script_planning") errors.push(`script planning receipt ${receipt.id} kind must be script_planning.`);
    if (!receipt.sourceFactHash) errors.push(`script planning receipt ${receipt.id} must carry sourceFactHash.`);
    if (receipt.providerSelfReportUsed !== false) errors.push(`script planning receipt ${receipt.id} providerSelfReportUsed must be false.`);
    if (receipt.runtimeFixtureUsed !== false) errors.push(`script planning receipt ${receipt.id} runtimeFixtureUsed must be false.`);
    for (const shotId of receipt.shotIds) {
      if (!shotIds.has(shotId)) warnings.push(`script planning receipt ${receipt.id} lists unknown shotId ${shotId}.`);
    }
  }

  for (const receipt of receipts.promptKeyframePlanningReceipts) {
    if (receipt.kind !== "prompt_keyframe_planning") {
      errors.push(`prompt/keyframe planning receipt ${receipt.id} kind must be prompt_keyframe_planning.`);
    }
    if (!receipt.sourceFactHash) errors.push(`prompt/keyframe planning receipt ${receipt.id} must carry sourceFactHash.`);
    if (!receipt.inputHash) errors.push(`prompt/keyframe planning receipt ${receipt.id} must carry inputHash.`);
    if (!receipt.outputPlanHash) errors.push(`prompt/keyframe planning receipt ${receipt.id} must carry outputPlanHash.`);
    if (receipt.rawProviderPromptStoredAsFact !== false) {
      errors.push(`prompt/keyframe planning receipt ${receipt.id} rawProviderPromptStoredAsFact must be false.`);
    }
    if (receipt.providerSelfReportUsed !== false) errors.push(`prompt/keyframe planning receipt ${receipt.id} providerSelfReportUsed must be false.`);
    if (receipt.runtimeFixtureUsed !== false) errors.push(`prompt/keyframe planning receipt ${receipt.id} runtimeFixtureUsed must be false.`);
    for (const shotId of receipt.affectedShotIds) {
      if (!shotIds.has(shotId)) warnings.push(`prompt/keyframe planning receipt ${receipt.id} lists unknown affectedShotId ${shotId}.`);
    }
  }

  for (const receipt of receipts.batchReceipts) {
    if (!receipt.sourceFactHash) errors.push(`batch receipt ${receipt.id} must carry sourceFactHash.`);
    if (receipt.providerSelfReportCanPromote !== false) errors.push(`batch receipt ${receipt.id} providerSelfReportCanPromote must be false.`);
    if (receipt.projectFactsMutated !== false) errors.push(`batch receipt ${receipt.id} projectFactsMutated must be false.`);
    if (receipt.runtimeFixtureUsed !== false) errors.push(`batch receipt ${receipt.id} runtimeFixtureUsed must be false.`);
    for (const shotId of receipt.affectedShotIds) {
      if (!shotIds.has(shotId)) warnings.push(`batch receipt ${receipt.id} lists unknown affectedShotId ${shotId}.`);
    }
  }

  for (const receipt of receipts.reviewReceipts) {
    if (receipt.providerSelfReportIgnored !== true) errors.push(`review receipt ${receipt.id} providerSelfReportIgnored must be true.`);
    if (receipt.status === "approved") {
      if (!receipt.humanReviewed) errors.push(`approved review receipt ${receipt.id} must be humanReviewed.`);
      if (!receipt.reviewerId) errors.push(`approved review receipt ${receipt.id} must carry reviewerId.`);
      if (!receipt.sourceReceiptId) errors.push(`approved review receipt ${receipt.id} must carry sourceReceiptId.`);
      if (!receipt.outputPath || !isPortableProjectPath(receipt.outputPath)) {
        errors.push(`approved review receipt ${receipt.id} outputPath must be project-root-relative and portable.`);
      }
      if (!receipt.outputHash) errors.push(`approved review receipt ${receipt.id} must carry outputHash.`);
    }
    if (receipt.status === "rejected") {
      if (!receipt.humanReviewed) errors.push(`rejected review receipt ${receipt.id} must be humanReviewed.`);
      if (!receipt.reviewerId) errors.push(`rejected review receipt ${receipt.id} must carry reviewerId.`);
      if (receipt.retryRequested) errors.push(`rejected review receipt ${receipt.id} cannot also request retry.`);
    }
    if (receipt.status === "retry_requested") {
      if (!receipt.humanReviewed) errors.push(`retry review receipt ${receipt.id} must be humanReviewed.`);
      if (!receipt.reviewerId) errors.push(`retry review receipt ${receipt.id} must carry reviewerId.`);
      if (!receipt.shotId) errors.push(`retry review receipt ${receipt.id} must carry shotId.`);
      if (!receipt.retryRequested) errors.push(`retry review receipt ${receipt.id} must set retryRequested.`);
    }
    if (receipt.status !== "approved" && receipt.promotionAuthorized) {
      errors.push(`review receipt ${receipt.id} cannot authorize promotion unless approved.`);
    }
    if (receipt.lateOutput && receipt.promotionAuthorized) {
      errors.push(`review receipt ${receipt.id} cannot authorize direct promotion for late output.`);
    }
    if (receipt.outputPath && !isPortableProjectPath(receipt.outputPath)) {
      errors.push(`review receipt ${receipt.id} outputPath must be project-root-relative and portable.`);
    }
    if (receipt.shotId && !shotIds.has(receipt.shotId)) warnings.push(`review receipt ${receipt.id} lists unknown shotId ${receipt.shotId}.`);
  }

  if (project.sourceIndex.sourceOfTruth !== "project_vibe") errors.push("sourceIndex.sourceOfTruth must be project_vibe.");
  const expectedSourceIndex = buildSourceIndex(project, project.sourceIndex.updatedAt);
  if (!arraysEqual(project.sourceIndex.shotRefs, expectedSourceIndex.shotRefs)) errors.push("sourceIndex.shotRefs drifted from project shots.");
  if (!arraysEqual(project.sourceIndex.assetRefs, expectedSourceIndex.assetRefs)) errors.push("sourceIndex.assetRefs drifted from project assets.");
  if (!arraysEqual(project.sourceIndex.runReceiptRefs, expectedSourceIndex.runReceiptRefs)) {
    errors.push("sourceIndex.runReceiptRefs drifted from project runs.");
  }
  if (!arraysEqual(project.sourceIndex.scriptPlanningReceiptRefs || [], expectedSourceIndex.scriptPlanningReceiptRefs || [])) {
    errors.push("sourceIndex.scriptPlanningReceiptRefs drifted from Project.vibe receipts.");
  }
  if (!arraysEqual(project.sourceIndex.promptKeyframePlanningReceiptRefs || [], expectedSourceIndex.promptKeyframePlanningReceiptRefs || [])) {
    errors.push("sourceIndex.promptKeyframePlanningReceiptRefs drifted from Project.vibe receipts.");
  }
  if (!arraysEqual(project.sourceIndex.batchReceiptRefs || [], expectedSourceIndex.batchReceiptRefs || [])) {
    errors.push("sourceIndex.batchReceiptRefs drifted from Project.vibe receipts.");
  }
  if (!arraysEqual(project.sourceIndex.reviewReceiptRefs || [], expectedSourceIndex.reviewReceiptRefs || [])) {
    errors.push("sourceIndex.reviewReceiptRefs drifted from Project.vibe receipts.");
  }

  return { ok: errors.length === 0, errors, warnings, checkedAt };
}

export function hashProjectVibeFacts(project: ProjectVibeDocument): string {
  return stableHash({
    modelVersion: project.modelVersion,
    manifest: project.manifest,
    storyFlow: project.storyFlow,
    visualMemory: project.visualMemory,
    shots: project.shots,
    assets: project.assets,
    receipts: receiptLedger(project),
    sourceIndex: project.sourceIndex,
  });
}

export function refreshProjectVibeSourceIndex(project: ProjectVibeDocument, updatedAt = new Date().toISOString()): ProjectVibeDocument {
  project.sourceIndex = buildSourceIndex(project, updatedAt);
  return project;
}

export function isPortableProjectPath(path: string): boolean {
  return portablePathPattern.test(path.trim().replace(/\\/g, "/"));
}

function applyOperation(
  project: ProjectVibeDocument,
  operation: ProjectVibePatchOperation,
  touched: ProjectVibeTransactionReceipt["touched"],
): void {
  if (operation.op === "set_story_flow") {
    project.storyFlow = operation.storyFlow;
    touched.storyFlow = true;
    return;
  }
  if (operation.op === "set_visual_memory") {
    project.visualMemory = operation.visualMemory;
    touched.visualMemory = true;
    return;
  }
  if (operation.op === "upsert_shot") {
    project.shots = upsertById(project.shots, operation.shot);
    touched.shotIds.push(operation.shot.id);
    return;
  }
  if (operation.op === "upsert_asset") {
    project.assets = upsertById(project.assets, operation.asset);
    touched.assetIds.push(operation.asset.id);
    return;
  }
  if (operation.op === "append_run_receipt") {
    project.runs = upsertById(project.runs, operation.run);
    touched.runIds.push(operation.run.id);
    return;
  }

  const receipts = ensureReceiptLedger(project);
  if (operation.op === "append_script_planning_receipt") {
    receipts.scriptPlanningReceipts = upsertById(receipts.scriptPlanningReceipts, operation.receipt);
    touched.receiptIds?.push(operation.receipt.id);
    return;
  }
  if (operation.op === "append_prompt_keyframe_planning_receipt") {
    receipts.promptKeyframePlanningReceipts = upsertById(receipts.promptKeyframePlanningReceipts, operation.receipt);
    touched.receiptIds?.push(operation.receipt.id);
    return;
  }
  if (operation.op === "append_batch_receipt") {
    receipts.batchReceipts = upsertById(receipts.batchReceipts, operation.receipt);
    touched.receiptIds?.push(operation.receipt.id);
    return;
  }
  receipts.reviewReceipts = upsertById(receipts.reviewReceipts, operation.receipt);
  touched.receiptIds?.push(operation.receipt.id);
}

function buildSourceIndex(project: ProjectVibeDocument, updatedAt: string): ProjectVibeSourceIndex {
  const receipts = receiptLedger(project);
  return {
    id: project.sourceIndex?.id || "source_index_current",
    updatedAt,
    sourceOfTruth: "project_vibe",
    manifestRef: "project.vibe#manifest",
    storyFlowRef: "project.vibe#storyFlow",
    visualMemoryRef: "project.vibe#visualMemory",
    shotRefs: project.shots.map((shot) => `project.vibe#shots/${shot.id}`).sort(),
    assetRefs: project.assets.map((asset) => `project.vibe#assets/${asset.id}`).sort(),
    runReceiptRefs: project.runs.map((run) => `project.vibe#runs/${run.id}`).sort(),
    scriptPlanningReceiptRefs: receipts.scriptPlanningReceipts.map((receipt) => `project.vibe#receipts/scriptPlanning/${receipt.id}`).sort(),
    promptKeyframePlanningReceiptRefs: receipts.promptKeyframePlanningReceipts.map((receipt) => `project.vibe#receipts/promptKeyframePlanning/${receipt.id}`).sort(),
    batchReceiptRefs: receipts.batchReceipts.map((receipt) => `project.vibe#receipts/batches/${receipt.id}`).sort(),
    reviewReceiptRefs: receipts.reviewReceipts.map((receipt) => `project.vibe#receipts/reviews/${receipt.id}`).sort(),
  };
}

function isProjectVibeDocumentShape(value: unknown): value is ProjectVibeDocument {
  if (!isRecord(value)) return false;
  if (!isRecord(value.manifest)) return false;
  if (!isRecord(value.storyFlow) || !Array.isArray(value.storyFlow.sections) || !Array.isArray(value.storyFlow.shotOrder)) {
    return false;
  }
  if (!isRecord(value.visualMemory) || !isRecord(value.visualMemory.referencePolicy) || !Array.isArray(value.visualMemory.entries)) {
    return false;
  }
  if (!isRecord(value.sourceIndex)) return false;
  return (
    value.kind === "project_vibe_document" &&
    value.modelVersion === projectVibeModelVersion &&
    Array.isArray(value.shots) &&
    Array.isArray(value.assets) &&
    Array.isArray(value.runs) &&
    (value.receipts === undefined || isReceiptLedgerShape(value.receipts)) &&
    Array.isArray(value.sourceIndex.shotRefs) &&
    Array.isArray(value.sourceIndex.assetRefs) &&
    Array.isArray(value.sourceIndex.runReceiptRefs)
  );
}

function isReceiptLedgerShape(value: unknown): value is ProjectVibeReceiptLedger {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.scriptPlanningReceipts) &&
    Array.isArray(value.promptKeyframePlanningReceipts) &&
    Array.isArray(value.batchReceipts) &&
    Array.isArray(value.reviewReceipts)
  );
}

function normalizeReceiptLedger(input?: Partial<ProjectVibeReceiptLedger>): ProjectVibeReceiptLedger {
  return {
    scriptPlanningReceipts: input?.scriptPlanningReceipts || [],
    promptKeyframePlanningReceipts: input?.promptKeyframePlanningReceipts || [],
    batchReceipts: input?.batchReceipts || [],
    reviewReceipts: input?.reviewReceipts || [],
  };
}

function receiptLedger(project: ProjectVibeDocument): ProjectVibeReceiptLedger {
  return normalizeReceiptLedger(project.receipts);
}

function ensureReceiptLedger(project: ProjectVibeDocument): ProjectVibeReceiptLedger {
  project.receipts = receiptLedger(project);
  return project.receipts;
}

function cloneProject(project: ProjectVibeDocument): ProjectVibeDocument {
  return JSON.parse(JSON.stringify(project)) as ProjectVibeDocument;
}

function upsertById<T extends { id: string }>(items: T[], nextItem: T): T[] {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) return [...items, nextItem];
  const next = [...items];
  next[index] = nextItem;
  return next;
}

function assertUnique(values: string[], label: string, errors: string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) errors.push(`${label} must be unique: ${value}.`);
    seen.add(value);
  }
}

function parentDirectory(path: string): string | undefined {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : undefined;
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
  return `pv_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
