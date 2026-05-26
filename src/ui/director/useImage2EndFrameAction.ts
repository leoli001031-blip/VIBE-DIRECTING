import { useCallback, useMemo, useState } from "react";
import {
  loadProjectRealChainStatus,
  type ProjectRealChainUiState,
  type ProjectRuntimeIdentity,
} from "../../core/projectCurrentRuntimeClient";
import {
  submitProjectImage2EndFrame,
  type ProjectImage2EndFrameSubmitResult,
} from "../../core/projectImage2Client";
import {
  loadProviderConfigStatuses,
  type ProviderConfigStatus,
} from "../../core/providerCredentialsClient";

const IMAGE2_END_FRAME_PROVIDER_ID = "lanyi-image2";
const IMAGE2_END_FRAME_CONFIRM_PHRASE = "generate-image2-end-frame";

export type Image2EndFrameActionStatus = "idle" | "running" | "blocked" | "needs_review" | "verified";

export type Image2EndFrameActionState = {
  status: Image2EndFrameActionStatus;
  message?: string;
};

export type Image2EndFrameActionView = Image2EndFrameActionState & {
  keyConfigured: boolean;
  disabled: boolean;
};

type UseImage2EndFrameActionInput = {
  runtimeProjectIdentity?: ProjectRuntimeIdentity;
  selectedShotId?: string;
  providerConfigStatuses: ProviderConfigStatus[];
  setProviderConfigStatuses: (statuses: ProviderConfigStatus[]) => void;
  setProjectRealChainState: (state: ProjectRealChainUiState) => void;
  openPreview: () => void;
  confirmAction?: (message: string) => boolean;
};

function defaultConfirmAction(message: string) {
  return typeof window !== "undefined" ? window.confirm(message) : false;
}

function isEndFrameKeyConfigured(statuses: ProviderConfigStatus[]) {
  return statuses.find((status) => status.providerId === IMAGE2_END_FRAME_PROVIDER_ID)?.credential?.keyStatus === "configured";
}

function endFrameActionState(result: ProjectImage2EndFrameSubmitResult): Image2EndFrameActionState {
  if (result.status === "needs_review" || result.uiStatus === "needs_review") {
    return {
      status: "needs_review",
      message: result.message || "特殊尾帧已生成，先放在复核区。",
    };
  }
  if (result.status === "verified" || result.uiStatus === "verified") {
    return {
      status: "verified",
      message: result.message || "特殊尾帧已生成，先放在复核区。",
    };
  }
  return {
    status: "blocked",
    message: result.message || "特殊尾帧生成未完成，可以稍后重试。",
  };
}

export function useImage2EndFrameAction({
  runtimeProjectIdentity,
  selectedShotId,
  providerConfigStatuses,
  setProviderConfigStatuses,
  setProjectRealChainState,
  openPreview,
  confirmAction = defaultConfirmAction,
}: UseImage2EndFrameActionInput) {
  const [actionState, setActionState] = useState<Image2EndFrameActionState>({ status: "idle" });
  const keyConfigured = useMemo(() => isEndFrameKeyConfigured(providerConfigStatuses), [providerConfigStatuses]);

  const runImage2EndFrame = useCallback(async () => {
    if (!runtimeProjectIdentity) {
      setActionState({ status: "blocked", message: "未选择项目/未同步。" });
      return;
    }
    if (!selectedShotId) {
      setActionState({ status: "blocked", message: "请先选择一个镜头。" });
      return;
    }

    const statuses = await loadProviderConfigStatuses();
    setProviderConfigStatuses(statuses);
    if (!isEndFrameKeyConfigured(statuses)) {
      setActionState({ status: "blocked", message: "请先在设置里完成生成能力。" });
      return;
    }

    if (!confirmAction("要生成特殊尾帧吗？\n\n只适合循环、变身或明确首尾控制。生成后先放到复核区。")) {
      setActionState({ status: "blocked", message: "已取消，本次没有提交。" });
      return;
    }

    setActionState({ status: "running", message: "正在生成特殊尾帧；生成后会放到复核区。" });
    try {
      const submitted = await submitProjectImage2EndFrame(runtimeProjectIdentity, {
        selectedShotId,
        selectedShotIds: [selectedShotId],
        providerId: IMAGE2_END_FRAME_PROVIDER_ID,
        confirmation: {
          receiptId: `image2_end_frame_ui_${Date.now()}`,
          confirmedAt: new Date().toISOString(),
          phrase: IMAGE2_END_FRAME_CONFIRM_PHRASE,
          confirmed: true,
        },
      });
      const nextState = endFrameActionState(submitted);
      setActionState(nextState);
      const refreshed = await loadProjectRealChainStatus(runtimeProjectIdentity);
      setProjectRealChainState(refreshed);
      if (nextState.status === "needs_review" || nextState.status === "verified") openPreview();
    } catch (error) {
      setActionState({
        status: "blocked",
        message: error instanceof Error ? error.message : "特殊尾帧生成失败。",
      });
    }
  }, [
    confirmAction,
    openPreview,
    runtimeProjectIdentity,
    selectedShotId,
    setProjectRealChainState,
    setProviderConfigStatuses,
  ]);

  const endFrameAction = useMemo<Image2EndFrameActionView>(() => ({
    keyConfigured,
    status: actionState.status,
    message: actionState.message,
    disabled: actionState.status === "running" || !runtimeProjectIdentity || !keyConfigured,
  }), [actionState.message, actionState.status, keyConfigured, runtimeProjectIdentity]);

  return {
    endFrameAction,
    runImage2EndFrame,
  };
}
