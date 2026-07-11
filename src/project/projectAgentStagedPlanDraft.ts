import type { DirectorProductAgentLoopStatus } from "../agent/directorProductAgentLoop";
import type { DirectorAgentActionEnvelope } from "../core/directorAgentAction";
import type { DirectorAgentToolHandoff } from "../core/directorAgentToolHandoff";
import type { DirectorQaUserFeedback } from "../core/directorQaUserFeedback";
import { hashProjectVibeFacts } from "./projectVibe";
import {
  readProjectVibeSidecarText,
  writeProjectVibeSidecarText,
  type ProjectVibeDraftTarget,
  type ProjectVibeSidecarTextResult,
} from "./projectVibeDraftStore";
import type { ProjectVibeDocument } from "./types";
import {
  loadCurrentProjectAgentStagedPlanTextFromRuntime,
  saveCurrentProjectAgentStagedPlanTextToRuntime,
} from "../core/projectCurrentRuntimeClient";

export const PROJECT_AGENT_STAGED_PLAN_DRAFT_SCHEMA_VERSION = "director_agent_staged_plan/0.1.0";
export const projectAgentStagedPlanDraftPath = ".vibe-runtime/agent-staged-plan.json";
export const defaultProjectAgentStagedPlanTtlMs = 24 * 60 * 60 * 1000;

export interface ProjectAgentVideoPermissionDraft {
  mode?: string;
  referenceGenerationAllowed?: boolean;
  videoSubmitAllowed?: boolean;
  providerSubmitAllowed?: boolean;
  reason?: string;
}

export interface ProjectAgentStagedPlanDraft {
  schemaVersion: typeof PROJECT_AGENT_STAGED_PLAN_DRAFT_SCHEMA_VERSION;
  status: "active" | "cleared";
  draftId: string;
  createdAt: string;
  expiresAt: string;
  clearedAt?: string;
  projectId: string;
  projectTitle: string;
  projectRoot?: string;
  projectPath?: string;
  sourceFactHash: string;
  userIntent: string;
  scopeLabel: string;
  selectedShotId?: string;
  selectedShotIds: string[];
  selectedAssetId?: string;
  sectionId?: string;
  videoPermissionContract?: ProjectAgentVideoPermissionDraft;
  action?: DirectorAgentActionEnvelope;
  toolHandoff?: DirectorAgentToolHandoff;
  qaFeedback?: DirectorQaUserFeedback;
  projectRecordLabel?: string;
  projectImpactLabel?: string;
  projectTaskLabel?: string;
  loopStatus?: DirectorProductAgentLoopStatus;
  blockedReasons: string[];
}

export type ProjectAgentStagedPlanRestoreStatus =
  | "restored"
  | "missing"
  | "cleared"
  | "expired"
  | "project_mismatch"
  | "fact_hash_mismatch"
  | "action_context_mismatch"
  | "invalid"
  | "unavailable"
  | "error";

export interface ProjectAgentStagedPlanRestoreResult {
  ok: boolean;
  status: ProjectAgentStagedPlanRestoreStatus;
  path: string;
  draft?: ProjectAgentStagedPlanDraft;
  errors: string[];
}

export interface SaveProjectAgentStagedPlanDraftInput {
  project: ProjectVibeDocument;
  projectRoot?: string;
  projectPath?: string;
  generatedAt?: string;
  ttlMs?: number;
  userIntent: string;
  scopeLabel: string;
  selectedShotId?: string;
  selectedShotIds?: string[];
  selectedAssetId?: string;
  sectionId?: string;
  videoPermissionContract?: ProjectAgentVideoPermissionDraft;
  action: DirectorAgentActionEnvelope;
  toolHandoff: DirectorAgentToolHandoff;
  qaFeedback?: DirectorQaUserFeedback;
  projectRecordLabel?: string;
  projectImpactLabel?: string;
  projectTaskLabel?: string;
  loopStatus?: DirectorProductAgentLoopStatus;
  blockedReasons?: string[];
}

type JsonRecord = Record<string, unknown>;

