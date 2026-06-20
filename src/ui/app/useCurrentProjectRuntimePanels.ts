import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  currentProjectBindingIdentity,
  currentProjectBindingStatusFromBootstrap,
  clearCurrentProjectBinding,
  loadCurrentProjectBindingStatus,
  loadCurrentProjectChoices,
  loadProjectRealChainStatus,
  prepareProjectRound5StrictEditPreflight,
  runProjectRealChainCheck,
  selectCurrentProjectBinding,
  type ProjectCurrentBindingStatus,
  type ProjectCurrentChoice,
  type ProjectRuntimeIdentity,
} from "../../core/projectCurrentRuntimeClient";
import {
  confirmProjectImage2OneShot,
  executeReturnedProjectImage2OneShot,
  loadProjectImage2BatchPlan,
  loadProjectImage2OneShotStatus,
  prepareProjectImage2OneShot,
  prepareProjectImage2OneShotPermissionReceipt,
  runProjectImage2BatchCheck,
} from "../../core/projectImage2Client";
import {
  loadProviderConfigStatuses,
  type ProviderConfigStatus,
} from "../../core/providerCredentialsClient";
import type {
  ProjectImage2BatchPanelState,
  ProjectImage2OneShotPanelState,
  ProjectRealChainPanelState,
  ProjectRound5StrictEditPreflightPanelState,
} from "../project/ProjectRealChainPanel";

export type ProjectSelectionStatus = "idle" | "connecting" | "connected" | "error";

export type ConnectCurrentProjectOptions = {
  projectFileRootSelected?: boolean;
  createIfMissing?: boolean;
};

type UseCurrentProjectRuntimePanelsInput = {
  selectedShotId: string;
  previewRefreshEnabled: boolean;
};

function unavailableProjectPanelState(message: string) {
  return { status: "unavailable" as const, message };
}

const activePreviewRefreshMs = 6_000;
const idlePreviewRefreshMs = 30_000;
const hiddenPreviewRefreshMs = 60_000;

function activeStatusText(value: unknown) {
  return typeof value === "string" && /running|submitted|generating|queued|processing|pending/i.test(value);
}

function projectRealChainNeedsActiveRefresh(state: ProjectRealChainPanelState) {
  if (state.status === "running") return true;
  const relayQueue = state.summary?.relayQueue;
  if (relayQueue?.status === "running" || (relayQueue?.counts.active || 0) > 0) return true;
  return (state.summary?.previewItems || []).some((item) => (
    activeStatusText(item.status)
    || activeStatusText(item.previewStatus)
    || activeStatusText(item.videoStatus)
    || activeStatusText(item.queueInfo?.status)
    || activeStatusText(item.queue_info?.status)
  ));
}

function projectRealChainRefreshKey(state: ProjectRealChainPanelState) {
  const relayQueue = state.summary?.relayQueue;
  const counts = relayQueue?.counts;
  const activePreviewCount = (state.summary?.previewItems || []).filter((item) => (
    activeStatusText(item.status)
    || activeStatusText(item.previewStatus)
    || activeStatusText(item.videoStatus)
    || activeStatusText(item.queueInfo?.status)
    || activeStatusText(item.queue_info?.status)
  )).length;
  return [
    state.status,
    relayQueue?.status || "",
    counts?.active || 0,
    counts?.ready || 0,
    counts?.completed || 0,
    counts?.failed || 0,
    counts?.blocked || 0,
    activePreviewCount,
  ].join(":");
}

function previewRefreshDelayMs(state: ProjectRealChainPanelState) {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return hiddenPreviewRefreshMs;
  return projectRealChainNeedsActiveRefresh(state) ? activePreviewRefreshMs : idlePreviewRefreshMs;
}

