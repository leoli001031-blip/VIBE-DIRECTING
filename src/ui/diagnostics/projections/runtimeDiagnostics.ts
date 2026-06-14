import { PROVIDER_READY_DERIVATIVE_DETECTED } from "../../../core/statusConstants";
import { buildDesktopRuntimePlan, type DesktopRuntimePlan } from "../../../core/desktopRuntime";
import type { ProjectRuntimeState } from "../../../core/projectState";
import type { RuntimeView, TaskRuntimeView } from "../../../core/runtimeView";
import type { MotionEndpointContract, ShotRecord } from "../../../core/types";
import { statusLabel } from "../../common/DiagnosticsPrimitives";
import { formatShotNumber } from "../../director/MinimalStoryFlow";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type DesktopRuntimeShellView = {
  planStatus: string;
  runtimeMode: string;
  platformPathPolicy: string;
  projectPermissionScope: string;
  sidecarPolicy: string;
  credentialVault: string;
  hardLocks: string[];
};

export type AgentCliMockRunnerUiSummary = {
  initialized: boolean;
  runnerKind: string;
  replacementProof: string;
  readiness: string;
  noopResultCount: number;
  hardLocks: string[];
};
export type CliAdapterSpikeUiSummary = {
  initialized: boolean;
  readiness: string;
  contractMode: string;
  replacementProof: string;
  inputSource: string;
  spawnResumeShape: string;
  providerSubmit: string;
  mutationBoundary: string;
  blockers: string[];
  warnings: string[];
  hardLocks: string[];
};

export type ExportWorkerUiSummary = {
  initialized: boolean;
  readiness: string;
  scope: string;
  plannedWriteCount: number;
  plannedWriteSamples: string[];
  exportRoot: string;
  blockersWarnings: string[];
  hardLocks: string[];
};
export type VoiceAudioSettingsUiSummary = {
  initialized: boolean;
  phase: string;
  readiness: string;
  voiceSourceCount: number;
  voiceSourceDetail: string;
  audioPlanCount: number;
  audioPlanDetail: string;
  noBgmPolicy: boolean;
  noBgmDetail: string;
  providerSlotsTotal: number;
  providerSlotsPlanned: number;
  providerSlotsLive: number;
  blockersWarnings: string[];
  hardLocks: string[];
};
export type LocalOrchestratorUiSummary = {
  initialized: boolean;
  readiness: string;
  queueTotal: number;
  ready: number;
  waiting: number;
  runningPlanned: number;
  waitingOutput: number;
  qaPending: number;
  needsReview: number;
  blocked: number;
  failed: number;
  stalled: number;
  completeVerified: number;
  nextReadyCount: number;
  autoContinueMode: string;
  providerFileDaemonLocks: string;
  blockersWarnings: string[];
  hardLocks: string[];
};
export type VisualConsistencyContractUiSummary = {
  initialized: boolean;
  readiness: string;
  gateStatus: string;
  geometryStatus: string;
  shotLayoutStatus: string;
  keyframePairStatus: string;
  driftRepairStatus: string;
  blockersWarnings: string[];
  requiredGates: string[];
};
export type FullTaskSubagentPacketPlannerUiSummary = {
  initialized: boolean;
  readiness: string;
  coverageStatus: string;
  packetStatus: string;
  outputStatus: string;
  traceStatus: string;
  freeTextStatus: string;
  routeStatus: string;
  blockersWarnings: string[];
  requiredGates: string[];
};
export type KnowledgePackUserManagementUiSummary = {
  initialized: boolean;
  readiness: string;
  userFlowStatus: string;
  checkStatus: string;
  routeConflictStatus: string;
  overrideStatus: string;
  injectionStatus: string;
  promotionStatus: string;
  blockersWarnings: string[];
  requiredGates: string[];
};
export type WorkerRuntimeGateUiSummary = {
  initialized: boolean;
  readiness: string;
  contractStatus: string;
  gateStatus: string;
  inputStatus: string;
  outputStatus: string;
  executionStatus: string;
  blockersWarnings: string[];
  requiredGates: string[];
};
export type ProviderClosedLoopShellUiSummary = {
  initialized: boolean;
  readiness: string;
  shellStatus: string;
  watcherStatus: string;
  manifestStatus: string;
  qaStatus: string;
  promotionStatus: string;
  safetyStatus: string;
  blockersWarnings: string[];
  requiredGates: string[];
};
export type BetaAcceptanceUiSummary = {
  initialized: boolean;
  readiness: string;
  desktopStatus: string;
  projectExportStatus: string;
  runtimeGateStatus: string;
  providerStatus: string;
  testStatus: string;
  closureStatus: string;
  blockersWarnings: string[];
  requiredGates: string[];
};
export type RealPilotUiSummary = {
  reviewStatus: string;
  handoffLabel: string;
  handoffDetail: string;
  handoffTone: string;
  selectedShotCount: number;
  selectedShotDetail: string;
  framePairValue: string;
  framePairDetail: string;
  estimatedOutputCount: number;
  estimatedOutputDetail: string;
  outputRoot: string;
  confirmationState: string;
  image2State: string;
  seedanceState: string;
  preConfirmState: string;
  preConfirmBudgetLimit: string;
  preConfirmOutputWatch: string;
  preConfirmRequestPreview: string;
  preConfirmScopeDetail: string;
  oneShotStatus: string;
  oneShotConfirmation: string;
  oneShotActionScope: string;
  oneShotOutputExpectation: string;
  oneShotConfirmed: boolean;
  readyItems: number;
  blockedItems: number;
  ledgerEntries: number;
  blockers: string[];
  warnings: string[];
};

function desktopLockSummary(hardLocks: DesktopRuntimePlan["hardLocks"]) {
  const labels: Partial<Record<keyof DesktopRuntimePlan["hardLocks"], string>> = {
    noFileMutation: "no user project file mutation",
    noProviderSubmit: "no provider submit",
    noCredentialRead: "no credential read",
    noCredentialWrite: "no credential write",
    noArbitraryShell: "no arbitrary shell",
    noSidecarSpawn: "no sidecar execution",
    liveSubmitAllowed: "live submit disabled",
  };

  return Object.entries(labels)
    .filter(([key]) => hardLocks[key as keyof DesktopRuntimePlan["hardLocks"]] === true || key === "liveSubmitAllowed")
    .map(([key, label]) => key === "liveSubmitAllowed" && hardLocks.liveSubmitAllowed === false ? label : label)
    .filter((label): label is string => Boolean(label));
}

export function buildDesktopRuntimeShellView(runtimeState: ProjectRuntimeState): DesktopRuntimeShellView {
  const config = runtimeState.runtime.config;
  const plan = buildDesktopRuntimePlan({
    generatedAt: runtimeState.project.importedAt,
    platform: config.platform,
    runtimeMode: "tauri_permission_shell_planned",
    projectRootToken: "user_selected_project_root:unbound",
    portableProjectPaths: [
      "project.vibe",
      "story_flow/story_flow.vibe.json",
      "visual_memory/visual_memory.vibe.json",
      "shots/index.vibe.json",
    ],
  });
  const plannedVaults = plan.credentialVaultPlan.plannedStores.map(statusLabel).join(", ") || "not configured";

  return {
    planStatus: plan.validation.ok ? "dry-run" : "blocked",
    runtimeMode: `${statusLabel(plan.runtimeMode)} / ${plan.platform}`,
    platformPathPolicy: `${statusLabel(plan.pathResolverPlan.mode)} · ${plan.pathResolverPlan.resolvers.length} resolver(s) · absolute persistence ${String(plan.pathResolverPlan.hardcodedAbsolutePathPersistenceAllowed)}`,
    projectPermissionScope: `${statusLabel(plan.projectPermissionScope.scopeKind)} · ${plan.projectPermissionScope.allowedRoots.map(statusLabel).join(", ")}`,
    sidecarPolicy: `${plan.sidecarAllowlist.status} · ${plan.sidecarAllowlist.arbitraryShell} arbitrary shell · ${plan.sidecarAllowlist.commands.length} allowlisted command(s)`,
    credentialVault: `${plan.credentialVaultPlan.mode}; read ${String(plan.credentialVaultPlan.readAllowedNow)}; write ${String(plan.credentialVaultPlan.writeAllowedNow)}; planned vaults ${plannedVaults}`,
    hardLocks: desktopLockSummary(plan.hardLocks),
  };
}


export type ImagePipelineState = ProjectRuntimeState["imagePipeline"];
export type VideoPlanningState = ProjectRuntimeState["videoPlanning"];
export type VideoExecutionPreviewState = ProjectRuntimeState["videoExecutionPreview"];
export type VideoExecutionPreviewRow = VideoExecutionPreviewState["previews"][number];
export type VideoReadinessGateState = VideoPlanningState["readinessGates"][number];
export type VideoTaskPlanState = VideoPlanningState["taskPlans"][number];
type MotionEndpointUiFacts = {
  shotId: string;
  motionType: string;
  motionLabel: string;
  endFrameRequired: boolean;
  contractStatus: string;
  bodyMechanicsRequired: boolean;
  editableRegionCount: number;
  protectedRegionCount: number;
  bboxOnlyMotionForbidden: boolean;
  blockers: string[];
  warnings: string[];
  source: "contract" | "task_facts" | "missing";
};
export type MotionEndpointDiagnosticsSummary = {
  total: number;
  endFrameRequiredCount: number;
  bodyMechanicsRequiredCount: number;
  typeCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  compactItems: string[];
};
type Phase17LoopRow = {
  label: string;
  status: string;
  detail: string;
};
type Phase17ImageKeyframeRuntimeSummary = {
  status: string;
  assetPlanCount: number;
  startFramePlanCount: number;
  endFramePlanCount: number;
  adapterRequestCount: number;
  validPairCount: number;
  pairGateCount: number;
  startPlanMotionFactCount: number;
  endPlanMotionFactCount: number;
  blockedPairMotionBlockerCount: number;
  closedLoopEvidenceCount: number;
  providerLockCount: number;
  rows: Phase17LoopRow[];
  blockers: string[];
  warnings: string[];
};
type CheckerFactRow = {
  id: string;
  label: string;
  status: string;
  detail: string;
  sourceRefs: string[];
};
type GenerationHealthCheckerState = {
  initialized: boolean;
  reportCount: number;
  factChainSummary: CheckerFactRow[];
  postprocessRecoverable: number;
  workerSelfReportMismatch: number;
  qaCoverageMissing: number;
  blockers: string[];
  warnings: string[];
};
type PromptConflictCheckerState = {
  initialized: boolean;
  reportCount: number;
  conflictCount: number;
  blockingConflicts: number;
  needsRecompile: number;
  structuredSourcesToUpdate: string[];
  blockers: string[];
  warnings: string[];
};
export type GenerationHarnessStage = {
  id: string;
  label: string;
  status: string;
  detail?: string;
};
export type GenerationHarnessCandidateOutput = {
  status: string;
  candidatePath?: string;
  formalPath?: string;
  expectedOutputPath?: string;
  manifestStatus?: string;
  healthStatus?: string;
  qaStatus?: string;
  canPromoteToFormal: boolean;
};
type GenerationHarnessJob = {
  jobId: string;
  shotId: string;
  taskPlanId?: string;
  providerSlot: string;
  chainStatus: string;
  blockingReasons: string[];
  stages: GenerationHarnessStage[];
  candidateOutput: GenerationHarnessCandidateOutput;
  postprocessPolicy?: string;
  forbiddenActions: string[];
  dryRunOnly: boolean;
  providerSubmissionForbidden: boolean;
  liveSubmitAllowed: boolean;
};
type GenerationHarnessSummary = {
  totalJobs: number;
  blockedJobs: number;
  readyJobs: number;
  waitingForOutputJobs: number;
  qaPendingJobs: number;
  formalReadyJobs: number;
  dryRunOnly: boolean;
  providerSubmissionForbidden: boolean;
};
export type GenerationHarnessState = {
  initialized: boolean;
  summary: GenerationHarnessSummary;
  jobs: GenerationHarnessJob[];
};
type FilesystemWatcherSummary = {
  totalEvents?: number;
  tempCandidates?: number;
  expectedOutputs?: number;
  qaReports?: number;
  manifestMismatches?: number;
  blockedEvents?: number;
  draftOnlyArtifacts?: number;
  promotableArtifacts?: number;
  linkedHarnessJobs?: number;
  missingHarnessLinks?: number;
  liveSubmitAllowed?: boolean;
  providerSubmissionForbidden?: boolean;
};
type FilesystemWatcherRoot = {
  id: string;
  label: string;
  kind: string;
  status: string;
  pathHint?: string;
  notes: string[];
};
type FilesystemWatcherStream = {
  streamId: string;
  taskPlanId?: string;
  jobId?: string;
  shotId?: string;
  harnessJobId?: string;
  eventType: string;
  status: string;
  severity: string;
  artifactClass: string;
  artifactPath?: string;
  expectedOutputPath?: string;
  draftOnly?: boolean;
  canPromoteFormal?: boolean;
  canBecomeFutureReference?: boolean;
  requiresManifestMatch?: boolean;
  requiresQaPass?: boolean;
  blockingReasons: string[];
  notes: string[];
};
type FilesystemWatcherLocks = {
  watcherCannotPromoteFormal?: boolean;
  workerSelfReportCannotComplete?: boolean;
  tempOutputDraftOnly?: boolean;
  semanticPostprocessForbidden?: boolean;
  liveSubmitAllowed?: boolean;
  providerSubmissionForbidden?: boolean;
};
export type FilesystemWatcherHarnessState = {
  initialized: boolean;
  hasSummary: boolean;
  hasMonitoredRoots: boolean;
  hasStreams: boolean;
  hasLocks: boolean;
  summary: FilesystemWatcherSummary;
  monitoredRoots: FilesystemWatcherRoot[];
  streams: FilesystemWatcherStream[];
  locks: FilesystemWatcherLocks;
};
type CheckpointResumeSummary = {
  totalItems?: number;
  skipAllowed?: number;
  rerunAllowed?: number;
  manualReviewRequired?: number;
  blocked?: number;
  missingExpectedOutput?: number;
  formalReady?: number;
  tempCandidateBlocked?: number;
  liveSubmitAllowed?: boolean;
  providerSubmissionForbidden?: boolean;
};
type CheckpointResumeHardLocks = {
  dryRunOnly?: boolean;
  providerSubmissionForbidden?: boolean;
  liveSubmitAllowed?: boolean;
  noFileMutation?: boolean;
  noAutoSkipWithoutQa?: boolean;
  workerSelfReportCannotComplete?: boolean;
  tempCandidateCannotResumeAsFormal?: boolean;
};
type CheckpointResumeItem = {
  resumeItemId: string;
  taskPlanId?: string;
  jobId?: string;
  shotId?: string;
  generationHarnessJobId?: string;
  expectedOutputPath?: string;
  candidatePath?: string;
  formalPath?: string;
  manifestStatus?: string;
  healthStatus?: string;
  qaStatus?: string;
  watcherStreamIds: string[];
  hasWatcherStreamIds: boolean;
  resumeStatus?: string;
  resumeDecision?: string;
  skipAllowed?: boolean;
  rerunAllowed?: boolean;
  manualReviewRequired?: boolean;
  blockingReasons: string[];
  hasBlockingReasons: boolean;
  notes: string[];
};
export type CheckpointResumeHarnessState = {
  initialized: boolean;
  hasSummary: boolean;
  hasHardLocks: boolean;
  hasResumeItems: boolean;
  summary: CheckpointResumeSummary;
  hardLocks: CheckpointResumeHardLocks;
  resumeItems: CheckpointResumeItem[];
};
const qaHarnessDimensions = [
  "whole_film",
  "identity",
  "scene",
  "pair",
  "story",
  "prop",
  "style",
  "motion",
  "audio",
] as const;
type QaHarnessDimension = typeof qaHarnessDimensions[number];
type QaHarnessSummary = {
  totalItems?: number;
  formalEligible?: number;
  requiresHumanReview?: number;
  blocked?: number;
  unknown?: number;
  failed?: number;
  partial?: number;
  dryRunOnly?: boolean;
  liveSubmitAllowed?: boolean;
  noFileMutation?: boolean;
};
type QaHarnessHardLocks = {
  dryRunOnly?: boolean;
  providerSubmissionForbidden?: boolean;
  liveSubmitAllowed?: boolean;
  noFileMutation?: boolean;
  noAutoPromotion?: boolean;
  semanticRepairForbidden?: boolean;
  workerSelfReportCannotPassQa?: boolean;
  overallFirst?: boolean;
};
export type QaGateRow = {
  dimension: string;
  label: string;
  status: string;
  severity: string;
  blockers: string[];
  warnings: string[];
  sourceRefs: string[];
  notes: string[];
  initialized: boolean;
};
type QaHarnessItem = {
  qaItemId: string;
  shotId: string;
  taskPlanId?: string;
  jobId?: string;
  harnessJobId?: string;
  checkpointResumeItemId?: string;
  formalPromotionEligible?: boolean;
  requiresHumanReview?: boolean;
  overallStatus: string;
  dimensionGates: QaGateRow[];
  sourceCoverage: string[];
  blockers: string[];
  warnings: string[];
  notes: string[];
};
export type QaHarnessState = {
  initialized: boolean;
  hasSummary: boolean;
  hasHardLocks: boolean;
  hasOverall: boolean;
  hasItems: boolean;
  schemaVersion: string;
  generatedAt: string;
  dimensions: readonly QaHarnessDimension[];
  summary: QaHarnessSummary;
  overall: QaGateRow[];
  items: QaHarnessItem[];
  hardLocks: QaHarnessHardLocks;
};
type ToolRuntimeHarnessSummary = {
  totalChecks?: number;
  ready?: number;
  missing?: number;
  planned?: number;
  blocked?: number;
  unknown?: number;
  requiredMissing?: number;
  optionalMissing?: number;
  dryRunOnly?: boolean;
  liveSubmitAllowed?: boolean;
};
type ToolRuntimeHarnessCheck = {
  checkId: string;
  category: string;
  label: string;
  requiredFor: string[];
  status: string;
  pathStatus: string;
  path?: string;
  version?: string;
  platformSupport: string[];
  canExecuteNow?: boolean;
  executionMode: string;
  missingIsBlocker?: boolean;
  blockers: string[];
  warnings: string[];
  sourceRefs: string[];
  notes: string[];
};
type ToolRuntimePathPolicy = {
  platformPathAbstractionRequired?: boolean;
  macPathStyle: string;
  windowsPathStyle: string;
  projectRootRelativeRequired?: boolean;
  allowedRoots: string[];
  blockers: string[];
  warnings: string[];
  notes: string[];
};
type ToolRuntimeHardLocks = {
  dryRunOnly?: boolean;
  diagnosticsOnly?: boolean;
  noInstall?: boolean;
  noCredentialRead?: boolean;
  noCredentialWrite?: boolean;
  noSystemSettingsMutation?: boolean;
  arbitraryShellExecutionBlocked?: boolean;
  sidecarDaemonDisabled?: boolean;
  providerSubmissionForbidden?: boolean;
  liveSubmitAllowed?: boolean;
  platformPathAbstractionRequired?: boolean;
};
export type ToolRuntimeHarnessState = {
  initialized: boolean;
  hasSummary: boolean;
  hasChecks: boolean;
  hasPathPolicy: boolean;
  hasHardLocks: boolean;
  schemaVersion: string;
  generatedAt: string;
  summary: ToolRuntimeHarnessSummary;
  checks: ToolRuntimeHarnessCheck[];
  pathPolicy: ToolRuntimePathPolicy;
  hardLocks: ToolRuntimeHardLocks;
};
const requiredVideoExecutionHardLocks = [
  "no_live_submit",
  "no_fast_model",
  "no_vip_channel",
  "no_text_to_video_main_path",
  "no_bgm_in_video_prompt",
  "first_frame_video_default",
  "endpoint_end_frame_optional",
  "subagent_must_use_packet",
] as const;
const requiredVoiceSourceHardLocks = [
  ["dryRunOnly", true],
  ["noProviderSubmit", true],
  ["providerSubmissionForbidden", true],
  ["liveSubmitAllowed", false],
  ["noCredentialRead", true],
  ["noCredentialWrite", true],
  ["noSecretStorage", true],
  ["noSampleAudioCopy", true],
  ["noFileMutation", true],
  ["noTtsSubmit", true],
  ["noMusicSubmit", true],
  ["noBgmInVideoProvider", true],
] as const;
const requiredGenerationHarnessStages = [
  "shot_spec",
  "visual_memory",
  "spatial_memory",
  "shot_layout",
  "style_capsule",
  "shot_prompt_plan",
  "provider_capability_check",
  "provider_request_preview",
  "candidate_output",
  "qa_gate",
] as const;
const requiredGenerationHarnessForbiddenActions = [
  "live_submit",
  "provider_unlock",
  "prompt_bypass",
  "candidate_auto_promote",
  "semantic_postprocess_repair",
  "text_to_video_fallback",
] as const;

