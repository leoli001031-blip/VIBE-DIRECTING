import { useCallback, useMemo, useState } from "react";
import {
  loadProjectRealChainStatus,
  type ProjectRealChainUiState,
  type ProjectRuntimeIdentity,
} from "../../core/projectCurrentRuntimeClient";
import {
  confirmProjectImage2OneShot,
  prepareProjectImage2OneShot,
  prepareProjectImage2OneShotPermissionReceipt,
  submitProjectP6RealImage2OneShot,
  type ProjectImage2OneShotUiState,
} from "../../core/projectImage2Client";
import {
  loadProviderConfigStatuses,
  type ProviderConfigStatus,
} from "../../core/providerCredentialsClient";

const P6_REAL_IMAGE2_PROVIDER_ID = "lanyi-image2";
const P6_REAL_IMAGE2_CREDENTIAL_REF = "secret-store://providers/lanyi-image2/default";
const P6_REAL_IMAGE2_CONFIRM_PHRASE = "submit-p6-image2";

export type P6RealImage2ActionStatus = "idle" | "running" | "blocked" | "needs_review" | "verified";

export type P6RealImage2ActionState = {
  status: P6RealImage2ActionStatus;
  message?: string;
};

export type P6RealImage2ActionView = P6RealImage2ActionState & {
  keyConfigured: boolean;
  disabled: boolean;
};

type UseP6RealImage2ActionInput = {
  runtimeProjectIdentity?: ProjectRuntimeIdentity;
  selectedShotId?: string;
  oneShotState: ProjectImage2OneShotUiState;
  providerConfigStatuses: ProviderConfigStatus[];
  setProviderConfigStatuses: (statuses: ProviderConfigStatus[]) => void;
  setOneShotState: (state: ProjectImage2OneShotUiState) => void;
  setProjectRealChainState: (state: ProjectRealChainUiState) => void;
  openPreview: () => void;
  confirmAction?: (message: string) => boolean;
};

export function isP6RealImage2KeyConfigured(statuses: ProviderConfigStatus[]) {
  return statuses.find((status) => status.providerId === P6_REAL_IMAGE2_PROVIDER_ID)?.credential?.keyStatus === "configured";
}

function defaultConfirmAction(message: string) {
  return typeof window !== "undefined" ? window.confirm(message) : false;
}

function submittedActionState(submitted: ProjectImage2OneShotUiState): P6RealImage2ActionState {
  if (submitted.status === "needs_review") {
    return {
      status: "needs_review",
      message: submitted.message || "画面已生成，先放在复核区。",
    };
  }
  if (submitted.status === "verified") {
    return {
      status: "verified",
      message: submitted.message || "画面已生成，先放在复核区。",
    };
  }
  if (submitted.status === "missing") {
    return {
      status: "blocked",
      message: submitted.summary?.retryHint || submitted.message || "这次没有拿到结果图，可以再次生成重试。",
    };
  }
  return {
    status: "blocked",
    message: submitted.summary?.retryHint || submitted.message || "真实出图提交未完成，可以稍后重试。",
  };
}

export function useP6RealImage2Action({
  runtimeProjectIdentity,
  selectedShotId,
  oneShotState,
  providerConfigStatuses,
  setProviderConfigStatuses,
  setOneShotState,
  setProjectRealChainState,
  openPreview,
  confirmAction = defaultConfirmAction,
}: UseP6RealImage2ActionInput) {
  const [actionState, setActionState] = useState<P6RealImage2ActionState>({ status: "idle" });

  const keyConfigured = useMemo(() => isP6RealImage2KeyConfigured(providerConfigStatuses), [providerConfigStatuses]);

  const runP6RealImage2OneShot = useCallback(async () => {
    if (!runtimeProjectIdentity) {
      setActionState({ status: "blocked", message: "先选择项目。" });
      setOneShotState({ status: "unavailable", message: "先选择项目。" });
      return;
    }

    const statuses = await loadProviderConfigStatuses();
    setProviderConfigStatuses(statuses);
    if (!isP6RealImage2KeyConfigured(statuses)) {
      setActionState({ status: "blocked", message: "先去设置里填 Key。" });
      return;
    }

    if (!confirmAction("要生成 1 张画面小样吗？\n\n会调用真实生图，结果先给你看。")) {
      setActionState({ status: "blocked", message: "已取消，本次没有提交。" });
      return;
    }

    setActionState({ status: "running", message: "正在准备并提交 1 张真实小样；如果网络中断，可以稍后再次生成。" });
    let nextState = oneShotState;
    try {
      if (!(nextState.receipt || nextState.summary?.receipt)) {
        nextState = await prepareProjectImage2OneShot(runtimeProjectIdentity, selectedShotId);
        setOneShotState(nextState);
      }
      if (nextState.status === "prepared") {
        nextState = await confirmProjectImage2OneShot(runtimeProjectIdentity, nextState.receipt || nextState.summary?.receipt);
        setOneShotState(nextState);
      }
      const receipt = nextState.receipt || nextState.summary?.receipt;
      if (!receipt) {
        setActionState({ status: "blocked", message: "请先准备小样包。" });
        return;
      }
      if (nextState.summary?.submitPermissionReceipt?.status !== "pending_action_time_confirmation") {
        nextState = await prepareProjectImage2OneShotPermissionReceipt(runtimeProjectIdentity, receipt, P6_REAL_IMAGE2_CREDENTIAL_REF);
        setOneShotState(nextState);
      }
      const submitPermissionReceipt = nextState.summary?.submitPermissionReceipt;
      if (submitPermissionReceipt?.status !== "pending_action_time_confirmation") {
        setActionState({ status: "blocked", message: nextState.message || "请先生成许可回执。" });
        return;
      }

      const submitted = await submitProjectP6RealImage2OneShot(runtimeProjectIdentity, {
        receipt,
        submitPermissionReceipt,
        providerId: P6_REAL_IMAGE2_PROVIDER_ID,
        confirmation: {
          receiptId: `p6_real_image2_ui_${Date.now()}`,
          confirmedAt: new Date().toISOString(),
          phrase: P6_REAL_IMAGE2_CONFIRM_PHRASE,
          confirmed: true,
        },
      });
      setOneShotState(submitted);
      const nextActionState = submittedActionState(submitted);
      setActionState(nextActionState);
      const refreshed = await loadProjectRealChainStatus(runtimeProjectIdentity);
      setProjectRealChainState(refreshed);
      if (nextActionState.status === "needs_review" || nextActionState.status === "verified") openPreview();
    } catch (error) {
      setActionState({
        status: "blocked",
        message: error instanceof Error ? error.message : "真实出图提交失败。",
      });
    }
  }, [
    confirmAction,
    oneShotState,
    openPreview,
    runtimeProjectIdentity,
    selectedShotId,
    setOneShotState,
    setProjectRealChainState,
    setProviderConfigStatuses,
  ]);

  const realSampleAction = useMemo<P6RealImage2ActionView>(() => ({
    keyConfigured,
    status: actionState.status,
    message: actionState.message,
    disabled: actionState.status === "running" || !runtimeProjectIdentity,
  }), [actionState.message, actionState.status, keyConfigured, runtimeProjectIdentity]);

  return {
    realSampleAction,
    runP6RealImage2OneShot,
  };
}
