import {
  directorAgentDisplayTargetLabel,
  directorAgentReadinessActions,
  type DirectorAgentActionEnvelope,
} from "../core/directorAgentAction";
import { buildVibeAgentDispatchPlan } from "./actionDispatch";
import type {
  VibeAgentActionLifecycleStatus,
  VibeAgentExecutionResultSummary,
  VibeAgentFact,
  VibeAgentProjectSnapshot,
  VibeAgentTimelineEntry,
} from "./types";

type ConfirmedActionOutcomeForTimeline = {
  status: "completed" | "blocked" | "failed" | "skipped";
  label: string;
  projectRecordPreserved: boolean;
  waitingReview?: boolean;
  previewReady?: boolean;
  resultStatus?: "ready" | "running";
  resultFacts?: VibeAgentFact[];
};

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
    buildAgentUnderstandingEntry(input, suffix),
    buildInspectProjectCallEntry(input, suffix),
    buildInspectProjectResultEntry(input, suffix),
    buildClassifyAssetsCallEntry(input, suffix),
    buildClassifyAssetsResultEntry(input, suffix),
    buildPlanNextActionCallEntry(input, suffix),
    buildPlanNextActionResultEntry(input, suffix),
    buildExecutionBoundaryResultEntry(input, suffix),
    ...buildSkillRecommendationEntries(input, suffix),
    buildWriteAgentMessageCallEntry(input, suffix),
    buildAssistantMessageEntry(input, suffix),
  ];

  if (input.action.status !== "blocked" && input.permissionDecision.requiresConfirmation) {
    entries.push(buildRequestConfirmationCallEntry(input, suffix));
    entries.push(buildConfirmationRequestEntry(input, suffix));
  } else if (input.action.status !== "blocked" && input.permissionDecision.allowed && input.userConfirmed) {
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
  outcome: ConfirmedActionOutcomeForTimeline;
}): VibeAgentTimelineEntry {
  const dispatchPlan = buildVibeAgentDispatchPlan(input.action);
  const suffix = `${compactId(input.generatedAt)}_${compactId(input.action.actionId).slice(0, 10)}`;
  const blocked = input.outcome.status === "blocked" || input.outcome.status === "failed";
  const nextStep = nextStepLabel(input.outcome, dispatchPlan.executorTool);
  const resultLocation = resultLocationFor(input.outcome, dispatchPlan.executorTool);
  const selectedContext = selectedContextDetailsFor(input.action);
  const executionResult = confirmedExecutionResultFor(input.outcome, nextStep);
  const resultFacts = confirmedOutcomeResultFacts(input.outcome);
  const body = confirmedActionResultBodyFor({
    actionLabel: dispatchPlan.label,
    outcome: input.outcome,
    resultLocationLabel: resultLocation.label,
    nextStep,
  });
  return {
    id: `agent_action_report_${suffix}`,
    type: "action_result",
    createdAt: input.generatedAt,
    title: resultCardTitleFor(input.outcome, dispatchPlan.executorTool),
    body,
    lifecycle: lifecycleForOutcome(input.outcome),
    toolName: dispatchPlan.executorTool,
    actionKind: input.action.kind,
    actionId: input.action.actionId,
    status: blocked ? "blocked" : "done",
    facts: [
      { label: "动作", value: dispatchPlan.label },
      { label: "对象", value: selectedContext.label },
      { label: "范围", value: affectedScopeLabel(input.action) },
      { label: "状态", value: outcomeStatusLabel(input.outcome.status, input.outcome.resultStatus) },
      ...resultFacts,
      { label: "查看", value: resultLocation.label },
      { label: "下一步", value: nextStep },
    ],
    details: {
      selectedContext,
      dispatcherTool: dispatchPlan.dispatcherTool,
      executorTool: dispatchPlan.executorTool,
      outcomeStatus: input.outcome.status,
      lifecycle: lifecycleForOutcome(input.outcome),
      executionResult,
      resultStatus: input.outcome.resultStatus,
      waitingReview: input.outcome.waitingReview,
      previewReady: input.outcome.previewReady,
      resultFacts,
      projectRecordPreserved: input.outcome.projectRecordPreserved,
      resultView: resultLocation.view,
      next: nextStep,
    },
  };
}

