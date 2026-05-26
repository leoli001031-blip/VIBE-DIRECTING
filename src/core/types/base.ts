import type { RequiredMode, ProviderSlot, ProviderPromptKind, Image2ReferenceImageInput, ProviderPolicy } from "./provider";
import type { KnowledgeInjectedSnippet, KnowledgeInjectionRecord, KnowledgePackCategory } from "../knowledgeTypes";

export interface BaseHardLocks {
  dryRunOnly: true;
  liveSubmitAllowed: false;
  providerSubmissionForbidden: true;
  noFileMutation: true;
  noCredentialRead: true;
  noCredentialWrite: true;
  noShellExecution: true;
  noWorkerSpawn: true;
  credentialReadAllowedForSettings?: boolean;
}

export type Severity = "blocker" | "warning" | "info";

export type GateStatus = "PASS" | "PARTIAL" | "FAIL" | "N/A" | "UNKNOWN";

export type ReferenceRole =
  | "identity_authority"
  | "scene_layout_authority"
  | "style_authority"
  | "prop_authority"
  | "negative_case"
  | "rejected_case"
  | "temp_candidate";

export type ReferencePolarity = "positive" | "negative";

export type LocalTaskStatus =
  | "pending_local"
  | "ready_to_submit"
  | "submitted"
  | "connection_retrying"
  | "generating"
  | "temp_candidate_available"
  | "postprocess_pending"
  | "qa_pending"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "parked";

export type ProviderTaskStatus =
  | "not_submitted"
  | "querying"
  | "queueing"
  | "generating"
  | "success"
  | "fail"
  | "unknown";

export type ContextLevel = "L0" | "L1" | "L2" | "L3";

export type PreviewMode = "draft_preview" | "formal_preview";

export type UiMode = "director" | "inspector" | "diagnostics";

export type VideoControlMode =
  | "first_frame_default"
  | "first_last_endpoint"
  | "reference_driven"
  | "text_only_draft";

export type SubagentTaskPurpose =
  | "visual_generation"
  | "visual_audit"
  | "video_generation"
  | "video_audit"
  | "continuity_audit"
  | "regeneration_plan"
  | "story_audit";

export type ProjectWorkflowState =
  | "draft_intake"
  | "story_structured"
  | "production_bible_ready"
  | "visual_memory_planned"
  | "visual_memory_ready"
  | "spatial_memory_ready"
  | "shot_spec_ready"
  | "shot_layout_ready"
  | "prompt_plan_ready"
  | "keyframe_queue_ready"
  | "keyframe_generating"
  | "keyframe_qa_pending"
  | "keyframe_pair_ready"
  | "video_queue_ready"
  | "video_generating"
  | "video_qa_pending"
  | "preview_ready"
  | "export_ready"
  | "blocked";


export interface AuditIssue {
  id: string;
  severity: Severity;
  type:
    | "provider_policy"
    | "fallback"
    | "missing_output"
    | "qa_gap"
    | "queue"
    | "provenance"
    | "state_gate"
    | "preflight"
    | "reference_contamination"
    | "manifest_mismatch";
  title: string;
  detail: string;
  target?: string;
  recommendation: string;
}

export interface GateSet {
  identity: GateStatus;
  scene: GateStatus;
  pair: GateStatus;
  story: GateStatus;
  prop: GateStatus;
  style: GateStatus;
}

export interface ReferenceAuthority {
  id: string;
  path: string;
  hash?: string;
  version?: string;
  referenceRole: ReferenceRole;
  authorityScope: string[];
  polarity: ReferencePolarity;
  lockedStatus: AssetRecord["lockedStatus"] | "rejected";
  allowedUse: Array<"prompt_reference" | "future_reference" | "draft_preview" | "formal_output" | "negative_prompt">;
  canPromoteToFormal: boolean;
  canUseAsFutureReference: boolean;
  textConstraints?: string[];
  sourceRefs?: string[];
  rejectedReason?: string;
  contaminationReason?: string;
  sourceTaskId?: string;
  qaReportId?: string;
}