function emptyImagePipeline(): ImagePipelineState {
  return {
    providerRegistry: {
      schemaVersion: "0.1.0",
      registryVersion: "empty",
      strictImageProvider: "image2_only",
      defaultProviderBySlot: {},
      capabilities: [],
      notes: [],
    },
    promptPlans: [],
    promptConflictReports: [],
    assetReadinessReports: [],
    imageTaskPlans: [],
    image2AdapterRequests: [],
    watcherEvents: [],
    generationHealthReports: [],
    qaPromotionReports: [],
  };
}

export function getImagePipeline(runtimeState: ProjectRuntimeState): ImagePipelineState {
  const pipeline = (runtimeState as Partial<ProjectRuntimeState>).imagePipeline;
  if (!pipeline) return emptyImagePipeline();
  return {
    ...emptyImagePipeline(),
    ...pipeline,
    providerRegistry: {
      ...emptyImagePipeline().providerRegistry,
      ...pipeline.providerRegistry,
      capabilities: pipeline.providerRegistry?.capabilities || [],
      notes: pipeline.providerRegistry?.notes || [],
    },
    promptPlans: pipeline.promptPlans || [],
    promptConflictReports: pipeline.promptConflictReports || [],
    assetReadinessReports: pipeline.assetReadinessReports || [],
    imageTaskPlans: pipeline.imageTaskPlans || [],
    image2AdapterRequests: pipeline.image2AdapterRequests || [],
    watcherEvents: pipeline.watcherEvents || [],
    generationHealthReports: pipeline.generationHealthReports || [],
    qaPromotionReports: pipeline.qaPromotionReports || [],
  };
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.length ? value : fallback;
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readOptionalNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readOptionalBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function readNoteList(value: unknown) {
  if (typeof value === "string" && value.trim()) return [value];
  return readStringArray(value);
}

function readBooleanLockLabel(
  record: Record<string, unknown>,
  key: string,
  label: string,
  expected: boolean,
) {
  return record[key] === expected ? label : undefined;
}

function readReplacementProofLabel(value: unknown) {
  if (typeof value === "boolean") return value ? "present" : "missing";
  if (typeof value === "string" && value.length) return statusLabel(value);
  if (!isRecord(value)) return "missing";
  const status = readString(value.status, readString(value.result, ""));
  if (status) return statusLabel(status);
  const proven =
    readOptionalBoolean(value, "proven") ??
    readOptionalBoolean(value, "ready") ??
    readOptionalBoolean(value, "replacementProofReady") ??
    readOptionalBoolean(value, "present");
  return proven ? "present" : "missing";
}

function readFirstString(records: Record<string, unknown>[], keys: string[], fallback: string) {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return fallback;
}

function readFirstNumber(records: Record<string, unknown>[], keys: string[]) {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (Array.isArray(value)) return value.length;
    }
  }
  return undefined;
}

function readFirstBoolean(records: Record<string, unknown>[], keys: string[]) {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "boolean") return value;
    }
  }
  return undefined;
}

function firstRecordFrom(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (isRecord(record[key])) return record[key];
  }
  return {};
}

function firstArrayFrom(records: Record<string, unknown>[], keys: string[]) {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

function compactPathLabel(value: unknown, fallback = "blocked/missing") {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const normalized = value.replace(/\\/g, "/").replace(/\/+$/g, "");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length) return normalized || fallback;
  if (parts.length === 1) return parts[0];
  return `.../${parts.slice(-2).join("/")}`;
}

function formatPlannedWriteSample(value: unknown, index: number) {
  if (typeof value === "string") return compactPathLabel(value, `planned write ${index + 1}`);
  if (!isRecord(value)) return `planned write ${index + 1}`;
  const action = readString(value.action, readString(value.kind, readString(value.type, "planned write")));
  const target = value.targetPath ?? value.path ?? value.relativePath ?? value.destination ?? value.outputPath ?? value.file;
  const targetLabel = compactPathLabel(target, "");
  return [statusLabel(action), targetLabel].filter(Boolean).join(" / ") || `planned write ${index + 1}`;
}

function voiceAudioSettingsReadinessLabel(status: string, initialized: boolean, phase: string) {
  if (!initialized) return "blocked/missing";
  if (phase !== "phase_28_voice_audio_settings_ui") return "blocked";
  const normalized = status.toLowerCase();
  if (normalized.includes("ready")) return "ready";
  if (normalized.includes("planned")) return "planned";
  if (normalized.includes("blocked") || normalized.includes("missing") || normalized.includes("fail")) return "blocked";
  return status ? statusLabel(status) : "blocked/missing";
}

function providerSlotState(slot: unknown) {
  if (!isRecord(slot)) return "";
  return readString(slot.state, readString(slot.status, ""));
}

function providerSlotIsLive(slot: unknown) {
  return isRecord(slot) && slot.liveSubmitAllowed === true;
}

function buildVoiceAudioHardLocks(
  rootRecord: Record<string, unknown>,
  summary: Record<string, unknown>,
  policy: Record<string, unknown>,
) {
  const explicitHardLocks = firstArrayFrom([rootRecord, summary, policy], ["hardLocks", "locks", "hardLockStrip"])
    .map((item, index) => formatHarnessValue(item, `hard lock ${index + 1}`))
    .filter(Boolean);
  const rootLocks = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockStrip", "hardLockSummary"]);
  const summaryLocks = firstRecordFrom(summary, ["hardLocks", "locks", "hardLockStrip", "hardLockSummary"]);
  const lockRecords = [rootLocks, summaryLocks, policy, rootRecord, summary];
  const inferredLocks = [
    readBooleanLockLabel(rootLocks, "dryRunOnly", "dry-run only", true),
    readBooleanLockLabel(rootLocks, "readOnly", "read-only", true),
    readBooleanLockLabel(rootLocks, "diagnosticsOnly", "diagnostics/settings only", true),
    readBooleanLockLabel(rootLocks, "noTtsSubmit", "TTS submit blocked", true),
    readBooleanLockLabel(rootLocks, "noMusicSubmit", "music submit blocked", true),
    readBooleanLockLabel(rootLocks, "noBgmInVideoProvider", "no BGM in video provider", true),
    readBooleanLockLabel(rootLocks, "noProviderSubmit", "provider submit blocked", true),
    readBooleanLockLabel(rootLocks, "providerSubmissionForbidden", "provider submit blocked", true),
    readBooleanLockLabel(rootLocks, "liveSubmitAllowed", "live submit disabled", false),
    readBooleanLockLabel(rootLocks, "noCredentialRead", "no credential read", true),
    readBooleanLockLabel(rootLocks, "noCredentialWrite", "no credential write", true),
    readBooleanLockLabel(rootLocks, "noSecretStorage", "no secret storage", true),
    readBooleanLockLabel(rootLocks, "noSampleAudioCopy", "no sample audio copy", true),
    readBooleanLockLabel(rootLocks, "noFileUpload", "no file upload", true),
    readBooleanLockLabel(rootLocks, "noFileMutation", "no file mutation", true),
    readBooleanLockLabel(rootLocks, "noProviderRun", "provider run blocked", true),
    readBooleanLockLabel(summaryLocks, "noTtsSubmit", "TTS submit blocked", true),
    readBooleanLockLabel(summaryLocks, "noMusicSubmit", "music submit blocked", true),
    readBooleanLockLabel(summaryLocks, "noBgmInVideoProvider", "no BGM in video provider", true),
    readBooleanLockLabel(summaryLocks, "providerSubmissionForbidden", "provider submit blocked", true),
    readBooleanLockLabel(summaryLocks, "liveSubmitAllowed", "live submit disabled", false),
    readBooleanLockLabel(policy, "noBgmInVideoProvider", "no BGM in video provider", true),
    readBooleanLockLabel(policy, "noBgmForVideoProvider", "no BGM in video provider", true),
    readBooleanLockLabel(policy, "providerSubmissionForbidden", "provider submit blocked", true),
    readBooleanLockLabel(policy, "liveSubmitAllowed", "live submit disabled", false),
    readFirstBoolean(lockRecords, ["noCredentialRead"]) === true ? "no credential read" : undefined,
    readFirstBoolean(lockRecords, ["noCredentialWrite"]) === true ? "no credential write" : undefined,
  ].filter((lock): lock is string => Boolean(lock));

  return Array.from(new Set([...explicitHardLocks, ...inferredLocks]));
}

export function buildVoiceAudioSettingsUiSummary(runtimeState: ProjectRuntimeState): VoiceAudioSettingsUiSummary {
  const root = (runtimeState as Partial<ProjectRuntimeState> & { voiceAudioSettings?: unknown }).voiceAudioSettings;
  const initialized = isRecord(root);
  const rootRecord = initialized ? root as Record<string, unknown> : {};
  const summary = initialized && isRecord(rootRecord.summary) ? rootRecord.summary : {};
  const voice = firstRecordFrom(rootRecord, ["voiceSourceSummary", "voice", "voiceSummary", "voiceSources", "voiceSourceRegistry"]);
  const audio = firstRecordFrom(rootRecord, ["audioSettingSummary", "audio", "audioSummary", "audioPlans", "audioPlanning"]);
  const policy = firstRecordFrom(rootRecord, ["videoProviderAudioPolicy", "policy", "audioPolicy", "providerPolicy", "videoProviderPolicy"]);
  const providerSlotSummary = firstRecordFrom(rootRecord, ["providerSlots", "providerSlotSummary", "providers", "providerSummary"]);
  const records = [summary, voice, audio, policy, providerSlotSummary, rootRecord].filter(isRecord);
  const voiceRecords = [voice, summary, rootRecord].filter(isRecord);
  const audioRecords = [audio, summary, rootRecord].filter(isRecord);
  const providerRecords = [providerSlotSummary, audio, policy, summary, rootRecord].filter(isRecord);
  const phase = readString(rootRecord.phase, initialized ? "missing phase" : "missing");
  const status = readFirstString([summary, rootRecord], ["readiness", "status", "state"], "");
  const providerSlotRows = firstArrayFrom(providerRecords, ["providerSlotStates", "providerSlots", "slots", "audioProviderSlots"]);
  const effectiveProviderSlots = providerSlotRows.length ? providerSlotRows : runtimeState.audioPlanning.providerSlots;
  const voiceSourceCount = readFirstNumber(voiceRecords, [
    "voiceSourceCount",
    "sourceCount",
    "sources",
    "voiceSources",
    "totalSources",
  ]) ?? runtimeState.audioPlanning.voiceSourceRegistry.sourceCount;
  const lockedVoiceSourceCount = readFirstNumber(voiceRecords, ["locked", "lockedCount", "lockedSources", "lockedVoiceSources"]);
  const candidateVoiceSourceCount = readFirstNumber(voiceRecords, ["candidate", "candidateCount", "candidateSources", "candidateVoiceSources"]);
  const rejectedVoiceSourceCount = readFirstNumber(voiceRecords, ["rejected", "rejectedCount", "rejectedSources", "rejectedVoiceSources"]);
  const voiceSourceDetail = [
    lockedVoiceSourceCount !== undefined ? `${lockedVoiceSourceCount} locked` : undefined,
    candidateVoiceSourceCount !== undefined ? `${candidateVoiceSourceCount} candidate` : undefined,
    rejectedVoiceSourceCount !== undefined ? `${rejectedVoiceSourceCount} rejected` : undefined,
  ].filter(Boolean).join(" · ") || `${voiceSourceCount} source(s)`;
  const audioPlanCount = readFirstNumber(audioRecords, [
    "audioPlanCount",
    "planCount",
    "shotPlanCount",
    "plans",
    "audioPlans",
    "shotPlans",
  ]) ?? runtimeState.audioPlanning.shotPlans.length;
  const previewMixCount = readFirstNumber(audioRecords, ["previewMixCount", "mixEventCount", "previewEvents", "events"])
    ?? runtimeState.audioPlanning.previewMix.eventCount;
  const audioPlanDetail = `${previewMixCount} preview mix item(s)`;
  const noBgmPolicy = readFirstBoolean(records, [
    "noBgmForVideoProvider",
    "noBgmInVideoProvider",
    "noBgmPolicy",
    "noBgm",
  ]) ?? runtimeState.audioPlanning.videoProviderPolicy.noBgmForVideoProvider;
  const noBgmDetail = readFirstString([policy, summary, rootRecord], ["policySummary", "noBgmSummary", "detail"], "")
    || (noBgmPolicy ? "music off for video provider" : "policy not asserted");
  const providerSlotsTotal = readFirstNumber(providerRecords, [
    "providerSlotsTotal",
    "totalProviderSlots",
    "providerSlotCount",
    "slotCount",
    "providerSlots",
    "slots",
  ]) ?? effectiveProviderSlots.length;
  const providerSlotsPlanned = readFirstNumber(providerRecords, [
    "providerSlotsPlanned",
    "plannedProviderSlots",
    "plannedSlots",
  ]) ?? effectiveProviderSlots.filter((slot) => providerSlotState(slot) === "planned").length;
  const providerSlotsLive = readFirstNumber(providerRecords, [
    "providerSlotsLive",
    "liveProviderSlots",
    "liveSlots",
    "providerLiveCount",
  ]) ?? effectiveProviderSlots.filter(providerSlotIsLive).length;
  const rawBlockersWarnings = [
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...readDisplayList(voice.blockers, "blocker"),
    ...readDisplayList(audio.blockers, "blocker"),
    ...readDisplayList(policy.blockers, "blocker"),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
    ...readDisplayList(voice.warnings, "warning"),
    ...readDisplayList(audio.warnings, "warning"),
    ...readDisplayList(policy.warnings, "warning"),
  ];
  const blockersWarnings = Array.from(new Set(rawBlockersWarnings.filter(Boolean)));
  const hardLocks = buildVoiceAudioHardLocks(rootRecord, summary, policy);

  return {
    initialized,
    phase,
    readiness: voiceAudioSettingsReadinessLabel(status, initialized, phase),
    voiceSourceCount,
    voiceSourceDetail,
    audioPlanCount,
    audioPlanDetail,
    noBgmPolicy,
    noBgmDetail,
    providerSlotsTotal,
    providerSlotsPlanned,
    providerSlotsLive,
    blockersWarnings: blockersWarnings.length ? blockersWarnings : initialized ? [] : ["blocked/missing runtimeState.voiceAudioSettings"],
    hardLocks: hardLocks.length ? hardLocks : [initialized ? "hard locks blocked/missing" : "blocked/missing runtimeState.voiceAudioSettings"],
  };
}

function localOrchestratorReadinessLabel(summary: {
  initialized: boolean;
  blocked: number;
  failed: number;
  needsReview: number;
  qaPending: number;
  stalled: number;
  runningPlanned: number;
  waitingOutput: number;
  ready: number;
  waiting: number;
  completeVerified: number;
  queueTotal: number;
}) {
  if (!summary.initialized) return "blocked/missing";
  if (summary.blocked > 0 || summary.failed > 0) return "blocked";
  if (summary.needsReview > 0) return "needs_review";
  if (summary.qaPending > 0 || summary.stalled > 0 || summary.runningPlanned > 0 || summary.waitingOutput > 0) return "waiting";
  if (summary.ready > 0) return "ready";
  if (summary.waiting > 0) return "waiting";
  if (summary.queueTotal > 0 && summary.completeVerified === summary.queueTotal) return "complete_verified";
  return "blocked/missing";
}

function buildLocalOrchestratorHardLocks(rootRecord: Record<string, unknown>, summary: Record<string, unknown>) {
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const explicitHardLocks = firstArrayFrom([rootRecord, summary, hardLocksRecord], ["hardLocks", "locks", "hardLockStrip"])
    .map((item, index) => formatHarnessValue(item, `hard lock ${index + 1}`))
    .filter(Boolean);
  const inferredLocks = [
    readBooleanLockLabel(hardLocksRecord, "dryRunOnly", "dry-run only", true),
    readBooleanLockLabel(hardLocksRecord, "planOnly", "plan-only", true),
    readBooleanLockLabel(hardLocksRecord, "noDaemon", "daemon locked", true),
    readBooleanLockLabel(hardLocksRecord, "daemonStarted", "daemon not started", false),
    readBooleanLockLabel(hardLocksRecord, "noSpawnAgent", "Agent spawn locked", true),
    readBooleanLockLabel(hardLocksRecord, "noSubprocess", "subprocess locked", true),
    readBooleanLockLabel(hardLocksRecord, "noShellExecution", "shell locked", true),
    readBooleanLockLabel(hardLocksRecord, "noProviderExecution", "provider execution locked", true),
    readBooleanLockLabel(hardLocksRecord, "providerSubmissionForbidden", "provider submit blocked", true),
    readBooleanLockLabel(hardLocksRecord, "liveSubmitAllowed", "live submit locked", false),
    readBooleanLockLabel(hardLocksRecord, "noFileMutation", "file mutation locked", true),
    readBooleanLockLabel(hardLocksRecord, "noCredentialRead", "credential read locked", true),
    readBooleanLockLabel(hardLocksRecord, "expectedOutputRequired", "expected output required", true),
    readBooleanLockLabel(hardLocksRecord, "manifestRequired", "manifest required", true),
    readBooleanLockLabel(hardLocksRecord, "qaGateRequired", "QA gate required", true),
    rootRecord.providerSubmissionForbidden === true || summary.providerSubmissionForbidden === true ? "provider submit blocked" : undefined,
    rootRecord.noFileMutation === true || summary.noFileMutation === true ? "file mutation locked" : undefined,
    rootRecord.daemonStarted === false || summary.daemonStarted === false ? "daemon not started" : undefined,
  ].filter((lock): lock is string => Boolean(lock));

  return Array.from(new Set([...explicitHardLocks, ...inferredLocks]));
}

