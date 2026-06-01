import type { BaseHardLocks, Severity, GateStatus, SubagentTaskPurpose, ProjectSourceIndex, AssetReadinessStatus, GateSet, ReferenceAuthority } from "./base";
import type { ProviderSlot, RequiredMode, ProviderExecutionState, ProviderEnablementState, ProviderAdapterSetting, Image2ReferenceImageInputRole, ProviderCapability, ProviderPolicy } from "./provider";
import type { GenerationHealthStatus, GenerationQaStatus, QaPromotionStatus } from "./task";

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
  mode: "placeholder" | "planned" | "local_file";
  storesSecrets: false;
  plannedStores: Array<"macos_keychain" | "windows_credential_manager" | "local_encrypted_store">;
  notes: string[];
}

export interface RuntimeProviderConfig {
  providerId: string;
  label: string;
  providerKind?: "agent" | "image" | "web_search" | "tts_local" | "tts_cloud";
  baseUrl: string;
  imageModel?: string;
  chatModel?: string;
  ttsModel?: string;
  endpointMode?: "responses_api" | "search_api" | "local_cli" | "cloud_api";
  localCommand?: {
    commandEnvKey: string;
    modelDirEnvKey: string;
    speakerWavEnvKey: string;
    expectedOutputFormat: "wav";
    notes: string[];
  };
  cloudEndpoint?: {
    baseUrlEnvKey: string;
    modelEnvKey: string;
    voiceIdEnvKey: string;
    expectedOutputFormat: "wav" | "mp3";
    notes: string[];
  };
  concurrencyPolicy?: {
    imageGenerateMaxConcurrency?: number;
    imageGenerateRetryConcurrency?: number;
    imageGenerateMaxAutoRetries?: number;
    imageEditMaxConcurrency: number;
    imageEditMaxAutoRetries: number;
    referenceEditDefault: true;
    notes: string[];
  };
  ttsConcurrencyPolicy?: {
    maxConcurrentJobs: number;
    maxAutoRetries: number;
    timeoutSeconds: number;
    notes: string[];
  };
  source: "default" | "environment" | "local_settings";
  credential: {
    envKey: string;
    keyStatus: "configured" | "not_configured" | "not_required";
    source: "environment" | "local_settings" | "none";
    secretDisplayed: false;
  };
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
    agentCli: RuntimeToolPath;
    image2Runtime: RuntimeToolPath;
    ffmpeg: RuntimeToolPath;
    ffprobe: RuntimeToolPath;
    node: RuntimeToolPath;
    npm: RuntimeToolPath;
    git: RuntimeToolPath;
  };
  providerEnablement: ProviderEnablementState;
  providerAdapterSettings: ProviderAdapterSetting[];
  providerConfigs: RuntimeProviderConfig[];
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

export type ToolRuntimeHarnessCategory =
  | "agent_cli"
  | "node_runtime"
  | "rust_runtime_or_app_shell"
  | "media_binary"
  | "image_tool"
  | "python_optional"
  | "provider_cli_optional"
  | "vcs_optional"
  | "package_manager";

export type ToolRuntimeHarnessStatus = "ready" | "missing" | "planned" | "blocked" | "unknown";

export type ToolRuntimeHarnessPathStatus = "path" | "missing" | "unknown" | "planned" | "blocked";

export type ToolRuntimeHarnessExecutionMode = "diagnostic_only";

export type ToolRuntimeHarnessPathStyle = "posix" | "win32" | "project-root-relative";

export type ToolRuntimeHarnessPlatformSupportStatus = "supported" | "planned" | "unknown" | "unsupported";

export type ToolRuntimeHarnessSourceLayer =
  | "runtime.config"
  | "runtime.detectionReport"
  | "runtime.providerEnablementSummary"
  | "adapterContracts"
  | "generationHarness"
  | "filesystemWatcherHarness"
  | "checkpointResumeHarness"
  | "qaHarness";

export interface ToolRuntimeHarnessHardLocks extends BaseHardLocks {
  diagnosticsOnly: true;
  noInstall: true;
  noSystemSettingsMutation: true;
  arbitraryShellExecutionBlocked: true;
  sidecarDaemonDisabled: true;
  platformPathAbstractionRequired: true;
}

