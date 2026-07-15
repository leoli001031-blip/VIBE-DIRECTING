import type { ProviderSlot } from "./types";
import type { DirectorProductionSkillPlan, DirectorProductionStrategyId } from "./directorProductionSkill";
import {
  canonicalDirectorSkillJson,
  directorSkillContentHash,
  validateDirectorSkillDefinition,
  validateDirectorSkillRecipe,
  type DirectorSkillDefinition,
  type DirectorSkillMaturity,
  type DirectorSkillRecipe,
  type DirectorSkillTaskPurpose,
} from "./directorSkillContract";
import type { DirectorSkillKnowledgeBinding } from "./directorSkillEvidence";

export const DIRECTOR_SKILL_ROUTE_SCHEMA_VERSION = "director_skill_route_result/1.0.0";
export const DIRECTOR_SKILL_INJECTION_SCHEMA_VERSION = "director_skill_injection/1.0.0";
export const DIRECTOR_SKILL_QA_BINDING_SCHEMA_VERSION = "director_skill_qa_binding/1.0.0";

export type DirectorSkillRouteRisk = "low" | "medium" | "high";
export type DirectorSkillAssetCompleteness = "missing" | "partial" | "ready";

export interface DirectorSkillProjectConstraint {
  key: string;
  value: string | number | boolean;
  source: "project_fact" | "user_constraint";
  hard: boolean;
}

export interface DirectorSkillRouterInput {
  taskId: string;
  taskPurpose: DirectorSkillTaskPurpose;
  shot: {
    shotId: string;
    strategyId?: DirectorProductionStrategyId;
    executionMode?: string;
    durationSeconds?: number;
    actionDensity: "low" | "medium" | "high";
    assetCompleteness: {
      scene: DirectorSkillAssetCompleteness;
      characters: DirectorSkillAssetCompleteness;
      props: DirectorSkillAssetCompleteness;
      audio: DirectorSkillAssetCompleteness;
    };
  };
  provider?: {
    slot?: ProviderSlot;
    providerId?: string;
    modelId?: string;
    capabilities: string[];
  };
  risk: DirectorSkillRouteRisk;
  userPreferenceTags: string[];
  projectConstraints: DirectorSkillProjectConstraint[];
  availableSkills: DirectorSkillDefinition[];
  availableRecipes: DirectorSkillRecipe[];
  availableKnowledgePacks: DirectorSkillKnowledgeBinding[];
  explicitlySelectedSkillId?: string;
  maxInjectionTokens?: number;
  createdAt?: string;
}

export interface DirectorSkillRouteSelection {
  skillId: string;
  version: string;
  contentHash: string;
  maturity: DirectorSkillMaturity;
  scope: DirectorSkillDefinition["scope"];
  recipeId: string;
  recipeVersion: string;
  recipeContentHash: string;
  score: number;
  reasons: string[];
  counterexampleConditions: string[];
}

export interface DirectorSkillRouteExclusion {
  skillId: string;
  version: string;
  reason:
    | "invalid_contract"
    | "deprecated"
    | "task_purpose_mismatch"
    | "strategy_mismatch"
    | "execution_mode_mismatch"
    | "duration_mismatch"
    | "action_density_mismatch"
    | "provider_incompatible"
    | "dependency_missing"
    | "version_conflict"
    | "conflict_lost"
    | "lower_score";
  detail: string;
}

export interface DirectorSkillRouteConflict {
  skillIds: string[];
  resolution: "system_wins" | "project_fact_wins" | "higher_trust_wins" | "manual_selection_required";
  winnerSkillId?: string;
  reason: string;
}

export interface DirectorSkillRouteResult {
  schemaVersion: typeof DIRECTOR_SKILL_ROUTE_SCHEMA_VERSION;
  routeId: string;
  taskId: string;
  inputHash: string;
  taskPurpose: DirectorSkillTaskPurpose;
  primary?: DirectorSkillRouteSelection;
  auxiliary: DirectorSkillRouteSelection[];
  notSelected: DirectorSkillRouteExclusion[];
  conflicts: DirectorSkillRouteConflict[];
  knowledgePacks: DirectorSkillKnowledgeBinding[];
  precedence: ["system_hard_boundaries", "project_facts", "trusted_user_skill", "candidate_recommendation"];
  contextBudget: {
    maxInjectionTokens: number;
    estimatedSelectedTokens: number;
    truncated: boolean;
  };
  warnings: string[];
  createdAt: string;
}

