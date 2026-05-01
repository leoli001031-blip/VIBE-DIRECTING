import type { EnvelopeValidationResult } from "./envelopeValidator";
import type { ContextBudgetResult, KnowledgePackCategory, KnowledgeRouteResult } from "./knowledgeTypes";
import type { ManifestMatchReport } from "./manifestMatcher";
import type { ImageKeyframeRuntimePlan } from "./imageKeyframeRuntime";
import type { StorySectionView, VisualMemorySummary, RuntimeKnowledgeSummary } from "./runtimeView";
import type { VoiceSourceLibraryState } from "./voiceSourceLibrary";
import type { VoiceAudioSettingsState } from "./voiceAudioSettings";
import type { QueueGateResult } from "./taskQueue";
import type { AgentCliMockRunnerState } from "./agentCliMockRunner";
import type { CodexCliAdapterSpikeState } from "./codexCliAdapterSpike";
import type { ExportWorkerState } from "./exportWorker";
import type { ProviderLiveGateState } from "./providerLiveGate";
import type { ProviderExecutionPermissionGateState } from "./providerExecutionPermissionGate";
import type { ProviderActionConfirmationReceiptState } from "./providerActionConfirmationReceipt";
import type {
  AssetRecord,
  AssetReadinessReport,
  AdapterContractState,
  AudioPlanningState,
  CheckpointResumeHarnessState,
  FilesystemWatcherHarnessState,
  GenerationHealthCheckerState,
  GenerationHarnessState,
  AuditIssue,
  GenerationHealthReport,
  GenerationJob,
  Image2AdapterRequest,
  ImageTaskPlan,
  PreviewEvent,
  ProjectAudit,
  ProjectMetrics,
  ProjectPreviewExportState,
  ProjectRuntimeEnvironment,
  ProjectSourceIndex,
  ProviderPolicy,
  ProviderRegistry,
  PromptConflictCheckerState,
  PromptConflictReport,
  ProjectFileCoreState,
  QaHarnessState,
  QaPromotionReport,
  ReflowImpactReport,
  ShotPromptPlan,
  StoryChangeTransaction,
  SubagentRunnerState,
  TaskEnvelope,
  TaskRun,
  ToolRuntimeHarnessState,
  VideoExecutionPreviewState,
  VideoPlanningState,
  WatcherEvent,
  WorkflowStage,
} from "./types";

export const projectRuntimeStateSchemaVersion = "0.1.0";
export const projectRuntimeCoreStateVersion = "project-runtime-state/0.1.0";

export type RuntimeStateSourceKind = "runtime-state" | "runtime-audit-fallback" | "fallback-audit";

export interface RuntimeStateSource {
  kind: RuntimeStateSourceKind;
  label: string;
  path?: string;
  sourceAuditPath?: string;
  sourceImportedAt?: string;
  note?: string;
}

export interface ProjectSummary {
  title: string;
  root: string;
  sourceTask: string;
  state: string;
  importedAt: string;
  metrics: ProjectMetrics;
  providerPolicy: ProviderPolicy;
  workflow: WorkflowStage[];
  contactSheets: ProjectAudit["contactSheets"];
}

export interface KnowledgeBindingSummary {
  packId: string;
  version: string;
  hash: string;
  category: KnowledgePackCategory;
  title: string;
  summary: string;
  tags: string[];
  enabled: boolean;
  maxInjectionTokens: number;
}

export interface ProjectRuntimeKnowledgeSummary extends RuntimeKnowledgeSummary {
  bindings: KnowledgeBindingSummary[];
}

export interface ProjectRuntimeTaskState {
  job: GenerationJob;
  shotId?: string;
  envelope: TaskEnvelope;
  taskRun: TaskRun;
  queueGate: QueueGateResult;
  manifestMatch: ManifestMatchReport;
  validator: EnvelopeValidationResult;
  routeResult: KnowledgeRouteResult;
  contextBudget: ContextBudgetResult;
  nextStep: string;
}