export interface ToolRuntimeHarnessPlatformSupport {
  darwin: ToolRuntimeHarnessPlatformSupportStatus;
  win32: ToolRuntimeHarnessPlatformSupportStatus;
  linux: ToolRuntimeHarnessPlatformSupportStatus;
  pathStyles: ToolRuntimeHarnessPathStyle[];
  notes: string[];
}

export interface ToolRuntimeHarnessCheckRow {
  checkId: string;
  category: ToolRuntimeHarnessCategory;
  label: string;
  requiredFor: string[];
  status: ToolRuntimeHarnessStatus;
  pathStatus: ToolRuntimeHarnessPathStatus;
  path?: string;
  version?: string;
  platformSupport: ToolRuntimeHarnessPlatformSupport;
  canExecuteNow: false;
  executionMode: ToolRuntimeHarnessExecutionMode;
  missingIsBlocker: boolean;
  blockers: string[];
  warnings: string[];
  sourceRefs: string[];
  notes: string[];
}

export interface ToolRuntimeHarnessPathPolicyEntry {
  policyId: string;
  platform: RuntimePlatform | "all";
  pathStyle: ToolRuntimeHarnessPathStyle;
  required: boolean;
  sourceRefs: string[];
  notes: string[];
}

export interface ToolRuntimeHarnessPathPolicy {
  platformPathAbstractionRequired: true;
  projectRootRelativeRequired: true;
  hardcodedShellPathForbidden: true;
  shellProfilePathLookupForbidden: true;
  pathResolverRequired: true;
  policies: ToolRuntimeHarnessPathPolicyEntry[];
  sourceRefs: string[];
  notes: string[];
}

export interface ToolRuntimeHarnessPlatformCompatibility {
  currentPlatform: RuntimePlatform;
  darwinPathStyle: "posix";
  win32PathStyle: "win32";
  projectRootRelative: true;
  hardcodedShellPathForbidden: true;
  sourceRefs: string[];
  notes: string[];
}

export interface ToolRuntimeHarnessSourceCoverageEntry {
  layer: ToolRuntimeHarnessSourceLayer;
  referenced: boolean;
  referenceCount: number;
  sourceRefs: string[];
  notes: string[];
}

export interface ToolRuntimeHarnessState {
  schemaVersion: string;
  generatedAt: string;
  toolCategories: ToolRuntimeHarnessCategory[];
  checks: ToolRuntimeHarnessCheckRow[];
  summary: {
    totalChecks: number;
    ready: number;
    missing: number;
    planned: number;
    blocked: number;
    unknown: number;
    missingBlockers: number;
    optionalMissing: number;
    blockerCount: number;
    warningCount: number;
    dryRunOnly: true;
    diagnosticsOnly: true;
    canExecuteNow: false;
    liveSubmitAllowed: false;
    providerSubmissionForbidden: true;
    arbitraryShellExecutionBlocked: true;
  };
  pathPolicy: ToolRuntimeHarnessPathPolicy;
  platformCompatibility: ToolRuntimeHarnessPlatformCompatibility;
  sourceCoverage: ToolRuntimeHarnessSourceCoverageEntry[];
  hardLocks: ToolRuntimeHarnessHardLocks;
  dryRunOnly: true;
  diagnosticsOnly: true;
  noInstall: true;
  noCredentialRead: true;
  noCredentialWrite: true;
  noSystemSettingsMutation: true;
  arbitraryShellExecutionBlocked: true;
  sidecarDaemonDisabled: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  platformPathAbstractionRequired: true;
  notes: string[];
}

export type ProjectFileCorePathOrigin = "project_root_relative" | "user_selected_import";

export type ProjectFileCoreEntryKind = "file" | "directory";

export type ProjectFileCoreSourceRole =
  | "project_manifest"
  | "production_bible"
  | "story_flow"
  | "shot_spec"
  | "shot_layout"
  | "visual_memory"
  | "spatial_memory"
  | "scene_asset_pack"
  | "voice_memory"
  | "shots"
  | "manifests"
  | "reports"
  | "preview"
  | "exports"
  | "knowledge"
  | "settings"
  | "runtime_state";