export interface DirectorSkillCompilerBinding {
  skillId: string;
  version: string;
  contentHash: string;
  recipeId: string;
  recipeVersion: string;
  recipeContentHash: string;
  knowledgePacks: DirectorSkillKnowledgeBinding[];
  injectedRulesHash: string;
}

export interface DirectorSkillInjection {
  schemaVersion: typeof DIRECTOR_SKILL_INJECTION_SCHEMA_VERSION;
  routeId: string;
  routeInputHash: string;
  plannerGuidance: string[];
  image2PromptFragments: string[];
  seedancePromptFragments: string[];
  qaChecks: DirectorSkillDefinition["qaChecks"];
  compilerBinding?: DirectorSkillCompilerBinding;
  injectedSkillIds: string[];
  injectedRuleCount: number;
  usedTokens: number;
  truncated: boolean;
  truncationReasons: string[];
  executionAuthorized: false;
  providerSubmitAuthorized: false;
}

export interface DirectorSkillQaBindingReport {
  schemaVersion: typeof DIRECTOR_SKILL_QA_BINDING_SCHEMA_VERSION;
  reportId: string;
  routeId: string;
  status: "pass" | "blocked";
  expectedSkillHash?: string;
  compiledSkillHash?: string;
  expectedKnowledgePackHashes: string[];
  compiledKnowledgePackHashes: string[];
  findings: string[];
  reportHash: string;
}

