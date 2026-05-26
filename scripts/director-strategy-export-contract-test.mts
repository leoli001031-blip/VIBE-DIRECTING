import { buildDirectorSessionFromIntake } from "../src/core/directorSession.ts";
import {
  buildDirectorStrategyExportSummary,
  directorStrategyEvidenceForShot,
} from "../src/core/directorStrategyExport.ts";
import { buildExportBuilderState } from "../src/core/exportBuilder.ts";
import {
  buildIntakeStagedPlanProjection,
  buildProjectIntakeDraft,
} from "../src/core/projectIntakeDraft.ts";
import { buildScriptStoryboardPromptPack } from "../src/core/scriptStoryboardPromptPack.ts";
import {
  buildStoryDiscussionWorkspace,
  confirmStoryDiscussionDeltas,
  stageStoryDiscussionTurn,
} from "../src/core/storyDiscussionWorkspace.ts";
import type { StoryboardReferenceAsset } from "../src/core/storyboardReferencePipeline.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function gates() {
  return {
    identity: "PASS",
    scene: "PASS",
    pair: "PASS",
    story: "PASS",
    prop: "PASS",
    style: "PASS",
  };
}

const generatedAt = "2026-05-22T00:00:00.000Z";
const scriptText = [
  "雨后天台，日奈把旧磁带藏在身后。莲从屋顶门右侧出现，看到她手上的蓝色磁带。",
  "日奈先后退半步，又把磁带慢慢递向莲。莲没有立刻接，只在快碰到磁带时停了一拍。",
  "最后两个人并肩站到栏杆旁，清晨第一束光落在磁带盒上。",
].join("\n");

const intakeDraft = buildProjectIntakeDraft({
  createdAt: generatedAt,
  scriptText,
  styleNote: "日漫情绪特写，雨后天台，克制对白，不要广告感。",
  referenceAssets: [
    { id: "upload_hina", type: "image", label: "日奈角色参考", binding: { role: "日奈", shotIds: ["DS01", "DS02"] } },
    { id: "upload_rooftop", type: "image", label: "雨后天台", binding: { scene: "雨后天台", scope: "whole_video" } },
    { id: "upload_cassette", type: "image", label: "蓝色磁带盒", binding: { prop: "蓝色磁带盒", scope: "whole_video" } },
  ],
});
const session = buildDirectorSessionFromIntake({
  draft: intakeDraft,
  projection: buildIntakeStagedPlanProjection(intakeDraft),
  projectId: "director_strategy_export_contract",
  createdAt: generatedAt,
});
const workspace = buildStoryDiscussionWorkspace({ session, createdAt: generatedAt });
const modifiedWorkspace = stageStoryDiscussionTurn({
  workspace,
  text: "动作太平，改成日漫里远景、表情特写、手部动作特写的节奏。第三个镜头慢一点，最后加一个清晨空镜，不要广告感。",
  createdAt: "2026-05-22T00:01:00.000Z",
});
const confirmedWorkspace = confirmStoryDiscussionDeltas({
  workspace: modifiedWorkspace,
  createdAt: "2026-05-22T00:02:00.000Z",
});

assert(
  confirmedWorkspace.stagedDeltas.some((delta) => delta.status === "confirmed" && delta.kind === "storyboard_style_revision"),
  "conversation should confirm a staged rhythm/style revision before export",
);
assert(
  confirmedWorkspace.stagedDeltas.every((delta) => delta.canWriteProjectFactNow === false),
  "conversation deltas must stay staged until the Project.vibe confirmation step",
);

const scene: StoryboardReferenceAsset = {
  id: "scene_rooftop_after_rain",
  role: "scene_baseline",
  path: "assets/scenes/rooftop-after-rain.png",
  label: "雨后天台场景基准",
};
const hina: StoryboardReferenceAsset = {
  id: "char_hina",
  role: "character_identity",
  path: "assets/characters/hina.png",
  label: "日奈角色锁定参考",
};
const ren: StoryboardReferenceAsset = {
  id: "char_ren",
  role: "character_identity",
  path: "assets/characters/ren.png",
  label: "莲角色锁定参考",
};
const cassette: StoryboardReferenceAsset = {
  id: "prop_cassette",
  role: "prop_reference",
  path: "assets/props/blue-cassette.png",
  label: "蓝色磁带盒",
};

