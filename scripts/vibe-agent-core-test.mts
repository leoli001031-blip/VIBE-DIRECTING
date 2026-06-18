import assert from "node:assert/strict";
import {
  buildDirectorAgentStateSnapshot,
} from "../src/core/directorAgentAction";
import { buildDirectorAgentToolHandoff } from "../src/core/directorAgentToolHandoff";
import type { ProjectRuntimeState } from "../src/core/projectState";
import {
  listVibeAgentActionNames,
  buildVibeAgentDispatchPlan,
  parseVibeAgentTimelineDocument,
  executeConfirmedVibeAgentAction,
  executeRegisteredVibeAgentAction,
  buildVibeAgentConfirmedActionReportEntry,
  buildVibeAgentConfirmedActionStartedEntry,
  buildVibeAgentConfirmedActionToolResultEntry,
  buildVibeAgentTimelineStatusView,
  buildVibeAgentConfirmedProductPolicy,
  buildVibeAgentExportExecutionCapability,
  buildVibeAgentProductExecutionHandlers,
  buildVibeAgentProductExecutionCapabilities,
  buildVibeAgentProductToolAvailability,
  buildVibeAgentReferenceExecutionCapability,
  buildVibeAgentResearchExecutionCapability,
  buildVibeAgentVideoExecutionCapability,
  buildVibeAgentIntakeTimelineEntries,
  appendVibeAgentTimelineEntries,
  createVibeAgentRuntimeAdapter,
  exportToolOutcome,
  isVibeAgentIntakeTimelineEntry,
  referenceGenerationToolOutcome,
  runRegisteredConfirmedVibeAgentProductAction,
  runConfirmedVibeAgentProductAction,
  runVibeAgentTurn,
  saveVibeAgentTimelineToProjectRoot,
  vibeAgentConfirmedActionBlockedLabel,
  vibeAgentPermissionModeForConfirmedAction,
  vibeAgentReferenceAssetTypesForAction,
  vibeAgentToolHandoffBindingIssue,
  vibeAgentToolResultLabel,
  videoSubmitToolOutcome,
  loadVibeAgentTimelineFromProjectRoot,
} from "../src/agent-core";

function runtimeState(input: {
  missing?: number;
  needsReview?: number;
  shots?: number;
} = {}): ProjectRuntimeState {
  const shots = Array.from({ length: input.shots ?? 3 }, (_, index) => ({
    id: `shot_${index + 1}`,
    title: `镜头 ${index + 1}`,
    status: "draft",
    durationSeconds: 4,
    characterAssetIds: [],
    sceneAssetIds: [],
    propAssetIds: [],
    actionBeats: [],
    characterGuidance: [],
    sceneGuidance: [],
    propGuidance: [],
  }));
  const missingAssets = Array.from({ length: input.missing ?? 2 }, (_, index) => ({
    id: `asset_missing_${index + 1}`,
    name: `待补参考 ${index + 1}`,
    type: "scene",
    status: "missing",
    lockedStatus: "not_generated",
    usedByShotIds: [`shot_${index + 1}`],
  }));
  const reviewAssets = Array.from({ length: input.needsReview ?? 0 }, (_, index) => ({
    id: `asset_review_${index + 1}`,
    name: `待复核参考 ${index + 1}`,
    type: "character",
    status: "ready",
    lockedStatus: "needs_review",
    usedByShotIds: [`shot_${index + 1}`],
  }));
  return {
    project: {
      id: "agent-core-demo",
      title: "Agent Core Demo",
      root: "/tmp/vibe-agent-core-demo",
    },
    storyFlow: {
      title: "Agent Core Demo",
      sections: [],
      shots,
    },
    visualMemory: {
      assets: [...missingAssets, ...reviewAssets],
    },
  } as unknown as ProjectRuntimeState;
}

const toolNames = listVibeAgentActionNames();
assert.deepEqual(toolNames, [
  "export_project",
  "generate_references",
  "inspect_project",
  "plan_next_action",
  "query_video",
  "research_style",
  "request_user_confirmation",
  "run_confirmed_action",
  "scan_assets",
  "submit_video",
  "write_project",
  "write_agent_message",
].sort());
const runtimeAdapter = createVibeAgentRuntimeAdapter();
assert.deepEqual(runtimeAdapter.listActions(), toolNames);

