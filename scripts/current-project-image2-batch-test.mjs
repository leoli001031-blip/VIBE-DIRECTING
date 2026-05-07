import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  assert,
  compact,
  loadCore,
  smallProjectFixture,
} from "./demo-runtime-fixture.mjs";

function currentLoadCoreDirs() {
  return fs
    .readdirSync(os.tmpdir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("vibe-small-project-"))
    .map((entry) => path.join(os.tmpdir(), entry.name));
}

async function loadCurrentProjectImage2BatchCore() {
  const before = new Set(currentLoadCoreDirs());
  await loadCore();
  const created = currentLoadCoreDirs()
    .filter((dir) => !before.has(dir))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  const coreDir = created[0] || currentLoadCoreDirs().sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];
  assert(coreDir, "loadCore did not create a transpiled core directory");
  return import(pathToFileURL(path.join(coreDir, "currentProjectImage2Batch.mjs")).href);
}

const generatedAt = "2026-05-07T04:30:00.000Z";
const runId = "current_project_image2_batch_001";
const runRoot = `${smallProjectFixture.projectRoot}/real-test-sandbox/${smallProjectFixture.batchId}`;
const { buildCurrentProjectImage2BatchPlan } = await loadCurrentProjectImage2BatchCore();

function lockedReferences(overrides = {}) {
  return {
    character: {
      path: smallProjectFixture.characterPath,
      lockedStatus: "locked",
      safeForFutureReference: true,
    },
    scene: {
      path: smallProjectFixture.scenePath,
      lockedStatus: "locked",
      safeForFutureReference: true,
    },
    style: {
      path: smallProjectFixture.stylePath,
      lockedStatus: "locked",
      safeForFutureReference: true,
    },
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    projectId: "small_project_one_shot",
    runId,
    projectRoot: smallProjectFixture.projectRoot,
    runRoot,
    generatedAt,
    references: lockedReferences(),
    selectedShotIds: ["S01", "S02"],
    ...overrides,
  };
}

function assertSubmitPolicy(policy, pathLabel) {
  assert(policy.providerCallAllowed === false, `${pathLabel}.providerCallAllowed must be false`);
  assert(policy.dryRunOnly === true, `${pathLabel}.dryRunOnly must be true`);
  assert(policy.manualSubmitRequired === true, `${pathLabel}.manualSubmitRequired must be true`);
  assert(policy.liveSubmitAllowed === false, `${pathLabel}.liveSubmitAllowed must be false`);
  assert(policy.noSeedance === true, `${pathLabel}.noSeedance must be true`);
  assert(policy.noJimeng === true, `${pathLabel}.noJimeng must be true`);
  assert(policy.noVideo === true, `${pathLabel}.noVideo must be true`);
  assert(policy.noFast === true, `${pathLabel}.noFast must be true`);
  assert(policy.noVip === true, `${pathLabel}.noVip must be true`);
}

function assertPortable(pathValue, pathLabel) {
  assert(!/^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/]|[a-zA-Z][a-zA-Z0-9+.-]*:)/.test(pathValue), `${pathLabel} must be portable: ${pathValue}`);
  assert(!/(?:^|\/)\.\.(?:\/|$)/.test(pathValue), `${pathLabel} must not contain parent traversal: ${pathValue}`);
}

const readyPlan = buildCurrentProjectImage2BatchPlan(baseInput());
assert(readyPlan.schemaVersion === "0.1.0", "schema version drifted");
assert(readyPlan.generatedAt === generatedAt, "generatedAt should be carried through");
assert(readyPlan.status === "ready_for_review", `ready case should pass: ${compact(readyPlan.blockers)}`);
assert(readyPlan.items.length === 2, "ready case should plan two Image2 items");
assert(readyPlan.uiSummary.plannedCount === 2, "ready planned count drifted");
assert(readyPlan.uiSummary.readyCount === 2, "ready count drifted");
assert(readyPlan.uiSummary.blockedCount === 0, "ready blocked count should be zero");
assert(readyPlan.uiSummary.selectedShotIds.join(",") === "S01,S02", "selected shot ids should be stable");
assertSubmitPolicy(readyPlan.submitPolicy, "plan.submitPolicy");

