import { WORKER_EXIT_WITHOUT_EXPECTED_OUTPUT } from "./statusConstants";
import { compileImage2OneShotRealCallPayload, type Image2OneShotRealCallPayload } from "./providerAdapters/image2Adapter";
import type { ImageReferenceDeliveryReceiptState } from "./imageReferenceDeliveryReceipt";
import type { ImageReferenceTransportState } from "./imageReferenceTransport";
import type { ManifestMatchReport } from "./manifestMatcher";
import type { RealProviderExecutorRequestPreview } from "./realProviderExecutor";
import type { GenerationHealthReport, Image2AdapterRequest, Image2ReferenceImageInput, WatcherEvent } from "./types";

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

export type RealProviderOneShotImageReferenceTransportEvidence = Pick<
  ImageReferenceTransportState,
  | "status"
  | "requestId"
  | "taskPlanId"
  | "operation"
  | "requiredSourceStartFrame"
  | "sourceStartFrame"
  | "transportPolicy"
  | "blockers"
>;

export type RealProviderOneShotImageReferenceDeliveryEvidence = Pick<
  ImageReferenceDeliveryReceiptState,
  | "status"
  | "requestId"
  | "taskPlanId"
  | "operation"
  | "frameRole"
  | "sourceStartFrame"
  | "delivery"
  | "verification"
  | "transportPolicy"
  | "deliveryPolicy"
  | "blockers"
>;

