import { validateSubagentTaskEnvelope } from "./envelopeValidator";
import type {
  ProjectFactsIntegrationHardLocks,
  ProjectFactsIntegrationState,
  ProjectFactsKind,
} from "./projectFactsIntegration";
import type {
  SubagentWorkerRuntimeHardLocks,
  SubagentWorkerRuntimePlan,
  SubagentWorkerRuntimeSlot,
} from "./subagentWorkerRuntime";
import type { SubagentTaskEnvelope } from "./types";

export const subagentRuntimeGateSchemaVersion = "0.1.0";
export const subagentRuntimeGatePhase = "phase_24_subagent_runtime_gate";

export type SubagentRuntimeGateReadiness = "ready_for_worker_permission_gate" | "blocked";
export type SubagentRuntimeGateEvidencePresence = "present" | "missing";
export type SubagentRuntimeGateSubjectSource =
  | "subagent_task_envelope"
  | "worker_runtime_slot"
  | "worker_runtime_plan_slot"
  | "missing";

export interface SubagentRuntimeGateHardLocks {
  noFreeTextWorker: true;
  validatedEnvelopeRequired: true;
  structuredResultRequired: true;
  noSpawnNow: true;
  noShellExecution: true;
  noProviderSubmit: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  noCredentialRead: true;
  noCredentialWrite: true;
  noFileMutation: true;
  projectFactsEvidenceRequired: true;
  workerRuntimePlanEvidenceRequired: true;
  runtimeStateSourceOfTruthForbidden: true;
}

export interface SubagentRuntimeGateInput {
  generatedAt?: string;
  projectFactsEvidence?: ProjectFactsIntegrationState;
  workerRuntimePlanEvidence?: SubagentWorkerRuntimePlan;
  subagentTaskEnvelopeEvidence?: SubagentTaskEnvelope;
  workerRuntimeSlotEvidence?: SubagentWorkerRuntimeSlot;
  providerSubmissionAttempted?: boolean;
}

export interface SubagentRuntimeGateProjectFactsEvidence {
  presence: SubagentRuntimeGateEvidencePresence;
  status: ProjectFactsIntegrationState["status"] | "missing";
  projectId?: string;
  ready: boolean;
  runtimeStateSourceOfTruthRefs: string[];
  hardLockDrift: string[];
  factBlockers: string[];
  blockers: string[];
  sourceRefs: string[];
}

export interface SubagentRuntimeGateWorkerRuntimeEvidence {
  presence: SubagentRuntimeGateEvidencePresence;
  phase?: SubagentWorkerRuntimePlan["phase"];
  runtimeMode?: SubagentWorkerRuntimePlan["runtimeMode"];
  validationOk: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  hardLockDrift: string[];
  blockedSlotReasons: string[];
  freeTextSlotIds: string[];
  providerSubmissionForbidden: boolean;
  liveSubmitAllowed: boolean;
  totalSlots: number;
  readyForPermissionGate: number;
  blockers: string[];
}

export interface SubagentRuntimeGateSubjectEvidence {
  source: SubagentRuntimeGateSubjectSource;
  envelopeId?: string;
  parentTaskId?: string;
  workerSlotId?: string;
  envelopeValidationStatus: "missing" | "valid" | "invalid";
  envelopeValidationIssues: string[];
  slotStatus?: SubagentWorkerRuntimeSlot["status"];
  freeTextPromptPresent: boolean;
  commandPlanPresent: boolean;
  commandPlanArgumentSource?: string;
  canSpawnNow?: boolean;
  canUseShell?: boolean;
  canSubmitProvider?: boolean;
  expectedResultSchema?: string;
  blockers: string[];
}

export interface SubagentRuntimeGateRoadmapEvidence {
  phaseId: typeof subagentRuntimeGatePhase;
  projectFactsValidated: boolean;
  subagentEnvelopeValidatorReady: boolean;
  workerPermissionGateReady: boolean;
  gateReceiptId: string;
  readiness: SubagentRuntimeGateReadiness;
}

