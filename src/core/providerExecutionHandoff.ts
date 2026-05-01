import type { ProviderSlot, RequiredMode } from "./types";
import type {
  ProviderActionConfirmationReceipt,
  ProviderActionConfirmationReceiptRequest,
  ProviderActionConfirmationReceiptState,
} from "./providerActionConfirmationReceipt";

export const providerExecutionHandoffSchemaVersion = "0.1.0";

export type ProviderExecutionHandoffStatus =
  | "blocked_missing_action_confirmation"
  | "ready_for_final_user_handoff_review"
  | "blocked";

export type ProviderExecutionHandoffReviewStep =
  | "review_action_time_confirmation_receipt"
  | "review_provider_execution_handoff_plan"
  | "final_user_handoff_review"
  | "hold_provider_execution";

export interface ProviderExecutionHandoffItem {
  handoffId: string;
  sourceActionConfirmationRequestId: string;
  sourcePermissionRequestId: string;
  sourceReceiptId?: string;
  sourceGateId: string;
  sourceId: string;
  providerId: string;
  slot: ProviderSlot;
  requiredMode: RequiredMode;
  shotId?: string;
  status: ProviderExecutionHandoffStatus;
  blockers: string[];
  warnings: string[];
  reviewOrder: ProviderExecutionHandoffReviewStep[];
  receiptConfirmed: boolean;
  userConfirmedAtActionTime: boolean;
  confirmedReceiptCount: number;
  canEnterFinalUserHandoffReview: boolean;
  finalActionGateRequired: true;
  finalUserReviewRequired: true;
  handoffPlanOnly: true;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  automaticSubmitAllowed: false;
  canSpawnWorker: false;
  fileMutationAllowed: false;
  dryRunOnly: true;
  readOnly: true;
  noProviderSubmit: true;
  noCredentialRead: true;
  noCredentialWrite: true;
  noApiKeyCreation: true;
  noArbitraryProviderCommand: true;
  noWorkerSpawn: true;
  noFileMutation: true;
  fastModelForbidden: true;
  vipChannelForbidden: true;
  textToVideoMainPathForbidden: true;
  bgmInVideoPromptForbidden: true;
}

export interface ProviderExecutionHandoffHardLocks {
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  automaticSubmitAllowed: false;
  canSpawnWorker: false;
  fileMutationAllowed: false;
  dryRunOnly: true;
  readOnly: true;
  handoffPlanOnly: true;
  finalActionGateRequired: true;
  noProviderSubmit: true;
  noCredentialRead: true;
  noCredentialWrite: true;
  noApiKeyCreation: true;
  noArbitraryProviderCommand: true;
  noWorkerSpawn: true;
  noFileMutation: true;
  fastModelForbidden: true;
  vipChannelForbidden: true;
  textToVideoMainPathForbidden: true;
  bgmInVideoPromptForbidden: true;
}

export interface ProviderExecutionHandoffPhase33Evidence {
  phaseId: "phase_33_provider_execution_handoff";
  typedEvidencePresent: true;
  phase32ReceiptStateConsumed: boolean;
  phase32RequestsObserved: number;
  phase32ReceiptsObserved: number;
  confirmedReceiptCountObserved: number;
  userConfirmedAtActionTimeObserved: boolean;
  allPhase32ProviderRoutesClosed: boolean;
  handoffPlanOnly: true;
  finalActionGateRequired: true;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  automaticSubmitAllowed: false;
  canSpawnWorker: false;
  fileMutationAllowed: false;
  noProviderSubmit: true;
  noCredentialRead: true;
  noCredentialWrite: true;
  noApiKeyCreation: true;
  noArbitraryProviderCommand: true;
  noWorkerSpawn: true;
  noFileMutation: true;
}

export interface ProviderExecutionHandoffState {
  schemaVersion: string;
  generatedAt: string;
  phase: "phase_33_provider_execution_handoff";
  status: ProviderExecutionHandoffStatus;
  handoffs: ProviderExecutionHandoffItem[];
  summary: {
    totalHandoffs: number;
    blockedMissingActionConfirmation: number;
    readyForFinalUserHandoffReview: number;
    blocked: number;
    confirmedReceiptCountObserved: number;
    userConfirmedAtActionTimeObserved: boolean;
    canEnterFinalUserHandoffReview: number;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
    credentialAccessAllowed: false;
    automaticSubmitAllowed: false;
    canSpawnWorker: false;
    fileMutationAllowed: false;
    handoffPlanOnly: true;
    finalActionGateRequired: true;
  };
  hardLocks: ProviderExecutionHandoffHardLocks;
  phase33Evidence: ProviderExecutionHandoffPhase33Evidence;
  forbiddenActions: Array<
    | "provider_submit"
    | "automatic_submit"
    | "credential_read"
    | "credential_write"
    | "api_key_create"
    | "arbitrary_provider_command"
    | "worker_spawn"
    | "file_mutation"
    | "fast_model"
    | "vip_channel"
    | "text_to_video_main_path"
    | "bgm_in_video_prompt"
  >;
  notes: string[];
}

