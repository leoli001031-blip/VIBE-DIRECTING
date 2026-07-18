import {
  agentDirectorReviewIdentityKey,
  agentDirectorReviewIdentityMatches,
  normalizeAgentDirectorReviewOutputHash,
  normalizeAgentDirectorReviewOutputPath,
  normalizeAgentDirectorReviewProjectRoot,
  validateAgentDirectorReviewIdentity,
  type AgentDirectorReviewIdentity,
} from "./agentDirectorReviewDecision";
import {
  agentDirectorReviewVersionPairCandidate,
  agentDirectorReviewVersionPairMatchesProject,
  type AgentDirectorReviewVersion,
  type AgentDirectorReviewVersionPair,
} from "./agentDirectorReviewVersionPair";
import {
  hashProjectVibeFacts,
  type ProjectVibeDocument,
  type ProjectVibeReviewReceipt,
  type ProjectVibeTransaction,
} from "../project";

export const AGENT_DIRECTOR_REVIEW_SELECTION_LEDGER_SCHEMA_VERSION = "agent_director_review_selection_ledger/1.0.0" as const;

export interface AgentDirectorReviewSelectionProjectIdentity {
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
}

export interface AgentDirectorReviewSelectionConfirmation {
  confirmationId: string;
  actionId: string;
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
  pairId: string;
  shotId: string;
  winnerVersion: AgentDirectorReviewVersion;
  winner: AgentDirectorReviewIdentity;
  loser: AgentDirectorReviewIdentity;
  status: "waiting" | "resolved" | "cancelled";
  createdAt: string;
  resolvedAt?: string;
}

export interface AgentDirectorReviewSelectionReceipt {
  receiptId: string;
  confirmationId: string;
  actionId: string;
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
  pairId: string;
  shotId: string;
  winnerVersion: AgentDirectorReviewVersion;
  winner: AgentDirectorReviewIdentity;
  loser: AgentDirectorReviewIdentity;
  status: "selected";
  reviewerId: string;
  humanReviewed: true;
  promotionAuthorized: false;
  selectedAt: string;
}

export interface AgentDirectorReviewPromotionConfirmation {
  confirmationId: string;
  actionId: string;
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
  pairId: string;
  shotId: string;
  selectionReceiptId: string;
  winnerVersion: AgentDirectorReviewVersion;
  winner: AgentDirectorReviewIdentity;
  status: "waiting" | "resolved" | "cancelled";
  createdAt: string;
  resolvedAt?: string;
}

export interface AgentDirectorReviewSelectionLedger {
  schemaVersion: typeof AGENT_DIRECTOR_REVIEW_SELECTION_LEDGER_SCHEMA_VERSION;
  ledgerId: string;
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
  createdAt: string;
  updatedAt: string;
  selectionConfirmations: AgentDirectorReviewSelectionConfirmation[];
  selectionReceipts: AgentDirectorReviewSelectionReceipt[];
  promotionConfirmations: AgentDirectorReviewPromotionConfirmation[];
}

export interface AgentDirectorReviewSelectionProjection {
  status: "compare" | "selection_confirmation" | "selected" | "promotion_confirmation" | "blocked";
  pairId?: string;
  winnerVersion?: AgentDirectorReviewVersion;
  selectionConfirmation?: AgentDirectorReviewSelectionConfirmation;
  selectionReceipt?: AgentDirectorReviewSelectionReceipt;
  promotionConfirmation?: AgentDirectorReviewPromotionConfirmation;
  blockers: string[];
}

export interface AgentDirectorReviewSelectionMutationResult {
  ok: boolean;
  ledger: AgentDirectorReviewSelectionLedger;
  confirmation?: AgentDirectorReviewSelectionConfirmation;
  receipt?: AgentDirectorReviewSelectionReceipt;
  promotionConfirmation?: AgentDirectorReviewPromotionConfirmation;
  blockers: string[];
}

