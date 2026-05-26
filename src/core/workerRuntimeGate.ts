import { PROVIDER_SUBMIT_ATTEMPT_BLOCKED, VALIDATED_SUBAGENT_TASK_ENVELOPE_REQUIRED } from "./statusConstants";
import { unique, hardLockDrift } from "./collectionUtils";
import { validateSubagentTaskEnvelope } from "./envelopeValidator";
import { agentCliMockRunnerHardLocks, agentCliMockRunnerPhase } from "./agentCliMockRunner";
import type { AgentCliMockRunnerState } from "./agentCliMockRunner";
import type { BuiltTaskPacket } from "./taskPacketBuilder";
import type { BaseHardLocks, SubagentTaskEnvelope } from "./types";

export const workerRuntimeGateSchemaVersion = "0.1.0";
export const workerRuntimeGatePhaseId = "phase_40_worker_runtime_gate";

export type WorkerRuntimeGateReadiness = "blocked" | "ready_for_permission_gate";

export interface WorkerRuntimeGateHardLocks extends BaseHardLocks {
  gatedRuntimeOnly: true;
  defaultGatedOff: true;
  validatedEnvelopeRequired: true;
  structuredResultRequired: true;
  noFreeTextWorker: true;
  noActualSpawnByDefault: true;
  noSpawnAgent: true;
  noAgentResume: true;
  noDaemon: true;
  daemonStarted: false;
  noSubprocess: true;
  noProviderSubmit: true;
  noProviderExecution: true;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  credentialAccessAllowed: false;
  credentialStorage: false;
}

export interface WorkerRuntimeGateCommandPlan {
  argumentSource: "validated_envelope_only";
  expectedResultSchema: "subagent_result_v1";
  canExecuteNow: false;
  canSpawnAgent: false;
  canResumeAgent: false;
  canStartDaemon: false;
  canExecuteShell: false;
  canSubmitProvider: false;
  canReadCredentials: false;
  canWriteCredentials: false;
  canMutateFiles: false;
}

export interface WorkerRuntimePermissionGate {
  gateKind: "action_time_permission_required";
  readyForPermissionGate: boolean;
  actionTimePermissionRequired: true;
  permissionGrantedNow: false;
  canExecuteNow: false;
  canSpawnAgent: false;
  canResumeAgent: false;
  canStartDaemon: false;
  canExecuteShell: false;
  canSubmitProvider: false;
  canReadCredentials: false;
  canWriteCredentials: false;
  canMutateFiles: false;
  blockedReasons: string[];
}

export interface WorkerRuntimeGateState {
  schemaVersion: typeof workerRuntimeGateSchemaVersion;
  phaseId: typeof workerRuntimeGatePhaseId;
  generatedAt: string;
  readiness: WorkerRuntimeGateReadiness;
  contract: {
    workerRuntimeContractDefined: true;
    defaultGatedOff: true;
    validatedEnvelopeOnly: true;
    phase38PacketRequired: true;
    phase26ReplacementProofRequired: true;
    structuredResultOnly: true;
    noActualSpawnByDefault: true;
    pureReceiptOnly: true;
    notRealExecution: true;
  };
  inputGate: {
    source: "validated_envelope_only";
    envelopeId?: string;
    parentTaskId?: string;
    phase38PacketId?: string;
    phase26ReceiptId?: string;
    envelopeValidationStatus: "missing" | "valid" | "invalid";
    envelopeValidationIssues: string[];
    phase38PacketStatus: "missing" | "ready" | "blocked" | "invalid";
    phase38PacketBlockers: string[];
    phase26ReplacementProofStatus: "missing" | "ready" | "blocked" | "invalid";
    phase26ReplacementProofBlockers: string[];
  };
  commandPlan: WorkerRuntimeGateCommandPlan;
  permissionGate: WorkerRuntimePermissionGate;
  resultContract: {
    resultKind: "subagent_result_v1";
    structured: true;
    expectedResultSchema: "subagent_result_v1";
    freeTextAccepted: false;
    canReturnFreeTextWorker: false;
    projectStoreHandoffNow: false;
  };
  hardLocks: WorkerRuntimeGateHardLocks;
  attemptedActions: {
    freeTextPromptAttempted: boolean;
    spawnAgentAttempted: boolean;
    resumeAgentAttempted: boolean;
    daemonStartAttempted: boolean;
    shellExecutionAttempted: boolean;
    providerSubmitAttempted: boolean;
    credentialReadAttempted: boolean;
    credentialWriteAttempted: boolean;
    fileMutationAttempted: boolean;
  };
  proof: {
    workerRuntimeContractDefined: boolean;
    defaultGatedOff: boolean;
    validatedEnvelopeOnly: boolean;
    phase38PacketValidated: boolean;
    phase26ReplacementProofReady: boolean;
    structuredResultOnly: boolean;
    noActualSpawnByDefault: boolean;
    noProviderSubmission: boolean;
    noCredentialAccess: boolean;
    noFileMutation: boolean;
    hardLocksPinned: boolean;
  };
  blockers: string[];
  warnings: string[];
  validation: {
    ok: boolean;
    status: WorkerRuntimeGateReadiness;
    errors: string[];
    warnings: string[];
    checkedAt: string;
  };
  notes: string[];
}

