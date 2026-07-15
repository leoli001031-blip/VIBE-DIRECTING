import {
  createDirectorSkillDefinition,
  createDirectorSkillRecipe,
  directorSkillContentHash,
  validateDirectorSkillDefinition,
  validateDirectorSkillRecipe,
  type DirectorSkillDefinition,
  type DirectorSkillMaturity,
  type DirectorSkillRecipe,
} from "./directorSkillContract";
import {
  directorSkillCaseSupportsPromotion,
  type DirectorSkillCase,
} from "./directorSkillEvidence";

export const DIRECTOR_SKILL_REGISTRY_SCHEMA_VERSION = "director_skill_registry/1.0.0";
export const DIRECTOR_SKILL_PROMOTION_EVALUATION_SCHEMA_VERSION = "director_skill_promotion_evaluation/1.0.0";
export const DIRECTOR_SKILL_REGISTRY_OPERATION_SCHEMA_VERSION = "director_skill_registry_operation/1.0.0";
export const DIRECTOR_SKILL_GLOBAL_REGISTRY_RELATIVE_PATH = "director-skills/registry.json";

export type DirectorSkillRegistryOperation = "promote" | "install_version" | "pin" | "unpin" | "enable" | "disable" | "deprecate" | "rollback";

export interface DirectorSkillRegistryConfirmation {
  confirmationId: string;
  confirmedBy: "user";
  confirmedAt: string;
  operation: DirectorSkillRegistryOperation;
  skillId: string;
  targetVersion?: string;
  targetMaturity?: DirectorSkillMaturity;
}

export interface DirectorSkillPromotionEvaluation {
  schemaVersion: typeof DIRECTOR_SKILL_PROMOTION_EVALUATION_SCHEMA_VERSION;
  evaluationId: string;
  skillId: string;
  sourceVersion: string;
  sourceContentHash: string;
  requestedMaturity: "verified" | "trusted";
  eligible: boolean;
  acceptedCaseIds: string[];
  acceptedProjectCount: number;
  unresolvedCaseIds: string[];
  rejectedEvidenceIds: string[];
  reasons: string[];
  evaluatedAt: string;
}

export interface DirectorSkillRegistryCaseEvidence {
  caseId: string;
  caseHash: string;
  projectIdHash: string;
  shotIdHash: string;
  qaReportHash?: string;
  acceptedAt: string;
}

export interface DirectorSkillRegistryVersion {
  version: string;
  contentHash: string;
  maturity: DirectorSkillMaturity;
  definition: DirectorSkillDefinition;
  recipes: DirectorSkillRecipe[];
  evidence: DirectorSkillRegistryCaseEvidence[];
  installedAt: string;
  supersedesVersion?: string;
  deprecatedAt?: string;
}

export interface DirectorSkillRegistryEntry {
  skillId: string;
  activeVersion: string;
  pinnedVersion?: string;
  enabled: boolean;
  versions: DirectorSkillRegistryVersion[];
}

export interface DirectorSkillRegistryOperationReceipt {
  schemaVersion: typeof DIRECTOR_SKILL_REGISTRY_OPERATION_SCHEMA_VERSION;
  receiptId: string;
  receiptHash: string;
  operation: DirectorSkillRegistryOperation;
  skillId: string;
  beforeVersion?: string;
  afterVersion?: string;
  applied: boolean;
  confirmationId?: string;
  reasons: string[];
  createdAt: string;
}

export interface DirectorSkillRegistry {
  schemaVersion: typeof DIRECTOR_SKILL_REGISTRY_SCHEMA_VERSION;
  registryId: string;
  registryHash: string;
  scope: "user_global";
  createdAt: string;
  updatedAt: string;
  entries: DirectorSkillRegistryEntry[];
  operationReceipts: DirectorSkillRegistryOperationReceipt[];
}

