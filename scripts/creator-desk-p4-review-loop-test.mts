import { readFileSync } from "node:fs";
import { buildCreatorDeskProjection } from "../src/ui/app/creatorDeskProjection.ts";
import {
  createAssetLibraryFromRuntimeState,
  createProjectVibeFromRuntimeState,
} from "../src/ui/app/projectRuntimeProjections.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const image2BatchState = {
  status: "ready_for_review",
  summary: {
    uiStatus: "ready_for_review",
    plannedCount: 2,
    readyCount: 2,
    blockedCount: 0,
    selectedShotIds: ["S01", "S02"],
    nextAction: "复核参考",
    items: [
      { shotId: "S01", queueOrder: 1, blocked: false, blockers: [], referencePaths: ["assets/generated/char_mika.png"] },
      { shotId: "S02", queueOrder: 2, blocked: false, blockers: [], referencePaths: ["assets/generated/scene_archive.png"] },
    ],
    ledgerProjections: [],
    queuedCount: 0,
    parkedCount: 0,
    completeVerifiedCount: 0,
    providerSubmissionForbidden: true,
    noFileMutation: true,
    workerSpawnForbidden: true,
    providerCalled: false,
    prepareRan: false,
    verifyScriptRan: false,
    liveSubmitAllowed: false,
  },
} as any;

