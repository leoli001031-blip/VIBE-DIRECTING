import { buildRuntimeView, type KnowledgeRouteTestView, type RuntimeView } from "./runtimeView";
import { buildAssetReadinessReport } from "./assetReadiness";
import { buildImageTaskPlan } from "./imageTaskPlanner";
import { buildImageKeyframeRuntimePlan } from "./imageKeyframeRuntime";
import { buildVoiceSourceLibraryState, toRuntimeVoiceSources } from "./voiceSourceLibrary";
import type { KnowledgePackManifest, KnowledgeRouteMatch, KnowledgeTaskPurpose } from "./knowledgeTypes";
import { buildImage2AdapterRequest } from "./providerAdapters/image2Adapter";
import { buildDefaultProviderRegistry } from "./providerCapabilities";
import { buildCheckpointResumeHarnessState } from "./checkpointResumeHarness";
import { buildFilesystemWatcherHarnessState } from "./filesystemWatcherHarness";
import { buildGenerationHealthReports } from "./generationHealth";
import { buildGenerationHealthCheckerState } from "./generationHealthChecker";
import { buildGenerationHarnessState } from "./generationHarness";
import { buildPromptConflictCheckerState } from "./promptConflictChecker";
import { buildQaHarnessState } from "./qaHarness";
import { buildToolRuntimeHarnessState } from "./toolRuntimeHarness";
import { buildSubagentRunnerState } from "./subagentRunner";
import { buildTaskPackets, type BuiltTaskPacket } from "./taskPacketBuilder";
import { buildAgentCliMockRunnerState } from "./agentCliMockRunner";
import { buildCodexCliAdapterSpikeState } from "./codexCliAdapterSpike";
import { buildExportWorkerState } from "./exportWorker";
import { buildProjectFileCoreState } from "./projectFileCore";
import { buildProjectFactsIntegrationState } from "./projectFactsIntegration";
import { buildShotPromptPlan } from "./promptCompiler";
import { buildQaPromotionReports } from "./qaPromotion";
import { buildPreviewExportState } from "./previewExport";
import { buildWatcherEventsFromImagePipeline } from "./watcherEvents";
import { buildAudioPlanningState } from "./audioPlanning";
import { buildVoiceAudioSettingsState } from "./voiceAudioSettings";
import { buildVideoPlanningState } from "./videoPlanning";
import { buildVideoExecutionPreviewState } from "./videoExecutionPreview";
import { buildAdapterContractState } from "./adapterContracts";
import { buildProviderLiveGateState, type ProviderLiveGateEnvelopeFact } from "./providerLiveGate";
import { buildProviderExecutionPermissionGateState } from "./providerExecutionPermissionGate";
import { buildProviderActionConfirmationReceiptState } from "./providerActionConfirmationReceipt";
import { buildProviderExecutionHandoffState } from "./providerExecutionHandoff";
import { buildLocalOrchestratorState, type LocalOrchestratorTaskPacket } from "./localOrchestrator";
import type { SubagentRuntimeGateReceipt } from "./subagentRuntimeGate";
import type { SubagentWorkerRuntimePlan } from "./subagentWorkerRuntime";
import {
  projectRuntimeCoreStateVersion,
  projectRuntimeStateSchemaVersion,
  type KnowledgeBindingSummary,
  type ProjectRuntimeKnowledgeSummary,
  type ProjectRuntimeState,
  type ProjectRuntimeTaskState,
  type RuntimeStateSource,
} from "./projectState";
import { buildRuntimeEnvironment, ensureRuntimeEnvironment } from "./runtimeConfig";
import type { ProjectAudit, ProviderSlot, SubagentTaskEnvelope } from "./types";

export const emptyKnowledgeManifest: KnowledgePackManifest = {
  schemaVersion: "0.1.0",
  manifestVersion: "empty",
  generatedAt: new Date(0).toISOString(),
  knowledgeLibraryRoot: "",
  manifestHash: "empty",
  packs: [],
};

export interface ProjectRuntimeStateBuildOptions {
  selectedShotId?: string;
  knowledgeTestIntent?: string;
  generatedAt?: string;
  stateSource?: RuntimeStateSource;
  runtime?: ProjectRuntimeState["runtime"];
  projectFactsIntegration?: ProjectRuntimeState["projectFactsIntegration"];
  agentCliMockRunner?: ProjectRuntimeState["agentCliMockRunner"];
  codexCliAdapterSpike?: ProjectRuntimeState["codexCliAdapterSpike"];
  subagentRuntimeGateReceipt?: SubagentRuntimeGateReceipt;
  subagentWorkerRuntimePlan?: SubagentWorkerRuntimePlan;
  subagentTaskEnvelope?: SubagentTaskEnvelope;
}

function toKnowledgeBindings(manifest: KnowledgePackManifest): KnowledgeBindingSummary[] {
  return manifest.packs.map((pack) => ({
    packId: pack.id,
    version: pack.version,
    hash: pack.hash,
    category: pack.category,
    title: pack.title,
    summary: pack.summary,
    tags: pack.tags || [],
    enabled: pack.enabled,
    maxInjectionTokens: pack.maxInjectionTokens,
  }));
}

function runtimeTaskToState(task: RuntimeView["taskViews"][number]): ProjectRuntimeTaskState {
  return {
    job: task.job,
    shotId: task.shot?.id,
    envelope: task.envelope,
    taskRun: task.taskRun,
    queueGate: task.queueGate,
    manifestMatch: task.manifestMatch,
    validator: task.validator,
    routeResult: task.routeResult,
    contextBudget: task.contextBudget,
    nextStep: task.nextStep,
  };
}

