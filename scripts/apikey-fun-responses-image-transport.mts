import { createHash, randomUUID } from "node:crypto";
import { basename, extname } from "node:path";

export const APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID = "apikey-fun-gpt55-responses-image";
export const APIKEY_FUN_RESPONSES_IMAGE_DEFAULT_BASE_URL = "https://api.apikey.fun/v1/responses";
export const APIKEY_FUN_RESPONSES_IMAGE_DEFAULT_MODEL = "gpt-5.5";

export interface ApikeyFunReferenceImage {
  name?: string;
  path?: string;
  bytes: Uint8Array;
  mimeType?: string;
}

export interface ApikeyFunResponsesImageTransportInput {
  apiKey: string;
  endpoint?: string;
  model?: string;
  prompt: string;
  size?: string;
  quality?: string;
  stream?: boolean;
  referenceImages?: ApikeyFunReferenceImage[];
  timeoutMs?: number;
}

export interface ApikeyFunResponsesImageTransportOk {
  ok: true;
  providerId: typeof APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID;
  requestedModel: string;
  returnedModel?: string;
  endpoint: string;
  transport: "responses_stream" | "responses_json";
  bytes: Buffer;
  providerRequestId?: string;
  metadata: {
    httpStatus: number;
    contentType?: string | null;
    eventCounts?: Record<string, number>;
    outputTypes?: string[];
    imagePayloadCount: number;
    uniqueImageCount: number;
    elapsedMs: number;
    rawResponseBytes?: number;
    rawResponseSha256?: string;
    firstChunkMs?: number | null;
    lastChunkMs?: number | null;
    referenceInputCount: number;
  };
}

