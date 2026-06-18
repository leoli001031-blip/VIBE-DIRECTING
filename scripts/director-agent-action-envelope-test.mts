import {
  buildDirectorAgentActionEnvelope,
  buildDirectorAgentStateSnapshot,
  directorAgentReadinessActions,
  normalizeDirectorAgentExecutionContract,
} from "../src/core/directorAgentAction.ts";
import {
  detectDirectorAgentPermissionIntent,
  isDirectorAgentPermissionControlOnlyIntent,
} from "../src/core/directorAgentPermissionIntent.ts";
import type { ProjectRuntimeState } from "../src/core/projectState.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const runtimeState = {
  project: {
    title: "雨夜书店",
    root: "/project/rainy-bookstore",
  },
  storyFlow: {
    sections: [
      {
        id: "section_open",
        label: "开场：清晨旧书店",
        shotCount: 2,
        blockedCount: 0,
        readyCount: 2,
        shotIds: ["S01", "S02"],
      },
    ],
    shots: [
      {
        id: "S01",
        actId: "A01",
        sectionId: "section_open",
        title: "清晨旧书店",
        storyFunction: "建立场景",
        status: "ready",
        gates: {},
        issues: [],
        durationSeconds: 4,
        referenceStrategy: "omni_reference",
        primaryAction: "她在清晨旧书店翻开旧书",
        actionTrigger: "窗外第一班电车声靠近",
        microReaction: "她停住呼吸，耳机线轻晃",
        camera: "低机位轻微推入书架与窗边",
        actionBeats: ["翻开旧书", "听见远处电车"],
        characterGuidance: ["戴耳机的高中女生"],
        sceneGuidance: ["清晨旧书店", "窗边淡雾"],
        propGuidance: ["旧书"],
      },
      {
        id: "S02",
        actId: "A01",
        sectionId: "section_open",
        title: "发光车票",
        storyFunction: "道具触发",
        status: "ready",
        gates: {},
        issues: [],
        durationSeconds: 4,
      },
    ],
  },
  visualMemory: {
    assets: [
      {
        id: "asset_scene_bookstore",
        type: "scene",
        name: "旧书店清晨",
        path: "assets/scenes/bookstore.png",
        status: "generated",
        lockedStatus: "locked",
        safeForFutureReference: true,
        issues: [],
      },
      {
        id: "asset_ticket",
        type: "prop",
        name: "发光车票",
        path: "assets/props/ticket.png",
        status: "missing",
        lockedStatus: "not_generated",
        safeForFutureReference: false,
        issues: [],
      },
    ],
  },
} as unknown as ProjectRuntimeState;

const selectedSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState,
  currentView: "story",
  selectedShotId: "S01",
});

assert(selectedSnapshot.projectTitle === "雨夜书店", "snapshot should carry project title");
assert(selectedSnapshot.selectedShot?.title === "清晨旧书店", "snapshot should resolve selected shot");
assert(selectedSnapshot.selectedShot?.displayNumber === "1-1", "snapshot should preserve selected shot display number");
assert(selectedSnapshot.selectedShot?.context.primaryAction === "她在清晨旧书店翻开旧书", "snapshot should carry selected shot action context");
assert(selectedSnapshot.selectedShot?.context.sceneGuidance.includes("清晨旧书店"), "snapshot should carry selected shot scene context");
assert(selectedSnapshot.shots.find((shot) => shot.id === "S01")?.context.characterGuidance.includes("戴耳机的高中女生"), "shot index should carry compact role context");
assert(selectedSnapshot.assetCounts.locked === 1, "snapshot should count locked assets");
assert(selectedSnapshot.assetCounts.missing === 1, "snapshot should count missing assets");
assert(selectedSnapshot.projectReadiness.status === "needs_references", "snapshot should detect missing references");
assert(selectedSnapshot.projectReadiness.nextActionKind === "prepare_reference_generation", "missing references should make continue replenish references");
assert(selectedSnapshot.projectReadiness.actionQueue[0]?.kind === "prepare_reference_generation", "Agent readiness should expose a concrete next action queue");
assert(selectedSnapshot.projectReadiness.actionQueue.some((action) => action.kind === "prepare_video_submit" && action.priority === "later"), "Agent readiness should keep later video submit visible without skipping references");

const sectionSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState,
  currentView: "section",
  sectionId: "section_open",
});
assert(sectionSnapshot.selectedSection?.label === "开场：清晨旧书店", "snapshot should expose the selected section label to the Agent");
assert(sectionSnapshot.selectedSection?.shotIds.join(",") === "S01,S02", "snapshot should expose selected section shot ids to the Agent");

const staleSectionSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState,
  currentView: "section",
  sectionId: "section_from_previous_project",
});
assert(!staleSectionSnapshot.sectionId, "snapshot must drop stale section selections from another project");

const referenceReviewRuntimeState = {
  ...runtimeState,
  visualMemory: {
    assets: [
      ...runtimeState.visualMemory.assets,
      {
        id: "asset_candidate_ticket",
        type: "prop",
        name: "发光车票候选",
        path: "assets/props/ticket-candidate.png",
        status: "generated",
        lockedStatus: "needs_review",
        safeForFutureReference: false,
        issues: ["needs_review"],
      },
    ],
  },
} as unknown as ProjectRuntimeState;
const selectedAssetSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: referenceReviewRuntimeState,
  currentView: "reference",
  selectedAssetId: "asset_candidate_ticket",
});
assert(selectedAssetSnapshot.selectedAsset?.name === "发光车票候选", "snapshot should expose the selected reference asset to the Agent");

const staleAssetSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState,
  currentView: "reference",
  selectedAssetId: "asset_from_previous_project",
});
assert(!staleAssetSnapshot.selectedAssetId, "snapshot must drop stale reference selections from another project");
assert(!staleAssetSnapshot.selectedAsset, "snapshot must not expose a missing reference asset as selected");

const approveReference = buildDirectorAgentActionEnvelope({
  userIntent: "这张参考通过，锁定下来",
  snapshot: selectedAssetSnapshot,
  generatedAt: "2026-05-31T00:00:00.200Z",
});
assert(approveReference.kind === "review_reference_asset", "selected reference approval should become an asset review action");
assert(approveReference.status === "staged", "selected reference approval should stage before writeback");
assert(approveReference.target.kind === "asset" && approveReference.target.ids[0] === "asset_candidate_ticket", "asset review should target the selected reference asset");
assert(approveReference.toolPlan.toolName === "project_vibe_patch", "asset review should stay in the Project.vibe patch lane");
assert(approveReference.toolPlan.providerSubmitAllowed === false, "asset review must not submit providers");
assert(approveReference.proposedChanges[0]?.field === "assetStatus", "asset review should propose an asset status change");
assert(approveReference.proposedChanges[0]?.to === "已锁定", "reference approval should lock the selected asset");

const lockedAssetSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState,
  currentView: "reference",
  selectedAssetId: "asset_scene_bookstore",
});
const alreadyLockedReference = buildDirectorAgentActionEnvelope({
  userIntent: "这张参考通过，锁定下来",
  snapshot: lockedAssetSnapshot,
  generatedAt: "2026-05-31T00:00:00.210Z",
});
assert(alreadyLockedReference.kind === "review_reference_asset", "locked reference approval should still classify as an asset review");
assert(alreadyLockedReference.status === "blocked", "already locked reference approval should not stage a no-op write");
assert(alreadyLockedReference.proposedChanges.length === 0, "already locked reference approval should not show a fake status diff");
assert(alreadyLockedReference.userFacingMessage.includes("已经锁定"), "already locked reference approval should explain the no-op in creator language");

const rejectReference = buildDirectorAgentActionEnvelope({
  userIntent: "这张不要，退回重做",
  snapshot: selectedAssetSnapshot,
  generatedAt: "2026-05-31T00:00:00.225Z",
});
assert(rejectReference.kind === "review_reference_asset", "selected reference rejection should become an asset review action");
assert(rejectReference.proposedChanges[0]?.to === "退回复做", "reference rejection should mark the selected asset for replacement");

const sectionReference = buildDirectorAgentActionEnvelope({
  userIntent: "这一段先补参考图，但先不要提交视频",
  snapshot: sectionSnapshot,
  generatedAt: "2026-05-31T00:00:00.300Z",
});
assert(sectionReference.status === "staged", "section reference request should stage");
assert(sectionReference.target.kind === "section", "section reference request should target the selected section");
assert(sectionReference.target.label === "开场：清晨旧书店", "section target should use the selected section label");
assert(sectionReference.sourceContext.sectionId === "section_open", "section source context should preserve the selected section id");
assert(sectionReference.toolPlan.toolName === "image2_reference_generation", "section reference request should route to reference generation");

const continueReference = buildDirectorAgentActionEnvelope({
  userIntent: "可以继续吧",
  snapshot: selectedSnapshot,
  generatedAt: "2026-05-31T00:00:00.500Z",
});
assert(continueReference.status === "staged", "default continue should stage a reference-generation confirmation instead of running directly");
assert(continueReference.kind === "prepare_reference_generation", "continue should route to reference generation when references are missing");
assert(continueReference.toolPlan.toolName === "image2_reference_generation", "continue reference route should use reference tool");
assert(continueReference.requiresUserConfirmation === true, "default continue must still require user confirmation before provider work");
assert(continueReference.sourceContext.projectReadiness.status === "needs_references", "action should carry readiness context");
assert(continueReference.sourceContext.selectedShotContexts[0]?.context.primaryAction === "她在清晨旧书店翻开旧书", "action source context should carry the selected shot creative context");

const projectWideReference = buildDirectorAgentActionEnvelope({
  userIntent: "补齐这个项目的参考素材，只生成角色、场景、道具和故事板参考，不要提交视频。",
  snapshot: selectedSnapshot,
  generatedAt: "2026-05-31T00:00:00.550Z",
});
assert(projectWideReference.kind === "prepare_reference_generation", "project-wide reference request should route to reference generation");
assert(projectWideReference.target.kind === "project", "project-wide reference request must not be hijacked by the selected shot");
assert(projectWideReference.executionContract.mode === "reference_allowed", "project-wide no-video reference request should keep reference-only boundary");

const rapid = buildDirectorAgentActionEnvelope({
  userIntent: "这段改成故事板快切，动作拆得更清楚一点",
  snapshot: selectedSnapshot,
  generatedAt: "2026-05-31T00:00:00.000Z",
});
assert(rapid.status === "staged", "rapid-cut request should stage");
assert(rapid.kind === "update_shot_strategy", "rapid-cut request should become a strategy update");
assert(rapid.target.kind === "shot" && rapid.target.ids[0] === "S01", "rapid-cut request should target selected shot");
assert(rapid.proposedChanges[0]?.field === "referenceStrategy", "strategy update should patch referenceStrategy");
assert(rapid.proposedChanges[0]?.to === "故事板快切", "strategy update should select rapid cut");
assert(rapid.toolPlan.toolName === "project_vibe_patch", "strategy update should stay in Project.vibe patch lane");
assert(rapid.toolPlan.providerSubmitAllowed === false, "strategy update must not submit provider");

