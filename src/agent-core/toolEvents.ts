import {
  directorAgentReadinessActions,
  type DirectorAgentActionEnvelope,
} from "../core/directorAgentAction";
import { buildVibeAgentDispatchPlan } from "./actionDispatch";
import type {
  VibeAgentProjectSnapshot,
  VibeAgentTimelineEntry,
} from "./types";

export function buildVibeAgentTurnTimelineEntries(input: {
  generatedAt: string;
  userMessage: string;
  action: DirectorAgentActionEnvelope;
  projectSnapshot: VibeAgentProjectSnapshot;
  permissionDecision: { allowed: boolean; requiresConfirmation: boolean; reason: string };
  userConfirmed: boolean;
}): VibeAgentTimelineEntry[] {
  const suffix = compactId(input.generatedAt);
  const entries: VibeAgentTimelineEntry[] = [
    buildUserMessageEntry(input, suffix),
    buildInspectProjectCallEntry(input, suffix),
    buildInspectProjectResultEntry(input, suffix),
    buildScanAssetsCallEntry(input, suffix),
    buildScanAssetsResultEntry(input, suffix),
    buildPlanNextActionCallEntry(input, suffix),
    buildPlanNextActionResultEntry(input, suffix),
    buildWriteAgentMessageCallEntry(input, suffix),
    buildAssistantMessageEntry(input, suffix),
  ];

  if (input.permissionDecision.requiresConfirmation) {
    entries.push(buildRequestConfirmationCallEntry(input, suffix));
    entries.push(buildConfirmationRequestEntry(input, suffix));
  } else if (input.permissionDecision.allowed && input.userConfirmed) {
    entries.push(...buildConfirmedActionEntries(input, suffix));
  }
  return entries;
}

export function confirmationTokenFor(action: DirectorAgentActionEnvelope) {
  return `confirm:${action.actionId}:${action.toolPlan.expectedReceipt}`;
}

export function buildVibeAgentConfirmedActionReportEntry(input: {
  generatedAt: string;
  action: DirectorAgentActionEnvelope;
  outcome: {
    status: "completed" | "blocked" | "failed" | "skipped";
    label: string;
    projectRecordPreserved: boolean;
    waitingReview?: boolean;
    previewReady?: boolean;
    resultStatus?: "ready" | "running";
  };
}): VibeAgentTimelineEntry {
  const dispatchPlan = buildVibeAgentDispatchPlan(input.action);
  const suffix = `${compactId(input.generatedAt)}_${compactId(input.action.actionId).slice(0, 10)}`;
  const blocked = input.outcome.status === "blocked" || input.outcome.status === "failed";
  const nextStep = nextStepLabel(input.outcome, dispatchPlan.executorTool);
  return {
    id: `agent_action_report_${suffix}`,
    type: "action_result",
    createdAt: input.generatedAt,
    title: blocked ? "执行结果需要处理" : "执行结果",
    body: input.outcome.label,
    toolName: dispatchPlan.executorTool,
    actionKind: input.action.kind,
    actionId: input.action.actionId,
    status: blocked ? "blocked" : "done",
    facts: [
      { label: "动作", value: dispatchPlan.label },
      { label: "状态", value: outcomeStatusLabel(input.outcome.status, input.outcome.resultStatus) },
      { label: "项目", value: input.outcome.projectRecordPreserved ? "已保留" : "未写入" },
      { label: "下一步", value: nextStep },
    ],
    details: {
      dispatcherTool: dispatchPlan.dispatcherTool,
      executorTool: dispatchPlan.executorTool,
      outcomeStatus: input.outcome.status,
      resultStatus: input.outcome.resultStatus,
      waitingReview: input.outcome.waitingReview,
      previewReady: input.outcome.previewReady,
      projectRecordPreserved: input.outcome.projectRecordPreserved,
      next: nextStep,
    },
  };
}

