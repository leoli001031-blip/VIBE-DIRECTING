import type { ExecutionLedgerOutputSandbox, ExecutionLedgerState } from "./executionLedger";
import type { RealExecutionGateState } from "./realExecutionGate";
import type { RealProviderPilotOutputRole, RealProviderPilotState } from "./realProviderPilot";
import type { ProviderExecutionHandoffState } from "./providerExecutionHandoff";
import type { Image2AdapterRequest, ImageTaskPlan, ProviderSlot, RequiredMode } from "./types";

export const realProviderExecutorSchemaVersion = "0.1.0";

export type RealProviderExecutorMode = "locked" | "executor_review";
export type RealProviderExecutorStatus = "locked" | "blocked" | "review_ready";
export type RealProviderExecutorPreviewStatus = "preview_ready" | "blocked" | "parked";
export type RealProviderExecutorOneShotStatus =
  | "reviewable_not_executable"
  | "blocked"
  | "not_one_shot";

export interface RealProviderExecutorHardLocks {
  defaultLocked: true;
  executorEnabled: false;
  actualExecutionAllowed: false;
  canExecute: false;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  providerSubmitAllowedBoolean: false;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  credentialReadAllowed: false;
  credentialWriteAllowed: false;
  canSpawnWorker: false;
  noWorkerSpawn: true;
  noSubprocess: true;
  noShellExecution: true;
  noFileMutation: true;
  canMutateFiles: false;
  automaticRetryAllowed: false;
  maxConcurrency: 1;
  maxAutoRetries: 0;
  dryRunOnly: true;
  manualSubmitRequired: true;
  liveSubmitForbidden: true;
  requestPreviewOnly: true;
  outputWatcherPlanOnly: true;
  autoPromoteAllowed: false;
  seedanceParked: true;
  videoProvidersParked: true;
}

export interface RealProviderExecutorBudgetGuard {
  status: "passed" | "blocked";
  estimatedImageCount?: number;
  maxImagesPerPilot: number;
  selectedShotCount: number;
  selectedShotIds: string[];
  selectedTaskPlanCount: number;
  checks: Array<{
    checkId:
      | "estimated_image_count_positive"
      | "max_images_per_pilot_lte_3"
      | "estimated_images_within_pilot_cap"
      | "selected_shot_count_lte_3";
    required: true;
    passed: boolean;
    blocker?: string;
  }>;
  blockers: string[];
  reviewOnly: true;
  actualExecutionAllowed: false;
}

export interface RealProviderExecutorQuotaConcurrencyRetryPolicy {
  quotaPolicy: {
    maxImagesPerPilot: number;
    estimatedImageCount?: number;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
    actualExecutionAllowed: false;
  };
  concurrencyPolicy: {
    maxConcurrency: 1;
    activeProviderRequestsAllowed: 0;
    queueOnly: true;
    canSpawnWorker: false;
  };
  retryPolicy: {
    automaticRetryAllowed: false;
    maxAutoRetries: 0;
    manualRetryRequiresNewUserReview: true;
  };
}

export interface RealProviderExecutorConfirmationChecklistItem {
  confirmationId:
    | "review_real_provider_pilot"
    | "review_real_execution_gate"
    | "review_execution_ledger"
    | "review_budget_guard"
    | "review_request_previews"
    | "action_time_user_confirmation"
    | "confirm_no_credentials_workers_or_file_mutation";
  label: string;
  requiredBeforeAnyFutureSubmit: true;
  present: boolean;
  satisfied: false;
  blocker: string;
  sourceRef?: string;
}

export interface RealProviderExecutorRequestPreview {
  previewId: string;
  sourceRequestId?: string;
  taskPlanId?: string;
  jobId?: string;
  shotId?: string;
  providerId: string;
  providerSlot: ProviderSlot;
  requiredMode: RequiredMode;
  adapterId?: string;
  operation?: Image2AdapterRequest["operation"];
  outputPath?: string;
  status: RealProviderExecutorPreviewStatus;
  blockers: string[];
  warnings: string[];
  submitPolicy: {
    dry_run_only: true;
    manual_submit_required: true;
    live_submit_forbidden: true;
  };
  fallbackPolicy: {
    noProviderOrModeFallback: true;
    inheritedForbiddenFallbacks: string[];
  };
  dryRunOnly: true;
  manualSubmitRequired: true;
  liveSubmitAllowed: false;
  liveSubmitForbidden: true;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  credentialAccessAllowed: false;
  canSpawnWorker: false;
  noFileMutation: true;
}