const snapshot = buildDirectorAgentStateSnapshot({
  runtimeState: runtimeState({ missing: 2, shots: 3 }),
  currentView: "story",
});

const planOnlyTurn = runVibeAgentTurn({
  userMessage: "继续",
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: "/tmp/vibe-agent-core-demo",
  snapshot,
  permissionMode: "plan_only",
  generatedAt: "2026-06-17T08:00:00.000Z",
});
const adapterPlanOnlyTurn = runtimeAdapter.runTurn({
  userMessage: "继续",
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: "/tmp/vibe-agent-core-demo",
  snapshot,
  permissionMode: "plan_only",
  generatedAt: "2026-06-17T08:00:30.000Z",
});
assert.equal(adapterPlanOnlyTurn.status, "awaiting_confirmation");

assert.equal(planOnlyTurn.status, "awaiting_confirmation");
assert.equal(planOnlyTurn.projectSnapshot.missingReferences, 2);
assert.ok(planOnlyTurn.pendingConfirmationToken);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "user_message" && entry.body === "继续"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "tool_call" && entry.toolName === "inspect_project"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "tool_result" && entry.toolName === "inspect_project"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "tool_call" && entry.toolName === "scan_assets"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "tool_result" && entry.toolName === "scan_assets"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "tool_call" && entry.toolName === "plan_next_action"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "tool_result" && entry.toolName === "plan_next_action"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "tool_call" && entry.toolName === "write_agent_message"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "assistant_message" && entry.title === "AI 导演"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "tool_call" && entry.toolName === "request_user_confirmation"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "confirmation_request"), true);
const emptyReferenceSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: runtimeState({ missing: 0, needsReview: 0, shots: 2 }),
  currentView: "story",
});
const emptyReferenceTurn = runVibeAgentTurn({
  userMessage: "继续",
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: "/tmp/vibe-agent-core-demo",
  snapshot: emptyReferenceSnapshot,
  permissionMode: "plan_only",
  generatedAt: "2026-06-17T08:00:20.000Z",
});
assert.equal(emptyReferenceTurn.projectSnapshot.missingReferences, 2);
assert.equal(emptyReferenceTurn.action.sourceContext.projectReadiness.missingReferences, 2);
assert.equal(emptyReferenceTurn.timeline.entries.some((entry) => entry.title === "项目状态" && entry.facts?.some((fact) => fact.label === "缺参考" && fact.value === "2 个")), true);
assert.equal(emptyReferenceTurn.timeline.entries.some((entry) => entry.title === "素材检查结果" && /发现 2 个参考/.test(entry.body)), true);
const planOnlyConfirmation = planOnlyTurn.timeline.entries.find((entry) => entry.type === "confirmation_request");
assert.ok(planOnlyConfirmation);
assert.equal(planOnlyConfirmation?.actionKind, planOnlyTurn.action.kind);
assert.equal(planOnlyConfirmation?.facts?.some((fact) => fact.label === "动作" && fact.value === planOnlyTurn.action.summary), true);
assert.equal(planOnlyConfirmation?.facts?.some((fact) => fact.label === "目标" && fact.value === planOnlyTurn.action.target.label), true);
assert.equal(planOnlyConfirmation?.facts?.some((fact) => fact.label === "影响"), true);
assert.equal(planOnlyConfirmation?.facts?.some((fact) => fact.label === "调用" && /Image2|Seedance|只写项目|本地导出|联网查资料/.test(fact.value)), true);
assert.equal(planOnlyConfirmation?.details?.expectedReceipt, planOnlyTurn.action.toolPlan.expectedReceipt);
assert.equal(planOnlyConfirmation?.details?.toolName, planOnlyTurn.action.toolPlan.toolName);
assert.match(planOnlyTurn.permissionDecision.reason, /project_write_allowed|reference_allowed|video_allowed|export_allowed|确认/);
const planOnlyTimelineStatus = buildVibeAgentTimelineStatusView(planOnlyTurn.timeline.entries);
assert.equal(planOnlyTimelineStatus?.stage, "等待确认");
assert.equal(planOnlyTimelineStatus?.waitingFor, "你的确认");
assert.equal(planOnlyTimelineStatus?.tone, "waiting");

const recoverableVideoSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: runtimeState({ shots: 3 }),
  currentView: "story",
  videoStatus: "submitted",
  videoCanResume: true,
  videoWaitingCount: 1,
  videoDetail: "Seedance 已提交，可以查询结果。",
});
const queryVideoTurn = runVibeAgentTurn({
  userMessage: "继续",
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: "/tmp/vibe-agent-core-demo",
  snapshot: recoverableVideoSnapshot,
  permissionMode: "project_write_allowed",
  generatedAt: "2026-06-17T08:00:42.000Z",
});
const queryDispatchPlan = buildVibeAgentDispatchPlan(queryVideoTurn.action);
assert.equal(queryVideoTurn.action.kind, "query_video_result");
assert.equal(queryDispatchPlan.executorTool, "query_video");
assert.equal(queryVideoTurn.projectSnapshot.videoCanResume, true);
assert.equal(queryVideoTurn.timeline.entries.some((entry) => entry.type === "tool_result" && entry.toolName === "inspect_project" && entry.facts?.some((fact) => fact.label === "视频" && fact.value === "可查询结果")), true);

const authoritativeVideoAction = {
  ...planOnlyTurn.action,
  actionId: "authoritative-video-action",
  kind: "prepare_video_submit" as const,
  summary: "提交已复核视频",
  userFacingMessage: "我会提交已复核视频，确认前不会调用 Seedance。",
  executionContract: {
    mode: "video_allowed" as const,
    referenceGenerationAllowed: true,
    videoSubmitAllowed: true,
    providerSubmitAllowed: true,
    reason: "测试传入的权威 action 必须进入 Agent timeline。",
  },
  toolPlan: {
    ...planOnlyTurn.action.toolPlan,
    toolName: "seedance_video_submit" as const,
    expectedReceipt: "video_submit_receipt" as const,
    providerSubmitAllowed: true,
  },
};
const authoritativeActionTurn = runVibeAgentTurn({
  userMessage: "继续",
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: "/tmp/vibe-agent-core-demo",
  snapshot,
  action: authoritativeVideoAction,
  permissionMode: "video_allowed",
  generatedAt: "2026-06-17T08:00:45.000Z",
});
assert.equal(authoritativeActionTurn.action.actionId, "authoritative-video-action");
assert.equal(authoritativeActionTurn.action.kind, "prepare_video_submit");
assert.equal(authoritativeActionTurn.pendingConfirmationToken, "confirm:authoritative-video-action:video_submit_receipt");
assert.equal(authoritativeActionTurn.timeline.entries.some((entry) => entry.actionId === "authoritative-video-action" && entry.toolName === "plan_next_action"), true);
assert.equal(authoritativeActionTurn.timeline.entries.some((entry) => entry.actionId === "authoritative-video-action" && entry.toolName === "request_user_confirmation"), true);
const authoritativeConfirmedTurn = runVibeAgentTurn({
  userMessage: "继续",
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: "/tmp/vibe-agent-core-demo",
  snapshot,
  action: authoritativeVideoAction,
  permissionMode: "video_allowed",
  userConfirmed: true,
  previousTimeline: authoritativeActionTurn.timeline,
  generatedAt: "2026-06-17T08:00:50.000Z",
});
assert.equal(authoritativeConfirmedTurn.pendingConfirmationToken, undefined);
assert.equal(authoritativeConfirmedTurn.timeline.entries.some((entry) => entry.actionId === "authoritative-video-action" && entry.toolName === "submit_video"), true);

const parsed = parseVibeAgentTimelineDocument(JSON.parse(JSON.stringify(planOnlyTurn.timeline)));
assert.equal(parsed.ok, true);
assert.equal(parsed.timeline?.entries.length, planOnlyTurn.timeline.entries.length);

const confirmedTurn = runVibeAgentTurn({
  userMessage: "继续",
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: "/tmp/vibe-agent-core-demo",
  snapshot,
  permissionMode: "reference_allowed",
  userConfirmed: true,
  previousTimeline: planOnlyTurn.timeline,
  generatedAt: "2026-06-17T08:01:00.000Z",
});

