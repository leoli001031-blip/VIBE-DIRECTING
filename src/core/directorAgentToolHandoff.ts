import type { DirectorAgentActionEnvelope } from "./directorAgentAction";

export const DIRECTOR_AGENT_TOOL_HANDOFF_SCHEMA_VERSION = "director_agent_tool_handoff/0.1.0";

export type DirectorAgentToolHandler =
  | "project_vibe_patch"
  | "web_search"
  | "image2_reference_generation"
  | "seedance_video_submit"
  | "project_export";

export type DirectorAgentToolHandoffStatus =
  | "ready"
  | "blocked"
  | "handled_by_project_write";

export interface DirectorAgentToolAvailability {
  projectReady: boolean;
  webSearchReady: boolean;
  referenceGenerationReady: boolean;
  videoSubmitReady: boolean;
  exportReady: boolean;
}

export interface DirectorAgentToolInvocationPayload {
  taskEnvelope: DirectorAgentToolTaskEnvelope;
  userIntent: string;
  selectedShotIds: string[];
  selectedAssetId?: string;
  sectionId?: string;
  targetSummary: {
    kind: DirectorAgentActionEnvelope["target"]["kind"];
    ids: string[];
    label: string;
  };
  confirmation: {
    actionId: string;
    confirmed: true;
    confirmedAt: string;
    expectedReceipt: DirectorAgentActionEnvelope["toolPlan"]["expectedReceipt"];
  };
}

export interface DirectorAgentToolPreflightPolicy {
  projectWriteReceiptRequired: true;
  ruleQaRequired: boolean;
  textQaRequired: boolean;
  noBgmGuardRequired: boolean;
  providerSubmitAfterPreflightOnly: boolean;
}

export interface DirectorAgentToolTaskEnvelope {
  id: string;
  inputHash: string;
  policyBinding: "director_agent_tool_handoff";
  actionId: string;
  handoffId: string;
  handler: DirectorAgentToolHandler;
  expectedReceipt: DirectorAgentActionEnvelope["toolPlan"]["expectedReceipt"];
  providerSubmitAllowed: boolean;
  preflight: DirectorAgentToolPreflightPolicy;
  projectWriteRequiredBeforeInvocation: true;
  userConfirmationRequired: true;
  projectWriteMode: "staged_only";
  targetSummary: DirectorAgentToolInvocationPayload["targetSummary"];
  sourceContext: {
    userIntent: string;
    projectTitle: string;
    projectRoot?: string;
    currentView?: string;
    selectedShotIds: string[];
    selectedAssetId?: string;
    sectionId?: string;
    totalShots: number;
  };
  confirmedAt: string;
}

export interface DirectorAgentToolHandoff {
  schemaVersion: typeof DIRECTOR_AGENT_TOOL_HANDOFF_SCHEMA_VERSION;
  handoffId: string;
  actionId: string;
  status: DirectorAgentToolHandoffStatus;
  handler: DirectorAgentToolHandler;
  userFacingMessage: string;
  blockers: string[];
  projectWriteRequiredBeforeInvocation: true;
  taskEnvelopeRequired: true;
  expectedReceipt: DirectorAgentActionEnvelope["toolPlan"]["expectedReceipt"];
  invocation?: DirectorAgentToolInvocationPayload;
  createdAt: string;
}

export interface BuildDirectorAgentToolHandoffInput {
  action: DirectorAgentActionEnvelope;
  userConfirmed: boolean;
  confirmedAt?: string;
  availability: DirectorAgentToolAvailability;
}

export const defaultDirectorAgentToolAvailability: DirectorAgentToolAvailability = {
  projectReady: true,
  webSearchReady: false,
  referenceGenerationReady: false,
  videoSubmitReady: false,
  exportReady: false,
};

export function isDirectorAgentReferenceGenerationHandler(handler: DirectorAgentToolHandler) {
  return handler === "image2_reference_generation";
}

