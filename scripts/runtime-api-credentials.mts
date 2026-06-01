import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";

const credDir = path.join(homedir(), ".vibe-director");
const credFile = path.join(credDir, "credentials.json");
const lanyiProviderId = "lanyi-image2";
const lanyiProviderAliases = [lanyiProviderId, "lanyiapi-gpt-image-2", "openai-image2-api"];
const deepseekProviderId = "deepseek-v4-pro";
const deepseekProviderAliases = [deepseekProviderId, "deepseek", "deepseek-v4", "deepseek-chat"];
const apikeyFunProviderId = "apikey-fun-gpt55-responses-image";
const apikeyFunProviderAliases = [apikeyFunProviderId, "apikey-fun", "apikey_fun", "gpt55-responses-image"];
const tavilyProviderId = "tavily-search";
const tavilyProviderAliases = [tavilyProviderId, "tavily_search", "tavily"];
const cloudTtsProviderId = "cloud-tts";
const cloudTtsProviderAliases = [cloudTtsProviderId, "tts-cloud", "audio-tts"];

export interface ProviderCredential {
  providerId: string;
  apiKey: string;
  label?: string;
  updatedAt: string;
}

export interface CredentialStore {
  schemaVersion: string;
  providers: Record<string, ProviderCredential>;
}

export interface ProviderConfigStatus {
  providerId: string;
  label: string;
  baseUrl: string;
  imageModel?: string;
  chatModel?: string;
  ttsModel?: string;
  endpointMode?: "responses_api" | "search_api" | "local_cli" | "cloud_api";
  localCommand?: {
    commandEnvKey: string;
    modelDirEnvKey: string;
    speakerWavEnvKey: string;
    expectedOutputFormat: "wav";
  };
  cloudEndpoint?: {
    baseUrlEnvKey: string;
    modelEnvKey: string;
    voiceIdEnvKey: string;
    expectedOutputFormat: "wav" | "mp3";
  };
  source: "default" | "environment" | "local_settings";
  credential: {
    envKey: string;
    keyStatus: "configured" | "not_configured" | "not_required";
    source: "environment" | "local_settings" | "none";
    secretDisplayed: false;
  };
}

function ensureDir() {
  if (!existsSync(credDir)) mkdirSync(credDir, { recursive: true, mode: 0o700 });
  try { chmodSync(credDir, 0o700); } catch { /* Best effort on non-POSIX filesystems. */ }
}

export function readCredentials(): CredentialStore {
  ensureDir();
  if (!existsSync(credFile)) return { schemaVersion: "0.1.0", providers: {} };
  try { return JSON.parse(readFileSync(credFile, "utf8")); }
  catch { return { schemaVersion: "0.1.0", providers: {} }; }
}

export function writeCredentials(store: CredentialStore): void {
  ensureDir();
  writeFileSync(credFile, JSON.stringify(store, null, 2), { encoding: "utf8", mode: 0o600 });
  try { chmodSync(credFile, 0o600); } catch { /* Best effort on non-POSIX filesystems. */ }
}

export function setProviderCredential(providerId: string, apiKey: string, label?: string): ProviderCredential {
  const store = readCredentials();
  const entry: ProviderCredential = { providerId, apiKey, label: label || providerId, updatedAt: new Date().toISOString() };
  store.providers[providerId] = entry;
  writeCredentials(store);
  return entry;
}

export function removeProviderCredential(providerId: string): void {
  const store = readCredentials();
  delete store.providers[providerId];
  writeCredentials(store);
}

export function getMaskedKey(apiKey: string): string {
  if (apiKey.length <= 4) return "****";
  return "****" + apiKey.slice(-4);
}

export function getAllCredentials(): Record<string, { providerId: string; label?: string; updatedAt: string; maskedKey: string; hasKey: boolean }> {
  const store = readCredentials();
  const result: Record<string, ReturnType<typeof getAllCredentials>[string]> = {};
  for (const [id, cred] of Object.entries(store.providers)) {
    result[id] = { providerId: cred.providerId, label: cred.label, updatedAt: cred.updatedAt, maskedKey: getMaskedKey(cred.apiKey), hasKey: true };
  }
  return result;
}

