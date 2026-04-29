import { useEffect, useMemo, useState } from "react";
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
  Search,
  Send,
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
  ReflowImpactReport,
  ShotRecord,
  StoryChangeTransaction,
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
import { ensureRuntimeEnvironment } from "./core/runtimeConfig";
import {
  buildReflowImpactReport,
  buildStoryChangeTransaction,
  describeReflowImpact,
} from "./core/storyChange";
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
  requireArray(audioPlanning, "providerSlots", issues);
  requireArray(audioPlanning, "notes", issues);
  requireArray(videoPlanning, "readinessGates", issues);
  requireArray(videoPlanning, "taskPlans", issues);
  requireArray(videoPlanning, "notes", issues);
  requireArray(adapterContracts, "agentAdapters", issues);
  requireArray(adapterContracts, "workerAdapters", issues);
  requireArray(adapterContracts, "providerAdapters", issues);
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
      requireArray(preview, "hardLocks", issues);
      requireArray(preview, "executionOrderPreview", issues);
      requireArray(preview, "blockers", issues);
      requireArray(preview, "warnings", issues);
      requireArray(packet, "requiredReadScopes", issues);
      requireArray(packet, "forbiddenReadScopes", issues);
      if (typeof preview.shotId !== "string") issues.push(`videoExecutionPreview.previews.${index}.shotId`);
      if (typeof preview.status !== "string") issues.push(`videoExecutionPreview.previews.${index}.status`);
      if (typeof preview.canPreviewPacket !== "boolean") issues.push(`videoExecutionPreview.previews.${index}.canPreviewPacket`);
      if (preview.canExecute !== false) issues.push(`videoExecutionPreview.previews.${index}.canExecute`);
      if (preview.dryRunOnly !== true) issues.push(`videoExecutionPreview.previews.${index}.dryRunOnly`);
      if (preview.providerSubmissionForbidden !== true) issues.push(`videoExecutionPreview.previews.${index}.providerSubmissionForbidden`);
      if (preview.liveSubmitAllowed !== false) issues.push(`videoExecutionPreview.previews.${index}.liveSubmitAllowed`);
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
  if (Array.isArray(adapterContractSummary.contractViolations) && adapterContractSummary.contractViolations.length > 0) {
    issues.push("adapterContracts.summary.contractViolations");
  }
  if (Array.isArray(adapterContracts.workerAdapters)) {
    adapterContracts.workerAdapters.forEach((adapter, index) => {
      if (!isRecord(adapter)) {
        issues.push(`adapterContracts.workerAdapters.${index}`);
        return;
      }
      if (adapter.requiredEnvelopeSchema !== "subagent_task_envelope.schema.json") issues.push(`adapterContracts.workerAdapters.${index}.requiredEnvelopeSchema`);
      if (adapter.mustReceiveContextPacket !== true) issues.push(`adapterContracts.workerAdapters.${index}.mustReceiveContextPacket`);
      if (adapter.canBypassEnvelope !== false) issues.push(`adapterContracts.workerAdapters.${index}.canBypassEnvelope`);
      if (adapter.liveSubmitAllowed !== false) issues.push(`adapterContracts.workerAdapters.${index}.liveSubmitAllowed`);
      if (adapter.credentialStorage !== false) issues.push(`adapterContracts.workerAdapters.${index}.credentialStorage`);
    });
  }
  if (Array.isArray(adapterContracts.providerAdapters)) {
    const providerAdapterIds = adapterContracts.providerAdapters
      .filter((adapter): adapter is Record<string, unknown> => isRecord(adapter))
      .map((adapter) => adapter.id);
    for (const requiredId of ["image2-provider", "image2-edit-provider", "image2-reference-asset-provider", "seedance2-provider", "jimeng-video"]) {
      if (!providerAdapterIds.includes(requiredId)) issues.push(`adapterContracts.providerAdapters.${requiredId}`);
    }
    adapterContracts.providerAdapters.forEach((adapter, index) => {
      if (!isRecord(adapter)) {
        issues.push(`adapterContracts.providerAdapters.${index}`);
        return;
      }
      if (adapter.dryRunOnly !== true) issues.push(`adapterContracts.providerAdapters.${index}.dryRunOnly`);
      if (adapter.readOnly !== true) issues.push(`adapterContracts.providerAdapters.${index}.readOnly`);
      if (adapter.liveSubmitAllowed !== false) issues.push(`adapterContracts.providerAdapters.${index}.liveSubmitAllowed`);
      if (adapter.credentialStorage !== false) issues.push(`adapterContracts.providerAdapters.${index}.credentialStorage`);
      if (adapter.providerSubmissionForbidden !== true) issues.push(`adapterContracts.providerAdapters.${index}.providerSubmissionForbidden`);
      if (adapter.arbitraryProviderCommandAllowed !== false) issues.push(`adapterContracts.providerAdapters.${index}.arbitraryProviderCommandAllowed`);
      if ((adapter.id === "seedance2-provider" || adapter.id === "jimeng-video") && adapter.state !== "parked") {
        issues.push(`adapterContracts.providerAdapters.${index}.state`);
      }
      if (adapter.id === "image2-provider" && (adapter.state !== "active" || adapter.slot !== "image.generate")) {
        issues.push(`adapterContracts.providerAdapters.${index}.image2Generate`);
      }
      if (adapter.id === "image2-edit-provider" && (adapter.state !== "active" || adapter.slot !== "image.edit")) {
        issues.push(`adapterContracts.providerAdapters.${index}.image2Edit`);
      }
    });
  }

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
const requiredVideoExecutionHardLocks = [
  "no_live_submit",
  "no_fast_model",
  "no_vip_channel",
  "no_text_to_video_main_path",
  "no_bgm_in_video_prompt",
  "start_end_frames_required",
  "subagent_must_use_packet",
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
            <small>Packet {preview.canPreviewPacket ? "previewable" : "blocked"} · canExecute {String(preview.canExecute)}</small>
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
      <div className="contact-strip">
        <div>
          <h3>Asset Contact Sheet</h3>
          {audit.contactSheets.assets ? <img src={audit.contactSheets.assets} alt="Asset contact sheet" /> : <div className="empty-media">No asset contact sheet</div>}
        </div>
        <div>
          <h3>Keyframe Contact Sheet</h3>
          {audit.contactSheets.keyframes ? <img src={audit.contactSheets.keyframes} alt="Keyframe contact sheet" /> : <div className="empty-media">No keyframe contact sheet</div>}
        </div>
      </div>
    </main>
  );
}