export function buildLocalOrchestratorUiSummary(runtimeState: ProjectRuntimeState): LocalOrchestratorUiSummary {
  const root = (runtimeState as Partial<ProjectRuntimeState> & { localOrchestrator?: unknown }).localOrchestrator;
  const initialized = isRecord(root);
  const rootRecord = initialized ? root as Record<string, unknown> : {};
  const summary = initialized && isRecord(rootRecord.summary) ? rootRecord.summary : {};
  const autoContinuePlan = initialized && isRecord(rootRecord.autoContinuePlan) ? rootRecord.autoContinuePlan : {};
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const queue = Array.isArray(rootRecord.queue) ? rootRecord.queue : [];
  const queueRecords = queue.filter(isRecord);
  const records = [summary, rootRecord, autoContinuePlan, hardLocksRecord].filter(isRecord);
  const countByStatus = (status: string) => queueRecords.filter((item) => readString(item.queueStatus, "") === status).length;
  const queueTotal = readFirstNumber(records, ["totalItems", "queueTotal", "total"]) ?? queueRecords.length;
  const ready = readFirstNumber(records, ["ready"]) ?? countByStatus("ready");
  const waiting = readFirstNumber(records, ["waiting"]) ?? countByStatus("waiting");
  const runningPlanned = readFirstNumber(records, ["runningPlanned", "running_planned", "running"]) ?? countByStatus("running_planned");
  const waitingOutput = readFirstNumber(records, ["waitingOutput", "waiting_output"]) ?? countByStatus("waiting_output");
  const qaPending = readFirstNumber(records, ["qaPending", "qa_pending"]) ?? countByStatus("qa_pending");
  const needsReview = readFirstNumber(records, ["needsReview", "needs_review", "manualReviewRequired"]) ?? countByStatus("needs_review");
  const stalled = readFirstNumber(records, ["stalled"]) ?? queueRecords.filter((item) => {
    const activity = isRecord(item.agentActivity) ? item.agentActivity : {};
    return activity.stalled === true;
  }).length;
  const blocked = readFirstNumber(records, ["blocked"]) ?? countByStatus("blocked");
  const failed = readFirstNumber(records, ["failed"]) ?? countByStatus("failed");
  const completeVerified = readFirstNumber(records, ["completeVerified", "complete_verified"]) ?? countByStatus("complete_verified");
  const nextReadyIds = firstArrayFrom([autoContinuePlan, summary, rootRecord], ["nextReadyQueueItemIds", "nextReadyIds", "nextReady"]);
  const nextReadyCount = readFirstNumber([autoContinuePlan, summary, rootRecord].filter(isRecord), [
    "nextReadyCount",
    "autoContinueNextReadyCount",
  ]) ?? nextReadyIds.length;
  const autoContinueMode = readFirstString([autoContinuePlan, summary, rootRecord].filter(isRecord), [
    "mode",
    "autoContinueMode",
  ], "plan_only");
  const providerLocked = readFirstBoolean(records, ["providerSubmissionForbidden", "noProviderExecution"]) === true;
  const fileLocked = readFirstBoolean(records, ["noFileMutation"]) === true;
  const daemonLocked = readFirstBoolean(records, ["noDaemon"]) === true || readFirstBoolean(records, ["daemonStarted"]) === false;
  const blockersWarnings = Array.from(new Set([
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...queueRecords.flatMap((item) => readDisplayList(item.blockers, "blocker")),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
    ...queueRecords.flatMap((item) => readDisplayList(item.warnings, "warning")),
  ].filter(Boolean)));
  const hardLocks = buildLocalOrchestratorHardLocks(rootRecord, summary);
  const readinessFacts = {
    initialized,
    blocked,
    failed,
    needsReview,
    qaPending,
    stalled,
    runningPlanned,
    waitingOutput,
    ready,
    waiting,
    completeVerified,
    queueTotal,
  };

  return {
    initialized,
    readiness: localOrchestratorReadinessLabel(readinessFacts),
    queueTotal,
    ready,
    waiting,
    runningPlanned,
    waitingOutput,
    qaPending,
    needsReview,
    blocked,
    failed,
    stalled,
    completeVerified,
    nextReadyCount,
    autoContinueMode: autoContinueMode === "plan_only" ? "plan-only" : statusLabel(autoContinueMode),
    providerFileDaemonLocks: providerLocked && fileLocked && daemonLocked ? "provider/file/daemon locked" : "blocked/missing",
    blockersWarnings: blockersWarnings.length ? blockersWarnings : initialized ? [] : ["blocked/missing runtimeState.localOrchestrator"],
    hardLocks: hardLocks.length ? hardLocks : [initialized ? "hard locks blocked/missing" : "blocked/missing runtimeState.localOrchestrator"],
  };
}

export function buildVisualConsistencyContractUiSummary(runtimeState: ProjectRuntimeState): VisualConsistencyContractUiSummary {
  const root = runtimeState as unknown as Record<string, unknown>;
  const contractRoot = isRecord(root.visualConsistencyContract)
    ? root.visualConsistencyContract
    : isRecord(root.visualConsistency)
      ? root.visualConsistency
      : {};
  const initialized = isRecord(contractRoot);
  const rootRecord = initialized ? contractRoot : {};
  const gates = firstRecordFrom(rootRecord, ["gates"]);
  const summary = firstRecordFrom(rootRecord, ["summary"]);
  const geometry = firstRecordFrom(rootRecord, ["cameraGeometry", "sceneAssetPack"]);
  const shotLayout = firstRecordFrom(rootRecord, ["shotLayout"]);
  const keyframePair = firstRecordFrom(rootRecord, ["keyframePair", "keyframePairDerivation"]);
  const motionQa = firstRecordFrom(rootRecord, ["motionQa"]);
  const repairPolicy = firstRecordFrom(rootRecord, ["repairPolicy"]);
  const records = [gates, summary, rootRecord].filter(isRecord);
  const gateKeys = [
    "identityGateDefined",
    "sceneGateDefined",
    "shotLayoutGateDefined",
    "spatialMemoryGateDefined",
    "keyframePairDerivationGateDefined",
    "masterInheritanceQaGateDefined",
  ];
  const readyGateCount = gateKeys.filter((key) => readFirstBoolean(records, [key]) === true).length;
  const status = readFirstString(records, ["readiness", "status", "state"], "");
  const blockersWarnings = Array.from(new Set([
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
  ].filter(Boolean)));
  const cameraVectorReady = readFirstBoolean([gates, geometry, shotLayout].filter(isRecord), ["cameraVectorDefined"]) === true;
  const worldPositionReady = readFirstBoolean([gates, geometry].filter(isRecord), ["worldPositionDefined"]) === true;
  const shotLayoutPartsReady = ["shotLayoutSubjectDefined", "shotLayoutCameraDefined", "shotLayoutAxisDefined", "shotLayoutAnchorsDefined"]
    .every((key) => readFirstBoolean([gates, shotLayout].filter(isRecord), [key]) === true);
  const independentEndFrame = readFirstBoolean([keyframePair, rootRecord].filter(isRecord), [
    "independentSameShotEndFrameObserved",
    "independentSameShotEndFrame",
  ]) === true;
  const largeMotionDrift = readFirstBoolean([motionQa, rootRecord].filter(isRecord), [
    "largeMotionDriftObserved",
    "largeMotionDrift",
  ]) === true;
  const semanticRepair = readFirstBoolean([repairPolicy, rootRecord].filter(isRecord), [
    "semanticOpenCvRepairObserved",
    "opencvSemanticRepairObserved",
  ]) === true;

  return {
    initialized,
    readiness: initialized
      ? statusLabel(status || (readyGateCount === gateKeys.length && !blockersWarnings.length ? "ready" : "blocked"))
      : "blocked/missing",
    gateStatus: `${readyGateCount}/${gateKeys.length} typed gate(s)`,
    geometryStatus: cameraVectorReady && worldPositionReady ? "camera vector + world position present" : "camera vector/world position missing",
    shotLayoutStatus: shotLayoutPartsReady ? "subject/camera/axis/anchors present" : "shot layout incomplete",
    keyframePairStatus: independentEndFrame ? "independent same-shot end frame blocked" : "keyframe pair derivation tied",
    driftRepairStatus: largeMotionDrift || semanticRepair ? "motion drift or semantic OpenCV repair blocked" : "motion drift and repair policy clear",
    blockersWarnings: blockersWarnings.length ? blockersWarnings : initialized ? [] : ["blocked/missing visualConsistencyContract"],
    requiredGates: gateKeys,
  };
}

export function buildFullTaskSubagentPacketPlannerUiSummary(runtimeState: ProjectRuntimeState): FullTaskSubagentPacketPlannerUiSummary {
  const root = runtimeState as unknown as Record<string, unknown>;
  const plannerRoot = isRecord(root.fullTaskSubagentPacketPlanner)
    ? root.fullTaskSubagentPacketPlanner
    : isRecord(root.taskPacketPlanner)
      ? root.taskPacketPlanner
      : isRecord(root.subagentPacketPlanner)
        ? root.subagentPacketPlanner
        : {};
  const initialized = isRecord(plannerRoot);
  const rootRecord = initialized ? plannerRoot : {};
  const gates = firstRecordFrom(rootRecord, ["gates"]);
  const summary = firstRecordFrom(rootRecord, ["summary"]);
  const taskCoverage = firstRecordFrom(rootRecord, ["taskCoverage", "coverage"]);
  const packetPolicy = firstRecordFrom(rootRecord, ["packetPolicy", "validation"]);
  const outputContract = firstRecordFrom(rootRecord, ["outputContract", "expectedOutputs"]);
  const sourceFactTrace = firstRecordFrom(rootRecord, ["sourceFactTrace", "sourceFacts"]);
  const knowledgeTrace = firstRecordFrom(rootRecord, ["knowledgeTrace", "injectedKnowledge"]);
  const freeTextPolicy = firstRecordFrom(rootRecord, ["freeTextPolicy", "workerPolicy"]);
  const routeSafety = firstRecordFrom(rootRecord, ["routeSafety", "routes"]);
  const records = [gates, summary, rootRecord].filter(isRecord);
  const gateKeys = [
    "allProductionTaskKindsCovered",
    "validatedPacketsRequired",
    "expectedOutputsRequired",
    "sourceFactTraceRequired",
    "knowledgeTraceRequired",
    "freeTextWorkerForbidden",
  ];
  const readyGateCount = gateKeys.filter((key) => readFirstBoolean(records, [key]) === true).length;
  const status = readFirstString(records, ["readiness", "status", "state"], "");
  const coveredKinds = firstArrayFrom([taskCoverage, summary, rootRecord].filter(isRecord), [
    "coveredProductionTaskKinds",
    "productionTaskKinds",
    "taskKinds",
  ]).length;
  const missingKinds = firstArrayFrom([taskCoverage, summary, rootRecord].filter(isRecord), [
    "missingProductionTaskKinds",
    "missingTaskKinds",
  ]).length;
  const blockersWarnings = Array.from(new Set([
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
  ].filter(Boolean)));
  const unvalidatedPacket = readFirstBoolean([packetPolicy, rootRecord].filter(isRecord), [
    "unvalidatedPacketAllowed",
    "unvalidatedPacketObserved",
  ]) === true;
  const missingExpectedOutputs = readFirstBoolean([outputContract, rootRecord].filter(isRecord), [
    "missingExpectedOutputsAllowed",
    "missingExpectedOutputsObserved",
    "expectedOutputsMissing",
  ]) === true;
  const sourceTraceMissing = readFirstBoolean([sourceFactTrace, rootRecord].filter(isRecord), [
    "missingSourceFactTraceAllowed",
    "missingSourceFactTraceObserved",
    "sourceFactTraceMissing",
  ]) === true;
  const knowledgeTraceMissing = readFirstBoolean([knowledgeTrace, rootRecord].filter(isRecord), [
    "missingKnowledgeTraceAllowed",
    "missingKnowledgeTraceObserved",
    "knowledgeTraceMissing",
  ]) === true;
  const freeTextAllowed = readFirstBoolean([freeTextPolicy, rootRecord].filter(isRecord), [
    "freeTextWorkerAllowed",
    "freeTextTaskAllowed",
    "formalTaskAcceptsFreeText",
  ]) === true;
  const routeOpened = ["workerRouteOpened", "providerRouteOpened", "fileRouteOpened", "credentialRouteOpened", "shellRouteOpened"]
    .some((key) => readFirstBoolean([routeSafety, rootRecord].filter(isRecord), [key]) === true);

  return {
    initialized,
    readiness: initialized
      ? statusLabel(status || (readyGateCount === gateKeys.length && !blockersWarnings.length ? "ready" : "blocked"))
      : "blocked/missing",
    coverageStatus: missingKinds > 0
      ? `${missingKinds} missing task kind(s)`
      : coveredKinds > 0
        ? `${coveredKinds} task kind(s) covered`
        : `${readyGateCount}/${gateKeys.length} typed gate(s)`,
    packetStatus: unvalidatedPacket ? "unvalidated packet blocked" : "validated packet required",
    outputStatus: missingExpectedOutputs ? "expected outputs missing" : "expected outputs required",
    traceStatus: sourceTraceMissing || knowledgeTraceMissing ? "source fact trace / knowledge trace missing" : "source fact trace + knowledge trace required",
    freeTextStatus: freeTextAllowed ? "free-text worker/task allowed" : "free-text worker/task forbidden",
    routeStatus: routeOpened ? "worker/provider/file/credential/shell route open" : "worker/provider/file/credential/shell routes closed",
    blockersWarnings: blockersWarnings.length ? blockersWarnings : initialized ? [] : ["blocked/missing fullTaskSubagentPacketPlanner"],
    requiredGates: gateKeys,
  };
}

export function buildKnowledgePackUserManagementUiSummary(runtimeState: ProjectRuntimeState): KnowledgePackUserManagementUiSummary {
  const root = runtimeState as unknown as Record<string, unknown>;
  const managerRoot = isRecord(root.knowledgePackUserManagement)
    ? root.knowledgePackUserManagement
    : isRecord(root.knowledgePackManager)
      ? root.knowledgePackManager
      : {};
  const initialized = isRecord(managerRoot);
  const rootRecord = initialized ? managerRoot : {};
  const gates = firstRecordFrom(rootRecord, ["gates"]);
  const summary = firstRecordFrom(rootRecord, ["summary"]);
  const routeSafety = firstRecordFrom(rootRecord, ["routeSafety", "routes"]);
  const injectionPolicy = firstRecordFrom(rootRecord, ["injectionPolicy", "knowledgeInjection"]);
  const assetPromotion = firstRecordFrom(rootRecord, ["assetPromotion", "formalReferencePolicy"]);
  const records = [gates, summary, rootRecord].filter(isRecord);
  const requiredGates = [
    "userImportFlowReady",
    "userCreateFlowReady",
    "userEnableFlowReady",
    "userDisableFlowReady",
    "versionCheckReady",
    "hashCheckReady",
    "dependencyCheckReady",
    "routeTestReady",
    "conflictDetectionReady",
    "cannotOverrideHardGates",
  ];
  const readyGateCount = requiredGates.filter((key) => readFirstBoolean(records, [key]) === true).length;
  const status = readFirstString(records, ["readiness", "status", "state"], "");
  const blockersWarnings = Array.from(new Set([
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
  ].filter(Boolean)));
  const userFlowsReady = ["userImportFlowReady", "userCreateFlowReady", "userEnableFlowReady", "userDisableFlowReady"]
    .every((key) => readFirstBoolean(records, [key]) === true);
  const checksReady = ["versionCheckReady", "hashCheckReady", "dependencyCheckReady"]
    .every((key) => readFirstBoolean(records, [key]) === true);
  const routeConflictReady = readFirstBoolean(records, ["routeTestReady"]) === true &&
    readFirstBoolean(records, ["conflictDetectionReady"]) === true;
  const routeOpened = [
    "providerRouteOpened",
    "providerSubmitRouteOpened",
    "credentialRouteOpened",
    "shellRouteOpened",
    "fileRouteOpened",
    "freeTextRouteOpened",
  ].some((key) => readFirstBoolean([routeSafety, rootRecord].filter(isRecord), [key]) === true);
  const wholeLibraryInjection = readFirstBoolean([injectionPolicy, rootRecord].filter(isRecord), [
    "wholeLibraryInjectionObserved",
    "wholeLibraryInjectionAllowed",
  ]) === true;
  const unverifiedImportInjection = readFirstBoolean([injectionPolicy, rootRecord].filter(isRecord), [
    "unverifiedExternalImportInjectionObserved",
    "unverifiedExternalImportInjectionAllowed",
  ]) === true;
  const badPromotion = [
    "tempAssetFormalPromotionObserved",
    "rejectedAssetFormalPromotionObserved",
    "candidateAssetFormalPromotionObserved",
    "shotOutputFormalPromotionObserved",
  ].some((key) => readFirstBoolean([assetPromotion, rootRecord].filter(isRecord), [key]) === true);

  return {
    initialized,
    readiness: initialized
      ? statusLabel(status || (readyGateCount === requiredGates.length && !blockersWarnings.length ? "ready" : "blocked"))
      : "blocked/missing",
    userFlowStatus: userFlowsReady ? "import/create/enable/disable ready" : "user flows incomplete",
    checkStatus: checksReady ? "version/hash/dependency checks ready" : "version/hash/dependency checks missing",
    routeConflictStatus: routeOpened
      ? "provider/credential/shell/file/free-text route open"
      : routeConflictReady
        ? "route test + conflict detection ready"
        : "route test or conflict detection missing",
    overrideStatus: readFirstBoolean(records, ["cannotOverrideHardGates"]) === true
      ? "hard gate override forbidden"
      : "hard gate override guard missing",
    injectionStatus: wholeLibraryInjection || unverifiedImportInjection
      ? "library or unverified import injection blocked"
      : "scoped verified injection only",
    promotionStatus: badPromotion
      ? "informal asset promotion blocked"
      : "formal references stay gated",
    blockersWarnings: blockersWarnings.length ? blockersWarnings : initialized ? [] : ["blocked/missing knowledgePackUserManagement"],
    requiredGates,
  };
}

