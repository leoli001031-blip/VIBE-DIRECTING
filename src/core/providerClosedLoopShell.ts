import type { ManifestMatchReport } from "./manifestMatcher";
import type { ProviderLiveGateState } from "./providerLiveGate";
import type {
  Image2AdapterRequest,
  ImageTaskPlan,
  QaPromotionReport,
  VideoPlanningState,
  VideoTaskPlan,
  WatcherEvent,
} from "./types";

export const providerClosedLoopShellSchemaVersion = "0.1.0";
export const providerClosedLoopShellPhaseId = "phase_41_provider_closed_loop_shell";

export type ProviderClosedLoopShellReadiness = "blocked" | "ready_gated_shell";
export type ProviderClosedLoopProviderKind = "image2" | "seedance" | "jimeng";
export type ProviderClosedLoopShellStatus = "blocked" | "ready_gated_shell" | "parked_unsupported";
export type ProviderClosedLoopStepStatus = "pass" | "blocked" | "parked";

export interface ProviderClosedLoopShellHardLocks {
  closedLoopShellOnly: true;
  dryRunOnly: true;
  readOnly: true;
  planOnly: true;
  providerSubmissionForbidden: true;
  noActualProviderSubmit: true;
  noLiveSubmit: true;
  noCredentialRead: true;
  noCredentialWrite: true;
  credentialAccessAllowed: false;
  credentialStorage: false;
  noApiKeyCreation: true;
  noWorkerSpawn: true;
  noShellExecution: true;
  noFileMutation: true;
  fastModelForbidden: true;
  vipChannelForbidden: true;
  textToVideoMainPathForbidden: true;
  bgmInVideoPromptForbidden: true;
  workerSelfReportCannotComplete: true;
  expectedOutputRequired: true;
  watcherRequired: true;
  manifestRequired: true;
  qaGateRequired: true;
  promotionGateRequired: true;
}

export interface ProviderClosedLoopRequestPreview {
  previewDefined: boolean;
  providerId: string;
  adapterId?: string;
  slot: string;
  requiredMode: string;
  operation: string;
  payloadShape: {
    sourceIntent?: boolean;
    mustPreserve?: boolean;
    mustAvoid?: boolean;
    references?: boolean;
    outputPath?: string;
    startFramePath?: string;
    endFramePath?: string;
    motionBrief?: boolean;
    durationSeconds?: number | null;
  };
  submitPolicy: {
    providerCommitDefaultGated: true;
    providerCommitAllowed: false;
    canSubmitProvider: false;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
    dryRunOnly: true;
    manualSubmitRequired: true;
  };
}

export interface ProviderClosedLoopStep {
  stepId:
    | "provider_request_preview"
    | "watcher_expected_output"
    | "manifest_match"
    | "qa_report_check"
    | "promotion_gate";
  required: true;
  status: ProviderClosedLoopStepStatus;
  sourceRef?: string;
  detail: string;
}

export interface ProviderClosedLoopShellItem {
  shellId: string;
  providerKind: ProviderClosedLoopProviderKind;
  sourceKind: "image_task_plan" | "video_task_plan" | "provider_summary";
  sourceId: string;
  taskPlanId?: string;
  jobId?: string;
  shotId?: string;
  providerId: string;
  providerSlot: string;
  requiredMode: string;
  providerExecutionState: "active" | "parked" | "unsupported";
  status: ProviderClosedLoopShellStatus;
  supportStatus: "defined" | "parked_unsupported";
  requestPreview: ProviderClosedLoopRequestPreview;
  expectedOutputPath: string;
  closedLoopSteps: ProviderClosedLoopStep[];
  closedLoopComplete: boolean;
  workerProviderSelfReportAccepted: false;
  canCompleteFromSelfReport: false;
  providerCommitDefaultGated: true;
  providerCommitAllowed: false;
  canSubmitProvider: false;
  providerSubmitAllowed: 0;
  liveSubmitAllowed: false;
  dryRunOnly: true;
  readOnly: true;
  planOnly: true;
  blockers: string[];
  warnings: string[];
}