export function buildVibeAgentConfirmedActionToolResultEntry(input: {
  generatedAt: string;
  action: DirectorAgentActionEnvelope;
  outcome: ConfirmedActionOutcomeForTimeline;
}): VibeAgentTimelineEntry {
  const dispatchPlan = buildVibeAgentDispatchPlan(input.action);
  const suffix = `${compactId(input.generatedAt)}_${compactId(input.action.actionId).slice(0, 10)}`;
  const blocked = input.outcome.status === "blocked" || input.outcome.status === "failed";
  const nextStep = nextStepLabel(input.outcome, dispatchPlan.executorTool);
  const resultLocation = resultLocationFor(input.outcome, dispatchPlan.executorTool);
  const selectedContext = selectedContextDetailsFor(input.action);
  const executionResult = confirmedExecutionResultFor(input.outcome, nextStep);
  const resultFacts = confirmedOutcomeResultFacts(input.outcome);
  const body = confirmedActionResultBodyFor({
    actionLabel: dispatchPlan.label,
    outcome: input.outcome,
    resultLocationLabel: resultLocation.label,
    nextStep,
  });
  return {
    id: `agent_tool_result_confirmed_${suffix}`,
    type: "tool_result",
    createdAt: input.generatedAt,
    title: blocked ? "执行结果：需要处理" : "执行结果",
    body,
    lifecycle: lifecycleForOutcome(input.outcome),
    toolName: "run_confirmed_action",
    actionKind: input.action.kind,
    actionId: input.action.actionId,
    status: blocked ? "blocked" : "done",
    facts: [
      { label: "动作", value: dispatchPlan.label },
      { label: "对象", value: selectedContext.label },
      { label: "范围", value: affectedScopeLabel(input.action) },
      { label: "状态", value: outcomeStatusLabel(input.outcome.status, input.outcome.resultStatus) },
      ...resultFacts,
      { label: "查看", value: resultLocation.label },
      { label: "下一步", value: nextStep },
    ],
    details: {
      selectedContext,
      dispatcherTool: dispatchPlan.dispatcherTool,
      executorTool: dispatchPlan.executorTool,
      outcomeStatus: input.outcome.status,
      lifecycle: lifecycleForOutcome(input.outcome),
      executionResult,
      resultStatus: input.outcome.resultStatus,
      waitingReview: input.outcome.waitingReview,
      previewReady: input.outcome.previewReady,
      resultFacts,
      projectRecordPreserved: input.outcome.projectRecordPreserved,
      resultView: resultLocation.view,
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
  const selectedContext = selectedContextDetailsFor(input.action);
  return {
    id: `agent_tool_call_confirmed_${input.retry ? "retry_" : ""}${suffix}`,
    type: "tool_call",
    createdAt: input.generatedAt,
    title: input.retry ? "重新执行已确认动作" : "执行已确认动作",
    body: `权限和确认已通过，Agent 正在把动作交给「${dispatchPlan.label}」。`,
    lifecycle: "running",
    toolName: "run_confirmed_action",
    actionKind: input.action.kind,
    actionId: input.action.actionId,
    status: "waiting",
    facts: [
      { label: "动作", value: dispatchPlan.label },
      { label: "对象", value: selectedContext.label },
      { label: "范围", value: affectedScopeLabel(input.action) },
      { label: "状态", value: "执行中" },
      { label: "下一步", value: "等待执行结果" },
    ],
    details: {
      selectedContext,
      dispatcherTool: dispatchPlan.dispatcherTool,
      executorTool: dispatchPlan.executorTool,
      retry: input.retry === true,
      next: "等待执行结果",
    },
  };
}

function buildUserMessageEntry(
  input: {
    generatedAt: string;
    userMessage: string;
    action: DirectorAgentActionEnvelope;
    projectSnapshot: VibeAgentProjectSnapshot;
    permissionDecision: { reason: string };
  },
  suffix: string,
): VibeAgentTimelineEntry {
  const selectedContext = selectedContextDetailsFor(input.action);
  const deicticCue = selectedContextCueFor(input.action, selectedContext.label);
  return {
    id: `agent_user_${suffix}`,
    type: "user_message",
    createdAt: input.generatedAt,
    title: "你",
    body: input.userMessage,
    status: "done",
    facts: userMessageFactsFor(input, selectedContext, deicticCue),
    details: {
      selectedContext,
      deicticCue,
      selectedShotIds: input.action.sourceContext.selectedShotIds,
      selectedAssetId: input.action.sourceContext.selectedAssetId,
      sectionId: input.action.sourceContext.sectionId,
      currentView: input.action.sourceContext.currentView,
    },
  };
}

function userMessageFactsFor(
  input: {
    action: DirectorAgentActionEnvelope;
    projectSnapshot: VibeAgentProjectSnapshot;
    permissionDecision: { reason: string };
  },
  selectedContext: ReturnType<typeof selectedContextDetailsFor>,
  deicticCue: string | undefined,
) {
  const facts = [
    { label: "引用", value: selectedContext.label },
    deicticCue ? { label: "这个指向", value: deicticCue } : undefined,
    input.action.sourceContext.currentView
      ? { label: "正在看", value: currentViewLabel(input.action.sourceContext.currentView) }
      : undefined,
    !deicticCue && input.projectSnapshot.totalShots
      ? { label: "项目", value: `${input.projectSnapshot.totalShots} 个镜头` }
      : undefined,
    { label: "边界", value: input.permissionDecision.reason },
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact?.value));
  return facts.slice(0, 4);
}

function selectedContextDetailsFor(action: DirectorAgentActionEnvelope) {
  return {
    kind: action.target.kind,
    label: directorAgentDisplayTargetLabel(action.target, action.sourceContext),
    ids: action.target.ids,
  };
}

function selectedContextCueFor(action: DirectorAgentActionEnvelope, label: string) {
  const intent = action.sourceContext.userIntent || "";
  if (!/(这个|这段|这张|这里|它)/u.test(intent) && !/\b(this|it)\b/iu.test(intent)) return undefined;
  return label;
}

function buildAgentUnderstandingEntry(
  input: {
    generatedAt: string;
    action: DirectorAgentActionEnvelope;
    permissionDecision: { requiresConfirmation: boolean; reason: string };
    userConfirmed: boolean;
  },
  suffix: string,
): VibeAgentTimelineEntry {
  const targetLabel = directorAgentDisplayTargetLabel(input.action.target, input.action.sourceContext);
  const deicticCue = selectedContextCueFor(input.action, targetLabel);
  const dispatchPlan = buildVibeAgentDispatchPlan(input.action);
  const lifecycle = input.action.status === "blocked"
    ? "needs_user_input"
    : input.userConfirmed
      ? "running"
      : input.permissionDecision.requiresConfirmation
      ? "waiting_for_confirmation"
      : "proposed";
  const scopeSentence = deicticCue
    ? `这里的“这个”我会理解为「${deicticCue}」。`
    : `本轮范围是「${targetLabel}」。`;
  return {
    id: `agent_understanding_${suffix}`,
    type: "assistant_message",
    createdAt: input.generatedAt,
    title: "我理解为",
    body: `${scopeSentence}你想让我处理：${input.action.summary}。我会先按当前权限边界整理，不会绕过确认直接执行。`,
    lifecycle,
    actionKind: input.action.kind,
    actionId: input.action.actionId,
    status: input.action.status === "blocked" ? "blocked" : "done",
    facts: [
      { label: "引用", value: targetLabel },
      deicticCue ? { label: "这个指向", value: deicticCue } : undefined,
      { label: "动作", value: dispatchPlan.label },
      { label: "边界", value: input.permissionDecision.reason },
    ].filter((fact): fact is { label: string; value: string } => Boolean(fact)),
    details: {
      selectedContext: selectedContextDetailsFor(input.action),
      deicticCue,
      executorTool: dispatchPlan.executorTool,
      next: input.userConfirmed
        ? "继续看我下面的执行结果"
        : input.permissionDecision.requiresConfirmation ? "继续看我下面的确认项" : "继续看我下面的执行判断",
    },
  };
}

function currentViewLabel(value: string) {
  if (value === "story") return "故事";
  if (value === "reference") return "参考";
  if (value === "preview") return "预览";
  if (value === "export") return "交付";
  if (value === "section") return "段落";
  return value;
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
	      { label: "层级", value: projectHierarchyFact(input.projectSnapshot) },
	      { label: "镜头", value: `${input.projectSnapshot.totalShots} 个` },
	      { label: "缺参考", value: `${input.projectSnapshot.missingReferences} 个` },
	      { label: "待复核", value: `${input.projectSnapshot.needsReviewReferences} 个` },
	      { label: "诊断", value: projectDiagnosticFact(input) },
	      { label: "视频", value: videoStatusFact(input.projectSnapshot) },
	    ],
	  };
	}

