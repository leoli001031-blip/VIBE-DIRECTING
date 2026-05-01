import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadModule(sourcePath, exportPath) {
  const resolved = path.resolve(sourcePath);
  const source = fs.readFileSync(resolved, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      isolatedModules: true,
    },
    fileName: resolved,
  });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-real-execution-gate-"));
  const outPath = path.join(tmpDir, exportPath);
  fs.writeFileSync(outPath, output.outputText, "utf8");
  return import(pathToFileURL(outPath).href);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sandbox() {
  const root = "real-test-sandbox/project_1/batch_A";
  return {
    root,
    allowedPrefixes: [root],
    manifestPath: `${root}/manifest.json`,
    qaReportPath: `${root}/qa/qa-report.json`,
    ledgerPath: `${root}/execution-ledger.json`,
    projectRootRelative: true,
    outsideRootWriteAllowed: false,
  };
}

function taskPlan(outputPath = "real-test-sandbox/project_1/batch_A/shots/S01/result.png", overrides = {}) {
  return {
    taskPlanId: "image_task_plan_job_S01",
    jobId: "job_S01",
    shotId: "S01",
    promptPlanId: "prompt_S01",
    providerSlot: "image.edit",
    requiredMode: "image2image",
    providerId: "openai-image2-api",
    mode: "image2image",
    status: "ready_for_dry_run",
    expectedOutputPath: outputPath,
    inputReferenceIds: ["hero_locked"],
    sourcePromptPlanHash: "prompt_hash_S01",
    sourceShotSpecHash: "shot_hash_S01",
    taskEnvelopeSummary: {
      envelopeId: "job_S01",
      providerSlot: "image.edit",
      providerId: "openai-image2-api",
      requiredMode: "image2image",
      sourceIndexHash: "source_hash",
      promptPlanId: "prompt_S01",
      promptPlanHash: "prompt_hash_S01",
      sourceShotSpecHash: "shot_hash_S01",
      expectedOutputs: [outputPath],
      preflightStatus: "pass",
      blockingReasons: [],
    },
    blockers: [],
    warnings: [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    ...overrides,
  };
}

function taskView(outputPath = "real-test-sandbox/project_1/batch_A/shots/S01/result.png", overrides = {}) {
  return {
    job: {
      id: "job_S01",
      providerId: "openai-image2-api",
      slot: "image.edit",
      requiredMode: "image2image",
    },
    shotId: "S01",
    envelope: {
      id: "job_S01",
      purpose: "keyframe",
      providerSlot: "image.edit",
      providerId: "openai-image2-api",
      executionState: "planned",
      requiredMode: "image2image",
      sourceIndexHash: "source_hash",
      dependencies: [],
      contextLevel: "L1",
      expectedOutputs: [outputPath],
      hardRules: [],
      references: [],
      qaChecklist: [],
      preflight: { taskId: "job_S01", preflightScope: "formal_execution", status: "pass", blockers: [], warnings: [], checkedAt: "2026-05-02T00:00:00.000Z" },
      injectedKnowledgePacks: [],
      injectedKnowledgeSnippetIds: [],
      injectedKnowledgeSnippets: [],
      routeWarnings: [],
      promptPlanId: "prompt_S01",
      promptPlanHash: "prompt_hash_S01",
      sourceShotSpecHash: "shot_hash_S01",
      outputPath,
      blockingReasons: [],
    },
    validator: { valid: true, issues: [] },
    ...overrides,
  };
}

function manifest(status = "complete") {
  return {
    taskId: "image_task_plan_job_S01",
    status,
    expectedOutputCount: 1,
    presentOutputCount: status === "complete" ? 1 : 0,
    missingExpectedOutputs: status === "complete" ? [] : ["real-test-sandbox/project_1/batch_A/shots/S01/result.png"],
    actualOutputsPresent: status === "complete" ? ["real-test-sandbox/project_1/batch_A/shots/S01/result.png"] : [],
    recoverableOutputs: [],
    outputMatches: [],
  };
}

function qaHarness(formalPromotionEligible = true) {
  return {
    items: [
      {
        qaItemId: "qa_S01",
        shotId: "S01",
        taskPlanId: "image_task_plan_job_S01",
        jobId: "job_S01",
        dimensions: [],
        formalPromotionEligible,
        formalPromotionBlockedReasons: formalPromotionEligible ? [] : ["QA not approved."],
        requiresHumanReview: false,
        sourceCoverage: [],
        notes: [],
      },
    ],
  };
}

function generationHarness(qaStatus = "pass") {
  return {
    jobs: [
      {
        harnessJobId: "generation_harness_job_S01",
        jobId: "job_S01",
        shotId: "S01",
        taskPlanId: "image_task_plan_job_S01",
        candidateOutput: { qaStatus },
        warnings: [],
      },
    ],
  };
}

function localOrchestrator() {
  return {
    hardLocks: {
      noSpawnCodex: true,
      noSubprocess: true,
      noShellExecution: true,
      noProviderExecution: true,
      noCredentialRead: true,
      noFileMutation: true,
    },
    summary: {
      daemonStarted: false,
    },
  };
}

function providerExecutionHandoff() {
  return {
    phase: "phase_33_provider_execution_handoff",
    hardLocks: {
      canSubmitProvider: false,
      providerSubmitAllowed: 0,
      liveSubmitAllowed: false,
      credentialAccessAllowed: false,
      automaticSubmitAllowed: false,
      canSpawnWorker: false,
      fileMutationAllowed: false,
      noProviderSubmit: true,
      noCredentialRead: true,
      noCredentialWrite: true,
      noWorkerSpawn: true,
      noFileMutation: true,
    },
    phase33Evidence: {
      noProviderSubmit: true,
      noWorkerSpawn: true,
      noFileMutation: true,
    },
  };
}

const { buildExecutionLedgerState } = await loadModule("src/core/executionLedger.ts", "executionLedger.mjs");
const { buildRealExecutionGateState } = await loadModule("src/core/realExecutionGate.ts", "realExecutionGate.mjs");

const generatedAt = "2026-05-02T00:00:00.000Z";
const baseFacts = {
  generatedAt,
  projectId: "project_1",
  batchId: "batch_A",
  selectedShotIds: ["S01"],
  outputSandbox: sandbox(),
  taskViews: [taskView()],
  imageTaskPlans: [taskPlan()],
  manifestMatches: [manifest()],
  qaHarness: qaHarness(),
  generationHarness: generationHarness(),
};

const ledger = buildExecutionLedgerState({
  ...baseFacts,
  mode: "scoped_real_test",
});
const readyGate = buildRealExecutionGateState({
  ...baseFacts,
  mode: "scoped_real_test",
  outputSandbox: ledger.outputSandbox,
  executionLedger: ledger,
  localOrchestrator: localOrchestrator(),
  providerExecutionHandoff: providerExecutionHandoff(),
});

assert(readyGate.schemaVersion === "0.1.0", "schema version drifted");
assert(readyGate.phase === "scoped_real_execution_gate", "phase drifted");
assert(readyGate.mode === "scoped_real_test", "mode should be scoped real test");
assert(readyGate.status === "ready_for_scoped_real_test_review", "ready facts should pass scoped review");
assert(readyGate.summary.readyForScopedRealTestReview === 1, "one gate item should be ready");
assert(readyGate.summary.canEnterScopedRealTestMode === 1, "one item should enter scoped mode review");
assert(readyGate.summary.actualExecutionAllowed === false, "actual execution must remain false");
assert(readyGate.summary.canExecute === false, "canExecute must remain false");
assert(readyGate.summary.workerSpawnsAllowed === 0, "worker spawns must remain zero");
assert(readyGate.summary.providerSubmitAllowed === 0, "provider submit must remain zero");
assert(readyGate.summary.liveSubmitAllowed === false, "live submit must remain false");
assert(readyGate.summary.credentialAccessAllowed === false, "credential access must remain false");
assert(readyGate.items[0].checks.every((item) => item.passed), "all ready gate checks should pass");
assert(readyGate.items[0].actualExecutionAllowed === false, "ready item must not allow execution");
assert(readyGate.items[0].canSpawnWorker === false, "ready item must not spawn worker");
assert(readyGate.items[0].canSubmitProvider === false, "ready item must not submit provider");

const lockedLedger = buildExecutionLedgerState({
  ...baseFacts,
  mode: "locked",
});
const lockedGate = buildRealExecutionGateState({
  ...baseFacts,
  mode: "locked",
  outputSandbox: lockedLedger.outputSandbox,
  executionLedger: lockedLedger,
  localOrchestrator: localOrchestrator(),
  providerExecutionHandoff: providerExecutionHandoff(),
});
assert(lockedGate.status === "locked", "default gate mode should stay locked");
assert(lockedGate.summary.locked === 1, "locked gate should report locked item");
assert(lockedGate.summary.readyForScopedRealTestReview === 0, "locked gate should not report scoped readiness");
assert(lockedGate.items[0].canEnterScopedRealTestMode === false, "locked item cannot enter scoped mode");

const missingLedgerGate = buildRealExecutionGateState({
  ...baseFacts,
  mode: "scoped_real_test",
  outputSandbox: sandbox(),
  localOrchestrator: localOrchestrator(),
  providerExecutionHandoff: providerExecutionHandoff(),
});
assert(missingLedgerGate.status === "blocked", "missing ledger should block scoped real test");
assert(missingLedgerGate.items[0].checks.some((item) => item.checkId === "ledger_ready" && item.passed === false), "ledger check must fail");
assert(missingLedgerGate.items[0].blockers.some((blocker) => /ledger/i.test(blocker)), "ledger blocker missing");

const driftedHandoff = clone(providerExecutionHandoff());
driftedHandoff.hardLocks.canSpawnWorker = true;
const driftedGate = buildRealExecutionGateState({
  ...baseFacts,
  mode: "scoped_real_test",
  outputSandbox: ledger.outputSandbox,
  executionLedger: ledger,
  localOrchestrator: localOrchestrator(),
  providerExecutionHandoff: driftedHandoff,
});
assert(driftedGate.status === "blocked", "provider/worker lock drift should block");
assert(driftedGate.items[0].checks.some((item) => item.checkId === "provider_routes_closed" && item.passed === false), "provider route drift check missing");

for (const key of [
  "defaultLocked",
  "scopedRealTestReviewOnly",
  "noWorkerSpawn",
  "noSubprocess",
  "noShellExecution",
  "providerSubmissionForbidden",
  "noProviderSubmit",
  "noCredentialRead",
  "noCredentialWrite",
  "noFileMutation",
  "selectedScopeRequired",
  "validatedEnvelopeRequired",
  "outputSandboxRequired",
  "manifestRequired",
  "qaRequired",
  "ledgerRequired",
]) {
  assert(readyGate.hardLocks[key] === true, `${key} hard lock must be true`);
}
assert(readyGate.hardLocks.actualExecutionAllowed === false, "actual execution hard lock must be false");
assert(readyGate.hardLocks.canExecute === false, "canExecute hard lock must be false");
assert(readyGate.hardLocks.canSpawnWorker === false, "worker spawn hard lock must be false");
assert(readyGate.hardLocks.canSubmitProvider === false, "provider submit hard lock must be false");
assert(readyGate.hardLocks.providerSubmitAllowed === 0, "provider submit hard lock must be zero");
assert(readyGate.hardLocks.liveSubmitAllowed === false, "live submit hard lock must be false");
assert(readyGate.hardLocks.credentialAccessAllowed === false, "credential access hard lock must be false");

const source = fs.readFileSync("src/core/realExecutionGate.ts", "utf8");
for (const forbiddenCode of ["fetch(", "XMLHttpRequest", "localStorage", "process.env", "spawn(", "exec("]) {
  assert(!source.includes(forbiddenCode), `realExecutionGate source must not contain ${forbiddenCode}`);
}

const schema = readJson("schemas/real_execution_gate.schema.json");
assert(schema.title === "RealExecutionGateState", "schema title drifted");
assert(schema.$defs.hardLocks.properties.defaultLocked.const === true, "schema must pin defaultLocked=true");
assert(schema.$defs.hardLocks.properties.actualExecutionAllowed.const === false, "schema must pin actualExecutionAllowed=false");
assert(schema.$defs.hardLocks.properties.canExecute.const === false, "schema must pin canExecute=false");
assert(schema.$defs.hardLocks.properties.canSpawnWorker.const === false, "schema must pin canSpawnWorker=false");
assert(schema.$defs.hardLocks.properties.providerSubmitAllowed.const === 0, "schema must pin providerSubmitAllowed=0");
assert(schema.$defs.hardLocks.properties.credentialAccessAllowed.const === false, "schema must pin credentialAccessAllowed=false");
assert(schema.$defs.item.properties.scopedRealTestReviewOnly.const === true, "schema must keep items review-only");

const projectRuntimeSchema = fs.readFileSync("schemas/project_runtime_state.schema.json", "utf8");
assert(projectRuntimeSchema.includes("execution_ledger.schema.json"), "ProjectRuntimeState schema must include execution ledger");
assert(projectRuntimeSchema.includes("real_execution_gate.schema.json"), "ProjectRuntimeState schema must include real execution gate");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("real_execution_gate.schema.json"), "schema registry must include real execution gate schema");
assert(registrySource.includes("RealExecutionGateState"), "schema registry must include real execution gate type");

console.log(
  `Real execution gate tests passed: ${readyGate.summary.readyForScopedRealTestReview} scoped-review ready, locked=${lockedGate.summary.locked}, blocked=${missingLedgerGate.summary.blocked}.`,
);
