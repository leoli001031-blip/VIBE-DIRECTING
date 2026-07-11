import {
  buildProjectFolderInboxProjection,
  buildProjectInboxProjection,
  buildProjectObservation,
  routeProjectAgentIntent,
} from "../src/core/projectAgentWorkspace.ts";
import {
  buildAgentVideoPipelinePlan,
  buildDefaultAgentVideoProviderCapabilityRegistry,
  createAgentVideoGenerationJobLedger,
  planAgentVideoProductionAction,
  resolveAgentVideoProviderCapability,
  selectCurrentAgentVideoPipelineTask,
  transitionAgentVideoGenerationJob,
  type AgentVideoProviderCapabilityRegistry,
} from "../src/core/agentVideoProductionContract.ts";
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
    id: "style_text_only",
    type: "style",
    name: "文字风格方向",
    path: "/project/assets/style_text_only.json",
    textConstraints: ["项目视觉风格：1990 年代日本 TV 动画"],
    sourceRefs: ["new_video_reference:style:text"],
    usedByShotIds: ["shot_1", "shot_2"],
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
assert(!inbox.items.some((item) => item.assetId === "style_text_only"), "text-only project style constraints should not appear as reviewable project materials");
assert(!inbox.summary.includes("文字风格方向"), "text-only project style constraints should not pollute creator-facing material summary");
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
assert(inbox.items.every((item) => item.suggestedAction), "inbox items should expose a next material action");
assert(inbox.items.every((item) => item.reason), "inbox items should explain why Agent classified them this way");
assert(!inbox.items.some((item) => item.suggestedBinding.includes("参考参考")), "style/reference inbox copy must not say 参考参考");
assert(!inbox.items.some((item) => /shot_/.test(item.suggestedBinding)), "inbox binding copy must not expose raw shot ids");
assert(inbox.items.some((item) => item.suggestedBinding.includes("镜头 1")), "inbox binding copy should use human-readable shot labels");
assert(inbox.summary.includes("参考匹配"), "inbox summary should distinguish matching suggestions from raw project materials");
assert(!inbox.summary.includes("素材已进入项目"), "inbox summary should not call reconciliation suggestions imported project materials");

const emptyInbox = buildProjectInboxProjection({ assets: [] });
assert(emptyInbox.summary.includes("声音参考"), "empty inbox should ask for voice reference instead of music");
assert(!emptyInbox.summary.includes("音乐"), "music analysis/mixing should stay out of the demo inbox copy");

