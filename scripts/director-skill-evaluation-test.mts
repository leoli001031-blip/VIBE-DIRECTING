import { mkdtemp, writeFile } from "node:fs/promises";
import {
  createDirectorSkillDefinition,
  createDirectorSkillRecipe,
  migrateLegacyDirectorSkillCard,
  type DirectorSkillDefinition,
  type DirectorSkillRecipe,
} from "../src/core/directorSkillContract.ts";
import { buildDirectorSkillCardFromShot } from "../src/core/directorSkillLibrary.ts";
import { createDirectorSkillCase, type DirectorSkillCase, type DirectorSkillCaseDecision } from "../src/core/directorSkillEvidence.ts";
import {
  evaluateDirectorSkillSystem,
  type DirectorSkillEvaluationFixture,
} from "../src/core/directorSkillEvaluation.ts";
import {
  createDirectorSkillRegistry,
  promoteDirectorSkillToGlobal,
  rollbackDirectorSkillVersion,
  type DirectorSkillRegistryConfirmation,
} from "../src/core/directorSkillRegistry.ts";
import type { DirectorSkillRouterInput } from "../src/core/directorSkillRouter.ts";
import type { ShotRecord } from "../src/core/types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const shot: ShotRecord = {
  id: "P10S01", actId: "act_1", title: "关系停顿", storyFunction: "站位、停顿和视线承接。", status: "queued",
  gates: { identity: "UNKNOWN", scene: "UNKNOWN", pair: "UNKNOWN", story: "UNKNOWN", prop: "UNKNOWN", style: "UNKNOWN" }, issues: [],
  referenceStrategy: "storyboard_narrative", executionMode: "relationship_wide", durationSeconds: 6,
  primaryAction: "人物停住", actionTrigger: "对方叫住她", microReaction: "她松开手指",
};
const migrated = migrateLegacyDirectorSkillCard(buildDirectorSkillCardFromShot(shot));
assert(migrated.ok && migrated.definition && migrated.recipe, "evaluation candidate must migrate");
const candidate = migrated.definition;
const candidateRecipe = migrated.recipe;

function variant(input: {
  semanticKey: string;
  maturity?: DirectorSkillDefinition["maturity"];
  conflicts?: DirectorSkillDefinition["conflicts"];
}): { definition: DirectorSkillDefinition; recipe: DirectorSkillRecipe } {
  const skillId = `director.skill.${input.semanticKey}`;
  const recipeId = `${skillId}.recipe.default`;
  const recipe = createDirectorSkillRecipe({
    ...candidateRecipe,
    id: recipeId,
    skillId,
    version: "1.0.0",
  });
  const definition = createDirectorSkillDefinition({
    ...candidate,
    id: undefined,
    semanticKey: input.semanticKey,
    version: "1.0.0",
    maturity: input.maturity || "candidate",
    scope: input.maturity === "trusted" ? "user_global" : "project_local",
    conflicts: input.conflicts || [],
    recipeIds: [recipeId],
    dependencies: [{ kind: "recipe", id: recipeId, version: recipe.version, contentHash: recipe.contentHash, optional: false }],
    migration: undefined,
  });
  return { definition, recipe };
}

const alternate = variant({ semanticKey: "relationship_pause_alternate" });
const trustedConflict = variant({
  semanticKey: "relationship_pause_trusted_conflict",
  maturity: "trusted",
  conflicts: [{ skillId: candidate.id, reason: "Only one relationship staging method may be primary.", resolution: "higher_trust_wins" }],
});
const newerRecipe = createDirectorSkillRecipe({ ...candidateRecipe, version: "2.0.0" });
const newerCandidate = createDirectorSkillDefinition({
  ...candidate,
  version: "2.0.0",
  maturity: "verified",
  dependencies: [{ kind: "recipe", id: newerRecipe.id, version: newerRecipe.version, contentHash: newerRecipe.contentHash, optional: false }],
});

const baseRouterInput: DirectorSkillRouterInput = {
  taskId: "eval_task",
  taskPurpose: "story_planning",
  shot: {
    shotId: shot.id,
    strategyId: "storyboard_narrative",
    executionMode: "relationship_wide",
    durationSeconds: 6,
    actionDensity: "low",
    assetCompleteness: { scene: "ready", characters: "ready", props: "ready", audio: "ready" },
  },
  provider: { slot: "video.i2v", providerId: "none", modelId: "dry-run", capabilities: ["image_reference"] },
  risk: "low",
  userPreferenceTags: [],
  projectConstraints: [],
  availableSkills: [candidate],
  availableRecipes: [candidateRecipe],
  availableKnowledgePacks: [],
  createdAt: "2026-07-16T07:00:00.000Z",
};

