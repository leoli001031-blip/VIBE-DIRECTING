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
import type { ProjectRuntimeState } from "../../core/projectState";
import type { DirectorAgentToolTrace } from "../../core/directorAgentToolTrace";

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
  runtimeState?: ProjectRuntimeState;
  selectedShotId?: string;
  selectedShotIds?: string[];
  providerConfigStatuses: ProviderConfigStatus[];
  setProviderConfigStatuses: (statuses: ProviderConfigStatus[]) => void;
  setProjectRealChainState: (state: ProjectRealChainUiState) => void;
  confirmAction?: (message: string) => boolean;
};

export type Image2AssetGenerationRunOptions = {
  scope?: "project" | "selected_shots";
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

function isAssetKeyConfigured(statuses: ProviderConfigStatus[]) {
  return Boolean(preferredAssetProviderId(statuses));
}

function preferredAssetProviderId(statuses: ProviderConfigStatus[]) {
  const apikeyFunConfigured = statuses.find((status) => status.providerId === APIKEY_FUN_ASSET_PROVIDER_ID)?.credential?.keyStatus === "configured";
  if (apikeyFunConfigured) return APIKEY_FUN_ASSET_PROVIDER_ID;
  return undefined;
}

function assetProviderLabel(providerId: string | undefined) {
  if (providerId === APIKEY_FUN_ASSET_PROVIDER_ID) return "Image2";
  return "生成服务";
}

function referenceTypeLabel(type: string) {
  if (type === "character") return "角色";
  if (type === "scene") return "场景";
  if (type === "prop") return "道具";
  if (type === "storyboard") return "故事板";
  if (type === "style") return "风格";
  return type || "参考";
}

function missingReferenceTypeSummary(runtimeState: ProjectRuntimeState | undefined) {
  const byType = runtimeState?.visualMemory.summary.byType || [];
  const missingTypes = byType
    .filter((item) => item.missing > 0)
    .map((item) => referenceTypeLabel(item.type));
  return Array.from(new Set(missingTypes)).slice(0, 4).join("、");
}

function assetGenerationProgressMessage(input: {
  providerId: string | undefined;
  runtimeState?: ProjectRuntimeState;
  targetLabel: string;
}) {
  const missingCount = input.runtimeState?.visualMemory.summary.missing || 0;
  const missingTypes = missingReferenceTypeSummary(input.runtimeState);
  const scope = input.targetLabel === "整个项目" ? "整个项目" : input.targetLabel;
  const missingCopy = missingCount > 0
    ? `补 ${missingCount} 个参考${missingTypes ? `：${missingTypes}` : ""}`
    : "准备角色、场景、关键道具和故事板";
  return `正在生成参考：${assetProviderLabel(input.providerId)} 正在为${scope}${missingCopy}。完成后去参考页复核；不用重复点击。`;
}

function assetActionState(result: ProjectImage2AssetGenerationResult): Image2AssetGenerationActionState {
  if (result.status === "needs_review" || result.uiStatus === "needs_review") {
    return {
      status: "needs_review",
      message: result.message || "参考已生成，去参考页看一眼，通过后再锁定。",
    };
  }
  if (result.status === "verified" || result.uiStatus === "verified") {
    return {
      status: "verified",
      message: result.message || "参考已生成，可以继续做视频。",
    };
  }
  return {
    status: "blocked",
    message: result.message || "参考生成没有完成。已生成的内容会保留，可以稍后重试。",
  };
}

function friendlyAssetGenerationError(error: unknown) {
  const raw = error instanceof Error ? error.message : "";
  if (/key|api|token|credential|unauthor/i.test(raw)) return "先去设置里连接图片服务，然后再生成参考。";
  if (/timeout|timed out|network|fetch|socket|ECONN|ENOTFOUND|ETIMEDOUT/i.test(raw)) {
    return "参考生成暂时中断。已生成的内容会保留，可以稍后重试。";
  }
  if (/未选择项目|未同步|连接项目失败|项目文件已打开|请选择|project/i.test(raw)) {
    return "先打开或新建本地项目，再生成参考。";
  }
  return raw || "参考生成失败，可以稍后重试。";
}

function uniqueShotIds(ids: Array<string | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    const normalized = id?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function assetGenerationTarget(selectedShotId?: string, selectedShotIds?: string[]) {
  const shotIds = uniqueShotIds([...(selectedShotIds || []), selectedShotId]);
  if (shotIds.length === 0) {
    return {
      scope: "project" as const,
      selectedShotId: undefined,
      selectedShotIds: undefined,
      label: "整个项目",
    };
  }
  if (shotIds.length === 1) {
    return {
      scope: "selected_shots" as const,
      selectedShotId: shotIds[0],
      selectedShotIds: shotIds,
      label: "当前镜头",
    };
  }
  return {
    scope: "selected_shots" as const,
    selectedShotId: shotIds[0],
    selectedShotIds: shotIds,
    label: `${shotIds.length} 个镜头`,
  };
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

function scopedAssetGenerationTarget(input: {
  runtimeState?: ProjectRuntimeState;
  scope?: "project" | "selected_shots";
  selectedShotId?: string;
  selectedShotIds?: string[];
  selectedAssetId?: string;
  sectionId?: string;
}) {
  if (input.scope === "project") return assetGenerationTarget(undefined, undefined);
  const direct = uniqueShotIds([...(input.selectedShotIds || []), input.selectedShotId]);
  if (direct.length) return assetGenerationTarget(undefined, direct);
  const assetShotIds = shotIdsForAsset(input.runtimeState, input.selectedAssetId);
  if (assetShotIds.length) {
    return {
      ...assetGenerationTarget(undefined, assetShotIds),
      label: assetShotIds.length === 1 ? "当前素材相关镜头" : `当前素材相关 ${assetShotIds.length} 个镜头`,
    };
  }
  if (input.selectedAssetId) {
    return {
      scope: "selected_shots" as const,
      selectedShotId: undefined,
      selectedShotIds: [],
      label: "当前素材",
      blocker: "这个素材还没有绑定到镜头，先说明它用在哪一段。",
    };
  }
  const sectionShotIds = shotIdsForSection(input.runtimeState, input.sectionId);
  if (sectionShotIds.length) {
    return {
      ...assetGenerationTarget(undefined, sectionShotIds),
      label: sectionShotIds.length === 1 ? "当前段落" : `当前段落 ${sectionShotIds.length} 个镜头`,
    };
  }
  if (input.sectionId) {
    return {
      scope: "selected_shots" as const,
      selectedShotId: undefined,
      selectedShotIds: [],
      label: "当前段落",
      blocker: "这个段落还没有可生成的镜头。",
    };
  }
  return assetGenerationTarget(input.selectedShotId, input.selectedShotIds);
}

export function useImage2AssetGenerationAction({
  runtimeProjectIdentity,
  runtimeState,
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

  const runImage2AssetGeneration = useCallback(async (options?: Image2AssetGenerationRunOptions) => {
    const liveRuntimeProjectIdentity = runtimeProjectIdentity
      || currentProjectBindingIdentity(await loadCurrentProjectBindingStatus());
    if (!liveRuntimeProjectIdentity) {
      const nextState: Image2AssetGenerationActionState = { status: "blocked", message: "先选择项目。" };
      setActionState(nextState);
      return nextState;
    }
    const statuses = await loadProviderConfigStatuses();
    setProviderConfigStatuses(statuses);
    const providerId = preferredAssetProviderId(statuses);
    if (!providerId) {
      const nextState: Image2AssetGenerationActionState = { status: "blocked", message: "先去设置里连接图片服务。" };
      setActionState(nextState);
      return nextState;
    }

    const target = options
      ? scopedAssetGenerationTarget({
          runtimeState,
          scope: options.scope,
          selectedShotIds: options.selectedShotIds,
          selectedAssetId: options.selectedAssetId,
          sectionId: options.sectionId,
        })
      : scopedAssetGenerationTarget({ runtimeState, selectedShotId, selectedShotIds });
    if ("blocker" in target && target.blocker) {
      const nextState: Image2AssetGenerationActionState = { status: "blocked", message: target.blocker };
      setActionState(nextState);
      return nextState;
    }
    if (!options?.skipConfirm && !confirmAction(`要为${target.label}准备画面参考吗？\n\n会补角色、场景、关键道具和需要的故事板。细节动作会留在镜头说明里。结果会先进入复核区，不会自动锁定。`)) {
      const nextState: Image2AssetGenerationActionState = { status: "blocked", message: "已取消，本次没有生成。" };
      setActionState(nextState);
      return nextState;
    }
    const confirmedAt = options?.confirmedAt || new Date().toISOString();

    setActionState({
      status: "running",
      message: assetGenerationProgressMessage({
        providerId,
        runtimeState,
        targetLabel: target.label,
      }),
    });
    try {
      const submitted = await submitProjectImage2AssetGeneration(liveRuntimeProjectIdentity, {
        scope: target.scope,
        selectedShotId: target.selectedShotId,
        selectedShotIds: target.selectedShotIds,
        providerId,
        assetTypes: ["character", "scene", "prop", "storyboard"],
        agentTaskEnvelope: options?.agentToolTrace,
        confirmation: {
          receiptId: options?.confirmationReceiptId || `image2_asset_ui_${Date.now()}`,
          confirmedAt,
          phrase: IMAGE2_ASSET_CONFIRM_PHRASE,
          confirmed: true,
        },
      });
      const nextState = assetActionState(submitted);
      setActionState(nextState);
      const refreshed = await loadProjectRealChainStatus(liveRuntimeProjectIdentity);
      setProjectRealChainState(refreshed);
      return nextState;
    } catch (error) {
      const nextState: Image2AssetGenerationActionState = {
        status: "blocked",
        message: friendlyAssetGenerationError(error),
      };
      setActionState(nextState);
      return nextState;
    }
  }, [
    confirmAction,
    runtimeState,
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
    disabled: actionState.status === "running" || !runtimeProjectIdentity || !keyConfigured,
  }), [actionState.message, actionState.status, keyConfigured, runtimeProjectIdentity]);

  return {
    assetGenerationAction,
    runImage2AssetGeneration,
  };
}