export interface ProjectFileCorePathRef {
  path: string;
  origin: ProjectFileCorePathOrigin;
  importedFrom?: "user_selected_import";
  sourceRef?: string;
  notes: string[];
}

export interface ProjectFileCorePlannedEntry {
  id: string;
  role: ProjectFileCoreSourceRole;
  kind: ProjectFileCoreEntryKind;
  path: string;
  pathOrigin: "project_root_relative";
  status: "planned_only";
  requiredForFileFirstCore: boolean;
  notes: string[];
}

export interface ProjectFileCoreSourcePriority {
  role: ProjectFileCoreSourceRole;
  priority: number;
  canonicalPath: string;
  authority: "planned_project_file" | "project_file_tree" | "derived_cache";
  runtimeStateMayOverride: false;
  importedSourceRefs: ProjectFileCorePathRef[];
  notes: string[];
}

export interface ProjectFileCoreDerivedCachePolicy {
  runtimeStateRole: "derived_cache";
  runtimeStateMayBeRebuilt: true;
  runtimeStateIsSoleSourceOfTruth: false;
  rebuildInputs: ProjectFileCoreSourceRole[];
  cacheKeys: {
    sourceIndexHash: string;
    projectVersion: string;
    generatedAt: string;
  };
  invalidationRefs: string[];
  notes: string[];
}

export interface ProjectFileCorePathPolicy {
  allowedOrigins: ProjectFileCorePathOrigin[];
  projectRootRelativeRequired: true;
  userSelectedImportAllowed: true;
  hardcodedAbsolutePathContractForbidden: true;
  platformSpecificPathContractForbidden: true;
  pathResolverRequired: true;
  notes: string[];
}

export interface ProjectFileCoreHardLocks extends BaseHardLocks {
  readOnly: true;
  noUserFileMove: true;
  noProviderSubmit: true;
  noImageGeneration: true;
  noVideoGeneration: true;
  noArbitraryShell: true;
  projectVibeWriteAllowed: false;
  runtimeStateIsDerivedCache: true;
}

export interface ProjectFileCoreMigrationReadiness {
  status: "planned_only_ready" | "blocked";
  readyForDryRunPlanning: boolean;
  readyForRuntimeDerivation: boolean;
  readyForProjectVibeWrite: false;
  blockers: string[];
  warnings: string[];
  nextSteps: string[];
}

export interface ProjectFileCoreState {
  schemaVersion: string;
  generatedAt: string;
  phase: "phase_9_1_minimum_file_first_core";
  projectFileName: "project.vibe";
  projectFileStatus: "planned_not_written";
  projectRoot: {
    rootRef: "project_root";
    origin: "user_selected_import";
    selectedImport?: ProjectFileCorePathRef;
    notes: string[];
  };
  plannedFileTree: ProjectFileCorePlannedEntry[];
  sourceOfTruthPriority: ProjectFileCoreSourcePriority[];
  derivedCachePolicy: ProjectFileCoreDerivedCachePolicy;
  pathPolicy: ProjectFileCorePathPolicy;
  hardLocks: ProjectFileCoreHardLocks;
  migrationReadiness: ProjectFileCoreMigrationReadiness;
  sourceRefs: string[];
  notes: string[];
}

export type SubagentRunnerTaskKind =
  | "image"
  | "asset"
  | "start_frame"
  | "end_frame"
  | "image_edit"
  | "identity_qa"
  | "pair_qa"
  | "scene_qa"
  | "story_audit"
  | "video_execution"
  | "audio"
  | "export";

export type SubagentRunnerSlotStatus =
  | "planned"
  | "planned_missing_envelope"
  | "blocked_missing_envelope"
  | "blocked_contract_violation";

export type SubagentRunnerEnvelopeStatus = "validated" | "missing" | "invalid";

export interface SubagentRunnerHardLocks extends BaseHardLocks {
  diagnosticsOnly: true;
  noFreeTextTask: true;
  validatedEnvelopeRequired: true;
  noSpawnAgent: true;
  noSubprocess: true;
  noProviderExecution: true;
}