function projectHierarchyFact(snapshot: VibeAgentProjectSnapshot) {
  const storyPart = snapshot.totalSections > 0
    ? `${snapshot.totalSections} 段 / ${snapshot.totalShots} 镜头`
    : `短项目 / ${snapshot.totalShots} 镜头`;
  return `${storyPart} / ${snapshot.totalAssets} 素材 / ${snapshot.skillCount} Skills`;
}

function projectDiagnosticFact(input: {
  action: DirectorAgentActionEnvelope;
  projectSnapshot: VibeAgentProjectSnapshot;
}) {
  const diagnostics: string[] = [];
  if (input.projectSnapshot.missingReferences > 0) diagnostics.push(`${input.projectSnapshot.missingReferences} 项参考待补`);
  const reviewCount = Math.max(
    input.projectSnapshot.needsReviewReferences,
    input.projectSnapshot.assetInbox?.needsReviewCount || 0,
  );
  if (reviewCount > 0) diagnostics.push(`${reviewCount} 项素材待确认`);
  if (/待判断/.test(input.action.sourceContext.projectReadiness.modeSummary)) diagnostics.push("有镜头方式待判断");
  const selectedScenes = Array.from(new Set(input.action.sourceContext.selectedShotContexts
    .flatMap((shot) => shot.context.sceneGuidance)
    .map((value) => value.trim())
    .filter(Boolean)));
  if (selectedScenes.length > 1) diagnostics.push("选中镜头跨多个场景");
  if (input.action.sourceContext.videoState.canResume || input.action.sourceContext.videoState.waitingCount > 0) diagnostics.push("先查视频回流");
  return diagnostics.slice(0, 3).join("；") || "暂无明显阻断";
}

function buildClassifyAssetsCallEntry(
  input: { generatedAt: string },
  suffix: string,
): VibeAgentTimelineEntry {
  return {
    id: `agent_tool_call_classify_assets_${suffix}`,
    type: "tool_call",
    createdAt: input.generatedAt,
    title: "识别素材",
    body: "Agent 正在判断脚本、角色、场景、道具、声音和已生成结果分别怎么用。",
    toolName: "classify_assets",
    status: "done",
  };
}

function buildClassifyAssetsResultEntry(
  input: { generatedAt: string; projectSnapshot: VibeAgentProjectSnapshot },
  suffix: string,
): VibeAgentTimelineEntry {
  const { missingReferences, needsReviewReferences, lockedReferences } = input.projectSnapshot;
  const assetInbox = input.projectSnapshot.assetInbox;
  const kindSummary = assetKindSummaryLabel(assetInbox);
  const reviewItems = assetInbox?.items.filter((item) => item.needsReview).slice(0, 3) || [];
  const foldedDetailItems = assetInbox?.items.filter(isFoldedDetailAssetItem).slice(0, 3) || [];
  const bindingHints = reviewItems.map(assetBindingHintLabel).filter(Boolean);
  const next = classifyAssetsNextAction(input.projectSnapshot);
  const assetFacts = (reviewItems.length ? reviewItems : assetInbox?.items.slice(0, 3) || []).map((item, index) => ({
    label: reviewItems.length ? `先确认 ${index + 1}` : `建议 ${index + 1}`,
    value: `${item.label}：${item.suggestedAction || "确认用途"}；${item.suggestedBinding}`,
  }));
  const reviewLabels = reviewItems.map((item) => item.label).join("、");
  const foldedDetailLabels = foldedDetailItems.map((item) => item.label).join("、");
  const body = assetInbox?.totalCount
    ? `${assetInbox.summary}${kindSummary ? ` 我看到的类型：${kindSummary}。` : ""}${reviewLabels ? ` 需要你确认：${reviewLabels}。` : " "}${bindingHints.length ? ` 绑定建议：${bindingHints.join("；")}。` : ""}${foldedDetailLabels ? ` 局部细节会并入主体或镜头说明，不单独生成参考：${foldedDetailLabels}。` : ""} ${assetInbox.nextAction}`
    : missingReferences > 0
      ? `发现 ${missingReferences} 个参考还缺画面，生成前需要确认。`
      : needsReviewReferences > 0
        ? `发现 ${needsReviewReferences} 个参考需要复核。`
        : "参考素材暂时没有阻断项。";
  const facts = assetInbox?.totalCount
    ? [
        { label: "识别素材", value: `${assetInbox.totalCount} 个` },
        ...(kindSummary ? [{ label: "分类", value: kindSummary }] : []),
        { label: "需要确认", value: `${assetInbox.needsReviewCount} 个` },
        ...(foldedDetailLabels ? [{ label: "并入说明", value: foldedDetailLabels }] : []),
        { label: "下一步", value: next },
        ...assetFacts,
      ]
    : [
        { label: "缺参考", value: `${missingReferences} 个` },
        { label: "待复核", value: `${needsReviewReferences} 个` },
        { label: "已锁定", value: `${lockedReferences} 个` },
        { label: "下一步", value: next },
        ...assetFacts,
      ];
  return {
    id: `agent_tool_result_classify_assets_${suffix}`,
    type: "tool_result",
    createdAt: input.generatedAt,
    title: "素材识别结果",
    body,
    toolName: "classify_assets",
    status: "done",
    facts: facts.slice(0, 8),
    details: assetInbox
      ? {
          assetInbox,
          assetReviewSummary: {
            total: assetInbox.totalCount,
            needsReview: assetInbox.needsReviewCount,
            reviewLabels: reviewItems.map((item) => item.label),
            bindingHints,
            foldedDetailLabels: foldedDetailItems.map((item) => item.label),
            next,
          },
          next,
        }
      : { next },
  };
}

