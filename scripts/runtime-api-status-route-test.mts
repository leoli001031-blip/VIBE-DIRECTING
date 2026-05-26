import { createRuntimeApiCredentialsRoute } from "./runtime-routes/credentials.mts";
import { createRuntimeApiStatusRoute } from "./runtime-routes/status.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const statusEndpoint = "/api/runtime/status";
const endpoints = {
  currentProjectStatusEndpoint: "/api/runtime/projects/current/real-chain/status",
  currentProjectBindingEndpoint: "/api/runtime/projects/current",
  realDemo005StatusEndpoint: "/api/runtime/real-demo-e2e/005/status",
  runtimeFileEndpoint: "/api/runtime/files",
};

function createFixture(overrides = {}) {
  const calls = {
    writes: [],
    policies: [],
  };
  const api = createRuntimeApiStatusRoute({
    statusEndpoint,
    endpoints,
    writeJson: (res, status, payload) => {
      calls.writes.push({ status, payload });
      res.writes.push({ status, payload });
    },
    runtimePolicy: (extra) => {
      calls.policies.push(extra);
      return {
        schemaVersion: "vibe_core_local_runtime_api_v1",
        providerCalled: false,
        prepareRan: false,
        ...extra,
      };
    },
    running: () => overrides.runningRef?.value ?? overrides.running ?? false,
  });
  return { api, calls };
}

function hit(method, pathname, fixture) {
  const req = { method };
  const res = { writes: [] };
  const handled = fixture.api.handleRuntimeApiStatusRoute(req, res, new URL(`http://localhost${pathname}`));
  return { handled, res };
}

async function hitCredentials(method, pathname, fixture, rawBody) {
  const req = { method, rawBody };
  const res = { writes: [] };
  const handled = await fixture.api.handleRuntimeApiCredentialsRoute(req, res, new URL(`http://localhost${pathname}`));
  return { handled, res };
}

{
  const fixture = createFixture({ running: true });
  const result = hit("GET", statusEndpoint, fixture);
  assert(result.handled === true, "GET status should be handled");
  assert(fixture.calls.writes.length === 1, "GET status should write once");
  assert(fixture.calls.writes[0].status === 200, "GET status code mismatch");
  const payload = fixture.calls.writes[0].payload;
  assert(payload.ok === true, "GET status ok mismatch");
  assert(payload.schemaVersion === "vibe_core_local_runtime_api_v1", "GET status should include runtime policy");
  assert(payload.running === true, "GET status should include running state");
  assert(payload.endpoints === endpoints, "GET status should preserve endpoints object");
  assert(fixture.calls.policies.length === 1, "GET status should assemble policy once");
  assert(fixture.calls.policies[0].endpoints === endpoints, "GET status should pass endpoints to runtime policy");
}

{
  const fixture = createFixture();
  const result = hit("POST", statusEndpoint, fixture);
  assert(result.handled === false, "wrong method should return false");
  assert(fixture.calls.writes.length === 0, "wrong method should not write");
  assert(fixture.calls.policies.length === 0, "wrong method should not assemble policy");
}

{
  const fixture = createFixture();
  const result = hit("GET", "/api/runtime/projects/current", fixture);
  assert(result.handled === false, "non-match should return false");
  assert(fixture.calls.writes.length === 0, "non-match should not write");
  assert(fixture.calls.policies.length === 0, "non-match should not assemble policy");
}

{
  const runningRef = { value: false };
  const fixture = createFixture({ runningRef });
  const first = hit("GET", statusEndpoint, fixture);
  runningRef.value = true;
  const second = hit("GET", statusEndpoint, fixture);
  assert(first.res.writes[0].payload.running === false, "first status should read initial running state");
  assert(second.res.writes[0].payload.running === true, "second status should read updated running state");
}

