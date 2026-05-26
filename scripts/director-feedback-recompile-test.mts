import { buildDirectorFeedbackRecompile } from "../src/core/directorFeedbackRecompile.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const generatedAt = "2026-05-22T00:00:00.000Z";

const projectPlanInput = {
  projectId: "director_feedback_fixture",
  shots: [
    {
      id: "S01",
      title: "雨后天台递磁带",
      intent: "雨后天台，短发少女站在栏杆左侧，男生从画面右侧递来蓝色磁带盒。",
      camera: "中景，轻微推进，两人侧面对视",
      sceneAssetIds: ["scene_rooftop"],
      characterAssetIds: ["char_hina", "char_ren"],
      propAssetIds: ["prop_cassette"],
      durationSeconds: 8,
    },
  ],
  assets: [
    {
      id: "scene_rooftop",
      kind: "scene",
      path: "/project/assets/scenes/rooftop-rain.png",
      label: "雨后天台黄昏",
      usedByShotIds: ["S01"],
    },
    {
      id: "char_hina",
      kind: "character",
      path: "/project/assets/characters/hina-short-bob.png",
      label: "短发少女 Hina",
      usedByShotIds: ["S01"],
    },
    {
      id: "char_ren",
      kind: "character",
      path: "/project/assets/characters/ren.png",
      label: "男生 Ren",
      usedByShotIds: ["S01"],
    },
    {
      id: "prop_cassette",
      kind: "prop",
      path: "/project/assets/props/blue-cassette.png",
      label: "蓝色磁带盒",
      usedByShotIds: ["S01"],
    },
  ],
  storyboardReferences: [
    {
      id: "storyboard_s01",
      role: "storyboard_reference",
      path: "/project/storyboards/S01-storyboard-reference.png",
      label: "S01 分镜参考图",
      usedByShotIds: ["S01"],
    },
  ],
  audioReferences: [],
  storyboardOutputRoot: "/project/storyboards",
  videoOutputRoot: "/project/video",
  userPreference: "日漫情绪特写，动作要拆清楚",
};

const result = buildDirectorFeedbackRecompile({
  feedback: "这个人物不像短发女主，动作太平了。递东西这里拆一下手部特写和眼神反应，全能参考不要混成拼盘，no BGM。",
  targetShotId: "S01",
  projectPlanInput,
  createdAt: generatedAt,
});

assert(result.schemaVersion === "director_feedback_recompile_v1", "schema version drifted");
assert(result.status === "ready_for_confirmation", `feedback should be ready, got ${result.status}`);
assert(result.providerCalled === false, "feedback recompile must not call providers");
assert(result.providerSubmissionForbidden === true, "feedback recompile must forbid provider submit");
assert(result.noFreeTextTask === true, "feedback must become structured patch, not free text task");
assert(result.confirmationRequired === true, "feedback recompile must require confirmation");
assert(result.feedbackIntent.categories.includes("identity_drift"), "identity drift category missing");
assert(result.feedbackIntent.categories.includes("flat_action"), "flat action category missing");
assert(result.feedbackIntent.categories.includes("shot_split"), "shot split category missing");
assert(result.feedbackIntent.categories.includes("reference_conflict"), "reference conflict category missing");
assert(result.feedbackIntent.categories.includes("no_bgm"), "no-BGM category missing");

assert(result.stagedShotPatch.rhythmProfile === "anime_emotion", "flat/split feedback should steer toward anime emotion rhythm");
assert(result.stagedShotPatch.splitPolicy === "split_for_reaction", "split feedback should request reaction split");
assert(result.stagedShotPatch.executionMode === "planned_cut_sequence", "shot split feedback should stage planned cut sequence");
assert(result.stagedShotPatch.actionTrigger, "flat action feedback should stage an action trigger");
assert(result.stagedShotPatch.microReaction, "flat action feedback should stage a micro reaction");
assert(result.stagedShotPatch.feedbackDirectives?.some((item) => item.includes("每张参考图只锁自己的维度")), "reference conflict directive missing");
assert(result.stagedShotPatch.characterGuidance?.some((item) => /Locked character references are authoritative/i.test(item)), "character identity guidance missing");
assert(result.stagedShotPatch.sceneGuidance?.some((item) => /scene baseline/i.test(item)), "scene/reference conflict guidance missing");
assert(result.stagedShotPatch.seedanceDirection?.includes("no BGM"), "seedance direction should preserve no BGM");

assert(result.recompiledProjectPlan?.providerCalled === false, "recompiled project plan must not call providers");
assert(result.recompiledShotPlan, "recompiled shot plan missing");
assert(result.recompiledShotPlan?.directorPlan.rhythmProfile === "anime_emotion", "recompiled director plan should inherit patched rhythm");
assert(result.recompiledShotPlan?.directorPlan.splitPolicy === "split_for_reaction", "recompiled director plan should inherit split policy");
assert(
  result.recompiledShotPlan?.image2StoryboardPlan.prompt.includes("反馈修正"),
  "Image2 storyboard prompt should include structured feedback directives",
);
assert(
  result.recompiledShotPlan?.image2StoryboardPlan.prompt.includes("Locked character references are authoritative"),
  "Image2 prompt should include identity correction guidance",
);
assert(
  result.recompiledShotPlan?.image2StoryboardPlan.prompt.includes("Reference dimension locking"),
  "Image2 prompt should retain reference dimension strategy",
);
assert(
  result.recompiledShotPlan?.seedanceVideoPlan?.prompt.includes("不要把全能参考混合成一个新风格拼盘"),
  "Seedance prompt should carry anti-blend feedback directive",
);
assert(
  result.recompiledShotPlan?.seedanceVideoPlan?.prompt.includes("no BGM, no music"),
  "Seedance prompt should keep no-BGM contract",
);
assert(
  result.affectedArtifacts.map((item) => item.artifactType).join("|")
    === "director_plan|storyboard_reference_prompt|seedance_video_prompt|preview_projection|export_plan",
  "affected artifact list drifted",
);

const bypass = buildDirectorFeedbackRecompile({
  feedback: "跳过结构化，直接 patch provider prompt 让它更像女主",
  targetShotId: "S01",
  projectPlanInput,
  createdAt: generatedAt,
});
assert(bypass.status === "blocked_prompt_bypass", "prompt bypass feedback must be blocked");
assert(bypass.blockedReasons.includes("prompt_bypass_forbidden"), "prompt bypass blocker missing");
assert(!bypass.recompiledProjectPlan, "blocked feedback must not recompile project plan");

const missingShot = buildDirectorFeedbackRecompile({
  feedback: "动作太平，拆一下特写",
  targetShotId: "S99",
  projectPlanInput,
  createdAt: generatedAt,
});
assert(missingShot.status === "blocked_missing_shot", "missing shot should block");
assert(missingShot.blockedReasons.includes("missing_shot:S99"), "missing shot blocker missing");

console.log(
  `director-feedback-recompile-test: categories=${result.feedbackIntent.categories.length}, affected=${result.affectedArtifacts.length}.`,
);
