import {
  buildProjectFolderInboxProjection,
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
  asset({
    id: "folder_character",
    type: "unknown",
    name: "lin-an.png",
    path: "/project/characters/lin-an.png",
  }),
  asset({
    id: "folder_scene",
    type: "unknown",
    name: "rain-station.png",
    path: "/project/scenes/rain-station.png",
  }),
  asset({
    id: "folder_prop",
    type: "unknown",
    name: "glowing-ticket.png",
    path: "/project/props/glowing-ticket.png",
  }),
  asset({
    id: "folder_script",
    type: "unknown",
    name: "pilot.md",
    path: "/project/scripts/pilot.md",
  }),
  asset({
    id: "folder_video",
    type: "unknown",
    name: "returned-shot.mp4",
    path: "/project/videos/returned-shot.mp4",
  }),
  asset({
    id: "folder_export",
    type: "unknown",
    name: "final-package.zip",
    path: "/project/exports/final-package.zip",
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
assert(inbox.items.some((item) => item.assetId === "folder_character" && item.kind === "character"), "character folders should classify imported images as character references");
assert(inbox.items.some((item) => item.assetId === "folder_character" && item.originLabel === "项目素材"), "ordinary project assets should keep project-material provenance");
assert(inbox.items.some((item) => item.assetId === "folder_scene" && item.kind === "scene"), "scene folders should classify imported images as scene references");
assert(inbox.items.some((item) => item.assetId === "folder_prop" && item.kind === "prop"), "prop folders should classify imported images as prop references");
assert(inbox.items.some((item) => item.assetId === "folder_script" && item.kind === "script"), "script folders should classify text files as scripts");
assert(inbox.items.some((item) => item.assetId === "folder_video" && item.kind === "video"), "video folders should classify returned clips as video materials");
assert(inbox.items.some((item) => item.assetId === "folder_export" && item.kind === "export"), "export folders should classify final packages as delivery materials");
assert(inbox.items.some((item) => item.assetId === "folder_video" && item.suggestedBinding.includes("回流视频")), "video folder items should explain they are returned clips or edit materials");
assert(inbox.items.some((item) => item.assetId === "folder_export" && item.suggestedBinding.includes("交付页")), "export folder items should route to delivery review");
assert(!inbox.items.some((item) => item.suggestedBinding.includes("配乐参考")), "demo inbox should not expose music-reference routing");
assert(inbox.items.every((item) => item.suggestedBinding), "inbox items should explain suggested binding");
assert(!inbox.items.some((item) => item.suggestedBinding.includes("参考参考")), "style/reference inbox copy must not say 参考参考");
assert(!inbox.items.some((item) => /shot_/.test(item.suggestedBinding)), "inbox binding copy must not expose raw shot ids");
assert(inbox.items.some((item) => item.suggestedBinding.includes("镜头 1")), "inbox binding copy should use human-readable shot labels");

const emptyInbox = buildProjectInboxProjection({ assets: [] });
assert(emptyInbox.summary.includes("声音参考"), "empty inbox should ask for voice reference instead of music");
assert(!emptyInbox.summary.includes("音乐"), "music analysis/mixing should stay out of the demo inbox copy");

const folderInbox = buildProjectFolderInboxProjection({
  files: [
    { path: "characters/lin-an/front.png", sizeBytes: 1024 },
    { path: "scenes/rain-station/wide.jpg" },
    { path: "props/glowing-ticket.webp" },
    { path: "storyboards/shot-01-board.png" },
    { path: "voices/heroine.wav" },
    { path: "scripts/episode-01.md" },
    { path: "videos/returned-shot.mp4" },
    { path: "exports/final-package.zip" },
    { path: ".DS_Store" },
    { path: "../outside.png" },
  ],
  existingAssets: [
    asset({
      id: "existing_prop",
      type: "prop",
      name: "已存在道具",
      path: "props/existing.png",
      lockedStatus: "locked",
    }),
  ],
});

assert(folderInbox.discoveredAssetCount === 8, "folder scan should discover supported project files and ignore hidden/outside files");
assert(folderInbox.ignoredCount === 2, "folder scan should count hidden or out-of-scope files as ignored");
assert(folderInbox.discoveredAssets.every((item) => !item.path.startsWith("/")), "folder scan must keep project-relative paths instead of leaking local absolute paths");
assert(folderInbox.items.some((item) => item.kind === "character" && item.label === "front.png"), "folder scan should classify character folders");
assert(folderInbox.items.some((item) => item.kind === "character" && item.origin === "project_folder" && item.originLabel === "项目文件夹"), "folder scan inbox items should show they came from the project folder");
assert(folderInbox.items.some((item) => item.kind === "scene" && item.label === "wide.jpg"), "folder scan should classify scene folders");
assert(folderInbox.items.some((item) => item.kind === "prop" && item.label === "glowing-ticket.webp"), "folder scan should classify prop folders");
assert(folderInbox.items.some((item) => item.kind === "storyboard" && item.suggestedBinding.includes("故事板参考")), "folder scan should surface storyboards as reviewable planning references");
assert(folderInbox.items.some((item) => item.kind === "voice" && item.label === "heroine.wav"), "folder scan should classify voice folders");
assert(folderInbox.items.some((item) => item.kind === "script" && item.label === "episode-01.md"), "folder scan should classify scripts");
assert(folderInbox.items.some((item) => item.kind === "video" && item.label === "returned-shot.mp4"), "folder scan should classify returned videos");
assert(folderInbox.items.some((item) => item.kind === "export" && item.label === "final-package.zip"), "folder scan should classify export packages");
assert(folderInbox.summary.includes("从项目文件夹识别到 8 个可用素材"), "folder scan summary should explain the takeover result in human language");
assert(folderInbox.nextAction.includes("确认后再继续生成"), "folder scan next action should make the next step obvious");

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
assert(observation.currentTask.confirmation.kind === "asset_review", "project-folder materials should be reviewed before generating new references");
assert(observation.nextAction.includes("复核"), "observation should recommend reviewing reusable folder materials before generating more");
assert(observation.references.detail.includes("需要你看一眼"), "observation should explain that folder-classified references need review");

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

const explicitFirstVideoRoute = routeProjectAgentIntent({
  text: "现在可以提交第一段视频",
  hasSelection: false,
  hasAttachments: false,
  observation,
});
assert(explicitFirstVideoRoute.kind === "video", "explicit first-segment video permission should route to video preparation");
assert(explicitFirstVideoRoute.confirmation === "video_submit", "explicit video permission should still keep the confirmation boundary");

const continueRoute = routeProjectAgentIntent({
  text: "没问题，继续",
  hasSelection: false,
  hasAttachments: false,
  observation,
});
assert(continueRoute.kind === "reference", "simple continue wording should follow the observed next project action");
assert(continueRoute.confirmation === observation.currentTask.confirmation.kind, "continue route should preserve the current confirmation boundary");

const referenceOnlyRoute = routeProjectAgentIntent({
  text: "先别生成视频，只补参考",
  hasSelection: false,
  hasAttachments: false,
  observation,
});
assert(referenceOnlyRoute.kind === "reference", "no-video reference-only wording should route to reference preparation");
assert(referenceOnlyRoute.confirmation === "reference_generation", "reference-only wording should keep video submission blocked");

const generateReferenceOnlyRoute = routeProjectAgentIntent({
  text: "先不要提交视频，只生成参考图",
  hasSelection: false,
  hasAttachments: false,
  observation,
});
assert(generateReferenceOnlyRoute.kind === "reference", "reference-only generation wording must not be confused with video generation");
assert(generateReferenceOnlyRoute.confirmation === "reference_generation", "reference-only generation wording should stay inside reference confirmation");

const shotRevisionRoute = routeProjectAgentIntent({
  text: "第二个镜头再压迫一点",
  hasSelection: false,
  hasAttachments: false,
  observation,
});
assert(shotRevisionRoute.kind === "revision", "shot-specific creative notes should route to revision even without a selected card");

const styleResearchRoute = routeProjectAgentIntent({
  text: "查一下这种 90 年代日漫分镜怎么做",
  hasSelection: false,
  hasAttachments: false,
  observation,
});
assert(styleResearchRoute.kind === "research", "style/storyboard research wording should route to research");

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

const videoReadyObservation = buildProjectObservation({
  localProjectReady: true,
  projectTitle: "山路短片",
  sectionCount: 1,
  shotCount: shots.length,
  selectedShotCount: 0,
  referenceMissingCount: 0,
  referenceReviewCount: 0,
  referenceReadyCount: 4,
  videoStatus: "not_generated",
  videoStatusLabel: "未提交视频",
  videoDetail: "参考已经就绪。",
  videoWaitingCount: 0,
  videoCompletedCount: 0,
  videoReviewCount: 0,
  videoCanResume: false,
  image2Running: false,
});

const continueToVideoRoute = routeProjectAgentIntent({
  text: "没问题，继续",
  hasSelection: false,
  hasAttachments: false,
  observation: videoReadyObservation,
});
assert(continueToVideoRoute.kind === "video", "continue intent should submit only after observation says video is ready");
assert(continueToVideoRoute.confirmation === "video_submit", "continue-to-video must still require video confirmation");

const recoverableVideoObservation = buildProjectObservation({
  localProjectReady: true,
  projectTitle: "山路短片",
  sectionCount: 1,
  shotCount: shots.length,
  selectedShotCount: 0,
  referenceMissingCount: 0,
  referenceReviewCount: 0,
  referenceReadyCount: 4,
  videoStatus: "submitted",
  videoStatusLabel: "已发送",
  videoDetail: "即梦任务已提交。",
  videoWaitingCount: 0,
  videoCompletedCount: 0,
  videoReviewCount: 0,
  videoCanResume: true,
  image2Running: false,
});

const continueToQueryRoute = routeProjectAgentIntent({
  text: "可以，继续",
  hasSelection: false,
  hasAttachments: false,
  observation: recoverableVideoObservation,
});
assert(continueToQueryRoute.kind === "video_status", "continue intent should query recoverable submitted video instead of resubmitting");
assert(continueToQueryRoute.confirmation === "none", "video result query should not ask for another submit confirmation");

console.log("project-agent-workspace-test: ok");
