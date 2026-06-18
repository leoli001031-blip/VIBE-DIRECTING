import fs from "node:fs";
import path from "node:path";
import type {
  VibeAgentTimelineDocument,
} from "./types";
import {
  createVibeAgentTimelineDocument,
  parseVibeAgentTimelineDocument,
  type VibeAgentTimelineSeed,
} from "./timelineDocument";

export const vibeAgentTimelineRelativePath = ".vibe-runtime/agent-timeline.json";

export {
  appendVibeAgentTimelineEntries,
  createVibeAgentTimelineDocument,
  parseVibeAgentTimelineDocument,
} from "./timelineDocument";

export function loadVibeAgentTimelineFromProjectRoot(input: VibeAgentTimelineSeed): VibeAgentTimelineDocument {
  const projectRoot = input.projectRoot?.trim();
  if (!projectRoot) return createVibeAgentTimelineDocument(input);
  const filePath = path.join(projectRoot, vibeAgentTimelineRelativePath);
  if (!fs.existsSync(filePath)) return createVibeAgentTimelineDocument(input);
  try {
    const parsed = parseVibeAgentTimelineDocument(JSON.parse(fs.readFileSync(filePath, "utf8")));
    if (!parsed.ok || !parsed.timeline) return createVibeAgentTimelineDocument(input);
    if (parsed.timeline.projectId !== input.projectId) return createVibeAgentTimelineDocument(input);
    if (
      parsed.timeline.projectRoot
      && normalizeProjectRoot(parsed.timeline.projectRoot) !== normalizeProjectRoot(projectRoot)
    ) {
      return createVibeAgentTimelineDocument(input);
    }
    return parsed.timeline;
  } catch {
    return createVibeAgentTimelineDocument(input);
  }
}

export function saveVibeAgentTimelineToProjectRoot(
  projectRoot: string | undefined,
  timeline: VibeAgentTimelineDocument,
): { ok: boolean; path?: string; error?: string } {
  const root = projectRoot?.trim();
  if (!root) return { ok: false, error: "Project root is missing." };
  const filePath = path.join(root, vibeAgentTimelineRelativePath);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify({
      ...timeline,
      projectRoot: normalizeProjectRoot(root),
    }, null, 2)}\n`);
    return { ok: true, path: filePath };
  } catch (error) {
    return { ok: false, path: filePath, error: error instanceof Error ? error.message : String(error) };
  }
}

function normalizeProjectRoot(value: string) {
  return value.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
}
