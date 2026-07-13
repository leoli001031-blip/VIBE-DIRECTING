import { useCallback, useMemo, useState } from "react";
import {
  loadProjectRealChainStatus,
  type ProjectRealChainPreviewItem,
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
import { appendVideoBlockerRecoveryAdvice } from "../../core/videoBlockerRecovery";
import {
  agentVideoSubmitContractAllowsVideo,
  type AgentVideoSubmitContract,
} from "./agentPanelProjection";
import { JIMENG_CLI_DEFAULT_MODEL_VERSION } from "../../core/jimengVideoCli";

const STORYBOARD_PROVIDER_ID = "apikey-fun-gpt55-responses-image";
const SEEDANCE_SUBMIT_CONFIRM_PHRASE = "submit-seedance-video";
const SEEDANCE_SUBMIT_UI_TIMEOUT_MS = 300_000;
const SEEDANCE_TEST_MODEL_LABEL = "Seedance 2.0 720p";

function creatorFacingVideoMessage(value: string | undefined, fallback: string) {
  return (value || fallback)
    .replace(/等待回流/g, "等待结果")
    .replace(/回流结果/g, "视频结果")
    .replace(/视频已回流/g, "视频已返回")
    .replace(/回来后/g, "结果出来后");
}

function isVideoMediaPath(value: unknown) {
  return typeof value === "string" && /\.(?:mp4|mov|m4v|webm)(?:\?|$)/i.test(value);
}

function previewItemHasVideoEvidence(item: ProjectRealChainPreviewItem) {
  return Boolean(
    item.videoStatus
    || item.externalTaskId
    || item.submitId
    || item.submit_id
    || item.queueInfo
    || item.queue_info
    || item.outputVideoPath
    || item.localMediaPaths?.some(isVideoMediaPath)
    || String(item.mediaType || "").toLowerCase().includes("video")
    || isVideoMediaPath(item.mediaPath)
  );
}

export type SeedanceVideoSubmitActionStatus = "idle" | "running" | "blocked" | "submitted" | "needs_review";

export type SeedanceVideoSubmitActionState = {
  status: SeedanceVideoSubmitActionStatus;
  message?: string;
  qaFeedback?: DirectorQaUserFeedback;
  canResume?: boolean;
  suggestedActionLabel?: string;
  recoveryTargetShotIds?: string[];
};

export type SeedanceVideoSubmitActionView = SeedanceVideoSubmitActionState & {
  keyConfigured: boolean;
  disabled: boolean;
  ready: boolean;
};

type UseSeedanceVideoSubmitActionInput = {
  runtimeProjectIdentity?: ProjectRuntimeIdentity;
  runtimeState?: ProjectRuntimeState;
  realChainState?: ProjectRealChainUiState;
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
  videoPermissionContract?: AgentVideoSubmitContract;
  agentToolTrace?: DirectorAgentToolTrace;
  signal?: AbortSignal;
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
  if (input.selectedAssetId) return { shotIds: [], blocker: "这个素材还没有绑定到镜头，不能直接发送视频。" };
  const sectionShotIds = shotIdsForSection(input.runtimeState, input.sectionId);
  if (sectionShotIds.length) return { shotIds: sectionShotIds };
  if (input.sectionId) return { shotIds: [], blocker: "这个段落还没有可发送的镜头。" };
  return { shotIds: [] };
}

function isStoryboardProviderConfigured(statuses: ProviderConfigStatus[]) {
  return statuses.find((status) => status.providerId === STORYBOARD_PROVIDER_ID)?.credential?.keyStatus === "configured";
}

function relayQueueCanResume(relayQueue: ProjectSeedanceSubmitResult["relayQueue"] | undefined) {
  if (!relayQueue) return false;
  const items = relayQueue.items || [];
  if (items.length) {
    return items.some((item) =>
      Boolean(item.externalTaskId || item.submitId || item.resumeCommand)
      && ["submitting", "submitted", "queued", "running", "generating", "polling", "recoverable_queued"].includes(String(item.status || "")));
  }
  return (relayQueue.resumeCommands || []).length > 0;
}

function resultCanResume(result: ProjectSeedanceSubmitResult) {
  return Boolean(result.externalTaskId || result.resumeCommand || result.submitId || relayQueueCanResume(result.relayQueue));
}

function seedanceActionState(result: ProjectSeedanceSubmitResult): SeedanceVideoSubmitActionState {
  const canResume = resultCanResume(result);
  if (result.status === "failed" || result.uiStatus === "failed") {
    if (result.relayQueue?.autoSubmitAllowed) {
      return {
        status: "idle",
        message: result.message || "有一段视频生成失败；继续会发送下一段，失败段之后可单独补。",
        qaFeedback: result.qaFeedback,
        canResume: false,
        suggestedActionLabel: "继续下一段",
      };
    }
    return {
      status: "blocked",
      message: result.message || "有一段视频生成失败，请先重试或跳过后再继续。",
      qaFeedback: result.qaFeedback,
      canResume: false,
    };
  }
  if ((result.outputVideoPath || result.status === "success" || result.uiStatus === "needs_review") && result.relayQueue?.autoSubmitAllowed) {
    return {
      status: "idle",
      message: result.message || "本段视频已生成，下一段可以继续发送。",
      qaFeedback: result.qaFeedback,
    };
  }
  if (
    result.videoSubmitted
    || result.status === "submitting"
    || result.status === "submitted"
    || result.status === "queued"
    || result.status === "running"
    || result.status === "generating"
    || result.status === "polling"
    || result.status === "timed_out"
  ) {
    return {
      status: "submitted",
      message: creatorFacingVideoMessage(result.message || result.relayQueue?.userSummary, `${SEEDANCE_TEST_MODEL_LABEL} 已提交，后台等待；可以稍后查询结果。`),
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
    message: result.qaFeedback?.summary || result.message || "视频发送未完成，可以稍后重试。",
    qaFeedback: result.qaFeedback,
  };
}

function videoRequestSignal(parentSignal?: AbortSignal) {
  if (parentSignal) return { signal: parentSignal, clear: () => undefined };
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), SEEDANCE_SUBMIT_UI_TIMEOUT_MS);
  return { signal: controller.signal, clear: () => globalThis.clearTimeout(timeout) };
}