function assetBindingHintLabel(item: NonNullable<VibeAgentProjectSnapshot["assetInbox"]>["items"][number]) {
  const action = item.suggestedAction?.trim();
  const binding = item.suggestedBinding?.trim();
  if (!action && !binding) return "";
  return `${item.label} → ${action || binding}${action && binding ? ` / ${binding}` : ""}`;
}

function isFoldedDetailAssetItem(item: NonNullable<VibeAgentProjectSnapshot["assetInbox"]>["items"][number]) {
  return /局部细节|不单独生成参考|并入主体|镜头说明/.test([
    item.detail,
    item.suggestedBinding,
    item.suggestedAction,
    item.reason,
  ].join(" "));
}

function classifyAssetsNextAction(snapshot: VibeAgentProjectSnapshot) {
  const assetInbox = snapshot.assetInbox;
  if (assetInbox?.needsReviewCount) return assetInbox.nextAction;
  if (snapshot.missingReferences > 0) return "确认范围后生成参考";
  if (snapshot.needsReviewReferences > 0) return "先复核参考是否可用";
  if (snapshot.lockedReferences > 0 || assetInbox?.totalCount) return "继续规划镜头或发送视频";
  return "继续描述项目想法或拖入素材";
}

function assetKindSummaryLabel(assetInbox?: VibeAgentProjectSnapshot["assetInbox"]) {
  const parts = (assetInbox?.kindSummary || [])
    .filter((item) => item.count > 0)
    .slice(0, 5)
    .map((item) => `${item.label} ${item.count}`);
  return parts.join("、");
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
    permissionDecision: { requiresConfirmation: boolean; reason: string };
  },
  suffix: string,
): VibeAgentTimelineEntry {
  const dispatchPlan = buildVibeAgentDispatchPlan(input.action);
  const blocked = input.action.status === "blocked";
  const completedObservation = !blocked
    && !input.permissionDecision.requiresConfirmation
    && isImmediateObservationTool(dispatchPlan.executorTool);
  const next = blocked
    ? blockedOrFailedNextStepLabel(dispatchPlan.executorTool)
    : completedObservation
      ? immediateObservationNextLabel(dispatchPlan.executorTool)
    : input.permissionDecision.requiresConfirmation
      ? "等你确认"
      : "继续下一步";
  const fileImpact = plannedFileImpactLabel(input.action, dispatchPlan.executorTool);
  const targetLabel = directorAgentDisplayTargetLabel(input.action.target, input.action.sourceContext);
  return {
    id: `agent_tool_result_plan_${suffix}`,
    type: "tool_result",
    createdAt: input.generatedAt,
    title: "下一步判断",
    body: planNextActionBodyFor({
      action: input.action,
      label: dispatchPlan.label,
      targetLabel,
      fileImpact,
      blocked,
      next,
    }),
    lifecycle: blocked ? "needs_user_input" : completedObservation ? "succeeded" : "proposed",
    toolName: "plan_next_action",
    actionKind: input.action.kind,
    actionId: input.action.actionId,
    status: blocked ? "blocked" : "done",
    facts: [
      { label: "动作", value: dispatchPlan.label },
      { label: "目标", value: targetLabel },
      { label: "成本", value: costBoundaryLabel(input.action) },
      { label: "外部提交", value: externalSubmissionBoundaryLabel(input.action) },
      ...(blocked
        ? [{ label: "需要处理", value: blockerSummaryFor(input.action) }]
        : [{ label: "写入", value: fileImpact }]),
      { label: "下一步", value: next },
    ],
    details: {
      executorTool: dispatchPlan.executorTool,
      originalActionKind: input.action.kind,
      permissionBoundary: input.permissionDecision.reason,
      fileImpact,
      blockers: input.action.blockers,
      next,
    },
  };
}

