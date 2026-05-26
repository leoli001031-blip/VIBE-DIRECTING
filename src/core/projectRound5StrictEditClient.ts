import {
  fetchRuntimeJson,
  hasProjectRuntimeIdentity,
  isRecord,
  projectRuntimeBasePath,
  projectRuntimeRequestPath,
  stringArray,
  stringOrUndefined,
  type ProjectRuntimeIdentity,
} from "./runtimeApiClient";
import {
  normalizeProjectRound5ShotGate,
  type ProjectRound5ShotGate,
} from "./projectRound5Types";

export const projectRound5StrictEditPrepareEndpoint = `${projectRuntimeBasePath}/projects/current/round5/strict-edit/prepare`;
export const projectRound5StrictEditReturnEndpoint = `${projectRuntimeBasePath}/projects/current/round5/strict-edit/return`;

export type ProjectRound5StrictEditPreflightUiStatus = "prepared" | "blocked" | "running" | "unavailable";

export type ProjectRound5StrictEditPreflightRequest = {
  shotId: string;
  selectedShotId: string;
  selectedShotIds: string[];
};

export type ProjectRound5StrictEditPreflightStatus = {
  uiStatus: ProjectRound5StrictEditPreflightUiStatus;
  shotId?: string;
  selectedShotId?: string;
  evidencePath?: string;
  sidecarPath?: string;
  blockers: string[];
  warnings: string[];
  providerCalled: boolean;
  message?: string;
};

export type ProjectRound5StrictEditPreflightUiState = {
  status: ProjectRound5StrictEditPreflightUiStatus;
  summary?: ProjectRound5StrictEditPreflightStatus;
  message?: string;
};

export type ProjectRound5StrictEditReturnUiStatus = "needs_review" | "blocked" | "running" | "unavailable";

export type ProjectRound5StrictEditReturnRequest = {
  shotId: string;
  selectedShotId?: string;
  returnedOutputPath?: string;
  returnedProviderObservationPath?: string;
  returnedSemanticQaPath?: string;
  providerRequestId?: string;
  actualProviderReturned?: boolean;
  providerObservation?: Record<string, unknown>;
  semanticQa?: Record<string, unknown>;
};

export type ProjectRound5StrictEditReturnStatus = {
  uiStatus: ProjectRound5StrictEditReturnUiStatus;
  shotId?: string;
  expectedOutputPath?: string;
  returnedOutputPath?: string;
  outputSha256?: string;
  providerObservationPath?: string;
  semanticQaPath?: string;
  pairQaPath?: string;
  strictEditReturnIngestRan: boolean;
  providerCalled: boolean;
  actualImage2Triggered: boolean;
  projectVibeWritten: boolean;
  workerSpawnForbidden: boolean;
  shotGate?: ProjectRound5ShotGate;
  blockers: string[];
  message?: string;
};

export type ProjectRound5StrictEditReturnUiState = {
  status: ProjectRound5StrictEditReturnUiStatus;
  summary?: ProjectRound5StrictEditReturnStatus;
  message?: string;
};

export function deriveRound5StrictEditPreflightStatus(payload: unknown, requestedShotId?: string): ProjectRound5StrictEditPreflightStatus {
  const report = isRecord(payload) ? payload : {};
  const status = String(report.uiStatus || report.status || "").toLowerCase();
  const blockers = stringArray(report.blockers);
  const providerCalled = report.providerCalled === true || report.actualProviderCalled === true;
  const preparedStatuses = new Set(["prepared", "sidecars_prepared", "ready_for_provider_edit", "end_edit_preflight_ready"]);
  const prepared = preparedStatuses.has(status)
    || (report.ok === true && blockers.length === 0 && !providerCalled);

  return {
    uiStatus: blockers.length > 0 || providerCalled ? "blocked" : prepared ? "prepared" : "blocked",
    shotId: stringOrUndefined(report.shotId) || stringOrUndefined(report.selectedShotId) || requestedShotId,
    selectedShotId: stringOrUndefined(report.selectedShotId) || stringOrUndefined(report.shotId) || requestedShotId,
    evidencePath: stringOrUndefined(report.evidencePath) || stringOrUndefined(report.receiptPath),
    sidecarPath: stringOrUndefined(report.sidecarPath),
    blockers,
    warnings: stringArray(report.warnings),
    providerCalled,
    message: stringOrUndefined(report.message),
  };
}

