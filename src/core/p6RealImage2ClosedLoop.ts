import {
  IMAGE2_GENERATE_MAX_AUTO_RETRIES,
  IMAGE2_GENERATE_MAX_CONCURRENCY,
  IMAGE2_GENERATE_RETRY_CONCURRENCY,
} from "./providerPolicy";

export const p6RealImage2ClosedLoopSchemaVersion = "0.1.0";

export type P6RealImage2PlanStatus = "blocked" | "ready_for_live_submit";
export type P6RealImage2ReturnedStatus = "verified" | "needs_review" | "missing";
export type P6RealImage2SemanticQaStatus = P6RealImage2ReturnedStatus | "success";

export interface P6RealImage2PermissionReceiptLike {
  receiptId?: string;
  status?: string;
  providerCalled?: boolean;
  runtimeExternalNetworkCallMade?: boolean;
  projectVibeWritten?: boolean;
  selectedShotIds?: string[];
  submitIntent?: {
    maxProviderCallsPerReceipt?: number;
    providerSubmitAllowed?: number;
  };
}

export interface P6RealImage2ProviderObservationEvidence {
  receiptId?: string;
  receiptPath?: string;
  runId?: string;
  shotId?: string;
  submitPermissionReceiptId?: string;
  selectedShotIds?: string[];
  outputPath?: string;
  outputSha256?: string;
  providerObservationMode?: string;
}

export interface P6RealImage2SemanticQaEvidence {
  receiptId?: string;
  receiptPath?: string;
  runId?: string;
  shotId?: string;
  submitPermissionReceiptId?: string;
  selectedShotIds?: string[];
  outputPath?: string;
  outputSha256?: string;
  reviewedOutputSha256?: string;
  status?: P6RealImage2SemanticQaStatus;
  semanticQaStatus?: P6RealImage2SemanticQaStatus;
  qaStatus?: P6RealImage2SemanticQaStatus;
}

export interface P6RealImage2ActionTimeConfirmation {
  confirmed: boolean;
  phrase: string;
  confirmedAt?: string;
}

export interface BuildP6RealImage2PlanInput {
  generatedAt: string;
  runId: string;
  shotIds: string[];
  prompt: string;
  imageCount: number;
  providerId: string;
  providerBaseUrl: string;
  credentialRef: string;
  outputRoot: string;
  expectedOutputs?: Array<{
    shotId: string;
    expectedOutputPath: string;
    providerObservationPath: string;
    semanticQaPath: string;
  }>;
  referenceInputs?: Array<{
    id?: string;
    type?: string;
    name?: string;
    path: string;
  }>;
  submitPermissionReceipt?: P6RealImage2PermissionReceiptLike;
  actionTimeConfirmation?: P6RealImage2ActionTimeConfirmation;
}

export interface P6RealImage2Plan {
  schemaVersion: string;
  generatedAt: string;
  phase: "p6_real_image2_small_batch_closed_loop";
  status: P6RealImage2PlanStatus;
  runId: string;
  shotIds: string[];
  prompt: string;
  imageCount: number;
  provider: {
    providerId: string;
    baseUrl: string;
    credentialRef: string;
    rawCredentialMaterialPresent: false;
  };
  outputRoot: string;
  expectedOutputs: Array<{
    shotId: string;
    expectedOutputPath: string;
    providerObservationPath: string;
    semanticQaPath: string;
  }>;
  referenceInputs: Array<{
    id?: string;
    type?: string;
    name?: string;
    path: string;
  }>;
  submitPermissionReceipt?: {
    receiptId?: string;
    status?: string;
    maxProviderCallsPerReceipt?: number;
    providerSubmitAllowed?: number;
  };
  actionTimeConfirmation: {
    required: true;
    confirmed: boolean;
    phrase: string;
    expectedPhrase: string;
  };
  blockers: string[];
  hardLocks: {
    explicitPermissionReceiptRequired: true;
    actionTimeConfirmationRequired: true;
    maxImagesPerBatch: 3;
    maxProviderCallsPerReceipt: 1;
    maxConcurrency: typeof IMAGE2_GENERATE_MAX_CONCURRENCY;
    retryConcurrency: typeof IMAGE2_GENERATE_RETRY_CONCURRENCY;
    maxAutoRetries: typeof IMAGE2_GENERATE_MAX_AUTO_RETRIES;
    providerSelfReportCanComplete: false;
    providerSubmitFastVerifyAllowed: false;
    runtimeStateIsDerivedCacheOnly: true;
    humanQaForPromotionRequired: true;
    explicitPromotionAuthorizationRequired: true;
    providerSelfReportCanPromote: false;
    runtimeStateCanPromote: false;
    projectFactsPromotionAllowed: false;
    freeTextToFormalTaskAllowed: false;
  };
  notes: string[];
}

