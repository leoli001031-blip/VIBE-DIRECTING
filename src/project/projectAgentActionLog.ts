import {
  readProjectVibeSidecarText,
  writeProjectVibeSidecarText,
  type ProjectVibeDraftTarget,
} from "./projectVibeDraftStore";
import type { ProjectVibeDocument } from "./types";

export const PROJECT_AGENT_ACTION_LOG_SCHEMA_VERSION = "director_agent_action_log/0.1.0";
export const projectAgentActionLogPath = ".vibe-runtime/agent-action-log.json";
export const defaultProjectAgentActionLogLimit = 4;

export type ProjectAgentActionLogView = "story" | "assets" | "preview" | "export";
export type ProjectAgentActionLogTone = "done" | "waiting" | "blocked";

export interface ProjectAgentActionLogResultView {
  view: ProjectAgentActionLogView;
  label: string;
}

export interface ProjectAgentActionLogItem {
  id: string;
  title: string;
  scope: string;
  result: string;
  nextStep: string;
  resultView?: ProjectAgentActionLogResultView;
  followUpIntent: string;
  tone: ProjectAgentActionLogTone;
  createdAt: string;
}

export interface ProjectAgentActionLogDocument {
  schemaVersion: typeof PROJECT_AGENT_ACTION_LOG_SCHEMA_VERSION;
  projectId: string;
  projectTitle: string;
  projectRoot?: string;
  updatedAt: string;
  items: ProjectAgentActionLogItem[];
}

export type ProjectAgentActionLogOpenStatus =
  | "restored"
  | "missing"
  | "project_mismatch"
  | "invalid"
  | "unavailable"
  | "error";

export interface ProjectAgentActionLogOpenResult {
  ok: boolean;
  status: ProjectAgentActionLogOpenStatus;
  path: string;
  log?: ProjectAgentActionLogDocument;
  items: ProjectAgentActionLogItem[];
  errors: string[];
}

export interface ProjectAgentActionLogWriteResult {
  ok: boolean;
  status: "written" | "unavailable" | "error";
  path: string;
  log?: ProjectAgentActionLogDocument;
  items: ProjectAgentActionLogItem[];
  errors: string[];
}

export interface SaveProjectAgentActionLogItemInput {
  project: ProjectVibeDocument;
  projectRoot?: string;
  generatedAt?: string;
  item: ProjectAgentActionLogItem;
  limit?: number;
}

type JsonRecord = Record<string, unknown>;

export function buildProjectAgentActionLogDocument(input: {
  project: ProjectVibeDocument;
  projectRoot?: string;
  generatedAt?: string;
  items?: ProjectAgentActionLogItem[];
  limit?: number;
}): ProjectAgentActionLogDocument {
  const updatedAt = input.generatedAt || new Date().toISOString();
  return {
    schemaVersion: PROJECT_AGENT_ACTION_LOG_SCHEMA_VERSION,
    projectId: input.project.manifest.projectId,
    projectTitle: input.project.manifest.title,
    projectRoot: normalizeProjectRoot(input.projectRoot),
    updatedAt,
    items: normalizeActionLogItems(input.items || [], input.limit),
  };
}

