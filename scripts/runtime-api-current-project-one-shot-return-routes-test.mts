import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRuntimeApiCurrentProjectOneShotReturnRoutes,
  oneShotReturnRequestInput,
} from "./runtime-api-current-project-one-shot-return-routes.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleSource = readFileSync(path.join(__dirname, "runtime-api-current-project-one-shot-return-routes.mjs"), "utf8");
const serverSource = readFileSync(path.join(__dirname, "local-runtime-api-server.mjs"), "utf8");

assert(!/\bfunction\s+oneShotReturnRequestInput\b/.test(serverSource), "local runtime server should import moved one-shot return route parser");

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
  assert(!moduleSource.includes(forbidden), `one-shot return route module must not contain ${forbidden}`);
}

const endpoints = {
  currentProjectImage2OneShotReturnEndpoint: "/api/runtime/projects/current/image2-one-shot/return",
  currentProjectImage2OneShotExecuteReturnEndpoint: "/api/runtime/projects/current/image2-one-shot/execute-return",
};

function createFixture(overrides = {}) {
  const calls = {
    contexts: [],
    diagnostics: [],
    responses: [],
    writes: [],
  };
  const routeContext = Object.hasOwn(overrides, "routeContext")
    ? overrides.routeContext
    : {
        source: { id: "source" },
        requestContext: { projectRoot: "project", requestId: "request-1" },
        body: {
          selectedShotId: "S01",
          actualProviderReturned: true,
          returnedOutputPath: "runs/current/outputs/S01.png",
          providerRequestId: "provider-request-1",
        },
      };
  const api = createRuntimeApiCurrentProjectOneShotReturnRoutes({
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
    currentProjectImage2OneShotReturnIngestResponse: (input, extra, source) => {
      calls.responses.push({ input, extra, source });
      return { ok: overrides.ok ?? true, route: "oneShotReturn", input, extra };
    },
    running: () => overrides.runningRef?.value ?? overrides.running ?? false,
  });
  return { api, calls };
}

async function hit(method, pathname, fixture) {
  const req = { method };
  const res = { writes: [] };
  const handled = await fixture.api.handleCurrentProjectOneShotReturnRoute(req, res, new URL(`http://localhost${pathname}`));
  return { handled, res };
}

{
  const input = oneShotReturnRequestInput(new URL("http://localhost/api/runtime/projects/current/image2-one-shot/return?selectedShotId=Q01&receiptId=query-receipt&transportMode=query-mode"), {
    receipt: {
      selectedShotId: "R01",
      expectedOutputPath: "receipt-expected.png",
      transportMode: "receipt-mode",
      maxProviderCallsPerReceipt: "1",
    },
    shotId: "B01",
    selectedShotIds: [" B02 ", "B03"],
    imageCount: 2,
    expectedOutputPath: "body-expected.png",
    returnedOutputPath: "returned.png",
    returnedProviderObservationPath: "provider-observation.json",
    returnedSemanticQaPath: "semantic-qa.json",
    providerObservation: { providerRequestId: "inline-provider-request" },
    semanticQa: { passed: true },
    providerName: "provider-name",
    executorMode: "external_provider_return",
    providerRequestId: "body-provider-request",
    actualProviderReturned: true,
    sourceImagePath: "source.png",
  });
  assert(input.selectedShotId === "Q01", "query selectedShotId should win");
  assert(input.selectedShotIds.length === 2 && input.selectedShotIds[0] === "B02", "body selectedShotIds should trim");
  assert(input.receiptId === "query-receipt", "query receiptId should win");
  assert(input.expectedOutputPath === "body-expected.png", "body expectedOutputPath should win over receipt");
  assert(input.transportMode === "query-mode", "query transportMode should win");
  assert(input.returnedOutputPath === "returned.png", "returnedOutputPath should parse");
  assert(input.returnedProviderObservationPath === "provider-observation.json", "provider observation path should parse");
  assert(input.returnedSemanticQaPath === "semantic-qa.json", "semantic QA path should parse");
  assert(input.providerObservation.providerRequestId === "inline-provider-request", "inline providerObservation should parse");
  assert(input.semanticQa.passed === true, "inline semanticQa should parse");
  assert(input.providerRequestId === "body-provider-request", "providerRequestId should parse");
  assert(input.providerName === "provider-name" && input.provider === "provider-name", "providerName/provider should parse together");
  assert(input.executorMode === "external_provider_return" && input.mode === "external_provider_return", "executorMode/mode should parse together");
  assert(input.actualProviderReturned === true, "actualProviderReturned should parse");
  assert(input.sourceImagePath === "source.png", "sourceImagePath should parse");
}