export function buildVibeAgentConfirmedActionToolResultEntry(input: {
  generatedAt: string;
  action: DirectorAgentActionEnvelope;
  outcome: {
    status: "completed" | "blocked" | "failed" | "skipped";
    label: string;
    projectRecordPreserved: boolean;
    waitingReview?: boolean;
    previewReady?: boolean;
    resultStatus?: "ready" | "running";
  };
}): VibeAgentTimelineEntry {
  const dispatchPlan = buildVibeAgentDispatchPlan(input.action);
  const suffix = `${compactId(input.generatedAt)}_${compactId(input.action.actionId).slice(0, 10)}`;
  const blocked = input.outcome.status === "blocked" || input.outcome.status === "failed";
  const nextStep = nextStepLabel(input.outcome, dispatchPlan.executorTool);
  return {
    id: `agent_tool_result_confirmed_${suffix}`,
    type: "tool_result",
    createdAt: input.generatedAt,
    title: blocked ? "工具返回：需要处理" : "工具返回",
    body: input.outcome.label,
    toolName: "run_confirmed_action",
    actionKind: input.action.kind,
    actionId: input.action.actionId,
    status: blocked ? "blocked" : "done",
    facts: [
      { label: "执行器", value: dispatchPlan.executorTool },
      { label: "状态", value: outcomeStatusLabel(input.outcome.status, input.outcome.resultStatus) },
      { label: "下一步", value: nextStep },
    ],
    details: {
      dispatcherTool: dispatchPlan.dispatcherTool,
      executorTool: dispatchPlan.executorTool,
      outcomeStatus: input.outcome.status,
      resultStatus: input.outcome.resultStatus,
      waitingReview: input.outcome.waitingReview,
      previewReady: input.outcome.previewReady,
      projectRecordPreserved: input.outcome.projectRecordPreserved,
      next: nextStep,
    },
  };
}

export function buildVibeAgentConfirmedActionStartedEntry(input: {
  generatedAt: string;
  action: DirectorAgentActionEnvelope;
  retry?: boolean;
}): VibeAgentTimelineEntry {
  const dispatchPlan = buildVibeAgentDispatchPlan(input.action);
  const suffix = `${compactId(input.generatedAt)}_${compactId(input.action.actionId).slice(0, 10)}`;
  return {
    id: `agent_tool_call_confirmed_${input.retry ? "retry_" : ""}${suffix}`,
    type: "tool_call",
    createdAt: input.generatedAt,
    title: input.retry ? "重新执行已确认动作" : "执行已确认动作",
    body: `权限和确认已通过，Agent 正在把动作交给「${dispatchPlan.label}」。`,
    toolName: "run_confirmed_action",
    actionKind: input.action.kind,
    actionId: input.action.actionId,
    status: "waiting",
    facts: [
      { label: "动作", value: dispatchPlan.label },
      { label: "目标工具", value: dispatchPlan.executorTool },
      { label: "下一步", value: "等待工具结果" },
    ],
    details: {
      dispatcherTool: dispatchPlan.dispatcherTool,
      executorTool: dispatchPlan.executorTool,
      retry: input.retry === true,
      next: "等待工具结果",
    },
  };
}

function buildUserMessageEntry(
  input: { generatedAt: string; userMessage: string },
  suffix: string,
): VibeAgentTimelineEntry {
  return {
    id: `agent_user_${suffix}`,
    type: "user_message",
    createdAt: input.generatedAt,
    title: "你",
    body: input.userMessage,
    status: "done",
  };
}

function buildInspectProjectCallEntry(
  input: { generatedAt: string },
  suffix: string,
): VibeAgentTimelineEntry {
  return {
    id: `agent_tool_call_inspect_${suffix}`,
    type: "tool_call",
    createdAt: input.generatedAt,
    title: "读取项目",
    body: "Agent 正在读取故事、参考素材和队列状态。",
    toolName: "inspect_project",
    status: "done",
  };
}

