import { validateSubagentTaskEnvelope } from "./envelopeValidator";
import { agentCliMockRunnerHardLocks, agentCliMockRunnerPhase } from "./agentCliMockRunner";
import type { AgentCliMockRunnerState } from "./agentCliMockRunner";
import type { BuiltTaskPacket } from "./taskPacketBuilder";
import type { SubagentTaskEnvelope } from "./types";

export const codexWorkerRuntimeGateSchemaVersion = "0.1.0";
export const codexWorkerRuntimeGatePhaseId = "phase_40_codex_worker_runtime_gate";

export type CodexWorkerRuntimeGateReadiness = "blocked" | "ready_for_permission_gate";

export interface CodexWorkerRuntimeGateHardLocks {
  gatedRuntimeOnly: true;
  defaultGatedOff: true;
  validatedEnvelopeRequired: true;
  structuredResultRequired: true;
  noFreeTextWorker: true;
  noActualSpawnByDefault: true;
  noSpawnCodex: true;
  noCodexResume: true;
  noDaemon: true;
  daemonStarted: false;
  noSubprocess: true;
  noShellExecution: true;
  noProviderSubmit: true;
  noProviderExecution: true;
  providerSubmissionForbidden: true;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  noCredentialRead: true;
  noCredentialWrite: true;
  credentialAccessAllowed: false;
  credentialStorage: false;
  noFileMutation: true;
}

export interface CodexWorkerRuntimeGateCommandPlan {
  argumentSource: "validated_envelope_only";
  expectedResultSchema: "subagent_result_v1";
  canExecuteNow: false;
  canSpawnCodex: false;
  canResumeCodex: false;
  canStartDaemon: false;
  canExecuteShell: false;
  canSubmitProvider: false;
  canReadCredentials: false;
  canWriteCredentials: false;
  canMutateFiles: false;
}

export interface CodexWorkerRuntimePermissionGate {
  gateKind: "action_time_permission_required";
  readyForPermissionGate: boolean;
  actionTimePermissionRequired: true;
  permissionGrantedNow: false;
  canExecuteNow: false;
  canSpawnCodex: false;
  canResumeCodex: false;
  canStartDaemon: false;
  canExecuteShell: false;
  canSubmitProvider: false;
  canReadCredentials: false;
  canWriteCredentials: false;
  canMutateFiles: false;
  blockedReasons: string[];
}

export interface CodexWorkerRuntimeGateState {
  schemaVersion: typeof codexWorkerRuntimeGateSchemaVersion;
  phaseId: typeof codexWorkerRuntimeGatePhaseId;
  generatedAt: string;
  readiness: CodexWorkerRuntimeGateReadiness;
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
  commandPlan: CodexWorkerRuntimeGateCommandPlan;
  permissionGate: CodexWorkerRuntimePermissionGate;
  resultContract: {
    resultKind: "subagent_result_v1";
    structured: true;
    expectedResultSchema: "subagent_result_v1";
    freeTextAccepted: false;
    canReturnFreeTextWorker: false;
    projectStoreHandoffNow: false;
  };
  hardLocks: CodexWorkerRuntimeGateHardLocks;
  attemptedActions: {
    freeTextPromptAttempted: boolean;
    spawnCodexAttempted: boolean;
    resumeCodexAttempted: boolean;
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
    status: CodexWorkerRuntimeGateReadiness;
    errors: string[];
    warnings: string[];
    checkedAt: string;
  };
  notes: string[];
}

export interface BuildCodexWorkerRuntimeGateInput {
  generatedAt?: string;
  subagentTaskEnvelope?: SubagentTaskEnvelope;
  envelopeId?: string;
  phase38Packet?: BuiltTaskPacket;
  phase26ReplacementProof?: AgentCliMockRunnerState;
  hardLocksOverride?: Partial<Record<keyof CodexWorkerRuntimeGateHardLocks, boolean | number>>;
  freeTextPromptAttempted?: boolean;
  spawnCodexAttempted?: boolean;
  resumeCodexAttempted?: boolean;
  daemonStartAttempted?: boolean;
  shellExecutionAttempted?: boolean;
  providerSubmitAttempted?: boolean;
  credentialReadAttempted?: boolean;
  credentialWriteAttempted?: boolean;
  fileMutationAttempted?: boolean;
}