export interface ProviderClosedLoopShellState {
  schemaVersion: typeof providerClosedLoopShellSchemaVersion;
  phaseId: typeof providerClosedLoopShellPhaseId;
  generatedAt: string;
  readiness: ProviderClosedLoopShellReadiness;
  contract: {
    shellOnly: true;
    closedLoopContractDefined: true;
    image2ShellRequired: true;
    seedanceShellRequired: true;
    providerRequestPreviewRequired: true;
    watcherExpectedOutputRequired: true;
    manifestMatchRequired: true;
    qaReportCheckRequired: true;
    promotionGateRequired: true;
    workerProviderSelfReportCannotComplete: true;
    noActualProviderSubmit: true;
  };
  providerCommitGate: {
    providerCommitDefaultGated: true;
    providerCommitAllowed: false;
    canSubmitProvider: false;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
  };
  hardLocks: ProviderClosedLoopShellHardLocks;
  attemptedActions: {
    providerSubmitAttempted: boolean;
    liveSubmitAttempted: boolean;
    credentialReadWriteAttempted: boolean;
    credentialReadAttempted: boolean;
    credentialWriteAttempted: boolean;
    apiKeyCreateAttempted: boolean;
    workerSpawnAttempted: boolean;
    shellAttempted: boolean;
    fileMutationAttempted: boolean;
    fastModelAttempted: boolean;
    vipChannelAttempted: boolean;
    textToVideoAttempted: boolean;
    bgmInVideoPromptAttempted: boolean;
    providerCommitAttempted: boolean;
  };
  shells: {
    image2: ProviderClosedLoopShellItem[];
    seedance: ProviderClosedLoopShellItem[];
    jimeng: ProviderClosedLoopShellItem;
  };
  summary: {
    image2ShellDefined: boolean;
    seedanceShellDefined: boolean;
    jimengParkedUnsupported: true;
    totalShellItems: number;
    readyGatedShells: number;
    blockedShells: number;
    parkedUnsupportedShells: number;
    providerCommitDefaultGated: true;
    providerCommitAllowed: false;
    canSubmitProvider: false;
    providerSubmitAllowed: 0;
    liveSubmitAllowed: false;
  };
  proof: {
    providerRequestPreviewToPayloadShape: boolean;
    watcherExpectedOutputRequired: boolean;
    manifestMatchRequired: boolean;
    qaReportCheckRequired: boolean;
    promotionGateRequired: boolean;
    workerProviderSelfReportCannotComplete: boolean;
    providerCommitDefaultGated: boolean;
    hardLocksPinned: boolean;
  };
  blockers: string[];
  warnings: string[];
  validation: {
    ok: boolean;
    status: ProviderClosedLoopShellReadiness;
    errors: string[];
    warnings: string[];
    checkedAt: string;
  };
  notes: string[];
}

export interface BuildProviderClosedLoopShellInput {
  generatedAt?: string;
  imageTaskPlans?: ImageTaskPlan[];
  image2AdapterRequests?: Image2AdapterRequest[];
  videoPlanning?: VideoPlanningState;
  providerLiveGate?: ProviderLiveGateState;
  watcherEvents?: WatcherEvent[];
  manifestReports?: ManifestMatchReport[];
  qaPromotionReports?: QaPromotionReport[];
  hardLocksOverride?: Partial<Record<keyof ProviderClosedLoopShellHardLocks, boolean>>;
  providerSubmitAttempted?: boolean;
  liveSubmitAttempted?: boolean;
  credentialReadWriteAttempted?: boolean;
  credentialReadAttempted?: boolean;
  credentialWriteAttempted?: boolean;
  apiKeyCreateAttempted?: boolean;
  workerSpawnAttempted?: boolean;
  shellAttempted?: boolean;
  fileMutationAttempted?: boolean;
  fastModelAttempted?: boolean;
  vipChannelAttempted?: boolean;
  textToVideoAttempted?: boolean;
  bgmInVideoPromptAttempted?: boolean;
  providerCommitAttempted?: boolean;
}

export const providerClosedLoopShellHardLocks: ProviderClosedLoopShellHardLocks = {
  closedLoopShellOnly: true,
  dryRunOnly: true,
  readOnly: true,
  planOnly: true,
  providerSubmissionForbidden: true,
  noActualProviderSubmit: true,
  noLiveSubmit: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  credentialAccessAllowed: false,
  credentialStorage: false,
  noApiKeyCreation: true,
  noWorkerSpawn: true,
  noShellExecution: true,
  noFileMutation: true,
  fastModelForbidden: true,
  vipChannelForbidden: true,
  textToVideoMainPathForbidden: true,
  bgmInVideoPromptForbidden: true,
  workerSelfReportCannotComplete: true,
  expectedOutputRequired: true,
  watcherRequired: true,
  manifestRequired: true,
  qaGateRequired: true,
  promotionGateRequired: true,
};