assert.notEqual(confirmedTurn.status, "blocked");
assert.equal(confirmedTurn.pendingConfirmationToken, undefined);
assert.equal(confirmedTurn.timeline.entries.some((entry) => entry.type === "tool_call" && entry.toolName === "run_confirmed_action"), true);
assert.equal(confirmedTurn.timeline.entries.some((entry) => entry.type === "state_change"), true);
assert.equal(confirmedTurn.timeline.entries.some((entry) => entry.type === "state_change" && entry.toolName === "generate_references" && entry.status === "waiting"), true);
assert.ok(confirmedTurn.timeline.entries.length > planOnlyTurn.timeline.entries.length);
const confirmedTimelineStatus = buildVibeAgentTimelineStatusView(confirmedTurn.timeline.entries);
assert.equal(confirmedTimelineStatus?.stage, "Agent 正在执行");
assert.equal(confirmedTimelineStatus?.tone, "working");
assert.equal(confirmedTimelineStatus?.nextAction, "完成后我会写入结果");
const blockedTimelineStatus = buildVibeAgentTimelineStatusView([
  {
    id: "blocked-local-project",
    type: "assistant_message",
    createdAt: "2026-06-17T08:01:30.000Z",
    title: "AI 导演：需要本地项目",
    body: "我看到了你的指令，但生成参考、发送视频、导出或继续执行前，需要先选择一个本地项目文件夹。",
    status: "blocked",
    details: { next: "选好项目文件夹后，再说“继续”即可。" },
  },
]);
assert.equal(blockedTimelineStatus?.stage, "需要你处理");
assert.equal(blockedTimelineStatus?.doing, "AI 导演：需要本地项目");
assert.equal(blockedTimelineStatus?.nextAction, "选好项目文件夹后，再说“继续”即可。");

let unconfirmedCalls = 0;
const unconfirmedExecution = await executeConfirmedVibeAgentAction({
  action: planOnlyTurn.action,
  permissionMode: "reference_allowed",
  userConfirmed: false,
  apply: () => {
    unconfirmedCalls += 1;
    return "should-not-run";
  },
});
assert.equal(unconfirmedExecution.status, "blocked");
assert.equal(unconfirmedCalls, 0);
assert.equal(unconfirmedExecution.dispatchPlan.executorTool, "generate_references");

let adapterBlockedCalls = 0;
const adapterBlockedExecution = await runtimeAdapter.runConfirmedAction({
  action: planOnlyTurn.action,
  permissionMode: "reference_allowed",
  userConfirmed: false,
  apply: () => {
    adapterBlockedCalls += 1;
    return "should-not-run";
  },
});
assert.equal(adapterBlockedExecution.status, "blocked");
assert.equal(adapterBlockedCalls, 0);

let missingRegisteredCalls = 0;
const missingRegisteredExecution = await executeRegisteredVibeAgentAction({
  action: confirmedTurn.action,
  permissionMode: "reference_allowed",
  userConfirmed: true,
  handlers: {
    submit_video: () => {
      missingRegisteredCalls += 1;
      return "wrong-handler";
    },
  },
});
assert.equal(missingRegisteredExecution.status, "blocked");
assert.match(missingRegisteredExecution.reason, /generate_references/);
assert.equal(missingRegisteredCalls, 0);

let registeredCalls = 0;
const registeredExecution = await runtimeAdapter.runRegisteredAction({
  action: confirmedTurn.action,
  permissionMode: "reference_allowed",
  userConfirmed: true,
  handlers: {
    generate_references: (context) => {
      registeredCalls += 1;
      return `${context.dispatchPlan.executorTool}:registered`;
    },
  },
});
assert.equal(registeredExecution.status, "completed");
assert.equal(registeredCalls, 1);
if (registeredExecution.status === "completed") {
  assert.equal(registeredExecution.value, "generate_references:registered");
}

