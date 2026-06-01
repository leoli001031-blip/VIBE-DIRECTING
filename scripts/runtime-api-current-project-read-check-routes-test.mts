import { createRuntimeApiCurrentProjectReadCheckRoutes } from "./runtime-api-current-project-read-check-routes.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const endpoints = {
  currentProjectStatusEndpoint: "/api/runtime/projects/current/real-chain/status",
  currentProjectRunEndpoint: "/api/runtime/projects/current/real-chain/run-check",
  currentProjectImage2BatchPlanEndpoint: "/api/runtime/projects/current/image2-batch/plan",
  currentProjectImage2BatchRunCheckEndpoint: "/api/runtime/projects/current/image2-batch/run-check",
};

function createFixture(overrides = {}) {
  const calls = {
    contexts: [],
    writes: [],
    builders: [],
    diagnostics: [],
  };
  const routeContext = Object.hasOwn(overrides, "routeContext")
    ? overrides.routeContext
    : { source: { id: "source" }, requestContext: { projectRoot: "project" } };
  const api = createRuntimeApiCurrentProjectReadCheckRoutes({
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
    currentProjectRealChainResponse: (extra, source) => {
      calls.builders.push({ name: "realStatus", extra, source });
      return { ok: true, route: "realStatus", extra };
    },
    currentProjectRealChainRunCheckResponse: (extra, source) => {
      calls.builders.push({ name: "realRun", extra, source });
      return { ok: overrides.realRunOk ?? true, route: "realRun", extra };
    },
    currentProjectImage2BatchPlanResponse: (extra, source) => {
      calls.builders.push({ name: "batchPlan", extra, source });
      return { ok: true, route: "batchPlan", extra };
    },
    currentProjectImage2BatchRunCheckResponse: (extra, source) => {
      calls.builders.push({ name: "batchRun", extra, source });
      return { ok: overrides.batchRunOk ?? true, route: "batchRun", extra };
    },
    running: () => overrides.running ?? false,
  });
  return { api, calls };
}

async function hit(method, pathname, fixture) {
  const res = { writes: [] };
  const handled = await fixture.api.handleCurrentProjectReadCheckRoute({ method }, res, new URL(`http://localhost${pathname}`));
  return { handled, res };
}

for (const [method, pathname, builderName, expectedStatus] of [
  ["GET", endpoints.currentProjectStatusEndpoint, "realStatus", 200],
  ["POST", endpoints.currentProjectRunEndpoint, "realRun", 200],
  ["GET", endpoints.currentProjectImage2BatchPlanEndpoint, "batchPlan", 200],
  ["POST", endpoints.currentProjectImage2BatchRunCheckEndpoint, "batchRun", 200],
]) {
  const fixture = createFixture({ running: true });
  const result = await hit(method, pathname, fixture);
  assert(result.handled === true, `${method} ${pathname} should be handled`);
  assert(fixture.calls.contexts.length === 1, `${builderName} should read route context once`);
  assert(fixture.calls.contexts[0].endpoint === pathname, `${builderName} endpoint mismatch`);
  assert(fixture.calls.writes.length === 1, `${builderName} should write once`);
  assert(fixture.calls.writes[0].status === expectedStatus, `${builderName} status mismatch`);
  assert(fixture.calls.builders[0].name === builderName, `${builderName} builder mismatch`);
  assert(fixture.calls.builders[0].extra.running === true, `${builderName} should use injected running()`);
  assert(fixture.calls.builders[0].extra.ignoredRequestContext.ignored.projectRoot === "project", `${builderName} should include override diagnostics`);
}

{
  const fixture = createFixture();
  const result = await hit("GET", "/api/runtime/projects/current/image2-one-shot/status", fixture);
  assert(result.handled === false, "non-read-check route should return false");
  assert(fixture.calls.contexts.length === 0, "non-match should not read route context");
  assert(fixture.calls.writes.length === 0, "non-match should not write");
}

{
  const fixture = createFixture({ routeContext: undefined });
  const result = await hit("GET", endpoints.currentProjectStatusEndpoint, fixture);
  assert(result.handled === true, "missing routeContext should still consume matched route");
  assert(fixture.calls.contexts.length === 1, "missing routeContext should call route context");
  assert(fixture.calls.builders.length === 0, "missing routeContext should not build response");
  assert(fixture.calls.writes.length === 0, "missing routeContext should not write again");
}

{
  const fixture = createFixture({ realRunOk: false });
  const result = await hit("POST", endpoints.currentProjectRunEndpoint, fixture);
  assert(result.handled === true, "failed real-chain run-check should be handled");
  assert(fixture.calls.writes[0].status === 500, "failed real-chain run-check should return 500");
}

{
  const fixture = createFixture({ batchRunOk: false });
  const result = await hit("POST", endpoints.currentProjectImage2BatchRunCheckEndpoint, fixture);
  assert(result.handled === true, "failed image2-batch run-check should be handled");
  assert(fixture.calls.writes[0].status === 500, "failed image2-batch run-check should return 500");
}

console.log("runtime-api-current-project-read-check-routes-test: ok");
