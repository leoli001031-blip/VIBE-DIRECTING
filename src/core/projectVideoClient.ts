import { projectSeedanceResumeEndpoint, projectSeedanceSubmitEndpoint } from "./projectImage2Endpoints";
import { buildDirectorQaUserFeedback, type DirectorQaUserFeedback } from "./directorQaUserFeedback";
import type { DirectorAgentToolTrace } from "./directorAgentToolTrace";
import type { DirectorRuleQaReport } from "./directorRuleQa";
import type { DirectorTextQaReport } from "./directorTextQa";
import {
  fetchRuntimeJson,
  hasProjectRuntimeIdentity,
  projectRuntimeRequestPath,
  type ProjectRuntimeIdentity,
} from "./runtimeApiClient";
import {
  JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION,
  JIMENG_CLI_VIP_MODEL_VERSION,
} from "./jimengVideoCli";

export type ProjectSeedanceSubmitInput = {
  providerId?: string;
  modelVersion?: "seedance2.0" | "seedance2.0fast" | "seedance2.0_vip" | "seedance2.0fast_vip";
  videoResolution?: "720p" | "1080p";
  ratio?: "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "21:9";
  durationSeconds?: number;
  pollSeconds?: number;
  selectedShotIds?: string[];
  agentTaskEnvelope?: DirectorAgentToolTrace;
  confirmation: {
    receiptId: string;
    confirmedAt: string;
    phrase: "submit-seedance-video";
    confirmed: boolean;
  };
};

export type ProjectSeedanceResumeInput = {
  relayQueueItemId?: string;
  pollSeconds?: number;
};

export type ProjectSeedanceRelayQueueItem = {
  id?: string;
  segmentId?: string;
  shotId?: string;
  title?: string;
  status?: string;
  promptPath?: string;
  referencePaths?: string[];
  submitId?: string;
  resumeCommand?: string;
  outputVideoPath?: string;
  localMediaPaths?: string[];
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
  ruleQaReport?: DirectorRuleQaReport;
  textQaReport?: DirectorTextQaReport;
  qaFeedback?: DirectorQaUserFeedback;
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
    activeItemIds?: string[];
    resumeCommands?: string[];
    items?: ProjectSeedanceRelayQueueItem[];
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
    const result = await fetchRuntimeJson(projectRuntimeRequestPath(projectSeedanceSubmitEndpoint, expected), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId: input.providerId || "apikey-fun-gpt55-responses-image",
        modelVersion: input.modelVersion || JIMENG_CLI_VIP_MODEL_VERSION,
        videoResolution: input.videoResolution || JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION,
        ratio: input.ratio || "16:9",
        durationSeconds: input.durationSeconds,
        pollSeconds: input.pollSeconds,
        selectedShotIds: input.selectedShotIds,
        agentTaskEnvelope: input.agentTaskEnvelope,
        confirmation: input.confirmation,
      }),
    }) as ProjectSeedanceSubmitResult;
    return {
      ...result,
      qaFeedback: buildDirectorQaUserFeedback(result),
    };
  } catch (error) {
    console.error("submitProjectSeedanceVideo failed:", error);
    return { ok: false, status: "blocked", uiStatus: "blocked", message: "视频提交未完成，请检查生成服务、即梦登录和项目参考。" };
  }
}

export async function resumeProjectSeedanceVideo(
  expected: ProjectRuntimeIdentity | undefined,
  input: ProjectSeedanceResumeInput = {},
): Promise<ProjectSeedanceSubmitResult> {
  if (!hasProjectRuntimeIdentity(expected)) {
    return { ok: false, status: "blocked", uiStatus: "blocked", message: "未选择项目/未同步。" };
  }

  try {
    const result = await fetchRuntimeJson(projectRuntimeRequestPath(projectSeedanceResumeEndpoint, expected), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        relayQueueItemId: input.relayQueueItemId,
        pollSeconds: input.pollSeconds,
      }),
    }) as ProjectSeedanceSubmitResult;
    return {
      ...result,
      qaFeedback: buildDirectorQaUserFeedback(result),
    };
  } catch (error) {
    console.error("resumeProjectSeedanceVideo failed:", error);
    return { ok: false, status: "blocked", uiStatus: "blocked", message: "视频查询未完成，请检查即梦登录和项目队列。" };
  }
}
