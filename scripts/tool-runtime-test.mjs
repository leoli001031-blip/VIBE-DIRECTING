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

assert(importResult.status === 0, "tool runtime test could not refresh runtime-state with import-runtime-test");

const requiredCategories = [
  "agent_cli",
  "node_runtime",
  "rust_runtime_or_app_shell",
  "media_binary",
  "image_tool",
  "python_optional",
  "provider_cli_optional",
  "vcs_optional",
  "package_manager",
];

const requiredSourceLayers = [
  "runtime.config",
  "runtime.detectionReport",
  "runtime.providerEnablementSummary",
  "adapterContracts",
  "generationHarness",
  "filesystemWatcherHarness",
  "checkpointResumeHarness",
  "qaHarness",
];

const hardLocks = {
  dryRunOnly: true,
  diagnosticsOnly: true,
  noInstall: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noSystemSettingsMutation: true,
  arbitraryShellExecutionBlocked: true,
  sidecarDaemonDisabled: true,
  providerSubmissionForbidden: true,
  liveSubmitAllowed: false,
  platformPathAbstractionRequired: true,
};

const statuses = ["ready", "missing", "planned", "blocked", "unknown"];
const pathStatuses = ["path", "missing", "unknown", "planned", "blocked"];

const state = readJson("public/runtime-state.json");
const harness = state.toolRuntimeHarness;
assert(harness, "runtime-state missing toolRuntimeHarness");
assert(harness.schemaVersion === "0.1.0", "toolRuntimeHarness schemaVersion drifted");
assert(JSON.stringify(harness.toolCategories) === JSON.stringify(requiredCategories), "tool runtime categories must be fixed and ordered");

for (const [key, expected] of Object.entries(hardLocks)) {
  assert(harness.hardLocks[key] === expected, `hard lock ${key} must be ${expected}`);
  assert(harness[key] === expected, `top-level ${key} must be ${expected}`);
}

assert(harness.liveSubmitAllowed === false, "toolRuntimeHarness liveSubmitAllowed must be false");
assert(harness.providerSubmissionForbidden === true, "toolRuntimeHarness providerSubmissionForbidden must be true");
assert(harness.arbitraryShellExecutionBlocked === true, "toolRuntimeHarness arbitrary shell execution must be blocked");

const categoriesInChecks = new Set(harness.checks.map((check) => check.category));
for (const category of requiredCategories) {
  assert(categoriesInChecks.has(category), `tool runtime checks missing category ${category}`);
}

for (const check of harness.checks) {
  assert(check.checkId, "check row must include checkId");
  assert(requiredCategories.includes(check.category), `${check.checkId} has invalid category ${check.category}`);
  assert(check.label, `${check.checkId} must include label`);
  assert(Array.isArray(check.requiredFor), `${check.checkId} requiredFor must be an array`);
  assert(statuses.includes(check.status), `${check.checkId} has invalid status ${check.status}`);
  assert(pathStatuses.includes(check.pathStatus), `${check.checkId} has invalid pathStatus ${check.pathStatus}`);
  assert(check.platformSupport, `${check.checkId} must include platformSupport`);
  assert(["supported", "planned", "unknown", "unsupported"].includes(check.platformSupport.darwin), `${check.checkId} missing darwin support status`);
  assert(["supported", "planned", "unknown", "unsupported"].includes(check.platformSupport.win32), `${check.checkId} missing win32 support status`);
  assert(check.platformSupport.pathStyles.includes("posix"), `${check.checkId} platformSupport must include posix`);
  assert(check.platformSupport.pathStyles.includes("win32"), `${check.checkId} platformSupport must include win32`);
  assert(check.platformSupport.pathStyles.includes("project-root-relative"), `${check.checkId} platformSupport must include project-root-relative`);
  assert(check.canExecuteNow === false, `${check.checkId} canExecuteNow must be false`);
  assert(check.executionMode === "diagnostic_only", `${check.checkId} executionMode must be diagnostic_only`);
  assert(typeof check.missingIsBlocker === "boolean", `${check.checkId} missingIsBlocker must be boolean`);
  assert(Array.isArray(check.blockers), `${check.checkId} blockers must be an array`);
  assert(Array.isArray(check.warnings), `${check.checkId} warnings must be an array`);
  assert(Array.isArray(check.sourceRefs) && check.sourceRefs.length > 0, `${check.checkId} sourceRefs must link facts`);
  assert(Array.isArray(check.notes), `${check.checkId} notes must be an array`);
  if (check.status === "missing" && !check.missingIsBlocker) {
    assert(check.blockers.length === 0, `${check.checkId} optional missing tool must not create blockers`);
  }
}