export function deriveRound5StrictEditReturnStatus(payload: unknown, requestedShotId?: string): ProjectRound5StrictEditReturnStatus {
  const report = isRecord(payload) ? payload : {};
  const status = String(report.uiStatus || report.status || "").toLowerCase();
  const blockers = stringArray(report.blockers);
  const shotGate = isRecord(report.shotGate) ? normalizeProjectRound5ShotGate(report.shotGate, 0) : undefined;
  const returned = report.ok === true
    && blockers.length === 0
    && (status.includes("needs_review") || shotGate?.gateStatus === "end_returned_needs_review");

  return {
    uiStatus: returned ? "needs_review" : blockers.length > 0 ? "blocked" : "blocked",
    shotId: stringOrUndefined(report.shotId) || shotGate?.shotId || requestedShotId,
    expectedOutputPath: stringOrUndefined(report.expectedOutputPath),
    returnedOutputPath: stringOrUndefined(report.returnedOutputPath),
    outputSha256: stringOrUndefined(report.outputSha256) || shotGate?.endFrameSha256,
    providerObservationPath: stringOrUndefined(report.providerObservationPath),
    semanticQaPath: stringOrUndefined(report.semanticQaPath),
    pairQaPath: stringOrUndefined(report.pairQaPath),
    strictEditReturnIngestRan: report.strictEditReturnIngestRan === true,
    providerCalled: report.providerCalled === true || report.actualProviderCalled === true,
    actualImage2Triggered: report.actualImage2Triggered === true,
    projectVibeWritten: report.projectVibeWritten === true,
    workerSpawnForbidden: report.workerSpawnForbidden !== false,
    shotGate,
    blockers,
    message: stringOrUndefined(report.message),
  };
}

function strictEditPreflightUnavailable(message = "未选择项目/未同步。"): ProjectRound5StrictEditPreflightUiState {
  return { status: "unavailable", message };
}

export async function prepareProjectRound5StrictEditPreflight(
  expected?: ProjectRuntimeIdentity,
  shotId?: string,
): Promise<ProjectRound5StrictEditPreflightUiState> {
  if (!hasProjectRuntimeIdentity(expected)) return strictEditPreflightUnavailable();
  if (!shotId) return { status: "blocked", message: "请先选择镜头。" };

  const request: ProjectRound5StrictEditPreflightRequest = {
    shotId,
    selectedShotId: shotId,
    selectedShotIds: [shotId],
  };

  try {
    const payload = await fetchRuntimeJson(projectRuntimeRequestPath(projectRound5StrictEditPrepareEndpoint, expected), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const summary = deriveRound5StrictEditPreflightStatus(payload, shotId);
    return { status: summary.uiStatus, summary, message: summary.message };
  } catch {
    return { status: "blocked", message: "edit 证据准备失败，请等待 runtime endpoint 合入或检查 sidecar。" };
  }
}

export async function ingestProjectRound5StrictEditReturn(
  expected: ProjectRuntimeIdentity | undefined,
  request: ProjectRound5StrictEditReturnRequest,
): Promise<ProjectRound5StrictEditReturnUiState> {
  if (!hasProjectRuntimeIdentity(expected)) return { status: "unavailable", message: "未选择项目/未同步。" };
  if (!request.shotId) return { status: "blocked", message: "请先选择镜头。" };

  try {
    const payload = await fetchRuntimeJson(projectRuntimeRequestPath(projectRound5StrictEditReturnEndpoint, expected), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...request,
        selectedShotId: request.selectedShotId || request.shotId,
      }),
    });
    const summary = deriveRound5StrictEditReturnStatus(payload, request.shotId);
    return { status: summary.uiStatus, summary, message: summary.message };
  } catch {
    return { status: "blocked", message: "真实 end 回流接收失败，请检查返回文件、providerRequestId 和 preflight sidecar。" };
  }
}
