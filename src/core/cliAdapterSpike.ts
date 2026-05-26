import { PROVIDER_SUBMIT_ATTEMPT_BLOCKED, VALIDATED_SUBAGENT_TASK_ENVELOPE_REQUIRED } from "./statusConstants";
import { unique, hardLockDrift } from "./collectionUtils";
import { validateSubagentTaskEnvelope } from "./envelopeValidator";
import type {
  AgentCliMockRunnerHardLocks,
  AgentCliMockRunnerState,
} from "./agentCliMockRunner";
import { agentCliMockRunnerHardLocks, agentCliMockRunnerPhase } from "./agentCliMockRunner";
import type { BaseHardLocks, SubagentTaskEnvelope } from "./types";

export const cliAdapterSpikeSchemaVersion = "0.1.0";
export const cliAdapterSpikePhaseId = "phase_29_cli_adapter_spike";
export const cliAdapterSpikeMode = "adapter_contract_spike";

export type CliAdapterSpikeReadiness = "ready" | "blocked";
export type CliAdapterSpikeResultStatus = "planned" | "blocked";

export interface CliAdapterSpikeExecutionPolicy {
  liveSubmitAllowed: false;
  actualSpawnAllowed: false;
  actualResumeAllowed: false;
  providerSubmitAllowed: false;
  credentialAccessAllowed: false;
  arbitraryShellAllowed: false;
  fileMutationAllowed: false;
  freeTextTaskAllowed: false;
}

export interface CliAdapterSpikeInputContract {
  source: "validated_envelope_only";
  envelope: {
    id?: string;
    validationStatus: "valid" | "invalid" | "missing";
    validationIssues: string[];
  };
  task: {
    parentTaskId?: string;
    purpose?: string;
    contextLevel?: string;
    sourceIndexHash?: string;
    expectedResultSchema?: string;
  };
  slot: {
    shotId?: string;
    providerPolicySummary: string[];
    readyRunnerSlotIds: string[];
  };
}

export interface CliAdapterSpikeAdapterShape {
  adapterKind: "cli_contract_shape";
  spawn: {
    operation: "cli_spawn";
    status: "planned_contract_only";
    actualSpawnAllowed: false;
    argumentsSource: "validated_envelope_summary";
  };
  resume: {
    operation: "cli_resume";
    status: "planned_contract_only";
    actualResumeAllowed: false;
    resumeTokenSource: "none_in_phase_29";
  };
  parser: {
    source: "structured_stdout_placeholder";
    acceptsFreeText: false;
    expectedResultSchema: "subagent_result_v1";
  };
}

export interface CliAdapterSpikeResultContract {
  resultKind: "subagent_result_v1_cli_adapter_spike";
  status: CliAdapterSpikeResultStatus;
  structured: true;
  expectedResultSchema: "subagent_result_v1";
  parserExpectation: "parse_structured_result_only";
  freeTextAccepted: false;
  notRealExecution: true;
}

export interface CliAdapterSpikeReplacementProof {
  sourcePhase: typeof agentCliMockRunnerPhase;
  present: boolean;
  replacementProofReady: boolean;
  receiptId?: string;
  readySlotCount: number;
  blockedSlotCount: number;
  noopResultKinds: string[];
  boundary: {
    inputContract?: string;
    outputContract?: string;
    runnerContract?: string;
    phase26Boundary?: string;
    providerSubmitAllowed?: boolean;
    shellAllowed?: boolean;
    fileMutationAllowed?: boolean;
  };
  sourceRefs: string[];
}

export interface CliAdapterSpikeHardLocks extends BaseHardLocks {
  phase26ReplacementProofRequired: true;
  validatedEnvelopeRequired: true;
  structuredResultRequired: true;
  noActualAgentSpawn: true;
  noActualAgentResume: true;
  noProviderSubmit: true;
  noCredentialAccess: true;
  noArbitraryShell: true;
  noFreeTextTask: true;
  adapterContractOnly: true;
}

export interface CliAdapterSpikeBuildOptions {
  generatedAt?: string;
  phase26ReplacementProof?: AgentCliMockRunnerState;
  subagentTaskEnvelope?: SubagentTaskEnvelope;
  envelopeId?: string;
  executionPolicyOverride?: Partial<Record<keyof CliAdapterSpikeExecutionPolicy, boolean>>;
  hardLocksOverride?: Partial<Record<keyof CliAdapterSpikeHardLocks, boolean>>;
  resultContractOverride?: Partial<{
    structured: boolean;
    expectedResultSchema: string;
    freeTextAccepted: boolean;
    notRealExecution: boolean;
  }>;
  liveSubmitAttempted?: boolean;
  actualSpawnAttempted?: boolean;
  actualResumeAttempted?: boolean;
  providerSubmitAttempted?: boolean;
  credentialAccessAttempted?: boolean;
  arbitraryShellAttempted?: boolean;
  fileMutationAttempted?: boolean;
  freeTextTaskAttempted?: boolean;
}

