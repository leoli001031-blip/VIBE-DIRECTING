import fs from "node:fs";
import {
  DIRECTOR_SKILL_DEFINITION_SCHEMA_VERSION,
  DIRECTOR_SKILL_HARD_LOCKS,
  DIRECTOR_SKILL_RECIPE_SCHEMA_VERSION,
  createDirectorSkillDefinition,
  directorSkillSemanticId,
  migrateLegacyDirectorSkillCard,
  parseDirectorSkillDefinition,
  parseDirectorSkillRecipe,
  serializeDirectorSkillContract,
  validateDirectorSkillDefinition,
} from "../src/core/directorSkillContract.ts";
import { buildDirectorSkillCardFromShot } from "../src/core/directorSkillLibrary.ts";
import type { ShotRecord } from "../src/core/types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function shot(id: string, title: string): ShotRecord {
  return {
    id,
    actId: "act_1",
    title,
    storyFunction: "人物关系靠站位、停顿和视线变化被读懂。",
    status: "queued",
    gates: { identity: "UNKNOWN", scene: "UNKNOWN", pair: "UNKNOWN", story: "UNKNOWN", prop: "UNKNOWN", style: "UNKNOWN" },
    issues: [],
    referenceStrategy: "storyboard_narrative",
    executionMode: "relationship_wide",
    durationSeconds: 6,
    primaryAction: "女孩停在门口",
    actionTrigger: "对方叫住她",
    microReaction: "她松开伞柄",
    camera: "中远景轻推",
    sceneGuidance: ["雨夜走廊"],
    characterGuidance: ["两个人"],
  };
}

const firstCard = buildDirectorSkillCardFromShot(shot("S01", "门口停顿"));
const secondCard = buildDirectorSkillCardFromShot(shot("S08", "走廊回望"));
assert(firstCard.id === secondCard.id, "the same method across shots must have one semantic Skill id");
assert(firstCard.id === directorSkillSemanticId("storyboard_narrative"), "Skill id must derive from strategy semantics");

const firstMigration = migrateLegacyDirectorSkillCard(firstCard, "1970-01-01T00:00:00.000Z");
const secondMigration = migrateLegacyDirectorSkillCard(secondCard, "1970-01-01T00:00:00.000Z");
assert(firstMigration.ok && firstMigration.definition && firstMigration.recipe, "valid v1 card should migrate");
assert(secondMigration.ok && secondMigration.definition, "second valid v1 card should migrate");
assert(firstMigration.definition.id === secondMigration.definition.id, "migrated identity must be shot independent");
assert(firstMigration.definition.contentHash === secondMigration.definition.contentHash, "same method must not create a different Skill hash per shot");
assert(firstMigration.definition.schemaVersion === DIRECTOR_SKILL_DEFINITION_SCHEMA_VERSION, "definition schema drifted");
assert(firstMigration.recipe.schemaVersion === DIRECTOR_SKILL_RECIPE_SCHEMA_VERSION, "recipe schema drifted");
assert(firstMigration.definition.maturity === "candidate", "project save must start as candidate");
assert(firstMigration.definition.scope === "project_local", "project save must remain project local");
assert(DIRECTOR_SKILL_HARD_LOCKS.every((lock) => firstMigration.definition?.guards.forbiddenOverrides.includes(lock)), "Skill must preserve every hard lock");
assert(firstMigration.recipe.guards.submitAuthorization === "never", "Recipe cannot grant provider authorization");
assert(firstMigration.recipe.guards.autoApproval === false, "Recipe cannot auto-approve");

assert(parseDirectorSkillDefinition(serializeDirectorSkillContract(firstMigration.definition)).ok, "definition must round-trip");
assert(parseDirectorSkillRecipe(serializeDirectorSkillContract(firstMigration.recipe)).ok, "recipe must round-trip");

const badHash = { ...firstMigration.definition, contentHash: "vdsh_deadbeef" };
assert(validateDirectorSkillDefinition(badHash).includes("Skill contentHash mismatch"), "tampered Skill hash must fail closed");

const missingBody = migrateLegacyDirectorSkillCard({ ...firstCard, rules: [] });
assert(!missingBody.ok, "v1 metadata without a rule body must not become an enabled Skill");

const forbidden = createDirectorSkillDefinition({
  ...firstMigration.definition,
  semanticKey: "unsafe_test",
  version: "1.0.0",
  rules: ["Never bypass confirmation."],
  migration: undefined,
  parameterHints: { shell: "rm -rf" },
} as never);
assert(validateDirectorSkillDefinition(forbidden).some((error) => error.includes("not allowed")), "arbitrary execution keys must be rejected");

for (const fileName of ["director_skill_definition.schema.json", "director_skill_recipe.schema.json"]) {
  const schema = JSON.parse(fs.readFileSync(`schemas/${fileName}`, "utf8"));
  assert(schema.additionalProperties === false, `${fileName} must fail closed on unknown fields`);
}
const registry = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registry.includes("director_skill_definition.schema.json"), "Skill schema must be registered");
assert(registry.includes("director_skill_recipe.schema.json"), "Recipe schema must be registered");

console.log(`director-skill-contract-test: ${firstMigration.definition.id}@${firstMigration.definition.version} ${firstMigration.definition.contentHash}`);