export function buildProjectAgentStagedPlanDraft(
  input: SaveProjectAgentStagedPlanDraftInput,
): ProjectAgentStagedPlanDraft {
  const createdAt = input.generatedAt || new Date().toISOString();
  const expiresAt = new Date(Date.parse(createdAt) + (input.ttlMs ?? defaultProjectAgentStagedPlanTtlMs)).toISOString();
  const projectRoot = normalizeProjectRoot(input.projectRoot);
  const selectedShotIds = uniqueStrings([
    ...(input.selectedShotIds || []),
    input.selectedShotId || "",
    ...input.action.sourceContext.selectedShotIds,
  ]);
  return {
    schemaVersion: PROJECT_AGENT_STAGED_PLAN_DRAFT_SCHEMA_VERSION,
    status: "active",
    draftId: `agent_staged_plan_${compactId(createdAt)}_${compactId(input.action.actionId)}`,
    createdAt,
    expiresAt,
    projectId: input.project.manifest.projectId,
    projectTitle: input.project.manifest.title,
    projectRoot,
    projectPath: input.projectPath,
    sourceFactHash: hashProjectVibeFacts(input.project),
    userIntent: input.userIntent,
    scopeLabel: input.scopeLabel,
    selectedShotId: input.selectedShotId,
    selectedShotIds,
    selectedAssetId: input.selectedAssetId,
    sectionId: input.sectionId,
    videoPermissionContract: input.videoPermissionContract,
    action: input.action,
    toolHandoff: input.toolHandoff,
    qaFeedback: input.qaFeedback,
    projectRecordLabel: input.projectRecordLabel,
    projectImpactLabel: input.projectImpactLabel,
    projectTaskLabel: input.projectTaskLabel,
    loopStatus: input.loopStatus,
    blockedReasons: uniqueStrings(input.blockedReasons || []),
  };
}

export async function saveProjectAgentStagedPlanDraft(
  target: ProjectVibeDraftTarget,
  draft: ProjectAgentStagedPlanDraft,
): Promise<ProjectVibeSidecarTextResult> {
  const serialized = `${JSON.stringify(draft, null, 2)}\n`;
  let runtimeWriteError: string | undefined;
  let runtimeWriteOk = false;
  let runtimeWritePath: string | undefined;
  if (target.projectRoot && !isBrowserDraftProjectRoot(target.projectRoot)) {
    try {
      const runtimeWrite = await saveCurrentProjectAgentStagedPlanTextToRuntime({
        projectId: draft.projectId,
        projectRoot: target.projectRoot,
      }, serialized);
      if (runtimeWrite.ok) {
        runtimeWriteOk = true;
        runtimeWritePath = runtimeWrite.path || projectAgentStagedPlanDraftPath;
      } else {
        runtimeWriteError = runtimeWrite.message || runtimeWrite.status;
      }
    } catch (error) {
      runtimeWriteError = error instanceof Error ? error.message : String(error);
    }
  }
  const writeResult = await writeProjectVibeSidecarText(
    target,
    projectAgentStagedPlanDraftPath,
    serialized,
  );
  if (runtimeWriteOk && !writeResult.ok) {
    return {
      ...writeResult,
      ok: true,
      status: "written",
      path: runtimeWritePath || writeResult.path,
      content: serialized,
      errors: [],
    };
  }
  if (!writeResult.ok && runtimeWriteError) {
    return {
      ...writeResult,
      errors: [runtimeWriteError, ...writeResult.errors],
    };
  }
  return writeResult;
}

export async function clearProjectAgentStagedPlanDraft(
  target: ProjectVibeDraftTarget,
  input: {
    project?: ProjectVibeDocument;
    projectRoot?: string;
    projectPath?: string;
    generatedAt?: string;
  } = {},
): Promise<ProjectVibeSidecarTextResult> {
  const clearedAt = input.generatedAt || new Date().toISOString();
  const marker: ProjectAgentStagedPlanDraft = {
    schemaVersion: PROJECT_AGENT_STAGED_PLAN_DRAFT_SCHEMA_VERSION,
    status: "cleared",
    draftId: `agent_staged_plan_cleared_${compactId(clearedAt)}`,
    createdAt: clearedAt,
    expiresAt: clearedAt,
    clearedAt,
    projectId: input.project?.manifest.projectId || "unknown_project",
    projectTitle: input.project?.manifest.title || "Unknown project",
    projectRoot: normalizeProjectRoot(input.projectRoot || target.projectRoot),
    projectPath: input.projectPath || target.projectPath,
    sourceFactHash: input.project ? hashProjectVibeFacts(input.project) : "unknown_fact_hash",
    userIntent: "",
    scopeLabel: "",
    selectedShotIds: [],
    blockedReasons: [],
  };
  return saveProjectAgentStagedPlanDraft(target, marker);
}

