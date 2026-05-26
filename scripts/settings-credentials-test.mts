import {
  credentialsEndpoint,
  deleteCredential,
  loadCredentials,
  loadProviderConfigStatuses,
  saveCredential,
} from "../src/core/providerCredentialsClient.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function okJson(payload) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  };
}

const requests = [];
globalThis.fetch = async (url, init) => {
  const urlText = String(url);
  const method = init?.method || "GET";
  requests.push({ url: urlText, method, body: init?.body ? String(init.body) : "" });

  if (urlText === credentialsEndpoint && method === "GET") {
    return okJson({
      ok: true,
      dryRunOnly: true,
      providerCalled: false,
      credentials: {
        "lanyi-image2": {
          providerId: "lanyi-image2",
          label: "Lanyi Image2",
          updatedAt: "2026-05-16T00:00:00.000Z",
          maskedKey: "****1234",
          hasKey: true,
        },
      },
      providerConfigs: [
        {
          providerId: "lanyi-image2",
          label: "Lanyi Image2",
          baseUrl: "https://lanyiapi.com",
          imageModel: "gpt-image-2",
          chatModel: "deepseek-v4-pro",
          source: "environment",
          credential: {
            envKey: "VIBE_IMAGE2_API_KEY",
            keyStatus: "configured",
            source: "environment",
            secretDisplayed: false,
          },
        },
      ],
    });
  }

  if (urlText === credentialsEndpoint && method === "POST") {
    return okJson({
      ok: true,
      credential: {
        providerId: "lanyi-image2",
        label: "Lanyi Image2",
        updatedAt: "2026-05-16T00:00:00.000Z",
        maskedKey: "****1234",
        hasKey: true,
      },
    });
  }

  if (urlText === `${credentialsEndpoint}?providerId=lanyi-image2` && method === "DELETE") {
    return okJson({ ok: true, dryRunOnly: true, providerCalled: false });
  }

  return { ok: false, status: 404, json: async () => ({ ok: false }) };
};

const credentials = await loadCredentials();
assert(Object.keys(credentials).join(",") === "lanyi-image2", "loadCredentials must read the credentials map from the runtime payload");
assert(credentials["lanyi-image2"].maskedKey === "****1234", "loadCredentials should preserve the masked key");
assert(credentials.ok === undefined, "loadCredentials must not treat ok as a provider credential");
assert(credentials.dryRunOnly === undefined, "loadCredentials must not treat runtime policy fields as credentials");
assert(credentials.providerCalled === undefined, "loadCredentials must not treat safety fields as credentials");

const providerConfigs = await loadProviderConfigStatuses();
assert(providerConfigs.length === 1, "loadProviderConfigStatuses must read provider config entries from the runtime payload");
assert(providerConfigs[0].providerId === "lanyi-image2", "provider config should expose the Lanyi provider id");
assert(providerConfigs[0].baseUrl === "https://lanyiapi.com", "provider config should expose the configured base URL");
assert(providerConfigs[0].imageModel === "gpt-image-2", "provider config should expose the configured image model");
assert(providerConfigs[0].chatModel === "deepseek-v4-pro", "provider config should expose the optional chat model");
assert(providerConfigs[0].credential?.keyStatus === "configured", "provider config should expose key status");
assert(providerConfigs[0].credential?.secretDisplayed === false, "provider config must mark raw secrets as hidden");
assert(JSON.stringify(providerConfigs).includes("sk-test") === false, "provider config must not expose raw key material");

const saved = await saveCredential("lanyi-image2", "sk-test-1234", "Lanyi Image2");
assert(saved?.providerId === "lanyi-image2", "saveCredential must read the credential entry from the runtime payload");
assert(saved?.maskedKey === "****1234", "saveCredential should preserve the masked key");

const deleted = await deleteCredential("lanyi-image2");
assert(deleted === true, "deleteCredential should resolve true for ok runtime response");
assert(
  requests.map((request) => `${request.method} ${request.url}`).join(" | ")
    === `GET ${credentialsEndpoint} | GET ${credentialsEndpoint} | POST ${credentialsEndpoint} | DELETE ${credentialsEndpoint}?providerId=lanyi-image2`,
  "settings credentials requests should stay on the credentials endpoint only",
);

console.log("settings-credentials-test: ok");
