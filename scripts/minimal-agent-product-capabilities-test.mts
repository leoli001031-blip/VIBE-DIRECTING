import assert from "node:assert/strict";
import {
  buildDirectorAgentActionEnvelope,
  buildDirectorAgentStateSnapshot,
} from "../src/core/directorAgentAction";
import type { ProjectRuntimeState } from "../src/core/projectState";
import {
  buildMinimalAgentProductAdapter,
  buildMinimalAgentExportProductCapability,
  buildMinimalAgentProductCapabilities,
  buildMinimalAgentReferenceProductCapability,
  buildMinimalAgentVideoProductCapability,
  runMinimalAgentConfirmedProductAction,
} from "../src/ui/director/agentProductCapabilities";
import type {
  AgentControlledToolInvocationTarget,
  AgentVideoSubmitContract,
} from "../src/ui/director/agentPanelProjection";
import type { AgentWebSearchSettings } from "../src/core/agentWebSearchClient";

function runtimeState(input: { referencesReady?: boolean } = {}): ProjectRuntimeState {
  const assets = input.referencesReady
    ? [
        {
          id: "asset_locked_scene",
          name: "已锁定场景参考",
          type: "scene",
          status: "ready",
          lockedStatus: "locked",
          usedByShotIds: ["shot_1"],
        },
      ]
    : [
        {
          id: "asset_missing_scene",
          name: "待补场景参考",
          type: "scene",
          status: "missing",
          lockedStatus: "not_generated",
          usedByShotIds: ["shot_1"],
        },
      ];
  return {
    project: {
      id: "minimal-agent-product-capabilities",
      title: "Minimal Agent Product Capabilities",
      root: "/tmp/minimal-agent-product-capabilities",
    },
    storyFlow: {
      title: "Minimal Agent Product Capabilities",
      sections: [],
      shots: [
        {
          id: "shot_1",
          title: "镜头 1",
          status: "draft",
          durationSeconds: 4,
          characterAssetIds: [],
          sceneAssetIds: [],
          propAssetIds: [],
          actionBeats: [],
          characterGuidance: [],
          sceneGuidance: [],
          propGuidance: [],
        },
      ],
    },
    visualMemory: {
      assets,
    },
  } as unknown as ProjectRuntimeState;
}

const videoPermissionContract: AgentVideoSubmitContract = {
  scope: "session",
  mode: "reference_allowed",
  videoSubmitAllowed: false,
  referenceGenerationAllowed: true,
  reason: "测试允许参考生成，但不允许视频提交。",
};

const webSearchSettings: AgentWebSearchSettings = {
  enabled: false,
  provider: "mock",
  endpoint: "",
  maxResults: 3,
  allowNetwork: false,
};

const minimalCapabilities = buildMinimalAgentProductCapabilities({
  videoPermissionContract,
  webSearchSettings,
  setStatus: () => undefined,
  setAgentToolHandoff: () => undefined,
  setResearchStatus: () => undefined,
  setReferenceStatus: () => undefined,
  setResearchResult: () => undefined,
  createReferences: () => ({ status: "needs_review" }),
  submitVideo: () => ({ status: "submitted" }),
  queryVideo: () => ({ status: "needs_review" }),
  runExport: () => ({ status: "ready" }),
});
assert.equal(typeof minimalCapabilities.createReferences, "function");
assert.equal(typeof minimalCapabilities.submitVideo, "function");
assert.equal(typeof minimalCapabilities.queryVideo, "function");
assert.equal(typeof minimalCapabilities.runExport, "function");
assert.equal(typeof minimalCapabilities.buildResearchQuery, "function");

const referenceCapability = buildMinimalAgentReferenceProductCapability({
  createReferences: () => ({ status: "needs_review", message: "reference capability ok" }),
});
assert.equal(typeof referenceCapability?.createReferences, "function");
const videoCapability = buildMinimalAgentVideoProductCapability({
  submitVideo: () => ({ status: "submitted", message: "video submit capability ok" }),
  queryVideo: () => ({ status: "needs_review", message: "video query capability ok" }),
});
assert.equal(typeof videoCapability?.submitVideo, "function");
assert.equal(typeof videoCapability?.queryVideo, "function");
const exportCapability = buildMinimalAgentExportProductCapability({
  runExport: () => ({ status: "ready", message: "export capability ok" }),
});
assert.equal(typeof exportCapability?.runExport, "function");

const snapshot = buildDirectorAgentStateSnapshot({
  runtimeState: runtimeState(),
  currentView: "story",
  selectedShotId: "shot_1",
});
const readySnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: runtimeState({ referencesReady: true }),
  currentView: "story",
  selectedShotId: "shot_1",
});
const action = buildDirectorAgentActionEnvelope({
  userIntent: "继续",
  snapshot,
  executionContract: {
    mode: "reference_allowed",
    referenceGenerationAllowed: true,
    providerSubmitAllowed: true,
  },
  generatedAt: "2026-06-17T09:10:00.000Z",
});