export interface RealProviderExecutorOutputWatcherBridgePlan {
  sandboxRoot?: string;
  expectedOutputs: Array<{
    shotId?: string;
    role?: RealProviderPilotOutputRole | "unknown";
    path: string;
    source: "real_provider_pilot" | "execution_ledger" | "image2_request";
  }>;
  manifestPath?: string;
  qaReportPath?: string;
  watchGlobs: string[];
  watcherStarted: false;
  daemonStarted: false;
  noFileMutation: true;
  fileMutationAllowed: false;
  autoPromoteAllowed: false;
  promotionAllowed: false;
  planOnly: true;
}

export interface RealProviderExecutorOneShotReadiness {
  status: RealProviderExecutorOneShotStatus;
  selectedShotCount: number;
  estimatedImageCount?: number;
  confirmationSatisfied: false;
  reviewable: boolean;
  executable: false;
  actualExecutionAllowed: false;
  providerSubmitAllowed: 0;
  blockers: string[];
  notes: string[];
}

export interface RealProviderExecutorState {
  schemaVersion: string;
  generatedAt: string;
  phase: "phase_44_real_provider_executor_shell";
  mode: RealProviderExecutorMode;
  status: RealProviderExecutorStatus;
  projectId?: string;
  batchId?: string;
  selectedShotIds: string[];
  selectedTaskPlanIds: string[];
  executor: {
    status: RealProviderExecutorStatus;
    executorEnabled: false;
    readyForUserReviewOnly: boolean;
    actualExecutionAllowed: false;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
    credentialAccessAllowed: false;
    canSpawnWorker: false;
    noFileMutation: true;
  };
  budgetGuard: RealProviderExecutorBudgetGuard;
  quotaConcurrencyRetryPolicy: RealProviderExecutorQuotaConcurrencyRetryPolicy;
  actionTimeConfirmationChecklist: RealProviderExecutorConfirmationChecklistItem[];
  providerRequestPreviews: RealProviderExecutorRequestPreview[];
  parkedProviderPreviews: RealProviderExecutorRequestPreview[];
  outputWatcherBridgePlan: RealProviderExecutorOutputWatcherBridgePlan;
  oneShotReadiness: RealProviderExecutorOneShotReadiness;
  blockers: string[];
  warnings: string[];
  summary: {
    totalProviderRequestPreviews: number;
    previewReady: number;
    blocked: number;
    parked: number;
    reviewReady: number;
    executorEnabled: false;
    actualExecutionAllowed: false;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
    credentialAccessAllowed: false;
    workerSpawnsAllowed: 0;
    fileMutationsAllowed: 0;
    automaticRetryAllowed: false;
    maxConcurrency: 1;
    maxAutoRetries: 0;
  };
  hardLocks: RealProviderExecutorHardLocks;
  forbiddenActions: Array<
    | "provider_submit"
    | "live_submit"
    | "credential_read"
    | "credential_write"
    | "worker_start"
    | "subprocess"
    | "shell_execution"
    | "file_mutation"
    | "automatic_retry"
    | "image2_execution"
    | "seedance_execution"
    | "video_submit"
    | "output_watcher_daemon"
    | "auto_promote"
  >;
  executorEnabled: false;
  actualExecutionAllowed: false;
  providerSubmitAllowed: false;
  liveSubmitAllowed: false;
  credentialAccessAllowed: false;
  canSpawnWorker: false;
  noFileMutation: true;
  automaticRetryAllowed: false;
  dryRunOnly: true;
  notes: string[];
}

export interface BuildRealProviderExecutorStateInput {
  generatedAt: string;
  mode?: RealProviderExecutorMode;
  projectId?: string;
  batchId?: string;
  selectedShotIds?: string[];
  selectedTaskPlanIds?: string[];
  estimatedImageCount?: number;
  maxImagesPerPilot?: number;
  realProviderPilot?: RealProviderPilotState;
  realExecutionGate?: RealExecutionGateState;
  executionLedger?: ExecutionLedgerState;
  providerExecutionHandoff?: ProviderExecutionHandoffState;
  outputSandbox?: Partial<ExecutionLedgerOutputSandbox>;
  imageTaskPlans?: ImageTaskPlan[];
  image2AdapterRequests?: Image2AdapterRequest[];
}

