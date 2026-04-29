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

assert(importResult.status === 0, "qa harness test could not refresh runtime-state with import-runtime-test");

const requiredDimensions = [
  "whole_film",
  "identity",
  "scene",
  "pair",
  "story",
  "prop",
  "style",
  "motion",
  "audio",
];

const requiredSourceLayers = [
  "generationHealthReports",
  "qaPromotionReports",
  "manifestMatches",
  "assetReadinessReports",
  "promptPlans",
  "promptConflictReports",
  "generationHarness",
  "filesystemWatcherHarness",
  "checkpointResumeHarness",
  "videoPlanning",
  "audioPlanning",
  "storyFlow.shots",
];

const gateStatuses = ["PASS", "PARTIAL", "FAIL", "N/A", "UNKNOWN"];
const severities = ["blocker", "warning", "info"];

function assertDimensionArray(dimensions, label) {
  assert(Array.isArray(dimensions), `${label} dimensions must be an array`);
  assert(dimensions.length === requiredDimensions.length, `${label} must include every QA dimension`);
  requiredDimensions.forEach((dimensionId, index) => {
    const dimension = dimensions[index];
    assert(dimension.dimensionId === dimensionId, `${label} dimension ${index + 1} must be ${dimensionId}`);
    assert(gateStatuses.includes(dimension.status), `${label} ${dimensionId} has invalid status`);
    assert(severities.includes(dimension.severity), `${label} ${dimensionId} has invalid severity`);
    assert(Array.isArray(dimension.blockers), `${label} ${dimensionId} blockers must be an array`);
    assert(Array.isArray(dimension.warnings), `${label} ${dimensionId} warnings must be an array`);
    assert(Array.isArray(dimension.sourceRefs), `${label} ${dimensionId} sourceRefs must be an array`);
    assert(Array.isArray(dimension.notes), `${label} ${dimensionId} notes must be an array`);
    if (dimension.status === "PASS") {
      assert(dimension.sourceRefs.length > 0, `${label} ${dimensionId} cannot PASS without source facts`);
    }
    if (dimension.blockers.length > 0) {
      assert(dimension.status === "FAIL", `${label} ${dimensionId} blockers must force FAIL`);
      assert(dimension.severity === "blocker", `${label} ${dimensionId} blockers must set blocker severity`);
    }
  });
}

function assertCoverage(coverage, label) {
  assert(Array.isArray(coverage), `${label} sourceCoverage must be an array`);
  const layers = coverage.map((entry) => entry.layer);
  for (const layer of requiredSourceLayers) {
    const entry = coverage.find((item) => item.layer === layer);
    assert(entry, `${label} sourceCoverage missing ${layer}`);
    assert(typeof entry.referenced === "boolean", `${label} ${layer}.referenced must be boolean`);
    assert(typeof entry.referenceCount === "number", `${label} ${layer}.referenceCount must be numeric`);
    assert(Array.isArray(entry.sourceRefs), `${label} ${layer}.sourceRefs must be an array`);
    assert(Array.isArray(entry.notes), `${label} ${layer}.notes must be an array`);
    assert(entry.referenced === entry.sourceRefs.length > 0, `${label} ${layer}.referenced must match sourceRefs`);
    assert(entry.referenceCount === entry.sourceRefs.length, `${label} ${layer}.referenceCount must match sourceRefs`);
  }
  assert(new Set(layers).size === layers.length, `${label} sourceCoverage layers must be unique`);
}

function manifestMatched(status) {
  return ["actual_output_present", "complete", "matched"].includes(status);
}

const state = readJson("public/runtime-state.json");
const harness = state.qaHarness;
assert(harness, "runtime-state missing qaHarness");
assert(harness.schemaVersion === "0.1.0", "qaHarness schemaVersion drifted");
assert(harness.dryRunOnly === true, "qaHarness dryRunOnly must be true");
assert(harness.providerSubmissionForbidden === true, "qaHarness must forbid provider submission");
assert(harness.liveSubmitAllowed === false, "qaHarness liveSubmitAllowed must be false");
assert(harness.noFileMutation === true, "qaHarness must forbid file mutation");
assert(harness.noAutoPromotion === true, "qaHarness must forbid auto-promotion");
assert(harness.planOnly === true, "qaHarness must be plan-only");
assert(harness.diagnosticsOnly === true, "qaHarness must be diagnostics-only");

