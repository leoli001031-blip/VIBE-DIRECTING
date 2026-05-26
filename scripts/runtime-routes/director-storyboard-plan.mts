import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildDirectorAiStoryboardPrompt,
  normalizeDirectorAiStoryboardPlan,
} from "../../src/core/directorAiStoryboardPlanner.ts";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapRequestJsonBody(parsedBody) {
  if (isRecord(parsedBody) && parsedBody.ok === true && "body" in parsedBody) return parsedBody.body;
  return parsedBody;
}

function asString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeStructuralRows(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).map((row, index) => {
    const record = isRecord(row) ? row : {};
    return {
      id: asString(record.id, `row_${index + 1}`),
      title: asString(record.title, `结构行 ${index + 1}`),
      text: asString(record.text || record.summary || record.visualDescription),
      durationSeconds: typeof record.durationSeconds === "number" ? record.durationSeconds : Number(record.durationSeconds) || undefined,
      timeRange: asString(record.timeRange),
      characters: asString(record.characters),
      scene: asString(record.scene),
      props: asString(record.props),
    };
  }).filter((row) => row.text || row.title);
}

function redactForEvidence(value) {
  return JSON.stringify(value, null, 2).replace(/\b(sk|tvly)-[A-Za-z0-9._-]{12,}\b/g, "$1-REDACTED");
}