export interface SubagentRuntimeGateReceipt {
  schemaVersion: typeof subagentRuntimeGateSchemaVersion;
  phase: typeof subagentRuntimeGatePhase;
  receiptId: string;
  generatedAt: string;
  readiness: SubagentRuntimeGateReadiness;
  blockedReasons: string[];
  evidence: {
    projectFacts: SubagentRuntimeGateProjectFactsEvidence;
    workerRuntime: SubagentRuntimeGateWorkerRuntimeEvidence;
    subject: SubagentRuntimeGateSubjectEvidence;
  };
  hardLocks: SubagentRuntimeGateHardLocks;
  commandPlanGate: {
    argumentSourceRequired: "validated_envelope_only";
    argumentSourceObserved?: string;
    canSpawnNow: false;
    canUseShell: false;
    canSubmitProvider: false;
    expectedResultSchema: "subagent_result_v1";
  };
  providerGate: {
    providerSubmissionForbidden: true;
    liveSubmitAllowed: false;
    providerSubmissionAttempted: boolean;
  };
  validation: {
    ok: boolean;
    errors: string[];
    warnings: string[];
    checkedAt: string;
  };
  roadmapEvidence: SubagentRuntimeGateRoadmapEvidence;
  notes: string[];
}

export const subagentRuntimeGateHardLocks: SubagentRuntimeGateHardLocks = {
  noFreeTextWorker: true,
  validatedEnvelopeRequired: true,
  structuredResultRequired: true,
  noSpawnNow: true,
  noShellExecution: true,
  noProviderSubmit: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
  noCredentialRead: true,
  noCredentialWrite: true,
  noFileMutation: true,
  projectFactsEvidenceRequired: true,
  workerRuntimePlanEvidenceRequired: true,
  runtimeStateSourceOfTruthForbidden: true,
};

const defaultGeneratedAt = "1970-01-01T00:00:00.000Z";

const projectFactsHardLockExpectations: ProjectFactsIntegrationHardLocks = {
  dryRunOnly: true,
  noFileMutation: true,
  noDirectoryCreate: true,
  noProviderSubmit: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noImageGeneration: true,
  noVideoGeneration: true,
  noTextToVideo: true,
  noFastVip: true,
  image2Preferred: true,
  seedanceJimengVideoParked: true,
  projectFactsAreProjectLocal: true,
  assetLibraryIsNotGallery: true,
  runtimeStateIsDerivedCache: true,
};

