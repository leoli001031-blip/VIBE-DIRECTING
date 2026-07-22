import type { VibeAgentTimelineEntry } from "../agent-core/types";
import type { DirectorRhythmProfile } from "./directorRhythmPlanner";

export type RecoveredNewVideoStoryboardRow = {
  id: string;
  shotNo: string;
  duration: string;
  shotSize: string;
  camera: string;
  visualDescription: string;
  primaryAction: string;
  actionTrigger: string;
  microReaction: string;
  actionReactionQa: string;
  executionMode: "single_continuous_shot" | "relationship_wide" | "action_insert" | "reaction_closeup" | "planned_cut_sequence";
  referenceStrategy: "storyboard_narrative" | "storyboard_rapid_cut" | "omni_reference";
  visibleCutBudget: string;
  visibleClips: number;
  storyboardPanels: number;
  actionBeats: string[];
  subtitle: string;
  sound: string;
  title: string;
  characters: string;
  scene: string;
  props: string;
  audioUsage: string;
  rhythmProfile: DirectorRhythmProfile;
  rhythmReason: string;
  sourceFactId?: string;
};

export type NewVideoIntakeRecoveryPhase = "planning_started" | "planning_ready" | "planning_blocked";

export type NewVideoIntakeRecoveryResult =
  | {
      status: "restorable";
      phase: NewVideoIntakeRecoveryPhase;
      createdAt: string;
      draftScript: string;
      draftStyle: string;
      projectTargetMode: "current_project" | "new_project";
      selectedShotNo?: string;
      storyboardRows?: RecoveredNewVideoStoryboardRow[];
    }
  | {
      status: "none" | "invalid";
      reason: string;
    };

const recoverablePhases = new Set<NewVideoIntakeRecoveryPhase>([
  "planning_started",
  "planning_ready",
  "planning_blocked",
]);

export function recoverPendingNewVideoIntake(
  entries: VibeAgentTimelineEntry[],
): NewVideoIntakeRecoveryResult {
  const phasedEntries = entries.filter((entry) => timelinePhase(entry));
  if (!phasedEntries.length) return { status: "none", reason: "missing_intake_timeline" };

  const latestCreatedAt = phasedEntries.reduce((latest, entry) => (
    compareTimelineTimes(entry.createdAt, latest) > 0 ? entry.createdAt : latest
  ), phasedEntries[0]!.createdAt);
  const latestEntries = phasedEntries.filter((entry) => entry.createdAt === latestCreatedAt);
  const latestPhase = latestEntries
    .map((entry) => timelinePhase(entry))
    .filter((phase): phase is string => Boolean(phase))
    .sort((left, right) => phasePriority(right) - phasePriority(left))[0];

  if (latestPhase === "draft_confirmed") return { status: "none", reason: "draft_already_confirmed" };
  if (!latestPhase || !recoverablePhases.has(latestPhase as NewVideoIntakeRecoveryPhase)) {
    return { status: "none", reason: "latest_intake_not_recoverable" };
  }
  if (
    latestPhase === "planning_ready"
    && !latestEntries.some((entry) => entry.type === "confirmation_request" && entry.status === "waiting")
  ) {
    return { status: "invalid", reason: "ready_confirmation_missing" };
  }

  const draftScript = latestDetailText(latestEntries, "draftScript");
  if (!draftScript) return { status: "invalid", reason: "draft_script_missing" };
  const projectTargetMode = latestDetailText(latestEntries, "projectTargetMode") === "new_project"
    ? "new_project"
    : "current_project";
  const storyboardRows = latestStructuredStoryboardRows(latestEntries);
  if (storyboardRows.status === "invalid") {
    return { status: "invalid", reason: storyboardRows.reason || "draft_storyboard_rows_invalid" };
  }
  const latestConfirmedAt = phasedEntries
    .filter((entry) => timelinePhase(entry) === "draft_confirmed")
    .map((entry) => entry.createdAt)
    .sort((left, right) => compareTimelineTimes(right, left))[0];
  const selectedShotNo = latestStructuredSelection(entries, latestConfirmedAt);

  return {
    status: "restorable",
    phase: latestPhase as NewVideoIntakeRecoveryPhase,
    createdAt: latestCreatedAt,
    draftScript,
    draftStyle: latestDetailText(latestEntries, "draftStyle"),
    projectTargetMode,
    selectedShotNo,
    storyboardRows: storyboardRows.rows,
  };
}