const keyOrder = Object.keys(harness);
assert(keyOrder.indexOf("overall") !== -1 && keyOrder.indexOf("items") !== -1, "qaHarness must include overall and items");
assert(keyOrder.indexOf("overall") < keyOrder.indexOf("items"), "qaHarness must emit overall before item details");
assert(JSON.stringify(harness.dimensionOrder) === JSON.stringify(requiredDimensions), "qaHarness dimensionOrder must be fixed");

const locks = harness.hardLocks;
assert(locks.dryRunOnly === true, "hard lock dryRunOnly must be true");
assert(locks.providerSubmissionForbidden === true, "hard lock providerSubmissionForbidden must be true");
assert(locks.liveSubmitAllowed === false, "hard lock liveSubmitAllowed must be false");
assert(locks.noFileMutation === true, "hard lock noFileMutation must be true");
assert(locks.noAutoPromotion === true, "hard lock noAutoPromotion must be true");
assert(locks.semanticRepairForbidden === true, "hard lock semanticRepairForbidden must be true");
assert(locks.workerSelfReportCannotPassQa === true, "hard lock workerSelfReportCannotPassQa must be true");
assert(locks.overallFirst === true, "hard lock overallFirst must be true");

assert(harness.overall.overallFirst === true, "overall sequence must set overallFirst=true");
assertDimensionArray(harness.overall.dimensions, "overall");
assertCoverage(harness.overall.sourceCoverage, "overall");
assertCoverage(harness.sourceCoverage, "qaHarness");
assert(harness.summary.totalItems === harness.items.length, "summary totalItems must match item count");
assert(harness.summary.totalItems === state.storyFlow.shots.length, "qaHarness items must mirror storyFlow shots");
assert(harness.summary.overallFirst === true, "summary overallFirst must be true");
assert(harness.summary.dryRunOnly === true, "summary dryRunOnly must be true");
assert(harness.summary.liveSubmitAllowed === false, "summary liveSubmitAllowed must be false");
assert(harness.summary.noFileMutation === true, "summary noFileMutation must be true");
assert(harness.summary.overallStatus === harness.overall.status, "summary overallStatus must mirror overall status");

const healthByTaskPlan = new Map(state.imagePipeline.generationHealthReports.map((report) => [report.taskPlanId, report]));
const manifestByTaskId = new Map(state.manifestMatches.reports.map((report) => [report.taskId, report]));
const readinessByShot = new Map(state.imagePipeline.assetReadinessReports.map((report) => [report.shotId, report]));
const promotionByShot = new Map();
for (const report of state.imagePipeline.qaPromotionReports) {
  promotionByShot.set(report.shotId, [...(promotionByShot.get(report.shotId) || []), report]);
}

