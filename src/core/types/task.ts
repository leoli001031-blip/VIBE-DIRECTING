import type { BaseHardLocks, Severity, GateStatus, ReferenceAuthority, AssetReadinessStatus, LocalTaskStatus, ProviderTaskStatus, ContextLevel, PreviewMode, SubagentTaskPurpose, ProjectWorkflowState, PreflightReport, PreflightScope, NeighborShotContext, ShotLayoutContext, SubagentOutputContract, SubagentInjectedKnowledgeTrace, SubagentIssue, SubagentResult, TaskRun, GateSet, AssetReadinessReport, ShotPromptPlanStatus, PromptConflictSeverity, PreflightBlocker } from "./base";
import type { ProviderSlot, RequiredMode, ProviderExecutionState, ProviderCapabilityRequirement, KeyframePairDerivation, Image2AdapterOperation } from "./provider";
import type { KnowledgeInjectedSnippet, KnowledgeInjectionRecord, KnowledgePackCategory } from "../knowledgeTypes";

export type GenerationQaStatus = "missing" | "pending" | "pass" | "fail" | "not_required" | "unknown";

export type GenerationHealthStatus =
  | "waiting"
  | "output_detected"
  | "qa_pending"
  | "formal_ready"
  | "blocked"
  | "failed";

export interface GenerationHealthReport {
  reportId: string;
  taskPlanId: string;
  jobId: string;
  shotId: string;
  expectedOutputPath: string;
  outputExists: boolean;
  manifestStatus: string;
  qaStatus: GenerationQaStatus;
  stalePrompt: boolean;
  assetReadinessStatus: AssetReadinessStatus | "missing";
  healthStatus: GenerationHealthStatus;
  blockers: string[];
  warnings: string[];
  nextAction: string;
}

export type GenerationHealthCheckerItemStatus =
  | "verified_success"
  | "qa_missing"
  | "waiting"
  | "postprocess_recoverable"
  | "worker_exit_without_expected_output"
  | "artifact_state_mismatch"
  | "blocked";

export type GenerationHealthCheckerFactStatus =
  | "pass"
  | "missing"
  | "mismatch"
  | "pending"
  | "recoverable"
  | "not_available";

export interface GenerationHealthCheckerFact {
  factId: string;
  label: string;
  status: GenerationHealthCheckerFactStatus;
  required: boolean;
  sourceRefs: string[];
  notes: string[];
}

export interface GenerationHealthCheckerItem {
  checkerItemId: string;
  taskPlanId: string;
  jobId: string;
  shotId: string;
  expectedOutputPath: string;
  status: GenerationHealthCheckerItemStatus;
  expectedOutputExists: boolean;
  tempOutputExists: boolean;
  postprocessRecoverable: boolean;
  manifestStatus: string;
  manifestMatched: boolean;
  hashVerified: boolean;
  dimensionsVerified: boolean;
  readabilityVerified: boolean;
  qaCovered: boolean;
  workerReportedSuccess: boolean;
  exitArtifactConsistent: boolean;
  artifactStatusConsistent: boolean;
  facts: GenerationHealthCheckerFact[];
  blockers: string[];
  warnings: string[];
  nextAction: string;
}

export interface GenerationHealthCheckerHardLocks extends BaseHardLocks {
  diagnosticsOnly: true;
  workerSelfReportCannotComplete: true;
  expectedOutputRequired: true;
  manifestMetadataRequired: true;
  qaCoverageRequired: true;
}

export interface GenerationHealthCheckerState {
  schemaVersion: string;
  generatedAt: string;
  items: GenerationHealthCheckerItem[];
  summary: {
    totalItems: number;
    verifiedSuccess: number;
    qaMissing: number;
    waiting: number;
    postprocessRecoverable: number;
    workerExitWithoutExpectedOutput: number;
    artifactStateMismatch: number;
    blocked: number;
    dryRunOnly: true;
    diagnosticsOnly: true;
    liveSubmitAllowed: false;
  };
  hardLocks: GenerationHealthCheckerHardLocks;
  dryRunOnly: true;
  diagnosticsOnly: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  noFileMutation: true;
  notes: string[];
}

export interface QaPromotionRequiredGates {
  expectedOutput: boolean;
  manifestMatch: boolean;
  promptFresh: boolean;
  assetReadiness: boolean;
  qaPass: boolean;
}

export type QaPromotionStatus =
  | "candidate"
  | "blocked"
  | "qa_pending"
  | "ready_for_promotion"
  | "promoted";

