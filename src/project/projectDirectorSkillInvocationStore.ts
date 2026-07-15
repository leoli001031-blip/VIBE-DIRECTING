import {
  appendDirectorSkillInvocationReceipt,
  createDirectorSkillInvocationLedger,
  parseDirectorSkillInvocationLedger,
  serializeDirectorSkillEvidence,
  validateDirectorSkillInvocationLedger,
  type DirectorSkillInvocationLedger,
  type DirectorSkillInvocationReceipt,
  type DirectorSkillProjectIdentity,
} from "../core/directorSkillEvidence";
import {
  readProjectVibeSidecarText,
  writeProjectVibeSidecarText,
  type ProjectVibeDraftTarget,
} from "./projectVibeDraftStore";

export const projectDirectorSkillInvocationLedgerPath = ".vibe-runtime/director-skill-invocations.json";

export interface ProjectDirectorSkillInvocationOpenResult {
  ok: boolean;
  status: "restored" | "missing" | "invalid" | "project_mismatch" | "root_mismatch" | "fact_hash_mismatch" | "unavailable" | "error";
  path: string;
  ledger?: DirectorSkillInvocationLedger;
  errors: string[];
}

export interface ProjectDirectorSkillInvocationWriteResult {
  ok: boolean;
  status: "written" | "blocked" | "unavailable" | "error";
  path: string;
  ledger?: DirectorSkillInvocationLedger;
  errors: string[];
}

export async function openProjectDirectorSkillInvocationLedger(
  target: ProjectVibeDraftTarget,
  identity: DirectorSkillProjectIdentity,
): Promise<ProjectDirectorSkillInvocationOpenResult> {
  const readResult = await readProjectVibeSidecarText(target, projectDirectorSkillInvocationLedgerPath);
  if (!readResult.ok || readResult.content == null) {
    return {
      ok: false,
      status: readResult.status === "missing" ? "missing" : readResult.status === "unavailable" ? "unavailable" : "error",
      path: readResult.path,
      errors: readResult.errors,
    };
  }
  const parsed = parseDirectorSkillInvocationLedger(readResult.content, identity);
  return {
    ok: parsed.ok,
    status: parsed.status,
    path: readResult.path,
    ledger: parsed.value,
    errors: parsed.errors,
  };
}

export async function saveProjectDirectorSkillInvocationLedger(
  target: ProjectVibeDraftTarget,
  ledger: DirectorSkillInvocationLedger,
): Promise<ProjectDirectorSkillInvocationWriteResult> {
  const errors = validateDirectorSkillInvocationLedger(ledger);
  if (errors.length) {
    return { ok: false, status: "blocked", path: projectDirectorSkillInvocationLedgerPath, ledger, errors };
  }
  const writeResult = await writeProjectVibeSidecarText(
    target,
    projectDirectorSkillInvocationLedgerPath,
    serializeDirectorSkillEvidence(ledger),
  );
  return {
    ok: writeResult.ok,
    status: writeResult.ok ? "written" : writeResult.status === "unavailable" ? "unavailable" : "error",
    path: writeResult.path,
    ledger: writeResult.ok ? ledger : undefined,
    errors: writeResult.errors,
  };
}

export async function appendProjectDirectorSkillInvocationReceipt(
  target: ProjectVibeDraftTarget,
  identity: DirectorSkillProjectIdentity,
  receipt: DirectorSkillInvocationReceipt,
): Promise<ProjectDirectorSkillInvocationWriteResult> {
  const opened = await openProjectDirectorSkillInvocationLedger(target, identity);
  if (!opened.ok && !["missing", "unavailable"].includes(opened.status)) {
    return { ok: false, status: "blocked", path: opened.path, ledger: opened.ledger, errors: opened.errors };
  }
  if (receipt.projectId !== identity.projectId
    || receipt.projectRoot !== identity.projectRoot.replace(/\\/g, "/").replace(/\/+$/g, "").replace(/^\/private\/tmp(?=\/|$)/, "/tmp")
    || receipt.projectFactHash !== identity.projectFactHash) {
    return {
      ok: false,
      status: "blocked",
      path: opened.path,
      errors: ["Skill invocation receipt does not match the current project identity"],
    };
  }
  const base = opened.ledger || createDirectorSkillInvocationLedger(identity, [], receipt.createdAt);
  return saveProjectDirectorSkillInvocationLedger(target, appendDirectorSkillInvocationReceipt(base, receipt));
}