export interface DirectorSkillRegistryMutationResult {
  ok: boolean;
  status: "applied" | "blocked" | "no_change";
  registry: DirectorSkillRegistry;
  receipt: DirectorSkillRegistryOperationReceipt;
  evaluation?: DirectorSkillPromotionEvaluation;
  errors: string[];
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function dateValid(value: string | undefined): boolean {
  return Number.isFinite(Date.parse(value || ""));
}

function registryHashInput(registry: Omit<DirectorSkillRegistry, "registryHash">): unknown {
  return registry;
}

function withRegistryHash(registry: Omit<DirectorSkillRegistry, "registryHash">): DirectorSkillRegistry {
  const { registryHash: _ignoredRegistryHash, ...registryInput } = registry as typeof registry & { registryHash?: string };
  return { ...registryInput, registryHash: directorSkillContentHash(registryHashInput(registryInput)) };
}

function operationReceipt(input: Omit<DirectorSkillRegistryOperationReceipt, "schemaVersion" | "receiptId" | "receiptHash">): DirectorSkillRegistryOperationReceipt {
  const withoutHash = {
    ...input,
    schemaVersion: DIRECTOR_SKILL_REGISTRY_OPERATION_SCHEMA_VERSION as typeof DIRECTOR_SKILL_REGISTRY_OPERATION_SCHEMA_VERSION,
    receiptId: `dsro_${directorSkillContentHash(input).slice(5)}`,
  };
  return { ...withoutHash, receiptHash: directorSkillContentHash(withoutHash) };
}

function confirmationErrors(
  confirmation: DirectorSkillRegistryConfirmation | undefined,
  input: { operation: DirectorSkillRegistryOperation; skillId: string; targetVersion?: string; targetMaturity?: DirectorSkillMaturity },
): string[] {
  if (!confirmation) return ["explicit user confirmation is required"];
  const errors: string[] = [];
  if (!clean(confirmation.confirmationId)) errors.push("confirmationId is required");
  if (confirmation.confirmedBy !== "user") errors.push("confirmation must come from the user");
  if (!dateValid(confirmation.confirmedAt)) errors.push("confirmation timestamp is invalid");
  if (confirmation.operation !== input.operation) errors.push("confirmation operation mismatch");
  if (confirmation.skillId !== input.skillId) errors.push("confirmation skillId mismatch");
  if (input.targetVersion && confirmation.targetVersion !== input.targetVersion) errors.push("confirmation targetVersion mismatch");
  if (input.targetMaturity && confirmation.targetMaturity !== input.targetMaturity) errors.push("confirmation targetMaturity mismatch");
  return errors;
}

function bumpMinor(version: string): string {
  const [major, minor] = version.split(".").map(Number);
  return `${Number.isFinite(major) ? major : 1}.${Number.isFinite(minor) ? minor + 1 : 1}.0`;
}

function compareVersions(left: string, right: string): number {
  const l = left.split(".").map(Number);
  const r = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const delta = (l[index] || 0) - (r[index] || 0);
    if (delta) return delta;
  }
  return 0;
}

function latestCasePerTarget(cases: DirectorSkillCase[]): DirectorSkillCase[] {
  const latest = new Map<string, DirectorSkillCase>();
  for (const item of [...cases].sort((left, right) => left.createdAt.localeCompare(right.createdAt))) {
    latest.set(`${item.projectId}:${item.shotId}`, item);
  }
  return Array.from(latest.values());
}

function evidenceFromCase(value: DirectorSkillCase): DirectorSkillRegistryCaseEvidence {
  return {
    caseId: value.caseId,
    caseHash: value.caseHash,
    projectIdHash: directorSkillContentHash(value.projectId),
    shotIdHash: directorSkillContentHash(value.shotId),
    qaReportHash: value.qa.reportHash,
    acceptedAt: value.humanDecision?.decidedAt || value.createdAt,
  };
}

