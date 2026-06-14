import {
  buildDirectorAgentActionEnvelope,
  buildDirectorAgentStateSnapshot,
  normalizeDirectorAgentExecutionContract,
} from "../src/core/directorAgentAction.ts";
import {
  buildDirectorAgentToolHandoff,
  type DirectorAgentToolAvailability,
} from "../src/core/directorAgentToolHandoff.ts";
import { buildDirectorAgentToolTrace } from "../src/core/directorAgentToolTrace.ts";
import type { ProjectRuntimeState } from "../src/core/projectState.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const runtimeState = {
  project: {
    title: "工具分发测试",
    root: "/project/tool-handoff",
  },
  storyFlow: {
    shots: [{
      id: "S01",
      actId: "A01",
      title: "雨夜便利店",
      storyFunction: "建立动作",
      status: "ready",
      gates: {},
      issues: [],
      durationSeconds: 4,
    }],
  },
  visualMemory: {
    assets: [{
      id: "scene_rainy_store",
      type: "scene",
      name: "雨夜便利店",
      path: "assets/scenes/rainy-store.png",
      status: "generated",
      lockedStatus: "locked",
      safeForFutureReference: true,
      issues: [],
    }],
  },
} as unknown as ProjectRuntimeState;

const snapshot = buildDirectorAgentStateSnapshot({
  runtimeState,
  selectedShotId: "S01",
  currentView: "story",
});

const allReady: DirectorAgentToolAvailability = {
  projectReady: true,
  webSearchReady: true,
  referenceGenerationReady: true,
  videoSubmitReady: true,
  exportReady: true,
};

const referenceAllowed = normalizeDirectorAgentExecutionContract({
  mode: "reference_allowed",
  referenceGenerationAllowed: true,
  videoSubmitAllowed: false,
  providerSubmitAllowed: true,
  reason: "允许先补参考",
});

const videoAllowed = normalizeDirectorAgentExecutionContract({
  mode: "video_allowed",
  referenceGenerationAllowed: true,
  videoSubmitAllowed: true,
  providerSubmitAllowed: true,
  reason: "允许提交视频",
});