export function buildWorkerRuntimeGateUiSummary(runtimeState: ProjectRuntimeState): WorkerRuntimeGateUiSummary {
  const root = runtimeState as unknown as Record<string, unknown>;
  const gateRoot = isRecord(root.workerRuntimeGate) ? root.workerRuntimeGate : {};
  const initialized = isRecord(root.workerRuntimeGate);
  const rootRecord = initialized ? gateRoot : {};
  const gates = firstRecordFrom(rootRecord, ["gates"]);
  const summary = firstRecordFrom(rootRecord, ["summary"]);
  const observations = firstRecordFrom(rootRecord, ["observations"]);
  const runtimeGate = firstRecordFrom(rootRecord, ["runtimeGate", "executionPolicy"]);
  const records = [gates, summary, rootRecord].filter(isRecord);
  const observedRecords = [observations, runtimeGate, rootRecord].filter(isRecord);
  const requiredGates = [
    "workerRuntimeContractDefined",
    "defaultGatedOff",
    "validatedEnvelopeOnly",
    "structuredResultOnly",
    "noActualSpawnByDefault",
    "noDaemonByDefault",
    "noShellExecution",
    "noCredentialAccess",
    "noFileMutation",
    "noProviderSubmit",
    "noFreeTextWorker",
    "noAgentResumeByDefault",
  ];
  const readyGateCount = requiredGates.filter((key) => readFirstBoolean(records, [key]) === true).length;
  const status = readFirstString(records, ["readiness", "status", "state"], "");
  const blockersWarnings = Array.from(new Set([
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
  ].filter(Boolean)));
  const defaultOpened = readFirstBoolean(observedRecords, ["defaultGateOpened", "gateDefaultOn"]) === true;
  const inputRejected = readFirstBoolean(observedRecords, ["unvalidatedEnvelopeAccepted"]) === true;
  const outputRejected = readFirstBoolean(observedRecords, ["unstructuredResultAccepted"]) === true;
  const executionOpened = [
    "spawnAgentObserved",
    "agentResumeObserved",
    "daemonStarted",
    "subprocessObserved",
    "shellExecutionObserved",
    "providerSubmitObserved",
    "providerExecutionObserved",
    "liveSubmitObserved",
    "credentialReadObserved",
    "credentialWriteObserved",
    "credentialAccessObserved",
    "fileMutationObserved",
    "freeTextWorkerObserved",
    "freeTextTaskObserved",
  ].some((key) => readFirstBoolean(observedRecords, [key]) === true);
  const executionLocked = [
    "noActualSpawnByDefault",
    "noDaemonByDefault",
    "noShellExecution",
    "noCredentialAccess",
    "noFileMutation",
    "noProviderSubmit",
    "noFreeTextWorker",
    "noAgentResumeByDefault",
  ].every((key) => readFirstBoolean(records, [key]) === true);

  return {
    initialized,
    readiness: initialized
      ? statusLabel(status || (readyGateCount === requiredGates.length && !blockersWarnings.length ? "ready" : "blocked"))
      : "blocked/missing",
    contractStatus: readFirstBoolean(records, ["workerRuntimeContractDefined"]) === true ? "defined" : "missing",
    gateStatus: defaultOpened ? "opened" : readFirstBoolean(records, ["defaultGatedOff"]) === true ? "default off" : "missing",
    inputStatus: inputRejected ? "blocked" : readFirstBoolean(records, ["validatedEnvelopeOnly"]) === true ? "locked" : "missing",
    outputStatus: outputRejected ? "blocked" : readFirstBoolean(records, ["structuredResultOnly"]) === true ? "locked" : "missing",
    executionStatus: executionOpened ? "opened" : executionLocked ? "closed" : "missing",
    blockersWarnings: blockersWarnings.length ? blockersWarnings : initialized ? [] : ["blocked/missing workerRuntimeGate"],
    requiredGates,
  };
}

export function buildProviderClosedLoopShellUiSummary(runtimeState: ProjectRuntimeState): ProviderClosedLoopShellUiSummary {
  const root = runtimeState as unknown as Record<string, unknown>;
  const shellRoot = isRecord(root.providerClosedLoopShell) ? root.providerClosedLoopShell : {};
  const initialized = isRecord(root.providerClosedLoopShell);
  const rootRecord = initialized ? shellRoot : {};
  const gates = firstRecordFrom(rootRecord, ["gates"]);
  const summary = firstRecordFrom(rootRecord, ["summary"]);
  const observations = firstRecordFrom(rootRecord, ["observations"]);
  const providerShells = firstRecordFrom(rootRecord, ["providerShells"]);
  const providerCommitGate = firstRecordFrom(rootRecord, ["providerCommitGate"]);
  const executionPolicy = firstRecordFrom(rootRecord, ["executionPolicy"]);
  const records = [gates, summary, rootRecord].filter(isRecord);
  const observedRecords = [observations, providerShells, providerCommitGate, executionPolicy, rootRecord].filter(isRecord);
  const requiredGates = [
    "image2ClosedLoopShellDefined",
    "seedanceClosedLoopShellDefined",
    "watcherRequired",
    "manifestRequired",
    "qaGateRequired",
    "promotionGateRequired",
    "workerSelfReportCannotComplete",
    "providerCommitDefaultGated",
    "noActualProviderSubmit",
    "noLiveSubmit",
    "noCredentialAccess",
    "noFileMutation",
    "noWorkerSpawn",
    "noShellExecution",
    "forbiddenProviderModesAbsent",
  ];
  const readyGateCount = requiredGates.filter((key) => readFirstBoolean(records, [key]) === true).length;
  const status = readFirstString(records, ["readiness", "status", "state"], "");
  const blockersWarnings = Array.from(new Set([
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
  ].filter(Boolean)));
  const image2Ready = readFirstBoolean(records, ["image2ClosedLoopShellDefined"]) === true;
  const seedanceReady = readFirstBoolean(records, ["seedanceClosedLoopShellDefined"]) === true;
  const watcherReady = readFirstBoolean(records, ["watcherRequired"]) === true;
  const manifestReady = readFirstBoolean(records, ["manifestRequired"]) === true;
  const qaReady = readFirstBoolean(records, ["qaGateRequired"]) === true;
  const promotionReady = readFirstBoolean(records, ["promotionGateRequired"]) === true;
  const defaultOpened = readFirstBoolean(observedRecords, ["providerCommitDefaultOn", "defaultGateOpened", "gateDefaultOn"]) === true;
  const unsafeObserved = [
    "providerSubmitObserved",
    "providerExecutionObserved",
    "providerCommitObserved",
    "liveSubmitObserved",
    "credentialReadObserved",
    "credentialWriteObserved",
    "credentialAccessObserved",
    "apiKeyCreatedObserved",
    "workerSpawnObserved",
    "subprocessObserved",
    "shellExecutionObserved",
    "fileMutationObserved",
    "fastModelObserved",
    "vipChannelObserved",
    "textToVideoMainPathObserved",
    "bgmInVideoPromptObserved",
  ].some((key) => readFirstBoolean(observedRecords, [key]) === true);
  const safetyLocked = [
    "workerSelfReportCannotComplete",
    "providerCommitDefaultGated",
    "noActualProviderSubmit",
    "noLiveSubmit",
    "noCredentialAccess",
    "noFileMutation",
    "noWorkerSpawn",
    "noShellExecution",
    "forbiddenProviderModesAbsent",
  ].every((key) => readFirstBoolean(records, [key]) === true);

  return {
    initialized,
    readiness: initialized
      ? statusLabel(status || (readyGateCount === requiredGates.length && !blockersWarnings.length ? "ready" : "blocked"))
      : "blocked/missing",
    shellStatus: image2Ready && seedanceReady ? "Image2/Seedance defined" : "missing",
    watcherStatus: watcherReady ? "watcher required" : "missing",
    manifestStatus: manifestReady ? "manifest required" : "missing",
    qaStatus: qaReady ? "QA gate required" : "missing",
    promotionStatus: promotionReady ? "promotion gate required" : "missing",
    safetyStatus: defaultOpened || unsafeObserved ? "opened" : safetyLocked ? "closed" : "missing",
    blockersWarnings: blockersWarnings.length ? blockersWarnings : initialized ? [] : ["blocked/missing providerClosedLoopShell"],
    requiredGates,
  };
}

export function buildBetaAcceptanceUiSummary(runtimeState: ProjectRuntimeState): BetaAcceptanceUiSummary {
  const root = runtimeState as unknown as Record<string, unknown>;
  const acceptanceRoot = isRecord(root.betaAcceptance) ? root.betaAcceptance : {};
  const initialized = isRecord(root.betaAcceptance);
  const rootRecord = initialized ? acceptanceRoot : {};
  const gates = firstRecordFrom(rootRecord, ["gates"]);
  const summary = firstRecordFrom(rootRecord, ["summary"]);
  const observations = firstRecordFrom(rootRecord, ["observations"]);
  const betaClosure = firstRecordFrom(rootRecord, ["betaClosure", "roadmap"]);
  const executionPolicy = firstRecordFrom(rootRecord, ["executionPolicy", "workerPolicy", "providerPolicy"]);
  const closure = firstRecordFrom(rootRecord, ["closure"]);
  const hardLocks = firstRecordFrom(rootRecord, ["hardLocks"]);
  const areas = Array.isArray(rootRecord.areas) ? rootRecord.areas.filter(isRecord) : [];
  const records = [gates, summary, rootRecord].filter(isRecord);
  const observedRecords = [observations, betaClosure, executionPolicy, hardLocks, rootRecord].filter(isRecord);
  const areaByName = (area: string) => areas.find((item) => item.area === area);
  const areaAccepted = (area: string) => {
    const item = areaByName(area);
    return isRecord(item) && item.status === "accepted" && readDisplayList(item.blockers, "blocker").length === 0;
  };
  const areaChecked = (area: string, proofKey: string) => {
    const item = areaByName(area);
    const proof = isRecord(item?.proof) ? item.proof : {};
    return areaAccepted(area) && proof[proofKey] === true;
  };
  const gateReady = (key: string) => {
    const explicit = readFirstBoolean(records, [key]);
    if (explicit !== undefined) return explicit;
    if (key === "macDesktopReadiness") return areaAccepted("mac_desktop_readiness");
    if (key === "windowsDesktopReadiness") return areaAccepted("windows_desktop_readiness");
    if (key === "projectSaveOpen") return areaAccepted("project_save_open");
    if (key === "previewExport") return areaAccepted("preview_export");
    if (key === "queueVisibility") return areaAccepted("queue_visibility");
    if (key === "visualConsistency") return areaAccepted("visual_consistency");
    if (key === "knowledgePackManagement") return areaAccepted("knowledge_pack_management");
    if (key === "workerRuntimeGate" || key === "providerClosedLoopShell" || key === "providerGate") {
      return areaAccepted("worker_provider_gate");
    }
    if (key === "tests") return areaAccepted("test_matrix");
    if (key === "noAdditionalPhasesPlanned") return rootRecord.noAdditionalPhasesPlanned === true || closure.noAdditionalPhasesPlanned === true;
    if (key === "betaAcceptanceOwnsClosure") return rootRecord.betaAcceptanceOwnsClosure === true || closure.betaAcceptanceOwnsClosure === true;
    if (key === "finalPhaseNumberLocked") return rootRecord.finalPhaseNumber === 42 || closure.finalPhaseNumber === 42;
    return false;
  };
  const requiredGates = [
    "macDesktopReadiness",
    "windowsDesktopReadiness",
    "projectSaveOpen",
    "previewExport",
    "queueVisibility",
    "visualConsistency",
    "knowledgePackManagement",
    "workerRuntimeGate",
    "providerClosedLoopShell",
    "providerGate",
    "tests",
    "noAdditionalPhasesPlanned",
    "betaAcceptanceOwnsClosure",
    "finalPhaseNumberLocked",
  ];
  const readyGateCount = requiredGates.filter((key) => gateReady(key)).length;
  const status = readFirstString(records, ["readiness", "status", "state"], "");
  const blockersWarnings = Array.from(new Set([
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...areas.flatMap((area) => readDisplayList(area.blockers, "blocker").map((blocker) => `${area.area}:${blocker}`)),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
    ...areas.flatMap((area) => readDisplayList(area.warnings, "warning").map((warning) => `${area.area}:${warning}`)),
  ].filter(Boolean)));
  const desktopReady =
    gateReady("macDesktopReadiness") &&
    gateReady("windowsDesktopReadiness") &&
    !["macDesktopMissing", "windowsDesktopMissing"].some((key) => readFirstBoolean(observedRecords, [key]) === true);
  const projectExportReady =
    gateReady("projectSaveOpen") &&
    gateReady("previewExport") &&
    !["projectSaveOpenMissing", "previewExportMissing"].some((key) => readFirstBoolean(observedRecords, [key]) === true);
  const runtimeReady =
    gateReady("queueVisibility") &&
    gateReady("visualConsistency") &&
    gateReady("knowledgePackManagement") &&
    gateReady("workerRuntimeGate");
  const providerReady =
    gateReady("providerClosedLoopShell") &&
    gateReady("providerGate");
  const unsafeObserved = [
    "providerSubmitObserved",
    "liveSubmitObserved",
    "spawnAgentObserved",
    "workerSpawnObserved",
    "subprocessObserved",
    "shellExecutionObserved",
    "credentialReadObserved",
    "credentialWriteObserved",
    "credentialAccessObserved",
    "fileMutationObserved",
    "apiKeyCreatedObserved",
  ].some((key) => readFirstBoolean(observedRecords, [key]) === true);
  const closureReady =
    gateReady("noAdditionalPhasesPlanned") &&
    gateReady("betaAcceptanceOwnsClosure") &&
    gateReady("finalPhaseNumberLocked") &&
    !["additionalPhaseRequested", "phaseAfter42Observed", "finalPhaseNumberNot42"].some((key) =>
      readFirstBoolean(observedRecords, [key]) === true,
    );
  const testMatrixChecked = areaChecked("test_matrix", "packageScriptsChecked") ||
    readFirstBoolean(records, ["tests"]) === true;

  return {
    initialized,
    readiness: initialized
      ? statusLabel(status || (readyGateCount === requiredGates.length && !blockersWarnings.length ? "ready" : "blocked"))
      : "blocked/missing",
    desktopStatus: desktopReady ? "Mac/Windows readiness accepted" : "desktop readiness missing",
    projectExportStatus: projectExportReady ? "project save/open + preview/export accepted" : "project or export readiness missing",
    runtimeGateStatus: runtimeReady ? "queue/visual/knowledge/worker gates accepted" : "runtime gate missing",
    providerStatus: unsafeObserved ? "provider submit/credential/shell observation blocked" : providerReady ? "provider shell + gate accepted" : "provider gate missing",
    testStatus: gateReady("tests") && testMatrixChecked && readFirstBoolean(observedRecords, ["testsMissing"]) !== true
      ? "test matrix accepted"
      : "test matrix missing",
    closureStatus: closureReady ? "final phase locked at 42" : "closure freeze missing",
    blockersWarnings: blockersWarnings.length ? blockersWarnings : initialized ? [] : ["blocked/missing betaAcceptance"],
    requiredGates,
  };
}

export function buildRealPilotUiSummary(runtimeState: ProjectRuntimeState, selectedShot?: ShotRecord): RealPilotUiSummary {
  const gate = runtimeState.realExecutionGate;
  const ledger = runtimeState.executionLedger;
  const handoff = runtimeState.providerHandoffStatus;
  const realProviderExecutor = (runtimeState as ProjectRuntimeState & { realProviderExecutor?: unknown }).realProviderExecutor;
  const executorRecord = isRecord(realProviderExecutor) ? realProviderExecutor : {};
  const realProviderOneShotTest = (runtimeState as ProjectRuntimeState & { realProviderOneShotTest?: unknown }).realProviderOneShotTest;
  const oneShotRecord = isRecord(realProviderOneShotTest) ? realProviderOneShotTest : {};
  const executorSummary = firstRecordFrom(executorRecord, ["summary", "uiSummary", "statusSummary"]);
  const oneShotSummary = firstRecordFrom(oneShotRecord, ["summary", "uiSummary", "statusSummary"]);
  const oneShotActionReview = firstRecordFrom(oneShotRecord, ["actionReview", "actionTimeConfirmation", "confirmation"]);
  const oneShotOutput = firstRecordFrom(oneShotRecord, ["outputWatcherExpectation", "output", "watcher"]);
  const oneShotBudget = firstRecordFrom(oneShotRecord, ["budgetSnapshot", "budget", "budgetGuard"]);
  const confirmationRecord = firstRecordFrom(executorRecord, ["actionTimeConfirmation", "preExecutionConfirmation", "confirmation"]);
  const budgetRecord = firstRecordFrom(executorRecord, ["budget", "budgetLimit", "budgetCap", "quotaRisk", "quota"]);
  const outputRecord = firstRecordFrom(executorRecord, ["outputWatcher", "watcher", "output"]);
  const requestRecord = firstRecordFrom(executorRecord, ["requestPreview", "preview", "request"]);
  const budgetValue = readFirstString([budgetRecord, executorSummary, executorRecord], [
    "budgetLimit",
    "budgetCap",
    "quotaLimit",
    "limit",
    "display",
  ], "");
  const budgetRisk = readFirstString([budgetRecord, executorSummary, executorRecord], ["quotaRisk", "risk", "riskLevel"], "");
  const watcherState = readFirstString([outputRecord, executorSummary, executorRecord], [
    "watcherState",
    "outputWatcherState",
    "status",
    "state",
  ], "");
  const requestPreviewState = readFirstString([requestRecord, executorSummary, executorRecord], [
    "previewState",
    "requestPreviewState",
    "status",
    "state",
  ], "");
  const oneShotReady = readFirstBoolean([oneShotSummary, oneShotActionReview, oneShotRecord], [
    "readyForActionTimeConfirmation",
    "canAskUserForActionTimeConfirmation",
    "ready",
  ]) === true;
  const oneShotStatus = readFirstString([oneShotActionReview, oneShotSummary, oneShotRecord], ["status", "state"], "");
  const oneShotExpectedOutputCount = readFirstNumber([oneShotOutput, oneShotSummary, oneShotRecord], [
    "expectedOutputCount",
    "outputs",
    "expectedOutputs",
  ]);
  const oneShotBudgetImageCount = readFirstNumber([oneShotBudget, oneShotSummary, oneShotRecord], [
    "estimatedImageCount",
    "estimatedOutputCount",
    "imageCount",
  ]);
  const handoffStatus = handoff?.status;
  const confirmedOrReturned = handoffStatus === "waiting_file" || handoffStatus === "needs_review";
  const selectedShotIds = gate.selectedShotIds.length
    ? gate.selectedShotIds
    : selectedShot ? [selectedShot.id] : [];
  const selectedShots = selectedShotIds
    .map((id) => runtimeState.storyFlow.shots.find((shot) => shot.id === id) || (selectedShot?.id === id ? selectedShot : undefined))
    .filter((shot): shot is ShotRecord => Boolean(shot));
  const selectedShotDetail = selectedShotIds.length
    ? selectedShotIds.map(formatShotNumber).join(", ")
    : "从故事镜头中选择一小组";
  const selectedShotCount = selectedShotIds.length;
  const shotCount = Math.max(1, selectedShots.length);
  const startFrameCount = selectedShots.filter((shot) => Boolean(shot.startFrame)).length;
  const endFrameCount = selectedShots.filter((shot) => Boolean(shot.endFrame)).length;
  const scopedPlans = runtimeState.imagePipeline.imageTaskPlans.filter((plan) => selectedShotIds.includes(plan.shotId));
  const image2Plans = scopedPlans.filter((plan) =>
    plan.providerId.toLowerCase().includes("image2") ||
    ["image.generate", "image.edit", "image.reference_asset"].includes(plan.providerSlot),
  );
  const estimatedOutputCount = image2Plans.reduce((sum, plan) => {
    const envelopeOutputs = plan.taskEnvelopeSummary?.expectedOutputs.length || 0;
    return sum + Math.max(1, envelopeOutputs || (plan.expectedOutputPath ? 1 : 0));
  }, 0);
  const readyItems = gate.summary.readyForScopedRealTestReview;
  const blockedItems = gate.summary.blocked;
  const reviewStatus = !selectedShotCount
    ? "先选择镜头"
    : readyItems > 0 && blockedItems === 0
      ? "可审查"
      : "等待确认";

  return {
    reviewStatus,
    handoffLabel: handoff?.label || "等待确认",
    handoffDetail: handoff?.detail || "动作确认后继续。",
    handoffTone: handoff?.status || "waiting_confirmation",
    selectedShotCount,
    selectedShotDetail,
    framePairValue: selectedShotCount ? `${startFrameCount}/${shotCount} · 尾帧可选 ${endFrameCount}/${shotCount}` : "未选择",
    framePairDetail: selectedShotCount ? "默认首帧 + 动作提示；尾帧只用于明确终点模式" : "选择镜头后检查首帧准备状态",
    estimatedOutputCount,
    estimatedOutputDetail: estimatedOutputCount > 0 ? "Image2 小批量" : "选择后估算",
    outputRoot: (gate.outputSandbox.root || ledger.outputSandbox.root) ? "已设置" : "待选择",
    confirmationState: handoffStatus === "needs_review" ? "等待复核" : confirmedOrReturned ? "已确认" : "需要确认",
    image2State: "Image2 first",
    seedanceState: "Seedance 暂停/后续",
    preConfirmState: confirmedOrReturned ? "已确认" : "等待确认",
    preConfirmBudgetLimit: budgetValue
      ? `${statusLabel(budgetValue)}${budgetRisk ? ` · ${statusLabel(budgetRisk)}` : ""}`
      : "待复核",
    preConfirmOutputWatch: watcherState ? statusLabel(watcherState) : "待连接",
    preConfirmRequestPreview: requestPreviewState ? statusLabel(requestPreviewState) : "待复核",
    preConfirmScopeDetail: "1 个镜头小样 · 0 自动重试",
    oneShotStatus: handoffStatus === "needs_review"
      ? "需要复核"
      : handoffStatus === "waiting_file"
        ? "等待文件"
        : oneShotReady
          ? "单次待确认"
          : oneShotStatus === "blocked"
            ? "有阻断"
            : "未就绪",
    oneShotConfirmation: handoffStatus === "needs_review"
      ? "等待复核输出"
      : handoffStatus === "waiting_file"
        ? "已记录确认"
        : oneShotReady
          ? "动作确认待定"
          : "先完成复核",
    oneShotActionScope: "Image2 单镜头",
    oneShotOutputExpectation: typeof oneShotBudgetImageCount === "number"
      ? `${oneShotBudgetImageCount} 个预期输出`
      : typeof oneShotExpectedOutputCount === "number"
        ? `${Math.min(oneShotExpectedOutputCount, 2)} 个预期输出`
      : "等待输出计划",
    oneShotConfirmed: confirmedOrReturned,
    readyItems,
    blockedItems,
    ledgerEntries: ledger.summary.totalEntries,
    blockers: [...gate.items.flatMap((item) => item.blockers), ...ledger.scopeBlockers],
    warnings: gate.items.flatMap((item) => item.warnings),
  };
}

