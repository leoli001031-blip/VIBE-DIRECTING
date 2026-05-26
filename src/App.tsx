{/* Review: dynamic content regions (preview status, agent panel updates, etc.) should use aria-live for screen reader announcements */}
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
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
import { buildSubagentWorkerRuntimePlan, type SubagentWorkerRuntimePlan } from "./core/subagentWorkerRuntime";
import { ensureRuntimeEnvironment } from "./core/runtimeConfig";
import { buildMinimalRuntimeProjection, type MinimalRuntimeProjection } from "./core/minimalRuntimeProjection";
import {
  buildNewVideoProjectVibeStagedTransaction,
  commitNewVideoProjectVibeStagedTransaction,
  type NewVideoProjectVibeStagedTransactionPreview,
} from "./core/newVideoProjectVibePlanner";
import { bindNewVideoAudioReferenceToRuntimeState } from "./core/newVideoAudioReferenceBinding";
import { buildAudioPlanningState } from "./core/audioPlanning";
import {
  applyDialogueAudioMaterialToRuntimeState,
  buildDialogueAudioMaterialProjectVibeTransaction,
} from "./core/dialogueAudioMaterial";
import { buildVoiceAudioSettingsState } from "./core/voiceAudioSettings";
import {
  toRuntimeVoiceSources,
  updateVoiceSource,
} from "./core/voiceSourceLibrary";
import {
  addAssetLibraryAsset,
  markAssetLibraryAssetStatus,
  toVisualMemoryDocument,
  updateAssetLibraryAsset,
  type AddAssetLibraryAssetInput,
  type AssetLibrarySnapshot,
  type UpdateAssetLibraryAssetInput,
} from "./core/assetLibraryCrud";
import {
  createProjectStoreSnapshot,
  saveProjectStoreSnapshot,
} from "./core/projectStore";
import {
  buildProjectStoreIoGate,
  type ProjectStoreIoGate,
} from "./core/projectStoreIo";
import type { ProjectFactsStagedApplyPlan } from "./core/projectTransaction";
import {
  buildMissingPreviewQueueFromShots,
  type PreviewQueueItem,
} from "./core/previewPlayerQueue";
import type { DirectorFeedbackRecompileResult } from "./core/directorFeedbackRecompile";
import {
  applyDirectorFeedbackRecompileToProjectVibe,
  buildProjectVibeStoryboardPlannerInput,
} from "./core/directorFeedbackProjectVibe";
import { runDirectorPrototypeClosedLoop } from "./agent/directorPrototypeLoop";
import {
  applyProjectVibeTransaction,
  buildProjectRuntimeStateFromProjectVibe,
  confirmProjectVibeCreativeLoop,
  createProjectVibe,
  refreshProjectVibeSourceIndex,
  type ProjectVibeAssetKind,
  type ProjectVibeDocument,
} from "./project";
import { buildProviderReviewPromotionTransaction } from "./core/providerReviewPromotion";
import {
  forgetBrowserProjectVibeDraft,
  openProjectVibeDraft,
  projectVibeDraftTargetId as buildProjectVibeDraftTargetId,
  saveProjectVibeDraft,
  type ProjectVibeDraftTarget,
} from "./project/projectVibeDraftStore";
import {
  canCreateLocalProject as canCreateLocalProjectDialog,
  canChooseProjectRoot as canChooseProjectRootDialog,
  canRememberProjectRoot as canRememberProjectRootDialog,
  chooseProjectRoot,
  createLocalProject,
  rememberProjectRoot,
  type ProjectRootDialogSelection,
} from "./project/projectRootDialog";
import { buildCurrentProjectPreviewProjection } from "./core/currentProjectPreviewProjection";
import { loadProjectRealChainStatus } from "./core/projectCurrentRuntimeClient";
import { submitCurrentProjectReviewDecision } from "./core/projectReviewDecisionClient";
import { markCurrentProjectAssetStatus } from "./core/projectAssetStatusClient";
import {
  loadAgentWebSearchSettings,
  saveAgentWebSearchSettings,
  type AgentWebSearchResult,
  type AgentWebSearchSettings,
} from "./core/agentWebSearchClient";
import {
  buildProjectLocalKnowledgeManifest,
  buildProjectLocalKnowledgePackFromWebSearch,
  buildProjectLocalKnowledgeReferenceStagedTransaction,
  commitProjectLocalKnowledgeReferenceStagedTransaction,
  loadProjectLocalKnowledgePacks,
  openProjectLocalKnowledgePacks,
  saveProjectLocalKnowledgePack,
} from "./core/projectLocalKnowledge";
import type { KnowledgePack } from "./core/knowledgeTypes";
import { runExportAction, type ExportActionState } from "./core/exportAction";
import { buildLocalPreviewExportProjection } from "./core/localPreviewExportProjection";
import {
  applyCurrentProjectWorkbenchProjectionToRuntimeState,
  buildCurrentProjectWorkbenchProjection,
} from "./core/currentProjectWorkbenchProjection";
import { applyPreRealTestClosure } from "./core/preRealTestClosure";
import {
  buildRealImage2GateState,
  lockRealImage2Gate,
  promoteRealImage2Artifact,
  realImage2GateCanGenerate,
  realImage2GatePromotionReady,
  startRealImage2Generation,
  unlockRealImage2Gate,
  type RealImage2GateState,
} from "./core/realImage2Gate";
import { formatShotNumber } from "./ui/director/MinimalStoryFlow";
import { MinimalTopNav } from "./ui/director/MinimalTopNav";
import { MinimalDirectorStatusDot } from "./ui/director/MinimalDirectorStatusDot";
import {
  DirectorProgressStrip,
  buildDirectorProgressStripState,
} from "./ui/director/DirectorProgressStrip";
import { DirectorMode } from "./ui/director/DirectorModeShell";
import { MinimalAssetLibrary } from "./ui/director/MinimalAssetLibrary";
import type {
  AssetLibraryUiStatus,
  DirectorView,
  MinimalProjectPlan,
} from "./ui/director/directorTypes";
import type { CreatorReviewLockTarget, CreatorReviewTrayItem } from "./ui/director/creatorDeskTypes";
import type {
  PrototypeAgentDemoRun,
  PreviewPrototypeAgentDemoInput,
} from "./ui/director/agentPanelProjection";
import type { NewVideoStartConfirmationContext, NewVideoStartDraft } from "./ui/director/NewVideoStart";
import type { MinimalAudioPlanDialogueAudioCreated } from "./ui/director/MinimalAudioPlan";
import { uiStatusToAssetLibraryStatus } from "./ui/director/assetLibraryUi";
import {
  createAssetLibraryFromCurrentProjectWorkbench,
  createAssetLibraryFromRuntimeState,
  createProjectVibeFromRuntimeState,
  syncRuntimeStateWithAssetLibrary,
} from "./ui/app/projectRuntimeProjections";
import {
  projectFileSelectionDetail,
  projectFileSelectionLabel,
  prototypeProjectDraftStorageKey,
  type ProjectFileSelectionStatus,
} from "./ui/app/projectFileUi";
import { buildCreatorDeskProjection } from "./ui/app/creatorDeskProjection";
import { useCurrentProjectRuntimePanels } from "./ui/app/useCurrentProjectRuntimePanels";
import { useImage2AssetGenerationAction } from "./ui/director/useImage2AssetGenerationAction";
import { useImage2EndFrameAction } from "./ui/director/useImage2EndFrameAction";
import { useSeedanceVideoSubmitAction } from "./ui/director/useSeedanceVideoSubmitAction";
import { AppOverview } from "./ui/common/AppOverview";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { CompactList, Metric, StatusPill, statusLabel } from "./ui/common/DiagnosticsPrimitives";
import type { ProjectFactsUiMode, ProjectFactsUiSummary } from "./ui/diagnostics/ProjectFactsStrip";
import {
  buildLocalOrchestratorUiSummary,
  firstMotionEndpointNotice,
  getImagePipeline,
  getVideoExecutionPreview,
  getVideoPlanning,
  motionContractSummaryForGate,
  type RealPilotUiSummary,
  type VideoExecutionPreviewRow,
} from "./ui/app/runtimeStatusProjection";
import { fallbackAudit } from "./data/fallbackAudit";

const InspectorMode = lazy(() =>
  import("./ui/inspector/InspectorModeShell").then(({ InspectorMode }) => ({
    default: InspectorMode,
  })),
);
const DiagnosticsMode = lazy(() =>
  import("./ui/diagnostics/DiagnosticsMode").then(({ DiagnosticsMode }) => ({
    default: DiagnosticsMode,
  })),
);

export const gateNames = ["identity", "scene", "pair", "story", "prop", "style"] as const;
const startupAudit: ProjectAudit = {
  ...fallbackAudit,
  projectTitle: "新视频项目",
  projectRoot: "",
  sourceTask: "",
  state: "empty_project",
  metrics: {
    expectedAssets: 0,
    existingAssets: 0,
    expectedKeyframes: 0,
    existingKeyframes: 0,
    expectedVideos: 0,
    existingVideos: 0,
    providerEvents: 0,
    dreaminaImageEvents: 0,
    forbiddenFallbackEvents: 0,
  },
  workflow: [],
  assets: [],
  shots: [],
  jobs: [],
  issues: [],
};
const fallbackRuntimeState = buildProjectRuntimeState(startupAudit, emptyKnowledgeManifest, {
  stateSource: {
    kind: "fallback-audit",
    label: "empty startup",
    note: "No project is selected yet.",
  },
});

export function gateClass(value: string) {
  if (value === "PASS") return "gate pass";
  if (value === "PARTIAL") return "gate partial";
  if (value === "FAIL") return "gate fail";
  if (value === "N/A") return "gate muted";
  return "gate unknown";
}

export function issueTone(issue: AuditIssue) {
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

function safeProjectVibeId(value: string, fallback: string) {
  const safe = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);
  return safe || fallback;
}

function reviewLockAssetKind(target: CreatorReviewLockTarget): ProjectVibeAssetKind {
  if (target === "character" || target === "scene" || target === "prop") return target;
  return "reference";
}

function reviewLockTargetLabel(target: CreatorReviewLockTarget) {
  if (target === "character") return "角色参考";
  if (target === "scene") return "场景参考";
  if (target === "prop") return "道具参考";
  return "本镜头参考";
}

function cleanReviewItemProjectLabel(label: string) {
  return label
    .replace(/\s*[·•]\s*(待复核|待补齐|可重试|已通过|已锁定)\s*$/u, "")
    .trim() || label.trim();
}

