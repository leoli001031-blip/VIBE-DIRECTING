import type { SubagentResult, SubagentTaskEnvelope } from "./types";
import type { SubagentRuntimeGateReceipt } from "./subagentRuntimeGate";
import {
  buildInputHash,
  buildOutputHash,
  buildSubagentInputHash,
  envelopeSchemaVersion,
  validateSubagentTaskEnvelope,
} from "./envelopeValidator";

export interface EnvelopeProductionGateChecks {
  schemaVersionValid: boolean;
  inputHashValid: boolean;
  subagentInputHashValid: boolean;
  outputHashValid: boolean;
  receiptRefMatches: boolean;
  receiptReady: boolean;
  envelopeValidationPassed: boolean;
}

export interface EnvelopeProductionGateResult {
  valid: boolean;
  checks: EnvelopeProductionGateChecks;
  blockers: string[];
  warnings: string[];
  allPassed: boolean;
}

export function validateEnvelopeProductionGate(input: {
  envelope: SubagentTaskEnvelope;
  workerResult: SubagentResult;
  receipt: SubagentRuntimeGateReceipt;
}): EnvelopeProductionGateResult {
  const { envelope, workerResult, receipt } = input;
  const warnings: string[] = [];

  const schemaVersionValid = envelope.schemaVersion === envelopeSchemaVersion;

  const expectedTaskInputHash = buildInputHash(envelope.taskEnvelope);
  const inputHashValid = envelope.taskEnvelope.inputHash === expectedTaskInputHash;

  const expectedSubagentInputHash = buildSubagentInputHash(envelope);
  const subagentInputHashValid = envelope.inputHash === expectedSubagentInputHash;

  const expectedOutputHash = buildOutputHash(workerResult);
  const outputHashValid = envelope.outputHash === expectedOutputHash;

  const receiptRefMatches = envelope.receiptRef === receipt.receiptId;

  const receiptReady = receipt.readiness === "ready_for_worker_permission_gate";

  const envelopeResult = validateSubagentTaskEnvelope(envelope);
  if (!envelopeResult.valid) {
    warnings.push(...envelopeResult.issues.map((issue) => `envelope:${issue}`));
  }
  const envelopeValidationPassed = envelopeResult.valid;

  const checks: EnvelopeProductionGateChecks = {
    schemaVersionValid,
    inputHashValid,
    subagentInputHashValid,
    outputHashValid,
    receiptRefMatches,
    receiptReady,
    envelopeValidationPassed,
  };

  const blockers: string[] = [];
  if (!schemaVersionValid) blockers.push("schema_version_invalid");
  if (!inputHashValid) blockers.push("task_input_hash_invalid");
  if (!subagentInputHashValid) blockers.push("subagent_input_hash_invalid");
  if (!outputHashValid) blockers.push("output_hash_invalid");
  if (!receiptRefMatches) blockers.push("receipt_ref_mismatch");
  if (!receiptReady) blockers.push("receipt_not_ready");
  if (!envelopeValidationPassed) blockers.push("envelope_validation_failed");

  const allPassed = blockers.length === 0;

  // valid and allPassed are intentionally redundant - allPassed is a computed convenience field that
  // always equals valid. Keeping both avoids downstream consumers re-deriving the same boolean.
  return {
    valid: allPassed,
    checks,
    blockers,
    warnings: [...new Set(warnings)],
    allPassed,
  };
}