function exportWorkerReadinessLabel(status: string, blockersWarnings: string[], initialized: boolean) {
  if (!initialized) return "blocked/missing";
  const normalized = status.toLowerCase();
  if (normalized.includes("ready")) return "ready";
  if (normalized.includes("planned")) return "planned";
  if (normalized.includes("blocked") || normalized.includes("missing") || normalized.includes("fail")) return "blocked";
  return blockersWarnings.length ? "blocked" : "blocked/missing";
}

export function buildExportWorkerUiSummary(runtimeState: ProjectRuntimeState): ExportWorkerUiSummary {
  const root = (runtimeState as Partial<ProjectRuntimeState> & { exportWorker?: unknown }).exportWorker;
  const initialized = isRecord(root);
  const rootRecord = initialized ? root as Record<string, unknown> : {};
  const summary = initialized && isRecord(rootRecord.summary) ? rootRecord.summary : {};
  const scopeRecord = firstRecordFrom(rootRecord, ["ioScope", "exportIoScope", "projectIoScope", "scope", "ioContract", "projectIoContract"]);
  const writePlan = firstRecordFrom(rootRecord, ["writePlan", "plannedWritePlan", "mutationPlan", "exportPlan"]);
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockStrip"]);
  const readableRecords = [rootRecord, summary, scopeRecord, writePlan].filter(isRecord);
  const rawBlockersWarnings = [
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...readDisplayList(scopeRecord.blockers, "blocker"),
    ...readDisplayList(scopeRecord.blockedReasons, "blocker"),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
    ...readDisplayList(scopeRecord.warnings, "warning"),
  ];
  const blockersWarnings = Array.from(new Set(rawBlockersWarnings.filter(Boolean)));
  const status = readFirstString(readableRecords, ["readiness", "status", "state"], "");
  const entries = firstArrayFrom(readableRecords, ["entries"]);
  const plannedWrites = firstArrayFrom(readableRecords, ["plannedWrites", "writes", "writeIntents", "plannedMutations", "mutations"]);
  const effectivePlannedWrites = plannedWrites.length
    ? plannedWrites
    : entries.filter((entry) => isRecord(entry) && readString(entry.operation, "") === "write_file");
  const plannedWriteCount = readFirstNumber(readableRecords, [
    "plannedWriteCount",
    "plannedWritesCount",
    "writeCount",
    "mutationCount",
    "plannedMutationCount",
  ]) ?? effectivePlannedWrites.length;
  const exportRootValue = readFirstString(readableRecords, ["exportRoot", "exportRootPath", "root", "rootPath", "outputRoot"], "");
  const scope = readFirstString(readableRecords, [
    "scope",
    "scopeLabel",
    "ioScope",
    "exportIoScope",
    "projectIoScope",
    "writeScope",
    "allowedScope",
  ], "");
  const hardLocks = [
    readBooleanLockLabel(hardLocksRecord, "explicitIoScopeRequired", "explicit IO scope required", true),
    readBooleanLockLabel(hardLocksRecord, "projectIoContractRequired", "project IO contract required", true),
    readBooleanLockLabel(hardLocksRecord, "exportProjectIoScopeOnly", "export/project IO scope only", true),
    readBooleanLockLabel(hardLocksRecord, "outsideScopeBlocked", "outside scope blocked", true),
    readBooleanLockLabel(hardLocksRecord, "manifestMatchRequired", "manifest match required", true),
    readBooleanLockLabel(hardLocksRecord, "structuredResultRequired", "structured result required", true),
    readBooleanLockLabel(hardLocksRecord, "noProviderSubmit", "provider submit blocked", true),
    readBooleanLockLabel(hardLocksRecord, "providerSubmissionForbidden", "provider submit blocked", true),
    readBooleanLockLabel(hardLocksRecord, "liveSubmitAllowed", "live submit disabled", false),
    readBooleanLockLabel(hardLocksRecord, "noCredentialRead", "no credential read", true),
    readBooleanLockLabel(hardLocksRecord, "noCredentialWrite", "no credential write", true),
    readBooleanLockLabel(hardLocksRecord, "noArbitraryShell", "no shell execution", true),
    readBooleanLockLabel(hardLocksRecord, "arbitraryShellExecutionBlocked", "no shell execution", true),
    readBooleanLockLabel(hardLocksRecord, "projectRootRelativeOnly", "project root relative only", true),
    readBooleanLockLabel(hardLocksRecord, "exportScopeOnly", "export scope only", true),
    readBooleanLockLabel(hardLocksRecord, "noAbsolutePath", "absolute paths blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noParentTraversal", "parent traversal blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noDelete", "delete blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noMove", "move blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noMediaRender", "media render blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noUserFileOverwriteOutsideExport", "outside export overwrite blocked", true),
  ].filter((lock): lock is string => Boolean(lock));

  return {
    initialized,
    readiness: exportWorkerReadinessLabel(status, blockersWarnings, initialized),
    scope: scope ? statusLabel(scope) : "blocked/missing",
    plannedWriteCount,
    plannedWriteSamples: effectivePlannedWrites.slice(0, 4).map(formatPlannedWriteSample),
    exportRoot: compactPathLabel(exportRootValue),
    blockersWarnings: blockersWarnings.length ? blockersWarnings : [initialized ? "blocked/missing scope evidence" : "blocked/missing runtimeState.exportWorker"],
    hardLocks: Array.from(new Set(hardLocks.length ? hardLocks : ["hard locks blocked/missing"])),
  };
}

function phase26ReadinessLabel(status: string, proofLabel: string, providerSubmitObserved?: boolean) {
  const normalized = status.toLowerCase();
  if (normalized.includes("ready")) return "ready";
  if (normalized.includes("blocked") || normalized.includes("missing") || normalized.includes("fail")) return "blocked";
  return proofLabel === "present" && providerSubmitObserved !== true ? "ready" : "blocked";
}

export function buildAgentCliMockRunnerUiSummary(runtimeState: ProjectRuntimeState): AgentCliMockRunnerUiSummary {
  const root = (runtimeState as Partial<ProjectRuntimeState> & { agentCliMockRunner?: unknown }).agentCliMockRunner;
  const initialized = isRecord(root);
  const rootRecord = initialized ? root as Record<string, unknown> : {};
  const summary = initialized && isRecord(rootRecord.summary) ? rootRecord.summary : {};
  const hardLocksRecord = initialized && isRecord(rootRecord.hardLocks)
    ? rootRecord.hardLocks
    : initialized && isRecord(rootRecord.locks) ? rootRecord.locks : rootRecord;
  const proofValue = summary.replacementProof
    ?? rootRecord.replacementProof
    ?? summary.replacementProofReady
    ?? rootRecord.replacementProofReady
    ?? summary.replacementProofFromMockRunner
    ?? rootRecord.replacementProofFromMockRunner;
  const replacementProof = readReplacementProofLabel(proofValue);
  const status = readString(
    rootRecord.readiness,
    readString(summary.readiness, readString(rootRecord.status, readString(summary.status, ""))),
  );
  const providerSubmitObserved = readOptionalBoolean(summary, "providerSubmitObserved")
    ?? readOptionalBoolean(rootRecord, "providerSubmitObserved")
    ?? readOptionalBoolean(summary, "mockRunnerProviderSubmitObserved")
    ?? readOptionalBoolean(rootRecord, "mockRunnerProviderSubmitObserved");
  const readiness = !initialized
    ? "blocked/missing"
    : phase26ReadinessLabel(status, replacementProof, providerSubmitObserved);
  const rawNoopResults = summary.noopResults ?? summary.noOpResults ?? rootRecord.noopResults ?? rootRecord.noOpResults ?? rootRecord.results;
  const noopResultCount = readNumber(
    summary.noopResultCount,
    readNumber(
      summary.noOpResultCount,
      Array.isArray(rawNoopResults) ? rawNoopResults.length : readNumber(rootRecord.noopResultCount, 0),
    ),
  );
  const hardLocks = [
    readBooleanLockLabel(hardLocksRecord, "dryRunOnly", "dry-run only", true),
    readBooleanLockLabel(hardLocksRecord, "diagnosticsOnly", "diagnostics only", true),
    readBooleanLockLabel(hardLocksRecord, "noSpawnAgent", "no spawn", true),
    readBooleanLockLabel(hardLocksRecord, "noAgentSpawn", "Agent spawn disabled", true),
    readBooleanLockLabel(hardLocksRecord, "canSpawnAgent", "Agent spawn disabled", false),
    readBooleanLockLabel(hardLocksRecord, "noAgentResume", "Agent resume disabled", true),
    readBooleanLockLabel(hardLocksRecord, "canResumeAgent", "Agent resume disabled", false),
    readBooleanLockLabel(hardLocksRecord, "noSubprocess", "no subprocess", true),
    readBooleanLockLabel(hardLocksRecord, "noShellExecution", "no shell execution", true),
    readBooleanLockLabel(hardLocksRecord, "noProviderExecution", "no provider execution", true),
    readBooleanLockLabel(hardLocksRecord, "noProviderSubmit", "provider submit blocked", true),
    readBooleanLockLabel(hardLocksRecord, "canSubmitProvider", "provider submit blocked", false),
    readBooleanLockLabel(hardLocksRecord, "providerSubmissionForbidden", "provider submit blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noCredentialRead", "no credential read", true),
    readBooleanLockLabel(hardLocksRecord, "noCredentialWrite", "no credential write", true),
    readBooleanLockLabel(hardLocksRecord, "noFileMutation", "no file mutation", true),
    readBooleanLockLabel(hardLocksRecord, "liveSubmitAllowed", "live submit disabled", false),
    readBooleanLockLabel(hardLocksRecord, "structuredResultRequired", "structured result required", true),
    readBooleanLockLabel(hardLocksRecord, "mockOnly", "mock only", true),
  ].filter((lock): lock is string => Boolean(lock));

  return {
    initialized,
    runnerKind: readString(rootRecord.runnerKind, readString(summary.runnerKind, readString(rootRecord.kind, initialized ? "mock/no-op" : "missing"))),
    replacementProof,
    readiness,
    noopResultCount,
    hardLocks: Array.from(new Set(hardLocks.length ? hardLocks : ["runner state missing"])),
  };
}

function phase29ReadinessLabel(
  status: string,
  initialized: boolean,
  replacementProof: string,
  blockers: string[],
) {
  if (!initialized) return "blocked/missing";
  const normalized = status.toLowerCase();
  if (normalized.includes("ready")) return "ready";
  if (normalized.includes("planned")) return blockers.length ? "blocked" : "planned";
  if (normalized.includes("blocked") || normalized.includes("missing") || normalized.includes("fail")) return "blocked";
  return replacementProof === "present" && !blockers.length ? "planned" : "blocked";
}

function contractOnlyLabel(value: unknown) {
  const label = readString(value, "");
  if (/contract[-_\s]?only/i.test(label)) return "contract-only";
  if (/dry[-_\s]?run/i.test(label)) return "dry-run";
  if (/readonly|read[-_\s]?only/i.test(label)) return "read-only";
  return label ? statusLabel(label) : "contract-only";
}

function readContractInputSource(records: Record<string, unknown>[]) {
  const source = readFirstString(records, [
    "inputSource",
    "argumentSource",
    "envelopeSource",
    "inputContract",
  ], "");
  if (/validated.*envelope|validated_envelope_only|validated_subagent_task_envelope_only/i.test(source)) {
    return "validated envelope only";
  }
  return source ? statusLabel(source) : "validated envelope only";
}

export function buildCliAdapterSpikeUiSummary(runtimeState: ProjectRuntimeState): CliAdapterSpikeUiSummary {
  const root = (runtimeState as Partial<ProjectRuntimeState> & { cliAdapterSpike?: unknown }).cliAdapterSpike;
  const initialized = isRecord(root);
  const rootRecord = initialized ? root as Record<string, unknown> : {};
  const summary = initialized && isRecord(rootRecord.summary) ? rootRecord.summary : {};
  const inputContract = firstRecordFrom(rootRecord, ["inputContract"]);
  const resultContract = firstRecordFrom(rootRecord, ["resultContract"]);
  const executionPolicy = firstRecordFrom(rootRecord, ["executionPolicy"]);
  const roadmapEvidence = firstRecordFrom(rootRecord, ["roadmapEvidence"]);
  const contract = firstRecordFrom(rootRecord, ["contract", "adapterContract", "adapterBoundary", "boundary"]);
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockStrip"]);
  const records = [summary, contract, executionPolicy, inputContract, resultContract, roadmapEvidence, rootRecord].filter(isRecord);
  const phase26 = buildAgentCliMockRunnerUiSummary(runtimeState);
  const replacementProof = readReplacementProofLabel(
    summary.phase26ReplacementProof ??
    rootRecord.phase26ReplacementProof ??
    summary.replacementProof ??
    rootRecord.replacementProof ??
    summary.replacementProofReady ??
    rootRecord.replacementProofReady ??
    phase26.replacementProof,
  );
  const rawBlockers = [
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...readDisplayList(contract.blockers, "blocker"),
    ...readDisplayList(rootRecord.validation && isRecord(rootRecord.validation) ? rootRecord.validation.errors : undefined, "blocker"),
  ];
  const rawWarnings = [
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
    ...readDisplayList(contract.warnings, "warning"),
    ...readDisplayList(rootRecord.validation && isRecord(rootRecord.validation) ? rootRecord.validation.warnings : undefined, "warning"),
  ];
  const blockers = Array.from(new Set(rawBlockers.filter(Boolean)));
  const warnings = Array.from(new Set(rawWarnings.filter(Boolean)));
  const modeValue = summary.contractMode ?? rootRecord.contractMode ?? contract.mode ?? rootRecord.executionMode ?? summary.executionMode;
  const status = readFirstString(records, ["readiness", "status", "state"], "");
  const spawnExecuted = readFirstBoolean(records, ["spawnExecuted", "spawnAgentObserved", "spawnAgentObserved"]) === true;
  const resumeExecuted = readFirstBoolean(records, ["resumeExecuted", "resumeAgentObserved", "agentResumeObserved"]) === true;
  const spawnPlanned = readFirstBoolean(records, ["spawnShapePlanned", "canSpawnAgent", "spawnPlanned"]) !== false;
  const resumePlanned = readFirstBoolean(records, ["resumeShapePlanned", "canResumeAgent", "resumePlanned"]) !== false;
  const providerSubmitAllowed = readFirstBoolean(records, [
    "providerSubmitAllowed",
    "canSubmitProvider",
    "liveSubmitAllowed",
  ]) === true;
  const credentialReadAllowed = readFirstBoolean(records, ["credentialReadAllowed", "canReadCredentials"]) === true;
  const credentialWriteAllowed = readFirstBoolean(records, ["credentialWriteAllowed", "canWriteCredentials"]) === true;
  const shellAllowed = readFirstBoolean(records, ["shellAllowed", "canExecuteShell", "arbitraryShellAllowed"]) === true;
  const fileMutationAllowed = readFirstBoolean(records, ["fileMutationAllowed", "canMutateFiles"]) === true;
  const hardLocks = [
    readBooleanLockLabel(hardLocksRecord, "adapterContractOnly", "contract-only", true),
    readBooleanLockLabel(hardLocksRecord, "contractOnly", "contract-only", true),
    readBooleanLockLabel(hardLocksRecord, "dryRunOnly", "dry-run only", true),
    readBooleanLockLabel(hardLocksRecord, "validatedEnvelopeRequired", "validated envelope only", true),
    readBooleanLockLabel(hardLocksRecord, "structuredResultRequired", "structured result required", true),
    readBooleanLockLabel(hardLocksRecord, "spawnResumePlannedOnly", "spawn/resume planned only", true),
    readBooleanLockLabel(hardLocksRecord, "noActualAgentSpawn", "spawn disabled", true),
    readBooleanLockLabel(hardLocksRecord, "noActualAgentResume", "resume disabled", true),
    readBooleanLockLabel(hardLocksRecord, "noProviderSubmit", "provider submit blocked", true),
    readBooleanLockLabel(hardLocksRecord, "providerSubmissionForbidden", "provider submit blocked", true),
    readBooleanLockLabel(hardLocksRecord, "liveSubmitAllowed", "live submit disabled", false),
    readBooleanLockLabel(hardLocksRecord, "noCredentialAccess", "credential access blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noCredentialRead", "credential read blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noCredentialWrite", "credential write blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noShellExecution", "shell blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noArbitraryShell", "shell blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noFileMutation", "file mutation blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noFreeTextTask", "free text blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noFreeTextWorker", "free text blocked", true),
  ].filter((lock): lock is string => Boolean(lock));
  const inferredHardLocks = [
    "contract-only",
    "validated envelope only",
    "spawn/resume planned only",
    "provider submit blocked",
    "credential/shell/file mutation blocked",
    "free text blocked",
  ];

  return {
    initialized,
    readiness: phase29ReadinessLabel(status, initialized, replacementProof, blockers),
    contractMode: contractOnlyLabel(modeValue),
    replacementProof,
    inputSource: readContractInputSource(records),
    spawnResumeShape: spawnExecuted || resumeExecuted
      ? "execution observed"
      : spawnPlanned || resumePlanned ? "planned only / not executed" : "blocked/missing",
    providerSubmit: providerSubmitAllowed ? "open" : "blocked",
    mutationBoundary: credentialReadAllowed || credentialWriteAllowed || shellAllowed || fileMutationAllowed
      ? "open"
      : "credential/shell/file mutation blocked",
    blockers: blockers.length ? blockers : initialized ? [] : ["blocked/missing runtimeState.cliAdapterSpike"],
    warnings,
    hardLocks: Array.from(new Set(hardLocks.length ? hardLocks : inferredHardLocks)),
  };
}