const defaultGeneratedAt = "1970-01-01T00:00:00.000Z";

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function hardLockDrift<T extends object>(actual: T | undefined, expected: T, prefix: string): string[] {
  if (!actual) return [`${prefix}_hard_locks_missing`];
  const actualRecord = actual as Record<string, boolean | undefined>;
  const expectedRecord = expected as Record<string, boolean>;

  return Object.entries(expectedRecord).flatMap(([key, expectedValue]) =>
    actualRecord[key] === expectedValue ? [] : [`${prefix}_hard_lock_drift:${key}`],
  );
}

function providerCommitPolicy(): ProviderClosedLoopRequestPreview["submitPolicy"] {
  return {
    providerCommitDefaultGated: true,
    providerCommitAllowed: false,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    dryRunOnly: true,
    manualSubmitRequired: true,
  };
}

function step(
  stepId: ProviderClosedLoopStep["stepId"],
  status: ProviderClosedLoopStepStatus,
  detail: string,
  sourceRef?: string,
): ProviderClosedLoopStep {
  return {
    stepId,
    required: true,
    status,
    detail,
    sourceRef,
  };
}

function attemptedActionBlockers(input: BuildProviderClosedLoopShellInput): string[] {
  return [
    ...(input.providerSubmitAttempted ? ["provider_submit_attempt_blocked"] : []),
    ...(input.liveSubmitAttempted ? ["live_submit_attempt_blocked"] : []),
    ...(input.credentialReadWriteAttempted ? ["credential_read_write_attempt_blocked"] : []),
    ...(input.credentialReadAttempted ? ["credential_read_attempt_blocked"] : []),
    ...(input.credentialWriteAttempted ? ["credential_write_attempt_blocked"] : []),
    ...(input.apiKeyCreateAttempted ? ["api_key_create_attempt_blocked"] : []),
    ...(input.workerSpawnAttempted ? ["worker_spawn_attempt_blocked"] : []),
    ...(input.shellAttempted ? ["shell_attempt_blocked"] : []),
    ...(input.fileMutationAttempted ? ["file_mutation_attempt_blocked"] : []),
    ...(input.fastModelAttempted ? ["fast_model_attempt_blocked"] : []),
    ...(input.vipChannelAttempted ? ["vip_channel_attempt_blocked"] : []),
    ...(input.textToVideoAttempted ? ["text_to_video_main_path_attempt_blocked"] : []),
    ...(input.bgmInVideoPromptAttempted ? ["bgm_in_video_prompt_attempt_blocked"] : []),
    ...(input.providerCommitAttempted ? ["provider_commit_attempt_blocked"] : []),
  ];
}

function image2TaskPlans(input: BuildProviderClosedLoopShellInput): ImageTaskPlan[] {
  return (input.imageTaskPlans || []).filter(
    (taskPlan) =>
      taskPlan.providerId.startsWith("openai-image2") ||
      taskPlan.providerSlot === "image.generate" ||
      taskPlan.providerSlot === "image.edit" ||
      taskPlan.providerSlot === "image.reference_asset",
  );
}

function manifestReportFor(
  taskPlan: ImageTaskPlan,
  manifestReports: ManifestMatchReport[],
): ManifestMatchReport | undefined {
  return manifestReports.find((report) => report.taskId === taskPlan.taskPlanId || report.taskId === taskPlan.jobId);
}

function qaPromotionReportFor(taskPlan: ImageTaskPlan, reports: QaPromotionReport[]): QaPromotionReport | undefined {
  return reports.find((report) => report.taskPlanId === taskPlan.taskPlanId || report.jobId === taskPlan.jobId);
}

function watcherFor(taskPlan: ImageTaskPlan, watcherEvents: WatcherEvent[]): WatcherEvent | undefined {
  return watcherEvents.find(
    (event) =>
      event.taskId === taskPlan.taskPlanId &&
      event.eventType === "expected_output_detected" &&
      event.status === "detected" &&
      (event.artifactPath === taskPlan.expectedOutputPath || event.expectedOutputPath === taskPlan.expectedOutputPath),
  );
}