export function useCurrentProjectRuntimePanels({
  selectedShotId,
  previewRefreshEnabled,
}: UseCurrentProjectRuntimePanelsInput) {
  const [projectRealChainState, setProjectRealChainState] = useState<ProjectRealChainPanelState>({ status: "unavailable" });
  const [projectImage2BatchState, setProjectImage2BatchState] = useState<ProjectImage2BatchPanelState>({ status: "unavailable" });
  const [projectImage2OneShotState, setProjectImage2OneShotState] = useState<ProjectImage2OneShotPanelState>({ status: "unavailable" });
  const [strictEditPreflightState, setStrictEditPreflightState] = useState<ProjectRound5StrictEditPreflightPanelState>({ status: "idle" });
  const [providerConfigStatuses, setProviderConfigStatuses] = useState<ProviderConfigStatus[]>([]);
  const [runtimeProjectBinding, setRuntimeProjectBinding] = useState<ProjectCurrentBindingStatus>(
    () => currentProjectBindingStatusFromBootstrap() || { status: "loading" },
  );
  const [projectPathInput, setProjectPathInput] = useState("");
  const [projectChoices, setProjectChoices] = useState<ProjectCurrentChoice[]>([]);
  const [projectSelectionStatus, setProjectSelectionStatus] = useState<ProjectSelectionStatus>("idle");
  const [authorizationRef, setAuthorizationRef] = useState("secret-store://providers/openai-image2/default");
  const projectRealChainStateRef = useRef(projectRealChainState);

  useEffect(() => {
    projectRealChainStateRef.current = projectRealChainState;
  }, [projectRealChainState]);

  const realChainRefreshKey = useMemo(
    () => projectRealChainRefreshKey(projectRealChainState),
    [projectRealChainState],
  );
  const realChainNeedsActiveRefresh = useMemo(
    () => projectRealChainNeedsActiveRefresh(projectRealChainState),
    [realChainRefreshKey],
  );

  const runtimeProjectIdentity = useMemo(
    () => currentProjectBindingIdentity(runtimeProjectBinding),
    [
      runtimeProjectBinding.projectId,
      runtimeProjectBinding.projectRoot,
      runtimeProjectBinding.projectTitle,
      runtimeProjectBinding.status,
    ],
  );

  const setUnavailableProjectPanels = useCallback((message: string) => {
    setProjectRealChainState(unavailableProjectPanelState(message));
    setProjectImage2BatchState(unavailableProjectPanelState(message));
    setProjectImage2OneShotState(unavailableProjectPanelState(message));
    setStrictEditPreflightState({ status: "idle" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCurrentProjectBindingStatus().then((binding) => {
      if (!cancelled) {
        setRuntimeProjectBinding((current) => current.status === "loading" ? binding : current);
        if (binding.status === "bound" && binding.projectRoot) {
          setProjectPathInput((current) => current.trim() ? current : binding.projectRoot || current);
        }
      }
    }).catch((error: unknown) => {
      if (!cancelled) {
        console.error("Failed to load current project binding status", error);
        setRuntimeProjectBinding((current) => current.status === "loading"
          ? { status: "unbound", message: "无法加载项目绑定状态。" }
          : current);
      }
    });
    loadCurrentProjectChoices().then((choices) => {
      if (!cancelled) setProjectChoices(choices);
    }).catch((error: unknown) => {
      if (!cancelled) console.error("Failed to load current project choices", error);
    });
    loadProviderConfigStatuses().then((statuses) => {
      if (!cancelled) setProviderConfigStatuses(statuses);
    }).catch((error: unknown) => {
      if (!cancelled) console.error("Failed to load provider config statuses", error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshCurrentProjectPanels = useCallback(async (binding: ProjectCurrentBindingStatus) => {
    setRuntimeProjectBinding(binding);
    const identity = currentProjectBindingIdentity(binding);
    if (!identity) {
      setUnavailableProjectPanels("未选择项目/未同步。");
      return;
    }
    const [nextRealChainState, nextImage2BatchState, nextOneShotState] = await Promise.all([
      loadProjectRealChainStatus(identity),
      loadProjectImage2BatchPlan(identity),
      loadProjectImage2OneShotStatus(identity, selectedShotId),
    ]);
    const statuses = await loadProviderConfigStatuses();
    setProjectRealChainState(nextRealChainState);
    setProjectImage2BatchState(nextImage2BatchState);
    setProjectImage2OneShotState(nextOneShotState);
    setProviderConfigStatuses(statuses);
    setStrictEditPreflightState({ status: "idle" });
  }, [selectedShotId, setUnavailableProjectPanels]);

  useEffect(() => {
    if (runtimeProjectBinding.status !== "loading") return undefined;
    let cancelled = false;
    let inFlight = false;

    const recoverBinding = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const binding = await loadCurrentProjectBindingStatus();
        if (!cancelled && binding.status === "bound") {
          if (binding.projectRoot) setProjectPathInput((current) => current.trim() ? current : binding.projectRoot || current);
          await refreshCurrentProjectPanels(binding);
        } else if (!cancelled) {
          setRuntimeProjectBinding((current) => current.status === "loading" ? binding : current);
        }
      } catch {
        if (!cancelled) {
          setRuntimeProjectBinding((current) => current.status === "loading"
            ? { status: "unbound", message: "未选择项目/未同步。" }
            : current);
        }
      } finally {
        inFlight = false;
      }
    };

    const timeout = window.setTimeout(() => { void recoverBinding(); }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    refreshCurrentProjectPanels,
    runtimeProjectBinding.status,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!runtimeProjectIdentity) {
      setUnavailableProjectPanels("未选择项目/未同步。");
      return () => {
        cancelled = true;
      };
    }
    loadProjectRealChainStatus(runtimeProjectIdentity).then((nextState) => {
      if (!cancelled) setProjectRealChainState(nextState);
    }).catch((error: unknown) => {
      if (!cancelled) {
        console.error("Failed to load project real chain status", error);
        setProjectRealChainState(unavailableProjectPanelState("加载项目状态失败。"));
      }
    });
    loadProjectImage2BatchPlan(runtimeProjectIdentity).then((nextState) => {
      if (!cancelled) setProjectImage2BatchState(nextState);
    }).catch((error: unknown) => {
      if (!cancelled) {
        console.error("Failed to load project image2 batch plan", error);
        setProjectImage2BatchState(unavailableProjectPanelState("加载复核状态失败。"));
      }
    });
    loadProjectImage2OneShotStatus(runtimeProjectIdentity, selectedShotId).then((nextState) => {
      if (!cancelled) setProjectImage2OneShotState(nextState);
    }).catch((error: unknown) => {
      if (!cancelled) {
        console.error("Failed to load project image2 one-shot status", error);
        setProjectImage2OneShotState(unavailableProjectPanelState("加载小样状态失败。"));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [runtimeProjectIdentity, selectedShotId, setUnavailableProjectPanels]);

  useEffect(() => {
    if (
      !previewRefreshEnabled
      && !realChainNeedsActiveRefresh
    ) return undefined;
    if (runtimeProjectBinding.status !== "bound" || !runtimeProjectIdentity) return undefined;
    let cancelled = false;
    let inFlight = false;
    let timeout: number | undefined;
    const clearScheduledRefresh = () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      timeout = undefined;
    };
    const scheduleRefresh = (delay = previewRefreshDelayMs(projectRealChainStateRef.current)) => {
      clearScheduledRefresh();
      if (!cancelled) timeout = window.setTimeout(() => { void refreshPreview(); }, delay);
    };
    const refreshPreview = async () => {
      if (cancelled || inFlight) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        scheduleRefresh();
        return;
      }
      inFlight = true;
      try {
        const nextState = await loadProjectRealChainStatus(runtimeProjectIdentity);
        if (!cancelled) setProjectRealChainState(nextState);
      } catch (error) {
        if (!cancelled) console.error("Failed to refresh current project preview state", error);
      } finally {
        inFlight = false;
        scheduleRefresh();
      }
    };
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") scheduleRefresh(250);
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleRefresh();
    return () => {
      cancelled = true;
      clearScheduledRefresh();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    previewRefreshEnabled,
    realChainNeedsActiveRefresh,
    realChainRefreshKey,
    runtimeProjectBinding.status,
    runtimeProjectIdentity?.projectId,
    runtimeProjectIdentity?.projectRoot,
  ]);

  const connectCurrentProject = useCallback(async (
    choice?: ProjectCurrentChoice,
    options: ConnectCurrentProjectOptions = {},
  ) => {
    const projectRoot = (choice?.projectRoot || projectPathInput).trim();
    if (!projectRoot) {
      setProjectSelectionStatus("error");
      setUnavailableProjectPanels("请输入项目路径。");
      return;
    }
    setProjectPathInput(projectRoot);

    setProjectSelectionStatus("connecting");
    setProjectRealChainState({
      status: "running",
      message: "正在连接当前项目。",
    });
    setProjectImage2BatchState({
      status: "running",
      message: "正在同步当前项目。",
    });
    setProjectImage2OneShotState({
      status: "running",
      message: "正在同步当前项目。",
    });

    try {
      const binding = await selectCurrentProjectBinding({
        projectRoot,
        projectId: choice?.projectId,
        displayName: choice?.displayName,
        createIfMissing: options.createIfMissing === true,
      });
      if (binding.projectRoot) setProjectPathInput(binding.projectRoot);
      await refreshCurrentProjectPanels(binding);
      const choices = await loadCurrentProjectChoices();
      setProjectChoices(choices);
      setProjectSelectionStatus("connected");
    } catch {
      const message = options.projectFileRootSelected
        ? "项目文件已打开，运行时同步暂不可用。"
        : "连接项目失败，请确认路径在当前工作区内并且项目文件可读取。";
      setRuntimeProjectBinding({ status: "unbound", message });
      setUnavailableProjectPanels(message);
      setProjectSelectionStatus(options.projectFileRootSelected ? "connected" : "error");
    }
  }, [projectPathInput, refreshCurrentProjectPanels, setUnavailableProjectPanels]);

  const selectProjectChoice = useCallback((choice: ProjectCurrentChoice) => {
    void connectCurrentProject(choice);
  }, [connectCurrentProject]);

  const forgetCurrentProject = useCallback(async () => {
    setProjectSelectionStatus("connecting");
    try {
      const binding = await clearCurrentProjectBinding();
      setRuntimeProjectBinding(binding);
      setProjectPathInput("");
      setUnavailableProjectPanels("未选择项目。");
      const choices = await loadCurrentProjectChoices();
      setProjectChoices(choices);
      setProjectSelectionStatus("idle");
      return binding;
    } catch {
      setProjectSelectionStatus("error");
      const message = "忘记当前项目失败，请稍后再试。";
      setUnavailableProjectPanels(message);
      return undefined;
    }
  }, [setUnavailableProjectPanels]);

  const runProjectRealChain = useCallback(async () => {
    if (!runtimeProjectIdentity) {
      setProjectRealChainState(unavailableProjectPanelState("未选择项目/未同步。"));
      return;
    }
    setProjectRealChainState((current) => ({
      ...current,
      status: "running",
      message: "正在同步当前项目状态。",
    }));
    const nextState = await runProjectRealChainCheck(runtimeProjectIdentity);
    setProjectRealChainState(nextState);
  }, [runtimeProjectIdentity]);

  const runProjectImage2Batch = useCallback(async () => {
    if (!runtimeProjectIdentity) {
      const nextState = unavailableProjectPanelState("未选择项目/未同步。");
      setProjectImage2BatchState(nextState);
      return nextState;
    }
    setProjectImage2BatchState((current) => ({
      ...current,
      status: "running",
      message: "正在检查当前项目复核状态。",
    }));
    const nextState = await runProjectImage2BatchCheck(runtimeProjectIdentity);
    setProjectImage2BatchState(nextState);
    return nextState;
  }, [runtimeProjectIdentity]);

  const prepareStrictEditPreflight = useCallback(async (shotId: string) => {
    if (!runtimeProjectIdentity) {
      setStrictEditPreflightState({ status: "unavailable", message: "未选择项目/未同步。" });
      return;
    }
    setStrictEditPreflightState({
      status: "running",
      message: shotId ? `正在准备 ${shotId} edit 证据。` : "正在准备 edit 证据。",
    });
    const nextState = await prepareProjectRound5StrictEditPreflight(runtimeProjectIdentity, shotId);
    setStrictEditPreflightState(nextState);
    if (nextState.status === "prepared") {
      const refreshed = await loadProjectRealChainStatus(runtimeProjectIdentity);
      setProjectRealChainState(refreshed);
    }
  }, [runtimeProjectIdentity]);

  const prepareImage2OneShot = useCallback(async (shotId?: string) => {
    if (!runtimeProjectIdentity) {
      setProjectImage2OneShotState(unavailableProjectPanelState("未选择项目/未同步。"));
      return;
    }
    setProjectImage2OneShotState((current) => ({
      ...current,
      status: "running",
      message: "正在准备小样。",
    }));
    const nextState = await prepareProjectImage2OneShot(runtimeProjectIdentity, shotId || selectedShotId);
    setProjectImage2OneShotState(nextState);
  }, [runtimeProjectIdentity, selectedShotId]);

  const confirmImage2OneShot = useCallback(async () => {
    if (!runtimeProjectIdentity) {
      setProjectImage2OneShotState(unavailableProjectPanelState("未选择项目/未同步。"));
      return;
    }
    setProjectImage2OneShotState((current) => ({
      ...current,
      status: "running",
      message: "正在确认小样包。",
    }));
    const confirmedState = await confirmProjectImage2OneShot(
      runtimeProjectIdentity,
      projectImage2OneShotState.receipt || projectImage2OneShotState.summary?.receipt,
    );
    setProjectImage2OneShotState(confirmedState);
  }, [projectImage2OneShotState.receipt, projectImage2OneShotState.summary?.receipt, runtimeProjectIdentity]);

  const prepareImage2OneShotPermissionReceipt = useCallback(async () => {
    if (!runtimeProjectIdentity) {
      setProjectImage2OneShotState(unavailableProjectPanelState("未选择项目/未同步。"));
      return;
    }
    const receipt = projectImage2OneShotState.receipt || projectImage2OneShotState.summary?.receipt;
    if (!receipt) {
      setProjectImage2OneShotState((current) => ({
        ...current,
        status: "blocked",
        message: "请先准备小样包。",
      }));
      return;
    }
    setProjectImage2OneShotState((current) => ({
      ...current,
      status: "running",
      message: "正在准备授权票据。",
    }));
    const nextState = await prepareProjectImage2OneShotPermissionReceipt(runtimeProjectIdentity, receipt, authorizationRef.trim());
    setProjectImage2OneShotState(nextState);
  }, [
    authorizationRef,
    projectImage2OneShotState.receipt,
    projectImage2OneShotState.summary?.receipt,
    runtimeProjectIdentity,
  ]);

  const checkImage2OneShotReturn = useCallback(async () => {
    if (!runtimeProjectIdentity) {
      setProjectImage2OneShotState(unavailableProjectPanelState("未选择项目/未同步。"));
      return;
    }
    setProjectImage2OneShotState((current) => ({
      ...current,
      status: "running",
      message: "正在检查结果。",
    }));
    const nextState = await executeReturnedProjectImage2OneShot(
      runtimeProjectIdentity,
      projectImage2OneShotState.receipt || projectImage2OneShotState.summary?.receipt,
    );
    setProjectImage2OneShotState(nextState);
    const refreshed = await loadProjectRealChainStatus(runtimeProjectIdentity);
    setProjectRealChainState(refreshed);
  }, [projectImage2OneShotState.receipt, projectImage2OneShotState.summary?.receipt, runtimeProjectIdentity]);

  return {
    projectRealChainState,
    projectImage2BatchState,
    projectImage2OneShotState,
    strictEditPreflightState,
    providerConfigStatuses,
    runtimeProjectBinding,
    runtimeProjectIdentity: runtimeProjectIdentity as ProjectRuntimeIdentity | undefined,
    projectPathInput,
    projectChoices,
    projectSelectionStatus,
    authorizationRef,
    setProjectRealChainState,
    setProjectImage2BatchState,
    setProjectImage2OneShotState,
    setProviderConfigStatuses,
    setProjectPathInput,
    setProjectSelectionStatus,
    setAuthorizationRef,
    refreshCurrentProjectPanels,
    connectCurrentProject,
    selectProjectChoice,
    forgetCurrentProject,
    runProjectRealChain,
    runProjectImage2Batch,
    prepareStrictEditPreflight,
    prepareImage2OneShot,
    confirmImage2OneShot,
    prepareImage2OneShotPermissionReceipt,
    checkImage2OneShotReturn,
  };
}