function buildProjectSummary(audit: ProjectAudit): ProjectRuntimeState["project"] {
  return {
    title: audit.projectTitle,
    root: audit.projectRoot,
    sourceTask: audit.sourceTask,
    state: audit.state,
    importedAt: audit.importedAt,
    metrics: audit.metrics,
    providerPolicy: audit.providerPolicy,
    workflow: audit.workflow,
    contactSheets: audit.contactSheets,
  };
}

function buildProviderLiveGateEnvelopeFacts(
  taskViews: ProjectRuntimeTaskState[],
  imageTaskPlans: ProjectRuntimeState["imagePipeline"]["imageTaskPlans"],
): ProviderLiveGateEnvelopeFact[] {
  return imageTaskPlans.map((taskPlan) => {
    const task = taskViews.find(
      (item) =>
        item.job.id === taskPlan.jobId ||
        item.envelope.id === taskPlan.taskEnvelopeSummary?.envelopeId ||
        item.envelope.preflight.taskId === taskPlan.taskEnvelopeSummary?.envelopeId,
    );
    const preflight = task?.envelope.preflight;
    const blockers = [
      ...(task?.validator.issues || []),
      ...(preflight?.blockers || []).map((blocker) => blocker.technicalDetail || blocker.messageForUser || blocker.code),
    ];
    const warnings = (preflight?.warnings || []).map(
      (warning) => warning.technicalDetail || warning.messageForUser || warning.code,
    );

    return {
      taskPlanId: taskPlan.taskPlanId,
      envelopeId: task?.envelope.id || taskPlan.taskEnvelopeSummary?.envelopeId,
      schemaName: "task_envelope.schema.json",
      valid: Boolean(task?.validator.valid && preflight?.status === "pass" && blockers.length === 0),
      blockers,
      warnings,
    };
  });
}

function buildLocalOrchestratorTaskPackets(
  imageTaskPlans: ProjectRuntimeState["imagePipeline"]["imageTaskPlans"],
  taskViews: ProjectRuntimeTaskState[],
  subagentTaskPackets: BuiltTaskPacket[] = [],
): LocalOrchestratorTaskPacket[] {
  const imagePackets = imageTaskPlans.map((taskPlan, index) => {
    const task = taskViews.find(
      (item) =>
        item.job.id === taskPlan.jobId ||
        item.envelope.id === taskPlan.taskEnvelopeSummary?.envelopeId ||
        item.envelope.preflight.taskId === taskPlan.taskEnvelopeSummary?.envelopeId,
    );

    return {
      packetId: `local_orchestrator_packet_${taskPlan.taskPlanId}`,
      taskPlanId: taskPlan.taskPlanId,
      jobId: taskPlan.jobId,
      shotId: taskPlan.shotId,
      envelopeId: task?.envelope.id || taskPlan.taskEnvelopeSummary?.envelopeId,
      taskKind: taskPlan.providerSlot,
      expectedOutputs: [taskPlan.expectedOutputPath],
      dependencies: task?.envelope.dependencies || [],
      priority: index,
      queueOrder: index,
      blocked: taskPlan.status === "blocked" || Boolean(taskPlan.blockers.length),
      blockers: taskPlan.blockers,
      warnings: taskPlan.warnings,
      sourceRefs: [
        `imageTaskPlan:${taskPlan.taskPlanId}`,
        `job:${taskPlan.jobId}`,
        ...(task?.envelope.id ? [`taskEnvelope:${task.envelope.id}`] : []),
        ...(task?.taskRun.taskId ? [`taskRun:${task.taskRun.taskId}`] : []),
      ],
    };
  });
  const subagentPackets = subagentTaskPackets.map((packet, index) => ({
    packetId: packet.packetId,
    envelopeId: packet.envelopeId,
    runnerSlotId: `subagent_runner_packet_${packet.packetId.replace(/[^a-zA-Z0-9_-]+/g, "_")}`,
    taskKind: packet.taskKind,
    shotId: packet.envelope?.shotId,
    expectedOutputs: packet.envelope?.taskEnvelope.expectedOutputs || packet.hardFields?.expectedOutputs || [],
    dependencies: packet.envelope?.taskEnvelope.dependencies || [],
    priority: imagePackets.length + index,
    queueOrder: imagePackets.length + index,
    blocked: packet.status !== "ready",
    blockers: packet.blockedReasons,
    warnings: packet.missingContext.map((field) => `missing_context:${field}`),
    sourceRefs: [
      `subagentTaskPacket:${packet.packetId}`,
      ...(packet.envelopeId ? [`subagentTaskEnvelope:${packet.envelopeId}`] : []),
    ],
  }));

  return [...imagePackets, ...subagentPackets];
}

function selectedTaskPacketAssetId(assets: ProjectAudit["assets"]): string | undefined {
  return assets.find((asset) => asset.lockedStatus === "locked" && asset.safeForFutureReference && asset.status !== "missing")?.id || assets[0]?.id;
}

