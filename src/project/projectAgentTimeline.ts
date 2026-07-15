import {
  createVibeAgentTimelineDocument,
  parseVibeAgentTimelineDocument,
} from "../agent-core/timelineDocument";
import type {
  VibeAgentTimelineDocument,
  VibeAgentTimelineEntry,
} from "../agent-core/types";
import { restoreAgentVideoExecutionReceipt } from "../core/agentVideoExecutionAdapter";
import {
  readProjectVibeSidecarText,
  writeProjectVibeSidecarText,
  type ProjectVibeDraftTarget,
} from "./projectVibeDraftStore";
import type { ProjectVibeDocument } from "./types";
import {
  loadCurrentProjectAgentTimelineTextFromRuntime,
  saveCurrentProjectAgentTimelineTextToRuntime,
} from "../core/projectCurrentRuntimeClient";

export const projectAgentTimelinePath = ".vibe-runtime/agent-timeline.json";

export type ProjectAgentTimelineOpenStatus =
  | "restored"
  | "missing"
  | "project_mismatch"
  | "invalid"
  | "unavailable"
  | "error";

export interface ProjectAgentTimelineOpenResult {
  ok: boolean;
  status: ProjectAgentTimelineOpenStatus;
  path: string;
  timeline: VibeAgentTimelineDocument;
  errors: string[];
}

export interface ProjectAgentTimelineWriteResult {
  ok: boolean;
  status: "written" | "unavailable" | "error";
  path: string;
  timeline?: VibeAgentTimelineDocument;
  errors: string[];
}

export function bindProjectAgentTimelineEntriesToIdentity(
  entries: VibeAgentTimelineEntry[],
  input: {
    projectId: string;
    projectRoot?: string;
    projectFactHash: string;
  },
): VibeAgentTimelineEntry[] {
  const projectRoot = normalizeRecoveryRoot(input.projectRoot);
  return entries.map((entry) => ({
    ...entry,
    details: {
      ...(entry.details || {}),
      projectId: input.projectId.trim(),
      projectRoot,
      projectFactHash: input.projectFactHash.trim(),
    },
  }));
}

export function migrateProjectAgentTimelineEntriesToProjectRoot(
  entries: VibeAgentTimelineEntry[],
  input: {
    projectId: string;
    sourceProjectRoot?: string;
    targetProjectRoot: string;
    projectFactHash: string;
  },
): VibeAgentTimelineEntry[] {
  const sourceRoot = normalizeRecoveryRoot(input.sourceProjectRoot);
  return entries.flatMap((entry) => {
    const details = isRecord(entry.details) ? entry.details : {};
    const entryProjectId = textValue(details.projectId);
    const entryProjectRoot = normalizeRecoveryRoot(textValue(details.projectRoot));
    const entryFactHash = textValue(details.projectFactHash) || textValue(details.sourceFactHash);
    if (timelineEntryCanDriveRecovery(entry) && (!entryProjectId || !entryFactHash)) return [];
    if (entryProjectId && entryProjectId !== input.projectId) return [];
    if (entryFactHash && entryFactHash !== input.projectFactHash) return [];
    if (
      entryProjectRoot
      && entryProjectRoot !== sourceRoot
      && !(!sourceRoot && isBrowserDraftProjectRoot(entryProjectRoot))
    ) return [];
    if (details.executionReceipt != null) {
      const receipt = restoreAgentVideoExecutionReceipt(details.executionReceipt, {
        projectId: input.projectId,
        projectRoot: input.targetProjectRoot,
        projectFactHash: input.projectFactHash,
      });
      if (!receipt.ok) return [];
    }
    return [{
      ...entry,
      details: {
        ...details,
        projectId: input.projectId,
        projectRoot: normalizeRecoveryRoot(input.targetProjectRoot),
        projectFactHash: input.projectFactHash,
      },
    }];
  });
}

function isBrowserDraftProjectRoot(projectRoot?: string) {
  const normalized = projectRoot?.replace(/\\/g, "/").trim() || "";
  return normalized === ".vibe-runtime/browser-projects"
    || normalized.startsWith(".vibe-runtime/browser-projects/")
    || normalized.includes("/.vibe-runtime/browser-projects/");
}

export async function openProjectAgentTimeline(
  target: ProjectVibeDraftTarget,
  input: {
    project: ProjectVibeDocument;
    projectRoot?: string;
    generatedAt?: string;
  },
): Promise<ProjectAgentTimelineOpenResult> {
  const fallback = createProjectAgentTimeline(input);
  const runtimeRead = target.projectRoot && !isBrowserDraftProjectRoot(target.projectRoot)
    ? await loadCurrentProjectAgentTimelineTextFromRuntime({
      projectId: input.project.manifest.projectId,
      projectRoot: target.projectRoot,
    })
    : undefined;
  const runtimeOpen = runtimeRead?.ok && runtimeRead.content != null
    ? parseProjectAgentTimelineText(runtimeRead.content, fallback, {
      path: runtimeRead.path || projectAgentTimelinePath,
    })
    : undefined;
  const readResult = await readProjectVibeSidecarText(target, projectAgentTimelinePath);
  const sidecarOpen = readResult.ok && readResult.content != null
    ? parseProjectAgentTimelineText(readResult.content, fallback, {
      path: readResult.path,
    })
    : undefined;
  const restored = selectLatestProjectAgentTimelineOpenResult(runtimeOpen, sidecarOpen);
  if (restored) return restored;
  if (runtimeOpen) return runtimeOpen;
  if (sidecarOpen) return sidecarOpen;
  if (!readResult.ok || readResult.content == null) {
    return {
      ok: false,
      status: readResult.status === "unavailable" ? "unavailable" : readResult.status === "missing" ? "missing" : "error",
      path: readResult.path,
      timeline: fallback,
      errors: readResult.errors,
    };
  }
  return parseProjectAgentTimelineText(readResult.content, fallback, {
    path: readResult.path,
  });
}