function realChainStillNeedsReview(state: ProjectRealChainUiState) {
  const summary = state.summary as (ProjectRealChainUiState["summary"] & {
    needsReviewCount?: number;
    reviewShotIds?: unknown[];
    needsReviewShotIds?: unknown[];
    reviewOverlayShots?: unknown[];
    previewItems?: Array<Record<string, unknown>>;
  }) | undefined;
  if (!summary) return true;
  if (typeof summary.needsReviewCount === "number") return summary.needsReviewCount > 0;
  if (Array.isArray(summary.reviewShotIds) && summary.reviewShotIds.length) return true;
  if (Array.isArray(summary.needsReviewShotIds) && summary.needsReviewShotIds.length) return true;
  if (Array.isArray(summary.reviewOverlayShots) && summary.reviewOverlayShots.length) return true;
  if (Array.isArray(summary.previewItems) && summary.previewItems.length) {
    return summary.previewItems.some((item) => {
      const statusText = `${item.status || ""} ${item.previewStatus || ""} ${item.productionQaStatus || ""}`.toLowerCase();
      return item.reviewRequired === true
        || item.reviewOverlay === true
        || statusText.includes("needs_review")
        || statusText.includes("returned_with_review_overlay");
    });
  }
  return /needs_review|returned_with_review_overlay/i.test(`${summary.uiStatus || ""} ${summary.previewStatus || ""} ${summary.productionStatus || ""}`);
}