const simpleReference = buildDirectorAgentActionEnvelope({
  userIntent: "这段改成简单参考，不要故事板",
  snapshot: selectedSnapshot,
  generatedAt: "2026-05-31T00:00:00.250Z",
});
assert(simpleReference.status === "staged", "simple-reference request should stage");
assert(simpleReference.kind === "update_shot_strategy", "simple-reference request should become a strategy update");
assert(simpleReference.proposedChanges[0]?.to === "全能参考", "simple reference should map to omni reference");

const noSelectionSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState,
  currentView: "story",
});
const blockedStrategy = buildDirectorAgentActionEnvelope({
  userIntent: "改成故事板叙事",
  snapshot: noSelectionSnapshot,
  generatedAt: "2026-05-31T00:00:01.000Z",
});
assert(blockedStrategy.status === "blocked", "shot strategy without selection should block");
assert(blockedStrategy.blockers.some((item) => item.includes("选中一个镜头")), "blocked strategy should explain missing shot selection");

const blockedExplicitReferenceReview = buildDirectorAgentActionEnvelope({
  userIntent: "这张参考通过，锁定下来",
  snapshot: noSelectionSnapshot,
  generatedAt: "2026-05-31T00:00:01.025Z",
});
assert(blockedExplicitReferenceReview.kind === "review_reference_asset", "explicit reference approval should still route to asset review");
assert(blockedExplicitReferenceReview.status === "blocked", "explicit reference approval without selection should ask for a selected reference");
assert(blockedExplicitReferenceReview.blockers.some((item) => item.includes("参考素材")), "explicit reference approval should explain missing reference selection");

const blockedStaleReferenceReview = buildDirectorAgentActionEnvelope({
  userIntent: "这张参考通过，锁定下来",
  snapshot: staleAssetSnapshot,
  generatedAt: "2026-05-31T00:00:01.030Z",
});
assert(blockedStaleReferenceReview.kind === "review_reference_asset", "stale reference approval should still understand the creator intent");
assert(blockedStaleReferenceReview.status === "blocked", "stale reference approval should block instead of targeting a missing asset");
assert(blockedStaleReferenceReview.target.kind !== "asset", "stale reference approval must not target a missing asset id");
assert(blockedStaleReferenceReview.blockers.some((item) => item.includes("参考素材")), "stale reference approval should ask the creator to select the current reference again");

const blockedMissingShotFeedback = buildDirectorAgentActionEnvelope({
  userIntent: "这个镜头动作再慢一点，表情停一下",
  snapshot: noSelectionSnapshot,
  generatedAt: "2026-05-31T00:00:01.035Z",
});
assert(blockedMissingShotFeedback.status === "blocked", "deictic shot feedback without selection should block instead of becoming a project edit");
assert(blockedMissingShotFeedback.blockers.some((item) => item.includes("选中一个镜头")), "deictic shot feedback should ask for a selected shot");
assert(blockedMissingShotFeedback.projectWriteMode === "staged_only", "blocked deictic feedback should still preserve the staged-only contract");

const blockedMissingSectionFeedback = buildDirectorAgentActionEnvelope({
  userIntent: "这一段节奏再慢一点，别那么急",
  snapshot: staleSectionSnapshot,
  generatedAt: "2026-05-31T00:00:01.040Z",
});
assert(blockedMissingSectionFeedback.status === "blocked", "deictic section feedback without a valid section should block instead of becoming a project edit");
assert(blockedMissingSectionFeedback.blockers.some((item) => item.includes("段落或镜头")), "deictic section feedback should ask for a selected section or shot");

const selectedShotFeedback = buildDirectorAgentActionEnvelope({
  userIntent: "这个镜头动作更有压迫感，机位低一点",
  snapshot: selectedSnapshot,
  generatedAt: "2026-05-31T00:00:01.050Z",
});
assert(selectedShotFeedback.kind === "revise_story_or_shot", "selected shot feedback should stay as a scoped edit");
assert(selectedShotFeedback.target.kind === "shot", "selected shot feedback should target the selected shot");
assert(selectedShotFeedback.proposedChanges[0]?.field === "selectedScopeDraft", "selected shot feedback should become a selected-scope draft");
assert(selectedShotFeedback.proposedChanges[0]?.to.includes("压迫感"), "selected shot feedback diff should show the creator's concrete wording");
assert(selectedShotFeedback.proposedChanges[0]?.reason.includes("清晨旧书店"), "selected shot feedback should say which target will receive the write");
assert(selectedShotFeedback.userFacingMessage.includes("清晨旧书店"), "selected shot feedback should explain the selected target to the creator");

