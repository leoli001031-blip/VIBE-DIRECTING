import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildDirectorAgentStateSnapshot,
  directorAgentDisplayTargetLabel,
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
  vibeAgentConfirmedActionBlockedLabel,
  vibeAgentPermissionModeForConfirmedAction,
  vibeAgentReferenceAssetTypesForAction,
  vibeAgentToolHandoffBindingIssue,
  vibeAgentToolResultLabel,
  videoSubmitToolOutcome,
  getVibeAgentActionDescriptor,
  type VibeAgentTimelineEntry,
} from "../src/agent-core";
import {
  loadVibeAgentTimelineFromProjectRoot,
  saveVibeAgentTimelineToProjectRoot,
} from "../src/agent-core/timelineStore";

function runtimeState(input: {
  missing?: number;
  needsReview?: number;
  shots?: number;
  strategies?: Array<"storyboard_narrative" | "storyboard_rapid_cut" | "omni_reference">;
  assets?: Array<Record<string, unknown>>;
} = {}): ProjectRuntimeState {
  const shots = Array.from({ length: input.shots ?? 3 }, (_, index) => ({
    id: `shot_${index + 1}`,
    title: `镜头 ${index + 1}`,
    status: "draft",
    durationSeconds: 4,
    referenceStrategy: input.strategies?.[index],
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
      assets: [...missingAssets, ...reviewAssets, ...(input.assets || [])],
    },
  } as unknown as ProjectRuntimeState;
}

function assertVisibleAgentTurnChain(
  entries: VibeAgentTimelineEntry[],
  expected: Array<{ type: VibeAgentTimelineEntry["type"]; toolName?: string; title?: string; label: string }>,
) {
  for (const item of expected) {
    const entry = entries.find((candidate) =>
      candidate.type === item.type
      && (!item.toolName || candidate.toolName === item.toolName)
      && (!item.title || candidate.title === item.title)
    );
    assert.ok(entry, `Agent timeline must expose ${item.label} in the message flow`);
    assert.ok(entry.title?.trim(), `${item.label} must have a visible title`);
    assert.ok(entry.body?.trim(), `${item.label} must have visible body copy`);
    assert.doesNotMatch(entry.body || "", /Project\.vibe|\.vibe-runtime\/agent-timeline/u, `${item.label} must not expose internal storage paths in creator-facing copy`);
  }
}

const toolNames = listVibeAgentActionNames();
assert.deepEqual(toolNames, [
  "classify_assets",
  "compile_video_request",
  "export_showcase",
  "export_project",
  "generate_references",
  "inspect_project",
  "plan_story",
  "plan_next_action",
  "query_video",
  "research_style",
  "request_user_confirmation",
  "run_confirmed_action",
  "save_skill",
  "submit_video",
  "revise_shot",
  "write_project",
  "write_agent_message",
].sort());
assert.equal(toolNames.includes("scan_assets"), false, "legacy scan_assets must not be exposed as a visible Agent Kernel action");
assert.equal(getVibeAgentActionDescriptor("scan_assets").description.includes("兼容旧时间线记录"), true);
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
assert.equal(planOnlyTurn.projectSnapshot.totalSections, 0);
assert.equal(planOnlyTurn.projectSnapshot.totalAssets, 2);
assert.equal(planOnlyTurn.projectSnapshot.skillCount, 0);
assert.equal(planOnlyTurn.kernelTurn.userMessage, "继续");
assert.match(planOnlyTurn.kernelTurn.agentUnderstanding, /确认前|不会|准备|参考|项目/u);
assert.match(planOnlyTurn.kernelTurn.projectStateSummary, /3 个镜头/u);
assert.match(planOnlyTurn.kernelTurn.projectStateSummary, /2 个素材/u);
assert.match(planOnlyTurn.kernelTurn.projectHierarchy, /3 个镜头 \/ 2 个素材 \/ 0 个 Skills/u);
assert.equal(planOnlyTurn.kernelTurn.projectDiagnostics.some((item) => /参考缺口/.test(item)), true);
assert.equal(planOnlyTurn.kernelTurn.proposedActions.length, 1);
assert.equal(planOnlyTurn.kernelTurn.proposedActions[0]?.lifecycle, "waiting_for_confirmation");
assert.equal(planOnlyTurn.kernelTurn.executionBoundary.costRisk, "external_provider");
assert.equal(planOnlyTurn.kernelTurn.executionBoundary.callsProvider, true);
assert.equal(planOnlyTurn.kernelTurn.executionBoundary.submitsExternalTask, false);
assert.equal(planOnlyTurn.kernelTurn.executionBoundary.requiresConfirmation, true);
assert.equal(planOnlyTurn.kernelTurn.executionResult.status, "awaiting_confirmation");
assert.equal(planOnlyTurn.kernelTurn.executionResult.lifecycle, "waiting_for_confirmation");
assert.equal(planOnlyTurn.kernelTurn.requiredConfirmation, true);
assert.match(planOnlyTurn.kernelTurn.executionCost, /参考生成|项目修改|读取项目/u);
assert.doesNotMatch(planOnlyTurn.kernelTurn.executionCost, /Project\.vibe/u, "Agent execution cost copy should not expose Project.vibe to the creator-facing message flow");
assert.match(planOnlyTurn.kernelTurn.externalSubmissionRisk, /生成|联网|不会提交视频/u);
assert.match(planOnlyTurn.kernelTurn.nextSuggestion, /确认|改哪里/u);
assert.deepEqual(planOnlyTurn.kernelTurn.createdOrUpdatedFiles, ["assets/generated/", ".vibe-runtime/"]);
assert.ok(planOnlyTurn.pendingConfirmationToken);
assertVisibleAgentTurnChain(planOnlyTurn.timeline.entries, [
  { type: "user_message", title: "你", label: "user input" },
  { type: "assistant_message", title: "我理解为", label: "Agent understanding" },
  { type: "tool_call", toolName: "inspect_project", label: "project inspection start" },
  { type: "tool_result", toolName: "inspect_project", label: "project inspection result" },
  { type: "tool_call", toolName: "classify_assets", label: "asset classification start" },
  { type: "tool_result", toolName: "classify_assets", label: "asset classification result" },
  { type: "tool_call", toolName: "plan_next_action", label: "next-action planning start" },
  { type: "tool_result", toolName: "plan_next_action", label: "next-action planning result" },
  { type: "tool_result", title: "执行边界", label: "execution boundary" },
  { type: "tool_call", toolName: "write_agent_message", label: "Agent reply write start" },
  { type: "assistant_message", title: "AI 导演", label: "Agent reply" },
  { type: "tool_call", toolName: "request_user_confirmation", label: "confirmation request start" },
  { type: "confirmation_request", label: "confirmation request card" },
]);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "user_message" && entry.body === "继续"), true);
const planOnlyUserEntry = planOnlyTurn.timeline.entries.find((entry) => entry.type === "user_message");
assert.ok(planOnlyUserEntry);
const planOnlyUnderstandingEntry = planOnlyTurn.timeline.entries.find((entry) => entry.id.startsWith("agent_understanding_"));
assert.ok(planOnlyUnderstandingEntry);
assert.equal(planOnlyUnderstandingEntry?.type, "assistant_message");
assert.equal(planOnlyUnderstandingEntry?.title, "我理解为");
assert.equal(planOnlyUnderstandingEntry?.lifecycle, "waiting_for_confirmation");
assert.match(planOnlyUnderstandingEntry?.body || "", /你想让我处理/u);
assert.match(planOnlyUnderstandingEntry?.body || "", /不会绕过确认直接执行/u);
const planOnlyTargetLabel = directorAgentDisplayTargetLabel(planOnlyTurn.action.target, planOnlyTurn.action.sourceContext);
assert.equal(planOnlyUserEntry?.facts?.some((fact) => fact.label === "引用" && fact.value === planOnlyTargetLabel), true);
assert.equal(planOnlyUserEntry?.facts?.some((fact) => fact.label === "正在看" && fact.value === "故事"), true);
const planOnlyUserContext = planOnlyUserEntry?.details?.selectedContext as { label?: string; ids?: string[]; kind?: string } | undefined;
assert.equal(planOnlyUserContext?.label, planOnlyTargetLabel);
assert.deepEqual(planOnlyUserContext?.ids, planOnlyTurn.action.target.ids);
assert.equal(planOnlyUnderstandingEntry?.facts?.some((fact) => fact.label === "引用" && fact.value === planOnlyTargetLabel), true);
assert.equal(planOnlyUnderstandingEntry?.facts?.some((fact) => fact.label === "边界" && /当前只允许整理计划|需要你确认|需要你允许/.test(fact.value)), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "tool_call" && entry.toolName === "inspect_project"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "tool_result" && entry.toolName === "inspect_project"), true);
const planOnlyInspectResult = planOnlyTurn.timeline.entries.find((entry) => entry.type === "tool_result" && entry.toolName === "inspect_project");
assert.equal(planOnlyInspectResult?.facts?.some((fact) => fact.label === "层级" && /短项目 \/ 3 镜头 \/ 2 素材 \/ 0 Skills/.test(fact.value)), true);
assert.equal(planOnlyInspectResult?.facts?.some((fact) => fact.label === "诊断" && /2 项参考待补/.test(fact.value)), true);
assert.equal(planOnlyInspectResult?.facts?.some((fact) => fact.label === "视频" && fact.value === "未提交"), true);
assert.equal(planOnlyInspectResult?.facts?.some((fact) => fact.value === "idle"), false);
const planOnlyExecutionBoundaryEntry = planOnlyTurn.timeline.entries.find((entry) => entry.id.startsWith("agent_tool_result_execution_boundary_"));
assert.ok(planOnlyExecutionBoundaryEntry);
assert.equal(planOnlyExecutionBoundaryEntry?.title, "执行边界");
assert.equal(planOnlyExecutionBoundaryEntry?.lifecycle, "waiting_for_confirmation");
assert.equal(planOnlyExecutionBoundaryEntry?.status, "done");
assert.equal(planOnlyExecutionBoundaryEntry?.facts?.some((fact) => fact.label === "确认" && fact.value === "等待确认"), true);
assert.equal(planOnlyExecutionBoundaryEntry?.facts?.some((fact) => fact.label === "外部提交" && fact.value === "不提交视频"), true);
assert.match(planOnlyExecutionBoundaryEntry?.body || "", /我会停在这里等你确认/u);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "tool_call" && entry.toolName === "classify_assets"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "tool_result" && entry.toolName === "classify_assets"), true);

