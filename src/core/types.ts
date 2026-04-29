import type { KnowledgeInjectedSnippet, KnowledgeInjectionRecord, KnowledgePackCategory } from "./knowledgeTypes";

export type Severity = "blocker" | "warning" | "info";

export type GateStatus = "PASS" | "PARTIAL" | "FAIL" | "N/A" | "UNKNOWN";

export type ProviderSlot =
  | "image.generate"
  | "image.edit"
  | "image.reference_asset"
  | "video.i2v"
  | "video.t2v.experimental"
  | "video.extend"
  | "video.edit"
  | "audio.tts"
  | "audio.music"
  | "local.postprocess"
  | "local.workflow";

export type RequiredMode =
  | "text2image"
  | "image2image"
  | "frames2video"
  | "text2video"
  | "video2video"
  | "tts"
  | "music"
  | "postprocess"
  | "import_only"
  | "not_applicable";

export type ProviderExecutionState =
  | "unavailable"
  | "available"
  | "enabled"
  | "active"
  | "parked"
  | "planned";

export type RuntimeMode =
  | "browser_dev"
  | "tauri_planned"
  | "tauri_desktop"
  | "electron_fallback_planned";

export type RuntimePlatform = "darwin" | "win32" | "linux" | "unknown";

export type RuntimePathStatus = "path" | "unknown" | "planned" | "blocked";

export type ToolDetectionStatus = "available" | "missing" | "planned" | "blocked" | "unknown";

export type RuntimeToolKind =
  | "agent_cli"
  | "image_runtime"
  | "media_binary"
  | "node_runtime"
  | "package_manager"
  | "vcs"
  | "planned_provider"
  | "unknown";

export interface RuntimePathRule {
  id: string;
  platform: RuntimePlatform | "all";
  rule: string;
  example?: string;
}

export interface RuntimeProjectRootPolicy {
  strategy: "project_root_relative";
  allowedRoots: Array<"project_root" | "user_selected_import" | "app_config" | "temp_dir">;
  macPathStyle: "posix";
  windowsPathStyle: "win32";
  notes: string[];
}

export interface RuntimeToolPath {
  id: string;
  label: string;
  status: RuntimePathStatus;
  path?: string;
  source: "detected" | "configured" | "placeholder" | "planned";
  notes: string[];
}

export interface ProviderEnablementEntry {
  slot: ProviderSlot;
  state: ProviderExecutionState;
  activeProvider?: string;
  allowedProviders: string[];
  forbiddenProviders: string[];
  liveSubmitAllowed: boolean;
  notes: string[];
}

export interface ProviderEnablementState {
  strictImageProvider: "image2_only";
  slots: ProviderEnablementEntry[];
}

export interface ProviderAdapterSetting {
  id: string;
  label: string;
  providerId: string;
  slot: ProviderSlot;
  requiredMode: RequiredMode;
  state: ProviderExecutionState;
  credentialStatus: "not_required" | "not_configured" | "planned_secret_store";
  dryRunOnly: true;
  liveSubmitAllowed: false;
  providerSubmissionForbidden: true;
  supports: {
    referenceImage: boolean | "planned";
    startEndFrame: boolean | "planned";
    textToVideo: false | "experimental_parked";
    fastModel: false;
    vipChannel: false;
    bgmInVideoPrompt: false;
    cameraControl: "none" | "textual" | "planned";
  };
  forbiddenRoutes: Array<"fast_model" | "vip_channel" | "text_to_video_main_path" | "bgm_in_video_prompt" | "live_submit">;
  notes: string[];
}

export interface SidecarAllowedCommand {
  id: string;
  executable: string;
  allowedArgs: string[];
  requiredFor: string[];
  notes: string[];
}

export interface SidecarPermissionPolicy {
  arbitraryShellExecution: "blocked";
  providerLiveSubmit: "blocked";
  filesystemScope: Array<"project_root" | "user_selected_import" | "app_config" | "temp_dir">;
  allowedCommands: SidecarAllowedCommand[];
  notes: string[];
}

export interface RuntimeCredentialStorage {
  mode: "placeholder" | "planned";
  storesSecrets: false;
  plannedStores: Array<"macos_keychain" | "windows_credential_manager" | "local_encrypted_store">;
  notes: string[];
}