const referenceAction = buildDirectorAgentActionEnvelope({
  userIntent: "可以先补齐参考素材",
  snapshot,
  executionContract: referenceAllowed,
  generatedAt: "2026-05-31T01:00:00.000Z",
});
const referenceHandoff = buildDirectorAgentToolHandoff({
  action: referenceAction,
  userConfirmed: true,
  confirmedAt: "2026-05-31T01:00:01.000Z",
  availability: allReady,
});
assert(referenceHandoff.status === "ready", "confirmed reference action should become a ready tool handoff");
assert(referenceHandoff.handler === "image2_reference_generation", "reference action should route to Image2 reference generation");
assert(referenceHandoff.invocation?.selectedShotIds[0] === "S01", "handoff should carry selected shot ids");
assert(referenceHandoff.invocation?.confirmation.expectedReceipt === "image_reference_receipt", "handoff should carry expected receipt");
const referenceTaskEnvelope = referenceHandoff.invocation?.taskEnvelope;
assert(referenceTaskEnvelope, "ready reference handoff should expose a task envelope");
assert(referenceTaskEnvelope.id.includes(referenceAction.actionId.replace(/[^0-9A-Za-z]+/g, "_").toLowerCase()), "task envelope id should bind to the action id");
assert(referenceTaskEnvelope.inputHash.startsWith("agent_tool_input_"), "task envelope should carry a stable input hash");
assert(referenceTaskEnvelope.policyBinding === "director_agent_tool_handoff", "task envelope should carry the handoff policy binding");
assert(referenceTaskEnvelope.actionId === referenceAction.actionId, "task envelope action id should match the staged action");
assert(referenceTaskEnvelope.handler === "image2_reference_generation", "task envelope handler should match the tool handler");
assert(referenceTaskEnvelope.expectedReceipt === "image_reference_receipt", "task envelope should preserve the expected receipt");
assert(referenceTaskEnvelope.providerSubmitAllowed === true, "reference task envelope should preserve provider permission");
assert(referenceTaskEnvelope.preflight.projectWriteReceiptRequired === true, "reference task envelope should require a Project.vibe write receipt before invocation");
assert(referenceTaskEnvelope.preflight.ruleQaRequired === false, "reference generation should not require Seedance rule QA");
assert(referenceTaskEnvelope.preflight.textQaRequired === false, "reference generation should not require Seedance text QA");
assert(referenceTaskEnvelope.preflight.noBgmGuardRequired === false, "reference generation should not require a no-BGM video guard");
assert(referenceTaskEnvelope.projectWriteRequiredBeforeInvocation === true, "task envelope should require Project.vibe write first");
assert(referenceTaskEnvelope.userConfirmationRequired === true, "task envelope should preserve explicit user confirmation");
const referenceToolTrace = buildDirectorAgentToolTrace(referenceAction, referenceHandoff);
assert(referenceToolTrace.ok && referenceToolTrace.trace, "ready reference handoff should build a controlled tool trace");
assert(referenceToolTrace.trace.id === referenceTaskEnvelope.id, "tool trace id should come from the task envelope");
assert(referenceToolTrace.trace.inputHash === referenceTaskEnvelope.inputHash, "tool trace input hash should come from the task envelope");
assert(referenceToolTrace.trace.providerSubmitAllowed === true, "tool trace should preserve provider permission");
assert(referenceToolTrace.trace.preflight.projectWriteReceiptRequired === true, "tool trace should preserve preflight write receipt policy");
assert(referenceToolTrace.trace.preflight.textQaRequired === false, "tool trace should preserve reference preflight policy");
assert(referenceToolTrace.trace.projectWriteRequiredBeforeInvocation === true, "tool trace should preserve the project-write gate");
assert(referenceToolTrace.trace.userConfirmationRequired === true, "tool trace should preserve user confirmation");
assert(referenceToolTrace.trace.confirmedAt === "2026-05-31T01:00:01.000Z", "tool trace should preserve confirmed time");
assert(referenceToolTrace.trace.targetKind === "shot", "tool trace should preserve target kind");
assert(referenceToolTrace.trace.targetIds.includes("S01"), "tool trace should preserve target ids");
assert(referenceToolTrace.trace.selectedShotIds.includes("S01"), "tool trace should preserve selected shot ids");
assert(referenceToolTrace.trace.sourceProjectRoot === "/project/tool-handoff", "tool trace should preserve project root");
const repeatedReferenceHandoff = buildDirectorAgentToolHandoff({
  action: referenceAction,
  userConfirmed: true,
  confirmedAt: "2026-05-31T01:00:01.000Z",
  availability: allReady,
});
assert(
  repeatedReferenceHandoff.invocation?.taskEnvelope.inputHash === referenceTaskEnvelope.inputHash,
  "task envelope input hash should be deterministic for the same confirmed action",
);

const unconfirmedHandoff = buildDirectorAgentToolHandoff({
  action: referenceAction,
  userConfirmed: false,
  availability: allReady,
});
assert(unconfirmedHandoff.status === "blocked", "tool handoff must wait for user confirmation");
assert(unconfirmedHandoff.blockers.includes("user_confirmation_required"), "unconfirmed handoff should explain confirmation blocker");
assert(!unconfirmedHandoff.invocation, "blocked handoff must not expose invocation payload");

const unconfirmedWithoutProject = buildDirectorAgentToolHandoff({
  action: referenceAction,
  userConfirmed: false,
  availability: { ...allReady, projectReady: false },
});
assert(unconfirmedWithoutProject.status === "blocked", "missing project should block even before confirmation");
assert(unconfirmedWithoutProject.blockers.includes("user_confirmation_required"), "missing-project handoff should still remember confirmation is needed");
assert(unconfirmedWithoutProject.blockers.includes("project_not_ready"), "missing-project handoff should keep the project blocker");
assert(
  unconfirmedWithoutProject.userFacingMessage === "请先打开或创建项目文件夹。",
  "missing-project message should be shown before the generic confirmation blocker",
);