const chineseShotRuntimeState = runtimeState({ missing: 0, shots: 1 }) as ProjectRuntimeState;
(chineseShotRuntimeState.storyFlow.shots[0] as { title: string }).title = "车票吐出";
const chineseShotSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: chineseShotRuntimeState,
  currentView: "story",
  selectedShotId: "shot_1",
});
const chineseShotTurn = runVibeAgentTurn({
  userMessage: "这个镜头更压抑一点，只整理计划。",
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: "/tmp/vibe-agent-core-demo",
  snapshot: chineseShotSnapshot,
  permissionMode: "plan_only",
  generatedAt: "2026-06-17T08:00:03.000Z",
});
const chineseShotLabel = "镜头 1 车票吐出";
const chineseShotUserEntry = chineseShotTurn.timeline.entries.find((entry) => entry.type === "user_message");
const chineseShotAssistantEntry = chineseShotTurn.timeline.entries.find((entry) => entry.type === "assistant_message");
const chineseShotConfirmation = chineseShotTurn.timeline.entries.find((entry) => entry.type === "confirmation_request");
assert.equal(chineseShotTurn.kernelTurn.selectedContext.label, chineseShotLabel);
assert.match(chineseShotTurn.kernelTurn.agentUnderstanding, /镜头 1 车票吐出/u);
assert.equal(chineseShotUserEntry?.facts?.some((fact) => fact.label === "引用" && fact.value === chineseShotLabel), true);
assert.equal(chineseShotUserEntry?.facts?.some((fact) => fact.label === "这个指向" && fact.value === chineseShotLabel), true);
assert.equal((chineseShotUserEntry?.details as { deicticCue?: string } | undefined)?.deicticCue, chineseShotLabel);
assert.match(chineseShotAssistantEntry?.body || "", /这里的“这个”我会理解为「镜头 1 车票吐出」/u);
assert.equal(chineseShotAssistantEntry?.facts?.some((fact) => fact.label === "这个指向" && fact.value === chineseShotLabel), true);
assert.equal((chineseShotAssistantEntry?.details as { deicticCue?: string } | undefined)?.deicticCue, chineseShotLabel);
assert.equal(chineseShotConfirmation?.facts?.some((fact) => fact.label === "目标" && fact.value === chineseShotLabel), true);
assert.equal(chineseShotTurn.timeline.entries.some((entry) => `${entry.title} ${entry.body} ${JSON.stringify(entry.facts || [])}`.includes("�")), false);

const selectedShotProjectReferenceSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: runtimeState({ missing: 2, shots: 2 }),
  currentView: "story",
  selectedShotId: "shot_1",
});
const selectedShotProjectReferenceTurn = runVibeAgentTurn({
  userMessage: "补齐整个项目的角色、场景和关键道具参考。只生成参考，不提交视频。",
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: "/tmp/vibe-agent-core-demo",
  snapshot: selectedShotProjectReferenceSnapshot,
  permissionMode: "reference_allowed",
  generatedAt: "2026-06-17T08:00:04.000Z",
});
const selectedShotProjectReferenceConfirmation = selectedShotProjectReferenceTurn.timeline.entries.find((entry) => entry.type === "confirmation_request");
assert.equal(selectedShotProjectReferenceTurn.action.target.kind, "project", "whole-project intent must override the current selected shot");
assert.equal(selectedShotProjectReferenceConfirmation?.facts?.some((fact) => fact.label === "影响" && fact.value === "整个项目"), true);
assert.equal(selectedShotProjectReferenceConfirmation?.facts?.some((fact) => fact.label === "外部提交" && fact.value === "只调用参考生成，不提交视频"), true);

const englishSubmitTurn = runVibeAgentTurn({
  userMessage: "submit video",
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: "/tmp/vibe-agent-core-demo",
  snapshot: chineseShotSnapshot,
  permissionMode: "plan_only",
  generatedAt: "2026-06-17T08:00:04.000Z",
});
const englishSubmitUserEntry = englishSubmitTurn.timeline.entries.find((entry) => entry.type === "user_message");
assert.equal(englishSubmitUserEntry?.facts?.some((fact) => fact.label === "这个指向"), false);

const folderAssetSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: runtimeState({
    missing: 0,
    needsReview: 0,
    shots: 2,
    assets: [
      {
        id: "folder_character_front",
        type: "unknown",
        name: "front.png",
        path: "characters/heroine/front.png",
        status: "exists",
        lockedStatus: "needs_review",
        sourceRefs: ["project_folder_scan"],
        safeForFutureReference: true,
        issues: [],
      },
      {
        id: "folder_scene_wide",
        type: "unknown",
        name: "wide.jpg",
        path: "scenes/rain-station/wide.jpg",
        status: "exists",
        lockedStatus: "needs_review",
        sourceRefs: ["project_folder_scan"],
        safeForFutureReference: true,
        issues: [],
      },
      {
        id: "folder_hand_detail",
        type: "unknown",
        name: "hand-closeup.png",
        path: "characters/heroine/hand-closeup.png",
        status: "exists",
        lockedStatus: "needs_review",
        sourceRefs: ["project_folder_scan"],
        safeForFutureReference: true,
        issues: [],
      },
    ],
  }),
  currentView: "reference",
});
assert.equal(folderAssetSnapshot.assetInbox.totalCount >= 3, true);
assert.match(folderAssetSnapshot.assetInbox.summary, /项目文件夹/u);
assert.equal(folderAssetSnapshot.assetInbox.kindSummary.some((item) => item.label === "角色" && item.count >= 1), true);
assert.equal(folderAssetSnapshot.assetInbox.kindSummary.some((item) => item.label === "场景" && item.count >= 1), true);
assert.equal(folderAssetSnapshot.assetInbox.kindSummary.some((item) => item.label === "参考" && item.count >= 1), true);
assert.equal(folderAssetSnapshot.assetInbox.items.some((item) => item.kind === "character" && /front/.test(item.label)), true);
assert.equal(folderAssetSnapshot.assetInbox.items.some((item) => /hand-closeup/.test(item.label) && /不单独生成参考/.test(item.suggestedBinding)), true);
const folderAssetTurn = runVibeAgentTurn({
  userMessage: "整理这些素材",
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: "/tmp/vibe-agent-core-demo",
  snapshot: folderAssetSnapshot,
  permissionMode: "plan_only",
  generatedAt: "2026-06-17T08:00:05.000Z",
});
assert.match(folderAssetTurn.action.summary, /整理项目素材绑定建议/u);
assert.match(folderAssetTurn.action.userFacingMessage, /不会生成参考，也不会提交视频/u);
assert.equal(folderAssetTurn.kernelTurn.proposedActions[0]?.name, "classify_assets");
assert.equal(folderAssetTurn.kernelTurn.proposedActions[0]?.label, "整理素材");
assert.equal(folderAssetTurn.kernelTurn.proposedActions[0]?.lifecycle, "succeeded");
assert.equal(folderAssetTurn.kernelTurn.executionResult.status, "succeeded");
assert.match(folderAssetTurn.kernelTurn.executionResult.summary, /已整理素材用途和绑定建议/u);
assert.match(folderAssetTurn.kernelTurn.executionResult.next, /确认待定素材|下一步/u);
const folderScanResult = folderAssetTurn.timeline.entries.find((entry) => entry.type === "tool_result" && entry.toolName === "classify_assets");
assert.ok(folderScanResult);
assert.match(folderScanResult?.body || "", /项目文件夹/u);
assert.match(folderScanResult?.body || "", /我看到的类型/u);
assert.match(folderScanResult?.body || "", /需要你确认/u);
assert.match(folderScanResult?.body || "", /绑定建议：/u);
assert.match(folderScanResult?.body || "", /front\.png → 作为角色参考/u);
assert.match(folderScanResult?.body || "", /局部细节会并入主体或镜头说明，不单独生成参考：hand-closeup\.png/u);
assert.equal(folderScanResult?.facts?.some((fact) => fact.label === "识别素材" && /\d+ 个/.test(fact.value)), true);
assert.equal(folderScanResult?.facts?.some((fact) => fact.label === "分类" && /角色|场景|参考/.test(fact.value)), true);
assert.equal(folderScanResult?.facts?.some((fact) => fact.label === "并入说明" && /hand-closeup\.png/.test(fact.value)), true);
assert.equal(folderScanResult?.facts?.some((fact) => fact.label === "下一步" && /确认这些素材/.test(fact.value)), true);
assert.equal(folderScanResult?.facts?.some((fact) => /^(先确认|建议)/.test(fact.label) && /建议作为角色参考|建议作为场景参考|不单独生成参考/.test(fact.value)), true);
assert.equal(Boolean(folderScanResult?.details?.assetInbox), true);
const folderAssetReviewSummary = folderScanResult?.details?.assetReviewSummary as { needsReview?: number; reviewLabels?: string[]; foldedDetailLabels?: string[]; next?: string } | undefined;
assert.equal(typeof folderAssetReviewSummary?.needsReview, "number");
assert.equal(Array.isArray(folderAssetReviewSummary?.reviewLabels), true);
assert.equal(Array.isArray((folderAssetReviewSummary as { bindingHints?: string[] } | undefined)?.bindingHints), true);
assert.equal((folderAssetReviewSummary as { bindingHints?: string[] } | undefined)?.bindingHints?.some((item) => /front\.png → 作为角色参考/.test(item)), true);
assert.deepEqual(folderAssetReviewSummary?.foldedDetailLabels, ["hand-closeup.png"]);
assert.match(folderAssetReviewSummary?.next || "", /确认这些素材/u);
const folderPlanResult = folderAssetTurn.timeline.entries.find((entry) => entry.type === "tool_result" && entry.toolName === "plan_next_action" && entry.actionId === folderAssetTurn.action.actionId);
assert.equal(folderPlanResult?.lifecycle, "succeeded");
assert.equal(folderPlanResult?.facts?.some((fact) => fact.label === "下一步" && fact.value === "确认素材用途或继续规划"), true);
const folderBoundaryResult = folderAssetTurn.timeline.entries.find((entry) => entry.id.startsWith("agent_tool_result_execution_boundary_") && entry.actionId === folderAssetTurn.action.actionId);
assert.equal(folderBoundaryResult?.lifecycle, "succeeded");
assert.equal((folderBoundaryResult?.details?.executionResult as { status?: string; summary?: string } | undefined)?.status, "succeeded");
assert.match((folderBoundaryResult?.details?.executionResult as { summary?: string } | undefined)?.summary || "", /已整理素材用途和绑定建议/u);
const folderAssistant = folderAssetTurn.timeline.entries.find((entry) => entry.id.startsWith("agent_assistant_") && entry.actionId === folderAssetTurn.action.actionId);
assert.equal(folderAssistant?.lifecycle, "succeeded");
assert.match(folderAssistant?.body || "", /已整理素材用途和绑定建议/u);
assert.match(folderAssistant?.body || "", /结果已经写进上面的消息流/u);
assert.doesNotMatch(folderAssistant?.body || "", /^我会先/u, "completed Agent observations must not end with future-tense copy");
assert.equal(folderAssetTurn.kernelTurn.relatedAssets.includes("folder_character_front"), true);
assert.equal(folderAssetTurn.kernelTurn.relatedAssets.includes("folder_scene_wide"), true);
assert.equal(folderAssetTurn.kernelTurn.relatedAssets.includes("folder_hand_detail"), true);
const folderScanTimelineStatus = buildVibeAgentTimelineStatusView([folderScanResult]);
assert.equal(folderScanTimelineStatus?.nextAction, folderAssetReviewSummary?.next);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "tool_call" && entry.toolName === "plan_next_action"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "tool_result" && entry.toolName === "plan_next_action"), true);
const planNextResultEntry = planOnlyTurn.timeline.entries.find((entry) => entry.type === "tool_result" && entry.toolName === "plan_next_action");
assert.equal(planNextResultEntry?.lifecycle, "proposed");
assert.match(planNextResultEntry?.body || "", /我建议先做/);
assert.match(planNextResultEntry?.body || "", /目标是/);
assert.match(planNextResultEntry?.body || "", /确认后调用参考生成/);
assert.match(planNextResultEntry?.body || "", /预计保存到 参考结果和运行记录/);
assert.doesNotMatch(planNextResultEntry?.body || "", /assets\/generated|\.vibe-runtime|Project\.vibe/, "visible Agent plan copy should use creator-facing destinations");
assert.match(planNextResultEntry?.body || "", /下一步：等你确认/);
assert.equal(planNextResultEntry?.facts?.some((fact) => fact.label === "成本" && fact.value === "会调用参考生成"), true);
assert.equal(planNextResultEntry?.facts?.some((fact) => fact.label === "外部提交" && fact.value === "确认后调用参考生成"), true);
assert.equal(planNextResultEntry?.facts?.some((fact) => fact.label === "写入" && fact.value === "参考结果和运行记录"), true);
assert.equal(planNextResultEntry?.facts?.some((fact) => fact.label === "下一步" && fact.value === "等你确认"), true);
assert.match(String(planNextResultEntry?.details?.permissionBoundary || ""), /当前只允许整理计划|需要你确认|需要你允许/);
const referenceOnlyAction = {
  ...planOnlyTurn.action,
  actionId: "reference-only-action",
  executionContract: {
    mode: "reference_allowed" as const,
    referenceGenerationAllowed: true,
    videoSubmitAllowed: false,
    providerSubmitAllowed: true,
    reason: "测试参考生成不提交视频。",
  },
  toolPlan: {
    ...planOnlyTurn.action.toolPlan,
    providerSubmitAllowed: true,
  },
};
const referenceOnlyTurn = runVibeAgentTurn({
  userMessage: "可以补参考，不提交视频",
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: "/tmp/vibe-agent-core-demo",
  snapshot,
  action: referenceOnlyAction,
  permissionMode: "project_write_allowed",
  generatedAt: "2026-06-17T08:00:03.000Z",
});
const referenceOnlyPlanEntry = referenceOnlyTurn.timeline.entries.find((entry) => entry.actionId === "reference-only-action" && entry.toolName === "plan_next_action");
assert.match(referenceOnlyPlanEntry?.body || "", /只调用参考生成，不提交视频/);
assert.equal(referenceOnlyPlanEntry?.facts?.some((fact) => fact.label === "外部提交" && fact.value === "只调用参考生成，不提交视频"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "tool_call" && entry.toolName === "write_agent_message"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "assistant_message" && entry.title === "AI 导演"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "assistant_message" && entry.lifecycle === "waiting_for_confirmation"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "tool_call" && entry.toolName === "request_user_confirmation"), true);
assert.equal(planOnlyTurn.timeline.entries.some((entry) => entry.type === "confirmation_request"), true);
const skillSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: runtimeState({
    missing: 0,
    needsReview: 0,
    shots: 3,
    strategies: ["storyboard_narrative", "omni_reference", "storyboard_rapid_cut"],
  }),
  currentView: "story",
  selectedShotIds: ["shot_1", "shot_2", "shot_3"],
});
const skillTurn = runVibeAgentTurn({
  userMessage: "看一下这三个镜头怎么做",
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: "/tmp/vibe-agent-core-demo",
  snapshot: skillSnapshot,
  permissionMode: "plan_only",
  generatedAt: "2026-06-17T08:00:10.000Z",
});
const skillUserEntry = skillTurn.timeline.entries.find((entry) => entry.type === "user_message");
assert.ok(skillUserEntry);
assert.equal(skillUserEntry?.facts?.some((fact) => fact.label === "引用" && /镜头/u.test(fact.value)), true);
const skillUserContext = skillUserEntry?.details?.selectedContext as { ids?: string[]; kind?: string } | undefined;
assert.deepEqual(skillUserContext?.ids, skillTurn.action.target.ids);
const skillRecommendationEntry = skillTurn.timeline.entries.find((entry) => entry.title === "推荐 Skills");
assert.ok(skillRecommendationEntry);
assert.equal(skillRecommendationEntry?.toolName, "plan_next_action");
assert.equal(skillRecommendationEntry?.lifecycle, "proposed");
assert.match(skillRecommendationEntry?.body || "", /故事板叙事/u);
assert.match(skillRecommendationEntry?.body || "", /故事板快切/u);
assert.match(skillRecommendationEntry?.body || "", /全能参考/u);
assert.equal(skillRecommendationEntry?.facts?.some((fact) => fact.label === "影响镜头" && /镜头 1/.test(fact.value)), true);
assert.equal(skillRecommendationEntry?.facts?.some((fact) => fact.label === "影响环节" && /Seedance prompt/.test(fact.value)), true);
assert.deepEqual(skillTurn.kernelTurn.relatedSkills, ["故事板叙事", "全能参考", "故事板快切"]);
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
assert.equal(emptyReferenceTurn.timeline.entries.some((entry) => entry.title === "素材识别结果" && /发现 2 个参考/.test(entry.body)), true);
const emptyReferenceClassifyResult = emptyReferenceTurn.timeline.entries.find((entry) => entry.title === "素材识别结果");
assert.equal(emptyReferenceClassifyResult?.facts?.some((fact) => fact.label === "下一步" && fact.value === "确认范围后生成参考"), true);
assert.equal(emptyReferenceClassifyResult?.details?.next, "确认范围后生成参考");
const planOnlyConfirmation = planOnlyTurn.timeline.entries.find((entry) => entry.type === "confirmation_request");
assert.ok(planOnlyConfirmation);
assert.match(planOnlyConfirmation?.title || "", /行动卡片：确认生成参考/u);
assert.equal(planOnlyConfirmation?.lifecycle, "waiting_for_confirmation");
assert.equal(planOnlyConfirmation?.actionKind, planOnlyTurn.action.kind);
assert.equal(planOnlyConfirmation?.facts?.some((fact) => fact.label === "动作" && fact.value === planOnlyTurn.action.summary), true);
assert.equal(planOnlyConfirmation?.facts?.some((fact) => fact.label === "目标" && fact.value === planOnlyTargetLabel), true);
assert.equal(planOnlyConfirmation?.facts?.some((fact) => fact.label === "影响"), true);
assert.equal(planOnlyConfirmation?.facts?.some((fact) => fact.label === "执行" && /Image2|Seedance|写入项目|本地导出|联网查资料/.test(fact.value)), true);
assert.equal(planOnlyConfirmation?.facts?.some((fact) => fact.label === "成本" && /参考生成|Seedance|视频请求|联网|读取项目|项目修改/.test(fact.value)), true);
assert.equal(planOnlyConfirmation?.facts?.some((fact) => fact.label === "外部提交" && /确认后|不提交视频|Seedance/.test(fact.value)), true);
assert.equal(planOnlyConfirmation?.facts?.some((fact) => fact.label === "下一步" && fact.value === "等你确认"), true);
assert.equal(planOnlyConfirmation?.details?.expectedReceipt, planOnlyTurn.action.toolPlan.expectedReceipt);
assert.equal(planOnlyConfirmation?.details?.toolName, planOnlyTurn.action.toolPlan.toolName);
assert.match(planOnlyTurn.permissionDecision.reason, /当前只允许整理计划|需要你确认|需要你允许/);
assert.doesNotMatch(planOnlyTurn.permissionDecision.reason, /plan_only|project_write_allowed|reference_allowed|video_allowed|export_allowed|revise_story_or_shot/);
const planOnlyTimelineStatus = buildVibeAgentTimelineStatusView(planOnlyTurn.timeline.entries);
assert.equal(planOnlyTimelineStatus?.stage, "等待确认");
assert.equal(planOnlyTimelineStatus?.waitingFor, "你的确认");
assert.equal(planOnlyTimelineStatus?.tone, "waiting");
const assistantDraftWaitingStatus = buildVibeAgentTimelineStatusView([
  {
    id: "skill_save_draft_waiting",
    type: "assistant_message",
    createdAt: "2026-06-17T08:00:30.500Z",
    title: "AI 导演：导演经验已整理",
    body: "我会把当前做法沉淀成可复用导演经验。确认前不会生成参考或提交视频。",
    toolName: "save_skill",
    lifecycle: "proposed",
    status: "waiting",
    facts: [
      { label: "名称", value: "雨夜停顿" },
      { label: "下一步", value: "确认后保存到项目 Skills。" },
    ],
    details: { next: "确认后保存到项目 Skills。" },
  },
]);
assert.equal(assistantDraftWaitingStatus?.stage, "AI 导演：导演经验已整理");
assert.equal(assistantDraftWaitingStatus?.waitingFor, "你的确认");
assert.equal(assistantDraftWaitingStatus?.tone, "waiting");
assert.notEqual(assistantDraftWaitingStatus?.stage, "Agent 正在执行");
const selectionChangedAfterConfirmationStatus = buildVibeAgentTimelineStatusView([
  ...(planOnlyTurn.timeline.entries || []),
  {
    id: "selection_context_shot_2",
    type: "state_change",
    createdAt: "2026-06-17T08:00:31.000Z",
    title: "当前讨论对象已切换",
    body: "现在说“这个”时，我会指向镜头 2 发光车票。",
    lifecycle: "succeeded",
    status: "done",
    facts: [
      { label: "当前选择", value: "镜头 2 发光车票" },
      { label: "下一步", value: "直接说改法，或说“继续下一步”。" },
    ],
    details: { next: "直接说改法，或说“继续下一步”。" },
  },
]);
assert.equal(selectionChangedAfterConfirmationStatus?.stage, "等待确认");
assert.equal(selectionChangedAfterConfirmationStatus?.waitingFor, "你的确认");
assert.equal(selectionChangedAfterConfirmationStatus?.tone, "waiting");
assert.doesNotMatch(selectionChangedAfterConfirmationStatus?.doing || "", /镜头 2/u);
const selectionOnlyTimelineStatus = buildVibeAgentTimelineStatusView([
  {
    id: "selection_context_shot_only",
    type: "state_change",
    createdAt: "2026-06-17T08:00:32.000Z",
    title: "当前讨论对象已切换",
    body: "现在说“这个”时，我会指向镜头 2 发光车票。",
    lifecycle: "succeeded",
    status: "done",
    details: { next: "直接说改法，或说“继续下一步”。" },
  },
]);
assert.equal(selectionOnlyTimelineStatus, undefined);

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
assert.equal(queryVideoTurn.kernelTurn.proposedActions[0]?.name, "query_video");
assert.match(queryVideoTurn.kernelTurn.externalSubmissionRisk, /不会提交视频/u);
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
assert.equal(authoritativeActionTurn.kernelTurn.proposedActions[0]?.name, "submit_video");
assert.equal(authoritativeActionTurn.kernelTurn.executionBoundary.costRisk, "external_video_submission");
assert.equal(authoritativeActionTurn.kernelTurn.executionBoundary.submitsExternalTask, true);
assert.equal(authoritativeActionTurn.kernelTurn.executionResult.status, "awaiting_confirmation");
assert.match(authoritativeActionTurn.kernelTurn.externalSubmissionRisk, /Seedance/u);
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
assert.equal(authoritativeConfirmedTurn.kernelTurn.proposedActions[0]?.lifecycle, "running");
assert.equal(authoritativeConfirmedTurn.kernelTurn.executionResult.status, "running");
assert.match(authoritativeConfirmedTurn.kernelTurn.executionResult.summary, /已确认/u);
const authoritativeConfirmedUnderstanding = [...authoritativeConfirmedTurn.timeline.entries].reverse().find((entry) => (
  entry.actionId === "authoritative-video-action" && entry.id.startsWith("agent_understanding_")
));
assert.equal(authoritativeConfirmedUnderstanding?.lifecycle, "running");
assert.equal(authoritativeConfirmedUnderstanding?.details?.next, "继续看我下面的执行结果");
const authoritativeConfirmedBoundary = [...authoritativeConfirmedTurn.timeline.entries].reverse().find((entry) => (
  entry.actionId === "authoritative-video-action" && entry.id.startsWith("agent_tool_result_execution_boundary_")
));
assert.equal(authoritativeConfirmedBoundary?.lifecycle, "running");
assert.equal(authoritativeConfirmedBoundary?.status, "waiting");
assert.equal(authoritativeConfirmedBoundary?.facts?.some((fact) => fact.label === "确认" && fact.value === "已确认"), true);
assert.equal(authoritativeConfirmedBoundary?.facts?.some((fact) => fact.label === "外部提交" && fact.value === "会提交 Seedance"), true);
assert.match(authoritativeConfirmedBoundary?.body || "", /你已经确认/u);
assert.equal(authoritativeConfirmedTurn.timeline.entries.some((entry) => entry.actionId === "authoritative-video-action" && entry.toolName === "submit_video"), true);