function buildInspectProjectResultEntry(
  input: {
    generatedAt: string;
    action: DirectorAgentActionEnvelope;
    projectSnapshot: VibeAgentProjectSnapshot;
  },
  suffix: string,
): VibeAgentTimelineEntry {
  return {
    id: `agent_tool_result_inspect_${suffix}`,
    type: "tool_result",
    createdAt: input.generatedAt,
    title: "项目状态",
    body: input.action.sourceContext.projectReadiness.summary,
    toolName: "inspect_project",
    status: "done",
	    facts: [
	      { label: "镜头", value: `${input.projectSnapshot.totalShots} 个` },
	      { label: "缺参考", value: `${input.projectSnapshot.missingReferences} 个` },
	      { label: "待复核", value: `${input.projectSnapshot.needsReviewReferences} 个` },
	      { label: "视频", value: videoStatusFact(input.projectSnapshot) },
	    ],
	  };
	}

function buildScanAssetsCallEntry(
  input: { generatedAt: string },
  suffix: string,
): VibeAgentTimelineEntry {
  return {
    id: `agent_tool_call_scan_assets_${suffix}`,
    type: "tool_call",
    createdAt: input.generatedAt,
    title: "检查素材",
    body: "Agent 正在判断角色、场景、道具和镜头参考还缺什么。",
    toolName: "scan_assets",
    status: "done",
  };
}

function buildScanAssetsResultEntry(
  input: { generatedAt: string; projectSnapshot: VibeAgentProjectSnapshot },
  suffix: string,
): VibeAgentTimelineEntry {
  const { missingReferences, needsReviewReferences, lockedReferences } = input.projectSnapshot;
  const body = missingReferences > 0
    ? `发现 ${missingReferences} 个参考还缺画面，生成前需要确认。`
    : needsReviewReferences > 0
      ? `发现 ${needsReviewReferences} 个参考需要复核。`
      : "参考素材暂时没有阻断项。";
  return {
    id: `agent_tool_result_scan_assets_${suffix}`,
    type: "tool_result",
    createdAt: input.generatedAt,
    title: "素材检查结果",
    body,
    toolName: "scan_assets",
    status: "done",
    facts: [
      { label: "缺参考", value: `${missingReferences} 个` },
      { label: "待复核", value: `${needsReviewReferences} 个` },
      { label: "已锁定", value: `${lockedReferences} 个` },
    ],
  };
}

function buildPlanNextActionCallEntry(
  input: { generatedAt: string },
  suffix: string,
): VibeAgentTimelineEntry {
  return {
    id: `agent_tool_call_plan_${suffix}`,
    type: "tool_call",
    createdAt: input.generatedAt,
    title: "判断下一步",
    body: "Agent 会结合用户意图、项目状态和权限边界选择一个待确认动作。",
    toolName: "plan_next_action",
    status: "done",
  };
}

function buildPlanNextActionResultEntry(
  input: {
    generatedAt: string;
    action: DirectorAgentActionEnvelope;
    permissionDecision: { reason: string };
  },
  suffix: string,
): VibeAgentTimelineEntry {
  return {
    id: `agent_tool_result_plan_${suffix}`,
    type: "tool_result",
    createdAt: input.generatedAt,
    title: "下一步判断",
    body: input.action.summary,
    toolName: "plan_next_action",
    actionKind: input.action.kind,
    actionId: input.action.actionId,
    status: input.action.status === "blocked" ? "blocked" : "done",
    facts: [
      { label: "动作", value: input.action.kind },
      { label: "目标", value: input.action.target.label },
      { label: "权限", value: input.permissionDecision.reason },
    ],
  };
}

function buildWriteAgentMessageCallEntry(
  input: { generatedAt: string },
  suffix: string,
): VibeAgentTimelineEntry {
  return {
    id: `agent_tool_call_write_message_${suffix}`,
    type: "tool_call",
    createdAt: input.generatedAt,
    title: "组织回复",
    body: "Agent 正在把观察和下一步整理成给创作者看的回复。",
    toolName: "write_agent_message",
    status: "done",
  };
}