export const realProviderExecutorHardLocks: RealProviderExecutorHardLocks = {
  defaultLocked: true,
  executorEnabled: false,
  actualExecutionAllowed: false,
  canExecute: false,
  canSubmitProvider: false,
  providerSubmitAllowed: 0,
  providerSubmitAllowedBoolean: false,
  liveSubmitAllowed: false,
  credentialAccessAllowed: false,
  credentialReadAllowed: false,
  credentialWriteAllowed: false,
  canSpawnWorker: false,
  noWorkerSpawn: true,
  noSubprocess: true,
  noShellExecution: true,
  noFileMutation: true,
  canMutateFiles: false,
  automaticRetryAllowed: false,
  maxConcurrency: 1,
  maxAutoRetries: 0,
  dryRunOnly: true,
  manualSubmitRequired: true,
  liveSubmitForbidden: true,
  requestPreviewOnly: true,
  outputWatcherPlanOnly: true,
  autoPromoteAllowed: false,
  seedanceParked: true,
  videoProvidersParked: true,
};

const imageSlots = new Set<ProviderSlot>(["image.generate", "image.edit", "image.reference_asset"]);
const videoSlots = new Set<ProviderSlot>(["video.i2v", "video.t2v.experimental", "video.extend", "video.edit"]);
const seedancePattern = /seedance|jimeng|video/i;

function safeId(value: string | undefined): string {
  const safe = (value || "unscoped").trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return safe || "unscoped";
}

function uniqueInOrder(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawValue of values) {
    const value = rawValue?.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).sort((left, right) => left.localeCompare(right));
}

function positiveInteger(value: number | undefined): boolean {
  return Number.isInteger(value) && (value || 0) > 0;
}

function requestPolicyLocked(request: Image2AdapterRequest): boolean {
  return request.submitPolicy?.dry_run_only === true
    && request.submitPolicy.manual_submit_required === true
    && request.submitPolicy.live_submit_forbidden === true;
}

function noFallbackInherited(request: Image2AdapterRequest): boolean {
  return request.forbiddenFallbacks.includes("provider_or_mode_fallback");
}

function isVideoOrParkedProvider(providerId: string | undefined, slot: ProviderSlot | undefined): boolean {
  return Boolean(slot && videoSlots.has(slot)) || seedancePattern.test(`${providerId || ""} ${slot || ""}`);
}

function taskPlanForRequest(request: Image2AdapterRequest, taskPlans: ImageTaskPlan[] = []): ImageTaskPlan | undefined {
  return taskPlans.find((taskPlan) => taskPlan.taskPlanId === request.taskPlanId);
}

function selectedShotIds(input: BuildRealProviderExecutorStateInput): string[] {
  return uniqueInOrder([
    ...(input.selectedShotIds || []),
    ...(input.realProviderPilot?.selectedShotIds || []),
    ...(input.realExecutionGate?.selectedShotIds || []),
    ...(input.executionLedger?.selectedShotIds || []),
  ]);
}

function selectedTaskPlanIds(input: BuildRealProviderExecutorStateInput): string[] {
  return uniqueInOrder([
    ...(input.selectedTaskPlanIds || []),
    ...(input.realProviderPilot?.selectedTaskPlanIds || []),
    ...(input.realExecutionGate?.selectedTaskPlanIds || []),
    ...(input.executionLedger?.selectedTaskPlanIds || []),
    ...(input.image2AdapterRequests || []).map((request) => request.taskPlanId),
  ]);
}

function estimatedImageCount(input: BuildRealProviderExecutorStateInput): number | undefined {
  return input.estimatedImageCount
    ?? input.realProviderPilot?.scopeSummary.estimatedImageCount
    ?? input.realProviderPilot?.expectedOutputPlan.estimatedImageCount
    ?? (input.image2AdapterRequests?.length ? input.image2AdapterRequests.length : undefined);
}