const planOnlyScopedFeedback = buildDirectorAgentActionEnvelope({
  userIntent: "把这一段改成更像90年代日漫赛车开场：低机位扫过湿地，车灯亮起，两个车手只露出手和眼神。只整理计划，不要生图，也不要提交视频。",
  snapshot: selectedSnapshot,
  generatedAt: "2026-05-31T00:00:01.060Z",
});
assert(planOnlyScopedFeedback.executionContract.mode === "plan_only", "scoped feedback with no-generation wording should keep plan-only boundary");
assert(planOnlyScopedFeedback.proposedChanges[0]?.field === "selectedScopeDraft", "plan-only scoped feedback should still become a selected-scope draft");
assert(planOnlyScopedFeedback.proposedChanges[0]?.to.includes("90年代日漫赛车开场"), "plan-only scoped feedback should keep the creator's concrete direction");
assert(!planOnlyScopedFeedback.proposedChanges[0]?.to.includes("不要生图"), "permission control wording should not pollute the staged creative diff");
assert(!planOnlyScopedFeedback.proposedChanges[0]?.to.includes("，，"), "stripped permission wording should not leave doubled punctuation");
assert(!planOnlyScopedFeedback.proposedChanges[0]?.to.includes("也。"), "stripped permission wording should not leave dangling conjunctions");

const newStoryNoVideoFeedback = buildDirectorAgentActionEnvelope({
  userIntent: "新建一个 12 秒短片：雨夜便利店，两辆车启动。先帮我拆故事和参考模式，不要提交视频。",
  snapshot: selectedSnapshot,
  generatedAt: "2026-05-31T00:00:01.065Z",
});
assert(newStoryNoVideoFeedback.kind === "revise_story_or_shot", "new story with no-video wording should remain a project draft action");
assert(newStoryNoVideoFeedback.target.kind === "project", "new story wording should override the currently selected shot");
assert(newStoryNoVideoFeedback.summary.includes("新故事草案"), "new story project draft should be labeled as a new story");
assert(newStoryNoVideoFeedback.toolPlan.toolName === "project_vibe_patch", "new story plan should only stage a project patch before generation");

const selectedShotApprovalFeedback = buildDirectorAgentActionEnvelope({
  userIntent: "这个镜头通过了，节奏可以，先保持这个方向",
  snapshot: selectedSnapshot,
  generatedAt: "2026-05-31T00:00:01.075Z",
});
assert(selectedShotApprovalFeedback.kind === "revise_story_or_shot", "shot approval wording should not be mistaken for reference asset review");
assert(selectedShotApprovalFeedback.target.kind === "shot", "shot approval wording should keep the selected shot target");
assert(selectedShotApprovalFeedback.proposedChanges[0]?.to.includes("这个镜头通过"), "shot approval wording should remain a scoped creator note");

const referenceViewShotApprovalFeedback = buildDirectorAgentActionEnvelope({
  userIntent: "这个镜头通过了，动作方向可以保留",
  snapshot: buildDirectorAgentStateSnapshot({
    runtimeState,
    currentView: "reference",
    selectedShotId: "S01",
  }),
  generatedAt: "2026-05-31T00:00:01.085Z",
});
assert(referenceViewShotApprovalFeedback.kind === "revise_story_or_shot", "reference view should not steal explicit shot approval wording");
assert(referenceViewShotApprovalFeedback.target.kind === "shot", "reference view shot approval should still target the selected shot");

const projectInspection = buildDirectorAgentActionEnvelope({
  userIntent: "现在项目还有什么问题，能不能继续？",
  snapshot: noSelectionSnapshot,
  generatedAt: "2026-05-31T00:00:01.100Z",
});
assert(projectInspection.kind === "inspect_project_status", "status questions should inspect project state instead of becoming project direction edits");
assert(projectInspection.toolPlan.toolName === "project_vibe_patch", "status inspection should stay in the safe project lane");
assert(projectInspection.toolPlan.providerSubmitAllowed === false, "status inspection must not call providers");
assert(projectInspection.proposedChanges.some((change) => change.field === "projectStatus"), "status inspection should expose readiness as a proposed fact");
assert(projectInspection.proposedChanges.some((change) => change.field === "nextActions" && change.to.includes("现在生成参考")), "status inspection should expose the Agent action queue");
assert(projectInspection.userFacingMessage.includes("建议下一步"), "status inspection should return a user-readable next step");
assert(projectInspection.userFacingMessage.includes("后续可走"), "status inspection should summarize more than one possible next action");

const projectHowIsIt = buildDirectorAgentActionEnvelope({
  userIntent: "现在项目怎么样？",
  snapshot: noSelectionSnapshot,
  generatedAt: "2026-05-31T00:00:01.150Z",
});
assert(projectHowIsIt.kind === "inspect_project_status", "short project-health questions should inspect project state instead of becoming project direction edits");
assert(projectHowIsIt.toolPlan.providerSubmitAllowed === false, "project-health inspection must not call providers");
assert(projectHowIsIt.proposedChanges.some((change) => change.field === "projectStatus"), "project-health inspection should expose readiness as a proposed fact");

const projectNextQuestion = buildDirectorAgentActionEnvelope({
  userIntent: "接下来该做什么？",
  snapshot: noSelectionSnapshot,
  generatedAt: "2026-05-31T00:00:01.175Z",
});
assert(projectNextQuestion.kind === "inspect_project_status", "question-form next-step wording should inspect status instead of mutating the story");
assert(projectNextQuestion.proposedChanges.some((change) => change.field === "nextActions"), "question-form next-step inspections should expose the action path");

