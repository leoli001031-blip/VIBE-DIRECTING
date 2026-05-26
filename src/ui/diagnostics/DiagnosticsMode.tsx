import type { ReactNode } from "react";
import { Database, Gauge, Layers3, PauseCircle, PlugZap, ShieldAlert } from "lucide-react";
import type { ProjectAudit, ShotRecord } from "../../core/types";
import type { RuntimeView, TaskRuntimeView } from "../../core/runtimeView";
import type { ProjectRuntimeState } from "../../core/projectState";
import { DirectorProgressStrip, buildDirectorProgressStripState } from "../director/DirectorProgressStrip";
import {
  ProjectRealChainPanel,
  type ProjectImage2BatchPanelState,
  type ProjectImage2OneShotPanelState,
  type ProjectRealChainPanelState,
  type ProjectRound5StrictEditPreflightPanelState,
} from "../project/ProjectRealChainPanel";
import {
  ProjectFactsStrip,
  type ProjectFactsUiMode,
  type ProjectFactsUiSummary,
} from "./ProjectFactsStrip";
import { Metric, StatusPill } from "../common/DiagnosticsPrimitives";
import { AudioDiagnosticsPanel } from "./AudioDiagnosticsPanel";
import { PreviewExportDiagnostics } from "./PreviewExportDiagnostics";
import {
  ProviderActionConfirmationReceiptDiagnostics,
  ProviderEnablementGateDiagnostics,
  ProviderExecutionHandoffDiagnostics,
  ProviderExecutionPermissionGateDiagnostics,
} from "./ProviderGateDiagnostics";
import { VideoPlanningDiagnostics } from "./VideoPlanningDiagnostics";
import { VideoExecutionPreviewDiagnostics } from "./VideoExecutionPreviewDiagnostics";
import { AdapterContractDiagnostics } from "./AdapterContractDiagnostics";
import { ExportWorkerDiagnostics } from "./ExportWorkerDiagnostics";
import { AgentCliMockRunnerDiagnostics } from "./AgentCliMockRunnerDiagnostics";
import { CliAdapterSpikeDiagnostics } from "./CliAdapterSpikeDiagnostics";
import { SubagentWorkerRuntimeDiagnostics } from "./SubagentWorkerRuntimeDiagnostics";
import { Image2KeyframeRuntimeDiagnostics } from "./Image2KeyframeRuntimeDiagnostics";
import { RealPilotDiagnostics } from "./RealPilotDiagnostics";
import { ImagePipelineDiagnostics } from "./ImagePipelineDiagnostics";
import { GenerationHealthCheckerDiagnostics } from "./GenerationHealthCheckerDiagnostics";
import { PromptConflictCheckerDiagnostics } from "./PromptConflictCheckerDiagnostics";
import { GenerationHarnessDiagnostics } from "./GenerationHarnessDiagnostics";
import { FilesystemWatcherDiagnostics } from "./FilesystemWatcherDiagnostics";
import { CheckpointResumeDiagnostics } from "./CheckpointResumeDiagnostics";
import { QaHarnessDiagnostics } from "./QaHarnessDiagnostics";
import { ToolRuntimeHarnessDiagnostics } from "./ToolRuntimeHarnessDiagnostics";
import { VoiceAudioSettingsDiagnostics } from "./VoiceAudioSettingsDiagnostics";
import { LocalOrchestratorDiagnostics } from "./LocalOrchestratorDiagnostics";
import { VisualConsistencyContractDiagnostics } from "./VisualConsistencyContractDiagnostics";
import { FullTaskSubagentPacketPlannerDiagnostics } from "./FullTaskSubagentPacketPlannerDiagnostics";
import { KnowledgePackUserManagementDiagnostics } from "./KnowledgePackUserManagementDiagnostics";
import { WorkerRuntimeGateDiagnostics } from "./WorkerRuntimeGateDiagnostics";
import { ProviderClosedLoopShellDiagnostics } from "./ProviderClosedLoopShellDiagnostics";
import { BetaAcceptanceDiagnostics } from "./BetaAcceptanceDiagnostics";
import { SettingsShell } from "./SettingsShell";
import type { ProjectFactsStagedApplyPlan } from "../../core/projectTransaction";
import type { ProjectCurrentChoice, ProjectCurrentBindingStatus } from "../../core/projectCurrentRuntimeClient";
import type { AgentWebSearchSettings } from "../../core/agentWebSearchClient";
import { buildLocalOrchestratorUiSummary } from "./projections/runtimeDiagnostics";

