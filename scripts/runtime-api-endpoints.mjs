export function createRuntimeApiEndpoints(runtimeBasePath = "/api/runtime") {
  const runtimeStatusEndpoint = `${runtimeBasePath}/status`;
  const currentProjectBindingEndpoint = `${runtimeBasePath}/projects/current`;
  const currentProjectSelectEndpoint = `${runtimeBasePath}/projects/select`;
  const currentProjectRecentEndpoint = `${runtimeBasePath}/projects/recent`;
  const currentProjectStatusEndpoint = `${runtimeBasePath}/projects/current/real-chain/status`;
  const currentProjectRunEndpoint = `${runtimeBasePath}/projects/current/real-chain/run-check`;
  const currentProjectImage2BatchPlanEndpoint = `${runtimeBasePath}/projects/current/image2-batch/plan`;
  const currentProjectImage2BatchRunCheckEndpoint = `${runtimeBasePath}/projects/current/image2-batch/run-check`;
  const currentProjectImage2OneShotStatusEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/status`;
  const currentProjectImage2OneShotPrepareEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/prepare`;
  const currentProjectImage2OneShotConfirmEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/confirm`;
  const currentProjectImage2OneShotPrepareTriggerEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/prepare-trigger`;
  const currentProjectImage2OneShotExecuteMockEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/execute-mock`;
  const currentProjectImage2OneShotReturnEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/return`;
  const currentProjectImage2OneShotExecuteReturnEndpoint = `${runtimeBasePath}/projects/current/image2-one-shot/execute-return`;
  const currentProjectRound5StrictEditPrepareEndpoint = `${runtimeBasePath}/projects/current/round5/strict-edit/prepare`;
  const currentProjectRound5StrictEditReturnEndpoint = `${runtimeBasePath}/projects/current/round5/strict-edit/return`;
  const realDemo005StatusEndpoint = `${runtimeBasePath}/real-demo-e2e/005/status`;
  const realDemo005RunEndpoint = `${runtimeBasePath}/real-demo-e2e/005/run`;
  const runtimeFileEndpoint = `${runtimeBasePath}/files`;
  const legacyStatusEndpoint = "/api/real-demo-e2e/005/status";
  const legacyRunEndpoint = "/api/real-demo-e2e/005/run";

  const currentProjectEndpoints = {
    currentProjectBindingEndpoint,
    currentProjectSelectEndpoint,
    currentProjectRecentEndpoint,
    currentProjectStatusEndpoint,
    currentProjectRunEndpoint,
    currentProjectImage2BatchPlanEndpoint,
    currentProjectImage2BatchRunCheckEndpoint,
    currentProjectImage2OneShotStatusEndpoint,
    currentProjectImage2OneShotPrepareEndpoint,
    currentProjectImage2OneShotConfirmEndpoint,
    currentProjectImage2OneShotPrepareTriggerEndpoint,
    currentProjectImage2OneShotExecuteMockEndpoint,
    currentProjectImage2OneShotReturnEndpoint,
    currentProjectImage2OneShotExecuteReturnEndpoint,
    currentProjectRound5StrictEditPrepareEndpoint,
    currentProjectRound5StrictEditReturnEndpoint,
  };

  const realDemo005Endpoints = {
    realDemo005StatusEndpoint,
    realDemo005RunEndpoint,
    legacyStatusEndpoint,
    legacyRunEndpoint,
  };

  const runtimeStatusEndpoints = {
    runtimeStatusEndpoint,
    ...currentProjectEndpoints,
    realDemo005StatusEndpoint,
    realDemo005RunEndpoint,
    runtimeFileEndpoint,
  };

  return {
    runtimeBasePath,
    runtimeStatusEndpoint,
    currentProjectBindingEndpoint,
    currentProjectSelectEndpoint,
    currentProjectRecentEndpoint,
    currentProjectStatusEndpoint,
    currentProjectRunEndpoint,
    currentProjectImage2BatchPlanEndpoint,
    currentProjectImage2BatchRunCheckEndpoint,
    currentProjectImage2OneShotStatusEndpoint,
    currentProjectImage2OneShotPrepareEndpoint,
    currentProjectImage2OneShotConfirmEndpoint,
    currentProjectImage2OneShotPrepareTriggerEndpoint,
    currentProjectImage2OneShotExecuteMockEndpoint,
    currentProjectImage2OneShotReturnEndpoint,
    currentProjectImage2OneShotExecuteReturnEndpoint,
    currentProjectRound5StrictEditPrepareEndpoint,
    currentProjectRound5StrictEditReturnEndpoint,
    realDemo005StatusEndpoint,
    realDemo005RunEndpoint,
    runtimeFileEndpoint,
    legacyStatusEndpoint,
    legacyRunEndpoint,
    currentProjectEndpoints,
    runtimeStatusEndpoints,
    realDemo005Endpoints,
  };
}