export interface CliAdapterSpikeState {
  schemaVersion: typeof cliAdapterSpikeSchemaVersion;
  phaseId: typeof cliAdapterSpikePhaseId;
  mode: typeof cliAdapterSpikeMode;
  generatedAt: string;
  readiness: CliAdapterSpikeReadiness;
  executionPolicy: CliAdapterSpikeExecutionPolicy;
  inputContract: CliAdapterSpikeInputContract;
  adapterShape: CliAdapterSpikeAdapterShape;
  resultContract: CliAdapterSpikeResultContract;
  replacementProof: CliAdapterSpikeReplacementProof;
  roadmapEvidence: {
    phaseId: typeof cliAdapterSpikePhaseId;
    adapterContractReady: boolean;
    phase26ReplacementProofReady: boolean;
    inputSourceValidatedEnvelopeOnly: boolean;
    structuredResultRequired: boolean;
    providerSubmitBlocked: boolean;
    credentialBlocked: boolean;
    arbitraryShellBlocked: boolean;
    fileMutationBlocked: boolean;
    freeTextBlocked: boolean;
    actualSpawnResumeUnavailable: boolean;
    hardLocksPinned: boolean;
    providerSubmitObserved: boolean;
    credentialAccessObserved: boolean;
    shellExecutionObserved: boolean;
    fileMutationObserved: boolean;
    freeTextTaskObserved: boolean;
    actualSpawnObserved: boolean;
    actualResumeObserved: boolean;
    unstructuredResultObserved: boolean;
  };
  hardLocks: CliAdapterSpikeHardLocks;
  blockers: string[];
  warnings: string[];
  validation: {
    ok: boolean;
    errors: string[];
    warnings: string[];
    checkedAt: string;
  };
  notes: string[];
}

export const cliAdapterSpikeExecutionPolicy: CliAdapterSpikeExecutionPolicy = {
  liveSubmitAllowed: false,
  actualSpawnAllowed: false,
  actualResumeAllowed: false,
  providerSubmitAllowed: false,
  credentialAccessAllowed: false,
  arbitraryShellAllowed: false,
  fileMutationAllowed: false,
  freeTextTaskAllowed: false,
};

export const cliAdapterSpikeHardLocks: CliAdapterSpikeHardLocks = {
  dryRunOnly: true,
  liveSubmitAllowed: false,
  providerSubmissionForbidden: true,
  noFileMutation: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noShellExecution: true,
  noWorkerSpawn: true,
  phase26ReplacementProofRequired: true,
  validatedEnvelopeRequired: true,
  structuredResultRequired: true,
  noActualAgentSpawn: true,
  noActualAgentResume: true,
  noProviderSubmit: true,
  noCredentialAccess: true,
  noArbitraryShell: true,
  noFreeTextTask: true,
  adapterContractOnly: true,
};

const defaultGeneratedAt = "1970-01-01T00:00:00.000Z";

function replacementProofSummary(proof: AgentCliMockRunnerState | undefined): CliAdapterSpikeReplacementProof {
  return {
    sourcePhase: agentCliMockRunnerPhase,
    present: Boolean(proof),
    replacementProofReady: proof?.replacementProofReady === true,
    receiptId: proof?.receipt.receiptId,
    readySlotCount: proof?.readySlots.length || 0,
    blockedSlotCount: proof?.blockedSlots.length || 0,
    noopResultKinds: unique(proof?.noopResults.map((result) => result.resultKind) || []),
    boundary: {
      inputContract: proof?.adapterBoundary.inputContract,
      outputContract: proof?.adapterBoundary.outputContract,
      runnerContract: proof?.adapterBoundary.runnerContract,
      phase26Boundary: proof?.adapterBoundary.phase26Boundary,
      providerSubmitAllowed: proof?.adapterBoundary.providerSubmitAllowed,
      shellAllowed: proof?.adapterBoundary.shellAllowed,
      fileMutationAllowed: proof?.adapterBoundary.fileMutationAllowed,
    },
    sourceRefs: proof?.receipt.sourceRefs || [],
  };
}

function inputContract(options: CliAdapterSpikeBuildOptions): CliAdapterSpikeInputContract {
  const envelope = options.subagentTaskEnvelope;
  const envelopeValidation = envelope
    ? validateSubagentTaskEnvelope(envelope)
    : { valid: false, issues: ["subagent_task_envelope_missing"] };

  return {
    source: "validated_envelope_only",
    envelope: {
      id: envelope?.id || options.envelopeId,
      validationStatus: envelope ? (envelopeValidation.valid ? "valid" : "invalid") : "missing",
      validationIssues: envelopeValidation.issues,
    },
    task: {
      parentTaskId: envelope?.parentTaskId,
      purpose: envelope?.purpose,
      contextLevel: envelope?.contextLevel,
      sourceIndexHash: envelope?.sourceIndexHash,
      expectedResultSchema: envelope?.expectedOutputContract.format,
    },
    slot: {
      shotId: envelope?.shotId,
      providerPolicySummary: envelope?.providerPolicySummary || [],
      readyRunnerSlotIds: options.phase26ReplacementProof?.readySlots.map((slot) => slot.runnerSlotId) || [],
    },
  };
}

