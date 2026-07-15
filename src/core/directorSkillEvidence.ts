import type { ProviderSlot } from "./types";
import { canonicalDirectorSkillJson, directorSkillContentHash } from "./directorSkillContract";

export const DIRECTOR_SKILL_CASE_SCHEMA_VERSION = "director_skill_case/1.0.0";
export const DIRECTOR_SKILL_INVOCATION_RECEIPT_SCHEMA_VERSION = "director_skill_invocation_receipt/1.0.0";
export const DIRECTOR_SKILL_INVOCATION_LEDGER_SCHEMA_VERSION = "director_skill_invocation_ledger/1.0.0";

export type DirectorSkillCaseDecision =
  | "accepted"
  | "modified"
  | "rejected"
  | "retry_requested"
  | "failed"
  | "needs_review";

export type DirectorSkillInvocationStatus =
  | "recommended"
  | "selected"
  | "injected"
  | "validated"
  | "rejected"
  | "blocked";

export interface DirectorSkillProjectIdentity {
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
}

export interface DirectorSkillActionIdentity extends DirectorSkillProjectIdentity {
  shotId: string;
  actionId: string;
  jobId: string;
}

export interface DirectorSkillKnowledgeBinding {
  packId: string;
  version: string;
  hash: string;
}

export interface DirectorSkillProviderBinding {
  slot?: ProviderSlot;
  providerId?: string;
  modelId?: string;
  executionMode: "dry_run" | "live";
}

export interface DirectorSkillQaEvidence {
  status: "not_run" | "pass" | "warning" | "blocked";
  checkedSkillHash: string;
  checkedKnowledgePackHashes: string[];
  reportHash?: string;
  findings: string[];
}

export interface DirectorSkillHumanDecision {
  decision: DirectorSkillCaseDecision;
  decidedBy: "user";
  decidedAt: string;
  confirmationId: string;
  note?: string;
}

export interface DirectorSkillCase {
  schemaVersion: typeof DIRECTOR_SKILL_CASE_SCHEMA_VERSION;
  caseId: string;
  caseHash: string;
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
  shotId: string;
  actionId: string;
  jobId: string;
  skillId: string;
  skillVersion: string;
  skillContentHash: string;
  routeId: string;
  inputHash: string;
  outputHash: string;
  knowledgePacks: DirectorSkillKnowledgeBinding[];
  provider: DirectorSkillProviderBinding;
  qa: DirectorSkillQaEvidence;
  humanDecision?: DirectorSkillHumanDecision;
  outcome: DirectorSkillCaseDecision;
  summary: string;
  createdAt: string;
}

export interface DirectorSkillInvocationReceipt {
  schemaVersion: typeof DIRECTOR_SKILL_INVOCATION_RECEIPT_SCHEMA_VERSION;
  receiptId: string;
  receiptHash: string;
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
  shotId: string;
  actionId: string;
  jobId: string;
  skillId: string;
  skillVersion: string;
  skillContentHash: string;
  status: DirectorSkillInvocationStatus;
  routeId: string;
  routingReasons: string[];
  inputHash: string;
  outputHash: string;
  knowledgePacks: DirectorSkillKnowledgeBinding[];
  provider: DirectorSkillProviderBinding;
  qa: DirectorSkillQaEvidence;
  humanDecision?: DirectorSkillHumanDecision;
  createdAt: string;
}

export interface DirectorSkillInvocationLedger {
  schemaVersion: typeof DIRECTOR_SKILL_INVOCATION_LEDGER_SCHEMA_VERSION;
  ledgerId: string;
  projectId: string;
  projectRoot: string;
  projectFactHash: string;
  createdAt: string;
  updatedAt: string;
  receipts: DirectorSkillInvocationReceipt[];
}

export interface DirectorSkillEvidenceOpenResult<T> {
  ok: boolean;
  status: "restored" | "invalid" | "project_mismatch" | "root_mismatch" | "fact_hash_mismatch";
  value?: T;
  errors: string[];
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeDirectorSkillProjectRoot(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+$/g, "").replace(/^\/private\/tmp(?=\/|$)/, "/tmp");
}

function dateValid(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function withoutHash<T extends Record<string, unknown>>(value: T, key: keyof T): Omit<T, keyof T> & Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([entryKey]) => entryKey !== key)) as Omit<T, keyof T> & Record<string, unknown>;
}

function evidenceHash(value: unknown): string {
  return directorSkillContentHash(canonicalDirectorSkillJson(value));
}

