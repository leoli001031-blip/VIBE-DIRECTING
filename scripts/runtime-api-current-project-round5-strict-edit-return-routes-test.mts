import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRuntimeApiCurrentProjectRound5StrictEditReturnRoutes,
  round5StrictEditReturnRequestInput,
} from "./runtime-api-current-project-round5-strict-edit-return-routes.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleSource = readFileSync(path.join(__dirname, "runtime-api-current-project-round5-strict-edit-return-routes.mjs"), "utf8");
const serverSource = readFileSync(path.join(__dirname, "local-runtime-api-server.mjs"), "utf8");
const endpoint = "/api/runtime/projects/current/round5/strict-edit/return";

assert(
  !/\bfunction\s+round5StrictEditReturnRequestInput\b/.test(serverSource),
  "local runtime server should import moved Round 5 strict edit return route parser",
);

for (const forbidden of [
  "provider-submit",
  "provider submit",
  "real_provider_call",
  "fetch(",
  "spawn(",
  "writeFileSync",
  "renameSync",
  "projectVibeWritten: true",
]) {
  assert(!moduleSource.includes(forbidden), `Round 5 strict edit return route module must not contain ${forbidden}`);
}

function createFixture(overrides = {}) {
  const calls = {
    contexts: [],
    writes: [],
    responses: [],
  };
  const routeContext = Object.hasOwn(overrides, "routeContext")
    ? overrides.routeContext
    : {
        source: { id: "source" },
        requestContext: { requestId: "request-1", projectRoot: "project" },
        body: {
          shotId: "ZP05",
          actualProviderReturned: true,
          returnedOutputPath: "runs/current/outputs/ZP05.png",
          providerRequestId: "provider-request-1",
        },
      };
  const api = createRuntimeApiCurrentProjectRound5StrictEditReturnRoutes({
    currentProjectRound5StrictEditReturnEndpoint: overrides.endpoint || endpoint,
    currentProjectRouteContext: async (req, res, url, routeEndpoint) => {
      calls.contexts.push({ method: req.method, path: url.pathname, endpoint: routeEndpoint });
      return routeContext;
    },
    writeJson: (res, status, payload) => {
      calls.writes.push({ status, payload });
      res.writes.push({ status, payload });
    },
    currentProjectRound5StrictEditReturnResponse: (input, extra, source) => {
      calls.responses.push({ input, extra, source });
      return { ok: overrides.ok ?? true, route: "round5StrictEditReturn", input, extra };
    },
    running: () => overrides.runningRef?.value ?? overrides.running ?? false,
  });
  return { api, calls };
}

async function hit(method, pathname, fixture) {
  const req = { method };
  const res = { writes: [] };
  const handled = await fixture.api.handleCurrentProjectRound5StrictEditReturnRoute(req, res, new URL(`http://localhost${pathname}`));
  return { handled, res };
}

{
  const input = round5StrictEditReturnRequestInput(new URL(`http://localhost${endpoint}?shotId=Q05`), {
    shotId: "B05",
    selectedShotId: "S05",
    returnedOutputPath: "returned.png",
    outputPath: "output.png",
    endFramePath: "end-frame.png",
    actualProviderReturned: true,
    providerObservation: { providerRequestId: "inline-provider-request" },
    semanticQa: { passed: true },
    returnedProviderObservationPath: "provider-observation.json",
    providerObservationPath: "provider-observation-fallback.json",
    returnedSemanticQaPath: "semantic-qa.json",
    semanticQaPath: "semantic-qa-fallback.json",
    providerRequestId: "provider-request",
    requestId: "request-fallback",
    sha256: "sha256-primary",
    startFrameSha256: "sha256-start",
    sourceStartFrameSha256: "sha256-source",
  });
  assert(input.shotId === "Q05", "query shotId should win over body shotId/selectedShotId");
  assert(input.returnedOutputPath === "returned.png", "returnedOutputPath should win over outputPath/endFramePath");
  assert(input.actualProviderReturned === true, "actualProviderReturned should only accept true");
  assert(input.providerObservation.providerRequestId === "inline-provider-request", "inline providerObservation should parse");
  assert(input.semanticQa.passed === true, "inline semanticQa should parse");
  assert(input.returnedProviderObservationPath === "provider-observation.json", "returnedProviderObservationPath should win");
  assert(input.returnedSemanticQaPath === "semantic-qa.json", "returnedSemanticQaPath should win");
  assert(input.providerRequestId === "provider-request", "providerRequestId should win over requestId");
  assert(input.inputSha256 === "sha256-primary", "sha256 should win over fallback hashes");
}

