export function createRuntimeApiCurrentProjectOneShotRoutes(deps) {
  const {
    currentProjectImage2OneShotStatusEndpoint,
    currentProjectImage2OneShotPrepareEndpoint,
    currentProjectImage2OneShotConfirmEndpoint,
    currentProjectImage2OneShotPrepareTriggerEndpoint,
    currentProjectImage2OneShotExecuteMockEndpoint,
    currentProjectRouteContext,
    writeJson,
    requestOverrideDiagnostics,
    oneShotRequestInput,
    currentProjectImage2OneShotResponse,
    currentProjectImage2OneShotPrepareTriggerResponse,
    oneShotExecutorRequestInput,
    currentProjectImage2OneShotExecutorResponse,
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

  async function handleCurrentProjectOneShotRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === currentProjectImage2OneShotStatusEndpoint) {
      const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2OneShotStatusEndpoint);
      if (!routeContext) return true;
      const input = oneShotRequestInput(url, routeContext.body);
      const payload = currentProjectImage2OneShotResponse("status", input, responseExtra(routeContext), routeContext.source);
      writeJson(res, 200, payload);
      return true;
    }

    if (req.method === "POST" && url.pathname === currentProjectImage2OneShotPrepareEndpoint) {
      const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2OneShotPrepareEndpoint);
      if (!routeContext) return true;
      const input = oneShotRequestInput(url, routeContext.body);
      const payload = currentProjectImage2OneShotResponse("prepare", input, responseExtra(routeContext), routeContext.source);
      writeJson(res, payload.ok === false ? 409 : 200, payload);
      return true;
    }

    if (req.method === "POST" && url.pathname === currentProjectImage2OneShotConfirmEndpoint) {
      const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2OneShotConfirmEndpoint);
      if (!routeContext) return true;
      const input = oneShotRequestInput(url, routeContext.body);
      const payload = currentProjectImage2OneShotResponse("confirm", input, responseExtra(routeContext), routeContext.source);
      writeJson(res, payload.ok === false ? 409 : 200, payload);
      return true;
    }

    if (req.method === "POST" && url.pathname === currentProjectImage2OneShotPrepareTriggerEndpoint) {
      const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2OneShotPrepareTriggerEndpoint);
      if (!routeContext) return true;
      const input = oneShotRequestInput(url, routeContext.body);
      const payload = currentProjectImage2OneShotPrepareTriggerResponse(input, responseExtra(routeContext), routeContext.source);
      writeJson(res, payload.ok === false ? 409 : 200, payload);
      return true;
    }

    if (req.method === "POST" && url.pathname === currentProjectImage2OneShotExecuteMockEndpoint) {
      const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2OneShotExecuteMockEndpoint);
      if (!routeContext) return true;
      const input = oneShotExecutorRequestInput(url, routeContext.body);
      const payload = currentProjectImage2OneShotExecutorResponse(input, responseExtra(routeContext), routeContext.source);
      writeJson(res, payload.ok === false ? 409 : 200, payload);
      return true;
    }

    return false;
  }

  return {
    handleCurrentProjectOneShotRoute,
  };
}