export interface ApikeyFunResponsesImageTransportFail {
  ok: false;
  providerId: typeof APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID;
  requestedModel: string;
  returnedModel?: string;
  endpoint: string;
  transport: "responses_stream" | "responses_json";
  statusCode?: number;
  errorType: "auth" | "rate_limit" | "server_error" | "timeout" | "network_error" | "parse_error" | "no_image";
  message: string;
  diagnostic?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type ApikeyFunResponsesImageTransportResult =
  | ApikeyFunResponsesImageTransportOk
  | ApikeyFunResponsesImageTransportFail;

function normalizeEndpoint(value: string | undefined): string {
  const endpoint = (value || APIKEY_FUN_RESPONSES_IMAGE_DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  if (endpoint.endsWith("/responses")) return endpoint;
  if (endpoint.endsWith("/v1")) return `${endpoint}/responses`;
  return `${endpoint}/v1/responses`;
}

function mimeFromName(value: string | undefined): string {
  const ext = extname(value || "").toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function dataUrlForImage(image: ApikeyFunReferenceImage): string {
  const mime = image.mimeType || mimeFromName(image.name || image.path);
  return `data:${mime};base64,${Buffer.from(image.bytes).toString("base64")}`;
}

function buildInput(prompt: string, referenceImages: ApikeyFunReferenceImage[]) {
  if (!referenceImages.length) return prompt;
  return [{
    role: "user",
    content: [
      { type: "input_text", text: prompt },
      ...referenceImages.map((image) => ({
        type: "input_image",
        image_url: dataUrlForImage(image),
      })),
    ],
  }];
}

function sha256(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function classifyHttpStatus(status: number): ApikeyFunResponsesImageTransportFail["errorType"] {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limit";
  return "server_error";
}

function providerMessage(type: ApikeyFunResponsesImageTransportFail["errorType"], status?: number): string {
  if (type === "auth") return "Apikey.fun 图像服务授权不可用，请检查 Key。";
  if (type === "rate_limit") return "Apikey.fun 图像服务暂时繁忙，可以稍后重试。";
  if (type === "timeout") return "Apikey.fun 图像请求等待超时，可以稍后重试。";
  if (type === "network_error") return "Apikey.fun 图像请求网络中断，可以稍后重试。";
  if (type === "parse_error") return "Apikey.fun 返回内容无法读取。";
  if (type === "no_image") return "Apikey.fun 请求完成了，但没有返回可保存的图片。";
  return typeof status === "number" ? `Apikey.fun 图像服务返回 ${status}。` : "Apikey.fun 图像服务暂时不可用。";
}

export function parseResponsesSseBlocks(rawText: string): Array<{ event?: string; json?: unknown; data: string }> {
  return String(rawText || "").split(/\n\n+/u).flatMap((block) => {
    const event = block.match(/^event:\s*(.+)$/mu)?.[1]?.trim();
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!event && !data) return [];
    if (data === "[DONE]") return [{ event, data }];
    try {
      return [{ event, data, json: data ? JSON.parse(data) : undefined }];
    } catch {
      return [{ event, data }];
    }
  });
}

export function collectImageBase64Payloads(value: unknown, depth = 0): string[] {
  if (!value || depth > 14) return [];
  if (typeof value === "string") {
    const stripped = value.replace(/^data:image\/[a-z0-9.+-]+;base64,/iu, "");
    return /^[A-Za-z0-9+/=]{1000,}$/u.test(stripped) ? [stripped] : [];
  }
  if (Array.isArray(value)) return value.flatMap((item) => collectImageBase64Payloads(item, depth + 1));
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const priorityKeys = ["result", "partial_image_b64", "b64_json", "image_base64", "base64", "data"];
    return [
      ...priorityKeys.flatMap((key) => collectImageBase64Payloads(record[key], depth + 1)),
      ...Object.entries(record)
        .filter(([key]) => !priorityKeys.includes(key))
        .flatMap(([, item]) => collectImageBase64Payloads(item, depth + 1)),
    ];
  }
  return [];
}

function responseIdFromJson(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const nested = record.response && typeof record.response === "object"
    ? (record.response as Record<string, unknown>).id
    : undefined;
  const id = typeof nested === "string" ? nested : typeof record.id === "string" ? record.id : undefined;
  return id?.startsWith("resp_") ? id : undefined;
}

function outputTypes(value: unknown): string[] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const output = (value as Record<string, unknown>).output;
  return Array.isArray(output)
    ? output.flatMap((item) => {
        const type = item && typeof item === "object" ? (item as Record<string, unknown>).type : undefined;
        return typeof type === "string" ? [type] : [];
      })
    : undefined;
}

function modelFromJson(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return typeof record.model === "string" ? record.model : undefined;
}

export async function fetchApikeyFunImageViaResponses(
  input: ApikeyFunResponsesImageTransportInput,
): Promise<ApikeyFunResponsesImageTransportResult> {
  const startedAt = Date.now();
  const endpoint = normalizeEndpoint(input.endpoint);
  const requestedModel = input.model || APIKEY_FUN_RESPONSES_IMAGE_DEFAULT_MODEL;
  const referenceImages = (input.referenceImages || []).filter((image) => image.bytes?.length);
  const transport = input.stream === false ? "responses_json" : "responses_stream";
  const body = {
    model: requestedModel,
    input: buildInput(input.prompt, referenceImages),
    tools: [{ type: "image_generation", size: input.size || "1024x1024", quality: input.quality || "low" }],
    ...(transport === "responses_stream" ? { stream: true } : {}),
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        Accept: transport === "responses_stream" ? "text/event-stream" : "application/json",
        "Content-Type": "application/json",
        "X-Client-Request-Id": `vibe-director.apikey-fun.responses-image.${randomUUID()}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(input.timeoutMs || 8 * 60 * 1000),
    });
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "AbortError";
    const errorType = timeout ? "timeout" : "network_error";
    return {
      ok: false,
      providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
      requestedModel,
      endpoint,
      transport,
      errorType,
      statusCode: timeout ? 408 : undefined,
      message: providerMessage(errorType),
      diagnostic: {
        name: error instanceof Error ? error.name : undefined,
        message: error instanceof Error ? error.message : undefined,
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
      requestedModel,
      endpoint,
      transport,
      statusCode: response.status,
      errorType: classifyHttpStatus(response.status),
      message: providerMessage(classifyHttpStatus(response.status), response.status),
      metadata: { contentType: response.headers.get("content-type") },
    };
  }

  if (transport === "responses_stream") {
    const chunks: Buffer[] = [];
    let firstChunkMs: number | null = null;
    let lastChunkMs: number | null = null;
    try {
      const reader = response.body?.getReader();
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const elapsed = Date.now() - startedAt;
        firstChunkMs ??= elapsed;
        lastChunkMs = elapsed;
        chunks.push(Buffer.from(value));
      }
    } catch (error) {
      const timeout = error instanceof DOMException && error.name === "AbortError";
      const errorType = timeout ? "timeout" : "network_error";
      return {
        ok: false,
        providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
        requestedModel,
        endpoint,
        transport,
        statusCode: timeout ? 408 : response.status,
        errorType,
        message: providerMessage(errorType, response.status),
        diagnostic: { message: error instanceof Error ? error.message : undefined },
      };
    }
    const rawBytes = Buffer.concat(chunks);
    const blocks = parseResponsesSseBlocks(rawBytes.toString("utf8"));
    const eventCounts: Record<string, number> = {};
    let providerRequestId: string | undefined;
    let returnedModel: string | undefined;
    const payloads: string[] = [];
    for (const block of blocks) {
      if (block.event) eventCounts[block.event] = (eventCounts[block.event] || 0) + 1;
      providerRequestId ||= responseIdFromJson(block.json);
      returnedModel ||= modelFromJson(block.json);
      payloads.push(...collectImageBase64Payloads(block.json));
    }
    const unique = [...new Set(payloads)];
    const finalPayload = unique[unique.length - 1];
    if (!finalPayload) {
      return {
        ok: false,
        providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
        requestedModel,
        returnedModel,
        endpoint,
        transport,
        statusCode: response.status,
        errorType: "no_image",
        message: providerMessage("no_image"),
        metadata: { eventCounts, rawResponseBytes: rawBytes.length, rawResponseSha256: sha256(rawBytes) },
      };
    }
    return {
      ok: true,
      providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
      requestedModel,
      returnedModel,
      endpoint,
      transport,
      bytes: Buffer.from(finalPayload, "base64"),
      providerRequestId,
      metadata: {
        httpStatus: response.status,
        contentType: response.headers.get("content-type"),
        eventCounts,
        imagePayloadCount: payloads.length,
        uniqueImageCount: unique.length,
        elapsedMs: Date.now() - startedAt,
        rawResponseBytes: rawBytes.length,
        rawResponseSha256: sha256(rawBytes),
        firstChunkMs,
        lastChunkMs,
        referenceInputCount: referenceImages.length,
      },
    };
  }

  let json: unknown;
  let rawBytes: Buffer;
  try {
    rawBytes = Buffer.from(await response.arrayBuffer());
    json = JSON.parse(rawBytes.toString("utf8"));
  } catch (error) {
    return {
      ok: false,
      providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
      requestedModel,
      endpoint,
      transport,
      statusCode: response.status,
      errorType: "parse_error",
      message: providerMessage("parse_error"),
      diagnostic: { message: error instanceof Error ? error.message : undefined },
    };
  }
  const payloads = collectImageBase64Payloads(json);
  const unique = [...new Set(payloads)];
  const finalPayload = unique[unique.length - 1];
  if (!finalPayload) {
    return {
      ok: false,
      providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
      requestedModel,
      returnedModel: modelFromJson(json),
      endpoint,
      transport,
      statusCode: response.status,
      errorType: "no_image",
      message: providerMessage("no_image"),
      metadata: { outputTypes: outputTypes(json), rawResponseBytes: rawBytes.length, rawResponseSha256: sha256(rawBytes) },
    };
  }
  return {
    ok: true,
    providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
    requestedModel,
    returnedModel: modelFromJson(json),
    endpoint,
    transport,
    bytes: Buffer.from(finalPayload, "base64"),
    providerRequestId: responseIdFromJson(json),
    metadata: {
      httpStatus: response.status,
      contentType: response.headers.get("content-type"),
      outputTypes: outputTypes(json),
      imagePayloadCount: payloads.length,
      uniqueImageCount: unique.length,
      elapsedMs: Date.now() - startedAt,
      rawResponseBytes: rawBytes.length,
      rawResponseSha256: sha256(rawBytes),
      referenceInputCount: referenceImages.length,
    },
  };
}

export function apikeyFunProbeOutputName(prefix: string, prompt: string): string {
  const hash = createHash("sha256").update(prompt).digest("hex").slice(0, 10);
  return `${basename(prefix).replace(/[^a-zA-Z0-9_-]+/g, "_") || "probe"}-${hash}.png`;
}