function manifestMatched(report: ManifestMatchReport | undefined, expectedOutputPath: string): boolean {
  if (!report) return false;
  return (
    (report.status === "actual_output_present" || report.status === "complete") &&
    report.presentOutputCount > 0 &&
    (report.actualOutputsPresent.includes(expectedOutputPath) ||
      report.outputMatches.some((match) => match.expectedPath === expectedOutputPath && match.actualPath === expectedOutputPath))
  );
}

function hasAvailableSourceStartFrameInput(request: Image2AdapterRequest): boolean {
  return request.payload.referenceImageInputs.some(
    (input) =>
      input.role === "source_start_frame" &&
      input.source === "approved_start_frame" &&
      input.required === true &&
      input.mustUseAsVisualInput === true &&
      input.status === "available" &&
      Boolean(input.path?.trim()),
  );
}

function image2EditContractValid(taskPlan: ImageTaskPlan, request: Image2AdapterRequest): boolean {
  if (taskPlan.providerSlot !== "image.edit" && request.operation !== "image2image") return true;
  return request.operation === "image2image" &&
    taskPlan.requiredMode === "image2image" &&
    hasAvailableSourceStartFrameInput(request) &&
    request.forbiddenFallbacks.includes("image2image_to_text2image") &&
    request.forbiddenFallbacks.includes("independent_end_frame_generation");
}

function requestPreviewForImage2(taskPlan: ImageTaskPlan, request?: Image2AdapterRequest): ProviderClosedLoopRequestPreview {
  return {
    previewDefined: Boolean(
      request &&
        request.adapterId &&
        Array.isArray(request.payload.sourceIntent) &&
        Array.isArray(request.payload.mustPreserve) &&
        Array.isArray(request.payload.mustAvoid) &&
        Array.isArray(request.payload.references) &&
        Array.isArray(request.payload.referenceImageInputs) &&
        image2EditContractValid(taskPlan, request) &&
        request.payload.outputPath === taskPlan.expectedOutputPath &&
        request.submitPolicy.dry_run_only === true &&
        request.submitPolicy.manual_submit_required === true &&
        request.submitPolicy.live_submit_forbidden === true,
    ),
    providerId: taskPlan.providerId,
    adapterId: request?.adapterId,
    slot: taskPlan.providerSlot,
    requiredMode: taskPlan.requiredMode,
    operation: request?.operation || taskPlan.requiredMode,
    payloadShape: {
      sourceIntent: Array.isArray(request?.payload.sourceIntent),
      mustPreserve: Array.isArray(request?.payload.mustPreserve),
      mustAvoid: Array.isArray(request?.payload.mustAvoid),
      references: Array.isArray(request?.payload.references),
      outputPath: request?.payload.outputPath,
    },
    submitPolicy: providerCommitPolicy(),
  };
}

