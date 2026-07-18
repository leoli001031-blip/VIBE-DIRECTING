import {
  hashProjectVibeFacts,
  type ProjectVibeDocument,
  type ProjectVibeReviewReceipt,
} from "../project";
import {
  normalizeAgentDirectorReviewOutputHash,
  normalizeAgentDirectorReviewOutputPath,
  normalizeAgentDirectorReviewProjectRoot,
} from "./agentDirectorReviewDecision";
import type { PreviewQueueItem } from "./previewPlayerQueue";

export const AGENT_DIRECTOR_DELIVERY_HANDOFF_SCHEMA_VERSION = "agent_director_delivery_handoff/1.0.0" as const;

export interface AgentDirectorDeliveryHandoffMedia {
  promotionReceiptId: string;
  projectId: string;
  projectRoot: string;
  currentProjectFactHash: string;
  sourceProjectFactHash: string;
  shotId: string;
  jobId: string;
  actionId: string;
  selectionReceiptId: string;
  versionPairId: string;
  winnerVersion: "A" | "B";
  promotionActionId: string;
  promotionConfirmationId: string;
  sourceReceiptId: string;
  outputPath: string;
  absoluteOutputPath: string;
  outputHash: string;
  promotedAt: string;
}

export interface AgentDirectorDeliveryHandoffProjection {
  schemaVersion: typeof AGENT_DIRECTOR_DELIVERY_HANDOFF_SCHEMA_VERSION;
  status: "not_applicable" | "ready" | "blocked";
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
  promotionReceiptCount: number;
  media: AgentDirectorDeliveryHandoffMedia[];
  reviewReceipts: ProjectVibeReviewReceipt[];
  blockers: string[];
}