const runtimeState = {
  generatedAt: "2026-05-25T00:00:00.000Z",
  project: { title: "P4 Review Loop", root: "projects/p4", sourceTask: "", importedAt: "2026-05-25T00:00:00.000Z", state: "ready", metrics: {} },
  sourceIndex: {
    projectId: "p4_review_loop",
    projectVersion: "0.1.0",
    sourceIndexHash: "sha256:p4",
    currentProductionBibleId: "",
    currentStoryFlowId: "story_flow",
    currentVisualMemoryId: "visual_memory",
    currentPromptHashes: {},
    lockedReferenceIds: [],
    candidateReferenceIds: ["char_mika", "scene_archive"],
    rejectedReferenceIds: [],
    failedReferenceIds: [],
    confirmedDecisionIds: [],
    staleArtifactIds: [],
    updatedAt: "2026-05-25T00:00:00.000Z",
  },
  sourceIndexSummary: {
    projectId: "p4_review_loop",
    lockedReferenceCount: 0,
    candidateReferenceCount: 2,
    rejectedReferenceCount: 0,
    failedReferenceCount: 0,
    staleArtifactCount: 0,
    blockingReferenceCount: 2,
    isProductionReady: false,
    updatedAt: "2026-05-25T00:00:00.000Z",
  },
  storyFlow: {
    sections: [{ id: "act_1", label: "开场", shotCount: 2, blockedCount: 0, readyCount: 2, shotIds: ["S01", "S02"] }],
    shots: [
      { id: "S01", actId: "act_1", sectionId: "act_1", title: "Mika 出场", storyFunction: "Mika 进入旧书店。", status: "assets_ready", startFrame: "assets/generated/char_mika.png", gates: { identity: "PASS", scene: "UNKNOWN", pair: "UNKNOWN", story: "PASS", prop: "N/A", style: "UNKNOWN" }, issues: [] },
      { id: "S02", actId: "act_1", sectionId: "act_1", title: "旧书店环境", storyFunction: "镜头建立旧书店空间。", status: "assets_ready", startFrame: "assets/generated/scene_archive.png", gates: { identity: "UNKNOWN", scene: "PASS", pair: "UNKNOWN", story: "PASS", prop: "N/A", style: "UNKNOWN" }, issues: [] },
    ],
  },
  visualMemory: {
    summary: { total: 3, existing: 3, locked: 0, needsReview: 3, missing: 0, byType: [] },
    assets: [
      {
        id: "storyboard_reference_s01",
        type: "prop",
        name: "Mika 出场故事板参考",
        path: "assets/generated/storyboard_s01.png",
        status: "exists",
        lockedStatus: "needs_review",
        providerId: "current-project-visual-memory",
        sourceReceiptId: "mock_lanyi_image2_asset_storyboard_s01",
        outputHash: "sha256:storyboard-s01",
        promptText: "生成 S01 的故事板参考，用于构图、动作和切镜节奏。",
        promptHash: "sha256:prompt-storyboard",
        usedByShotIds: ["S01"],
        safeForFutureReference: false,
        textConstraints: ["故事板参考：用于构图、动作、切镜节奏，不替代角色和场景设定。"],
        sourceRefs: ["visual_memory.storyboard:0"],
        roleBinding: { role: "storyboard_reference", useFor: ["构图", "动作", "切镜节奏"], ignoreFor: ["角色身份", "场景设定"] },
        issues: ["needs_review"],
      },
      {
        id: "char_mika",
        type: "character",
        name: "Mika 角色参考",
        path: "assets/generated/char_mika.png",
        status: "exists",
        lockedStatus: "needs_review",
        providerId: "current-project-visual-memory",
        sourceReceiptId: "mock_lanyi_image2_asset_char_mika",
        outputHash: "sha256:char-mika",
        promptText: "生成 Mika 的角色身份参考，白底，显示发型和服装轮廓。",
        promptHash: "sha256:prompt-char",
        usedByShotIds: ["S01"],
        safeForFutureReference: false,
        textConstraints: ["保持 Mika 的短发、耳机和校服轮廓"],
        sourceRefs: ["visual_memory.roles:0", "provider_observation#provider_observations/assets/character_char_mika.json"],
        issues: ["needs_review"],
      },
      {
        id: "scene_archive",
        type: "scene",
        name: "旧书店场景参考",
        path: "assets/generated/scene_archive.png",
        status: "exists",
        lockedStatus: "candidate",
        providerId: "current-project-visual-memory",
        sourceReceiptId: "provider_observations/assets/scene_archive.json",
        outputHash: "sha256:scene-archive",
        promptPath: "provider_observations/assets/scene_archive.json",
        promptHash: "sha256:prompt-scene",
        usedByShotIds: ["S01", "S02"],
        safeForFutureReference: false,
        textConstraints: ["保持旧书店的木地板、高书架和清晨冷光"],
        sourceRefs: ["visual_memory.scenes:0"],
        issues: ["candidate_draft_only"],
      },
    ],
  },
  taskRuns: { jobs: [], runs: [], taskViews: [], queueSummary: { total: 0, ready: 0, blocked: 0, parked: 0, succeeded: 0, missingOutputs: 0 }, preflightSummary: { blocked: 0, warnings: 0, blockers: [] } },
  manifestMatches: { summary: { complete: 0, present: 0, missing: 0, recoverable: 0 }, reports: [] },
  imagePipeline: { promptPlans: [], promptConflictReports: [], assetReadinessReports: [], imageTaskPlans: [], image2AdapterRequests: [], watcherEvents: [], generationHealthReports: [], qaPromotionReports: [], imageReferenceTransports: [], imageReferenceDeliveryReceipts: [] },
  previewEvents: [],
} as any;

const previewItems = [{
  id: "returned_s01_start",
  kind: "image_hold",
  shotId: "S01",
  startSeconds: 0,
  durationSeconds: 5,
  mediaPath: "outputs/shots/S01/start.png",
  label: "S01",
  reviewRequired: true,
  sourceReceiptId: "provider_receipt_s01",
  outputHash: "sha256:shot-s01",
  promptText: "生成 S01 的镜头参考。",
}, {
  id: "stale_s02_without_receipt",
  kind: "image_hold",
  shotId: "S02",
  startSeconds: 5,
  durationSeconds: 5,
  mediaPath: "outputs/shots/S02/start.png",
  label: "S02",
  reviewRequired: true,
}] as any[];

const projection = buildCreatorDeskProjection({
  runtimeState,
  previewItems,
  image2BatchState,
  selectedShotIds: ["S01"],
});

