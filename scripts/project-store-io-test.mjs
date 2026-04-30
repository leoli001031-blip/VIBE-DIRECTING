import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function stableHash(value) {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `vck_${(hash >>> 0).toString(16).padStart(8, "0")}`;
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

async function importProjectStoreIo() {
  const projectStoreSource = fs.readFileSync("src/core/projectStore.ts", "utf8");
  const projectStoreOutput = ts.transpileModule(projectStoreSource, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: "src/core/projectStore.ts",
  }).outputText;
  const projectStoreUrl = `data:text/javascript;base64,${Buffer.from(`${projectStoreOutput}\n//# sourceURL=${pathToFileURL("src/core/projectStore.ts").href}`).toString("base64")}`;

  const projectStoreIoSource = fs.readFileSync("src/core/projectStoreIo.ts", "utf8");
  const projectStoreIoOutput = ts.transpileModule(projectStoreIoSource, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: "src/core/projectStoreIo.ts",
  }).outputText.replaceAll('from "./projectStore";', `from "${projectStoreUrl}";`);
  const encoded = Buffer.from(`${projectStoreIoOutput}\n//# sourceURL=${pathToFileURL("src/core/projectStoreIo.ts").href}`).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

class MemoryProjectAdapter {
  constructor() {
    this.files = new Map();
    this.directories = new Set();
  }

  mkdir(path) {
    this.directories.add(path);
  }

  readFile(path) {
    if (!this.files.has(path)) throw new Error(`missing file ${path}`);
    return this.files.get(path);
  }

  writeFile(path, content) {
    this.files.set(path, content);
  }
}

function cloneAdapter(adapter) {
  const clone = new MemoryProjectAdapter();
  clone.files = new Map(adapter.files);
  clone.directories = new Set(adapter.directories);
  return clone;
}

const projectStore = await importTs("src/core/projectStore.ts");
const projectStoreIo = await importProjectStoreIo();

const generatedAt = "2026-05-01T00:00:00.000Z";
const snapshot = projectStore.createProjectStoreSnapshot({
  generatedAt,
  projectId: "phase_19_project",
  title: "Phase 19 IO Project",
  version: "0.19.0",
  productionBible: {
    schemaVersion: "0.1.0",
    id: "phase_19_bible",
    title: "Phase 19 IO Project",
  },
  storyFlow: {
    schemaVersion: "0.1.0",
    id: "phase_19_story",
    sectionModel: "adaptive",
    sections: [
      {
        id: "opening",
        label: "Opening",
        sectionKind: "custom",
        sequenceIndex: 0,
        storyFunction: "Open the scene.",
        beats: [],
        shots: [{ id: "shot_001", shotSpecId: "shot_001", storyFunction: "Open the scene.", status: "planned" }],
      },
    ],
    shotOrder: ["shot_001"],
    sourceRefs: ["phase19"],
    updatedAt: generatedAt,
  },
  shotSpecs: [
    {
      shotId: "shot_001",
      value: {
        schemaVersion: "0.1.0",
        id: "shot_001",
        storyFunction: "Open the scene.",
        action: "A character enters the room.",
      },
    },
  ],
  sourceIndex: {
    projectId: "phase_19_project",
    projectVersion: "0.19.0",
    sourceIndexHash: "phase19_source_hash",
  },
});

const createGate = projectStoreIo.buildProjectStoreIoGate({
  mode: "create",
  snapshot,
  generatedAt,
  runtimeState: {
    schemaVersion: "0.1.0",
    role: "runtime_state_fixture",
    derivedFrom: "phase19_source_hash",
  },
});

assert(createGate.phase === "phase19_real_project_store_io_gate", "phase id drifted");
assert(createGate.fileMutationScope === "project_root_whitelist", "file mutation scope must be project root whitelist");
assert(createGate.projectVibeWriteAllowed === true, "project.vibe write should be allowed by Phase 19 gate");
assert(createGate.runtimeStateWriteAllowed === true, "runtime-state cache write should be allowed by Phase 19 gate");
assert(createGate.directoryCreateAllowed === true, "directory creation should be allowed inside project root");
assert(createGate.canExecute === true, `create gate should execute: ${createGate.blockers.join("; ")}`);
assert(createGate.whitelist.includes("project.vibe"), "project.vibe must be whitelisted");
assert(createGate.whitelist.includes("runtime-state.json"), "runtime-state cache path must be whitelisted");
assert(createGate.whitelist.every((path) => !/^(?:[A-Za-z]:[\\/]|\/|\/\/)/.test(path)), "whitelist must not include absolute paths");
assert(createGate.entries.some((entry) => entry.operation === "create_directory" && entry.path === "shots/shot_001"), "shot directory must be planned");
assert(createGate.entries.some((entry) => entry.operation === "write_file" && entry.path === "project.vibe"), "project.vibe write entry missing");
assert(createGate.entries.some((entry) => entry.operation === "write_file" && entry.path === "runtime-state.json"), "runtime-state cache write entry missing");

