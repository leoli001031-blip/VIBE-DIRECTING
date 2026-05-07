export const realDemoE2e005RunEndpoint = "http://127.0.0.1:8787/api/real-demo-e2e/005/run";
export const realDemoE2e005ProjectRoot = "/Users/lichenhao/Desktop/vibe core";
export const realDemoE2e005SandboxRoot =
  `${realDemoE2e005ProjectRoot}/real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames`;
export const realDemoE2e005ReportPath =
  `${realDemoE2e005SandboxRoot}/reports/image2_start_long_chain_report.json`;
export const realDemoE2e005ReportUrl = toViteFsUrl(realDemoE2e005ReportPath);

export type RealDemoE2e005UiStatus =
  | "running"
  | "preview_ready_with_review"
  | "production_needs_review"
  | "blocked"
  | "unavailable";

export type RealDemoE2e005Source = "endpoint" | "local_report";

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
  message?: string;
};

export type RealDemoE2e005UiState = {
  status: RealDemoE2e005UiStatus;
  summary?: RealDemoE2e005Summary;
  message?: string;
};

type RealDemoE2e005Report = {
  generatedAt?: string;
  runId?: string;
  status?: string;
  previewStatus?: string;
  productionStatus?: string;
  shotCount?: number;
  reviewOverlayShots?: string[];
  productionNeedsReviewShots?: string[];
  observations?: Array<{
    order?: number;
    shotId?: string;
    expectedOutputPath?: string;
    reviewOverlay?: boolean;
    previewQaStatus?: string;
    productionQaStatus?: string;
    blockers?: string[];
  }>;
  blockers?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function reportFromPayload(payload: unknown): RealDemoE2e005Report | undefined {
  if (!isRecord(payload)) return undefined;
  if (typeof payload.status === "string" || Array.isArray(payload.observations)) return payload as RealDemoE2e005Report;
  if (isRecord(payload.report)) return payload.report as RealDemoE2e005Report;
  if (isRecord(payload.result)) return payload.result as RealDemoE2e005Report;
  return undefined;
}

function toAbsolutePath(path: string) {
  if (path.startsWith("/")) return path;
  return `${realDemoE2e005ProjectRoot}/${path.replace(/^\.?\//, "")}`;
}

function toViteFsUrl(path: string) {
  return encodeURI(`/@fs${path}`);
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
      reportPath: realDemoE2e005ReportPath,
      reportUrl: realDemoE2e005ReportUrl,
      message: "Report shape was not recognized.",
    };
  }

  const observations = (report.observations || [])
    .filter((item) => typeof item.shotId === "string")
    .map((item, index) => {
      const expectedOutputAbsPath = item.expectedOutputPath ? toAbsolutePath(item.expectedOutputPath) : undefined;
      return {
        shotId: item.shotId || `S${String(index + 1).padStart(2, "0")}`,
        order: typeof item.order === "number" ? item.order : index + 1,
        expectedOutputPath: item.expectedOutputPath,
        expectedOutputAbsPath,
        imageUrl: expectedOutputAbsPath ? toViteFsUrl(expectedOutputAbsPath) : undefined,
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
    source,
    generatedAt: report.generatedAt,
    runId: report.runId,
    previewStatus: report.previewStatus || report.status || "unavailable",
    productionStatus: report.productionStatus || "unavailable",
    shotCount: typeof report.shotCount === "number" ? report.shotCount : observations.length,
    reviewOverlayShots,
    productionNeedsReviewShots,
    observations,
    reportPath: realDemoE2e005ReportPath,
    reportUrl: realDemoE2e005ReportUrl,
  };
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function runRealDemoE2e005UiBridge(): Promise<RealDemoE2e005UiState> {
  try {
    const payload = await fetchJson(realDemoE2e005RunEndpoint, { method: "POST" });
    const summary = deriveRealDemoE2e005Summary(payload, "endpoint");
    return { status: summary.uiStatus, summary };
  } catch (endpointError) {
    try {
      const payload = await fetchJson(realDemoE2e005ReportUrl);
      const summary = deriveRealDemoE2e005Summary(payload, "local_report");
      return {
        status: summary.uiStatus,
        summary,
        message: `Endpoint unavailable; synced local report. ${endpointError instanceof Error ? endpointError.message : ""}`.trim(),
      };
    } catch (reportError) {
      return {
        status: "unavailable",
        message: reportError instanceof Error ? reportError.message : "Local report unavailable.",
      };
    }
  }
}