function sandboxRoot(input: BuildRealProviderExecutorStateInput): string | undefined {
  return input.outputSandbox?.root
    ?? input.realProviderPilot?.expectedOutputPlan.sandboxRoot
    ?? input.realProviderPilot?.watcherLinkPlan.sandboxRoot
    ?? input.executionLedger?.outputSandbox.root
    ?? input.realExecutionGate?.outputSandbox.root;
}

function manifestPath(input: BuildRealProviderExecutorStateInput): string | undefined {
  return input.outputSandbox?.manifestPath
    ?? input.realProviderPilot?.manifestPlan.manifestPath
    ?? input.executionLedger?.outputSandbox.manifestPath
    ?? input.realExecutionGate?.outputSandbox.manifestPath;
}

function qaReportPath(input: BuildRealProviderExecutorStateInput): string | undefined {
  return input.outputSandbox?.qaReportPath
    ?? input.realProviderPilot?.watcherLinkPlan.qaReportPath
    ?? input.executionLedger?.outputSandbox.qaReportPath
    ?? input.realExecutionGate?.outputSandbox.qaReportPath;
}

function buildBudgetGuard(
  imageCount: number | undefined,
  maxImagesPerPilot: number,
  shots: string[],
  taskPlans: string[],
): RealProviderExecutorBudgetGuard {
  const checks: RealProviderExecutorBudgetGuard["checks"] = [
    {
      checkId: "estimated_image_count_positive",
      required: true,
      passed: positiveInteger(imageCount),
      blocker: positiveInteger(imageCount) ? undefined : "Estimated image count must be a positive integer.",
    },
    {
      checkId: "max_images_per_pilot_lte_3",
      required: true,
      passed: maxImagesPerPilot <= 3,
      blocker: maxImagesPerPilot <= 3 ? undefined : "Max images per pilot must be 3 or fewer.",
    },
    {
      checkId: "estimated_images_within_pilot_cap",
      required: true,
      passed: positiveInteger(imageCount) && imageCount! <= maxImagesPerPilot,
      blocker: positiveInteger(imageCount) && imageCount! <= maxImagesPerPilot ? undefined : "Estimated image count exceeds the pilot cap.",
    },
    {
      checkId: "selected_shot_count_lte_3",
      required: true,
      passed: shots.length > 0 && shots.length <= 3,
      blocker: shots.length > 0 && shots.length <= 3 ? undefined : "Selected shot count must be between 1 and 3.",
    },
  ];
  const blockers = uniqueSorted(checks.map((item) => item.blocker));

  return {
    status: blockers.length ? "blocked" : "passed",
    estimatedImageCount: imageCount,
    maxImagesPerPilot,
    selectedShotCount: shots.length,
    selectedShotIds: shots,
    selectedTaskPlanCount: taskPlans.length,
    checks,
    blockers,
    reviewOnly: true,
    actualExecutionAllowed: false,
  };
}

function buildRequestPreview(
  request: Image2AdapterRequest,
  input: BuildRealProviderExecutorStateInput,
): RealProviderExecutorRequestPreview {
  const taskPlan = taskPlanForRequest(request, input.imageTaskPlans);
  const providerSlot = taskPlan?.providerSlot || "image.generate";
  const requiredMode = taskPlan?.requiredMode || (request.operation === "image2image" ? "image2image" : "text2image");
  const providerId = taskPlan?.providerId || input.realProviderPilot?.providerPlan.providerId || "openai-image2-api";
  const videoOrParked = isVideoOrParkedProvider(providerId, providerSlot);
  const policyLocked = requestPolicyLocked(request);
  const fallbackLocked = noFallbackInherited(request);
  const image2Slot = imageSlots.has(providerSlot) && providerId.startsWith("openai-image2");
  const blockers = uniqueSorted([
    policyLocked ? "" : "Image2 preview must stay dry-run, manual-submit-required, and live-submit-forbidden.",
    fallbackLocked ? "" : "Image2 preview must inherit provider-or-mode fallback prohibition.",
    image2Slot ? "" : "Image2 executor preview accepts only openai-image2 image slots.",
    videoOrParked ? "Seedance/video providers are parked and cannot enter the Image2 request preview queue." : "",
  ]);
  const status: RealProviderExecutorPreviewStatus = videoOrParked ? "parked" : blockers.length ? "blocked" : "preview_ready";

  return {
    previewId: `real_provider_executor_preview_${safeId(request.requestId)}`,
    sourceRequestId: request.requestId,
    taskPlanId: request.taskPlanId,
    jobId: taskPlan?.jobId,
    shotId: taskPlan?.shotId,
    providerId,
    providerSlot,
    requiredMode,
    adapterId: request.adapterId,
    operation: request.operation,
    outputPath: request.payload.outputPath,
    status,
    blockers,
    warnings: uniqueSorted([
      ...(taskPlan?.warnings || []),
      "Request preview is dry-run only and cannot submit a provider request.",
    ]),
    submitPolicy: {
      dry_run_only: true,
      manual_submit_required: true,
      live_submit_forbidden: true,
    },
    fallbackPolicy: {
      noProviderOrModeFallback: true,
      inheritedForbiddenFallbacks: uniqueSorted(request.forbiddenFallbacks),
    },
    dryRunOnly: true,
    manualSubmitRequired: true,
    liveSubmitAllowed: false,
    liveSubmitForbidden: true,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    credentialAccessAllowed: false,
    canSpawnWorker: false,
    noFileMutation: true,
  };
}

