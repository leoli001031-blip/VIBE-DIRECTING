import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  APIKEY_FUN_RESPONSES_IMAGE_DEFAULT_BASE_URL,
  APIKEY_FUN_RESPONSES_IMAGE_DEFAULT_MODEL,
  apikeyFunProbeOutputName,
  fetchApikeyFunImageViaResponses,
} from "./apikey-fun-responses-image-transport.mts";
import { getProviderApiKey } from "./runtime-api-credentials.mts";

function argValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function requireApiKey(): string {
  const key = getProviderApiKey("apikey-fun-gpt55-responses-image")
    || process.env.APIKEY_FUN_API_KEY
    || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("APIKEY_FUN_API_KEY is required for apikey.fun gpt-5.5 image live probe.");
  }
  return key;
}

const prompt = argValue("--prompt") || [
  "Create one 16:9 rough Japanese anime storyboard reference frame for video generation.",
  "Scene: rainy convenience store entrance at night, wet pavement reflections, one short-haired high-school girl holding a transparent umbrella.",
  "Mood: quiet suspense, 1990s TV anime, simple clean composition, one clear focal action.",
  "Storyboard requirements: black-and-white pencil/ink planning style, no readable text, no labels, no arrows, no panel numbers, no watermark, no logo.",
].join(" ");

const outputDir = argValue("--out") || path.join(process.cwd(), "test_artifacts", "apikey-fun-gpt55-live");
const model = argValue("--model") || APIKEY_FUN_RESPONSES_IMAGE_DEFAULT_MODEL;
const endpoint = argValue("--endpoint") || process.env.APIKEY_FUN_RESPONSES_ENDPOINT || APIKEY_FUN_RESPONSES_IMAGE_DEFAULT_BASE_URL;
const size = argValue("--size") || "1536x1024";
const quality = argValue("--quality") || "low";
const stream = argValue("--stream") !== "false";

mkdirSync(outputDir, { recursive: true });

const result = await fetchApikeyFunImageViaResponses({
  apiKey: requireApiKey(),
  endpoint,
  model,
  prompt,
  size,
  quality,
  stream,
  timeoutMs: Number(argValue("--timeout-ms") || 8 * 60 * 1000),
});

const reportPath = path.join(outputDir, "report.json");
if (!result.ok) {
  writeFileSync(reportPath, JSON.stringify({
    ...result,
    // Defensive: the transport result should not include raw credentials, and the report should not either.
    apiKeyPresent: false,
  }, null, 2));
  throw new Error(`${result.errorType}: ${result.message}`);
}

const imagePath = path.join(outputDir, apikeyFunProbeOutputName("gpt55-live", prompt));
writeFileSync(imagePath, result.bytes);
writeFileSync(reportPath, JSON.stringify({
  schemaVersion: "apikey_fun_gpt55_responses_image_live_probe_v1",
  providerId: result.providerId,
  requestedModel: result.requestedModel,
  returnedModel: result.returnedModel,
  endpoint: result.endpoint,
  transport: result.transport,
  outputPath: imagePath,
  providerRequestId: result.providerRequestId,
  prompt,
  metadata: result.metadata,
}, null, 2));

console.log(JSON.stringify({
  ok: true,
  providerId: result.providerId,
  requestedModel: result.requestedModel,
  returnedModel: result.returnedModel,
  transport: result.transport,
  outputPath: imagePath,
  reportPath,
  metadata: {
    eventCounts: result.metadata.eventCounts,
    outputTypes: result.metadata.outputTypes,
    imagePayloadCount: result.metadata.imagePayloadCount,
    uniqueImageCount: result.metadata.uniqueImageCount,
    elapsedMs: result.metadata.elapsedMs,
    referenceInputCount: result.metadata.referenceInputCount,
  },
}, null, 2));