assert(projection.agentCommand.kind === "open_review", "needs-review references should route the primary Agent command to review");
assert(projection.agentCommand.label === "检查画面", "needs-review references should use creator-facing review copy");
assert(projection.reviewTray.counts.needs_review === 4, "generated asset references and returned shot reference should all enter review");
assert(!projection.reviewTray.items.some((item) => item.id === "stale_s02_without_receipt"), "shot previews without receipt/hash evidence should not create disabled review buttons");
const storyboardItem = projection.reviewTray.items.find((item) => item.assetId === "storyboard_reference_s01");
assert(storyboardItem?.referenceKind === "storyboard_reference", "storyboard visual memory assets should be marked as storyboard references");
assert(storyboardItem?.assetType === "shot_reference", "storyboard review items should bind as shot references by default");
assert(projection.reviewTray.items[0]?.assetId === "storyboard_reference_s01", "selected-shot storyboard references should be prioritized in the review tray");
assert(projection.reviewTray.items.some((item) => item.assetId === "char_mika" && item.status === "needs_review"), "needs_review visual-memory asset must be visible in Review Tray");
assert(projection.reviewTray.items.some((item) => item.assetId === "scene_archive" && item.status === "needs_review"), "candidate visual-memory asset must be visible in Review Tray");
const characterItem = projection.reviewTray.items.find((item) => item.assetId === "char_mika");
assert(characterItem?.mediaPath === "assets/generated/char_mika.png", "review item should carry the generated image path");
assert(characterItem?.sourceReceiptId === "mock_lanyi_image2_asset_char_mika", "review item should carry lock receipt evidence");
assert(characterItem?.outputHash === "sha256:char-mika", "review item should carry output hash evidence");
assert(characterItem?.promptText?.includes("角色身份参考"), "review item should carry visible generation prompt text");

const assetLibrary = createAssetLibraryFromRuntimeState(runtimeState);
assert(assetLibrary.assets.some((asset) => asset.id === "char_mika" && asset.status === "review"), "Asset Library should project needs_review assets as review items");
assert(assetLibrary.assets.some((asset) => asset.id === "scene_archive" && asset.status === "candidate"), "Asset Library should preserve candidate assets");

const lockedRuntimeState = {
  ...runtimeState,
  sourceIndex: {
    ...runtimeState.sourceIndex,
    lockedReferenceIds: ["storyboard_reference_s01", "char_mika", "scene_archive"],
    candidateReferenceIds: [],
  },
  sourceIndexSummary: {
    ...runtimeState.sourceIndexSummary,
    lockedReferenceCount: 2,
    candidateReferenceCount: 0,
    blockingReferenceCount: 0,
    isProductionReady: true,
  },
  visualMemory: {
    ...runtimeState.visualMemory,
    summary: { ...runtimeState.visualMemory.summary, locked: 3, needsReview: 0 },
    assets: runtimeState.visualMemory.assets.map((asset: any) => ({
      ...asset,
      lockedStatus: "locked",
      safeForFutureReference: true,
      issues: [],
    })),
  },
};

const lockedProjection = buildCreatorDeskProjection({
  runtimeState: lockedRuntimeState,
  previewItems: [],
  image2BatchState: { status: "ready_for_review", summary: { ...image2BatchState.summary, readyCount: 0, plannedCount: 2, blockedCount: 0, items: [] } } as any,
  selectedShotIds: ["S01"],
});
assert(lockedProjection.reviewTray.counts.needs_review === 0, "locking references should clear the review count");
assert(lockedProjection.reviewTray.counts.locked === 3, "locking references should refresh locked counts");
assert(lockedProjection.videoGeneration.status === "not_generated", "after lock, video plan should be ready to submit rather than already submitted");
assert(lockedProjection.agentCommand.kind === "submit_video", "locked references should make the primary Agent command submit video");
assert(lockedProjection.agentCommand.label === "发送视频", "video-ready projects should use one submit-video primary label");
const lockedProjectVibe = createProjectVibeFromRuntimeState(lockedRuntimeState);
assert(lockedProjectVibe.assets.every((asset) => asset.status === "locked"), "Project.vibe projection should refresh locked assets");
assert(lockedProjectVibe.visualMemory.entries.every((entry) => entry.status === "locked" && entry.canUseAsFutureReference), "locked visual memory should become future-reference safe");

