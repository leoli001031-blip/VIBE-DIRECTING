import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function transpile(path) {
  return ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: path,
  }).outputText;
}

function dataUrl(path, output) {
  return `data:text/javascript;base64,${Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64")}`;
}

async function importProjectRuntime() {
  const projectStoreUrl = dataUrl("src/core/projectStore.ts", transpile("src/core/projectStore.ts"));
  const runtimeOutput = transpile("src/core/projectRuntime.ts").replace(/from "\.\/projectStore";/g, `from "${projectStoreUrl}";`);
  return import(dataUrl("src/core/projectRuntime.ts", runtimeOutput));
}

const { buildProjectRuntimePlan } = await importProjectRuntime();

const generatedAt = "2026-05-01T00:00:00.000Z";

function storyFlow(shots = ["shot_001"]) {
  return {
    schemaVersion: "0.1.0",
    id: "runtime_story_flow",
    productionBibleId: "runtime_production_bible",
    sectionModel: "adaptive",
    sections: [
      {
        id: "opening",
        label: "Opening",
        sectionKind: "custom",
        sequenceIndex: 0,
        storyFunction: "Open the project.",
        beats: [],
        shots: shots.map((id) => ({ id, shotSpecId: id, storyFunction: `Story function ${id}.`, status: "planned" })),
      },
    ],
    shotOrder: shots,
    sourceRefs: ["project-runtime-test"],
    updatedAt: generatedAt,
  };
}

const visualMemory = {
  schemaVersion: "0.1.0",
  id: "runtime_visual_memory",
  libraryPurpose: "asset_consistency_memory",
  referenceAuthorityPolicy: {
    authorityRoleRequired: true,
    assetLibraryIsGallery: false,
    tempOutputAutoPromote: false,
    localPostprocessCanSemanticRepair: false,
  },
  assets: [
    {
      id: "hero_ref",
      type: "character",
      name: "Hero",
      path: "visual_memory/hero/main.png",
      status: "exists",
      lockedStatus: "locked",
      safeForFutureReference: true,
      issues: [],
    },
  ],
  updatedAt: generatedAt,
};

const sourceIndex = {
  projectId: "phase_14_runtime",
  projectVersion: "0.1.0",
  sourceIndexHash: "source_hash_phase_14",
  currentStoryFlowId: "story_flow/story_flow.vibe.json",
  currentVisualMemoryId: "visual_memory/visual_memory.vibe.json",
};

const baseInput = {
  mode: "create",
  projectId: "phase_14_runtime",
  title: "Phase 14 Runtime",
  rootRef: "project_root",
  generatedAt,
  version: "0.1.0",
  productionBible: {
    schemaVersion: "0.1.0",
    id: "runtime_production_bible",
    title: "Phase 14 Runtime",
  },
  storyFlow: storyFlow(),
  visualMemory,
  sourceIndex,
  sourceIndexHash: sourceIndex.sourceIndexHash,
  shotSpecs: [
    {
      shotId: "shot_001",
      value: {
        schemaVersion: "0.1.0",
        id: "shot_001",
        storyFunction: "Open the project.",
        action: "The camera settles on the workspace.",
      },
    },
  ],
};

const createPlan = buildProjectRuntimePlan(baseInput);
assert(createPlan.phase === "phase_14_project_runtime_core", "create plan must expose Phase 14 runtime core");
assert(createPlan.mode === "create", "create plan mode drifted");
assert(createPlan.validation.ok, `create plan should validate: ${createPlan.validation.errors.join("; ")}`);
assert(createPlan.projectEntry.fileName === "project.vibe", "project.vibe must be the runtime entry");
assert(createPlan.projectEntry.sourceOfTruth === "project_file", "project.vibe must be a project-file source");
assert(createPlan.projectEntry.runtimeStateMayOverride === false, "runtime-state may not override project entry");
assert(createPlan.factFiles.some((factFile) => factFile.role === "runtime_state" && factFile.sourceOfTruth === "derived_cache"), "runtime-state must be a derived cache fact file");
assert(createPlan.factFiles.every((factFile) => factFile.role === "runtime_state" || factFile.sourceOfTruth === "project_file"), "project facts must prefer project files");
assert(createPlan.plannedTree.some((entry) => entry.path.path === "project.vibe" && entry.kind === "file"), "planned tree must contain project.vibe");
assert(createPlan.writePlan.length > 0, "create plan must describe future writes");
assert(createPlan.readPlan.length > 0, "create plan must describe future reads");
assert(createPlan.writePlan.every((entry) => entry.canExecute === false && entry.noFileMutation === true), "write plan must remain non-executable");
assert(createPlan.runtimeCacheRebuildPlan.cachePolicy.runtimeStateRole === "derived_cache", "runtime cache plan must be derived_cache");
assert(createPlan.runtimeCacheRebuildPlan.rebuildInputs.includes("story_flow"), "runtime cache rebuild must use story_flow");
assert(createPlan.runtimeCacheRebuildPlan.rebuildInputs.includes("visual_memory"), "runtime cache rebuild must use visual_memory");
assert(createPlan.runtimeCacheRebuildPlan.sourcePriority.every((entry) => entry.runtimeStateMayOverride === false), "runtime-state may not override any source priority entry");

const openedPlan = buildProjectRuntimePlan({
  mode: "open",
  generatedAt,
  rootRef: "project_root",
  serializedSnapshot: JSON.stringify(createPlan.snapshot),
});
assert(openedPlan.validation.ok, `open plan should validate: ${openedPlan.validation.errors.join("; ")}`);
assert(openedPlan.snapshot.project.id === "phase_14_runtime", "open plan must preserve serialized project id");
assert(openedPlan.readPlan.every((entry) => entry.execution === "dry_run_plan_only"), "open read plan must be dry-run only");

