import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

function asString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function safeErrorField(value) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : undefined;
}

function inferMimeFromName(filePath) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function dataUrlForReferenceImage(image) {
  const bytes = image?.bytes;
  if (!bytes?.length) return undefined;
  const mimeType = image.mimeType || inferMimeFromName(image.name || image.path);
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "https://lanyiapi.com").replace(/\/+$/, "").replace(/\/v1$/, "");
}

function sha256Bytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function providerFailureMessage(errorType, statusCode) {
  if (errorType === "timeout") return "出图请求等待超时，可以稍后再试一次。";
  if (errorType === "network_error") return "网络连接中断，这次没有拿到回流图，可以稍后重试。";
  if (errorType === "rate_limit") return "出图服务暂时繁忙，可以稍后重试。";
  if (errorType === "auth") return "出图授权不可用，请检查设置里的 Key。";
  if (errorType === "parse_error") return "出图服务返回内容无法读取，可以稍后重试。";
  if (typeof statusCode === "number") return `出图服务返回 ${statusCode}，可以稍后重试。`;
  return "真实出图未完成，可以稍后重试。";
}

function classifyProviderHttpStatus(status) {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server_error";
  return "server_error";
}

function safeProviderErrorDiagnostic(error, kind, fallback) {
  const record = error && typeof error === "object" ? error : {};
  const cause = record.cause && typeof record.cause === "object" ? record.cause : {};
  return {
    kind,
    name: safeErrorField(record.name),
    message: safeErrorField(record.message) || fallback,
    causeName: safeErrorField(cause.name),
    causeCode: safeErrorField(cause.code),
    causeMessage: safeErrorField(cause.message),
    retryable: kind === "timeout" || kind === "network_error",
  };
}

export function parseLanyiResponsesStreamSse(rawText) {
  return String(rawText || "").split(/\n\n+/).flatMap((block) => {
    const event = block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!event && !data) return [];
    let json = null;
    try {
      json = data && data !== "[DONE]" ? JSON.parse(data) : null;
    } catch {
      // Raw SSE is still returned to the caller for evidence.
    }
    return [{ event, data, json }];
  });
}

