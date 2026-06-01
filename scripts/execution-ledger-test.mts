import fs from "node:fs";
import { buildExecutionLedgerState } from "../src/core/executionLedger.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  generationHarness: generationHarness(),
  qaHarness: qaHarness(),
};

const ready = buildExecutionLedgerState(readyInput);
assert(ready.mode === "scoped_real_test", "execution mode must be scoped real test");
assert(ready.batchId === "batch_A", "batch id must be scoped for runtime routing");
assert(ready.status === "ready_for_scoped_review", `ready fixture should be review-ready: ${(ready.scopeBlockers || []).join("; ")} ${ready.entries?.[0]?.blockers?.join("; ") || ""}`);
assert(ready.entries.length === 1, "execution ledger should have one entry");
assert(ready.entries[0].expectedOutputs[0] === "real-test-sandbox/project_1/batch_A/shots/S01/result.png", "entry output path drifted");
assert(ready.entries[0].outputSandboxValid === true, "output must be inside sandbox");
assert(ready.entries[0].qaStatus === "pass", "explicit QA pass must be preserved");
assert(ready.summary.totalEntries === 1, "summary total entries must be 1");
assert(ready.summary.readyForScopedReview === 1, "summary ready for scoped review must be 1");

const noOutput = buildExecutionLedgerState({ ...readyInput, manifestMatches: [manifest("incomplete")] });
assert(noOutput.status === "blocked", "missing output must block execution ledger");
assert(noOutput.entries[0].blockers.some((blocker) => /Manifest/.test(blocker)), "missing output blocker missing");

const noQa = buildExecutionLedgerState({ ...readyInput, qaHarness: undefined, generationHarness: undefined });
assert(noQa.status === "blocked", "missing QA harness must block execution ledger");
assert(noQa.entries[0].blockers.some((blocker) => /Explicit QA pass/.test(blocker)), "missing QA blocker missing");

const qaNotPromotable = buildExecutionLedgerState({
  ...readyInput,
  qaHarness: qaHarness(false),
  generationHarness: undefined,
});
assert(qaNotPromotable.status === "blocked", "non-promotable QA must block execution ledger");
assert(qaNotPromotable.entries[0].blockers.some((blocker) => /Explicit QA pass/.test(blocker)), "qa not approved blocker missing");

const failedQa = buildExecutionLedgerState({
  ...readyInput,
  qaHarness: undefined,
  generationHarness: generationHarness("fail"),
});
assert(failedQa.status === "blocked", "failed generation QA must block execution ledger");
assert(failedQa.entries[0].blockers.some((blocker) => /Explicit QA pass/.test(blocker)), "generation QA failed blocker missing");

const outsideSandbox = buildExecutionLedgerState({
  ...readyInput,
  imageTaskPlans: [taskPlan("/Users/example/Desktop/output.png")],
  taskViews: [taskView("/Users/example/Desktop/output.png")],
});
assert(outsideSandbox.status === "blocked", "outside sandbox output must block execution ledger");
assert(outsideSandbox.entries[0].blockers.some((blocker) => /sandbox/.test(blocker)), "outside sandbox blocker missing");
assert(outsideSandbox.entries[0].outputSandboxValid === false, "entry must flag invalid sandbox");

const noTaskViews = buildExecutionLedgerState({ ...readyInput, taskViews: undefined });
assert(noTaskViews.status === "ready_for_scoped_review" || noTaskViews.status === "blocked", "missing task views: status is " + noTaskViews.status);

const noTaskPlans = buildExecutionLedgerState({ ...readyInput, imageTaskPlans: undefined });
assert(noTaskPlans.status === "blocked", "missing task plans must block execution ledger");

const mismatchedShotCount = buildExecutionLedgerState({
  ...readyInput,
  selectedShotIds: ["S02"],
});
assert(mismatchedShotCount.status === "blocked", "no matching task plans must block execution ledger");
assert(mismatchedShotCount.entries.length === 0, "no entries when selected shots have no matching task plans");

const schema = readJson("schemas/execution_ledger.schema.json");
assert(schema.required.includes("schemaVersion"), "execution ledger schema must require schemaVersion");

const source = fs.readFileSync("src/core/executionLedger.ts", "utf8");
for (const forbiddenCode of ["fetch(", "XMLHttpRequest", "localStorage", "process.env", "spawn(", "exec("]) {
  assert(!source.includes(forbiddenCode), `executionLedger source must not contain ${forbiddenCode}`);
}

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("execution_ledger.schema.json"), "schema registry must include execution ledger schema");

console.log(`Execution ledger tests passed: ready=${ready.status}.`);