const storyboardStringFields = [
  "id",
  "shotNo",
  "duration",
  "shotSize",
  "camera",
  "visualDescription",
  "primaryAction",
  "actionTrigger",
  "microReaction",
  "actionReactionQa",
  "visibleCutBudget",
  "subtitle",
  "sound",
  "title",
  "characters",
  "scene",
  "props",
  "audioUsage",
  "rhythmReason",
] as const;

const storyboardExecutionModes = new Set([
  "single_continuous_shot",
  "relationship_wide",
  "action_insert",
  "reaction_closeup",
  "planned_cut_sequence",
]);
const storyboardReferenceStrategies = new Set([
  "storyboard_narrative",
  "storyboard_rapid_cut",
  "omni_reference",
]);
const storyboardRhythmProfiles = new Set<DirectorRhythmProfile>([
  "quiet_dialogue",
  "anime_emotion",
  "action_fast_cut",
  "comedy_reaction",
  "suspense_pressure",
  "commercial_short",
  "emotion_montage",
  "lyrical_observation",
]);

function latestStructuredStoryboardRows(entries: VibeAgentTimelineEntry[]): {
  status: "missing" | "valid" | "invalid";
  rows?: RecoveredNewVideoStoryboardRow[];
  reason?: string;
} {
  const source = [...entries].reverse().find((entry) => (
    entry.details && Object.prototype.hasOwnProperty.call(entry.details, "draftStoryboardRows")
  ));
  if (!source) return { status: "missing" };
  const value = source.details?.draftStoryboardRows;
  if (!Array.isArray(value) || value.length === 0 || value.length > 24) {
    return { status: "invalid", reason: "draft_storyboard_rows_invalid" };
  }
  const rows: RecoveredNewVideoStoryboardRow[] = [];
  const ids = new Set<string>();
  const shotNumbers = new Set<string>();
  for (const valueRow of value) {
    if (!valueRow || typeof valueRow !== "object" || Array.isArray(valueRow)) {
      return { status: "invalid", reason: "draft_storyboard_row_invalid" };
    }
    const row = valueRow as Record<string, unknown>;
    if (storyboardStringFields.some((field) => typeof row[field] !== "string")) {
      return { status: "invalid", reason: "draft_storyboard_row_fields_invalid" };
    }
    if (
      !storyboardExecutionModes.has(String(row.executionMode))
      || !storyboardReferenceStrategies.has(String(row.referenceStrategy))
      || !storyboardRhythmProfiles.has(row.rhythmProfile as DirectorRhythmProfile)
      || !Number.isInteger(row.visibleClips)
      || Number(row.visibleClips) < 1
      || !Number.isInteger(row.storyboardPanels)
      || Number(row.storyboardPanels) < 0
      || !Array.isArray(row.actionBeats)
      || row.actionBeats.some((beat) => typeof beat !== "string")
      || (row.sourceFactId !== undefined && typeof row.sourceFactId !== "string")
    ) {
      return { status: "invalid", reason: "draft_storyboard_row_contract_invalid" };
    }
    const id = String(row.id).trim();
    const shotNo = String(row.shotNo).trim();
    if (!id || !shotNo || ids.has(id) || shotNumbers.has(shotNo)) {
      return { status: "invalid", reason: "draft_storyboard_row_identity_invalid" };
    }
    ids.add(id);
    shotNumbers.add(shotNo);
    rows.push(row as RecoveredNewVideoStoryboardRow);
  }
  return { status: "valid", rows };
}

function latestStructuredSelection(entries: VibeAgentTimelineEntry[], latestConfirmedAt?: string) {
  const selection = entries
    .filter((entry) => (
      entry.id.startsWith("draft_selection_context_")
      && (!latestConfirmedAt || compareTimelineTimes(entry.createdAt, latestConfirmedAt) > 0)
      && detailText(entry, "selectedShotNo")
    ))
    .sort((left, right) => compareTimelineTimes(right.createdAt, left.createdAt))[0];
  return detailText(selection, "selectedShotNo") || undefined;
}

function latestDetailText(entries: VibeAgentTimelineEntry[], key: string) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const value = detailText(entries[index], key);
    if (value) return value;
  }
  return "";
}

function detailText(entry: VibeAgentTimelineEntry | undefined, key: string) {
  const value = entry?.details?.[key];
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function timelinePhase(entry: VibeAgentTimelineEntry) {
  return detailText(entry, "intakePhase");
}

function phasePriority(phase: string) {
  if (phase === "draft_confirmed") return 5;
  if (phase === "planning_ready") return 4;
  if (phase === "planning_blocked") return 3;
  if (phase === "planning_started") return 2;
  return 1;
}

function compareTimelineTimes(left: string, right: string) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime;
  return left.localeCompare(right);
}
