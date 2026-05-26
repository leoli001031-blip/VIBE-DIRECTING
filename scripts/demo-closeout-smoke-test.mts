import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildDirectorProductionSkillPlan,
  productionSkillImage2PromptBlock,
  productionSkillSeedancePromptBlock,
} from "../src/core/directorProductionSkill.ts";
import { buildCreatorDeskProjection } from "../src/ui/app/creatorDeskProjection.ts";

const lockedAssets = {
  scene: "locked" as const,
  characters: "locked" as const,
  props: "locked" as const,
};

const narrative = buildDirectorProductionSkillPlan({
  shotId: "DEMO_NARRATIVE",
  title: "雨夜店门口的停顿",
  durationSeconds: 6,
  executionMode: "relationship_wide",
  referenceStrategy: "storyboard_narrative",
  shotText: "女孩撑伞站在便利店门口，灯光照在积水里，她回头看向街角的黑影。",
  actionBeats: ["伞沿滴水", "便利店门打开", "女孩回头"],
  userPreference: "克制的 1990 年代日本 TV 动画，安静悬疑。",
  assetState: lockedAssets,
});

assert.equal(narrative.strategyId, "storyboard_narrative", "quiet relationship scene should keep storyboard narrative route");
assert(narrative.panelCountIntent >= 1, "narrative storyboard should keep at least one panel intent");

const rapidCut = buildDirectorProductionSkillPlan({
  shotId: "DEMO_RAPID",
  title: "山路启动快切",
  durationSeconds: 8,
  executionMode: "planned_cut_sequence",
  referenceStrategy: "storyboard_rapid_cut",
  shotText: "雨夜山路，两辆车同时启动，霓虹闪、脚踏、轮胎溅水、车灯拉线、弯道擦肩。",
  actionBeats: ["霓虹闪", "踩下踏板", "轮胎溅水", "车灯拉线", "弯道擦肩"],
  userPreference: "日漫赛车快切，动作清楚，不要真人写实。",
  assetState: lockedAssets,
});

assert.equal(rapidCut.strategyId, "storyboard_rapid_cut", "fast action chain should route to rapid-cut storyboard");
assert(rapidCut.panelCountIntent >= 4, "rapid-cut storyboard should reserve enough panels for action beats");
const rapidImage2Prompt = productionSkillImage2PromptBlock(rapidCut);
const rapidSeedancePrompt = productionSkillSeedancePromptBlock(rapidCut);
assert(/RED\s*=\s*camera/i.test(rapidImage2Prompt), "rapid-cut Image2 prompt should include internal camera annotation key");
assert(/Do not render storyboard artifacts/i.test(rapidSeedancePrompt), "Seedance prompt must strip storyboard artifacts");
assert(/No arrows, colored lines/i.test(rapidSeedancePrompt), "Seedance prompt must forbid visible production marks");
assert(/no\s*BGM|No music|无BGM|无音乐/i.test(rapidSeedancePrompt), "Seedance prompt must keep no-BGM contract");

const omni = buildDirectorProductionSkillPlan({
  shotId: "DEMO_OMNI",
  title: "发光车票特写",
  durationSeconds: 4,
  executionMode: "action_insert",
  referenceStrategy: "omni_reference",
  shotText: "旧书页翻开，发光车票露出，少女指尖停住，光映在纸纹和校服袖口上。",
  actionBeats: ["书页翻开", "车票发光", "指尖停住"],
  userPreference: "单个插入镜头，干净构图。",
  assetState: lockedAssets,
});

assert.equal(omni.strategyId, "omni_reference", "simple insert should route to omni reference");
assert.equal(omni.image2Directive.mode, "none", "omni reference should not request extra storyboard generation");
assert.equal(omni.panelCountIntent, 0, "omni reference should not fabricate storyboard panel intent");

