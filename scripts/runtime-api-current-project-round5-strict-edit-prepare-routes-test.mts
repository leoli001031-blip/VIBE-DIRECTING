import { createRuntimeApiCurrentProjectRound5StrictEditPrepareRoutes } from "./runtime-api-current-project-round5-strict-edit-prepare-routes.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const endpoint = "/api/runtime/projects/current/round5/strict-edit/prepare";

function createFixture(overrides = {}) {
  const calls = {
    contexts: [],
    writes: [],
    inputs: [],
    responses: [],
  };
  const routeContext = Object.hasOwn(overrides, "routeContext")
    ? overrides.routeContext
    : { source: { id: "source" }, requestContext: { requestId: "request-1" }, body: { shotId: "ZP05" } };
  const api = createRuntimeApiCurrentProjectRound5StrictEditPrepareRoutes({
    currentProjectRound5StrictEditPrepareEndpoint: endpoint,
    currentProjectRouteContext: async (req, res, url, routeEndpoint) => {
      calls.contexts.push({ method: req.method, path: url.pathname, endpoint: routeEndpoint });
      return routeContext;
    },
    writeJson: (res, status, payload) => {
      calls.writes.push({ status, payload });
      res.writes.push({ status, payload });
    },
    round5StrictEditRequestInput: (url, body) => {
      const input = { shotId: url.searchParams.get("shotId") || body?.shotId, body };
      calls.inputs.push(input);
      return input;
    },
    currentProjectRound5StrictEditPrepareResponse: (input, extra, source) => {
      calls.responses.push({ input, extra, source });
      return { ok: overrides.ok ?? true, route: "prepare", extra };
    },
    running: () => overrides.runningRef?.value ?? overrides.running ?? false,
  });
  return { api, calls };
}

async function hit(method, pathname, fixture) {
  const req = { method };
  const res = { writes: [] };
  const handled = await fixture.api.handleCurrentProjectRound5StrictEditPrepareRoute(req, res, new URL(`http://localhost${pathname}`));
  return { handled, res };
}

{
  const fixture = createFixture({ running: true });
  const result = await hit("POST", `${endpoint}?shotId=ZP05`, fixture);
  assert(result.handled === true, "prepare path should be handled");
  assert(fixture.calls.contexts.length === 1, "prepare should read route context once");
  assert(fixture.calls.contexts[0].endpoint === endpoint, "prepare should pass injected endpoint to route context");
  assert(fixture.calls.inputs[0].shotId === "ZP05", "prepare should parse input from URL/body");
  assert(fixture.calls.responses[0].extra.running === true, "prepare should include running()");
  assert(fixture.calls.responses[0].extra.requestContext.requestId === "request-1", "prepare should pass requestContext");
  assert(fixture.calls.responses[0].source.id === "source", "prepare should pass source");
  assert(fixture.calls.writes[0].status === 200, "successful prepare should return 200");
}

{
  const fixture = createFixture({ ok: false });
  const result = await hit("POST", endpoint, fixture);
  assert(result.handled === true, "blocked prepare should be handled");
  assert(fixture.calls.writes[0].status === 409, "ok false prepare should return 409");
}

{
  const fixture = createFixture({ routeContext: undefined });
  const result = await hit("POST", endpoint, fixture);
  assert(result.handled === true, "missing routeContext should still consume matched route");
  assert(fixture.calls.contexts.length === 1, "missing routeContext should call route context");
  assert(fixture.calls.responses.length === 0, "missing routeContext should not build response");
  assert(fixture.calls.writes.length === 0, "missing routeContext should not write again");
}

{
  const fixture = createFixture();
  const result = await hit("GET", endpoint, fixture);
  assert(result.handled === false, "wrong method should not be handled");
  assert(fixture.calls.contexts.length === 0, "wrong method should not read route context");
  assert(fixture.calls.writes.length === 0, "wrong method should not write");
}

for (const pathname of [
  "/api/runtime/projects/current/round5/strict-edit/return",
  "/api/runtime/projects/current/image2-one-shot/return",
  "/api/runtime/projects/current/image2-one-shot/execute-return",
]) {
  const fixture = createFixture();
  const result = await hit("POST", pathname, fixture);
  assert(result.handled === false, `${pathname} should remain outside prepare adapter`);
  assert(fixture.calls.contexts.length === 0, `${pathname} should not read route context`);
  assert(fixture.calls.writes.length === 0, `${pathname} should not write`);
}

{
  const runningRef = { value: false };
  const fixture = createFixture({ runningRef });
  const first = await hit("POST", endpoint, fixture);
  runningRef.value = true;
  const second = await hit("POST", endpoint, fixture);
  assert(first.res.writes[0].payload.extra.running === false, "first hit should read initial running state");
  assert(second.res.writes[0].payload.extra.running === true, "second hit should read updated running state");
}

console.log("runtime-api-current-project-round5-strict-edit-prepare-routes-test: ok");