export interface RuntimeVoiceSource {
  id: string;
  label: string;
  status: "placeholder" | "planned" | "unavailable";
  kind: "tts_voice" | "music_source" | "voice_library";
  notes: string[];
}

export interface RuntimeConfig {
  schemaVersion: string;
  runtimeMode: RuntimeMode;
  platform: RuntimePlatform;
  projectRootPolicy: RuntimeProjectRootPolicy;
  pathRules: RuntimePathRule[];
  toolPaths: {
    codexCli: RuntimeToolPath;
    image2Runtime: RuntimeToolPath;
    ffmpeg: RuntimeToolPath;
    ffprobe: RuntimeToolPath;
    node: RuntimeToolPath;
    npm: RuntimeToolPath;
    git: RuntimeToolPath;
  };
  providerEnablement: ProviderEnablementState;
  providerAdapterSettings: ProviderAdapterSetting[];
  sidecarPermissions: SidecarPermissionPolicy;
  credentialStorage: RuntimeCredentialStorage;
  voiceSources: RuntimeVoiceSource[];
}

export interface ToolDetectionItem {
  id: string;
  label: string;
  kind: RuntimeToolKind;
  requiredFor: string[];
  status: ToolDetectionStatus;
  path?: string;
  version?: string;
  notes: string[];
}

export interface ToolDetectionReport {
  generatedAt: string;
  platform: RuntimePlatform;
  tools: ToolDetectionItem[];
}

export interface RuntimeProviderEnablementSummary {
  activeImageSlots: number;
  parkedVideoSlots: number;
  plannedAudioSlots: number;
  liveSubmitAllowed: boolean;
  notes: string[];
}

export interface ProjectRuntimeEnvironment {
  config: RuntimeConfig;
  detectionReport: ToolDetectionReport;
  providerEnablementSummary: RuntimeProviderEnablementSummary;
}

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

export interface ProviderRule {
  slot: ProviderSlot;
  activeProvider: string;
  executionState: ProviderExecutionState;
  allowedProviders: string[];
  forbiddenProviders: string[];
  allowedModes: RequiredMode[];
  forbiddenFallbacks: string[];
  concurrency: number | "adapter";
}

export interface ProviderPolicy {
  strictImageProvider: "image2_only";
  rules: ProviderRule[];
}

export type ProviderCapabilityStatus = "supported" | "unsupported" | "planned" | "parked";

export type ProviderControlSupport = "none" | "textual" | "structured" | "planned";

export type ProviderPromptKind =
  | "start_frame"
  | "end_frame"
  | "reference_asset"
  | "video_parked"
  | "unknown";

export interface ProviderCapabilitySupport {
  referenceImage: boolean;
  imageEdit: boolean;
  startEndFrame: boolean;
  bbox: ProviderCapabilityStatus;
  cameraControl: ProviderControlSupport;
  controlNet: ProviderCapabilityStatus;
  mask: ProviderCapabilityStatus;
  negativePrompt: ProviderCapabilityStatus;
}

export interface ProviderCapability {
  id: string;
  providerId: string;
  providerName: string;
  slot: ProviderSlot;
  requiredMode: RequiredMode;
  executionState: ProviderExecutionState;
  liveSubmitAllowed: false;
  inputKinds: Array<"text" | "image" | "reference_image" | "mask" | "start_frame" | "end_frame" | "video">;
  outputKind: "image" | "video" | "audio" | "metadata";
  supports: ProviderCapabilitySupport;
  maxReferenceImages: number;
  forbiddenFallbacks: string[];
  notes: string[];
}

export interface ProviderRegistry {
  schemaVersion: string;
  registryVersion: string;
  generatedAt?: string;
  strictImageProvider: "image2_only";
  defaultProviderBySlot: Partial<Record<ProviderSlot, string>>;
  capabilities: ProviderCapability[];
  notes: string[];
}

export interface ProviderCapabilityValidationResult {
  valid: boolean;
  capability?: ProviderCapability;
  blockers: string[];
  warnings: string[];
}

export type AdapterContractKind = "agent" | "worker" | "provider";

export type AdapterCredentialStatus = "not_required" | "not_configured" | "not_read";