assert(harness.summary.totalChecks === harness.checks.length, "summary totalChecks must match checks length");
assert(harness.summary.ready === harness.checks.filter((check) => check.status === "ready").length, "summary ready count drifted");
assert(harness.summary.missing === harness.checks.filter((check) => check.status === "missing").length, "summary missing count drifted");
assert(harness.summary.planned === harness.checks.filter((check) => check.status === "planned").length, "summary planned count drifted");
assert(harness.summary.blocked === harness.checks.filter((check) => check.status === "blocked").length, "summary blocked count drifted");
assert(harness.summary.unknown === harness.checks.filter((check) => check.status === "unknown").length, "summary unknown count drifted");
assert(harness.summary.canExecuteNow === false, "summary canExecuteNow must be false");
assert(harness.summary.dryRunOnly === true, "summary dryRunOnly must be true");
assert(harness.summary.diagnosticsOnly === true, "summary diagnosticsOnly must be true");
assert(harness.summary.liveSubmitAllowed === false, "summary liveSubmitAllowed must be false");
assert(harness.summary.providerSubmissionForbidden === true, "summary providerSubmissionForbidden must be true");
assert(harness.summary.arbitraryShellExecutionBlocked === true, "summary arbitraryShellExecutionBlocked must be true");

assert(harness.pathPolicy.platformPathAbstractionRequired === true, "path policy must require platform path abstraction");
assert(harness.pathPolicy.projectRootRelativeRequired === true, "path policy must require project-root-relative paths");
assert(harness.pathPolicy.hardcodedShellPathForbidden === true, "path policy must forbid hardcoded shell paths");
assert(harness.pathPolicy.shellProfilePathLookupForbidden === true, "path policy must forbid shell profile path lookup");
assert(harness.pathPolicy.pathResolverRequired === true, "path policy must require runtime path resolver");
assert(
  harness.pathPolicy.policies.some((policy) => policy.platform === "darwin" && policy.pathStyle === "posix" && policy.required === true),
  "path policy must include darwin posix",
);
assert(
  harness.pathPolicy.policies.some((policy) => policy.platform === "win32" && policy.pathStyle === "win32" && policy.required === true),
  "path policy must include win32",
);
assert(
  harness.pathPolicy.policies.some((policy) => policy.pathStyle === "project-root-relative" && policy.required === true),
  "path policy must include project-root-relative",
);
assert(harness.platformCompatibility.darwinPathStyle === "posix", "platformCompatibility must set darwin path style to posix");
assert(harness.platformCompatibility.win32PathStyle === "win32", "platformCompatibility must set win32 path style to win32");
assert(harness.platformCompatibility.projectRootRelative === true, "platformCompatibility must require project-root-relative");
assert(harness.platformCompatibility.hardcodedShellPathForbidden === true, "platformCompatibility must forbid hardcoded shell paths");

const coverageByLayer = new Map(harness.sourceCoverage.map((entry) => [entry.layer, entry]));
for (const layer of requiredSourceLayers) {
  const coverage = coverageByLayer.get(layer);
  assert(coverage, `sourceCoverage missing ${layer}`);
  assert(coverage.referenced === true, `sourceCoverage ${layer} must be referenced`);
  assert(coverage.referenceCount === coverage.sourceRefs.length, `sourceCoverage ${layer} referenceCount drifted`);
  assert(coverage.sourceRefs.length > 0, `sourceCoverage ${layer} must include sourceRefs`);
}

const joinedRefs = JSON.stringify([
  ...harness.checks.flatMap((check) => check.sourceRefs),
  ...harness.sourceCoverage.flatMap((coverage) => coverage.sourceRefs),
  ...harness.pathPolicy.sourceRefs,
]);
for (const refToken of requiredSourceLayers) {
  assert(joinedRefs.includes(refToken), `sourceRefs must connect ${refToken}`);
}

const schema = readJson("schemas/tool_runtime_harness.schema.json");
assert(schema.title === "ToolRuntimeHarnessState", "tool runtime harness schema title drifted");
for (const [key, expected] of Object.entries(hardLocks)) {
  assert(schema.properties[key].const === expected, `schema must pin ${key}=${expected}`);
  assert(schema.$defs.hardLocks.properties[key].const === expected, `schema hardLocks must pin ${key}=${expected}`);
}
assert(schema.properties.summary.properties.canExecuteNow.const === false, "schema must pin summary canExecuteNow=false");
assert(schema.$defs.checkRow.properties.canExecuteNow.const === false, "schema must pin check canExecuteNow=false");
assert(schema.$defs.checkRow.properties.executionMode.const === "diagnostic_only", "schema must pin check executionMode=diagnostic_only");
assert(schema.$defs.pathPolicy.properties.hardcodedShellPathForbidden.const === true, "schema must forbid hardcoded shell-only paths");
assert(schema.$defs.platformCompatibility.properties.darwinPathStyle.const === "posix", "schema must pin darwin path style");
assert(schema.$defs.platformCompatibility.properties.win32PathStyle.const === "win32", "schema must pin win32 path style");
assert(schema.$defs.platformCompatibility.properties.projectRootRelative.const === true, "schema must pin project-root-relative");

const projectSchema = readJson("schemas/project_runtime_state.schema.json");
assert(projectSchema.required.includes("toolRuntimeHarness"), "project runtime schema must require toolRuntimeHarness");
assert(
  projectSchema.properties.toolRuntimeHarness.$ref === "tool_runtime_harness.schema.json",
  "project runtime schema must reference tool_runtime_harness schema",
);

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("tool_runtime_harness.schema.json"), "schema registry must include tool_runtime_harness.schema.json");

console.log(
  `Tool runtime harness tests passed: ${harness.checks.length} checks, ${harness.summary.missingBlockers} missing blockers, ${harness.summary.optionalMissing} optional missing.`,
);