for (const key of [
  "projectRootOnly",
  "whitelistOnly",
  "noAbsoluteContractPath",
  "noParentTraversal",
  "noUserFileMove",
  "noDelete",
  "noProviderSubmit",
  "noImageGeneration",
  "noVideoGeneration",
  "noCredentialRead",
  "noCredentialWrite",
  "noArbitraryShell",
  "runtimeStateIsDerivedCache",
]) {
  assert(createGate.hardLocks[key] === true, `hard lock ${key} must be true`);
}

const adapter = new MemoryProjectAdapter();
const createResult = await projectStoreIo.executeProjectStoreIoGate(createGate, adapter);
assert(createResult.ok, `create execution should pass: ${createResult.errors.join("; ")}`);
assert(adapter.files.has("project.vibe"), "project.vibe should be written through adapter");
assert(adapter.files.has("story_flow/story_flow.vibe.json"), "story_flow should be written through adapter");
assert(adapter.files.has("visual_memory/visual_memory.vibe.json"), "visual_memory should be written through adapter");
assert(adapter.files.has("shots/shot_001/shot_spec.vibe.json"), "shot spec should be written through adapter");
assert(adapter.files.has("runtime-state.json"), "runtime-state derived cache should be written through adapter");

const projectVibe = JSON.parse(adapter.files.get("project.vibe"));
assert(projectVibe.kind === "vibe_project_file", "project.vibe kind must be vibe_project_file");
assert(projectVibe.runtimeStateRole === "derived_cache", "project.vibe must mark runtime-state as derived cache");
assert(projectVibe.projectStoreSnapshot.projectFile.fileName === "project.vibe", "project.vibe must contain project store snapshot");

const openGate = projectStoreIo.buildProjectStoreIoGate({
  mode: "open",
  serializedProjectVibe: adapter.files.get("project.vibe"),
  generatedAt: "2026-05-01T00:01:00.000Z",
});
assert(openGate.canExecute, `open gate should execute: ${openGate.blockers.join("; ")}`);
const openResult = await projectStoreIo.executeProjectStoreIoGate(openGate, adapter);
assert(openResult.ok, `open execution should pass: ${openResult.errors.join("; ")}`);
assert(openResult.openedSnapshot.project.id === "phase_19_project", "open should recover snapshot project id");
assert(openResult.validation.ok, "opened snapshot should validate");

const tamperedWriteGate = structuredClone(createGate);
tamperedWriteGate.whitelist.push("arbitrary/outside.json");
tamperedWriteGate.entries.push({
  id: "write_arbitrary_outside",
  role: "source_index",
  operation: "write_file",
  path: "arbitrary/outside.json",
  content: "{}\n",
  contentHash: stableHash("{}\n"),
  canExecute: true,
  projectRootRelative: true,
  notes: ["Tampered external whitelist must not expand executor authority."],
});
const tamperedWriteAdapter = new MemoryProjectAdapter();
const tamperedWriteResult = await projectStoreIo.executeProjectStoreIoGate(tamperedWriteGate, tamperedWriteAdapter);
assert(!tamperedWriteResult.ok, "tampered self-whitelist arbitrary write must fail closed");
assert(!tamperedWriteAdapter.files.has("arbitrary/outside.json"), "tampered arbitrary write must not reach adapter");
assert(tamperedWriteResult.errors.some((error) => error.includes("canonical Project Store IO plan") || error.includes("canonical Project Store fact file paths")), "tampered write error must cite canonical plan/paths");

