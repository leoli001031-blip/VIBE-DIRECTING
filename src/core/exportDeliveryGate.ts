import type { ProjectVibeReviewReceipt, ProjectVibeReviewStatus } from "../project/types";

export const EXPORT_DELIVERY_GATE_SCHEMA_VERSION = "export_delivery_gate/0.1.0" as const;
export const EXPORT_DELIVERY_CONFIRMATION_SCHEMA_VERSION = "export_delivery_confirmation/0.1.0" as const;
export const EXPORT_DELIVERY_RECEIPT_SCHEMA_VERSION = "export_delivery_receipt/0.1.0" as const;

export type ExportDeliveryGateStatus = "blocked" | "ready_for_confirmation" | "authorized" | "already_completed";
export type ExportDeliveryReceiptStatus = "validated" | "succeeded";
export type ExportDeliveryExecutionMode = "dry_run" | "live";

export type ExportDeliveryBlockerCode =
  | "delivery_project_id_missing"
  | "delivery_project_root_missing"
  | "delivery_project_fact_hash_missing"
  | "delivery_media_missing"
  | "delivery_media_identity_incomplete"
  | "delivery_review_required"
  | "delivery_review_identity_mismatch"
  | "delivery_review_not_human"
  | "delivery_review_rejected"
  | "delivery_review_retry_requested"
  | "delivery_review_missing"
  | "delivery_review_blocked"
  | "delivery_confirmation_required"
  | "delivery_confirmation_invalid"
  | "delivery_confirmation_project_mismatch"
  | "delivery_confirmation_root_mismatch"
  | "delivery_confirmation_fact_hash_mismatch"
  | "delivery_action_already_completed"
  | "delivery_receipt_invalid"
  | "delivery_media_hash_unverified"
  | "delivery_media_hash_mismatch";

export interface ExportDeliveryBlocker {
  code: ExportDeliveryBlockerCode;
  message: string;
  shotId?: string;
  reviewReceiptId?: string;
}

export interface ExportDeliveryProjectIdentity {
  projectId: string;
  projectRoot?: string;
  projectFactHash: string;
}

export interface ExportDeliveryMediaCandidate {
  id: string;
  shotId?: string;
  outputPath?: string;
  sourceReceiptId?: string;
  outputHash?: string;
  reviewReceiptId?: string;
}

export interface ExportDeliveryReviewBinding {
  reviewReceiptId: string;
  reviewedAt: string;
  shotId: string;
  outputPath: string;
  sourceReceiptId: string;
  outputHash: string;
  humanReviewed: true;
  promotionAuthorized: boolean;
}

export interface ExportDeliveryMediaState extends ExportDeliveryMediaCandidate {
  reviewStatus: ProjectVibeReviewStatus;
  humanReviewed: boolean;
  promotionAuthorized: boolean;
  binding?: ExportDeliveryReviewBinding;
  blockers: ExportDeliveryBlocker[];
}

export interface ExportDeliveryConfirmation {
  schemaVersion: typeof EXPORT_DELIVERY_CONFIRMATION_SCHEMA_VERSION;
  confirmationId: string;
  actionId: string;
  projectId: string;
  projectRoot?: string;
  projectFactHash: string;
  confirmedAt: string;
}

export interface ExportDeliveryAuthorization extends ExportDeliveryConfirmation {
  reviewBindings: ExportDeliveryReviewBinding[];
}

export interface ExportDeliveryReceiptOutput {
  operation: "write_file" | "copy_file";
  path: string;
  sourcePath?: string;
  sourceHash?: string;
  outputHash?: string;
  size?: number;
}

export interface ExportDeliveryReceipt {
  schemaVersion: typeof EXPORT_DELIVERY_RECEIPT_SCHEMA_VERSION;
  receiptId: string;
  status: ExportDeliveryReceiptStatus;
  projectId: string;
  projectRoot?: string;
  projectFactHash: string;
  actionId: string;
  confirmationId: string;
  reviewBindings: ExportDeliveryReviewBinding[];
  executionMode: ExportDeliveryExecutionMode;
  outputs: ExportDeliveryReceiptOutput[];
  createdAt: string;
}