function VideoPrepareSummaryStrip({
  runtimeState,
  selectedShot,
}: {
  runtimeState: ProjectRuntimeState;
  selectedShot?: ShotRecord;
}) {
  const videoPlanning = runtimeState.videoPlanning;
  const queue = videoPlanning.queueShell;
  const shotPlan = selectedShot ? videoPlanning.taskPlans.find((plan) => plan.shotId === selectedShot.id) : undefined;
  const gate = selectedShot ? videoPlanning.readinessGates.find((g) => g.shotId === selectedShot.id) : undefined;

  return (
    <section className="machine-panel">
      <div className="audit-head">
        <span>Video Prepare Summary</span>
      </div>
      <div className="summary-grid">
        <Metric label="Total Plans" value={`${videoPlanning.taskPlans.length}`} detail="video task plans" />
        <Metric label="Queue" value={`${queue.counts.total}`} detail={`${queue.counts.ready} ready · ${queue.counts.blocked} blocked · ${queue.counts.parked} parked`} />
        <Metric label="Gates" value={`${videoPlanning.readinessGates.length}`} detail="readiness gates" />
        <Metric label="Provider" value="parked" detail={videoPlanning.providerPolicySummary.videoProvidersRemainParked ? "all video providers parked" : "provider active"} />
        {selectedShot && shotPlan && (
          <>
            <Metric label="Selected Shot" value={selectedShot.id} detail={shotPlan.status} />
            <Metric label="Gate" value={gate?.status ?? "missing"} detail={gate?.blockers[0] ?? "No selected-shot gate data"} />
          </>
        )}
      </div>
    </section>
  );
}

