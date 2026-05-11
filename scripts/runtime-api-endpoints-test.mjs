import { createRuntimeApiEndpoints } from "./runtime-api-endpoints.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nexpected: ${expectedJson}\nactual: ${actualJson}`);
  }
}

const expectedDefaultEndpoints = {
  runtimeBasePath: "/api/runtime",
  runtimeStatusEndpoint: "/api/runtime/status",
  currentProjectBindingEndpoint: "/api/runtime/projects/current",
  currentProjectSelectEndpoint: "/api/runtime/projects/select",
  currentProjectRecentEndpoint: "/api/runtime/projects/recent",
  currentProjectStatusEndpoint: "/api/runtime/projects/current/real-chain/status",
  currentProjectRunEndpoint: "/api/runtime/projects/current/real-chain/run-check",
  currentProjectImage2BatchPlanEndpoint: "/api/runtime/projects/current/image2-batch/plan",
  currentProjectImage2BatchRunCheckEndpoint: "/api/runtime/projects/current/image2-batch/run-check",
  currentProjectImage2OneShotStatusEndpoint: "/api/runtime/projects/current/image2-one-shot/status",
  currentProjectImage2OneShotPrepareEndpoint: "/api/runtime/projects/current/image2-one-shot/prepare",
  currentProjectImage2OneShotConfirmEndpoint: "/api/runtime/projects/current/image2-one-shot/confirm",
  currentProjectImage2OneShotPrepareTriggerEndpoint: "/api/runtime/projects/current/image2-one-shot/prepare-trigger",
  currentProjectImage2OneShotExecuteMockEndpoint: "/api/runtime/projects/current/image2-one-shot/execute-mock",
  currentProjectImage2OneShotReturnEndpoint: "/api/runtime/projects/current/image2-one-shot/return",
  currentProjectImage2OneShotExecuteReturnEndpoint: "/api/runtime/projects/current/image2-one-shot/execute-return",
  currentProjectRound5StrictEditPrepareEndpoint: "/api/runtime/projects/current/round5/strict-edit/prepare",
  currentProjectRound5StrictEditReturnEndpoint: "/api/runtime/projects/current/round5/strict-edit/return",
  realDemo005StatusEndpoint: "/api/runtime/real-demo-e2e/005/status",
  realDemo005RunEndpoint: "/api/runtime/real-demo-e2e/005/run",
  runtimeFileEndpoint: "/api/runtime/files",
  legacyStatusEndpoint: "/api/real-demo-e2e/005/status",
  legacyRunEndpoint: "/api/real-demo-e2e/005/run",
};

const expectedCurrentProjectEndpoints = {
  currentProjectBindingEndpoint: expectedDefaultEndpoints.currentProjectBindingEndpoint,
  currentProjectSelectEndpoint: expectedDefaultEndpoints.currentProjectSelectEndpoint,
  currentProjectRecentEndpoint: expectedDefaultEndpoints.currentProjectRecentEndpoint,
  currentProjectStatusEndpoint: expectedDefaultEndpoints.currentProjectStatusEndpoint,
  currentProjectRunEndpoint: expectedDefaultEndpoints.currentProjectRunEndpoint,
  currentProjectImage2BatchPlanEndpoint: expectedDefaultEndpoints.currentProjectImage2BatchPlanEndpoint,
  currentProjectImage2BatchRunCheckEndpoint: expectedDefaultEndpoints.currentProjectImage2BatchRunCheckEndpoint,
  currentProjectImage2OneShotStatusEndpoint: expectedDefaultEndpoints.currentProjectImage2OneShotStatusEndpoint,
  currentProjectImage2OneShotPrepareEndpoint: expectedDefaultEndpoints.currentProjectImage2OneShotPrepareEndpoint,
  currentProjectImage2OneShotConfirmEndpoint: expectedDefaultEndpoints.currentProjectImage2OneShotConfirmEndpoint,
  currentProjectImage2OneShotPrepareTriggerEndpoint: expectedDefaultEndpoints.currentProjectImage2OneShotPrepareTriggerEndpoint,
  currentProjectImage2OneShotExecuteMockEndpoint: expectedDefaultEndpoints.currentProjectImage2OneShotExecuteMockEndpoint,
  currentProjectImage2OneShotReturnEndpoint: expectedDefaultEndpoints.currentProjectImage2OneShotReturnEndpoint,
  currentProjectImage2OneShotExecuteReturnEndpoint: expectedDefaultEndpoints.currentProjectImage2OneShotExecuteReturnEndpoint,
  currentProjectRound5StrictEditPrepareEndpoint: expectedDefaultEndpoints.currentProjectRound5StrictEditPrepareEndpoint,
  currentProjectRound5StrictEditReturnEndpoint: expectedDefaultEndpoints.currentProjectRound5StrictEditReturnEndpoint,
};