function formatHarnessValue(value: unknown, fallbackLabel = "value"): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (!isRecord(value)) return "";

  const label = readString(
    value.label,
    readString(value.id, readString(value.name, fallbackLabel)),
  );
  const status = readString(value.status, readString(value.value, ""));
  const detail = readString(value.detail, readString(value.path, ""));
  return [label, status, detail].filter(Boolean).join(" / ");
}

function readDisplayList(value: unknown, fallbackLabel = "value") {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => formatHarnessValue(item, `${fallbackLabel}-${index + 1}`))
      .filter(Boolean);
  }
  const single = formatHarnessValue(value, fallbackLabel);
  return single ? [single] : [];
}

function readRuntimeExtension(runtimeState: ProjectRuntimeState, keys: string[]): Record<string, unknown> {
  const root = runtimeState as unknown as Record<string, unknown>;
  for (const key of keys) {
    if (isRecord(root[key])) return root[key];
  }

  const pipeline = isRecord(root.imagePipeline) ? root.imagePipeline : {};
  for (const key of keys) {
    if (isRecord(pipeline[key])) return pipeline[key];
  }

  return {};
}

function readCount(record: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return value.length;
  }
  return fallback;
}

function readCheckerFacts(value: unknown, fallback: CheckerFactRow[]) {
  if (!Array.isArray(value)) return fallback;
  const rows = value
    .map((item, index): CheckerFactRow | undefined => {
      const row = isRecord(item) ? item : {};
      const id = readString(row.id, readString(row.factId, `fact-${index + 1}`));
      const label = readString(row.label, readString(row.name, id));
      const status = readString(row.status, readString(row.healthStatus, "unknown"));
      const detail = readString(row.detail, readString(row.summary, readString(row.nextAction, "No fact detail reported.")));
      const sourceRefs = readStringArray(row.sourceRefs).length
        ? readStringArray(row.sourceRefs)
        : readStringArray(row.sources);
      return { id, label, status, detail, sourceRefs };
    })
    .filter((item): item is CheckerFactRow => Boolean(item));
  return rows.length ? rows : fallback;
}

export function getGenerationHealthChecker(runtimeState: ProjectRuntimeState): GenerationHealthCheckerState {
  const pipeline = getImagePipeline(runtimeState);
  const checker = readRuntimeExtension(runtimeState, [
    "generationHealthChecker",
    "generationHealthCheck",
    "generationHealthDiagnostics",
  ]);
  const summary = isRecord(checker.summary) ? checker.summary : checker;
  const reports = pipeline.generationHealthReports;
  const reportDerivedFacts = reports.slice(0, 5).map((report): CheckerFactRow => ({
    id: report.reportId,
    label: report.shotId || report.taskPlanId,
    status: report.healthStatus || "unknown",
    detail: [
      `manifest ${report.manifestStatus || "unknown"}`,
      `qa ${report.qaStatus || "unknown"}`,
      report.outputExists ? "output present" : "output missing",
      report.stalePrompt ? "stale prompt" : undefined,
    ].filter(Boolean).join(" · "),
    sourceRefs: [report.taskPlanId, report.jobId].filter(Boolean),
  }));
  const factSource = checker.factChainSummary ?? checker.factChain ?? checker.facts ?? checker.factRows;
  const postprocessRecoverableFallback = reports.filter((report) => (
    report.healthStatus === "failed" ||
    report.warnings.some((warning) => warning.toLowerCase().includes("recoverable")) ||
    report.blockers.some((blocker) => blocker.toLowerCase().includes("postprocess"))
  )).length;
  const workerMismatchFallback = reports.filter((report) => (
    report.warnings.some((warning) => warning.toLowerCase().includes("worker") && warning.toLowerCase().includes("mismatch")) ||
    report.blockers.some((blocker) => blocker.toLowerCase().includes("worker") && blocker.toLowerCase().includes("mismatch"))
  )).length;
  const qaMissingFallback = reports.filter((report) => report.qaStatus === "missing" || report.qaStatus === "unknown").length;

  return {
    initialized: Object.keys(checker).length > 0 || reports.length > 0,
    reportCount: readCount(summary, ["reportCount", "totalReports", "total"], reports.length),
    factChainSummary: readCheckerFacts(factSource, reportDerivedFacts),
    postprocessRecoverable: readCount(summary, ["postprocessRecoverable", "postprocess_recoverable", "recoverablePostprocess"], postprocessRecoverableFallback),
    workerSelfReportMismatch: readCount(summary, ["workerSelfReportMismatch", "worker_self_report_mismatch", "selfReportMismatch"], workerMismatchFallback),
    qaCoverageMissing: readCount(summary, ["qaCoverageMissing", "qa_coverage_missing", "missingQaCoverage"], qaMissingFallback),
    blockers: readStringArray(checker.blockers),
    warnings: readStringArray(checker.warnings),
  };
}

export function getPromptConflictChecker(runtimeState: ProjectRuntimeState): PromptConflictCheckerState {
  const pipeline = getImagePipeline(runtimeState);
  const checker = readRuntimeExtension(runtimeState, [
    "promptConflictChecker",
    "promptConflictCheck",
    "promptConflictDiagnostics",
  ]);
  const summary = isRecord(checker.summary) ? checker.summary : checker;
  const reports = pipeline.promptConflictReports;
  const conflicts = reports.flatMap((report) => report.conflicts || []);
  const blockingFallback = conflicts.filter((conflict) => conflict.severity === "blocker").length;
  const needsRecompileReports = reports.filter((report) => {
    const raw = report as unknown as Record<string, unknown>;
    return readBoolean(raw.needsRecompile, false) ||
      readBoolean(raw.needs_recompile, false) ||
      report.conflicts.some((conflict) => conflict.code.toLowerCase().includes("recompile"));
  }).length;
  const sourceCandidates = [
    checker.structuredSourcesToUpdate,
    checker.structured_sources_to_update,
    checker.sourcesToUpdate,
    summary.structuredSourcesToUpdate,
    summary.structured_sources_to_update,
  ];
  const structuredSourcesToUpdate = sourceCandidates.reduce<string[]>((acc, value) => (
    acc.length ? acc : readDisplayList(value, "source")
  ), []);

  return {
    initialized: Object.keys(checker).length > 0 || reports.length > 0,
    reportCount: readCount(summary, ["reportCount", "totalReports", "total"], reports.length),
    conflictCount: readCount(summary, ["conflictCount", "totalConflicts", "conflicts"], conflicts.length),
    blockingConflicts: readCount(summary, ["blockingConflicts", "blocking_conflicts", "blockers"], blockingFallback),
    needsRecompile: readCount(summary, ["needsRecompile", "needs_recompile", "recompileNeeded"], needsRecompileReports),
    structuredSourcesToUpdate,
    blockers: readStringArray(checker.blockers),
    warnings: readStringArray(checker.warnings),
  };
}

function normalizeGenerationStage(value: unknown, index: number): GenerationHarnessStage {
  const stage = isRecord(value) ? value : {};
  const blockers = readStringArray(stage.blockers);
  const warnings = readStringArray(stage.warnings);
  const sourceRefs = readStringArray(stage.sourceRefs);
  const stageId = readString(stage.stageId, readString(stage.id, `stage-${index + 1}`));
  return {
    id: stageId,
    label: readString(stage.label, stageId),
    status: readString(stage.status, "unknown"),
    detail: typeof stage.detail === "string"
      ? stage.detail
      : `${sourceRefs.length} refs · ${blockers.length} blockers · ${warnings.length} warnings`,
  };
}

function normalizeCandidateOutput(value: unknown): GenerationHarnessCandidateOutput {
  const output = isRecord(value) ? value : {};
  return {
    status: readString(output.status, "not_reported"),
    candidatePath: typeof output.candidatePath === "string" ? output.candidatePath : undefined,
    formalPath: typeof output.formalPath === "string" ? output.formalPath : undefined,
    expectedOutputPath: typeof output.expectedOutputPath === "string" ? output.expectedOutputPath : undefined,
    manifestStatus: typeof output.manifestStatus === "string" ? output.manifestStatus : undefined,
    healthStatus: typeof output.healthStatus === "string" ? output.healthStatus : undefined,
    qaStatus: typeof output.qaStatus === "string" ? output.qaStatus : undefined,
    canPromoteToFormal: readBoolean(output.canPromoteToFormal, false),
  };
}

function normalizeGenerationJob(value: unknown, index: number): GenerationHarnessJob {
  const job = isRecord(value) ? value : {};
  const stages = Array.isArray(job.stages) ? job.stages.map(normalizeGenerationStage) : [];
  const candidateOutput = normalizeCandidateOutput(job.candidateOutput);
  const blockingReasons = readStringArray(job.blockingReasons).length
    ? readStringArray(job.blockingReasons)
    : readStringArray(job.blockers);
  const postprocessPolicy = isRecord(job.postprocessPolicy)
    ? `semantic repair ${job.postprocessPolicy.semanticRepairAllowed === false ? "locked" : "open"}`
    : typeof job.postprocessPolicy === "string" ? job.postprocessPolicy : undefined;
  return {
    jobId: readString(job.jobId, `job-${index + 1}`),
    shotId: readString(job.shotId, "unassigned-shot"),
    taskPlanId: typeof job.taskPlanId === "string" ? job.taskPlanId : undefined,
    providerSlot: readString(job.providerSlot, "provider.unassigned"),
    chainStatus: readString(job.chainStatus, candidateOutput.status),
    blockingReasons,
    stages,
    candidateOutput,
    postprocessPolicy,
    forbiddenActions: readStringArray(job.forbiddenActions),
    dryRunOnly: readBoolean(job.dryRunOnly, false),
    providerSubmissionForbidden: readBoolean(job.providerSubmissionForbidden, false),
    liveSubmitAllowed: readBoolean(job.liveSubmitAllowed, false),
  };
}

export function getGenerationHarness(runtimeState: ProjectRuntimeState): GenerationHarnessState {
  const harness = (runtimeState as Partial<ProjectRuntimeState> & { generationHarness?: unknown }).generationHarness;
  const initialized = isRecord(harness);
  const harnessRecord: Record<string, unknown> = initialized ? harness as unknown as Record<string, unknown> : {};
  const jobs = initialized && Array.isArray(harness.jobs) ? harness.jobs.map(normalizeGenerationJob) : [];
  const summary: Record<string, unknown> = initialized && isRecord(harness.summary) ? harness.summary : {};

  return {
    initialized,
    jobs,
    summary: {
      totalJobs: readNumber(summary.totalJobs, readNumber(summary.total, jobs.length)),
      blockedJobs: readNumber(summary.blockedJobs, readNumber(summary.blocked, jobs.filter((job) => job.blockingReasons.length > 0 || job.chainStatus.includes("blocked")).length)),
      readyJobs: readNumber(summary.readyJobs, jobs.filter((job) => job.chainStatus === "candidate" || job.chainStatus === "formal_ready").length),
      waitingForOutputJobs: readNumber(summary.waitingForOutputJobs, readNumber(summary.waiting, jobs.filter((job) => job.chainStatus.includes("missing") || job.chainStatus.includes("waiting")).length)),
      qaPendingJobs: readNumber(summary.qaPendingJobs, readNumber(summary.qaPending, jobs.filter((job) => job.candidateOutput.qaStatus === "pending" || job.candidateOutput.status.includes("qa")).length)),
      formalReadyJobs: readNumber(summary.formalReadyJobs, readNumber(summary.formalReady, jobs.filter((job) => job.candidateOutput.canPromoteToFormal).length)),
      dryRunOnly: readBoolean(harnessRecord.dryRunOnly, jobs.some((job) => job.dryRunOnly)),
      providerSubmissionForbidden: readBoolean(harnessRecord.providerSubmissionForbidden, jobs.some((job) => job.providerSubmissionForbidden)),
    },
  };
}

function normalizeFilesystemWatcherRoot(value: unknown, index: number): FilesystemWatcherRoot {
  const root = isRecord(value) ? value : {};
  const id = readString(root.id, readString(root.rootId, `root-${index + 1}`));
  const pathHints = readStringArray(root.pathHints);
  return {
    id,
    label: readString(root.label, id),
    kind: readString(root.kind, "unknown"),
    status: readString(root.status, root.daemonStarted === false ? "derived only" : "unknown"),
    pathHint: typeof root.pathHint === "string" ? root.pathHint : pathHints[0],
    notes: readNoteList(root.notes),
  };
}

function normalizeFilesystemWatcherStream(value: unknown, index: number): FilesystemWatcherStream {
  const stream = isRecord(value) ? value : {};
  const blockingReasons = readStringArray(stream.blockingReasons).length
    ? readStringArray(stream.blockingReasons)
    : readStringArray(stream.blockers);
  return {
    streamId: readString(stream.streamId, `stream-${index + 1}`),
    taskPlanId: typeof stream.taskPlanId === "string" ? stream.taskPlanId : undefined,
    jobId: typeof stream.jobId === "string" ? stream.jobId : undefined,
    shotId: typeof stream.shotId === "string" ? stream.shotId : undefined,
    harnessJobId: typeof stream.harnessJobId === "string"
      ? stream.harnessJobId
      : typeof stream.generationHarnessJobId === "string" ? stream.generationHarnessJobId : undefined,
    eventType: readString(stream.eventType, "unknown"),
    status: readString(stream.status, readString(stream.harnessLinkStatus, "unknown")),
    severity: readString(stream.severity, stream.draftOnly === true ? "warning" : "info"),
    artifactClass: readString(stream.artifactClass, "unknown"),
    artifactPath: typeof stream.artifactPath === "string" ? stream.artifactPath : undefined,
    expectedOutputPath: typeof stream.expectedOutputPath === "string" ? stream.expectedOutputPath : undefined,
    draftOnly: readOptionalBoolean(stream, "draftOnly"),
    canPromoteFormal: readOptionalBoolean(stream, "canPromoteFormal"),
    canBecomeFutureReference: readOptionalBoolean(stream, "canBecomeFutureReference"),
    requiresManifestMatch: readOptionalBoolean(stream, "requiresManifestMatch"),
    requiresQaPass: readOptionalBoolean(stream, "requiresQaPass"),
    blockingReasons,
    notes: readNoteList(stream.notes),
  };
}

export function getFilesystemWatcherHarness(runtimeState: ProjectRuntimeState): FilesystemWatcherHarnessState {
  const harness = (runtimeState as Partial<ProjectRuntimeState> & { filesystemWatcherHarness?: unknown }).filesystemWatcherHarness;
  const initialized = isRecord(harness);
  const harnessRecord = initialized ? harness as Record<string, unknown> : {};
  const summaryRecord = initialized && isRecord(harnessRecord.summary) ? harnessRecord.summary : {};
  const locksRecord = initialized && isRecord(harnessRecord.locks)
    ? harnessRecord.locks
    : initialized && isRecord(harnessRecord.hardLocks) ? harnessRecord.hardLocks : {};
  const hasMonitoredRoots = initialized && Array.isArray(harnessRecord.monitoredRoots);
  const hasStreams = initialized && Array.isArray(harnessRecord.streams);

  return {
    initialized,
    hasSummary: initialized && isRecord(harnessRecord.summary),
    hasMonitoredRoots,
    hasStreams,
    hasLocks: initialized && isRecord(harnessRecord.locks),
    summary: {
      totalEvents: readOptionalNumber(summaryRecord, "totalEvents") ?? readOptionalNumber(summaryRecord, "totalStreams"),
      tempCandidates: readOptionalNumber(summaryRecord, "tempCandidates"),
      expectedOutputs: readOptionalNumber(summaryRecord, "expectedOutputs"),
      qaReports: readOptionalNumber(summaryRecord, "qaReports"),
      manifestMismatches: readOptionalNumber(summaryRecord, "manifestMismatches"),
      blockedEvents: readOptionalNumber(summaryRecord, "blockedEvents"),
      draftOnlyArtifacts: readOptionalNumber(summaryRecord, "draftOnlyArtifacts") ?? readOptionalNumber(summaryRecord, "draftOnly"),
      promotableArtifacts: readOptionalNumber(summaryRecord, "promotableArtifacts") ?? readOptionalNumber(summaryRecord, "promotableFormal"),
      linkedHarnessJobs: readOptionalNumber(summaryRecord, "linkedHarnessJobs") ??
        (readOptionalNumber(summaryRecord, "totalStreams") !== undefined && readOptionalNumber(summaryRecord, "missingHarnessLinks") !== undefined
          ? Number(readOptionalNumber(summaryRecord, "totalStreams")) - Number(readOptionalNumber(summaryRecord, "missingHarnessLinks"))
          : undefined),
      missingHarnessLinks: readOptionalNumber(summaryRecord, "missingHarnessLinks"),
      liveSubmitAllowed: readOptionalBoolean(summaryRecord, "liveSubmitAllowed"),
      providerSubmissionForbidden: readOptionalBoolean(summaryRecord, "providerSubmissionForbidden"),
    },
    monitoredRoots: hasMonitoredRoots ? (harnessRecord.monitoredRoots as unknown[]).map(normalizeFilesystemWatcherRoot) : [],
    streams: hasStreams ? (harnessRecord.streams as unknown[]).map(normalizeFilesystemWatcherStream) : [],
    locks: {
      watcherCannotPromoteFormal: readOptionalBoolean(locksRecord, "watcherCannotPromoteFormal"),
      workerSelfReportCannotComplete: readOptionalBoolean(locksRecord, "workerSelfReportCannotComplete"),
      tempOutputDraftOnly: readOptionalBoolean(locksRecord, "tempOutputDraftOnly"),
      semanticPostprocessForbidden: readOptionalBoolean(locksRecord, "semanticPostprocessForbidden"),
      liveSubmitAllowed: readOptionalBoolean(locksRecord, "liveSubmitAllowed"),
      providerSubmissionForbidden: readOptionalBoolean(locksRecord, "providerSubmissionForbidden"),
    },
  };
}

function normalizeCheckpointResumeItem(value: unknown, index: number): CheckpointResumeItem {
  const item = isRecord(value) ? value : {};
  return {
    resumeItemId: readString(item.resumeItemId, "Not initialized"),
    taskPlanId: typeof item.taskPlanId === "string" ? item.taskPlanId : undefined,
    jobId: typeof item.jobId === "string" ? item.jobId : undefined,
    shotId: typeof item.shotId === "string" ? item.shotId : undefined,
    generationHarnessJobId: typeof item.generationHarnessJobId === "string"
      ? item.generationHarnessJobId
      : typeof item.harnessJobId === "string" ? item.harnessJobId : undefined,
    expectedOutputPath: typeof item.expectedOutputPath === "string" ? item.expectedOutputPath : undefined,
    candidatePath: typeof item.candidatePath === "string" ? item.candidatePath : undefined,
    formalPath: typeof item.formalPath === "string" ? item.formalPath : undefined,
    manifestStatus: typeof item.manifestStatus === "string" ? item.manifestStatus : undefined,
    healthStatus: typeof item.healthStatus === "string" ? item.healthStatus : undefined,
    qaStatus: typeof item.qaStatus === "string" ? item.qaStatus : undefined,
    watcherStreamIds: readStringArray(item.watcherStreamIds),
    hasWatcherStreamIds: Array.isArray(item.watcherStreamIds),
    resumeStatus: typeof item.resumeStatus === "string" ? item.resumeStatus : undefined,
    resumeDecision: typeof item.resumeDecision === "string" ? item.resumeDecision : undefined,
    skipAllowed: readOptionalBoolean(item, "skipAllowed"),
    rerunAllowed: readOptionalBoolean(item, "rerunAllowed"),
    manualReviewRequired: readOptionalBoolean(item, "manualReviewRequired"),
    blockingReasons: readStringArray(item.blockingReasons),
    hasBlockingReasons: Array.isArray(item.blockingReasons),
    notes: readNoteList(item.notes),
  };
}

