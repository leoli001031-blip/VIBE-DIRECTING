import type {
  DirectorAgentActionEnvelope,
  DirectorAgentActionKind,
  DirectorAgentStateSnapshot,
} from "../core/directorAgentAction";

export const VIBE_AGENT_CORE_SCHEMA_VERSION = "vibe_agent_core/0.1.0";
export const VIBE_AGENT_TIMELINE_SCHEMA_VERSION = "vibe_agent_timeline/0.1.0";

export type VibeAgentPermissionMode =
  | "plan_only"
  | "project_write_allowed"
  | "reference_allowed"
  | "video_allowed"
  | "export_allowed";

export type VibeAgentEntryType =
  | "user_message"
  | "assistant_message"
  | "tool_call"
  | "tool_result"
  | "confirmation_request"
  | "action_result"
  | "state_change";

export type VibeAgentToolName =
  | "inspect_project"
  | "scan_assets"
  | "plan_next_action"
  | "write_agent_message"
  | "write_project"
  | "research_style"
  | "generate_references"
  | "submit_video"
  | "query_video"
  | "export_project"
  | "request_user_confirmation"
  | "run_confirmed_action";

export interface VibeAgentFact {
  label: string;
  value: string;
}

export interface VibeAgentTimelineEntry {
  id: string;
  type: VibeAgentEntryType;
  createdAt: string;
  title: string;
  body: string;
  facts?: VibeAgentFact[];
  toolName?: VibeAgentToolName;
  actionKind?: DirectorAgentActionKind;
  actionId?: string;
  confirmationRequired?: boolean;
  confirmationToken?: string;
  status?: "done" | "waiting" | "blocked";
  details?: Record<string, unknown>;
}

export interface VibeAgentTimelineDocument {
  schemaVersion: typeof VIBE_AGENT_TIMELINE_SCHEMA_VERSION;
  projectId: string;
  projectTitle: string;
  projectRoot?: string;
  updatedAt: string;
  entries: VibeAgentTimelineEntry[];
}

export interface VibeAgentProjectSnapshot {
  projectId: string;
  projectTitle: string;
  projectRoot?: string;
  totalShots: number;
  missingReferences: number;
  needsReviewReferences: number;
  lockedReferences: number;
  readyForVideo: boolean;
  videoStatus: string;
  videoCanResume: boolean;
  videoWaitingCount: number;
  videoCompletedCount: number;
  videoReviewCount: number;
  currentView?: string;
  selectedShotIds: string[];
  selectedAssetId?: string;
}

export interface VibeAgentActionDescriptor {
  id: VibeAgentToolName;
  label: string;
  description: string;
  mutatesProject: boolean;
  callsProvider: boolean;
  requiresConfirmation: boolean;
  minimumPermission: VibeAgentPermissionMode;
}

export interface VibeAgentPermissionDecision {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason: string;
}

export interface VibeAgentTurnInput {
  userMessage: string;
  projectId: string;
  projectTitle: string;
  projectRoot?: string;
  snapshot: DirectorAgentStateSnapshot;
  action?: DirectorAgentActionEnvelope;
  permissionMode: VibeAgentPermissionMode;
  userConfirmed?: boolean;
  generatedAt?: string;
  previousTimeline?: VibeAgentTimelineDocument;
}

export interface VibeAgentTurnResult {
  schemaVersion: typeof VIBE_AGENT_CORE_SCHEMA_VERSION;
  status: "awaiting_confirmation" | "inspected" | "action_ready" | "blocked";
  generatedAt: string;
  action: DirectorAgentActionEnvelope;
  projectSnapshot: VibeAgentProjectSnapshot;
  permissionDecision: VibeAgentPermissionDecision;
  timeline: VibeAgentTimelineDocument;
  pendingConfirmationToken?: string;
}
