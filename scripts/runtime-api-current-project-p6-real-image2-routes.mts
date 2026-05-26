import { createRuntimeApiCurrentProjectP6RealImage2Submit } from "./runtime-api-current-project-p6-real-image2-submit.mts";

export function createRuntimeApiCurrentProjectP6RealImage2Routes(deps) {
  const submitApi = createRuntimeApiCurrentProjectP6RealImage2Submit(deps);
  const {
    handleCurrentProjectP6RealImage2SubmitRoute,
    handleCurrentProjectP6RealImage2SerialSubmitRoute,
  } = submitApi;

  async function handleCurrentProjectP6RealImage2Routes(req, res, url) {
    if (await handleCurrentProjectP6RealImage2SubmitRoute(req, res, url)) return true;
    if (await handleCurrentProjectP6RealImage2SerialSubmitRoute(req, res, url)) return true;
    return false;
  }

  return {
    ...submitApi,
    handleCurrentProjectP6RealImage2Routes,
  };
}