export function getProviderApiKey(providerId: string): string | undefined {
  const providers = readCredentials().providers;
  if (providerId === apikeyFunProviderId || apikeyFunProviderAliases.includes(providerId)) {
    const envKey = envValue("VIBE_APIKEY_FUN_API_KEY") || envValue("APIKEY_FUN_API_KEY");
    if (envKey) return envKey;
    const credential = apikeyFunProviderAliases.map((alias) => providers[alias]).find(Boolean);
    return credential?.apiKey?.trim() || undefined;
  }
  if (providerId === tavilyProviderId || tavilyProviderAliases.includes(providerId)) {
    const envKey = envValue("VIBE_TAVILY_API_KEY") || envValue("TAVILY_API_KEY");
    if (envKey) return envKey;
    const credential = tavilyProviderAliases.map((alias) => providers[alias]).find(Boolean);
    return credential?.apiKey?.trim() || undefined;
  }
  if (providerId === cloudTtsProviderId || cloudTtsProviderAliases.includes(providerId)) {
    const envKey = envValue("VIBE_TTS_API_KEY");
    if (envKey) return envKey;
    const credential = cloudTtsProviderAliases.map((alias) => providers[alias]).find(Boolean);
    return credential?.apiKey?.trim() || undefined;
  }
  if (providerId === deepseekProviderId || deepseekProviderAliases.includes(providerId)) {
    const envKey = envValue("VIBE_DEEPSEEK_API_KEY") || envValue("DEEPSEEK_API_KEY");
    if (envKey) return envKey;
    const credential = deepseekProviderAliases.map((alias) => providers[alias]).find(Boolean);
    return credential?.apiKey?.trim() || undefined;
  }

  const envKey = envValue("VIBE_IMAGE2_API_KEY");
  if (envKey) return envKey;
  const credential = providers[providerId]
    || (providerId === lanyiProviderId
      ? lanyiProviderAliases.map((alias) => providers[alias]).find(Boolean)
      : undefined);
  return credential?.apiKey?.trim() || undefined;
}

