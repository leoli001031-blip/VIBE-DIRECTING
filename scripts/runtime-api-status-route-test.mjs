import { createRuntimeApiStatusRoute } from "./runtime-api-status-route.mjs";

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

console.log("runtime-api-status-route-test: ok");
