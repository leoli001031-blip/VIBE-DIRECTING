import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

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
  }).outputText;
  const encoded = Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

const {
  applyProjectStorePatch,
  createProjectStorePathRef,
  createProjectStoreSnapshot,
  deriveRuntimeCachePolicy,
  openProjectStoreSnapshot,
  saveProjectStoreSnapshot,
  validateProjectStoreSnapshot,
} = await importTs("src/core/projectStore.ts");

const generatedAt = "2026-04-30T00:00:00.000Z";
const snapshot = createProjectStoreSnapshot({
  generatedAt,
  projectId: "test_project",
  title: "Project Store Fixture",
  version: "0.1.0",
  selectedImportPath: "/Users/example/Movies/source-project",
  selectedImportId: "fixture_root",
  sourceIndex: {
    projectId: "test_project",
    projectVersion: "0.1.0",
    sourceIndexHash: "source_hash_fixture",
  },
});

assert(snapshot.phase === "phase_9_5_project_store", "Project Store phase drifted");
assert(snapshot.projectFile.fileName === "project.vibe", "Project Store must expose project.vibe entry");
assert(snapshot.projectFile.path.path === "project.vibe", "project.vibe entry path must be project-root-relative");
assert(snapshot.project.root.selectedImport.origin === "user_selected_import", "selected project root must be user-selected import evidence");
assert(snapshot.project.root.selectedImport.rawPathRedacted === true, "raw selected project root path must be redacted");
assert(!snapshot.project.root.selectedImport.path.includes("/Users/"), "selected import must not persist a macOS absolute path");

const requiredRoles = ["project_manifest", "story_flow", "visual_memory", "source_index", "runtime_state"];
for (const role of requiredRoles) {
  assert(snapshot.factFiles.some((factFile) => factFile.role === role), `fact files missing ${role}`);
}
for (const factFile of snapshot.factFiles) {
  assert(["project_root_relative", "user_selected_import"].includes(factFile.path.origin), `${factFile.id} path origin must be portable`);
  assert(!/^(?:[A-Za-z]:[\\/]|\/|\/\/)/.test(factFile.path.path), `${factFile.id} path must not be absolute`);
}

assert(snapshot.runtimeCachePolicy.runtimeStateRole === "derived_cache", "runtime cache role must be derived_cache");
assert(snapshot.runtimeCachePolicy.runtimeStateMayBeRebuilt === true, "runtime cache must be rebuildable");
assert(snapshot.runtimeCachePolicy.runtimeStateIsSoleSourceOfTruth === false, "runtime-state must not be sole source of truth");
assert(snapshot.runtimeCachePolicy.cacheKeys.sourceIndexHash === "source_hash_fixture", "sourceIndexHash must be a runtime cache key");
assert(snapshot.runtimeCachePolicy.rebuildInputs.includes("story_flow"), "runtime cache must rebuild from story_flow");
assert(snapshot.runtimeCachePolicy.rebuildInputs.includes("visual_memory"), "runtime cache must rebuild from visual_memory");

const validation = validateProjectStoreSnapshot(snapshot, generatedAt);
assert(validation.ok, `fresh snapshot should validate: ${validation.errors.join("; ")}`);

const opened = openProjectStoreSnapshot(JSON.stringify(snapshot), generatedAt);
assert(opened.openedFrom === "memory_fixture", "open must be memory fixture only");
assert(opened.noFileRead === true, "open must not read files");
assert(opened.validation.ok, "opened snapshot must validate");

const patch = applyProjectStorePatch(snapshot, {
  id: "patch_add_shot",
  appliedAt: "2026-04-30T00:01:00.000Z",
  operations: [
    {
      op: "set_story_flow",
      value: {
        schemaVersion: "0.1.0",
        id: "story_flow_fixture",
        productionBibleId: "production_bible_fixture",
        sectionModel: "adaptive",
        sections: [
          {
            id: "opening",
            label: "Opening",
            sectionKind: "custom",
            sequenceIndex: 0,
            storyFunction: "Introduce the protagonist.",
            beats: [],
            shots: [{ id: "shot_001", shotSpecId: "shot_001", storyFunction: "Introduce protagonist.", status: "planned" }],
          },
        ],
        shotOrder: ["shot_001"],
        sourceRefs: ["test"],
        updatedAt: "2026-04-30T00:01:00.000Z",
      },
    },
    {
      op: "upsert_shot_spec",
      shotId: "shot_001",
      value: {
        schemaVersion: "0.1.0",
        id: "shot_001",
        storyFunction: "Introduce protagonist.",
        action: "The protagonist enters the room.",
      },
    },
  ],
});
assert(patch.appliedOperationCount === 2, "patch should apply two operations");
assert(patch.rejectedOperations.length === 0, "patch should not reject valid operations");
assert(patch.validation.ok, `patched snapshot should validate: ${patch.validation.errors.join("; ")}`);
assert(patch.snapshot.facts.shotSpecs.length === 1, "patched snapshot must contain one shot spec");
assert(patch.snapshot.facts.shotSpecs[0].path.path === "shots/shot_001/shot_spec.vibe.json", "shot spec path must be project-root-relative");
assert(patch.snapshot.factFiles.some((factFile) => factFile.role === "shot_spec"), "fact files must include shot_spec after patch");

const derived = deriveRuntimeCachePolicy(patch.snapshot);
assert(derived.runtimeStateRole === "derived_cache", "deriveRuntimeCachePolicy must return derived cache");
assert(derived.rebuildInputs.includes("shot_spec"), "derived cache must include shot specs once present");
assert(derived.invalidationRefs.includes(patch.snapshot.factFiles.find((factFile) => factFile.role === "shot_spec").hash), "shot spec hash must invalidate runtime cache");

const saved = saveProjectStoreSnapshot(patch.snapshot, "2026-04-30T00:02:00.000Z");
assert(saved.validation.ok, `saved snapshot should validate: ${saved.validation.errors.join("; ")}`);
assert(saved.savePlan.mode === "memory_snapshot_only", "save must be memory snapshot only");
assert(saved.savePlan.noFileMutation === true, "save plan must hard-lock no file mutation");
assert(saved.savePlan.projectVibeWriteAllowed === false, "save plan must not enable project.vibe writes");
assert(saved.savePlan.entries.length === saved.snapshot.factFiles.length, "save plan should include one write plan per fact file");
for (const entry of saved.savePlan.entries) {
  assert(entry.operation === "write", `${entry.id} must be a write plan`);
  assert(entry.canExecute === false, `${entry.id} must not execute`);
  assert(entry.noFileMutation === true, `${entry.id} must preserve noFileMutation`);
  assert(entry.execution === "dry_run_plan_only", `${entry.id} must be dry-run only`);
}

const invalid = structuredClone(snapshot);
invalid.factFiles[0].path = createProjectStorePathRef({
  path: "/Users/example/project.vibe",
  origin: "project_root_relative",
});
const invalidValidation = validateProjectStoreSnapshot(invalid, generatedAt);
assert(!invalidValidation.ok, "absolute project-root-relative path must fail validation");
assert(invalidValidation.errors.some((error) => error.includes("absolute platform path")), "invalid path must report absolute platform path");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert(packageJson.scripts["project-store:test"] === "node scripts/project-store-test.mjs", "package script project-store:test missing");

console.log(
  `Project Store tests passed: ${saved.snapshot.factFiles.length} fact files, ${saved.savePlan.entries.length} dry-run write plans, runtime cache ${saved.snapshot.runtimeCachePolicy.runtimeStateRole}.`,
);
