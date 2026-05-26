import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRuntimeApiRealDemo005Runner } from "./runtime-api-real-demo-005-runner.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

const endpoints = {
  realDemo005StatusEndpoint: "/api/runtime/real-demo-e2e/005/status",
  realDemo005RunEndpoint: "/api/runtime/real-demo-e2e/005/run",
};

function createFixture(reportText) {
  const root = mkdtempSync(path.join(tmpdir(), "vibe-core-005-runner-"));
  const reportPath = path.join(root, "report.json");
  if (reportText !== undefined) writeFileSync(reportPath, reportText);
  const source = {
    sandboxSource: "005 sandbox",
    reportPath,
    reportRelativePath: "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames/reports/image2_start_long_chain_report.json",
  };
  const writes = [];
  let running = false;
  const runner = createRuntimeApiRealDemo005Runner({
    endpoints,
    existsSync,
    maxOutputChars: 12,
    readJson: (filePath) => JSON.parse(readFileSync(filePath, "utf8")),
    realDemo005Source: () => source,
    repoRoot: root,
    runtimeFileUrl: (relativePath, scope) => `/runtime-file?path=${relativePath}${scope ? `&scope=${scope}` : ""}`,
    runtimePolicy: () => ({
      schemaVersion: "vibe_core_local_runtime_api_v1",
      providerCalled: false,
      prepareRan: false,
    }),
    setRunning: (value) => {
      running = value;
    },
    verifyScript: path.join(root, "verify.mjs"),
    writeJson: (res, statusCode, payload) => {
      writes.push({ statusCode, payload });
      res.writes.push({ statusCode, payload });
    },
    running: () => running,
  });
  return {
    cleanup: () => rmSync(root, { recursive: true, force: true }),
    res: { writes: [] },
    runner,
    source,
    writes,
  };
}

{
  const fixture = createFixture();
  try {
    const payload = fixture.runner.responseFromReport({ running: false });
    assertEqual(payload.ok, false, "unavailable ok");
    assertEqual(payload.endpoint, endpoints.realDemo005StatusEndpoint, "unavailable endpoint");
    assertEqual(payload.status, "unavailable", "unavailable status");
    assertEqual(payload.previewStatus, "unavailable", "unavailable previewStatus");
    assertEqual(payload.productionStatus, "unavailable", "unavailable productionStatus");
    assertEqual(payload.providerCalled, false, "unavailable providerCalled");
    assertEqual(payload.prepareRan, false, "unavailable prepareRan");
    assertEqual(payload.reportPath, fixture.source.reportPath, "unavailable reportPath");
    assert(payload.reportUrl.endsWith("&scope=real-demo-e2e-005"), "unavailable scoped reportUrl");
    assertEqual(payload.sourceProject, undefined, "unavailable sourceProject must be stripped");
  } finally {
    fixture.cleanup();
  }
}

{
  const fixture = createFixture(JSON.stringify({
    status: "needs_review",
    previewStatus: "ready",
    productionStatus: "blocked",
    reviewOverlayShots: ["shot-a"],
    productionNeedsReviewShots: ["shot-b"],
    shotCount: 7,
    blockers: ["hard-blocker"],
    observations: [{
      order: 1,
      shotId: "s001",
      expectedOutputPath: "outputs/s001.png",
      previewQaStatus: "ready",
      productionQaStatus: "blocked",
      reviewOverlay: true,
      runtimeTruthStatus: "verified",
      blockers: ["needs-review"],
    }],
  }));
  try {
    const payload = fixture.runner.responseFromReport({ running: true });
    assertEqual(payload.ok, true, "report ok");
    assertEqual(payload.endpoint, endpoints.realDemo005StatusEndpoint, "report endpoint");
    assertEqual(payload.status, "needs_review", "report status");
    assertEqual(payload.previewStatus, "ready", "report previewStatus");
    assertEqual(payload.productionStatus, "blocked", "report productionStatus");
    assertEqual(payload.providerCalled, false, "report providerCalled");
    assertEqual(payload.prepareRan, false, "report prepareRan");
    assertEqual(payload.running, true, "report extra running");
    assertEqual(payload.shotCount, 7, "report shotCount");
    assertEqual(payload.blockerCount, 1, "report blockerCount");
    assertEqual(payload.reviewOverlayShots[0], "shot-a", "report reviewOverlayShots");
    assertEqual(payload.productionNeedsReviewShots[0], "shot-b", "report productionNeedsReviewShots");
    assertEqual(payload.observations[0].imageUrl, "/runtime-file?path=outputs/s001.png&scope=real-demo-e2e-005", "report observation imageUrl");
  } finally {
    fixture.cleanup();
  }
}

