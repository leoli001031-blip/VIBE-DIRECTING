import {
  fetchRuntimeJson,
  hasProjectRuntimeIdentity,
  isRecord,
  projectRuntimeBasePath,
  projectRuntimeRequestPath,
  stringOrUndefined,
  type ProjectRuntimeIdentity,
} from "./runtimeApiClient";

export const projectAssetStatusEndpoint = `${projectRuntimeBasePath}/projects/current/assets/status`;

export type ProjectAssetStatus = "locked" | "needs_review" | "candidate" | "rejected";

export type ProjectAssetStatusResult = {
  ok: boolean;
  status?: string;
  message?: string;
  assetId?: string;
  visualMemoryWritten?: boolean;
  blockers?: string[];
};

export async function markCurrentProjectAssetStatus(
  expected: ProjectRuntimeIdentity | undefined,
  input: {
    assetId: string;
    status: ProjectAssetStatus;
    reviewerId?: string;
  },
): Promise<ProjectAssetStatusResult> {
  if (!hasProjectRuntimeIdentity(expected)) {
    return { ok: false, status: "blocked", message: "未选择项目/未同步。", blockers: ["project_unbound"] };
  }
  if (!input.assetId.trim()) {
    return { ok: false, status: "blocked", message: "请选择要复核的参考。", blockers: ["asset_id_required"] };
  }

  try {
    const payload = await fetchRuntimeJson(projectRuntimeRequestPath(projectAssetStatusEndpoint, expected), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assetId: input.assetId,
        status: input.status,
        reviewerId: input.reviewerId || "local_user",
      }),
    });
    if (!isRecord(payload)) return { ok: false, status: "blocked", message: "参考状态写入失败。" };
    return {
      ok: payload.ok === true,
      status: stringOrUndefined(payload.status),
      message: stringOrUndefined(payload.message),
      assetId: stringOrUndefined(payload.assetId) || input.assetId,
      visualMemoryWritten: payload.visualMemoryWritten === true,
      blockers: Array.isArray(payload.blockers) ? payload.blockers.filter((item): item is string => typeof item === "string") : undefined,
    };
  } catch (error) {
    console.error("markCurrentProjectAssetStatus failed:", error);
    return {
      ok: false,
      status: "blocked",
      message: error instanceof Error ? error.message : "参考状态写入失败。",
      blockers: ["runtime_request_failed"],
    };
  }
}
