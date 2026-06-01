import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { fetchLanyiImageViaResponsesStream } from "./lanyi-responses-stream-transport.mts";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";

function argValue(name: string): string | undefined {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function writeJson(filePath: string, payload: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeText(filePath: string, value: string | Buffer): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value);
}

function inferMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function packageRelative(root: string, filePath: string): string {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function retryableImage2Result(result: any): boolean {
  if (result?.ok) return false;
  if (result?.providerResponseMetadata?.retryable === true) return true;
  if (["timeout", "network_error", "rate_limit", "provider_missing", "server_error"].includes(result?.errorType)) return true;
  return typeof result?.statusCode === "number" && result.statusCode >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const providerStatus = getProviderConfigStatuses().find((entry) => entry.providerId === "lanyi-image2");
const apiKey = getProviderApiKey("lanyi-image2") || process.env.LANYI_API_KEY || process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("local lanyi-image2 credential, VIBE_IMAGE2_API_KEY, LANYI_API_KEY, or OPENAI_API_KEY is required for the live Image2 storyboard test.");

const promptPackPath = path.resolve(argValue("--prompt-pack") || "real-test-sandbox/script-storyboard-prompt-pack-20260521-01/prompt-pack.json");
const shotId = argValue("--shot-id") || "RS06";
const model = argValue("--model") || process.env.VIBE_IMAGE2_MODEL || process.env.IMAGE_MODEL || providerStatus?.imageModel || "gpt-image-2";
const size = argValue("--size") || "1280x720";
const quality = argValue("--quality") || "standard";
const baseUrl = argValue("--base-url") || process.env.VIBE_IMAGE2_BASE_URL || process.env.LANYI_BASE_URL || providerStatus?.baseUrl || "https://lanyiapi.com/v1";
const maxRetries = Number(argValue("--max-retries") || "2");
const pack = JSON.parse(readFileSync(promptPackPath, "utf8"));
const shot = pack.shots?.find((item: any) => item.shotId === shotId);
if (!shot) throw new Error(`Shot ${shotId} not found in ${promptPackPath}`);

const outputRoot = path.resolve(argValue("--output-root") || path.join(
  path.dirname(promptPackPath),
  "live-image2",
  `${shotId}-${new Date().toISOString().replace(/[:.]/g, "-")}`,
));
const prompt = String(shot.image2StoryboardPlan?.prompt || "");
if (!prompt.trim()) throw new Error(`Shot ${shotId} does not have an Image2 storyboard prompt.`);

const references = (shot.image2StoryboardPlan?.references || []).map((reference: any) => {
  const filePath = path.resolve(reference.path);
  if (!existsSync(filePath)) throw new Error(`Missing reference image: ${filePath}`);
  const bytes = readFileSync(filePath);
  return {
    role: reference.role,
    path: filePath,
    name: path.basename(filePath),
    mimeType: inferMime(filePath),
    bytes,
    sha256: sha256(bytes),
  };
});

writeText(path.join(outputRoot, "prompt.md"), prompt);
writeJson(path.join(outputRoot, "reference-manifest.json"), references.map((reference) => ({
  role: reference.role,
  path: reference.path,
  name: reference.name,
  mimeType: reference.mimeType,
  sha256: reference.sha256,
  bytes: reference.bytes.length,
})));

let result: any;
let rawSsePath = "";
const attempts: Array<Record<string, unknown>> = [];
const maxAttempts = Math.max(1, Math.floor(maxRetries) + 1);
for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
  result = await fetchLanyiImageViaResponsesStream({
    apiKey,
    baseUrl,
    model,
    prompt,
    size,
    quality,
    providerOperation: "responses.image_generation_script_storyboard_reference",
    timeoutMs: 8 * 60 * 1000,
    referenceImages: references,
  });
  if (result.rawSseBytes) {
    rawSsePath = path.join(outputRoot, "receipts", `attempt-${attemptNumber}.sse.txt`);
    writeText(rawSsePath, result.rawSseBytes);
  }
  attempts.push({
    attemptNumber,
    ok: result.ok,
    statusCode: result.statusCode,
    errorType: result.errorType,
    failureKind: result.failureKind,
    elapsedMs: result.providerResponseMetadata?.elapsedMs,
    retryable: retryableImage2Result(result),
  });
  if (result.ok || !retryableImage2Result(result) || attemptNumber === maxAttempts) break;
  await sleep(5_000 * attemptNumber);
}

const outputImagePath = path.join(outputRoot, `${shotId}-storyboard-reference.png`);
if (result.ok) writeText(outputImagePath, result.bytes);

const receipt = {
  schemaVersion: "script_storyboard_image2_live_test_v1",
  shotId,
  ok: Boolean(result.ok),
  model,
  size,
  quality,
  providerCalled: true,
  rawApiKeyStored: false,
  promptPackPath,
  promptPath: packageRelative(outputRoot, path.join(outputRoot, "prompt.md")),
  outputImagePath: result.ok ? packageRelative(outputRoot, outputImagePath) : undefined,
  outputImageSha256: result.ok ? sha256(result.bytes) : undefined,
  rawSsePath: rawSsePath ? packageRelative(outputRoot, rawSsePath) : undefined,
  attempts,
  referenceCount: references.length,
  references: references.map((reference) => ({
    role: reference.role,
    path: reference.path,
    sha256: reference.sha256,
  })),
  providerRequestId: result.providerRequestId,
  providerResponseMetadata: result.providerResponseMetadata,
  failure: result.ok ? undefined : {
    statusCode: result.statusCode,
    errorType: result.errorType,
    failureKind: result.failureKind,
    message: result.message,
    diagnostic: result.diagnostic,
  },
};
writeJson(path.join(outputRoot, "receipt.json"), receipt);
writeText(path.join(outputRoot, "summary.md"), [
  `# ${shotId} Image2 storyboard live test`,
  "",
  `- ok: ${Boolean(result.ok)}`,
  `- model: ${model}`,
  `- size: ${size}`,
  `- reference_count: ${references.length}`,
  `- output: ${result.ok ? packageRelative(outputRoot, outputImagePath) : "failed"}`,
  `- raw_api_key_stored: false`,
  "",
].join("\n"));

console.log(JSON.stringify({
  ok: Boolean(result.ok),
  shotId,
  outputRoot,
  outputImagePath: result.ok ? outputImagePath : undefined,
  receiptPath: path.join(outputRoot, "receipt.json"),
  attempts,
}, null, 2));
