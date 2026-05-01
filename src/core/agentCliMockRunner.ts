import { validateSubagentTaskEnvelope } from "./envelopeValidator";
import type { SubagentRuntimeGateReceipt } from "./subagentRuntimeGate";
import type { GateSet, SubagentIssue, SubagentResult, SubagentTaskEnvelope } from "./types";

export const agentCliMockRunnerSchemaVersion = "0.1.0";
export const agentCliMockRunnerPhase = "phase_26_agent_cli_mock_runner";

export type AgentCliMockRunnerKind = "mock_noop";
export type AgentCliMockRunnerPurpose = "prove_replaceable_runner_contract";
export type AgentCliMockRunnerReadiness = "ready_for_phase_29_adapter_spike" | "blocked";
export type AgentCliMockRunnerSlotStatus = "ready" | "blocked";
export type AgentCliMockResultStatus = "planned" | "blocked" | "noop";

export interface AgentCliMockRunnerHardLocks {
  noCodexSpawn: true;
  noCodexResume: true;
  noProviderSubmit: true;
  liveSubmitAllowed: false;
  noCredentialRead: true;
  noCredentialWrite: true;
  noShellExecution: true;
  noFileMutation: true;
  validatedEnvelopeRequired: true;
  structuredResultRequired: true;
  noFreeTextWorker: true;
  mockOnly: true;
}

export interface AgentCliMockScenarioInput {
  scenarioId: string;
  label?: string;
  resultStatus?: AgentCliMockResultStatus;
}

export interface AgentCliMockStructuredResult {
  resultId: string;
  resultKind: "subagent_result_v1_mock_noop";
  status: AgentCliMockResultStatus;
  envelopeId?: string;
  taskId?: string;
  shotId?: string;
  sourceRefs: string[];
  inspectedFiles: SubagentResult["inspectedFiles"];
  gates: GateSet;
  overallVisualVerdict: "N/A";
  styleQa: "N/A";
  motionQa: "N/A";
  continuityQa: "N/A";
  referenceUseDecision: "draft_only";
  issues: SubagentIssue[];
  requiredFixes: string[];
  approvedFor: string[];
  rejectedFor: string[];
  summaryForMainAgent: string;
  notRealExecution: true;
}

export interface AgentCliMockRunnerSlot {
  runnerSlotId: string;
  scenarioId: string;
  envelopeId?: string;
  taskId?: string;
  shotId?: string;
  status: AgentCliMockRunnerSlotStatus;
  blockedReasons: string[];
  noopResult: AgentCliMockStructuredResult;
}

export interface AgentCliMockRunnerInput {
  generatedAt?: string;
  gateReceipt?: SubagentRuntimeGateReceipt;
  subagentTaskEnvelope?: SubagentTaskEnvelope;
  envelopeId?: string;
  mockScenarios?: AgentCliMockScenarioInput[];
  resultTemplate?: Partial<AgentCliMockStructuredResult>;
  providerSubmitAttempted?: boolean;
  freeTextPromptAttempted?: boolean;
  hardLocksOverride?: Partial<Record<keyof AgentCliMockRunnerHardLocks, boolean>>;
}

export interface AgentCliMockRunnerReceipt {
  receiptId: string;
  phase: typeof agentCliMockRunnerPhase;
  runnerKind: AgentCliMockRunnerKind;
  purpose: AgentCliMockRunnerPurpose;
  replacementProofReady: boolean;
  blockedReasons: string[];
  sourceRefs: string[];
}

export interface AgentCliMockRunnerState {
  schemaVersion: typeof agentCliMockRunnerSchemaVersion;
  phase: typeof agentCliMockRunnerPhase;
  generatedAt: string;
  runnerKind: AgentCliMockRunnerKind;
  purpose: AgentCliMockRunnerPurpose;
  readiness: AgentCliMockRunnerReadiness;
  replacementProofReady: boolean;
  readySlots: AgentCliMockRunnerSlot[];
  blockedSlots: AgentCliMockRunnerSlot[];
  noopResults: AgentCliMockStructuredResult[];
  adapterBoundary: {
    inputContract: "validated_subagent_task_envelope_only";
    outputContract: "structured_subagent_result_shape_only";
    runnerContract: "replaceable_agent_cli_adapter";
    phase26Boundary: "mock_noop_only";
    phase29Boundary: "codex_cli_adapter_spike_after_replacement_proof";
    providerSubmitAllowed: false;
    shellAllowed: false;
    fileMutationAllowed: false;
  };
  hardLocks: AgentCliMockRunnerHardLocks;
  receipt: AgentCliMockRunnerReceipt;
  validation: {
    ok: boolean;
    errors: string[];
    warnings: string[];
    checkedAt: string;
  };
  notes: string[];
}

