import { projectSeedanceSubmitEndpoint } from "./projectImage2Endpoints";
import {
  fetchRuntimeJson,
  hasProjectRuntimeIdentity,
  projectRuntimeRequestPath,
  type ProjectRuntimeIdentity,
} from "./runtimeApiClient";

export type ProjectSeedanceSubmitInput = {
  providerId?: string;
  modelVersion?: "seedance2.0" | "seedance2.0fast" | "seedance2.0_vip" | "seedance2.0fast_vip";
  videoResolution?: "720p" | "1080p";
  ratio?: "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9";
  durationSeconds?: number;
  pollSeconds?: number;
  selectedShotIds?: string[];
  confirmation: {
    receiptId: string;
    confirmedAt: string;
    phrase: "submit-seedance-video";
    confirmed: boolean;
  };
};

export type ProjectSeedanceSubmitResult = {
  ok?: boolean;
  status?: string;
  uiStatus?: "blocked" | "submitted" | "queued" | "generating" | "needs_review" | "success" | "timed_out" | string;
  message?: string;
  storyboardGenerated?: boolean;
  videoSubmitted?: boolean;
  outputRoot?: string;
  storyboardReferencePath?: string;
  promptPath?: string;
  storyboardPromptPath?: string;
  submitLogPath?: string;
  previewPlanPath?: string;
  submitId?: string;
  taskId?: string;
  outputVideoPath?: string;
  resumeCommand?: string;
  blockers?: string[];
  providerCalled?: boolean;
  runtimeExternalNetworkCallMade?: boolean;
  relayQueue?: {
    status?: string;
    counts?: {
      total?: number;
      completed?: number;
      active?: number;
      ready?: number;
      failed?: number;
      blocked?: number;
    };
    autoSubmitAllowed?: boolean;
    nextReadyItemId?: string;
    userSummary?: string;
  };
};

export async function submitProjectSeedanceVideo(
  expected: ProjectRuntimeIdentity | undefined,
  input: ProjectSeedanceSubmitInput,
): Promise<ProjectSeedanceSubmitResult> {
  if (!hasProjectRuntimeIdentity(expected)) {
    return { ok: false, status: "blocked", uiStatus: "blocked", message: "未选择项目/未同步。" };
  }
  if (input.confirmation.confirmed !== true || input.confirmation.phrase !== "submit-seedance-video") {
    return { ok: false, status: "blocked", uiStatus: "blocked", message: "请先明确确认本次视频提交。" };
  }

  try {
    return await fetchRuntimeJson(projectRuntimeRequestPath(projectSeedanceSubmitEndpoint, expected), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId: input.providerId || "apikey-fun-gpt55-responses-image",
        modelVersion: input.modelVersion || "seedance2.0",
        videoResolution: input.videoResolution || "720p",
        ratio: input.ratio || "16:9",
        durationSeconds: input.durationSeconds,
        pollSeconds: input.pollSeconds,
        selectedShotIds: input.selectedShotIds,
        confirmation: input.confirmation,
      }),
    }) as ProjectSeedanceSubmitResult;
  } catch (error) {
    console.error("submitProjectSeedanceVideo failed:", error);
    return { ok: false, status: "blocked", uiStatus: "blocked", message: "视频提交未完成，请检查生成服务、即梦登录和项目参考。" };
  }
}