export interface BuildRealProviderOneShotStateInput {
  generatedAt: string;
  selectedShotIds: string[];
  selectedTaskPlanIds: string[];
  requestPreview: RealProviderExecutorRequestPreview;
  adapterRequest: Image2AdapterRequest;
  imageReferenceTransport?: RealProviderOneShotImageReferenceTransportEvidence;
  imageReferenceDeliveryReceipt?: RealProviderOneShotImageReferenceDeliveryEvidence;
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
    imageReferenceTransportDispatchReady: boolean;
    imageReferenceTransportRequestMatched: boolean;
    imageReferenceDeliveryDelivered: boolean;
    imageReferenceDeliveryRequestMatched: boolean;
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

function needsImageReferenceTransport(request: Image2AdapterRequest): boolean {
  return request.operation === "image2image" || request.frameRole === "end_frame";
}

function sourceStartFrameInput(request: Image2AdapterRequest): Image2ReferenceImageInput | undefined {
  return (request.payload.referenceImageInputs || []).find(
    (input) =>
      input.role === "source_start_frame" &&
      input.source === "approved_start_frame" &&
      input.required === true &&
      input.mustUseAsVisualInput === true &&
      input.status === "available" &&
      Boolean(input.path?.trim()),
  );
}

function imageReferenceTransportMatchesRequest(input: BuildRealProviderOneShotStateInput): boolean {
  const transport = input.imageReferenceTransport;
  if (!transport) return false;
  return (
    transport.requestId === input.adapterRequest.requestId &&
    transport.taskPlanId === input.adapterRequest.taskPlanId &&
    transport.operation === input.adapterRequest.operation
  );
}

function imageReferenceTransportBlockers(input: BuildRealProviderOneShotStateInput): string[] {
  const request = input.adapterRequest;
  if (!needsImageReferenceTransport(request)) return [];

  const transport = input.imageReferenceTransport;
  const sourceInput = sourceStartFrameInput(request);
  const policy = transport?.transportPolicy;
  const sourcePath = transport?.sourceStartFrame?.path ? normalizePath(transport.sourceStartFrame.path) : undefined;
  const requestedSourcePath = request.payload.sourceStartFrameId ? normalizePath(request.payload.sourceStartFrameId) : undefined;
  const visualInputPath = sourceInput?.path ? normalizePath(sourceInput.path) : undefined;

  if (!transport) {
    return ["Image reference transport dispatch_ready evidence is required for image2image/end-frame one-shot."];
  }

  return uniqueSorted([
    transport.status === "dispatch_ready" ? "" : "Image reference transport must be dispatch_ready before one-shot readiness.",
    imageReferenceTransportMatchesRequest(input) ? "" : "Image reference transport must match the Image2 requestId, taskPlanId, and operation.",
    transport.requiredSourceStartFrame === true ? "" : "Image reference transport must require source_start_frame for image2image/end-frame.",
    transport.sourceStartFrame?.role === "source_start_frame" ? "" : "Image reference transport must carry a source_start_frame receipt.",
    transport.sourceStartFrame?.transportRole === "explicit_local_image_reference"
      ? ""
      : "Image reference transport must carry an explicit local image reference receipt.",
    sourcePath && requestedSourcePath && sourcePath === requestedSourcePath
      ? ""
      : "Image reference transport source frame path must match sourceStartFrameId.",
    sourcePath && visualInputPath && sourcePath === visualInputPath
      ? ""
      : "Image reference transport source frame path must match the visual reference input.",
    transport.sourceStartFrame?.hash ? "" : "Image reference transport source_start_frame receipt must include a file hash.",
    transport.sourceStartFrame?.mime?.startsWith("image/") ? "" : "Image reference transport source_start_frame receipt mime must be an image.",
    transport.sourceStartFrame?.dimensions && transport.sourceStartFrame.dimensions.width > 0 && transport.sourceStartFrame.dimensions.height > 0
      ? ""
      : "Image reference transport source_start_frame receipt dimensions are required.",
    policy?.handoffOnly === true ? "" : "Image reference transport must remain handoff-only.",
    policy?.dispatchSideEffectAllowed === false ? "" : "Image reference transport must not allow dispatch side effects.",
    policy?.providerSubmitAllowed === 0 ? "" : "Image reference transport must not allow provider submit.",
    policy?.canSubmitProvider === false ? "" : "Image reference transport must not expose provider submit.",
    policy?.liveSubmitAllowed === false ? "" : "Image reference transport must forbid live submit.",
    policy?.externalNetworkIoAllowed === false ? "" : "Image reference transport must forbid external network I/O.",
    policy?.providerSelfReportCanComplete === false ? "" : "Image reference transport must not complete from provider self-report.",
    policy?.promptOnlyImageEditAllowed === false ? "" : "Image reference transport must forbid prompt-only image edit.",
    policy?.seedanceOrJimengAllowed === false ? "" : "Image reference transport must forbid Seedance/Jimeng.",
    policy?.videoAllowed === false ? "" : "Image reference transport must forbid video providers.",
    policy?.fastOrVipAllowed === false ? "" : "Image reference transport must forbid Fast/VIP.",
    policy?.textToVideoAllowed === false ? "" : "Image reference transport must forbid text-to-video.",
    ...(transport.blockers || []).map((blocker) => `Image reference transport blocker: ${blocker}`),
  ]);
}

function imageReferenceDeliveryMatchesRequest(input: BuildRealProviderOneShotStateInput): boolean {
  const receipt = input.imageReferenceDeliveryReceipt;
  if (!receipt) return false;
  return (
    receipt.requestId === input.adapterRequest.requestId &&
    receipt.taskPlanId === input.adapterRequest.taskPlanId &&
    receipt.operation === input.adapterRequest.operation
  );
}

function imageReferenceDeliveryBlockers(input: BuildRealProviderOneShotStateInput): string[] {
  const request = input.adapterRequest;
  if (!needsImageReferenceTransport(request)) return [];

  const receipt = input.imageReferenceDeliveryReceipt;
  const transport = input.imageReferenceTransport;
  const sourceInput = sourceStartFrameInput(request);
  const sourcePath = receipt?.sourceStartFrame?.path ? normalizePath(receipt.sourceStartFrame.path) : undefined;
  const requestedSourcePath = request.payload.sourceStartFrameId ? normalizePath(request.payload.sourceStartFrameId) : undefined;
  const visualInputPath = sourceInput?.path ? normalizePath(sourceInput.path) : undefined;
  const transportPath = transport?.sourceStartFrame?.path ? normalizePath(transport.sourceStartFrame.path) : undefined;
  const policy = receipt?.transportPolicy;
  const deliveryPolicy = receipt?.deliveryPolicy;
  const delivery = receipt?.delivery;

  if (!receipt) {
    return ["Image reference delivery receipt is required for image2image/end-frame one-shot."];
  }

  return uniqueSorted([
    receipt.status === "delivered" ? "" : "Image reference delivery receipt must be delivered before one-shot readiness.",
    imageReferenceDeliveryMatchesRequest(input) ? "" : "Image reference delivery receipt must match the Image2 requestId, taskPlanId, and operation.",
    receipt.sourceStartFrame?.role === "source_start_frame" ? "" : "Image reference delivery receipt must carry a source_start_frame file receipt.",
    receipt.sourceStartFrame?.transportRole === "explicit_local_image_reference"
      ? ""
      : "Image reference delivery receipt must carry an explicit local image reference.",
    sourcePath && requestedSourcePath && sourcePath === requestedSourcePath
      ? ""
      : "Image reference delivery source frame path must match sourceStartFrameId.",
    sourcePath && visualInputPath && sourcePath === visualInputPath
      ? ""
      : "Image reference delivery source frame path must match the visual reference input.",
    sourcePath && transportPath && sourcePath === transportPath
      ? ""
      : "Image reference delivery source frame path must match Image Reference Transport.",
    receipt.sourceStartFrame?.inputId && sourceInput?.inputId && receipt.sourceStartFrame.inputId === sourceInput.inputId
      ? ""
      : "Image reference delivery inputId must match the visual reference input.",
    receipt.sourceStartFrame?.inputId &&
    transport?.sourceStartFrame?.inputId &&
    receipt.sourceStartFrame.inputId === transport.sourceStartFrame.inputId
      ? ""
      : "Image reference delivery inputId must match Image Reference Transport.",
    receipt.sourceStartFrame?.sha256?.trim() ? "" : "Image reference delivery source_start_frame sha256 is required.",
    receipt.sourceStartFrame?.byteLength && receipt.sourceStartFrame.byteLength > 0
      ? ""
      : "Image reference delivery source_start_frame byteLength is required.",
    receipt.sourceStartFrame?.exists === true ? "" : "Image reference delivery source_start_frame must exist.",
    receipt.sourceStartFrame?.readable === true ? "" : "Image reference delivery source_start_frame must be readable.",
    receipt.sourceStartFrame?.pathScope && receipt.sourceStartFrame.pathScope !== "unknown"
      ? ""
      : "Image reference delivery source_start_frame path scope is required.",
    receipt.sourceStartFrame?.mime?.startsWith("image/") ? "" : "Image reference delivery source_start_frame mime must be an image.",
    receipt.sourceStartFrame?.dimensions && receipt.sourceStartFrame.dimensions.width > 0 && receipt.sourceStartFrame.dimensions.height > 0
      ? ""
      : "Image reference delivery source_start_frame dimensions are required.",
    receipt.sourceStartFrame?.sha256 && transport?.sourceStartFrame?.hash && receipt.sourceStartFrame.sha256 === transport.sourceStartFrame.hash
      ? ""
      : "Image reference delivery sha256 must match Image Reference Transport hash.",
    receipt.verification?.dispatchReady === true ? "" : "Image reference delivery must verify dispatch_ready transport.",
    receipt.verification?.sourceReceiptMatchedTransport === true ? "" : "Image reference delivery must verify source receipt matches transport.",
    receipt.verification?.deliveredBytesMatchedSource === true ? "" : "Image reference delivery must verify delivered bytes match source.",
    receipt.verification?.acceptedByActionSchema === true ? "" : "Image reference delivery must verify action schema acceptance.",
    receipt.verification?.protocolBindingPresent === true ? "" : "Image reference delivery must verify protocol binding.",
    receipt.verification?.explicitImageInput === true ? "" : "Image reference delivery must verify explicit image input.",
    receipt.verification?.promptOnly === false ? "" : "Image reference delivery must verify promptOnly false.",
    delivery?.acceptedByActionSchema === true ? "" : "Image reference delivery must be accepted by the action schema.",
    delivery?.deliveredInputKind &&
    ["app_server_localImage", "input_image", "local_file", "uploaded_file"].includes(delivery.deliveredInputKind)
      ? ""
      : "Image reference delivery must be a visual input, not prompt text.",
    delivery?.promptOnly === false ? "" : "Image reference delivery promptOnly must be false.",
    delivery?.actionSchemaParamName?.trim() ? "" : "Image reference delivery action schema parameter is required.",
    delivery?.deliveredSha256 && receipt.sourceStartFrame?.sha256 && delivery.deliveredSha256 === receipt.sourceStartFrame.sha256
      ? ""
      : "Image reference delivery deliveredSha256 must match the source_start_frame sha256.",
    delivery?.protocol?.threadId?.trim() ? "" : "Image reference delivery threadId is required.",
    delivery?.protocol?.turnId?.trim() ? "" : "Image reference delivery turnId is required.",
    delivery?.protocol?.toolCallId?.trim() ? "" : "Image reference delivery toolCallId is required.",
    delivery?.toolSchemaHash?.trim() || delivery?.generatedSchemaVersion?.trim()
      ? ""
      : "Image reference delivery schema evidence is required.",
    policy?.receiptOnly === true ? "" : "Image reference delivery receipt must remain receipt-only.",
    policy?.providerSubmitAllowed === 0 ? "" : "Image reference delivery receipt must not allow provider submit.",
    policy?.canSubmitProvider === false ? "" : "Image reference delivery receipt must not expose provider submit.",
    policy?.liveSubmitAllowed === false ? "" : "Image reference delivery receipt must forbid live submit.",
    policy?.externalNetworkIoAllowed === false ? "" : "Image reference delivery receipt must forbid external network I/O.",
    policy?.promptOnlyImageEditAllowed === false ? "" : "Image reference delivery receipt must forbid prompt-only image edit.",
    policy?.providerSelfReportCanComplete === false ? "" : "Image reference delivery receipt must not complete from provider self-report.",
    policy?.seedanceOrJimengAllowed === false ? "" : "Image reference delivery receipt must forbid Seedance/Jimeng.",
    policy?.videoAllowed === false ? "" : "Image reference delivery receipt must forbid video providers.",
    policy?.fastOrVipAllowed === false ? "" : "Image reference delivery receipt must forbid Fast/VIP.",
    policy?.textToVideoAllowed === false ? "" : "Image reference delivery receipt must forbid text-to-video.",
    deliveryPolicy?.sideEffectAllowed === false ? "" : "Image reference delivery must not allow side effects.",
    deliveryPolicy?.providerSubmitAllowed === 0 ? "" : "Image reference delivery must not allow provider submit.",
    deliveryPolicy?.liveSubmitAllowed === false ? "" : "Image reference delivery must forbid live submit.",
    deliveryPolicy?.externalNetworkIoAllowed === false ? "" : "Image reference delivery must forbid external network I/O.",
    deliveryPolicy?.promptOnlyImageEditAllowed === false ? "" : "Image reference delivery must forbid prompt-only image edit.",
    deliveryPolicy?.providerSelfReportCanComplete === false ? "" : "Image reference delivery must not complete from provider self-report.",
    deliveryPolicy?.seedanceOrJimengAllowed === false ? "" : "Image reference delivery must forbid Seedance/Jimeng.",
    deliveryPolicy?.videoAllowed === false ? "" : "Image reference delivery must forbid video providers.",
    deliveryPolicy?.fastOrVipAllowed === false ? "" : "Image reference delivery must forbid Fast/VIP.",
    deliveryPolicy?.textToVideoAllowed === false ? "" : "Image reference delivery must forbid text-to-video.",
    ...(receipt.blockers || []).map((blocker) => `Image reference delivery blocker: ${blocker}`),
  ]);
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
      event.eventType === WORKER_EXIT_WITHOUT_EXPECTED_OUTPUT &&
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
    ...imageReferenceTransportBlockers(input),
    ...imageReferenceDeliveryBlockers(input),
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
        ? "外部服务已报告结束，但本地还没看到可用文件，所以不能标记完成。"
        : "Image2 请求已提交，正在等待结果文件。",
    };
  }

  if (manifestMatched && health?.healthStatus === "formal_ready" && health.qaStatus === "pass") {
    return {
      status: "ready_for_formal_review",
      userReadableStatus: "需要复核",
      userMessage: "输出已完成校验，可进入复核区。",
    };
  }

  return {
    status: "needs_review",
    userReadableStatus: "需要复核",
    userMessage: "输出已返回，但还需要完成校验。",
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
  const transportDispatchReady = !needsImageReferenceTransport(input.adapterRequest) || input.imageReferenceTransport?.status === "dispatch_ready";
  const transportRequestMatched = !needsImageReferenceTransport(input.adapterRequest) || imageReferenceTransportMatchesRequest(input);
  const deliveryDelivered = !needsImageReferenceTransport(input.adapterRequest) || input.imageReferenceDeliveryReceipt?.status === "delivered";
  const deliveryRequestMatched = !needsImageReferenceTransport(input.adapterRequest) || imageReferenceDeliveryMatchesRequest(input);

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
      imageReferenceTransportDispatchReady: transportDispatchReady,
      imageReferenceTransportRequestMatched: transportRequestMatched,
      imageReferenceDeliveryDelivered: deliveryDelivered,
      imageReferenceDeliveryRequestMatched: deliveryRequestMatched,
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
      "Image2image/end-frame calls require an Image Reference Transport dispatch_ready receipt before provider transport can plan.",
      "Image2image/end-frame calls require an Image Reference Delivery delivered receipt before one-shot readiness.",
      "A retry must be modeled as a new user-confirmed one-shot action.",
    ],
  };
}