export function evaluateDirectorSkillPromotion(input: {
  definition: DirectorSkillDefinition;
  cases: DirectorSkillCase[];
  requestedMaturity: "verified" | "trusted";
  evaluatedAt?: string;
}): DirectorSkillPromotionEvaluation {
  const evaluatedAt = input.evaluatedAt || new Date().toISOString();
  const matchingCases = input.cases.filter((item) => item.skillId === input.definition.id
    && item.skillVersion === input.definition.version
    && item.skillContentHash === input.definition.contentHash);
  const accepted = matchingCases.filter(directorSkillCaseSupportsPromotion);
  const latest = latestCasePerTarget(matchingCases);
  const unresolved = latest.filter((item) => ["rejected", "retry_requested", "failed", "needs_review"].includes(item.outcome));
  const rejectedEvidence = matchingCases.filter((item) => !directorSkillCaseSupportsPromotion(item));
  const acceptedProjectCount = new Set(accepted.map((item) => item.projectId)).size;
  const reasons: string[] = [];
  if (input.definition.scope !== "project_local" && input.definition.scope !== "user_global") reasons.push("source Skill scope cannot be promoted");
  if (input.definition.maturity === "deprecated") reasons.push("deprecated Skill cannot be promoted");
  if (input.requestedMaturity === "verified" && input.definition.maturity !== "candidate") reasons.push("verified promotion requires a candidate source");
  if (input.requestedMaturity === "trusted" && input.definition.maturity !== "verified") reasons.push("trusted promotion requires a verified source");
  if (accepted.length < 2) reasons.push("at least two accepted QA-passed Cases are required");
  if (acceptedProjectCount < 2) reasons.push("accepted Cases must come from at least two projects");
  if (unresolved.length) reasons.push("unresolved rejected, retry, failed, or needs-review Case exists");
  return {
    schemaVersion: DIRECTOR_SKILL_PROMOTION_EVALUATION_SCHEMA_VERSION,
    evaluationId: `dspe_${directorSkillContentHash({ skill: input.definition.contentHash, cases: matchingCases.map((item) => item.caseHash).sort(), requested: input.requestedMaturity }).slice(5)}`,
    skillId: input.definition.id,
    sourceVersion: input.definition.version,
    sourceContentHash: input.definition.contentHash,
    requestedMaturity: input.requestedMaturity,
    eligible: reasons.length === 0,
    acceptedCaseIds: accepted.map((item) => item.caseId).sort(),
    acceptedProjectCount,
    unresolvedCaseIds: unresolved.map((item) => item.caseId).sort(),
    rejectedEvidenceIds: rejectedEvidence.map((item) => item.caseId).sort(),
    reasons,
    evaluatedAt,
  };
}

export function createDirectorSkillRegistry(
  registryId = "vibe-director-user-skill-library",
  generatedAt = new Date().toISOString(),
): DirectorSkillRegistry {
  return withRegistryHash({
    schemaVersion: DIRECTOR_SKILL_REGISTRY_SCHEMA_VERSION,
    registryId,
    scope: "user_global",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    entries: [],
    operationReceipts: [],
  });
}

function buildPromotedContracts(
  definition: DirectorSkillDefinition,
  recipes: DirectorSkillRecipe[],
  targetMaturity: "verified" | "trusted" | "deprecated",
  version: string,
): { definition: DirectorSkillDefinition; recipes: DirectorSkillRecipe[] } {
  const promotedRecipeIds = definition.recipeIds;
  const promotedRecipes = recipes
    .filter((recipe) => promotedRecipeIds.includes(recipe.id) && recipe.skillId === definition.id)
    .map((recipe) => createDirectorSkillRecipe({
      ...recipe,
      version,
    }));
  const promotedDefinition = createDirectorSkillDefinition({
    ...definition,
    scope: "user_global",
    maturity: targetMaturity,
    version,
    source: "user_authored",
    dependencies: definition.dependencies.map((dependency) => dependency.kind === "recipe" && promotedRecipeIds.includes(dependency.id)
      ? { ...dependency, version, contentHash: promotedRecipes.find((recipe) => recipe.id === dependency.id)?.contentHash }
      : dependency),
    migration: definition.migration,
  });
  return { definition: promotedDefinition, recipes: promotedRecipes };
}

function applyRegistryMutation(
  registry: DirectorSkillRegistry,
  input: {
    operation: DirectorSkillRegistryOperation;
    skillId: string;
    beforeVersion?: string;
    afterVersion?: string;
    confirmation?: DirectorSkillRegistryConfirmation;
    errors: string[];
    nextEntries?: DirectorSkillRegistryEntry[];
    createdAt: string;
  },
): DirectorSkillRegistryMutationResult {
  const applied = input.errors.length === 0 && Boolean(input.nextEntries);
  const receipt = operationReceipt({
    operation: input.operation,
    skillId: input.skillId,
    beforeVersion: input.beforeVersion,
    afterVersion: input.afterVersion,
    applied,
    confirmationId: input.confirmation?.confirmationId,
    reasons: applied ? [] : input.errors,
    createdAt: input.createdAt,
  });
  if (!applied) return { ok: false, status: "blocked", registry, receipt, errors: input.errors };
  const next = withRegistryHash({
    ...registry,
    updatedAt: input.createdAt,
    entries: input.nextEntries!,
    operationReceipts: [...registry.operationReceipts, receipt],
  });
  return { ok: true, status: "applied", registry: next, receipt, errors: [] };
}