function phase26Blockers(proof: AgentCliMockRunnerState | undefined): string[] {
  if (!proof) return ["phase_26_replacement_proof_missing"];

  return [
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
  ];
}

function envelopeBlockers(options: CliAdapterSpikeBuildOptions): string[] {
  const envelope = options.subagentTaskEnvelope;
  const validation = envelope
    ? validateSubagentTaskEnvelope(envelope)
    : { valid: false, issues: ["subagent_task_envelope_missing"] };
  const proofEnvelopeIds = unique(
    [
      ...(options.phase26ReplacementProof?.readySlots.map((slot) => slot.envelopeId || "") || []),
      ...(options.phase26ReplacementProof?.noopResults.map((result) => result.envelopeId || "") || []),
    ],
  );

  return [
    ...(!envelope ? [VALIDATED_SUBAGENT_TASK_ENVELOPE_REQUIRED] : []),
    ...(envelope && !validation.valid ? validation.issues.map((issue) => `invalid_envelope:${issue}`) : []),
    ...(options.envelopeId && envelope && options.envelopeId !== envelope.id ? ["input_envelope_id_mismatch"] : []),
    ...(envelope && proofEnvelopeIds.length > 0 && !proofEnvelopeIds.includes(envelope.id)
      ? ["phase_26_proof_envelope_id_mismatch"]
      : []),
  ];
}

function policyBlockers(policy: CliAdapterSpikeExecutionPolicy): string[] {
  return [
    ...(policy.liveSubmitAllowed === false ? [] : ["execution_policy_live_submit_allowed_drift"]),
    ...(policy.actualSpawnAllowed === false ? [] : ["execution_policy_actual_spawn_allowed_drift"]),
    ...(policy.actualResumeAllowed === false ? [] : ["execution_policy_actual_resume_allowed_drift"]),
    ...(policy.providerSubmitAllowed === false ? [] : ["execution_policy_provider_submit_allowed_drift"]),
    ...(policy.credentialAccessAllowed === false ? [] : ["execution_policy_credential_access_allowed_drift"]),
    ...(policy.arbitraryShellAllowed === false ? [] : ["execution_policy_arbitrary_shell_allowed_drift"]),
    ...(policy.fileMutationAllowed === false ? [] : ["execution_policy_file_mutation_allowed_drift"]),
    ...(policy.freeTextTaskAllowed === false ? [] : ["execution_policy_free_text_task_allowed_drift"]),
  ];
}

function attemptedActionBlockers(options: CliAdapterSpikeBuildOptions): string[] {
  return [
    ...(options.liveSubmitAttempted ? ["live_submit_attempt_blocked"] : []),
    ...(options.actualSpawnAttempted ? ["actual_spawn_attempt_blocked"] : []),
    ...(options.actualResumeAttempted ? ["actual_resume_attempt_blocked"] : []),
    ...(options.providerSubmitAttempted ? [PROVIDER_SUBMIT_ATTEMPT_BLOCKED] : []),
    ...(options.credentialAccessAttempted ? ["credential_access_attempt_blocked"] : []),
    ...(options.arbitraryShellAttempted ? ["arbitrary_shell_attempt_blocked"] : []),
    ...(options.fileMutationAttempted ? ["file_mutation_attempt_blocked"] : []),
    ...(options.freeTextTaskAttempted ? ["free_text_task_attempt_blocked"] : []),
  ];
}

function resultContractBlockers(options: CliAdapterSpikeBuildOptions): string[] {
  const override = options.resultContractOverride;

  return [
    ...(override?.structured === false ? ["result_contract_not_structured"] : []),
    ...(override?.expectedResultSchema && override.expectedResultSchema !== "subagent_result_v1"
      ? ["result_contract_schema_not_subagent_result_v1"]
      : []),
    ...(override?.freeTextAccepted === true ? ["result_contract_accepts_free_text"] : []),
    ...(override?.notRealExecution === false ? ["result_contract_real_execution_intent"] : []),
  ];
}

export function validateCliAdapterSpikeHardLocks(hardLocks: CliAdapterSpikeHardLocks): string[] {
  return hardLockDrift(hardLocks, cliAdapterSpikeHardLocks, "cli_adapter_spike");
}