const projectEnglishNextQuestion = buildDirectorAgentActionEnvelope({
  userIntent: "what next?",
  snapshot: noSelectionSnapshot,
  generatedAt: "2026-05-31T00:00:01.185Z",
});
assert(projectEnglishNextQuestion.kind === "inspect_project_status", "English next-step questions should inspect status instead of becoming a story draft");

const textTargetStrategy = buildDirectorAgentActionEnvelope({
  userIntent: "把镜头 1-2 改成故事板叙事",
  snapshot: noSelectionSnapshot,
  generatedAt: "2026-05-31T00:00:01.250Z",
});
assert(textTargetStrategy.status === "staged", "Agent should infer an explicitly mentioned shot target without a UI selection");
assert(textTargetStrategy.target.kind === "shot", "single mentioned shot should become a shot target");
assert(textTargetStrategy.target.ids[0] === "S02", "shot number mention should resolve against the current project shots");
assert(textTargetStrategy.sourceContext.selectedShotIds[0] === "S02", "source context should carry the Agent-resolved shot");
assert(textTargetStrategy.sourceContext.selectedShotContexts[0]?.title === "发光车票", "source context should follow the text-resolved shot target");
assert(textTargetStrategy.proposedChanges[0]?.from === "未设置", "inferred target should still read the target shot's current strategy");

const textTargetFeedback = buildDirectorAgentActionEnvelope({
  userIntent: "镜头 1-2 的手部动作再停顿一下",
  snapshot: noSelectionSnapshot,
  generatedAt: "2026-05-31T00:00:01.300Z",
});
assert(textTargetFeedback.kind === "revise_story_or_shot", "text-targeted feedback should remain a scoped edit");
assert(textTargetFeedback.target.ids[0] === "S02", "text-targeted feedback should resolve the mentioned shot");
assert(textTargetFeedback.proposedChanges[0]?.to.includes("手部动作"), "text-targeted feedback diff should keep the concrete creator wording");
assert(textTargetFeedback.userFacingMessage.includes("发光车票"), "text-targeted feedback should tell the creator which shot will change");

const textTargetRange = buildDirectorAgentActionEnvelope({
  userIntent: "镜头 1-1 到 1-2 都先补参考，但先不要提交视频",
  snapshot: noSelectionSnapshot,
  generatedAt: "2026-05-31T00:00:01.500Z",
});
assert(textTargetRange.status === "staged", "Agent should infer explicitly mentioned shot ranges");
assert(textTargetRange.target.kind === "multi_shot", "range mention should become a multi-shot target");
assert(textTargetRange.target.ids.join(",") === "S01,S02", "range mention should resolve ordered current-project shots");
assert(textTargetRange.executionContract.mode === "reference_allowed", "range action should still respect no-video permission wording");

const planOnly = normalizeDirectorAgentExecutionContract({
  mode: "plan_only",
  referenceGenerationAllowed: false,
  videoSubmitAllowed: false,
  providerSubmitAllowed: false,
  reason: "用户要求先不要生成",
});
const blockedReference = buildDirectorAgentActionEnvelope({
  userIntent: "帮我补参考图",
  snapshot: selectedSnapshot,
  executionContract: planOnly,
  generatedAt: "2026-05-31T00:00:02.000Z",
});
assert(blockedReference.status === "blocked", "plan-only should block reference generation");
assert(blockedReference.toolPlan.toolName === "image2_reference_generation", "reference request should still be classified");
assert(blockedReference.toolPlan.providerSubmitAllowed === false, "plan-only reference request must not submit provider");

const defaultBlockedVideo = buildDirectorAgentActionEnvelope({
  userIntent: "提交视频到即梦",
  snapshot: selectedSnapshot,
  generatedAt: "2026-05-31T00:00:02.050Z",
});
assert(defaultBlockedVideo.executionContract.mode === "video_allowed", "explicit video intent should stage a confirmable video boundary");
assert(defaultBlockedVideo.status === "blocked", "explicit video intent should still respect project readiness blockers");
assert(defaultBlockedVideo.toolPlan.toolName === "seedance_video_submit", "video intent should still be classified as Seedance submit");
assert(defaultBlockedVideo.requiresUserConfirmation === true, "video submit must still require user confirmation");

const directBoundedReference = buildDirectorAgentActionEnvelope({
  userIntent: "帮我补参考图，但先不要生图，也不要提交视频",
  snapshot: selectedSnapshot,
  generatedAt: "2026-05-31T00:00:02.250Z",
});
assert(directBoundedReference.executionContract.mode === "plan_only", "core Agent should infer plan-only from no-image-generation wording");
assert(directBoundedReference.status === "blocked", "core-inferred plan-only should block reference generation");
assert(directBoundedReference.toolPlan.providerSubmitAllowed === false, "core-inferred plan-only must not submit provider");

const broadPlanOnlyBoundary = buildDirectorAgentActionEnvelope({
  userIntent: "先梳理项目，不走生图生视频",
  snapshot: selectedSnapshot,
  generatedAt: "2026-05-31T00:00:02.300Z",
});
assert(broadPlanOnlyBoundary.executionContract.mode === "plan_only", "core Agent should infer plan-only from broader no-generation wording");
assert(broadPlanOnlyBoundary.toolPlan.providerSubmitAllowed === false, "broad plan-only wording must not prepare provider submit");