export function buildProjectRuntimeState(
  audit: ProjectAudit,
  knowledgeManifest: KnowledgePackManifest = emptyKnowledgeManifest,
  options: ProjectRuntimeStateBuildOptions = {},
): ProjectRuntimeState {
  const view = buildRuntimeView(audit, knowledgeManifest, {
    selectedShotId: options.selectedShotId,
    knowledgeTestIntent: options.knowledgeTestIntent,
  });
  const taskViews = view.taskViews.map(runtimeTaskToState);
  const knowledge: ProjectRuntimeKnowledgeSummary = {
    ...view.knowledge,
    bindings: toKnowledgeBindings(knowledgeManifest),
  };
  const generatedAt = options.generatedAt || new Date().toISOString();
  const baseRuntime = options.runtime || buildRuntimeEnvironment({ generatedAt });
  const voiceSourceLibrary = buildVoiceSourceLibraryState({
    generatedAt,
    runtimeVoiceSources: baseRuntime.config.voiceSources,
  });
  const runtime = {
    ...baseRuntime,
    config: {
      ...baseRuntime.config,
      voiceSources: toRuntimeVoiceSources(voiceSourceLibrary),
    },
  };
  const projectFileCore = buildProjectFileCoreState({
    generatedAt,
    projectRoot: audit.projectRoot,
    importedAt: audit.importedAt,
    sourceTask: audit.sourceTask,
    sourceIndex: view.sourceIndex,
    storyFlow: { shots: audit.shots },
    visualMemory: { assets: audit.assets },
    runtime,
    audit,
  });
  const projectFactsIntegration =
    options.projectFactsIntegration ||
    buildProjectFactsIntegrationState({
      generatedAt,
      runtimeState: {
        storyFlow: {
          sections: view.storySections,
          shots: audit.shots,
        },
        visualMemory: {
          summary: view.visualMemory,
          assets: audit.assets,
        },
        voiceSourceLibrary,
      },
    });
  const providerRegistry = buildDefaultProviderRegistry(generatedAt);
  const promptPlanResults = taskViews.map((task) =>
    buildShotPromptPlan({
      job: task.job,
      shot: view.taskViews.find((item) => item.job.id === task.job.id)?.shot,
      assets: audit.assets,
      sourceIndex: view.sourceIndex,
      providerRegistry,
      injectedKnowledgePacks: task.envelope.injectedKnowledgePacks,
      createdAt: generatedAt,
    }),
  );
  const assetReadinessReports = audit.shots.map((shot) =>
    buildAssetReadinessReport({
      shot,
      assets: audit.assets,
      sourceIndex: view.sourceIndex,
      jobs: audit.jobs,
      checkedAt: generatedAt,
    }),
  );
  const imageTaskPlans = promptPlanResults.map((result) => {
    const task = taskViews.find((item) => item.job.id === result.plan.jobId);
    const readinessReport = result.plan.shotId
      ? assetReadinessReports.find((report) => report.shotId === result.plan.shotId)
      : undefined;

    return buildImageTaskPlan({
      job: task?.job || audit.jobs.find((job) => job.id === result.plan.jobId)!,
      promptPlan: result.plan,
      readinessReport,
      sourceIndex: view.sourceIndex,
      taskEnvelope: task?.envelope,
    });
  });
  const image2AdapterRequests = imageTaskPlans
    .filter((taskPlan) =>
      (taskPlan.status === "ready_for_dry_run" || taskPlan.status === "ready_for_manual_submit") &&
      (taskPlan.providerSlot === "image.generate" ||
        taskPlan.providerSlot === "image.edit" ||
        taskPlan.providerSlot === "image.reference_asset"),
    )
    .map((taskPlan) => {
      const promptPlan = promptPlanResults.find((result) => result.plan.promptPlanId === taskPlan.promptPlanId)?.plan;
      if (!promptPlan) return undefined;
      return buildImage2AdapterRequest(taskPlan, promptPlan);
    })
    .filter((request): request is NonNullable<typeof request> => Boolean(request));
  const watcherEvents = buildWatcherEventsFromImagePipeline({
    imageTaskPlans,
    adapterRequests: image2AdapterRequests,
    fileSnapshot: audit.fileSnapshot || [],
    manifestReports: taskViews.map((task) => task.manifestMatch),
    createdAt: generatedAt,
  });
  const generationHealthReports = buildGenerationHealthReports({
    imageTaskPlans,
    fileSnapshot: audit.fileSnapshot || [],
    manifestReports: taskViews.map((task) => task.manifestMatch),
    watcherEvents,
    assetReadinessReports,
    promptPlans: promptPlanResults.map((result) => result.plan),
  });
  const qaPromotionReports = buildQaPromotionReports({
    imageTaskPlans,
    fileSnapshot: audit.fileSnapshot || [],
    manifestReports: taskViews.map((task) => task.manifestMatch),
    generationHealthReports,
    assetReadinessReports,
    promptPlans: promptPlanResults.map((result) => result.plan),
  });
  const previewEvents = view.previewEvents;
  const audioPlanning = buildAudioPlanningState({
    generatedAt,
    shots: audit.shots,
    runtimeConfig: runtime.config,
    previewEvents,
  });
  const voiceAudioSettings = buildVoiceAudioSettingsState({
    generatedAt,
    voiceSourceLibrary,
    audioPlanning,
  });
  const videoPlanning = buildVideoPlanningState({
    generatedAt,
    shots: audit.shots,
    jobs: audit.jobs,
    taskViews,
    providerRegistry,
    audioPlanning,
    issues: audit.issues,
  });
  const imageKeyframeRuntime = buildImageKeyframeRuntimePlan({
    generatedAt,
    sourceIndex: view.sourceIndex,
    assets: audit.assets,
    assetReadinessReports,
    jobs: audit.jobs,
    promptPlans: promptPlanResults.map((result) => result.plan),
    imageTaskPlans,
    keyframePairs: videoPlanning.readinessGates
      .map((gate) => gate.keyframePairDerivation)
      .filter((pair): pair is NonNullable<typeof pair> => Boolean(pair)),
  });
  const videoExecutionPreview = buildVideoExecutionPreviewState({
    generatedAt,
    shots: audit.shots,
    videoPlanning,
    taskViews,
  });
  const taskPacketBuilderState = buildTaskPackets({
    runtimeState: {
      generatedAt,
      sourceIndex: view.sourceIndex,
      sourceIndexSummary: view.sourceIndex,
      storyFlow: { shots: audit.shots },
      visualMemory: { assets: audit.assets },
      videoPlanning,
    } as unknown as ProjectRuntimeState,
    selectedShotId: options.selectedShotId,
    selectedAssetId: selectedTaskPacketAssetId(audit.assets),
    generatedAt,
  });
  const adapterContracts = buildAdapterContractState({
    generatedAt,
    providerRegistry,
  });
  const providerLiveGate = buildProviderLiveGateState({
    generatedAt,
    providerRegistry,
    adapterContracts,
    imageTaskPlans,
    image2AdapterRequests,
    assetReadinessReports,
    shots: audit.shots,
    videoPlanning,
    videoExecutionPreview,
    audioPlanning,
    envelopeFacts: buildProviderLiveGateEnvelopeFacts(taskViews, imageTaskPlans),
    confirmationTokens: [],
  });
  const generationHarness = buildGenerationHarnessState({
    generatedAt,
    imageTaskPlans,
    promptPlans: promptPlanResults.map((result) => result.plan),
    promptConflictReports: promptPlanResults.map((result) => result.conflictReport),
    assetReadinessReports,
    image2AdapterRequests,
    watcherEvents,
    generationHealthReports,
    qaPromotionReports,
  });
  const filesystemWatcherHarness = buildFilesystemWatcherHarnessState({
    generatedAt,
    projectRoot: audit.projectRoot,
    fileSnapshot: audit.fileSnapshot || [],
    manifestMatches: taskViews.map((task) => task.manifestMatch),
    imageTaskPlans,
    image2AdapterRequests,
    watcherEvents,
    generationHealthReports,
    qaPromotionReports,
    generationHarness,
  });
  const checkpointResumeHarness = buildCheckpointResumeHarnessState({
    generatedAt,
    fileSnapshot: audit.fileSnapshot || [],
    manifestMatches: taskViews.map((task) => task.manifestMatch),
    imageTaskPlans,
    generationHealthReports,
    qaPromotionReports,
    generationHarness,
    filesystemWatcherHarness,
  });
  const qaHarness = buildQaHarnessState({
    generatedAt,
    generationHealthReports,
    qaPromotionReports,
    manifestMatches: taskViews.map((task) => task.manifestMatch),
    assetReadinessReports,
    promptPlans: promptPlanResults.map((result) => result.plan),
    promptConflictReports: promptPlanResults.map((result) => result.conflictReport),
    generationHarness,
    filesystemWatcherHarness,
    checkpointResumeHarness,
    videoPlanning,
    audioPlanning,
    storyFlowShots: audit.shots,
  });
  const toolRuntimeHarness = buildToolRuntimeHarnessState({
    generatedAt,
    runtime,
    adapterContracts,
    generationHarness,
    filesystemWatcherHarness,
    checkpointResumeHarness,
    qaHarness,
  });
  const subagentRunner = buildSubagentRunnerState({
    generatedAt,
    taskPackets: taskPacketBuilderState.packets,
    videoExecutionPreview,
    generationHarness,
    qaHarness,
  });
  const localOrchestrator = buildLocalOrchestratorState({
    generatedAt,
    taskPackets: buildLocalOrchestratorTaskPackets(imageTaskPlans, taskViews, taskPacketBuilderState.packets),
    taskEnvelopes: taskViews.map((task) => task.envelope),
    taskRuns: taskViews.map((task) => task.taskRun),
    generationHarness,
    filesystemWatcherHarness,
    checkpointResumeHarness,
    qaHarness,
    subagentRunner,
    options: { autoContinue: true, concurrency: 1, now: generatedAt },
  });
  const agentCliMockRunner = options.agentCliMockRunner || buildAgentCliMockRunnerState({
    generatedAt,
    gateReceipt: options.subagentRuntimeGateReceipt,
    subagentTaskEnvelope: options.subagentTaskEnvelope,
    envelopeId: options.subagentTaskEnvelope?.id ||
      options.subagentRuntimeGateReceipt?.evidence.subject.envelopeId ||
      options.subagentWorkerRuntimePlan?.slots.find((slot) => slot.envelopeValidation.status === "valid")?.envelopeId,
  });
  const codexCliAdapterSpike = options.codexCliAdapterSpike || buildCodexCliAdapterSpikeState({
    generatedAt,
    phase26ReplacementProof: agentCliMockRunner,
    subagentTaskEnvelope: options.subagentTaskEnvelope,
    envelopeId: options.subagentTaskEnvelope?.id || taskViews.find((task) => task.validator.valid)?.envelope.id,
  });
  const providerExecutionPermissionGate = buildProviderExecutionPermissionGateState({
    generatedAt,
    providerLiveGate,
    codexCliAdapterSpike,
  });
  const providerActionConfirmationReceipt = buildProviderActionConfirmationReceiptState({
    generatedAt,
    providerExecutionPermissionGate,
  });
  const providerExecutionHandoff = buildProviderExecutionHandoffState({
    generatedAt,
    providerActionConfirmationReceipt,
  });
  const generationHealthChecker = buildGenerationHealthCheckerState({
    generatedAt,
    imageTaskPlans,
    generationHealthReports,
    manifestMatches: taskViews.map((task) => task.manifestMatch),
    watcherEvents,
    taskRuns: taskViews.map((task) => task.taskRun),
    jobs: audit.jobs,
    fileSnapshot: audit.fileSnapshot || [],
  });
  const promptConflictChecker = buildPromptConflictCheckerState({
    generatedAt,
    promptPlans: promptPlanResults.map((result) => result.plan),
    promptConflictReports: promptPlanResults.map((result) => result.conflictReport),
    shots: audit.shots,
    assets: audit.assets,
    jobs: audit.jobs,
  });
  const previewExport = buildPreviewExportState({
    generatedAt,
    projectRoot: audit.projectRoot,
    previewEvents,
    shots: audit.shots,
    jobs: audit.jobs,
    taskRuns: taskViews.map((task) => task.taskRun),
    taskViews: taskViews.map((task) => ({
      job: task.job,
      shotId: task.shotId,
      taskRun: task.taskRun,
      manifestMatch: task.manifestMatch,
    })),
    manifestMatches: taskViews.map((task) => task.manifestMatch),
    generationHealthReports,
    qaPromotionReports,
    issues: audit.issues,
  });
  const exportWorker = buildExportWorkerState({
    source: previewExport,
    exportRoot: "exports/export-worker",
    generatedAt,
    executionMode: "plan_only",
  });

  return {
    schemaVersion: projectRuntimeStateSchemaVersion,
    coreStateVersion: projectRuntimeCoreStateVersion,
    generatedAt,
    project: buildProjectSummary(audit),
    projectFileCore,
    projectFactsIntegration,
    sourceIndex: view.sourceIndex,
    sourceIndexSummary: view.sourceIndexSummary,
    storyFlow: {
      sections: view.storySections,
      shots: audit.shots,
    },
    visualMemory: {
      summary: view.visualMemory,
      assets: audit.assets,
    },
    taskRuns: {
      jobs: audit.jobs,
      runs: taskViews.map((task) => task.taskRun),
      taskViews,
      queueSummary: view.queueSummary,
      preflightSummary: view.preflightSummary,
    },
    manifestMatches: {
      summary: view.manifestSummary,
      reports: taskViews.map((task) => task.manifestMatch),
    },
    imagePipeline: {
      providerRegistry,
      promptPlans: promptPlanResults.map((result) => result.plan),
      promptConflictReports: promptPlanResults.map((result) => result.conflictReport),
      assetReadinessReports,
      imageTaskPlans,
      image2AdapterRequests,
      watcherEvents,
      generationHealthReports,
      qaPromotionReports,
    },
    imageKeyframeRuntime,
    previewEvents,
    previewExport,
    exportWorker,
    voiceSourceLibrary,
    audioPlanning,
    voiceAudioSettings,
    videoPlanning,
    videoExecutionPreview,
    adapterContracts,
    providerLiveGate,
    providerExecutionPermissionGate,
    providerActionConfirmationReceipt,
    providerExecutionHandoff,
    localOrchestrator,
    generationHarness,
    filesystemWatcherHarness,
    checkpointResumeHarness,
    qaHarness,
    toolRuntimeHarness,
    subagentRunner,
    agentCliMockRunner,
    codexCliAdapterSpike,
    generationHealthChecker,
    promptConflictChecker,
    storyChanges: {
      transactions: [],
      reflowReports: [],
      pendingConfirmationCount: 0,
      lastGeneratedAt: generatedAt,
    },
    runtime,
    diagnostics: {
      issues: audit.issues,
      schemaSummary: audit.schemaSummary,
      generatedBy: "src/core/projectStateBuilder.ts",
    },
    knowledge,
    stateSource: options.stateSource || {
      kind: "runtime-state",
      label: "runtime-state",
      path: "/runtime-state.json",
      sourceImportedAt: audit.importedAt,
    },
  };
}