export async function saveProjectAgentTimeline(
  target: ProjectVibeDraftTarget,
  timeline: VibeAgentTimelineDocument,
): Promise<ProjectAgentTimelineWriteResult> {
  const normalizedTimeline = target.projectRoot
    ? {
        ...timeline,
        projectRoot: normalizeProjectAgentRoot(target.projectRoot),
      }
    : timeline;
  const serialized = `${JSON.stringify(normalizedTimeline, null, 2)}\n`;
  let runtimeWriteError: string | undefined;
  let runtimeWriteOk = false;
  let runtimeWritePath: string | undefined;
  if (target.projectRoot && !isBrowserDraftProjectRoot(target.projectRoot)) {
    try {
      const runtimeWrite = await saveCurrentProjectAgentTimelineTextToRuntime({
        projectId: normalizedTimeline.projectId,
        projectRoot: target.projectRoot,
      }, serialized);
      if (runtimeWrite.ok) {
        runtimeWriteOk = true;
        runtimeWritePath = runtimeWrite.path || projectAgentTimelinePath;
      } else {
        runtimeWriteError = runtimeWrite.message || runtimeWrite.status;
      }
    } catch (error) {
      runtimeWriteError = error instanceof Error ? error.message : String(error);
    }
  }
  if (runtimeWriteOk) {
    return {
      ok: true,
      status: "written",
      path: runtimeWritePath || projectAgentTimelinePath,
      timeline: normalizedTimeline,
      errors: [],
    };
  }
  const writeResult = await writeProjectVibeSidecarText(
    target,
    projectAgentTimelinePath,
    serialized,
  );
  return {
    ok: writeResult.ok,
    status: writeResult.ok ? "written" : writeResult.status === "unavailable" ? "unavailable" : "error",
    path: writeResult.path,
    timeline: writeResult.ok ? timeline : undefined,
    errors: writeResult.ok ? [] : [runtimeWriteError, ...writeResult.errors].filter((item): item is string => Boolean(item)),
  };
}

function parseProjectAgentTimelineText(
  content: string,
  fallback: VibeAgentTimelineDocument,
  input: {
    path: string;
  },
): ProjectAgentTimelineOpenResult {
  try {
    const parsed = parseVibeAgentTimelineDocument(JSON.parse(content));
    if (!parsed.ok || !parsed.timeline) {
      return { ok: false, status: "invalid", path: input.path, timeline: fallback, errors: parsed.errors };
    }
    if (parsed.timeline.projectId !== fallback.projectId) {
      return {
        ok: false,
        status: "project_mismatch",
        path: input.path,
        timeline: fallback,
        errors: ["Agent timeline belongs to another project."],
      };
    }
    if (
      parsed.timeline.projectRoot
      && fallback.projectRoot
      && normalizeProjectAgentRoot(parsed.timeline.projectRoot) !== normalizeProjectAgentRoot(fallback.projectRoot)
    ) {
      return {
        ok: false,
        status: "project_mismatch",
        path: input.path,
        timeline: fallback,
        errors: ["Agent timeline belongs to another project folder."],
      };
    }
    return { ok: true, status: "restored", path: input.path, timeline: parsed.timeline, errors: [] };
  } catch (error) {
    return {
      ok: false,
      status: "invalid",
      path: input.path,
      timeline: fallback,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function selectLatestProjectAgentTimelineOpenResult(
  ...results: Array<ProjectAgentTimelineOpenResult | undefined>
) {
  const restored = results.filter((result): result is ProjectAgentTimelineOpenResult => Boolean(result?.ok));
  if (!restored.length) return undefined;
  return restored.reduce((latest, result) => {
    const latestTime = projectAgentTimelineUpdatedAtMs(latest.timeline);
    const resultTime = projectAgentTimelineUpdatedAtMs(result.timeline);
    return resultTime > latestTime ? result : latest;
  });
}

function projectAgentTimelineUpdatedAtMs(timeline: VibeAgentTimelineDocument) {
  const updatedAt = Date.parse(timeline.updatedAt);
  return Number.isFinite(updatedAt) ? updatedAt : 0;
}

function createProjectAgentTimeline(input: {
  project: ProjectVibeDocument;
  projectRoot?: string;
  generatedAt?: string;
}) {
  return createVibeAgentTimelineDocument({
    projectId: input.project.manifest.projectId,
    projectTitle: input.project.manifest.title,
    projectRoot: input.projectRoot,
    generatedAt: input.generatedAt,
  });
}

function normalizeProjectAgentRoot(value: string) {
  const normalized = value.trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/g, "")
    .replace(/^\.\//, "")
    .replace(/^\/private\/tmp(?=\/|$)/, "/tmp");
  const runtimeRootIndex = normalized.indexOf(".vibe-runtime/");
  if (runtimeRootIndex >= 0) return normalized.slice(runtimeRootIndex);
  return normalized;
}

function normalizeRecoveryRoot(value?: string) {
  return value?.trim().replace(/\\/g, "/").replace(/\/+$/g, "").replace(/^\/private\/tmp(?=\/|$)/, "/tmp") || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function timelineEntryCanDriveRecovery(entry: VibeAgentTimelineEntry) {
  return entry.type === "confirmation_request"
    || entry.type === "action_result"
    || entry.lifecycle === "waiting_for_confirmation"
    || entry.lifecycle === "running"
    || entry.status === "waiting"
    || Boolean(entry.actionKind)
    || Boolean(entry.details?.executionReceipt);
}
