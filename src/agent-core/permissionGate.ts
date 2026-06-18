import type { DirectorAgentActionEnvelope } from "../core/directorAgentAction";
import type {
  VibeAgentPermissionDecision,
  VibeAgentPermissionMode,
} from "./types";

const permissionRank: Record<VibeAgentPermissionMode, number> = {
  plan_only: 0,
  project_write_allowed: 1,
  reference_allowed: 2,
  video_allowed: 3,
  export_allowed: 4,
};

function hasPermission(current: VibeAgentPermissionMode, required: VibeAgentPermissionMode) {
  return permissionRank[current] >= permissionRank[required];
}

export function requiredPermissionForDirectorAction(action: DirectorAgentActionEnvelope): VibeAgentPermissionMode {
  if (action.kind === "prepare_video_submit") return "video_allowed";
  if (action.kind === "query_video_result") return "project_write_allowed";
  if (action.kind === "prepare_reference_generation") return "reference_allowed";
  if (action.kind === "prepare_export") return "export_allowed";
  if (action.kind === "inspect_project_status") return "plan_only";
  return "project_write_allowed";
}

export function evaluateVibeAgentPermission(input: {
  action: DirectorAgentActionEnvelope;
  permissionMode: VibeAgentPermissionMode;
  userConfirmed?: boolean;
}): VibeAgentPermissionDecision {
  const required = requiredPermissionForDirectorAction(input.action);
  if (!hasPermission(input.permissionMode, required)) {
    return {
      allowed: false,
      requiresConfirmation: true,
      reason: `当前权限是 ${input.permissionMode}，动作 ${input.action.kind} 至少需要 ${required}。`,
    };
  }
  if (input.action.kind === "inspect_project_status") {
    return {
      allowed: true,
      requiresConfirmation: false,
      reason: "读取项目状态不修改项目，也不会调用生成服务。",
    };
  }
  if (!input.userConfirmed) {
    return {
      allowed: false,
      requiresConfirmation: true,
      reason: "这个动作会写入项目或调用生成链路，需要先等用户确认。",
    };
  }
  return {
    allowed: true,
    requiresConfirmation: false,
    reason: "权限和用户确认都已满足，可以交给现有安全动作执行。",
  };
}