function buildParkedTaskPreview(taskPlan: ImageTaskPlan): RealProviderExecutorRequestPreview {
  return {
    previewId: `real_provider_executor_parked_${safeId(taskPlan.taskPlanId)}`,
    taskPlanId: taskPlan.taskPlanId,
    jobId: taskPlan.jobId,
    shotId: taskPlan.shotId,
    providerId: taskPlan.providerId,
    providerSlot: taskPlan.providerSlot,
    requiredMode: taskPlan.requiredMode,
    outputPath: taskPlan.expectedOutputPath,
    status: "parked",
    blockers: ["Seedance/video providers are parked for a future phase."],
    warnings: uniqueSorted(taskPlan.warnings),
    submitPolicy: {
      dry_run_only: true,
      manual_submit_required: true,
      live_submit_forbidden: true,
    },
    fallbackPolicy: {
      noProviderOrModeFallback: true,
      inheritedForbiddenFallbacks: ["provider_or_mode_fallback"],
    },
    dryRunOnly: true,
    manualSubmitRequired: true,
    liveSubmitAllowed: false,
    liveSubmitForbidden: true,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    credentialAccessAllowed: false,
    canSpawnWorker: false,
    noFileMutation: true,
  };
}

function buildChecklist(input: BuildRealProviderExecutorStateInput, budgetGuard: RealProviderExecutorBudgetGuard, previews: RealProviderExecutorRequestPreview[]): RealProviderExecutorConfirmationChecklistItem[] {
  const pilotReady = input.realProviderPilot?.status === "review_ready";
  const gateReady = input.realExecutionGate?.status === "ready_for_scoped_real_test_review";
  const ledgerReady = input.executionLedger?.status === "ready_for_scoped_review";
  const previewsReady = previews.length > 0 && previews.every((preview) => preview.status === "preview_ready");
  const handoffObserved = input.providerExecutionHandoff?.summary.userConfirmedAtActionTimeObserved === true;

  return [
    {
      confirmationId: "review_real_provider_pilot",
      label: "Review Phase 43 Image2 First pilot scope",
      requiredBeforeAnyFutureSubmit: true,
      present: pilotReady,
      satisfied: false,
      blocker: pilotReady ? "Pilot review has not been confirmed at action time." : "Real Provider Pilot must be review-ready.",
      sourceRef: input.realProviderPilot?.phase,
    },
    {
      confirmationId: "review_real_execution_gate",
      label: "Review scoped real execution gate evidence",
      requiredBeforeAnyFutureSubmit: true,
      present: gateReady,
      satisfied: false,
      blocker: gateReady ? "Execution gate has not been confirmed at action time." : "Real Execution Gate must be ready for scoped review.",
      sourceRef: input.realExecutionGate?.phase,
    },
    {
      confirmationId: "review_execution_ledger",
      label: "Review execution ledger evidence",
      requiredBeforeAnyFutureSubmit: true,
      present: ledgerReady,
      satisfied: false,
      blocker: ledgerReady ? "Execution ledger has not been confirmed at action time." : "Execution Ledger must be ready for scoped review.",
      sourceRef: input.executionLedger?.ledgerId,
    },
    {
      confirmationId: "review_budget_guard",
      label: "Review budget, quota, concurrency, and retry caps",
      requiredBeforeAnyFutureSubmit: true,
      present: budgetGuard.status === "passed",
      satisfied: false,
      blocker: budgetGuard.status === "passed" ? "Budget guard has not been confirmed at action time." : "Budget guard must pass before review.",
    },
    {
      confirmationId: "review_request_previews",
      label: "Review Image2 request previews",
      requiredBeforeAnyFutureSubmit: true,
      present: previewsReady,
      satisfied: false,
      blocker: previewsReady ? "Request previews have not been confirmed at action time." : "All Image2 request previews must be preview-ready.",
    },
    {
      confirmationId: "action_time_user_confirmation",
      label: "Capture action-time user confirmation",
      requiredBeforeAnyFutureSubmit: true,
      present: handoffObserved,
      satisfied: false,
      blocker: handoffObserved
        ? "Observed confirmation is still not execution permission in this shell."
        : "Action-time user confirmation is missing.",
      sourceRef: input.providerExecutionHandoff?.phase,
    },
    {
      confirmationId: "confirm_no_credentials_workers_or_file_mutation",
      label: "Confirm credential, worker, and file routes remain closed",
      requiredBeforeAnyFutureSubmit: true,
      present: true,
      satisfied: false,
      blocker: "Route closure has not been confirmed at action time.",
      sourceRef: "realProviderExecutorHardLocks",
    },
  ];
}

