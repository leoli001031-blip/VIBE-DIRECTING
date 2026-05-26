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
  const currentProjectImage2AssetGenerateEndpoint = `${runtimeBasePath}/projects/current/image2-assets/generate`;
  const currentProjectAssetStatusEndpoint = `${runtimeBasePath}/projects/current/assets/status`;
  const currentProjectImage2EndFrameSubmitEndpoint = `${runtimeBasePath}/projects/current/image2-end-frame/submit`;
  const currentProjectSeedanceSubmitEndpoint = `${runtimeBasePath}/projects/current/seedance/submit`;
  const currentProjectReviewDecisionEndpoint = `${runtimeBasePath}/projects/current/review/decision`;
  const currentProjectP6RealImage2SubmitEndpoint = `${runtimeBasePath}/projects/current/p6-real-image2/submit`;
  const currentProjectP6RealImage2SubmitSerialEndpoint = `${runtimeBasePath}/projects/current/p6-real-image2/submit-serial`;
  const currentProjectRound5StrictEditPrepareEndpoint = `${runtimeBasePath}/projects/current/round5/strict-edit/prepare`;
  const currentProjectRound5StrictEditReturnEndpoint = `${runtimeBasePath}/projects/current/round5/strict-edit/return`;
  const realDemo005StatusEndpoint = `${runtimeBasePath}/real-demo-e2e/005/status`;
  const realDemo005RunEndpoint = `${runtimeBasePath}/real-demo-e2e/005/run`;
  const runtimeFileEndpoint = `${runtimeBasePath}/files`;
  const runtimeCredentialsEndpoint = `${runtimeBasePath}/credentials`;
  const runtimeAgentWebSearchEndpoint = `${runtimeBasePath}/agent/web-search`;
  const runtimeDirectorStoryboardPlanEndpoint = `${runtimeBasePath}/director/storyboard-plan`;
  const runtimeLocalIndexTtsEndpoint = `${runtimeBasePath}/audio/local-index-tts/generate`;
  const runtimeLocalQwen3TtsCloneEndpoint = `${runtimeBasePath}/audio/local-qwen3-tts-clone/generate`;
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
    currentProjectImage2AssetGenerateEndpoint,
    currentProjectAssetStatusEndpoint,
    currentProjectImage2EndFrameSubmitEndpoint,
    currentProjectSeedanceSubmitEndpoint,
    currentProjectReviewDecisionEndpoint,
    currentProjectP6RealImage2SubmitEndpoint,
    currentProjectP6RealImage2SubmitSerialEndpoint,
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
    runtimeCredentialsEndpoint,
    runtimeAgentWebSearchEndpoint,
    runtimeDirectorStoryboardPlanEndpoint,
    runtimeLocalIndexTtsEndpoint,
    runtimeLocalQwen3TtsCloneEndpoint,
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
    currentProjectImage2AssetGenerateEndpoint,
    currentProjectAssetStatusEndpoint,
    currentProjectImage2EndFrameSubmitEndpoint,
    currentProjectSeedanceSubmitEndpoint,
    currentProjectReviewDecisionEndpoint,
    currentProjectP6RealImage2SubmitEndpoint,
    currentProjectP6RealImage2SubmitSerialEndpoint,
    currentProjectRound5StrictEditPrepareEndpoint,
    currentProjectRound5StrictEditReturnEndpoint,
    realDemo005StatusEndpoint,
    realDemo005RunEndpoint,
    runtimeFileEndpoint,
    runtimeCredentialsEndpoint,
    runtimeAgentWebSearchEndpoint,
    runtimeDirectorStoryboardPlanEndpoint,
    runtimeLocalIndexTtsEndpoint,
    runtimeLocalQwen3TtsCloneEndpoint,
    legacyStatusEndpoint,
    legacyRunEndpoint,
    currentProjectEndpoints,
    runtimeStatusEndpoints,
    realDemo005Endpoints,
  };
}