export interface BuildProviderExecutionHandoffStateInput {
  generatedAt: string;
  providerActionConfirmationReceipt: ProviderActionConfirmationReceiptState;
}

const hardLocks: ProviderExecutionHandoffHardLocks = {
  canSubmitProvider: false,
  providerSubmitAllowed: 0,
  liveSubmitAllowed: false,
  credentialAccessAllowed: false,
  automaticSubmitAllowed: false,
  canSpawnWorker: false,
  fileMutationAllowed: false,
  dryRunOnly: true,
  readOnly: true,
  handoffPlanOnly: true,
  finalActionGateRequired: true,
  noProviderSubmit: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noApiKeyCreation: true,
  noArbitraryProviderCommand: true,
  noWorkerSpawn: true,
  noFileMutation: true,
  fastModelForbidden: true,
  vipChannelForbidden: true,
  textToVideoMainPathForbidden: true,
  bgmInVideoPromptForbidden: true,
};

const forbiddenActions: ProviderExecutionHandoffState["forbiddenActions"] = [
  "provider_submit",
  "automatic_submit",
  "credential_read",
  "credential_write",
  "api_key_create",
  "arbitrary_provider_command",
  "worker_spawn",
  "file_mutation",
  "fast_model",
  "vip_channel",
  "text_to_video_main_path",
  "bgm_in_video_prompt",
];

const reviewOrder: ProviderExecutionHandoffReviewStep[] = [
  "review_action_time_confirmation_receipt",
  "review_provider_execution_handoff_plan",
  "final_user_handoff_review",
  "hold_provider_execution",
];

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function trueField(value: unknown, key: string): boolean {
  return record(value)[key] === true;
}