export function auditFromProjectRuntimeState(state: ProjectRuntimeState): ProjectAudit {
  return {
    importedAt: state.project.importedAt,
    projectTitle: state.project.title,
    projectRoot: state.project.root,
    sourceTask: state.project.sourceTask,
    state: state.project.state,
    sourceIndex: state.sourceIndex,
    schemaSummary: state.diagnostics.schemaSummary,
    metrics: state.project.metrics,
    providerPolicy: state.project.providerPolicy,
    workflow: state.project.workflow,
    assets: state.visualMemory.assets,
    shots: state.storyFlow.shots,
    jobs: state.taskRuns.jobs,
    issues: state.diagnostics.issues,
    contactSheets: state.project.contactSheets,
  };
}

export function withRuntimeDefaults(state: ProjectRuntimeState): ProjectRuntimeState {
  const runtime = ensureRuntimeEnvironment(state.runtime, {
    generatedAt: state.generatedAt,
    platform: state.runtime?.config?.platform || state.runtime?.detectionReport?.platform,
  });
  const voiceSourceLibrary =
    state.voiceSourceLibrary ||
    buildVoiceSourceLibraryState({
      generatedAt: state.generatedAt,
      runtimeVoiceSources: runtime.config.voiceSources,
    });
  const runtimeWithVoiceSources = {
    ...runtime,
    config: {
      ...runtime.config,
      voiceSources: toRuntimeVoiceSources(voiceSourceLibrary),
    },
  };
  const audioPlanningResolved =
    state.audioPlanning ||
    buildAudioPlanningState({
      generatedAt: state.generatedAt,
      shots: state.storyFlow.shots,
      runtimeConfig: runtimeWithVoiceSources.config,
      previewEvents: state.previewEvents,
    });
  const voiceAudioSettings =
    state.voiceAudioSettings ||
    buildVoiceAudioSettingsState({
      generatedAt: state.generatedAt,
      voiceSourceLibrary,
      audioPlanning: audioPlanningResolved,
    });
  const videoPlanning =
    state.videoPlanning ||
    buildVideoPlanningState({
      generatedAt: state.generatedAt,
      shots: state.storyFlow.shots,
      jobs: state.taskRuns.jobs,
      taskViews: state.taskRuns.taskViews,
      providerRegistry: state.imagePipeline.providerRegistry,
      audioPlanning: audioPlanningResolved,
      issues: state.diagnostics.issues,
    });
  const imageKeyframeRuntime =
    state.imageKeyframeRuntime ||
    buildImageKeyframeRuntimePlan({
      generatedAt: state.generatedAt,
      sourceIndex: state.sourceIndex,
      assets: state.visualMemory.assets,
      assetReadinessReports: state.imagePipeline.assetReadinessReports,
      jobs: state.taskRuns.jobs,
      promptPlans: state.imagePipeline.promptPlans,
      imageTaskPlans: state.imagePipeline.imageTaskPlans,
      keyframePairs: videoPlanning.readinessGates
        .map((gate) => gate.keyframePairDerivation)
        .filter((pair): pair is NonNullable<typeof pair> => Boolean(pair)),
    });
  const videoExecutionPreview =
    state.videoExecutionPreview ||
    buildVideoExecutionPreviewState({
      generatedAt: state.generatedAt,
      shots: state.storyFlow.shots,
      videoPlanning,
      taskViews: state.taskRuns.taskViews,
    });
  const adapterContracts =
    state.adapterContracts ||
    buildAdapterContractState({
      generatedAt: state.generatedAt,
      providerRegistry: state.imagePipeline.providerRegistry,
    });
  const providerLiveGate =
    state.providerLiveGate ||
    buildProviderLiveGateState({
      generatedAt: state.generatedAt,
      providerRegistry: state.imagePipeline.providerRegistry,
      adapterContracts,
      imageTaskPlans: state.imagePipeline.imageTaskPlans,
      image2AdapterRequests: state.imagePipeline.image2AdapterRequests,
      assetReadinessReports: state.imagePipeline.assetReadinessReports,
      shots: state.storyFlow.shots,
      videoPlanning,
      videoExecutionPreview,
      audioPlanning: audioPlanningResolved,
      envelopeFacts: buildProviderLiveGateEnvelopeFacts(state.taskRuns.taskViews, state.imagePipeline.imageTaskPlans),
      confirmationTokens: [],
    });
  const generationHarness =
    state.generationHarness ||
    buildGenerationHarnessState({
      generatedAt: state.generatedAt,
      imageTaskPlans: state.imagePipeline.imageTaskPlans,
      promptPlans: state.imagePipeline.promptPlans,
      promptConflictReports: state.imagePipeline.promptConflictReports,
      assetReadinessReports: state.imagePipeline.assetReadinessReports,
      image2AdapterRequests: state.imagePipeline.image2AdapterRequests,
      watcherEvents: state.imagePipeline.watcherEvents,
      generationHealthReports: state.imagePipeline.generationHealthReports,
      qaPromotionReports: state.imagePipeline.qaPromotionReports,
    });
  const filesystemWatcherHarness =
    state.filesystemWatcherHarness ||
    buildFilesystemWatcherHarnessState({
      generatedAt: state.generatedAt,
      projectRoot: state.project.root,
      fileSnapshot: state.legacyAudit?.fileSnapshot || [],
      manifestMatches: state.manifestMatches.reports,
      imageTaskPlans: state.imagePipeline.imageTaskPlans,
      image2AdapterRequests: state.imagePipeline.image2AdapterRequests,
      watcherEvents: state.imagePipeline.watcherEvents,
      generationHealthReports: state.imagePipeline.generationHealthReports,
      qaPromotionReports: state.imagePipeline.qaPromotionReports,
      generationHarness,
    });
  const checkpointResumeHarness =
    state.checkpointResumeHarness ||
    buildCheckpointResumeHarnessState({
      generatedAt: state.generatedAt,
      fileSnapshot: state.legacyAudit?.fileSnapshot || [],
      manifestMatches: state.manifestMatches.reports,
      imageTaskPlans: state.imagePipeline.imageTaskPlans,
      generationHealthReports: state.imagePipeline.generationHealthReports,
      qaPromotionReports: state.imagePipeline.qaPromotionReports,
      generationHarness,
      filesystemWatcherHarness,
    });
  const qaHarness =
    state.qaHarness ||
    buildQaHarnessState({
      generatedAt: state.generatedAt,
      generationHealthReports: state.imagePipeline.generationHealthReports,
      qaPromotionReports: state.imagePipeline.qaPromotionReports,
      manifestMatches: state.manifestMatches.reports,
      assetReadinessReports: state.imagePipeline.assetReadinessReports,
      promptPlans: state.imagePipeline.promptPlans,
      promptConflictReports: state.imagePipeline.promptConflictReports,
      generationHarness,
      filesystemWatcherHarness,
      checkpointResumeHarness,
      videoPlanning,
      audioPlanning: audioPlanningResolved,
      storyFlowShots: state.storyFlow.shots,
    });
  const toolRuntimeHarness =
    state.toolRuntimeHarness ||
    buildToolRuntimeHarnessState({
      generatedAt: state.generatedAt,
      runtime: runtimeWithVoiceSources,
      adapterContracts,
      generationHarness,
      filesystemWatcherHarness,
      checkpointResumeHarness,
      qaHarness,
    });
  const taskPacketBuilderState = buildTaskPackets({
    runtimeState: state,
    selectedShotId: undefined,
    selectedAssetId: selectedTaskPacketAssetId(state.visualMemory.assets),
    generatedAt: state.generatedAt,
  });
  const subagentRunner =
    state.subagentRunner ||
    buildSubagentRunnerState({
      generatedAt: state.generatedAt,
      taskPackets: taskPacketBuilderState.packets,
      videoExecutionPreview,
      generationHarness,
      qaHarness,
    });
  const localOrchestrator =
    state.localOrchestrator ||
    buildLocalOrchestratorState({
      generatedAt: state.generatedAt,
      taskPackets: buildLocalOrchestratorTaskPackets(
        state.imagePipeline.imageTaskPlans,
        state.taskRuns.taskViews,
        taskPacketBuilderState.packets,
      ),
      taskEnvelopes: state.taskRuns.taskViews.map((task) => task.envelope),
      taskRuns: state.taskRuns.taskViews.map((task) => task.taskRun),
      generationHarness,
      filesystemWatcherHarness,
      checkpointResumeHarness,
      qaHarness,
      subagentRunner,
      options: { autoContinue: true, concurrency: 1, now: state.generatedAt },
    });
  const agentCliMockRunner =
    state.agentCliMockRunner ||
    buildAgentCliMockRunnerState({
      generatedAt: state.generatedAt,
      envelopeId: state.taskRuns.taskViews.find((task) => task.validator.valid)?.envelope.id,
    });
  const codexCliAdapterSpike =
    state.codexCliAdapterSpike ||
    buildCodexCliAdapterSpikeState({
      generatedAt: state.generatedAt,
      phase26ReplacementProof: agentCliMockRunner,
      envelopeId: state.taskRuns.taskViews.find((task) => task.validator.valid)?.envelope.id,
    });
  const providerExecutionPermissionGate =
    state.providerExecutionPermissionGate ||
    buildProviderExecutionPermissionGateState({
      generatedAt: state.generatedAt,
      providerLiveGate,
      codexCliAdapterSpike,
    });
  const providerActionConfirmationReceipt =
    state.providerActionConfirmationReceipt ||
    buildProviderActionConfirmationReceiptState({
      generatedAt: state.generatedAt,
      providerExecutionPermissionGate,
    });
  const providerExecutionHandoff =
    state.providerExecutionHandoff ||
    buildProviderExecutionHandoffState({
      generatedAt: state.generatedAt,
      providerActionConfirmationReceipt,
    });
  const generationHealthChecker =
    state.generationHealthChecker ||
    buildGenerationHealthCheckerState({
      generatedAt: state.generatedAt,
      imageTaskPlans: state.imagePipeline.imageTaskPlans,
      generationHealthReports: state.imagePipeline.generationHealthReports,
      manifestMatches: state.manifestMatches.reports,
      watcherEvents: state.imagePipeline.watcherEvents,
      taskRuns: state.taskRuns.runs,
      jobs: state.taskRuns.jobs,
      fileSnapshot: state.legacyAudit?.fileSnapshot || [],
    });
  const promptConflictChecker =
    state.promptConflictChecker ||
    buildPromptConflictCheckerState({
      generatedAt: state.generatedAt,
      promptPlans: state.imagePipeline.promptPlans,
      promptConflictReports: state.imagePipeline.promptConflictReports,
      shots: state.storyFlow.shots,
      assets: state.visualMemory.assets,
      jobs: state.taskRuns.jobs,
    });
  const projectFileCore =
    state.projectFileCore ||
    buildProjectFileCoreState({
      generatedAt: state.generatedAt,
      projectRoot: state.project.root,
      importedAt: state.project.importedAt,
      sourceTask: state.project.sourceTask,
      sourceIndex: state.sourceIndex,
      storyFlow: { shots: state.storyFlow.shots },
      visualMemory: { assets: state.visualMemory.assets },
      runtime: runtimeWithVoiceSources,
      audit: state.legacyAudit,
    });
  const projectFactsIntegration =
    state.projectFactsIntegration ||
    buildProjectFactsIntegrationState({
      generatedAt: state.generatedAt,
      runtimeState: {
        storyFlow: state.storyFlow,
        visualMemory: state.visualMemory,
        voiceSourceLibrary,
      },
    });
  const exportWorker =
    state.exportWorker ||
    buildExportWorkerState({
      source: state.previewExport,
      exportRoot: "exports/export-worker",
      generatedAt: state.generatedAt,
      executionMode: "plan_only",
    });

  return {
    ...state,
    projectFileCore,
    projectFactsIntegration,
    runtime: runtimeWithVoiceSources,
    voiceSourceLibrary,
    audioPlanning: audioPlanningResolved,
    voiceAudioSettings,
    videoPlanning,
    imageKeyframeRuntime,
    exportWorker,
    videoExecutionPreview,
    adapterContracts,
    providerLiveGate,
    providerExecutionPermissionGate,
    providerActionConfirmationReceipt,
    providerExecutionHandoff,
    localOrchestrator,
    generationHarness,
    filesystemWatcherHarness,
    checkpointResumeHarness,
    qaHarness,
    toolRuntimeHarness,
    subagentRunner,
    agentCliMockRunner,
    codexCliAdapterSpike,
    generationHealthChecker,
    promptConflictChecker,
  };
}