assert(detectDirectorAgentPermissionIntent("请先不要提交视频测试，也不要真实生图。") === "plan_only", "combined no-video/no-real-image wording should infer plan-only");
assert(detectDirectorAgentPermissionIntent("只做故事规划，不要生成参考，也不要提交视频。") === "plan_only", "no-reference plus no-video wording should infer plan-only");
assert(isDirectorAgentPermissionControlOnlyIntent("只看规划") === true, "pure planning boundary wording should be treated as a control-only Agent command");
assert(isDirectorAgentPermissionControlOnlyIntent("先不要提交视频测试") === true, "pure no-video testing wording should be treated as a control-only Agent command");
assert(isDirectorAgentPermissionControlOnlyIntent("视频先不用跑") === true, "colloquial no-video wording should be treated as a control-only Agent command");
assert(detectDirectorAgentPermissionIntent("可做参考") === "reference_allowed", "typed reference boundary wording should infer reference-only");
assert(isDirectorAgentPermissionControlOnlyIntent("可做参考") === true, "pure reference boundary wording should be treated as a control-only Agent command");
assert(detectDirectorAgentPermissionIntent("可生成参考") === "reference_allowed", "visible reference-generation wording should infer reference-only");
assert(isDirectorAgentPermissionControlOnlyIntent("可生成参考") === true, "visible reference-generation wording should be treated as a control-only Agent command");
assert(isDirectorAgentPermissionControlOnlyIntent("可提交视频") === true, "pure video permission wording should be treated as a control-only Agent command");
assert(isDirectorAgentPermissionControlOnlyIntent("提交视频") === false, "bare submit-video wording must remain an Agent action");
assert(isDirectorAgentPermissionControlOnlyIntent("先补参考") === false, "bare reference-generation wording must remain an Agent action");
assert(isDirectorAgentPermissionControlOnlyIntent("把镜头 1-2 改成故事板叙事，只看规划") === false, "permission wording attached to a creative edit must still stage the creative edit");

const planOnlyStrategyChange = buildDirectorAgentActionEnvelope({
  userIntent: "把这个镜头改成故事板叙事，只做计划，不生图不提交视频。",
  snapshot: selectedSnapshot,
  generatedAt: "2026-05-31T00:00:02.350Z",
});
assert(planOnlyStrategyChange.kind === "update_shot_strategy", "plan-only wording must not turn a strategy edit into reference generation");
assert(planOnlyStrategyChange.executionContract.mode === "plan_only", "strategy edits with no-image wording must keep the plan-only boundary");
assert(planOnlyStrategyChange.toolPlan.providerSubmitAllowed === false, "plan-only strategy edits must not prepare provider submit");

const boundedReference = buildDirectorAgentActionEnvelope({
  userIntent: "帮我补参考图，但先不要生图，也不要提交视频",
  snapshot: selectedSnapshot,
  executionContract: planOnly,
  generatedAt: "2026-05-31T00:00:02.500Z",
});
assert(boundedReference.kind === "prepare_reference_generation", "control phrases should not turn a reference request into video submit");
assert(boundedReference.status === "blocked", "bounded reference request should still obey plan-only");
assert(boundedReference.userFacingMessage.includes("还不能生成参考"), "bounded reference request should explain the reference blocker");

const directNoVideoReference = buildDirectorAgentActionEnvelope({
  userIntent: "帮我补参考图，但先不要提交视频",
  snapshot: selectedSnapshot,
  generatedAt: "2026-05-31T00:00:02.750Z",
});
assert(directNoVideoReference.executionContract.mode === "reference_allowed", "core Agent should infer reference-only from no-video wording");
assert(directNoVideoReference.status === "staged", "no-video wording should still allow reference preparation");
assert(directNoVideoReference.toolPlan.providerSubmitAllowed === true, "reference-only contract can prepare reference generation after confirmation");

const broadNoVideoReference = buildDirectorAgentActionEnvelope({
  userIntent: "帮我补参考，视频先不用管",
  snapshot: selectedSnapshot,
  generatedAt: "2026-05-31T00:00:02.800Z",
});
assert(broadNoVideoReference.executionContract.mode === "reference_allowed", "core Agent should infer reference-only from broader no-video wording");
assert(broadNoVideoReference.status === "staged", "broader no-video wording should still allow reference preparation");

const naturalSceneReference = buildDirectorAgentActionEnvelope({
  userIntent: "补一张覆盖完整行动范围的场景参考",
  snapshot: selectedSnapshot,
  generatedAt: "2026-05-31T00:00:02.820Z",
});
assert(naturalSceneReference.kind === "prepare_reference_generation", "natural separated reference wording should classify as reference generation");
assert(naturalSceneReference.status === "staged", "natural separated reference wording should stage a confirmable reference plan");
assert(naturalSceneReference.requiresUserConfirmation === true, "natural reference generation must still require confirmation");

const copyableRecoveryReference = buildDirectorAgentActionEnvelope({
  userIntent: "只补参考，补一张覆盖完整行动范围的场景/天气参考，先不要提交视频",
  snapshot: selectedSnapshot,
  generatedAt: "2026-05-31T00:00:02.840Z",
});
assert(copyableRecoveryReference.kind === "prepare_reference_generation", "copyable recovery advice should classify as reference generation");
assert(copyableRecoveryReference.executionContract.mode === "reference_allowed", "copyable recovery advice should infer reference-only mode");
assert(copyableRecoveryReference.status === "staged", "copyable recovery advice should allow reference preparation");

