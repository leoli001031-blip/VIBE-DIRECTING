import {
  AGENT_DIRECTOR_REVIEW_SELECTION_LEDGER_SCHEMA_VERSION,
  agentDirectorReviewSelectionLedgerMatchesProject,
  validateAgentDirectorReviewSelectionLedger,
  type AgentDirectorReviewSelectionLedger,
  type AgentDirectorReviewSelectionProjectIdentity,
} from "../core/agentDirectorReviewSelection";
import {
  readProjectVibeSidecarText,
  writeProjectVibeSidecarText,
  type ProjectVibeDraftTarget,
  type ProjectVibeSidecarTextResult,
} from "./projectVibeDraftStore";

export const projectAgentReviewSelectionLedgerPath = ".vibe-runtime/agent-review-selection-ledger.json";

export type ProjectAgentReviewSelectionLedgerOpenStatus =
  | "restored"
  | "missing"
  | "project_mismatch"
  | "root_mismatch"
  | "fact_hash_mismatch"
  | "invalid"
  | "unavailable"
  | "error";

export interface ProjectAgentReviewSelectionLedgerOpenResult {
  ok: boolean;
  status: ProjectAgentReviewSelectionLedgerOpenStatus;
  path: string;
  ledger?: AgentDirectorReviewSelectionLedger;
  errors: string[];
}

function normalizeRoot(value: string | undefined) {
  return value?.trim().replace(/\\/g, "/").replace(/\/+$/g, "").replace(/^\/private\/(tmp|var)(?=\/|$)/, "/$1") || "";
}

export function parseProjectAgentReviewSelectionLedger(value: unknown) {
  const errors = validateAgentDirectorReviewSelectionLedger(value);
  return errors.length
    ? { ok: false as const, errors }
    : { ok: true as const, ledger: value as AgentDirectorReviewSelectionLedger, errors: [] };
}

export function restoreProjectAgentReviewSelectionLedger(
  value: unknown,
  identity: AgentDirectorReviewSelectionProjectIdentity,
  path = projectAgentReviewSelectionLedgerPath,
): ProjectAgentReviewSelectionLedgerOpenResult {
  const parsed = parseProjectAgentReviewSelectionLedger(value);
  if (!parsed.ok) return { ok: false, status: "invalid", path, errors: parsed.errors };
  const ledger = parsed.ledger;
  if (ledger.projectId !== identity.projectId) return { ok: false, status: "project_mismatch", path, ledger, errors: ["Review selection ledger belongs to another project."] };
  if (normalizeRoot(ledger.projectRoot) !== normalizeRoot(identity.projectRoot)) return { ok: false, status: "root_mismatch", path, ledger, errors: ["Review selection ledger belongs to another project root."] };
  if (ledger.projectFactHash !== identity.projectFactHash) return { ok: false, status: "fact_hash_mismatch", path, ledger, errors: ["Project facts changed after the review selection was recorded."] };
  if (!agentDirectorReviewSelectionLedgerMatchesProject(ledger, identity)) return { ok: false, status: "invalid", path, ledger, errors: ["Review selection ledger identity is invalid."] };
  return { ok: true, status: "restored", path, ledger, errors: [] };
}

export async function openProjectAgentReviewSelectionLedger(
  target: ProjectVibeDraftTarget,
  identity: AgentDirectorReviewSelectionProjectIdentity,
): Promise<ProjectAgentReviewSelectionLedgerOpenResult> {
  const read = await readProjectVibeSidecarText(target, projectAgentReviewSelectionLedgerPath);
  if (!read.ok || read.content == null) {
    return {
      ok: false,
      status: read.status === "missing" ? "missing" : read.status === "unavailable" ? "unavailable" : "error",
      path: read.path,
      errors: read.errors,
    };
  }
  try {
    return restoreProjectAgentReviewSelectionLedger(JSON.parse(read.content), identity, read.path);
  } catch (error) {
    return { ok: false, status: "invalid", path: read.path, errors: [error instanceof Error ? error.message : String(error)] };
  }
}

export async function saveProjectAgentReviewSelectionLedger(
  target: ProjectVibeDraftTarget,
  ledger: AgentDirectorReviewSelectionLedger,
): Promise<ProjectVibeSidecarTextResult> {
  const parsed = parseProjectAgentReviewSelectionLedger(ledger);
  if (!parsed.ok || ledger.schemaVersion !== AGENT_DIRECTOR_REVIEW_SELECTION_LEDGER_SCHEMA_VERSION) {
    return {
      ok: false,
      status: "error",
      targetId: target.storageKey || ledger.projectId,
      path: projectAgentReviewSelectionLedgerPath,
      errors: parsed.errors,
    };
  }
  return writeProjectVibeSidecarText(target, projectAgentReviewSelectionLedgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
}
