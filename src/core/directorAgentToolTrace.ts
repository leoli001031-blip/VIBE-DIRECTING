import type { DirectorAgentActionEnvelope } from "./directorAgentAction";
import type {
  DirectorAgentToolHandoff,
  DirectorAgentToolHandler,
} from "./directorAgentToolHandoff";

export interface DirectorAgentToolTrace {
  id: string;
  inputHash: string;
  policyBinding: "director_agent_tool_handoff";
  actionId: string;
  handoffId: string;
  handler: DirectorAgentToolHandler;
  expectedReceipt: DirectorAgentActionEnvelope["toolPlan"]["expectedReceipt"];
  providerSubmitAllowed: boolean;
  preflight: {
    projectWriteReceiptRequired: true;
    ruleQaRequired: boolean;
    textQaRequired: boolean;
    noBgmGuardRequired: boolean;
    providerSubmitAfterPreflightOnly: boolean;
  };
  projectWriteRequiredBeforeInvocation: true;
  userConfirmationRequired: true;
  confirmedAt: string;
  targetKind: DirectorAgentActionEnvelope["target"]["kind"];
  targetIds: string[];
  targetLabel: string;
  selectedShotIds: string[];
  selectedAssetId?: string;
  sectionId?: string;
  sourceProjectTitle: string;
  sourceProjectRoot?: string;
  totalShots: number;
}

export interface DirectorAgentToolTraceResult {
  ok: boolean;
  trace?: DirectorAgentToolTrace;
  errors: string[];
}

export function buildDirectorAgentToolTrace(
  action: DirectorAgentActionEnvelope,
  handoff: DirectorAgentToolHandoff,
): DirectorAgentToolTraceResult {
  const invocation = handoff.invocation;
  const taskEnvelope = invocation?.taskEnvelope;
  const errors = [
    handoff.status === "ready" ? "" : "agent_tool_handoff_not_ready",
    invocation ? "" : "agent_tool_invocation_missing",
    taskEnvelope ? "" : "agent_tool_task_envelope_missing",
    handoff.actionId === action.actionId ? "" : "agent_tool_handoff_action_id_mismatch",
    handoff.handler === action.toolPlan.toolName ? "" : "agent_tool_handoff_handler_mismatch",
    handoff.expectedReceipt === action.toolPlan.expectedReceipt ? "" : "agent_tool_handoff_receipt_mismatch",
    invocation?.confirmation.actionId === action.actionId ? "" : "agent_tool_confirmation_action_id_mismatch",
    invocation?.confirmation.expectedReceipt === action.toolPlan.expectedReceipt ? "" : "agent_tool_confirmation_receipt_mismatch",
    taskEnvelope?.actionId === action.actionId ? "" : "agent_tool_task_action_id_mismatch",
    taskEnvelope?.handoffId === handoff.handoffId ? "" : "agent_tool_task_handoff_id_mismatch",
    taskEnvelope?.handler === action.toolPlan.toolName ? "" : "agent_tool_task_handler_mismatch",
    taskEnvelope?.expectedReceipt === action.toolPlan.expectedReceipt ? "" : "agent_tool_task_receipt_mismatch",
    taskEnvelope?.providerSubmitAllowed === action.toolPlan.providerSubmitAllowed ? "" : "agent_tool_task_provider_policy_mismatch",
    taskEnvelope?.preflight?.projectWriteReceiptRequired === true ? "" : "agent_tool_task_preflight_write_receipt_missing",
    action.toolPlan.toolName !== "seedance_video_submit" || taskEnvelope?.preflight?.ruleQaRequired === true ? "" : "agent_tool_task_rule_qa_missing",
    action.toolPlan.toolName !== "seedance_video_submit" || taskEnvelope?.preflight?.textQaRequired === true ? "" : "agent_tool_task_text_qa_missing",
    action.toolPlan.toolName !== "seedance_video_submit" || taskEnvelope?.preflight?.noBgmGuardRequired === true ? "" : "agent_tool_task_no_bgm_guard_missing",
    action.toolPlan.toolName !== "seedance_video_submit" || taskEnvelope?.preflight?.providerSubmitAfterPreflightOnly === true ? "" : "agent_tool_task_preflight_submit_gate_missing",
    taskEnvelope?.policyBinding === "director_agent_tool_handoff" ? "" : "agent_tool_task_policy_mismatch",
    taskEnvelope?.projectWriteRequiredBeforeInvocation === true ? "" : "agent_tool_task_write_gate_mismatch",
    taskEnvelope?.userConfirmationRequired === true ? "" : "agent_tool_task_confirmation_gate_mismatch",
    taskEnvelope?.id ? "" : "agent_tool_task_id_missing",
    taskEnvelope?.inputHash ? "" : "agent_tool_task_input_hash_missing",
  ].filter(Boolean);
  if (!invocation || !taskEnvelope || errors.length) return { ok: false, errors };

  return {
    ok: true,
    errors: [],
    trace: {
      id: taskEnvelope.id,
      inputHash: taskEnvelope.inputHash,
      policyBinding: taskEnvelope.policyBinding,
      actionId: taskEnvelope.actionId,
      handoffId: taskEnvelope.handoffId,
      handler: taskEnvelope.handler,
      expectedReceipt: taskEnvelope.expectedReceipt,
      providerSubmitAllowed: taskEnvelope.providerSubmitAllowed,
      preflight: taskEnvelope.preflight,
      projectWriteRequiredBeforeInvocation: taskEnvelope.projectWriteRequiredBeforeInvocation,
      userConfirmationRequired: taskEnvelope.userConfirmationRequired,
      confirmedAt: invocation.confirmation.confirmedAt,
      targetKind: invocation.targetSummary.kind,
      targetIds: invocation.targetSummary.ids,
      targetLabel: invocation.targetSummary.label,
      selectedShotIds: invocation.selectedShotIds,
      selectedAssetId: invocation.selectedAssetId,
      sectionId: invocation.sectionId,
      sourceProjectTitle: taskEnvelope.sourceContext.projectTitle,
      sourceProjectRoot: taskEnvelope.sourceContext.projectRoot,
      totalShots: taskEnvelope.sourceContext.totalShots,
    },
  };
}