export function buildCliAdapterSpikeState(
  options: CliAdapterSpikeBuildOptions = {},
): CliAdapterSpikeState {
  const generatedAt = options.generatedAt || defaultGeneratedAt;
  const executionPolicy = {
    ...cliAdapterSpikeExecutionPolicy,
    ...options.executionPolicyOverride,
  } as CliAdapterSpikeExecutionPolicy;
  const hardLocks = {
    ...cliAdapterSpikeHardLocks,
    ...options.hardLocksOverride,
  } as CliAdapterSpikeHardLocks;
  const contract = inputContract(options);
  const blockers = unique([
    ...phase26Blockers(options.phase26ReplacementProof),
    ...envelopeBlockers(options),
    ...policyBlockers(executionPolicy),
    ...hardLockDrift(hardLocks, cliAdapterSpikeHardLocks, "cli_adapter_spike"),
    ...attemptedActionBlockers(options),
    ...resultContractBlockers(options),
  ]);
  const readiness: CliAdapterSpikeReadiness = blockers.length ? "blocked" : "ready";
  const status: CliAdapterSpikeResultStatus = readiness === "ready" ? "planned" : "blocked";
  const hardLockErrors = hardLockDrift(hardLocks, cliAdapterSpikeHardLocks, "cli_adapter_spike");

  return {
    schemaVersion: cliAdapterSpikeSchemaVersion,
    phaseId: cliAdapterSpikePhaseId,
    mode: cliAdapterSpikeMode,
    generatedAt,
    readiness,
    executionPolicy,
    inputContract: contract,
    adapterShape: {
      adapterKind: "cli_contract_shape",
      spawn: {
        operation: "cli_spawn",
        status: "planned_contract_only",
        actualSpawnAllowed: false,
        argumentsSource: "validated_envelope_summary",
      },
      resume: {
        operation: "cli_resume",
        status: "planned_contract_only",
        actualResumeAllowed: false,
        resumeTokenSource: "none_in_phase_29",
      },
      parser: {
        source: "structured_stdout_placeholder",
        acceptsFreeText: false,
        expectedResultSchema: "subagent_result_v1",
      },
    },
    resultContract: {
      resultKind: "subagent_result_v1_cli_adapter_spike",
      status,
      structured: true,
      expectedResultSchema: "subagent_result_v1",
      parserExpectation: "parse_structured_result_only",
      freeTextAccepted: false,
      notRealExecution: true,
    },
    replacementProof: replacementProofSummary(options.phase26ReplacementProof),
    roadmapEvidence: {
      phaseId: cliAdapterSpikePhaseId,
      adapterContractReady: readiness === "ready",
      phase26ReplacementProofReady: options.phase26ReplacementProof?.replacementProofReady === true,
      inputSourceValidatedEnvelopeOnly: contract.source === "validated_envelope_only" && contract.envelope.validationStatus === "valid",
      structuredResultRequired: true,
      providerSubmitBlocked: executionPolicy.providerSubmitAllowed === false && options.providerSubmitAttempted !== true,
      credentialBlocked: executionPolicy.credentialAccessAllowed === false && options.credentialAccessAttempted !== true,
      arbitraryShellBlocked: executionPolicy.arbitraryShellAllowed === false && options.arbitraryShellAttempted !== true,
      fileMutationBlocked: executionPolicy.fileMutationAllowed === false && options.fileMutationAttempted !== true,
      freeTextBlocked: executionPolicy.freeTextTaskAllowed === false && options.freeTextTaskAttempted !== true,
      actualSpawnResumeUnavailable: executionPolicy.actualSpawnAllowed === false &&
        executionPolicy.actualResumeAllowed === false &&
        options.actualSpawnAttempted !== true &&
        options.actualResumeAttempted !== true,
      hardLocksPinned: hardLockErrors.length === 0,
      providerSubmitObserved: options.providerSubmitAttempted === true || options.liveSubmitAttempted === true,
      credentialAccessObserved: options.credentialAccessAttempted === true,
      shellExecutionObserved: options.arbitraryShellAttempted === true,
      fileMutationObserved: options.fileMutationAttempted === true,
      freeTextTaskObserved: options.freeTextTaskAttempted === true,
      actualSpawnObserved: options.actualSpawnAttempted === true,
      actualResumeObserved: options.actualResumeAttempted === true,
      unstructuredResultObserved: options.resultContractOverride?.structured === false,
    },
    hardLocks,
    blockers,
    warnings: [],
    validation: {
      ok: blockers.length === 0,
      errors: blockers,
      warnings: [],
      checkedAt: generatedAt,
    },
    notes: [
      "Phase 29 is an adapter contract spike only.",
      "Agent CLI spawn and resume are represented as planned shape, never as runtime actions.",
      "The only accepted task input is a validated SubagentTaskEnvelope backed by Phase 26 replacement proof.",
    ],
  };
}
