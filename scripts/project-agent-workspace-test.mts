import {
  buildProjectInboxProjection,
  buildProjectObservation,
  routeProjectAgentIntent,
} from "../src/core/projectAgentWorkspace.ts";
import { buildAssetReconciliationProjection } from "../src/core/assetReconciliation.ts";
import type { AssetRecord, ShotRecord } from "../src/core/types/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asset(input: Partial<AssetRecord> & Pick<AssetRecord, "id" | "type" | "name">): AssetRecord {
  return {
    id: input.id,
    type: input.type,
    name: input.name,
    path: input.path || `/project/assets/${input.name}.png`,
    status: input.status || "exists",
    lockedStatus: input.lockedStatus || "candidate",
    safeForFutureReference: input.safeForFutureReference ?? true,
    issues: input.issues || [],
    usedByShotIds: input.usedByShotIds,
    sourceRefs: input.sourceRefs,
    textConstraints: input.textConstraints,
    roleBinding: input.roleBinding,
  };
}

function shot(input: Partial<ShotRecord> & Pick<ShotRecord, "id" | "title">): ShotRecord {
  return {
    id: input.id,
    actId: input.actId || "act_1",
    title: input.title,
    storyFunction: input.storyFunction || input.title,
    status: input.status || "video_missing",
    gates: input.gates || {},
    issues: input.issues || [],
    referenceStrategy: input.referenceStrategy || "omni_reference",
    characterGuidance: input.characterGuidance,
    sceneGuidance: input.sceneGuidance,
    propGuidance: input.propGuidance,
    durationSeconds: input.durationSeconds,
  };
}

const shots = [
  shot({
    id: "shot_1",
    title: "雨夜便利店",
    referenceStrategy: "storyboard_rapid_cut",
    characterGuidance: ["白车车手"],
    sceneGuidance: ["山脚便利店"],
    propGuidance: ["白色双门车", "黑色双门车", "车灯"],
  }),
  shot({
    id: "shot_2",
    title: "弯道追逐",
    characterGuidance: ["白车车手"],
    sceneGuidance: ["山路弯道"],
    propGuidance: ["黑色双门车"],
  }),
];

const assets = [
  asset({
    id: "white_car",
    type: "prop",
    name: "白色双门车",
    lockedStatus: "locked",
    usedByShotIds: ["shot_1"],
  }),
  asset({
    id: "storyboard_start",
    type: "unknown",
    name: "启动故事板",
    path: "/project/assets/storyboard_start.png",
    roleBinding: { role: "storyboard_reference", useFor: ["shot_1"], ignoreFor: [] },
  }),
  asset({
    id: "music_ref",
    type: "unknown",
    name: "eurobeat.wav",
    path: "/project/audio/eurobeat.wav",
    roleBinding: { role: "music_reference", useFor: [], ignoreFor: [] },
  }),
  asset({
    id: "voice_ref",
    type: "unknown",
    name: "少女声音参考，不是配乐.wav",
    path: "/project/audio/voice-not-music.wav",
    roleBinding: { role: "voice_reference", useFor: ["shot_1"], ignoreFor: ["music"] },
  }),
  asset({
    id: "style_ref",
    type: "style",
    name: "quiet anime style",
    path: "/project/assets/style.png",
  }),
];

const reconciliation = buildAssetReconciliationProjection({ shots, assets });
const inbox = buildProjectInboxProjection({ assets, reconciliation });

assert(inbox.totalCount >= 3, "inbox should show imported/project assets");
assert(inbox.items.some((item) => item.kind === "storyboard"), "storyboard references should enter the inbox");
assert(inbox.items.some((item) => item.kind === "reference" && item.label.includes("eurobeat")), "obvious music files should stay out of the voice-reference path");
assert(!inbox.items.some((item) => item.kind === "voice" && item.label.includes("eurobeat")), "music-like audio must not be sent as a character voice reference");
assert(inbox.items.some((item) => item.label.includes("eurobeat") && item.suggestedBinding.includes("后期")), "music-like audio should be parked as later post audio");
assert(inbox.items.some((item) => item.kind === "voice" && item.label.includes("不是配乐")), "voice references that mention not-music should stay voice assets");
assert(inbox.items.some((item) => item.assetId === "voice_ref" && item.shotIds?.includes("shot_1")), "voice inbox item should remain selectable and keep shot binding context");
assert(inbox.items.some((item) => item.assetId === "white_car" && item.shotIds?.includes("shot_1")), "asset inbox item should expose asset and shot ids for correction selection");
assert(!inbox.items.some((item) => item.suggestedBinding.includes("配乐参考")), "demo inbox should not expose music-reference routing");
assert(inbox.items.every((item) => item.suggestedBinding), "inbox items should explain suggested binding");
assert(!inbox.items.some((item) => item.suggestedBinding.includes("参考参考")), "style/reference inbox copy must not say 参考参考");
assert(!inbox.items.some((item) => /shot_/.test(item.suggestedBinding)), "inbox binding copy must not expose raw shot ids");
assert(inbox.items.some((item) => item.suggestedBinding.includes("镜头 1")), "inbox binding copy should use human-readable shot labels");

