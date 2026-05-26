import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";

const onePixelPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

function readRequestBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) => {
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (code === 0) {
        resolve(result);
        return;
      }
      reject(new Error(`Command failed with code ${code}\n${result.stdout}\n${result.stderr}`));
    });
  });
}

let requestCount = 0;
const server = http.createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/v1/images/generations") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
    return;
  }

  requestCount += 1;
  const requestBody = await readRequestBody(request);
  const parsedBody = JSON.parse(requestBody);
  assert.equal(parsedBody.size, "1280x720", "P6 live Image2 should request the Jimeng-matched 1280x720 start-frame size");
  response.setHeader("Content-Type", "application/json");
  response.setHeader("x-request-id", `mock-image2-${requestCount}`);

  if (requestCount === 1) {
    response.writeHead(500);
    response.end(JSON.stringify({ error: { message: "mock transient server error" } }));
    return;
  }

  if (requestCount === 3) {
    response.writeHead(200);
    response.end(JSON.stringify({ id: `mock-empty-${requestCount}`, data: [] }));
    return;
  }

  response.writeHead(200);
  response.end(JSON.stringify({
    id: `mock-success-${requestCount}`,
    data: [{ b64_json: onePixelPng }],
  }));
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object", "mock server address should be available");

try {
  const runId = "p6-retry-harness-mock-20260518";
  const tsxBin = path.join(process.cwd(), "node_modules", ".bin", "tsx");
  const reportPath = `test_artifacts/p6-real-image2/${runId}/report.json`;
  await run(
    tsxBin,
    [
      "scripts/p6-real-image2-e2e-test.mts",
      "--live",
      `--run-id=${runId}`,
      "--shots=P6S01,P6S02,P6S03",
    ],
    {
      ...process.env,
      VIBE_IMAGE2_API_KEY: "test-key",
      VIBE_IMAGE2_BASE_URL: `http://127.0.0.1:${address.port}`,
      VIBE_IMAGE2_PROVIDER_ID: "mock-image2",
      VIBE_P6_IMAGE2_CONFIRM: "submit-p6-image2",
      VIBE_P6_IMAGE2_MAX_CONCURRENCY: "3",
      VIBE_P6_IMAGE2_RETRY_CONCURRENCY: "2",
      VIBE_P6_IMAGE2_MAX_AUTO_RETRIES: "2",
      VIBE_P6_IMAGE2_RETRY_BASE_DELAY_MS: "1",
      VIBE_P6_IMAGE2_RETRY_MAX_DELAY_MS: "1",
      VIBE_P6_IMAGE2_TIMEOUT_MS: "5000",
      VIBE_P6_IMAGE2_PROMPT: "Mock retry harness image prompt",
    },
  );

  assert.equal(requestCount, 5, "mock provider should receive 3 initial requests plus 2 retries");
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  assert.equal(report.providerRequestStrategy, "scheduler_one_shot_with_retry", "live harness should use retry scheduler");
  assert.equal(report.maxConcurrency, 3, "initial live harness concurrency should be 3");
  assert.equal(report.retryConcurrency, 2, "retry live harness concurrency should be 2");
  assert.equal(report.maxAutoRetries, 2, "live harness should expose retry budget 2");
  assert.equal(report.providerRequestedCount, 5, "report should count actual provider attempts");
  assert.equal(report.providerReturnedCount, 3, "all three shots should recover");
  assert.deepEqual(report.missingShotIds, [], "recovered retry run should have no missing shots");
  assert.equal(report.batchResultStatus, "return_ingested", "fully recovered retry run should ingest as returned");
  assert.equal(report.retrySummary?.promotionAllowed, false, "retry scheduler must not promote outputs");
  assert.equal(report.retryAttemptedShotIds?.length, 2, "two shots should have needed retry");
  assert.equal(report.retryRecoveredShotIds?.length, 2, "two shots should recover after retry");
  assert.ok(Array.isArray(report.retryAttemptReceipts) && report.retryAttemptReceipts.length === 5, "retry attempt receipts should cover every attempt");

  for (const output of report.outputs) {
    assert.equal(output.outputMimeType, "image/png", "mock output should be PNG");
    assert.match(output.outputSha256, /^sha256:[a-f0-9]{64}$/, "mock output should be hash-bound");
    assert.ok(existsSync(output.outputPath), `mock output should exist: ${output.outputPath}`);
  }

  console.log(`p6-real-image2-retry-harness-test: ok (${requestCount} provider attempts, ${report.providerReturnedCount} recovered outputs)`);
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
