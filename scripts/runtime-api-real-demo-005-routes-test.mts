import { createRuntimeApiRealDemo005Routes } from "./runtime-api-real-demo-005-routes.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const endpoints = {
  realDemo005StatusEndpoint: "/api/runtime/real-demo-e2e/005/status",
  realDemo005RunEndpoint: "/api/runtime/real-demo-e2e/005/run",
  legacyStatusEndpoint: "/api/real-demo-e2e/005/status",
  legacyRunEndpoint: "/api/real-demo-e2e/005/run",
};

function createFixture(overrides = {}) {
  const calls = {
    writes: [],
    statuses: [],
    runs: [],
    policies: 0,
  };
  const api = createRuntimeApiRealDemo005Routes({
    endpoints,
    writeJson: (res, status, payload) => {
      calls.writes.push({ status, payload });
      res.writes.push({ status, payload });
    },
    responseFromReport: (extra) => {
      calls.statuses.push(extra);
      return {
        ok: true,
        endpoint: endpoints.realDemo005StatusEndpoint,
        status: "needs_review",
        extra,
      };
    },
    handleRun: (res, options) => {
      calls.runs.push({ res, options });
      return Promise.resolve();
    },
    runtimePolicy: () => {
      calls.policies += 1;
      return {
        schemaVersion: "vibe_core_local_runtime_api_v1",
        providerCalled: false,
        prepareRan: false,
      };
    },
    readLegacyRunEnabled: () => overrides.enabledRef?.value ?? overrides.legacyRunEnabled ?? false,
    running: () => overrides.runningRef?.value ?? overrides.running ?? false,
  });
  return { api, calls };
}

async function hit(method, pathname, fixture) {
  const req = { method };
  const res = { writes: [] };
  const handled = await fixture.api.handleRuntimeApiRealDemo005Route(req, res, new URL(`http://localhost${pathname}`));
  return { handled, res };
}

for (const pathname of [
  endpoints.realDemo005StatusEndpoint,
  endpoints.legacyStatusEndpoint,
]) {
  const fixture = createFixture({ running: true });
  const result = await hit("GET", pathname, fixture);
  assert(result.handled === true, `${pathname} status should be handled`);
  assert(fixture.calls.statuses.length === 1, `${pathname} status should read report once`);
  assert(fixture.calls.statuses[0].running === true, `${pathname} status should include running state`);
  assert(fixture.calls.writes.length === 1, `${pathname} status should write once`);
  assert(fixture.calls.writes[0].status === 200, `${pathname} status code mismatch`);
  assert(fixture.calls.writes[0].payload.endpoint === endpoints.realDemo005StatusEndpoint, `${pathname} should preserve report endpoint`);
  assert(fixture.calls.runs.length === 0, `${pathname} status must not delegate run`);
}

for (const pathname of [
  endpoints.realDemo005RunEndpoint,
  endpoints.legacyRunEndpoint,
]) {
  const fixture = createFixture();
  const result = await hit("POST", pathname, fixture);
  assert(result.handled === true, `${pathname} disabled run should be handled`);
  assert(fixture.calls.runs.length === 0, `${pathname} disabled run must not delegate`);
  assert(fixture.calls.writes.length === 1, `${pathname} disabled run should write once`);
  assert(fixture.calls.writes[0].status === 403, `${pathname} disabled run status code mismatch`);
  const payload = fixture.calls.writes[0].payload;
  assert(payload.ok === false, `${pathname} disabled run ok mismatch`);
  assert(payload.endpoint === pathname, `${pathname} disabled run endpoint mismatch`);
  assert(payload.status === "disabled", `${pathname} disabled run status mismatch`);
  assert(payload.previewStatus === "blocked", `${pathname} disabled preview status mismatch`);
  assert(payload.productionStatus === "blocked", `${pathname} disabled production status mismatch`);
  assert(payload.running === false, `${pathname} disabled running mismatch`);
  assert(payload.providerCalled === false, `${pathname} disabled run must not mark providerCalled`);
  assert(payload.prepareRan === false, `${pathname} disabled run must not mark prepareRan`);
  assert(payload.command?.providerCalled === false, `${pathname} disabled command must not mark providerCalled`);
  assert(payload.command?.prepareRan === false, `${pathname} disabled command must not mark prepareRan`);
  assert(payload.command?.verifyScriptRan === false, `${pathname} disabled command must not mark verifyScriptRan`);
}

for (const pathname of [
  endpoints.realDemo005RunEndpoint,
  endpoints.legacyRunEndpoint,
]) {
  const fixture = createFixture({ legacyRunEnabled: true });
  const result = await hit("POST", pathname, fixture);
  assert(result.handled === true, `${pathname} enabled run should be handled`);
  assert(fixture.calls.runs.length === 1, `${pathname} enabled run should delegate once`);
  assert(fixture.calls.runs[0].options.endpoint === pathname, `${pathname} enabled run endpoint mismatch`);
  assert(fixture.calls.writes.length === 0, `${pathname} enabled route glue should leave response to handleRun`);
}

{
  const fixture = createFixture();
  const result = await hit("GET", "/api/runtime/projects/current/real-chain/status", fixture);
  assert(result.handled === false, "non-real-demo route should return false");
  assert(fixture.calls.statuses.length === 0, "non-match should not read report");
  assert(fixture.calls.runs.length === 0, "non-match should not delegate run");
  assert(fixture.calls.writes.length === 0, "non-match should not write");
}

for (const [method, pathname] of [
  ["POST", endpoints.realDemo005StatusEndpoint],
  ["GET", endpoints.realDemo005RunEndpoint],
  ["POST", endpoints.legacyStatusEndpoint],
  ["GET", endpoints.legacyRunEndpoint],
]) {
  const fixture = createFixture({ legacyRunEnabled: true });
  const result = await hit(method, pathname, fixture);
  assert(result.handled === false, `${method} ${pathname} should not match wrong method`);
  assert(fixture.calls.statuses.length === 0, `${method} ${pathname} should not read report`);
  assert(fixture.calls.runs.length === 0, `${method} ${pathname} should not delegate run`);
  assert(fixture.calls.writes.length === 0, `${method} ${pathname} should not write`);
}

{
  const runningRef = { value: false };
  const fixture = createFixture({ runningRef });
  const first = await hit("GET", endpoints.realDemo005StatusEndpoint, fixture);
  runningRef.value = true;
  const second = await hit("GET", endpoints.realDemo005StatusEndpoint, fixture);
  assert(first.res.writes[0].payload.extra.running === false, "first status should read initial running state");
  assert(second.res.writes[0].payload.extra.running === true, "second status should read updated running state");
}

console.log("runtime-api-real-demo-005-routes-test: ok");
