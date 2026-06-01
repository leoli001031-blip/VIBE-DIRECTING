import type { DirectorAgentPlan } from "./directorAgentPlan";
import type {
  DirectorPrototypePreviewItem,
  DirectorPrototypeProviderSummary,
} from "./directorPrototypeTypes";
import type { ProviderBoundaryRequest } from "../providers";

type PreviewProviderRequest = Pick<ProviderBoundaryRequest, "inputHash" | "outputPath" | "requestId">;

export function createDirectorPrototypePreviewItem(
  plan: DirectorAgentPlan,
  request: PreviewProviderRequest,
): DirectorPrototypePreviewItem {
  return {
    id: `preview_${plan.runId}_${plan.selectedShotId}`,
    shotId: plan.selectedShotId,
    title: plan.selectedShot.title,
    mediaPath: plan.outputPath,
    source: "provider_mock_return",
    providerRequestId: request.requestId,
    inputHash: request.inputHash,
  };
}

export function summarizeDirectorProviderRequest(
  request: ProviderBoundaryRequest,
): DirectorPrototypeProviderSummary {
  return {
    requestId: request.requestId,
    providerId: request.providerId,
    taskKind: request.taskKind,
    status: request.status,
    reviewStatus: request.reviewStatus,
    inputHash: request.inputHash,
    outputPath: request.outputPath,
    liveSubmit: false,
    adapterMode: request.submitPolicy.adapterMode,
    fastTest: true,
  };
}
