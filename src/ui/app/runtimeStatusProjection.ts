import type { ProjectRuntimeState } from "../../core/projectState";
import type { MotionEndpointContract } from "../../core/types";
import { statusLabel } from "../common/DiagnosticsPrimitives";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type ImagePipelineState = ProjectRuntimeState["imagePipeline"];
export type VideoPlanningState = ProjectRuntimeState["videoPlanning"];
export type VideoExecutionPreviewState = ProjectRuntimeState["videoExecutionPreview"];
export type VideoExecutionPreviewRow = VideoExecutionPreviewState["previews"][number];
type VideoReadinessGateState = VideoPlanningState["readinessGates"][number];
type VideoTaskPlanState = VideoPlanningState["taskPlans"][number];

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

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readOptionalBoolean(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
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

function readBooleanLockLabel(record: Record<string, unknown>, key: string, label: string, expected: boolean) {
  return record[key] === expected ? label : undefined;
}

function formatHarnessValue(value: unknown, fallbackLabel = "value"): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (!isRecord(value)) return "";

  const label = readString(value.label, readString(value.id, readString(value.name, fallbackLabel)));
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

function emptyVideoPlanning(): VideoPlanningState {
  return {
    schemaVersion: "0.1.0",
    generatedAt: "",
    readinessGates: [],
    taskPlans: [],
    queueShell: {
      status: "empty",
      counts: { total: 0, pending: 0, ready: 0, blocked: 0, parked: 0 },
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