function buildImage2ShellItem(
  taskPlan: ImageTaskPlan,
  input: BuildProviderClosedLoopShellInput,
): ProviderClosedLoopShellItem {
  const request = (input.image2AdapterRequests || []).find((item) => item.taskPlanId === taskPlan.taskPlanId);
  const requestPreview = requestPreviewForImage2(taskPlan, request);
  const watcher = watcherFor(taskPlan, input.watcherEvents || []);
  const manifest = manifestReportFor(taskPlan, input.manifestReports || []);
  const qaPromotion = qaPromotionReportFor(taskPlan, input.qaPromotionReports || []);
  const qaPass = qaPromotion?.requiredGates.qaPass === true;
  const promotionPass = Boolean(
    qaPromotion &&
      qaPromotion.canPromoteToFormal === true &&
      (qaPromotion.promotionStatus === "ready_for_promotion" || qaPromotion.promotionStatus === "promoted"),
  );
  const manifestPass = manifestMatched(manifest, taskPlan.expectedOutputPath);
  const steps = [
    step(
      "provider_request_preview",
      requestPreview.previewDefined ? "pass" : "blocked",
      requestPreview.previewDefined
        ? "Image2 dry-run adapter payload shape is present."
        : "Image2 provider request preview and adapter payload shape are required.",
      request?.requestId,
    ),
    step(
      "watcher_expected_output",
      watcher ? "pass" : "blocked",
      watcher ? "Watcher detected the expected output path." : "Watcher expected-output detection is required.",
      watcher?.id,
    ),
    step(
      "manifest_match",
      manifestPass ? "pass" : "blocked",
      manifestPass ? "Manifest matches the expected output." : "Manifest match for the expected output is required.",
      manifest?.taskId,
    ),
    step(
      "qa_report_check",
      qaPass ? "pass" : "blocked",
      qaPass ? "Explicit QA pass is present." : qaPromotion ? "Explicit QA pass is required." : "QA promotion report is required.",
      qaPromotion?.reportId,
    ),
    step(
      "promotion_gate",
      promotionPass ? "pass" : "blocked",
      promotionPass ? "Promotion gate is ready or promoted." : qaPromotion ? "Promotion gate must be ready before completion." : "Promotion gate report is required.",
      qaPromotion?.reportId,
    ),
  ];
  const blockers = uniqueSorted([
    ...(taskPlan.expectedOutputPath ? [] : ["expected_output_path_required"]),
    ...(requestPreview.previewDefined ? [] : ["provider_request_preview_required"]),
    ...(watcher ? [] : ["watcher_expected_output_required"]),
    ...(manifest ? [] : ["manifest_report_required"]),
    ...(manifest && !manifestPass ? ["manifest_match_required"] : []),
    ...(qaPromotion ? [] : ["qa_report_required"]),
    ...(qaPromotion && !qaPass ? ["qa_gate_pass_required"] : []),
    ...(qaPromotion ? [] : ["promotion_gate_required"]),
    ...(qaPromotion && !promotionPass ? ["promotion_gate_ready_required"] : []),
  ]);

  return {
    shellId: `provider_closed_loop_image2_${safeId(taskPlan.taskPlanId)}`,
    providerKind: "image2",
    sourceKind: "image_task_plan",
    sourceId: taskPlan.taskPlanId,
    taskPlanId: taskPlan.taskPlanId,
    jobId: taskPlan.jobId,
    shotId: taskPlan.shotId,
    providerId: taskPlan.providerId,
    providerSlot: taskPlan.providerSlot,
    requiredMode: taskPlan.requiredMode,
    providerExecutionState: "active",
    status: blockers.length ? "blocked" : "ready_gated_shell",
    supportStatus: "defined",
    requestPreview,
    expectedOutputPath: taskPlan.expectedOutputPath,
    closedLoopSteps: steps,
    closedLoopComplete: blockers.length === 0,
    workerProviderSelfReportAccepted: false,
    canCompleteFromSelfReport: false,
    providerCommitDefaultGated: true,
    providerCommitAllowed: false,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    dryRunOnly: true,
    readOnly: true,
    planOnly: true,
    blockers,
    warnings: uniqueSorted([
      ...taskPlan.warnings,
      ...(qaPromotion?.warnings || []),
      "Worker/provider self-report is ignored for completion.",
    ]),
  };
}

function missingImage2Shell(): ProviderClosedLoopShellItem {
  const requestPreview: ProviderClosedLoopRequestPreview = {
    previewDefined: false,
    providerId: "openai-image2-api",
    slot: "image.edit",
    requiredMode: "image2image",
    operation: "image2image",
    payloadShape: {},
    submitPolicy: providerCommitPolicy(),
  };
  const blockers = [
    "image2_shell_requires_image_task_plan",
    "provider_request_preview_required",
    "watcher_expected_output_required",
    "manifest_report_required",
    "qa_report_required",
    "promotion_gate_required",
  ];

  return {
    shellId: "provider_closed_loop_image2_missing",
    providerKind: "image2",
    sourceKind: "provider_summary",
    sourceId: "openai-image2-api",
    providerId: "openai-image2-api",
    providerSlot: "image.edit",
    requiredMode: "image2image",
    providerExecutionState: "active",
    status: "blocked",
    supportStatus: "defined",
    requestPreview,
    expectedOutputPath: "",
    closedLoopSteps: [
      step("provider_request_preview", "blocked", "Image2 provider request preview is required."),
      step("watcher_expected_output", "blocked", "Watcher expected-output detection is required."),
      step("manifest_match", "blocked", "Manifest match is required."),
      step("qa_report_check", "blocked", "QA report/check is required."),
      step("promotion_gate", "blocked", "Promotion gate is required."),
    ],
    closedLoopComplete: false,
    workerProviderSelfReportAccepted: false,
    canCompleteFromSelfReport: false,
    providerCommitDefaultGated: true,
    providerCommitAllowed: false,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    dryRunOnly: true,
    readOnly: true,
    planOnly: true,
    blockers,
    warnings: ["Image2 shell is defined as blocked until image task plan evidence exists."],
  };
}

