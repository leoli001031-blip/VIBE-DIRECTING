import type {
  Image2AdapterOperation,
  Image2AdapterRequest,
  Image2ReferenceImageInput,
  ImageTaskPlan,
  ProviderSlot,
  RequiredMode,
  ShotPromptPlan,
} from "../types";

export interface Image2AdapterValidationResult {
  valid: boolean;
  issues: string[];
}

export interface Image2OneShotRequestPreviewInput {
  previewId: string;
  providerId: string;
  providerSlot: ProviderSlot;
  requiredMode: RequiredMode;
  operation?: Image2AdapterOperation;
  outputPath?: string;
  submitPolicy?: {
    dry_run_only: true;
    manual_submit_required: true;
    live_submit_forbidden: true;
  };
  fallbackPolicy?: {
    noProviderOrModeFallback: true;
    inheritedForbiddenFallbacks: string[];
  };
}

export interface CompileImage2OneShotRealCallPayloadInput {
  request: Image2AdapterRequest;
  preview: Image2OneShotRequestPreviewInput;
  actionConfirmationId: string;
  credentialRef: string;
  outputSandboxRoot: string;
  manifestPath: string;
  qaReportPath: string;
  imageCount: number;
  budgetNotice: string;
}

export interface Image2OneShotRealCallPayload {
  providerFamily: "Image2";
  providerId: "openai-image2-api";
  adapterId: string;
  actionConfirmationId: string;
  credentialRef: string;
  requestId: string;
  taskPlanId: string;
  previewId: string;
  operation: Image2AdapterOperation;
  providerSlot: ProviderSlot;
  requiredMode: RequiredMode;
  imageCount: number;
  sourceIntent: string[];
  mustPreserve: string[];
  mustAvoid: string[];
  references: Array<{
    referenceId: string;
    source: "prompt_plan";
  }>;
  referenceImageInputs: Image2ReferenceImageInput[];
  sourceStartFrameId?: string;
  output: {
    path: string;
    sandboxRoot: string;
    manifestPath: string;
    qaReportPath: string;
  };
  executionPolicy: {
    actionTimeConfirmationRequired: true;
    budgetNoticeRequired: true;
    budgetNotice: string;
    scopedSandboxOnly: true;
    maxProviderSubmits: 1;
    maxImages: 2;
    maxConcurrency: 1;
    automaticRetryAllowed: false;
    maxAutoRetries: 0;
    arbitraryShellAllowed: false;
    unauthorizedCredentialAllowed: false;
    fastOrVipAllowed: false;
    textToVideoFallbackAllowed: false;
    providerOrModeFallbackAllowed: false;
    outputMayCompleteFromProviderSelfReport: false;
  };
}

export interface CompileImage2OneShotRealCallPayloadResult {
  payload?: Image2OneShotRealCallPayload;
  issues: string[];
}

function operationForPlan(taskPlan: ImageTaskPlan): Image2AdapterOperation {
  if (taskPlan.providerSlot === "image.reference_asset") return "reference_asset";
  if (taskPlan.requiredMode === "image2image") return "image2image";
  return "text2image";
}

function forbiddenFallbacksForPlan(taskPlan: ImageTaskPlan): string[] {
  const fallbacks = ["provider_or_mode_fallback"];
  if (taskPlan.requiredMode === "image2image" || taskPlan.providerSlot === "image.edit") {
    fallbacks.push("image2image_to_text2image", "independent_end_frame_generation");
  }
  if (taskPlan.providerSlot === "image.reference_asset" && taskPlan.requiredMode === "image2image") {
    fallbacks.push("reference_edit_to_text2image");
  }
  if (taskPlan.requiredMode === "text2image") {
    fallbacks.push("text2image_to_image2image");
  }
  return Array.from(new Set(fallbacks)).sort((left, right) => left.localeCompare(right));
}

function sourceStartFrameInput(inputs: Image2ReferenceImageInput[] = []): Image2ReferenceImageInput | undefined {
  return inputs.find(
    (input) =>
      input.role === "source_start_frame" &&
      input.required === true &&
      input.mustUseAsVisualInput === true &&
      input.status === "available" &&
      Boolean(input.path?.trim()),
  );
}

export function buildImage2AdapterRequest(taskPlan: ImageTaskPlan, promptPlan: ShotPromptPlan): Image2AdapterRequest {
  const referenceImageInputs = taskPlan.referenceImageInputs || promptPlan.referenceImageInputs || [];
  const startFrameInput = sourceStartFrameInput(referenceImageInputs);
  return {
    requestId: `image2_request_${taskPlan.taskPlanId}`,
    taskPlanId: taskPlan.taskPlanId,
    adapterId: `${taskPlan.providerId.replace(/[^a-zA-Z0-9_-]+/g, "_")}-dry-run`,
    operation: operationForPlan(taskPlan),
    frameRole: promptPlan.promptKind,
    payload: {
      sourceIntent: promptPlan.sourceIntent,
      mustPreserve: promptPlan.mustPreserve,
      mustAvoid: promptPlan.mustAvoid,
      references: taskPlan.inputReferenceIds.map((referenceId) => ({
        referenceId,
        source: "prompt_plan",
      })),
      referenceImageInputs,
      ...(startFrameInput ? { sourceStartFrameId: startFrameInput.path } : {}),
      outputPath: taskPlan.expectedOutputPath,
    },
    submitPolicy: {
      dry_run_only: true,
      manual_submit_required: true,
      live_submit_forbidden: true,
    },
    forbiddenFallbacks: forbiddenFallbacksForPlan(taskPlan),
  };
}

