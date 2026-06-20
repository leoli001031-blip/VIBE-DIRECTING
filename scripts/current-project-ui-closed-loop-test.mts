import fs from "node:fs";
import {
  currentProjectBindingIdentity,
  deriveCurrentProjectChoices,
  deriveCurrentProjectBindingStatus,
  deriveProjectRealChainStatus,
  guardProjectRealChainUiStateForCurrentProject,
  loadCurrentProjectBindingStatus,
  loadCurrentProjectChoices,
  loadProjectRealChainStatus,
  projectCurrentBindingEndpoint,
  projectCurrentChoicesEndpoint,
  projectCurrentSelectEndpoint,
  projectRuntimeRequestPath,
  projectRealChainRunCheckEndpoint,
  projectRealChainStatusEndpoint,
  projectRound5StrictEditReturnEndpoint,
  runProjectRealChainCheck,
  selectCurrentProjectBinding,
} from "../src/core/projectCurrentRuntimeClient.ts";
import {
  confirmProjectImage2OneShot,
  deriveProjectImage2BatchPlanStatus,
  deriveProjectImage2OneShotStatus,
  executeReturnedProjectImage2OneShot,
  guardProjectImage2BatchUiStateForCurrentProject,
  guardProjectImage2OneShotUiStateForCurrentProject,
  loadProjectImage2BatchPlan,
  loadProjectImage2OneShotStatus,
  prepareProjectImage2OneShot,
  prepareProjectImage2OneShotPermissionReceipt,
  prepareProjectImage2OneShotTrigger,
  projectImage2BatchPlanEndpoint,
  projectImage2BatchRunCheckEndpoint,
  projectImage2OneShotStatusEndpoint,
  projectImage2OneShotPrepareEndpoint,
  projectImage2OneShotConfirmEndpoint,
  projectImage2OneShotPrepareTriggerEndpoint,
  projectImage2OneShotExecuteReturnEndpoint,
  runProjectImage2BatchCheck,
} from "../src/core/projectImage2Client.ts";
import {
  applyCurrentProjectWorkbenchProjectionToRuntimeState,
  buildCurrentProjectWorkbenchProjection,
  currentProjectWorkbenchProjectionSource,
} from "../src/core/currentProjectWorkbenchProjection.ts";
import {
  buildCurrentProjectPreviewProjection,
} from "../src/core/currentProjectPreviewProjection.ts";
import { createAssetLibraryFromCurrentProjectWorkbench } from "../src/ui/app/projectRuntimeProjections.ts";
import { buildProjectStatusViewModel } from "../src/ui/app/projectStatusViewModel.ts";
import { assetLibraryAssetToRecord } from "../src/ui/director/assetLibraryUi.ts";
import { toMediaSrc } from "../src/ui/common/MediaFrame.tsx";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertUnifiedProjectStatusVideoStage() {
  const runtimeState = {
    project: { root: "/tmp/vibe-demo", title: "Demo" },
    storyFlow: { shots: [{ id: "shot_1" }, { id: "shot_2" }] },
    visualMemory: {
      summary: { locked: 3, needsReview: 0, missing: 0 },
      assets: [
        { id: "voice_asset_1", roleBinding: { role: "voice_reference", useFor: ["shot_1"], ignoreFor: [] } },
      ],
    },
    audioPlanning: {
      shotPlans: [
        { narrationText: "", dialogueLines: ["我们走吧。"] },
        { narrationText: "", dialogueLines: [] },
      ],
      voiceSourceRegistry: {
        sources: [
          { id: "voice_1", label: "少女声音参考", kind: "voice_library", status: "planned", notes: [] },
        ],
      },
    },
  };
  const status = buildProjectStatusViewModel({
    runtimeState,
    folderReady: true,
    projectReady: true,
    directorView: "story",
    videoStage: {
      status: "in_progress",
      canResume: false,
      reviewCount: 0,
      generation: {
        statusLabel: "排队中",
        detail: "视频正在处理，可以稍后查询结果。",
        queueSummary: "第 1/2 段「霓虹启动」排队中 · 1 段待发送",
        completedCount: 0,
        failedCount: 0,
        canResume: false,
        taskFacts: [
          { label: "当前段", value: "霓虹启动" },
          { label: "排队", value: "前面约 5378 个任务" },
          { label: "查询", value: "已查询 1 次" },
          { label: "提交号", value: "adde7eb0" },
          { label: "下一步", value: "等待结果，稍后查询" },
        ],
      },
    },
    agentStage: {
      summary: "Agent 正在按串行队列推进",
      detail: "第一段完成后再发送第二段",
    },
    agentCommand: {
      label: "查询视频结果",
      summary: "继续查询",
      detail: "不会重复发送",
    },
  });
  assert(status.stage === "视频生成中", "unified project status should prioritize active video stage");
  assert(status.doing.includes("第 1/2 段"), "unified project status should show serial queue progress");
  assert(status.facts.some((fact) => fact.label === "视频" && fact.value.includes("1 段待发送")), "project facts should include the video queue summary");
  assert(status.facts.some((fact) => fact.label === "当前段" && fact.value === "霓虹启动"), "project facts should include the active video segment");
  assert(status.facts.some((fact) => fact.label === "排队" && fact.value.includes("5378")), "project facts should include provider queue position");
  assert(status.facts.some((fact) => fact.label === "查询" && fact.value.includes("1 次")), "project facts should include query progress for long queued video jobs");
  assert(status.facts.some((fact) => fact.label === "提交号" && fact.value === "adde7eb0"), "project facts should include the video submit id");
  assert(!status.facts.some((fact) => fact.label === "下一步" && fact.value.includes("查询")), "project facts should not duplicate active video next-step guidance");
  assert(status.facts.some((fact) => fact.label === "声音" && fact.value.includes("声音参考")), "project facts should include voice reference status");
  assert(!status.facts.some((fact) => fact.label === "AI 导演" && fact.value === "查询视频结果"), "active video facts should not duplicate the bottom query action");

  const cancelledSubmitStatus = buildProjectStatusViewModel({
    runtimeState,
    folderReady: true,
    projectReady: true,
    directorView: "story",
    videoSendAction: {
      status: "idle",
      message: "已取消，本次没有发送；需要时可以重新确认。",
    },
  });
  assert(cancelledSubmitStatus.stage !== "视频待处理", "cancelled video confirmation must not become a video problem state");
  assert(!cancelledSubmitStatus.waitingFor.includes("补参考"), "cancelled video confirmation must not ask users to fix references");
  assert(!cancelledSubmitStatus.nextAction.includes("补参考"), "cancelled video confirmation must remain retryable instead of routing to reference recovery");

  const legacyBlockedCancelledSubmitStatus = buildProjectStatusViewModel({
    runtimeState,
    folderReady: true,
    projectReady: true,
    directorView: "story",
    videoSendAction: {
      status: "blocked",
      message: "已取消，本次没有发送。",
    },
  });
  assert(legacyBlockedCancelledSubmitStatus.stage !== "视频待处理", "legacy cancelled video confirmation records must not reopen a blocked video lane");
  assert(!legacyBlockedCancelledSubmitStatus.waitingFor.includes("补参考"), "legacy cancelled video confirmations must not ask users to fix references");

  const failedStatus = buildProjectStatusViewModel({
    runtimeState,
    folderReady: true,
    projectReady: true,
    directorView: "preview",
    videoStage: {
      status: "failed",
      canResume: false,
      reviewCount: 0,
      generation: {
        statusLabel: "有失败",
        detail: "1 段视频生成失败。",
        completedCount: 0,
        failedCount: 1,
        canResume: false,
        taskFacts: [
          { label: "当前段", value: "失败段" },
          { label: "失败原因", value: "生成失败，可重试" },
          { label: "下一步", value: "看失败原因后重试或跳过" },
        ],
      },
    },
  });
  assert(failedStatus.stage === "视频待处理", "failed video task facts should still drive the top status");
  assert(failedStatus.facts.some((fact) => fact.label === "失败原因" && fact.value.includes("生成失败")), "failed video status should expose the failure reason in top facts");
  assert(failedStatus.nextAction.includes("检查即梦登录"), "plain provider failures should guide users to fix provider/login state instead of adding references");
  assert(!failedStatus.nextAction.includes("补参考"), "plain provider failures must not be misclassified as reference QA blockers");

  const qaBlockedStatus = buildProjectStatusViewModel({
    runtimeState,
    folderReady: true,
    projectReady: true,
    directorView: "preview",
    videoStage: {
      status: "failed",
      canResume: false,
      reviewCount: 0,
      generation: {
        statusLabel: "待处理",
        detail: "场景参考只能生成站台区域，但镜头要求从深夜街道开始奔跑并带出站台，参考无法覆盖完整行动范围。",
        completedCount: 1,
        failedCount: 1,
        canResume: false,
        taskFacts: [
          { label: "当前段", value: "追逐蓝光奔向列车" },
          { label: "原因", value: "场景参考无法覆盖深夜街道到站台入口。" },
          { label: "建议", value: "可以在右侧输入框说：只补参考，补一张覆盖完整行动范围的场景/天气参考，先不要提交视频；也可以让 AI 把这一段改到现有场景内。" },
          { label: "下一步", value: "先补参考或改这一段，再提交" },
        ],
      },
    },
  });
  assert(qaBlockedStatus.stage === "视频待处理", "QA-blocked video should stay in a recoverable top status");
  assert(qaBlockedStatus.nextAction.includes("覆盖完整行动范围"), "QA-blocked video should expose concrete recovery advice as the next action");
  assert(!qaBlockedStatus.nextAction.includes("道具外观"), "scene blockers should not be misclassified as prop blockers just because the text contains 车站");
  assert(qaBlockedStatus.facts.some((fact) => fact.label === "建议" && fact.value.includes("场景/天气参考")), "QA-blocked video facts should include creator-facing recovery advice");

  const returnedStatus = buildProjectStatusViewModel({
    runtimeState,
    folderReady: true,
    projectReady: true,
    directorView: "preview",
    videoStage: {
      status: "needs_review",
      canResume: false,
      reviewCount: 1,
      generation: {
        statusLabel: "已完成",
        detail: "视频结果已出。",
        completedCount: 1,
        failedCount: 0,
        canResume: false,
        taskFacts: [
          { label: "当前段", value: "第一段" },
          { label: "输出", value: "video/first.mp4" },
          { label: "下一步", value: "去预览复核，确认后导出" },
        ],
      },
    },
  });
  assert(returnedStatus.stage === "视频待确认", "returned videos should route top status to review");
  assert(returnedStatus.facts.some((fact) => fact.label === "输出" && fact.value.includes("video/first.mp4")), "returned video status should expose output path evidence in top facts");

  const exportReadyStatus = buildProjectStatusViewModel({
    runtimeState,
    folderReady: true,
    projectReady: true,
    directorView: "export",
    videoStage: {
      status: "completed",
      canResume: false,
      reviewCount: 0,
      generation: {
        statusLabel: "3 段已完成",
        detail: "视频结果可预览。",
        completedCount: 3,
        failedCount: 0,
        canResume: false,
      },
    },
    exportWorker: {
      readiness: "planned",
      blockers: [],
      manifest: {
        files: [{ path: "exports/current-project/report.md" }],
        mvpPackage: { reportIncluded: true },
      },
    },
  });
  assert(exportReadyStatus.stage === "可以导出", "export view should prioritize delivery readiness over already-completed video status");
  assert(exportReadyStatus.nextAction.includes("交付页"), "export-ready status should keep creators on the delivery page");

  const recoverableStatus = buildProjectStatusViewModel({
    runtimeState,
    folderReady: true,
    projectReady: true,
    directorView: "story",
    videoStage: {
      status: "recoverable",
      canResume: true,
      reviewCount: 0,
    },
  });
  const videoFact = recoverableStatus.facts.find((fact) => fact.label === "视频")?.value || "";
  assert(videoFact === "可查询结果", "project status facts should translate recoverable video state into creator-facing copy");
  assert(!/recoverable|not_submitted|complete/.test(videoFact), "project status facts must not expose raw video queue enums");

  const resumableActionStatus = buildProjectStatusViewModel({
    runtimeState,
    folderReady: true,
    projectReady: true,
    directorView: "story",
    videoSendAction: {
      status: "submitted",
      canResume: true,
      suggestedActionLabel: "查询视频结果",
    },
    agentCommand: {
      label: "查询视频结果",
    },
  });
  assert(!resumableActionStatus.facts.some((fact) => fact.label === "AI 导演" && fact.value.includes("查询")), "resumable video action should not duplicate query guidance in top facts");

  const browserDraftPlanningStatus = buildProjectStatusViewModel({
    runtimeState,
    folderReady: false,
    projectReady: false,
    directorView: "story",
    newVideoStatus: {
      status: "planning",
      title: "AI 正在拆镜头",
      detail: "正在整理故事、节奏和镜头，不会生成。",
      nextAction: "等草案出来后复核",
    },
  });
  assert(browserDraftPlanningStatus.stage === "正在拆镜头", "fresh browser draft status should show active AI planning");
  assert(browserDraftPlanningStatus.nextAction === "等草案出来后复核", "fresh browser draft status should explain the next review step");
  assert(browserDraftPlanningStatus.facts.find((fact) => fact.label === "项目")?.value === "正在整理", "fresh planning status should not keep saying to write an idea after send");
  assert(browserDraftPlanningStatus.facts.find((fact) => fact.label === "AI 导演")?.value === "正在拆镜头", "fresh planning status should not keep stale send-input action copy");
  assert(!browserDraftPlanningStatus.doing.includes("还没有连接"), "active browser draft status must not keep the empty-project copy");

  const browserDraftReadyStatus = buildProjectStatusViewModel({
    runtimeState,
    folderReady: false,
    projectReady: false,
    directorView: "story",
    newVideoStatus: {
      status: "ready",
      title: "草案待确认",
      detail: "AI 已经拆出故事和镜头，确认前不会写入项目。",
      nextAction: "确认进故事流，或直接说修改意见",
      draftShotCount: 3,
      draftReferenceCount: 2,
    },
  });
  assert(browserDraftReadyStatus.facts.find((fact) => fact.label === "项目")?.value === "草案待确认", "fresh ready draft status should keep project facts aligned with confirmation");
  assert(browserDraftReadyStatus.facts.find((fact) => fact.label === "镜头")?.value === "草案 3 个", "fresh ready draft status should show draft shot count instead of empty project count");
  assert(browserDraftReadyStatus.facts.find((fact) => fact.label === "参考")?.value === "已放入 2 个", "fresh ready draft status should show dropped draft reference count");
  assert(browserDraftReadyStatus.facts.find((fact) => fact.label === "AI 导演")?.value === "确认草案", "fresh ready draft status should tell users to confirm the draft");

  const browserDraftConfirmedStatus = buildProjectStatusViewModel({
    runtimeState: {
      ...runtimeState,
      visualMemory: {
        ...runtimeState.visualMemory,
        summary: { locked: 0, needsReview: 1, missing: 3 },
      },
    },
    folderReady: false,
    projectReady: true,
    directorView: "story",
    referenceGenerationAction: {
      status: "ready",
      message: "准备先生成角色、场景、关键道具或故事板参考。",
    },
    agentCommand: {
      label: "生成参考",
      summary: "补画面",
      detail: "准备生成参考",
    },
  });
  assert(browserDraftConfirmedStatus.stage === "需要本地项目", "confirmed browser draft should ask for a local project before reference work");
  assert(browserDraftConfirmedStatus.nextAction === "点左上角项目，选择本地文件夹", "confirmed browser draft should point to the project entry");
  assert(!browserDraftConfirmedStatus.nextAction.includes("参考页"), "confirmed browser draft must not route users to reference review before a local project exists");
  assert(browserDraftConfirmedStatus.facts.find((fact) => fact.label === "项目")?.value === "临时项目", "confirmed browser draft facts should show the temporary project state instead of asking for another idea");
  assert(browserDraftConfirmedStatus.facts.find((fact) => fact.label === "AI 导演")?.value === "先保存项目", "browser draft facts should not show a blocked generate/submit command as the AI director action");

  const localProjectMissingReferenceStatus = buildProjectStatusViewModel({
    runtimeState: {
      ...runtimeState,
      visualMemory: {
        ...runtimeState.visualMemory,
        summary: { locked: 1, needsReview: 0, missing: 3 },
      },
    },
    folderReady: true,
    projectReady: true,
    directorView: "story",
    referenceGenerationAction: {
      status: "ready",
      message: "准备先生成角色、场景、关键道具或故事板参考。",
    },
    agentCommand: {
      label: "生成参考",
      summary: "补画面",
      detail: "准备生成参考",
    },
  });
  assert(localProjectMissingReferenceStatus.stage === "参考待生成", "local projects with missing references should prioritize generating references when generation is ready");
  assert(localProjectMissingReferenceStatus.doing === "还缺 3 张画面参考", "missing reference state should explain the creative reference gap");
  assert(localProjectMissingReferenceStatus.nextAction === "生成参考", "local project next action should generate references before routing to review");

  const frameGapMustOverrideLockedReferenceStatus = buildProjectStatusViewModel({
    runtimeState: {
      ...runtimeState,
      visualMemory: {
        ...runtimeState.visualMemory,
        summary: { locked: 1, needsReview: 0, missing: 0 },
      },
    },
    folderReady: true,
    projectReady: true,
    directorView: "story",
    framePlan: { missingCount: 3 },
    referenceGenerationAction: {
      status: "ready",
      message: "准备先生成角色、场景、关键道具或故事板参考。",
    },
    agentCommand: {
      label: "生成参考",
      summary: "补画面",
      detail: "准备生成参考",
    },
    agentTimelineStatus: {
      stage: "AI 导演",
      doing: "旧消息里说参考可看。",
      waitingFor: "你的下一句指令",
      nextAction: "去参考页确认可用素材",
      tone: "ready",
      facts: [{ label: "参考", value: "已可用" }],
    },
  });
  assert(frameGapMustOverrideLockedReferenceStatus.stage === "参考待生成", "frame/storyboard gaps must override optimistic locked-reference status");
  assert(frameGapMustOverrideLockedReferenceStatus.facts.find((fact) => fact.label === "参考")?.value !== "已可用", "missing frame references must not show reference facts as usable");
  assert(frameGapMustOverrideLockedReferenceStatus.nextAction === "生成参考", "missing frame references must not route users to review usable assets");

  const planOnlyMissingReferenceStatus = buildProjectStatusViewModel({
    runtimeState: {
      ...runtimeState,
      visualMemory: {
        ...runtimeState.visualMemory,
        summary: { locked: 0, needsReview: 0, missing: 3 },
      },
    },
    folderReady: true,
    projectReady: true,
    directorView: "story",
    referenceGenerationAction: {
      status: "ready",
      message: "准备先生成角色、场景、关键道具或故事板参考。",
    },
    agentCommand: {
      kind: "generate_references",
      label: "确认生成参考",
      summary: "参考还缺，确认后再生成。",
      detail: "当前执行方式是只出计划。",
    },
  });
  assert(planOnlyMissingReferenceStatus.waitingFor === "等待你确认生成参考", "plan-only missing references should ask for confirmation instead of implying generation is already the next step");
  assert(planOnlyMissingReferenceStatus.nextAction === "确认生成参考", "plan-only missing references should expose confirmation wording as the next action");

  const localProjectRunningReferenceStatus = buildProjectStatusViewModel({
    runtimeState: {
      ...runtimeState,
      visualMemory: {
        ...runtimeState.visualMemory,
        summary: { locked: 1, needsReview: 1, missing: 2 },
      },
    },
    folderReady: true,
    projectReady: true,
    directorView: "story",
    referenceGenerationAction: {
      status: "running",
      message: "参考正在生成。",
    },
    referenceBatch: {
      plannedCount: 4,
      readyCount: 1,
      missingCount: 2,
      retryCount: 1,
    },
  });
  assert(localProjectRunningReferenceStatus.stage === "参考生成中", "running reference generation should drive the top status");
  assert(localProjectRunningReferenceStatus.doing.includes("1/4 张可看"), "running reference generation should expose returned/planned progress");
  assert(localProjectRunningReferenceStatus.doing.includes("2 张缺少"), "running reference generation should expose missing reference progress");
  assert(localProjectRunningReferenceStatus.facts.some((fact) => fact.label === "参考" && fact.value.includes("生成中") && fact.value.includes("1/4 张可看")), "project facts should carry reference generation progress");

  const localProjectMixedReferenceStatus = buildProjectStatusViewModel({
    runtimeState: {
      ...runtimeState,
      visualMemory: {
        ...runtimeState.visualMemory,
        summary: { locked: 1, needsReview: 1, missing: 3 },
      },
    },
    folderReady: true,
    projectReady: true,
    directorView: "story",
    referenceGenerationAction: {
      status: "ready",
      message: "准备先生成角色、场景、关键道具或故事板参考。",
    },
    agentCommand: {
      label: "生成参考",
      summary: "补画面",
      detail: "准备生成参考",
    },
  });
  assert(localProjectMixedReferenceStatus.stage === "参考待看，也有待生成", "local projects should not call mixed review and missing references only review");
  assert(localProjectMixedReferenceStatus.waitingFor === "先复核，再补缺口", "mixed reference state should explain the order clearly");
}