function buildOutputWatcherBridgePlan(
  input: BuildRealProviderExecutorStateInput,
  previews: RealProviderExecutorRequestPreview[],
): RealProviderExecutorOutputWatcherBridgePlan {
  const root = sandboxRoot(input);
  const pilotOutputs = (input.realProviderPilot?.expectedOutputPlan.outputs || []).map((output) => ({
    shotId: output.shotId,
    role: output.role,
    path: output.suggestedSandboxPath || output.suggestedRelativePath,
    source: "real_provider_pilot" as const,
  }));
  const ledgerOutputs = (input.executionLedger?.entries || []).flatMap((entry) =>
    entry.expectedOutputs.map((path) => ({
      shotId: entry.shotId,
      role: "unknown" as const,
      path,
      source: "execution_ledger" as const,
    })),
  );
  const requestOutputs = previews
    .filter((preview) => preview.outputPath)
    .map((preview) => ({
      shotId: preview.shotId,
      role: "unknown" as const,
      path: preview.outputPath!,
      source: "image2_request" as const,
    }));
  const expectedOutputs = uniqueInOrder([...pilotOutputs, ...ledgerOutputs, ...requestOutputs].map((item) => item.path))
    .map((path) => [...pilotOutputs, ...ledgerOutputs, ...requestOutputs].find((item) => item.path === path)!)
    .filter(Boolean);
  const globs = uniqueInOrder([
    ...(input.realProviderPilot?.watcherLinkPlan.watchGlobs || []),
    root ? `${root}/shots/**/*.png` : undefined,
    root ? `${root}/manifest.json` : undefined,
    root ? `${root}/qa/**/*.json` : undefined,
  ]);

  return {
    sandboxRoot: root,
    expectedOutputs,
    manifestPath: manifestPath(input),
    qaReportPath: qaReportPath(input),
    watchGlobs: globs,
    watcherStarted: false,
    daemonStarted: false,
    noFileMutation: true,
    fileMutationAllowed: false,
    autoPromoteAllowed: false,
    promotionAllowed: false,
    planOnly: true,
  };
}

