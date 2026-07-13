import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const tsxBin = path.join(repoRoot, "node_modules", ".bin", "tsx");
const tempRoot = mkdtempSync(path.join(tmpdir(), "p6-preflight-safety-"));
const testProviderId = "p6-preflight-safety-provider";
const preflightRunId = "p6-preflight-safety-local-settings";
const blockedLiveRunId = "p6-preflight-safety-live-blocked";
const artifactRoots = [preflightRunId, blockedLiveRunId]
  .map((runId) => path.join(repoRoot, "test_artifacts", "p6-real-image2", runId));

function runScript(script: string, args: string[], env: NodeJS.ProcessEnv, expectedStatus: number) {
  const result = spawnSync(tsxBin, [script, ...args], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    expectedStatus,
    `${script} exit mismatch\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return `${result.stdout}\n${result.stderr}`;
}

function readJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function assertNoSubmit(report: any, expectedStatus: string) {
  assert.equal(report.status, expectedStatus);
  assert.equal(report.canSubmitProvider, false);
  assert.equal(report.providerCalled, false);
  assert.equal(report.network, false);
  assert.equal(report.runtimeExternalNetworkCallMade, false);
}

try {
  const homeDir = path.join(tempRoot, "home");
  const credentialDir = path.join(homeDir, ".vibe-director");
  const fakeKey = "local-test-key-not-real";
  mkdirSync(credentialDir, { recursive: true });
  writeFileSync(path.join(credentialDir, "credentials.json"), JSON.stringify({
    schemaVersion: "0.1.0",
    providers: {
      [testProviderId]: {
        providerId: testProviderId,
        apiKey: fakeKey,
        label: "P6 test credential",
        updatedAt: "2026-07-13T00:00:00.000Z",
      },
    },
  }));

  const safeEnv: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: homeDir,
    VIBE_IMAGE2_PROVIDER_ID: testProviderId,
    VIBE_IMAGE2_BASE_URL: "http://127.0.0.1:1",
    VIBE_IMAGE2_MODEL: "gpt-image-2",
    VIBE_P6_IMAGE2_MAX_AUTO_RETRIES: "0",
    VIBE_P6_IMAGE2_TIMEOUT_MS: "100",
  };
  for (const name of [
    "VIBE_IMAGE2_API_KEY",
    "VIBE_P6_IMAGE2_CONFIRM",
    "VIBE_P6_IMAGE2_LIVE",
    "LANYI_API_KEY",
    "OPENAI_API_KEY",
  ]) delete safeEnv[name];

  for (const artifactRoot of artifactRoots) rmSync(artifactRoot, { recursive: true, force: true });

  runScript("scripts/p6-real-image2-e2e-test.mts", [
    "--preflight",
    `--run-id=${preflightRunId}`,
    "--shots=P6S01",
  ], safeEnv, 0);
  const preflightRoot = artifactRoots[0];
  const preflightReport = readJson(path.join(preflightRoot, "report.json"));
  const preflightPlan = readJson(path.join(preflightRoot, "submit-plan.json"));
  assertNoSubmit(preflightReport, "preflight_provider_not_called");
  assert.equal(preflightReport.liveRequested, false);
  assert.equal(preflightPlan.provider.credentialRef, `local-settings://providers/${testProviderId}`);
  assert.equal(preflightPlan.provider.rawCredentialMaterialPresent, false);
  assert.ok(!preflightReport.liveSubmitBlockers.some((item: string) => /credential/i.test(item)));

  runScript("scripts/p6-real-image2-e2e-test.mts", [
    "--live",
    `--run-id=${blockedLiveRunId}`,
    "--shots=P6S01",
  ], safeEnv, 0);
  const blockedRoot = artifactRoots[1];
  const blockedReport = readJson(path.join(blockedRoot, "report.json"));
  assertNoSubmit(blockedReport, "live_submit_blocked_before_provider_call");
  assert.equal(blockedReport.liveRequested, true);
  assert.ok(blockedReport.liveSubmitBlockers.some((item: string) => /confirmation/i.test(item)));

  const retainedEvidence = artifactRoots.flatMap((root) => [
    path.join(root, "report.json"),
    path.join(root, "submit-plan.json"),
    path.join(root, "permission-receipt.json"),
  ]).map((filePath) => readFileSync(filePath, "utf8")).join("\n");
  assert.ok(!retainedEvidence.includes(fakeKey), "preflight evidence must not retain raw credential material");

  const scanRoot = path.join(tempRoot, "secret-scan");
  mkdirSync(scanRoot, { recursive: true });
  const proseFixture = path.join(scanRoot, "prose.json");
  const windowsFixture = path.join(scanRoot, "windows.json");
  const posixFixture = path.join(scanRoot, "posix.json");
  writeFileSync(proseFixture, JSON.stringify({ prompt: "audio reference is attached. Reference use/ignore bindings:\\n" }));
  writeFileSync(windowsFixture, JSON.stringify({ referenceAudioPath: "C:\\voices\\line.wav" }));
  writeFileSync(posixFixture, JSON.stringify({ referenceAudioPath: "/Users/example/voices/line.wav" }));

  runScript("scripts/p6-real-image2-secret-scan.mts", [`--roots=${proseFixture}`], safeEnv, 0);
  const windowsOutput = runScript("scripts/p6-real-image2-secret-scan.mts", [`--roots=${windowsFixture}`], safeEnv, 1);
  const posixOutput = runScript("scripts/p6-real-image2-secret-scan.mts", [`--roots=${posixFixture}`], safeEnv, 1);
  assert.match(windowsOutput, /reference_audio_absolute_path/);
  assert.match(posixOutput, /reference_audio_absolute_path/);

  console.log("p6-real-image2-preflight-safety-test: ok");
} finally {
  for (const artifactRoot of artifactRoots) rmSync(artifactRoot, { recursive: true, force: true });
  rmSync(tempRoot, { recursive: true, force: true });
}
