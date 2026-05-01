import { compileImage2OneShotRealCallPayload, type Image2OneShotRealCallPayload } from "./providerAdapters/image2Adapter";
import type { ManifestMatchReport } from "./manifestMatcher";
import type { RealProviderExecutorRequestPreview } from "./realProviderExecutor";
import type { GenerationHealthReport, Image2AdapterRequest, WatcherEvent } from "./types";

export const realProviderOneShotSchemaVersion = "0.1.0";

export type RealProviderOneShotStatus =
  | "blocked"
  | "ready_to_submit"
  | "provider_call_failed"
  | "waiting_for_file"
  | "output_missing"
  | "needs_review"
  | "ready_for_formal_review";

export type RealProviderOneShotUserReadableStatus =
  | "调用失败"
  | "输出缺失"
  | "等待文件"
  | "需要复核"
  | "准备调用";

export interface RealProviderOneShotActionConfirmation {
  confirmationId: string;
  confirmedBy: "user";
  confirmedAt: string;
  scope: "single_image2_one_shot";
  budgetNoticeAccepted: true;
  sandboxNoticeAccepted: true;
  oneUseReceipt: true;
}

export interface RealProviderOneShotCredentialGrant {
  providerId: "openai-image2-api";
  credentialRef: string;
  grantScope: "image2_one_shot";
  authorizedAt: string;
  secretMaterialPresent: false;
}

export interface RealProviderOneShotBudgetNotice {
  estimatedImageCount: 1 | 2;
  maxImagesAllowed: 1 | 2;
  maxProviderSubmits: 1;
  budgetNotice: string;
  quotaNoticeAccepted: true;
}

export interface RealProviderOneShotSandboxScope {
  root: string;
  allowedPrefixes: string[];
  manifestPath: string;
  qaReportPath: string;
  outsideRootWriteAllowed: false;
}

export interface RealProviderOneShotProviderReport {
  status: "not_called" | "submitted" | "succeeded" | "failed";
  attemptCount: 0 | 1;
  providerTaskId?: string;
  message?: string;
  selfReportedComplete?: boolean;
}

export interface BuildRealProviderOneShotStateInput {
  generatedAt: string;
  selectedShotIds: string[];
  selectedTaskPlanIds: string[];
  requestPreview: RealProviderExecutorRequestPreview;
  adapterRequest: Image2AdapterRequest;
  actionConfirmation?: RealProviderOneShotActionConfirmation;
  credentialGrant?: RealProviderOneShotCredentialGrant;
  budgetNotice: RealProviderOneShotBudgetNotice;
  sandbox: RealProviderOneShotSandboxScope;
  providerReport?: RealProviderOneShotProviderReport;
  watcherEvents?: WatcherEvent[];
  manifestReports?: ManifestMatchReport[];
  generationHealthReports?: GenerationHealthReport[];
}

export interface RealProviderOneShotState {
  schemaVersion: string;
  generatedAt: string;
  phase: "round_4_image2_one_shot_action_layer";
  status: RealProviderOneShotStatus;
  userReadableStatus: RealProviderOneShotUserReadableStatus;
  userMessage: string;
  selectedShotIds: string[];
  selectedTaskPlanIds: string[];
  actionConfirmationRequired: true;
  actionConfirmationAccepted: boolean;
  budgetNoticeRequired: true;
  budgetNoticeAccepted: boolean;
  credentialGrantAccepted: boolean;
  compiledPayload?: Image2OneShotRealCallPayload;
  providerReport?: RealProviderOneShotProviderReport;
  gateEvidence: {
    watcherExpectedOutputDetected: boolean;
    manifestMatched: boolean;
    qaPassed: boolean;
    providerSelfReportIgnoredForCompletion: true;
  };
  blockers: string[];
  warnings: string[];
  summary: {
    canSubmitThisOneShot: boolean;
    providerSubmitAllowed: 0 | 1;
    providerSubmitsRemaining: 0 | 1;
    maxProviderSubmits: 1;
    estimatedImageCount: 1 | 2;
    maxImagesAllowed: 1 | 2;
    maxConcurrency: 1;
    maxAutoRetries: 0;
    automaticRetryAllowed: false;
    arbitraryShellAllowed: false;
    unauthorizedCredentialAllowed: false;
    seedanceOrJimengLiveSubmitAllowed: false;
    fastOrVipAllowed: false;
    textToVideoFallbackAllowed: false;
    outsideSandboxWriteAllowed: false;
    outputMayCompleteFromProviderSelfReport: false;
  };
  notes: string[];
}

