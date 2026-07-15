import {
  applyDirectorSkillPlannerInjection,
  buildDirectorSkillInjection,
  formatDirectorSkillPromptBlock,
  routeDirectorSkills,
  validateDirectorSkillQaBinding,
  type DirectorSkillRouterInput,
} from "../src/core/directorSkillRouter.ts";
import {
  createDirectorSkillDefinition,
  createDirectorSkillRecipe,
  migrateLegacyDirectorSkillCard,
} from "../src/core/directorSkillContract.ts";
import { buildDirectorSkillCardFromShot } from "../src/core/directorSkillLibrary.ts";
import { buildDirectorProductionSkillPlan } from "../src/core/directorProductionSkill.ts";
import type { ShotRecord } from "../src/core/types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const shot: ShotRecord = {
  id: "P10S01", actId: "act_1", title: "雨夜对望", storyFunction: "用站位和停顿表达关系。", status: "queued",
  gates: { identity: "UNKNOWN", scene: "UNKNOWN", pair: "UNKNOWN", story: "UNKNOWN", prop: "UNKNOWN", style: "UNKNOWN" }, issues: [],
  referenceStrategy: "storyboard_narrative", executionMode: "relationship_wide", durationSeconds: 6,
  primaryAction: "女孩停住", actionTrigger: "对方叫住她", microReaction: "她松开手", camera: "中远景轻推",
};
const migrated = migrateLegacyDirectorSkillCard(buildDirectorSkillCardFromShot(shot));
assert(migrated.ok && migrated.definition && migrated.recipe, "fixture Skill must migrate");
const skill = migrated.definition;
const recipe = migrated.recipe;

const baseInput: DirectorSkillRouterInput = {
  taskId: "task_p10s01",
  taskPurpose: "story_planning",
  shot: {
    shotId: shot.id,
    strategyId: "storyboard_narrative",
    executionMode: "relationship_wide",
    durationSeconds: 6,
    actionDensity: "low",
    assetCompleteness: { scene: "ready", characters: "ready", props: "partial", audio: "missing" },
  },
  provider: { slot: "video.i2v", providerId: "none", modelId: "dry-run", capabilities: ["image_reference"] },
  risk: "low",
  userPreferenceTags: [],
  projectConstraints: [{ key: "no_bgm", value: true, source: "project_fact", hard: true }],
  availableSkills: [skill],
  availableRecipes: [recipe],
  availableKnowledgePacks: [{ packId: "camera/core", version: "1.0.0", hash: "kp_camera_001" }],
  maxInjectionTokens: 900,
  createdAt: "2026-07-16T03:00:00.000Z",
};

const route = routeDirectorSkills(baseInput);
assert(route.primary?.skillId === skill.id, "structured strategy/task match should select project Skill");
assert(route.primary?.contentHash === skill.contentHash, "route must bind Skill hash");
assert(route.precedence.join("|") === "system_hard_boundaries|project_facts|trusted_user_skill|candidate_recommendation", "precedence contract drifted");
const injection = buildDirectorSkillInjection(route, baseInput);
assert(injection.compilerBinding?.contentHash === skill.contentHash, "compiler binding must use routed Skill hash");
assert(injection.compilerBinding?.knowledgePacks[0]?.hash === "kp_camera_001", "compiler binding must carry Knowledge Pack hash");
assert(injection.plannerGuidance.length > 0 && injection.seedancePromptFragments.length > 0, "selected Skill must inject bounded planner and prompt guidance");
assert(injection.executionAuthorized === false && injection.providerSubmitAuthorized === false, "Skill routing must never become execution authorization");

const plan = buildDirectorProductionSkillPlan({
  shotId: shot.id,
  referenceStrategy: "storyboard_narrative",
  shotText: shot.storyFunction,
  durationSeconds: shot.durationSeconds,
  executionMode: shot.executionMode,
});
const injectedPlan = applyDirectorSkillPlannerInjection(plan, injection);
assert(injectedPlan.reasons.some((reason) => reason.includes(skill.id)), "Planner must record the selected project Skill");
const promptBlock = formatDirectorSkillPromptBlock(injection, "seedance");
assert(promptBlock.includes(skill.contentHash), "Prompt block must expose the compiler Skill hash");
assert(promptBlock.includes("grants no provider submission"), "Prompt block must preserve authorization boundary");
const qaPass = validateDirectorSkillQaBinding(route, injection.compilerBinding);
assert(qaPass.status === "pass", "QA must accept the exact compiler binding");
const qaBlocked = validateDirectorSkillQaBinding(route, injection.compilerBinding ? { ...injection.compilerBinding, contentHash: "tampered" } : undefined);
assert(qaBlocked.status === "blocked" && qaBlocked.findings.includes("skill_hash_mismatch"), "QA must block compiler hash drift");

const incompatible = routeDirectorSkills({ ...baseInput, provider: { slot: "audio.tts", capabilities: [] } });
assert(!incompatible.primary && incompatible.notSelected.some((item) => item.reason === "provider_incompatible"), "provider incompatibility must fail closed");
const missingRecipe = routeDirectorSkills({ ...baseInput, availableRecipes: [] });
assert(!missingRecipe.primary && missingRecipe.notSelected.some((item) => item.reason === "dependency_missing"), "missing Recipe must fail closed");
const wrongPurpose = routeDirectorSkills({ ...baseInput, taskPurpose: "reference_planning", availableSkills: [{ ...skill, applicability: { ...skill.applicability, taskPurposes: ["qa"] } }] });
assert(!wrongPurpose.primary && wrongPurpose.notSelected.some((item) => item.reason === "invalid_contract" || item.reason === "task_purpose_mismatch"), "task purpose mismatch must not trigger");

const trusted = createDirectorSkillDefinition({
  ...skill,
  id: undefined,
  semanticKey: "relationship_pause_trusted",
  maturity: "trusted",
  scope: "user_global",
  version: "2.0.0",
  source: "user_authored",
  dependencies: [{ kind: "recipe", id: "director.skill.relationship_pause_trusted.recipe.default", version: "2.0.0", optional: false }],
  recipeIds: ["director.skill.relationship_pause_trusted.recipe.default"],
  migration: undefined,
});
const trustedRecipe = createDirectorSkillRecipe({
  id: trusted.recipeIds[0], skillId: trusted.id, version: "2.0.0", compilerProfile: "storyboard_narrative",
  providerCompatibility: trusted.providerCompatibility,
  promptFragments: recipe.promptFragments,
  parameterHints: { strategyId: "storyboard_narrative" },
});
const trustRoute = routeDirectorSkills({ ...baseInput, availableSkills: [skill, trusted], availableRecipes: [recipe, trustedRecipe] });
assert(trustRoute.primary?.skillId === trusted.id, `trusted global Skill must outrank a candidate recommendation: ${JSON.stringify(trustRoute.notSelected)}`);

const tinyBudgetRoute = routeDirectorSkills({ ...baseInput, maxInjectionTokens: 5 });
const tinyInjection = buildDirectorSkillInjection(tinyBudgetRoute, baseInput);
assert(tinyInjection.truncated && tinyInjection.usedTokens <= 5, "context budget must truncate instead of injecting all rules");

console.log(`director-skill-router-test: primary=${route.primary?.skillId} hash=${route.primary?.contentHash} qa=${qaPass.status}`);