for (const item of harness.items) {
  assert(item.shotId, `${item.qaItemId} must bind at least shotId`);
  assert(state.storyFlow.shots.some((shot) => shot.id === item.shotId), `${item.qaItemId} shotId must exist in storyFlow`);
  assertDimensionArray(item.dimensions, item.qaItemId);
  assertCoverage(item.sourceCoverage, item.qaItemId);
  assert(typeof item.formalPromotionEligible === "boolean", `${item.qaItemId} formalPromotionEligible must be boolean`);
  assert(Array.isArray(item.formalPromotionBlockedReasons), `${item.qaItemId} formalPromotionBlockedReasons must be an array`);
  assert(typeof item.requiresHumanReview === "boolean", `${item.qaItemId} requiresHumanReview must be boolean`);

  const shouldRequireReview =
    item.formalPromotionBlockedReasons.length > 0 ||
    item.dimensions.some((dimension) => ["UNKNOWN", "FAIL", "PARTIAL"].includes(dimension.status) || dimension.blockers.length > 0);
  if (shouldRequireReview) {
    assert(item.requiresHumanReview === true, `${item.qaItemId} must require human review for UNKNOWN/PARTIAL/FAIL/blockers`);
  }

  if (item.formalPromotionEligible) {
    const promotions = promotionByShot.get(item.shotId) || [];
    assert(promotions.length > 0, `${item.qaItemId} formalPromotionEligible requires QA promotion reports`);
    assert(item.formalPromotionBlockedReasons.length === 0, `${item.qaItemId} eligible item cannot carry promotion blockers`);
    for (const promotion of promotions) {
      const health = healthByTaskPlan.get(promotion.taskPlanId);
      const manifest = manifestByTaskId.get(promotion.taskPlanId) || manifestByTaskId.get(promotion.jobId);
      const readiness = readinessByShot.get(promotion.shotId);
      assert(promotion.canPromoteToFormal === true, `${item.qaItemId} eligibility must come from qaPromotion.canPromoteToFormal`);
      assert(health?.healthStatus === "formal_ready", `${item.qaItemId} eligibility requires generation health formal_ready`);
      assert(health?.qaStatus === "pass", `${item.qaItemId} eligibility requires explicit QA pass`);
      assert(health?.stalePrompt === false, `${item.qaItemId} eligibility requires fresh prompt`);
      assert(manifestMatched(health?.manifestStatus || manifest?.status), `${item.qaItemId} eligibility requires manifest match`);
      assert(readiness?.status === "ready" && readiness.formalBlocked === false, `${item.qaItemId} eligibility requires ready asset readiness`);
      assert(Object.values(promotion.requiredGates).every(Boolean), `${item.qaItemId} eligibility requires all promotion required gates`);
    }
  }
}

assert(
  harness.summary.requiresHumanReview === harness.items.filter((item) => item.requiresHumanReview).length,
  "summary requiresHumanReview must match item facts",
);
assert(
  harness.summary.formalPromotionEligible === harness.items.filter((item) => item.formalPromotionEligible).length,
  "summary formalPromotionEligible must match item facts",
);
assert(
  harness.summary.formalPromotionBlocked === harness.items.filter((item) => !item.formalPromotionEligible).length,
  "summary formalPromotionBlocked must match item facts",
);

const schema = readJson("schemas/qa_harness.schema.json");
assert(schema.title === "QaHarnessState", "QA harness schema title drifted");
assert(schema.properties.dryRunOnly.const === true, "schema must pin dryRunOnly true");
assert(schema.properties.providerSubmissionForbidden.const === true, "schema must pin providerSubmissionForbidden true");
assert(schema.properties.liveSubmitAllowed.const === false, "schema must pin liveSubmitAllowed false");
assert(schema.properties.noFileMutation.const === true, "schema must pin noFileMutation true");
assert(schema.properties.noAutoPromotion.const === true, "schema must pin noAutoPromotion true");
assert(schema.properties.planOnly.const === true, "schema must pin planOnly true");
assert(schema.properties.diagnosticsOnly.const === true, "schema must pin diagnosticsOnly true");
assert(schema.$defs.hardLocks.properties.semanticRepairForbidden.const === true, "schema must pin semanticRepairForbidden true");
assert(schema.$defs.hardLocks.properties.workerSelfReportCannotPassQa.const === true, "schema must pin worker self-report QA lock true");
assert(schema.$defs.hardLocks.properties.overallFirst.const === true, "schema must pin overallFirst true");

const projectSchema = readJson("schemas/project_runtime_state.schema.json");
assert(projectSchema.required.includes("qaHarness"), "project runtime schema must require qaHarness");
assert(projectSchema.properties.qaHarness.$ref === "qa_harness.schema.json", "project runtime schema must reference qa_harness schema");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("qa_harness.schema.json"), "schema registry must include qa_harness.schema.json");

console.log(
  `QA harness tests passed: ${harness.items.length} items, ${harness.summary.requiresHumanReview} human-review, ${harness.summary.formalPromotionEligible} promotion-eligible.`,
);