const imageSlots = new Set(["image.generate", "image.edit", "image.reference_asset"]);
const manifestReadyStatuses = new Set(["actual_output_present", "complete", "matched"]);

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).sort((left, right) => left.localeCompare(right));
}

function pathInsideSandbox(path: string | undefined, sandbox: RealProviderOneShotSandboxScope): boolean {
  if (!path) return false;
  const normalizedPath = normalizePath(path);
  if (normalizedPath.split("/").includes("..")) return false;
  const prefixes = uniqueSorted([sandbox.root, ...sandbox.allowedPrefixes]).map(normalizePath);
  return prefixes.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));
}

function matchingManifestReport(input: BuildRealProviderOneShotStateInput): ManifestMatchReport | undefined {
  return (input.manifestReports || []).find(
    (report) =>
      report.taskId === input.adapterRequest.taskPlanId ||
      report.taskId === input.requestPreview.taskPlanId ||
      report.taskId === input.requestPreview.jobId,
  );
}

function matchingHealthReport(input: BuildRealProviderOneShotStateInput): GenerationHealthReport | undefined {
  return (input.generationHealthReports || []).find(
    (report) =>
      report.taskPlanId === input.adapterRequest.taskPlanId ||
      report.taskPlanId === input.requestPreview.taskPlanId ||
      report.jobId === input.requestPreview.jobId,
  );
}

function expectedOutputDetected(input: BuildRealProviderOneShotStateInput, outputPath?: string): boolean {
  return Boolean(
    outputPath &&
      (input.watcherEvents || []).some(
        (event) =>
          event.eventType === "expected_output_detected" &&
          event.status === "detected" &&
          (event.artifactPath === outputPath || event.expectedOutputPath === outputPath),
      ),
  );
}

function workerReportedMissingOutput(input: BuildRealProviderOneShotStateInput): boolean {
  return (input.watcherEvents || []).some(
    (event) =>
      event.eventType === "worker_exit_without_expected_output" &&
      (event.taskId === input.adapterRequest.taskPlanId || event.taskId === input.requestPreview.taskPlanId || event.jobId === input.requestPreview.jobId),
  );
}