const planOnly = normalizeDirectorAgentExecutionContract({
  mode: "plan_only",
  referenceGenerationAllowed: false,
  videoSubmitAllowed: false,
  providerSubmitAllowed: false,
  reason: "只规划",
});
const blockedReferenceAction = buildDirectorAgentActionEnvelope({
  userIntent: "帮我补参考图",
  snapshot,
  executionContract: planOnly,
  generatedAt: "2026-05-31T01:00:02.000Z",
});
const blockedReferenceHandoff = buildDirectorAgentToolHandoff({
  action: blockedReferenceAction,
  userConfirmed: true,
  availability: allReady,
});
assert(blockedReferenceHandoff.status === "blocked", "blocked agent action must not become a ready tool handoff");
assert(blockedReferenceHandoff.blockers.includes("agent_action_blocked"), "handoff should cite blocked staged action");

const defaultVideoAction = buildDirectorAgentActionEnvelope({
  userIntent: "现在可以提交视频到即梦",
  snapshot,
  generatedAt: "2026-05-31T01:00:03.000Z",
});
const defaultVideoHandoff = buildDirectorAgentToolHandoff({
  action: defaultVideoAction,
  userConfirmed: true,
  availability: allReady,
});
assert(defaultVideoHandoff.status === "blocked", "default plan-only video submit must not become a ready handoff");
assert(defaultVideoHandoff.blockers.includes("agent_action_blocked"), "default blocked video should preserve the action blocker");

const videoAction = buildDirectorAgentActionEnvelope({
  userIntent: "现在可以提交视频到即梦",
  snapshot,
  executionContract: videoAllowed,
  generatedAt: "2026-05-31T01:00:03.100Z",
});
const videoNotReady = buildDirectorAgentToolHandoff({
  action: videoAction,
  userConfirmed: true,
  availability: { ...allReady, videoSubmitReady: false },
});
assert(videoNotReady.status === "blocked", "video submit should respect tool availability");
assert(videoNotReady.blockers.includes("video_submit_not_ready"), "video submit handoff should explain readiness blocker");
const videoReady = buildDirectorAgentToolHandoff({
  action: videoAction,
  userConfirmed: true,
  availability: allReady,
});
assert(videoReady.status === "ready", "confirmed video submit should become a ready handoff");
assert(videoReady.handler === "seedance_video_submit", "video action should route to Seedance submit");
assert(videoReady.invocation?.selectedShotIds[0] === "S01", "video handoff should carry selected shot ids into the invocation");
assert(videoReady.invocation?.confirmation.expectedReceipt === "video_submit_receipt", "video handoff should carry expected video receipt");
assert(videoReady.invocation?.taskEnvelope.providerSubmitAllowed === true, "video task envelope should preserve provider permission");
assert(videoReady.invocation?.taskEnvelope.expectedReceipt === "video_submit_receipt", "video task envelope should require a video receipt");
assert(videoReady.invocation?.taskEnvelope.preflight.projectWriteReceiptRequired === true, "video task envelope should require confirmed Project.vibe write before runtime submit");
assert(videoReady.invocation?.taskEnvelope.preflight.ruleQaRequired === true, "video task envelope should require rule QA before provider submit");
assert(videoReady.invocation?.taskEnvelope.preflight.textQaRequired === true, "video task envelope should require text QA before provider submit");
assert(videoReady.invocation?.taskEnvelope.preflight.noBgmGuardRequired === true, "video task envelope should require no-BGM guard before provider submit");
assert(videoReady.invocation?.taskEnvelope.preflight.providerSubmitAfterPreflightOnly === true, "video task envelope should only allow provider submit after preflight");
const videoTrace = buildDirectorAgentToolTrace(videoAction, videoReady);
assert(videoTrace.ok && videoTrace.trace?.preflight.textQaRequired === true, "video trace should preserve text QA preflight policy");

