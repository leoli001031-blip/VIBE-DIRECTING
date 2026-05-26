import { useCallback, useMemo, useState } from "react";
import {
  currentProjectBindingIdentity,
  loadCurrentProjectBindingStatus,
  loadProjectRealChainStatus,
  type ProjectRealChainUiState,
  type ProjectRuntimeIdentity,
} from "../../core/projectCurrentRuntimeClient";
import {
  submitProjectImage2AssetGeneration,
  type ProjectImage2AssetGenerationResult,
} from "../../core/projectImage2Client";
import {
  loadProviderConfigStatuses,
  type ProviderConfigStatus,
} from "../../core/providerCredentialsClient";

const IMAGE2_ASSET_PROVIDER_ID = "lanyi-image2";
const APIKEY_FUN_ASSET_PROVIDER_ID = "apikey-fun-gpt55-responses-image";
const IMAGE2_ASSET_CONFIRM_PHRASE = "generate-image2-assets";

export type Image2AssetGenerationActionStatus = "idle" | "running" | "blocked" | "needs_review" | "verified";

export type Image2AssetGenerationActionState = {
  status: Image2AssetGenerationActionStatus;
  message?: string;
};

export type Image2AssetGenerationActionView = Image2AssetGenerationActionState & {
  keyConfigured: boolean;
  disabled: boolean;
};

type UseImage2AssetGenerationActionInput = {
  runtimeProjectIdentity?: ProjectRuntimeIdentity;
  selectedShotId?: string;
  selectedShotIds?: string[];
  providerConfigStatuses: ProviderConfigStatus[];
  setProviderConfigStatuses: (statuses: ProviderConfigStatus[]) => void;
  setProjectRealChainState: (state: ProjectRealChainUiState) => void;
  confirmAction?: (message: string) => boolean;
};

function defaultConfirmAction(message: string) {
  return typeof window !== "undefined" ? window.confirm(message) : false;
}

function isAssetKeyConfigured(statuses: ProviderConfigStatus[]) {
  return Boolean(preferredAssetProviderId(statuses));
}

function preferredAssetProviderId(statuses: ProviderConfigStatus[]) {
  const apikeyFunConfigured = statuses.find((status) => status.providerId === APIKEY_FUN_ASSET_PROVIDER_ID)?.credential?.keyStatus === "configured";
  if (apikeyFunConfigured) return APIKEY_FUN_ASSET_PROVIDER_ID;
  const lanyiConfigured = statuses.find((status) => status.providerId === IMAGE2_ASSET_PROVIDER_ID)?.credential?.keyStatus === "configured";
  if (lanyiConfigured) return IMAGE2_ASSET_PROVIDER_ID;
  return undefined;
}

function assetProviderLabel(providerId: string | undefined) {
  if (providerId === APIKEY_FUN_ASSET_PROVIDER_ID) return "GPT-5.5";
  if (providerId === IMAGE2_ASSET_PROVIDER_ID) return "Image2";
  return "生成服务";
}

function assetActionState(result: ProjectImage2AssetGenerationResult): Image2AssetGenerationActionState {
  if (result.status === "needs_review" || result.uiStatus === "needs_review") {
    return {
      status: "needs_review",
      message: result.message || "参考已生成，先放在复核区。",
    };
  }
  if (result.status === "verified" || result.uiStatus === "verified") {
    return {
      status: "verified",
      message: result.message || "参考已生成，先放在复核区。",
    };
  }
  return {
    status: "blocked",
    message: result.message || "参考生成未完成，可以稍后重试。",
  };
}

export function useImage2AssetGenerationAction({
  runtimeProjectIdentity,
  selectedShotId,
  selectedShotIds,
  providerConfigStatuses,
  setProviderConfigStatuses,
  setProjectRealChainState,
  confirmAction = defaultConfirmAction,
}: UseImage2AssetGenerationActionInput) {
  const [actionState, setActionState] = useState<Image2AssetGenerationActionState>({ status: "idle" });
  const keyConfigured = useMemo(
    () => providerConfigStatuses.length === 0 || isAssetKeyConfigured(providerConfigStatuses),
    [providerConfigStatuses],
  );

  const runImage2AssetGeneration = useCallback(async () => {
    const liveRuntimeProjectIdentity = runtimeProjectIdentity
      || currentProjectBindingIdentity(await loadCurrentProjectBindingStatus());
    if (!liveRuntimeProjectIdentity) {
      setActionState({ status: "blocked", message: "未选择项目/未同步。" });
      return;
    }
    const statuses = await loadProviderConfigStatuses();
    setProviderConfigStatuses(statuses);
    const providerId = preferredAssetProviderId(statuses);
    if (!providerId) {
      setActionState({ status: "blocked", message: "请先在设置里完成生成能力。" });
      return;
    }

    const scopedShotIds = undefined;
    const scopeCopy = "整个项目";
    if (!confirmAction(`要补齐${scopeCopy}的参考素材吗？\n\n我会先准备角色、场景和关键道具；车灯、手部、雨雾这类细小画面会写进对应说明里，不会单独出图。生成后先放到复核区。`)) {
      setActionState({ status: "blocked", message: "已取消，本次没有提交。" });
      return;
    }

    setActionState({ status: "running", message: `正在用 ${assetProviderLabel(providerId)} 准备项目参考；生成后会放到复核区。` });
    try {
      const submitted = await submitProjectImage2AssetGeneration(liveRuntimeProjectIdentity, {
        scope: "project",
        selectedShotId: undefined,
        selectedShotIds: scopedShotIds,
        providerId,
        assetTypes: ["character", "scene", "prop"],
        confirmation: {
          receiptId: `image2_asset_ui_${Date.now()}`,
          confirmedAt: new Date().toISOString(),
          phrase: IMAGE2_ASSET_CONFIRM_PHRASE,
          confirmed: true,
        },
      });
      setActionState(assetActionState(submitted));
      const refreshed = await loadProjectRealChainStatus(liveRuntimeProjectIdentity);
      setProjectRealChainState(refreshed);
    } catch (error) {
      setActionState({
        status: "blocked",
        message: error instanceof Error ? error.message : "参考生成失败。",
      });
    }
  }, [
    confirmAction,
    runtimeProjectIdentity,
    selectedShotId,
    selectedShotIds,
    setProjectRealChainState,
    setProviderConfigStatuses,
  ]);

  const assetGenerationAction = useMemo<Image2AssetGenerationActionView>(() => ({
    keyConfigured,
    status: actionState.status,
    message: actionState.message,
    disabled: actionState.status === "running",
  }), [actionState.message, actionState.status, keyConfigured]);

  return {
    assetGenerationAction,
    runImage2AssetGeneration,
  };
}
