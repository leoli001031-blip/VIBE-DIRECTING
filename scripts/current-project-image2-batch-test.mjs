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
  return {
    image2Batch: await import(pathToFileURL(path.join(coreDir, "currentProjectImage2Batch.mjs")).href),
    assetLibrary: await import(pathToFileURL(path.join(coreDir, "assetLibraryCrud.mjs")).href),
  };
}

const generatedAt = "2026-05-07T04:30:00.000Z";
const runId = "current_project_image2_batch_001";
const runRoot = `${smallProjectFixture.projectRoot}/real-test-sandbox/${smallProjectFixture.batchId}`;
const {
  image2Batch: {
    buildCurrentProjectImage2BatchPlan,
    buildCurrentProjectImage2ReferencesFromAssetLibrary,
  },
  assetLibrary: {
    addAssetLibraryAsset,
    createAssetLibrarySnapshot,
  },
} = await loadCurrentProjectImage2BatchCore();

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

function addAsset(library, input) {
  const result = addAssetLibraryAsset(library, {
    textConstraints: ["locked asset consistency reference"],
    updatedAt: generatedAt,
    ...input,
  });
  assert(result.validation.ok, `asset should validate: ${result.validation.errors.join("; ")}`);
  return result.library;
}

function lockedAssetLibrary(overrides = {}) {
  let library = createAssetLibrarySnapshot({ id: "image2_batch_asset_library", createdAt: generatedAt });
  library = addAsset(library, {
    id: "hero_locked",
    assetType: "character",
    name: "Hero Locked",
    status: "locked",
    sourceKind: "source_asset",
    path: smallProjectFixture.characterPath,
    ...overrides.character,
  });
  library = addAsset(library, {
    id: "scene_locked",
    assetType: "scene",
    name: "Scene Locked",
    status: "locked",
    sourceKind: "source_asset",
    path: smallProjectFixture.scenePath,
    ...overrides.scene,
  });
  library = addAsset(library, {
    id: "style_locked",
    assetType: "style",
    name: "Style Locked",
    status: "locked",
    sourceKind: "source_asset",
    path: smallProjectFixture.stylePath,
    ...overrides.style,
  });
  return library;
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

const lockedLibrary = lockedAssetLibrary();
const assetLibraryProjection = buildCurrentProjectImage2ReferencesFromAssetLibrary(lockedLibrary);
assert(assetLibraryProjection.blockers.length === 0, `locked library should not block: ${compact(assetLibraryProjection.blockers)}`);
assert(assetLibraryProjection.summary.eligibleCount === 3, "locked library must expose three Image2 future references");
assert(assetLibraryProjection.summary.byRole.character === 1, "locked library character summary drifted");
assert(assetLibraryProjection.summary.byRole.scene === 1, "locked library scene summary drifted");
assert(assetLibraryProjection.summary.byRole.style === 1, "locked library style summary drifted");

const assetLibraryReadyPlan = buildCurrentProjectImage2BatchPlan(baseInput({
  references: undefined,
  assetLibrary: lockedLibrary,
}));
assert(assetLibraryReadyPlan.status === "ready_for_review", `locked asset library should make batch ready: ${compact(assetLibraryReadyPlan.blockers)}`);
for (const item of assetLibraryReadyPlan.items) {
  assert(item.referencePaths.includes(smallProjectFixture.characterPath), "asset library character reference missing from batch item");
  assert(item.referencePaths.includes(smallProjectFixture.scenePath), "asset library scene reference missing from batch item");
  assert(item.referencePaths.includes(smallProjectFixture.stylePath), "asset library style reference missing from batch item");
}

for (const status of ["review", "candidate"]) {
  const blockedLibrary = lockedAssetLibrary({ style: { status } });
  const blockedProjection = buildCurrentProjectImage2ReferencesFromAssetLibrary(blockedLibrary);
  assert(blockedProjection.blockers.includes("asset_library_missing_locked_style_future_reference"), `${status} style must leave style future reference missing`);
  assert(
    blockedProjection.warnings.some((warning) => warning === `asset_library_style_locked_status_${status}_not_locked`),
    `${status} style must report asset authority blocker`,
  );

  const blockedFromLibraryPlan = buildCurrentProjectImage2BatchPlan(baseInput({
    references: undefined,
    assetLibrary: blockedLibrary,
  }));
  assert(blockedFromLibraryPlan.status === "blocked", `${status} style from asset library must block`);
  assert(blockedFromLibraryPlan.blockers.includes("missing_locked_style_reference"), `${status} style must surface batch missing locked style blocker`);
  assert(
    blockedFromLibraryPlan.blockers.includes("asset_library_missing_locked_style_future_reference"),
    `${status} style must surface asset library style blocker`,
  );
}

let rejectedAndBlockedLibrary = lockedAssetLibrary();
rejectedAndBlockedLibrary = addAsset(rejectedAndBlockedLibrary, {
  id: "rejected_style_case",
  assetType: "style",
  name: "Rejected Style Case",
  status: "rejected",
  sourceKind: "source_asset",
  path: `${smallProjectFixture.projectRoot}/assets/styles/rejected/style.png`,
});
const contactSheetAttempt = addAssetLibraryAsset(rejectedAndBlockedLibrary, {
  id: "contact_sheet_case",
  assetType: "style",
  name: "Contact Sheet Case",
  status: "locked",
  sourceKind: "contact_sheet",
  path: "reports/contact_sheets/style.png",
  textConstraints: ["must be rejected before asset library"],
  updatedAt: generatedAt,
});
assert(contactSheetAttempt.rejected, "contact sheet import must be blocked before entering Asset Library refs");
rejectedAndBlockedLibrary = contactSheetAttempt.library;
for (const blockedSourceKind of ["provider_temp_output", "failed_output", "shot_output"]) {
  const blockedAttempt = addAssetLibraryAsset(rejectedAndBlockedLibrary, {
    id: `${blockedSourceKind}_case`,
    assetType: "character",
    name: blockedSourceKind,
    status: "locked",
    sourceKind: blockedSourceKind,
    path: `outputs/${blockedSourceKind}/case.png`,
    textConstraints: ["must be rejected before asset library"],
    updatedAt: generatedAt,
  });
  assert(blockedAttempt.rejected, `${blockedSourceKind} import must be blocked before entering Asset Library refs`);
  rejectedAndBlockedLibrary = blockedAttempt.library;
}
const rejectedProjection = buildCurrentProjectImage2ReferencesFromAssetLibrary(rejectedAndBlockedLibrary);
assert(rejectedProjection.summary.byRole.style === 1, "rejected style must not add an extra style future reference");
assert(
  rejectedProjection.warnings.some((warning) => warning === "asset_library_rejected_style_case_status_rejected_not_locked"),
  "rejected style must be reported as not future-reference eligible",
);
assert(
  rejectedProjection.warnings.some((warning) => warning === "asset_library_blocked_import_contact_sheet_not_future_reference"),
  "blocked contact sheet import must be reported as not future-reference eligible",
);
for (const blockedSourceKind of ["provider_temp_output", "failed_output", "shot_output"]) {
  assert(
    rejectedProjection.warnings.some((warning) => warning === `asset_library_blocked_import_${blockedSourceKind}_not_future_reference`),
    `${blockedSourceKind} blocked import must be reported as not future-reference eligible`,
  );
}

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
