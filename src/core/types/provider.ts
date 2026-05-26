import type { BaseHardLocks, Severity, GateStatus, ReferenceRole, ReferencePolarity, AssetRecord, AssetReadinessStatus, LocalTaskStatus, ProviderTaskStatus, ContextLevel, PreviewMode, SubagentTaskPurpose, ProjectWorkflowState, PreflightReport, PreflightScope, NeighborShotContext, ShotLayoutContext, SubagentOutputContract, SubagentInjectedKnowledgeTrace, SubagentIssue, SubagentResult, DirectorIntentType, StoryChangeImpactScope, StoryChangeOperation, StoryChangeStatus, StoryChangeConfirmationState, ReflowArtifactType, DirectorIntentResult, ArtifactInvalidation, ProductionBiblePatch, AssetLockScope, VoiceChangeTransaction, StoryChangeTransaction, ReflowImpactReport, TaskRun, GateSet, AuditIssue, ProjectSourceIndex, ShotRecord, GenerationJob, ShotPromptPlanStatus, PromptConflictSeverity, PromptConflict, PromptConflictReport, ShotPromptPlan, AssetReadinessGateId, AssetReadinessGate, AssetReadinessReport, WorkflowStage, ProjectMetrics, ProjectAudit, SubagentResultTest, SubagentResultTouched, PreflightBlocker } from "./base";
import type { KnowledgeInjectedSnippet, KnowledgeInjectionRecord, KnowledgePackCategory } from "../knowledgeTypes";
import type { RuntimeVoiceSource } from "./runtime";
import type { SubagentTaskEnvelope } from "./task";

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

export interface ProviderEnablementEntry {
  slot: ProviderSlot;
  state: ProviderExecutionState;
  activeProvider?: string;
  allowedProviders: string[];
  forbiddenProviders: string[];
  liveSubmitAllowed: boolean;
  notes: string[];
}

export type ProviderImagePolicy = "registry_default" | "image2_only";

export interface ProviderEnablementState {
  strictImageProvider: ProviderImagePolicy;
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
  strictImageProvider: ProviderImagePolicy;
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
  referenceImageInputRoles?: Image2ReferenceImageInputRole[];
  forbiddenFallbacks: string[];
  notes: string[];
}

export interface ProviderCapabilityRequirement {
  slot: ProviderSlot;
  requiredMode: RequiredMode;
  inputKinds: ProviderCapability["inputKinds"];
  outputKind: ProviderCapability["outputKind"];
  supports?: Partial<ProviderCapabilitySupport>;
  maxReferenceImages?: number;
  forbiddenFallbacks?: string[];
  executionStates?: ProviderExecutionState[];
  notes: string[];
}

export interface ProviderSelectionPolicy {
  strategy: "registry_default";
  defaultsAreConfiguration: true;
  taskPacketsCarryRequirements: true;
  notes: string[];
}

export interface ProviderRegistry {
  schemaVersion: string;
  registryVersion: string;
  generatedAt?: string;
  strictImageProvider?: ProviderImagePolicy;
  selectionPolicy?: ProviderSelectionPolicy;
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
  runtimeKind: "agent_cli" | "agent_app_server" | "agent_loop" | "future_cli" | "local_agent" | "unknown";
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
    referenceImageInputRoles?: Image2ReferenceImageInputRole[];
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
  referenceImageInputs: Image2ReferenceImageInput[];
  sourcePromptPlanHash: string;
  sourceShotSpecHash: string;
  taskEnvelopeSummary?: ImageTaskEnvelopeSummary;
  blockers: string[];
  warnings: string[];
  dryRunOnly: true;
  providerSubmissionForbidden: true;
}

export type Image2AdapterOperation = "text2image" | "image2image" | "reference_asset";

export type Image2ReferenceImageInputRole =
  | "source_start_frame"
  | "locked_character_reference"
  | "locked_scene_reference"
  | "locked_style_reference"
  | "locked_prop_reference"
  | "mask"
  | "other";

