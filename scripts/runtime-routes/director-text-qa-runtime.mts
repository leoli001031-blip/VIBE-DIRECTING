import {
  buildDirectorTextQaPrompt,
  normalizeDirectorTextQaReport,
  recoverDirectorTextQaReportFromText,
  skippedDirectorTextQaReport,
} from "../../src/core/directorTextQa.ts";

function asString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function providerStatusById(statuses, providerId) {
  return (Array.isArray(statuses) ? statuses : []).find((entry) => entry?.providerId === providerId) || {};
}

function providerById(id, statuses, getProviderApiKey) {
  if (id === "deepseek-v4-pro") {
    const status = providerStatusById(statuses, "deepseek-v4-pro");
    const apiKey = getProviderApiKey("deepseek-v4-pro");
    if (!apiKey) return undefined;
    return {
      providerId: "deepseek-v4-pro",
      apiKey,
      baseUrl: asString(status.baseUrl, "https://api.deepseek.com"),
      model: asString(status.chatModel, "deepseek-v4-pro"),
      mode: "chat",
    };
  }

  if (id === "lanyi-image2") {
    const status = providerStatusById(statuses, "lanyi-image2");
    const apiKey = getProviderApiKey("lanyi-image2");
    if (!apiKey) return undefined;
    return {
      providerId: "lanyi-image2",
      apiKey,
      baseUrl: asString(status.baseUrl, "https://lanyiapi.com"),
      model: asString(status.chatModel, "claude-opus-4-6"),
      mode: "chat",
    };
  }

  if (id === "apikey-fun-gpt55-responses-image") {
    const status = providerStatusById(statuses, "apikey-fun-gpt55-responses-image");
    const apiKey = getProviderApiKey("apikey-fun-gpt55-responses-image");
    if (!apiKey) return undefined;
    return {
      providerId: "apikey-fun-gpt55-responses-image",
      apiKey,
      baseUrl: asString(status.baseUrl, "https://api.apikey.fun/v1/responses"),
      model: asString(status.chatModel || status.imageModel, "gpt-5.5"),
      mode: "responses",
    };
  }

  return undefined;
}

function pickTextQaProvider({ getProviderApiKey, getProviderConfigStatuses }) {
  const statuses = getProviderConfigStatuses();
  const preferredProviderId = asString(
    process.env.VIBE_DIRECTOR_TEXT_QA_PROVIDER_ID
    || process.env.VIBE_DIRECTOR_STORYBOARD_PROVIDER_ID
    || process.env.VIBE_CHAT_PROVIDER_ID,
  );
  if (preferredProviderId) {
    const preferred = providerById(preferredProviderId, statuses, getProviderApiKey);
    if (preferred) return preferred;
  }

  return providerById("deepseek-v4-pro", statuses, getProviderApiKey)
    || providerById("lanyi-image2", statuses, getProviderApiKey)
    || providerById("apikey-fun-gpt55-responses-image", statuses, getProviderApiKey);
}