export function validateImage2AdapterRequest(request: Image2AdapterRequest): Image2AdapterValidationResult {
  const issues: string[] = [];

  if (!request.adapterId) issues.push("adapter_id_missing");
  if (!["text2image", "image2image", "reference_asset"].includes(request.operation)) issues.push("invalid_operation");
  if (!request.submitPolicy?.dry_run_only) issues.push("submit_policy_must_be_dry_run_only");
  if (!request.submitPolicy?.manual_submit_required) issues.push("submit_policy_must_require_manual_submit");
  if (!request.submitPolicy?.live_submit_forbidden) issues.push("submit_policy_must_forbid_live_submit");
  if (!request.payload?.outputPath) issues.push("payload_output_path_missing");
  if (!Array.isArray(request.payload?.sourceIntent)) issues.push("payload_source_intent_missing");
  if (!Array.isArray(request.payload?.references)) issues.push("payload_references_missing");

  if (request.operation === "image2image" && !request.forbiddenFallbacks.includes("image2image_to_text2image")) {
    issues.push("image2image_to_text2image_fallback_must_be_forbidden");
  }
  if (request.operation === "image2image" && !request.forbiddenFallbacks.includes("independent_end_frame_generation")) {
    issues.push("independent_end_frame_generation_must_be_forbidden");
  }
  if (request.operation === "image2image") {
    const referenceImageInputs = request.payload?.referenceImageInputs || [];
    const startFrameInput = sourceStartFrameInput(referenceImageInputs);
    if (!Array.isArray(request.payload?.referenceImageInputs)) issues.push("payload_reference_image_inputs_missing");
    if (!startFrameInput) issues.push("source_start_frame_visual_input_required");
    if (startFrameInput && request.payload.sourceStartFrameId && startFrameInput.path !== request.payload.sourceStartFrameId) {
      issues.push("source_start_frame_id_mismatch");
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function compileImage2OneShotRealCallPayload(
  input: CompileImage2OneShotRealCallPayloadInput,
): CompileImage2OneShotRealCallPayloadResult {
  const requestValidation = validateImage2AdapterRequest(input.request);
  const outputPath = input.preview.outputPath || input.request.payload.outputPath;
  const inheritedFallbacks = input.preview.fallbackPolicy?.inheritedForbiddenFallbacks || input.request.forbiddenFallbacks;
  const issues = [
    ...requestValidation.issues,
    input.preview.providerId === "openai-image2-api" ? "" : "one_shot_real_call_requires_openai_image2_provider",
    ["image.generate", "image.edit", "image.reference_asset"].includes(input.preview.providerSlot) ? "" : "one_shot_real_call_requires_image_slot",
    input.preview.operation && input.preview.operation !== input.request.operation ? "preview_operation_mismatch" : "",
    input.preview.submitPolicy?.manual_submit_required === true ? "" : "action_time_manual_submit_policy_missing",
    input.preview.submitPolicy?.live_submit_forbidden === true ? "" : "preview_must_start_from_live_submit_forbidden_review",
    input.preview.fallbackPolicy?.noProviderOrModeFallback === true ? "" : "provider_or_mode_fallback_ban_missing",
    inheritedFallbacks.includes("provider_or_mode_fallback") ? "" : "provider_or_mode_fallback_must_be_forbidden",
    input.imageCount > 0 && input.imageCount <= 2 ? "" : "one_shot_real_call_allows_one_or_two_images",
    outputPath ? "" : "compiled_payload_output_path_missing",
    input.actionConfirmationId ? "" : "action_confirmation_id_missing",
    input.credentialRef ? "" : "credential_ref_missing",
    input.outputSandboxRoot ? "" : "output_sandbox_root_missing",
    input.manifestPath ? "" : "manifest_path_missing",
    input.qaReportPath ? "" : "qa_report_path_missing",
    input.budgetNotice ? "" : "budget_notice_missing",
  ].filter(Boolean);

  if (issues.length > 0) return { issues };

  return {
    issues: [],
    payload: {
      providerFamily: "Image2",
      providerId: "openai-image2-api",
      adapterId: input.request.adapterId,
      actionConfirmationId: input.actionConfirmationId,
      credentialRef: input.credentialRef,
      requestId: input.request.requestId,
      taskPlanId: input.request.taskPlanId,
      previewId: input.preview.previewId,
      operation: input.request.operation,
      providerSlot: input.preview.providerSlot,
      requiredMode: input.preview.requiredMode,
      imageCount: input.imageCount,
      sourceIntent: input.request.payload.sourceIntent,
      mustPreserve: input.request.payload.mustPreserve,
      mustAvoid: input.request.payload.mustAvoid,
      references: input.request.payload.references,
      referenceImageInputs: input.request.payload.referenceImageInputs || [],
      ...(input.request.payload.sourceStartFrameId ? { sourceStartFrameId: input.request.payload.sourceStartFrameId } : {}),
      output: {
        path: outputPath,
        sandboxRoot: input.outputSandboxRoot,
        manifestPath: input.manifestPath,
        qaReportPath: input.qaReportPath,
      },
      executionPolicy: {
        actionTimeConfirmationRequired: true,
        budgetNoticeRequired: true,
        budgetNotice: input.budgetNotice,
        scopedSandboxOnly: true,
        maxProviderSubmits: 1,
        maxImages: 2,
        maxConcurrency: 1,
        automaticRetryAllowed: false,
        maxAutoRetries: 0,
        arbitraryShellAllowed: false,
        unauthorizedCredentialAllowed: false,
        fastOrVipAllowed: false,
        textToVideoFallbackAllowed: false,
        providerOrModeFallbackAllowed: false,
        outputMayCompleteFromProviderSelfReport: false,
      },
    },
  };
}