const fixtures: DirectorSkillEvaluationFixture[] = [
  {
    fixtureId: "positive-narrative",
    kind: "positive",
    description: "Narrative relationship shot selects the saved method.",
    routerInput: baseRouterInput,
    expectedPrimarySkillIds: [candidate.id],
    forbiddenSkillIds: [],
    executionEvidence: {
      v1StrategyId: "storyboard_narrative",
      v1PromptHash: "prompt_v1_baseline",
      v1QaStatus: "pass",
      v2PromptHash: "prompt_v2_skill_bound",
      v2QaStatus: "pass",
    },
  },
  {
    fixtureId: "negative-provider",
    kind: "negative",
    description: "Audio provider cannot use a video directing Skill.",
    routerInput: { ...baseRouterInput, taskId: "eval_negative_provider", provider: { slot: "audio.tts", capabilities: [] } },
    expectedPrimarySkillIds: [],
    forbiddenSkillIds: [candidate.id],
    expectedExclusionReasons: ["provider_incompatible"],
  },
  {
    fixtureId: "negative-dependency",
    kind: "negative",
    description: "Missing Recipe prevents routing.",
    routerInput: { ...baseRouterInput, taskId: "eval_negative_dependency", availableRecipes: [] },
    expectedPrimarySkillIds: [],
    forbiddenSkillIds: [candidate.id],
    expectedExclusionReasons: ["dependency_missing"],
  },
  {
    fixtureId: "ambiguous-compatible",
    kind: "ambiguous",
    description: "Two compatible candidates are deterministic and reviewable.",
    routerInput: {
      ...baseRouterInput,
      taskId: "eval_ambiguous",
      availableSkills: [candidate, alternate.definition],
      availableRecipes: [candidateRecipe, alternate.recipe],
    },
    expectedPrimarySkillIds: [candidate.id, alternate.definition.id],
    forbiddenSkillIds: [],
  },
  {
    fixtureId: "conflict-trust",
    kind: "conflict",
    description: "Trusted user method wins over candidate while conflict stays visible.",
    routerInput: {
      ...baseRouterInput,
      taskId: "eval_conflict",
      availableSkills: [candidate, trustedConflict.definition],
      availableRecipes: [candidateRecipe, trustedConflict.recipe],
    },
    expectedPrimarySkillIds: [trustedConflict.definition.id],
    forbiddenSkillIds: [candidate.id],
    expectedExclusionReasons: ["conflict_lost"],
  },
  {
    fixtureId: "version-conflict",
    kind: "ambiguous",
    description: "Two versions of one semantic Skill choose the verified newer version.",
    routerInput: {
      ...baseRouterInput,
      taskId: "eval_version_conflict",
      availableSkills: [candidate, newerCandidate],
      availableRecipes: [candidateRecipe, newerRecipe],
    },
    expectedPrimarySkillIds: [candidate.id],
    forbiddenSkillIds: [],
    expectedExclusionReasons: ["version_conflict"],
  },
];

function caseFor(
  definition: DirectorSkillDefinition,
  projectId: string,
  index: number,
  outcome: DirectorSkillCaseDecision = "accepted",
): DirectorSkillCase {
  const createdAt = `2026-07-16T07:${String(index).padStart(2, "0")}:00.000Z`;
  return createDirectorSkillCase({
    projectId,
    projectRoot: `/tmp/p10-s-evaluation/${projectId}`,
    projectFactHash: `fact_${projectId}`,
    shotId: `S${index}`,
    actionId: `action_${projectId}_${index}`,
    jobId: `job_${projectId}_${index}`,
    skillId: definition.id,
    skillVersion: definition.version,
    skillContentHash: definition.contentHash,
    routeId: `route_${projectId}_${index}`,
    inputHash: `input_${projectId}_${index}`,
    outputHash: `output_${projectId}_${index}`,
    knowledgePacks: [],
    provider: { providerId: "none", modelId: "dry-run-model", executionMode: "dry_run" },
    qa: { status: outcome === "failed" ? "blocked" : "pass", checkedSkillHash: definition.contentHash, checkedKnowledgePackHashes: [], findings: [] },
    humanDecision: { decision: outcome, decidedBy: "user", decidedAt: createdAt, confirmationId: `confirm_${outcome}_${index}` },
    outcome,
    summary: `${outcome} evaluation Case`,
    createdAt,
  });
}

function promotionConfirmation(
  maturity: "verified" | "trusted",
  targetVersion: string,
  confirmedAt: string,
): DirectorSkillRegistryConfirmation {
  return {
    confirmationId: `confirm_promote_${targetVersion}`,
    confirmedBy: "user",
    confirmedAt,
    operation: "promote",
    skillId: candidate.id,
    targetVersion,
    targetMaturity: maturity,
  };
}

