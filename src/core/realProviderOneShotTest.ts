import type { RealProviderExecutorRequestPreview, RealProviderExecutorState } from "./realProviderExecutor";

export const realProviderOneShotTestSchemaVersion = "0.1.0";

export type RealProviderOneShotTestMode = "locked" | "one_shot_review";
export type RealProviderOneShotTestStatus = "locked" | "blocked" | "ready_for_action_time_confirmation";

export interface RealProviderOneShotTestHardLocks {
  defaultLocked: true;
  actualExecutionAllowed: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  canSpawnWorker: false;
  noSubprocess: true;
  noShellExecution: true;
  noFileMutation: true;
  automaticRetryAllowed: false;
  maxConcurrency: 1;
  maxAutoRetries: 0;
  singleActionOnly: true;
  oneShotOnly: true;
  image2Only: true;
  seedanceParked: true;
  videoProvidersParked: true;
}

export interface RealProviderOneShotTestActionReview {
  status: "ready" | "blocked" | "locked";
  canAskUserForActionTimeConfirmation: boolean;
  actionTimeConfirmationRequired: true;
  userConfirmedAtActionTime: false;
  confirmationReceiptPresent: false;
  singleUseOnly: true;
  scope: "single_image2_one_shot";
  reviewCopy: string;
  blockers: string[];
}

export interface RealProviderOneShotTestPlannedAction {
  actionId: string;
  providerId: string;
  providerSlot: RealProviderExecutorRequestPreview["providerSlot"];
  requiredMode: RealProviderExecutorRequestPreview["requiredMode"];
  operation?: RealProviderExecutorRequestPreview["operation"];
  shotId?: string;
  taskPlanId?: string;
  outputPath?: string;
  requestPreviewId?: string;
  sourceRequestId?: string;
  requestPreviewStatus: RealProviderExecutorRequestPreview["status"];
  dryRunPreviewReviewed: boolean;
  actualExecutionAllowed: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  canSpawnWorker: false;
  noFileMutation: true;
}

export interface RealProviderOneShotTestState {
  schemaVersion: string;
  generatedAt: string;
  phase: "phase_45_one_shot_live_test_gate";
  mode: RealProviderOneShotTestMode;
  status: RealProviderOneShotTestStatus;
  sourceExecutorStatus: RealProviderExecutorState["status"];
  selectedShotIds: string[];
  selectedTaskPlanIds: string[];
  plannedAction?: RealProviderOneShotTestPlannedAction;
  actionReview: RealProviderOneShotTestActionReview;
  budgetSnapshot: {
    status: RealProviderExecutorState["budgetGuard"]["status"];
    estimatedImageCount?: number;
    maxImagesPerPilot: number;
    selectedShotCount: number;
    selectedTaskPlanCount: number;
    blockers: string[];
  };
  outputWatcherExpectation: {
    sandboxRoot?: string;
    expectedOutputCount: number;
    manifestPath?: string;
    qaReportPath?: string;
    watcherStarted: false;
    daemonStarted: false;
    planOnly: true;
  };
  blockers: string[];
  warnings: string[];
  summary: {
    readyForActionTimeConfirmation: boolean;
    canAskUserForActionTimeConfirmation: boolean;
    userConfirmedAtActionTime: false;
    confirmationReceiptPresent: false;
    actualExecutionAllowed: false;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
    credentialAccessAllowed: false;
    workerSpawnsAllowed: 0;
    fileMutationsAllowed: 0;
    maxConcurrency: 1;
    maxAutoRetries: 0;
  };
  hardLocks: RealProviderOneShotTestHardLocks;
  forbiddenActions: Array<
    | "provider_submit_without_action_confirmation"
    | "automatic_submit"
    | "credential_read"
    | "credential_write"
    | "worker_start"
    | "subprocess"
    | "shell_execution"
    | "file_mutation"
    | "automatic_retry"
    | "seedance_execution"
    | "video_submit"
  >;
  notes: string[];
}