export function findImageBase64InResponsesStream(value, depth = 0) {
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
      const found = findImageBase64InResponsesStream(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const key of ["b64_json", "result", "partial_image_b64", "image_base64", "base64", "data"]) {
      const found = findImageBase64InResponsesStream(value[key], depth + 1);
      if (found) return found;
    }
    for (const item of Object.values(value)) {
      const found = findImageBase64InResponsesStream(item, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function responseIdFromEventJson(value) {
  if (!value || typeof value !== "object") return undefined;
  const response = value.response;
  if (response && typeof response === "object") {
    const id = asString(response.id);
    if (id) return id;
  }
  const id = asString(value.id);
  return id?.startsWith("resp_") ? id : undefined;
}

function contentInputFor(prompt, referenceImages) {
  const content = [{ type: "input_text", text: prompt }];
  for (const image of referenceImages || []) {
    const imageUrl = dataUrlForReferenceImage(image);
    if (!imageUrl) continue;
    content.push({ type: "input_image", image_url: imageUrl });
  }
  return [{ role: "user", content }];
}

export async function fetchLanyiImageViaResponsesStream({
  apiKey,
  baseUrl,
  model,
  prompt,
  size,
  quality = "standard",
  referenceImages = [],
  timeoutMs = 8 * 60 * 1000,
  providerOperation,
}) {
  const startedAt = Date.now();
  const endpoint = `${normalizeBaseUrl(baseUrl)}/v1/responses`;
  const references = Array.isArray(referenceImages) ? referenceImages.filter((image) => image?.bytes?.length) : [];
  const requestOperation = providerOperation || (references.length ? "responses.image_generation_reference" : "responses.image_generation");
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        "X-Client-Request-Id": `vibe-director.responses-stream.${randomUUID()}`,
      },
      body: JSON.stringify({
        model,
        input: references.length ? contentInputFor(prompt, references) : prompt,
        tools: [{ type: "image_generation", size, quality }],
        stream: true,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "AbortError";
    const errorType = timeout ? "timeout" : "network_error";
    return {
      ok: false,
      statusCode: timeout ? 408 : undefined,
      errorType,
      failureKind: errorType,
      message: providerFailureMessage(errorType),
      diagnostic: safeProviderErrorDiagnostic(error, errorType, timeout ? `Responses stream request timed out after ${timeoutMs}ms` : "Responses stream request failed"),
      providerResponseMetadata: {
        transport: "responses_stream",
        providerEndpoint: "/v1/responses",
        providerOperation: requestOperation,
        returnedCount: 0,
        retryable: true,
        timeoutMs,
        referenceInputCount: references.length,
      },
    };
  }

  const chunks = [];
  let firstChunkMs = null;
  let lastChunkMs = null;
  let bytes = 0;
  try {
    const reader = response.body?.getReader();
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      const elapsed = Date.now() - startedAt;
      firstChunkMs ??= elapsed;
      lastChunkMs = elapsed;
      bytes += value.byteLength;
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "AbortError";
    const errorType = timeout ? "timeout" : "network_error";
    const rawSseBytes = Buffer.concat(chunks);
    return {
      ok: false,
      statusCode: timeout ? 408 : response.status,
      errorType,
      failureKind: errorType,
      message: providerFailureMessage(errorType, response.status),
      diagnostic: safeProviderErrorDiagnostic(error, errorType, timeout ? `Responses stream read timed out after ${timeoutMs}ms` : "Responses stream read failed"),
      rawSseBytes,
      providerResponseMetadata: {
        transport: "responses_stream",
        providerEndpoint: "/v1/responses",
        providerOperation: requestOperation,
        httpStatus: response.status,
        contentType: response.headers.get("content-type"),
        firstChunkMs,
        lastChunkMs,
        elapsedMs: Date.now() - startedAt,
        rawSseBytes: rawSseBytes.length,
        rawSseSha256: rawSseBytes.length ? sha256Bytes(rawSseBytes) : undefined,
        returnedCount: 0,
        retryable: firstChunkMs === null,
        referenceInputCount: references.length,
      },
    };
  }

  const rawSseBytes = Buffer.concat(chunks);
  const rawText = rawSseBytes.toString("utf8");
  const events = parseLanyiResponsesStreamSse(rawText);
  const eventCounts = {};
  let responseId;
  let imageBase64 = null;
  for (const event of events) {
    if (event.event) eventCounts[event.event] = (eventCounts[event.event] || 0) + 1;
    responseId ||= responseIdFromEventJson(event.json);
    imageBase64 ||= findImageBase64InResponsesStream(event.json);
  }

  const baseMetadata = {
    transport: "responses_stream",
    providerEndpoint: "/v1/responses",
    providerOperation: requestOperation,
    httpStatus: response.status,
    contentType: response.headers.get("content-type"),
    responseId,
    firstChunkMs,
    lastChunkMs,
    elapsedMs: Date.now() - startedAt,
    eventCounts,
    rawSseBytes: rawSseBytes.length,
    rawSseSha256: rawSseBytes.length ? sha256Bytes(rawSseBytes) : undefined,
    referenceInputCount: references.length,
    returnedCount: imageBase64 ? 1 : 0,
  };

  if (!response.ok) {
    const errorType = classifyProviderHttpStatus(response.status);
    return {
      ok: false,
      statusCode: response.status,
      errorType,
      failureKind: errorType === "rate_limit" ? "rate_limit" : errorType === "auth" ? "auth" : "server_error",
      message: providerFailureMessage(errorType, response.status),
      diagnostic: {
        kind: "http_error",
        message: `Image2 Responses stream returned HTTP ${response.status}`,
        causeCode: String(response.status),
        retryable: errorType === "rate_limit" || errorType === "server_error",
      },
      rawSseBytes,
      providerResponseMetadata: {
        ...baseMetadata,
        retryable: errorType === "rate_limit" || errorType === "server_error",
      },
    };
  }

  if (!imageBase64) {
    return {
      ok: false,
      statusCode: 502,
      errorType: "provider_missing",
      failureKind: "provider_missing",
      message: "出图服务没有返回可用图片，可以重试一次。",
      diagnostic: {
        kind: "parse_error",
        message: "Image2 Responses stream did not include an image base64 field.",
        retryable: true,
      },
      rawSseBytes,
      providerResponseMetadata: {
        ...baseMetadata,
        retryable: true,
      },
    };
  }

  const imageBytes = Buffer.from(imageBase64, "base64");
  return {
    ok: true,
    bytes: imageBytes,
    providerRequestId: responseId || `lanyi_responses_stream_${Date.now()}`,
    rawSseBytes,
    providerResponseMetadata: {
      ...baseMetadata,
      imageSha256: sha256Bytes(imageBytes),
      imageBytes: imageBytes.length,
      retryable: false,
    },
  };
}