function buildAssistantMessageEntry(
  input: {
    generatedAt: string;
    action: DirectorAgentActionEnvelope;
    permissionDecision: { requiresConfirmation: boolean; reason: string };
  },
  suffix: string,
): VibeAgentTimelineEntry {
  const nextActions = directorAgentReadinessActions(input.action.sourceContext.projectReadiness)
    .slice(0, 3)
    .map((item) => item.label)
    .join(" / ");
  return {
    id: `agent_assistant_${suffix}`,
    type: "assistant_message",
    createdAt: input.generatedAt,
    title: "AI 导演",
    body: input.action.userFacingMessage,
    actionKind: input.action.kind,
    actionId: input.action.actionId,
    confirmationRequired: input.permissionDecision.requiresConfirmation,
    status: input.action.status === "blocked" ? "blocked" : "done",
    facts: [
      { label: "下一步", value: input.action.summary },
      { label: "建议队列", value: nextActions || "继续整理当前项目" },
      { label: "权限", value: input.permissionDecision.reason },
    ],
  };
}

function buildRequestConfirmationCallEntry(
  input: {
    generatedAt: string;
    action: DirectorAgentActionEnvelope;
  },
  suffix: string,
): VibeAgentTimelineEntry {
  return {
    id: `agent_tool_call_request_confirmation_${suffix}`,
    type: "tool_call",
    createdAt: input.generatedAt,
    title: "请求确认",
    body: "Agent 已暂停执行，等你确认后才会继续。",
    toolName: "request_user_confirmation",
    actionKind: input.action.kind,
    actionId: input.action.actionId,
    confirmationRequired: true,
    confirmationToken: confirmationTokenFor(input.action),
    status: "waiting",
    facts: confirmationFactsFor(input.action),
    details: confirmationDetailsFor(input.action),
  };
}

function buildConfirmationRequestEntry(
  input: {
    generatedAt: string;
    action: DirectorAgentActionEnvelope;
  },
  suffix: string,
): VibeAgentTimelineEntry {
  return {
    id: `agent_confirmation_${suffix}`,
    type: "confirmation_request",
    createdAt: input.generatedAt,
    title: "等待确认",
    body: confirmationBodyFor(input.action),
    toolName: "request_user_confirmation",
    actionKind: input.action.kind,
    actionId: input.action.actionId,
    confirmationRequired: true,
    confirmationToken: confirmationTokenFor(input.action),
    status: "waiting",
    facts: confirmationFactsFor(input.action),
    details: confirmationDetailsFor(input.action),
  };
}

function buildConfirmedActionEntries(
  input: {
    generatedAt: string;
    action: DirectorAgentActionEnvelope;
  },
  suffix: string,
): VibeAgentTimelineEntry[] {
  const dispatchPlan = buildVibeAgentDispatchPlan(input.action);
  return [
    buildVibeAgentConfirmedActionStartedEntry(input),
    {
      id: `agent_state_confirmed_${suffix}`,
      type: "state_change",
      createdAt: input.generatedAt,
      title: "执行中",
      body: `已进入现有安全执行链路：${dispatchPlan.description}。工具返回后会再写入结果。`,
      toolName: dispatchPlan.executorTool,
      actionKind: input.action.kind,
      actionId: input.action.actionId,
      status: "waiting",
      facts: [
        { label: "执行链路", value: dispatchPlan.label },
        { label: "回执", value: input.action.toolPlan.expectedReceipt },
      ],
      details: {
        executorTool: dispatchPlan.executorTool,
        expectedReceipt: input.action.toolPlan.expectedReceipt,
        next: "等待工具结果",
      },
    },
  ];
}