export interface BuildRealProviderOneShotTestStateInput {
  generatedAt: string;
  mode?: RealProviderOneShotTestMode;
  realProviderExecutor?: RealProviderExecutorState;
}

export const realProviderOneShotTestHardLocks: RealProviderOneShotTestHardLocks = {
  defaultLocked: true,
  actualExecutionAllowed: false,
  providerSubmitAllowed: 0,
  liveSubmitAllowed: false,
  credentialAccessAllowed: false,
  canSpawnWorker: false,
  noSubprocess: true,
  noShellExecution: true,
  noFileMutation: true,
  automaticRetryAllowed: false,
  maxConcurrency: 1,
  maxAutoRetries: 0,
  singleActionOnly: true,
  oneShotOnly: true,
  image2Only: true,
  seedanceParked: true,
  videoProvidersParked: true,
};

function safeId(value: string | undefined): string {
  const safe = (value || "unscoped").trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return safe || "unscoped";
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).sort((left, right) => left.localeCompare(right));
}

function firstReadyPreview(executor?: RealProviderExecutorState): RealProviderExecutorRequestPreview | undefined {
  return executor?.providerRequestPreviews.find((preview) => preview.status === "preview_ready");
}

function oneShotBlockers(executor: RealProviderExecutorState | undefined, preview: RealProviderExecutorRequestPreview | undefined): string[] {
  if (!executor) return ["Phase44 Real Provider Executor state is required."];
  return uniqueSorted([
    executor.mode === "executor_review" ? "" : "Phase45 requires Phase44 executor_review mode.",
    executor.status === "review_ready" ? "" : "Phase44 executor must be review-ready before a one-shot live test can be prepared.",
    executor.oneShotReadiness.status === "reviewable_not_executable" ? "" : "One-shot readiness must be reviewable-not-executable.",
    executor.budgetGuard.status === "passed" ? "" : "Budget guard must pass before action-time confirmation.",
    executor.budgetGuard.selectedShotCount === 1 ? "" : "One-shot test requires exactly one selected shot.",
    (executor.budgetGuard.estimatedImageCount || 0) > 0 && (executor.budgetGuard.estimatedImageCount || 0) <= 2
      ? ""
      : "One-shot test allows no more than two Image2 images.",
    preview ? "" : "A preview-ready Image2 request is required.",
    preview && preview.status !== "preview_ready" ? "The selected Image2 request preview must be preview-ready." : "",
    executor.summary.actualExecutionAllowed === false ? "" : "Phase44 executor must not already allow actual execution.",
    executor.summary.providerSubmitAllowed === 0 ? "" : "Phase44 executor must keep provider submit allowance at zero.",
    executor.summary.liveSubmitAllowed === false ? "" : "Phase44 executor must keep live submit disabled.",
    executor.summary.credentialAccessAllowed === false ? "" : "Credential access must remain closed.",
    executor.summary.workerSpawnsAllowed === 0 ? "" : "Worker spawn routes must remain closed.",
    executor.outputWatcherBridgePlan.planOnly === true ? "" : "Output watcher bridge must still be plan-only.",
  ]);
}

function buildPlannedAction(preview: RealProviderExecutorRequestPreview | undefined): RealProviderOneShotTestPlannedAction | undefined {
  if (!preview) return undefined;
  return {
    actionId: `phase45_one_shot_${safeId(preview.previewId)}`,
    providerId: preview.providerId,
    providerSlot: preview.providerSlot,
    requiredMode: preview.requiredMode,
    operation: preview.operation,
    shotId: preview.shotId,
    taskPlanId: preview.taskPlanId,
    outputPath: preview.outputPath,
    requestPreviewId: preview.previewId,
    sourceRequestId: preview.sourceRequestId,
    requestPreviewStatus: preview.status,
    dryRunPreviewReviewed: preview.status === "preview_ready",
    actualExecutionAllowed: false,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    credentialAccessAllowed: false,
    canSpawnWorker: false,
    noFileMutation: true,
  };
}

