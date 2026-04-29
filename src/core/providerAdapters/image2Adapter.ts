import type { Image2AdapterOperation, Image2AdapterRequest, ImageTaskPlan, ShotPromptPlan } from "../types";

export interface Image2AdapterValidationResult {
  valid: boolean;
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
    fallbacks.push("image2image_to_text2image");
  }
  if (taskPlan.providerSlot === "image.reference_asset" && taskPlan.requiredMode === "image2image") {
    fallbacks.push("reference_edit_to_text2image");
  }
  if (taskPlan.requiredMode === "text2image") {
    fallbacks.push("text2image_to_image2image");
  }
  return Array.from(new Set(fallbacks)).sort((left, right) => left.localeCompare(right));
}

export function buildImage2AdapterRequest(taskPlan: ImageTaskPlan, promptPlan: ShotPromptPlan): Image2AdapterRequest {
  return {
    requestId: `image2_request_${taskPlan.taskPlanId}`,
    taskPlanId: taskPlan.taskPlanId,
    adapterId: "image2-dry-run",
    operation: operationForPlan(taskPlan),
    payload: {
      sourceIntent: promptPlan.sourceIntent,
      mustPreserve: promptPlan.mustPreserve,
      mustAvoid: promptPlan.mustAvoid,
      references: taskPlan.inputReferenceIds.map((referenceId) => ({
        referenceId,
        source: "prompt_plan",
      })),
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

  if (request.adapterId !== "image2-dry-run") issues.push("adapter_id_must_be_image2_dry_run");
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

  return {
    valid: issues.length === 0,
    issues,
  };
}
