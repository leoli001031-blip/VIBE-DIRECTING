import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function readJson(filePath: string): any {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function assertNoRawSecret(payload: unknown, label: string): void {
  const text = JSON.stringify(payload);
  assert(!/\bsk-[A-Za-z0-9_-]{12,}\b/.test(text), `${label} must not contain raw sk-* material`);
  assert(!/\bBearer\s+[A-Za-z0-9._-]{12,}\b/i.test(text), `${label} must not contain bearer tokens`);
  assert(!/"apiKey"\s*:/.test(text), `${label} must not expose apiKey fields`);
}

function runSmoke(fixtureRoot: string, runId: string) {
  const result = spawnSync("npx", [
    "tsx",
    "scripts/real-small-project-multishot-image2-smoke.mts",
    `--fixture-root=${fixtureRoot}`,
    `--run-id=${runId}`,
    "--shot-count=4",
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VIBE_REAL_SMALL_PROJECT_MULTISHOT_LIVE: "",
      VIBE_REAL_SMALL_PROJECT_MULTISHOT_CONFIRM: "",
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `smoke should pass\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return result;
}

const packageJson = readJson(path.join(process.cwd(), "package.json"));
assert.equal(
  packageJson.scripts["real-small-project-multishot-image2:smoke"],
  "tsx scripts/real-small-project-multishot-image2-smoke.mts",
  "package smoke script missing",
);
assert.equal(
  packageJson.scripts["real-small-project-multishot-image2:test"],
  "tsx scripts/real-small-project-multishot-image2-smoke-test.mts",
  "package test script missing",
);
assert.equal(
  packageJson.scripts["real-small-project-multishot-image2:live"],
  "tsx scripts/real-small-project-multishot-image2-smoke.mts --live",
  "package live script missing",
);

const fixtureRoot = mkdtempSync(path.join(tmpdir(), "vibe-multishot-image2-smoke-"));
const runId = "multishot-image2-smoke-contract";
runSmoke(fixtureRoot, runId);

const reportPath = path.join(fixtureRoot, "report", "report.json");
const report = readJson(reportPath);
assertNoRawSecret(report, "multi-shot report");

assert.equal(report.ok, true, "default mock smoke should pass");
assert.equal(report.mode, "mock", "default smoke must be mock mode");
assert.equal(report.provider.providerCalledExternal, false, "mock smoke must not call external provider");
assert.equal(report.provider.mockProviderCalled, true, "mock smoke should exercise mock provider");
assert.equal(report.provider.maxConcurrency, 3, "default max concurrency should be 3");
assert.equal(report.provider.retryConcurrency, 2, "default retry concurrency should be 2");
assert.equal(report.provider.maxAutoRetries, 2, "default retry budget should be 2");
assert.equal(report.provider.requestedSize, "1280x720", "default Image2 smoke size should match the Jimeng 720p input grid");
assert.equal(report.provider.requestedAspectRatio, "16:9", "default Image2 smoke aspect should be 16:9");
assert.equal(report.summary.assetsPlanned, 3, "smoke should produce three asset plans");
assert.equal(report.summary.startFramesPlanned, 4, "smoke should produce four start-frame plans in this test");
assert.equal(report.summary.missing, 0, "default recoverable mock should end with no missing outputs");
assert(report.summary.retryAttempted >= 1, "default mock should exercise retry");
assert(report.summary.retryRecovered >= 1, "default mock should recover at least one retry");
assert.deepEqual(report.advancedBranches, {
  endFrameStatus: "skipped",
  videoStatus: "skipped",
  endpointLoopStatus: "skipped",
  transformationStatus: "skipped",
  reason: "Default smoke covers the stable front half: assets plus start frames only.",
});

const projectVibePath = path.join(fixtureRoot, "Project.vibe");
const exportManifestPath = path.join(fixtureRoot, "receipts", "export-package-manifest.json");
const summaryMarkdownPath = path.join(fixtureRoot, "report", "summary.md");
assert(existsSync(projectVibePath), "Project.vibe must exist at package root");
assert(existsSync(exportManifestPath), "export manifest must live under receipts/");
assert(existsSync(summaryMarkdownPath), "summary markdown must live under report/");
assert.equal(readdirSync(path.join(fixtureRoot, "assets")).filter((file) => file.endsWith(".png")).length, 3, "assets folder should contain three PNGs");
assert.equal(readdirSync(path.join(fixtureRoot, "start-frames")).filter((file) => file.endsWith(".png")).length, 4, "start-frames folder should contain four PNGs");

for (const output of report.outputs) {
  assert.equal(output.returnStatus, "needs_review", `${output.id} should require review`);
  assert.equal(output.promotionAllowed, false, `${output.id} must not be promotable`);
  assert(typeof output.outputPath === "string" && !path.isAbsolute(output.outputPath), `${output.id} output path should be package-relative`);
  const outputPath = path.join(fixtureRoot, output.outputPath);
  assert(existsSync(outputPath), `${output.id} output file should exist`);
  assert(statSync(outputPath).size > 0, `${output.id} output file should not be empty`);
}

const projectVibe = readJson(projectVibePath);
assert.equal(projectVibe.kind, "project_vibe_document", "Project.vibe should use the Project.vibe document shape");
assert.equal(projectVibe.storyFlow.shotOrder.length, 4, "Project.vibe should expose four shots");
assert.equal(projectVibe.assets.length, 3, "Project.vibe should expose three assets");
assert(projectVibe.receipts.reviewReceipts.every((receipt: any) => receipt.status === "needs_review"), "Project.vibe review receipts should stay needs_review");

const manifest = readJson(exportManifestPath);
assert.equal(manifest.projectVibe, "Project.vibe", "manifest should point to root Project.vibe");
assert.equal(manifest.folders.assets, "assets/", "manifest should expose assets folder");
assert.equal(manifest.folders.startFrames, "start-frames/", "manifest should expose start-frames folder");
assert.equal(manifest.folders.receipts, "receipts/", "manifest should expose receipts folder");
assert.equal(manifest.folders.report, "report/", "manifest should expose report folder");
assert.equal(manifest.advancedBranches.endFrames, "skipped_by_default", "end frames must stay out of default smoke");
assert.equal(manifest.provider.rawCredentialMaterialIncluded, false, "manifest must not include credentials");
assertNoRawSecret(manifest, "export manifest");

runSmoke(fixtureRoot, runId);
const resumedReport = readJson(reportPath);
assert.equal(resumedReport.summary.recoveredFromExisting, 7, "rerun should recover all existing outputs from receipts");
assert.equal(resumedReport.provider.mockProviderCalled, false, "rerun with complete receipts should not call mock provider again");
assert.equal(resumedReport.provider.providerCalledExternal, false, "rerun must still avoid external provider");
assert.equal(resumedReport.providerResults.length, 0, "rerun should not create new provider attempts");

console.log(`real-small-project-multishot-image2-smoke-test: ok ${fixtureRoot}`);
