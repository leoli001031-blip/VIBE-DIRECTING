import { createRuntimeApiCurrentProjectOneShotRoutes } from "./runtime-api-current-project-one-shot-routes.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const endpoints = {
  currentProjectImage2OneShotStatusEndpoint: "/api/runtime/projects/current/image2-one-shot/status",
  currentProjectImage2OneShotPrepareEndpoint: "/api/runtime/projects/current/image2-one-shot/prepare",
  currentProjectImage2OneShotConfirmEndpoint: "/api/runtime/projects/current/image2-one-shot/confirm",
  currentProjectImage2OneShotPrepareTriggerEndpoint: "/api/runtime/projects/current/image2-one-shot/prepare-trigger",
  currentProjectImage2OneShotExecuteMockEndpoint: "/api/runtime/projects/current/image2-one-shot/execute-mock",
};

function createFixture(overrides = {}) {
  const calls = {
    contexts: [],
    writes: [],
    diagnostics: [],
    oneShotInputs: [],
    executorInputs: [],
    responses: [],
  };
  const routeContext = Object.hasOwn(overrides, "routeContext")
    ? overrides.routeContext
    : { source: { id: "source" }, requestContext: { projectRoot: "project" }, body: { bodyShot: "S01" } };
  const api = createRuntimeApiCurrentProjectOneShotRoutes({
    ...endpoints,
    currentProjectRouteContext: async (req, res, url, endpoint) => {
      calls.contexts.push({ method: req.method, path: url.pathname, endpoint });
      return routeContext;
    },
    writeJson: (res, status, payload) => {
      calls.writes.push({ status, payload });
      res.writes.push({ status, payload });
    },
    requestOverrideDiagnostics: (requestContext) => {
      calls.diagnostics.push(requestContext);
      return { ignored: requestContext };
    },
    oneShotRequestInput: (url, body) => {
      const input = { kind: "oneShotInput", selectedShotId: url.searchParams.get("selectedShotId"), body };
      calls.oneShotInputs.push(input);
      return input;
    },
    currentProjectImage2OneShotResponse: (action, input, extra, source) => {
      calls.responses.push({ name: "oneShot", action, input, extra, source });
      return { ok: overrides[`${action}Ok`] ?? true, route: action, extra };
    },
    currentProjectImage2OneShotPrepareTriggerResponse: (input, extra, source) => {
      calls.responses.push({ name: "prepareTrigger", input, extra, source });
      return { ok: overrides.prepareTriggerOk ?? true, route: "prepareTrigger", extra };
    },
    oneShotExecutorRequestInput: (url, body) => {
      const input = { kind: "executorInput", selectedShotId: url.searchParams.get("selectedShotId"), body };
      calls.executorInputs.push(input);
      return input;
    },
    currentProjectImage2OneShotExecutorResponse: (input, extra, source) => {
      calls.responses.push({ name: "executeMock", input, extra, source });
      return { ok: overrides.executeMockOk ?? true, route: "executeMock", extra };
    },
    running: () => overrides.runningRef?.value ?? overrides.running ?? false,
  });
  return { api, calls };
}

async function hit(method, pathname, fixture) {
  const req = { method };
  const res = { writes: [] };
  const handled = await fixture.api.handleCurrentProjectOneShotRoute(req, res, new URL(`http://localhost${pathname}`));
  return { handled, res };
}

for (const [method, pathname, responseName, expectedStatus] of [
  ["GET", `${endpoints.currentProjectImage2OneShotStatusEndpoint}?selectedShotId=S01`, "oneShot", 200],
  ["POST", endpoints.currentProjectImage2OneShotPrepareEndpoint, "oneShot", 200],
  ["POST", endpoints.currentProjectImage2OneShotConfirmEndpoint, "oneShot", 200],
  ["POST", endpoints.currentProjectImage2OneShotPrepareTriggerEndpoint, "prepareTrigger", 200],
  ["POST", endpoints.currentProjectImage2OneShotExecuteMockEndpoint, "executeMock", 200],
]) {
  const fixture = createFixture({ running: true });
  const result = await hit(method, pathname, fixture);
  assert(result.handled === true, `${method} ${pathname} should be handled`);
  assert(fixture.calls.contexts.length === 1, `${responseName} should read route context once`);
  assert(fixture.calls.writes.length === 1, `${responseName} should write once`);
  assert(fixture.calls.writes[0].status === expectedStatus, `${responseName} status mismatch`);
  assert(fixture.calls.responses[0].name === responseName, `${responseName} builder mismatch`);
  assert(fixture.calls.responses[0].extra.running === true, `${responseName} should use injected running()`);
  assert(fixture.calls.responses[0].extra.ignoredRequestContext.ignored.projectRoot === "project", `${responseName} should include override diagnostics`);
}

{
  const fixture = createFixture();
  const result = await hit("GET", "/api/runtime/projects/current/real-chain/status", fixture);
  assert(result.handled === false, "non-one-shot route should return false");
  assert(fixture.calls.contexts.length === 0, "non-match should not read route context");
  assert(fixture.calls.writes.length === 0, "non-match should not write");
}

for (const pathname of [
  "/api/runtime/projects/current/image2-one-shot/return",
  "/api/runtime/projects/current/image2-one-shot/execute-return",
]) {
  const fixture = createFixture();
  const result = await hit("POST", pathname, fixture);
  assert(result.handled === false, `${pathname} should remain outside this adapter`);
  assert(fixture.calls.contexts.length === 0, `${pathname} should not read route context`);
  assert(fixture.calls.writes.length === 0, `${pathname} should not write`);
}

{
  const fixture = createFixture({ routeContext: undefined });
  const result = await hit("GET", endpoints.currentProjectImage2OneShotStatusEndpoint, fixture);
  assert(result.handled === true, "missing routeContext should still consume matched route");
  assert(fixture.calls.contexts.length === 1, "missing routeContext should call route context");
  assert(fixture.calls.responses.length === 0, "missing routeContext should not build response");
  assert(fixture.calls.writes.length === 0, "missing routeContext should not write again");
}

for (const [overrideKey, pathname, label] of [
  ["prepareOk", endpoints.currentProjectImage2OneShotPrepareEndpoint, "prepare"],
  ["confirmOk", endpoints.currentProjectImage2OneShotConfirmEndpoint, "confirm"],
  ["prepareTriggerOk", endpoints.currentProjectImage2OneShotPrepareTriggerEndpoint, "prepare-trigger"],
  ["executeMockOk", endpoints.currentProjectImage2OneShotExecuteMockEndpoint, "execute-mock"],
]) {
  const fixture = createFixture({ [overrideKey]: false });
  const result = await hit("POST", pathname, fixture);
  assert(result.handled === true, `${label} false response should be handled`);
  assert(fixture.calls.writes[0].status === 409, `${label} false response should return 409`);
}

{
  const runningRef = { value: false };
  const fixture = createFixture({ runningRef });
  const first = await hit("GET", endpoints.currentProjectImage2OneShotStatusEndpoint, fixture);
  runningRef.value = true;
  const second = await hit("GET", endpoints.currentProjectImage2OneShotStatusEndpoint, fixture);
  assert(first.res.writes[0].payload.extra.running === false, "first hit should read initial running state");
  assert(second.res.writes[0].payload.extra.running === true, "second hit should read updated running state");
}

console.log("runtime-api-current-project-one-shot-routes-test: ok");
