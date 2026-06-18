import {
  createVibeAgentTimelineDocument,
  parseVibeAgentTimelineDocument,
} from "../agent-core/timelineDocument";
import type {
  VibeAgentTimelineDocument,
} from "../agent-core/types";
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

export async function openProjectAgentTimeline(
  target: ProjectVibeDraftTarget,
  input: {
    project: ProjectVibeDocument;
    projectRoot?: string;
    generatedAt?: string;
  },
): Promise<ProjectAgentTimelineOpenResult> {
  const fallback = createProjectAgentTimeline(input);
  const runtimeRead = target.projectRoot
    ? await loadCurrentProjectAgentTimelineTextFromRuntime({
      projectId: input.project.manifest.projectId,
      projectRoot: target.projectRoot,
    })
    : undefined;
  if (runtimeRead?.ok && runtimeRead.content != null) {
    return parseProjectAgentTimelineText(runtimeRead.content, fallback, {
      path: runtimeRead.path || projectAgentTimelinePath,
    });
  }
  const readResult = await readProjectVibeSidecarText(target, projectAgentTimelinePath);
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
  if (target.projectRoot) {
    const runtimeWrite = await saveCurrentProjectAgentTimelineTextToRuntime({
      projectId: normalizedTimeline.projectId,
      projectRoot: target.projectRoot,
    }, serialized);
    if (runtimeWrite.ok) {
      return {
        ok: true,
        status: "written",
        path: runtimeWrite.path || projectAgentTimelinePath,
        timeline: normalizedTimeline,
        errors: [],
      };
    }
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
    errors: writeResult.errors,
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
  return value.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
}
