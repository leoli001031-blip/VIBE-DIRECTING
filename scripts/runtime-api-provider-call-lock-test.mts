import { getProviderApiKey } from "./runtime-api-credentials.mts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const previous = {
  disable: process.env.VIBE_DIRECTOR_DISABLE_PROVIDER_CALLS,
  deepseek: process.env.VIBE_DEEPSEEK_API_KEY,
  image: process.env.VIBE_APIKEY_FUN_API_KEY,
};

try {
  process.env.VIBE_DEEPSEEK_API_KEY = "p12c-fake-deepseek-key";
  process.env.VIBE_APIKEY_FUN_API_KEY = "p12c-fake-image-key";
  delete process.env.VIBE_DIRECTOR_DISABLE_PROVIDER_CALLS;

  assert(getProviderApiKey("deepseek-v4-pro") === "p12c-fake-deepseek-key", "unlocked DeepSeek test credential should remain available");
  assert(getProviderApiKey("apikey-fun-gpt55-responses-image") === "p12c-fake-image-key", "unlocked image test credential should remain available");

  process.env.VIBE_DIRECTOR_DISABLE_PROVIDER_CALLS = "1";
  assert(getProviderApiKey("deepseek-v4-pro") === undefined, "provider-call lock must hide DeepSeek credentials");
  assert(getProviderApiKey("apikey-fun-gpt55-responses-image") === undefined, "provider-call lock must hide image credentials");
  assert(getProviderApiKey("seedance") === undefined, "provider-call lock must fail closed for other providers");
} finally {
  for (const [name, value] of [
    ["VIBE_DIRECTOR_DISABLE_PROVIDER_CALLS", previous.disable],
    ["VIBE_DEEPSEEK_API_KEY", previous.deepseek],
    ["VIBE_APIKEY_FUN_API_KEY", previous.image],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

console.log("runtime-api-provider-call-lock-test: ok");