{
  const rawApiKey = "sk-test-secret-1234";
  const calls = {
    writes: [],
    removedProviderIds: [],
    storedCredentials: [],
  };
  const fixture = {
    api: createRuntimeApiCredentialsRoute({
      credentialsEndpoint: "/api/runtime/credentials",
      getAllCredentials: () => ({
        "lanyi-image2": {
          providerId: "lanyi-image2",
          label: "Lanyi",
          updatedAt: "2026-05-18T00:00:00.000Z",
          maskedKey: "****1234",
          hasKey: true,
        },
      }),
      getMaskedKey: (apiKey) => `masked:${apiKey.slice(-4)}`,
      getProviderConfigStatuses: () => [
        {
          providerId: "lanyi-image2",
          credential: {
            keyStatus: "configured",
            secretDisplayed: false,
          },
        },
      ],
      readRequestJsonBody: async (req) => ({ ok: true, body: JSON.parse(req.rawBody || "{}") }),
      removeProviderCredential: (providerId) => calls.removedProviderIds.push(providerId),
      runtimePolicy: () => ({
        schemaVersion: "vibe_core_local_runtime_api_v1",
        providerCalled: false,
        prepareRan: false,
      }),
      setProviderCredential: (providerId, apiKey, label) => {
        calls.storedCredentials.push({ providerId, apiKey, label });
        return { providerId, apiKey, label };
      },
      writeJson: (res, status, payload) => {
        calls.writes.push({ status, payload });
        res.writes.push({ status, payload });
      },
    }),
  };

  const read = await hitCredentials("GET", "/api/runtime/credentials", fixture);
  assert(read.handled === true, "GET credentials should be handled");
  assert(read.res.writes[0].status === 200, "GET credentials status mismatch");
  assert(read.res.writes[0].payload.credentials["lanyi-image2"].maskedKey === "****1234", "GET credentials should keep masked key");
  assert(read.res.writes[0].payload.providerConfigs[0].credential.secretDisplayed === false, "GET credentials must not display secrets");
  assert(!JSON.stringify(read.res.writes[0].payload).includes(rawApiKey), "GET credentials must not expose raw api key");
  assert(read.res.writes[0].payload.providerCalled === false, "GET credentials must not call provider");
  assert(read.res.writes[0].payload.prepareRan === false, "GET credentials must not run prepare");

  const write = await hitCredentials("POST", "/api/runtime/credentials", fixture, JSON.stringify({
    providerId: "lanyi-image2",
    apiKey: rawApiKey,
    label: "Lanyi local",
  }));
  assert(write.handled === true, "POST credentials should be handled");
  assert(write.res.writes[0].status === 200, "POST credentials status mismatch");
  assert(write.res.writes[0].payload.credential.maskedKey === "masked:1234", "POST credentials should return masked key");
  assert(write.res.writes[0].payload.credential.apiKey === undefined, "POST credentials must not expose apiKey field");
  assert(!JSON.stringify(write.res.writes[0].payload).includes(rawApiKey), "POST credentials must not expose raw api key");
  assert(calls.storedCredentials[0].apiKey === rawApiKey, "POST credentials should pass raw key only to storage dependency");

  const invalidWrite = await hitCredentials("POST", "/api/runtime/credentials", fixture, JSON.stringify({ providerId: "lanyi-image2" }));
  assert(invalidWrite.handled === true, "invalid POST credentials should be handled");
  assert(invalidWrite.res.writes[0].status === 400, "invalid POST credentials status mismatch");

  const unknownProviderWrite = await hitCredentials("POST", "/api/runtime/credentials", fixture, JSON.stringify({
    providerId: "unknown-provider",
    apiKey: rawApiKey,
  }));
  assert(unknownProviderWrite.handled === true, "unknown provider POST credentials should be handled");
  assert(unknownProviderWrite.res.writes[0].status === 400, "unknown provider POST credentials should fail closed");
  assert(calls.storedCredentials.length === 1, "unknown provider POST must not reach credential storage");

  const remove = await hitCredentials("DELETE", "/api/runtime/credentials?providerId=lanyi-image2", fixture);
  assert(remove.handled === true, "DELETE credentials should be handled");
  assert(remove.res.writes[0].status === 200, "DELETE credentials status mismatch");
  assert(calls.removedProviderIds.join(",") === "lanyi-image2", "DELETE credentials should remove selected provider");

  const unknownRemove = await hitCredentials("DELETE", "/api/runtime/credentials?providerId=unknown-provider", fixture);
  assert(unknownRemove.handled === true, "unknown provider DELETE credentials should be handled");
  assert(unknownRemove.res.writes[0].status === 400, "unknown provider DELETE credentials should fail closed");
  assert(calls.removedProviderIds.join(",") === "lanyi-image2", "unknown provider DELETE must not mutate credential storage");

  const removeMissing = await hitCredentials("DELETE", "/api/runtime/credentials", fixture);
  assert(removeMissing.handled === true, "DELETE credentials without provider should be handled");
  assert(removeMissing.res.writes[0].status === 400, "DELETE credentials without provider status mismatch");

  const wrongPath = await hitCredentials("GET", "/api/runtime/status", fixture);
  assert(wrongPath.handled === false, "credentials route should ignore other paths");
}

console.log("runtime-api-status-route-test: ok");