function buildOneShotReadiness(
  budgetGuard: RealProviderExecutorBudgetGuard,
  checklist: RealProviderExecutorConfirmationChecklistItem[],
  previewBlockers: string[],
): RealProviderExecutorOneShotReadiness {
  const confirmationSatisfied = false;
  const confirmationUnsatisfied = checklist.some((item) => item.satisfied === false);
  const oneShotCandidate = budgetGuard.selectedShotCount === 1
    && positiveInteger(budgetGuard.estimatedImageCount)
    && (budgetGuard.estimatedImageCount || 0) <= 2;
  const blockers = uniqueSorted([
    ...budgetGuard.blockers,
    ...previewBlockers,
    oneShotCandidate ? "" : "One-shot review requires exactly one selected shot and no more than two estimated images.",
    confirmationUnsatisfied ? "" : "Action-time confirmation must remain unsatisfied in this shell.",
  ]);
  const reviewable = oneShotCandidate && budgetGuard.status === "passed" && previewBlockers.length === 0 && confirmationUnsatisfied;

  return {
    status: reviewable ? "reviewable_not_executable" : budgetGuard.selectedShotCount === 1 ? "blocked" : "not_one_shot",
    selectedShotCount: budgetGuard.selectedShotCount,
    estimatedImageCount: budgetGuard.estimatedImageCount,
    confirmationSatisfied,
    reviewable,
    executable: false,
    actualExecutionAllowed: false,
    providerSubmitAllowed: 0,
    blockers,
    notes: [
      "One-shot readiness is a review display only.",
      "It cannot enable provider submit, credentials, worker routes, output watcher daemons, file changes, or automatic retries.",
    ],
  };
}

