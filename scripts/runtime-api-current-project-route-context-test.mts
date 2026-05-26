import { createCurrentProjectRouteContext, isCurrentProjectEndpoint } from "./runtime-api-current-project-route-context.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const endpoint = "/api/runtime/projects/current/image2-one-shot/prepare";

function createFixture(overrides = {}) {
  const calls = {
    reads: [],
    requestContexts: [],
    sourceResults: [],
    writes: [],
    blocked: [],
    unbound: [],
  };
  const bodyResult = Object.hasOwn(overrides, "bodyResult")
    ? overrides.bodyResult
    : { ok: true, body: overrides.body };
  const requestContext = Object.hasOwn(overrides, "requestContext")
    ? overrides.requestContext
    : { projectRoot: "project", projectRootSource: "payload" };
  const sourceResult = Object.hasOwn(overrides, "sourceResult")
    ? overrides.sourceResult
    : { source: overrides.source ?? { projectRoot: "/repo/project" } };
  const currentProjectRouteContext = createCurrentProjectRouteContext({
    readRequestJsonBody: async (req) => {
      calls.reads.push(req);
      return bodyResult;
    },
    currentProjectRequestContext: (req, url, body) => {
      calls.requestContexts.push({ req, url, body });
      return requestContext;
    },
    currentProjectSourceResult: () => {
      calls.sourceResults.push({});
      return sourceResult;
    },
    writeJson: (res, status, payload) => {
      calls.writes.push({ status, payload });
      res.writes.push({ status, payload });
    },
    blockedCurrentProjectResponse: (blockedEndpoint, context, extra) => {
      calls.blocked.push({ endpoint: blockedEndpoint, context, extra });
      return { ok: false, response: "blocked", endpoint: blockedEndpoint, context, ...extra };
    },
    unboundCurrentProjectResponse: (unboundEndpoint, context) => {
      calls.unbound.push({ endpoint: unboundEndpoint, context });
      return { ok: false, response: "unbound", endpoint: unboundEndpoint, context };
    },
  });
  return { currentProjectRouteContext, calls };
}

async function hit(method, fixture) {
  const req = { method };
  const res = { writes: [] };
  const url = new URL("http://localhost/api/runtime/projects/current/image2-one-shot/prepare");
  const result = await fixture.currentProjectRouteContext(req, res, url, endpoint);
  return { result, req, res, url };
}

{
  const fixture = createFixture();
  const { result } = await hit("GET", fixture);
  assert(fixture.calls.reads.length === 0, "GET should not read request body");
  assert(fixture.calls.requestContexts.length === 1, "GET should build request context");
  assert(fixture.calls.requestContexts[0].body === undefined, "GET body should be undefined");
  assert(result.body === undefined, "GET result body should be undefined");
  assert(result.requestContext.projectRoot === "project", "GET result should include request context");
  assert(result.source.projectRoot === "/repo/project", "GET result should include source");
}

{
  const body = { projectRoot: "project-from-body" };
  const fixture = createFixture({ body });
  const { result, req } = await hit("POST", fixture);
  assert(fixture.calls.reads.length === 1, "POST should read request body once");
  assert(fixture.calls.reads[0] === req, "POST should pass req to body reader");
  assert(fixture.calls.requestContexts[0].body === body, "POST should pass body into request context");
  assert(result.body === body, "POST result should include parsed body");
}

{
  const fixture = createFixture({ bodyResult: { ok: false, message: "Request body must be valid JSON." } });
  const { result, res } = await hit("POST", fixture);
  assert(result === undefined, "bad JSON should stop route context");
  assert(fixture.calls.requestContexts.length === 0, "bad JSON should not build request context");
  assert(fixture.calls.sourceResults.length === 0, "bad JSON should not resolve source");
  assert(res.writes[0].status === 400, "bad JSON should return 400");
  assert(res.writes[0].payload.response === "blocked", "bad JSON should use blocked response");
  assert(fixture.calls.blocked[0].endpoint === endpoint, "bad JSON blocked endpoint mismatch");
  assert(Object.keys(fixture.calls.blocked[0].context).length === 0, "bad JSON blocked context should be empty");
  assert(fixture.calls.blocked[0].extra.status === "bad_request", "bad JSON status mismatch");
}

{
  const requestContext = { projectRoot: "missing-project" };
  const fixture = createFixture({
    requestContext,
    sourceResult: { error: new Error("No current project."), unbound: true },
  });
  const { result, res } = await hit("GET", fixture);
  assert(result === undefined, "unbound source should stop route context");
  assert(res.writes[0].status === 409, "unbound source should return 409");
  assert(res.writes[0].payload.response === "unbound", "unbound source should use unbound response");
  assert(fixture.calls.unbound[0].context === requestContext, "unbound source should pass request context");
}

{
  const requestContext = { projectRoot: "blocked-project" };
  const fixture = createFixture({
    requestContext,
    sourceResult: { error: new Error("blocked"), message: "Project root is blocked." },
  });
  const { result, res } = await hit("GET", fixture);
  assert(result === undefined, "blocked source should stop route context");
  assert(res.writes[0].status === 403, "blocked source should return 403");
  assert(res.writes[0].payload.response === "blocked", "blocked source should use blocked response");
  assert(fixture.calls.blocked[0].context === requestContext, "blocked source should pass request context");
  assert(fixture.calls.blocked[0].extra.message === "Project root is blocked.", "blocked source message mismatch");
}

{
  const body = { projectId: "p1" };
  const requestContext = { projectId: "p1" };
  const source = { projectId: "p1", projectRoot: "/repo/p1" };
  const fixture = createFixture({ body, requestContext, source });
  const { result } = await hit("POST", fixture);
  assert(result.requestContext === requestContext, "ok result should preserve requestContext");
  assert(result.source === source, "ok result should preserve source");
  assert(result.body === body, "ok result should preserve body");
}

{
  const endpoints = {
    current: "/api/runtime/projects/current",
    oneShot: "/api/runtime/projects/current/image2-one-shot/prepare",
  };
  assert(isCurrentProjectEndpoint(endpoints.current, endpoints) === true, "matcher should match current endpoint object values");
  assert(isCurrentProjectEndpoint(endpoints.oneShot, Object.values(endpoints)) === true, "matcher should match endpoint arrays");
  assert(isCurrentProjectEndpoint("/api/runtime/real-demo-e2e/005/status", endpoints) === false, "matcher should reject non-current endpoint");
}

console.log("runtime-api-current-project-route-context-test: ok");
