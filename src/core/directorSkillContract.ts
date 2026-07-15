import type { ProviderSlot } from "./types";
import type { DirectorProductionStrategyId } from "./directorProductionSkill";
import { stableKnowledgeHash } from "./knowledgeManifest";

export const DIRECTOR_SKILL_DEFINITION_SCHEMA_VERSION = "director_skill_definition/2.0.0";
export const DIRECTOR_SKILL_RECIPE_SCHEMA_VERSION = "director_skill_recipe/1.0.0";

export type DirectorSkillScope = "system_builtin" | "project_local" | "user_global" | "external_imported";
export type DirectorSkillMaturity = "candidate" | "verified" | "trusted" | "deprecated";
export type DirectorSkillTaskPurpose = "story_planning" | "reference_planning" | "prompt_compiler" | "qa";
export type DirectorSkillQaSeverity = "blocker" | "warning";

export const DIRECTOR_SKILL_HARD_LOCKS = [
  "provider_policy",
  "preflight_gate",
  "review_gate",
  "delivery_gate",
  "confirmation_boundary",
  "electron_security_boundary",
] as const;

export type DirectorSkillHardLock = (typeof DIRECTOR_SKILL_HARD_LOCKS)[number];

export interface DirectorSkillDependency {
  kind: "skill" | "recipe" | "knowledge_pack";
  id: string;
  version?: string;
  contentHash?: string;
  optional: boolean;
  reason?: string;
}

export interface DirectorSkillConflict {
  skillId: string;
  reason: string;
  resolution: "system_wins" | "project_fact_wins" | "higher_trust_wins" | "manual_selection_required";
}

export interface DirectorSkillInputContract {
  name: string;
  type: "project_fact" | "shot_fact" | "asset_fact" | "user_preference" | "provider_capability";
  required: boolean;
  description: string;
}

export interface DirectorSkillOutputContract {
  name: string;
  type: "planner_guidance" | "prompt_fragment" | "qa_expectation" | "recipe_selection";
  description: string;
}

export interface DirectorSkillQaCheck {
  id: string;
  severity: DirectorSkillQaSeverity;
  description: string;
  expectedEvidence: string[];
}

export interface DirectorSkillDefinition {
  schemaVersion: typeof DIRECTOR_SKILL_DEFINITION_SCHEMA_VERSION;
  id: string;
  semanticKey: string;
  name: string;
  summary: string;
  scope: DirectorSkillScope;
  maturity: DirectorSkillMaturity;
  version: string;
  contentHash: string;
  source: "system" | "project_generated" | "user_authored" | "external_import" | "migrated_v1";
  category: string;
  applicability: {
    taskPurposes: DirectorSkillTaskPurpose[];
    strategyIds: DirectorProductionStrategyId[];
    executionModes: string[];
    actionDensities: Array<"low" | "medium" | "high">;
    durationSeconds?: { min?: number; max?: number };
    requiredAssetStates: string[];
    preferenceTags: string[];
  };
  guards: {
    useWhen: string[];
    avoidWhen: string[];
    forbiddenOverrides: DirectorSkillHardLock[];
    requiresExplicitConfirmation: string[];
  };
  inputs: DirectorSkillInputContract[];
  outputs: DirectorSkillOutputContract[];
  dependencies: DirectorSkillDependency[];
  conflicts: DirectorSkillConflict[];
  providerCompatibility: ProviderSlot[];
  recipeIds: string[];
  rules: string[];
  qaChecks: DirectorSkillQaCheck[];
  contextBudget: {
    maxInjectionTokens: number;
    maxRules: number;
    maxCaseSummaries: number;
  };
  migration?: {
    sourceSchemaVersion: string;
    sourceId: string;
    migratedAt: string;
    status: "migrated" | "requires_source_card";
  };
}