function seedanceTaskPlans(videoPlanning?: VideoPlanningState): VideoTaskPlan[] {
  return (videoPlanning?.taskPlans || []).filter((taskPlan) => /seedance/i.test(taskPlan.providerId));
}

function requestPreviewForSeedance(taskPlan?: VideoTaskPlan): ProviderClosedLoopRequestPreview {
  return {
    previewDefined: Boolean(taskPlan),
    providerId: taskPlan?.providerId || "seedance2-provider",
    slot: "video.i2v",
    requiredMode: "frames2video",
    operation: "frames2video",
    payloadShape: {
      sourceIntent: Boolean(taskPlan?.motionBrief),
      startFramePath: taskPlan?.startFrameRef.path,
      endFramePath: taskPlan?.endFrameRef.path,
      outputPath: taskPlan?.manifestFacts.expectedOutputs[0] || (taskPlan ? `outputs/videos/${taskPlan.shotId}.mp4` : undefined),
      motionBrief: Boolean(taskPlan?.motionBrief),
      durationSeconds: taskPlan?.durationSeconds,
    },
    submitPolicy: providerCommitPolicy(),
  };
}

function buildSeedanceShellItem(taskPlan?: VideoTaskPlan): ProviderClosedLoopShellItem {
  const expectedOutputPath = taskPlan?.manifestFacts.expectedOutputs[0] || (taskPlan ? `outputs/videos/${taskPlan.shotId}.mp4` : "");
  const requestPreview = requestPreviewForSeedance(taskPlan);

  return {
    shellId: taskPlan
      ? `provider_closed_loop_seedance_${safeId(taskPlan.taskPlanId)}`
      : "provider_closed_loop_seedance_parked_summary",
    providerKind: "seedance",
    sourceKind: taskPlan ? "video_task_plan" : "provider_summary",
    sourceId: taskPlan?.taskPlanId || "seedance2-provider",
    taskPlanId: taskPlan?.taskPlanId,
    jobId: taskPlan?.jobId,
    shotId: taskPlan?.shotId,
    providerId: taskPlan?.providerId || "seedance2-provider",
    providerSlot: "video.i2v",
    requiredMode: "frames2video",
    providerExecutionState: "parked",
    status: "parked_unsupported",
    supportStatus: "parked_unsupported",
    requestPreview,
    expectedOutputPath,
    closedLoopSteps: [
      step(
        "provider_request_preview",
        taskPlan ? "pass" : "parked",
        taskPlan
          ? "Seedance frames-to-video payload shape is represented from the parked video task plan."
          : "Seedance shell is parked until a video task plan exists.",
        taskPlan?.taskPlanId,
      ),
      step("watcher_expected_output", "parked", "Watcher expected-output detection is required before any future Seedance unpark."),
      step("manifest_match", "parked", "Manifest match is required before any future Seedance unpark."),
      step("qa_report_check", "parked", "QA report/check is required before any future Seedance unpark."),
      step("promotion_gate", "parked", "Promotion gate is required before any future Seedance unpark."),
    ],
    closedLoopComplete: false,
    workerProviderSelfReportAccepted: false,
    canCompleteFromSelfReport: false,
    providerCommitDefaultGated: true,
    providerCommitAllowed: false,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    dryRunOnly: true,
    readOnly: true,
    planOnly: true,
    blockers: [],
    warnings: uniqueSorted([
      ...(taskPlan?.warnings || []),
      "Seedance is represented as a closed-loop shell only; provider remains parked.",
      "Worker/provider self-report is ignored for completion.",
    ]),
  };
}

