import type { ElectronBridge } from "./electronBridge";

declare global {
  interface Window {
    __VIBE_RUNTIME_API_BASE_URL__?: string;
    vibeRuntime?: ElectronBridge;
  }

  interface ImportMeta {
    // WARNING: VITE_ prefixed env vars are baked into the build and should not contain secrets.
    env?: {
      VITE_VIBE_RUNTIME_API_BASE_URL?: string;
      VITE_VIBE_DIRECTOR_RUNTIME_API_TOKEN?: string;
      VITE_VIBE_CORE_RUNTIME_API_TOKEN?: string;
    };
  }
}

// localhost HTTP is acceptable for local IPC; credentials never leave the machine over this channel
export const defaultRuntimeApiBaseUrl = "http://127.0.0.1:8790";
export const projectRuntimeBasePath = "/api/runtime";
const runtimeStartupRetryMs = 5000;
const runtimeStartupRetryDelayMs = 200;
const runtimeReadyTimeoutMs = 15000;
const runtimeReadyPollMs = 250;

const runtimeReadyWaits = new Map<string, Promise<void>>();

export type ProjectRuntimeIdentity = {
  projectId?: string;
  projectRoot?: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function booleanOrUndefined(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function normalizeIdentityPart(value?: string) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

export function hasProjectRuntimeIdentity(value?: ProjectRuntimeIdentity) {
  return Boolean(String(value?.projectId || "").trim() || String(value?.projectRoot || "").trim());
}

export function currentProjectIdentityMatches(
  actual: { projectId?: string; projectRoot?: string },
  expected?: ProjectRuntimeIdentity,
) {
  const expectedProjectId = normalizeIdentityPart(expected?.projectId);
  const expectedProjectRoot = normalizeIdentityPart(expected?.projectRoot);
  const actualProjectId = normalizeIdentityPart(actual.projectId);
  const actualProjectRoot = normalizeIdentityPart(actual.projectRoot);

  if (!expectedProjectId && !expectedProjectRoot) return false;
  if (!actualProjectId && !actualProjectRoot) return false;

  if (expectedProjectRoot && actualProjectRoot) {
    if (expectedProjectRoot !== actualProjectRoot) return false;
    if (expectedProjectId && actualProjectId && expectedProjectId !== actualProjectId) return false;
    return true;
  }

  return false;
}

export function projectMismatchMessage() {
  return "未选择项目/未同步。";
}

export function projectRuntimeRequestPath(endpoint: string, expected?: ProjectRuntimeIdentity) {
  void expected;
  return endpoint;
}

function normalizeRuntimeApiBaseUrl(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

function hasElectronRuntimeBridge() {
  return typeof window !== "undefined" && Boolean(window.vibeRuntime);
}

function bridgeRuntimeApiBaseUrl() {
  if (typeof window === "undefined") return "";
  try {
    return normalizeRuntimeApiBaseUrl(window.vibeRuntime?.runtimeApiBaseUrl?.() || "");
  } catch {
    return "";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function runtimeApiBaseUrl() {
  if (typeof window === "undefined") return "";
  const configured = bridgeRuntimeApiBaseUrl()
    || normalizeRuntimeApiBaseUrl(window.__VIBE_RUNTIME_API_BASE_URL__)
    || normalizeRuntimeApiBaseUrl(import.meta.env?.VITE_VIBE_RUNTIME_API_BASE_URL);
  if (configured) return configured;
  if (hasElectronRuntimeBridge()) return "";
  const { hostname, port } = window.location;
  if ((hostname === "127.0.0.1" || hostname === "localhost") && port !== "8790") {
    return defaultRuntimeApiBaseUrl;
  }
  return "";
}

export async function ensureRuntimeApiBaseUrl() {
  if (typeof window === "undefined") return "";
  const bridge = window.vibeRuntime;
  const bridgeBaseUrl = bridgeRuntimeApiBaseUrl();
  if (bridgeBaseUrl) return bridgeBaseUrl;
  if (bridge?.ensureRuntimeApiBaseUrl) {
    const value = await bridge.ensureRuntimeApiBaseUrl();
    const normalized = normalizeRuntimeApiBaseUrl(value);
    if (normalized) {
      try {
        window.__VIBE_RUNTIME_API_BASE_URL__ = normalized;
      } catch {
        // In packaged Electron the preload bridge exposes this as a read-only
        // contextBridge value. The vibeRuntime bridge already keeps the live
        // URL, so a failed compatibility write must not break app startup.
      }
    }
    return normalized;
  }
  const current = runtimeApiBaseUrl();
  if (current) return current;
  return "";
}

async function waitForRuntimeApiReady(baseUrl: string) {
  const normalizedBaseUrl = normalizeRuntimeApiBaseUrl(baseUrl);
  if (!normalizedBaseUrl) return;
  const existing = runtimeReadyWaits.get(normalizedBaseUrl);
  if (existing) return existing;

  const readyWait = (async () => {
    const statusUrl = `${normalizedBaseUrl}/api/runtime/status`;
    const startedAt = Date.now();
    let lastError = "";
    while (Date.now() - startedAt < runtimeReadyTimeoutMs) {
      try {
        const response = await fetch(statusUrl, runtimeRequestInit());
        if (response.ok) {
          const payload = await response.json().catch(() => undefined);
          if (isRecord(payload) && payload.ok === true) return;
          lastError = "status payload was not ready";
        } else {
          lastError = `HTTP ${response.status}`;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
      await sleep(runtimeReadyPollMs);
    }
    throw new Error(`runtime status did not become ready: ${lastError}`);
  })();

  runtimeReadyWaits.set(normalizedBaseUrl, readyWait);
  try {
    await readyWait;
  } catch (error) {
    runtimeReadyWaits.delete(normalizedBaseUrl);
    throw error;
  }
}

function isRuntimeStartupFetchError(error: unknown) {
  if (!(error instanceof Error)) return true;
  return /fetch failed|failed to fetch|networkerror|load failed|econnrefused|connection refused/i.test(error.message);
}

async function fetchWithRuntimeStartupRetry(url: string, init?: RequestInit) {
  const startedAt = Date.now();
  let lastError: unknown;
  while (Date.now() - startedAt < runtimeStartupRetryMs) {
    try {
      return await fetch(url, runtimeRequestInit(init));
    } catch (error) {
      if (!isRuntimeStartupFetchError(error)) throw error;
      lastError = error;
      await sleep(runtimeStartupRetryDelayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError || "runtime fetch failed"));
}

export async function prepareRuntimeApiRequest() {
  const shouldWaitForBridgeRuntime = hasElectronRuntimeBridge();
  const baseUrl = await ensureRuntimeApiBaseUrl();
  if (baseUrl && shouldWaitForBridgeRuntime) await waitForRuntimeApiReady(baseUrl);
  return baseUrl;
}

export function toRuntimeUrl(path: string) {
  if (/^(?:https?:|data:|blob:)/.test(path)) return path;
  const baseUrl = runtimeApiBaseUrl();
  if (!baseUrl) return path;
  return path.startsWith("/") ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
}

export function runtimeApiToken() {
  return import.meta.env?.VITE_VIBE_DIRECTOR_RUNTIME_API_TOKEN
    || import.meta.env?.VITE_VIBE_CORE_RUNTIME_API_TOKEN
    || "";
}

export function runtimeRequestInit(init?: RequestInit): RequestInit | undefined {
  const token = runtimeApiToken();
  if (!token) return init;
  const headers = new Headers(init?.headers);
  headers.set("x-vibe-runtime-token", token);
  return { ...init, headers };
}

export function isRuntimeEndpointPath(url: string) {
  return url.startsWith(projectRuntimeBasePath);
}

export async function fetchRuntimeJson(url: string, init?: RequestInit): Promise<unknown> {
  const isRuntimeEndpoint = isRuntimeEndpointPath(url);
  const isElectronRuntime = hasElectronRuntimeBridge();
  try {
    if (isRuntimeEndpoint) {
      const baseUrl = await prepareRuntimeApiRequest();
      if (isElectronRuntime && !baseUrl) throw new Error("Electron runtime API did not provide a base URL.");
    }
    const response = await fetchWithRuntimeStartupRetry(toRuntimeUrl(url), init);
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response.json() as Promise<unknown>;
  } catch (error) {
    if (isElectronRuntime || runtimeApiBaseUrl() || !isRuntimeEndpoint) throw error;
    const response = await fetchWithRuntimeStartupRetry(`${defaultRuntimeApiBaseUrl}${url}`, init);
    if (!response.ok) throw new Error(`${defaultRuntimeApiBaseUrl}${url} returned ${response.status}`);
    return response.json() as Promise<unknown>;
  }
}