const noReferenceRuntimeState = {
  ...runtimeState,
  visualMemory: {
    summary: { total: 0, existing: 0, locked: 0, needsReview: 0, missing: 0, byType: [] },
    assets: [],
  },
};
const noReferenceProjection = buildCreatorDeskProjection({
  runtimeState: noReferenceRuntimeState,
  previewItems: [],
  image2BatchState: { status: "idle", message: "还没开始" } as any,
  selectedShotIds: ["S01"],
});
assert(noReferenceProjection.preflight.status === "needs_references", "story projects with no reference assets must not look video-ready");
assert(noReferenceProjection.preflight.nextAction === "生成参考", "no-reference projects should ask to prepare references first");
assert(noReferenceProjection.agentCommand.kind === "generate_references", "missing references should route the primary Agent command to reference generation");
assert(noReferenceProjection.batchGeneration.missingCount === 2, "no-reference projects should count missing references by shot");
assert(noReferenceProjection.reviewTray.counts.missing === 2, "review tray should expose missing reference pressure for no-reference projects");

const referenceRunningProjection = buildCreatorDeskProjection({
  runtimeState: noReferenceRuntimeState,
  previewItems: [],
  image2BatchState: { status: "running", message: "正在生成参考" } as any,
  selectedShotIds: ["S01"],
});
assert(referenceRunningProjection.agentCommand.kind === "wait_references", "running reference generation should disable the primary Agent command as a wait state");
assert(referenceRunningProjection.agentCommand.label === "等待参考", "running reference generation should not expose another generate button");

const partialRelayProjection = buildCreatorDeskProjection({
  runtimeState: lockedRuntimeState,
  previewItems: [],
  image2BatchState: { status: "ready_for_review", summary: { ...image2BatchState.summary, readyCount: 0, plannedCount: 2, blockedCount: 0, items: [] } } as any,
  selectedShotIds: ["S01"],
  relayQueue: {
    status: "running",
    counts: { total: 2, ready: 0, active: 1, completed: 1, failed: 0, blocked: 0 },
    activeItemIds: ["seedance_segment_2"],
    items: [
      { id: "seedance_segment_1", segmentId: "seedance_segment_1", shotId: "S01", status: "success", submitId: "first-submit", localMediaPaths: ["video/first.mp4"], outputVideoPath: "video/first.mp4" },
      { id: "seedance_segment_2", segmentId: "seedance_segment_2", shotId: "S02", title: "第二段", status: "recoverable_queued", submitId: "second-submit", referencePaths: ["refs/s02_storyboard.png", "refs/s02_character.png"], localMediaPaths: [] },
    ],
    resumeCommands: ["dreamina query_result --submit_id=first-submit"],
    autoSubmitAllowed: false,
    storyboardConfirmed: true,
    maxConcurrentVideoJobs: 1,
  } as any,
});
assert(partialRelayProjection.videoGeneration.status !== "completed", "a partially completed relay queue with an active segment must not look fully complete");
assert(partialRelayProjection.preflight.checks.find((check) => check.id === "video")?.state === "waiting", "active relay queues should keep the preflight video check waiting");
assert(partialRelayProjection.videoGeneration.queueSummary?.includes("第 2/2 段") && partialRelayProjection.videoGeneration.queueSummary.includes("排队中"), "active relay queues should expose a human-readable current segment summary");
assert(partialRelayProjection.videoGeneration.taskFacts.some((fact) => fact.label === "当前段" && fact.value === "第二段"), "active relay queues should expose the current segment as task evidence");
assert(partialRelayProjection.videoGeneration.taskFacts.some((fact) => fact.label === "提交号" && fact.value === "second-submit"), "active relay queues should expose the submit id as task evidence");
assert(partialRelayProjection.videoGeneration.taskFacts.some((fact) => fact.label === "输入参考" && fact.value === "2 张参考"), "active relay queues should expose reference input evidence");
assert(partialRelayProjection.videoGeneration.taskFacts.some((fact) => fact.label === "下一步" && fact.value.includes("查询结果")), "active relay queues should expose a user-facing next step");
assert(partialRelayProjection.agentCommand.kind === "resume_video", "recoverable active relay queues should route the primary Agent command to result query");
assert(partialRelayProjection.agentCommand.label === "查询结果", "recoverable active relay queues should not expose duplicate submit copy");

