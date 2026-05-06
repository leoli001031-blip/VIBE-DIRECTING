import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function importTs(path) {
  const source = fs.readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: path,
  }).outputText;
  const encoded = Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

const importResult = spawnSync("node", ["scripts/import-runtime-test.mjs"], {
  stdio: "inherit",
  encoding: "utf8",
  timeout: 120000,
});

assert(importResult.status === 0, "project file core test could not refresh runtime-state with import-runtime-test");

const state = readJson("public/runtime-state.json");
const { buildProjectFileCoreState } = await importTs("src/core/projectFileCore.ts");
const projectFileCore = state.projectFileCore?.projectFileFactSourceReceipt
  ? state.projectFileCore
  : buildProjectFileCoreState({
      generatedAt: state.generatedAt,
      projectRoot: state.project.root,
      importedAt: state.project.importedAt,
      sourceTask: state.project.sourceTask,
      sourceIndex: state.sourceIndex,
      storyFlow: { shots: state.storyFlow.shots },
      visualMemory: { assets: state.visualMemory.assets },
      runtime: state.runtime,
      audit: { projectRoot: state.project.root, sourceTask: state.project.sourceTask },
    });
assert(projectFileCore, "runtime-state missing projectFileCore");
assert(projectFileCore.schemaVersion === "0.1.0", "projectFileCore schemaVersion drifted");
assert(projectFileCore.phase === "phase_9_1_minimum_file_first_core", "projectFileCore phase drifted");
assert(projectFileCore.projectFileName === "project.vibe", "projectFileCore must plan project.vibe");
assert(projectFileCore.projectFileStatus === "planned_not_written", "project.vibe must not be written in Phase 9.1");

const requiredRoles = [
  "project_manifest",
  "production_bible",
  "story_flow",
  "shot_spec",
  "shot_layout",
  "visual_memory",
  "spatial_memory",
  "scene_asset_pack",
  "voice_memory",
  "shots",
  "manifests",
  "reports",
  "preview",
  "exports",
  "knowledge",
  "settings",
];
const plannedByRole = new Map(projectFileCore.plannedFileTree.map((entry) => [entry.role, entry]));
for (const role of requiredRoles) {
  const entry = plannedByRole.get(role);
  assert(entry, `planned file tree missing ${role}`);
  assert(entry.pathOrigin === "project_root_relative", `${role} path must be project-root-relative`);
  assert(entry.status === "planned_only", `${role} must be planned-only`);
  assert(!/^(?:[A-Za-z]:[\\/]|\/|\/\/)/.test(entry.path), `${role} path must not be an absolute platform path`);
}

const sourceRoles = projectFileCore.sourceOfTruthPriority.map((entry) => entry.role);
for (const role of [...requiredRoles, "runtime_state"]) {
  assert(sourceRoles.includes(role), `source-of-truth priority missing ${role}`);
}
const runtimeSource = projectFileCore.sourceOfTruthPriority.find((entry) => entry.role === "runtime_state");
assert(runtimeSource.authority === "derived_cache", "runtime-state source priority must be derived cache");
assert(runtimeSource.runtimeStateMayOverride === false, "runtime-state may not override file-first facts");
assert(projectFileCore.derivedCachePolicy.runtimeStateRole === "derived_cache", "runtime-state role must be derived cache");
assert(projectFileCore.derivedCachePolicy.runtimeStateMayBeRebuilt === true, "runtime-state must be rebuildable");
assert(projectFileCore.derivedCachePolicy.runtimeStateIsSoleSourceOfTruth === false, "runtime-state must not be sole source of truth");
assert(
  projectFileCore.derivedCachePolicy.cacheKeys.sourceIndexHash === state.sourceIndex.sourceIndexHash,
  "derived cache sourceIndexHash must mirror sourceIndex",
);
assert(projectFileCore.projectFileFactSourceReceipt.receiptKind === "project_file_fact_source", "project file fact source receipt missing");
assert(projectFileCore.projectFileFactSourceReceipt.projectVibeEntry.path === "project.vibe", "receipt must pin project.vibe entry");
assert(projectFileCore.projectFileFactSourceReceipt.projectVibeEntry.runtimeStateMayOverride === false, "runtime-state must not override project.vibe receipt");
assert(projectFileCore.projectFileFactSourceReceipt.saveOpenContract.projectRootRelativeRequired === true, "save/open contract must be project-root-relative");
assert(projectFileCore.projectFileFactSourceReceipt.saveOpenContract.absolutePathsBlocked === true, "save/open contract must block absolute paths");
assert(projectFileCore.projectFileFactSourceReceipt.saveOpenContract.parentTraversalBlocked === true, "save/open contract must block parent traversal");
assert(projectFileCore.projectFileFactSourceReceipt.saveOpenContract.userFileMoveDeleteBlocked === true, "save/open contract must block user file move/delete");
assert(projectFileCore.projectFileFactSourceReceipt.saveOpenContract.credentialTokenSecretWriteBlocked === true, "save/open contract must block credential/token/secret writes");
assert(projectFileCore.projectFileFactSourceReceipt.runtimeStateDerivedCache.mayBeRebuiltFromProjectFiles === true, "runtime-state receipt must be rebuildable from project files");
assert(projectFileCore.projectFileFactSourceReceipt.runtimeStateDerivedCache.mayOverwriteProjectFiles === false, "runtime-state receipt must not overwrite project files");
for (const blockedAuthority of ["runtime_state", "runtime_cache", "chat_history", "old_chat", "direct_input", "global_knowledge_library"]) {
  assert(projectFileCore.projectFileFactSourceReceipt.blockedAuthorities.includes(blockedAuthority), `receipt must block ${blockedAuthority} authority`);
}
assert(projectFileCore.projectFileFactSourceReceipt.projectLocalKnowledgeScope.projectKnowledgeMayBeFactReference === true, "project knowledge may be a project-local fact reference");
assert(projectFileCore.projectFileFactSourceReceipt.projectLocalKnowledgeScope.globalKnowledgeMayAuthorizeProjectFacts === false, "global knowledge must not authorize project facts");
assert(projectFileCore.projectFileFactSourceReceipt.projectLocalKnowledgeScope.oldChatMayAuthorizeProjectFacts === false, "old chat must not authorize project facts");

