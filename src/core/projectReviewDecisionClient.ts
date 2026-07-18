import {
  fetchRuntimeJson,
  projectRuntimeBasePath,
  projectRuntimeRequestPath,
  type ProjectRuntimeIdentity,
} from "./runtimeApiClient";
import type { AgentDirectorReviewIdentity } from "./agentDirectorReviewDecision";

export const projectReviewDecisionEndpoint = `${projectRuntimeBasePath}/projects/current/review/decision`;

export type ProjectReviewDecisionAction = "approve" | "lock" | "reject" | "retry";

export type ProjectReviewDecisionRequest = {
  action: ProjectReviewDecisionAction;
  receiptId?: string;
  reviewedAt?: string;
  reviewerId?: string;
  reviewIdentity?: AgentDirectorReviewIdentity;
  item?: Record<string, unknown>;
  candidate?: Record<string, unknown>;
  decision?: Record<string, unknown>;
};

export type ProjectReviewDecisionStatus = {
  ok: boolean;
  status?: string;
  message?: string;
  projectVibeWritten?: boolean;
  writePerformed?: boolean;
  idempotent?: boolean;
  reviewReceipt?: Record<string, unknown>;
  blockers?: string[];
};

function normalizeReviewPath(value: string) {
  let normalized = value.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
  if (normalized.startsWith("/private/var/")) normalized = normalized.slice("/private".length);
  if (/^\/[a-zA-Z]:\//.test(normalized)) normalized = normalized.slice(1);
  return normalized.replace(/\/+$/, "");
}

function reviewPathIsAbsolute(value: string) {
  return value.startsWith("/") || /^[a-zA-Z]:\//.test(value);
}

export function projectRelativeReviewMediaPath(mediaPath: string | undefined, projectRoot?: string) {
  let candidate = mediaPath?.trim() || "";
  if (!candidate) return undefined;
  try {
    const parsed = new URL(candidate);
    if (parsed.pathname.endsWith("/api/runtime/files")) {
      candidate = parsed.searchParams.get("path")?.trim() || candidate;
    } else if (parsed.protocol === "file:") {
      candidate = decodeURIComponent(parsed.pathname);
    }
  } catch {
    // Plain project paths are expected here.
  }
  const normalizedCandidate = normalizeReviewPath(candidate).replace(/^\.\//, "");
  const root = projectRoot ? normalizeReviewPath(projectRoot) : "";
  if (root && normalizedCandidate.startsWith(`${root}/`)) {
    return normalizedCandidate.slice(root.length + 1) || undefined;
  }
  if (reviewPathIsAbsolute(normalizedCandidate)) return undefined;
  return normalizedCandidate.split("/").includes("..") ? undefined : normalizedCandidate || undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function submitCurrentProjectReviewDecision(
  expected: ProjectRuntimeIdentity | undefined,
  request: ProjectReviewDecisionRequest,
): Promise<ProjectReviewDecisionStatus> {
  const endpoint = projectRuntimeRequestPath(projectReviewDecisionEndpoint, expected);
  const payload = await fetchRuntimeJson(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!isRecord(payload)) return { ok: false, status: "error", message: "复核写入没有返回有效结果。" };
  return {
    ok: payload.ok === true,
    status: typeof payload.status === "string" ? payload.status : undefined,
    message: typeof payload.message === "string" ? payload.message : undefined,
    projectVibeWritten: payload.projectVibeWritten === true,
    writePerformed: payload.writePerformed === true,
    idempotent: payload.idempotent === true,
    reviewReceipt: isRecord(payload.reviewReceipt) ? payload.reviewReceipt : undefined,
    blockers: Array.isArray(payload.blockers)
      ? payload.blockers.filter((item): item is string => typeof item === "string")
      : undefined,
  };
}