const productHandlers = buildVibeAgentProductExecutionHandlers({
  generateReferences: (context) => `${context.dispatchPlan.executorTool}:product`,
});
assert.equal(typeof productHandlers.generate_references, "function");
assert.equal(productHandlers.submit_video, undefined);
const productExecution = await executeRegisteredVibeAgentAction({
  action: confirmedTurn.action,
  permissionMode: "reference_allowed",
  userConfirmed: true,
  handlers: productHandlers,
});
assert.equal(productExecution.status, "completed");
if (productExecution.status === "completed") {
  assert.equal(productExecution.value, "generate_references:product");
}

let confirmedCalls = 0;
const confirmedExecution = await executeConfirmedVibeAgentAction({
  action: confirmedTurn.action,
  permissionMode: "reference_allowed",
  userConfirmed: true,
  apply: (context) => {
    confirmedCalls += 1;
    return `${context.dispatchPlan.executorTool}:ok`;
  },
});
assert.equal(confirmedExecution.status, "completed");
assert.equal(confirmedCalls, 1);
if (confirmedExecution.status === "completed") {
  assert.equal(confirmedExecution.value, "generate_references:ok");
}

const projectWriteDispatch = buildVibeAgentDispatchPlan({
  ...confirmedTurn.action,
  kind: "revise_story_or_shot",
  toolPlan: {
    ...confirmedTurn.action.toolPlan,
    toolName: "project_vibe_patch",
    expectedReceipt: "project_patch_receipt",
  },
});
assert.equal(projectWriteDispatch.executorTool, "write_project");

const styleResearchDispatch = buildVibeAgentDispatchPlan({
  ...confirmedTurn.action,
  kind: "request_style_research",
  toolPlan: {
    ...confirmedTurn.action.toolPlan,
    toolName: "web_search",
    expectedReceipt: "web_research_reference_receipt",
  },
});
assert.equal(styleResearchDispatch.executorTool, "research_style");

assert.deepEqual(referenceGenerationToolOutcome({ status: "needs_review", message: "参考已回流" }), {
  status: "completed",
  label: "参考已回流",
  projectRecordPreserved: true,
  waitingReview: true,
  previewReady: false,
  resultStatus: "ready",
});
assert.equal(videoSubmitToolOutcome({ status: "blocked", qaFeedback: { summary: "先修参考" } }).label, "先修参考");
assert.equal(exportToolOutcome({ status: "ready", message: "导出完成" }).resultStatus, "ready");
assert.deepEqual(vibeAgentReferenceAssetTypesForAction(confirmedTurn.action, "补一个雨夜车站场景参考"), ["scene"]);
assert.equal(vibeAgentPermissionModeForConfirmedAction(confirmedTurn.action), "reference_allowed");
assert.equal(vibeAgentConfirmedActionBlockedLabel("需要先确认"), "需要先确认。项目已保留。");
assert.deepEqual(buildVibeAgentProductToolAvailability({
  localProjectReady: false,
  webSearchReady: true,
  referenceGenerationCallbackReady: true,
  referenceGenerationKeyConfigured: true,
  videoSubmitCallbackReady: true,
  videoSubmitReady: true,
  videoSubmitKeyConfigured: true,
  exportCallbackReady: true,
}), {
  projectReady: false,
  webSearchReady: true,
  referenceGenerationReady: false,
  videoSubmitReady: false,
  exportReady: false,
});
const busyReferenceAvailability = buildVibeAgentProductToolAvailability({
  localProjectReady: true,
  webSearchReady: true,
  referenceGenerationCallbackReady: true,
  referenceGenerationKeyConfigured: true,
  referenceGenerationBusy: true,
  videoSubmitCallbackReady: true,
  videoSubmitReady: true,
  videoSubmitKeyConfigured: true,
  videoAlreadySent: true,
  videoCanResume: true,
  exportCallbackReady: true,
});
assert.equal(busyReferenceAvailability.referenceGenerationReady, false);
assert.equal(busyReferenceAvailability.videoSubmitReady, true);

