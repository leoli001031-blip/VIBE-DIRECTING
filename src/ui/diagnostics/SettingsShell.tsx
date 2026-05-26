import { useEffect, useState } from "react";
import { LockKeyhole, Settings } from "lucide-react";
import type { ProjectRuntimeState } from "../../core/projectState";
import type { RuntimeView } from "../../core/runtimeView";
import {
  type CredentialsSnapshot,
  type ProviderConfigStatus,
  deleteCredential,
  loadCredentials,
  loadProviderConfigStatuses,
  saveCredential,
} from "../../core/providerCredentialsClient";
import {
  agentWebSearchSourceLabel,
  defaultAgentWebSearchSettings,
  normalizeAgentWebSearchSettings,
  type AgentWebSearchSettings,
  type AgentWebSearchProvider,
} from "../../core/agentWebSearchClient";
import { StatusPill, statusLabel } from "../common/DiagnosticsPrimitives";
import {
  buildAgentCliMockRunnerUiSummary,
  buildBetaAcceptanceUiSummary,
  buildCliAdapterSpikeUiSummary,
  buildDesktopRuntimeShellView,
  buildExportWorkerUiSummary,
  buildFullTaskSubagentPacketPlannerUiSummary,
  buildKnowledgePackUserManagementUiSummary,
  buildKnowledgeUiSummary,
  buildLocalOrchestratorUiSummary,
  buildProviderClosedLoopShellUiSummary,
  buildRealPilotUiSummary,
  buildVisualConsistencyContractUiSummary,
  buildVoiceAudioSettingsUiSummary,
  buildWorkerRuntimeGateUiSummary,
} from "./projections/runtimeDiagnostics";
import {
  buildProviderActionConfirmationReceiptUiSummary,
  buildProviderEnablementGateUiSummary,
  buildProviderExecutionHandoffUiSummary,
  buildProviderExecutionPermissionGateUiSummary,
} from "./ProviderGateDiagnostics";

const providerCredentialAliases: Record<string, string[]> = {
  "deepseek-v4-pro": ["deepseek-v4-pro", "deepseek", "deepseek-v4", "deepseek-chat"],
  "lanyi-image2": ["lanyi-image2", "lanyiapi-gpt-image-2", "openai-image2-api"],
  "apikey-fun-gpt55-responses-image": ["apikey-fun-gpt55-responses-image", "apikey-fun", "apikey_fun", "gpt55-responses-image"],
  "tavily-search": ["tavily-search", "tavily_search", "tavily"],
  "cloud-tts": ["cloud-tts", "tts-cloud", "audio-tts"],
};

function providerAliases(providerId: string) {
  return providerCredentialAliases[providerId] || [providerId];
}

function credentialForProvider(credentials: CredentialsSnapshot, providerId: string) {
  return providerAliases(providerId).map((alias) => credentials[alias]).find(Boolean);
}

function keyStatusForProvider(providerConfig: ProviderConfigStatus | undefined, credential: ReturnType<typeof credentialForProvider>) {
  if (credential?.hasKey) return "local_settings";
  if (providerConfig?.credential?.keyStatus === "configured") return providerConfig.credential.source || "configured";
  if (providerConfig?.credential?.keyStatus === "not_required") return "not_required";
  return "not_configured";
}

function connectionStatusLabel(status: string, fallback = "需要配置") {
  if (status === "local_settings") return "已保存";
  if (status === "environment") return "环境变量已配置";
  if (status === "not_required") return "不需要 Key";
  if (status === "configured") return "已配置";
  return fallback;
}

function providerModelLine(providerConfig: ProviderConfigStatus | undefined, fallback = "等待配置") {
  if (!providerConfig) return fallback;
  if (providerConfig.providerId === "tavily-search" || providerConfig.endpointMode === "search_api") {
    return "资料搜索 Tavily";
  }
  return [
    providerConfig.imageModel ? `图片 ${providerConfig.imageModel}` : "",
    providerConfig.chatModel ? `Agent ${providerConfig.chatModel}` : "",
    providerConfig.ttsModel ? `语音 ${providerConfig.ttsModel}` : "",
  ].filter(Boolean).join(" · ") || providerConfig.baseUrl || fallback || "已准备";
}