const researchAction = buildDirectorAgentActionEnvelope({
  userIntent: "先查资料，看看 90 年代日漫雨夜追逐怎么写",
  snapshot,
  executionContract: planOnly,
  generatedAt: "2026-05-31T01:00:04.000Z",
});
const researchHandoff = buildDirectorAgentToolHandoff({
  action: researchAction,
  userConfirmed: true,
  availability: allReady,
});
assert(researchHandoff.status === "ready", "web research should be callable under plan-only");
assert(researchHandoff.handler === "web_search", "research action should route to web search");
assert(researchHandoff.invocation?.confirmation.expectedReceipt === "web_research_reference_receipt", "research should expect research receipt");
assert(researchHandoff.invocation?.taskEnvelope.providerSubmitAllowed === false, "plan-only web research should not grant provider submit permission");

const patchAction = buildDirectorAgentActionEnvelope({
  userIntent: "这段改成故事板快切",
  snapshot,
  generatedAt: "2026-05-31T01:00:05.000Z",
});
const patchHandoff = buildDirectorAgentToolHandoff({
  action: patchAction,
  userConfirmed: true,
  availability: allReady,
});
assert(patchHandoff.status === "handled_by_project_write", "project patch action should be handled by Project.vibe writeback");
assert(!patchHandoff.invocation, "project patch should not expose an extra tool invocation");

const multiShotRuntime = {
  ...runtimeState,
  storyFlow: {
    shots: [
      {
        id: "A01_01",
        actId: "A01",
        title: "起步远景",
        storyFunction: "建立空间",
        status: "ready",
        gates: {},
        issues: [],
        durationSeconds: 4,
      },
      {
        id: "A01_02",
        actId: "A01",
        title: "灯光启动",
        storyFunction: "动作触发",
        status: "ready",
        gates: {},
        issues: [],
        durationSeconds: 4,
      },
      {
        id: "A01_03",
        actId: "A01",
        title: "雨水快切",
        storyFunction: "动作升级",
        status: "ready",
        gates: {},
        issues: [],
        durationSeconds: 4,
      },
    ],
  },
} as unknown as ProjectRuntimeState;

const explicitRangeSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: multiShotRuntime,
  selectedShotId: "A01_01",
  currentView: "story",
});
const explicitRangeAction = buildDirectorAgentActionEnvelope({
  userIntent: "把镜头 1-2 到 1-3 改成故事板快切",
  snapshot: explicitRangeSnapshot,
  generatedAt: "2026-05-31T01:00:05.500Z",
});
assert(explicitRangeAction.status === "staged", `explicit range action should stage: ${explicitRangeAction.blockers.join("; ")}`);
assert(explicitRangeAction.target.kind === "multi_shot", "explicitly mentioned shot range should override the currently selected shot");
assert(explicitRangeAction.target.ids.join(",") === "A01_02,A01_03", "explicit shot range should resolve to the named shots only");
assert(explicitRangeAction.proposedChanges[0]?.from === "多个镜头", "multi-shot strategy changes should explain the mixed prior state");
const explicitRangeHandoff = buildDirectorAgentToolHandoff({
  action: explicitRangeAction,
  userConfirmed: true,
  availability: allReady,
});
assert(explicitRangeHandoff.status === "handled_by_project_write", "multi-shot strategy change should be handled by Project.vibe writeback");

const exportAction = buildDirectorAgentActionEnvelope({
  userIntent: "导出素材包",
  snapshot,
  generatedAt: "2026-05-31T01:00:06.000Z",
});
const exportHandoff = buildDirectorAgentToolHandoff({
  action: exportAction,
  userConfirmed: true,
  availability: allReady,
});
assert(exportHandoff.status === "ready", "export action should become a ready handoff");
assert(exportHandoff.handler === "project_export", "export should route to project export");

console.log("director-agent-tool-handoff-test passed");
