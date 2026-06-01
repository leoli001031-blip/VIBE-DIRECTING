import {
  buildDirectorProductionSkillPlan,
  DIRECTOR_PRODUCTION_SKILL_VERSION,
  productionSkillImage2PromptBlock,
  productionSkillSeedancePromptBlock,
} from "../src/core/directorProductionSkill.ts";
import { buildScriptStoryboardPromptPack } from "../src/core/scriptStoryboardPromptPack.ts";
import type { StoryboardReferenceAsset } from "../src/core/storyboardReferencePipeline.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const lockedAssetState = {
  scene: "locked" as const,
  characters: "locked" as const,
  props: "locked" as const,
};

const quiet = buildDirectorProductionSkillPlan({
  shotId: "Q01",
  title: "雨夜走廊的安静对白",
  durationSeconds: 6,
  shotText: "两个人站在旧校舍走廊尽头低声对话，只有停顿、眼神和呼吸变化。",
  userPreference: "克制日漫，不要动作戏，不要广告感。",
  assetState: { scene: "locked", characters: "locked" },
});
assert(quiet.schemaVersion === DIRECTOR_PRODUCTION_SKILL_VERSION, "skill version mismatch");
assert(quiet.strategyId === "storyboard_narrative" || quiet.strategyId === "omni_reference", "quiet dialogue should not route to rapid-cut storyboard");
assert(!quiet.image2Directive.allowProductionAnnotations, "quiet/state references should not allow production annotations by default");
assert(!productionSkillImage2PromptBlock(quiet).includes("RED = camera"), "quiet/state references must not expose annotation color key");

const state = buildDirectorProductionSkillPlan({
  shotId: "S01",
  title: "磁带递出前一拍",
  durationSeconds: 5,
  executionMode: "action_insert",
  shotText: "日奈的手托着蓝色磁带盒伸向画面右侧，莲的手从右侧伸进来，在快碰到磁带前停住半拍。",
  actionBeats: ["日奈手指收紧", "莲的手慢慢靠近", "两只手之间留出半拍停顿"],
  assetState: lockedAssetState,
});
assert(state.strategyId === "omni_reference", "short action insert should route to omni reference instead of a single start frame");
assert(state.image2Directive.mode === "none", "omni route should not request Image2 storyboard/start-frame generation");
assert(state.panelCountIntent === 0, "omni reference should not request a panel grid");
assert(productionSkillImage2PromptBlock(state).includes("Do not generate an extra storyboard reference"), "omni Image2 prompt should be a skip contract");
assert(!productionSkillImage2PromptBlock(state).includes("Production annotation mode is allowed"), "state Image2 prompt should not allow annotations");

const action = buildDirectorProductionSkillPlan({
  shotId: "A01",
  title: "Whisperbloom Fan Kata",
  durationSeconds: 15,
  executionMode: "planned_cut_sequence",
  shotText: "战扇大师从低角度开扇，旋身，横向斩击，腾跃，落地后向前推进。",
  actionBeats: [
    "fan snap reveal",
    "stillness before motion",
    "first bloom cut",
    "spin entry",
    "hidden blade draw",
    "aerial turn",
    "double arc strike",
    "water step",
    "bell impact pass",
    "mid-air silhouette",
    "descent cut",
    "forward ending",
  ],
  userPreference: "像 rough sakuga planning thumbnails，不要精修插画。",
  assetState: lockedAssetState,
});
assert(action.strategyId === "storyboard_rapid_cut", "fan kata should route to rapid-cut storyboard");
assert(action.panelCountIntent === 12, "long action sequence should request 12 panel intent");
assert(action.image2Directive.mode === "rapid_cut_storyboard", "action route should request rapid-cut storyboard");
assert(action.image2Directive.allowProductionAnnotations === true, "action storyboard should allow production annotation key");
const actionImage2 = productionSkillImage2PromptBlock(action);
const actionSeedance = productionSkillSeedancePromptBlock(action);
assert(actionImage2.includes("RED = camera"), "action Image2 prompt should include camera annotation key");
assert(actionImage2.includes("GREEN = key prop"), "action Image2 prompt should include prop/motion annotation key");
assert(actionImage2.includes("Each panel carries one clear action/camera beat"), "action storyboard should force one beat per panel");
assert(actionSeedance.includes("RED=camera"), "Seedance block must explain red annotation semantics");
assert(actionSeedance.includes("GREEN=prop/cloth/environment/motion path"), "Seedance block must explain green annotation semantics");
assert(actionSeedance.includes("Do not render storyboard artifacts"), "Seedance block must strip storyboard artifacts");
assert(actionSeedance.includes("No arrows, colored lines"), "Seedance block must forbid visible annotations in final video");
assert(actionSeedance.includes("默认 no BGM"), "Seedance block must carry no-BGM default");