function writeEvidence(runtimeRoot, relativePath, value) {
  const filePath = path.join(runtimeRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${redactForEvidence(value)}\n`, "utf8");
  return { filePath, relativePath };
}

function extractJsonObject(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Director planning model did not return a JSON object.");
  return JSON.parse(source.slice(start, end + 1));
}

function sourceTextForRecovery(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || text;
  const start = source.indexOf("{");
  return start >= 0 ? source.slice(start) : source;
}

function parseJsonStringLiteral(raw) {
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw.replace(/\\"/g, "\"").replace(/\\\\/g, "\\").trim();
  }
}

function recoverStringField(source, fieldName) {
  const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`"${escapedField}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  return match ? parseJsonStringLiteral(match[1]) : "";
}

function recoverNumberField(source, fieldName) {
  const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`"${escapedField}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
  return match ? Number(match[1]) : undefined;
}

function completeObjectsFromArrayField(source, fieldName) {
  const fieldIndex = source.indexOf(`"${fieldName}"`);
  if (fieldIndex < 0) return [];
  const arrayStart = source.indexOf("[", fieldIndex);
  if (arrayStart < 0) return [];

  const objects = [];
  let inString = false;
  let escapeNext = false;
  let depth = 0;
  let objectStart = -1;
  for (let index = arrayStart + 1; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (char === "\\") {
        escapeNext = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) objectStart = index;
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        objects.push(source.slice(objectStart, index + 1));
        objectStart = -1;
      }
      continue;
    }
    if (char === "]" && depth === 0) break;
  }
  return objects;
}

export function recoverDirectorStoryboardPlanFromText(text) {
  try {
    return {
      rawPlan: extractJsonObject(text),
      partialRecovered: false,
      recoveredShotCount: undefined,
      parseError: undefined,
    };
  } catch (error) {
    const source = sourceTextForRecovery(text);
    const shots = completeObjectsFromArrayField(source, "shots")
      .map((rawObject) => {
        try {
          return JSON.parse(rawObject);
        } catch {
          return undefined;
        }
      })
      .filter(Boolean);
    if (!shots.length) throw error;
    return {
      rawPlan: {
        narrativeGoal: recoverStringField(source, "narrativeGoal") || "AI 分镜返回被截断，已恢复完整镜头。",
        totalDurationSeconds: recoverNumberField(source, "totalDurationSeconds"),
        warnings: ["ai_storyboard_response_partial_recovered"],
        shots,
      },
      partialRecovered: true,
      recoveredShotCount: shots.length,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

export function parseSseBlocks(rawText) {
  return rawText
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const event = block.match(/^event:\s*(.+)$/m)?.[1]?.trim() || "message";
      const data = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      return { event, data };
    });
}

function chatDeltaFromStreamJson(json) {
  const choice = json?.choices?.[0];
  return [
    choice?.delta?.content,
    choice?.message?.content,
    choice?.text,
    json?.delta,
    json?.content,
  ].filter((value) => typeof value === "string").join("");
}

function chatUsageFromStreamJson(json) {
  return json?.usage || json?.response?.usage;
}

function responsesTextFromOutput(output) {
  if (!Array.isArray(output)) return "";
  return output
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .map((content) => content?.text || content?.value || "")
    .filter((value) => typeof value === "string")
    .join("");
}

function responseDeltaFromStreamJson(json) {
  return [
    json?.type === "response.output_text.delta" ? json?.delta : undefined,
    json?.type === "response.refusal.delta" ? json?.delta : undefined,
    json?.delta,
    json?.text,
    json?.content,
    responsesTextFromOutput(json?.response?.output),
    responsesTextFromOutput(json?.output),
  ].filter((value) => typeof value === "string").join("");
}

async function readTextStream(response) {
  if (!response.body) return await response.text();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let rawText = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    rawText += decoder.decode(value, { stream: true });
  }
  rawText += decoder.decode();
  return rawText;
}

async function fetchChatPlanStream({ apiKey, endpoint, model, prompt }) {
  const body = {
    model,
    temperature: 0.25,
    max_tokens: 16000,
    stream: true,
    messages: [
      {
        role: "system",
        content: "Return only compact valid JSON. You are a precise film storyboard planner for AIGC video workflows.",
      },
      { role: "user", content: prompt },
    ],
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(240_000),
  });
  const rawText = await readTextStream(response);
  if (!response.ok) throw new Error(`director storyboard planning stream failed: HTTP ${response.status} ${rawText.slice(0, 500)}`);

  const events = parseSseBlocks(rawText);
  if (!events.length && rawText.trim().startsWith("{")) {
    const payload = JSON.parse(rawText);
    return {
      content: payload?.choices?.[0]?.message?.content || "",
      usage: payload?.usage,
      model,
      endpoint: "/v1/chat/completions",
      transport: "chat_completions_json_fallback",
      rawStreamBytes: Buffer.byteLength(rawText),
      eventCount: 0,
    };
  }

  let content = "";
  let usage;
  let finishReason = "";
  for (const event of events) {
    if (!event.data || event.data === "[DONE]") continue;
    try {
      const json = JSON.parse(event.data);
      content += chatDeltaFromStreamJson(json);
      usage = chatUsageFromStreamJson(json) || usage;
      finishReason = json?.choices?.[0]?.finish_reason || finishReason;
    } catch {
      // Keep reading other events; providers sometimes send non-JSON keepalive frames.
    }
  }
  if (!content.trim()) throw new Error("director storyboard planning stream returned no content.");
  return {
    content,
    usage,
    finishReason,
    model,
    endpoint: "/v1/chat/completions",
    transport: "chat_completions_stream",
    rawStreamBytes: Buffer.byteLength(rawText),
    eventCount: events.length,
  };
}

async function fetchChatPlanJson({ apiKey, endpoint, model, prompt }) {
  const body = {
    model,
    temperature: 0.25,
    max_tokens: 16000,
    messages: [
      {
        role: "system",
        content: "Return only compact valid JSON. You are a precise film storyboard planner for AIGC video workflows.",
      },
      { role: "user", content: prompt },
    ],
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`director storyboard planning failed: HTTP ${response.status} ${text.slice(0, 500)}`);
  const payload = JSON.parse(text);
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("director storyboard planning returned no content.");
  return {
    content,
    usage: payload?.usage,
    model,
    endpoint: "/v1/chat/completions",
    transport: "chat_completions_json",
  };
}

async function fetchChatPlan({ apiKey, baseUrl, model, prompt }) {
  const endpoint = `${baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1/chat/completions`;
  try {
    return await fetchChatPlanStream({ apiKey, endpoint, model, prompt });
  } catch (streamError) {
    const streamMsg = streamError instanceof Error ? streamError.message : String(streamError);
    try {
      const fallback = await fetchChatPlanJson({ apiKey, endpoint, model, prompt });
      return {
        ...fallback,
        streamFallbackReason: streamMsg,
      };
    } catch (fallbackError) {
      const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`director storyboard planning failed: stream error: ${streamMsg}; fallback error: ${fallbackMsg}`);
    }
  }
}

async function fetchResponsesPlanStream({ apiKey, endpoint, model, prompt }) {
  const body = {
    model,
    temperature: 0.25,
    max_output_tokens: 16000,
    stream: true,
    input: [
      {
        role: "system",
        content: "Return only compact valid JSON. You are a precise film storyboard planner for AIGC video workflows.",
      },
      { role: "user", content: prompt },
    ],
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(240_000),
  });
  const rawText = await readTextStream(response);
  if (!response.ok) throw new Error(`director storyboard planning responses stream failed: HTTP ${response.status} ${rawText.slice(0, 500)}`);

  const events = parseSseBlocks(rawText);
  if (!events.length && rawText.trim().startsWith("{")) {
    const payload = JSON.parse(rawText);
    return {
      content: payload?.output_text || responsesTextFromOutput(payload?.output) || "",
      usage: payload?.usage,
      model,
      endpoint: "/v1/responses",
      transport: "responses_json_fallback",
      rawStreamBytes: Buffer.byteLength(rawText),
      eventCount: 0,
    };
  }

  let content = "";
  let usage;
  let finishReason = "";
  const seenCompletedText = new Set();
  for (const event of events) {
    if (!event.data || event.data === "[DONE]") continue;
    try {
      const json = JSON.parse(event.data);
      const delta = responseDeltaFromStreamJson(json);
      if (json?.type === "response.completed") {
        const completedText = responsesTextFromOutput(json?.response?.output);
        if (completedText && !seenCompletedText.has(completedText)) {
          seenCompletedText.add(completedText);
          if (!content.includes(completedText)) content += completedText;
        }
      } else {
        content += delta;
      }
      usage = json?.usage || json?.response?.usage || usage;
      finishReason = json?.response?.status || json?.status || finishReason;
    } catch {
      // Keep reading other events; providers sometimes send non-JSON keepalive frames.
    }
  }
  if (!content.trim()) throw new Error("director storyboard planning responses stream returned no content.");
  return {
    content,
    usage,
    finishReason,
    model,
    endpoint: "/v1/responses",
    transport: "responses_stream",
    rawStreamBytes: Buffer.byteLength(rawText),
    eventCount: events.length,
  };
}

async function fetchResponsesPlanJson({ apiKey, endpoint, model, prompt }) {
  const body = {
    model,
    temperature: 0.25,
    max_output_tokens: 16000,
    input: [
      {
        role: "system",
        content: "Return only compact valid JSON. You are a precise film storyboard planner for AIGC video workflows.",
      },
      { role: "user", content: prompt },
    ],
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`director storyboard planning responses failed: HTTP ${response.status} ${text.slice(0, 500)}`);
  const payload = JSON.parse(text);
  const content = payload?.output_text || responsesTextFromOutput(payload?.output);
  if (typeof content !== "string" || !content.trim()) throw new Error("director storyboard planning responses returned no content.");
  return {
    content,
    usage: payload?.usage,
    model,
    endpoint: "/v1/responses",
    transport: "responses_json",
  };
}

async function fetchResponsesPlan({ apiKey, baseUrl, model, prompt }) {
  const endpoint = baseUrl.replace(/\/+$/, "") || "https://api.apikey.fun/v1/responses";
  try {
    return await fetchResponsesPlanStream({ apiKey, endpoint, model, prompt });
  } catch (streamError) {
    const streamMsg = streamError instanceof Error ? streamError.message : String(streamError);
    try {
      const fallback = await fetchResponsesPlanJson({ apiKey, endpoint, model, prompt });
      return {
        ...fallback,
        streamFallbackReason: streamMsg,
      };
    } catch (fallbackError) {
      const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`director storyboard planning failed: stream error: ${streamMsg}; fallback error: ${fallbackMsg}`);
    }
  }
}

function providerStatusById(statuses, providerId) {
  return statuses.find((entry) => entry.providerId === providerId) || {};
}

function providerById(id, statuses, getProviderApiKey) {
  if (id === "deepseek-v4-pro") {
    const deepseekStatus = providerStatusById(statuses, "deepseek-v4-pro");
    const deepseekKey = getProviderApiKey("deepseek-v4-pro");
    if (!deepseekKey) return undefined;
    return {
      providerId: "deepseek-v4-pro",
      apiKey: deepseekKey,
      baseUrl: asString(deepseekStatus.baseUrl, "https://api.deepseek.com"),
      model: asString(deepseekStatus.chatModel, "deepseek-v4-pro"),
      mode: "chat",
    };
  }

  if (id === "apikey-fun-gpt55-responses-image") {
    const apikeyFunStatus = providerStatusById(statuses, "apikey-fun-gpt55-responses-image");
    const apikeyFunKey = getProviderApiKey("apikey-fun-gpt55-responses-image");
    if (!apikeyFunKey) return undefined;
    return {
      providerId: "apikey-fun-gpt55-responses-image",
      apiKey: apikeyFunKey,
      baseUrl: asString(apikeyFunStatus.baseUrl, "https://api.apikey.fun/v1/responses"),
      model: asString(apikeyFunStatus.chatModel || apikeyFunStatus.imageModel, "gpt-5.5"),
      mode: "responses",
    };
  }

  if (id === "lanyi-image2") {
    const lanyiStatus = providerStatusById(statuses, "lanyi-image2");
    const lanyiKey = getProviderApiKey("lanyi-image2");
    if (!lanyiKey) return undefined;
    return {
      providerId: "lanyi-image2",
      apiKey: lanyiKey,
      baseUrl: asString(lanyiStatus.baseUrl, "https://lanyiapi.com"),
      model: asString(lanyiStatus.chatModel, "claude-opus-4-6"),
      mode: "chat",
    };
  }

  return undefined;
}

function pickStoryboardProvider({ getProviderApiKey, getProviderConfigStatuses }) {
  const statuses = getProviderConfigStatuses();
  const preferredProviderId = asString(process.env.VIBE_DIRECTOR_STORYBOARD_PROVIDER_ID || process.env.VIBE_CHAT_PROVIDER_ID);
  if (preferredProviderId) {
    const preferred = providerById(preferredProviderId, statuses, getProviderApiKey);
    if (preferred) return preferred;
  }

  const deepseek = providerById("deepseek-v4-pro", statuses, getProviderApiKey);
  if (deepseek) return deepseek;

  const lanyi = providerById("lanyi-image2", statuses, getProviderApiKey);
  if (lanyi && asString(process.env.VIBE_CHAT_MODEL)) return lanyi;

  const apikeyFun = providerById("apikey-fun-gpt55-responses-image", statuses, getProviderApiKey);
  if (apikeyFun) return apikeyFun;

  if (lanyi) return lanyi;

  return undefined;
}

export function createRuntimeApiDirectorStoryboardPlanRoute({
  endpoint,
  getProviderApiKey = () => undefined,
  getProviderConfigStatuses = () => [],
  readRequestJsonBody,
  runtimePolicy,
  runtimeRoot,
  writeJson,
}) {
  async function handleRuntimeApiDirectorStoryboardPlanRoute(req, res, url) {
    if (url.pathname !== endpoint) return false;
    if (req.method !== "POST") {
      writeJson(res, 405, {
        ok: false,
        ...runtimePolicy(),
        status: "method_not_allowed",
        providerCalled: false,
      });
      return true;
    }

    try {
    const parsedBody = await readRequestJsonBody(req, { signal: AbortSignal.timeout(10_000) });
    if (isRecord(parsedBody) && parsedBody.ok === false) {
      writeJson(res, 400, {
        ok: false,
        ...runtimePolicy(),
        status: "bad_request",
        message: asString(parsedBody.message, "Request body must be valid JSON."),
        providerCalled: false,
      });
      return true;
    }

    const body = unwrapRequestJsonBody(parsedBody);
    if (!isRecord(body)) {
      writeJson(res, 400, {
        ok: false,
        ...runtimePolicy(),
        status: "bad_request",
        message: "Request body must be a JSON object.",
        providerCalled: false,
      });
      return true;
    }

    const scriptText = asString(body.scriptText);
    const structuralRows = safeStructuralRows(body.structuralRows);
    if (!scriptText && !structuralRows.length) {
      writeJson(res, 400, {
        ok: false,
        ...runtimePolicy(),
        status: "blocked",
        message: "脚本或结构行为空，不能让 AI 拆分。",
        providerCalled: false,
      });
      return true;
    }

    const storyboardProvider = pickStoryboardProvider({ getProviderApiKey, getProviderConfigStatuses });
    // NOTE: HTTP 200 + ok:false can confuse middleware / proxies that expect
    // HTTP error status codes (4xx/5xx) for error responses. This pattern is
    // intentional here because the runtime API boundary always returns 200 for
    // JSON application-layer errors so the Electron renderer can parse them.
    if (!storyboardProvider) {
      writeJson(res, 200, {
        ok: false,
        ...runtimePolicy(),
        status: "blocked_missing_ai_key",
        message: "AI 分镜需要先配置可用的 AI Key；当前只会显示本地初步识别。",
        providerCalled: false,
      });
      return true;
    }

    const prompt = buildDirectorAiStoryboardPrompt({
      scriptText,
      styleText: asString(body.styleText),
      userPreference: asString(body.userPreference),
      targetDurationSeconds: typeof body.targetDurationSeconds === "number" ? body.targetDurationSeconds : undefined,
      structuralRows,
    });
    const evidenceId = createHash("sha256").update(JSON.stringify({ scriptText, structuralRows, styleText: body.styleText })).digest("hex").slice(0, 16);
    const evidenceDir = path.join(".vibe-runtime", "director-storyboard-plan", evidenceId);

    try {
      writeEvidence(runtimeRoot, path.join(evidenceDir, "request.json"), {
        providerId: storyboardProvider.providerId,
        endpoint: storyboardProvider.mode === "responses" ? "/v1/responses" : "/v1/chat/completions",
        model: storyboardProvider.model,
        rawApiKeyStored: false,
        promptPreview: prompt.slice(0, 2000),
        structuralRowCount: structuralRows.length,
      });
      const result = storyboardProvider.mode === "responses"
        ? await fetchResponsesPlan({
          apiKey: storyboardProvider.apiKey,
          baseUrl: storyboardProvider.baseUrl,
          model: storyboardProvider.model,
          prompt,
        })
        : await fetchChatPlan({
          apiKey: storyboardProvider.apiKey,
          baseUrl: storyboardProvider.baseUrl,
          model: storyboardProvider.model,
          prompt,
        });
      writeEvidence(runtimeRoot, path.join(evidenceDir, "response.json"), {
        providerId: storyboardProvider.providerId,
        model: result.model,
        endpoint: result.endpoint,
        transport: result.transport,
        finishReason: result.finishReason,
        streamFallbackReason: result.streamFallbackReason ?? null,
        rawStreamBytes: result.rawStreamBytes,
        eventCount: result.eventCount,
        content: result.content,
        usage: result.usage,
      });
      const recovery = recoverDirectorStoryboardPlanFromText(result.content);
      const plan = normalizeDirectorAiStoryboardPlan(recovery.rawPlan);
      writeEvidence(runtimeRoot, path.join(evidenceDir, "plan.json"), plan);
      if (recovery.partialRecovered) {
        writeEvidence(runtimeRoot, path.join(evidenceDir, "recovery.json"), {
          partialRecovered: true,
          recoveredShotCount: recovery.recoveredShotCount,
          parseError: recovery.parseError,
        });
      }
      writeJson(res, 200, {
        ok: true,
        ...runtimePolicy(),
        status: recovery.partialRecovered ? "succeeded_partial" : "succeeded",
        providerCalled: true,
        plan,
        evidencePath: path.join(evidenceDir, "plan.json").replace(/\\/g, "/"),
        partialRecovered: recovery.partialRecovered,
        recoveredShotCount: recovery.recoveredShotCount,
        model: storyboardProvider.model,
        providerId: storyboardProvider.providerId,
      });
      return true;
    } catch (error) {
      writeEvidence(runtimeRoot, path.join(evidenceDir, "error.json"), {
        rawApiKeyStored: false,
        message: error instanceof Error ? error.message : String(error),
      });
      writeJson(res, 200, {
        ok: false,
        ...runtimePolicy(),
        status: "provider_failed",
        message: error instanceof Error ? error.message : String(error),
        providerCalled: true,
        evidencePath: path.join(evidenceDir, "error.json").replace(/\\/g, "/"),
        model: storyboardProvider.model,
        providerId: storyboardProvider.providerId,
      });
      return true;
    }
    } catch (error) {
      writeJson(res, 400, {
        ok: false,
        ...runtimePolicy(),
        status: "bad_request",
        message: error instanceof Error ? error.message : "Invalid request for director storyboard planning.",
        providerCalled: false,
      });
      return true;
    }
  }

  return { handleRuntimeApiDirectorStoryboardPlanRoute };
}
