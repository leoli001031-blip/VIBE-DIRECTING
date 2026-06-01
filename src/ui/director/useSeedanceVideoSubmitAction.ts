import { useCallback, useMemo, useState } from "react";
import {
  loadProjectRealChainStatus,
  type ProjectRealChainUiState,
  type ProjectRuntimeIdentity,
} from "../../core/projectCurrentRuntimeClient";
import {
  resumeProjectSeedanceVideo,
  submitProjectSeedanceVideo,
  type ProjectSeedanceSubmitResult,
} from "../../core/projectVideoClient";
import type { DirectorQaUserFeedback } from "../../core/directorQaUserFeedback";
import type { DirectorAgentToolTrace } from "../../core/directorAgentToolTrace";
import {
  loadProviderConfigStatuses,
  type ProviderConfigStatus,
} from "../../core/providerCredentialsClient";
import type { ProjectRuntimeState } from "../../core/projectState";

const STORYBOARD_PROVIDER_ID = "apikey-fun-gpt55-responses-image";
const SEEDANCE_SUBMIT_CONFIRM_PHRASE = "submit-seedance-video";
const SEEDANCE_SUBMIT_UI_TIMEOUT_MS = 180_000;

export type SeedanceVideoSubmitActionStatus = "idle" | "running" | "blocked" | "submitted" | "needs_review";

export type SeedanceVideoSubmitActionState = {
  status: SeedanceVideoSubmitActionStatus;
  message?: string;
  qaFeedback?: DirectorQaUserFeedback;
  canResume?: boolean;
};

export type SeedanceVideoSubmitActionView = SeedanceVideoSubmitActionState & {
  keyConfigured: boolean;
  disabled: boolean;
  ready: boolean;
};

type UseSeedanceVideoSubmitActionInput = {
  runtimeProjectIdentity?: ProjectRuntimeIdentity;
  runtimeState?: ProjectRuntimeState;
  selectedShotIds?: string[];
  providerConfigStatuses: ProviderConfigStatus[];
  setProviderConfigStatuses: (statuses: ProviderConfigStatus[]) => void;
  setProjectRealChainState: (state: ProjectRealChainUiState) => void;
  openPreview: () => void;
  confirmAction?: (message: string) => boolean;
};

export type SeedanceVideoSubmitRunOptions = {
  selectedShotIds?: string[];
  selectedAssetId?: string;
  sectionId?: string;
  skipConfirm?: boolean;
  confirmationReceiptId?: string;
  confirmedAt?: string;
  agentToolTrace?: DirectorAgentToolTrace;
};

function defaultConfirmAction(message: string) {
  return typeof window !== "undefined" ? window.confirm(message) : false;
}

function uniqueShotIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

function shotIdsForSection(runtimeState: ProjectRuntimeState | undefined, sectionId: string | undefined) {
  if (!runtimeState || !sectionId?.trim()) return [];
  return uniqueShotIds(runtimeState.storyFlow.shots
    .filter((shot) => shot.sectionId === sectionId || shot.actId === sectionId)
    .map((shot) => shot.id));
}

function shotIdsForAsset(runtimeState: ProjectRuntimeState | undefined, assetId: string | undefined) {
  if (!runtimeState || !assetId?.trim()) return [];
  const asset = runtimeState.visualMemory.assets.find((item) => item.id === assetId);
  const explicit = uniqueShotIds(asset?.usedByShotIds || []);
  if (explicit.length) return explicit;
  const normalizedAssetId = assetId.trim().toLowerCase();
  return uniqueShotIds(runtimeState.storyFlow.shots
    .filter((shot) => [
      shot.characterGuidance,
      shot.sceneGuidance,
      shot.propGuidance,
    ].some((values) => (values || []).some((value) => value.toLowerCase().includes(normalizedAssetId))))
    .map((shot) => shot.id));
}

function scopedVideoShotIds(input: {
  runtimeState?: ProjectRuntimeState;
  selectedShotIds?: string[];
  selectedAssetId?: string;
  sectionId?: string;
}) {
  const direct = uniqueShotIds(input.selectedShotIds || []);
  if (direct.length) return { shotIds: direct };
  const assetShotIds = shotIdsForAsset(input.runtimeState, input.selectedAssetId);
  if (assetShotIds.length) return { shotIds: assetShotIds };
  if (input.selectedAssetId) return { shotIds: [], blocker: "这个素材还没有绑定到镜头，不能直接提交视频。" };
  const sectionShotIds = shotIdsForSection(input.runtimeState, input.sectionId);
  if (sectionShotIds.length) return { shotIds: sectionShotIds };
  if (input.sectionId) return { shotIds: [], blocker: "这个段落还没有可提交的镜头。" };
  return { shotIds: [] };
}

