import { validateSubagentTaskEnvelope } from "./envelopeValidator";
import type {
  AgentCliMockRunnerHardLocks,
  AgentCliMockRunnerState,
} from "./agentCliMockRunner";
import { agentCliMockRunnerHardLocks, agentCliMockRunnerPhase } from "./agentCliMockRunner";
import type { SubagentTaskEnvelope } from "./types";

export const codexCliAdapterSpikeSchemaVersion = "0.1.0";
export const codexCliAdapterSpikePhaseId = "phase_29_codex_cli_adapter_spike";
export const codexCliAdapterSpikeMode = "adapter_contract_spike";

export type CodexCliAdapterSpikeReadiness = "ready" | "blocked";
export type CodexCliAdapterSpikeResultStatus = "planned" | "blocked";

export interface CodexCliAdapterSpikeExecutionPolicy {
  liveSubmitAllowed: false;
  actualSpawnAllowed: false;
  actualResumeAllowed: false;
  providerSubmitAllowed: false;
  credentialAccessAllowed: false;
  arbitraryShellAllowed: false;
  fileMutationAllowed: false;
  freeTextTaskAllowed: false;
}

export interface CodexCliAdapterSpikeInputContract {
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

export interface CodexCliAdapterSpikeAdapterShape {
  adapterKind: "codex_cli_contract_shape";
  spawn: {
    operation: "codex_cli_spawn";
    status: "planned_contract_only";
    actualSpawnAllowed: false;
    argumentsSource: "validated_envelope_summary";
  };
  resume: {
    operation: "codex_cli_resume";
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

export interface CodexCliAdapterSpikeResultContract {
  resultKind: "subagent_result_v1_codex_cli_adapter_spike";
  status: CodexCliAdapterSpikeResultStatus;
  structured: true;
  expectedResultSchema: "subagent_result_v1";
  parserExpectation: "parse_structured_result_only";
  freeTextAccepted: false;
  notRealExecution: true;
}

export interface CodexCliAdapterSpikeReplacementProof {
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

export interface CodexCliAdapterSpikeHardLocks {
  phase26ReplacementProofRequired: true;
  validatedEnvelopeRequired: true;
  structuredResultRequired: true;
  noActualCodexSpawn: true;
  noActualCodexResume: true;
  noProviderSubmit: true;
  liveSubmitAllowed: false;
  noCredentialAccess: true;
  noArbitraryShell: true;
  noFileMutation: true;
  noFreeTextTask: true;
  adapterContractOnly: true;
}

export interface CodexCliAdapterSpikeBuildOptions {
  generatedAt?: string;
  phase26ReplacementProof?: AgentCliMockRunnerState;
  subagentTaskEnvelope?: SubagentTaskEnvelope;
  envelopeId?: string;
  executionPolicyOverride?: Partial<Record<keyof CodexCliAdapterSpikeExecutionPolicy, boolean>>;
  hardLocksOverride?: Partial<Record<keyof CodexCliAdapterSpikeHardLocks, boolean>>;
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

export interface CodexCliAdapterSpikeState {
  schemaVersion: typeof codexCliAdapterSpikeSchemaVersion;
  phaseId: typeof codexCliAdapterSpikePhaseId;
  mode: typeof codexCliAdapterSpikeMode;
  generatedAt: string;
  readiness: CodexCliAdapterSpikeReadiness;
  executionPolicy: CodexCliAdapterSpikeExecutionPolicy;
  inputContract: CodexCliAdapterSpikeInputContract;
  adapterShape: CodexCliAdapterSpikeAdapterShape;
  resultContract: CodexCliAdapterSpikeResultContract;
  replacementProof: CodexCliAdapterSpikeReplacementProof;
  roadmapEvidence: {
    phaseId: typeof codexCliAdapterSpikePhaseId;
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
  hardLocks: CodexCliAdapterSpikeHardLocks;
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

export const codexCliAdapterSpikeExecutionPolicy: CodexCliAdapterSpikeExecutionPolicy = {
  liveSubmitAllowed: false,
  actualSpawnAllowed: false,
  actualResumeAllowed: false,
  providerSubmitAllowed: false,
  credentialAccessAllowed: false,
  arbitraryShellAllowed: false,
  fileMutationAllowed: false,
  freeTextTaskAllowed: false,
};

export const codexCliAdapterSpikeHardLocks: CodexCliAdapterSpikeHardLocks = {
  phase26ReplacementProofRequired: true,
  validatedEnvelopeRequired: true,
  structuredResultRequired: true,
  noActualCodexSpawn: true,
  noActualCodexResume: true,
  noProviderSubmit: true,
  liveSubmitAllowed: false,
  noCredentialAccess: true,
  noArbitraryShell: true,
  noFileMutation: true,
  noFreeTextTask: true,
  adapterContractOnly: true,
};

const defaultGeneratedAt = "1970-01-01T00:00:00.000Z";

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function hardLockDrift<T extends object>(actual: T | undefined, expected: T, prefix: string): string[] {
  if (!actual) return [`${prefix}_hard_locks_missing`];
  const actualRecord = actual as Record<string, boolean>;
  const expectedRecord = expected as Record<string, boolean>;

  return Object.entries(expectedRecord).flatMap(([key, expectedValue]) =>
    actualRecord[key] === expectedValue ? [] : [`${prefix}_hard_lock_drift:${key}`],
  );
}

function replacementProofSummary(proof: AgentCliMockRunnerState | undefined): CodexCliAdapterSpikeReplacementProof {
  return {
    sourcePhase: agentCliMockRunnerPhase,
    present: Boolean(proof),
    replacementProofReady: proof?.replacementProofReady === true,
    receiptId: proof?.receipt.receiptId,
    readySlotCount: proof?.readySlots.length || 0,
    blockedSlotCount: proof?.blockedSlots.length || 0,
    noopResultKinds: uniqueSorted(proof?.noopResults.map((result) => result.resultKind) || []),
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

function inputContract(options: CodexCliAdapterSpikeBuildOptions): CodexCliAdapterSpikeInputContract {
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

function envelopeBlockers(options: CodexCliAdapterSpikeBuildOptions): string[] {
  const envelope = options.subagentTaskEnvelope;
  const validation = envelope
    ? validateSubagentTaskEnvelope(envelope)
    : { valid: false, issues: ["subagent_task_envelope_missing"] };
  const proofEnvelopeIds = uniqueSorted(
    [
      ...(options.phase26ReplacementProof?.readySlots.map((slot) => slot.envelopeId || "") || []),
      ...(options.phase26ReplacementProof?.noopResults.map((result) => result.envelopeId || "") || []),
    ],
  );

  return [
    ...(!envelope ? ["validated_subagent_task_envelope_required"] : []),
    ...(envelope && !validation.valid ? validation.issues.map((issue) => `invalid_envelope:${issue}`) : []),
    ...(options.envelopeId && envelope && options.envelopeId !== envelope.id ? ["input_envelope_id_mismatch"] : []),
    ...(envelope && proofEnvelopeIds.length > 0 && !proofEnvelopeIds.includes(envelope.id)
      ? ["phase_26_proof_envelope_id_mismatch"]
      : []),
  ];
}

function policyBlockers(policy: CodexCliAdapterSpikeExecutionPolicy): string[] {
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

function attemptedActionBlockers(options: CodexCliAdapterSpikeBuildOptions): string[] {
  return [
    ...(options.liveSubmitAttempted ? ["live_submit_attempt_blocked"] : []),
    ...(options.actualSpawnAttempted ? ["actual_spawn_attempt_blocked"] : []),
    ...(options.actualResumeAttempted ? ["actual_resume_attempt_blocked"] : []),
    ...(options.providerSubmitAttempted ? ["provider_submit_attempt_blocked"] : []),
    ...(options.credentialAccessAttempted ? ["credential_access_attempt_blocked"] : []),
    ...(options.arbitraryShellAttempted ? ["arbitrary_shell_attempt_blocked"] : []),
    ...(options.fileMutationAttempted ? ["file_mutation_attempt_blocked"] : []),
    ...(options.freeTextTaskAttempted ? ["free_text_task_attempt_blocked"] : []),
  ];
}

function resultContractBlockers(options: CodexCliAdapterSpikeBuildOptions): string[] {
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

export function validateCodexCliAdapterSpikeHardLocks(hardLocks: CodexCliAdapterSpikeHardLocks): string[] {
  return hardLockDrift(hardLocks, codexCliAdapterSpikeHardLocks, "codex_cli_adapter_spike");
}

export function buildCodexCliAdapterSpikeState(
  options: CodexCliAdapterSpikeBuildOptions = {},
): CodexCliAdapterSpikeState {
  const generatedAt = options.generatedAt || defaultGeneratedAt;
  const executionPolicy = {
    ...codexCliAdapterSpikeExecutionPolicy,
    ...options.executionPolicyOverride,
  } as CodexCliAdapterSpikeExecutionPolicy;
  const hardLocks = {
    ...codexCliAdapterSpikeHardLocks,
    ...options.hardLocksOverride,
  } as CodexCliAdapterSpikeHardLocks;
  const contract = inputContract(options);
  const blockers = uniqueSorted([
    ...phase26Blockers(options.phase26ReplacementProof),
    ...envelopeBlockers(options),
    ...policyBlockers(executionPolicy),
    ...hardLockDrift(hardLocks, codexCliAdapterSpikeHardLocks, "codex_cli_adapter_spike"),
    ...attemptedActionBlockers(options),
    ...resultContractBlockers(options),
  ]);
  const readiness: CodexCliAdapterSpikeReadiness = blockers.length ? "blocked" : "ready";
  const status: CodexCliAdapterSpikeResultStatus = readiness === "ready" ? "planned" : "blocked";
  const hardLockErrors = hardLockDrift(hardLocks, codexCliAdapterSpikeHardLocks, "codex_cli_adapter_spike");

  return {
    schemaVersion: codexCliAdapterSpikeSchemaVersion,
    phaseId: codexCliAdapterSpikePhaseId,
    mode: codexCliAdapterSpikeMode,
    generatedAt,
    readiness,
    executionPolicy,
    inputContract: contract,
    adapterShape: {
      adapterKind: "codex_cli_contract_shape",
      spawn: {
        operation: "codex_cli_spawn",
        status: "planned_contract_only",
        actualSpawnAllowed: false,
        argumentsSource: "validated_envelope_summary",
      },
      resume: {
        operation: "codex_cli_resume",
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
      resultKind: "subagent_result_v1_codex_cli_adapter_spike",
      status,
      structured: true,
      expectedResultSchema: "subagent_result_v1",
      parserExpectation: "parse_structured_result_only",
      freeTextAccepted: false,
      notRealExecution: true,
    },
    replacementProof: replacementProofSummary(options.phase26ReplacementProof),
    roadmapEvidence: {
      phaseId: codexCliAdapterSpikePhaseId,
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
      "Codex CLI spawn and resume are represented as planned shape, never as runtime actions.",
      "The only accepted task input is a validated SubagentTaskEnvelope backed by Phase 26 replacement proof.",
    ],
  };
}
