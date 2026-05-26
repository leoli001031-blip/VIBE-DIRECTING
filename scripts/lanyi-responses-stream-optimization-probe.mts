import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function parseSse(rawText: string) {
  return rawText.split(/\n\n+/).flatMap((block) => {
    const event = block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!event && !data) return [];
    let json: unknown = null;
    try {
      json = data && data !== "[DONE]" ? JSON.parse(data) : null;
    } catch {
      // Keep the raw SSE file as evidence even when a provider sends non-JSON blocks.
    }
    return [{ event, data, json }];
  });
}

function findBase64(value: unknown, depth = 0): string | null {
  if (!value || depth > 14) return null;
  if (typeof value === "string") {
    if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(value)) {
      return value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
    }
    if (/^[A-Za-z0-9+/=]{1000,}$/.test(value) && value.length > 1000) return value;
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findBase64(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["b64_json", "result", "partial_image_b64", "image_base64", "base64", "data"]) {
      const found = findBase64(record[key], depth + 1);
      if (found) return found;
    }
    for (const item of Object.values(record)) {
      const found = findBase64(item, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function responseIdFromJson(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const response = record.response;
  if (response && typeof response === "object") {
    const id = asString((response as Record<string, unknown>).id);
    if (id) return id;
  }
  const id = asString(record.id);
  if (id?.startsWith("resp_")) return id;
  return undefined;
}

function defaultPrompt() {
  return [
    "Create one clean cinematic character and world reference image for a short film, 16:9 composition.",
    "Scene: a young night-shift film restorer stands at a quiet tram stop after rain, holding a small brass compass locket that projects a warm map of lost memories.",
    "Character: adult woman, calm determined expression, practical dark coat, short black hair, subtle tired eyes, no extra people.",
    "World: misty old city street, wet pavement, one vintage tram in the distance, soft amber shop lights, early dawn blue sky, realistic cinematic lighting.",
    "Prop: brass compass locket should be visible in her hand, simple elegant shape, no readable text, no logo, no watermark.",
    "Style: restrained, clean, not overly detailed, coherent subject, stable anatomy, natural hands, simple background hierarchy, no collage, no panels.",
    "Use clear visual focus and leave negative space for later video framing.",
  ].join(" ");
}

const providerStatuses = getProviderConfigStatuses();
const provider = providerStatuses.find((item) => item.providerId === "lanyi-image2") || providerStatuses[0];
const apiKey = getProviderApiKey("lanyi-image2");
if (!apiKey) throw new Error("Lanyi Image2 key is not configured.");

const baseUrl = (process.env.LANYI_BASE_URL || provider?.baseUrl || "https://lanyiapi.com").replace(/\/+$/, "").replace(/\/v1$/, "");
const model = process.env.IMAGE_MODEL || provider?.imageModel || "gpt-image-2";
const size = argValue("size") || process.env.IMAGE_SIZE || "1280x720";
const quality = argValue("quality") || process.env.IMAGE_QUALITY || "standard";
const prompt = process.env.IMAGE_PROMPT || defaultPrompt();
const runId = argValue("run-id") || `lanyi-responses-stream-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const outDir = path.resolve(argValue("out-dir") || path.join("real-test-sandbox", runId));
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const rawPath = path.join(outDir, "responses-stream.sse.txt");
const jsonPath = path.join(outDir, "responses-stream-summary.json");
const imagePath = path.join(outDir, "responses-stream-image.png");
const clientRequestId = `vibe-director.responses-stream.${randomUUID()}`;
const started = Date.now();

const response = await fetch(`${baseUrl}/v1/responses`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    Accept: "text/event-stream",
    "Content-Type": "application/json",
    "X-Client-Request-Id": clientRequestId,
  },
  body: JSON.stringify({
    model,
    input: prompt,
    tools: [{ type: "image_generation", size, quality }],
    stream: true,
  }),
});

const reader = response.body?.getReader();
const chunks: string[] = [];
let firstChunkMs: number | null = null;
let lastChunkMs: number | null = null;
let bytes = 0;

while (reader) {
  const { done, value } = await reader.read();
  if (done) break;
  const elapsed = Date.now() - started;
  firstChunkMs ??= elapsed;
  lastChunkMs = elapsed;
  bytes += value.byteLength;
  chunks.push(Buffer.from(value).toString("utf8"));
}

const raw = chunks.join("");
writeFileSync(rawPath, raw, "utf8");

const events = parseSse(raw);
const eventCounts: Record<string, number> = {};
let responseId: string | undefined;
let imageBase64: string | null = null;
for (const item of events) {
  if (item.event) eventCounts[item.event] = (eventCounts[item.event] || 0) + 1;
  responseId ||= responseIdFromJson(item.json);
  imageBase64 ||= findBase64(item.json);
}

let imageSha256: string | undefined;
if (imageBase64) {
  const bytes = Buffer.from(imageBase64, "base64");
  imageSha256 = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  writeFileSync(imagePath, bytes);
}

const summary = {
  ok: response.ok,
  status: response.status,
  contentType: response.headers.get("content-type"),
  responseId,
  model,
  size,
  quality,
  promptChars: prompt.length,
  firstChunkMs,
  lastChunkMs,
  elapsedMs: Date.now() - started,
  bytes,
  eventCounts,
  imageReturned: Boolean(imageBase64),
  imageSha256,
  imagePath: imageBase64 ? imagePath : null,
  rawPath,
  jsonPath,
  optimizationSignal: {
    connectionKeptAlive: Boolean(firstChunkMs !== null && lastChunkMs !== null && lastChunkMs > firstChunkMs),
    firstProviderSignalBeforeCompletion: Boolean(firstChunkMs !== null && lastChunkMs !== null && firstChunkMs < lastChunkMs),
    rawSsePersisted: true,
  },
};

writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