function cleanProjectDisplayNameCandidate(value?: string) {
  const cleaned = value
    ?.trim()
    .replace(/^[#\s]+/u, "")
    .replace(/^[:：\-\s]+/u, "")
    .replace(/[。；;，,]\s*$/u, "")
    .replace(/^《(.{1,64})》$/u, "$1")
    .replace(/^["“「『](.{1,64})["”」』]$/u, "$1")
    .trim();
  return cleaned || undefined;
}

function looksLikeProjectInstruction(value?: string) {
  const text = value?.trim() || "";
  if (!text) return true;
  if (text.length > 64) return true;
  return /^(请|先|帮我|我要|我想|不要|不用|直接|测试|做一个|来一个|生成|跑一轮|开始|确认|上传|参考|风格|脚本|主题|要求)/u.test(text)
    || /(?:不要|不用|先不要|测试|真实生图|提交视频|项目|脚本|参考|分镜|镜头|风格|音频|音乐|素材|AI|Agent|Seedance|Image2|生图|生视频)/iu.test(text);
}

function explicitProjectTitleFromScript(script?: string) {
  const source = script?.slice(0, 1600) || "";
  const titleLabelPattern = /(?:^|[\n\r\s])(?:标题|片名|故事名|项目名|作品名|Title)\s*[:：]\s*(?:《([^》\n]{1,64})》|["“「『]([^"”」』\n]{1,64})["”」』]|([^\n\r。；;]{1,64}))/iu;
  const labelled = source.match(titleLabelPattern);
  const labelledTitle = cleanProjectDisplayNameCandidate(labelled?.[1] || labelled?.[2] || labelled?.[3]);
  if (labelledTitle && !looksLikeProjectInstruction(labelledTitle)) return labelledTitle;

  const bracketed = source.match(/《([^》\n]{2,48})》/u);
  const bracketedTitle = cleanProjectDisplayNameCandidate(bracketed?.[1]);
  if (bracketedTitle && !looksLikeProjectInstruction(bracketedTitle)) return bracketedTitle;
  return undefined;
}

function projectDisplayNameFromDraft(draft?: NewVideoStartDraft, context?: NewVideoStartConfirmationContext) {
  const explicitTitle = explicitProjectTitleFromScript(draft?.script);
  if (explicitTitle) return explicitTitle;
  const summaryTitle = cleanProjectDisplayNameCandidate(context?.projection.summary.title);
  if (summaryTitle && !looksLikeProjectInstruction(summaryTitle)) return summaryTitle;
  const firstLine = draft?.script.split(/\r?\n/).map((line) => cleanProjectDisplayNameCandidate(line)).find((line) => line && !looksLikeProjectInstruction(line));
  if (firstLine) return firstLine.slice(0, 36);
  return "新视频";
}

function projectPathFromRuntimeBinding(projectRoot?: string, projectVibePath?: string) {
  const root = projectRoot?.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  const vibePath = projectVibePath?.trim().replace(/\\/g, "/");
  if (root && vibePath?.startsWith(`${root}/`)) {
    const relative = vibePath.slice(root.length + 1);
    return relative || "project.vibe";
  }
  return vibePath?.includes("/") ? "project.vibe" : (vibePath || "project.vibe");
}

function normalizeProjectRootForUiCompare(value?: string) {
  const normalized = value?.trim().replace(/\\/g, "/").replace(/\/+$/, "") || "";
  const runtimeProjectIndex = normalized.indexOf("/.vibe-runtime/");
  const comparable = runtimeProjectIndex >= 0
    ? normalized.slice(runtimeProjectIndex + 1)
    : normalized.replace(/^\.\//, "");
  return comparable.toLowerCase();
}

function projectVibeWithNewVideoTitle(
  project: ProjectVibeDocument,
  draft: NewVideoStartDraft,
  context: NewVideoStartConfirmationContext,
  generatedAt: string,
): ProjectVibeDocument {
  const title = projectDisplayNameFromDraft(draft, context);
  if (!title || project.manifest.title === title) return project;
  return refreshProjectVibeSourceIndex({
    ...project,
    manifest: {
      ...project.manifest,
      title,
      updatedAt: generatedAt,
    },
  }, generatedAt);
}


type OneShotActionStatus = "idle" | "confirmed";

function buildProjectStoreSnapshotForUi(runtimeState: ProjectRuntimeState, library: AssetLibrarySnapshot) {
  const visualMemory = toVisualMemoryDocument(library);
  return createProjectStoreSnapshot({
    generatedAt: runtimeState.generatedAt,
    projectId: runtimeState.sourceIndex.projectId,
    title: runtimeState.project.title,
    version: runtimeState.sourceIndex.projectVersion,
    projectManifest: {
      title: runtimeState.project.title,
      projectId: runtimeState.sourceIndex.projectId,
      version: runtimeState.sourceIndex.projectVersion,
    },
    storyFlow: {
      sections: runtimeState.storyFlow.sections,
      shots: runtimeState.storyFlow.shots.map((shot) => ({
        id: shot.id,
        actId: shot.actId,
        sectionId: shot.sectionId,
        title: shot.title,
        storyFunction: shot.storyFunction,
      })),
    },
    visualMemory: visualMemory as unknown as Record<string, unknown>,
    shotSpecs: runtimeState.storyFlow.shots.map((shot) => ({
      shotId: shot.id,
      value: {
        id: shot.id,
        title: shot.title,
        storyFunction: shot.storyFunction,
        gates: shot.gates,
      },
    })),
    sceneAssetPacks: library.sceneAssetPacks.map((pack) => ({
      packId: pack.id,
      value: pack as unknown as Record<string, unknown>,
    })),
    sourceIndex: runtimeState.sourceIndex as unknown as Record<string, unknown>,
    sourceIndexHash: runtimeState.sourceIndex.sourceIndexHash,
  });
}

function buildProjectFactsUiSummary(
  runtimeState: ProjectRuntimeState,
  library: AssetLibrarySnapshot,
  mode: ProjectFactsUiMode,
): ProjectFactsUiSummary {
  const snapshot = buildProjectStoreSnapshotForUi(runtimeState, library);
  const savePlan = saveProjectStoreSnapshot(snapshot, runtimeState.generatedAt);
  const runtimeProbe = { runtimeStateIsSoleSourceOfTruth: false };
  const createGate = buildProjectStoreIoGate({ mode: "create", snapshot, generatedAt: runtimeState.generatedAt, runtimeState: runtimeProbe });
  const saveGate = buildProjectStoreIoGate({ mode: "save", snapshot, generatedAt: runtimeState.generatedAt, runtimeState: runtimeProbe });
  const projectVibeContent = saveGate.entries.find((entry) => entry.operation === "write_file" && entry.path === "project.vibe")?.content;
  const openGate = buildProjectStoreIoGate({
    mode: "open",
    serializedProjectVibe: projectVibeContent,
    generatedAt: runtimeState.generatedAt,
    runtimeState: runtimeProbe,
  });
  const gates: Record<ProjectFactsUiMode, ProjectStoreIoGate> = { create: createGate, open: openGate, save: saveGate };
  const gate = gates[mode];
  const writeCount = gate.entries.filter((entry) => entry.operation === "write_file").length;
  const readCount = gate.entries.filter((entry) => entry.operation === "read_file").length;
  return {
    mode,
    projectFile: snapshot.projectFile.fileName,
    factSource: "project files",
    runtimeCache: `${runtimeState.stateSource?.path || "/runtime-state.json"} = derived cache，不是事实源`,
    planStatus: gate.canExecute ? "计划可审查" : "需要检查",
    planDetail: `${savePlan.savePlan.entries.length} 个 project facts · ${writeCount || readCount} 个 ${mode === "open" ? "read" : "write"} plan`,
    entryCount: gate.entries.length,
    writeCount,
    readCount,
    blockers: gate.blockers,
    gate,
    snapshot,
  };
}

function exportStatusLabel(status: string) {
  if (status === "ready") return "可导出";
  if (status === "blocked") return "需要补齐";
  if (status === "draft_only") return "可预览";
  return "已计划";
}

function buildMinimalProjectPlan(runtimeState: ProjectRuntimeState, statusLabel = "等待确认", progressDots: MinimalRuntimeProjection["progressDots"] = []): MinimalProjectPlan {
  const lockedReferences = runtimeState.visualMemory.assets.filter((asset) => asset.lockedStatus === "locked").length;
  return {
    entryLabel: `${runtimeState.storyFlow.shots.length} 个镜头`,
    planLabel: `${lockedReferences} 个锁定参考`,
    statusLabel,
    progressDots,
  };
}

type PrototypeProjectDraftStatus = {
  status: "idle" | "loading" | "restored" | "saved" | "missing" | "unavailable" | "error";
  label: string;
  targetId?: string;
  factHash?: string;
  error?: string;
};


async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json() as Promise<T>;
}

function runtimeLoadTarget() {
  const params = new URLSearchParams(window.location.search);
  const useSmallDemo = params.get("demo") === "small" || params.get("runtime") === "demo";
  if (useSmallDemo) {
    return {
      statePath: "/demo-runtime-state.json",
      auditPath: "/demo-runtime-audit.json",
      label: "demo small runtime",
    };
  }
  const useRuntimeState = params.get("runtime") === "state" || params.get("runtime") === "default";
  if (!useRuntimeState) return undefined;
  return {
    statePath: "/runtime-state.json",
    auditPath: "/runtime-audit.json",
    label: "runtime-state",
  };
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
        ? job.stages.reduce((acc, stage) => { if (isRecord(stage)) acc.push((stage as Record<string, unknown>).stageId); return acc; }, [] as unknown[])
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

export function ShotPreviewExportSummary({
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





export function ShotImagePipelineSummary({
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

function RealPilotDirectorStatus({ summary }: { summary: RealPilotUiSummary }) {
  return (
    <section className="real-pilot-entry" aria-label="真实小样">
      <div className="real-pilot-heading">
        <span>真实小样</span>
        <strong>{summary.reviewStatus}</strong>
      </div>
      <div className="real-pilot-mode-row">
        <span aria-label="Image2 first">{summary.image2State}</span>
        <span aria-label="Seedance paused">{summary.seedanceState}</span>
      </div>
      <div className={`handoff-status-line ${summary.handoffTone}`} aria-label="小样状态">
        <i aria-hidden="true" />
        <strong>{summary.handoffLabel}</strong>
        <small>{summary.handoffDetail}</small>
      </div>
      <div className="real-pilot-preconfirm" aria-label="执行前确认">
        <span>先复核</span>
        <span>{summary.preConfirmState || "等待确认"}</span>
        <span>1 个镜头小样</span>
        <span>0 自动重试</span>
        <span>输出文件夹</span>
        <span>单次确认</span>
        <span>{summary.oneShotStatus || "未就绪"}</span>
        <span>{summary.oneShotConfirmation || "先完成复核"}</span>
        <span>不自动生成</span>
      </div>
      <div className="real-pilot-facts">
        <div>
          <span>选择镜头</span>
          <strong>{summary.selectedShotCount ? `${summary.selectedShotCount} 个` : "未选择"}</strong>
          <small>{summary.selectedShotDetail}</small>
        </div>
        <div>
          <span>首帧控制</span>
          <strong>{summary.framePairValue}</strong>
          <small>{summary.framePairDetail}</small>
        </div>
        <div>
          <span>预计输出</span>
          <strong>{summary.estimatedOutputCount || "待估算"}</strong>
          <small>{summary.estimatedOutputDetail}</small>
        </div>
        <div>
          <span>输出文件夹</span>
          <strong>{summary.outputRoot}</strong>
        </div>
      </div>
      <small className="real-pilot-confirm">{summary.confirmationState} · 动作确认后才进入单次测试</small>
    </section>
  );
}

function realImage2GatePhaseLabel(gate: RealImage2GateState) {
  switch (gate.phase) {
    case "locked": return "locked";
    case "ready": return "ready";
    case "generating": return "generating";
    case "watching": return "watching";
    case "file_detected": return "file_detected";
    case "observation_written": return "observation_written";
    case "promoted": return "promoted";
    case "blocked": return "blocked";
  }
}

function RealImage2GateDiagnostics({
  gate,
  onUnlock,
  onGenerate,
  onPromote,
  onReset,
}: {
  gate?: RealImage2GateState;
  onUnlock: () => void;
  onGenerate: () => void;
  onPromote: () => void;
  onReset: () => void;
}) {
  return (
    <details className="diagnostic-collapsible real-image2-gate-details">
      <summary>Image2 gate detail</summary>
      {!gate && <p className="muted-copy">No active Image2 gate for the current Director session.</p>}
      {gate && (
        <section className="machine-panel">
          <div className="audit-head">
            <span>Image2 Gate</span>
            <StatusPill value={realImage2GatePhaseLabel(gate)} />
          </div>
          <div className="field-grid compact">
            <label>Shot</label>
            <span>{gate.shotId}</span>
            <label>Task Plan</label>
            <span>{gate.taskPlanId}</span>
            <label>Schema</label>
            <span>{gate.schemaVersion}</span>
            <label>Sandbox</label>
            <span>{gate.sandbox.root}</span>
            <label>Output</label>
            <span>{gate.latestOutputFile || "none"}</span>
            <label>Hash</label>
            <span>{gate.latestOutputHash || "none"}</span>
            <label>Message</label>
            <span>{gate.userMessage}</span>
          </div>
          {gate.blockers.length > 0 && (
            <div className="code-list">
              {gate.blockers.map((blocker, index) => (
                <div key={`${blocker}-${index}`} className="code-item">{blocker}</div>
              ))}
            </div>
          )}
          <div className="gate-actions">
            {gate.phase === "locked" && (
              <button onClick={onUnlock}>解锁生成</button>
            )}
            {realImage2GateCanGenerate(gate) && (
              <button onClick={onGenerate}>生成画面</button>
            )}
            {realImage2GatePromotionReady(gate) && (
              <button onClick={onPromote}>复核通过</button>
            )}
            {(gate.phase === "blocked" || gate.phase === "promoted") && (
              <button onClick={onReset}>重新锁定</button>
            )}
          </div>
        </section>
      )}
    </details>
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

export function EnvelopePreview({ task }: { task?: TaskRuntimeView }) {
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

export function ShotAudioInspector({ audioPlanning, selectedShot }: { audioPlanning: AudioPlanningState; selectedShot?: ShotRecord }) {
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

const rememberedProjectRootStorageKey = "vibe-director:last-project-root";
const recentProjectSelectionsStorageKey = "vibe-director:recent-projects";
const autoRestoreRememberedProjectStorageKey = "vibe-director:auto-restore-project";

type RememberedProjectSelection = ProjectRootDialogSelection & {
  updatedAt?: string;
};

function projectFolderName(projectRoot?: string) {
  return projectRoot?.split(/[\\/]/).filter(Boolean).at(-1) || "未命名项目";
}

function projectIdFromLocalRoot(projectRoot?: string) {
  const folderName = projectFolderName(projectRoot);
  const slug = folderName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  let hash = 0;
  for (let index = 0; index < (projectRoot || folderName).length; index += 1) {
    hash = ((hash << 5) - hash + (projectRoot || folderName).charCodeAt(index)) | 0;
  }
  const suffix = Math.abs(hash).toString(36);
  return `${slug || "local_project"}_${suffix || "0"}`;
}

function createEmptyProjectVibeForProjectRoot(projectRoot?: string, displayName?: string): ProjectVibeDocument {
  const now = new Date().toISOString();
  const title = displayName?.trim() || projectFolderName(projectRoot) || "新视频项目";
  return createProjectVibe({
    projectId: projectIdFromLocalRoot(projectRoot),
    title,
    createdAt: now,
    updatedAt: now,
  });
}

function normalizeRememberedProjectSelection(selection: ProjectRootDialogSelection): RememberedProjectSelection | undefined {
  const projectRoot = selection.projectRoot?.trim();
  if (!projectRoot) return undefined;
  return {
    cancelled: false,
    projectRoot,
    projectPath: selection.projectPath?.trim() || "project.vibe",
    projectVibePath: selection.projectVibePath?.trim(),
    hasProjectVibe: selection.hasProjectVibe !== false,
    displayName: selection.displayName?.trim() || projectFolderName(projectRoot),
    updatedAt: new Date().toISOString(),
  };
}

function readRememberedProjectSelection(): ProjectRootDialogSelection | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = window.localStorage.getItem(rememberedProjectRootStorageKey)?.trim();
    if (!value) return undefined;
    if (value.startsWith("{")) {
      const parsed = JSON.parse(value) as ProjectRootDialogSelection;
      return parsed.projectRoot?.trim() ? parsed : undefined;
    }
    return {
      cancelled: false,
      projectRoot: value,
      projectPath: "project.vibe",
      hasProjectVibe: true,
    };
  } catch {
    return undefined;
  }
}

function shouldAutoRestoreRememberedProject() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(autoRestoreRememberedProjectStorageKey) === "true";
  } catch {
    return false;
  }
}

function readRecentProjectSelections(): RememberedProjectSelection[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(recentProjectSelectionsStorageKey)?.trim();
    if (!value) return [];
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const items: RememberedProjectSelection[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const selection = normalizeRememberedProjectSelection(item as ProjectRootDialogSelection);
      if (!selection || seen.has(selection.projectRoot!)) continue;
      const updatedAt = typeof (item as { updatedAt?: unknown }).updatedAt === "string"
        ? (item as { updatedAt: string }).updatedAt
        : selection.updatedAt;
      items.push({ ...selection, updatedAt });
      seen.add(selection.projectRoot!);
    }
    return items.slice(0, 12);
  } catch {
    return [];
  }
}

function writeRecentProjectSelections(items: RememberedProjectSelection[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(recentProjectSelectionsStorageKey, JSON.stringify(items.slice(0, 12)));
  } catch {
    // Best-effort project switch list only.
  }
}

function writeRememberedProjectSelection(selection: ProjectRootDialogSelection): RememberedProjectSelection[] {
  if (typeof window === "undefined") return [];
  const normalized = normalizeRememberedProjectSelection(selection);
  if (!normalized?.projectRoot) return readRecentProjectSelections();
  try {
    window.localStorage.setItem(rememberedProjectRootStorageKey, JSON.stringify({
      cancelled: false,
      projectRoot: normalized.projectRoot,
      projectPath: normalized.projectPath,
      projectVibePath: normalized.projectVibePath,
      hasProjectVibe: normalized.hasProjectVibe,
      displayName: normalized.displayName,
    }));
  } catch {
    // Best-effort restore hint only.
  }
  const recent = [
    normalized,
    ...readRecentProjectSelections().filter((item) => item.projectRoot !== normalized.projectRoot),
  ].slice(0, 12);
  writeRecentProjectSelections(recent);
  return recent;
}

function clearRememberedProjectRoot(projectRoot?: string): RememberedProjectSelection[] {
  if (typeof window === "undefined") return [];
  try {
    const remembered = readRememberedProjectSelection();
    if (!projectRoot || remembered?.projectRoot === projectRoot) {
      window.localStorage.removeItem(rememberedProjectRootStorageKey);
    }
    const recent = projectRoot
      ? readRecentProjectSelections().filter((item) => item.projectRoot !== projectRoot)
      : [];
    writeRecentProjectSelections(recent);
    return recent;
  } catch {
    // Best-effort restore hint only.
    return readRecentProjectSelections();
  }
}

export function ShotExecutionPreviewInspector({
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

export function ShotVideoGateInspector({
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
  const motionSummary = motionContractSummaryForGate(gate, plan);
  const motionNotice = firstMotionEndpointNotice(gate, plan);
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
    ...(gate?.checks || []).reduce((acc, check) => { if (check.status === "blocked") acc.push(`${check.label}: ${check.detail}`); return acc; }, [] as string[]),
  ];
  const warnings = [
    ...(gate?.warnings || []).map((item) => `gate: ${item}`),
    ...(plan?.warnings || []).map((item) => `task: ${item}`),
    ...(gate?.checks || []).reduce((acc, check) => { if (check.status === "warning") acc.push(`${check.label}: ${check.detail}`); return acc; }, [] as string[]),
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
      <div className="field-grid compact">
        <label>Motion Type</label>
        <span>{motionSummary.motionLabel} · {motionSummary.motionType}</span>
        <label>End Frame Required</label>
        <span>{ruleValue(motionSummary.endFrameRequired)}</span>
        <label>Body Mechanics</label>
        <span>{motionSummary.bodyMechanicsRequired ? "required" : "not required"}</span>
        <label>Editable / Protected</label>
        <span>{motionSummary.editableRegionCount} / {motionSummary.protectedRegionCount}</span>
        <label>Bbox-only guard</label>
        <span>{motionSummary.bboxOnlyMotionForbidden ? "forbidden" : "missing"}</span>
        <label>Motion Notice</label>
        <span>{motionNotice}</span>
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




function App() {
  const [runtimeState, setRuntimeState] = useState<ProjectRuntimeState>(fallbackRuntimeState);
  const [assetLibrary, setAssetLibrary] = useState<AssetLibrarySnapshot>(() => createAssetLibraryFromRuntimeState(fallbackRuntimeState));
  const [prototypeProjectVibe, setPrototypeProjectVibe] = useState<ProjectVibeDocument>(() => createProjectVibeFromRuntimeState(fallbackRuntimeState));
  const prototypeProjectVibeRef = useRef(prototypeProjectVibe);
  prototypeProjectVibeRef.current = prototypeProjectVibe;
  const prototypeProjectDraftStatusRef = useRef<PrototypeProjectDraftStatus>({
    status: "idle",
    label: "本地项目待保存",
  });
  const [loadedPrototypeProjectDraftTargetId, setLoadedPrototypeProjectDraftTargetId] = useState<string | undefined>();
  const [prototypePreviewItems, setPrototypePreviewItems] = useState<PreviewQueueItem[]>([]);
  const [latestPrototypeAgentDemo, setLatestPrototypeAgentDemo] = useState<PrototypeAgentDemoRun | undefined>();
  const [agentWebSearchSettings, setAgentWebSearchSettings] = useState<AgentWebSearchSettings>(() => loadAgentWebSearchSettings());
  const [projectLocalKnowledgePacks, setProjectLocalKnowledgePacks] = useState<KnowledgePack[]>(() =>
    loadProjectLocalKnowledgePacks(fallbackRuntimeState.sourceIndex.projectId),
  );
  const newVideoStagedTransactionRef = useRef<NewVideoProjectVibeStagedTransactionPreview | undefined>(undefined);
  const [projectFactsMode, setProjectFactsMode] = useState<ProjectFactsUiMode>("save");
  const [latestProjectStoreApplyPlan, setLatestProjectStoreApplyPlan] = useState<ProjectFactsStagedApplyPlan | undefined>();
  const [mode, setMode] = useState<UiMode>("director");
  const [showInspector, setShowInspector] = useState(false);
  const [directorView, setDirectorView] = useState<DirectorView>("story");
  const [activeSectionId, setActiveSectionId] = useState<string | undefined>();
  const [selectedShotId, setSelectedShotId] = useState("A1_01");
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>(["A1_01"]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();
  const {
    projectRealChainState,
    projectImage2BatchState,
    projectImage2OneShotState,
    strictEditPreflightState,
    providerConfigStatuses,
    runtimeProjectBinding,
    runtimeProjectIdentity,
    projectPathInput,
    projectChoices,
    projectSelectionStatus,
    authorizationRef,
    setProjectRealChainState,
    setProjectImage2BatchState,
    setProjectImage2OneShotState,
    setProviderConfigStatuses,
    setProjectPathInput,
    setProjectSelectionStatus,
    setAuthorizationRef,
    connectCurrentProject,
    selectProjectChoice,
    forgetCurrentProject,
    runProjectRealChain,
    runProjectImage2Batch,
    prepareStrictEditPreflight,
    prepareImage2OneShot,
    confirmImage2OneShot,
    prepareImage2OneShotPermissionReceipt,
    checkImage2OneShotReturn,
  } = useCurrentProjectRuntimePanels({
    selectedShotId,
    previewRefreshEnabled: directorView === "preview",
  });

  function updateAgentWebSearchSettings(settings: AgentWebSearchSettings) {
    setAgentWebSearchSettings(saveAgentWebSearchSettings(settings));
  }

  const [exportActionState, setExportActionState] = useState<ExportActionState>({
    status: "idle",
    label: "导出待准备",
  });
  const [projectFileSelection, setProjectFileSelection] = useState<ProjectFileSelectionStatus>({
    status: "idle",
    label: "打开项目",
  });
  const [recentProjectSelections, setRecentProjectSelections] = useState<RememberedProjectSelection[]>(() => readRecentProjectSelections());
  const rememberedProjectRestoreAttemptedRef = useRef(false);
  const localProjectReadyForUi = projectFileSelection.status === "selected" || runtimeProjectBinding.status === "bound";
  const [realImage2Gate, setRealImage2Gate] = useState<RealImage2GateState | undefined>();

  function createImage2GateForShot(shotId: string) {
    const sandboxRoot = `real-test-sandbox/image2-one-shot/${shotId}`;
    const gate = buildRealImage2GateState({
      shotId,
      taskPlanId: `image2_${shotId}_${Date.now()}`,
      sandbox: {
        root: sandboxRoot,
        allowedPrefixes: [sandboxRoot],
        manifestPath: `${sandboxRoot}/manifest.json`,
        qaReportPath: `${sandboxRoot}/qa-report.json`,
        ledgerPath: `${sandboxRoot}/ledger.json`,
        projectRootRelative: true,
        outsideRootWriteAllowed: false,
      },
    });
    setRealImage2Gate(gate);
  }

  function unlockAndGenerateImage2Shot() {
    if (!realImage2Gate) return;
    const gate = realImage2GateCanGenerate(realImage2Gate)
      ? realImage2Gate
      : unlockRealImage2Gate(realImage2Gate);
    if (!realImage2GateCanGenerate(gate)) {
      setRealImage2Gate(gate);
      return;
    }
    const { state: generatingState } = startRealImage2Generation({
      state: gate,
      onPhaseChange: (nextState) => setRealImage2Gate(nextState),
    });
    setRealImage2Gate(generatingState);
  }

  function promoteImage2Artifact() {
    if (!realImage2Gate || !realImage2GatePromotionReady(realImage2Gate)) return;
    const promoted = promoteRealImage2Artifact(realImage2Gate);
    setRealImage2Gate(promoted);
  }

  function resetImage2Gate() {
    if (!realImage2Gate) return;
    setRealImage2Gate(lockRealImage2Gate(realImage2Gate));
  }

  function loadProjectState(nextState: ProjectRuntimeState) {
    setRuntimeState(nextState);
    setAssetLibrary(createAssetLibraryFromRuntimeState(nextState));
    setPrototypeProjectVibe(createProjectVibeFromRuntimeState(nextState));
    setProjectLocalKnowledgePacks(loadProjectLocalKnowledgePacks(nextState.sourceIndex.projectId));
    prototypeProjectDraftStatusRef.current = ({
      status: "loading",
      label: "正在读取本地项目",
    });
    setLoadedPrototypeProjectDraftTargetId(undefined);
    setPrototypePreviewItems([]);
    setLatestPrototypeAgentDemo(undefined);
    const firstShotId = nextState.storyFlow.shots[0]?.id;
    setSelectedShotId(firstShotId || "");
    setSelectedShotIds(firstShotId ? [firstShotId] : []);
    setSelectedAssetId(nextState.visualMemory.assets[0]?.id);
    setActiveSectionId(nextState.storyFlow.sections[0]?.id);
  }

  function applyProjectVibeProjectState(
    project: ProjectVibeDocument,
    target: ProjectVibeDraftTarget,
    options?: {
      newVideoDraft?: NewVideoStartDraft;
      discussionWorkspace?: NewVideoStartConfirmationContext["discussionWorkspace"];
      generatedAt?: string;
      projectLocalKnowledgePacks?: KnowledgePack[];
    },
  ) {
    const generatedAt = options?.generatedAt || new Date().toISOString();
    const knowledgeManifest = options?.projectLocalKnowledgePacks
      ? buildProjectLocalKnowledgeManifest(project.manifest.projectId, options.projectLocalKnowledgePacks, generatedAt)
      : undefined;
    const projectState = buildProjectRuntimeStateFromProjectVibe({
      project,
      projectRoot: target.projectRoot,
      projectPath: target.projectPath,
      generatedAt,
      knowledgeManifest,
    });
    const nextState = options?.newVideoDraft?.audio
      ? bindNewVideoAudioReferenceToRuntimeState({
          runtimeState: projectState,
          draft: options.newVideoDraft,
          discussionDeltas: options.discussionWorkspace?.stagedDeltas,
          generatedAt,
        }).runtimeState
      : projectState;
    setRuntimeState(nextState);
    setAssetLibrary(createAssetLibraryFromRuntimeState(nextState));
    setPrototypeProjectVibe(project);
    setProjectLocalKnowledgePacks(options?.projectLocalKnowledgePacks || loadProjectLocalKnowledgePacks(nextState.sourceIndex.projectId));
    setPrototypePreviewItems([]);
    const firstShotId = nextState.storyFlow.shots[0]?.id;
    if (firstShotId) {
      setSelectedShotId(firstShotId);
      setSelectedShotIds([firstShotId]);
    } else {
      setSelectedShotId("");
      setSelectedShotIds([]);
    }
    setSelectedAssetId(nextState.visualMemory.assets[0]?.id);
  }

  function applyAssetLibraryMutation(nextLibrary: AssetLibrarySnapshot, selectedId?: string) {
    setAssetLibrary(nextLibrary);
    setRuntimeState((current) => syncRuntimeStateWithAssetLibrary(current, nextLibrary));
    if (selectedId) setSelectedAssetId(selectedId);
  }

  function addAsset(input: AddAssetLibraryAssetInput) {
    const result = addAssetLibraryAsset(assetLibrary, input);
    applyAssetLibraryMutation(result.library, result.asset?.id);
  }

  function updateAsset(assetId: string, input: UpdateAssetLibraryAssetInput) {
    const result = updateAssetLibraryAsset(assetLibrary, assetId, input);
    applyAssetLibraryMutation(result.library, result.asset?.id || assetId);
  }

  async function markAssetStatus(assetId: string, status: AssetLibraryUiStatus) {
    const result = markAssetLibraryAssetStatus(assetLibrary, assetId, uiStatusToAssetLibraryStatus(status), new Date().toISOString());
    applyAssetLibraryMutation(result.library, result.asset?.id || assetId);
    const shouldWriteCurrentProject = (useCurrentProjectAssetProjection || useCurrentProjectWorkbenchProjection)
      && currentProjectWorkbenchProjection.assets.visualMemoryReadable;
    if (!shouldWriteCurrentProject) return;

    const writeResult = await markCurrentProjectAssetStatus(effectiveRuntimeProjectIdentity, {
      assetId,
      status,
    });
    if (!writeResult.ok) {
      setLatestPrototypeAgentDemo({
        status: "error",
        result: {
          label: "参考状态没有写入项目",
          status: writeResult.message || "请重新打开项目后再试一次。",
        },
      });
      return;
    }
    if (effectiveRuntimeProjectIdentity) {
      const refreshed = await loadProjectRealChainStatus(effectiveRuntimeProjectIdentity);
      setProjectRealChainState(refreshed);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const loadTarget = runtimeLoadTarget();
    if (!loadTarget) {
      loadProjectState(fallbackRuntimeState);
      return () => {
        cancelled = true;
      };
    }
    const activeLoadTarget = loadTarget;

    async function loadRuntime() {
      try {
        const state = await fetchJson<unknown>(activeLoadTarget.statePath);
        const normalized = withRuntimeDefaults(normalizeRuntimeState(state) as ProjectRuntimeState);
        const runtimeReady = {
          ...normalized,
          stateSource: normalized.stateSource || { kind: "runtime-state", label: activeLoadTarget.label, path: activeLoadTarget.statePath },
        } satisfies ProjectRuntimeState;
        assertProjectRuntimeState(runtimeReady);
        if (cancelled) return;
        loadProjectState(runtimeReady);
        if (runtimeReady.storyFlow?.shots?.[0]) {
          setSelectedShotId(runtimeReady.storyFlow.shots[0].id);
          setSelectedShotIds([runtimeReady.storyFlow.shots[0].id]);
        }
        return;
      } catch (error) {
        console.warn(`${activeLoadTarget.statePath} load failed; falling back to ${activeLoadTarget.auditPath}.`, error);
        // Fall through to the legacy audit file for Phase 3 compatibility.
      }

      try {
        const auditData = await fetchJson<ProjectAudit>(activeLoadTarget.auditPath);
        if (cancelled) return;
        const state = buildProjectRuntimeState(auditData, emptyKnowledgeManifest, {
          stateSource: {
            kind: "runtime-audit-fallback",
            label: `${activeLoadTarget.label} audit fallback`,
            path: activeLoadTarget.auditPath,
            note: "Derived in browser from the legacy audit file without bundling the full knowledge manifest.",
            sourceImportedAt: auditData.importedAt,
          },
        });
        loadProjectState(state);
        if (auditData.shots?.[0]) {
          setSelectedShotId(auditData.shots[0].id);
          setSelectedShotIds([auditData.shots[0].id]);
        }
        return;
      } catch {
        if (cancelled) return;
        loadProjectState(fallbackRuntimeState);
        if (fallbackRuntimeState.storyFlow.shots[0]) {
          setSelectedShotId(fallbackRuntimeState.storyFlow.shots[0].id);
          setSelectedShotIds([fallbackRuntimeState.storyFlow.shots[0].id]);
        }
      }
    }

    loadRuntime();
    return () => {
      cancelled = true;
    };
  }, []);

  const canChooseProjectRootFromDialog = canChooseProjectRootDialog();
  const canCreateLocalProjectFromDialog = canCreateLocalProjectDialog();
  const canRememberProjectRootFromDialog = canRememberProjectRootDialog();
  const activeProjectFileRoot = projectFileSelection.status === "selected"
    ? projectFileSelection.projectRoot
    : undefined;
  const projectFileStatusLabel = projectFileSelectionLabel(projectFileSelection, canChooseProjectRootFromDialog);
  const projectFileStatusDetail = projectFileSelectionDetail(projectFileSelection);
  const selectedProjectRoot = projectFileSelection.status === "selected" ? projectFileSelection.projectRoot : "";
  const normalizedSelectedProjectRoot = normalizeProjectRootForUiCompare(selectedProjectRoot);
  const selectedProjectFallbackRuntimeBinding = useMemo(() => {
    if (!selectedProjectRoot) return runtimeProjectBinding;
    const displayName = selectedProjectRoot.split(/[\\/]/).filter(Boolean).at(-1) || "未命名项目";
    return {
      status: "bound" as const,
      projectRoot: selectedProjectRoot,
      projectTitle: displayName,
      projectVibePath: projectFileSelection.status === "selected" ? projectFileSelection.projectVibePath : undefined,
      projectId: normalizeProjectRootForUiCompare(runtimeProjectBinding.projectRoot) === normalizedSelectedProjectRoot
        ? runtimeProjectBinding.projectId
        : undefined,
      message: runtimeProjectBinding.message,
    };
  }, [
    normalizedSelectedProjectRoot,
    projectFileSelection.projectVibePath,
    projectFileSelection.status,
    runtimeProjectBinding.message,
    runtimeProjectBinding.projectId,
    runtimeProjectBinding.projectRoot,
    selectedProjectRoot,
  ]);
  const effectiveRuntimeProjectBinding = runtimeProjectBinding.status === "bound"
    ? runtimeProjectBinding
    : selectedProjectFallbackRuntimeBinding;
  const effectiveRuntimeProjectIdentity = effectiveRuntimeProjectBinding.status === "bound"
    ? {
      projectId: effectiveRuntimeProjectBinding.projectId,
      projectRoot: effectiveRuntimeProjectBinding.projectRoot,
    }
    : runtimeProjectIdentity;

  useEffect(() => {
    if (effectiveRuntimeProjectBinding.status !== "bound" || !effectiveRuntimeProjectBinding.projectRoot) return;
    const currentFactsRoot = projectRealChainState.summary?.projectRoot
      || projectRealChainState.summary?.workbenchFacts?.projectRoot
      || projectRealChainState.summary?.workbenchFacts?.project?.projectRoot;
    if (
      normalizeProjectRootForUiCompare(currentFactsRoot) === normalizeProjectRootForUiCompare(effectiveRuntimeProjectBinding.projectRoot)
      && projectRealChainState.summary?.workbenchFacts
    ) {
      return;
    }

    let cancelled = false;
    loadProjectRealChainStatus({
      projectId: effectiveRuntimeProjectBinding.projectId,
      projectRoot: effectiveRuntimeProjectBinding.projectRoot,
    }).then((nextState) => {
      if (!cancelled && nextState.summary?.workbenchFacts) setProjectRealChainState(nextState);
    }).catch((error: unknown) => {
      if (!cancelled) console.error("Failed to refresh selected project workbench facts", error);
    });
    return () => {
      cancelled = true;
    };
  }, [
    effectiveRuntimeProjectBinding.projectId,
    effectiveRuntimeProjectBinding.projectRoot,
    effectiveRuntimeProjectBinding.status,
    projectRealChainState.summary?.projectRoot,
    projectRealChainState.summary?.workbenchFacts,
    setProjectRealChainState,
  ]);

  const currentProjectWorkbenchProjection = useMemo(() => buildCurrentProjectWorkbenchProjection({
    binding: effectiveRuntimeProjectBinding,
    realChainState: projectRealChainState,
    image2BatchState: projectImage2BatchState,
    selectedShotId,
    selectedShotIds,
  }), [effectiveRuntimeProjectBinding, projectImage2BatchState, projectRealChainState, selectedShotId, selectedShotIds]);
  const normalizedProjectionProjectRoot = normalizeProjectRootForUiCompare(currentProjectWorkbenchProjection.identity.projectRoot);
  const currentProjectProjectionMatchesSelectedRoot = !normalizedSelectedProjectRoot
    || normalizedProjectionProjectRoot === normalizedSelectedProjectRoot;
  const useCurrentProjectWorkbenchProjection = currentProjectWorkbenchProjection.available
    && currentProjectProjectionMatchesSelectedRoot;
  const useCurrentProjectAssetProjection = currentProjectWorkbenchProjection.available
    && currentProjectProjectionMatchesSelectedRoot
    && currentProjectWorkbenchProjection.assets.visualMemoryReadable
    && currentProjectWorkbenchProjection.assetFacts.length > 0;
  const currentProjectHasOnlyPlaceholder = useCurrentProjectWorkbenchProjection
    && currentProjectWorkbenchProjection.previewItemCount === 0
    && currentProjectWorkbenchProjection.assetFacts.length === 0
    && currentProjectWorkbenchProjection.shots.length === 1
    && currentProjectWorkbenchProjection.shots[0]?.id === "CURRENT_PROJECT"
    && currentProjectWorkbenchProjection.shots[0]?.issues.includes("current_project_story_pending");
  const currentProjectProjectionForRuntime = useMemo(
    () => currentProjectHasOnlyPlaceholder
      ? {
        ...currentProjectWorkbenchProjection,
        story: {
          ...currentProjectWorkbenchProjection.story,
          statusLabel: "新视频项目",
          detail: "还没有故事流",
          shotCount: 0,
          sectionCount: 0,
          fallbackUsed: false,
        },
        selectedScope: {
          ...currentProjectWorkbenchProjection.selectedScope,
          defaultShotId: undefined,
          selectedShotIds: [],
          label: currentProjectWorkbenchProjection.identity.displayTitle,
          detail: "等待开始新故事",
        },
        shots: [],
        sections: [],
      }
      : currentProjectWorkbenchProjection,
    [currentProjectHasOnlyPlaceholder, currentProjectWorkbenchProjection],
  );
  const workbenchRuntimeState = useMemo(
    () => useCurrentProjectWorkbenchProjection
      ? applyCurrentProjectWorkbenchProjectionToRuntimeState(runtimeState, currentProjectProjectionForRuntime)
      : runtimeState,
    [currentProjectProjectionForRuntime, runtimeState, useCurrentProjectWorkbenchProjection],
  );
  const currentProjectPreviewProjection = useMemo(() => buildCurrentProjectPreviewProjection({
    summary: projectRealChainState.summary,
    previewItems: projectRealChainState.summary?.previewItems,
    previewPlan: {
      clips: workbenchRuntimeState.storyFlow.shots.map((shot, index) => ({
        id: `story_duration_${shot.id}`,
        shotId: shot.id,
        order: index + 1,
        durationSeconds: shot.durationSeconds,
      })),
    },
    projectId: effectiveRuntimeProjectIdentity?.projectId,
    projectRoot: effectiveRuntimeProjectIdentity?.projectRoot,
  }), [
    effectiveRuntimeProjectIdentity?.projectId,
    effectiveRuntimeProjectIdentity?.projectRoot,
    projectRealChainState.summary,
    workbenchRuntimeState.storyFlow.shots,
  ]);
  const currentProjectPreviewQueue = useMemo(() => {
    const base = effectiveRuntimeProjectBinding.status === "bound"
      ? currentProjectPreviewProjection.queue
      : [];
    const withGate = (() => {
      if (!realImage2Gate || !realImage2Gate.promoted || !realImage2Gate.latestOutputFile) return base;
      const gateItem = {
        id: `gate_${realImage2Gate.shotId}`,
        shotId: realImage2Gate.shotId,
        kind: "image_hold" as const,
        label: `${formatShotNumber(realImage2Gate.shotId)} 画面小样`,
        mediaPath: realImage2Gate.latestOutputFile,
        startSeconds: base.length > 0 ? base[base.length - 1].startSeconds + base[base.length - 1].durationSeconds + 1 : 0,
        durationSeconds: 9,
        qa: "pass" as const,
      };
      return [...base, gateItem];
    })();
    if (!prototypePreviewItems.length) return withGate;
    const startOffset = withGate.reduce((max, item) => Math.max(max, item.startSeconds + item.durationSeconds), 0);
    return [
      ...withGate,
      ...prototypePreviewItems.map((item, index) => ({
        ...item,
        startSeconds: startOffset + index * item.durationSeconds,
      })),
    ];
  }, [
    currentProjectPreviewProjection.queue,
    effectiveRuntimeProjectBinding.status,
    realImage2Gate?.promoted,
    realImage2Gate?.latestOutputFile,
    realImage2Gate?.shotId,
    prototypePreviewItems,
  ]);
  const projectLocalKnowledgeManifest = useMemo(
    () => buildProjectLocalKnowledgeManifest(workbenchRuntimeState.sourceIndex.projectId, projectLocalKnowledgePacks),
    [projectLocalKnowledgePacks, workbenchRuntimeState.sourceIndex.projectId],
  );
  const storyboardProjectPlanInput = useMemo(
    () => buildProjectVibeStoryboardPlannerInput(prototypeProjectVibe, {
      storyboardOutputRoot: "storyboards",
      videoOutputRoot: "video",
      outputSize: "16:9",
    }),
    [prototypeProjectVibe],
  );

  async function saveResearchAsProjectReference(input: {
    result: AgentWebSearchResult;
    userIntent: string;
  }): Promise<KnowledgePack> {
    const generatedAt = new Date().toISOString();
    const pack = buildProjectLocalKnowledgePackFromWebSearch({
      result: input.result,
      userIntent: input.userIntent,
      projectId: workbenchRuntimeState.sourceIndex.projectId,
      projectTitle: workbenchRuntimeState.project.title,
      createdAt: generatedAt,
    });
    const stagedTransaction = buildProjectLocalKnowledgeReferenceStagedTransaction({
      project: prototypeProjectVibeRef.current,
      pack,
      result: input.result,
      userIntent: input.userIntent,
      generatedAt,
    });
    if (stagedTransaction.blocked) {
      throw new Error(stagedTransaction.blockedReasons[0] || "本片参考还不能写入项目");
    }
    const committed = commitProjectLocalKnowledgeReferenceStagedTransaction({
      project: prototypeProjectVibeRef.current,
      stagedTransaction,
    });
    if (committed.status !== "applied") {
      throw new Error(committed.blockedReasons[0] || "本片参考写入项目失败");
    }
    const packSaveResult = await saveProjectLocalKnowledgePack(
      workbenchRuntimeState.sourceIndex.projectId,
      pack,
      prototypeProjectDraftTarget,
    );
    if (!packSaveResult.ok) {
      throw new Error(packSaveResult.errors[0] || "本片参考文件保存失败");
    }
    const saveResult = await saveProjectVibeDraft(prototypeProjectDraftTarget, committed.project);
    if (!saveResult.ok) {
      throw new Error(saveResult.errors[0] || "本片参考保存失败");
    }
    const nextPacks = Array.from(new Map([...projectLocalKnowledgePacks, packSaveResult.pack].map((item) => [item.id, item])).values());
    applyProjectVibeProjectState(committed.project, prototypeProjectDraftTarget, {
      generatedAt,
      projectLocalKnowledgePacks: nextPacks,
    });
    setProjectLocalKnowledgePacks(nextPacks);
    prototypeProjectDraftStatusRef.current = ({
      status: saveResult.status,
      label: "本片参考已写入项目",
      targetId: saveResult.targetId,
      factHash: saveResult.factHash,
      error: saveResult.errors[0],
    });
    setLatestPrototypeAgentDemo({
      status: "ready",
      result: {
        label: "本片参考已写入项目",
        projectVibeAdded: true,
        projectSaved: true,
        storageLabel: packSaveResult.mode === "electron_project_file" ? `已保存到 ${packSaveResult.path}` : "已保存到本机浏览器",
        waitingReview: false,
        status: "ready",
      },
    });
    return pack;
  }
  const prototypeProjectDraftStorageKeyValue = useMemo(
    () => prototypeProjectDraftStorageKey(workbenchRuntimeState),
    [workbenchRuntimeState.project.title, workbenchRuntimeState.sourceIndex.projectId],
  );
  const prototypeProjectDraftTarget = useMemo<ProjectVibeDraftTarget>(
    () => ({
      projectRoot: activeProjectFileRoot,
      projectPath: projectFileSelection.status === "selected" ? projectFileSelection.projectPath : undefined,
      storageKey: prototypeProjectDraftStorageKeyValue,
    }),
    [
      activeProjectFileRoot,
      projectFileSelection.projectPath,
      projectFileSelection.status,
      prototypeProjectDraftStorageKeyValue,
    ],
  );
  const prototypeProjectDraftTargetId = useMemo(
    () => buildProjectVibeDraftTargetId(prototypeProjectDraftTarget),
    [prototypeProjectDraftTarget],
  );

  useEffect(() => {
    if (rememberedProjectRestoreAttemptedRef.current) return;
    if (projectFileSelection.status === "choosing") return;
    if (!shouldAutoRestoreRememberedProject()) {
      rememberedProjectRestoreAttemptedRef.current = true;
      return;
    }
    const rememberedSelection = readRememberedProjectSelection();
    if (!rememberedSelection?.projectRoot) return;
    if (
      projectFileSelection.status === "selected"
      && projectFileSelection.projectRoot === rememberedSelection.projectRoot
      && runtimeProjectBinding.projectRoot === rememberedSelection.projectRoot
    ) {
      rememberedProjectRestoreAttemptedRef.current = true;
      return;
    }

    rememberedProjectRestoreAttemptedRef.current = true;
    const restoredSelection: ProjectRootDialogSelection = rememberedSelection;
    let cancelled = false;
    async function restoreRememberedProject() {
      let selection: ProjectRootDialogSelection = restoredSelection;
      if (canRememberProjectRootFromDialog) {
        try {
          const electronSelection = await rememberProjectRoot(restoredSelection.projectRoot!);
          if (!electronSelection.cancelled && electronSelection.projectRoot) {
            selection = electronSelection;
            setRecentProjectSelections(writeRememberedProjectSelection(electronSelection));
          }
        } catch {
          // The project remains visible, but saving may ask the user to reopen if the OS scope is gone.
        }
      }
      if (cancelled || !selection.projectRoot) return;
      setProjectFileSelection({
        status: "selected",
        label: "切换项目",
        detail: "已恢复上次项目",
        projectRoot: selection.projectRoot,
        projectPath: selection.projectPath || "project.vibe",
        projectVibePath: selection.projectVibePath,
        hasProjectVibe: selection.hasProjectVibe !== false,
        displayName: selection.displayName || projectFolderName(selection.projectRoot),
      });
      const displayName = selection.displayName
        || selection.projectRoot.split(/[\\/]/).filter(Boolean).at(-1)
        || "未命名项目";
      applyProjectVibeProjectState(createEmptyProjectVibeForProjectRoot(selection.projectRoot, displayName), {
        projectRoot: selection.projectRoot,
        projectPath: selection.projectPath || "project.vibe",
        storageKey: prototypeProjectDraftStorageKeyValue,
      });
      setProjectRealChainState({ status: "unavailable", message: "正在读取上次项目。" });
      setProjectImage2BatchState({ status: "unavailable", message: "正在同步上次项目复核状态。" });
      setProjectImage2OneShotState({ status: "unavailable", message: "正在同步上次项目小样状态。" });
      await connectCurrentProject({
        projectRoot: selection.projectRoot,
        displayName,
      }, { projectFileRootSelected: true }).catch(() => {
        setProjectSelectionStatus("error");
      });
    }
    void restoreRememberedProject();
    return () => {
      cancelled = true;
    };
  }, [
    canRememberProjectRootFromDialog,
    connectCurrentProject,
    projectFileSelection.projectRoot,
    projectFileSelection.status,
    runtimeProjectBinding.projectRoot,
  ]);

  useEffect(() => {
    if (runtimeProjectBinding.status !== "bound" || !runtimeProjectBinding.projectRoot) return;
    if (projectFileSelection.status === "selected") return;
    const projectPath = projectPathFromRuntimeBinding(runtimeProjectBinding.projectRoot, runtimeProjectBinding.projectVibePath);
    setProjectPathInput(runtimeProjectBinding.projectRoot);
    setProjectFileSelection({
      status: "selected",
      label: "切换项目",
      detail: runtimeProjectBinding.projectVibePath ? "已连接当前项目" : "本地项目已准备",
      projectRoot: runtimeProjectBinding.projectRoot,
      projectPath,
      projectVibePath: runtimeProjectBinding.projectVibePath,
      hasProjectVibe: Boolean(runtimeProjectBinding.projectVibePath),
      displayName: runtimeProjectBinding.projectTitle || projectFolderName(runtimeProjectBinding.projectRoot),
    });
    if (canRememberProjectRootFromDialog) {
      rememberProjectRoot(runtimeProjectBinding.projectRoot).then((selection) => {
        if (selection.cancelled || !selection.projectRoot) return;
        setRecentProjectSelections(writeRememberedProjectSelection({
          ...selection,
          displayName: runtimeProjectBinding.projectTitle || selection.displayName || projectFolderName(selection.projectRoot),
        }));
        setProjectFileSelection((current) => current.status === "selected" && current.projectRoot === runtimeProjectBinding.projectRoot
          ? {
            ...current,
            projectRoot: selection.projectRoot,
            projectPath: selection.projectPath || current.projectPath,
            projectVibePath: selection.projectVibePath || current.projectVibePath,
            hasProjectVibe: selection.hasProjectVibe || current.hasProjectVibe,
            displayName: current.displayName || selection.displayName,
          }
          : current);
      }).catch((error: unknown) => {
        console.error("Failed to remember runtime-selected project root", error);
      });
    }
  }, [
    canRememberProjectRootFromDialog,
    projectFileSelection.projectRoot,
    projectFileSelection.status,
    runtimeProjectBinding.projectRoot,
    runtimeProjectBinding.projectTitle,
    runtimeProjectBinding.projectVibePath,
    runtimeProjectBinding.status,
    setProjectPathInput,
  ]);

  const workbenchAssetFactsKey = useMemo(
    () => `${currentProjectWorkbenchProjection.identity.projectRoot || ""}:${currentProjectWorkbenchProjection.assetFacts.map((asset) => `${asset.id}:${asset.status}:${asset.path || ""}`).join("|")}`,
    [currentProjectWorkbenchProjection.assetFacts, currentProjectWorkbenchProjection.identity.projectRoot],
  );
  const projectedWorkbenchAssetLibrary = useMemo(
    () => createAssetLibraryFromCurrentProjectWorkbench(currentProjectWorkbenchProjection),
    [workbenchAssetFactsKey],
  );
  const workbenchAssetLibrary = useMemo(
    () => !useCurrentProjectWorkbenchProjection && !useCurrentProjectAssetProjection
      ? assetLibrary
      : (currentProjectWorkbenchProjection.assets.readOnlyProjection
        || currentProjectWorkbenchProjection.assetFacts.length > 0
        || assetLibrary.id !== projectedWorkbenchAssetLibrary.id
        ? projectedWorkbenchAssetLibrary
        : assetLibrary),
    [
      assetLibrary,
      currentProjectWorkbenchProjection.assetFacts.length,
      currentProjectWorkbenchProjection.assets.readOnlyProjection,
      projectedWorkbenchAssetLibrary,
      useCurrentProjectAssetProjection,
      useCurrentProjectWorkbenchProjection,
    ],
  );
  useEffect(() => {
    if (!useCurrentProjectWorkbenchProjection && !useCurrentProjectAssetProjection) return;
    if (currentProjectWorkbenchProjection.assets.readOnlyProjection) return;
    setAssetLibrary(projectedWorkbenchAssetLibrary);
  }, [
    currentProjectWorkbenchProjection.assets.readOnlyProjection,
    projectedWorkbenchAssetLibrary,
    useCurrentProjectAssetProjection,
    useCurrentProjectWorkbenchProjection,
    workbenchAssetFactsKey,
  ]);
  useEffect(() => {
    let cancelled = false;
    if (loadedPrototypeProjectDraftTargetId === prototypeProjectDraftTargetId) return () => {
      cancelled = true;
    };

    prototypeProjectDraftStatusRef.current = ({
      status: "loading",
      label: "正在读取本地项目",
      targetId: prototypeProjectDraftTargetId,
    });
    async function openOrInitializeProjectDraft() {
      const result = await openProjectVibeDraft(prototypeProjectDraftTarget);
      if (cancelled) return;
      setLoadedPrototypeProjectDraftTargetId(prototypeProjectDraftTargetId);
      if (result.ok && result.project) {
        const knowledgeOpen = await openProjectLocalKnowledgePacks(
          result.project.manifest.projectId,
          prototypeProjectDraftTarget,
          result.project,
        );
        if (cancelled) return;
        applyProjectVibeProjectState(result.project, prototypeProjectDraftTarget, {
          projectLocalKnowledgePacks: knowledgeOpen.packs,
        });
        setProjectFileSelection((current) => current.status === "selected" && current.projectRoot === prototypeProjectDraftTarget.projectRoot
          ? {
              ...current,
              detail: knowledgeOpen.packs.length ? "已连接当前项目和本片参考" : "已连接当前项目",
              hasProjectVibe: true,
            }
          : current);
        prototypeProjectDraftStatusRef.current = ({
          status: "restored",
          label: knowledgeOpen.packs.length ? "已恢复本地项目和本片参考" : "已恢复本地项目",
          targetId: result.targetId,
          factHash: result.factHash,
        });
        setLatestPrototypeAgentDemo({
          status: "ready",
          result: {
            label: "已恢复本地项目",
            projectRestored: true,
            projectVibeAdded: true,
            status: "ready",
          },
        });
        return;
      }

      if (result.status === "missing" && projectFileSelection.status === "selected" && projectFileSelection.projectRoot) {
        const initialProject = createEmptyProjectVibeForProjectRoot(
          projectFileSelection.projectRoot,
          projectFileSelection.displayName,
        );
        const saveResult = await saveProjectVibeDraft(prototypeProjectDraftTarget, initialProject);
        if (cancelled) return;
        if (saveResult.ok) {
          applyProjectVibeProjectState(initialProject, prototypeProjectDraftTarget);
          setProjectFileSelection((current) => current.status === "selected" && current.projectRoot === projectFileSelection.projectRoot
            ? { ...current, detail: "已创建项目文件", hasProjectVibe: true }
            : current);
          prototypeProjectDraftStatusRef.current = ({
            status: "saved",
            label: "已创建本地项目",
            targetId: saveResult.targetId,
            factHash: saveResult.factHash,
          });
          setLatestPrototypeAgentDemo({
            status: "ready",
            result: {
              label: "已创建本地项目",
              projectSaved: true,
              projectVibeAdded: true,
              status: "ready",
            },
          });
          return;
        }

        prototypeProjectDraftStatusRef.current = ({
          status: saveResult.status,
          label: "项目保存待重试",
          targetId: saveResult.targetId,
          factHash: saveResult.factHash,
          error: saveResult.errors[0],
        });
        return;
      }

      prototypeProjectDraftStatusRef.current = ({
        status: result.status,
        label: result.status === "missing" ? "本地项目待保存" : "本地项目暂不可用",
        targetId: result.targetId,
        error: result.errors[0],
      });
    }

    void openOrInitializeProjectDraft();

    return () => {
      cancelled = true;
    };
  }, [
    loadedPrototypeProjectDraftTargetId,
    projectFileSelection.projectRoot,
    projectFileSelection.status,
    prototypeProjectDraftTarget,
    prototypeProjectDraftTargetId,
  ]);
  const workbenchSelectedShotId = useMemo(() => {
    const sourceShots = useCurrentProjectWorkbenchProjection
      ? currentProjectWorkbenchProjection.shots
      : workbenchRuntimeState.storyFlow.shots;
    const shotIds = new Set(sourceShots.map((shot) => shot.id));
    return shotIds.has(selectedShotId)
      ? selectedShotId
      : useCurrentProjectWorkbenchProjection
        ? currentProjectWorkbenchProjection.selectedScope.defaultShotId || selectedShotId
        : sourceShots[0]?.id || selectedShotId;
  }, [currentProjectWorkbenchProjection, selectedShotId, useCurrentProjectWorkbenchProjection, workbenchRuntimeState.storyFlow.shots]);
  const runtimeAudit = useMemo(() => auditFromProjectRuntimeState(runtimeState), [runtimeState]);
  const runtimeView = useMemo(
    () => buildRuntimeViewFromProjectState(runtimeState, { selectedShotId }),
    [runtimeState, selectedShotId],
  );
  const audit = useMemo(() => auditFromProjectRuntimeState(workbenchRuntimeState), [workbenchRuntimeState]);
  const view = useMemo(
    () => buildRuntimeViewFromProjectState(workbenchRuntimeState, { selectedShotId: workbenchSelectedShotId }),
    [workbenchRuntimeState, workbenchSelectedShotId],
  );
  // Trivial computation - useMemo overhead may exceed benefit
  const selectedShot = useMemo(() => audit.shots.find((shot) => shot.id === workbenchSelectedShotId), [audit.shots, workbenchSelectedShotId]);
  const hasWorkbenchProjectContent = audit.shots.length > 0 || view.storySections.length > 0 || audit.assets.length > 0;
  const selectedProjectDisplayName = projectFileSelection.status === "selected"
    ? projectFileSelection.displayName || projectFolderName(projectFileSelection.projectRoot)
    : effectiveRuntimeProjectBinding.status === "bound"
      ? effectiveRuntimeProjectBinding.projectTitle || projectFolderName(effectiveRuntimeProjectBinding.projectRoot)
      : undefined;
  const selectedProjectHasNoContent = localProjectReadyForUi && !hasWorkbenchProjectContent;
  const isFallbackWorkbenchSource = audit.projectTitle === fallbackAudit.projectTitle
    || workbenchRuntimeState.stateSource?.kind === "fallback-audit";
  const isEmptyFallbackWorkbench = selectedProjectHasNoContent || (
    isFallbackWorkbenchSource
    && !useCurrentProjectWorkbenchProjection
    && !(localProjectReadyForUi && hasWorkbenchProjectContent)
  );
  const projectContentReadyForUi = !isEmptyFallbackWorkbench && hasWorkbenchProjectContent;
  const visibleProjectTitle = selectedProjectHasNoContent
    ? selectedProjectDisplayName || "空项目"
    : isEmptyFallbackWorkbench
      ? "新视频项目"
      : audit.projectTitle;
  const projectControlRoot = projectFileSelection.status === "selected"
    ? projectFileSelection.projectRoot
    : effectiveRuntimeProjectBinding.status === "bound"
      ? effectiveRuntimeProjectBinding.projectRoot
      : undefined;
  const localStoryPreviewQueue = useMemo(
    () => isEmptyFallbackWorkbench ? [] : buildMissingPreviewQueueFromShots(audit.shots),
    [audit.shots, isEmptyFallbackWorkbench],
  );
  // Trivial computation - useMemo overhead may exceed benefit
  const directorPreviewQueue = useMemo(
    () => isEmptyFallbackWorkbench ? [] : currentProjectPreviewQueue.length ? currentProjectPreviewQueue : localStoryPreviewQueue,
    [currentProjectPreviewQueue, isEmptyFallbackWorkbench, localStoryPreviewQueue],
  );
  const currentProjectPreviewEmptyState = useMemo(() => {
    if (directorPreviewQueue.length > 0) {
      return {
        label: "预览已准备好",
        detail: "可以播放当前故事流。",
      };
    }
    if (effectiveRuntimeProjectBinding.status !== "bound" && audit.shots.length === 0) {
      return {
        label: "先选择一个项目",
        detail: "连接或打开项目后，预览会显示当前故事的可播放素材。",
      };
    }
    if (effectiveRuntimeProjectBinding.status !== "bound") {
      return {
        label: "当前故事还没有可播放素材",
        detail: "素材回流前，会先显示当前故事流的待补齐位置。",
      };
    }
    if (currentProjectPreviewProjection.available) {
      return {
        label: "这个项目还没有可播放素材",
        detail: "完成画面准备后，预览会自动出现在这里。",
      };
    }
    return {
      label: "等待故事流和素材同步",
      detail: "当前项目已连接，预览会在素材准备好后自动更新。",
    };
  }, [
    audit.shots.length,
    currentProjectPreviewProjection.available,
    directorPreviewQueue.length,
    effectiveRuntimeProjectBinding.status,
  ]);
  const workbenchSelectedShotIds = useMemo(() => {
    if (useCurrentProjectWorkbenchProjection) return currentProjectWorkbenchProjection.selectedScope.selectedShotIds;
    const shotIds = new Set(audit.shots.map((shot) => shot.id));
    const normalized = selectedShotIds.filter((shotId) => shotIds.has(shotId));
    return normalized.length ? normalized : workbenchSelectedShotId ? [workbenchSelectedShotId] : [];
  }, [audit.shots, currentProjectWorkbenchProjection.selectedScope.selectedShotIds, selectedShotIds, useCurrentProjectWorkbenchProjection, workbenchSelectedShotId]);
  const workbenchProjectScopeLabel = useMemo(() => {
    if (isEmptyFallbackWorkbench) return "新视频项目";
    if (useCurrentProjectWorkbenchProjection) return currentProjectWorkbenchProjection.selectedScope.label;
    if (workbenchSelectedShotIds.length > 1) return `${workbenchRuntimeState.project.title} · ${workbenchSelectedShotIds.length} 个镜头`;
    return workbenchSelectedShotId
      ? `${workbenchRuntimeState.project.title} · ${workbenchSelectedShotId}`
      : workbenchRuntimeState.project.title;
  }, [
    currentProjectWorkbenchProjection.selectedScope.label,
    isEmptyFallbackWorkbench,
    useCurrentProjectWorkbenchProjection,
    workbenchRuntimeState.project.title,
    workbenchSelectedShotId,
    workbenchSelectedShotIds.length,
  ]);
  const workbenchProgressState = useMemo(() => {
    const state = buildDirectorProgressStripState(buildLocalOrchestratorUiSummary(workbenchRuntimeState));
    if (!isEmptyFallbackWorkbench) return state;
    return {
      ...state,
      label: "等待开始",
      detail: "先写脚本或创建本地项目",
      tone: "preparing" as const,
      total: 0,
      preparing: 0,
      working: 0,
      review: 0,
      blocked: 0,
      complete: 0,
      segments: state.segments.map((segment) => ({ ...segment, value: 0 })),
    };
  }, [isEmptyFallbackWorkbench, workbenchRuntimeState]);
  const workbenchAssetReadOnlyDetail = useCurrentProjectWorkbenchProjection
    && currentProjectWorkbenchProjection.assets.readOnlyProjection
    ? currentProjectWorkbenchProjection.assets.detail
    : undefined;
  const selectedShots = useMemo(
    () => workbenchSelectedShotIds
      .map((shotId) => audit.shots.find((shot) => shot.id === shotId))
      .filter((shot): shot is ShotRecord => Boolean(shot)),
    [audit.shots, workbenchSelectedShotIds],
  );
  const visibleSelectedShot = isEmptyFallbackWorkbench ? undefined : selectedShot;
  const visibleSelectedShots = isEmptyFallbackWorkbench ? [] : selectedShots;
  // Trivial computation - useMemo overhead may exceed benefit
  const selectedAsset = useMemo(() => audit.assets.find((asset) => asset.id === selectedAssetId), [audit.assets, selectedAssetId]);
  const blockers = audit.issues.filter((issue) => issue.severity === "blocker");
  const topRuntimeProjection = useMemo(() => buildMinimalRuntimeProjection({
    previewQueue: directorPreviewQueue,
    assetLibrary: workbenchAssetLibrary,
    ledgerProjections: projectImage2BatchState.summary?.ledgerProjections,
    generatedAt: workbenchRuntimeState.generatedAt,
  }), [directorPreviewQueue, projectImage2BatchState.summary?.ledgerProjections, workbenchAssetLibrary, workbenchRuntimeState.generatedAt]);
  const creatorDeskProjection = useMemo(() => buildCreatorDeskProjection({
    runtimeState: workbenchRuntimeState,
    previewItems: directorPreviewQueue,
    image2BatchState: projectImage2BatchState,
    selectedShotIds: workbenchSelectedShotIds,
  }), [directorPreviewQueue, projectImage2BatchState, workbenchRuntimeState, workbenchSelectedShotIds]);
  const projectPlan = useMemo(
    () => buildMinimalProjectPlan(workbenchRuntimeState, topRuntimeProjection.shortLabel, topRuntimeProjection.progressDots),
    [topRuntimeProjection.progressDots, topRuntimeProjection.shortLabel, workbenchRuntimeState],
  );
  const projectFacts = useMemo(
    () => buildProjectFactsUiSummary(workbenchRuntimeState, workbenchAssetLibrary, projectFactsMode),
    [projectFactsMode, workbenchAssetLibrary, workbenchRuntimeState],
  );
  const resolvedActiveSectionId = activeSectionId
    || view.storySections.find((section) => selectedShot && section.shotIds.includes(selectedShot.id))?.id
    || view.storySections[0]?.id;
  const localPreviewExportProjection = useMemo(() => buildLocalPreviewExportProjection({
    runtimeState: workbenchRuntimeState,
    previewQueue: directorPreviewQueue,
    shots: audit.shots,
    projectVibe: prototypeProjectVibe,
    projectLocalKnowledgePacks,
    projectRoot: prototypeProjectDraftTarget.projectRoot || runtimeProjectIdentity?.projectRoot,
    selectedShotId: workbenchSelectedShotId,
    generatedAt: workbenchRuntimeState.generatedAt,
  }), [
    audit.shots,
    directorPreviewQueue,
    projectLocalKnowledgePacks,
    prototypeProjectDraftTarget.projectRoot,
    prototypeProjectVibe,
    runtimeProjectIdentity?.projectRoot,
    workbenchRuntimeState,
    workbenchSelectedShotId,
  ]);

  useEffect(() => {
    if (!view.storySections.length) return;
    if (!resolvedActiveSectionId || !view.storySections.some((section) => section.id === resolvedActiveSectionId)) {
      setActiveSectionId(view.storySections[0].id);
      return;
    }
    if (activeSectionId !== resolvedActiveSectionId) setActiveSectionId(resolvedActiveSectionId);
  }, [activeSectionId, resolvedActiveSectionId, view.storySections]);

  useEffect(() => {
    if (!workbenchSelectedShotId || selectedShotId === workbenchSelectedShotId) return;
    setSelectedShotId(workbenchSelectedShotId);
    setSelectedShotIds(workbenchSelectedShotIds.length
      ? workbenchSelectedShotIds
      : [workbenchSelectedShotId]);
  }, [selectedShotId, workbenchSelectedShotId, workbenchSelectedShotIds]);

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
    if (firstShotId) {
      setSelectedShotId(firstShotId);
      setSelectedShotIds([firstShotId]);
    }
  }

  function selectShot(shotId: string, additive = false) {
    const baseSelection = selectedShotIds.length ? selectedShotIds : [selectedShotId];
    const nextSelection = additive
      ? baseSelection.includes(shotId)
        ? baseSelection.filter((id) => id !== shotId)
        : [...baseSelection, shotId]
      : [shotId];
    const normalizedSelection = nextSelection.length ? nextSelection : [shotId];
    setSelectedShotIds(normalizedSelection);
    setSelectedShotId(normalizedSelection.includes(shotId) ? shotId : normalizedSelection[0]);
    setProjectImage2OneShotState({ status: "unavailable", message: "选择镜头后可准备小样包。" });
    const section = view.storySections.find((item) => item.shotIds.includes(shotId));
    if (section) setActiveSectionId(section.id);
  }

  function newVideoDraftFriendlyError(reasons: string[]) {
    if (reasons.includes("script_missing")) return "先补一段大概脚本，再确认草案。";
    if (reasons.includes("discussion_delta_unconfirmed")) return "先确认待修改，再确认草案。";
    if (reasons.some((reason) => reason.startsWith("script_qa_"))) return "这版草案还缺角色、阻碍或转折，补一句再确认。";
    if (reasons.some((reason) => reason.includes("project") || reason.includes("source"))) return "项目刚刚有变化，请重新发送后再确认。";
    return "草案确认失败，请重新整理后再试。";
  }

  async function confirmNewVideoProjectVibeDraft(draft: NewVideoStartDraft, context: NewVideoStartConfirmationContext) {
    const generatedAt = new Date().toISOString();
    newVideoStagedTransactionRef.current = (undefined);
    let draftTarget: ProjectVibeDraftTarget;
    try {
      draftTarget = await projectDraftTargetForNewVideoConfirmation(draft, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : "先新建或打开本地项目，再确认草案。";
      prototypeProjectDraftStatusRef.current = ({
        status: "error",
        label: "先准备本地项目",
        targetId: prototypeProjectDraftTargetId,
        error: message,
      });
      throw new Error(message);
    }
    const draftTargetId = buildProjectVibeDraftTargetId(draftTarget);
    const projectForNewVideo = projectVibeWithNewVideoTitle(prototypeProjectVibeRef.current, draft, context, generatedAt);
    const stagedTransaction = buildNewVideoProjectVibeStagedTransaction({
      project: projectForNewVideo,
      draft,
      directorSession: context.directorSession,
      discussionDeltas: context.discussionWorkspace?.stagedDeltas,
      storyboardDraft: context.storyboardDraft,
      generatedAt,
    });
    newVideoStagedTransactionRef.current = (stagedTransaction);
    prototypeProjectDraftStatusRef.current = ({
      status: "idle",
      label: `草案待确认：${stagedTransaction.summary.shotCount} 个镜头`,
      targetId: draftTargetId,
    });
    if (stagedTransaction.blocked) {
      const message = newVideoDraftFriendlyError(stagedTransaction.blockedReasons);
      prototypeProjectDraftStatusRef.current = ({
        status: "error",
        label: "草案还需要补齐",
        targetId: draftTargetId,
        error: message,
      });
      throw new Error(message);
    }

    const result = commitNewVideoProjectVibeStagedTransaction({
      project: projectForNewVideo,
      stagedTransaction,
    });
    if (result.patch.receipt.status !== "applied") {
      const message = newVideoDraftFriendlyError(result.blockedReasons.length ? result.blockedReasons : result.patch.receipt.errors);
      prototypeProjectDraftStatusRef.current = ({
        status: "error",
        label: "草案未写入项目",
        targetId: draftTargetId,
        error: message,
      });
      throw new Error(message);
    }

    const saveResult = await saveProjectVibeDraft(draftTarget, result.project);
    prototypeProjectDraftStatusRef.current = ({
      status: saveResult.status,
      label: saveResult.ok ? "草案已写入项目" : "草案保存待重试",
      targetId: saveResult.targetId,
      factHash: saveResult.factHash,
      error: saveResult.errors[0],
    });
    if (!saveResult.ok) {
      throw new Error(saveResult.errors[0] || "草案保存失败");
    }
    if (draftTarget.projectRoot) {
      const savedProjectTitle = result.project.manifest.title || projectDisplayNameFromDraft(draft, context);
      setLoadedPrototypeProjectDraftTargetId(draftTargetId);
      setProjectFileSelection((current) => current.status === "selected" && current.projectRoot === draftTarget.projectRoot
        ? { ...current, detail: "草案已保存到本地项目", hasProjectVibe: true, displayName: savedProjectTitle }
        : current);
      await connectCurrentProject({
        projectRoot: draftTarget.projectRoot,
        projectId: result.project.manifest.projectId,
        displayName: savedProjectTitle,
      }, { projectFileRootSelected: true }).catch(() => {
        setProjectSelectionStatus("error");
      });
    }

    applyProjectVibeProjectState(result.project, draftTarget, {
      newVideoDraft: draft,
      discussionWorkspace: context.discussionWorkspace,
      generatedAt,
    });
    const selectedNewShotId = result.selectedShotId || result.project.storyFlow.shotOrder[0] || result.project.shots[0]?.id;
    const selectedSection = result.project.storyFlow.sections.find((section) => selectedNewShotId && section.shotIds.includes(selectedNewShotId))
      || result.project.storyFlow.sections[0];
    if (selectedSection) setActiveSectionId(selectedSection.id);
    if (selectedNewShotId) {
      setSelectedShotId(selectedNewShotId);
      setSelectedShotIds([selectedNewShotId]);
    }
    setMode("director");
    setDirectorView("story");
    prototypeProjectDraftStatusRef.current = ({
      status: "saved",
      label: "草案已写入项目",
      targetId: saveResult.targetId,
      factHash: saveResult.factHash,
    });
    setLatestPrototypeAgentDemo({
      status: "ready",
      result: {
        label: "草案已写入故事流",
        projectVibeAdded: true,
        projectSaved: true,
        storageLabel: "已保存到项目",
        status: "ready",
      },
    });
    return true;
  }

  async function runLocalExportAction() {
    setExportActionState({
      status: "running",
      label: "正在生成导出包",
      exportRoot: localPreviewExportProjection.exportRoot,
      plannedWriteCount: localPreviewExportProjection.exportWorker.entries.filter((entry) => entry.operation === "write_file").length,
    });
    const bridge = typeof window !== "undefined" ? window.vibeRuntime : undefined;
    try {
      const nextState = await runExportAction({
        worker: localPreviewExportProjection.exportWorker,
        projectRoot: prototypeProjectDraftTarget.projectRoot || runtimeProjectIdentity?.projectRoot,
        bridge,
      });
      setExportActionState(nextState);
    } catch (e) {
      setExportActionState({
        status: "failed",
        label: `导出失败: ${e instanceof Error ? e.message : "未知错误"}`,
        exportRoot: localPreviewExportProjection.exportRoot,
      });
    }
  }

  async function applyDialogueAudioCreated(input: MinimalAudioPlanDialogueAudioCreated) {
    const outputRelativePath = input.payload.outputRelativePath;
    const generatedAt = new Date().toISOString();
    if (!outputRelativePath) {
      setLatestPrototypeAgentDemo({
        status: "error",
        result: {
          label: "配音已返回，但缺少可保存的音频路径",
          projectVibeAdded: false,
          waitingReview: true,
          status: "error",
        },
      });
      return;
    }

    const runtimeAudioInput = {
      shotId: input.shotId,
      outputRelativePath,
      providerId: "local-qwen3-tts-clone",
      receiptRelativePath: input.payload.receiptRelativePath,
      outputSha256: input.payload.outputSha256,
      outputSizeBytes: input.payload.outputSizeBytes,
      generatedAt,
    };
    setRuntimeState((current) => applyDialogueAudioMaterialToRuntimeState({
      runtimeState: current,
      ...runtimeAudioInput,
    }).runtimeState);

    const transactionPlan = buildDialogueAudioMaterialProjectVibeTransaction({
      project: prototypeProjectVibeRef.current,
      shotId: input.shotId,
      outputRelativePath,
      providerId: "local-qwen3-tts-clone",
      receiptRelativePath: input.payload.receiptRelativePath,
      outputSha256: input.payload.outputSha256,
      outputSizeBytes: input.payload.outputSizeBytes,
      transcript: input.text,
      generatedAt,
    });
    if (transactionPlan.status !== "ready" || !transactionPlan.transaction) {
      setLatestPrototypeAgentDemo({
        status: "error",
        result: {
          label: "配音已生成，项目素材待同步",
          projectVibeAdded: false,
          waitingReview: true,
          status: "error",
        },
      });
      return;
    }

    const patchResult = applyProjectVibeTransaction(prototypeProjectVibeRef.current, transactionPlan.transaction);
    if (patchResult.receipt.status !== "applied") {
      setLatestPrototypeAgentDemo({
        status: "error",
        result: {
          label: patchResult.receipt.errors[0] || "配音素材写入失败",
          projectVibeAdded: false,
          waitingReview: true,
          status: "error",
        },
      });
      return;
    }

    const saveResult = await saveProjectVibeDraft(prototypeProjectDraftTarget, patchResult.project);
    const nextState = buildProjectRuntimeStateFromProjectVibe({
      project: patchResult.project,
      projectRoot: prototypeProjectDraftTarget.projectRoot,
      projectPath: prototypeProjectDraftTarget.projectPath,
      generatedAt,
      knowledgeManifest: buildProjectLocalKnowledgeManifest(
        patchResult.project.manifest.projectId,
        projectLocalKnowledgePacks,
        generatedAt,
      ),
    });
    const withDialogueAudio = applyDialogueAudioMaterialToRuntimeState({
      runtimeState: nextState,
      ...runtimeAudioInput,
    }).runtimeState;
    setPrototypeProjectVibe(patchResult.project);
    setRuntimeState(withDialogueAudio);
    setAssetLibrary(createAssetLibraryFromRuntimeState(withDialogueAudio));
    prototypeProjectDraftStatusRef.current = ({
      status: saveResult.status,
      label: saveResult.ok ? "配音已作为素材写入项目" : "配音素材保存待重试",
      targetId: saveResult.targetId,
      factHash: saveResult.factHash,
      error: saveResult.errors[0],
    });
    setLatestPrototypeAgentDemo({
      status: saveResult.ok ? "ready" : "error",
      result: {
        label: saveResult.ok ? "配音素材已准备好" : "配音素材保存待重试",
        projectVibeAdded: true,
        projectSaved: saveResult.ok,
        storageLabel: saveResult.ok ? "已保存到项目" : "项目保存待重试",
        waitingReview: true,
        status: saveResult.ok ? "needs_review" : "error",
      },
    });
  }

  async function applyCreatorReviewDecision(item: CreatorReviewTrayItem, mode: "approve" | "lock" | "reject" | "retry", lockTarget: CreatorReviewLockTarget = "shot_reference") {
    const now = new Date().toISOString();
    const promotionMode = mode === "lock";
    const retryMode = mode === "retry";
    const rejectMode = mode === "reject";
    const requiresHashBoundOutput = mode === "approve" || promotionMode;
    if (requiresHashBoundOutput && (!item.mediaPath || !item.sourceReceiptId || !item.outputHash)) {
      setLatestPrototypeAgentDemo({
        status: "error",
        result: {
          label: "需要完整复核凭证",
          projectVibeAdded: false,
          waitingReview: true,
          status: "needs_review",
        },
      });
      return;
    }
    if (retryMode && !item.shotId) {
      setLatestPrototypeAgentDemo({
        status: "error",
        result: {
          label: "需要指定镜头后才能重试",
          projectVibeAdded: false,
          waitingReview: true,
          status: "needs_review",
        },
      });
      return;
    }

    const lockAssetKind = reviewLockAssetKind(lockTarget);
    const lockLabel = reviewLockTargetLabel(lockTarget);
    const assetId = promotionMode
      ? item.assetId || `asset_${safeProjectVibeId(`${item.id}_${lockTarget}`, item.shotId ? `${item.shotId}_${lockTarget}` : lockTarget)}`
      : undefined;
    const usedByShotIds = item.usedByShotIds?.length ? item.usedByShotIds : item.shotId ? [item.shotId] : [];
    const projectLabel = cleanReviewItemProjectLabel(item.label);
    const assetLabel = promotionMode ? `${lockLabel}：${projectLabel}` : projectLabel;
    if (effectiveRuntimeProjectIdentity) {
      try {
        const runtimeReviewResult = await submitCurrentProjectReviewDecision(effectiveRuntimeProjectIdentity, {
          action: mode,
          reviewedAt: now,
          reviewerId: "local_user",
          item: {
            id: item.id,
            shotId: item.shotId,
            assetId,
            assetType: item.assetType,
            label: projectLabel,
            mediaPath: item.mediaPath,
            sourceReceiptId: item.sourceReceiptId,
            outputHash: item.outputHash,
            status: item.status,
          },
          candidate: {
            shotId: item.shotId,
            assetId,
            assetKind: promotionMode ? lockAssetKind : undefined,
            label: projectLabel,
            outputPath: item.mediaPath,
            outputHash: item.outputHash,
            sourceReceiptId: item.sourceReceiptId,
            missingOutput: item.status === "missing" || retryMode,
            evidenceRefs: item.mediaPath ? [`preview#${item.id}`] : [`review_item#${item.id}`],
          },
          decision: {
            assetKind: promotionMode ? lockAssetKind : "reference",
            assetLabel,
            usedByShotIds,
          },
        });
        if (runtimeReviewResult.ok) {
          const refreshed = await loadProjectRealChainStatus(effectiveRuntimeProjectIdentity);
          setProjectRealChainState(refreshed);
          const reopened = await openProjectVibeDraft(prototypeProjectDraftTarget);
          if (reopened.ok && reopened.project && reopened.mode === "electron_project_file") {
            applyProjectVibeProjectState(reopened.project, prototypeProjectDraftTarget, { generatedAt: now });
          }
          setLatestPrototypeAgentDemo({
            status: "preview_ready",
            result: {
              label: runtimeReviewResult.message || (promotionMode ? "已锁定参考" : "已写入复核决定"),
              projectVibeAdded: runtimeReviewResult.projectVibeWritten === true,
              waitingReview: false,
              previewReady: true,
              status: runtimeReviewResult.status || "approved",
            },
          });
          return;
        }
        console.warn("Runtime review decision did not apply; falling back to local Project.vibe patch", runtimeReviewResult);
      } catch (error) {
        console.error("Runtime review decision failed; falling back to local Project.vibe patch", error);
      }
    }
    const result = buildProviderReviewPromotionTransaction({
      project: prototypeProjectVibeRef.current,
      candidate: {
        shotId: item.shotId,
        assetId,
        assetKind: promotionMode ? lockAssetKind : undefined,
        label: projectLabel,
        outputPath: item.mediaPath,
        outputHash: item.outputHash,
        sourceReceiptId: item.sourceReceiptId,
        missingOutput: item.status === "missing" || retryMode,
        evidenceRefs: item.mediaPath ? [`preview#${item.id}`] : [`review_item#${item.id}`],
      },
      decision: {
        status: retryMode ? "retry_requested" : rejectMode ? "rejected" : "approved",
        humanReviewed: true,
        reviewerId: "local_user",
        reviewedAt: now,
        retryRequested: retryMode ? true : undefined,
        promotionTarget: promotionMode ? "asset_and_locked_visual_memory" : "review_receipt_only",
        promotionAuthorization: promotionMode
          ? {
              authorized: true,
              authorizedBy: "local_user",
              authorizedAt: now,
            }
          : undefined,
        assetKind: promotionMode ? lockAssetKind : "reference",
        assetLabel,
        usedByShotIds,
      },
    });

    if (result.status !== "staged" || !result.transaction) {
      setLatestPrototypeAgentDemo({
        status: "error",
        result: {
          label: promotionMode
            ? "锁定前还需要完整复核凭证"
            : retryMode
              ? "重试前需要补齐镜头信息"
              : rejectMode
                ? "拒绝前需要补齐复核信息"
                : "需要补齐复核信息",
          projectVibeAdded: false,
          waitingReview: true,
          status: "needs_review",
        },
      });
      return;
    }

    const transaction = result.transaction;
    const promotedAssetId = assetId;
    if (promotionMode && promotedAssetId && item.shotId && (lockTarget === "character" || lockTarget === "scene" || lockTarget === "prop")) {
      const sourceShot = prototypeProjectVibeRef.current.shots.find((shot) => shot.id === item.shotId);
      if (sourceShot) {
        transaction.operations.push({
          op: "upsert_shot",
          shot: {
            ...sourceShot,
            characterAssetIds: lockTarget === "character"
              ? Array.from(new Set([...sourceShot.characterAssetIds, promotedAssetId]))
              : sourceShot.characterAssetIds,
            sceneAssetIds: lockTarget === "scene"
              ? Array.from(new Set([...sourceShot.sceneAssetIds, promotedAssetId]))
              : sourceShot.sceneAssetIds,
            propAssetIds: lockTarget === "prop"
              ? Array.from(new Set([...sourceShot.propAssetIds, promotedAssetId]))
              : sourceShot.propAssetIds,
            status: sourceShot.status === "blocked" ? sourceShot.status : "ready",
            sourceRefs: Array.from(new Set([
              ...sourceShot.sourceRefs,
              `project.vibe#assets/${promotedAssetId}`,
            ])),
          },
        });
      }
    }

    const patchResult = applyProjectVibeTransaction(prototypeProjectVibeRef.current, transaction);
    if (patchResult.receipt.status !== "applied") {
      setLatestPrototypeAgentDemo({
        status: "error",
        result: {
          label: patchResult.receipt.errors[0] || "复核记录未写入",
          projectVibeAdded: false,
          waitingReview: true,
          status: "error",
        },
      });
      return;
    }

    const saveResult = await saveProjectVibeDraft(prototypeProjectDraftTarget, patchResult.project);
    const nextState = buildProjectRuntimeStateFromProjectVibe({
      project: patchResult.project,
      projectRoot: prototypeProjectDraftTarget.projectRoot,
      projectPath: prototypeProjectDraftTarget.projectPath,
      generatedAt: now,
    });
    setPrototypeProjectVibe(patchResult.project);
    setRuntimeState(nextState);
    setAssetLibrary(createAssetLibraryFromRuntimeState(nextState));
    if (effectiveRuntimeProjectIdentity) {
      try {
        const refreshed = await loadProjectRealChainStatus(effectiveRuntimeProjectIdentity);
        setProjectRealChainState(refreshed);
      } catch (error) {
        console.error("Failed to refresh project workbench after review decision", error);
      }
    }
    prototypeProjectDraftStatusRef.current = ({
      status: saveResult.status,
      label: saveResult.ok ? "复核记录已写入项目" : "复核记录保存待重试",
      targetId: saveResult.targetId,
      factHash: saveResult.factHash,
      error: saveResult.errors[0],
    });
    setLatestPrototypeAgentDemo({
      status: saveResult.ok ? "preview_ready" : "error",
      result: {
        label: promotionMode
          ? `已锁为${lockLabel}`
          : retryMode
            ? "已写入重试请求"
            : rejectMode
              ? "已写入拒绝记录"
              : "已写入复核记录",
        projectVibeAdded: patchResult.receipt.status === "applied",
        projectSaved: saveResult.ok,
        storageLabel: saveResult.ok ? "已保存到项目" : "项目保存待重试",
        waitingReview: !promotionMode && !rejectMode,
        previewReady: true,
        status: promotionMode ? "complete" : rejectMode ? "rejected" : "needs_review",
      },
    });
  }

  async function preparePrototypeAgentDemo(input: PreviewPrototypeAgentDemoInput) {
    let projectVibeWritten = false;
    const selectedPrototypeShotId =
      input.selectedShotId
      || input.selectedShotIds?.[0]
      || workbenchSelectedShotId
      || prototypeProjectVibeRef.current.shots[0]?.id;
    if (!selectedPrototypeShotId) {
      setLatestPrototypeAgentDemo({
        status: "error",
        result: { label: "需要先选择镜头", projectVibeAdded: false, waitingReview: true },
      });
      throw new Error("Prototype Agent demo requires a selected shot.");
    }

    const sourceProject = prototypeProjectVibeRef.current.shots.some((shot) => shot.id === selectedPrototypeShotId)
      ? prototypeProjectVibeRef.current
      : createProjectVibeFromRuntimeState(workbenchRuntimeState);
    const userIntent = input.userIntent.trim() || `整理 ${selectedPrototypeShotId} 的预览画面`;
    const now = new Date().toISOString();
    setLatestPrototypeAgentDemo({
      status: "running",
      result: { label: "正在整理预览", projectVibeAdded: true, waitingReview: true },
    });

    try {
      const creativeLoop = confirmProjectVibeCreativeLoop({
        project: sourceProject,
        userIntent,
        selectedShotId: input.selectedShotIds && input.selectedShotIds.length > 1 ? undefined : selectedPrototypeShotId,
        selectedShotIds: input.selectedShotIds,
        selectedAssetId: input.selectedAssetId,
        sectionId: input.sectionId,
        generatedAt: now,
        projectRoot: prototypeProjectDraftTarget.projectRoot,
        projectPath: prototypeProjectDraftTarget.projectPath,
        userConfirmed: true,
      });
      if (creativeLoop.status !== "project_facts_written" || !creativeLoop.nextProject) {
        throw new Error(creativeLoop.blockedReasons[0] || "Project.vibe creative loop confirmation was blocked.");
      }
      const confirmedSaveResult = await saveProjectVibeDraft(prototypeProjectDraftTarget, creativeLoop.nextProject);
      projectVibeWritten = confirmedSaveResult.ok;
      setPrototypeProjectVibe(creativeLoop.nextProject);
      prototypeProjectDraftStatusRef.current = ({
        status: confirmedSaveResult.status,
        label: confirmedSaveResult.ok ? "已写入项目事实" : "项目事实保存待重试",
        targetId: confirmedSaveResult.targetId,
        factHash: confirmedSaveResult.factHash,
        error: confirmedSaveResult.errors[0],
      });
      setLatestPrototypeAgentDemo({
        status: "running",
        result: {
          label: confirmedSaveResult.ok ? "项目事实已写入，正在整理预览" : "项目事实保存待重试",
          projectVibeAdded: true,
          projectSaved: confirmedSaveResult.ok,
          storageLabel: confirmedSaveResult.ok ? "已写入项目事实" : "项目保存待重试",
          waitingReview: true,
        },
      });
      const result = await runDirectorPrototypeClosedLoop({
        project: creativeLoop.nextProject,
        userIntent,
        selectedShotId: selectedPrototypeShotId,
        now,
      });
      const saveResult = await saveProjectVibeDraft(prototypeProjectDraftTarget, result.nextProject);
      const storageLabel = saveResult.ok ? "已保存到项目" : "项目保存待重试";

      setPrototypeProjectVibe(result.nextProject);
      prototypeProjectDraftStatusRef.current = ({
        status: saveResult.status,
        label: storageLabel,
        targetId: saveResult.targetId,
        factHash: saveResult.factHash,
        error: saveResult.errors[0],
      });
      setPrototypePreviewItems((items) => [
        ...items.filter((item) => item.id !== result.previewItem.id),
        {
          id: result.previewItem.id,
          kind: "image_hold",
          shotId: result.previewItem.shotId,
          startSeconds: 0,
          durationSeconds: 5,
          mediaPath: result.previewItem.mediaPath,
          label: formatShotNumber(result.previewItem.shotId),
        },
      ]);
      setLatestPrototypeAgentDemo({
        status: "preview_ready",
        result: {
          label: "预览已生成、等待复核",
          projectVibeAdded: result.transactionReceipt.status === "applied",
          projectSaved: saveResult.ok,
          storageLabel,
          waitingReview: result.providerRequestSummary.reviewStatus === "approved",
          previewReady: true,
          status: "preview_ready",
        },
      });
    } catch (error) {
      setLatestPrototypeAgentDemo({
        status: "error",
        result: {
          label: "需要复核",
          projectVibeAdded: projectVibeWritten,
          waitingReview: true,
          status: "error",
        },
      });
      throw error;
    }
  }

  async function confirmDirectorFeedbackRecompile(recompile: DirectorFeedbackRecompileResult) {
    const generatedAt = new Date().toISOString();
    setLatestPrototypeAgentDemo({
      status: "running",
      result: {
        label: "正在写入修改计划",
        projectVibeAdded: true,
        waitingReview: true,
        status: "running",
      },
    });
    const applied = applyDirectorFeedbackRecompileToProjectVibe({
      project: prototypeProjectVibeRef.current,
      recompile,
      createdAt: generatedAt,
    });
    if (applied.status !== "applied") {
      setLatestPrototypeAgentDemo({
        status: "error",
        result: {
          label: applied.summary || "修改计划写入失败",
          projectVibeAdded: false,
          waitingReview: true,
          status: "error",
        },
      });
      throw new Error(applied.blockedReasons[0] || applied.summary);
    }

    const saveResult = await saveProjectVibeDraft(prototypeProjectDraftTarget, applied.project);
    const nextState = buildProjectRuntimeStateFromProjectVibe({
      project: applied.project,
      projectRoot: prototypeProjectDraftTarget.projectRoot,
      projectPath: prototypeProjectDraftTarget.projectPath,
      generatedAt,
      knowledgeManifest: buildProjectLocalKnowledgeManifest(
        applied.project.manifest.projectId,
        projectLocalKnowledgePacks,
        generatedAt,
      ),
    });
    setPrototypeProjectVibe(applied.project);
    setRuntimeState(nextState);
    setAssetLibrary(createAssetLibraryFromRuntimeState(nextState));
    setPrototypePreviewItems([]);
    setSelectedShotId(recompile.feedbackIntent.targetShotId);
    setSelectedShotIds([recompile.feedbackIntent.targetShotId]);
    createImage2GateForShot(recompile.feedbackIntent.targetShotId);
    prototypeProjectDraftStatusRef.current = ({
      status: saveResult.status,
      label: saveResult.ok ? "修改计划已写入项目" : "修改计划保存待重试",
      targetId: saveResult.targetId,
      factHash: saveResult.factHash,
      error: saveResult.errors[0],
    });
    setLatestPrototypeAgentDemo({
      status: saveResult.ok ? "ready" : "error",
      result: {
        label: saveResult.ok ? "修改计划已写入项目" : "修改计划保存待重试",
        projectVibeAdded: applied.projectVibeWritten,
        projectSaved: saveResult.ok,
        storageLabel: saveResult.ok ? "已保存到项目" : "项目保存待重试",
        waitingReview: true,
        status: saveResult.ok ? "ready" : "error",
      },
    });
    if (!saveResult.ok) throw new Error(saveResult.errors[0] || "修改计划保存失败");
  }

  function confirmOneShot() {
    setRuntimeState((current) => applyPreRealTestClosure(current, { generatedAt: new Date().toISOString() }).runtimeState);
  }

  async function bindProjectFileRootSelection(
    selection: ProjectRootDialogSelection,
    options: { detail?: string; loadedTargetId?: string } = {},
  ): Promise<ProjectVibeDraftTarget | undefined> {
    if (selection.cancelled || !selection.projectRoot) return undefined;
    const displayName = selection.displayName || selection.projectRoot.split(/[\\/]/).filter(Boolean).at(-1) || "未命名项目";
    setProjectPathInput(selection.projectRoot);
    setLoadedPrototypeProjectDraftTargetId(options.loadedTargetId);
    setProjectFileSelection({
      status: "selected",
      label: "切换项目",
      detail: options.detail || (selection.hasProjectVibe ? "当前项目已连接" : "会创建项目文件"),
      projectRoot: selection.projectRoot,
      projectPath: selection.projectPath,
      projectVibePath: selection.projectVibePath,
      hasProjectVibe: selection.hasProjectVibe,
      displayName,
    });
    setRecentProjectSelections(writeRememberedProjectSelection({ ...selection, displayName }));
    const target: ProjectVibeDraftTarget = {
      projectRoot: selection.projectRoot,
      projectPath: selection.projectPath,
      storageKey: prototypeProjectDraftStorageKeyValue,
    };
    applyProjectVibeProjectState(createEmptyProjectVibeForProjectRoot(selection.projectRoot, displayName), target);
    setProjectRealChainState({ status: "unavailable", message: "正在读取当前项目。" });
    setProjectImage2BatchState({ status: "unavailable", message: "正在同步当前项目复核状态。" });
    setProjectImage2OneShotState({ status: "unavailable", message: "正在同步当前项目小样状态。" });
    setRealImage2Gate(undefined);
    setActiveSectionId(undefined);
    setDirectorView("story");

    try {
      await connectCurrentProject({
        projectRoot: selection.projectRoot,
        displayName,
      }, { projectFileRootSelected: true });
    } catch {
      setProjectSelectionStatus("error");
    }

    return {
      projectRoot: selection.projectRoot,
      projectPath: selection.projectPath,
      storageKey: prototypeProjectDraftStorageKeyValue,
    };
  }

  async function createNewVideoLocalProject(
    draft?: NewVideoStartDraft,
    context?: NewVideoStartConfirmationContext,
    options: { reserveForImmediateSave?: boolean } = {},
  ): Promise<ProjectVibeDraftTarget | undefined> {
    if (!canCreateLocalProjectFromDialog) return undefined;
    const previousProjectFileSelection = projectFileSelection;
    setProjectFileSelection({
      status: "choosing",
      label: "选择文件夹",
      detail: "选择或新建一个项目文件夹",
    });

    try {
      const selection = await createLocalProject({
        displayName: projectDisplayNameFromDraft(draft, context),
      });
      if (selection.cancelled || !selection.projectRoot) {
        setProjectFileSelection((current) => current.status === "choosing"
          ? previousProjectFileSelection
          : current);
        return undefined;
      }

      const target: ProjectVibeDraftTarget = {
        projectRoot: selection.projectRoot,
        projectPath: selection.projectPath,
        storageKey: prototypeProjectDraftStorageKeyValue,
      };
      const targetId = options.reserveForImmediateSave ? buildProjectVibeDraftTargetId(target) : undefined;
      return bindProjectFileRootSelection(selection, {
        detail: "本地项目已准备，确认后会保存",
        loadedTargetId: targetId,
      });
    } catch (error) {
      setProjectFileSelection({
        status: "error",
        label: "选择失败",
        detail: error instanceof Error ? error.message : "项目文件夹选择失败",
      });
      setProjectSelectionStatus("error");
      return undefined;
    }
  }

  async function projectDraftTargetForNewVideoConfirmation(
    draft: NewVideoStartDraft,
    context: NewVideoStartConfirmationContext,
  ): Promise<ProjectVibeDraftTarget> {
    if (projectFileSelection.status === "selected") {
      if (!canRememberProjectRootFromDialog || !prototypeProjectDraftTarget.projectRoot) {
        return prototypeProjectDraftTarget;
      }
      try {
        const remembered = await rememberProjectRoot(prototypeProjectDraftTarget.projectRoot);
        if (remembered.cancelled || !remembered.projectRoot) return prototypeProjectDraftTarget;
        const displayName = projectFileSelection.displayName || remembered.displayName || projectFolderName(remembered.projectRoot);
        setRecentProjectSelections(writeRememberedProjectSelection({ ...remembered, displayName }));
        setProjectFileSelection((current) => current.status === "selected" && current.projectRoot === prototypeProjectDraftTarget.projectRoot
          ? {
            ...current,
            projectRoot: remembered.projectRoot!,
            projectPath: remembered.projectPath || current.projectPath,
            projectVibePath: remembered.projectVibePath || current.projectVibePath,
            hasProjectVibe: remembered.hasProjectVibe || current.hasProjectVibe,
            displayName,
          }
          : current);
        return {
          ...prototypeProjectDraftTarget,
          projectRoot: remembered.projectRoot,
          projectPath: remembered.projectPath || prototypeProjectDraftTarget.projectPath,
        };
      } catch (error) {
        console.error("Failed to prepare selected project folder for saving", error);
        return prototypeProjectDraftTarget;
      }
    }
    if (canCreateLocalProjectFromDialog) {
      const createdTarget = await createNewVideoLocalProject(draft, context, { reserveForImmediateSave: true });
      if (createdTarget) return createdTarget;
    }
    if (canChooseProjectRootFromDialog) {
      throw new Error("先新建或打开本地项目，再确认草案。");
    }
    return prototypeProjectDraftTarget;
  }

  async function chooseProjectFileRoot() {
    if (!canChooseProjectRootFromDialog) {
      setProjectFileSelection({
        status: "unavailable",
        label: "浏览器草稿",
        detail: "当前环境没有项目选择器",
      });
      return;
    }

    const previousProjectFileSelection = projectFileSelection;
    setProjectFileSelection({
      status: "choosing",
      label: "选择中",
      detail: "等待选择项目文件夹",
    });

    try {
      const selection = await chooseProjectRoot();
      if (selection.cancelled || !selection.projectRoot) {
        setProjectFileSelection((current) => current.status === "choosing"
          ? previousProjectFileSelection
          : current);
        return;
      }

      await bindProjectFileRootSelection(selection);
    } catch (error) {
      setProjectFileSelection({
        status: "error",
        label: "打开失败",
        detail: error instanceof Error ? error.message : "项目打开失败",
      });
      setProjectSelectionStatus("error");
    }
  }

  async function openRecentProject(selection: ProjectRootDialogSelection) {
    if (!selection.projectRoot) return;
    let nextSelection = selection;
    if (canRememberProjectRootFromDialog) {
      try {
        const electronSelection = await rememberProjectRoot(selection.projectRoot);
        if (!electronSelection.cancelled && electronSelection.projectRoot) {
          nextSelection = {
            ...electronSelection,
            displayName: selection.displayName || electronSelection.displayName,
          };
        }
      } catch {
        // Keep the local history usable; bindProjectFileRootSelection will surface any project read issue.
      }
    }
    await bindProjectFileRootSelection(nextSelection, { detail: "已切换项目" });
  }

  function resetAllProjectState() {
    setRuntimeState(fallbackRuntimeState);
    setAssetLibrary(createAssetLibraryFromRuntimeState(fallbackRuntimeState));
    setPrototypeProjectVibe(createProjectVibeFromRuntimeState(fallbackRuntimeState));
    prototypeProjectDraftStatusRef.current = ({ status: "idle", label: "本地项目待保存" });
    setPrototypePreviewItems([]);
    setLatestPrototypeAgentDemo(undefined);
    setAgentWebSearchSettings(loadAgentWebSearchSettings());
    setProjectLocalKnowledgePacks(loadProjectLocalKnowledgePacks(fallbackRuntimeState.sourceIndex.projectId));
    newVideoStagedTransactionRef.current = (undefined);
    setProjectFactsMode("save");
    setLatestProjectStoreApplyPlan(undefined);
    setExportActionState({ status: "idle", label: "导出待准备" });
    setProjectFileSelection({ status: "idle", label: "打开项目" });
    setLoadedPrototypeProjectDraftTargetId(undefined);
    setRealImage2Gate(undefined);
    setSelectedShotIds([]);
    setSelectedShotId("");
    setSelectedAssetId(undefined);
    setActiveSectionId(undefined);
    setDirectorView("story");
  }

  async function forgetProjectFileRoot() {
    const projectRootToForget = projectFileSelection.status === "selected" ? projectFileSelection.projectRoot : undefined;
    await forgetCurrentProject();
    if (projectRootToForget) {
      try {
        await window.vibeRuntime?.forgetProject?.(projectRootToForget);
      } catch {
        // Runtime binding and local remembered state are still cleared below.
      }
    } else {
      forgetBrowserProjectVibeDraft(prototypeProjectDraftTarget);
    }
    setRecentProjectSelections(clearRememberedProjectRoot(projectRootToForget));
    resetAllProjectState();
  }

  function removeRecentProjectRecord(projectRoot: string) {
    if (!projectRoot.trim()) return;
    setRecentProjectSelections(clearRememberedProjectRoot(projectRoot));
  }

  const { assetGenerationAction, runImage2AssetGeneration } = useImage2AssetGenerationAction({
    runtimeProjectIdentity,
    selectedShotId: workbenchSelectedShotId,
    selectedShotIds: workbenchSelectedShotIds,
    providerConfigStatuses,
    setProviderConfigStatuses,
    setProjectRealChainState,
  });
  async function runMissingVisualsFromStory() {
    const batch = projectImage2BatchState.summary;
    const retryCount = batch?.retrySummary?.nextRunnableCount || batch?.retrySummary?.retryScheduled || 0;
    const hasRunnableBatch = retryCount > 0;
    if (hasRunnableBatch) {
      await runProjectImage2Batch();
      return;
    }
    await runImage2AssetGeneration();
  }
  const { endFrameAction, runImage2EndFrame } = useImage2EndFrameAction({
    runtimeProjectIdentity,
    selectedShotId: workbenchSelectedShotId,
    providerConfigStatuses,
    setProviderConfigStatuses,
    setProjectRealChainState,
    openPreview: () => setDirectorView("preview"),
  });
  const { videoSubmitAction, runSeedanceVideoSubmit } = useSeedanceVideoSubmitAction({
    runtimeProjectIdentity,
    selectedShotIds: workbenchSelectedShotIds,
    providerConfigStatuses,
    setProviderConfigStatuses,
    setProjectRealChainState,
    openPreview: () => setDirectorView("preview"),
  });
  const pendingReferenceReviewCount = workbenchRuntimeState.visualMemory.assets.filter((asset) => {
    if (asset.lockedStatus === "locked" && asset.status !== "missing") return false;
    return asset.lockedStatus === "needs_review"
      || asset.lockedStatus === "candidate"
      || asset.lockedStatus === "not_generated"
      || asset.status === "missing"
      || asset.status === "planned";
  }).length;
  const gatedVideoSubmitAction = useMemo(() => {
    if (!videoSubmitAction || pendingReferenceReviewCount <= 0) return videoSubmitAction;
    return {
      ...videoSubmitAction,
      disabled: true,
      ready: false,
      message: "先复核参考素材，再提交视频。",
    };
  }, [pendingReferenceReviewCount, videoSubmitAction]);

  function lockVoiceSourceForProject(sourceId: string) {
    const generatedAt = new Date().toISOString();
    const result = updateVoiceSource(workbenchRuntimeState.voiceSourceLibrary, sourceId, {
      status: "locked",
      consentStatus: "user_owned",
      commercialUseStatus: "allowed",
      updatedAt: generatedAt,
    });
    if (!result.validation.ok) {
      setLatestPrototypeAgentDemo({
        status: "error",
        result: {
          label: result.validation.errors[0] || "音源暂时不能锁定",
          projectVibeAdded: false,
          waitingReview: true,
          status: "needs_review",
        },
      });
      return;
    }

    const voiceSources = toRuntimeVoiceSources(result.library);
    const runtime = {
      ...workbenchRuntimeState.runtime,
      config: {
        ...workbenchRuntimeState.runtime.config,
        voiceSources,
      },
    };
    const audioPlanning = buildAudioPlanningState({
      generatedAt,
      shots: workbenchRuntimeState.storyFlow.shots,
      runtimeConfig: runtime.config,
      previewEvents: workbenchRuntimeState.previewEvents,
      musicReferences: workbenchRuntimeState.audioPlanning.musicReferences,
    });
    const voiceAudioSettings = buildVoiceAudioSettingsState({
      generatedAt,
      voiceSourceLibrary: result.library,
      audioPlanning,
    });

    setRuntimeState({
      ...workbenchRuntimeState,
      generatedAt,
      runtime,
      voiceSourceLibrary: result.library,
      audioPlanning,
      voiceAudioSettings,
    });
    setLatestPrototypeAgentDemo({
      status: "ready",
      result: {
        label: "音源已确认授权并锁定",
        projectVibeAdded: false,
        waitingReview: false,
        status: "ready",
      },
    });
  }

  return (
    <div className={`app-shell minimal-shell ${mode === "director" && directorView === "preview" ? "preview-shell" : ""}`}>
      <MinimalTopNav
        projectTitle={visibleProjectTitle}
        projectPlan={projectPlan}
        mode={mode}
        directorView={directorView}
        sections={isEmptyFallbackWorkbench ? [] : view.storySections}
        activeSectionId={isEmptyFallbackWorkbench ? undefined : resolvedActiveSectionId}
        projectFileStatusLabel={projectFileStatusLabel}
        projectFileStatusDetail={projectFileStatusDetail}
        projectRoot={projectControlRoot}
        currentProjectPath={projectFileSelection.status === "selected" ? projectFileSelection.projectPath : effectiveRuntimeProjectBinding.projectVibePath}
        recentProjects={recentProjectSelections.map((selection) => ({
          projectRoot: selection.projectRoot || "",
          displayName: selection.displayName || projectFolderName(selection.projectRoot),
          projectPath: selection.projectPath,
          updatedAt: selection.updatedAt,
          hasProjectVibe: selection.hasProjectVibe,
        }))}
        canCreateProject={canCreateLocalProjectFromDialog && projectFileSelection.status !== "choosing"}
        onCreateProject={() => { void createNewVideoLocalProject(undefined, undefined); }}
        canChooseProjectRoot={canChooseProjectRootFromDialog && projectFileSelection.status !== "choosing"}
        onChooseProjectRoot={chooseProjectFileRoot}
        canForgetProject={localProjectReadyForUi || (!isEmptyFallbackWorkbench && hasWorkbenchProjectContent)}
        onForgetProject={() => { void forgetProjectFileRoot(); }}
        onOpenRecentProject={(selection) => { void openRecentProject({ ...selection, cancelled: false }); }}
        onRemoveRecentProject={removeRecentProjectRecord}
        onOpenDirectorView={openDirectorView}
        onOpenSection={openSection}
        showInspector={showInspector}
        onOpenInspector={() => setShowInspector(true)}
      />

      {mode !== "director" && (
        <AppOverview audit={audit} view={view} blockerCount={blockers.length} />
      )}

      {mode !== "director" && audit.workflow.length > 0 && <Workflow stages={audit.workflow} />}

      {mode === "director" && (
        <ErrorBoundary fallbackLabel="导演视图">
          <DirectorMode
          audit={audit}
          view={view}
          runtimeState={workbenchRuntimeState}
          projectScopeLabel={workbenchProjectScopeLabel}
          selectedShot={visibleSelectedShot}
          selectedShots={visibleSelectedShots}
          selectedAsset={selectedAsset}
          selectedShotId={workbenchSelectedShotId}
          selectedShotIds={workbenchSelectedShotIds}
          currentProjectPreviewItems={directorPreviewQueue}
          localPreviewExport={localPreviewExportProjection.previewExport}
          exportWorker={localPreviewExportProjection.exportWorker}
          exportAction={exportActionState}
          previewEmptyStateLabel={currentProjectPreviewEmptyState.label}
          previewEmptyStateDetail={currentProjectPreviewEmptyState.detail}
          realSampleAction={assetGenerationAction}
          endFrameAction={endFrameAction}
          videoSendAction={gatedVideoSubmitAction}
          webSearchSettings={agentWebSearchSettings}
          projectReferenceGuide={projectLocalKnowledgeManifest}
          storyboardProjectPlanInput={storyboardProjectPlanInput}
          onDirectorFeedbackConfirmed={confirmDirectorFeedbackRecompile}
          onSaveResearchAsReference={saveResearchAsProjectReference}
          creatorDesk={creatorDeskProjection}
          projectContentReady={projectContentReadyForUi}
          directorView={directorView}
          activeSectionId={resolvedActiveSectionId}
          statusNode={
            <MinimalDirectorStatusDot
              state={workbenchProgressState}
            />
          }
          assetLibraryNode={
            <MinimalAssetLibrary
              library={workbenchAssetLibrary}
              readOnlyDetail={workbenchAssetReadOnlyDetail}
              selectedAssetId={selectedAssetId}
              onSelectAsset={setSelectedAssetId}
              onAddAsset={addAsset}
              onUpdateAsset={updateAsset}
              onMarkAssetStatus={markAssetStatus}
              assetGenerationAction={assetGenerationAction}
              onGenerateAssets={runImage2AssetGeneration}
              localProjectReady={localProjectReadyForUi}
              voiceSourceLibrary={workbenchRuntimeState.voiceSourceLibrary}
              onLockVoiceSource={lockVoiceSourceForProject}
            />
          }
          onSelectShot={selectShot}
          onRunExport={runLocalExportAction}
          onCreateP6RealSample={runImage2AssetGeneration}
          onCreateImage2EndFrame={runImage2EndFrame}
          onSendSeedanceVideo={runSeedanceVideoSubmit}
          onDialogueAudioCreated={applyDialogueAudioCreated}
          onRetryMissingBatch={runMissingVisualsFromStory}
          onRetryReviewItem={(item) => applyCreatorReviewDecision(item, "retry")}
          onApproveReviewItem={(item) => applyCreatorReviewDecision(item, "approve")}
          onRejectReviewItem={(item) => applyCreatorReviewDecision(item, "reject")}
          onLockReviewItem={(item, target) => applyCreatorReviewDecision(item, "lock", target)}
          onNewVideoDraftConfirmed={confirmNewVideoProjectVibeDraft}
          onCreateLocalProject={(draft) => createNewVideoLocalProject(draft, undefined, { reserveForImmediateSave: true })}
          localProjectReady={localProjectReadyForUi}
          localProjectBusy={projectFileSelection.status === "choosing"}
          canCreateLocalProject={canCreateLocalProjectFromDialog && projectFileSelection.status !== "choosing"}
          onProjectStoreApplyPlanReady={(plan) => {
            setLatestProjectStoreApplyPlan(plan);
            createImage2GateForShot(workbenchSelectedShotId);
          }}
          latestPrototypeAgentDemo={latestPrototypeAgentDemo}
          onPreviewPrototypeAgentDemo={preparePrototypeAgentDemo}
        />
        </ErrorBoundary>
      )}
      {mode === "inspector" && (
        <Suspense fallback={null}>
          <InspectorMode audit={runtimeAudit} view={runtimeView} runtimeState={runtimeState} selectedShot={selectedShot} selectedAsset={selectedAsset} />
        </Suspense>
      )}
      {showInspector && (
        <div className="diagnostics-overlay" role="dialog" aria-label="设置">
          <div className="diagnostics-overlay-header">
            <h2>设置</h2>
            <button className="diagnostics-overlay-close" onClick={() => setShowInspector(false)} aria-label="关闭设置">
              关闭
            </button>
          </div>
          <div className="diagnostics-overlay-body">
            <Suspense fallback={null}>
              <DiagnosticsMode
                audit={runtimeAudit}
                view={runtimeView}
                runtimeState={runtimeState}
                selectedShot={selectedShot}
                selectedShotId={workbenchSelectedShotId}
                projectRealChainState={projectRealChainState}
                projectImage2BatchState={projectImage2BatchState}
                projectImage2OneShotState={projectImage2OneShotState}
                strictEditPreflightState={strictEditPreflightState}
                runtimeProjectBinding={runtimeProjectBinding}
                authorizationRef={authorizationRef}
                webSearchSettings={agentWebSearchSettings}
                projectPathInput={projectPathInput}
                projectChoices={projectChoices}
                projectSelectionStatus={projectSelectionStatus}
                canChooseProjectRoot={canChooseProjectRootFromDialog && projectFileSelection.status !== "choosing"}
                projectFileStatusLabel={projectFileStatusLabel}
                projectFileStatusDetail={projectFileStatusDetail}
                projectFacts={projectFacts}
                projectFactsMode={projectFactsMode}
                latestProjectStoreApplyPlan={latestProjectStoreApplyPlan}
                onProjectPathChange={setProjectPathInput}
                onSelectProjectChoice={selectProjectChoice}
                onChooseProjectRoot={chooseProjectFileRoot}
                onConnectProject={() => { void connectCurrentProject(); }}
                onRunProjectRealChain={runProjectRealChain}
                onRunProjectImage2Batch={runProjectImage2Batch}
                onProjectFactsModeChange={setProjectFactsMode}
                onPrepareStrictEditPreflight={prepareStrictEditPreflight}
                onPrepareImage2OneShot={() => { void prepareImage2OneShot(workbenchSelectedShotId); }}
                onAuthorizationRefChange={setAuthorizationRef}
                onPrepareImage2OneShotPermissionReceipt={prepareImage2OneShotPermissionReceipt}
                onConfirmImage2OneShot={confirmImage2OneShot}
                onCheckImage2OneShotReturn={checkImage2OneShotReturn}
                onWebSearchSettingsChange={updateAgentWebSearchSettings}
              />
              {realImage2Gate && (
                <details className="settings-advanced diagnostics-advanced-panels">
                  <summary>
                    <span>Image2 许可闸门</span>
                    <small>真实提交排查用，平时不用打开</small>
                  </summary>
                  <div className="diagnostics-advanced-grid">
                    <RealImage2GateDiagnostics
                      gate={realImage2Gate}
                      onUnlock={() => {
                        if (realImage2Gate) setRealImage2Gate(unlockRealImage2Gate(realImage2Gate));
                      }}
                      onGenerate={unlockAndGenerateImage2Shot}
                      onPromote={promoteImage2Artifact}
                      onReset={resetImage2Gate}
                    />
                  </div>
                </details>
              )}
            </Suspense>
          </div>
        </div>
      )}

      {mode !== "director" && (
        <footer className="policy-note">
          <LockKeyhole size={16} />
          <span>Hard lock: provider policy, preflight, reference authority, keyframe pair derivation, and QA gates cannot be overridden by Knowledge Packs or natural-language input.</span>
        </footer>
      )}

      <footer className="footer-signature">
        <img src="/zc-signature-transparent.png" alt="" aria-hidden="true" />
      </footer>
    </div>
  );
}

export default App;