export interface P6RealImage2ReturnEvidenceInput {
  generatedAt: string;
  plan: P6RealImage2Plan;
  returnedOutputs: Array<{
    shotId: string;
    outputPath?: string;
    sha256?: string;
    providerObservationPresent?: boolean;
    semanticQaStatus?: P6RealImage2SemanticQaStatus;
    providerObservation?: P6RealImage2ProviderObservationEvidence;
    semanticQa?: P6RealImage2SemanticQaEvidence;
    providerSelfReportedSuccess?: boolean;
  }>;
  humanQaApproval?: {
    approved?: boolean;
    reviewerId?: string;
    reviewedAt?: string;
    verifiedShotIds?: string[];
    reviewedSha256ByShotId?: Record<string, string>;
  };
  promotionAuthorization?: {
    authorized?: boolean;
    authorizedBy?: string;
    authorizedAt?: string;
    runId?: string;
    shotIds?: string[];
    scope?: "p6_real_image2_small_batch";
  };
}

export interface P6RealImage2ReturnIngest {
  schemaVersion: string;
  generatedAt: string;
  phase: "p6_real_image2_return_ingest";
  status: "blocked" | "return_ingested";
  runId: string;
  providerSelfReportIgnoredForCompletion: true;
  summary: {
    total: number;
    verified: number;
    needsReview: number;
    missing: number;
    previewEligible: number;
    promotionAllowed: boolean;
  };
  shotStatuses: Array<{
    shotId: string;
    status: P6RealImage2ReturnedStatus;
    outputPath: string;
    sha256?: string;
    providerObservationPresent: boolean;
    providerSelfReportedSuccess: boolean;
  }>;
  promotionGate: {
    promotionAllowed: boolean;
    defaultPromotionAllowed: false;
    requiresAllVerified: true;
    requiresExplicitHumanQaApproval: true;
    requiresExplicitPromotionAuthorization: true;
    providerSelfReportCanPromote: false;
    runtimeStateCanPromote: false;
    humanQaApproved: boolean;
    promotionAuthorized: boolean;
    blockers: string[];
  };
  previewItems: Array<{
    shotId: string;
    outputPath: string;
    sha256?: string;
    status: "verified" | "needs_review";
  }>;
  exportReport: {
    receipts: {
      submitPermissionReceiptId?: string;
      submitPermissionReceiptStatus?: string;
      providerObservationReceipts: Array<{
        shotId: string;
        path: string;
        present: boolean;
      }>;
      semanticQaReceipts: Array<{
        shotId: string;
        path: string;
        status: P6RealImage2ReturnedStatus;
      }>;
      humanQaReceipt: {
        approved: boolean;
        reviewerId?: string;
        reviewedAt?: string;
      };
      promotionAuthorizationReceipt: {
        authorized: boolean;
        authorizedBy?: string;
        authorizedAt?: string;
      };
    };
    report: {
      runId: string;
      status: "blocked" | "return_ingested";
      providerSelfReportIgnoredForCompletion: true;
      previewPolicy: "verified_or_needs_review_only";
      missingProjection: "blocked_placeholder";
      promotionPolicy: "human_qa_and_explicit_authorization_required";
      blockers: string[];
    };
    statuses: Array<{
      shotId: string;
      returnStatus: P6RealImage2ReturnedStatus;
      previewProjection: "image_hold" | "blocked_placeholder";
      exportStatus: "included_for_preview" | "blocked_missing_evidence";
      promotionEligible: boolean;
    }>;
  };
  blockers: string[];
  notes: string[];
}

const expectedConfirmationPhrase = "submit-p6-image2";
const rawSecretValuePattern = /(^sk-[a-z0-9_-]{8,}|^bearer\s+|api[_-]?key\s*[=:]|private[_-]?key|raw[-_ ]?secret)/i;
const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/]|[a-zA-Z][a-zA-Z0-9+.-]*:)/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;
const sha256Pattern = /^sha256:[a-f0-9]{64}$/;

function compactUnique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).sort((left, right) => left.localeCompare(right));
}