export async function openProjectAgentStagedPlanDraft(
  target: ProjectVibeDraftTarget,
  input: {
    project: ProjectVibeDocument;
    projectRoot?: string;
    now?: string | Date;
  },
): Promise<ProjectAgentStagedPlanRestoreResult> {
  const runtimeRead = target.projectRoot && !isBrowserDraftProjectRoot(target.projectRoot)
    ? await loadCurrentProjectAgentStagedPlanTextFromRuntime({
      projectId: input.project.manifest.projectId,
      projectRoot: target.projectRoot,
    })
    : undefined;
  const runtimeOpen = runtimeRead?.ok && runtimeRead.content != null
    ? openProjectAgentStagedPlanDraftText(runtimeRead.content, {
      project: input.project,
      projectRoot: input.projectRoot || target.projectRoot,
      now: input.now,
      path: runtimeRead.path || projectAgentStagedPlanDraftPath,
    })
    : undefined;
  const readResult = await readProjectVibeSidecarText(target, projectAgentStagedPlanDraftPath);
  const sidecarOpen = readResult.ok && readResult.content != null
    ? openProjectAgentStagedPlanDraftText(readResult.content, {
      project: input.project,
      projectRoot: input.projectRoot || target.projectRoot,
      now: input.now,
      path: readResult.path,
    })
    : undefined;
  const restored = selectLatestProjectAgentStagedPlanRestoreResult(runtimeOpen, sidecarOpen);
  if (restored) return restored;
  if (runtimeOpen) return runtimeOpen;
  if (sidecarOpen) return sidecarOpen;
  if (!readResult.ok || readResult.content == null) {
    return {
      ok: false,
      status: readResult.status === "unavailable" ? "unavailable" : readResult.status === "missing" ? "missing" : "error",
      path: readResult.path,
      errors: readResult.errors,
    };
  }
  return openProjectAgentStagedPlanDraftText(readResult.content, {
    project: input.project,
    projectRoot: input.projectRoot || target.projectRoot,
    now: input.now,
    path: readResult.path,
  });
}

