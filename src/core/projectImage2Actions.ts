import {
  fetchRuntimeJson,
  hasProjectRuntimeIdentity,
  projectRuntimeRequestPath,
  type ProjectRuntimeIdentity,
} from "./runtimeApiClient";
import {
  projectImage2BatchPlanEndpoint,
  projectImage2BatchRunCheckEndpoint,
  projectImage2OneShotConfirmEndpoint,
  projectImage2OneShotExecuteReturnEndpoint,
  projectImage2OneShotPrepareEndpoint,
  projectImage2OneShotPrepareTriggerEndpoint,
  projectImage2OneShotStatusEndpoint,
  projectImage2AssetGenerateEndpoint,
  projectImage2EndFrameSubmitEndpoint,
  projectP6RealImage2SubmitEndpoint,
  projectP6RealImage2SubmitSerialEndpoint,
} from "./projectImage2Endpoints";
import {
  deriveProjectImage2BatchPlanStatus,
  deriveProjectImage2OneShotStatus,
  guardProjectImage2BatchUiStateForCurrentProject,
  guardProjectImage2OneShotUiStateForCurrentProject,
} from "./projectImage2Derive";
import type {
  ProjectImage2BatchUiState,
  ProjectImage2OneShotPermissionInput,
  ProjectImage2OneShotReceipt,
  ProjectImage2OneShotUiState,
  ProjectImage2AssetGenerationInput,
  ProjectImage2AssetGenerationResult,
  ProjectImage2EndFrameSubmitInput,
  ProjectImage2EndFrameSubmitResult,
  ProjectP6RealImage2SerialBatchInput,
  ProjectP6RealImage2SubmitInput,
} from "./projectImage2Types";

async function unavailableImage2BatchState(message: string): Promise<ProjectImage2BatchUiState> {
  return { status: "unavailable", message };
}

export async function loadProjectImage2BatchPlan(expected?: ProjectRuntimeIdentity): Promise<ProjectImage2BatchUiState> {
  if (!hasProjectRuntimeIdentity(expected)) {
    return unavailableImage2BatchState("未选择项目/未同步。");
  }

  try {
    const payload = await fetchRuntimeJson(projectRuntimeRequestPath(projectImage2BatchPlanEndpoint, expected));
    const summary = deriveProjectImage2BatchPlanStatus(payload);
    return guardProjectImage2BatchUiStateForCurrentProject({ status: summary.uiStatus, summary }, expected);
  } catch (err) {
    console.error("loadProjectImage2BatchPlan failed:", err);
    return unavailableImage2BatchState(
      "未选择项目/未同步。",
    );
  }
}

export async function runProjectImage2BatchCheck(expected?: ProjectRuntimeIdentity): Promise<ProjectImage2BatchUiState> {
  if (!hasProjectRuntimeIdentity(expected)) {
    return unavailableImage2BatchState("未选择项目/未同步。");
  }

  try {
    const payload = await fetchRuntimeJson(projectRuntimeRequestPath(projectImage2BatchRunCheckEndpoint, expected), { method: "POST" });
    const summary = deriveProjectImage2BatchPlanStatus(payload);
    return guardProjectImage2BatchUiStateForCurrentProject({ status: summary.uiStatus, summary }, expected);
  } catch (err) {
    console.error("runProjectImage2BatchCheck failed:", err);
    return unavailableImage2BatchState(
      "未选择项目/未同步。",
    );
  }
}

function oneShotUnavailable(message = "未选择项目/未同步。"): ProjectImage2OneShotUiState {
  return { status: "unavailable", message };
}

function oneShotPath(endpoint: string, selectedShotId?: string) {
  if (!selectedShotId) return endpoint;
  return `${endpoint}?selectedShotId=${encodeURIComponent(selectedShotId)}`;
}