export interface ProjectSourceIndex {
  projectId: string;
  projectVersion: string;
  sourceIndexHash: string;
  currentProductionBibleId?: string;
  currentStoryFlowId?: string;
  currentShotSpecId?: string;
  currentVisualMemoryId?: string;
  currentSpatialMemoryId?: string;
  currentStyleCapsuleId?: string;
  currentVoiceMemoryId?: string;
  currentPromptHashes: Record<string, string>;
  lockedReferenceIds: string[];
  candidateReferenceIds: string[];
  rejectedReferenceIds: string[];
  failedReferenceIds: string[];
  confirmedDecisionIds: string[];
  staleArtifactIds: string[];
  knowledgeLibraryRoot?: string;
  activeKnowledgePackIds?: string[];
  disabledKnowledgePackIds?: string[];
  knowledgeManifestHash?: string;
  packVersionBindings?: Record<string, { version: string; hash: string }>;
  knowledgeRouteHistory?: Array<{
    routeId: string;
    taskId?: string;
    packIds: string[];
    inputHash: string;
    createdAt: string;
  }>;
  updatedAt: string;
}

export interface AssetRecord {
  id: string;
  type: "character" | "scene" | "prop" | "style" | "unknown";
  name: string;
  path: string;
  status: "exists" | "generated" | "missing" | "planned" | "rejected";
  lockedStatus: "locked" | "candidate" | "needs_review" | "not_generated";
  providerId?: string;
  sourceReceiptId?: string;
  sourceRunId?: string;
  outputHash?: string;
  promptText?: string;
  promptPath?: string;
  promptHash?: string;
  usedByShotIds?: string[];
  requiredMode?: RequiredMode;
  safeForFutureReference: boolean;
  dimensions?: string;
  textConstraints?: string[];
  sourceRefs?: string[];
  roleBinding?: { role: string; useFor: string[]; ignoreFor: string[] };
  issues: string[];
}

// ShotRecord.status shares "blocked" with GenerationJob.status and "failed" with
// TaskRunLedgerQaReview.status, but the enums describe different domain lifecycles
// (shot generation pipeline vs. job execution vs. QA review). Potential future
// unification could extract a shared "blocked" / "failed" base status type.
export interface ShotRecord {
  id: string;
  actId: string;
  sectionId?: string;
  title: string;
  storyFunction: string;
  narrationText?: string;
  dialogueLines?: string[];
  subtitle?: string;
  sound?: string;
  audioUsage?: string;
  videoControlMode?: VideoControlMode;
  /** @deprecated use keyframe derivation instead */ startFrame?: string;
  /** @deprecated use keyframe derivation instead */ endFrame?: string;
  videoPath?: string;
  status:
    | "queued"
    | "assets_ready"
    | "keyframe_pair_ready"
    | "video_missing"
    | "blocked"
    | "ready";
  gates: GateSet;
  issues: string[];
  camera?: string;
  executionMode?: string;
  rhythmProfile?: string;
  splitPolicy?: string;
  actionBeats?: string[];
  primaryAction?: string;
  actionTrigger?: string;
  microReaction?: string;
  seedanceDirection?: string;
  directorFeedbackDirectives?: string[];
  characterGuidance?: string[];
  sceneGuidance?: string[];
  propGuidance?: string[];
  durationSeconds?: number;
  sourceRefs?: string[];
}

export interface GenerationJob {
  id: string;
  slot: ProviderSlot;
  requiredMode: RequiredMode;
  providerId: string;
  status: "planned" | "parked" | "submitted" | "querying" | "success" | "failed" | "blocked";
  outputPath?: string;
  promptPath?: string;
  references: string[];
  submitId?: string;
  providerTaskId?: string;
  issues: string[];
}

export type ShotPromptPlanStatus = "draft" | "blocked" | "ready_for_envelope";


// Intentionally identical to Severity. Could be unified in a future refactor to reduce type duplication.
export type PromptConflictSeverity = "blocker" | "warning" | "info";

