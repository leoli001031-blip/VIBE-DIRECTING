import fs from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
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

async function importBetaAcceptance() {
  const desktopRuntimeUrl = dataUrl("src/core/desktopRuntime.ts", transpile("src/core/desktopRuntime.ts"));
  const betaOutput = transpile("src/core/betaAcceptance.ts")
    .replace(/from "\.\/desktopRuntime";/g, `from "${desktopRuntimeUrl}";`);
  return import(dataUrl("src/core/betaAcceptance.ts", betaOutput));
}

const {
  betaAcceptanceExpectedScripts,
  betaAcceptanceHardLocks,
  buildBetaAcceptanceState,
} = await importBetaAcceptance();

const generatedAt = "2026-05-07T00:00:00.000Z";
const packageJson = readJson("package.json");
const packageScripts = packageJson.scripts;

function projectFileCore(overrides = {}) {
  return {
    projectFileFactSourceReceipt: {
      projectVibeEntry: { path: "project.vibe" },
      projectFactFiles: [
        { role: "project_manifest", canonicalPath: "project.vibe", projectRootRelative: true },
        { role: "story_flow", canonicalPath: "story_flow/story_flow.vibe.json", projectRootRelative: true },
        { role: "visual_memory", canonicalPath: "visual_memory/visual_memory.vibe.json", projectRootRelative: true },
      ],
      saveOpenContract: {
        projectRootRelativeRequired: true,
        absolutePathsBlocked: true,
        parentTraversalBlocked: true,
        userFileMoveDeleteBlocked: true,
        credentialTokenSecretWriteBlocked: true,
      },
      runtimeStateDerivedCache: {
        mayBeRebuiltFromProjectFiles: true,
        mayOverwriteProjectFiles: false,
      },
    },
    plannedFileTree: [
      { path: "project.vibe", pathOrigin: "project_root_relative" },
      { path: "story_flow/story_flow.vibe.json", pathOrigin: "project_root_relative" },
      { path: "visual_memory/visual_memory.vibe.json", pathOrigin: "project_root_relative" },
    ],
    sourceOfTruthPriority: [
      {
        role: "project_manifest",
        runtimeStateMayOverride: false,
        importedSourceRefs: [{ path: "project.vibe" }],
      },
      {
        role: "runtime_state",
        runtimeStateMayOverride: false,
        importedSourceRefs: [{ path: "runtime-state.json" }],
      },
    ],
    hardLocks: {
      dryRunOnly: true,
      readOnly: true,
      noFileMutation: true,
      noProviderSubmit: true,
      noCredentialRead: true,
      noCredentialWrite: true,
      projectVibeWriteAllowed: false,
      runtimeStateIsDerivedCache: true,
    },
    ...overrides,
  };
}

function previewExport() {
  return {
    draftPreview: { status: "ready", events: [] },
    formalPreview: { status: "blocked", events: [] },
    exportProfiles: [
      { kind: "rough_cut" },
      { kind: "asset_package" },
      { kind: "storyboard_table" },
      { kind: "developer_archive" },
    ],
    exportPackagePlan: { status: "planned" },
  };
}

function exportWorker(overrides = {}) {
  return {
    executionMode: "plan_only",
    canExecute: false,
    exportRoot: "exports/export-worker",
    hardLocks: {
      projectRootRelativeOnly: true,
      exportScopeOnly: true,
      noAbsolutePath: true,
      noParentTraversal: true,
      noProviderSubmit: true,
      liveSubmitAllowed: false,
      noCredentialRead: true,
      noCredentialWrite: true,
      noArbitraryShell: true,
    },
    ...overrides,
  };
}

function localOrchestrator(overrides = {}) {
  return {
    summary: {
      totalItems: 1,
      ready: 1,
      waiting: 0,
      blocked: 0,
      completeVerified: 0,
    },
    queue: [{ queueItemId: "queue_1" }],
    sourceCoverage: [{ layer: "task_packet", referenced: true, referenceCount: 1, sourceRefs: ["taskPacket:1"] }],
    hardLocks: {
      dryRunOnly: true,
      planOnly: true,
      noDaemon: true,
      daemonStarted: false,
      noSpawnCodex: true,
      noShellExecution: true,
      noProviderExecution: true,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      noFileMutation: true,
      noCredentialRead: true,
      noCredentialWrite: true,
    },
    ...overrides,
  };
}

