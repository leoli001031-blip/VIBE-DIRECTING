export function createRuntimeApiCurrentProjectRound5StrictEditPrepareRoutes(deps) {
  const {
    currentProjectRound5StrictEditPrepareEndpoint,
    currentProjectRouteContext,
    writeJson,
    round5StrictEditRequestInput,
    currentProjectRound5StrictEditPrepareResponse,
    running,
  } = deps;

  function runtimeState() {
    return typeof running === "function" ? running() : Boolean(running);
  }

  async function handleCurrentProjectRound5StrictEditPrepareRoute(req, res, url) {
    if (req.method !== "POST" || url.pathname !== currentProjectRound5StrictEditPrepareEndpoint) {
      return false;
    }

    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectRound5StrictEditPrepareEndpoint);
    if (!routeContext) return true;
    const input = round5StrictEditRequestInput(url, routeContext.body);
    const payload = currentProjectRound5StrictEditPrepareResponse(input, {
      running: runtimeState(),
      requestContext: routeContext.requestContext,
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return true;
  }

  return {
    handleCurrentProjectRound5StrictEditPrepareRoute,
  };
}
