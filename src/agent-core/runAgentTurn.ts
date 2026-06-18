import { buildDirectorAgentActionEnvelope } from "../core/directorAgentAction";
import type {
  DirectorAgentActionEnvelope,
  DirectorAgentStateSnapshot,
} from "../core/directorAgentAction";
import {
  appendVibeAgentTimelineEntries,
  createVibeAgentTimelineDocument,
} from "./timelineDocument";
import type {
  VibeAgentProjectSnapshot,
  VibeAgentTimelineDocument,
  VibeAgentTurnInput,
  VibeAgentTurnResult,
} from "./types";
import { VIBE_AGENT_CORE_SCHEMA_VERSION } from "./types";
import { evaluateVibeAgentPermission } from "./permissionGate";
import {
  buildVibeAgentTurnTimelineEntries,
  confirmationTokenFor,
} from "./toolEvents";

export function runVibeAgentTurn(input: VibeAgentTurnInput): VibeAgentTurnResult {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const projectSnapshot = summarizeProjectForAgent(input.snapshot, input.projectId);
  const action = input.action || buildDirectorAgentActionEnvelope({
    userIntent: input.userMessage,
    snapshot: input.snapshot,
    executionContract: planningExecutionContract(),
    generatedAt,
  });
  const permissionDecision = evaluateVibeAgentPermission({
    action,
    permissionMode: input.permissionMode,
    userConfirmed: input.userConfirmed,
  });
  const timelineBase = input.previousTimeline || createVibeAgentTimelineDocument({
    projectId: input.projectId,
    projectTitle: input.projectTitle,
    projectRoot: input.projectRoot,
    generatedAt,
  });
  const newEntries = buildVibeAgentTurnTimelineEntries({
    generatedAt,
    userMessage: input.userMessage,
    action,
    projectSnapshot,
    permissionDecision,
    userConfirmed: Boolean(input.userConfirmed),
  });
  const timeline = appendVibeAgentTimelineEntries(timelineBase, newEntries, generatedAt);
  return {
    schemaVersion: VIBE_AGENT_CORE_SCHEMA_VERSION,
    status: statusFor(action, permissionDecision),
    generatedAt,
    action,
    projectSnapshot,
    permissionDecision,
    timeline,
    pendingConfirmationToken: permissionDecision.requiresConfirmation
      ? confirmationTokenFor(action)
      : undefined,
  };
}

function summarizeProjectForAgent(
  snapshot: DirectorAgentStateSnapshot,
  projectId: string,
): VibeAgentProjectSnapshot {
  return {
    projectId,
    projectTitle: snapshot.projectTitle,
    projectRoot: snapshot.projectRoot,
    totalShots: snapshot.totalShots,
    missingReferences: snapshot.assetCounts.missing,
    needsReviewReferences: snapshot.assetCounts.needsReview,
    lockedReferences: snapshot.assetCounts.locked,
    readyForVideo: snapshot.projectReadiness.status === "ready_for_video",
    videoStatus: snapshot.videoState.status,
    videoCanResume: snapshot.videoState.canResume,
    videoWaitingCount: snapshot.videoState.waitingCount,
    videoCompletedCount: snapshot.videoState.completedCount,
    videoReviewCount: snapshot.videoState.reviewCount,
    currentView: snapshot.currentView,
    selectedShotIds: snapshot.selectedShotIds,
    selectedAssetId: snapshot.selectedAssetId,
  };
}

function planningExecutionContract() {
  return {
    mode: "video_allowed" as const,
    referenceGenerationAllowed: true,
    videoSubmitAllowed: true,
    providerSubmitAllowed: true,
    reason: "Agent 内核先规划最佳动作，实际执行由 Vibe 权限门和用户确认决定。",
  };
}

function statusFor(
  action: DirectorAgentActionEnvelope,
  permissionDecision: { allowed: boolean; requiresConfirmation: boolean },
): VibeAgentTurnResult["status"] {
  if (action.status === "blocked") return "blocked";
  if (permissionDecision.requiresConfirmation) return "awaiting_confirmation";
  if (action.kind === "inspect_project_status") return "inspected";
  return "action_ready";
}