export interface SubagentRunnerPacketRequirement {
  requirementId:
    | "source_index_hash"
    | "source_fact_trace"
    | "knowledge_injection_trace"
    | "provider_policy"
    | "context_capsule"
    | "reference_authority"
    | "before_after_shots"
    | "expected_output"
    | "hard_negatives"
    | "expected_output_contract"
    | "acceptance_checklist"
    | "output_schema"
    | "forbidden_actions";
  label: string;
  required: true;
  schemaPath: string;
  notes: string[];
}

export interface SubagentRunnerRequirementCheck {
  requirementId: SubagentRunnerPacketRequirement["requirementId"];
  present: boolean;
  detail: string;
}

export interface SubagentRunnerSlot {
  runnerSlotId: string;
  taskKind: SubagentRunnerTaskKind;
  purpose: SubagentTaskPurpose;
  sourceId: string;
  envelopeId?: string;
  parentTaskId?: string;
  shotId?: string;
  status: SubagentRunnerSlotStatus;
  envelopeStatus: SubagentRunnerEnvelopeStatus;
  canExecute: false;
  canSpawnAgent: false;
  freeTextPromptPresent: boolean;
  requirementChecks: SubagentRunnerRequirementCheck[];
  blockedReasons: string[];
  warnings: string[];
  sourceRefs: string[];
  notes: string[];
}

export interface SubagentRunnerCoverageEntry {
  taskKind: SubagentRunnerTaskKind;
  expected: true;
  totalSlots: number;
  planned: number;
  plannedMissingEnvelope: number;
  blockedMissingEnvelope: number;
  blockedContractViolation: number;
  sourceRefs: string[];
  notes: string[];
}

