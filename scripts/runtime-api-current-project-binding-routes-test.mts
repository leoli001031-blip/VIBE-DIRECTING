import { createRuntimeApiCurrentProjectBindingRoutes } from "./runtime-api-current-project-binding-routes.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const endpoints = {
  currentProjectBindingEndpoint: "/api/runtime/projects/current",
  currentProjectRecentEndpoint: "/api/runtime/projects/recent",
  currentProjectSelectEndpoint: "/api/runtime/projects/select",
};

function createFixture(overrides = {}) {
  const calls = {
    reads: [],
    writes: [],
    builders: [],
    policies: [],
  };
  const api = createRuntimeApiCurrentProjectBindingRoutes({
    ...endpoints,
    readRequestJsonBody: async (req) => {
      calls.reads.push(req);
      if (Object.hasOwn(overrides, "bodyResult")) return overrides.bodyResult;
      return { ok: true, body: overrides.body ?? { projectRoot: "project" } };
    },
    writeJson: (res, status, payload) => {
      calls.writes.push({ status, payload });
      res.writes.push({ status, payload });
    },
    runtimePolicy: (extra) => {
      calls.policies.push(extra);
      return { policy: "runtime" };
    },
    currentProjectBindingStatusResponse: (extra) => {
      calls.builders.push({ name: "status", extra });
      return { ok: true, route: "status", extra };
    },
    currentProjectRecentResponse: (extra) => {
      calls.builders.push({ name: "recent", extra });
      return { ok: true, route: "recent", extra };
    },
    selectCurrentProjectBindingResponse: (body) => {
      calls.builders.push({ name: "select", body });
      return {
        statusCode: overrides.selectStatusCode ?? 200,
        payload: { ok: true, route: "select", body },
      };
    },
    clearCurrentProjectBindingResponse: (extra) => {
      calls.builders.push({ name: "clear", extra });
      return {
        statusCode: overrides.clearStatusCode ?? 200,
        payload: { ok: true, route: "clear", extra },
      };
    },
    running: () => overrides.runningValue,
  });
  return { api, calls };
}

async function hit(method, pathname, fixture) {
  const res = { writes: [] };
  const handled = await fixture.api.handleCurrentProjectBindingRoute({ method }, res, new URL(`http://localhost${pathname}`));
  return { handled, res };
}

{
  let runningNow = false;
  const fixture = createFixture({
    get runningValue() {
      return runningNow;
    },
  });

  let result = await hit("GET", endpoints.currentProjectBindingEndpoint, fixture);
  assert(result.handled === true, "GET current should be handled");
  assert(fixture.calls.writes[0].status === 200, "GET current should return 200");
  assert(fixture.calls.builders[0].name === "status", "GET current should use status builder");
  assert(fixture.calls.builders[0].extra.running === false, "GET current should read initial running()");

  runningNow = true;
  result = await hit("GET", endpoints.currentProjectBindingEndpoint, fixture);
  assert(fixture.calls.builders[1].extra.running === true, "GET current should read live running()");
}

{
  const fixture = createFixture({ runningValue: true });
  const result = await hit("GET", endpoints.currentProjectRecentEndpoint, fixture);
  assert(result.handled === true, "GET recent should be handled");
  assert(fixture.calls.writes[0].status === 200, "GET recent should return 200");
  assert(fixture.calls.builders[0].name === "recent", "GET recent should use recent builder");
  assert(fixture.calls.builders[0].extra.running === true, "GET recent should include running()");
}

{
  const fixture = createFixture({ runningValue: true });
  const result = await hit("DELETE", endpoints.currentProjectBindingEndpoint, fixture);
  assert(result.handled === true, "DELETE current should be handled");
  assert(fixture.calls.builders[0].name === "clear", "DELETE current should use clear builder");
  assert(fixture.calls.builders[0].extra.running === true, "DELETE current should include running()");
  assert(fixture.calls.writes[0].status === 200, "DELETE current should write returned status");
  assert(fixture.calls.writes[0].payload.route === "clear", "DELETE current should write clear payload");
}

{
  const fixture = createFixture({ runningValue: false, clearStatusCode: 202 });
  const result = await hit("POST", `${endpoints.currentProjectBindingEndpoint}/clear`, fixture);
  assert(result.handled === true, "POST current clear should be handled");
  assert(fixture.calls.builders[0].name === "clear", "POST current clear should use clear builder");
  assert(fixture.calls.builders[0].extra.running === false, "POST current clear should include running()");
  assert(fixture.calls.writes[0].status === 202, "POST current clear should use returned status");
}

{
  const body = { projectRoot: "project-004" };
  const fixture = createFixture({ body, selectStatusCode: 201 });
  const result = await hit("POST", endpoints.currentProjectSelectEndpoint, fixture);
  assert(result.handled === true, "POST select should be handled");
  assert(fixture.calls.reads.length === 1, "POST select should read JSON once");
  assert(fixture.calls.builders[0].name === "select", "POST select should use select builder");
  assert(fixture.calls.builders[0].body === body, "POST select should pass parsed body");
  assert(fixture.calls.writes[0].status === 201, "POST select should use returned statusCode");
  assert(fixture.calls.writes[0].payload.body === body, "POST select should write returned payload");
}

{
  const fixture = createFixture({ bodyResult: { ok: false, message: "Request body must be valid JSON." } });
  const result = await hit("POST", endpoints.currentProjectSelectEndpoint, fixture);
  assert(result.handled === true, "bad JSON select should be handled");
  assert(fixture.calls.policies.length === 1, "bad JSON select should include runtime policy");
  assert(fixture.calls.builders.length === 0, "bad JSON select should not call select builder");
  assert(fixture.calls.writes[0].status === 400, "bad JSON select should return 400");
  assert(fixture.calls.writes[0].payload.ok === false, "bad JSON select payload should be not ok");
  assert(fixture.calls.writes[0].payload.endpoint === endpoints.currentProjectSelectEndpoint, "bad JSON endpoint mismatch");
  assert(fixture.calls.writes[0].payload.status === "bad_request", "bad JSON status mismatch");
  assert(fixture.calls.writes[0].payload.message === "Request body must be valid JSON.", "bad JSON message mismatch");
}

{
  const fixture = createFixture();
  const result = await hit("GET", "/api/runtime/projects/current/real-chain/status", fixture);
  assert(result.handled === false, "non-binding route should return false");
  assert(fixture.calls.reads.length === 0, "non-match should not read JSON");
  assert(fixture.calls.writes.length === 0, "non-match should not write");
  assert(fixture.calls.builders.length === 0, "non-match should not build response");
}

console.log("runtime-api-current-project-binding-routes-test: ok");
