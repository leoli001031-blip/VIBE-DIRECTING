import type { ProviderSlot } from "./types";
import {
  canonicalDirectorSkillJson,
  createDirectorSkillDefinition,
  createDirectorSkillRecipe,
  parseDirectorSkillDefinition,
  parseDirectorSkillRecipe,
  serializeDirectorSkillContract,
  validateDirectorSkillDefinition,
  validateDirectorSkillRecipe,
  type DirectorSkillDefinition,
  type DirectorSkillRecipe,
  type DirectorSkillTaskPurpose,
} from "./directorSkillContract";
import type { DirectorProductionStrategyId } from "./directorProductionSkill";
import type { DirectorSkillCase, DirectorSkillCaseDecision, DirectorSkillKnowledgeBinding } from "./directorSkillEvidence";
import {
  DIRECTOR_SKILL_GLOBAL_REGISTRY_RELATIVE_PATH,
  installDirectorSkillRegistryVersion,
  serializeDirectorSkillRegistry,
  type DirectorSkillRegistry,
  type DirectorSkillRegistryConfirmation,
  type DirectorSkillRegistryMutationResult,
} from "./directorSkillRegistry";
import { routeDirectorSkills } from "./directorSkillRouter";

export const DIRECTOR_SKILL_PACKAGE_MANIFEST_SCHEMA_VERSION = "director_skill_package_manifest/1.0.0";
export const DIRECTOR_SKILL_PORTABLE_CASE_SCHEMA_VERSION = "director_skill_portable_case/1.0.0";
export const DIRECTOR_SKILL_PACKAGE_TEST_SUITE_SCHEMA_VERSION = "director_skill_package_tests/1.0.0";
export const DIRECTOR_SKILL_PACKAGE_IMPORT_RECEIPT_SCHEMA_VERSION = "director_skill_package_import_receipt/1.0.0";

export type DirectorSkillPackageFileRole = "skill" | "recipe" | "readme" | "case" | "tests";

export interface DirectorSkillPackageManifestFile {
  path: string;
  role: DirectorSkillPackageFileRole;
  sha256: string;
  sizeBytes: number;
}

export interface DirectorSkillPackageManifest {
  schemaVersion: typeof DIRECTOR_SKILL_PACKAGE_MANIFEST_SCHEMA_VERSION;
  packageId: string;
  packageVersion: string;
  manifestHash: string;
  skillId: string;
  skillVersion: string;
  skillContentHash: string;
  generatedAt: string;
  files: DirectorSkillPackageManifestFile[];
  dependencies: Array<{ kind: "skill" | "knowledge_pack"; id: string; version?: string; contentHash?: string; optional: boolean }>;
  conflicts: Array<{ skillId: string; reason: string }>;
  hardLocks: {
    containsSecrets: false;
    containsAbsolutePaths: false;
    containsProjectMedia: false;
    grantsProviderAuthorization: false;
  };
}

export interface DirectorSkillPortableCase {
  schemaVersion: typeof DIRECTOR_SKILL_PORTABLE_CASE_SCHEMA_VERSION;
  portableCaseHash: string;
  sourceCaseId: string;
  sourceCaseHash: string;
  projectIdentityHash: string;
  shotIdentityHash: string;
  skillId: string;
  skillVersion: string;
  skillContentHash: string;
  outcome: DirectorSkillCaseDecision;
  inputHash: string;
  outputHash: string;
  provider: { slot?: ProviderSlot; providerId?: string; modelId?: string; executionMode: "dry_run" | "live" };
  qa: { status: DirectorSkillCase["qa"]["status"]; reportHash?: string; findings: string[] };
  humanDecisionEvidence: {
    present: boolean;
    decision?: DirectorSkillCaseDecision;
    confirmationHash?: string;
    decidedAt?: string;
  };
  summary: string;
  createdAt: string;
}

export interface DirectorSkillPackageFixture {
  fixtureId: string;
  kind: "positive" | "negative";
  taskPurpose: DirectorSkillTaskPurpose;
  strategyId?: DirectorProductionStrategyId;
  executionMode?: string;
  durationSeconds?: number;
  actionDensity: "low" | "medium" | "high";
  providerSlot?: ProviderSlot;
  risk: "low" | "medium" | "high";
  expectedMatch: boolean;
}

export interface DirectorSkillPackageTestSuite {
  schemaVersion: typeof DIRECTOR_SKILL_PACKAGE_TEST_SUITE_SCHEMA_VERSION;
  fixtures: DirectorSkillPackageFixture[];
}

