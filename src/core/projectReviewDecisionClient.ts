import {
  fetchRuntimeJson,
  projectRuntimeBasePath,
  projectRuntimeRequestPath,
  runtimeRequestInit,
  type ProjectRuntimeIdentity,
} from "./runtimeApiClient";

export const projectReviewDecisionEndpoint = `${projectRuntimeBasePath}/projects/current/review/decision`;

export type ProjectReviewDecisionAction = "approve" | "lock" | "reject" | "retry";

export type ProjectReviewDecisionRequest = {
  action: ProjectReviewDecisionAction;
  reviewedAt?: string;
  reviewerId?: string;
  item?: Record<string, unknown>;
  candidate?: Record<string, unknown>;
  decision?: Record<string, unknown>;
};

export type ProjectReviewDecisionStatus = {
  ok: boolean;
  status?: string;
  message?: string;
  projectVibeWritten?: boolean;
  blockers?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function submitCurrentProjectReviewDecision(
  expected: ProjectRuntimeIdentity | undefined,
  request: ProjectReviewDecisionRequest,
): Promise<ProjectReviewDecisionStatus> {
  const endpoint = projectRuntimeRequestPath(projectReviewDecisionEndpoint, expected);
  const payload = await fetchRuntimeJson(endpoint, runtimeRequestInit({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  }));
  if (!isRecord(payload)) return { ok: false, status: "error", message: "复核写入没有返回有效结果。" };
  return {
    ok: payload.ok === true,
    status: typeof payload.status === "string" ? payload.status : undefined,
    message: typeof payload.message === "string" ? payload.message : undefined,
    projectVibeWritten: payload.projectVibeWritten === true,
    blockers: Array.isArray(payload.blockers)
      ? payload.blockers.filter((item): item is string => typeof item === "string")
      : undefined,
  };
}
