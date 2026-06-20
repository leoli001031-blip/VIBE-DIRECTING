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
  | "classify_assets"
  | "scan_assets"
  | "plan_story"
  | "plan_next_action"
  | "revise_shot"
  | "write_agent_message"
  | "write_project"
  | "research_style"
  | "generate_references"
  | "compile_video_request"
  | "submit_video"
  | "query_video"
  | "export_showcase"
  | "export_project"
  | "save_skill"
  | "request_user_confirmation"
  | "run_confirmed_action";

export type VibeAgentActionLifecycleStatus =
  | "proposed"
  | "waiting_for_confirmation"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "needs_user_input";

export type VibeAgentKernelActionName =
  | "inspect_project"
  | "classify_assets"
  | "plan_story"
  | "revise_shot"
  | "generate_references"
  | "compile_video_request"
  | "submit_video"
  | "query_video"
  | "export_showcase"
  | "save_skill";

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
  lifecycle?: VibeAgentActionLifecycleStatus;
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
  totalSections: number;
  totalShots: number;
  totalAssets: number;
  skillCount: number;
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
  assetInbox?: VibeAgentAssetInboxSnapshot;
}

export interface VibeAgentAssetInboxSnapshot {
  summary: string;
  nextAction: string;
  totalCount: number;
  needsReviewCount: number;
  kindSummary: VibeAgentAssetKindSummary[];
  items: VibeAgentAssetInboxItem[];
}

export interface VibeAgentAssetKindSummary {
  kind: string;
  label: string;
  count: number;
}

export interface VibeAgentAssetInboxItem {
  kind: string;
  label: string;
  detail: string;
  suggestedBinding: string;
  suggestedAction: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  needsReview: boolean;
  originLabel: string;
  assetId?: string;
  shotIds?: string[];
}

export interface VibeAgentSelectedContext {
  kind: "project" | "section" | "shot" | "multi_shot" | "asset" | "video" | "export";
  label: string;
  ids: string[];
}

export interface VibeAgentKernelAction {
  name: VibeAgentKernelActionName;
  label: string;
  lifecycle: VibeAgentActionLifecycleStatus;
  target: VibeAgentSelectedContext;
  requiresConfirmation: boolean;
  mutatesProject: boolean;
  callsProvider: boolean;
  costLabel: string;
}

export type VibeAgentExecutionCostRisk =
  | "none"
  | "project_write"
  | "external_provider"
  | "external_video_submission";

export interface VibeAgentExecutionBoundary {
  mutatesProject: boolean;
  callsProvider: boolean;
  submitsExternalTask: boolean;
  requiresConfirmation: boolean;
  costRisk: VibeAgentExecutionCostRisk;
  summary: string;
}

export interface VibeAgentExecutionResultSummary {
  lifecycle: VibeAgentActionLifecycleStatus;
  status: "blocked" | "awaiting_confirmation" | "ready_to_run" | "running" | "succeeded" | "failed" | "cancelled";
  summary: string;
  next: string;
}

export interface VibeAgentKernelTurn {
  userMessage: string;
  agentUnderstanding: string;
  projectStateSummary: string;
  projectHierarchy: string;
  projectDiagnostics: string[];
  selectedContext: VibeAgentSelectedContext;
  proposedActions: VibeAgentKernelAction[];
  executionBoundary: VibeAgentExecutionBoundary;
  executionResult: VibeAgentExecutionResultSummary;
  requiredConfirmation: boolean;
  executionCost: string;
  externalSubmissionRisk: string;
  resultSummary: string;
  nextSuggestion: string;
  relatedShots: string[];
  relatedAssets: string[];
  relatedSkills: string[];
  createdOrUpdatedFiles: string[];
  errors: string[];
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
  kernelTurn: VibeAgentKernelTurn;
  timeline: VibeAgentTimelineDocument;
  pendingConfirmationToken?: string;
}