export interface BuildWorkerRuntimeGateInput {
  generatedAt?: string;
  subagentTaskEnvelope?: SubagentTaskEnvelope;
  envelopeId?: string;
  phase38Packet?: BuiltTaskPacket;
  phase26ReplacementProof?: AgentCliMockRunnerState;
  hardLocksOverride?: Partial<Record<keyof WorkerRuntimeGateHardLocks, boolean | number>>;
  freeTextPromptAttempted?: boolean;
  spawnAgentAttempted?: boolean;
  resumeAgentAttempted?: boolean;
  daemonStartAttempted?: boolean;
  shellExecutionAttempted?: boolean;
  providerSubmitAttempted?: boolean;
  credentialReadAttempted?: boolean;
  credentialWriteAttempted?: boolean;
  fileMutationAttempted?: boolean;
}

export const workerRuntimeGateHardLocks: WorkerRuntimeGateHardLocks = {
  dryRunOnly: true,
  liveSubmitAllowed: false,
  providerSubmissionForbidden: true,
  noFileMutation: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noShellExecution: true,
  noWorkerSpawn: true,
  gatedRuntimeOnly: true,
  defaultGatedOff: true,
  validatedEnvelopeRequired: true,
  structuredResultRequired: true,
  noFreeTextWorker: true,
  noActualSpawnByDefault: true,
  noSpawnAgent: true,
  noAgentResume: true,
  noDaemon: true,
  daemonStarted: false,
  noSubprocess: true,
  noProviderSubmit: true,
  noProviderExecution: true,
  canSubmitProvider: false,
  providerSubmitAllowed: 0,
  credentialAccessAllowed: false,
  credentialStorage: false,
};

const defaultGeneratedAt = "1970-01-01T00:00:00.000Z";

const requiredPhase38Fields: Array<keyof BuiltTaskPacket["validationReceipt"]["requiredFields"]> = [
  "validatedEnvelope",
  "expectedOutputs",
  "sourceFactTrace",
  "injectedKnowledgeTrace",
  "qaChecklist",
  "resultSchema",
  "allowedReadScope",
  "forbiddenActions",
  "noFreeTextWorker",
  "phase37VisualConsistencyTrace",
];

function commandPlan(): WorkerRuntimeGateCommandPlan {
  return {
    argumentSource: "validated_envelope_only",
    expectedResultSchema: "subagent_result_v1",
    canExecuteNow: false,
    canSpawnAgent: false,
    canResumeAgent: false,
    canStartDaemon: false,
    canExecuteShell: false,
    canSubmitProvider: false,
    canReadCredentials: false,
    canWriteCredentials: false,
    canMutateFiles: false,
  };
}

function attemptedActionBlockers(input: BuildWorkerRuntimeGateInput): string[] {
  return [
    ...(input.freeTextPromptAttempted ? ["free_text_prompt_attempt_blocked"] : []),
    ...(input.spawnAgentAttempted ? ["spawn_agent_attempt_blocked"] : []),
    ...(input.resumeAgentAttempted ? ["resume_agent_attempt_blocked"] : []),
    ...(input.daemonStartAttempted ? ["daemon_start_attempt_blocked"] : []),
    ...(input.shellExecutionAttempted ? ["shell_execution_attempt_blocked"] : []),
    ...(input.providerSubmitAttempted ? [PROVIDER_SUBMIT_ATTEMPT_BLOCKED] : []),
    ...(input.credentialReadAttempted ? ["credential_read_attempt_blocked"] : []),
    ...(input.credentialWriteAttempted ? ["credential_write_attempt_blocked"] : []),
    ...(input.fileMutationAttempted ? ["file_mutation_attempt_blocked"] : []),
  ];
}