function actionIdentityErrors(value: DirectorSkillActionIdentity): string[] {
  const errors: string[] = [];
  for (const key of ["projectId", "projectRoot", "projectFactHash", "shotId", "actionId", "jobId"] as const) {
    const item = value[key];
    if (!clean(item)) errors.push(`${key} is required`);
  }
  if (value.projectRoot && normalizeDirectorSkillProjectRoot(value.projectRoot) !== value.projectRoot) {
    errors.push("projectRoot must be normalized");
  }
  return errors;
}

function knowledgeBindingErrors(bindings: DirectorSkillKnowledgeBinding[]): string[] {
  return bindings.flatMap((binding, index) => {
    const errors: string[] = [];
    if (!clean(binding.packId)) errors.push(`knowledgePacks[${index}].packId is required`);
    if (!clean(binding.version)) errors.push(`knowledgePacks[${index}].version is required`);
    if (!clean(binding.hash)) errors.push(`knowledgePacks[${index}].hash is required`);
    return errors;
  });
}

function qaEvidenceErrors(qa: DirectorSkillQaEvidence, skillContentHash: string): string[] {
  const errors: string[] = [];
  if (!qa || !["not_run", "pass", "warning", "blocked"].includes(qa.status)) errors.push("qa.status is invalid");
  if (qa?.checkedSkillHash !== skillContentHash) errors.push("QA Skill hash does not match invocation Skill hash");
  if (!Array.isArray(qa?.checkedKnowledgePackHashes)) errors.push("QA Knowledge Pack hashes must be an array");
  if (!Array.isArray(qa?.findings)) errors.push("QA findings must be an array");
  return errors;
}

function humanDecisionErrors(decision: DirectorSkillHumanDecision | undefined, outcome?: DirectorSkillCaseDecision): string[] {
  if (!decision) return [];
  const errors: string[] = [];
  if (decision.decidedBy !== "user") errors.push("human decision must be made by the user");
  if (!clean(decision.confirmationId)) errors.push("human decision confirmationId is required");
  if (!dateValid(decision.decidedAt)) errors.push("human decision decidedAt is invalid");
  if (outcome && decision.decision !== outcome) errors.push("human decision does not match Case outcome");
  return errors;
}

export function createDirectorSkillInvocationReceipt(
  input: Omit<DirectorSkillInvocationReceipt, "schemaVersion" | "receiptId" | "receiptHash"> & { receiptId?: string },
): DirectorSkillInvocationReceipt {
  const {
    receiptHash: _ignoredReceiptHash,
    schemaVersion: _ignoredSchemaVersion,
    ...receiptInput
  } = input as typeof input & { receiptHash?: string; schemaVersion?: string };
  const receiptWithoutHash: Omit<DirectorSkillInvocationReceipt, "receiptHash"> = {
    ...receiptInput,
    schemaVersion: DIRECTOR_SKILL_INVOCATION_RECEIPT_SCHEMA_VERSION,
    receiptId: receiptInput.receiptId || `dsir_${evidenceHash({
      projectId: receiptInput.projectId,
      projectFactHash: receiptInput.projectFactHash,
      shotId: receiptInput.shotId,
      actionId: receiptInput.actionId,
      jobId: receiptInput.jobId,
      skillId: receiptInput.skillId,
      status: receiptInput.status,
      createdAt: receiptInput.createdAt,
    }).slice(5)}`,
    projectRoot: normalizeDirectorSkillProjectRoot(receiptInput.projectRoot),
    routingReasons: Array.from(new Set(receiptInput.routingReasons.map(clean).filter(Boolean))),
    knowledgePacks: [...receiptInput.knowledgePacks].sort((left, right) => left.packId.localeCompare(right.packId)),
  };
  return {
    ...receiptWithoutHash,
    receiptHash: evidenceHash(receiptWithoutHash),
  };
}