export async function loadProjectImage2OneShotStatus(
  expected?: ProjectRuntimeIdentity,
  selectedShotId?: string,
): Promise<ProjectImage2OneShotUiState> {
  if (!hasProjectRuntimeIdentity(expected)) return oneShotUnavailable();
  if (!selectedShotId) return { status: "unavailable", message: "选择镜头后可准备小样包。" };

  try {
    const payload = await fetchRuntimeJson(projectRuntimeRequestPath(oneShotPath(projectImage2OneShotStatusEndpoint, selectedShotId), expected));
    const summary = deriveProjectImage2OneShotStatus(payload);
    return guardProjectImage2OneShotUiStateForCurrentProject({ status: summary.uiStatus, summary, receipt: summary.receipt }, expected);
  } catch (err) {
    console.error("loadProjectImage2OneShotStatus failed:", err);
    return oneShotUnavailable("选择镜头后可准备小样包。");
  }
}

export async function prepareProjectImage2OneShot(
  expected?: ProjectRuntimeIdentity,
  selectedShotId?: string,
): Promise<ProjectImage2OneShotUiState> {
  if (!hasProjectRuntimeIdentity(expected)) return oneShotUnavailable();
  if (!selectedShotId) return { status: "blocked", message: "请先选择一个镜头。" };

  try {
    const payload = await fetchRuntimeJson(projectRuntimeRequestPath(projectImage2OneShotPrepareEndpoint, expected), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId,
        selectedShotIds: [selectedShotId],
        imageCount: 1,
      }),
    });
    const summary = deriveProjectImage2OneShotStatus(payload);
    return guardProjectImage2OneShotUiStateForCurrentProject({ status: summary.uiStatus, summary, receipt: summary.receipt, message: summary.message }, expected);
  } catch (err) {
    console.error("prepareProjectImage2OneShot failed:", err);
    return { status: "blocked", message: "小样准备失败，请检查镜头和引用。" };
  }
}

export async function confirmProjectImage2OneShot(
  expected?: ProjectRuntimeIdentity,
  receipt?: ProjectImage2OneShotReceipt,
): Promise<ProjectImage2OneShotUiState> {
  if (!hasProjectRuntimeIdentity(expected)) return oneShotUnavailable();
  if (!receipt?.selectedShotId) return { status: "blocked", message: "请先准备小样包。" };

  try {
    const payload = await fetchRuntimeJson(projectRuntimeRequestPath(projectImage2OneShotConfirmEndpoint, expected), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId: receipt.selectedShotId,
        selectedShotIds: [receipt.selectedShotId],
        imageCount: 1,
        expectedOutputPath: receipt.expectedOutputPath,
        receipt,
      }),
    });
    const summary = deriveProjectImage2OneShotStatus(payload);
    return guardProjectImage2OneShotUiStateForCurrentProject({ status: summary.uiStatus, summary, receipt: summary.receipt, message: summary.message }, expected);
  } catch (err) {
    console.error("confirmProjectImage2OneShot failed:", err);
    return { status: "blocked", message: "确认动作失败，请重新准备小样包。" };
  }
}