export interface AgentDirectorDeliveryPreviewQueueItem extends PreviewQueueItem {
  source: "agent_director_delivery_handoff";
  order: number;
  status: "approved";
  previewStatus: "approved";
  previewQaStatus: "approved";
  productionQaStatus: "approved";
  reviewRequired: false;
  returned: true;
  blocked: false;
  blockers: [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function timeValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeProjectRelativePath(value: string) {
  const path = normalizeAgentDirectorReviewOutputPath(value);
  return path
    && !/^(?:\/|[A-Za-z]:\/|~\/)/.test(path)
    && !/(?:^|\/)\.\.(?:\/|$)/.test(path)
    ? path
    : "";
}

function promotionReceiptBlockers(input: {
  receipt: ProjectVibeReviewReceipt;
  project: ProjectVibeDocument;
  projectRoot: string;
  shotIds: Set<string>;
}) {
  const { receipt, project, projectRoot, shotIds } = input;
  const outputPath = safeProjectRelativePath(receipt.outputPath || "");
  return [
    receipt.status === "approved" ? "" : `delivery_promotion_not_approved:${receipt.id}`,
    receipt.humanReviewed === true ? "" : `delivery_promotion_not_human:${receipt.id}`,
    receipt.promotionAuthorized === true ? "" : `delivery_promotion_not_authorized:${receipt.id}`,
    receipt.providerSelfReportIgnored === true ? "" : `delivery_promotion_provider_self_report:${receipt.id}`,
    receipt.retryRequested === false ? "" : `delivery_promotion_retry_requested:${receipt.id}`,
    receipt.blockers.length === 0 ? "" : `delivery_promotion_has_blockers:${receipt.id}`,
    text(receipt.projectId) === project.manifest.projectId ? "" : `delivery_promotion_project_mismatch:${receipt.id}`,
    normalizeAgentDirectorReviewProjectRoot(receipt.projectRoot || "") === projectRoot ? "" : `delivery_promotion_root_mismatch:${receipt.id}`,
    text(receipt.projectFactHash) ? "" : `delivery_promotion_source_fact_missing:${receipt.id}`,
    text(receipt.jobId) ? "" : `delivery_promotion_job_missing:${receipt.id}`,
    text(receipt.actionId) ? "" : `delivery_promotion_action_missing:${receipt.id}`,
    text(receipt.selectionReceiptId) ? "" : `delivery_promotion_selection_missing:${receipt.id}`,
    text(receipt.versionPairId) ? "" : `delivery_promotion_pair_missing:${receipt.id}`,
    receipt.winnerVersion === "A" || receipt.winnerVersion === "B" ? "" : `delivery_promotion_winner_missing:${receipt.id}`,
    text(receipt.promotionActionId) ? "" : `delivery_promotion_action_confirmation_missing:${receipt.id}`,
    text(receipt.promotionConfirmationId) ? "" : `delivery_promotion_confirmation_missing:${receipt.id}`,
    text(receipt.shotId) && shotIds.has(text(receipt.shotId)) ? "" : `delivery_promotion_shot_mismatch:${receipt.id}`,
    text(receipt.sourceReceiptId) ? "" : `delivery_promotion_source_receipt_missing:${receipt.id}`,
    outputPath ? "" : `delivery_promotion_output_path_invalid:${receipt.id}`,
    /^sha256:[a-f0-9]{64}$/i.test(normalizeAgentDirectorReviewOutputHash(receipt.outputHash || "")) ? "" : `delivery_promotion_output_hash_invalid:${receipt.id}`,
    Number.isFinite(Date.parse(receipt.createdAt)) ? "" : `delivery_promotion_timestamp_invalid:${receipt.id}`,
  ].filter(Boolean);
}

function deliveryMedia(input: {
  receipt: ProjectVibeReviewReceipt;
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
}): AgentDirectorDeliveryHandoffMedia {
  const receipt = input.receipt;
  const outputPath = safeProjectRelativePath(receipt.outputPath || "");
  return {
    promotionReceiptId: receipt.id,
    projectId: input.projectId,
    projectRoot: input.projectRoot,
    currentProjectFactHash: input.projectFactHash,
    sourceProjectFactHash: receipt.projectFactHash!,
    shotId: receipt.shotId!,
    jobId: receipt.jobId!,
    actionId: receipt.actionId!,
    selectionReceiptId: receipt.selectionReceiptId!,
    versionPairId: receipt.versionPairId!,
    winnerVersion: receipt.winnerVersion!,
    promotionActionId: receipt.promotionActionId!,
    promotionConfirmationId: receipt.promotionConfirmationId!,
    sourceReceiptId: receipt.sourceReceiptId!,
    outputPath,
    absoluteOutputPath: normalizeAgentDirectorReviewOutputPath(`${input.projectRoot}/${outputPath}`),
    outputHash: normalizeAgentDirectorReviewOutputHash(receipt.outputHash || ""),
    promotedAt: receipt.createdAt,
  };
}

export function buildAgentDirectorDeliveryHandoff(input: {
  project: ProjectVibeDocument;
  projectRoot?: string;
  projectFactHash?: string;
}): AgentDirectorDeliveryHandoffProjection {
  const projectId = text(input.project.manifest.projectId);
  const projectRoot = normalizeAgentDirectorReviewProjectRoot(input.projectRoot || "");
  const projectFactHash = text(input.projectFactHash) || hashProjectVibeFacts(input.project);
  const currentFactHash = hashProjectVibeFacts(input.project);
  const promotionReceipts = (input.project.receipts?.reviewReceipts || [])
    .filter((receipt) => receipt.decisionScope === "agent_video_promotion");
  const base = {
    schemaVersion: AGENT_DIRECTOR_DELIVERY_HANDOFF_SCHEMA_VERSION,
    projectId,
    projectRoot,
    projectFactHash,
    promotionReceiptCount: promotionReceipts.length,
  };
  if (!promotionReceipts.length) {
    return { ...base, status: "not_applicable", media: [], reviewReceipts: [], blockers: [] };
  }
  const blockers = [
    projectId ? "" : "delivery_handoff_project_id_missing",
    projectRoot ? "" : "delivery_handoff_project_root_missing",
    projectFactHash === currentFactHash ? "" : "delivery_handoff_current_fact_mismatch",
  ].filter(Boolean);
  const latestPromotionReceipt = promotionReceipts.reduce<ProjectVibeReviewReceipt | undefined>((latest, receipt) => (
    !latest || timeValue(receipt.createdAt) >= timeValue(latest.createdAt) ? receipt : latest
  ), undefined);
  if (
    !latestPromotionReceipt
    || latestPromotionReceipt.createdAt !== input.project.manifest.updatedAt
    || latestPromotionReceipt.createdAt !== input.project.sourceIndex.updatedAt
  ) {
    blockers.push("delivery_handoff_project_changed_after_promotion");
  }
  const shotIds = new Set(input.project.shots.map((shot) => shot.id));
  for (const receipt of promotionReceipts) {
    blockers.push(...promotionReceiptBlockers({ receipt, project: input.project, projectRoot, shotIds }));
  }
  const latestByShot = new Map<string, ProjectVibeReviewReceipt>();
  for (const receipt of promotionReceipts) {
    const shotId = text(receipt.shotId);
    if (!shotId) continue;
    const current = latestByShot.get(shotId);
    if (!current || timeValue(receipt.createdAt) > timeValue(current.createdAt)) latestByShot.set(shotId, receipt);
  }
  for (const shot of input.project.shots) {
    if (!latestByShot.has(shot.id)) blockers.push(`delivery_promotion_missing_for_shot:${shot.id}`);
  }
  const selectedReceipts = input.project.shots.flatMap((shot) => {
    const receipt = latestByShot.get(shot.id);
    return receipt ? [receipt] : [];
  });
  const selectedOutputHashes = selectedReceipts.map((receipt) => normalizeAgentDirectorReviewOutputHash(receipt.outputHash || ""));
  if (new Set(selectedOutputHashes).size !== selectedOutputHashes.length) blockers.push("delivery_promotion_output_hash_reused");
  if (blockers.length) {
    return {
      ...base,
      status: "blocked",
      media: [],
      reviewReceipts: [],
      blockers: Array.from(new Set(blockers)),
    };
  }
  return {
    ...base,
    status: "ready",
    media: selectedReceipts.map((receipt) => deliveryMedia({ receipt, projectId, projectRoot, projectFactHash })),
    reviewReceipts: selectedReceipts,
    blockers: [],
  };
}

export function agentDirectorDeliveryHandoffPreviewQueue(
  handoff: AgentDirectorDeliveryHandoffProjection,
  project: ProjectVibeDocument,
): AgentDirectorDeliveryPreviewQueueItem[] {
  if (handoff.status !== "ready") return [];
  const shotById = new Map(project.shots.map((shot) => [shot.id, shot]));
  let startSeconds = 0;
  return handoff.media.map((media, index) => {
    const durationSeconds = Math.max(1, shotById.get(media.shotId)?.durationSeconds || 5);
    const item: AgentDirectorDeliveryPreviewQueueItem = {
      id: `promoted_delivery_${media.promotionReceiptId}`,
      kind: "video_clip",
      shotId: media.shotId,
      startSeconds,
      durationSeconds,
      mediaPath: media.absoluteOutputPath,
      label: media.shotId,
      sourceReceiptId: media.sourceReceiptId,
      outputHash: media.outputHash,
      reviewReceiptId: media.promotionReceiptId,
      source: "agent_director_delivery_handoff",
      order: index + 1,
      status: "approved",
      previewStatus: "approved",
      previewQaStatus: "approved",
      productionQaStatus: "approved",
      reviewRequired: false,
      returned: true,
      blocked: false,
      blockers: [],
    };
    startSeconds += durationSeconds;
    return item;
  });
}
