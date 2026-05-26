import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";

type ProbeResult = {
  ok: boolean;
  status?: number;
  id: string;
  responseId?: string;
  firstChunkMs: number | null;
  lastChunkMs: number | null;
  totalMs: number;
  bytes: number;
  eventCounts: Record<string, number>;
  imageReturned: boolean;
  imagePath: string | null;
  rawPath: string;
  promptPath: string;
  imageSha256?: string;
  error?: string;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function numberArg(name: string, fallback: number) {
  const value = Number(argValue(name) || process.env[`IMAGE_${name.toUpperCase().replace(/-/g, "_")}`]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function inferMime(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
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
      // Raw SSE is persisted for diagnosis.
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

function promptFor(index: number) {
  const variants = [
    ["misty tram stop", "the compass locket opens into a soft amber map"],
    ["abandoned projection booth", "film dust becomes a glowing city diagram"],
    ["rainy rooftop", "tram wires draw bright lines across the dawn sky"],
    ["quiet archive room", "wet photo negatives shimmer like tiny windows"],
    ["empty midnight street", "a distant tram headlight catches the locket glass"],
    ["old ticket hall", "paper tickets rise in a clean spiral of warm light"],
    ["blue-hour bridge", "the character follows a small projected map on the pavement"],
    ["narrow alley cafe", "reflections in the window echo the compass shape"],
    ["tram interior", "empty seats glow with remembered silhouettes"],
    ["dawn platform", "the final tram arrives through gentle fog"],
    ["underground repair bay", "a brass mechanism projects a clean constellation"],
    ["museum stairwell", "soft map light climbs the stone steps"],
  ];
  const [place, action] = variants[(index - 1) % variants.length];
  return [
    `Create one clean cinematic reference frame ${index} for the same short-film world, 16:9 composition.`,
    `Setting: ${place}; ${action}.`,
    "Use the attached image as style and continuity reference for atmosphere, restrained lighting, character mood, and framing rhythm.",
    "Keep the same adult woman character direction but allow a fresh pose and camera angle.",
    "Visual style: realistic cinematic still, simple hierarchy, coherent subject, natural hands, no text, no logo, no watermark, no collage, no panel layout.",
  ].join(" ");
}

async function runOne(input: {
  id: string;
  prompt: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  size: string;
  quality: string;
  referenceDataUrl?: string;
  outDir: string;
  stamp: string;
}): Promise<ProbeResult> {
  const started = Date.now();
  const prefix = `image2-${input.id}-${input.stamp}`;
  const rawPath = path.join(input.outDir, `${prefix}.sse.txt`);
  const jsonPath = path.join(input.outDir, `${prefix}.json`);
  const imagePath = path.join(input.outDir, `${prefix}.png`);
  const promptPath = path.join(input.outDir, `${prefix}.prompt.txt`);
  writeFileSync(promptPath, input.prompt, "utf8");

  const content: Array<Record<string, string>> = [{ type: "input_text", text: input.prompt }];
  if (input.referenceDataUrl) content.push({ type: "input_image", image_url: input.referenceDataUrl });

  try {
    const response = await fetch(`${input.baseUrl}/v1/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        "X-Client-Request-Id": `vibe-director.concurrency.${input.id}.${randomUUID()}`,
      },
      body: JSON.stringify({
        model: input.model,
        input: [{ role: "user", content }],
        tools: [{ type: "image_generation", size: input.size, quality: input.quality }],
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
      const imageBytes = Buffer.from(imageBase64, "base64");
      imageSha256 = `sha256:${createHash("sha256").update(imageBytes).digest("hex")}`;
      writeFileSync(imagePath, imageBytes);
    }

    const result: ProbeResult = {
      ok: response.ok,
      status: response.status,
      id: input.id,
      responseId,
      firstChunkMs,
      lastChunkMs,
      totalMs: Date.now() - started,
      bytes,
      eventCounts,
      imageReturned: Boolean(imageBase64),
      imagePath: imageBase64 ? imagePath : null,
      rawPath,
      promptPath,
      imageSha256,
    };
    writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    return result;
  } catch (error) {
    const result: ProbeResult = {
      ok: false,
      id: input.id,
      firstChunkMs: null,
      lastChunkMs: null,
      totalMs: Date.now() - started,
      bytes: 0,
      eventCounts: {},
      imageReturned: false,
      imagePath: null,
      rawPath,
      promptPath,
      error: error instanceof Error ? error.message : String(error),
    };
    writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    return result;
  }
}

const providerStatuses = getProviderConfigStatuses();
const provider = providerStatuses.find((item) => item.providerId === "lanyi-image2") || providerStatuses[0];
const apiKey = getProviderApiKey("lanyi-image2");
if (!apiKey) throw new Error("Lanyi Image2 key is not configured.");

const baseUrl = (process.env.LANYI_BASE_URL || provider?.baseUrl || "https://lanyiapi.com").replace(/\/+$/, "").replace(/\/v1$/, "");
const model = process.env.IMAGE_MODEL || provider?.imageModel || "gpt-image-2";
const size = argValue("size") || process.env.IMAGE_SIZE || "1280x720";
const quality = argValue("quality") || process.env.IMAGE_QUALITY || "standard";
const total = numberArg("total", 10);
const concurrency = numberArg("concurrency", 10);
const runId = argValue("run-id") || `lanyi-responses-stream-concurrency-${concurrency}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const outDir = path.resolve(argValue("out-dir") || path.join("real-test-sandbox", runId));
mkdirSync(outDir, { recursive: true });

const referencePath = argValue("reference")
  || process.env.REFERENCE_IMAGE_PATH
  || path.resolve("real-test-sandbox/lanyi-responses-stream-optimization-20260519/responses-stream-image.png");
const referenceDataUrl = existsSync(referencePath)
  ? `data:${inferMime(referencePath)};base64,${readFileSync(referencePath).toString("base64")}`
  : undefined;

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const started = Date.now();
const tasks = Array.from({ length: total }, (_, index) => ({
  id: `shot-${String(index + 1).padStart(2, "0")}`,
  prompt: promptFor(index + 1),
}));
const results: ProbeResult[] = [];

for (let i = 0; i < tasks.length; i += concurrency) {
  const chunk = tasks.slice(i, i + concurrency);
  const settled = await Promise.allSettled(chunk.map((task) => runOne({
    ...task,
    apiKey,
    baseUrl,
    model,
    size,
    quality,
    referenceDataUrl,
    outDir,
    stamp,
  })));
  for (const item of settled) {
    results.push(item.status === "fulfilled"
      ? item.value
      : {
        ok: false,
        id: "unknown",
        firstChunkMs: null,
        lastChunkMs: null,
        totalMs: 0,
        bytes: 0,
        eventCounts: {},
        imageReturned: false,
        imagePath: null,
        rawPath: "",
        promptPath: "",
        error: item.reason instanceof Error ? item.reason.message : String(item.reason),
      });
  }
}

const successful = results.filter((item) => item.ok && item.imageReturned);
const firstChunks = results.map((item) => item.firstChunkMs).filter((value): value is number => typeof value === "number");
const totals = results.map((item) => item.totalMs).filter((value) => value > 0);
const manifest = {
  ok: successful.length === results.length,
  model,
  baseUrl,
  size,
  quality,
  concurrency,
  total,
  referencePath: referenceDataUrl ? referencePath : null,
  totalMs: Date.now() - started,
  summary: {
    succeeded: successful.length,
    failed: results.length - successful.length,
    firstChunkMinMs: firstChunks.length ? Math.min(...firstChunks) : null,
    firstChunkMaxMs: firstChunks.length ? Math.max(...firstChunks) : null,
    taskTotalMinMs: totals.length ? Math.min(...totals) : null,
    taskTotalMaxMs: totals.length ? Math.max(...totals) : null,
    keepaliveTotal: results.reduce((sum, item) => sum + (item.eventCounts.keepalive || 0), 0),
    partialImageTotal: results.reduce((sum, item) => sum + (item.eventCounts["response.image_generation_call.partial_image"] || 0), 0),
  },
  results,
};
const manifestPath = path.join(outDir, `image2-concurrency-${stamp}.manifest.json`);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ manifestPath, ...manifest }, null, 2));