export interface PromptConflict {
  code: string;
  severity: PromptConflictSeverity;
  target?: string;
  detail: string;
}

export interface PromptConflictReport {
  reportId: string;
  promptPlanId: string;
  jobId: string;
  shotId?: string;
  status: "clear" | "warning" | "blocked";
  conflicts: PromptConflict[];
  checkedAt: string;
}

export interface ShotPromptPlan {
  promptPlanId: string;
  promptPlanHash: string;
  sourceShotSpecHash: string;
  jobId: string;
  shotId?: string;
  providerId: string;
  providerSlot: ProviderSlot;
  requiredMode: RequiredMode;
  promptKind: ProviderPromptKind;
  sourceIntent: string[];
  naturalLanguagePolicy: "source_intent_only";
  mustPreserve: string[];
  mustAvoid: string[];
  referenceIds: string[];
  styleDirectives: string[];
  adapterWarnings: string[];
  derivesFromStartFrame?: boolean;
  sourceStartFrameId?: string;
  referenceImageInputs: Image2ReferenceImageInput[];
  status: ShotPromptPlanStatus;
  blockers: string[];
  conflictReportId: string;
  createdAt: string;
}

export type AssetReadinessStatus = "ready" | "draft_only" | "blocked";

export type AssetReadinessGateId =
  | "identity_gate"
  | "scene_gate"
  | "pair_gate"
  | "story_gate"
  | "prop_gate"
  | "style_gate";

export interface AssetReadinessGate {
  gateId: AssetReadinessGateId;
  status: "pass" | "warning" | "blocked";
  requiredForFormal: boolean;
  detail: string;
  sourceRefs: string[];
  blockers: string[];
  warnings: string[];
}

export interface AssetReadinessReport {
  reportId: string;
  shotId: string;
  assetIds: string[];
  status: AssetReadinessStatus;
  formalBlocked: boolean;
  gates: AssetReadinessGate[];
  blockers: string[];
  warnings: string[];
  safeReferenceIds: string[];
  unsafeReferenceIds: string[];
  lockedReferenceIds: string[];
  candidateReferenceIds: string[];
  missingReferenceIds: string[];
  rejectedReferenceIds: string[];
  tempReferenceIds: string[];
  failedReferenceIds: string[];
  checkedAt: string;
}

export interface TaskRun {
  taskId: string;
  localStatus: LocalTaskStatus;
  providerStatus: ProviderTaskStatus;
  providerId: string;
  sessionId?: string;
  /** @deprecated Use sessionId */
  agentSessionId?: string;
  submitId?: string;
  providerTaskId?: string;
  retryCount: number;
  backoffUntil?: string;
  stallTimeoutSeconds: number;
  tempDirs: string[];
  expectedOutputs: string[];
  actualOutputs: string[];
  lastEventAt?: string;
}

export interface PreflightBlocker {
  code: string;
  messageForUser: string;
  technicalDetail: string;
  target?: string;
}

export interface PreflightReport {
  taskId: string;
  preflightScope: PreflightScope;
  status: "pass" | "blocked" | "warning";
  blockers: PreflightBlocker[];
  warnings: PreflightBlocker[];
  checkedAt: string;
}

export type PreflightScope = "formal_execution" | "dev_preview" | "import_only";

export interface NeighborShotContext {
  shotId: string;
  position: "previous" | "next" | "same_section" | "anchor";
  storyFunction: string;
  summary: string;
  approvedFramePath?: string;
  continuityNotes: string[];
}

export interface ShotLayoutContext {
  shotId: string;
  sectionId?: string;
  sceneId?: string;
  viewId?: string;
  camera?: string;
  subjectPosition?: string;
  worldPositions: Record<string, string>;
  anchors: string[];
  movement?: string;
  mustPreserve: string[];
  allowedDelta: string[];
  mustNotAdd: string[];
}