const failedWithNextRelayProjection = buildCreatorDeskProjection({
  runtimeState: lockedRuntimeState,
  previewItems: [],
  image2BatchState: { status: "ready_for_review", summary: { ...image2BatchState.summary, readyCount: 0, plannedCount: 2, blockedCount: 0, items: [] } } as any,
  selectedShotIds: ["S01"],
  relayQueue: {
    status: "running",
    counts: { total: 3, ready: 1, active: 0, completed: 0, failed: 1, blocked: 0 },
    activeItemIds: [],
    items: [
      { id: "seedance_segment_1", segmentId: "seedance_segment_1", shotId: "S01", title: "失败段", status: "failed", submitId: "failed-submit", localMediaPaths: [], blockers: ["generation failed"] },
      { id: "seedance_segment_2", segmentId: "seedance_segment_2", shotId: "S02", title: "下一段", status: "ready", localMediaPaths: [] },
    ],
    resumeCommands: [],
    autoSubmitAllowed: true,
    storyboardConfirmed: true,
    maxConcurrentVideoJobs: 1,
  } as any,
});
assert(failedWithNextRelayProjection.videoGeneration.status === "failed", "failed relay queues with no active item should not look recoverable or running");
assert(failedWithNextRelayProjection.videoGeneration.canContinueAfterFailure, "failed relay queues with a ready next segment should expose continue-after-failure intent");
assert(failedWithNextRelayProjection.videoGeneration.queueSummary?.includes("1 段失败") && failedWithNextRelayProjection.videoGeneration.queueSummary.includes("1 段待提交"), "failed relay queues should summarize failed and ready segments together");
assert(failedWithNextRelayProjection.videoGeneration.taskFacts.some((fact) => fact.label === "失败原因" && fact.value.includes("generation failed")), "failed relay queues should expose failure reasons as task evidence");
assert(failedWithNextRelayProjection.videoGeneration.taskFacts.some((fact) => fact.label === "下一步" && fact.value.includes("继续下一段")), "failed relay queues should expose continue-next guidance as task evidence");
assert(failedWithNextRelayProjection.agentStage.primaryAction === "继续下一段", "Agent primary action should tell the user they can continue the next segment after a failure");
assert(failedWithNextRelayProjection.agentCommand.kind === "submit_video", "continue-after-failure should still route through the serial video submit action");

const completedRelayProjection = buildCreatorDeskProjection({
  runtimeState: lockedRuntimeState,
  previewItems: [],
  image2BatchState: { status: "ready_for_review", summary: { ...image2BatchState.summary, readyCount: 0, plannedCount: 2, blockedCount: 0, items: [] } } as any,
  selectedShotIds: ["S01"],
  relayQueue: {
    status: "complete",
    counts: { total: 1, ready: 0, active: 0, completed: 1, failed: 0, blocked: 0 },
    activeItemIds: [],
    items: [
      { id: "seedance_segment_1", segmentId: "seedance_segment_1", shotId: "S01", status: "success", submitId: "first-submit", localMediaPaths: ["video/first.mp4"], outputVideoPath: "video/first.mp4" },
    ],
    resumeCommands: [],
    autoSubmitAllowed: false,
    storyboardConfirmed: true,
    maxConcurrentVideoJobs: 1,
  } as any,
});
assert(completedRelayProjection.videoGeneration.status === "completed", "completed relay queues should project completed video status");
assert(completedRelayProjection.videoGeneration.recoverableCount === 0, "completed relay queues must not treat historical resume commands as active recoverable work");
assert(completedRelayProjection.videoGeneration.taskFacts.some((fact) => fact.label === "输出" && fact.value.includes("video/first.mp4")), "completed relay queues should expose returned video output evidence");
assert(completedRelayProjection.preflight.status === "needs_review", "completed relay queues with local videos should require video review even before preview items sync");
assert(completedRelayProjection.preflight.checks.find((check) => check.id === "video")?.detail === "待复核", "completed relay videos should enter the shared video review check");
assert(completedRelayProjection.agentCommand.kind === "open_preview", "completed videos that still need review should route the primary Agent command to preview review");
assert(completedRelayProjection.agentCommand.label === "检查视频", "completed videos that need review should not jump directly to export");