export async function openProjectAgentActionLog(
  target: ProjectVibeDraftTarget,
  input: {
    project: ProjectVibeDocument;
    projectRoot?: string;
    limit?: number;
  },
): Promise<ProjectAgentActionLogOpenResult> {
  const readResult = await readProjectVibeSidecarText(target, projectAgentActionLogPath);
  if (!readResult.ok || readResult.content == null) {
    return {
      ok: false,
      status: readResult.status === "unavailable" ? "unavailable" : readResult.status === "missing" ? "missing" : "error",
      path: readResult.path,
      items: [],
      errors: readResult.errors,
    };
  }
  try {
    const parsed = parseProjectAgentActionLogDocument(JSON.parse(readResult.content), input.limit);
    if (!parsed.ok || !parsed.log) {
      return { ok: false, status: "invalid", path: readResult.path, items: [], errors: parsed.errors };
    }
    const mismatch = projectActionLogMismatch(parsed.log, input.project, input.projectRoot || target.projectRoot);
    if (mismatch) {
      return { ok: false, status: "project_mismatch", path: readResult.path, log: parsed.log, items: [], errors: [mismatch] };
    }
    return { ok: true, status: "restored", path: readResult.path, log: parsed.log, items: parsed.log.items, errors: [] };
  } catch (error) {
    return {
      ok: false,
      status: "invalid",
      path: readResult.path,
      items: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export async function appendProjectAgentActionLogItem(
  target: ProjectVibeDraftTarget,
  input: SaveProjectAgentActionLogItemInput,
): Promise<ProjectAgentActionLogWriteResult> {
  const limit = input.limit ?? defaultProjectAgentActionLogLimit;
  const openResult = await openProjectAgentActionLog(target, {
    project: input.project,
    projectRoot: input.projectRoot || target.projectRoot,
    limit,
  });
  const nextLog = buildProjectAgentActionLogDocument({
    project: input.project,
    projectRoot: input.projectRoot || target.projectRoot,
    generatedAt: input.generatedAt || input.item.createdAt,
    limit,
    items: rememberProjectAgentActionLogItem(openResult.ok ? openResult.items : [], input.item, limit),
  });
  const writeResult = await writeProjectVibeSidecarText(
    target,
    projectAgentActionLogPath,
    `${JSON.stringify(nextLog, null, 2)}\n`,
  );
  return {
    ok: writeResult.ok,
    status: writeResult.ok ? "written" : writeResult.status === "unavailable" ? "unavailable" : "error",
    path: writeResult.path,
    log: writeResult.ok ? nextLog : undefined,
    items: writeResult.ok ? nextLog.items : [],
    errors: writeResult.errors,
  };
}

export function rememberProjectAgentActionLogItem(
  items: ProjectAgentActionLogItem[],
  nextItem: ProjectAgentActionLogItem,
  limit = defaultProjectAgentActionLogLimit,
): ProjectAgentActionLogItem[] {
  return normalizeActionLogItems(
    [nextItem, ...items.filter((item) => item.id !== nextItem.id)],
    limit,
  );
}

export function parseProjectAgentActionLogDocument(value: unknown, limit = defaultProjectAgentActionLogLimit): {
  ok: boolean;
  log?: ProjectAgentActionLogDocument;
  errors: string[];
} {
  if (!isRecord(value)) return { ok: false, errors: ["Agent action log must be an object."] };
  const errors: string[] = [];
  if (value.schemaVersion !== PROJECT_AGENT_ACTION_LOG_SCHEMA_VERSION) errors.push("Unsupported Agent action log schema.");
  for (const key of ["projectId", "projectTitle", "updatedAt"] as const) {
    if (!textValue(value[key])) errors.push(`Agent action log is missing ${key}.`);
  }
  if (!Array.isArray(value.items)) errors.push("Agent action log items must be an array.");
  const items = Array.isArray(value.items) ? value.items.map(parseActionLogItem).filter((item): item is ProjectAgentActionLogItem => Boolean(item)) : [];
  if (Array.isArray(value.items) && items.length !== value.items.length) {
    errors.push("Agent action log contains invalid items.");
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    log: {
      schemaVersion: PROJECT_AGENT_ACTION_LOG_SCHEMA_VERSION,
      projectId: textValue(value.projectId) || "",
      projectTitle: textValue(value.projectTitle) || "",
      projectRoot: normalizeProjectRoot(textValue(value.projectRoot)),
      updatedAt: textValue(value.updatedAt) || "",
      items: normalizeActionLogItems(items, limit),
    },
  };
}

function parseActionLogItem(value: unknown): ProjectAgentActionLogItem | undefined {
  if (!isRecord(value)) return undefined;
  const id = textValue(value.id);
  const title = textValue(value.title);
  const scope = textValue(value.scope);
  const result = textValue(value.result);
  const nextStep = textValue(value.nextStep);
  const followUpIntent = textValue(value.followUpIntent);
  const createdAt = textValue(value.createdAt);
  const tone = toneValue(value.tone);
  if (!id || !title || !scope || !result || !nextStep || !followUpIntent || !createdAt || !tone) return undefined;
  return {
    id,
    title,
    scope,
    result,
    nextStep,
    resultView: resultViewValue(value.resultView),
    followUpIntent,
    tone,
    createdAt,
  };
}

function normalizeActionLogItems(items: ProjectAgentActionLogItem[], limit = defaultProjectAgentActionLogLimit): ProjectAgentActionLogItem[] {
  return Array.from(new Map(
    items
      .filter((item) => parseActionLogItem(item))
      .map((item) => [item.id, item] as const),
  ).values()).slice(0, Math.max(1, limit));
}

function projectActionLogMismatch(log: ProjectAgentActionLogDocument, project: ProjectVibeDocument, projectRoot?: string): string | undefined {
  if (log.projectId !== project.manifest.projectId) return "Agent action log belongs to another project.";
  const expectedRoot = normalizeProjectRoot(projectRoot);
  const logRoot = normalizeProjectRoot(log.projectRoot);
  if (expectedRoot && logRoot && expectedRoot !== logRoot) return "Agent action log belongs to another project root.";
  return undefined;
}

function resultViewValue(value: unknown): ProjectAgentActionLogResultView | undefined {
  if (!isRecord(value)) return undefined;
  const view = viewValue(value.view);
  const label = textValue(value.label);
  return view && label ? { view, label } : undefined;
}

function viewValue(value: unknown): ProjectAgentActionLogView | undefined {
  return value === "story" || value === "assets" || value === "preview" || value === "export" ? value : undefined;
}

function toneValue(value: unknown): ProjectAgentActionLogTone | undefined {
  return value === "done" || value === "waiting" || value === "blocked" ? value : undefined;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeProjectRoot(value?: string) {
  return value?.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
}