function numberField(value: unknown, key: string): number {
  const raw = record(value)[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function isPhase32ReceiptStateConsumed(state: ProviderActionConfirmationReceiptState): boolean {
  return state.phase === "phase_32_action_time_confirmation_receipt"
    && state.phase32Evidence.typedEvidencePresent === true;
}

function phase32RoutesStillClosed(state: ProviderActionConfirmationReceiptState): boolean {
  return state.summary.providerSubmitAllowed === 0
    && state.summary.liveSubmitAllowed === false
    && state.summary.credentialAccessAllowed === false
    && state.summary.automaticSubmitAllowed === false
    && state.hardLocks.canSubmitProvider === false
    && state.hardLocks.providerSubmitAllowed === 0
    && state.hardLocks.liveSubmitAllowed === false
    && state.hardLocks.credentialAccessAllowed === false
    && state.hardLocks.automaticSubmitAllowed === false
    && state.hardLocks.credentialStorage === false
    && state.hardLocks.noCredentialRead === true
    && state.hardLocks.noCredentialWrite === true
    && state.hardLocks.noApiKeyCreation === true
    && state.hardLocks.noArbitraryProviderCommand === true
    && state.hardLocks.noWorkerSpawn === true
    && state.hardLocks.noFileMutation === true
    && state.hardLocks.fastModelForbidden === true
    && state.hardLocks.vipChannelForbidden === true
    && state.hardLocks.textToVideoMainPathForbidden === true
    && state.hardLocks.bgmInVideoPromptForbidden === true
    && state.phase32Evidence.canSubmitProvider === false
    && state.phase32Evidence.providerSubmitAllowed === 0
    && state.phase32Evidence.liveSubmitAllowed === false
    && state.phase32Evidence.credentialAccessAllowed === false
    && state.phase32Evidence.noWorkerSpawn === true
    && state.phase32Evidence.noFileMutation === true;
}

function requestRoutesStillClosed(request: ProviderActionConfirmationReceiptRequest): boolean {
  return request.canSubmitProvider === false
    && request.providerSubmitAllowed === 0
    && request.liveSubmitAllowed === false
    && request.credentialAccessAllowed === false
    && request.automaticSubmitAllowed === false
    && request.credentialStorage === false
    && request.dryRunOnly === true
    && request.readOnly === true
    && request.noCredentialRead === true
    && request.noCredentialWrite === true
    && request.noApiKeyCreation === true
    && request.noArbitraryProviderCommand === true
    && request.noWorkerSpawn === true
    && request.noFileMutation === true;
}

function receiptRoutesStillClosed(receipt?: ProviderActionConfirmationReceipt): boolean {
  if (!receipt) return false;
  return receipt.canSubmitProvider === false
    && receipt.providerSubmitAllowed === 0
    && receipt.liveSubmitAllowed === false
    && receipt.credentialAccessAllowed === false
    && receipt.automaticSubmitAllowed === false
    && receipt.credentialStorage === false
    && receipt.dryRunOnly === true
    && receipt.readOnly === true
    && receipt.noCredentialRead === true
    && receipt.noCredentialWrite === true
    && receipt.noApiKeyCreation === true
    && receipt.noArbitraryProviderCommand === true
    && receipt.noWorkerSpawn === true
    && receipt.noFileMutation === true;
}

function receiptConfirmedAtActionTime(receipt?: ProviderActionConfirmationReceipt): boolean {
  if (!receipt) return false;
  return trueField(receipt, "confirmed")
    && trueField(receipt, "userConfirmedAtActionTime")
    && numberField(receipt, "confirmedReceiptCount") > 0;
}

function observedConfirmedReceiptCount(state: ProviderActionConfirmationReceiptState): number {
  const receiptCount = state.receipts.filter((receipt) => receiptConfirmedAtActionTime(receipt)).length;
  return Math.max(receiptCount, numberField(state.summary, "confirmedReceiptCount"));
}

function userConfirmedAtActionTimeObserved(state: ProviderActionConfirmationReceiptState): boolean {
  return state.receipts.some((receipt) => trueField(receipt, "userConfirmedAtActionTime"))
    || trueField(state.summary, "userConfirmedAtActionTime");
}

function findReceipt(
  request: ProviderActionConfirmationReceiptRequest,
  state: ProviderActionConfirmationReceiptState,
): ProviderActionConfirmationReceipt | undefined {
  return state.receipts.find((receipt) => receipt.receiptId === request.receiptId)
    ?? state.receipts.find((receipt) => receipt.sourcePermissionRequestId === request.sourcePermissionRequestId);
}

function classifyHandoff(
  request: ProviderActionConfirmationReceiptRequest,
  receipt: ProviderActionConfirmationReceipt | undefined,
  state: ProviderActionConfirmationReceiptState,
): ProviderExecutionHandoffStatus {
  if (
    !isPhase32ReceiptStateConsumed(state)
    || !phase32RoutesStillClosed(state)
    || request.status !== "ready_for_receipt"
    || !requestRoutesStillClosed(request)
    || !receipt
    || receipt.status !== "ready_for_receipt"
    || !receiptRoutesStillClosed(receipt)
  ) {
    return "blocked";
  }

  return receiptConfirmedAtActionTime(receipt)
    ? "ready_for_final_user_handoff_review"
    : "blocked_missing_action_confirmation";
}

function buildBlockers(
  request: ProviderActionConfirmationReceiptRequest,
  receipt: ProviderActionConfirmationReceipt | undefined,
  state: ProviderActionConfirmationReceiptState,
): string[] {
  return uniqueSorted([
    ...request.blockers,
    ...(receipt?.blockers ?? []),
    ...(!isPhase32ReceiptStateConsumed(state) ? ["Phase 32 action-time confirmation receipt state was not consumed."] : []),
    ...(!phase32RoutesStillClosed(state) ? ["Phase 32 provider, live, credential, worker, or file locks drifted."] : []),
    ...(request.status !== "ready_for_receipt" ? ["Phase 32 request is not ready for final execution handoff review."] : []),
    ...(!requestRoutesStillClosed(request) ? ["Phase 32 request provider, live, credential, worker, or file locks drifted."] : []),
    ...(!receipt ? ["Action-time confirmation receipt is missing."] : []),
    ...(receipt && receipt.status !== "ready_for_receipt" ? ["Action-time confirmation receipt is not ready for handoff review."] : []),
    ...(receipt && !receiptRoutesStillClosed(receipt) ? ["Action-time confirmation receipt provider, live, credential, worker, or file locks drifted."] : []),
    ...(receipt && !receiptConfirmedAtActionTime(receipt) ? ["Action-time user confirmation receipt has not been captured."] : []),
  ]);
}

function buildHandoff(
  request: ProviderActionConfirmationReceiptRequest,
  state: ProviderActionConfirmationReceiptState,
): ProviderExecutionHandoffItem {
  const receipt = findReceipt(request, state);
  const status = classifyHandoff(request, receipt, state);
  const receiptConfirmed = receiptConfirmedAtActionTime(receipt);
  const confirmedReceiptCount = receipt ? numberField(receipt, "confirmedReceiptCount") : 0;

  return {
    handoffId: `provider_execution_handoff_${safeId(request.requestId)}`,
    sourceActionConfirmationRequestId: request.requestId,
    sourcePermissionRequestId: request.sourcePermissionRequestId,
    sourceReceiptId: receipt?.receiptId,
    sourceGateId: request.sourceGateId,
    sourceId: request.sourceId,
    providerId: request.providerId,
    slot: request.slot,
    requiredMode: request.requiredMode,
    shotId: request.shotId,
    status,
    blockers: buildBlockers(request, receipt, state),
    warnings: uniqueSorted([...request.warnings, ...(receipt?.warnings ?? [])]),
    reviewOrder,
    receiptConfirmed,
    userConfirmedAtActionTime: receipt ? trueField(receipt, "userConfirmedAtActionTime") : false,
    confirmedReceiptCount,
    canEnterFinalUserHandoffReview: status === "ready_for_final_user_handoff_review",
    finalActionGateRequired: true,
    finalUserReviewRequired: true,
    handoffPlanOnly: true,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    credentialAccessAllowed: false,
    automaticSubmitAllowed: false,
    canSpawnWorker: false,
    fileMutationAllowed: false,
    dryRunOnly: true,
    readOnly: true,
    noProviderSubmit: true,
    noCredentialRead: true,
    noCredentialWrite: true,
    noApiKeyCreation: true,
    noArbitraryProviderCommand: true,
    noWorkerSpawn: true,
    noFileMutation: true,
    fastModelForbidden: true,
    vipChannelForbidden: true,
    textToVideoMainPathForbidden: true,
    bgmInVideoPromptForbidden: true,
  };
}

function aggregateStatus(handoffs: ProviderExecutionHandoffItem[]): ProviderExecutionHandoffStatus {
  if (handoffs.some((handoff) => handoff.status === "blocked")) return "blocked";
  if (
    handoffs.length > 0
    && handoffs.every((handoff) => handoff.status === "ready_for_final_user_handoff_review")
  ) {
    return "ready_for_final_user_handoff_review";
  }
  return "blocked_missing_action_confirmation";
}

export function buildProviderExecutionHandoffState(
  input: BuildProviderExecutionHandoffStateInput,
): ProviderExecutionHandoffState {
  const receiptState = input.providerActionConfirmationReceipt;
  const handoffs = receiptState.requests.map((request) => buildHandoff(request, receiptState));
  const blockedMissingActionConfirmation = handoffs.filter((handoff) => handoff.status === "blocked_missing_action_confirmation").length;
  const readyForFinalUserHandoffReview = handoffs.filter((handoff) => handoff.status === "ready_for_final_user_handoff_review").length;
  const blocked = handoffs.filter((handoff) => handoff.status === "blocked").length;
  const confirmedReceiptCountObserved = observedConfirmedReceiptCount(receiptState);

  return {
    schemaVersion: providerExecutionHandoffSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "phase_33_provider_execution_handoff",
    status: aggregateStatus(handoffs),
    handoffs,
    summary: {
      totalHandoffs: handoffs.length,
      blockedMissingActionConfirmation,
      readyForFinalUserHandoffReview,
      blocked,
      confirmedReceiptCountObserved,
      userConfirmedAtActionTimeObserved: userConfirmedAtActionTimeObserved(receiptState),
      canEnterFinalUserHandoffReview: handoffs.filter((handoff) => handoff.canEnterFinalUserHandoffReview).length,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      automaticSubmitAllowed: false,
      canSpawnWorker: false,
      fileMutationAllowed: false,
      handoffPlanOnly: true,
      finalActionGateRequired: true,
    },
    hardLocks,
    phase33Evidence: {
      phaseId: "phase_33_provider_execution_handoff",
      typedEvidencePresent: true,
      phase32ReceiptStateConsumed: isPhase32ReceiptStateConsumed(receiptState),
      phase32RequestsObserved: receiptState.requests.length,
      phase32ReceiptsObserved: receiptState.receipts.length,
      confirmedReceiptCountObserved,
      userConfirmedAtActionTimeObserved: userConfirmedAtActionTimeObserved(receiptState),
      allPhase32ProviderRoutesClosed: phase32RoutesStillClosed(receiptState),
      handoffPlanOnly: true,
      finalActionGateRequired: true,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      automaticSubmitAllowed: false,
      canSpawnWorker: false,
      fileMutationAllowed: false,
      noProviderSubmit: true,
      noCredentialRead: true,
      noCredentialWrite: true,
      noApiKeyCreation: true,
      noArbitraryProviderCommand: true,
      noWorkerSpawn: true,
      noFileMutation: true,
    },
    forbiddenActions,
    notes: [
      "Phase 33 consumes Phase 32 action-time confirmation receipt evidence and emits a structured final handoff plan only.",
      "A confirmed receipt can make a handoff ready for final user handoff review; it still cannot submit providers.",
      "Provider submit, credential access, worker spawn, file mutation, fast model, VIP channel, text-to-video main path, and BGM-in-video prompts remain forbidden.",
    ],
  };
}