export type AdapterContractViolationCode =
  | "live_submit_allowed"
  | "credential_storage_enabled"
  | "provider_submission_allowed"
  | "arbitrary_provider_command_allowed"
  | "unknown_provider_slot"
  | "capability_mismatch"
  | "video_provider_not_parked"
  | "image2_not_active_dry_run"
  | "worker_envelope_bypass"
  | "worker_context_packet_optional"
  | "agent_ui_binding";

export interface AdapterContractViolation {
  code: AdapterContractViolationCode;
  adapterId: string;
  severity: "blocker" | "warning";
  detail: string;
}

export interface AgentAdapterContract {
  id: string;
  kind: "agent";
  label: string;
  runtimeKind: "codex_cli" | "future_cli" | "local_agent" | "unknown";
  state: ProviderExecutionState;
  dryRunOnly: true;
  readOnly: true;
  liveSubmitAllowed: false;
  credentialStatus: AdapterCredentialStatus;
  credentialStorage: false;
  uiBinding: false;
  capabilities: {
    canSpawnSubagents: boolean;
    canUseImageRuntime: boolean;
    contextPacketRequired: boolean;
    supportsThreadHandoff: boolean;
    supportsStructuredResult: boolean;
  };
  forbiddenRoutes: Array<"ui_binding" | "live_submit" | "credential_read" | "credential_storage" | "arbitrary_shell">;
  notes: string[];
}

export interface WorkerAdapterContract {
  id: string;
  kind: "worker";
  label: string;
  state: ProviderExecutionState;
  dryRunOnly: true;
  readOnly: true;
  liveSubmitAllowed: false;
  credentialStatus: AdapterCredentialStatus;
  credentialStorage: false;
  requiredEnvelopeSchema: "subagent_task_envelope.schema.json";
  allowedPurposes: SubagentTaskPurpose[];
  readScopePolicy: "context_packet_only" | "project_readonly";
  writeScopePolicy: "declared_outputs_only" | "no_writes";
  mustReceiveContextPacket: true;
  canBypassEnvelope: false;
  forbiddenRoutes: Array<"freeform_context" | "envelope_bypass" | "live_submit" | "credential_read" | "credential_storage">;
  notes: string[];
}

export interface ProviderAdapterContract {
  id: string;
  kind: "provider";
  label: string;
  providerIds: string[];
  slot: ProviderSlot;
  requiredModes: RequiredMode[];
  state: ProviderExecutionState;
  dryRunOnly: true;
  readOnly: true;
  liveSubmitAllowed: false;
  credentialStatus: AdapterCredentialStatus;
  credentialStorage: false;
  providerSubmissionForbidden: true;
  arbitraryProviderCommandAllowed: false;
  capabilityRefs: string[];
  capabilitySummary: {
    outputKinds: Array<"image" | "video" | "audio" | "metadata">;
    supportsReferenceImage: boolean | "planned";
    supportsStartEndFrame: boolean | "planned";
    supportsTextToVideo: false | "experimental_parked";
  };
  forbiddenRoutes: Array<
    | "fast_model"
    | "vip_channel"
    | "text_to_video_main_path"
    | "bgm_in_video_prompt"
    | "live_submit"
    | "credential_read"
    | "credential_storage"
    | "arbitrary_provider_command"
  >;
  notes: string[];
}

export interface AdapterContractSummary {
  agentAdapters: string[];
  workerAdapters: string[];
  providerAdapters: string[];
  activeImageProvider: string;
  parkedVideoProviders: string[];
  liveSubmitAllowed: false;
  credentialStorage: false;
  contractViolations: AdapterContractViolation[];
}

export interface AdapterContractState {
  schemaVersion: string;
  generatedAt?: string;
  agentAdapters: AgentAdapterContract[];
  workerAdapters: WorkerAdapterContract[];
  providerAdapters: ProviderAdapterContract[];
  summary: AdapterContractSummary;
}

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
  status: "exists" | "generated" | "missing" | "planned";
  lockedStatus: "locked" | "candidate" | "needs_review" | "not_generated";
  providerId?: string;
  requiredMode?: RequiredMode;
  safeForFutureReference: boolean;
  dimensions?: string;
  issues: string[];
}

export interface ShotRecord {
  id: string;
  actId: string;
  sectionId?: string;
  title: string;
  storyFunction: string;
  startFrame?: string;
  endFrame?: string;
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
  status: ShotPromptPlanStatus;
  blockers: string[];
  conflictReportId: string;
  createdAt: string;
}