function readText(path) {
  return fs.readFileSync(path, "utf8");
}

function findFunctionBody(source, functionName) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  assert(start >= 0, `${functionName} is missing`);
  const paramsOpen = source.indexOf("(", start);
  assert(paramsOpen >= 0, `${functionName} has no params`);
  let paramDepth = 0;
  let paramsClose = -1;
  for (let index = paramsOpen; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") paramDepth += 1;
    if (char === ")") paramDepth -= 1;
    if (paramDepth === 0) {
      paramsClose = index;
      break;
    }
  }
  const open = source.indexOf("{", paramsClose);
  assert(open >= 0, `${functionName} has no body`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`${functionName} body was not closed`);
}
function assertProductCopy(message) {
  assert(/未选择项目|未同步/.test(message || ""), "unbound/mismatch copy should be product-facing");
  assert(!/005|fallback|endpoint|provider|ledger|prompt|queue/i.test(message || ""), "unbound/mismatch copy must not expose engineering/demo details");
}

function extractStringLiterals(source) {
  return Array.from(source.matchAll(/(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g))
    .map((match) => match[2])
    .join("\n");
}

function assertCreatorPanelContract() {
  const appSource = readText("src/App.tsx");
  const currentProjectRuntimeHookSource = readText("src/ui/app/useCurrentProjectRuntimePanels.ts");
  const minimalTopNavSource = readText("src/ui/director/MinimalTopNav.tsx");
  const directorModeSource = readText("src/ui/director/DirectorModeShell.tsx");
  const projectStatusViewModelSource = readText("src/ui/app/projectStatusViewModel.ts");
  const creatorDeskPanelsSource = readText("src/ui/director/CreatorDeskPanels.tsx");
  const creatorDeskProjectionSource = readText("src/ui/app/creatorDeskProjection.ts");
  const workbenchProjectionSource = readText("src/core/currentProjectWorkbenchProjection.ts");
  const minimalStoryFlowSource = readText("src/ui/director/MinimalStoryFlow.tsx");
  const agentPanelSource = readText("src/ui/director/MinimalAgentPanel.tsx");
  const agentPanelProjectionSource = readText("src/ui/director/agentPanelProjection.ts");
  const p6RealImage2ActionSource = readText("src/ui/director/useP6RealImage2Action.ts");
  const image2AssetGenerationActionSource = readText("src/ui/director/useImage2AssetGenerationAction.ts");
  const projectImage2ActionsSource = readText("src/core/projectImage2Actions.ts");
  const currentProjectBindingClientSource = readText("src/core/projectCurrentBindingClient.ts");
  const viteConfigSource = readText("vite.config.ts");
  const projectAgentTimelineSource = readText("src/project/projectAgentTimeline.ts");
  const localRuntimeApiServerSource = readText("scripts/local-runtime-api-server.mts");
  const projectRealChainPanelSource = readText("src/ui/project/ProjectRealChainPanel.tsx");
  const agentPanelContractSource = `${agentPanelSource}\n${agentPanelProjectionSource}`;
  const stylesSource = `${readText("src/styles.css")}\n${readText("src/ui/project/ProjectRealChainPanel.css")}`;
  const app = findFunctionBody(appSource, "App");
  const currentProjectRuntimeSurface = `${app}\n${currentProjectRuntimeHookSource}`;
  const panel = findFunctionBody(projectRealChainPanelSource, "ProjectRealChainPanel");
  const surface = [
    panel,
    findFunctionBody(projectRealChainPanelSource, "projectRealChainStatusLabel"),
    findFunctionBody(projectRealChainPanelSource, "projectReviewCheckStatusLabel"),
    findFunctionBody(projectRealChainPanelSource, "projectReviewCheckDetail"),
    findFunctionBody(projectRealChainPanelSource, "projectPreviewReadyLabel"),
    findFunctionBody(projectRealChainPanelSource, "projectProductionReviewLabel"),
    findFunctionBody(projectRealChainPanelSource, "projectOneShotStatusLabel"),
    findFunctionBody(projectRealChainPanelSource, "projectOneShotProgress"),
    findFunctionBody(projectRealChainPanelSource, "projectOneShotEvidence"),
  ].join("\n");

  for (const [label, pattern] of [
    ["runtime endpoint", /runtime\s+endpoint/i],
    ["fallback report", /fallback\s+report/i],
    ["005 sandbox", /005\s+sandbox/i],
    ["real demo id", /real_demo_e2e_005/i],
    ["demo", /\bdemo\b/i],
    ["provider submit", /provider\s+submit|provider\s+未提交/i],
    ["prompt", /\bprompt\b/i],
    ["queue", /\bqueue\b/i],
    ["prepare ran", /prepare\s+ran|prepareRan|prepare\s+未执行/i],
    ["live submit", /live\s+submit/i],
    ["ledger", /\bledger\b/i],
    ["needs review English", /needs\s+review/i],
  ]) {
    assert(!pattern.test(surface), `ProjectRealChainPanel exposed ${label}`);
  }

  assert(/项目状态/.test(surface), "ProjectRealChainPanel should expose creator-facing project status copy");
  assert(/本地复核/.test(surface), "ProjectRealChainPanel should expose creator-facing review copy");
  assert(/未选择项目/.test(surface), "ProjectRealChainPanel should expose unbound project copy");
  assert(/未同步/.test(surface), "ProjectRealChainPanel should expose unsynced project copy");
  assert(/项目路径/.test(surface), "ProjectRealChainPanel should expose project path selection copy");
  assert(/打开项目/.test(surface), "ProjectRealChainPanel should expose project open copy");
  assert(/项目文件状态/.test(panel), "ProjectRealChainPanel should expose project file status");
  assert(/最近项目/.test(surface), "ProjectRealChainPanel should expose recent projects copy");
  assert(/onRemoveRecentProject/.test(minimalTopNavSource), "Top project control must let creators remove a recent project record");
  assert(/从列表移除，不删除本地文件/.test(minimalTopNavSource), "Recent project removal must explain that local files are not deleted");
  assert(/const\s+projectTitleLabel\s*=\s*projectTitle\s*\|\|\s*"新视频项目"/.test(minimalTopNavSource), "Top project control must show the selected empty project name instead of forcing generic new-project copy");
  assert(/function\s+compactProjectPathLabel/.test(minimalTopNavSource), "Top project control should compact local paths before showing them");
  assert(/title=\{projectRoot\}/.test(minimalTopNavSource), "Top project control should keep the full current project path available as hover text");
  assert(/title=\{project\.projectRoot\}/.test(minimalTopNavSource), "Recent projects should keep their full local paths available as hover text");
  assert(/onRemoveRecentProject=\{removeRecentProjectRecord\}/.test(appSource), "App must wire recent project record removal into the project control");
  assert(/连接项目/.test(surface), "ProjectRealChainPanel should expose connect project copy");
  assert(/已观察输出[\s\S]*returnedCount[\s\S]*plannedCount/.test(surface), "ProjectRealChainPanel should show observed output count");
  assert(/张需复核/.test(surface), "ProjectRealChainPanel should show needs-review image count");
  assert(/预览[\s\S]*可预览/.test(surface), "ProjectRealChainPanel should expose preview ready state");
  assert(/成片[\s\S]*待复核/.test(surface), "ProjectRealChainPanel should expose production review state");
  assert(/<button disabled=\{disabled\} onClick=\{onRun\}>[\s\S]*同步状态/.test(panel), "sync status button must route to project status run-check");
  assert(/<button disabled=\{reviewDisabled\} onClick=\{onRunImage2Batch\}>[\s\S]*复核检查/.test(panel), "review check button must route to Image2 batch run-check");
  assert(/单镜头小样/.test(surface), "ProjectRealChainPanel should expose one-shot sample copy");
  assert(/单镜头小样/.test(surface), "ProjectRealChainPanel should expose one-shot flow copy");
  assert(/准备小样包/.test(surface), "ProjectRealChainPanel should expose sample prepare copy");
  assert(/确认动作/.test(surface), "ProjectRealChainPanel should expose action confirmation copy");
  assert(/等待结果/.test(surface), "ProjectRealChainPanel should expose waiting-result copy");
  assert(/授权票据/.test(surface), "ProjectRealChainPanel should expose permission receipt copy");
  assert(/授权引用/.test(surface), "ProjectRealChainPanel should expose authorization reference copy");
  assert(/只生成许可回执/.test(surface), "ProjectRealChainPanel should state permission receipt only copy");
  assert(/不读取密钥、不直接生成/.test(surface), "ProjectRealChainPanel should state no secret read/no direct generation copy");
  assert(/动作记录/.test(surface), "ProjectRealChainPanel should expose action evidence without provider copy");
  assert(/文件指纹/.test(surface), "ProjectRealChainPanel should expose file fingerprint evidence");
  assert(/已收到画面，复核后再进入正式结果/.test(surface), "ProjectRealChainPanel should expose needs-review evidence in user language");
  assert(/未发现可用结果/.test(surface), "ProjectRealChainPanel should expose missing-result state");
  assert(/重新检查/.test(surface), "ProjectRealChainPanel should let missing returns be checked again");
  assert(/retryHint/.test(projectRealChainPanelSource), "ProjectRealChainPanel should surface retry hints without engineering language");
  assert(/只准备小样和检查结果，不直接发起生成/.test(surface), "ProjectRealChainPanel should state no direct submit from UI");
  assert(/生成许可回执/.test(surface), "ProjectRealChainPanel should expose permission receipt action");
  assert(/结果检查/.test(surface), "ProjectRealChainPanel should expose result-check step");
  assert(/onPrepareImage2OneShot/.test(panel), "one-shot sample button must route to prepare handler");
  assert(/onChooseProjectRoot/.test(panel), "project open button must route to the Electron project chooser handler");
  assert(/onPrepareImage2OneShotPermissionReceipt/.test(panel), "permission receipt button must route to explicit helper");
  assert(/permissionBaseReady[\s\S]*Boolean\(image2OneShotState\.receipt \|\| image2OneShotState\.summary\?\.receipt\)[\s\S]*&& sampleWaiting[\s\S]*&& !sampleRunning[\s\S]*&& !sampleReview/.test(panel), "permission receipt button must enable only after handoff is confirmed");
  assert(!/permissionBaseReady[\s\S]{0,180}sampleReady\s*\|\|\s*sampleWaiting/.test(panel), "prepared state must not enable permission receipt button before handoff");
  assert(/onConfirmImage2OneShot/.test(panel), "one-shot confirm button must route to confirm handler");
  assert(/onCheckImage2OneShotReturn/.test(panel), "one-shot sample button must route to execute-return handler");
  assert(!/callImage2Provider|submitProvider|liveSubmit/.test(panel), "P6 panel must not directly trigger live generation");
  assert(/import\s+"\.\/ProjectRealChainPanel\.css"/.test(projectRealChainPanelSource), "ProjectRealChainPanel must import its extracted CSS");
  assert(/aria-label="当前项目状态"/.test(panel), "current project panel should use creator-facing status aria copy");
  assert(/aria-label="单镜头流程"/.test(panel), "one-shot flow should have user-facing aria copy");
  assert(/aria-label="单镜头结果状态"/.test(panel), "one-shot result status should have user-facing aria copy");
  assert(/aria-label="当前项目预览图"/.test(panel), "current project thumbnails should use creator-facing preview aria copy");
  assert(/\.project-real-chain-one-shot-flow\s*\{[\s\S]*grid-area:\s*flow[\s\S]*grid-template-columns:\s*repeat\(4/.test(stylesSource), "P6 flow should render as a stable four-step row");
  assert(/className="project-real-chain-messages"[\s\S]*className="project-real-chain-message"/.test(panel), "ProjectRealChainPanel should group messages before placing them in the grid");
  assert(/\.project-real-chain-messages\s*\{[\s\S]*grid-area:\s*message[\s\S]*display:\s*flex[\s\S]*flex-wrap:\s*wrap/.test(stylesSource), "project real-chain messages should share one wrapping grid item");
  assert(!/\.project-real-chain-message\s*\{[\s\S]{0,160}grid-area:\s*message/.test(stylesSource), "individual project real-chain messages must not claim the grid area");
  assert(/displayTitle[\s\S]*项目状态已同步/.test(surface), "ProjectRealChainPanel should show the bound title for synced project status");
  assert(/selectCurrentProjectBinding\(\{\s*projectRoot/.test(currentProjectRuntimeSurface), "current project hook must select the current project through the runtime helper");
  assert(/chooseProjectRoot\(\)/.test(app), "App must use the Electron project chooser when opening a project file root");
  assert(
    /const\s+activeProjectFileRoot\s*=\s*selectedProjectIsLocalProject[\s\S]{0,220}runtimeBindingIsLocalProject[\s\S]{0,120}runtimeProjectBinding\.projectRoot/.test(app),
    "App must write Project.vibe through an explicitly selected local folder or the runtime-bound local project",
  );
  assert(
    !/const\s+activeProjectFileRoot[\s\S]{0,160}runtimeProjectIdentity\?\.projectRoot/.test(app),
    "App must not reuse runtime fixture identity as an Electron project-file write target",
  );
  assert(
    /projectDraftTargetForNewVideoConfirmation[\s\S]*createNewVideoLocalProject/.test(app),
    "new-video confirmation must create a local project before Project.vibe writes when no project is selected",
  );
  assert(
    /reserveForImmediateSave:\s*true/.test(app) && /先新建或打开本地项目，再确认草案/.test(app),
    "new-video confirmation must reserve the newly created project target and use creator-facing fallback copy",
  );
  const openOrInitializeProjectDraft = findFunctionBody(app, "openOrInitializeProjectDraft");
  const bindProjectFileRootSelection = findFunctionBody(app, "bindProjectFileRootSelection");
  const clearProjectSwitchEphemera = findFunctionBody(app, "clearProjectSwitchEphemera");
  const resetAllProjectState = findFunctionBody(app, "resetAllProjectState");
  assert(
    /setRestoredAgentStagedPlanDraft\(undefined\)/.test(clearProjectSwitchEphemera)
      && /setLatestPrototypeAgentDemo\(undefined\)/.test(clearProjectSwitchEphemera)
      && /setPrototypePreviewItems\(\[\]\)/.test(clearProjectSwitchEphemera)
      && /newVideoStagedTransactionRef\.current\s*=\s*\(undefined\)/.test(clearProjectSwitchEphemera)
      && /setLatestProjectStoreApplyPlan\(undefined\)/.test(clearProjectSwitchEphemera)
      && /setRealImage2Gate\(undefined\)/.test(clearProjectSwitchEphemera),
    "project switching must clear transient Agent, preview, staged-plan, and gate UI state",
  );
  assert(
    /applyProjectVibeProjectState\(createEmptyProjectVibeForProjectRoot\([\s\S]*selection\.projectRoot[\s\S]*displayName/.test(bindProjectFileRootSelection),
    "project switching must immediately stage a clean local project shell before async Project.vibe loading",
  );
  assert(
    /clearProjectSwitchEphemera\(\)[\s\S]*applyProjectVibeProjectState\(createEmptyProjectVibeForProjectRoot/.test(bindProjectFileRootSelection),
    "project switching must clear old Agent drafts before the clean local project shell is rendered",
  );
  assert(
    /setRestoredAgentStagedPlanDraft\(undefined\)/.test(resetAllProjectState),
    "closing a project must clear any restored Agent staged draft from the previous project",
  );
  assert(
    /setProjectImage2BatchState\(\{\s*status:\s*"unavailable"[\s\S]*正在同步当前项目复核状态/.test(bindProjectFileRootSelection),
    "project switching must clear stale reference review state while loading the selected project",
  );
  assert(
    /createEmptyProjectVibeForProjectRoot\([\s\S]*projectFileSelection\.projectRoot[\s\S]*projectFileSelection\.displayName[\s\S]*\)/.test(openOrInitializeProjectDraft),
    "empty local projects must initialize from a clean project document tied to the selected folder",
  );
  assert(
    !/createProjectVibeFromRuntimeState\(workbenchRuntimeState\)/.test(openOrInitializeProjectDraft),
    "empty local projects must not copy the previous workbench story into the new project.vibe",
  );
  assert(/projectFileRootSelected/.test(currentProjectRuntimeSurface), "current project path must keep project-file selection usable even when runtime sync is unavailable");
  assert(/loadCurrentProjectChoices\(\)/.test(currentProjectRuntimeSurface), "current project hook must load recent project choices through the runtime helper");
  assert(/selectProjectChoice/.test(currentProjectRuntimeSurface), "current project path must route recent project choices through the current selection helper");
  assert(/refreshCurrentProjectPanels\(binding\)/.test(currentProjectRuntimeSurface), "current project hook must refresh current binding and project panels after selection");
  assert(/loadCurrentProjectBindingStatus\(\)/.test(currentProjectRuntimeSurface), "current project hook must load runtime current project binding first");
  assert(/useState<ProjectCurrentBindingStatus>\(\s*\(\)\s*=>\s*currentProjectBindingStatusFromBootstrap\(\)/.test(currentProjectRuntimeSurface), "current project hook must initialize from bootstrapped binding before async runtime fetch");
  assert(/__VIBE_CURRENT_PROJECT_BINDING__/.test(viteConfigSource), "Vite dev preview must bootstrap the current project binding for restricted browser surfaces");
  assert(/vibe-current-project-binding/.test(viteConfigSource), "Vite dev preview must also expose current project binding through DOM metadata");
  assert(/"Cache-Control":\s*"no-store"/.test(viteConfigSource), "Vite dev preview must not let stale HTML/module cache hide current Agent UI changes");
  assert(/function noStoreDevCachePlugin\(\)[\s\S]*res\.writeHead[\s\S]*Cache-Control",\s*"no-store"[\s\S]*Pragma",\s*"no-cache"[\s\S]*Expires",\s*"0"/.test(viteConfigSource), "Vite dev preview must force no-store on transformed module responses, not only HTML headers");
  assert(/plugins:\s*\[noStoreDevCachePlugin\(\),\s*currentProjectBindingBootstrapPlugin\(\),\s*react\(\)\]/.test(viteConfigSource), "Vite dev preview cache guard must run before other dev middleware");
  assert(/currentProjectBindingStatusFromBootstrap[\s\S]*__VIBE_CURRENT_PROJECT_BINDING__[\s\S]*currentProjectBindingFromMeta[\s\S]*deriveCurrentProjectBindingStatus/.test(currentProjectBindingClientSource), "frontend must fall back to the bootstrapped current project binding when runtime fetch is unavailable");
  assert(currentProjectBindingClientSource.includes('querySelector<HTMLMetaElement>(\'meta[name="vibe-current-project-binding"]\')'), "frontend must read DOM metadata when the browser hides injected window globals");
  assert(/projectCurrentAgentTimelineEndpoint/.test(currentProjectBindingClientSource), "current project client must expose an Agent timeline runtime endpoint");
  assert(/currentProjectAgentTimelineSidecarPath\s*=\s*"\.vibe-runtime\/agent-timeline\.json"/.test(localRuntimeApiServerSource), "runtime Agent timeline route must be pinned to the project sidecar path");
  assert(/handleCurrentProjectAgentTimelineRoute[\s\S]*currentProjectRouteContext[\s\S]*readFileSync[\s\S]*writeFileSync/.test(localRuntimeApiServerSource), "runtime must read and write the current project's Agent timeline sidecar");
  assert(/loadCurrentProjectAgentTimelineTextFromRuntime[\s\S]*readProjectVibeSidecarText/.test(projectAgentTimelineSource), "Agent timeline restore must try runtime project storage before browser fallback");
  assert(/saveCurrentProjectAgentTimelineTextToRuntime[\s\S]*writeProjectVibeSidecarText/.test(projectAgentTimelineSource), "Agent timeline save must try runtime project storage before browser fallback");
  assert(/currentProjectBindingIdentity\(runtimeProjectBinding\)/.test(currentProjectRuntimeSurface), "current project hook must derive current project identity from runtime binding");
  assert(!/currentProjectIdentity\(runtimeState\)/.test(currentProjectRuntimeSurface), "current project path must not derive current project identity from runtime-state.json");
  assert(/loadProjectRealChainStatus\(runtimeProjectIdentity\)/.test(currentProjectRuntimeSurface), "current project hook must guard real-chain status by runtime binding identity");
  assert(/loadProjectImage2BatchPlan\(runtimeProjectIdentity\)/.test(currentProjectRuntimeSurface), "current project hook must guard Image2 batch status by runtime binding identity");
  assert(/runProjectRealChainCheck\(runtimeProjectIdentity\)/.test(currentProjectRuntimeSurface), "current project hook run-check must use runtime binding identity");
  assert(/runProjectImage2BatchCheck\(runtimeProjectIdentity\)/.test(currentProjectRuntimeSurface), "current project hook Image2 check must use runtime binding identity");
  assert(/PROJECT_IMAGE2_ASSET_GENERATION_TIMEOUT_MS\s*=\s*90_000/.test(projectImage2ActionsSource), "Image2 asset generation must have a demo-safe request timeout");
  assert(/timeoutSignal\(PROJECT_IMAGE2_ASSET_GENERATION_TIMEOUT_MS\)[\s\S]*signal:\s*timeout\.signal[\s\S]*timeout\.clear\(\)/.test(projectImage2ActionsSource), "Image2 asset generation must abort long runtime requests and leave the button recoverable");
  assert(/rememberProjectRoot\(runtimeProjectBinding\.projectRoot\)/.test(app), "runtime-selected projects must be registered with the Electron file sandbox before local writes");
  assert(/Failed to remember runtime-selected project root/.test(app), "runtime-selected project sandbox registration must fail softly");
  assert(/projectDraftTargetForNewVideoConfirmation[\s\S]*rememberProjectRoot\(prototypeProjectDraftTarget\.projectRoot\)/.test(app), "new-video confirmation must re-register selected project folders before writing Project.vibe");
  assert(/const\s+selectedProjectIsBrowserDraft\s*=[\s\S]*isBrowserDraftProjectRoot\(projectFileSelection\.projectRoot\)/.test(app), "selected browser-runtime projects must be classified before readiness is derived");
  assert(/const\s+selectedProjectMatchesRuntimeBinding\s*=[\s\S]*normalizeProjectRootForUiCompare\(projectFileSelection\.projectRoot\)[\s\S]*normalizeProjectRootForUiCompare\(runtimeProjectBinding\.projectRoot\)/.test(app), "selected browser-runtime projects must detect whether they are the runtime-bound project");
  assert(/const\s+selectedProjectUsesBrowserDraftStorage\s*=\s*selectedProjectIsBrowserDraft[\s\S]*!\(runtimeBindingIsLocalProject && selectedProjectMatchesRuntimeBinding\)/.test(app), "runtime-bound browser-project projects must not use temporary draft storage");
  assert(/loadedPrototypeProjectDraftStorageModeRef\s*=\s*useRef<"browser" \| "local" \| undefined>/.test(app), "project draft restore must remember whether the loaded target came from browser or local storage");
  assert(/setLoadedPrototypeProjectDraftTargetId\(prototypeProjectDraftTargetId\);\s*loadedPrototypeProjectDraftStorageModeRef\.current\s*=\s*"browser"/.test(app), "browser draft restore must mark the loaded storage mode as browser");
  assert(/loadedPrototypeProjectDraftTargetId === prototypeProjectDraftTargetId[\s\S]*loadedPrototypeProjectDraftStorageModeRef\.current === "local"/.test(app), "local project restore must not be skipped by an earlier browser draft load");
  assert(/setLoadedPrototypeProjectDraftTargetId\(prototypeProjectDraftTargetId\);\s*loadedPrototypeProjectDraftStorageModeRef\.current\s*=\s*"local"/.test(app), "local project restore must mark the loaded storage mode as local after reading Project.vibe sidecars");
  assert(/openProjectAgentTimeline\(prototypeProjectDraftTarget,\s*\{[\s\S]*project:\s*prototypeProjectVibeRef\.current[\s\S]*projectRoot:\s*runtimeProjectBinding\.projectRoot[\s\S]*setRestoredAgentTimelineEntries\(timelineOpen\.timeline\.entries\)/.test(app), "runtime-bound projects must restore Agent timeline through the unified sidecar resolver");
  assert(/if\s*\(runtimeProjectBinding\.status !== "bound" \|\| !runtimeProjectBinding\.projectRoot\) return;[\s\S]*if\s*\(selectedProjectIsLocalProject\) return;[\s\S]*setProjectFileSelection\(\{[\s\S]*runtimeProjectBinding\.projectRoot/.test(app), "runtime-bound local projects must replace temporary browser drafts in project selection");
  assert(/if\s*\(selectedProjectUsesBrowserDraftStorage\)\s*\{[\s\S]*草案已临时保存[\s\S]*setLoadedPrototypeProjectDraftTargetId\(prototypeProjectDraftTargetId\)[\s\S]*restoreBrowserDraftStateAndAgentSidecars[\s\S]*return \(\) =>/.test(app), "browser draft restore must use the temporary-project path without creating an empty local project");
  assert(/restoreBrowserDraftStateAndAgentSidecars[\s\S]*openProjectVibeDraft\(prototypeProjectDraftTarget\)[\s\S]*if\s*\(result\.ok && result\.project\)[\s\S]*applyProjectVibeProjectState\(result\.project, prototypeProjectDraftTarget\)/.test(app), "browser draft restore must recover the saved story before restoring Agent messages");
  assert(/restoreBrowserDraftStateAndAgentSidecars[\s\S]*openProjectAgentStagedPlanDraft\(prototypeProjectDraftTarget[\s\S]*openProjectAgentActionLog\(prototypeProjectDraftTarget[\s\S]*openProjectAgentTimeline\(prototypeProjectDraftTarget[\s\S]*setRestoredAgentTimelineEntries\(timelineOpen\.timeline\.entries\)/.test(app), "browser draft Agent timeline must be restored from sidecar storage after the project draft is recovered");
  assert(/const\s+browserDraftHasNoLocalProject\s*=\s*!runtimeBindingIsLocalProject[\s\S]*selectedProjectIsBrowserDraft/.test(app), "browser drafts must explicitly mark that no local project is available unless runtime has a real bound project");
  assert(/localProjectReadyForUi\s*=\s*\(projectFileSelection\.status\s*===\s*"selected"\s*&&\s*!selectedProjectIsBrowserDraft\)[\s\S]*runtimeBindingIsLocalProject/.test(app), "runtime-bound local projects must become local-ready even if the browser still shows a temporary draft");
  assert(/const\s+effectiveRuntimeProjectBinding\s*=\s*selectedProjectIsLocalProject[\s\S]*selectedProjectFallbackRuntimeBinding[\s\S]*runtimeBindingIsLocalProject[\s\S]*runtimeProjectBinding[\s\S]*selectedProjectIsBrowserDraft[\s\S]*status:\s*"unbound"/.test(app), "runtime-bound local projects must override browser drafts without overriding explicitly selected local folders");
  assert(/result\.status === "missing" && selectedProjectUsesBrowserDraftStorage[\s\S]*草案已临时保存[\s\S]*return;[\s\S]*result\.status === "missing" && projectFileSelection\.status === "selected"/.test(app), "browser draft restore must not create an empty Project.vibe over the just-confirmed story");
  assert(/projectFileSelectionRef\.current = projectFileSelection/.test(app), "fresh-session reset must read the latest project-file selection");
  assert(/prototypeProjectVibeRef\.current\.shots\.length > 0 \|\| projectFileSelectionRef\.current\.status === "selected"[\s\S]*return;[\s\S]*resetAllProjectState\(\)/.test(app), "fresh-session reset must not wipe a story or project that appeared while runtime cleanup was pending");
  assert(/buildCurrentProjectWorkbenchProjection\(\{[\s\S]*binding:\s*effectiveRuntimeProjectBinding[\s\S]*realChainState:\s*projectRealChainState[\s\S]*image2BatchState:\s*projectImage2BatchState/.test(app), "App must derive the main workbench from current project runtime projection");
  assert(/applyCurrentProjectWorkbenchProjectionToRuntimeState\(runtimeState,\s*currentProjectProjectionForRuntime\)/.test(app), "App must bind Story Flow to the sanitized current project workbench projection");
  assert(/useCurrentProjectWorkbenchProjection\s*=\s*currentProjectWorkbenchProjection\.available/.test(app), "App must gate current-project projection so opened Project.vibe can remain the main state");
  assert(/currentProjectHasOnlyPlaceholder[\s\S]*CURRENT_PROJECT[\s\S]*current_project_story_pending/.test(app), "App must recognize the current-project placeholder shot as an empty project shell");
  assert(/currentProjectProjectionForRuntime[\s\S]*shots:\s*\[\][\s\S]*sections:\s*\[\]/.test(app), "Empty current-project placeholders must clear stale story and section state before rendering");
  assert(/const\s+currentProjectProjectionHasUsableContent\s*=\s*!currentProjectHasOnlyPlaceholder[\s\S]*currentProjectWorkbenchProjection\.sections\.length > 0/.test(app), "Current-project placeholder sections must not count as usable content that can overwrite a newly confirmed browser draft story");
  assert(/normalizeProjectRootForUiCompare/.test(appSource), "App must normalize project roots before comparing current-project projections");
  assert(/\/\.vibe-runtime\//.test(appSource), "App project-root comparison must collapse absolute and repo-relative .vibe-runtime roots");
  assert(!/const\s+currentProjectProjectionMatchesSelectedRoot\s*=\s*runtimeCurrentProjectIsBound/.test(app), "App must not let a bound runtime projection bypass selected project-root matching");
  assert(/const\s+currentProjectProjectionMatchesSelectedRoot\s*=\s*!normalizedSelectedProjectRoot[\s\S]*normalizedProjectionProjectRoot\s*===\s*normalizedSelectedProjectRoot/.test(app), "App must only use current-project projection when it matches the selected project root");
  assert(/setProjectRealChainState\(\{\s*status:\s*"running"[\s\S]*正在连接当前项目/.test(currentProjectRuntimeHookSource), "project switching must clear stale real-chain summaries instead of spreading previous state");
  assert(!/setProjectRealChainState\(\(current\)\s*=>\s*\(\{\s*\.\.\.current[\s\S]*正在连接当前项目/.test(currentProjectRuntimeHookSource), "project switching must not preserve previous real-chain summary while connecting");
  assert(!/useCurrentProjectWorkbenchProjection[\s\S]{0,260}currentProjectProjectionHasStoryContent/.test(app), "Empty current projects must still use the current-project projection to clear stale story and asset state");
  assert(/const\s+isEmptyFallbackWorkbench\s*=\s*selectedProjectHasNoContent/.test(app), "Selected empty projects must return to the new-video entry instead of showing a fake story shot");
  assert(/assetLibraryNode=\{\s*<MinimalAssetLibrary[\s\S]*readOnlyDetail=\{workbenchAssetReadOnlyDetail\}/.test(app), "App must bind Asset Library fallback copy through the effective workbench detail");
  assert(/projectScopeLabel=\{workbenchProjectScopeLabel\}/.test(app), "App must bind Agent scope through the effective workbench label");
  assert(/runtimeState=\{workbenchRuntimeState\}/.test(app), "DirectorMode must receive the current project workbench runtime state");
  assert(/buildCreatorDeskProjection\(\{[\s\S]*runtimeState:\s*workbenchRuntimeState[\s\S]*previewItems:\s*directorPreviewQueue[\s\S]*image2BatchState:\s*projectImage2BatchState[\s\S]*selectedShotIds:\s*workbenchSelectedShotIds/.test(app), "App must derive the creator desk from current project workbench projection");
  assert(/creatorDesk=\{creatorDeskProjection\}/.test(app), "DirectorMode must receive the creator desk projection");
  assert(/pendingReferenceReviewCount/.test(appSource), "App must block video submit while references still need review");
  assert(/pendingReferenceReviewCount\s*=\s*workbenchRuntimeState\.visualMemory\.assets\.filter/.test(appSource), "Video submit gate must derive reference blockers from visual memory assets");
  assert(!/pendingReferenceReviewCount[\s\S]{0,260}framePlan\.(?:reviewCount|missingCount)/.test(appSource), "Video submit gate must not treat missing video/shot outputs as reference review blockers");
  assert(/if \(!videoSubmitAction \|\| pendingReferenceReviewCount <= 0\) return videoSubmitAction;[\s\S]*if \(videoSubmitAction\.status === "blocked"\) return videoSubmitAction;/.test(appSource), "Video submit gate must preserve concrete QA blockers so the Agent can recover the blocked shot instead of showing generic reference review copy");
  assert(/先确认参考素材，再发送视频/.test(appSource), "Video submit gate should use creator-facing review copy");
  assert(/videoSendAction=\{gatedVideoSubmitAction\}/.test(appSource), "DirectorMode must receive the gated video submit action");
  assert(/onRetryMissingBatch=\{runMissingVisualsFromStory\}/.test(app), "DirectorMode must route missing visuals through the story fallback handler");
  assert(/hasRunnableBatch\s*=\s*retryCount\s*>\s*0[\s\S]*runProjectImage2Batch\(\)[\s\S]*runImage2AssetGeneration\(\{ skipConfirm: true \}\)/.test(app), "Story fallback must only use the old batch runner for runnable retries and project-scoped reference generation otherwise");
  assert(/onRetryReviewItem=\{\(item\)\s*=>\s*applyCreatorReviewDecision\(item,\s*"retry"\)\}/.test(app), "DirectorMode must route per-item retry through Project.vibe review decisions");
  assert(/onRejectReviewItem=\{\(item\)\s*=>\s*applyCreatorReviewDecision\(item,\s*"reject"\)\}/.test(app), "DirectorMode must route reject through Project.vibe review decisions");
  assert(/submitCurrentProjectReviewDecision\(effectiveRuntimeProjectIdentity,\s*\{/.test(app), "review decisions must use the current project runtime route when a project folder is bound");
  assert(/if \(item\.assetId && rejectMode\)/.test(app), "asset-backed rejects may use the fast asset-status path");
  assert(!/item\.assetId && \(promotionMode \|\| rejectMode\)/.test(app), "Review Tray locks must not bypass the Project.vibe review decision route");
  assert(/function projectRelativeReviewMediaPath/.test(appSource), "Review decisions must normalize media paths to project-relative paths");
  assert(/outputPath:\s*reviewMediaPath/.test(app), "Review decision outputPath must use the project-relative media path");
  assert(!/outputPath:\s*item\.mediaPath/.test(app), "Review decisions must not write raw item.mediaPath into Project.vibe");
  assert(/onRunProjectRealChain=\{runProjectRealChain\}/.test(appSource), "DirectorMode must pass runtime status run-check handler to the project panel");
  assert(/onRunProjectImage2Batch=\{runProjectImage2Batch\}/.test(appSource), "DirectorMode must pass Image2 batch run-check handler to the project panel");
  assert(/function\s+assetGenerationTarget/.test(image2AssetGenerationActionSource), "Reference completion must derive its target from the current selection");
  assert(/scope:\s*"selected_shots" as const/.test(image2AssetGenerationActionSource), "Selected-shot reference completion must submit selected_shots scope");
  assert(/scope:\s*target\.scope/.test(image2AssetGenerationActionSource), "Reference completion must send the derived target scope to the runtime");
  assert(/selectedShotId:\s*target\.selectedShotId/.test(image2AssetGenerationActionSource), "Reference completion must preserve the selected shot target");
  assert(/selectedShotIds:\s*target\.selectedShotIds/.test(image2AssetGenerationActionSource), "Reference completion must preserve multi-shot targets");
  assert(/label:\s*"整个项目"/.test(image2AssetGenerationActionSource), "Reference completion must still fall back to project scope when nothing is selected");
  assert(/label:\s*"当前镜头"/.test(image2AssetGenerationActionSource), "Reference completion should explain single-shot scope in creator-facing copy");
  assert(/细节动作会留在镜头说明里/.test(image2AssetGenerationActionSource), "reference completion copy should explain generic detail folding");
  assert(/convenience_store/.test(workbenchProjectionSource), "workbench projection should understand convenience-store scenes");
  assert(/convenience_store/.test(minimalStoryFlowSource), "story flow reference matching should understand convenience-store scenes");
  assert(/convenience_store[\s\S]*mountain_road/.test(workbenchProjectionSource), "workbench scene matching should prefer convenience-store before mountain-road");
  assert(/convenience_store[\s\S]*mountain_road/.test(minimalStoryFlowSource), "story flow scene matching should prefer convenience-store before mountain-road");
  assert(/function\s+isReferenceAssetPath/.test(minimalStoryFlowSource), "story flow must distinguish reusable reference assets from actual shot media");
  assert(/actualShotFramePath\(shot\.startFrame\)/.test(minimalStoryFlowSource), "story flow must not treat reference assets as real shot frames");
  assert(/function\s+assetHasVisualMedia[\s\S]*png\|jpe\?g\|webp/.test(minimalStoryFlowSource), "story flow submitted-reference previews must only use real image media");
  assert(/function\s+isTextOnlyStyleReferenceAsset[\s\S]*文字风格方向[\s\S]*项目视觉风格/.test(minimalStoryFlowSource), "story flow must filter text-only style placeholders from submitted references");
  assert(/isUsableVisualReferenceAsset\(asset\)[\s\S]*!isStoryboardReferenceAsset\(asset\)[\s\S]*assetMatchesShot/.test(minimalStoryFlowSource), "story flow reference matching must ignore non-image placeholders");
  assert(/missingLabel:\s*"缺故事板参考"/.test(minimalStoryFlowSource), "storyboard-mode reference bundles must reserve image 1 when the storyboard is not generated yet");
  assert(/statusLabel:\s*item\.asset\?\.path[\s\S]*item\.missingLabel/.test(minimalStoryFlowSource), "storyboard placeholder references must surface a user-facing missing state");
  assert(/storyboardStatusTone[\s\S]*strategy === "omni_reference" \? "ok" : "warn"/.test(minimalStoryFlowSource), "storyboard reference UI should not mark missing storyboard images as ready");
  assert(/没有拿到结果图，可以再次生成重试/.test(p6RealImage2ActionSource), "real Image2 UI action should tell the creator a failed result can be retried");
  assert(/如果网络中断，可以稍后再次生成/.test(p6RealImage2ActionSource), "real Image2 running copy should set retry expectation for long network requests");
  assert(/import\s+\{\s*DirectorMode\s*\}\s+from\s+"\.\/ui\/director\/DirectorModeShell(?:AgentKernel(?:V\d+)?)?"/.test(appSource), "App must mount the extracted DirectorModeShell");
  assert(/import\s+\{\s*MinimalAgentPanel\s*\}\s+from\s+"\.\/MinimalAgentPanel"/.test(directorModeSource), "DirectorMode must mount the extracted MinimalAgentPanel");
  assert(!/\?agent-kernel-v\d+/.test(directorModeSource), "DirectorMode must not pin Agent UI imports with fixed query strings");
  assert(/import\s+\{\s*CreatorDeskPanels\s*\}\s+from\s+"\.\/CreatorDeskPanels"/.test(directorModeSource), "DirectorMode must mount the creator desk panels");
  assert(/const storySections = \(view\.storySections \|\| \[\]\)[\s\S]*runtimeShotIds\.has\(shotId\)/.test(directorModeSource), "DirectorMode must tolerate missing story sections and keep them aligned with runtime shots");
  assert(/buildProjectStatusViewModel\(\{[\s\S]*videoStage:\s*creatorDesk\?\.videoStage/.test(directorModeSource), "DirectorMode must feed CreatorDesk videoStage into the unified project status");
  assert(/videoStage\.generation\?\.queueSummary/.test(projectStatusViewModelSource), "Unified project status must summarize serial video queue progress");
  const creatorDeskPanelCopy = extractStringLiterals(creatorDeskPanelsSource);
  assert(/故事[\s\S]*画面[\s\S]*复核列表/.test(creatorDeskPanelsSource), "Creator desk must expose planner, preparation, and review panels in product copy");
  assert(/视频生成/.test(creatorDeskPanelsSource), "Creator desk must expose the video generation panel");
  assert(/生成前总览[\s\S]*displayPreflight\.modeSummary[\s\S]*displayPreflightReferenceSummary/.test(creatorDeskPanelsSource), "Creator desk must expose a compact preflight summary");
  assert(/const agentStage = buildCreatorAgentStage/.test(creatorDeskProjectionSource), "Creator desk projection must expose one Agent stage for the primary next action");
  assert(/agentCommand:\s*buildCreatorAgentCommand\(agentStage\)/.test(creatorDeskProjectionSource), "Creator desk projection must expose one Agent command for the primary action");
  assert(/const \{ agentStage,\s*agentCommand,[^}]*scriptPlanner/.test(creatorDeskPanelsSource), "Creator desk panels must read the unified Agent stage and command");
  assert(/displayAgentCommand[\s\S]*nextActionCopy[\s\S]*displayAgentCommand\.label/.test(creatorDeskPanelsSource), "Creator desk summary copy must come from the boundary-aware Agent command");
  assert(/displayAgentCommand\.kind === "open_preview"/.test(creatorDeskPanelsSource), "Creator desk preview hint must follow the Agent command");
  assert(/displayAgentCommand\.kind === "open_export"/.test(creatorDeskPanelsSource), "Creator desk export hint must follow the Agent command");
  assert(/const displayVideoTaskActive = videoTaskActive && !projectVideoBlocked/.test(creatorDeskPanelsSource), "Creator desk must not present QA-blocked submit attempts as active video generation");
  assert(/videoSubmitCancelled[\s\S]*已取消，本次没有发送[\s\S]*videoSendAction\?\.status === "blocked" && !videoSubmitCancelled/.test(creatorDeskPanelsSource), "Creator desk must not treat legacy cancelled video confirmations as blocked video work");
  assert(/const displayCurrentTask = exportFlowTakingFocus[\s\S]*交付内容已经整理好[\s\S]*projectVideoBlocked[\s\S]*先处理失败[\s\S]*displayVideoTaskActive[\s\S]*查询结果[\s\S]*referenceGenerationBusy[\s\S]*参考正在生成，不需要重复操作[\s\S]*label:\s*"正在生成参考"[\s\S]*displayCurrentTask\.confirmation/.test(creatorDeskPanelsSource), "Creator desk current task must prioritize export/blocked-video/active-video/reference work and must not keep asking for stale confirmations");
  assert(/const videoReturnedForReview = videoStage\.status === "needs_review" \|\| videoStage\.status === "completed"[\s\S]*const videoCanResume = Boolean\(videoSendAction\?\.canResume \|\| videoGeneration\.canResume \|\| videoStage\.canResume\) && !videoReturnedForReview[\s\S]*const videoTaskActive = !videoReturnedForReview && hasActiveVideoTask\(videoGeneration\)/.test(creatorDeskPanelsSource), "Creator desk query affordance and active-task copy must stop once a video result is ready to review");
  assert(/const videoActionRelevant = !videoReturnedForReview && videoGeneration\.status !== "completed"/.test(creatorDeskPanelsSource), "Creator desk must not show stale submit/query action messages after a video result returns for review");
  assert(/const videoReviewTakingFocus = videoReturnedForReview[\s\S]*projectStatusStage === "视频待确认"[\s\S]*projectStatusStage === "视频结果已出"[\s\S]*const videoFlowTakingFocus = !exportFlowTakingFocus && \([\s\S]*videoReviewTakingFocus[\s\S]*projectVideoBlocked[\s\S]*displayVideoTaskActive/.test(creatorDeskPanelsSource), "Creator desk must keep returned or blocked video state in the video lane without treating it as an active queue");
  assert(/const activeVideoProgressSubject = videoReviewTakingFocus[\s\S]*\? "视频结果已出"[\s\S]*const reasoningDisclosureDetail = videoFlowTakingFocus[\s\S]*videoReviewTakingFocus[\s\S]*projectStatusView\?\.waitingFor \|\| "确认视频结果"/.test(creatorDeskPanelsSource), "Creator desk video explanation must say returned videos are ready for review instead of still processing");
  assert(/!localProjectReady[\s\S]*还没有本地项目文件夹[\s\S]*projectRequirement\.label[\s\S]*referenceGenerationNeedsPermission/.test(creatorDeskPanelsSource), "Creator desk must ask for a local project before showing reference-generation permission copy");
  assert(/referenceGenerationNeedsPermission[\s\S]*等你允许后再生成参考[\s\S]*label:\s*"等待你允许"/.test(creatorDeskPanelsSource), "Creator desk current task must show permission wording when the user asked to plan only");
  assert(/function\s+commandIsSubmitVideo\([\s\S]*发送视频\|提交视频/.test(creatorDeskPanelsSource), "Creator desk must detect the visible submit-video command even when it is permission-wrapped");
  assert(/submitVideoCommandVisible\s*=[\s\S]*commandIsSubmitVideo\(displayAgentCommand\)[\s\S]*statusNextAction/.test(creatorDeskPanelsSource), "Creator desk must also treat the unified status next action as the visible submit-video command");
  assert(/submitVideoCommandVisible[\s\S]*参考和素材已经可用[\s\S]*保持串行，下一步发送一段视频/.test(creatorDeskPanelsSource), "Creator desk must align current-task copy with the submit-video primary action");
  assert(/const displayPreflightReferenceSummary = referenceGenerationBusy[\s\S]*参考生成中[\s\S]*displayPreflightReferenceSummary/.test(creatorDeskPanelsSource), "Creator desk preflight summary must show the same reference running state");
  assert(/const displayPreflightChecks = referenceGenerationBusy[\s\S]*state:\s*"waiting" as const[\s\S]*正在生成参考，完成后进入复核/.test(creatorDeskPanelsSource), "Creator desk preflight checks must not show stale missing-reference copy while generation is running");
  assert(/agentFlowDetail\(step\.id,\s*projection,\s*displayPreflightReferenceSummary\)/.test(creatorDeskPanelsSource), "Creator desk reasoning flow must use the displayed reference summary");
  assert(/agentSkillPills\(projection,\s*displayPreflightReferenceSummary\)/.test(creatorDeskPanelsSource), "Creator desk skill pills must use the displayed reference summary");
  assert(!/creator-primary-action|runCreatorPrimaryAction/.test(creatorDeskPanelsSource), "Creator desk summary must not duplicate the bottom primary action");
  assert(/const preflight = buildCreatorPreflightProjection/.test(creatorDeskProjectionSource), "Creator desk projection must build preflight from the current workbench state");
  assert(/故事板叙事[\s\S]*故事板快切[\s\S]*全能参考/.test(creatorDeskProjectionSource), "Creator desk preflight must summarize the three generation modes");
  assert(/function\s+isTextOnlyStyleAsset[\s\S]*new_video_reference:style:text[\s\S]*文字风格方向[\s\S]*项目视觉风格/.test(creatorDeskProjectionSource), "Creator desk must filter text-only style placeholders from review counts");
  assert(/videoRecoverable[\s\S]*查询结果[\s\S]*视频已发送，可以查询结果/.test(creatorDeskProjectionSource), "Creator desk preflight must treat recoverable queued videos as queryable, not as a new submit state");
  for (const statusLabel of ["未生成", "已发送", "排队中", "生成中", "已完成", "可稍后恢复"]) {
    assert(new RegExp(statusLabel).test(creatorDeskPanelsSource), `Creator desk must expose ${statusLabel} video status`);
  }
  assert(/即梦常见约[\s\S]*分钟[\s\S]*可以离开后查询结果/.test(creatorDeskPanelsSource), "Creator desk must describe long Jimeng waits with resume copy");
  for (const statusLabel of ["待复核", "缺参考", "可重试", "已通过", "已锁定"]) {
    assert(new RegExp(statusLabel).test(creatorDeskPanelCopy), `Creator desk must expose ${statusLabel}`);
  }
  for (const actionLabel of ["通过", "重试", "拒绝", "锁定", "绑定为", "查看说明"]) {
    assert(new RegExp(actionLabel).test(creatorDeskPanelsSource), `Creator desk must expose ${actionLabel} action`);
  }
  for (const lockLabel of ["角色参考", "场景参考", "道具参考", "本镜头画面"]) {
    assert(new RegExp(lockLabel).test(creatorDeskPanelsSource), `Creator desk must expose ${lockLabel} lock target`);
  }
  assert(/onLockReviewItem=\{\(item,\s*target\)\s*=>\s*applyCreatorReviewDecision\(item,\s*"lock",\s*target\)\}/.test(app), "DirectorMode must route lock target through Project.vibe review decisions");
  assert(/assetKind:\s*promotionMode\s*\?\s*lockAssetKind\s*:\s*"reference"[\s\S]*assetLabel[\s\S]*usedByShotIds/.test(app), "App must promote Review Tray locks with selected asset kind, label, and shot usage");
  assert(/cleanReviewItemProjectLabel\(item\.label\)/.test(app), "Review Tray promotion must strip transient UI status copy before writing Project.vibe asset labels");
  assert(/loadProjectRealChainStatus\(effectiveRuntimeProjectIdentity\)[\s\S]*setProjectRealChainState\(refreshed\)/.test(app), "Review Tray promotion must refresh the current-project workbench projection after writing Project.vibe");
  assert(!/Script Planner|Batch Generation|Review Tray|Needs review|Missing|Approved|Locked|Approve/.test(creatorDeskPanelCopy), "Creator desk panels must not expose English planner/review copy");
  assert(/concurrencyLabel:\s*"Concurrency 10"[\s\S]*retryLabel:\s*"Retry Missing"/.test(creatorDeskProjectionSource), "Creator batch projection must show concurrency 10 and Retry Missing");
  assert(/safetyLabel[\s\S]*Retry downshifts to/.test(creatorDeskProjectionSource), "Creator batch projection must expose retry downshift copy");
  assert(/videoStage[\s\S]*buildCreatorVideoStageProjection[\s\S]*videoGeneration\s*=\s*videoStage\.generation/.test(creatorDeskProjectionSource), "Creator desk projection must include a single Jimeng video stage");
  assert(/const videoGeneration = videoStage\.generation/.test(creatorDeskPanelsSource), "Creator desk panels must read video state from the single video stage");
  assert(/projectRealChainRelayQueue\s*=\s*projectRealChainState\.summary\?\.relayQueue[\s\S]*relayQueue:\s*projectRealChainRelayQueue/.test(app), "Creator desk must pass the persisted Seedance relay queue into the projection");
  assert(/videoGenerationFromRelayQueue[\s\S]*relayQueue\.status\s*===\s*"complete"[\s\S]*"submitted"/.test(creatorDeskProjectionSource), "Creator desk projection must map the persisted relay queue to visible video status");
  assert(/candidate\.reviewRequired\s*===\s*false[\s\S]*return\s+false/.test(creatorDeskProjectionSource), "Creator desk video review count must respect already-approved preview items");
  assert(/nextReadyItem[\s\S]*completedCount\s*>\s*0[\s\S]*确认后会继续发送下一段视频/.test(creatorDeskProjectionSource), "Creator desk must treat a partially completed relay queue with a ready next item as continue-ready");
  assert(/const\s+reconciliationReviewCount\s*=\s*assetReconciliation\.summary\.needsReview/.test(creatorDeskProjectionSource), "Creator desk must not let ambiguous asset suggestions block the primary flow");
  assert(/const\s+assetReconciliationHasBlockingWork[\s\S]*summary\.needsReview[\s\S]*summary\.missing[\s\S]*submitVideoCommandVisible[\s\S]*assetReconciliationHasBlockingWork/.test(creatorDeskPanelsSource), "Creator desk must hide non-blocking asset suggestions once the primary action is sending video");
  assert(/const projectStatusStage = projectStatusView\?\.stage \|\| ""/.test(creatorDeskPanelsSource), "Creator desk must normalize the unified project status stage before focus decisions");
  assert(/const projectStatusExportCopy = `\$\{projectStatusView\?\.nextAction \|\| ""\} \$\{projectStatusView\?\.waitingFor \|\| ""\}`/.test(creatorDeskPanelsSource), "Creator desk must inspect export-facing next-action copy before focus decisions");
  assert(/const exportFlowTakingFocus = Boolean\([\s\S]*projectStatusStage === "可以导出"[\s\S]*projectStatusStage\.startsWith\("导出"\)[\s\S]*projectStatusStage === "视频结果已出" && \/交付\|导出\/\.test\(projectStatusExportCopy\)/.test(creatorDeskPanelsSource), "Creator desk must treat export-ready/export-complete and completed-video-to-delivery as the primary visible workflow");
  assert(/const videoFlowTakingFocus = !exportFlowTakingFocus && \([\s\S]*videoReviewTakingFocus[\s\S]*projectVideoBlocked[\s\S]*displayVideoTaskActive[\s\S]*videoCanResume[\s\S]*Boolean\(projectStatusView\?\.stage\?\.startsWith\("视频"\)\)/.test(creatorDeskPanelsSource), "Creator desk must let export status override stale queued/queryable video cues while keeping returned or blocked videos in review focus");
  assert(/const primaryFlowTakingFocus = exportFlowTakingFocus \|\| videoFlowTakingFocus/.test(creatorDeskPanelsSource), "Creator desk must use one primary-flow gate for hiding side suggestions");
  assert(/const showAssetReconciliation = Boolean\(assetReconciliation && \(\s*primaryFlowTakingFocus[\s\S]*\? false/.test(creatorDeskPanelsSource), "Creator desk must hide asset suggestions while export or video is the primary workflow");
  assert(/const\s+showProjectInbox\s*=\s*projectInbox\.totalCount > 0 && !submitVideoCommandVisible && !primaryFlowTakingFocus/.test(creatorDeskPanelsSource), "Creator desk must keep project inbox suggestions out of the way while the primary action is sending video or showing export");
  assert(/item\?\.attemptCount \? fact\("查询", `已查询 \$\{item\.attemptCount\} 次`/.test(creatorDeskProjectionSource), "Creator desk projection must expose video query attempt progress");
  assert(/activeVideoQueryFact[\s\S]*activeVideoProgressParts\.join\("；"\)/.test(creatorDeskPanelsSource), "Creator desk panels must include query attempts in visible video progress copy");
  assert(!/provider|schema|task[-\s]*envelope/i.test(creatorDeskPanelsSource), "Creator desk panels must not expose engineering terms");
  assert(/确认/.test(agentPanelContractSource), "Agent Panel confirmation action should use creator-facing confirmation copy");
  assert(/isContinueIntent/.test(agentPanelSource), "Agent Panel should recognize natural-language continue/confirmation input");
  assert(!/composerInputUsesNextAction/.test(agentPanelSource), "Agent Panel must not turn typed continue into a hidden confirmation shortcut before it enters the message flow");
  assert(/className="minimal-agent-send-button"[\s\S]*onClick=\{handleSend\}/.test(agentPanelSource), "Agent Panel send button should only send typed text or files; next actions live in Agent messages");
  assert(/videoBlockedRecoveryIntent[\s\S]*videoBlockerRecoveryIntent\(videoSendAction\?\.message\)/.test(agentPanelSource), "Agent Panel should derive a concrete recovery intent from video QA blockers");
  assert(/recoveryTargetShotIds\?:\s*string\[\]/.test(agentPanelSource), "Agent Panel video action should carry the QA-blocked shot ids for recovery");
  assert(/videoBlockedRecoveryScopedIntent[\s\S]*`镜头 \$\{formatShotNumber\(videoBlockedRecoveryTargetShots\[0\]\.id\)\} \$\{videoBlockedRecoveryTargetShots\[0\]\.title\}/.test(agentPanelSource), "Agent Panel should put the blocked shot number and title into recovery intent");
  assert(/videoBlockedRecoveryFooterAction[\s\S]*prepareChange\(videoBlockedRecoveryScopedIntent,\s*\{[\s\S]*selectedShotIds:\s*videoSendAction\?\.recoveryTargetShotIds/.test(agentPanelSource), "Agent Panel should continue from a video QA blocker using the blocked shot target, not the currently selected shot");
  assert(/const availableFooterDirectAction = referenceReviewFooterAction \|\| videoBlockedRecoveryFooterAction \|\| commandFooterDirectAction \|\| fallbackFooterDirectAction/.test(agentPanelSource), "Agent Panel should take creators to pending reference review before offering another video blocker recovery run");
  assert(/videoSubmitCancelled[\s\S]*已取消，本次没有发送[\s\S]*videoSubmissionBlocked = videoSendAction\?\.status === "blocked" && !videoSubmitCancelled/.test(agentPanelSource), "Agent Panel must not treat legacy cancelled video confirmations as blocked submit failures");
  assert(/videoSubmitCancelled[\s\S]*command\.kind === "submit_video" && videoSendAction\?\.status === "blocked" && !videoSubmitCancelled/.test(directorModeSource), "Director shell must not rewrite legacy cancelled video confirmations into video-problem commands");
  assert(/const referencesUsableForAgent = referencesReadyAfterReview \|\| timelineShowsReferenceReady/.test(agentPanelSource), "Agent Panel must treat later reference-ready Agent messages as usable reference evidence");
  assert(/const referenceFooterAction = showRealSampleAction && !referencesUsableForAgent && realSampleAction\?\.status !== "verified"/.test(agentPanelSource), "Agent Panel must not offer a stale generate-reference confirmation once references are already usable");
  const seedanceSubmitActionSource = fs.readFileSync("src/ui/director/useSeedanceVideoSubmitAction.ts", "utf8");
  assert(/SEEDANCE_SUBMIT_UI_TIMEOUT_MS\s*=\s*300_000/.test(seedanceSubmitActionSource), "Seedance UI timeout must match the runtime CLI minimum to avoid false failures during long queues");
  assert(/!options\?\.skipConfirm[\s\S]*status:\s*"idle"[\s\S]*已取消，本次没有发送；需要时可以重新确认/.test(seedanceSubmitActionSource), "Cancelling the video confirmation must stay retryable instead of turning into a blocked video problem");
  assert(/recoveryTargetShotIds/.test(seedanceSubmitActionSource), "Seedance action state should expose blocked shot ids for recovery");
  assert(/recoveryTargetShotIds:\s*effectiveActionState\.recoveryTargetShotIds/.test(seedanceSubmitActionSource), "Seedance action view should return blocked shot ids to the Agent panel");
  assert(/state\.summary\?\.relayQueue[\s\S]*state as ProjectRealChainUiState & \{ relayQueue\?: ProjectSeedanceSubmitResult\["relayQueue"\] \}[\s\S]*\.relayQueue/.test(seedanceSubmitActionSource), "Seedance action state should read persisted relay queues from both summary and top-level runtime status");
  assert(/function\s+realChainStillNeedsReview[\s\S]*needsReviewCount[\s\S]*reviewOverlayShots[\s\S]*returned_with_review_overlay[\s\S]*relayQueue\.status === "complete"[\s\S]*!realChainStillNeedsReview\(state\)[\s\S]*suggestedActionLabel:\s*"查看交付"/.test(seedanceSubmitActionSource), "Seedance action state must stop showing completed approved queues as pending review");
  assert(/actionState\.status === "running" \|\| actionState\.status === "blocked" \|\| actionState\.canResume/.test(seedanceSubmitActionSource), "Seedance action state must keep local QA blockers visible instead of being overwritten by an idle persisted queue");
  assert(/消息里建议补参考，不会提交视频/.test(agentPanelSource), "Agent Panel should explain blocker recovery without implying video submission");
  assert(/videoFocusScopeLabel[\s\S]*正在等视频结果[\s\S]*videoFocusSelectionHint[\s\S]*点确认只查询结果，不会重复提交/.test(agentPanelSource), "Agent Panel should show the active video task instead of the selected shot while waiting for queued video");
  assert(/正在看\|正在等\|正在发送/.test(agentPanelSource), "Agent Panel compact scope label should preserve active video focus copy");
  assert(/const displayedScopeLabel = exportResultIsPrimary && exportFocusScopeLabel[\s\S]*\? exportFocusScopeLabel[\s\S]*: videoResultIsPrimary && videoFocusScopeLabel[\s\S]*\? videoFocusScopeLabel[\s\S]*: baseDisplayedScopeLabel/.test(agentPanelSource), "Agent Panel should let export/video primary tasks replace the selected-shot scope in the bottom composer");
  assert(/const displayedSelectionChips = workflow && preparedSelectionChips\.length \? preparedSelectionChips : liveSelectionChips/.test(agentPanelSource), "Agent Panel should keep selected-shot chips visible while video/export is the current primary task");
  assert(/<span>\{exportResultIsPrimary \|\| videoResultIsPrimary \? "当前任务" : hasActiveSelection \? "当前选择" : "怎么用"\}<\/span>/.test(agentPanelSource), "Agent Panel should label queued video or export as the current task, not the current selection");
  assert(/创作者路径/.test(agentPanelSource), "Agent Panel should label the default creator path");
  assert(/描述修改[\s\S]*生成计划[\s\S]*确认应用/.test(agentPanelSource), "Agent Panel should expose the simplified creator path");
  assert(/修改计划详情/.test(agentPanelSource), "Agent Panel should keep staged plan details behind disclosure");
  assert(/故事 \/ 镜头 \/ 复核/.test(agentPanelSource), "Agent Panel should name staged plan write targets in user copy");
  assert(
    /等待写入项目事实|已加入项目计划|已写入项目/.test(agentPanelContractSource),
    "Agent Panel confirmation receipt should expose pending project plan write status",
  );
  assert(
    /已准备写入|已加入项目计划|已写入项目/.test(agentPanelContractSource),
    "Agent Panel staged commit receipt should expose creator-facing ready-to-write copy",
  );
  assert(/stageProjectFactsForCommit/.test(agentPanelContractSource), "Agent Panel confirmation should use staged project facts commit API");
  assert(/providerCalled\s*===\s*false/.test(agentPanelContractSource) || /providerCalled/.test(agentPanelContractSource), "Agent Panel source should preserve provider-called false contract in runtime projections");
  assert(!/real-demo-005/.test(`${appSource}\n${stylesSource}`), "app/styles should not retain 005 demo class names");
}


assertCreatorPanelContract();

const currentEndpoint = "/api/runtime/projects/current/real-chain/status";
const round5StrictEditReturnEndpoint = "/api/runtime/projects/current/round5/strict-edit/return";
assert(
  projectRound5StrictEditReturnEndpoint === round5StrictEditReturnEndpoint,
  "formal runtime client must expose the Round 5 strict-edit return endpoint",
);
const queryPath = projectRuntimeRequestPath(currentEndpoint, {
  projectId: "最后一班星图",
  projectRoot: "/Users/lichenhao/Desktop/Vibe Director/runtime-tests/full_generation_10shot_two_act_20260429",
});
assert(queryPath.includes(`${currentEndpoint}?`), "current project requests should keep the endpoint and append request identity");
assert(queryPath.includes("projectRoot=") && queryPath.includes("projectId="), "current project requests should carry project id/root query params");
assert(
  projectRuntimeRequestPath(projectRound5StrictEditReturnEndpoint, {
    projectId: "round5_zero_planning_anime_signal",
    projectRoot: "real-test-sandbox/round5-zero-project-planning-anime/runs/run-2026-05-09T11-09-28-642Z",
  }).includes(`${round5StrictEditReturnEndpoint}?`),
  "Round 5 strict-edit return requests should keep the current-project endpoint and append request identity",
);

function currentProjectBindingResponse(project) {
  return {
    ok: true,
    status: "bound",
    currentProject: {
      bound: true,
      bindingPath: ".vibe/current-project-binding.json",
      binding: {
        schemaVersion: "vibe_core_current_project_binding_v1",
        projectRoot: project.projectRoot,
        projectRootRelativePath: project.projectRoot,
        projectVibeRelativePath: `${project.projectRoot}/project/project.vibe`,
        projectId: project.projectId,
        displayName: project.title,
        selectedAt: "2026-05-08T00:00:00.000Z",
      },
      project: {
        projectId: project.projectId,
        projectRoot: project.projectRoot,
        projectVibePath: `${project.projectRoot}/project/project.vibe`,
        title: project.title,
      },
      projectRoot: project.projectRoot,
      projectRootRelativePath: project.projectRoot,
      projectVibeRelativePath: `${project.projectRoot}/project/project.vibe`,
    },
  };
}

const boundBinding = deriveCurrentProjectBindingStatus({
  ...currentProjectBindingResponse({
    projectId: "real-demo-e2e-004",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004",
    title: "004 当前项目",
  }),
});
assert(boundBinding.status === "bound", "bound current project status should parse");
assert(boundBinding.projectTitle === "004 当前项目", "bound current project title should parse");
assert(currentProjectBindingIdentity(boundBinding)?.projectId === "real-demo-e2e-004", "bound identity should include project id from currentProject.project");
assert(currentProjectBindingIdentity(boundBinding)?.projectRoot?.endsWith("/004"), "bound identity should come from current binding");

const binding005 = deriveCurrentProjectBindingStatus({
  ...currentProjectBindingResponse({
    projectId: "real-demo-e2e-005",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
    title: "005 当前项目",
  }),
});

const unboundBinding = deriveCurrentProjectBindingStatus({ status: "unbound" });
assert(unboundBinding.status === "unbound", "unbound current project status should parse");
assert(!currentProjectBindingIdentity(unboundBinding), "unbound current project must not produce an identity");
assertProductCopy(unboundBinding.message);

const currentChoices = deriveCurrentProjectChoices({
  ok: true,
  choices: [
    { projectRoot: "real-test-sandbox/real-demo-e2e/004-image2-start-frames", displayName: "项目 004", projectId: "real_demo_e2e_004_image2_start_frames", status: "当前" },
    { projectRoot: "/Users/lichenhao/Desktop/vibe core/absolute-leak", displayName: "不应显示" },
  ],
});
assert(currentChoices.length === 1, "recent project choices should hide absolute paths");
assert(currentChoices[0].displayName === "项目 004", "recent project choices should preserve product display names");
assert(currentChoices[0].projectRoot.includes("004-image2-start-frames"), "recent project choices should remain selectable");

const stale005Payload = {
  schemaVersion: "current_project_real_chain_status.v1",
  project: {
    projectId: "real-demo-e2e-005",
    runId: "real_demo_e2e_005",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
  },
  status: "preview_ready_with_review",
  previewStatus: "preview_ready_with_review",
  productionStatus: "needs_review",
  returnedImageCount: 8,
  totalPlannedImages: 8,
  needsReviewCount: 2,
  reviewShotIds: ["S07", "S08"],
  previewItems: [
    { shotId: "S07", order: 7, imageUrl: "/files/S07.png", reviewRequired: true },
    { shotId: "S08", order: 8, imageUrl: "/files/S08.png", reviewRequired: true },
  ],
  providerCalled: false,
  prepareRan: false,
};

const workbenchFacts004 = {
  schemaVersion: "vibe_core_current_project_workbench_facts_v1",
  source: "current_project_files",
  project: {
    projectId: "real-demo-e2e-004",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004",
    projectVibePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/project/project.vibe",
  },
  projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004",
  projectVibePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/project/project.vibe",
  sourceIndex: {
    present: true,
    readable: true,
    path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/project/source_index.json",
    sourceIndexHash: "sha256:004",
    refs: ["story_flow.json", "visual_memory.json"],
  },
  storyFlow: {
    present: true,
    readable: true,
    path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/project/story_flow.json",
    shotCount: 2,
    sectionCount: 1,
    sections: [{ id: "scene_observatory_archive", label: "Old observatory archive", shotIds: ["S01", "S02"] }],
    shots: [
      { id: "S01", sceneId: "scene_observatory_archive", sectionId: "scene_observatory_archive", title: "Naya enters", storyFunction: "Naya enters the archive.", referenceStrategy: "storyboard_narrative" },
      { id: "S02", sceneId: "scene_observatory_archive", sectionId: "scene_observatory_archive", title: "Naya reads", storyFunction: "Naya reads the coordinate note." },
    ],
  },
  visualMemory: {
    present: true,
    readable: true,
    path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/project/visual_memory.json",
    assetCount: 4,
    assets: [
      { id: "char_naya", type: "character", name: "Naya Chen", status: "locked", path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/assets/generated/naya.png", textConstraints: ["short black bob"], usedByShotIds: ["S01", "S02"], sourceRefs: ["visual_memory.roles:0"] },
      { id: "char_ivo", type: "character", name: "Ivo Mark", status: "candidate", path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/assets/generated/ivo.png", textConstraints: ["dark green raincoat"], usedByShotIds: [], sourceRefs: ["visual_memory.roles:1"] },
      { id: "scene_archive", type: "scene", name: "Old archive", status: "needs_review", path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/assets/generated/archive.png", textConstraints: ["brass star map table"], usedByShotIds: ["S01"], sourceRefs: ["visual_memory.scenes:0"] },
      { id: "style_quiet", type: "style", name: "Quiet sci-fi", status: "rejected", path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/assets/generated/quiet.png", textConstraints: ["low texture"], usedByShotIds: [], sourceRefs: ["visual_memory.style"], rejectedReason: "old style" },
    ],
    summary: { locked: 1, candidate: 1, needsReview: 1, rejected: 1, missing: 0 },
  },
  providerCalled: false,
  prepareRan: false,
  projectVibeWritten: false,
};

const workbenchFacts005 = {
  ...workbenchFacts004,
  project: {
    projectId: "real-demo-e2e-005",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
    projectVibePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/project/project.vibe",
  },
  projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
  projectVibePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/project/project.vibe",
  storyFlow: {
    ...workbenchFacts004.storyFlow,
    shots: [
      { id: "S07", sceneId: "scene_service_tunnel", sectionId: "scene_service_tunnel", title: "Door opens", storyFunction: "Mika and Ren stop at the cold stairwell." },
      { id: "S08", sceneId: "scene_rooftop_array", sectionId: "scene_rooftop_array", title: "Signal", storyFunction: "Mika and Ren face the first signal." },
    ],
    sections: [{ id: "scene_service_tunnel", label: "Rainy tunnel", shotIds: ["S07"] }, { id: "scene_rooftop_array", label: "Rooftop", shotIds: ["S08"] }],
  },
  visualMemory: {
    ...workbenchFacts004.visualMemory,
    assets: [
      { id: "char_mika", type: "character", name: "Mika Aoyama", status: "locked", textConstraints: ["red star hairpin"], usedByShotIds: ["S07", "S08"], sourceRefs: ["visual_memory.roles:0"] },
      { id: "char_ren", type: "character", name: "Ren Kisaragi", status: "locked", textConstraints: ["olive hooded parka"], usedByShotIds: ["S07", "S08"], sourceRefs: ["visual_memory.roles:1"] },
    ],
    assetCount: 2,
    summary: { locked: 2, candidate: 0, needsReview: 0, rejected: 0, missing: 0 },
  },
};

const realChain = deriveProjectRealChainStatus(stale005Payload, "runtime_endpoint");
assert(realChain.uiStatus === "production_needs_review", `real-chain UI status drifted: ${realChain.uiStatus}`);
assert(realChain.returnedImageCount === 8, "real-chain should report returned images");
assert(realChain.needsReviewCount === 2, "real-chain should report review count");
assert(realChain.providerCalled === false, "real-chain status must not imply provider call");
assert(realChain.prepareRan === false, "real-chain status must not imply prepare run");

const jimengQueuedRealChain = deriveProjectRealChainStatus({
  projectId: "jimeng-current",
  projectRoot: "/Users/lichenhao/Desktop/new vibe directing/real-test-sandbox/jimeng-current",
  previewStatus: "preview_ready_with_review",
  productionStatus: "needs_review",
  reviewShotIds: ["MS01"],
  previewItems: [{
    id: "jimeng_video_MS01",
    shotId: "MS01",
    order: 1,
    status: "waiting_for_video",
    videoStatus: "queued",
    submitId: "e2ebfcfa3c6c77d4",
    queuePosition: 2085,
    reviewRequired: true,
    reviewOverlay: true,
  }],
}, "runtime_endpoint");
const jimengPreview = buildCurrentProjectPreviewProjection({
  summary: jimengQueuedRealChain,
  previewItems: jimengQueuedRealChain.previewItems,
});
assert(jimengPreview.queue[0].videoGeneration.status === "queued", "Jimeng preview item should expose queued video status");
assert(jimengPreview.queue[0].videoGeneration.shortSubmitId === "e2ebfcfa", "Jimeng preview item should expose short submit id");
assert(jimengPreview.queue[0].videoGeneration.queuePosition === 2085, "Jimeng preview item should preserve visible position");
assert(/恢复查询/.test(jimengPreview.queue[0].videoGeneration.detail), "Jimeng queued copy should explain resume query");

const relayQueuePreview = buildCurrentProjectPreviewProjection({
  relayQueue: {
    schemaVersion: "0.1.0",
    generatedAt: "2026-06-02T11:46:10.867Z",
    queueId: "relay_test",
    storyboardConfirmed: true,
    status: "running",
    maxConcurrentVideoJobs: 1,
    authorizationPolicy: {
      mode: "storyboard_confirmation_authorizes_serial_relay",
      batchAuthorizationRequired: false,
      perTaskAuthorizationRequired: false,
      reviewStillRequired: true,
      notes: [],
    },
    counts: { total: 2, ready: 1, active: 1, completed: 0, failed: 0, blocked: 0 },
    activeItemIds: ["relay_MS01"],
    nextReadyItemId: "relay_MS02",
    autoSubmitAllowed: true,
    resumeCommands: ["resume relay_MS01"],
    userSummary: "第一段正在即梦排队，完成后再提交第二段。",
    notes: [],
    items: [
      {
        id: "relay_MS01",
        shotId: "MS01",
        title: "霓虹启动",
        status: "submitted",
        modelVersion: "seedance2.0",
        videoResolution: "720p",
        durationSeconds: 4,
        promptPath: "runtime/receipts/MS01_seedance_prompt.md",
        referencePaths: ["runtime/references/MS01_storyboard.png", "runtime/references/car_white.png"],
        submitId: "adde7eb0-c7aa-4348-ada7-a859c24cf55a",
        queueInfo: { position: 5378, status: "Queueing" },
        queuePosition: 5378,
        localMediaPaths: [],
        attemptCount: 1,
        blockers: [],
        notes: [],
      },
      {
        id: "relay_MS02",
        shotId: "MS02",
        title: "弯道擦肩",
        status: "ready",
        modelVersion: "seedance2.0",
        videoResolution: "720p",
        durationSeconds: 4,
        referencePaths: [],
        attemptCount: 0,
        blockers: [],
        notes: [],
      },
    ],
  },
});
assert(relayQueuePreview.queue[0].promptPath === "runtime/receipts/MS01_seedance_prompt.md", "relay queue preview must preserve prompt evidence");
assert(relayQueuePreview.queue[0].referencePaths?.length === 2, "relay queue preview must preserve reference evidence");
assert(relayQueuePreview.queue[0].videoGeneration.status === "queued", "relay queue preview must expose active queued status when provider position is known");
assert(relayQueuePreview.queue[0].videoGeneration.queuePosition === 5378, "relay queue preview must expose refreshed provider queue position");

const realChainMatched = guardProjectRealChainUiStateForCurrentProject(
  { status: realChain.uiStatus, summary: realChain },
  { projectId: "real-demo-e2e-005", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005" },
);
assert(realChainMatched.status === "production_needs_review", "matching real-chain identity should pass through");

for (const [label, identity] of [
  ["004 current identity", { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" }],
  ["same id different root", { projectId: "real-demo-e2e-005", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" }],
  ["same root different id", { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005" }],
  ["id-only weak fallback", { projectId: "real-demo-e2e-005" }],
  ["other current identity", { projectId: "actual-current-project", projectRoot: "/Users/lichenhao/Desktop/some-other-project-root" }],
  ["repo-outside suffix 005 identity", { projectId: "external-005", projectRoot: "/tmp/repo-outside/005" }],
  ["unbound identity", undefined],
]) {
  const guarded = guardProjectRealChainUiStateForCurrentProject(
    { status: realChain.uiStatus, summary: realChain },
    identity,
  );
  assert(guarded.status === "unavailable", `${label} should not receive stale 005 real-chain summary`);
  assert(!guarded.summary, `${label} must not leak stale 005 real-chain summary`);
  assertProductCopy(guarded.message);
}

const image2Payload = {
  schemaVersion: "current_project_image2_batch_prepare_plan.v1",
  projectionKind: "current_project_image2_batch_prepare_plan",
  project: {
    projectId: "real-demo-e2e-005",
    runId: "real_demo_e2e_005",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
  },
  items: [
    { shotId: "S07", queueOrder: 7, blocked: false, referencePaths: [] },
    { shotId: "S08", queueOrder: 8, blocked: false, referencePaths: [] },
  ],
  summary: {
    plannedCount: 2,
    readyCount: 2,
    blockedCount: 0,
    selectedShotIds: ["S07", "S08"],
    nextAction: "复核当前项目状态。",
  },
  ledgerProjection: {
    summary: {
      queued: 2,
      blocked: 0,
      parked: 0,
      completeVerified: 0,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      noFileMutation: true,
      workerSpawnForbidden: true,
      providerCalled: false,
    },
    projections: [],
  },
  providerCalled: false,
  prepareRan: false,
  liveSubmitAllowed: false,
};

const image2Batch = deriveProjectImage2BatchPlanStatus(image2Payload);
assert(image2Batch.uiStatus === "ready_for_review", `image2 batch UI status drifted: ${image2Batch.uiStatus}`);
assert(image2Batch.plannedCount === 2, "image2 batch should preserve planned item count");
assert(image2Batch.providerSubmissionForbidden === true, "image2 batch must forbid provider submission");
assert(image2Batch.noFileMutation === true, "image2 batch must not mutate files");
assert(image2Batch.workerSpawnForbidden === true, "image2 batch must forbid worker spawn");
assert(image2Batch.providerCalled === false, "image2 batch must not call provider");
assert(image2Batch.prepareRan === false, "image2 batch must not run prepare");
assert(image2Batch.liveSubmitAllowed === false, "image2 batch must not allow live submit");

const image2Matched = guardProjectImage2BatchUiStateForCurrentProject(
  { status: image2Batch.uiStatus, summary: image2Batch },
  { projectId: "real-demo-e2e-005", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005" },
);
assert(image2Matched.status === "ready_for_review", "matching Image2 batch identity should pass through");

const image2Mismatch = guardProjectImage2BatchUiStateForCurrentProject(
  { status: image2Batch.uiStatus, summary: image2Batch },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
assert(image2Mismatch.status === "unavailable", "stale 005 Image2 batch summary must be blocked under 004 identity");
assert(!image2Mismatch.summary, "stale 005 Image2 batch summary must not leak under 004 identity");
assertProductCopy(image2Mismatch.message);

const oneShotReadyPayload = {
  status: "ready_to_prepare",
  uiStatus: "ready_to_prepare",
  userLabel: "准备小样包",
  project: {
    projectId: "real-demo-e2e-005",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
  },
  selectedShotId: "S07",
  expectedOutputPath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/image2-start.png",
  providerObservationPath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/provider_observations/image2-start-provider-observation.json",
  semanticQaPath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/semantic_qa/image2-start-semantic-qa.json",
  receipt: undefined,
  watcherProjection: { outputExists: false },
  providerCalled: false,
  liveSubmitAllowed: false,
  projectVibeWritten: false,
  workerSpawnForbidden: true,
  blockers: [],
};

const oneShotPreparePayload = {
  ...oneShotReadyPayload,
  status: "prepared",
  uiStatus: "prepared",
  userLabel: "确认 handoff",
  statePaths: {
    receiptStatePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/state/prepare-receipt.json",
    handoffStatePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/state/handoff-packet.json",
  },
  persistedState: {
    receiptPresent: true,
    handoffPresent: false,
  },
  receipt: {
    receiptId: "image2_one_shot_prepare_real-demo-e2e-005_S07",
    status: "prepared",
    selectedShotId: "S07",
    selectedShotIds: ["S07"],
    imageCount: 1,
    expectedOutputPath: oneShotReadyPayload.expectedOutputPath,
    providerObservationPath: oneShotReadyPayload.providerObservationPath,
    semanticQaPath: oneShotReadyPayload.semanticQaPath,
  },
};

const oneShotConfirmPayload = {
  ...oneShotPreparePayload,
  status: "handoff_prepared",
  uiStatus: "handoff_prepared",
  userLabel: "等待文件",
  persistedState: {
    receiptPresent: true,
    handoffPresent: true,
  },
  handoffPacket: {
    packetId: "handoff_image2_one_shot_prepare_real-demo-e2e-005_S07",
    receiptId: "image2_one_shot_prepare_real-demo-e2e-005_S07",
    status: "ready_for_manual_transport",
    requiresExternalAction: true,
    transportPlan: {
      mode: "manual",
      actualExecutionAllowed: false,
      providerCalled: false,
      liveSubmitAllowed: false,
    },
  },
};

const oneShotTriggerPayload = {
  ...oneShotConfirmPayload,
  status: "trigger_plan_prepared",
  uiStatus: "trigger_plan_prepared",
  userLabel: "等待结果",
  returnSource: "dry_run_projection_only",
  persistedState: {
    receiptPresent: true,
    handoffPresent: true,
    triggerPlanPresent: true,
  },
};

const oneShotPermissionTriggerPayload = {
  ...oneShotTriggerPayload,
  submitPermissionReceiptRequested: true,
  submitPermissionReceiptStatePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/state/submit-permission-receipt.json",
  persistedState: {
    ...oneShotTriggerPayload.persistedState,
    submitPermissionReceiptPresent: true,
    submitPermissionReceiptStatePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/state/submit-permission-receipt.json",
  },
  submitPermissionReceipt: {
    receiptId: "submit_permission_image2_one_shot_prepare_real-demo-e2e-005_S07",
    handoffId: "handoff_image2_one_shot_prepare_real-demo-e2e-005_S07",
    status: "pending_action_time_confirmation",
    blockers: [],
    credential: {
      credentialRef: "secret-store://providers/openai-image2/default",
      authorizedReferenceOnly: true,
      secretMaterialPresent: false,
      credentialMaterialStored: false,
      credentialMaterialRead: false,
    },
    submitIntent: {
      maxProviderCallsPerReceipt: 1,
      providerSubmitAllowed: 0,
      providerSubmitRequestState: "pending_action_time_confirmation",
    },
    actionTimeConfirmation: {
      required: true,
      userConfirmedAtActionTime: false,
    },
    maxProviderCallsPerReceipt: 1,
  },
};

const oneShotReturnedPayload = {
  ...oneShotConfirmPayload,
  status: "real_provider_returned_needs_review",
  uiStatus: "needs_review",
  userLabel: "需要复核",
  providerRequestId: "provider-request-s07",
  outputSha256: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  hashBoundActual: true,
  providerObservationMode: "actual_provider_call_observed",
  semanticQaStatus: "needs_review",
  returnSource: "actual_provider_return_ingest",
  formalPromotionBlocked: true,
  formalPromotionBlockedReason: "Formal promotion remains blocked until human QA approval after hash-bound provider return.",
  formalPromotionBlockedReasons: ["Formal promotion remains blocked until human QA approval after hash-bound provider return."],
  providerReturnIngested: true,
  externalProviderCallObserved: true,
  actualImage2Triggered: true,
  providerCalled: true,
  watcherProjection: {
    outputExists: true,
    providerRequestId: "provider-request-s07",
    outputSha256: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    hashBoundActual: true,
    providerObservationMode: "actual_provider_call_observed",
    semanticQaStatus: "needs_review",
    returnSource: "actual_provider_return_ingest",
  },
  previewProjection: {
    status: "needs_review",
    reviewRequired: true,
    imageUrl: "/api/runtime/files?path=runtime-tests/005/real-trigger-one-shot/S07/image2-start.png",
    providerCalled: true,
  },
};

const persistedOneShotPrepareSummary = deriveProjectImage2OneShotStatus(oneShotPreparePayload);
assert(persistedOneShotPrepareSummary.uiStatus === "prepared", "persisted one-shot receipt status should display prepared");
assert(persistedOneShotPrepareSummary.userLabel === "确认 handoff", "persisted one-shot receipt should keep confirm copy");
assert(persistedOneShotPrepareSummary.receipt?.selectedShotId === "S07", "persisted one-shot receipt should remain available to helpers");

const persistedOneShotHandoffSummary = deriveProjectImage2OneShotStatus(oneShotConfirmPayload);
assert(persistedOneShotHandoffSummary.uiStatus === "handoff_prepared", "persisted one-shot handoff status should display handoff prepared");
assert(persistedOneShotHandoffSummary.userLabel === "等待文件", "persisted one-shot handoff should keep waiting-file copy");

const persistedOneShotPermissionSummary = deriveProjectImage2OneShotStatus(oneShotPermissionTriggerPayload);
assert(persistedOneShotPermissionSummary.submitPermissionReceiptRequested === true, "persisted one-shot permission receipt should keep requested flag");
assert(persistedOneShotPermissionSummary.submitPermissionReceiptPresent === true, "persisted one-shot permission receipt should keep present flag");
assert(persistedOneShotPermissionSummary.submitPermissionReceipt?.status === "pending_action_time_confirmation", "persisted one-shot permission receipt should keep status");
assert(persistedOneShotPermissionSummary.submitPermissionReceiptStatePath?.endsWith("submit-permission-receipt.json"), "persisted one-shot permission receipt should keep state path");
assert(persistedOneShotPermissionSummary.credentialRef === "secret-store://providers/openai-image2/default", "persisted one-shot permission receipt should keep credentialRef");
assert(persistedOneShotPermissionSummary.maxProviderCallsPerReceipt === 1, "persisted one-shot permission receipt should keep max call cap");

const persistedOneShotReturnedSummary = deriveProjectImage2OneShotStatus(oneShotReturnedPayload);
assert(persistedOneShotReturnedSummary.uiStatus === "needs_review", "persisted one-shot return should display needs_review");
assert(persistedOneShotReturnedSummary.providerRequestId === "provider-request-s07", "persisted one-shot return should keep providerRequestId");
assert(persistedOneShotReturnedSummary.outputSha256 === oneShotReturnedPayload.outputSha256, "persisted one-shot return should keep output hash");
assert(persistedOneShotReturnedSummary.hashBoundActual === true, "persisted one-shot return should keep hash-bound fact");
assert(persistedOneShotReturnedSummary.providerObservationMode === "actual_provider_call_observed", "persisted one-shot return should keep observation mode");
assert(persistedOneShotReturnedSummary.semanticQaStatus === "needs_review", "persisted one-shot return should keep semantic QA status");
assert(persistedOneShotReturnedSummary.returnSource === "actual_provider_return_ingest", "persisted one-shot return should keep return source");
assert(persistedOneShotReturnedSummary.formalPromotionBlockedReason, "persisted one-shot return should keep promotion blocker reason");

const persistedOneShotHandoffGuard = guardProjectImage2OneShotUiStateForCurrentProject(
  { status: persistedOneShotHandoffSummary.uiStatus, summary: persistedOneShotHandoffSummary, receipt: persistedOneShotHandoffSummary.receipt },
  { projectId: "real-demo-e2e-005", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005" },
);
assert(persistedOneShotHandoffGuard.status === "handoff_prepared", "persisted one-shot handoff should pass current-project guard");

const runtimeFetchCalls = [];
const previousWindow = globalThis.window;
const previousFetch = globalThis.fetch;
const project005RuntimeIdentity = {
  projectId: "real-demo-e2e-005",
  projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
};
const runtimeEndpointPayloads = new Map([
  [`GET ${projectCurrentBindingEndpoint}`, currentProjectBindingResponse({
    projectId: project005RuntimeIdentity.projectId,
    projectRoot: project005RuntimeIdentity.projectRoot,
    title: "005 当前项目",
  })],
  [`GET ${projectCurrentChoicesEndpoint}`, {
    ok: true,
    choices: [
      {
        projectRoot: "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames",
        displayName: "005 当前项目",
        projectId: project005RuntimeIdentity.projectId,
        status: "当前",
      },
    ],
    providerCalled: false,
    prepareRan: false,
    projectVibeWritten: false,
  }],
  [`POST ${projectCurrentSelectEndpoint}`, currentProjectBindingResponse({
    projectId: project005RuntimeIdentity.projectId,
    projectRoot: project005RuntimeIdentity.projectRoot,
    title: "005 当前项目",
  })],
  [`GET ${projectRealChainStatusEndpoint}`, {
    ...stale005Payload,
    workbenchFacts: workbenchFacts005,
    projectVibeWritten: false,
  }],
  [`POST ${projectRealChainRunCheckEndpoint}`, {
    ...stale005Payload,
    workbenchFacts: workbenchFacts005,
    projectVibeWritten: false,
    command: {
      mode: "read_only_projection_check",
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
    },
  }],
  [`GET ${projectImage2BatchPlanEndpoint}`, {
    ...image2Payload,
    projectVibeWritten: false,
  }],
  [`POST ${projectImage2BatchRunCheckEndpoint}`, {
    ...image2Payload,
    projectVibeWritten: false,
    command: {
      mode: "read_only_image2_batch_plan_check",
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
    },
  }],
  [`GET ${projectImage2OneShotStatusEndpoint}`, oneShotReadyPayload],
  [`POST ${projectImage2OneShotPrepareEndpoint}`, oneShotPreparePayload],
  [`POST ${projectImage2OneShotConfirmEndpoint}`, oneShotConfirmPayload],
  [`POST ${projectImage2OneShotExecuteReturnEndpoint}`, oneShotReturnedPayload],
]);

try {
  globalThis.window = {
    __VIBE_RUNTIME_API_BASE_URL__: "http://runtime.test",
    location: { hostname: "127.0.0.1", port: "5173" },
  };
  globalThis.fetch = async (url, init = {}) => {
    const requestUrl = new URL(String(url), "http://runtime.test");
    const method = init.method || "GET";
    runtimeFetchCalls.push({ method, path: requestUrl.pathname, search: requestUrl.search, body: init.body });
    const payload = method === "POST" && requestUrl.pathname === projectImage2OneShotPrepareTriggerEndpoint
      ? (JSON.parse(String(init.body || "{}")).submitPermissionReceiptRequired === true ? oneShotPermissionTriggerPayload : oneShotTriggerPayload)
      : runtimeEndpointPayloads.get(`${method} ${requestUrl.pathname}`);
    assert(payload, `unexpected runtime request ${method} ${requestUrl.pathname}`);
    return {
      ok: true,
      status: 200,
      json: async () => payload,
    };
  };

  const loadedBinding = await loadCurrentProjectBindingStatus();
  assert(loadedBinding.status === "bound", "frontend should load current project binding from runtime");
  const loadedChoices = await loadCurrentProjectChoices();
  assert(loadedChoices[0]?.displayName === "005 当前项目", "frontend should load recent project choices");
  const selectedBinding = await selectCurrentProjectBinding({
    projectRoot: project005RuntimeIdentity.projectRoot,
    projectId: project005RuntimeIdentity.projectId,
    displayName: "005 当前项目",
  });
  assert(selectedBinding.status === "bound", "frontend should connect project through runtime select");

  const loadedStatus = await loadProjectRealChainStatus(project005RuntimeIdentity);
  const loadedStatusRequest = runtimeFetchCalls.find((call) => call.method === "GET" && call.path === projectRealChainStatusEndpoint);
  assert(loadedStatusRequest?.search.includes("projectRoot=") && loadedStatusRequest.search.includes("projectId="), "current project status must request the selected project identity instead of relying on global binding");
  assert(loadedStatus.status === "production_needs_review", "sync status should load preview/production state");
  assert(loadedStatus.summary?.returnedImageCount === 8, "sync status should show returned image count");
  assert(loadedStatus.summary?.needsReviewCount === 2, "sync status should show needs-review count");
  assert(loadedStatus.summary?.providerCalled === false, "sync status must preserve providerCalled=false");
  assert(loadedStatus.summary?.prepareRan === false, "sync status must preserve prepareRan=false");
  assert(loadedStatus.summary?.workbenchFacts?.projectVibeWritten === false, "sync status must preserve projectVibeWritten=false");

  const checkedStatus = await runProjectRealChainCheck(project005RuntimeIdentity);
  const checkedStatusRequest = runtimeFetchCalls.find((call) => call.method === "POST" && call.path === projectRealChainRunCheckEndpoint);
  assert(checkedStatusRequest?.search.includes("projectRoot=") && checkedStatusRequest.search.includes("projectId="), "current project run-check must request the selected project identity instead of relying on global binding");
  assert(checkedStatus.status === "production_needs_review", "sync status button should call real-chain run-check");
  assert(checkedStatus.summary?.providerCalled === false, "real-chain run-check must not call provider");
  assert(checkedStatus.summary?.prepareRan === false, "real-chain run-check must not run prepare");
  assert(checkedStatus.summary?.workbenchFacts?.projectVibeWritten === false, "real-chain run-check must not write project.vibe");

  const loadedPlan = await loadProjectImage2BatchPlan(project005RuntimeIdentity);
  assert(loadedPlan.status === "ready_for_review", "review panel should load Image2 batch plan");
  assert(loadedPlan.summary?.providerCalled === false, "Image2 batch plan must preserve providerCalled=false");
  assert(loadedPlan.summary?.prepareRan === false, "Image2 batch plan must preserve prepareRan=false");
  assert(loadedPlan.summary?.liveSubmitAllowed === false, "Image2 batch plan must preserve liveSubmitAllowed=false");
  assert(loadedPlan.summary?.workerSpawnForbidden === true, "Image2 batch plan must preserve workerSpawnForbidden=true");

  const checkedPlan = await runProjectImage2BatchCheck(project005RuntimeIdentity);
  assert(checkedPlan.status === "ready_for_review", "review check button should call Image2 batch run-check");
  assert(checkedPlan.summary?.providerCalled === false, "Image2 batch run-check must not call provider");
  assert(checkedPlan.summary?.prepareRan === false, "Image2 batch run-check must not run prepare");
  assert(checkedPlan.summary?.liveSubmitAllowed === false, "Image2 batch run-check must preserve liveSubmitAllowed=false");
  assert(checkedPlan.summary?.workerSpawnForbidden === true, "Image2 batch run-check must preserve workerSpawnForbidden=true");

  const oneShotStatus = await loadProjectImage2OneShotStatus(project005RuntimeIdentity, "S07");
  assert(oneShotStatus.status === "ready_to_prepare", "one-shot status should expose sample entry");
  assert(oneShotStatus.summary?.userLabel === "准备小样包", "one-shot status should use creator-facing prepare copy");
  assert(oneShotStatus.summary?.providerCalled === false, "one-shot status must not call provider");
  assert(oneShotStatus.summary?.projectVibeWritten === false, "one-shot status must not write project.vibe");
  assert(oneShotStatus.summary?.workerSpawnForbidden === true, "one-shot status must forbid worker spawn");

  const preparedOneShot = await prepareProjectImage2OneShot(project005RuntimeIdentity, "S07");
  assert(preparedOneShot.status === "prepared", "one-shot prepare should create a pending confirmation receipt");
  assert(preparedOneShot.receipt?.selectedShotId === "S07", "one-shot prepare should preserve selected shot");
  assert(preparedOneShot.summary?.userLabel === "确认 handoff", "one-shot prepare should use creator-facing confirm copy");
  assert(preparedOneShot.summary?.providerCalled === false, "one-shot prepare must not call provider");
  assert(preparedOneShot.summary?.liveSubmitAllowed === false, "one-shot prepare must not allow live submit");
  assert(preparedOneShot.summary?.projectVibeWritten === false, "one-shot prepare must not write project.vibe");
  assert(preparedOneShot.summary?.workerSpawnForbidden === true, "one-shot prepare must forbid worker spawn");

  const confirmedOneShot = await confirmProjectImage2OneShot(project005RuntimeIdentity, preparedOneShot.receipt);
  assert(confirmedOneShot.status === "handoff_prepared", "one-shot confirm should prepare external handoff only");
  assert(confirmedOneShot.summary?.userLabel === "等待文件", "one-shot confirm should use waiting-file copy");
  assert(confirmedOneShot.summary?.providerCalled === false, "one-shot confirm must not call provider");
  assert(confirmedOneShot.summary?.liveSubmitAllowed === false, "one-shot confirm must not allow live submit");
  assert(confirmedOneShot.summary?.projectVibeWritten === false, "one-shot confirm must not write project.vibe");
  assert(confirmedOneShot.summary?.workerSpawnForbidden === true, "one-shot confirm must forbid worker spawn");

  const triggerPreparedOneShot = await prepareProjectImage2OneShotTrigger(project005RuntimeIdentity, confirmedOneShot.receipt);
  assert(triggerPreparedOneShot.status === "trigger_plan_prepared", "one-shot trigger helper should prepare app-server handoff");
  assert(triggerPreparedOneShot.summary?.userLabel === "等待结果", "one-shot trigger helper should use waiting return copy");
  assert(triggerPreparedOneShot.summary?.providerCalled === false, "one-shot trigger helper must not call provider");
  const defaultTriggerCall = runtimeFetchCalls
    .filter((item) => item.method === "POST" && item.path === projectImage2OneShotPrepareTriggerEndpoint)
    .at(-1);
  const defaultTriggerBody = JSON.parse(String(defaultTriggerCall?.body || "{}"));
  assert(!Object.prototype.hasOwnProperty.call(defaultTriggerBody, "submitPermissionReceiptRequired"), "default trigger helper must not request permission receipt");
  assert(!Object.prototype.hasOwnProperty.call(defaultTriggerBody, "credentialRef"), "default trigger helper must not send credentialRef");

  const permissionPreparedOneShot = await prepareProjectImage2OneShotPermissionReceipt(
    project005RuntimeIdentity,
    confirmedOneShot.receipt,
    "secret-store://providers/openai-image2/default",
  );
  assert(permissionPreparedOneShot.status === "trigger_plan_prepared", "permission receipt helper should prepare trigger plan");
  assert(permissionPreparedOneShot.summary?.submitPermissionReceiptPresent === true, "permission receipt helper should surface persisted receipt");
  assert(permissionPreparedOneShot.summary?.submitPermissionReceipt?.status === "pending_action_time_confirmation", "permission receipt helper should surface pending action confirmation");
  const permissionTriggerCall = runtimeFetchCalls
    .filter((item) => item.method === "POST" && item.path === projectImage2OneShotPrepareTriggerEndpoint)
    .at(-1);
  const permissionTriggerBody = JSON.parse(String(permissionTriggerCall?.body || "{}"));
  assert(permissionTriggerBody.submitPermissionReceiptRequired === true, "permission helper body should request permission receipt");
  assert(permissionTriggerBody.credentialRef === "secret-store://providers/openai-image2/default", "permission helper body should carry opaque credentialRef");
  assert(permissionTriggerBody.maxProviderCallsPerReceipt === 1, "permission helper body should pin maxProviderCallsPerReceipt");
  assert(permissionTriggerBody.actionTimeConfirmation?.required === true, "permission helper body should require action-time confirmation");
  assert(permissionTriggerBody.actionTimeConfirmation?.userConfirmedAtActionTime === false, "permission helper body should not mark action-time confirmation done");
  assert(Array.isArray(permissionTriggerBody.expectedOutputs) && permissionTriggerBody.expectedOutputs.length === 1, "permission helper body should include one expected output");
  assert(permissionTriggerBody.expectedOutputs[0].shotId === "S07", "permission helper expected output should keep shotId");
  assert(permissionTriggerBody.expectedOutputs[0].expectedOutputPath === confirmedOneShot.receipt.expectedOutputPath, "permission helper expected output should keep output path");
  assert(permissionTriggerBody.expectedOutputs[0].providerObservationPath === confirmedOneShot.receipt.providerObservationPath, "permission helper expected output should keep observation path");
  assert(permissionTriggerBody.expectedOutputs[0].semanticQaPath === confirmedOneShot.receipt.semanticQaPath, "permission helper expected output should keep QA path");

  const returnedOneShot = await executeReturnedProjectImage2OneShot(project005RuntimeIdentity, triggerPreparedOneShot.receipt);
  assert(returnedOneShot.status === "needs_review", "one-shot execute-return helper should surface needs_review");
  assert(returnedOneShot.summary?.providerRequestId === "provider-request-s07", "one-shot execute-return should preserve providerRequestId");
  assert(returnedOneShot.summary?.outputSha256 === oneShotReturnedPayload.outputSha256, "one-shot execute-return should preserve output hash");
  assert(returnedOneShot.summary?.hashBoundActual === true, "one-shot execute-return should preserve hash-bound fact");
  assert(returnedOneShot.summary?.semanticQaStatus === "needs_review", "one-shot execute-return should preserve semantic QA status");
  assert(returnedOneShot.summary?.returnSource === "actual_provider_return_ingest", "one-shot execute-return should preserve return source");

  for (const [method, endpoint] of [
    ["GET", projectCurrentBindingEndpoint],
    ["GET", projectCurrentChoicesEndpoint],
    ["POST", projectCurrentSelectEndpoint],
    ["GET", projectImage2BatchPlanEndpoint],
    ["POST", projectImage2BatchRunCheckEndpoint],
  ]) {
    const call = runtimeFetchCalls.find((item) => item.method === method && item.path === endpoint);
    assert(call, `frontend should call ${method} ${endpoint}`);
    assert(!call.search.includes("projectRoot=") && !call.search.includes("projectId="), `${method} ${endpoint} should not carry project query params`);
  }
  for (const [method, endpoint] of [
    ["GET", projectRealChainStatusEndpoint],
    ["POST", projectRealChainRunCheckEndpoint],
  ]) {
    const call = runtimeFetchCalls.find((item) => item.method === method && item.path === endpoint);
    assert(call, `frontend should call ${method} ${endpoint}`);
    assert(call.search.includes("projectRoot=") && call.search.includes("projectId="), `${method} ${endpoint} should carry selected project query params`);
  }
  for (const [method, endpoint] of [
    ["GET", projectImage2OneShotStatusEndpoint],
    ["POST", projectImage2OneShotPrepareEndpoint],
    ["POST", projectImage2OneShotConfirmEndpoint],
    ["POST", projectImage2OneShotPrepareTriggerEndpoint],
    ["POST", projectImage2OneShotExecuteReturnEndpoint],
  ]) {
    const call = runtimeFetchCalls.find((item) => item.method === method && item.path === endpoint);
    assert(call, `frontend should call ${method} ${endpoint}`);
    assert(call.search.includes("projectRoot=") || call.search.includes("projectId="), `${method} ${endpoint} should carry project identity query params`);
  }
  const selectCall = runtimeFetchCalls.find((item) => item.method === "POST" && item.path === projectCurrentSelectEndpoint);
  assert(selectCall?.body && JSON.parse(String(selectCall.body)).projectRoot === project005RuntimeIdentity.projectRoot, "connect project should send selected projectRoot");
} finally {
  globalThis.window = previousWindow;
  globalThis.fetch = previousFetch;
}

const current004RealChainPayload = {
  ...stale005Payload,
  project: {
    projectId: "real-demo-e2e-004",
    runId: "real_demo_e2e_004",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004",
  },
  returnedImageCount: 1,
  totalPlannedImages: 1,
  reviewShotIds: ["S01"],
  previewItems: [
    { shotId: "S01", order: 1, imageUrl: "/files/004-S01.png", reviewRequired: false },
  ],
};
const current004RealChain = deriveProjectRealChainStatus(current004RealChainPayload, "runtime_endpoint");
const guarded004RealChain = guardProjectRealChainUiStateForCurrentProject(
  { status: current004RealChain.uiStatus, summary: current004RealChain },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
const workbench004 = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: guarded004RealChain,
  image2BatchState: image2Mismatch,
  selectedShotId: "S07",
  selectedShotIds: ["S07"],
});
assert(workbench004.source === currentProjectWorkbenchProjectionSource, "workbench projection source should be explicit");
assert(workbench004.identity.projectId === "real-demo-e2e-004", "workbench identity should bind to selected 004");
assert(workbench004.identity.projectRoot.endsWith("/004"), "workbench root should bind to selected 004");
assert(workbench004.shots.map((shot) => shot.id).join(",") === "S01", "Story Flow should come from selected 004 preview items");
assert(workbench004.selectedScope.defaultShotId === "S01", "selected scope should fail closed to the current 004 shot when stale S07 is selected");
assert(workbench004.assets.readOnlyProjection === true, "Asset Library should be a read-only current project projection until visual memory is present");
assert(/当前项目资产缺参考|等待生成或锁定|等待生成或复核/.test(workbench004.assets.detail), "Asset Library should show current-project pending asset copy");
assert(!JSON.stringify(workbench004).includes("/005"), "004 workbench projection must not include stale 005 root");

const current004FactsRealChain = deriveProjectRealChainStatus({
  ...current004RealChainPayload,
  workbenchFacts: workbenchFacts004,
}, "runtime_endpoint");
const guarded004FactsRealChain = guardProjectRealChainUiStateForCurrentProject(
  { status: current004FactsRealChain.uiStatus, summary: current004FactsRealChain },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
const workbench004Facts = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: guarded004FactsRealChain,
  image2BatchState: image2Mismatch,
  selectedShotId: "S07",
});
assert(workbench004Facts.shots.map((shot) => shot.id).join(",") === "S01,S02", "Story Flow should prefer 004 story_flow facts over preview fallback");
assert(workbench004Facts.shots[0]?.referenceStrategy === "storyboard_narrative", "Story Flow projection should preserve the AI-selected reference mode");
assert(workbench004Facts.story.fallbackUsed === false, "story_flow facts should not be marked as fallback");
assert(workbench004Facts.story.sectionCount === 1, "story_flow sections should be preserved");
assert(workbench004Facts.assets.readOnlyProjection === false, "visual_memory facts should unlock a populated Asset Library projection");
assert(workbench004Facts.assetFacts.map((asset) => asset.id).join(",") === "char_naya,char_ivo,scene_archive,style_quiet", "Asset Library should prefer 004 visual_memory facts");
assert(workbench004Facts.assets.lockedCount === 1, "locked asset count should come from visual_memory");
assert(workbench004Facts.assets.candidateCount === 1, "candidate asset count should be preserved");
const relativeRoot = ".vibe-runtime/projects/current-ui-path-test";
const rootPrefixedFacts = {
  ...workbenchFacts004,
  project: {
    ...workbenchFacts004.project,
    projectRoot: relativeRoot,
  },
  projectRoot: relativeRoot,
  visualMemory: {
    ...workbenchFacts004.visualMemory,
    assets: [
      {
        id: "char_naya",
        type: "character",
        name: "Naya Chen",
        status: "needs_review",
        path: `${relativeRoot}/assets/generated/naya.png`,
        textConstraints: ["short black bob"],
        usedByShotIds: ["S01"],
        sourceRefs: ["visual_memory.roles:0"],
      },
    ],
    assetCount: 1,
    summary: { locked: 0, candidate: 0, needsReview: 1, rejected: 0, missing: 0 },
  },
  storyFlow: {
    ...workbenchFacts004.storyFlow,
    shots: [{
      ...workbenchFacts004.storyFlow.shots[0],
      characterGuidance: ["Naya Chen"],
    }],
  },
};
const rootPrefixedProjection = buildCurrentProjectWorkbenchProjection({
  binding: { status: "bound", projectId: "current-ui-path-test", projectRoot: relativeRoot },
  realChainState: {
    status: "preview_ready_with_review",
    summary: deriveProjectRealChainStatus({ status: "unavailable", workbenchFacts: rootPrefixedFacts }, "runtime_endpoint"),
  },
  image2BatchState: image2Mismatch,
  selectedShotId: "S01",
});
const projectedRootPrefix = applyCurrentProjectWorkbenchProjectionToRuntimeState({
  generatedAt: "2026-05-25T00:00:00.000Z",
  project: { title: "", root: "", sourceTask: "", importedAt: "", state: "", metrics: {} },
  sourceIndex: { projectId: "", projectVersion: "", sourceIndexHash: "", currentProductionBibleId: "", currentStoryFlowId: "", currentVisualMemoryId: "", currentPromptHashes: {}, lockedReferenceIds: [], candidateReferenceIds: [], rejectedReferenceIds: [], failedReferenceIds: [], confirmedDecisionIds: [], staleArtifactIds: [], updatedAt: "" },
  sourceIndexSummary: { projectId: "", lockedReferenceCount: 0, candidateReferenceCount: 0, rejectedReferenceCount: 0, failedReferenceCount: 0, staleArtifactCount: 0, blockingReferenceCount: 0, isProductionReady: false, updatedAt: "" },
  storyFlow: { sections: [], shots: [] },
  visualMemory: { summary: { total: 0, existing: 0, locked: 0, needsReview: 0, missing: 0, byType: [] }, assets: [] },
  taskRuns: { jobs: [], runs: [], taskViews: [], queueSummary: { total: 0, ready: 0, blocked: 0, parked: 0, succeeded: 0, missingOutputs: 0 }, preflightSummary: { blocked: 0, warnings: 0, blockers: [] } },
  manifestMatches: { summary: { complete: 0, present: 0, missing: 0, recoverable: 0 }, reports: [] },
  imagePipeline: { promptPlans: [], promptConflictReports: [], assetReadinessReports: [], imageTaskPlans: [], image2AdapterRequests: [], watcherEvents: [], generationHealthReports: [], qaPromotionReports: [], imageReferenceTransports: [], imageReferenceDeliveryReceipts: [] },
  previewEvents: [],
}, rootPrefixedProjection);
assert(projectedRootPrefix.visualMemory.assets[0]?.path === `${relativeRoot}/assets/generated/naya.png`, "root-prefixed visual memory media paths must not be prefixed twice");
assert(projectedRootPrefix.storyFlow.shots[0]?.startFrame === `${relativeRoot}/assets/generated/naya.png`, "root-prefixed shot references should resolve to loadable media paths");
assert(!JSON.stringify(projectedRootPrefix).includes(`${relativeRoot}/${relativeRoot}`), "current project media projection must never duplicate project root segments");
const focusPropFacts = {
  ...rootPrefixedFacts,
  visualMemory: {
    ...rootPrefixedFacts.visualMemory,
    assets: [
      {
        id: "old_book",
        type: "prop",
        name: "旧书",
        status: "locked",
        path: `${relativeRoot}/assets/generated/old_book.png`,
        usedByShotIds: ["S02"],
        sourceRefs: ["visual_memory.props:0"],
      },
      {
        id: "glowing_ticket",
        type: "prop",
        name: "发光车票",
        status: "locked",
        path: `${relativeRoot}/assets/generated/glowing_ticket.png`,
        usedByShotIds: ["S02"],
        sourceRefs: ["visual_memory.props:1"],
      },
    ],
    assetCount: 2,
    summary: { locked: 2, candidate: 0, needsReview: 0, rejected: 0, missing: 0 },
  },
  storyFlow: {
    ...rootPrefixedFacts.storyFlow,
    shots: [{
      ...rootPrefixedFacts.storyFlow.shots[0],
      id: "S02",
      title: "发光车票",
      executionMode: "action_insert",
      primaryAction: "她发现发光车票",
      propGuidance: ["旧书", "发光车票"],
    }],
  },
};
const focusPropProjection = buildCurrentProjectWorkbenchProjection({
  binding: { status: "bound", projectId: "current-ui-focus-prop-test", projectRoot: relativeRoot },
  realChainState: {
    status: "preview_ready_with_review",
    summary: deriveProjectRealChainStatus({ status: "unavailable", workbenchFacts: focusPropFacts }, "runtime_endpoint"),
  },
  image2BatchState: image2Mismatch,
  selectedShotId: "S02",
});
const focusPropRuntimeState = applyCurrentProjectWorkbenchProjectionToRuntimeState({
  generatedAt: "2026-05-25T00:00:00.000Z",
  project: { title: "", root: "", sourceTask: "", importedAt: "", state: "", metrics: {} },
  sourceIndex: { projectId: "", projectVersion: "", sourceIndexHash: "", currentProductionBibleId: "", currentStoryFlowId: "", currentVisualMemoryId: "", currentPromptHashes: {}, lockedReferenceIds: [], candidateReferenceIds: [], rejectedReferenceIds: [], failedReferenceIds: [], confirmedDecisionIds: [], staleArtifactIds: [], updatedAt: "" },
  sourceIndexSummary: { projectId: "", lockedReferenceCount: 0, candidateReferenceCount: 0, rejectedReferenceCount: 0, failedReferenceCount: 0, staleArtifactCount: 0, blockingReferenceCount: 0, isProductionReady: false, updatedAt: "" },
  storyFlow: { sections: [], shots: [] },
  visualMemory: { summary: { total: 0, existing: 0, locked: 0, needsReview: 0, missing: 0, byType: [] }, assets: [] },
  taskRuns: { jobs: [], runs: [], taskViews: [], queueSummary: { total: 0, ready: 0, blocked: 0, parked: 0, succeeded: 0, missingOutputs: 0 }, preflightSummary: { blocked: 0, warnings: 0, blockers: [] } },
  manifestMatches: { summary: { complete: 0, present: 0, missing: 0, recoverable: 0 }, reports: [] },
  imagePipeline: { promptPlans: [], promptConflictReports: [], assetReadinessReports: [], imageTaskPlans: [], image2AdapterRequests: [], watcherEvents: [], generationHealthReports: [], qaPromotionReports: [], imageReferenceTransports: [], imageReferenceDeliveryReceipts: [] },
  previewEvents: [],
}, focusPropProjection);
assert(
  focusPropRuntimeState.storyFlow.shots[0]?.startFrame === `${relativeRoot}/assets/generated/glowing_ticket.png`,
  "action-insert shots should choose the focused prop named by the shot title/action, not the first prop guidance item",
);
const workbench004AssetLibrary = createAssetLibraryFromCurrentProjectWorkbench(workbench004Facts);
const nayaAssetRecord = assetLibraryAssetToRecord(workbench004AssetLibrary.assets.find((asset) => asset.id === "char_naya"));
assert(nayaAssetRecord.path === "assets/generated/naya.png", "current project Asset Library should preserve project-relative media paths");
assert(toMediaSrc(nayaAssetRecord.path)?.includes("/api/runtime/files?path=assets%2Fgenerated%2Fnaya.png"), "current project Asset Library media should load through the runtime file endpoint");
assert(!JSON.stringify(workbench004AssetLibrary).includes("user_selected_import/char_naya"), "current project generated assets must not be redacted as user-selected imports");

const current004FactsOnlyRealChain = deriveProjectRealChainStatus({
  schemaVersion: "current_project_real_chain_status.v1",
  status: "unavailable",
  message: "No video run manifest yet, but workbench facts are available.",
  workbenchFacts: workbenchFacts004,
}, "runtime_endpoint");
assert(current004FactsOnlyRealChain.workbenchFacts?.visualMemory?.assetCount === 4, "workbench-only status should preserve visual_memory facts");
assert(current004FactsOnlyRealChain.projectRoot?.endsWith("/004"), "workbench-only status should derive project root from facts");
const guarded004FactsOnlyRealChain = guardProjectRealChainUiStateForCurrentProject(
  { status: current004FactsOnlyRealChain.uiStatus, summary: current004FactsOnlyRealChain },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
const workbench004FactsOnly = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: guarded004FactsOnlyRealChain,
  image2BatchState: image2Mismatch,
  selectedShotId: "S07",
});
assert(workbench004FactsOnly.assets.readOnlyProjection === false, "workbench-only facts should populate Asset Library even before a video run");
assert(workbench004FactsOnly.assetFacts.map((asset) => asset.id).join(",") === "char_naya,char_ivo,scene_archive,style_quiet", "workbench-only facts should preserve asset projection");
const projectVibeFallbackVisualFacts = {
  ...workbenchFacts004,
  visualMemory: {
    ...workbenchFacts004.visualMemory,
    present: false,
    readable: true,
    fallbackFromProjectVibe: true,
    path: `${workbenchFacts004.projectRoot}/project/visual_memory.json`,
  },
};
const projectVibeFallbackVisualProjection = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: {
    status: "unavailable",
    summary: deriveProjectRealChainStatus({
      status: "unavailable",
      message: "No sidecar visual_memory.json, but Project.vibe assets are readable.",
      workbenchFacts: projectVibeFallbackVisualFacts,
    }, "runtime_endpoint"),
  },
  image2BatchState: image2Mismatch,
  selectedShotId: "S01",
});
assert(projectVibeFallbackVisualProjection.assets.readOnlyProjection === false, "Project.vibe fallback visual memory should populate Asset Library even when sidecar visual_memory.json is absent");
assert(projectVibeFallbackVisualProjection.assetFacts.length === workbenchFacts004.visualMemory.assets.length, "Project.vibe fallback visual memory must keep readable assets");
assert(workbench004Facts.assets.needsReviewCount === 1, "needs_review asset count should be preserved");
assert(workbench004Facts.assets.rejectedCount === 1, "rejected asset count should be preserved");
assert(!JSON.stringify(workbench004Facts).includes("char_mika"), "004 visual_memory facts must not leak 005 assets");

const storyMissingFacts = {
  ...workbenchFacts004,
  storyFlow: { present: false, readable: false, path: "/missing/story_flow.json", shotCount: 0, sectionCount: 0, sections: [], shots: [] },
};
const storyMissingProjection = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: {
    status: guarded004FactsRealChain.status,
    summary: { ...current004FactsRealChain, workbenchFacts: storyMissingFacts },
  },
});
assert(storyMissingProjection.shots.map((shot) => shot.id).join(",") === "S01", "missing story_flow should safely fall back to current preview items");
assert(/待写故事流/.test(storyMissingProjection.story.detail), "missing story_flow should show safe pending copy");

const storyUnreadableFacts = {
  ...workbenchFacts004,
  storyFlow: { present: true, readable: false, path: "/bad/story_flow.json", shotCount: 0, sectionCount: 0, sections: [], shots: [] },
};
const storyUnreadableProjection = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: {
    status: guarded004FactsRealChain.status,
    summary: { ...current004FactsRealChain, workbenchFacts: storyUnreadableFacts },
  },
});
assert(storyUnreadableProjection.shots[0].id === "CURRENT_PROJECT", "unreadable story_flow should fail closed instead of using preview items");
assert(/故事流读取失败/.test(storyUnreadableProjection.story.detail), "unreadable story_flow should expose product-safe failure copy");

const visualMissingFacts = {
  ...workbenchFacts004,
  visualMemory: { present: false, readable: false, path: "/missing/visual_memory.json", assetCount: 0, assets: [], summary: { locked: 0, candidate: 0, needsReview: 0, rejected: 0, missing: 0 } },
};
const visualMissingProjection = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: {
    status: guarded004FactsRealChain.status,
    summary: { ...current004FactsRealChain, workbenchFacts: visualMissingFacts },
  },
});
assert(visualMissingProjection.assets.readOnlyProjection === true, "missing visual_memory should keep read-only fallback");
assert(/当前项目资产缺参考/.test(visualMissingProjection.assets.detail), "missing visual_memory should show safe asset fallback copy");

const emptyCurrentProjectFacts = {
  ...workbenchFacts004,
  project: {
    ...workbenchFacts004.project,
    title: "empty-current-project",
    projectRoot: relativeRoot,
  },
  projectRoot: relativeRoot,
  storyFlow: {
    present: false,
    readable: true,
    path: `${relativeRoot}/project/story_flow.json`,
    fallbackFromProjectVibe: true,
    shotCount: 0,
    sectionCount: 0,
    sections: [],
    shots: [],
  },
  visualMemory: {
    present: false,
    readable: true,
    path: `${relativeRoot}/project/visual_memory.json`,
    fallbackFromProjectVibe: true,
    assetCount: 0,
    assets: [],
    summary: { locked: 0, candidate: 0, needsReview: 0, rejected: 0, missing: 0 },
  },
};
const emptyCurrentProjectProjection = buildCurrentProjectWorkbenchProjection({
  binding: { status: "bound", projectId: "empty-current-project", projectRoot: relativeRoot },
  realChainState: {
    status: "unavailable",
    summary: deriveProjectRealChainStatus({ status: "unavailable", workbenchFacts: emptyCurrentProjectFacts }, "runtime_endpoint"),
  },
});
assert(emptyCurrentProjectProjection.shots.length === 0, "empty readable current projects must not create a fake current-project shot");
assert(emptyCurrentProjectProjection.sections.length === 0, "empty readable current projects must not create a fake story section");
const emptyCurrentRuntimeState = applyCurrentProjectWorkbenchProjectionToRuntimeState(projectedRootPrefix, emptyCurrentProjectProjection);
assert(emptyCurrentRuntimeState.storyFlow.shots.length === 0, "empty current-project projection must clear stale story shots");
assert(emptyCurrentRuntimeState.visualMemory.assets.length === 0, "empty current-project projection must clear stale visual memory assets");

const staleRealChainUnder004 = guardProjectRealChainUiStateForCurrentProject(
  { status: realChain.uiStatus, summary: realChain },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
const staleImage2Under004 = guardProjectImage2BatchUiStateForCurrentProject(
  { status: image2Batch.uiStatus, summary: image2Batch },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
const stale005Under004 = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: staleRealChainUnder004,
  image2BatchState: staleImage2Under004,
  selectedShotId: "S07",
});
assert(stale005Under004.identity.projectId === "real-demo-e2e-004", "stale status must not override selected 004 identity");
assert(stale005Under004.shots[0].id === "CURRENT_PROJECT", "mismatched summaries should fall back to current project placeholder");
assert(/待写故事流/.test(stale005Under004.shots[0].storyFunction), "Story Flow fallback should be current-project safe copy");
assert(!JSON.stringify(stale005Under004).includes("/005"), "mismatched 005 data must not leak into the current 004 workbench");

const workbench005 = buildCurrentProjectWorkbenchProjection({
  binding: binding005,
  realChainState: realChainMatched,
  image2BatchState: image2Matched,
  selectedShotId: "S01",
});
assert(workbench005.identity.projectId === "real-demo-e2e-005", "workbench should switch back to selected 005 identity");
assert(workbench005.shots.map((shot) => shot.id).join(",") === "S07,S08", "Story Flow should switch back to 005 shots when 005 is current");
assert(workbench005.selectedScope.defaultShotId === "S07", "Agent selected scope should default to the current 005 shot, not stale 004");

const realChain005Facts = deriveProjectRealChainStatus({
  ...stale005Payload,
  workbenchFacts: workbenchFacts005,
}, "runtime_endpoint");
const realChain005FactsMatched = guardProjectRealChainUiStateForCurrentProject(
  { status: realChain005Facts.uiStatus, summary: realChain005Facts },
  { projectId: "real-demo-e2e-005", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005" },
);
const workbench005Facts = buildCurrentProjectWorkbenchProjection({
  binding: binding005,
  realChainState: realChain005FactsMatched,
  image2BatchState: image2Matched,
});
assert(workbench005Facts.shots.map((shot) => shot.storyFunction).join(" ").includes("Mika"), "005 Story Flow should use 005 story_flow facts");
assert(workbench005Facts.assetFacts.map((asset) => asset.id).join(",") === "char_mika,char_ren", "005 Asset Library should use 005 visual_memory facts");
assert(workbench005Facts.assets.readOnlyProjection === false, "005 visual_memory should avoid empty read-only fallback");
assert(!JSON.stringify(workbench005Facts).includes("char_naya"), "005 workbench facts must not leak 004 visual memory");

const unboundWorkbench = buildCurrentProjectWorkbenchProjection({
  binding: unboundBinding,
  realChainState: { status: "unavailable", message: unboundBinding.message },
});
assert(unboundWorkbench.available === false, "unbound workbench must fail closed");
assert(unboundWorkbench.identity.displayTitle === "未选择项目", "unbound workbench should not show fallback project identity");
assert(unboundWorkbench.shots[0].id === "CURRENT_PROJECT", "unbound workbench should not show fallback story shots");
assert(!JSON.stringify(unboundWorkbench).includes("005"), "unbound workbench must not include demo 005 state");

assertUnifiedProjectStatusVideoStage();

console.log("Current project UI closed-loop test passed. Binding-first UI blocks unbound/stale summaries without provider calls.");
