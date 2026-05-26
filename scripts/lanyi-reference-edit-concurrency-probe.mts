import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY } from "../src/core/providerPolicy.ts";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";

type ProbeResult = {
  id: string;
  status: "success" | "failure";
  elapsedMs: number;
  httpStatus?: number;
  referencePath: string;
  referenceSha256: string;
  prompt: string;
  outputPath?: string;
  outputSha256?: string;
  outputFormat?: "png" | "jpeg" | "webp" | "unknown";
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

function allArgValues(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg.startsWith(`${name}=`)) values.push(arg.slice(name.length + 1));
    else if (arg === name && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function sha256(buffer: Buffer | string): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function mimeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function imageFormat(buffer: Buffer): "png" | "jpeg" | "webp" | "unknown" {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpeg";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return "unknown";
}

async function decodeProviderImage(payload: unknown): Promise<Buffer | null> {
  const response = payload as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const item = response.data?.[0];
  if (!item) return null;
  if (item.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item.url) {
    const imageResponse = await fetch(item.url);
    if (!imageResponse.ok) return null;
    return Buffer.from(await imageResponse.arrayBuffer());
  }
  return null;
}

const providerStatus = getProviderConfigStatuses().find((entry) => entry.providerId === "lanyi-image2");
const apiKey = getProviderApiKey("lanyi-image2") || process.env.LANYI_API_KEY;
if (!apiKey) {
  console.error("local lanyi-image2 credential, VIBE_IMAGE2_API_KEY, or LANYI_API_KEY is required.");
  process.exit(1);
}

const concurrency = numberArg("--concurrency", IMAGE2_REFERENCE_EDIT_MAX_CONCURRENCY);
const model = argValue("--model") || process.env.VIBE_IMAGE2_MODEL || providerStatus?.imageModel || "gpt-image-2";
const baseUrl = (argValue("--base-url") || process.env.VIBE_IMAGE2_BASE_URL || providerStatus?.baseUrl || "https://lanyiapi.com").replace(/\/+$/, "");
const endpoint = "/v1/images/edits";
const timeoutMs = numberArg("--timeout-ms", 180_000);
const defaultReference = "test_artifacts/p6-real-image2/p6-lanyi-live-mvp-final-1shot/shots/P6S01/image2.png";
const references = allArgValues("--reference");
const referencePaths = references.length ? references : [defaultReference];
const runId = argValue("--run-id") || `lanyi-reference-edit-concurrency-${concurrency}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const outDir = path.resolve(argValue("--out-dir") || path.join("test_artifacts/lanyi-reference-edit-concurrency", runId));

const edits = [
  "change only the mechanic jacket to emerald green; keep the same character identity, face, pose, camera angle, linework, workshop background, composition, and aspect ratio",
  "change only the mechanic jacket to clean white with subtle fabric folds; keep the same character identity, face, pose, camera angle, linework, workshop background, composition, and aspect ratio",
  "change only the mechanic jacket to deep red; keep the same character identity, face, pose, camera angle, linework, workshop background, composition, and aspect ratio",
  "change only the mechanic jacket to black with small cyan trim; keep the same character identity, face, pose, camera angle, linework, workshop background, composition, and aspect ratio",
  "change only the mechanic jacket to yellow raincoat material; keep the same character identity, face, pose, camera angle, linework, workshop background, composition, and aspect ratio",
  "change only the mechanic jacket to violet; keep the same character identity, face, pose, camera angle, linework, workshop background, composition, and aspect ratio",
  "change only the mechanic jacket to beige canvas; keep the same character identity, face, pose, camera angle, linework, workshop background, composition, and aspect ratio",
  "change only the mechanic jacket to navy blue with silver zipper; keep the same character identity, face, pose, camera angle, linework, workshop background, composition, and aspect ratio",
  "change only the mechanic jacket to orange safety jacket; keep the same character identity, face, pose, camera angle, linework, workshop background, composition, and aspect ratio",
  "change only the mechanic jacket to gray denim; keep the same character identity, face, pose, camera angle, linework, workshop background, composition, and aspect ratio",
];

await mkdir(outDir, { recursive: true });

let active = 0;
let maxObservedConcurrency = 0;

async function runOne(index: number): Promise<ProbeResult> {
  const id = `edit-${String(index + 1).padStart(2, "0")}`;
  const referencePath = path.resolve(referencePaths[index % referencePaths.length]);
  const referenceBuffer = await readFile(referencePath);
  const referenceSha256 = sha256(referenceBuffer);
  const prompt = edits[index % edits.length];
  const startedAt = performance.now();
  active += 1;
  maxObservedConcurrency = Math.max(maxObservedConcurrency, active);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("size", "1024x1024");
    form.append("response_format", "b64_json");
    form.append(
      "image",
      new File([referenceBuffer], path.basename(referencePath), { type: mimeFor(referencePath) }),
    );

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });
    const text = await response.text();
    const elapsedMs = Math.round(performance.now() - startedAt);
    if (!response.ok) {
      return {
        id,
        status: "failure",
        elapsedMs,
        httpStatus: response.status,
        referencePath,
        referenceSha256,
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
        referencePath,
        referenceSha256,
        prompt,
        failureKind: "decode_error",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }

    const outputBuffer = await decodeProviderImage(payload);
    if (!outputBuffer) {
      return {
        id,
        status: "failure",
        elapsedMs,
        httpStatus: response.status,
        referencePath,
        referenceSha256,
        prompt,
        failureKind: "provider_empty",
        errorMessage: "Provider response did not include b64_json or downloadable url.",
      };
    }

    const outputPath = path.join(outDir, `${id}.png`);
    await writeFile(outputPath, outputBuffer);
    return {
      id,
      status: "success",
      elapsedMs,
      httpStatus: response.status,
      referencePath,
      referenceSha256,
      prompt,
      outputPath,
      outputSha256: sha256(outputBuffer),
      outputFormat: imageFormat(outputBuffer),
    };
  } catch (error) {
    return {
      id,
      status: "failure",
      elapsedMs: Math.round(performance.now() - startedAt),
      referencePath,
      referenceSha256,
      prompt,
      failureKind: "network_error",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
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
  schemaVersion: "lanyi_reference_edit_concurrency_probe_v1",
  runId,
  operation: "image.edit",
  model,
  endpoint,
  baseUrl,
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
    fallbackToTextToImage: false,
    rawApiKeyStored: false,
    promotionAllowed: false,
  },
  references: referencePaths.map((referencePath) => path.resolve(referencePath)),
  results,
};

const reportPath = path.join(outDir, "report.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: failed === 0 ? "passed" : "failed", reportPath, summary: report.summary }, null, 2));

if (failed > 0) process.exit(2);
