import { existsSync, readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function argValue(name) {
  const prefix = `${name}=`;
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) return process.argv[exactIndex + 1];
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function argFlag(name) {
  return process.argv.includes(name);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function assertNoRawSecret(payload, label) {
  const text = JSON.stringify(payload);
  assert(!/\bsk-[A-Za-z0-9_-]{12,}\b/.test(text), `${label} must not contain a raw sk-* key`);
  assert(!/\bBearer\s+[A-Za-z0-9._-]{12,}\b/i.test(text), `${label} must not contain a bearer token`);
  assert(!/"apiKey"\s*:/.test(text), `${label} must not expose apiKey fields`);
}

const reportPath = argValue("--report");
const expectPreflight = argFlag("--expect-preflight");
const expectLive = argFlag("--expect-live");

assert(reportPath, "Usage: tsx scripts/p6-real-image2-report-check.mts --report=<path> [--expect-preflight|--expect-live]");
assert(existsSync(reportPath), `Report does not exist: ${reportPath}`);
assert(!(expectPreflight && expectLive), "Choose only one expectation mode.");

const report = readJson(reportPath);
assertNoRawSecret(report, "P6 report");

const selectedShotIds = stringArray(report.selectedShotIds);
assert(selectedShotIds.length >= 1 && selectedShotIds.length <= 3, "P6 report must cover 1 to 3 shots");
assert(new Set(selectedShotIds).size === selectedShotIds.length, "P6 report shot ids must be unique");

if (expectPreflight) {
  assert(report.status === "preflight_provider_not_called", "Preflight report status mismatch");
  assert(report.providerCalled === false, "Preflight must not call provider");
  assert(report.runtimeExternalNetworkCallMade === false, "Preflight must not make external network calls");
  assert(report.canSubmitProvider === false, "Preflight must stop before submit");
  assert(typeof report.evidence?.permissionReceiptPath === "string", "Preflight evidence must include permission receipt path");
  assert(typeof report.evidence?.submitPlanPath === "string", "Preflight evidence must include submit plan path");
}

if (expectLive) {
  assert(report.liveRequested === true, "Live report must declare liveRequested=true");
  assert(report.providerCalled === true, "Live report must record providerCalled=true");
  assert(report.runtimeExternalNetworkCallMade === true, "Live report must record external network IO");
  assert(report.requestedAspectRatio === "16:9", "Live report must request 16:9 output");
  assert(report.requestedSize === "1280x720", "Live report must request the Jimeng-matched 1280x720 Image2 start-frame size");
  assert(
    report.providerRequestStrategy === "serial_one_shot"
      || report.providerRequestStrategy === "scheduler_one_shot_with_retry",
    "Live report must use one-shot provider requests, with or without the retry scheduler",
  );
  assert(Number.isInteger(report.maxConcurrency) && report.maxConcurrency >= 1 && report.maxConcurrency <= 10, "Live report must cap maxConcurrency to 1-10");
  assert(Number.isInteger(report.maxAutoRetries) && report.maxAutoRetries >= 0 && report.maxAutoRetries <= 2, "Live report must cap maxAutoRetries to 0-2");
  assert(
    Number.isInteger(report.providerRequestedCount)
      && report.providerRequestedCount >= selectedShotIds.length
      && report.providerRequestedCount <= selectedShotIds.length * (report.maxAutoRetries + 1),
    "Live report providerRequestedCount must reflect bounded one-shot attempts",
  );
  if (report.providerRequestStrategy === "scheduler_one_shot_with_retry") {
    assert(Number.isInteger(report.retryConcurrency) && report.retryConcurrency >= 1 && report.retryConcurrency <= report.maxConcurrency, "Retry scheduler must cap retryConcurrency");
    assert(report.retrySummary?.promotionAllowed === false, "Retry scheduler must not promote outputs");
    assert(Array.isArray(report.retryAttemptReceipts), "Retry scheduler must expose receipt candidates");
    for (const receipt of report.retryAttemptReceipts) {
      assert(typeof receipt.attemptId === "string" && receipt.attemptId.length > 0, "Retry receipt must include attemptId");
      assert(typeof receipt.shotId === "string" && selectedShotIds.includes(receipt.shotId), "Retry receipt must include a selected shotId");
      assert(typeof receipt.inputHash === "string" && receipt.inputHash.length >= 16, "Retry receipt must include inputHash");
      assert(typeof receipt.permissionReceiptId === "string" && receipt.permissionReceiptId.length > 0, "Retry receipt must include permissionReceiptId");
      assert(receipt.promotionAllowed === false, "Retry receipt must not allow promotion");
    }
  }
  assert(Array.isArray(report.providerResults), "Live report must include provider results");
  assert(Array.isArray(report.outputs), "Live report must include output evidence");
  for (const output of report.outputs) {
    assert(typeof output.outputSha256 === "string" && /^sha256:[a-f0-9]{64}$/.test(output.outputSha256), "Live output must be hash-bound");
    assert(["image/png", "image/jpeg", "image/webp"].includes(output.outputMimeType), "Live output must record a supported image MIME type");
    assert(output.requestedAspectRatio === "16:9", "Live output must retain requested 16:9 aspect");
    assert(output.requestedSize === "1280x720", "Live output must retain requested Jimeng-matched 1280x720 Image2 start-frame size");
  }
  assert(report.ingest?.providerSelfReportIgnoredForCompletion === true, "Live ingest must ignore provider self-report for completion");
  assert(report.ingest?.summary?.promotionAllowed === false, "Live ingest must not auto-promote");
}

console.log(`p6-real-image2-report-check: ok ${reportPath}`);
