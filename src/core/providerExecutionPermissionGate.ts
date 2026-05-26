import type { ProviderLiveGateItem, ProviderLiveGateState } from "./providerLiveGate";
import type { CliAdapterSpikeState } from "./cliAdapterSpike";
import type { BaseHardLocks, ProviderSlot, RequiredMode } from "./types";

export const providerExecutionPermissionGateSchemaVersion = "0.1.0";

export type ProviderExecutionPermissionStatus = "ready_for_user_review" | "blocked" | "parked";
export type ProviderExecutionPermissionConfirmationId =
  | "review_provider_packet"
  | "action_time_user_confirmation"
  | "confirm_expected_outputs"
  | "confirm_no_credentials"
  | "confirm_no_fast_vip_t2v_bgm";

export interface ProviderExecutionPermissionConfirmation {
  confirmationId: ProviderExecutionPermissionConfirmationId;
  label: string;
  required: true;
  present: boolean;
  confirmed: boolean;
  blocker?: string;
}

export interface ProviderExecutionPermissionRequest {
  requestId: string;
  sourceGateId: string;
  sourceId: string;
  providerId: string;
  slot: ProviderSlot;
  requiredMode: RequiredMode;
  shotId?: string;
  status: ProviderExecutionPermissionStatus;
  confirmations: ProviderExecutionPermissionConfirmation[];
  blockers: string[];
  warnings: string[];
  executionOrder: Array<
    | "review_provider_packet"
    | "ask_action_time_confirmation"
    | "record_confirmation_receipt"
    | "wait_for_future_execution_gate"
  >;
  canAskUserToConfirm: boolean;
  actionTimeConfirmationRequired: true;
  userConfirmedAtActionTime: false;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  credentialStorage: false;
  dryRunOnly: true;
  readOnly: true;
  noWorkerSpawn: true;
  noFileMutation: true;
}

export interface ProviderExecutionPermissionHardLocks extends BaseHardLocks {
  readOnly: true;
  reviewPlanOnly: true;
  actionTimeConfirmationRequired: true;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  credentialAccessAllowed: false;
  credentialStorage: false;
  noApiKeyCreation: true;
  noArbitraryProviderCommand: true;
  fastModelForbidden: true;
  vipChannelForbidden: true;
  textToVideoMainPathForbidden: true;
  bgmInVideoPromptForbidden: true;
}

export interface ProviderExecutionPermissionPhase31Evidence {
  phaseId: "phase_31_provider_execution_permission_gate";
  typedEvidencePresent: true;
  phase30GateConsumed: boolean;
  actionTimeUserConfirmationRequired: true;
  automaticSubmitForbidden: true;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  noWorkerSpawn: true;
  noFileMutation: true;
  forbiddenProviderModesAbsent: boolean;
}

