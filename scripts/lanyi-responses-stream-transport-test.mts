import {
  fetchLanyiImageViaResponsesStream,
  findImageBase64InResponsesStream,
  parseLanyiResponsesStreamSse,
} from "./lanyi-responses-stream-transport.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pngBase64 = Buffer.alloc(1200, 7).toString("base64");
const sse = [
  "event: response.created",
  "data: {\"id\":\"resp_test_stream\"}",
  "",
  "event: keepalive",
  "data: {}",
  "",
  "event: response.image_generation_call.partial_image",
  `data: {"partial_image_b64":"${pngBase64}"}`,
  "",
  "event: response.completed",
  "data: {\"response\":{\"id\":\"resp_test_stream\"}}",
  "",
].join("\n");

const parsed = parseLanyiResponsesStreamSse(sse);
assert(parsed.length === 4, "SSE parser should return four events");
assert(findImageBase64InResponsesStream(parsed.map((item) => item.json)) === pngBase64, "recursive base64 parser should find partial_image_b64");

const calls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  calls.push({
    url: String(url),
    headers: init?.headers,
    body: JSON.parse(String(init?.body || "{}")),
  });
  return new Response(sse, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
};

try {
  const textResult = await fetchLanyiImageViaResponsesStream({
    apiKey: "sk-test-never-leak",
    baseUrl: "https://lanyiapi.com/v1",
    model: "gpt-image-2",
    prompt: "clean image",
    size: "1280x720",
    timeoutMs: 30_000,
  });
  assert(textResult.ok === true, "text-only stream should parse image");
  assert(textResult.bytes.length > 0, "text-only stream should return bytes");
  assert(textResult.providerRequestId === "resp_test_stream", "response id should become providerRequestId");
  assert(textResult.providerResponseMetadata.transport === "responses_stream", "metadata should mark responses stream transport");
  assert(textResult.providerResponseMetadata.providerEndpoint === "/v1/responses", "metadata should mark responses endpoint");
  assert(textResult.providerResponseMetadata.eventCounts.keepalive === 1, "metadata should count keepalive events");
  assert(textResult.rawSseBytes.length > 0, "transport should return raw SSE bytes for evidence persistence");

  const referenceResult = await fetchLanyiImageViaResponsesStream({
    apiKey: "sk-test-never-leak",
    baseUrl: "https://lanyiapi.com",
    model: "gpt-image-2",
    prompt: "clean reference continuation",
    size: "1280x720",
    referenceImages: [{ name: "reference.png", bytes: Buffer.from("reference-image") }],
    timeoutMs: 30_000,
    providerOperation: "responses.image_generation_reference",
  });
  assert(referenceResult.ok === true, "reference stream should parse image");
  assert(referenceResult.providerResponseMetadata.referenceInputCount === 1, "metadata should count reference inputs");
  assert(referenceResult.providerResponseMetadata.providerOperation === "responses.image_generation_reference", "metadata should mark reference generation operation");

  assert(calls.length === 2, "fake fetch should receive two calls");
  assert(calls.every((call) => call.url === "https://lanyiapi.com/v1/responses"), "transport should call /v1/responses");
  assert(calls[0].body.stream === true && calls[0].body.tools?.[0]?.type === "image_generation", "text-only body should use image_generation tool");
  assert(calls[0].body.input === "clean image", "text-only body should use compact string input");
  const referenceContent = calls[1].body.input?.[0]?.content || [];
  assert(referenceContent.some((item) => item.type === "input_image" && item.image_url.startsWith("data:image/png;base64,")), "reference body should include input_image data URL");
  assert(JSON.stringify(textResult).includes("sk-test-never-leak") === false, "transport result must not leak raw API key");
  console.log("lanyi-responses-stream-transport-test: ok");
} finally {
  globalThis.fetch = originalFetch;
}