function baseBlockers(input: BuildRealProviderOneShotStateInput): string[] {
  const request = input.adapterRequest;
  const preview = input.requestPreview;
  const confirmation = input.actionConfirmation;
  const credential = input.credentialGrant;
  const budget = input.budgetNotice;
  const sandbox = input.sandbox;
  const outputPath = preview.outputPath || request.payload.outputPath;

  return uniqueSorted([
    input.selectedShotIds.length === 1 ? "" : "Image2 one-shot requires exactly one selected shot.",
    input.selectedTaskPlanIds.length === 1 ? "" : "Image2 one-shot requires exactly one selected task plan.",
    request.taskPlanId === preview.taskPlanId ? "" : "Adapter request must match the reviewed request preview task plan.",
    preview.status === "preview_ready" ? "" : "Request preview must be preview-ready.",
    preview.providerId === "openai-image2-api" ? "" : "Only Image2 provider openai-image2-api may enter the real one-shot call layer.",
    imageSlots.has(preview.providerSlot) ? "" : "Only Image2 image slots may enter the real one-shot call layer.",
    /seedance|jimeng/i.test(preview.providerId) ? "Seedance/Jimeng live submit is forbidden in Round 4." : "",
    preview.requiredMode === "frames2video" || /video/i.test(preview.providerSlot) ? "Text-to-video or video fallback is forbidden in Round 4." : "",
    request.forbiddenFallbacks.includes("provider_or_mode_fallback") ? "" : "Provider or mode fallback must be explicitly forbidden.",
    request.operation === "image2image" && !request.forbiddenFallbacks.includes("image2image_to_text2image")
      ? "Image2image-to-text fallback must be explicitly forbidden."
      : "",
    confirmation?.confirmedBy === "user" && confirmation.scope === "single_image2_one_shot" && confirmation.oneUseReceipt === true
      ? ""
      : "Action-time user confirmation receipt is required.",
    confirmation?.budgetNoticeAccepted === true ? "" : "Budget/quota notice must be accepted at action time.",
    confirmation?.sandboxNoticeAccepted === true ? "" : "Scoped sandbox notice must be accepted at action time.",
    credential?.providerId === "openai-image2-api" &&
      credential.grantScope === "image2_one_shot" &&
      credential.secretMaterialPresent === false &&
      Boolean(credential.credentialRef)
      ? ""
      : "A user-authorized Image2 credential reference is required; raw credential material is forbidden.",
    budget.estimatedImageCount > 0 && budget.estimatedImageCount <= 2 ? "" : "Round 4 allows one or two Image2 images only.",
    budget.maxImagesAllowed > 0 && budget.maxImagesAllowed <= 2 ? "" : "Round 4 max image allowance must be one or two.",
    budget.maxProviderSubmits === 1 ? "" : "Round 4 allows exactly one provider submit attempt.",
    budget.quotaNoticeAccepted === true && Boolean(budget.budgetNotice) ? "" : "Explicit budget/quota notice is required.",
    sandbox.outsideRootWriteAllowed === false ? "" : "Writes outside the scoped sandbox are forbidden.",
    pathInsideSandbox(outputPath, sandbox) ? "" : "Output path must stay inside the scoped sandbox.",
    pathInsideSandbox(sandbox.manifestPath, sandbox) ? "" : "Manifest path must stay inside the scoped sandbox.",
    pathInsideSandbox(sandbox.qaReportPath, sandbox) ? "" : "QA report path must stay inside the scoped sandbox.",
    (input.providerReport?.attemptCount || 0) <= 1 ? "" : "Automatic retry is forbidden; attempt count cannot exceed one.",
  ]);
}

function statusFor(input: BuildRealProviderOneShotStateInput, payload: Image2OneShotRealCallPayload | undefined): Pick<RealProviderOneShotState, "status" | "userReadableStatus" | "userMessage"> {
  const report = input.providerReport;
  if (!report || report.status === "not_called") {
    return {
      status: "ready_to_submit",
      userReadableStatus: "准备调用",
      userMessage: "已确认预算、凭据引用和 sandbox；可以执行一次 Image2 one-shot 调用。",
    };
  }

  if (report.status === "failed") {
    return {
      status: "provider_call_failed",
      userReadableStatus: "调用失败",
      userMessage: report.message || "Image2 调用失败，请复核 provider 错误后重新发起一次新的动作确认。",
    };
  }

  const outputPath = payload?.output.path;
  const watcherDetected = expectedOutputDetected(input, outputPath);
  const manifest = matchingManifestReport(input);
  const manifestMatched = Boolean(manifest && manifestReadyStatuses.has(manifest.status));
  const health = matchingHealthReport(input);
  const providerClaimsDone = report.status === "succeeded" || report.selfReportedComplete === true;

  if (!watcherDetected && !manifestMatched) {
    return {
      status: providerClaimsDone || workerReportedMissingOutput(input) ? "output_missing" : "waiting_for_file",
      userReadableStatus: providerClaimsDone || workerReportedMissingOutput(input) ? "输出缺失" : "等待文件",
      userMessage: providerClaimsDone || workerReportedMissingOutput(input)
        ? "Provider 已报告结束，但 watcher/manifest 没有看到期望输出；不能把任务标记完成。"
        : "Image2 请求已提交，正在等待 sandbox 中出现期望输出文件。",
    };
  }

  if (manifestMatched && health?.healthStatus === "formal_ready" && health.qaStatus === "pass") {
    return {
      status: "ready_for_formal_review",
      userReadableStatus: "需要复核",
      userMessage: "输出已由 watcher、manifest 和 QA gate 回流，可进入人工复核/正式接收。",
    };
  }

  return {
    status: "needs_review",
    userReadableStatus: "需要复核",
    userMessage: "输出已回流，但还需要 manifest/QA/health gate 明确通过。",
  };
}

