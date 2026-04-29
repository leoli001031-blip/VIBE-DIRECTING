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

const { buildPromptConflictCheckerState } = await importTs("src/core/promptConflictChecker.ts");

const generatedAt = "2026-04-30T00:00:00.000Z";

function shot(id, storyFunction, issues = []) {
  return {
    id,
    actId: "A1",
    title: `${id} title`,
    storyFunction,
    status: "ready",
    gates: {
      identity: "PASS",
      scene: "PASS",
      pair: "PASS",
      story: "PASS",
      prop: "PASS",
      style: "PASS",
    },
    issues,
  };
}

function plan(id, shotId, sourceIntent, overrides = {}) {
  return {
    promptPlanId: `prompt_${id}`,
    promptPlanHash: `prompt_hash_${id}`,
    sourceShotSpecHash: `shot_hash_${id}`,
    jobId: `job_${id}`,
    shotId,
    providerId: "openai-image2-api",
    providerSlot: "image.generate",
    requiredMode: "text2image",
    promptKind: "start_frame",
    sourceIntent,
    naturalLanguagePolicy: "source_intent_only",
    mustPreserve: ["locked character identity", "locked scene layout", "style capsule"],
    mustAvoid: ["provider or mode fallback"],
    referenceIds: [],
    styleDirectives: [],
    adapterWarnings: [],
    status: "ready_for_envelope",
    blockers: [],
    conflictReportId: `conflict_${id}`,
    createdAt: generatedAt,
    ...overrides,
  };
}

function report(plan) {
  return {
    reportId: plan.conflictReportId,
    promptPlanId: plan.promptPlanId,
    jobId: plan.jobId,
    shotId: plan.shotId,
    status: "clear",
    conflicts: [],
    checkedAt: generatedAt,
  };
}

const shots = [
  shot("shot_story", "current evidence reveal"),
  shot("shot_garage", "reveal the garage door keypad"),
  shot("shot_fixed", "fixed camera witness beat", ["shot_layout:fixed camera"]),
  shot("shot_end", "derive end frame from start", [],),
  shot("shot_outfit", "locked outfit continuity"),
];

const lockedOutfitAsset = {
  id: "asset_locked_blue_coat",
  type: "character",
  name: "Hero locked blue coat",
  path: "visual_memory/hero_blue_coat.png",
  status: "exists",
  lockedStatus: "locked",
  safeForFutureReference: true,
  issues: ["locked_outfit: blue coat"],
};

const plans = [
  plan("story", "shot_story", ["story_function:old greeting beat"]),
  plan("garage", "shot_garage", ["The actor opens the front door under rain."]),
  plan("fixed", "shot_fixed", ["A dramatic dolly push in across the room."]),
  plan("end", "shot_end", ["Independent end frame render."], {
    providerSlot: "image.edit",
    requiredMode: "image2image",
    promptKind: "end_frame",
    derivesFromStartFrame: false,
  }),
  plan("outfit", "shot_outfit", ["The hero wears a red coat instead."], {
    referenceIds: [lockedOutfitAsset.id],
  }),
];

const harness = buildPromptConflictCheckerState({
  generatedAt,
  promptPlans: plans,
  promptConflictReports: plans.map(report),
  shots,
  assets: [lockedOutfitAsset],
  jobs: [],
});

function codesFor(planId) {
  const item = harness.items.find((candidate) => candidate.promptPlanId === planId);
  assert(item, `missing checker item for ${planId}`);
  assert(item.status === "blocked", `${planId} must be blocked`);
  for (const conflict of item.conflicts) {
    assert(conflict.requiredResolution.updateShotPromptPlan === true, `${conflict.code} must require Shot Prompt Plan update`);
    assert(conflict.requiredResolution.recompileRequired === true, `${conflict.code} must require recompile`);
  }
  return item.conflicts.map((conflict) => conflict.code);
}

assert(codesFor("prompt_story").includes("story_flow_stale_function"), "must detect stale Story Flow function");
assert(codesFor("prompt_garage").includes("garage_front_door_conflict"), "must detect front door vs garage conflict");
assert(codesFor("prompt_fixed").includes("fixed_camera_movement_conflict"), "must detect fixed camera vs large movement conflict");
assert(codesFor("prompt_end").includes("independent_end_frame_conflict"), "must detect independent end-frame conflict");
assert(codesFor("prompt_outfit").includes("visual_memory_locked_outfit_conflict"), "must detect locked outfit conflict");
assert(harness.hardLocks.agentPromiseCannotResolveConflict === true, "agent promise hard lock must be true");
assert(harness.summary.recompileRequired === 5, "every conflict item must require recompile");

const importResult = spawnSync("node", ["scripts/import-runtime-test.mjs"], {
  stdio: "inherit",
  encoding: "utf8",
  timeout: 120000,
});
assert(importResult.status === 0, "prompt conflict checker test could not refresh runtime-state with import-runtime-test");

const state = readJson("public/runtime-state.json");
assert(state.promptConflictChecker, "runtime-state missing promptConflictChecker");
assert(state.promptConflictChecker.items.length === state.imagePipeline.promptPlans.length, "promptConflictChecker must mirror promptPlans");
assert(state.promptConflictChecker.diagnosticsOnly === true, "promptConflictChecker must be diagnostics-only");
assert(state.promptConflictChecker.providerSubmissionForbidden === true, "promptConflictChecker must forbid provider submission");

const schema = readJson("schemas/prompt_conflict_checker.schema.json");
assert(schema.title === "PromptConflictCheckerState", "prompt conflict checker schema title drifted");
assert(schema.$defs.conflictCode.enum.includes("garage_front_door_conflict"), "schema must include garage/front conflict");
assert(schema.$defs.conflictCode.enum.includes("fixed_camera_movement_conflict"), "schema must include fixed-camera conflict");
assert(schema.$defs.conflictCode.enum.includes("independent_end_frame_conflict"), "schema must include independent end-frame conflict");
assert(schema.$defs.requiredResolution.properties.recompileRequired.const === true, "schema must require recompile for conflicts");

const projectSchema = readJson("schemas/project_runtime_state.schema.json");
assert(projectSchema.required.includes("promptConflictChecker"), "project runtime schema must require promptConflictChecker");
assert(projectSchema.properties.promptConflictChecker.$ref === "prompt_conflict_checker.schema.json", "project runtime schema must reference prompt conflict checker schema");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("prompt_conflict_checker.schema.json"), "schema registry must include prompt_conflict_checker.schema.json");

console.log(`Prompt conflict checker tests passed: ${harness.items.length} fixture items, ${state.promptConflictChecker.items.length} runtime items.`);