export function promoteDirectorSkillToGlobal(input: {
  registry: DirectorSkillRegistry;
  definition: DirectorSkillDefinition;
  recipes: DirectorSkillRecipe[];
  cases: DirectorSkillCase[];
  requestedMaturity: "verified" | "trusted";
  confirmation?: DirectorSkillRegistryConfirmation;
  promotedAt?: string;
}): DirectorSkillRegistryMutationResult {
  const promotedAt = input.promotedAt || new Date().toISOString();
  const evaluation = evaluateDirectorSkillPromotion({
    definition: input.definition,
    cases: input.cases,
    requestedMaturity: input.requestedMaturity,
    evaluatedAt: promotedAt,
  });
  const nextVersion = bumpMinor(input.definition.version);
  const errors = [
    ...validateDirectorSkillRegistry(input.registry),
    ...validateDirectorSkillDefinition(input.definition),
    ...input.recipes.flatMap(validateDirectorSkillRecipe),
    ...evaluation.reasons,
    ...confirmationErrors(input.confirmation, {
      operation: "promote",
      skillId: input.definition.id,
      targetVersion: nextVersion,
      targetMaturity: input.requestedMaturity,
    }),
  ];
  const existing = input.registry.entries.find((entry) => entry.skillId === input.definition.id);
  if (existing && existing.versions.some((version) => version.version === nextVersion)) errors.push("target Skill version already exists");
  const promoted = errors.length ? undefined : buildPromotedContracts(input.definition, input.recipes, input.requestedMaturity, nextVersion);
  if (promoted && (!promoted.recipes.length || promoted.definition.recipeIds.some((id) => !promoted.recipes.some((recipe) => recipe.id === id)))) {
    errors.push("promoted Skill is missing a compatible Recipe");
  }
  const nextVersionRecord: DirectorSkillRegistryVersion | undefined = promoted && !errors.length
    ? {
        version: promoted.definition.version,
        contentHash: promoted.definition.contentHash,
        maturity: promoted.definition.maturity,
        definition: promoted.definition,
        recipes: promoted.recipes,
        evidence: input.cases.filter((item) => evaluation.acceptedCaseIds.includes(item.caseId)).map(evidenceFromCase),
        installedAt: promotedAt,
        supersedesVersion: existing?.activeVersion || input.definition.version,
      }
    : undefined;
  const nextEntry: DirectorSkillRegistryEntry | undefined = nextVersionRecord
    ? {
        skillId: input.definition.id,
        activeVersion: nextVersion,
        pinnedVersion: existing?.pinnedVersion,
        enabled: existing?.enabled ?? true,
        versions: [...(existing?.versions || []), nextVersionRecord].sort((left, right) => compareVersions(left.version, right.version)),
      }
    : undefined;
  const mutation = applyRegistryMutation(input.registry, {
    operation: "promote",
    skillId: input.definition.id,
    beforeVersion: existing?.activeVersion || input.definition.version,
    afterVersion: nextVersion,
    confirmation: input.confirmation,
    errors,
    nextEntries: nextEntry
      ? [...input.registry.entries.filter((entry) => entry.skillId !== nextEntry.skillId), nextEntry].sort((left, right) => left.skillId.localeCompare(right.skillId))
      : undefined,
    createdAt: promotedAt,
  });
  return { ...mutation, evaluation };
}