export function validateDirectorSkillInvocationReceipt(receipt: DirectorSkillInvocationReceipt): string[] {
  const errors = actionIdentityErrors(receipt);
  if (receipt.schemaVersion !== DIRECTOR_SKILL_INVOCATION_RECEIPT_SCHEMA_VERSION) errors.push("unsupported invocation receipt schemaVersion");
  for (const key of ["receiptId", "skillId", "skillVersion", "skillContentHash", "routeId", "inputHash", "outputHash"] as const) {
    if (!clean(receipt[key])) errors.push(`${key} is required`);
  }
  if (!["recommended", "selected", "injected", "validated", "rejected", "blocked"].includes(receipt.status)) errors.push("invocation status is invalid");
  if (!Array.isArray(receipt.routingReasons) || !receipt.routingReasons.length) errors.push("routingReasons must be non-empty");
  if (!receipt.provider || !["dry_run", "live"].includes(receipt.provider.executionMode)) errors.push("provider executionMode is invalid");
  errors.push(...knowledgeBindingErrors(receipt.knowledgePacks || []));
  errors.push(...qaEvidenceErrors(receipt.qa, receipt.skillContentHash));
  errors.push(...humanDecisionErrors(receipt.humanDecision));
  if (!dateValid(receipt.createdAt)) errors.push("createdAt is invalid");
  const expectedHash = evidenceHash(withoutHash(receipt as unknown as Record<string, unknown>, "receiptHash"));
  if (receipt.receiptHash !== expectedHash) errors.push("invocation receiptHash mismatch");
  return errors;
}

export function createDirectorSkillCase(
  input: Omit<DirectorSkillCase, "schemaVersion" | "caseId" | "caseHash"> & { caseId?: string },
): DirectorSkillCase {
  const {
    caseHash: _ignoredCaseHash,
    schemaVersion: _ignoredSchemaVersion,
    ...caseInput
  } = input as typeof input & { caseHash?: string; schemaVersion?: string };
  const caseWithoutHash: Omit<DirectorSkillCase, "caseHash"> = {
    ...caseInput,
    schemaVersion: DIRECTOR_SKILL_CASE_SCHEMA_VERSION,
    caseId: caseInput.caseId || `dsc_${evidenceHash({
      projectId: caseInput.projectId,
      projectFactHash: caseInput.projectFactHash,
      shotId: caseInput.shotId,
      actionId: caseInput.actionId,
      skillId: caseInput.skillId,
      outcome: caseInput.outcome,
      createdAt: caseInput.createdAt,
    }).slice(5)}`,
    projectRoot: normalizeDirectorSkillProjectRoot(caseInput.projectRoot),
    knowledgePacks: [...caseInput.knowledgePacks].sort((left, right) => left.packId.localeCompare(right.packId)),
  };
  return {
    ...caseWithoutHash,
    caseHash: evidenceHash(caseWithoutHash),
  };
}

export function validateDirectorSkillCase(value: DirectorSkillCase): string[] {
  const errors = actionIdentityErrors(value);
  if (value.schemaVersion !== DIRECTOR_SKILL_CASE_SCHEMA_VERSION) errors.push("unsupported Case schemaVersion");
  for (const key of ["caseId", "skillId", "skillVersion", "skillContentHash", "routeId", "inputHash", "outputHash", "summary"] as const) {
    if (!clean(value[key])) errors.push(`${key} is required`);
  }
  if (!["accepted", "modified", "rejected", "retry_requested", "failed", "needs_review"].includes(value.outcome)) errors.push("Case outcome is invalid");
  errors.push(...knowledgeBindingErrors(value.knowledgePacks || []));
  errors.push(...qaEvidenceErrors(value.qa, value.skillContentHash));
  errors.push(...humanDecisionErrors(value.humanDecision, value.outcome));
  if (!dateValid(value.createdAt)) errors.push("createdAt is invalid");
  const expectedHash = evidenceHash(withoutHash(value as unknown as Record<string, unknown>, "caseHash"));
  if (value.caseHash !== expectedHash) errors.push("Case caseHash mismatch");
  return errors;
}

export function directorSkillCaseSupportsPromotion(value: DirectorSkillCase): boolean {
  return validateDirectorSkillCase(value).length === 0
    && value.outcome === "accepted"
    && value.humanDecision?.decision === "accepted"
    && value.humanDecision.decidedBy === "user"
    && Boolean(value.humanDecision.confirmationId)
    && value.qa.status === "pass";
}

