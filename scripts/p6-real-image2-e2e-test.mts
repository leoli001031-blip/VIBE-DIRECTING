import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildP6RealImage2Plan, buildP6RealImage2ReturnIngest } from "../src/core/p6RealImage2ClosedLoop.ts";
import { buildProviderSubmitPermissionReceipt } from "../src/core/providerSubmitPermissionReceipt.ts";
import {
  IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
  image2GenerateSizeForAspectRatio,
} from "../src/core/providerPolicy.ts";
import {
  appendProviderRetryAttemptResult,
  createProviderRetrySchedulerState,
  markProviderRetryAttemptsRunning,
  providerRetryAttemptReceiptCandidates,
  queueNextProviderRetryBatch,
  type ProviderRetryAttempt,
  type ProviderRetryFailureKind,
  type ProviderRetryPolicy,
  type ProviderRetryResult,
  type ProviderRetrySchedulerState,
} from "../src/core/providerRetryScheduler.ts";

const CONFIRM_PHRASE = "submit-p6-image2";
const DEFAULT_PROMPT =
  "Anime keyframe: a young mechanic with short blue hair wearing a blue work jacket stands in a warm-lit garage workshop, tools on a workbench in the background, cel-shaded anime art style, soft cinematic lighting";

function detectImageFormat(bytes: Uint8Array) {
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)) {
    return { format: "png", mimeType: "image/png", valid: true };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { format: "jpeg", mimeType: "image/jpeg", valid: true };
  }
  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { format: "webp", mimeType: "image/webp", valid: true };
  }
  return { format: "unknown", mimeType: "application/octet-stream", valid: false };
}

interface Image2BatchProviderResult {
  ok: true;
  images: Array<{
    imageBytes: Uint8Array;
    index: number;
    detectedFormat: string;
    detectedMimeType: string;
  }>;
  metadata: {
    model: string;
    size: string;
    requestedCount: number;
    returnedCount: number;
    countMismatch: boolean;
    providerDataArrayPresent: boolean;
    providerRequestId?: string;
    responseTimestamp: string;
  };
}

interface Image2BatchProviderError {
  ok: false;
  errorType: "auth" | "rate_limit" | "timeout" | "server_error" | "parse_error" | "network_error";
  message: string;
  statusCode?: number;
  diagnostic?: ProviderErrorDiagnostic;
}

