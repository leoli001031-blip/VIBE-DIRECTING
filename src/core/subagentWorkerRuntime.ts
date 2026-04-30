import { validateSubagentTaskEnvelope } from "./envelopeValidator";
import type { SubagentResult, SubagentTaskEnvelope } from "./types";

export type SubagentWorkerRuntimeMode = "plan_only" | "permission_gated_worker_planned";
export type SubagentWorkerRuntimeStatus =
  | "blocked_missing_envelope"
  | "blocked_invalid_envelope"
  | "blocked_free_text"
  | "ready_for_permission_gate"
  | "result_pending"
  | "result_rejected"
  | "result_accepted_for_handoff";
export type SubagentWorkerResultStatus = "missing" | "valid" | "invalid";

export interface SubagentWorkerStartRequest {
  requestId: string;
  envelopeId?: string;
  freeTextPrompt?: string;
}

export interface SubagentWorkerResultCandidate {
  resultId: string;
  envelopeId: string;
  result: Partial<SubagentResult>;
}

export interface SubagentWorkerRuntimeInput {
  generatedAt?: string;
  runtimeMode?: SubagentWorkerRuntimeMode;
  envelopes?: SubagentTaskEnvelope[];
  startRequests?: SubagentWorkerStartRequest[];
  resultCandidates?: SubagentWorkerResultCandidate[];
}

export interface SubagentWorkerCommandPlan {
  executable: "codex";
  commandKind: "subagent_worker";
  argumentSource: "validated_envelope_only";
  envelopeId: string;
  canSpawnNow: false;
  canUseShell: false;
  canSubmitProvider: false;
  expectedResultSchema: "subagent_result_v1";
  notes: string[];
}

export interface SubagentWorkerResultGate {
  resultStatus: SubagentWorkerResultStatus;
  candidateResultId?: string;
  taskIdMatchesEnvelope: boolean;
  requiredFieldsPresent: string[];
  missingRequiredFields: string[];
  gateFieldsPresent: string[];
  issueSeveritiesAllowed: boolean;
  canHandoffToProjectStore: boolean;
  blockers: string[];
  warnings: string[];
}

export interface SubagentWorkerRuntimeSlot {
  workerSlotId: string;
  envelopeId?: string;
  parentTaskId?: string;
  shotId?: string;
  purpose?: SubagentTaskEnvelope["purpose"];
  status: SubagentWorkerRuntimeStatus;
  envelopeValidation: {
    status: "missing" | "valid" | "invalid";
    issues: string[];
  };
  startRequestIds: string[];
  freeTextPromptPresent: boolean;
  commandPlan?: SubagentWorkerCommandPlan;
  resultGate: SubagentWorkerResultGate;
  blockedReasons: string[];
  handoffPlan: {
    structuredResultRequired: true;
    projectStorePatchPlanned: boolean;
    canWriteProjectStoreNow: false;
    notes: string[];
  };
  notes: string[];
}

export interface SubagentWorkerRuntimeHardLocks {
  noFreeTextTask: true;
  validatedEnvelopeRequired: true;
  structuredResultRequired: true;
  noSpawnWorkerNow: true;
  noSubprocess: true;
  noShellExecution: true;
  noProviderExecution: true;
  noCredentialRead: true;
  noCredentialWrite: true;
  noFileMutation: true;
  noProjectStoreWrite: true;
  noUnscopedRead: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
}

export interface SubagentWorkerRuntimePlan {
  schemaVersion: "0.1.0";
  phase: "phase_16_subagent_worker_runtime";
  generatedAt: string;
  runtimeMode: SubagentWorkerRuntimeMode;
  slots: SubagentWorkerRuntimeSlot[];
  summary: {
    totalSlots: number;
    readyForPermissionGate: number;
    blocked: number;
    resultAcceptedForHandoff: number;
    resultRejected: number;
    freeTextBlocked: number;
    canSpawnNow: 0;
    canWriteProjectStoreNow: 0;
    structuredResultsRequired: true;
    providerSubmissionForbidden: true;
    liveSubmitAllowed: false;
  };
  hardLocks: SubagentWorkerRuntimeHardLocks;
  validation: {
    ok: boolean;
    errors: string[];
    warnings: string[];
    checkedAt: string;
  };
  safetySummary: string[];
}

export const subagentWorkerRuntimeSchemaVersion = "0.1.0";