const candidateAccepted = [caseFor(candidate, "project-a", 1), caseFor(candidate, "project-b", 2)];
const verified = promoteDirectorSkillToGlobal({
  registry: createDirectorSkillRegistry("p10-s-eval-registry", "2026-07-16T07:00:00.000Z"),
  definition: candidate,
  recipes: [candidateRecipe],
  cases: candidateAccepted,
  requestedMaturity: "verified",
  confirmation: promotionConfirmation("verified", "1.1.0", "2026-07-16T07:10:00.000Z"),
  promotedAt: "2026-07-16T07:10:00.000Z",
});
assert(verified.ok, "verified fixture promotion must apply");
const verifiedVersion = verified.registry.entries[0]!.versions[0]!;
const verifiedAccepted = [caseFor(verifiedVersion.definition, "project-c", 3), caseFor(verifiedVersion.definition, "project-d", 4)];
const trusted = promoteDirectorSkillToGlobal({
  registry: verified.registry,
  definition: verifiedVersion.definition,
  recipes: verifiedVersion.recipes,
  cases: verifiedAccepted,
  requestedMaturity: "trusted",
  confirmation: promotionConfirmation("trusted", "1.2.0", "2026-07-16T07:20:00.000Z"),
  promotedAt: "2026-07-16T07:20:00.000Z",
});
assert(trusted.ok, "trusted fixture promotion must apply");
const trustedVersion = trusted.registry.entries[0]!.versions.find((version) => version.version === "1.2.0")!;
const trustedAccepted = [caseFor(trustedVersion.definition, "project-e", 5), caseFor(trustedVersion.definition, "project-f", 6)];
const rolledBack = rollbackDirectorSkillVersion({
  registry: trusted.registry,
  skillId: candidate.id,
  targetVersion: "1.1.0",
  confirmation: {
    confirmationId: "confirm_eval_rollback",
    confirmedBy: "user",
    confirmedAt: "2026-07-16T07:30:00.000Z",
    operation: "rollback",
    skillId: candidate.id,
    targetVersion: "1.1.0",
  },
  createdAt: "2026-07-16T07:30:00.000Z",
});
assert(rolledBack.ok, "rollback fixture must apply");

const governanceCases = [
  ...candidateAccepted,
  ...verifiedAccepted,
  ...trustedAccepted,
  caseFor(candidate, "project-g", 7, "modified"),
  caseFor(candidate, "project-h", 8, "rejected"),
  caseFor(candidate, "project-i", 9, "retry_requested"),
  caseFor(candidate, "project-j", 10, "failed"),
];
const report = evaluateDirectorSkillSystem({
  fixtures,
  cases: governanceCases,
  registry: rolledBack.registry,
  generatedAt: "2026-07-16T08:00:00.000Z",
});

assert(report.overallStatus === "pass", `evaluation fixtures should pass: ${report.fixtureResults.flatMap((item) => item.failures).join("; ")}`);
assert(report.metrics.routeHitRate === 1, "positive/ambiguous/conflict fixtures should all hit an allowed Skill");
assert(report.metrics.falseTriggerRate === 0, "negative fixtures must not route");
assert(report.metrics.humanAccepted === 6 && report.metrics.humanModified === 1 && report.metrics.humanRejected === 1, "human decision metrics drifted");
assert(report.metrics.retryRequested === 1 && report.metrics.failed === 1, "retry/failed metrics drifted");
assert(report.metrics.rollbackRate > 0, "applied rollback must be visible in governance metrics");
assert(report.governance.excludedCaseIds.length === 4, "modified/rejected/retry/failed Cases must be excluded from promotion evidence");
assert(report.v1V2Comparisons.find((item) => item.fixtureId === "positive-narrative")?.promptChanged === true, "v1/v2 prompt results must be compared");
assert(report.v1V2Comparisons.find((item) => item.fixtureId === "positive-narrative")?.routingAligned === true, "v1/v2 route comparison must preserve strategy");
const trustedSummary = report.trustedEvidence.find((item) => item.version === "1.2.0");
assert(trustedSummary?.acceptedProjectCount === 2, "trusted evidence summary must count cross-project reuse");
assert(trustedSummary?.unprovenScope.includes("live_provider_execution"), "dry-run evidence must not claim live provider proof");
assert(report.fixtureResults.find((item) => item.fixtureId === "version-conflict")?.exclusionReasons.includes("version_conflict"), "version conflict must be evaluated");

const evidenceRoot = await mkdtemp("/tmp/vibe-director-p10-s-evaluation-");
const reportPath = `${evidenceRoot}/director-skill-evaluation.json`;
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`director-skill-evaluation-test: fixtures=${report.fixtureResults.length} hitRate=${report.metrics.routeHitRate} falseTrigger=${report.metrics.falseTriggerRate} report=${reportPath}`);