export type AssetReadinessStatus = "ready" | "draft_only" | "blocked";

export interface AssetReadinessReport {
  reportId: string;
  shotId: string;
  assetIds: string[];
  status: AssetReadinessStatus;
  formalBlocked: boolean;
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

export type ImageTaskPlanStatus = "draft" | "blocked" | "ready_for_dry_run" | "ready_for_manual_submit";

export interface ImageTaskEnvelopeSummary {
  envelopeId: string;
  providerSlot: ProviderSlot;
  providerId: string;
  requiredMode: RequiredMode;
  sourceIndexHash: string;
  promptPlanId?: string;
  promptPlanHash?: string;
  sourceShotSpecHash?: string;
  expectedOutputs: string[];
  preflightStatus: PreflightReport["status"];
  blockingReasons: string[];
}

export interface ImageTaskPlan {
  taskPlanId: string;
  jobId: string;
  shotId: string;
  promptPlanId: string;
  providerSlot: ProviderSlot;
  requiredMode: RequiredMode;
  providerId: string;
  mode: RequiredMode;
  status: ImageTaskPlanStatus;
  expectedOutputPath: string;
  inputReferenceIds: string[];
  sourcePromptPlanHash: string;
  sourceShotSpecHash: string;
  taskEnvelopeSummary?: ImageTaskEnvelopeSummary;
  blockers: string[];
  warnings: string[];
  dryRunOnly: true;
  providerSubmissionForbidden: true;
}

export type Image2AdapterOperation = "text2image" | "image2image" | "reference_asset";

export interface Image2AdapterPayload {
  sourceIntent: string[];
  mustPreserve: string[];
  mustAvoid: string[];
  references: Array<{
    referenceId: string;
    source: "prompt_plan";
  }>;
  outputPath: string;
}

export interface Image2SubmitPolicy {
  dry_run_only: true;
  manual_submit_required: true;
  live_submit_forbidden: true;
}

export interface Image2AdapterRequest {
  requestId: string;
  taskPlanId: string;
  adapterId: "image2-dry-run";
  operation: Image2AdapterOperation;
  payload: Image2AdapterPayload;
  submitPolicy: Image2SubmitPolicy;
  forbiddenFallbacks: string[];
}

export type WatcherEventType =
  | "temp_output_detected"
  | "expected_output_detected"
  | "provider_ready_derivative_detected"
  | "qa_report_detected"
  | "manifest_mismatch_detected"
  | "stall_timeout_reached"
  | "worker_exit_without_expected_output"
  | "postprocess_recoverable"
  | "formal_output_promoted"
  | "blocked";

export type WatcherEventStatus = "detected" | "waiting" | "blocked" | "recoverable" | "failed" | "promoted";

export interface WatcherEvent {
  id: string;
  eventType: WatcherEventType;
  taskId: string;
  jobId?: string;
  shotId?: string;
  artifactPath?: string;
  expectedOutputPath?: string;
  status: WatcherEventStatus;
  severity: Severity;
  createdAt: string;
  notes: string[];
}

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

export interface KeyframePairDerivation {
  shotId: string;
  startFrameId: string;
  endFrameId: string;
  startFrameHash?: string;
  endFrameHash?: string;
  endDerivationSource: "start_frame" | "independent_exception" | "unknown";
  validForI2vPair: boolean;
  exceptionReason?: string;
  allowedDelta: string[];
  mustPreserve: string[];
  mustNotAdd: string[];
}

export type VideoReadinessGateStatus = "ready" | "blocked" | "parked";

export type VideoReadinessCheckStatus = "pass" | "blocked" | "warning" | "not_applicable";

export interface VideoReadinessGateCheck {
  id: string;
  label: string;
  status: VideoReadinessCheckStatus;
  required: boolean;
  detail: string;
  target?: string;
}

export interface VideoReadinessGate {
  gateId: string;
  shotId: string;
  status: VideoReadinessGateStatus;
  canEnterQueueShell: boolean;
  canSubmitToProvider: false;
  startFramePresent: boolean;
  endFramePresent: boolean;
  keyframePairDerivation?: KeyframePairDerivation;
  allowedNaGateFields: Array<keyof Pick<GateSet, "identity" | "scene" | "prop" | "style">>;
  checks: VideoReadinessGateCheck[];
  blockers: string[];
  warnings: string[];
  dryRunOnly: true;
  providerSubmissionForbidden: true;
}

export interface VideoFrameRef {
  shotFrameId: string;
  path?: string;
  present: boolean;
  source: "shot_record" | "task_envelope" | "missing";
}

export interface VideoTaskPlan {
  schemaVersion: string;
  taskPlanId: string;
  jobId: string;
  shotId: string;
  readinessGateId: string;
  providerSlot: "video.i2v";
  requiredMode: "frames2video";
  providerId: "seedance2-provider" | "jimeng-video";
  providerExecutionState: ProviderExecutionState;
  status: "ready" | "blocked" | "parked";
  queueStatus: "pending" | "ready" | "blocked" | "parked";
  startFrameRef: VideoFrameRef;
  endFrameRef: VideoFrameRef;
  durationSeconds: number | null;
  durationPlaceholder: string;
  motionBrief: string;
  promptConstraints: string[];
  preflightFacts: {
    taskId?: string;
    status: PreflightReport["status"] | "not_available";
    blockerCount: number;
    warningCount: number;
  };
  manifestFacts: {
    status: string;
    expectedOutputs: string[];
    actualOutputs: string[];
    missingExpectedOutput: boolean;
  };
  blockers: string[];
  warnings: string[];
  dryRunOnly: true;
  providerSubmissionForbidden: true;
  fastModelForbidden: true;
  vipChannelForbidden: true;
  textToVideoForbidden: true;
  liveSubmitAllowed: false;
}

export interface VideoQueueShellSummary {
  status: "empty" | "ready" | "blocked" | "parked" | "blocked_with_ready_gates";
  counts: {
    total: number;
    pending: number;
    ready: number;
    blocked: number;
    parked: number;
  };
  concurrency: {
    placeholder: true;
    configuredLimit: number;
    activeProviderLimit: 0;
    notes: string[];
  };
  autoContinuePolicy: {
    enabled: false;
    mode: "manual_after_user_enablement";
    providerSubmissionForbidden: true;
    notes: string[];
  };
  longQueueTimeout: {
    placeholder: true;
    stallTimeoutSeconds: number;
    action: "surface_waiting_state_only";
    notes: string[];
  };
  dryRunOnly: true;
  providerSubmissionForbidden: true;
  notes: string[];
}

export interface VideoProviderPolicySummary {
  videoProvidersRemainParked: true;
  liveSubmitAllowed: false;
  userEnablementRequired: true;
  providerSubmissionForbidden: true;
  fastModelForbidden: true;
  vipChannelForbidden: true;
  textToVideoForbidden: true;
  parkedProviderIds: string[];
  notes: string[];
}

export interface VideoPlanningState {
  schemaVersion: string;
  generatedAt: string;
  readinessGates: VideoReadinessGate[];
  taskPlans: VideoTaskPlan[];
  queueShell: VideoQueueShellSummary;
  providerPolicySummary: VideoProviderPolicySummary;
  dryRunOnly: true;
  providerSubmissionForbidden: true;
  notes: string[];
}

export type VideoExecutionPreviewStatus = "blocked" | "preview_ready" | "parked";

export type VideoExecutionPreviewHardLock =
  | "no_live_submit"
  | "no_fast_model"
  | "no_vip_channel"
  | "no_text_to_video_main_path"
  | "no_bgm_in_video_prompt"
  | "start_end_frames_required"
  | "subagent_must_use_packet";

export type VideoExecutionPreviewStep =
  | "prepare_subagent_packet"
  | "inspect_readiness_gate"
  | "compile_provider_adapter_payload_placeholder"
  | "wait_for_user_enablement";

export interface VideoExecutionSelectedShotSummary {
  shotId: string;
  storyFunction?: string;
  gateStatus: GateSet;
  taskStatus: VideoTaskPlan["status"];
  queueStatus: VideoTaskPlan["queueStatus"];
}

export interface VideoExecutionExpectedOutputContract {
  format: "video_execution_preview_v1";
  requiredFields: string[];
  artifactPolicy: "no_real_prompt_file_no_provider_task";
  resultScope: "structured_packet_preview_only";
}

export interface VideoSubagentPacketPreview {
  selectedShot: VideoExecutionSelectedShotSummary;
  startFrameRef: VideoFrameRef;
  endFrameRef: VideoFrameRef;
  keyframePairDerivation?: KeyframePairDerivation;
  providerPolicySummary: VideoProviderPolicySummary;
  requiredReadScopes: string[];
  forbiddenReadScopes: string[];
  mustPreserve: string[];
  allowedDelta: string[];
  mustNotAdd: string[];
  expectedOutputContract: VideoExecutionExpectedOutputContract;
  requiredKnowledgeCategories: KnowledgePackCategory[];
}

export interface VideoExecutionPreview {
  previewId: string;
  shotId: string;
  taskPlanId: string;
  readinessGateId: string;
  status: VideoExecutionPreviewStatus;
  providerId: VideoTaskPlan["providerId"];
  providerSlot: "video.i2v";
  requiredMode: "frames2video";
  contextLevel: ContextLevel;
  subagentPurpose: "video_generation";
  instructionSummary: string;
  subagentPacketPreview: VideoSubagentPacketPreview;
  subagentTaskEnvelope: SubagentTaskEnvelope;
  executionOrderPreview: VideoExecutionPreviewStep[];
  hardLocks: VideoExecutionPreviewHardLock[];
  blockers: string[];
  warnings: string[];
  canPreviewPacket: boolean;
  canExecute: false;
  dryRunOnly: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
}

export interface VideoExecutionPreviewState {
  schemaVersion: string;
  generatedAt: string;
  previews: VideoExecutionPreview[];
  summary: {
    total: number;
    blocked: number;
    previewReady: number;
    parked: number;
    canPreviewPacket: number;
    canExecute: 0;
  };
  dryRunOnly: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  notes: string[];
}

export interface TaskRun {
  taskId: string;
  localStatus: LocalTaskStatus;
  providerStatus: ProviderTaskStatus;
  providerId: string;
  codexSessionId?: string;
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

export interface TaskEnvelope {
  id: string;
  purpose: "asset" | "keyframe" | "video" | "audit" | "unknown";
  providerSlot: ProviderSlot;
  providerId: string;
  executionState: ProviderExecutionState;
  requiredMode: RequiredMode;
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
  nonOverridableGateHashes?: Record<string, string>;
  promptPlanId?: string;
  promptPlanHash?: string;
  sourceShotSpecHash?: string;
  outputPath?: string;
  blockingReasons: string[];
}

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

export interface SubagentTaskEnvelope {
  id: string;
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
}

export interface SubagentIssue {
  severity: "P0" | "P1" | "P2";
  code: string;
  target: string;
  recommendation: string;
}

export interface SubagentResult {
  taskId: string;
  status: "pass" | "fail" | "partial";
  inspectedFiles: string[];
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

export interface AudioPlan {
  shotId: string;
  narrationText: string;
  dialogueLines: string[];
  voiceSourceId?: string | null;
  deliveryNotes: string;
  ambienceBrief: string;
  bgmProfile: string;
  musicAllowed: boolean;
  targetDurationSeconds: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  outputPath?: string | null;
  linkedTtsJobId?: string | null;
  linkedMusicJobId?: string | null;
  audioQaStatus: GateStatus;
}

export interface AudioVideoProviderPolicySummary {
  musicAllowed: false;
  noBgmForVideoProvider: true;
  ambienceSfxPlaceholderAllowed: true;
  bgmHandledBy: "audio_plan_or_post_import";
  summary: string;
}

export interface AudioVoiceSourceRegistrySummary {
  sourceCount: number;
  placeholderCount: number;
  plannedCount: number;
  unavailableCount: number;
  sources: RuntimeVoiceSource[];
  storesSecrets: false;
  changeTransactionRequired: true;
  liveSubmitAllowed: false;
  providerSubmissionForbidden: true;
  notes: string[];
}

export interface AudioProviderSlotSummary {
  slot: "audio.tts" | "audio.music";
  state: ProviderExecutionState;
  liveSubmitAllowed: false;
  activeProvider?: string;
  allowedProviders: string[];
  notes: string[];
}

export interface AudioPreviewMixPlaceholder {
  planId: string;
  generatedFromAudioPlan: true;
  eventCount: number;
  missingOutputPathCount: number;
  events: PreviewEvent[];
  notes: string[];
  dryRunOnly: true;
  providerSubmissionForbidden: true;
}

export interface AudioExportPackageSummary {
  status: "planned";
  includedInExportProfiles: Array<"asset_package" | "developer_archive">;
  plannedCategories: string[];
  plannedPaths: string[];
  blockedReasons: string[];
  notes: string[];
  dryRunOnly: true;
  providerSubmissionForbidden: true;
}

export interface AudioPlanningState {
  schemaVersion: string;
  generatedAt: string;
  shotPlans: AudioPlan[];
  voiceSourceRegistry: AudioVoiceSourceRegistrySummary;
  previewMix: AudioPreviewMixPlaceholder;
  videoProviderPolicy: AudioVideoProviderPolicySummary;
  providerSlots: AudioProviderSlotSummary[];
  exportPackageSummary: AudioExportPackageSummary;
  dryRunOnly: true;
  providerSubmissionForbidden: true;
  notes: string[];
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

export type PreviewEventType =
  | "image_hold"
  | "video_clip"
  | "narration_audio"
  | "dialogue_audio"
  | "ambience_audio"
  | "music_audio"
  | "gap"
  | "blocked_placeholder";

export interface PreviewEvent {
  id: string;
  mode: PreviewMode;
  type: PreviewEventType;
  shotId?: string;
  startSeconds: number;
  durationSeconds: number;
  mediaPath?: string;
  qaStatus: GateStatus;
  sourceTaskId?: string;
}

export type PreviewPlanStatus = "ready" | "draft_only" | "blocked";

export interface PreviewPlanSummary {
  mode: PreviewMode;
  status: PreviewPlanStatus;
  eventCount: number;
  videoClipCount: number;
  imageHoldCount: number;
  blockedPlaceholderCount: number;
  totalDurationSeconds: number;
  blockedShotIds: string[];
  blockedReasons: string[];
}

export interface PreviewPlan {
  schemaVersion: string;
  planId: string;
  mode: PreviewMode;
  status: PreviewPlanStatus;
  summary: PreviewPlanSummary;
  events: PreviewEvent[];
  blockedReasons: string[];
  dryRunOnly: true;
  providerSubmissionForbidden: true;
}

export interface FormalPreviewRequiredChecks {
  noBlockedMaterial: boolean;
  pairQaPass: boolean;
  videoQaPass: boolean;
  manifestMatched: boolean;
  promotionPassed: boolean;
  noP0Issues: boolean;
  noUnknownGate: boolean;
  videoPresent: boolean;
}

export interface FormalPreviewGate {
  status: "pass" | "blocked";
  requiredChecks: FormalPreviewRequiredChecks;
  blockedReasons: string[];
}

export interface RoughCutProxyPlan {
  status: PreviewPlanStatus;
  sourcePreviewPlanId: string;
  totalDurationSeconds: number;
  eventCount: number;
  proxyOnly: true;
  notes: string[];
}

export type ExportProfileKind = "rough_cut" | "asset_package" | "storyboard_table" | "developer_archive";

export type ExportReadinessStatus = "ready" | "draft_only" | "blocked" | "planned";

export interface ExportProfile {
  schemaVersion: string;
  profileId: string;
  kind: ExportProfileKind;
  label: string;
  readiness: ExportReadinessStatus;
  includedCategories: string[];
  includedPaths: string[];
  blockedReasons: string[];
  notes: string[];
  futureTargets?: string[];
  dryRunOnly: true;
  providerSubmissionForbidden: true;
}

export interface ExportPackagePlan {
  schemaVersion: string;
  planId: string;
  status: ExportReadinessStatus;
  profiles: ExportProfile[];
  futureTargets: string[];
  blockedReasons: string[];
  notes: string[];
  dryRunOnly: true;
  providerSubmissionForbidden: true;
}

export interface ProjectPreviewExportState {
  schemaVersion: string;
  generatedAt: string;
  draftPreview: PreviewPlan;
  formalPreview: PreviewPlan;
  formalPreviewGate: FormalPreviewGate;
  roughCutProxy: RoughCutProxyPlan;
  exportProfiles: ExportProfile[];
  exportPackagePlan: ExportPackagePlan;
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