const tamperedMkdirGate = structuredClone(createGate);
tamperedMkdirGate.entries.push({
  id: "mkdir_arbitrary_outside",
  role: "project_directory",
  operation: "create_directory",
  path: "arbitrary",
  canExecute: true,
  projectRootRelative: true,
  notes: ["Tampered directory creation must not expand executor authority."],
});
const tamperedMkdirAdapter = new MemoryProjectAdapter();
const tamperedMkdirResult = await projectStoreIo.executeProjectStoreIoGate(tamperedMkdirGate, tamperedMkdirAdapter);
assert(!tamperedMkdirResult.ok, "non-whitelist mkdir must fail closed");
assert(!tamperedMkdirAdapter.directories.has("arbitrary"), "non-whitelist mkdir must not reach adapter");
assert(tamperedMkdirResult.errors.some((error) => error.includes("canonical Project Store IO plan") || error.includes("canonical directory allowlist")), "non-whitelist mkdir error must cite canonical directory allowlist");

const contentHashDriftGate = structuredClone(createGate);
const storyFlowWrite = contentHashDriftGate.entries.find((entry) => entry.operation === "write_file" && entry.path === "story_flow/story_flow.vibe.json");
storyFlowWrite.content = storyFlowWrite.content.replace("Open the scene.", "Tampered scene.");
const contentHashDriftResult = await projectStoreIo.executeProjectStoreIoGate(contentHashDriftGate, new MemoryProjectAdapter());
assert(!contentHashDriftResult.ok, "contentHash drift must fail closed");
assert(contentHashDriftResult.errors.some((error) => error.includes("contentHash does not match entry content")), "contentHash drift error missing");

const blockedRuntimeGate = projectStoreIo.buildProjectStoreIoGate({
  mode: "create",
  snapshot,
  generatedAt,
  runtimeState: {
    runtimeStateIsSoleSourceOfTruth: true,
    token: "blocked-token",
  },
});
assert(blockedRuntimeGate.canExecute === false, "runtime-state sole-source/secret input must block gate creation");
const blockedRuntimeResult = await projectStoreIo.executeProjectStoreIoGate(blockedRuntimeGate, new MemoryProjectAdapter());
assert(!blockedRuntimeResult.ok, "runtime-state sole-source/secret gate must fail execution");
assert(blockedRuntimeResult.errors.some((error) => error.includes("runtimeStateIsSoleSourceOfTruth") || error.includes("token")), "runtime-state secret/sole-source error missing");

const tamperedRuntimeGate = structuredClone(createGate);
const runtimeWrite = tamperedRuntimeGate.entries.find((entry) => entry.operation === "write_file" && entry.path === "runtime-state.json");
runtimeWrite.content = JSON.stringify({ runtimeStateRole: "project_fact", runtimeStateIsSoleSourceOfTruth: true, secret: "blocked" }, null, 2) + "\n";
runtimeWrite.contentHash = stableHash(runtimeWrite.content);
const tamperedRuntimeResult = await projectStoreIo.executeProjectStoreIoGate(tamperedRuntimeGate, new MemoryProjectAdapter());
assert(!tamperedRuntimeResult.ok, "tampered runtime-state content must fail closed");
assert(tamperedRuntimeResult.errors.some((error) => error.includes("runtime-state") || error.includes("runtimeStateIsSoleSourceOfTruth") || error.includes("secret")), "tampered runtime-state error missing");

const malformedOpenGate = projectStoreIo.buildProjectStoreIoGate({
  mode: "open",
  serializedProjectVibe: "{",
  generatedAt: "2026-05-01T00:01:30.000Z",
});
assert(malformedOpenGate.canExecute === false, "malformed project.vibe must build a blocked open gate instead of throwing");
const malformedOpenAdapter = cloneAdapter(adapter);
malformedOpenAdapter.files.set("project.vibe", "{");
const malformedOpenResult = await projectStoreIo.executeProjectStoreIoGate(openGate, malformedOpenAdapter);
assert(!malformedOpenResult.ok, "malformed project.vibe must become an execution error");
assert(malformedOpenResult.errors.some((error) => error.includes("valid JSON")), "malformed project.vibe parse error missing");

const invalidProjectVibeAdapter = cloneAdapter(adapter);
const invalidProjectVibe = JSON.parse(invalidProjectVibeAdapter.files.get("project.vibe"));
invalidProjectVibe.projectStoreSnapshot.projectFile.status = "written";
invalidProjectVibeAdapter.files.set("project.vibe", JSON.stringify(invalidProjectVibe, null, 2) + "\n");
const invalidOpenResult = await projectStoreIo.executeProjectStoreIoGate(openGate, invalidProjectVibeAdapter);
assert(!invalidOpenResult.ok, "open validation errors must make execution fail");
assert(invalidOpenResult.validation && invalidOpenResult.validation.ok === false, "invalid project.vibe validation should be returned");
assert(invalidOpenResult.errors.some((error) => error.includes("project.vibe must remain fixture-only")), "open validation error missing from execution errors");