export interface DirectorSkillPackageBuildResult {
  ok: boolean;
  manifest?: DirectorSkillPackageManifest;
  files: Map<string, string>;
  errors: string[];
}

export interface DirectorSkillPackageValidationReport {
  ok: boolean;
  status: "verified" | "blocked";
  manifest?: DirectorSkillPackageManifest;
  definition?: DirectorSkillDefinition;
  recipes: DirectorSkillRecipe[];
  cases: DirectorSkillPortableCase[];
  tests?: DirectorSkillPackageTestSuite;
  checks: {
    schema: boolean;
    hashes: boolean;
    paths: boolean;
    secrets: boolean;
    dependencies: boolean;
    conflicts: boolean;
    fixtures: boolean;
  };
  errors: string[];
}

export interface DirectorSkillPackageImportReceipt {
  schemaVersion: typeof DIRECTOR_SKILL_PACKAGE_IMPORT_RECEIPT_SCHEMA_VERSION;
  receiptId: string;
  receiptHash: string;
  packageId?: string;
  skillId?: string;
  sourceVersion?: string;
  sourceContentHash?: string;
  installedVersion?: string;
  installedContentHash?: string;
  status: "imported" | "no_change" | "blocked";
  externalVerificationStatus: "unverified" | "verified" | "failed";
  registryOperationReceiptId?: string;
  atomicPublished: boolean;
  checks: DirectorSkillPackageValidationReport["checks"];
  errors: string[];
  createdAt: string;
}

export interface DirectorSkillPackageFileSystemAdapter {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listFiles(root: string): Promise<string[]>;
  makeDirectory(path: string): Promise<void>;
  removePath(path: string): Promise<void>;
  publishDirectory(stagingPath: string, targetPath: string): Promise<void>;
  atomicReplaceFile(stagingPath: string, targetPath: string): Promise<void>;
}

export interface DirectorSkillPackageImportResult {
  ok: boolean;
  status: "imported" | "no_change" | "blocked";
  registry: DirectorSkillRegistry;
  registryMutation?: DirectorSkillRegistryMutationResult;
  validation: DirectorSkillPackageValidationReport;
  receipt: DirectorSkillPackageImportReceipt;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeName(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5._-]+/g, "-").replace(/^-+|-+$/g, "") || "director-skill";
}

function joinPath(root: string, relative: string): string {
  return `${root.replace(/[\\/]+$/g, "")}/${relative.replace(/^[\\/]+/g, "")}`;
}

function packagePathSafe(value: string): boolean {
  const path = value.replace(/\\/g, "/");
  return Boolean(path)
    && !path.startsWith("/")
    && !/^[a-z]:\//i.test(path)
    && !path.split("/").includes("..")
    && !path.includes("//");
}

function packageRoleMatchesPath(file: DirectorSkillPackageManifestFile): boolean {
  if (file.role === "skill") return file.path === "skill.json";
  if (file.role === "readme") return file.path === "README.md";
  if (file.role === "tests") return file.path === "tests/fixtures.json";
  if (file.role === "recipe") return file.path.startsWith("recipes/") && file.path.endsWith(".json");
  return file.path.startsWith("cases/") && file.path.endsWith(".json");
}