export function directorAgentToolHandoffEvidenceRefs(handoff: DirectorAgentToolHandoff): string[] {
  const taskEnvelope = handoff.invocation?.taskEnvelope;
  return uniqueStrings([
    `agentToolHandoff#${handoff.handoffId}`,
    `agentToolHandoff#${handoff.handoffId}/action/${handoff.actionId}`,
    `agentToolHandoff#${handoff.handoffId}/handler/${handoff.handler}`,
    `agentToolHandoff#${handoff.handoffId}/status/${handoff.status}`,
    `agentToolHandoff#${handoff.handoffId}/expected/${handoff.expectedReceipt}`,
    taskEnvelope?.id ? `agentToolTaskEnvelope#${taskEnvelope.id}` : "",
    taskEnvelope?.inputHash ? `agentToolTaskEnvelope#${taskEnvelope.id}/input/${taskEnvelope.inputHash}` : "",
    taskEnvelope?.policyBinding ? `agentToolTaskEnvelope#${taskEnvelope.id}/policy/${taskEnvelope.policyBinding}` : "",
  ]);
}

export function directorAgentToolHandoffReceiptSummary(handoff: DirectorAgentToolHandoff): string {
  return `${handoff.status}:${handoff.handler}:${handoff.expectedReceipt}`;
}

export function buildDirectorAgentToolHandoff(input: BuildDirectorAgentToolHandoffInput): DirectorAgentToolHandoff {
  const confirmedAt = input.confirmedAt || new Date().toISOString();
  const action = input.action;
  const handler = action.toolPlan.toolName;
  const blockers = handoffBlockers(input);
  const status = handler === "project_vibe_patch" && !blockers.length
    ? "handled_by_project_write"
    : blockers.length
      ? "blocked"
      : "ready";
  const handoffId = `agent_tool_handoff_${compactId(confirmedAt)}_${compactId(action.actionId)}`;
  const targetSummary = {
    kind: action.target.kind,
    ids: action.target.ids,
    label: action.target.label,
  };
  const taskEnvelope = buildToolTaskEnvelope({ action, handoffId, confirmedAt, handler, targetSummary });

  return {
    schemaVersion: DIRECTOR_AGENT_TOOL_HANDOFF_SCHEMA_VERSION,
    handoffId,
    actionId: action.actionId,
    status,
    handler,
    userFacingMessage: handoffMessage(status, handler, blockers),
    blockers,
    projectWriteRequiredBeforeInvocation: true,
    taskEnvelopeRequired: action.toolPlan.taskEnvelopeRequired,
    expectedReceipt: action.toolPlan.expectedReceipt,
    invocation: status === "ready"
      ? {
          taskEnvelope,
          userIntent: action.sourceContext.userIntent,
          selectedShotIds: action.sourceContext.selectedShotIds,
          selectedAssetId: action.sourceContext.selectedAssetId,
          sectionId: action.sourceContext.sectionId,
          targetSummary,
          confirmation: {
            actionId: action.actionId,
            confirmed: true,
            confirmedAt,
            expectedReceipt: action.toolPlan.expectedReceipt,
          },
        }
      : undefined,
    createdAt: confirmedAt,
  };
}

function buildToolTaskEnvelope(input: {
  action: DirectorAgentActionEnvelope;
  handoffId: string;
  confirmedAt: string;
  handler: DirectorAgentToolHandler;
  targetSummary: DirectorAgentToolInvocationPayload["targetSummary"];
}): DirectorAgentToolTaskEnvelope {
  const taskEnvelopeId = `agent_tool_task_${compactId(input.action.actionId)}_${compactId(input.handler)}`;
  const baseEnvelope = {
    id: taskEnvelopeId,
    policyBinding: "director_agent_tool_handoff" as const,
    actionId: input.action.actionId,
    handoffId: input.handoffId,
    handler: input.handler,
    expectedReceipt: input.action.toolPlan.expectedReceipt,
    providerSubmitAllowed: input.action.toolPlan.providerSubmitAllowed,
    preflight: preflightPolicyForHandler(input.handler),
    projectWriteRequiredBeforeInvocation: true as const,
    userConfirmationRequired: true as const,
    projectWriteMode: "staged_only" as const,
    targetSummary: input.targetSummary,
    sourceContext: {
      userIntent: input.action.sourceContext.userIntent,
      projectTitle: input.action.sourceContext.projectTitle,
      projectRoot: input.action.sourceContext.projectRoot,
      currentView: input.action.sourceContext.currentView,
      selectedShotIds: input.action.sourceContext.selectedShotIds,
      selectedAssetId: input.action.sourceContext.selectedAssetId,
      sectionId: input.action.sourceContext.sectionId,
      totalShots: input.action.sourceContext.totalShots,
    },
    confirmedAt: input.confirmedAt,
  };
  return {
    ...baseEnvelope,
    inputHash: stableHash(baseEnvelope),
  };
}