assert.equal(action.kind, "prepare_reference_generation");
assert.equal(action.toolPlan.toolName, "image2_reference_generation");
assert.equal(action.toolPlan.providerSubmitAllowed, true);

const statusLog: string[] = [];
const handoffLog: string[] = [];
const referenceTargets: AgentControlledToolInvocationTarget[] = [];
const outcome = await runMinimalAgentConfirmedProductAction({
  action,
  userIntent: "继续",
  availability: {
    projectReady: true,
    webSearchReady: false,
    referenceGenerationReady: true,
    videoSubmitReady: false,
    exportReady: false,
  },
  videoPermissionContract,
  webSearchSettings,
  setStatus: (status) => statusLog.push(status),
  setAgentToolHandoff: (handoff) => handoffLog.push(handoff.handoffId),
  setResearchStatus: () => undefined,
  setReferenceStatus: () => undefined,
  setResearchResult: () => undefined,
  createReferences: (target) => {
    if (target) referenceTargets.push(target);
    return { status: "needs_review", message: "参考生成已进入复核" };
  },
});

assert.equal(outcome.status, "completed");
assert.equal(outcome.label, "参考生成中，等待结果回到参考页。");
assert.equal(referenceTargets.length, 1);
assert.equal(referenceTargets[0]?.skipConfirm, true);
assert.equal(referenceTargets[0]?.confirmationReceiptId, handoffLog[0]);
assert.equal(referenceTargets[0]?.agentToolTrace?.actionId, action.actionId);
assert.equal(referenceTargets[0]?.agentToolTrace?.handler, "image2_reference_generation");
assert.equal(referenceTargets[0]?.agentToolTrace?.expectedReceipt, "image_reference_receipt");
assert.deepEqual(referenceTargets[0]?.selectedShotIds, ["shot_1"]);
assert.deepEqual(referenceTargets[0]?.assetTypes, ["scene"]);
assert.equal(statusLog.includes("参考生成中，等待结果回到参考页。"), true);

const returnedReferenceStatusLog: string[] = [];
const returnedReferenceOutcome = await runMinimalAgentConfirmedProductAction({
  action,
  userIntent: "继续",
  availability: {
    projectReady: true,
    webSearchReady: false,
    referenceGenerationReady: true,
    videoSubmitReady: false,
    exportReady: false,
  },
  videoPermissionContract,
  webSearchSettings,
  setStatus: (status) => returnedReferenceStatusLog.push(status),
  setAgentToolHandoff: () => undefined,
  setResearchStatus: () => undefined,
  setReferenceStatus: () => undefined,
  setResearchResult: () => undefined,
  createReferences: () => ({
    status: "needs_review",
    message: "参考生成已进入复核",
    outputPath: "references/shot_1_scene.png",
  }),
});

assert.equal(returnedReferenceOutcome.status, "completed");
assert.equal(returnedReferenceOutcome.label, "参考生成已进入复核");
assert.equal(returnedReferenceOutcome.waitingReview, true);
assert.equal(returnedReferenceOutcome.resultStatus, "ready");
assert.equal(returnedReferenceStatusLog.includes("参考生成已进入复核"), true);

const adapterStatusLog: string[] = [];
const adapterReferenceTargets: AgentControlledToolInvocationTarget[] = [];
const minimalProductAdapter = buildMinimalAgentProductAdapter({
  availability: {
    projectReady: true,
    webSearchReady: false,
    referenceGenerationReady: true,
    videoSubmitReady: false,
    exportReady: false,
  },
  videoPermissionContract,
  webSearchSettings,
  setStatus: (status) => adapterStatusLog.push(status),
  setAgentToolHandoff: () => undefined,
  setResearchStatus: () => undefined,
  setReferenceStatus: () => undefined,
  setResearchResult: () => undefined,
  createReferences: (target) => {
    if (target) adapterReferenceTargets.push(target);
    return { status: "needs_review", message: "adapter reference ok", outputPath: "references/adapter-scene.png" };
  },
});
const adapterOutcome = await minimalProductAdapter.runConfirmedAction({
  action,
  userIntent: "继续",
});
assert.equal(adapterOutcome.status, "completed");
assert.equal(adapterOutcome.label, "adapter reference ok");
assert.equal(adapterReferenceTargets.length, 1);
assert.equal(adapterReferenceTargets[0]?.agentToolTrace?.actionId, action.actionId);
assert.equal(adapterStatusLog.includes("adapter reference ok"), true);

let blockedReferenceCalls = 0;
const blockedStatusLog: string[] = [];
const blockedOutcome = await runMinimalAgentConfirmedProductAction({
  action,
  userIntent: "继续",
  availability: {
    projectReady: true,
    webSearchReady: false,
    referenceGenerationReady: false,
    videoSubmitReady: false,
    exportReady: false,
  },
  videoPermissionContract,
  webSearchSettings,
  setStatus: (status) => blockedStatusLog.push(status),
  setAgentToolHandoff: () => undefined,
  setResearchStatus: () => undefined,
  setReferenceStatus: () => undefined,
  setResearchResult: () => undefined,
  createReferences: () => {
    blockedReferenceCalls += 1;
    return { status: "needs_review", message: "不应该执行" };
  },
});