const expectedRealDemo005Endpoints = {
  realDemo005StatusEndpoint: expectedDefaultEndpoints.realDemo005StatusEndpoint,
  realDemo005RunEndpoint: expectedDefaultEndpoints.realDemo005RunEndpoint,
  legacyStatusEndpoint: expectedDefaultEndpoints.legacyStatusEndpoint,
  legacyRunEndpoint: expectedDefaultEndpoints.legacyRunEndpoint,
};

{
  const endpoints = createRuntimeApiEndpoints();
  for (const [key, value] of Object.entries(expectedDefaultEndpoints)) {
    assert(endpoints[key] === value, `default ${key} mismatch`);
  }

  assertDeepEqual(endpoints.currentProjectEndpoints, expectedCurrentProjectEndpoints, "default currentProjectEndpoints mismatch");
  assertDeepEqual(endpoints.realDemo005Endpoints, expectedRealDemo005Endpoints, "default realDemo005Endpoints mismatch");
  assertDeepEqual(endpoints.runtimeStatusEndpoints, {
    runtimeStatusEndpoint: expectedDefaultEndpoints.runtimeStatusEndpoint,
    ...expectedCurrentProjectEndpoints,
    realDemo005StatusEndpoint: expectedDefaultEndpoints.realDemo005StatusEndpoint,
    realDemo005RunEndpoint: expectedDefaultEndpoints.realDemo005RunEndpoint,
    runtimeFileEndpoint: expectedDefaultEndpoints.runtimeFileEndpoint,
  }, "default runtimeStatusEndpoints mismatch");
}

{
  const endpoints = createRuntimeApiEndpoints();
  const currentValues = new Set(Object.values(endpoints.currentProjectEndpoints));
  assert(currentValues.has("/api/runtime/projects/current"), "currentProjectEndpoints should include current project binding");
  assert(currentValues.has("/api/runtime/projects/current/image2-one-shot/execute-return"), "currentProjectEndpoints should include current project execute-return");
  assert(!currentValues.has("/api/runtime/status"), "currentProjectEndpoints must not include runtime status");
  assert(!currentValues.has("/api/runtime/files"), "currentProjectEndpoints must not include runtime files");
  assert(!currentValues.has("/api/runtime/real-demo-e2e/005/status"), "currentProjectEndpoints must not include runtime 005 status");
  assert(!currentValues.has("/api/runtime/real-demo-e2e/005/run"), "currentProjectEndpoints must not include runtime 005 run");
  assert(!currentValues.has("/api/real-demo-e2e/005/status"), "currentProjectEndpoints must not include legacy 005 status");
  assert(!currentValues.has("/api/real-demo-e2e/005/run"), "currentProjectEndpoints must not include legacy 005 run");
}

{
  const endpoints = createRuntimeApiEndpoints();
  const statusValues = new Set(Object.values(endpoints.runtimeStatusEndpoints));
  assert(statusValues.has("/api/runtime/status"), "runtimeStatusEndpoints should include runtime status");
  assert(statusValues.has("/api/runtime/projects/current/real-chain/status"), "runtimeStatusEndpoints should include current project status");
  assert(statusValues.has("/api/runtime/real-demo-e2e/005/status"), "runtimeStatusEndpoints should include 005 status");
  assert(statusValues.has("/api/runtime/real-demo-e2e/005/run"), "runtimeStatusEndpoints should include 005 run");
  assert(statusValues.has("/api/runtime/files"), "runtimeStatusEndpoints should include runtime files");
}

{
  const endpoints = createRuntimeApiEndpoints("/custom/runtime");
  assert(endpoints.runtimeBasePath === "/custom/runtime", "custom base path mismatch");
  assert(endpoints.runtimeStatusEndpoint === "/custom/runtime/status", "custom runtime status mismatch");
  assert(endpoints.currentProjectBindingEndpoint === "/custom/runtime/projects/current", "custom current project binding mismatch");
  assert(endpoints.currentProjectImage2OneShotReturnEndpoint === "/custom/runtime/projects/current/image2-one-shot/return", "custom current project return mismatch");
  assert(endpoints.realDemo005StatusEndpoint === "/custom/runtime/real-demo-e2e/005/status", "custom runtime 005 status mismatch");
  assert(endpoints.realDemo005RunEndpoint === "/custom/runtime/real-demo-e2e/005/run", "custom runtime 005 run mismatch");
  assert(endpoints.runtimeFileEndpoint === "/custom/runtime/files", "custom runtime files mismatch");
  assert(endpoints.realDemo005Endpoints.legacyStatusEndpoint === "/api/real-demo-e2e/005/status", "legacy 005 status should not follow custom base path");
  assert(endpoints.realDemo005Endpoints.legacyRunEndpoint === "/api/real-demo-e2e/005/run", "legacy 005 run should not follow custom base path");
}

console.log("runtime-api-endpoints-test: ok");