{
  const fixture = createFixture("{");
  try {
    const payload = fixture.runner.responseFromReport();
    assertEqual(payload.ok, false, "parse failure ok");
    assertEqual(payload.status, "blocked", "parse failure status");
    assertEqual(payload.previewStatus, "blocked", "parse failure previewStatus");
    assertEqual(payload.productionStatus, "blocked", "parse failure productionStatus");
    assertEqual(payload.providerCalled, false, "parse failure providerCalled");
    assertEqual(payload.prepareRan, false, "parse failure prepareRan");
    assertEqual(payload.sourceProject, undefined, "parse failure sourceProject must be stripped");
  } finally {
    fixture.cleanup();
  }
}

{
  const fixture = createFixture(JSON.stringify({ status: "ready", productionStatus: "ready" }));
  try {
    await fixture.runner.handleRun(fixture.res, {
      endpoint: endpoints.realDemo005RunEndpoint,
      runVerify: () => Promise.resolve({ code: 2, stdout: "01234567890123456789", stderr: "failed" }),
    });
    assertEqual(fixture.writes.length, 1, "run error writes once");
    assertEqual(fixture.writes[0].statusCode, 500, "run error status code");
    const payload = fixture.writes[0].payload;
    assertEqual(payload.ok, false, "run error ok");
    assertEqual(payload.endpoint, endpoints.realDemo005RunEndpoint, "run error endpoint");
    assertEqual(payload.providerCalled, false, "run error providerCalled");
    assertEqual(payload.prepareRan, false, "run error prepareRan");
    assertEqual(payload.command.providerCalled, false, "run error command providerCalled");
    assertEqual(payload.command.prepareRan, false, "run error command prepareRan");
    assertEqual(payload.command.exitCode, 2, "run error exitCode");
    assert(payload.command.stdout.includes("...[clipped 8 chars]"), "run error stdout should be clipped");
  } finally {
    fixture.cleanup();
  }
}

{
  const fixture = createFixture(JSON.stringify({ status: "ready", productionStatus: "ready" }));
  try {
    await fixture.runner.handleRun(fixture.res, {
      endpoint: endpoints.realDemo005RunEndpoint,
      runVerify: () => Promise.resolve({ code: 0, stdout: "ok", stderr: "" }),
    });
    assertEqual(fixture.writes.length, 1, "run ok writes once");
    assertEqual(fixture.writes[0].statusCode, 200, "run ok status code");
    const payload = fixture.writes[0].payload;
    assertEqual(payload.ok, true, "run ok ok");
    assertEqual(payload.endpoint, endpoints.realDemo005RunEndpoint, "run ok endpoint");
    assertEqual(payload.running, false, "run ok running");
    assertEqual(payload.providerCalled, false, "run ok providerCalled");
    assertEqual(payload.prepareRan, false, "run ok prepareRan");
    assertEqual(payload.command.providerCalled, false, "run ok command providerCalled");
    assertEqual(payload.command.prepareRan, false, "run ok command prepareRan");
    assertEqual(payload.command.exitCode, 0, "run ok exitCode");
  } finally {
    fixture.cleanup();
  }
}

console.log("runtime-api-real-demo-005-runner-test: ok");