const runtimeState = {
  generatedAt: "2026-05-26T00:00:00.000Z",
  project: { title: "Demo Closeout", root: "projects/demo-closeout", sourceTask: "", importedAt: "2026-05-26T00:00:00.000Z", state: "ready", metrics: {} },
  sourceIndex: {
    projectId: "demo_closeout",
    projectVersion: "0.1.0",
    sourceIndexHash: "sha256:demo",
    currentProductionBibleId: "",
    currentStoryFlowId: "story_flow",
    currentVisualMemoryId: "visual_memory",
    currentPromptHashes: {},
    lockedReferenceIds: [],
    candidateReferenceIds: ["storyboard_reference_s02", "char_girl", "scene_store"],
    rejectedReferenceIds: [],
    failedReferenceIds: [],
    confirmedDecisionIds: [],
    staleArtifactIds: [],
    updatedAt: "2026-05-26T00:00:00.000Z",
  },
  sourceIndexSummary: {
    projectId: "demo_closeout",
    lockedReferenceCount: 0,
    candidateReferenceCount: 3,
    rejectedReferenceCount: 0,
    failedReferenceCount: 0,
    staleArtifactCount: 0,
    blockingReferenceCount: 3,
    isProductionReady: false,
    updatedAt: "2026-05-26T00:00:00.000Z",
  },
  storyFlow: {
    sections: [{ id: "act_1", label: "开场", shotCount: 3, blockedCount: 0, readyCount: 3, shotIds: ["S01", "S02", "S03"] }],
    shots: [
      { id: "S01", actId: "act_1", sectionId: "act_1", title: "店门口", storyFunction: "雨夜停顿。", status: "assets_ready", gates: { identity: "UNKNOWN", scene: "UNKNOWN", pair: "N/A", story: "PASS", prop: "N/A", style: "UNKNOWN" }, issues: [] },
      { id: "S02", actId: "act_1", sectionId: "act_1", title: "启动快切", storyFunction: "车灯、轮胎和山路启动节奏。", status: "assets_ready", gates: { identity: "UNKNOWN", scene: "PASS", pair: "N/A", story: "PASS", prop: "PASS", style: "UNKNOWN" }, issues: [] },
      { id: "S03", actId: "act_1", sectionId: "act_1", title: "街角反应", storyFunction: "女孩回头。", status: "assets_ready", gates: { identity: "PASS", scene: "UNKNOWN", pair: "N/A", story: "PASS", prop: "N/A", style: "UNKNOWN" }, issues: [] },
    ],
  },
  visualMemory: {
    summary: { total: 3, existing: 3, locked: 0, needsReview: 3, missing: 0, byType: [] },
    assets: [
      {
        id: "char_girl",
        type: "character",
        name: "女孩角色参考",
        path: "assets/generated/char_girl.png",
        status: "exists",
        lockedStatus: "needs_review",
        sourceReceiptId: "receipt_char",
        outputHash: "sha256:char",
        usedByShotIds: ["S01", "S03"],
        safeForFutureReference: false,
        textConstraints: ["短发、校服、雨伞"],
        sourceRefs: ["visual_memory.roles:0"],
        issues: ["needs_review"],
      },
      {
        id: "scene_store",
        type: "scene",
        name: "雨夜便利店场景参考",
        path: "assets/generated/scene_store.png",
        status: "exists",
        lockedStatus: "candidate",
        sourceReceiptId: "receipt_scene",
        outputHash: "sha256:scene",
        usedByShotIds: ["S01", "S02"],
        safeForFutureReference: false,
        textConstraints: ["雨夜便利店、湿路、霓虹"],
        sourceRefs: ["visual_memory.scenes:0"],
        issues: ["candidate"],
      },
      {
        id: "storyboard_reference_s02",
        type: "prop",
        name: "启动快切故事板参考",
        path: "assets/generated/storyboard_s02.png",
        status: "exists",
        lockedStatus: "needs_review",
        sourceReceiptId: "receipt_storyboard",
        outputHash: "sha256:storyboard",
        usedByShotIds: ["S02"],
        safeForFutureReference: false,
        textConstraints: ["故事板参考：用于构图、动作、切镜节奏，不替代角色和场景设定。"],
        roleBinding: { role: "storyboard_reference", useFor: ["构图", "动作", "切镜节奏"], ignoreFor: ["角色身份", "场景设定"] },
        sourceRefs: ["visual_memory.storyboard:0"],
        issues: ["needs_review"],
      },
    ],
  },
  taskRuns: { jobs: [], runs: [], taskViews: [], queueSummary: { total: 0, ready: 0, blocked: 0, parked: 0, succeeded: 0, missingOutputs: 0 }, preflightSummary: { blocked: 0, warnings: 0, blockers: [] } },
  manifestMatches: { summary: { complete: 0, present: 0, missing: 0, recoverable: 0 }, reports: [] },
  imagePipeline: { promptPlans: [], promptConflictReports: [], assetReadinessReports: [], imageTaskPlans: [], image2AdapterRequests: [], watcherEvents: [], generationHealthReports: [], qaPromotionReports: [], imageReferenceTransports: [], imageReferenceDeliveryReceipts: [] },
  previewEvents: [],
} as any;

const creatorDesk = buildCreatorDeskProjection({
  runtimeState,
  previewItems: [],
  image2BatchState: { status: "ready_for_review", summary: undefined } as any,
  selectedShotIds: ["S02"],
});

assert.equal(creatorDesk.reviewTray.items[0]?.assetId, "storyboard_reference_s02", "selected-shot storyboard reference should be first in review tray");
assert.equal(creatorDesk.reviewTray.items[0]?.referenceKind, "storyboard_reference", "storyboard reference should be typed for creator UI");
assert.equal(creatorDesk.reviewTray.items[0]?.assetType, "shot_reference", "storyboard reference should default to shot-reference locking");

const newVideoStartSource = readFileSync("src/ui/director/NewVideoStart.tsx", "utf8");
const creatorDeskPanelsSource = readFileSync("src/ui/director/CreatorDeskPanels.tsx", "utf8");
assert(!/整理草案/.test(newVideoStartSource), "new-video composer should not expose the old draft-organize button copy");
assert(/和 AI 导演说/.test(newVideoStartSource), "new-video screen should keep the unified creator input language");
assert(/发送/.test(newVideoStartSource), "new-video composer should expose a single send action");
assert(/已等待/.test(newVideoStartSource), "AI planning should show elapsed waiting feedback instead of a silent spinner");
assert(/不会生图或提交视频/.test(newVideoStartSource), "AI planning waiting copy should make the safe boundary clear");
assert(/故事板参考/.test(creatorDeskPanelsSource), "creator desk should surface storyboard references as creator-facing review items");

console.log("demo-closeout-smoke-test: ok");
