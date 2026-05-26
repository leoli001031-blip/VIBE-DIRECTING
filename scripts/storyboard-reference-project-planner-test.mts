import {
  buildStoryboardReferenceProjectPlan,
  STORYBOARD_REFERENCE_PROJECT_PLANNER_VERSION,
} from "../src/core/storyboardReferenceProjectPlanner.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const sceneRain = {
  id: "scene_rain_station",
  kind: "scene",
  path: "/project/assets/scenes/rain-station.png",
  label: "雨夜旧站台",
  usedByShotIds: ["S01"],
};
const sceneMorning = {
  id: "scene_morning_bridge",
  kind: "scene",
  path: "/project/assets/scenes/morning-bridge.png",
  label: "清晨天桥",
  usedByShotIds: ["S02"],
};
const characterHero = {
  id: "char_asen",
  kind: "character",
  path: "/project/assets/characters/asen.png",
  label: "阿森",
  usedByShotIds: ["S01"],
  roleBinding: {
    role: "character_identity" as const,
    useFor: ["face", "hairstyle", "coat silhouette"],
    ignoreFor: ["camera path", "scene geography", "prop redesign"],
    priority: 30,
    conflictRule: "阿森角色参考只锁身份和外套轮廓，不决定镜头运动。",
  },
};
const propProjector = {
  id: "prop_projector",
  kind: "prop",
  path: "/project/assets/props/projector.png",
  label: "老放映机",
  usedByShotIds: ["S01"],
};
const storyboardS01 = {
  id: "storyboard_s01",
  role: "storyboard_reference",
  path: "/project/storyboard/S01-storyboard-reference.png",
  label: "S01 黑白分镜图",
  usedByShotIds: ["S01"],
};
const dialogueS01 = {
  id: "audio_s01_dialogue",
  role: "dialogue_audio" as const,
  path: "/project/audio/S01-dialogue.wav",
  label: "S01 对白",
  shotIds: ["S01"],
  transcript: "别再放那卷胶片了。",
};

const complete = buildStoryboardReferenceProjectPlan({
  projectId: "storyboard_reference_project_planner_fixture",
  shots: [{
    id: "S01",
    title: "雨夜旧站台",
    intent: "阿森推开放映室门，雨水从外套下摆滴落，老放映机在画面右侧颤动。",
    camera: "中景，缓慢推进",
    sceneAssetIds: ["scene_rain_station"],
    characterAssetIds: ["char_asen"],
    propAssetIds: ["prop_projector"],
    durationSeconds: 5,
    rhythmProfile: "anime_emotion",
    rhythmReason: "情绪藏在推门前的停顿和雨水细节里，需要日漫式近景承接。",
    splitPolicy: "split_for_reaction",
    primaryAction: "阿森的手压住门把，停一拍后推开放映室门。",
    actionTrigger: "门缝里漏出的放映机冷光突然抖动。",
    microReaction: "阿森眨眼，肩膀轻轻收紧。",
  }],
  assets: [sceneRain, characterHero, propProjector],
  storyboardReferences: [storyboardS01],
  audioReferences: [dialogueS01],
  storyboardOutputRoot: "/project/storyboard",
  videoOutputRoot: "/project/video",
});

assert(complete.schemaVersion === STORYBOARD_REFERENCE_PROJECT_PLANNER_VERSION, "project planner schema version drifted");
assert(complete.providerCalled === false, "planner must not call providers");
assert(complete.blocked === false, `complete shot should not block: ${complete.blockedReasons.join("; ")}`);
assert(complete.shotPlans.length === 1, "complete fixture should produce one shot plan");

const completeShot = complete.shotPlans[0]!;
assert(completeShot.image2StoryboardPlan.references.length === 3, "Image2 storyboard should receive scene, character, and prop references");
assert(
  completeShot.image2StoryboardPlan.references.map((reference) => reference.role).join("|") === "scene_baseline|character_identity|prop_reference",
  "Image2 storyboard reference roles drifted",
);
assert(
  completeShot.image2StoryboardPlan.references.find((reference) => reference.role === "character_identity")?.roleBinding?.useFor.includes("coat silhouette"),
  "Project planner should preserve Project.vibe asset role binding overrides",
);
assert(
  completeShot.image2StoryboardPlan.referencePolicy.roleBindings.find((binding) => binding.role === "character_identity")?.conflictRule.includes("外套轮廓"),
  "Image2 plan should carry Project.vibe character role binding into policy",
);
assert(completeShot.seedanceVideoPlan, "complete shot should produce a Seedance video plan");
assert(completeShot.directorPlan.rhythmProfile === "anime_emotion", "Project planner should preserve shot rhythm override");
assert(completeShot.directorPlan.splitPolicy === "split_for_reaction", "Project planner should preserve shot split policy");
assert(
  completeShot.image2StoryboardPlan.prompt.includes("阿森的手压住门把"),
  "Image2 storyboard prompt should include director primary action",
);
assert(
  completeShot.seedanceVideoPlan.directorStrategy.rhythmProfile === "anime_emotion",
  "Seedance video plan should inherit project-level director rhythm",
);
assert(
  completeShot.seedanceVideoPlan.inputs.images.map((image) => image.role).join("|") === "storyboard_reference|scene_baseline|character_identity|prop_reference",
  "Seedance video should receive storyboard, scene, character, and prop references in order",
);
assert(
  completeShot.seedanceVideoPlan.referencePolicy.roleBindings.some((binding) => binding.role === "storyboard_reference" && binding.ignoreFor.includes("character identity")),
  "Seedance plan should bind storyboard as layout-only reference",
);
assert(completeShot.seedanceVideoPlan.inputs.audio[0]?.role === "dialogue_audio", "Seedance video should receive dialogue audio");
assert(completeShot.selectedReferences.sceneBaseline?.id === "scene_rain_station", "selected scene baseline mismatch");