const referenceAllowed = normalizeDirectorAgentExecutionContract({
  mode: "reference_allowed",
  referenceGenerationAllowed: true,
  videoSubmitAllowed: false,
  providerSubmitAllowed: true,
  reason: "用户允许先做参考",
});
const stagedReference = buildDirectorAgentActionEnvelope({
  userIntent: "可以先补齐参考素材",
  snapshot: selectedSnapshot,
  executionContract: referenceAllowed,
  generatedAt: "2026-05-31T00:00:03.000Z",
});
assert(stagedReference.status === "staged", "reference-allowed contract should stage reference action");
assert(stagedReference.toolPlan.providerSubmitAllowed === true, "reference-allowed contract can prepare provider submit after confirmation");
assert(stagedReference.requiresUserConfirmation === true, "reference action still requires confirmation");

const blockedVideo = buildDirectorAgentActionEnvelope({
  userIntent: "提交视频到即梦",
  snapshot: selectedSnapshot,
  executionContract: referenceAllowed,
  generatedAt: "2026-05-31T00:00:04.000Z",
});
assert(blockedVideo.status === "blocked", "reference-only contract should block video submit");
assert(blockedVideo.toolPlan.toolName === "seedance_video_submit", "video intent should be classified");
assert(blockedVideo.toolPlan.providerSubmitAllowed === false, "blocked video request must not submit provider");
assert(blockedVideo.blockers.some((item) => item.includes("生成并复核参考")), "video submit should wait for missing references");

const noShotSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: {
    ...runtimeState,
    storyFlow: { shots: [] },
    visualMemory: { assets: [] },
  } as unknown as ProjectRuntimeState,
  currentView: "story",
});
const continueStory = buildDirectorAgentActionEnvelope({
  userIntent: "下一步",
  snapshot: noShotSnapshot,
  generatedAt: "2026-05-31T00:00:04.500Z",
});
assert(continueStory.kind === "revise_story_or_shot", "continue should route empty projects to story drafting");
assert(continueStory.proposedChanges[0]?.field === "storyDraft", "empty project continue should propose story draft");
assert(continueStory.userFacingMessage.includes("故事草案"), "empty project continue should explain story drafting");

const noAssetSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: {
    ...runtimeState,
    visualMemory: { assets: [] },
  } as unknown as ProjectRuntimeState,
  currentView: "story",
});
const continueNoAsset = buildDirectorAgentActionEnvelope({
  userIntent: "go",
  snapshot: noAssetSnapshot,
  generatedAt: "2026-05-31T00:00:04.625Z",
});
assert(noAssetSnapshot.projectReadiness.status === "needs_references", "shots without any reference projection should need references");
assert(noAssetSnapshot.projectReadiness.actionQueue[0]?.label === "生成参考", "no-reference projects should queue reference generation first");
assert(continueNoAsset.kind === "prepare_reference_generation", "continue should not submit video when no references exist");

const needsReviewOnlySnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: {
    ...runtimeState,
    visualMemory: {
      assets: runtimeState.visualMemory.assets.map((asset) => ({
        ...asset,
        status: "generated",
        lockedStatus: asset.id === "asset_scene_bookstore" ? "locked" : "needs_review",
        safeForFutureReference: asset.id === "asset_scene_bookstore",
      })),
    },
  } as unknown as ProjectRuntimeState,
  currentView: "story",
});
const continueReview = buildDirectorAgentActionEnvelope({
  userIntent: "下一步",
  snapshot: needsReviewOnlySnapshot,
  generatedAt: "2026-05-31T00:00:04.650Z",
});
assert(needsReviewOnlySnapshot.projectReadiness.status === "needs_review", "review-only projects should expose review readiness");
assert(needsReviewOnlySnapshot.projectReadiness.actionQueue[0]?.kind === "review_reference_asset", "review-only projects should queue reference review first");
assert(continueReview.kind === "review_reference_asset", "continue should follow the action queue into reference review");
assert(continueReview.status === "blocked", "reference review without a selected asset should ask for selection");
assert(continueReview.blockers.some((item) => item.includes("参考素材")), "queued reference review should explain the missing selected reference");

const statusInspectionContinueReview = buildDirectorAgentActionEnvelope({
  userIntent: "按项目状态继续：复核参考",
  snapshot: needsReviewOnlySnapshot,
  generatedAt: "2026-05-31T00:00:04.660Z",
});
assert(statusInspectionContinueReview.kind === "review_reference_asset", "status-inspection continuation should use the queued reference review action");

const readySnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: {
    ...runtimeState,
    visualMemory: {
      assets: runtimeState.visualMemory.assets.map((asset) => ({
        ...asset,
        status: "generated",
        lockedStatus: "locked",
        safeForFutureReference: true,
      })),
    },
  } as unknown as ProjectRuntimeState,
  currentView: "story",
});
const continueVideo = buildDirectorAgentActionEnvelope({
  userIntent: "开始吧",
  snapshot: readySnapshot,
  generatedAt: "2026-05-31T00:00:04.750Z",
});
assert(readySnapshot.projectReadiness.status === "ready_for_video", "all locked references should be ready for video");
assert(readySnapshot.projectReadiness.actionQueue[0]?.kind === "prepare_video_submit", "ready projects should queue video submit first");
assert(readySnapshot.projectReadiness.actionQueue.some((action) => action.kind === "prepare_export"), "ready projects should keep export available as a follow-up action");
assert(continueVideo.kind === "prepare_video_submit", "continue should route ready projects to video submit plan");
assert(continueVideo.toolPlan.toolName === "seedance_video_submit", "ready continue should use video submit tool");

const recoverableVideoSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: {
    ...runtimeState,
    visualMemory: {
      assets: runtimeState.visualMemory.assets.map((asset) => ({
        ...asset,
        status: "generated",
        lockedStatus: "locked",
        safeForFutureReference: true,
      })),
    },
  } as unknown as ProjectRuntimeState,
  currentView: "story",
  videoStatus: "submitted",
  videoCanResume: true,
  videoWaitingCount: 1,
  videoDetail: "Seedance 已提交，可以查询结果。",
});
const continueVideoQuery = buildDirectorAgentActionEnvelope({
  userIntent: "继续",
  snapshot: recoverableVideoSnapshot,
  generatedAt: "2026-05-31T00:00:04.760Z",
});
assert(continueVideoQuery.kind === "query_video_result", "continue should query existing Seedance jobs before preparing a new submit");
assert(continueVideoQuery.toolPlan.toolName === "seedance_video_submit", "query should keep the runtime-compatible Seedance handler");
assert(continueVideoQuery.toolPlan.providerSubmitAllowed === false, "query should never create a new provider submit");
assert(/查询/.test(continueVideoQuery.summary), "query action should be creator-facing as a result check");

const representativeVideoDoneSnapshot = buildDirectorAgentStateSnapshot({
  runtimeState: {
    ...runtimeState,
    visualMemory: {
      assets: runtimeState.visualMemory.assets.map((asset) => ({
        ...asset,
        status: "generated",
        lockedStatus: "locked",
        safeForFutureReference: true,
      })),
    },
  } as unknown as ProjectRuntimeState,
  currentView: "story",
  videoStatus: "completed",
  videoCompletedCount: 1,
  videoDetail: "代表性视频已返回；后续段保持等待。",
});
const continueAfterRepresentativeVideo = buildDirectorAgentActionEnvelope({
  userIntent: "继续",
  snapshot: representativeVideoDoneSnapshot,
  generatedAt: "2026-05-31T00:00:04.770Z",
});
assert(
  continueAfterRepresentativeVideo.kind === "inspect_project_status",
  "plain continue after a representative video should inspect status instead of submitting another segment",
);
const explicitNextSegmentSubmit = buildDirectorAgentActionEnvelope({
  userIntent: "继续提交下一段视频，验证串行队列",
  snapshot: representativeVideoDoneSnapshot,
  generatedAt: "2026-05-31T00:00:04.771Z",
});
assert(
  explicitNextSegmentSubmit.kind === "prepare_video_submit",
  "explicit next-segment wording should still allow a second serial submit",
);

const legacyReadySnapshot = {
  ...readySnapshot,
  projectReadiness: {
    ...readySnapshot.projectReadiness,
    actionQueue: [],
  },
};
const legacyContinueVideo = buildDirectorAgentActionEnvelope({
  userIntent: "下一步",
  snapshot: legacyReadySnapshot,
  generatedAt: "2026-05-31T00:00:04.775Z",
});
assert(directorAgentReadinessActions(legacyReadySnapshot.projectReadiness)[0]?.kind === "prepare_video_submit", "Agent readiness action helper should fall back for legacy snapshots without actionQueue");
assert(legacyContinueVideo.kind === "prepare_video_submit", "continue should still work for legacy snapshots without actionQueue");

const directVideoSubmit = buildDirectorAgentActionEnvelope({
  userIntent: "提交视频",
  snapshot: readySnapshot,
  generatedAt: "2026-05-31T00:00:04.800Z",
});
assert(directVideoSubmit.kind === "prepare_video_submit", "bare submit-video wording should not be stripped into a generic project patch");
assert(directVideoSubmit.toolPlan.toolName === "seedance_video_submit", "bare submit-video wording should route to video submit");

const blockedDirectVideoSubmit = buildDirectorAgentActionEnvelope({
  userIntent: "提交视频",
  snapshot: readySnapshot,
  executionContract: planOnly,
  generatedAt: "2026-05-31T00:00:04.850Z",
});
assert(blockedDirectVideoSubmit.kind === "prepare_video_submit", "plan-only submit-video wording should still classify as video intent");
assert(blockedDirectVideoSubmit.status === "blocked", "plan-only submit-video wording must block execution");

const research = buildDirectorAgentActionEnvelope({
  userIntent: "先联网查一下 90 年代日本 TV 动画的分镜节奏",
  snapshot: selectedSnapshot,
  executionContract: planOnly,
  generatedAt: "2026-05-31T00:00:05.000Z",
});
assert(research.status === "staged", "style research can stage in plan-only");
assert(research.kind === "request_style_research", "research intent should become style research");
assert(research.toolPlan.toolName === "web_search", "research should use web search tool plan");
assert(research.toolPlan.providerSubmitAllowed === false, "web research is not provider submit");

const exportAction = buildDirectorAgentActionEnvelope({
  userIntent: "导出一个素材包给我检查",
  snapshot: noSelectionSnapshot,
  generatedAt: "2026-05-31T00:00:06.000Z",
});
assert(exportAction.status === "staged", "export can target whole project");
assert(exportAction.target.kind === "project", "export should target project");
assert(exportAction.toolPlan.expectedReceipt === "export_receipt", "export should require export receipt");

console.log("director-agent-action-envelope-test passed");