export function buildRealProviderExecutorState(input: BuildRealProviderExecutorStateInput): RealProviderExecutorState {
  const mode = input.mode || "locked";
  const projectId = input.projectId || input.realProviderPilot?.projectId || input.realExecutionGate?.projectId || input.executionLedger?.projectId;
  const batchId = input.batchId || input.realProviderPilot?.batchId || input.realExecutionGate?.batchId || input.executionLedger?.batchId;
  const shots = selectedShotIds(input);
  const taskPlanIds = selectedTaskPlanIds(input);
  const imageCount = estimatedImageCount(input);
  const maxImagesPerPilot = input.maxImagesPerPilot ?? 3;
  const budgetGuard = buildBudgetGuard(imageCount, maxImagesPerPilot, shots, taskPlanIds);
  const providerRequestPreviews = (input.image2AdapterRequests || []).map((request) => buildRequestPreview(request, input));
  const parkedFromTasks = (input.imageTaskPlans || [])
    .filter((taskPlan) => isVideoOrParkedProvider(taskPlan.providerId, taskPlan.providerSlot))
    .map(buildParkedTaskPreview);
  const parkedFromPilot = (input.realProviderPilot?.parkedFutureProviderPlans || []).map((plan) => ({
    previewId: `real_provider_executor_parked_${safeId(plan.providerId)}_${safeId(plan.providerSlot)}`,
    providerId: plan.providerId || "parked-provider",
    providerSlot: plan.providerSlot || "video.i2v",
    requiredMode: plan.requiredMode || "frames2video",
    status: "parked" as const,
    blockers: uniqueSorted([...plan.blockers, "Seedance/video provider plan is parked."]),
    warnings: uniqueSorted(plan.warnings),
    submitPolicy: {
      dry_run_only: true as const,
      manual_submit_required: true as const,
      live_submit_forbidden: true as const,
    },
    fallbackPolicy: {
      noProviderOrModeFallback: true as const,
      inheritedForbiddenFallbacks: ["provider_or_mode_fallback"],
    },
    dryRunOnly: true as const,
    manualSubmitRequired: true as const,
    liveSubmitAllowed: false as const,
    liveSubmitForbidden: true as const,
    canSubmitProvider: false as const,
    providerSubmitAllowed: 0 as const,
    credentialAccessAllowed: false as const,
    canSpawnWorker: false as const,
    noFileMutation: true as const,
  }));
  const parkedProviderPreviews = [...parkedFromTasks, ...parkedFromPilot];
  const previewBlockers = uniqueSorted([
    ...(providerRequestPreviews.length ? [] : ["At least one Image2 request preview is required."]),
    ...providerRequestPreviews.flatMap((preview) => preview.blockers),
    ...parkedFromTasks.flatMap((preview) => preview.blockers),
  ]);
  const checklist = buildChecklist(input, budgetGuard, providerRequestPreviews);
  const upstreamBlockers = uniqueSorted([
    input.realProviderPilot ? "" : "Real Provider Pilot state is required.",
    input.realProviderPilot && input.realProviderPilot.status !== "review_ready" ? "Real Provider Pilot must be review-ready for user review only." : "",
    input.realExecutionGate ? "" : "Real Execution Gate state is required.",
    input.realExecutionGate && input.realExecutionGate.status !== "ready_for_scoped_real_test_review" ? "Real Execution Gate must be ready for scoped review." : "",
    input.executionLedger ? "" : "Execution Ledger state is required.",
    input.executionLedger && input.executionLedger.status !== "ready_for_scoped_review" ? "Execution Ledger must be ready for scoped review." : "",
  ]);
  const blockers = uniqueSorted([
    ...upstreamBlockers,
    ...budgetGuard.blockers,
    ...previewBlockers,
  ]);
  const status: RealProviderExecutorStatus = mode === "locked" ? "locked" : blockers.length ? "blocked" : "review_ready";
  const outputWatcherBridgePlan = buildOutputWatcherBridgePlan(input, providerRequestPreviews);
  const oneShotReadiness = buildOneShotReadiness(budgetGuard, checklist, previewBlockers);
  const previewReady = providerRequestPreviews.filter((preview) => preview.status === "preview_ready").length;
  const previewBlocked = providerRequestPreviews.filter((preview) => preview.status === "blocked").length;
  const previewParked = providerRequestPreviews.filter((preview) => preview.status === "parked").length + parkedProviderPreviews.length;

  return {
    schemaVersion: realProviderExecutorSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "phase_44_real_provider_executor_shell",
    mode,
    status,
    projectId,
    batchId,
    selectedShotIds: shots,
    selectedTaskPlanIds: taskPlanIds,
    executor: {
      status,
      executorEnabled: false,
      readyForUserReviewOnly: status === "review_ready",
      actualExecutionAllowed: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      canSpawnWorker: false,
      noFileMutation: true,
    },
    budgetGuard,
    quotaConcurrencyRetryPolicy: {
      quotaPolicy: {
        maxImagesPerPilot,
        estimatedImageCount: imageCount,
        providerSubmitAllowed: 0,
        liveSubmitAllowed: false,
        actualExecutionAllowed: false,
      },
      concurrencyPolicy: {
        maxConcurrency: 1,
        activeProviderRequestsAllowed: 0,
        queueOnly: true,
        canSpawnWorker: false,
      },
      retryPolicy: {
        automaticRetryAllowed: false,
        maxAutoRetries: 0,
        manualRetryRequiresNewUserReview: true,
      },
    },
    actionTimeConfirmationChecklist: checklist,
    providerRequestPreviews,
    parkedProviderPreviews,
    outputWatcherBridgePlan,
    oneShotReadiness,
    blockers,
    warnings: uniqueSorted([
      ...(input.realProviderPilot?.warnings || []),
      "Phase 44 is an executor shell only; review-ready never means provider submission is allowed.",
      parkedProviderPreviews.length ? "Seedance/video provider previews are parked." : "",
    ]),
    summary: {
      totalProviderRequestPreviews: providerRequestPreviews.length,
      previewReady,
      blocked: previewBlocked,
      parked: previewParked,
      reviewReady: status === "review_ready" ? previewReady : 0,
      executorEnabled: false,
      actualExecutionAllowed: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      workerSpawnsAllowed: 0,
      fileMutationsAllowed: 0,
      automaticRetryAllowed: false,
      maxConcurrency: 1,
      maxAutoRetries: 0,
    },
    hardLocks: realProviderExecutorHardLocks,
    forbiddenActions: [
      "provider_submit",
      "live_submit",
      "credential_read",
      "credential_write",
      "worker_start",
      "subprocess",
      "shell_execution",
      "file_mutation",
      "automatic_retry",
      "image2_execution",
      "seedance_execution",
      "video_submit",
      "output_watcher_daemon",
      "auto_promote",
    ],
    executorEnabled: false,
    actualExecutionAllowed: false,
    providerSubmitAllowed: false,
    liveSubmitAllowed: false,
    credentialAccessAllowed: false,
    canSpawnWorker: false,
    noFileMutation: true,
    automaticRetryAllowed: false,
    dryRunOnly: true,
    notes: [
      "Phase 44 builds the Real Provider Executor shell as pure state.",
      "review_ready means ready for user review only and cannot be interpreted as submit permission.",
      "Provider request previews remain dry-run-only, manual-submit-required, live-submit-forbidden, and no-fallback.",
      "Output watcher bridge data is a plan only; no daemon is started, no files are changed, and no output is promoted.",
    ],
  };
}