const workerRuntimeHardLockExpectations: SubagentWorkerRuntimeHardLocks = {
  noFreeTextTask: true,
  validatedEnvelopeRequired: true,
  structuredResultRequired: true,
  noSpawnWorkerNow: true,
  noSubprocess: true,
  noShellExecution: true,
  noProviderExecution: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noFileMutation: true,
  noProjectStoreWrite: true,
  noUnscopedRead: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
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

function projectFactBlockers(state: ProjectFactsIntegrationState): string[] {
  return Object.entries(state.facts).flatMap(([kind, fact]) =>
    fact.blockers.map((blocker) => `project_fact_blocker:${kind}:${blocker}`),
  );
}

function projectFactSourceRefs(state: ProjectFactsIntegrationState): string[] {
  return uniqueSorted(
    Object.entries(state.facts).flatMap(([kind, fact]) =>
      fact.sourceRefs.length ? fact.sourceRefs.map((ref) => `${kind}:${ref}`) : [],
    ),
  );
}

function runtimeStateSourceOfTruthRefs(state: ProjectFactsIntegrationState): string[] {
  return Object.entries(state.facts).flatMap(([kind, fact]) =>
    String(fact.sourceOfTruth) === "runtime_state"
      ? [`${kind as ProjectFactsKind}:${fact.sourceRefs.join(",") || "runtime_state"}`]
      : [],
  );
}

function evaluateProjectFacts(
  state: ProjectFactsIntegrationState | undefined,
): SubagentRuntimeGateProjectFactsEvidence {
  if (!state) {
    return {
      presence: "missing",
      status: "missing",
      ready: false,
      runtimeStateSourceOfTruthRefs: [],
      hardLockDrift: [],
      factBlockers: [],
      blockers: ["project_facts_evidence_missing"],
      sourceRefs: [],
    };
  }

  const runtimeStateRefs = runtimeStateSourceOfTruthRefs(state);
  const hardLockDriftReasons = hardLockDrift(state.hardLocks, projectFactsHardLockExpectations, "project_facts");
  const factBlockers = projectFactBlockers(state);
  const blockers = uniqueSorted([
    ...(state.status === "ready" ? [] : [`project_facts_not_ready:${state.status}`]),
    ...runtimeStateRefs.map((ref) => `runtime_state_source_of_truth_forbidden:${ref}`),
    ...hardLockDriftReasons,
    ...factBlockers,
  ]);

  return {
    presence: "present",
    status: state.status,
    projectId: state.projectId,
    ready: blockers.length === 0,
    runtimeStateSourceOfTruthRefs: runtimeStateRefs,
    hardLockDrift: hardLockDriftReasons,
    factBlockers,
    blockers,
    sourceRefs: projectFactSourceRefs(state),
  };
}

function workerRuntimeBlockedSlotReasons(plan: SubagentWorkerRuntimePlan): string[] {
  return plan.slots.flatMap((slot) =>
    slot.blockedReasons.map((reason) => `worker_runtime_slot_blocked:${slot.workerSlotId}:${reason}`),
  );
}

function evaluateWorkerRuntime(
  plan: SubagentWorkerRuntimePlan | undefined,
): SubagentRuntimeGateWorkerRuntimeEvidence {
  if (!plan) {
    return {
      presence: "missing",
      validationOk: false,
      validationErrors: [],
      validationWarnings: [],
      hardLockDrift: [],
      blockedSlotReasons: [],
      freeTextSlotIds: [],
      providerSubmissionForbidden: false,
      liveSubmitAllowed: true,
      totalSlots: 0,
      readyForPermissionGate: 0,
      blockers: ["subagent_worker_runtime_plan_evidence_missing"],
    };
  }

  const hardLockDriftReasons = hardLockDrift(
    plan.hardLocks,
    workerRuntimeHardLockExpectations,
    "worker_runtime",
  );
  const blockedSlotReasons = workerRuntimeBlockedSlotReasons(plan);
  const freeTextSlotIds = plan.slots
    .filter((slot) => slot.freeTextPromptPresent)
    .map((slot) => slot.workerSlotId);
  const summary = plan.summary as { providerSubmissionForbidden?: boolean; liveSubmitAllowed?: boolean };
  const locks = plan.hardLocks as { providerSubmissionForbidden?: boolean; liveSubmitAllowed?: boolean };
  const providerSubmissionForbidden = summary.providerSubmissionForbidden === true
    && locks.providerSubmissionForbidden === true;
  const liveSubmitAllowed = summary.liveSubmitAllowed === true || locks.liveSubmitAllowed === true;
  const blockers = uniqueSorted([
    ...(plan.validation.ok ? [] : ["worker_runtime_validation_not_ok"]),
    ...(plan.validation.errors.length ? ["worker_runtime_validation_errors_present"] : []),
    ...plan.validation.errors.map((error) => `worker_runtime_validation_error:${error}`),
    ...hardLockDriftReasons,
    ...blockedSlotReasons,
    ...freeTextSlotIds.map((slotId) => `free_text_worker_start_forbidden:${slotId}`),
    ...(providerSubmissionForbidden ? [] : ["worker_runtime_provider_submission_forbidden_not_pinned"]),
    ...(liveSubmitAllowed ? ["worker_runtime_live_submit_allowed_drift"] : []),
  ]);

  return {
    presence: "present",
    phase: plan.phase,
    runtimeMode: plan.runtimeMode,
    validationOk: plan.validation.ok && plan.validation.errors.length === 0,
    validationErrors: plan.validation.errors,
    validationWarnings: plan.validation.warnings,
    hardLockDrift: hardLockDriftReasons,
    blockedSlotReasons,
    freeTextSlotIds,
    providerSubmissionForbidden,
    liveSubmitAllowed,
    totalSlots: plan.summary.totalSlots,
    readyForPermissionGate: plan.summary.readyForPermissionGate,
    blockers,
  };
}

function findPlanSlot(
  plan: SubagentWorkerRuntimePlan | undefined,
  envelope: SubagentTaskEnvelope | undefined,
): SubagentWorkerRuntimeSlot | undefined {
  if (!plan || !envelope) return undefined;
  return plan.slots.find((slot) => slot.envelopeId === envelope.id);
}

function selectedSubject(input: SubagentRuntimeGateInput): {
  source: SubagentRuntimeGateSubjectSource;
  envelope?: SubagentTaskEnvelope;
  slot?: SubagentWorkerRuntimeSlot;
} {
  if (input.workerRuntimeSlotEvidence) {
    return {
      source: "worker_runtime_slot",
      envelope: input.subagentTaskEnvelopeEvidence,
      slot: input.workerRuntimeSlotEvidence,
    };
  }

  const planSlot = findPlanSlot(input.workerRuntimePlanEvidence, input.subagentTaskEnvelopeEvidence);
  if (planSlot) {
    return {
      source: "worker_runtime_plan_slot",
      envelope: input.subagentTaskEnvelopeEvidence,
      slot: planSlot,
    };
  }

  if (input.subagentTaskEnvelopeEvidence) {
    return {
      source: "subagent_task_envelope",
      envelope: input.subagentTaskEnvelopeEvidence,
      slot: undefined,
    };
  }

  return {
    source: "missing",
    envelope: undefined,
    slot: undefined,
  };
}

function validateSubjectEnvelope(
  envelope: SubagentTaskEnvelope | undefined,
  slot: SubagentWorkerRuntimeSlot | undefined,
): { status: "missing" | "valid" | "invalid"; issues: string[] } {
  if (envelope) {
    const result = validateSubagentTaskEnvelope(envelope);
    return {
      status: result.valid ? "valid" : "invalid",
      issues: result.issues,
    };
  }

  if (slot) {
    return {
      status: slot.envelopeValidation.status,
      issues: slot.envelopeValidation.issues,
    };
  }

  return {
    status: "missing",
    issues: ["subagent_task_envelope_or_worker_slot_evidence_required"],
  };
}

function hasItems(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function phase38EnvelopeRequirementIssues(envelope: SubagentTaskEnvelope | undefined): string[] {
  if (!envelope) return ["phase38_envelope_missing"];

  const hasPrevious = envelope.neighborShots.some((shot) => shot.position === "previous");
  const hasNext = envelope.neighborShots.some((shot) => shot.position === "next");
  const hasHardNegatives =
    hasItems(envelope.mustNotAdd) ||
    hasItems(envelope.forbiddenReferences) ||
    hasItems(envelope.taskEnvelope.hardRules);

  return uniqueSorted([
    envelope.userIntent && envelope.storyFunction && envelope.shotId ? "" : "phase38_context_capsule_missing",
    hasItems(envelope.lockedReferences) && hasItems(envelope.authorityPriority) ? "" : "phase38_reference_authority_missing",
    hasPrevious && hasNext ? "" : "phase38_before_after_shots_missing",
    hasItems(envelope.taskEnvelope.expectedOutputs) ? "" : "phase38_expected_output_missing",
    hasHardNegatives ? "" : "phase38_hard_negatives_missing",
    hasItems(envelope.qaChecklist) ? "" : "phase38_qa_checklist_missing",
    envelope.expectedOutputContract?.format === "subagent_result_v1" &&
    hasItems(envelope.expectedOutputContract.requiredFields)
      ? ""
      : "phase38_output_contract_missing",
  ]);
}

function evaluateSubject(input: SubagentRuntimeGateInput): SubagentRuntimeGateSubjectEvidence {
  const subject = selectedSubject(input);
  const envelopeValidation = validateSubjectEnvelope(subject.envelope, subject.slot);
  const commandPlan = subject.slot?.commandPlan;
  const envelopeId = subject.envelope?.id || subject.slot?.envelopeId;
  const phase38Issues = phase38EnvelopeRequirementIssues(subject.envelope);
  const blockers = uniqueSorted([
    ...(subject.source === "missing" ? ["subagent_task_envelope_or_worker_slot_evidence_required"] : []),
    ...(subject.source === "subagent_task_envelope" ? ["worker_runtime_slot_evidence_missing_for_envelope"] : []),
    ...(envelopeValidation.status === "valid"
      ? []
      : envelopeValidation.issues.map((issue) => `invalid_envelope:${issue}`)),
    ...(subject.envelope && subject.slot?.envelopeId && subject.envelope.id !== subject.slot.envelopeId
      ? ["worker_slot_envelope_id_mismatch"]
      : []),
    ...phase38Issues,
    ...(subject.slot && subject.slot.status !== "ready_for_permission_gate"
      ? [`worker_slot_not_ready_for_permission_gate:${subject.slot.status}`]
      : []),
    ...(subject.slot?.freeTextPromptPresent ? ["free_text_worker_start_forbidden"] : []),
    ...(commandPlan ? [] : ["validated_envelope_command_plan_missing"]),
    ...(commandPlan?.argumentSource === "validated_envelope_only"
      ? []
      : ["command_plan_argument_source_not_validated_envelope_only"]),
    ...(commandPlan?.canSpawnNow === false ? [] : ["command_plan_can_spawn_now_not_false"]),
    ...(commandPlan?.canUseShell === false ? [] : ["command_plan_can_use_shell_not_false"]),
    ...(commandPlan?.canSubmitProvider === false ? [] : ["command_plan_can_submit_provider_not_false"]),
    ...(commandPlan?.expectedResultSchema === "subagent_result_v1"
      ? []
      : ["command_plan_expected_result_schema_not_subagent_result_v1"]),
  ]);

  return {
    source: subject.source,
    envelopeId,
    parentTaskId: subject.envelope?.parentTaskId || subject.slot?.parentTaskId,
    workerSlotId: subject.slot?.workerSlotId,
    envelopeValidationStatus: envelopeValidation.status,
    envelopeValidationIssues: envelopeValidation.issues,
    slotStatus: subject.slot?.status,
    freeTextPromptPresent: subject.slot?.freeTextPromptPresent || false,
    commandPlanPresent: Boolean(commandPlan),
    commandPlanArgumentSource: commandPlan?.argumentSource,
    canSpawnNow: commandPlan?.canSpawnNow,
    canUseShell: commandPlan?.canUseShell,
    canSubmitProvider: commandPlan?.canSubmitProvider,
    expectedResultSchema: commandPlan?.expectedResultSchema,
    blockers,
  };
}

export function validateSubagentRuntimeGateHardLocks(
  hardLocks: SubagentRuntimeGateHardLocks,
): string[] {
  return hardLockDrift(hardLocks, subagentRuntimeGateHardLocks, "subagent_runtime_gate");
}

export function buildSubagentRuntimeGateReceipt(input: SubagentRuntimeGateInput = {}): SubagentRuntimeGateReceipt {
  const generatedAt = input.generatedAt || defaultGeneratedAt;
  const projectFacts = evaluateProjectFacts(input.projectFactsEvidence);
  const workerRuntime = evaluateWorkerRuntime(input.workerRuntimePlanEvidence);
  const subject = evaluateSubject(input);
  const providerSubmissionAttempted = Boolean(input.providerSubmissionAttempted);
  const providerBlockers = providerSubmissionAttempted ? ["provider_submit_attempt_blocked"] : [];
  const blockedReasons = uniqueSorted([
    ...projectFacts.blockers,
    ...workerRuntime.blockers,
    ...subject.blockers,
    ...providerBlockers,
  ]);
  const readiness: SubagentRuntimeGateReadiness = blockedReasons.length
    ? "blocked"
    : "ready_for_worker_permission_gate";
  const receiptId = `subagent_runtime_gate_${safeId(subject.envelopeId || subject.workerSlotId || "missing")}`;

  return {
    schemaVersion: subagentRuntimeGateSchemaVersion,
    phase: subagentRuntimeGatePhase,
    receiptId,
    generatedAt,
    readiness,
    blockedReasons,
    evidence: {
      projectFacts,
      workerRuntime,
      subject,
    },
    hardLocks: subagentRuntimeGateHardLocks,
    commandPlanGate: {
      argumentSourceRequired: "validated_envelope_only",
      argumentSourceObserved: subject.commandPlanArgumentSource,
      canSpawnNow: false,
      canUseShell: false,
      canSubmitProvider: false,
      expectedResultSchema: "subagent_result_v1",
    },
    providerGate: {
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      providerSubmissionAttempted,
    },
    validation: {
      ok: readiness === "ready_for_worker_permission_gate",
      errors: blockedReasons,
      warnings: uniqueSorted(workerRuntime.validationWarnings),
      checkedAt: generatedAt,
    },
    roadmapEvidence: {
      phaseId: subagentRuntimeGatePhase,
      projectFactsValidated: projectFacts.ready,
      subagentEnvelopeValidatorReady: subject.envelopeValidationStatus === "valid",
      workerPermissionGateReady: readiness === "ready_for_worker_permission_gate",
      gateReceiptId: receiptId,
      readiness,
    },
    notes: [
      "Phase 24 is a structured receipt gate over project facts, worker runtime planning, and one envelope or worker slot.",
      "The gate does not spawn workers, execute shell commands, submit providers, read credentials, or mutate files.",
      "PhaseRoadmapRuntime can consume roadmapEvidence as typed evidence for phase_24_subagent_runtime_gate.",
    ],
  };
}