export interface ProjectRuntimeStoryChangeState {
  transactions: StoryChangeTransaction[];
  reflowReports: ReflowImpactReport[];
  pendingConfirmationCount: number;
  lastGeneratedAt: string;
}

export interface ProjectRuntimeState {
  schemaVersion: string;
  coreStateVersion: string;
  generatedAt: string;
  project: ProjectSummary;
  projectFileCore: ProjectFileCoreState;
  sourceIndex: ProjectSourceIndex;
  sourceIndexSummary: {
    projectId: string;
    projectVersion: string;
    sourceIndexHash: string;
    currentSourceCount: number;
    promptHashCount: number;
    lockedReferenceCount: number;
    candidateReferenceCount: number;
    rejectedReferenceCount: number;
    failedReferenceCount: number;
    confirmedDecisionCount: number;
    staleArtifactCount: number;
    updatedAt: string;
    isProductionReady: boolean;
    blockingReferenceCount: number;
  };
  storyFlow: {
    sections: StorySectionView[];
    shots: ProjectAudit["shots"];
  };
  visualMemory: {
    summary: VisualMemorySummary;
    assets: AssetRecord[];
  };
  taskRuns: {
    jobs: GenerationJob[];
    runs: TaskRun[];
    taskViews: ProjectRuntimeTaskState[];
    queueSummary: {
      total: number;
      ready: number;
      blocked: number;
      parked: number;
      succeeded: number;
      missingOutputs: number;
    };
    preflightSummary: {
      blocked: number;
      warnings: number;
      blockers: ProjectRuntimeTaskState["envelope"]["preflight"]["blockers"];
    };
  };
  manifestMatches: {
    summary: {
      complete: number;
      present: number;
      missing: number;
      recoverable: number;
    };
    reports: ManifestMatchReport[];
  };
  imagePipeline: {
    providerRegistry: ProviderRegistry;
    promptPlans: ShotPromptPlan[];
    promptConflictReports: PromptConflictReport[];
    assetReadinessReports: AssetReadinessReport[];
    imageTaskPlans: ImageTaskPlan[];
    image2AdapterRequests: Image2AdapterRequest[];
    watcherEvents: WatcherEvent[];
    generationHealthReports: GenerationHealthReport[];
    qaPromotionReports: QaPromotionReport[];
  };
  imageKeyframeRuntime: ImageKeyframeRuntimePlan;
  previewEvents: PreviewEvent[];
  previewExport: ProjectPreviewExportState;
  exportWorker: ExportWorkerState;
  voiceSourceLibrary: VoiceSourceLibraryState;
  audioPlanning: AudioPlanningState;
  voiceAudioSettings: VoiceAudioSettingsState;
  videoPlanning: VideoPlanningState;
  videoExecutionPreview: VideoExecutionPreviewState;
  adapterContracts: AdapterContractState;
  providerLiveGate: ProviderLiveGateState;
  providerExecutionPermissionGate: ProviderExecutionPermissionGateState;
  providerActionConfirmationReceipt: ProviderActionConfirmationReceiptState;
  generationHarness: GenerationHarnessState;
  filesystemWatcherHarness: FilesystemWatcherHarnessState;
  checkpointResumeHarness: CheckpointResumeHarnessState;
  qaHarness: QaHarnessState;
  toolRuntimeHarness: ToolRuntimeHarnessState;
  subagentRunner: SubagentRunnerState;
  agentCliMockRunner: AgentCliMockRunnerState;
  codexCliAdapterSpike: CodexCliAdapterSpikeState;
  generationHealthChecker: GenerationHealthCheckerState;
  promptConflictChecker: PromptConflictCheckerState;
  storyChanges: ProjectRuntimeStoryChangeState;
  runtime: ProjectRuntimeEnvironment;
  diagnostics: {
    issues: AuditIssue[];
    schemaSummary?: ProjectAudit["schemaSummary"];
    generatedBy: string;
  };
  knowledge: ProjectRuntimeKnowledgeSummary;
  stateSource: RuntimeStateSource;
  /** Optional debug-only legacy snapshot. UI state is rebuilt from first-class fields. */
  legacyAudit?: ProjectAudit;
}