function isStoryboardProviderConfigured(statuses: ProviderConfigStatus[]) {
  return statuses.find((status) => status.providerId === STORYBOARD_PROVIDER_ID)?.credential?.keyStatus === "configured";
}

function relayQueueCanResume(relayQueue: ProjectSeedanceSubmitResult["relayQueue"] | undefined) {
  if (!relayQueue) return false;
  if ((relayQueue.resumeCommands || []).length > 0) return true;
  return (relayQueue.items || []).some((item) =>
    Boolean(item.submitId || item.resumeCommand)
    && ["submitted", "generating", "recoverable_queued"].includes(String(item.status || "")));
}

function resultCanResume(result: ProjectSeedanceSubmitResult) {
  return Boolean(result.resumeCommand || result.submitId || relayQueueCanResume(result.relayQueue));
}

function seedanceActionState(result: ProjectSeedanceSubmitResult): SeedanceVideoSubmitActionState {
  const canResume = resultCanResume(result);
  if ((result.outputVideoPath || result.status === "success" || result.uiStatus === "needs_review") && result.relayQueue?.autoSubmitAllowed) {
    return {
      status: "idle",
      message: result.message || "本段视频已生成，下一段可以继续提交。",
      qaFeedback: result.qaFeedback,
    };
  }
  if (result.videoSubmitted || result.status === "submitted" || result.status === "queued" || result.status === "generating" || result.status === "timed_out") {
    return {
      status: "submitted",
      message: result.message || result.relayQueue?.userSummary || "视频已提交，即梦排队中；可以稍后恢复查询。",
      qaFeedback: result.qaFeedback,
      canResume,
    };
  }
  if (result.outputVideoPath || result.status === "success" || result.uiStatus === "needs_review") {
    return {
      status: "needs_review",
      message: result.message || "视频已生成，等待复核。",
      qaFeedback: result.qaFeedback,
      canResume,
    };
  }
  return {
    status: "blocked",
    message: result.qaFeedback?.summary || result.message || "视频提交未完成，可以稍后重试。",
    qaFeedback: result.qaFeedback,
  };
}

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error("视频已经提交检查中，正在刷新项目状态。")), ms);
  });
}

