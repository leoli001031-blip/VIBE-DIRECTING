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
    summary: { total: 2, existing: 2, locked: 0, needsReview: 2, missing: 0, byType: [] },
    assets: [
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

assert(projection.reviewTray.counts.needs_review === 3, "generated asset references and returned shot reference should all enter review");
assert(!projection.reviewTray.items.some((item) => item.id === "stale_s02_without_receipt"), "shot previews without receipt/hash evidence should not create disabled review buttons");
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
    lockedReferenceIds: ["char_mika", "scene_archive"],
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
    summary: { ...runtimeState.visualMemory.summary, locked: 2, needsReview: 0 },
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
assert(lockedProjection.reviewTray.counts.locked === 2, "locking references should refresh locked counts");
assert(lockedProjection.videoGeneration.status === "not_generated", "after lock, video plan should be ready to submit rather than already submitted");
const lockedProjectVibe = createProjectVibeFromRuntimeState(lockedRuntimeState);
assert(lockedProjectVibe.assets.every((asset) => asset.status === "locked"), "Project.vibe projection should refresh locked assets");
assert(lockedProjectVibe.visualMemory.entries.every((entry) => entry.status === "locked" && entry.canUseAsFutureReference), "locked visual memory should become future-reference safe");

const creatorDeskPanelsSource = readFileSync("src/ui/director/CreatorDeskPanels.tsx", "utf8");
assert(/通过并锁定/.test(creatorDeskPanelsSource), "Review Tray should expose pass-and-lock action");
assert(/重试/.test(creatorDeskPanelsSource), "Review Tray should expose retry action");
assert(/绑定为\{reviewLockLabels\[target\]\}/.test(creatorDeskPanelsSource), "Review Tray should expose object binding targets");
assert(/查看生成说明/.test(creatorDeskPanelsSource), "Review Tray should expose prompt review entry");
assert(/needs_review/.test(creatorDeskPanelsSource) && /hasHiddenInternalCopy/.test(creatorDeskPanelsSource), "Review Tray should hide raw needs_review copy from item details");
assert(/videoGeneration\.status === "not_generated"[\s\S]*!pendingCount\(reviewTray\)[\s\S]*return "提交视频"/.test(creatorDeskPanelsSource), "Creator desk should surface submit-video as the next step after review clears");

console.log("creator-desk-p4-review-loop-test: ok");