function envValue(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function envOrDefault(name: string, fallback: string) {
  return envValue(name) || fallback;
}

export function getProviderConfigStatuses(): ProviderConfigStatus[] {
  const credentials = getAllCredentials();
  const providerId = lanyiProviderId;
  const hasLocalKey = lanyiProviderAliases.some((alias) => credentials[alias]?.hasKey === true);
  const hasEnvKey = Boolean(envValue("VIBE_IMAGE2_API_KEY"));
  const hasEnvConfig = Boolean(envValue("VIBE_IMAGE2_BASE_URL") || envValue("VIBE_IMAGE2_MODEL") || envValue("VIBE_CHAT_MODEL"));
  const hasApikeyFunLocalKey = apikeyFunProviderAliases.some((alias) => credentials[alias]?.hasKey === true);
  const hasApikeyFunEnvKey = Boolean(envValue("VIBE_APIKEY_FUN_API_KEY") || envValue("APIKEY_FUN_API_KEY"));
  const hasApikeyFunEnvConfig = Boolean(
    envValue("VIBE_APIKEY_FUN_RESPONSES_ENDPOINT")
    || envValue("APIKEY_FUN_RESPONSES_ENDPOINT")
    || envValue("VIBE_APIKEY_FUN_IMAGE_MODEL")
    || envValue("APIKEY_FUN_IMAGE_MODEL")
  );
  const hasTavilyLocalKey = tavilyProviderAliases.some((alias) => credentials[alias]?.hasKey === true);
  const hasTavilyEnvKey = Boolean(envValue("VIBE_TAVILY_API_KEY") || envValue("TAVILY_API_KEY"));
  const hasCloudTtsLocalKey = cloudTtsProviderAliases.some((alias) => credentials[alias]?.hasKey === true);
  const hasCloudTtsEnvKey = Boolean(envValue("VIBE_TTS_API_KEY"));
  const hasCloudTtsEnvConfig = Boolean(envValue("VIBE_TTS_BASE_URL") || envValue("VIBE_TTS_MODEL") || envValue("VIBE_TTS_VOICE_ID"));
  const hasIndexTtsEnvConfig = Boolean(envValue("VIBE_INDEX_TTS_COMMAND") || envValue("VIBE_INDEX_TTS_MODEL_DIR") || envValue("VIBE_INDEX_TTS_SPEAKER_WAV"));
  const hasDeepseekLocalKey = deepseekProviderAliases.some((alias) => credentials[alias]?.hasKey === true);
  const hasDeepseekEnvKey = Boolean(envValue("VIBE_DEEPSEEK_API_KEY") || envValue("DEEPSEEK_API_KEY"));
  const hasDeepseekEnvConfig = Boolean(envValue("VIBE_DEEPSEEK_BASE_URL") || envValue("VIBE_DEEPSEEK_CHAT_MODEL") || envValue("VIBE_CHAT_MODEL"));

  return [
    {
      providerId: deepseekProviderId,
      label: "DeepSeek v4 Pro",
      baseUrl: envOrDefault("VIBE_DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
      chatModel: envValue("VIBE_DEEPSEEK_CHAT_MODEL") || envValue("VIBE_CHAT_MODEL") || "deepseek-v4-pro",
      endpointMode: "cloud_api",
      source: hasDeepseekEnvConfig ? "environment" : "default",
      credential: {
        envKey: "VIBE_DEEPSEEK_API_KEY",
        keyStatus: hasDeepseekEnvKey || hasDeepseekLocalKey ? "configured" : "not_configured",
        source: hasDeepseekEnvKey ? "environment" : hasDeepseekLocalKey ? "local_settings" : "none",
        secretDisplayed: false,
      },
    },
    {
      providerId,
      label: "Lanyi Image2",
      baseUrl: envOrDefault("VIBE_IMAGE2_BASE_URL", "https://lanyiapi.com"),
      imageModel: envOrDefault("VIBE_IMAGE2_MODEL", "gpt-image-2"),
      chatModel: envOrDefault("VIBE_CHAT_MODEL", "claude-opus-4-6"),
      source: hasEnvConfig ? "environment" : "default",
      credential: {
        envKey: "VIBE_IMAGE2_API_KEY",
        keyStatus: hasEnvKey || hasLocalKey ? "configured" : "not_configured",
        source: hasEnvKey ? "environment" : hasLocalKey ? "local_settings" : "none",
        secretDisplayed: false,
      },
    },
    {
      providerId: apikeyFunProviderId,
      label: "Apikey.fun GPT-5.5 Images",
      baseUrl: envValue("VIBE_APIKEY_FUN_RESPONSES_ENDPOINT")
        || envValue("APIKEY_FUN_RESPONSES_ENDPOINT")
        || "https://api.apikey.fun/v1/responses",
      imageModel: envValue("VIBE_APIKEY_FUN_IMAGE_MODEL") || envValue("APIKEY_FUN_IMAGE_MODEL") || "gpt-5.5",
      endpointMode: "responses_api",
      source: hasApikeyFunEnvConfig ? "environment" : "default",
      credential: {
        envKey: "VIBE_APIKEY_FUN_API_KEY",
        keyStatus: hasApikeyFunEnvKey || hasApikeyFunLocalKey ? "configured" : "not_configured",
        source: hasApikeyFunEnvKey ? "environment" : hasApikeyFunLocalKey ? "local_settings" : "none",
        secretDisplayed: false,
      },
    },
    {
      providerId: tavilyProviderId,
      label: "Tavily Search",
      baseUrl: envOrDefault("VIBE_TAVILY_BASE_URL", "https://api.tavily.com"),
      imageModel: "search",
      endpointMode: "search_api",
      source: envValue("VIBE_TAVILY_BASE_URL") ? "environment" : "default",
      credential: {
        envKey: "VIBE_TAVILY_API_KEY",
        keyStatus: hasTavilyEnvKey || hasTavilyLocalKey ? "configured" : "not_configured",
        source: hasTavilyEnvKey ? "environment" : hasTavilyLocalKey ? "local_settings" : "none",
        secretDisplayed: false,
      },
    },
    {
      providerId: "local-index-tts",
      label: "Local IndexTTS",
      baseUrl: "local://index-tts",
      ttsModel: envOrDefault("VIBE_INDEX_TTS_MODEL", "IndexTTS"),
      endpointMode: "local_cli",
      localCommand: {
        commandEnvKey: "VIBE_INDEX_TTS_COMMAND",
        modelDirEnvKey: "VIBE_INDEX_TTS_MODEL_DIR",
        speakerWavEnvKey: "VIBE_INDEX_TTS_SPEAKER_WAV",
        expectedOutputFormat: "wav",
      },
      source: hasIndexTtsEnvConfig ? "environment" : "default",
      credential: {
        envKey: "VIBE_INDEX_TTS_COMMAND",
        keyStatus: "not_required",
        source: "none",
        secretDisplayed: false,
      },
    },
    {
      providerId: cloudTtsProviderId,
      label: "Cloud TTS",
      baseUrl: envOrDefault("VIBE_TTS_BASE_URL", "https://api.example-tts.invalid"),
      ttsModel: envOrDefault("VIBE_TTS_MODEL", "cloud-tts-default"),
      endpointMode: "cloud_api",
      cloudEndpoint: {
        baseUrlEnvKey: "VIBE_TTS_BASE_URL",
        modelEnvKey: "VIBE_TTS_MODEL",
        voiceIdEnvKey: "VIBE_TTS_VOICE_ID",
        expectedOutputFormat: "mp3",
      },
      source: hasCloudTtsEnvConfig ? "environment" : "default",
      credential: {
        envKey: "VIBE_TTS_API_KEY",
        keyStatus: hasCloudTtsEnvKey || hasCloudTtsLocalKey ? "configured" : "not_configured",
        source: hasCloudTtsEnvKey ? "environment" : hasCloudTtsLocalKey ? "local_settings" : "none",
        secretDisplayed: false,
      },
    },
  ];
}