export function buildRealProviderOneShotState(input: BuildRealProviderOneShotStateInput): RealProviderOneShotState {
  const compileResult = compileImage2OneShotRealCallPayload({
    request: input.adapterRequest,
    preview: input.requestPreview,
    actionConfirmationId: input.actionConfirmation?.confirmationId || "",
    credentialRef: input.credentialGrant?.credentialRef || "",
    outputSandboxRoot: input.sandbox.root,
    manifestPath: input.sandbox.manifestPath,
    qaReportPath: input.sandbox.qaReportPath,
    imageCount: input.budgetNotice.estimatedImageCount,
    budgetNotice: input.budgetNotice.budgetNotice,
  });
  const blockers = uniqueSorted([...baseBlockers(input), ...compileResult.issues]);
  const payload = compileResult.payload;
  const gateStatus = payload && blockers.length === 0 ? statusFor(input, payload) : undefined;
  const status = blockers.length ? "blocked" : gateStatus!.status;
  const manifest = matchingManifestReport(input);
  const health = matchingHealthReport(input);
  const watcherDetected = expectedOutputDetected(input, payload?.output.path);

  return {
    schemaVersion: realProviderOneShotSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "round_4_image2_one_shot_action_layer",
    status,
    userReadableStatus: blockers.length ? "需要复核" : gateStatus!.userReadableStatus,
    userMessage: blockers.length ? "真实 Image2 one-shot 调用被硬约束阻止，请先复核阻塞项。" : gateStatus!.userMessage,
    selectedShotIds: input.selectedShotIds,
    selectedTaskPlanIds: input.selectedTaskPlanIds,
    actionConfirmationRequired: true,
    actionConfirmationAccepted: Boolean(input.actionConfirmation && input.actionConfirmation.budgetNoticeAccepted && input.actionConfirmation.sandboxNoticeAccepted),
    budgetNoticeRequired: true,
    budgetNoticeAccepted: input.budgetNotice.quotaNoticeAccepted,
    credentialGrantAccepted: Boolean(input.credentialGrant && input.credentialGrant.secretMaterialPresent === false),
    compiledPayload: payload,
    providerReport: input.providerReport,
    gateEvidence: {
      watcherExpectedOutputDetected: watcherDetected,
      manifestMatched: Boolean(manifest && manifestReadyStatuses.has(manifest.status)),
      qaPassed: health?.qaStatus === "pass" && health.healthStatus === "formal_ready",
      providerSelfReportIgnoredForCompletion: true,
    },
    blockers,
    warnings: uniqueSorted([
      input.providerReport?.selfReportedComplete ? "Provider self-report is recorded as evidence only and cannot complete the task." : "",
      status === "ready_for_formal_review" ? "Formal acceptance still needs user review outside this core status." : "",
    ]),
    summary: {
      canSubmitThisOneShot: status === "ready_to_submit",
      providerSubmitAllowed: status === "ready_to_submit" ? 1 : 0,
      providerSubmitsRemaining: status === "ready_to_submit" ? 1 : 0,
      maxProviderSubmits: 1,
      estimatedImageCount: input.budgetNotice.estimatedImageCount,
      maxImagesAllowed: input.budgetNotice.maxImagesAllowed,
      maxConcurrency: 1,
      maxAutoRetries: 0,
      automaticRetryAllowed: false,
      arbitraryShellAllowed: false,
      unauthorizedCredentialAllowed: false,
      seedanceOrJimengLiveSubmitAllowed: false,
      fastOrVipAllowed: false,
      textToVideoFallbackAllowed: false,
      outsideSandboxWriteAllowed: false,
      outputMayCompleteFromProviderSelfReport: false,
    },
    notes: [
      "This core layer compiles the reviewed Image2 preview into a one-use real-call payload but does not perform network I/O.",
      "Completion can only advance from watcher, manifest, generation health, and QA evidence.",
      "A retry must be modeled as a new user-confirmed one-shot action.",
    ],
  };
}
