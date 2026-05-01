import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clapperboard,
  Database,
  Eye,
  FileJson,
  Gauge,
  Layers3,
  ListChecks,
  LockKeyhole,
  PauseCircle,
  Play,
  PlugZap,
  Radio,
  RefreshCw,
  Settings,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react";
import type {
  AssetRecord,
  AudioPlan,
  AudioPlanningState,
  AuditIssue,
  ExportProfile,
  PreviewEvent,
  ProjectAudit,
  ProjectPreviewExportState,
  ShotRecord,
  UiMode,
  WorkflowStage,
} from "./core/types";
import type { RuntimeView, TaskRuntimeView } from "./core/runtimeView";
import type { ProjectRuntimeState } from "./core/projectState";
import {
  auditFromProjectRuntimeState,
  buildProjectRuntimeState,
  buildRuntimeViewFromProjectState,
  emptyKnowledgeManifest,
  withRuntimeDefaults,
} from "./core/projectStateBuilder";
import { buildProjectRuntimePlan } from "./core/projectRuntime";
import { buildDesktopRuntimePlan, type DesktopRuntimePlan } from "./core/desktopRuntime";
import { buildSubagentWorkerRuntimePlan, type SubagentWorkerRuntimePlan } from "./core/subagentWorkerRuntime";
import { ensureRuntimeEnvironment } from "./core/runtimeConfig";
import { buildDirectorWorkflowState, type DirectorWorkflowStatus } from "./core/directorWorkflow";
import {
  buildPreviewPlayerQueue as buildCorePreviewPlayerQueue,
  getPreviewPlayerActiveItem,
  getPreviewPlayerTotalDuration,
  type PreviewQueueItem,
  type PreviewQueueItemKind,
} from "./core/previewPlayerQueue";
import { fallbackAudit } from "./data/fallbackAudit";

const gateNames = ["identity", "scene", "pair", "story", "prop", "style"] as const;
const fallbackRuntimeState = buildProjectRuntimeState(fallbackAudit, emptyKnowledgeManifest, {
  stateSource: {
    kind: "fallback-audit",
    label: "fallbackAudit",
    note: "Bundled fallback data; runtime-state.json and runtime-audit.json were unavailable.",
  },
});

function gateClass(value: string) {
  if (value === "PASS") return "gate pass";
  if (value === "PARTIAL") return "gate partial";
  if (value === "FAIL") return "gate fail";
  if (value === "N/A") return "gate muted";
  return "gate unknown";
}

function issueTone(issue: AuditIssue) {
  if (issue.severity === "blocker") return "issue blocker";
  if (issue.severity === "warning") return "issue warning";
  return "issue";
}

function stageIcon(stage: WorkflowStage) {
  if (stage.status === "done") return <CheckCircle2 size={15} />;
  if (stage.status === "blocked") return <ShieldAlert size={15} />;
  if (stage.status === "active") return <RefreshCw size={15} />;
  return <Radio size={15} />;
}

function groupAssets(assets: AssetRecord[]) {
  return {
    Characters: assets.filter((asset) => asset.type === "character"),
    Scenes: assets.filter((asset) => asset.type === "scene"),
    Props: assets.filter((asset) => asset.type === "prop"),
    Style: assets.filter((asset) => asset.type === "style"),
    Other: assets.filter((asset) => !["character", "scene", "prop", "style"].includes(asset.type)),
  };
}

type DirectorView = "story" | "assets" | "preview";
type MinimalProjectPlan = {
  entryLabel: string;
  planLabel: string;
};

type DesktopRuntimeShellView = {
  planStatus: string;
  runtimeMode: string;
  platformPathPolicy: string;
  projectPermissionScope: string;
  sidecarPolicy: string;
  credentialVault: string;
  hardLocks: string[];
};