export function SettingsShell({
  runtimeState,
  view,
  webSearchSettings = defaultAgentWebSearchSettings,
  onWebSearchSettingsChange,
}: {
  runtimeState: ProjectRuntimeState;
  view: RuntimeView;
  webSearchSettings?: AgentWebSearchSettings;
  onWebSearchSettingsChange?: (settings: AgentWebSearchSettings) => void;
}) {
  // Sensitive fields (providerId, envKey, baseUrl) displayed for debugging only; consider masking in production
  const [credentials, setCredentials] = useState<CredentialsSnapshot>({});
  const [providerConfigStatuses, setProviderConfigStatuses] = useState<ProviderConfigStatus[]>([]);
  const runtime = runtimeState.runtime;
  const config = runtime.config;
  const providerSummary = runtime.providerEnablementSummary;
  const adapterSummary = runtimeState.adapterContracts.summary;
  const tools = runtime.detectionReport.tools;
  const sidecar = config.sidecarPermissions;
  const providerSlots = config.providerEnablement.slots;
  const providerAdapters = config.providerAdapterSettings || [];
  const runtimeProviderConfigs = config.providerConfigs || [];
  const providerConfigs = [
    ...runtimeProviderConfigs.map((providerConfig) => {
      const status = providerConfigStatuses.find((entry) => entry.providerId === providerConfig.providerId);
      return {
        ...providerConfig,
        ...status,
        credential: {
          ...providerConfig.credential,
          ...status?.credential,
        },
      };
    }),
    ...providerConfigStatuses
      .filter((entry) => !runtimeProviderConfigs.some((providerConfig) => providerConfig.providerId === entry.providerId))
      .map((entry) => ({
        ...entry,
        credential: {
          ...entry.credential,
        },
      })),
  ] as Array<(typeof runtimeProviderConfigs)[number] & ProviderConfigStatus>;
  const voiceLibrary = runtimeState.voiceSourceLibrary;
  const voiceSources = voiceLibrary.sources;
  const desktopShell = buildDesktopRuntimeShellView(runtimeState);
  const knowledgeSummary = buildKnowledgeUiSummary(view);
  const agentCliMockRunnerSummary = buildAgentCliMockRunnerUiSummary(runtimeState);
  const cliAdapterSpikeSummary = buildCliAdapterSpikeUiSummary(runtimeState);
  const exportWorkerSummary = buildExportWorkerUiSummary(runtimeState);
  const voiceAudioSettingsSummary = buildVoiceAudioSettingsUiSummary(runtimeState);
  const providerEnablementGateSummary = buildProviderEnablementGateUiSummary(runtimeState);
  const providerExecutionPermissionGateSummary = buildProviderExecutionPermissionGateUiSummary(runtimeState);
  const providerActionConfirmationReceiptSummary = buildProviderActionConfirmationReceiptUiSummary(runtimeState);
  const providerExecutionHandoffSummary = buildProviderExecutionHandoffUiSummary(runtimeState);
  const localOrchestratorSummary = buildLocalOrchestratorUiSummary(runtimeState);
  const visualConsistencySummary = buildVisualConsistencyContractUiSummary(runtimeState);
  const fullTaskSubagentPacketPlannerSummary = buildFullTaskSubagentPacketPlannerUiSummary(runtimeState);
  const knowledgePackUserManagementSummary = buildKnowledgePackUserManagementUiSummary(runtimeState);
  const workerRuntimeGateSummary = buildWorkerRuntimeGateUiSummary(runtimeState);
  const providerClosedLoopShellSummary = buildProviderClosedLoopShellUiSummary(runtimeState);
  const betaAcceptanceSummary = buildBetaAcceptanceUiSummary(runtimeState);
  const realPilotSummary = buildRealPilotUiSummary(runtimeState);

  const [credFormProviderId, setCredFormProviderId] = useState("");
  const [credFormApiKey, setCredFormApiKey] = useState("");
  const [credFormSaving, setCredFormSaving] = useState(false);
  const resolvedWebSearchSettings = normalizeAgentWebSearchSettings(webSearchSettings);

  useEffect(() => {
    let c = false;
    void Promise.all([loadCredentials(), loadProviderConfigStatuses()]).then(([creds, providerStatuses]) => {
      if (!c) {
        setCredentials(creds);
        setProviderConfigStatuses(providerStatuses);
      }
    }).catch((error: unknown) => {
      if (!c) console.error("Failed to load credentials and provider config statuses", error);
    });
    return () => { c = true; };
  }, []);

  const credentialProviderIds = Object.keys(credentials);
  const providerConfigById = new Map(providerConfigs.map((providerConfig) => [providerConfig.providerId, providerConfig]));
  const deepseekConfig = providerConfigById.get("deepseek-v4-pro");
  const lanyiConfig = providerConfigById.get("lanyi-image2");
  const apikeyFunConfig = providerConfigById.get("apikey-fun-gpt55-responses-image");
  const tavilyConfig = providerConfigById.get("tavily-search");
  const cloudTtsConfig = providerConfigById.get("cloud-tts");
  const tavilyCredential = credentialForProvider(credentials, "tavily-search");
  const tavilyReady = Boolean(tavilyCredential?.hasKey || tavilyConfig?.credential?.keyStatus === "configured");
  const serviceKeyOptions = [
    { providerId: "deepseek-v4-pro", label: "规划模型" },
    { providerId: "lanyi-image2", label: "Image2 生图" },
    { providerId: "apikey-fun-gpt55-responses-image", label: "备用 GPT-5.5 生图" },
    { providerId: "tavily-search", label: "联网查资料" },
    { providerId: "cloud-tts", label: "云端配音" },
  ];
  const credentialOptions = serviceKeyOptions;
  const imageProviders = providerConfigs.filter((providerConfig) => (
    providerConfig.imageModel &&
    !providerConfig.ttsModel &&
    providerConfig.endpointMode !== "search_api" &&
    providerConfig.providerId !== "tavily-search"
  ));
  const videoProviders = providerAdapters.filter((adapter) => adapter.slot.startsWith("video."));
  const ttsProviders = providerConfigs.filter((providerConfig) => providerConfig.ttsModel || providerConfig.localCommand || providerConfig.cloudEndpoint);
  const serviceConnections = [
    {
      id: "deepseek-v4-pro",
      title: "规划模型",
      purpose: "负责拆脚本、定节奏、选故事板模式和编译文字提示词；不直接生图或提交视频。",
      config: deepseekConfig,
      credential: credentialForProvider(credentials, "deepseek-v4-pro"),
      saveLabel: "DeepSeek v4 Pro",
      noKeyNote: "需要真实让 AI 拆分镜时再填。",
    },
    {
      id: "lanyi-image2",
      title: "Image2 生图",
      purpose: "用于生成角色、场景、道具和故事板参考图。规划模型的 Key 单独配置。",
      config: lanyiConfig,
      credential: credentialForProvider(credentials, "lanyi-image2"),
      saveLabel: "Lanyi Image2",
      noKeyNote: "真实生图前需要配置。",
    },
    {
      id: "apikey-fun-gpt55-responses-image",
      title: "备用 GPT-5.5 生图",
      purpose: "当前用于前端真实出图测试。它走 Responses 流式回图，适合在 Lanyi Image2 不稳定时继续生成参考图。",
      config: apikeyFunConfig,
      credential: credentialForProvider(credentials, "apikey-fun-gpt55-responses-image"),
      saveLabel: "Apikey.fun GPT-5.5 Images",
      noKeyNote: "需要真实测试 GPT-5.5 生图时再填。",
    },
    {
      id: "tavily-search",
      title: "联网查资料",
      purpose: "给 Agent 做风格、导演方法、资料检索。不开启联网时可以先用本地演示。",
      config: tavilyConfig,
      credential: credentialForProvider(credentials, "tavily-search"),
      saveLabel: "Tavily Search",
      noKeyNote: "只有选择“联网资料”并开启联网时才需要。",
    },
    {
      id: "cloud-tts",
      title: "云端配音",
      purpose: "给后续云端 TTS 或声音克隆预留。本地 IndexTTS / Qwen3 TTS 不需要 API Key。",
      config: cloudTtsConfig,
      credential: credentialForProvider(credentials, "cloud-tts"),
      saveLabel: "Cloud TTS",
      noKeyNote: "暂时不用云端配音可以先不填。",
    },
    {
      id: "jimeng-video",
      title: "视频生成",
      purpose: "Seedance / 即梦走 CLI 登录态，不在这里填 API Key。生成前仍然需要你确认任务。",
      config: undefined,
      credential: undefined,
      saveLabel: "",
      noKeyNote: "不用在这里保存 Key。",
      keyless: true,
    },
  ];
  const isFallbackProject = runtimeState.stateSource?.kind === "fallback-audit";
  const quickProjectTitle = isFallbackProject ? "新视频项目" : (runtimeState.project.title || "新视频项目");
  const quickProjectRoot = isFallbackProject
    ? "还没有绑定本地项目文件夹"
    : (view.stateSource?.path || runtimeState.project.root || "还没有绑定本地项目文件夹");
  const configuredImageProviderCount = imageProviders.filter((providerConfig) => {
    const localCredential = credentials[providerConfig.providerId];
    const keyStatus = providerConfig.credential?.keyStatus;
    return Boolean(localCredential?.hasKey || keyStatus === "configured" || keyStatus === "not_required");
  }).length;
  const quickImageStatus = imageProviders.length
    ? `${imageProviders.length} 个图片服务 · ${configuredImageProviderCount} 个已配置`
    : "还没有图片服务";
  const quickVideoStatus = videoProviders.length
    ? `${videoProviders.length} 个视频通道 · 默认需要手动确认`
    : "还没有视频通道";
  const quickVoiceStatus = `${voiceSources.length} 个音频参考 · ${voiceAudioSettingsSummary.noBgmPolicy ? "默认不加背景音乐" : "背景音乐未关闭"}`;
  const webSearchStatusLabel = !resolvedWebSearchSettings.enabled
    ? "AI 查资料已关闭"
    : resolvedWebSearchSettings.provider === "tavily_search" && !tavilyReady
      ? "Tavily 还没有 Key"
    : resolvedWebSearchSettings.provider !== "mock" && !resolvedWebSearchSettings.allowNetwork
      ? "联网资料待开启"
      : resolvedWebSearchSettings.provider === "mock"
        ? "本地资料演示"
        : "允许 AI 联网查资料";

  async function handleSaveCredential(providerId: string, apiKey: string, label?: string) {
    const result = await saveCredential(providerId, apiKey, label);
    if (result) {
      const [creds, providerStatuses] = await Promise.all([loadCredentials(), loadProviderConfigStatuses()]);
      setCredentials(creds);
      setProviderConfigStatuses(providerStatuses);
    }
  }

  async function handleDeleteCredential(providerId: string) {
    await deleteCredential(providerId);
    const [creds, providerStatuses] = await Promise.all([loadCredentials(), loadProviderConfigStatuses()]);
    setCredentials(creds);
    setProviderConfigStatuses(providerStatuses);
  }

  function updateWebSearchSettings(patch: Partial<AgentWebSearchSettings>) {
    onWebSearchSettingsChange?.(normalizeAgentWebSearchSettings({ ...resolvedWebSearchSettings, ...patch }));
  }

  return (
    <section className="machine-panel settings-shell">
      <div className="audit-head">
        <Settings size={17} />
        <span>设置</span>
      </div>
      <div className="settings-friendly-intro">
        <strong>这里只放日常会用到的设置。</strong>
        <span>项目、生成服务、联网资料和声音开关放在前面；排查项收在高级区域。</span>
      </div>
      <div className="settings-quick-grid">
        <div>
          <span>当前项目</span>
          <strong>{quickProjectTitle}</strong>
          <small>{quickProjectRoot}</small>
        </div>
        <div>
          <span>图片生成</span>
          <strong>{quickImageStatus}</strong>
          <small>Image2 / 参考图 / 分镜图都走确认后提交</small>
        </div>
        <div>
          <span>视频生成</span>
          <strong>{quickVideoStatus}</strong>
          <small>Seedance / 即梦任务不会自动静默提交</small>
        </div>
        <div>
          <span>声音</span>
          <strong>{quickVoiceStatus}</strong>
          <small>{ttsProviders.length ? `${ttsProviders.length} 个 TTS 配置` : "TTS 可以稍后再配置"}</small>
        </div>
      </div>
      <div className="settings-user-section">
        <div className="settings-group-title">查资料</div>
        <div className="settings-list web-search-settings-list">
          <div className="settings-readonly-note">
            <strong>{webSearchStatusLabel}</strong>
            <small>
              {agentWebSearchSourceLabel(resolvedWebSearchSettings)} · 查到的内容只会变成待确认研究卡。
              {resolvedWebSearchSettings.provider === "tavily_search" && !tavilyReady ? " 先在服务连接里保存 Tavily Key。" : ""}
            </small>
          </div>
          <div className="web-search-quick-actions" aria-label="查资料快捷设置">
            <button
              type="button"
              className={resolvedWebSearchSettings.enabled && resolvedWebSearchSettings.provider === "tavily_search" ? "active" : ""}
              onClick={() => updateWebSearchSettings({ enabled: true, provider: "tavily_search", allowNetwork: true, endpoint: "" })}
            >
              使用 Tavily 联网
            </button>
            <button
              type="button"
              className={resolvedWebSearchSettings.enabled && resolvedWebSearchSettings.provider === "mock" ? "active" : ""}
              onClick={() => updateWebSearchSettings({ enabled: true, provider: "mock", allowNetwork: false, endpoint: "" })}
            >
              本地演示
            </button>
            <button
              type="button"
              onClick={() => updateWebSearchSettings({ enabled: false })}
            >
              关闭查资料
            </button>
          </div>
          <div className="web-search-settings-form">
            <label>
              <span>使用查资料</span>
              <input
                type="checkbox"
                checked={resolvedWebSearchSettings.enabled}
                onChange={(event) => updateWebSearchSettings({ enabled: event.currentTarget.checked })}
              />
            </label>
            <label>
              <span>资料来源</span>
              <select
                value={resolvedWebSearchSettings.provider}
                onChange={(event) => updateWebSearchSettings({
                  provider: event.currentTarget.value as AgentWebSearchProvider,
                  allowNetwork: event.currentTarget.value === "mock" ? false : resolvedWebSearchSettings.allowNetwork,
                })}
              >
                <option value="mock">本地演示</option>
                <option value="tavily_search">联网资料</option>
                <option value="searxng_json">本地搜索服务</option>
                <option value="duckduckgo_instant_answer">公开搜索</option>
              </select>
            </label>
            <label>
              <span>允许联网</span>
              <input
                type="checkbox"
                disabled={resolvedWebSearchSettings.provider === "mock"}
                checked={resolvedWebSearchSettings.provider !== "mock" && resolvedWebSearchSettings.allowNetwork}
                onChange={(event) => updateWebSearchSettings({ allowNetwork: event.currentTarget.checked })}
              />
            </label>
            <label>
              <span>最多卡片</span>
              <input
                type="number"
                min={1}
                max={5}
                value={resolvedWebSearchSettings.maxResults}
                onChange={(event) => updateWebSearchSettings({ maxResults: Number(event.currentTarget.value) })}
              />
            </label>
          </div>
        </div>
        <div className="settings-group-title">服务连接</div>
        <div className="settings-list credential-settings-list">
          <div className="settings-readonly-note">
            <strong>{credentialProviderIds.length ? `${credentialProviderIds.length} 个 Key 已保存在本机` : "还没有保存 API Key"}</strong>
            <small>按用途管理，不再暴露内部 providerId。真实提交前仍然会二次确认。</small>
          </div>
          <div className="service-connection-grid">
            {serviceConnections.map((service) => {
              const status = keyStatusForProvider(service.config, service.credential);
              const keyless = "keyless" in service && service.keyless === true;
              const badge = keyless ? "不需要 Key" : connectionStatusLabel(status);
              const credentialProviderId = service.credential?.providerId;
              const canDelete = Boolean(credentialProviderId && status === "local_settings");
              const statusTone = status === "not_configured" && !keyless ? "needs-key" : "ready";
              return (
                <div key={service.id} className={`service-connection-card ${statusTone}`}>
                  <div className="service-connection-head">
                    <strong>{service.title}</strong>
                    <span>{badge}</span>
                  </div>
                  <p>{service.purpose}</p>
                  <small>{providerModelLine(service.config, keyless ? "即梦 / Seedance CLI 登录态" : "等待配置")}</small>
                  {service.credential ? (
                    <small>本机已保存：{service.credential.maskedKey} · {service.credential.updatedAt ? new Date(service.credential.updatedAt).toLocaleDateString() : "unknown"}</small>
                  ) : (
                    <small>{service.noKeyNote}</small>
                  )}
                  {canDelete && credentialProviderId && (
                    <button className="credential-delete-btn" onClick={async () => { await handleDeleteCredential(credentialProviderId); }}>
                      删除这个 Key
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <details className="settings-raw-credentials">
            <summary>查看已保存的原始条目</summary>
            {credentialProviderIds.map((pid) => {
              const entry = credentials[pid];
            return (
              <div key={pid}>
                <strong>{entry.label || entry.providerId}</strong>
                <small>{entry.maskedKey} · updated {entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : "unknown"}</small>
                <button className="credential-delete-btn" onClick={async () => { await handleDeleteCredential(pid); }}>Delete</button>
              </div>
            );
            })}
            {!credentialProviderIds.length && (
              <div>
                <strong>暂无保存条目</strong>
                <small>添加 Key 后会在这里显示脱敏记录。</small>
              </div>
            )}
          </details>
          <div className="credential-add-form">
            <strong>添加 Key</strong>
            <select value={credFormProviderId} onChange={(e) => setCredFormProviderId(e.currentTarget.value)}>
              <option value="">选择服务...</option>
              {serviceKeyOptions.map((option) => (
                <option key={option.providerId} value={option.providerId}>{option.label}</option>
              ))}
            </select>
            <input type="password" placeholder="API Key" value={credFormApiKey} onChange={(e) => setCredFormApiKey(e.currentTarget.value)} />
            <button
              disabled={!credFormProviderId || !credFormApiKey || credFormSaving}
              onClick={async () => {
                if (!credFormProviderId || !credFormApiKey) return;
                setCredFormSaving(true);
                try {
                  const label = serviceKeyOptions.find((option) => option.providerId === credFormProviderId)?.label || credFormProviderId;
                  await handleSaveCredential(credFormProviderId, credFormApiKey, label);
                  setCredFormApiKey("");
                  setCredFormProviderId("");
                }
                finally { setCredFormSaving(false); }
              }}
            >
              {credFormSaving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
      <details className="settings-advanced">
        {/* TODO: add focus trap and aria-modal for accessibility */}
        <summary>
          <span>高级排查</span>
          <small>运行状态、队列、权限和诊断信息</small>
        </summary>
      <div className="desktop-runtime-shell">
        <div className="row-head">
          <div className="audit-head desktop-runtime-title">
            <LockKeyhole size={16} />
            <span>Desktop Runtime / Permission Shell</span>
          </div>
          <StatusPill value={desktopShell.planStatus} />
        </div>
        <div className="field-grid compact desktop-runtime-grid">
          <label>runtime mode</label>
          <span>{desktopShell.runtimeMode}</span>
          <label>platform/path policy</label>
          <span>{desktopShell.platformPathPolicy}</span>
          <label>project permission scope</label>
          <span>{desktopShell.projectPermissionScope}</span>
          <label>sidecar policy</label>
          <span>{desktopShell.sidecarPolicy}</span>
          <label>credential vault placeholder</label>
          <span>{desktopShell.credentialVault}</span>
        </div>
        <div className="desktop-runtime-locks" aria-label="hard locks summary">
          {desktopShell.hardLocks.map((lock) => (
            <span key={lock}>{lock}</span>
          ))}
        </div>
      </div>
      <div className="field-grid compact runtime-facts">
        <label>Runtime</label>
        <span>{statusLabel(config.runtimeMode)} / {config.platform}</span>
        <label>Root Policy</label>
        <span>{statusLabel(config.projectRootPolicy.strategy)} · mac {config.projectRootPolicy.macPathStyle} · win {config.projectRootPolicy.windowsPathStyle}</span>
        <label>Live Path</label>
        <span>{providerSummary.liveSubmitAllowed ? "allowed" : "blocked"}</span>
        <label>Credentials</label>
        <span>{config.credentialStorage.mode}; secrets stored: {config.credentialStorage.storesSecrets ? "yes" : "no"}</span>
        <label>Contract</label>
        <span>{adapterSummary.providerAdapters.length} provider contract(s) · read-only · dry-run · provider locked</span>
      </div>
      <div className="settings-group-title">Tools</div>
      <div className="settings-list">
        {tools.map((tool) => (
          <div key={tool.id}>
            <strong>{tool.label}</strong>
            <small>{statusLabel(tool.status)}{tool.path ? ` · ${tool.path}` : ""}{tool.version ? ` · ${tool.version}` : ""}</small>
          </div>
        ))}
      </div>
      <div className="settings-group-title">Sidecar Policy</div>
      <div className="settings-list">
        <div>
          <strong>Arbitrary shell</strong>
          <small>{sidecar.arbitraryShellExecution}; {sidecar.providerLiveSubmit} provider live path</small>
        </div>
        <div>
          <strong>Allowed commands</strong>
          <small>{sidecar.allowedCommands.map((command) => command.executable).join(", ") || "none"}</small>
        </div>
        <div>
          <strong>Filesystem scope</strong>
          <small>{sidecar.filesystemScope.map(statusLabel).join(", ")}</small>
        </div>
      </div>
      <div className="settings-group-title">Provider Enablement</div>
      <div className="settings-list">
        {providerSlots.map((slot) => (
          <div key={slot.slot}>
            <strong>{slot.slot}</strong>
            <small>{slot.state} · live path {slot.liveSubmitAllowed ? "allowed" : "blocked"} · {(slot.allowedProviders.length ? slot.allowedProviders : ["planned"]).join(", ")}</small>
          </div>
        ))}
      </div>
      <div className="settings-group-title">Provider Adapter Shell</div>
      <div className="settings-list adapter-settings-list">
        <div className="settings-readonly-note">
          <strong>Adapter Contract Status</strong>
          <small>
            {adapterSummary.activeImageProvider || "no active image provider"} · {adapterSummary.parkedVideoProviders.length} parked video provider(s) · {adapterSummary.contractViolations.length} violation(s)
          </small>
        </div>
        {providerAdapters.map((adapter) => (
          <div key={adapter.id}>
            <strong>{adapter.label}</strong>
            <small>
              {adapter.slot} / {adapter.requiredMode} · {adapter.state} · credentials {credentials[adapter.providerId] ? "configured" : adapter.credentialStatus}
            </small>
            <small>
              start/end {String(adapter.supports.startEndFrame)} · t2v {String(adapter.supports.textToVideo)} · fast {String(adapter.supports.fastModel)} · VIP {String(adapter.supports.vipChannel)}
            </small>
          </div>
        ))}
        {!providerAdapters.length && (
          <div>
            <strong>No adapters configured</strong>
            <small>Runtime defaults will provide read-only adapter shells.</small>
          </div>
        )}
      </div>
      <div className="settings-group-title">Provider Config</div>
      <div className="settings-list provider-config-settings-list">
        {providerConfigs.map((providerConfig) => {
          const localCredential = credentials[providerConfig.providerId];
          const keyStatus = localCredential?.hasKey
            ? "configured via local settings"
            : providerConfig.credential.keyStatus === "not_required"
              ? "not required"
            : providerConfig.credential.keyStatus === "configured"
              ? `configured via ${providerConfig.credential.source}`
              : "not configured";
          const modelLine = providerConfig.ttsModel
            ? `${providerConfig.baseUrl} · tts ${providerConfig.ttsModel} · ${providerConfig.endpointMode || "tts"}`
            : `${providerConfig.baseUrl} · image ${providerConfig.imageModel || "not configured"}${providerConfig.chatModel ? ` · chat ${providerConfig.chatModel}` : ""}`;
          return (
            <div key={providerConfig.providerId}>
              <strong>{providerConfig.label}</strong>
              <small>{providerConfig.providerId} · {providerConfig.source || "default"}</small>
              <small>{modelLine}</small>
              {providerConfig.concurrencyPolicy ? (
                <small>
                  reference edit concurrency {providerConfig.concurrencyPolicy.imageEditMaxConcurrency} · retries {providerConfig.concurrencyPolicy.imageEditMaxAutoRetries}
                </small>
              ) : null}
              {providerConfig.ttsConcurrencyPolicy ? (
                <small>
                  tts concurrency {providerConfig.ttsConcurrencyPolicy.maxConcurrentJobs} · retries {providerConfig.ttsConcurrencyPolicy.maxAutoRetries}
                </small>
              ) : null}
              {providerConfig.localCommand ? (
                <small>
                  local env {providerConfig.localCommand.commandEnvKey} · {providerConfig.localCommand.modelDirEnvKey} · {providerConfig.localCommand.speakerWavEnvKey}
                </small>
              ) : null}
              {providerConfig.cloudEndpoint ? (
                <small>
                  cloud env {providerConfig.cloudEndpoint.baseUrlEnvKey} · {providerConfig.cloudEndpoint.modelEnvKey} · {providerConfig.cloudEndpoint.voiceIdEnvKey}
                </small>
              ) : null}
              <small>key {keyStatus}{localCredential?.maskedKey ? ` · ${localCredential.maskedKey}` : ""} · raw secret hidden</small>
            </div>
          );
        })}
        {!providerConfigs.length && (
          <div>
            <strong>No provider config</strong>
            <small>Runtime defaults will provide local settings and environment status.</small>
          </div>
        )}
      </div>
      <div className="settings-group-title">Knowledge Pack Manager</div>
      <div className="settings-list knowledge-settings-summary">
        <div className="settings-readonly-note">
          <strong>Knowledge Pack Manager readiness: {knowledgeSummary.readiness}</strong>
          <small>{knowledgeSummary.enabledTotal} enabled / total · {knowledgeSummary.injectedUnique} injected / unique</small>
          <small>warnings / blockers {knowledgeSummary.warningBlockerCount} · budget {knowledgeSummary.budgetUsed} tokens</small>
          <small>{knowledgeSummary.hardLockReminder}</small>
        </div>
      </div>
      <div className="settings-group-title">Agent Web Search</div>
      <div className="settings-list web-search-settings-list">
        <div className="settings-readonly-note">
          <strong>{resolvedWebSearchSettings.enabled ? "查资料已开启" : "查资料未开启"}</strong>
          <small>{agentWebSearchSourceLabel(resolvedWebSearchSettings)} · 结果只作为待确认研究卡，不会直接写入项目。</small>
        </div>
        <div className="web-search-settings-form">
          <label>
            <span>允许 Agent 先查资料</span>
            <input
              type="checkbox"
              checked={resolvedWebSearchSettings.enabled}
              onChange={(event) => updateWebSearchSettings({ enabled: event.currentTarget.checked })}
            />
          </label>
          <label>
            <span>来源</span>
            <select
              value={resolvedWebSearchSettings.provider}
              onChange={(event) => updateWebSearchSettings({
                provider: event.currentTarget.value as AgentWebSearchProvider,
                allowNetwork: event.currentTarget.value === "mock" ? false : resolvedWebSearchSettings.allowNetwork,
              })}
            >
              <option value="mock">本地演示</option>
              <option value="tavily_search">联网资料</option>
              <option value="searxng_json">本地搜索服务</option>
              <option value="duckduckgo_instant_answer">公开搜索</option>
            </select>
          </label>
          <label>
            <span>联网</span>
            <input
              type="checkbox"
              disabled={resolvedWebSearchSettings.provider === "mock"}
              checked={resolvedWebSearchSettings.provider !== "mock" && resolvedWebSearchSettings.allowNetwork}
              onChange={(event) => updateWebSearchSettings({ allowNetwork: event.currentTarget.checked })}
            />
          </label>
          <label>
            <span>最多来源</span>
            <input
              type="number"
              min={1}
              max={5}
              value={resolvedWebSearchSettings.maxResults}
              onChange={(event) => updateWebSearchSettings({ maxResults: Number(event.currentTarget.value) })}
            />
          </label>
          <label className="web-search-endpoint-field">
            <span>本地搜索地址</span>
            <input
              value={resolvedWebSearchSettings.endpoint}
              placeholder="http://127.0.0.1:8080/search"
              onChange={(event) => updateWebSearchSettings({ endpoint: event.currentTarget.value })}
            />
          </label>
        </div>
      </div>
      <div className="settings-group-title">Agent/CLI Mock Runner</div>
      <div className="settings-list agent-cli-settings-summary">
        <div className="settings-readonly-note">
          <strong>Agent/CLI Mock Runner readiness: {agentCliMockRunnerSummary.readiness}</strong>
          <small>{agentCliMockRunnerSummary.runnerKind} · replacement proof {agentCliMockRunnerSummary.replacementProof} · adapter boundary mock/no-op only · {agentCliMockRunnerSummary.noopResultCount} no-op result(s)</small>
        </div>
      </div>
      <div className="settings-group-title">Agent CLI Adapter Spike</div>
      <div className="settings-list agent-cli-adapter-settings-summary">
        <div className="settings-readonly-note">
          <strong>Agent CLI Adapter readiness: {cliAdapterSpikeSummary.readiness}</strong>
          <small>{cliAdapterSpikeSummary.contractMode} · {cliAdapterSpikeSummary.inputSource} · spawn/resume {cliAdapterSpikeSummary.spawnResumeShape} · provider submit {cliAdapterSpikeSummary.providerSubmit}</small>
        </div>
      </div>
      <div className="settings-group-title">Export Worker</div>
      <div className="settings-list export-worker-settings-summary">
        <div className="settings-readonly-note">
          <strong>Export Worker readiness: {exportWorkerSummary.readiness}</strong>
          <small>export IO scope {exportWorkerSummary.scope} · planned writes {exportWorkerSummary.plannedWriteCount} · root {exportWorkerSummary.exportRoot}</small>
        </div>
      </div>
      <div className="settings-group-title">Voice/Audio Settings</div>
      <div className="settings-list voice-audio-settings-summary">
        <div className="settings-readonly-note">
          <strong>Voice/Audio Settings readiness: {voiceAudioSettingsSummary.readiness}</strong>
          <small>{voiceAudioSettingsSummary.voiceSourceCount} source(s) · {voiceAudioSettingsSummary.audioPlanCount} audio plan(s) · no BGM {voiceAudioSettingsSummary.noBgmPolicy ? "on" : "off"} · provider live {voiceAudioSettingsSummary.providerSlotsLive}</small>
        </div>
      </div>
      <div className="settings-group-title">Real Pilot / 真实小样</div>
      <div className="settings-list real-pilot-settings-summary">
        <div className="settings-readonly-note">
          <strong>Real Pilot / 真实小样: {realPilotSummary.reviewStatus}</strong>
          <small>{realPilotSummary.image2State} · {realPilotSummary.seedanceState} · {realPilotSummary.confirmationState}</small>
          <small>selected shots {realPilotSummary.selectedShotCount} · first-frame control {realPilotSummary.framePairValue} · estimated outputs {realPilotSummary.estimatedOutputCount}</small>
          <small>output root {realPilotSummary.outputRoot}</small>
          <small>执行前确认 {realPilotSummary.preConfirmState} · 预算上限 {realPilotSummary.preConfirmBudgetLimit} · 输出监听 {realPilotSummary.preConfirmOutputWatch} · 请求预览 {realPilotSummary.preConfirmRequestPreview}</small>
          <small>单次确认 {realPilotSummary.oneShotStatus} · {realPilotSummary.oneShotConfirmation} · {realPilotSummary.oneShotActionScope}</small>
        </div>
      </div>
      <div className="settings-group-title">Provider Enablement Gate</div>
      <div className="settings-list provider-enable-gate-settings-summary">
        <div className="settings-readonly-note">
          <strong>Provider Enablement Gate readiness: {providerEnablementGateSummary.readiness}</strong>
          <small>{providerEnablementGateSummary.readyForConfirmation} ready_for_confirmation · {providerEnablementGateSummary.blocked} blocked · {providerEnablementGateSummary.parked} parked · {providerEnablementGateSummary.submitBlocked}</small>
        </div>
      </div>
      <div className="settings-group-title">Provider Execution Permission Gate</div>
      <div className="settings-list provider-execution-permission-settings-summary">
        <div className="settings-readonly-note">
          <strong>Provider Execution Permission readiness: {providerExecutionPermissionGateSummary.readiness}</strong>
          <small>{providerExecutionPermissionGateSummary.readyForUserReview} reviewable · {providerExecutionPermissionGateSummary.blocked} blocked · {providerExecutionPermissionGateSummary.providerSubmit} · {providerExecutionPermissionGateSummary.automaticSubmit}</small>
        </div>
      </div>
      <div className="settings-group-title">Provider Action Confirmation Receipt</div>
      <div className="settings-list provider-action-confirmation-settings-summary">
        <div className="settings-readonly-note">
          <strong>Provider Action Confirmation readiness: {providerActionConfirmationReceiptSummary.readiness}</strong>
          <small>{providerActionConfirmationReceiptSummary.readyReceipts} ready receipt(s) · {providerActionConfirmationReceiptSummary.blocked} blocked · {providerActionConfirmationReceiptSummary.parked} parked · {providerActionConfirmationReceiptSummary.confirmedCount} confirmed</small>
          <small>{providerActionConfirmationReceiptSummary.providerSubmitBlocked} · {providerActionConfirmationReceiptSummary.credentialWorkerFileLocked}</small>
        </div>
      </div>
      <div className="settings-group-title">Provider Execution Handoff</div>
      <div className="settings-list provider-execution-handoff-settings-summary">
        <div className="settings-readonly-note">
          <strong>Provider Execution Handoff readiness: {providerExecutionHandoffSummary.readiness}</strong>
          <small>{providerExecutionHandoffSummary.handoffCount} handoff(s) · {providerExecutionHandoffSummary.blockedCount} blocked · {providerExecutionHandoffSummary.confirmedCount} confirmed</small>
          <small>{providerExecutionHandoffSummary.providerSubmitLocked} · {providerExecutionHandoffSummary.credentialWorkerFileLocked}</small>
        </div>
      </div>
      <div className="settings-group-title">Local Orchestrator</div>
      <div className="settings-list local-orchestrator-settings-summary">
        <div className="settings-readonly-note">
          <strong>Local Orchestrator: {localOrchestratorSummary.readiness}</strong>
          <small>{localOrchestratorSummary.queueTotal} total · {localOrchestratorSummary.ready} ready · {localOrchestratorSummary.waiting} waiting · next ready {localOrchestratorSummary.nextReadyCount}</small>
          <small>{localOrchestratorSummary.runningPlanned} running planned · {localOrchestratorSummary.waitingOutput} waiting output · {localOrchestratorSummary.qaPending} QA pending · {localOrchestratorSummary.needsReview} needs review</small>
          <small>{localOrchestratorSummary.blocked} blocked · {localOrchestratorSummary.failed} failed · {localOrchestratorSummary.completeVerified} complete verified</small>
          <small>{localOrchestratorSummary.autoContinueMode} · {localOrchestratorSummary.providerFileDaemonLocks}</small>
          <small>hard locks {localOrchestratorSummary.hardLocks.length}</small>
        </div>
      </div>
      <div className="settings-group-title">Visual Consistency Contract</div>
      <div className="settings-list visual-consistency-settings-summary">
        <div className="settings-readonly-note">
          <strong>Visual Consistency Contract: {visualConsistencySummary.readiness}</strong>
          <small>{visualConsistencySummary.gateStatus} · shot layout {visualConsistencySummary.shotLayoutStatus}</small>
          <small>{visualConsistencySummary.geometryStatus} · {visualConsistencySummary.keyframePairStatus}</small>
          <small>{visualConsistencySummary.driftRepairStatus}</small>
        </div>
      </div>
      <div className="settings-group-title">Full Task Subagent Packet Planner</div>
      <div className="settings-list full-task-subagent-packet-planner-settings-summary">
        <div className="settings-readonly-note">
          <strong>Full Task Subagent Packet Planner: {fullTaskSubagentPacketPlannerSummary.readiness}</strong>
          <small>{fullTaskSubagentPacketPlannerSummary.coverageStatus} · {fullTaskSubagentPacketPlannerSummary.packetStatus}</small>
          <small>{fullTaskSubagentPacketPlannerSummary.outputStatus} · {fullTaskSubagentPacketPlannerSummary.traceStatus}</small>
          <small>{fullTaskSubagentPacketPlannerSummary.freeTextStatus} · {fullTaskSubagentPacketPlannerSummary.routeStatus}</small>
        </div>
      </div>
      <div className="settings-group-title">Phase 39 Knowledge Pack User Management</div>
      <div className="settings-list knowledge-pack-user-management-settings-summary">
        <div className="settings-readonly-note">
          <strong>Phase 39 Knowledge Pack User Management: {knowledgePackUserManagementSummary.readiness}</strong>
          <small>{knowledgePackUserManagementSummary.userFlowStatus} · {knowledgePackUserManagementSummary.checkStatus}</small>
          <small>{knowledgePackUserManagementSummary.routeConflictStatus} · {knowledgePackUserManagementSummary.overrideStatus}</small>
          <small>{knowledgePackUserManagementSummary.injectionStatus} · {knowledgePackUserManagementSummary.promotionStatus}</small>
        </div>
      </div>
      <div className="settings-group-title">Phase 40 Worker Runtime Gate</div>
      <div className="settings-list worker-runtime-gate-settings-summary">
        <div className="settings-readonly-note">
          <strong>Phase 40 Worker Runtime Gate: {workerRuntimeGateSummary.readiness}</strong>
          <small>{workerRuntimeGateSummary.contractStatus} · {workerRuntimeGateSummary.gateStatus}</small>
          <small>validated envelope {workerRuntimeGateSummary.inputStatus} · structured result {workerRuntimeGateSummary.outputStatus}</small>
          <small>spawn/resume/daemon/shell/credential/file/provider submit {workerRuntimeGateSummary.executionStatus}</small>
        </div>
      </div>
      <div className="settings-group-title">Phase 41 Provider Closed-loop Shell</div>
      <div className="settings-list provider-closed-loop-shell-settings-summary">
        <div className="settings-readonly-note">
          <strong>Phase 41 Provider Closed-loop Shell: {providerClosedLoopShellSummary.readiness}</strong>
          <small>{providerClosedLoopShellSummary.shellStatus} · watcher {providerClosedLoopShellSummary.watcherStatus} · manifest {providerClosedLoopShellSummary.manifestStatus}</small>
          <small>{providerClosedLoopShellSummary.qaStatus} · {providerClosedLoopShellSummary.promotionStatus}</small>
          <small>provider submit/live submit/credential/shell safety {providerClosedLoopShellSummary.safetyStatus}</small>
        </div>
      </div>
      <div className="settings-group-title">Phase 42 Beta Acceptance</div>
      <div className="settings-list beta-acceptance-settings-summary">
        <div className="settings-readonly-note">
          <strong>Phase 42 Beta Acceptance: {betaAcceptanceSummary.readiness}</strong>
          <small>{betaAcceptanceSummary.desktopStatus} · {betaAcceptanceSummary.projectExportStatus}</small>
          <small>{betaAcceptanceSummary.runtimeGateStatus} · {betaAcceptanceSummary.providerStatus}</small>
          <small>{betaAcceptanceSummary.testStatus} · {betaAcceptanceSummary.closureStatus}</small>
        </div>
      </div>
      <div className="settings-group-title">Voice Source Library (dry-run)</div>
      <div className="settings-list">
        <div className="settings-readonly-note">
          <strong>{voiceLibrary.summary.locked} locked · {voiceLibrary.summary.candidate} candidate · {voiceLibrary.summary.rejected} rejected</strong>
          <small>No credentials · no sample copy · no TTS/music submit · no BGM in video provider prompts.</small>
        </div>
        {voiceSources.slice(0, 6).map((source) => (
          <div key={source.id}>
            <strong>{source.displayName}</strong>
            <small>
              {source.status} · {statusLabel(source.role)} · {source.provider} · consent {statusLabel(source.consentStatus)} · commercial {statusLabel(source.commercialUseStatus)}
            </small>
          </div>
        ))}
        {voiceSources.length > 6 && (
          <div>
            <strong>{voiceSources.length - 6} more source(s)</strong>
            <small>Hidden here to keep Settings compact.</small>
          </div>
        )}
      </div>
      <div className="settings-group-title">Provider Credentials</div>
      <div className="settings-list credential-settings-list">
        <div className="settings-readonly-note">
          <small>API keys are stored in ~/.vibe-director/credentials.json. Credential read is allowed for settings display only. Provider submit remains locked.</small>
        </div>
        {credentialProviderIds.length > 0 && (
          <div>
            <strong>Configured Providers</strong>
            <small>{credentialProviderIds.length} provider(s) with stored keys</small>
          </div>
        )}
        {credentialProviderIds.map((pid) => {
          const entry = credentials[pid];
          return (
            <div key={pid}>
              <strong>{entry.label || entry.providerId}</strong>
              <small>{entry.maskedKey} · updated {entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : "unknown"}</small>
              <button className="credential-delete-btn" onClick={async () => { await handleDeleteCredential(pid); }}>Delete</button>
            </div>
          );
        })}
        {!credentialProviderIds.length && (
          <div>
            <strong>No credentials configured</strong>
            <small>Add a provider API key below to get started.</small>
          </div>
        )}
        <div className="credential-add-form">
          <strong>Add Credential</strong>
          <select value={credFormProviderId} onChange={(e) => setCredFormProviderId(e.currentTarget.value)}>
            <option value="">Select provider...</option>
            {credentialOptions.map((adapter) => (
              <option key={adapter.providerId} value={adapter.providerId}>{adapter.label} ({adapter.providerId})</option>
            ))}
            {!credentialOptions.length && <option value="openai-image2-agent-cli">OpenAI Image2 (Agent CLI)</option>}
            {!credentialOptions.length && <option value="openai-image2-api">OpenAI Image2 (API)</option>}
            {!credentialOptions.some((option) => option.providerId === "tavily-search") && <option value="tavily-search">Tavily Search</option>}
          </select>
          <input type="password" placeholder="API Key" value={credFormApiKey} onChange={(e) => setCredFormApiKey(e.currentTarget.value)} />
          <button
            disabled={!credFormProviderId || !credFormApiKey || credFormSaving}
            onClick={async () => {
              if (!credFormProviderId || !credFormApiKey) return;
              setCredFormSaving(true);
              try { await handleSaveCredential(credFormProviderId, credFormApiKey, credFormProviderId); setCredFormApiKey(""); setCredFormProviderId(""); }
              finally { setCredFormSaving(false); }
            }}
          >
            {credFormSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      </details>
    </section>
  );
}