export interface SubagentRunnerState {
  schemaVersion: string;
  generatedAt: string;
  slots: SubagentRunnerSlot[];
  coverage: SubagentRunnerCoverageEntry[];
  summary: {
    totalSlots: number;
    planned: number;
    plannedMissingEnvelope: number;
    blockedMissingEnvelope: number;
    blockedContractViolation: number;
    freeTextBlocked: number;
    validatedEnvelopes: number;
    missingEnvelopes: number;
    invalidEnvelopes: number;
    canExecute: 0;
    dryRunOnly: true;
    diagnosticsOnly: true;
    noFreeTextTask: true;
    noFreeTextWorker: true;
    validatedEnvelopeRequired: true;
    providerSubmissionForbidden: true;
    liveSubmitAllowed: false;
  };
  hardLocks: SubagentRunnerHardLocks;
  blockedReasons: string[];
  packetRequirements: SubagentRunnerPacketRequirement[];
  dryRunOnly: true;
  diagnosticsOnly: true;
  noFreeTextTask: true;
  validatedEnvelopeRequired: true;
  noSpawnAgent: true;
  noSubprocess: true;
  noShellExecution: true;
  noProviderExecution: true;
  noCredentialRead: true;
  noFileMutation: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  notes: string[];
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

export type FilesystemWatcherMonitoredKind =
  | "agent_temp_generated_images"
  | "project_outputs"
  | "reports"
  | "videos"
  | "audio";

export type FilesystemWatcherArtifactClass =
  | "temp_candidate"
  | "expected_output"
  | "provider_ready_derivative"
  | "qa_report"
  | "manifest_mismatch"
  | "formal_output"
  | "worker_exit_without_expected_output"
  | "postprocess_recoverable"
  | "stall_timeout"
  | "blocked"
  | "unknown";

export type FilesystemWatcherHarnessLinkStatus = "linked" | "missing_harness_link";

export interface FilesystemWatcherMonitoredRoot {
  rootId: string;
  kind: FilesystemWatcherMonitoredKind;
  label: string;
  pathPolicy: "derived_static_only";
  pathHints: string[];
  daemonStarted: false;
  notes: string[];
}

export interface FilesystemWatcherHarnessHardLocks extends BaseHardLocks {
  watcherCannotPromoteFormal: true;
  workerSelfReportCannotComplete: true;
  tempOutputDraftOnly: true;
  semanticPostprocessForbidden: true;
}

export interface FilesystemWatcherHarnessStream {
  streamId: string;
  sourceEventId: string;
  eventType: WatcherEventType;
  artifactPath?: string;
  expectedOutputPath?: string;
  taskPlanId: string;
  jobId?: string;
  shotId?: string;
  artifactClass: FilesystemWatcherArtifactClass;
  monitoredKind: FilesystemWatcherMonitoredKind;
  draftOnly: boolean;
  canPromoteFormal: boolean;
  canBecomeFutureReference: boolean;
  requiresManifestMatch: boolean;
  requiresQaPass: boolean;
  manifestMatchStatus?: string;
  generationHealthReportId?: string;
  qaPromotionReportId?: string;
  generationHarnessJobId?: string;
  harnessLinkStatus: FilesystemWatcherHarnessLinkStatus;
  missingHarnessLinkReason?: string;
  notes: string[];
}

export interface FilesystemWatcherHarnessState {
  schemaVersion: string;
  generatedAt: string;
  monitoredKinds: FilesystemWatcherMonitoredKind[];
  monitoredRoots: FilesystemWatcherMonitoredRoot[];
  streams: FilesystemWatcherHarnessStream[];
  summary: {
    totalStreams: number;
    draftOnly: number;
    promotableFormal: number;
    missingHarnessLinks: number;
    tempCandidates: number;
    expectedOutputs: number;
    qaReports: number;
    manifestMismatches: number;
    daemonStarted: false;
    liveSubmitAllowed: false;
  };
  hardLocks: FilesystemWatcherHarnessHardLocks;
  derivedOnly: true;
  fsWatchDaemonEnabled: false;
  daemonStarted: false;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  notes: string[];
}

export type CheckpointResumeStatus =
  | "skip_ready"
  | "manual_review_required"
  | "rerun_required"
  | "blocked"
  | "waiting";

export type CheckpointResumeDecision =
  | "skip_existing_formal"
  | "manual_promote_or_review_candidate"
  | "manual_review_temp_or_derivative"
  | "rerun_missing_expected_output"
  | "rerun_stale_source"
  | "blocked_by_generation_gate"
  | "wait_for_qa_or_promotion";

export interface CheckpointResumeHarnessHardLocks extends BaseHardLocks {
  noAutoSkipWithoutQa: true;
  workerSelfReportCannotComplete: true;
  tempCandidateCannotResumeAsFormal: true;
}

export interface CheckpointResumeHarnessItem {
  resumeItemId: string;
  taskPlanId: string;
  jobId: string;
  shotId: string;
  harnessJobId?: string;
  expectedOutputPath: string;
  candidatePath?: string;
  formalPath?: string;
  candidatePathExists: boolean;
  formalPathExists: boolean;
  expectedOutputExists: boolean;
  manifestStatus: string;
  healthStatus: GenerationHealthStatus | "missing";
  qaStatus: GenerationQaStatus;
  promotionStatus?: QaPromotionStatus;
  canPromoteToFormal: boolean;
  watcherStreamIds: string[];
  resumeStatus: CheckpointResumeStatus;
  resumeDecision: CheckpointResumeDecision;
  skipAllowed: boolean;
  rerunAllowed: boolean;
  manualReviewRequired: boolean;
  blockingReasons: string[];
  notes: string[];
}

export interface CheckpointResumeHarnessState {
  schemaVersion: string;
  generatedAt: string;
  items: CheckpointResumeHarnessItem[];
  summary: {
    totalItems: number;
    skipAllowed: number;
    rerunAllowed: number;
    manualReviewRequired: number;
    blocked: number;
    missingExpectedOutput: number;
    linkedWatcherStreams: number;
    linkedGenerationHarnessJobs: number;
    dryRunOnly: true;
    liveSubmitAllowed: false;
    noFileMutation: true;
  };
  hardLocks: CheckpointResumeHarnessHardLocks;
  dryRunOnly: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  noFileMutation: true;
  planOnly: true;
  notes: string[];
}