const shortAction = buildDirectorProductionSkillPlan({
  shotId: "A00",
  title: "短时长追逐切点",
  durationSeconds: 8,
  executionMode: "planned_cut_sequence",
  shotText: "少女冲过门口，转身抓住掉落的包，再看向追来的人。",
  actionBeats: ["冲过门口", "转身", "抓住包", "看向追来的人", "继续跑"],
  assetState: lockedAssetState,
});
assert(shortAction.strategyId === "storyboard_rapid_cut", "short planned action should still route to rapid-cut storyboard");
assert(shortAction.panelCountIntent === 4, "8s action should cap storyboard intent to the duration-safe 4 panels");
assert(productionSkillImage2PromptBlock(shortAction).includes("Panel count intent: 4"), "short action prompt must expose duration-safe panel count");

const aiSelectedNarrative = buildDirectorProductionSkillPlan({
  shotId: "A01B",
  title: "AI 选择的叙事故事板",
  durationSeconds: 4,
  executionMode: "planned_cut_sequence",
  referenceStrategy: "storyboard_narrative",
  shotText: "AI 已经判断这段更适合叙事故事板：便利店霓虹闪一下，车身短暂停住，只表现一个悬疑动作。",
  actionBeats: ["霓虹闪一下", "车身停住"],
  assetState: lockedAssetState,
});
assert(aiSelectedNarrative.strategyId === "storyboard_narrative", "explicit AI referenceStrategy should override heuristic re-routing");
assert(aiSelectedNarrative.reasons.some((reason) => reason.includes("沿用 AI 分镜规划选择")), "explicit strategy should leave an audit reason");

const motion = buildDirectorProductionSkillPlan({
  shotId: "M01",
  title: "Ribbon Storm Bloom",
  durationSeconds: 15,
  shotText: "神话舞者旋转，丝带从茧爆开，形成花朵、曼陀罗、书法线条、风暴和蝶翼。",
  actionBeats: [
    "ribbon cocoon burst",
    "arm whip circular sweep",
    "spiral ascent",
    "flower bloom snap",
    "mandala spin",
    "calligraphy break",
    "ribbon storm",
    "butterfly wing reveal",
  ],
  userPreference: "motion readability, choreography, transformation flow",
  assetState: lockedAssetState,
});
assert(motion.strategyId === "storyboard_rapid_cut", "ribbon transformation should route to rapid-cut storyboard");
assert(motion.image2Directive.mode === "rapid_cut_storyboard", "motion-system route should use the rapid-cut storyboard compiler");
assert(motion.panelCountIntent === 12, "long motion system should request 12 panel intent");
assert(productionSkillImage2PromptBlock(motion).includes("motion-system path"), "motion-system prompt should include motion system annotation role");