function ProviderDock({ audit }: { audit: ProjectAudit }) {
  return (
    <section className="provider-dock">
      <div className="provider-title">
        <PlugZap size={16} />
        <span>Provider Policy</span>
      </div>
      {audit.providerPolicy.rules.slice(0, 6).map((rule) => (
        <div key={rule.slot} className={`provider-rule ${rule.executionState}`}>
          <div>
            <strong>{rule.slot}</strong>
            <small>{rule.activeProvider}</small>
          </div>
          <StatusPill value={rule.executionState} />
        </div>
      ))}
      <div className="provider-note">
        <PauseCircle size={15} />
        <span>Seedance/Jimeng stays parked. This UI builds envelopes and dry checks only.</span>
      </div>
    </section>
  );
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

function buildKnowledgeUiSummary(view: RuntimeView): KnowledgeUiSummary {
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

function KnowledgePackManager({ view }: { view: RuntimeView }) {
  const summary = buildKnowledgeUiSummary(view);

  return (
    <section className="machine-panel knowledge-manager">
      <div className="audit-head">
        <Database size={17} />
        <span>Knowledge Pack Manager</span>
      </div>
      <div className="summary-grid">
        <Metric label="Enabled" value={summary.enabledTotal} detail="packs enabled / total" />
        <Metric label="Injected" value={summary.injectedUnique} detail="records / unique" />
        <Metric label="Warnings / Blockers" value={summary.warningBlockerCount} detail="router, budget, manifest" />
        <Metric label="Budget Used" value={summary.budgetUsed} detail="tokens across task packets" />
      </div>
      <div className="knowledge-summary-strip">
        <StatusPill value={summary.readiness} />
        <span>Read-only Diagnostics summary.</span>
        <span>{summary.hardLockReminder}</span>
      </div>
    </section>
  );
}

function DiagnosticsQueueTaskRunsSection({ view }: { view: RuntimeView }) {
  return (
    <section className="machine-panel">
      <div className="audit-head">
        <Gauge size={17} />
        <span>Queue / Task Runs</span>
      </div>
      <div className="summary-grid">
        <Metric label="Total" value={`${view.queueSummary.total}`} detail="derived task runs" />
        <Metric label="Ready" value={`${view.queueSummary.ready}`} detail="can enter dry queue" />
        <Metric label="Blocked" value={`${view.queueSummary.blocked}`} detail="preflight/policy" />
        <Metric label="Parked" value={`${view.queueSummary.parked}`} detail="provider disabled" />
      </div>
      <TaskRows tasks={view.taskViews.slice(0, 12)} compact />
    </section>
  );
}

function DiagnosticsPreflightBlockersSection({ view, firstQueueBlocker }: { view: RuntimeView; firstQueueBlocker?: string }) {
  return (
    <section className="machine-panel">
      <div className="audit-head">
        <ShieldAlert size={17} />
        <span>Preflight Blockers</span>
      </div>
      {!view.preflightSummary.blockers.length && firstQueueBlocker && (
        <p className="muted-copy">Queue policy blocker: {firstQueueBlocker}</p>
      )}
      <div className="code-list">
        {view.preflightSummary.blockers.slice(0, 12).map((blocker, index) => (
          <details key={`${blocker.code}-${index}`}>
            <summary>{blocker.code} · {blocker.messageForUser}</summary>
            <pre>{JSON.stringify(blocker, null, 2)}</pre>
          </details>
        ))}
      </div>
    </section>
  );
}

function DiagnosticsManifestSourceIndexSection({
  audit,
  view,
  runtimeState,
}: {
  audit: ProjectAudit;
  view: RuntimeView;
  runtimeState: ProjectRuntimeState;
}) {
  return (
    <section className="machine-panel">
      <div className="audit-head">
        <Layers3 size={17} />
        <span>Manifest Matcher / Source Index</span>
      </div>
      <div className="field-grid compact">
        <label>Source</label>
        <span>{view.sourceIndexSummary.sourceIndexHash}</span>
        <label>Refs</label>
        <span>{view.sourceIndexSummary.lockedReferenceCount} locked / {view.sourceIndexSummary.candidateReferenceCount} candidates</span>
        <label>Outputs</label>
        <span>{view.manifestSummary.present} present / {view.manifestSummary.missing} missing / {view.manifestSummary.recoverable} recoverable</span>
        <label>State Source</label>
        <span>{view.stateSource?.label || "runtime-state"}</span>
        <label>Schema</label>
        <span>{view.stateSource?.path || audit.schemaSummary?.coreStateVersion || "runtime audit v0.3 shell"}</span>
        <label>Preview</label>
        <span>{view.previewEvents.filter((event) => event.type === "blocked_placeholder").length} blocked / {view.previewEvents.length} events</span>
        <label>Story Changes</label>
        <span>{runtimeState.storyChanges.pendingConfirmationCount} pending / {runtimeState.storyChanges.transactions.length} transaction(s)</span>
        <label>Reflow</label>
        <span>{runtimeState.storyChanges.reflowReports.length} report(s)</span>
      </div>
    </section>
  );
}

export function TaskRows({ tasks, compact = false }: { tasks: TaskRuntimeView[]; compact?: boolean }) {
  if (!tasks.length) return <p className="muted-copy">No task runs for this selection.</p>;
  return (
    <div className="job-list">
      {tasks.map((task) => (
        <div key={task.job.id} className="job-row">
          <div className="row-head">
            <span>{task.job.id}</span>
            <StatusPill value={task.queueGate.status} />
          </div>
          <small>{task.job.slot} / {task.job.requiredMode}</small>
          {!compact && <p>{task.nextStep}</p>}
        </div>
      ))}
    </div>
  );
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="diagnostic-collapsible">
      <summary>{label}</summary>
      {children}
    </details>
  );
}

export function DiagnosticsMode({
  audit,
  view,
  runtimeState,
  selectedShot,
  selectedShotId,
  projectRealChainState,
  projectImage2BatchState,
  projectImage2OneShotState,
  strictEditPreflightState,
  runtimeProjectBinding,
  projectPathInput,
  projectChoices,
  projectSelectionStatus,
  canChooseProjectRoot,
  projectFileStatusLabel,
  projectFileStatusDetail,
  projectFacts,
  projectFactsMode,
  latestProjectStoreApplyPlan,
  authorizationRef,
  webSearchSettings,
  onProjectPathChange,
  onSelectProjectChoice,
  onChooseProjectRoot,
  onConnectProject,
  onRunProjectRealChain,
  onRunProjectImage2Batch,
  onProjectFactsModeChange,
  onPrepareStrictEditPreflight,
  onPrepareImage2OneShot,
  onAuthorizationRefChange,
  onPrepareImage2OneShotPermissionReceipt,
  onConfirmImage2OneShot,
  onCheckImage2OneShotReturn,
  onWebSearchSettingsChange,
}: {
  audit: ProjectAudit;
  view: RuntimeView;
  runtimeState: ProjectRuntimeState;
  selectedShot?: ShotRecord;
  selectedShotId: string;
  projectRealChainState: ProjectRealChainPanelState;
  projectImage2BatchState: ProjectImage2BatchPanelState;
  projectImage2OneShotState: ProjectImage2OneShotPanelState;
  strictEditPreflightState: ProjectRound5StrictEditPreflightPanelState;
  runtimeProjectBinding: ProjectCurrentBindingStatus;
  projectPathInput: string;
  projectChoices: ProjectCurrentChoice[];
  projectSelectionStatus?: "idle" | "connecting" | "connected" | "error";
  canChooseProjectRoot?: boolean;
  projectFileStatusLabel?: string;
  projectFileStatusDetail?: string;
  projectFacts: ProjectFactsUiSummary;
  projectFactsMode: ProjectFactsUiMode;
  latestProjectStoreApplyPlan?: ProjectFactsStagedApplyPlan;
  authorizationRef: string;
  webSearchSettings?: AgentWebSearchSettings;
  onProjectPathChange: (value: string) => void;
  onSelectProjectChoice: (choice: ProjectCurrentChoice) => void;
  onChooseProjectRoot?: () => void;
  onConnectProject: () => void;
  onRunProjectRealChain: () => void;
  onRunProjectImage2Batch: () => void;
  onProjectFactsModeChange: (mode: ProjectFactsUiMode) => void;
  onPrepareStrictEditPreflight: (shotId: string) => void;
  onPrepareImage2OneShot: () => void;
  onAuthorizationRefChange: (value: string) => void;
  onPrepareImage2OneShotPermissionReceipt: () => void;
  onConfirmImage2OneShot: () => void;
  onCheckImage2OneShotReturn: () => void;
  onWebSearchSettingsChange?: (settings: AgentWebSearchSettings) => void;
}) {
  const firstQueueBlocker = view.taskViews.find((task) => task.queueGate.status === "blocked" && task.queueGate.blockers[0])?.queueGate.blockers[0];

  return (
    <div className="diagnostics-layout">
      <SettingsShell
        runtimeState={runtimeState}
        view={view}
        webSearchSettings={webSearchSettings}
        onWebSearchSettingsChange={onWebSearchSettingsChange}
      />
      <details className="settings-advanced diagnostics-advanced-panels">
        <summary>
          <span>运行诊断</span>
          <small>排查生成、队列、导出和运行时问题时再打开</small>
        </summary>
        <div className="diagnostics-advanced-grid">
          <DirectorProgressStrip
            state={buildDirectorProgressStripState(buildLocalOrchestratorUiSummary(runtimeState))}
          />
          <ProjectFactsStrip
            summary={projectFacts}
            mode={projectFactsMode}
            applyPlan={latestProjectStoreApplyPlan}
            onModeChange={onProjectFactsModeChange}
          />
          <ProjectRealChainPanel
            state={projectRealChainState}
            image2BatchState={projectImage2BatchState}
            image2OneShotState={projectImage2OneShotState}
            strictEditPreflightState={strictEditPreflightState}
            selectedShotId={selectedShotId}
            projectTitle={runtimeState.project.title}
            runtimeProjectBinding={runtimeProjectBinding}
            projectPathInput={projectPathInput}
            projectChoices={projectChoices}
            projectSelectionStatus={projectSelectionStatus}
            canChooseProjectRoot={canChooseProjectRoot}
            projectFileStatusLabel={projectFileStatusLabel}
            projectFileStatusDetail={projectFileStatusDetail}
            authorizationRef={authorizationRef}
            onProjectPathChange={onProjectPathChange}
            onSelectProjectChoice={onSelectProjectChoice}
            onChooseProjectRoot={onChooseProjectRoot}
            onConnectProject={onConnectProject}
            onRun={onRunProjectRealChain}
            onRunImage2Batch={onRunProjectImage2Batch}
            onPrepareStrictEditPreflight={onPrepareStrictEditPreflight}
            onPrepareImage2OneShot={onPrepareImage2OneShot}
            onAuthorizationRefChange={onAuthorizationRefChange}
            onPrepareImage2OneShotPermissionReceipt={onPrepareImage2OneShotPermissionReceipt}
            onConfirmImage2OneShot={onConfirmImage2OneShot}
            onCheckImage2OneShotReturn={onCheckImage2OneShotReturn}
          />
          <VideoPrepareSummaryStrip runtimeState={runtimeState} selectedShot={selectedShot} />
          <ProviderDock audit={audit} />
          <Panel label="Image Pipeline"><ImagePipelineDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Generation Health Checker"><GenerationHealthCheckerDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Prompt Conflict Checker"><PromptConflictCheckerDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Generation Harness"><GenerationHarnessDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Filesystem Watcher"><FilesystemWatcherDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Checkpoint Resume"><CheckpointResumeDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="QA Harness"><QaHarnessDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Tool Runtime Harness"><ToolRuntimeHarnessDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Video Planning"><VideoPlanningDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Video Execution Preview"><VideoExecutionPreviewDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Adapter Contracts"><AdapterContractDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Subagent Worker Runtime"><SubagentWorkerRuntimeDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Agent CLI Mock Runner"><AgentCliMockRunnerDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="CLI Adapter Spike"><CliAdapterSpikeDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Export Worker"><ExportWorkerDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Image2 Keyframe Runtime"><Image2KeyframeRuntimeDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Visual Consistency Contract"><VisualConsistencyContractDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Full Task Subagent Packet Planner"><FullTaskSubagentPacketPlannerDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Knowledge Pack User Management"><KnowledgePackUserManagementDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Worker Runtime Gate"><WorkerRuntimeGateDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Provider Closed Loop Shell"><ProviderClosedLoopShellDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Beta Acceptance"><BetaAcceptanceDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Real Pilot"><RealPilotDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Audio Diagnostics"><AudioDiagnosticsPanel audioPlanning={runtimeState.audioPlanning} /></Panel>
          <Panel label="Voice Audio Settings"><VoiceAudioSettingsDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Provider Enablement Gate"><ProviderEnablementGateDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Provider Execution Permission Gate"><ProviderExecutionPermissionGateDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Provider Action Confirmation Receipt"><ProviderActionConfirmationReceiptDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Provider Execution Handoff"><ProviderExecutionHandoffDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Local Orchestrator"><LocalOrchestratorDiagnostics runtimeState={runtimeState} /></Panel>
          <Panel label="Preview Export"><PreviewExportDiagnostics previewExport={runtimeState.previewExport} /></Panel>
          <DiagnosticsQueueTaskRunsSection view={view} />
          <DiagnosticsPreflightBlockersSection view={view} firstQueueBlocker={firstQueueBlocker} />
          <DiagnosticsManifestSourceIndexSection audit={audit} view={view} runtimeState={runtimeState} />
          <KnowledgePackManager view={view} />
        </div>
      </details>
    </div>
  );
}