export interface Image2ReferenceImageInput {
  inputId: string;
  role: Image2ReferenceImageInputRole;
  path: string;
  source: "approved_start_frame" | "locked_asset" | "candidate_asset" | "task_envelope" | "manual_user_input";
  required: true;
  mustUseAsVisualInput: true;
  status: "available" | "planned" | "missing" | "blocked";
  notes: string[];
}

export interface Image2AdapterPayload {
  sourceIntent: string[];
  mustPreserve: string[];
  mustAvoid: string[];
  references: Array<{
    referenceId: string;
    source: "prompt_plan";
  }>;
  referenceImageInputs: Image2ReferenceImageInput[];
  sourceStartFrameId?: string;
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
  adapterId: string;
  operation: Image2AdapterOperation;
  frameRole?: ProviderPromptKind;
  payload: Image2AdapterPayload;
  submitPolicy: Image2SubmitPolicy;
  forbiddenFallbacks: string[];
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

export type MotionType =
  | "static_hold"
  | "micro_expression"
  | "pose_change_in_place"
  | "locomotion"
  | "object_interaction"
  | "camera_reframe"
  | "camera_move"
  | "reveal_or_occlusion"
  | "transform_or_state_change";

export type MotionEndpointContractStatus = "pass" | "blocked" | "warning";

export type MotionEndpointFrameRole = "start" | "end" | "both";

export type MotionEndpointRegionKind =
  | "subject"
  | "face"
  | "hands"
  | "feet"
  | "prop"
  | "background"
  | "camera"
  | "occluder"
  | "unknown";

export interface MotionPoseRequirement {
  required: boolean;
  description: string;
  mustPreserve: string[];
  reservedForEndPose: boolean;
}

export interface MotionBodyMechanics {
  required: boolean;
  description: string;
  centerOfMass: string;
  footwork: string[];
  contactPoints: string[];
  timing: string;
}

export interface MotionEndpointRegion {
  id: string;
  label: string;
  kind: MotionEndpointRegionKind;
  frameRole: MotionEndpointFrameRole;
  description: string;
  constraints: string[];
}

export interface MotionBboxAnchor {
  id: string;
  target: string;
  frameRole: MotionEndpointFrameRole;
  bbox?: [number, number, number, number];
  notes: string[];
}

export interface MotionQaThresholds {
  identityPreservation: "strict";
  scenePreservation: "strict";
  maxUnexplainedBboxShift: "none" | "small" | "medium";
  requireDerivedEndFrame: boolean;
  requireBodyMechanicsEvidence: boolean;
}

export interface MotionGateInputs {
  shotText: string;
  motionEvidence: string[];
  keyframePairPresent: boolean;
  keyframePairDerivesFromStart: boolean;
  bboxOnlyMotionForbidden: boolean;
}

export interface MotionEndpointContract {
  schemaVersion: string;
  generatedAt: string;
  shotId: string;
  motionType: MotionType;
  whetherEndFrameRequired: boolean;
  endFrameRequiredReason: string;
  startPoseRequirement: MotionPoseRequirement;
  endPoseRequirement: MotionPoseRequirement;
  bodyMechanics: MotionBodyMechanics;
  editableRegions: MotionEndpointRegion[];
  protectedRegions: MotionEndpointRegion[];
  bboxAnchors: MotionBboxAnchor[];
  qaThresholds: MotionQaThresholds;
  gateInputs: MotionGateInputs;
  keyframePairDerivation?: KeyframePairDerivation;
  status: MotionEndpointContractStatus;
  blockers: string[];
  warnings: string[];
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
  providerId: string;
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
  | "first_frame_video_default"
  | "endpoint_end_frame_optional"
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

export interface MusicReferenceSummary {
  id: string;
  label: string;
  status: "candidate" | "planned" | "missing";
  referenceRole: "music_reference";
  usage: "rhythm_and_final_mix";
  usedFor: Array<"rhythm_planning" | "final_export_mix">;
  forbiddenFor: Array<"video_prompt" | "video_provider_payload">;
  analysisPath?: string;
  finalMixPath?: string;
  noRawPathStored: boolean;
  sourceRefs: string[];
}

export type TtsProviderRoute = "local_index_tts" | "local_qwen3_tts_clone" | "cloud_tts";

export interface TtsProviderCandidate {
  providerId: "local-index-tts" | "local-qwen3-tts-clone" | "cloud-tts";
  label: string;
  route: TtsProviderRoute;
  executionSurface: "local_cli" | "cloud_api";
  state: "planned";
  commandEnvKey?: string;
  modelDirEnvKey?: string;
  speakerWavEnvKey?: string;
  baseUrlEnvKey?: string;
  apiKeyEnvKey?: string;
  modelEnvKey: string;
  voiceIdEnvKey: string;
  outputFormat: "wav" | "mp3";
  maxConcurrentJobs: number;
  maxAutoRetries: number;
  timeoutSeconds: number;
  storesSecrets: false;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  notes: string[];
}

export interface TtsSubmitPlanDraft {
  planId: string;
  shotId: string;
  providerSlot: "audio.tts";
  requiredMode: "tts";
  routePreference: TtsProviderRoute[];
  voiceSourceId?: string | null;
  textHash: string;
  textPreview: string;
  expectedOutputPath: string;
  permissionRequired: true;
  canSubmitProvider: false;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  blockers: string[];
  notes: string[];
}

export interface TtsProviderPlanningState {
  schemaVersion: string;
  generatedAt: string;
  preferredRoute: TtsProviderRoute;
  providers: TtsProviderCandidate[];
  submitPlanDrafts: TtsSubmitPlanDraft[];
  summary: {
    localReadyToConfigure: boolean;
    cloudReadyToConfigure: boolean;
    submitDraftCount: number;
    maxLocalConcurrency: number;
    maxCloudConcurrency: number;
    storesSecrets: false;
    providerSubmissionForbidden: true;
    liveSubmitAllowed: false;
  };
  hardLocks: {
    providerSubmissionForbidden: true;
    liveSubmitAllowed: false;
    noSecretStorage: true;
    permissionReceiptRequired: true;
    projectRelativeOutputOnly: true;
  };
  notes: string[];
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

export interface AudioReferencePolicySummary {
  voiceReferenceRole: "voice_reference";
  voiceReferenceBinding: "character_or_narrator";
  musicReferenceRole: "music_reference";
  musicReferenceBinding: "rhythm_and_final_mix";
  musicNeverEntersVideoPrompt: true;
  videoProviderPayloadIncludesMusic: false;
  defaultTtsRoute: "local_qwen3_tts_clone";
  reviewActions: Array<"listen" | "review" | "replace">;
  notes: string[];
}

export interface AudioPlanningState {
  schemaVersion: string;
  generatedAt: string;
  shotPlans: AudioPlan[];
  musicReferences?: MusicReferenceSummary[];
  postMixPolicy?: {
    musicReferenceCount: number;
    finalMixMusicAllowed: boolean;
    videoProviderBgmAllowed: false;
    notes: string[];
  };
  referencePolicy?: AudioReferencePolicySummary;
  voiceSourceRegistry: AudioVoiceSourceRegistrySummary;
  previewMix: AudioPreviewMixPlaceholder;
  videoProviderPolicy: AudioVideoProviderPolicySummary;
  providerSlots: AudioProviderSlotSummary[];
  ttsProviderPlanning?: TtsProviderPlanningState;
  exportPackageSummary: AudioExportPackageSummary;
  dryRunOnly: true;
  providerSubmissionForbidden: true;
  notes: string[];
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

export type DemoPackageMediaStatus = "video" | "image" | "missing";

export interface DemoPackageStoryboardRow {
  shotId: string;
  actId: string;
  sectionId?: string;
  title: string;
  storyFunction: string;
  shotStatus: ShotRecord["status"];
  previewEventId?: string;
  previewEventType?: PreviewEventType;
  durationSeconds: number;
  mediaPath?: string;
  mediaStatus: DemoPackageMediaStatus;
  gateSummary: GateSet;
}

export interface DemoPackageKeyframeSelection {
  shotId: string;
  startFrame?: string;
  endFrame?: string;
  selected: boolean;
  reason: "selected_shot" | "available_keyframe_pair";
}

export interface DemoPackagePromptRequestPreview {
  id: string;
  shotId?: string;
  jobId?: string;
  taskId?: string;
  slot?: ProviderSlot;
  providerId?: string;
  requiredMode?: RequiredMode;
  promptPath?: string;
  expectedOutputs: string[];
  actualOutputs: string[];
  submitId?: string;
  providerTaskId?: string;
  localStatus?: LocalTaskStatus;
  providerStatus?: ProviderTaskStatus;
  tempDirs?: string[];
  receiptPaths?: string[];
  queueLogPaths?: string[];
  resumeCommand?: string;
  referenceEvidence?: DemoPackageReferenceEvidence;
  lastEventAt?: string;
  dryRunOnly: true;
  providerSubmissionForbidden: true;
}

export type DemoPackageVideoReviewStatus = "needs_review" | "approved" | "missing";

export interface DemoPackageReferenceEvidence {
  referencePolicyVersion?: string;
  storyboardReferencePath?: string;
  sceneReferencePath?: string;
  characterReferencePaths?: string[];
  propReferencePaths?: string[];
  dialogueAudioPath?: string;
  seedanceInputRoleOrder?: string[];
  userFacingSummary?: string;
  directorStrategy?: DemoPackageDirectorStrategyEvidence;
}

export interface DemoPackageDirectorStrategyEvidence {
  rhythmProfile?: string;
  rhythmLabel?: string;
  rhythmReason?: string;
  splitPolicy?: string;
  splitLabel?: string;
  actionSummary?: string;
  modificationSummary?: string[];
  storyboardPromptPlanSummary?: string;
  videoPromptPlanSummary?: string;
}

export interface DemoPackageVideoResult {
  id: string;
  shotId?: string;
  sourceTaskId?: string;
  taskId?: string;
  submitId?: string;
  providerTaskId?: string;
  reviewStatus: DemoPackageVideoReviewStatus;
  videoPath?: string;
  firstFrameProtectedVideoPath?: string;
  outputHash?: string;
  receiptPaths: string[];
  queueLogPaths: string[];
  resumeCommand?: string;
  queueAttempts?: number;
  durationSeconds?: number;
  referenceEvidence?: DemoPackageReferenceEvidence;
  autoPromoted: false;
  notes: string[];
}

export interface DemoPackageQaReportPreview {
  id: string;
  kind: "generation_health" | "qa_promotion";
  shotId: string;
  status: string;
  blockers: string[];
  warnings: string[];
}

export interface DemoPackageProjectFactsSnapshot {
  generatedAt: string;
  projectRoot?: string;
  shotCount: number;
  selectedShotId?: string;
  shotIds: string[];
  storySectionIds: string[];
}

export interface DemoPackageFacts {
  storyboardRows: DemoPackageStoryboardRow[];
  selectedKeyframes: DemoPackageKeyframeSelection[];
  promptRequestPreviews: DemoPackagePromptRequestPreview[];
  videoResults?: DemoPackageVideoResult[];
  qaReports: DemoPackageQaReportPreview[];
  projectFactsSnapshot: DemoPackageProjectFactsSnapshot;
  naturalLanguagePlanSummary?: unknown;
  oneShotResultSummary?: unknown;
  roughCutProxyPlanIncluded: boolean;
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
  demoPackageFacts?: DemoPackageFacts;
}