export function installDirectorSkillRegistryVersion(input: {
  registry: DirectorSkillRegistry;
  definition: DirectorSkillDefinition;
  recipes: DirectorSkillRecipe[];
  confirmation?: DirectorSkillRegistryConfirmation;
  installedAt?: string;
}): DirectorSkillRegistryMutationResult {
  const installedAt = input.installedAt || new Date().toISOString();
  const existing = input.registry.entries.find((entry) => entry.skillId === input.definition.id);
  const sameVersion = existing?.versions.find((version) => version.version === input.definition.version);
  const baseErrors = [
    ...validateDirectorSkillRegistry(input.registry),
    ...validateDirectorSkillDefinition(input.definition),
    ...input.recipes.flatMap(validateDirectorSkillRecipe),
    ...confirmationErrors(input.confirmation, {
      operation: "install_version",
      skillId: input.definition.id,
      targetVersion: input.definition.version,
    }),
  ];
  if (input.definition.recipeIds.some((id) => !input.recipes.some((recipe) => recipe.id === id && recipe.skillId === input.definition.id))) {
    baseErrors.push("installed Skill is missing a compatible Recipe");
  }
  if (sameVersion?.contentHash === input.definition.contentHash && !baseErrors.length) {
    const receipt = operationReceipt({
      operation: "install_version",
      skillId: input.definition.id,
      beforeVersion: existing?.activeVersion,
      afterVersion: existing?.activeVersion,
      applied: false,
      confirmationId: input.confirmation?.confirmationId,
      reasons: ["same_version_same_content"],
      createdAt: installedAt,
    });
    return { ok: true, status: "no_change", registry: input.registry, receipt, errors: [] };
  }
  if (sameVersion && sameVersion.contentHash !== input.definition.contentHash) {
    baseErrors.push("same Skill version has different content");
  }
  if (existing && compareVersions(input.definition.version, existing.activeVersion) < 0) {
    baseErrors.push("package downgrade is forbidden; use explicit rollback instead");
  }
  const nextVersion: DirectorSkillRegistryVersion | undefined = baseErrors.length
    ? undefined
    : {
        version: input.definition.version,
        contentHash: input.definition.contentHash,
        maturity: input.definition.maturity,
        definition: input.definition,
        recipes: input.recipes,
        evidence: [],
        installedAt,
        supersedesVersion: existing?.activeVersion,
      };
  const nextEntry: DirectorSkillRegistryEntry | undefined = nextVersion
    ? {
        skillId: input.definition.id,
        activeVersion: input.definition.version,
        pinnedVersion: existing?.pinnedVersion,
        enabled: true,
        versions: [...(existing?.versions || []), nextVersion].sort((left, right) => compareVersions(left.version, right.version)),
      }
    : undefined;
  return applyRegistryMutation(input.registry, {
    operation: "install_version",
    skillId: input.definition.id,
    beforeVersion: existing?.activeVersion,
    afterVersion: input.definition.version,
    confirmation: input.confirmation,
    errors: baseErrors,
    nextEntries: nextEntry
      ? [...input.registry.entries.filter((entry) => entry.skillId !== nextEntry.skillId), nextEntry].sort((left, right) => left.skillId.localeCompare(right.skillId))
      : undefined,
    createdAt: installedAt,
  });
}

function mutateRegistryEntry(input: {
  registry: DirectorSkillRegistry;
  operation: DirectorSkillRegistryOperation;
  skillId: string;
  targetVersion?: string;
  confirmation?: DirectorSkillRegistryConfirmation;
  createdAt?: string;
  mutate: (entry: DirectorSkillRegistryEntry) => DirectorSkillRegistryEntry | undefined;
}): DirectorSkillRegistryMutationResult {
  const createdAt = input.createdAt || new Date().toISOString();
  const entry = input.registry.entries.find((item) => item.skillId === input.skillId);
  const errors = [
    ...validateDirectorSkillRegistry(input.registry),
    ...confirmationErrors(input.confirmation, { operation: input.operation, skillId: input.skillId, targetVersion: input.targetVersion }),
  ];
  if (!entry) errors.push("Skill is not installed in the global registry");
  const nextEntry = entry && !errors.length ? input.mutate(entry) : undefined;
  if (entry && !nextEntry && !errors.length) errors.push("registry operation target is invalid or unchanged");
  return applyRegistryMutation(input.registry, {
    operation: input.operation,
    skillId: input.skillId,
    beforeVersion: entry?.activeVersion,
    afterVersion: nextEntry?.activeVersion,
    confirmation: input.confirmation,
    errors,
    nextEntries: nextEntry
      ? input.registry.entries.map((item) => item.skillId === input.skillId ? nextEntry : item)
      : undefined,
    createdAt,
  });
}