const promptPack = buildScriptStoryboardPromptPack({
  title: "雨后旧磁带",
  logline: "雨后天台上，少女把旧磁带递给少年，两个人在停顿中重新靠近。",
  completeScript: scriptText,
  style: "Japanese TV anime, emotional close-up rhythm, quiet dialogue, no commercial slogan",
  storyboardOutputDir: "outputs/storyboards",
  videoOutputDir: "outputs/seedance",
  image2OutputSize: "1280x720",
  seedanceVideoResolution: "720p",
  referenceBundle: {
    scenes: [scene],
    characters: [hina, ren],
    props: [cassette],
  },
  shots: [
    {
      shotId: "DS01",
      title: "日奈把磁带从身后拿到身前",
      durationSeconds: 5,
      executionMode: "reaction_closeup",
      sceneId: scene.id,
      characterIds: [hina.id, ren.id],
      propIds: [cassette.id],
      shotSize: "中近景",
      camera: "日奈左前景，莲右后景，轻微推近到手部。",
      frameDescription: "日奈低头把蓝色磁带盒从身后拿到身前，莲站在右侧等待。",
      actionBeats: ["日奈低头", "磁带从身后移到身前", "莲停住等待"],
      primaryAction: "日奈把磁带盒从身后拿到身前",
      actionTrigger: "莲的问题让沉默停住",
      microReaction: "莲站在右侧停住等待",
      actorAction: "日奈低头，把磁带盒移到身前",
      reactorResponse: "莲在右侧等待她开口",
      dialogue: "-",
      animeShotGrammar: ["表情停顿", "手部动作特写"],
      rhythmProfile: "anime_emotion",
      rhythmReason: "这段需要靠眼神、手部和短暂停顿推进关系。",
      splitPolicy: "split_for_reaction",
    },
    {
      shotId: "DS02",
      title: "清晨空镜落在磁带盒上",
      durationSeconds: 4,
      executionMode: "single_continuous_shot",
      sceneId: scene.id,
      characterIds: [],
      propIds: [cassette.id],
      shotSize: "空镜近景",
      camera: "静止近景，清晨光线从栏杆缝隙照到磁带盒。",
      frameDescription: "蓝色磁带盒放在湿润栏杆旁，清晨第一束光慢慢变亮。",
      actionBeats: ["清晨光线慢慢变亮", "雨水从栏杆滴落"],
      primaryAction: "清晨光线落在磁带盒上",
      actionTrigger: "两个人离开画面后",
      microReaction: "空气安静下来",
      rhythmProfile: "lyrical_observation",
      rhythmReason: "结尾更像观察环境和余韵，让空间和道具说话。",
      splitPolicy: "hold_single_shot",
    },
  ],
});

const strategySummary = buildDirectorStrategyExportSummary({
  promptPack,
  confirmedDeltas: confirmedWorkspace.stagedDeltas,
});
const ds01Strategy = directorStrategyEvidenceForShot(strategySummary, "DS01");

assert(ds01Strategy?.rhythmProfile === "anime_emotion", "strategy evidence must preserve rhythm profile");
assert(ds01Strategy?.rhythmLabel === "日漫情绪特写", "strategy evidence must include Chinese rhythm label");
assert(ds01Strategy?.rhythmReason?.includes("眼神"), "strategy evidence must include rhythm reason");
assert(ds01Strategy?.splitLabel === "动作后留反应", "strategy evidence must include user-facing split label");
assert(ds01Strategy?.modificationSummary?.some((item) => item.includes("不要广告感")), "strategy evidence must include confirmed director modification summary");
assert(ds01Strategy?.storyboardPromptPlanSummary?.includes("故事板叙事"), "strategy evidence must summarize Image2 reference plan");
assert(ds01Strategy?.videoPromptPlanSummary?.includes("视频"), "strategy evidence must summarize Seedance plan");

const firstShot = promptPack.shots[0];
assert(firstShot.directorRow["节奏/拍法"] === "anime_emotion", "director table must carry the rhythm profile");
assert(firstShot.directorRow["拍法理由"].includes("眼神"), "director table must carry the rhythm reason");
assert(firstShot.productionSkillPlan.strategyId === "storyboard_narrative", "short reaction shot should route to narrative storyboard");
assert(firstShot.productionSkillPlan.image2Directive.mode === "narrative_storyboard", "short reaction shot should request narrative Image2 storyboard mode");
assert(firstShot.image2StoryboardPlan?.prompt.includes("Anime emotion storyboard grammar"), "Image2 narrative plan must compile anime emotion storyboard grammar");
assert(firstShot.image2StoryboardPlan?.prompt.includes("Avoid all legible written words"), "Image2 narrative plan must stay provider-safe");
assert(firstShot.image2StoryboardPlan?.referencePolicy.userFacingSummary.includes("故事板叙事"), "Image2 plan must expose a user-facing narrative-storyboard summary");
assert(firstShot.seedanceVideoPlan.videoResolution === "720p", "Seedance plan must keep 720p as the explicit contract lane");
assert(firstShot.seedanceVideoPlan.modelVersion !== "seedance2.0_vip", "Seedance VIP must not become the implicit default");
assert(firstShot.seedanceVideoPlan.directorStrategy.rhythmProfile === "anime_emotion", "Seedance plan must carry director rhythm strategy");
assert(firstShot.seedanceVideoPlan.directorStrategy.guidance.some((item) => item.includes("split_for_reaction")), "Seedance plan must carry split guidance");