function buildExecutionBoundaryResultEntry(
  input: {
    generatedAt: string;
    action: DirectorAgentActionEnvelope;
    permissionDecision: { allowed: boolean; requiresConfirmation: boolean; reason: string };
    userConfirmed: boolean;
  },
  suffix: string,
): VibeAgentTimelineEntry {
  const dispatchPlan = buildVibeAgentDispatchPlan(input.action);
  const blocked = input.action.status === "blocked" || (!input.permissionDecision.allowed && !input.permissionDecision.requiresConfirmation);
  const completedObservation = !blocked
    && !input.userConfirmed
    && !input.permissionDecision.requiresConfirmation
    && isImmediateObservationTool(dispatchPlan.executorTool);
  const lifecycle = blocked
    ? "needs_user_input"
    : completedObservation
      ? "succeeded"
    : input.userConfirmed
      ? "running"
      : input.permissionDecision.requiresConfirmation
        ? "waiting_for_confirmation"
        : "proposed";
  const externalSubmission = dispatchPlan.executorTool === "submit_video";
  const costLabel = externalSubmission
    ? "会提交 Seedance 视频任务"
    : dispatchPlan.executorTool === "generate_references"
      ? "会调用参考生成"
      : dispatchPlan.executorTool === "research_style"
        ? "会联网查资料"
        : dispatchPlan.executor.callsProvider
          ? "会调用生成或联网服务"
          : dispatchPlan.executor.mutatesProject
            ? "只保存项目修改"
            : "只读取项目";
  const next = blocked
    ? blockedOrFailedNextStepLabel(dispatchPlan.executorTool)
    : completedObservation
      ? immediateObservationNextLabel(dispatchPlan.executorTool)
    : input.userConfirmed
      ? "等待执行结果"
      : input.permissionDecision.requiresConfirmation
        ? "等你确认"
        : "可以继续";
  return {
    id: `agent_tool_result_execution_boundary_${suffix}`,
    type: "tool_result",
    createdAt: input.generatedAt,
    title: "执行边界",
    body: executionBoundaryBodyFor({
      actionLabel: dispatchPlan.label,
      costLabel,
      externalSubmission,
      mutatesProject: dispatchPlan.executor.mutatesProject,
      requiresConfirmation: input.permissionDecision.requiresConfirmation,
      userConfirmed: input.userConfirmed,
      blocked,
    }),
    lifecycle,
    toolName: "plan_next_action",
    actionKind: input.action.kind,
    actionId: input.action.actionId,
    status: blocked ? "blocked" : input.userConfirmed ? "waiting" : "done",
    facts: [
      { label: "动作", value: dispatchPlan.label },
      { label: "成本", value: costLabel },
      { label: "写入", value: dispatchPlan.executor.mutatesProject ? plannedFileImpactLabel(input.action, dispatchPlan.executorTool) : "不写文件" },
      { label: "外部提交", value: externalSubmission ? "会提交 Seedance" : "不提交视频" },
      { label: "确认", value: input.userConfirmed ? "已确认" : input.permissionDecision.requiresConfirmation ? "等待确认" : "不需要确认" },
      { label: "下一步", value: next },
    ],
    details: {
      executionBoundary: {
        mutatesProject: dispatchPlan.executor.mutatesProject,
        callsProvider: dispatchPlan.executor.callsProvider,
        submitsExternalTask: externalSubmission,
        requiresConfirmation: input.permissionDecision.requiresConfirmation,
        summary: costLabel,
      },
      executionResult: {
        lifecycle,
        status: blocked
          ? "blocked"
          : completedObservation
            ? "succeeded"
          : input.userConfirmed
            ? "running"
            : input.permissionDecision.requiresConfirmation
              ? "awaiting_confirmation"
              : "ready_to_run",
        summary: blocked
          ? blockerSummaryFor(input.action)
          : completedObservation
            ? immediateObservationSummary(dispatchPlan.executorTool)
            : input.permissionDecision.reason,
        next,
      },
      executorTool: dispatchPlan.executorTool,
      next,
    },
  };
}

function executionBoundaryBodyFor(input: {
  actionLabel: string;
  costLabel: string;
  externalSubmission: boolean;
  mutatesProject: boolean;
  requiresConfirmation: boolean;
  userConfirmed: boolean;
  blocked: boolean;
}) {
  if (input.blocked) {
    return `这一步暂时不能执行。我会先说明阻断原因，不会修改项目，也不会调用生成服务。`;
  }
  const confirmation = input.userConfirmed
    ? "你已经确认，我会开始执行。"
    : input.requiresConfirmation
      ? "我会停在这里等你确认。"
      : "这一步只做读取或整理，可以直接继续。";
  const write = input.mutatesProject ? "会保存到当前项目" : "不会修改项目";
  const submission = input.externalSubmission ? "会提交 Seedance 串行任务" : "不提交视频";
  return `本轮动作是「${input.actionLabel}」：${input.costLabel}，${write}，${submission}。${confirmation}`;
}

function isImmediateObservationTool(toolName: string) {
  return toolName === "inspect_project" || toolName === "classify_assets";
}

function immediateObservationSummary(toolName: string) {
  return toolName === "classify_assets"
    ? "已整理素材用途和绑定建议"
    : "已读取项目状态";
}

function immediateObservationNextLabel(toolName: string) {
  return toolName === "classify_assets"
    ? "确认素材用途或继续规划"
    : "按项目状态继续";
}

type SkillRecommendation = {
  strategy: "storyboard_narrative" | "storyboard_rapid_cut" | "omni_reference";
  label: string;
  reason: string;
  affectedShots: string[];
  impact: string[];
};

const skillRecommendationMeta: Record<SkillRecommendation["strategy"], Omit<SkillRecommendation, "strategy" | "affectedShots">> = {
  storyboard_narrative: {
    label: "故事板叙事",
    reason: "这类镜头需要先稳住构图、站位、阅读顺序和情绪承接。",
    impact: ["故事规划", "参考图", "Seedance prompt", "QA"],
  },
  storyboard_rapid_cut: {
    label: "故事板快切",
    reason: "这类镜头动作或切点密度高，需要先锁动作顺序、速度和运镜节奏。",
    impact: ["故事规划", "参考图", "Seedance prompt", "QA"],
  },
  omni_reference: {
    label: "全能参考",
    reason: "这类镜头主动作集中，用角色、场景、道具参考加文字导演说明更干净。",
    impact: ["故事规划", "Seedance prompt", "QA"],
  },
};

function buildSkillRecommendationEntries(
  input: {
    generatedAt: string;
    action: DirectorAgentActionEnvelope;
  },
  suffix: string,
): VibeAgentTimelineEntry[] {
  const recommendations = skillRecommendationsFor(input.action);
  if (!recommendations.length) return [];

  const skillLabels = recommendations.map((item) => item.label).join(" / ");
  const affectedShots = uniqueStrings(recommendations.flatMap((item) => item.affectedShots));
  const impacts = uniqueStrings(recommendations.flatMap((item) => item.impact));
  const reason = recommendations.map((item) => `${item.label}：${item.reason}`).join(" ");

  return [{
    id: `agent_tool_result_skills_${suffix}`,
    type: "tool_result",
    createdAt: input.generatedAt,
    title: "推荐 Skills",
    body: `我会用 ${skillLabels} 组织这一步。${reason}`,
    lifecycle: "proposed",
    toolName: "plan_next_action",
    actionKind: input.action.kind,
    actionId: input.action.actionId,
    status: "done",
    facts: [
      { label: "Skill", value: skillLabels },
      { label: "影响镜头", value: affectedShots.join("、") || "当前目标" },
      { label: "影响环节", value: impacts.join(" / ") },
    ],
    details: {
      skillRecommendations: recommendations,
    },
  }];
}