export function createDirectorSkillInvocationLedger(
  identity: DirectorSkillProjectIdentity,
  receipts: DirectorSkillInvocationReceipt[] = [],
  generatedAt = new Date().toISOString(),
): DirectorSkillInvocationLedger {
  const normalizedRoot = normalizeDirectorSkillProjectRoot(identity.projectRoot);
  const sortedReceipts = [...receipts]
    .filter((receipt, index, all) => all.findIndex((item) => item.receiptId === receipt.receiptId) === index)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  return {
    schemaVersion: DIRECTOR_SKILL_INVOCATION_LEDGER_SCHEMA_VERSION,
    ledgerId: `dsil_${evidenceHash({ ...identity, projectRoot: normalizedRoot }).slice(5)}`,
    projectId: identity.projectId,
    projectRoot: normalizedRoot,
    projectFactHash: identity.projectFactHash,
    createdAt: sortedReceipts[0]?.createdAt || generatedAt,
    updatedAt: sortedReceipts.at(-1)?.createdAt || generatedAt,
    receipts: sortedReceipts,
  };
}

export function appendDirectorSkillInvocationReceipt(
  ledger: DirectorSkillInvocationLedger | undefined,
  receipt: DirectorSkillInvocationReceipt,
): DirectorSkillInvocationLedger {
  return createDirectorSkillInvocationLedger(
    { projectId: receipt.projectId, projectRoot: receipt.projectRoot, projectFactHash: receipt.projectFactHash },
    [...(ledger?.receipts || []).filter((item) => item.receiptId !== receipt.receiptId), receipt],
    ledger?.createdAt || receipt.createdAt,
  );
}

export function validateDirectorSkillInvocationLedger(value: DirectorSkillInvocationLedger): string[] {
  const errors: string[] = [];
  if (value.schemaVersion !== DIRECTOR_SKILL_INVOCATION_LEDGER_SCHEMA_VERSION) errors.push("unsupported invocation ledger schemaVersion");
  for (const key of ["ledgerId", "projectId", "projectRoot", "projectFactHash", "createdAt", "updatedAt"] as const) {
    if (!clean(value[key])) errors.push(`${key} is required`);
  }
  if (!dateValid(value.createdAt) || !dateValid(value.updatedAt)) errors.push("ledger timestamps are invalid");
  if (!Array.isArray(value.receipts)) errors.push("ledger receipts must be an array");
  const ids = new Set<string>();
  for (const receipt of value.receipts || []) {
    errors.push(...validateDirectorSkillInvocationReceipt(receipt).map((error) => `${receipt.receiptId || "receipt"}: ${error}`));
    if (ids.has(receipt.receiptId)) errors.push(`duplicate receiptId ${receipt.receiptId}`);
    ids.add(receipt.receiptId);
    if (receipt.projectId !== value.projectId) errors.push(`${receipt.receiptId}: projectId mismatch`);
    if (receipt.projectRoot !== value.projectRoot) errors.push(`${receipt.receiptId}: projectRoot mismatch`);
    if (receipt.projectFactHash !== value.projectFactHash) errors.push(`${receipt.receiptId}: projectFactHash mismatch`);
  }
  return errors;
}

export function restoreDirectorSkillInvocationLedger(
  value: unknown,
  identity: DirectorSkillProjectIdentity,
): DirectorSkillEvidenceOpenResult<DirectorSkillInvocationLedger> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, status: "invalid", errors: ["Invocation ledger must be an object"] };
  }
  const ledger = value as DirectorSkillInvocationLedger;
  const errors = validateDirectorSkillInvocationLedger(ledger);
  if (errors.length) return { ok: false, status: "invalid", value: ledger, errors };
  if (ledger.projectId !== identity.projectId) return { ok: false, status: "project_mismatch", value: ledger, errors: ["Invocation ledger belongs to another project"] };
  if (ledger.projectRoot !== normalizeDirectorSkillProjectRoot(identity.projectRoot)) return { ok: false, status: "root_mismatch", value: ledger, errors: ["Invocation ledger belongs to another project root"] };
  if (ledger.projectFactHash !== identity.projectFactHash) return { ok: false, status: "fact_hash_mismatch", value: ledger, errors: ["Project facts changed after Skill invocation"] };
  return { ok: true, status: "restored", value: ledger, errors: [] };
}

export function parseDirectorSkillInvocationLedger(
  content: string,
  identity: DirectorSkillProjectIdentity,
): DirectorSkillEvidenceOpenResult<DirectorSkillInvocationLedger> {
  try {
    return restoreDirectorSkillInvocationLedger(JSON.parse(content), identity);
  } catch (error) {
    return { ok: false, status: "invalid", errors: [error instanceof Error ? error.message : String(error)] };
  }
}

export function serializeDirectorSkillEvidence(value: DirectorSkillCase | DirectorSkillInvocationReceipt | DirectorSkillInvocationLedger): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