const MATURITY_SCORE: Record<DirectorSkillMaturity, number> = {
  trusted: 45,
  verified: 35,
  candidate: 12,
  deprecated: -1000,
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function estimateTokens(values: string[]): number {
  return Math.max(0, Math.ceil(values.join("\n").length / 4));
}

function versionMatches(actual: string, expected?: string): boolean {
  return !expected || actual === expected;
}

function selectionFor(
  skill: DirectorSkillDefinition,
  recipe: DirectorSkillRecipe,
  score: number,
  reasons: string[],
): DirectorSkillRouteSelection {
  return {
    skillId: skill.id,
    version: skill.version,
    contentHash: skill.contentHash,
    maturity: skill.maturity,
    scope: skill.scope,
    recipeId: recipe.id,
    recipeVersion: recipe.version,
    recipeContentHash: recipe.contentHash,
    score,
    reasons: unique(reasons),
    counterexampleConditions: unique(skill.guards.avoidWhen),
  };
}

function recipeForSkill(skill: DirectorSkillDefinition, recipes: DirectorSkillRecipe[]): DirectorSkillRecipe | undefined {
  return skill.recipeIds
    .map((recipeId) => recipes.find((recipe) => recipe.id === recipeId && recipe.skillId === skill.id))
    .find((recipe): recipe is DirectorSkillRecipe => Boolean(recipe && !validateDirectorSkillRecipe(recipe).length));
}

function missingDependency(
  skill: DirectorSkillDefinition,
  input: DirectorSkillRouterInput,
): string | undefined {
  for (const dependency of skill.dependencies.filter((item) => !item.optional)) {
    if (dependency.kind === "recipe") {
      const found = input.availableRecipes.some((recipe) => recipe.id === dependency.id
        && versionMatches(recipe.version, dependency.version)
        && (!dependency.contentHash || recipe.contentHash === dependency.contentHash));
      if (!found) return `recipe:${dependency.id}`;
    }
    if (dependency.kind === "knowledge_pack") {
      const found = input.availableKnowledgePacks.some((pack) => pack.packId === dependency.id
        && versionMatches(pack.version, dependency.version)
        && (!dependency.contentHash || pack.hash === dependency.contentHash));
      if (!found) return `knowledge_pack:${dependency.id}`;
    }
    if (dependency.kind === "skill") {
      const found = input.availableSkills.some((candidate) => candidate.id === dependency.id
        && versionMatches(candidate.version, dependency.version)
        && (!dependency.contentHash || candidate.contentHash === dependency.contentHash));
      if (!found) return `skill:${dependency.id}`;
    }
  }
  return undefined;
}

function scoreSkill(
  skill: DirectorSkillDefinition,
  input: DirectorSkillRouterInput,
): { score: number; reasons: string[]; exclusion?: DirectorSkillRouteExclusion } {
  const exclude = (reason: DirectorSkillRouteExclusion["reason"], detail: string) => ({
    score: -1,
    reasons: [],
    exclusion: { skillId: skill.id, version: skill.version, reason, detail },
  });
  const contractErrors = validateDirectorSkillDefinition(skill);
  if (contractErrors.length) return exclude("invalid_contract", contractErrors.join("; "));
  if (skill.maturity === "deprecated") return exclude("deprecated", "deprecated Skills are never routed");
  if (!skill.applicability.taskPurposes.includes(input.taskPurpose)) return exclude("task_purpose_mismatch", input.taskPurpose);
  if (skill.applicability.strategyIds.length
    && (!input.shot.strategyId || !skill.applicability.strategyIds.includes(input.shot.strategyId))) {
    return exclude("strategy_mismatch", input.shot.strategyId || "missing strategyId");
  }
  if (skill.applicability.executionModes.length
    && (!input.shot.executionMode || !skill.applicability.executionModes.includes(input.shot.executionMode))) {
    return exclude("execution_mode_mismatch", input.shot.executionMode || "missing executionMode");
  }
  const duration = input.shot.durationSeconds;
  const range = skill.applicability.durationSeconds;
  if (duration != null && range && ((range.min != null && duration < range.min) || (range.max != null && duration > range.max))) {
    return exclude("duration_mismatch", `${duration}s is outside the declared range`);
  }
  if (skill.applicability.actionDensities.length && !skill.applicability.actionDensities.includes(input.shot.actionDensity)) {
    return exclude("action_density_mismatch", input.shot.actionDensity);
  }
  if (input.provider?.slot && skill.providerCompatibility.length && !skill.providerCompatibility.includes(input.provider.slot)) {
    return exclude("provider_incompatible", input.provider.slot);
  }
  const dependency = missingDependency(skill, input);
  if (dependency) return exclude("dependency_missing", dependency);
  const recipe = recipeForSkill(skill, input.availableRecipes);
  if (!recipe) return exclude("dependency_missing", "compatible Recipe not found");

  let score = MATURITY_SCORE[skill.maturity];
  const reasons = [`maturity:${skill.maturity}`, `task_purpose:${input.taskPurpose}`];
  score += 40;
  if (input.shot.strategyId && skill.applicability.strategyIds.includes(input.shot.strategyId)) {
    score += 55;
    reasons.push(`strategy:${input.shot.strategyId}`);
  }
  if (input.shot.executionMode && skill.applicability.executionModes.includes(input.shot.executionMode)) {
    score += 20;
    reasons.push(`execution_mode:${input.shot.executionMode}`);
  }
  if (skill.applicability.actionDensities.includes(input.shot.actionDensity)) {
    score += 15;
    reasons.push(`action_density:${input.shot.actionDensity}`);
  }
  if (input.provider?.slot && skill.providerCompatibility.includes(input.provider.slot)) {
    score += 20;
    reasons.push(`provider:${input.provider.slot}`);
  }
  const preferenceMatches = skill.applicability.preferenceTags.filter((tag) => input.userPreferenceTags.includes(tag));
  if (preferenceMatches.length) {
    score += Math.min(20, preferenceMatches.length * 8);
    reasons.push(...preferenceMatches.map((tag) => `preference:${tag}`));
  }
  if (input.explicitlySelectedSkillId === skill.id) {
    score += 30;
    reasons.push("explicit_selection_for_routing_only");
  }
  if (input.risk === "high" && skill.maturity === "candidate") {
    score -= 20;
    reasons.push("candidate_high_risk_penalty");
  }
  return { score, reasons };
}

function routeInputHash(input: DirectorSkillRouterInput): string {
  return directorSkillContentHash({
    taskId: input.taskId,
    taskPurpose: input.taskPurpose,
    shot: input.shot,
    provider: input.provider,
    risk: input.risk,
    userPreferenceTags: [...input.userPreferenceTags].sort(),
    projectConstraints: [...input.projectConstraints].sort((left, right) => left.key.localeCompare(right.key)),
    availableSkills: input.availableSkills.map((skill) => `${skill.id}@${skill.version}:${skill.contentHash}`).sort(),
    availableRecipes: input.availableRecipes.map((recipe) => `${recipe.id}@${recipe.version}:${recipe.contentHash}`).sort(),
    availableKnowledgePacks: input.availableKnowledgePacks.map((pack) => `${pack.packId}@${pack.version}:${pack.hash}`).sort(),
    explicitlySelectedSkillId: input.explicitlySelectedSkillId,
    maxInjectionTokens: input.maxInjectionTokens,
  });
}

function trustRank(selection: DirectorSkillRouteSelection): number {
  if (selection.scope === "system_builtin") return 4;
  if (selection.maturity === "trusted") return 3;
  if (selection.maturity === "verified") return 2;
  return 1;
}

function compareSemanticVersion(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const delta = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (delta) return delta;
  }
  return 0;
}

