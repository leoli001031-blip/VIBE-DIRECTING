import { buildDirectorEditPlan, isPromptBypassIntent, type DirectorEditPlan, type DirectorEditSelection } from "./directorEdit";
import { buildExportBuilderState, type ExportBuilderState } from "./exportBuilder";
import {
  buildLocalOrchestratorState,
  type LocalOrchestratorState,
  type LocalOrchestratorTaskPacket,
} from "./localOrchestrator";
import { buildProviderLiveGateState, type ProviderLiveGateState } from "./providerLiveGate";
import type { ProjectRuntimeState } from "./projectState";
import { buildTaskPackets, type BuiltTaskPacket, type TaskPacketBuilderState, type TaskPacketKind } from "./taskPacketBuilder";
import type {
  AdapterContractState,
  AssetReadinessReport,
  AudioPlanningState,
  GenerationHealthReport,
  Image2AdapterRequest,
  ImageTaskPlan,
  PreviewEvent,
  ProviderRegistry,
  QaPromotionReport,
  ShotRecord,
  TaskEnvelope,
  TaskRun,
  VideoExecutionPreviewState,
  VideoPlanningState,
} from "./types";

export type DirectorWorkflowStatus =
  | "dry_run_ready"
  | "pending_confirmation"
  | "blocked"
  | "blocked_missing_context";

export interface DirectorWorkflowSelectionInput {
  selectedShotId?: string;
  selectedShotIds?: string[];
  selectedAssetId?: string;
  sectionId?: string;
}

export interface BuildDirectorWorkflowStateInput {
  runtimeState: ProjectRuntimeState;
  userIntent: string;
  selection?: DirectorWorkflowSelectionInput;
  generatedAt?: string;
}

export interface DirectorWorkflowHardLocks {
  dryRunOnly: true;
  noFileMutation: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  noFreeTextTask: true;
  validatedEnvelopeRequired: true;
  noCredentialAccess: true;
  noDaemonStart: true;
}

export interface DirectorWorkflowSummary {
  userIntent: string;
  generatedAt: string;
  selectedShotId?: string;
  selectedAssetId?: string;
  totalTaskPackets: number;
  readyTaskPackets: number;
  blockedTaskPackets: number;
  queueItems: number;
  providerGateItems: number;
  exportPackageStatus: string;
  dryRunOnly: true;
  noFileMutation: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
}

export interface DirectorWorkflowState {
  schemaVersion: "0.1.0";
  generatedAt: string;
  scopeLabel: string;
  status: DirectorWorkflowStatus;
  summary: DirectorWorkflowSummary;
  editPlan: DirectorEditPlan;
  taskPacketState: TaskPacketBuilderState;
  orchestratorState: LocalOrchestratorState;
  providerGateState: ProviderLiveGateState;
  exportState: ExportBuilderState;
  nextActions: string[];
  visibleBadges: string[];
  blockedReasons: string[];
  confirmationRequired: boolean;
  hardLocks: DirectorWorkflowHardLocks;
}

const hardLocks: DirectorWorkflowHardLocks = {
  dryRunOnly: true,
  noFileMutation: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
  noFreeTextTask: true,
  validatedEnvelopeRequired: true,
  noCredentialAccess: true,
  noDaemonStart: true,
};

const liveSubmitPattern =
  /\b(live\s*submit|provider\s*submit|submit\s+provider|real\s+generation|generate\s+for\s+real|run\s+generation)\b|真实(提交|生成|出图|出视频)|提交到?(provider|供应商|模型)|调用(provider|供应商|模型)|开始(生成|出图|出视频)|直接(生成|出图|出视频)/i;
const credentialPattern =
  /\b(api\s*key|apikey|credential|secret|token|process\.env|env var)\b|密钥|凭证|令牌|环境变量|读.*key|读取.*key|读取.*凭证/i;
const exportIntentPattern = /导出|素材包|rough\s*cut|export|fcpxml|edl|premiere|jianying|davinci/i;

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim()).map((value) => value.trim()))).sort();
}

function emptyProviderRegistry(generatedAt: string): ProviderRegistry {
  return {
    schemaVersion: "0.1.0",
    registryVersion: "director-workflow-empty-provider-registry",
    generatedAt,
    strictImageProvider: "image2_only",
    defaultProviderBySlot: {},
    capabilities: [],
    notes: ["Director Workflow fallback registry contains no live provider capabilities."],
  };
}