export interface DirectorSkillRecipe {
  schemaVersion: typeof DIRECTOR_SKILL_RECIPE_SCHEMA_VERSION;
  id: string;
  skillId: string;
  version: string;
  contentHash: string;
  compilerProfile: DirectorProductionStrategyId;
  providerCompatibility: ProviderSlot[];
  promptFragments: {
    planner: string[];
    image2: string[];
    seedance: string[];
    qa: string[];
  };
  parameterHints: Record<string, string | number | boolean | string[]>;
  guards: {
    forbiddenOverrides: DirectorSkillHardLock[];
    submitAuthorization: "never";
    autoApproval: false;
  };
}

export interface DirectorSkillContractParseResult<T> {
  ok: boolean;
  value?: T;
  errors: string[];
}

export interface LegacyDirectorSkillCardLike {
  schemaVersion: string;
  id: string;
  name: string;
  summary: string;
  category: string;
  useWhen: string[];
  avoidWhen: string[];
  appliesTo: string[];
  rules: string[];
  source: string;
  version: string;
  createdFrom?: {
    strategy?: DirectorProductionStrategyId;
  };
}

export interface DirectorSkillMigrationResult {
  ok: boolean;
  definition?: DirectorSkillDefinition;
  recipe?: DirectorSkillRecipe;
  errors: string[];
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const STRATEGY_IDS = new Set<DirectorProductionStrategyId>([
  "storyboard_narrative",
  "storyboard_rapid_cut",
  "omni_reference",
]);

const SKILL_SCOPES = new Set<DirectorSkillScope>([
  "system_builtin",
  "project_local",
  "user_global",
  "external_imported",
]);

const SKILL_MATURITIES = new Set<DirectorSkillMaturity>([
  "candidate",
  "verified",
  "trusted",
  "deprecated",
]);

const DECLARATIVE_FORBIDDEN_KEYS = new Set([
  "script",
  "shell",
  "command",
  "executable",
  "eval",
  "providerauthorization",
  "providerkey",
  "apikey",
  "autoapprove",
  "bypassconfirmation",
  "bypasspreflight",
  "bypassreview",
  "bypassdelivery",
]);

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function stableSlug(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "") || "director_method";
}

function canonicalValue(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return String(value ?? "");
}

export function canonicalDirectorSkillJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function withoutContentHash<T extends { contentHash?: string }>(value: T): Omit<T, "contentHash"> {
  const { contentHash: _contentHash, ...rest } = value;
  return rest;
}

export function directorSkillContentHash(value: unknown): string {
  return `vdsh_${stableKnowledgeHash(canonicalDirectorSkillJson(value)).replace(/^vck_/, "")}`;
}

export function directorSkillSemanticId(semanticKey: string): string {
  return `director.skill.${stableSlug(semanticKey)}`;
}

export function directorSkillDefinitionFileName(definition: Pick<DirectorSkillDefinition, "id" | "version">): string {
  return `skills/definitions/${stableSlug(definition.id)}@${stableSlug(definition.version)}.json`;
}

export function directorSkillRecipeFileName(recipe: Pick<DirectorSkillRecipe, "id" | "version">): string {
  return `skills/recipes/${stableSlug(recipe.id)}@${stableSlug(recipe.version)}.json`;
}

function declarativeKeyErrors(value: unknown, path = "root"): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => declarativeKeyErrors(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, "");
    const issue = DECLARATIVE_FORBIDDEN_KEYS.has(normalized)
      ? [`${path}.${key} is not allowed in a declarative Skill contract`]
      : [];
    return [...issue, ...declarativeKeyErrors(item, `${path}.${key}`)];
  });
}

function hasEveryHardLock(values: readonly string[]): boolean {
  const available = new Set(values);
  return DIRECTOR_SKILL_HARD_LOCKS.every((lock) => available.has(lock));
}