type AgentCliMockRunnerUiSummary = {
  initialized: boolean;
  runnerKind: string;
  replacementProof: string;
  readiness: string;
  noopResultCount: number;
  hardLocks: string[];
};
type CodexCliAdapterSpikeUiSummary = {
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

type ExportWorkerUiSummary = {
  initialized: boolean;
  readiness: string;
  scope: string;
  plannedWriteCount: number;
  plannedWriteSamples: string[];
  exportRoot: string;
  blockersWarnings: string[];
  hardLocks: string[];
};
type VoiceAudioSettingsUiSummary = {
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
type ProviderEnablementGateUiSummary = {
  initialized: boolean;
  readiness: string;
  readyForConfirmation: number;
  blocked: number;
  parked: number;
  confirmationTokenStatus: string;
  packetCompleteStatus: string;
  closedLoopStatus: string;
  forbiddenPathsAbsent: string;
  canSubmitProvider: string;
  submitBlocked: string;
  credentialLiveShellLocked: string;
  blockersWarnings: string[];
  hardLocks: string[];
};
type ProviderExecutionPermissionGateUiSummary = {
  initialized: boolean;
  readiness: string;
  readyForUserReview: number;
  blocked: number;
  parked: number;
  canAskUserToConfirm: number;
  actionTimeConfirmation: string;
  automaticSubmit: string;
  providerSubmit: string;
  credentialWorkerFileLocks: string;
  blockersWarnings: string[];
  hardLocks: string[];
};
type ProviderActionConfirmationReceiptUiSummary = {
  initialized: boolean;
  readiness: string;
  readyReceipts: number;
  blocked: number;
  parked: number;
  confirmedCount: number;
  providerSubmitBlocked: string;
  credentialWorkerFileLocked: string;
  blockersWarnings: string[];
  hardLocks: string[];
};
type ProviderExecutionHandoffUiSummary = {
  initialized: boolean;
  readiness: string;
  handoffCount: number;
  blockedCount: number;
  confirmedCount: number;
  providerSubmitLocked: string;
  credentialWorkerFileLocked: string;
  blockersWarnings: string[];
  hardLocks: string[];
};
type LocalOrchestratorUiSummary = {
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
type DirectorProgressTone = "preparing" | "working" | "review" | "blocked" | "complete";
type DirectorProgressSegment = {
  label: string;
  value: number;
  tone: DirectorProgressTone;
};
type DirectorProgressStripState = {
  label: string;
  detail: string;
  tone: DirectorProgressTone;
  total: number;
  preparing: number;
  working: number;
  review: number;
  blocked: number;
  complete: number;
  segments: DirectorProgressSegment[];
};

function toMediaSrc(path?: string) {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:") || path.startsWith("blob:")) return path;
  if (path.startsWith("/")) return `/@fs${path}`;
  return path;
}

function formatShotNumber(id: string) {
  const match = id.match(/^A(\d+)_(\d+)$/i);
  if (!match) return id;
  return `${Number(match[1])}-${Number(match[2])}`;
}

function cleanLabel(value: string) {
  return value
    .replace(/^asset_/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const storyFunctionLabels = ["Setup", "Signal", "Choice", "Move", "Reveal", "Test", "Turn", "Decision", "Payoff", "Close"];

function shortStoryFunction(shot: ShotRecord, index: number) {
  const value = shot.storyFunction.trim();
  if (/^[A-Za-z][A-Za-z\s-]{1,16}$/.test(value)) return value;
  return storyFunctionLabels[index % storyFunctionLabels.length];
}

function shotStatusTone(shot: ShotRecord) {
  if (shot.status === "blocked" || shot.issues.some((issue) => issue.includes("missing"))) return "bad";
  if (shot.issues.length || shot.status === "video_missing") return "warn";
  return "ok";
}

function assetStatusTone(asset: AssetRecord) {
  if (asset.status === "missing" || asset.lockedStatus === "not_generated") return "bad";
  if (asset.lockedStatus === "candidate" || asset.lockedStatus === "needs_review" || asset.issues.length) return "warn";
  return "ok";
}

function assetStatusLabel(asset: AssetRecord) {
  if (asset.lockedStatus === "needs_review") return "review";
  if (asset.lockedStatus === "not_generated") return "missing";
  return asset.lockedStatus;
}

function selectedScopeLabel(shot?: ShotRecord, asset?: AssetRecord, sectionLabel?: string) {
  if (shot) return `Selected ${formatShotNumber(shot.id)}`;
  if (asset) return `Selected ${cleanLabel(asset.name)}`;
  if (sectionLabel) return `Selected ${sectionLabel}`;
  return "Selected project";
}

function previewQueueKind(event: PreviewEvent): PreviewQueueItemKind {
  if (event.type === "blocked_placeholder" || !event.mediaPath) return "missing_placeholder";
  if (event.type === "video_clip") return "video_clip";
  return "image_hold";
}

function buildPreviewPlayerQueue(previewExport: ProjectPreviewExportState, shots: ShotRecord[]): PreviewQueueItem[] {
  const draftEvents = previewExport.draftPreview.events.filter(
    (event) =>
      event.type === "image_hold" ||
      event.type === "video_clip" ||
      (event.type === "blocked_placeholder" && previewQueueKind(event) === "missing_placeholder"),
  );
  return buildCorePreviewPlayerQueue(
    { ...previewExport, draftPreview: { ...previewExport.draftPreview, events: draftEvents } },
    shots,
  );
}

function buildMinimalProjectPlan(runtimeState: ProjectRuntimeState): MinimalProjectPlan {
  const plan = buildProjectRuntimePlan({
    mode: "open",
    title: runtimeState.project.title,
    generatedAt: runtimeState.project.importedAt,
    sourceOfTruth: "project_files",
  });
  return {
    entryLabel: plan.projectEntry.fileName === "project.vibe" ? "project.vibe" : plan.projectEntry.fileName,
    planLabel: plan.validation.ok ? "Plan preview" : "Needs review",
  };
}

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

function buildDesktopRuntimeShellView(runtimeState: ProjectRuntimeState): DesktopRuntimeShellView {
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

function buildSubagentWorkerRuntimeView(runtimeState: ProjectRuntimeState): SubagentWorkerRuntimePlan {
  return buildSubagentWorkerRuntimePlan({
    generatedAt: runtimeState.generatedAt,
    envelopes: runtimeState.videoExecutionPreview.previews
      .map((preview) => preview.subagentTaskEnvelope)
      .filter(Boolean),
  });
}

function MediaFrame({
  src,
  alt,
  label,
  className = "",
}: {
  src?: string;
  alt: string;
  label: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const mediaSrc = toMediaSrc(src);
  if (!mediaSrc || failed) {
    return <div className={`minimal-media-placeholder ${className}`}>{label}</div>;
  }

  return <img className={className} src={mediaSrc} alt={alt} onError={() => setFailed(true)} />;
}

function StatusPill({ value }: { value: string }) {
  const tone = value.includes("blocked") || value.includes("missing") || value === "blocker" || value === "failed"
    ? "danger"
    : value.includes("ready") || value.includes("done") || value === "PASS" || value === "success"
      ? "good"
      : "neutral";
  return <span className={`pill ${tone}`}>{value}</span>;
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json() as Promise<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requireRecord(value: Record<string, unknown>, key: string, issues: string[]) {
  if (!isRecord(value[key])) issues.push(key);
  return isRecord(value[key]) ? value[key] : {};
}

function requireArray(value: Record<string, unknown>, key: string, issues: string[]) {
  if (!Array.isArray(value[key])) issues.push(key);
}

function arrayIncludes(value: unknown, expected: string) {
  return Array.isArray(value) && value.includes(expected);
}

function sameStringSet(left: unknown, right: string[]) {
  return Array.isArray(left) && left.length === right.length && right.every((item) => left.includes(item));
}

function assertProjectRuntimeState(value: unknown): asserts value is ProjectRuntimeState {
  const issues: string[] = [];
  if (!isRecord(value)) throw new Error("runtime-state shape invalid: root");

  for (const key of ["schemaVersion", "coreStateVersion"]) {
    if (typeof value[key] !== "string") issues.push(key);
  }

  const project = requireRecord(value, "project", issues);
  const sourceIndex = requireRecord(value, "sourceIndex", issues);
  const sourceIndexSummary = requireRecord(value, "sourceIndexSummary", issues);
  const storyFlow = requireRecord(value, "storyFlow", issues);
  const visualMemory = requireRecord(value, "visualMemory", issues);
  const taskRuns = requireRecord(value, "taskRuns", issues);
  const manifestMatches = requireRecord(value, "manifestMatches", issues);
  const diagnostics = requireRecord(value, "diagnostics", issues);
  const knowledge = requireRecord(value, "knowledge", issues);
  const storyChanges = requireRecord(value, "storyChanges", issues);
  const runtime = requireRecord(value, "runtime", issues);
  const previewExport = requireRecord(value, "previewExport", issues);
  const voiceSourceLibrary = requireRecord(value, "voiceSourceLibrary", issues);
  const audioPlanning = requireRecord(value, "audioPlanning", issues);
  const videoPlanning = requireRecord(value, "videoPlanning", issues);
  const draftPreview = requireRecord(previewExport, "draftPreview", issues);
  const draftPreviewSummary = requireRecord(draftPreview, "summary", issues);
  const formalPreview = requireRecord(previewExport, "formalPreview", issues);
  const formalPreviewGate = requireRecord(previewExport, "formalPreviewGate", issues);
  const roughCutProxy = requireRecord(previewExport, "roughCutProxy", issues);
  const exportPackagePlan = requireRecord(previewExport, "exportPackagePlan", issues);
  const runtimeConfig = requireRecord(runtime, "config", issues);
  const detectionReport = requireRecord(runtime, "detectionReport", issues);
  const providerEnablementSummary = requireRecord(runtime, "providerEnablementSummary", issues);

  requireRecord(value, "stateSource", issues);
  if (!Object.keys(project).length) issues.push("project.empty");
  if (!Object.keys(sourceIndex).length) issues.push("sourceIndex.empty");
  if (!Object.keys(sourceIndexSummary).length) issues.push("sourceIndexSummary.empty");
  requireArray(storyFlow, "sections", issues);
  requireArray(storyFlow, "shots", issues);
  requireArray(visualMemory, "assets", issues);
  requireArray(taskRuns, "jobs", issues);
  requireArray(taskRuns, "runs", issues);
  requireArray(taskRuns, "taskViews", issues);
  requireArray(manifestMatches, "reports", issues);
  requireArray(value, "previewEvents", issues);
  requireArray(diagnostics, "issues", issues);
  requireArray(knowledge, "categories", issues);
  requireArray(knowledge, "validationIssues", issues);
  requireArray(knowledge, "bindings", issues);
  requireArray(storyChanges, "transactions", issues);
  requireArray(storyChanges, "reflowReports", issues);
  requireArray(previewExport, "exportProfiles", issues);
  requireArray(audioPlanning, "shotPlans", issues);
  requireArray(draftPreview, "events", issues);
  requireArray(draftPreview, "blockedReasons", issues);
  requireArray(formalPreview, "events", issues);
  requireArray(formalPreview, "blockedReasons", issues);
  requireArray(formalPreviewGate, "blockedReasons", issues);
  requireRecord(formalPreviewGate, "requiredChecks", issues);
  requireArray(exportPackagePlan, "futureTargets", issues);
  requireArray(exportPackagePlan, "blockedReasons", issues);
  requireArray(exportPackagePlan, "profiles", issues);
  if (typeof draftPreviewSummary.eventCount !== "number") issues.push("previewExport.draftPreview.summary.eventCount");
  if (typeof draftPreviewSummary.blockedPlaceholderCount !== "number") issues.push("previewExport.draftPreview.summary.blockedPlaceholderCount");
  if (typeof roughCutProxy.totalDurationSeconds !== "number") issues.push("previewExport.roughCutProxy.totalDurationSeconds");
  if (typeof storyChanges.pendingConfirmationCount !== "number") issues.push("storyChanges.pendingConfirmationCount");
  if (typeof storyChanges.lastGeneratedAt !== "string") issues.push("storyChanges.lastGeneratedAt");
  if (typeof runtimeConfig.runtimeMode !== "string") issues.push("runtime.config.runtimeMode");
  if (typeof runtimeConfig.platform !== "string") issues.push("runtime.config.platform");
  requireRecord(runtimeConfig, "projectRootPolicy", issues);
  requireArray(runtimeConfig, "pathRules", issues);
  requireRecord(runtimeConfig, "toolPaths", issues);
  requireRecord(runtimeConfig, "providerEnablement", issues);
  requireRecord(runtimeConfig, "sidecarPermissions", issues);
  requireRecord(runtimeConfig, "credentialStorage", issues);
  requireArray(runtimeConfig, "providerAdapterSettings", issues);
  requireArray(runtimeConfig, "voiceSources", issues);
  requireArray(detectionReport, "tools", issues);
  if (typeof detectionReport.generatedAt !== "string") issues.push("runtime.detectionReport.generatedAt");
  if (typeof providerEnablementSummary.liveSubmitAllowed !== "boolean") issues.push("runtime.providerEnablementSummary.liveSubmitAllowed");
  if (typeof voiceSourceLibrary.schemaVersion !== "string") issues.push("voiceSourceLibrary.schemaVersion");
  if (voiceSourceLibrary.phase !== "phase18_voice_source_library") issues.push("voiceSourceLibrary.phase");
  if (voiceSourceLibrary.libraryPurpose !== "voice_source_memory") issues.push("voiceSourceLibrary.libraryPurpose");
  if (voiceSourceLibrary.privateAuthMaterialForbidden !== true) issues.push("voiceSourceLibrary.privateAuthMaterialForbidden");
  if (voiceSourceLibrary.dryRunOnly !== true) issues.push("voiceSourceLibrary.dryRunOnly");
  if (voiceSourceLibrary.providerSubmissionForbidden !== true) issues.push("voiceSourceLibrary.providerSubmissionForbidden");
  if (voiceSourceLibrary.liveSubmitAllowed !== false) issues.push("voiceSourceLibrary.liveSubmitAllowed");
  requireArray(voiceSourceLibrary, "sources", issues);
  requireArray(voiceSourceLibrary, "rejectedInputs", issues);
  requireArray(voiceSourceLibrary, "notes", issues);
  const voiceSourceSummary = requireRecord(voiceSourceLibrary, "summary", issues);
  const voiceSourceHardLocks = requireRecord(voiceSourceLibrary, "hardLocks", issues);
  requiredVoiceSourceHardLocks.forEach(([key, expected]) => {
    if (voiceSourceHardLocks[key] !== expected) issues.push(`voiceSourceLibrary.hardLocks.${key}`);
  });
  for (const key of ["total", "locked", "candidate", "rejected", "futureReferenceReady", "ttsReady"]) {
    if (typeof voiceSourceSummary[key] !== "number") issues.push(`voiceSourceLibrary.summary.${key}`);
  }
  if (voiceSourceSummary.storesSecrets !== false) issues.push("voiceSourceLibrary.summary.storesSecrets");
  if (voiceSourceSummary.providerSubmitAllowed !== false) issues.push("voiceSourceLibrary.summary.providerSubmitAllowed");
  if (voiceSourceSummary.liveSubmitAllowed !== false) issues.push("voiceSourceLibrary.summary.liveSubmitAllowed");
  if (Array.isArray(voiceSourceLibrary.sources)) {
    voiceSourceLibrary.sources.forEach((source, index) => {
      if (!isRecord(source)) {
        issues.push(`voiceSourceLibrary.sources.${index}`);
        return;
      }
      if (typeof source.id !== "string") issues.push(`voiceSourceLibrary.sources.${index}.id`);
      if (typeof source.displayName !== "string") issues.push(`voiceSourceLibrary.sources.${index}.displayName`);
      if (typeof source.provider !== "string") issues.push(`voiceSourceLibrary.sources.${index}.provider`);
      if (typeof source.providerVoiceId !== "string") issues.push(`voiceSourceLibrary.sources.${index}.providerVoiceId`);
      if (typeof source.role !== "string") issues.push(`voiceSourceLibrary.sources.${index}.role`);
      if (typeof source.status !== "string") issues.push(`voiceSourceLibrary.sources.${index}.status`);
      requireArray(source, "textConstraints", issues);
      requireArray(source, "allowedUse", issues);
      requireArray(source, "blockers", issues);
      requireArray(source, "warnings", issues);
      if (source.storesCredential !== false) issues.push(`voiceSourceLibrary.sources.${index}.storesCredential`);
      if (source.storesSampleAudioFile !== false) issues.push(`voiceSourceLibrary.sources.${index}.storesSampleAudioFile`);
      if (source.privateAuthMaterialForbidden !== true) issues.push(`voiceSourceLibrary.sources.${index}.privateAuthMaterialForbidden`);
      if (source.providerSubmissionForbidden !== true) issues.push(`voiceSourceLibrary.sources.${index}.providerSubmissionForbidden`);
      if (source.liveSubmitAllowed !== false) issues.push(`voiceSourceLibrary.sources.${index}.liveSubmitAllowed`);
    });
  }
  if (typeof audioPlanning.schemaVersion !== "string") issues.push("audioPlanning.schemaVersion");
  if (typeof audioPlanning.generatedAt !== "string") issues.push("audioPlanning.generatedAt");
  const audioPreviewMix = requireRecord(audioPlanning, "previewMix", issues);
  const audioVoiceSourceRegistry = requireRecord(audioPlanning, "voiceSourceRegistry", issues);
  const audioVideoProviderPolicy = requireRecord(audioPlanning, "videoProviderPolicy", issues);
  const audioExportPackageSummary = requireRecord(audioPlanning, "exportPackageSummary", issues);
  const videoQueueShell = requireRecord(videoPlanning, "queueShell", issues);
  const videoQueueCounts = requireRecord(videoQueueShell, "counts", issues);
  const videoProviderPolicySummary = requireRecord(videoPlanning, "providerPolicySummary", issues);
  const videoExecutionPreview = requireRecord(value, "videoExecutionPreview", issues);
  const videoExecutionPreviewSummary = requireRecord(videoExecutionPreview, "summary", issues);
  const adapterContracts = requireRecord(value, "adapterContracts", issues);
  const adapterContractSummary = requireRecord(adapterContracts, "summary", issues);
  const generationHarness = requireRecord(value, "generationHarness", issues);
  const generationHarnessSummary = requireRecord(generationHarness, "summary", issues);
  const generationPostprocessPolicy = requireRecord(generationHarness, "postprocessPolicy", issues);
  const imageKeyframeRuntime = requireRecord(value, "imageKeyframeRuntime", issues);
  const imageKeyframeSummary = requireRecord(imageKeyframeRuntime, "summary", issues);
  const imageKeyframeLocks = requireRecord(imageKeyframeRuntime, "runtimeLocks", issues);
  requireArray(audioPlanning, "providerSlots", issues);
  requireArray(audioPlanning, "notes", issues);
  requireArray(videoPlanning, "readinessGates", issues);
  requireArray(videoPlanning, "taskPlans", issues);
  requireArray(videoPlanning, "notes", issues);
  requireArray(adapterContracts, "agentAdapters", issues);
  requireArray(adapterContracts, "workerAdapters", issues);
  requireArray(adapterContracts, "providerAdapters", issues);
  requireArray(generationHarness, "jobs", issues);
  requireArray(generationHarness, "forbiddenActions", issues);
  requireArray(generationHarness, "notes", issues);
  requireArray(audioPreviewMix, "events", issues);
  if (typeof audioPreviewMix.eventCount !== "number") issues.push("audioPlanning.previewMix.eventCount");
  if (typeof audioPreviewMix.missingOutputPathCount !== "number") issues.push("audioPlanning.previewMix.missingOutputPathCount");
  if (typeof audioVoiceSourceRegistry.sourceCount !== "number") issues.push("audioPlanning.voiceSourceRegistry.sourceCount");
  if (typeof audioVoiceSourceRegistry.storesSecrets !== "boolean") issues.push("audioPlanning.voiceSourceRegistry.storesSecrets");
  if (audioVideoProviderPolicy.noBgmForVideoProvider !== true) issues.push("audioPlanning.videoProviderPolicy.noBgmForVideoProvider");
  if (audioExportPackageSummary.status !== "planned") issues.push("audioPlanning.exportPackageSummary.status");
  if (typeof videoPlanning.schemaVersion !== "string") issues.push("videoPlanning.schemaVersion");
  if (typeof videoPlanning.generatedAt !== "string") issues.push("videoPlanning.generatedAt");
  if (typeof videoQueueShell.status !== "string") issues.push("videoPlanning.queueShell.status");
  if (typeof videoQueueCounts.total !== "number") issues.push("videoPlanning.queueShell.counts.total");
  if (videoQueueShell.providerSubmissionForbidden !== true) issues.push("videoPlanning.queueShell.providerSubmissionForbidden");
  if (videoProviderPolicySummary.liveSubmitAllowed !== false) issues.push("videoPlanning.providerPolicySummary.liveSubmitAllowed");
  if (videoProviderPolicySummary.providerSubmissionForbidden !== true) issues.push("videoPlanning.providerPolicySummary.providerSubmissionForbidden");
  if (videoProviderPolicySummary.fastModelForbidden !== true) issues.push("videoPlanning.providerPolicySummary.fastModelForbidden");
  if (videoProviderPolicySummary.vipChannelForbidden !== true) issues.push("videoPlanning.providerPolicySummary.vipChannelForbidden");
  if (videoProviderPolicySummary.textToVideoForbidden !== true) issues.push("videoPlanning.providerPolicySummary.textToVideoForbidden");
  if (videoPlanning.providerSubmissionForbidden !== true) issues.push("videoPlanning.providerSubmissionForbidden");
  if (typeof videoExecutionPreview.schemaVersion !== "string") issues.push("videoExecutionPreview.schemaVersion");
  if (typeof videoExecutionPreview.generatedAt !== "string") issues.push("videoExecutionPreview.generatedAt");
  requireArray(videoExecutionPreview, "previews", issues);
  requireArray(videoExecutionPreview, "notes", issues);
  for (const key of ["total", "blocked", "parked", "previewReady", "canPreviewPacket", "canExecute"]) {
    if (typeof videoExecutionPreviewSummary[key] !== "number") issues.push(`videoExecutionPreview.summary.${key}`);
  }
  if (videoExecutionPreviewSummary.canExecute !== 0) issues.push("videoExecutionPreview.summary.canExecute");
  if (videoExecutionPreview.dryRunOnly !== true) issues.push("videoExecutionPreview.dryRunOnly");
  if (videoExecutionPreview.providerSubmissionForbidden !== true) issues.push("videoExecutionPreview.providerSubmissionForbidden");
  if (videoExecutionPreview.liveSubmitAllowed !== false) issues.push("videoExecutionPreview.liveSubmitAllowed");
  if (Array.isArray(videoExecutionPreview.previews)) {
    videoExecutionPreview.previews.forEach((preview, index) => {
      if (!isRecord(preview)) {
        issues.push(`videoExecutionPreview.previews.${index}`);
        return;
      }
      const packet = requireRecord(preview, "subagentPacketPreview", issues);
      const subagentEnvelope = requireRecord(preview, "subagentTaskEnvelope", issues);
      requireArray(preview, "hardLocks", issues);
      requireArray(preview, "executionOrderPreview", issues);
      requireArray(preview, "blockers", issues);
      requireArray(preview, "warnings", issues);
      requireArray(packet, "requiredReadScopes", issues);
      requireArray(packet, "forbiddenReadScopes", issues);
      requireArray(subagentEnvelope, "injectedKnowledgePacks", issues);
      requireArray(subagentEnvelope, "injectedKnowledgeSnippets", issues);
      requireArray(subagentEnvelope, "allowedReadScopes", issues);
      requireArray(subagentEnvelope, "disallowedReadScopes", issues);
      if (typeof preview.shotId !== "string") issues.push(`videoExecutionPreview.previews.${index}.shotId`);
      if (typeof preview.status !== "string") issues.push(`videoExecutionPreview.previews.${index}.status`);
      if (typeof preview.canPreviewPacket !== "boolean") issues.push(`videoExecutionPreview.previews.${index}.canPreviewPacket`);
      if (preview.canExecute !== false) issues.push(`videoExecutionPreview.previews.${index}.canExecute`);
      if (preview.dryRunOnly !== true) issues.push(`videoExecutionPreview.previews.${index}.dryRunOnly`);
      if (preview.providerSubmissionForbidden !== true) issues.push(`videoExecutionPreview.previews.${index}.providerSubmissionForbidden`);
      if (preview.liveSubmitAllowed !== false) issues.push(`videoExecutionPreview.previews.${index}.liveSubmitAllowed`);
      if (subagentEnvelope.sourceIndexRequired !== true) issues.push(`videoExecutionPreview.previews.${index}.subagentTaskEnvelope.sourceIndexRequired`);
      if (subagentEnvelope.resultMustReferencePackHashes !== true) issues.push(`videoExecutionPreview.previews.${index}.subagentTaskEnvelope.resultMustReferencePackHashes`);
      const hardLocks = Array.isArray(preview.hardLocks) ? preview.hardLocks : [];
      requiredVideoExecutionHardLocks.forEach((lock) => {
        if (!hardLocks.includes(lock)) issues.push(`videoExecutionPreview.previews.${index}.hardLocks.${lock}`);
      });
    });
  }
  if (typeof adapterContracts.schemaVersion !== "string") issues.push("adapterContracts.schemaVersion");
  if (adapterContractSummary.liveSubmitAllowed !== false) issues.push("adapterContracts.summary.liveSubmitAllowed");
  if (adapterContractSummary.credentialStorage !== false) issues.push("adapterContracts.summary.credentialStorage");
  requireArray(adapterContractSummary, "agentAdapters", issues);
  requireArray(adapterContractSummary, "workerAdapters", issues);
  requireArray(adapterContractSummary, "providerAdapters", issues);
  requireArray(adapterContractSummary, "parkedVideoProviders", issues);
  requireArray(adapterContractSummary, "contractViolations", issues);
  if (adapterContractSummary.liveSubmitAllowed !== providerEnablementSummary.liveSubmitAllowed) {
    issues.push("adapterContracts.summary.liveSubmitAllowed.crossModule");
  }
  if (videoProviderPolicySummary.liveSubmitAllowed !== false || videoExecutionPreview.liveSubmitAllowed !== false) {
    issues.push("adapterContracts.summary.liveSubmitAllowed.videoLock");
  }
  if (Array.isArray(adapterContractSummary.contractViolations) && adapterContractSummary.contractViolations.length > 0) {
    issues.push("adapterContracts.summary.contractViolations");
  }
  if (Array.isArray(adapterContracts.agentAdapters)) {
    adapterContracts.agentAdapters.forEach((adapter, index) => {
      if (!isRecord(adapter)) {
        issues.push(`adapterContracts.agentAdapters.${index}`);
        return;
      }
      if (adapter.dryRunOnly !== true) issues.push(`adapterContracts.agentAdapters.${index}.dryRunOnly`);
      if (adapter.readOnly !== true) issues.push(`adapterContracts.agentAdapters.${index}.readOnly`);
      if (adapter.liveSubmitAllowed !== false) issues.push(`adapterContracts.agentAdapters.${index}.liveSubmitAllowed`);
      if (adapter.credentialStorage !== false) issues.push(`adapterContracts.agentAdapters.${index}.credentialStorage`);
      if (adapter.uiBinding !== false) issues.push(`adapterContracts.agentAdapters.${index}.uiBinding`);
      for (const route of ["ui_binding", "live_submit", "credential_read", "credential_storage", "arbitrary_shell"]) {
        if (!arrayIncludes(adapter.forbiddenRoutes, route)) issues.push(`adapterContracts.agentAdapters.${index}.forbiddenRoutes.${route}`);
      }
    });
  }
  if (Array.isArray(adapterContracts.workerAdapters)) {
    adapterContracts.workerAdapters.forEach((adapter, index) => {
      if (!isRecord(adapter)) {
        issues.push(`adapterContracts.workerAdapters.${index}`);
        return;
      }
      if (adapter.dryRunOnly !== true) issues.push(`adapterContracts.workerAdapters.${index}.dryRunOnly`);
      if (adapter.readOnly !== true) issues.push(`adapterContracts.workerAdapters.${index}.readOnly`);
      if (adapter.requiredEnvelopeSchema !== "subagent_task_envelope.schema.json") issues.push(`adapterContracts.workerAdapters.${index}.requiredEnvelopeSchema`);
      if (adapter.mustReceiveContextPacket !== true) issues.push(`adapterContracts.workerAdapters.${index}.mustReceiveContextPacket`);
      if (adapter.canBypassEnvelope !== false) issues.push(`adapterContracts.workerAdapters.${index}.canBypassEnvelope`);
      if (adapter.liveSubmitAllowed !== false) issues.push(`adapterContracts.workerAdapters.${index}.liveSubmitAllowed`);
      if (adapter.credentialStorage !== false) issues.push(`adapterContracts.workerAdapters.${index}.credentialStorage`);
      for (const route of ["freeform_context", "envelope_bypass", "live_submit", "credential_read", "credential_storage"]) {
        if (!arrayIncludes(adapter.forbiddenRoutes, route)) issues.push(`adapterContracts.workerAdapters.${index}.forbiddenRoutes.${route}`);
      }
    });
  }
  if (Array.isArray(adapterContracts.providerAdapters)) {
    const providerAdapterIds = adapterContracts.providerAdapters
      .filter((adapter): adapter is Record<string, unknown> => isRecord(adapter))
      .map((adapter) => adapter.id);
    for (const requiredId of ["image2-provider", "image2-edit-provider", "image2-reference-asset-provider", "seedance2-provider", "jimeng-video", "local-postprocess-planned"]) {
      if (!providerAdapterIds.includes(requiredId)) issues.push(`adapterContracts.providerAdapters.${requiredId}`);
    }
    const parkedVideoProviderIds = adapterContracts.providerAdapters
      .filter((adapter): adapter is Record<string, unknown> => isRecord(adapter) && typeof adapter.slot === "string" && adapter.slot.startsWith("video.") && adapter.state === "parked")
      .map((adapter) => String(adapter.id));
    if (!sameStringSet(adapterContractSummary.parkedVideoProviders, parkedVideoProviderIds)) {
      issues.push("adapterContracts.summary.parkedVideoProviders");
    }
    if (adapterContractSummary.activeImageProvider !== "image2-provider" || !providerAdapterIds.includes(String(adapterContractSummary.activeImageProvider))) {
      issues.push("adapterContracts.summary.activeImageProvider");
    }
    adapterContracts.providerAdapters.forEach((adapter, index) => {
      if (!isRecord(adapter)) {
        issues.push(`adapterContracts.providerAdapters.${index}`);
        return;
      }
      if (adapter.kind !== "provider") issues.push(`adapterContracts.providerAdapters.${index}.kind`);
      requireArray(adapter, "requiredModes", issues);
      if (adapter.dryRunOnly !== true) issues.push(`adapterContracts.providerAdapters.${index}.dryRunOnly`);
      if (adapter.readOnly !== true) issues.push(`adapterContracts.providerAdapters.${index}.readOnly`);
      if (adapter.liveSubmitAllowed !== false) issues.push(`adapterContracts.providerAdapters.${index}.liveSubmitAllowed`);
      if (adapter.credentialStorage !== false) issues.push(`adapterContracts.providerAdapters.${index}.credentialStorage`);
      if (adapter.providerSubmissionForbidden !== true) issues.push(`adapterContracts.providerAdapters.${index}.providerSubmissionForbidden`);
      if (adapter.arbitraryProviderCommandAllowed !== false) issues.push(`adapterContracts.providerAdapters.${index}.arbitraryProviderCommandAllowed`);
      if (!["not_required", "not_configured", "not_read"].includes(String(adapter.credentialStatus))) {
        issues.push(`adapterContracts.providerAdapters.${index}.credentialStatus`);
      }
      for (const route of ["live_submit", "credential_read", "credential_storage", "arbitrary_provider_command"]) {
        if (!arrayIncludes(adapter.forbiddenRoutes, route)) issues.push(`adapterContracts.providerAdapters.${index}.forbiddenRoutes.${route}`);
      }
      if ((adapter.id === "seedance2-provider" || adapter.id === "jimeng-video") && adapter.state !== "parked") {
        issues.push(`adapterContracts.providerAdapters.${index}.state`);
      }
      if ((adapter.id === "seedance2-provider" || adapter.id === "jimeng-video") && (adapter.slot !== "video.i2v" || !arrayIncludes(adapter.requiredModes, "frames2video"))) {
        issues.push(`adapterContracts.providerAdapters.${index}.videoMode`);
      }
      const capabilitySummary = requireRecord(adapter, "capabilitySummary", issues);
      if ((adapter.id === "seedance2-provider" || adapter.id === "jimeng-video") && capabilitySummary.supportsTextToVideo === true) {
        issues.push(`adapterContracts.providerAdapters.${index}.supportsTextToVideo`);
      }
      if (adapter.id === "image2-provider" && (adapter.state !== "active" || adapter.slot !== "image.generate")) {
        issues.push(`adapterContracts.providerAdapters.${index}.image2Generate`);
      }
      if (adapter.id === "image2-edit-provider" && (adapter.state !== "active" || adapter.slot !== "image.edit")) {
        issues.push(`adapterContracts.providerAdapters.${index}.image2Edit`);
      }
      if (adapter.id === "image2-reference-asset-provider" && (adapter.state !== "active" || adapter.slot !== "image.reference_asset")) {
        issues.push(`adapterContracts.providerAdapters.${index}.image2ReferenceAsset`);
      }
      if (adapter.id === "local-postprocess-planned" && (adapter.state !== "planned" || adapter.slot !== "local.postprocess")) {
        issues.push(`adapterContracts.providerAdapters.${index}.localPostprocess`);
      }
    });
  }
  if (typeof generationHarness.schemaVersion !== "string") issues.push("generationHarness.schemaVersion");
  if (typeof generationHarness.generatedAt !== "string") issues.push("generationHarness.generatedAt");
  for (const key of ["total", "blocked", "waiting", "qaPending", "formalReady", "canPromoteToFormal"]) {
    if (typeof generationHarnessSummary[key] !== "number") issues.push(`generationHarness.summary.${key}`);
  }
  if (generationHarnessSummary.liveSubmitAllowed !== false) issues.push("generationHarness.summary.liveSubmitAllowed");
  if (generationHarness.dryRunOnly !== true) issues.push("generationHarness.dryRunOnly");
  if (generationHarness.providerSubmissionForbidden !== true) issues.push("generationHarness.providerSubmissionForbidden");
  if (generationHarness.liveSubmitAllowed !== false) issues.push("generationHarness.liveSubmitAllowed");
  if (generationPostprocessPolicy.semanticRepairAllowed !== false) issues.push("generationHarness.postprocessPolicy.semanticRepairAllowed");
  if (generationPostprocessPolicy.openCvSemanticRepairAllowed !== false) issues.push("generationHarness.postprocessPolicy.openCvSemanticRepairAllowed");
  if (generationPostprocessPolicy.localPostprocessCanChangeMeaning !== false) issues.push("generationHarness.postprocessPolicy.localPostprocessCanChangeMeaning");
  if (generationPostprocessPolicy.localPostprocessCanPromoteFormal !== false) issues.push("generationHarness.postprocessPolicy.localPostprocessCanPromoteFormal");
  requiredGenerationHarnessForbiddenActions.forEach((action) => {
    if (!arrayIncludes(generationHarness.forbiddenActions, action)) issues.push(`generationHarness.forbiddenActions.${action}`);
  });
  if (Array.isArray(generationHarness.jobs)) {
    generationHarness.jobs.forEach((job, index) => {
      if (!isRecord(job)) {
        issues.push(`generationHarness.jobs.${index}`);
        return;
      }
      const requestPreview = requireRecord(job, "providerRequestPreview", issues);
      const candidateOutput = requireRecord(job, "candidateOutput", issues);
      const jobPostprocessPolicy = requireRecord(job, "postprocessPolicy", issues);
      requireArray(job, "forbiddenActions", issues);
      requireArray(job, "stages", issues);
      requireArray(job, "blockers", issues);
      requireArray(job, "warnings", issues);
      if (job.dryRunOnly !== true) issues.push(`generationHarness.jobs.${index}.dryRunOnly`);
      if (job.providerSubmissionForbidden !== true) issues.push(`generationHarness.jobs.${index}.providerSubmissionForbidden`);
      if (job.liveSubmitAllowed !== false) issues.push(`generationHarness.jobs.${index}.liveSubmitAllowed`);
      requiredGenerationHarnessForbiddenActions.forEach((action) => {
        if (!arrayIncludes(job.forbiddenActions, action)) issues.push(`generationHarness.jobs.${index}.forbiddenActions.${action}`);
      });
      if (requestPreview.dryRunOnly !== true) issues.push(`generationHarness.jobs.${index}.providerRequestPreview.dryRunOnly`);
      if (requestPreview.providerSubmissionForbidden !== true) issues.push(`generationHarness.jobs.${index}.providerRequestPreview.providerSubmissionForbidden`);
      if (requestPreview.liveSubmitAllowed !== false) issues.push(`generationHarness.jobs.${index}.providerRequestPreview.liveSubmitAllowed`);
      if (requestPreview.liveSubmitForbidden !== true) issues.push(`generationHarness.jobs.${index}.providerRequestPreview.liveSubmitForbidden`);
      if (candidateOutput.formalPromotionRequiresExplicitQa !== true) issues.push(`generationHarness.jobs.${index}.candidateOutput.formalPromotionRequiresExplicitQa`);
      if (candidateOutput.autoPromoteToFormal !== false) issues.push(`generationHarness.jobs.${index}.candidateOutput.autoPromoteToFormal`);
      if (candidateOutput.candidatePath && candidateOutput.formalPath && candidateOutput.candidatePath === candidateOutput.formalPath) {
        issues.push(`generationHarness.jobs.${index}.candidateOutput.pathSeparation`);
      }
      if (candidateOutput.canPromoteToFormal === true && (candidateOutput.status !== "formal_ready" || candidateOutput.qaStatus !== "pass")) {
        issues.push(`generationHarness.jobs.${index}.candidateOutput.formalGate`);
      }
      if (jobPostprocessPolicy.semanticRepairAllowed !== false) issues.push(`generationHarness.jobs.${index}.postprocessPolicy.semanticRepairAllowed`);
      if (jobPostprocessPolicy.openCvSemanticRepairAllowed !== false) issues.push(`generationHarness.jobs.${index}.postprocessPolicy.openCvSemanticRepairAllowed`);
      const stageIds = Array.isArray(job.stages)
        ? job.stages.filter((stage): stage is Record<string, unknown> => isRecord(stage)).map((stage) => stage.stageId)
        : [];
      requiredGenerationHarnessStages.forEach((stageId, stageIndex) => {
        if (stageIds[stageIndex] !== stageId) issues.push(`generationHarness.jobs.${index}.stages.${stageId}`);
      });
    });
  }
  if (typeof imageKeyframeRuntime.schemaVersion !== "string") issues.push("imageKeyframeRuntime.schemaVersion");
  if (imageKeyframeRuntime.phase !== "phase17_image2_asset_keyframe_runtime") issues.push("imageKeyframeRuntime.phase");
  if (imageKeyframeRuntime.dryRunOnly !== true) issues.push("imageKeyframeRuntime.dryRunOnly");
  if (imageKeyframeRuntime.noProviderSubmit !== true) issues.push("imageKeyframeRuntime.noProviderSubmit");
  if (imageKeyframeRuntime.providerSubmissionForbidden !== true) issues.push("imageKeyframeRuntime.providerSubmissionForbidden");
  if (imageKeyframeRuntime.liveSubmitAllowed !== false) issues.push("imageKeyframeRuntime.liveSubmitAllowed");
  for (const key of ["startFramePlans", "endFramePlans", "keyframePairGates", "readyKeyframePairs", "blockedKeyframePairs", "promotionHandoffItems", "lockedReferences", "candidateReferences", "rejectedReferences"]) {
    if (typeof imageKeyframeSummary[key] !== "number") issues.push(`imageKeyframeRuntime.summary.${key}`);
  }
  for (const [key, expected] of Object.entries({
    dryRunOnly: true,
    noProviderSubmit: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    noCredentialRead: true,
    noFileMutation: true,
    noShell: true,
    noFast: true,
    noVip: true,
    noTextToVideo: true,
    noImage2Fallback: true,
    noIndependentEndFrame: true,
  })) {
    if (imageKeyframeLocks[key] !== expected) issues.push(`imageKeyframeRuntime.runtimeLocks.${key}`);
  }
  requireArray(imageKeyframeRuntime, "image2StartFramePlans", issues);
  requireArray(imageKeyframeRuntime, "image2EndFramePlans", issues);
  requireArray(imageKeyframeRuntime, "keyframePairGates", issues);
  requireArray(imageKeyframeRuntime, "runtimeLockGates", issues);

  if (issues.length) throw new Error(`runtime-state shape invalid: ${issues.join(", ")}`);
}

function normalizeRuntimeState(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    ...value,
    runtime: ensureRuntimeEnvironment(
      isRecord(value.runtime) ? value.runtime : undefined,
      { generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : undefined },
    ),
  };
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

type ImagePipelineState = ProjectRuntimeState["imagePipeline"];
type VideoPlanningState = ProjectRuntimeState["videoPlanning"];
type VideoExecutionPreviewState = ProjectRuntimeState["videoExecutionPreview"];
type VideoExecutionPreviewRow = VideoExecutionPreviewState["previews"][number];
type VideoReadinessGateState = VideoPlanningState["readinessGates"][number];
type VideoTaskPlanState = VideoPlanningState["taskPlans"][number];
type AdapterContractState = ProjectRuntimeState["adapterContracts"];
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
type GenerationHarnessStage = {
  id: string;
  label: string;
  status: string;
  detail?: string;
};
type GenerationHarnessCandidateOutput = {
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
type GenerationHarnessState = {
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
type FilesystemWatcherHarnessState = {
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
type CheckpointResumeHarnessState = {
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
type QaGateRow = {
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
type QaHarnessState = {
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
type ToolRuntimeHarnessState = {
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
  "start_end_frames_required",
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

function getImagePipeline(runtimeState: ProjectRuntimeState): ImagePipelineState {
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

function buildVoiceAudioSettingsUiSummary(runtimeState: ProjectRuntimeState): VoiceAudioSettingsUiSummary {
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

function providerEnablementGateReadinessLabel(
  status: string,
  initialized: boolean,
  readyForConfirmation: number,
  blocked: number,
  parked: number,
) {
  if (!initialized) return "blocked/missing";
  const normalized = status.toLowerCase();
  if (normalized.includes("ready_for_confirmation") || normalized.includes("ready for confirmation")) return "ready_for_confirmation";
  if (normalized.includes("blocked") || normalized.includes("missing") || normalized.includes("fail")) return "blocked";
  if (normalized.includes("parked")) return "parked";
  if (blocked > 0) return "blocked";
  if (readyForConfirmation > 0) return "ready_for_confirmation";
  if (parked > 0) return "parked";
  return status ? statusLabel(status) : "blocked/missing";
}

function readProviderEnablementGateChecks(items: unknown[]) {
  return items.flatMap((item) => isRecord(item) && Array.isArray(item.checks) ? item.checks : []).filter(isRecord);
}

function checkPassed(checks: Record<string, unknown>[], pattern: RegExp) {
  const matching = checks.filter((check) => pattern.test(readString(check.checkId, readString(check.label, ""))));
  if (!matching.length) return undefined;
  return matching.every((check) => check.passed === true || readString(check.status, "").toLowerCase() === "pass");
}

function yesNoMissing(value: boolean | undefined, yes: string, no: string) {
  if (value === true) return yes;
  if (value === false) return no;
  return "blocked/missing";
}

function buildProviderEnablementGateHardLocks(rootRecord: Record<string, unknown>, summary: Record<string, unknown>) {
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const summaryLocks = firstRecordFrom(summary, ["hardLocks", "locks", "hardLockSummary"]);
  const lockRecords = [hardLocksRecord, summaryLocks, rootRecord, summary];
  const explicitHardLocks = firstArrayFrom([rootRecord, summary, hardLocksRecord], ["hardLocks", "locks", "hardLockStrip"])
    .map((item, index) => formatHarnessValue(item, `hard lock ${index + 1}`))
    .filter(Boolean);
  const inferredLocks = [
    readBooleanLockLabel(hardLocksRecord, "dryRunOnly", "dry-run only", true),
    readBooleanLockLabel(hardLocksRecord, "readOnly", "read-only", true),
    readBooleanLockLabel(hardLocksRecord, "readinessPlanOnly", "readiness plan only", true),
    readBooleanLockLabel(hardLocksRecord, "confirmationPlanOnly", "confirmation plan only", true),
    readBooleanLockLabel(hardLocksRecord, "providerSubmissionForbidden", "provider submit blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noProviderSubmit", "canSubmitProvider=false", true),
    readBooleanLockLabel(hardLocksRecord, "liveSubmitAllowed", "live submit locked", false),
    readBooleanLockLabel(hardLocksRecord, "credentialStorage", "credential storage locked", false),
    readBooleanLockLabel(hardLocksRecord, "noCredentialRead", "credential read locked", true),
    readBooleanLockLabel(hardLocksRecord, "noCredentialWrite", "credential write locked", true),
    readBooleanLockLabel(hardLocksRecord, "noArbitraryProviderCommand", "shell locked", true),
    readBooleanLockLabel(hardLocksRecord, "fastModelForbidden", "Fast absent", true),
    readBooleanLockLabel(hardLocksRecord, "vipChannelForbidden", "VIP absent", true),
    readBooleanLockLabel(hardLocksRecord, "textToVideoMainPathForbidden", "text-to-video absent", true),
    readBooleanLockLabel(hardLocksRecord, "bgmInVideoPromptForbidden", "BGM prompt absent", true),
    readFirstBoolean(lockRecords, ["canSubmitProvider"]) === false ? "canSubmitProvider=false" : undefined,
  ].filter((lock): lock is string => Boolean(lock));

  return Array.from(new Set([...explicitHardLocks, ...inferredLocks]));
}

function buildProviderEnablementGateUiSummary(runtimeState: ProjectRuntimeState): ProviderEnablementGateUiSummary {
  const root = (runtimeState as Partial<ProjectRuntimeState> & { providerLiveGate?: unknown }).providerLiveGate;
  const initialized = isRecord(root);
  const rootRecord = initialized ? root as Record<string, unknown> : {};
  const summary = initialized && isRecord(rootRecord.summary) ? rootRecord.summary : {};
  const items = Array.isArray(rootRecord.items) ? rootRecord.items : [];
  const checks = readProviderEnablementGateChecks(items);
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const records = [summary, rootRecord, hardLocksRecord].filter(isRecord);
  const readyForConfirmation = readFirstNumber(records, ["readyForConfirmation", "ready_for_confirmation"])
    ?? items.filter((item) => isRecord(item) && item.status === "ready_for_confirmation").length;
  const blocked = readFirstNumber(records, ["blocked"])
    ?? items.filter((item) => isRecord(item) && item.status === "blocked").length;
  const parked = readFirstNumber(records, ["parked"])
    ?? items.filter((item) => isRecord(item) && item.status === "parked").length;
  const status = readFirstString(records, ["readiness", "status", "state"], "");
  const tokenPresent = readFirstBoolean(records, [
    "providerConfirmationTokenPlaceholderPresent",
    "confirmationTokenPlaceholderPresent",
    "confirmationTokenPresent",
    "userConfirmationTokenPlaceholderPresent",
  ]) ?? checkPassed(checks, /user_confirmation_token_placeholder|confirmation/i);
  const packetComplete = readFirstBoolean(records, [
    "providerPacketComplete",
    "packetComplete",
    "enablementPacketComplete",
    "completeEnablementPacket",
  ]) ?? checkPassed(checks, /envelope_valid|packet|enablement/i);
  const closedLoopSignals = [
    checkPassed(checks, /asset_readiness|watcher/),
    checkPassed(checks, /envelope_valid|manifest/),
    checkPassed(checks, /pair_qa_pass|qa/),
  ];
  const inferredClosedLoop = closedLoopSignals.every((signal) => signal !== undefined)
    ? closedLoopSignals.every((signal) => signal === true)
    : undefined;
  const closedLoop = readFirstBoolean(records, [
    "closedLoopReady",
    "closedLoopComplete",
    "closedLoopRequirementMet",
    "watcherManifestQaClosedLoop",
  ]) ?? inferredClosedLoop;
  const forbiddenPathSignals = [
    hardLocksRecord.fastModelForbidden,
    hardLocksRecord.vipChannelForbidden,
    hardLocksRecord.textToVideoMainPathForbidden,
    hardLocksRecord.bgmInVideoPromptForbidden,
  ];
  const inferredForbiddenPathsAbsent = forbiddenPathSignals.every((signal) => typeof signal === "boolean")
    ? forbiddenPathSignals.every((signal) => signal === true)
    : undefined;
  const forbiddenPathsAbsent = readFirstBoolean(records, [
    "forbiddenProviderModesAbsent",
    "forbiddenPathsAbsent",
    "forbiddenModesAbsent",
  ]) ?? inferredForbiddenPathsAbsent;
  const canSubmitProvider = readFirstBoolean(records, ["canSubmitProvider"]);
  const providerSubmitBlocked = readFirstBoolean(records, [
    "providerSubmissionForbidden",
    "providerSubmitBlocked",
    "noProviderSubmit",
  ]) ?? hardLocksRecord.providerSubmissionForbidden === true;
  const credentialLiveShellLocked =
    (readFirstBoolean(records, ["credentialStorage"]) === false || hardLocksRecord.noCredentialRead === true || hardLocksRecord.noCredentialWrite === true)
    && (readFirstBoolean(records, ["liveSubmitAllowed"]) === false)
    && (hardLocksRecord.noArbitraryProviderCommand === true || hardLocksRecord.arbitraryShellExecutionBlocked === true);
  const blockersWarnings = Array.from(new Set([
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...items.flatMap((item) => isRecord(item) ? readDisplayList(item.blockers, "blocker") : []),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
    ...items.flatMap((item) => isRecord(item) ? readDisplayList(item.warnings, "warning") : []),
  ].filter(Boolean)));
  const hardLocks = buildProviderEnablementGateHardLocks(rootRecord, summary);

  return {
    initialized,
    readiness: providerEnablementGateReadinessLabel(status, initialized, readyForConfirmation, blocked, parked),
    readyForConfirmation,
    blocked,
    parked,
    confirmationTokenStatus: yesNoMissing(tokenPresent, "placeholder present", "placeholder missing"),
    packetCompleteStatus: yesNoMissing(packetComplete, "complete", "incomplete"),
    closedLoopStatus: yesNoMissing(closedLoop, "closed loop satisfied", "closed loop missing"),
    forbiddenPathsAbsent: yesNoMissing(forbiddenPathsAbsent, "Fast / VIP / text-to-video / BGM prompt absent", "forbidden path present"),
    canSubmitProvider: canSubmitProvider === false ? "canSubmitProvider=false" : "blocked/missing",
    submitBlocked: providerSubmitBlocked ? "provider submit blocked" : "blocked/missing",
    credentialLiveShellLocked: credentialLiveShellLocked ? "credential/live submit/shell locked" : "blocked/missing",
    blockersWarnings: blockersWarnings.length ? blockersWarnings : initialized ? [] : ["blocked/missing runtimeState.providerLiveGate"],
    hardLocks: hardLocks.length ? hardLocks : [initialized ? "hard locks blocked/missing" : "blocked/missing runtimeState.providerLiveGate"],
  };
}

function providerExecutionPermissionGateReadinessLabel(
  status: string,
  initialized: boolean,
  readyForUserReview: number,
  blocked: number,
  parked: number,
) {
  if (!initialized) return "blocked/missing";
  if (blocked > 0) return "blocked";
  if (readyForUserReview > 0) return "ready_for_user_review";
  if (parked > 0) return "parked";
  return status ? statusLabel(status) : "blocked/missing";
}

function buildProviderExecutionPermissionGateHardLocks(rootRecord: Record<string, unknown>, summary: Record<string, unknown>) {
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const explicitHardLocks = firstArrayFrom([rootRecord, summary, hardLocksRecord], ["hardLocks", "locks", "hardLockStrip"])
    .map((item, index) => formatHarnessValue(item, `hard lock ${index + 1}`))
    .filter(Boolean);
  const inferredLocks = [
    readBooleanLockLabel(hardLocksRecord, "dryRunOnly", "dry-run only", true),
    readBooleanLockLabel(hardLocksRecord, "readOnly", "read-only", true),
    readBooleanLockLabel(hardLocksRecord, "reviewPlanOnly", "review plan only", true),
    readBooleanLockLabel(hardLocksRecord, "actionTimeConfirmationRequired", "action-time confirmation", true),
    readBooleanLockLabel(hardLocksRecord, "providerSubmissionForbidden", "provider submit blocked", true),
    readBooleanLockLabel(hardLocksRecord, "canSubmitProvider", "canSubmitProvider=false", false),
    hardLocksRecord.providerSubmitAllowed === 0 ? "providerSubmitAllowed=0" : undefined,
    readBooleanLockLabel(hardLocksRecord, "liveSubmitAllowed", "live submit locked", false),
    readBooleanLockLabel(hardLocksRecord, "credentialAccessAllowed", "credential access locked", false),
    readBooleanLockLabel(hardLocksRecord, "noWorkerSpawn", "worker spawn locked", true),
    readBooleanLockLabel(hardLocksRecord, "noFileMutation", "file mutation locked", true),
    readBooleanLockLabel(hardLocksRecord, "fastModelForbidden", "Fast absent", true),
    readBooleanLockLabel(hardLocksRecord, "vipChannelForbidden", "VIP absent", true),
    readBooleanLockLabel(hardLocksRecord, "textToVideoMainPathForbidden", "text-to-video absent", true),
    readBooleanLockLabel(hardLocksRecord, "bgmInVideoPromptForbidden", "BGM prompt absent", true),
  ].filter((lock): lock is string => Boolean(lock));

  return Array.from(new Set([...explicitHardLocks, ...inferredLocks]));
}

function buildProviderExecutionPermissionGateUiSummary(runtimeState: ProjectRuntimeState): ProviderExecutionPermissionGateUiSummary {
  const root = (runtimeState as Partial<ProjectRuntimeState> & { providerExecutionPermissionGate?: unknown }).providerExecutionPermissionGate;
  const initialized = isRecord(root);
  const rootRecord = initialized ? root as Record<string, unknown> : {};
  const summary = initialized && isRecord(rootRecord.summary) ? rootRecord.summary : {};
  const evidence = initialized && isRecord(rootRecord.phase31Evidence) ? rootRecord.phase31Evidence : {};
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const records = [summary, evidence, rootRecord, hardLocksRecord].filter(isRecord);
  const requests = Array.isArray(rootRecord.requests) ? rootRecord.requests : [];
  const readyForUserReview = readFirstNumber(records, ["readyForUserReview", "ready_for_user_review"])
    ?? requests.filter((request) => isRecord(request) && request.status === "ready_for_user_review").length;
  const blocked = readFirstNumber(records, ["blocked"])
    ?? requests.filter((request) => isRecord(request) && request.status === "blocked").length;
  const parked = readFirstNumber(records, ["parked"])
    ?? requests.filter((request) => isRecord(request) && request.status === "parked").length;
  const canAskUserToConfirm = readFirstNumber(records, ["canAskUserToConfirm"])
    ?? requests.filter((request) => isRecord(request) && request.canAskUserToConfirm === true).length;
  const status = readFirstString(records, ["readiness", "status", "state"], "");
  const actionTimeRequired = readFirstBoolean(records, ["actionTimeUserConfirmationRequired", "actionTimeConfirmationRequired"]);
  const automaticSubmitAllowed = readFirstBoolean(records, ["automaticSubmitAllowed"]);
  const automaticSubmitForbidden = readFirstBoolean(records, ["automaticSubmitForbidden"]) ?? automaticSubmitAllowed === false;
  const providerSubmitAllowed = readFirstNumber(records, ["providerSubmitAllowed"]) ?? (readFirstBoolean(records, ["canSubmitProvider"]) === false ? 0 : undefined);
  const liveSubmitAllowed = readFirstBoolean(records, ["liveSubmitAllowed"]);
  const credentialAccessAllowed = readFirstBoolean(records, ["credentialAccessAllowed"]);
  const workerSpawnLocked = readFirstBoolean(records, ["noWorkerSpawn"]);
  const fileMutationLocked = readFirstBoolean(records, ["noFileMutation"]);
  const blockersWarnings = Array.from(new Set([
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...requests.flatMap((request) => isRecord(request) ? readDisplayList(request.blockers, "blocker") : []),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
    ...requests.flatMap((request) => isRecord(request) ? readDisplayList(request.warnings, "warning") : []),
  ].filter(Boolean)));
  const hardLocks = buildProviderExecutionPermissionGateHardLocks(rootRecord, summary);

  return {
    initialized,
    readiness: providerExecutionPermissionGateReadinessLabel(status, initialized, readyForUserReview, blocked, parked),
    readyForUserReview,
    blocked,
    parked,
    canAskUserToConfirm,
    actionTimeConfirmation: actionTimeRequired ? "required" : "blocked/missing",
    automaticSubmit: automaticSubmitForbidden ? "automatic submit blocked" : "blocked/missing",
    providerSubmit: providerSubmitAllowed === 0 ? "provider submit blocked" : "blocked/missing",
    credentialWorkerFileLocks: liveSubmitAllowed === false && credentialAccessAllowed === false && workerSpawnLocked === true && fileMutationLocked === true
      ? "credential/live/worker/file locked"
      : "blocked/missing",
    blockersWarnings: blockersWarnings.length ? blockersWarnings : initialized ? [] : ["blocked/missing runtimeState.providerExecutionPermissionGate"],
    hardLocks: hardLocks.length ? hardLocks : [initialized ? "hard locks blocked/missing" : "blocked/missing runtimeState.providerExecutionPermissionGate"],
  };
}

function providerActionConfirmationReceiptReadinessLabel(
  status: string,
  initialized: boolean,
  readyReceipts: number,
  blocked: number,
  parked: number,
  confirmedCount: number,
) {
  if (!initialized) return "blocked/missing";
  const normalized = status.toLowerCase();
  if (blocked > 0 || normalized.includes("blocked") || normalized.includes("missing") || normalized.includes("fail")) return "blocked";
  if (confirmedCount > 0 || normalized.includes("confirmed")) return "confirmed";
  if (readyReceipts > 0 || normalized.includes("ready")) return "ready_receipts";
  if (parked > 0 || normalized.includes("parked")) return "parked";
  return status ? statusLabel(status) : "blocked/missing";
}

function receiptRowIsConfirmed(row: Record<string, unknown>) {
  if (row.confirmed === true || row.userConfirmedAtActionTime === true || row.confirmedAtActionTime === true) return true;
  const confirmations = Array.isArray(row.confirmations) ? row.confirmations : [];
  return confirmations.some((item) => isRecord(item) && item.confirmed === true);
}

function buildProviderActionConfirmationReceiptHardLocks(rootRecord: Record<string, unknown>, summary: Record<string, unknown>) {
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const explicitHardLocks = firstArrayFrom([rootRecord, summary, hardLocksRecord], ["hardLocks", "locks", "hardLockStrip"])
    .map((item, index) => formatHarnessValue(item, `hard lock ${index + 1}`))
    .filter(Boolean);
  const inferredLocks = [
    readBooleanLockLabel(hardLocksRecord, "dryRunOnly", "dry-run only", true),
    readBooleanLockLabel(hardLocksRecord, "readOnly", "read-only", true),
    readBooleanLockLabel(hardLocksRecord, "receiptOnly", "receipt only", true),
    readBooleanLockLabel(hardLocksRecord, "receiptPlanOnly", "receipt plan only", true),
    readBooleanLockLabel(hardLocksRecord, "reviewShellOnly", "review shell only", true),
    readBooleanLockLabel(hardLocksRecord, "actionTimeConfirmationRequired", "action-time confirmation required", true),
    readBooleanLockLabel(hardLocksRecord, "providerSubmissionForbidden", "provider submit blocked", true),
    readBooleanLockLabel(hardLocksRecord, "noProviderSubmit", "provider submit blocked", true),
    readBooleanLockLabel(hardLocksRecord, "canSubmitProvider", "canSubmitProvider=false", false),
    hardLocksRecord.providerSubmitAllowed === 0 ? "providerSubmitAllowed=0" : undefined,
    readBooleanLockLabel(hardLocksRecord, "liveSubmitAllowed", "live submit locked", false),
    readBooleanLockLabel(hardLocksRecord, "credentialAccessAllowed", "credential access locked", false),
    readBooleanLockLabel(hardLocksRecord, "noCredentialRead", "credential read locked", true),
    readBooleanLockLabel(hardLocksRecord, "noCredentialWrite", "credential write locked", true),
    readBooleanLockLabel(hardLocksRecord, "noWorkerSpawn", "worker spawn locked", true),
    readBooleanLockLabel(hardLocksRecord, "workerSpawnAllowed", "worker spawn locked", false),
    readBooleanLockLabel(hardLocksRecord, "noFileMutation", "file mutation locked", true),
    readBooleanLockLabel(hardLocksRecord, "fileMutationAllowed", "file mutation locked", false),
  ].filter((lock): lock is string => Boolean(lock));

  return Array.from(new Set([...explicitHardLocks, ...inferredLocks]));
}

function buildProviderActionConfirmationReceiptUiSummary(runtimeState: ProjectRuntimeState): ProviderActionConfirmationReceiptUiSummary {
  const root = (runtimeState as Partial<ProjectRuntimeState> & { providerActionConfirmationReceipt?: unknown }).providerActionConfirmationReceipt;
  const initialized = isRecord(root);
  const rootRecord = initialized ? root as Record<string, unknown> : {};
  const summary = initialized && isRecord(rootRecord.summary) ? rootRecord.summary : {};
  const evidence = initialized && isRecord(rootRecord.phase32Evidence) ? rootRecord.phase32Evidence : {};
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const records = [summary, evidence, rootRecord, hardLocksRecord].filter(isRecord);
  const receiptRows = firstArrayFrom([rootRecord, summary], [
    "receipts",
    "items",
    "confirmationReceipts",
    "actionReceipts",
    "requests",
  ]);
  const receiptRecords = receiptRows.filter(isRecord);
  const readyReceipts = readFirstNumber(records, [
    "readyReceipts",
    "readyReceiptCount",
    "readyForReceipt",
    "readyForActionConfirmation",
    "ready",
  ]) ?? receiptRecords.filter((row) => /ready/.test(readString(row.status, "").toLowerCase())).length;
  const blocked = readFirstNumber(records, ["blocked", "blockedReceipts", "blockedReceiptCount"])
    ?? receiptRecords.filter((row) => readString(row.status, "") === "blocked").length;
  const parked = readFirstNumber(records, ["parked", "parkedReceipts", "parkedReceiptCount"])
    ?? receiptRecords.filter((row) => readString(row.status, "") === "parked").length;
  const confirmedCount = readFirstNumber(records, [
    "confirmedCount",
    "confirmedReceiptCount",
    "confirmedReceipts",
    "confirmed",
  ]) ?? receiptRecords.filter(receiptRowIsConfirmed).length;
  const status = readFirstString(records, ["readiness", "status", "state"], "");
  const providerSubmitAllowedNumber = readFirstNumber(records, ["providerSubmitAllowed"]);
  const providerSubmitAllowedBoolean = readFirstBoolean(records, ["providerSubmitAllowed", "canSubmitProvider"]);
  const providerSubmitBlockedFlag = readFirstBoolean(records, [
    "providerSubmitBlocked",
    "providerSubmissionForbidden",
    "noProviderSubmit",
  ]);
  const providerSubmitBlocked = providerSubmitAllowedNumber === 0
    || providerSubmitAllowedBoolean === false
    || providerSubmitBlockedFlag === true;
  const providerSubmitDrift = (providerSubmitAllowedNumber !== undefined && providerSubmitAllowedNumber !== 0)
    || providerSubmitAllowedBoolean === true
    || providerSubmitBlockedFlag === false;
  const credentialLocked = readFirstBoolean(records, ["credentialAccessAllowed", "credentialReadAllowed", "credentialStorage"]) === false
    || records.some((record) => record.noCredentialRead === true || record.noCredentialWrite === true || record.credentialAccessBlocked === true);
  const workerLocked = readFirstBoolean(records, ["workerSpawnAllowed", "canSpawnWorker", "workerExecutionAllowed"]) === false
    || records.some((record) => record.noWorkerSpawn === true || record.workerSpawnBlocked === true);
  const fileLocked = readFirstBoolean(records, ["fileMutationAllowed", "canMutateFiles", "fileWriteAllowed"]) === false
    || records.some((record) => record.noFileMutation === true || record.fileMutationBlocked === true);
  const blockersWarnings = Array.from(new Set([
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...receiptRecords.flatMap((row) => readDisplayList(row.blockers, "blocker")),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
    ...receiptRecords.flatMap((row) => readDisplayList(row.warnings, "warning")),
  ].filter(Boolean)));
  const hardLocks = buildProviderActionConfirmationReceiptHardLocks(rootRecord, summary);

  return {
    initialized,
    readiness: providerActionConfirmationReceiptReadinessLabel(status, initialized, readyReceipts, blocked, parked, confirmedCount),
    readyReceipts,
    blocked,
    parked,
    confirmedCount,
    providerSubmitBlocked: providerSubmitBlocked ? "provider submit blocked" : providerSubmitDrift ? "provider submit drift" : "blocked/missing",
    credentialWorkerFileLocked: credentialLocked && workerLocked && fileLocked ? "credential/worker/file locked" : "blocked/missing",
    blockersWarnings: blockersWarnings.length ? blockersWarnings : initialized ? [] : ["blocked/missing runtimeState.providerActionConfirmationReceipt"],
    hardLocks: hardLocks.length ? hardLocks : [initialized ? "hard locks blocked/missing" : "blocked/missing runtimeState.providerActionConfirmationReceipt"],
  };
}

function providerExecutionHandoffReadinessLabel(
  status: string,
  initialized: boolean,
  handoffCount: number,
  blockedCount: number,
  confirmedCount: number,
) {
  if (!initialized) return "blocked/missing";
  const normalized = status.toLowerCase();
  if (blockedCount > 0 || normalized.includes("blocked") || normalized.includes("missing") || normalized.includes("fail")) return "blocked";
  if (confirmedCount > 0 || normalized.includes("confirmed")) return "confirmed";
  if (handoffCount > 0 || normalized.includes("ready")) return "ready_for_final_action";
  return status ? statusLabel(status) : "blocked/missing";
}

function handoffRowIsConfirmed(row: Record<string, unknown>) {
  if (row.confirmed === true || row.userConfirmedAtActionTime === true || row.finalActionConfirmed === true) return true;
  const receipts = Array.isArray(row.receipts) ? row.receipts : [];
  const confirmations = Array.isArray(row.confirmations) ? row.confirmations : [];
  return [...receipts, ...confirmations].some((item) => isRecord(item) && item.confirmed === true);
}

function buildProviderExecutionHandoffHardLocks(rootRecord: Record<string, unknown>, summary: Record<string, unknown>) {
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const explicitHardLocks = firstArrayFrom([rootRecord, summary, hardLocksRecord], ["hardLocks", "locks", "hardLockStrip"])
    .map((item, index) => formatHarnessValue(item, `hard lock ${index + 1}`))
    .filter(Boolean);
  const inferredLocks = [
    readBooleanLockLabel(hardLocksRecord, "dryRunOnly", "dry-run only", true),
    readBooleanLockLabel(hardLocksRecord, "readOnly", "read-only", true),
    readBooleanLockLabel(hardLocksRecord, "handoffOnly", "handoff only", true),
    readBooleanLockLabel(hardLocksRecord, "finalActionGateOnly", "final action gate only", true),
    readBooleanLockLabel(hardLocksRecord, "actionTimeConfirmationRequired", "action-time confirmation required", true),
    readBooleanLockLabel(hardLocksRecord, "providerSubmissionForbidden", "provider submit locked", true),
    readBooleanLockLabel(hardLocksRecord, "noProviderSubmit", "provider submit locked", true),
    readBooleanLockLabel(hardLocksRecord, "canSubmitProvider", "canSubmitProvider=false", false),
    hardLocksRecord.providerSubmitAllowed === 0 ? "providerSubmitAllowed=0" : undefined,
    readBooleanLockLabel(hardLocksRecord, "liveSubmitAllowed", "live submit locked", false),
    readBooleanLockLabel(hardLocksRecord, "credentialAccessAllowed", "credential access locked", false),
    readBooleanLockLabel(hardLocksRecord, "noCredentialRead", "credential read locked", true),
    readBooleanLockLabel(hardLocksRecord, "noCredentialWrite", "credential write locked", true),
    readBooleanLockLabel(hardLocksRecord, "noWorkerSpawn", "worker spawn locked", true),
    readBooleanLockLabel(hardLocksRecord, "workerSpawnAllowed", "worker spawn locked", false),
    readBooleanLockLabel(hardLocksRecord, "noFileMutation", "file mutation locked", true),
    readBooleanLockLabel(hardLocksRecord, "fileMutationAllowed", "file mutation locked", false),
  ].filter((lock): lock is string => Boolean(lock));

  return Array.from(new Set([...explicitHardLocks, ...inferredLocks]));
}

function buildProviderExecutionHandoffUiSummary(runtimeState: ProjectRuntimeState): ProviderExecutionHandoffUiSummary {
  const root = (runtimeState as Partial<ProjectRuntimeState> & { providerExecutionHandoff?: unknown }).providerExecutionHandoff;
  const initialized = isRecord(root);
  const rootRecord = initialized ? root as Record<string, unknown> : {};
  const summary = initialized && isRecord(rootRecord.summary) ? rootRecord.summary : {};
  const evidence = initialized && isRecord(rootRecord.phase33Evidence) ? rootRecord.phase33Evidence : {};
  const finalActionGate = firstRecordFrom(rootRecord, ["finalActionGate", "handoffGate", "executionHandoffGate"]);
  const hardLocksRecord = firstRecordFrom(rootRecord, ["hardLocks", "locks", "hardLockSummary"]);
  const records = [summary, evidence, finalActionGate, rootRecord, hardLocksRecord].filter(isRecord);
  const handoffRows = firstArrayFrom([rootRecord, summary, finalActionGate], [
    "handoffs",
    "items",
    "handoffItems",
    "executionHandoffs",
    "finalActionRequests",
    "requests",
  ]);
  const handoffRecords = handoffRows.filter(isRecord);
  const handoffCount = readFirstNumber(records, [
    "handoffCount",
    "totalHandoffs",
    "total",
    "readyHandoffCount",
    "readyForFinalAction",
  ]) ?? handoffRecords.length;
  const blockedCount = readFirstNumber(records, [
    "blockedCount",
    "blocked",
    "blockedHandoffs",
    "blockedHandoffCount",
  ]) ?? handoffRecords.filter((row) => /blocked|missing|fail/.test(readString(row.status, "").toLowerCase())).length;
  const confirmedCount = readFirstNumber(records, [
    "confirmedCount",
    "confirmedHandoffCount",
    "confirmedHandoffs",
    "confirmed",
  ]) ?? handoffRecords.filter(handoffRowIsConfirmed).length;
  const status = readFirstString(records, ["readiness", "status", "state"], "");
  const providerSubmitAllowedNumber = readFirstNumber(records, ["providerSubmitAllowed"]);
  const providerSubmitAllowedBoolean = readFirstBoolean(records, ["providerSubmitAllowed", "canSubmitProvider", "providerSubmitAllowedNow"]);
  const providerSubmitBlockedFlag = readFirstBoolean(records, [
    "providerSubmitLocked",
    "providerSubmitBlocked",
    "providerSubmissionForbidden",
    "noProviderSubmit",
  ]);
  const providerSubmitLocked = providerSubmitAllowedNumber === 0
    || providerSubmitAllowedBoolean === false
    || providerSubmitBlockedFlag === true;
  const providerSubmitDrift = (providerSubmitAllowedNumber !== undefined && providerSubmitAllowedNumber !== 0)
    || providerSubmitAllowedBoolean === true
    || providerSubmitBlockedFlag === false;
  const credentialLocked = readFirstBoolean(records, ["credentialAccessAllowed", "credentialReadAllowed", "credentialStorage"]) === false
    || records.some((record) => record.noCredentialRead === true || record.noCredentialWrite === true || record.credentialAccessBlocked === true);
  const workerLocked = readFirstBoolean(records, ["workerSpawnAllowed", "canSpawnWorker", "workerExecutionAllowed"]) === false
    || records.some((record) => record.noWorkerSpawn === true || record.workerSpawnBlocked === true);
  const fileLocked = readFirstBoolean(records, ["fileMutationAllowed", "canMutateFiles", "fileWriteAllowed"]) === false
    || records.some((record) => record.noFileMutation === true || record.fileMutationBlocked === true);
  const blockersWarnings = Array.from(new Set([
    ...readDisplayList(rootRecord.blockers, "blocker"),
    ...readDisplayList(rootRecord.blockedReasons, "blocker"),
    ...readDisplayList(summary.blockers, "blocker"),
    ...readDisplayList(summary.blockedReasons, "blocker"),
    ...readDisplayList(finalActionGate.blockers, "blocker"),
    ...readDisplayList(finalActionGate.blockedReasons, "blocker"),
    ...handoffRecords.flatMap((row) => readDisplayList(row.blockers, "blocker")),
    ...readDisplayList(rootRecord.warnings, "warning"),
    ...readDisplayList(summary.warnings, "warning"),
    ...readDisplayList(finalActionGate.warnings, "warning"),
    ...handoffRecords.flatMap((row) => readDisplayList(row.warnings, "warning")),
  ].filter(Boolean)));
  const hardLocks = buildProviderExecutionHandoffHardLocks(rootRecord, summary);

  return {
    initialized,
    readiness: providerExecutionHandoffReadinessLabel(status, initialized, handoffCount, blockedCount, confirmedCount),
    handoffCount,
    blockedCount,
    confirmedCount,
    providerSubmitLocked: providerSubmitLocked ? "provider submit locked" : providerSubmitDrift ? "provider submit drift" : "blocked/missing",
    credentialWorkerFileLocked: credentialLocked && workerLocked && fileLocked ? "credential/worker/file locked" : "blocked/missing",
    blockersWarnings: blockersWarnings.length ? blockersWarnings : initialized ? [] : ["blocked/missing runtimeState.providerExecutionHandoff"],
    hardLocks: hardLocks.length ? hardLocks : [initialized ? "hard locks blocked/missing" : "blocked/missing runtimeState.providerExecutionHandoff"],
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
    readBooleanLockLabel(hardLocksRecord, "noSpawnCodex", "Codex spawn locked", true),
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

function buildLocalOrchestratorUiSummary(runtimeState: ProjectRuntimeState): LocalOrchestratorUiSummary {
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
    const activity = isRecord(item.codexActivity) ? item.codexActivity : {};
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

function buildDirectorProgressStripState(runtimeState: ProjectRuntimeState): DirectorProgressStripState {
  const summary = buildLocalOrchestratorUiSummary(runtimeState);
  const knownPreparing = Math.max(0, summary.ready + summary.waiting);
  const working = Math.max(0, summary.runningPlanned + summary.waitingOutput);
  const review = Math.max(0, summary.qaPending + summary.needsReview);
  const blocked = Math.max(0, summary.blocked + summary.failed + summary.stalled);
  const complete = Math.max(0, summary.completeVerified);
  const knownTotal = knownPreparing + working + review + blocked + complete;
  const preparing = knownPreparing + Math.max(0, summary.queueTotal - knownTotal);
  const observedTotal = preparing + working + review + blocked + complete;
  const total = Math.max(summary.queueTotal, observedTotal);
  const hasItems = summary.initialized && total > 0;

  let tone: DirectorProgressTone = "preparing";
  let label = "准备中";
  if (!hasItems) {
    label = "准备中";
  } else if (blocked > 0) {
    tone = "blocked";
    label = "有阻断";
  } else if (review > 0) {
    tone = "review";
    label = "等待复核";
  } else if (working > 0) {
    tone = "working";
    label = "生成中";
  } else if (complete === total) {
    tone = "complete";
    label = "已完成";
  }

  const detail = !hasItems
    ? "等待项目任务"
    : tone === "blocked"
      ? `${total} 项 · ${blocked} 项有阻断`
      : tone === "review"
        ? `${total} 项 · ${review} 项等待复核`
        : tone === "working"
          ? `${total} 项 · ${working} 项生成中`
          : tone === "complete"
            ? `${total} 项已完成`
            : `${total} 项 · ${preparing} 项准备中`;

  return {
    label,
    detail,
    tone,
    total,
    preparing,
    working,
    review,
    blocked,
    complete,
    segments: [
      { label: "准备中", value: preparing, tone: "preparing" },
      { label: "生成中", value: working, tone: "working" },
      { label: "等待复核", value: review, tone: "review" },
      { label: "有阻断", value: blocked, tone: "blocked" },
      { label: "已完成", value: complete, tone: "complete" },
    ],
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

function buildExportWorkerUiSummary(runtimeState: ProjectRuntimeState): ExportWorkerUiSummary {
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

function buildAgentCliMockRunnerUiSummary(runtimeState: ProjectRuntimeState): AgentCliMockRunnerUiSummary {
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
    readBooleanLockLabel(hardLocksRecord, "noCodexSpawn", "Codex spawn disabled", true),
    readBooleanLockLabel(hardLocksRecord, "canSpawnCodex", "Codex spawn disabled", false),
    readBooleanLockLabel(hardLocksRecord, "noCodexResume", "Codex resume disabled", true),
    readBooleanLockLabel(hardLocksRecord, "canResumeCodex", "Codex resume disabled", false),
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

function buildCodexCliAdapterSpikeUiSummary(runtimeState: ProjectRuntimeState): CodexCliAdapterSpikeUiSummary {
  const root = (runtimeState as Partial<ProjectRuntimeState> & { codexCliAdapterSpike?: unknown }).codexCliAdapterSpike;
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
  const spawnExecuted = readFirstBoolean(records, ["spawnExecuted", "spawnCodexObserved", "codexSpawnObserved"]) === true;
  const resumeExecuted = readFirstBoolean(records, ["resumeExecuted", "resumeCodexObserved", "codexResumeObserved"]) === true;
  const spawnPlanned = readFirstBoolean(records, ["spawnShapePlanned", "canSpawnCodex", "spawnPlanned"]) !== false;
  const resumePlanned = readFirstBoolean(records, ["resumeShapePlanned", "canResumeCodex", "resumePlanned"]) !== false;
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
    readBooleanLockLabel(hardLocksRecord, "noActualCodexSpawn", "spawn disabled", true),
    readBooleanLockLabel(hardLocksRecord, "noActualCodexResume", "resume disabled", true),
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
    blockers: blockers.length ? blockers : initialized ? [] : ["blocked/missing runtimeState.codexCliAdapterSpike"],
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

function getGenerationHealthChecker(runtimeState: ProjectRuntimeState): GenerationHealthCheckerState {
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

function getPromptConflictChecker(runtimeState: ProjectRuntimeState): PromptConflictCheckerState {
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

function getGenerationHarness(runtimeState: ProjectRuntimeState): GenerationHarnessState {
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

function getFilesystemWatcherHarness(runtimeState: ProjectRuntimeState): FilesystemWatcherHarnessState {
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

function getCheckpointResumeHarness(runtimeState: ProjectRuntimeState): CheckpointResumeHarnessState {
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

function getQaHarness(runtimeState: ProjectRuntimeState): QaHarnessState {
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

function getToolRuntimeHarness(runtimeState: ProjectRuntimeState): ToolRuntimeHarnessState {
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

function getVideoPlanning(runtimeState: ProjectRuntimeState): VideoPlanningState {
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

function getVideoExecutionPreview(runtimeState: ProjectRuntimeState): VideoExecutionPreviewState {
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

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

function CompactList({ items, empty = "No blockers or warnings." }: { items: string[]; empty?: string }) {
  if (!items.length) return <small className="muted-copy">{empty}</small>;
  return (
    <div className="compact-list">
      {items.slice(0, 5).map((item, index) => (
        <small key={`${item}-${index}`}>{item}</small>
      ))}
      {items.length > 5 && <small>+{items.length - 5} more</small>}
    </div>
  );
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function describePreviewEvent(event?: PreviewEvent) {
  if (!event) return "No draft event for this shot.";
  const label = event.type === "blocked_placeholder" ? "blocked placeholder" : statusLabel(event.type);
  return `${label} · ${formatDuration(event.durationSeconds)} at ${formatDuration(event.startSeconds)} · QA ${event.qaStatus}`;
}

function findAudioPlan(audioPlanning: AudioPlanningState, shotId?: string) {
  if (!shotId) return undefined;
  return audioPlanning.shotPlans.find((plan) => plan.shotId === shotId);
}

function voiceSourceLabel(audioPlanning: AudioPlanningState, sourceId?: string | null) {
  if (!sourceId) return "none";
  return audioPlanning.voiceSourceRegistry.sources.find((source) => source.id === sourceId)?.label || sourceId;
}

function audioPlanBadges(plan?: AudioPlan) {
  if (!plan) return ["Audio planned"];
  return [
    plan.ambienceBrief.trim() ? "Ambience" : undefined,
    plan.narrationText.trim() ? "Narration" : undefined,
    plan.dialogueLines.length ? "Dialogue" : undefined,
    plan.musicAllowed ? "Music planned" : "No music",
  ].filter((item): item is string => Boolean(item));
}

function profileInclusion(
  profile: ExportProfile,
  previewExport: ProjectPreviewExportState,
  shot: ShotRecord,
  tasks: TaskRuntimeView[],
) {
  const draftEvent = previewExport.draftPreview.events.find((event) => event.shotId === shot.id);
  const formalEvent = previewExport.formalPreview.events.find((event) => event.shotId === shot.id);
  const taskPaths = tasks.flatMap((task) => [
    task.job.promptPath,
    task.job.outputPath,
    ...task.taskRun.expectedOutputs,
    ...task.taskRun.actualOutputs,
  ]);
  const shotPaths = [shot.startFrame, shot.endFrame, shot.videoPath, ...taskPaths].filter((path): path is string => Boolean(path));
  const includedPathCount = shotPaths.filter((path) => profile.includedPaths.includes(path)).length;

  if (profile.kind === "rough_cut") {
    return formalEvent
      ? "includes via formal preview event"
      : draftEvent
        ? "includes via draft proxy event"
        : "not included";
  }
  if (profile.kind === "storyboard_table") return "includes shot row";
  if (profile.kind === "asset_package") return includedPathCount ? `includes ${includedPathCount} shot asset path(s)` : "not included";
  if (profile.kind === "developer_archive") return includedPathCount ? `includes ${includedPathCount} task/prompt path(s)` : "not included";
  return "not included";
}

function ExportProfilesPanel({ previewExport }: { previewExport: ProjectPreviewExportState }) {
  return (
    <section className="export-profiles-panel">
      <div className="audit-head">
        <FileJson size={17} />
        <span>Export Profiles</span>
      </div>
      <div className="export-profile-list">
        {previewExport.exportProfiles.map((profile) => (
          <button key={profile.profileId} className="export-profile-row" disabled title="Dry-run plan only. Export is not wired in this UI.">
            <span>
              <strong>{profile.label}</strong>
              <small>{statusLabel(profile.kind)} · {profile.includedPaths.length} path(s)</small>
            </span>
            <StatusPill value={profile.readiness} />
          </button>
        ))}
      </div>
      <small className="muted-copy">Plan only. No files are written or submitted.</small>
    </section>
  );
}

function ShotPreviewExportSummary({
  previewExport,
  selectedShot,
  tasks,
}: {
  previewExport: ProjectPreviewExportState;
  selectedShot?: ShotRecord;
  tasks: TaskRuntimeView[];
}) {
  if (!selectedShot) return <p className="muted-copy">Select a shot to inspect preview and export planning.</p>;

  const draftEvent = previewExport.draftPreview.events.find((event) => event.shotId === selectedShot.id);
  const formalReasons = previewExport.formalPreviewGate.blockedReasons.filter((reason) => reason.includes(selectedShot.id));
  const formalState = formalReasons.length ? "blocked" : previewExport.formalPreviewGate.status;

  return (
    <div className="shot-preview-export">
      <div className="field-grid compact">
        <label>Draft</label>
        <span>{describePreviewEvent(draftEvent)}</span>
        <label>Formal Gate</label>
        <span>{formalState}</span>
        <label>Proxy</label>
        <span>{previewExport.roughCutProxy.proxyOnly ? "rough proxy only" : "unknown"}</span>
        <label>Duration</label>
        <span>{formatDuration(draftEvent?.durationSeconds || 0)}</span>
      </div>
      <div className="profile-inclusion-list">
        {previewExport.exportProfiles.map((profile) => (
          <div key={profile.profileId}>
            <span>{profile.label}</span>
            <small>{profileInclusion(profile, previewExport, selectedShot, tasks)}</small>
          </div>
        ))}
      </div>
      <details className="pipeline-shot-details">
        <summary>Formal blocked reasons ({formalReasons.length})</summary>
        <CompactList items={formalReasons.slice(0, 4)} empty="No shot-specific formal blocker." />
      </details>
    </div>
  );
}

function PreviewExportDiagnostics({ previewExport }: { previewExport: ProjectPreviewExportState }) {
  const gateChecks = Object.entries(previewExport.formalPreviewGate.requiredChecks);

  return (
    <section className="machine-panel preview-export-diagnostics">
      <div className="audit-head">
        <Play size={17} />
        <span>Preview / Export</span>
      </div>
      <div className="summary-grid">
        <Metric label="Formal Gate" value={previewExport.formalPreviewGate.status} detail={`${gateChecks.filter(([, passed]) => !passed).length} failed check(s)`} />
        <Metric label="Blocked Reasons" value={`${previewExport.formalPreviewGate.blockedReasons.length}`} detail="formal preview eligibility" />
        <Metric label="Package" value={previewExport.exportPackagePlan.status} detail={`${previewExport.exportProfiles.length} dry-run profile(s)`} />
        <Metric label="Future Targets" value={`${previewExport.exportPackagePlan.futureTargets.length}`} detail="reserved export slots" />
      </div>
      <div className="preview-export-grid">
        <div className="check-list">
          <h3>Formal Gate Checks</h3>
          {gateChecks.map(([check, passed]) => (
            <div key={check}>
              <span>{statusLabel(check)}</span>
              <StatusPill value={passed ? "PASS" : "blocked"} />
            </div>
          ))}
        </div>
        <div>
          <h3>Blocked Reasons</h3>
          <CompactList items={previewExport.formalPreviewGate.blockedReasons} empty="Formal preview gate is eligible." />
        </div>
        <div>
          <h3>Export Package Targets</h3>
          <CompactList items={previewExport.exportPackagePlan.futureTargets.map((target) => `${target} · ${previewExport.exportPackagePlan.status}`)} empty="No future package targets planned." />
        </div>
      </div>
    </section>
  );
}

function ImagePipelineDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const pipeline = getImagePipeline(runtimeState);
  const capabilities = pipeline.providerRegistry.capabilities;
  const activeImage = capabilities.filter((item) => item.slot.startsWith("image.") && item.executionState === "active").length;
  const parkedVideo = capabilities.filter((item) => item.slot.startsWith("video.") && item.executionState === "parked").length;
  const promptBlocked = pipeline.promptPlans.filter((plan) => plan.status === "blocked").length;
  const promptReady = pipeline.promptPlans.filter((plan) => plan.status === "ready_for_envelope").length;
  const readinessCounts = countBy(pipeline.assetReadinessReports.map((report) => report.status));
  const taskBlocked = pipeline.imageTaskPlans.filter((plan) => plan.status === "blocked").length;
  const taskReady = pipeline.imageTaskPlans.filter((plan) => plan.status === "ready_for_dry_run").length;
  const dryRunOnly = pipeline.image2AdapterRequests.filter((request) => request.submitPolicy?.dry_run_only).length;
  const liveForbidden = pipeline.image2AdapterRequests.filter((request) => request.submitPolicy?.live_submit_forbidden).length;
  const watcherCounts = countBy(pipeline.watcherEvents.map((event) => event.status));
  const healthCounts = countBy(pipeline.generationHealthReports.map((report) => report.healthStatus));
  const promotionCounts = countBy(pipeline.qaPromotionReports.map((report) => report.promotionStatus));
  const blockers = [
    ...pipeline.promptPlans.flatMap((plan) => plan.blockers.map((blocker) => `${plan.shotId || plan.jobId}: ${blocker}`)),
    ...pipeline.assetReadinessReports.flatMap((report) => report.blockers.map((blocker) => `${report.shotId}: ${blocker}`)),
    ...pipeline.imageTaskPlans.flatMap((plan) => plan.blockers.map((blocker) => `${plan.shotId}: ${blocker}`)),
    ...pipeline.generationHealthReports.flatMap((report) => report.blockers.map((blocker) => `${report.shotId}: ${blocker}`)),
    ...pipeline.qaPromotionReports.flatMap((report) => report.blockers.map((blocker) => `${report.shotId}: ${blocker}`)),
  ];
  const warnings = [
    ...pipeline.promptPlans.flatMap((plan) => plan.adapterWarnings.map((warning) => `${plan.shotId || plan.jobId}: ${warning}`)),
    ...pipeline.assetReadinessReports.flatMap((report) => report.warnings.map((warning) => `${report.shotId}: ${warning}`)),
    ...pipeline.imageTaskPlans.flatMap((plan) => plan.warnings.map((warning) => `${plan.shotId}: ${warning}`)),
    ...pipeline.generationHealthReports.flatMap((report) => report.warnings.map((warning) => `${report.shotId}: ${warning}`)),
    ...pipeline.qaPromotionReports.flatMap((report) => report.warnings.map((warning) => `${report.shotId}: ${warning}`)),
  ];

  return (
    <section className="machine-panel image-pipeline-panel">
      <div className="audit-head">
        <Sparkles size={17} />
        <span>Image Pipeline</span>
      </div>
      <div className="summary-grid">
        <Metric label="Provider Capabilities" value={`${capabilities.length}`} detail={`${activeImage} active image · ${parkedVideo} parked video`} />
        <Metric label="Prompt Plans" value={`${pipeline.promptPlans.length}`} detail={`${promptBlocked} blocked · ${promptReady} ready`} />
        <Metric label="Asset Readiness" value={`${readinessCounts.ready || 0}/${pipeline.assetReadinessReports.length}`} detail={`${readinessCounts.draft_only || 0} draft only · ${readinessCounts.blocked || 0} blocked`} />
        <Metric label="Image Task Plans" value={`${pipeline.imageTaskPlans.length}`} detail={`${taskBlocked} blocked · ${taskReady} dry-run ready`} />
      </div>
      <div className="summary-grid pipeline-secondary">
        <Metric label="Adapter Requests" value={`${pipeline.image2AdapterRequests.length}`} detail={`${dryRunOnly} dry run only · ${liveForbidden} live path forbidden`} />
        <Metric label="Watcher Events" value={`${pipeline.watcherEvents.length}`} detail={Object.entries(watcherCounts).map(([key, value]) => `${value} ${statusLabel(key)}`).join(" · ") || "none"} />
        <Metric label="Health Reports" value={`${pipeline.generationHealthReports.length}`} detail={Object.entries(healthCounts).map(([key, value]) => `${value} ${statusLabel(key)}`).join(" · ") || "none"} />
        <Metric label="Promotion Reports" value={`${pipeline.qaPromotionReports.length}`} detail={Object.entries(promotionCounts).map(([key, value]) => `${value} ${statusLabel(key)}`).join(" · ") || "none"} />
      </div>
      <div className="pipeline-details">
        <details>
          <summary>Blockers ({blockers.length})</summary>
          <CompactList items={blockers} />
        </details>
        <details>
          <summary>Warnings ({warnings.length})</summary>
          <CompactList items={warnings} />
        </details>
      </div>
    </section>
  );
}

function GenerationHealthCheckerDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const checker = getGenerationHealthChecker(runtimeState);
  const visibleFacts = checker.factChainSummary.slice(0, 6);

  return (
    <section className="machine-panel health-checker-panel">
      <div className="audit-head">
        <ListChecks size={17} />
        <span>Generation Health Checker</span>
      </div>
      <div className="summary-grid checker-metrics">
        <Metric label="Reports" value={`${checker.reportCount}`} detail={checker.initialized ? "fact chain coverage" : "Not initialized"} />
        <Metric label="Postprocess Recoverable" value={`${checker.postprocessRecoverable}`} detail="recoverable only; no semantic repair" />
        <Metric label="Worker Mismatch" value={`${checker.workerSelfReportMismatch}`} detail="self-report differs from evidence" />
        <Metric label="QA Coverage Missing" value={`${checker.qaCoverageMissing}`} detail="missing explicit QA signal" />
      </div>
      {!checker.initialized && (
        <p className="muted-copy generation-empty-state">Generation Health Checker runtime field not initialized; showing defaults.</p>
      )}
      <div className="checker-fact-table">
        {visibleFacts.map((fact) => (
          <div key={fact.id} className="checker-fact-row">
            <div>
              <strong>{fact.label}</strong>
              <small>{fact.sourceRefs.join(" · ") || fact.id}</small>
            </div>
            <StatusPill value={fact.status} />
            <small>{fact.detail}</small>
          </div>
        ))}
        {checker.initialized && !visibleFacts.length && <p className="muted-copy">No fact chain rows reported.</p>}
      </div>
      <div className="pipeline-details checker-details">
        <details open={Boolean(checker.blockers.length)}>
          <summary>Blockers ({checker.blockers.length})</summary>
          <CompactList items={checker.blockers} empty="No health checker blockers reported." />
        </details>
        <details>
          <summary>Warnings ({checker.warnings.length})</summary>
          <CompactList items={checker.warnings} empty="No health checker warnings reported." />
        </details>
      </div>
    </section>
  );
}

function PromptConflictCheckerDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const checker = getPromptConflictChecker(runtimeState);

  return (
    <section className="machine-panel prompt-conflict-panel">
      <div className="audit-head">
        <ShieldAlert size={17} />
        <span>Prompt Conflict Checker</span>
      </div>
      <div className="summary-grid checker-metrics">
        <Metric label="Reports" value={`${checker.reportCount}`} detail={checker.initialized ? "prompt plans checked" : "Not initialized"} />
        <Metric label="Conflicts" value={`${checker.conflictCount}`} detail="all severities" />
        <Metric label="Blocking" value={`${checker.blockingConflicts}`} detail="blocks envelope readiness" />
        <Metric label="Needs Recompile" value={`${checker.needsRecompile}`} detail="structured source drift" />
      </div>
      {!checker.initialized && (
        <p className="muted-copy generation-empty-state">Prompt Conflict Checker runtime field not initialized; showing defaults.</p>
      )}
      <div className="structured-source-strip">
        <span>Structured sources to update</span>
        <CompactList items={checker.structuredSourcesToUpdate.slice(0, 8)} empty="No structured source updates reported." />
        {checker.structuredSourcesToUpdate.length > 8 && (
          <small className="muted-copy">Showing 8 of {checker.structuredSourcesToUpdate.length} source update(s).</small>
        )}
      </div>
      <div className="pipeline-details checker-details">
        <details open={Boolean(checker.blockers.length)}>
          <summary>Blockers ({checker.blockers.length})</summary>
          <CompactList items={checker.blockers} empty="No conflict checker blockers reported." />
        </details>
        <details>
          <summary>Warnings ({checker.warnings.length})</summary>
          <CompactList items={checker.warnings} empty="No conflict checker warnings reported." />
        </details>
      </div>
    </section>
  );
}

function GenerationStageStrip({ stages }: { stages: GenerationHarnessStage[] }) {
  if (!stages.length) return <small className="muted-copy">No stage telemetry reported.</small>;

  return (
    <div className="generation-stage-strip" aria-label="Generation stage status">
      {stages.map((stage) => (
        <span key={stage.id} className={`generation-stage ${generationStageTone(stage.status)}`}>
          <strong>{stage.label}</strong>
          <small>{statusLabel(stage.status)}</small>
          {stage.detail && <em>{stage.detail}</em>}
        </span>
      ))}
    </div>
  );
}

function generationStageTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("blocked") || normalized.includes("fail") || normalized.includes("missing")) return "stage-danger";
  if (normalized.includes("ready") || normalized.includes("done") || normalized.includes("pass") || normalized.includes("formal")) return "stage-good";
  if (normalized.includes("waiting") || normalized.includes("pending") || normalized.includes("qa")) return "stage-pending";
  return "stage-neutral";
}

function CandidateOutputSummary({ output }: { output: GenerationHarnessCandidateOutput }) {
  const details = [
    output.manifestStatus ? `manifest ${output.manifestStatus}` : undefined,
    output.healthStatus ? `health ${output.healthStatus}` : undefined,
    output.qaStatus ? `qa ${output.qaStatus}` : undefined,
    output.canPromoteToFormal ? "formal promotion ready" : "formal promotion blocked",
  ].filter((item): item is string => Boolean(item));

  return (
    <div className="candidate-output-summary">
      <div>
        <span>Candidate output</span>
        <StatusPill value={output.status} />
      </div>
      <small>{details.join(" · ") || "No candidate output telemetry."}</small>
      {output.candidatePath && <small>candidate: {output.candidatePath}</small>}
      {output.formalPath && <small>formal: {output.formalPath}</small>}
      {!output.candidatePath && output.expectedOutputPath && <small>{output.expectedOutputPath}</small>}
    </div>
  );
}

function GenerationHarnessDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const harness = getGenerationHarness(runtimeState);
  const summary = harness.summary;
  const visibleJobs = harness.jobs.slice(0, 6);
  const providerLockLabel = harness.initialized
    ? summary.providerSubmissionForbidden ? "provider submission locked" : "provider submission open"
    : "provider lock not initialized";
  const dryRunLabel = harness.initialized
    ? summary.dryRunOnly ? "dry-run only" : "dry-run off"
    : "dry-run not initialized";
  const providerLockValue = !harness.initialized ? "not initialized" : summary.providerSubmissionForbidden || summary.dryRunOnly ? "locked" : "open";

  return (
    <section className="machine-panel generation-harness-panel">
      <div className="audit-head">
        <LockKeyhole size={17} />
        <span>Generation Harness</span>
      </div>
      <div className="summary-grid generation-harness-metrics">
        <Metric label="Total Jobs" value={`${summary.totalJobs}`} detail={`${summary.readyJobs} ready`} />
        <Metric label="Blocked" value={`${summary.blockedJobs}`} detail="blocking reasons active" />
        <Metric label="Waiting" value={`${summary.waitingForOutputJobs}`} detail="candidate output pending" />
        <Metric label="QA Pending" value={`${summary.qaPendingJobs}`} detail="requires QA decision" />
        <Metric label="Formal Ready" value={`${summary.formalReadyJobs}`} detail="promotable assets" />
        <Metric label="Provider Lock" value={providerLockValue} detail={`${providerLockLabel} · ${dryRunLabel}`} />
      </div>

      <div className="generation-lock-strip">
        <StatusPill value={providerLockLabel} />
        <StatusPill value={dryRunLabel} />
        <small>No live submit controls are exposed in Diagnostics.</small>
      </div>

      {!harness.initialized && (
        <p className="muted-copy generation-empty-state">Generation Harness not initialized in this runtime state.</p>
      )}

      <div className="generation-job-list">
        {visibleJobs.map((job) => (
          <div key={job.jobId} className="generation-job-row">
            <div className="generation-job-head">
              <div>
                <strong>{job.shotId}</strong>
                <small>{job.providerSlot} · {job.taskPlanId || job.jobId}</small>
              </div>
              <StatusPill value={job.chainStatus} />
            </div>
            <GenerationStageStrip stages={job.stages} />
            <CandidateOutputSummary output={job.candidateOutput} />
            <div className="generation-job-locks">
              <StatusPill value={job.providerSubmissionForbidden ? "provider locked" : "provider open"} />
              <StatusPill value={job.dryRunOnly ? "dry-run only" : "dry-run off"} />
              <StatusPill value={job.liveSubmitAllowed ? "live allowed" : "live false"} />
            </div>
            <div className="pipeline-details generation-job-details">
              <details open={Boolean(job.blockingReasons.length)}>
                <summary>Blocking reasons ({job.blockingReasons.length})</summary>
                <CompactList items={job.blockingReasons} empty="No blocking reasons reported." />
              </details>
              <details>
                <summary>Forbidden actions ({job.forbiddenActions.length})</summary>
                <CompactList
                  items={[
                    ...job.forbiddenActions,
                    ...(job.postprocessPolicy ? [`postprocess: ${job.postprocessPolicy}`] : []),
                  ]}
                  empty="No forbidden actions reported."
                />
              </details>
            </div>
          </div>
        ))}
        {harness.initialized && !visibleJobs.length && (
          <p className="muted-copy generation-empty-state">Generation Harness is initialized, but no jobs are currently queued.</p>
        )}
        {harness.jobs.length > visibleJobs.length && (
          <small className="muted-copy">Showing {visibleJobs.length} of {harness.jobs.length} generation jobs.</small>
        )}
      </div>
    </section>
  );
}

function watcherMetricValue(harness: FilesystemWatcherHarnessState, value?: number) {
  return harness.hasSummary && typeof value === "number" ? `${value}` : "Not initialized";
}

function watcherMetricDetail(harness: FilesystemWatcherHarnessState, detail: string) {
  return harness.hasSummary ? detail : "runtimeState.filesystemWatcherHarness.summary missing";
}

function watcherBooleanLabel(value: boolean | undefined, trueLabel: string, falseLabel: string) {
  if (typeof value !== "boolean") return "Not initialized";
  return value ? trueLabel : falseLabel;
}

function FilesystemWatcherDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const harness = getFilesystemWatcherHarness(runtimeState);
  const summary = harness.summary;
  const visibleStreams = harness.streams.slice(0, 8);
  const rootRows = harness.monitoredRoots.slice(0, 6);
  const lockRows = [
    {
      label: "Watcher cannot promote formal",
      value: watcherBooleanLabel(harness.locks.watcherCannotPromoteFormal, "locked", "not locked"),
    },
    {
      label: "Temp output draft only",
      value: watcherBooleanLabel(harness.locks.tempOutputDraftOnly, "draft only", "not locked"),
    },
    {
      label: "No semantic postprocess",
      value: watcherBooleanLabel(harness.locks.semanticPostprocessForbidden, "forbidden", "not locked"),
    },
    {
      label: "Provider submission",
      value: watcherBooleanLabel(harness.locks.providerSubmissionForbidden ?? summary.providerSubmissionForbidden, "forbidden", "not locked"),
    },
    {
      label: "Live submit",
      value: watcherBooleanLabel(harness.locks.liveSubmitAllowed ?? summary.liveSubmitAllowed, "allowed", "not allowed"),
    },
  ];

  return (
    <section className="machine-panel filesystem-watcher-panel">
      <div className="audit-head">
        <Database size={17} />
        <span>Filesystem Watcher Harness</span>
      </div>
      <div className="summary-grid filesystem-watcher-metrics">
        <Metric label="Events" value={watcherMetricValue(harness, summary.totalEvents)} detail={watcherMetricDetail(harness, `${summary.blockedEvents || 0} blocked`)} />
        <Metric label="Temp/Candidate" value={watcherMetricValue(harness, summary.tempCandidates)} detail={watcherMetricDetail(harness, `${summary.promotableArtifacts || 0} promotable`)} />
        <Metric label="Expected" value={watcherMetricValue(harness, summary.expectedOutputs)} detail={watcherMetricDetail(harness, "expected output paths")} />
        <Metric label="QA Reports" value={watcherMetricValue(harness, summary.qaReports)} detail={watcherMetricDetail(harness, "QA evidence files")} />
        <Metric label="Manifest Mismatch" value={watcherMetricValue(harness, summary.manifestMismatches)} detail={watcherMetricDetail(harness, "manifest gate failures")} />
        <Metric label="Draft Only" value={watcherMetricValue(harness, summary.draftOnlyArtifacts)} detail={watcherMetricDetail(harness, "cannot become formal automatically")} />
        <Metric label="Linked Harness" value={watcherMetricValue(harness, summary.linkedHarnessJobs)} detail={watcherMetricDetail(harness, `${summary.missingHarnessLinks || 0} missing link(s)`)} />
      </div>

      <div className="watcher-lock-strip">
        {lockRows.map((lock) => (
          <div key={lock.label}>
            <span>{lock.label}</span>
            <StatusPill value={lock.value} />
          </div>
        ))}
      </div>

      {!harness.initialized && (
        <p className="muted-copy generation-empty-state">Filesystem Watcher Harness not initialized in this runtime state.</p>
      )}

      <div className="watcher-diagnostics-grid">
        <div>
          <h3>Monitored Roots</h3>
          {!harness.hasMonitoredRoots && <p className="muted-copy">Not initialized</p>}
          {harness.hasMonitoredRoots && !rootRows.length && <p className="muted-copy">No monitored roots reported.</p>}
          {Boolean(rootRows.length) && (
            <div className="watcher-root-table">
              {rootRows.map((root) => (
                <div key={root.id} className="watcher-root-row">
                  <span>
                    <strong>{root.label}</strong>
                    <small>{root.id}</small>
                  </span>
                  <span>
                    <StatusPill value={root.status} />
                    <small>{root.kind}</small>
                  </span>
                  <small>{root.pathHint || "No path hint"}</small>
                  <small>{root.notes.join(" · ") || "No notes"}</small>
                </div>
              ))}
              {harness.monitoredRoots.length > rootRows.length && (
                <small className="muted-copy watcher-more">Showing {rootRows.length} of {harness.monitoredRoots.length} monitored roots.</small>
              )}
            </div>
          )}
        </div>

        <div>
          <h3>Watcher Streams</h3>
          {!harness.hasStreams && <p className="muted-copy">Not initialized</p>}
          {harness.hasStreams && !visibleStreams.length && <p className="muted-copy">No watcher events reported.</p>}
          {Boolean(visibleStreams.length) && (
            <div className="watcher-stream-table">
              {visibleStreams.map((stream) => {
                const shotTask = stream.shotId || stream.taskPlanId || stream.jobId || "unassigned";
                const harnessLink = stream.harnessJobId || stream.jobId || "missing";
                return (
                  <details key={stream.streamId} className="watcher-stream-row">
                    <summary>
                      <span>
                        <strong>{shotTask}</strong>
                        <small>{stream.eventType} · {stream.streamId}</small>
                      </span>
                      <span>{stream.artifactClass}</span>
                      <StatusPill value={stream.status} />
                      <StatusPill value={watcherBooleanLabel(stream.draftOnly, "draft only", "not draft only")} />
                      <StatusPill value={watcherBooleanLabel(stream.canPromoteFormal, "can promote", "cannot promote")} />
                      <span>
                        <strong>{harnessLink}</strong>
                        <small>{stream.harnessJobId ? "linked" : "missing link"}</small>
                      </span>
                    </summary>
                    <div className="watcher-stream-details">
                      <small>severity: {stream.severity}</small>
                      <small>artifact: {stream.artifactPath || "Not initialized"}</small>
                      <small>expected: {stream.expectedOutputPath || "Not initialized"}</small>
                      <small>future reference: {watcherBooleanLabel(stream.canBecomeFutureReference, "allowed", "blocked")}</small>
                      <small>requires manifest: {watcherBooleanLabel(stream.requiresManifestMatch, "yes", "no")}</small>
                      <small>requires QA: {watcherBooleanLabel(stream.requiresQaPass, "yes", "no")}</small>
                      <CompactList items={[...stream.blockingReasons, ...stream.notes]} empty="No blocking reasons or notes reported." />
                    </div>
                  </details>
                );
              })}
              {harness.streams.length > visibleStreams.length && (
                <small className="muted-copy watcher-more">Showing {visibleStreams.length} of {harness.streams.length} watcher stream event(s).</small>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function checkpointMetricValue(harness: CheckpointResumeHarnessState, value?: number) {
  return harness.hasSummary && typeof value === "number" ? `${value}` : "Not initialized";
}

function checkpointMetricDetail(harness: CheckpointResumeHarnessState, detail: string) {
  return harness.hasSummary ? detail : "runtimeState.checkpointResumeHarness.summary missing";
}

function CheckpointResumeDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const harness = getCheckpointResumeHarness(runtimeState);
  const summary = harness.summary;
  const visibleItems = harness.resumeItems.slice(0, 8);
  const lockRows = [
    {
      label: "dry-run only",
      value: watcherBooleanLabel(harness.hardLocks.dryRunOnly, "locked", "not locked"),
    },
    {
      label: "no file mutation",
      value: watcherBooleanLabel(harness.hardLocks.noFileMutation, "locked", "not locked"),
    },
    {
      label: "no auto skip without QA",
      value: watcherBooleanLabel(harness.hardLocks.noAutoSkipWithoutQa, "locked", "not locked"),
    },
    {
      label: "worker self-report cannot complete",
      value: watcherBooleanLabel(harness.hardLocks.workerSelfReportCannotComplete, "locked", "not locked"),
    },
    {
      label: "temp candidate cannot resume as formal",
      value: watcherBooleanLabel(harness.hardLocks.tempCandidateCannotResumeAsFormal, "locked", "not locked"),
    },
  ];

  return (
    <section className="machine-panel checkpoint-resume-panel">
      <div className="audit-head">
        <ListChecks size={17} />
        <span>Checkpoint Resume Harness</span>
      </div>
      <div className="summary-grid checkpoint-resume-metrics">
        <Metric label="Items" value={checkpointMetricValue(harness, summary.totalItems)} detail={checkpointMetricDetail(harness, "resume candidates")} />
        <Metric label="Skip allowed" value={checkpointMetricValue(harness, summary.skipAllowed)} detail={checkpointMetricDetail(harness, "safe to skip after QA")} />
        <Metric label="Rerun allowed" value={checkpointMetricValue(harness, summary.rerunAllowed)} detail={checkpointMetricDetail(harness, "eligible for rerun")} />
        <Metric label="Manual review" value={checkpointMetricValue(harness, summary.manualReviewRequired)} detail={checkpointMetricDetail(harness, "human decision required")} />
        <Metric label="Blocked" value={checkpointMetricValue(harness, summary.blocked)} detail={checkpointMetricDetail(harness, "cannot resume automatically")} />
        <Metric label="Missing output" value={checkpointMetricValue(harness, summary.missingExpectedOutput)} detail={checkpointMetricDetail(harness, "expected path absent")} />
        <Metric label="Formal ready" value={checkpointMetricValue(harness, summary.formalReady)} detail={checkpointMetricDetail(harness, "formal assets present")} />
      </div>

      <div className="watcher-lock-strip checkpoint-lock-strip">
        {lockRows.map((lock) => (
          <div key={lock.label}>
            <span>{lock.label}</span>
            <StatusPill value={lock.value} />
          </div>
        ))}
      </div>

      {!harness.initialized && (
        <p className="muted-copy generation-empty-state">Checkpoint Resume Harness not initialized in this runtime state.</p>
      )}

      <div className="checkpoint-resume-table">
        {!harness.hasResumeItems && <p className="muted-copy">Not initialized</p>}
        {harness.hasResumeItems && !visibleItems.length && <p className="muted-copy">No resume items reported.</p>}
        {visibleItems.map((item, index) => {
          const shotTask = item.shotId || item.taskPlanId || item.jobId || "Not initialized";
          const harnessLink = item.generationHarnessJobId || "Not initialized";
          return (
            <details key={`${item.resumeItemId}-${index}`} className="checkpoint-resume-row">
              <summary>
                <span>
                  <strong>{shotTask}</strong>
                  <small>{item.taskPlanId || item.resumeItemId}</small>
                </span>
                <StatusPill value={item.resumeStatus || "Not initialized"} />
                <StatusPill value={item.resumeDecision || "Not initialized"} />
                <span className="checkpoint-flag-group">
                  <StatusPill value={watcherBooleanLabel(item.skipAllowed, "skip allowed", "skip blocked")} />
                  <StatusPill value={watcherBooleanLabel(item.rerunAllowed, "rerun allowed", "rerun blocked")} />
                  <StatusPill value={watcherBooleanLabel(item.manualReviewRequired, "manual review", "review not required")} />
                </span>
                <span className="checkpoint-gate-group">
                  <small>manifest: {item.manifestStatus || "Not initialized"}</small>
                  <small>health: {item.healthStatus || "Not initialized"}</small>
                  <small>QA: {item.qaStatus || "Not initialized"}</small>
                </span>
                <span>
                  <strong>{harnessLink}</strong>
                  <small>{item.generationHarnessJobId ? "harness link" : "missing harness link"}</small>
                </span>
              </summary>
              <div className="checkpoint-resume-details">
                <small>watcher streams: {item.hasWatcherStreamIds ? item.watcherStreamIds.join(", ") || "None reported" : "Not initialized"}</small>
                <small>expected: {item.expectedOutputPath || "Not initialized"}</small>
                <small>candidate: {item.candidatePath || "Not initialized"}</small>
                <small>formal: {item.formalPath || "Not initialized"}</small>
                <small>blocking reasons: {item.hasBlockingReasons ? `${item.blockingReasons.length}` : "Not initialized"}</small>
                <CompactList items={[...item.blockingReasons, ...item.notes]} empty="No blocking reasons or notes reported." />
              </div>
            </details>
          );
        })}
        {harness.resumeItems.length > visibleItems.length && (
          <small className="muted-copy watcher-more">Showing {visibleItems.length} of {harness.resumeItems.length} resume item(s).</small>
        )}
      </div>
    </section>
  );
}

function qaMetricValue(harness: QaHarnessState, value?: number) {
  return harness.initialized && typeof value === "number" ? `${value}` : "Not initialized";
}

function qaMetricDetail(harness: QaHarnessState, detail: string) {
  return harness.initialized ? detail : "runtimeState.qaHarness missing";
}

function qaLockLabel(value: boolean | undefined, inverse = false) {
  if (typeof value !== "boolean") return "Not initialized";
  const locked = inverse ? !value : value;
  return locked ? "locked" : "not locked";
}

function qaBooleanLabel(value: boolean | undefined, trueLabel: string, falseLabel: string) {
  if (typeof value !== "boolean") return "Not initialized";
  return value ? trueLabel : falseLabel;
}

function qaGateCompact(gate: QaGateRow) {
  const details = [
    gate.severity !== "unknown" ? `severity: ${gate.severity}` : "",
    `${gate.blockers.length} blockers`,
    `${gate.warnings.length} warnings`,
    gate.sourceRefs.length ? `refs: ${gate.sourceRefs.join(", ")}` : "",
    gate.notes.length ? `notes: ${gate.notes.join(" · ")}` : "",
  ].filter(Boolean);
  return `${gate.label}: ${gate.status}${details.length ? ` · ${details.join(" · ")}` : ""}`;
}

function QaHarnessDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const harness = getQaHarness(runtimeState);
  const summary = harness.summary;
  const visibleItems = harness.items.slice(0, 8);
  const hardLockRows = [
    {
      label: "overallFirst",
      value: qaLockLabel(harness.hardLocks.overallFirst),
      primary: true,
    },
    {
      label: "noAutoPromotion",
      value: qaLockLabel(harness.hardLocks.noAutoPromotion),
      primary: true,
    },
    {
      label: "semanticRepairForbidden",
      value: qaLockLabel(harness.hardLocks.semanticRepairForbidden),
      primary: true,
    },
    {
      label: "workerSelfReportCannotPassQa",
      value: qaLockLabel(harness.hardLocks.workerSelfReportCannotPassQa),
      primary: true,
    },
    {
      label: "dryRunOnly",
      value: qaLockLabel(harness.hardLocks.dryRunOnly ?? summary.dryRunOnly),
    },
    {
      label: "providerSubmissionForbidden",
      value: qaLockLabel(harness.hardLocks.providerSubmissionForbidden),
    },
    {
      label: "liveSubmitAllowed",
      value: qaLockLabel(harness.hardLocks.liveSubmitAllowed ?? summary.liveSubmitAllowed, true),
    },
    {
      label: "noFileMutation",
      value: qaLockLabel(harness.hardLocks.noFileMutation ?? summary.noFileMutation),
    },
  ];

  return (
    <section className="machine-panel qa-harness-panel">
      <div className="audit-head">
        <ShieldAlert size={17} />
        <span>QA Harness</span>
      </div>
      <div className="qa-harness-meta">
        <small>schema: {harness.schemaVersion}</small>
        <small>generated: {harness.generatedAt}</small>
        <small>{harness.dimensions.length} fixed dimensions</small>
      </div>
      <div className="summary-grid qa-harness-metrics">
        <Metric label="Items" value={qaMetricValue(harness, summary.totalItems)} detail={qaMetricDetail(harness, "QA item count")} />
        <Metric label="Formal eligible" value={qaMetricValue(harness, summary.formalEligible)} detail={qaMetricDetail(harness, "eligible after QA")} />
        <Metric label="Human review" value={qaMetricValue(harness, summary.requiresHumanReview)} detail={qaMetricDetail(harness, "requires human decision")} />
        <Metric label="Blocked" value={qaMetricValue(harness, summary.blocked)} detail={qaMetricDetail(harness, "cannot pass current gate")} />
        <Metric label="Unknown" value={qaMetricValue(harness, summary.unknown)} detail={qaMetricDetail(harness, "missing facts or context")} />
        <Metric label="Failed" value={qaMetricValue(harness, summary.failed)} detail={qaMetricDetail(harness, "failed QA checks")} />
        <Metric label="Partial" value={qaMetricValue(harness, summary.partial)} detail={qaMetricDetail(harness, "partial evidence")} />
      </div>

      <div className="watcher-lock-strip qa-lock-strip">
        {hardLockRows.map((lock) => (
          <div key={lock.label} className={lock.primary ? "qa-lock-primary" : undefined}>
            <span>{lock.label}</span>
            <StatusPill value={lock.value} />
          </div>
        ))}
      </div>

      {!harness.initialized && (
        <p className="muted-copy generation-empty-state">QA Harness not initialized in this runtime state.</p>
      )}

      {harness.initialized && (
        <div className="qa-harness-sections">
          <div className="qa-section-head">
            <h3>Overall gates</h3>
            <small>{qaHarnessDimensions.map(qaDimensionLabel).join(" · ")}</small>
          </div>
          {!harness.hasOverall && <p className="muted-copy">Not initialized</p>}
          {harness.hasOverall && (
            <div className="qa-overall-table">
              {harness.overall.map((gate) => (
                <details key={gate.dimension} className="qa-overall-row" open={gate.blockers.length > 0}>
                  <summary>
                    <span>
                      <strong>{gate.label}</strong>
                      <small>{gate.dimension}</small>
                    </span>
                    <StatusPill value={gate.status} />
                    <span>{gate.severity}</span>
                    <small>{gate.blockers.length} blockers · {gate.warnings.length} warnings · {gate.sourceRefs.length} refs</small>
                  </summary>
                  <div className="qa-gate-details">
                    <CompactList items={gate.blockers} empty="No blockers reported." />
                    <CompactList items={gate.warnings} empty="No warnings reported." />
                    <CompactList items={[...gate.sourceRefs.map((ref) => `source: ${ref}`), ...gate.notes]} empty="No source refs or notes reported." />
                  </div>
                </details>
              ))}
            </div>
          )}

          <div className="qa-section-head">
            <h3>Item details</h3>
            <small>showing first {visibleItems.length} of {harness.items.length}</small>
          </div>
          {!harness.hasItems && <p className="muted-copy">Not initialized</p>}
          {harness.hasItems && !visibleItems.length && <p className="muted-copy">No QA items reported.</p>}
          {Boolean(visibleItems.length) && (
            <div className="qa-item-table">
              {visibleItems.map((item, index) => {
                const jobLink = item.harnessJobId || item.jobId || item.checkpointResumeItemId || "Not initialized";
                return (
                  <details key={`${item.qaItemId}-${index}`} className="qa-item-row" open={item.blockers.length > 0}>
                    <summary>
                      <span>
                        <strong>{item.shotId}</strong>
                        <small>{item.qaItemId}</small>
                      </span>
                      <StatusPill value={item.overallStatus} />
                      <StatusPill value={qaBooleanLabel(item.formalPromotionEligible, "formal eligible", "formal blocked")} />
                      <StatusPill value={qaBooleanLabel(item.requiresHumanReview, "human review", "review clear")} />
                      <span>
                        <strong>{jobLink}</strong>
                        <small>{item.harnessJobId ? "harness job" : "job/checkpoint link"}</small>
                      </span>
                      <small>{item.blockers.length} blockers · {item.warnings.length} warnings · {item.sourceCoverage.length} coverage rows</small>
                    </summary>
                    <div className="qa-item-details">
                      <small>task: {item.taskPlanId || "Not initialized"}</small>
                      <small>job: {item.jobId || "Not initialized"}</small>
                      <small>harness: {item.harnessJobId || "Not initialized"}</small>
                      <small>checkpoint: {item.checkpointResumeItemId || "Not initialized"}</small>
                      <div className="pipeline-details qa-item-detail-sections">
                        <details>
                          <summary>sourceCoverage ({item.sourceCoverage.length})</summary>
                          <CompactList items={item.sourceCoverage} empty="No source coverage reported." />
                        </details>
                        <details open={item.blockers.length > 0}>
                          <summary>Blockers ({item.blockers.length})</summary>
                          <CompactList items={item.blockers} empty="No blockers reported." />
                        </details>
                        <details open={item.warnings.length > 0}>
                          <summary>Warnings ({item.warnings.length})</summary>
                          <CompactList items={item.warnings} empty="No warnings reported." />
                        </details>
                        <details>
                          <summary>Dimension gates ({item.dimensionGates.length})</summary>
                          <CompactList items={item.dimensionGates.map(qaGateCompact)} empty="No dimension gates reported." />
                        </details>
                        <details>
                          <summary>Notes ({item.notes.length})</summary>
                          <CompactList items={item.notes} empty="No item notes reported." />
                        </details>
                      </div>
                    </div>
                  </details>
                );
              })}
              {harness.items.length > visibleItems.length && (
                <small className="muted-copy watcher-more">Showing {visibleItems.length} of {harness.items.length} QA item(s).</small>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function toolRuntimeMetricValue(harness: ToolRuntimeHarnessState, value?: number) {
  return harness.initialized && typeof value === "number" ? `${value}` : "Not initialized";
}

function toolRuntimeMetricDetail(harness: ToolRuntimeHarnessState, detail: string) {
  return harness.initialized ? detail : "runtimeState.toolRuntimeHarness missing";
}

function toolRuntimeLockLabel(value: boolean | undefined) {
  if (typeof value !== "boolean") return "Not initialized";
  return value ? "locked" : "not locked";
}

function toolRuntimeRequiredLabel(value: boolean | undefined) {
  if (typeof value !== "boolean") return "Not initialized";
  return value ? "required" : "not required";
}

function toolRuntimeBooleanLabel(value: boolean | undefined, trueLabel: string, falseLabel: string) {
  if (typeof value !== "boolean") return "Not initialized";
  return value ? trueLabel : falseLabel;
}

function ToolRuntimeHarnessDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const harness = getToolRuntimeHarness(runtimeState);
  const summary = harness.summary;
  const visibleChecks = harness.checks.slice(0, 8);
  const optionalMissing = typeof summary.optionalMissing === "number" ? summary.optionalMissing : 0;
  const lockRows = [
    { label: "noInstall", value: toolRuntimeLockLabel(harness.hardLocks.noInstall) },
    { label: "noCredentialRead", value: toolRuntimeLockLabel(harness.hardLocks.noCredentialRead) },
    { label: "arbitraryShellExecutionBlocked", value: toolRuntimeLockLabel(harness.hardLocks.arbitraryShellExecutionBlocked) },
    { label: "sidecarDaemonDisabled", value: toolRuntimeLockLabel(harness.hardLocks.sidecarDaemonDisabled) },
    { label: "providerSubmissionForbidden", value: toolRuntimeLockLabel(harness.hardLocks.providerSubmissionForbidden) },
    { label: "platformPathAbstractionRequired", value: toolRuntimeRequiredLabel(harness.hardLocks.platformPathAbstractionRequired) },
  ];
  const pathPolicyRows = [
    {
      label: "mac posix",
      value: harness.pathPolicy.macPathStyle,
      detail: toolRuntimeRequiredLabel(harness.pathPolicy.platformPathAbstractionRequired),
    },
    {
      label: "win32",
      value: harness.pathPolicy.windowsPathStyle,
      detail: `${harness.pathPolicy.allowedRoots.length} allowed root(s)`,
    },
    {
      label: "project-relative",
      value: toolRuntimeRequiredLabel(harness.pathPolicy.projectRootRelativeRequired),
      detail: "project root policy",
    },
    {
      label: "allowed roots",
      value: harness.pathPolicy.allowedRoots.join(", ") || "Not initialized",
      detail: `${harness.pathPolicy.blockers.length} blockers / ${harness.pathPolicy.warnings.length} warnings`,
    },
  ];

  return (
    <section className="machine-panel tool-runtime-panel">
      <div className="audit-head">
        <Wrench size={17} />
        <span>Tool Runtime Harness</span>
      </div>
      <div className="qa-harness-meta">
        <small>schema: {harness.schemaVersion}</small>
        <small>generated: {harness.generatedAt}</small>
        <small>{harness.hasSummary ? "summary reported" : "summary Not initialized"}</small>
        <small>{harness.hasHardLocks ? "hard locks reported" : "hard locks Not initialized"}</small>
      </div>

      <div className="summary-grid tool-runtime-metrics">
        <Metric label="Checks" value={toolRuntimeMetricValue(harness, summary.totalChecks)} detail={toolRuntimeMetricDetail(harness, "tool readiness checks")} />
        <Metric label="Ready" value={toolRuntimeMetricValue(harness, summary.ready)} detail={toolRuntimeMetricDetail(harness, "diagnostic ready")} />
        <Metric label="Missing" value={toolRuntimeMetricValue(harness, summary.missing)} detail={toolRuntimeMetricDetail(harness, "required + optional")} />
        <Metric label="Planned" value={toolRuntimeMetricValue(harness, summary.planned)} detail={toolRuntimeMetricDetail(harness, "planned slots")} />
        <Metric label="Blocked" value={toolRuntimeMetricValue(harness, summary.blocked)} detail={toolRuntimeMetricDetail(harness, "cannot execute now")} />
        <Metric label="Unknown" value={toolRuntimeMetricValue(harness, summary.unknown)} detail={toolRuntimeMetricDetail(harness, "missing facts")} />
        <Metric label="Required missing" value={toolRuntimeMetricValue(harness, summary.requiredMissing)} detail={toolRuntimeMetricDetail(harness, `${optionalMissing} optional missing`)} />
      </div>

      <div className="watcher-lock-strip tool-runtime-lock-strip">
        {lockRows.map((lock) => (
          <div key={lock.label}>
            <span>{lock.label}</span>
            <StatusPill value={lock.value} />
          </div>
        ))}
      </div>

      {!harness.initialized && (
        <p className="muted-copy generation-empty-state">Tool Runtime Harness not initialized in this runtime state.</p>
      )}

      {harness.initialized && (
        <div className="tool-runtime-sections">
          <div>
            <div className="qa-section-head">
              <h3>Path policy</h3>
              <small>{harness.hasPathPolicy ? "platform path abstraction" : "Not initialized"}</small>
            </div>
            {!harness.hasPathPolicy && <p className="muted-copy">Not initialized</p>}
            {harness.hasPathPolicy && (
              <>
                <div className="tool-runtime-policy-grid">
                  {pathPolicyRows.map((row) => (
                    <div key={row.label}>
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                      <small>{row.detail}</small>
                    </div>
                  ))}
                </div>
                <div className="pipeline-details tool-runtime-policy-details">
                  <details open={harness.pathPolicy.blockers.length > 0}>
                    <summary>Policy blockers ({harness.pathPolicy.blockers.length})</summary>
                    <CompactList items={harness.pathPolicy.blockers} empty="No path policy blockers reported." />
                  </details>
                  <details open={harness.pathPolicy.warnings.length > 0}>
                    <summary>Policy warnings ({harness.pathPolicy.warnings.length})</summary>
                    <CompactList items={harness.pathPolicy.warnings} empty="No path policy warnings reported." />
                  </details>
                  <details>
                    <summary>Policy notes ({harness.pathPolicy.notes.length})</summary>
                    <CompactList items={harness.pathPolicy.notes} empty="No path policy notes reported." />
                  </details>
                </div>
              </>
            )}
          </div>

          <div>
            <div className="qa-section-head">
              <h3>Tool checks</h3>
              <small>showing first {visibleChecks.length} of {harness.checks.length}</small>
            </div>
            {!harness.hasChecks && <p className="muted-copy">Not initialized</p>}
            {harness.hasChecks && !visibleChecks.length && <p className="muted-copy">No tool runtime checks reported.</p>}
            {Boolean(visibleChecks.length) && (
              <div className="tool-runtime-check-table">
                {visibleChecks.map((check, index) => {
                  const requiredFor = check.requiredFor.join(", ") || "Not initialized";
                  const platformSupport = check.platformSupport.join(", ") || "Not initialized";
                  return (
                    <details key={`${check.checkId}-${index}`} className="tool-runtime-row" open={check.blockers.length > 0}>
                      <summary>
                        <span>
                          <strong>{check.label}</strong>
                          <small>{check.checkId}</small>
                          <small>{check.category}</small>
                        </span>
                        <StatusPill value={check.status} />
                        <StatusPill value={check.pathStatus} />
                        <span>
                          <strong>{check.path || "No path"}</strong>
                          <small>{check.version ? `version ${check.version}` : "version Not initialized"}</small>
                        </span>
                        <span>
                          <strong>{requiredFor}</strong>
                          <small>{platformSupport}</small>
                        </span>
                        <small>
                          {toolRuntimeBooleanLabel(check.canExecuteNow, "canExecute true", "canExecute false")} / {check.executionMode}
                        </small>
                      </summary>
                      <div className="tool-runtime-check-details">
                        <small>category: {check.category}</small>
                        <small>requiredFor: {requiredFor}</small>
                        <small>platformSupport: {platformSupport}</small>
                        <small>missingIsBlocker: {toolRuntimeBooleanLabel(check.missingIsBlocker, "true", "false")}</small>
                        <div className="pipeline-details tool-runtime-detail-sections">
                          <details open={check.blockers.length > 0}>
                            <summary>Blockers ({check.blockers.length})</summary>
                            <CompactList items={check.blockers} empty="No blockers reported." />
                          </details>
                          <details open={check.warnings.length > 0}>
                            <summary>Warnings ({check.warnings.length})</summary>
                            <CompactList items={check.warnings} empty="No warnings reported." />
                          </details>
                          <details>
                            <summary>Source refs ({check.sourceRefs.length})</summary>
                            <CompactList items={check.sourceRefs} empty="No source refs reported." />
                          </details>
                          <details>
                            <summary>Notes ({check.notes.length})</summary>
                            <CompactList items={check.notes} empty="No notes reported." />
                          </details>
                        </div>
                      </div>
                    </details>
                  );
                })}
                {harness.checks.length > visibleChecks.length && (
                  <small className="muted-copy watcher-more">Showing {visibleChecks.length} of {harness.checks.length} tool runtime check(s).</small>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function AudioDiagnosticsPanel({ audioPlanning }: { audioPlanning: AudioPlanningState }) {
  const plannedSlots = audioPlanning.providerSlots.filter((slot) => slot.state === "planned").length;
  const liveSlots = audioPlanning.providerSlots.filter((slot) => slot.liveSubmitAllowed).length;
  const registry = audioPlanning.voiceSourceRegistry;
  const exportSummary = audioPlanning.exportPackageSummary;

  return (
    <section className="machine-panel audio-diagnostics-panel">
      <div className="audit-head">
        <Radio size={17} />
        <span>Audio Planning</span>
      </div>
      <div className="summary-grid">
        <Metric label="Shot Plans" value={`${audioPlanning.shotPlans.length}`} detail="AudioPlan contracts" />
        <Metric label="Preview Mix" value={`${audioPlanning.previewMix.eventCount}`} detail="placeholder event(s)" />
        <Metric label="Missing Output" value={`${audioPlanning.previewMix.missingOutputPathCount}`} detail="planned audio paths" />
        <Metric label="Provider Slots" value={`${plannedSlots}/${audioPlanning.providerSlots.length}`} detail={`${liveSlots} live · submit forbidden`} />
      </div>
      <div className="audio-diagnostics-grid">
        <div>
          <h3>Voice Source Registry</h3>
          <div className="field-grid compact">
            <label>Sources</label>
            <span>{registry.sourceCount}</span>
            <label>Secrets</label>
            <span>{registry.storesSecrets ? "stored" : "not stored"}</span>
            <label>Planned</label>
            <span>{registry.plannedCount}</span>
            <label>Live</label>
            <span>{registry.liveSubmitAllowed ? "allowed" : "false"}</span>
          </div>
          <CompactList
            items={registry.sources.map((source) => `${source.label} · ${source.status} · ${statusLabel(source.kind)}`)}
            empty="No voice sources registered."
          />
        </div>
        <div>
          <h3>Audio Provider Slots</h3>
          <CompactList
            items={audioPlanning.providerSlots.map((slot) => `${slot.slot} · ${slot.state} · live ${slot.liveSubmitAllowed ? "allowed" : "false"}`)}
            empty="No audio provider slots planned."
          />
        </div>
        <div>
          <h3>Export Package Summary</h3>
          <div className="field-grid compact">
            <label>Status</label>
            <span>{exportSummary.status}</span>
            <label>Profiles</label>
            <span>{exportSummary.includedInExportProfiles.map(statusLabel).join(", ")}</span>
            <label>Dry Run</label>
            <span>{exportSummary.dryRunOnly ? "true" : "false"}</span>
            <label>Provider</label>
            <span>{exportSummary.providerSubmissionForbidden ? "forbidden" : "allowed"}</span>
          </div>
          <CompactList
            items={[
              ...exportSummary.plannedCategories.map((item) => `category: ${item}`),
              ...exportSummary.blockedReasons.map((item) => `blocked: ${item}`),
            ]}
            empty="No export package notes."
          />
        </div>
      </div>
    </section>
  );
}

function VoiceAudioSettingsDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildVoiceAudioSettingsUiSummary(runtimeState);

  return (
    <section className="machine-panel phase28-voice-audio-panel">
      <div className="audit-head">
        <Radio size={17} />
        <span>Phase 28 Voice/Audio Settings</span>
      </div>
      <div className="summary-grid phase28-metrics">
        <Metric label="Readiness" value={summary.readiness} detail={summary.initialized ? "settings summary" : "blocked/missing"} />
        <Metric label="Voice Sources" value={`${summary.voiceSourceCount}`} detail={summary.voiceSourceDetail} />
        <Metric label="Audio Plans" value={`${summary.audioPlanCount}`} detail={summary.audioPlanDetail} />
        <Metric label="No BGM Policy" value={summary.noBgmPolicy ? "on" : "off"} detail={summary.noBgmDetail} />
        <Metric label="Provider Slots" value={`${summary.providerSlotsPlanned}/${summary.providerSlotsTotal}`} detail={`${summary.providerSlotsLive} live`} />
      </div>
      <div className="phase28-summary-list">
        <div>
          <strong>Blockers / warnings</strong>
          <small>{summary.blockersWarnings.length ? summary.blockersWarnings.slice(0, 4).join(" · ") : "none reported"}</small>
        </div>
        <div>
          <strong>Provider slots planned/live</strong>
          <small>{summary.providerSlotsPlanned} planned · {summary.providerSlotsLive} live · {summary.providerSlotsTotal} total</small>
        </div>
      </div>
      <div className="phase28-lock-strip" aria-label="Phase 28 Voice/Audio Settings hard locks">
        {summary.hardLocks.slice(0, 8).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}

function ProviderEnablementGateDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildProviderEnablementGateUiSummary(runtimeState);

  return (
    <section className="machine-panel phase30-provider-gate-panel">
      <div className="audit-head">
        <ShieldAlert size={17} />
        <span>Provider Enablement Gate</span>
      </div>
      <div className="summary-grid phase30-metrics">
        <Metric label="Readiness" value={summary.readiness} detail={summary.initialized ? "read-only status" : "blocked/missing"} />
        <Metric label="Ready" value={`${summary.readyForConfirmation}`} detail="ready_for_confirmation" />
        <Metric label="Blocked" value={`${summary.blocked}`} detail={`${summary.parked} parked`} />
        <Metric label="Token" value={summary.confirmationTokenStatus} detail="confirmation placeholder" />
        <Metric label="Packet" value={summary.packetCompleteStatus} detail="enablement packet" />
        <Metric label="Closed Loop" value={summary.closedLoopStatus} detail="watcher / manifest / QA" />
      </div>
      <div className="phase30-summary-list">
        <div>
          <strong>Forbidden paths absent</strong>
          <small>{summary.forbiddenPathsAbsent}</small>
        </div>
        <div>
          <strong>Provider submit</strong>
          <small>{summary.canSubmitProvider} · {summary.submitBlocked}</small>
        </div>
        <div>
          <strong>Credential / live submit / shell</strong>
          <small>{summary.credentialLiveShellLocked}</small>
        </div>
        <div>
          <strong>Blockers / warnings</strong>
          <small>{summary.blockersWarnings.length ? summary.blockersWarnings.slice(0, 5).join(" · ") : "none reported"}</small>
        </div>
      </div>
      <div className="phase30-lock-strip" aria-label="Phase 30 Provider Enablement Gate hard locks">
        {summary.hardLocks.slice(0, 10).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}

function ProviderExecutionPermissionGateDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildProviderExecutionPermissionGateUiSummary(runtimeState);

  return (
    <section className="machine-panel phase31-provider-permission-panel">
      <div className="audit-head">
        <ShieldAlert size={17} />
        <span>Provider Execution Permission Gate</span>
      </div>
      <div className="summary-grid phase31-metrics">
        <Metric label="Readiness" value={summary.readiness} detail={summary.initialized ? "confirmation shell" : "blocked/missing"} />
        <Metric label="Reviewable" value={`${summary.readyForUserReview}`} detail={`${summary.canAskUserToConfirm} can ask`} />
        <Metric label="Blocked" value={`${summary.blocked}`} detail={`${summary.parked} parked`} />
        <Metric label="Action Confirm" value={summary.actionTimeConfirmation} detail="not prefilled" />
        <Metric label="Auto Submit" value={summary.automaticSubmit} detail="manual gate only" />
        <Metric label="Provider Submit" value={summary.providerSubmit} detail="0 allowed" />
      </div>
      <div className="phase31-summary-list">
        <div>
          <strong>Credential / worker / file</strong>
          <small>{summary.credentialWorkerFileLocks}</small>
        </div>
        <div>
          <strong>Blockers / warnings</strong>
          <small>{summary.blockersWarnings.length ? summary.blockersWarnings.slice(0, 5).join(" · ") : "none reported"}</small>
        </div>
      </div>
      <div className="phase31-lock-strip" aria-label="Phase 31 Provider Execution Permission Gate hard locks">
        {summary.hardLocks.slice(0, 10).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}

function ProviderActionConfirmationReceiptDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildProviderActionConfirmationReceiptUiSummary(runtimeState);

  return (
    <section className="machine-panel phase32-provider-action-receipt-panel">
      <div className="audit-head">
        <ShieldAlert size={17} />
        <span>Provider Action Confirmation Receipt</span>
      </div>
      <div className="summary-grid phase32-metrics">
        <Metric label="Readiness" value={summary.readiness} detail={summary.initialized ? "Phase 32 receipt shell" : "blocked/missing"} />
        <Metric label="Ready Receipts" value={`${summary.readyReceipts}`} detail={`${summary.parked} parked`} />
        <Metric label="Blocked" value={`${summary.blocked}`} detail="receipt blockers" />
        <Metric label="Confirmed Count" value={`${summary.confirmedCount}`} detail="action-time confirmations" />
        <Metric label="Provider Submit" value={summary.providerSubmitBlocked} detail="read-only" />
        <Metric label="Credential / Worker / File" value={summary.credentialWorkerFileLocked} detail="locked route summary" />
      </div>
      <div className="phase32-summary-list">
        <div>
          <strong>Receipt status</strong>
          <small>{summary.readyReceipts} ready receipt(s) · {summary.blocked} blocked · {summary.parked} parked · {summary.confirmedCount} confirmed</small>
        </div>
        <div>
          <strong>Provider submit blocked</strong>
          <small>{summary.providerSubmitBlocked}</small>
        </div>
        <div>
          <strong>Credential / worker / file locked</strong>
          <small>{summary.credentialWorkerFileLocked}</small>
        </div>
        <div>
          <strong>Blockers / warnings</strong>
          <small>{summary.blockersWarnings.length ? summary.blockersWarnings.slice(0, 5).join(" · ") : "none reported"}</small>
        </div>
      </div>
      <div className="phase32-lock-strip" aria-label="Phase 32 Provider Action Confirmation Receipt hard locks">
        {summary.hardLocks.slice(0, 10).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}

function ProviderExecutionHandoffDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildProviderExecutionHandoffUiSummary(runtimeState);

  return (
    <section className="machine-panel phase33-provider-execution-handoff-panel">
      <div className="audit-head">
        <ShieldAlert size={17} />
        <span>Provider Execution Handoff</span>
      </div>
      <div className="summary-grid phase33-metrics">
        <Metric label="Readiness" value={summary.readiness} detail={summary.initialized ? "Phase 33 final action gate" : "blocked/missing"} />
        <Metric label="Handoff Count" value={`${summary.handoffCount}`} detail="handoff rows" />
        <Metric label="Blocked Count" value={`${summary.blockedCount}`} detail="handoff blockers" />
        <Metric label="Confirmed Count" value={`${summary.confirmedCount}`} detail="receipt-backed only" />
        <Metric label="Provider Submit" value={summary.providerSubmitLocked} detail="no live action" />
        <Metric label="Credential / Worker / File" value={summary.credentialWorkerFileLocked} detail="locked route summary" />
      </div>
      <div className="phase33-summary-list">
        <div>
          <strong>Final action gate</strong>
          <small>{summary.handoffCount} handoff(s) · {summary.blockedCount} blocked · {summary.confirmedCount} confirmed</small>
        </div>
        <div>
          <strong>Provider submit locked</strong>
          <small>{summary.providerSubmitLocked}</small>
        </div>
        <div>
          <strong>Credential / worker / file locked</strong>
          <small>{summary.credentialWorkerFileLocked}</small>
        </div>
        <div>
          <strong>Blockers / warnings</strong>
          <small>{summary.blockersWarnings.length ? summary.blockersWarnings.slice(0, 5).join(" · ") : "none reported"}</small>
        </div>
      </div>
      <div className="phase33-lock-strip" aria-label="Phase 33 Provider Execution Handoff hard locks">
        {summary.hardLocks.slice(0, 10).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}

function LocalOrchestratorDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildLocalOrchestratorUiSummary(runtimeState);

  return (
    <section className="machine-panel phase34-local-orchestrator-panel">
      <div className="audit-head">
        <Gauge size={17} />
        <span>Local Orchestrator / Auto-continue</span>
      </div>
      <div className="summary-grid phase34-metrics">
        <Metric label="Readiness" value={summary.readiness} detail={summary.initialized ? "read-only queue state" : "blocked/missing"} />
        <Metric label="Queue Total" value={`${summary.queueTotal}`} detail="planned items" />
        <Metric label="Ready" value={`${summary.ready}`} detail={`${summary.nextReadyCount} next-ready`} />
        <Metric label="Waiting" value={`${summary.waiting}`} detail="held by earlier facts" />
        <Metric label="Running / Output" value={`${summary.runningPlanned} / ${summary.waitingOutput}`} detail="planned / waiting output" />
        <Metric label="QA Pending" value={`${summary.qaPending}`} detail={`${summary.needsReview} needs review`} />
        <Metric label="Stalled" value={`${summary.stalled}`} detail="timeout/watch evidence" />
        <Metric label="Auto-continue" value={`${summary.nextReadyCount}`} detail={summary.autoContinueMode} />
      </div>
      <div className="phase34-summary-list">
        <div>
          <strong>Queue state</strong>
          <small>{summary.queueTotal} total · {summary.ready} ready · {summary.waiting} waiting · {summary.runningPlanned} running planned · {summary.waitingOutput} waiting output</small>
        </div>
        <div>
          <strong>Review gates</strong>
          <small>{summary.qaPending} QA pending · {summary.needsReview} needs review · {summary.stalled} stalled</small>
        </div>
        <div>
          <strong>Provider / file / daemon locks</strong>
          <small>{summary.providerFileDaemonLocks}</small>
        </div>
        <div>
          <strong>Blockers / warnings</strong>
          <small>{summary.blockersWarnings.length ? summary.blockersWarnings.slice(0, 5).join(" · ") : "none reported"}</small>
        </div>
      </div>
      <div className="phase34-lock-strip" aria-label="Phase 34 Local Orchestrator hard locks">
        {summary.hardLocks.slice(0, 10).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}

function VideoPlanningDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const videoPlanning = getVideoPlanning(runtimeState);
  const queue = videoPlanning.queueShell;
  const policy = videoPlanning.providerPolicySummary;
  const gateCounts = countBy(videoPlanning.readinessGates.map((gate) => gate.status));
  const planCounts = countBy(videoPlanning.taskPlans.map((plan) => plan.status));
  const queueCounts = countBy(videoPlanning.taskPlans.map((plan) => plan.queueStatus));

  return (
    <section className="machine-panel video-planning-diagnostics">
      <div className="audit-head">
        <LockKeyhole size={17} />
        <span>Video Planning</span>
      </div>
      <div className="summary-grid">
        <Metric label="Queue Shell" value={queue.status} detail={`${queue.counts.ready} ready · ${queue.counts.blocked} blocked · ${queue.counts.parked} parked`} />
        <Metric label="Readiness Gates" value={`${videoPlanning.readinessGates.length}`} detail={`${gateCounts.ready || 0} ready · ${gateCounts.blocked || 0} blocked · ${gateCounts.parked || 0} parked`} />
        <Metric label="Task Plans" value={`${videoPlanning.taskPlans.length}`} detail={`${planCounts.ready || 0} ready · ${planCounts.blocked || 0} blocked · ${planCounts.parked || 0} parked`} />
        <Metric label="Provider Lock" value={policy.liveSubmitAllowed ? "unlocked" : "locked"} detail={`${policy.parkedProviderIds.length || 0} parked provider(s)`} />
      </div>
      <div className="video-diagnostics-grid">
        <div>
          <h3>Queue Shell</h3>
          <div className="field-grid compact">
            <label>Total</label>
            <span>{queue.counts.total}</span>
            <label>Pending</label>
            <span>{queue.counts.pending}</span>
            <label>Concurrency</label>
            <span>{queue.concurrency.configuredLimit} configured · {queue.concurrency.activeProviderLimit} active</span>
            <label>Auto</label>
            <span>{queue.autoContinuePolicy.enabled ? "enabled" : queue.autoContinuePolicy.mode}</span>
            <label>Timeout</label>
            <span>{queue.longQueueTimeout.stallTimeoutSeconds}s · {queue.longQueueTimeout.action}</span>
            <label>Dry Run</label>
            <span>{queue.dryRunOnly ? "true" : "false"}</span>
          </div>
        </div>
        <div>
          <h3>Provider Policy</h3>
          <div className="field-grid compact">
            <label>Parked</label>
            <span>{policy.videoProvidersRemainParked ? "true" : "false"}</span>
            <label>Provider</label>
            <span>{policy.providerSubmissionForbidden ? "forbidden" : "allowed"}</span>
            <label>Fast</label>
            <span>{policy.fastModelForbidden ? "forbidden" : "allowed"}</span>
            <label>VIP</label>
            <span>{policy.vipChannelForbidden ? "forbidden" : "allowed"}</span>
            <label>T2V</label>
            <span>{policy.textToVideoForbidden ? "forbidden" : "allowed"}</span>
            <label>Providers</label>
            <span>{policy.parkedProviderIds.join(", ") || "none listed"}</span>
          </div>
        </div>
        <div>
          <h3>Task Plan Counts</h3>
          <CompactList
            items={[
              ...Object.entries(queueCounts).map(([status, count]) => `${status}: ${count}`),
              ...videoPlanning.taskPlans.slice(0, 4).map((plan) => `${plan.shotId} · ${plan.providerId} · ${plan.queueStatus}`),
            ]}
            empty="No video task plans."
          />
        </div>
      </div>
      <div className="pipeline-details">
        <details>
          <summary>Queue notes ({queue.notes.length})</summary>
          <CompactList items={[...queue.notes, ...queue.concurrency.notes, ...queue.autoContinuePolicy.notes, ...queue.longQueueTimeout.notes]} empty="No queue shell notes." />
        </details>
        <details>
          <summary>Policy notes ({policy.notes.length})</summary>
          <CompactList items={policy.notes} empty="No provider policy notes." />
        </details>
      </div>
    </section>
  );
}

function VideoExecutionPreviewDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const executionPreview = getVideoExecutionPreview(runtimeState);
  const summary = executionPreview.summary;
  const hardLocks = Array.from(new Set(executionPreview.previews.flatMap((preview) => preview.hardLocks)));
  const previewRows = executionPreview.previews.slice(0, 6);

  return (
    <section className="machine-panel video-execution-preview-diagnostics">
      <div className="audit-head">
        <FileJson size={17} />
        <span>Video Execution Preview</span>
      </div>
      <div className="summary-grid">
        <Metric label="Total" value={`${summary.total}`} detail={`${summary.blocked} blocked · ${summary.parked} parked`} />
        <Metric label="Preview Ready" value={`${summary.previewReady}`} detail={`${summary.canPreviewPacket} packet preview(s)`} />
        <Metric label="Can Execute" value={`${summary.canExecute}`} detail="dry-run packet surface only" />
        <Metric label="Hard Locks" value={executionPreview.liveSubmitAllowed ? "unlocked" : "locked"} detail={`${hardLocks.length} lock(s) active`} />
      </div>
      <div className="video-preview-locks">
        <StatusPill value={executionPreview.providerSubmissionForbidden ? "provider forbidden" : "provider allowed"} />
        <StatusPill value={executionPreview.liveSubmitAllowed ? "live allowed" : "live false"} />
        <StatusPill value={executionPreview.dryRunOnly ? "dry-run only" : "dry-run off"} />
        <StatusPill value={summary.canExecute === 0 ? "canExecute 0" : `canExecute ${summary.canExecute}`} />
      </div>
      <div className="video-execution-preview-list">
        {previewRows.map((preview) => (
          <div key={preview.previewId} className="video-execution-preview-row">
            <span>{preview.shotId}</span>
            <StatusPill value={preview.status} />
            <small>Packet {preview.canPreviewPacket ? "previewable" : "blocked"} · {preview.subagentTaskEnvelope.injectedKnowledgePacks.length} injected pack(s) · canExecute {String(preview.canExecute)}</small>
          </div>
        ))}
        {!previewRows.length && <p className="muted-copy">No Video Execution Preview rows in this runtime state.</p>}
      </div>
      <div className="pipeline-details">
        <details>
          <summary>Hard locks ({hardLocks.length})</summary>
          <CompactList items={hardLocks} empty="No hard locks reported." />
        </details>
        <details>
          <summary>Preview notes ({executionPreview.notes.length})</summary>
          <CompactList items={executionPreview.notes} empty="No Video Execution Preview notes." />
        </details>
      </div>
    </section>
  );
}

function ShotImagePipelineSummary({
  runtimeState,
  selectedShot,
}: {
  runtimeState: ProjectRuntimeState;
  selectedShot?: ShotRecord;
}) {
  if (!selectedShot) return <p className="muted-copy">Select a shot to inspect Phase 4 image pipeline state.</p>;

  const pipeline = getImagePipeline(runtimeState);
  const promptPlans = pipeline.promptPlans.filter((plan) => plan.shotId === selectedShot.id);
  const readiness = pipeline.assetReadinessReports.find((report) => report.shotId === selectedShot.id);
  const healthReports = pipeline.generationHealthReports.filter((report) => report.shotId === selectedShot.id);
  const promotionReports = pipeline.qaPromotionReports.filter((report) => report.shotId === selectedShot.id);
  const canPromote = promotionReports.filter((report) => report.canPromoteToFormal).length;
  const cannotPromote = promotionReports.length - canPromote;

  return (
    <div className="shot-pipeline-summary">
      <div className="field-grid compact">
        <label>Prompt Plans</label>
        <span>{promptPlans.length} total · {promptPlans.filter((plan) => plan.status === "blocked").length} blocked</span>
        <label>Readiness</label>
        <span>{readiness ? `${readiness.status} · formal ${readiness.formalBlocked ? "blocked" : "allowed"}` : "missing"}</span>
        <label>Health</label>
        <span>{healthReports.map((report) => statusLabel(report.healthStatus)).join(", ") || "none"}</span>
        <label>Promotion</label>
        <span>{canPromote} can formal · {cannotPromote} cannot formal</span>
      </div>
      <div className="pipeline-card-list">
        {promptPlans.slice(0, 4).map((plan) => (
          <div key={plan.promptPlanId}>
            <div className="row-head">
              <strong>{plan.promptKind}</strong>
              <StatusPill value={plan.status} />
            </div>
            <small>{plan.providerSlot} / {plan.requiredMode} · refs {plan.referenceIds.length} · preserve {plan.mustPreserve.length} · avoid {plan.mustAvoid.length}</small>
          </div>
        ))}
        {!promptPlans.length && <p className="muted-copy">No prompt plans for this shot.</p>}
      </div>
      {(readiness?.blockers.length || readiness?.warnings.length || promotionReports.some((report) => report.blockers.length || report.warnings.length)) && (
        <details className="pipeline-shot-details">
          <summary>Shot blockers and warnings</summary>
          <CompactList
            items={[
              ...(readiness?.blockers || []).map((item) => `readiness: ${item}`),
              ...(readiness?.warnings || []).map((item) => `readiness: ${item}`),
              ...promotionReports.flatMap((report) => report.blockers.map((item) => `promotion: ${item}`)),
              ...promotionReports.flatMap((report) => report.warnings.map((item) => `promotion: ${item}`)),
            ]}
          />
        </details>
      )}
    </div>
  );
}

function Workflow({ stages }: { stages: WorkflowStage[] }) {
  return (
    <div className="workflow">
      {stages.map((stage) => (
        <div key={stage.id} className={`stage ${stage.status}`}>
          {stageIcon(stage)}
          <span>{stage.label}</span>
          <small>{stage.detail}</small>
        </div>
      ))}
    </div>
  );
}

function VisualMemoryPanel({
  audit,
  view,
  selectedAsset,
  onSelectAsset,
}: {
  audit: ProjectAudit;
  view: RuntimeView;
  selectedAsset?: string;
  onSelectAsset: (id: string) => void;
}) {
  const groups = groupAssets(audit.assets);
  return (
    <aside className="asset-panel">
      <div className="panel-title">
        <Boxes size={17} />
        <span>Visual Memory</span>
      </div>
      <div className="memory-summary">
        <strong>{view.visualMemory.existing}/{view.visualMemory.total || audit.metrics.expectedAssets}</strong>
        <span>assets present</span>
        <small>{view.visualMemory.needsReview} need review · {view.visualMemory.missing} missing</small>
      </div>
      {Object.entries(groups).filter(([, items]) => items.length).map(([group, items]) => (
        <section key={group} className="asset-group">
          <h3>{group}</h3>
          <div className="asset-list">
            {items.map((asset) => (
              <button
                key={asset.id}
                className={`asset-row ${selectedAsset === asset.id ? "selected" : ""}`}
                onClick={() => onSelectAsset(asset.id)}
              >
                <span className="asset-name">{asset.name}</span>
                <span className={`dot ${asset.status === "missing" ? "bad" : asset.issues.length ? "warn" : "ok"}`} />
                <small>{asset.lockedStatus}</small>
              </button>
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}

function ShotCard({ shot, selected, taskCount, onClick }: { shot: ShotRecord; selected: boolean; taskCount: number; onClick: () => void }) {
  return (
    <button className={`shot-card ${selected ? "selected" : ""}`} onClick={onClick}>
      <div className="shot-top">
        <strong>{shot.id}</strong>
        <StatusPill value={shot.status} />
      </div>
      <p>{shot.storyFunction}</p>
      <div className="shot-media">
        <div>
          <span>Start</span>
          <small>{shot.startFrame && !shot.issues.includes("missing_start_frame") ? "present" : "missing"}</small>
        </div>
        <div>
          <span>End</span>
          <small>{shot.endFrame && !shot.issues.includes("missing_end_frame") ? "present" : "missing"}</small>
        </div>
        <div>
          <span>Queue</span>
          <small>{taskCount} tasks</small>
        </div>
      </div>
      <div className="gate-row">
        {gateNames.map((name) => (
          <span key={name} className={gateClass(shot.gates[name])} title={`${name}: ${shot.gates[name]}`}>
            {name[0]}
          </span>
        ))}
      </div>
    </button>
  );
}

function StoryWorkspace({
  audit,
  view,
  selectedShotId,
  onSelectShot,
}: {
  audit: ProjectAudit;
  view: RuntimeView;
  selectedShotId: string;
  onSelectShot: (id: string) => void;
}) {
  const [tab, setTab] = useState("all");
  const activeSection = view.storySections.find((section) => section.id === tab);
  const shots = tab === "all" || !activeSection ? audit.shots : audit.shots.filter((shot) => activeSection.shotIds.includes(shot.id));

  useEffect(() => {
    if (tab !== "all" && !view.storySections.some((section) => section.id === tab)) setTab("all");
  }, [tab, view.storySections]);

  return (
    <main className="workspace">
      <div className="tabs">
        <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>
          All Shots
        </button>
        {view.storySections.map((section) => (
          <button key={section.id} className={tab === section.id ? "active" : ""} onClick={() => setTab(section.id)}>
            {section.label}
            <small>{section.shotCount}</small>
          </button>
        ))}
      </div>
      <div className="shot-grid">
        {shots.map((shot) => (
          <ShotCard
            key={shot.id}
            shot={shot}
            selected={selectedShotId === shot.id}
            taskCount={view.taskViews.filter((task) => task.shot?.id === shot.id).length}
            onClick={() => onSelectShot(shot.id)}
          />
        ))}
      </div>
    </main>
  );
}

function PreviewTimeline({
  view,
  previewExport,
  selectedShotId,
  onSelectShot,
}: {
  view: RuntimeView;
  previewExport: ProjectPreviewExportState;
  selectedShotId: string;
  onSelectShot: (id: string) => void;
}) {
  const total = Math.max(1, view.previewEvents.reduce((max, event) => Math.max(max, event.startSeconds + event.durationSeconds), 0));
  const draftSummary = previewExport.draftPreview.summary;
  const proxy = previewExport.roughCutProxy;

  return (
    <section className="preview-timeline">
      <div className="audit-head">
        <Play size={17} />
        <span>Preview</span>
      </div>
      <div className="preview-status-grid">
        <div>
          <span>Draft Events</span>
          <strong>{draftSummary.eventCount}</strong>
        </div>
        <div>
          <span>Blocked</span>
          <strong>{draftSummary.blockedPlaceholderCount}</strong>
        </div>
        <div>
          <span>Formal Gate</span>
          <strong>{previewExport.formalPreviewGate.status}</strong>
        </div>
        <div>
          <span>Proxy Duration</span>
          <strong>{formatDuration(proxy.totalDurationSeconds)}</strong>
        </div>
      </div>
      <div className="timeline-track">
        {view.previewEvents.map((event) => (
          <button
            key={event.id}
            className={`timeline-event ${event.type} ${event.shotId === selectedShotId ? "selected" : ""}`}
            style={{ width: `${Math.max(7, (event.durationSeconds / total) * 100)}%` }}
            onClick={() => event.shotId && onSelectShot(event.shotId)}
            title={`${event.shotId || "gap"} · ${event.type} · ${event.qaStatus}`}
          >
            <span>{event.shotId}</span>
            <small>{event.type === "blocked_placeholder" ? "blocked" : event.type.replace("_", " ")}</small>
          </button>
        ))}
      </div>
      <small className="muted-copy">Rough preview/status only. Formal preview is represented as gate eligibility.</small>
    </section>
  );
}

function MinimalTopNav({
  projectTitle,
  projectPlan,
  mode,
  directorView,
  sections,
  activeSectionId,
  onOpenDirectorView,
  onOpenSection,
  onOpenDiagnostics,
}: {
  projectTitle: string;
  projectPlan: MinimalProjectPlan;
  mode: UiMode;
  directorView: DirectorView;
  sections: RuntimeView["storySections"];
  activeSectionId?: string;
  onOpenDirectorView: (view: DirectorView) => void;
  onOpenSection: (sectionId: string) => void;
  onOpenDiagnostics: () => void;
}) {
  return (
    <header className="minimal-topbar">
      <button className="project-title-button" onClick={() => onOpenDirectorView("story")}>
        <span className="project-title-text">{projectTitle || "Untitled project"}</span>
        <span className="project-plan-entry" aria-label="Project plan status">
          <strong>Project</strong>
          <span>{projectPlan.entryLabel}</span>
          <span>{projectPlan.planLabel}</span>
        </span>
      </button>
      <nav className="minimal-nav" aria-label="Director views">
        <button
          className={mode === "director" && directorView === "assets" ? "active" : ""}
          onClick={() => onOpenDirectorView("assets")}
        >
          Asset Library
        </button>
        {sections.map((section) => (
          <button
            key={section.id}
            className={mode === "director" && directorView === "story" && activeSectionId === section.id ? "active" : ""}
            onClick={() => onOpenSection(section.id)}
          >
            {section.label}
          </button>
        ))}
        <button
          className={mode === "director" && directorView === "preview" ? "active" : ""}
          onClick={() => onOpenDirectorView("preview")}
        >
          Preview
        </button>
      </nav>
      <button className={`diagnostics-link ${mode === "diagnostics" ? "active" : ""}`} onClick={onOpenDiagnostics}>
        Diagnostics
      </button>
    </header>
  );
}

function MinimalStoryFlow({
  sectionLabel,
  shots,
  selectedShotId,
  onSelectShot,
}: {
  sectionLabel: string;
  shots: ShotRecord[];
  selectedShotId: string;
  onSelectShot: (id: string) => void;
}) {
  return (
    <main className="minimal-story-flow">
      <h2>{sectionLabel}</h2>
      <div className="minimal-shot-grid">
        {shots.map((shot, index) => (
          <button
            key={shot.id}
            className={`minimal-shot-card ${selectedShotId === shot.id ? "selected" : ""}`}
            onClick={() => onSelectShot(shot.id)}
          >
            <MediaFrame
              src={shot.startFrame || shot.endFrame}
              alt={shot.title}
              label={formatShotNumber(shot.id)}
              className="minimal-shot-image"
            />
            <span className="minimal-shot-caption">
              <strong>{formatShotNumber(shot.id)}</strong>
              <span>{shortStoryFunction(shot, index)}</span>
              <i className={`dot ${shotStatusTone(shot)}`} aria-label={shot.status} />
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}

function MinimalAssetLibrary({
  audit,
  selectedAssetId,
  onSelectAsset,
}: {
  audit: ProjectAudit;
  selectedAssetId?: string;
  onSelectAsset: (id: string) => void;
}) {
  const groups = groupAssets(audit.assets);

  return (
    <main className="asset-library-view">
      <h2>Asset Library</h2>
      <div className="asset-status-strip" aria-label="Asset consistency">
        <span><i className="dot ok" /> locked</span>
        <span><i className="dot warn" /> candidate</span>
        <span><i className="dot warn" /> review</span>
      </div>
      <section className="asset-library-section">
        <span className="asset-section-label">Characters</span>
        <div className="asset-feature-grid characters">
          {groups.Characters.map((asset) => (
            <button
              key={asset.id}
              className={`asset-reference-card ${selectedAssetId === asset.id ? "selected" : ""}`}
              onClick={() => onSelectAsset(asset.id)}
            >
              <MediaFrame src={asset.path} alt={asset.name} label={cleanLabel(asset.name)} className="asset-reference-image" />
              <span>
                <strong>{cleanLabel(asset.name)}</strong>
                <small><i className={`dot ${assetStatusTone(asset)}`} /> {assetStatusLabel(asset)}</small>
              </span>
            </button>
          ))}
          {!groups.Characters.length && <div className="minimal-empty-line">No character anchors yet</div>}
        </div>
      </section>
      <section className="asset-library-section">
        <span className="asset-section-label">Scenes</span>
        <div className="asset-feature-grid scenes">
          {groups.Scenes.slice(0, 8).map((asset) => (
            <button
              key={asset.id}
              className={`asset-reference-card wide ${selectedAssetId === asset.id ? "selected" : ""}`}
              onClick={() => onSelectAsset(asset.id)}
            >
              <MediaFrame src={asset.path} alt={asset.name} label={cleanLabel(asset.name)} className="asset-reference-image" />
              <span>
                <strong>{cleanLabel(asset.name)}</strong>
                <small><i className={`dot ${assetStatusTone(asset)}`} /> {assetStatusLabel(asset)}</small>
              </span>
            </button>
          ))}
          {!groups.Scenes.length && <div className="minimal-empty-line">No scene anchors yet</div>}
        </div>
      </section>
      <section className="asset-library-section compact">
        <span className="asset-section-label">Props / Style</span>
        <div className="anchor-list">
          {[...groups.Props, ...groups.Style].map((asset) => (
            <button
              key={asset.id}
              className={`anchor-row ${selectedAssetId === asset.id ? "selected" : ""}`}
              onClick={() => onSelectAsset(asset.id)}
            >
              <span>{cleanLabel(asset.name)}</span>
              <small><i className={`dot ${assetStatusTone(asset)}`} /> {assetStatusLabel(asset)}</small>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function MinimalPreview({
  previewExport,
  sections,
  shots,
  selectedShotId,
  onSelectShot,
}: {
  previewExport: ProjectPreviewExportState;
  sections: RuntimeView["storySections"];
  shots: ShotRecord[];
  selectedShotId: string;
  onSelectShot: (id: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const queue = useMemo(() => buildPreviewPlayerQueue(previewExport, shots), [previewExport, shots]);
  const total = Math.max(1, getPreviewPlayerTotalDuration(queue));
  const activeItem = getPreviewPlayerActiveItem(queue, currentTime);
  const activeShot = activeItem?.shotId ? shots.find((shot) => shot.id === activeItem.shotId) : undefined;
  const progress = Math.min(100, Math.max(0, (currentTime / total) * 100));

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (!queue.length) {
      setPlaying(false);
      currentTimeRef.current = 0;
      setCurrentTime(0);
      return;
    }
    setCurrentTime((time) => {
      const nextTime = Math.min(Math.max(0, time), total);
      currentTimeRef.current = nextTime;
      return nextTime;
    });
  }, [queue, total]);

  useEffect(() => {
    if (!playing || !queue.length) return undefined;
    let frame = 0;
    let stopped = false;
    let previous = performance.now();
    const tick = (now: number) => {
      if (stopped) return;
      const deltaSeconds = Math.max(0, (now - previous) / 1000);
      previous = now;
      const nextTime = Math.min(total, currentTimeRef.current + deltaSeconds);
      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);
      if (nextTime >= total) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
  }, [playing, queue.length, total]);

  useEffect(() => {
    const selectedItem = queue.find((item) => item.shotId === selectedShotId);
    if (!selectedItem) return;
    setCurrentTime((time) => {
      const itemAtTime = getPreviewPlayerActiveItem(queue, time);
      if (playing && itemAtTime?.shotId === selectedShotId) return time;
      const nextTime = Math.abs(time - selectedItem.startSeconds) < 0.05 ? time : selectedItem.startSeconds;
      currentTimeRef.current = nextTime;
      return nextTime;
    });
  }, [playing, queue, selectedShotId]);

  useEffect(() => {
    if (playing && activeItem?.shotId && activeItem.shotId !== selectedShotId) onSelectShot(activeItem.shotId);
  }, [activeItem?.shotId, onSelectShot, playing, selectedShotId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || activeItem?.kind !== "video_clip") return;
    const mediaTime = Math.max(0, currentTime - activeItem.startSeconds);
    if (Number.isFinite(mediaTime) && Math.abs(video.currentTime - mediaTime) > 0.75) {
      try {
        video.currentTime = mediaTime;
      } catch {
        // Some browsers reject seeks before metadata is ready.
      }
    }
  }, [activeItem?.id, activeItem?.kind, activeItem?.startSeconds, currentTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || activeItem?.kind !== "video_clip") return;
    if (playing) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [activeItem?.id, activeItem?.kind, playing]);

  const togglePlaying = () => {
    if (!queue.length) return;
    setPlaying((value) => {
      if (value) return false;
      setCurrentTime((time) => {
        const nextTime = time >= total ? 0 : time;
        currentTimeRef.current = nextTime;
        return nextTime;
      });
      return true;
    });
  };

  const selectPreviewItem = (item: PreviewQueueItem) => {
    currentTimeRef.current = item.startSeconds;
    setCurrentTime(item.startSeconds);
    if (item.shotId) onSelectShot(item.shotId);
  };

  return (
    <main className="minimal-preview-view">
      <section className="preview-stage">
        {activeItem?.kind === "image_hold" ? (
          <MediaFrame
            src={activeItem.mediaPath}
            alt={activeItem.shotId || "Preview"}
            label={activeItem.label}
            className="preview-stage-image"
          />
        ) : activeItem?.kind === "video_clip" && activeItem.mediaPath ? (
          <video
            key={activeItem.id}
            ref={videoRef}
            className="preview-stage-video"
            src={toMediaSrc(activeItem.mediaPath)}
            muted
            playsInline
          />
        ) : (
          <div className={`preview-stage-card ${activeItem?.kind || "missing_placeholder"}`}>
            <span>Missing</span>
            <strong>{activeItem?.label || "Preview"}</strong>
            <small>{activeShot ? shortStoryFunction(activeShot, shots.indexOf(activeShot)) : "Hold"}</small>
          </div>
        )}
        <button className="preview-play-button" onClick={togglePlaying} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <PauseCircle size={42} /> : <Play size={42} />}
        </button>
      </section>
      <section className="minimal-preview-controls">
        <div className="preview-ruler">
          {sections.map((section) => {
            const firstShotId = section.shotIds[0];
            const item = queue.find((candidate) => candidate.shotId === firstShotId);
            const left = item ? (item.startSeconds / total) * 100 : 0;
            return (
              <span
                key={section.id}
                className={left <= 2 ? "edge-start" : left >= 98 ? "edge-end" : undefined}
                style={{ left: `${left}%` }}
              >
                {section.label}
              </span>
            );
          })}
        </div>
        <div className="preview-line">
          {queue.map((item) => (
            <button
              key={item.id}
              className={`preview-line-event ${item.kind} ${item.id === activeItem?.id ? "selected" : ""}`}
              style={{
                left: `${(item.startSeconds / total) * 100}%`,
                width: `${Math.max(3, (item.durationSeconds / total) * 100)}%`,
              }}
              onClick={() => selectPreviewItem(item)}
              aria-label={item.label}
            />
          ))}
          <span className="preview-line-progress" style={{ left: `${progress}%` }} />
        </div>
        <div className="preview-time-row">
          <button onClick={togglePlaying}>{playing ? <PauseCircle size={17} /> : <Play size={17} />}</button>
          <span>{formatDuration(currentTime)} / {formatDuration(total)}</span>
        </div>
      </section>
    </main>
  );
}

function MinimalAgentPanel({
  runtimeState,
  shot,
  asset,
  sectionLabel,
  sectionId,
}: {
  runtimeState: ProjectRuntimeState;
  shot?: ShotRecord;
  asset?: AssetRecord;
  sectionLabel?: string;
  sectionId?: string;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Ready");
  const [workflow, setWorkflow] = useState<ReturnType<typeof buildDirectorWorkflowState> | undefined>();
  const scopeLabel = selectedScopeLabel(shot, asset, sectionLabel);

  function prepareChange() {
    const userIntent = text.trim();
    if (!userIntent) {
      setStatus("Add a change first");
      return;
    }
    const nextWorkflow = buildDirectorWorkflowState({
      runtimeState,
      userIntent,
      selection: {
        selectedShotId: shot?.id,
        selectedAssetId: asset?.id,
        sectionId: !shot && !asset ? sectionId : undefined,
      },
    });
    setWorkflow(nextWorkflow);
    setStatus(workflowStatusLabel(nextWorkflow.status));
  }

  const badges = workflow ? workflowBadgeLabels(workflow).slice(0, 5) : ["Plan preview"];
  const nextStep = workflow ? workflowNextStepLabel(workflow.status) : "Describe a story edit to preview the plan.";
  const confirmationPrompt = workflow?.confirmationRequired ? "Confirm before this becomes an editable plan." : "";

  return (
    <aside className="minimal-agent-panel">
      <span>{scopeLabel}</span>
      <div className="minimal-agent-input">
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Refine selected beat" />
        <button disabled={!text.trim()} onClick={prepareChange}>
          <Eye size={15} />
          Preview plan
        </button>
      </div>
      <strong className="minimal-agent-status">{status}</strong>
      <div className="minimal-agent-badges" aria-label="Plan summary">
        {badges.map((badge) => (
          <small key={badge}>{badge}</small>
        ))}
      </div>
      <small>{nextStep}</small>
      {confirmationPrompt && <small className="minimal-agent-confirm">{confirmationPrompt}</small>}
    </aside>
  );
}

function workflowStatusLabel(status: DirectorWorkflowStatus) {
  if (status === "dry_run_ready") return "Ready to review";
  if (status === "pending_confirmation") return "Needs confirmation";
  if (status === "blocked_missing_context") return "Needs context";
  return "Blocked";
}

function workflowNextStepLabel(status: DirectorWorkflowStatus) {
  if (status === "dry_run_ready") return "Review the plan before any change.";
  if (status === "pending_confirmation") return "Confirm the selected edit after review.";
  if (status === "blocked_missing_context") return "Add the missing selection context.";
  return "Rewrite this as a story edit.";
}

function workflowBadgeLabels(workflow: ReturnType<typeof buildDirectorWorkflowState>) {
  const labels = ["Plan preview", workflow.scopeLabel];
  if (workflow.summary.readyTaskPackets > 0) labels.push(`${workflow.summary.readyTaskPackets} ready step(s)`);
  if (workflow.summary.blockedTaskPackets > 0) labels.push("Needs context");
  if (workflow.confirmationRequired) labels.push("Confirm first");
  if (workflow.summary.exportPackageStatus === "ready") labels.push("Preview ready");
  return Array.from(new Set(labels));
}

function DirectorProgressStrip({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const state = buildDirectorProgressStripState(runtimeState);
  const visibleSegments = state.segments.filter((segment) => segment.value > 0);

  return (
    <section className={`director-progress-strip ${state.tone}`} aria-label="项目处理进度">
      <div className="director-progress-heading">
        <span>{state.label}</span>
        <small>{state.detail}</small>
      </div>
      <div className="director-progress-track" aria-hidden="true">
        {visibleSegments.length ? visibleSegments.map((segment) => (
          <span
            key={segment.label}
            className={`director-progress-segment ${segment.tone}`}
            style={{ flex: `${segment.value} 1 0` }}
          />
        )) : <span className="director-progress-segment preparing" style={{ flex: "1 1 0" }} />}
      </div>
      <div className="director-progress-counts" aria-label="处理状态">
        {state.segments.map((segment) => (
          <span key={segment.label}>
            {segment.label}
            <b>{segment.value}</b>
          </span>
        ))}
      </div>
    </section>
  );
}

function AudioPlanSummaryStrip({ audioPlanning, selectedShot }: { audioPlanning: AudioPlanningState; selectedShot?: ShotRecord }) {
  const selectedPlan = findAudioPlan(audioPlanning, selectedShot?.id);
  const plannedSlots = audioPlanning.providerSlots.filter((slot) => slot.state === "planned").length;
  const liveAudioSlots = audioPlanning.providerSlots.filter((slot) => slot.liveSubmitAllowed).length;

  return (
    <section className="audio-plan-summary-strip">
      <div className="audit-head">
        <Radio size={17} />
        <span>Audio Plan</span>
      </div>
      <div className="audio-summary-line">
        <div>
          <span>Audio planned</span>
          <strong>{audioPlanning.shotPlans.length}</strong>
        </div>
        <div>
          <span>Mix placeholders</span>
          <strong>{audioPlanning.previewMix.eventCount}</strong>
        </div>
        <div>
          <span>No BGM</span>
          <strong>{audioPlanning.videoProviderPolicy.noBgmForVideoProvider ? "on" : "off"}</strong>
        </div>
      </div>
      <div className="audio-policy-line">
        <small>Music off for video provider</small>
        <small>{plannedSlots} audio provider slot(s) planned · {liveAudioSlots} live</small>
      </div>
      <div className="audio-badge-row" aria-label="Selected shot audio badges">
        {audioPlanBadges(selectedPlan).map((badge) => (
          <span key={badge} className="audio-badge">{badge}</span>
        ))}
      </div>
    </section>
  );
}

function firstVideoBlocker(gate?: VideoReadinessGateState, plan?: VideoTaskPlanState) {
  return gate?.blockers[0]
    || plan?.blockers[0]
    || gate?.checks.find((check) => check.status === "blocked")?.detail
    || "No selected-shot video blocker.";
}

function VideoPlanningSummaryStrip({
  runtimeState,
  selectedShot,
}: {
  runtimeState: ProjectRuntimeState;
  selectedShot?: ShotRecord;
}) {
  const videoPlanning = getVideoPlanning(runtimeState);
  const queue = videoPlanning.queueShell;
  const policy = videoPlanning.providerPolicySummary;
  const selectedGate = selectedShot ? videoPlanning.readinessGates.find((gate) => gate.shotId === selectedShot.id) : undefined;
  const selectedPlan = selectedShot ? videoPlanning.taskPlans.find((plan) => plan.shotId === selectedShot.id) : undefined;
  const readyGates = videoPlanning.readinessGates.filter((gate) => gate.status === "ready").length;
  const blockedGates = videoPlanning.readinessGates.filter((gate) => gate.status === "blocked").length;

  return (
    <section className="video-plan-summary-strip">
      <div className="audit-head">
        <LockKeyhole size={17} />
        <span>Video Prepare</span>
      </div>
      <div className="video-status-grid">
        <div>
          <span>Video Readiness</span>
          <strong>{selectedGate?.status || `${readyGates}/${videoPlanning.readinessGates.length}`}</strong>
          <small>{blockedGates} blocked gate(s)</small>
        </div>
        <div>
          <span>Queue Shell</span>
          <strong>{queue.status}</strong>
          <small>{queue.counts.ready} ready · {queue.counts.parked} parked</small>
        </div>
        <div>
          <span>Provider Lock</span>
          <strong>{policy.liveSubmitAllowed ? "unlocked" : "locked"}</strong>
          <small>{policy.parkedProviderIds.join(", ") || "providers parked"}</small>
        </div>
        <div>
          <span>First Blocker</span>
          <strong>{selectedShot ? selectedShot.id : "project"}</strong>
          <small>{firstVideoBlocker(selectedGate, selectedPlan)}</small>
        </div>
      </div>
      <small className="muted-copy">Readiness and queue shell only. Provider execution remains locked.</small>
    </section>
  );
}

function DirectorMode({
  audit,
  view,
  runtimeState,
  selectedShot,
  selectedAsset,
  selectedShotId,
  selectedAssetId,
  directorView,
  activeSectionId,
  onSelectShot,
  onSelectAsset,
}: {
  audit: ProjectAudit;
  view: RuntimeView;
  runtimeState: ProjectRuntimeState;
  selectedShot?: ShotRecord;
  selectedAsset?: AssetRecord;
  selectedShotId: string;
  selectedAssetId?: string;
  directorView: DirectorView;
  activeSectionId?: string;
  onSelectShot: (id: string) => void;
  onSelectAsset: (id: string) => void;
}) {
  const activeSection = view.storySections.find((section) => section.id === activeSectionId) || view.storySections[0];
  const sectionLabel = activeSection?.label || "Story";
  const shots = activeSection ? audit.shots.filter((shot) => activeSection.shotIds.includes(shot.id)) : audit.shots;

  return (
    <div className={`minimal-director ${directorView}`}>
      <DirectorProgressStrip runtimeState={runtimeState} />
      <div className="minimal-director-main">
        {directorView === "assets" && (
          <MinimalAssetLibrary
            audit={audit}
            selectedAssetId={selectedAssetId}
            onSelectAsset={onSelectAsset}
          />
        )}
        {directorView === "story" && (
          <MinimalStoryFlow
            sectionLabel={sectionLabel}
            shots={shots}
            selectedShotId={selectedShotId}
            onSelectShot={onSelectShot}
          />
        )}
        {directorView === "preview" && (
          <MinimalPreview
            previewExport={runtimeState.previewExport}
            sections={view.storySections}
            shots={audit.shots}
            selectedShotId={selectedShotId}
            onSelectShot={onSelectShot}
          />
        )}
      </div>
      <MinimalAgentPanel
        runtimeState={runtimeState}
        shot={directorView === "assets" ? undefined : selectedShot}
        asset={directorView === "assets" ? selectedAsset : undefined}
        sectionLabel={sectionLabel}
        sectionId={directorView === "story" && !selectedShot ? activeSection?.id : undefined}
      />
    </div>
  );
}

function TaskRows({ tasks, compact = false }: { tasks: TaskRuntimeView[]; compact?: boolean }) {
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

function EnvelopePreview({ task }: { task?: TaskRuntimeView }) {
  if (!task) return <p className="muted-copy">Select a shot to preview its standardized task envelope.</p>;

  return (
    <div className="envelope-preview">
      <div className="field-grid compact">
        <label>Slot</label>
        <span>{task.envelope.providerSlot}</span>
        <label>Provider</label>
        <span>{task.envelope.providerId}</span>
        <label>Scope</label>
        <span>{task.envelope.preflight.preflightScope}</span>
        <label>Status</label>
        <span>{task.envelope.preflight.status}</span>
        <label>Blockers</label>
        <span>{task.envelope.preflight.blockers.length}</span>
        <label>Warnings</label>
        <span>{task.envelope.preflight.warnings.length}</span>
        <label>Knowledge</label>
        <span>{task.envelope.injectedKnowledgePacks.length} packs / {task.contextBudget.usedTokens} tokens</span>
        <label>Validator</label>
        <span>{task.validator.valid ? "valid" : task.validator.issues.join(", ")}</span>
      </div>
      <div className="rule-list">
        {task.envelope.preflight.blockers.slice(0, 4).map((item, index) => (
          <small key={`${item.code}-${item.target || "task"}-${index}`}>{item.code}: {item.messageForUser}</small>
        ))}
        {task.envelope.injectedKnowledgePacks.slice(0, 4).map((pack) => (
          <small key={pack.packId}>{pack.consumer}: {pack.packId} · {pack.injectedSnippetIds.join(", ") || "summary"}</small>
        ))}
      </div>
    </div>
  );
}

function ShotAudioInspector({ audioPlanning, selectedShot }: { audioPlanning: AudioPlanningState; selectedShot?: ShotRecord }) {
  if (!selectedShot) return <p className="muted-copy">Select a shot to inspect its audio plan.</p>;

  const plan = findAudioPlan(audioPlanning, selectedShot.id);
  if (!plan) return <p className="muted-copy">No audio plan found for {selectedShot.id}.</p>;

  return (
    <div className="shot-audio-inspector">
      <div className="audio-badge-row">
        {audioPlanBadges(plan).map((badge) => (
          <span key={badge} className="audio-badge">{badge}</span>
        ))}
      </div>
      <div className="field-grid compact">
        <label>Narration</label>
        <span>{plan.narrationText || "none planned"}</span>
        <label>Dialogue</label>
        <span>{plan.dialogueLines.length ? `${plan.dialogueLines.length} line(s)` : "none planned"}</span>
        <label>Voice</label>
        <span>{voiceSourceLabel(audioPlanning, plan.voiceSourceId)}</span>
        <label>Delivery</label>
        <span>{plan.deliveryNotes}</span>
        <label>Ambience</label>
        <span>{plan.ambienceBrief}</span>
        <label>BGM</label>
        <span>{plan.bgmProfile}</span>
        <label>Music</label>
        <span>{plan.musicAllowed ? "allowed in audio plan" : "not allowed for video provider"}</span>
        <label>Timing</label>
        <span>{formatDuration(plan.targetDurationSeconds)} · fade {plan.fadeInSeconds || 0}s/{plan.fadeOutSeconds || 0}s</span>
        <label>Output</label>
        <span>{plan.outputPath || "missing placeholder output"}</span>
        <label>Jobs</label>
        <span>TTS {plan.linkedTtsJobId || "none"} · music {plan.linkedMusicJobId || "none"}</span>
        <label>QA</label>
        <span>{plan.audioQaStatus}</span>
        <label>No BGM</label>
        <span>{audioPlanning.videoProviderPolicy.summary}</span>
      </div>
      {plan.dialogueLines.length > 0 && (
        <div className="compact-list">
          {plan.dialogueLines.map((line, index) => (
            <small key={`${line}-${index}`}>{line}</small>
          ))}
        </div>
      )}
    </div>
  );
}

function ruleValue(value: boolean) {
  return value ? "true" : "false";
}

function formatFrameRef(ref?: VideoExecutionPreviewRow["subagentPacketPreview"]["startFrameRef"]) {
  if (!ref) return "missing";
  const path = ref.path ? ` · ${ref.path}` : "";
  return `${ref.shotFrameId} · ${ref.present ? "present" : "missing"} · ${ref.source}${path}`;
}

function ShotExecutionPreviewInspector({
  runtimeState,
  selectedShot,
}: {
  runtimeState: ProjectRuntimeState;
  selectedShot?: ShotRecord;
}) {
  if (!selectedShot) return <p className="muted-copy">Select a shot to inspect its Video Execution Preview.</p>;

  const executionPreview = getVideoExecutionPreview(runtimeState);
  const preview = executionPreview.previews.find((item) => item.shotId === selectedShot.id);
  if (!preview) return <p className="muted-copy">No Video Execution Preview row found for {selectedShot.id}. Packet remains parked.</p>;

  const packet = preview.subagentPacketPreview;
  const packetLocks = [
    `providerForbidden=${ruleValue(preview.providerSubmissionForbidden)}`,
    `liveAllowed=${ruleValue(preview.liveSubmitAllowed)}`,
    `dryRunOnly=${ruleValue(preview.dryRunOnly)}`,
    `canPreviewPacket=${ruleValue(preview.canPreviewPacket)}`,
    `canExecute=${ruleValue(preview.canExecute)}`,
  ];

  return (
    <div className="shot-execution-preview-inspector">
      <div className="field-grid compact">
        <label>Status</label>
        <span>{preview.status}</span>
        <label>Packet</label>
        <span>{preview.canPreviewPacket ? "previewable" : "blocked"}</span>
        <label>Can Execute</label>
        <span>{String(preview.canExecute)}</span>
        <label>Context</label>
        <span>{preview.contextLevel}</span>
        <label>Purpose</label>
        <span>{preview.subagentPurpose}</span>
        <label>Provider</label>
        <span>{preview.providerId} · {preview.providerSlot} / {preview.requiredMode}</span>
        <label>Start</label>
        <span>{formatFrameRef(packet.startFrameRef)}</span>
        <label>End</label>
        <span>{formatFrameRef(packet.endFrameRef)}</span>
      </div>
      <div className="video-rule-strip">
        {packetLocks.map((rule) => (
          <span key={rule}>{rule}</span>
        ))}
      </div>
      <div className="video-preview-scope-grid">
        <div>
          <h3>Read Scopes</h3>
          <CompactList items={packet.requiredReadScopes} empty="No read scopes listed." />
        </div>
        <div>
          <h3>Forbidden Scopes</h3>
          <CompactList items={packet.forbiddenReadScopes} empty="No forbidden scopes listed." />
        </div>
      </div>
      <details className="pipeline-shot-details" open={Boolean(preview.blockers.length)}>
        <summary>Blockers ({preview.blockers.length}) / warnings ({preview.warnings.length})</summary>
        <CompactList items={[...preview.blockers.map((item) => `blocker: ${item}`), ...preview.warnings.map((item) => `warning: ${item}`)]} empty="No packet blockers or warnings." />
      </details>
      <details className="pipeline-shot-details">
        <summary>Hard locks ({preview.hardLocks.length})</summary>
        <CompactList items={preview.hardLocks} empty="No hard locks listed." />
      </details>
      <details className="pipeline-shot-details">
        <summary>Dry-run order preview ({preview.executionOrderPreview.length})</summary>
        <CompactList items={preview.executionOrderPreview.map((step, index) => `${index + 1}. ${statusLabel(step)}`)} empty="No dry-run order preview." />
      </details>
    </div>
  );
}

function ShotVideoGateInspector({
  runtimeState,
  selectedShot,
}: {
  runtimeState: ProjectRuntimeState;
  selectedShot?: ShotRecord;
}) {
  if (!selectedShot) return <p className="muted-copy">Select a shot to inspect its video readiness gate.</p>;

  const videoPlanning = getVideoPlanning(runtimeState);
  const gate = videoPlanning.readinessGates.find((item) => item.shotId === selectedShot.id);
  const plan = videoPlanning.taskPlans.find((item) => item.shotId === selectedShot.id);

  if (!gate && !plan) return <p className="muted-copy">No video planning record found for {selectedShot.id}. Provider lock remains active.</p>;

  const derivation = gate?.keyframePairDerivation;
  const preflight = plan?.preflightFacts;
  const manifest = plan?.manifestFacts;
  const hardRules = plan
    ? [
      `dryRunOnly=${ruleValue(plan.dryRunOnly)}`,
      `providerSubmissionForbidden=${ruleValue(plan.providerSubmissionForbidden)}`,
      `fastModelForbidden=${ruleValue(plan.fastModelForbidden)}`,
      `vipChannelForbidden=${ruleValue(plan.vipChannelForbidden)}`,
      `textToVideoForbidden=${ruleValue(plan.textToVideoForbidden)}`,
      `noBgm=${ruleValue(plan.promptConstraints.some((constraint) => /no\s*bgm/i.test(constraint)))}`,
      `liveSubmitAllowed=${ruleValue(plan.liveSubmitAllowed)}`,
    ]
    : [
      `dryRunOnly=${ruleValue(gate?.dryRunOnly === true)}`,
      `providerSubmissionForbidden=${ruleValue(gate?.providerSubmissionForbidden === true)}`,
      "fastModelForbidden=true",
      "vipChannelForbidden=true",
      "textToVideoForbidden=true",
      "noBgm=true",
      "liveSubmitAllowed=false",
    ];
  const blockers = [
    ...(gate?.blockers || []).map((item) => `gate: ${item}`),
    ...(plan?.blockers || []).map((item) => `task: ${item}`),
    ...(gate?.checks || []).filter((check) => check.status === "blocked").map((check) => `${check.label}: ${check.detail}`),
  ];
  const warnings = [
    ...(gate?.warnings || []).map((item) => `gate: ${item}`),
    ...(plan?.warnings || []).map((item) => `task: ${item}`),
    ...(gate?.checks || []).filter((check) => check.status === "warning").map((check) => `${check.label}: ${check.detail}`),
  ];

  return (
    <div className="shot-video-gate-inspector">
      <div className="field-grid compact">
        <label>Gate</label>
        <span>{gate ? `${gate.status} · queue ${gate.canEnterQueueShell ? "prepared" : "blocked"}` : "missing"}</span>
        <label>Task Plan</label>
        <span>{plan ? `${plan.status} · ${plan.providerId} · ${plan.queueStatus}` : "missing"}</span>
        <label>Frames</label>
        <span>{gate ? `start ${gate.startFramePresent ? "present" : "missing"} · end ${gate.endFramePresent ? "present" : "missing"}` : "unknown"}</span>
        <label>Mode</label>
        <span>{plan ? `${plan.providerSlot} / ${plan.requiredMode}` : "video.i2v / frames2video"}</span>
        <label>Pair</label>
        <span>{derivation ? `${derivation.endDerivationSource} · i2v ${derivation.validForI2vPair ? "valid" : "blocked"}` : "not derived"}</span>
        <label>Preserve</label>
        <span>{derivation?.mustPreserve.join(", ") || "none"}</span>
        <label>Preflight</label>
        <span>{preflight ? `${preflight.status} · ${preflight.blockerCount} blockers · ${preflight.warningCount} warnings` : "not available"}</span>
        <label>Manifest</label>
        <span>{manifest ? `${manifest.status} · missing expected ${manifest.missingExpectedOutput ? "true" : "false"}` : "not available"}</span>
        <label>Prompt</label>
        <span>{plan?.promptConstraints.join(", ") || "no bgm provider prompt policy"}</span>
        <label>Motion</label>
        <span>{plan?.motionBrief || "not planned"}</span>
      </div>
      <div className="video-rule-strip">
        {hardRules.map((rule) => (
          <span key={rule}>{rule}</span>
        ))}
      </div>
      <details className="pipeline-shot-details" open={Boolean(blockers.length)}>
        <summary>Blockers ({blockers.length}) / warnings ({warnings.length})</summary>
        <CompactList items={[...blockers, ...warnings]} empty="No shot-specific video blockers or warnings." />
      </details>
      {gate?.checks.length ? (
        <details className="pipeline-shot-details">
          <summary>Gate checks ({gate.checks.length})</summary>
          <CompactList items={gate.checks.map((check) => `${check.status}: ${check.label} · ${check.detail}`)} empty="No gate checks." />
        </details>
      ) : null}
    </div>
  );
}

function InspectorMode({
  audit,
  view,
  runtimeState,
  selectedShot,
  selectedAsset,
}: {
  audit: ProjectAudit;
  view: RuntimeView;
  runtimeState: ProjectRuntimeState;
  selectedShot?: ShotRecord;
  selectedAsset?: AssetRecord;
}) {
  const selectedTasks = selectedShot ? view.taskViews.filter((task) => task.shot?.id === selectedShot.id) : [];
  const primaryTask = selectedTasks.find((task) => task.job.slot === "video.i2v") || selectedTasks[0];
  const relatedIssues = audit.issues.filter((issue) => !selectedShot || issue.target?.includes(selectedShot.id) || issue.type === "provider_policy" || issue.type === "fallback" || issue.type === "missing_output");

  return (
    <div className="inspector-layout">
      <aside className="inspector">
        <div className="panel-title">
          <Clapperboard size={17} />
          <span>Inspector</span>
        </div>
        {selectedShot && (
          <section className="inspector-section">
            <div className="selected-line">Selected {selectedShot.id}</div>
            <h2>{selectedShot.storyFunction}</h2>
            <div className="field-grid">
              <label>Act</label>
              <span>{selectedShot.actId}</span>
              <label>Section</label>
              <span>{selectedShot.sectionId || "none"}</span>
              <label>Status</label>
              <span>{selectedShot.status}</span>
              <label>Video</label>
              <span>{selectedShot.videoPath ? "ready" : "blocked"}</span>
            </div>
            <div className="gate-table">
              {gateNames.map((name) => (
                <div key={name}>
                  <span>{name}</span>
                  <b className={gateClass(selectedShot.gates[name])}>{selectedShot.gates[name]}</b>
                </div>
              ))}
            </div>
          </section>
        )}
        {selectedAsset && (
          <section className="inspector-section">
            <div className="selected-line">Asset {selectedAsset.type}</div>
            <h2>{selectedAsset.name}</h2>
            <div className="field-grid">
              <label>Status</label>
              <span>{selectedAsset.status}</span>
              <label>Lock</label>
              <span>{selectedAsset.lockedStatus}</span>
              <label>Provider</label>
              <span>{selectedAsset.providerId || "unknown"}</span>
            </div>
            <div className="path-list">
              <small>{selectedAsset.path}</small>
            </div>
          </section>
        )}
      </aside>
      <main className="inspector-main">
        <section className="machine-panel">
          <div className="audit-head">
            <Sparkles size={17} />
            <span>Phase 4 Image Pipeline</span>
          </div>
          <ShotImagePipelineSummary runtimeState={runtimeState} selectedShot={selectedShot} />
        </section>
        <section className="machine-panel">
          <div className="audit-head">
            <LockKeyhole size={17} />
            <span>Video Gate</span>
          </div>
          <ShotVideoGateInspector runtimeState={runtimeState} selectedShot={selectedShot} />
        </section>
        <section className="machine-panel">
          <div className="audit-head">
            <FileJson size={17} />
            <span>Video Execution Preview</span>
          </div>
          <ShotExecutionPreviewInspector runtimeState={runtimeState} selectedShot={selectedShot} />
        </section>
        <section className="machine-panel">
          <div className="audit-head">
            <Play size={17} />
            <span>Preview / Export</span>
          </div>
          <ShotPreviewExportSummary previewExport={runtimeState.previewExport} selectedShot={selectedShot} tasks={selectedTasks} />
        </section>
        <section className="machine-panel">
          <div className="audit-head">
            <Radio size={17} />
            <span>Shot Audio Plan</span>
          </div>
          <ShotAudioInspector audioPlanning={runtimeState.audioPlanning} selectedShot={selectedShot} />
        </section>
        <section className="machine-panel">
          <div className="audit-head">
            <ListChecks size={17} />
            <span>Task Runs</span>
          </div>
          <TaskRows tasks={selectedTasks} />
        </section>
        <section className="machine-panel">
          <div className="audit-head">
            <FileJson size={17} />
            <span>Task Envelope Preview</span>
          </div>
          <EnvelopePreview task={primaryTask} />
        </section>
        <section className="machine-panel">
          <div className="audit-head">
            <AlertTriangle size={17} />
            <span>Blocking Reasons</span>
          </div>
          <div className="issue-list">
            {relatedIssues.slice(0, 8).map((issue) => (
              <div key={issue.id} className={issueTone(issue)}>
                <strong>{issue.title}</strong>
                <p>{issue.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
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

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function boolLockLabel(value: boolean) {
  return value ? "allowed" : "false / locked";
}

function AdapterContractDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const contracts: AdapterContractState = runtimeState.adapterContracts;
  const summary = contracts.summary;
  const providerContracts = contracts.providerAdapters;
  const workerContracts = contracts.workerAdapters;
  const lockedProviderCount = providerContracts.filter((adapter) => adapter.providerSubmissionForbidden).length;
  const readOnlyCount = providerContracts.filter((adapter) => adapter.readOnly && adapter.dryRunOnly).length;

  return (
    <section className="machine-panel adapter-contract-diagnostics">
      <div className="audit-head">
        <PlugZap size={17} />
        <span>Adapter Contract Diagnostics</span>
      </div>
      <div className="summary-grid">
        <Metric label="Agent Contracts" value={`${summary.agentAdapters.length}`} detail={summary.agentAdapters.join(", ") || "none"} />
        <Metric label="Worker Contracts" value={`${summary.workerAdapters.length}`} detail={summary.workerAdapters.join(", ") || "none"} />
        <Metric label="Provider Contracts" value={`${summary.providerAdapters.length}`} detail={`${readOnlyCount} read-only dry-run · ${lockedProviderCount} provider locked`} />
        <Metric label="Violations" value={`${summary.contractViolations.length}`} detail="contract validation blockers" />
      </div>
      <div className="adapter-contract-locks video-rule-strip">
        <span>Contract: read-only diagnostics</span>
        <span>Active image provider: {summary.activeImageProvider || "none"}</span>
        <span>Parked video providers: {summary.parkedVideoProviders.join(", ") || "none"}</span>
        <span>liveSubmitAllowed: {boolLockLabel(summary.liveSubmitAllowed)}</span>
        <span>credentialStorage: {String(summary.credentialStorage)}</span>
      </div>
      <div className="adapter-contract-grid">
        <div>
          <h3>Provider Contracts</h3>
          <div className="adapter-contract-list">
            {providerContracts.map((adapter) => (
              <div key={adapter.id} className="adapter-contract-row">
                <div className="row-head">
                  <strong>{adapter.id}</strong>
                  <StatusPill value={adapter.state} />
                </div>
                <div className="field-grid compact">
                  <label>Slot</label>
                  <span>{adapter.slot}</span>
                  <label>requiredModes</label>
                  <span>{adapter.requiredModes.join(", ")}</span>
                  <label>capabilityRefs</label>
                  <span>{adapter.capabilityRefs.length}</span>
                  <label>Contract</label>
                  <span>dryRunOnly {String(adapter.dryRunOnly)} · readOnly {String(adapter.readOnly)}</span>
                  <label>liveSubmitAllowed</label>
                  <span>{boolLockLabel(adapter.liveSubmitAllowed)}</span>
                  <label>Provider</label>
                  <span>{adapter.providerSubmissionForbidden ? "locked / forbidden" : "allowed"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3>Worker Envelope / Context Packet</h3>
          <div className="adapter-contract-list">
            {workerContracts.map((adapter) => (
              <div key={adapter.id} className="adapter-contract-row">
                <div className="row-head">
                  <strong>{adapter.id}</strong>
                  <StatusPill value={adapter.state} />
                </div>
                <div className="field-grid compact">
                  <label>Envelope</label>
                  <span>{adapter.requiredEnvelopeSchema}</span>
                  <label>Context</label>
                  <span>{adapter.mustReceiveContextPacket ? "required" : "optional"}</span>
                  <label>Bypass</label>
                  <span>{adapter.canBypassEnvelope ? "allowed" : "false / locked"}</span>
                  <label>Read</label>
                  <span>{adapter.readScopePolicy}</span>
                  <label>Write</label>
                  <span>{adapter.writeScopePolicy}</span>
                  <label>Modes</label>
                  <span>{adapter.allowedPurposes.join(", ")}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="settings-list adapter-violation-list">
            <div>
              <strong>Contract Violations</strong>
              <small>{summary.contractViolations.length ? `${summary.contractViolations.length} violation(s)` : "none · provider locked · dry-run only"}</small>
            </div>
            {summary.contractViolations.slice(0, 4).map((violation) => (
              <div key={`${violation.adapterId}-${violation.code}`}>
                <strong>{violation.adapterId}</strong>
                <small>{violation.severity} · {statusLabel(violation.code)} · {violation.detail}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ExportWorkerDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildExportWorkerUiSummary(runtimeState);

  return (
    <section className="machine-panel phase27-export-worker-panel">
      <div className="audit-head">
        <FileJson size={17} />
        <span>Export Worker Diagnostics</span>
      </div>
      <div className="summary-grid phase27-metrics">
        <Metric label="Readiness" value={summary.readiness} detail={summary.initialized ? "runtimeState.exportWorker" : "blocked/missing"} />
        <Metric label="Scope" value={summary.scope} detail="export/project IO only" />
        <Metric label="Planned Writes" value={`${summary.plannedWriteCount}`} detail={summary.plannedWriteCount ? "scoped plan entries" : "blocked/missing"} />
        <Metric label="Export Root" value={summary.exportRoot} detail="compact root label" />
      </div>
      <div className="phase27-summary-list">
        <div>
          <strong>Blocked / warnings</strong>
          <small>{summary.blockersWarnings.slice(0, 4).join(" · ")}</small>
        </div>
        <div>
          <strong>Planned writes</strong>
          <small>{summary.plannedWriteSamples.length ? summary.plannedWriteSamples.join(" · ") : "blocked/missing"}</small>
        </div>
      </div>
      <div className="phase27-lock-strip" aria-label="Phase 27 hard locks">
        {summary.hardLocks.slice(0, 8).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}

function AgentCliMockRunnerDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildAgentCliMockRunnerUiSummary(runtimeState);

  return (
    <section className="machine-panel phase26-runner-panel">
      <div className="audit-head">
        <PlugZap size={17} />
        <span>Agent/CLI Mock Runner</span>
      </div>
      <div className="summary-grid phase26-metrics">
        <Metric label="Runner Kind" value={summary.runnerKind} detail={summary.initialized ? "Phase 26 mock/no-op" : "blocked/missing"} />
        <Metric label="Replacement Proof" value={summary.replacementProof} detail="replaceable runner contract" />
        <Metric label="Readiness" value={summary.readiness} detail="ready/blocked only" />
        <Metric label="No-op Results" value={`${summary.noopResultCount}`} detail="structured no-op count" />
      </div>
      <div className="phase26-lock-strip" aria-label="Phase 26 hard locks">
        {summary.hardLocks.slice(0, 8).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}

function CodexCliAdapterSpikeDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildCodexCliAdapterSpikeUiSummary(runtimeState);

  return (
    <section className="machine-panel phase29-codex-adapter-panel">
      <div className="audit-head">
        <PlugZap size={17} />
        <span>Codex CLI Adapter Spike</span>
      </div>
      <div className="summary-grid phase29-metrics">
        <Metric label="Readiness" value={summary.readiness} detail={summary.initialized ? "Phase 29 contract-only" : "blocked/missing"} />
        <Metric label="Contract Mode" value={summary.contractMode} detail="adapter shape only" />
        <Metric label="Replacement Proof" value={summary.replacementProof} detail="Phase 26 required" />
        <Metric label="Input Source" value={summary.inputSource} detail="no free text task" />
        <Metric label="Spawn / Resume" value={summary.spawnResumeShape} detail="not executed" />
        <Metric label="Provider Submit" value={summary.providerSubmit} detail="blocked" />
      </div>
      <div className="phase29-summary-list">
        <div>
          <strong>Boundary</strong>
          <small>{summary.mutationBoundary}</small>
        </div>
        <div>
          <strong>Blocked / warnings</strong>
          <small>{[...summary.blockers, ...summary.warnings].slice(0, 4).join(" · ") || "none"}</small>
        </div>
      </div>
      <div className="phase29-lock-strip" aria-label="Phase 29 Codex CLI Adapter Spike hard locks">
        {summary.hardLocks.slice(0, 8).map((lock) => (
          <span key={lock}>{lock}</span>
        ))}
      </div>
    </section>
  );
}

function SettingsShell({ runtimeState, view }: { runtimeState: ProjectRuntimeState; view: RuntimeView }) {
  const runtime = runtimeState.runtime;
  const config = runtime.config;
  const providerSummary = runtime.providerEnablementSummary;
  const adapterSummary = runtimeState.adapterContracts.summary;
  const tools = runtime.detectionReport.tools;
  const sidecar = config.sidecarPermissions;
  const providerSlots = config.providerEnablement.slots;
  const providerAdapters = config.providerAdapterSettings || [];
  const voiceLibrary = runtimeState.voiceSourceLibrary;
  const voiceSources = voiceLibrary.sources;
  const desktopShell = buildDesktopRuntimeShellView(runtimeState);
  const knowledgeSummary = buildKnowledgeUiSummary(view);
  const agentCliMockRunnerSummary = buildAgentCliMockRunnerUiSummary(runtimeState);
  const codexCliAdapterSpikeSummary = buildCodexCliAdapterSpikeUiSummary(runtimeState);
  const exportWorkerSummary = buildExportWorkerUiSummary(runtimeState);
  const voiceAudioSettingsSummary = buildVoiceAudioSettingsUiSummary(runtimeState);
  const providerEnablementGateSummary = buildProviderEnablementGateUiSummary(runtimeState);
  const providerExecutionPermissionGateSummary = buildProviderExecutionPermissionGateUiSummary(runtimeState);
  const providerActionConfirmationReceiptSummary = buildProviderActionConfirmationReceiptUiSummary(runtimeState);
  const providerExecutionHandoffSummary = buildProviderExecutionHandoffUiSummary(runtimeState);
  const localOrchestratorSummary = buildLocalOrchestratorUiSummary(runtimeState);

  return (
    <section className="machine-panel settings-shell">
      <div className="audit-head">
        <Settings size={17} />
        <span>Settings Shell</span>
      </div>
      <div className="desktop-runtime-shell">
        <div className="row-head">
          <div className="audit-head desktop-runtime-title">
            <LockKeyhole size={16} />
            <span>Desktop Runtime / Permission Shell</span>
          </div>
          <StatusPill value={desktopShell.planStatus} />
        </div>
        <div className="field-grid compact desktop-runtime-grid">
          <label>runtime mode</label>
          <span>{desktopShell.runtimeMode}</span>
          <label>platform/path policy</label>
          <span>{desktopShell.platformPathPolicy}</span>
          <label>project permission scope</label>
          <span>{desktopShell.projectPermissionScope}</span>
          <label>sidecar policy</label>
          <span>{desktopShell.sidecarPolicy}</span>
          <label>credential vault placeholder</label>
          <span>{desktopShell.credentialVault}</span>
        </div>
        <div className="desktop-runtime-locks" aria-label="hard locks summary">
          {desktopShell.hardLocks.map((lock) => (
            <span key={lock}>{lock}</span>
          ))}
        </div>
      </div>
      <div className="field-grid compact runtime-facts">
        <label>Runtime</label>
        <span>{statusLabel(config.runtimeMode)} / {config.platform}</span>
        <label>Root Policy</label>
        <span>{statusLabel(config.projectRootPolicy.strategy)} · mac {config.projectRootPolicy.macPathStyle} · win {config.projectRootPolicy.windowsPathStyle}</span>
        <label>Live Path</label>
        <span>{providerSummary.liveSubmitAllowed ? "allowed" : "blocked"}</span>
        <label>Credentials</label>
        <span>{config.credentialStorage.mode}; secrets stored: {config.credentialStorage.storesSecrets ? "yes" : "no"}</span>
        <label>Contract</label>
        <span>{adapterSummary.providerAdapters.length} provider contract(s) · read-only · dry-run · provider locked</span>
      </div>
      <div className="settings-group-title">Tools</div>
      <div className="settings-list">
        {tools.map((tool) => (
          <div key={tool.id}>
            <strong>{tool.label}</strong>
            <small>{statusLabel(tool.status)}{tool.path ? ` · ${tool.path}` : ""}{tool.version ? ` · ${tool.version}` : ""}</small>
          </div>
        ))}
      </div>
      <div className="settings-group-title">Sidecar Policy</div>
      <div className="settings-list">
        <div>
          <strong>Arbitrary shell</strong>
          <small>{sidecar.arbitraryShellExecution}; {sidecar.providerLiveSubmit} provider live path</small>
        </div>
        <div>
          <strong>Allowed commands</strong>
          <small>{sidecar.allowedCommands.map((command) => command.executable).join(", ") || "none"}</small>
        </div>
        <div>
          <strong>Filesystem scope</strong>
          <small>{sidecar.filesystemScope.map(statusLabel).join(", ")}</small>
        </div>
      </div>
      <div className="settings-group-title">Provider Enablement</div>
      <div className="settings-list">
        {providerSlots.map((slot) => (
          <div key={slot.slot}>
            <strong>{slot.slot}</strong>
            <small>{slot.state} · live path {slot.liveSubmitAllowed ? "allowed" : "blocked"} · {(slot.allowedProviders.length ? slot.allowedProviders : ["planned"]).join(", ")}</small>
          </div>
        ))}
      </div>
      <div className="settings-group-title">Provider Adapter Shell</div>
      <div className="settings-list adapter-settings-list">
        <div className="settings-readonly-note">
          <strong>Adapter Contract Status</strong>
          <small>
            {adapterSummary.activeImageProvider || "no active image provider"} · {adapterSummary.parkedVideoProviders.length} parked video provider(s) · {adapterSummary.contractViolations.length} violation(s)
          </small>
        </div>
        {providerAdapters.map((adapter) => (
          <div key={adapter.id}>
            <strong>{adapter.label}</strong>
            <small>
              {adapter.slot} / {adapter.requiredMode} · {adapter.state} · credentials {adapter.credentialStatus}
            </small>
            <small>
              start/end {String(adapter.supports.startEndFrame)} · t2v {String(adapter.supports.textToVideo)} · fast {String(adapter.supports.fastModel)} · VIP {String(adapter.supports.vipChannel)}
            </small>
          </div>
        ))}
        {!providerAdapters.length && (
          <div>
            <strong>No adapters configured</strong>
            <small>Runtime defaults will provide read-only adapter shells.</small>
          </div>
        )}
      </div>
      <div className="settings-group-title">Knowledge Pack Manager</div>
      <div className="settings-list knowledge-settings-summary">
        <div className="settings-readonly-note">
          <strong>Knowledge Pack Manager readiness: {knowledgeSummary.readiness}</strong>
          <small>{knowledgeSummary.enabledTotal} enabled / total · {knowledgeSummary.injectedUnique} injected / unique</small>
          <small>warnings / blockers {knowledgeSummary.warningBlockerCount} · budget {knowledgeSummary.budgetUsed} tokens</small>
          <small>{knowledgeSummary.hardLockReminder}</small>
        </div>
      </div>
      <div className="settings-group-title">Agent/CLI Mock Runner</div>
      <div className="settings-list agent-cli-settings-summary">
        <div className="settings-readonly-note">
          <strong>Agent/CLI Mock Runner readiness: {agentCliMockRunnerSummary.readiness}</strong>
          <small>{agentCliMockRunnerSummary.runnerKind} · replacement proof {agentCliMockRunnerSummary.replacementProof} · adapter boundary mock/no-op only · {agentCliMockRunnerSummary.noopResultCount} no-op result(s)</small>
        </div>
      </div>
      <div className="settings-group-title">Codex CLI Adapter Spike</div>
      <div className="settings-list codex-cli-adapter-settings-summary">
        <div className="settings-readonly-note">
          <strong>Codex CLI Adapter readiness: {codexCliAdapterSpikeSummary.readiness}</strong>
          <small>{codexCliAdapterSpikeSummary.contractMode} · {codexCliAdapterSpikeSummary.inputSource} · spawn/resume {codexCliAdapterSpikeSummary.spawnResumeShape} · provider submit {codexCliAdapterSpikeSummary.providerSubmit}</small>
        </div>
      </div>
      <div className="settings-group-title">Export Worker</div>
      <div className="settings-list export-worker-settings-summary">
        <div className="settings-readonly-note">
          <strong>Export Worker readiness: {exportWorkerSummary.readiness}</strong>
          <small>export IO scope {exportWorkerSummary.scope} · planned writes {exportWorkerSummary.plannedWriteCount} · root {exportWorkerSummary.exportRoot}</small>
        </div>
      </div>
      <div className="settings-group-title">Voice/Audio Settings</div>
      <div className="settings-list voice-audio-settings-summary">
        <div className="settings-readonly-note">
          <strong>Voice/Audio Settings readiness: {voiceAudioSettingsSummary.readiness}</strong>
          <small>{voiceAudioSettingsSummary.voiceSourceCount} source(s) · {voiceAudioSettingsSummary.audioPlanCount} audio plan(s) · no BGM {voiceAudioSettingsSummary.noBgmPolicy ? "on" : "off"} · provider live {voiceAudioSettingsSummary.providerSlotsLive}</small>
        </div>
      </div>
      <div className="settings-group-title">Provider Enablement Gate</div>
      <div className="settings-list provider-enable-gate-settings-summary">
        <div className="settings-readonly-note">
          <strong>Provider Enablement Gate readiness: {providerEnablementGateSummary.readiness}</strong>
          <small>{providerEnablementGateSummary.readyForConfirmation} ready_for_confirmation · {providerEnablementGateSummary.blocked} blocked · {providerEnablementGateSummary.parked} parked · {providerEnablementGateSummary.submitBlocked}</small>
        </div>
      </div>
      <div className="settings-group-title">Provider Execution Permission Gate</div>
      <div className="settings-list provider-execution-permission-settings-summary">
        <div className="settings-readonly-note">
          <strong>Provider Execution Permission readiness: {providerExecutionPermissionGateSummary.readiness}</strong>
          <small>{providerExecutionPermissionGateSummary.readyForUserReview} reviewable · {providerExecutionPermissionGateSummary.blocked} blocked · {providerExecutionPermissionGateSummary.providerSubmit} · {providerExecutionPermissionGateSummary.automaticSubmit}</small>
        </div>
      </div>
      <div className="settings-group-title">Provider Action Confirmation Receipt</div>
      <div className="settings-list provider-action-confirmation-settings-summary">
        <div className="settings-readonly-note">
          <strong>Provider Action Confirmation readiness: {providerActionConfirmationReceiptSummary.readiness}</strong>
          <small>{providerActionConfirmationReceiptSummary.readyReceipts} ready receipt(s) · {providerActionConfirmationReceiptSummary.blocked} blocked · {providerActionConfirmationReceiptSummary.parked} parked · {providerActionConfirmationReceiptSummary.confirmedCount} confirmed</small>
          <small>{providerActionConfirmationReceiptSummary.providerSubmitBlocked} · {providerActionConfirmationReceiptSummary.credentialWorkerFileLocked}</small>
        </div>
      </div>
      <div className="settings-group-title">Provider Execution Handoff</div>
      <div className="settings-list provider-execution-handoff-settings-summary">
        <div className="settings-readonly-note">
          <strong>Provider Execution Handoff readiness: {providerExecutionHandoffSummary.readiness}</strong>
          <small>{providerExecutionHandoffSummary.handoffCount} handoff(s) · {providerExecutionHandoffSummary.blockedCount} blocked · {providerExecutionHandoffSummary.confirmedCount} confirmed</small>
          <small>{providerExecutionHandoffSummary.providerSubmitLocked} · {providerExecutionHandoffSummary.credentialWorkerFileLocked}</small>
        </div>
      </div>
      <div className="settings-group-title">Local Orchestrator</div>
      <div className="settings-list local-orchestrator-settings-summary">
        <div className="settings-readonly-note">
          <strong>Local Orchestrator: {localOrchestratorSummary.readiness}</strong>
          <small>{localOrchestratorSummary.queueTotal} total · {localOrchestratorSummary.ready} ready · {localOrchestratorSummary.waiting} waiting · next ready {localOrchestratorSummary.nextReadyCount}</small>
          <small>{localOrchestratorSummary.autoContinueMode} · {localOrchestratorSummary.providerFileDaemonLocks}</small>
        </div>
      </div>
      <div className="settings-group-title">Voice Source Library (dry-run)</div>
      <div className="settings-list">
        <div className="settings-readonly-note">
          <strong>{voiceLibrary.summary.locked} locked · {voiceLibrary.summary.candidate} candidate · {voiceLibrary.summary.rejected} rejected</strong>
          <small>No credentials · no sample copy · no TTS/music submit · no BGM in video provider prompts.</small>
        </div>
        {voiceSources.slice(0, 6).map((source) => (
          <div key={source.id}>
            <strong>{source.displayName}</strong>
            <small>
              {source.status} · {statusLabel(source.role)} · {source.provider} · consent {statusLabel(source.consentStatus)} · commercial {statusLabel(source.commercialUseStatus)}
            </small>
          </div>
        ))}
        {voiceSources.length > 6 && (
          <div>
            <strong>{voiceSources.length - 6} more source(s)</strong>
            <small>Hidden here to keep Settings compact.</small>
          </div>
        )}
      </div>
    </section>
  );
}

function SubagentWorkerRuntimeDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const plan = buildSubagentWorkerRuntimeView(runtimeState);
  const visibleSlots = plan.slots.slice(0, 6);

  return (
    <section className="machine-panel">
      <div className="audit-head">
        <ListChecks size={17} />
        <span>Subagent Worker Runtime</span>
      </div>
      <div className="summary-grid">
        <Metric label="Worker Plans" value={`${plan.summary.totalSlots}`} detail={statusLabel(plan.runtimeMode)} />
        <Metric label="Permission Gate" value={`${plan.summary.readyForPermissionGate}`} detail="validated envelopes" />
        <Metric label="Structured Results" value={`${plan.summary.resultAcceptedForHandoff}`} detail={`${plan.summary.resultRejected} rejected`} />
        <Metric label="Free Text" value={`${plan.summary.freeTextBlocked}`} detail="blocked" />
      </div>
      <div className="field-grid compact">
        <label>Spawn</label>
        <span>{plan.summary.canSpawnNow} now · permission gated · validated envelope only</span>
        <label>Project Store</label>
        <span>{plan.summary.canWriteProjectStoreNow} writes now · structured result required</span>
        <label>Provider</label>
        <span>{plan.summary.providerSubmissionForbidden ? "submission forbidden" : "allowed"} · live {String(plan.summary.liveSubmitAllowed)}</span>
      </div>
      <div className="settings-list">
        {visibleSlots.map((slot) => (
          <div key={slot.workerSlotId}>
            <strong>{slot.envelopeId || slot.workerSlotId}</strong>
            <small>{slot.status} · envelope {slot.envelopeValidation.status} · result {slot.resultGate.resultStatus}</small>
          </div>
        ))}
        {!visibleSlots.length && (
          <div>
            <strong>No worker plans</strong>
            <small>Validated SubagentTaskEnvelope packets are required before a worker runtime plan appears.</small>
          </div>
        )}
      </div>
    </section>
  );
}

function buildPhase17ImageKeyframeRuntimeSummary(runtimeState: ProjectRuntimeState): Phase17ImageKeyframeRuntimeSummary {
  const runtimePlan = runtimeState.imageKeyframeRuntime;
  const pipeline = getImagePipeline(runtimeState);
  const filesystemWatcher = getFilesystemWatcherHarness(runtimeState);
  const qaHarness = getQaHarness(runtimeState);
  const references = runtimePlan.assetReferencePlanning.references;
  const derivedFromStart = runtimePlan.image2EndFramePlans.filter((plan) => plan.endDerivation.derivesFrom === "start_frame").length;
  const editRequests = runtimePlan.image2EndFramePlans.filter((plan) => plan.adapterRequestPreview.operation === "image2image").length;
  const liveForbiddenRequests = [...runtimePlan.image2StartFramePlans, ...runtimePlan.image2EndFramePlans]
    .filter((plan) => plan.adapterRequestPreview.submitPolicy.liveSubmitForbidden).length;
  const expectedOutputSignals = pipeline.watcherEvents.filter((event) => (
    event.eventType === "expected_output_detected" ||
    event.eventType === "provider_ready_derivative_detected"
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

function Image2KeyframeRuntimeDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const summary = buildPhase17ImageKeyframeRuntimeSummary(runtimeState);

  return (
    <section className="machine-panel phase17-runtime-panel">
      <div className="audit-head">
        <Sparkles size={17} />
        <span>Image2 Asset + Keyframe Runtime</span>
      </div>
      <div className="summary-grid phase17-metrics">
        <Metric label="Runtime Plan" value={summary.status} detail="Phase 17 Diagnostics only" />
        <Metric label="Image2 Assets" value={`${summary.assetPlanCount}`} detail="reference asset task plans" />
        <Metric label="Keyframe Plans" value={`${summary.startFramePlanCount}/${summary.endFramePlanCount}`} detail="start / end frame plans" />
        <Metric label="Keyframe Pair" value={`${summary.validPairCount}/${summary.pairGateCount}`} detail="valid pair gates" />
        <Metric label="Closed Loop" value={`${summary.closedLoopEvidenceCount}`} detail="watcher, health, QA evidence" />
        <Metric label="Provider Locks" value={`${summary.providerLockCount}`} detail="live submit remains disabled" />
      </div>
      <div className="phase17-loop-grid" aria-label="Phase 17 Image2 runtime closed loop">
        {summary.rows.map((row) => (
          <div key={row.label} className="phase17-loop-row">
            <strong>{row.label}</strong>
            <StatusPill value={row.status} />
            <small>{row.detail}</small>
          </div>
        ))}
      </div>
      <div className="phase17-rule-strip">
        <span>Diagnostics-only runtime summary</span>
        <span>Image2 runtime details stay out of the Director surface</span>
        <span>End-frame derivation must stay tied to the approved start frame</span>
        <span>Provider locks remain active</span>
      </div>
      <div className="pipeline-details checker-details">
        <details open={Boolean(summary.blockers.length)}>
          <summary>Phase 17 blockers ({summary.blockers.length})</summary>
          <CompactList items={summary.blockers} empty="No Phase 17 blockers reported." />
        </details>
        <details>
          <summary>Phase 17 warnings ({summary.warnings.length})</summary>
          <CompactList items={summary.warnings} empty="No Phase 17 warnings reported." />
        </details>
      </div>
    </section>
  );
}

function DiagnosticsMode({
  audit,
  view,
  runtimeState,
}: {
  audit: ProjectAudit;
  view: RuntimeView;
  runtimeState: ProjectRuntimeState;
}) {
  const firstQueueBlocker = view.taskViews.find((task) => task.queueGate.status === "blocked" && task.queueGate.blockers[0])?.queueGate.blockers[0];

  return (
    <div className="diagnostics-layout">
      <ProviderDock audit={audit} />
      <ImagePipelineDiagnostics runtimeState={runtimeState} />
      <GenerationHealthCheckerDiagnostics runtimeState={runtimeState} />
      <PromptConflictCheckerDiagnostics runtimeState={runtimeState} />
      <GenerationHarnessDiagnostics runtimeState={runtimeState} />
      <FilesystemWatcherDiagnostics runtimeState={runtimeState} />
      <CheckpointResumeDiagnostics runtimeState={runtimeState} />
      <QaHarnessDiagnostics runtimeState={runtimeState} />
      <ToolRuntimeHarnessDiagnostics runtimeState={runtimeState} />
      <VideoPlanningDiagnostics runtimeState={runtimeState} />
      <VideoExecutionPreviewDiagnostics runtimeState={runtimeState} />
      <AdapterContractDiagnostics runtimeState={runtimeState} />
      <SubagentWorkerRuntimeDiagnostics runtimeState={runtimeState} />
      <AgentCliMockRunnerDiagnostics runtimeState={runtimeState} />
      <CodexCliAdapterSpikeDiagnostics runtimeState={runtimeState} />
      <ExportWorkerDiagnostics runtimeState={runtimeState} />
      <Image2KeyframeRuntimeDiagnostics runtimeState={runtimeState} />
      <AudioDiagnosticsPanel audioPlanning={runtimeState.audioPlanning} />
      <VoiceAudioSettingsDiagnostics runtimeState={runtimeState} />
      <ProviderEnablementGateDiagnostics runtimeState={runtimeState} />
      <ProviderExecutionPermissionGateDiagnostics runtimeState={runtimeState} />
      <ProviderActionConfirmationReceiptDiagnostics runtimeState={runtimeState} />
      <ProviderExecutionHandoffDiagnostics runtimeState={runtimeState} />
      <LocalOrchestratorDiagnostics runtimeState={runtimeState} />
      <PreviewExportDiagnostics previewExport={runtimeState.previewExport} />
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
      <KnowledgePackManager view={view} />
      <SettingsShell runtimeState={runtimeState} view={view} />
    </div>
  );
}

function App() {
  const [runtimeState, setRuntimeState] = useState<ProjectRuntimeState>(fallbackRuntimeState);
  const [mode, setMode] = useState<UiMode>("director");
  const [directorView, setDirectorView] = useState<DirectorView>("story");
  const [activeSectionId, setActiveSectionId] = useState<string | undefined>();
  const [selectedShotId, setSelectedShotId] = useState("A1_01");
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    async function loadRuntime() {
      try {
        const state = await fetchJson<unknown>("/runtime-state.json");
        const normalized = withRuntimeDefaults(normalizeRuntimeState(state) as ProjectRuntimeState);
        const runtimeReady = {
          ...normalized,
          stateSource: normalized.stateSource || { kind: "runtime-state", label: "runtime-state", path: "/runtime-state.json" },
        } satisfies ProjectRuntimeState;
        assertProjectRuntimeState(runtimeReady);
        if (cancelled) return;
        setRuntimeState(runtimeReady);
        if (runtimeReady.storyFlow?.shots?.[0]) setSelectedShotId(runtimeReady.storyFlow.shots[0].id);
        return;
      } catch (error) {
        console.warn("Runtime-state load failed; falling back to runtime-audit.json.", error);
        // Fall through to the legacy audit file for Phase 3 compatibility.
      }

      try {
        const auditData = await fetchJson<ProjectAudit>("/runtime-audit.json");
        if (cancelled) return;
        const state = buildProjectRuntimeState(auditData, emptyKnowledgeManifest, {
          stateSource: {
            kind: "runtime-audit-fallback",
            label: "runtime-audit fallback",
            path: "/runtime-audit.json",
            note: "Derived in browser from the legacy audit file without bundling the full knowledge manifest.",
            sourceImportedAt: auditData.importedAt,
          },
        });
        setRuntimeState(state);
        if (auditData.shots?.[0]) setSelectedShotId(auditData.shots[0].id);
        return;
      } catch {
        if (cancelled) return;
        setRuntimeState(fallbackRuntimeState);
        if (fallbackRuntimeState.storyFlow.shots[0]) setSelectedShotId(fallbackRuntimeState.storyFlow.shots[0].id);
      }
    }

    loadRuntime();
    return () => {
      cancelled = true;
    };
  }, []);

  const audit = useMemo(() => auditFromProjectRuntimeState(runtimeState), [runtimeState]);
  const view = useMemo(
    () => buildRuntimeViewFromProjectState(runtimeState, { selectedShotId }),
    [runtimeState, selectedShotId],
  );
  const selectedShot = useMemo(() => audit.shots.find((shot) => shot.id === selectedShotId), [audit.shots, selectedShotId]);
  const selectedAsset = useMemo(() => audit.assets.find((asset) => asset.id === selectedAssetId), [audit.assets, selectedAssetId]);
  const blockers = audit.issues.filter((issue) => issue.severity === "blocker");
  const projectPlan = useMemo(() => buildMinimalProjectPlan(runtimeState), [runtimeState]);
  const resolvedActiveSectionId = activeSectionId
    || view.storySections.find((section) => selectedShot && section.shotIds.includes(selectedShot.id))?.id
    || view.storySections[0]?.id;

  useEffect(() => {
    if (!view.storySections.length) return;
    if (!resolvedActiveSectionId || !view.storySections.some((section) => section.id === resolvedActiveSectionId)) {
      setActiveSectionId(view.storySections[0].id);
      return;
    }
    if (activeSectionId !== resolvedActiveSectionId) setActiveSectionId(resolvedActiveSectionId);
  }, [activeSectionId, resolvedActiveSectionId, view.storySections]);

  function openDirectorView(nextView: DirectorView) {
    setMode("director");
    setDirectorView(nextView);
  }

  function openSection(sectionId: string) {
    setMode("director");
    setDirectorView("story");
    setActiveSectionId(sectionId);
    const section = view.storySections.find((item) => item.id === sectionId);
    const firstShotId = section?.shotIds[0];
    if (firstShotId) setSelectedShotId(firstShotId);
  }

  function selectShot(shotId: string) {
    setSelectedShotId(shotId);
    const section = view.storySections.find((item) => item.shotIds.includes(shotId));
    if (section) setActiveSectionId(section.id);
  }

  return (
    <div className={`app-shell minimal-shell ${mode === "director" && directorView === "preview" ? "preview-shell" : ""}`}>
      <MinimalTopNav
        projectTitle={audit.projectTitle}
        projectPlan={projectPlan}
        mode={mode}
        directorView={directorView}
        sections={view.storySections}
        activeSectionId={resolvedActiveSectionId}
        onOpenDirectorView={openDirectorView}
        onOpenSection={openSection}
        onOpenDiagnostics={() => setMode("diagnostics")}
      />

      {mode !== "director" && (
        <section className="overview">
          <Metric label="Story Flow" value={`${audit.shots.length}`} detail={`${view.storySections.length} section(s)`} />
          <Metric label="Visual Memory" value={`${view.visualMemory.existing}/${view.visualMemory.total || audit.metrics.expectedAssets}`} detail="real assets indexed" />
          <Metric label="Queue" value={`${view.queueSummary.ready}/${view.queueSummary.total}`} detail={`${view.queueSummary.blocked} blocked · ${view.queueSummary.parked} parked`} />
          <Metric label="Blockers" value={`${blockers.length + view.preflightSummary.blocked}`} detail={view.nextStep} />
        </section>
      )}

      {mode !== "director" && audit.workflow.length > 0 && <Workflow stages={audit.workflow} />}

      {mode === "director" && (
        <DirectorMode
          audit={audit}
          view={view}
          runtimeState={runtimeState}
          selectedShot={selectedShot}
          selectedAsset={selectedAsset}
          selectedShotId={selectedShotId}
          selectedAssetId={selectedAssetId}
          directorView={directorView}
          activeSectionId={resolvedActiveSectionId}
          onSelectShot={selectShot}
          onSelectAsset={setSelectedAssetId}
        />
      )}
      {mode === "inspector" && <InspectorMode audit={audit} view={view} runtimeState={runtimeState} selectedShot={selectedShot} selectedAsset={selectedAsset} />}
      {mode === "diagnostics" && <DiagnosticsMode audit={audit} view={view} runtimeState={runtimeState} />}

      {mode !== "director" && (
        <footer className="policy-note">
          <LockKeyhole size={16} />
          <span>Hard lock: provider policy, preflight, reference authority, keyframe pair derivation, and QA gates cannot be overridden by Knowledge Packs or natural-language input.</span>
        </footer>
      )}
    </div>
  );
}

export default App;