interface ProviderErrorDiagnostic {
  kind: "timeout" | "network_error" | "http_error" | "parse_error";
  name?: string;
  message: string;
  causeName?: string;
  causeCode?: string;
  causeMessage?: string;
  retryable: boolean;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function writeJson(filePath: string, payload: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function sha256Bytes(bytes: Uint8Array) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function argValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) return process.argv[exactIndex + 1];
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function parseShotIds(): string[] {
  const raw = argValue("--shots") || process.env.VIBE_P6_SHOT_IDS || process.env.VIBE_P6_SHOT_ID || "P6S01";
  return raw.split(",").map((shotId) => shotId.trim()).filter(Boolean);
}

function safeInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function sha256Text(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : undefined;
}

function errorDiagnostic(error: unknown, kind: ProviderErrorDiagnostic["kind"], fallback: string): ProviderErrorDiagnostic {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : undefined;
  const cause = record?.cause && typeof record.cause === "object" ? record.cause as Record<string, unknown> : undefined;
  return {
    kind,
    name: stringField(record?.name),
    message: stringField(record?.message) || fallback,
    causeName: stringField(cause?.name),
    causeCode: stringField(cause?.code),
    causeMessage: stringField(cause?.message),
    retryable: kind === "timeout" || kind === "network_error",
  };
}

function responseDiagnostic(response: Response): ProviderErrorDiagnostic {
  const errorType = classifyError(response);
  return {
    kind: "http_error",
    message: `HTTP ${response.status}: ${response.statusText}`,
    causeCode: String(response.status),
    retryable: errorType === "rate_limit" || errorType === "server_error",
  };
}

function classifyError(response: Response): Image2BatchProviderError["errorType"] {
  if (response.status === 401 || response.status === 403) return "auth";
  if (response.status === 429) return "rate_limit";
  if (response.status >= 500) return "server_error";
  return "server_error";
}

async function callImage2ProviderBatch(input: {
  apiKey: string;
  baseUrl: string;
  prompt: string;
  size: string;
  n: number;
  timeoutMs: number;
}): Promise<Image2BatchProviderResult | Image2BatchProviderError> {
  const baseUrl = input.baseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/v1/images/generations`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt: input.prompt,
        size: input.size,
        n: input.n,
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(input.timeoutMs),
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        ok: false,
        errorType: "timeout",
        message: `Request timed out after ${input.timeoutMs}ms`,
        diagnostic: errorDiagnostic(error, "timeout", `Request timed out after ${input.timeoutMs}ms`),
      };
    }
    return {
      ok: false,
      errorType: "network_error",
      message: error instanceof Error ? error.message : "Network request failed",
      diagnostic: errorDiagnostic(error, "network_error", "Network request failed"),
    };
  }

  if (!response.ok) {
    const diagnostic = responseDiagnostic(response);
    return {
      ok: false,
      errorType: classifyError(response),
      message: diagnostic.message,
      statusCode: response.status,
      diagnostic,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      errorType: "parse_error",
      message: "Failed to parse response JSON",
      diagnostic: {
        kind: "parse_error",
        message: "Failed to parse response JSON",
        retryable: true,
      },
    };
  }

  const data = body as Record<string, unknown>;
  const images = data.data as Array<Record<string, unknown>> | undefined;
  const providerRequestId =
    typeof data.id === "string" && data.id.trim()
      ? data.id.trim()
      : response.headers.get("x-request-id") || response.headers.get("openai-request-id") || undefined;
  if (!Array.isArray(images) || images.length === 0) {
    return {
      ok: true,
      images: [],
      metadata: {
        model: "gpt-image-2",
        size: input.size,
        requestedCount: input.n,
        returnedCount: 0,
        countMismatch: true,
        providerDataArrayPresent: Array.isArray(images),
        providerRequestId,
        responseTimestamp: new Date().toISOString(),
      },
    };
  }

  const decodedImages: Image2BatchProviderResult["images"] = [];
  for (const [index, image] of images.slice(0, input.n).entries()) {
    const b64 = image.b64_json;
    const url = image.url;
    if (typeof b64 === "string") {
      const imageBytes = Buffer.from(b64, "base64");
      const detected = detectImageFormat(imageBytes);
      decodedImages.push({ imageBytes, index, detectedFormat: detected.format, detectedMimeType: detected.mimeType });
      continue;
    }
    if (typeof url === "string") {
      try {
        const imageResponse = await fetch(url, { signal: AbortSignal.timeout(input.timeoutMs) });
        if (!imageResponse.ok) {
          return {
            ok: false,
            errorType: "network_error",
            message: `Image URL download failed for data[${index}]: HTTP ${imageResponse.status}`,
            diagnostic: {
              kind: "http_error",
              message: `Image URL download failed for data[${index}]: HTTP ${imageResponse.status}`,
              causeCode: String(imageResponse.status),
              retryable: imageResponse.status === 429 || imageResponse.status >= 500,
            },
          };
        }
        const imageBytes = Buffer.from(await imageResponse.arrayBuffer());
        const detected = detectImageFormat(imageBytes);
        decodedImages.push({ imageBytes, index, detectedFormat: detected.format, detectedMimeType: detected.mimeType });
        continue;
      } catch (error: unknown) {
        return {
          ok: false,
          errorType: "network_error",
          message: error instanceof Error ? error.message : `Image URL download failed for data[${index}]`,
          diagnostic: errorDiagnostic(error, "network_error", `Image URL download failed for data[${index}]`),
        };
      }
    }
    return { ok: false, errorType: "parse_error", message: `Response missing data[${index}].b64_json or url` };
  }

  return {
    ok: true,
    images: decodedImages,
    metadata: {
      model: "gpt-image-2",
      size: input.size,
      requestedCount: input.n,
      returnedCount: decodedImages.length,
      countMismatch: decodedImages.length !== input.n,
      providerDataArrayPresent: true,
      providerRequestId,
      responseTimestamp: new Date().toISOString(),
    },
  };
}

const providerId = process.env.VIBE_IMAGE2_PROVIDER_ID || "openai-image2-api";
const baseUrl = process.env.VIBE_IMAGE2_BASE_URL || "https://api.openai.com";
const apiKey = process.env.VIBE_IMAGE2_API_KEY || "";
const confirmPhrase = process.env.VIBE_P6_IMAGE2_CONFIRM || "";
const liveRequested = argFlag("--live") || process.env.VIBE_P6_IMAGE2_LIVE === "1";
const preflightRequested = argFlag("--preflight") || !liveRequested;
const generatedAt = new Date().toISOString();
const runId = argValue("--run-id") || `p6-real-image2-${generatedAt.replace(/[:.]/g, "-")}`;
const shotIds = parseShotIds();
const outputRoot = `test_artifacts/p6-real-image2/${runId}`;
const reportPath = `${outputRoot}/report.json`;
const prompt = process.env.VIBE_P6_IMAGE2_PROMPT || DEFAULT_PROMPT;
const aspectRatio = process.env.VIBE_P6_IMAGE2_ASPECT_RATIO || IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO;
const size = process.env.VIBE_P6_IMAGE2_SIZE || image2GenerateSizeForAspectRatio(aspectRatio);
const timeoutMs = Number(process.env.VIBE_P6_IMAGE2_TIMEOUT_MS || 120000);
const maxConcurrency = clampInteger(
  safeInteger(process.env.VIBE_P6_IMAGE2_MAX_CONCURRENCY, shotIds.length > 1 ? 3 : 1),
  1,
  Math.min(3, Math.max(1, shotIds.length)),
);
const retryConcurrency = clampInteger(
  safeInteger(process.env.VIBE_P6_IMAGE2_RETRY_CONCURRENCY, Math.min(2, maxConcurrency)),
  1,
  maxConcurrency,
);
const maxAutoRetries = clampInteger(safeInteger(process.env.VIBE_P6_IMAGE2_MAX_AUTO_RETRIES, 2), 0, 2);
const retryBaseDelayMs = clampInteger(safeInteger(process.env.VIBE_P6_IMAGE2_RETRY_BASE_DELAY_MS, 3_000), 0, 60_000);
const retryMaxDelayMs = clampInteger(safeInteger(process.env.VIBE_P6_IMAGE2_RETRY_MAX_DELAY_MS, 15_000), retryBaseDelayMs, 60_000);

function expectedOutputFor(shotId: string) {
  const safeShotId = shotId.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "shot";
  return {
    shotId,
    expectedOutputPath: `${outputRoot}/shots/${safeShotId}/image2.png`,
    providerObservationPath: `${outputRoot}/provider_observations/${safeShotId}.json`,
    semanticQaPath: `${outputRoot}/semantic_qa/${safeShotId}.json`,
  };
}

const expectedOutputs = shotIds.map(expectedOutputFor);

function buildPermissionReceipt() {
  return buildProviderSubmitPermissionReceipt({
    generatedAt,
    receiptId: `receipt_${runId}`,
    handoffId: `handoff_${runId}`,
    providerId,
    providerSlot: "image.generate",
    requiredMode: "text2image",
    selectedShotIds: shotIds,
    expectedOutputs,
    credentialRef: "env:VIBE_IMAGE2_API_KEY",
    maxProviderCallsPerReceipt: 1,
    actionTimeConfirmation: {
      confirmationReceiptId: `action_confirmation_${runId}`,
      confirmationCapturedAt: generatedAt,
    },
    promptPath: `${outputRoot}/prompt.md`,
  });
}

mkdirSync(outputRoot, { recursive: true });
writeFileSync(`${outputRoot}/prompt.md`, `${prompt}\n`, "utf8");

const permissionReceipt = buildPermissionReceipt();
const plan = buildP6RealImage2Plan({
  generatedAt,
  runId,
  shotIds,
  prompt,
  imageCount: shotIds.length,
  providerId,
  providerBaseUrl: baseUrl,
  credentialRef: "env:VIBE_IMAGE2_API_KEY",
  outputRoot,
  submitPermissionReceipt: permissionReceipt,
  actionTimeConfirmation: {
    confirmed: confirmPhrase === CONFIRM_PHRASE,
    phrase: confirmPhrase,
    confirmedAt: generatedAt,
  },
});

writeJson(`${outputRoot}/permission-receipt.json`, permissionReceipt);
writeJson(`${outputRoot}/submit-plan.json`, plan);

const liveSubmitBlockers = [
  ...plan.blockers,
  ...(!apiKey ? ["VIBE_IMAGE2_API_KEY is required for live P6 submit."] : []),
  ...(confirmPhrase !== CONFIRM_PHRASE ? [`VIBE_P6_IMAGE2_CONFIRM must equal ${CONFIRM_PHRASE}.`] : []),
];
const canSubmitProvider = liveRequested && Boolean(apiKey) && confirmPhrase === CONFIRM_PHRASE && plan.status === "ready_for_live_submit";

if (!canSubmitProvider) {
  writeJson(reportPath, {
    ok: preflightRequested,
    mode: preflightRequested ? "preflight" : "submit_live",
    status: preflightRequested ? "preflight_provider_not_called" : "live_submit_blocked_before_provider_call",
    liveRequested,
    preflightRequested,
    selectedShotIds: shotIds,
    imageCount: shotIds.length,
    canSubmitProvider: false,
    blockers: preflightRequested ? [] : liveSubmitBlockers,
    liveSubmitBlockers,
    providerCalled: false,
    network: false,
    runtimeExternalNetworkCallMade: false,
    commandExamples: {
      oneShotPreflight: "npm run p6-real-image2:preflight -- --shots=P6S01",
      threeShotPreflight: "npm run p6-real-image2:preflight -- --shots=P6S01,P6S02,P6S03",
      oneShotLive: "VIBE_IMAGE2_API_KEY=... VIBE_P6_IMAGE2_CONFIRM=submit-p6-image2 npm run p6-real-image2:submit-live -- --shots=P6S01",
      threeShotLive: "VIBE_IMAGE2_API_KEY=... VIBE_P6_IMAGE2_CONFIRM=submit-p6-image2 npm run p6-real-image2:submit-live -- --shots=P6S01,P6S02,P6S03",
    },
    providerRequestStrategy: "scheduler_one_shot_with_retry",
    maxConcurrency,
    retryConcurrency,
    maxAutoRetries,
    requestedSize: size,
    requestedAspectRatio: aspectRatio,
    evidence: {
      outputRoot,
      reportPath,
      permissionReceiptPath: `${outputRoot}/permission-receipt.json`,
      submitPlanPath: `${outputRoot}/submit-plan.json`,
      promptPath: `${outputRoot}/prompt.md`,
    },
  });
  console.error(`P6 Image2 ${preflightRequested ? "preflight" : "submit-live"} stopped before provider submit. Report: ${reportPath}`);
  process.exit(0);
}

function providerFailureKind(errorType: Image2BatchProviderError["errorType"]): ProviderRetryFailureKind {
  if (errorType === "auth") return "auth";
  if (errorType === "rate_limit") return "rate_limit";
  if (errorType === "timeout") return "timeout";
  if (errorType === "network_error") return "network_error";
  if (errorType === "parse_error") return "server_error";
  return "server_error";
}

function safeShotId(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "shot";
}

const expectedOutputByShotId = new Map(expectedOutputs.map((output) => [output.shotId, output]));
const retryPolicy: ProviderRetryPolicy = {
  maxConcurrency,
  retryConcurrency,
  maxAutoRetries,
  baseDelayMs: retryBaseDelayMs,
  maxDelayMs: retryMaxDelayMs,
  jitterRatio: 0,
  retryableFailureKinds: ["timeout", "rate_limit", "server_error", "network_error", "provider_missing"],
  terminalFailureKinds: ["auth", "validation_error", "content_policy", "qa_failed", "cancelled"],
};
let retryState: ProviderRetrySchedulerState = createProviderRetrySchedulerState({
  generatedAt,
  policy: retryPolicy,
  tasks: expectedOutputs.map((expectedOutput, index) => ({
    taskId: `p6-real-image2-${runId}-${safeShotId(expectedOutput.shotId)}`,
    shotId: expectedOutput.shotId,
    inputHash: sha256Text(`${providerId}:${baseUrl}:${size}:${expectedOutput.shotId}:${prompt}`),
    permissionReceiptId: permissionReceipt.receiptId,
    expectedOutputPath: expectedOutput.expectedOutputPath,
    priority: expectedOutputs.length - index,
  })),
});

console.log(
  `P6 live Image2: submitting ${shotIds.length} scheduler-controlled one-shot request(s) with maxConcurrency=${maxConcurrency}, retryConcurrency=${retryConcurrency}, maxAutoRetries=${maxAutoRetries}...`,
);
const providerResults: Array<Record<string, unknown>> = [];
const returnedOutputs: Array<{
  shotId: string;
  outputPath: string;
  sha256: string;
  outputMimeType: string;
  outputFormat: string;
  providerObservationPresent: true;
  semanticQaStatus: "needs_review";
  providerObservation: Record<string, unknown>;
  semanticQa: Record<string, unknown>;
  providerSelfReportedSuccess: true;
}> = [];
const returnedShotIds = new Set<string>();

async function runProviderAttempt(attempt: ProviderRetryAttempt): Promise<{
  attempt: ProviderRetryAttempt;
  schedulerResult: ProviderRetryResult;
  returnedOutput?: (typeof returnedOutputs)[number];
  providerResult: Record<string, unknown>;
}> {
  const expectedOutput = expectedOutputByShotId.get(attempt.shotId);
  assert(expectedOutput, `${attempt.shotId} expected output must exist`);
  const result = await callImage2ProviderBatch({
    apiKey,
    baseUrl,
    prompt,
    size,
    n: 1,
    timeoutMs,
  });

  if (!result.ok) {
    const failureKind = providerFailureKind(result.errorType);
    return {
      attempt,
      schedulerResult: {
        status: "failure",
        failureKind,
        message: result.message,
      },
      providerResult: {
        attemptId: attempt.attemptId,
        attemptNumber: attempt.attemptNumber,
      shotId: expectedOutput.shotId,
      ok: false,
      errorType: result.errorType,
        failureKind,
      message: result.message,
      statusCode: result.statusCode,
      diagnostic: result.diagnostic,
      providerRequestedCount: 1,
      providerReturnedCount: 0,
      },
    };
  }

  const providerResult = {
    attemptId: attempt.attemptId,
    attemptNumber: attempt.attemptNumber,
    shotId: expectedOutput.shotId,
    ok: true,
    providerRequestedCount: 1,
    providerReturnedCount: result.metadata.returnedCount,
    providerReturnCountMismatch: result.metadata.countMismatch,
    providerDataArrayPresent: result.metadata.providerDataArrayPresent,
    providerRequestId: result.metadata.providerRequestId,
  };
  if (result.metadata.returnedCount !== 1) {
    return {
      attempt,
      schedulerResult: {
        status: "missing",
        failureKind: "provider_missing",
        message: `Provider returned ${result.metadata.returnedCount}/1 image(s).`,
      },
      providerResult: {
        ...providerResult,
        failureKind: "provider_missing",
      },
    };
  }

  const image = result.images[0];
  if (!image) {
    return {
      attempt,
      schedulerResult: {
        status: "missing",
        failureKind: "provider_missing",
        message: "Provider response did not contain a usable image.",
      },
      providerResult: {
        ...providerResult,
        failureKind: "provider_missing",
      },
    };
  }

  const outputPath = expectedOutput.expectedOutputPath;
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, image.imageBytes);
  assert(existsSync(outputPath), `${expectedOutput.shotId} output file should exist`);
  const stats = statSync(outputPath);
  assert(stats.size > 0, `${expectedOutput.shotId} output file should not be empty`);
  const header = new Uint8Array(readFileSync(outputPath).slice(0, 8));
  const detected = detectImageFormat(header);
  assert(detected.valid, `${expectedOutput.shotId} output file should be a valid image`);
  const outputSha256 = sha256Bytes(image.imageBytes);
  const safeId = safeShotId(expectedOutput.shotId);
  const providerObservation = {
    schemaVersion: "p6_real_image2_provider_observation_v1",
    receiptId: `provider_observation_${runId}_${safeId}`,
    receiptPath: expectedOutput.providerObservationPath,
    runId,
    shotId: expectedOutput.shotId,
    attemptId: attempt.attemptId,
    attemptNumber: attempt.attemptNumber,
    submitPermissionReceiptId: permissionReceipt.receiptId,
    selectedShotIds: shotIds,
    providerObservationMode: "actual_provider_call_observed",
    providerCalled: true,
    actualImage2Triggered: true,
    providerRequestId: result.metadata.providerRequestId,
    maxConcurrency,
    retryConcurrency,
    maxAutoRetries,
    provider: providerId,
    baseUrl,
    model: result.metadata.model,
    requestedSize: size,
      requestedAspectRatio: aspectRatio,
    outputPath,
    outputSha256,
    outputMimeType: image.detectedMimeType,
    outputFormat: image.detectedFormat,
    responseTimestamp: result.metadata.responseTimestamp,
    providerSelfReportCanComplete: false,
  };
  const semanticQa = {
    schemaVersion: "p6_real_image2_semantic_qa_v1",
    receiptId: `semantic_qa_${runId}_${safeId}`,
    receiptPath: expectedOutput.semanticQaPath,
    runId,
    shotId: expectedOutput.shotId,
    attemptId: attempt.attemptId,
    attemptNumber: attempt.attemptNumber,
    submitPermissionReceiptId: permissionReceipt.receiptId,
    selectedShotIds: shotIds,
    semanticReviewMode: "manual_review_required",
    status: "needs_review" as const,
    semanticQaStatus: "needs_review" as const,
    finalAssessment: { status: "needs_review" },
    outputPath,
    outputSha256,
    outputMimeType: image.detectedMimeType,
    outputFormat: image.detectedFormat,
    reviewedOutputSha256: outputSha256,
  };

  writeJson(expectedOutput.providerObservationPath, providerObservation);
  writeJson(expectedOutput.semanticQaPath, semanticQa);

  return {
    attempt,
    schedulerResult: {
      status: "success",
      providerRequestId: result.metadata.providerRequestId || `provider_${runId}_${safeId}_${attempt.attemptNumber}`,
      outputPath,
      outputSha256,
    },
    providerResult: {
      ...providerResult,
      outputSha256,
      outputPath,
    },
    returnedOutput: {
    shotId: expectedOutput.shotId,
    outputPath,
    sha256: outputSha256,
    outputMimeType: image.detectedMimeType,
    outputFormat: image.detectedFormat,
    providerObservationPresent: true,
    semanticQaStatus: "needs_review" as const,
    providerObservation,
    semanticQa,
    providerSelfReportedSuccess: true,
    },
  };
}

for (let tick = 0; tick < Math.max(10, shotIds.length * (maxAutoRetries + 2) * 4); tick += 1) {
  const now = new Date().toISOString();
  const batch = queueNextProviderRetryBatch(retryState, now);

  if (batch.length === 0) {
    const queued = retryState.attempts.filter((attempt) => attempt.status === "queued");
    if (queued.length === 0 && retryState.summary.running === 0) break;
    const nextDueAt = Math.min(...queued.map((attempt) => new Date(attempt.scheduledAt).getTime()));
    await sleep(Math.max(0, Math.min(30_000, nextDueAt - Date.now())));
    continue;
  }

  retryState = markProviderRetryAttemptsRunning(retryState, batch.map((attempt) => attempt.attemptId), now);
  const attemptResults = await Promise.all(batch.map((attempt) => runProviderAttempt(attempt)));
  const completedAt = new Date().toISOString();
  for (const attemptResult of attemptResults) {
    providerResults.push(attemptResult.providerResult);
    retryState = appendProviderRetryAttemptResult(
      retryState,
      attemptResult.attempt.attemptId,
      attemptResult.schedulerResult,
      completedAt,
    );
    if (attemptResult.returnedOutput && !returnedShotIds.has(attemptResult.returnedOutput.shotId)) {
      returnedShotIds.add(attemptResult.returnedOutput.shotId);
      returnedOutputs.push(attemptResult.returnedOutput);
    }
    if (attemptResult.schedulerResult.status !== "success") {
      const retryQueued = retryState.attempts.some(
        (attempt) =>
          attempt.taskId === attemptResult.attempt.taskId
          && attempt.status === "queued"
          && attempt.attemptNumber > attemptResult.attempt.attemptNumber,
      );
      const status = retryQueued ? "scheduled for retry" : "finished missing/failed";
      console.warn(`P6 live Image2 ${attemptResult.attempt.shotId} attempt ${attemptResult.attempt.attemptNumber} ${status}.`);
    }
  }
}

if (retryState.summary.queued > 0 || retryState.summary.running > 0) {
  throw new Error("P6 live Image2 retry scheduler did not settle.");
}

returnedOutputs.sort((left, right) => shotIds.indexOf(left.shotId) - shotIds.indexOf(right.shotId));

const ingest = buildP6RealImage2ReturnIngest({
  generatedAt: new Date().toISOString(),
  plan,
  returnedOutputs,
});

writeJson(`${outputRoot}/return-ingest.json`, ingest);
writeJson(`${outputRoot}/retry-scheduler-state.json`, retryState);
writeJson(`${outputRoot}/retry-attempt-receipts.json`, providerRetryAttemptReceiptCandidates(retryState));
const missingShotIds = ingest.shotStatuses.filter((item) => item.status === "missing").map((item) => item.shotId);
const retryAttemptReceipts = providerRetryAttemptReceiptCandidates(retryState);
const retryAttemptedShotIds = Array.from(new Set(retryState.attempts.filter((attempt) => attempt.attemptNumber > 1).map((attempt) => attempt.shotId)));
const retryRecoveredShotIds = Array.from(new Set(retryState.attempts.filter((attempt) => attempt.status === "succeeded" && attempt.attemptNumber > 1).map((attempt) => attempt.shotId)));
const retryExhaustedShotIds = Array.from(new Set(retryState.attempts.filter((attempt) => attempt.status === "failed_terminal").map((attempt) => attempt.shotId)));
writeJson(reportPath, {
  ok: returnedOutputs.length > 0,
  status: ingest.status,
  batchResultStatus: missingShotIds.length ? "partial_return_ingested" : "return_ingested",
  runId,
  liveRequested,
  selectedShotIds: shotIds,
  imageCount: shotIds.length,
  providerRequestStrategy: "scheduler_one_shot_with_retry",
  maxConcurrency,
  retryConcurrency,
  maxAutoRetries,
  requestedSize: size,
  requestedAspectRatio: aspectRatio,
  providerReturnedCount: returnedOutputs.length,
  providerRequestedCount: providerResults.length,
  providerPlannedShotCount: shotIds.length,
  providerReturnCountMismatch: returnedOutputs.length !== shotIds.length,
  providerResults,
  missingShotIds,
  retryPolicy,
  retrySummary: retryState.summary,
  retryAttemptedShotIds,
  retryRecoveredShotIds,
  retryExhaustedShotIds,
  retryAttemptReceipts,
  retrySchedulerStatePath: `${outputRoot}/retry-scheduler-state.json`,
  retryAttemptReceiptsPath: `${outputRoot}/retry-attempt-receipts.json`,
  providerCalled: true,
  network: true,
  runtimeExternalNetworkCallMade: true,
  outputRoot,
  outputs: returnedOutputs.map((output) => ({
    shotId: output.shotId,
    outputPath: output.outputPath,
    outputSha256: output.sha256,
    outputMimeType: output.outputMimeType,
    outputFormat: output.outputFormat,
    requestedSize: size,
    requestedAspectRatio: aspectRatio,
  })),
  ingest,
});

assert(ingest.providerSelfReportIgnoredForCompletion === true, "provider self-report must be ignored for completion");
assert(ingest.summary.needsReview === returnedOutputs.length, "returned live outputs should return as needs_review");
assert(ingest.summary.missing === shotIds.length - returnedOutputs.length, "missing live outputs should stay missing");
assert(ingest.summary.promotionAllowed === false, "live output must not auto-promote");
console.log(`P6 Real Image2 live submit completed. Report: ${reportPath}`);