function buildJimengParkedSummary(): ProviderClosedLoopShellItem {
  return {
    shellId: "provider_closed_loop_jimeng_parked_summary",
    providerKind: "jimeng",
    sourceKind: "provider_summary",
    sourceId: "jimeng-video",
    providerId: "jimeng-video",
    providerSlot: "video.i2v",
    requiredMode: "frames2video",
    providerExecutionState: "unsupported",
    status: "parked_unsupported",
    supportStatus: "parked_unsupported",
    requestPreview: {
      previewDefined: false,
      providerId: "jimeng-video",
      slot: "video.i2v",
      requiredMode: "frames2video",
      operation: "frames2video",
      payloadShape: {},
      submitPolicy: providerCommitPolicy(),
    },
    expectedOutputPath: "",
    closedLoopSteps: [
      step("provider_request_preview", "parked", "Jimeng is parked/unsupported in Phase 41."),
      step("watcher_expected_output", "parked", "Watcher expected-output detection would be required before future support."),
      step("manifest_match", "parked", "Manifest match would be required before future support."),
      step("qa_report_check", "parked", "QA report/check would be required before future support."),
      step("promotion_gate", "parked", "Promotion gate would be required before future support."),
    ],
    closedLoopComplete: false,
    workerProviderSelfReportAccepted: false,
    canCompleteFromSelfReport: false,
    providerCommitDefaultGated: true,
    providerCommitAllowed: false,
    canSubmitProvider: false,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    dryRunOnly: true,
    readOnly: true,
    planOnly: true,
    blockers: [],
    warnings: ["Jimeng is parked/unsupported summary only in Phase 41."],
  };
}

function providerLiveGateDrift(providerLiveGate?: ProviderLiveGateState): string[] {
  if (!providerLiveGate) return [];
  return [
    ...(providerLiveGate.summary.providerSubmitAllowed === 0 ? [] : ["provider_live_gate_provider_submit_allowed_drift"]),
    ...(providerLiveGate.summary.liveSubmitAllowed === false ? [] : ["provider_live_gate_live_submit_allowed_drift"]),
    ...(providerLiveGate.summary.credentialStorage === false ? [] : ["provider_live_gate_credential_storage_drift"]),
    ...(providerLiveGate.hardLocks.providerSubmissionForbidden === true ? [] : ["provider_live_gate_submission_forbidden_drift"]),
    ...(providerLiveGate.hardLocks.fastModelForbidden === true ? [] : ["provider_live_gate_fast_model_lock_drift"]),
    ...(providerLiveGate.hardLocks.vipChannelForbidden === true ? [] : ["provider_live_gate_vip_channel_lock_drift"]),
    ...(providerLiveGate.hardLocks.textToVideoMainPathForbidden === true ? [] : ["provider_live_gate_text_to_video_lock_drift"]),
    ...(providerLiveGate.hardLocks.bgmInVideoPromptForbidden === true ? [] : ["provider_live_gate_bgm_prompt_lock_drift"]),
  ];
}

export function validateProviderClosedLoopShellHardLocks(hardLocks: ProviderClosedLoopShellHardLocks): string[] {
  return hardLockDrift(hardLocks, providerClosedLoopShellHardLocks, "provider_closed_loop_shell");
}