function seedanceActionStateFromRuntime(state: ProjectRealChainUiState): SeedanceVideoSubmitActionState | undefined {
  const relayQueue = state.summary?.relayQueue
    || (state as ProjectRealChainUiState & { relayQueue?: ProjectSeedanceSubmitResult["relayQueue"] }).relayQueue;
  const canResume = relayQueueCanResume(relayQueue);
  if (relayQueue) {
    const failedCount = relayQueue.counts?.failed || 0;
    if (relayQueue.status === "running") {
      return {
        status: "submitted",
        message: failedCount > 0
          ? `${failedCount} 段失败；当前段已发送，等结果出来后再处理。`
          : creatorFacingVideoMessage(relayQueue.userSummary, "即梦正在处理当前段，结果出来后会继续下一段。"),
        canResume,
      };
    }
    if (failedCount > 0) {
      if (relayQueue.autoSubmitAllowed) {
        return {
          status: "idle",
        message: `${failedCount} 段视频生成失败；继续会发送下一段，失败段之后可单独补。`,
          canResume: false,
          suggestedActionLabel: "继续下一段",
        };
      }
      return {
        status: "blocked",
        message: `${failedCount} 段视频生成失败，请先重试或跳过后再继续。`,
        canResume: false,
      };
    }
    if (relayQueue.autoSubmitAllowed) {
      return {
        status: "idle",
        message: creatorFacingVideoMessage(relayQueue.userSummary, "下一段已准备好，可以继续发送。"),
        canResume,
      };
    }
    if (relayQueue.status === "complete") {
      if (!realChainStillNeedsReview(state)) {
        return {
          status: "idle",
          message: "视频已通过，可以导出。",
          canResume: false,
          suggestedActionLabel: "查看交付",
        };
      }
      return {
        status: "needs_review",
        message: creatorFacingVideoMessage(relayQueue.userSummary, "视频队列已处理完，等待复核。"),
        canResume,
      };
    }
    if (relayQueue.status === "blocked" || failedCount > 0) {
      const blockedItem = (relayQueue.items || []).find((item) => {
        const blockers = (item as { blockers?: unknown }).blockers;
        return item.status === "blocked" || (Array.isArray(blockers) && blockers.length);
      });
      const blockedItemShotIds = Array.isArray((blockedItem as { shotIds?: unknown })?.shotIds)
        ? (blockedItem as { shotIds?: string[] }).shotIds || []
        : [];
      const recoveryTargetShotIds = uniqueShotIds([
        ...blockedItemShotIds,
        blockedItem?.shotId || "",
      ]);
      return {
        status: "blocked",
        message: appendVideoBlockerRecoveryAdvice(creatorFacingVideoMessage(relayQueue.userSummary, "视频队列需要处理后再继续。")),
        canResume,
        recoveryTargetShotIds,
      };
    }
  }
  const items = (state.summary?.previewItems || []).filter(previewItemHasVideoEvidence);
  const hasSubmittedVideo = items.some((item) => {
    const statusText = `${item.status || ""} ${item.previewStatus || ""} ${item.videoStatus || ""}`;
    return Boolean(item.externalTaskId || item.submitId || item.outputVideoPath || item.mediaPath)
      || /submitting|queued|submitted|running|generating|polling|success|returned|review/i.test(statusText);
  });
  if (!hasSubmittedVideo) return undefined;
  const hasReturnedVideo = items.some((item) => {
    const statusText = `${item.status || ""} ${item.previewStatus || ""} ${item.videoStatus || ""}`;
    return Boolean(item.outputVideoPath || item.mediaPath) || /success|returned|review/i.test(statusText);
  });
  return hasReturnedVideo
    ? { status: "needs_review", message: "视频已生成，等待复核。", canResume }
    : { status: "submitted", message: `${SEEDANCE_TEST_MODEL_LABEL} 已提交，后台等待；可以稍后查询结果。`, canResume };
}