function emptyAdapterContracts(generatedAt: string): AdapterContractState {
  return {
    schemaVersion: "0.1.0",
    generatedAt,
    agentAdapters: [],
    workerAdapters: [],
    providerAdapters: [],
    summary: {
      agentAdapters: [],
      workerAdapters: [],
      providerAdapters: [],
      activeImageProvider: "",
      parkedVideoProviders: [],
      liveSubmitAllowed: false,
      credentialStorage: false,
      contractViolations: [],
    },
  };
}

function selectedShotIdFor(input: BuildDirectorWorkflowStateInput, editPlan?: DirectorEditPlan): string | undefined {
  return (
    input.selection?.selectedShotId ||
    editPlan?.selection.shotId ||
    editPlan?.selection.shotIds?.[0] ||
    editPlan?.selection.targetIds?.find((targetId) => input.runtimeState.storyFlow?.shots?.some((shot) => shot.id === targetId))
  );
}

function selectedAssetIdFor(input: BuildDirectorWorkflowStateInput, editPlan?: DirectorEditPlan): string | undefined {
  return input.selection?.selectedAssetId || editPlan?.selection.assetId;
}

function directorSelection(input: BuildDirectorWorkflowStateInput): Partial<DirectorEditSelection> {
  const selectedShotIds = input.selection?.selectedShotIds;
  return {
    scopeKind: exportIntentPattern.test(input.userIntent)
      ? "export"
      : selectedShotIds?.length
      ? "multi-shot"
      : input.selection?.selectedAssetId
        ? "asset"
      : input.selection?.sectionId
        ? "section"
        : input.selection?.selectedShotId
          ? "shot"
          : undefined,
    shotId: input.selection?.selectedShotId,
    shotIds: selectedShotIds,
    assetId: input.selection?.selectedAssetId,
    sectionId: input.selection?.sectionId,
    targetIds: unique([
      ...(selectedShotIds || []),
      input.selection?.selectedShotId || "",
      input.selection?.selectedAssetId || "",
      input.selection?.sectionId || "",
    ]),
  };
}

function requestedTaskKinds(editPlan: DirectorEditPlan): TaskPacketKind[] | undefined {
  if (editPlan.selection.scopeKind === "export") return ["export", "story_audit"];
  if (editPlan.selection.scopeKind === "asset") return ["asset", "scene_qa", "story_audit"];
  return undefined;
}

function unsafeIntentReasons(userIntent: string): string[] {
  return unique([
    isPromptBypassIntent(userIntent) ? "prompt_bypass_forbidden" : "",
    liveSubmitPattern.test(userIntent) ? "live_or_provider_submit_forbidden" : "",
    credentialPattern.test(userIntent) ? "credential_or_api_key_access_forbidden" : "",
  ]);
}

function expectedOutputs(packet: BuiltTaskPacket): string[] {
  return packet.envelope?.taskEnvelope.expectedOutputs || [];
}

function taskEnvelopes(packetState: TaskPacketBuilderState): TaskEnvelope[] {
  return packetState.packets.map((packet) => packet.envelope?.taskEnvelope).filter((envelope): envelope is TaskEnvelope => Boolean(envelope));
}

function orchestratorPackets(packetState: TaskPacketBuilderState, selectedShotId?: string): LocalOrchestratorTaskPacket[] {
  return packetState.packets.map((packet, index) => ({
    packetId: packet.packetId,
    envelopeId: packet.envelopeId,
    taskKind: packet.taskKind,
    shotId: packet.envelope?.shotId || selectedShotId,
    expectedOutputs: expectedOutputs(packet),
    dependencies: packet.envelope?.taskEnvelope.dependencies || [],
    queueOrder: index,
    priority: index,
    blocked: packet.status === "blocked_missing_context",
    blockers: packet.blockedReasons,
    warnings: packet.missingContext.map((field) => `missing_context:${field}`),
    sourceRefs: ["director_workflow", packet.envelopeId || ""].filter(Boolean),
  }));
}

function scopedImageTaskPlans(runtimeState: ProjectRuntimeState, selectedShotId?: string, selectedAssetId?: string): ImageTaskPlan[] {
  const plans = runtimeState.imagePipeline?.imageTaskPlans || [];
  if (!selectedShotId && !selectedAssetId) return plans.slice(0, 2);
  return plans.filter((plan) => plan.shotId === selectedShotId || plan.taskPlanId.includes(selectedAssetId || ""));
}