export function getCheckpointResumeHarness(runtimeState: ProjectRuntimeState): CheckpointResumeHarnessState {
  const harness = (runtimeState as Partial<ProjectRuntimeState> & { checkpointResumeHarness?: unknown }).checkpointResumeHarness;
  const initialized = isRecord(harness);
  const harnessRecord = initialized ? harness as Record<string, unknown> : {};
  const summaryRecord = initialized && isRecord(harnessRecord.summary) ? harnessRecord.summary : {};
  const hardLocksRecord = initialized && isRecord(harnessRecord.hardLocks) ? harnessRecord.hardLocks : {};
  const rawItems = Array.isArray(harnessRecord.resumeItems)
    ? harnessRecord.resumeItems
    : Array.isArray(harnessRecord.items) ? harnessRecord.items : undefined;
  const hasResumeItems = initialized && Array.isArray(rawItems);

  return {
    initialized,
    hasSummary: initialized && isRecord(harnessRecord.summary),
    hasHardLocks: initialized && isRecord(harnessRecord.hardLocks),
    hasResumeItems,
    summary: {
      totalItems: readOptionalNumber(summaryRecord, "totalItems"),
      skipAllowed: readOptionalNumber(summaryRecord, "skipAllowed"),
      rerunAllowed: readOptionalNumber(summaryRecord, "rerunAllowed"),
      manualReviewRequired: readOptionalNumber(summaryRecord, "manualReviewRequired"),
      blocked: readOptionalNumber(summaryRecord, "blocked"),
      missingExpectedOutput: readOptionalNumber(summaryRecord, "missingExpectedOutput"),
      formalReady: readOptionalNumber(summaryRecord, "formalReady") ?? readOptionalNumber(summaryRecord, "skipAllowed"),
      tempCandidateBlocked: readOptionalNumber(summaryRecord, "tempCandidateBlocked"),
      liveSubmitAllowed: readOptionalBoolean(summaryRecord, "liveSubmitAllowed"),
      providerSubmissionForbidden: readOptionalBoolean(summaryRecord, "providerSubmissionForbidden"),
    },
    hardLocks: {
      dryRunOnly: readOptionalBoolean(hardLocksRecord, "dryRunOnly"),
      providerSubmissionForbidden: readOptionalBoolean(hardLocksRecord, "providerSubmissionForbidden"),
      liveSubmitAllowed: readOptionalBoolean(hardLocksRecord, "liveSubmitAllowed"),
      noFileMutation: readOptionalBoolean(hardLocksRecord, "noFileMutation"),
      noAutoSkipWithoutQa: readOptionalBoolean(hardLocksRecord, "noAutoSkipWithoutQa"),
      workerSelfReportCannotComplete: readOptionalBoolean(hardLocksRecord, "workerSelfReportCannotComplete"),
      tempCandidateCannotResumeAsFormal: readOptionalBoolean(hardLocksRecord, "tempCandidateCannotResumeAsFormal"),
    },
    resumeItems: hasResumeItems ? (rawItems as unknown[]).map(normalizeCheckpointResumeItem) : [],
  };
}

const qaHarnessDimensionLabels: Record<QaHarnessDimension, string> = {
  whole_film: "同片感",
  identity: "identity",
  scene: "scene",
  pair: "pair",
  story: "story",
  prop: "prop",
  style: "style",
  motion: "motion",
  audio: "audio",
};

function qaDimensionLabel(dimension: string) {
  return (qaHarnessDimensions as readonly string[]).includes(dimension)
    ? qaHarnessDimensionLabels[dimension as QaHarnessDimension]
    : dimension;
}

function normalizeQaGateRow(value: unknown, index: number, fallbackDimension?: string): QaGateRow {
  const gate = isRecord(value) ? value : {};
  const dimension = readString(gate.dimension, readString(gate.dimensionId, fallbackDimension || `dimension-${index + 1}`));
  const blockers = readStringArray(gate.blockers).length
    ? readStringArray(gate.blockers)
    : readStringArray(gate.blockingReasons);
  return {
    dimension,
    label: readString(gate.label, qaDimensionLabel(dimension)),
    status: readString(gate.status, "Not initialized"),
    severity: readString(gate.severity, "unknown"),
    blockers,
    warnings: readStringArray(gate.warnings),
    sourceRefs: readStringArray(gate.sourceRefs).length
      ? readStringArray(gate.sourceRefs)
      : readStringArray(gate.refs),
    notes: readNoteList(gate.notes),
    initialized: isRecord(value),
  };
}

function normalizeQaGateRows(value: unknown): QaGateRow[] {
  if (Array.isArray(value)) return value.map((row, index) => normalizeQaGateRow(row, index));
  if (!isRecord(value)) return [];
  return Object.entries(value).map(([dimension, row], index) => normalizeQaGateRow(row, index, dimension));
}

function normalizeQaOverallRows(value: unknown): QaGateRow[] {
  const overall = isRecord(value) && Array.isArray(value.dimensions) ? value.dimensions : value;
  const rows = normalizeQaGateRows(overall);
  return qaHarnessDimensions.map((dimension, index) =>
    rows.find((row) => row.dimension === dimension) || normalizeQaGateRow(undefined, index, dimension),
  );
}

function summarizeQaCoverageEntry(value: unknown, index: number, fallbackLabel?: string) {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return `${fallbackLabel || `source-${index + 1}`}: ${String(value)}`;
  }
  if (!isRecord(value)) return "";

  const label = readString(
    value.label,
    readString(
      value.layer,
      readString(value.dimension, readString(value.dimensionId, readString(value.sourceId, readString(value.id, fallbackLabel || `source-${index + 1}`)))),
    ),
  );
  const status = readString(
    value.status,
    readString(value.coverageStatus, typeof value.referenced === "boolean" ? (value.referenced ? "referenced" : "missing") : "unknown"),
  );
  const refs = readStringArray(value.sourceRefs).length
    ? readStringArray(value.sourceRefs)
    : readStringArray(value.refs);
  const missingFacts = readStringArray(value.missingFacts).length
    ? readStringArray(value.missingFacts)
    : readStringArray(value.missingFactIds);
  const missingContext = readStringArray(value.missingContext).length
    ? readStringArray(value.missingContext)
    : readStringArray(value.missingContextIds);
  const notes = readNoteList(value.notes);
  const details = [
    status,
    refs.length ? `refs: ${refs.join(", ")}` : "",
    missingFacts.length ? `missing facts: ${missingFacts.join(", ")}` : "",
    missingContext.length ? `missing context: ${missingContext.join(", ")}` : "",
    notes.length ? `notes: ${notes.join(" · ")}` : "",
  ].filter(Boolean);

  return `${label}: ${details.join(" · ") || "reported"}`;
}

function normalizeQaSourceCoverage(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry, index) => summarizeQaCoverageEntry(entry, index)).filter(Boolean);
  }
  if (!isRecord(value)) return [];

  for (const key of ["items", "entries", "sources", "coverage"]) {
    if (Array.isArray(value[key])) return normalizeQaSourceCoverage(value[key]);
  }

  return Object.entries(value)
    .flatMap(([key, entry], index) => {
      if (Array.isArray(entry)) {
        return entry.map((nested, nestedIndex) => summarizeQaCoverageEntry(nested, nestedIndex, key));
      }
      return [summarizeQaCoverageEntry(entry, index, key)];
    })
    .filter(Boolean);
}

function normalizeQaHarnessItem(value: unknown, index: number): QaHarnessItem {
  const item = isRecord(value) ? value : {};
  const dimensionGates = normalizeQaGateRows(Array.isArray(item.dimensionGates) ? item.dimensionGates : item.dimensions);
  const dimensionBlockers = dimensionGates.flatMap((gate) => gate.blockers);
  const dimensionWarnings = dimensionGates.flatMap((gate) => gate.warnings);
  const promotionBlockers = readStringArray(item.formalPromotionBlockedReasons);
  const blockers = readStringArray(item.blockers).length
    ? readStringArray(item.blockers)
    : [...readStringArray(item.blockingReasons), ...promotionBlockers, ...dimensionBlockers];
  const overallStatus = readString(
    item.overallStatus,
    readString(item.status, dimensionGates.some((gate) => gate.status === "FAIL") ? "FAIL" : dimensionGates.some((gate) => gate.status === "UNKNOWN") ? "UNKNOWN" : "PARTIAL"),
  );
  return {
    qaItemId: readString(item.qaItemId, `qa-item-${index + 1}`),
    shotId: readString(item.shotId, "Not initialized"),
    taskPlanId: typeof item.taskPlanId === "string" ? item.taskPlanId : undefined,
    jobId: typeof item.jobId === "string" ? item.jobId : undefined,
    harnessJobId: typeof item.harnessJobId === "string" ? item.harnessJobId : undefined,
    checkpointResumeItemId: typeof item.checkpointResumeItemId === "string" ? item.checkpointResumeItemId : undefined,
    formalPromotionEligible: readOptionalBoolean(item, "formalPromotionEligible"),
    requiresHumanReview: readOptionalBoolean(item, "requiresHumanReview"),
    overallStatus,
    dimensionGates,
    sourceCoverage: normalizeQaSourceCoverage(item.sourceCoverage),
    blockers,
    warnings: [...readStringArray(item.warnings), ...dimensionWarnings],
    notes: readNoteList(item.notes),
  };
}

function countQaItems(items: QaHarnessItem[], predicate: (item: QaHarnessItem) => boolean) {
  return items.filter(predicate).length;
}

function qaStatusIncludes(item: QaHarnessItem, value: string) {
  return item.overallStatus.toLowerCase().includes(value);
}

export function getQaHarness(runtimeState: ProjectRuntimeState): QaHarnessState {
  const harness = (runtimeState as Partial<ProjectRuntimeState> & { qaHarness?: unknown }).qaHarness;
  const initialized = isRecord(harness);
  const harnessRecord = initialized ? harness as Record<string, unknown> : {};
  const summaryRecord = initialized && isRecord(harnessRecord.summary) ? harnessRecord.summary : {};
  const hardLocksRecord = initialized && isRecord(harnessRecord.hardLocks) ? harnessRecord.hardLocks : {};
  const items = initialized && Array.isArray(harnessRecord.items)
    ? harnessRecord.items.map(normalizeQaHarnessItem)
    : [];

  return {
    initialized,
    hasSummary: initialized && isRecord(harnessRecord.summary),
    hasHardLocks: initialized && isRecord(harnessRecord.hardLocks),
    hasOverall: initialized && (Array.isArray(harnessRecord.overall) || isRecord(harnessRecord.overall)),
    hasItems: initialized && Array.isArray(harnessRecord.items),
    schemaVersion: readString(harnessRecord.schemaVersion, "Not initialized"),
    generatedAt: readString(harnessRecord.generatedAt, "Not initialized"),
    dimensions: qaHarnessDimensions,
    summary: {
      totalItems: readOptionalNumber(summaryRecord, "totalItems") ?? items.length,
      formalEligible: readOptionalNumber(summaryRecord, "formalEligible") ??
        readOptionalNumber(summaryRecord, "formalPromotionEligible") ??
        countQaItems(items, (item) => item.formalPromotionEligible === true),
      requiresHumanReview: readOptionalNumber(summaryRecord, "requiresHumanReview") ??
        countQaItems(items, (item) => item.requiresHumanReview === true),
      blocked: readOptionalNumber(summaryRecord, "blocked") ??
        readOptionalNumber(summaryRecord, "formalPromotionBlocked") ??
        countQaItems(items, (item) => qaStatusIncludes(item, "block") || item.blockers.length > 0),
      unknown: readOptionalNumber(summaryRecord, "unknown") ??
        readOptionalNumber(summaryRecord, "unknownItems") ??
        countQaItems(items, (item) => qaStatusIncludes(item, "unknown") || qaStatusIncludes(item, "not initialized")),
      failed: readOptionalNumber(summaryRecord, "failed") ??
        readOptionalNumber(summaryRecord, "failedItems") ??
        countQaItems(items, (item) => qaStatusIncludes(item, "fail")),
      partial: readOptionalNumber(summaryRecord, "partial") ??
        readOptionalNumber(summaryRecord, "partialItems") ??
        countQaItems(items, (item) => qaStatusIncludes(item, "partial")),
      dryRunOnly: readOptionalBoolean(summaryRecord, "dryRunOnly"),
      liveSubmitAllowed: readOptionalBoolean(summaryRecord, "liveSubmitAllowed"),
      noFileMutation: readOptionalBoolean(summaryRecord, "noFileMutation"),
    },
    overall: normalizeQaOverallRows(harnessRecord.overall),
    items,
    hardLocks: {
      dryRunOnly: readOptionalBoolean(hardLocksRecord, "dryRunOnly"),
      providerSubmissionForbidden: readOptionalBoolean(hardLocksRecord, "providerSubmissionForbidden"),
      liveSubmitAllowed: readOptionalBoolean(hardLocksRecord, "liveSubmitAllowed"),
      noFileMutation: readOptionalBoolean(hardLocksRecord, "noFileMutation"),
      noAutoPromotion: readOptionalBoolean(hardLocksRecord, "noAutoPromotion"),
      semanticRepairForbidden: readOptionalBoolean(hardLocksRecord, "semanticRepairForbidden"),
      workerSelfReportCannotPassQa: readOptionalBoolean(hardLocksRecord, "workerSelfReportCannotPassQa"),
      overallFirst: readOptionalBoolean(hardLocksRecord, "overallFirst"),
    },
  };
}

function normalizeToolRuntimeCheck(value: unknown, index: number): ToolRuntimeHarnessCheck {
  const check = isRecord(value) ? value : {};
  const checkId = readString(check.checkId, readString(check.id, `tool-check-${index + 1}`));
  const path = typeof check.path === "string" ? check.path : undefined;
  const blockers = readDisplayList(check.blockers).length
    ? readDisplayList(check.blockers)
    : readDisplayList(check.blockingReasons);

  return {
    checkId,
    category: readString(check.category, "unknown"),
    label: readString(check.label, checkId),
    requiredFor: readDisplayList(check.requiredFor, "required-for"),
    status: readString(check.status, "unknown"),
    pathStatus: readString(check.pathStatus, path ? "reported" : "unknown"),
    path,
    version: typeof check.version === "string" ? check.version : undefined,
    platformSupport: normalizeToolRuntimePlatformSupport(check.platformSupport),
    canExecuteNow: readOptionalBoolean(check, "canExecuteNow"),
    executionMode: readString(check.executionMode, "diagnostics_only"),
    missingIsBlocker: readOptionalBoolean(check, "missingIsBlocker"),
    blockers,
    warnings: readDisplayList(check.warnings),
    sourceRefs: readDisplayList(check.sourceRefs).length
      ? readDisplayList(check.sourceRefs)
      : readDisplayList(check.refs),
    notes: readDisplayList(check.notes),
  };
}

function normalizeToolRuntimePlatformSupport(value: unknown): string[] {
  if (!isRecord(value)) return readDisplayList(value, "platform");
  const pathStyles = readDisplayList(value.pathStyles, "path-style");
  return [
    `darwin: ${readString(value.darwin, "unknown")}`,
    `win32: ${readString(value.win32, "unknown")}`,
    `linux: ${readString(value.linux, "unknown")}`,
    pathStyles.length ? `paths: ${pathStyles.join(", ")}` : "",
  ].filter(Boolean);
}

function normalizeToolRuntimePathPolicy(value: unknown, runtimeState: ProjectRuntimeState): ToolRuntimePathPolicy {
  const policy = isRecord(value) ? value : {};
  const policyRows = Array.isArray(policy.policies) ? policy.policies.filter(isRecord) : [];
  const policyPathStyle = (platform: string) =>
    readString(policyRows.find((row) => readString(row.platform, "") === platform)?.pathStyle, "");
  const runtimeRootPolicy = runtimeState.runtime?.config?.projectRootPolicy;
  const allowedRoots = readDisplayList(policy.allowedRoots, "root").length
    ? readDisplayList(policy.allowedRoots, "root")
    : readDisplayList(runtimeRootPolicy?.allowedRoots, "root");
  return {
    platformPathAbstractionRequired: readOptionalBoolean(policy, "platformPathAbstractionRequired"),
    macPathStyle: readString(policy.macPathStyle, policyPathStyle("darwin") || runtimeRootPolicy?.macPathStyle || "Not initialized"),
    windowsPathStyle: readString(policy.windowsPathStyle, policyPathStyle("win32") || runtimeRootPolicy?.windowsPathStyle || "Not initialized"),
    projectRootRelativeRequired: readOptionalBoolean(policy, "projectRootRelativeRequired"),
    allowedRoots,
    blockers: readDisplayList(policy.blockers),
    warnings: readDisplayList(policy.warnings),
    notes: [
      ...readDisplayList(policy.notes),
      ...policyRows.map((row) =>
        `${readString(row.policyId, "path-policy")}: ${readString(row.platform, "unknown")} / ${readString(row.pathStyle, "unknown")}`,
      ),
    ],
  };
}

function toolRuntimeStatusIncludes(check: ToolRuntimeHarnessCheck, value: string) {
  const needle = value.toLowerCase();
  return check.status.toLowerCase().includes(needle) || check.pathStatus.toLowerCase().includes(needle);
}

