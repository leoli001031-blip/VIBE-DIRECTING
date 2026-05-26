import { projectRuntimeBasePath } from "./runtimeApiClient";

export const projectImage2BatchPlanEndpoint = `${projectRuntimeBasePath}/projects/current/image2-batch/plan`;
export const projectImage2BatchRunCheckEndpoint = `${projectRuntimeBasePath}/projects/current/image2-batch/run-check`;
export const projectImage2OneShotStatusEndpoint = `${projectRuntimeBasePath}/projects/current/image2-one-shot/status`;
export const projectImage2OneShotPrepareEndpoint = `${projectRuntimeBasePath}/projects/current/image2-one-shot/prepare`;
export const projectImage2OneShotConfirmEndpoint = `${projectRuntimeBasePath}/projects/current/image2-one-shot/confirm`;
export const projectImage2OneShotPrepareTriggerEndpoint = `${projectRuntimeBasePath}/projects/current/image2-one-shot/prepare-trigger`;
export const projectImage2OneShotReturnEndpoint = `${projectRuntimeBasePath}/projects/current/image2-one-shot/return`;
export const projectImage2OneShotExecuteReturnEndpoint = `${projectRuntimeBasePath}/projects/current/image2-one-shot/execute-return`;
export const projectImage2AssetGenerateEndpoint = `${projectRuntimeBasePath}/projects/current/image2-assets/generate`;
export const projectImage2EndFrameSubmitEndpoint = `${projectRuntimeBasePath}/projects/current/image2-end-frame/submit`;
export const projectSeedanceSubmitEndpoint = `${projectRuntimeBasePath}/projects/current/seedance/submit`;
export const projectP6RealImage2SubmitEndpoint = `${projectRuntimeBasePath}/projects/current/p6-real-image2/submit`;
export const projectP6RealImage2SubmitSerialEndpoint = `${projectRuntimeBasePath}/projects/current/p6-real-image2/submit-serial`;
