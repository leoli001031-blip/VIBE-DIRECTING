import type { DirectorAgentActionEnvelope } from "../core/directorAgentAction";
import { buildVibeAgentDispatchPlan, type VibeAgentDispatchPlan } from "./actionDispatch";
import { evaluateVibeAgentPermission } from "./permissionGate";
import type { VibeAgentPermissionDecision, VibeAgentPermissionMode, VibeAgentToolName } from "./types";

export interface VibeAgentConfirmedActionExecutionContext {
  action: DirectorAgentActionEnvelope;
  dispatchPlan: VibeAgentDispatchPlan;
  permissionDecision: VibeAgentPermissionDecision;
}

export type VibeAgentConfirmedActionExecutionResult<TValue = unknown> =
  | {
      status: "completed";
      dispatchPlan: VibeAgentDispatchPlan;
      permissionDecision: VibeAgentPermissionDecision;
      value: TValue;
    }
  | {
      status: "blocked";
      dispatchPlan: VibeAgentDispatchPlan;
      permissionDecision: VibeAgentPermissionDecision;
      reason: string;
    }
  | {
      status: "failed";
      dispatchPlan: VibeAgentDispatchPlan;
      permissionDecision: VibeAgentPermissionDecision;
      reason: string;
    };

export type VibeAgentConfirmedActionHandler<TValue = unknown> = (
  context: VibeAgentConfirmedActionExecutionContext,
) => Promise<TValue> | TValue;

export type VibeAgentConfirmedActionHandlers<TValue = unknown> = Partial<
  Record<VibeAgentToolName, VibeAgentConfirmedActionHandler<TValue>>
>;

export async function executeConfirmedVibeAgentAction<TValue>(input: {
  action: DirectorAgentActionEnvelope;
  permissionMode: VibeAgentPermissionMode;
  userConfirmed?: boolean;
  apply: VibeAgentConfirmedActionHandler<TValue>;
}): Promise<VibeAgentConfirmedActionExecutionResult<TValue>> {
  const dispatchPlan = buildVibeAgentDispatchPlan(input.action);
  const permissionDecision = evaluateVibeAgentPermission({
    action: input.action,
    permissionMode: input.permissionMode,
    userConfirmed: input.userConfirmed,
  });
  if (input.action.status === "blocked") {
    return {
      status: "blocked",
      dispatchPlan,
      permissionDecision,
      reason: input.action.blockers[0] || "动作当前被项目状态阻断。",
    };
  }
  if (!permissionDecision.allowed) {
    return {
      status: "blocked",
      dispatchPlan,
      permissionDecision,
      reason: permissionDecision.reason,
    };
  }
  try {
    const value = await input.apply({
      action: input.action,
      dispatchPlan,
      permissionDecision,
    });
    return {
      status: "completed",
      dispatchPlan,
      permissionDecision,
      value,
    };
  } catch (error) {
    return {
      status: "failed",
      dispatchPlan,
      permissionDecision,
      reason: error instanceof Error ? error.message : "动作执行失败。",
    };
  }
}

export async function executeRegisteredVibeAgentAction<TValue>(input: {
  action: DirectorAgentActionEnvelope;
  permissionMode: VibeAgentPermissionMode;
  userConfirmed?: boolean;
  handlers: VibeAgentConfirmedActionHandlers<TValue>;
}): Promise<VibeAgentConfirmedActionExecutionResult<TValue>> {
  const dispatchPlan = buildVibeAgentDispatchPlan(input.action);
  const permissionDecision = evaluateVibeAgentPermission({
    action: input.action,
    permissionMode: input.permissionMode,
    userConfirmed: input.userConfirmed,
  });
  if (input.action.status === "blocked") {
    return {
      status: "blocked",
      dispatchPlan,
      permissionDecision,
      reason: input.action.blockers[0] || "动作当前被项目状态阻断。",
    };
  }
  if (!permissionDecision.allowed) {
    return {
      status: "blocked",
      dispatchPlan,
      permissionDecision,
      reason: permissionDecision.reason,
    };
  }
  const handler = input.handlers[dispatchPlan.executorTool];
  if (!handler) {
    return {
      status: "blocked",
      dispatchPlan,
      permissionDecision,
      reason: `动作 ${dispatchPlan.executorTool} 没有可用执行器。`,
    };
  }
  try {
    const value = await handler({
      action: input.action,
      dispatchPlan,
      permissionDecision,
    });
    return {
      status: "completed",
      dispatchPlan,
      permissionDecision,
      value,
    };
  } catch (error) {
    return {
      status: "failed",
      dispatchPlan,
      permissionDecision,
      reason: error instanceof Error ? error.message : "动作执行失败。",
    };
  }
}