export function validateDirectorSkillDefinition(value: DirectorSkillDefinition): string[] {
  const errors = declarativeKeyErrors(value);
  if (value.schemaVersion !== DIRECTOR_SKILL_DEFINITION_SCHEMA_VERSION) errors.push("unsupported Skill schemaVersion");
  if (!clean(value.id)) errors.push("Skill id is required");
  if (!clean(value.semanticKey)) errors.push("Skill semanticKey is required");
  if (value.id !== directorSkillSemanticId(value.semanticKey)) errors.push("Skill id does not match semanticKey");
  if (!clean(value.name)) errors.push("Skill name is required");
  if (!clean(value.summary)) errors.push("Skill summary is required");
  if (!SKILL_SCOPES.has(value.scope)) errors.push("Skill scope is invalid");
  if (!SKILL_MATURITIES.has(value.maturity)) errors.push("Skill maturity is invalid");
  if (!/^\d+\.\d+\.\d+$/.test(value.version)) errors.push("Skill version must be semantic version format");
  if (!value.rules.length) errors.push("Skill must contain at least one rule");
  if (!value.applicability.taskPurposes.length) errors.push("Skill must declare at least one task purpose");
  if (!value.recipeIds.length) errors.push("Skill must reference at least one Recipe");
  if (!value.qaChecks.length) errors.push("Skill must declare QA checks");
  if (!hasEveryHardLock(value.guards.forbiddenOverrides)) errors.push("Skill must preserve every system hard lock");
  if (value.contextBudget.maxInjectionTokens < 1 || value.contextBudget.maxRules < 1) errors.push("Skill context budget must be positive");
  const expectedHash = directorSkillContentHash(withoutContentHash(value));
  if (value.contentHash !== expectedHash) errors.push("Skill contentHash mismatch");
  return errors;
}

export function validateDirectorSkillRecipe(value: DirectorSkillRecipe): string[] {
  const errors = declarativeKeyErrors(value);
  if (value.schemaVersion !== DIRECTOR_SKILL_RECIPE_SCHEMA_VERSION) errors.push("unsupported Recipe schemaVersion");
  if (!clean(value.id) || !clean(value.skillId)) errors.push("Recipe id and skillId are required");
  if (!STRATEGY_IDS.has(value.compilerProfile)) errors.push("Recipe compilerProfile is invalid");
  if (value.guards.submitAuthorization !== "never") errors.push("Recipe cannot grant provider submit authorization");
  if (value.guards.autoApproval !== false) errors.push("Recipe cannot auto-approve outputs");
  if (!hasEveryHardLock(value.guards.forbiddenOverrides)) errors.push("Recipe must preserve every system hard lock");
  const expectedHash = directorSkillContentHash(withoutContentHash(value));
  if (value.contentHash !== expectedHash) errors.push("Recipe contentHash mismatch");
  return errors;
}

export function createDirectorSkillDefinition(
  input: Omit<DirectorSkillDefinition, "schemaVersion" | "id" | "contentHash"> & { id?: string },
): DirectorSkillDefinition {
  const {
    contentHash: _ignoredContentHash,
    schemaVersion: _ignoredSchemaVersion,
    ...contractInput
  } = input as typeof input & { contentHash?: string; schemaVersion?: string };
  const definitionWithoutHash: Omit<DirectorSkillDefinition, "contentHash"> = {
    ...contractInput,
    schemaVersion: DIRECTOR_SKILL_DEFINITION_SCHEMA_VERSION,
    id: contractInput.id || directorSkillSemanticId(contractInput.semanticKey),
    applicability: {
      ...contractInput.applicability,
      taskPurposes: Array.from(new Set(contractInput.applicability.taskPurposes)),
      strategyIds: Array.from(new Set(contractInput.applicability.strategyIds)),
      executionModes: unique(contractInput.applicability.executionModes),
      actionDensities: Array.from(new Set(contractInput.applicability.actionDensities)),
      requiredAssetStates: unique(contractInput.applicability.requiredAssetStates),
      preferenceTags: unique(contractInput.applicability.preferenceTags),
    },
    guards: {
      ...contractInput.guards,
      useWhen: unique(contractInput.guards.useWhen),
      avoidWhen: unique(contractInput.guards.avoidWhen),
      forbiddenOverrides: [...DIRECTOR_SKILL_HARD_LOCKS],
      requiresExplicitConfirmation: unique(contractInput.guards.requiresExplicitConfirmation),
    },
    rules: unique(contractInput.rules),
    recipeIds: unique(contractInput.recipeIds),
    providerCompatibility: Array.from(new Set(contractInput.providerCompatibility)),
  };
  return {
    ...definitionWithoutHash,
    contentHash: directorSkillContentHash(definitionWithoutHash),
  };
}

