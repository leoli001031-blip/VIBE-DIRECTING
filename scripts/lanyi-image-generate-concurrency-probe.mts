import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
  image2GenerateSizeForAspectRatio,
} from "../src/core/providerPolicy.ts";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";

type ProbeResult = {
  id: string;
  status: "success" | "failure";
  elapsedMs: number;
  httpStatus?: number;
  prompt: string;
  outputPath?: string;
  outputSha256?: string;
  outputFormat?: "png" | "jpeg" | "webp" | "unknown";
  providerRequestId?: string;
  failureKind?: "http_error" | "provider_empty" | "network_error" | "decode_error";
  errorMessage?: string;
};

function argValue(name: string): string | undefined {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1];
  return undefined;
}

function numberArg(name: string, fallback: number): number {
  const value = argValue(name);
  const parsed = value ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function sha256(buffer: Buffer | string): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function imageFormat(buffer: Buffer): "png" | "jpeg" | "webp" | "unknown" {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpeg";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return "unknown";
}

async function decodeProviderImage(payload: unknown, timeoutMs: number): Promise<Buffer | null> {
  const response = payload as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const item = response.data?.[0];
  if (!item) return null;
  if (item.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item.url) {
    const imageResponse = await fetch(item.url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!imageResponse.ok) return null;
    return Buffer.from(await imageResponse.arrayBuffer());
  }
  return null;
}

const providerStatus = getProviderConfigStatuses().find((entry) => entry.providerId === "lanyi-image2");
const apiKey = getProviderApiKey("lanyi-image2") || process.env.LANYI_API_KEY || process.env.VIBE_IMAGE2_API_KEY;
if (!apiKey) {
  console.error("local lanyi-image2 credential, VIBE_IMAGE2_API_KEY, or LANYI_API_KEY is required.");
  process.exit(1);
}

const concurrency = numberArg("--concurrency", 5);
const model = argValue("--model") || process.env.VIBE_IMAGE2_MODEL || providerStatus?.imageModel || "gpt-image-2";
const baseUrl = (argValue("--base-url") || process.env.VIBE_IMAGE2_BASE_URL || providerStatus?.baseUrl || "https://lanyiapi.com").replace(/\/+$/, "");
const endpoint = "/v1/images/generations";
const aspectRatio = argValue("--aspect-ratio") || IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO;
const size = argValue("--size") || image2GenerateSizeForAspectRatio(aspectRatio);
const timeoutMs = numberArg("--timeout-ms", 180_000);
const runId = argValue("--run-id") || `lanyi-image-generate-concurrency-${concurrency}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const outDir = path.resolve(argValue("--out-dir") || path.join("test_artifacts/lanyi-image-generate-concurrency", runId));
const basePrompt = argValue("--prompt") ||
  "Jimeng-compatible 720p 16:9 cinematic keyframe for a local-first short film production test, a lone director standing beside a rain-soaked station platform at night, restrained color palette, coherent character identity, detailed background, wide landscape film still";

await mkdir(outDir, { recursive: true });

let active = 0;
let maxObservedConcurrency = 0;

async function runOne(index: number): Promise<ProbeResult> {
  const id = `generate-${String(index + 1).padStart(2, "0")}`;
  const prompt = `${basePrompt}. Variation ${index + 1}: keep the same story world, change only camera distance and lighting rhythm.`;
  const startedAt = performance.now();
  active += 1;
  maxObservedConcurrency = Math.max(maxObservedConcurrency, active);

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        n: 1,
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    const elapsedMs = Math.round(performance.now() - startedAt);
    if (!response.ok) {
      return {
        id,
        status: "failure",
        elapsedMs,
        httpStatus: response.status,
        prompt,
        failureKind: "http_error",
        errorMessage: text.slice(0, 600),
      };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      return {
        id,
        status: "failure",
        elapsedMs,
        httpStatus: response.status,
        prompt,
        failureKind: "decode_error",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    const outputBuffer = await decodeProviderImage(payload, timeoutMs);
    if (!outputBuffer) {
      return {
        id,
        status: "failure",
        elapsedMs,
        httpStatus: response.status,
        prompt,
        failureKind: "provider_empty",
        errorMessage: "Provider response did not include b64_json or downloadable url.",
      };
    }

    const outputPath = path.join(outDir, `${id}.png`);
    await writeFile(outputPath, outputBuffer);
    const outputSha256 = sha256(outputBuffer);
    const parsed = payload as Record<string, unknown>;
    const providerRequestId = typeof parsed.id === "string" && parsed.id.trim() ? parsed.id.trim() : undefined;
    return {
      id,
      status: "success",
      elapsedMs,
      httpStatus: response.status,
      prompt,
      outputPath,
      outputSha256,
      outputFormat: imageFormat(outputBuffer),
      providerRequestId,
    };
  } catch (error) {
    return {
      id,
      status: "failure",
      elapsedMs: Math.round(performance.now() - startedAt),
      prompt,
      failureKind: "network_error",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  } finally {
    active -= 1;
  }
}

const startedAt = new Date().toISOString();
const results = await Promise.all(Array.from({ length: concurrency }, (_, index) => runOne(index)));
const endedAt = new Date().toISOString();
const elapsedValues = results.map((result) => result.elapsedMs);
const succeeded = results.filter((result) => result.status === "success").length;
const failed = results.length - succeeded;

const report = {
  schemaVersion: "lanyi_image_generate_concurrency_probe_v1",
  runId,
  operation: "image.generate",
  model,
  endpoint,
  baseUrl,
  size,
  aspectRatio,
  concurrency,
  startedAt,
  endedAt,
  summary: {
    succeeded,
    failed,
    maxObservedConcurrency,
    minElapsedMs: Math.min(...elapsedValues),
    maxElapsedMs: Math.max(...elapsedValues),
    avgElapsedMs: Math.round(elapsedValues.reduce((sum, value) => sum + value, 0) / elapsedValues.length),
    fallbackToImageEdit: false,
    rawApiKeyStored: false,
    promotionAllowed: false,
  },
  results,
};

const reportPath = path.join(outDir, "report.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

for (const result of results.filter((item) => item.outputPath)) {
  const outputPath = result.outputPath!;
  const bytes = await readFile(outputPath);
  if (bytes.length === 0 || imageFormat(bytes) === "unknown") {
    console.error(`Invalid output image: ${outputPath}`);
    process.exit(3);
  }
}

console.log(JSON.stringify({ status: failed === 0 ? "passed" : "failed", reportPath, summary: report.summary }, null, 2));

if (failed > 0) process.exit(2);