export interface SubagentOutputContract {
  format: "subagent_result_v1";
  requiredFields: Array<keyof SubagentResult>;
  severityLevels: Array<SubagentIssue["severity"]>;
  gateFields: Array<keyof GateSet>;
}

export interface SubagentInjectedKnowledgeTrace {
  status: "present" | "missing";
  packIds: string[];
  snippetIds: string[];
  snippetCount: number;
  qaPackBindingIds: string[];
  warnings: string[];
}


export interface SubagentIssue {
  severity: "P0" | "P1" | "P2";
  code: string;
  target: string;
  recommendation: string;
}

export interface SubagentResultTest {
  command: string;
  status: "pass" | "fail" | "not_run";
  notes?: string;
}

export interface SubagentResultTouched {
  provider: boolean;
  credential: boolean;
  promotion: boolean;
  fileMutation: boolean;
}

export interface SubagentResult {
  taskId: string;
  status: "pass" | "fail" | "partial";
  inspectedFiles: string[];
  changedFiles: string[];
  tests: SubagentResultTest[];
  artifactPaths: string[];
  residualRisks: string[];
  touched: SubagentResultTouched;
  gates: GateSet;
  overallVisualVerdict: GateStatus;
  styleQa: GateStatus;
  motionQa: GateStatus;
  continuityQa: GateStatus;
  referenceUseDecision: "approve_formal" | "draft_only" | "reject_future_reference" | "needs_regenerate";
  issues: SubagentIssue[];
  requiredFixes: string[];
  approvedFor: string[];
  rejectedFor: string[];
  summaryForMainAgent: string;
}

export type DirectorIntentType = "story" | "shot" | "asset" | "style" | "voice" | "export" | "unknown";

export type StoryChangeImpactScope = "project" | "section" | "shot" | "asset" | "voice" | "export";

export type StoryChangeOperation =
  | "insert_shot"
  | "delete_shot"
  | "move_shot"
  | "update_story"
  | "update_shot"
  | "update_character"
  | "update_scene"
  | "update_style"
  | "update_dialogue"
  | "update_narration"
  | "update_voice"
  | "lock_asset"
  | "unlock_asset"
  | "export_change"
  | "unknown";

export type StoryChangeStatus = "dry_run" | "pending_confirmation" | "confirmed" | "rejected" | "applied" | "cancelled";

export type StoryChangeConfirmationState = "not_required" | "required" | "pending" | "confirmed" | "rejected";

export type ReflowArtifactType =
  | "productionBible"
  | "storyFlow"
  | "shotSpec"
  | "shotLayout"
  | "promptPlan"
  | "keyframe"
  | "video"
  | "audio"
  | "preview"
  | "visualMemory"
  | "spatialMemory"
  | "voiceMemory"
  | "styleCapsule"
  | "asset"
  | "taskRun"
  | "qaReport";

export interface DirectorIntentResult {
  schemaVersion: string;
  id: string;
  userIntent: string;
  normalizedIntent: string;
  intentType: DirectorIntentType;
  operation: StoryChangeOperation;
  impactScope: StoryChangeImpactScope;
  targetIds: string[];
  confidence: number;
  requiresUserConfirmation: boolean;
  confirmationReasons: string[];
  riskFlags: string[];
  detectedKeywords: string[];
  createdAt: string;
}

export interface ArtifactInvalidation {
  schemaVersion: string;
  artifactId: string;
  artifactType: ReflowArtifactType;
  targetId?: string;
  staleReason: string;
  staleDependencies: string[];
  requiresRegeneration: boolean;
  severity: "blocking" | "stale" | "review";
}

export interface ProductionBiblePatch {
  schemaVersion: string;
  id: string;
  transactionId: string;
  status: "dry_run" | "pending_confirmation" | "approved" | "rejected" | "applied";
  patchType: "character" | "scene" | "style" | "voice" | "story_rules" | "unknown";
  targetIds: string[];
  proposedChanges: Array<{
    path: string;
    operation: "add" | "replace" | "remove" | "move" | "review";
    valueSummary: string;
  }>;
  requiresUserConfirmation: boolean;
  warnings: string[];
  createdAt: string;
}