function envelopeBlockers(input: BuildWorkerRuntimeGateInput): string[] {
  const envelope = input.subagentTaskEnvelope;
  const validation = envelope
    ? validateSubagentTaskEnvelope(envelope)
    : { valid: false, issues: ["subagent_task_envelope_missing"] };

  return [
    ...(!envelope ? [VALIDATED_SUBAGENT_TASK_ENVELOPE_REQUIRED] : []),
    ...(envelope && !validation.valid ? validation.issues.map((issue) => `invalid_envelope:${issue}`) : []),
    ...(input.envelopeId && envelope && input.envelopeId !== envelope.id ? ["input_envelope_id_mismatch"] : []),
    ...(envelope && envelope.expectedOutputContract.format !== "subagent_result_v1"
      ? ["envelope_expected_result_schema_not_subagent_result_v1"]
      : []),
  ];
}

function phase38PacketBlockers(packet: BuiltTaskPacket | undefined, envelope: SubagentTaskEnvelope | undefined): string[] {
  if (!packet) return ["phase_38_packet_missing"];
  const requiredFields = packet.validationReceipt.requiredFields;

  return unique([
    ...(packet.status === "ready" ? [] : [`phase_38_packet_not_ready:${packet.status}`]),
    ...(packet.validationReceipt.status === "pass" ? [] : ["phase_38_packet_validation_not_pass"]),
    ...packet.validationReceipt.blockers.map((blocker) => `phase_38_packet_blocker:${blocker}`),
    ...requiredPhase38Fields.flatMap((field) => requiredFields[field] ? [] : [`phase_38_required_field_missing:${field}`]),
    ...(packet.noFreeTextTask === true ? [] : ["phase_38_packet_free_text_worker_not_blocked"]),
    ...(packet.providerSubmissionForbidden === true ? [] : ["phase_38_packet_provider_submission_not_forbidden"]),
    ...(packet.canSubmitProvider === false ? [] : ["phase_38_packet_can_submit_provider_not_false"]),
    ...(packet.liveSubmitAllowed === false ? [] : ["phase_38_packet_live_submit_not_false"]),
    ...(packet.hardFields?.outputSchema === "subagent_result_v1" ? [] : ["phase_38_packet_output_schema_not_subagent_result_v1"]),
    ...(packet.hardFields?.expectedOutputContract.format === "subagent_result_v1"
      ? []
      : ["phase_38_packet_expected_result_schema_not_subagent_result_v1"]),
    ...(envelope && packet.envelopeId !== envelope.id ? ["phase_38_packet_envelope_id_mismatch"] : []),
    ...(envelope && packet.envelope?.id && packet.envelope.id !== envelope.id ? ["phase_38_packet_embedded_envelope_mismatch"] : []),
  ]);
}