const sidecarMismatchAdapter = cloneAdapter(adapter);
const storyFlowSidecar = JSON.parse(sidecarMismatchAdapter.files.get("story_flow/story_flow.vibe.json"));
storyFlowSidecar.sections[0].label = "Tampered Opening";
sidecarMismatchAdapter.files.set("story_flow/story_flow.vibe.json", JSON.stringify(storyFlowSidecar, null, 2) + "\n");
const sidecarMismatchResult = await projectStoreIo.executeProjectStoreIoGate(openGate, sidecarMismatchAdapter);
assert(!sidecarMismatchResult.ok, "sidecar hash mismatch must fail open execution");
assert(sidecarMismatchResult.errors.some((error) => error.includes("story_flow/story_flow.vibe.json hash mismatch")), "sidecar hash mismatch error missing");

const corruptSidecarAdapter = cloneAdapter(adapter);
corruptSidecarAdapter.files.set("visual_memory/visual_memory.vibe.json", "{");
const corruptSidecarResult = await projectStoreIo.executeProjectStoreIoGate(openGate, corruptSidecarAdapter);
assert(!corruptSidecarResult.ok, "corrupt sidecar JSON must fail open execution");
assert(corruptSidecarResult.errors.some((error) => error.includes("visual_memory/visual_memory.vibe.json must be valid JSON")), "corrupt sidecar parse error missing");

const saveGate = projectStoreIo.buildProjectStoreIoGate({
  mode: "save",
  snapshot: projectStore.applyProjectStorePatch(snapshot, {
    id: "phase19_patch",
    appliedAt: "2026-05-01T00:02:00.000Z",
    operations: [{ op: "set_project_version", version: "0.19.1" }],
  }).snapshot,
  generatedAt: "2026-05-01T00:02:00.000Z",
});
assert(saveGate.canExecute, "save gate should execute");
assert(saveGate.projectVibeWriteAllowed === true, "save gate should allow project.vibe write");
const saveResult = await projectStoreIo.executeProjectStoreIoGate(saveGate, adapter);
assert(saveResult.ok, `save execution should pass: ${saveResult.errors.join("; ")}`);
assert(JSON.parse(adapter.files.get("project.vibe")).projectStoreSnapshot.project.version === "0.19.1", "save should update project version");

const unsafeSnapshot = structuredClone(snapshot);
unsafeSnapshot.factFiles[0].path.path = "../outside/project.vibe";
const blockedGate = projectStoreIo.buildProjectStoreIoGate({
  mode: "save",
  snapshot: unsafeSnapshot,
  generatedAt,
});
assert(blockedGate.canExecute === false, "unsafe path must block execution");
assert(blockedGate.projectVibeWriteAllowed === false, "blocked gate must not allow project.vibe writes");
assert(blockedGate.blockers.some((blocker) => blocker.includes("parent traversal") || blocker.includes("Unsafe project path")), "unsafe blocker missing");
const blockedResult = await projectStoreIo.executeProjectStoreIoGate(blockedGate, adapter);
assert(!blockedResult.ok, "blocked gate execution must fail closed");
assert(blockedResult.executed.length === 0, "blocked gate must execute nothing");

const schema = readJson("schemas/project_store_io.schema.json");
assert(schema.properties.phase.const === "phase19_real_project_store_io_gate", "schema phase const missing");
for (const [key, value] of Object.entries(createGate.hardLocks)) {
  assert(schema.$defs.hardLocks.properties[key].const === value, `schema hard lock ${key} drifted`);
}

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("project_store_io.schema.json"), "schema registry must include project_store_io.schema.json");

const packageJson = readJson("package.json");
assert(packageJson.scripts["project-store-io:test"] === "node scripts/project-store-io-test.mjs", "project-store-io:test script missing");

console.log(
  `Project Store IO tests passed: ${createGate.entries.length} entries, ${createResult.executed.length} executed, whitelist=${createGate.whitelist.length}.`,
);
