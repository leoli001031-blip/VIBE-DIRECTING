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

class MemoryExportAdapter {
  constructor() {
    this.files = new Map();
    this.directories = new Set();
  }

  mkdir(path) {
    this.directories.add(path);
  }

  writeFile(path, content) {
    this.files.set(path, content);
  }
}

function previewEvent(id, shotId, startSeconds, durationSeconds, mediaPath) {
  return {
    id,
    mode: "formal_preview",
    type: "video_clip",
    shotId,
    startSeconds,
    durationSeconds,
    mediaPath,
    qaStatus: "PASS",
  };
}

function profile(kind, readiness = "ready", includedPaths = []) {
  return {
    schemaVersion: "0.1.0",
    profileId: `export_builder_${kind}`,
    kind,
    label: kind,
    readiness,
    includedCategories: [kind],
    includedPaths,
    blockedReasons: [],
    notes: [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  };
}

const exportWorker = await importTs("src/core/exportWorker.ts");
const generatedAt = "2026-05-01T00:00:00.000Z";
const events = [
  previewEvent("formal_s01", "S01", 0, 4, "outputs/videos/S01.mp4"),
  previewEvent("formal_s02", "S02", 4, 5, "outputs/videos/S02.mp4"),
];
const source = {
  schemaVersion: "0.1.0",
  generatedAt,
  draftPreview: {
    schemaVersion: "0.1.0",
    planId: "draft_preview",
    mode: "draft_preview",
    status: "draft_only",
    summary: {
      mode: "draft_preview",
      status: "draft_only",
      eventCount: events.length,
      videoClipCount: events.length,
      imageHoldCount: 0,
      blockedPlaceholderCount: 0,
      totalDurationSeconds: 9,
      blockedShotIds: [],
      blockedReasons: [],
    },
    events: events.map((event) => ({ ...event, mode: "draft_preview", id: event.id.replace("formal", "draft") })),
    blockedReasons: [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  },
  formalPreview: {
    schemaVersion: "0.1.0",
    planId: "formal_preview",
    mode: "formal_preview",
    status: "ready",
    summary: {
      mode: "formal_preview",
      status: "ready",
      eventCount: events.length,
      videoClipCount: events.length,
      imageHoldCount: 0,
      blockedPlaceholderCount: 0,
      totalDurationSeconds: 9,
      blockedShotIds: [],
      blockedReasons: [],
    },
    events,
    blockedReasons: [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  },
  formalPreviewGate: {
    status: "pass",
    requiredChecks: {
      noBlockedMaterial: true,
      pairQaPass: true,
      videoQaPass: true,
      manifestMatched: true,
      promotionPassed: true,
      noP0Issues: true,
      noUnknownGate: true,
      videoPresent: true,
    },
    blockedReasons: [],
  },
  roughCutProxy: {
    status: "ready",
    sourcePreviewPlanId: "formal_preview",
    totalDurationSeconds: 9,
    eventCount: 2,
    proxyOnly: true,
    notes: [],
  },
  exportProfiles: [
    profile("rough_cut", "ready", ["outputs/videos/S01.mp4", "outputs/videos/S02.mp4"]),
    profile("asset_package", "ready", ["outputs/keyframes/S01_start.png", "outputs/videos/S01.mp4"]),
    profile("storyboard_table", "ready"),
    profile("developer_archive", "ready", ["prompts/S01.md", "qa/S01.json"]),
  ],
  exportPackagePlan: {
    schemaVersion: "0.1.0",
    planId: "export_builder_package_plan",
    status: "ready",
    profiles: [],
    futureTargets: ["fcpxml_future_slot", "edl_future_slot", "premiere_pro_future_slot", "jianying_future_slot", "davinci_resolve_future_slot"],
    blockedReasons: [],
    notes: [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  },
  phase: "phase_12_preview_export_builder",
  futureTargets: [
    { target: "fcpxml", status: "future_placeholder", enabled: false, writesFile: false, notes: [] },
    { target: "edl", status: "future_placeholder", enabled: false, writesFile: false, notes: [] },
    { target: "premiere_pro", status: "future_placeholder", enabled: false, writesFile: false, notes: [] },
    { target: "jianying", status: "future_placeholder", enabled: false, writesFile: false, notes: [] },
    { target: "davinci_resolve", status: "future_placeholder", enabled: false, writesFile: false, notes: [] },
  ],
};
source.exportPackagePlan.profiles = source.exportProfiles;

const plannedState = exportWorker.buildExportWorkerState({
  source,
  exportRoot: "exports/current",
  generatedAt,
  profileSelection: "all",
});

assert(plannedState.phase === "phase_27_export_worker_mvp", "phase id drifted");
assert(plannedState.scope === "export_project_io_contract", "scope must be export/project IO contract");
assert(plannedState.readiness === "planned", "plan-only ready source should produce planned state");
assert(plannedState.canExecute === false, "plan-only state must not execute");
for (const key of [
  "projectRootRelativeOnly",
  "exportScopeOnly",
  "noAbsolutePath",
  "noParentTraversal",
  "noDelete",
  "noMove",
  "noMediaRender",
  "noProviderSubmit",
  "noCredentialRead",
  "noCredentialWrite",
  "noArbitraryShell",
  "noUserFileOverwriteOutsideExport",
]) {
  assert(plannedState.hardLocks[key] === true, `hard lock ${key} must be true`);
}
assert(plannedState.hardLocks.liveSubmitAllowed === false, "live submit must remain false");

const writePaths = plannedState.entries.filter((entry) => entry.operation === "write_file").map((entry) => entry.path).sort();
assert(writePaths.includes("exports/current/export_manifest.json"), "export manifest write missing");
assert(writePaths.includes("exports/current/storyboard_table.tsv"), "storyboard table write missing");
assert(writePaths.includes("exports/current/developer_archive.json"), "developer archive write missing");
assert(writePaths.includes("exports/current/rough_cut_timeline.json"), "rough cut timeline write missing");
assert(writePaths.includes("exports/current/asset_package_manifest.json"), "asset package manifest write missing");
assert(plannedState.entries.every((entry) => entry.path === "exports" || entry.path.startsWith("exports/")), "planned entries must stay inside exports/");
assert(plannedState.entries.every((entry) => entry.operation === "create_directory" || entry.operation === "write_file"), "only mkdir/write entries are allowed");

const executableState = exportWorker.buildExportWorkerState({
  source,
  exportRoot: "reports/exports/current",
  generatedAt,
  profileSelection: "all",
  executionMode: "adapter_execution",
  confirmation: true,
});
assert(executableState.readiness === "ready", `executable state should be ready: ${executableState.blockers.join("; ")}`);
assert(executableState.canExecute === true, "confirmed adapter execution should be executable");

const adapter = new MemoryExportAdapter();
const result = await exportWorker.executeExportWorkerPlan(executableState, adapter);
assert(result.ok, `execution should pass: ${result.errors.join("; ")}`);
assert(result.executed.length === executableState.entries.length, "every planned entry should execute");
assert(adapter.directories.has("reports/exports/current"), "export directory should be created through adapter");
for (const entry of executableState.entries.filter((item) => item.operation === "write_file")) {
  assert(adapter.files.has(entry.path), `${entry.path} should be written through adapter`);
  assert(stableHash(adapter.files.get(entry.path)) === entry.contentHash, `${entry.path} contentHash must align with written content`);
  assert(entry.path.startsWith("reports/exports/current/"), `${entry.path} must stay in allowlisted export root`);
}
assert(adapter.files.size === 5, "only the five allowlisted text manifests should be written");

const absoluteRoot = exportWorker.buildExportWorkerState({ source, exportRoot: "/tmp/exports/current", generatedAt, executionMode: "adapter_execution", confirmation: true });
assert(absoluteRoot.readiness === "blocked", "absolute export root must be blocked");
assert(absoluteRoot.blockers.some((blocker) => blocker.includes("project-root-relative")), "absolute path blocker missing");
assert(!(await exportWorker.executeExportWorkerPlan(absoluteRoot, new MemoryExportAdapter())).ok, "absolute path execution must fail closed");

const traversalRoot = exportWorker.buildExportWorkerState({ source, exportRoot: "exports/../outside", generatedAt, executionMode: "adapter_execution", confirmation: true });
assert(traversalRoot.readiness === "blocked", "parent traversal export root must be blocked");
assert(traversalRoot.blockers.some((blocker) => blocker.includes("project-root-relative")), "parent traversal blocker missing");

const outsideRoot = exportWorker.buildExportWorkerState({ source, exportRoot: "artifacts/current", generatedAt, executionMode: "adapter_execution", confirmation: true });
assert(outsideRoot.readiness === "blocked", "outside export scope root must be blocked");
assert(outsideRoot.blockers.some((blocker) => blocker.includes("exports/ or reports/exports/")), "outside export scope blocker missing");

const tamperedEntry = structuredClone(executableState);
const storyboardWrite = tamperedEntry.entries.find((entry) => entry.path.endsWith("storyboard_table.tsv"));
storyboardWrite.content = `${storyboardWrite.content}tampered\n`;
const tamperedEntryResult = await exportWorker.executeExportWorkerPlan(tamperedEntry, new MemoryExportAdapter());
assert(!tamperedEntryResult.ok, "tampered content must fail closed");
assert(tamperedEntryResult.errors.some((error) => error.includes("contentHash does not match")), "tampered content hash error missing");

const tamperedPath = structuredClone(executableState);
tamperedPath.entries.push({
  id: "write_outside",
  kind: "developer_archive",
  operation: "write_file",
  path: "exports/current/not_allowed.txt",
  content: "not allowed\n",
  contentHash: stableHash("not allowed\n"),
  mimeType: "application/json",
  canExecute: true,
  projectRootRelative: true,
  notes: [],
});
const tamperedPathAdapter = new MemoryExportAdapter();
const tamperedPathResult = await exportWorker.executeExportWorkerPlan(tamperedPath, tamperedPathAdapter);
assert(!tamperedPathResult.ok, "tampered extra path must fail closed");
assert(!tamperedPathAdapter.files.has("exports/current/not_allowed.txt"), "tampered path must not reach adapter");
assert(tamperedPathResult.errors.some((error) => error.includes("allowlisted") || error.includes("allowed")), "tampered path allowlist error missing");

const tamperedHardLock = structuredClone(executableState);
tamperedHardLock.hardLocks.noProviderSubmit = false;
const tamperedHardLockResult = await exportWorker.executeExportWorkerPlan(tamperedHardLock, new MemoryExportAdapter());
assert(!tamperedHardLockResult.ok, "tampered hard lock must fail closed");
assert(tamperedHardLockResult.errors.some((error) => error.includes("hard lock noProviderSubmit")), "tampered hard lock error missing");

const providerSubmit = exportWorker.buildExportWorkerState({ source, exportRoot: "exports/current", generatedAt, providerSubmitRequested: true });
assert(providerSubmit.readiness === "blocked", "provider submit request must block");
const credentialRead = exportWorker.buildExportWorkerState({ source, exportRoot: "exports/current", generatedAt, credentialReadRequested: true });
assert(credentialRead.readiness === "blocked", "credential read request must block");
const credentialWrite = exportWorker.buildExportWorkerState({ source, exportRoot: "exports/current", generatedAt, credentialWriteRequested: true });
assert(credentialWrite.readiness === "blocked", "credential write request must block");
const credentialSource = exportWorker.buildExportWorkerState({ source: { ...source, apiKey: "blocked" }, exportRoot: "exports/current", generatedAt });
assert(credentialSource.readiness === "blocked", "credential key in source must block");
const shell = exportWorker.buildExportWorkerState({ source, exportRoot: "exports/current", generatedAt, arbitraryShellRequested: true });
assert(shell.readiness === "blocked", "arbitrary shell request must block");
const render = exportWorker.buildExportWorkerState({ source, exportRoot: "exports/current", generatedAt, mediaRenderRequested: true });
assert(render.readiness === "blocked", "media render request must block");
const copyMoveDelete = exportWorker.buildExportWorkerState({ source, exportRoot: "exports/current", generatedAt, requestedOperations: ["copy_file", "move_file", "delete_file", "render_media"] });
assert(copyMoveDelete.readiness === "blocked", "copy/move/delete/render operations must block");
const liveSubmit = exportWorker.buildExportWorkerState({ source, exportRoot: "exports/current", generatedAt, liveSubmitRequested: true });
assert(liveSubmit.readiness === "blocked", "live submit request must block");
const futureNle = exportWorker.buildExportWorkerState({ source, exportRoot: "exports/current", generatedAt, futureNleTargetRequested: true });
assert(futureNle.readiness === "blocked", "future NLE generation request must block");
const enabledFutureTarget = structuredClone(source);
enabledFutureTarget.futureTargets[0].enabled = true;
const enabledFutureState = exportWorker.buildExportWorkerState({ source: enabledFutureTarget, exportRoot: "exports/current", generatedAt });
assert(enabledFutureState.readiness === "blocked", "enabled future NLE target must block");
assert(!executableState.entries.some((entry) => /\.(fcpxml|edl|prproj|drp|xml)$/i.test(entry.path)), "future NLE files must not be generated");

const schema = readJson("schemas/export_worker.schema.json");
assert(schema.properties.phase.const === "phase_27_export_worker_mvp", "schema phase const missing");
assert(schema.properties.scope.const === "export_project_io_contract", "schema scope const missing");
assert(schema.$defs.operation.enum.length === 2, "schema must allow only create_directory/write_file");
for (const [key, expected] of Object.entries(executableState.hardLocks)) {
  assert(schema.$defs.hardLocks.properties[key].const === expected, `schema hard lock ${key} drifted`);
}

const sourceText = fs.readFileSync("src/core/exportWorker.ts", "utf8");
for (const forbidden of [
  /from\s+["']node:fs["']/,
  /from\s+["']fs["']/,
  /child_process/,
  /\bspawn\s*\(/,
  /\bexec(?:File|Sync)?\s*\(/,
  /\bfetch\s*\(/,
  /fs\.(?:writeFile|writeFileSync|mkdir|mkdirSync)\s*\(/,
]) {
  assert(!forbidden.test(sourceText), `exportWorker source contains forbidden runtime primitive: ${forbidden}`);
}

console.log(
  `Export Worker tests passed: ${executableState.entries.length} entries, ${result.executed.length} executed, ${adapter.files.size} text manifest(s).`,
);