function skillRecommendationsFor(action: DirectorAgentActionEnvelope): SkillRecommendation[] {
  const grouped = new Map<SkillRecommendation["strategy"], SkillRecommendation>();
  action.sourceContext.selectedShotContexts.forEach((shot) => {
    const strategy = shot.referenceStrategy;
    if (!isKnownSkillStrategy(strategy)) return;
    const meta = skillRecommendationMeta[strategy];
    const shotLabel = [shot.displayNumber, shot.title].filter(Boolean).join(" ");
    const current = grouped.get(strategy);
    if (current) {
      current.affectedShots.push(shotLabel || shot.id);
      return;
    }
    grouped.set(strategy, {
      strategy,
      label: meta.label,
      reason: meta.reason,
      affectedShots: [shotLabel || shot.id],
      impact: meta.impact,
    });
  });
  return Array.from(grouped.values()).map((item) => ({
    ...item,
    affectedShots: uniqueStrings(item.affectedShots),
  }));
}

function isKnownSkillStrategy(value: unknown): value is SkillRecommendation["strategy"] {
  return value === "storyboard_narrative" || value === "storyboard_rapid_cut" || value === "omni_reference";
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
  const dispatchPlan = buildVibeAgentDispatchPlan(input.action);
  const completedObservation = input.action.status !== "blocked"
    && !input.permissionDecision.requiresConfirmation
    && isImmediateObservationTool(dispatchPlan.executorTool);
  return {
    id: `agent_assistant_${suffix}`,
    type: "assistant_message",
    createdAt: input.generatedAt,
    title: "AI 导演",
    body: assistantMessageBodyFor({
      actionMessage: input.action.userFacingMessage,
      completedObservation,
      executorTool: dispatchPlan.executorTool,
    }),
    lifecycle: input.action.status === "blocked"
      ? "needs_user_input"
      : completedObservation
        ? "succeeded"
      : input.permissionDecision.requiresConfirmation
        ? "waiting_for_confirmation"
        : "proposed",
    actionKind: input.action.kind,
    actionId: input.action.actionId,
    confirmationRequired: input.permissionDecision.requiresConfirmation,
    status: input.action.status === "blocked" ? "blocked" : "done",
    facts: [
      { label: "下一步", value: input.action.summary },
      { label: "建议队列", value: nextActions || "继续整理当前项目" },
      { label: "边界", value: input.permissionDecision.reason },
    ],
  };
}

function assistantMessageBodyFor(input: {
  actionMessage: string;
  completedObservation: boolean;
  executorTool: string;
}) {
  if (!input.completedObservation) return input.actionMessage;
  return `${immediateObservationSummary(input.executorTool)}，结果已经写进上面的消息流。${immediateObservationNextLabel(input.executorTool)}。`;
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
    lifecycle: "waiting_for_confirmation",
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
    title: `请确认：${confirmationActionTitleFor(input.action)}`,
    body: confirmationBodyFor(input.action),
    lifecycle: "waiting_for_confirmation",
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
  const selectedContext = selectedContextDetailsFor(input.action);
  return [
    buildVibeAgentConfirmedActionStartedEntry(input),
    {
      id: `agent_state_confirmed_${suffix}`,
      type: "state_change",
      createdAt: input.generatedAt,
      title: "执行中",
      body: `已通过确认，正在执行：${dispatchPlan.description}。完成后我会把结果写回消息流。`,
      lifecycle: "running",
      toolName: dispatchPlan.executorTool,
      actionKind: input.action.kind,
      actionId: input.action.actionId,
      status: "waiting",
      facts: [
        { label: "动作", value: dispatchPlan.label },
        { label: "对象", value: selectedContext.label },
        { label: "范围", value: affectedScopeLabel(input.action) },
        { label: "下一步", value: "等待执行结果" },
      ],
      details: {
        selectedContext,
        executorTool: dispatchPlan.executorTool,
        expectedReceipt: input.action.toolPlan.expectedReceipt,
        next: "等待执行结果",
      },
    },
  ];
}

function confirmationBodyFor(action: DirectorAgentActionEnvelope) {
  if (action.kind === "prepare_reference_generation") {
    return `我准备为 ${directorAgentDisplayTargetLabel(action.target, action.sourceContext)} 生成参考。确认后才会调用 Image2/参考生成链路，结果回来后还需要复核。`;
  }
  if (action.kind === "prepare_video_submit") {
    if (buildVibeAgentDispatchPlan(action).executorTool === "compile_video_request") {
      return `我会先为 ${directorAgentDisplayTargetLabel(action.target, action.sourceContext)} 准备可复核的视频请求和参考顺序，不提交视频。`;
    }
    return `我准备提交 ${directorAgentDisplayTargetLabel(action.target, action.sourceContext)} 的视频。确认后才会进入 Seedance 串行队列，不会并发重复提交。`;
  }
  if (action.kind === "prepare_export") {
    return `我准备导出 ${directorAgentDisplayTargetLabel(action.target, action.sourceContext)}。确认后才会写出交付包和报告文件。`;
  }
  return `我准备处理 ${directorAgentDisplayTargetLabel(action.target, action.sourceContext)}。这个动作会保存一版修改草案，确认后才执行。`;
}