function codexWorkerRuntimeGate(overrides = {}) {
  return {
    hardLocks: {
      noSpawnCodex: true,
      noShellExecution: true,
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      noCredentialRead: true,
      noCredentialWrite: true,
      credentialAccessAllowed: false,
      credentialStorage: false,
      noFileMutation: true,
    },
    ...overrides,
  };
}

function providerClosedLoopShell(overrides = {}) {
  return {
    hardLocks: {
      dryRunOnly: true,
      readOnly: true,
      planOnly: true,
      noActualProviderSubmit: true,
      noLiveSubmit: true,
      noCredentialRead: true,
      noCredentialWrite: true,
      credentialAccessAllowed: false,
      credentialStorage: false,
      noApiKeyCreation: true,
      noWorkerSpawn: true,
      noShellExecution: true,
      noFileMutation: true,
    },
    ...overrides,
  };
}

function runtimeState(overrides = {}) {
  return {
    projectFileCore: projectFileCore(),
    previewExport: previewExport(),
    exportWorker: exportWorker(),
    localOrchestrator: localOrchestrator(),
    projectFactsIntegration: { summary: { ready: true } },
    visualMemory: { assets: [{ id: "asset_locked_hero", lockedStatus: "locked" }] },
    storyFlow: { shots: [{ id: "S01" }] },
    imageKeyframeRuntime: { phase: "phase_17_image_keyframe_runtime" },
    knowledge: {
      manifestHash: "knowledge_manifest_hash",
      manifestVersion: "0.1.0",
      bindings: [
        {
          packId: "core-composition",
          version: "0.1.0",
          hash: "pack_hash",
          category: "composition",
        },
      ],
      routeTest: {
        routeResult: { routeId: "route_1" },
        contextBudget: { budgetId: "budget_1" },
      },
    },
    codexWorkerRuntimeGate: codexWorkerRuntimeGate(),
    providerClosedLoopShell: providerClosedLoopShell(),
    providerLiveGate: {
      summary: {
        providerSubmitAllowed: 0,
        liveSubmitAllowed: false,
        credentialStorage: false,
      },
    },
    providerExecutionHandoff: {
      summary: {
        providerSubmitAllowed: 0,
        liveSubmitAllowed: false,
        credentialAccessAllowed: false,
        canSpawnWorker: false,
        fileMutationAllowed: false,
      },
    },
    ...overrides,
  };
}

const accepted = buildBetaAcceptanceState({
  generatedAt,
  runtimeState: runtimeState(),
  packageScripts,
});

assert(accepted.phaseId === "phase_42_export_desktop_beta_acceptance", "phase id must be Phase 42 beta acceptance");
assert(accepted.finalPhaseNumber === 42, "final phase number must be 42");
assert(accepted.noAdditionalPhasesPlanned === true, "noAdditionalPhasesPlanned must be true");
assert(accepted.betaAcceptanceOwnsClosure === true, "beta acceptance must own closure");
assert(accepted.readiness === "accepted", `accepted fixture should pass: ${accepted.blockers.join("; ")}`);
assert(accepted.validation.ok === true, "accepted fixture validation must be ok");
assert(accepted.desktopPlans.darwin.platform === "darwin", "darwin desktop plan must be present");
assert(accepted.desktopPlans.win32.platform === "win32", "win32 desktop plan must be present");
assert(accepted.desktopPlans.darwin.projectPermissionScope.rawPathPersisted === false, "darwin raw paths must not persist");
assert(accepted.desktopPlans.win32.sidecarAllowlist.sidecarSpawnAllowedNow === false, "windows sidecar must be locked");
assert(accepted.summary.requiredAreaCount === 10, "all ten acceptance areas must be present");
assert(accepted.areas.every((area) => area.required === true), "every acceptance area must be required");

for (const [key, value] of Object.entries(betaAcceptanceHardLocks)) {
  assert(accepted.hardLocks[key] === value, `hard lock drift in accepted fixture: ${key}`);
}

for (const script of betaAcceptanceExpectedScripts) {
  assert(packageScripts[script], `package script missing: ${script}`);
  assert(
    accepted.testMatrix.some((item) => item.script === script && item.present === true),
    `test matrix missing present package script: ${script}`,
  );
}

const missingArea = buildBetaAcceptanceState({
  generatedAt,
  runtimeState: runtimeState({ projectFileCore: undefined }),
  packageScripts,
});
assert(missingArea.readiness === "blocked", "missing project file core must block beta acceptance");
assert(
  missingArea.blockers.some((blocker) => blocker.includes("project_save_open:project_file_core_missing")),
  "missing project file core blocker must be explicit",
);