function absolutePathOrSecret(value: string): string[] {
  const errors: string[] = [];
  if (/(?:^|["'\s])(\/Users\/|\/home\/|\/private\/|\/tmp\/|[A-Za-z]:\\)/m.test(value)) errors.push("package contains an absolute local path");
  if (/(?:sk|ak)-[A-Za-z0-9_-]{16,}/.test(value)) errors.push("package contains a credential-like token");
  if (/api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_\-]{8,}/i.test(value)) errors.push("package contains an API-key assignment");
  return errors;
}

function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function directorSkillPackageSha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function contentSize(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

async function portableCase(value: DirectorSkillCase): Promise<DirectorSkillPortableCase> {
  const withoutHash = {
    schemaVersion: DIRECTOR_SKILL_PORTABLE_CASE_SCHEMA_VERSION as typeof DIRECTOR_SKILL_PORTABLE_CASE_SCHEMA_VERSION,
    sourceCaseId: value.caseId,
    sourceCaseHash: value.caseHash,
    projectIdentityHash: await directorSkillPackageSha256(`${value.projectId}:${value.projectFactHash}`),
    shotIdentityHash: await directorSkillPackageSha256(`${value.projectId}:${value.shotId}`),
    skillId: value.skillId,
    skillVersion: value.skillVersion,
    skillContentHash: value.skillContentHash,
    outcome: value.outcome,
    inputHash: value.inputHash,
    outputHash: value.outputHash,
    provider: value.provider,
    qa: { status: value.qa.status, reportHash: value.qa.reportHash, findings: value.qa.findings },
    humanDecisionEvidence: {
      present: Boolean(value.humanDecision),
      decision: value.humanDecision?.decision,
      confirmationHash: value.humanDecision?.confirmationId
        ? await directorSkillPackageSha256(value.humanDecision.confirmationId)
        : undefined,
      decidedAt: value.humanDecision?.decidedAt,
    },
    summary: value.summary,
    createdAt: value.createdAt,
  };
  return { ...withoutHash, portableCaseHash: await directorSkillPackageSha256(canonicalDirectorSkillJson(withoutHash)) };
}

function readmeFor(definition: DirectorSkillDefinition): string {
  return [
    `# ${definition.name}`,
    "",
    definition.summary,
    "",
    `- Skill: ${definition.id}@${definition.version}`,
    `- Maturity: ${definition.maturity}`,
    `- Scope at export: ${definition.scope}`,
    `- Content hash: ${definition.contentHash}`,
    "",
    "## Rules",
    ...definition.rules.map((rule) => `- ${rule}`),
    "",
    "## Safety Boundary",
    "This package contains declarative directing guidance only. It cannot submit provider tasks, approve media, promote project facts, export delivery artifacts, execute scripts, or bypass confirmation and security gates.",
    "",
  ].join("\n");
}

function defaultPackageFixtures(definition: DirectorSkillDefinition): DirectorSkillPackageFixture[] {
  const strategyId = definition.applicability.strategyIds[0];
  const providerSlot = definition.providerCompatibility[0];
  return [
    {
      fixtureId: "package-positive",
      kind: "positive",
      taskPurpose: definition.applicability.taskPurposes[0] || "story_planning",
      strategyId,
      executionMode: definition.applicability.executionModes[0],
      durationSeconds: definition.applicability.durationSeconds?.min || 6,
      actionDensity: definition.applicability.actionDensities[0] || "low",
      providerSlot,
      risk: "low",
      expectedMatch: true,
    },
    {
      fixtureId: "package-negative-provider",
      kind: "negative",
      taskPurpose: definition.applicability.taskPurposes[0] || "story_planning",
      strategyId,
      executionMode: definition.applicability.executionModes[0],
      durationSeconds: definition.applicability.durationSeconds?.min || 6,
      actionDensity: definition.applicability.actionDensities[0] || "low",
      providerSlot: definition.providerCompatibility.includes("audio.tts") ? "video.i2v" : "audio.tts",
      risk: "low",
      expectedMatch: false,
    },
  ];
}

export async function buildDirectorSkillPackage(input: {
  definition: DirectorSkillDefinition;
  recipes: DirectorSkillRecipe[];
  cases?: DirectorSkillCase[];
  tests?: DirectorSkillPackageFixture[];
  generatedAt?: string;
}): Promise<DirectorSkillPackageBuildResult> {
  const errors = [
    ...validateDirectorSkillDefinition(input.definition),
    ...input.recipes.flatMap(validateDirectorSkillRecipe),
  ];
  const recipes = input.recipes.filter((recipe) => input.definition.recipeIds.includes(recipe.id) && recipe.skillId === input.definition.id);
  if (input.definition.recipeIds.some((id) => !recipes.some((recipe) => recipe.id === id))) errors.push("package is missing a required Recipe");
  const sourceCases = (input.cases || []).filter((item) => item.skillId === input.definition.id
    && item.skillVersion === input.definition.version
    && item.skillContentHash === input.definition.contentHash);
  const portableCases = await Promise.all(sourceCases.map(portableCase));
  const tests: DirectorSkillPackageTestSuite = {
    schemaVersion: DIRECTOR_SKILL_PACKAGE_TEST_SUITE_SCHEMA_VERSION,
    fixtures: input.tests || defaultPackageFixtures(input.definition),
  };
  if (!tests.fixtures.some((fixture) => fixture.kind === "positive") || !tests.fixtures.some((fixture) => fixture.kind === "negative")) {
    errors.push("package tests require positive and negative fixtures");
  }
  if (errors.length) return { ok: false, files: new Map(), errors };

  const files = new Map<string, string>();
  files.set("skill.json", serializeDirectorSkillContract(input.definition));
  files.set("README.md", readmeFor(input.definition));
  for (const recipe of recipes) files.set(`recipes/${safeName(recipe.id)}@${safeName(recipe.version)}.json`, serializeDirectorSkillContract(recipe));
  for (const item of portableCases) files.set(`cases/${safeName(item.sourceCaseId)}.json`, jsonText(item));
  files.set("tests/fixtures.json", jsonText(tests));
  for (const [path, content] of files) {
    if (!packagePathSafe(path)) errors.push(`unsafe package path: ${path}`);
    errors.push(...absolutePathOrSecret(content).map((error) => `${path}: ${error}`));
  }
  if (errors.length) return { ok: false, files: new Map(), errors };

  const manifestFiles: DirectorSkillPackageManifestFile[] = [];
  for (const [path, content] of [...files.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const role: DirectorSkillPackageFileRole = path === "skill.json"
      ? "skill"
      : path === "README.md" ? "readme" : path.startsWith("recipes/") ? "recipe" : path.startsWith("cases/") ? "case" : "tests";
    manifestFiles.push({ path, role, sha256: await directorSkillPackageSha256(content), sizeBytes: contentSize(content) });
  }
  const generatedAt = input.generatedAt || new Date().toISOString();
  const manifestWithoutHash = {
    schemaVersion: DIRECTOR_SKILL_PACKAGE_MANIFEST_SCHEMA_VERSION as typeof DIRECTOR_SKILL_PACKAGE_MANIFEST_SCHEMA_VERSION,
    packageId: `director-skill-package:${input.definition.id}@${input.definition.version}`,
    packageVersion: "1.0.0",
    skillId: input.definition.id,
    skillVersion: input.definition.version,
    skillContentHash: input.definition.contentHash,
    generatedAt,
    files: manifestFiles,
    dependencies: input.definition.dependencies
      .filter((dependency) => dependency.kind !== "recipe")
      .map((dependency) => ({ kind: dependency.kind as "skill" | "knowledge_pack", id: dependency.id, version: dependency.version, contentHash: dependency.contentHash, optional: dependency.optional })),
    conflicts: input.definition.conflicts.map((conflict) => ({ skillId: conflict.skillId, reason: conflict.reason })),
    hardLocks: {
      containsSecrets: false as const,
      containsAbsolutePaths: false as const,
      containsProjectMedia: false as const,
      grantsProviderAuthorization: false as const,
    },
  };
  const manifest: DirectorSkillPackageManifest = {
    ...manifestWithoutHash,
    manifestHash: await directorSkillPackageSha256(canonicalDirectorSkillJson(manifestWithoutHash)),
  };
  files.set("manifest.json", jsonText(manifest));
  return { ok: true, manifest, files, errors: [] };
}

function parsePortableCase(content: string): DirectorSkillPortableCase | undefined {
  try {
    const value = JSON.parse(content) as DirectorSkillPortableCase;
    if (value.schemaVersion !== DIRECTOR_SKILL_PORTABLE_CASE_SCHEMA_VERSION
      || !clean(value.portableCaseHash)
      || !clean(value.sourceCaseId)
      || !clean(value.skillId)
      || !clean(value.projectIdentityHash)
      || !clean(value.shotIdentityHash)) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

function parseTestSuite(content: string): DirectorSkillPackageTestSuite | undefined {
  try {
    const value = JSON.parse(content) as DirectorSkillPackageTestSuite;
    if (value.schemaVersion !== DIRECTOR_SKILL_PACKAGE_TEST_SUITE_SCHEMA_VERSION || !Array.isArray(value.fixtures)) return undefined;
    if (value.fixtures.some((fixture) => !clean(fixture.fixtureId) || !["positive", "negative"].includes(fixture.kind) || typeof fixture.expectedMatch !== "boolean")) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

function fixtureErrors(
  suite: DirectorSkillPackageTestSuite,
  definition: DirectorSkillDefinition,
  recipes: DirectorSkillRecipe[],
  knowledgePacks: DirectorSkillKnowledgeBinding[],
): string[] {
  return suite.fixtures.flatMap((fixture) => {
    const route = routeDirectorSkills({
      taskId: `package_fixture:${fixture.fixtureId}`,
      taskPurpose: fixture.taskPurpose,
      shot: {
        shotId: fixture.fixtureId,
        strategyId: fixture.strategyId,
        executionMode: fixture.executionMode,
        durationSeconds: fixture.durationSeconds,
        actionDensity: fixture.actionDensity,
        assetCompleteness: { scene: "ready", characters: "ready", props: "ready", audio: "ready" },
      },
      provider: fixture.providerSlot ? { slot: fixture.providerSlot, capabilities: [] } : undefined,
      risk: fixture.risk,
      userPreferenceTags: [],
      projectConstraints: [],
      availableSkills: [definition],
      availableRecipes: recipes,
      availableKnowledgePacks: knowledgePacks,
      createdAt: "1970-01-01T00:00:00.000Z",
    });
    const matched = route.primary?.skillId === definition.id;
    return matched === fixture.expectedMatch ? [] : [`fixture ${fixture.fixtureId} expectedMatch=${fixture.expectedMatch} actual=${matched}`];
  });
}

function manifestWithoutHash(manifest: DirectorSkillPackageManifest): Omit<DirectorSkillPackageManifest, "manifestHash"> {
  const { manifestHash: _manifestHash, ...rest } = manifest;
  return rest;
}

function portableCaseWithoutHash(value: DirectorSkillPortableCase): Omit<DirectorSkillPortableCase, "portableCaseHash"> {
  const { portableCaseHash: _portableCaseHash, ...rest } = value;
  return rest;
}

export async function validateDirectorSkillPackageFromFileSystem(input: {
  adapter: DirectorSkillPackageFileSystemAdapter;
  packageRoot: string;
  registry: DirectorSkillRegistry;
  availableKnowledgePacks?: DirectorSkillKnowledgeBinding[];
}): Promise<DirectorSkillPackageValidationReport> {
  const checks = { schema: false, hashes: false, paths: false, secrets: false, dependencies: false, conflicts: false, fixtures: false };
  const errors: string[] = [];
  let manifest: DirectorSkillPackageManifest | undefined;
  let manifestContent = "";
  try {
    manifestContent = await input.adapter.readFile(joinPath(input.packageRoot, "manifest.json"));
    manifest = JSON.parse(manifestContent) as DirectorSkillPackageManifest;
  } catch (error) {
    return { ok: false, status: "blocked", recipes: [], cases: [], checks, errors: [error instanceof Error ? error.message : String(error)] };
  }
  if (manifest.schemaVersion !== DIRECTOR_SKILL_PACKAGE_MANIFEST_SCHEMA_VERSION) errors.push("unsupported package manifest schemaVersion");
  if (!clean(manifest.packageId) || !clean(manifest.skillId) || !Array.isArray(manifest.files)) errors.push("package manifest identity or files are invalid");
  errors.push(...absolutePathOrSecret(manifestContent).map((error) => `manifest.json: ${error}`));
  if (manifest.hardLocks?.containsSecrets !== false
    || manifest.hardLocks?.containsAbsolutePaths !== false
    || manifest.hardLocks?.containsProjectMedia !== false
    || manifest.hardLocks?.grantsProviderAuthorization !== false) errors.push("package manifest hard locks are invalid");
  checks.schema = errors.length === 0;
  const expectedManifestHash = await directorSkillPackageSha256(canonicalDirectorSkillJson(manifestWithoutHash(manifest)));
  if (manifest.manifestHash !== expectedManifestHash) errors.push("manifestHash mismatch");

  const manifestPaths = manifest.files.map((file) => file.path);
  if (new Set(manifestPaths).size !== manifestPaths.length) errors.push("package manifest contains duplicate file paths");
  if (manifest.files.filter((file) => file.role === "skill").length !== 1
    || manifest.files.filter((file) => file.role === "readme").length !== 1
    || manifest.files.filter((file) => file.role === "tests").length !== 1) errors.push("package manifest requires one Skill, README, and test suite");
  const listedPaths = new Set(["manifest.json", ...manifest.files.map((file) => file.path)]);
  const actualPaths = (await input.adapter.listFiles(input.packageRoot)).map((path) => path.replace(/\\/g, "/")).sort();
  for (const file of manifest.files) {
    if (!packagePathSafe(file.path)) errors.push(`unsafe package file path: ${file.path}`);
    if (!packageRoleMatchesPath(file)) errors.push(`package role does not match path: ${file.path}`);
  }
  if (actualPaths.some((path) => !listedPaths.has(path)) || [...listedPaths].some((path) => !actualPaths.includes(path))) {
    errors.push("package file list does not match manifest");
  }
  checks.paths = !errors.some((error) => /path|file list/.test(error));

  const contents = new Map<string, string>();
  for (const file of manifest.files) {
    try {
      const content = await input.adapter.readFile(joinPath(input.packageRoot, file.path));
      contents.set(file.path, content);
      if (await directorSkillPackageSha256(content) !== file.sha256 || contentSize(content) !== file.sizeBytes) errors.push(`${file.path} hash or size mismatch`);
      errors.push(...absolutePathOrSecret(content).map((error) => `${file.path}: ${error}`));
    } catch (error) {
      errors.push(`${file.path} cannot be read: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  checks.hashes = manifest.manifestHash === expectedManifestHash && !errors.some((error) => /hash or size|hash mismatch|cannot be read/.test(error));
  checks.secrets = !errors.some((error) => /absolute local path|credential-like|API-key|hard locks/.test(error));

  const definitionResult = parseDirectorSkillDefinition(contents.get("skill.json") || "");
  const definition = definitionResult.value;
  if (!definitionResult.ok || !definition) errors.push(...definitionResult.errors.map((error) => `skill.json: ${error}`));
  if (definition && (definition.id !== manifest.skillId || definition.version !== manifest.skillVersion || definition.contentHash !== manifest.skillContentHash)) {
    errors.push("manifest Skill identity does not match skill.json");
  }
  const recipes = manifest.files.filter((file) => file.role === "recipe").flatMap((file) => {
    const parsed = parseDirectorSkillRecipe(contents.get(file.path) || "");
    if (!parsed.ok || !parsed.value) {
      errors.push(...parsed.errors.map((error) => `${file.path}: ${error}`));
      return [];
    }
    return [parsed.value];
  });
  const cases = manifest.files.filter((file) => file.role === "case").flatMap((file) => {
    const parsed = parsePortableCase(contents.get(file.path) || "");
    if (!parsed) {
      errors.push(`${file.path}: invalid portable Case`);
      return [];
    }
    return [parsed];
  });
  for (const item of cases) {
    const expectedCaseHash = await directorSkillPackageSha256(canonicalDirectorSkillJson(portableCaseWithoutHash(item)));
    if (item.portableCaseHash !== expectedCaseHash) errors.push(`portable Case ${item.sourceCaseId} hash mismatch`);
    if (definition && (item.skillId !== definition.id
      || item.skillVersion !== definition.version
      || item.skillContentHash !== definition.contentHash)) errors.push(`portable Case ${item.sourceCaseId} Skill identity mismatch`);
  }
  const testsPath = manifest.files.find((file) => file.role === "tests")?.path;
  const tests = testsPath ? parseTestSuite(contents.get(testsPath) || "") : undefined;
  if (!tests) errors.push("package test suite is missing or invalid");
  checks.schema = checks.schema && Boolean(definition) && recipes.length === manifest.files.filter((file) => file.role === "recipe").length && Boolean(tests);

  if (definition) {
    for (const dependency of definition.dependencies.filter((item) => !item.optional)) {
      if (dependency.kind === "recipe" && !recipes.some((recipe) => recipe.id === dependency.id
        && (!dependency.version || recipe.version === dependency.version)
        && (!dependency.contentHash || recipe.contentHash === dependency.contentHash))) errors.push(`missing Recipe dependency ${dependency.id}`);
      if (dependency.kind === "knowledge_pack" && !(input.availableKnowledgePacks || []).some((pack) => pack.packId === dependency.id
        && (!dependency.version || pack.version === dependency.version)
        && (!dependency.contentHash || pack.hash === dependency.contentHash))) errors.push(`missing Knowledge Pack dependency ${dependency.id}`);
      if (dependency.kind === "skill" && !input.registry.entries.some((entry) => entry.skillId === dependency.id
        && entry.versions.some((version) => (!dependency.version || version.version === dependency.version)
          && (!dependency.contentHash || version.contentHash === dependency.contentHash)))) errors.push(`missing Skill dependency ${dependency.id}`);
    }
    checks.dependencies = !errors.some((error) => /missing .* dependency/.test(error));
    const activeDefinitions = input.registry.entries.filter((entry) => entry.enabled).flatMap((entry) => entry.versions.filter((version) => version.version === (entry.pinnedVersion || entry.activeVersion)).map((version) => version.definition));
    const conflicting = activeDefinitions.find((active) => definition.conflicts.some((conflict) => conflict.skillId === active.id)
      || active.conflicts.some((conflict) => conflict.skillId === definition.id));
    if (conflicting) errors.push(`unresolved Skill conflict with ${conflicting.id}`);
    checks.conflicts = !conflicting;
    if (tests) {
      const testErrors = fixtureErrors(tests, definition, recipes, input.availableKnowledgePacks || []);
      errors.push(...testErrors);
      checks.fixtures = testErrors.length === 0;
    }
  }
  checks.hashes = checks.hashes && !errors.some((error) => /portable Case .* hash mismatch/.test(error));
  checks.schema = checks.schema && !errors.some((error) => /schema|invalid|identity/.test(error));
  return {
    ok: errors.length === 0,
    status: errors.length ? "blocked" : "verified",
    manifest,
    definition,
    recipes,
    cases,
    tests,
    checks,
    errors,
  };
}

export async function exportDirectorSkillPackageToFileSystem(input: {
  adapter: DirectorSkillPackageFileSystemAdapter;
  targetRoot: string;
  definition: DirectorSkillDefinition;
  recipes: DirectorSkillRecipe[];
  cases?: DirectorSkillCase[];
  tests?: DirectorSkillPackageFixture[];
  generatedAt?: string;
}): Promise<DirectorSkillPackageBuildResult & { targetRoot: string; stagingRoot?: string }> {
  const built = await buildDirectorSkillPackage(input);
  if (!built.ok || !built.manifest) return { ...built, targetRoot: input.targetRoot };
  if (await input.adapter.exists(input.targetRoot)) return { ok: false, files: built.files, errors: ["target package already exists"], targetRoot: input.targetRoot };
  const stagingRoot = `${input.targetRoot}.staging-${safeName(built.manifest.packageId)}`;
  try {
    await input.adapter.removePath(stagingRoot);
    await input.adapter.makeDirectory(stagingRoot);
    for (const [path, content] of built.files) await input.adapter.writeFile(joinPath(stagingRoot, path), content);
    await input.adapter.publishDirectory(stagingRoot, input.targetRoot);
    return { ...built, targetRoot: input.targetRoot, stagingRoot };
  } catch (error) {
    await input.adapter.removePath(stagingRoot).catch(() => undefined);
    return { ok: false, files: built.files, errors: [error instanceof Error ? error.message : String(error)], targetRoot: input.targetRoot, stagingRoot };
  }
}

function externalImportedContracts(
  definition: DirectorSkillDefinition,
  recipes: DirectorSkillRecipe[],
): { definition: DirectorSkillDefinition; recipes: DirectorSkillRecipe[] } {
  const importedRecipes = recipes.map((recipe) => createDirectorSkillRecipe({ ...recipe }));
  const importedDefinition = createDirectorSkillDefinition({
    ...definition,
    scope: "external_imported",
    maturity: "candidate",
    source: "external_import",
    dependencies: definition.dependencies.map((dependency) => dependency.kind === "recipe"
      ? { ...dependency, contentHash: importedRecipes.find((recipe) => recipe.id === dependency.id)?.contentHash }
      : dependency),
    migration: undefined,
  });
  return { definition: importedDefinition, recipes: importedRecipes };
}

async function importReceipt(input: Omit<DirectorSkillPackageImportReceipt, "schemaVersion" | "receiptId" | "receiptHash">): Promise<DirectorSkillPackageImportReceipt> {
  const withoutHash = {
    ...input,
    schemaVersion: DIRECTOR_SKILL_PACKAGE_IMPORT_RECEIPT_SCHEMA_VERSION as typeof DIRECTOR_SKILL_PACKAGE_IMPORT_RECEIPT_SCHEMA_VERSION,
    receiptId: `dspi_${(await directorSkillPackageSha256(canonicalDirectorSkillJson(input))).slice(7, 19)}`,
  };
  return { ...withoutHash, receiptHash: await directorSkillPackageSha256(canonicalDirectorSkillJson(withoutHash)) };
}

export async function importDirectorSkillPackageFromFileSystem(input: {
  adapter: DirectorSkillPackageFileSystemAdapter;
  packageRoot: string;
  globalLibraryRoot: string;
  registry: DirectorSkillRegistry;
  availableKnowledgePacks?: DirectorSkillKnowledgeBinding[];
  confirmation?: DirectorSkillRegistryConfirmation;
  importedAt?: string;
}): Promise<DirectorSkillPackageImportResult> {
  const importedAt = input.importedAt || new Date().toISOString();
  const validation = await validateDirectorSkillPackageFromFileSystem(input);
  if (!validation.ok || !validation.definition || !validation.manifest) {
    const receipt = await importReceipt({
      packageId: validation.manifest?.packageId,
      skillId: validation.manifest?.skillId,
      sourceVersion: validation.manifest?.skillVersion,
      sourceContentHash: validation.manifest?.skillContentHash,
      status: "blocked",
      externalVerificationStatus: "failed",
      atomicPublished: false,
      checks: validation.checks,
      errors: validation.errors,
      createdAt: importedAt,
    });
    return { ok: false, status: "blocked", registry: input.registry, validation, receipt };
  }
  const imported = externalImportedContracts(validation.definition, validation.recipes);
  const registryMutation = installDirectorSkillRegistryVersion({
    registry: input.registry,
    definition: imported.definition,
    recipes: imported.recipes,
    confirmation: input.confirmation,
    installedAt: importedAt,
  });
  if (!registryMutation.ok || registryMutation.status === "blocked") {
    const receipt = await importReceipt({
      packageId: validation.manifest.packageId,
      skillId: imported.definition.id,
      sourceVersion: validation.definition.version,
      sourceContentHash: validation.definition.contentHash,
      installedVersion: imported.definition.version,
      installedContentHash: imported.definition.contentHash,
      status: "blocked",
      externalVerificationStatus: "verified",
      registryOperationReceiptId: registryMutation.receipt.receiptId,
      atomicPublished: false,
      checks: validation.checks,
      errors: registryMutation.errors,
      createdAt: importedAt,
    });
    return { ok: false, status: "blocked", registry: input.registry, registryMutation, validation, receipt };
  }
  if (registryMutation.status === "no_change") {
    const receipt = await importReceipt({
      packageId: validation.manifest.packageId,
      skillId: imported.definition.id,
      sourceVersion: validation.definition.version,
      sourceContentHash: validation.definition.contentHash,
      installedVersion: imported.definition.version,
      installedContentHash: imported.definition.contentHash,
      status: "no_change",
      externalVerificationStatus: "verified",
      registryOperationReceiptId: registryMutation.receipt.receiptId,
      atomicPublished: false,
      checks: validation.checks,
      errors: [],
      createdAt: importedAt,
    });
    return { ok: true, status: "no_change", registry: input.registry, registryMutation, validation, receipt };
  }

  const stagingRoot = joinPath(input.globalLibraryRoot, `director-skills/.staging/${registryMutation.receipt.receiptId}`);
  const stagingRegistryPath = joinPath(stagingRoot, "registry.json");
  const targetRegistryPath = joinPath(input.globalLibraryRoot, DIRECTOR_SKILL_GLOBAL_REGISTRY_RELATIVE_PATH);
  try {
    await input.adapter.removePath(stagingRoot);
    await input.adapter.makeDirectory(stagingRoot);
    await input.adapter.writeFile(stagingRegistryPath, serializeDirectorSkillRegistry(registryMutation.registry));
    await input.adapter.atomicReplaceFile(stagingRegistryPath, targetRegistryPath);
    await input.adapter.removePath(stagingRoot);
  } catch (error) {
    await input.adapter.removePath(stagingRoot).catch(() => undefined);
    const errors = [error instanceof Error ? error.message : String(error)];
    const receipt = await importReceipt({
      packageId: validation.manifest.packageId,
      skillId: imported.definition.id,
      sourceVersion: validation.definition.version,
      sourceContentHash: validation.definition.contentHash,
      installedVersion: imported.definition.version,
      installedContentHash: imported.definition.contentHash,
      status: "blocked",
      externalVerificationStatus: "verified",
      registryOperationReceiptId: registryMutation.receipt.receiptId,
      atomicPublished: false,
      checks: validation.checks,
      errors,
      createdAt: importedAt,
    });
    return { ok: false, status: "blocked", registry: input.registry, registryMutation, validation, receipt };
  }
  const receipt = await importReceipt({
    packageId: validation.manifest.packageId,
    skillId: imported.definition.id,
    sourceVersion: validation.definition.version,
    sourceContentHash: validation.definition.contentHash,
    installedVersion: imported.definition.version,
    installedContentHash: imported.definition.contentHash,
    status: "imported",
    externalVerificationStatus: "verified",
    registryOperationReceiptId: registryMutation.receipt.receiptId,
    atomicPublished: true,
    checks: validation.checks,
    errors: [],
    createdAt: importedAt,
  });
  return { ok: true, status: "imported", registry: registryMutation.registry, registryMutation, validation, receipt };
}