export interface AgentDirectorReviewPromotionTransactionResult {
  status: "staged" | "already_promoted" | "blocked";
  transaction?: ProjectVibeTransaction;
  promotionReceipt?: ProjectVibeReviewReceipt;
  selectionReceipt?: AgentDirectorReviewSelectionReceipt;
  blockers: string[];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validDate(value: unknown) {
  return Number.isFinite(Date.parse(text(value)));
}

function safeId(value: string, fallback: string) {
  return text(value).replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

function timeValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function identityMatches(left: AgentDirectorReviewSelectionProjectIdentity, right: AgentDirectorReviewSelectionProjectIdentity) {
  return text(left.projectId) === text(right.projectId)
    && normalizeAgentDirectorReviewProjectRoot(left.projectRoot) === normalizeAgentDirectorReviewProjectRoot(right.projectRoot)
    && text(left.projectFactHash) === text(right.projectFactHash);
}

function pairMatchesLedger(pair: AgentDirectorReviewVersionPair, ledger: AgentDirectorReviewSelectionLedger) {
  return agentDirectorReviewVersionPairMatchesProject(pair, ledger)
    && pair.pairId.length > 0
    && pair.shotId.length > 0;
}

function candidatePair(pair: AgentDirectorReviewVersionPair, version: AgentDirectorReviewVersion) {
  const winner = agentDirectorReviewVersionPairCandidate(pair, version).identity;
  const loser = agentDirectorReviewVersionPairCandidate(pair, version === "A" ? "B" : "A").identity;
  return { winner, loser };
}

function confirmationMatchesPair(
  confirmation: AgentDirectorReviewSelectionConfirmation,
  pair: AgentDirectorReviewVersionPair,
) {
  const candidates = candidatePair(pair, confirmation.winnerVersion);
  return confirmation.pairId === pair.pairId
    && confirmation.shotId === pair.shotId
    && identityMatches(confirmation, pair)
    && agentDirectorReviewIdentityMatches(confirmation.winner, candidates.winner)
    && agentDirectorReviewIdentityMatches(confirmation.loser, candidates.loser);
}

function selectionReceiptMatchesPair(
  receipt: AgentDirectorReviewSelectionReceipt,
  pair: AgentDirectorReviewVersionPair,
) {
  const candidates = candidatePair(pair, receipt.winnerVersion);
  return receipt.pairId === pair.pairId
    && receipt.shotId === pair.shotId
    && identityMatches(receipt, pair)
    && receipt.status === "selected"
    && receipt.humanReviewed === true
    && receipt.promotionAuthorized === false
    && agentDirectorReviewIdentityMatches(receipt.winner, candidates.winner)
    && agentDirectorReviewIdentityMatches(receipt.loser, candidates.loser);
}

function promotionConfirmationMatchesSelection(
  confirmation: AgentDirectorReviewPromotionConfirmation,
  pair: AgentDirectorReviewVersionPair,
  receipt: AgentDirectorReviewSelectionReceipt,
) {
  return confirmation.pairId === pair.pairId
    && confirmation.selectionReceiptId === receipt.receiptId
    && confirmation.winnerVersion === receipt.winnerVersion
    && confirmation.shotId === receipt.shotId
    && identityMatches(confirmation, receipt)
    && agentDirectorReviewIdentityMatches(confirmation.winner, receipt.winner);
}

function latestSelectionReceipt(
  ledger: AgentDirectorReviewSelectionLedger,
  pair: AgentDirectorReviewVersionPair,
) {
  return ledger.selectionReceipts
    .filter((receipt) => selectionReceiptMatchesPair(receipt, pair))
    .reduce<AgentDirectorReviewSelectionReceipt | undefined>((latest, receipt) => (
      !latest || timeValue(receipt.selectedAt) >= timeValue(latest.selectedAt) ? receipt : latest
    ), undefined);
}

function waitingSelectionConfirmation(
  ledger: AgentDirectorReviewSelectionLedger,
  pair: AgentDirectorReviewVersionPair,
) {
  return ledger.selectionConfirmations
    .filter((confirmation) => confirmation.status === "waiting" && confirmationMatchesPair(confirmation, pair))
    .at(-1);
}

function waitingPromotionConfirmation(
  ledger: AgentDirectorReviewSelectionLedger,
  pair: AgentDirectorReviewVersionPair,
  receipt: AgentDirectorReviewSelectionReceipt,
) {
  return ledger.promotionConfirmations
    .filter((confirmation) => confirmation.status === "waiting" && promotionConfirmationMatchesSelection(confirmation, pair, receipt))
    .at(-1);
}

export function createAgentDirectorReviewSelectionLedger(input: AgentDirectorReviewSelectionProjectIdentity & {
  ledgerId?: string;
  createdAt?: string;
}): AgentDirectorReviewSelectionLedger {
  const createdAt = input.createdAt || new Date().toISOString();
  return {
    schemaVersion: AGENT_DIRECTOR_REVIEW_SELECTION_LEDGER_SCHEMA_VERSION,
    ledgerId: input.ledgerId || `agent_review_selection_${safeId(input.projectId, "project")}`,
    projectId: text(input.projectId),
    projectRoot: normalizeAgentDirectorReviewProjectRoot(input.projectRoot),
    projectFactHash: text(input.projectFactHash),
    createdAt,
    updatedAt: createdAt,
    selectionConfirmations: [],
    selectionReceipts: [],
    promotionConfirmations: [],
  };
}

export function agentDirectorReviewSelectionLedgerMatchesProject(
  ledger: AgentDirectorReviewSelectionLedger | undefined,
  identity: AgentDirectorReviewSelectionProjectIdentity,
) {
  return Boolean(ledger && identityMatches(ledger, identity));
}

export function buildAgentDirectorReviewSelectionProjection(input: {
  ledger?: AgentDirectorReviewSelectionLedger;
  pair?: AgentDirectorReviewVersionPair;
}): AgentDirectorReviewSelectionProjection {
  if (!input.pair) return { status: "compare", blockers: [] };
  if (!input.ledger) return { status: "compare", pairId: input.pair.pairId, blockers: [] };
  if (!pairMatchesLedger(input.pair, input.ledger)) {
    return { status: "blocked", pairId: input.pair.pairId, blockers: ["review_selection_ledger_identity_mismatch"] };
  }
  const selectionConfirmation = waitingSelectionConfirmation(input.ledger, input.pair);
  if (selectionConfirmation) {
    return {
      status: "selection_confirmation",
      pairId: input.pair.pairId,
      winnerVersion: selectionConfirmation.winnerVersion,
      selectionConfirmation,
      blockers: [],
    };
  }
  const selectionReceipt = latestSelectionReceipt(input.ledger, input.pair);
  if (!selectionReceipt) return { status: "compare", pairId: input.pair.pairId, blockers: [] };
  const promotionConfirmation = waitingPromotionConfirmation(input.ledger, input.pair, selectionReceipt);
  if (promotionConfirmation) {
    return {
      status: "promotion_confirmation",
      pairId: input.pair.pairId,
      winnerVersion: selectionReceipt.winnerVersion,
      selectionReceipt,
      promotionConfirmation,
      blockers: [],
    };
  }
  return {
    status: "selected",
    pairId: input.pair.pairId,
    winnerVersion: selectionReceipt.winnerVersion,
    selectionReceipt,
    blockers: [],
  };
}

export function stageAgentDirectorReviewSelection(input: {
  ledger: AgentDirectorReviewSelectionLedger;
  pair: AgentDirectorReviewVersionPair;
  winnerVersion: AgentDirectorReviewVersion;
  generatedAt?: string;
}): AgentDirectorReviewSelectionMutationResult {
  if (!pairMatchesLedger(input.pair, input.ledger)) {
    return { ok: false, ledger: input.ledger, blockers: ["review_selection_pair_identity_mismatch"] };
  }
  const generatedAt = input.generatedAt || new Date().toISOString();
  const { winner, loser } = candidatePair(input.pair, input.winnerVersion);
  if (validateAgentDirectorReviewIdentity(winner).length || validateAgentDirectorReviewIdentity(loser).length) {
    return { ok: false, ledger: input.ledger, blockers: ["review_selection_candidate_identity_invalid"] };
  }
  const existingWaiting = [...input.ledger.selectionConfirmations].reverse().find((confirmation) => (
    confirmation.status === "waiting"
    && confirmation.pairId === input.pair.pairId
    && confirmation.winnerVersion === input.winnerVersion
  ));
  if (existingWaiting) {
    return confirmationMatchesPair(existingWaiting, input.pair)
      ? { ok: true, ledger: input.ledger, confirmation: existingWaiting, blockers: [] }
      : { ok: false, ledger: input.ledger, blockers: ["review_selection_confirmation_identity_conflict"] };
  }
  const latestReceipt = latestSelectionReceipt(input.ledger, input.pair);
  if (latestReceipt?.winnerVersion === input.winnerVersion) {
    return { ok: true, ledger: input.ledger, receipt: latestReceipt, blockers: [] };
  }
  const attempt = input.ledger.selectionConfirmations.filter((confirmation) => confirmation.pairId === input.pair.pairId).length + 1;
  const attemptId = String(attempt).padStart(3, "0");
  const confirmationId = `review_selection_confirmation_${safeId(input.pair.pairId, "pair")}_${input.winnerVersion.toLowerCase()}_${attemptId}`;
  const actionId = `review_selection_action_${safeId(input.pair.pairId, "pair")}_${input.winnerVersion.toLowerCase()}_${attemptId}`;
  const confirmation: AgentDirectorReviewSelectionConfirmation = {
    confirmationId,
    actionId,
    projectId: input.pair.projectId,
    projectRoot: input.pair.projectRoot,
    projectFactHash: input.pair.projectFactHash,
    pairId: input.pair.pairId,
    shotId: input.pair.shotId,
    winnerVersion: input.winnerVersion,
    winner,
    loser,
    status: "waiting",
    createdAt: generatedAt,
  };
  return {
    ok: true,
    ledger: {
      ...input.ledger,
      updatedAt: generatedAt,
      selectionConfirmations: [
        ...input.ledger.selectionConfirmations.map((item) => item.status === "waiting" && item.pairId === input.pair.pairId
          ? { ...item, status: "cancelled" as const, resolvedAt: generatedAt }
          : item),
        confirmation,
      ],
      promotionConfirmations: input.ledger.promotionConfirmations.map((item) => item.status === "waiting" && item.pairId === input.pair.pairId
        ? { ...item, status: "cancelled" as const, resolvedAt: generatedAt }
        : item),
    },
    confirmation,
    blockers: [],
  };
}

export function cancelAgentDirectorReviewSelectionConfirmation(input: {
  ledger: AgentDirectorReviewSelectionLedger;
  confirmationId: string;
  generatedAt?: string;
}): AgentDirectorReviewSelectionMutationResult {
  const confirmation = input.ledger.selectionConfirmations.find((item) => item.confirmationId === input.confirmationId);
  if (!confirmation) return { ok: false, ledger: input.ledger, blockers: ["review_selection_confirmation_missing"] };
  if (confirmation.status === "cancelled") return { ok: true, ledger: input.ledger, confirmation, blockers: [] };
  if (confirmation.status !== "waiting") return { ok: false, ledger: input.ledger, blockers: ["review_selection_confirmation_not_waiting"] };
  const generatedAt = input.generatedAt || new Date().toISOString();
  const nextConfirmation = { ...confirmation, status: "cancelled" as const, resolvedAt: generatedAt };
  return {
    ok: true,
    ledger: {
      ...input.ledger,
      updatedAt: generatedAt,
      selectionConfirmations: input.ledger.selectionConfirmations.map((item) => item.confirmationId === confirmation.confirmationId ? nextConfirmation : item),
    },
    confirmation: nextConfirmation,
    blockers: [],
  };
}

export function confirmAgentDirectorReviewSelection(input: {
  ledger: AgentDirectorReviewSelectionLedger;
  pair: AgentDirectorReviewVersionPair;
  confirmationId: string;
  reviewerId: string;
  generatedAt?: string;
}): AgentDirectorReviewSelectionMutationResult {
  const confirmation = input.ledger.selectionConfirmations.find((item) => item.confirmationId === input.confirmationId);
  if (!confirmation) return { ok: false, ledger: input.ledger, blockers: ["review_selection_confirmation_missing"] };
  if (!pairMatchesLedger(input.pair, input.ledger) || !confirmationMatchesPair(confirmation, input.pair)) {
    return { ok: false, ledger: input.ledger, blockers: ["review_selection_confirmation_stale"] };
  }
  const receiptId = `review_selection_receipt_${safeId(confirmation.confirmationId, "confirmation")}`;
  const existingReceipt = input.ledger.selectionReceipts.find((receipt) => receipt.receiptId === receiptId);
  if (confirmation.status === "resolved" && existingReceipt && selectionReceiptMatchesPair(existingReceipt, input.pair)) {
    return { ok: true, ledger: input.ledger, confirmation, receipt: existingReceipt, blockers: [] };
  }
  if (confirmation.status !== "waiting") {
    return { ok: false, ledger: input.ledger, blockers: ["review_selection_confirmation_not_waiting"] };
  }
  if (!text(input.reviewerId)) return { ok: false, ledger: input.ledger, blockers: ["review_selection_reviewer_required"] };
  if (existingReceipt) return { ok: false, ledger: input.ledger, blockers: ["review_selection_receipt_identity_conflict"] };
  const generatedAt = input.generatedAt || new Date().toISOString();
  const receipt: AgentDirectorReviewSelectionReceipt = {
    receiptId,
    confirmationId: confirmation.confirmationId,
    actionId: confirmation.actionId,
    projectId: confirmation.projectId,
    projectRoot: confirmation.projectRoot,
    projectFactHash: confirmation.projectFactHash,
    pairId: confirmation.pairId,
    shotId: confirmation.shotId,
    winnerVersion: confirmation.winnerVersion,
    winner: confirmation.winner,
    loser: confirmation.loser,
    status: "selected",
    reviewerId: text(input.reviewerId),
    humanReviewed: true,
    promotionAuthorized: false,
    selectedAt: generatedAt,
  };
  const resolvedConfirmation = { ...confirmation, status: "resolved" as const, resolvedAt: generatedAt };
  return {
    ok: true,
    ledger: {
      ...input.ledger,
      updatedAt: generatedAt,
      selectionConfirmations: input.ledger.selectionConfirmations.map((item) => item.confirmationId === confirmation.confirmationId ? resolvedConfirmation : item),
      selectionReceipts: [...input.ledger.selectionReceipts, receipt],
      promotionConfirmations: input.ledger.promotionConfirmations.map((item) => item.status === "waiting" && item.pairId === input.pair.pairId
        ? { ...item, status: "cancelled" as const, resolvedAt: generatedAt }
        : item),
    },
    confirmation: resolvedConfirmation,
    receipt,
    blockers: [],
  };
}

export function stageAgentDirectorReviewPromotion(input: {
  ledger: AgentDirectorReviewSelectionLedger;
  pair: AgentDirectorReviewVersionPair;
  selectionReceiptId: string;
  generatedAt?: string;
}): AgentDirectorReviewSelectionMutationResult {
  if (!pairMatchesLedger(input.pair, input.ledger)) {
    return { ok: false, ledger: input.ledger, blockers: ["review_promotion_pair_identity_mismatch"] };
  }
  const latestReceipt = latestSelectionReceipt(input.ledger, input.pair);
  if (!latestReceipt || latestReceipt.receiptId !== input.selectionReceiptId) {
    return { ok: false, ledger: input.ledger, blockers: ["review_promotion_latest_selection_required"] };
  }
  const confirmationId = `review_promotion_confirmation_${safeId(latestReceipt.receiptId, "selection")}`;
  const actionId = `review_promotion_action_${safeId(latestReceipt.receiptId, "selection")}`;
  const existing = input.ledger.promotionConfirmations.find((confirmation) => confirmation.confirmationId === confirmationId);
  if (existing) {
    return promotionConfirmationMatchesSelection(existing, input.pair, latestReceipt) && existing.actionId === actionId
      ? { ok: true, ledger: input.ledger, receipt: latestReceipt, promotionConfirmation: existing, blockers: [] }
      : { ok: false, ledger: input.ledger, blockers: ["review_promotion_confirmation_identity_conflict"] };
  }
  const generatedAt = input.generatedAt || new Date().toISOString();
  const confirmation: AgentDirectorReviewPromotionConfirmation = {
    confirmationId,
    actionId,
    projectId: latestReceipt.projectId,
    projectRoot: latestReceipt.projectRoot,
    projectFactHash: latestReceipt.projectFactHash,
    pairId: latestReceipt.pairId,
    shotId: latestReceipt.shotId,
    selectionReceiptId: latestReceipt.receiptId,
    winnerVersion: latestReceipt.winnerVersion,
    winner: latestReceipt.winner,
    status: "waiting",
    createdAt: generatedAt,
  };
  return {
    ok: true,
    ledger: {
      ...input.ledger,
      updatedAt: generatedAt,
      promotionConfirmations: [...input.ledger.promotionConfirmations, confirmation],
    },
    receipt: latestReceipt,
    promotionConfirmation: confirmation,
    blockers: [],
  };
}

export function cancelAgentDirectorReviewPromotionConfirmation(input: {
  ledger: AgentDirectorReviewSelectionLedger;
  confirmationId: string;
  generatedAt?: string;
}): AgentDirectorReviewSelectionMutationResult {
  const confirmation = input.ledger.promotionConfirmations.find((item) => item.confirmationId === input.confirmationId);
  if (!confirmation) return { ok: false, ledger: input.ledger, blockers: ["review_promotion_confirmation_missing"] };
  if (confirmation.status === "cancelled") return { ok: true, ledger: input.ledger, promotionConfirmation: confirmation, blockers: [] };
  if (confirmation.status !== "waiting") return { ok: false, ledger: input.ledger, blockers: ["review_promotion_confirmation_not_waiting"] };
  const generatedAt = input.generatedAt || new Date().toISOString();
  const nextConfirmation = { ...confirmation, status: "cancelled" as const, resolvedAt: generatedAt };
  return {
    ok: true,
    ledger: {
      ...input.ledger,
      updatedAt: generatedAt,
      promotionConfirmations: input.ledger.promotionConfirmations.map((item) => item.confirmationId === confirmation.confirmationId ? nextConfirmation : item),
    },
    promotionConfirmation: nextConfirmation,
    blockers: [],
  };
}

function projectRelativeOutputPath(projectRoot: string, outputPath: string) {
  const root = normalizeAgentDirectorReviewProjectRoot(projectRoot);
  const output = normalizeAgentDirectorReviewOutputPath(outputPath);
  if (!root || !output.startsWith(`${root}/`)) return "";
  const relativePath = output.slice(root.length + 1);
  return relativePath && !/(?:^|\/)\.\.(?:\/|$)/.test(relativePath) ? relativePath : "";
}

function promotionReceiptMatches(
  receipt: ProjectVibeReviewReceipt,
  selection: AgentDirectorReviewSelectionReceipt,
  confirmation: AgentDirectorReviewPromotionConfirmation,
  outputPath: string,
) {
  return receipt.decisionScope === "agent_video_promotion"
    && receipt.status === "approved"
    && receipt.projectId === selection.projectId
    && normalizeAgentDirectorReviewProjectRoot(receipt.projectRoot || "") === normalizeAgentDirectorReviewProjectRoot(selection.projectRoot)
    && receipt.projectFactHash === selection.projectFactHash
    && receipt.jobId === selection.winner.jobId
    && receipt.actionId === selection.winner.actionId
    && receipt.shotId === selection.shotId
    && receipt.sourceReceiptId === selection.winner.sourceReceiptId
    && normalizeAgentDirectorReviewOutputPath(receipt.outputPath || "") === normalizeAgentDirectorReviewOutputPath(outputPath)
    && normalizeAgentDirectorReviewOutputHash(receipt.outputHash || "") === normalizeAgentDirectorReviewOutputHash(selection.winner.outputHash)
    && receipt.selectionReceiptId === selection.receiptId
    && receipt.versionPairId === selection.pairId
    && receipt.winnerVersion === selection.winnerVersion
    && receipt.promotionActionId === confirmation.actionId
    && receipt.promotionConfirmationId === confirmation.confirmationId
    && receipt.humanReviewed === true
    && receipt.promotionAuthorized === true;
}

export function buildAgentDirectorReviewPromotionTransaction(input: {
  project: ProjectVibeDocument;
  projectRoot: string;
  pair: AgentDirectorReviewVersionPair;
  ledger: AgentDirectorReviewSelectionLedger;
  promotionConfirmationId: string;
  reviewerId: string;
  generatedAt?: string;
}): AgentDirectorReviewPromotionTransactionResult {
  const confirmation = input.ledger.promotionConfirmations.find((item) => item.confirmationId === input.promotionConfirmationId);
  if (!confirmation) return { status: "blocked", blockers: ["review_promotion_confirmation_missing"] };
  const selection = input.ledger.selectionReceipts.find((receipt) => receipt.receiptId === confirmation.selectionReceiptId);
  if (!selection || !selectionReceiptMatchesPair(selection, input.pair)) {
    return { status: "blocked", blockers: ["review_promotion_selection_identity_invalid"] };
  }
  if (!promotionConfirmationMatchesSelection(confirmation, input.pair, selection)) {
    return { status: "blocked", blockers: ["review_promotion_confirmation_identity_invalid"] };
  }
  const outputPath = projectRelativeOutputPath(input.projectRoot, selection.winner.outputPath);
  if (!outputPath) return { status: "blocked", selectionReceipt: selection, blockers: ["review_promotion_output_path_invalid"] };
  const promotionReceiptId = `review_promotion_receipt_${safeId(selection.receiptId, "selection")}`;
  const existingReceipt = input.project.receipts?.reviewReceipts.find((receipt) => receipt.id === promotionReceiptId);
  if (existingReceipt) {
    return promotionReceiptMatches(existingReceipt, selection, confirmation, outputPath)
      ? { status: "already_promoted", promotionReceipt: existingReceipt, selectionReceipt: selection, blockers: [] }
      : { status: "blocked", selectionReceipt: selection, blockers: ["review_promotion_receipt_identity_conflict"] };
  }
  if (confirmation.status !== "waiting") {
    return { status: "blocked", selectionReceipt: selection, blockers: ["review_promotion_confirmation_not_waiting"] };
  }
  if (!text(input.reviewerId)) return { status: "blocked", selectionReceipt: selection, blockers: ["review_promotion_reviewer_required"] };
  if (!pairMatchesLedger(input.pair, input.ledger)) {
    return { status: "blocked", selectionReceipt: selection, blockers: ["review_promotion_pair_identity_mismatch"] };
  }
  const sourceFactHash = hashProjectVibeFacts(input.project);
  if (
    input.project.manifest.projectId !== selection.projectId
    || normalizeAgentDirectorReviewProjectRoot(input.projectRoot) !== normalizeAgentDirectorReviewProjectRoot(selection.projectRoot)
    || sourceFactHash !== selection.projectFactHash
  ) {
    return { status: "blocked", selectionReceipt: selection, blockers: ["review_promotion_current_project_fact_mismatch"] };
  }
  const generatedAt = input.generatedAt || new Date().toISOString();
  const promotionReceipt: ProjectVibeReviewReceipt = {
    id: promotionReceiptId,
    createdAt: generatedAt,
    status: "approved",
    decisionScope: "agent_video_promotion",
    projectId: selection.projectId,
    projectRoot: selection.projectRoot,
    projectFactHash: selection.projectFactHash,
    jobId: selection.winner.jobId,
    actionId: selection.winner.actionId,
    selectionReceiptId: selection.receiptId,
    versionPairId: selection.pairId,
    winnerVersion: selection.winnerVersion,
    promotionActionId: confirmation.actionId,
    promotionConfirmationId: confirmation.confirmationId,
    reviewerId: text(input.reviewerId),
    humanReviewed: true,
    shotId: selection.shotId,
    sourceReceiptId: selection.winner.sourceReceiptId,
    outputPath,
    outputHash: selection.winner.outputHash,
    retryRequested: false,
    lateOutput: false,
    providerSelfReportIgnored: true,
    promotionAuthorized: true,
    promotionAuthorizedBy: text(input.reviewerId),
    promotionAuthorizedAt: generatedAt,
    evidenceRefs: [
      `version_pair#${selection.pairId}`,
      `selection_receipt#${selection.receiptId}`,
      `selection_confirmation#${selection.confirmationId}`,
      `promotion_confirmation#${confirmation.confirmationId}`,
      `promotion_action#${confirmation.actionId}`,
      `generation_job#${selection.winner.jobId}`,
      `generation_action#${selection.winner.actionId}`,
      `receipt#${selection.winner.sourceReceiptId}`,
      `project_output#${outputPath}`,
      `output_hash#${selection.winner.outputHash}`,
    ],
    blockers: [],
  };
  return {
    status: "staged",
    promotionReceipt,
    selectionReceipt: selection,
    transaction: {
      id: `txn_${promotionReceiptId}`,
      actor: "user",
      reason: "Promote the explicitly selected and human-reviewed video version to Project.vibe facts.",
      createdAt: generatedAt,
      operations: [{ op: "append_review_receipt", receipt: promotionReceipt }],
    },
    blockers: [],
  };
}

export function validateAgentDirectorReviewSelectionLedger(value: unknown) {
  const blockers: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return ["review_selection_ledger_invalid"];
  }
  const ledger = value as Partial<AgentDirectorReviewSelectionLedger>;
  if (ledger.schemaVersion !== AGENT_DIRECTOR_REVIEW_SELECTION_LEDGER_SCHEMA_VERSION) blockers.push("review_selection_ledger_schema_invalid");
  for (const key of ["ledgerId", "projectId", "projectRoot", "projectFactHash", "createdAt", "updatedAt"] as const) {
    if (!text(ledger[key])) blockers.push(`review_selection_ledger_${key}_required`);
  }
  if (!validDate(ledger.createdAt) || !validDate(ledger.updatedAt)) blockers.push("review_selection_ledger_timestamp_invalid");
  if (!Array.isArray(ledger.selectionConfirmations) || !Array.isArray(ledger.selectionReceipts) || !Array.isArray(ledger.promotionConfirmations)) {
    blockers.push("review_selection_ledger_collections_invalid");
    return blockers;
  }
  const ids = new Set<string>();
  for (const confirmation of ledger.selectionConfirmations) {
    if (!confirmation || typeof confirmation !== "object") {
      blockers.push("review_selection_confirmation_invalid");
      continue;
    }
    if (!text(confirmation.confirmationId) || ids.has(confirmation.confirmationId)) blockers.push("review_selection_confirmation_id_invalid");
    ids.add(confirmation.confirmationId);
    if (!text(confirmation.actionId) || !["waiting", "resolved", "cancelled"].includes(confirmation.status)) blockers.push("review_selection_confirmation_state_invalid");
    if (!validDate(confirmation.createdAt) || validateAgentDirectorReviewIdentity(confirmation.winner).length || validateAgentDirectorReviewIdentity(confirmation.loser).length) blockers.push("review_selection_confirmation_identity_invalid");
    if (!identityMatches(confirmation, ledger as AgentDirectorReviewSelectionLedger)) blockers.push("review_selection_confirmation_project_mismatch");
  }
  for (const receipt of ledger.selectionReceipts) {
    if (!receipt || typeof receipt !== "object") {
      blockers.push("review_selection_receipt_invalid");
      continue;
    }
    if (!text(receipt.receiptId) || ids.has(receipt.receiptId)) blockers.push("review_selection_receipt_id_invalid");
    ids.add(receipt.receiptId);
    if (receipt.status !== "selected" || receipt.humanReviewed !== true || receipt.promotionAuthorized !== false || !text(receipt.reviewerId)) blockers.push("review_selection_receipt_state_invalid");
    if (!validDate(receipt.selectedAt) || validateAgentDirectorReviewIdentity(receipt.winner).length || validateAgentDirectorReviewIdentity(receipt.loser).length) blockers.push("review_selection_receipt_identity_invalid");
    if (!identityMatches(receipt, ledger as AgentDirectorReviewSelectionLedger)) blockers.push("review_selection_receipt_project_mismatch");
  }
  for (const confirmation of ledger.promotionConfirmations) {
    if (!confirmation || typeof confirmation !== "object") {
      blockers.push("review_promotion_confirmation_invalid");
      continue;
    }
    if (!text(confirmation.confirmationId) || ids.has(confirmation.confirmationId)) blockers.push("review_promotion_confirmation_id_invalid");
    ids.add(confirmation.confirmationId);
    if (!text(confirmation.actionId) || !text(confirmation.selectionReceiptId) || !["waiting", "resolved", "cancelled"].includes(confirmation.status)) blockers.push("review_promotion_confirmation_state_invalid");
    if (!validDate(confirmation.createdAt) || validateAgentDirectorReviewIdentity(confirmation.winner).length) blockers.push("review_promotion_confirmation_identity_invalid");
    if (!identityMatches(confirmation, ledger as AgentDirectorReviewSelectionLedger)) blockers.push("review_promotion_confirmation_project_mismatch");
  }
  return Array.from(new Set(blockers));
}

export function agentDirectorReviewSelectionIdentityKey(identity: AgentDirectorReviewSelectionReceipt) {
  return [
    identity.receiptId,
    identity.confirmationId,
    identity.actionId,
    identity.projectId,
    normalizeAgentDirectorReviewProjectRoot(identity.projectRoot),
    identity.projectFactHash,
    identity.pairId,
    identity.shotId,
    identity.winnerVersion,
    agentDirectorReviewIdentityKey(identity.winner),
    agentDirectorReviewIdentityKey(identity.loser),
  ].join("::");
}