function seedanceActionStateFromRuntime(state: ProjectRealChainUiState): SeedanceVideoSubmitActionState | undefined {
  const relayQueue = state.summary?.relayQueue;
  const canResume = relayQueueCanResume(relayQueue);
  if (relayQueue) {
    if (relayQueue.status === "running") {
      return {
        status: "submitted",
        message: relayQueue.userSummary || "即梦正在处理当前段，回来后会继续下一段。",
        canResume,
      };
    }
    if (relayQueue.autoSubmitAllowed) {
      return {
        status: "idle",
        message: relayQueue.userSummary || "下一段已准备好，可以继续提交。",
        canResume,
      };
    }
    if (relayQueue.status === "complete") {
      return {
        status: "needs_review",
        message: relayQueue.userSummary || "视频队列已处理完，等待复核。",
        canResume,
      };
    }
    if (relayQueue.status === "blocked" || relayQueue.counts.failed > 0) {
      return {
        status: "blocked",
        message: relayQueue.userSummary || "视频队列需要处理后再继续。",
        canResume,
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
    ? { status: "needs_review", message: "视频已生成，等待复核。", canResume }
    : { status: "submitted", message: "视频已提交，即梦排队中；可以稍后恢复查询。", canResume };
}

export function useSeedanceVideoSubmitAction({
  runtimeProjectIdentity,
  runtimeState,
  selectedShotIds = [],
  providerConfigStatuses,
  setProviderConfigStatuses,
  setProjectRealChainState,
  openPreview,
  confirmAction = defaultConfirmAction,
}: UseSeedanceVideoSubmitActionInput) {
  const [actionState, setActionState] = useState<SeedanceVideoSubmitActionState>({ status: "idle" });
  const keyConfigured = useMemo(() => isStoryboardProviderConfigured(providerConfigStatuses), [providerConfigStatuses]);

  const runSeedanceVideoSubmit = useCallback(async (options?: SeedanceVideoSubmitRunOptions) => {
    if (!runtimeProjectIdentity) {
      const nextState: SeedanceVideoSubmitActionState = { status: "blocked", message: "先选择项目。" };
      setActionState(nextState);
      return nextState;
    }

    if (actionState.status === "submitted" && actionState.canResume) {
      setActionState({ ...actionState, status: "running", message: "正在查询 Seedance 结果。" });
      try {
        const resumed = await Promise.race([
          resumeProjectSeedanceVideo(runtimeProjectIdentity, { pollSeconds: 90 }),
          timeoutAfter(SEEDANCE_SUBMIT_UI_TIMEOUT_MS),
        ]);
        const nextState = seedanceActionState(resumed);
        setActionState(nextState);
        const refreshed = await loadProjectRealChainStatus(runtimeProjectIdentity);
        setProjectRealChainState(refreshed);
        if (nextState.status === "submitted" || nextState.status === "needs_review" || nextState.status === "idle") openPreview();
        return nextState;
      } catch (error) {
        const nextState: SeedanceVideoSubmitActionState = {
          status: "blocked",
          message: error instanceof Error ? error.message : "视频查询失败。",
          canResume: true,
        };
        setActionState(nextState);
        return nextState;
      }
    }

    const statuses = await loadProviderConfigStatuses();
    setProviderConfigStatuses(statuses);
    if (!isStoryboardProviderConfigured(statuses)) {
      const nextState: SeedanceVideoSubmitActionState = { status: "blocked", message: "先去设置里完成视频连接。" };
      setActionState(nextState);
      return nextState;
    }

    if (!options?.skipConfirm && !confirmAction("要提交当前故事到 Seedance 2.0 720p 吗？\n\n即梦可能排队很久，提交后可以稍后回来查。")) {
      const nextState: SeedanceVideoSubmitActionState = { status: "blocked", message: "已取消，本次没有提交。" };
      setActionState(nextState);
      return nextState;
    }

    const scopedTarget = options
      ? scopedVideoShotIds({
          runtimeState,
          selectedShotIds: options.selectedShotIds,
          selectedAssetId: options.selectedAssetId,
          sectionId: options.sectionId,
        })
      : scopedVideoShotIds({ runtimeState, selectedShotIds });
    if (scopedTarget.blocker) {
      const nextState: SeedanceVideoSubmitActionState = { status: "blocked", message: scopedTarget.blocker };
      setActionState(nextState);
      return nextState;
    }
    const submitShotIds = scopedTarget.shotIds;
    const confirmedAt = options?.confirmedAt || new Date().toISOString();
    setActionState({ status: "running", message: "正在生成故事板参考并提交 Seedance 2.0 720p。" });
    try {
      const submitted = await Promise.race([
        submitProjectSeedanceVideo(runtimeProjectIdentity, {
          providerId: STORYBOARD_PROVIDER_ID,
          modelVersion: "seedance2.0",
          videoResolution: "720p",
            ratio: "16:9",
            pollSeconds: 90,
            selectedShotIds: submitShotIds.length ? submitShotIds : undefined,
            agentTaskEnvelope: options?.agentToolTrace,
            confirmation: {
            receiptId: options?.confirmationReceiptId || `seedance_video_ui_${Date.now()}`,
            confirmedAt,
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
      return nextState;
    } catch (error) {
      try {
        const refreshed = await loadProjectRealChainStatus(runtimeProjectIdentity);
        setProjectRealChainState(refreshed);
        const recovered = seedanceActionStateFromRuntime(refreshed);
        if (recovered) {
          setActionState(recovered);
          openPreview();
          return recovered;
        }
      } catch {
        // Keep the original submit error visible if recovery also fails.
      }
      const nextState: SeedanceVideoSubmitActionState = {
        status: "blocked",
        message: error instanceof Error ? error.message : "视频提交失败。",
      };
      setActionState(nextState);
      return nextState;
    }
  }, [
    confirmAction,
    openPreview,
    runtimeState,
    runtimeProjectIdentity,
    actionState,
    selectedShotIds,
    setProjectRealChainState,
    setProviderConfigStatuses,
  ]);

  const videoSubmitAction = useMemo<SeedanceVideoSubmitActionView>(() => ({
    keyConfigured: keyConfigured || Boolean(actionState.canResume),
    status: actionState.status,
    message: actionState.message,
    qaFeedback: actionState.qaFeedback,
    canResume: actionState.canResume,
    disabled: actionState.status === "running" || !runtimeProjectIdentity || (actionState.status === "submitted" && !actionState.canResume),
    ready: Boolean(runtimeProjectIdentity),
  }), [actionState.canResume, actionState.message, actionState.qaFeedback, actionState.status, keyConfigured, runtimeProjectIdentity]);

  return {
    videoSubmitAction,
    runSeedanceVideoSubmit,
  };
}
