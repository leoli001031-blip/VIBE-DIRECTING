declare global {
  interface Window {
    __VIBE_RUNTIME_API_BASE_URL__?: string;
  }

  interface ImportMeta {
    env?: {
      VITE_VIBE_RUNTIME_API_BASE_URL?: string;
    };
  }
}

export const defaultRuntimeApiBaseUrl = "http://127.0.0.1:8790";
export const realDemoE2e005RuntimeBasePath = "/api/runtime";
export const realDemoE2e005StatusEndpoint = `${realDemoE2e005RuntimeBasePath}/real-demo-e2e/005/status`;
export const realDemoE2e005RunEndpoint = `${realDemoE2e005RuntimeBasePath}/real-demo-e2e/005/run`;
export const realDemoE2e005FileEndpoint = `${realDemoE2e005RuntimeBasePath}/files`;
export const realDemoE2e005ReportRelativePath =
  "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/reports/image2_start_long_chain_report.json";
export const realDemoE2e005FallbackReportUrl = `/${realDemoE2e005ReportRelativePath}`;

export type RealDemoE2e005UiStatus =
  | "running"
  | "preview_ready_with_review"
  | "production_needs_review"
  | "blocked"
  | "unavailable";

export type RealDemoE2e005Source = "runtime_endpoint" | "fallback_report";

export type RealDemoE2e005Observation = {
  shotId: string;
  order: number;
  expectedOutputPath?: string;
  expectedOutputAbsPath?: string;
  imageUrl?: string;
  reviewOverlay: boolean;
  previewQaStatus?: string;
  productionQaStatus?: string;
};

export type RealDemoE2e005Summary = {
  uiStatus: RealDemoE2e005UiStatus;
  source?: RealDemoE2e005Source;
  endpoint?: string;
  generatedAt?: string;
  runId?: string;
  previewStatus: string;
  productionStatus: string;
  shotCount: number;
  reviewOverlayShots: string[];
  productionNeedsReviewShots: string[];
  observations: RealDemoE2e005Observation[];
  reportPath: string;
  reportUrl: string;
  providerCalled: boolean;
  prepareRan: boolean;
  message?: string;
};

export type RealDemoE2e005UiState = {
  status: RealDemoE2e005UiStatus;
  summary?: RealDemoE2e005Summary;
  message?: string;
};