const folderInbox = buildProjectFolderInboxProjection({
  files: [
    { path: "characters/lin-an/front.png", sizeBytes: 1024 },
    { path: "scenes/rain-station/wide.jpg" },
    { path: "props/glowing-ticket.webp" },
    { path: "vehicles/white-car.png" },
    { path: "vehicles/headlight.png" },
    { path: "props/wheel-detail.jpg" },
    { path: "characters/lin-an/hand-closeup.png" },
    { path: "storyboards/shot-01-board.png" },
    { path: "voices/heroine.wav" },
    { path: "dialogue/opening-lines.txt" },
    { path: "dialogue/heroine.wav" },
    { path: "audio/music/eurobeat.wav" },
    { path: "styles/90s-anime-look.md" },
    { path: "skills/storyboard-rapid-cut.md" },
    { path: "scripts/episode-01.md" },
    { path: "videos/returned-shot.mp4" },
    { path: "exports/final-package.zip" },
    { path: "exports/current-project/export_manifest.json" },
    { path: "exports/current-project/video-report/summary.md" },
    { path: "assets/generated/character_asset_auto.png" },
    { path: "assets/generated/scene_scene_asset_auto.png" },
    { path: "assets/generated/prop_asset_auto.png" },
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

assert(folderInbox.discoveredAssetCount === 17, "folder scan should discover supported project files and ignore hidden/outside files");
assert(folderInbox.ignoredCount === 7, "folder scan should count hidden, out-of-scope, and app-generated files as ignored");
assert(folderInbox.discoveredAssets.every((item) => !item.path.startsWith("/")), "folder scan must keep project-relative paths instead of leaking local absolute paths");
assert(!folderInbox.discoveredAssets.some((item) => item.path.startsWith("assets/generated/")), "folder scan must not re-ingest app-generated reference outputs as user project materials");
assert(!folderInbox.discoveredAssets.some((item) => item.path.startsWith("exports/current-project/")), "folder scan must not re-ingest app-generated export bundles as user project materials");
assert(!folderInbox.items.some((item) => item.label.includes("asset_auto")), "app-generated reference outputs must not appear as extra review cards");
assert(!folderInbox.items.some((item) => item.label === "export_manifest.json" || item.label === "summary.md"), "app-generated export files must not appear as extra review cards");
assert(folderInbox.items.some((item) => item.kind === "character" && item.label === "front.png"), "folder scan should classify character folders");
assert(folderInbox.items.some((item) => item.kind === "character" && item.origin === "project_folder" && item.originLabel === "项目文件夹"), "folder scan inbox items should show they came from the project folder");
assert(folderInbox.items.some((item) => item.kind === "scene" && item.label === "wide.jpg"), "folder scan should classify scene folders");
assert(folderInbox.items.some((item) => item.kind === "prop" && item.label === "glowing-ticket.webp"), "folder scan should classify prop folders");
assert(folderInbox.items.some((item) => item.kind === "prop" && item.label === "white-car.png"), "folder scan should keep whole vehicles as independent object references");
for (const detailLabel of ["headlight.png", "wheel-detail.jpg", "hand-closeup.png"]) {
  const detailItem = folderInbox.items.find((item) => item.label === detailLabel);
  assert(detailItem, `${detailLabel} should still appear for user review`);
  assert(detailItem.kind === "reference", `${detailLabel} should be a folded detail reference, not an independent subject`);
  assert(detailItem.suggestedBinding.includes("不单独生成参考"), `${detailLabel} should explain it folds into a subject or shot note`);
  assert(detailItem.suggestedAction.includes("并入主体或镜头说明"), `${detailLabel} should say how to use it`);
  assert(/局部细节|动作瞬间|状态/.test(detailItem.reason), `${detailLabel} should explain the non-standalone decision`);
}
assert(folderInbox.items.some((item) => item.kind === "character" && item.suggestedAction.includes("角色参考")), "folder scan should give reusable subjects clear actions");
assert(folderInbox.items.every((item) => item.reason), "folder scan inbox should explain every material classification");
assert(folderInbox.items.some((item) => item.kind === "storyboard" && item.suggestedBinding.includes("故事板参考")), "folder scan should surface storyboards as reviewable planning references");
assert(folderInbox.items.some((item) => item.kind === "voice" && item.label === "heroine.wav"), "folder scan should classify voice folders");
assert(folderInbox.items.some((item) => item.kind === "script" && item.label === "opening-lines.txt"), "folder scan should treat text dialogue as script material");
assert(folderInbox.items.some((item) => item.kind === "voice" && item.label === "heroine.wav"), "folder scan should still treat audio dialogue as voice material");
assert(folderInbox.items.some((item) => item.kind === "reference" && item.label === "eurobeat.wav" && item.suggestedBinding.includes("后期")), "folder scan should keep audio/music files as parked post audio references");
assert(!folderInbox.items.some((item) => item.kind === "voice" && item.label === "eurobeat.wav"), "folder scan must not treat music-folder audio as a character voice reference");
assert(folderInbox.items.some((item) => item.kind === "reference" && item.label === "90s-anime-look.md" && item.suggestedBinding.includes("风格")), "folder scan should classify style folders as style references");
assert(folderInbox.items.some((item) => item.kind === "reference" && item.label === "storyboard-rapid-cut.md" && item.suggestedBinding.includes("分镜方法")), "folder scan should classify skills folders as directing-method references");
assert(folderInbox.discoveredAssets.some((item) => item.path === "styles/90s-anime-look.md" && item.type === "style" && item.roleBinding?.role === "style_reference"), "folder scan should preserve style/skill assets as reusable style references");
assert(folderInbox.items.some((item) => item.kind === "script" && item.label === "episode-01.md"), "folder scan should classify scripts");
assert(folderInbox.items.some((item) => item.kind === "video" && item.label === "returned-shot.mp4"), "folder scan should classify returned videos");
assert(folderInbox.items.some((item) => item.kind === "export" && item.label === "final-package.zip"), "folder scan should classify export packages");
assert(folderInbox.summary.includes("从项目文件夹识别到 17 个可用素材"), "folder scan summary should explain the takeover result in human language");
assert(folderInbox.nextAction.includes("确认后再继续生成"), "folder scan next action should make the next step obvious");

const scopedFolderInbox = buildProjectFolderInboxProjection({
  files: [
    { path: "chapter-02/sequence-rain-chase/shot-04/vehicles/white-car.png" },
    { path: "chapter-02/sequence-rain-chase/shot-04/vehicles/headlight.png" },
  ],
});
const scopedVehicle = scopedFolderInbox.items.find((item) => item.label === "white-car.png");
assert(scopedVehicle, "scoped vehicle asset should appear in the inbox");
assert(scopedVehicle.suggestedBinding.includes("章节 chapter 02"), "scoped vehicle should carry chapter context");
assert(scopedVehicle.suggestedBinding.includes("段落 sequence rain chase"), "scoped vehicle should carry sequence context");
assert(scopedVehicle.reason.includes("镜头 shot 04"), "scoped vehicle should carry shot context");
const scopedHeadlight = scopedFolderInbox.items.find((item) => item.label === "headlight.png");
assert(scopedHeadlight, "scoped headlight detail should appear in the inbox");
assert(scopedHeadlight.kind === "reference", "scoped headlight should not become an independent prop");
assert(scopedHeadlight.suggestedBinding.includes("不单独生成参考"), "scoped headlight should preserve fine-detail folding");
assert(scopedHeadlight.suggestedBinding.includes("镜头 shot 04"), "scoped headlight should still retain target shot context");

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

const largeInbox = buildProjectInboxProjection({
  assets: Array.from({ length: 30 }, (_, index) => asset({
    id: `bulk_scene_${index + 1}`,
    type: "unknown",
    name: `scene-${index + 1}.jpg`,
    path: `scenes/bulk/scene-${index + 1}.jpg`,
    sourceRefs: ["project_folder_scan"],
    lockedStatus: "needs_review",
  })),
});
assert(largeInbox.totalCount === 30, "inbox totalCount should represent all recognized materials, not just preview cards");
assert(largeInbox.needsReviewCount === 30, "inbox needsReviewCount should count all recognized materials");
assert(largeInbox.items.length === 24, "inbox should still cap visible preview cards to avoid flooding the Agent thread");
assert(largeInbox.summary.includes("30 个素材"), "inbox summary should explain full project-folder recognition count");

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
assert(observation.currentTask.missing.includes("项参考需要复核"), "observation gap should use the same reference-review count as the review shortcut");
assert(!observation.currentTask.missing.includes("素材用途需要确认"), "observation gap should not mix reconciliation totals into the main next step");

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

const videoBlockedByIntentRoute = routeProjectAgentIntent({
  text: "现在发送视频。不要生成参考图，先不要提交任何外部生成。",
  hasSelection: true,
  hasAttachments: false,
  observation,
});
assert(videoBlockedByIntentRoute.kind === "video", "video request with an explicit no-external boundary should stay in the video lane");
assert(videoBlockedByIntentRoute.label === "检查视频前提", "blocked video request should be presented as a preflight explanation");
assert(videoBlockedByIntentRoute.confirmation === "none", "blocked video request must not ask for video, reference, or revision confirmation");
assert(videoBlockedByIntentRoute.plan.join(" ").includes("不生成参考"), "blocked video request should preserve the no-reference boundary");
assert(videoBlockedByIntentRoute.plan.join(" ").includes("不提交视频"), "blocked video request should preserve the no-video-submit boundary");

const continueRoute = routeProjectAgentIntent({
  text: "没问题，继续",
  hasSelection: false,
  hasAttachments: false,
  observation,
});
assert(continueRoute.kind === "reference", "simple continue wording should follow the observed next project action");
assert(continueRoute.confirmation === observation.currentTask.confirmation.kind, "continue route should preserve the current confirmation boundary");

const continueNextRoute = routeProjectAgentIntent({
  text: "继续下一步",
  hasSelection: true,
  hasAttachments: false,
  observation,
});
assert(continueNextRoute.kind === "reference", "continue-next wording should follow the observed next project action even when a shot is selected");
assert(continueNextRoute.confirmation === observation.currentTask.confirmation.kind, "continue-next route should preserve the current confirmation boundary");

const explainOnlyRoute = routeProjectAgentIntent({
  text: "继续下一步，但先不要提交视频，只告诉我接下来要做什么。",
  hasSelection: true,
  hasAttachments: false,
  observation,
});
assert(explainOnlyRoute.kind === "status", "explain-only next-step wording should not become a selected-shot revision");
assert(explainOnlyRoute.confirmation === "none", "explain-only next-step wording must not create a write-project confirmation");
assert(explainOnlyRoute.plan.join(" ").includes("不写项目"), "explain-only route should explicitly preserve the no-execution boundary");

const referenceOnlyRoute = routeProjectAgentIntent({
  text: "先别生成视频，只补参考",
  hasSelection: false,
  hasAttachments: false,
  observation,
});
assert(referenceOnlyRoute.kind === "reference", "no-video reference-only wording should route to reference preparation");
assert(referenceOnlyRoute.confirmation === "reference_generation", "reference-only wording should keep video submission blocked");

const startReferenceRoute = routeProjectAgentIntent({
  text: "开始补参考",
  hasSelection: true,
  hasAttachments: false,
  observation,
});
assert(startReferenceRoute.kind === "reference", "start-reference wording should not become a selected-shot revision");
assert(startReferenceRoute.confirmation === "reference_generation", "start-reference wording should keep a reference-generation confirmation");

const referenceRangePlanRoute = routeProjectAgentIntent({
  text: "开始补参考。先确认范围，别直接生成。",
  hasSelection: true,
  hasAttachments: false,
  observation,
});
assert(referenceRangePlanRoute.kind === "reference", "range-first reference wording should stay in the reference lane");
assert(referenceRangePlanRoute.label === "准备参考计划", "range-first reference wording should be presented as reference planning");
assert(referenceRangePlanRoute.confirmation === "none", "range-first reference wording must not stage generation or selected-shot revision");

const referencePlanRoute = routeProjectAgentIntent({
  text: "开始补参考。先只准备参考计划，不要生成图片，不要提交视频。",
  hasSelection: true,
  hasAttachments: false,
  observation,
});
assert(referencePlanRoute.kind === "reference", "plan-only start-reference wording should stay in the reference lane");
assert(referencePlanRoute.label === "准备参考计划", "plan-only start-reference wording should be presented as reference planning");
assert(referencePlanRoute.confirmation === "none", "plan-only start-reference wording must not ask to generate images");

const materialBindingRoute = routeProjectAgentIntent({
  text: "只整理一下当前素材绑定建议，不生成参考，不提交视频。",
  hasSelection: false,
  hasAttachments: false,
  observation,
});
assert(materialBindingRoute.kind === "reference", "material binding review should stay in the current project's asset lane");
assert(materialBindingRoute.label === "整理素材", "material binding review should be presented as asset organization");
assert(materialBindingRoute.confirmation === "asset_review", "material binding review should ask for review instead of generation");

const generateReferenceOnlyRoute = routeProjectAgentIntent({
  text: "先不要提交视频，只生成参考图",
  hasSelection: false,
  hasAttachments: false,
  observation,
});
assert(generateReferenceOnlyRoute.kind === "reference", "reference-only generation wording must not be confused with video generation");
assert(generateReferenceOnlyRoute.confirmation === "reference_generation", "reference-only generation wording should stay inside reference confirmation");

const planOnlyNoReferenceRoute = routeProjectAgentIntent({
  text: "做一个 12 秒短片，先只整理故事、镜头和节奏，不生成参考，不发送视频。",
  hasSelection: false,
  hasAttachments: false,
  observation,
});
assert(planOnlyNoReferenceRoute.kind === "story", "plan-only no-reference wording must not route to reference generation");
assert(planOnlyNoReferenceRoute.label === "整理新故事", "plan-only no-reference wording should start a project-level draft");

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

const naturalNewStoryRoute = routeProjectAgentIntent({
  text: "做一个 12 秒 90 年代日漫感小短片：午夜天桥下，一台旧自动售货机吐出一张发光车票。先只整理故事、镜头和节奏，不生成参考，不发送视频。",
  hasSelection: true,
  hasAttachments: false,
  observation,
});
assert(naturalNewStoryRoute.kind === "story", "natural new-video wording must not be captured as selected-shot revision");
assert(naturalNewStoryRoute.label === "整理新故事", "natural new-video wording should start a project-level draft even when a shot is selected");

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

const dryReferenceValidatedInput = {
  localProjectReady: true,
  projectTitle: "山路短片",
  sectionCount: 1,
  shotCount: shots.length,
  selectedShotCount: 0,
  referenceMissingCount: 2,
  referenceReviewCount: 0,
  referenceReadyCount: 0,
  videoStatus: "not_generated",
  videoStatusLabel: "未提交视频",
  videoDetail: "",
  videoWaitingCount: 0,
  videoCompletedCount: 0,
  videoReviewCount: 0,
  videoCanResume: false,
  image2Running: false,
  referenceExecutionValidated: true,
};
const dryReferenceValidatedObservation = buildProjectObservation(dryReferenceValidatedInput);
assert(dryReferenceValidatedObservation.references.status === "missing", "dry validation must keep real references missing");
assert(dryReferenceValidatedObservation.references.label === "参考未生成", "dry validation must not relabel missing references as usable");
assert(dryReferenceValidatedObservation.video.status === "ready", "reference contract validation may advance only the local video-flow validation boundary");
assert(dryReferenceValidatedObservation.currentTask.confirmation.kind === "video_submit", "dry reference validation should expose the next confirmation boundary without claiming assets exist");
assert(!/参考可用|已生成/.test(dryReferenceValidatedObservation.summary), "dry reference validation summary must stay truthful");

const dryVideoValidatedObservation = buildProjectObservation({
  ...dryReferenceValidatedInput,
  videoExecutionValidated: true,
});
assert(dryVideoValidatedObservation.video.status === "idle" && dryVideoValidatedObservation.video.label === "视频未生成", "dry video validation must not create a real video state");
assert(dryVideoValidatedObservation.currentTask.confirmation.kind === "none", "completed video contract validation should yield to the pipeline export boundary");
assert(/未生成/.test(dryVideoValidatedObservation.summary), "dry video validation summary must disclose missing real media");

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

const exportRoute = routeProjectAgentIntent({
  text: "导出交付包",
  hasSelection: true,
  hasAttachments: false,
  observation: videoReadyObservation,
});
assert(exportRoute.kind === "export", "export wording should route to delivery/export");
assert(exportRoute.confirmation === "export", "export wording must require an export confirmation");
assert(exportRoute.target === "export", "export wording should focus the export surface");

const exportObservation = {
  ...videoReadyObservation,
  currentTask: {
    ...videoReadyObservation.currentTask,
    confirmation: {
      kind: "export" as const,
      required: true,
      label: "确认导出",
      detail: "确认后才写入交付包。",
    },
  },
};
const continueToExportRoute = routeProjectAgentIntent({
  text: "没问题，继续",
  hasSelection: true,
  hasAttachments: false,
  observation: exportObservation,
});
assert(continueToExportRoute.kind === "export", "continue intent should follow an active export confirmation instead of selected-shot revision");
assert(continueToExportRoute.confirmation === "export", "continue-to-export must keep the export confirmation boundary");

const agentVideoRegistry = buildDefaultAgentVideoProviderCapabilityRegistry("2026-07-07T00:00:00.000Z");
const requiredCapabilities = [
  "text-to-video",
  "image-to-video",
  "first-last-frame-to-video",
  "subject-reference-video",
  "reference-image-generation",
  "export",
];
for (const capability of requiredCapabilities) {
  assert(agentVideoRegistry.capabilities.some((item) => item.capability === capability), `agent video registry missing ${capability}`);
}
assert(agentVideoRegistry.capabilities.every((item) => item.dryRunOnly === true && item.liveSubmitAllowed === false), "agent video registry must stay dry-run and non-live");

const referenceCapability = resolveAgentVideoProviderCapability({
  capability: "reference-image-generation",
  registry: agentVideoRegistry,
});
assert(referenceCapability.status === "supported", `reference capability should resolve: ${referenceCapability.blockers.join("; ")}`);

const emptyAgentVideoRegistry: AgentVideoProviderCapabilityRegistry = {
  schemaVersion: agentVideoRegistry.schemaVersion,
  registryVersion: "agent-video-provider-registry/empty-test",
  capabilities: [],
  notes: [],
};
const unsupportedCapability = resolveAgentVideoProviderCapability({
  capability: "subject-reference-video",
  registry: emptyAgentVideoRegistry,
});
assert(unsupportedCapability.status === "blocked", "unsupported provider capability must block instead of falling back");
assert(unsupportedCapability.blockers.some((blocker) => /No provider capability/.test(blocker)), "unsupported capability blocker missing");

const baseLedger = createAgentVideoGenerationJobLedger({
  ledgerId: "agent_video_pipeline_boundary_test",
  projectId: "agent-video-pipeline-project",
  projectRoot: "/tmp/agent-video-pipeline-project",
  projectFactHash: "agent-video-pipeline-facts",
  createdAt: "2026-07-07T00:00:00.000Z",
});

const unconfirmedStoryPlan = buildAgentVideoPipelinePlan({
  planId: "unconfirmed_story",
  generatedAt: "2026-07-07T00:00:00.000Z",
  storyDraftPresent: true,
  storyConfirmed: false,
  localProjectReady: false,
  referenceMissingCount: 2,
  videoSubmitted: false,
});
const blockedBeforeStoryConfirm = planAgentVideoProductionAction({
  plan: unconfirmedStoryPlan,
  ledger: baseLedger,
  action: "prepare_references",
  actionId: "blocked-before-story-confirm",
  generatedAt: "2026-07-07T00:00:01.000Z",
});
assert(blockedBeforeStoryConfirm.status === "blocked", "unconfirmed story must block reference generation");
assert(blockedBeforeStoryConfirm.ledger.jobs.length === 0, "unconfirmed story must not create reference jobs");

const unsavedStoryPlan = buildAgentVideoPipelinePlan({
  planId: "unsaved_story",
  generatedAt: "2026-07-07T00:00:00.000Z",
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: false,
  referenceMissingCount: 2,
  videoSubmitted: false,
});
const chooseSaveLocationDecision = planAgentVideoProductionAction({
  plan: unsavedStoryPlan,
  ledger: baseLedger,
  action: "choose_save_location",
  actionId: "choose-save-location",
  generatedAt: "2026-07-07T00:00:02.000Z",
});
assert(chooseSaveLocationDecision.status === "state_only", "choose save location should be a state-only pipeline action");
assert(chooseSaveLocationDecision.ledger.jobs.length === 0, "choose save location must not create generation, video, or export jobs");

const blockedBeforeSaveLocation = planAgentVideoProductionAction({
  plan: unsavedStoryPlan,
  ledger: baseLedger,
  action: "submit_video",
  actionId: "blocked-before-save-location",
  generatedAt: "2026-07-07T00:00:03.000Z",
});
assert(blockedBeforeSaveLocation.status === "blocked", "unsaved story must block video submit");
assert(blockedBeforeSaveLocation.nextStep === "choose_save_location", "unsaved story should point back to save-location setup");
assert(blockedBeforeSaveLocation.ledger.jobs.length === 0, "unsaved story must not create video jobs");

const missingReferencesPlan = buildAgentVideoPipelinePlan({
  planId: "missing_references",
  generatedAt: "2026-07-07T00:00:00.000Z",
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 2,
  videoSubmitted: false,
});
const blockedVideoByReferences = planAgentVideoProductionAction({
  plan: missingReferencesPlan,
  ledger: baseLedger,
  action: "submit_video",
  actionId: "blocked-video-by-references",
  generatedAt: "2026-07-07T00:00:04.000Z",
});
assert(blockedVideoByReferences.status === "blocked", "missing references must block video job creation");
assert(blockedVideoByReferences.nextStep === "prepare_references", "missing references should route video submit back to reference prep");
assert(blockedVideoByReferences.ledger.jobs.length === 0, "missing references must not create a video job");

const stagedReferenceDecision = planAgentVideoProductionAction({
  plan: missingReferencesPlan,
  ledger: baseLedger,
  action: "prepare_references",
  actionId: "prepare-reference-story",
  generatedAt: "2026-07-07T00:00:05.000Z",
  sourceConfirmationId: "confirm_reference_story",
  sourceTimelineId: "timeline_reference_story",
  prompt: "prepare current-story references",
  outputAssets: ["assets/generated/references/story"],
});
assert(stagedReferenceDecision.status === "staged_job", "reference prep should stage a job after story/save boundaries are satisfied");
assert(stagedReferenceDecision.job?.status === "staged", "reference job must start staged, not running");
assert(stagedReferenceDecision.job?.sourceConfirmationId === "confirm_reference_story", "reference job must bind to the source confirmation");

const runningBeforeConfirm = transitionAgentVideoGenerationJob({
  ledger: stagedReferenceDecision.ledger,
  jobId: stagedReferenceDecision.job!.jobId,
  status: "running",
  generatedAt: "2026-07-07T00:00:06.000Z",
});
assert(runningBeforeConfirm.ok === false, "reference job must not run before confirmation");
assert(runningBeforeConfirm.blockers.some((blocker) => /confirmed/.test(blocker)), "running-before-confirm blocker missing");

const confirmedReference = transitionAgentVideoGenerationJob({
  ledger: stagedReferenceDecision.ledger,
  jobId: stagedReferenceDecision.job!.jobId,
  status: "confirmed",
  generatedAt: "2026-07-07T00:00:07.000Z",
});
assert(confirmedReference.ok === true, "staged reference job should become confirmed after confirmation");
assert(confirmedReference.job?.status === "confirmed", "confirmed reference job status drifted");

const exportPlan = buildAgentVideoPipelinePlan({
  planId: "export_ready",
  generatedAt: "2026-07-07T00:00:00.000Z",
  storyDraftPresent: true,
  storyConfirmed: true,
  localProjectReady: true,
  referenceMissingCount: 0,
  videoSubmitted: true,
});
const stagedExportDecision = planAgentVideoProductionAction({
  plan: exportPlan,
  ledger: baseLedger,
  action: "export",
  actionId: "export-current-project",
  generatedAt: "2026-07-07T00:00:08.000Z",
  sourceConfirmationId: "confirm_export_project",
  prompt: "export current project",
  outputAssets: ["exports/current-project/report.md"],
});
assert(stagedExportDecision.status === "staged_job", "export should stage a job behind confirmation");
assert(stagedExportDecision.job?.kind === "export", "export decision should create an export job");
assert(stagedExportDecision.job?.status === "staged", "export job must not run or succeed before confirmation");
const exportSucceededBeforeRun = transitionAgentVideoGenerationJob({
  ledger: stagedExportDecision.ledger,
  jobId: stagedExportDecision.job!.jobId,
  status: "succeeded",
  generatedAt: "2026-07-07T00:00:09.000Z",
});
assert(exportSucceededBeforeRun.ok === false, "export must not succeed before confirmation and running state");

const staleCurrentTask = selectCurrentAgentVideoPipelineTask({
  plan: missingReferencesPlan,
  confirmations: [
    {
      confirmationId: "old_export_confirmation",
      stepId: "export",
      status: "waiting",
      createdAt: "2026-07-07T00:00:10.000Z",
    },
    {
      confirmationId: "resolved_reference_confirmation",
      stepId: "prepare_references",
      status: "resolved",
      createdAt: "2026-07-07T00:00:11.000Z",
    },
  ],
  ledger: stagedExportDecision.ledger,
});
assert(staleCurrentTask.source === "plan", "stale export confirmation/job must not steal the current reference task");
assert(staleCurrentTask.stepId === "prepare_references", "current task should stay on prepare_references");

const currentReferenceTask = selectCurrentAgentVideoPipelineTask({
  plan: missingReferencesPlan,
  confirmations: [
    {
      confirmationId: "current_reference_confirmation",
      stepId: "prepare_references",
      status: "waiting",
      createdAt: "2026-07-07T00:00:12.000Z",
    },
  ],
  ledger: stagedReferenceDecision.ledger,
});
assert(currentReferenceTask.source === "confirmation", "current waiting confirmation should be the active pipeline task");
assert(currentReferenceTask.confirmationId === "current_reference_confirmation", "current confirmation id drifted");

console.log("project-agent-workspace-test: ok");