export interface ExportDeliveryGateState {
  schemaVersion: typeof EXPORT_DELIVERY_GATE_SCHEMA_VERSION;
  status: ExportDeliveryGateStatus;
  identity: ExportDeliveryProjectIdentity;
  media: ExportDeliveryMediaState[];
  reviewBindings: ExportDeliveryReviewBinding[];
  authorization?: ExportDeliveryAuthorization;
  completedReceiptId?: string;
  canPrepare: boolean;
  canExecute: boolean;
  blockers: ExportDeliveryBlocker[];
}

export interface BuildExportDeliveryGateInput {
  identity: ExportDeliveryProjectIdentity;
  media: ExportDeliveryMediaCandidate[];
  reviewReceipts?: ProjectVibeReviewReceipt[];
  confirmation?: ExportDeliveryConfirmation;
  completedReceipts?: unknown[];
}

export interface RestoreExportDeliveryReceiptResult {
  ok: boolean;
  receipt?: ExportDeliveryReceipt;
  errors: string[];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function normalizeRoot(value: string | undefined) {
  return text(value).replace(/\\/g, "/").replace(/\/+$/g, "").replace(/^\/private\/tmp(?=\/|$)/, "/tmp");
}

function normalizePath(value: string | undefined) {
  return text(value).replace(/\\/g, "/").replace(/^file:\/+/, "").replace(/^\.\//, "").replace(/\/{2,}/g, "/");
}

function normalizeHash(value: string | undefined) {
  return text(value).toLowerCase();
}

function safeProjectRelativePath(value: unknown) {
  const path = normalizePath(text(value));
  return Boolean(path)
    && !/^(?:[a-z]:[\\/]|\/|~[\\/])/i.test(path)
    && !/(?:^|\/)\.\.(?:\/|$)/.test(path);
}

function exportOutputPath(value: unknown) {
  const path = normalizePath(text(value));
  return safeProjectRelativePath(path)
    && (path === "exports" || path.startsWith("exports/") || path === "reports/exports" || path.startsWith("reports/exports/"));
}

function validDate(value: unknown) {
  return Number.isFinite(Date.parse(text(value)));
}

function receiptTime(receipt: ProjectVibeReviewReceipt) {
  const parsed = Date.parse(receipt.createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sameIdentity(left: ExportDeliveryProjectIdentity, right: ExportDeliveryProjectIdentity) {
  return text(left.projectId) === text(right.projectId)
    && normalizeRoot(left.projectRoot) === normalizeRoot(right.projectRoot)
    && text(left.projectFactHash) === text(right.projectFactHash);
}

function blocker(
  code: ExportDeliveryBlockerCode,
  message: string,
  media?: Pick<ExportDeliveryMediaCandidate, "shotId">,
  reviewReceiptId?: string,
): ExportDeliveryBlocker {
  return {
    code,
    message,
    shotId: text(media?.shotId) || undefined,
    reviewReceiptId: text(reviewReceiptId) || undefined,
  };
}

function exactReceiptMatch(receipt: ProjectVibeReviewReceipt, media: ExportDeliveryMediaCandidate) {
  return text(receipt.shotId) === text(media.shotId)
    && normalizePath(receipt.outputPath) === normalizePath(media.outputPath)
    && text(receipt.sourceReceiptId) === text(media.sourceReceiptId)
    && normalizeHash(receipt.outputHash) === normalizeHash(media.outputHash);
}

function relatedReceipt(receipt: ProjectVibeReviewReceipt, media: ExportDeliveryMediaCandidate) {
  return Boolean(
    (text(media.shotId) && text(receipt.shotId) === text(media.shotId))
    || (normalizePath(media.outputPath) && normalizePath(receipt.outputPath) === normalizePath(media.outputPath))
    || (text(media.sourceReceiptId) && text(receipt.sourceReceiptId) === text(media.sourceReceiptId)),
  );
}

function latestReceipt(receipts: ProjectVibeReviewReceipt[]) {
  return receipts.reduce<ProjectVibeReviewReceipt | undefined>((latest, receipt) => (
    !latest || receiptTime(receipt) >= receiptTime(latest) ? receipt : latest
  ), undefined);
}

export function resolveExportDeliveryMediaReview(
  media: ExportDeliveryMediaCandidate,
  receipts: ProjectVibeReviewReceipt[] = [],
): ExportDeliveryMediaState {
  const shotId = text(media.shotId);
  const outputPath = normalizePath(media.outputPath);
  const sourceReceiptId = text(media.sourceReceiptId);
  const outputHash = normalizeHash(media.outputHash);
  if (!outputPath) {
    return {
      ...media,
      reviewStatus: "missing",
      humanReviewed: false,
      promotionAuthorized: false,
      blockers: [blocker("delivery_media_missing", "A video output is missing.", media)],
    };
  }
  if (!shotId || !sourceReceiptId || !outputHash) {
    return {
      ...media,
      reviewStatus: "needs_review",
      humanReviewed: false,
      promotionAuthorized: false,
      blockers: [blocker("delivery_media_identity_incomplete", "Video delivery identity requires shotId, outputPath, sourceReceiptId, and outputHash.", media)],
    };
  }

  const exactReceipts = receipts.filter((receipt) => exactReceiptMatch(receipt, media));
  const latest = latestReceipt(exactReceipts);
  if (!latest) {
    const related = receipts.some((receipt) => relatedReceipt(receipt, media));
    return {
      ...media,
      reviewStatus: "needs_review",
      humanReviewed: false,
      promotionAuthorized: false,
      blockers: [blocker(
        related ? "delivery_review_identity_mismatch" : "delivery_review_required",
        related
          ? "An existing review receipt does not match the current shot, path, source receipt, or output hash."
          : "The current video requires an exact human review receipt before delivery.",
        media,
      )],
    };
  }
  if (text(media.reviewReceiptId) && text(media.reviewReceiptId) !== latest.id) {
    return {
      ...media,
      reviewStatus: "needs_review",
      humanReviewed: false,
      promotionAuthorized: false,
      blockers: [blocker("delivery_review_identity_mismatch", "The projected review receipt is stale or does not match the latest exact decision.", media, latest.id)],
    };
  }

  const base = {
    ...media,
    reviewReceiptId: latest.id,
    reviewStatus: latest.status,
    humanReviewed: latest.humanReviewed,
    promotionAuthorized: latest.promotionAuthorized,
  };
  if (latest.blockers.length) {
    return {
      ...base,
      blockers: [blocker("delivery_review_blocked", "The exact review receipt contains blockers.", media, latest.id)],
    };
  }
  if (latest.status === "rejected") {
    return { ...base, blockers: [blocker("delivery_review_rejected", "The current video was rejected in review.", media, latest.id)] };
  }
  if (latest.status === "retry_requested" || latest.retryRequested) {
    return { ...base, blockers: [blocker("delivery_review_retry_requested", "The current video requires a retry before delivery.", media, latest.id)] };
  }
  if (latest.status === "missing") {
    return { ...base, blockers: [blocker("delivery_review_missing", "The review receipt records the video as missing.", media, latest.id)] };
  }
  if (latest.status !== "approved") {
    return { ...base, blockers: [blocker("delivery_review_required", "The current video is still waiting for review.", media, latest.id)] };
  }
  if (!latest.humanReviewed) {
    return { ...base, blockers: [blocker("delivery_review_not_human", "Delivery requires an explicit human review decision.", media, latest.id)] };
  }

  return {
    ...base,
    humanReviewed: true,
    binding: {
      reviewReceiptId: latest.id,
      reviewedAt: latest.createdAt,
      shotId,
      outputPath,
      sourceReceiptId,
      outputHash,
      humanReviewed: true,
      promotionAuthorized: latest.promotionAuthorized,
    },
    blockers: [],
  };
}

function identityBlockers(identity: ExportDeliveryProjectIdentity) {
  const blockers: ExportDeliveryBlocker[] = [];
  if (!text(identity.projectId)) blockers.push(blocker("delivery_project_id_missing", "Delivery requires a projectId."));
  if (!normalizeRoot(identity.projectRoot)) blockers.push(blocker("delivery_project_root_missing", "Delivery requires a local projectRoot."));
  if (!text(identity.projectFactHash)) blockers.push(blocker("delivery_project_fact_hash_missing", "Delivery requires the current projectFactHash."));
  return blockers;
}

function confirmationBlockers(identity: ExportDeliveryProjectIdentity, confirmation: ExportDeliveryConfirmation | undefined) {
  if (!confirmation) return [blocker("delivery_confirmation_required", "An independent export confirmation is required.")];
  const blockers: ExportDeliveryBlocker[] = [];
  if (
    confirmation.schemaVersion !== EXPORT_DELIVERY_CONFIRMATION_SCHEMA_VERSION
    || !text(confirmation.confirmationId)
    || !text(confirmation.actionId)
    || !validDate(confirmation.confirmedAt)
  ) blockers.push(blocker("delivery_confirmation_invalid", "The export confirmation is incomplete or invalid."));
  if (text(confirmation.projectId) !== text(identity.projectId)) {
    blockers.push(blocker("delivery_confirmation_project_mismatch", "The export confirmation belongs to another project."));
  }
  if (normalizeRoot(confirmation.projectRoot) !== normalizeRoot(identity.projectRoot)) {
    blockers.push(blocker("delivery_confirmation_root_mismatch", "The export confirmation belongs to another project root."));
  }
  if (text(confirmation.projectFactHash) !== text(identity.projectFactHash)) {
    blockers.push(blocker("delivery_confirmation_fact_hash_mismatch", "The export confirmation belongs to older project facts."));
  }
  return blockers;
}

function validateReviewBinding(value: unknown, label: string, errors: string[]) {
  const binding = record(value);
  if (!binding) {
    errors.push(`${label} must be an object.`);
    return;
  }
  for (const key of ["reviewReceiptId", "reviewedAt", "shotId", "outputPath", "sourceReceiptId", "outputHash"] as const) {
    if (!text(binding[key])) errors.push(`${label} is missing ${key}.`);
  }
  if (!safeProjectRelativePath(binding.outputPath)) errors.push(`${label} outputPath must be project-root-relative.`);
  if (!validDate(binding.reviewedAt)) errors.push(`${label} reviewedAt is invalid.`);
  if (binding.humanReviewed !== true) errors.push(`${label} humanReviewed must be true.`);
  if (typeof binding.promotionAuthorized !== "boolean") errors.push(`${label} promotionAuthorized must be a boolean.`);
}

export function restoreExportDeliveryReceipt(value: unknown): RestoreExportDeliveryReceiptResult {
  const candidate = record(value);
  if (!candidate) return { ok: false, errors: ["Delivery receipt must be an object."] };
  const errors: string[] = [];
  if (candidate.schemaVersion !== EXPORT_DELIVERY_RECEIPT_SCHEMA_VERSION) errors.push("Delivery receipt schemaVersion is invalid.");
  if (candidate.status !== "validated" && candidate.status !== "succeeded") errors.push("Delivery receipt status is invalid.");
  for (const key of ["receiptId", "projectId", "projectRoot", "projectFactHash", "actionId", "confirmationId", "createdAt"] as const) {
    if (!text(candidate[key])) errors.push(`Delivery receipt is missing ${key}.`);
  }
  if (!validDate(candidate.createdAt)) errors.push("Delivery receipt createdAt is invalid.");
  if (candidate.executionMode !== "dry_run" && candidate.executionMode !== "live") errors.push("Delivery receipt executionMode is invalid.");
  if (!Array.isArray(candidate.reviewBindings) || candidate.reviewBindings.length === 0) {
    errors.push("Delivery receipt requires reviewBindings.");
  } else {
    candidate.reviewBindings.forEach((binding, index) => validateReviewBinding(binding, `reviewBindings[${index}]`, errors));
  }
  if (!Array.isArray(candidate.outputs)) {
    errors.push("Delivery receipt outputs must be an array.");
  } else {
    candidate.outputs.forEach((output, index) => {
      const item = record(output);
      if (!item || (item.operation !== "write_file" && item.operation !== "copy_file") || !text(item.path)) {
        errors.push(`outputs[${index}] is invalid.`);
      } else {
        if (!exportOutputPath(item.path)) errors.push(`outputs[${index}] path must stay inside the export root.`);
        if (item.operation === "copy_file" && !safeProjectRelativePath(item.sourcePath)) errors.push(`outputs[${index}] copy source must be project-root-relative.`);
      }
    });
  }
  if (candidate.executionMode === "dry_run" && (candidate.status !== "validated" || (Array.isArray(candidate.outputs) && candidate.outputs.length > 0))) {
    errors.push("Dry-run delivery receipts cannot claim filesystem outputs.");
  }
  if (candidate.executionMode === "live" && candidate.status !== "succeeded") {
    errors.push("Live delivery receipts must be succeeded.");
  }
  if (candidate.executionMode === "live" && Array.isArray(candidate.outputs) && candidate.outputs.length === 0) {
    errors.push("Live delivery receipts must list actual outputs.");
  }
  return errors.length
    ? { ok: false, errors }
    : { ok: true, receipt: candidate as unknown as ExportDeliveryReceipt, errors: [] };
}

export function buildExportDeliveryGate(input: BuildExportDeliveryGateInput): ExportDeliveryGateState {
  const identity: ExportDeliveryProjectIdentity = {
    projectId: text(input.identity.projectId),
    projectRoot: normalizeRoot(input.identity.projectRoot) || undefined,
    projectFactHash: text(input.identity.projectFactHash),
  };
  const media = input.media.map((candidate) => resolveExportDeliveryMediaReview(candidate, input.reviewReceipts));
  const blockers = [
    ...identityBlockers(identity),
    ...(media.length ? [] : [blocker("delivery_media_missing", "At least one reviewed video is required for formal delivery.")]),
    ...media.flatMap((item) => item.blockers),
  ];
  const reviewBindings = media.flatMap((item) => item.binding ? [item.binding] : []);
  for (const value of input.completedReceipts || []) {
    const restored = restoreExportDeliveryReceipt(value);
    if (!restored.ok || !restored.receipt) {
      blockers.push(blocker("delivery_receipt_invalid", `A persisted delivery receipt is corrupt or incomplete: ${restored.errors.join(" ")}`));
      continue;
    }
    const receipt = restored.receipt;
    if (!sameIdentity(receipt, identity)) continue;
    if (
      input.confirmation
      && (receipt.actionId === input.confirmation.actionId || receipt.confirmationId === input.confirmation.confirmationId)
    ) {
      blockers.push(blocker("delivery_action_already_completed", "This export action or confirmation already has a terminal delivery receipt."));
      return {
        schemaVersion: EXPORT_DELIVERY_GATE_SCHEMA_VERSION,
        status: "already_completed",
        identity,
        media,
        reviewBindings,
        completedReceiptId: receipt.receiptId,
        canPrepare: false,
        canExecute: false,
        blockers,
      };
    }
  }
  if (blockers.length) {
    return {
      schemaVersion: EXPORT_DELIVERY_GATE_SCHEMA_VERSION,
      status: "blocked",
      identity,
      media,
      reviewBindings,
      canPrepare: false,
      canExecute: false,
      blockers,
    };
  }

  const confirmationErrors = confirmationBlockers(identity, input.confirmation);
  if (confirmationErrors.length) {
    const onlyMissingConfirmation = confirmationErrors.every((item) => item.code === "delivery_confirmation_required");
    return {
      schemaVersion: EXPORT_DELIVERY_GATE_SCHEMA_VERSION,
      status: onlyMissingConfirmation ? "ready_for_confirmation" : "blocked",
      identity,
      media,
      reviewBindings,
      canPrepare: true,
      canExecute: false,
      blockers: confirmationErrors,
    };
  }

  const confirmation = input.confirmation!;
  return {
    schemaVersion: EXPORT_DELIVERY_GATE_SCHEMA_VERSION,
    status: "authorized",
    identity,
    media,
    reviewBindings,
    authorization: {
      ...confirmation,
      projectRoot: identity.projectRoot,
      reviewBindings,
    },
    canPrepare: true,
    canExecute: true,
    blockers: [],
  };
}

export function authorizeExportDeliveryGate(input: {
  gate: ExportDeliveryGateState;
  confirmation?: ExportDeliveryConfirmation;
  completedReceipts?: unknown[];
}) {
  const gate = input.gate;
  if (
    gate.schemaVersion !== EXPORT_DELIVERY_GATE_SCHEMA_VERSION
    || !Array.isArray(gate.media)
    || !Array.isArray(gate.reviewBindings)
    || gate.media.some((media) => !media.binding || media.blockers.length > 0)
  ) {
    return {
      ...gate,
      status: "blocked" as const,
      authorization: undefined,
      canPrepare: false,
      canExecute: false,
      blockers: [blocker("delivery_confirmation_invalid", "The planned Delivery Gate is incomplete or invalid.")],
    };
  }
  const receipts: ProjectVibeReviewReceipt[] = gate.reviewBindings.map((binding) => ({
    id: binding.reviewReceiptId,
    createdAt: binding.reviewedAt,
    status: "approved",
    reviewerId: "delivery_gate",
    humanReviewed: true,
    shotId: binding.shotId,
    sourceReceiptId: binding.sourceReceiptId,
    outputPath: binding.outputPath,
    outputHash: binding.outputHash,
    retryRequested: false,
    lateOutput: false,
    providerSelfReportIgnored: true,
    promotionAuthorized: binding.promotionAuthorized,
    evidenceRefs: [],
    blockers: [],
  }));
  return buildExportDeliveryGate({
    identity: gate.identity,
    media: gate.media.map((media) => ({
      id: media.id,
      shotId: media.shotId,
      outputPath: media.outputPath,
      sourceReceiptId: media.sourceReceiptId,
      outputHash: media.outputHash,
      reviewReceiptId: media.reviewReceiptId,
    })),
    reviewReceipts: receipts,
    confirmation: input.confirmation,
    completedReceipts: input.completedReceipts,
  });
}

export function createExportDeliveryReceipt(input: {
  gate: ExportDeliveryGateState;
  executionMode: ExportDeliveryExecutionMode;
  outputs: ExportDeliveryReceiptOutput[];
  createdAt?: string;
}): ExportDeliveryReceipt | undefined {
  const authorization = input.gate.authorization;
  if (input.gate.status !== "authorized" || !input.gate.canExecute || !authorization) return undefined;
  const createdAt = input.createdAt || new Date().toISOString();
  const outputs = input.executionMode === "dry_run" ? [] : input.outputs;
  return {
    schemaVersion: EXPORT_DELIVERY_RECEIPT_SCHEMA_VERSION,
    receiptId: `export_delivery_${safeId(authorization.actionId)}_${safeId(authorization.confirmationId)}`,
    status: input.executionMode === "dry_run" ? "validated" : "succeeded",
    projectId: authorization.projectId,
    projectRoot: authorization.projectRoot,
    projectFactHash: authorization.projectFactHash,
    actionId: authorization.actionId,
    confirmationId: authorization.confirmationId,
    reviewBindings: authorization.reviewBindings,
    executionMode: input.executionMode,
    outputs,
    createdAt,
  };
}

export function exportDeliveryBlockerMessages(gate: ExportDeliveryGateState) {
  return gate.blockers.map((item) => `[${item.code}] ${item.message}`);
}

function safeId(value: string) {
  return text(value).replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "export";
}
