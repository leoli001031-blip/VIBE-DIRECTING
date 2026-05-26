import { useCallback, useMemo, useState } from "react";
import {
  loadProjectRealChainStatus,
  type ProjectRealChainUiState,
  type ProjectRuntimeIdentity,
} from "../../core/projectCurrentRuntimeClient";
import {
  submitProjectSeedanceVideo,
  type ProjectSeedanceSubmitResult,
} from "../../core/projectVideoClient";
import {
  loadProviderConfigStatuses,
  type ProviderConfigStatus,
} from "../../core/providerCredentialsClient";

const STORYBOARD_PROVIDER_ID = "apikey-fun-gpt55-responses-image";
const SEEDANCE_SUBMIT_CONFIRM_PHRASE = "submit-seedance-video";
const SEEDANCE_SUBMIT_UI_TIMEOUT_MS = 180_000;

export type SeedanceVideoSubmitActionStatus = "idle" | "running" | "blocked" | "submitted" | "needs_review";

export type SeedanceVideoSubmitActionState = {
  status: SeedanceVideoSubmitActionStatus;
  message?: string;
};

export type SeedanceVideoSubmitActionView = SeedanceVideoSubmitActionState & {
  keyConfigured: boolean;
  disabled: boolean;
  ready: boolean;
};

type UseSeedanceVideoSubmitActionInput = {
  runtimeProjectIdentity?: ProjectRuntimeIdentity;
  selectedShotIds?: string[];
  providerConfigStatuses: ProviderConfigStatus[];
  setProviderConfigStatuses: (statuses: ProviderConfigStatus[]) => void;
  setProjectRealChainState: (state: ProjectRealChainUiState) => void;
  openPreview: () => void;
  confirmAction?: (message: string) => boolean;
};

function defaultConfirmAction(message: string) {
  return typeof window !== "undefined" ? window.confirm(message) : false;
}

function isStoryboardProviderConfigured(statuses: ProviderConfigStatus[]) {
  return statuses.find((status) => status.providerId === STORYBOARD_PROVIDER_ID)?.credential?.keyStatus === "configured";
}

function seedanceActionState(result: ProjectSeedanceSubmitResult): SeedanceVideoSubmitActionState {
  if ((result.outputVideoPath || result.status === "success" || result.uiStatus === "needs_review") && result.relayQueue?.autoSubmitAllowed) {
    return {
      status: "idle",
      message: result.message || "本段视频已生成，下一段可以继续提交。",
    };
  }
  if (result.videoSubmitted || result.status === "submitted" || result.status === "queued" || result.status === "generating" || result.status === "timed_out") {
    return {
      status: "submitted",
      message: result.message || result.relayQueue?.userSummary || "视频已提交，即梦排队中；可以稍后恢复查询。",
    };
  }
  if (result.outputVideoPath || result.status === "success" || result.uiStatus === "needs_review") {
    return {
      status: "needs_review",
      message: result.message || "视频已生成，等待复核。",
    };
  }
  return {
    status: "blocked",
    message: result.message || "视频提交未完成，可以稍后重试。",
  };
}

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error("视频已经提交检查中，正在刷新项目状态。")), ms);
  });
}

function seedanceActionStateFromRuntime(state: ProjectRealChainUiState): SeedanceVideoSubmitActionState | undefined {
  const relayQueue = state.summary?.relayQueue;
  if (relayQueue) {
    if (relayQueue.status === "running") {
      return {
        status: "submitted",
        message: relayQueue.userSummary || "即梦正在处理当前段，回来后会继续下一段。",
      };
    }
    if (relayQueue.autoSubmitAllowed) {
      return {
        status: "idle",
        message: relayQueue.userSummary || "下一段已准备好，可以继续提交。",
      };
    }
    if (relayQueue.status === "complete") {
      return {
        status: "needs_review",
        message: relayQueue.userSummary || "视频队列已处理完，等待复核。",
      };
    }
    if (relayQueue.status === "blocked" || relayQueue.counts.failed > 0) {
      return {
        status: "blocked",
        message: relayQueue.userSummary || "视频队列需要处理后再继续。",
      };
    }
  }
  const items = state.summary?.previewItems || [];
  const hasSubmittedVideo = items.some((item) => {
    const statusText = `${item.status || ""} ${item.previewStatus || ""} ${item.videoStatus || ""}`;
    return Boolean(item.submitId || item.outputVideoPath || item.mediaPath)
      || /queued|submitted|generating|success|returned|review/i.test(statusText);
  });
  if (!hasSubmittedVideo) return undefined;
  const hasReturnedVideo = items.some((item) => {
    const statusText = `${item.status || ""} ${item.previewStatus || ""} ${item.videoStatus || ""}`;
    return Boolean(item.outputVideoPath || item.mediaPath) || /success|returned|review/i.test(statusText);
  });
  return hasReturnedVideo
    ? { status: "needs_review", message: "视频已生成，等待复核。" }
    : { status: "submitted", message: "视频已提交，即梦排队中；可以稍后恢复查询。" };
}