function normalizePath(value: string | undefined): string {
  return (value || "").trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function safeId(value: string): string {
  const safe = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return safe || "shot";
}

function relativePathSafe(pathValue: string): boolean {
  const normalized = normalizePath(pathValue);
  return Boolean(normalized) && !absolutePathPattern.test(normalized) && !parentTraversalPattern.test(normalized);
}

function selectedShotIdsValid(shotIds: string[]): boolean {
  return shotIds.length >= 1
    && shotIds.length <= 3
    && shotIds.every((shotId) => Boolean(shotId.trim()))
    && new Set(shotIds).size === shotIds.length;
}

function expectedOutputsValid(
  expectedOutputs: BuildP6RealImage2PlanInput["expectedOutputs"] | undefined,
  shotIds: string[],
): boolean {
  if (!expectedOutputs) return true;
  if (expectedOutputs.length !== shotIds.length) return false;
  return expectedOutputs.every((output) =>
    shotIds.includes(output.shotId)
      && relativePathSafe(output.expectedOutputPath)
      && relativePathSafe(output.providerObservationPath)
      && relativePathSafe(output.semanticQaPath)
  );
}

function referenceInputsValid(referenceInputs: BuildP6RealImage2PlanInput["referenceInputs"] | undefined): boolean {
  if (!referenceInputs) return true;
  return referenceInputs.every((input) => relativePathSafe(input.path));
}

function receiptMatches(receipt: P6RealImage2PermissionReceiptLike | undefined, shotIds: string[]): boolean {
  if (!receipt) return false;
  if (receipt.status !== "pending_action_time_confirmation") return false;
  if (receipt.providerCalled !== false) return false;
  if (receipt.runtimeExternalNetworkCallMade !== false) return false;
  if (receipt.projectVibeWritten !== false) return false;
  if (receipt.submitIntent?.maxProviderCallsPerReceipt !== 1) return false;
  if (receipt.submitIntent.providerSubmitAllowed !== 0) return false;
  if (!Array.isArray(receipt.selectedShotIds)) return false;
  return sameShotSet(receipt.selectedShotIds, shotIds);
}

function normalizeSemanticQaStatus(status: P6RealImage2SemanticQaStatus | undefined): P6RealImage2ReturnedStatus {
  if (status === "success") return "verified";
  if (status === "verified" || status === "needs_review" || status === "missing") return status;
  return "missing";
}

function sameShotSet(left: string[] | undefined, right: string[]): boolean {
  if (!Array.isArray(left) || left.length !== right.length) return false;
  const values = new Set(left);
  return values.size === right.length && right.every((shotId) => values.has(shotId));
}

function sha256Valid(value: string | undefined): boolean {
  return Boolean(value && sha256Pattern.test(value));
}

function pathsMatch(left: string | undefined, right: string | undefined): boolean {
  return Boolean(left && right && normalizePath(left) === normalizePath(right));
}

function providerObservationBound(
  evidence: P6RealImage2ProviderObservationEvidence | undefined,
  expected: P6RealImage2Plan["expectedOutputs"][number] | undefined,
  plan: P6RealImage2Plan,
  outputPath: string,
  sha256: string | undefined,
): boolean {
  if (!evidence || !expected) return false;
  return Boolean(
    evidence.receiptId?.trim()
      && pathsMatch(evidence.receiptPath, expected.providerObservationPath)
      && evidence.runId === plan.runId
      && evidence.shotId === expected.shotId
      && evidence.submitPermissionReceiptId === plan.submitPermissionReceipt?.receiptId
      && sameShotSet(evidence.selectedShotIds, plan.shotIds)
      && pathsMatch(evidence.outputPath, outputPath)
      && sha256Valid(evidence.outputSha256)
      && evidence.outputSha256 === sha256,
  );
}

function semanticQaReceiptStatus(evidence: P6RealImage2SemanticQaEvidence | undefined, fallback: P6RealImage2SemanticQaStatus | undefined): P6RealImage2ReturnedStatus {
  return normalizeSemanticQaStatus(evidence?.status || evidence?.semanticQaStatus || evidence?.qaStatus || fallback);
}

function semanticQaBound(
  evidence: P6RealImage2SemanticQaEvidence | undefined,
  expected: P6RealImage2Plan["expectedOutputs"][number] | undefined,
  plan: P6RealImage2Plan,
  outputPath: string,
  sha256: string | undefined,
): boolean {
  if (!evidence || !expected) return false;
  const reviewedSha256 = evidence.reviewedOutputSha256 || evidence.outputSha256;
  return Boolean(
    evidence.receiptId?.trim()
      && pathsMatch(evidence.receiptPath, expected.semanticQaPath)
      && evidence.runId === plan.runId
      && evidence.shotId === expected.shotId
      && evidence.submitPermissionReceiptId === plan.submitPermissionReceipt?.receiptId
      && sameShotSet(evidence.selectedShotIds, plan.shotIds)
      && pathsMatch(evidence.outputPath, outputPath)
      && sha256Valid(reviewedSha256)
      && reviewedSha256 === sha256,
  );
}

export function buildP6RealImage2Plan(input: BuildP6RealImage2PlanInput): P6RealImage2Plan {
  const shotIds = Array.isArray(input.shotIds) ? input.shotIds.map((shotId) => String(shotId || "").trim()).filter(Boolean) : [];
  const outputRoot = normalizePath(input.outputRoot);
  const credentialRef = String(input.credentialRef || "").trim();
  const confirmationPhrase = String(input.actionTimeConfirmation?.phrase || "").trim();
  const confirmed = input.actionTimeConfirmation?.confirmed === true && confirmationPhrase === expectedConfirmationPhrase;
  const receipt = input.submitPermissionReceipt;
  const blockers = compactUnique([
    input.generatedAt ? undefined : "generatedAt is required.",
    input.runId ? undefined : "runId is required.",
    selectedShotIdsValid(shotIds) ? undefined : "P6 Image2 pilot requires 1 to 3 unique shot ids.",
    Number.isInteger(input.imageCount) && input.imageCount >= 1 && input.imageCount <= 3 ? undefined : "imageCount must be between 1 and 3.",
    input.imageCount === shotIds.length ? undefined : "imageCount must match selected shot count.",
    input.prompt?.trim() ? undefined : "prompt is required.",
    input.providerId?.trim() ? undefined : "providerId is required.",
    input.providerBaseUrl?.trim() ? undefined : "providerBaseUrl is required.",
    credentialRef ? undefined : "credentialRef is required.",
    rawSecretValuePattern.test(credentialRef) ? "credentialRef must be an opaque reference, not raw credential material." : undefined,
    relativePathSafe(outputRoot) ? undefined : "outputRoot must be project-root-relative and cannot use parent traversal.",
    expectedOutputsValid(input.expectedOutputs, shotIds) ? undefined : "expectedOutputs must match selected shots and stay project-root-relative.",
    referenceInputsValid(input.referenceInputs) ? undefined : "referenceInputs must stay project-root-relative.",
    receiptMatches(receipt, shotIds) ? undefined : "explicit pending permission receipt must match the selected shots and remain no-submit/no-network/no-project-write.",
    confirmed ? undefined : `action-time confirmation phrase must equal ${expectedConfirmationPhrase}.`,
  ]);
  const expectedOutputs = input.expectedOutputs && expectedOutputsValid(input.expectedOutputs, shotIds)
    ? input.expectedOutputs.map((output) => ({
      shotId: output.shotId,
      expectedOutputPath: normalizePath(output.expectedOutputPath),
      providerObservationPath: normalizePath(output.providerObservationPath),
      semanticQaPath: normalizePath(output.semanticQaPath),
    }))
    : shotIds.map((shotId) => {
      const safeShotId = safeId(shotId);
      return {
        shotId,
        expectedOutputPath: `${outputRoot}/shots/${safeShotId}/image2.png`,
        providerObservationPath: `${outputRoot}/provider_observations/${safeShotId}.json`,
        semanticQaPath: `${outputRoot}/semantic_qa/${safeShotId}.json`,
      };
    });

  return {
    schemaVersion: p6RealImage2ClosedLoopSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "p6_real_image2_small_batch_closed_loop",
    status: blockers.length ? "blocked" : "ready_for_live_submit",
    runId: input.runId,
    shotIds,
    prompt: input.prompt,
    imageCount: input.imageCount,
    provider: {
      providerId: input.providerId,
      baseUrl: input.providerBaseUrl,
      credentialRef,
      rawCredentialMaterialPresent: false,
    },
    outputRoot,
    expectedOutputs,
    referenceInputs: (input.referenceInputs || []).map((reference) => ({
      id: reference.id,
      type: reference.type,
      name: reference.name,
      path: normalizePath(reference.path),
    })),
    submitPermissionReceipt: receipt
      ? {
          receiptId: receipt.receiptId,
          status: receipt.status,
          maxProviderCallsPerReceipt: receipt.submitIntent?.maxProviderCallsPerReceipt,
          providerSubmitAllowed: receipt.submitIntent?.providerSubmitAllowed,
        }
      : undefined,
    actionTimeConfirmation: {
      required: true,
      confirmed,
      phrase: confirmationPhrase,
      expectedPhrase: expectedConfirmationPhrase,
    },
    blockers,
    hardLocks: {
      explicitPermissionReceiptRequired: true,
      actionTimeConfirmationRequired: true,
      maxImagesPerBatch: 3,
      maxProviderCallsPerReceipt: 1,
      maxConcurrency: IMAGE2_GENERATE_MAX_CONCURRENCY,
      retryConcurrency: IMAGE2_GENERATE_RETRY_CONCURRENCY,
      maxAutoRetries: IMAGE2_GENERATE_MAX_AUTO_RETRIES,
      providerSelfReportCanComplete: false,
      providerSubmitFastVerifyAllowed: false,
      runtimeStateIsDerivedCacheOnly: true,
      humanQaForPromotionRequired: true,
      explicitPromotionAuthorizationRequired: true,
      providerSelfReportCanPromote: false,
      runtimeStateCanPromote: false,
      projectFactsPromotionAllowed: false,
      freeTextToFormalTaskAllowed: false,
    },
    notes: [
      "P6 live submit is intentionally separated from permission receipt creation, provider return ingest, QA, and promotion.",
      "Preview may show only verified or needs_review returned outputs.",
      "runtime-state.json remains derived cache only and cannot be used as provider success evidence.",
    ],
  };
}

export function buildP6RealImage2ReturnIngest(input: P6RealImage2ReturnEvidenceInput): P6RealImage2ReturnIngest {
  const expectedByShot = new Map(input.plan.expectedOutputs.map((output) => [output.shotId, output]));
  const normalized = input.plan.shotIds.map((shotId) => {
    const evidence = input.returnedOutputs.find((item) => item.shotId === shotId);
    const expected = expectedByShot.get(shotId);
    const outputPath = normalizePath(evidence?.outputPath || expected?.expectedOutputPath);
    const sha256 = evidence?.sha256;
    const status = semanticQaReceiptStatus(evidence?.semanticQa, evidence?.semanticQaStatus);
    const outputPathBound = pathsMatch(outputPath, expected?.expectedOutputPath);
    const hasHashBoundOutput = outputPathBound && sha256Valid(sha256);
    const providerObservationReceiptBound = providerObservationBound(evidence?.providerObservation, expected, input.plan, outputPath, sha256);
    const semanticQaReceiptBound = semanticQaBound(evidence?.semanticQa, expected, input.plan, outputPath, sha256);
    const providerObservationPresent = evidence?.providerObservationPresent === true || providerObservationReceiptBound;
    const finalStatus: P6RealImage2ReturnedStatus = hasHashBoundOutput && providerObservationReceiptBound && semanticQaReceiptBound && status !== "missing"
      ? status
      : "missing";
    return {
      shotId,
      outputPath,
      sha256,
      status: finalStatus,
      providerObservationPresent,
      providerObservationReceiptBound,
      semanticQaReceiptBound,
      outputPathBound,
      sha256FormatValid: sha256Valid(sha256),
      providerSelfReportedSuccess: evidence?.providerSelfReportedSuccess === true,
    };
  });
  const missing = normalized.filter((item) => item.status === "missing").length;
  const needsReview = normalized.filter((item) => item.status === "needs_review").length;
  const verified = normalized.filter((item) => item.status === "verified").length;
  const blockers = compactUnique([
    input.plan.status === "ready_for_live_submit" ? undefined : "P6 return ingest requires a ready live-submit plan.",
    missing ? `${missing} expected output(s) are missing receipt-bound provider/semantic QA evidence.` : undefined,
  ]);
  const humanQaApproval = input.humanQaApproval;
  const humanQaCoversEveryVerifiedShot = input.plan.shotIds.every((shotId) => {
    const item = normalized.find((candidate) => candidate.shotId === shotId);
    if (!item || item.status !== "verified") return false;
    if (!humanQaApproval?.verifiedShotIds?.includes(shotId)) return false;
    const reviewedHash = humanQaApproval.reviewedSha256ByShotId?.[shotId];
    return Boolean(reviewedHash && reviewedHash === item.sha256);
  });
  const humanQaApproved = humanQaApproval?.approved === true
    && Boolean(humanQaApproval.reviewerId?.trim())
    && Boolean(humanQaApproval.reviewedAt?.trim())
    && humanQaCoversEveryVerifiedShot;
  const promotionAuthorization = input.promotionAuthorization;
  const promotionAuthorized = promotionAuthorization?.authorized === true
    && promotionAuthorization.scope === "p6_real_image2_small_batch"
    && promotionAuthorization.runId === input.plan.runId
    && sameShotSet(promotionAuthorization.shotIds, input.plan.shotIds)
    && Boolean(promotionAuthorization.authorizedBy?.trim())
    && Boolean(promotionAuthorization.authorizedAt?.trim());
  const promotionGateBlockers = compactUnique([
    blockers.length ? "Return ingest must be unblocked before promotion." : undefined,
    verified === normalized.length && normalized.length > 0 ? undefined : "Every selected shot must be success/verified before promotion.",
    humanQaApproved ? undefined : "Explicit human QA approval with reviewed hashes is required before promotion.",
    promotionAuthorized ? undefined : "Explicit promotion authorization is required before promotion.",
  ]);
  const promotionAllowed = promotionGateBlockers.length === 0;
  const ingestStatus = blockers.length ? "blocked" : "return_ingested";

  return {
    schemaVersion: p6RealImage2ClosedLoopSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "p6_real_image2_return_ingest",
    status: ingestStatus,
    runId: input.plan.runId,
    providerSelfReportIgnoredForCompletion: true,
    summary: {
      total: normalized.length,
      verified,
      needsReview,
      missing,
      previewEligible: verified + needsReview,
      promotionAllowed,
    },
    shotStatuses: normalized.map((item) => ({
      shotId: item.shotId,
      status: item.status,
      outputPath: item.outputPath,
      sha256: item.sha256,
      providerObservationPresent: item.providerObservationPresent,
      providerSelfReportedSuccess: item.providerSelfReportedSuccess,
    })),
    promotionGate: {
      promotionAllowed,
      defaultPromotionAllowed: false,
      requiresAllVerified: true,
      requiresExplicitHumanQaApproval: true,
      requiresExplicitPromotionAuthorization: true,
      providerSelfReportCanPromote: false,
      runtimeStateCanPromote: false,
      humanQaApproved,
      promotionAuthorized,
      blockers: promotionGateBlockers,
    },
    previewItems: normalized
      .filter((item): item is typeof item & { status: "verified" | "needs_review" } =>
        item.status === "verified" || item.status === "needs_review"
      )
      .map((item) => ({
        shotId: item.shotId,
        outputPath: item.outputPath,
        sha256: item.sha256,
        status: item.status,
      })),
    exportReport: {
      receipts: {
        submitPermissionReceiptId: input.plan.submitPermissionReceipt?.receiptId,
        submitPermissionReceiptStatus: input.plan.submitPermissionReceipt?.status,
        providerObservationReceipts: normalized.map((item) => ({
          shotId: item.shotId,
          path: expectedByShot.get(item.shotId)?.providerObservationPath || "",
          present: item.providerObservationPresent,
        })),
        semanticQaReceipts: normalized.map((item) => ({
          shotId: item.shotId,
          path: expectedByShot.get(item.shotId)?.semanticQaPath || "",
          status: item.status,
        })),
        humanQaReceipt: {
          approved: humanQaApproved,
          reviewerId: humanQaApproval?.reviewerId,
          reviewedAt: humanQaApproval?.reviewedAt,
        },
        promotionAuthorizationReceipt: {
          authorized: promotionAuthorized,
          authorizedBy: promotionAuthorization?.authorizedBy,
          authorizedAt: promotionAuthorization?.authorizedAt,
        },
      },
      report: {
        runId: input.plan.runId,
        status: ingestStatus,
        providerSelfReportIgnoredForCompletion: true,
        previewPolicy: "verified_or_needs_review_only",
        missingProjection: "blocked_placeholder",
        promotionPolicy: "human_qa_and_explicit_authorization_required",
        blockers,
      },
      statuses: normalized.map((item) => ({
        shotId: item.shotId,
        returnStatus: item.status,
        previewProjection: item.status === "verified" || item.status === "needs_review" ? "image_hold" : "blocked_placeholder",
        exportStatus: item.status === "verified" || item.status === "needs_review" ? "included_for_preview" : "blocked_missing_evidence",
        promotionEligible: promotionAllowed && item.status === "verified",
      })),
    },
    blockers,
    notes: [
      "Provider self-reported success is ignored for completion.",
      "Export reports must expose receipts/report/statuses so missing returns stay blocked placeholders.",
      "Promotion stays false until separate human QA and explicit promotion authorization are recorded.",
    ],
  };
}