interface DirectorDryRunResult {
  transaction: StoryChangeTransaction;
  report: ReflowImpactReport;
  summary: string;
}

function formatPlanStep(step: ReflowImpactReport["regenerationPlan"][number]) {
  const label = step.step.replace(/_/g, " ");
  const targets = step.targetIds.length ? step.targetIds.slice(0, 3).join(", ") : "project";
  const overflow = step.targetIds.length > 3 ? ` +${step.targetIds.length - 3}` : "";
  return `${label}: ${targets}${overflow}`;
}

function DirectorInput({
  runtimeState,
  shot,
  asset,
  nextStep,
}: {
  runtimeState: ProjectRuntimeState;
  shot?: ShotRecord;
  asset?: AssetRecord;
  nextStep: string;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("No change plan generated yet");
  const [dryRun, setDryRun] = useState<DirectorDryRunResult | undefined>();
  const selectedContext = shot ? `${shot.id} · ${shot.storyFunction}` : asset ? `${asset.type} · ${asset.name}` : "Project";
  const understanding = shot
    ? `System sees ${shot.status}; video ${shot.videoPath ? "present" : "missing"}; pair gate ${shot.gates.pair}.`
    : asset
      ? `System sees ${asset.status}; reference lock ${asset.lockedStatus}; future reference ${asset.safeForFutureReference ? "allowed" : "not approved"}.`
      : "System is scoped to the whole project.";
  const previewDisabled = !text.trim();

  function previewChangePlan() {
    const userIntent = text.trim();
    if (!userIntent) {
      setStatus("Add a natural-language change before previewing.");
      return;
    }

    const targetIds = [shot?.id, asset?.id].filter((id): id is string => Boolean(id));
    const transaction = buildStoryChangeTransaction({
      userIntent,
      targetIds,
      context: {
        selectedShotId: shot?.id,
        selectedSectionId: shot?.sectionId || shot?.actId,
        knownAssetIds: runtimeState.visualMemory.assets.map((item) => item.id),
        knownCharacterIds: runtimeState.visualMemory.assets.filter((item) => item.type === "character").map((item) => item.id),
        knownSceneIds: runtimeState.visualMemory.assets.filter((item) => item.type === "scene").map((item) => item.id),
      },
    });
    const report = buildReflowImpactReport(transaction, runtimeState);
    setDryRun({ transaction, report, summary: describeReflowImpact(report) });
    setStatus("Preview only. No project files changed and no provider task was submitted.");
  }

  return (
    <div className="director-input">
      <div className="input-header">
        <Sparkles size={16} />
        <span>Director Input</span>
      </div>
      <div className="context-chip">
        <span>Selected</span>
        <strong>{selectedContext}</strong>
        <small>{understanding}</small>
        <small>{nextStep}</small>
      </div>
      <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Describe a change in natural language. This will preview a local dry-run plan only." />
      <button
        disabled={previewDisabled}
        onClick={previewChangePlan}
      >
        <Send size={15} />
        Preview Change Plan
      </button>
      <small>{status}</small>
      {dryRun && (
        <section className="change-plan">
          <div className="change-plan-head">
            <span>Change Plan</span>
            <StatusPill value={dryRun.transaction.status} />
          </div>
          <div className="field-grid compact">
            <label>Transaction</label>
            <span>{dryRun.transaction.id}</span>
            <label>Operation</label>
            <span>{dryRun.transaction.operation}</span>
            <label>Intent</label>
            <span>{dryRun.transaction.intentType}</span>
            <label>Scope</label>
            <span>{dryRun.transaction.impactScope}</span>
            <label>Confirm</label>
            <span>{dryRun.transaction.requiresUserConfirmation ? "required" : "not required"}</span>
            <label>Stale</label>
            <span>{dryRun.report.staleArtifactIds.length} artifact(s)</span>
          </div>
          <p>{dryRun.summary}</p>
          {dryRun.transaction.confirmationReasons.length > 0 && (
            <div className="change-plan-note">
              {dryRun.transaction.confirmationReasons.slice(0, 2).map((reason) => (
                <small key={reason}>{reason}</small>
              ))}
            </div>
          )}
          <div className="plan-list">
            {dryRun.report.regenerationPlan.slice(0, 4).map((step) => (
              <small key={`${step.step}-${step.targetIds.join("-")}`}>{formatPlanStep(step)}</small>
            ))}
            {!dryRun.report.regenerationPlan.length && <small>No regeneration steps resolved for this dry run.</small>}
          </div>
          <small className="forbidden-actions">Forbidden: {dryRun.report.forbiddenActions.join(", ")}</small>
        </section>
      )}
    </div>
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
  onSelectShot: (id: string) => void;
  onSelectAsset: (id: string) => void;
}) {
  const selectedShotBlocker = selectedShot
    ? view.taskViews.find((task) => task.shot?.id === selectedShot.id && task.queueGate.status === "blocked" && task.queueGate.blockers[0])?.queueGate.blockers[0]
    : undefined;
  const firstQueueBlocker = view.taskViews.find((task) => task.queueGate.status === "blocked" && task.queueGate.blockers[0])?.queueGate.blockers[0];
  const blockingReason = selectedShotBlocker
    || firstQueueBlocker
    || view.preflightSummary.blockers[0]?.messageForUser
    || "No preflight blocker in the selected runtime view.";

  return (
    <>
      <section className="director-brief">
        <div>
          <h2>Next Step</h2>
          <p>{view.nextStep}</p>
        </div>
        <div>
          <h2>Queue</h2>
          <p>{view.queueSummary.ready} ready · {view.queueSummary.blocked} blocked · {view.queueSummary.parked} parked</p>
        </div>
        <div>
          <h2>Blocking Reason</h2>
          <p>{blockingReason}</p>
        </div>
      </section>
      <div className="director-layout">
        <VisualMemoryPanel audit={audit} view={view} selectedAsset={selectedAssetId} onSelectAsset={onSelectAsset} />
        <StoryWorkspace audit={audit} view={view} selectedShotId={selectedShotId} onSelectShot={onSelectShot} />
        <div className="director-side">
          <PreviewTimeline view={view} previewExport={runtimeState.previewExport} selectedShotId={selectedShotId} onSelectShot={onSelectShot} />
          <VideoPlanningSummaryStrip runtimeState={runtimeState} selectedShot={selectedShot} />
          <AudioPlanSummaryStrip audioPlanning={runtimeState.audioPlanning} selectedShot={selectedShot} />
          <ExportProfilesPanel previewExport={runtimeState.previewExport} />
          <DirectorInput runtimeState={runtimeState} shot={selectedShot} asset={selectedAsset} nextStep={view.nextStep} />
        </div>
      </div>
    </>
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

function KnowledgePackManager({ view, intent, onIntentChange }: { view: RuntimeView; intent: string; onIntentChange: (value: string) => void }) {
  const routeTest = view.knowledge.routeTest;
  return (
    <section className="machine-panel knowledge-manager">
      <div className="audit-head">
        <Database size={17} />
        <span>Knowledge Pack Manager</span>
      </div>
      <div className="summary-grid">
        <Metric label="Packs" value={`${view.knowledge.enabledCount}/${view.knowledge.packCount}`} detail="enabled / total" />
        <Metric label="Categories" value={`${view.knowledge.categories.length}`} detail="manifest categories" />
        <Metric label="Manifest" value={view.knowledge.manifestVersion} detail={view.knowledge.manifestHash} />
      </div>
      <div className="category-strip">
        {view.knowledge.categories.map((item) => (
          <span key={item.category}>{item.category}: {item.enabled}/{item.count}</span>
        ))}
      </div>
      <div className="route-tester">
        <Search size={16} />
        <input value={intent} onChange={(event) => onIntentChange(event.target.value)} placeholder="Test route: e.g. 这一镜头更压抑，慢慢推近角色" />
      </div>
      {routeTest && (
        <div className="route-results">
          <small>consumer / pack / snippet / score</small>
          {routeTest.routeResult.matches.slice(0, 8).map((match) => (
            <div key={match.packId}>
              <span>{match.consumer}</span>
              <strong>{match.packId}</strong>
              <small>{match.matchedSnippetIds.join(", ") || "summary"} · {match.score}</small>
            </div>
          ))}
          <p>Budget: {routeTest.contextBudget.usedTokens}/{routeTest.contextBudget.maxInjectionTokens} tokens</p>
        </div>
      )}
    </section>
  );
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function SettingsShell({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const runtime = runtimeState.runtime;
  const config = runtime.config;
  const providerSummary = runtime.providerEnablementSummary;
  const tools = runtime.detectionReport.tools;
  const sidecar = config.sidecarPermissions;
  const providerSlots = config.providerEnablement.slots;
  const providerAdapters = config.providerAdapterSettings || [];
  const voiceSources = config.voiceSources;

  return (
    <section className="machine-panel settings-shell">
      <div className="audit-head">
        <Settings size={17} />
        <span>Settings Shell</span>
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
      <div className="settings-group-title">Voice Sources (planned)</div>
      <div className="settings-list">
        <div className="settings-readonly-note">
          <strong>Read-only registry</strong>
          <small>No credentials stored · no live path · no API key input in Phase 6.</small>
        </div>
        {voiceSources.map((source) => (
          <div key={source.id}>
            <strong>{source.label}</strong>
            <small>{source.status} · {statusLabel(source.kind)} · planned only</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function DiagnosticsMode({
  audit,
  view,
  runtimeState,
  intent,
  onIntentChange,
}: {
  audit: ProjectAudit;
  view: RuntimeView;
  runtimeState: ProjectRuntimeState;
  intent: string;
  onIntentChange: (value: string) => void;
}) {
  const firstQueueBlocker = view.taskViews.find((task) => task.queueGate.status === "blocked" && task.queueGate.blockers[0])?.queueGate.blockers[0];

  return (
    <div className="diagnostics-layout">
      <ProviderDock audit={audit} />
      <ImagePipelineDiagnostics runtimeState={runtimeState} />
      <VideoPlanningDiagnostics runtimeState={runtimeState} />
      <VideoExecutionPreviewDiagnostics runtimeState={runtimeState} />
      <AudioDiagnosticsPanel audioPlanning={runtimeState.audioPlanning} />
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
      <KnowledgePackManager view={view} intent={intent} onIntentChange={onIntentChange} />
      <SettingsShell runtimeState={runtimeState} />
    </div>
  );
}

function App() {
  const [runtimeState, setRuntimeState] = useState<ProjectRuntimeState>(fallbackRuntimeState);
  const [mode, setMode] = useState<UiMode>("director");
  const [selectedShotId, setSelectedShotId] = useState("A1_01");
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();
  const [knowledgeIntent, setKnowledgeIntent] = useState("这一镜头更压抑一点，慢慢推近角色");

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
      } catch {
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
    () => buildRuntimeViewFromProjectState(runtimeState, { selectedShotId, knowledgeTestIntent: knowledgeIntent }),
    [runtimeState, selectedShotId, knowledgeIntent],
  );
  const selectedShot = useMemo(() => audit.shots.find((shot) => shot.id === selectedShotId), [audit.shots, selectedShotId]);
  const selectedAsset = useMemo(() => audit.assets.find((asset) => asset.id === selectedAssetId), [audit.assets, selectedAssetId]);
  const blockers = audit.issues.filter((issue) => issue.severity === "blocker");

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="mark">VC</div>
          <div>
            <h1>Vibe Core</h1>
            <p>{audit.projectTitle} · {audit.state}</p>
          </div>
        </div>
        <div className="mode-switch">
          {(["director", "inspector", "diagnostics"] as const).map((item) => (
            <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>
              {item === "director" && <Eye size={16} />}
              {item === "inspector" && <FileJson size={16} />}
              {item === "diagnostics" && <Wrench size={16} />}
              {item}
            </button>
          ))}
        </div>
        <div className="top-actions">
          <span className="state-source">
            <Database size={15} />
            {view.stateSource?.label || "runtime-state"}
          </span>
          <button><FileJson size={16} /> Import Runtime Test</button>
          <button><Gauge size={16} /> Dry Check</button>
          <button disabled><Play size={16} /> Provider Locked</button>
        </div>
      </header>

      <section className="overview">
        <Metric label="Story Flow" value={`${audit.shots.length}`} detail={`${view.storySections.length} section(s)`} />
        <Metric label="Visual Memory" value={`${view.visualMemory.existing}/${view.visualMemory.total || audit.metrics.expectedAssets}`} detail="real assets indexed" />
        <Metric label="Queue" value={`${view.queueSummary.ready}/${view.queueSummary.total}`} detail={`${view.queueSummary.blocked} blocked · ${view.queueSummary.parked} parked`} />
        <Metric label="Blockers" value={`${blockers.length + view.preflightSummary.blocked}`} detail={view.nextStep} />
      </section>

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
          onSelectShot={setSelectedShotId}
          onSelectAsset={setSelectedAssetId}
        />
      )}
      {mode === "inspector" && <InspectorMode audit={audit} view={view} runtimeState={runtimeState} selectedShot={selectedShot} selectedAsset={selectedAsset} />}
      {mode === "diagnostics" && <DiagnosticsMode audit={audit} view={view} runtimeState={runtimeState} intent={knowledgeIntent} onIntentChange={setKnowledgeIntent} />}

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