function parseSseBlocks(rawText) {
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

function responsesTextFromOutput(output) {
  if (!Array.isArray(output)) return "";
  return output
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .map((content) => content?.text || content?.value || "")
    .filter((value) => typeof value === "string")
    .join("");
}

function chatDeltaFromJson(json) {
  const choice = json?.choices?.[0];
  return [
    choice?.delta?.content,
    choice?.message?.content,
    choice?.text,
    json?.delta,
    json?.content,
  ].filter((value) => typeof value === "string").join("");
}

function responsesDeltaFromJson(json) {
  return [
    json?.type === "response.output_text.delta" ? json?.delta : undefined,
    json?.delta,
    json?.text,
    json?.content,
    responsesTextFromOutput(json?.response?.output),
    responsesTextFromOutput(json?.output),
  ].filter((value) => typeof value === "string").join("");
}

async function fetchChatJson({ apiKey, baseUrl, model, prompt }) {
  const endpoint = `${baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1/chat/completions`;
  const body = {
    model,
    temperature: 0.15,
    max_tokens: 6000,
    stream: true,
    messages: [
      {
        role: "system",
        content: "Return only compact valid JSON. You are a strict text QA reviewer for an AIGC video director workflow.",
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
    signal: AbortSignal.timeout(180_000),
  });
  const rawText = await readTextStream(response);
  if (!response.ok) throw new Error(`director text QA chat failed: HTTP ${response.status} ${rawText.slice(0, 500)}`);
  if (!rawText.trim()) throw new Error("director text QA chat returned empty body.");

  if (rawText.trim().startsWith("{") && !rawText.includes("\ndata:")) {
    const payload = JSON.parse(rawText);
    return {
      content: payload?.choices?.[0]?.message?.content || "",
      usage: payload?.usage,
      transport: "chat_completions_json",
      endpoint: "/v1/chat/completions",
    };
  }

  let content = "";
  let usage;
  for (const event of parseSseBlocks(rawText)) {
    if (!event.data || event.data === "[DONE]") continue;
    try {
      const json = JSON.parse(event.data);
      content += chatDeltaFromJson(json);
      usage = json?.usage || json?.response?.usage || usage;
    } catch {
      // Ignore provider keepalive / non-JSON stream frames.
    }
  }
  if (!content.trim()) throw new Error("director text QA chat stream returned no content.");
  return { content, usage, transport: "chat_completions_stream", endpoint: "/v1/chat/completions" };
}

async function fetchResponsesJson({ apiKey, baseUrl, model, prompt }) {
  const endpoint = baseUrl.replace(/\/+$/, "") || "https://api.apikey.fun/v1/responses";
  const body = {
    model,
    temperature: 0.15,
    max_output_tokens: 6000,
    stream: true,
    input: [
      {
        role: "system",
        content: "Return only compact valid JSON. You are a strict text QA reviewer for an AIGC video director workflow.",
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
    signal: AbortSignal.timeout(180_000),
  });
  const rawText = await readTextStream(response);
  if (!response.ok) throw new Error(`director text QA responses failed: HTTP ${response.status} ${rawText.slice(0, 500)}`);
  if (!rawText.trim()) throw new Error("director text QA responses returned empty body.");

  if (rawText.trim().startsWith("{") && !rawText.includes("\ndata:")) {
    const payload = JSON.parse(rawText);
    return {
      content: payload?.output_text || responsesTextFromOutput(payload?.output) || "",
      usage: payload?.usage,
      transport: "responses_json",
      endpoint: "/v1/responses",
    };
  }

  let content = "";
  let usage;
  const completed = new Set();
  for (const event of parseSseBlocks(rawText)) {
    if (!event.data || event.data === "[DONE]") continue;
    try {
      const json = JSON.parse(event.data);
      if (json?.type === "response.completed") {
        const fullText = responsesTextFromOutput(json?.response?.output);
        if (fullText && !completed.has(fullText)) {
          completed.add(fullText);
          if (!content.includes(fullText)) content += fullText;
        }
      } else {
        content += responsesDeltaFromJson(json);
      }
      usage = json?.usage || json?.response?.usage || usage;
    } catch {
      // Ignore provider keepalive / non-JSON stream frames.
    }
  }
  if (!content.trim()) throw new Error("director text QA responses stream returned no content.");
  return { content, usage, transport: "responses_stream", endpoint: "/v1/responses" };
}

async function fetchProviderQa({ provider, prompt }) {
  if (provider.mode === "responses") {
    return await fetchResponsesJson({
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      model: provider.model,
      prompt,
    });
  }
  return await fetchChatJson({
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    model: provider.model,
    prompt,
  });
}

export async function runDirectorTextQaForRuntime({
  input,
  getProviderApiKey,
  getProviderConfigStatuses,
  mockProviderResult = false,
}) {
  if (mockProviderResult) {
    return normalizeDirectorTextQaReport({
      status: "pass",
      summary: "测试模式：LLM 文本 QA 已用 mock 通过。",
      findings: [],
      rewriteHints: [],
    }, {
      providerCalled: false,
      runtimeExternalNetworkCallMade: false,
      providerId: "mock-director-text-qa",
      model: "mock",
      transport: "mock",
    });
  }

  const provider = pickTextQaProvider({ getProviderApiKey, getProviderConfigStatuses });
  if (!provider) {
    return skippedDirectorTextQaReport("没有可用的文本 QA 模型配置，本次仅执行规则 QA。");
  }

  const prompt = buildDirectorTextQaPrompt(input);
  try {
    const result = await fetchProviderQa({ provider, prompt });
    return recoverDirectorTextQaReportFromText(result.content, {
      providerCalled: true,
      runtimeExternalNetworkCallMade: true,
      providerId: provider.providerId,
      model: provider.model,
      transport: result.transport,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const report = skippedDirectorTextQaReport(`文本 QA 调用失败，已记录但不阻断本次提交：${message.slice(0, 500)}`);
    return {
      ...report,
      providerCalled: true,
      runtimeExternalNetworkCallMade: true,
      providerId: provider.providerId,
      model: provider.model,
      transport: provider.mode,
    };
  }
}
