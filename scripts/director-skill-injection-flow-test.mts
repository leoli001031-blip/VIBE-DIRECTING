import {
  buildScriptStoryboardPromptPack,
} from "../src/core/scriptStoryboardPromptPack.ts";
import { buildStoryboardReferenceProjectPlan } from "../src/core/storyboardReferenceProjectPlanner.ts";
import { buildDirectorSkillCardFromShot } from "../src/core/directorSkillLibrary.ts";
import { migrateLegacyDirectorSkillCard } from "../src/core/directorSkillContract.ts";
import { validateDirectorSkillInvocationReceipt } from "../src/core/directorSkillEvidence.ts";
import type { StoryboardReferenceAsset } from "../src/core/storyboardReferencePipeline.ts";
import type { ShotRecord } from "../src/core/types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const projectShot: ShotRecord = {
  id: "P10S01", actId: "act_1", title: "雨夜便利店门口", storyFunction: "女孩把纸飞机递给机器人保安，停顿让关系被读懂。", status: "queued",
  gates: { identity: "UNKNOWN", scene: "UNKNOWN", pair: "UNKNOWN", story: "UNKNOWN", prop: "UNKNOWN", style: "UNKNOWN" }, issues: [],
  referenceStrategy: "storyboard_narrative", executionMode: "relationship_wide", durationSeconds: 6,
  primaryAction: "女孩递出纸飞机", actionTrigger: "机器人伸手挡住雨", microReaction: "女孩松开手指", camera: "中远景轻推",
  sceneGuidance: ["雨夜便利店门口"], characterGuidance: ["女孩", "机器人保安"], propGuidance: ["纸飞机"],
};
const migrated = migrateLegacyDirectorSkillCard(buildDirectorSkillCardFromShot(projectShot));
assert(migrated.ok && migrated.definition && migrated.recipe, "project Skill fixture must migrate");

const scene: StoryboardReferenceAsset = { id: "scene_store", role: "scene_baseline", path: "/tmp/p10-s/scene.png", label: "雨夜便利店" };
const girl: StoryboardReferenceAsset = { id: "char_girl", role: "character_identity", path: "/tmp/p10-s/girl.png", label: "女孩" };
const robot: StoryboardReferenceAsset = { id: "char_robot", role: "character_identity", path: "/tmp/p10-s/robot.png", label: "机器人保安" };
const plane: StoryboardReferenceAsset = { id: "prop_plane", role: "prop_reference", path: "/tmp/p10-s/plane.png", label: "纸飞机" };

const pack = buildScriptStoryboardPromptPack({
  title: "发光纸飞机",
  logline: "雨夜里，女孩把纸飞机递给机器人保安。",
  completeScript: "雨夜便利店门口。女孩把纸飞机递给机器人保安，纸飞机在灯箱里亮起来。",
  style: "restrained cinematic anime",
  storyboardOutputDir: "/tmp/p10-s/storyboards",
  videoOutputDir: "/tmp/p10-s/videos",
  referenceBundle: { scenes: [scene], characters: [girl, robot], props: [plane] },
  shots: [{
    shotId: projectShot.id,
    title: projectShot.title,
    durationSeconds: 6,
    executionMode: "relationship_wide",
    referenceStrategy: "storyboard_narrative",
    sceneId: scene.id,
    characterIds: [girl.id, robot.id],
    propIds: [plane.id],
    shotSize: "中远景",
    camera: projectShot.camera || "中远景",
    frameDescription: projectShot.storyFunction,
    actionBeats: ["女孩递出纸飞机", "机器人停住", "纸飞机亮起来"],
    primaryAction: projectShot.primaryAction,
    actionTrigger: projectShot.actionTrigger,
    microReaction: projectShot.microReaction,
  }],
  directorSkillContext: {
    definitions: [migrated.definition],
    recipes: [migrated.recipe],
    knowledgePacks: [{ packId: "camera/core", version: "1.0.0", hash: "kp_camera_001" }],
    projectIdentity: {
      projectId: "p10-s-project",
      projectRoot: "/tmp/p10-s/project",
      projectFactHash: "fact_p10_s_001",
    },
    userPreferenceTags: ["restrained"],
    projectConstraints: [{ key: "no_bgm", value: true, source: "project_fact", hard: true }],
    actionIdPrefix: "p10_skill_plan",
    jobIdPrefix: "p10_skill_dry_run",
    generatedAt: "2026-07-16T04:00:00.000Z",
  },
});