export function pinDirectorSkillVersion(input: {
  registry: DirectorSkillRegistry; skillId: string; version: string; confirmation?: DirectorSkillRegistryConfirmation; createdAt?: string;
}): DirectorSkillRegistryMutationResult {
  return mutateRegistryEntry({ ...input, operation: "pin", targetVersion: input.version, mutate: (entry) => (
    entry.versions.some((item) => item.version === input.version) ? { ...entry, pinnedVersion: input.version } : undefined
  ) });
}

export function unpinDirectorSkillVersion(input: {
  registry: DirectorSkillRegistry; skillId: string; confirmation?: DirectorSkillRegistryConfirmation; createdAt?: string;
}): DirectorSkillRegistryMutationResult {
  return mutateRegistryEntry({ ...input, operation: "unpin", mutate: (entry) => entry.pinnedVersion ? { ...entry, pinnedVersion: undefined } : undefined });
}

export function setDirectorSkillEnabled(input: {
  registry: DirectorSkillRegistry; skillId: string; enabled: boolean; confirmation?: DirectorSkillRegistryConfirmation; createdAt?: string;
}): DirectorSkillRegistryMutationResult {
  const operation = input.enabled ? "enable" : "disable";
  return mutateRegistryEntry({ ...input, operation, mutate: (entry) => entry.enabled === input.enabled ? undefined : { ...entry, enabled: input.enabled } });
}

export function rollbackDirectorSkillVersion(input: {
  registry: DirectorSkillRegistry; skillId: string; targetVersion: string; confirmation?: DirectorSkillRegistryConfirmation; createdAt?: string;
}): DirectorSkillRegistryMutationResult {
  return mutateRegistryEntry({ ...input, operation: "rollback", targetVersion: input.targetVersion, mutate: (entry) => (
    entry.activeVersion !== input.targetVersion && entry.versions.some((item) => item.version === input.targetVersion)
      ? { ...entry, activeVersion: input.targetVersion, pinnedVersion: input.targetVersion }
      : undefined
  ) });
}

export function deprecateDirectorSkill(input: {
  registry: DirectorSkillRegistry; skillId: string; confirmation?: DirectorSkillRegistryConfirmation; createdAt?: string;
}): DirectorSkillRegistryMutationResult {
  const createdAt = input.createdAt || new Date().toISOString();
  const entry = input.registry.entries.find((item) => item.skillId === input.skillId);
  const active = entry?.versions.find((item) => item.version === entry.activeVersion);
  const targetVersion = active ? bumpMinor(active.version) : undefined;
  return mutateRegistryEntry({
    ...input,
    operation: "deprecate",
    targetVersion,
    createdAt,
    mutate: (current) => {
      const currentVersion = current.versions.find((item) => item.version === current.activeVersion);
      if (!currentVersion || !targetVersion || currentVersion.maturity === "deprecated") return undefined;
      const deprecated = buildPromotedContracts(currentVersion.definition, currentVersion.recipes, "deprecated", targetVersion);
      const nextVersion: DirectorSkillRegistryVersion = {
        version: targetVersion,
        contentHash: deprecated.definition.contentHash,
        maturity: "deprecated",
        definition: deprecated.definition,
        recipes: deprecated.recipes,
        evidence: currentVersion.evidence,
        installedAt: createdAt,
        supersedesVersion: current.activeVersion,
        deprecatedAt: createdAt,
      };
      return { ...current, activeVersion: targetVersion, enabled: false, pinnedVersion: undefined, versions: [...current.versions, nextVersion] };
    },
  });
}

export function activeDirectorSkillRegistryContracts(registry: DirectorSkillRegistry): {
  definitions: DirectorSkillDefinition[];
  recipes: DirectorSkillRecipe[];
} {
  const versions = registry.entries
    .filter((entry) => entry.enabled)
    .map((entry) => entry.versions.find((version) => version.version === (entry.pinnedVersion || entry.activeVersion)))
    .filter((version): version is DirectorSkillRegistryVersion => Boolean(version && version.maturity !== "deprecated"));
  return {
    definitions: versions.map((version) => version.definition),
    recipes: versions.flatMap((version) => version.recipes),
  };
}