export function getToolRuntimeHarness(runtimeState: ProjectRuntimeState): ToolRuntimeHarnessState {
  const harness = (runtimeState as Partial<ProjectRuntimeState> & { toolRuntimeHarness?: unknown }).toolRuntimeHarness;
  const initialized = isRecord(harness);
  const harnessRecord = initialized ? harness as Record<string, unknown> : {};
  const summaryRecord = initialized && isRecord(harnessRecord.summary) ? harnessRecord.summary : {};
  const pathPolicyRecord = initialized && isRecord(harnessRecord.pathPolicy) ? harnessRecord.pathPolicy : {};
  const hardLocksRecord = initialized && isRecord(harnessRecord.hardLocks) ? harnessRecord.hardLocks : {};
  const hasChecks = initialized && Array.isArray(harnessRecord.checks);
  const checks = hasChecks ? (harnessRecord.checks as unknown[]).map(normalizeToolRuntimeCheck) : [];
  const pathPolicy = normalizeToolRuntimePathPolicy(pathPolicyRecord, runtimeState);
  const missingChecks = checks.filter((check) => toolRuntimeStatusIncludes(check, "missing"));
  const blockedChecks = checks.filter((check) =>
    toolRuntimeStatusIncludes(check, "blocked") ||
    check.blockers.length > 0 ||
    check.missingIsBlocker === true,
  );
  const unknownChecks = checks.filter((check) =>
    toolRuntimeStatusIncludes(check, "unknown") ||
    toolRuntimeStatusIncludes(check, "not initialized"),
  );

  return {
    initialized,
    hasSummary: initialized && isRecord(harnessRecord.summary),
    hasChecks,
    hasPathPolicy: initialized && isRecord(harnessRecord.pathPolicy),
    hasHardLocks: initialized && isRecord(harnessRecord.hardLocks),
    schemaVersion: readString(harnessRecord.schemaVersion, "Not initialized"),
    generatedAt: readString(harnessRecord.generatedAt, "Not initialized"),
    summary: {
      totalChecks: readOptionalNumber(summaryRecord, "totalChecks") ?? checks.length,
      ready: readOptionalNumber(summaryRecord, "ready") ??
        checks.filter((check) => toolRuntimeStatusIncludes(check, "ready")).length,
      missing: readOptionalNumber(summaryRecord, "missing") ?? missingChecks.length,
      planned: readOptionalNumber(summaryRecord, "planned") ??
        checks.filter((check) => toolRuntimeStatusIncludes(check, "planned")).length,
      blocked: readOptionalNumber(summaryRecord, "blocked") ?? blockedChecks.length,
      unknown: readOptionalNumber(summaryRecord, "unknown") ?? unknownChecks.length,
      requiredMissing: readOptionalNumber(summaryRecord, "requiredMissing") ??
        readOptionalNumber(summaryRecord, "missingBlockers") ??
        missingChecks.filter((check) => check.missingIsBlocker === true).length,
      optionalMissing: readOptionalNumber(summaryRecord, "optionalMissing") ??
        missingChecks.filter((check) => check.missingIsBlocker !== true).length,
      dryRunOnly: readOptionalBoolean(summaryRecord, "dryRunOnly"),
      liveSubmitAllowed: readOptionalBoolean(summaryRecord, "liveSubmitAllowed"),
    },
    checks,
    pathPolicy,
    hardLocks: {
      dryRunOnly: readOptionalBoolean(hardLocksRecord, "dryRunOnly") ?? readOptionalBoolean(summaryRecord, "dryRunOnly"),
      diagnosticsOnly: readOptionalBoolean(hardLocksRecord, "diagnosticsOnly"),
      noInstall: readOptionalBoolean(hardLocksRecord, "noInstall"),
      noCredentialRead: readOptionalBoolean(hardLocksRecord, "noCredentialRead"),
      noCredentialWrite: readOptionalBoolean(hardLocksRecord, "noCredentialWrite"),
      noSystemSettingsMutation: readOptionalBoolean(hardLocksRecord, "noSystemSettingsMutation"),
      arbitraryShellExecutionBlocked: readOptionalBoolean(hardLocksRecord, "arbitraryShellExecutionBlocked"),
      sidecarDaemonDisabled: readOptionalBoolean(hardLocksRecord, "sidecarDaemonDisabled"),
      providerSubmissionForbidden: readOptionalBoolean(hardLocksRecord, "providerSubmissionForbidden"),
      liveSubmitAllowed: readOptionalBoolean(hardLocksRecord, "liveSubmitAllowed") ?? readOptionalBoolean(summaryRecord, "liveSubmitAllowed"),
      platformPathAbstractionRequired: readOptionalBoolean(hardLocksRecord, "platformPathAbstractionRequired") ??
        pathPolicy.platformPathAbstractionRequired,
    },
  };
}

function emptyVideoPlanning(): VideoPlanningState {
  return {
    schemaVersion: "0.1.0",
    generatedAt: "",
    readinessGates: [],
    taskPlans: [],
    queueShell: {
      status: "empty",
      counts: {
        total: 0,
        pending: 0,
        ready: 0,
        blocked: 0,
        parked: 0,
      },
      concurrency: {
        placeholder: true,
        configuredLimit: 0,
        activeProviderLimit: 0,
        notes: [],
      },
      autoContinuePolicy: {
        enabled: false,
        mode: "manual_after_user_enablement",
        providerSubmissionForbidden: true,
        notes: [],
      },
      longQueueTimeout: {
        placeholder: true,
        stallTimeoutSeconds: 0,
        action: "surface_waiting_state_only",
        notes: [],
      },
      dryRunOnly: true,
      providerSubmissionForbidden: true,
      notes: ["Video planning defaults are shown because runtimeState.videoPlanning is unavailable."],
    },
    providerPolicySummary: {
      videoProvidersRemainParked: true,
      liveSubmitAllowed: false,
      userEnablementRequired: true,
      providerSubmissionForbidden: true,
      fastModelForbidden: true,
      vipChannelForbidden: true,
      textToVideoForbidden: true,
      parkedProviderIds: [],
      notes: [],
    },
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    notes: [],
  };
}

export function getVideoPlanning(runtimeState: ProjectRuntimeState): VideoPlanningState {
  const fallback = emptyVideoPlanning();
  const planning = (runtimeState as Partial<ProjectRuntimeState>).videoPlanning;
  if (!planning) return fallback;
  return {
    ...fallback,
    ...planning,
    readinessGates: planning.readinessGates || [],
    taskPlans: planning.taskPlans || [],
    queueShell: {
      ...fallback.queueShell,
      ...planning.queueShell,
      counts: {
        ...fallback.queueShell.counts,
        ...planning.queueShell?.counts,
      },
      concurrency: {
        ...fallback.queueShell.concurrency,
        ...planning.queueShell?.concurrency,
        notes: planning.queueShell?.concurrency?.notes || [],
      },
      autoContinuePolicy: {
        ...fallback.queueShell.autoContinuePolicy,
        ...planning.queueShell?.autoContinuePolicy,
        notes: planning.queueShell?.autoContinuePolicy?.notes || [],
      },
      longQueueTimeout: {
        ...fallback.queueShell.longQueueTimeout,
        ...planning.queueShell?.longQueueTimeout,
        notes: planning.queueShell?.longQueueTimeout?.notes || [],
      },
      notes: planning.queueShell?.notes || [],
    },
    providerPolicySummary: {
      ...fallback.providerPolicySummary,
      ...planning.providerPolicySummary,
      parkedProviderIds: planning.providerPolicySummary?.parkedProviderIds || [],
      notes: planning.providerPolicySummary?.notes || [],
    },
    notes: planning.notes || [],
  };
}

function emptyVideoExecutionPreview(): VideoExecutionPreviewState {
  return {
    schemaVersion: "0.1.0",
    generatedAt: "",
    previews: [],
    summary: {
      total: 0,
      blocked: 0,
      previewReady: 0,
      parked: 0,
      canPreviewPacket: 0,
      canExecute: 0,
    },
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: ["Video execution preview defaults are shown because runtimeState.videoExecutionPreview is unavailable."],
  };
}

export function getVideoExecutionPreview(runtimeState: ProjectRuntimeState): VideoExecutionPreviewState {
  const fallback = emptyVideoExecutionPreview();
  const preview = (runtimeState as Partial<ProjectRuntimeState>).videoExecutionPreview;
  if (!preview) return fallback;
  return {
    ...fallback,
    ...preview,
    previews: preview.previews || [],
    summary: {
      ...fallback.summary,
      ...preview.summary,
      canExecute: 0,
    },
    notes: preview.notes || [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
  };
}

export function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}


function firstVideoBlocker(gate?: VideoReadinessGateState, plan?: VideoTaskPlanState) {
  return gate?.blockers[0]
    || plan?.blockers[0]
    || gate?.checks.find((check) => check.status === "blocked")?.detail
    || "No selected-shot video blocker.";
}

function motionTypeLabel(type?: string) {
  const labels: Record<string, string> = {
    static_hold: "静止",
    micro_expression: "表情",
    pose_change_in_place: "姿态",
    locomotion: "走位",
    object_interaction: "交互",
    camera_reframe: "运镜",
    camera_move: "运镜",
    reveal_or_occlusion: "揭示",
    transform_or_state_change: "状态变化",
  };
  return type ? labels[type] || type : "未规划";
}

function motionContractFromGate(gate?: VideoReadinessGateState): MotionEndpointContract | undefined {
  const value = gate ? (gate as unknown as Record<string, unknown>).motionEndpointContract : undefined;
  return isRecord(value) ? value as unknown as MotionEndpointContract : undefined;
}

function motionFactsFromTaskPlan(plan?: VideoTaskPlanState): Record<string, unknown> | undefined {
  const value = plan ? (plan as unknown as Record<string, unknown>).motionEndpointFacts : undefined;
  return isRecord(value) ? value : undefined;
}

function motionEndpointNoticeText(value: string) {
  return /motion|MotionEndpoint|body mechanics|end[-\s]?frame|editable|protected|bbox|动作|尾帧|姿态|走位|运镜/i.test(value);
}

export function firstMotionEndpointNotice(gate?: VideoReadinessGateState, plan?: VideoTaskPlanState) {
  const contract = motionContractFromGate(gate);
  return contract?.blockers[0]
    || contract?.warnings[0]
    || gate?.checks.find((check) => check.id.includes("motion") && check.status === "blocked")?.detail
    || gate?.checks.find((check) => check.id.includes("motion") && check.status === "warning")?.detail
    || plan?.blockers.find(motionEndpointNoticeText)
    || plan?.warnings.find(motionEndpointNoticeText)
    || "No motion endpoint blocker or warning.";
}

export function motionContractSummaryForGate(gate?: VideoReadinessGateState, plan?: VideoTaskPlanState): MotionEndpointUiFacts {
  const contract = motionContractFromGate(gate);
  if (contract) {
    return {
      shotId: contract.shotId || gate?.shotId || plan?.shotId || "project",
      motionType: contract.motionType,
      motionLabel: motionTypeLabel(contract.motionType),
      endFrameRequired: contract.whetherEndFrameRequired,
      contractStatus: contract.status,
      bodyMechanicsRequired: contract.bodyMechanics.required,
      editableRegionCount: contract.editableRegions.length,
      protectedRegionCount: contract.protectedRegions.length,
      bboxOnlyMotionForbidden: contract.gateInputs.bboxOnlyMotionForbidden,
      blockers: contract.blockers,
      warnings: contract.warnings,
      source: "contract",
    };
  }

  const facts = motionFactsFromTaskPlan(plan);
  if (facts) {
    const motionType = typeof facts.motionType === "string" ? facts.motionType : "unknown";
    const status = typeof facts.contractStatus === "string"
      ? facts.contractStatus
      : typeof facts.motionContractStatus === "string"
        ? facts.motionContractStatus
        : "missing";
    return {
      shotId: plan?.shotId || gate?.shotId || "project",
      motionType,
      motionLabel: motionTypeLabel(motionType),
      endFrameRequired: readOptionalBoolean(facts, "whetherEndFrameRequired") ?? readOptionalBoolean(facts, "endRequired") ?? false,
      contractStatus: status,
      bodyMechanicsRequired: readOptionalBoolean(facts, "bodyMechanicsRequired") ?? false,
      editableRegionCount: readStringArray(facts.editableRegionIds).length,
      protectedRegionCount: readStringArray(facts.protectedRegionIds).length,
      bboxOnlyMotionForbidden: readOptionalBoolean(facts, "bboxOnlyMotionForbidden") ?? false,
      blockers: [],
      warnings: [],
      source: "task_facts",
    };
  }

  return {
    shotId: gate?.shotId || plan?.shotId || "project",
    motionType: "missing",
    motionLabel: "未规划",
    endFrameRequired: false,
    contractStatus: "missing",
    bodyMechanicsRequired: false,
    editableRegionCount: 0,
    protectedRegionCount: 0,
    bboxOnlyMotionForbidden: false,
    blockers: [],
    warnings: [],
    source: "missing",
  };
}

function motionEndpointFactsForShot(videoPlanning: VideoPlanningState, selectedShot?: ShotRecord) {
  const selectedGate = selectedShot ? videoPlanning.readinessGates.find((gate) => gate.shotId === selectedShot.id) : undefined;
  const selectedPlan = selectedShot ? videoPlanning.taskPlans.find((plan) => plan.shotId === selectedShot.id) : undefined;
  return motionContractSummaryForGate(selectedGate, selectedPlan);
}

export function buildMotionEndpointDiagnosticsSummary(videoPlanning: VideoPlanningState): MotionEndpointDiagnosticsSummary {
  const shotIds = Array.from(new Set([
    ...videoPlanning.readinessGates.map((gate) => gate.shotId),
    ...videoPlanning.taskPlans.map((plan) => plan.shotId),
  ]));
  const facts = shotIds.map((shotId) => motionContractSummaryForGate(
    videoPlanning.readinessGates.find((gate) => gate.shotId === shotId),
    videoPlanning.taskPlans.find((plan) => plan.shotId === shotId),
  ));

  return {
    total: facts.length,
    endFrameRequiredCount: facts.filter((item) => item.endFrameRequired).length,
    bodyMechanicsRequiredCount: facts.filter((item) => item.bodyMechanicsRequired).length,
    typeCounts: countBy(facts.map((item) => item.motionLabel)),
    statusCounts: countBy(facts.map((item) => item.contractStatus)),
    compactItems: facts.slice(0, 6).map((item) => (
      `${item.shotId} · ${item.motionLabel} · ${item.endFrameRequired ? "需要尾帧" : "无需尾帧"} · ${item.contractStatus}`
    )),
  };
}



function uniqueCount(values: string[]) {
  return new Set(values.filter(Boolean)).size;
}

function taskKnowledgeWarnings(task: TaskRuntimeView) {
  return Array.from(new Set([
    ...task.routeResult.warnings,
    ...task.contextBudget.warnings,
    ...task.envelope.routeWarnings,
  ].filter(Boolean)));
}

type KnowledgeUiSummary = {
  enabledTotal: string;
  injectedUnique: string;
  warningBlockerCount: string;
  budgetUsed: string;
  readiness: string;
  hardLockReminder: string;
};

export function buildKnowledgeUiSummary(view: RuntimeView): KnowledgeUiSummary {
  const routeTest = view.knowledge.routeTest;
  const totalInjectedPacks = view.taskViews.reduce((count, task) => count + task.envelope.injectedKnowledgePacks.length, 0);
  const uniqueInjectedPacks = uniqueCount(view.taskViews.flatMap((task) => task.envelope.injectedKnowledgePacks.map((pack) => pack.packId)));
  const usedTokens = view.taskViews.reduce((sum, task) => sum + task.contextBudget.usedTokens, 0);
  const maxTokens = view.taskViews.reduce((sum, task) => sum + task.contextBudget.maxInjectionTokens, 0);
  const routeWarnings = routeTest ? Array.from(new Set([...routeTest.routeResult.warnings, ...routeTest.contextBudget.warnings])) : [];
  const taskWarnings = view.taskViews.flatMap(taskKnowledgeWarnings);
  const warningCount = uniqueCount([...taskWarnings, ...routeWarnings]);
  const blockerCount = view.knowledge.validationIssues.length;
  const readiness = blockerCount ? "blocked" : warningCount ? "needs review" : "ready";

  return {
    enabledTotal: `${view.knowledge.enabledCount}/${view.knowledge.packCount}`,
    injectedUnique: `${totalInjectedPacks}/${uniqueInjectedPacks}`,
    warningBlockerCount: `${warningCount}/${blockerCount}`,
    budgetUsed: `${usedTokens}/${maxTokens}`,
    readiness,
    hardLockReminder: "Hard lock: provider policy, preflight, reference authority, keyframe pair derivation, and QA gates stay fixed.",
  };
}



export function buildPhase17ImageKeyframeRuntimeSummary(runtimeState: ProjectRuntimeState): Phase17ImageKeyframeRuntimeSummary {
  const runtimePlan = runtimeState.imageKeyframeRuntime;
  const pipeline = getImagePipeline(runtimeState);
  const filesystemWatcher = getFilesystemWatcherHarness(runtimeState);
  const qaHarness = getQaHarness(runtimeState);
  const references = runtimePlan.assetReferencePlanning.references;
  const derivedFromStart = runtimePlan.image2EndFramePlans.filter((plan) => plan.endDerivation.derivesFrom === "start_frame").length;
  const editRequests = runtimePlan.image2EndFramePlans.filter((plan) => plan.adapterRequestPreview.operation === "image2image").length;
  const liveForbiddenRequests = [...runtimePlan.image2StartFramePlans, ...runtimePlan.image2EndFramePlans]
    .filter((plan) => plan.adapterRequestPreview.submitPolicy.liveSubmitForbidden).length;
  const startPlanMotionFactCount = runtimePlan.image2StartFramePlans.filter((plan) => Boolean(plan.motionEndpointFacts)).length;
  const endPlanMotionFactCount = runtimePlan.image2EndFramePlans.filter((plan) => (
    Boolean(plan.motionEndpointFacts) || plan.endDerivation.motionContractStatus !== "missing"
  )).length;
  const blockedPairMotionBlockerCount = runtimePlan.keyframePairGates
    .filter((gate) => gate.status === "blocked")
    .flatMap((gate) => gate.blockers)
    .filter(motionEndpointNoticeText).length;
  const expectedOutputSignals = pipeline.watcherEvents.filter((event) => (
    event.eventType === "expected_output_detected" ||
    event.eventType === PROVIDER_READY_DERIVATIVE_DETECTED
  )).length + (filesystemWatcher.summary.expectedOutputs || 0);
  const formalReadySignals = pipeline.qaPromotionReports.filter((report) => report.canPromoteToFormal).length + (qaHarness.summary.formalEligible || 0);
  const closedLoopEvidence = expectedOutputSignals + pipeline.generationHealthReports.length + pipeline.qaPromotionReports.length + formalReadySignals;
  const providerLockCount = runtimePlan.runtimeLockGates.filter((gate) => gate.status === "pass").length;
  const blockers = runtimePlan.blockers;
  const warnings = runtimePlan.warnings;
  const adapterPreviewCount = runtimePlan.image2StartFramePlans.length + runtimePlan.image2EndFramePlans.length;

  return {
    status: runtimePlan.status,
    assetPlanCount: references.length,
    startFramePlanCount: runtimePlan.summary.startFramePlans,
    endFramePlanCount: runtimePlan.summary.endFramePlans,
    adapterRequestCount: adapterPreviewCount,
    validPairCount: runtimePlan.summary.readyKeyframePairs,
    pairGateCount: runtimePlan.summary.keyframePairGates,
    startPlanMotionFactCount,
    endPlanMotionFactCount,
    blockedPairMotionBlockerCount,
    closedLoopEvidenceCount: closedLoopEvidence,
    providerLockCount,
    blockers,
    warnings,
    rows: [
      {
        label: "Asset reference plan",
        status: `${runtimePlan.summary.lockedReferences} locked`,
        detail: `${references.length} reference(s) · ${runtimePlan.summary.candidateReferences} candidate · ${runtimePlan.summary.rejectedReferences} rejected`,
      },
      {
        label: "Keyframe runtime plan",
        status: `${runtimePlan.summary.startFramePlans} start / ${runtimePlan.summary.endFramePlans} end`,
        detail: `${runtimePlan.image2StartFramePlans.filter((plan) => plan.status === "ready_for_dry_run").length + runtimePlan.image2EndFramePlans.filter((plan) => plan.status === "ready_for_dry_run").length} ready dry-run plan(s)`,
      },
      {
        label: "End-frame derivation",
        status: `${derivedFromStart}/${runtimePlan.summary.endFramePlans} from start frame`,
        detail: `${runtimePlan.summary.readyKeyframePairs} valid keyframe pair gate(s) · ${runtimePlan.summary.blockedKeyframePairs} blocked or unknown`,
      },
      {
        label: "Motion Endpoint facts",
        status: `${startPlanMotionFactCount}/${runtimePlan.image2StartFramePlans.length} start · ${endPlanMotionFactCount}/${runtimePlan.image2EndFramePlans.length} end`,
        detail: `${blockedPairMotionBlockerCount} blocked pair motion blocker(s)`,
      },
      {
        label: "Adapter dry-run",
        status: `${adapterPreviewCount} preview(s)`,
        detail: `${editRequests} image2image edit request(s) · ${liveForbiddenRequests} live submit forbidden`,
      },
      {
        label: "Closed loop evidence",
        status: `${closedLoopEvidence} signal(s)`,
        detail: `${expectedOutputSignals} watcher signal(s) · ${pipeline.generationHealthReports.length} health report(s) · ${formalReadySignals} formal-ready signal(s)`,
      },
    ],
  };
}