export interface ProviderExecutionPermissionGateState {
  schemaVersion: string;
  generatedAt: string;
  phase: "phase_31_provider_execution_permission_gate";
  requests: ProviderExecutionPermissionRequest[];
  summary: {
    totalRequests: number;
    readyForUserReview: number;
    blocked: number;
    parked: number;
    canAskUserToConfirm: number;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
    credentialAccessAllowed: false;
    automaticSubmitAllowed: false;
  };
  hardLocks: ProviderExecutionPermissionHardLocks;
  phase31Evidence: ProviderExecutionPermissionPhase31Evidence;
  forbiddenActions: Array<
    | "provider_submit"
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

export interface BuildProviderExecutionPermissionGateStateInput {
  generatedAt: string;
  providerLiveGate: ProviderLiveGateState;
  cliAdapterSpike?: CliAdapterSpikeState;
}

const hardLocks: ProviderExecutionPermissionHardLocks = {
  dryRunOnly: true,
  liveSubmitAllowed: false,
  providerSubmissionForbidden: true,
  noFileMutation: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noShellExecution: true,
  noWorkerSpawn: true,
  readOnly: true,
  reviewPlanOnly: true,
  actionTimeConfirmationRequired: true,
  canSubmitProvider: false,
  providerSubmitAllowed: 0,
  credentialAccessAllowed: false,
  credentialStorage: false,
  credentialReadAllowedForSettings: true,
  noApiKeyCreation: true,
  noArbitraryProviderCommand: true,
  fastModelForbidden: true,
  vipChannelForbidden: true,
  textToVideoMainPathForbidden: true,
  bgmInVideoPromptForbidden: true,
};

const forbiddenActions: ProviderExecutionPermissionGateState["forbiddenActions"] = [
  "provider_submit",
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

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function confirmation(
  confirmationId: ProviderExecutionPermissionConfirmationId,
  label: string,
  present: boolean,
  confirmed: boolean,
  blocker: string,
): ProviderExecutionPermissionConfirmation {
  return {
    confirmationId,
    label,
    required: true,
    present,
    confirmed,
    blocker: present && confirmed ? undefined : blocker,
  };
}

function isForbiddenModesAbsent(providerLiveGate: ProviderLiveGateState): boolean {
  return providerLiveGate.phase30Evidence.forbiddenProviderModesAbsent === true
    && providerLiveGate.hardLocks.fastModelForbidden === true
    && providerLiveGate.hardLocks.vipChannelForbidden === true
    && providerLiveGate.hardLocks.textToVideoMainPathForbidden === true
    && providerLiveGate.hardLocks.bgmInVideoPromptForbidden === true;
}

function providerLiveGateSafetyBlockers(providerLiveGate: ProviderLiveGateState): string[] {
  return uniqueSorted([
    providerLiveGate.phase === "phase_11_provider_adapter_live_gate" ? "" : "provider_live_gate_phase_drift",
    providerLiveGate.summary.providerSubmitAllowed === 0 ? "" : "provider_live_gate_summary_provider_submit_allowed_drift",
    providerLiveGate.summary.liveSubmitAllowed === false ? "" : "provider_live_gate_summary_live_submit_allowed_drift",
    providerLiveGate.summary.credentialStorage === false ? "" : "provider_live_gate_summary_credential_storage_drift",
    providerLiveGate.phase30Evidence.canSubmitProvider === false ? "" : "provider_live_gate_phase30_can_submit_provider_drift",
    providerLiveGate.phase30Evidence.providerSubmitAllowed === 0 ? "" : "provider_live_gate_phase30_provider_submit_allowed_drift",
    providerLiveGate.phase30Evidence.liveSubmitAllowed === false ? "" : "provider_live_gate_phase30_live_submit_allowed_drift",
    providerLiveGate.phase30Evidence.credentialStorage === false ? "" : "provider_live_gate_phase30_credential_storage_drift",
    providerLiveGate.hardLocks.providerSubmissionForbidden === true ? "" : "provider_live_gate_lock_provider_submission_forbidden_drift",
    providerLiveGate.hardLocks.liveSubmitAllowed === false ? "" : "provider_live_gate_lock_live_submit_allowed_drift",
    providerLiveGate.hardLocks.credentialStorage === false ? "" : "provider_live_gate_lock_credential_storage_drift",
  ]);
}

function adapterSpikeStillLocked(cliAdapterSpike?: CliAdapterSpikeState): boolean {
  if (!cliAdapterSpike) return true;
  return cliAdapterSpike.hardLocks.noActualAgentSpawn === true
    && cliAdapterSpike.hardLocks.noActualAgentResume === true
    && cliAdapterSpike.hardLocks.noProviderSubmit === true
    && cliAdapterSpike.hardLocks.liveSubmitAllowed === false
    && cliAdapterSpike.hardLocks.noCredentialAccess === true
    && cliAdapterSpike.hardLocks.noFileMutation === true
    && cliAdapterSpike.hardLocks.noFreeTextTask === true;
}

function buildRequest(
  item: ProviderLiveGateItem,
  input: BuildProviderExecutionPermissionGateStateInput,
): ProviderExecutionPermissionRequest {
  const phase30Ready = item.status === "ready_for_confirmation"
    && item.canSubmitProvider === false
    && item.liveSubmitAllowed === false
    && item.providerSubmissionForbidden === true
    && item.credentialStorage === false;
  const adapterLocked = adapterSpikeStillLocked(input.cliAdapterSpike);
  const forbiddenModesAbsent = isForbiddenModesAbsent(input.providerLiveGate);
  const liveGateSafetyBlockers = providerLiveGateSafetyBlockers(input.providerLiveGate);
  const liveGateSafe = liveGateSafetyBlockers.length === 0;
  const parked = item.status === "parked";
  const confirmations = [
    confirmation(
      "review_provider_packet",
      "Review provider packet",
      phase30Ready,
      phase30Ready,
      "Provider packet is not ready for user review.",
    ),
    confirmation(
      "action_time_user_confirmation",
      "Action-time user confirmation",
      true,
      false,
      "Action-time user confirmation has not been captured.",
    ),
    confirmation(
      "confirm_expected_outputs",
      "Confirm expected outputs",
      phase30Ready,
      phase30Ready,
      "Expected output contract is not ready.",
    ),
    confirmation(
      "confirm_no_credentials",
      "Confirm no credential access",
      adapterLocked,
      adapterLocked,
      "Credential, spawn, or file mutation lock drifted.",
    ),
    confirmation(
      "confirm_no_fast_vip_t2v_bgm",
      "Confirm safe provider mode",
      forbiddenModesAbsent,
      forbiddenModesAbsent,
      "Fast, VIP, text-to-video, or BGM-in-video prompt path is not proven absent.",
    ),
  ];
  const blockers = uniqueSorted([
    ...item.blockers,
    ...liveGateSafetyBlockers,
    ...confirmations.flatMap((check) => (check.blocker ? [check.blocker] : [])),
    ...(parked ? ["Provider slot is parked and cannot request action-time confirmation."] : []),
  ]);
  const status: ProviderExecutionPermissionStatus = parked
    ? "parked"
    : phase30Ready && adapterLocked && forbiddenModesAbsent && liveGateSafe
      ? "ready_for_user_review"
      : "blocked";

  return {
    requestId: `provider_execution_permission_${safeId(item.gateId)}`,
    sourceGateId: item.gateId,
    sourceId: item.sourceId,
    providerId: item.providerId,
    slot: item.slot,
    requiredMode: item.requiredMode,
    shotId: item.shotId,
    status,
    confirmations,
    blockers,
    warnings: item.warnings,
    executionOrder: [
      "review_provider_packet",
      "ask_action_time_confirmation",
      "record_confirmation_receipt",
      "wait_for_future_execution_gate",
    ],
    canAskUserToConfirm: status === "ready_for_user_review",
    actionTimeConfirmationRequired: true,
    userConfirmedAtActionTime: false,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    credentialAccessAllowed: false,
    credentialStorage: false,
    dryRunOnly: true,
    readOnly: true,
    noWorkerSpawn: true,
    noFileMutation: true,
  };
}

export function buildProviderExecutionPermissionGateState(
  input: BuildProviderExecutionPermissionGateStateInput,
): ProviderExecutionPermissionGateState {
  const requests = input.providerLiveGate.items.map((item) => buildRequest(item, input));
  const readyForUserReview = requests.filter((request) => request.status === "ready_for_user_review").length;
  const blocked = requests.filter((request) => request.status === "blocked").length;
  const parked = requests.filter((request) => request.status === "parked").length;

  return {
    schemaVersion: providerExecutionPermissionGateSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "phase_31_provider_execution_permission_gate",
    requests,
    summary: {
      totalRequests: requests.length,
      readyForUserReview,
      blocked,
      parked,
      canAskUserToConfirm: requests.filter((request) => request.canAskUserToConfirm).length,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      automaticSubmitAllowed: false,
    },
    hardLocks,
    phase31Evidence: {
      phaseId: "phase_31_provider_execution_permission_gate",
      typedEvidencePresent: true,
      phase30GateConsumed: input.providerLiveGate.phase === "phase_11_provider_adapter_live_gate",
      actionTimeUserConfirmationRequired: true,
      automaticSubmitForbidden: true,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      noWorkerSpawn: true,
      noFileMutation: true,
      forbiddenProviderModesAbsent: isForbiddenModesAbsent(input.providerLiveGate),
    },
    forbiddenActions,
    notes: [
      "Phase 31 prepares the final action-time confirmation plan only.",
      "No provider, worker, credential, shell, or file mutation route is opened by this gate.",
      "A ready_for_user_review request means the UI may ask for confirmation later; it still cannot submit providers.",
    ],
  };
}