function scopedImage2Requests(runtimeState: ProjectRuntimeState, imageTaskPlans: ImageTaskPlan[]): Image2AdapterRequest[] {
  const taskPlanIds = new Set(imageTaskPlans.map((plan) => plan.taskPlanId));
  return (runtimeState.imagePipeline?.image2AdapterRequests || []).filter((request) => taskPlanIds.has(request.taskPlanId));
}

function scopedAssetReadinessReports(runtimeState: ProjectRuntimeState, selectedShotId?: string): AssetReadinessReport[] {
  const reports = runtimeState.imagePipeline?.assetReadinessReports || [];
  return selectedShotId ? reports.filter((report) => report.shotId === selectedShotId) : reports;
}

function scopeLabel(editPlan: DirectorEditPlan): string {
  const selection = editPlan.selection;
  if (selection.scopeKind === "multi-shot") return `Multi-shot ${selection.shotIds?.join(", ") || selection.targetIds?.join(", ") || "selection"}`;
  if (selection.scopeKind === "shot") return `Shot ${selection.shotId || selection.targetIds?.[0] || "selection"}`;
  if (selection.scopeKind === "asset") return `Asset ${selection.assetId || selection.targetIds?.[0] || "selection"}`;
  if (selection.scopeKind === "section") return `Section ${selection.sectionId || selection.targetIds?.[0] || "selection"}`;
  if (selection.scopeKind === "export") return "Export";
  if (selection.scopeKind === "voice") return `Voice ${selection.voiceId || selection.targetIds?.[0] || "selection"}`;
  return "Project";
}

function exportShotMedia(shots: ShotRecord[]) {
  return shots.map((shot) => ({
    shotId: shot.id,
    imagePath: shot.startFrame || shot.endFrame,
    videoPath: shot.videoPath,
    durationSeconds: 3,
    videoQaPass: Object.values(shot.gates).every((gate) => gate === "PASS" || gate === "N/A"),
  }));
}

function workflowStatus(input: {
  blockedReasons: string[];
  confirmationRequired: boolean;
  taskPacketState: TaskPacketBuilderState;
}): DirectorWorkflowStatus {
  if (input.blockedReasons.some((reason) => !reason.startsWith("blocked_missing_context:"))) return "blocked";
  if (input.confirmationRequired) return "pending_confirmation";
  if (input.taskPacketState.summary.blockedMissingContext > 0) return "blocked_missing_context";
  return "dry_run_ready";
}

function nextActionsFor(status: DirectorWorkflowStatus, editPlan: DirectorEditPlan, taskPacketState: TaskPacketBuilderState): string[] {
  if (status === "blocked") {
    return [
      "Keep the workflow in dry-run review.",
      "Rewrite the request as a structured Selected Edit without provider submit, prompt bypass, real generation, or credential access.",
    ];
  }
  if (status === "pending_confirmation") {
    return ["Show the structured edit transaction and require user confirmation before planning any downstream packet."];
  }
  if (status === "blocked_missing_context") {
    return [
      "Show readable dry-run state with blocked task packets.",
      "Ask for the missing selected shot context, neighbor shots, source index, or locked asset references.",
    ];
  }
  return unique([
    `Review ${taskPacketState.summary.ready} ready dry-run packet(s).`,
    editPlan.affectedArtifacts.length ? "Display affected artifacts and reflow impact before any external worker handoff." : "",
    "Use the local orchestrator queue as a plan only; no daemon, file mutation, or provider submit is started.",
  ]);
}

function visibleBadgesFor(state: {
  status: DirectorWorkflowStatus;
  taskPacketState: TaskPacketBuilderState;
  providerGateState: ProviderLiveGateState;
  exportState: ExportBuilderState;
}): string[] {
  return unique([
    "Dry run only",
    "No provider submit",
    "No file mutation",
    "No credential access",
    "Validated envelopes required",
    state.taskPacketState.summary.blockedMissingContext ? "Missing context" : "",
    state.providerGateState.summary.blocked ? "Provider gate blocked" : "",
    state.providerGateState.summary.parked ? "Provider parked" : "",
    state.exportState.exportPackagePlan.status === "blocked" ? "Export blocked" : "Export dry-run",
    state.status === "pending_confirmation" ? "Confirmation required" : "",
  ]);
}