export function useSeedanceVideoSubmitAction({
  runtimeProjectIdentity,
  selectedShotIds = [],
  providerConfigStatuses,
  setProviderConfigStatuses,
  setProjectRealChainState,
  openPreview,
  confirmAction = defaultConfirmAction,
}: UseSeedanceVideoSubmitActionInput) {
  const [actionState, setActionState] = useState<SeedanceVideoSubmitActionState>({ status: "idle" });
  const keyConfigured = useMemo(() => isStoryboardProviderConfigured(providerConfigStatuses), [providerConfigStatuses]);

  const runSeedanceVideoSubmit = useCallback(async () => {
    if (!runtimeProjectIdentity) {
      setActionState({ status: "blocked", message: "先选择项目。" });
      return;
    }

    const statuses = await loadProviderConfigStatuses();
    setProviderConfigStatuses(statuses);
    if (!isStoryboardProviderConfigured(statuses)) {
      setActionState({ status: "blocked", message: "先去设置里完成视频连接。" });
      return;
    }

    if (!confirmAction("要提交当前故事到 Seedance 2.0 720p 吗？\n\n即梦可能排队很久，提交后可以稍后回来查。")) {
      setActionState({ status: "blocked", message: "已取消，本次没有提交。" });
      return;
    }

    setActionState({ status: "running", message: "正在生成故事板参考并提交 Seedance 2.0 720p。" });
    try {
      const submitted = await Promise.race([
        submitProjectSeedanceVideo(runtimeProjectIdentity, {
          providerId: STORYBOARD_PROVIDER_ID,
          modelVersion: "seedance2.0",
          videoResolution: "720p",
          ratio: "16:9",
          pollSeconds: 90,
          selectedShotIds,
          confirmation: {
            receiptId: `seedance_video_ui_${Date.now()}`,
            confirmedAt: new Date().toISOString(),
            phrase: SEEDANCE_SUBMIT_CONFIRM_PHRASE,
            confirmed: true,
          },
        }),
        timeoutAfter(SEEDANCE_SUBMIT_UI_TIMEOUT_MS),
      ]);
      const nextState = seedanceActionState(submitted);
      setActionState(nextState);
      const refreshed = await loadProjectRealChainStatus(runtimeProjectIdentity);
      setProjectRealChainState(refreshed);
      if (nextState.status === "submitted" || nextState.status === "needs_review") openPreview();
    } catch (error) {
      try {
        const refreshed = await loadProjectRealChainStatus(runtimeProjectIdentity);
        setProjectRealChainState(refreshed);
        const recovered = seedanceActionStateFromRuntime(refreshed);
        if (recovered) {
          setActionState(recovered);
          openPreview();
          return;
        }
      } catch {
        // Keep the original submit error visible if recovery also fails.
      }
      setActionState({
        status: "blocked",
        message: error instanceof Error ? error.message : "视频提交失败。",
      });
    }
  }, [
    confirmAction,
    openPreview,
    runtimeProjectIdentity,
    selectedShotIds,
    setProjectRealChainState,
    setProviderConfigStatuses,
  ]);

  const videoSubmitAction = useMemo<SeedanceVideoSubmitActionView>(() => ({
    keyConfigured,
    status: actionState.status,
    message: actionState.message,
    disabled: actionState.status === "running" || !runtimeProjectIdentity,
    ready: Boolean(runtimeProjectIdentity),
  }), [actionState.message, actionState.status, keyConfigured, runtimeProjectIdentity]);

  return {
    videoSubmitAction,
    runSeedanceVideoSubmit,
  };
}