const emptyInbox = buildProjectInboxProjection({ assets: [] });
assert(emptyInbox.summary.includes("声音参考"), "empty inbox should ask for voice reference instead of music");
assert(!emptyInbox.summary.includes("音乐"), "music analysis/mixing should stay out of the demo inbox copy");

const legacyMusicInbox = buildProjectInboxProjection({
  assets: [],
  reconciliation: {
    summary: { total: 1, matched: 0, needsReview: 1, missing: 0, merged: 0, unused: 0, ambiguous: 0 },
    items: [{
      id: "legacy_music",
      kind: "music_reference",
      label: "旧项目配乐参考",
      status: "needs_review",
      detail: "旧版本留下的配乐参考",
      shotIds: ["shot_1"],
      assetIds: [],
      confidence: "low",
      source: "project_assets",
      reason: "legacy_music_reference",
    }],
    creatorSummary: "legacy",
    nextAction: "legacy",
  },
});
assert(legacyMusicInbox.items.some((item) => item.kind === "reference" && item.label.includes("配乐")), "legacy music references should be displayed as general references");
assert(!legacyMusicInbox.items.some((item) => item.kind === "voice"), "legacy music references must not be reinterpreted as character voice");

const observation = buildProjectObservation({
  localProjectReady: true,
  projectTitle: "山路短片",
  sectionCount: 1,
  shotCount: shots.length,
  selectedShotCount: 1,
  referenceMissingCount: reconciliation.summary.missing,
  referenceReviewCount: reconciliation.summary.needsReview + reconciliation.summary.ambiguous,
  referenceReadyCount: reconciliation.summary.matched,
  videoStatus: "not_generated",
  videoStatusLabel: "未提交视频",
  videoDetail: "先完成参考。",
  videoWaitingCount: 0,
  videoCompletedCount: 0,
  videoReviewCount: 0,
  videoCanResume: false,
  image2Running: false,
  inbox,
});

assert(observation.currentTask.understanding.includes("2 个镜头"), "observation should explain current story count");
assert(observation.currentTask.confirmation.kind === "reference_generation", "missing references should require reference generation confirmation");
assert(observation.nextAction.includes("生成"), "observation should recommend generating references first");
assert(observation.references.detail.includes("角色、场景、道具或故事板参考"), "observation should explain the missing reference categories");

const runningObservation = buildProjectObservation({
  localProjectReady: true,
  projectTitle: "山路短片",
  sectionCount: 1,
  shotCount: shots.length,
  selectedShotCount: 1,
  referenceMissingCount: reconciliation.summary.missing,
  referenceReviewCount: 0,
  referenceReadyCount: reconciliation.summary.matched,
  videoStatus: "not_generated",
  videoStatusLabel: "未提交视频",
  videoDetail: "先完成参考。",
  videoWaitingCount: 0,
  videoCompletedCount: 0,
  videoReviewCount: 0,
  videoCanResume: false,
  image2Running: true,
  inbox,
});

assert(runningObservation.references.label === "参考生成中", "running reference generation should be shown as waiting state");
assert(runningObservation.currentTask.confirmation.kind === "none", "running reference generation should not ask for another confirmation");
assert(runningObservation.currentTask.missing.includes("不需要重复操作"), "running reference generation should tell creators not to repeat the action");

const submitRoute = routeProjectAgentIntent({
  text: "准备提交视频",
  hasSelection: true,
  hasAttachments: false,
  observation,
});
assert(submitRoute.kind === "video", "video intent should route to video preparation");
assert(submitRoute.confirmation === "video_submit", "video submit should require confirmation");

const noSubmitStoryRoute = routeProjectAgentIntent({
  text: "新建一个 12 秒短片，先帮我拆故事、判断参考模式，不要提交视频。",
  hasSelection: true,
  hasAttachments: false,
  observation,
});
assert(noSubmitStoryRoute.kind === "story", "new-story wording with no-video boundary must not route to video preparation");
assert(noSubmitStoryRoute.label === "整理新故事", "new-story wording should ignore the selected shot and start a project-level draft");

const attachmentRoute = routeProjectAgentIntent({
  text: "",
  hasSelection: false,
  hasAttachments: true,
  observation,
});
assert(attachmentRoute.kind === "reference", "attachments should route to material organization");
assert(attachmentRoute.confirmation === "asset_review", "attachments should lead to review before binding");

console.log("project-agent-workspace-test: ok");
