import {
  fetchRuntimeJson,
  isRecord,
  projectRuntimeBasePath,
  stringOrUndefined,
} from "./runtimeApiClient";

// TODO: encrypt credentials at rest using keychain (macOS) / DPAPI (Windows).
// Currently stored as plaintext JSON in ~/.vibe-director/credentials.json.
export const credentialsEndpoint = `${projectRuntimeBasePath}/credentials`;

export interface CredentialEntry {
  providerId: string;
  label?: string;
  updatedAt: string;
  maskedKey: string;
  hasKey: boolean;
}

export interface CredentialsSnapshot {
  [providerId: string]: CredentialEntry;
}

export interface ProviderConfigStatus {
  providerId: string;
  label?: string;
  baseUrl?: string;
  imageModel?: string;
  chatModel?: string;
  ttsModel?: string;
  endpointMode?: string;
  localCommand?: {
    commandEnvKey?: string;
    modelDirEnvKey?: string;
    speakerWavEnvKey?: string;
    expectedOutputFormat?: string;
  };
  cloudEndpoint?: {
    baseUrlEnvKey?: string;
    modelEnvKey?: string;
    voiceIdEnvKey?: string;
    expectedOutputFormat?: string;
  };
  source?: string;
  credential?: {
    envKey?: string;
    keyStatus?: string;
    source?: string;
    secretDisplayed?: false;
  };
}

function isCredentialEntry(value: unknown): value is CredentialEntry {
  return isRecord(value)
    && typeof value.providerId === "string"
    && typeof value.maskedKey === "string"
    && value.hasKey === true;
}

function normalizeCredentialsSnapshot(payload: unknown): CredentialsSnapshot {
  const source = isRecord(payload) && isRecord(payload.credentials) ? payload.credentials : payload;
  if (!isRecord(source)) return {};
  const credentials: CredentialsSnapshot = {};
  for (const [providerId, entry] of Object.entries(source)) {
    if (isCredentialEntry(entry)) credentials[providerId] = entry;
  }
  return credentials;
}

function normalizeProviderConfigStatuses(payload: unknown): ProviderConfigStatus[] {
  const source = isRecord(payload) && Array.isArray(payload.providerConfigs) ? payload.providerConfigs : [];
  return source
    .filter(isRecord)
    .map((entry) => ({
      providerId: stringOrUndefined(entry.providerId) || "unknown",
      label: stringOrUndefined(entry.label),
      baseUrl: stringOrUndefined(entry.baseUrl),
      imageModel: stringOrUndefined(entry.imageModel),
      chatModel: stringOrUndefined(entry.chatModel),
      ttsModel: stringOrUndefined(entry.ttsModel),
      endpointMode: stringOrUndefined(entry.endpointMode),
      localCommand: isRecord(entry.localCommand)
        ? {
            commandEnvKey: stringOrUndefined(entry.localCommand.commandEnvKey),
            modelDirEnvKey: stringOrUndefined(entry.localCommand.modelDirEnvKey),
            speakerWavEnvKey: stringOrUndefined(entry.localCommand.speakerWavEnvKey),
            expectedOutputFormat: stringOrUndefined(entry.localCommand.expectedOutputFormat),
          }
        : undefined,
      cloudEndpoint: isRecord(entry.cloudEndpoint)
        ? {
            baseUrlEnvKey: stringOrUndefined(entry.cloudEndpoint.baseUrlEnvKey),
            modelEnvKey: stringOrUndefined(entry.cloudEndpoint.modelEnvKey),
            voiceIdEnvKey: stringOrUndefined(entry.cloudEndpoint.voiceIdEnvKey),
            expectedOutputFormat: stringOrUndefined(entry.cloudEndpoint.expectedOutputFormat),
          }
        : undefined,
      source: stringOrUndefined(entry.source),
      credential: isRecord(entry.credential)
        ? {
            envKey: stringOrUndefined(entry.credential.envKey),
            keyStatus: stringOrUndefined(entry.credential.keyStatus),
            source: stringOrUndefined(entry.credential.source),
            secretDisplayed: entry.credential.secretDisplayed === false ? false as const : undefined,
          }
        : undefined,
    }))
    .filter((entry) => entry.providerId !== "unknown");
}

function normalizeCredentialEntry(payload: unknown): CredentialEntry | null {
  const source = isRecord(payload) && isRecord(payload.credential) ? payload.credential : payload;
  return isCredentialEntry(source) ? source : null;
}

export async function loadCredentials(): Promise<CredentialsSnapshot> {
  try {
    const payload = await fetchRuntimeJson(credentialsEndpoint);
    return normalizeCredentialsSnapshot(payload);
  } catch (error) {
    console.error("loadCredentials failed:", error);
    return {};
  }
}

export async function loadProviderConfigStatuses(): Promise<ProviderConfigStatus[]> {
  try {
    const payload = await fetchRuntimeJson(credentialsEndpoint);
    return normalizeProviderConfigStatuses(payload);
  } catch (error) {
    console.error("loadProviderConfigStatuses failed:", error);
    return [];
  }
}

// TODO: encrypt credentials at rest using keychain (macOS) / DPAPI (Windows)
export async function saveCredential(providerId: string, apiKey: string, label?: string): Promise<CredentialEntry | null> {
  try {
    const payload = await fetchRuntimeJson(credentialsEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerId, apiKey, label }),
    });
    return normalizeCredentialEntry(payload);
  } catch (error) {
    console.error("saveCredential failed:", error);
    return null;
  }
}

export async function deleteCredential(providerId: string): Promise<boolean> {
  try {
    await fetchRuntimeJson(`${credentialsEndpoint}?providerId=${encodeURIComponent(providerId)}`, { method: "DELETE" });
    return true;
  } catch (error) {
    console.error("deleteCredential failed:", error);
    return false;
  }
}