export function buildProviderClosedLoopShellState(
  input: BuildProviderClosedLoopShellInput = {},
): ProviderClosedLoopShellState {
  const generatedAt = input.generatedAt || defaultGeneratedAt;
  const hardLocks = {
    ...providerClosedLoopShellHardLocks,
    ...input.hardLocksOverride,
  } as ProviderClosedLoopShellHardLocks;
  const image2Items = image2TaskPlans(input).map((taskPlan) => buildImage2ShellItem(taskPlan, input));
  const image2 = image2Items.length ? image2Items : [missingImage2Shell()];
  const seedancePlans = seedanceTaskPlans(input.videoPlanning);
  const seedance = seedancePlans.length
    ? seedancePlans.map((taskPlan) => buildSeedanceShellItem(taskPlan))
    : [buildSeedanceShellItem()];
  const jimeng = buildJimengParkedSummary();
  const items = [...image2, ...seedance, jimeng];
  const hardLockErrors = hardLockDrift(hardLocks, providerClosedLoopShellHardLocks, "provider_closed_loop_shell");
  const blockers = uniqueSorted([
    ...hardLockErrors,
    ...attemptedActionBlockers(input),
    ...providerLiveGateDrift(input.providerLiveGate),
    ...image2.flatMap((item) => item.blockers.map((blocker) => `${item.shellId}:${blocker}`)),
  ]);
  const readiness: ProviderClosedLoopShellReadiness = blockers.length ? "blocked" : "ready_gated_shell";
  const warnings = uniqueSorted([
    ...items.flatMap((item) => item.warnings),
    ...(readiness === "ready_gated_shell" ? ["Ready gated shell still cannot submit providers or complete from self-report."] : []),
  ]);

  return {
    schemaVersion: providerClosedLoopShellSchemaVersion,
    phaseId: providerClosedLoopShellPhaseId,
    generatedAt,
    readiness,
    contract: {
      shellOnly: true,
      closedLoopContractDefined: true,
      image2ShellRequired: true,
      seedanceShellRequired: true,
      providerRequestPreviewRequired: true,
      watcherExpectedOutputRequired: true,
      manifestMatchRequired: true,
      qaReportCheckRequired: true,
      promotionGateRequired: true,
      workerProviderSelfReportCannotComplete: true,
      noActualProviderSubmit: true,
    },
    providerCommitGate: {
      providerCommitDefaultGated: true,
      providerCommitAllowed: false,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
    },
    hardLocks,
    attemptedActions: {
      providerSubmitAttempted: Boolean(input.providerSubmitAttempted),
      liveSubmitAttempted: Boolean(input.liveSubmitAttempted),
      credentialReadWriteAttempted: Boolean(input.credentialReadWriteAttempted),
      credentialReadAttempted: Boolean(input.credentialReadAttempted),
      credentialWriteAttempted: Boolean(input.credentialWriteAttempted),
      apiKeyCreateAttempted: Boolean(input.apiKeyCreateAttempted),
      workerSpawnAttempted: Boolean(input.workerSpawnAttempted),
      shellAttempted: Boolean(input.shellAttempted),
      fileMutationAttempted: Boolean(input.fileMutationAttempted),
      fastModelAttempted: Boolean(input.fastModelAttempted),
      vipChannelAttempted: Boolean(input.vipChannelAttempted),
      textToVideoAttempted: Boolean(input.textToVideoAttempted),
      bgmInVideoPromptAttempted: Boolean(input.bgmInVideoPromptAttempted),
      providerCommitAttempted: Boolean(input.providerCommitAttempted),
    },
    shells: {
      image2,
      seedance,
      jimeng,
    },
    summary: {
      image2ShellDefined: image2.length > 0,
      seedanceShellDefined: seedance.length > 0,
      jimengParkedUnsupported: true,
      totalShellItems: items.length,
      readyGatedShells: items.filter((item) => item.status === "ready_gated_shell").length,
      blockedShells: items.filter((item) => item.status === "blocked").length,
      parkedUnsupportedShells: items.filter((item) => item.status === "parked_unsupported").length,
      providerCommitDefaultGated: true,
      providerCommitAllowed: false,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
    },
    proof: {
      providerRequestPreviewToPayloadShape: image2.every((item) =>
        item.closedLoopSteps.find((current) => current.stepId === "provider_request_preview")?.status === "pass",
      ),
      watcherExpectedOutputRequired: hardLocks.watcherRequired === true,
      manifestMatchRequired: hardLocks.manifestRequired === true,
      qaReportCheckRequired: hardLocks.qaGateRequired === true,
      promotionGateRequired: hardLocks.promotionGateRequired === true,
      workerProviderSelfReportCannotComplete: hardLocks.workerSelfReportCannotComplete === true &&
        items.every((item) => item.canCompleteFromSelfReport === false),
      providerCommitDefaultGated: true,
      hardLocksPinned: hardLockErrors.length === 0,
    },
    blockers,
    warnings,
    validation: {
      ok: blockers.length === 0,
      status: readiness,
      errors: blockers,
      warnings,
      checkedAt: generatedAt,
    },
    notes: [
      "Phase 41 is a provider execution closed-loop shell only.",
      "Image2 and Seedance are explicitly represented; Seedance remains parked and Jimeng is parked/unsupported summary only.",
      "Completion requires provider request preview, watcher expected output, manifest match, QA report/check, and promotion gate evidence.",
      "Worker/provider self-report cannot complete a task, and provider commit remains gated off by default.",
    ],
  };
}