export function buildDirectorWorkflowState(input: BuildDirectorWorkflowStateInput): DirectorWorkflowState {
  const generatedAt = input.generatedAt || input.runtimeState.generatedAt || new Date().toISOString();
  const editPlan = buildDirectorEditPlan({
    runtimeState: input.runtimeState,
    userIntent: input.userIntent,
    selection: directorSelection(input),
    createdAt: generatedAt,
  });
  const selectedShotId = selectedShotIdFor(input, editPlan);
  const selectedAssetId = selectedAssetIdFor(input, editPlan);
  const taskPacketState = buildTaskPackets({
    runtimeState: input.runtimeState,
    selectedShotId,
    selectedAssetId,
    storyChangeTransaction: editPlan.transaction,
    requestedTaskKinds: requestedTaskKinds(editPlan),
    generatedAt,
  });
  const orchestratorState = buildLocalOrchestratorState({
    generatedAt,
    taskPackets: orchestratorPackets(taskPacketState, selectedShotId),
    taskEnvelopes: taskEnvelopes(taskPacketState),
    generationHarness: input.runtimeState.generationHarness,
    filesystemWatcherHarness: input.runtimeState.filesystemWatcherHarness,
    checkpointResumeHarness: input.runtimeState.checkpointResumeHarness,
    qaHarness: input.runtimeState.qaHarness,
    subagentRunner: input.runtimeState.subagentRunner,
    options: { autoContinue: true, concurrency: 1, now: generatedAt },
  });
  const imageTaskPlans = scopedImageTaskPlans(input.runtimeState, selectedShotId, selectedAssetId);
  const providerGateState = buildProviderLiveGateState({
    generatedAt,
    providerRegistry: input.runtimeState.imagePipeline?.providerRegistry || emptyProviderRegistry(generatedAt),
    adapterContracts: input.runtimeState.adapterContracts || emptyAdapterContracts(generatedAt),
    imageTaskPlans,
    image2AdapterRequests: scopedImage2Requests(input.runtimeState, imageTaskPlans),
    assetReadinessReports: scopedAssetReadinessReports(input.runtimeState, selectedShotId),
    shots: input.runtimeState.storyFlow?.shots || [],
    videoPlanning: input.runtimeState.videoPlanning as VideoPlanningState | undefined,
    videoExecutionPreview: input.runtimeState.videoExecutionPreview as VideoExecutionPreviewState | undefined,
    audioPlanning: input.runtimeState.audioPlanning as AudioPlanningState | undefined,
    confirmationTokens: [],
  });
  const shots = input.runtimeState.storyFlow?.shots || [];
  const exportState = buildExportBuilderState({
    generatedAt,
    shots,
    shotMedia: exportShotMedia(shots),
    previewEvents: (input.runtimeState.previewEvents || []) as PreviewEvent[],
    jobs: input.runtimeState.taskRuns?.jobs || [],
    taskRuns: (input.runtimeState.taskRuns?.runs || []) as TaskRun[],
    generationHealthReports: (input.runtimeState.imagePipeline?.generationHealthReports || []) as GenerationHealthReport[],
    qaPromotionReports: (input.runtimeState.imagePipeline?.qaPromotionReports || []) as QaPromotionReport[],
    audioPlanning: input.runtimeState.audioPlanning,
    issues: input.runtimeState.diagnostics?.issues || [],
  });

  const fatalBlockReasons = unique([...unsafeIntentReasons(input.userIntent), ...editPlan.blockedReasons]);
  const missingContextReasons = taskPacketState.packets.flatMap((packet) => packet.blockedReasons);
  const blockedReasons = unique([...fatalBlockReasons, ...missingContextReasons]);
  const confirmationRequired = editPlan.confirmationRequired && fatalBlockReasons.length === 0;
  const status = workflowStatus({ blockedReasons, confirmationRequired, taskPacketState });

  return {
    schemaVersion: "0.1.0",
    generatedAt,
    scopeLabel: scopeLabel(editPlan),
    status,
    summary: {
      userIntent: input.userIntent,
      generatedAt,
      selectedShotId,
      selectedAssetId,
      totalTaskPackets: taskPacketState.summary.total,
      readyTaskPackets: taskPacketState.summary.ready,
      blockedTaskPackets: taskPacketState.summary.blockedMissingContext,
      queueItems: orchestratorState.summary.totalItems,
      providerGateItems: providerGateState.summary.totalItems,
      exportPackageStatus: exportState.exportPackagePlan.status,
      dryRunOnly: true,
      noFileMutation: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
    },
    editPlan,
    taskPacketState,
    orchestratorState,
    providerGateState,
    exportState,
    nextActions: nextActionsFor(status, editPlan, taskPacketState),
    visibleBadges: visibleBadgesFor({ status, taskPacketState, providerGateState, exportState }),
    blockedReasons,
    confirmationRequired,
    hardLocks,
  };
}