function confirmationBodyFor(action: DirectorAgentActionEnvelope) {
  if (action.kind === "prepare_reference_generation") {
    return `我准备为 ${action.target.label} 生成参考。确认后才会调用 Image2/参考生成链路，结果回来后还需要复核。`;
  }
  if (action.kind === "prepare_video_submit") {
    return `我准备提交 ${action.target.label} 的视频。确认后才会进入 Seedance 串行队列，不会并发重复提交。`;
  }
  if (action.kind === "prepare_export") {
    return `我准备导出 ${action.target.label}。确认后才会写出交付包和报告文件。`;
  }
  return `我准备处理 ${action.target.label}。这个动作会写入项目草案或修改项目状态，确认后才执行。`;
}

function confirmationFactsFor(action: DirectorAgentActionEnvelope) {
  return [
    { label: "动作", value: action.summary },
    { label: "目标", value: action.target.label },
    { label: "影响", value: affectedScopeLabel(action) },
    { label: "调用", value: providerCallLabel(action) },
  ];
}

function confirmationDetailsFor(action: DirectorAgentActionEnvelope) {
  return {
    next: "等你确认后再执行",
    actionSummary: action.summary,
    targetKind: action.target.kind,
    targetIds: action.target.ids,
    affectedShotIds: action.sourceContext.selectedShotIds,
    selectedAssetId: action.sourceContext.selectedAssetId,
    toolName: action.toolPlan.toolName,
    expectedReceipt: action.toolPlan.expectedReceipt,
    providerSubmitAllowed: action.toolPlan.providerSubmitAllowed,
  };
}

function affectedScopeLabel(action: DirectorAgentActionEnvelope) {
  if (action.sourceContext.selectedShotIds.length > 0) {
    return `${action.sourceContext.selectedShotIds.length} 个镜头`;
  }
  if (action.target.kind === "asset") return "1 个素材";
  if (action.target.kind === "section") return action.target.label;
  if (action.target.kind === "multi_shot") return `${action.target.ids.length} 个镜头`;
  if (action.target.kind === "shot") return "1 个镜头";
  return "整个项目";
}

function providerCallLabel(action: DirectorAgentActionEnvelope) {
	  if (action.toolPlan.toolName === "image2_reference_generation") return "Image2 / 参考生成";
	  if (action.kind === "query_video_result") return "Seedance / 查询视频结果";
	  if (action.toolPlan.toolName === "seedance_video_submit") return "Seedance / 视频提交";
	  if (action.toolPlan.toolName === "web_search") return "联网查资料";
  if (action.toolPlan.toolName === "project_export") return "本地导出";
  return "只写项目";
}

function videoStatusFact(snapshot: VibeAgentProjectSnapshot) {
  if (snapshot.videoCanResume) return "可查询结果";
  if (snapshot.videoWaitingCount > 0) return `等待中 ${snapshot.videoWaitingCount}`;
  if (snapshot.videoReviewCount > 0) return `待复核 ${snapshot.videoReviewCount}`;
  if (snapshot.videoCompletedCount > 0) return `已完成 ${snapshot.videoCompletedCount}`;
  return snapshot.videoStatus || "未提交";
}

function outcomeStatusLabel(
  status: "completed" | "blocked" | "failed" | "skipped",
  resultStatus?: "ready" | "running",
) {
  if (status === "blocked") return "已暂停";
  if (status === "failed") return "失败";
  if (status === "skipped") return "跳过";
  if (resultStatus === "running") return "进行中";
  if (resultStatus === "ready") return "可复核";
  return "完成";
}

function nextStepLabel(
  outcome: {
    status: "completed" | "blocked" | "failed" | "skipped";
    waitingReview?: boolean;
    previewReady?: boolean;
    resultStatus?: "ready" | "running";
  },
  executorTool: string,
) {
  if (outcome.status === "blocked" || outcome.status === "failed") return "调整后重试";
  if (outcome.previewReady) return "去预览复核";
  if (outcome.waitingReview) return "去参考复核";
	if (outcome.resultStatus === "running") return executorTool === "submit_video" || executorTool === "query_video" ? "等待视频结果" : "等待结果";
  if (executorTool === "export_project") return "去交付页查看";
  return "继续下一步";
}

function compactId(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "").slice(0, 24).toLowerCase() || "now";
}
