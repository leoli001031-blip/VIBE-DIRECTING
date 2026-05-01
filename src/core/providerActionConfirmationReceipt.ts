import type { ProviderSlot, RequiredMode } from "./types";
import type {
  ProviderExecutionPermissionGateState,
  ProviderExecutionPermissionRequest,
} from "./providerExecutionPermissionGate";

export const providerActionConfirmationReceiptSchemaVersion = "0.1.0";

export type ProviderActionConfirmationReceiptStatus = "ready_for_receipt" | "blocked" | "parked";
export type ProviderActionConfirmationReceiptKind = "action_time_user_confirmation_receipt";
export type ProviderActionConfirmationReceiptReviewStep =
  | "review_phase31_permission_request"
  | "collect_action_time_confirmation"
  | "record_confirmation_receipt"
  | "hold_for_final_execution_gate";

export interface ProviderActionConfirmationReceiptRequest {
  requestId: string;
  sourcePermissionRequestId: string;
  sourceGateId: string;
  sourceId: string;
  providerId: string;
  slot: ProviderSlot;
  requiredMode: RequiredMode;
  shotId?: string;
  receiptId: string;
  status: ProviderActionConfirmationReceiptStatus;
  blockers: string[];
  warnings: string[];
  reviewOrder: ProviderActionConfirmationReceiptReviewStep[];
  canRecordReceipt: boolean;
  confirmationReceiptRequired: true;
  confirmationReceiptPlaceholderPresent: true;
  actionTimeConfirmationRequired: true;
  userConfirmedAtActionTime: false;
  confirmedReceiptCount: 0;
  finalExecutionGateRequired: true;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  automaticSubmitAllowed: false;
  credentialStorage: false;
  dryRunOnly: true;
  readOnly: true;
  noCredentialRead: true;
  noCredentialWrite: true;
  noApiKeyCreation: true;
  noArbitraryProviderCommand: true;
  noWorkerSpawn: true;
  noFileMutation: true;
}

export interface ProviderActionConfirmationReceipt {
  receiptId: string;
  sourcePermissionRequestId: string;
  sourceGateId: string;
  sourceId: string;
  providerId: string;
  slot: ProviderSlot;
  requiredMode: RequiredMode;
  shotId?: string;
  status: ProviderActionConfirmationReceiptStatus;
  receiptKind: ProviderActionConfirmationReceiptKind;
  placeholderPresent: true;
  typedEvidencePresent: true;
  confirmationRequired: true;
  actionTimeConfirmationRequired: true;
  userConfirmedAtActionTime: false;
  confirmed: false;
  confirmedReceiptCount: 0;
  finalExecutionGateRequired: true;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  automaticSubmitAllowed: false;
  credentialStorage: false;
  dryRunOnly: true;
  readOnly: true;
  noCredentialRead: true;
  noCredentialWrite: true;
  noApiKeyCreation: true;
  noArbitraryProviderCommand: true;
  noWorkerSpawn: true;
  noFileMutation: true;
  blockers: string[];
  warnings: string[];
}