export async function prepareProjectImage2OneShotTrigger(
  expected?: ProjectRuntimeIdentity,
  receipt?: ProjectImage2OneShotReceipt,
  options?: ProjectImage2OneShotPermissionInput,
): Promise<ProjectImage2OneShotUiState> {
  if (!hasProjectRuntimeIdentity(expected)) return oneShotUnavailable();
  if (!receipt?.selectedShotId) return { status: "blocked", message: "请先确认动作。" };

  const requestBody: Record<string, unknown> = {
    selectedShotId: receipt.selectedShotId,
    selectedShotIds: [receipt.selectedShotId],
    imageCount: 1,
    expectedOutputPath: receipt.expectedOutputPath,
    receiptId: receipt.receiptId,
    transportMode: "agent_app_server",
  };
  if (options?.requireSubmitPermissionReceipt) {
    requestBody.submitPermissionReceiptRequired = true;
    requestBody.credentialRef = options.credentialRef;
    requestBody.maxProviderCallsPerReceipt = 1;
    requestBody.actionTimeConfirmation = {
      required: true,
      userConfirmedAtActionTime: false,
    };
    requestBody.expectedOutputs = [{
      shotId: receipt.selectedShotId,
      expectedOutputPath: receipt.expectedOutputPath,
      providerObservationPath: receipt.providerObservationPath,
      semanticQaPath: receipt.semanticQaPath,
    }];
  }

  try {
    const payload = await fetchRuntimeJson(projectRuntimeRequestPath(projectImage2OneShotPrepareTriggerEndpoint, expected), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const summary = deriveProjectImage2OneShotStatus(payload);
    return guardProjectImage2OneShotUiStateForCurrentProject({ status: summary.uiStatus, summary, receipt: summary.receipt || receipt, message: summary.message }, expected);
  } catch (err) {
    console.error("prepareProjectImage2OneShotTrigger failed:", err);
    return { status: "blocked", message: "等待动作准备失败，请重新确认。" };
  }
}

export async function prepareProjectImage2OneShotPermissionReceipt(
  expected?: ProjectRuntimeIdentity,
  receipt?: ProjectImage2OneShotReceipt,
  credentialRef?: string,
): Promise<ProjectImage2OneShotUiState> {
  return prepareProjectImage2OneShotTrigger(expected, receipt, {
    requireSubmitPermissionReceipt: true,
    credentialRef,
  });
}

export async function executeReturnedProjectImage2OneShot(
  expected?: ProjectRuntimeIdentity,
  receipt?: ProjectImage2OneShotReceipt,
): Promise<ProjectImage2OneShotUiState> {
  if (!hasProjectRuntimeIdentity(expected)) return oneShotUnavailable();
  if (!receipt?.selectedShotId) return { status: "blocked", message: "请先确认动作。" };

  try {
    const payload = await fetchRuntimeJson(projectRuntimeRequestPath(projectImage2OneShotExecuteReturnEndpoint, expected), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId: receipt.selectedShotId,
        selectedShotIds: [receipt.selectedShotId],
        imageCount: 1,
        expectedOutputPath: receipt.expectedOutputPath,
        receiptId: receipt.receiptId,
      }),
    });
    const summary = deriveProjectImage2OneShotStatus(payload);
    return guardProjectImage2OneShotUiStateForCurrentProject({ status: summary.uiStatus, summary, receipt: summary.receipt, message: summary.message }, expected);
  } catch (err) {
    console.error("executeReturnedProjectImage2OneShot failed:", err);
    return { status: "blocked", message: "回流检查未发现可用返回。" };
  }
}

export async function submitProjectImage2AssetGeneration(
  expected: ProjectRuntimeIdentity | undefined,
  input: ProjectImage2AssetGenerationInput,
): Promise<ProjectImage2AssetGenerationResult> {
  if (!hasProjectRuntimeIdentity(expected)) {
    return { ok: false, status: "blocked", uiStatus: "blocked", message: "未选择项目/未同步。" };
  }
  if (input.confirmation.confirmed !== true || input.confirmation.phrase !== "generate-image2-assets") {
    return { ok: false, status: "blocked", uiStatus: "blocked", message: "请先明确确认本次生成。" };
  }

  try {
    return await fetchRuntimeJson(projectRuntimeRequestPath(projectImage2AssetGenerateEndpoint, expected), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scope: input.scope,
        selectedShotId: input.selectedShotId,
        selectedShotIds: input.selectedShotIds,
        assetTypes: input.assetTypes,
        providerId: input.providerId || "lanyi-image2",
        confirmation: input.confirmation,
        mockProviderResult: input.mockProviderResult,
      }),
    }) as ProjectImage2AssetGenerationResult;
  } catch (err) {
    console.error("submitProjectImage2AssetGeneration failed:", err);
    return { ok: false, status: "blocked", uiStatus: "blocked", message: "参考生成未完成，请检查 Key 和项目资产。" };
  }
}