const baselineFirst = buildDirectorProductionSkillPlan({
  shotId: "B01",
  title: "缺少角色场景的追逐",
  durationSeconds: 8,
  shotText: "少女冲过车站，回头确认追来的人。",
  actionBeats: ["少女冲刺", "回头", "确认追来的人"],
  assetState: { scene: "missing", characters: "candidate", props: undefined },
});
assert(baselineFirst.assetReadiness.needsBaselineFirst === true, "unlocked scene/character refs should require baseline first");
assert(baselineFirst.warnings.some((warning) => warning.includes("baseline_first_required")), "baseline-first warning missing");
assert(productionSkillSeedancePromptBlock(baselineFirst).includes("Do not submit provider job"), "Seedance block should prevent submit before baselines are locked");

const scene: StoryboardReferenceAsset = {
  id: "scene_rooftop",
  role: "scene_baseline",
  path: "/project/assets/scenes/rooftop.png",
  label: "雨后天台",
};
const hina: StoryboardReferenceAsset = {
  id: "char_hina",
  role: "character_identity",
  path: "/project/assets/characters/hina.png",
  label: "短发少女日奈",
};
const ren: StoryboardReferenceAsset = {
  id: "char_ren",
  role: "character_identity",
  path: "/project/assets/characters/ren.png",
  label: "少年莲",
};
const cassette: StoryboardReferenceAsset = {
  id: "prop_cassette",
  role: "prop_reference",
  path: "/project/assets/props/cassette.png",
  label: "蓝色磁带盒",
};

const pack = buildScriptStoryboardPromptPack({
  title: "内化 Skill 测试",
  logline: "日奈把磁带递给莲，动作被拆成关系、手部、反应。",
  completeScript: "雨后天台。日奈把蓝色磁带盒递给莲，莲在快接到前停住，两人抬眼对望。",
  style: "restrained Japanese TV anime, emotional close-up rhythm",
  storyboardOutputDir: "/project/storyboards",
  videoOutputDir: "/project/videos",
  referenceBundle: {
    scenes: [scene],
    characters: [hina, ren],
    props: [cassette],
  },
  shots: [{
    shotId: "SK01",
    title: "手部停顿",
    durationSeconds: 4,
    executionMode: "action_insert",
    sceneId: scene.id,
    characterIds: [hina.id, ren.id],
    propIds: [cassette.id],
    shotSize: "手部特写",
    camera: "低一点的手部插入特写，背景保留湿地面反光。",
    frameDescription: "日奈的手托着蓝色磁带盒伸向画面右侧，莲的手快碰到前停住。",
    actionBeats: ["日奈递出磁带", "莲的手靠近", "两只手之间停住半拍"],
    primaryAction: "莲的手慢慢靠近磁带盒",
    actionTrigger: "日奈把磁带盒递到两人中间",
    microReaction: "两只手之间留出半拍停顿",
    actorAction: "莲的手从右侧伸进来",
    reactorResponse: "日奈手指收紧但没有收回磁带",
    dialogue: "-",
    sound: "雨后水滴声。",
  }],
});
const packedShot = pack.shots[0]!;
assert(
  ["storyboard_narrative", "storyboard_rapid_cut", "omni_reference"].includes(packedShot.productionSkillPlan.strategyId),
  "prompt pack should carry an internal visual-planning skill route",
);
if (packedShot.image2StoryboardPlan) {
  assert(packedShot.image2StoryboardPlan.prompt.includes("Internal production skill"), "Image2 prompt should include internal skill block");
} else {
  assert(packedShot.productionSkillPlan.strategyId === "omni_reference", "only omni reference may skip Image2 storyboard");
}
assert(packedShot.seedanceVideoPlan.prompt.includes("Internal production skill for Seedance"), "Seedance prompt should include internal skill block");
assert(packedShot.productionSkillPlan.userFacingSummary.length > 8, "packed shot should expose user-facing skill summary");

console.log(`director-production-skill-test: routes=${[quiet.strategyId, state.strategyId, action.strategyId, motion.strategyId, baselineFirst.strategyId].join(",")}, packRoute=${packedShot.productionSkillPlan.strategyId}.`);