function confirmationFactsFor(action: DirectorAgentActionEnvelope) {
  return [
    { label: "动作", value: action.summary },
    { label: "目标", value: directorAgentDisplayTargetLabel(action.target, action.sourceContext) },
    { label: "影响", value: affectedScopeLabel(action) },
    { label: "执行", value: providerCallLabel(action) },
    { label: "成本", value: costBoundaryLabel(action) },
    { label: "外部提交", value: externalSubmissionBoundaryLabel(action) },
    { label: "下一步", value: "等你确认" },
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
  if (action.target.kind === "project") return "整个项目";
  if (action.target.kind === "asset") return "1 个素材";
  if (action.target.kind === "section") return directorAgentDisplayTargetLabel(action.target, action.sourceContext);
  if (action.target.kind === "multi_shot") return `${action.target.ids.length} 个镜头`;
  if (action.target.kind === "shot") return "1 个镜头";
  if (action.sourceContext.selectedShotIds.length > 0) {
    return `${action.sourceContext.selectedShotIds.length} 个镜头`;
  }
  return "整个项目";
}

function providerCallLabel(action: DirectorAgentActionEnvelope) {
	  if (action.toolPlan.toolName === "image2_reference_generation") return "Image2 / 参考生成";
	  if (action.kind === "query_video_result") return "Seedance / 查询视频结果";
	  if (action.toolPlan.toolName === "seedance_video_submit") {
    return buildVibeAgentDispatchPlan(action).executorTool === "compile_video_request"
      ? "只准备视频请求"
      : "Seedance / 视频提交";
  }
	  if (action.toolPlan.toolName === "web_search") return "联网查资料";
  if (action.toolPlan.toolName === "project_export") return "本地导出";
  return "写入项目";
}

function confirmationActionTitleFor(action: DirectorAgentActionEnvelope) {
  if (action.kind === "prepare_reference_generation") return "确认生成参考";
  if (action.kind === "prepare_video_submit") {
    return buildVibeAgentDispatchPlan(action).executorTool === "compile_video_request"
      ? "确认准备视频请求"
      : "确认提交视频";
  }
  if (action.kind === "query_video_result") return "确认查询视频";
  if (action.kind === "prepare_export") return "确认导出展示包";
  if (action.kind === "request_style_research") return "确认查资料";
  if (action.kind === "update_shot_strategy") return "确认镜头方式";
  if (action.kind === "review_reference_asset") return "确认复核参考";
  return "确认修改项目";
}

function costBoundaryLabel(action: DirectorAgentActionEnvelope) {
  if (action.toolPlan.toolName === "image2_reference_generation") return "会调用参考生成";
  if (action.toolPlan.toolName === "seedance_video_submit") {
    return buildVibeAgentDispatchPlan(action).executorTool === "compile_video_request"
      ? "只准备视频请求"
      : "会提交 Seedance 视频任务";
  }
  if (action.toolPlan.toolName === "web_search") return "会联网查资料";
  if (action.kind === "inspect_project_status") return "只读取项目";
  return "只保存项目修改";
}

function externalSubmissionBoundaryLabel(action: DirectorAgentActionEnvelope) {
  if (action.kind === "prepare_video_submit") {
    return buildVibeAgentDispatchPlan(action).executorTool === "submit_video"
      ? "确认后进入 Seedance 串行队列"
      : "不提交视频";
  }
  if (action.toolPlan.toolName === "image2_reference_generation") {
    return action.executionContract.videoSubmitAllowed
      ? "确认后调用参考生成"
      : "只调用参考生成，不提交视频";
  }
  if (action.toolPlan.toolName === "web_search") return "确认后联网查资料";
  return "不提交视频";
}

function plannedFileImpactLabel(action: DirectorAgentActionEnvelope, executorTool: string) {
  if (action.kind === "prepare_export") return "展示包";
  if (action.kind === "prepare_reference_generation") return "参考结果和运行记录";
  if (executorTool === "compile_video_request") return "视频请求草案";
  if (action.kind === "prepare_video_submit" || action.kind === "query_video_result") return "视频任务记录";
  if (action.kind === "revise_story_or_shot" || action.kind === "update_shot_strategy") return "项目草案";
  if (executorTool === "write_project") return "项目草案";
  if (executorTool === "save_skill") return "项目 Skills";
  return "不写文件";
}

function videoStatusFact(snapshot: VibeAgentProjectSnapshot) {
  if (snapshot.videoCanResume) return "可查询结果";
  if (snapshot.videoWaitingCount > 0) return `等待中 ${snapshot.videoWaitingCount}`;
  if (snapshot.videoReviewCount > 0) return `待复核 ${snapshot.videoReviewCount}`;
  if (snapshot.videoCompletedCount > 0) return `已完成 ${snapshot.videoCompletedCount}`;
  return creatorVideoStatusLabel(snapshot.videoStatus);
}

function creatorVideoStatusLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "idle" || normalized === "not_generated") return "未提交";
  if (normalized === "ready") return "可准备";
  if (normalized === "submitted" || normalized === "queued") return "已排队";
  if (normalized === "running" || normalized === "generating" || normalized === "in_progress") return "生成中";
  if (normalized === "recoverable") return "可查询结果";
  if (normalized === "needs_review" || normalized === "review") return "待复核";
  if (normalized === "completed" || normalized === "done") return "已完成";
  if (normalized === "failed") return "失败";
  return value || "未提交";
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

function lifecycleForOutcome(
  outcome: {
    status: "completed" | "blocked" | "failed" | "skipped";
    resultStatus?: "ready" | "running";
  },
): VibeAgentActionLifecycleStatus {
  if (outcome.status === "failed") return "failed";
  if (outcome.status === "blocked") return "needs_user_input";
  if (outcome.status === "skipped") return "cancelled";
  if (outcome.resultStatus === "running") return "running";
  return "succeeded";
}