export interface AssetLockScope {
  schemaVersion: string;
  id: string;
  transactionId?: string;
  lockLevel: "preserve" | "can_reuse" | "invalidate" | "review";
  characterIds: string[];
  sceneIds: string[];
  propIds: string[];
  styleIds: string[];
  voiceIds: string[];
  shotIds: string[];
  mustPreserve: string[];
  canInvalidate: string[];
  notes: string[];
}

export interface VoiceChangeTransaction {
  schemaVersion: string;
  id: string;
  userIntent: string;
  changeType: "dialogue" | "narration" | "voice_source" | "tone" | "timing" | "unknown";
  targetVoiceIds: string[];
  targetCharacterIds: string[];
  targetShotIds: string[];
  status: StoryChangeStatus;
  requiresUserConfirmation: boolean;
  invalidatedArtifactIds: string[];
  mustPreserve: string[];
  mustNotAdd: string[];
  createdAt: string;
}

export interface StoryChangeTransaction {
  schemaVersion: string;
  id: string;
  userIntent: string;
  intentType: DirectorIntentType;
  operation: StoryChangeOperation;
  impactScope: StoryChangeImpactScope;
  targetIds: string[];
  mustPreserve: string[];
  mustNotAdd: string[];
  invalidatedArtifactIds: string[];
  requiresUserConfirmation: boolean;
  confirmationState: StoryChangeConfirmationState;
  confirmationReasons: string[];
  status: StoryChangeStatus;
  dryRunOnly: boolean;
  providerSubmissionForbidden: true;
  productionBiblePatch?: ProductionBiblePatch;
  assetLockScope?: AssetLockScope;
  voiceChangeTransaction?: VoiceChangeTransaction;
  intentResult?: DirectorIntentResult;
  createdAt: string;
}

export interface ReflowImpactReport {
  schemaVersion: string;
  id: string;
  transactionId: string;
  status: "dry_run" | "pending_confirmation" | "ready_for_confirmation" | "blocked";
  summary: string;
  affectedScopes: StoryChangeImpactScope[];
  affectedSectionIds: string[];
  affectedShotIds: string[];
  affectedAssetIds: string[];
  invalidations: ArtifactInvalidation[];
  staleArtifactIds: string[];
  requiresUserConfirmation: boolean;
  confirmationReasons: string[];
  regenerationPlan: Array<{
    step: "rebuild_story_flow" | "rebuild_shot_spec" | "rebuild_prompt_plan" | "regenerate_keyframes" | "regenerate_video" | "regenerate_audio" | "rebuild_preview" | "review_assets";
    targetIds: string[];
    reason: string;
  }>;
  forbiddenActions: Array<"provider_submit" | "prompt_patch_from_natural_language" | "direct_project_mutation">;
  createdAt: string;
}

export interface WorkflowStage {
  id: string;
  label: string;
  status: "done" | "active" | "blocked" | "pending";
  detail: string;
}

export interface ProjectMetrics {
  expectedAssets: number;
  existingAssets: number;
  expectedKeyframes: number;
  existingKeyframes: number;
  expectedVideos: number;
  existingVideos: number;
  providerEvents: number;
  dreaminaImageEvents: number;
  forbiddenFallbackEvents: number;
}

export interface ProjectAudit {
  importedAt: string;
  projectTitle: string;
  projectRoot: string;
  sourceTask: string;
  state: string;
  sourceIndex?: ProjectSourceIndex;
  fileSnapshot?: string[];
  schemaSummary?: {
    auditSchemaVersion?: string;
    coreStateVersion?: string;
    notes?: string[];
  };
  metrics: ProjectMetrics;
  providerPolicy: ProviderPolicy;
  workflow: WorkflowStage[];
  assets: AssetRecord[];
  shots: ShotRecord[];
  jobs: GenerationJob[];
  issues: AuditIssue[];
  contactSheets: {
    assets?: string;
    keyframes?: string;
  };
}
