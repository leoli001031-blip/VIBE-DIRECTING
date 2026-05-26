export function createRuntimeApiCurrentProjectBindingRoutes(deps) {
  const {
    currentProjectBindingEndpoint,
    currentProjectRecentEndpoint,
    currentProjectSelectEndpoint,
    readRequestJsonBody,
    writeJson,
    runtimePolicy,
    currentProjectBindingStatusResponse,
    currentProjectRecentResponse,
    selectCurrentProjectBindingResponse,
    clearCurrentProjectBindingResponse,
    running,
  } = deps;

  function runtimeState() {
    return typeof running === "function" ? running() : Boolean(running);
  }

  async function handleCurrentProjectBindingRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === currentProjectBindingEndpoint) {
      writeJson(res, 200, currentProjectBindingStatusResponse({ running: runtimeState() }));
      return true;
    }

    if (
      (req.method === "DELETE" && url.pathname === currentProjectBindingEndpoint)
      || (req.method === "POST" && url.pathname === `${currentProjectBindingEndpoint}/clear`)
    ) {
      const { statusCode, payload } = clearCurrentProjectBindingResponse({ running: runtimeState() });
      writeJson(res, statusCode, payload);
      return true;
    }

    if (req.method === "GET" && url.pathname === currentProjectRecentEndpoint) {
      writeJson(res, 200, currentProjectRecentResponse({ running: runtimeState() }));
      return true;
    }

    if (req.method === "POST" && url.pathname === currentProjectSelectEndpoint) {
      const bodyResult = await readRequestJsonBody(req);
      if (!bodyResult.ok) {
        writeJson(res, 400, {
          ok: false,
          ...runtimePolicy(),
          endpoint: currentProjectSelectEndpoint,
          status: "bad_request",
          message: bodyResult.message,
        });
        return true;
      }
      const { statusCode, payload } = selectCurrentProjectBindingResponse(bodyResult.body);
      writeJson(res, statusCode, payload);
      return true;
    }

    return false;
  }

  return {
    handleCurrentProjectBindingRoute,
  };
}