function confirmedOutcomeResultFacts(outcome: { resultFacts?: VibeAgentFact[] }) {
  const seen = new Set<string>();
  return (outcome.resultFacts || []).filter((fact) => {
    const label = fact.label.trim();
    const value = fact.value.trim();
    if (!label || !value) return false;
    const key = `${label}:${value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

function confirmedExecutionResultFor(
  outcome: {
    status: "completed" | "blocked" | "failed" | "skipped";
    label: string;
    resultStatus?: "ready" | "running";
  },
  nextStep: string,
): VibeAgentExecutionResultSummary {
  const lifecycle = lifecycleForOutcome(outcome);
  const status = outcome.status === "blocked"
    ? "blocked"
    : outcome.status === "failed"
      ? "failed"
      : outcome.status === "skipped"
        ? "cancelled"
        : outcome.resultStatus === "running"
          ? "running"
          : "succeeded";
  return {
    lifecycle,
    status,
    summary: outcome.label,
    next: nextStep,
  };
}

function blockedOrFailedNextStepLabel(executorTool: string) {
  if (executorTool === "generate_references") return "补素材或检查图片服务后重试";
  if (executorTool === "submit_video") return "按提示处理后重试，或跳过这一段";
  if (executorTool === "query_video") return "稍后再查或检查提交记录";
  if (executorTool === "compile_video_request") return "调整视频请求后重新确认";
  if (executorTool === "export_project" || executorTool === "export_showcase") return "检查视频段和导出设置后重试";
  if (executorTool === "research_style") return "换关键词或检查搜索设置后重试";
  if (executorTool === "write_project") return "修改后重新确认";
  if (executorTool === "save_skill") return "修改导演经验后重试";
  if (executorTool === "classify_assets" || executorTool === "scan_assets") return "检查项目文件后重试";
  if (executorTool === "inspect_project") return "重新打开项目后重试";
  if (executorTool === "plan_story" || executorTool === "plan_next_action" || executorTool === "revise_shot") return "调整描述后重试";
  return "调整后重试";
}

function confirmedActionResultBodyFor(input: {
  actionLabel: string;
  outcome: {
    status: "completed" | "blocked" | "failed" | "skipped";
    label: string;
    projectRecordPreserved: boolean;
    resultStatus?: "ready" | "running";
  };
  resultLocationLabel: string;
  nextStep: string;
}) {
  const statusLabel = input.outcome.status === "failed"
    ? "执行失败"
    : input.outcome.status === "blocked"
      ? "需要处理"
      : input.outcome.status === "skipped"
        ? "已取消"
        : input.outcome.resultStatus === "running"
          ? "已启动"
          : "已完成";
  const outcomeLabel = sentenceWithEnding(input.outcome.label);
  const recordLabel = input.outcome.projectRecordPreserved ? "项目记录已保留。" : "";
  return `${statusLabel}：${input.actionLabel}。${outcomeLabel}${recordLabel}查看：${input.resultLocationLabel}。下一步：${input.nextStep}。`;
}

function sentenceWithEnding(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[。！？.!?]$/.test(trimmed) ? trimmed : `${trimmed}。`;
}

function planNextActionBodyFor(input: {
  action: DirectorAgentActionEnvelope;
  label: string;
  targetLabel: string;
  fileImpact: string;
  blocked: boolean;
  next: string;
}) {
  if (input.blocked) {
    return `我暂时不能执行「${input.label}」。先处理：${blockerSummaryFor(input.action)}。`;
  }

  const externalBoundary = externalSubmissionBoundaryLabel(input.action);
  const writePart = input.fileImpact === "不写文件"
    ? "不会修改项目"
    : `预计保存到 ${input.fileImpact}`;
  return `我建议先做「${input.label}」，目标是「${input.targetLabel}」。${externalBoundary}，${writePart}。下一步：${input.next}。`;
}

function blockerSummaryFor(action: DirectorAgentActionEnvelope) {
  const blockers = uniqueStrings(action.blockers).slice(0, 2);
  if (blockers.length) return blockers.join("；");
  return "需要补充条件后再执行";
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
  if (outcome.status === "blocked" || outcome.status === "failed") return blockedOrFailedNextStepLabel(executorTool);
  if (outcome.status === "skipped") return "不需要继续执行";
  if (outcome.previewReady) return "去预览复核";
  if (outcome.waitingReview) return "去参考复核";
  if (outcome.resultStatus === "running") return executorTool === "submit_video" || executorTool === "query_video" ? "等待视频结果" : "等待结果";
  if (executorTool === "export_project" || executorTool === "export_showcase") return "去交付页查看";
  return "继续下一步";
}

function resultCardTitleFor(
  outcome: {
    status: "completed" | "blocked" | "failed" | "skipped";
    waitingReview?: boolean;
    previewReady?: boolean;
    resultStatus?: "ready" | "running";
  },
  executorTool: string,
) {
  if (outcome.status === "failed") return "结果卡片：执行失败";
  if (outcome.status === "blocked") return "结果卡片：需要处理";
  if (outcome.status === "skipped") return "结果卡片：已取消";
  if (executorTool === "generate_references") {
    if (outcome.resultStatus === "running") return "结果卡片：参考生成中";
    if (outcome.waitingReview || outcome.resultStatus === "ready") return "结果卡片：参考待复核";
    return "结果卡片：参考已处理";
  }
  if (executorTool === "submit_video") {
    if (outcome.resultStatus === "running") return "结果卡片：视频已提交";
    if (outcome.previewReady || outcome.resultStatus === "ready") return "结果卡片：视频可预览";
    return "结果卡片：视频已处理";
  }
  if (executorTool === "query_video") {
    if (outcome.previewReady || outcome.resultStatus === "ready") return "结果卡片：视频已回流";
    if (outcome.resultStatus === "running") return "结果卡片：视频仍在队列";
    return "结果卡片：查询完成";
  }
  if (executorTool === "export_project" || executorTool === "export_showcase") return "结果卡片：展示包已导出";
  if (executorTool === "compile_video_request") return "结果卡片：视频请求已准备";
  if (executorTool === "research_style") return "结果卡片：资料已整理";
  if (executorTool === "save_skill") return "结果卡片：导演经验已保存";
  if (executorTool === "write_project") return "结果卡片：项目已更新";
  return "结果卡片：动作完成";
}

function resultLocationFor(
  outcome: {
    status: "completed" | "blocked" | "failed" | "skipped";
    waitingReview?: boolean;
    previewReady?: boolean;
    resultStatus?: "ready" | "running";
  },
  executorTool: string,
) {
  if (outcome.status === "blocked" || outcome.status === "failed") {
    return { label: "消息流", view: "agent_thread" };
  }
  if (outcome.previewReady || (outcome.resultStatus === "ready" && (executorTool === "submit_video" || executorTool === "query_video"))) {
    return { label: "预览页", view: "preview" };
  }
  if (outcome.waitingReview || executorTool === "generate_references") {
    return { label: "参考页", view: "assets" };
  }
  if (executorTool === "export_project" || executorTool === "export_showcase") {
    return { label: "交付页", view: "export" };
  }
  return { label: "消息流", view: "agent_thread" };
}

function compactId(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "").slice(0, 24).toLowerCase() || "now";
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}