const savePlan = buildProjectRuntimePlan({
  mode: "save",
  generatedAt: "2026-05-01T00:01:00.000Z",
  rootRef: "project_root",
  snapshot: openedPlan.snapshot,
  storyFlow: storyFlow(["shot_001", "shot_002"]),
  shotSpecs: [
    {
      shotId: "shot_002",
      value: {
        schemaVersion: "0.1.0",
        id: "shot_002",
        storyFunction: "Continue the project.",
        action: "A second planned shot appears in memory.",
      },
    },
  ],
});
assert(savePlan.validation.ok, `save plan should validate: ${savePlan.validation.errors.join("; ")}`);
assert(savePlan.snapshot.revision > openedPlan.snapshot.revision, "save plan must advance the in-memory revision");
assert(savePlan.snapshot.mutationLog.includes("save_planned_memory_only"), "save plan must use Project Store save planning");
assert(savePlan.writePlan.length === savePlan.snapshot.factFiles.length, "save plan must include one future write per fact file");
assert(savePlan.writePlan.some((entry) => entry.role === "shot_spec"), "save plan must include future shot spec write");

const rebuildPlan = buildProjectRuntimePlan({
  mode: "rebuild",
  generatedAt: "2026-05-01T00:02:00.000Z",
  rootRef: "project_root",
  serializedSnapshot: JSON.stringify(savePlan.snapshot),
});
assert(rebuildPlan.validation.ok, `rebuild plan should validate: ${rebuildPlan.validation.errors.join("; ")}`);
assert(rebuildPlan.runtimeCacheRebuildPlan.invalidatesRuntimeState === true, "rebuild plan must invalidate runtime-state");
assert(rebuildPlan.runtimeCacheRebuildPlan.noFileMutation === true, "rebuild plan must not mutate files");
assert(rebuildPlan.userFacingSummary.some((line) => line.includes("runtime-state is a derived cache")), "summary must explain runtime-state role");

const absolutePathPlan = buildProjectRuntimePlan({
  ...baseInput,
  shotSpecs: [{ shotId: "shot_abs", path: "/Users/example/project/shots/shot_abs.json", value: { id: "shot_abs" } }],
});
assert(!absolutePathPlan.validation.ok, "absolute project-root-relative paths must be rejected");
assert(absolutePathPlan.validation.errors.some((error) => error.includes("absolute platform path")), "absolute path rejection must be explicit");

const parentTraversalPlan = buildProjectRuntimePlan({
  ...baseInput,
  shotSpecs: [{ shotId: "shot_parent", path: "../outside/shot_parent.json", value: { id: "shot_parent" } }],
});
assert(!parentTraversalPlan.validation.ok, "parent traversal paths must be rejected");
assert(parentTraversalPlan.validation.errors.some((error) => error.includes("parent traversal")), "parent traversal rejection must be explicit");

const runtimeStateSourcePlan = buildProjectRuntimePlan({
  ...baseInput,
  sourceOfTruth: "runtime_state",
});
assert(!runtimeStateSourcePlan.validation.ok, "runtime-state cannot be accepted as project fact source of truth");
assert(
  runtimeStateSourcePlan.repairPlan.some((item) => item.id === "runtime_state_as_source" && item.status === "blocked"),
  "runtime-state-as-source repair item must block",
);

const missingSourceIndexPlan = buildProjectRuntimePlan({
  mode: "create",
  projectId: "missing_source_index",
  title: "Missing Source Index",
  rootRef: "project_root",
  generatedAt,
});
const migrationIds = new Set(missingSourceIndexPlan.migrationPlan.map((item) => item.id));
for (const id of ["schema_version_check", "missing_fact_file_detection", "runtime_cache_invalidation", "future_safe_migration_placeholder"]) {
  assert(migrationIds.has(id), `migration plan missing ${id}`);
}
const repairIds = new Set(missingSourceIndexPlan.repairPlan.map((item) => item.id));
for (const id of [
  "missing_project_vibe",
  "missing_story_flow",
  "missing_visual_memory",
  "missing_source_index",
  "orphan_shot_specs",
  "runtime_state_as_source",
]) {
  assert(repairIds.has(id), `repair plan missing ${id}`);
}
assert(
  missingSourceIndexPlan.repairPlan.some((item) => item.id === "missing_source_index" && item.status === "needed"),
  "missing source index must produce a repair proposal",
);

for (const [key, expected] of Object.entries({
  noFileMutation: true,
  noDirectoryCreate: true,
  noUserFileMove: true,
  noProviderSubmit: true,
  noCredentialRead: true,
  projectVibeWriteAllowed: false,
  runtimeStateIsDerivedCache: true,
})) {
  assert(createPlan.hardLocks[key] === expected, `hard lock ${key} drifted`);
}

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert(packageJson.scripts["project-runtime:test"] === "node scripts/project-runtime-test.mjs", "package script project-runtime:test missing");
assert(packageJson.scripts["real-provider-pilot:test"] === "node scripts/real-provider-pilot-test.mjs", "package script real-provider-pilot:test missing");

console.log(
  `Project Runtime tests passed: ${createPlan.factFiles.length} fact files, ${createPlan.writePlan.length} write plans, cache ${createPlan.runtimeCacheRebuildPlan.cachePolicy.runtimeStateRole}.`,
);