export interface QaPromotionReport {
  reportId: string;
  taskPlanId: string;
  jobId: string;
  shotId: string;
  candidatePath: string;
  formalPath: string;
  promotionStatus: QaPromotionStatus;
  requiredGates: QaPromotionRequiredGates;
  blockers: string[];
  warnings: string[];
  canPromoteToFormal: boolean;
}

export type GenerationHarnessStageId =
  | "shot_spec"
  | "visual_memory"
  | "spatial_memory"
  | "shot_layout"
  | "style_capsule"
  | "shot_prompt_plan"
  | "provider_capability_check"
  | "provider_request_preview"
  | "candidate_output"
  | "qa_gate";

export type GenerationHarnessStageStatus = "pass" | "warning" | "blocked" | "waiting";

export type GenerationHarnessForbiddenAction =
  | "live_submit"
  | "provider_unlock"
  | "prompt_bypass"
  | "candidate_auto_promote"
  | "semantic_postprocess_repair"
  | "text_to_video_fallback";

export type GenerationCandidateOutputStatus =
  | "missing"
  | "candidate"
  | "qa_pending"
  | "formal_ready"
  | "blocked";

export interface GenerationHarnessStage {
  stageId: GenerationHarnessStageId;
  label: string;
  status: GenerationHarnessStageStatus;
  sourceRefs: string[];
  blockers: string[];
  warnings: string[];
}

export interface GenerationHarnessProviderRequestPreview {
  requestId?: string;
  adapterId?: string;
  operation?: Image2AdapterOperation;
  outputPath: string;
  dryRunOnly: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  liveSubmitForbidden: true;
  forbiddenFallbacks: string[];
}

export interface GenerationHarnessCandidateOutput {
  status: GenerationCandidateOutputStatus;
  candidatePath: string;
  formalPath: string;
  expectedOutputPath: string;
  outputExists: boolean;
  manifestStatus: string;
  qaStatus: GenerationQaStatus;
  promotionStatus?: QaPromotionStatus;
  canPromoteToFormal: boolean;
  formalPromotionRequiresExplicitQa: true;
  autoPromoteToFormal: false;
}

export interface GenerationHarnessPostprocessPolicy {
  allowedLocalOperations: Array<"resize" | "format_convert" | "thumbnail_preview" | "metadata_probe" | "manifest_match">;
  semanticRepairAllowed: false;
  openCvSemanticRepairAllowed: false;
  localPostprocessCanChangeMeaning: false;
  localPostprocessCanPromoteFormal: false;
  notes: string[];
}

export interface GenerationHarnessJob {
  harnessJobId: string;
  jobId: string;
  shotId: string;
  taskPlanId: string;
  promptPlanId: string;
  providerId: string;
  providerSlot: ProviderSlot;
  requiredMode: RequiredMode;
  dryRunOnly: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  forbiddenActions: GenerationHarnessForbiddenAction[];
  stages: GenerationHarnessStage[];
  providerRequestPreview: GenerationHarnessProviderRequestPreview;
  candidateOutput: GenerationHarnessCandidateOutput;
  postprocessPolicy: GenerationHarnessPostprocessPolicy;
  blockers: string[];
  warnings: string[];
  nextAction: string;
}

export interface GenerationHarnessState {
  schemaVersion: string;
  generatedAt: string;
  jobs: GenerationHarnessJob[];
  summary: {
    total: number;
    blocked: number;
    waiting: number;
    qaPending: number;
    formalReady: number;
    canPromoteToFormal: number;
    liveSubmitAllowed: false;
  };
  forbiddenActions: GenerationHarnessForbiddenAction[];
  postprocessPolicy: GenerationHarnessPostprocessPolicy;
  dryRunOnly: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  notes: string[];
}

export type PromptConflictCheckerConflictCode =
  | "story_flow_stale_function"
  | "garage_front_door_conflict"
  | "fixed_camera_movement_conflict"
  | "one_shot_complex_action_chain"
  | "independent_end_frame_conflict"
  | "visual_memory_locked_identity_conflict"
  | "visual_memory_locked_outfit_conflict"
  | "visual_memory_locked_prop_conflict"
  | "visual_memory_locked_scene_conflict"
  | "visual_memory_locked_style_conflict"
  | "shot_layout_motion_conflict"
  | "compiler_conflict_report_blocker";

export interface PromptConflictCheckerConflict {
  code: PromptConflictCheckerConflictCode;
  severity: PromptConflictSeverity;
  target: string;
  structuredFact: string;
  promptEvidence: string;
  detail: string;
  requiredResolution: {
    updateShotSpec: boolean;
    updateShotLayout: boolean;
    updateShotPromptPlan: boolean;
    recompileRequired: true;
  };
  sourceRefs: string[];
}

