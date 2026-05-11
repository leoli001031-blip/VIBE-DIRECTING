export function createRuntimeApiCurrentProjectReadCheckRoutes(deps) {
  const {
    currentProjectStatusEndpoint,
    currentProjectRunEndpoint,
    currentProjectImage2BatchPlanEndpoint,
    currentProjectImage2BatchRunCheckEndpoint,
    currentProjectRouteContext,
    writeJson,
    requestOverrideDiagnostics,
    currentProjectRealChainResponse,
    currentProjectRealChainRunCheckResponse,
    currentProjectImage2BatchPlanResponse,
    currentProjectImage2BatchRunCheckResponse,
    running,
  } = deps;

  function runtimeState() {
    return typeof running === "function" ? running() : Boolean(running);
  }

  function responseExtra(routeContext) {
    return {
      running: runtimeState(),
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    };
  }

  async function handleCurrentProjectReadCheckRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === currentProjectStatusEndpoint) {
      const routeContext = await currentProjectRouteContext(req, res, url, currentProjectStatusEndpoint);
      if (!routeContext) return true;
      writeJson(res, 200, currentProjectRealChainResponse(responseExtra(routeContext), routeContext.source));
      return true;
    }

    if (req.method === "POST" && url.pathname === currentProjectRunEndpoint) {
      const routeContext = await currentProjectRouteContext(req, res, url, currentProjectRunEndpoint);
      if (!routeContext) return true;
      const payload = currentProjectRealChainRunCheckResponse(responseExtra(routeContext), routeContext.source);
      writeJson(res, payload.ok === false ? 500 : 200, payload);
      return true;
    }

    if (req.method === "GET" && url.pathname === currentProjectImage2BatchPlanEndpoint) {
      const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2BatchPlanEndpoint);
      if (!routeContext) return true;
      writeJson(res, 200, currentProjectImage2BatchPlanResponse(responseExtra(routeContext), routeContext.source));
      return true;
    }

    if (req.method === "POST" && url.pathname === currentProjectImage2BatchRunCheckEndpoint) {
      const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2BatchRunCheckEndpoint);
      if (!routeContext) return true;
      const payload = currentProjectImage2BatchRunCheckResponse(responseExtra(routeContext), routeContext.source);
      writeJson(res, payload.ok === false ? 500 : 200, payload);
      return true;
    }

    return false;
  }

  return {
    handleCurrentProjectReadCheckRoute,
  };
}