for (const pathname of [
  endpoints.currentProjectImage2OneShotReturnEndpoint,
  endpoints.currentProjectImage2OneShotExecuteReturnEndpoint,
]) {
  const fixture = createFixture({ running: true });
  const result = await hit("POST", pathname, fixture);
  assert(result.handled === true, `${pathname} should be handled`);
  assert(fixture.calls.contexts.length === 1, `${pathname} should read route context once`);
  assert(fixture.calls.contexts[0].endpoint === pathname, `${pathname} should pass url.pathname as endpoint`);
  assert(fixture.calls.responses[0].input.providerRequestId === "provider-request-1", `${pathname} should parse input`);
  assert(fixture.calls.responses[0].extra.running === true, `${pathname} should include running()`);
  assert(fixture.calls.responses[0].extra.ignoredRequestContext.ignored.requestId === "request-1", `${pathname} should preserve ignored request context diagnostics`);
  assert(fixture.calls.responses[0].source.id === "source", `${pathname} should pass source`);
  assert(fixture.calls.writes[0].status === 200, `${pathname} ok true should return 200`);
}

{
  const fixture = createFixture({ ok: false });
  const result = await hit("POST", endpoints.currentProjectImage2OneShotExecuteReturnEndpoint, fixture);
  assert(result.handled === true, "ok false execute-return should be handled");
  assert(fixture.calls.writes[0].status === 409, "ok false should return 409");
}

{
  const fixture = createFixture({ routeContext: undefined });
  const result = await hit("POST", endpoints.currentProjectImage2OneShotReturnEndpoint, fixture);
  assert(result.handled === true, "missing routeContext should still consume matched return route");
  assert(fixture.calls.contexts.length === 1, "missing routeContext should call route context");
  assert(fixture.calls.responses.length === 0, "missing routeContext should not build response");
  assert(fixture.calls.writes.length === 0, "missing routeContext should not write again");
}

for (const [method, pathname] of [
  ["GET", endpoints.currentProjectImage2OneShotReturnEndpoint],
  ["POST", "/api/runtime/projects/current/round5/strict-edit/return"],
  ["POST", "/api/runtime/real-demo-e2e/005/status"],
  ["POST", "/api/runtime/real-demo-e2e/005/run"],
]) {
  const fixture = createFixture();
  const result = await hit(method, pathname, fixture);
  assert(result.handled === false, `${method} ${pathname} should remain outside return adapter`);
  assert(fixture.calls.contexts.length === 0, `${method} ${pathname} should not read route context`);
  assert(fixture.calls.writes.length === 0, `${method} ${pathname} should not write`);
}

{
  const runningRef = { value: false };
  const fixture = createFixture({ runningRef });
  const first = await hit("POST", endpoints.currentProjectImage2OneShotReturnEndpoint, fixture);
  runningRef.value = true;
  const second = await hit("POST", endpoints.currentProjectImage2OneShotReturnEndpoint, fixture);
  assert(first.res.writes[0].payload.extra.running === false, "first hit should read initial running state");
  assert(second.res.writes[0].payload.extra.running === true, "second hit should read updated running state");
}

console.log("runtime-api-current-project-one-shot-return-routes-test: ok");