function phase26ProofBlockers(proof: AgentCliMockRunnerState | undefined, envelope: SubagentTaskEnvelope | undefined): string[] {
  if (!proof) return ["phase_26_replacement_proof_missing"];
  const readyEnvelopeIds = unique([
    ...proof.readySlots.map((slot) => slot.envelopeId || ""),
    ...proof.noopResults.map((result) => result.envelopeId || ""),
  ]);

  return unique([
    ...(proof.phase === agentCliMockRunnerPhase ? [] : [`phase_26_proof_phase_mismatch:${proof.phase}`]),
    ...(proof.readiness === "ready_for_phase_29_adapter_spike" ? [] : [`phase_26_proof_not_ready:${proof.readiness}`]),
    ...(proof.replacementProofReady ? [] : ["phase_26_replacement_proof_not_ready"]),
    ...(proof.readySlots.length > 0 ? [] : ["phase_26_ready_slot_missing"]),
    ...(proof.validation.ok ? [] : ["phase_26_validation_not_ok"]),
    ...(proof.adapterBoundary.inputContract === "validated_subagent_task_envelope_only"
      ? []
      : ["phase_26_input_contract_not_validated_envelope_only"]),
    ...(proof.adapterBoundary.outputContract === "structured_subagent_result_shape_only"
      ? []
      : ["phase_26_output_contract_not_structured_result_only"]),
    ...(proof.adapterBoundary.runnerContract === "replaceable_agent_cli_adapter"
      ? []
      : ["phase_26_runner_contract_not_replaceable_adapter"]),
    ...(proof.adapterBoundary.providerSubmitAllowed === false ? [] : ["phase_26_provider_submit_allowed_drift"]),
    ...(proof.adapterBoundary.shellAllowed === false ? [] : ["phase_26_shell_allowed_drift"]),
    ...(proof.adapterBoundary.fileMutationAllowed === false ? [] : ["phase_26_file_mutation_allowed_drift"]),
    ...hardLockDrift(proof.hardLocks, agentCliMockRunnerHardLocks, "phase_26_mock_runner"),
    ...(envelope && readyEnvelopeIds.length > 0 && !readyEnvelopeIds.includes(envelope.id)
      ? ["phase_26_proof_envelope_id_mismatch"]
      : []),
  ]);
}

function envelopeValidationStatus(envelope: SubagentTaskEnvelope | undefined): WorkerRuntimeGateState["inputGate"]["envelopeValidationStatus"] {
  if (!envelope) return "missing";
  return validateSubagentTaskEnvelope(envelope).valid ? "valid" : "invalid";
}

export function validateWorkerRuntimeGateHardLocks(hardLocks: WorkerRuntimeGateHardLocks): string[] {
  return hardLockDrift(hardLocks, workerRuntimeGateHardLocks, "worker_runtime_gate");
}

