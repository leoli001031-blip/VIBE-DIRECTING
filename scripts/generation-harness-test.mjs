import fs from "node:fs";
import { spawnSync } from "node:child_process";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const importResult = spawnSync("node", ["scripts/import-runtime-test.mjs"], {
  stdio: "inherit",
  encoding: "utf8",
  timeout: 120000,
});

assert(importResult.status === 0, "generation harness test could not refresh runtime-state with import-runtime-test");

const requiredStages = [
  "shot_spec",
  "visual_memory",
  "spatial_memory",
  "shot_layout",
  "style_capsule",
  "shot_prompt_plan",
  "provider_capability_check",
  "provider_request_preview",
  "candidate_output",
  "qa_gate",
];

const requiredForbiddenActions = [
  "live_submit",
  "provider_unlock",
  "prompt_bypass",
  "candidate_auto_promote",
  "semantic_postprocess_repair",
  "text_to_video_fallback",
];

const state = readJson("public/runtime-state.json");
const harness = state.generationHarness;
assert(harness, "runtime-state missing generationHarness");
assert(harness.schemaVersion === "0.1.0", "generationHarness schemaVersion drifted");
assert(harness.dryRunOnly === true, "generationHarness dryRunOnly must be true");
assert(harness.providerSubmissionForbidden === true, "generationHarness must forbid provider submission");
assert(harness.liveSubmitAllowed === false, "generationHarness liveSubmitAllowed must be false");
assert(harness.summary.liveSubmitAllowed === false, "generationHarness summary liveSubmitAllowed must be false");
assert(Array.isArray(harness.jobs) && harness.jobs.length === state.imagePipeline.imageTaskPlans.length, "generationHarness job count must mirror imageTaskPlans");

for (const action of requiredForbiddenActions) {
  assert(harness.forbiddenActions.includes(action), `generationHarness must forbid ${action}`);
}

const policy = harness.postprocessPolicy;
assert(policy.semanticRepairAllowed === false, "semantic repair must be forbidden");
assert(policy.openCvSemanticRepairAllowed === false, "OpenCV semantic repair must be forbidden");
assert(policy.localPostprocessCanChangeMeaning === false, "local postprocess cannot change meaning");
assert(policy.localPostprocessCanPromoteFormal === false, "local postprocess cannot promote formal");
assert(policy.allowedLocalOperations.every((item) => ["resize", "format_convert", "thumbnail_preview", "metadata_probe", "manifest_match"].includes(item)), "postprocess policy includes non-mechanical operation");

for (const job of harness.jobs) {
  assert(job.dryRunOnly === true, `${job.harnessJobId} dryRunOnly must be true`);
  assert(job.providerSubmissionForbidden === true, `${job.harnessJobId} must forbid provider submission`);
  assert(job.liveSubmitAllowed === false, `${job.harnessJobId} liveSubmitAllowed must be false`);
  for (const action of requiredForbiddenActions) {
    assert(job.forbiddenActions.includes(action), `${job.harnessJobId} must forbid ${action}`);
  }
  const stageIds = job.stages.map((stage) => stage.stageId);
  assert(stageIds.length === requiredStages.length, `${job.harnessJobId} must have exactly ${requiredStages.length} stages`);
  requiredStages.forEach((stage, index) => {
    assert(stageIds[index] === stage, `${job.harnessJobId} stage ${index + 1} must be ${stage}`);
  });
  assert(job.providerRequestPreview.dryRunOnly === true, `${job.harnessJobId} request preview must be dry-run only`);
  assert(job.providerRequestPreview.providerSubmissionForbidden === true, `${job.harnessJobId} request preview must forbid submission`);
  assert(job.providerRequestPreview.liveSubmitAllowed === false, `${job.harnessJobId} request preview must not allow live submit`);
  assert(job.providerRequestPreview.liveSubmitForbidden === true, `${job.harnessJobId} request preview must explicitly forbid live submit`);
  assert(job.providerRequestPreview.forbiddenFallbacks.includes("text_to_video_fallback"), `${job.harnessJobId} must forbid text-to-video fallback`);
  assert(["missing", "candidate", "qa_pending", "formal_ready", "blocked"].includes(job.candidateOutput.status), `${job.harnessJobId} has invalid candidate status`);
  assert(job.candidateOutput.candidatePath, `${job.harnessJobId} candidate path is required`);
  assert(job.candidateOutput.formalPath, `${job.harnessJobId} formal path is required`);
  assert(job.candidateOutput.candidatePath !== job.candidateOutput.formalPath, `${job.harnessJobId} candidate and formal paths must be separated`);
  assert(job.candidateOutput.formalPromotionRequiresExplicitQa === true, `${job.harnessJobId} formal promotion must require explicit QA`);
  assert(job.candidateOutput.autoPromoteToFormal === false, `${job.harnessJobId} must not auto-promote candidate output`);
  assert(job.postprocessPolicy.semanticRepairAllowed === false, `${job.harnessJobId} semantic repair must be false`);
  if (job.candidateOutput.canPromoteToFormal) {
    assert(job.candidateOutput.status === "formal_ready", `${job.harnessJobId} promotable candidate must be formal_ready`);
    assert(job.candidateOutput.qaStatus === "pass", `${job.harnessJobId} canPromoteToFormal requires QA pass`);
  }
}

const schema = readJson("schemas/generation_harness.schema.json");
assert(schema.title === "GenerationHarnessState", "generation harness schema title drifted");
assert(schema.$defs.postprocessPolicy.properties.semanticRepairAllowed.const === false, "schema must pin semantic repair false");
assert(schema.$defs.providerRequestPreview.properties.liveSubmitAllowed.const === false, "schema must pin request liveSubmitAllowed false");
assert(schema.$defs.candidateOutput.properties.autoPromoteToFormal.const === false, "schema must pin autoPromoteToFormal false");

const projectSchema = readJson("schemas/project_runtime_state.schema.json");
assert(projectSchema.required.includes("generationHarness"), "project runtime schema must require generationHarness");
assert(projectSchema.properties.generationHarness.$ref === "generation_harness.schema.json", "project runtime schema must reference generation_harness schema");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("generation_harness.schema.json"), "schema registry must include generation_harness.schema.json");

console.log(`Generation harness tests passed: ${harness.jobs.length} harness jobs, ${harness.summary.formalReady} formal-ready candidates.`);