function preflightPolicyForHandler(handler: DirectorAgentToolHandler): DirectorAgentToolPreflightPolicy {
  const videoSubmit = handler === "seedance_video_submit";
  return {
    projectWriteReceiptRequired: true,
    ruleQaRequired: videoSubmit,
    textQaRequired: videoSubmit,
    noBgmGuardRequired: videoSubmit,
    providerSubmitAfterPreflightOnly: videoSubmit,
  };
}

function handoffBlockers(input: BuildDirectorAgentToolHandoffInput): string[] {
  const { action, availability, userConfirmed } = input;
  const handler = action.toolPlan.toolName;
  return uniqueStrings([
    action.status === "blocked" ? "agent_action_blocked" : "",
    userConfirmed ? "" : "user_confirmation_required",
    availability.projectReady ? "" : "project_not_ready",
    handler === "web_search" && !availability.webSearchReady ? "web_search_not_ready" : "",
    handler === "image2_reference_generation" && !availability.referenceGenerationReady ? "reference_generation_not_ready" : "",
    handler === "image2_reference_generation" && !action.toolPlan.providerSubmitAllowed ? "reference_generation_not_allowed" : "",
    handler === "seedance_video_submit" && !availability.videoSubmitReady ? "video_submit_not_ready" : "",
    handler === "seedance_video_submit" && !action.toolPlan.providerSubmitAllowed ? "video_submit_not_allowed" : "",
    handler === "project_export" && !availability.exportReady ? "export_not_ready" : "",
  ]);
}

function handoffMessage(status: DirectorAgentToolHandoffStatus, handler: DirectorAgentToolHandler, blockers: string[]) {
  if (status === "handled_by_project_write") return "修改已写入项目，后续工具不需要额外执行。";
  if (status === "blocked") return blockerMessage(primaryBlockerForMessage(blockers));
  if (handler === "web_search") return "开始查资料，结果会先进入待确认参考。";
  if (handler === "image2_reference_generation") return "开始生成参考，结果会先进入复核。";
  if (handler === "seedance_video_submit") return "开始提交视频，排队结果会回到预览。";
  if (handler === "project_export") return "开始导出素材包。";
  return "已准备执行。";
}

function primaryBlockerForMessage(blockers: string[]) {
  return blockers.find((blocker) => blocker !== "user_confirmation_required") || blockers[0] || "blocked";
}

function blockerMessage(blocker: string) {
  if (blocker === "user_confirmation_required") return "需要你先确认这次动作。";
  if (blocker === "project_not_ready") return "请先打开或创建项目文件夹。";
  if (blocker === "web_search_not_ready") return "查资料还没开启。";
  if (blocker === "reference_generation_not_ready") return "参考生成还不可用。";
  if (blocker === "reference_generation_not_allowed") return "当前还不能生成参考。";
  if (blocker === "video_submit_not_ready") return "视频提交还没准备好。";
  if (blocker === "video_submit_not_allowed") return "当前不允许提交视频。";
  if (blocker === "export_not_ready") return "导出还没准备好。";
  if (blocker === "agent_action_blocked") return "这次动作还没有通过检查。";
  return "当前动作还不能执行。";
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function compactId(value: string) {
  return value.replace(/[^0-9A-Za-z]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function stableHash(value: unknown): string {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `agent_tool_input_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