export function createDirectorSkillRecipe(
  input: Omit<DirectorSkillRecipe, "schemaVersion" | "contentHash" | "guards"> & {
    guards?: Partial<DirectorSkillRecipe["guards"]>;
  },
): DirectorSkillRecipe {
  const {
    contentHash: _ignoredContentHash,
    schemaVersion: _ignoredSchemaVersion,
    ...contractInput
  } = input as typeof input & { contentHash?: string; schemaVersion?: string };
  const recipeWithoutHash: Omit<DirectorSkillRecipe, "contentHash"> = {
    ...contractInput,
    schemaVersion: DIRECTOR_SKILL_RECIPE_SCHEMA_VERSION,
    providerCompatibility: Array.from(new Set(contractInput.providerCompatibility)),
    promptFragments: {
      planner: unique(contractInput.promptFragments.planner),
      image2: unique(contractInput.promptFragments.image2),
      seedance: unique(contractInput.promptFragments.seedance),
      qa: unique(contractInput.promptFragments.qa),
    },
    guards: {
      forbiddenOverrides: [...DIRECTOR_SKILL_HARD_LOCKS],
      submitAuthorization: "never",
      autoApproval: false,
    },
  };
  return {
    ...recipeWithoutHash,
    contentHash: directorSkillContentHash(recipeWithoutHash),
  };
}

function taskPurposesFromLegacy(values: string[]): DirectorSkillTaskPurpose[] {
  const result = new Set<DirectorSkillTaskPurpose>();
  for (const value of values) {
    if (value === "故事规划") result.add("story_planning");
    if (value === "参考图") result.add("reference_planning");
    if (value === "Seedance prompt") result.add("prompt_compiler");
    if (value === "QA") result.add("qa");
  }
  return Array.from(result);
}

function strategyFromLegacy(card: LegacyDirectorSkillCardLike): DirectorProductionStrategyId | undefined {
  return card.createdFrom?.strategy && STRATEGY_IDS.has(card.createdFrom.strategy)
    ? card.createdFrom.strategy
    : undefined;
}