for (const [index, item] of readyPlan.items.entries()) {
  assert(item.shotId === readyPlan.uiSummary.selectedShotIds[index], "item shot id must match selected order");
  assert(item.queueOrder === index + 1, "queue order must be 1-based and stable");
  assert(item.taskRunId && item.packetId && item.envelopeId, "task run, packet, and envelope ids are required");
  assert(item.expectedOutputPath === `${runRoot}/image2-prep/${item.shotId}/start.png`, "expected output path drifted");
  assert(item.providerObservationPath === `${runRoot}/image2-prep/${item.shotId}/provider_observation.json`, "provider observation path drifted");
  assert(item.semanticQaPath === `${runRoot}/image2-prep/${item.shotId}/semantic_qa.json`, "semantic QA path drifted");
  assert(item.promptPath === `${smallProjectFixture.projectRoot}/prompts/${item.shotId}_start.md`, "prompt path drifted");
  assert(item.referencePaths.length === 3, "item must carry character/scene/style reference paths");
  assert(item.referencePaths.includes(smallProjectFixture.characterPath), "character reference missing");
  assert(item.referencePaths.includes(smallProjectFixture.scenePath), "scene reference missing");
  assert(item.referencePaths.includes(smallProjectFixture.stylePath), "style reference missing");
  assertSubmitPolicy(item.submitPolicy, `items[${index}].submitPolicy`);
}

const missingReferencePlan = buildCurrentProjectImage2BatchPlan(baseInput({
  references: lockedReferences({ style: { path: smallProjectFixture.stylePath, lockedStatus: "candidate" } }),
}));
assert(missingReferencePlan.status === "blocked", "missing locked style reference must block");
assert(missingReferencePlan.blockers.includes("missing_locked_style_reference"), "missing locked style blocker missing");
assert(missingReferencePlan.uiSummary.blockedCount === 2, "missing references should block selected shots");

const tooManyPlan = buildCurrentProjectImage2BatchPlan(baseInput({
  selectedShotIds: undefined,
  shotIds: Array.from({ length: 11 }, (_, index) => `S${String(index + 1).padStart(2, "0")}`),
  maxImages: 10,
}));
assert(tooManyPlan.status === "blocked", "too many images must block");
assert(tooManyPlan.blockers.includes("selected_shots_exceed_max_images"), "too many images blocker missing");
assert(tooManyPlan.uiSummary.plannedCount === 11, "too many plan should still expose selected count for review");
assert(tooManyPlan.uiSummary.readyCount === 0, "blocked too many plan should have no ready count");

const noShotPlan = buildCurrentProjectImage2BatchPlan(baseInput({ selectedShotIds: [], shotIds: [], shots: [] }));
assert(noShotPlan.status === "blocked", "empty shot selection must block");
assert(noShotPlan.blockers.includes("no_selected_shots"), "no shot blocker missing");

const badPathPlan = buildCurrentProjectImage2BatchPlan(baseInput({
  selectedShotIds: undefined,
  shots: [
    {
      id: "S01",
      expectedOutputPath: `${smallProjectFixture.projectRoot}/outside-run/S01/start.png`,
    },
  ],
}));
assert(badPathPlan.status === "blocked", "output outside run root must block");
assert(badPathPlan.blockers.includes("expected_output_path_outside_run_root"), "outside run root blocker missing");

const absolutePathPlan = buildCurrentProjectImage2BatchPlan(baseInput({
  selectedShotIds: undefined,
  shots: [
    {
      id: "S01",
      expectedOutputPath: "/tmp/not-portable/start.png",
    },
  ],
}));
assert(absolutePathPlan.status === "blocked", "absolute output path must block");
assert(absolutePathPlan.blockers.includes("expected_output_path_must_be_portable_not_absolute"), "absolute path blocker missing");

for (const item of readyPlan.items) {
  assertPortable(item.expectedOutputPath, "expectedOutputPath");
  assertPortable(item.providerObservationPath, "providerObservationPath");
  assertPortable(item.semanticQaPath, "semanticQaPath");
  assertPortable(item.promptPath, "promptPath");
  assert(item.expectedOutputPath.startsWith(`${runRoot}/`), "expected output must stay under run root");
  assert(item.providerObservationPath.startsWith(`${runRoot}/`), "provider observation must stay under run root");
  assert(item.semanticQaPath.startsWith(`${runRoot}/`), "semantic QA must stay under run root");
  assert(item.promptPath.startsWith(`${smallProjectFixture.projectRoot}/`), "prompt must stay under project root");
  for (const referencePath of item.referencePaths) {
    assertPortable(referencePath, "referencePath");
    assert(referencePath.startsWith(`${smallProjectFixture.projectRoot}/`), "reference must stay under project root");
  }
}

assert(!JSON.stringify(readyPlan).includes("submitId"), "plan must not expose submitId");
assert(!JSON.stringify(readyPlan).includes("providerTaskId"), "plan must not expose providerTaskId");

console.log("Current project Image2 batch contract tests passed. No provider calls were made.");
