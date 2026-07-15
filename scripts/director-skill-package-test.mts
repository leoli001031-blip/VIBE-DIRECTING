import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import {
  canonicalDirectorSkillJson,
  createDirectorSkillDefinition,
  createDirectorSkillRecipe,
  migrateLegacyDirectorSkillCard,
  type DirectorSkillDefinition,
  type DirectorSkillRecipe,
} from "../src/core/directorSkillContract.ts";
import { createDirectorSkillCase } from "../src/core/directorSkillEvidence.ts";
import { buildDirectorSkillCardFromShot } from "../src/core/directorSkillLibrary.ts";
import {
  buildDirectorSkillPackage,
  directorSkillPackageSha256,
  exportDirectorSkillPackageToFileSystem,
  importDirectorSkillPackageFromFileSystem,
  validateDirectorSkillPackageFromFileSystem,
  type DirectorSkillPackageFileSystemAdapter,
  type DirectorSkillPackageManifest,
} from "../src/core/directorSkillPackage.ts";
import {
  createDirectorSkillRegistry,
  parseDirectorSkillRegistry,
  rollbackDirectorSkillVersion,
  serializeDirectorSkillRegistry,
  type DirectorSkillRegistry,
  type DirectorSkillRegistryConfirmation,
} from "../src/core/directorSkillRegistry.ts";
import type { ShotRecord } from "../src/core/types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true).catch(() => false);
}

async function listRelativeFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      if (entry.isFile()) files.push(relative(root, path).replace(/\\/g, "/"));
    }
  }
  if (await exists(root)) await visit(root);
  return files.sort();
}

const adapter: DirectorSkillPackageFileSystemAdapter = {
  exists,
  readFile: (path) => readFile(path, "utf8"),
  async writeFile(path, content) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  },
  listFiles: listRelativeFiles,
  makeDirectory: (path) => mkdir(path, { recursive: true }).then(() => undefined),
  removePath: (path) => rm(path, { recursive: true, force: true }),
  async publishDirectory(stagingPath, targetPath) {
    await mkdir(dirname(targetPath), { recursive: true });
    await rename(stagingPath, targetPath);
  },
  async atomicReplaceFile(stagingPath, targetPath) {
    await mkdir(dirname(targetPath), { recursive: true });
    await rename(stagingPath, targetPath);
  },
};

const shot: ShotRecord = {
  id: "P10S01",
  actId: "act_1",
  title: "关系停顿",
  storyFunction: "用站位、视线和停顿表达关系变化。",
  status: "queued",
  gates: { identity: "UNKNOWN", scene: "UNKNOWN", pair: "UNKNOWN", story: "UNKNOWN", prop: "UNKNOWN", style: "UNKNOWN" },
  issues: [],
  referenceStrategy: "storyboard_narrative",
  executionMode: "relationship_wide",
  durationSeconds: 6,
  primaryAction: "人物停住",
  actionTrigger: "对方叫住她",
  microReaction: "她松开手指",
};

function candidateFor(value: ShotRecord): { definition: DirectorSkillDefinition; recipe: DirectorSkillRecipe } {
  const migrated = migrateLegacyDirectorSkillCard(buildDirectorSkillCardFromShot(value));
  assert(migrated.ok && migrated.definition && migrated.recipe, "candidate fixture must migrate to v2 contracts");
  return { definition: migrated.definition, recipe: migrated.recipe };
}

function versioned(
  definition: DirectorSkillDefinition,
  recipe: DirectorSkillRecipe,
  version: string,
  extraRule?: string,
): { definition: DirectorSkillDefinition; recipe: DirectorSkillRecipe } {
  const nextRecipe = createDirectorSkillRecipe({ ...recipe, version });
  const nextDefinition = createDirectorSkillDefinition({
    ...definition,
    version,
    rules: extraRule ? [...definition.rules, extraRule] : definition.rules,
    dependencies: definition.dependencies.map((dependency) => dependency.kind === "recipe" && dependency.id === recipe.id
      ? { ...dependency, version, contentHash: nextRecipe.contentHash }
      : dependency),
  });
  return { definition: nextDefinition, recipe: nextRecipe };
}