export function useSeedanceVideoSubmitAction({
  runtimeProjectIdentity,
  runtimeState,
  realChainState,
  selectedShotIds = [],
  providerConfigStatuses,
  setProviderConfigStatuses,
  setProjectRealChainState,
  openPreview,
  confirmAction = defaultConfirmAction,
}: UseSeedanceVideoSubmitActionInput) {
  const [actionState, setActionState] = useState<SeedanceVideoSubmitActionState>({ status: "idle" });
  const keyConfigured = useMemo(() => isStoryboardProviderConfigured(providerConfigStatuses), [providerConfigStatuses]);
  const runtimeActionState = useMemo(
    () => realChainState ? seedanceActionStateFromRuntime(realChainState) : undefined,
    [realChainState],
  );
  const effectiveActionState = useMemo(() => {
    if (actionState.status === "running" || actionState.status === "blocked" || actionState.canResume) return actionState;
    return runtimeActionState || actionState;
  }, [actionState, runtimeActionState]);

  const runSeedanceVideoSubmit = useCallback(async (options?: SeedanceVideoSubmitRunOptions) => {
    if (!runtimeProjectIdentity) {
      const nextState: SeedanceVideoSubmitActionState = { status: "blocked", message: "先选择项目。" };
      setActionState(nextState);
      return nextState;
    }

    if (effectiveActionState.status === "submitted" && effectiveActionState.canResume) {
      setActionState({ ...effectiveActionState, status: "running", message: "正在查询当前 Seedance 任务，不会重复提交。" });
      const request = videoRequestSignal(options?.signal);
      try {
        const resumed = await resumeProjectSeedanceVideo(runtimeProjectIdentity, { pollSeconds: 90 }, request.signal);
        const nextState = seedanceActionState(resumed);
        setActionState(nextState);
        const refreshed = await loadProjectRealChainStatus(runtimeProjectIdentity);
        setProjectRealChainState(refreshed);
        if (nextState.status === "submitted" || nextState.status === "needs_review" || nextState.status === "idle") openPreview();
        return { ...resumed, ...nextState };
      } catch (error) {
        const nextState: SeedanceVideoSubmitActionState = {
          status: "blocked",
          message: error instanceof Error ? error.message : "视频查询失败。",
          canResume: true,
        };
        setActionState(nextState);
        return nextState;
      } finally {
        request.clear();
      }
    }

    if (options?.videoPermissionContract && !agentVideoSubmitContractAllowsVideo(options.videoPermissionContract)) {
      const nextState: SeedanceVideoSubmitActionState = {
        status: "blocked",
        message: options.videoPermissionContract.mode === "plan_only"
          ? "先整理，本轮不发送视频。"
          : "当前先做参考，视频等你确认。",
      };
      setActionState(nextState);
      return nextState;
    }

    const statuses = await loadProviderConfigStatuses();
    setProviderConfigStatuses(statuses);
    if (!isStoryboardProviderConfigured(statuses)) {
      const nextState: SeedanceVideoSubmitActionState = { status: "blocked", message: "先去设置里完成视频连接。" };
      setActionState(nextState);
      return nextState;
    }

    if (!options?.skipConfirm && !confirmAction(`要提交 1 条代表性视频到 ${SEEDANCE_TEST_MODEL_LABEL} 吗？\n\n本轮不会批量提交；拿到提交号后就进入后台等待，可以稍后查询结果。`)) {
      const nextState: SeedanceVideoSubmitActionState = { status: "idle", message: "已取消，本次没有发送；需要时可以重新确认。" };
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
    setActionState({ status: "running", message: `正在准备 1 条代表性视频，并发送到 ${SEEDANCE_TEST_MODEL_LABEL}。` });
    const request = videoRequestSignal(options?.signal);
    try {
      const submitted = await submitProjectSeedanceVideo(runtimeProjectIdentity, {
          providerId: STORYBOARD_PROVIDER_ID,
          modelVersion: JIMENG_CLI_DEFAULT_MODEL_VERSION,
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
        }, request.signal);
      const nextState = seedanceActionState(submitted);
      setActionState(nextState);
      const refreshed = await loadProjectRealChainStatus(runtimeProjectIdentity);
      setProjectRealChainState(refreshed);
      if (nextState.status === "submitted" || nextState.status === "needs_review") openPreview();
      return { ...submitted, ...nextState };
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
        message: error instanceof Error ? error.message : "视频发送失败。",
      };
      setActionState(nextState);
      return nextState;
    } finally {
      request.clear();
    }
  }, [
    confirmAction,
    openPreview,
    runtimeState,
    runtimeProjectIdentity,
    effectiveActionState,
    selectedShotIds,
    setProjectRealChainState,
    setProviderConfigStatuses,
  ]);

  const videoSubmitAction = useMemo<SeedanceVideoSubmitActionView>(() => ({
    keyConfigured: keyConfigured || Boolean(effectiveActionState.canResume),
    status: effectiveActionState.status,
    message: effectiveActionState.message,
    qaFeedback: effectiveActionState.qaFeedback,
    canResume: effectiveActionState.canResume,
    suggestedActionLabel: effectiveActionState.suggestedActionLabel,
    recoveryTargetShotIds: effectiveActionState.recoveryTargetShotIds,
    disabled: effectiveActionState.status === "running" || !runtimeProjectIdentity || (effectiveActionState.status === "submitted" && !effectiveActionState.canResume),
    ready: Boolean(runtimeProjectIdentity),
  }), [effectiveActionState.canResume, effectiveActionState.message, effectiveActionState.qaFeedback, effectiveActionState.recoveryTargetShotIds, effectiveActionState.status, effectiveActionState.suggestedActionLabel, keyConfigured, runtimeProjectIdentity]);

  return {
    videoSubmitAction,
    runSeedanceVideoSubmit,
  };
}