export function migrateLegacyDirectorSkillCard(
  card: LegacyDirectorSkillCardLike,
  migratedAt = new Date(0).toISOString(),
): DirectorSkillMigrationResult {
  const errors: string[] = [];
  const strategy = strategyFromLegacy(card);
  const purposes = taskPurposesFromLegacy(card.appliesTo || []);
  if (!clean(card.id)) errors.push("legacy Skill id is missing");
  if (!clean(card.name) || !clean(card.summary)) errors.push("legacy Skill name or summary is missing");
  if (!strategy) errors.push("legacy Skill strategy is missing or unsupported");
  if (!Array.isArray(card.rules) || !unique(card.rules).length) errors.push("legacy Skill rule body is missing");
  if (!purposes.length) errors.push("legacy Skill appliesTo is missing or unsupported");
  if (errors.length || !strategy) return { ok: false, errors };

  const semanticKey = strategy;
  const skillId = directorSkillSemanticId(semanticKey);
  const recipeId = `${skillId}.recipe.default`;
  const providerCompatibility: ProviderSlot[] = strategy === "omni_reference"
    ? ["video.i2v", "video.t2v.experimental"]
    : ["image.edit", "image.reference_asset", "video.i2v"];
  const definition = createDirectorSkillDefinition({
    semanticKey,
    name: clean(card.name),
    summary: clean(card.summary),
    scope: "project_local",
    maturity: "candidate",
    version: "1.0.0",
    source: "migrated_v1",
    category: clean(card.category) || "director_method",
    applicability: {
      taskPurposes: purposes,
      strategyIds: [strategy],
      executionModes: [],
      actionDensities: [],
      requiredAssetStates: [],
      preferenceTags: [],
    },
    guards: {
      useWhen: unique(card.useWhen || []),
      avoidWhen: unique(card.avoidWhen || []),
      forbiddenOverrides: [...DIRECTOR_SKILL_HARD_LOCKS],
      requiresExplicitConfirmation: ["save_skill", "provider_submit", "review_decision", "delivery"],
    },
    inputs: [
      { name: "projectFacts", type: "project_fact", required: true, description: "Current project facts and fact hash." },
      { name: "shotFacts", type: "shot_fact", required: true, description: "Structured current-shot intent and constraints." },
      { name: "providerCapability", type: "provider_capability", required: true, description: "Capability only; never submit authorization." },
    ],
    outputs: [
      { name: "plannerGuidance", type: "planner_guidance", description: "Bounded directing method guidance." },
      { name: "promptFragments", type: "prompt_fragment", description: "Declarative compiler fragments selected through the Router." },
      { name: "qaExpectations", type: "qa_expectation", description: "Hash-bound checks consumed by QA." },
      { name: "recipeSelection", type: "recipe_selection", description: "Compatible Recipe identity and version." },
    ],
    dependencies: [{ kind: "recipe", id: recipeId, version: "1.0.0", optional: false }],
    conflicts: [],
    providerCompatibility,
    recipeIds: [recipeId],
    rules: unique(card.rules),
    qaChecks: [
      { id: "skill_hash_consistency", severity: "blocker", description: "Planner, compiler, and QA must use the same Skill version and content hash.", expectedEvidence: ["skillId", "version", "contentHash"] },
      { id: "hard_boundaries_preserved", severity: "blocker", description: "Skill guidance cannot grant submission, approval, promotion, or delivery authorization.", expectedEvidence: ["confirmationReceipt", "preflight", "reviewGate", "deliveryGate"] },
      { id: "strategy_contract_preserved", severity: "warning", description: "The selected built-in production strategy remains compatible with the Skill.", expectedEvidence: ["strategyId", "compilerProfile"] },
    ],
    contextBudget: {
      maxInjectionTokens: 700,
      maxRules: 8,
      maxCaseSummaries: 2,
    },
    migration: {
      sourceSchemaVersion: card.schemaVersion,
      sourceId: card.id,
      migratedAt,
      status: "migrated",
    },
  });
  const recipe = createDirectorSkillRecipe({
    id: recipeId,
    skillId,
    version: "1.0.0",
    compilerProfile: strategy,
    providerCompatibility,
    promptFragments: {
      planner: unique(card.useWhen || []).slice(0, 4),
      image2: strategy === "omni_reference" ? [] : unique(card.rules).slice(0, 6),
      seedance: unique(card.rules).slice(0, 8),
      qa: [...unique(card.avoidWhen || []).slice(0, 4), ...unique(card.rules).slice(0, 4)],
    },
    parameterHints: {
      strategyId: strategy,
      sourceSchema: card.schemaVersion,
    },
  });

  return { ok: true, definition, recipe, errors: [] };
}

export function parseDirectorSkillDefinition(content: string): DirectorSkillContractParseResult<DirectorSkillDefinition> {
  try {
    const value = JSON.parse(content) as DirectorSkillDefinition;
    const errors = validateDirectorSkillDefinition(value);
    return errors.length ? { ok: false, errors } : { ok: true, value, errors: [] };
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
}

export function parseDirectorSkillRecipe(content: string): DirectorSkillContractParseResult<DirectorSkillRecipe> {
  try {
    const value = JSON.parse(content) as DirectorSkillRecipe;
    const errors = validateDirectorSkillRecipe(value);
    return errors.length ? { ok: false, errors } : { ok: true, value, errors: [] };
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
}

export function serializeDirectorSkillContract(value: DirectorSkillDefinition | DirectorSkillRecipe): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
