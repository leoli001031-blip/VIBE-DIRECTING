import { createRuntimeApiCurrentProjectP6RealImage2Routes } from "./runtime-api-current-project-p6-real-image2-routes.mts";
import { image2ProviderTimeoutMs } from "./runtime-api-current-project-p6-real-image2-submit.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const submitEndpoint = "/api/runtime/projects/current/p6-real-image2/submit";
const serialEndpoint = "/api/runtime/projects/current/p6-real-image2/submit-serial";

{
  assert(image2ProviderTimeoutMs({}) === 8 * 60 * 1000, "Image2 provider timeout should default to 8 minutes");
  assert(image2ProviderTimeoutMs({ VIBE_IMAGE2_PROVIDER_TIMEOUT_MS: "600000" }) === 600000, "Image2 provider timeout should accept primary env override");
  assert(image2ProviderTimeoutMs({ VIBE_IMAGE2_PROVIDER_TIMEOUT_MS: "1000", VIBE_P6_IMAGE2_TIMEOUT_MS: "420000" }) === 420000, "Image2 provider timeout should skip too-small overrides and use fallback env");
  assert(image2ProviderTimeoutMs({ VIBE_IMAGE2_PROVIDER_TIMEOUT_MS: "3600000" }) === 30 * 60 * 1000, "Image2 provider timeout should cap runaway overrides");
}

function createFixture(overrides = {}) {
  const calls = {
    contexts: [],
    writes: [],
  };
  const api = createRuntimeApiCurrentProjectP6RealImage2Routes({
    currentProjectP6RealImage2SubmitEndpoint: submitEndpoint,
    currentProjectP6RealImage2SubmitSerialEndpoint: overrides.serialEndpoint || serialEndpoint,
    currentProjectRouteContext: async (req, res, url, endpoint) => {
      calls.contexts.push({ method: req.method, path: url.pathname, endpoint });
      return overrides.routeContext;
    },
    writeJson: (res, status, payload) => {
      calls.writes.push({ status, payload });
      res.writes.push({ status, payload });
    },
    requestOverrideDiagnostics: () => {
      throw new Error("routeContext-less route tests should not build diagnostics");
    },
    currentProjectImage2OneShotResponse: () => {
      throw new Error("routeContext-less route tests should not build submit responses");
    },
    currentProjectImage2OneShotReturnIngestResponse: () => {
      throw new Error("routeContext-less route tests should not build return ingest responses");
    },
    getProviderApiKey: () => "",
    getProviderConfigStatuses: () => [],
    runtimePolicy: () => ({}),
    runtimeFileUrl: (value) => value,
    sha256Bytes: () => "",
    writeOneShotExecutorBytes: () => "",
    writeOneShotExecutorJson: () => {},
    running: () => false,
  });
  return { api, calls };
}

async function hit(method, pathname, fixture) {
  const req = { method };
  const res = { writes: [] };
  const handled = await fixture.api.handleCurrentProjectP6RealImage2Routes(req, res, new URL(`http://localhost${pathname}`));
  return { handled, res };
}

{
  const fixture = createFixture();
  const result = await hit("POST", submitEndpoint, fixture);
  assert(result.handled === true, "submit path should be handled by P6 aggregate route");
  assert(fixture.calls.contexts.length === 1, "submit path should read route context once");
  assert(fixture.calls.contexts[0].endpoint === submitEndpoint, "submit path should pass submit endpoint");
  assert(fixture.calls.writes.length === 0, "missing routeContext should not write");
}

{
  const fixture = createFixture();
  const result = await hit("POST", serialEndpoint, fixture);
  assert(result.handled === true, "serial path should be handled by P6 aggregate route");
  assert(fixture.calls.contexts.length === 1, "serial path should read route context once");
  assert(fixture.calls.contexts[0].endpoint === serialEndpoint, "serial path should pass injected serial endpoint");
  assert(fixture.calls.writes.length === 0, "missing routeContext should not write");
}

{
  const customSerialEndpoint = "/custom/runtime/p6-submit-serial";
  const fixture = createFixture({ serialEndpoint: customSerialEndpoint });
  const result = await hit("POST", customSerialEndpoint, fixture);
  assert(result.handled === true, "custom serial endpoint should be handled when injected");
  assert(fixture.calls.contexts[0].endpoint === customSerialEndpoint, "custom serial endpoint should flow into route context");
}

{
  const customSerialEndpoint = "/custom/runtime/p6-submit-serial";
  const fixture = createFixture({ serialEndpoint: customSerialEndpoint });
  const result = await hit("POST", `${submitEndpoint}-serial`, fixture);
  assert(result.handled === false, "aggregator should not fall back to derived serial endpoint when serial endpoint is injected");
  assert(fixture.calls.contexts.length === 0, "non-matching derived serial path should not read route context");
}

for (const [method, pathname] of [
  ["GET", submitEndpoint],
  ["GET", serialEndpoint],
  ["POST", "/api/runtime/projects/current/image2-one-shot/return"],
]) {
  const fixture = createFixture();
  const result = await hit(method, pathname, fixture);
  assert(result.handled === false, `${method} ${pathname} should remain outside P6 aggregate route`);
  assert(fixture.calls.contexts.length === 0, `${method} ${pathname} should not read route context`);
  assert(fixture.calls.writes.length === 0, `${method} ${pathname} should not write`);
}

console.log("runtime-api-current-project-p6-real-image2-routes-test: ok");
