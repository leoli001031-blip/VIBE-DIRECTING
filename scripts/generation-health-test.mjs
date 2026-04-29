import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
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

const { buildGenerationHealthCheckerState } = await importTs("src/core/generationHealthChecker.ts");

const generatedAt = "2026-04-30T00:00:00.000Z";

function taskPlan(id, overrides = {}) {
  return {
    taskPlanId: `task_${id}`,
    jobId: `job_${id}`,
    shotId: `shot_${id}`,
    promptPlanId: `prompt_${id}`,
    providerSlot: "image.generate",
    requiredMode: "text2image",
    providerId: "openai-image2-api",
    mode: "text2image",
    status: "ready_for_dry_run",
    expectedOutputPath: `outputs/${id}.png`,
    inputReferenceIds: [],
    sourcePromptPlanHash: `prompt_hash_${id}`,
    sourceShotSpecHash: `shot_hash_${id}`,
    blockers: [],
    warnings: [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
    ...overrides,
  };
}

function health(plan, overrides = {}) {
  return {
    reportId: `generation_health_${plan.taskPlanId}`,
    taskPlanId: plan.taskPlanId,
    jobId: plan.jobId,
    shotId: plan.shotId,
    expectedOutputPath: plan.expectedOutputPath,
    outputExists: false,
    manifestStatus: "missing_expected_output",
    qaStatus: "missing",
    stalePrompt: false,
    assetReadinessStatus: "ready",
    healthStatus: "waiting",
    blockers: [],
    warnings: [],
    nextAction: "Wait.",
    ...overrides,
  };
}

function manifest(plan, overrides = {}) {
  return {
    taskId: plan.taskPlanId,
    status: "missing_expected_output",
    expectedOutputCount: 1,
    presentOutputCount: 0,
    missingExpectedOutputs: [plan.expectedOutputPath],
    actualOutputsPresent: [],
    recoverableOutputs: [],
    outputMatches: [],
    ...overrides,
  };
}

function build(items) {
  return buildGenerationHealthCheckerState({
    generatedAt,
    imageTaskPlans: items.map((item) => item.plan),
    generationHealthReports: items.map((item) => item.health),
    manifestMatches: items.map((item) => item.manifest),
    watcherEvents: items.flatMap((item) => item.events || []),
    taskRuns: items.map((item) => item.taskRun).filter(Boolean),
    jobs: items.map((item) => item.job).filter(Boolean),
    fileSnapshot: items.flatMap((item) => item.fileSnapshot || []),
  });
}

const recoverablePlan = taskPlan("recoverable");
const workerExitPlan = taskPlan("worker_exit");
const qaMissingPlan = taskPlan("qa_missing");

const harness = build([
  {
    plan: recoverablePlan,
    health: health(recoverablePlan, { manifestStatus: "postprocess_recoverable" }),
    manifest: manifest(recoverablePlan, {
      status: "postprocess_recoverable",
      recoverableOutputs: ["tmp/recoverable.png"],
      outputMatches: [
        {
          expectedPath: recoverablePlan.expectedOutputPath,
          status: "postprocess_recoverable",
          actualPath: "tmp/recoverable.png",
          recoverableCandidates: ["tmp/recoverable.png"],
          reason: "Temp image exists but expected output postprocess failed.",
        },
      ],
    }),
    events: [
      {
        id: "watcher_postprocess_recoverable",
        eventType: "postprocess_recoverable",
        taskId: recoverablePlan.taskPlanId,
        jobId: recoverablePlan.jobId,
        shotId: recoverablePlan.shotId,
        artifactPath: "tmp/recoverable.png",
        expectedOutputPath: recoverablePlan.expectedOutputPath,
        status: "recoverable",
        severity: "warning",
        createdAt: generatedAt,
        notes: [],
      },
    ],
  },
  {
    plan: workerExitPlan,
    health: health(workerExitPlan),
    manifest: manifest(workerExitPlan),
    job: { id: workerExitPlan.jobId, slot: "image.generate", requiredMode: "text2image", providerId: "openai-image2-api", status: "success", references: [], issues: [] },
  },
  {
    plan: qaMissingPlan,
    health: health(qaMissingPlan, {
      outputExists: true,
      manifestStatus: "actual_output_present",
      qaStatus: "missing",
      healthStatus: "qa_pending",
    }),
    manifest: manifest(qaMissingPlan, {
      status: "actual_output_present",
      presentOutputCount: 1,
      missingExpectedOutputs: [],
      actualOutputsPresent: [qaMissingPlan.expectedOutputPath],
      outputMatches: [
        {
          expectedPath: qaMissingPlan.expectedOutputPath,
          status: "actual_output_present",
          actualPath: qaMissingPlan.expectedOutputPath,
          recoverableCandidates: [],
          reason: "Expected output exists.",
        },
      ],
    }),
    fileSnapshot: [{ path: qaMissingPlan.expectedOutputPath, hash: "sha256:abc", sizeBytes: 1024, dimensions: "1024x1024", readable: true }],
  },
]);

const byTask = new Map(harness.items.map((item) => [item.taskPlanId, item]));
assert(byTask.get(recoverablePlan.taskPlanId).status === "postprocess_recoverable", "temp output plus postprocess failure must be postprocess_recoverable");
assert(byTask.get(workerExitPlan.taskPlanId).status === "worker_exit_without_expected_output", "worker success without expected output must not pass");
assert(byTask.get(qaMissingPlan.taskPlanId).status === "qa_missing", "missing QA coverage must block success");
assert(byTask.get(qaMissingPlan.taskPlanId).qaCovered === false, "qa_missing item must expose qaCovered=false");
assert(harness.hardLocks.workerSelfReportCannotComplete === true, "worker self-report hard lock must be true");
assert(harness.summary.postprocessRecoverable === 1, "summary must count recoverable item");

const importResult = spawnSync("node", ["scripts/import-runtime-test.mjs"], {
  stdio: "inherit",
  encoding: "utf8",
  timeout: 120000,
});
assert(importResult.status === 0, "generation health checker test could not refresh runtime-state with import-runtime-test");

const state = readJson("public/runtime-state.json");
assert(state.generationHealthChecker, "runtime-state missing generationHealthChecker");
assert(state.generationHealthChecker.items.length === state.imagePipeline.imageTaskPlans.length, "generationHealthChecker must mirror imageTaskPlans");
assert(state.generationHealthChecker.diagnosticsOnly === true, "generationHealthChecker must be diagnostics-only");
assert(state.generationHealthChecker.providerSubmissionForbidden === true, "generationHealthChecker must forbid provider submission");

const schema = readJson("schemas/generation_health_checker.schema.json");
assert(schema.title === "GenerationHealthCheckerState", "generation health checker schema title drifted");
assert(schema.$defs.itemStatus.enum.includes("postprocess_recoverable"), "schema must include postprocess_recoverable status");
assert(schema.$defs.itemStatus.enum.includes("worker_exit_without_expected_output"), "schema must include worker exit mismatch status");

const projectSchema = readJson("schemas/project_runtime_state.schema.json");
assert(projectSchema.required.includes("generationHealthChecker"), "project runtime schema must require generationHealthChecker");
assert(projectSchema.properties.generationHealthChecker.$ref === "generation_health_checker.schema.json", "project runtime schema must reference generation health checker schema");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("generation_health_checker.schema.json"), "schema registry must include generation_health_checker.schema.json");

console.log(`Generation health checker tests passed: ${harness.items.length} fixture items, ${state.generationHealthChecker.items.length} runtime items.`);