export function routeDirectorSkills(input: DirectorSkillRouterInput): DirectorSkillRouteResult {
  const inputHash = routeInputHash(input);
  const notSelected: DirectorSkillRouteExclusion[] = [];
  const candidates: DirectorSkillRouteSelection[] = [];
  for (const skill of input.availableSkills) {
    const scored = scoreSkill(skill, input);
    if (scored.exclusion) {
      notSelected.push(scored.exclusion);
      continue;
    }
    const recipe = recipeForSkill(skill, input.availableRecipes);
    if (!recipe) continue;
    candidates.push(selectionFor(skill, recipe, scored.score, scored.reasons));
  }
  candidates.sort((left, right) => right.score - left.score
    || trustRank(right) - trustRank(left)
    || left.skillId.localeCompare(right.skillId)
    || compareSemanticVersion(right.version, left.version));

  const versionResolvedCandidates = candidates.filter((candidate, index, all) => {
    const sameSkill = all.filter((item) => item.skillId === candidate.skillId);
    if (sameSkill.length < 2) return true;
    const winner = [...sameSkill].sort((left, right) => (
      trustRank(right) - trustRank(left)
      || compareSemanticVersion(right.version, left.version)
      || right.score - left.score
    ))[0];
    if (winner === candidate) return true;
    notSelected.push({
      skillId: candidate.skillId,
      version: candidate.version,
      reason: "version_conflict",
      detail: `selected ${winner.version}`,
    });
    return false;
  });

  const conflicts: DirectorSkillRouteConflict[] = [];
  const selected: DirectorSkillRouteSelection[] = [];
  for (const candidate of versionResolvedCandidates) {
    const candidateSkill = input.availableSkills.find((skill) => skill.id === candidate.skillId)!;
    const conflict = selected.find((current) => {
      const currentSkill = input.availableSkills.find((skill) => skill.id === current.skillId);
      return candidateSkill.conflicts.some((item) => item.skillId === current.skillId)
        || Boolean(currentSkill?.conflicts.some((item) => item.skillId === candidate.skillId));
    });
    if (!conflict) {
      selected.push(candidate);
      continue;
    }
    const currentSkill = input.availableSkills.find((skill) => skill.id === conflict.skillId);
    const conflictContract = candidateSkill.conflicts.find((item) => item.skillId === conflict.skillId)
      || currentSkill?.conflicts.find((item) => item.skillId === candidate.skillId)!;
    const candidateWins = trustRank(candidate) > trustRank(conflict);
    const winnerSkillId = conflictContract.resolution === "manual_selection_required"
      ? undefined
      : candidateWins ? candidate.skillId : conflict.skillId;
    conflicts.push({
      skillIds: [candidate.skillId, conflict.skillId].sort(),
      resolution: conflictContract.resolution,
      winnerSkillId,
      reason: conflictContract.reason,
    });
    notSelected.push({
      skillId: candidate.skillId,
      version: candidate.version,
      reason: "conflict_lost",
      detail: winnerSkillId ? `winner:${winnerSkillId}` : "manual selection required",
    });
  }

  const primary = selected[0];
  const auxiliary = selected.slice(1, 3);
  for (const candidate of versionResolvedCandidates) {
    if (candidate.skillId !== primary?.skillId && !auxiliary.some((item) => item.skillId === candidate.skillId)
      && !notSelected.some((item) => item.skillId === candidate.skillId)) {
      notSelected.push({ skillId: candidate.skillId, version: candidate.version, reason: "lower_score", detail: `score:${candidate.score}` });
    }
  }
  const selectedSkills = [primary, ...auxiliary].filter((item): item is DirectorSkillRouteSelection => Boolean(item));
  const selectedDefinitions = selectedSkills
    .map((selection) => input.availableSkills.find((skill) => skill.id === selection.skillId))
    .filter((skill): skill is DirectorSkillDefinition => Boolean(skill));
  const estimatedSelectedTokens = estimateTokens(selectedDefinitions.flatMap((skill) => skill.rules));
  const maxInjectionTokens = Math.max(1, Math.floor(input.maxInjectionTokens || 900));
  return {
    schemaVersion: DIRECTOR_SKILL_ROUTE_SCHEMA_VERSION,
    routeId: `dsr_${inputHash.slice(5)}`,
    taskId: input.taskId,
    inputHash,
    taskPurpose: input.taskPurpose,
    primary,
    auxiliary,
    notSelected: notSelected.sort((left, right) => left.skillId.localeCompare(right.skillId)),
    conflicts,
    knowledgePacks: [...input.availableKnowledgePacks].sort((left, right) => left.packId.localeCompare(right.packId)),
    precedence: ["system_hard_boundaries", "project_facts", "trusted_user_skill", "candidate_recommendation"],
    contextBudget: {
      maxInjectionTokens,
      estimatedSelectedTokens,
      truncated: estimatedSelectedTokens > maxInjectionTokens,
    },
    warnings: primary ? [] : ["no_director_skill_matched"],
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

function fragmentList(recipe: DirectorSkillRecipe, consumer: "planner" | "image2" | "seedance" | "qa"): string[] {
  return recipe.promptFragments[consumer];
}

export function buildDirectorSkillInjection(
  route: DirectorSkillRouteResult,
  input: Pick<DirectorSkillRouterInput, "availableSkills" | "availableRecipes" | "availableKnowledgePacks">,
): DirectorSkillInjection {
  if (!route.primary) {
    return {
      schemaVersion: DIRECTOR_SKILL_INJECTION_SCHEMA_VERSION,
      routeId: route.routeId,
      routeInputHash: route.inputHash,
      plannerGuidance: [],
      image2PromptFragments: [],
      seedancePromptFragments: [],
      qaChecks: [],
      injectedSkillIds: [],
      injectedRuleCount: 0,
      usedTokens: 0,
      truncated: false,
      truncationReasons: [],
      executionAuthorized: false,
      providerSubmitAuthorized: false,
    };
  }
  const skill = input.availableSkills.find((item) => item.id === route.primary?.skillId
    && item.version === route.primary?.version
    && item.contentHash === route.primary?.contentHash);
  const recipe = input.availableRecipes.find((item) => item.id === route.primary?.recipeId
    && item.version === route.primary?.recipeVersion
    && item.contentHash === route.primary?.recipeContentHash);
  if (!skill || !recipe) return buildDirectorSkillInjection({ ...route, primary: undefined, warnings: [...route.warnings, "route_binding_missing"] }, input);

  const maxTokens = Math.min(route.contextBudget.maxInjectionTokens, skill.contextBudget.maxInjectionTokens);
  const rules: string[] = [];
  let usedTokens = 0;
  let truncated = false;
  for (const rule of skill.rules.slice(0, skill.contextBudget.maxRules)) {
    const nextTokens = estimateTokens([rule]);
    if (usedTokens + nextTokens > maxTokens) {
      truncated = true;
      continue;
    }
    rules.push(rule);
    usedTokens += nextTokens;
  }
  if (skill.rules.length > rules.length) truncated = true;
  const plannerGuidance = unique([...fragmentList(recipe, "planner"), ...rules]);
  const image2PromptFragments = unique([...fragmentList(recipe, "image2"), ...rules]);
  const seedancePromptFragments = unique([...fragmentList(recipe, "seedance"), ...rules]);
  const injectedRulesHash = directorSkillContentHash({ rules, skillHash: skill.contentHash, recipeHash: recipe.contentHash });
  return {
    schemaVersion: DIRECTOR_SKILL_INJECTION_SCHEMA_VERSION,
    routeId: route.routeId,
    routeInputHash: route.inputHash,
    plannerGuidance,
    image2PromptFragments,
    seedancePromptFragments,
    qaChecks: skill.qaChecks,
    compilerBinding: {
      skillId: skill.id,
      version: skill.version,
      contentHash: skill.contentHash,
      recipeId: recipe.id,
      recipeVersion: recipe.version,
      recipeContentHash: recipe.contentHash,
      knowledgePacks: [...input.availableKnowledgePacks].sort((left, right) => left.packId.localeCompare(right.packId)),
      injectedRulesHash,
    },
    injectedSkillIds: [skill.id],
    injectedRuleCount: rules.length,
    usedTokens,
    truncated,
    truncationReasons: truncated ? ["skill_context_budget"] : [],
    executionAuthorized: false,
    providerSubmitAuthorized: false,
  };
}

export function formatDirectorSkillPromptBlock(
  injection: DirectorSkillInjection,
  consumer: "image2" | "seedance",
): string {
  if (!injection.compilerBinding) return "";
  const fragments = consumer === "image2" ? injection.image2PromptFragments : injection.seedancePromptFragments;
  if (!fragments.length) return "";
  return [
    `Director Skill binding: ${injection.compilerBinding.skillId}@${injection.compilerBinding.version} (${injection.compilerBinding.contentHash})`,
    ...fragments.map((fragment) => `- ${fragment}`),
    "This binding supplies directing guidance only. It grants no provider submission, approval, promotion, or delivery authorization.",
  ].join("\n");
}

export function applyDirectorSkillPlannerInjection(
  plan: DirectorProductionSkillPlan,
  injection: DirectorSkillInjection,
): DirectorProductionSkillPlan {
  if (!injection.compilerBinding || !injection.plannerGuidance.length) return plan;
  return {
    ...plan,
    reasons: unique([
      ...plan.reasons,
      `project Skill ${injection.compilerBinding.skillId}@${injection.compilerBinding.version} selected by ${injection.routeId}`,
      ...injection.plannerGuidance,
    ]),
    warnings: unique([
      ...plan.warnings,
      ...(injection.truncated ? ["project Skill injection was truncated by context budget"] : []),
    ]),
  };
}

export function validateDirectorSkillQaBinding(
  route: DirectorSkillRouteResult,
  compiledBinding: DirectorSkillCompilerBinding | undefined,
): DirectorSkillQaBindingReport {
  const expectedSkillHash = route.primary?.contentHash;
  const expectedKnowledgePackHashes = route.knowledgePacks.map((pack) => pack.hash).sort();
  const compiledKnowledgePackHashes = compiledBinding?.knowledgePacks.map((pack) => pack.hash).sort() || [];
  const findings: string[] = [];
  if (route.primary && !compiledBinding) findings.push("skill_compiler_binding_missing");
  if (route.primary && compiledBinding?.skillId !== route.primary.skillId) findings.push("skill_id_mismatch");
  if (route.primary && compiledBinding?.version !== route.primary.version) findings.push("skill_version_mismatch");
  if (expectedSkillHash && compiledBinding?.contentHash !== expectedSkillHash) findings.push("skill_hash_mismatch");
  if (route.primary && compiledBinding?.recipeContentHash !== route.primary.recipeContentHash) findings.push("recipe_hash_mismatch");
  const reportWithoutHash = {
    schemaVersion: DIRECTOR_SKILL_QA_BINDING_SCHEMA_VERSION as typeof DIRECTOR_SKILL_QA_BINDING_SCHEMA_VERSION,
    reportId: `dsqa_${route.inputHash.slice(5)}`,
    routeId: route.routeId,
    status: findings.length ? "blocked" as const : "pass" as const,
    expectedSkillHash,
    compiledSkillHash: compiledBinding?.contentHash,
    expectedKnowledgePackHashes,
    compiledKnowledgePackHashes,
    findings,
  };
  return {
    ...reportWithoutHash,
    reportHash: directorSkillContentHash(reportWithoutHash),
  };
}

export function directorSkillCompilerOutputHash(input: unknown): string {
  return directorSkillContentHash(canonicalDirectorSkillJson(input));
}
