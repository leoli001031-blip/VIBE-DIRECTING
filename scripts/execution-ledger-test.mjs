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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-execution-ledger-"));
  const outPath = path.join(tmpDir, exportPath);
  fs.writeFileSync(outPath, output.outputText, "utf8");
  return import(pathToFileURL(outPath).href);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

const { buildExecutionLedgerState } = await loadModule("src/core/executionLedger.ts", "executionLedger.mjs");

const generatedAt = "2026-05-02T00:00:00.000Z";
const readyInput = {
  generatedAt,
  mode: "scoped_real_test",
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

const readyLedger = buildExecutionLedgerState(readyInput);
assert(readyLedger.schemaVersion === "0.1.0", "schema version drifted");
assert(readyLedger.phase === "scoped_real_execution_ledger", "phase drifted");
assert(readyLedger.mode === "scoped_real_test", "mode should be scoped real test");
assert(readyLedger.status === "ready_for_scoped_review", "ready scope should be ready for scoped review");
assert(readyLedger.summary.readyForScopedReview === 1, "one entry should be ready for scoped review");
assert(readyLedger.summary.actualExecutions === 0, "ledger must not record actual executions");
assert(readyLedger.summary.workerSpawns === 0, "ledger must not spawn workers");
assert(readyLedger.summary.providerSubmitAllowed === 0, "provider submit must remain zero");
assert(readyLedger.summary.ledgerWriteAllowed === false, "ledger writes must remain disabled");
assert(readyLedger.entries[0].status === "ready_for_scoped_review", "entry should be scoped-review ready");
assert(readyLedger.entries[0].envelopeValid === true, "entry should require validated envelope");
assert(readyLedger.entries[0].outputSandboxValid === true, "entry should require output sandbox");
assert(readyLedger.entries[0].manifestReady === true, "entry should require manifest evidence");
assert(readyLedger.entries[0].qaReady === true, "entry should require QA evidence");
assert(readyLedger.entries[0].actualExecutionAllowed === false, "entry must not allow execution");
assert(readyLedger.entries[0].canSpawnWorker === false, "entry must not allow worker spawn");

const lockedLedger = buildExecutionLedgerState({
  ...readyInput,
  mode: "locked",
});
assert(lockedLedger.status === "locked", "default ledger mode should stay locked");
assert(lockedLedger.summary.locked === 1, "locked ledger should report locked entry");
assert(lockedLedger.summary.readyForScopedReview === 0, "locked ledger should not be scoped-review ready");

const unsafeOutput = "outputs/not-in-sandbox/S01.png";
const blockedLedger = buildExecutionLedgerState({
  ...readyInput,
  taskViews: [taskView(unsafeOutput)],
  imageTaskPlans: [taskPlan(unsafeOutput)],
});
assert(blockedLedger.status === "blocked", "outside-sandbox output should block scoped review");
assert(blockedLedger.entries[0].outputSandboxValid === false, "outside-sandbox output must fail");
assert(blockedLedger.entries[0].blockers.some((blocker) => /sandbox/i.test(blocker)), "sandbox blocker missing");

const missingScopeLedger = buildExecutionLedgerState({
  ...readyInput,
  batchId: undefined,
  selectedShotIds: [],
});
assert(missingScopeLedger.status === "blocked", "missing scoped batch/shot should block");
assert(missingScopeLedger.scopeBlockers.some((blocker) => /batch/i.test(blocker)), "batch scope blocker missing");
assert(missingScopeLedger.scopeBlockers.some((blocker) => /shot/i.test(blocker)), "shot scope blocker missing");

for (const key of [
  "defaultLocked",
  "stateOnly",
  "appendOnly",
  "noWorkerSpawn",
  "noSubprocess",
  "noShellExecution",
  "providerSubmissionForbidden",
  "noCredentialRead",
  "noCredentialWrite",
  "noFileMutation",
  "outsideSandboxWriteForbidden",
]) {
  assert(readyLedger.hardLocks[key] === true, `${key} hard lock must be true`);
}
assert(readyLedger.hardLocks.actualExecutionAllowed === false, "actual execution hard lock must be false");
assert(readyLedger.hardLocks.canSpawnWorker === false, "worker spawn hard lock must be false");
assert(readyLedger.hardLocks.providerSubmitAllowed === 0, "provider submit hard lock must be zero");
assert(readyLedger.hardLocks.liveSubmitAllowed === false, "live submit hard lock must be false");
assert(readyLedger.hardLocks.credentialAccessAllowed === false, "credential access hard lock must be false");

const source = fs.readFileSync("src/core/executionLedger.ts", "utf8");
for (const forbiddenCode of ["fetch(", "XMLHttpRequest", "localStorage", "process.env", "spawn(", "exec("]) {
  assert(!source.includes(forbiddenCode), `executionLedger source must not contain ${forbiddenCode}`);
}

const schema = readJson("schemas/execution_ledger.schema.json");
assert(schema.title === "ExecutionLedgerState", "schema title drifted");
assert(schema.$defs.hardLocks.properties.defaultLocked.const === true, "schema must pin defaultLocked=true");
assert(schema.$defs.hardLocks.properties.actualExecutionAllowed.const === false, "schema must pin actualExecutionAllowed=false");
assert(schema.$defs.hardLocks.properties.canSpawnWorker.const === false, "schema must pin canSpawnWorker=false");
assert(schema.$defs.hardLocks.properties.providerSubmitAllowed.const === 0, "schema must pin providerSubmitAllowed=0");
assert(schema.$defs.hardLocks.properties.credentialAccessAllowed.const === false, "schema must pin credentialAccessAllowed=false");
assert(schema.$defs.entry.properties.ledgerRecordOnly.const === true, "schema must keep entries record-only");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("execution_ledger.schema.json"), "schema registry must include execution ledger schema");
assert(registrySource.includes("ExecutionLedgerState"), "schema registry must include execution ledger type");

console.log(
  `Execution ledger tests passed: ${readyLedger.summary.readyForScopedReview} scoped-review ready, ${blockedLedger.summary.blocked} blocked, locked=${lockedLedger.summary.locked}.`,
);