const driftedHardLock = buildBetaAcceptanceState({
  generatedAt,
  runtimeState: runtimeState(),
  packageScripts,
  hardLocksOverride: { noFileMutation: false },
});
assert(driftedHardLock.readiness === "blocked", "hard lock drift must block beta acceptance");
assert(
  driftedHardLock.blockers.includes("beta_acceptance_hard_lock_drift:noFileMutation"),
  "hard lock drift blocker must name noFileMutation",
);

const dangerousAttempts = buildBetaAcceptanceState({
  generatedAt,
  runtimeState: runtimeState(),
  packageScripts,
  providerSubmitAttempted: true,
  liveSubmitAttempted: true,
  spawnCodexAttempted: true,
  shellAttempted: true,
  credentialAttempted: true,
  fileMutationAttempted: true,
  apiKeyCreateAttempted: true,
  extraPhaseRequested: true,
});
for (const blocker of [
  "provider_submit_attempt_blocked",
  "live_submit_attempt_blocked",
  "spawn_codex_attempt_blocked",
  "shell_attempt_blocked",
  "credential_attempt_blocked",
  "file_mutation_attempt_blocked",
  "api_key_create_attempt_blocked",
  "extra_phase_requested_blocked",
]) {
  assert(dangerousAttempts.blockers.includes(blocker), `dangerous attempt did not block: ${blocker}`);
}

const unsafeProjectPath = buildBetaAcceptanceState({
  generatedAt,
  runtimeState: runtimeState({
    projectFileCore: projectFileCore({
      sourceOfTruthPriority: [
        { runtimeStateMayOverride: false, importedSourceRefs: [{ path: "/Users/example/secret/api_key.txt" }] },
      ],
    }),
  }),
  packageScripts,
});
assert(unsafeProjectPath.readiness === "blocked", "absolute credential-like project fact paths must block");
assert(
  unsafeProjectPath.blockers.some((blocker) => blocker.includes("project_fact_absolute_path")),
  "absolute project fact path blocker must be explicit",
);

const packageScriptsMissingBuild = { ...packageScripts };
delete packageScriptsMissingBuild.build;
const missingScriptState = buildBetaAcceptanceState({
  generatedAt,
  runtimeState: runtimeState(),
  packageScripts: packageScriptsMissingBuild,
});
assert(missingScriptState.readiness === "blocked", "missing expected package script must block when scripts are supplied");
assert(
  missingScriptState.blockers.includes("test_matrix:package_script_missing:build"),
  "missing build script blocker must be explicit",
);

const scriptsNotSuppliedState = buildBetaAcceptanceState({
  generatedAt,
  runtimeState: runtimeState(),
});
assert(scriptsNotSuppliedState.readiness === "blocked", "test matrix must block when package scripts are not supplied");
assert(
  scriptsNotSuppliedState.blockers.includes("test_matrix:package_scripts_not_supplied"),
  "package scripts not supplied blocker must be explicit",
);

const projectRuntimeSchema = readJson("schemas/project_runtime_state.schema.json");
assert(projectRuntimeSchema.required.includes("betaAcceptance"), "ProjectRuntimeState schema must require betaAcceptance");
assert(projectRuntimeSchema.properties.betaAcceptance.$ref === "beta_acceptance.schema.json", "ProjectRuntimeState schema must reference beta acceptance schema");

const betaSchema = readJson("schemas/beta_acceptance.schema.json");
assert(betaSchema.properties.finalPhaseNumber.const === 42, "beta acceptance schema must pin final phase 42");
assert(betaSchema.$defs.hardLocks.properties.noAdditionalPhasesPlanned.const === true, "beta schema must hard-lock noAdditionalPhasesPlanned");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("beta_acceptance.schema.json"), "schema registry must include beta acceptance schema");

const packageSource = fs.readFileSync("package.json", "utf8");
assert(packageSource.includes('"beta-acceptance:test"'), "package.json must expose beta-acceptance:test");

const sourceText = fs.readFileSync("src/core/betaAcceptance.ts", "utf8");
for (const forbidden of [
  /\bfs\.(?:read|write|append|mkdir|rm|unlink|rename|copy|create)/,
  /child_process/,
  /execSync/,
  /spawn\(/,
  /fetch\(/,
  /XMLHttpRequest/,
  /localStorage/,
]) {
  assert(!forbidden.test(sourceText), `betaAcceptance source contains forbidden runtime primitive: ${forbidden}`);
}

console.log("beta-acceptance-test: ok");