export interface PromptConflictCheckerItem {
  checkerItemId: string;
  promptPlanId: string;
  jobId: string;
  shotId?: string;
  status: "clear" | "warning" | "blocked";
  conflictReportId?: string;
  promptPlanHash: string;
  sourceShotSpecHash: string;
  conflicts: PromptConflictCheckerConflict[];
  blockers: string[];
  warnings: string[];
  sourceRefs: string[];
  nextAction: string;
}

export interface PromptConflictCheckerHardLocks extends BaseHardLocks {
  diagnosticsOnly: true;
  agentPromiseCannotResolveConflict: true;
  requiresStructuredPlanUpdate: true;
  recompileRequiredAfterConflict: true;
  noPromptBypass: true;
}

export interface PromptConflictCheckerState {
  schemaVersion: string;
  generatedAt: string;
  items: PromptConflictCheckerItem[];
  summary: {
    totalItems: number;
    clear: number;
    warning: number;
    blocked: number;
    conflicts: number;
    recompileRequired: number;
    dryRunOnly: true;
    diagnosticsOnly: true;
    liveSubmitAllowed: false;
  };
  hardLocks: PromptConflictCheckerHardLocks;
  dryRunOnly: true;
  diagnosticsOnly: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  notes: string[];
}

export interface TaskEnvelope {
  id: string;
  schemaVersion: "0.2.0";
  inputHash?: string;
  outputHash?: string;
  purpose: "asset" | "keyframe" | "video" | "audio" | "audit" | "unknown";
  providerSlot: ProviderSlot;
  providerId: string;
  executionState: ProviderExecutionState;
  requiredMode: RequiredMode;
  providerRequirements?: ProviderCapabilityRequirement;
  storyFunction?: string;
  sourceIndexHash: string;
  promptHash?: string;
  dependencies: string[];
  contextLevel: ContextLevel;
  expectedOutputs: string[];
  hardRules: string[];
  references: ReferenceAuthority[];
  qaChecklist: string[];
  preflight: PreflightReport;
  keyframePairDerivation?: KeyframePairDerivation;
  knowledgeRouteResultId?: string;
  contextBudgetId?: string;
  injectedKnowledgePacks: KnowledgeInjectionRecord[];
  injectedKnowledgeSnippetIds: string[];
  injectedKnowledgeSnippets: KnowledgeInjectedSnippet[];
  knowledgeInputHash?: string;
  knowledgeManifestHash?: string;
  policyBinding?: string;
  routeWarnings: string[];
  sourceFactTrace?: string[];
  nonOverridableGateHashes?: Record<string, string>;
  promptPlanId?: string;
  promptPlanHash?: string;
  sourceShotSpecHash?: string;
  outputPath?: string;
  blockingReasons: string[];
}

export interface SubagentTaskEnvelope {
  id: string;
  schemaVersion: "0.2.0";
  inputHash?: string;
  outputHash?: string;
  receiptRef?: string;
  parentTaskId: string;
  purpose: SubagentTaskPurpose;
  contextLevel: ContextLevel;
  sourceIndexHash: string;
  sectionId?: string;
  shotId?: string;
  storyFunction?: string;
  userIntent?: string;
  neighborShots: NeighborShotContext[];
  lockedReferences: ReferenceAuthority[];
  forbiddenReferences: ReferenceAuthority[];
  shotLayout?: ShotLayoutContext;
  providerPolicySummary: string[];
  taskEnvelope: TaskEnvelope;
  knowledgeRouteResultId?: string;
  contextBudgetId?: string;
  injectedKnowledgePacks: KnowledgeInjectionRecord[];
  injectedKnowledgeSnippetIds: string[];
  injectedKnowledgeSnippets: KnowledgeInjectedSnippet[];
  knowledgeInputHash?: string;
  knowledgeManifestHash?: string;
  policyBinding?: string;
  nonOverridableGateHashes?: Record<string, string>;
  routeWarnings: string[];
  forbiddenKnowledgePacks: string[];
  requiredKnowledgeCategories: KnowledgePackCategory[];
  qaPackBindings: Record<string, { version: string; hash: string }>;
  allowedReadScopes: string[];
  disallowedReadScopes: string[];
  sourceIndexRequired: true;
  mustInspectNeighborShotIds: string[];
  authorityPriority: string[];
  resultMustReferencePackHashes: boolean;
  qaChecklist: string[];
  mustPreserve: string[];
  allowedDelta: string[];
  mustNotAdd: string[];
  expectedOutputContract: SubagentOutputContract;
  sourceFactTrace?: string[];
  injectedKnowledgeTrace: SubagentInjectedKnowledgeTrace;
  resultSchema: "subagent_result_v1";
  forbiddenActions: string[];
}