assert.equal(blockedOutcome.status, "blocked");
assert.equal(blockedReferenceCalls, 0);
assert.equal(blockedStatusLog.some((status) => status.includes("参考生成还不可用")), true);

const videoAction = buildDirectorAgentActionEnvelope({
  userIntent: "提交视频",
  snapshot: readySnapshot,
  executionContract: {
    mode: "video_allowed",
    referenceGenerationAllowed: true,
    videoSubmitAllowed: true,
    providerSubmitAllowed: true,
  },
  generatedAt: "2026-06-17T09:11:00.000Z",
});
assert.equal(videoAction.kind, "prepare_video_submit");
const videoTargets: AgentControlledToolInvocationTarget[] = [];
const videoOutcome = await runMinimalAgentConfirmedProductAction({
  action: videoAction,
  userIntent: "提交视频",
  availability: {
    projectReady: true,
    webSearchReady: false,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: false,
  },
  videoPermissionContract: {
    ...videoPermissionContract,
    mode: "video_allowed",
    videoSubmitAllowed: true,
    reason: "测试允许提交视频。",
  },
  webSearchSettings,
  setStatus: () => undefined,
  setAgentToolHandoff: () => undefined,
  setResearchStatus: () => undefined,
  setReferenceStatus: () => undefined,
  setResearchResult: () => undefined,
  submitVideo: (target) => {
    if (target) videoTargets.push(target);
    return { status: "submitted", message: "视频已发送，即梦排队中" };
  },
});
assert.equal(videoOutcome.status, "completed");
assert.equal(videoOutcome.resultStatus, "running");
assert.equal(videoTargets.length, 1);
assert.equal(videoTargets[0]?.videoPermissionContract?.mode, "video_allowed");
assert.equal(videoTargets[0]?.agentToolTrace?.handler, "seedance_video_submit");

const querySnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: runtimeState({ referencesReady: true }),
  currentView: "preview",
  selectedShotId: "shot_1",
  videoStatus: "submitted",
  videoCanResume: true,
  videoWaitingCount: 1,
  videoDetail: "Seedance 已提交，可以查询结果。",
});
const queryAction = buildDirectorAgentActionEnvelope({
  userIntent: "继续",
  snapshot: querySnapshot,
  executionContract: {
    mode: "project_write_allowed",
    referenceGenerationAllowed: false,
    videoSubmitAllowed: false,
    providerSubmitAllowed: false,
  },
  generatedAt: "2026-06-17T09:12:00.000Z",
});
assert.equal(queryAction.kind, "query_video_result");
let submitCallsDuringQuery = 0;
let queryCalls = 0;
const queryOutcome = await runMinimalAgentConfirmedProductAction({
  action: queryAction,
  userIntent: "继续",
  availability: {
    projectReady: true,
    webSearchReady: false,
    referenceGenerationReady: true,
    videoSubmitReady: true,
    exportReady: false,
  },
  videoPermissionContract,
  webSearchSettings,
  setStatus: () => undefined,
  setAgentToolHandoff: () => undefined,
  setResearchStatus: () => undefined,
  setReferenceStatus: () => undefined,
  setResearchResult: () => undefined,
  submitVideo: () => {
    submitCallsDuringQuery += 1;
    return { status: "submitted", message: "不应该提交新任务" };
  },
  queryVideo: () => {
    queryCalls += 1;
    return { status: "needs_review", message: "视频结果已回到预览" };
  },
});
assert.equal(queryOutcome.status, "completed");
assert.equal(queryOutcome.previewReady, true);
assert.equal(queryCalls, 1);
assert.equal(submitCallsDuringQuery, 0);

const exportAction = buildDirectorAgentActionEnvelope({
  userIntent: "导出素材包",
  snapshot: readySnapshot,
  executionContract: {
    mode: "project_write_allowed",
    referenceGenerationAllowed: false,
    videoSubmitAllowed: false,
    providerSubmitAllowed: false,
  },
  generatedAt: "2026-06-17T09:13:00.000Z",
});
assert.equal(exportAction.kind, "prepare_export");
let exportTraceActionId = "";
const exportOutcome = await runMinimalAgentConfirmedProductAction({
  action: exportAction,
  userIntent: "导出素材包",
  availability: {
    projectReady: true,
    webSearchReady: false,
    referenceGenerationReady: true,
    videoSubmitReady: false,
    exportReady: true,
  },
  videoPermissionContract,
  webSearchSettings,
  setStatus: () => undefined,
  setAgentToolHandoff: () => undefined,
  setResearchStatus: () => undefined,
  setReferenceStatus: () => undefined,
  setResearchResult: () => undefined,
  runExport: (target) => {
    exportTraceActionId = target?.agentToolTrace?.actionId || "";
    return { status: "ready", message: "导出包已生成" };
  },
});
assert.equal(exportOutcome.status, "completed");
assert.equal(exportOutcome.resultStatus, "ready");
assert.equal(exportTraceActionId, exportAction.actionId);

console.log("minimal-agent-product-capabilities:test passed");