export async function submitProjectImage2EndFrame(
  expected: ProjectRuntimeIdentity | undefined,
  input: ProjectImage2EndFrameSubmitInput,
): Promise<ProjectImage2EndFrameSubmitResult> {
  if (!hasProjectRuntimeIdentity(expected)) {
    return { ok: false, status: "blocked", uiStatus: "blocked", message: "未选择项目/未同步。" };
  }
  if (input.confirmation.confirmed !== true || input.confirmation.phrase !== "generate-image2-end-frame") {
    return { ok: false, status: "blocked", uiStatus: "blocked", message: "请先明确确认本次生成。" };
  }

  try {
    return await fetchRuntimeJson(projectRuntimeRequestPath(projectImage2EndFrameSubmitEndpoint, expected), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId: input.selectedShotId,
        selectedShotIds: input.selectedShotIds,
        providerId: input.providerId || "lanyi-image2",
        prompt: input.prompt,
        confirmation: input.confirmation,
        mockProviderResult: input.mockProviderResult,
      }),
    }) as ProjectImage2EndFrameSubmitResult;
  } catch (err) {
    console.error("submitProjectImage2EndFrame failed:", err);
    return { ok: false, status: "blocked", uiStatus: "blocked", message: "结束帧生成未完成，请检查起始帧、Key 和回流证据。" };
  }
}

export async function submitProjectP6RealImage2OneShot(
  expected: ProjectRuntimeIdentity | undefined,
  input: ProjectP6RealImage2SubmitInput,
): Promise<ProjectImage2OneShotUiState> {
  if (!hasProjectRuntimeIdentity(expected)) return oneShotUnavailable();
  const receipt = input.receipt;
  const submitPermissionReceipt = input.submitPermissionReceipt;
  if (!receipt?.selectedShotId) return { status: "blocked", message: "请先准备小样包。" };
  if (submitPermissionReceipt?.status !== "pending_action_time_confirmation") {
    return { status: "blocked", receipt, message: "请先生成许可回执。" };
  }
  if (input.confirmation.confirmed !== true || input.confirmation.phrase !== "submit-p6-image2") {
    return { status: "blocked", receipt, message: "请先明确确认本次生成。" };
  }

  try {
    const payload = await fetchRuntimeJson(projectRuntimeRequestPath(projectP6RealImage2SubmitEndpoint, expected), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotId: receipt.selectedShotId,
        selectedShotIds: [receipt.selectedShotId],
        imageCount: 1,
        receipt,
        submitPermissionReceipt,
        providerId: input.providerId || "lanyi-image2",
        confirmation: input.confirmation,
        mockProviderResult: input.mockProviderResult,
      }),
    });
    const summary = deriveProjectImage2OneShotStatus(payload);
    return guardProjectImage2OneShotUiStateForCurrentProject({ status: summary.uiStatus, summary, receipt: summary.receipt || receipt, message: summary.message }, expected);
  } catch (err) {
    console.error("submitProjectP6RealImage2OneShot failed:", err);
    return { status: "blocked", receipt, message: "真实出图提交未完成，请检查 Key、确认和回流证据。" };
  }
}

export async function submitProjectP6RealImage2SerialBatch(
  expected: ProjectRuntimeIdentity | undefined,
  input: ProjectP6RealImage2SerialBatchInput,
): Promise<Record<string, unknown>> {
  if (!hasProjectRuntimeIdentity(expected)) {
    return { ok: false, status: "unavailable", message: "未选择项目/未同步。" };
  }
  const selectedShotIds = Array.isArray(input.selectedShotIds)
    ? input.selectedShotIds.map((shotId) => shotId.trim()).filter(Boolean)
    : [];
  if (selectedShotIds.length < 1 || selectedShotIds.length > 3 || new Set(selectedShotIds).size !== selectedShotIds.length) {
    return { ok: false, status: "blocked", message: "P6 serial batch requires 1 to 3 unique shot ids." };
  }

  try {
    return await fetchRuntimeJson(projectRuntimeRequestPath(projectP6RealImage2SubmitSerialEndpoint, expected), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selectedShotIds,
        providerId: input.providerId || "lanyi-image2",
        mockProviderResult: input.mockProviderResult,
        shots: input.shots,
      }),
    }) as Record<string, unknown>;
  } catch (err) {
    console.error("submitProjectP6RealImage2SerialBatch failed:", err);
    return { ok: false, status: "blocked", message: "P6 serial Image2 submit did not complete." };
  }
}