const returnedVideoProjection = buildCreatorDeskProjection({
  runtimeState: lockedRuntimeState,
  previewItems: [{
    id: "returned_video_s01",
    kind: "video",
    shotId: "S01",
    startSeconds: 0,
    durationSeconds: 4,
    mediaPath: "video/first.mp4",
    label: "S01",
    status: "returned_with_review_overlay",
    videoStatus: "success",
    reviewRequired: true,
  }] as any[],
  image2BatchState: { status: "ready_for_review", summary: { ...image2BatchState.summary, readyCount: 0, plannedCount: 2, blockedCount: 0, items: [] } } as any,
  selectedShotIds: ["S01"],
});
assert(returnedVideoProjection.videoGeneration.status === "completed", "returned video preview items should count as completed even without relay queue state");
assert(returnedVideoProjection.preflight.status === "needs_review", "returned video preview items should put the shared preflight into review state");
assert(returnedVideoProjection.preflight.summary === "视频已经回来，先看一眼再继续。", "returned video review should be explained from the shared projection, not a UI fallback");
assert(returnedVideoProjection.preflight.checks.find((check) => check.id === "video")?.detail === "待复核", "returned video preview items should show video as waiting for review");
assert(returnedVideoProjection.preflight.checks.find((check) => check.id === "references")?.state !== "needs_review", "returned videos must not inflate reference-review counts");
assert(returnedVideoProjection.agentCommand.kind === "open_preview", "returned videos should keep the primary Agent command on preview review");

const emptyProjection = buildCreatorDeskProjection({
  runtimeState: {
    ...runtimeState,
    storyFlow: { sections: [], shots: [] },
    visualMemory: {
      summary: { total: 0, existing: 0, locked: 0, needsReview: 0, missing: 0, byType: [] },
      assets: [],
    },
  } as any,
  previewItems: [],
  image2BatchState: { status: "idle" } as any,
  selectedShotIds: [],
});
assert(emptyProjection.agentCommand.kind === "send_idea", "empty projects should keep the primary Agent command on idea input");
assert(emptyProjection.agentCommand.label === "发送想法", "empty projects should not expose generation or video actions");

const creatorDeskPanelsSource = readFileSync("src/ui/director/CreatorDeskPanels.tsx", "utf8");
const creatorDeskProjectionSource = readFileSync("src/ui/app/creatorDeskProjection.ts", "utf8");
assert(/通过并锁定/.test(creatorDeskPanelsSource), "Review Tray should expose pass-and-lock action");
assert(/重试/.test(creatorDeskPanelsSource), "Review Tray should expose retry action");
assert(/绑定为\{reviewLockLabels\[target\]\}/.test(creatorDeskPanelsSource), "Review Tray should expose object binding targets");
assert(/查看说明/.test(creatorDeskPanelsSource), "Review Tray should expose prompt review entry");
assert(/needs_review/.test(creatorDeskPanelsSource) && /hasHiddenInternalCopy/.test(creatorDeskPanelsSource), "Review Tray should hide raw needs_review copy from item details");
assert(/input\.preflight\.status === "ready"[\s\S]*primaryAction:\s*"发送视频"/.test(creatorDeskProjectionSource), "Creator desk should surface submit-video as the Agent stage after review clears");
assert(/function\s+previewItemIsReturnedVideoForReview[\s\S]*videoNeedsReview[\s\S]*视频已经回来，先看一眼再继续/.test(creatorDeskProjectionSource), "Creator desk should derive returned-video review state inside the shared projection");
assert(!/function\s+reviewTrayHasReturnedVideo/.test(creatorDeskPanelsSource), "Creator desk panel should not patch returned-video state from the review tray");

console.log("creator-desk-p4-review-loop-test: ok");