export interface ProviderActionConfirmationReceiptHardLocks {
  dryRunOnly: true;
  readOnly: true;
  reviewShellOnly: true;
  receiptPlanOnly: true;
  actionTimeConfirmationRequired: true;
  finalExecutionGateRequired: true;
  providerSubmissionForbidden: true;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  automaticSubmitAllowed: false;
  credentialStorage: false;
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

export interface ProviderActionConfirmationReceiptPhase32Evidence {
  phaseId: "phase_32_action_time_confirmation_receipt";
  typedEvidencePresent: true;
  phase31GateConsumed: boolean;
  phase31RequestsMirrored: number;
  receiptPlaceholdersPresent: true;
  defaultUserConfirmedAtActionTime: false;
  confirmedReceiptCount: 0;
  actionTimeConfirmationRequired: true;
  finalExecutionGateRequired: true;
  automaticSubmitForbidden: true;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  noWorkerSpawn: true;
  noFileMutation: true;
}

export interface ProviderActionConfirmationReceiptState {
  schemaVersion: string;
  generatedAt: string;
  phase: "phase_32_action_time_confirmation_receipt";
  requests: ProviderActionConfirmationReceiptRequest[];
  receipts: ProviderActionConfirmationReceipt[];
  summary: {
    totalRequests: number;
    readyForReceipt: number;
    blocked: number;
    parked: number;
    totalReceipts: number;
    receiptPlaceholderCount: number;
    confirmedReceiptCount: 0;
    canRecordReceipt: number;
    userConfirmedAtActionTime: false;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
    credentialAccessAllowed: false;
    automaticSubmitAllowed: false;
  };
  hardLocks: ProviderActionConfirmationReceiptHardLocks;
  phase32Evidence: ProviderActionConfirmationReceiptPhase32Evidence;
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

export interface BuildProviderActionConfirmationReceiptStateInput {
  generatedAt: string;
  providerExecutionPermissionGate: ProviderExecutionPermissionGateState;
}

const hardLocks: ProviderActionConfirmationReceiptHardLocks = {
  dryRunOnly: true,
  readOnly: true,
  reviewShellOnly: true,
  receiptPlanOnly: true,
  actionTimeConfirmationRequired: true,
  finalExecutionGateRequired: true,
  providerSubmissionForbidden: true,
  canSubmitProvider: false,
  providerSubmitAllowed: 0,
  liveSubmitAllowed: false,
  credentialAccessAllowed: false,
  automaticSubmitAllowed: false,
  credentialStorage: false,
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

const forbiddenActions: ProviderActionConfirmationReceiptState["forbiddenActions"] = [
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

const reviewOrder: ProviderActionConfirmationReceiptReviewStep[] = [
  "review_phase31_permission_request",
  "collect_action_time_confirmation",
  "record_confirmation_receipt",
  "hold_for_final_execution_gate",
];

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function isPhase31GateConsumed(gate: ProviderExecutionPermissionGateState): boolean {
  return gate.phase === "phase_31_provider_execution_permission_gate";
}

function isPhase31GateStillLocked(gate: ProviderExecutionPermissionGateState): boolean {
  return gate.summary.providerSubmitAllowed === 0
    && gate.summary.liveSubmitAllowed === false
    && gate.summary.credentialAccessAllowed === false
    && gate.summary.automaticSubmitAllowed === false
    && gate.hardLocks.providerSubmissionForbidden === true
    && gate.hardLocks.canSubmitProvider === false
    && gate.hardLocks.providerSubmitAllowed === 0
    && gate.hardLocks.liveSubmitAllowed === false
    && gate.hardLocks.credentialAccessAllowed === false
    && gate.hardLocks.credentialStorage === false
    && gate.hardLocks.noCredentialRead === true
    && gate.hardLocks.noCredentialWrite === true
    && gate.hardLocks.noApiKeyCreation === true
    && gate.hardLocks.noArbitraryProviderCommand === true
    && gate.hardLocks.noWorkerSpawn === true
    && gate.hardLocks.noFileMutation === true
    && gate.phase31Evidence.actionTimeUserConfirmationRequired === true
    && gate.phase31Evidence.automaticSubmitForbidden === true
    && gate.phase31Evidence.canSubmitProvider === false
    && gate.phase31Evidence.providerSubmitAllowed === 0
    && gate.phase31Evidence.liveSubmitAllowed === false
    && gate.phase31Evidence.credentialAccessAllowed === false
    && gate.phase31Evidence.noWorkerSpawn === true
    && gate.phase31Evidence.noFileMutation === true;
}

function isRequestPathStillLocked(request: ProviderExecutionPermissionRequest): boolean {
  return request.canSubmitProvider === false
    && request.providerSubmitAllowed === 0
    && request.liveSubmitAllowed === false
    && request.credentialAccessAllowed === false
    && request.credentialStorage === false
    && request.dryRunOnly === true
    && request.readOnly === true
    && request.noWorkerSpawn === true
    && request.noFileMutation === true;
}

function classifyRequest(
  request: ProviderExecutionPermissionRequest,
  gate: ProviderExecutionPermissionGateState,
): ProviderActionConfirmationReceiptStatus {
  const phase31GateConsumed = isPhase31GateConsumed(gate);
  const gateLocked = isPhase31GateStillLocked(gate);
  const requestLocked = isRequestPathStillLocked(request);
  const actionTimeRequired = request.actionTimeConfirmationRequired === true;
  const startsEmpty = request.userConfirmedAtActionTime === false;

  if (
    request.status === "ready_for_user_review"
    && phase31GateConsumed
    && gateLocked
    && requestLocked
    && actionTimeRequired
    && startsEmpty
  ) {
    return "ready_for_receipt";
  }

  return "blocked";
}

function buildBlockers(
  request: ProviderExecutionPermissionRequest,
  gate: ProviderExecutionPermissionGateState,
): string[] {
  return uniqueSorted([
    ...request.blockers,
    ...(!isPhase31GateConsumed(gate) ? ["Phase 31 permission gate was not consumed."] : []),
    ...(!isPhase31GateStillLocked(gate) ? ["Phase 31 global provider, live, credential, worker, or file locks drifted."] : []),
    ...(request.status !== "ready_for_user_review" ? ["Phase 31 request is not ready for action-time receipt review."] : []),
    ...(request.status === "parked" ? ["Phase 31 request is parked and cannot record an action-time receipt."] : []),
    ...(!isRequestPathStillLocked(request) ? ["Source request provider, live, credential, worker, or file locks drifted."] : []),
    ...(request.actionTimeConfirmationRequired !== true ? ["Action-time confirmation is not required by the source request."] : []),
    ...(request.userConfirmedAtActionTime !== false ? ["Source request must enter Phase 32 with no action-time user confirmation recorded."] : []),
  ]);
}

function buildReceiptId(sourcePermissionRequestId: string): string {
  return `provider_action_confirmation_receipt_${safeId(sourcePermissionRequestId)}`;
}

function buildRequest(
  sourceRequest: ProviderExecutionPermissionRequest,
  gate: ProviderExecutionPermissionGateState,
): ProviderActionConfirmationReceiptRequest {
  const status = classifyRequest(sourceRequest, gate);
  const receiptId = buildReceiptId(sourceRequest.requestId);

  return {
    requestId: `provider_action_confirmation_receipt_request_${safeId(sourceRequest.requestId)}`,
    sourcePermissionRequestId: sourceRequest.requestId,
    sourceGateId: sourceRequest.sourceGateId,
    sourceId: sourceRequest.sourceId,
    providerId: sourceRequest.providerId,
    slot: sourceRequest.slot,
    requiredMode: sourceRequest.requiredMode,
    shotId: sourceRequest.shotId,
    receiptId,
    status,
    blockers: buildBlockers(sourceRequest, gate),
    warnings: sourceRequest.warnings,
    reviewOrder,
    canRecordReceipt: status === "ready_for_receipt",
    confirmationReceiptRequired: true,
    confirmationReceiptPlaceholderPresent: true,
    actionTimeConfirmationRequired: true,
    userConfirmedAtActionTime: false,
    confirmedReceiptCount: 0,
    finalExecutionGateRequired: true,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    credentialAccessAllowed: false,
    automaticSubmitAllowed: false,
    credentialStorage: false,
    dryRunOnly: true,
    readOnly: true,
    noCredentialRead: true,
    noCredentialWrite: true,
    noApiKeyCreation: true,
    noArbitraryProviderCommand: true,
    noWorkerSpawn: true,
    noFileMutation: true,
  };
}

function buildReceipt(
  request: ProviderActionConfirmationReceiptRequest,
): ProviderActionConfirmationReceipt {
  return {
    receiptId: request.receiptId,
    sourcePermissionRequestId: request.sourcePermissionRequestId,
    sourceGateId: request.sourceGateId,
    sourceId: request.sourceId,
    providerId: request.providerId,
    slot: request.slot,
    requiredMode: request.requiredMode,
    shotId: request.shotId,
    status: request.status,
    receiptKind: "action_time_user_confirmation_receipt",
    placeholderPresent: true,
    typedEvidencePresent: true,
    confirmationRequired: true,
    actionTimeConfirmationRequired: true,
    userConfirmedAtActionTime: false,
    confirmed: false,
    confirmedReceiptCount: 0,
    finalExecutionGateRequired: true,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    credentialAccessAllowed: false,
    automaticSubmitAllowed: false,
    credentialStorage: false,
    dryRunOnly: true,
    readOnly: true,
    noCredentialRead: true,
    noCredentialWrite: true,
    noApiKeyCreation: true,
    noArbitraryProviderCommand: true,
    noWorkerSpawn: true,
    noFileMutation: true,
    blockers: request.blockers,
    warnings: request.warnings,
  };
}

export function buildProviderActionConfirmationReceiptState(
  input: BuildProviderActionConfirmationReceiptStateInput,
): ProviderActionConfirmationReceiptState {
  const gate = input.providerExecutionPermissionGate;
  const requests = gate.requests.map((request) => buildRequest(request, gate));
  const receipts = requests.map((request) => buildReceipt(request));
  const readyForReceipt = requests.filter((request) => request.status === "ready_for_receipt").length;
  const blocked = requests.filter((request) => request.status === "blocked").length;
  const parked = requests.filter((request) => request.status === "parked").length;

  return {
    schemaVersion: providerActionConfirmationReceiptSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "phase_32_action_time_confirmation_receipt",
    requests,
    receipts,
    summary: {
      totalRequests: requests.length,
      readyForReceipt,
      blocked,
      parked,
      totalReceipts: receipts.length,
      receiptPlaceholderCount: receipts.filter((receipt) => receipt.placeholderPresent).length,
      confirmedReceiptCount: 0,
      canRecordReceipt: requests.filter((request) => request.canRecordReceipt).length,
      userConfirmedAtActionTime: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      automaticSubmitAllowed: false,
    },
    hardLocks,
    phase32Evidence: {
      phaseId: "phase_32_action_time_confirmation_receipt",
      typedEvidencePresent: true,
      phase31GateConsumed: isPhase31GateConsumed(gate),
      phase31RequestsMirrored: gate.requests.length,
      receiptPlaceholdersPresent: true,
      defaultUserConfirmedAtActionTime: false,
      confirmedReceiptCount: 0,
      actionTimeConfirmationRequired: true,
      finalExecutionGateRequired: true,
      automaticSubmitForbidden: true,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      noWorkerSpawn: true,
      noFileMutation: true,
    },
    forbiddenActions,
    notes: [
      "Phase 32 creates typed action-time confirmation receipt placeholders from Phase 31 requests.",
      "A ready_for_receipt request may record receipt evidence only; it still cannot submit providers.",
      "Provider execution remains blocked until a later final execution gate explicitly permits it.",
    ],
  };
}