export const subagentWorkerRuntimeHardLocks: SubagentWorkerRuntimeHardLocks = {
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

const defaultGeneratedAt = "1970-01-01T00:00:00.000Z";
const requiredResultFields: Array<keyof SubagentResult> = [
  "taskId",
  "status",
  "inspectedFiles",
  "gates",
  "overallVisualVerdict",
  "styleQa",
  "motionQa",
  "continuityQa",
  "referenceUseDecision",
  "issues",
  "requiredFixes",
  "approvedFor",
  "rejectedFor",
  "summaryForMainAgent",
];
const gateFields: Array<keyof SubagentResult["gates"]> = ["identity", "scene", "pair", "story", "prop", "style"];
const allowedSeverities = new Set(["P0", "P1", "P2"]);

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function commandPlan(envelope: SubagentTaskEnvelope): SubagentWorkerCommandPlan {
  return {
    executable: "codex",
    commandKind: "subagent_worker",
    argumentSource: "validated_envelope_only",
    envelopeId: envelope.id,
    canSpawnNow: false,
    canUseShell: false,
    canSubmitProvider: false,
    expectedResultSchema: "subagent_result_v1",
    notes: [
      "Phase 16 only prepares the worker command shape.",
      "A future desktop permission shell must execute this from a validated envelope, never from free text.",
    ],
  };
}

function resultGate(envelope: SubagentTaskEnvelope | undefined, candidate?: SubagentWorkerResultCandidate): SubagentWorkerResultGate {
  if (!candidate) {
    return {
      resultStatus: "missing",
      taskIdMatchesEnvelope: false,
      requiredFieldsPresent: [],
      missingRequiredFields: requiredResultFields,
      gateFieldsPresent: [],
      issueSeveritiesAllowed: true,
      canHandoffToProjectStore: false,
      blockers: [],
      warnings: ["structured_subagent_result_pending"],
    };
  }

  const result = candidate.result;
  const requiredFieldsPresent = requiredResultFields.filter((field) => hasValue(result[field]));
  const missingRequiredFields = requiredResultFields.filter((field) => !hasValue(result[field]));
  const gateFieldsPresent = gateFields.filter((field) => hasValue(result.gates?.[field]));
  const issues = Array.isArray(result.issues) ? result.issues : [];
  const issueSeveritiesAllowed = issues.every((issue) => allowedSeverities.has(issue.severity));
  const taskIdMatchesEnvelope = Boolean(envelope && result.taskId === envelope.parentTaskId);
  const blockers = uniqueSorted([
    ...missingRequiredFields.map((field) => `missing_result_field:${field}`),
    ...(gateFieldsPresent.length === gateFields.length ? [] : ["subagent_result_gate_set_incomplete"]),
    ...(issueSeveritiesAllowed ? [] : ["subagent_result_issue_severity_invalid"]),
    ...(taskIdMatchesEnvelope ? [] : ["subagent_result_task_id_mismatch"]),
  ]);

  return {
    resultStatus: blockers.length ? "invalid" : "valid",
    candidateResultId: candidate.resultId,
    taskIdMatchesEnvelope,
    requiredFieldsPresent,
    missingRequiredFields,
    gateFieldsPresent,
    issueSeveritiesAllowed,
    canHandoffToProjectStore: blockers.length === 0,
    blockers,
    warnings: result.status === "partial" ? ["partial_result_requires_main_agent_review"] : [],
  };
}

function slotStatus(input: {
  envelope?: SubagentTaskEnvelope;
  envelopeValid: boolean;
  freeTextPromptPresent: boolean;
  gate: SubagentWorkerResultGate;
}): SubagentWorkerRuntimeStatus {
  if (input.freeTextPromptPresent) return "blocked_free_text";
  if (!input.envelope) return "blocked_missing_envelope";
  if (!input.envelopeValid) return "blocked_invalid_envelope";
  if (input.gate.resultStatus === "valid") return "result_accepted_for_handoff";
  if (input.gate.resultStatus === "invalid") return "result_rejected";
  return "ready_for_permission_gate";
}

function makeSlot(input: {
  slotId: string;
  envelope?: SubagentTaskEnvelope;
  startRequests: SubagentWorkerStartRequest[];
  resultCandidate?: SubagentWorkerResultCandidate;
}): SubagentWorkerRuntimeSlot {
  const envelopeValidation = input.envelope ? validateSubagentTaskEnvelope(input.envelope) : { valid: false, issues: ["envelope_missing"] };
  const freeTextPromptPresent = input.startRequests.some((request) => Boolean(request.freeTextPrompt?.trim()));
  const gate = resultGate(input.envelope, input.resultCandidate);
  const status = slotStatus({
    envelope: input.envelope,
    envelopeValid: envelopeValidation.valid,
    freeTextPromptPresent,
    gate,
  });
  const blockedReasons = uniqueSorted([
    ...(freeTextPromptPresent ? ["free_text_worker_start_forbidden"] : []),
    ...(!input.envelope ? ["validated_subagent_task_envelope_required"] : []),
    ...(input.envelope && !envelopeValidation.valid ? envelopeValidation.issues.map((issue) => `invalid_envelope:${issue}`) : []),
    ...gate.blockers,
  ]);
  const projectStorePatchPlanned = gate.canHandoffToProjectStore;

  return {
    workerSlotId: input.slotId,
    envelopeId: input.envelope?.id,
    parentTaskId: input.envelope?.parentTaskId,
    shotId: input.envelope?.shotId,
    purpose: input.envelope?.purpose,
    status,
    envelopeValidation: {
      status: input.envelope ? envelopeValidation.valid ? "valid" : "invalid" : "missing",
      issues: envelopeValidation.issues,
    },
    startRequestIds: input.startRequests.map((request) => request.requestId),
    freeTextPromptPresent,
    commandPlan: input.envelope && envelopeValidation.valid && !freeTextPromptPresent ? commandPlan(input.envelope) : undefined,
    resultGate: gate,
    blockedReasons,
    handoffPlan: {
      structuredResultRequired: true,
      projectStorePatchPlanned,
      canWriteProjectStoreNow: false,
      notes: projectStorePatchPlanned
        ? ["Structured result can be handed to a future Project Store patch plan, but Phase 16 does not write files."]
        : ["No Project Store handoff is planned until a valid structured subagent result exists."],
    },
    notes: [
      "Phase 16 plans the worker runtime boundary only.",
      "The main agent should receive concise structured summaries, not image payloads or ad hoc worker prose.",
    ],
  };
}

export function buildSubagentWorkerRuntimePlan(input: SubagentWorkerRuntimeInput = {}): SubagentWorkerRuntimePlan {
  const generatedAt = input.generatedAt || defaultGeneratedAt;
  const envelopes = input.envelopes || [];
  const startRequests = input.startRequests || [];
  const resultCandidates = input.resultCandidates || [];
  const envelopeById = new Map(envelopes.map((envelope) => [envelope.id, envelope]));
  const ids = new Set<string>([
    ...envelopes.map((envelope) => envelope.id),
    ...startRequests.map((request) => request.envelopeId || `request:${request.requestId}`),
    ...resultCandidates.map((candidate) => candidate.envelopeId),
  ]);
  const slots = Array.from(ids)
    .sort((left, right) => left.localeCompare(right))
    .map((id) =>
      makeSlot({
        slotId: id.startsWith("request:") ? `subagent_worker_${safeId(id)}` : `subagent_worker_${safeId(id)}`,
        envelope: envelopeById.get(id),
        startRequests: startRequests.filter((request) => (request.envelopeId || `request:${request.requestId}`) === id),
        resultCandidate: resultCandidates.find((candidate) => candidate.envelopeId === id),
      }),
    );
  const errors = uniqueSorted(slots.flatMap((slot) => slot.blockedReasons));
  const warnings = uniqueSorted(slots.flatMap((slot) => slot.resultGate.warnings));

  return {
    schemaVersion: subagentWorkerRuntimeSchemaVersion,
    phase: "phase_16_subagent_worker_runtime",
    generatedAt,
    runtimeMode: input.runtimeMode || "permission_gated_worker_planned",
    slots,
    summary: {
      totalSlots: slots.length,
      readyForPermissionGate: slots.filter((slot) => slot.status === "ready_for_permission_gate").length,
      blocked: slots.filter((slot) => slot.status.startsWith("blocked")).length,
      resultAcceptedForHandoff: slots.filter((slot) => slot.status === "result_accepted_for_handoff").length,
      resultRejected: slots.filter((slot) => slot.status === "result_rejected").length,
      freeTextBlocked: slots.filter((slot) => slot.status === "blocked_free_text").length,
      canSpawnNow: 0,
      canWriteProjectStoreNow: 0,
      structuredResultsRequired: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
    },
    hardLocks: subagentWorkerRuntimeHardLocks,
    validation: {
      ok: errors.length === 0 || slots.some((slot) => slot.status === "ready_for_permission_gate" || slot.status === "result_accepted_for_handoff"),
      errors,
      warnings,
      checkedAt: generatedAt,
    },
    safetySummary: [
      "Subagent Worker Runtime only accepts validated SubagentTaskEnvelope packets.",
      "Worker command plans are permission-gated and cannot spawn from the browser plan.",
      "Every accepted worker output must be a structured subagent_result_v1 result before Project Store handoff is planned.",
      "Free text, arbitrary shell, credential access, provider submit, unscoped reads, and file mutation remain hard-locked off.",
    ],
  };
}