type RealDemoE2e005Report = {
  source?: RealDemoE2e005Source;
  endpoint?: string;
  generatedAt?: string;
  runId?: string;
  status?: string;
  previewStatus?: string;
  productionStatus?: string;
  shotCount?: number;
  reviewOverlayShots?: string[];
  productionNeedsReviewShots?: string[];
  reportPath?: string;
  reportRelativePath?: string;
  reportUrl?: string;
  providerCalled?: boolean;
  prepareRan?: boolean;
  observations?: Array<{
    order?: number;
    shotId?: string;
    expectedOutputPath?: string;
    expectedOutputAbsPath?: string;
    imageUrl?: string;
    reviewOverlay?: boolean;
    previewQaStatus?: string;
    productionQaStatus?: string;
    blockers?: string[];
  }>;
  blockers?: string[];
  message?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function reportFromPayload(payload: unknown): RealDemoE2e005Report | undefined {
  if (!isRecord(payload)) return undefined;
  if (typeof payload.status === "string" || Array.isArray(payload.observations)) {
    return payload as RealDemoE2e005Report;
  }
  if (isRecord(payload.report)) return { ...payload.report, ...payload } as RealDemoE2e005Report;
  if (isRecord(payload.result)) return { ...payload.result, ...payload } as RealDemoE2e005Report;
  return undefined;
}

function runtimeApiBaseUrl() {
  if (typeof window === "undefined") return "";
  const configured = window.__VIBE_RUNTIME_API_BASE_URL__ || import.meta.env?.VITE_VIBE_RUNTIME_API_BASE_URL || "";
  return configured.replace(/\/+$/, "");
}

function toRuntimeUrl(path: string) {
  if (/^(?:https?:|data:|blob:)/.test(path)) return path;
  const baseUrl = runtimeApiBaseUrl();
  if (!baseUrl) return path;
  return path.startsWith("/") ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
}

function toRuntimeFileUrl(path: string) {
  return toRuntimeUrl(`${realDemoE2e005FileEndpoint}?path=${encodeURIComponent(path)}`);
}

function deriveUiStatus(report: RealDemoE2e005Report): RealDemoE2e005UiStatus {
  const raw = [report.status, report.previewStatus, report.productionStatus].filter(Boolean).join(" ").toLowerCase();
  const blockers = stringArray(report.blockers);
  if (blockers.length || raw.includes("blocked") || raw.includes("fail")) return "blocked";
  if (report.productionStatus === "needs_review" || stringArray(report.productionNeedsReviewShots).length) {
    return "production_needs_review";
  }
  if (raw.includes("preview_ready_with_review") || stringArray(report.reviewOverlayShots).length) {
    return "preview_ready_with_review";
  }
  return "unavailable";
}

export function deriveRealDemoE2e005Summary(
  payload: unknown,
  source: RealDemoE2e005Source,
): RealDemoE2e005Summary {
  const report = reportFromPayload(payload);
  if (!report) {
    return {
      uiStatus: "unavailable",
      source,
      previewStatus: "unavailable",
      productionStatus: "unavailable",
      shotCount: 0,
      reviewOverlayShots: [],
      productionNeedsReviewShots: [],
      observations: [],
      reportPath: realDemoE2e005ReportRelativePath,
      reportUrl: realDemoE2e005FallbackReportUrl,
      providerCalled: false,
      prepareRan: false,
      message: "Report shape was not recognized.",
    };
  }

  const reportRelativePath = report.reportRelativePath || realDemoE2e005ReportRelativePath;
  const reportPath = report.reportRelativePath || report.reportPath || realDemoE2e005ReportRelativePath;
  const reportUrl = report.reportUrl ? toRuntimeUrl(report.reportUrl) : toRuntimeFileUrl(reportRelativePath);

  const observations = (report.observations || [])
    .filter((item) => typeof item.shotId === "string")
    .map((item, index) => {
      const imageUrl = item.imageUrl
        ? toRuntimeUrl(item.imageUrl)
        : item.expectedOutputPath
          ? toRuntimeFileUrl(item.expectedOutputPath)
          : undefined;
      return {
        shotId: item.shotId || `S${String(index + 1).padStart(2, "0")}`,
        order: typeof item.order === "number" ? item.order : index + 1,
        expectedOutputPath: item.expectedOutputPath,
        expectedOutputAbsPath: item.expectedOutputAbsPath,
        imageUrl,
        reviewOverlay: item.reviewOverlay === true,
        previewQaStatus: item.previewQaStatus,
        productionQaStatus: item.productionQaStatus,
      };
    });

  const reviewOverlayShots = stringArray(report.reviewOverlayShots).length
    ? stringArray(report.reviewOverlayShots)
    : observations.filter((item) => item.reviewOverlay).map((item) => item.shotId);
  const productionNeedsReviewShots = stringArray(report.productionNeedsReviewShots).length
    ? stringArray(report.productionNeedsReviewShots)
    : observations.filter((item) => item.productionQaStatus === "needs_review").map((item) => item.shotId);

  return {
    uiStatus: deriveUiStatus({ ...report, reviewOverlayShots, productionNeedsReviewShots }),
    source: report.source || source,
    endpoint: report.endpoint,
    generatedAt: report.generatedAt,
    runId: report.runId,
    previewStatus: report.previewStatus || report.status || "unavailable",
    productionStatus: report.productionStatus || "unavailable",
    shotCount: typeof report.shotCount === "number" ? report.shotCount : observations.length,
    reviewOverlayShots,
    productionNeedsReviewShots,
    observations,
    reportPath,
    reportUrl,
    providerCalled: report.providerCalled === true,
    prepareRan: report.prepareRan === true,
    message: report.message,
  };
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(toRuntimeUrl(url), init);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

function isRuntimeEndpointPath(url: string) {
  return url.startsWith(realDemoE2e005RuntimeBasePath);
}

async function fetchRuntimeJson(url: string, init?: RequestInit): Promise<unknown> {
  try {
    return await fetchJson(url, init);
  } catch (error) {
    if (runtimeApiBaseUrl() || !isRuntimeEndpointPath(url)) throw error;
    const response = await fetch(`${defaultRuntimeApiBaseUrl}${url}`, init);
    if (!response.ok) throw new Error(`${defaultRuntimeApiBaseUrl}${url} returned ${response.status}`);
    return response.json() as Promise<unknown>;
  }
}

async function fallbackToReport(message: string): Promise<RealDemoE2e005UiState> {
  try {
    const payload = await fetchJson(realDemoE2e005FallbackReportUrl);
    const summary = deriveRealDemoE2e005Summary(payload, "fallback_report");
    return {
      status: summary.uiStatus,
      summary,
      message,
    };
  } catch (reportError) {
    return {
      status: "unavailable",
      message: reportError instanceof Error ? reportError.message : "Runtime API and fallback report are unavailable.",
    };
  }
}

export async function loadRealDemoE2e005UiBridgeStatus(): Promise<RealDemoE2e005UiState> {
  try {
    const payload = await fetchRuntimeJson(realDemoE2e005StatusEndpoint);
    const summary = deriveRealDemoE2e005Summary(payload, "runtime_endpoint");
    return { status: summary.uiStatus, summary };
  } catch (endpointError) {
    return fallbackToReport(
      `Runtime endpoint unavailable; attempted report fallback. ${endpointError instanceof Error ? endpointError.message : ""}`.trim(),
    );
  }
}

export async function runRealDemoE2e005UiBridge(): Promise<RealDemoE2e005UiState> {
  try {
    const payload = await fetchRuntimeJson(realDemoE2e005RunEndpoint, { method: "POST" });
    const summary = deriveRealDemoE2e005Summary(payload, "runtime_endpoint");
    return { status: summary.uiStatus, summary };
  } catch (endpointError) {
    return fallbackToReport(
      `Runtime run endpoint unavailable; synced report fallback only. ${endpointError instanceof Error ? endpointError.message : ""}`.trim(),
    );
  }
}