{
  const input = round5StrictEditReturnRequestInput(new URL(`http://localhost${endpoint}`), {
    selectedShotId: "S05",
    outputPath: "output.png",
    actualProviderReturned: "true",
    providerObservation: [],
    semanticQa: "passed",
    providerObservationPath: "provider-observation.json",
    semanticQaPath: "semantic-qa.json",
    requestId: "request-id",
    startFrameSha256: "sha256-start",
  });
  assert(input.shotId === "S05", "selectedShotId should be body fallback");
  assert(input.returnedOutputPath === "output.png", "outputPath should be returnedOutputPath fallback");
  assert(input.actualProviderReturned === false, "actualProviderReturned should reject non-boolean true");
  assert(input.providerObservation === undefined, "non-record providerObservation should be ignored");
  assert(input.semanticQa === undefined, "non-record semanticQa should be ignored");
  assert(input.returnedProviderObservationPath === "provider-observation.json", "providerObservationPath should parse");
  assert(input.returnedSemanticQaPath === "semantic-qa.json", "semanticQaPath should parse");
  assert(input.providerRequestId === "request-id", "requestId should be providerRequestId fallback");
  assert(input.inputSha256 === "sha256-start", "startFrameSha256 should be inputSha256 fallback");
}

{
  const input = round5StrictEditReturnRequestInput(new URL(`http://localhost${endpoint}`), undefined);
  assert(input.shotId === "ZP05", "shotId should default to ZP05");
}

{
  const fixture = createFixture({ running: true });
  const result = await hit("POST", endpoint, fixture);
  assert(result.handled === true, "strict-edit return should be handled");
  assert(fixture.calls.contexts.length === 1, "strict-edit return should read route context once");
  assert(fixture.calls.contexts[0].endpoint === endpoint, "strict-edit return should pass injected endpoint to route context");
  assert(fixture.calls.responses[0].input.providerRequestId === "provider-request-1", "strict-edit return should parse input");
  assert(fixture.calls.responses[0].extra.running === true, "strict-edit return should include running()");
  assert(fixture.calls.responses[0].extra.requestContext.requestId === "request-1", "strict-edit return should preserve requestContext");
  assert(fixture.calls.responses[0].source.id === "source", "strict-edit return should pass source");
  assert(fixture.calls.writes[0].status === 200, "ok true should return 200");
}

{
  const fixture = createFixture({ ok: false });
  const result = await hit("POST", endpoint, fixture);
  assert(result.handled === true, "ok false strict-edit return should be handled");
  assert(fixture.calls.writes[0].status === 409, "ok false should return 409");
}

{
  const fixture = createFixture({ routeContext: undefined });
  const result = await hit("POST", endpoint, fixture);
  assert(result.handled === true, "missing routeContext should still consume matched strict-edit return route");
  assert(fixture.calls.contexts.length === 1, "missing routeContext should call route context");
  assert(fixture.calls.responses.length === 0, "missing routeContext should not build response");
  assert(fixture.calls.writes.length === 0, "missing routeContext should not write again");
}

for (const [method, pathname] of [
  ["GET", endpoint],
  ["POST", "/api/runtime/projects/current/round5/strict-edit/prepare"],
  ["POST", "/api/runtime/projects/current/image2-one-shot/return"],
  ["POST", "/api/runtime/projects/current/image2-one-shot/execute-return"],
  ["POST", "/api/runtime/real-demo-e2e/005/status"],
  ["POST", "/api/runtime/real-demo-e2e/005/run"],
  ["POST", "/api/real-demo-e2e/005/status"],
  ["POST", "/api/real-demo-e2e/005/run"],
]) {
  const fixture = createFixture();
  const result = await hit(method, pathname, fixture);
  assert(result.handled === false, `${method} ${pathname} should remain outside strict-edit return adapter`);
  assert(fixture.calls.contexts.length === 0, `${method} ${pathname} should not read route context`);
  assert(fixture.calls.writes.length === 0, `${method} ${pathname} should not write`);
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

console.log("runtime-api-current-project-round5-strict-edit-return-routes-test: ok");