function confirmation(skillId: string, targetVersion: string, suffix: string): DirectorSkillRegistryConfirmation {
  return {
    confirmationId: `confirm_install_${suffix}`,
    confirmedBy: "user",
    confirmedAt: "2026-07-16T07:00:00.000Z",
    operation: "install_version",
    skillId,
    targetVersion,
  };
}

async function rewriteManifest(root: string, mutate: (manifest: DirectorSkillPackageManifest) => void): Promise<void> {
  const path = join(root, "manifest.json");
  const manifest = JSON.parse(await readFile(path, "utf8")) as DirectorSkillPackageManifest;
  mutate(manifest);
  const { manifestHash: _manifestHash, ...withoutHash } = manifest;
  manifest.manifestHash = await directorSkillPackageSha256(canonicalDirectorSkillJson(withoutHash));
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

const root = await mkdtemp("/tmp/vibe-director-p10-s-package-");
const packageRoot = join(root, "packages", "narrative-1.0.0");
const globalRoot = join(root, "global-library");
const registryPath = join(globalRoot, "director-skills", "registry.json");
const at = "2026-07-16T07:00:00.000Z";
const { definition, recipe } = candidateFor(shot);
const acceptedCase = createDirectorSkillCase({
  projectId: "portable-project",
  projectRoot: join(root, "projects", "portable-project"),
  projectFactHash: "fact_portable_project",
  shotId: shot.id,
  actionId: "action_portable_case",
  jobId: "job_portable_case",
  skillId: definition.id,
  skillVersion: definition.version,
  skillContentHash: definition.contentHash,
  routeId: "route_portable_case",
  inputHash: "input_portable_case",
  outputHash: "output_portable_case",
  knowledgePacks: [],
  provider: { executionMode: "dry_run" },
  qa: { status: "pass", checkedSkillHash: definition.contentHash, checkedKnowledgePackHashes: [], findings: [] },
  humanDecision: { decision: "accepted", decidedBy: "user", decidedAt: at, confirmationId: "confirm_portable_case" },
  outcome: "accepted",
  summary: "Accepted dry-run directing method without media evidence.",
  createdAt: at,
});

const secretDefinition = createDirectorSkillDefinition({ ...definition, rules: [...definition.rules, "api_key=supersecret123"] });
const secretBuild = await buildDirectorSkillPackage({ definition: secretDefinition, recipes: [recipe], generatedAt: at });
assert(!secretBuild.ok && secretBuild.errors.some((error) => error.includes("API-key")), "package build must reject API-key material");
const pathDefinition = createDirectorSkillDefinition({ ...definition, rules: [...definition.rules, "Read /Users/example/private.mov"] });
const pathBuild = await buildDirectorSkillPackage({ definition: pathDefinition, recipes: [recipe], generatedAt: at });
assert(!pathBuild.ok && pathBuild.errors.some((error) => error.includes("absolute local path")), "package build must reject absolute local paths");

const exported = await exportDirectorSkillPackageToFileSystem({
  adapter,
  targetRoot: packageRoot,
  definition,
  recipes: [recipe],
  cases: [acceptedCase],
  generatedAt: at,
});
assert(exported.ok && exported.manifest, `portable package export should pass: ${exported.errors.join("; ")}`);
assert(exported.manifest.files.every((file) => !file.path.startsWith("/") && file.sha256.startsWith("sha256:")), "manifest paths must be relative and files SHA-256 bound");
const exportedText = (await Promise.all((await listRelativeFiles(packageRoot)).map((path) => readFile(join(packageRoot, path), "utf8")))).join("\n");
assert(!exportedText.includes(root) && !exportedText.includes("/Users/"), "portable package must redact project and user absolute paths");
assert(!exportedText.includes(acceptedCase.projectId) && !exportedText.includes(acceptedCase.shotId), "portable Cases must hash project and shot identities");

const emptyRegistry = createDirectorSkillRegistry("p10-s-package-isolated", at);
const validation = await validateDirectorSkillPackageFromFileSystem({ adapter, packageRoot, registry: emptyRegistry });
assert(validation.ok && Object.values(validation.checks).every(Boolean), `package validation should pass: ${validation.errors.join("; ")}`);
assert(validation.cases[0]?.humanDecisionEvidence.present === true, "portable Case should preserve redacted human decision evidence");

const unconfirmed = await importDirectorSkillPackageFromFileSystem({
  adapter,
  packageRoot,
  globalLibraryRoot: globalRoot,
  registry: emptyRegistry,
  importedAt: at,
});
assert(!unconfirmed.ok && unconfirmed.status === "blocked", "external package import must require explicit install confirmation");
assert(!(await exists(registryPath)), "blocked import must not create a global registry file");

const imported = await importDirectorSkillPackageFromFileSystem({
  adapter,
  packageRoot,
  globalLibraryRoot: globalRoot,
  registry: emptyRegistry,
  confirmation: confirmation(definition.id, definition.version, "initial"),
  importedAt: at,
});
assert(imported.ok && imported.status === "imported" && imported.receipt.atomicPublished, `confirmed import should publish atomically: ${imported.receipt.errors.join("; ")}`);
const persistedInitial = parseDirectorSkillRegistry(await readFile(registryPath, "utf8"));
assert(persistedInitial.ok && persistedInitial.registry, `published registry should parse: ${persistedInitial.errors.join("; ")}`);
const installedInitial = persistedInitial.registry.entries[0]?.versions[0]?.definition;
assert(installedInitial?.scope === "external_imported" && installedInitial.maturity === "candidate" && installedInitial.source === "external_import", "external package must install as an external candidate");

const duplicate = await importDirectorSkillPackageFromFileSystem({
  adapter,
  packageRoot,
  globalLibraryRoot: globalRoot,
  registry: imported.registry,
  confirmation: confirmation(definition.id, definition.version, "duplicate"),
  importedAt: "2026-07-16T07:01:00.000Z",
});
assert(duplicate.ok && duplicate.status === "no_change" && !duplicate.receipt.atomicPublished, "same version and content should be an explicit no-op");

const changed = versioned(definition, recipe, definition.version, "Preserve a longer reaction hold before the cut.");
const changedPackageRoot = join(root, "packages", "narrative-1.0.0-changed");
assert((await exportDirectorSkillPackageToFileSystem({ adapter, targetRoot: changedPackageRoot, definition: changed.definition, recipes: [changed.recipe], generatedAt: at })).ok, "changed same-version package should export");
const registryBeforeConflict = await readFile(registryPath, "utf8");
const sameVersionConflict = await importDirectorSkillPackageFromFileSystem({
  adapter,
  packageRoot: changedPackageRoot,
  globalLibraryRoot: globalRoot,
  registry: imported.registry,
  confirmation: confirmation(definition.id, definition.version, "same-version-conflict"),
  importedAt: "2026-07-16T07:02:00.000Z",
});
assert(!sameVersionConflict.ok && sameVersionConflict.receipt.errors.some((error) => error.includes("different content")), "same version with different content must fail closed");
assert(await readFile(registryPath, "utf8") === registryBeforeConflict, "blocked same-version import must not mutate persisted registry");

const upgradedContract = versioned(definition, recipe, "1.1.0", "Preserve a longer reaction hold before the cut.");
const upgradePackageRoot = join(root, "packages", "narrative-1.1.0");
assert((await exportDirectorSkillPackageToFileSystem({ adapter, targetRoot: upgradePackageRoot, definition: upgradedContract.definition, recipes: [upgradedContract.recipe], generatedAt: at })).ok, "upgrade package should export");
const upgraded = await importDirectorSkillPackageFromFileSystem({
  adapter,
  packageRoot: upgradePackageRoot,
  globalLibraryRoot: globalRoot,
  registry: imported.registry,
  confirmation: confirmation(definition.id, "1.1.0", "upgrade"),
  importedAt: "2026-07-16T07:03:00.000Z",
});
assert(upgraded.ok && upgraded.registry.entries[0]?.activeVersion === "1.1.0" && upgraded.registry.entries[0]?.versions.length === 2, "upgrade should preserve immutable version history");

const downgradedContract = versioned(definition, recipe, "0.9.0");
const downgradePackageRoot = join(root, "packages", "narrative-0.9.0");
assert((await exportDirectorSkillPackageToFileSystem({ adapter, targetRoot: downgradePackageRoot, definition: downgradedContract.definition, recipes: [downgradedContract.recipe], generatedAt: at })).ok, "downgrade fixture should export");
const downgrade = await importDirectorSkillPackageFromFileSystem({
  adapter,
  packageRoot: downgradePackageRoot,
  globalLibraryRoot: globalRoot,
  registry: upgraded.registry,
  confirmation: confirmation(definition.id, "0.9.0", "downgrade"),
  importedAt: "2026-07-16T07:04:00.000Z",
});
assert(!downgrade.ok && downgrade.receipt.errors.some((error) => error.includes("downgrade")), "package downgrade must be blocked in favor of explicit rollback");

const rolledBack = rollbackDirectorSkillVersion({
  registry: upgraded.registry,
  skillId: definition.id,
  targetVersion: "1.0.0",
  confirmation: {
    confirmationId: "confirm_explicit_rollback",
    confirmedBy: "user",
    confirmedAt: "2026-07-16T07:05:00.000Z",
    operation: "rollback",
    skillId: definition.id,
    targetVersion: "1.0.0",
  },
  createdAt: "2026-07-16T07:05:00.000Z",
});
assert(rolledBack.ok && rolledBack.registry.entries[0]?.activeVersion === "1.0.0" && rolledBack.registry.entries[0]?.pinnedVersion === "1.0.0", "explicit rollback must restore and pin an installed version");
const rollbackStaging = join(globalRoot, "director-skills", ".staging", "rollback", "registry.json");
await adapter.writeFile(rollbackStaging, serializeDirectorSkillRegistry(rolledBack.registry));
await adapter.atomicReplaceFile(rollbackStaging, registryPath);
assert(parseDirectorSkillRegistry(await readFile(registryPath, "utf8")).registry?.entries[0]?.activeVersion === "1.0.0", "persisted rollback registry should remain valid");

const corruptRoot = join(root, "packages", "corrupt");
await cp(packageRoot, corruptRoot, { recursive: true });
await writeFile(join(corruptRoot, "skill.json"), `${await readFile(join(corruptRoot, "skill.json"), "utf8")} `, "utf8");
const corrupt = await validateDirectorSkillPackageFromFileSystem({ adapter, packageRoot: corruptRoot, registry: emptyRegistry });
assert(!corrupt.ok && !corrupt.checks.hashes, "corrupted package content must fail SHA-256 validation");

const unknownSchemaRoot = join(root, "packages", "unknown-schema");
await cp(packageRoot, unknownSchemaRoot, { recursive: true });
await rewriteManifest(unknownSchemaRoot, (manifest) => {
  (manifest as { schemaVersion: string }).schemaVersion = "director_skill_package_manifest/99.0.0";
});
const unknownSchema = await validateDirectorSkillPackageFromFileSystem({ adapter, packageRoot: unknownSchemaRoot, registry: emptyRegistry });
assert(!unknownSchema.ok && unknownSchema.errors.some((error) => error.includes("unsupported package manifest schemaVersion")), "unknown manifest schema must fail closed");

const dependencyDefinition = createDirectorSkillDefinition({
  ...definition,
  semanticKey: "narrative-with-required-pack",
  id: "director.skill.narrative_with_required_pack",
  dependencies: [...definition.dependencies, { kind: "knowledge_pack", id: "missing.pack", version: "1.0.0", contentHash: "missing_hash", optional: false }],
});
const dependencyRecipe = createDirectorSkillRecipe({ ...recipe, skillId: dependencyDefinition.id });
const dependencyBoundDefinition = createDirectorSkillDefinition({
  ...dependencyDefinition,
  dependencies: dependencyDefinition.dependencies.map((item) => item.kind === "recipe" ? { ...item, contentHash: dependencyRecipe.contentHash } : item),
});
const dependencyRoot = join(root, "packages", "missing-dependency");
const dependencyExport = await exportDirectorSkillPackageToFileSystem({ adapter, targetRoot: dependencyRoot, definition: dependencyBoundDefinition, recipes: [dependencyRecipe], generatedAt: at });
assert(dependencyExport.ok, `dependency fixture package should export: ${dependencyExport.errors.join("; ")}`);
const dependencyValidation = await validateDirectorSkillPackageFromFileSystem({ adapter, packageRoot: dependencyRoot, registry: emptyRegistry });
assert(!dependencyValidation.ok && dependencyValidation.errors.some((error) => error.includes("missing Knowledge Pack dependency")), "missing required Knowledge Pack must block import");

const rapidCandidate = candidateFor({ ...shot, id: "P10S02", title: "快速切换", referenceStrategy: "storyboard_rapid_cut", executionMode: "multi_beat_fast" });
const conflictingDefinition = createDirectorSkillDefinition({
  ...rapidCandidate.definition,
  conflicts: [{ skillId: definition.id, reason: "Fixture conflict requires manual selection.", resolution: "manual_selection_required" }],
});
const conflictRoot = join(root, "packages", "conflict");
assert((await exportDirectorSkillPackageToFileSystem({ adapter, targetRoot: conflictRoot, definition: conflictingDefinition, recipes: [rapidCandidate.recipe], generatedAt: at })).ok, "conflict fixture package should export");
const conflictValidation = await validateDirectorSkillPackageFromFileSystem({ adapter, packageRoot: conflictRoot, registry: imported.registry });
assert(!conflictValidation.ok && conflictValidation.errors.some((error) => error.includes("unresolved Skill conflict")), "active Skill conflict must block import");

const failureGlobalRoot = join(root, "atomic-failure-global");
const failureRegistryPath = join(failureGlobalRoot, "director-skills", "registry.json");
const failingAdapter: DirectorSkillPackageFileSystemAdapter = {
  ...adapter,
  async atomicReplaceFile() {
    throw new Error("simulated atomic publish failure");
  },
};
const atomicFailure = await importDirectorSkillPackageFromFileSystem({
  adapter: failingAdapter,
  packageRoot,
  globalLibraryRoot: failureGlobalRoot,
  registry: emptyRegistry,
  confirmation: confirmation(definition.id, definition.version, "atomic-failure"),
  importedAt: "2026-07-16T07:06:00.000Z",
});
assert(!atomicFailure.ok && atomicFailure.status === "blocked" && !atomicFailure.receipt.atomicPublished, "atomic publication failure must return a blocked receipt");
assert(!(await exists(failureRegistryPath)) && atomicFailure.registry.registryHash === emptyRegistry.registryHash, "atomic publication failure must leave no partial registry mutation");

console.log(JSON.stringify({
  status: "PASS",
  root,
  packageRoot,
  globalLibraryRoot: globalRoot,
  manifestFiles: exported.manifest.files.length,
  validatedCases: validation.cases.length,
  importStatus: imported.status,
  duplicateStatus: duplicate.status,
  activeAfterUpgrade: upgraded.registry.entries[0]?.activeVersion,
  activeAfterRollback: rolledBack.registry.entries[0]?.activeVersion,
  blocked: {
    noConfirmation: unconfirmed.status,
    sameVersionDifferentContent: sameVersionConflict.status,
    downgrade: downgrade.status,
    corrupt: corrupt.status,
    unknownSchema: unknownSchema.status,
    missingDependency: dependencyValidation.status,
    conflict: conflictValidation.status,
    atomicFailure: atomicFailure.status,
  },
  providerCalls: 0,
}, null, 2));