export const agentCliMockRunnerHardLocks: AgentCliMockRunnerHardLocks = {
  noCodexSpawn: true,
  noCodexResume: true,
  noProviderSubmit: true,
  liveSubmitAllowed: false,
  noCredentialRead: true,
  noCredentialWrite: true,
  noShellExecution: true,
  noFileMutation: true,
  validatedEnvelopeRequired: true,
  structuredResultRequired: true,
  noFreeTextWorker: true,
  mockOnly: true,
};

const defaultGeneratedAt = "1970-01-01T00:00:00.000Z";

const gateHardLockExpectations = {
  noFreeTextWorker: true,
  validatedEnvelopeRequired: true,
  structuredResultRequired: true,
  noSpawnNow: true,
  noShellExecution: true,
  noProviderSubmit: true,
  liveSubmitAllowed: false,
  noCredentialRead: true,
  noCredentialWrite: true,
  noFileMutation: true,
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function hardLockDrift<T extends object>(actual: T | undefined, expected: T, prefix: string): string[] {
  if (!actual) return [`${prefix}_hard_locks_missing`];
  const actualRecord = actual as Record<string, boolean>;
  const expectedRecord = expected as Record<string, boolean>;

  return Object.entries(expectedRecord).flatMap(([key, expectedValue]) =>
    actualRecord[key] === expectedValue ? [] : [`${prefix}_hard_lock_drift:${key}`],
  );
}

function sourceRefs(input: {
  gateReceipt?: SubagentRuntimeGateReceipt;
  envelope?: SubagentTaskEnvelope;
  envelopeId?: string;
}): string[] {
  const subject = input.gateReceipt?.evidence.subject;
  return uniqueSorted([
    input.gateReceipt?.receiptId ? `gateReceipt:${input.gateReceipt.receiptId}` : "",
    subject?.workerSlotId ? `workerSlot:${subject.workerSlotId}` : "",
    input.envelope?.id ? `envelope:${input.envelope.id}` : "",
    input.envelopeId ? `inputEnvelopeId:${input.envelopeId}` : "",
    subject?.envelopeId ? `gateEnvelope:${subject.envelopeId}` : "",
    input.envelope?.parentTaskId ? `task:${input.envelope.parentTaskId}` : "",
    subject?.parentTaskId ? `gateTask:${subject.parentTaskId}` : "",
    input.envelope?.shotId ? `shot:${input.envelope.shotId}` : "",
  ]);
}

function defaultGates(): GateSet {
  return {
    identity: "N/A",
    scene: "N/A",
    pair: "N/A",
    story: "N/A",
    prop: "N/A",
    style: "N/A",
  };
}

function validateScenarioStatus(status: AgentCliMockResultStatus | undefined): AgentCliMockResultStatus {
  return status || "planned";
}

function resultFromTemplate(
  base: AgentCliMockStructuredResult,
  template: Partial<AgentCliMockStructuredResult> | undefined,
): AgentCliMockStructuredResult {
  if (!template) return base;

  return {
    ...base,
    inspectedFiles: template.inspectedFiles || base.inspectedFiles,
    gates: template.gates || base.gates,
    issues: template.issues || base.issues,
    requiredFixes: template.requiredFixes || base.requiredFixes,
    approvedFor: template.approvedFor || base.approvedFor,
    rejectedFor: template.rejectedFor || base.rejectedFor,
    summaryForMainAgent: template.summaryForMainAgent || base.summaryForMainAgent,
  };
}

function makeNoopResult(input: {
  scenario: AgentCliMockScenarioInput;
  envelope?: SubagentTaskEnvelope;
  gateReceipt?: SubagentRuntimeGateReceipt;
  envelopeId?: string;
  blockedReasons: string[];
  sourceRefs: string[];
  resultTemplate?: Partial<AgentCliMockStructuredResult>;
}): AgentCliMockStructuredResult {
  const subject = input.gateReceipt?.evidence.subject;
  const envelopeId = input.envelope?.id || input.envelopeId || subject?.envelopeId;
  const taskId = input.envelope?.parentTaskId || subject?.parentTaskId;
  const blocked = input.blockedReasons.length > 0;
  const base: AgentCliMockStructuredResult = {
    resultId: `agent_cli_mock_result_${safeId(input.scenario.scenarioId)}_${safeId(envelopeId || "missing_envelope")}`,
    resultKind: "subagent_result_v1_mock_noop",
    status: blocked ? "blocked" : validateScenarioStatus(input.scenario.resultStatus),
    envelopeId,
    taskId,
    shotId: input.envelope?.shotId,
    sourceRefs: input.sourceRefs,
    inspectedFiles: [],
    gates: defaultGates(),
    overallVisualVerdict: "N/A",
    styleQa: "N/A",
    motionQa: "N/A",
    continuityQa: "N/A",
    referenceUseDecision: "draft_only",
    issues: [],
    requiredFixes: blocked ? input.blockedReasons : [],
    approvedFor: blocked ? [] : ["phase_29_adapter_contract_spike"],
    rejectedFor: blocked ? ["phase_26_mock_runner_replacement_proof"] : [],
    summaryForMainAgent: blocked
      ? "Phase 26 mock runner blocked before any agent or provider adapter boundary."
      : "Phase 26 mock runner produced a structured no-op result proving the runner contract can be replaced later.",
    notRealExecution: true,
  };

  return resultFromTemplate(base, input.resultTemplate);
}

function inputBlockers(input: {
  gateReceipt?: SubagentRuntimeGateReceipt;
  envelope?: SubagentTaskEnvelope;
  envelopeId?: string;
  providerSubmitAttempted: boolean;
  freeTextPromptAttempted: boolean;
  hardLocks: AgentCliMockRunnerHardLocks;
}): string[] {
  const envelopeValidation = input.envelope
    ? validateSubagentTaskEnvelope(input.envelope)
    : { valid: false, issues: ["subagent_task_envelope_missing"] };
  const gateReceipt = input.gateReceipt;
  const subject = gateReceipt?.evidence.subject;
  const providerGate = gateReceipt?.providerGate as
    | { providerSubmissionAttempted?: boolean; providerSubmissionForbidden?: boolean; liveSubmitAllowed?: boolean }
    | undefined;
  const commandPlanGate = gateReceipt?.commandPlanGate as
    | { argumentSourceObserved?: string; canSpawnNow?: boolean; canUseShell?: boolean; canSubmitProvider?: boolean }
    | undefined;

  return uniqueSorted([
    ...(!gateReceipt ? ["subagent_runtime_gate_receipt_missing"] : []),
    ...(gateReceipt && gateReceipt.readiness !== "ready_for_worker_permission_gate"
      ? [`subagent_runtime_gate_not_ready:${gateReceipt.readiness}`]
      : []),
    ...(gateReceipt && !gateReceipt.validation.ok ? ["subagent_runtime_gate_validation_not_ok"] : []),
    ...(gateReceipt?.blockedReasons.map((reason) => `subagent_runtime_gate_blocker:${reason}`) || []),
    ...(providerGate?.providerSubmissionAttempted ? ["subagent_runtime_gate_provider_submit_attempted"] : []),
    ...(providerGate?.liveSubmitAllowed ? ["subagent_runtime_gate_live_submit_allowed_drift"] : []),
    ...(providerGate && providerGate.providerSubmissionForbidden !== true
      ? ["subagent_runtime_gate_provider_submission_forbidden_not_pinned"]
      : []),
    ...(commandPlanGate?.argumentSourceObserved === "validated_envelope_only"
      ? []
      : ["subagent_runtime_gate_argument_source_not_validated_envelope_only"]),
    ...(commandPlanGate?.canSpawnNow === false ? [] : ["subagent_runtime_gate_can_spawn_now_not_false"]),
    ...(commandPlanGate?.canUseShell === false ? [] : ["subagent_runtime_gate_can_use_shell_not_false"]),
    ...(commandPlanGate?.canSubmitProvider === false ? [] : ["subagent_runtime_gate_can_submit_provider_not_false"]),
    ...hardLockDrift(gateReceipt?.hardLocks, gateHardLockExpectations, "subagent_runtime_gate"),
    ...hardLockDrift(input.hardLocks, agentCliMockRunnerHardLocks, "agent_cli_mock_runner"),
    ...(input.freeTextPromptAttempted ? ["free_text_prompt_attempt_blocked"] : []),
    ...(input.providerSubmitAttempted ? ["provider_submit_attempt_blocked"] : []),
    ...(!input.envelope ? ["validated_subagent_task_envelope_required"] : []),
    ...(input.envelope && !envelopeValidation.valid ? envelopeValidation.issues.map((issue) => `invalid_envelope:${issue}`) : []),
    ...(input.envelopeId && input.envelope && input.envelopeId !== input.envelope.id ? ["input_envelope_id_mismatch"] : []),
    ...(subject?.envelopeId && input.envelope && subject.envelopeId !== input.envelope.id
      ? ["gate_receipt_envelope_id_mismatch"]
      : []),
    ...(subject?.parentTaskId && input.envelope && subject.parentTaskId !== input.envelope.parentTaskId
      ? ["gate_receipt_task_id_mismatch"]
      : []),
  ]);
}

export function validateAgentCliMockRunnerHardLocks(hardLocks: AgentCliMockRunnerHardLocks): string[] {
  return hardLockDrift(hardLocks, agentCliMockRunnerHardLocks, "agent_cli_mock_runner");
}

export function buildAgentCliMockRunnerState(input: AgentCliMockRunnerInput = {}): AgentCliMockRunnerState {
  const generatedAt = input.generatedAt || defaultGeneratedAt;
  const hardLocks = { ...agentCliMockRunnerHardLocks, ...input.hardLocksOverride } as AgentCliMockRunnerHardLocks;
  const providerSubmitAttempted = Boolean(input.providerSubmitAttempted);
  const freeTextPromptAttempted = Boolean(input.freeTextPromptAttempted);
  const blockedReasons = inputBlockers({
    gateReceipt: input.gateReceipt,
    envelope: input.subagentTaskEnvelope,
    envelopeId: input.envelopeId,
    providerSubmitAttempted,
    freeTextPromptAttempted,
    hardLocks,
  });
  const scenarios = input.mockScenarios?.length
    ? input.mockScenarios
    : [{ scenarioId: "default_noop_plan", label: "default mock no-op", resultStatus: "planned" as const }];
  const refs = sourceRefs({
    gateReceipt: input.gateReceipt,
    envelope: input.subagentTaskEnvelope,
    envelopeId: input.envelopeId,
  });
  const slots = scenarios.map((scenario) => {
    const noopResult = makeNoopResult({
      scenario,
      envelope: input.subagentTaskEnvelope,
      gateReceipt: input.gateReceipt,
      envelopeId: input.envelopeId,
      blockedReasons,
      sourceRefs: refs,
      resultTemplate: input.resultTemplate,
    });

    return {
      runnerSlotId: `agent_cli_mock_runner_${safeId(scenario.scenarioId)}`,
      scenarioId: scenario.scenarioId,
      envelopeId: noopResult.envelopeId,
      taskId: noopResult.taskId,
      shotId: noopResult.shotId,
      status: blockedReasons.length ? "blocked" as const : "ready" as const,
      blockedReasons,
      noopResult,
    };
  });
  const readySlots = slots.filter((slot) => slot.status === "ready");
  const blockedSlots = slots.filter((slot) => slot.status === "blocked");
  const replacementProofReady = blockedReasons.length === 0 && readySlots.length > 0;
  const readiness: AgentCliMockRunnerReadiness = replacementProofReady ? "ready_for_phase_29_adapter_spike" : "blocked";
  const receiptId = `agent_cli_mock_runner_${safeId(input.subagentTaskEnvelope?.id || input.envelopeId || "missing")}`;

  return {
    schemaVersion: agentCliMockRunnerSchemaVersion,
    phase: agentCliMockRunnerPhase,
    generatedAt,
    runnerKind: "mock_noop",
    purpose: "prove_replaceable_runner_contract",
    readiness,
    replacementProofReady,
    readySlots,
    blockedSlots,
    noopResults: slots.map((slot) => slot.noopResult),
    adapterBoundary: {
      inputContract: "validated_subagent_task_envelope_only",
      outputContract: "structured_subagent_result_shape_only",
      runnerContract: "replaceable_agent_cli_adapter",
      phase26Boundary: "mock_noop_only",
      phase29Boundary: "codex_cli_adapter_spike_after_replacement_proof",
      providerSubmitAllowed: false,
      shellAllowed: false,
      fileMutationAllowed: false,
    },
    hardLocks,
    receipt: {
      receiptId,
      phase: agentCliMockRunnerPhase,
      runnerKind: "mock_noop",
      purpose: "prove_replaceable_runner_contract",
      replacementProofReady,
      blockedReasons,
      sourceRefs: refs,
    },
    validation: {
      ok: replacementProofReady,
      errors: blockedReasons,
      warnings: [],
      checkedAt: generatedAt,
    },
    notes: [
      "Phase 26 is a mock/no-op runner contract proof only.",
      "It consumes a ready Phase 24 gate receipt plus a validated SubagentTaskEnvelope and emits structured no-op results.",
      "Real Codex adapter work belongs to Phase 29 and provider submit remains blocked.",
    ],
  };
}