const locks = projectFileCore.hardLocks;
for (const [key, expected] of Object.entries({
  dryRunOnly: true,
  readOnly: true,
  noFileMutation: true,
  noUserFileMove: true,
  noProviderSubmit: true,
  noImageGeneration: true,
  noVideoGeneration: true,
  noArbitraryShell: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  projectVibeWriteAllowed: false,
  runtimeStateIsDerivedCache: true,
})) {
  assert(locks[key] === expected, `hard lock ${key} must be ${expected}`);
}

assert(projectFileCore.pathPolicy.projectRootRelativeRequired === true, "path policy must require project-root-relative paths");
assert(projectFileCore.pathPolicy.userSelectedImportAllowed === true, "path policy must allow user-selected import roots");
assert(projectFileCore.pathPolicy.hardcodedAbsolutePathContractForbidden === true, "path policy must forbid hardcoded absolute path contracts");
assert(projectFileCore.pathPolicy.platformSpecificPathContractForbidden === true, "path policy must forbid platform-specific path contracts");
assert(projectFileCore.pathPolicy.pathResolverRequired === true, "path policy must require a path resolver");

for (const entry of projectFileCore.sourceOfTruthPriority) {
  assert(!/^(?:[A-Za-z]:[\\/]|\/|\/\/)/.test(entry.canonicalPath), `${entry.role} canonicalPath must be portable`);
  for (const ref of entry.importedSourceRefs || []) {
    assert(["project_root_relative", "user_selected_import"].includes(ref.origin), `${entry.role} imported ref origin must be allowed`);
    if (/^(?:[A-Za-z]:[\\/]|\/|\/\/)/.test(ref.path)) {
      assert(ref.origin === "user_selected_import", `${entry.role} absolute ref must only be user-selected import evidence`);
    }
  }
}

assert(projectFileCore.migrationReadiness.readyForProjectVibeWrite === false, "Phase 9.1 must not enable project.vibe writes");

const schema = readJson("schemas/project_file_core.schema.json");
assert(schema.title === "ProjectFileCoreState", "project file core schema title drifted");
assert(schema.properties.projectFileName.const === "project.vibe", "schema must pin project.vibe name");
assert(schema.properties.projectFileStatus.const === "planned_not_written", "schema must pin planned_not_written");
assert(schema.properties.hardLocks.$ref === "#/$defs/hardLocks", "schema must use hardLocks defs");
assert(schema.properties.projectFileFactSourceReceipt.$ref === "#/$defs/factSourceReceipt", "schema must expose project file fact source receipt");
assert(schema.$defs.hardLocks.properties.noFileMutation.const === true, "schema must pin noFileMutation");
assert(schema.$defs.hardLocks.properties.noProviderSubmit.const === true, "schema must pin noProviderSubmit");
assert(schema.$defs.hardLocks.properties.noArbitraryShell.const === true, "schema must pin noArbitraryShell");
assert(schema.$defs.hardLocks.properties.noCredentialRead.const === true, "schema must pin noCredentialRead");
assert(schema.$defs.hardLocks.properties.noCredentialWrite.const === true, "schema must pin noCredentialWrite");
assert(schema.$defs.hardLocks.properties.projectVibeWriteAllowed.const === false, "schema must forbid project.vibe writes in Phase 9.1");
assert(schema.$defs.hardLocks.properties.runtimeStateIsDerivedCache.const === true, "schema must pin runtime-state as derived cache");

const projectSchema = readJson("schemas/project_runtime_state.schema.json");
assert(projectSchema.required.includes("projectFileCore"), "project runtime schema must require projectFileCore");
assert(
  projectSchema.properties.projectFileCore.$ref === "project_file_core.schema.json",
  "project runtime schema must reference project_file_core schema",
);
assert(
  projectSchema.properties.projectFactsIntegration.$ref === "project_facts_integration.schema.json",
  "project runtime schema must reference project_facts_integration schema when present",
);

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("project_file_core.schema.json"), "schema registry must include project_file_core.schema.json");
assert(registrySource.includes("ProjectFileCoreState"), "schema registry must include ProjectFileCoreState");

console.log(`Project file core tests passed: ${projectFileCore.plannedFileTree.length} planned paths, runtime-state is ${projectFileCore.derivedCachePolicy.runtimeStateRole}.`);