const exportBuilderState = buildExportBuilderState({
  generatedAt,
  selectedShotId: "DS01",
  shots: [
    {
      id: "DS01",
      actId: "A1",
      title: "日奈把磁带从身后拿到身前",
      storyFunction: "关系从隐藏转向递出",
      startFrame: "outputs/storyboards/DS01-start.png",
      endFrame: "outputs/storyboards/DS01-end.png",
      videoPath: "outputs/seedance/DS01/clip.mp4",
      status: "generated",
      gates: gates(),
      issues: [],
    },
  ],
  shotMedia: [
    {
      shotId: "DS01",
      imagePath: "outputs/storyboards/DS01-start.png",
      videoPath: "outputs/seedance/DS01/clip.mp4",
      durationSeconds: 5,
      manifestMatched: true,
      promotionPassed: true,
      videoQaPass: true,
    },
  ],
  generationHealthReports: [
    {
      reportId: "health_DS01",
      taskPlanId: "video_task_DS01",
      jobId: "job_video_DS01",
      shotId: "DS01",
      expectedOutputPath: "outputs/seedance/DS01/clip.mp4",
      outputExists: true,
      manifestStatus: "matched",
      qaStatus: "pass",
      stalePrompt: false,
      assetReadinessStatus: "ready",
      healthStatus: "formal_ready",
      blockers: [],
      warnings: [],
      nextAction: "ready_for_formal_preview",
    },
  ],
  qaPromotionReports: [
    {
      reportId: "promotion_DS01",
      taskPlanId: "video_task_DS01",
      jobId: "job_video_DS01",
      shotId: "DS01",
      candidatePath: "outputs/seedance/DS01/clip.mp4",
      formalPath: "outputs/seedance/DS01/clip.mp4",
      promotionStatus: "promoted",
      requiredGates: {
        expectedOutput: true,
        manifestMatch: true,
        promptFresh: true,
        assetReadiness: true,
        qaPass: true,
      },
      blockers: [],
      warnings: [],
      canPromoteToFormal: true,
    },
  ],
  oneShotResultSummary: {
    outputVideoPath: "outputs/seedance/DS01/clip.mp4",
    storyboardReferencePath: firstShot.seedanceVideoPlan.inputs.images[0].path,
    sceneReferencePath: scene.path,
    characterReferencePaths: [hina.path, ren.path],
    propReferencePaths: [cassette.path],
    seedanceInputRoleOrder: firstShot.seedanceVideoPlan.referencePolicy.inputOrder,
    userFacingSummary: firstShot.seedanceVideoPlan.referencePolicy.userFacingSummary,
    directorStrategy: ds01Strategy,
  },
});

const exportedVideo = exportBuilderState.demoPackageFacts.videoResults?.[0];
assert(exportedVideo?.referenceEvidence?.directorStrategy?.rhythmLabel === "日漫情绪特写", "export builder must read director strategy from a pure summary object");
assert(exportedVideo?.referenceEvidence?.directorStrategy?.modificationSummary?.length, "export builder must keep confirmed modification summaries readable by later export");
assert(exportedVideo?.referenceEvidence?.storyboardReferencePath === "outputs/storyboards/DS01-storyboard-reference.png", "export builder must keep storyboard reference path readable by later export");

const serialized = JSON.stringify({
  strategySummary,
  referencePolicy: firstShot.seedanceVideoPlan.referencePolicy.userFacingSummary,
  exportedVideo,
});
for (const forbidden of [/\bapi[-_ ]?key\b/i, /\bcredential\b/i, /\bTaskEnvelope\b/, /\breceipt\b/i]) {
  assert(!forbidden.test(serialized), `director strategy export must stay creator-facing: ${forbidden}`);
}

console.log(
  `director-strategy-export-contract-test: shots=${strategySummary.shotCount}, rhythm=${ds01Strategy?.rhythmLabel}, deltas=${confirmedWorkspace.stagedDeltas.length}.`,
);