function inferRoutePurpose(intent: string): { purpose: KnowledgeTaskPurpose; slot?: ProviderSlot } {
  const lowered = intent.toLowerCase();
  if (/qa|audit|验收|检查|审计|连续性/.test(lowered)) return { purpose: "qa" };
  if (/脚本|剧本|story|storyflow|分镜|对白/.test(lowered)) return { purpose: "script" };
  if (/视频|i2v|seedance|即梦|运镜|motion|镜头运动/.test(lowered)) return { purpose: "i2v", slot: "video.i2v" };
  if (/关键帧|image|prompt|构图|光|色彩|风格/.test(lowered)) return { purpose: "keyframe", slot: "image.edit" };
  if (/旁白|音乐|声音|tts|voice|audio/.test(lowered)) return { purpose: "audio", slot: "audio.tts" };
  return { purpose: "unknown" };
}

function tokenizeIntent(intent: string): string[] {
  return Array.from(new Set(intent.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter((item) => item.length >= 2)));
}

function buildRouteTestFromStateKnowledge(
  knowledge: ProjectRuntimeKnowledgeSummary,
  intent?: string,
): KnowledgeRouteTestView | undefined {
  const trimmed = intent?.trim();
  if (!trimmed) return knowledge.routeTest;

  const terms = tokenizeIntent(trimmed);
  const inferred = inferRoutePurpose(trimmed);
  const matches: KnowledgeRouteMatch[] = knowledge.bindings
    .filter((binding) => binding.enabled)
    .map((binding) => {
      const haystack = [binding.packId, binding.category, binding.title, binding.summary, ...binding.tags].join(" ").toLowerCase();
      const matchedTerms = terms.filter((term) => haystack.includes(term));
      const score = matchedTerms.length + (haystack.includes(String(inferred.purpose)) ? 1 : 0);
      return {
        packId: binding.packId,
        version: binding.version,
        hash: binding.hash,
        category: binding.category,
        reason: score > 0 ? "Matched state knowledge summary." : "Available enabled knowledge binding.",
        consumer: "diagnostics" as const,
        score,
        matchedTerms,
        matchedSnippetIds: [],
      };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.packId.localeCompare(right.packId))
    .slice(0, 8);

  const routeResult = {
    routeId: `state-route-${Math.abs(trimmed.split("").reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261)).toString(16)}`,
    taskPurpose: inferred.purpose,
    providerSlot: inferred.slot,
    contextLevel: "L1" as const,
    inputHash: `state-${terms.join("-") || "empty"}`,
    matches,
    warnings: matches.length ? [] : ["No enabled knowledge binding matched this state summary."],
    createdAt: new Date().toISOString(),
  };
  const contextBudget = {
    budgetId: `${routeResult.routeId}-budget`,
    routeId: routeResult.routeId,
    contextLevel: "L1" as const,
    maxInjectionTokens: 700,
    usedTokens: 0,
    injectedKnowledgePacks: matches.map((match) => ({
      packId: match.packId,
      version: match.version,
      hash: match.hash,
      category: match.category,
      reason: match.reason,
      consumer: match.consumer,
      injectedSnippetIds: [],
      summaryHash: match.hash,
      truncated: false,
    })),
    injectedSnippets: [],
    warnings: routeResult.warnings,
    createdAt: routeResult.createdAt,
  };

  return { intent: trimmed, routeResult, contextBudget };
}

function deriveNextStep(taskViews: RuntimeView["taskViews"]) {
  const firstBlocked = taskViews.find((task) => task.queueGate.status === "blocked");
  if (firstBlocked) return firstBlocked.nextStep;
  const firstParked = taskViews.find((task) => task.queueGate.status === "parked");
  if (firstParked) return firstParked.nextStep;
  const firstReady = taskViews.find((task) => task.queueGate.status === "ready");
  if (firstReady) return firstReady.nextStep;
  return "Import a runtime state or select a shot";
}

export function buildRuntimeViewFromProjectState(
  state: ProjectRuntimeState,
  options: { selectedShotId?: string; knowledgeTestIntent?: string } = {},
): RuntimeView {
  const audit = auditFromProjectRuntimeState(state);
  const taskViews = state.taskRuns.taskViews.map((task) => ({
    ...task,
    shot: task.shotId ? state.storyFlow.shots.find((shot) => shot.id === task.shotId) : undefined,
  }));
  const selectedTasks = options.selectedShotId ? taskViews.filter((task) => task.shot?.id === options.selectedShotId) : taskViews;
  const knowledge = {
    ...state.knowledge,
    routeTest: buildRouteTestFromStateKnowledge(state.knowledge, options.knowledgeTestIntent),
  };

  return {
    audit,
    sourceIndex: state.sourceIndex,
    sourceIndexSummary: state.sourceIndexSummary,
    storySections: state.storyFlow.sections,
    visualMemory: state.visualMemory.summary,
    taskViews,
    queueSummary: state.taskRuns.queueSummary,
    preflightSummary: state.taskRuns.preflightSummary,
    previewEvents: state.previewEvents,
    manifestSummary: state.manifestMatches.summary,
    knowledge,
    nextStep: deriveNextStep(selectedTasks.length ? selectedTasks : taskViews),
    stateSource: state.stateSource,
  };
}
