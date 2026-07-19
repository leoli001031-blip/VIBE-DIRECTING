import type {
  VibeAgentTimelineDocument,
  VibeAgentTimelineEntry,
} from "./types";
import { VIBE_AGENT_TIMELINE_SCHEMA_VERSION } from "./types";

export interface VibeAgentTimelineSeed {
  projectId: string;
  projectTitle: string;
  projectRoot?: string;
  generatedAt?: string;
}

export function createVibeAgentTimelineDocument(input: VibeAgentTimelineSeed): VibeAgentTimelineDocument {
  const updatedAt = input.generatedAt || new Date().toISOString();
  return {
    schemaVersion: VIBE_AGENT_TIMELINE_SCHEMA_VERSION,
    projectId: input.projectId,
    projectTitle: input.projectTitle,
    projectRoot: normalizeRoot(input.projectRoot),
    updatedAt,
    entries: [],
  };
}

export function appendVibeAgentTimelineEntries(
  timeline: VibeAgentTimelineDocument,
  entries: VibeAgentTimelineEntry[],
  generatedAt?: string,
): VibeAgentTimelineDocument {
  const existing = new Map(timeline.entries.map((entry) => [entry.id, entry]));
  let changed = false;
  for (const entry of entries) {
    const current = existing.get(entry.id);
    if (current && timelineEntriesMatchIgnoringCreatedAt(current, entry)) continue;
    existing.set(entry.id, entry);
    changed = true;
  }
  if (!changed) return timeline;
  const updatedAt = generatedAt || entries[entries.length - 1]?.createdAt || new Date().toISOString();
  return {
    ...timeline,
    updatedAt,
    entries: Array.from(existing.values()).sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
  };
}

function timelineEntriesMatchIgnoringCreatedAt(
  left: VibeAgentTimelineEntry,
  right: VibeAgentTimelineEntry,
) {
  return left.id === right.id
    && left.type === right.type
    && left.title === right.title
    && left.body === right.body
    && left.lifecycle === right.lifecycle
    && left.toolName === right.toolName
    && left.actionKind === right.actionKind
    && left.actionId === right.actionId
    && left.confirmationRequired === right.confirmationRequired
    && left.confirmationToken === right.confirmationToken
    && left.status === right.status
    && JSON.stringify(left.facts || []) === JSON.stringify(right.facts || [])
    && JSON.stringify(left.details || {}) === JSON.stringify(right.details || {});
}

export function parseVibeAgentTimelineDocument(value: unknown): {
  ok: boolean;
  timeline?: VibeAgentTimelineDocument;
  errors: string[];
} {
  if (!isRecord(value)) return { ok: false, errors: ["Agent timeline must be an object."] };
  const errors: string[] = [];
  if (value.schemaVersion !== VIBE_AGENT_TIMELINE_SCHEMA_VERSION) errors.push("Unsupported Agent timeline schema.");
  for (const key of ["projectId", "projectTitle", "updatedAt"] as const) {
    if (!textValue(value[key])) errors.push(`Agent timeline is missing ${key}.`);
  }
  if (!Array.isArray(value.entries)) errors.push("Agent timeline entries must be an array.");
  const entries = Array.isArray(value.entries)
    ? value.entries.map(parseTimelineEntry).filter((entry): entry is VibeAgentTimelineEntry => Boolean(entry))
    : [];
  if (Array.isArray(value.entries) && entries.length !== value.entries.length) {
    errors.push("Agent timeline contains invalid entries.");
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    timeline: {
      schemaVersion: VIBE_AGENT_TIMELINE_SCHEMA_VERSION,
      projectId: textValue(value.projectId) || "",
      projectTitle: textValue(value.projectTitle) || "",
      projectRoot: normalizeRoot(textValue(value.projectRoot)),
      updatedAt: textValue(value.updatedAt) || "",
      entries,
    },
  };
}

function parseTimelineEntry(value: unknown): VibeAgentTimelineEntry | undefined {
  if (!isRecord(value)) return undefined;
  const id = textValue(value.id);
  const type = textValue(value.type);
  const createdAt = textValue(value.createdAt);
  const title = textValue(value.title);
  const body = textValue(value.body);
  if (!id || !createdAt || !title || !body) return undefined;
  if (
    type !== "user_message"
    && type !== "assistant_message"
    && type !== "tool_call"
    && type !== "tool_result"
    && type !== "confirmation_request"
    && type !== "action_result"
    && type !== "state_change"
  ) {
    return undefined;
  }
  return value as unknown as VibeAgentTimelineEntry;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRoot(value?: string) {
  return value?.trim().replace(/\\/g, "/").replace(/\/+$/g, "") || undefined;
}