const productHandoff = buildDirectorAgentToolHandoff({
  action: confirmedTurn.action,
  userConfirmed: true,
  confirmedAt: "2026-06-17T08:02:00.000Z",
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
assert.equal(vibeAgentToolResultLabel(productHandoff), "图片先进入复核");
assert.equal(vibeAgentToolHandoffBindingIssue(confirmedTurn.action, {
  ...productHandoff,
  actionId: "different-action",
}), "这次动作已经变化，请重新发送一次。");
const statusLog: string[] = [];
let selectedHandoffId = "";
let referenceTarget: {
  selectedShotIds?: string[];
  confirmationReceiptId?: string;
  agentToolTrace?: { handoffId: string };
} | undefined;
const productRun = await runConfirmedVibeAgentProductAction({
  action: confirmedTurn.action,
  userIntent: "继续",
  preparedHandoff: productHandoff,
  buildHandoff: () => undefined,
  bindingIssue: () => undefined,
  blockedStatusLabel: (handoff) => handoff.userFacingMessage,
  resultLabel: (handoff) => handoff.userFacingMessage,
  referenceAssetTypesForAction: () => ["scene"],
  setStatus: (status) => statusLog.push(status),
  setHandoff: (handoff) => {
    selectedHandoffId = handoff.handoffId;
  },
  createReferences: (target) => {
    referenceTarget = target;
    return { status: "needs_review", message: "参考执行完成" };
  },
});
assert.equal(productRun.status, "completed");
assert.equal(productRun.label, "参考执行完成");
assert.equal(selectedHandoffId, productHandoff.handoffId);
assert.deepEqual(referenceTarget?.selectedShotIds, productHandoff.invocation?.targetSummary.ids);
assert.equal(referenceTarget?.confirmationReceiptId, productHandoff.handoffId);
assert.equal(referenceTarget?.agentToolTrace?.handoffId, productHandoff.handoffId);
assert.equal(statusLog.includes("参考执行完成"), true);

const registeredStatusLog: string[] = [];
let registeredReferenceCalls = 0;
const statusUpdates: string[] = [];
const handoffUpdates: string[] = [];
const researchCapability = buildVibeAgentResearchExecutionCapability({
  buildResearchQuery: (intent: string) => `research:${intent}`,
});
const referenceCapability = buildVibeAgentReferenceExecutionCapability({
  createReferences: () => ({ status: "needs_review", message: "capability reference ok" }),
});
const videoCapability = buildVibeAgentVideoExecutionCapability({
  submitVideo: () => ({ status: "submitted", message: "capability video ok" }),
  queryVideo: () => ({ status: "ready", message: "capability query ok" }),
});
const exportCapability = buildVibeAgentExportExecutionCapability({
  runExport: () => ({ status: "completed", message: "capability export ok" }),
});
assert.equal(researchCapability?.buildResearchQuery?.("EVA 分镜"), "research:EVA 分镜");
assert.equal(typeof referenceCapability?.createReferences, "function");
assert.equal(typeof videoCapability?.submitVideo, "function");
assert.equal(typeof videoCapability?.queryVideo, "function");
assert.equal(typeof exportCapability?.runExport, "function");
const confirmedProductCapabilities = buildVibeAgentProductExecutionCapabilities({
  recoveryHint: "补一张完整场景参考",
  videoPermissionContract: { mode: "reference_allowed" },
  webSearchSettings: { enabled: true },
  status: {
    setStatus: (status) => statusUpdates.push(status),
    setHandoff: (handoff) => handoffUpdates.push(handoff.handoffId),
  },
  research: researchCapability,
  references: referenceCapability,
  video: videoCapability,
  exportProject: exportCapability,
});
assert.equal(confirmedProductCapabilities.recoveryHint, "补一张完整场景参考");
assert.deepEqual(confirmedProductCapabilities.videoPermissionContract, { mode: "reference_allowed" });
assert.deepEqual(confirmedProductCapabilities.webSearchSettings, { enabled: true });
confirmedProductCapabilities.setStatus("capability status");
confirmedProductCapabilities.setHandoff(productHandoff);
assert.deepEqual(statusUpdates, ["capability status"]);
assert.deepEqual(handoffUpdates, [productHandoff.handoffId]);
assert.equal(confirmedProductCapabilities.buildResearchQuery?.("EVA 分镜"), "research:EVA 分镜");
assert.equal(typeof confirmedProductCapabilities.createReferences, "function");
const confirmedProductPolicy = buildVibeAgentConfirmedProductPolicy({
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: false,
    exportReady: true,
  },
});
const policyHandoff = confirmedProductPolicy.buildHandoff(confirmedTurn.action);
assert.equal(policyHandoff?.status, "ready");
assert.equal(policyHandoff?.invocation?.confirmation.actionId, confirmedTurn.action.actionId);
assert.equal(confirmedProductPolicy.bindingIssue(confirmedTurn.action, productHandoff), undefined);
assert.equal(confirmedProductPolicy.resultLabel(productHandoff), vibeAgentToolResultLabel(productHandoff));
assert.deepEqual(confirmedProductPolicy.referenceAssetTypesForAction(confirmedTurn.action, "补场景参考"), ["scene"]);
const registeredProductRun = await runRegisteredConfirmedVibeAgentProductAction({
  action: confirmedTurn.action,
  userIntent: "继续",
  preparedHandoff: productHandoff,
  permissionMode: "reference_allowed",
  userConfirmed: true,
  ...confirmedProductPolicy,
  setStatus: (status) => registeredStatusLog.push(status),
  setHandoff: () => undefined,
  createReferences: () => {
    registeredReferenceCalls += 1;
    return { status: "needs_review", message: "registered product ok" };
  },
});
assert.equal(registeredProductRun.status, "completed");
assert.equal(registeredProductRun.label, "registered product ok");
assert.equal(registeredReferenceCalls, 1);
assert.equal(registeredStatusLog.includes("registered product ok"), true);

let blockedRegisteredReferenceCalls = 0;
const blockedRegisteredProductRun = await runRegisteredConfirmedVibeAgentProductAction({
  action: confirmedTurn.action,
  userIntent: "继续",
  preparedHandoff: productHandoff,
  permissionMode: "reference_allowed",
  userConfirmed: false,
  buildHandoff: () => undefined,
  bindingIssue: () => undefined,
  blockedStatusLabel: (handoff) => handoff.userFacingMessage,
  resultLabel: (handoff) => handoff.userFacingMessage,
  referenceAssetTypesForAction: () => ["scene"],
  setStatus: () => undefined,
  setHandoff: () => undefined,
  createReferences: () => {
    blockedRegisteredReferenceCalls += 1;
    return { status: "needs_review", message: "should not run" };
  },
});
assert.equal(blockedRegisteredProductRun.status, "blocked");
assert.equal(blockedRegisteredReferenceCalls, 0);

const actualOutcomeEntry = buildVibeAgentConfirmedActionReportEntry({
  generatedAt: "2026-06-17T08:01:30.000Z",
  action: confirmedTurn.action,
  outcome: {
    status: "completed",
    label: "参考已生成，去参考区复核。",
    projectRecordPreserved: true,
    waitingReview: true,
    previewReady: false,
    resultStatus: "ready",
  },
});
const actualToolResultEntry = buildVibeAgentConfirmedActionToolResultEntry({
  generatedAt: "2026-06-17T08:01:30.000Z",
  action: confirmedTurn.action,
  outcome: {
    status: "completed",
    label: "参考已生成，去参考区复核。",
    projectRecordPreserved: true,
    waitingReview: true,
    previewReady: false,
    resultStatus: "ready",
  },
});
const actualStartedEntry = buildVibeAgentConfirmedActionStartedEntry({
  generatedAt: "2026-06-17T08:01:29.000Z",
  action: confirmedTurn.action,
});
assert.equal(actualStartedEntry.type, "tool_call");
assert.equal(actualStartedEntry.toolName, "run_confirmed_action");
assert.equal(actualStartedEntry.actionId, confirmedTurn.action.actionId);
assert.equal(actualStartedEntry.status, "waiting");
assert.equal(actualStartedEntry.facts?.some((fact) => fact.label === "下一步" && fact.value === "等待工具结果"), true);
assert.equal(actualToolResultEntry.type, "tool_result");
assert.equal(actualToolResultEntry.toolName, "run_confirmed_action");
assert.equal(actualToolResultEntry.body, "参考已生成，去参考区复核。");
assert.equal(actualToolResultEntry.status, "done");
assert.equal(actualToolResultEntry.facts?.some((fact) => fact.label === "执行器" && fact.value === "generate_references"), true);
assert.equal(actualToolResultEntry.facts?.some((fact) => fact.label === "下一步" && fact.value === "去参考复核"), true);
assert.equal(actualToolResultEntry.details?.next, "去参考复核");
assert.equal(actualOutcomeEntry.type, "action_result");
assert.equal(actualOutcomeEntry.toolName, "generate_references");
assert.equal(actualOutcomeEntry.body, "参考已生成，去参考区复核。");
assert.equal(actualOutcomeEntry.status, "done");
assert.equal(actualOutcomeEntry.facts?.some((fact) => fact.label === "下一步" && fact.value === "去参考复核"), true);
assert.equal(actualOutcomeEntry.details?.next, "去参考复核");

const confirmedActionTimeline = appendVibeAgentTimelineEntries(
  confirmedTurn.timeline,
  [actualStartedEntry, actualToolResultEntry, actualOutcomeEntry],
  "2026-06-17T08:01:30.000Z",
);
assert.equal(
  confirmedActionTimeline.entries.some((entry) =>
    entry.type === "tool_call"
    && entry.toolName === "run_confirmed_action"
    && entry.actionId === confirmedTurn.action.actionId
  ),
  true,
);
assert.equal(
  confirmedActionTimeline.entries.some((entry) =>
    entry.type === "tool_result"
    && entry.toolName === "run_confirmed_action"
    && entry.actionId === confirmedTurn.action.actionId
  ),
  true,
);
assert.equal(
  confirmedActionTimeline.entries.some((entry) =>
    entry.type === "action_result"
    && entry.toolName === "generate_references"
    && entry.actionId === confirmedTurn.action.actionId
  ),
  true,
);

let blockedCalls = 0;
const blockedExecution = await executeConfirmedVibeAgentAction({
  action: {
    ...confirmedTurn.action,
    status: "blocked",
    blockers: ["测试阻断"],
  },
  permissionMode: "reference_allowed",
  userConfirmed: true,
  apply: () => {
    blockedCalls += 1;
    return "should-not-run";
  },
});
assert.equal(blockedExecution.status, "blocked");
assert.equal(blockedExecution.reason, "测试阻断");
assert.equal(blockedCalls, 0);

const persistRoot = "/tmp/vibe-agent-core-persist";
const saveResult = saveVibeAgentTimelineToProjectRoot(persistRoot, confirmedActionTimeline);
assert.equal(saveResult.ok, true);
const restored = loadVibeAgentTimelineFromProjectRoot({
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: persistRoot,
});
assert.equal(restored.entries.length, confirmedActionTimeline.entries.length);
assert.equal(restored.entries.some((entry) => entry.type === "state_change" && entry.status === "waiting"), true);
assert.equal(restored.entries.some((entry) => entry.type === "action_result" && entry.toolName === "generate_references"), true);

const intakeEntries = buildVibeAgentIntakeTimelineEntries({
  createdAt: "2026-06-17T08:02:00.000Z",
  phase: "planning_ready",
  userMessage: "做一个 8 秒雨夜短片",
  materialCount: 2,
  imageCount: 1,
  audioCount: 1,
  shotCount: 3,
  permissionMode: "plan_only",
});
assert.equal(intakeEntries.some((entry) => entry.type === "user_message" && entry.body.includes("雨夜短片")), true);
assert.equal(intakeEntries.some((entry) => entry.type === "tool_call" && entry.toolName === "inspect_project"), true);
assert.equal(intakeEntries.some((entry) => entry.type === "tool_result" && entry.toolName === "scan_assets"), true);
assert.equal(intakeEntries.some((entry) => entry.type === "tool_call" && entry.toolName === "plan_next_action"), true);
assert.equal(intakeEntries.some((entry) => entry.type === "assistant_message" && entry.toolName === "write_agent_message"), true);
assert.equal(intakeEntries.some((entry) => entry.type === "confirmation_request" && entry.confirmationRequired === true), true);
assert.equal(intakeEntries.every(isVibeAgentIntakeTimelineEntry), true);

console.log("vibe-agent-core-test: ok");