export function buildWorkerRuntimeGateState(
  input: BuildWorkerRuntimeGateInput = {},
): WorkerRuntimeGateState {
  const generatedAt = input.generatedAt || defaultGeneratedAt;
  const hardLocks = {
    ...workerRuntimeGateHardLocks,
    ...input.hardLocksOverride,
  } as WorkerRuntimeGateHardLocks;
  const envelopeValidation = input.subagentTaskEnvelope
    ? validateSubagentTaskEnvelope(input.subagentTaskEnvelope)
    : { valid: false, issues: ["subagent_task_envelope_missing"] };
  const phase38Blockers = phase38PacketBlockers(input.phase38Packet, input.subagentTaskEnvelope);
  const phase26Blockers = phase26ProofBlockers(input.phase26ReplacementProof, input.subagentTaskEnvelope);
  const hardLockErrors = hardLockDrift(hardLocks, workerRuntimeGateHardLocks, "worker_runtime_gate");
  const blockers = unique([
    ...envelopeBlockers(input),
    ...phase38Blockers,
    ...phase26Blockers,
    ...hardLockErrors,
    ...attemptedActionBlockers(input),
  ]);
  const readiness: WorkerRuntimeGateReadiness = blockers.length ? "blocked" : "ready_for_permission_gate";
  const plan = commandPlan();

  return {
    schemaVersion: workerRuntimeGateSchemaVersion,
    phaseId: workerRuntimeGatePhaseId,
    generatedAt,
    readiness,
    contract: {
      workerRuntimeContractDefined: true,
      defaultGatedOff: true,
      validatedEnvelopeOnly: true,
      phase38PacketRequired: true,
      phase26ReplacementProofRequired: true,
      structuredResultOnly: true,
      noActualSpawnByDefault: true,
      pureReceiptOnly: true,
      notRealExecution: true,
    },
    inputGate: {
      source: "validated_envelope_only",
      envelopeId: input.subagentTaskEnvelope?.id || input.envelopeId,
      parentTaskId: input.subagentTaskEnvelope?.parentTaskId,
      phase38PacketId: input.phase38Packet?.packetId,
      phase26ReceiptId: input.phase26ReplacementProof?.receipt.receiptId,
      envelopeValidationStatus: envelopeValidationStatus(input.subagentTaskEnvelope),
      envelopeValidationIssues: envelopeValidation.issues,
      phase38PacketStatus: !input.phase38Packet
        ? "missing"
        : phase38Blockers.length
          ? input.phase38Packet.status === "ready" ? "invalid" : "blocked"
          : "ready",
      phase38PacketBlockers: phase38Blockers,
      phase26ReplacementProofStatus: !input.phase26ReplacementProof
        ? "missing"
        : phase26Blockers.length
          ? input.phase26ReplacementProof.readiness === "ready_for_phase_29_adapter_spike" ? "invalid" : "blocked"
          : "ready",
      phase26ReplacementProofBlockers: phase26Blockers,
    },
    commandPlan: plan,
    permissionGate: {
      gateKind: "action_time_permission_required",
      readyForPermissionGate: readiness === "ready_for_permission_gate",
      actionTimePermissionRequired: true,
      permissionGrantedNow: false,
      canExecuteNow: false,
      canSpawnAgent: false,
      canResumeAgent: false,
      canStartDaemon: false,
      canExecuteShell: false,
      canSubmitProvider: false,
      canReadCredentials: false,
      canWriteCredentials: false,
      canMutateFiles: false,
      blockedReasons: readiness === "ready_for_permission_gate"
        ? ["action_time_permission_required_before_any_future_worker_runtime"]
        : blockers,
    },
    resultContract: {
      resultKind: "subagent_result_v1",
      structured: true,
      expectedResultSchema: "subagent_result_v1",
      freeTextAccepted: false,
      canReturnFreeTextWorker: false,
      projectStoreHandoffNow: false,
    },
    hardLocks,
    attemptedActions: {
      freeTextPromptAttempted: Boolean(input.freeTextPromptAttempted),
      spawnAgentAttempted: Boolean(input.spawnAgentAttempted),
      resumeAgentAttempted: Boolean(input.resumeAgentAttempted),
      daemonStartAttempted: Boolean(input.daemonStartAttempted),
      shellExecutionAttempted: Boolean(input.shellExecutionAttempted),
      providerSubmitAttempted: Boolean(input.providerSubmitAttempted),
      credentialReadAttempted: Boolean(input.credentialReadAttempted),
      credentialWriteAttempted: Boolean(input.credentialWriteAttempted),
      fileMutationAttempted: Boolean(input.fileMutationAttempted),
    },
    proof: {
      workerRuntimeContractDefined: true,
      defaultGatedOff: hardLocks.defaultGatedOff === true,
      validatedEnvelopeOnly: envelopeValidation.valid && input.phase38Packet?.validationReceipt.requiredFields.validatedEnvelope === true,
      phase38PacketValidated: phase38Blockers.length === 0,
      phase26ReplacementProofReady: phase26Blockers.length === 0,
      structuredResultOnly: plan.expectedResultSchema === "subagent_result_v1",
      noActualSpawnByDefault: hardLocks.noActualSpawnByDefault === true &&
        hardLocks.noSpawnAgent === true &&
        plan.canSpawnAgent === false &&
        plan.canExecuteNow === false,
      noProviderSubmission: hardLocks.noProviderSubmit === true &&
        hardLocks.providerSubmissionForbidden === true &&
        hardLocks.providerSubmitAllowed === 0 &&
        hardLocks.canSubmitProvider === false,
      noCredentialAccess: hardLocks.noCredentialRead === true &&
        hardLocks.noCredentialWrite === true &&
        hardLocks.credentialAccessAllowed === false,
      noFileMutation: hardLocks.noFileMutation === true && plan.canMutateFiles === false,
      hardLocksPinned: hardLockErrors.length === 0,
    },
    blockers,
    warnings: readiness === "ready_for_permission_gate"
      ? ["ready shell still cannot execute until a future action-time permission gate exists"]
      : [],
    validation: {
      ok: blockers.length === 0,
      status: readiness,
      errors: blockers,
      warnings: readiness === "ready_for_permission_gate"
        ? ["action_time_permission_required_before_execution"]
        : [],
      checkedAt: generatedAt,
    },
    notes: [
      "Phase 40 defines the Agent Worker Runtime gate as a pure shell receipt only.",
      "The only accepted path is validated SubagentTaskEnvelope plus Phase38 packet evidence plus Phase26 replacement proof.",
      "Even ready shells cannot start an agent, resume an agent, start a daemon, execute shell commands, read credentials, submit providers, or mutate files.",
    ],
  };
}