const missingScene = buildStoryboardReferenceProjectPlan({
  shots: [{
    id: "S03",
    title: "无场景参考镜头",
    intent: "阿森站在空白走廊里回头。",
    characterAssetIds: ["char_asen"],
    propAssetIds: ["prop_projector"],
  }],
  assets: [characterHero, propProjector],
  storyboardReferences: [{
    ...storyboardS01,
    id: "storyboard_s03",
    path: "/project/storyboard/S03-storyboard-reference.png",
    usedByShotIds: ["S03"],
  }],
  audioReferences: [{ ...dialogueS01, id: "audio_s03_dialogue", shotIds: ["S03"] }],
});

const missingSceneShot = missingScene.shotPlans[0]!;
assert(
  missingSceneShot.image2StoryboardPlan.references.map((reference) => reference.role).join("|") === "character_identity|prop_reference",
  "missing scene should still use locked character and prop references for storyboard consistency",
);
assert(
  missingSceneShot.warnings.some((warning) => warning.includes("还没有可用的场景/天气参考")),
  "missing scene warning should be user-readable",
);
assert(missingSceneShot.seedanceVideoPlan?.inputs.images.every((image) => image.role !== "scene_baseline"), "missing scene should not invent a scene reference");

const multipleScenes = buildStoryboardReferenceProjectPlan({
  shots: [
    {
      id: "S01",
      title: "雨夜旧站台",
      intent: "阿森在旧站台看向放映室灯光。",
      sceneAssetIds: ["scene_rain_station"],
    },
    {
      id: "S02",
      title: "清晨天桥",
      intent: "阿森在清晨天桥拍下第一班车。",
      sceneAssetIds: ["scene_morning_bridge"],
    },
  ],
  assets: [sceneRain, sceneMorning],
  storyboardOutputRoot: "/project/storyboard",
});

const s01 = multipleScenes.shotPlans.find((plan) => plan.shotId === "S01")!;
const s02 = multipleScenes.shotPlans.find((plan) => plan.shotId === "S02")!;
assert(s01.selectedReferences.sceneBaseline?.id === "scene_rain_station", "S01 should take only its bound scene");
assert(s02.selectedReferences.sceneBaseline?.id === "scene_morning_bridge", "S02 should take only its bound scene");
assert(s01.image2StoryboardPlan.references[0]?.path === sceneRain.path, "S01 Image2 scene path mismatch");
assert(s02.image2StoryboardPlan.references[0]?.path === sceneMorning.path, "S02 Image2 scene path mismatch");

const roleLeakCheck = buildStoryboardReferenceProjectPlan({
  shots: [{
    id: "S04",
    title: "角色道具进入分镜",
    intent: "阿森拿起老放映机旁的胶片盒。",
    sceneAssetIds: ["scene_rain_station"],
    characterAssetIds: ["char_asen"],
    propAssetIds: ["prop_projector"],
  }],
  assets: [sceneRain, characterHero, propProjector],
  storyboardOutputRoot: "/project/storyboard",
});
const roleLeakShot = roleLeakCheck.shotPlans[0]!;
assert(roleLeakShot.image2StoryboardPlan.references.map((reference) => reference.role).join("|") === "scene_baseline|character_identity|prop_reference", "Image2 should include scene, character, and prop references");
assert(
  !roleLeakShot.image2StoryboardPlan.prompt.includes(characterHero.path) && !roleLeakShot.image2StoryboardPlan.prompt.includes(propProjector.path),
  "Image2 prompt should not leak local reference file paths",
);
assert(
  roleLeakShot.seedanceVideoPlan?.inputs.images.some((image) => image.role === "character_identity")
    && roleLeakShot.seedanceVideoPlan.inputs.images.some((image) => image.role === "prop_reference"),
  "character and prop references should still enter the video plan",
);

const allMessages = [
  ...complete.blockedReasons,
  ...complete.warnings,
  ...missingScene.blockedReasons,
  ...missingScene.warnings,
  ...multipleScenes.blockedReasons,
  ...multipleScenes.warnings,
].join("\n");
assert(!/provider|schema|queue/i.test(allMessages), "user-readable blocked reasons/warnings must not expose machine terms");

console.log(
  `storyboard-reference-project-planner-test: shots=${complete.shotPlans.length + missingScene.shotPlans.length + multipleScenes.shotPlans.length + roleLeakCheck.shotPlans.length}, completeSeedanceImages=${completeShot.seedanceVideoPlan.inputs.images.length}.`,
);