export function validateDirectorSkillRegistry(registry: DirectorSkillRegistry): string[] {
  const errors: string[] = [];
  if (registry.schemaVersion !== DIRECTOR_SKILL_REGISTRY_SCHEMA_VERSION) errors.push("unsupported registry schemaVersion");
  if (!clean(registry.registryId)) errors.push("registryId is required");
  if (registry.scope !== "user_global") errors.push("registry scope must be user_global");
  if (!dateValid(registry.createdAt) || !dateValid(registry.updatedAt)) errors.push("registry timestamps are invalid");
  const ids = new Set<string>();
  for (const entry of registry.entries || []) {
    if (ids.has(entry.skillId)) errors.push(`duplicate registry skillId ${entry.skillId}`);
    ids.add(entry.skillId);
    if (!entry.versions.some((version) => version.version === entry.activeVersion)) errors.push(`${entry.skillId} activeVersion is missing`);
    if (entry.pinnedVersion && !entry.versions.some((version) => version.version === entry.pinnedVersion)) errors.push(`${entry.skillId} pinnedVersion is missing`);
    const versions = new Set<string>();
    for (const version of entry.versions) {
      if (versions.has(version.version)) errors.push(`${entry.skillId} repeats version ${version.version}`);
      versions.add(version.version);
      errors.push(...validateDirectorSkillDefinition(version.definition).map((error) => `${entry.skillId}@${version.version}: ${error}`));
      errors.push(...version.recipes.flatMap(validateDirectorSkillRecipe).map((error) => `${entry.skillId}@${version.version}: ${error}`));
      if (version.definition.id !== entry.skillId || version.definition.version !== version.version || version.definition.contentHash !== version.contentHash) {
        errors.push(`${entry.skillId}@${version.version} definition identity mismatch`);
      }
    }
  }
  const operations = new Set<DirectorSkillRegistryOperation>(["promote", "install_version", "pin", "unpin", "enable", "disable", "deprecate", "rollback"]);
  for (const receipt of registry.operationReceipts || []) {
    if (receipt.schemaVersion !== DIRECTOR_SKILL_REGISTRY_OPERATION_SCHEMA_VERSION) errors.push(`${receipt.receiptId || "registry receipt"} schemaVersion is unsupported`);
    if (!clean(receipt.receiptId) || !clean(receipt.skillId)) errors.push("registry operation receipt identity is missing");
    if (!operations.has(receipt.operation)) errors.push(`${receipt.receiptId} operation is invalid`);
    if (!dateValid(receipt.createdAt)) errors.push(`${receipt.receiptId} timestamp is invalid`);
    const { receiptHash: _receiptHash, ...receiptWithoutHash } = receipt;
    if (receipt.receiptHash !== directorSkillContentHash(receiptWithoutHash)) errors.push(`${receipt.receiptId} receiptHash mismatch`);
    if (!receipt.applied && receipt.reasons.length === 0) errors.push(`${receipt.receiptId} blocked or no-change operation requires a reason`);
  }
  const expectedHash = directorSkillContentHash({
    schemaVersion: registry.schemaVersion,
    registryId: registry.registryId,
    scope: registry.scope,
    createdAt: registry.createdAt,
    updatedAt: registry.updatedAt,
    entries: registry.entries,
    operationReceipts: registry.operationReceipts,
  });
  if (registry.registryHash !== expectedHash) errors.push("registryHash mismatch");
  return errors;
}

export function parseDirectorSkillRegistry(content: string): { ok: boolean; registry?: DirectorSkillRegistry; errors: string[] } {
  try {
    const registry = JSON.parse(content) as DirectorSkillRegistry;
    const errors = validateDirectorSkillRegistry(registry);
    return errors.length ? { ok: false, registry, errors } : { ok: true, registry, errors: [] };
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
}

export function serializeDirectorSkillRegistry(registry: DirectorSkillRegistry): string {
  return `${JSON.stringify(registry, null, 2)}\n`;
}