export function buildRealProviderOneShotTestState(input: BuildRealProviderOneShotTestStateInput): RealProviderOneShotTestState {
  const mode = input.mode || "locked";
  const executor = input.realProviderExecutor;
  const preview = firstReadyPreview(executor);
  const blockers = oneShotBlockers(executor, preview);
  const status: RealProviderOneShotTestStatus = mode === "locked"
    ? "locked"
    : blockers.length
      ? "blocked"
      : "ready_for_action_time_confirmation";
  const canAsk = status === "ready_for_action_time_confirmation";

  return {
    schemaVersion: realProviderOneShotTestSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "phase_45_one_shot_live_test_gate",
    mode,
    status,
    sourceExecutorStatus: executor?.status || "locked",
    selectedShotIds: executor?.selectedShotIds || [],
    selectedTaskPlanIds: executor?.selectedTaskPlanIds || [],
    plannedAction: buildPlannedAction(preview),
    actionReview: {
      status: mode === "locked" ? "locked" : blockers.length ? "blocked" : "ready",
      canAskUserForActionTimeConfirmation: canAsk,
      actionTimeConfirmationRequired: true,
      userConfirmedAtActionTime: false,
      confirmationReceiptPresent: false,
      singleUseOnly: true,
      scope: "single_image2_one_shot",
      reviewCopy: canAsk
        ? "等待用户动作时确认后，才允许进入一次性 Image2 小样执行步骤。"
        : "先完成 Phase44 复核、预算、请求预览和输出监听计划。",
      blockers,
    },
    budgetSnapshot: {
      status: executor?.budgetGuard.status || "blocked",
      estimatedImageCount: executor?.budgetGuard.estimatedImageCount,
      maxImagesPerPilot: executor?.budgetGuard.maxImagesPerPilot || 3,
      selectedShotCount: executor?.budgetGuard.selectedShotCount || 0,
      selectedTaskPlanCount: executor?.budgetGuard.selectedTaskPlanCount || 0,
      blockers: executor?.budgetGuard.blockers || [],
    },
    outputWatcherExpectation: {
      sandboxRoot: executor?.outputWatcherBridgePlan.sandboxRoot,
      expectedOutputCount: executor?.outputWatcherBridgePlan.expectedOutputs.length || 0,
      manifestPath: executor?.outputWatcherBridgePlan.manifestPath,
      qaReportPath: executor?.outputWatcherBridgePlan.qaReportPath,
      watcherStarted: false,
      daemonStarted: false,
      planOnly: true,
    },
    blockers,
    warnings: uniqueSorted([
      ...(executor?.warnings || []),
      "Phase45 prepares the action-time confirmation boundary only; this state does not submit Image2.",
      "After user confirmation, the next implementation must create a one-use receipt before any provider call.",
    ]),
    summary: {
      readyForActionTimeConfirmation: canAsk,
      canAskUserForActionTimeConfirmation: canAsk,
      userConfirmedAtActionTime: false,
      confirmationReceiptPresent: false,
      actualExecutionAllowed: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      workerSpawnsAllowed: 0,
      fileMutationsAllowed: 0,
      maxConcurrency: 1,
      maxAutoRetries: 0,
    },
    hardLocks: realProviderOneShotTestHardLocks,
    forbiddenActions: [
      "provider_submit_without_action_confirmation",
      "automatic_submit",
      "credential_read",
      "credential_write",
      "worker_start",
      "subprocess",
      "shell_execution",
      "file_mutation",
      "automatic_retry",
      "seedance_execution",
      "video_submit",
    ],
    notes: [
      "Phase45 is the final review gate before a one-shot live Image2 test.",
      "This state can ask for action-time confirmation, but it never records confirmation by itself.",
      "No provider request, credential read, worker route, output watcher daemon, or file mutation is enabled here.",
    ],
  };
}