const result = pack.shots[0];
assert(result.directorSkillRoute?.primary?.skillId === migrated.definition.id, "Story Planner must route the saved project Skill");
assert(result.productionSkillPlan.reasons.some((reason) => reason.includes(migrated.definition.id)), "Planner plan must record Skill guidance");
assert(result.directorSkillInjection?.compilerBinding?.contentHash === migrated.definition.contentHash, "Prompt compiler must bind the routed Skill hash");
assert(result.image2StoryboardPlan?.prompt.includes(migrated.definition.contentHash), "Image2 dry-run prompt must contain the selected Skill binding");
assert(result.seedanceVideoPlan.prompt.includes(migrated.definition.contentHash), "Seedance dry-run prompt must contain the selected Skill binding");
assert(result.directorSkillQa?.status === "pass", "QA must validate the compiler binding");
assert(result.directorSkillQa?.expectedSkillHash === result.directorSkillQa?.compiledSkillHash, "Planner/Prompt/QA Skill hashes must agree");
assert(result.directorSkillQa?.expectedKnowledgePackHashes[0] === "kp_camera_001", "QA must check the same Knowledge Pack hash");
assert(result.directorSkillInvocationReceipt?.status === "validated", "dry-run chain must produce a validated invocation receipt");
assert(result.directorSkillInvocationReceipt?.projectFactHash === "fact_p10_s_001", "receipt must bind current project facts");
assert(result.directorSkillInvocationReceipt?.provider.executionMode === "dry_run", "receipt must not claim a live provider call");
assert(validateDirectorSkillInvocationReceipt(result.directorSkillInvocationReceipt!).length === 0, "generated invocation receipt must validate");
assert(result.directorSkillInjection?.providerSubmitAuthorized === false, "injected Skill must not grant provider submit permission");

const projectPlan = buildStoryboardReferenceProjectPlan({
  projectId: "p10-s-project",
  shots: [{
    id: projectShot.id,
    title: projectShot.title,
    intent: projectShot.storyFunction,
    camera: projectShot.camera,
    executionMode: projectShot.executionMode,
    referenceStrategy: projectShot.referenceStrategy,
    durationSeconds: projectShot.durationSeconds,
    primaryAction: projectShot.primaryAction,
    actionTrigger: projectShot.actionTrigger,
    microReaction: projectShot.microReaction,
    sceneAssetIds: [scene.id],
    characterAssetIds: [girl.id, robot.id],
    propAssetIds: [plane.id],
  }],
  assets: [
    { id: scene.id, role: scene.role, path: scene.path, label: scene.label, usedByShotIds: [projectShot.id] },
    { id: girl.id, role: girl.role, path: girl.path, label: girl.label, usedByShotIds: [projectShot.id] },
    { id: robot.id, role: robot.role, path: robot.path, label: robot.label, usedByShotIds: [projectShot.id] },
    { id: plane.id, role: plane.role, path: plane.path, label: plane.label, usedByShotIds: [projectShot.id] },
  ],
  storyboardOutputRoot: "/tmp/p10-s/project/storyboards",
  videoOutputRoot: "/tmp/p10-s/project/videos",
  directorSkillContext: {
    definitions: [migrated.definition],
    recipes: [migrated.recipe],
    knowledgePacks: [{ packId: "camera/core", version: "1.0.0", hash: "kp_camera_001" }],
    projectIdentity: { projectId: "p10-s-project", projectRoot: "/tmp/p10-s/project", projectFactHash: "fact_p10_s_001" },
    generatedAt: "2026-07-16T04:00:00.000Z",
  },
});
const projectShotPlan = projectPlan.shotPlans[0];
assert(projectPlan.providerCalled === false, "project planner Skill flow must stay provider-free");
assert(projectShotPlan.directorSkillRoute?.primary?.skillId === migrated.definition.id, "project planner must route saved Skill");
assert(projectShotPlan.image2StoryboardPlan?.prompt.includes(migrated.definition.contentHash), "project Image2 compiler must inject Skill hash");
assert(projectShotPlan.seedanceVideoPlan?.prompt.includes(migrated.definition.contentHash), "project video compiler must inject Skill hash");
assert(projectShotPlan.directorSkillQa?.status === "pass", "project QA must verify the same Skill binding");
assert(projectShotPlan.directorSkillInvocationReceipt?.provider.executionMode === "dry_run", "project receipt must stay dry-run");

console.log(`director-skill-injection-flow-test: route=${result.directorSkillRoute?.routeId} receipt=${result.directorSkillInvocationReceipt?.receiptId} projectRoute=${projectShotPlan.directorSkillRoute?.routeId}`);