function openProjectAgentStagedPlanDraftText(
  content: string,
  input: {
    project: ProjectVibeDocument;
    projectRoot?: string;
    now?: string | Date;
    path: string;
  },
): ProjectAgentStagedPlanRestoreResult {
  try {
    return restoreProjectAgentStagedPlanDraft(JSON.parse(content), {
      project: input.project,
      projectRoot: input.projectRoot,
      now: input.now,
      path: input.path,
    });
  } catch (error) {
    return {
      ok: false,
      status: "invalid",
      path: input.path,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function selectLatestProjectAgentStagedPlanRestoreResult(
  first?: ProjectAgentStagedPlanRestoreResult,
  second?: ProjectAgentStagedPlanRestoreResult,
) {
  const candidates = [first, second].filter((item): item is ProjectAgentStagedPlanRestoreResult => Boolean(item));
  if (!candidates.length) return undefined;
  return candidates.sort((left, right) => draftCreatedAtMs(left.draft) - draftCreatedAtMs(right.draft)).at(-1);
}

function draftCreatedAtMs(draft?: ProjectAgentStagedPlanDraft) {
  const time = Date.parse(draft?.createdAt || "");
  return Number.isFinite(time) ? time : 0;
}

export function restoreProjectAgentStagedPlanDraft(
  value: unknown,
  input: {
    project: ProjectVibeDocument;
    projectRoot?: string;
    now?: string | Date;
    path?: string;
  },
): ProjectAgentStagedPlanRestoreResult {
  const path = input.path || projectAgentStagedPlanDraftPath;
  const parsed = parseProjectAgentStagedPlanDraft(value);
  if (!parsed.ok || !parsed.draft) {
    return { ok: false, status: "invalid", path, errors: parsed.errors };
  }
  const draft = parsed.draft;
  if (draft.status === "cleared") {
    return { ok: false, status: "cleared", path, draft, errors: [] };
  }
  const nowMs = input.now instanceof Date ? input.now.getTime() : Date.parse(input.now || new Date().toISOString());
  const expiresAtMs = Date.parse(draft.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    return { ok: false, status: "expired", path, draft, errors: ["Agent staged plan has expired."] };
  }
  if (draft.projectId !== input.project.manifest.projectId) {
    return { ok: false, status: "project_mismatch", path, draft, errors: ["Agent staged plan belongs to another project."] };
  }
  const expectedProjectRoot = normalizeProjectRoot(input.projectRoot);
  const draftProjectRoot = normalizeProjectRoot(draft.projectRoot);
  if (expectedProjectRoot && draftProjectRoot && expectedProjectRoot !== draftProjectRoot) {
    return { ok: false, status: "project_mismatch", path, draft, errors: ["Agent staged plan belongs to another project root."] };
  }
  const sourceFactHash = hashProjectVibeFacts(input.project);
  if (draft.sourceFactHash !== sourceFactHash) {
    return { ok: false, status: "fact_hash_mismatch", path, draft, errors: ["Project.vibe changed after the Agent staged this plan."] };
  }
  const actionProjectRoot = normalizeProjectRoot(draft.action?.sourceContext.projectRoot);
  if (expectedProjectRoot && actionProjectRoot && expectedProjectRoot !== actionProjectRoot) {
    return { ok: false, status: "action_context_mismatch", path, draft, errors: ["Agent action context belongs to another project root."] };
  }
  return { ok: true, status: "restored", path, draft, errors: [] };
}

function parseProjectAgentStagedPlanDraft(value: unknown): {
  ok: boolean;
  draft?: ProjectAgentStagedPlanDraft;
  errors: string[];
} {
  if (!isRecord(value)) return { ok: false, errors: ["Agent staged plan draft must be an object."] };
  const errors: string[] = [];
  if (value.schemaVersion !== PROJECT_AGENT_STAGED_PLAN_DRAFT_SCHEMA_VERSION) errors.push("Unsupported Agent staged plan draft schema.");
  if (value.status !== "active" && value.status !== "cleared") errors.push("Agent staged plan draft status is invalid.");
  for (const key of ["draftId", "createdAt", "expiresAt", "projectId", "projectTitle", "sourceFactHash"] as const) {
    if (!textValue(value[key])) errors.push(`Agent staged plan draft is missing ${key}.`);
  }
  if (!Array.isArray(value.selectedShotIds) || value.selectedShotIds.some((item) => typeof item !== "string")) {
    errors.push("Agent staged plan draft selectedShotIds must be a string array.");
  }
  if (!Array.isArray(value.blockedReasons) || value.blockedReasons.some((item) => typeof item !== "string")) {
    errors.push("Agent staged plan draft blockedReasons must be a string array.");
  }
  if (value.status === "active") {
    if (!textValue(value.userIntent)) errors.push("Agent staged plan draft is missing userIntent.");
    if (!isRecord(value.action)) errors.push("Agent staged plan draft is missing action.");
    if (!isRecord(value.toolHandoff)) errors.push("Agent staged plan draft is missing toolHandoff.");
    if (isRecord(value.action) && value.action.schemaVersion !== "director_agent_action/0.1.0") errors.push("Agent action schema is invalid.");
    if (isRecord(value.toolHandoff) && value.toolHandoff.schemaVersion !== "director_agent_tool_handoff/0.1.0") errors.push("Agent tool handoff schema is invalid.");
    if (isRecord(value.action) && !textValue(value.action.actionId)) errors.push("Agent action is missing actionId.");
    if (isRecord(value.toolHandoff) && !textValue(value.toolHandoff.actionId)) errors.push("Agent tool handoff is missing actionId.");
    if (
      isRecord(value.action)
      && isRecord(value.toolHandoff)
      && textValue(value.action.actionId)
      && textValue(value.toolHandoff.actionId)
      && value.action.actionId !== value.toolHandoff.actionId
    ) {
      errors.push("Agent staged plan draft action and handoff do not match.");
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, draft: value as unknown as ProjectAgentStagedPlanDraft, errors: [] };
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeProjectRoot(value?: string) {
  return value
    ?.trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/g, "")
    .replace(/^\/private\/tmp(?=\/|$)/, "/tmp");
}

function isBrowserDraftProjectRoot(projectRoot?: string) {
  const normalized = projectRoot?.replace(/\\/g, "/").trim() || "";
  return normalized === ".vibe-runtime/browser-projects"
    || normalized.startsWith(".vibe-runtime/browser-projects/")
    || normalized.includes("/.vibe-runtime/browser-projects/");
}

function compactId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "id";
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
