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

const P6_REAL_IMAGE2_PROVIDER_ID = "apikey-fun-gpt55-responses-image";
const P6_REAL_IMAGE2_CREDENTIAL_REF = "secret-store://providers/apikey-fun-gpt55-responses-image/default";
const P6_REAL_IMAGE2_CONFIRM_PHRASE = "submit-p6-image2";

export type P6RealImage2ActionStatus = "idle" | "running" | "blocked" | "needs_review" | "verified";

export type P6RealImage2ActionState = {
  status: P6RealImage2ActionStatus;
  message?: string;
};

export type P6RealImage2ActionResult = P6RealImage2ActionState & {
  ok: boolean;
  providerCalled: boolean;
  outputPath?: string;
  blockers: string[];
};

export type P6RealImage2ActionView = P6RealImage2ActionState & {
  keyConfigured: boolean;
  disabled: boolean;
  reviewableOutput: boolean;
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
    message: submitted.summary?.retryHint || submitted.message || "图片生成未完成，可以稍后重试。",
  };
}

function restoredActionState(oneShotState: ProjectImage2OneShotUiState): P6RealImage2ActionState | undefined {
  if (
    oneShotState.status === "needs_review"
    || oneShotState.status === "verified"
    || oneShotState.status === "missing"
  ) {
    return submittedActionState(oneShotState);
  }
  return undefined;
}

function p6RealImage2ActionResult(
  state: P6RealImage2ActionState,
  oneShotState?: ProjectImage2OneShotUiState,
): P6RealImage2ActionResult {
  const ok = state.status === "needs_review" || state.status === "verified";
  return {
    ...state,
    ok,
    providerCalled: oneShotState?.summary?.providerCalled === true,
    outputPath: ok && oneShotState?.summary?.outputExists
      ? oneShotState.summary.expectedOutputPath
      : undefined,
    blockers: ok ? [] : [state.message || "图片生成未完成。"],
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
      const blocked = { status: "blocked", message: "先选择项目。" } as const;
      setActionState(blocked);
      setOneShotState({ status: "unavailable", message: "先选择项目。" });
      return p6RealImage2ActionResult(blocked);
    }

    const statuses = await loadProviderConfigStatuses();
    setProviderConfigStatuses(statuses);
    if (!isP6RealImage2KeyConfigured(statuses)) {
      const blocked = { status: "blocked", message: "先去设置里连接图片服务。" } as const;
      setActionState(blocked);
      return p6RealImage2ActionResult(blocked);
    }

    if (!confirmAction("要生成 1 张画面小样吗？\n\n会调用图片服务，结果先给你看。")) {
      const blocked = { status: "blocked", message: "已取消，本次没有生成。" } as const;
      setActionState(blocked);
      return p6RealImage2ActionResult(blocked);
    }

    setActionState({ status: "running", message: "正在准备并生成 1 张小样；如果网络中断，可以稍后再次生成。" });
    let nextState = oneShotState;
    try {
      const reusablePreparedState = Boolean(
        nextState.receipt || nextState.summary?.receipt,
      ) && (
        nextState.status === "prepared"
        || nextState.status === "handoff_prepared"
        || nextState.status === "trigger_plan_prepared"
      );
      if (!reusablePreparedState) {
        nextState = await prepareProjectImage2OneShot(runtimeProjectIdentity, selectedShotId);
        setOneShotState(nextState);
      }
      if (nextState.status === "prepared") {
        nextState = await confirmProjectImage2OneShot(runtimeProjectIdentity, nextState.receipt || nextState.summary?.receipt);
        setOneShotState(nextState);
      }
      const receipt = nextState.receipt || nextState.summary?.receipt;
      if (!receipt) {
        const blocked = { status: "blocked", message: nextState.message || "请先准备小样包。" } as const;
        setActionState(blocked);
        return p6RealImage2ActionResult(blocked, nextState);
      }
      if (nextState.status !== "handoff_prepared" && nextState.status !== "trigger_plan_prepared") {
        const blocked = {
          status: "blocked",
          message: nextState.summary?.blockers[0] || nextState.message || "小样包还没有准备完成。",
        } as const;
        setActionState(blocked);
        return p6RealImage2ActionResult(blocked, nextState);
      }
      if (nextState.summary?.submitPermissionReceipt?.status !== "pending_action_time_confirmation") {
        nextState = await prepareProjectImage2OneShotPermissionReceipt(runtimeProjectIdentity, receipt, P6_REAL_IMAGE2_CREDENTIAL_REF);
        setOneShotState(nextState);
      }
      const submitPermissionReceipt = nextState.summary?.submitPermissionReceipt;
      if (submitPermissionReceipt?.status !== "pending_action_time_confirmation") {
        const blocked = { status: "blocked", message: nextState.message || "请先生成许可回执。" } as const;
        setActionState(blocked);
        return p6RealImage2ActionResult(blocked, nextState);
      }
      const actionId = submitPermissionReceipt.actionId || receipt.actionId;
      if (!actionId) {
        const blocked = { status: "blocked", message: "许可回执缺少当前动作标识，请重新准备。" } as const;
        setActionState(blocked);
        return p6RealImage2ActionResult(blocked, nextState);
      }

      const submitted = await submitProjectP6RealImage2OneShot(runtimeProjectIdentity, {
        receipt,
        submitPermissionReceipt,
        providerId: P6_REAL_IMAGE2_PROVIDER_ID,
        confirmation: {
          receiptId: `p6_real_image2_ui_${Date.now()}`,
          actionId,
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
      return p6RealImage2ActionResult(nextActionState, submitted);
    } catch (error) {
      const blocked = {
        status: "blocked",
        message: error instanceof Error ? error.message : "图片生成失败。",
      } as const;
      setActionState(blocked);
      return p6RealImage2ActionResult(blocked, nextState);
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

  const visibleActionState = oneShotState.status === "verified"
    ? submittedActionState(oneShotState)
    : actionState.status === "idle"
    ? restoredActionState(oneShotState) || actionState
    : actionState;
  const reviewableOutput = oneShotState.status === "needs_review"
    && oneShotState.summary?.outputExists === true
    && Boolean(oneShotState.summary.imageUrl && oneShotState.summary.outputSha256);
  const realSampleAction = useMemo<P6RealImage2ActionView>(() => ({
    keyConfigured,
    status: visibleActionState.status,
    message: visibleActionState.message,
    disabled: visibleActionState.status === "running" || !runtimeProjectIdentity,
    reviewableOutput,
  }), [keyConfigured, reviewableOutput, runtimeProjectIdentity, visibleActionState.message, visibleActionState.status]);

  return {
    realSampleAction,
    runP6RealImage2OneShot,
  };
}