export const codexWorkerRuntimeGateHardLocks: CodexWorkerRuntimeGateHardLocks = {
  gatedRuntimeOnly: true,
  defaultGatedOff: true,
  validatedEnvelopeRequired: true,
  structuredResultRequired: true,
  noFreeTextWorker: true,
  noActualSpawnByDefault: true,
  noSpawnCodex: true,
  noCodexResume: true,
  noDaemon: true,
  daemonStarted: false,
  noSubprocess: true,
  noShellExecution: true,
  noProviderSubmit: true,
  noProviderExecution: true,
  providerSubmissionForbidden: true,
  canSubmitProvider: false,
  providerSubmitAllowed: 0,
  liveSubmitAllowed: false,
  noCredentialRead: true,
  noCredentialWrite: true,
  credentialAccessAllowed: false,
  credentialStorage: false,
  noFileMutation: true,
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

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function hardLockDrift<T extends object>(actual: T | undefined, expected: T, prefix: string): string[] {
  if (!actual) return [`${prefix}_hard_locks_missing`];
  const actualRecord = actual as Record<string, boolean | number | undefined>;
  const expectedRecord = expected as Record<string, boolean | number>;

  return Object.entries(expectedRecord).flatMap(([key, expectedValue]) =>
    actualRecord[key] === expectedValue ? [] : [`${prefix}_hard_lock_drift:${key}`],
  );
}

function commandPlan(): CodexWorkerRuntimeGateCommandPlan {
  return {
    argumentSource: "validated_envelope_only",
    expectedResultSchema: "subagent_result_v1",
    canExecuteNow: false,
    canSpawnCodex: false,
    canResumeCodex: false,
    canStartDaemon: false,
    canExecuteShell: false,
    canSubmitProvider: false,
    canReadCredentials: false,
    canWriteCredentials: false,
    canMutateFiles: false,
  };
}

function attemptedActionBlockers(input: BuildCodexWorkerRuntimeGateInput): string[] {
  return [
    ...(input.freeTextPromptAttempted ? ["free_text_prompt_attempt_blocked"] : []),
    ...(input.spawnCodexAttempted ? ["spawn_codex_attempt_blocked"] : []),
    ...(input.resumeCodexAttempted ? ["resume_codex_attempt_blocked"] : []),
    ...(input.daemonStartAttempted ? ["daemon_start_attempt_blocked"] : []),
    ...(input.shellExecutionAttempted ? ["shell_execution_attempt_blocked"] : []),
    ...(input.providerSubmitAttempted ? ["provider_submit_attempt_blocked"] : []),
    ...(input.credentialReadAttempted ? ["credential_read_attempt_blocked"] : []),
    ...(input.credentialWriteAttempted ? ["credential_write_attempt_blocked"] : []),
    ...(input.fileMutationAttempted ? ["file_mutation_attempt_blocked"] : []),
  ];
}

function envelopeBlockers(input: BuildCodexWorkerRuntimeGateInput): string[] {
  const envelope = input.subagentTaskEnvelope;
  const validation = envelope
    ? validateSubagentTaskEnvelope(envelope)
    : { valid: false, issues: ["subagent_task_envelope_missing"] };

  return [
    ...(!envelope ? ["validated_subagent_task_envelope_required"] : []),
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

  return uniqueSorted([
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
  const readyEnvelopeIds = uniqueSorted([
    ...proof.readySlots.map((slot) => slot.envelopeId || ""),
    ...proof.noopResults.map((result) => result.envelopeId || ""),
  ]);

  return uniqueSorted([
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

function envelopeValidationStatus(envelope: SubagentTaskEnvelope | undefined): CodexWorkerRuntimeGateState["inputGate"]["envelopeValidationStatus"] {
  if (!envelope) return "missing";
  return validateSubagentTaskEnvelope(envelope).valid ? "valid" : "invalid";
}

export function validateCodexWorkerRuntimeGateHardLocks(hardLocks: CodexWorkerRuntimeGateHardLocks): string[] {
  return hardLockDrift(hardLocks, codexWorkerRuntimeGateHardLocks, "codex_worker_runtime_gate");
}

export function buildCodexWorkerRuntimeGateState(
  input: BuildCodexWorkerRuntimeGateInput = {},
): CodexWorkerRuntimeGateState {
  const generatedAt = input.generatedAt || defaultGeneratedAt;
  const hardLocks = {
    ...codexWorkerRuntimeGateHardLocks,
    ...input.hardLocksOverride,
  } as CodexWorkerRuntimeGateHardLocks;
  const envelopeValidation = input.subagentTaskEnvelope
    ? validateSubagentTaskEnvelope(input.subagentTaskEnvelope)
    : { valid: false, issues: ["subagent_task_envelope_missing"] };
  const phase38Blockers = phase38PacketBlockers(input.phase38Packet, input.subagentTaskEnvelope);
  const phase26Blockers = phase26ProofBlockers(input.phase26ReplacementProof, input.subagentTaskEnvelope);
  const hardLockErrors = hardLockDrift(hardLocks, codexWorkerRuntimeGateHardLocks, "codex_worker_runtime_gate");
  const blockers = uniqueSorted([
    ...envelopeBlockers(input),
    ...phase38Blockers,
    ...phase26Blockers,
    ...hardLockErrors,
    ...attemptedActionBlockers(input),
  ]);
  const readiness: CodexWorkerRuntimeGateReadiness = blockers.length ? "blocked" : "ready_for_permission_gate";
  const plan = commandPlan();

  return {
    schemaVersion: codexWorkerRuntimeGateSchemaVersion,
    phaseId: codexWorkerRuntimeGatePhaseId,
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
      canSpawnCodex: false,
      canResumeCodex: false,
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
      spawnCodexAttempted: Boolean(input.spawnCodexAttempted),
      resumeCodexAttempted: Boolean(input.resumeCodexAttempted),
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
        hardLocks.noSpawnCodex === true &&
        plan.canSpawnCodex === false &&
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
      "Phase 40 defines the Codex Worker Runtime gate as a pure shell receipt only.",
      "The only accepted path is validated SubagentTaskEnvelope plus Phase38 packet evidence plus Phase26 replacement proof.",
      "Even ready shells cannot start Codex, resume Codex, start a daemon, execute shell commands, read credentials, submit providers, or mutate files.",
    ],
  };
}