const compileOnlyVideoAction = {
  ...authoritativeVideoAction,
  actionId: "compile-only-video-action",
  status: "blocked" as const,
  summary: "准备视频请求",
  userFacingMessage: "我只能先整理视频请求，不提交视频。",
  blockers: ["当前还不能提交视频，需要你先允许。"],
  executionContract: {
    mode: "plan_only" as const,
    referenceGenerationAllowed: false,
    videoSubmitAllowed: false,
    providerSubmitAllowed: false,
    reason: "测试只允许准备视频请求。",
  },
  toolPlan: {
    ...authoritativeVideoAction.toolPlan,
    providerSubmitAllowed: false,
  },
};
const compileOnlyDispatchPlan = buildVibeAgentDispatchPlan(compileOnlyVideoAction);
assert.equal(compileOnlyDispatchPlan.executorTool, "compile_video_request");
const compileOnlyTurn = runVibeAgentTurn({
  userMessage: "先准备视频请求，不提交视频",
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: "/tmp/vibe-agent-core-demo",
  snapshot,
  action: compileOnlyVideoAction,
  permissionMode: "project_write_allowed",
  generatedAt: "2026-06-17T08:00:55.000Z",
});
assert.equal(compileOnlyTurn.status, "blocked");
assert.equal(compileOnlyTurn.kernelTurn.proposedActions[0]?.name, "compile_video_request");
assert.equal(compileOnlyTurn.kernelTurn.proposedActions[0]?.lifecycle, "needs_user_input");
assert.equal(compileOnlyTurn.kernelTurn.executionBoundary.costRisk, "project_write");
assert.equal(compileOnlyTurn.kernelTurn.executionBoundary.submitsExternalTask, false);
assert.equal(compileOnlyTurn.kernelTurn.executionResult.status, "blocked");
assert.match(compileOnlyTurn.kernelTurn.executionResult.summary, /当前还不能提交视频/u);
assert.match(compileOnlyTurn.kernelTurn.externalSubmissionRisk, /不会提交视频/u);
assert.equal(compileOnlyTurn.kernelTurn.createdOrUpdatedFiles.includes("Project.vibe"), true);
assert.equal(compileOnlyTurn.timeline.entries.some((entry) => entry.actionId === "compile-only-video-action" && entry.type === "confirmation_request"), false);
const compileOnlyPlanResult = compileOnlyTurn.timeline.entries.find((entry) => entry.actionId === "compile-only-video-action" && entry.toolName === "plan_next_action");
assert.ok(compileOnlyPlanResult);
assert.equal(compileOnlyPlanResult?.lifecycle, "needs_user_input");
assert.equal(compileOnlyPlanResult?.status, "blocked");
assert.match(compileOnlyPlanResult?.body || "", /我暂时不能执行/);
assert.match(compileOnlyPlanResult?.body || "", /先处理：当前还不能提交视频/);
assert.equal(compileOnlyPlanResult?.facts?.some((fact) => fact.label === "成本" && fact.value === "只准备视频请求"), true);
assert.equal(compileOnlyPlanResult?.facts?.some((fact) => fact.label === "外部提交" && fact.value === "不提交视频"), true);
assert.equal(compileOnlyPlanResult?.facts?.some((fact) => fact.label === "需要处理" && /当前还不能提交视频/.test(fact.value)), true);
assert.equal(compileOnlyPlanResult?.facts?.some((fact) => fact.label === "下一步" && fact.value === "调整视频请求后重新确认"), true);
assert.equal(compileOnlyPlanResult?.details?.fileImpact, "视频请求草案");
assert.match(String(compileOnlyPlanResult?.details?.permissionBoundary || ""), /需要先等用户确认|当前只允许整理计划|需要你允许/);
assert.deepEqual(compileOnlyPlanResult?.details?.blockers, ["当前还不能提交视频，需要你先允许。"]);

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
assert.equal(confirmedTurn.timeline.entries.some((entry) => entry.lifecycle === "running"), true);
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
assert.equal(buildVibeAgentDispatchPlan({
  ...confirmedTurn.action,
  kind: "prepare_export",
  toolPlan: {
    ...confirmedTurn.action.toolPlan,
    toolName: "project_export",
    expectedReceipt: "export_receipt",
  },
}).executorTool, "export_showcase");
const exportHandlers = buildVibeAgentProductExecutionHandlers({
  exportProject: (context) => `${context.dispatchPlan.executorTool}:exported`,
});
assert.equal(typeof exportHandlers.export_showcase, "function");
assert.equal(typeof exportHandlers.export_project, "function");
const exportAction = {
  ...confirmedTurn.action,
  kind: "prepare_export" as const,
  toolPlan: {
    ...confirmedTurn.action.toolPlan,
    toolName: "project_export" as const,
    expectedReceipt: "export_receipt",
  },
};
const exportExecution = await executeRegisteredVibeAgentAction({
  action: exportAction,
  permissionMode: "export_allowed",
  userConfirmed: true,
  handlers: exportHandlers,
});
assert.equal(exportExecution.status, "completed");
if (exportExecution.status === "completed") {
  assert.equal(exportExecution.value, "export_showcase:exported");
}

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
  label: "参考生成中，等待结果回到参考页。",
  projectRecordPreserved: true,
  waitingReview: false,
  previewReady: false,
  resultStatus: "running",
});
assert.deepEqual(referenceGenerationToolOutcome({
  status: "needs_review",
  message: "参考已回流",
  assets: [{ path: "references/heroine.png" }],
}), {
  status: "completed",
  label: "参考已回流",
  projectRecordPreserved: true,
  waitingReview: true,
  previewReady: false,
  resultStatus: "ready",
  resultFacts: [
    { label: "生成", value: "1 个参考" },
    { label: "产物", value: "references/heroine.png" },
  ],
});
assert.equal(
  referenceGenerationToolOutcome({
    status: "verified",
    message: "Confirmed creator change; queued 4 validated task envelope(s). controlled image2_reference_generation handoff prepared after Project.vibe write.",
    assets: [{ path: "assets/asset_project_direction.json" }],
  }).label,
  "参考生成中，等待结果回到参考页。",
);
assert.deepEqual(videoSubmitToolOutcome({ status: "ready", message: "视频已回流" }), {
  status: "completed",
  label: "视频已回流",
  projectRecordPreserved: true,
  waitingReview: false,
  previewReady: true,
  resultStatus: "ready",
});
assert.equal(videoSubmitToolOutcome({ status: "blocked", qaFeedback: { summary: "先修参考" } }).label, "先修参考");
const blockedSeedanceReportOutcome = videoSubmitToolOutcome({
  ok: false,
  status: "text_qa_blocked",
  uiStatus: "blocked",
  videoSubmitted: false,
  textQaReport: { status: "blocked", summary: "多出了错误角色参考。" },
  message: "提交前检查未通过。",
});
assert.equal(blockedSeedanceReportOutcome.status, "blocked");
assert.equal(blockedSeedanceReportOutcome.label, "多出了错误角色参考。");
assert.equal(blockedSeedanceReportOutcome.previewReady, false);
assert.equal(blockedSeedanceReportOutcome.resultStatus, undefined);
const submittedSeedanceReportOutcome = videoSubmitToolOutcome({
  status: "submitted",
  message: "第一段已提交。",
  submitId: "seedance-submit-001",
  promptPath: "video/shot_1_prompt.txt",
  relayQueue: {
    counts: { total: 3, completed: 1, active: 1 },
    items: [{ submitId: "seedance-submit-001" }],
  },
});
assert.equal(submittedSeedanceReportOutcome.resultFacts?.some((fact) => fact.label === "提交号" && fact.value === "seedance-submit-001"), true);
assert.equal(submittedSeedanceReportOutcome.resultFacts?.some((fact) => fact.label === "队列" && /共 3 段，已完成 1 段/.test(fact.value)), true);
const referenceReportOutcome = referenceGenerationToolOutcome({
  status: "needs_review",
  message: "参考已生成。",
  generatedAssetCount: 2,
  assets: [{ path: "references/heroine.png" }],
  providerId: "image2",
});
assert.equal(referenceReportOutcome.resultFacts?.some((fact) => fact.label === "生成" && fact.value === "2 个参考"), true);
assert.equal(referenceReportOutcome.resultFacts?.some((fact) => fact.label === "产物" && fact.value === "references/heroine.png"), true);
assert.equal(referenceReportOutcome.resultStatus, "ready");
assert.equal(exportToolOutcome({ status: "ready", message: "导出完成" }).resultStatus, "ready");
const exportReportOutcome = exportToolOutcome({
  status: "ready",
  message: "导出完成",
  exportRoot: "exports/demo",
  manifestPath: "exports/demo/export_manifest.json",
  executedCount: 4,
  plannedWriteCount: 5,
});
assert.equal(exportReportOutcome.resultFacts?.some((fact) => fact.label === "导出目录" && fact.value === "exports/demo"), true);
assert.equal(exportReportOutcome.resultFacts?.some((fact) => fact.label === "写入" && fact.value === "4/5"), true);
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
  videoSubmitBlockers: ["video_submit_missing_project"],
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
assert.deepEqual(busyReferenceAvailability.videoSubmitBlockers, []);

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
  scope?: "project" | "selected_shots";
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
    return { status: "needs_review", message: "参考执行完成", assets: [{ path: "references/product-run.png" }] };
  },
});
assert.equal(productRun.status, "completed");
assert.equal(productRun.label, "参考执行完成");
assert.equal(selectedHandoffId, productHandoff.handoffId);
assert.equal(referenceTarget?.scope, "project");
assert.equal(referenceTarget?.selectedShotIds, undefined);
assert.equal(referenceTarget?.confirmationReceiptId, productHandoff.handoffId);
assert.equal(referenceTarget?.agentToolTrace?.handoffId, productHandoff.handoffId);
assert.equal(statusLog.includes("参考执行完成"), true);

const selectedShotReferenceSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: runtimeState({ missing: 2, shots: 3 }),
  currentView: "story",
  selectedShotId: "shot_2",
});
const selectedShotReferenceTurn = runVibeAgentTurn({
  userMessage: "这个镜头先补场景参考，只生成参考，不提交视频。",
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: "/tmp/vibe-agent-core-demo",
  snapshot: selectedShotReferenceSnapshot,
  permissionMode: "reference_allowed",
  userConfirmed: true,
  generatedAt: "2026-06-17T08:02:15.000Z",
});
const selectedShotReferenceHandoff = buildDirectorAgentToolHandoff({
  action: selectedShotReferenceTurn.action,
  userConfirmed: true,
  confirmedAt: "2026-06-17T08:02:20.000Z",
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
let selectedShotReferenceTarget: {
  scope?: "project" | "selected_shots";
  selectedShotIds?: string[];
} | undefined;
const selectedShotReferenceRun = await runConfirmedVibeAgentProductAction({
  action: selectedShotReferenceTurn.action,
  userIntent: "这个镜头先补场景参考",
  preparedHandoff: selectedShotReferenceHandoff,
  buildHandoff: () => undefined,
  bindingIssue: () => undefined,
  blockedStatusLabel: (handoff) => handoff.userFacingMessage,
  resultLabel: (handoff) => handoff.userFacingMessage,
  referenceAssetTypesForAction: () => ["scene"],
  setStatus: (status) => statusLog.push(status),
  setHandoff: () => undefined,
  createReferences: (target) => {
    selectedShotReferenceTarget = target;
    return { status: "needs_review", message: "镜头参考执行完成", assets: [{ path: "references/shot.png" }] };
  },
});
assert.equal(selectedShotReferenceRun.status, "completed");
assert.equal(selectedShotReferenceTarget?.scope, "selected_shots", "shot reference generation must keep selected-shot scope");
assert.deepEqual(selectedShotReferenceTarget?.selectedShotIds, ["shot_2"], "shot reference generation must use the explicit shot target");

const projectWideReferenceHandoff = buildDirectorAgentToolHandoff({
  action: selectedShotProjectReferenceTurn.action,
  userConfirmed: true,
  confirmedAt: "2026-06-17T08:02:30.000Z",
  availability: {
    projectReady: true,
    webSearchReady: true,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: true,
  },
});
let projectWideReferenceTarget: {
  scope?: "project" | "selected_shots";
  selectedShotIds?: string[];
  confirmationReceiptId?: string;
} | undefined;
const projectWideReferenceRun = await runConfirmedVibeAgentProductAction({
  action: selectedShotProjectReferenceTurn.action,
  userIntent: "补齐整个项目的参考",
  preparedHandoff: projectWideReferenceHandoff,
  buildHandoff: () => undefined,
  bindingIssue: () => undefined,
  blockedStatusLabel: (handoff) => handoff.userFacingMessage,
  resultLabel: (handoff) => handoff.userFacingMessage,
  referenceAssetTypesForAction: () => ["character", "scene", "prop"],
  setStatus: (status) => statusLog.push(status),
  setHandoff: () => undefined,
  createReferences: (target) => {
    projectWideReferenceTarget = target;
    return { status: "needs_review", message: "项目级参考执行完成", assets: [{ path: "references/project-wide.png" }] };
  },
});
assert.equal(projectWideReferenceRun.status, "completed");
assert.equal(projectWideReferenceTarget?.scope, "project", "whole-project reference generation must preserve project scope");
assert.equal(projectWideReferenceTarget?.selectedShotIds, undefined, "whole-project reference generation must not be hijacked by the current selected shot");
assert.equal(projectWideReferenceTarget?.confirmationReceiptId, projectWideReferenceHandoff.handoffId);

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
    return { status: "needs_review", message: "registered product ok", assets: [{ path: "references/registered-product.png" }] };
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
    resultFacts: [{ label: "产物", value: "references/heroine.png" }],
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
    resultFacts: [{ label: "产物", value: "references/heroine.png" }],
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
assert.equal(actualStartedEntry.lifecycle, "running");
const actualStartedContext = actualStartedEntry.details?.selectedContext as { ids?: string[]; label?: string } | undefined;
assert.equal(actualStartedEntry.facts?.some((fact) => fact.label === "范围"), true);
assert.equal(actualStartedEntry.facts?.some((fact) => fact.label === "对象" && fact.value === actualStartedContext?.label), true);
assert.equal(actualStartedEntry.facts?.some((fact) => fact.label === "状态" && fact.value === "执行中"), true);
assert.equal(actualStartedEntry.facts?.some((fact) => fact.label === "下一步" && fact.value === "等待工具结果"), true);
assert.deepEqual(actualStartedContext?.ids, confirmedTurn.action.target.ids);
assert.equal(actualToolResultEntry.type, "tool_result");
assert.equal(actualToolResultEntry.toolName, "run_confirmed_action");
assert.match(actualToolResultEntry.body, /已完成：生成参考。参考已生成，去参考区复核。/u);
assert.match(actualToolResultEntry.body, /查看：参考页。下一步：去参考复核。/u);
assert.equal(actualToolResultEntry.status, "done");
assert.equal(actualToolResultEntry.lifecycle, "succeeded");
assert.equal(actualToolResultEntry.facts?.some((fact) => fact.label === "动作" && fact.value === "生成参考"), true);
assert.equal(actualToolResultEntry.facts?.some((fact) => fact.label === "范围"), true);
assert.equal(actualToolResultEntry.facts?.some((fact) => fact.label === "对象" && fact.value === actualStartedContext?.label), true);
assert.equal(actualToolResultEntry.facts?.some((fact) => fact.label === "产物" && fact.value === "references/heroine.png"), true);
assert.equal(actualToolResultEntry.facts?.some((fact) => fact.label === "查看" && fact.value === "参考页"), true);
assert.equal(actualToolResultEntry.facts?.some((fact) => fact.label === "下一步" && fact.value === "去参考复核"), true);
assert.equal(actualToolResultEntry.details?.resultView, "assets");
assert.deepEqual(actualToolResultEntry.details?.resultFacts, [{ label: "产物", value: "references/heroine.png" }]);
assert.deepEqual((actualToolResultEntry.details?.selectedContext as { ids?: string[] } | undefined)?.ids, confirmedTurn.action.target.ids);
assert.equal(actualToolResultEntry.details?.next, "去参考复核");
const actualToolExecutionResult = actualToolResultEntry.details?.executionResult as
  | { lifecycle?: string; status?: string; summary?: string; next?: string }
  | undefined;
assert.equal(actualToolExecutionResult?.status, "succeeded");
assert.equal(actualToolExecutionResult?.lifecycle, "succeeded");
assert.equal(actualToolExecutionResult?.summary, "参考已生成，去参考区复核。");
assert.equal(actualToolExecutionResult?.next, "去参考复核");
assert.equal(actualOutcomeEntry.type, "action_result");
assert.equal(actualOutcomeEntry.toolName, "generate_references");
assert.equal(actualOutcomeEntry.title, "结果卡片：参考待复核");
assert.match(actualOutcomeEntry.body, /已完成：生成参考。参考已生成，去参考区复核。/u);
assert.match(actualOutcomeEntry.body, /查看：参考页。下一步：去参考复核。/u);
assert.equal(actualOutcomeEntry.status, "done");
assert.equal(actualOutcomeEntry.lifecycle, "succeeded");
assert.equal(actualOutcomeEntry.facts?.some((fact) => fact.label === "范围"), true);
assert.equal(actualOutcomeEntry.facts?.some((fact) => fact.label === "对象" && fact.value === actualStartedContext?.label), true);
assert.equal(actualOutcomeEntry.facts?.some((fact) => fact.label === "产物" && fact.value === "references/heroine.png"), true);
assert.equal(actualOutcomeEntry.facts?.some((fact) => fact.label === "查看" && fact.value === "参考页"), true);
assert.equal(actualOutcomeEntry.facts?.some((fact) => fact.label === "下一步" && fact.value === "去参考复核"), true);
assert.equal(actualOutcomeEntry.details?.resultView, "assets");
assert.deepEqual((actualOutcomeEntry.details?.selectedContext as { ids?: string[] } | undefined)?.ids, confirmedTurn.action.target.ids);
assert.equal(actualOutcomeEntry.details?.next, "去参考复核");
const actualOutcomeExecutionResult = actualOutcomeEntry.details?.executionResult as
  | { lifecycle?: string; status?: string; summary?: string; next?: string }
  | undefined;
assert.equal(actualOutcomeExecutionResult?.status, "succeeded");
assert.equal(actualOutcomeExecutionResult?.lifecycle, "succeeded");
assert.equal(actualOutcomeExecutionResult?.summary, "参考已生成，去参考区复核。");
assert.equal(actualOutcomeExecutionResult?.next, "去参考复核");
const queryReadyOutcomeEntry = buildVibeAgentConfirmedActionReportEntry({
  generatedAt: "2026-06-17T08:01:34.000Z",
  action: queryVideoTurn.action,
  outcome: {
    status: "completed",
    label: "视频已回流",
    projectRecordPreserved: true,
    waitingReview: false,
    previewReady: true,
    resultStatus: "ready",
    resultFacts: [{ label: "视频", value: "video/shot_1.mp4" }],
  },
});
assert.equal(queryReadyOutcomeEntry.toolName, "query_video");
assert.equal(queryReadyOutcomeEntry.title, "结果卡片：视频已回流");
assert.equal(queryReadyOutcomeEntry.lifecycle, "succeeded");
assert.match(queryReadyOutcomeEntry.body, /已完成：查询视频。视频已回流。项目记录已保留。/u);
assert.match(queryReadyOutcomeEntry.body, /查看：预览页。下一步：去预览复核。/u);
assert.equal(queryReadyOutcomeEntry.facts?.some((fact) => fact.label === "查看" && fact.value === "预览页"), true);
assert.equal(queryReadyOutcomeEntry.facts?.some((fact) => fact.label === "视频" && fact.value === "video/shot_1.mp4"), true);
assert.equal(queryReadyOutcomeEntry.facts?.some((fact) => fact.label === "下一步" && fact.value === "去预览复核"), true);
assert.equal(queryReadyOutcomeEntry.details?.resultView, "preview");

const videoRunningOutcomeEntry = buildVibeAgentConfirmedActionReportEntry({
  generatedAt: "2026-06-17T08:01:36.000Z",
  action: authoritativeVideoAction,
  outcome: {
    status: "completed",
    label: "视频已发送，即梦排队中。",
    projectRecordPreserved: true,
    waitingReview: false,
    previewReady: false,
    resultStatus: "running",
    resultFacts: [{ label: "提交号", value: "seedance-submit-001" }],
  },
});
assert.equal(videoRunningOutcomeEntry.toolName, "submit_video");
assert.equal(videoRunningOutcomeEntry.title, "结果卡片：视频已提交");
assert.equal(videoRunningOutcomeEntry.lifecycle, "running");
assert.match(videoRunningOutcomeEntry.body, /已启动：提交视频。视频已发送，即梦排队中。/u);
assert.match(videoRunningOutcomeEntry.body, /查看：消息流。下一步：等待视频结果。/u);
assert.equal(videoRunningOutcomeEntry.facts?.some((fact) => fact.label === "状态" && fact.value === "进行中"), true);
assert.equal(videoRunningOutcomeEntry.facts?.some((fact) => fact.label === "提交号" && fact.value === "seedance-submit-001"), true);
const videoRunningExecutionResult = videoRunningOutcomeEntry.details?.executionResult as
  | { lifecycle?: string; status?: string; next?: string }
  | undefined;
assert.equal(videoRunningExecutionResult?.status, "running");
assert.equal(videoRunningExecutionResult?.lifecycle, "running");
assert.equal(videoRunningExecutionResult?.next, "等待视频结果");

const skippedOutcomeEntry = buildVibeAgentConfirmedActionReportEntry({
  generatedAt: "2026-06-17T08:01:37.000Z",
  action: confirmedTurn.action,
  outcome: {
    status: "skipped",
    label: "用户取消了这次参考生成。",
    projectRecordPreserved: true,
    waitingReview: false,
    previewReady: false,
  },
});
assert.equal(skippedOutcomeEntry.title, "结果卡片：已取消");
assert.equal(skippedOutcomeEntry.lifecycle, "cancelled");
assert.equal(skippedOutcomeEntry.status, "done");
assert.equal(skippedOutcomeEntry.facts?.some((fact) => fact.label === "下一步" && fact.value === "不需要继续执行"), true);
const skippedExecutionResult = skippedOutcomeEntry.details?.executionResult as
  | { lifecycle?: string; status?: string; next?: string }
  | undefined;
assert.equal(skippedExecutionResult?.status, "cancelled");
assert.equal(skippedExecutionResult?.lifecycle, "cancelled");
assert.equal(skippedExecutionResult?.next, "不需要继续执行");
const skippedTimelineStatus = buildVibeAgentTimelineStatusView([skippedOutcomeEntry]);
assert.equal(skippedTimelineStatus?.stage, "动作已取消");
assert.equal(skippedTimelineStatus?.nextAction, "不需要继续执行");
assert.equal(skippedTimelineStatus?.tone, "ready");

const exportReadyOutcomeEntry = buildVibeAgentConfirmedActionReportEntry({
  generatedAt: "2026-06-17T08:01:38.000Z",
  action: exportAction,
  outcome: {
    status: "completed",
    label: "导出完成",
    projectRecordPreserved: true,
    waitingReview: false,
    previewReady: false,
    resultStatus: "ready",
    resultFacts: [{ label: "清单", value: "exports/demo/export_manifest.json" }],
  },
});
assert.equal(exportReadyOutcomeEntry.toolName, "export_showcase");
assert.equal(exportReadyOutcomeEntry.title, "结果卡片：展示包已导出");
assert.match(exportReadyOutcomeEntry.body, /已完成：导出展示包。导出完成/u);
assert.match(exportReadyOutcomeEntry.body, /查看：交付页。下一步：去交付页查看。/u);
assert.equal(exportReadyOutcomeEntry.facts?.some((fact) => fact.label === "清单" && fact.value === "exports/demo/export_manifest.json"), true);
assert.equal(exportReadyOutcomeEntry.details?.resultView, "export");

const failedOutcomeEntry = buildVibeAgentConfirmedActionReportEntry({
  generatedAt: "2026-06-17T08:01:40.000Z",
  action: confirmedTurn.action,
  outcome: {
    status: "failed",
    label: "参考生成失败，项目已保留。",
    projectRecordPreserved: true,
    waitingReview: false,
    previewReady: false,
  },
});
assert.equal(failedOutcomeEntry.title, "结果卡片：执行失败");
assert.equal(failedOutcomeEntry.status, "blocked");
assert.equal(failedOutcomeEntry.lifecycle, "failed");
assert.match(failedOutcomeEntry.body, /执行失败：生成参考。参考生成失败，项目已保留。/u);
assert.match(failedOutcomeEntry.body, /查看：消息流。下一步：补素材或检查图片服务后重试。/u);
assert.equal(failedOutcomeEntry.facts?.some((fact) => fact.label === "下一步" && fact.value === "补素材或检查图片服务后重试"), true);
const failedExecutionResult = failedOutcomeEntry.details?.executionResult as
  | { lifecycle?: string; status?: string; next?: string }
  | undefined;
assert.equal(failedExecutionResult?.status, "failed");
assert.equal(failedExecutionResult?.lifecycle, "failed");
assert.equal(failedExecutionResult?.next, "补素材或检查图片服务后重试");

const failedVideoOutcomeEntry = buildVibeAgentConfirmedActionReportEntry({
  generatedAt: "2026-06-17T08:01:42.000Z",
  action: authoritativeVideoAction,
  outcome: {
    status: "failed",
    label: "视频提交失败，项目已保留。",
    projectRecordPreserved: true,
    waitingReview: false,
    previewReady: false,
  },
});
assert.equal(failedVideoOutcomeEntry.toolName, "submit_video");
assert.equal(failedVideoOutcomeEntry.facts?.some((fact) => fact.label === "下一步" && fact.value === "按提示处理后重试，或跳过这一段"), true);

const failedExportOutcomeEntry = buildVibeAgentConfirmedActionReportEntry({
  generatedAt: "2026-06-17T08:01:44.000Z",
  action: exportAction,
  outcome: {
    status: "failed",
    label: "导出失败，项目已保留。",
    projectRecordPreserved: true,
    waitingReview: false,
    previewReady: false,
  },
});
assert.equal(failedExportOutcomeEntry.toolName, "export_showcase");
assert.equal(failedExportOutcomeEntry.facts?.some((fact) => fact.label === "下一步" && fact.value === "检查视频段和导出设置后重试"), true);

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

const otherPersistRoot = "/tmp/vibe-agent-core-other-project";
const staleSaveResult = saveVibeAgentTimelineToProjectRoot(otherPersistRoot, {
  ...confirmedActionTimeline,
  projectRoot: persistRoot,
});
assert.equal(staleSaveResult.ok, true);
assert.ok(staleSaveResult.path);
const staleTimelineOnDisk = JSON.parse(fs.readFileSync(staleSaveResult.path, "utf8"));
fs.writeFileSync(staleSaveResult.path, `${JSON.stringify({
  ...staleTimelineOnDisk,
  projectRoot: persistRoot,
}, null, 2)}\n`);
const sameIdDifferentRoot = loadVibeAgentTimelineFromProjectRoot({
  projectId: "agent-core-demo",
  projectTitle: "Agent Core Demo",
  projectRoot: otherPersistRoot,
});
assert.equal(sameIdDifferentRoot.entries.length, 0, "same projectId with a different projectRoot must not restore stale Agent messages");

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
assert.equal(intakeEntries.some((entry) => entry.id.startsWith("new_video_understanding_") && entry.title === "我理解为"), true);
assert.equal(intakeEntries.some((entry) => entry.title === "我理解为" && entry.lifecycle === "waiting_for_confirmation"), true);
assert.equal(intakeEntries.some((entry) => entry.type === "tool_call" && entry.toolName === "inspect_project"), true);
assert.equal(intakeEntries.some((entry) => entry.type === "tool_result" && entry.toolName === "classify_assets"), true);
assert.equal(intakeEntries.some((entry) => entry.type === "tool_call" && entry.toolName === "plan_story"), true);
assert.equal(intakeEntries.some((entry) => entry.type === "tool_call" && entry.toolName === "plan_next_action"), false);
assert.equal(intakeEntries.some((entry) => entry.type === "assistant_message" && entry.toolName === "write_agent_message"), true);
assert.equal(intakeEntries.some((entry) => entry.type === "confirmation_request" && entry.confirmationRequired === true), true);
assert.equal(intakeEntries.every(isVibeAgentIntakeTimelineEntry), true);
const intakeStatusEntries = buildVibeAgentIntakeTimelineEntries({
  createdAt: "2026-06-17T08:02:30.000Z",
  phase: "status_inspection",
  userMessage: "只检查当前项目状态，不要生成参考，不要提交视频。",
  shotCount: 3,
  permissionMode: "plan_only",
});
const statusAssetEntry = intakeStatusEntries.find((entry) => entry.toolName === "classify_assets");
const statusPlanEntry = intakeStatusEntries.find((entry) => entry.toolName === "plan_next_action");
const statusUnderstandingEntry = intakeStatusEntries.find((entry) => entry.id.startsWith("new_video_understanding_"));
assert.equal(statusUnderstandingEntry?.title, "我理解为");
assert.match(statusUnderstandingEntry?.body || "", /只检查当前项目状态/u);
assert.match(statusUnderstandingEntry?.body || "", /不会把这句话当成脚本/u);
assert.match(statusAssetEntry?.body || "", /只做状态检查/u);
assert.doesNotMatch(statusAssetEntry?.body || "", /拆故事和镜头/u);
assert.ok(statusPlanEntry, "status-only intake should keep plan_next_action instead of plan_story");
assert.equal(intakeStatusEntries.some((entry) => entry.toolName === "plan_story"), false);
assert.equal(intakeStatusEntries.some((entry) => entry.type === "confirmation_request"), false);

console.log("vibe-agent-core-test: ok");
